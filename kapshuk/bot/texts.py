"""Кнопки головного меню і спільні тексти — в одному місці, щоб не розповзались."""
from __future__ import annotations

BTN_EXPENSE = "➖ Витрата"
BTN_INCOME = "➕ Дохід"
BTN_STATS = "📊 Статистика"
BTN_HISTORY = "📜 Останні"
BTN_APP = "📱 Застосунок"
BTN_SETTINGS = "⚙️ Ще"

MAIN_BUTTONS = {BTN_EXPENSE, BTN_INCOME, BTN_STATS, BTN_HISTORY, BTN_APP, BTN_SETTINGS}

KIND_TITLE = {"expense": "витрату", "income": "дохід"}
KIND_EMOJI = {"expense": "➖", "income": "➕"}

WELCOME = (
    "👋 <b>Привіт, {name}!</b>\n\n"
    "Це <b>Капшук</b> — твій облік грошей. Найшвидший спосіб додати запис — просто написати суму й опис:\n"
    "<code>250 продукти</code>   <code>таксі 180</code>   <code>+45000 зарплата</code>\n\n"
    "Категорію підберу сам. Або тисни кнопки внизу 👇"
)

HELP = (
    "<b>Як користуватись Капшуком</b>\n\n"
    "<b>Швидкий ввід текстом:</b>\n"
    "• <code>250 продукти</code> — витрата 250\n"
    "• <code>таксі 180</code> — порядок слів не важливий\n"
    "• <code>+45000 зарплата</code> — плюс спереду = дохід\n"
    "• <code>1 250,50 оренда</code> — копійки через кому\n\n"
    "<b>Кнопки:</b>\n"
    f"• {BTN_EXPENSE} / {BTN_INCOME} — ввід у два тапи\n"
    f"• {BTN_STATS} — підсумок місяця й топ категорій\n"
    f"• {BTN_HISTORY} — останні записи, можна видаляти\n"
    f"• {BTN_SETTINGS} — валюта, категорії, ліміти, експорт\n\n"
    "<b>Команди:</b> /start, /stats, /history, /export, /help"
)

NOT_ALLOWED = (
    "🔒 Капшук приватний.\n\nТвій ID: <code>{user_id}</code>\n"
    "Попроси власника додати його у список доступу."
)
