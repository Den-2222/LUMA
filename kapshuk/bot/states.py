from aiogram.fsm.state import State, StatesGroup


class Entry(StatesGroup):
    """Ввід через кнопки: спочатку сума, потім категорія."""

    amount = State()
    category = State()
