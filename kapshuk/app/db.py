"""Схема SQLite і стартові дані. Один файл БД спільний для бота й API."""
from __future__ import annotations

import aiosqlite

from app.config import config

SCHEMA = """
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY,           -- telegram user id
    username      TEXT,
    first_name    TEXT,
    currency      TEXT NOT NULL DEFAULT 'UAH',
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS categories (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kind       TEXT    NOT NULL CHECK (kind IN ('income', 'expense')),
    name       TEXT    NOT NULL,
    emoji      TEXT    NOT NULL DEFAULT '💸',
    keywords   TEXT    NOT NULL DEFAULT '',      -- для розпізнавання з тексту
    sort       INTEGER NOT NULL DEFAULT 100,
    archived   INTEGER NOT NULL DEFAULT 0,
    UNIQUE (user_id, kind, name)
);

CREATE TABLE IF NOT EXISTS transactions (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category_id  INTEGER REFERENCES categories(id) ON DELETE SET NULL,
    kind         TEXT    NOT NULL CHECK (kind IN ('income', 'expense')),
    amount       INTEGER NOT NULL CHECK (amount > 0),   -- копійки
    currency     TEXT    NOT NULL DEFAULT 'UAH',
    note         TEXT    NOT NULL DEFAULT '',
    occurred_at  TEXT    NOT NULL,                      -- YYYY-MM-DD
    created_at   TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_tx_user_date ON transactions (user_id, occurred_at DESC, id DESC);

CREATE TABLE IF NOT EXISTS budgets (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    amount      INTEGER NOT NULL CHECK (amount > 0),
    UNIQUE (user_id, category_id)
);
"""

DEFAULT_EXPENSE = [
    ("Продукти", "🛒", "продукти,їжа,магазин,сільпо,атб,ашан,новус"),
    ("Кафе", "🍔", "кафе,ресторан,кава,обід,піца,суші,фастфуд,мак"),
    ("Транспорт", "🚕", "таксі,транспорт,бензин,метро,автобус,uber,болт,bolt,паливо"),
    ("Житло", "🏠", "оренда,квартира,комуналка,світло,газ,вода"),
    ("Здоров'я", "💊", "аптека,ліки,лікар,стоматолог,здоровя,здоров'я"),
    ("Одяг", "👕", "одяг,взуття,кросівки,куртка,шопінг"),
    ("Розваги", "🎮", "розваги,кіно,гра,бар,концерт,клуб"),
    ("Зв'язок", "📱", "інтернет,мобільний,звязок,зв'язок,підписка,netflix,spotify"),
    ("Освіта", "🎓", "освіта,курси,книги,навчання"),
    ("Подарунки", "🎁", "подарунок,подарунки,донат,благодійність"),
    ("Подорожі", "✈️", "подорож,квитки,готель,відпустка"),
    ("Інше", "💸", "інше"),
]

DEFAULT_INCOME = [
    ("Зарплата", "💼", "зарплата,зп,аванс"),
    ("Фриланс", "💻", "фриланс,підробіток,замовлення,проєкт"),
    ("Подарунок", "🎁", "подарунок,подарували"),
    ("Інвестиції", "📈", "інвестиції,дивіденди,відсотки,депозит"),
    ("Повернення", "🔁", "повернення,кешбек,кешбєк,борг"),
    ("Інше", "💰", "інше"),
]


async def connect() -> aiosqlite.Connection:
    config.db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = await aiosqlite.connect(config.db_path)
    conn.row_factory = aiosqlite.Row
    await conn.execute("PRAGMA foreign_keys = ON")
    return conn


async def init_db() -> None:
    conn = await connect()
    try:
        await conn.executescript(SCHEMA)
        await conn.commit()
    finally:
        await conn.close()


async def seed_categories(conn: aiosqlite.Connection, user_id: int) -> None:
    """Створює стандартний набір категорій для нового користувача."""
    rows = [
        (user_id, kind, name, emoji, keywords, index * 10)
        for kind, defaults in (("expense", DEFAULT_EXPENSE), ("income", DEFAULT_INCOME))
        for index, (name, emoji, keywords) in enumerate(defaults)
    ]
    await conn.executemany(
        "INSERT OR IGNORE INTO categories (user_id, kind, name, emoji, keywords, sort)"
        " VALUES (?, ?, ?, ?, ?, ?)",
        rows,
    )
