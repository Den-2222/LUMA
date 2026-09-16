"""Дати рахуємо в часовому поясі користувача, а не сервера."""
from __future__ import annotations

import os
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

TZ = ZoneInfo(os.getenv("TZ_NAME", "Europe/Kyiv"))

MONTHS_UA = [
    "січень", "лютий", "березень", "квітень", "травень", "червень",
    "липень", "серпень", "вересень", "жовтень", "листопад", "грудень",
]
WEEKDAYS_UA = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Нд"]


def today() -> date:
    return datetime.now(TZ).date()


def current_month() -> str:
    return today().strftime("%Y-%m")


def month_bounds(month: str) -> tuple[str, str]:
    """'2026-09' -> ('2026-09-01', '2026-09-30') включно."""
    year, mon = (int(part) for part in month.split("-"))
    first = date(year, mon, 1)
    last = date(year + (mon == 12), (mon % 12) + 1, 1) - timedelta(days=1)
    return first.isoformat(), last.isoformat()


def shift_month(month: str, delta: int) -> str:
    year, mon = (int(part) for part in month.split("-"))
    index = year * 12 + (mon - 1) + delta
    return f"{index // 12:04d}-{index % 12 + 1:02d}"


def month_title(month: str) -> str:
    year, mon = (int(part) for part in month.split("-"))
    name = MONTHS_UA[mon - 1]
    return f"{name.capitalize()} {year}" if year != today().year else name.capitalize()


def human_day(value: str) -> str:
    """'2026-09-15' -> 'сьогодні' / 'вчора' / '15 вересня'."""
    day = date.fromisoformat(value)
    diff = (today() - day).days
    if diff == 0:
        return "сьогодні"
    if diff == 1:
        return "вчора"
    genitive = {
        "січень": "січня", "лютий": "лютого", "березень": "березня", "квітень": "квітня",
        "травень": "травня", "червень": "червня", "липень": "липня", "серпень": "серпня",
        "вересень": "вересня", "жовтень": "жовтня", "листопад": "листопада", "грудень": "грудня",
    }[MONTHS_UA[day.month - 1]]
    return f"{day.day} {genitive}"
