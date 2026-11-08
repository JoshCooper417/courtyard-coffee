"""SQLite repository stubs for Courtyard Coffee (Milestone 1 RED)."""

def get_db_path(custom_path=None):
    return custom_path or "./db/data.db"

def init_db(db_path=None, reset=False):
    return {}

def get_store_state(db_path=None):
    return {}

def save_store_state(payload, db_path=None):
    return {}

def create_order(payload, db_path=None):
    return {}

def list_orders(status=None, db_path=None):
    return []

def update_order_status(order_id, status, db_path=None):
    return None

def reset_orders(db_path=None):
    return {"ok": False}
