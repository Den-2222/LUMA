"""Усі запити до БД в одному місці — і бот, і API ходять тільки сюди."""
from __future__ import annotations

from typing import Any, Iterable

import aiosqlite

from app.config import config
from app.dates import current_month, month_bounds, today
from app.db import connect, seed_categories

Row = dict[str, Any]


def _rows(cursor_rows: Iterable[aiosqlite.Row]) -> list[Row]:
    return [dict(row) for row in cursor_rows]


# ---------------------------------------------------------------- users

async def ensure_user(user_id: int, username: str | None = None, first_name: str | None = None) -> Row:
    conn = await connect()
    try:
        cur = await conn.execute("SELECT * FROM users WHERE id = ?", (user_id,))
        row = await cur.fetchone()
        if row is None:
            await conn.execute(
                "INSERT INTO users (id, username, first_name, currency) VALUES (?, ?, ?, ?)",
                (user_id, username or "", first_name or "", config.default_currency),
            )
            await seed_categories(conn, user_id)
            await conn.commit()
            cur = await conn.execute("SELECT * FROM users WHERE id = ?", (user_id,))
            row = await cur.fetchone()
        elif username and row["username"] != username:
            await conn.execute("UPDATE users SET username = ? WHERE id = ?", (username, user_id))
            await conn.commit()
        return dict(row)
    finally:
        await conn.close()


async def set_currency(user_id: int, currency: str) -> None:
    conn = await connect()
    try:
        await conn.execute("UPDATE users SET currency = ? WHERE id = ?", (currency.upper(), user_id))
        await conn.commit()
    finally:
        await conn.close()


# ----------------------------------------------------------- categories

async def list_categories(user_id: int, kind: str | None = None) -> list[Row]:
    conn = await connect()
    try:
        sql = "SELECT * FROM categories WHERE user_id = ? AND archived = 0"
        args: list[Any] = [user_id]
        if kind:
            sql += " AND kind = ?"
            args.append(kind)
        sql += " ORDER BY sort, name"
        cur = await conn.execute(sql, args)
        return _rows(await cur.fetchall())
    finally:
        await conn.close()


async def add_category(user_id: int, kind: str, name: str, emoji: str = "🏷") -> Row | None:
    conn = await connect()
    try:
        cur = await conn.execute(
            "INSERT OR IGNORE INTO categories (user_id, kind, name, emoji, sort) VALUES (?, ?, ?, ?, 500)",
            (user_id, kind, name.strip()[:32], emoji),
        )
        await conn.commit()
        if not cur.lastrowid:
            return None
        cur = await conn.execute("SELECT * FROM categories WHERE id = ?", (cur.lastrowid,))
        row = await cur.fetchone()
        return dict(row) if row else None
    finally:
        await conn.close()


async def archive_category(user_id: int, category_id: int) -> bool:
    conn = await connect()
    try:
        cur = await conn.execute(
            "UPDATE categories SET archived = 1 WHERE id = ? AND user_id = ?", (category_id, user_id)
        )
        await conn.commit()
        return cur.rowcount > 0
    finally:
        await conn.close()


# --------------------------------------------------------- transactions

async def add_transaction(
    user_id: int,
    kind: str,
    amount: int,
    category_id: int | None = None,
    note: str = "",
    occurred_at: str | None = None,
) -> Row:
    conn = await connect()
    try:
        cur = await conn.execute("SELECT currency FROM users WHERE id = ?", (user_id,))
        user = await cur.fetchone()
        currency = user["currency"] if user else config.default_currency
        cur = await conn.execute(
            "INSERT INTO transactions (user_id, category_id, kind, amount, currency, note, occurred_at)"
            " VALUES (?, ?, ?, ?, ?, ?, ?)",
            (user_id, category_id, kind, amount, currency, note[:200], occurred_at or today().isoformat()),
        )
        await conn.commit()
        return await _get_tx(conn, user_id, cur.lastrowid)
    finally:
        await conn.close()


async def _get_tx(conn: aiosqlite.Connection, user_id: int, tx_id: int) -> Row:
    cur = await conn.execute(
        "SELECT t.*, c.name AS category_name, c.emoji AS category_emoji"
        " FROM transactions t LEFT JOIN categories c ON c.id = t.category_id"
        " WHERE t.id = ? AND t.user_id = ?",
        (tx_id, user_id),
    )
    row = await cur.fetchone()
    return dict(row) if row else {}


async def get_transaction(user_id: int, tx_id: int) -> Row:
    conn = await connect()
    try:
        return await _get_tx(conn, user_id, tx_id)
    finally:
        await conn.close()


async def list_transactions(
    user_id: int,
    month: str | None = None,
    kind: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> list[Row]:
    conn = await connect()
    try:
        sql = (
            "SELECT t.*, c.name AS category_name, c.emoji AS category_emoji"
            " FROM transactions t LEFT JOIN categories c ON c.id = t.category_id"
            " WHERE t.user_id = ?"
        )
        args: list[Any] = [user_id]
        if month:
            start, end = month_bounds(month)
            sql += " AND t.occurred_at BETWEEN ? AND ?"
            args += [start, end]
        if kind:
            sql += " AND t.kind = ?"
            args.append(kind)
        sql += " ORDER BY t.occurred_at DESC, t.id DESC LIMIT ? OFFSET ?"
        args += [max(1, min(limit, 200)), max(0, offset)]
        cur = await conn.execute(sql, args)
        return _rows(await cur.fetchall())
    finally:
        await conn.close()


async def delete_transaction(user_id: int, tx_id: int) -> bool:
    conn = await connect()
    try:
        cur = await conn.execute("DELETE FROM transactions WHERE id = ? AND user_id = ?", (tx_id, user_id))
        await conn.commit()
        return cur.rowcount > 0
    finally:
        await conn.close()


# -------------------------------------------------------------- summary

async def summary(user_id: int, month: str | None = None) -> Row:
    """Підсумок за місяць: доходи, витрати, розбивка по категоріях і днях."""
    month = month or current_month()
    start, end = month_bounds(month)
    conn = await connect()
    try:
        cur = await conn.execute("SELECT currency FROM users WHERE id = ?", (user_id,))
        user = await cur.fetchone()
        currency = user["currency"] if user else config.default_currency

        cur = await conn.execute(
            "SELECT kind, COALESCE(SUM(amount), 0) AS total, COUNT(*) AS count"
            " FROM transactions WHERE user_id = ? AND occurred_at BETWEEN ? AND ? GROUP BY kind",
            (user_id, start, end),
        )
        totals = {row["kind"]: (row["total"], row["count"]) for row in await cur.fetchall()}
        income, income_count = totals.get("income", (0, 0))
        expense, expense_count = totals.get("expense", (0, 0))

        cur = await conn.execute(
            "SELECT t.kind, t.category_id,"
            "       COALESCE(c.name, 'Без категорії') AS name,"
            "       COALESCE(c.emoji, '❔') AS emoji,"
            "       SUM(t.amount) AS total, COUNT(*) AS count"
            " FROM transactions t LEFT JOIN categories c ON c.id = t.category_id"
            " WHERE t.user_id = ? AND t.occurred_at BETWEEN ? AND ?"
            " GROUP BY t.kind, t.category_id ORDER BY total DESC",
            (user_id, start, end),
        )
        by_category = _rows(await cur.fetchall())

        cur = await conn.execute(
            "SELECT occurred_at AS day, kind, SUM(amount) AS total"
            " FROM transactions WHERE user_id = ? AND occurred_at BETWEEN ? AND ?"
            " GROUP BY occurred_at, kind ORDER BY occurred_at",
            (user_id, start, end),
        )
        by_day = _rows(await cur.fetchall())

        return {
            "month": month,
            "currency": currency,
            "income": income,
            "expense": expense,
            "balance": income - expense,
            "income_count": income_count,
            "expense_count": expense_count,
            "by_category": by_category,
            "by_day": by_day,
        }
    finally:
        await conn.close()


async def recent_amounts(user_id: int, kind: str, limit: int = 4) -> list[int]:
    """Найчастіші суми користувача — для кнопок швидкого вводу."""
    conn = await connect()
    try:
        cur = await conn.execute(
            "SELECT amount, COUNT(*) AS freq FROM transactions"
            " WHERE user_id = ? AND kind = ? GROUP BY amount ORDER BY freq DESC, MAX(id) DESC LIMIT ?",
            (user_id, kind, limit),
        )
        return [row["amount"] for row in await cur.fetchall()]
    finally:
        await conn.close()


# -------------------------------------------------------------- budgets

async def set_budget(user_id: int, category_id: int, amount: int) -> None:
    conn = await connect()
    try:
        await conn.execute(
            "INSERT INTO budgets (user_id, category_id, amount) VALUES (?, ?, ?)"
            " ON CONFLICT (user_id, category_id) DO UPDATE SET amount = excluded.amount",
            (user_id, category_id, amount),
        )
        await conn.commit()
    finally:
        await conn.close()


async def delete_budget(user_id: int, category_id: int) -> bool:
    conn = await connect()
    try:
        cur = await conn.execute(
            "DELETE FROM budgets WHERE user_id = ? AND category_id = ?", (user_id, category_id)
        )
        await conn.commit()
        return cur.rowcount > 0
    finally:
        await conn.close()


async def list_budgets(user_id: int, month: str | None = None) -> list[Row]:
    """Ліміти разом із витраченою сумою за місяць."""
    start, end = month_bounds(month or current_month())
    conn = await connect()
    try:
        cur = await conn.execute(
            "SELECT b.category_id, b.amount, c.name, c.emoji,"
            "       COALESCE((SELECT SUM(t.amount) FROM transactions t"
            "                 WHERE t.category_id = b.category_id AND t.user_id = b.user_id"
            "                   AND t.kind = 'expense' AND t.occurred_at BETWEEN ? AND ?), 0) AS spent"
            " FROM budgets b JOIN categories c ON c.id = b.category_id"
            " WHERE b.user_id = ? ORDER BY c.sort",
            (start, end, user_id),
        )
        return _rows(await cur.fetchall())
    finally:
        await conn.close()
