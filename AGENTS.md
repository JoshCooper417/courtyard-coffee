# Courtyard Coffee (`קפה בחצר`) — Product Requirements (PRD), Architecture & Agent Rules

This file (`AGENTS.md`) is automatically loaded into the context of every coding agent operating in this repository. It contains the complete **Product Requirements Document (PRD)**, **Data Contracts**, **7 Critical User Journeys (`CUJ-01` – `CUJ-07`)**, **Design System**, **Technical Architecture**, and **Operational Playbook**.

---

## 1. Product Requirements Document (PRD)

### 1.1 Product Overview & Surfaces
Courtyard Coffee (`קפה בחצר`) is a bilingual neighborhood cafe ordering and operations web app with three distinct surfaces:
1. **Customer Storefront (`/`) — Mobile-First Hebrew RTL (`dir="rtl"`)**:
   - **Zero Background Polling**: Fetches `GET /api/store` **only** on initial page load and after a completed checkout (`setInterval` polling is strictly prohibited on `/`).
   - **Header & Open/Closed State**: Displays shop title (`קפה בחצר`), open/closed badge, and dynamic Hebrew closed banner (`closedNoteHe`) when `isOpen === false`.
   - **Untagged vs. Tagged Menu Items**:
     - Items with `tagIds.length === 0` (e.g., `"קרואסון חמאה"`, `₪12`): Clicking **+ הוסף** adds immediately to cart and transforms the button into an inline `- [ qty ] +` stepper without opening a modal.
     - Items with `tagIds.length > 0` (e.g., `"קפוצ׳ינו"`, `₪14`): Clicking **+ הוסף** opens `TagBottomSheet` (`[data-testid="tag-bottom-sheet"]`) with selectable modifier tag pills, `(אזל)` disabled state for out-of-stock tags, optional Hebrew kitchen note (`[data-testid="item-note-input"]`), and dynamic CTA price (`"הוסף להזמנה • 16 ₪"`).
     - When `isOpen === false`, tagged items still allow read-only modifier inspection in `TagBottomSheet` with a disabled `"החנות סגורה כעת"` CTA.
   - **Sticky Cart Bar & Checkout (`CheckoutSheet` → `StaticReceipt`)**:
     - Anchored bottom bar (`[data-testid="sticky-cart-bar"]`) showing item count (`פריטים`) and total (`₪`).
     - Checkout collects customer name (`[data-testid="checkout-name-input"]`) and Israeli mobile phone (`[data-testid="checkout-phone-input"]`), submitting `POST /api/order`.
     - Renders `StaticReceipt` (`[data-testid="static-receipt"]`) displaying immutable order number (`#101`), line items, a genuine `240×240` ISO/IEC 18004 Bit payment QR code PNG (`[data-testid="receipt-qr-img"]`), one-tap Bit phone copy button (`"העתק מספר"` → `"הועתק! ✓"`), and `"חזרה לתפריט"` reset button.

2. **Barista Kitchen Display System (`/admin/kds`) — Tablet/Desktop English LTR (`dir="ltr"`)**:
   - **PIN Gate (`PinGateModal`)**: Protected by 4-digit PIN (`store.adminPin`, default `"1234"`), persisted in `localStorage.getItem("adminPin")` after unlock.
   - **Live Order Queue (`2000ms` Polling + Web Audio Chime)**:
     - Polls `GET /api/orders` every `2000ms` and synthesizes a gentle two-note C5 (`523.25Hz`) → E5 (`659.25Hz`) Web Audio API chime (`playGentleChime()`) when a new active order arrives.
     - Displays tickets with English item names (`"2x Butter Croissant"`, `"1x Cappuccino"`), English modifier tag pills (`"Oat Milk"`), customer note, and a Hebrew RTL WhatsApp ready-message preview box with one-tap copy (`"Copy Text"` → `"Copied! ✓"`).
   - **2-Tap Ticket Workflow**:
     - **Tap 1 (`Notify on WhatsApp`)**: Opens `https://wa.me/972...` with URL-encoded Hebrew readiness message and patches `isNotified: true` (`PATCH /api/orders/:id`), swapping the primary CTA to terracotta **Done / Pick-up**.
     - **Tap 2 (`Done / Pick-up`)**: Patches `isDone: true, status: "done"`, moving the ticket out of the active queue into the collapsible **Completed Orders Drawer**.
   - **Barista Operations Strip**:
     - **Store Open/Close Toggle** (`[data-testid="kds-open-toggle"]`) and **Shift Reset (`Reset Shift (101)`)** (`POST /api/orders/reset`).
     - **Closed Banner Note (`[data-testid="kds-closed-note-input"]`)**: Debounced auto-saving Hebrew RTL input (`PUT /api/store`).
     - **Quick-86 Strip (`[data-testid="kds-quick86-strip"]`)**: One-tap stock toggles (`In Stock` ↔ `86'd`) for all global modifier tags and menu items.

3. **Admin Menu Spreadsheet & Photo Album (`/admin/menu`) — Desktop English LTR (`dir="ltr"`)**:
   - Protected by `PinGateModal`.
   - **Store Settings & Store JSON Inspector**: Inline editors for `isOpen`, `bitPhone`, `adminPin`, and `closedNoteHe`, plus live UTF-8 byte counter (`new Blob([JSON.stringify(store)]).size` in `[data-testid="json-byte-size"]`) and collapsible raw JSON preview.
   - **Photo Album Manager (`400×400` JPEG 0.82)**: Client-side HTML5 `<canvas>` center-crop compressor (`compressImageFileToDataUrl(file, 400, 0.82)`), editable photo labels, and delete with cascade unlink from menu items.
   - **Global Modifier Tags & Menu Items Spreadsheets**: Inline editable tables for stock, category (`Coffee` | `Pastry`), bilingual names (`nameEn`, `nameHe`), Hebrew description (`descHe`), price (`₪`), photo album `<select>`, attached modifier tag pills, row addition, and row deletion, persisted via explicit **Save Changes** (`PUT /api/store`).

---

### 1.2 Canonical Data Contracts

```ts
export interface StoreStateDocument {
  isOpen: boolean;
  closedNoteHe: string;
  bitPhone: string;          // Bit payment phone or URL (e.g. "050-0000000")
  adminPin: string;          // 4-digit staff PIN (default "1234")
  nextOrderNumber: number;   // Monotonically increasing counter (starts at 101)
  photoAlbum: PhotoAlbumItem[];
  globalTags: GlobalOptionTag[];
  menuItems: MenuItem[];
}

export interface PhotoAlbumItem {
  id: string;
  label: string;
  url: string;               // 400x400 data:image/jpeg;base64,... or data:image/png;base64,...
}

export interface GlobalOptionTag {
  id: string;
  nameEn: string;
  nameHe: string;
  price: number;
  inStock: boolean;
}

export interface MenuItem {
  id: string;
  category: "Coffee" | "Pastry";
  nameEn: string;
  nameHe: string;
  descHe: string;
  price: number;
  inStock: boolean;
  photo: string;
  photoId?: string;
  tagIds: string[];
}

export interface OrderTicket {
  id: string;
  number: number;            // e.g. 101
  customerName: string;
  customerPhone: string;
  createdAt: string;         // ISO-8601 UTC timestamp
  total: number;             // Server-authoritative total in NIS (₪)
  isNotified: boolean;
  isDone: boolean;
  items: OrderLineSnapshot[];
}

export interface OrderLineSnapshot {
  itemId: string;
  nameEn: string;
  nameHe: string;
  qty: number;
  unitPrice: number;
  lineTotal: number;
  tagsEn: string[];
  tagsHe: string[];
  selectedTagIds: string[];
  note: string;
}
```

---

### 1.3 *Garden Courtyard* Design System (`src/index.css`)
- **Color Tokens**:
  - `--bg-courtyard: #FAF6F0` (warm limestone cream background)
  - `--color-sage: #3F624D` (primary actions, active badges, selected pills)
  - `--color-terracotta: #C86D51` (secondary/step-2 KDS actions, warm accents)
  - `--text-espresso: #261C18` (high-contrast body & heading text)
- **Layout Invariants**:
  - Customer `/` renders in `dir="rtl"` (`lang="he"`) with zero horizontal overflow on `390×844` mobile viewports.
  - Admin `/admin/kds` and `/admin/menu` render in `dir="ltr"` (`lang="en"`).

---

### 1.4 The 7 Core Critical User Journeys (`CUJ-01` – `CUJ-07`)
Every feature change must preserve 100% compliance across all 7 CUJs (formalized in [`docs/live_testing_plan.md`](./docs/live_testing_plan.md) and automated in [`scripts/cdp_harness.py`](./scripts/cdp_harness.py)):
- **`CUJ-01`**: Customer Storefront (`/`) — Tag-less pastry (`item-croissant`) instant-add, inline `- [ qty ] +` stepper (`qty = 2`, `24 ₪`), and 3-second idle zero-polling verification (`__storeFetchCount === 1`).
- **`CUJ-02`**: Customer Storefront (`/`) — Tagged coffee (`item-cappuccino`) customization in `TagBottomSheet`, disabled out-of-stock tag (`tag-syrup` `(אזל)`), selecting `tag-oat` (`+2 ₪`), entering Hebrew note `"חם מאוד"`, and updating cart total to `40 ₪`.
- **`CUJ-03`**: Customer Checkout (`/`) — Submitting Order `#101` (`"דניאל"`, `"054-9876543"`), verifying database row persistence + `nextOrderNumber === 102`, rendering `StaticReceipt` with `240×240` ISO-18004 Bit QR code and one-tap phone copy (`"הועתק! ✓"`).
- **`CUJ-04`**: Admin PIN Gate (`/admin/kds`, `/admin/menu`) — Blocking unauthenticated access with `PinGateModal`, rejecting invalid PIN `"0000"` with error message, unlocking with `"1234"`, and persisting in `localStorage` across reloads and admin routes.
- **`CUJ-05`**: Barista KDS (`/admin/kds`) — `2000ms` polling, Web Audio chime synthesis on incoming order, WhatsApp ready-message preview & copy, Tap 1 (`Notify on WhatsApp` → `isNotified = 1`), and Tap 2 (`Done / Pick-up` → `isDone = 1`, moves to Completed Orders Drawer).
- **`CUJ-06`**: Barista KDS Stock & Store Controls (`/admin/kds` → `/`) — Quick-86 toggling `tag-oat` and `item-croissant`, closing store (`isOpen = false`), debounced auto-save of Hebrew closed note, and verifying closed banner + disabled ordering on customer storefront.
- **`CUJ-07`**: Admin Menu Spreadsheet & Photo Album (`/admin/menu` → `/`) — Live Store JSON byte size inspector, uploading a `1000×800` PNG compressed client-side to a `400×400` JPEG (`0.82`), CRUD on Global Tags (`Almond Milk` / `חלב שקדים`, `+2 ₪`) and Menu Items (`Iced Matcha` / `מאצ׳ה אייס`, `18 ₪`), saving via `PUT /api/store`, and verifying the new item + tag on the customer storefront.

---

## 2. Host Environment & Zero-Node Constraint (Critical)

- **macOS Santa Policy**: Unsigned Homebrew/Node binaries (`node`, `npm`, `npx`, `brew`) are blocked by macOS Santa (`santad`) with `SIGKILL` (`exit code 137`).
- **Sanctioned Tooling Only**:
  - Python: `/usr/bin/python3` (standard library only — zero external `pip` dependencies)
  - SQLite CLI: `/usr/bin/sqlite3`
  - Git CLI: `/usr/local/git/current/bin/git`
  - Headless Browser (CDP): `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`

---

## 3. Technical Architecture & Dual-Mode Database

- **Live Production Deployment**: https://courtyard-coffee.vercel.app/ (auto-deployed from `https://github.com/JoshCooper417/courtyard-coffee` `branch: main`)
- **Backend HTTP & Serverless Entrypoint**:
  - [`server.py`](./server.py): Local `ThreadingHTTPServer` listening on `http://127.0.0.1:3000`.
  - [`api/handler.py`](./api/handler.py): `CourtyardRequestHandler` serving `/api/*` REST endpoints, static ES modules (`/src/*`), and SPA fallback routing (`/admin/kds`, `/admin/menu`, `/` → `index.html`).
  - [`api/index.py`](./api/index.py) & [`vercel.json`](./vercel.json): Vercel `@vercel/python` Serverless Function entrypoint and SPA route rewrites.
- **Dual-Mode Database Layer ([`api/db.py`](./api/db.py))**:
  - **Local Mode (`TURSO_DATABASE_URL` unset)**: Uses `sqlite3` at `./db/data.db` (`WAL` mode, `BEGIN IMMEDIATE` transactions).
  - **Production Cloud Mode (`TURSO_DATABASE_URL` + `TURSO_AUTH_TOKEN` set)**: Uses `_TursoConnection` (stdlib `urllib.request`) against Turso's `/v2/pipeline` HTTPS API.
  - **Monotonic Order Counter Invariant**: `save_store_state()` (`PUT /api/store`) never allows a stale admin payload to roll `nextOrderNumber` backward (`max(current_next, max_existing_order_number + 1, incoming_next)`). Only `reset_orders()` (`POST /api/orders/reset`) resets `nextOrderNumber` to `101`.

---

## 4. Security & Secrets Hygiene

- **Never Commit Secrets**: Never write `TURSO_AUTH_TOKEN`, `TURSO_DATABASE_URL`, or production credentials into tracked files. `.env.local` and `db/*.db*` must remain in [`.gitignore`](./.gitignore).
- **Admin PIN Protection (`X-Admin-Pin`)**:
  - Client admin routes (`/admin/kds`, `/admin/menu`) are gated by [`src/components/PinGateModal.js`](./src/components/PinGateModal.js) (`localStorage.getItem("adminPin")`).
  - Server write endpoints (`PUT /api/store`, `PATCH /api/orders/:id`, `POST /api/orders/reset`) verify `X-Admin-Pin` via `_verify_admin_pin()` in [`api/handler.py`](./api/handler.py) (enforced whenever the header is sent, or unconditionally when `REQUIRE_ADMIN_PIN=1` is set in production).

---

## 5. Verification & Deployment Playbook

1. **Fast Unit, Route & Contract Suite (24 Tests — Run Before Every Commit)**:
   ```bash
   /usr/bin/python3 -m unittest discover -s /Users/joshuacooper/Documents/code/courtyard-coffee/tests -t /Users/joshuacooper/Documents/code/courtyard-coffee -v
   ```
2. **Full Local Headless Chrome CDP 7-CUJ Suite (`CUJ-01` – `CUJ-07`)**:
   ```bash
   /usr/bin/python3 /Users/joshuacooper/Documents/code/courtyard-coffee/scripts/cdp_harness.py
   ```
3. **Push to GitHub (Triggers Automatic Vercel Deployment)**:
   ```bash
   /usr/local/git/current/bin/git -C /Users/joshuacooper/Documents/code/courtyard-coffee add -A
   /usr/local/git/current/bin/git -C /Users/joshuacooper/Documents/code/courtyard-coffee commit -m "Describe your change"
   /usr/local/git/current/bin/git -C /Users/joshuacooper/Documents/code/courtyard-coffee push origin main
   ```
4. **Post-Deploy Live Production Smoke Check (`https://courtyard-coffee.vercel.app`)**:
   ```bash
   /usr/bin/python3 /Users/joshuacooper/Documents/code/courtyard-coffee/scripts/smoke_prod.py
   ```

---

## 6. Agent Operations Notes

### 6.1 Local Server & CDP Harness Require Network Access
The local Python server (`server.py` on `:3000`) and the CDP E2E harness (`scripts/cdp_harness.py`) both require localhost networking. When running from an agent sandbox, these commands need network access (e.g., `BypassSandbox: true`). The CDP harness launches headless Chrome which may expose multiple targets (extensions, background pages). Always filter for `type === "page"` with the `127.0.0.1:3000` URL when connecting via Chrome's `/json` endpoint.

### 6.2 Checking GitHub Issues
The `gh` CLI is unavailable (blocked by macOS Santa). To fetch open issues, use `/usr/bin/python3` with `urllib.request` against `https://api.github.com/repos/JoshCooper417/courtyard-coffee/issues`. This requires network access and a `User-Agent` header.

### 6.3 Artifact & Screenshot Quality
Before presenting a review artifact with screenshots to the user:
- Verify screenshot file size is > 50KB (a blank page is ~2–3KB).
- Have a subagent review the artifact for accuracy and completeness before showing it.
- For before/after comparisons, capture the "before" from `main` before switching to the fix branch.
