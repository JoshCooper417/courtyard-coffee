# ☕ Courtyard Coffee — Milestone Handover (`HANDOVER.md`)

## Current Status: Milestone 1 Complete & 100% Audit-Verified (`m1-red` → `m1-green`) — Executing Milestone 2 (`CUJ-01`, `CUJ-02`, `CUJ-03`)

## TL;DR — What the App Can Now Do (& How Each Point Was Verified)

1. **Database & Seed State (`./db/data.db`)**:
   - **What it does**: Deterministically initializes and seeds the SQLite database with `store_state` (`isOpen: true`, `closedNoteHe: "סגור כעת, נשוב בקרוב"`, `bitPhone: "050-0000000"`, `adminPin: "1234"`, `nextOrderNumber: 101`), 2 embedded `400×400` photos, 3 global modifier tags (`Oat Milk`, `Decaf`, and out-of-stock `Vanilla Syrup`), and 2 menu items (`Cappuccino` at `₪14` and `Butter Croissant` at `₪12`), plus an empty 9-column `orders` table (`id, number, customerName, customerPhone, createdAt, total, isNotified, isDone, items`).
   - **How it was verified**:
     - **Unit tests**: `test_sqlite_seed_state_invariants` and `test_monotonic_next_order_number_protection` in [test_utils.py](file:///Users/joshuacooper/Documents/code/courtyard-coffee/tests/test_utils.py#L181-L246).
     - **SQLite CLI**: `/usr/bin/sqlite3 ./db/data.db "PRAGMA table_info(orders); SELECT json_extract(data, '$.nextOrderNumber') FROM store_state;"` verified all 9 `orders` columns and `nextOrderNumber = 101`.
     - **Visual screenshot proof**: **Slide 1 (`m1_smoke_customer_rtl.png`)** and **Slide 4 (`m1_smoke_admin_menu.png`)** (`Items: 2 • Tags: 3 • Photos: 2`).

2. **REST API Backend (`127.0.0.1:3000`)**:
   - **What it does**: Serves `GET /api/store`, `PUT /api/store` (enforcing monotonic `nextOrderNumber` protection), `POST /api/order` (atomic SQLite transaction inserting the order and incrementing `nextOrderNumber`), `GET /api/orders`, `PATCH /api/orders/:id` (supporting `{ isNotified, isDone }`), and `POST /api/orders/reset`.
   - **How it was verified**:
     - **Handler unit tests (`_InMemorySocket`)**: `test_get_and_put_api_store` and `test_post_and_manage_orders_lifecycle` in [test_routes.py](file:///Users/joshuacooper/Documents/code/courtyard-coffee/tests/test_routes.py#L74-L140).
     - **Live `ThreadingHTTPServer` + Chrome `fetch()` verification**: `rest_api_live_http` in [cdp_harness.py](file:///Users/joshuacooper/Documents/code/courtyard-coffee/scripts/cdp_harness.py#L365-L426) exercised all 6 endpoints over live HTTP (`initialNextOrder: 101`, `createdOrderNumber: 101`, `monotonicNextOrderAfterStalePut: 102`, `notifiedFlag: true`, `doneFlag: true`, `resetOk: true`, `finalNextOrderAfterReset: 101`).

3. **Customer Storefront (`/`)**:
   - **What it does**: Loads in Hebrew RTL (`dir="rtl"`) with the *Garden Courtyard* palette, displays the `"קפה בחצר"` header and `"פתוח להזמנות"` badge, interactively filters menu cards by category (`הכל`, `קפה`, `מאפים`), and renders menu cards with `400×400` photos, prices (`₪14`, `₪12`), and **+ הוסף** buttons.
   - **How it was verified**:
     - **Route & static contract test**: `test_spa_routes_and_frontend_contracts` in [test_routes.py](file:///Users/joshuacooper/Documents/code/courtyard-coffee/tests/test_routes.py#L141-L161).
     - **Live Chrome DOM, image decode & interactive category pill proof**: [cdp_harness.py](file:///Users/joshuacooper/Documents/code/courtyard-coffee/scripts/cdp_harness.py#L241-L290) verified on a `390×844` mobile viewport that `htmlDir === "rtl"`, `title === "קפה בחצר"`, `badge === "פתוח להזמנות"`, both card `<img>` elements have `complete === true, naturalWidth === 400, naturalHeight === 400`, and clicking `"קפה"`, `"מאפים"`, and `"הכל"` filters the rendered DOM cards to `{"Coffee": ["item-cappuccino"], "Pastry": ["item-croissant"], "All": ["item-cappuccino", "item-croissant"]}`.
     - **Visual screenshot proof**: **Slide 1 (`m1_smoke_customer_rtl.png`)** inspected via `read_file`.

4. **Staff 4-Digit PIN Gate & Admin Route Shells (`/admin/*`)**:
   - **What it does**: Protects all `/admin` and `/admin/*` paths ([main.js](file:///Users/joshuacooper/Documents/code/courtyard-coffee/src/main.js#L18-L40)) behind `PinGateModal`, blocks unauthenticated access and rejects invalid PINs (`9999`) with an error alert, and unlocks + persists valid PINs (`1234`) in `localStorage` to display the English LTR Barista KDS and Admin Menu shells.
   - **How it was verified**:
     - **Live Chrome Red → Green DOM & `localStorage` proof**: [cdp_harness.py](file:///Users/joshuacooper/Documents/code/courtyard-coffee/scripts/cdp_harness.py#L292-L363) cleared `localStorage`, navigated to `/admin/kds`, submitted `"9999"` and verified `kdsViewPresent === false, pinModalPresent === true, errorText === "Invalid PIN code. Please try again."` (**Slide 2 — RED**); then submitted `"1234"` and verified `kdsViewPresent === true, pinModalPresent === false, localStorage.getItem('adminPin') === "1234"` (**Slide 3 — GREEN**), and navigated to `/admin/menu` to verify automatic unlock in LTR (**Slide 4**).

5. **Core Browser ES Module Utilities (`src/utils/{qr,wa,chime,image}.js`)**:
   - **What it does**:
     - `generateQrDataUrl("050-0000000")`: Encodes an **ISO/IEC 18004 Version 2-L (`25×25` modules, Byte Mode `0100`, Mask `000`, 10 $GF(2^8)$ Reed-Solomon ECC codewords)** scannable QR code into a `240×240` binary PNG (`data:image/png;base64,...`).
     - `compressImageFileToDataUrl(file)`: Center-crops and compresses an uploaded image (`1000×800` PNG) into a `400×400` JPEG (`data:image/jpeg;base64,...`).
     - `formatWaPhone` + `buildHebrewWhatsAppUrl`: Normalizes `054-9876543` → `972549876543` and builds the encoded Hebrew `https://wa.me/972549876543?text=...` URL.
     - `playGentleChime()`: Synthesizes a 2-tone (`C5 → E5`) Web Audio sine chime on a shared, resumed `AudioContext` and increments `window.__chimeCount`.
   - **How it was verified**:
     - **Unit & pixel-level ISO QR decoder tests**: `test_qr_data_url_is_valid_240x240_png` in [test_utils.py](file:///Users/joshuacooper/Documents/code/courtyard-coffee/tests/test_utils.py#L266-L310) decompresses the PNG `IDAT` chunk, reconstructs the `25×25` module matrix from the rendered pixel luminance, verifies both 15-bit format words equal `0x77C4`, verifies all 10 $GF(2^8)$ Reed-Solomon syndromes equal `0`, unmasks the zigzag byte stream, and asserts the decoded string is `"050-0000000"`.
     - **Live Chrome execution & `<canvas>` QR decode proof**: [cdp_harness.py](file:///Users/joshuacooper/Documents/code/courtyard-coffee/scripts/cdp_harness.py#L428-L622) dynamically imported all 4 JS ES modules in real Chrome, decoded the rendered `qrImg` pixels from an HTML `<canvas>` back to `"050-0000000"` (`formatWordHex: "0x77C4", modeIndicator: 4`), and captured **Slide 5 (`m1_smoke_core_utilities.png`)** (inspected via `read_file`).

---

## 1. Git Commit & Tag State (Milestone 1)
- **`m1-red` Commit SHA**: `32edca1455b179c30e9ef29db32ef635fba4034f` (`test(m1): add failing assertions [RED]`)
- **`m1-green` Commit SHA**: `de8c9403e5438b3c76a5d459b75dc379f76510c0` (`fix(m1): resolve all critical audit caveats with ISO-18004 QR and full live proofs [GREEN]`)
