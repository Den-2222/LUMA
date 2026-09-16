#!/usr/bin/env bash
# Розгортання на сервері (Ubuntu/Debian + systemd).
#
#   sudo ./deploy/install.sh --domain groshi.example.com --token 123:AA... --allow 111,222
#
# Без --domain поставить лише бота (Mini App потребує HTTPS-домену).
# --skip-build  — не збирати фронтенд на сервері (використає готовий webapp/dist)
# --no-swap     — не чіпати swap навіть на дроплеті з малою пам'яттю
set -euo pipefail

APP_USER="kapshuk"
APP_DIR="/opt/kapshuk"
PORT="8080"
PORT_EXPLICIT="false"
DOMAIN=""
TOKEN=""
ALLOW=""
EMAIL=""
SKIP_TLS="false"
SKIP_BUILD="false"
NO_SWAP="false"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --domain) DOMAIN="$2"; shift 2 ;;
    --token)  TOKEN="$2";  shift 2 ;;
    --allow)  ALLOW="$2";  shift 2 ;;
    --email)  EMAIL="$2";  shift 2 ;;
    --user)   APP_USER="$2"; shift 2 ;;
    --dir)    APP_DIR="$2";  shift 2 ;;
    --port)   PORT="$2"; PORT_EXPLICIT="true"; shift 2 ;;
    --skip-tls) SKIP_TLS="true"; shift ;;
    --skip-build) SKIP_BUILD="true"; shift ;;
    --no-swap) NO_SWAP="true"; shift ;;
    -h|--help)
      sed -n '2,8p' "$0"; exit 0 ;;
    *) echo "Невідомий аргумент: $1"; exit 1 ;;
  esac
done

[[ $EUID -eq 0 ]] || { echo "❌ Запускай через sudo"; exit 1; }

SOURCE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DATA_DIR="$APP_DIR/data"

step() { printf '\n\033[1m▶ %s\033[0m\n' "$1"; }

# --- перевірка, що ми нічого не зламаємо на вже зайнятому сервері -----------

# Ім'я процесу, який слухає порт (ss → lsof → нічого). Порожньо = вільний або невідомий.
port_owner() {
  local port="$1"
  if command -v ss >/dev/null 2>&1; then
    ss -tlnp 2>/dev/null | awk -v p=":$port\$" '$4 ~ p {print; exit}' \
      | sed -n 's/.*users:((\"\([^\"]*\)\".*/\1/p'
  elif command -v lsof >/dev/null 2>&1; then
    lsof -iTCP:"$port" -sTCP:LISTEN -Fc 2>/dev/null | sed -n 's/^c//p' | head -1
  fi
}

# Чи зайнятий порт. Пробуємо ss, потім lsof, у крайньому разі — /proc.
port_busy() {
  local port="$1"
  if command -v ss >/dev/null 2>&1; then
    if ss -tln 2>/dev/null | awk -v p=":${port}$" '$4 ~ p {exit 0} END {exit 1}'; then return 0; fi
    return 1
  fi
  if command -v lsof >/dev/null 2>&1; then
    if lsof -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; then return 0; fi
    return 1
  fi
  local hex files=()
  hex=$(printf ':%04X' "$port")
  # Файли перелічуємо через if: під set -e конструкція `[[ ... ]] && ...` обірвала б скрипт,
  # а неіснуючий /proc/net/tcp6 змусив би awk завершитись кодом 2 (і зайнятий порт здався б вільним)
  if [[ -r /proc/net/tcp ]];  then files+=(/proc/net/tcp);  fi
  if [[ -r /proc/net/tcp6 ]]; then files+=(/proc/net/tcp6); fi
  if (( ${#files[@]} == 0 )); then return 1; fi
  if awk -v h="$hex" '$4 == "0A" && $2 ~ h"$" {found = 1} END {exit !found}' "${files[@]}" 2>/dev/null; then
    return 0
  fi
  return 1
}

step "Перевірка сервера"

# 1. Локальний порт для uvicorn
if port_busy "$PORT"; then
  owner="$(port_owner "$PORT")"
  if [[ "$PORT_EXPLICIT" == "true" ]]; then
    echo "❌ Порт $PORT уже зайнятий${owner:+ (}${owner}${owner:+)}. Вибери інший через --port."
    exit 1
  fi
  for candidate in $(seq 8081 8099); do
    if ! port_busy "$candidate"; then
      echo "   Порт $PORT зайнятий${owner:+ (}${owner}${owner:+)} — беру $candidate"
      PORT="$candidate"
      break
    fi
  done
  if port_busy "$PORT"; then
    echo "❌ Не знайшов вільного порту в діапазоні 8080-8099. Вкажи свій через --port."
    exit 1
  fi
else
  echo "   Порт $PORT вільний"
fi

# 2. Хто тримає 80-й: nginx нам підходить (просто додамо свій сайт), решта — конфлікт
if [[ -n "$DOMAIN" ]]; then
  web_owner="$(port_owner 80)"
  case "$web_owner" in
    ""|nginx)
      if port_busy 80; then
        echo "   80-й порт: nginx — додам ще один сайт, наявні не чіпаю"
      else
        echo "   80-й порт вільний"
      fi
      ;;
    *)
      cat <<CONFLICT
❌ 80-й порт зайнятий процесом «$web_owner», а не nginx.

   Установник не чіпатиме те, що вже працює. Варіанти:
   1) Постав без Mini App (прибери --domain) — бот працюватиме однаково.
   2) Пропиши проксі на 127.0.0.1:$PORT у своєму веб-сервері й запусти з --skip-tls.

CONFLICT
      exit 1
      ;;
  esac
fi

# 3. Чи не займе хтось уже наше ім'я служби
for existing in kapshuk-bot kapshuk-api; do
  if systemctl list-unit-files 2>/dev/null | grep -q "^$existing.service" && [[ ! -f "$APP_DIR/.env" ]]; then
    echo "   ⚠️  Служба $existing вже є, але $APP_DIR порожній — перевір, чи це не інша установка"
  fi
done

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
RSYNC_EXCLUDES=(--exclude '.venv' --exclude 'node_modules' --exclude 'data' --exclude '.env' --exclude '__pycache__')
# Готову збірку переносимо лише тоді, коли не збиратимемо її на сервері
if [[ "$SKIP_BUILD" != "true" ]]; then RSYNC_EXCLUDES+=(--exclude 'webapp/dist'); fi
rsync -a --delete "${RSYNC_EXCLUDES[@]}" "$SOURCE_DIR/" "$APP_DIR/"

step "Python-залежності"
python3 -m venv "$APP_DIR/.venv"
"$APP_DIR/.venv/bin/pip" install -q --upgrade pip
"$APP_DIR/.venv/bin/pip" install -q -r "$APP_DIR/requirements.txt"

# На дроплеті з 512 МБ RAM npm install і vite build падають з OOM.
# Гігабайта swap вистачає, щоб збірка пройшла (працює вона рідко, тож повільність не болить).
ensure_swap() {
  local mem_kb swap_kb total_mb
  mem_kb=$(awk '/^MemTotal:/ {print $2}' /proc/meminfo)
  swap_kb=$(awk '/^SwapTotal:/ {print $2}' /proc/meminfo)
  total_mb=$(( (mem_kb + swap_kb) / 1024 ))
  if (( total_mb >= ${SWAP_MIN_MB:-1400} )); then
    echo "   RAM+swap = ${total_mb} МБ — додавати нічого не треба"
    return 0
  fi
  if swapon --show --noheadings | grep -q /swapfile; then
    echo "   /swapfile уже підключений"
    return 0
  fi
  echo "   Пам'яті мало (${total_mb} МБ) — створюю /swapfile на 1 ГБ"
  if [[ ! -f /swapfile ]]; then
    fallocate -l 1G /swapfile 2>/dev/null || dd if=/dev/zero of=/swapfile bs=1M count=1024 status=none
  fi
  chmod 600 /swapfile
  mkswap /swapfile >/dev/null 2>&1 || true
  if swapon /swapfile 2>/dev/null; then
    grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
    echo "   ✅ swap увімкнено (і додано в /etc/fstab)"
  else
    echo "   ⚠️  swap увімкнути не вдалось — якщо збірка впаде, збери фронтенд локально і запусти з --skip-build"
  fi
}

step "Збірка Mini App"
if [[ "$SKIP_BUILD" == "true" ]]; then
  if [[ -f "$APP_DIR/webapp/dist/index.html" ]]; then
    echo "   --skip-build: беру готову збірку з webapp/dist"
  else
    echo "❌ --skip-build задано, але webapp/dist порожній."
    echo "   Збери локально (npm --prefix webapp run build) і скопіюй dist на сервер."
    exit 1
  fi
else
  [[ "$NO_SWAP" == "true" ]] || ensure_swap
  npm --prefix "$APP_DIR/webapp" ci --no-audit --no-fund 2>/dev/null || npm --prefix "$APP_DIR/webapp" install --no-audit --no-fund
  npm --prefix "$APP_DIR/webapp" run build
fi

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
  # Порт міг змінитись автоматично через зайнятий 8080 — тримаємо .env і юніт в одному стані
  if ! grep -q "^PORT=$PORT$" "$ENV_FILE"; then set_env_key PORT "$PORT"; fi
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
DB_PATH=$DATA_DIR/kapshuk.db
HOST=127.0.0.1
PORT=$PORT
DEV_USER_ID=
ENV
  echo "   створено $ENV_FILE"
fi
chmod 600 "$ENV_FILE"
chown -R "$APP_USER:$APP_USER" "$APP_DIR"

step "Служби systemd"
for unit in kapshuk-bot.service kapshuk-api.service kapshuk-backup.service kapshuk-backup.timer; do
  sed -e "s|__USER__|$APP_USER|g" \
      -e "s|__APP_DIR__|$APP_DIR|g" \
      -e "s|__DATA_DIR__|$DATA_DIR|g" \
      -e "s|__PORT__|$PORT|g" \
      "$SOURCE_DIR/deploy/$unit" > "/etc/systemd/system/$unit"
done
systemctl daemon-reload
systemctl enable --now kapshuk-bot.service
systemctl enable --now kapshuk-backup.timer
if [[ -n "$DOMAIN" ]]; then systemctl enable --now kapshuk-api.service; fi

if [[ -n "$DOMAIN" ]]; then
  step "nginx для $DOMAIN"
  if [[ -f /etc/nginx/sites-available/kapshuk ]]; then
    cp /etc/nginx/sites-available/kapshuk "/etc/nginx/sites-available/kapshuk.bak.$(date +%s)"
    echo "   наявний конфіг збережено як kapshuk.bak.*"
  fi
  sed -e "s|__DOMAIN__|$DOMAIN|g" -e "s|__PORT__|$PORT|g" \
      "$SOURCE_DIR/deploy/nginx.conf.template" > /etc/nginx/sites-available/kapshuk
  ln -sf /etc/nginx/sites-available/kapshuk /etc/nginx/sites-enabled/kapshuk
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
systemctl --no-pager --lines=0 status kapshuk-bot.service || true
if [[ -n "$DOMAIN" ]]; then
  systemctl --no-pager --lines=0 status kapshuk-api.service || true
fi

cat <<DONE

✅ Готово.

   Бот:     sudo systemctl status kapshuk-bot     · логи: journalctl -u kapshuk-bot -f
   API:     sudo systemctl status kapshuk-api     · логи: journalctl -u kapshuk-api -f
   Бекапи:  $DATA_DIR/backups (щодня о 04:30, зберігаються 14 останніх)
   Оновити: sudo ./deploy/install.sh $(if [[ -n "$DOMAIN" ]]; then echo "--domain $DOMAIN"; fi)

DONE
if ! grep -q '^BOT_TOKEN=.\+' "$ENV_FILE"; then
  echo "⚠️  BOT_TOKEN порожній — впиши його у $ENV_FILE і зроби: sudo systemctl restart kapshuk-bot"
fi
exit 0
