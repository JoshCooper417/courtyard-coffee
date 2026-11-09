# ☕ Courtyard Coffee (`קפה בחצר`)

A mobile-first Hebrew RTL ordering storefront (`/`), English LTR Barista Kitchen Display System (`/admin/kds`), and English LTR Admin Menu Spreadsheet & Photo Album Manager (`/admin/menu`) built on a **Zero-Node Python + SQLite + Vanilla ES Modules** architecture.

---

## 1. Architecture & Zero-Node Runtime

To run reliably on macOS environments where unsigned Homebrew/Node binaries are restricted by Santa policy, Courtyard Coffee uses **zero external runtime dependencies**:
- **HTTP Server & REST API**: Pure Python standard library (`http.server.ThreadingHTTPServer` in [`server.py`](file:///Users/joshuacooper/Documents/code/courtyard-coffee/server.py) and [`api/handler.py`](file:///Users/joshuacooper/Documents/code/courtyard-coffee/api/handler.py)) listening on `http://127.0.0.1:3000`.
- **Database**: Synchronous SQLite (`sqlite3` stdlib in [`api/db.py`](file:///Users/joshuacooper/Documents/code/courtyard-coffee/api/db.py)) stored in [`db/data.db`](file:///Users/joshuacooper/Documents/code/courtyard-coffee/db/data.db) with `WAL` journaling and `BEGIN IMMEDIATE` atomic transactions.
- **Frontend SPA**: Native browser ES Modules ([`src/main.js`](file:///Users/joshuacooper/Documents/code/courtyard-coffee/src/main.js), [`src/state.js`](file:///Users/joshuacooper/Documents/code/courtyard-coffee/src/state.js)) styled with the *Garden Courtyard* design system ([`src/index.css`](file:///Users/joshuacooper/Documents/code/courtyard-coffee/src/index.css)).
- **Pure-JS/Python Core Utilities**:
  - **ISO/IEC 18004 QR Code Generator** ([`src/utils/qr.js`](file:///Users/joshuacooper/Documents/code/courtyard-coffee/src/utils/qr.js), [`api/utils.py`](file:///Users/joshuacooper/Documents/code/courtyard-coffee/api/utils.py)): Encodes the store's Bit payment phone/URL into a genuine `240×240` Version 2-L (`25×25`) QR PNG with GF(2^8) Reed-Solomon error correction (`data:image/png;base64,...`).
  - **Client-Side 400×400 Image Compressor** ([`src/utils/image.js`](file:///Users/joshuacooper/Documents/code/courtyard-coffee/src/utils/image.js)): Center-crops uploaded images and encodes a `400×400` JPEG (`quality = 0.82`, `data:image/jpeg;base64,...`) via HTML5 Canvas.
  - **Web Audio API Chime Synthesizer** ([`src/utils/chime.js`](file:///Users/joshuacooper/Documents/code/courtyard-coffee/src/utils/chime.js)): Synthesizes a two-note C5 (`523.25Hz`) → E5 (`659.25Hz`) chime on incoming KDS orders.
  - **Israeli WhatsApp Deep-Link Builder** ([`src/utils/wa.js`](file:///Users/joshuacooper/Documents/code/courtyard-coffee/src/utils/wa.js), [`api/utils.py`](file:///Users/joshuacooper/Documents/code/courtyard-coffee/api/utils.py)): Normalizes local phone numbers (`054-9876543` → `972549876543`) and builds URL-encoded Hebrew order-ready notifications.

---

## 2. Routes & Critical User Journeys (`CUJ-01` – `CUJ-07`)

| Route | Direction | Description & Verified CUJs |
| :--- | :--- | :--- |
| `/` | Hebrew RTL (`dir="rtl"`) | **Customer Storefront** ([`src/routes/Customer.js`](file:///Users/joshuacooper/Documents/code/courtyard-coffee/src/routes/Customer.js)): Zero background polling (`GET /api/store` only on initial load and post-checkout); instant inline `- [ qty ] +` stepper for untagged items (`CUJ-01`); `TagBottomSheet` modifier customization & kitchen notes (`CUJ-02`); `CheckoutSheet` order submission, `StaticReceipt` `#101` with `240×240` Bit QR & one-tap phone copy (`CUJ-03`); closed-store banner & read-only tag inspection (`CUJ-06`). |
| `/admin/kds` | English LTR (`dir="ltr"`) | **Barista Kitchen Display System** ([`src/routes/KDS.js`](file:///Users/joshuacooper/Documents/code/courtyard-coffee/src/routes/KDS.js)): Protected by 4-digit `PinGateModal` (`CUJ-04`); polls `GET /api/orders` every `2000ms` with Web Audio chime on new order arrival; 2-tap ticket workflow (**Tap 1: Notify on WhatsApp** → **Tap 2: Done / Pick-up** into Completed Orders Drawer, `CUJ-05`); Quick-86 stock toggling for tags/items, store Open/Close switch, and debounced auto-persisting Hebrew closed note (`CUJ-06`). |
| `/admin/menu` | English LTR (`dir="ltr"`) | **Admin Menu Spreadsheet & Photo Album** ([`src/routes/AdminMenu.js`](file:///Users/joshuacooper/Documents/code/courtyard-coffee/src/routes/AdminMenu.js)): Protected by `PinGateModal` (`CUJ-04`); Store Settings & live Store JSON Inspector (`new Blob([JSON.stringify(store)]).size` byte counter + collapsible raw JSON view); Photo Album Manager with `400×400` JPEG client-side compression; Global Modifier Tags & Menu Items inline spreadsheets with photo dropdown & attached tag pills (`CUJ-07`). |

---

## 3. SQLite Schema & REST API Endpoints

### 3.1 SQLite Tables (`./db/data.db`)

```sql
CREATE TABLE IF NOT EXISTS store_state (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    data TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    number INTEGER NOT NULL,
    customerName TEXT NOT NULL,
    customerPhone TEXT NOT NULL,
    createdAt TEXT NOT NULL,
    total REAL NOT NULL,
    isNotified INTEGER NOT NULL DEFAULT 0,
    isDone INTEGER NOT NULL DEFAULT 0,
    items TEXT NOT NULL
);
```

### 3.2 REST API Contract

- `GET /api/store` — Returns the singleton `StoreStateDocument` JSON from `store_state`.
- `PUT /api/store` — Atomically merges and normalizes store updates (`isOpen`, `closedNoteHe`, `bitPhone`, `adminPin`, `photoAlbum`, `globalTags`, `menuItems`) while enforcing **monotonic `nextOrderNumber` protection**:
  `max(current_next, max_existing_order_number + 1, incoming_next)`.
- `POST /api/order` — Validates store open state and item stock, computes server-authoritative item/tag totals, inserts an immutable `OrderTicket` row into `orders`, increments `nextOrderNumber`, and returns `201 Created`.
- `GET /api/orders` — Lists orders ordered by `number ASC` (supports optional `?status=pending` or `?status=done`).
- `PATCH /api/orders/:id` — Updates `isNotified` and/or `isDone` (`status: "done" | "pending"`) for a ticket.
- `POST /api/orders/reset` — Shift-reset endpoint clearing `orders` and resetting `nextOrderNumber` to `101`.

---

## 4. Quick Start, Testing & Live Browser Verification

### 4.1 Reseed Database to Canonical Baseline
```bash
/usr/bin/python3 /Users/joshuacooper/Documents/code/courtyard-coffee/scripts/seed.py
```

### 4.2 Start the Local Server (`http://127.0.0.1:3000`)
```bash
/usr/bin/python3 /Users/joshuacooper/Documents/code/courtyard-coffee/server.py
```

### 4.3 Run the Unit, Route & Contract Test Suite (19 Tests)
```bash
/usr/bin/python3 -m unittest discover -s /Users/joshuacooper/Documents/code/courtyard-coffee/tests -t /Users/joshuacooper/Documents/code/courtyard-coffee -v
```

### 4.4 Run the End-to-End Headless Chrome CDP Verification Suite (`M1` + `CUJ-01..07`)
Starts `server.py`, launches headless Google Chrome, executes M1 smoke tests and all 7 Critical User Journeys (`CUJ-01` through `CUJ-07`), captures 22 PNG screenshots in `screenshots/`, and writes full telemetry to `screenshots/m4_cuj_report.json`:
```bash
/usr/bin/python3 /Users/joshuacooper/Documents/code/courtyard-coffee/scripts/cdp_harness.py
```

---

## 5. Production Deployment (Vercel + Turso Serverless SQLite)

Courtyard Coffee is pre-configured for zero-dependency deployment on **Vercel** (`vercel.json` + `api/index.py`) backed by **Turso Serverless SQLite** over HTTPS (`/v2/pipeline` via Python stdlib `urllib.request` in `api/db.py`).

### 5.1 Dual-Mode Database Persistence (`api/db.py`)
- **Local Development & CI (`TURSO_DATABASE_URL` unset)**: Uses local `sqlite3` at `./db/data.db` (or `/tmp/courtyard_coffee.db` on Vercel preview deployments before Turso is connected).
- **Production Cloud (`TURSO_DATABASE_URL` + `TURSO_AUTH_TOKEN` set)**: Automatically routes all SQL queries (`store_state` and `orders`) over HTTPS to Turso's `/v2/pipeline` endpoint (`_TursoConnection`) with zero external Python packages required.

### 5.2 Admin PIN Header Security (`X-Admin-Pin`)
- The frontend (`src/state.js` `getAdminHeaders()`) automatically attaches the unlocked `X-Admin-Pin` header to all admin write requests (`PUT /api/store`, `PATCH /api/orders/:id`, `POST /api/orders/reset`).
- `api/handler.py` validates `X-Admin-Pin` against the active store's `adminPin` whenever the header is present (or unconditionally when `REQUIRE_ADMIN_PIN=1` is set in environment variables).

### 5.3 Vercel Environment Variables
Configure the following in **Vercel Dashboard → Project Settings → Environment Variables**:
| Variable | Description | Example |
| :--- | :--- | :--- |
| `TURSO_DATABASE_URL` | Turso database URL (`libsql://` or `https://`) | `libsql://courtyard-coffee-yourorg.turso.io` |
| `TURSO_AUTH_TOKEN` | Turso database read/write JWT token | `eyJhbGciOiJFZERTQSI...` |
| `DEFAULT_ADMIN_PIN` | Initial 4-digit staff PIN on first seed | `1234` |
| `DEFAULT_BIT_PHONE` | Initial Bit phone number for QR & copy button | `050-0000000` |
| `REQUIRE_ADMIN_PIN` | Set to `1` to strictly require `X-Admin-Pin` on all admin writes | `1` |

### 5.4 Pushing Updates to GitHub & Automatic Vercel Deployment
Because `JoshCooper417/courtyard-coffee` is connected to Vercel (`https://courtyard-coffee.vercel.app/`), every push to `main` automatically deploys to production:

```bash
# 1. Run the 19-test unit & route suite locally before pushing
/usr/bin/python3 -m unittest discover -s /Users/joshuacooper/Documents/code/courtyard-coffee/tests -t /Users/joshuacooper/Documents/code/courtyard-coffee -v

# 2. Check status (note: .env.local and db/*.db* are gitignored so secrets/local DB are never committed)
/usr/local/git/current/bin/git -C /Users/joshuacooper/Documents/code/courtyard-coffee status -s

# 3. Stage, commit, and push to origin/main (triggers automatic Vercel production deploy)
/usr/local/git/current/bin/git -C /Users/joshuacooper/Documents/code/courtyard-coffee add -A
/usr/local/git/current/bin/git -C /Users/joshuacooper/Documents/code/courtyard-coffee commit -m "Describe your change"
/usr/local/git/current/bin/git -C /Users/joshuacooper/Documents/code/courtyard-coffee push origin main
```


