"""Додавання записів: кнопками і швидким текстом."""
from __future__ import annotations

import re

from aiogram import F, Router
from aiogram.fsm.context import FSMContext
from aiogram.types import CallbackQuery, Message

from app import repo
from app.money import format_amount, parse_amount
from app.parser import match_category, parse_entry
from bot import keyboards as kb
from bot import texts, views
from bot.views import esc

from bot.states import Entry

router = Router(name="entry")

_BUDGET_RE = re.compile(r"^лім[иі]т\s+(.+?)\s+(\d[\d\s.,]*)$", re.IGNORECASE)
_CATEGORY_RE = re.compile(r"^категор[іи]я(\+?)\s+(.+)$", re.IGNORECASE)


async def _finish(message: Message, user: dict, kind: str, amount: int, category_id: int | None, note: str) -> None:
    """Зберігає запис і показує підтвердження з підсумком місяця."""
    tx = await repo.add_transaction(user["id"], kind, amount, category_id, note)
    data = await repo.summary(user["id"])
    text = views.render_saved(tx, data)
    warning = await _budget_warning(user, tx)
    await message.answer(text + warning, reply_markup=kb.saved_keyboard(tx["id"]))


async def _budget_warning(user: dict, tx: dict) -> str:
    """Попередження, якщо ліміт категорії майже вичерпано."""
    if tx["kind"] != "expense" or not tx["category_id"]:
        return ""
    budgets = {b["category_id"]: b for b in await repo.list_budgets(user["id"])}
    budget = budgets.get(tx["category_id"])
    if not budget:
        return ""
    share = budget["spent"] / budget["amount"] if budget["amount"] else 0
    if share >= 1:
        return (
            f"\n\n🔴 Ліміт «{esc(budget['name'])}» перевищено: "
            f"{format_amount(budget['spent'], user['currency'])} з {format_amount(budget['amount'], user['currency'])}"
        )
    if share >= 0.8:
        left = budget["amount"] - budget["spent"]
        return f"\n\n🟡 До ліміту «{esc(budget['name'])}» лишилось {format_amount(left, user['currency'])}"
    return ""


# ------------------------------------------------- ввід через кнопки

@router.message(F.text.in_({texts.BTN_EXPENSE, texts.BTN_INCOME}))
async def start_entry(message: Message, state: FSMContext, db_user: dict) -> None:
    kind = "income" if message.text == texts.BTN_INCOME else "expense"
    await state.set_state(Entry.amount)
    await state.update_data(kind=kind)
    recent = await repo.recent_amounts(db_user["id"], kind)
    await message.answer(
        f"{texts.KIND_EMOJI[kind]} Введи суму або обери зі списку:",
        reply_markup=kb.amount_keyboard(kind, recent, db_user["currency"]),
    )


@router.callback_query(Entry.amount, F.data.startswith("amt:"))
async def pick_amount(callback: CallbackQuery, state: FSMContext, db_user: dict) -> None:
    _, kind, raw = callback.data.split(":")
    await _ask_category(callback.message, state, db_user, kind, int(raw), edit=True)
    await callback.answer()


@router.message(Entry.amount, F.text)
async def typed_amount(message: Message, state: FSMContext, db_user: dict) -> None:
    data = await state.get_data()
    kind = data.get("kind", "expense")
    categories = await repo.list_categories(db_user["id"], kind)
    parsed = parse_entry(message.text, categories)
    if parsed is None:
        await message.answer("Це не схоже на суму. Спробуй ще раз, напр. <code>250</code>")
        return
    if parsed.category_id:  # людина одразу написала «250 продукти» — не питаємо категорію
        await state.clear()
        await _finish(message, db_user, kind, parsed.amount, parsed.category_id, parsed.note)
        return
    await _ask_category(message, state, db_user, kind, parsed.amount, note=parsed.note)


async def _ask_category(
    message: Message, state: FSMContext, user: dict, kind: str, amount: int, note: str = "", edit: bool = False
) -> None:
    await state.set_state(Entry.category)
    await state.update_data(kind=kind, amount=amount, note=note)
    categories = await repo.list_categories(user["id"], kind)
    title = texts.KIND_TITLE[kind]
    text = f"{texts.KIND_EMOJI[kind]} <b>{format_amount(amount, user['currency'])}</b>\nОбери категорію ({title}):"
    if edit:
        await message.edit_text(text, reply_markup=kb.categories_keyboard(categories, "cat"))
    else:
        await message.answer(text, reply_markup=kb.categories_keyboard(categories, "cat"))


@router.callback_query(Entry.category, F.data.startswith("cat:"))
async def pick_category(callback: CallbackQuery, state: FSMContext, db_user: dict) -> None:
    category_id = int(callback.data.split(":")[1]) or None
    data = await state.get_data()
    await state.clear()
    await callback.message.delete()
    await _finish(callback.message, db_user, data["kind"], data["amount"], category_id, data.get("note", ""))
    await callback.answer("Збережено")


# ------------------------------------------------- зміна / видалення

@router.callback_query(F.data.startswith("recat:"))
async def change_category(callback: CallbackQuery, db_user: dict) -> None:
    tx_id = int(callback.data.split(":")[1])
    tx = await repo.get_transaction(db_user["id"], tx_id)
    if not tx:
        await callback.answer("Запис не знайдено", show_alert=True)
        return
    categories = await repo.list_categories(db_user["id"], tx["kind"])
    await callback.message.edit_reply_markup(reply_markup=kb.categories_keyboard(categories, f"setcat:{tx_id}"))
    await callback.answer()


@router.callback_query(F.data.startswith("setcat:"))
async def apply_category(callback: CallbackQuery, db_user: dict) -> None:
    _, raw_tx, raw_cat = callback.data.split(":")
    tx = await repo.get_transaction(db_user["id"], int(raw_tx))
    if not tx:
        await callback.answer("Запис не знайдено", show_alert=True)
        return
    await repo.delete_transaction(db_user["id"], tx["id"])
    new_tx = await repo.add_transaction(
        db_user["id"], tx["kind"], tx["amount"], int(raw_cat) or None, tx["note"], tx["occurred_at"]
    )
    data = await repo.summary(db_user["id"])
    await callback.message.edit_text(views.render_saved(new_tx, data), reply_markup=kb.saved_keyboard(new_tx["id"]))
    await callback.answer("Категорію змінено")


@router.callback_query(F.data.startswith("del:"))
async def delete_tx(callback: CallbackQuery, db_user: dict) -> None:
    tx_id = int(callback.data.split(":")[1])
    tx = await repo.get_transaction(db_user["id"], tx_id)
    if not tx or not await repo.delete_transaction(db_user["id"], tx_id):
        await callback.answer("Запис уже видалено", show_alert=True)
        return
    await callback.message.edit_text(
        f"🗑 Видалено: {tx['category_emoji'] or '❔'} {esc(tx['category_name'] or 'Без категорії')} — "
        f"{format_amount(tx['amount'], tx['currency'])}"
    )
    await callback.answer("Видалено")


# ------------------------------------------------- команди текстом

@router.message(F.text.regexp(_BUDGET_RE))
async def set_budget(message: Message, db_user: dict) -> None:
    name, raw_amount = _BUDGET_RE.match(message.text).groups()
    categories = await repo.list_categories(db_user["id"], "expense")
    category = match_category(name, categories)
    if not category:
        await message.answer(f"Не знайшов категорію «{esc(name)}». Подивись список у ⚙️ Ще → 🏷 Категорії.")
        return
    if raw_amount.strip().strip("0., ") == "":
        await repo.delete_budget(db_user["id"], category["id"])
        await message.answer(f"🎯 Ліміт для {category['emoji']} {esc(category['name'])} прибрано.")
        return
    amount = parse_amount(raw_amount)
    if amount is None:
        await message.answer("Не зрозумів суму ліміту. Напр.: <code>ліміт продукти 8000</code>")
        return
    await repo.set_budget(db_user["id"], category["id"], amount)
    budgets = await repo.list_budgets(db_user["id"])
    await message.answer(views.render_budgets(budgets, db_user["currency"]))


@router.message(F.text.regexp(_CATEGORY_RE))
async def create_category(message: Message, db_user: dict) -> None:
    plus, name = _CATEGORY_RE.match(message.text).groups()
    kind = "income" if plus else "expense"
    created = await repo.add_category(db_user["id"], kind, name)
    if not created:
        await message.answer("Така категорія вже є.")
        return
    await message.answer(
        f"✅ Категорію {created['emoji']} <b>{esc(created['name'])}</b> додано "
        f"({'доходи' if kind == 'income' else 'витрати'})."
    )


@router.message(F.text & ~F.text.startswith("/"))
async def quick_entry(message: Message, state: FSMContext, db_user: dict) -> None:
    """Вільний текст: «250 продукти», «таксі 180», «+45000 зарплата»."""
    if message.text in texts.MAIN_BUTTONS:
        return
    categories = await repo.list_categories(db_user["id"])
    parsed = parse_entry(message.text, categories)
    if parsed is None:
        await message.answer(
            "Не знайшов суму 🤔\n\nНапиши, наприклад:\n"
            "<code>250 продукти</code>\n<code>таксі 180</code>\n<code>+45000 зарплата</code>",
            reply_markup=kb.main_menu(),
        )
        return
    await state.clear()
    if parsed.category_id is None:
        await _ask_category(message, state, db_user, parsed.kind, parsed.amount, parsed.note)
        return
    await _finish(message, db_user, parsed.kind, parsed.amount, parsed.category_id, parsed.note)
