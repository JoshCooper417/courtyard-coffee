"""SQLite repository and deterministic seed state for Courtyard Coffee."""
from __future__ import annotations

import json
import os
import sqlite3
import uuid
from datetime import datetime, timezone
from pathlib import Path

from api.utils import generate_art_png_data_url

ROOT_DIR = Path(__file__).resolve().parent.parent


def _load_env_defaults() -> dict[str, str]:
    env_file = ROOT_DIR / ".env.local"
    defaults = {
        "DB_PATH": str(ROOT_DIR / "db" / "data.db"),
        "DEFAULT_ADMIN_PIN": "1234",
        "DEFAULT_BIT_PHONE": "050-0000000",
    }
    if env_file.exists():
        for raw_line in env_file.read_text(encoding="utf-8").splitlines():
            line = raw_line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            k, v = k.strip(), v.strip()
            if k == "DB_PATH" and not os.path.isabs(v):
                defaults[k] = str((ROOT_DIR / v).resolve())
            else:
                defaults[k] = v
    return defaults


def get_db_path(custom_path: str | None = None) -> str:
    if custom_path:
        return custom_path
    env_override = os.environ.get("DB_PATH")
    if env_override:
        if not os.path.isabs(env_override):
            return str((ROOT_DIR / env_override).resolve())
        return env_override
    return _load_env_defaults()["DB_PATH"]


def build_initial_seed_state() -> dict:
    env_defaults = _load_env_defaults()
    cap_url = generate_art_png_data_url("cappuccino", 400, 400)
    cro_url = generate_art_png_data_url("croissant", 400, 400)
    return {
        "isOpen": True,
        "closedNoteHe": "סגור כעת, נשוב בקרוב",
        "closedMessageHe": "סגור כעת, נשוב בקרוב",
        "bitPhone": env_defaults.get("DEFAULT_BIT_PHONE", "050-0000000"),
        "adminPin": env_defaults.get("DEFAULT_ADMIN_PIN", "1234"),
        "nextOrderNumber": 101,
        "photoAlbum": [
            {
                "id": "photo-cappuccino",
                "label": "Cappuccino",
                "name": "Cappuccino",
                "url": cap_url,
                "dataUrl": cap_url,
            },
            {
                "id": "photo-croissant",
                "label": "Butter Croissant",
                "name": "Butter Croissant",
                "url": cro_url,
                "dataUrl": cro_url,
            },
        ],
        "globalTags": [
            {
                "id": "tag-oat",
                "nameHe": "חלב שיבולת שועל",
                "labelHe": "חלב שיבולת שועל",
                "nameEn": "Oat Milk",
                "labelEn": "Oat Milk",
                "price": 2,
                "priceDelta": 2,
                "inStock": True,
            },
            {
                "id": "tag-decaf",
                "nameHe": "נטול קפאין",
                "labelHe": "נטול קפאין",
                "nameEn": "Decaf",
                "labelEn": "Decaf",
                "price": 0,
                "priceDelta": 0,
                "inStock": True,
            },
            {
                "id": "tag-syrup",
                "nameHe": "סירופ וניל",
                "labelHe": "סירופ וניל",
                "nameEn": "Vanilla Syrup",
                "labelEn": "Vanilla Syrup",
                "price": 3,
                "priceDelta": 3,
                "inStock": False,
            },
        ],
        "menuItems": [
            {
                "id": "item-cappuccino",
                "category": "Coffee",
                "nameHe": "קפוצ׳ינו",
                "titleHe": "קפוצ׳ינו",
                "nameEn": "Cappuccino",
                "titleEn": "Cappuccino",
                "descHe": "אספרסו כפול עם חלב מוקצף עשיר",
                "price": 14,
                "inStock": True,
                "photo": cap_url,
                "imageUrl": cap_url,
                "photoUrl": cap_url,
                "photoId": "photo-cappuccino",
                "tagIds": ["tag-oat", "tag-decaf", "tag-syrup"],
            },
            {
                "id": "item-croissant",
                "category": "Pastry",
                "nameHe": "קרואסון חמאה",
                "titleHe": "קרואסון חמאה",
                "nameEn": "Butter Croissant",
                "titleEn": "Butter Croissant",
                "descHe": "מאפה צרפתי פריך שנאפה במקום",
                "price": 12,
                "inStock": True,
                "photo": cro_url,
                "imageUrl": cro_url,
                "photoUrl": cro_url,
                "photoId": "photo-croissant",
                "tagIds": [],
            },
        ],
    }


def _connect(db_path: str | None = None) -> sqlite3.Connection:
    resolved = get_db_path(db_path)
    os.makedirs(os.path.dirname(os.path.abspath(resolved)), exist_ok=True)
    conn = sqlite3.connect(resolved, timeout=10.0, isolation_level=None)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute("PRAGMA busy_timeout=5000;")
    return conn


def init_db(db_path: str | None = None, reset: bool = False) -> dict:
    conn = _connect(db_path)
    try:
        conn.execute("BEGIN IMMEDIATE;")
        if reset:
            conn.execute("DROP TABLE IF EXISTS orders;")
            conn.execute("DROP TABLE IF EXISTS store_state;")
        else:
            # Ensure orders table has the canonical schema (`number`, `isNotified`, `isDone`)
            cols = [
                r["name"]
                for r in conn.execute("PRAGMA table_info(orders);").fetchall()
            ]
            if cols and "number" not in cols:
                conn.execute("DROP TABLE IF EXISTS orders;")

        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS store_state (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                data TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS orders (
                id TEXT PRIMARY KEY,
                number INTEGER NOT NULL,
                customerName TEXT NOT NULL,
                customerPhone TEXT NOT NULL,
                createdAt TEXT NOT NULL,
                total REAL NOT NULL,
                isNotified INTEGER NOT NULL DEFAULT 0,
                isDone INTEGER NOT NULL DEFAULT 0,
                items TEXT NOT NULL
            );
            """
        )
        now_iso = datetime.now(timezone.utc).isoformat()
        row = conn.execute("SELECT data FROM store_state WHERE id = 1;").fetchone()
        if row is None:
            seed_state = build_initial_seed_state()
            conn.execute(
                "INSERT INTO store_state (id, data, updated_at) VALUES (1, ?, ?);",
                (json.dumps(seed_state, ensure_ascii=False), now_iso),
            )
            conn.execute("COMMIT;")
            return seed_state
        conn.execute("COMMIT;")
        return json.loads(row["data"])
    except Exception:
        conn.execute("ROLLBACK;")
        raise
    finally:
        conn.close()


def get_store_state(db_path: str | None = None) -> dict:
    conn = _connect(db_path)
    try:
        row = conn.execute("SELECT data FROM store_state WHERE id = 1;").fetchone()
        if row is None:
            conn.close()
            return init_db(db_path=db_path, reset=False)
        return json.loads(row["data"])
    except sqlite3.OperationalError:
        conn.close()
        return init_db(db_path=db_path, reset=False)
    finally:
        try:
            conn.close()
        except Exception:
            pass


def save_store_state(
    payload: dict,
    db_path: str | None = None,
    allow_counter_reset: bool = False,
) -> dict:
    init_db(db_path=db_path, reset=False)
    conn = _connect(db_path)
    try:
        conn.execute("BEGIN IMMEDIATE;")
        row = conn.execute("SELECT data FROM store_state WHERE id = 1;").fetchone()
        current = json.loads(row["data"]) if row else build_initial_seed_state()

        merged = dict(current)
        for key in (
            "isOpen",
            "closedNoteHe",
            "closedMessageHe",
            "bitPhone",
            "adminPin",
            "photoAlbum",
            "globalTags",
            "menuItems",
        ):
            if key in payload:
                merged[key] = payload[key]

        # Keep closedNoteHe and closedMessageHe synchronized
        old_note = current.get("closedNoteHe") or current.get("closedMessageHe") or "סגור כעת, נשוב בקרוב"
        if "closedNoteHe" in payload and "closedMessageHe" in payload:
            if payload["closedNoteHe"] != old_note:
                resolved_note = payload["closedNoteHe"]
            elif payload["closedMessageHe"] != old_note:
                resolved_note = payload["closedMessageHe"]
            else:
                resolved_note = payload["closedNoteHe"]
            merged["closedNoteHe"] = resolved_note
            merged["closedMessageHe"] = resolved_note
        elif "closedNoteHe" in payload:
            merged["closedNoteHe"] = payload["closedNoteHe"]
            merged["closedMessageHe"] = payload["closedNoteHe"]
        elif "closedMessageHe" in payload:
            merged["closedNoteHe"] = payload["closedMessageHe"]
            merged["closedMessageHe"] = payload["closedMessageHe"]

        merged["isOpen"] = bool(merged.get("isOpen", True))

        # Normalize photoAlbum entries (sync label/name and url/dataUrl)
        raw_photos = merged.get("photoAlbum")
        if isinstance(raw_photos, list):
            normalized_photos = []
            for idx, p in enumerate(raw_photos):
                if not isinstance(p, dict):
                    continue
                pid = str(p.get("id") or f"photo-{idx + 1}").strip()
                label = str(p.get("label") or p.get("name") or "Photo").strip()
                url = str(p.get("url") or p.get("dataUrl") or "").strip()
                p_norm = dict(p)
                p_norm["id"] = pid
                p_norm["label"] = label
                p_norm["name"] = label
                p_norm["url"] = url
                p_norm["dataUrl"] = url
                normalized_photos.append(p_norm)
            merged["photoAlbum"] = normalized_photos

        photos_by_id = {p["id"]: p for p in merged.get("photoAlbum", []) if isinstance(p, dict) and p.get("id")}
        photos_by_url = {p["url"]: p for p in merged.get("photoAlbum", []) if isinstance(p, dict) and p.get("url")}
        photos_by_label = {p["label"]: p for p in merged.get("photoAlbum", []) if isinstance(p, dict) and p.get("label")}

        # Normalize globalTags entries (sync nameEn/labelEn, nameHe/labelHe, price/priceDelta, inStock)
        old_tags_by_id = {
            t["id"]: t for t in current.get("globalTags", []) if isinstance(t, dict) and t.get("id")
        }
        raw_tags = merged.get("globalTags")
        if isinstance(raw_tags, list):
            normalized_tags = []
            for idx, t in enumerate(raw_tags):
                if not isinstance(t, dict):
                    continue
                tid = str(t.get("id") or f"tag-{idx + 1}").strip()
                old_t = old_tags_by_id.get(tid, {})

                old_en = old_t.get("nameEn") or old_t.get("labelEn") or ""
                if "nameEn" in t and t["nameEn"] != old_en:
                    name_en = str(t["nameEn"])
                elif "labelEn" in t and t["labelEn"] != old_en:
                    name_en = str(t["labelEn"])
                else:
                    name_en = str(t.get("nameEn") or t.get("labelEn") or "")

                old_he = old_t.get("nameHe") or old_t.get("labelHe") or ""
                if "nameHe" in t and t["nameHe"] != old_he:
                    name_he = str(t["nameHe"])
                elif "labelHe" in t and t["labelHe"] != old_he:
                    name_he = str(t["labelHe"])
                else:
                    name_he = str(t.get("nameHe") or t.get("labelHe") or "")

                raw_price = t.get("price") if "price" in t else t.get("priceDelta", 0)
                try:
                    p_float = float(raw_price or 0)
                except (TypeError, ValueError):
                    p_float = 0.0
                price_val = int(p_float) if p_float.is_integer() else p_float

                t_norm = dict(t)
                t_norm["id"] = tid
                t_norm["nameEn"] = name_en
                t_norm["labelEn"] = name_en
                t_norm["nameHe"] = name_he
                t_norm["labelHe"] = name_he
                t_norm["price"] = price_val
                t_norm["priceDelta"] = price_val
                t_norm["inStock"] = bool(t.get("inStock", True))
                normalized_tags.append(t_norm)
            merged["globalTags"] = normalized_tags

        # Normalize menuItems entries (sync nameEn/titleEn, nameHe/titleHe, photo/imageUrl/photoUrl/photoId)
        old_items_by_id = {
            i["id"]: i for i in current.get("menuItems", []) if isinstance(i, dict) and i.get("id")
        }
        raw_items = merged.get("menuItems")
        if isinstance(raw_items, list):
            normalized_items = []
            for idx, item in enumerate(raw_items):
                if not isinstance(item, dict):
                    continue
                iid = str(item.get("id") or f"item-{idx + 1}").strip()
                old_i = old_items_by_id.get(iid, {})

                old_en = old_i.get("nameEn") or old_i.get("titleEn") or ""
                if "nameEn" in item and item["nameEn"] != old_en:
                    name_en = str(item["nameEn"])
                elif "titleEn" in item and item["titleEn"] != old_en:
                    name_en = str(item["titleEn"])
                else:
                    name_en = str(item.get("nameEn") or item.get("titleEn") or "")

                old_he = old_i.get("nameHe") or old_i.get("titleHe") or ""
                if "nameHe" in item and item["nameHe"] != old_he:
                    name_he = str(item["nameHe"])
                elif "titleHe" in item and item["titleHe"] != old_he:
                    name_he = str(item["titleHe"])
                else:
                    name_he = str(item.get("nameHe") or item.get("titleHe") or "")

                try:
                    p_float = float(item.get("price", 0) or 0)
                except (TypeError, ValueError):
                    p_float = 0.0
                price_val = int(p_float) if p_float.is_integer() else p_float

                raw_photo_id = str(item.get("photoId") or "").strip()
                raw_photo = str(
                    item.get("photo") or item.get("imageUrl") or item.get("photoUrl") or ""
                ).strip()
                old_photo = str(old_i.get("photo") or "").strip()

                if raw_photo and raw_photo != old_photo and raw_photo in photos_by_url:
                    matched_photo = photos_by_url[raw_photo]
                    resolved_photo_id = matched_photo["id"]
                    resolved_photo_url = matched_photo["url"]
                elif raw_photo_id and raw_photo_id in photos_by_id:
                    matched_photo = photos_by_id[raw_photo_id]
                    resolved_photo_id = matched_photo["id"]
                    resolved_photo_url = matched_photo["url"]
                elif raw_photo and raw_photo in photos_by_url:
                    matched_photo = photos_by_url[raw_photo]
                    resolved_photo_id = matched_photo["id"]
                    resolved_photo_url = matched_photo["url"]
                elif raw_photo and raw_photo in photos_by_id:
                    matched_photo = photos_by_id[raw_photo]
                    resolved_photo_id = matched_photo["id"]
                    resolved_photo_url = matched_photo["url"]
                elif raw_photo_id and raw_photo_id in photos_by_label:
                    matched_photo = photos_by_label[raw_photo_id]
                    resolved_photo_id = matched_photo["id"]
                    resolved_photo_url = matched_photo["url"]
                elif raw_photo and raw_photo in photos_by_label:
                    matched_photo = photos_by_label[raw_photo]
                    resolved_photo_id = matched_photo["id"]
                    resolved_photo_url = matched_photo["url"]
                else:
                    resolved_photo_id = raw_photo_id
                    resolved_photo_url = raw_photo

                raw_tag_ids = item.get("tagIds")
                tag_ids = [str(tid) for tid in raw_tag_ids] if isinstance(raw_tag_ids, list) else []

                i_norm = dict(item)
                i_norm["id"] = iid
                i_norm["category"] = str(item.get("category") or "Coffee")
                i_norm["nameEn"] = name_en
                i_norm["titleEn"] = name_en
                i_norm["nameHe"] = name_he
                i_norm["titleHe"] = name_he
                i_norm["descHe"] = str(item.get("descHe") or "")
                i_norm["price"] = price_val
                i_norm["inStock"] = bool(item.get("inStock", True))
                i_norm["photo"] = resolved_photo_url
                i_norm["imageUrl"] = resolved_photo_url
                i_norm["photoUrl"] = resolved_photo_url
                i_norm["photoId"] = resolved_photo_id
                i_norm["tagIds"] = tag_ids
                normalized_items.append(i_norm)
            merged["menuItems"] = normalized_items

        current_next = int(current.get("nextOrderNumber", 101))
        incoming_next = int(payload.get("nextOrderNumber", current_next))
        max_order_row = conn.execute(
            "SELECT COALESCE(MAX(number), 100) AS max_num FROM orders;"
        ).fetchone()
        min_valid_next = int(max_order_row["max_num"]) + 1 if max_order_row else 101

        if allow_counter_reset:
            merged["nextOrderNumber"] = incoming_next
        else:
            merged["nextOrderNumber"] = max(current_next, min_valid_next, incoming_next)

        now_iso = datetime.now(timezone.utc).isoformat()
        conn.execute(
            "UPDATE store_state SET data = ?, updated_at = ? WHERE id = 1;",
            (json.dumps(merged, ensure_ascii=False), now_iso),
        )
        conn.execute("COMMIT;")
        return merged
    except Exception:
        conn.execute("ROLLBACK;")
        raise
    finally:
        conn.close()


def create_order(payload: dict, db_path: str | None = None) -> dict:
    init_db(db_path=db_path, reset=False)
    customer_name = str(payload.get("customerName") or "").strip()
    if not customer_name:
        raise ValueError("Customer name is required")
    customer_phone = str(payload.get("customerPhone") or "").strip()
    raw_items = payload.get("items") or []
    if not isinstance(raw_items, list) or len(raw_items) == 0:
        raise ValueError("At least one order item is required")

    conn = _connect(db_path)
    try:
        conn.execute("BEGIN IMMEDIATE;")
        row = conn.execute("SELECT data FROM store_state WHERE id = 1;").fetchone()
        store = json.loads(row["data"])
        if not store.get("isOpen", True):
            raise ValueError("Store is currently closed")

        menu_by_id = {m["id"]: m for m in store.get("menuItems", [])}
        tags_by_id = {t["id"]: t for t in store.get("globalTags", [])}

        enriched_items = []
        total_nis = 0

        for entry in raw_items:
            qty = max(1, int(entry.get("qty", 1)))
            item_id = entry.get("itemId") or entry.get("id")
            menu_item = menu_by_id.get(item_id)
            note = str(entry.get("note") or "").strip()

            if menu_item:
                if not menu_item.get("inStock", True):
                    raise ValueError(f"Item {item_id} is out of stock")
                base_price = int(menu_item.get("price", 0))
                name_he = menu_item.get("nameHe") or menu_item.get("titleHe") or ""
                name_en = menu_item.get("nameEn") or menu_item.get("titleEn") or ""
                allowed_tag_ids = set(menu_item.get("tagIds", []))
            else:
                base_price = int(entry.get("unitPrice") or entry.get("price") or 0)
                name_he = entry.get("nameHe") or entry.get("titleHe") or ""
                name_en = entry.get("nameEn") or entry.get("titleEn") or ""
                allowed_tag_ids = set(tags_by_id.keys())

            selected_tag_ids = entry.get("selectedTagIds") or []
            selected_tags = []
            tag_delta_sum = 0
            for tid in selected_tag_ids:
                tag_obj = tags_by_id.get(tid)
                if tag_obj and tag_obj.get("inStock", True) and (not menu_item or tid in allowed_tag_ids):
                    delta = int(tag_obj.get("price", tag_obj.get("priceDelta", 0)))
                    tag_delta_sum += delta
                    t_he = tag_obj.get("nameHe") or tag_obj.get("labelHe") or ""
                    t_en = tag_obj.get("nameEn") or tag_obj.get("labelEn") or ""
                    selected_tags.append(
                        {
                            "id": tag_obj["id"],
                            "nameHe": t_he,
                            "labelHe": t_he,
                            "nameEn": t_en,
                            "labelEn": t_en,
                            "price": delta,
                            "priceDelta": delta,
                        }
                    )

            if not selected_tags and entry.get("selectedTags"):
                for raw_t in entry["selectedTags"]:
                    if isinstance(raw_t, dict):
                        delta = int(raw_t.get("price", raw_t.get("priceDelta", 0)))
                        tag_delta_sum += delta
                        selected_tags.append(raw_t)
                    else:
                        selected_tags.append(
                            {
                                "id": str(raw_t),
                                "nameHe": str(raw_t),
                                "labelHe": str(raw_t),
                                "nameEn": str(raw_t),
                                "labelEn": str(raw_t),
                                "price": 0,
                                "priceDelta": 0,
                            }
                        )

            tags_he = entry.get("tagsHe") or [
                t.get("nameHe") or t.get("labelHe") for t in selected_tags
            ]
            tags_en = entry.get("tagsEn") or [
                t.get("nameEn") or t.get("labelEn") for t in selected_tags
            ]

            unit_price = base_price + tag_delta_sum
            line_total = unit_price * qty
            total_nis += line_total

            enriched_items.append(
                {
                    "itemId": item_id or "",
                    "nameHe": name_he,
                    "titleHe": name_he,
                    "nameEn": name_en,
                    "titleEn": name_en,
                    "qty": qty,
                    "unitPrice": unit_price,
                    "lineTotal": line_total,
                    "tagsHe": tags_he,
                    "tagsEn": tags_en,
                    "selectedTagIds": [t["id"] for t in selected_tags],
                    "selectedTags": selected_tags,
                    "note": note,
                }
            )

        order_number = int(store.get("nextOrderNumber", 101))
        store["nextOrderNumber"] = order_number + 1
        now_iso = datetime.now(timezone.utc).isoformat()
        order_id = f"ord-{order_number}-{uuid.uuid4().hex[:6]}"

        conn.execute(
            """
            INSERT INTO orders (id, number, customerName, customerPhone, createdAt, total, isNotified, isDone, items)
            VALUES (?, ?, ?, ?, ?, ?, 0, 0, ?);
            """,
            (
                order_id,
                order_number,
                customer_name,
                customer_phone,
                now_iso,
                float(total_nis),
                json.dumps(enriched_items, ensure_ascii=False),
            ),
        )
        conn.execute(
            "UPDATE store_state SET data = ?, updated_at = ? WHERE id = 1;",
            (json.dumps(store, ensure_ascii=False), now_iso),
        )
        conn.execute("COMMIT;")

        return {
            "id": order_id,
            "number": order_number,
            "orderNumber": order_number,
            "customerName": customer_name,
            "customerPhone": customer_phone,
            "items": enriched_items,
            "total": total_nis,
            "totalNis": total_nis,
            "isNotified": False,
            "isDone": False,
            "status": "pending",
            "createdAt": now_iso,
            "completedAt": None,
        }
    except Exception:
        conn.execute("ROLLBACK;")
        raise
    finally:
        conn.close()


def _row_to_order(row: sqlite3.Row) -> dict:
    is_notified = bool(row["isNotified"])
    is_done = bool(row["isDone"])
    total_val = int(row["total"]) if float(row["total"]).is_integer() else float(row["total"])
    return {
        "id": row["id"],
        "number": row["number"],
        "orderNumber": row["number"],
        "customerName": row["customerName"],
        "customerPhone": row["customerPhone"],
        "items": json.loads(row["items"]),
        "total": total_val,
        "totalNis": total_val,
        "isNotified": is_notified,
        "isDone": is_done,
        "status": "done" if is_done else "pending",
        "createdAt": row["createdAt"],
        "completedAt": row["createdAt"] if is_done else None,
    }


def list_orders(status: str | None = None, db_path: str | None = None) -> list[dict]:
    init_db(db_path=db_path, reset=False)
    conn = _connect(db_path)
    try:
        if status == "pending":
            rows = conn.execute(
                "SELECT * FROM orders WHERE isDone = 0 ORDER BY number ASC, createdAt ASC;"
            ).fetchall()
        elif status == "done":
            rows = conn.execute(
                "SELECT * FROM orders WHERE isDone = 1 ORDER BY number ASC, createdAt ASC;"
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT * FROM orders ORDER BY number ASC, createdAt ASC;"
            ).fetchall()
        return [_row_to_order(r) for r in rows]
    finally:
        conn.close()


def update_order_status(
    order_id: str, patch: dict | str, db_path: str | None = None
) -> dict | None:
    init_db(db_path=db_path, reset=False)
    conn = _connect(db_path)
    try:
        conn.execute("BEGIN IMMEDIATE;")
        existing = conn.execute("SELECT * FROM orders WHERE id = ?;", (order_id,)).fetchone()
        if existing is None:
            conn.execute("COMMIT;")
            return None

        is_notified = int(existing["isNotified"])
        is_done = int(existing["isDone"])

        if isinstance(patch, str):
            if patch not in ("pending", "done"):
                raise ValueError("Invalid status")
            is_done = 1 if patch == "done" else 0
        elif isinstance(patch, dict):
            if "isNotified" in patch:
                is_notified = 1 if patch["isNotified"] else 0
            if "isDone" in patch:
                is_done = 1 if patch["isDone"] else 0
            if "status" in patch:
                if patch["status"] not in ("pending", "done"):
                    raise ValueError("Invalid status")
                is_done = 1 if patch["status"] == "done" else 0

        conn.execute(
            "UPDATE orders SET isNotified = ?, isDone = ? WHERE id = ?;",
            (is_notified, is_done, order_id),
        )
        row = conn.execute("SELECT * FROM orders WHERE id = ?;", (order_id,)).fetchone()
        conn.execute("COMMIT;")
        return _row_to_order(row) if row else None
    except Exception:
        conn.execute("ROLLBACK;")
        raise
    finally:
        conn.close()


def reset_orders(db_path: str | None = None) -> dict:
    init_db(db_path=db_path, reset=False)
    conn = _connect(db_path)
    try:
        conn.execute("BEGIN IMMEDIATE;")
        conn.execute("DELETE FROM orders;")
        row = conn.execute("SELECT data FROM store_state WHERE id = 1;").fetchone()
        store = json.loads(row["data"]) if row else build_initial_seed_state()
        store["nextOrderNumber"] = 101
        now_iso = datetime.now(timezone.utc).isoformat()
        conn.execute(
            "UPDATE store_state SET data = ?, updated_at = ? WHERE id = 1;",
            (json.dumps(store, ensure_ascii=False), now_iso),
        )
        conn.execute("COMMIT;")
        return {"ok": True, "nextOrderNumber": 101}
    except Exception:
        conn.execute("ROLLBACK;")
        raise
    finally:
        conn.close()
