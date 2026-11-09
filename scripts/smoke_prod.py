#!/usr/bin/env python3
"""
Post-Deploy Production Smoke Verification Script for Courtyard Coffee.
Verifies live Vercel SPA routes, static ES modules, Turso-backed /api/store,
X-Admin-Pin security enforcement, and full order lifecycle + shift reset.

Usage:
  /usr/bin/python3 scripts/smoke_prod.py
  /usr/bin/python3 scripts/smoke_prod.py --url https://courtyard-coffee.vercel.app --pin 1234
"""
from __future__ import annotations

import argparse
import json
import os
import urllib.error
import urllib.request

DEFAULT_PROD_URL = "https://courtyard-coffee.vercel.app"


def request(base_url: str, method: str, path: str, payload=None, headers=None):
    url = base_url.rstrip("/") + path
    req_headers = {"User-Agent": "CourtyardCoffee-SmokeVerifier/1.0"}
    if headers:
        req_headers.update(headers)
    data = None
    if payload is not None:
        data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        req_headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=data, headers=req_headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=15.0) as resp:
            body = resp.read().decode("utf-8", errors="replace")
            return resp.status, dict(resp.headers), body
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        return exc.code, dict(exc.headers), body


def run_smoke(base_url: str, admin_pin: str) -> dict:
    report: dict[str, object] = {"baseUrl": base_url}

    # 1. Verify SPA routes and static ES module assets
    for route in ["/", "/admin/kds", "/admin/menu"]:
        status, _, body = request(base_url, "GET", route)
        assert status == 200, f"Expected 200 on {route}, got {status}: {body[:200]}"
        assert '<script type="module" src="/src/main.js"></script>' in body, (
            f"Missing main.js script tag on {route}"
        )
        report[f"route_{route}"] = status

    status_js, _, body_js = request(base_url, "GET", "/src/main.js")
    assert status_js == 200 and "mountCustomerRoute" in body_js, "Failed to load /src/main.js"
    status_css, _, body_css = request(base_url, "GET", "/src/index.css")
    assert status_css == 200 and "--bg-courtyard" in body_css, "Failed to load /src/index.css"
    report["static_assets"] = {"main_js": status_js, "index_css": status_css}

    # 2. Verify GET /api/store
    status_store, _, body_store = request(base_url, "GET", "/api/store")
    assert status_store == 200, f"GET /api/store failed with {status_store}: {body_store}"
    store = json.loads(body_store)
    report["get_store"] = {
        "status": status_store,
        "isOpen": store.get("isOpen"),
        "nextOrderNumber": store.get("nextOrderNumber"),
        "menuItemsCount": len(store.get("menuItems", [])),
        "globalTagsCount": len(store.get("globalTags", [])),
        "photoAlbumCount": len(store.get("photoAlbum", [])),
    }

    # 3. Verify Admin PIN security on PUT /api/store (wrong header -> 401)
    status_no_pin, _, _ = request(base_url, "PUT", "/api/store", payload=store)
    status_bad_pin, _, body_bad_pin = request(
        base_url, "PUT", "/api/store", payload=store, headers={"X-Admin-Pin": "0000-wrong"}
    )
    assert status_bad_pin == 401, f"Expected 401 for wrong PIN, got {status_bad_pin}: {body_bad_pin}"
    report["pin_security"] = {
        "missingPinStatus": status_no_pin,
        "wrongPinStatus": status_bad_pin,
    }

    # 4. If no active orders exist and store is open, run non-destructive order + reset smoke test
    _, _, body_existing_orders = request(base_url, "GET", "/api/orders")
    existing_orders = json.loads(body_existing_orders)
    if store.get("isOpen") and len(existing_orders) == 0:
        first_item = (store.get("menuItems") or [{}])[0]
        item_id = first_item.get("id", "item-cappuccino")
        status_order, _, body_order = request(
            base_url,
            "POST",
            "/api/order",
            payload={
                "customerName": "בדיקת פרודקשן",
                "customerPhone": "054-9876543",
                "items": [{"itemId": item_id, "qty": 1, "selectedTagIds": [], "note": "Smoke test"}],
            },
        )
        assert status_order == 201, f"POST /api/order failed with {status_order}: {body_order}"
        created = json.loads(body_order)
        order_id = created["id"]

        status_patch, _, body_patch = request(
            base_url,
            "PATCH",
            f"/api/orders/{order_id}",
            payload={"isNotified": True, "isDone": True, "status": "done"},
            headers={"X-Admin-Pin": admin_pin},
        )
        assert status_patch == 200, (
            f"PATCH /api/orders/{order_id} failed with {status_patch}: {body_patch}"
        )

        status_reset, _, body_reset = request(
            base_url,
            "POST",
            "/api/orders/reset",
            payload={},
            headers={"X-Admin-Pin": admin_pin},
        )
        assert status_reset == 200, f"POST /api/orders/reset failed with {status_reset}: {body_reset}"
        report["order_lifecycle_and_reset"] = {
            "mode": "full_order_and_reset",
            "createdOrderId": order_id,
            "resetStatus": status_reset,
        }
    else:
        report["order_lifecycle_and_reset"] = {
            "mode": "read_only_non_destructive (live orders present or store closed)",
            "existingOrdersCount": len(existing_orders),
        }

    report["overall"] = "PASS"
    return report


def main() -> None:
    parser = argparse.ArgumentParser(description="Post-deploy production smoke verifier.")
    parser.add_argument(
        "--url",
        default=os.environ.get("PROD_URL", DEFAULT_PROD_URL),
        help="Production base URL (default: https://courtyard-coffee.vercel.app)",
    )
    parser.add_argument(
        "--pin",
        default=os.environ.get("ADMIN_PIN", os.environ.get("DEFAULT_ADMIN_PIN", "1234")),
        help="Admin PIN for authenticated write smoke checks",
    )
    args = parser.parse_args()
    result = run_smoke(args.url, args.pin)
    print(json.dumps(result, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
