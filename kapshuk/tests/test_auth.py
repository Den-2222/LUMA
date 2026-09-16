"""Перевірка підпису Telegram initData — головний захист чужих фінансів.

Запуск: python -m tests.test_auth
"""
from __future__ import annotations

import hashlib
import hmac
import json
import os
import sys
import time
from pathlib import Path
from urllib.parse import urlencode

os.environ["BOT_TOKEN"] = "42:REAL-TOKEN"
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from server.auth import verify_init_data  # noqa: E402

REAL_TOKEN = "42:REAL-TOKEN"


def make_init_data(user_id: int = 777, age_seconds: int = 0, token: str = REAL_TOKEN) -> str:
    fields = {
        "auth_date": str(int(time.time()) - age_seconds),
        "query_id": "AAH",
        "user": json.dumps({"id": user_id, "first_name": "Den"}, separators=(",", ":")),
    }
    check_string = "\n".join(f"{key}={fields[key]}" for key in sorted(fields))
    secret = hmac.new(b"WebAppData", token.encode(), hashlib.sha256).digest()
    fields["hash"] = hmac.new(secret, check_string.encode(), hashlib.sha256).hexdigest()
    return urlencode(fields)


def expect_rejected(init_data: str, label: str) -> None:
    try:
        verify_init_data(init_data)
    except ValueError as exc:
        print(f"  ✅ {label} — відхилено ({exc})")
        return
    raise SystemExit(f"❌ {label} — ПРОПУЩЕНО, це дірка в безпеці")


def main() -> None:
    print("\nПеревірка initData:")
    user = verify_init_data(make_init_data())
    assert user["id"] == 777
    print("  ✅ справжній підпис — прийнято")

    expect_rejected(make_init_data(token="42:FAKE-TOKEN"), "підпис чужим токеном")
    expect_rejected(make_init_data(age_seconds=25 * 3600), "прострочені дані (>24 год)")
    expect_rejected("user=%7B%22id%22%3A1%7D&hash=deadbeef", "вигаданий hash")
    expect_rejected("user=%7B%22id%22%3A1%7D", "без hash")
    expect_rejected("", "порожній рядок")

    # підміна user_id у вже підписаних даних
    tampered = make_init_data(user_id=777).replace("777", "999")
    expect_rejected(tampered, "підміна user_id у підписаних даних")

    print("\nУсі перевірки безпеки пройдено ✅")


if __name__ == "__main__":
    main()
