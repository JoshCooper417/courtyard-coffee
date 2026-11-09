# Courtyard Coffee (`קפה בחצר`) — Agent Rules & Project Context

This file (`AGENTS.md`) is automatically loaded by Antigravity and coding agents operating in this repository to provide consistent architectural, security, and operational guardrails.

---

## 1. Host Environment & Zero-Node Constraint (Critical)

- **macOS Santa Policy**: Unsigned Homebrew/Node binaries (`node`, `npm`, `npx`, `brew`) are blocked by macOS Santa (`santad`) with `SIGKILL` (`exit code 137`).
- **Sanctioned Tooling Only**:
  - Python: `/usr/bin/python3` (standard library only — zero external `pip` dependencies)
  - SQLite CLI: `/usr/bin/sqlite3`
  - Git CLI: `/usr/local/git/current/bin/git`
  - Headless Browser (CDP): `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`

---

## 2. Architecture & Key Files

- **Live Production Deployment**: https://courtyard-coffee.vercel.app/ (auto-deployed from `https://github.com/JoshCooper417/courtyard-coffee` `branch: main`)
- **Backend HTTP & Serverless Entrypoint**:
  - [`server.py`](./server.py): Local `ThreadingHTTPServer` listening on `http://127.0.0.1:3000`.
  - [`api/handler.py`](./api/handler.py): `CourtyardRequestHandler` serving `/api/*` REST endpoints, static ES modules (`/src/*`), and SPA fallback routing (`/admin/kds`, `/admin/menu`, `/` → `index.html`).
  - [`api/index.py`](./api/index.py) & [`vercel.json`](./vercel.json): Vercel `@vercel/python` Serverless Function entrypoint and SPA route rewrites.
- **Dual-Mode Database Layer ([`api/db.py`](./api/db.py))**:
  - **Local Mode (`TURSO_DATABASE_URL` unset)**: Uses `sqlite3` at `./db/data.db` (`WAL` mode, `BEGIN IMMEDIATE` transactions).
  - **Production Cloud Mode (`TURSO_DATABASE_URL` + `TURSO_AUTH_TOKEN` set)**: Uses `_TursoConnection` (stdlib `urllib.request`) against Turso's `/v2/pipeline` HTTPS API.
  - **Monotonic Order Counter Invariant**: `save_store_state()` (`PUT /api/store`) never allows a stale admin payload to roll `nextOrderNumber` backward (`max(current_next, max_existing_order_number + 1, incoming_next)`). Only `reset_orders()` (`POST /api/orders/reset`) resets `nextOrderNumber` to `101`.
- **Frontend SPA (Zero-Build Native ES Modules)**:
  - [`src/main.js`](./src/main.js) & [`src/state.js`](./src/state.js): Client router, cart state, and API client (`getAdminHeaders()` attaches `X-Admin-Pin`).
  - [`src/routes/Customer.js`](./src/routes/Customer.js): Hebrew RTL (`dir="rtl"`) customer storefront (`/`), zero background polling, inline untagged stepper, `TagBottomSheet`, `CheckoutSheet`, and `StaticReceipt` with `240×240` ISO-18004 Bit QR code.
  - [`src/routes/KDS.js`](./src/routes/KDS.js): English LTR (`dir="ltr"`) Barista Kitchen Display System (`/admin/kds`), `2000ms` order polling, Web Audio API chime, 2-tap WhatsApp → Done ticket workflow, Quick-86 stock pills, and auto-saving closed banner note.
  - [`src/routes/AdminMenu.js`](./src/routes/AdminMenu.js): English LTR (`dir="ltr"`) Admin Menu & Settings (`/admin/menu`), Store JSON Inspector, `400×400` JPEG Canvas photo compressor, and inline Global Tags / Menu Items spreadsheets.

---

## 3. Security & Secrets Hygiene

- **Never Commit Secrets**: Never write `TURSO_AUTH_TOKEN`, `TURSO_DATABASE_URL`, or production credentials into tracked files. `.env.local` and `db/*.db*` must remain in [`.gitignore`](./.gitignore).
- **Admin PIN Protection (`X-Admin-Pin`)**:
  - Client admin routes (`/admin/kds`, `/admin/menu`) are gated by [`src/components/PinGateModal.js`](./src/components/PinGateModal.js) (`localStorage.getItem("adminPin")`).
  - Server write endpoints (`PUT /api/store`, `PATCH /api/orders/:id`, `POST /api/orders/reset`) verify `X-Admin-Pin` via `_verify_admin_pin()` in [`api/handler.py`](./api/handler.py) (enforced whenever the header is sent, or unconditionally when `REQUIRE_ADMIN_PIN=1` is set in production).

---

## 4. Verification & Deployment Playbook

1. **Fast Unit, Route & Contract Suite (19 Tests — Run Before Every Commit)**:
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
