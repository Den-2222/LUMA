"""Конфігурація застосунку. Читається з .env або змінних оточення."""
from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent


def _load_dotenv(path: Path) -> None:
    """Мінімальний .env-лоадер, щоб не тягнути зайву залежність."""
    if not path.exists():
        return
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


_load_dotenv(BASE_DIR / ".env")


def _parse_ids(raw: str) -> set[int]:
    ids: set[int] = set()
    for chunk in raw.replace(";", ",").split(","):
        chunk = chunk.strip()
        if chunk.lstrip("-").isdigit():
            ids.add(int(chunk))
    return ids


@dataclass(frozen=True)
class Config:
    bot_token: str = os.getenv("BOT_TOKEN", "")
    webapp_url: str = os.getenv("WEBAPP_URL", "").rstrip("/")
    db_path: Path = Path(os.getenv("DB_PATH", str(BASE_DIR / "data" / "finance.db")))
    default_currency: str = os.getenv("DEFAULT_CURRENCY", "UAH").upper()
    # Whitelist: порожній = пускати всіх (зручно, поки тестуєш наодинці).
    allowed_users: set[int] = field(default_factory=lambda: _parse_ids(os.getenv("ALLOWED_USERS", "")))
    admin_users: set[int] = field(default_factory=lambda: _parse_ids(os.getenv("ADMIN_USERS", "")))
    host: str = os.getenv("HOST", "127.0.0.1")
    port: int = int(os.getenv("PORT", "8080"))
    # Тільки для локальної розробки у звичайному браузері, без Telegram.
    dev_user_id: int | None = int(os.getenv("DEV_USER_ID")) if os.getenv("DEV_USER_ID", "").lstrip("-").isdigit() else None

    def is_allowed(self, user_id: int) -> bool:
        return not self.allowed_users or user_id in self.allowed_users or user_id in self.admin_users

    def is_admin(self, user_id: int) -> bool:
        return user_id in self.admin_users


config = Config()
