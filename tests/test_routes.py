import io
import json
import os
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


class TestMilestone1Routes(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.db_path = os.path.join(self.temp_dir.name, "routes_test.db")
        init_db(db_path=self.db_path, reset=True)

    def tearDown(self):
        self.temp_dir.cleanup()

    def _raw_http_request(self, method: str, path: str, payload=None):
        body_bytes = b""
        headers = ["Host: 127.0.0.1:3000", "Connection: close"]
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

    def _request_json(self, method: str, path: str, payload=None):
        status, text = self._raw_http_request(method, path, payload=payload)
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
        self.assertEqual(created["orderNumber"], 101)
        self.assertEqual(created["totalNis"], 32)
        self.assertEqual(created["status"], "pending")

        status_list, orders = self._request_json("GET", "/api/orders?status=pending")
        self.assertEqual(status_list, 200)
        self.assertEqual(len(orders), 1)
        self.assertEqual(orders[0]["id"], created["id"])

        status_patch, patched = self._request_json(
            "PATCH",
            f"/api/orders/{created['id']}",
            {"status": "done"},
        )
        self.assertEqual(status_patch, 200)
        self.assertEqual(patched["status"], "done")
        self.assertIsNotNone(patched.get("completedAt"))

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
        self.assertIn("קפה בחצר", customer_js)

        pin_modal_js = (ROOT_DIR / "src" / "components" / "PinGateModal.js").read_text(encoding="utf-8")
        self.assertIn("adminPin", pin_modal_js)
        self.assertIn("localStorage", pin_modal_js)


if __name__ == "__main__":
    unittest.main()
