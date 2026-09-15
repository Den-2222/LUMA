"""Гроші зберігаємо цілими числами в копійках/центах — без float-похибок."""
from __future__ import annotations

import re
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP

CURRENCY_SIGNS = {"UAH": "₴", "USD": "$", "EUR": "€", "PLN": "zł", "GBP": "£"}

_AMOUNT_RE = re.compile(r"^\d{1,3}(?:[  ]\d{3})*(?:[.,]\d{1,2})?$|^\d+(?:[.,]\d{1,2})?$")


def parse_amount(text: str) -> int | None:
    """'1 250,50' -> 125050. Повертає None, якщо це не сума."""
    cleaned = text.strip().replace(" ", " ")
    if not cleaned or not _AMOUNT_RE.match(cleaned):
        return None
    try:
        value = Decimal(cleaned.replace(" ", "").replace(",", "."))
    except InvalidOperation:
        return None
    if value <= 0 or value > Decimal("100000000"):
        return None
    minor = (value * 100).quantize(Decimal("1"), rounding=ROUND_HALF_UP)
    return int(minor)


def format_amount(minor: int, currency: str = "UAH", *, sign: str = "") -> str:
    """125050 -> '1 250,50 ₴'. sign: '' | '+' | '-'."""
    value = Decimal(minor) / 100
    whole, frac = divmod(abs(int(minor)), 100)
    grouped = f"{whole:,}".replace(",", " ")
    body = grouped if frac == 0 else f"{grouped},{frac:02d}"
    prefix = sign if sign else ("-" if value < 0 else "")
    return f"{prefix}{body} {CURRENCY_SIGNS.get(currency, currency)}"
