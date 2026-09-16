"""Рендер текстових екранів бота."""
from __future__ import annotations

from datetime import date
from html import escape
from typing import Any, Sequence

from app.dates import human_day, month_bounds, month_title, today
from app.money import format_amount


def esc(text: str) -> str:
    """Telegram HTML розуміє лише &lt; &gt; &amp; — лапки й апострофи лишаємо як є."""
    return escape(text or "", quote=False)


def plural(count: int, one: str, few: str, many: str) -> str:
    """1 категорію / 2 категорії / 5 категорій."""
    if count % 10 == 1 and count % 100 != 11:
        return one
    if count % 10 in (2, 3, 4) and count % 100 not in (12, 13, 14):
        return few
    return many


def _bar(share: float, width: int = 10) -> str:
    filled = max(1, round(share * width)) if share > 0 else 0
    return "█" * filled + "░" * (width - filled)


def render_summary(data: dict[str, Any]) -> str:
    currency = data["currency"]
    lines = [f"📊 <b>{month_title(data['month'])}</b>", ""]
    lines.append(f"➕ Доходи:  <b>{format_amount(data['income'], currency)}</b>")
    lines.append(f"➖ Витрати: <b>{format_amount(data['expense'], currency)}</b>")
    balance = data["balance"]
    mark = "💚" if balance >= 0 else "🔴"
    lines.append(f"{mark} Різниця: <b>{format_amount(abs(balance), currency, sign='+' if balance >= 0 else '-')}</b>")

    expenses = [c for c in data["by_category"] if c["kind"] == "expense"]
    if expenses:
        total = data["expense"] or 1
        lines += ["", "<b>Куди пішли гроші:</b>"]
        for category in expenses[:8]:
            share = category["total"] / total
            lines.append(
                f"{category['emoji']} {esc(category['name'])}  <code>{_bar(share)}</code> "
                f"{share * 100:.0f}%  <b>{format_amount(category['total'], currency)}</b>"
            )
        if len(expenses) > 8:
            other = sum(c["total"] for c in expenses[8:])
            rest = len(expenses) - 8
            word = plural(rest, "категорія", "категорії", "категорій")
            lines.append(f"…та ще {rest} {word} на {format_amount(other, currency)}")

    start, end = month_bounds(data["month"])
    current = today()
    days = current.day if start[:7] == current.strftime("%Y-%m") else date.fromisoformat(end).day
    if data["expense"] and days:
        lines += ["", f"📅 У середньому <b>{format_amount(round(data['expense'] / days), currency)}</b> на день"]
    if not data["income"] and not data["expense"]:
        lines += ["", "Записів за цей місяць ще немає."]
    return "\n".join(lines)


def render_history(transactions: Sequence[dict[str, Any]]) -> str:
    if not transactions:
        return "📜 Тут поки порожньо.\n\nДодай перший запис: <code>250 продукти</code>"
    lines = ["📜 <b>Останні записи</b>", ""]
    current_day = None
    for index, tx in enumerate(transactions, start=1):
        if tx["occurred_at"] != current_day:
            current_day = tx["occurred_at"]
            lines.append(f"<b>{human_day(current_day).capitalize()}</b>")
        sign = "+" if tx["kind"] == "income" else "−"
        note = f" · {esc(tx['note'])}" if tx["note"] else ""
        lines.append(
            f"<code>{index}.</code> {tx['category_emoji'] or '❔'} {esc(tx['category_name'] or 'Без категорії')}"
            f"{note} — <b>{sign}{format_amount(tx['amount'], tx['currency'])}</b>"
        )
    lines += ["", "<i>Тисни 🗑 з номером, щоб видалити запис.</i>"]
    return "\n".join(lines)


def render_saved(tx: dict[str, Any], summary: dict[str, Any]) -> str:
    sign = "+" if tx["kind"] == "income" else "−"
    title = "Дохід" if tx["kind"] == "income" else "Витрата"
    note = f"\n📝 {esc(tx['note'])}" if tx["note"] else ""
    return (
        f"✅ <b>{title} {sign}{format_amount(tx['amount'], tx['currency'])}</b>\n"
        f"{tx['category_emoji'] or '❔'} {esc(tx['category_name'] or 'Без категорії')}"
        f" · {human_day(tx['occurred_at'])}{note}\n\n"
        f"Цього місяця: витрачено <b>{format_amount(summary['expense'], summary['currency'])}</b>, "
        f"залишок <b>{format_amount(summary['balance'], summary['currency'], sign='+' if summary['balance'] >= 0 else '-')}</b>"
    )


def render_budgets(budgets: Sequence[dict[str, Any]], currency: str) -> str:
    if not budgets:
        return (
            "🎯 <b>Ліміти</b>\n\nЛімітів ще немає.\n\n"
            "Надішли повідомлення у форматі <code>ліміт продукти 8000</code>, "
            "щоб бот попереджав, коли витрати наближаються до межі."
        )
    lines = ["🎯 <b>Ліміти на місяць</b>", ""]
    for budget in budgets:
        share = budget["spent"] / budget["amount"] if budget["amount"] else 0
        mark = "🟢" if share < 0.8 else ("🟡" if share <= 1 else "🔴")
        lines.append(
            f"{mark} {budget['emoji']} {esc(budget['name'])}  <code>{_bar(min(share, 1.0))}</code> "
            f"{share * 100:.0f}%\n     {format_amount(budget['spent'], currency)} з "
            f"{format_amount(budget['amount'], currency)}"
        )
    lines += ["", "<i>Змінити:</i> <code>ліміт кафе 3000</code>\n<i>Прибрати:</i> <code>ліміт кафе 0</code>"]
    return "\n".join(lines)
