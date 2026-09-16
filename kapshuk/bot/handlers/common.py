"""Старт, довідка, налаштування."""
from __future__ import annotations

from aiogram import F, Router
from aiogram.filters import Command, CommandStart
from aiogram.fsm.context import FSMContext
from aiogram.types import CallbackQuery, Message

from app import repo
from bot import keyboards as kb
from bot import texts, views
from bot.views import esc



router = Router(name="common")


@router.message(CommandStart())
async def cmd_start(message: Message, state: FSMContext, db_user: dict) -> None:
    await state.clear()
    name = esc(message.from_user.first_name or "друже")
    await message.answer(texts.WELCOME.format(name=name), reply_markup=kb.main_menu())


@router.message(Command("help"))
@router.message(F.text == texts.BTN_SETTINGS)
async def cmd_settings(message: Message, state: FSMContext, db_user: dict) -> None:
    await state.clear()
    await message.answer(
        f"⚙️ <b>Налаштування</b>\n\nВалюта: <b>{db_user['currency']}</b>",
        reply_markup=kb.settings_keyboard(),
    )


@router.callback_query(F.data == "set:back")
async def cb_back(callback: CallbackQuery, db_user: dict) -> None:
    await callback.message.edit_text(
        f"⚙️ <b>Налаштування</b>\n\nВалюта: <b>{db_user['currency']}</b>",
        reply_markup=kb.settings_keyboard(),
    )
    await callback.answer()


@router.callback_query(F.data == "set:help")
async def cb_help(callback: CallbackQuery) -> None:
    await callback.message.edit_text(texts.HELP, reply_markup=kb.back_keyboard())
    await callback.answer()


@router.callback_query(F.data == "set:currency")
async def cb_currency(callback: CallbackQuery) -> None:
    await callback.message.edit_text(
        "💱 <b>Валюта</b>\n\nОбери, в чому вести облік.\n"
        "<i>Уже збережені записи лишаються у своїй валюті.</i>",
        reply_markup=kb.currency_keyboard(),
    )
    await callback.answer()


@router.callback_query(F.data.startswith("cur:"))
async def cb_set_currency(callback: CallbackQuery, db_user: dict) -> None:
    currency = callback.data.split(":")[1]
    await repo.set_currency(db_user["id"], currency)
    await callback.message.edit_text(
        f"✅ Валюта: <b>{currency}</b>", reply_markup=kb.back_keyboard()
    )
    await callback.answer("Збережено")


@router.callback_query(F.data == "set:categories")
async def cb_categories(callback: CallbackQuery, db_user: dict) -> None:
    expense = await repo.list_categories(db_user["id"], "expense")
    income = await repo.list_categories(db_user["id"], "income")
    text = (
        "🏷 <b>Категорії</b>\n\n"
        "<b>Витрати:</b> " + " ".join(f"{c['emoji']}{esc(c['name'])}" for c in expense) + "\n\n"
        "<b>Доходи:</b> " + " ".join(f"{c['emoji']}{esc(c['name'])}" for c in income) + "\n\n"
        "Додати свою: <code>категорія Спорт</code>\n"
        "Для доходу: <code>категорія+ Оренда</code>"
    )
    await callback.message.edit_text(text, reply_markup=kb.back_keyboard())
    await callback.answer()


@router.callback_query(F.data == "set:budgets")
async def cb_budgets(callback: CallbackQuery, db_user: dict) -> None:
    budgets = await repo.list_budgets(db_user["id"])
    await callback.message.edit_text(
        views.render_budgets(budgets, db_user["currency"]), reply_markup=kb.back_keyboard()
    )
    await callback.answer()


@router.callback_query(F.data == "cancel")
async def cb_cancel(callback: CallbackQuery, state: FSMContext) -> None:
    await state.clear()
    await callback.message.edit_text("Скасовано.")
    await callback.answer()
