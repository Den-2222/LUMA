"""Доступ тільки для своїх + автостворення користувача в БД."""
from __future__ import annotations

from typing import Any, Awaitable, Callable

from aiogram import BaseMiddleware
from aiogram.types import CallbackQuery, Message, TelegramObject, User

from app import repo
from app.config import config
from bot import texts


class AccessMiddleware(BaseMiddleware):
    async def __call__(
        self,
        handler: Callable[[TelegramObject, dict[str, Any]], Awaitable[Any]],
        event: TelegramObject,
        data: dict[str, Any],
    ) -> Any:
        user: User | None = data.get("event_from_user")
        if user is None or user.is_bot:
            return None

        if not config.is_allowed(user.id):
            text = texts.NOT_ALLOWED.format(user_id=user.id)
            if isinstance(event, Message):
                await event.answer(text)
            elif isinstance(event, CallbackQuery):
                await event.answer("Немає доступу", show_alert=True)
            return None

        data["db_user"] = await repo.ensure_user(user.id, user.username, user.first_name)
        return await handler(event, data)
