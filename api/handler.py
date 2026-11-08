"""HTTP Request Handler for Courtyard Coffee (/api/* + Static ES Modules + SPA Fallback)."""
from __future__ import annotations

import json
import mimetypes
from http.server import SimpleHTTPRequestHandler
from pathlib import Path
from urllib.parse import parse_qs, urlparse

from api.db import (
    create_order,
    get_store_state,
    list_orders,
    reset_orders,
    save_store_state,
    update_order_status,
)

ROOT_DIR = Path(__file__).resolve().parent.parent

MIME_MAP = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".mjs": "application/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
}


class CourtyardRequestHandler(SimpleHTTPRequestHandler):
    db_path: str | None = None

    def log_message(self, format: str, *args) -> None:
        pass

    def _send_json(self, status_code: int, payload: object) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _send_bytes(self, status_code: int, content_type: str, data: bytes) -> None:
        self.send_response(status_code)
        self.send_header("Content-Type", content_type)
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def _read_json_body(self) -> dict:
        length = int(self.headers.get("Content-Length", "0") or "0")
        if length <= 0:
            return {}
        raw = self.rfile.read(length)
        if not raw:
            return {}
        return json.loads(raw.decode("utf-8"))

    def do_OPTIONS(self) -> None:
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        path = parsed.path

        if path == "/api/store":
            state = get_store_state(db_path=self.db_path)
            self._send_json(200, state)
            return

        if path == "/api/orders":
            qs = parse_qs(parsed.query)
            status_filter = qs.get("status", [None])[0]
            orders = list_orders(status=status_filter, db_path=self.db_path)
            self._send_json(200, orders)
            return

        if path == "/favicon.ico":
            self._send_bytes(204, "image/x-icon", b"")
            return

        rel_path = path.lstrip("/")
        if rel_path:
            candidate = (ROOT_DIR / rel_path).resolve()
            if (
                str(candidate).startswith(str(ROOT_DIR))
                and candidate.is_file()
                and not rel_path.startswith(("api/", "scripts/", "tests/", "db/", "."))
            ):
                ext = candidate.suffix.lower()
                content_type = MIME_MAP.get(
                    ext, mimetypes.guess_type(str(candidate))[0] or "application/octet-stream"
                )
                self._send_bytes(200, content_type, candidate.read_bytes())
                return

        index_file = ROOT_DIR / "index.html"
        if index_file.is_file():
            self._send_bytes(200, "text/html; charset=utf-8", index_file.read_bytes())
        else:
            self._send_json(404, {"error": "index.html not found"})

    def do_PUT(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path == "/api/store":
            try:
                payload = self._read_json_body()
                updated = save_store_state(payload, db_path=self.db_path)
                self._send_json(200, updated)
            except Exception as exc:
                self._send_json(400, {"error": str(exc)})
            return
        self._send_json(404, {"error": "Not found"})

    def do_POST(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path == "/api/order":
            try:
                payload = self._read_json_body()
                order = create_order(payload, db_path=self.db_path)
                self._send_json(201, order)
            except ValueError as exc:
                self._send_json(400, {"error": str(exc)})
            except Exception as exc:
                self._send_json(500, {"error": str(exc)})
            return

        if parsed.path == "/api/orders/reset":
            try:
                res = reset_orders(db_path=self.db_path)
                self._send_json(200, res)
            except Exception as exc:
                self._send_json(500, {"error": str(exc)})
            return

        self._send_json(404, {"error": "Not found"})

    def do_PATCH(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path.startswith("/api/orders/"):
            order_id = parsed.path.split("/api/orders/", 1)[1].strip("/")
            try:
                payload = self._read_json_body()
                updated = update_order_status(order_id, payload, db_path=self.db_path)
                if updated is None:
                    self._send_json(404, {"error": "Order not found"})
                else:
                    self._send_json(200, updated)
            except ValueError as exc:
                self._send_json(400, {"error": str(exc)})
            except Exception as exc:
                self._send_json(500, {"error": str(exc)})
            return

        self._send_json(404, {"error": "Not found"})
