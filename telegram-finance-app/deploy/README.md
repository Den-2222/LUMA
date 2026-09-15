# Розгортання на сервері

Ubuntu/Debian + systemd. Один прогін ставить бота, API, nginx, TLS і щоденні бекапи.

## Перед початком

1. **Домен.** Заведи A-запис (напр. `groshi.твійдомен`) на IP сервера. Telegram відкриває Mini App лише з валідного HTTPS — самопідписаний сертифікат чи голий IP не підійдуть.
2. **Токен** від [@BotFather](https://t.me/BotFather).
3. **Telegram ID** свій і друзів (підкаже [@userinfobot](https://t.me/userinfobot)).

## Установка

```bash
git clone <репозиторій> finance && cd finance/telegram-finance-app
sudo ./deploy/install.sh \
  --domain groshi.твійдомен \
  --token 123456:AA... \
  --allow 111111,222222 \
  --email ти@пошта
```

Що зробить скрипт:

- поставить пакети (python3-venv, nodejs, nginx, certbot);
- створить системного користувача `finance` без shell;
- покладе код у `/opt/finance-app`, збере Mini App;
- згенерує `.env` з правами `600`;
- підніме `finance-bot` і `finance-api` під systemd з автозапуском і рестартом при падінні;
- налаштує nginx-проксі й візьме сертифікат Let's Encrypt (продовжується сам);
- увімкне щоденний бекап о 04:30 з ротацією (14 останніх копій).

**Без домену** — просто не передавай `--domain`: піднімається лише бот (кнопки, текст, статистика, CSV). Mini App можна ввімкнути пізніше повторним запуском з `--domain`.

## Щоденне життя

```bash
sudo systemctl status finance-bot           # стан
sudo journalctl -u finance-bot -f           # логи бота
sudo journalctl -u finance-api -f           # логи API
sudo systemctl restart finance-bot          # після зміни .env
```

**Оновити код** — повторний запуск того самого скрипта; `.env` і база не постраждають:

```bash
cd ~/finance && git pull
sudo ./deploy/install.sh --domain groshi.твійдомен
```

Аргументи оновлюють лише те, що передано: `--token` перепише токен, `--allow` — список доступу, `--domain` — адресу Mini App. Решта рядків `.env` лишається як була.

**Бекапи:** `/opt/finance-app/data/backups/`. Разовий: `sudo systemctl start finance-backup`.
Відновлення — просто покласти файл назад:

```bash
sudo systemctl stop finance-bot finance-api
sudo -u finance cp /opt/finance-app/data/backups/finance-2026-09-01.db /opt/finance-app/data/finance.db
sudo systemctl start finance-bot finance-api
```

Копії варто інколи забирати з сервера до себе: `scp сервер:/opt/finance-app/data/backups/*.db ./`

## Безпека

- uvicorn слухає тільки `127.0.0.1` — ззовні доступ лише через nginx з TLS.
- Служби працюють від непривілейованого користувача з `ProtectSystem=strict`; на запис доступний тільки каталог з базою.
- Mini App перевіряє підпис `initData` на кожному запиті, плюс білий список `ALLOWED_USERS`.
- У `.env` на бойовому сервері `DEV_USER_ID` має бути **порожнім** — інакше запити без підпису пройдуть як тестовий користувач.
- У фаєрволі достатньо відкрити 80 і 443: `sudo ufw allow 'Nginx Full'`.

## Якщо щось не зійшлося

| Симптом | Причина й що робити |
|---|---|
| `certbot` не видав сертифікат | A-запис ще не розійшовся або 80-й порт закритий. Перевір `dig +short домен`, потім `sudo certbot --nginx -d домен` |
| Бот не відповідає | `journalctl -u finance-bot -n 50`. Найчастіше — порожній або невірний `BOT_TOKEN` |
| Кнопки «Застосунок» нема в меню | `WEBAPP_URL` порожній у `.env` → впиши й `sudo systemctl restart finance-bot` |
| Mini App пише «Немає доступу» | Відкрито не через Telegram, або твого ID немає в `ALLOWED_USERS` |
| 502 від nginx | `finance-api` не запущений: `sudo systemctl status finance-api` |
