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

    utility_statuses = {}
    for util_path in ["/src/state.js", "/src/utils/qr.js", "/src/utils/wa.js", "/src/utils/chime.js", "/src/utils/image.js"]:
        st_u, _, body_u = request(base_url, "GET", util_path)
        assert st_u == 200 and len(body_u) > 100, f"Failed to load {util_path} (status {st_u})"
        utility_statuses[util_path] = st_u

    report["static_assets"] = {
        "main_js": status_js,
        "index_css": status_css,
        "utilities": utility_statuses,
    }

    # 2. Verify GET /api/store & OPTIONS preflight
    status_opt, opt_headers, _ = request(base_url, "OPTIONS", "/api/store")
    assert status_opt in (200, 204), f"OPTIONS /api/store failed with {status_opt}"
    allow_headers = opt_headers.get("Access-Control-Allow-Headers") or opt_headers.get("access-control-allow-headers", "")

    status_store, _, body_store = request(base_url, "GET", "/api/store")
    assert status_store == 200, f"GET /api/store failed with {status_store}: {body_store}"
    store = json.loads(body_store)
    assert isinstance(store.get("isOpen"), bool), "store.isOpen must be boolean"
    assert int(store.get("nextOrderNumber", 0)) >= 101, "store.nextOrderNumber must be >= 101"
    report["get_store"] = {
        "status": status_store,
        "optionsPreflightStatus": status_opt,
        "corsAllowHeaders": allow_headers,
        "isOpen": store.get("isOpen"),
        "nextOrderNumber": store.get("nextOrderNumber"),
        "menuItemsCount": len(store.get("menuItems", [])),
        "globalTagsCount": len(store.get("globalTags", [])),
        "photoAlbumCount": len(store.get("photoAlbum", [])),
    }

    # 3. Verify Admin PIN security on all admin write endpoints (wrong header -> 401)
    status_no_pin, _, _ = request(base_url, "PUT", "/api/store", payload=store)
    status_bad_pin_store, _, body_bad_pin = request(
        base_url, "PUT", "/api/store", payload=store, headers={"X-Admin-Pin": "0000-wrong"}
    )
    assert status_bad_pin_store == 401, f"Expected 401 for wrong PIN on PUT /api/store, got {status_bad_pin_store}: {body_bad_pin}"

    status_bad_pin_patch, _, _ = request(
        base_url,
        "PATCH",
        "/api/orders/ord-nonexistent-smoke",
        payload={"isNotified": True},
        headers={"X-Admin-Pin": "0000-wrong"},
    )
    assert status_bad_pin_patch == 401, f"Expected 401 for wrong PIN on PATCH /api/orders/:id, got {status_bad_pin_patch}"

    status_bad_pin_reset, _, _ = request(
        base_url,
        "POST",
        "/api/orders/reset",
        payload={},
        headers={"X-Admin-Pin": "0000-wrong"},
    )
    assert status_bad_pin_reset == 401, f"Expected 401 for wrong PIN on POST /api/orders/reset, got {status_bad_pin_reset}"

    report["pin_security"] = {
        "missingPinStatus": status_no_pin,
        "wrongPinPutStoreStatus": status_bad_pin_store,
        "wrongPinPatchOrderStatus": status_bad_pin_patch,
        "wrongPinResetOrdersStatus": status_bad_pin_reset,
    }

    # 4. Non-destructive negative API validation guards (always safe even when live orders exist)
    status_empty_name, _, _ = request(
        base_url,
        "POST",
        "/api/order",
        payload={"customerName": "   ", "customerPhone": "054-0000000", "items": [{"itemId": "item-cappuccino", "qty": 1}]},
    )
    assert status_empty_name == 400, f"Expected 400 for empty customerName, got {status_empty_name}"

    status_empty_items, _, _ = request(
        base_url,
        "POST",
        "/api/order",
        payload={"customerName": "בדיקה", "customerPhone": "054-0000000", "items": []},
    )
    assert status_empty_items == 400, f"Expected 400 for empty items list, got {status_empty_items}"

    status_unknown_order, _, _ = request(
        base_url,
        "PATCH",
        "/api/orders/ord-nonexistent-smoke",
        payload={"isNotified": True},
        headers={"X-Admin-Pin": admin_pin},
    )
    assert status_unknown_order == 404, f"Expected 404 for unknown order PATCH, got {status_unknown_order}"

    report["negative_validation_guards"] = {
        "emptyCustomerNameStatus": status_empty_name,
        "emptyItemsStatus": status_empty_items,
        "unknownOrderPatchStatus": status_unknown_order,
    }

    # 5. If no active orders exist and store is open, run non-destructive order + 2-tap PATCH + reset smoke test
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

        status_tap1, _, body_tap1 = request(
            base_url,
            "PATCH",
            f"/api/orders/{order_id}",
            payload={"isNotified": True},
            headers={"X-Admin-Pin": admin_pin},
        )
        assert status_tap1 == 200, (
            f"PATCH Tap 1 /api/orders/{order_id} failed with {status_tap1}: {body_tap1}"
        )

        status_tap2, _, body_tap2 = request(
            base_url,
            "PATCH",
            f"/api/orders/{order_id}",
            payload={"isDone": True, "status": "done"},
            headers={"X-Admin-Pin": admin_pin},
        )
        assert status_tap2 == 200, (
            f"PATCH Tap 2 /api/orders/{order_id} failed with {status_tap2}: {body_tap2}"
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
            "tap1Status": status_tap1,
            "tap2Status": status_tap2,
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
