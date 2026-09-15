"""Клавіатури бота: постійне нижнє меню + інлайн-кнопки під повідомленнями."""
from __future__ import annotations

from typing import Any, Sequence

from aiogram.types import (
    InlineKeyboardButton,
    InlineKeyboardMarkup,
    KeyboardButton,
    ReplyKeyboardMarkup,
    WebAppInfo,
)
from aiogram.utils.keyboard import InlineKeyboardBuilder

from app.config import config
from app.money import format_amount
from bot import texts

QUICK_AMOUNTS = {"expense": [5000, 10000, 20000, 50000], "income": [100000, 500000, 1000000, 5000000]}


def main_menu() -> ReplyKeyboardMarkup:
    rows = [
        [KeyboardButton(text=texts.BTN_EXPENSE), KeyboardButton(text=texts.BTN_INCOME)],
        [KeyboardButton(text=texts.BTN_STATS), KeyboardButton(text=texts.BTN_HISTORY)],
    ]
    last = [KeyboardButton(text=texts.BTN_SETTINGS)]
    if config.webapp_url:
        # web_app-кнопка відкриває Mini App прямо в Telegram
        last.insert(0, KeyboardButton(text=texts.BTN_APP, web_app=WebAppInfo(url=config.webapp_url)))
    rows.append(last)
    return ReplyKeyboardMarkup(keyboard=rows, resize_keyboard=True, is_persistent=True)


def amount_keyboard(kind: str, recent: Sequence[int], currency: str) -> InlineKeyboardMarkup:
    """Швидкі суми: спочатку ті, які користувач вводить найчастіше."""
    amounts: list[int] = []
    for amount in list(recent) + QUICK_AMOUNTS[kind]:
        if amount not in amounts:
            amounts.append(amount)
        if len(amounts) == 6:
            break
    builder = InlineKeyboardBuilder()
    for amount in amounts:
        builder.button(text=format_amount(amount, currency), callback_data=f"amt:{kind}:{amount}")
    builder.adjust(3)
    builder.row(InlineKeyboardButton(text="✖️ Скасувати", callback_data="cancel"))
    return builder.as_markup()


def categories_keyboard(categories: Sequence[dict[str, Any]], prefix: str) -> InlineKeyboardMarkup:
    builder = InlineKeyboardBuilder()
    for category in categories:
        builder.button(text=f"{category['emoji']} {category['name']}", callback_data=f"{prefix}:{category['id']}")
    builder.adjust(3)
    builder.row(
        InlineKeyboardButton(text="⏭ Без категорії", callback_data=f"{prefix}:0"),
        InlineKeyboardButton(text="✖️ Скасувати", callback_data="cancel"),
    )
    return builder.as_markup()


def saved_keyboard(tx_id: int) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[[
            InlineKeyboardButton(text="🏷 Категорія", callback_data=f"recat:{tx_id}"),
            InlineKeyboardButton(text="🗑 Видалити", callback_data=f"del:{tx_id}"),
        ]]
    )


def stats_keyboard(month: str) -> InlineKeyboardMarkup:
    rows = [[
        InlineKeyboardButton(text="◀️", callback_data=f"stats:{month}:-1"),
        InlineKeyboardButton(text="🔄", callback_data=f"stats:{month}:0"),
        InlineKeyboardButton(text="▶️", callback_data=f"stats:{month}:1"),
    ]]
    if config.webapp_url:
        rows.append([InlineKeyboardButton(
            text="📱 Графіки в застосунку", web_app=WebAppInfo(url=f"{config.webapp_url}?month={month}")
        )])
    return InlineKeyboardMarkup(inline_keyboard=rows)


def history_keyboard(transactions: Sequence[dict[str, Any]], offset: int, has_more: bool) -> InlineKeyboardMarkup:
    builder = InlineKeyboardBuilder()
    for index, tx in enumerate(transactions, start=1):
        builder.button(text=f"🗑 {index}", callback_data=f"del:{tx['id']}")
    builder.adjust(5)
    nav = []
    if offset:
        nav.append(InlineKeyboardButton(text="⬅️ Новіші", callback_data=f"hist:{max(0, offset - 10)}"))
    if has_more:
        nav.append(InlineKeyboardButton(text="Старіші ➡️", callback_data=f"hist:{offset + 10}"))
    if nav:
        builder.row(*nav)
    return builder.as_markup()


def settings_keyboard() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="💱 Валюта", callback_data="set:currency"),
         InlineKeyboardButton(text="🏷 Категорії", callback_data="set:categories")],
        [InlineKeyboardButton(text="🎯 Ліміти", callback_data="set:budgets"),
         InlineKeyboardButton(text="📤 Експорт CSV", callback_data="set:export")],
        [InlineKeyboardButton(text="❓ Як користуватись", callback_data="set:help")],
    ])


def currency_keyboard() -> InlineKeyboardMarkup:
    builder = InlineKeyboardBuilder()
    for code in ("UAH", "USD", "EUR", "PLN", "GBP"):
        builder.button(text=code, callback_data=f"cur:{code}")
    builder.adjust(3)
    builder.row(InlineKeyboardButton(text="⬅️ Назад", callback_data="set:back"))
    return builder.as_markup()


def back_keyboard() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[[InlineKeyboardButton(text="⬅️ Назад", callback_data="set:back")]])
