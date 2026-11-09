# 🚀 Courtyard Coffee (`קפה בחצר`) — Deployment Planning Handover

This handover bridges the completed **Milestones 1–4 implementation** (`CUJ-01` – `CUJ-07`) into the next phase: **Planning and executing production deployment (Vercel, persistent database state, environment configuration, and live smoke verification)**.

---

## 1. Current Repository, Production Deployment & Verification Baseline

- **Live Production URL (Vercel + Turso Serverless SQLite)**: https://courtyard-coffee.vercel.app/
- **GitHub Repository**: https://github.com/JoshCooper417/courtyard-coffee (`branch: main`)
- **Local Workspace**: `/Users/joshuacooper/Documents/code/courtyard-coffee`
- **All 4 Implementation Milestones + Production Deployment Complete (`m1-red` .. `m4-green` + `main`)**:
  - **Unit, Route & Contract Suite**: `19 / 19` passing (`/usr/bin/python3 -m unittest discover -s tests -t . -v`)
  - **Live Headless Chrome CDP Suite (`CUJ-01` – `CUJ-07`)**: `100%` passing (`/usr/bin/python3 scripts/cdp_harness.py`), with 23 screenshots and 4 JSON telemetry reports committed in [`screenshots/`](../screenshots/).
  - **Post-Deploy Live Production Smoke Suite**: `100%` passing (`/usr/bin/python3 scripts/smoke_prod.py` against `https://courtyard-coffee.vercel.app`).
- **Reference Documentation in Repo**:
  - [`README.md`](../README.md) — Architecture, API endpoints, and local quickstart
  - [`HANDOVER.md`](../HANDOVER.md) — Full M1–M4 engineering handover & audit matrix
  - [`docs/spec_courtyard_coffee.md`](./spec_courtyard_coffee.md) — Product & Technical Specification
  - [`docs/implementation_plan.md`](./implementation_plan.md) — 4-Milestone TDD Implementation Plan
  - [`docs/live_testing_plan.md`](./live_testing_plan.md) — 7-CUJ Formalized Browser Testing Plan
  - [`docs/walkthrough.md`](./walkthrough.md) — Visual Walkthrough of `CUJ-01` – `CUJ-07`

---

## 2. Host Machine Constraints (Important for Local CLI Tooling)

1. **macOS Santa Policy (Zero-Node Local Environment)**:
   - On this Mac, **macOS Santa (`santad`) blocks unsigned/unwhitelisted Node/Homebrew binaries (`node`, `npm`, `npx`, `brew`) with `SIGKILL` (`exit code 137`)**.
   - Consequently, `npx vercel` cannot be executed locally unless deployed via:
     - **GitHub-Connected Deployment** (connecting `JoshCooper417/courtyard-coffee` directly in the Vercel / Railway web dashboard so every `git push origin main` deploys automatically), or
     - **Python / `curl` REST API Scripts** calling the Vercel / Turso / Railway HTTPS APIs directly using `/usr/bin/python3` (`3.9.6`).
2. **Zero-Build Native ES Module Frontend**:
   - [`index.html`](../index.html) and [`src/`](../src/) use native browser ES modules (`<script type="module" src="/src/main.js"></script>`).
   - **Advantage for Cloud Deployment**: No `npm run build` step is required on the server or locally—static files (`index.html` and `src/**`) can be served directly by any CDN or static host with SPA fallback routing (`/* -> /index.html`).

---

## 3. Core Architectural Decisions to Resolve in the Deployment Plan

### Decision 1: Hosting & Persistent Database Strategy (Why Local SQLite Needs a Cloud Adapter on Vercel)

Currently, [`api/db.py`](../api/db.py) writes to a local SQLite file (`./db/data.db`, tables `store_state` and `orders`).
- **The Serverless File Caveat**: On **Vercel Serverless Functions**, the filesystem is read-only except `/tmp`, and `/tmp` is **ephemeral** (wiped across cold starts and isolated between function instances). If a customer submits an order on their phone (`POST /api/order`) and the barista's tablet polls `GET /api/orders` on a different serverless instance or after a cold start, a `/tmp/data.db` file will lose orders or menu edits.

Below are the **two recommended production architectures** to choose between:

| Option | Architecture | How It Works | Pros & Trade-offs |
| :--- | :--- | :--- | :--- |
| **Option A (Recommended for Vercel)** | **Vercel (GitHub Auto-Deploy) + Turso (Serverless SQLite over HTTP) or Upstash/Vercel KV** | • Connect `JoshCooper417/courtyard-coffee` to Vercel.<br>• Add `vercel.json` routing `/api/*` to a Python Vercel Serverless Function entrypoint and `/admin/*` to `/index.html`.<br>• Add a thin HTTPS SQL adapter in [`api/db.py`](../api/db.py) using Python stdlib `urllib.request`: when `TURSO_DATABASE_URL` + `TURSO_AUTH_TOKEN` are set, `api/db.py` executes the exact same `store_state` and `orders` SQL statements against Turso's HTTP pipeline API; when unset, it uses local `sqlite3` (`./db/data.db`). | • **100% Free Tier** on both Vercel and Turso.<br>• Zero external Python pip dependencies needed (Turso HTTP API works via stdlib `urllib.request`).<br>• Preserves all 17 local `sqlite3` unit tests unchanged.<br>• Instant global CDN for static assets + automatic previews on PRs. |
| **Option B (Single-Process Container)** | **Railway / Render / Fly.io with Mounted Persistent Volume** | • Connect `JoshCooper417/courtyard-coffee` to Railway or Render.<br>• Run `/usr/bin/python3 server.py` (listening on `$PORT`, `0.0.0.0`) with a persistent disk volume mounted at `/data` (`DB_PATH=/data/data.db`). | • **Zero code changes to `api/db.py`** — uses real WAL-mode SQLite file on a persistent volume.<br>• Single always-warm instance (no serverless cold starts on KDS `2000ms` polling).<br>• Requires a platform that supports persistent volumes (e.g., Railway / Fly.io / Render paid disk). |

---

### Decision 2: Required Configuration Files for Deployment

#### If Deploying to Vercel (Option A):
1. **`vercel.json`**:
   - Route `/api/store`, `/api/order`, `/api/orders`, `/api/orders/:id`, and `/api/orders/reset` to a Vercel Python Serverless Function entrypoint (`api/index.py` subclassing `BaseHTTPRequestHandler` and delegating to [`api/handler.py`](../api/handler.py)).
   - Rewrite SPA client routes (`/admin/kds`, `/admin/menu`) to `/index.html`.
2. **Dual-Mode Persistence in [`api/db.py`](../api/db.py)**:
   - Keep `sqlite3` (`./db/data.db`) as the default when `TURSO_DATABASE_URL` is not set.
   - When `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` are present in environment variables, execute atomic batch SQL statements (`BEGIN`, `SELECT`, `INSERT`/`UPDATE`, `COMMIT`) over Turso's `/v2/pipeline` HTTPS endpoint using stdlib `urllib.request`.
3. **Environment Variables (Vercel Dashboard)**:
   - `DEFAULT_ADMIN_PIN` (e.g. production 4-digit PIN)
   - `DEFAULT_BIT_PHONE` (real Bit phone number for QR & copy button)
   - `TURSO_DATABASE_URL` & `TURSO_AUTH_TOKEN`

#### If Deploying to a Container Host with Persistent Volume (Option B):
1. **`server.py` Host Binding**:
   - Update `server.py` so `HOST = os.environ.get("HOST", "0.0.0.0")` when `PORT` is injected by the cloud runtime (while keeping `127.0.0.1` default locally).
2. **`Dockerfile` / `Procfile` / `railway.json`**:
   - Minimal `python:3.11-slim` container running `python3 server.py` with `DB_PATH=/data/data.db`.

---

### Decision 3: Security & Production Hardening Checklist
1. **Admin Authentication Header / Server-Side PIN Validation (Optional Hardening)**:
   - Currently, the 4-digit PIN gate is enforced client-side via `PinGateModal.js` (per spec Section 1: *"4-digit PIN only. Stored in `localStorage` after the first successful entry"*).
   - For public internet deployment, decide whether `PUT /api/store`, `PATCH /api/orders/:id`, and `POST /api/orders/reset` should also verify an `X-Admin-Pin` header against the stored `adminPin` (while allowing `adminPin` rotation when the current PIN matches).
2. **Payload Size & Rate Guard**:
   - `api/handler.py` already enforces a `2 MB` body limit and `400×400` JPEG client compression (`~12 KB` per photo).
3. **Production Seed / Initial Store Setup**:
   - Automatic schema initialization + default seed on first boot (`init_db()` in `api/db.py` already seeds only if `store_state` row `id = 1` does not exist), allowing live menu/photo edits via `/admin/menu` without being overwritten on redeploy.

---

## 4. Starter Prompt for the New Conversation

Copy and paste the block below to start the new conversation:

```markdown
We have completed all 4 implementation milestones (`CUJ-01`..`CUJ-07`) for Courtyard Coffee (`קפה בחצר`) in `/Users/joshuacooper/Documents/code/courtyard-coffee` (pushed to https://github.com/JoshCooper417/courtyard-coffee).

Please read these handover and architecture files first:
1. `/Users/joshuacooper/Documents/code/courtyard-coffee/docs/deployment_handover.md`
2. `/Users/joshuacooper/Documents/code/courtyard-coffee/HANDOVER.md`
3. `/Users/joshuacooper/Documents/code/courtyard-coffee/README.md`
4. `/Users/joshuacooper/Documents/code/courtyard-coffee/server.py`
5. `/Users/joshuacooper/Documents/code/courtyard-coffee/api/handler.py`
6. `/Users/joshuacooper/Documents/code/courtyard-coffee/api/db.py`

Let's plan and execute the production deployment of Courtyard Coffee (Vercel + persistent storage vs. container host, configuration files, production environment variables, and live deployment verification).
```
