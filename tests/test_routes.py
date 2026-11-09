import io
import json
import os
import sqlite3
import tempfile
import unittest
from pathlib import Path

from api.db import init_db
from api.handler import CourtyardRequestHandler

ROOT_DIR = Path(__file__).resolve().parent.parent


class _InMemorySocket:
    def __init__(self, request_bytes: bytes):
        self._rfile = io.BytesIO(request_bytes)
        self._wfile = io.BytesIO()

    def makefile(self, mode: str, *args, **kwargs):
        if "r" in mode:
            return self._rfile
        return self._wfile

    def sendall(self, data: bytes):
        self._wfile.write(data)

    def close(self):
        pass


class _DummyServer:
    server_name = "127.0.0.1"
    server_port = 3000


class TestMilestone1And2Routes(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.db_path = os.path.join(self.temp_dir.name, "routes_test.db")
        init_db(db_path=self.db_path, reset=True)

    def tearDown(self):
        self.temp_dir.cleanup()

    def _raw_http_request(self, method: str, path: str, payload=None, extra_headers=None):
        body_bytes = b""
        headers = ["Host: 127.0.0.1:3000", "Connection: close"]
        if extra_headers:
            for k, v in extra_headers.items():
                headers.append(f"{k}: {v}")
        if payload is not None:
            body_bytes = json.dumps(payload).encode("utf-8")
            headers.append("Content-Type: application/json")
            headers.append(f"Content-Length: {len(body_bytes)}")
        request_head = f"{method} {path} HTTP/1.1\r\n" + "\r\n".join(headers) + "\r\n\r\n"
        sock = _InMemorySocket(request_head.encode("utf-8") + body_bytes)

        class BoundHandler(CourtyardRequestHandler):
            pass

        BoundHandler.db_path = self.db_path
        BoundHandler(sock, ("127.0.0.1", 55555), _DummyServer())
        raw_response = sock._wfile.getvalue()
        head_bytes, _, resp_body = raw_response.partition(b"\r\n\r\n")
        status_line = head_bytes.splitlines()[0].decode("iso-8859-1")
        status_code = int(status_line.split(" ")[1])
        return status_code, resp_body.decode("utf-8", errors="replace")

    def _request_json(self, method: str, path: str, payload=None, extra_headers=None):
        status, text = self._raw_http_request(
            method, path, payload=payload, extra_headers=extra_headers
        )
        data = json.loads(text) if text.strip() else {}
        return status, data

    def _request_text(self, path: str):
        return self._raw_http_request("GET", path)

    def test_get_and_put_api_store(self):
        status, store = self._request_json("GET", "/api/store")
        self.assertEqual(status, 200)
        self.assertEqual(store["nextOrderNumber"], 101)
        self.assertEqual(store["adminPin"], "1234")
        self.assertIs(store["isOpen"], True)

        store["isOpen"] = False
        store["closedNoteHe"] = "נחזור בקרוב מאוד"
        status_put, updated = self._request_json("PUT", "/api/store", store)
        self.assertEqual(status_put, 200)
        self.assertIs(updated["isOpen"], False)
        self.assertEqual(updated["closedNoteHe"], "נחזור בקרוב מאוד")

    def test_post_and_manage_orders_lifecycle(self):
        status, created = self._request_json(
            "POST",
            "/api/order",
            {
                "customerName": "יוסי",
                "customerPhone": "054-9876543",
                "items": [
                    {
                        "itemId": "item-cappuccino",
                        "qty": 2,
                        "selectedTagIds": ["tag-oat"],
                    }
                ],
            },
        )
        self.assertEqual(status, 201)
        self.assertEqual(created["number"], 101)
        self.assertEqual(created["orderNumber"], 101)
        self.assertEqual(created["total"], 32)
        self.assertEqual(created["totalNis"], 32)
        self.assertIs(created["isNotified"], False)
        self.assertIs(created["isDone"], False)

        status_list, orders = self._request_json("GET", "/api/orders?status=pending")
        self.assertEqual(status_list, 200)
        self.assertEqual(len(orders), 1)
        self.assertEqual(orders[0]["id"], created["id"])

        status_notify, notified = self._request_json(
            "PATCH",
            f"/api/orders/{created['id']}",
            {"isNotified": True},
        )
        self.assertEqual(status_notify, 200)
        self.assertIs(notified["isNotified"], True)

        status_patch, patched = self._request_json(
            "PATCH",
            f"/api/orders/{created['id']}",
            {"isDone": True, "status": "done"},
        )
        self.assertEqual(status_patch, 200)
        self.assertIs(patched["isDone"], True)
        self.assertEqual(patched["status"], "done")

        status_reset, reset_res = self._request_json("POST", "/api/orders/reset", {})
        self.assertEqual(status_reset, 200)
        self.assertTrue(reset_res.get("ok"))

        _, store_after = self._request_json("GET", "/api/store")
        self.assertEqual(store_after["nextOrderNumber"], 101)

    def test_spa_routes_and_frontend_contracts(self):
        for route in ["/", "/admin/kds", "/admin/menu"]:
            status, html = self._request_text(route)
            self.assertEqual(status, 200)
            self.assertIn('<script type="module" src="/src/main.js"></script>', html)

        css = (ROOT_DIR / "src" / "index.css").read_text(encoding="utf-8")
        self.assertIn("--bg-courtyard: #FAF6F0", css)
        self.assertIn("--color-sage: #3F624D", css)
        self.assertIn("--color-terracotta: #C86D51", css)
        self.assertIn("--text-espresso: #261C18", css)

        customer_js = (ROOT_DIR / "src" / "routes" / "Customer.js").read_text(encoding="utf-8")
        self.assertIn('dir="rtl"', customer_js)

        pin_modal_js = (ROOT_DIR / "src" / "components" / "PinGateModal.js").read_text(encoding="utf-8")
        self.assertIn("adminPin", pin_modal_js)
        self.assertIn("localStorage", pin_modal_js)

    def test_cuj02_tag_bottom_sheet_and_note_persistence(self):
        tag_sheet_js = (ROOT_DIR / "src" / "components" / "TagBottomSheet.js").read_text(encoding="utf-8")
        self.assertIn('data-testid="tag-bottom-sheet"', tag_sheet_js)
        self.assertIn("tag-pill-", tag_sheet_js)
        self.assertIn("(אזל)", tag_sheet_js)
        self.assertIn('data-testid="item-note-input"', tag_sheet_js)
        self.assertIn('data-testid="confirm-customization-btn"', tag_sheet_js)

    def test_cuj03_checkout_order_101_and_static_receipt_qr(self):
        status, created = self._request_json(
            "POST",
            "/api/order",
            {
                "customerName": "דניאל",
                "customerPhone": "054-9876543",
                "items": [
                    {
                        "itemId": "item-croissant",
                        "qty": 2,
                        "selectedTagIds": [],
                        "note": "",
                    },
                    {
                        "itemId": "item-cappuccino",
                        "qty": 1,
                        "selectedTagIds": ["tag-oat"],
                        "note": "חם מאוד",
                    },
                ],
            },
        )
        self.assertEqual(status, 201)
        self.assertEqual(created["number"], 101)
        self.assertEqual(created["total"], 40)

        conn = sqlite3.connect(self.db_path)
        try:
            row = conn.execute(
                "SELECT id, number, customerName, customerPhone, total, items FROM orders WHERE number = 101;"
            ).fetchone()
            self.assertIsNotNone(row)
            self.assertEqual(row[1], 101)
            self.assertEqual(row[2], "דניאל")
            self.assertEqual(row[3], "054-9876543")
            self.assertEqual(float(row[4]), 40.0)
            items_list = json.loads(row[5])
            self.assertEqual(len(items_list), 2)
            self.assertEqual(items_list[1]["note"], "חם מאוד")
            self.assertEqual(items_list[1]["tagsHe"], ["חלב שיבולת שועל"])
            self.assertEqual(items_list[1]["tagsEn"], ["Oat Milk"])
        finally:
            conn.close()

        checkout_js = (ROOT_DIR / "src" / "components" / "CheckoutSheet.js").read_text(encoding="utf-8")
        self.assertIn('data-testid="checkout-sheet"', checkout_js)
        self.assertIn('data-testid="checkout-name-input"', checkout_js)
        self.assertIn('data-testid="checkout-phone-input"', checkout_js)
        self.assertIn('data-testid="submit-order-btn"', checkout_js)

        receipt_js = (ROOT_DIR / "src" / "components" / "StaticReceipt.js").read_text(encoding="utf-8")
        self.assertIn('data-testid="static-receipt"', receipt_js)
        self.assertIn('data-testid="receipt-order-number"', receipt_js)
        self.assertIn('data-testid="receipt-qr-img"', receipt_js)
        self.assertIn("buildBitPaymentUrl(bitPhone)", receipt_js)
        self.assertIn("generateQrDataUrl(bitUrl, 240)", receipt_js)
        self.assertNotIn("generateQrDataUrl(bitPhone", receipt_js)
        self.assertIn('data-testid="copy-phone-btn"', receipt_js)
        self.assertIn("העתק מספר", receipt_js)
        self.assertIn("הועתק! ✓", receipt_js)
        self.assertIn("__lastCopiedText", receipt_js)

    def test_cuj04_pin_gate_modal_and_persistence_contract(self):
        pin_modal_js = (ROOT_DIR / "src" / "components" / "PinGateModal.js").read_text(encoding="utf-8")
        state_js = (ROOT_DIR / "src" / "state.js").read_text(encoding="utf-8")
        main_js = (ROOT_DIR / "src" / "main.js").read_text(encoding="utf-8")
        kds_js = (ROOT_DIR / "src" / "routes" / "KDS.js").read_text(encoding="utf-8")

        self.assertIn('data-testid="pin-gate-modal"', pin_modal_js)
        self.assertIn('data-testid="pin-input"', pin_modal_js)
        self.assertIn('data-testid="pin-error"', pin_modal_js)
        self.assertIn('data-testid="pin-submit"', pin_modal_js)
        self.assertIn("has-error", pin_modal_js)
        self.assertIn('localStorage.setItem("adminPin"', pin_modal_js)
        self.assertIn('localStorage.getItem("adminPin")', state_js)
        self.assertIn("isPinUnlocked", main_js)
        self.assertIn('data-testid="kds-view"', kds_js)
        self.assertIn('dir="ltr"', kds_js)

    def test_cuj05_kds_polling_chime_and_two_tap_ticket_lifecycle(self):
        status, created = self._request_json(
            "POST",
            "/api/order",
            {
                "customerName": "דניאל",
                "customerPhone": "054-9876543",
                "items": [
                    {
                        "itemId": "item-croissant",
                        "qty": 2,
                        "selectedTagIds": [],
                        "note": "",
                    },
                    {
                        "itemId": "item-cappuccino",
                        "qty": 1,
                        "selectedTagIds": ["tag-oat"],
                        "note": "חם מאוד",
                    },
                ],
            },
        )
        self.assertEqual(status, 201)
        self.assertEqual(created["number"], 101)
        self.assertEqual(created["total"], 40)
        self.assertIs(created["isNotified"], False)
        self.assertIs(created["isDone"], False)

        status_pending, pending_orders = self._request_json("GET", "/api/orders?status=pending")
        self.assertEqual(status_pending, 200)
        self.assertEqual(len(pending_orders), 1)
        t101 = pending_orders[0]
        self.assertEqual(t101["number"], 101)
        self.assertEqual(t101["items"][0]["nameEn"], "Butter Croissant")
        self.assertEqual(t101["items"][0]["qty"], 2)
        self.assertEqual(t101["items"][1]["nameEn"], "Cappuccino")
        self.assertEqual(t101["items"][1]["tagsEn"], ["Oat Milk"])
        self.assertEqual(t101["items"][1]["note"], "חם מאוד")

        # Tap 1: Notify on WhatsApp -> sets isNotified=True, keeps isDone=False
        status_tap1, after_tap1 = self._request_json(
            "PATCH",
            f"/api/orders/{t101['id']}",
            {"isNotified": True},
        )
        self.assertEqual(status_tap1, 200)
        self.assertIs(after_tap1["isNotified"], True)
        self.assertIs(after_tap1["isDone"], False)

        _, pending_after_tap1 = self._request_json("GET", "/api/orders?status=pending")
        self.assertEqual(len(pending_after_tap1), 1)
        self.assertIs(pending_after_tap1[0]["isNotified"], True)

        # Tap 2: Done / Pick-up -> sets isDone=True, moves to done queue
        status_tap2, after_tap2 = self._request_json(
            "PATCH",
            f"/api/orders/{t101['id']}",
            {"isDone": True, "status": "done"},
        )
        self.assertEqual(status_tap2, 200)
        self.assertIs(after_tap2["isNotified"], True)
        self.assertIs(after_tap2["isDone"], True)
        self.assertEqual(after_tap2["status"], "done")

        _, pending_after_tap2 = self._request_json("GET", "/api/orders?status=pending")
        self.assertEqual(len(pending_after_tap2), 0)
        _, done_after_tap2 = self._request_json("GET", "/api/orders?status=done")
        self.assertEqual(len(done_after_tap2), 1)
        self.assertEqual(done_after_tap2[0]["number"], 101)

        kds_js = (ROOT_DIR / "src" / "routes" / "KDS.js").read_text(encoding="utf-8")
        self.assertIn("2000", kds_js)
        self.assertIn("setInterval", kds_js)
        self.assertIn("playGentleChime", kds_js)
        self.assertIn("__resetKdsSeenOrders", kds_js)
        self.assertIn("__lastWindowOpenUrl", kds_js)
        self.assertIn("buildHebrewWhatsAppUrl", kds_js)
        self.assertIn("kds-ticket-", kds_js)
        self.assertIn("notify-wa-btn-", kds_js)
        self.assertIn("done-order-btn-", kds_js)
        self.assertIn("copy-wa-text-", kds_js)
        self.assertIn("wa-preview-", kds_js)
        self.assertIn("kds-completed-drawer-toggle", kds_js)
        self.assertIn("kds-completed-drawer", kds_js)
        self.assertIn("completed-ticket-", kds_js)
        self.assertIn("kds-shift-reset-btn", kds_js)

    def test_cuj06_kds_quick86_closed_note_and_store_closed_enforcement(self):
        # First create Order #101 so nextOrderNumber advances to 102
        self._request_json(
            "POST",
            "/api/order",
            {
                "customerName": "דניאל",
                "customerPhone": "054-9876543",
                "items": [{"itemId": "item-croissant", "qty": 1}],
            },
        )
        _, store = self._request_json("GET", "/api/store")
        self.assertEqual(store["nextOrderNumber"], 102)

        # Quick-86 tag-oat and item-croissant, close store, and update closedNoteHe
        for t in store["globalTags"]:
            if t["id"] == "tag-oat":
                t["inStock"] = False
        for item in store["menuItems"]:
            if item["id"] == "item-croissant":
                item["inStock"] = False
        store["isOpen"] = False
        store["closedNoteHe"] = "יצאנו להפסקת צהריים, נחזור ב-14:00"

        status_put, updated = self._request_json("PUT", "/api/store", store)
        self.assertEqual(status_put, 200)
        self.assertIs(updated["isOpen"], False)
        self.assertEqual(updated["closedNoteHe"], "יצאנו להפסקת צהריים, נחזור ב-14:00")
        self.assertEqual(updated["nextOrderNumber"], 102)

        # Ordering while store is closed must fail with 400
        status_closed_order, err_closed = self._request_json(
            "POST",
            "/api/order",
            {
                "customerName": "לקוח",
                "customerPhone": "054-1112233",
                "items": [{"itemId": "item-cappuccino", "qty": 1}],
            },
        )
        self.assertEqual(status_closed_order, 400)
        self.assertIn("closed", err_closed.get("error", "").lower())

        # Re-open store while keeping item-croissant and tag-oat 86'd
        updated["isOpen"] = True
        self._request_json("PUT", "/api/store", updated)

        # Ordering 86'd item-croissant must fail with 400
        status_oos_item, err_oos = self._request_json(
            "POST",
            "/api/order",
            {
                "customerName": "לקוח",
                "customerPhone": "054-1112233",
                "items": [{"itemId": "item-croissant", "qty": 1}],
            },
        )
        self.assertEqual(status_oos_item, 400)
        self.assertIn("out of stock", err_oos.get("error", "").lower())

        # Ordering item-cappuccino with 86'd tag-oat ignores the out-of-stock tag
        status_cap, order_cap = self._request_json(
            "POST",
            "/api/order",
            {
                "customerName": "לקוח",
                "customerPhone": "054-1112233",
                "items": [
                    {
                        "itemId": "item-cappuccino",
                        "qty": 1,
                        "selectedTagIds": ["tag-oat", "tag-decaf"],
                    }
                ],
            },
        )
        self.assertEqual(status_cap, 201)
        self.assertEqual(order_cap["total"], 14)
        self.assertEqual(order_cap["items"][0]["selectedTagIds"], ["tag-decaf"])

        kds_js = (ROOT_DIR / "src" / "routes" / "KDS.js").read_text(encoding="utf-8")
        self.assertIn('data-testid="kds-open-toggle"', kds_js)
        self.assertIn('data-testid="kds-closed-note-input"', kds_js)
        self.assertIn('data-testid="kds-quick86-strip"', kds_js)
        self.assertIn("quick86-tag-", kds_js)
        self.assertIn("quick86-item-", kds_js)
        self.assertIn("saveStoreState", kds_js)

    def test_cuj07_admin_menu_spreadsheet_photo_album_and_store_persistence(self):
        status_get, store = self._request_json("GET", "/api/store")
        self.assertEqual(status_get, 200)
        self.assertEqual(len(store["photoAlbum"]), 2)
        self.assertEqual(len(store["globalTags"]), 3)
        self.assertEqual(len(store["menuItems"]), 2)

        matcha_data_url = "data:image/jpeg;base64,/9j/4AAQSkZJRg=="
        store["photoAlbum"].append(
            {
                "id": "photo-matcha",
                "label": "Iced Matcha Photo",
                "url": matcha_data_url,
            }
        )
        store["globalTags"].append(
            {
                "id": "tag-almond",
                "nameEn": "Almond Milk",
                "nameHe": "חלב שקדים",
                "price": 2,
                "inStock": True,
            }
        )
        store["menuItems"].append(
            {
                "id": "item-matcha",
                "category": "Coffee",
                "nameEn": "Iced Matcha",
                "nameHe": "מאצ׳ה אייס",
                "descHe": "מאצ׳ה יפנית על חלב קר",
                "price": 18,
                "inStock": True,
                "photoId": "photo-matcha",
                "tagIds": ["tag-almond"],
            }
        )

        status_put, updated = self._request_json("PUT", "/api/store", store)
        self.assertEqual(status_put, 200)
        self.assertEqual(len(updated["photoAlbum"]), 3)
        self.assertEqual(len(updated["globalTags"]), 4)
        self.assertEqual(len(updated["menuItems"]), 3)

        almond_tag = next(t for t in updated["globalTags"] if t["id"] == "tag-almond")
        self.assertEqual(almond_tag.get("labelEn"), "Almond Milk")
        self.assertEqual(almond_tag.get("labelHe"), "חלב שקדים")
        self.assertEqual(almond_tag.get("priceDelta"), 2)

        matcha_item = next(i for i in updated["menuItems"] if i["id"] == "item-matcha")
        self.assertEqual(matcha_item.get("photo"), matcha_data_url)
        self.assertEqual(matcha_item.get("imageUrl"), matcha_data_url)
        self.assertEqual(matcha_item.get("photoUrl"), matcha_data_url)
        self.assertEqual(matcha_item.get("photoId"), "photo-matcha")

        status_order, created_order = self._request_json(
            "POST",
            "/api/order",
            {
                "customerName": "נועה",
                "customerPhone": "054-9876543",
                "items": [
                    {
                        "itemId": "item-matcha",
                        "qty": 1,
                        "selectedTagIds": ["tag-almond"],
                    }
                ],
            },
        )
        self.assertEqual(status_order, 201)
        self.assertEqual(created_order["total"], 20)
        self.assertEqual(created_order["items"][0]["tagsHe"], ["חלב שקדים"])
        self.assertEqual(created_order["items"][0]["tagsEn"], ["Almond Milk"])

        admin_menu_js = (ROOT_DIR / "src" / "routes" / "AdminMenu.js").read_text(encoding="utf-8")
        self.assertIn('data-testid="admin-menu-view"', admin_menu_js)
        self.assertIn('dir="ltr"', admin_menu_js)
        self.assertIn('data-testid="admin-save-btn"', admin_menu_js)
        self.assertIn('data-testid="admin-save-status"', admin_menu_js)
        self.assertIn('data-testid="json-byte-size"', admin_menu_js)
        self.assertIn('data-testid="json-raw-preview"', admin_menu_js)
        self.assertIn('data-testid="setting-bit-phone"', admin_menu_js)
        self.assertIn('data-testid="setting-admin-pin"', admin_menu_js)
        self.assertIn('data-testid="setting-closed-note-he"', admin_menu_js)
        self.assertIn('data-testid="setting-is-open"', admin_menu_js)
        self.assertIn('data-testid="new-photo-label-input"', admin_menu_js)
        self.assertIn('data-testid="new-photo-file-input"', admin_menu_js)
        self.assertIn("compressImageFileToDataUrl", admin_menu_js)
        self.assertIn("photo-card-", admin_menu_js)
        self.assertIn("photo-label-", admin_menu_js)
        self.assertIn("delete-photo-", admin_menu_js)
        self.assertIn('data-testid="add-global-tag-btn"', admin_menu_js)
        self.assertIn("tag-row-", admin_menu_js)
        self.assertIn("tag-instock-", admin_menu_js)
        self.assertIn("tag-name-en-", admin_menu_js)
        self.assertIn("tag-name-he-", admin_menu_js)
        self.assertIn("tag-price-", admin_menu_js)
        self.assertIn("delete-tag-", admin_menu_js)
        self.assertIn('data-testid="add-menu-item-btn"', admin_menu_js)
        self.assertIn("item-row-", admin_menu_js)
        self.assertIn("item-instock-", admin_menu_js)
        self.assertIn("item-category-", admin_menu_js)
        self.assertIn("item-name-en-", admin_menu_js)
        self.assertIn("item-name-he-", admin_menu_js)
        self.assertIn("item-desc-he-", admin_menu_js)
        self.assertIn("item-price-", admin_menu_js)
        self.assertIn("item-photo-", admin_menu_js)
        self.assertIn("item-tag-", admin_menu_js)
        self.assertIn("delete-item-", admin_menu_js)

    def test_admin_pin_header_enforcement_and_vercel_entrypoint(self):
        from http.server import BaseHTTPRequestHandler
        from api.index import handler as vercel_handler

        self.assertTrue(issubclass(vercel_handler, BaseHTTPRequestHandler))
        self.assertTrue(issubclass(vercel_handler, CourtyardRequestHandler))

        vercel_json = json.loads((ROOT_DIR / "vercel.json").read_text(encoding="utf-8"))
        self.assertEqual(vercel_json.get("version"), 2)
        rewrites = vercel_json.get("rewrites") or []
        self.assertTrue(any(r.get("destination") == "/api/index.py" for r in rewrites))
        self.assertTrue(any(r.get("destination") == "/index.html" for r in rewrites))

        state_js = (ROOT_DIR / "src" / "state.js").read_text(encoding="utf-8")
        self.assertIn("getAdminHeaders", state_js)
        self.assertIn("X-Admin-Pin", state_js)

        _, store = self._request_json("GET", "/api/store")

        # Wrong X-Admin-Pin header must be rejected with 401
        status_bad_pin, err_bad = self._request_json(
            "PUT",
            "/api/store",
            store,
            extra_headers={"X-Admin-Pin": "9999"},
        )
        self.assertEqual(status_bad_pin, 401)
        self.assertIn("Unauthorized", err_bad.get("error", ""))

        # Valid X-Admin-Pin header succeeds with 200
        store["closedNoteHe"] = "בדיקת פין תקין"
        status_good_pin, updated = self._request_json(
            "PUT",
            "/api/store",
            store,
            extra_headers={"X-Admin-Pin": "1234"},
        )
        self.assertEqual(status_good_pin, 200)
        self.assertEqual(updated["closedNoteHe"], "בדיקת פין תקין")

        # When REQUIRE_ADMIN_PIN=1 is set, missing X-Admin-Pin is rejected with 401
        old_req = os.environ.get("REQUIRE_ADMIN_PIN")
        os.environ["REQUIRE_ADMIN_PIN"] = "1"
        try:
            status_missing, _ = self._request_json("POST", "/api/orders/reset", {})
            self.assertEqual(status_missing, 401)
            status_with_pin, reset_ok = self._request_json(
                "POST",
                "/api/orders/reset",
                {},
                extra_headers={"X-Admin-Pin": "1234"},
            )
            self.assertEqual(status_with_pin, 200)
            self.assertTrue(reset_ok.get("ok"))
        finally:
            if old_req is None:
                os.environ.pop("REQUIRE_ADMIN_PIN", None)
            else:
                os.environ["REQUIRE_ADMIN_PIN"] = old_req


if __name__ == "__main__":
    unittest.main()
