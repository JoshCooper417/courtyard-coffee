# ☕ Courtyard Coffee — Formalized Agentic CUJ & Live Testing Plan

This document serves as our **Northstar Testing & Verification Plan** for [Courtyard Coffee](./spec_courtyard_coffee.md). It establishes:
1. **Local & Preview Spin-Up**: Commands, environment variables, and tunneling for live browser access.
2. **Agentic Browser Gateways & Multimodal Screenshot Inspection**: How the AI drives the browser and **visually inspects every screenshot itself** (`take_screenshot` → `read_file`).
3. **Formalized Test Specification Schema**: A standardized 4-part contract (**Set up**, **What to do**, **What output to receive**, **What to expect in the output**) applied to all 7 Core Critical User Journeys (CUJs).

---

## 1. Spinning Up a Working Demo (Local & External Access)

### 1.1 Environment Variables (`.env.local`)
```ini
DB_PATH=./db/data.db
DEFAULT_ADMIN_PIN=1234
DEFAULT_BIT_PHONE=050-0000000
```

### 1.2 Start-Up & Reset Scripts (`package.json` / `server.py`)
- `npm run db:seed` / `/usr/bin/python3 scripts/seed.py`: Resets the `orders` table and writes the canonical seed `store_state.json` into `./db/data.db`:
  - `isOpen: true`, `closedNoteHe: "סגור כעת, נשוב בקרוב"`, `bitPhone: "050-0000000"`, `adminPin: "1234"`, `nextOrderNumber: 101`
  - **Global Tags**: `tag-oat` ("Oat Milk" / "חלב שיבולת שועל", `price: 2`, `inStock: true`), `tag-decaf` ("Decaf" / "נטול קפאין", `price: 0`, `inStock: true`), `tag-syrup` ("Vanilla Syrup" / "סירופ וניל", `price: 3`, `inStock: false`)
  - **Menu Items**:
    - `item-cappuccino` (Category: `'Coffee'`, `"Cappuccino"` / `"קפוצ׳ינו"`, `price: 14`, `inStock: true`, `tagIds: ['tag-oat', 'tag-decaf', 'tag-syrup']`)
    - `item-croissant` (Category: `'Pastry'`, `"Butter Croissant"` / `"קרואסון חמאה"`, `price: 12`, `inStock: true`, `tagIds: []`)
- `/usr/bin/python3 server.py`: Starts the local dev server on `http://127.0.0.1:3000` serving both the frontend and `/api/*`.

### 1.3 Exposing for External / Mobile Access
- **Local Tunnel (`ngrok http 3000` or `npx cloudflared tunnel --url http://localhost:3000`)**: Exposes your local server over HTTPS so a human on a phone can test mobile RTL touch targets and scan the Bit QR code while watching `/admin/kds` on desktop.
- **Vercel Preview (`npx vercel`)**: Deploys a public preview URL for quick layout checks.

---

## 2. Agentic Browser Control & AI Visual Screenshot Verification

After every relevant code change, the AI agent runs the CUJ suite through a real browser and evaluates the results **autonomously** before reporting back to the human.

### 2.1 Browser Execution Gateways
1. **Chrome DevTools MCP (`chrome-devtools` skill)** / **Direct WebSocket CDP Harness (`scripts/cdp_harness.py`)**:
   - Drives a live Chrome instance using CDP commands, DOM queries, and screenshot capture.
2. **Subagent Isolation (`invoke_subagent`)**:
   - The main coding agent can delegate a full CUJ run or audit to dedicated subagents so large DOM dumps and multi-screenshot inspections happen in a clean context window.

### 2.2 How the AI Inspects Screenshots (`take_screenshot` → `read_file`)
Crucially, screenshots are **not** just passively saved for the human—**the AI must visually inspect them using its multimodal vision**:
1. At each test checkpoint, the browser tool saves a PNG to `screenshots/<cuj_id>_<step>.png`.
2. The AI immediately invokes `read_file` on the PNG.
3. By viewing the actual rendered pixels, the AI verifies things that DOM snapshots alone miss:
   - True right-to-left (`RTL`) visual alignment, Hebrew punctuation placement, and icon mirroring.
   - Absence of z-index collisions (e.g., sticky cart bar overlapping menu buttons or bottom-sheet modals getting clipped on a `390×844` mobile viewport).
   - Actual rendering of the **Bit QR-code matrix image** (confirming it is not a broken image icon or `0×0` box).
   - Proper `400×400` square aspect-ratio cropping (`object-fit: cover`) of uploaded photos.
   - Adherence to the *Garden Courtyard* color palette and typography hierarchy.

---

## 3. Formalized Test Specification Schema

Every test in our suite is defined using a strict **4-part specification format**:

```markdown
### [CUJ-ID]: [Scenario Title]
- **1. Set up**:
  - Database state, server URL, browser viewport dimensions, `localStorage` state, and open tabs.
- **2. What to do**:
  - Exact sequence of user/agent interactions (navigation, clicks, text input, uploads).
- **3. What output to receive**:
  - **Screenshots (for AI `read_file` vision check)**: Exact file paths captured at key checkpoints.
  - **DOM / CSS Snapshot**: Accessibility tree (`take_snapshot`) and computed styles (`get_css_styles`).
  - **Runtime / Network Telemetry**: Console logs, `localStorage`, and `/api/*` request/response logs.
  - **Database State**: SQLite query outputs from `./db/data.db`.
- **4. What to expect in the output**:
  - **AI Visual / Screenshot Expectations**: What the AI must verify visually when inspecting the PNG via `read_file`.
  - **DOM & Runtime Expectations**: Exact text, element states, attributes, and storage values.
  - **Network & Database Expectations**: Expected API payloads, call counts, and SQLite rows.
```

---

## 4. Core CUJ Catalog (Formal Specifications)

Below are the **7 Core CUJs** formatted in our strict 4-part specification.

---

### CUJ-01: Customer Storefront — Tag-less Pastry Instant-Add & Inline Stepper (`/`)

- **1. Set up**:
  - Run seed (`isOpen: true`, `item-croissant` has `price: 12`, `tagIds: []`, `inStock: true`).
  - Open Chrome Page 1 at `http://localhost:3000/` with a mobile viewport (`390×844`).
  - Clear `localStorage` and network request counters.

- **2. What to do**:
  1. Wait for initial menu render on `http://localhost:3000/`.
  2. Capture baseline screenshot `cuj01_initial_storefront.png`.
  3. Locate the `"קרואסון חמאה"` (Butter Croissant) card and click its **+ הוסף** button once.
  4. Capture post-click screenshot `cuj01_pastry_added.png`.
  5. Click the inline **`+`** stepper button on the Croissant card once more (increasing quantity to 2).
  6. Wait 3 seconds without interacting to observe whether any background network polling occurs.

- **3. What output to receive**:
  - **Screenshots (AI calls `read_file` on both)**:
    - `../screenshots/cuj01_initial_storefront.png`
    - `../screenshots/cuj01_pastry_added.png`
  - **DOM / CSS Snapshot**: `take_snapshot` of the storefront + `get_css_styles` on the root wrapper and sticky cart bar.
  - **Runtime / Network Telemetry**: List of all XHR/fetch requests made since navigation; `console.error` count.

- **4. What to expect in the output**:
  - **AI Visual / Screenshot Expectations (`read_file`)**:
    - In `cuj01_initial_storefront.png`: Layout is cleanly aligned right-to-left (`RTL`); Hebrew title and "Open" status banner are legible at top; *Garden Courtyard* warm cream/sage/terracotta tones are applied; menu photos sit cleanly beside Hebrew text without horizontal overflow on `390px` width.
    - In `cuj01_pastry_added.png`: **No bottom-sheet modal** is open; the Croissant card's **+ הוסף** button has visually transformed into an inline `- [ qty ] +` stepper; a sticky Cart Bar is visibly anchored at the bottom without obscuring the page's scrollability.
  - **DOM & Runtime Expectations**:
    - `document.documentElement.dir === "rtl"` (or root container `direction: rtl`).
    - Croissant stepper displays quantity `2`; Sticky Cart Bar displays `2` items and total `24 ₪`.
    - Zero `console.error` or uncaught page exceptions.
  - **Network & Database Expectations**:
    - Exactly **1** `GET /api/store` request occurred (on initial page load); **0** polling requests fired during the 3-second idle wait.

---

### CUJ-02: Customer Storefront — Tagged Coffee Customization Bottom-Sheet (`/`)

- **1. Set up**:
  - Continue from CUJ-01 (or fresh seed with `item-cappuccino` at `14 ₪`, attached to `tag-oat` [`+2 ₪`, `inStock: true`], `tag-decaf` [`+0 ₪`, `inStock: true`], and `tag-syrup` [`+3 ₪`, `inStock: false`]).
  - Browser at `http://localhost:3000/` (`390×844`).

- **2. What to do**:
  1. Locate `"קפוצ׳ינו"` (Cappuccino) and click its **+ הוסף** button.
  2. Wait for the customization bottom-sheet to animate open; capture screenshot `cuj02_bottom_sheet_open.png`.
  3. Select the `"חלב שיבולת שועל"` (Oat Milk, `+2 ₪`) tag pill.
  4. Type `"חם מאוד"` into the item note input field.
  5. Capture screenshot `cuj02_bottom_sheet_selected.png`.
  6. Click the confirm/add-to-cart button inside the bottom-sheet.
  7. Capture screenshot `cuj02_cart_updated.png`.

- **3. What output to receive**:
  - **Screenshots (AI calls `read_file` on all three)**:
    - `../screenshots/cuj02_bottom_sheet_open.png`
    - `../screenshots/cuj02_bottom_sheet_selected.png`
    - `../screenshots/cuj02_cart_updated.png`
  - **DOM Snapshot**: `take_snapshot` while the bottom-sheet is open and after it closes.

- **4. What to expect in the output**:
  - **AI Visual / Screenshot Expectations (`read_file`)**:
    - In `cuj02_bottom_sheet_open.png`: A bottom-sheet cleanly overlays the dimmed storefront; Hebrew tag pills are arranged RTL; `"סירופ וניל"` (which has `inStock: false`) is visually hidden or clearly marked unavailable/disabled.
    - In `cuj02_bottom_sheet_selected.png`: The `"חלב שיבולת שועל (+2 ₪)"` pill has a distinct active/selected visual state, and `"חם מאוד"` appears right-aligned inside the note field.
    - In `cuj02_cart_updated.png`: The bottom-sheet is completely dismissed, and the sticky Cart Bar reflects the updated item count and price (`16 ₪` for the customized Cappuccino, or `40 ₪` if combined with the 2 Croissants from CUJ-01).
  - **DOM & Runtime Expectations**:
    - Out-of-stock tag `tag-syrup` cannot be selected (`disabled` or absent from interactive DOM).
    - Confirm button updates client cart state with `{ nameEn: "Cappuccino", tagsHe: ["חלב שיבולת שועל"], note: "חם מאוד", lineTotal: 16 }`.

---

### CUJ-03: Customer Checkout, Static Receipt & Bit QR-Code Verification (`/`)

- **1. Set up**:
  - Cart contains 2× `"קרואסון חמאה"` (`24 ₪`) + 1× `"קפוצ׳ינו"` with `"חלב שיבולת שועל"` and note `"חם מאוד"` (`16 ₪`) → Total `40 ₪`.
  - Seeded `nextOrderNumber` is `101`, `bitPhone` is `"050-0000000"`.

- **2. What to do**:
  1. Click the sticky Cart Bar to open the Checkout Sheet.
  2. Fill Customer Name with `"דניאל"` and Customer Phone with `"054-9876543"`.
  3. Capture screenshot `cuj03_checkout_sheet_filled.png`.
  4. Click the Submit Order button.
  5. Wait for the Static Receipt view to render and for the QR `<img>` element to finish loading (`img.complete && img.naturalWidth > 0`).
  6. Capture screenshot `cuj03_receipt_with_qr.png`.
  7. Click the **"העתק מספר"** (Copy Phone) secondary button.

- **3. What output to receive**:
  - **Screenshots (AI calls `read_file` on both)**:
    - `../screenshots/cuj03_checkout_sheet_filled.png`
    - `../screenshots/cuj03_receipt_with_qr.png`
  - **DOM & Runtime Telemetry**:
    - `take_snapshot` of the receipt screen.
    - `evaluate_script` checking `img.complete`, `img.naturalWidth`, and `img.src` of the QR code image, plus clipboard write result.
  - **Network Log**: Captured request/response of `POST /api/order` and subsequent `GET /api/store`.
  - **Database State**: Output of `sqlite3 ./db/data.db "SELECT id, number, customerName, customerPhone, total, items FROM orders WHERE number = 101;"` and `SELECT json_extract(data, '$.nextOrderNumber') FROM store_state;`.

- **4. What to expect in the output**:
  - **AI Visual / Screenshot Expectations (`read_file`)**:
    - In `cuj03_checkout_sheet_filled.png`: Name and Phone inputs are clearly visible in RTL with the `40 ₪` summary and a prominent submit CTA.
    - In `cuj03_receipt_with_qr.png`: Order number **`#101`** is prominently displayed; both line items and the `"חלב שיבולת שועל"` tag + `"חם מאוד"` note are listed in Hebrew; **a crisp, square black-and-white QR code matrix is visibly rendered** (no broken image icon or blank box); both the QR link and Copy Phone button are visible alongside a link back to the menu.
  - **DOM & Runtime Expectations**:
    - QR `<img>` has `naturalWidth >= 150` and `src` containing the encoded Bit URL/phone.
    - Clicking Copy Phone copies `"050-0000000"` and shows visual confirmation feedback.
  - **Network & Database Expectations**:
    - `POST /api/order` returned HTTP `200/201` with `number: 101`.
    - A fresh `GET /api/store` was triggered immediately after checkout (per spec: *"fetches the latest `store_state.json` only on page load and after a successful checkout"*).
    - SQLite `orders` table has 1 row with `number = 101`, `customerName = 'דניאל'`, `total = 40`, and immutable JSON `items` snapshot; `store_state.nextOrderNumber` is now `102`.

---

### CUJ-04: Admin 4-Digit PIN Gate & Persistence (`/admin/kds` & `/admin/menu`)

- **1. Set up**:
  - Open Chrome Page 2 with a desktop viewport (`1280×800`).
  - Clear `localStorage` via `evaluate_script("localStorage.clear()")`.
  - Seeded `adminPin` is `"1234"`.

- **2. What to do**:
  1. Navigate Page 2 to `http://localhost:3000/admin/kds`.
  2. Capture screenshot `cuj04_pin_modal_locked.png`.
  3. Enter wrong PIN `"9999"` and submit.
  4. Capture screenshot `cuj04_pin_modal_error.png`.
  5. Enter valid PIN `"1234"` and submit.
  6. Capture screenshot `cuj04_kds_unlocked.png`.
  7. Reload the page (`http://localhost:3000/admin/kds`) and navigate to `http://localhost:3000/admin/menu`.

- **3. What output to receive**:
  - **Screenshots (AI calls `read_file` on all three)**:
    - `../screenshots/cuj04_pin_modal_locked.png`
    - `../screenshots/cuj04_pin_modal_error.png`
    - `../screenshots/cuj04_kds_unlocked.png`
  - **DOM & Runtime Telemetry**: `take_snapshot` before and after PIN entry; `evaluate_script("localStorage.getItem('adminPin')")`.

- **4. What to expect in the output**:
  - **AI Visual / Screenshot Expectations (`read_file`)**:
    - In `cuj04_pin_modal_locked.png`: The PIN modal blocks access; underlying KDS controls/tickets are either not rendered or completely obscured.
    - In `cuj04_pin_modal_error.png`: Clear visual error message/shake indicating invalid PIN while remaining locked.
    - In `cuj04_kds_unlocked.png`: Modal is gone and the English LTR Barista KDS interface is fully visible.
  - **DOM & Runtime Expectations**:
    - `localStorage.getItem('adminPin') === "1234"`.
    - Reloading `/admin/kds` and navigating to `/admin/menu` bypasses the PIN modal automatically.

---

### CUJ-05: Barista KDS — Audio Chime & 2-Tap Ticket Lifecycle (`/admin/kds`)

- **1. Set up**:
  - Database seeded plus Order `#101` from CUJ-03 (or inserted via `POST /api/order` while `/admin/kds` is open).
  - Page 2 authenticated at `http://localhost:3000/admin/kds` (`1280×800`, English LTR).
  - Inject Web Audio spy (`window.__chimeCount = 0`) to track `playGentleChime()` invocations alongside actual Web Audio node creation.

- **2. What to do**:
  1. Trigger a new incoming order (or let KDS poll pick up Order `#101`).
  2. Capture screenshot `cuj05_kds_active_ticket.png`.
  3. Click **Tap 1: "Notify on WhatsApp"** on Ticket `#101` (intercept `window.open` so it records the target URL without leaving the page).
  4. Capture screenshot `cuj05_kds_ticket_notified.png`.
  5. Click **Tap 2: "Done / Pick-up"** on Ticket `#101`.
  6. Open the Completed Drawer and capture screenshot `cuj05_kds_completed_drawer.png`.

- **3. What output to receive**:
  - **Screenshots (AI calls `read_file` on all three)**:
    - `../screenshots/cuj05_kds_active_ticket.png`
    - `../screenshots/cuj05_kds_ticket_notified.png`
    - `../screenshots/cuj05_kds_completed_drawer.png`
  - **DOM & Runtime Telemetry**:
    - `evaluate_script` returning `{ chimeCount: window.__chimeCount, lastWindowOpenUrl: window.__lastWindowOpenUrl }`.
    - `take_snapshot` of the active ticket grid and completed drawer.
  - **Database State**: `sqlite3 ./db/data.db "SELECT isNotified, isDone FROM orders WHERE number = 101;"`.

- **4. What to expect in the output**:
  - **AI Visual / Screenshot Expectations (`read_file`)**:
    - In `cuj05_kds_active_ticket.png`: KDS layout is clean English LTR (`dir="ltr"`); Ticket `#101` card clearly displays `"2x Butter Croissant"`, `"1x Cappuccino"`, an English tag pill `"Oat Milk"`, customer note `"חם מאוד"`, and a Hebrew WhatsApp message preview box with a copy button.
    - In `cuj05_kds_ticket_notified.png`: Ticket `#101` visually highlights that step 1 (WhatsApp notification) has been completed and emphasizes the **Done / Pick-up** button.
    - In `cuj05_kds_completed_drawer.png`: Ticket `#101` is no longer in the active tickets grid and appears inside the completed orders drawer.
  - **DOM & Runtime Expectations**:
    - `playGentleChime()` executed without Web Audio errors (`chimeCount >= 1`).
    - `lastWindowOpenUrl` starts with `https://wa.me/972549876543?text=` (proving `formatWaPhone("054-9876543")` stripped the leading `0` and prepended `972`, and `buildHebrewWhatsAppUrl` encoded the Hebrew message).
  - **Network & Database Expectations**:
    - Ticket `#101` state transitions to `isNotified = 1` after Tap 1, and `isDone = 1` after Tap 2.

---

### CUJ-06: Barista KDS — Quick-86 Stock Toggling & Store Closed Banner (`/admin/kds` → `/`)

- **1. Set up**:
  - Page 2 open at `http://localhost:3000/admin/kds` (`1280×800`).
  - Page 1 open at `http://localhost:3000/` (`390×844`).

- **2. What to do**:
  1. On `/admin/kds`, locate the **Quick-86** strip and click `"Oat Milk"` (global tag) and `"Butter Croissant"` (menu item) to toggle both out of stock (`inStock: false`).
  2. Toggle the store **Open/Close** switch to **Closed**, and edit the Hebrew closed-note input to `"יצאנו להפסקת צהריים, נחזור ב-14:00"`.
  3. Capture screenshot `cuj06_kds_86_and_closed.png`.
  4. Switch to Page 1 (`http://localhost:3000/`), reload the page, and capture screenshot `cuj06_customer_closed_and_86.png`.

- **3. What output to receive**:
  - **Screenshots (AI calls `read_file` on both)**:
    - `../screenshots/cuj06_kds_86_and_closed.png`
    - `../screenshots/cuj06_customer_closed_and_86.png`
  - **DOM Snapshot**: `take_snapshot` of Page 1 after reload.
  - **Database State**: `sqlite3 ./db/data.db "SELECT json_extract(data, '$.isOpen'), json_extract(data, '$.closedNoteHe') FROM store_state;"`.

- **4. What to expect in the output**:
  - **AI Visual / Screenshot Expectations (`read_file`)**:
    - In `cuj06_kds_86_and_closed.png`: `"Oat Milk"` and `"Butter Croissant"` chips on the Quick-86 bar show an unmistakable struck-through / 86'd visual style; store header indicator shows **CLOSED**.
    - In `cuj06_customer_closed_and_86.png`: Customer storefront prominently displays the closed banner with `"יצאנו להפסקת צהריים, נחזור ב-14:00"`; `"קרואסון חמאה"` appears visually dimmed/sold-out; order submission is disabled.
  - **DOM & Runtime Expectations**:
    - Croissant add button is disabled/unavailable; opening Cappuccino's tags shows `"חלב שיבולת שועל"` is unavailable.
  - **Network & Database Expectations**:
    - SQLite `store_state` reflects `isOpen: 0` (`false`), updated `closedNoteHe`, and `inStock: false` on both `"tag-oat"` and `"item-croissant"`.

---

### CUJ-07: Admin Spreadsheet — 400×400 Photo Compression & Menu/Tag CRUD (`/admin/menu` → `/`)

- **1. Set up**:
  - Run seed (`isOpen: true`).
  - Generate a temporary `1000×800` PNG test image at `../screenshots/test_upload_1000x800.png`.
  - Open Page 2 at `http://localhost:3000/admin/menu` (`1280×800`, authenticated with PIN `"1234"`).

- **2. What to do**:
  1. In the **Photo Album Manager**, upload `test_upload_1000x800.png` with label `"Iced Matcha Photo"`.
  2. In the **Global Tags Table**, add a new row: `nameEn: "Almond Milk"`, `nameHe: "חלב שקדים"`, `price: 2`, `inStock: true`.
  3. In the **Menu Items Table**, add a new row: `category: "Coffee"`, `nameEn: "Iced Matcha"`, `nameHe: "מאצ׳ה אייס"`, `descHe: "מאצ׳ה יפנית על חלב קר"`, `price: 18`, `inStock: true`, select `"Iced Matcha Photo"` from the photo picker, and attach `"Almond Milk"` via the tags picker.
  4. Save changes and capture screenshot `cuj07_admin_spreadsheet.png`.
  5. Reload Page 1 (`http://localhost:3000/`), scroll to `"מאצ׳ה אייס"`, click **+ הוסף** to open its bottom-sheet, and capture screenshot `cuj07_customer_new_item.png`.

- **3. What output to receive**:
  - **Screenshots (AI calls `read_file` on both)**:
    - `../screenshots/cuj07_admin_spreadsheet.png`
    - `../screenshots/cuj07_customer_new_item.png`
  - **Runtime Telemetry**: `evaluate_script` inspecting the uploaded photo's Data URL prefix (`data:image/jpeg;base64,...`) and decoded `naturalWidth` × `naturalHeight`.
  - **DOM Snapshot**: Store JSON Inspector text (`size` and raw JSON view).

- **4. What to expect in the output**:
  - **AI Visual / Screenshot Expectations (`read_file`)**:
    - In `cuj07_admin_spreadsheet.png`: The Store JSON Inspector shows a valid byte-size readout; the Photo Album thumbnail renders a square preview; the Global Tags and Menu Items spreadsheet tables cleanly display the new `"Almond Milk"` and `"Iced Matcha"` rows without layout overflow.
    - In `cuj07_customer_new_item.png`: The Customer storefront displays `"מאצ׳ה אייס"` with its square thumbnail and `18 ₪` price, and its open bottom-sheet shows `"חלב שקדים (+2 ₪)"`.
  - **DOM & Runtime Expectations**:
    - `compressImageFileToDataUrl()` converted the `1000×800` PNG into a `data:image/jpeg;base64,...` string with exact dimensions `400×400`.
  - **Network & Database Expectations**:
    - SQLite `store_state` JSON contains the new photo album entry, the new global tag, and the new menu item.
