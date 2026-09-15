"""Бекап бази. Запуск: python -m app.backup [куди]

sqlite3.backup() коректно знімає копію на живій базі — на відміну від cp,
який може зловити базу в момент запису.
"""
from __future__ import annotations

import sqlite3
import sys
from datetime import date
from pathlib import Path

from app.config import config

KEEP = 14


def main() -> None:
    source_path = config.db_path
    if not source_path.exists():
        raise SystemExit(f"Бази немає: {source_path}")

    target_dir = Path(sys.argv[1]) if len(sys.argv) > 1 else source_path.parent / "backups"
    target_dir.mkdir(parents=True, exist_ok=True)
    target = target_dir / f"finance-{date.today().isoformat()}.db"

    source = sqlite3.connect(source_path)
    destination = sqlite3.connect(target)
    try:
        source.backup(destination)
    finally:
        destination.close()
        source.close()

    old = sorted(target_dir.glob("finance-*.db"))[:-KEEP]
    for path in old:
        path.unlink()

    print(f"✅ {target} ({target.stat().st_size // 1024} КБ), видалено старих: {len(old)}")


if __name__ == "__main__":
    main()
