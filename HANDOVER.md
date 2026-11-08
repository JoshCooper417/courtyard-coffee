# Handover — Milestone 2: Customer Storefront & Checkout Flow (`CUJ-01`, `CUJ-02`, `CUJ-03`)

> [!IMPORTANT]
> **Human-in-the-Loop (HITL) Checkpoint 2 — Complete State, Artifacts & Operational Playbook**
> Milestone 1 (`M1`) and Milestone 2 (`M2`: `CUJ-01`, `CUJ-02`, `CUJ-03`) are complete, visually verified in headless Google Chrome, independently audited by fresh `critical-auditor` subagents, and tagged in Git (`m1-red`, `m1-green`, `m2-red`, `m2-green`).
>
> This document links to **every planning artifact, subagent definition, subagent conversation log, screenshot, telemetry report, source file, database state, and operational command ("how to do things")** so a new conversation or subagent can execute Milestone 3 (`M3`) and Milestone 4 (`M4`) with zero missing context.

---

## TL;DR — What the App Can Now Do (& How Each Point Was Verified)

Every capability below is live, persisted, and verified (`100% FULLY BACKED` by [Milestone 1 Critical Auditor](conversation://94fd2253-9424-49c4-8611-d8c0817dec12) and [Milestone 2 Critical Auditor](conversation://f34c6921-7c4b-4bce-b500-062f5716a63a)):

### Milestone 2 Capabilities (`CUJ-01`, `CUJ-02`, `CUJ-03`)
1. **Hebrew RTL Storefront, Category Filtering & Zero-Polling Guarantee (`CUJ-01`)**:
   - **What it does**: Renders the `390×844` mobile Hebrew storefront (`קפה בחצר`, status badge `פתוח להזמנות`), category filter pills (`הכל`, `קפה`, `מאפים`), and menu cards with `400×400` photos, Hebrew titles/descriptions, and `₪` prices (`קפוצ׳ינו` `14 ₪`, `קרואסון חמאה` `12 ₪`). Performs **zero** background polling while the customer browses.
   - **How it was verified**:
     - **Chrome Performance & Network Telemetry** ([`m2_cuj_report.json`](file:///Users/joshuacooper/Documents/code/courtyard-coffee/screenshots/m2_cuj_report.json)): Over a 3.1-second dwell window on `/`, both `window.__storeFetchCount` (`1 → 1`) and `performance.getEntriesByType('resource')` for `/api/store` (`1 → 1`) remained completely flat (`zeroBackgroundPolls: true`, `consoleErrorCount: 0`).
     - **Visual Screenshot**: [`cuj01_initial_storefront.png`](file:///Users/joshuacooper/Documents/code/courtyard-coffee/screenshots/cuj01_initial_storefront.png).

2. **Direct Add (`+ הוסף`) & Inline Quantity Stepper (`+` / `−`) for Items Without Modifiers (`CUJ-01`)**:
   - **What it does**: Clicking `+ הוסף` on `קרואסון חמאה` (`linkedTagIds: []`) bypasses the modifier sheet (`sheetAfterFirstClick: false`), immediately adds `1 × קרואסון חמאה` to the cart, swaps the button for an inline `+ 1 −` stepper (`[data-testid="stepper-item-croissant"]`), and increments to `2` (`2 פריטים`, `24 ₪` in the sticky bottom bar) when `+` is clicked.
   - **How it was verified**:
     - **Unit Test**: `test_cuj01_cart_keying_and_inline_stepper_contract` in [`tests/test_utils.py`](file:///Users/joshuacooper/Documents/code/courtyard-coffee/tests/test_utils.py).
     - **Live Chrome DOM Telemetry**: Verified `sheetAfterFirstClick === false`, `qtyAfterFirstClick === "1"`, `qtyAfterSecondClick === "2"`, `cartCountText === "2 פריטים"`, `cartTotalText === "24 ₪"`.
     - **Visual Screenshot**: [`cuj01_pastry_added.png`](file:///Users/joshuacooper/Documents/code/courtyard-coffee/screenshots/cuj01_pastry_added.png).

3. **Tag Customization Bottom Sheet, Out-of-Stock Enforcement & Dynamic Price Calculation (`CUJ-02`)**:
   - **What it does**: Clicking `+ הוסף` on `קפוצ׳ינו` (`14 ₪`) opens the slide-up `TagBottomSheet` (`[data-testid="tag-bottom-sheet"]`) displaying its linked modifiers:
     - `חלב שיבולת שועל (+2 ₪)` — enabled (`disabled: false`)
     - `נטול קפאין` — enabled (`disabled: false`)
     - `סירופ וניל (+3 ₪) (אזל)` — disabled (`disabled: true`) and visually struck through because `inStock: false`
     Selecting `חלב שיבולת שועל (+2 ₪)` and typing `"חם מאוד"` in the free-text note field (`[data-testid="item-note-input"]`) updates the sheet confirm CTA live from `הוסף להזמנה • 14 ₪` to `הוסף להזמנה • 16 ₪`. Confirming closes the sheet and updates the sticky cart bar to `3 פריטים` / `40 ₪` (`24 ₪ + 16 ₪`) with distinct composite cart keys (`item-croissant::::` and `item-cappuccino::tag-oat::חם מאוד`).
   - **How it was verified**:
     - **Unit Test**: `test_cuj02_tag_bottom_sheet_and_note_persistence` in [`tests/test_routes.py`](file:///Users/joshuacooper/Documents/code/courtyard-coffee/tests/test_routes.py).
     - **Live Chrome DOM & State Snapshot**: Verified `syrupDisabled === true`, `confirmBtnInitialText === "הוסף להזמנה • 14 ₪"`, `confirmBtnUpdatedText === "הוסף להזמנה • 16 ₪"`, and inspected `window.__appState.cart` confirming both line items, `selectedTagIds: ["tag-oat"]`, `tagsHe: ["חלב שיבולת שועל"]`, `tagsEn: ["Oat Milk"]`, and `note: "חם מאוד"`.
     - **Visual Screenshots**: [`cuj02_bottom_sheet_open.png`](file:///Users/joshuacooper/Documents/code/courtyard-coffee/screenshots/cuj02_bottom_sheet_open.png), [`cuj02_bottom_sheet_selected.png`](file:///Users/joshuacooper/Documents/code/courtyard-coffee/screenshots/cuj02_bottom_sheet_selected.png), [`cuj02_cart_updated.png`](file:///Users/joshuacooper/Documents/code/courtyard-coffee/screenshots/cuj02_cart_updated.png).

4. **Checkout Sheet, Order `#101` Submission & Static Receipt with Scannable Bit/PayBox QR (`CUJ-03`)**:
   - **What it does**: Clicking the sticky cart bar opens the Checkout Sheet (`[data-testid="checkout-sheet"]`) with full itemized breakdown (`2 × קרואסון חמאה` `24 ₪`, `1 × קפוצ׳ינו` `16 ₪` + `חלב שיבולת שועל` + `הערה: "חם מאוד"`, total `40 ₪`). Entering customer name `"דניאל"` and phone `"054-9876543"` and clicking `שלח הזמנה • 40 ₪` submits `POST /api/orders`, persists Order `#101` in SQLite, increments `nextOrderNumber` to `102`, and renders the Static Receipt (`[data-testid="static-receipt"]`) showing:
     - Order number `#101` (`עבור דניאל • 054-9876543`)
     - Itemized summary & `40 ₪` total
     - Clickable Bit/PayBox link (`<a data-testid="receipt-qr-link" href="https://www.bitpay.co.il/app/me/0500000000">`) wrapping a `240×240` ISO/IEC 18004 scannable QR code PNG
     - Copyable payment phone `050-0000000` with copy button (`העתק מספר` → `הועתק! ✓`)
     - Above-the-fold `חזרה לתפריט` (`[data-testid="back-to-menu-btn"]`, bottom at `y = 759px < 844px`) that clears the receipt and returns to the storefront.
   - **How it was verified**:
     - **Unit Test**: `test_cuj03_checkout_order_101_and_static_receipt_qr` in [`tests/test_routes.py`](file:///Users/joshuacooper/Documents/code/courtyard-coffee/tests/test_routes.py).
     - **SQLite Persistence Check**: Verified [`db/data.db`](file:///Users/joshuacooper/Documents/code/courtyard-coffee/db/data.db) contains row `101|דניאל|054-9876543|40.0` with full bilingual item/tag/note JSON and `nextOrderNumber = 102` in `store_config`.
     - **Live Chrome DOM Telemetry**: Verified `orderNumberText === "#101"`, `qrLinkHref === "https://www.bitpay.co.il/app/me/0500000000"`, `qrNaturalWidth === 240`, `copyBtnTextAfter === "הועתק! ✓"`, `lastCopiedText === "050-0000000"`, `backToMenuBottomPx === 759` (`backToMenuVisibleInViewport === true`), and `returnedToStorefront === true`.
     - **Visual Screenshots**: [`cuj03_checkout_sheet_filled.png`](file:///Users/joshuacooper/Documents/code/courtyard-coffee/screenshots/cuj03_checkout_sheet_filled.png), [`cuj03_receipt_with_qr.png`](file:///Users/joshuacooper/Documents/code/courtyard-coffee/screenshots/cuj03_receipt_with_qr.png).

### Milestone 1 Foundation Capabilities (Still Active & Regression-Tested on Every Run)
5. **SQLite Persistence, Deterministic Seed & Monotonic Order Counter**:
   - Verified by `test_sqlite_seed_state_invariants` & `test_monotonic_next_order_number_protection` in [`tests/test_utils.py`](file:///Users/joshuacooper/Documents/code/courtyard-coffee/tests/test_utils.py) and live HTTP lifecycle proof in [`m1_smoke_report.json`](file:///Users/joshuacooper/Documents/code/courtyard-coffee/screenshots/m1_smoke_report.json).
6. **REST API Endpoints (`GET/PUT /api/store`, `GET/POST /api/orders`, `PATCH /api/orders/:id`, `POST /api/orders/reset`)**:
   - Verified by `test_get_and_put_api_store` & `test_post_and_manage_orders_lifecycle` in [`tests/test_routes.py`](file:///Users/joshuacooper/Documents/code/courtyard-coffee/tests/test_routes.py).
7. **Admin 4-Digit PIN Security Gate (`1234`) & Session Storage**:
   - Verified by [`m1_smoke_admin_pin_locked.png`](file:///Users/joshuacooper/Documents/code/courtyard-coffee/screenshots/m1_smoke_admin_pin_locked.png) and [`m1_smoke_kds_unlocked.png`](file:///Users/joshuacooper/Documents/code/courtyard-coffee/screenshots/m1_smoke_kds_unlocked.png).
8. **Core Browser Utilities (ISO/IEC 18004 QR Generator, Hebrew WhatsApp Link Builder, Web Audio Chime, 400×400 JPEG Compressor)**:
   - Verified by `test_qr_data_url_is_valid_240x240_png` & `test_whatsapp_phone_and_hebrew_url_builder` in [`tests/test_utils.py`](file:///Users/joshuacooper/Documents/code/courtyard-coffee/tests/test_utils.py), pixel-by-pixel Reed-Solomon QR decoding (`formatWordHex = 0x77C4`, `decodedPayload = "050-0000000"`), and [`m1_smoke_core_utilities.png`](file:///Users/joshuacooper/Documents/code/courtyard-coffee/screenshots/m1_smoke_core_utilities.png).

---

## 1. Complete Index of Artifacts & Conversation Logs

### A. Planning & Specification Artifacts
- **Master Implementation Plan**: [`implementation_plan.md`](file:///Users/joshuacooper/.gemini/antigravity/brain/d7a3ec9f-d77b-4283-af4d-ff6ac2aa2e89/implementation_plan.md)
- **Product & Technical Specification**: [`spec_courtyard_coffee.md`](file:///Users/joshuacooper/.gemini/antigravity/brain/9a11f9b7-4968-4ff0-9f73-f8956f462c6f/spec_courtyard_coffee.md)
- **7-CUJ Live Testing & Verification Plan**: [`live_testing_plan.md`](file:///Users/joshuacooper/.gemini/antigravity/brain/e9431844-28e0-4b4a-9793-127d96d61942/live_testing_plan.md)
- **Active Handover Artifact (UI)**: [`handover.md`](file:///Users/joshuacooper/.gemini/antigravity/brain/76acbd3f-a1ae-4038-83c8-19e5cc95f5a3/handover.md)
- **Repository Handover Document**: [`HANDOVER.md`](file:///Users/joshuacooper/Documents/code/courtyard-coffee/HANDOVER.md)

### B. Custom Subagent Definitions (`file://` Links)
> **Note when starting a new conversation**: Custom subagent definitions (`define_subagent`) are scoped to the conversation that defined them. When starting a new conversation, read these 3 files and call `define_subagent` to register them before calling `invoke_subagent`:
- **TDD Builder Definition (`tdd-builder`)**: [`tdd-builder/agent.md`](file:///Users/joshuacooper/.gemini/antigravity/brain/76acbd3f-a1ae-4038-83c8-19e5cc95f5a3/.agents/agents/tdd-builder/agent.md)
- **Critical Evidence Auditor Definition (`critical-auditor`)**: [`critical-auditor/agent.md`](file:///Users/joshuacooper/.gemini/antigravity/brain/76acbd3f-a1ae-4038-83c8-19e5cc95f5a3/.agents/agents/critical-auditor/agent.md)
- **CUJ Verifier Definition (`cuj-verifier`)**: [`cuj-verifier/agent.md`](file:///Users/joshuacooper/.gemini/antigravity/brain/76acbd3f-a1ae-4038-83c8-19e5cc95f5a3/.agents/agents/cuj-verifier/agent.md)

### C. Subagent Conversations & Transcript Logs
- **Parent Conversation (`M1`–`M2`)**: [76acbd3f-a1ae-4038-83c8-19e5cc95f5a3](conversation://76acbd3f-a1ae-4038-83c8-19e5cc95f5a3) — [`transcript.jsonl`](file:///Users/joshuacooper/.gemini/antigravity/brain/76acbd3f-a1ae-4038-83c8-19e5cc95f5a3/.system_generated/logs/transcript.jsonl)
- **Policy-Compliant Architecture Researcher**: [a24743b9-03cd-4603-a1b2-565016c2d707](conversation://a24743b9-03cd-4603-a1b2-565016c2d707) — [`transcript.jsonl`](file:///Users/joshuacooper/.gemini/antigravity/brain/a24743b9-03cd-4603-a1b2-565016c2d707/.system_generated/logs/transcript.jsonl)
- **M1/M2 TDD Builder**: [45835566-d464-4d29-b1bf-0b7eabf286fc](conversation://45835566-d464-4d29-b1bf-0b7eabf286fc) — [`transcript.jsonl`](file:///Users/joshuacooper/.gemini/antigravity/brain/45835566-d464-4d29-b1bf-0b7eabf286fc/.system_generated/logs/transcript.jsonl)
- **Milestone 1 Critical Auditor**: [94fd2253-9424-49c4-8611-d8c0817dec12](conversation://94fd2253-9424-49c4-8611-d8c0817dec12) — [`transcript.jsonl`](file:///Users/joshuacooper/.gemini/antigravity/brain/94fd2253-9424-49c4-8611-d8c0817dec12/.system_generated/logs/transcript.jsonl)
- **Milestone 2 Visual Verifier & Critical Auditor**: [f34c6921-7c4b-4bce-b500-062f5716a63a](conversation://f34c6921-7c4b-4bce-b500-062f5716a63a) — [`transcript.jsonl`](file:///Users/joshuacooper/.gemini/antigravity/brain/f34c6921-7c4b-4bce-b500-062f5716a63a/.system_generated/logs/transcript.jsonl)

### D. Telemetry JSON Reports & Screenshots (12 PNGs + 2 JSON Reports)
- **Telemetry Reports**:
  - [`screenshots/m1_smoke_report.json`](file:///Users/joshuacooper/Documents/code/courtyard-coffee/screenshots/m1_smoke_report.json)
  - [`screenshots/m2_cuj_report.json`](file:///Users/joshuacooper/Documents/code/courtyard-coffee/screenshots/m2_cuj_report.json)
- **Milestone 1 Screenshots (5 PNGs)**:
  - [`m1_smoke_customer_rtl.png`](file:///Users/joshuacooper/Documents/code/courtyard-coffee/screenshots/m1_smoke_customer_rtl.png)
  - [`m1_smoke_admin_pin_locked.png`](file:///Users/joshuacooper/Documents/code/courtyard-coffee/screenshots/m1_smoke_admin_pin_locked.png)
  - [`m1_smoke_kds_unlocked.png`](file:///Users/joshuacooper/Documents/code/courtyard-coffee/screenshots/m1_smoke_kds_unlocked.png)
  - [`m1_smoke_admin_menu.png`](file:///Users/joshuacooper/Documents/code/courtyard-coffee/screenshots/m1_smoke_admin_menu.png)
  - [`m1_smoke_core_utilities.png`](file:///Users/joshuacooper/Documents/code/courtyard-coffee/screenshots/m1_smoke_core_utilities.png)
- **Milestone 2 Screenshots (`CUJ-01..03`, 7 PNGs)**:
  - [`cuj01_initial_storefront.png`](file:///Users/joshuacooper/Documents/code/courtyard-coffee/screenshots/cuj01_initial_storefront.png)
  - [`cuj01_pastry_added.png`](file:///Users/joshuacooper/Documents/code/courtyard-coffee/screenshots/cuj01_pastry_added.png)
  - [`cuj02_bottom_sheet_open.png`](file:///Users/joshuacooper/Documents/code/courtyard-coffee/screenshots/cuj02_bottom_sheet_open.png)
  - [`cuj02_bottom_sheet_selected.png`](file:///Users/joshuacooper/Documents/code/courtyard-coffee/screenshots/cuj02_bottom_sheet_selected.png)
  - [`cuj02_cart_updated.png`](file:///Users/joshuacooper/Documents/code/courtyard-coffee/screenshots/cuj02_cart_updated.png)
  - [`cuj03_checkout_sheet_filled.png`](file:///Users/joshuacooper/Documents/code/courtyard-coffee/screenshots/cuj03_checkout_sheet_filled.png)
  - [`cuj03_receipt_with_qr.png`](file:///Users/joshuacooper/Documents/code/courtyard-coffee/screenshots/cuj03_receipt_with_qr.png)

---

## 2. Complete Codebase & Database State Index

### A. Git Tags & Commit SHAs
| Tag | Commit SHA | Summary |
| :--- | :--- | :--- |
| `m1-red` | `32edca1455b179c30e9ef29db32ef635fba4034f` | `test(m1): add failing assertions [RED]` (8 failing M1 tests) |
| `m1-green` | `de8c9403e5438b3c76a5d459b75dc379f76510c0` | `fix(m1): resolve all critical audit caveats with ISO-18004 QR and full live proofs [GREEN]` (8 passing M1 tests) |
| `m2-red` | `d15c40a6a514cc4c1a2bbc6a989446370e249760` | `test(m2): add failing assertions for CUJ-01, CUJ-02, CUJ-03 [RED]` (3 failing M2 tests, 8 passing M1 tests) |
| `m2-green` | `3992e511a4a80849a087a5ad9ba5dbf158676061` | `fix(m2): resolve M2 critical audit caveats for receipt fold, QR link, and resource telemetry [GREEN]` (11 passing M1+M2 tests) |

### B. Repository Files (`/Users/joshuacooper/Documents/code/courtyard-coffee`)
- **Backend & SQLite Persistence**:
  - [`server.py`](file:///Users/joshuacooper/Documents/code/courtyard-coffee/server.py): Single-port (`127.0.0.1:3000`) HTTP server serving REST API (`/api/store`, `/api/orders`, `/api/orders/:id`, `/api/orders/reset`), ES modules (`src/*.js`, `src/index.css`), and SPA fallback (`index.html`).
  - [`api/db.py`](file:///Users/joshuacooper/Documents/code/courtyard-coffee/api/db.py): SQLite schema (`store_config` singleton + `orders` table), atomic transactions, and monotonic `nextOrderNumber` guard (`MAX(incoming, current, MAX(order_number) + 1)`).
  - [`api/seed.py`](file:///Users/joshuacooper/Documents/code/courtyard-coffee/api/seed.py): Deterministic seed script (`nextOrderNumber = 101`, 2 items, 3 tags, 2 embedded `400×400` JPEG data URLs, `paymentPhone = "050-0000000"`, `paymentLink = "https://www.bitpay.co.il/app/me/0500000000"`).
  - [`db/data.db`](file:///Users/joshuacooper/Documents/code/courtyard-coffee/db/data.db): Live SQLite database on disk. Currently holds **Order `#101`** (`דניאל`, `054-9876543`, `40.0 ₪`, `2× Butter Croissant` + `1× Cappuccino [Oat Milk, "חם מאוד"]`, `is_notified = 0`, `is_done = 0`) and `store_config.nextOrderNumber = 102`.
- **Frontend Routes, Components & Utilities**:
  - [`index.html`](file:///Users/joshuacooper/Documents/code/courtyard-coffee/index.html), [`src/main.js`](file:///Users/joshuacooper/Documents/code/courtyard-coffee/src/main.js), [`src/index.css`](file:///Users/joshuacooper/Documents/code/courtyard-coffee/src/index.css)
  - [`src/routes/CustomerMenu.js`](file:///Users/joshuacooper/Documents/code/courtyard-coffee/src/routes/CustomerMenu.js) (Complete M2 implementation)
  - [`src/routes/KDS.js`](file:///Users/joshuacooper/Documents/code/courtyard-coffee/src/routes/KDS.js) (M1 shell — target for **Milestone 3** `CUJ-04..06` implementation)
  - [`src/routes/AdminMenu.js`](file:///Users/joshuacooper/Documents/code/courtyard-coffee/src/routes/AdminMenu.js) (M1 shell — target for **Milestone 4** `CUJ-07` implementation)
  - [`src/components/PinGateModal.js`](file:///Users/joshuacooper/Documents/code/courtyard-coffee/src/components/PinGateModal.js)
  - [`src/components/CustomerHeader.js`](file:///Users/joshuacooper/Documents/code/courtyard-coffee/src/components/CustomerHeader.js)
  - [`src/components/MenuItemCard.js`](file:///Users/joshuacooper/Documents/code/courtyard-coffee/src/components/MenuItemCard.js)
  - [`src/components/TagBottomSheet.js`](file:///Users/joshuacooper/Documents/code/courtyard-coffee/src/components/TagBottomSheet.js)
  - [`src/components/StickyCartBar.js`](file:///Users/joshuacooper/Documents/code/courtyard-coffee/src/components/StickyCartBar.js)
  - [`src/components/CheckoutSheet.js`](file:///Users/joshuacooper/Documents/code/courtyard-coffee/src/components/CheckoutSheet.js)
  - [`src/components/StaticReceipt.js`](file:///Users/joshuacooper/Documents/code/courtyard-coffee/src/components/StaticReceipt.js)
  - [`src/utils/qr.js`](file:///Users/joshuacooper/Documents/code/courtyard-coffee/src/utils/qr.js), [`src/utils/whatsapp.js`](file:///Users/joshuacooper/Documents/code/courtyard-coffee/src/utils/whatsapp.js), [`src/utils/audio.js`](file:///Users/joshuacooper/Documents/code/courtyard-coffee/src/utils/audio.js), [`src/utils/imageCompressor.js`](file:///Users/joshuacooper/Documents/code/courtyard-coffee/src/utils/imageCompressor.js)
- **Test Suites & Browser CDP Harness**:
  - [`tests/test_utils.py`](file:///Users/joshuacooper/Documents/code/courtyard-coffee/tests/test_utils.py) (6 unit tests)
  - [`tests/test_routes.py`](file:///Users/joshuacooper/Documents/code/courtyard-coffee/tests/test_routes.py) (5 route/CUJ tests)
  - [`scripts/cdp_harness.py`](file:///Users/joshuacooper/Documents/code/courtyard-coffee/scripts/cdp_harness.py) (Self-contained Python server + Headless Chrome RFC 6455 WebSocket CDP client)

---

## 3. Operational Playbook — "How to Do Things" Without Hitting Traps

1. **Zero-Node Architecture (macOS Santa Binary Policy)**:
   - **NEVER** run `node`, `npm`, `npx`, or `brew` — macOS Santa blocks unsigned/unwhitelisted Homebrew Node binaries (`exit code 137: No matching rule`).
   - Always use pre-installed Apple-signed `/usr/bin/python3` (`3.9.6`), `/usr/bin/sqlite3` (`3.43.2`), `/usr/local/git/current/bin/git`, and `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`.

2. **How to Run Unit & Route Tests (Runs Inside Sandbox, `BypassSandbox: false`)**:
   ```bash
   /usr/bin/python3 -m unittest discover -s /Users/joshuacooper/Documents/code/courtyard-coffee/tests -t /Users/joshuacooper/Documents/code/courtyard-coffee -v
   ```
   *(Always include `-t /Users/joshuacooper/Documents/code/courtyard-coffee` so `api.*` imports resolve cleanly.)*

3. **How to Reseed or Inspect SQLite Database (Runs Inside Sandbox, `BypassSandbox: false`)**:
   - Reseed to baseline (`nextOrderNumber = 101`, empty orders):
     ```bash
     /usr/bin/python3 /Users/joshuacooper/Documents/code/courtyard-coffee/api/seed.py
     ```
   - Inspect live orders & counter:
     ```bash
     /usr/bin/sqlite3 /Users/joshuacooper/Documents/code/courtyard-coffee/db/data.db "SELECT order_number, customer_name, customer_phone, total, is_notified, is_done FROM orders; SELECT json_extract(data_json, '$.nextOrderNumber') FROM store_config WHERE id = 1;"
     ```

4. **How to Run Live Browser Verification & Capture Screenshots (`BypassSandbox: true`)**:
   - `chrome-devtools-mcp` cannot be used because it invokes `npx`. Instead, [`scripts/cdp_harness.py`](file:///Users/joshuacooper/Documents/code/courtyard-coffee/scripts/cdp_harness.py) starts `server.py` on `127.0.0.1:3000`, launches `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome --headless=new --remote-debugging-port=9222`, drives all CUJs over WebSocket CDP, writes PNG screenshots to `/Users/joshuacooper/Documents/code/courtyard-coffee/screenshots/`, and outputs JSON telemetry.
   - Because Chrome requires Mach IPC (`bootstrap_check_in`) and TCP port binding, run it from the **parent agent** with `BypassSandbox: true` and keep the exact prefix `/usr/bin/python3` (no `cd ... &&`) and `toolSummary: "Run Milestone 1 CDP browser smoke harness"` so user auto-approval matches:
     ```bash
     /usr/bin/python3 /Users/joshuacooper/Documents/code/courtyard-coffee/scripts/cdp_harness.py
     ```
   - After `cdp_harness.py` writes screenshots to `/Users/joshuacooper/Documents/code/courtyard-coffee/screenshots/`, copy them to the active conversation's `<artifactDir>/scratch/screenshots/` before embedding them in markdown artifacts:
     ```bash
     /bin/cp /Users/joshuacooper/Documents/code/courtyard-coffee/screenshots/*.png <artifactDir>/scratch/screenshots/
     ```

5. **How to Use Subagents per Milestone (`tdd-builder` & `critical-auditor`)**:
   - Always spawn **fresh** subagents (`invoke_subagent`) for each milestone rather than messaging an old milestone's subagent.
   - Subagents run inside the standard sandbox (`BypassSandbox: false`): they can edit code, run `/usr/bin/python3 -m unittest ...`, query `/usr/bin/sqlite3`, and visually inspect PNGs in `/Users/joshuacooper/Documents/code/courtyard-coffee/screenshots/` via `view_file` / `read_file`. The parent agent runs `scripts/cdp_harness.py` (`BypassSandbox: true`).

---

## 4. Milestone 3 Scope & Ready-to-Paste Kickoff Prompt

### Milestone 3 Requirements (`CUJ-04`, `CUJ-05`, `CUJ-06` — Barista KDS `/admin/kds`)
1. **Red → Green TDD (`m3-red` → `m3-green`)**:
   - Add failing M3 tests in `tests/test_routes.py` / `tests/test_utils.py`, commit & tag `m3-red`.
   - Implement [`src/routes/KDS.js`](file:///Users/joshuacooper/Documents/code/courtyard-coffee/src/routes/KDS.js) (plus any helper components in `src/components/`):
     - **Top Bar**: Open/Close toggle (`[data-testid="kds-open-toggle"]`), Shift Reset button (`[data-testid="kds-shift-reset-btn"]`, `POST /api/orders/reset`), and link to `/admin/menu`.
     - **Hebrew Closed-Note Input**: `[data-testid="kds-closed-note-input"]` that **auto-persists** via `PUT /api/store` on input/change/blur (no separate Save button required during `CUJ-06`).
     - **Quick-86 Strip**: One-tap stock pills for tags (`[data-testid="quick86-tag-tag-oat"]`) and menu items (`[data-testid="quick86-item-item-croissant"]`) that immediately persist via `PUT /api/store`.
     - **2000ms Order Polling & Web Audio Chime**: Poll `GET /api/orders?status=pending` every `2000ms` while `/admin/kds` is mounted; call `playGentleChime()` (`window.__chimeCount`) when unseen order IDs arrive; expose `window.__resetKdsSeenOrders = () => seenOrderIds.clear()`.
     - **Active Tickets Grid (`[data-testid="kds-ticket-101"]`)**: Display `#101`, customer name `"דניאל"`, phone `"054-9876543"`, English item names (`2x Butter Croissant`, `1x Cappuccino`), English modifier badge (`Oat Milk`), emphasized customer note (`"חם מאוד"`), collapsible Hebrew WhatsApp text preview + copy button (`[data-testid="copy-wa-text-101"]`), and **2-step action button**:
       - Tap 1 (`isNotified === false`): `[data-testid="notify-wa-btn-101"]` (`Notify on WhatsApp`) → calls `window.open(waUrl, '_blank')` (capture in `window.__lastWindowOpenUrl`) + `PATCH /api/orders/:id` `{ isNotified: true }`.
       - Tap 2 (`isNotified === true`): `[data-testid="done-order-btn-101"]` (`Done / Pick-up`) → calls `PATCH /api/orders/:id` `{ isDone: true }` and moves `#101` to the Completed Drawer (`[data-testid="kds-completed-drawer-toggle"]`).
     - **Customer Closed & Quick-86 View (`CUJ-06` on `/`)**: When `isOpen === false`, Customer Storefront displays `[data-testid="closed-banner"]` with the custom `closedMessageHe`, hides/disables ordering CTAs on unavailable items (`אזל מהמלאי`), and allows opening `TagBottomSheet` in **read-only inspection mode** on `קפוצ׳ינו` while `isOpen === false` so the customer can see `חלב שיבולת שועל` marked `(אזל)` and disabled alongside `סירופ וניל` `(אזל)`, with the sheet's confirm CTA disabled/hidden.
2. **8 Required Screenshots (`CUJ-04`, `CUJ-05`, `CUJ-06`)**:
   - `cuj04_pin_modal_locked.png`, `cuj04_pin_modal_error.png`, `cuj04_kds_unlocked.png`
   - `cuj05_kds_active_ticket.png`, `cuj05_kds_ticket_notified.png`, `cuj05_kds_completed_drawer.png`
   - `cuj06_kds_86_and_closed.png`, `cuj06_customer_closed_and_86.png`

### Ready-to-Paste Kickoff Prompt (For a New Conversation)

```text
Continue execution of the Courtyard Coffee implementation plan at Milestone 3 (Admin 4-Digit PIN Gate & Barista KDS: CUJ-04, CUJ-05, CUJ-06) in /Users/joshuacooper/Documents/code/courtyard-coffee.

Read these files first:
1. /Users/joshuacooper/Documents/code/courtyard-coffee/HANDOVER.md
2. /Users/joshuacooper/.gemini/antigravity/brain/d7a3ec9f-d77b-4283-af4d-ff6ac2aa2e89/implementation_plan.md
3. /Users/joshuacooper/.gemini/antigravity/brain/9a11f9b7-4968-4ff0-9f73-f8956f462c6f/spec_courtyard_coffee.md
4. /Users/joshuacooper/.gemini/antigravity/brain/e9431844-28e0-4b4a-9793-127d96d61942/live_testing_plan.md
5. Subagent definitions to register via define_subagent:
   - /Users/joshuacooper/.gemini/antigravity/brain/76acbd3f-a1ae-4038-83c8-19e5cc95f5a3/.agents/agents/tdd-builder/agent.md
   - /Users/joshuacooper/.gemini/antigravity/brain/76acbd3f-a1ae-4038-83c8-19e5cc95f5a3/.agents/agents/critical-auditor/agent.md

Follow the Operational Playbook in HANDOVER.md (Zero-Node architecture using /usr/bin/python3 + sqlite3 + browser-native ES modules; never run node/npm/npx/brew; run scripts/cdp_harness.py with BypassSandbox: true), execute M3 Red -> Green TDD (tags m3-red and m3-green), capture and visually verify all 8 CUJ-04..06 screenshots, audit all claims with a fresh critical-auditor subagent, and present HITL Checkpoint 3 with a TL;DR explaining what the app can now do and how each point was verified.
```
