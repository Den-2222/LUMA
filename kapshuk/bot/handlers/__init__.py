from aiogram import Router

from bot.handlers import common, entry, stats


def build_router() -> Router:
    """Порядок важливий: вільний текст ловиться останнім."""
    router = Router(name="root")
    router.include_router(common.router)
    router.include_router(stats.router)
    router.include_router(entry.router)
    return router
