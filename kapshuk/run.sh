#!/usr/bin/env bash
# Хелпер запуску. Використання: ./run.sh <команда>
set -euo pipefail
cd "$(dirname "$0")"

PY=".venv/bin/python"

case "${1:-help}" in
  setup)
    python3 -m venv .venv
    $PY -m pip install -q --upgrade pip
    $PY -m pip install -q -r requirements.txt
    (cd webapp && npm install && npm run build)
    [ -f .env ] || cp .env.example .env
    echo "✅ Готово. Впиши BOT_TOKEN у .env і запусти: ./run.sh bot"
    ;;
  bot)      exec $PY -m bot ;;
  server)   exec $PY -m server.main ;;
  build)    (cd webapp && npm run build) ;;
  dev)      (cd webapp && npm run dev) ;;
  test)
    $PY -m tests.test_auth
    $PY -m tests.test_bot_flow
    ;;
  backup)  exec $PY -m app.backup ;;
  *)
    echo "Команди: setup | bot | server | build | dev | test | backup"
    ;;
esac
