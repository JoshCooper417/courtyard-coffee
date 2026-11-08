"""Deterministic SQLite database reset and seed script for Courtyard Coffee."""
from pathlib import Path
import sys

ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from api.db import get_db_path, init_db


def main():
    db_path = get_db_path()
    state = init_db(db_path=db_path, reset=True)
    print(
        f"Seeded Courtyard Coffee SQLite DB at {db_path} "
        f"(nextOrderNumber={state['nextOrderNumber']}, "
        f"menuItems={len(state['menuItems'])}, "
        f"globalTags={len(state['globalTags'])}, "
        f"photoAlbum={len(state['photoAlbum'])})"
    )


if __name__ == "__main__":
    main()
