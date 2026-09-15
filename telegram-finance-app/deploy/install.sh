#!/usr/bin/env bash
# Розгортання на сервері (Ubuntu/Debian + systemd).
#
#   sudo ./deploy/install.sh --domain groshi.example.com --token 123:AA... --allow 111,222
#
# Без --domain поставить лише бота (Mini App потребує HTTPS-домену).
set -euo pipefail

APP_USER="finance"
APP_DIR="/opt/finance-app"
PORT="8080"
DOMAIN=""
TOKEN=""
ALLOW=""
EMAIL=""
SKIP_TLS="false"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --domain) DOMAIN="$2"; shift 2 ;;
    --token)  TOKEN="$2";  shift 2 ;;
    --allow)  ALLOW="$2";  shift 2 ;;
    --email)  EMAIL="$2";  shift 2 ;;
    --user)   APP_USER="$2"; shift 2 ;;
    --dir)    APP_DIR="$2";  shift 2 ;;
    --port)   PORT="$2";     shift 2 ;;
    --skip-tls) SKIP_TLS="true"; shift ;;
    -h|--help)
      sed -n '2,8p' "$0"; exit 0 ;;
    *) echo "Невідомий аргумент: $1"; exit 1 ;;
  esac
done

[[ $EUID -eq 0 ]] || { echo "❌ Запускай через sudo"; exit 1; }

SOURCE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DATA_DIR="$APP_DIR/data"

step() { printf '\n\033[1m▶ %s\033[0m\n' "$1"; }

step "Пакети"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq python3-venv python3-pip nodejs npm rsync
if [[ -n "$DOMAIN" ]]; then
  apt-get install -y -qq nginx
  [[ "$SKIP_TLS" == "true" ]] || apt-get install -y -qq certbot python3-certbot-nginx
fi

step "Користувач $APP_USER"
id -u "$APP_USER" &>/dev/null || useradd --system --create-home --home-dir "/home/$APP_USER" --shell /usr/sbin/nologin "$APP_USER"

step "Код у $APP_DIR"
mkdir -p "$APP_DIR" "$DATA_DIR"
rsync -a --delete \
  --exclude '.venv' --exclude 'node_modules' --exclude 'data' \
  --exclude '.env' --exclude '__pycache__' --exclude 'webapp/dist' \
  "$SOURCE_DIR/" "$APP_DIR/"

step "Python-залежності"
python3 -m venv "$APP_DIR/.venv"
"$APP_DIR/.venv/bin/pip" install -q --upgrade pip
"$APP_DIR/.venv/bin/pip" install -q -r "$APP_DIR/requirements.txt"

step "Збірка Mini App"
npm --prefix "$APP_DIR/webapp" ci --no-audit --no-fund 2>/dev/null || npm --prefix "$APP_DIR/webapp" install --no-audit --no-fund
npm --prefix "$APP_DIR/webapp" run build

step "Конфіг .env"
ENV_FILE="$APP_DIR/.env"

# Оновлює один ключ у .env, не чіпаючи решти (щоб не загубити токен при повторному запуску)
set_env_key() {
  local key="$1" value="$2"
  if grep -q "^$key=" "$ENV_FILE"; then
    sed -i "s|^$key=.*|$key=$value|" "$ENV_FILE"
  else
    printf '%s=%s\n' "$key" "$value" >> "$ENV_FILE"
  fi
  echo "   $key оновлено"
}

if [[ -f "$ENV_FILE" ]]; then
  echo "   .env уже є — оновлюю лише те, що передано аргументами"
  if [[ -n "$TOKEN" ]];  then set_env_key BOT_TOKEN "$TOKEN"; fi
  if [[ -n "$ALLOW" ]];  then set_env_key ALLOWED_USERS "$ALLOW"; fi
  if [[ -n "$DOMAIN" ]]; then set_env_key WEBAPP_URL "https://$DOMAIN"; fi
else
  WEBAPP_URL=""
  if [[ -n "$DOMAIN" ]]; then WEBAPP_URL="https://$DOMAIN"; fi
  cat > "$ENV_FILE" <<ENV
BOT_TOKEN=$TOKEN
WEBAPP_URL=$WEBAPP_URL
ALLOWED_USERS=$ALLOW
ADMIN_USERS=$ALLOW
DEFAULT_CURRENCY=UAH
TZ_NAME=Europe/Kyiv
DB_PATH=$DATA_DIR/finance.db
HOST=127.0.0.1
PORT=$PORT
DEV_USER_ID=
ENV
  echo "   створено $ENV_FILE"
fi
chmod 600 "$ENV_FILE"
chown -R "$APP_USER:$APP_USER" "$APP_DIR"

step "Служби systemd"
for unit in finance-bot.service finance-api.service finance-backup.service finance-backup.timer; do
  sed -e "s|__USER__|$APP_USER|g" \
      -e "s|__APP_DIR__|$APP_DIR|g" \
      -e "s|__DATA_DIR__|$DATA_DIR|g" \
      -e "s|__PORT__|$PORT|g" \
      "$SOURCE_DIR/deploy/$unit" > "/etc/systemd/system/$unit"
done
systemctl daemon-reload
systemctl enable --now finance-bot.service
systemctl enable --now finance-backup.timer
if [[ -n "$DOMAIN" ]]; then systemctl enable --now finance-api.service; fi

if [[ -n "$DOMAIN" ]]; then
  step "nginx для $DOMAIN"
  sed -e "s|__DOMAIN__|$DOMAIN|g" -e "s|__PORT__|$PORT|g" \
      "$SOURCE_DIR/deploy/nginx.conf.template" > /etc/nginx/sites-available/finance
  ln -sf /etc/nginx/sites-available/finance /etc/nginx/sites-enabled/finance
  # Стандартний сайт не чіпаємо: на сервері може вже щось хоститись,
  # а наш vhost і так має пріоритет за server_name.
  nginx -t && systemctl reload nginx

  if [[ "$SKIP_TLS" != "true" ]]; then
    step "Сертифікат Let's Encrypt"
    certbot_args=(--nginx -d "$DOMAIN" --non-interactive --agree-tos --redirect)
    if [[ -n "$EMAIL" ]]; then
      certbot_args+=(--email "$EMAIL")
    else
      certbot_args+=(--register-unsafely-without-email)
    fi
    certbot "${certbot_args[@]}" || {
        echo "⚠️  certbot не впорався. Перевір, що A-запис $DOMAIN вказує на цей сервер, і повтори:"
        echo "    sudo certbot --nginx -d $DOMAIN"
      }
  fi
fi

step "Стан"
systemctl --no-pager --lines=0 status finance-bot.service || true
if [[ -n "$DOMAIN" ]]; then
  systemctl --no-pager --lines=0 status finance-api.service || true
fi

cat <<DONE

✅ Готово.

   Бот:     sudo systemctl status finance-bot     · логи: journalctl -u finance-bot -f
   API:     sudo systemctl status finance-api     · логи: journalctl -u finance-api -f
   Бекапи:  $DATA_DIR/backups (щодня о 04:30, зберігаються 14 останніх)
   Оновити: sudo ./deploy/install.sh $(if [[ -n "$DOMAIN" ]]; then echo "--domain $DOMAIN"; fi)

DONE
if ! grep -q '^BOT_TOKEN=.\+' "$ENV_FILE"; then
  echo "⚠️  BOT_TOKEN порожній — впиши його у $ENV_FILE і зроби: sudo systemctl restart finance-bot"
fi
exit 0
