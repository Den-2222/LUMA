"""Запуск бота: python -m bot"""
from __future__ import annotations

import asyncio
import logging

from aiogram import Bot, Dispatcher
from aiogram.client.default import DefaultBotProperties
from aiogram.enums import ParseMode
from aiogram.types import BotCommand, MenuButtonWebApp, WebAppInfo

from app.config import config
from app.db import init_db
from bot.handlers import build_router
from bot.middlewares import AccessMiddleware

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger("finbot")

COMMANDS = [
    BotCommand(command="start", description="Головне меню"),
    BotCommand(command="stats", description="Статистика за місяць"),
    BotCommand(command="history", description="Останні записи"),
    BotCommand(command="export", description="Експорт у CSV"),
    BotCommand(command="help", description="Як користуватись"),
]


async def main() -> None:
    if not config.bot_token:
        raise SystemExit("BOT_TOKEN не заданий. Скопіюй .env.example у .env і встав токен від @BotFather.")

    await init_db()

    bot = Bot(token=config.bot_token, default=DefaultBotProperties(parse_mode=ParseMode.HTML))
    dispatcher = Dispatcher()
    dispatcher.message.middleware(AccessMiddleware())
    dispatcher.callback_query.middleware(AccessMiddleware())
    dispatcher.include_router(build_router())

    await bot.set_my_commands(COMMANDS)
    if config.webapp_url:
        await bot.set_chat_menu_button(
            menu_button=MenuButtonWebApp(text="Застосунок", web_app=WebAppInfo(url=config.webapp_url))
        )
        logger.info("Mini App: %s", config.webapp_url)
    else:
        logger.warning("WEBAPP_URL не заданий — працює тільки бот (кнопки й текст).")

    me = await bot.get_me()
    logger.info("Бот @%s запущено. Доступ: %s", me.username, config.allowed_users or "всі")
    await bot.delete_webhook(drop_pending_updates=True)
    try:
        await dispatcher.start_polling(bot)
    finally:
        await bot.session.close()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except (KeyboardInterrupt, SystemExit) as exc:
        logger.info("Зупинено: %s", exc or "Ctrl+C")
