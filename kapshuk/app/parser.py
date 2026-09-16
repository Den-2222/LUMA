"""Розбір швидкого вводу: «250 продукти», «таксі 180», «+45000 зарплата»."""
from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any, Sequence

from app.money import parse_amount

_NUMBER_RE = re.compile(r"(?<![\w.,])(\d{1,3}(?:[  ]\d{3})+|\d+)(?:[.,](\d{1,2}))?(?![\w])")
_INCOME_HINTS = {"дохід", "доход", "прихід", "заробив", "отримав", "зарплата", "зп"}


@dataclass
class ParsedEntry:
    kind: str
    amount: int
    note: str
    category_id: int | None = None
    category_name: str | None = None


def match_category(text: str, categories: Sequence[dict[str, Any]]) -> dict[str, Any] | None:
    """Шукає категорію за назвою або ключовими словами в тексті."""
    low = text.casefold().strip()
    if not low:
        return None
    words = {word.strip(".,!?;:") for word in low.split()}
    best: tuple[int, dict[str, Any]] | None = None
    for category in categories:
        name = category["name"].casefold()
        candidates = {name} | {
            keyword.strip() for keyword in category.get("keywords", "").casefold().split(",") if keyword.strip()
        }
        for candidate in candidates:
            if not candidate:
                continue
            score = 0
            if candidate in words:
                score = 100 + len(candidate)
            elif len(candidate) >= 4 and candidate in low:
                score = 50 + len(candidate)
            elif len(candidate) >= 5 and any(
                word.startswith(candidate[:4]) and len(word) >= 4 for word in words
            ):
                score = 20
            if score and (best is None or score > best[0]):
                best = (score, category)
    return best[1] if best else None


def parse_entry(text: str, categories: Sequence[dict[str, Any]] = ()) -> ParsedEntry | None:
    """Повертає розібраний запис або None, якщо суму знайти не вдалося."""
    raw = text.strip()
    if not raw:
        return None

    kind = "expense"
    if raw.startswith("+"):
        kind, raw = "income", raw[1:].strip()
    elif raw.startswith("-"):
        raw = raw[1:].strip()

    match = _NUMBER_RE.search(raw)
    if not match:
        return None
    amount = parse_amount(match.group(0).replace(" ", " "))
    if amount is None:
        return None

    note = (raw[: match.start()] + " " + raw[match.end():]).strip(" .,-–—")
    note = re.sub(r"\s+", " ", note)

    if kind == "expense" and _INCOME_HINTS & {w.strip(".,!?").casefold() for w in note.split()}:
        kind = "income"

    pool = [c for c in categories if c["kind"] == kind]
    category = match_category(note, pool) if note else None
    return ParsedEntry(
        kind=kind,
        amount=amount,
        note=note,
        category_id=category["id"] if category else None,
        category_name=category["name"] if category else None,
    )
