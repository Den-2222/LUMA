"""Статистика, історія, експорт."""
from __future__ import annotations

import csv
import io

from aiogram import F, Router
from aiogram.filters import Command
from aiogram.fsm.context import FSMContext
from aiogram.types import BufferedInputFile, CallbackQuery, Message

from app import repo
from app.dates import current_month, shift_month
from bot import keyboards as kb
from bot import texts, views

router = Router(name="stats")
PAGE = 10


@router.message(Command("stats"))
@router.message(F.text == texts.BTN_STATS)
async def show_stats(message: Message, state: FSMContext, db_user: dict) -> None:
    await state.clear()
    month = current_month()
    data = await repo.summary(db_user["id"], month)
    await message.answer(views.render_summary(data), reply_markup=kb.stats_keyboard(month))


@router.callback_query(F.data.startswith("stats:"))
async def nav_stats(callback: CallbackQuery, db_user: dict) -> None:
    _, month, delta = callback.data.split(":")
    month = shift_month(month, int(delta))
    data = await repo.summary(db_user["id"], month)
    text = views.render_summary(data)
    if text != callback.message.html_text:
        await callback.message.edit_text(text, reply_markup=kb.stats_keyboard(month))
    await callback.answer()


@router.message(Command("history"))
@router.message(F.text == texts.BTN_HISTORY)
async def show_history(message: Message, state: FSMContext, db_user: dict) -> None:
    await state.clear()
    await _render_history(message, db_user, offset=0)


@router.callback_query(F.data.startswith("hist:"))
async def nav_history(callback: CallbackQuery, db_user: dict) -> None:
    offset = int(callback.data.split(":")[1])
    await _render_history(callback.message, db_user, offset, edit=True)
    await callback.answer()


async def _render_history(message: Message, user: dict, offset: int, edit: bool = False) -> None:
    transactions = await repo.list_transactions(user["id"], limit=PAGE + 1, offset=offset)
    has_more = len(transactions) > PAGE
    transactions = transactions[:PAGE]
    text = views.render_history(transactions)
    markup = kb.history_keyboard(transactions, offset, has_more)
    if edit:
        await message.edit_text(text, reply_markup=markup)
    else:
        await message.answer(text, reply_markup=markup)


@router.message(Command("export"))
async def cmd_export(message: Message, db_user: dict) -> None:
    await _send_export(message, db_user)


@router.callback_query(F.data == "set:export")
async def cb_export(callback: CallbackQuery, db_user: dict) -> None:
    await _send_export(callback.message, db_user)
    await callback.answer()


async def _send_export(message: Message, user: dict) -> None:
    transactions = await repo.list_transactions(user["id"], limit=200)
    if not transactions:
        await message.answer("Поки нема чого експортувати.")
        return
    buffer = io.StringIO()
    writer = csv.writer(buffer, delimiter=";")
    writer.writerow(["Дата", "Тип", "Категорія", "Сума", "Валюта", "Нотатка"])
    for tx in transactions:
        writer.writerow([
            tx["occurred_at"],
            "дохід" if tx["kind"] == "income" else "витрата",
            tx["category_name"] or "Без категорії",
            f"{tx['amount'] / 100:.2f}".replace(".", ","),
            tx["currency"],
            tx["note"],
        ])
    payload = buffer.getvalue().encode("utf-8-sig")  # BOM, щоб Excel не ламав кирилицю
    await message.answer_document(
        BufferedInputFile(payload, filename=f"kapshuk-{current_month()}.csv"),
        caption=f"📤 Експортовано записів: {len(transactions)}",
    )
