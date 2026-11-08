import base64
import os
import struct
import tempfile
import unittest
from pathlib import Path
from urllib.parse import parse_qs, urlparse

from api.db import create_order, get_store_state, init_db, save_store_state
from api.utils import build_hebrew_whatsapp_url, format_wa_phone, generate_qr_data_url

ROOT_DIR = Path(__file__).resolve().parent.parent


class TestMilestone1Utils(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.db_path = os.path.join(self.temp_dir.name, "test_data.db")
        init_db(db_path=self.db_path, reset=True)

    def tearDown(self):
        self.temp_dir.cleanup()

    def test_sqlite_seed_state_invariants(self):
        store = get_store_state(db_path=self.db_path)
        self.assertIs(store.get("isOpen"), True)
        self.assertEqual(store.get("closedNoteHe"), "סגור כעת, נשוב בקרוב")
        self.assertEqual(store.get("bitPhone"), "050-0000000")
        self.assertEqual(store.get("adminPin"), "1234")
        self.assertEqual(store.get("nextOrderNumber"), 101)

        photos = store.get("photoAlbum", [])
        self.assertEqual(len(photos), 2)
        photo_ids = {p.get("id") for p in photos}
        self.assertEqual(photo_ids, {"photo-cappuccino", "photo-croissant"})
        for photo in photos:
            data_url = photo.get("dataUrl", "")
            self.assertTrue(data_url.startswith("data:image/png;base64,"))
            raw = base64.b64decode(data_url.split(",", 1)[1])
            self.assertEqual(raw[:8], b"\x89PNG\r\n\x1a\n")
            width, height = struct.unpack(">II", raw[16:24])
            self.assertEqual((width, height), (400, 400))

        tags = store.get("globalTags", [])
        self.assertEqual(len(tags), 3)
        tags_by_id = {t["id"]: t for t in tags}
        self.assertTrue(tags_by_id["tag-oat"]["inStock"])
        self.assertTrue(tags_by_id["tag-decaf"]["inStock"])
        self.assertFalse(tags_by_id["tag-syrup"]["inStock"])

        items = store.get("menuItems", [])
        self.assertEqual(len(items), 2)
        item_ids = {i["id"] for i in items}
        self.assertEqual(item_ids, {"item-cappuccino", "item-croissant"})

    def test_monotonic_next_order_number_protection(self):
        order = create_order(
            {
                "customerName": "דני",
                "items": [
                    {
                        "itemId": "item-cappuccino",
                        "qty": 1,
                        "selectedTagIds": ["tag-oat"],
                    }
                ],
            },
            db_path=self.db_path,
        )
        self.assertEqual(order.get("orderNumber"), 101)
        self.assertEqual(order.get("totalNis"), 16)

        after_order_store = get_store_state(db_path=self.db_path)
        self.assertEqual(after_order_store.get("nextOrderNumber"), 102)

        # Simulate stale admin client saving nextOrderNumber=101
        stale_payload = dict(after_order_store)
        stale_payload["nextOrderNumber"] = 101
        stale_payload["closedNoteHe"] = "נחזור ב-14:00"
        updated_store = save_store_state(stale_payload, db_path=self.db_path)
        self.assertEqual(updated_store.get("nextOrderNumber"), 102)
        self.assertEqual(updated_store.get("closedNoteHe"), "נחזור ב-14:00")

    def test_whatsapp_phone_and_hebrew_url_builder(self):
        self.assertEqual(format_wa_phone("054-9876543"), "972549876543")
        self.assertEqual(format_wa_phone("+972 50-000-0000"), "972500000000")

        url = build_hebrew_whatsapp_url(
            "054-9876543",
            {
                "orderNumber": 101,
                "customerName": "נועה",
                "totalNis": 16,
                "items": [
                    {
                        "titleHe": "קפוצ׳ינו",
                        "qty": 1,
                        "selectedTags": ["חלב שיבולת שועל"],
                    }
                ],
            },
        )
        self.assertTrue(url.startswith("https://wa.me/972549876543?text="))
        parsed = urlparse(url)
        text = parse_qs(parsed.query).get("text", [""])[0]
        self.assertIn("101", text)
        self.assertIn("נועה", text)
        self.assertIn("קפוצ׳ינו", text)
        self.assertIn("חלב שיבולת שועל", text)
        self.assertIn("16", text)

    def test_qr_data_url_is_valid_240x240_png(self):
        data_url = generate_qr_data_url("050-0000000")
        self.assertTrue(data_url.startswith("data:image/png;base64,"))
        raw = base64.b64decode(data_url.split(",", 1)[1])
        self.assertEqual(raw[:8], b"\x89PNG\r\n\x1a\n")
        self.assertEqual(raw[12:16], b"IHDR")
        width, height = struct.unpack(">II", raw[16:24])
        self.assertEqual((width, height), (240, 240))

    def test_js_utility_modules_contract(self):
        wa_js = (ROOT_DIR / "src" / "utils" / "wa.js").read_text(encoding="utf-8")
        self.assertIn("https://wa.me/", wa_js)
        self.assertIn("encodeURIComponent", wa_js)
        self.assertIn("972", wa_js)

        qr_js = (ROOT_DIR / "src" / "utils" / "qr.js").read_text(encoding="utf-8")
        self.assertIn("data:image/png;base64,", qr_js)
        self.assertIn("IHDR", qr_js)
        self.assertIn("240", qr_js)


if __name__ == "__main__":
    unittest.main()
