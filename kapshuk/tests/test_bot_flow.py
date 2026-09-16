"""Проганяє справжні апдейти через диспетчер із підробленою сесією Telegram.

Запуск: python -m tests.test_bot_flow
"""
from __future__ import annotations

import asyncio
import os
import sys
from datetime import datetime
from pathlib import Path
from typing import Any

SCRATCH = Path(os.getenv("TEST_DB", "/tmp/finbot-test.db"))
os.environ["DB_PATH"] = str(SCRATCH)
os.environ["BOT_TOKEN"] = "42:TEST"
os.environ.setdefault("ALLOWED_USERS", "")

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from aiogram import Bot, Dispatcher  # noqa: E402
from aiogram.client.default import DefaultBotProperties  # noqa: E402
from aiogram.client.session.base import BaseSession  # noqa: E402
from aiogram.enums import ParseMode  # noqa: E402
from aiogram.methods import TelegramMethod  # noqa: E402
from aiogram.types import Chat, Message, Update, User  # noqa: E402
from aiogram.types import CallbackQuery  # noqa: E402

from app.db import init_db  # noqa: E402
from bot.handlers import build_router  # noqa: E402
from bot.middlewares import AccessMiddleware  # noqa: E402

USER = User(id=777, is_bot=False, first_name="Den", username="den")
CHAT = Chat(id=777, type="private")


class MockSession(BaseSession):
    """Замість мережі — записуємо виклики й повертаємо правдоподібні відповіді."""

    def __init__(self) -> None:
        super().__init__()
        self.calls: list[tuple[str, dict[str, Any]]] = []
        self._message_id = 100

    async def close(self) -> None:  # pragma: no cover
        pass

    async def stream_content(self, *args, **kwargs):  # pragma: no cover
        yield b""

    async def make_request(self, bot: Bot, method: TelegramMethod, timeout: int | None = None) -> Any:
        name = type(method).__name__
        payload = method.model_dump(exclude_none=True)
        self.calls.append((name, payload))
        if name in {"SendMessage", "EditMessageText", "SendDocument"}:
            self._message_id += 1
            return Message(
                message_id=self._message_id,
                date=datetime.now(),
                chat=CHAT,
                from_user=USER,
                text=payload.get("text", payload.get("caption", "")),
            )
        return True

    def last(self, name: str) -> dict[str, Any]:
        for call_name, payload in reversed(self.calls):
            if call_name == name:
                return payload
        raise AssertionError(f"не було виклику {name}; були: {[c for c, _ in self.calls]}")

    def texts(self) -> str:
        return "\n".join(
            payload.get("text", "") for name, payload in self.calls if name in {"SendMessage", "EditMessageText"}
        )


def make_message(text: str, message_id: int = 1) -> Update:
    return Update(
        update_id=message_id,
        message=Message(message_id=message_id, date=datetime.now(), chat=CHAT, from_user=USER, text=text),
    )


def make_callback(data: str, update_id: int = 900) -> Update:
    return Update(
        update_id=update_id,
        callback_query=CallbackQuery(
            id=str(update_id),
            from_user=USER,
            chat_instance="test",
            data=data,
            message=Message(message_id=101, date=datetime.now(), chat=CHAT, from_user=USER, text="…"),
        ),
    )


def check(condition: bool, label: str) -> None:
    print(f"  {'✅' if condition else '❌'} {label}")
    if not condition:
        raise SystemExit(f"провалено: {label}")


async def main() -> None:
    if SCRATCH.exists():
        SCRATCH.unlink()
    await init_db()

    session = MockSession()
    bot = Bot(token="42:TEST", session=session, default=DefaultBotProperties(parse_mode=ParseMode.HTML))
    dispatcher = Dispatcher()
    dispatcher.message.middleware(AccessMiddleware())
    dispatcher.callback_query.middleware(AccessMiddleware())
    dispatcher.include_router(build_router())

    async def feed(update: Update) -> None:
        await dispatcher.feed_update(bot, update)

    print("\n1. /start")
    await feed(make_message("/start"))
    check("Привіт" in session.last("SendMessage")["text"], "вітання надіслано")
    check(len(session.last("SendMessage")["reply_markup"]["keyboard"]) == 3, "меню з 3 рядів кнопок")

    print("\n2. швидкий ввід «250 продукти»")
    await feed(make_message("250 продукти"))
    text = session.last("SendMessage")["text"]
    check("250" in text and "Продукти" in text, "витрату збережено з вгаданою категорією")

    print("\n3. дохід «+45000 зарплата»")
    await feed(make_message("+45000 зарплата"))
    check("45" in session.last("SendMessage")["text"], "дохід збережено")

    print("\n4. сума без категорії питає категорію")
    await feed(make_message("180"))
    markup = session.last("SendMessage")["reply_markup"]
    check("inline_keyboard" in markup, "показано сітку категорій")
    from app import repo
    categories = await repo.list_categories(777, "expense")
    await feed(make_callback(f"cat:{categories[1]['id']}"))
    saved = await repo.list_transactions(777, limit=1)
    check(saved and saved[0]["amount"] == 18000 and saved[0]["category_id"] == categories[1]["id"],
          "після вибору категорії запис збережено з нею")

    print("\n5. кнопка «Витрата» → сума → категорія")
    await feed(make_message("➖ Витрата"))
    check("суму" in session.last("SendMessage")["text"], "бот попросив суму")
    await feed(make_callback("amt:expense:20000"))
    check("200" in session.last("EditMessageText")["text"], "швидка сума підхопилась")
    await feed(make_callback(f"cat:{categories[0]['id']}"))

    print("\n6. статистика")
    await feed(make_message("📊 Статистика"))
    stats_text = session.last("SendMessage")["text"]
    check("Доходи" in stats_text and "Витрати" in stats_text, "підсумок місяця показано")
    check("█" in stats_text, "намальовано смужки по категоріях")

    print("\n7. ліміт")
    await feed(make_message("ліміт продукти 500"))
    check("Ліміт" in session.last("SendMessage")["text"], "ліміт встановлено")
    await feed(make_message("300 продукти"))
    check("ліміт" in session.last("SendMessage")["text"].lower(), "бот попередив про ліміт")

    print("\n8. історія + видалення")
    await feed(make_message("📜 Останні"))
    history_text = session.last("SendMessage")["text"]
    check("Останні записи" in history_text, "історію показано")
    transactions = await repo.list_transactions(777, limit=1)
    await feed(make_callback(f"del:{transactions[0]['id']}"))
    check("Видалено" in session.last("EditMessageText")["text"], "запис видалено")
    check(not await repo.get_transaction(777, transactions[0]["id"]), "запису більше немає в БД")

    print("\n9. нова категорія")
    await feed(make_message("категорія Спорт"))
    check("Спорт" in session.last("SendMessage")["text"], "категорію створено")
    check(any(c["name"] == "Спорт" for c in await repo.list_categories(777, "expense")), "категорія в БД")

    print("\n10. експорт CSV")
    await feed(make_message("/export"))
    check(session.last("SendDocument")["document"].filename.endswith(".csv"), "CSV-файл надіслано")

    print("\n11. сміття без суми")
    await feed(make_message("привіт як справи"))
    check("Не знайшов суму" in session.last("SendMessage")["text"], "зрозуміла підказка замість помилки")

    print("\n12. чужий користувач без доступу")
    import app.config as config_module
    object.__setattr__(config_module.config, "allowed_users", {12345})
    stranger = Update(
        update_id=999,
        message=Message(
            message_id=999, date=datetime.now(), chat=Chat(id=555, type="private"),
            from_user=User(id=555, is_bot=False, first_name="Хтось"), text="/start",
        ),
    )
    await feed(stranger)
    check("приватний" in session.last("SendMessage")["text"], "стороннього не пустило")
    check(not await repo.get_transaction(555, 1), "дані стороннього не створено")

    await bot.session.close()
    print(f"\nУсього викликів Telegram API: {len(session.calls)}")
    print("Усі перевірки пройдено ✅")


if __name__ == "__main__":
    asyncio.run(main())
