"""Перевірка initData з Telegram Mini App.

Без цієї перевірки будь-хто міг би підставити чужий user_id і читати чужі фінанси.
Алгоритм — з офіційної документації Telegram.
"""
from __future__ import annotations

import hashlib
import hmac
import json
import time
from urllib.parse import parse_qsl

from fastapi import Header, HTTPException

from app import repo
from app.config import config

MAX_AGE_SECONDS = 24 * 60 * 60


def verify_init_data(init_data: str, *, max_age: int = MAX_AGE_SECONDS) -> dict:
    """Повертає payload користувача або кидає ValueError."""
    if not init_data:
        raise ValueError("empty init data")
    pairs = dict(parse_qsl(init_data, strict_parsing=True))
    received_hash = pairs.pop("hash", "")
    if not received_hash:
        raise ValueError("no hash")

    check_string = "\n".join(f"{key}={pairs[key]}" for key in sorted(pairs))
    secret_key = hmac.new(b"WebAppData", config.bot_token.encode(), hashlib.sha256).digest()
    expected = hmac.new(secret_key, check_string.encode(), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, received_hash):
        raise ValueError("bad signature")

    auth_date = int(pairs.get("auth_date", "0"))
    if max_age and (time.time() - auth_date) > max_age:
        raise ValueError("init data expired")

    user = json.loads(pairs.get("user", "{}"))
    if not user.get("id"):
        raise ValueError("no user")
    return user


async def current_user(x_telegram_init_data: str = Header(default="")) -> dict:
    """FastAPI-залежність: авторизований користувач із рядка initData."""
    if not x_telegram_init_data and config.dev_user_id:
        # Локальна розробка у звичайному браузері (DEV_USER_ID у .env).
        return await repo.ensure_user(config.dev_user_id, "dev", "Dev")
    try:
        tg_user = verify_init_data(x_telegram_init_data)
    except ValueError as exc:
        raise HTTPException(status_code=401, detail=f"invalid init data: {exc}") from exc
    if not config.is_allowed(int(tg_user["id"])):
        raise HTTPException(status_code=403, detail="not allowed")
    return await repo.ensure_user(int(tg_user["id"]), tg_user.get("username"), tg_user.get("first_name"))
