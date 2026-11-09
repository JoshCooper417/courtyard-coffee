# Handover — Milestone 3: Admin 4-Digit PIN Gate & Barista KDS (`CUJ-04`, `CUJ-05`, `CUJ-06`)

> [!IMPORTANT]
> **Human-in-the-Loop (HITL) Checkpoint 3 — Complete State, Artifacts & Operational Playbook**
> Milestone 1 (`M1`), Milestone 2 (`M2`: `CUJ-01..03`), and Milestone 3 (`M3`: `CUJ-04..06`) are complete, visually verified in headless Google Chrome via WebSocket CDP, and tagged in Git (`m1-red`, `m1-green`, `m2-red`, `m2-green`, `m3-red`, `m3-green`).
>
> This document links to **every planning artifact, subagent definition, subagent conversation log, screenshot, telemetry report, source file, database state, and operational command ("how to do things")** so a new conversation or subagent can execute Milestone 4 (`M4`: `CUJ-07` Admin Spreadsheet & Full End-to-End Regression) with zero missing context.

---

## TL;DR — What the App Can Now Do (& How Each Point Was Verified)

### Milestone 3 Capabilities (`CUJ-04`, `CUJ-05`, `CUJ-06`)

1. **Admin 4-Digit PIN Gate, Error Feedback & `localStorage` Persistence (`CUJ-04` on `/admin/kds` & `/admin/menu`)**:
   - **What it does**: Visiting `/admin/kds` or `/admin/menu` when `localStorage.getItem('adminPin')` does not match `store.adminPin` (`"1234"`) blocks access behind [`PinGateModal.js`](file:///Users/joshuacooper/Documents/code/courtyard-coffee/src/components/PinGateModal.js) (`[data-testid="pin-gate-modal"]`) without mounting the underlying KDS or Admin Menu views (`kdsViewPresent: false`). Submitting an incorrect PIN (`"9999"`) applies error styling (`.has-error` red border) and displays `[data-testid="pin-error"]` (`"Invalid PIN code. Please try again."`) while keeping `localStorage.getItem('adminPin') === null`. Submitting `"1234"` writes `localStorage.setItem("adminPin", "1234")`, dismisses the modal, mounts the English LTR Barista KDS (`[data-testid="kds-view"]`, `dir="ltr"`), and automatically bypasses the PIN modal on subsequent page reloads of `/admin/kds` and navigation to `/admin/menu`.
   - **How it was verified**:
     - **Python HTTP/SQLite + Static JS Contract Test**: `test_cuj04_pin_gate_modal_and_persistence_contract` in [`tests/test_routes.py`](file:///Users/joshuacooper/Documents/code/courtyard-coffee/tests/test_routes.py) verifies the `/admin/kds` and `/admin/menu` SPA HTML fallback (`HTTP 200`), `GET /api/store` `adminPin === "1234"`, and the static ES module contracts in [`PinGateModal.js`](file:///Users/joshuacooper/Documents/code/courtyard-coffee/src/components/PinGateModal.js) (`data-testid="pin-gate-modal"`, `data-testid="pin-input"`, `data-testid="pin-submit"`, `data-testid="pin-error"`, `localStorage.getItem('adminPin')`, `localStorage.setItem('adminPin', ...)`).
     - **Live Chrome DOM & Storage Telemetry** ([`m3_cuj_report.json`](file:///Users/joshuacooper/Documents/code/courtyard-coffee/screenshots/m3_cuj_report.json)): After reseeding the DB (`nextOrderNumber = 101`, empty `orders`), verified `locked.pinModalPresent === true`, `locked.kdsViewPresent === false`, `error.hasErrorClass === true`, `error.errorText === "Invalid PIN code. Please try again."`, `unlocked.kdsViewPresent === true`, `unlocked.emptyQueueStatePresent === true`, `unlocked.storedPin === "1234"`, `unlocked.chimeCountWhenEmpty === 0`, `reloadedKdsBypass.kdsViewPresent === true`, and `adminMenuBypass.adminMenuViewPresent === true`.
     - **Visual Screenshots**: [`cuj04_pin_modal_locked.png`](file:///Users/joshuacooper/Documents/code/courtyard-coffee/screenshots/cuj04_pin_modal_locked.png), [`cuj04_pin_modal_error.png`](file:///Users/joshuacooper/Documents/code/courtyard-coffee/screenshots/cuj04_pin_modal_error.png), [`cuj04_kds_unlocked.png`](file:///Users/joshuacooper/Documents/code/courtyard-coffee/screenshots/cuj04_kds_unlocked.png) (showing the unlocked empty KDS queue `No Active Tickets in Queue`).

2. **Barista KDS `2000ms` Polling, Web Audio Chime & 2-Tap Ticket Lifecycle (`CUJ-05` on `/admin/kds`)**:
   - **What it does**: [`src/routes/KDS.js`](file:///Users/joshuacooper/Documents/code/courtyard-coffee/src/routes/KDS.js) polls `GET /api/orders` every `2000ms` while mounted, tracks `seenOrderIds`, and invokes [`playGentleChime()`](file:///Users/joshuacooper/Documents/code/courtyard-coffee/src/utils/chime.js) (synthesizing a C5 `523.25Hz` → E5 `659.25Hz` Web Audio two-note chime and incrementing both `window.__chimeCount` and `window.__chimeSynthSuccessCount` after the oscillators and gain nodes are connected and started) whenever an unseen active order arrives. Active Ticket `#101` (`[data-testid="kds-ticket-101"]`) renders in English LTR with:
     - Header `#101`, status badge `"New Ticket"`, customer `"דניאל"` / `"054-9876543"`, and total `"₪40"`
     - English line items `"2x Butter Croissant"` (`₪24`) and `"1x Cappuccino"` (`₪16`) with English modifier pill `"Oat Milk"` and highlighted note `Note: "חם מאוד"` (`[data-testid="kds-ticket-note-101"]`)
     - RTL Hebrew WhatsApp message preview (`[data-testid="wa-preview-101"]`) and synchronous copy button (`[data-testid="copy-wa-text-101"]`: `"Copy Text"` → `"Copied! ✓"`, recording `window.__lastCopiedText`)
     - **Tap 1 (`Notify on WhatsApp`, `[data-testid="notify-wa-btn-101"]`)**: Builds the encoded Hebrew WhatsApp URL (`https://wa.me/972549876543?text=...`), records `window.__lastWindowOpenUrl`, invokes `window.open(...)`, and sends `PATCH /api/orders/:id` `{ isNotified: true }`, transitioning the card to `.notified` (`"✓ WhatsApp Sent"`) and revealing **Tap 2 (`Done / Pick-up`, `[data-testid="done-order-btn-101"]`)**.
     - **Tap 2 (`Done / Pick-up`, `[data-testid="done-order-btn-101"]`)**: Sends `PATCH /api/orders/:id` `{ isDone: true, status: "done" }`, removing Ticket `#101` from the active queue (`"No Active Tickets in Queue"`) and placing it into the collapsible Completed Orders Drawer (`[data-testid="kds-completed-drawer-toggle"]` → `[data-testid="completed-ticket-101"]` with `"Picked Up ✓"`).
   - **How it was verified**:
     - **Python HTTP/SQLite + Static JS Contract Test**: `test_cuj05_kds_polling_chime_and_two_tap_ticket_lifecycle` in [`tests/test_routes.py`](file:///Users/joshuacooper/Documents/code/courtyard-coffee/tests/test_routes.py) verifies the live SQLite order creation (`POST /api/order`), 2-tap `PATCH /api/orders/:id` transitions (`isNotified: true` then `isDone: true`), and the static ES module contracts in [`src/routes/KDS.js`](file:///Users/joshuacooper/Documents/code/courtyard-coffee/src/routes/KDS.js) (`2000`ms polling interval, `playGentleChime`, `buildWhatsAppUrl`, and all `data-testid` hooks).
     - **Live Chrome Telemetry & SQLite State** ([`m3_cuj_report.json`](file:///Users/joshuacooper/Documents/code/courtyard-coffee/screenshots/m3_cuj_report.json)): While `/admin/kds` was open on the empty queue, `scripts/cdp_harness.py` submitted a live `POST /api/order` for Order `#101` (`ord-101-20a093`, `liveSubmittedOrderNumber === 101`) and waited `2.5s` for the natural `2000ms` poll, verifying `chimeCountAfter2sPoll === 1` and `chimeSynthSuccessCount === 1`; `copyBtnTextBefore === "Copy Text"` → `copyBtnTextAfter === "Copied! ✓"`; `ticketBottomPx === 624 <= 800`; `lastWindowOpenUrl` starting with `https://wa.me/972549876543?text=`; SQLite `SELECT isNotified, isDone FROM orders WHERE number = 101;` transitioning from `0|0` → `1|0` (`sqliteAfterTap1`) → `1|1` (`sqliteAfterTap2`); and `completedTicketText === "#101 דניאל (054-9876543) 2x Butter Croissant • 1x Cappuccino (Oat Milk) ₪40 Picked Up ✓"`.
     - **Visual Screenshots**: [`cuj05_kds_active_ticket.png`](file:///Users/joshuacooper/Documents/code/courtyard-coffee/screenshots/cuj05_kds_active_ticket.png), [`cuj05_kds_ticket_notified.png`](file:///Users/joshuacooper/Documents/code/courtyard-coffee/screenshots/cuj05_kds_ticket_notified.png), [`cuj05_kds_completed_drawer.png`](file:///Users/joshuacooper/Documents/code/courtyard-coffee/screenshots/cuj05_kds_completed_drawer.png).

3. **Quick-86 Stock Toggling, Store Open/Close Switch & Auto-Persisting Closed Banner (`CUJ-06` on `/admin/kds` → `/`)**:
   - **What it does**: On `/admin/kds`, clicking Quick-86 pills `[data-testid="quick86-tag-tag-oat"]` (`Oat Milk`) and `[data-testid="quick86-item-item-croissant"]` (`Butter Croissant`) immediately toggles `inStock` to `false` (rendering danger-red struck-through pills with `"86'd"` badges) and persists via `PUT /api/store`. Clicking `[data-testid="kds-open-toggle"]` (`Close Store`) toggles `store.isOpen` to `false` (header badge `"CLOSED"`, button `"Open Store"`), and typing `"יצאנו להפסקת צהריים, נחזור ב-14:00"` into `[data-testid="kds-closed-note-input"]` auto-persists `closedNoteHe` via a debounced (`250ms` on `input`, immediate flush + deduplication on `change`/`blur`) `PUT /api/store` without clobbering the input during background order polling and while preserving monotonic `nextOrderNumber = 102`. Reloading `/` (`390×844` mobile RTL) displays status badge `"סגור כעת"` and `[data-testid="closed-banner"]` with `"יצאנו להפסקת צהריים, נחזור ב-14:00"`, dims `"קרואסון חמאה"` with disabled button `"אזל מהמלאי"`, and allows opening `TagBottomSheet` on `"קפוצ׳ינו"` in read-only closed inspection mode showing `"חלב שיבולת שועל (+2 ₪) (אזל)"` and `"סירופ וניל (+3 ₪) (אזל)"` disabled and struck-through above the disabled `"החנות סגורה כעת"` CTA.
   - **How it was verified**:
     - **Python HTTP/SQLite + Static JS Contract Tests**: `test_cuj06_kds_quick86_closed_note_and_store_closed_enforcement` in [`tests/test_routes.py`](file:///Users/joshuacooper/Documents/code/courtyard-coffee/tests/test_routes.py) and `test_cuj06_closed_note_alias_and_quick86_persistence` in [`tests/test_utils.py`](file:///Users/joshuacooper/Documents/code/courtyard-coffee/tests/test_utils.py) verify SQLite `PUT /api/store` persistence (`closedNoteHe`/`closedMessageHe` synchronization, `inStock: false`, `isOpen: false`), backend HTTP `400` rejection on `POST /api/order` when closed or ordering an out-of-stock item, and static ES module contracts in `KDS.js`, `Customer.js`, and `TagBottomSheet.js`.
     - **SQLite & Live Chrome Telemetry** ([`m3_cuj_report.json`](file:///Users/joshuacooper/Documents/code/courtyard-coffee/screenshots/m3_cuj_report.json)): Verified `closedNotePutRequestCount === 1` (debounced/deduplicated single `PUT /api/store` request when updating the closed note); verified SQLite `SELECT json_extract(data, '$.isOpen'), json_extract(data, '$.closedNoteHe'), json_extract(data, '$.nextOrderNumber') FROM store_state WHERE id = 1;` is `0|יצאנו להפסקת צהריים, נחזור ב-14:00|102`; verified `closedBannerBottomPx === 129`, `croissantCardBottomPx === 423`, `sheetCardTopPx === 512` (`closedBannerAndCroissantVisibleAboveSheet === true`), `oatTagDisabled === true`, `oatTagText === "חלב שיבולת שועל (+2 ₪) (אזל)"`, and `confirmBtnDisabled === true`.
     - **Visual Screenshots**: [`cuj06_kds_86_and_closed.png`](file:///Users/joshuacooper/Documents/code/courtyard-coffee/screenshots/cuj06_kds_86_and_closed.png), [`cuj06_customer_closed_and_86.png`](file:///Users/joshuacooper/Documents/code/courtyard-coffee/screenshots/cuj06_customer_closed_and_86.png).

### Milestone 1 & Milestone 2 Capabilities (Still Active & Regression-Tested on Every Run)
4. **Customer Storefront, Zero-Polling Guarantee & Inline Stepper (`CUJ-01`)**: Verified in [`m3_cuj_report.json`](file:///Users/joshuacooper/Documents/code/courtyard-coffee/screenshots/m3_cuj_report.json) (`zeroBackgroundPolls: true` over 3.1s wait) and [`cuj01_initial_storefront.png`](file:///Users/joshuacooper/Documents/code/courtyard-coffee/screenshots/cuj01_initial_storefront.png), [`cuj01_pastry_added.png`](file:///Users/joshuacooper/Documents/code/courtyard-coffee/screenshots/cuj01_pastry_added.png).
5. **Tag Customization Bottom Sheet & Dynamic Price Calculation (`CUJ-02`)**: Verified in [`cuj02_bottom_sheet_open.png`](file:///Users/joshuacooper/Documents/code/courtyard-coffee/screenshots/cuj02_bottom_sheet_open.png), [`cuj02_bottom_sheet_selected.png`](file:///Users/joshuacooper/Documents/code/courtyard-coffee/screenshots/cuj02_bottom_sheet_selected.png), [`cuj02_cart_updated.png`](file:///Users/joshuacooper/Documents/code/courtyard-coffee/screenshots/cuj02_cart_updated.png).
6. **Checkout Sheet, Order `#101` Submission & Static Receipt with `240×240` ISO-18004 Bit QR (`CUJ-03`)**: Verified in [`cuj03_checkout_sheet_filled.png`](file:///Users/joshuacooper/Documents/code/courtyard-coffee/screenshots/cuj03_checkout_sheet_filled.png), [`cuj03_receipt_with_qr.png`](file:///Users/joshuacooper/Documents/code/courtyard-coffee/screenshots/cuj03_receipt_with_qr.png).

---

## 1. Complete Index of Artifacts & Conversation Logs

### A. Planning & Specification Artifacts
- **Master Implementation Plan**: [`implementation_plan.md`](file:///Users/joshuacooper/.gemini/antigravity/brain/d7a3ec9f-d77b-4283-af4d-ff6ac2aa2e89/implementation_plan.md)
- **Product & Technical Specification**: [`spec_courtyard_coffee.md`](file:///Users/joshuacooper/.gemini/antigravity/brain/9a11f9b7-4968-4ff0-9f73-f8956f462c6f/spec_courtyard_coffee.md)
- **7-CUJ Live Testing & Verification Plan**: [`live_testing_plan.md`](file:///Users/joshuacooper/.gemini/antigravity/brain/e9431844-28e0-4b4a-9793-127d96d61942/live_testing_plan.md)
- **Active Handover Artifact (M3 UI)**: [`handover.md`](file:///Users/joshuacooper/.gemini/antigravity/brain/495a17db-e8d3-46a2-8cc7-15f5903a8cc0/handover.md)
- **Repository Handover Document**: [`HANDOVER.md`](file:///Users/joshuacooper/Documents/code/courtyard-coffee/HANDOVER.md)

### B. Custom Subagent Definitions (`file://` Links)
> **Note when starting a new conversation**: Custom subagent definitions (`define_subagent`) are scoped to the conversation that defined them. When starting a new conversation, read these files and call `define_subagent` to register them before calling `invoke_subagent`:
- **TDD Builder Definition (`tdd-builder`)**: [`tdd-builder/agent.md`](file:///Users/joshuacooper/.gemini/antigravity/brain/76acbd3f-a1ae-4038-83c8-19e5cc95f5a3/.agents/agents/tdd-builder/agent.md)
- **Critical Evidence Auditor Definition (`critical-auditor`)**: [`critical-auditor/agent.md`](file:///Users/joshuacooper/.gemini/antigravity/brain/76acbd3f-a1ae-4038-83c8-19e5cc95f5a3/.agents/agents/critical-auditor/agent.md)
- **CUJ Verifier Definition (`cuj-verifier`)**: [`cuj-verifier/agent.md`](file:///Users/joshuacooper/.gemini/antigravity/brain/76acbd3f-a1ae-4038-83c8-19e5cc95f5a3/.agents/agents/cuj-verifier/agent.md)

### C. Subagent Conversations & Transcript Logs
- **Milestone 3 Orchestrator Conversation (`M3`)**: [495a17db-e8d3-46a2-8cc7-15f5903a8cc0](conversation://495a17db-e8d3-46a2-8cc7-15f5903a8cc0) — [`transcript.jsonl`](file:///Users/joshuacooper/.gemini/antigravity/brain/495a17db-e8d3-46a2-8cc7-15f5903a8cc0/.system_generated/logs/transcript.jsonl)
- **Milestone 3 TDD Builder (`m3-red` → `m3-green`)**: [cbf754c6-1ee9-44db-a1cd-bb7939969338](conversation://cbf754c6-1ee9-44db-a1cd-bb7939969338) — [`transcript.jsonl`](file:///Users/joshuacooper/.gemini/antigravity/brain/cbf754c6-1ee9-44db-a1cd-bb7939969338/.system_generated/logs/transcript.jsonl)
- **Milestone 3 Critical Auditor**: [7bcaf2c7-fb31-4da0-8c80-dddfa3b1b2ca](conversation://7bcaf2c7-fb31-4da0-8c80-dddfa3b1b2ca) — [`transcript.jsonl`](file:///Users/joshuacooper/.gemini/antigravity/brain/7bcaf2c7-fb31-4da0-8c80-dddfa3b1b2ca/.system_generated/logs/transcript.jsonl)
- **Milestone 1–2 Parent Conversation (`M1`–`M2`)**: [76acbd3f-a1ae-4038-83c8-19e5cc95f5a3](conversation://76acbd3f-a1ae-4038-83c8-19e5cc95f5a3) — [`transcript.jsonl`](file:///Users/joshuacooper/.gemini/antigravity/brain/76acbd3f-a1ae-4038-83c8-19e5cc95f5a3/.system_generated/logs/transcript.jsonl)
- **Milestone 1 Critical Auditor**: [94fd2253-9424-49c4-8611-d8c0817dec12](conversation://94fd2253-9424-49c4-8611-d8c0817dec12) — [`transcript.jsonl`](file:///Users/joshuacooper/.gemini/antigravity/brain/94fd2253-9424-49c4-8611-d8c0817dec12/.system_generated/logs/transcript.jsonl)
- **Milestone 2 Critical Auditor**: [f34c6921-7c4b-4bce-b500-062f5716a63a](conversation://f34c6921-7c4b-4bce-b500-062f5716a63a) — [`transcript.jsonl`](file:///Users/joshuacooper/.gemini/antigravity/brain/f34c6921-7c4b-4bce-b500-062f5716a63a/.system_generated/logs/transcript.jsonl)

### D. Telemetry JSON Reports & Screenshots (20 PNGs + 3 JSON Reports)
- **Telemetry Reports**:
  - [`screenshots/m1_smoke_report.json`](file:///Users/joshuacooper/Documents/code/courtyard-coffee/screenshots/m1_smoke_report.json)
  - [`screenshots/m2_cuj_report.json`](file:///Users/joshuacooper/Documents/code/courtyard-coffee/screenshots/m2_cuj_report.json)
  - [`screenshots/m3_cuj_report.json`](file:///Users/joshuacooper/Documents/code/courtyard-coffee/screenshots/m3_cuj_report.json)
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
- **Milestone 3 Screenshots (`CUJ-04..06`, 8 PNGs)**:
  - [`cuj04_pin_modal_locked.png`](file:///Users/joshuacooper/Documents/code/courtyard-coffee/screenshots/cuj04_pin_modal_locked.png)
  - [`cuj04_pin_modal_error.png`](file:///Users/joshuacooper/Documents/code/courtyard-coffee/screenshots/cuj04_pin_modal_error.png)
  - [`cuj04_kds_unlocked.png`](file:///Users/joshuacooper/Documents/code/courtyard-coffee/screenshots/cuj04_kds_unlocked.png)
  - [`cuj05_kds_active_ticket.png`](file:///Users/joshuacooper/Documents/code/courtyard-coffee/screenshots/cuj05_kds_active_ticket.png)
  - [`cuj05_kds_ticket_notified.png`](file:///Users/joshuacooper/Documents/code/courtyard-coffee/screenshots/cuj05_kds_ticket_notified.png)
  - [`cuj05_kds_completed_drawer.png`](file:///Users/joshuacooper/Documents/code/courtyard-coffee/screenshots/cuj05_kds_completed_drawer.png)
  - [`cuj06_kds_86_and_closed.png`](file:///Users/joshuacooper/Documents/code/courtyard-coffee/screenshots/cuj06_kds_86_and_closed.png)
  - [`cuj06_customer_closed_and_86.png`](file:///Users/joshuacooper/Documents/code/courtyard-coffee/screenshots/cuj06_customer_closed_and_86.png)

---

## 2. Complete Codebase & Database State Index

### A. Git Tags & Commit SHAs
| Tag | Commit SHA | Summary |
| :--- | :--- | :--- |
| `m1-red` | `32edca1455b179c30e9ef29db32ef635fba4034f` | `test(m1): add failing assertions [RED]` (8 failing M1 tests) |
| `m1-green` | `de8c9403e5438b3c76a5d459b75dc379f76510c0` | `fix(m1): resolve all critical audit caveats with ISO-18004 QR and full live proofs [GREEN]` (8 passing M1 tests) |
| `m2-red` | `d15c40a6a514cc4c1a2bbc6a989446370e249760` | `test(m2): add failing assertions for CUJ-01, CUJ-02, CUJ-03 [RED]` (3 failing M2 tests, 8 passing M1 tests) |
| `m2-green` | `602084b4bd171d2a4fc3f4c2eafb4e09629edd54` | `docs(m2): update repository HANDOVER.md with full artifact links, state index, and operational playbook` (11 passing M1+M2 tests) |
| `m3-red` | `bc1da9336de1c5a3f16bd0fa4f787bd67c6df235` | `test(m3): add failing assertions for CUJ-04, CUJ-05, CUJ-06 [RED]` (4 failing M3 tests on `closedMessageHe` alias + M3 frontend ES module contracts; 11 passing M1+M2 tests) |
| `m3-green` | `2199d781fda4b2b4f5f2098cb2d0f244f25d9bd7` | `fix(m3): resolve all M3 critical audit caveats with live order arrival chime and debounced closed note [GREEN]` (15 passing M1+M2+M3 tests; followed on `main` by `docs(m3): update repository HANDOVER.md for Milestone 3`) |

### B. Repository Files (`/Users/joshuacooper/Documents/code/courtyard-coffee`)
- **Backend & SQLite Persistence**:
  - [`server.py`](file:///Users/joshuacooper/Documents/code/courtyard-coffee/server.py): Single-port (`127.0.0.1:3000`) HTTP server serving REST API, ES modules, and SPA fallback.
  - [`api/handler.py`](file:///Users/joshuacooper/Documents/code/courtyard-coffee/api/handler.py): Request handler for `GET/PUT /api/store`, `POST /api/order`, `GET /api/orders`, `PATCH /api/orders/:id`, and `POST /api/orders/reset`.
  - [`api/db.py`](file:///Users/joshuacooper/Documents/code/courtyard-coffee/api/db.py): SQLite schema (`store_state` singleton with `id = 1, data, updated_at` + `orders` table with `id, number, customerName, customerPhone, createdAt, total, isNotified, isDone, items`), atomic transactions, `closedNoteHe`/`closedMessageHe` synchronization, and monotonic `nextOrderNumber` guard.
  - [`api/utils.py`](file:///Users/joshuacooper/Documents/code/courtyard-coffee/api/utils.py), [`api/seed.py`](file:///Users/joshuacooper/Documents/code/courtyard-coffee/api/seed.py), [`scripts/seed.py`](file:///Users/joshuacooper/Documents/code/courtyard-coffee/scripts/seed.py): Deterministic seed script (`nextOrderNumber = 101`, 2 items, 3 tags, 2 embedded `400×400` PNG data URLs, `bitPhone = "050-0000000"`, `adminPin = "1234"`).
  - [`db/data.db`](file:///Users/joshuacooper/Documents/code/courtyard-coffee/db/data.db): Live SQLite database on disk. After completing `CUJ-01..06`, `orders` holds Order `#101` (`דניאל`, `054-9876543`, `total = 40.0`, `isNotified = 1`, `isDone = 1`) and `store_state` holds `isOpen = false`, `closedNoteHe = "יצאנו להפסקת צהריים, נחזור ב-14:00"`, `nextOrderNumber = 102`, `tag-oat.inStock = false`, and `item-croissant.inStock = false`.
- **Frontend Routes, Components & Utilities**:
  - [`index.html`](file:///Users/joshuacooper/Documents/code/courtyard-coffee/index.html), [`src/main.js`](file:///Users/joshuacooper/Documents/code/courtyard-coffee/src/main.js), [`src/state.js`](file:///Users/joshuacooper/Documents/code/courtyard-coffee/src/state.js), [`src/index.css`](file:///Users/joshuacooper/Documents/code/courtyard-coffee/src/index.css)
  - [`src/routes/Customer.js`](file:///Users/joshuacooper/Documents/code/courtyard-coffee/src/routes/Customer.js) (Complete M2 + M3 closed-store inspection implementation)
  - [`src/routes/KDS.js`](file:///Users/joshuacooper/Documents/code/courtyard-coffee/src/routes/KDS.js) (Complete M3 implementation)
  - [`src/routes/AdminMenu.js`](file:///Users/joshuacooper/Documents/code/courtyard-coffee/src/routes/AdminMenu.js) (M1 shell — target for **Milestone 4** `CUJ-07` implementation)
  - [`src/components/PinGateModal.js`](file:///Users/joshuacooper/Documents/code/courtyard-coffee/src/components/PinGateModal.js)
  - [`src/components/CustomerHeader.js`](file:///Users/joshuacooper/Documents/code/courtyard-coffee/src/components/CustomerHeader.js)
  - [`src/components/MenuItemCard.js`](file:///Users/joshuacooper/Documents/code/courtyard-coffee/src/components/MenuItemCard.js)
  - [`src/components/TagBottomSheet.js`](file:///Users/joshuacooper/Documents/code/courtyard-coffee/src/components/TagBottomSheet.js)
  - [`src/components/StickyCartBar.js`](file:///Users/joshuacooper/Documents/code/courtyard-coffee/src/components/StickyCartBar.js)
  - [`src/components/CheckoutSheet.js`](file:///Users/joshuacooper/Documents/code/courtyard-coffee/src/components/CheckoutSheet.js)
  - [`src/components/StaticReceipt.js`](file:///Users/joshuacooper/Documents/code/courtyard-coffee/src/components/StaticReceipt.js)
  - [`src/utils/qr.js`](file:///Users/joshuacooper/Documents/code/courtyard-coffee/src/utils/qr.js), [`src/utils/wa.js`](file:///Users/joshuacooper/Documents/code/courtyard-coffee/src/utils/wa.js), [`src/utils/chime.js`](file:///Users/joshuacooper/Documents/code/courtyard-coffee/src/utils/chime.js), [`src/utils/image.js`](file:///Users/joshuacooper/Documents/code/courtyard-coffee/src/utils/image.js)
- **Test Suites & Browser CDP Harness**:
  - [`tests/test_utils.py`](file:///Users/joshuacooper/Documents/code/courtyard-coffee/tests/test_utils.py) (7 unit tests)
  - [`tests/test_routes.py`](file:///Users/joshuacooper/Documents/code/courtyard-coffee/tests/test_routes.py) (8 route/CUJ tests)
  - [`scripts/cdp_harness.py`](file:///Users/joshuacooper/Documents/code/courtyard-coffee/scripts/cdp_harness.py) (Self-contained Python server + Headless Chrome RFC 6455 WebSocket CDP client driving M1 smoke + `CUJ-01..06`)

---

## 3. Operational Playbook — "How to Do Things" Without Hitting Traps

1. **Zero-Node Architecture (macOS Santa Binary Policy)**:
   - **NEVER** run `node`, `npm`, `npx`, or `brew` — macOS Santa blocks unsigned/unwhitelisted Homebrew Node binaries (`exit code 137: No matching rule`).
   - Always use pre-installed Apple-signed `/usr/bin/python3` (`3.9.6`), `/usr/bin/sqlite3` (`3.43.2`), `/usr/local/git/current/bin/git`, and `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`.

2. **How to Run Unit & Route Tests (Runs Inside Sandbox, `BypassSandbox: false`)**:
   ```bash
   /usr/bin/python3 -m unittest discover -s /Users/joshuacooper/Documents/code/courtyard-coffee/tests -t /Users/joshuacooper/Documents/code/courtyard-coffee -v
   ```

3. **How to Reseed or Inspect SQLite Database (Runs Inside Sandbox, `BypassSandbox: false`)**:
   - Reseed to baseline (`nextOrderNumber = 101`, `isOpen = true`, empty `orders`):
     ```bash
     /usr/bin/python3 /Users/joshuacooper/Documents/code/courtyard-coffee/api/seed.py
     ```
   - Inspect live orders & store state:
     ```bash
     /usr/bin/sqlite3 /Users/joshuacooper/Documents/code/courtyard-coffee/db/data.db "SELECT id, number, customerName, customerPhone, total, isNotified, isDone FROM orders; SELECT json_extract(data, '$.isOpen'), json_extract(data, '$.closedNoteHe'), json_extract(data, '$.nextOrderNumber') FROM store_state WHERE id = 1;"
     ```

4. **How to Run Live Browser Verification & Capture Screenshots (`BypassSandbox: true`)**:
   - Run [`scripts/cdp_harness.py`](file:///Users/joshuacooper/Documents/code/courtyard-coffee/scripts/cdp_harness.py) from the **parent agent** with `BypassSandbox: true`, keeping the exact prefix `/usr/bin/python3` and `toolSummary: "Run Milestone 1 CDP browser smoke harness"`:
     ```bash
     /usr/bin/python3 /Users/joshuacooper/Documents/code/courtyard-coffee/scripts/cdp_harness.py
     ```
   - Copy screenshots to the active conversation's `<artifactDir>/scratch/screenshots/` before embedding them in markdown artifacts:
     ```bash
     /bin/cp /Users/joshuacooper/Documents/code/courtyard-coffee/screenshots/*.png <artifactDir>/scratch/screenshots/
     ```

---

## 4. Milestone 4 Scope & Ready-to-Paste Kickoff Prompt

### Milestone 4 Requirements (`CUJ-07` — Admin Spreadsheet `/admin/menu` & Full End-to-End Regression)
1. **Red → Green TDD (`m4-red` → `m4-green`)**:
   - Add failing M4 tests in `tests/test_routes.py` / `tests/test_utils.py`, commit & tag `m4-red`.
   - Implement [`src/routes/AdminMenu.js`](file:///Users/joshuacooper/Documents/code/courtyard-coffee/src/routes/AdminMenu.js):
     - **Store JSON Inspector**: Displays live serialized byte size of `store` JSON (`[data-testid="json-byte-size"]`) and a collapsible/raw JSON view (`[data-testid="json-raw-preview"]`), plus Store Settings inputs (`bitPhone`, `adminPin`, `closedNoteHe`, `isOpen`) and an explicit **Save Changes** button (`[data-testid="admin-save-btn"]`, `PUT /api/store`).
     - **Photo Album Manager**: Allows entering/editing a photo label (`[data-testid="new-photo-label-input"]`) before or after file selection (`[data-testid="new-photo-file-input"]`), compresses uploaded images client-side via `compressImageFileToDataUrl(file)` (`src/utils/image.js`) into a center-cropped `400×400` `data:image/jpeg;base64,...` data URL, and adds it to `store.photoAlbum` with square thumbnail preview and delete button.
     - **Global Tags Spreadsheet Table**: Inline-editable rows for `inStock`, `nameEn`, `nameHe`, `price`, delete button, and **Add Global Tag** button (`[data-testid="add-global-tag-btn"]`).
     - **Menu Items Spreadsheet Table**: Inline-editable rows for `inStock`, `category` (`Coffee` / `Pastry`), `nameEn`, `nameHe`, `descHe`, `price`, Photo `<select>` bound to `store.photoAlbum` (`<option value="${albumItem.url}">${albumItem.label}</option>`), attached `tagIds` multi-select/checkbox pills bound to `store.globalTags`, delete button, and **Add Menu Item** button (`[data-testid="add-menu-item-btn"]`).
   - Verify all unit/route tests pass, commit & tag `m4-green`.
2. **Live Browser Verification (`CUJ-07` + Full `CUJ-01..07` Regression)**:
   - Generate a `1000×800` PNG test image (`test_upload_1000x800.png`), upload it in `/admin/menu` with label `"Iced Matcha Photo"`, verify `compressImageFileToDataUrl` produces a `400×400` `data:image/jpeg;base64,...` image, add Global Tag `"Almond Milk"` / `"חלב שקדים"` (`+2 ₪`, `inStock: true`), add Menu Item `"Iced Matcha"` / `"מאצ׳ה אייס"` (`18 ₪`, `Coffee`, `"מאצ׳ה יפנית על חלב קר"`, photo `"Iced Matcha Photo"`, tag `"Almond Milk"`), click **Save Changes**, capture `cuj07_admin_spreadsheet.png`, reload `/` on mobile (`390×844`), open `"מאצ׳ה אייס"` bottom-sheet showing `"חלב שקדים (+2 ₪)"`, and capture `cuj07_customer_new_item.png`.
   - Audit all claims with a fresh `critical-auditor` subagent, write `README.md`, and present the final walkthrough.
