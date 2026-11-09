# 📄 Courtyard Coffee – Final Specification & Handoff Checklist

Below is the **complete, lightweight spec** that incorporates all of your clarifications, followed by a **comprehensive TODO list** that will drive the next three conversation phases:

1. **E2E testing strategy planning**
2. **Scaffolding a minimal skeleton + verifying it works**
3. **Full implementation**

---

## 1️⃣ High‑Level Architecture

| Item | Decision |
|------|----------|
| **Hosting** | **Vercel** – static front‑end + serverless API routes (Node / TS) for the tiny SQLite write‑endpoint (order insert). |
| **Data store** | **SQLite** (`better-sqlite3`), stored as a single file (`store_state.json` inside the DB). SQLite gives atomic reads/writes with virtually zero setup. |
| **Authentication** | **4‑digit PIN** only. Stored in `localStorage` after the first successful entry; all admin routes (`/admin/*`) are gated behind a modal that validates the PIN. |
| **Customer UI** | **Hebrew‑only**, `dir="rtl"` throughout. **No live updates** – the client fetches the latest `store_state.json` only on page load and after a successful checkout. |
| **Payment UI** | **Bit QR‑code** displayed on the static receipt screen. Clicking the QR opens the Bit URL; a secondary button copies the Bit phone number. |
| **Design system** | *Garden Courtyard* palette & typography (see Section 4 of the spec). All styling done via Tailwind CSS + CSS variables – no heavy UI libraries. |
| **Utilities** | `playGentleChime()`, `compressImageFileToDataUrl()`, `formatWaPhone()` + `buildHebrewWhatsAppUrl()` – ship as plain TS modules (no extra dependencies). |

---

## 2️⃣ Data Contracts (unchanged, but reiterated)

```ts
// store_state.json – the single source of truth
export interface StoreStateDocument {
  isOpen: boolean;
  closedNoteHe: string;
  bitPhone: string;          // URL or phone number
  adminPin: string;          // 4‑digit string (plain text, stored only in UI)
  nextOrderNumber: number;
  photoAlbum: PhotoAlbumItem[];
  globalTags: GlobalOptionTag[];
  menuItems: MenuItem[];
}
export interface PhotoAlbumItem { id: string; label: string; url: string; }
export interface GlobalOptionTag {
  id: string; nameEn: string; nameHe: string; price: number; inStock: boolean;
}
export interface MenuItem {
  id: string; category: 'Coffee' | 'Pastry';
  nameEn: string; nameHe: string; descHe: string;
  price: number; inStock: boolean; photo: string; tagIds: string[];
}

// immutable order snapshot (insert‑only)
export interface OrderTicket {
  id: string; number: number;
  customerName: string; customerPhone: string;
  createdAt: string; total: number;
  isNotified: boolean; isDone: boolean;
  items: OrderLineSnapshot[];
}
export interface OrderLineSnapshot {
  nameEn: string; nameHe: string;
  qty: number; lineTotal: number;
  tagsEn: string[]; tagsHe: string[];
  note: string;
}
```

*All reads (`SELECT`) are made against `store_state.json`. The only write operation is an `INSERT` into the `orders` table.*

---

## 3️⃣ UI Flow Summary

### 3.1 Customer Storefront (`/`) – Hebrew RTL
1. **Header** – shop title & open/closed banner (dynamic based on `isOpen`).
2. **Menu list** – each row shows photo, Hebrew name, description, price, and **+ הוסף** button.
   - **No tags** → instant add + inline stepper.
   - **Has tags** → opens bottom‑sheet for tag selection (customization).
3. **Sticky cart bar** → opens checkout sheet (name + phone).
4. **Checkout** → **INSERT** immutable order, increment `nextOrderNumber`, clear cart, trigger KDS chime.
5. **Static receipt** – displays order number, details, **Bit QR‑code** & copy‑phone button, link back to menu.

### 3.2 Barista KDS (`/admin/kds`) – English LTR
- Open/Close toggle, shift‑reset button, Hebrew closed‑note editor.
- **Quick‑86** strip (global tags + menu items) toggles `inStock`.
- **Audio chime** on new order (Web Audio).
- **Active tickets grid** – English names, tag pills, note, WhatsApp preview (+ copy button).
- **2‑tap actions**: *Notify on WhatsApp* (opens `wa.me` link) → *Done/Pick‑up* (moves ticket to completed drawer).

### 3.3 Admin Spreadsheet (`/admin/menu`) – English LTR
- **Store JSON inspector** (size & raw view).
- **Photo album manager** (client‑side 400×400 JPEG compressor).
- **Global Tags table** (stock toggle, bilingual names, price delta, delete).
- **Menu Items table** (stock, photo picker, bilingual names/desc, category, price, attached tags picker, row add/delete).

All admin pages are protected by the 4‑digit PIN modal.

---

## 4️⃣ Technical Implementation Blueprint (high‑level)

| Layer | Tech | Reason |
|-------|------|--------|
| **Front‑end** | **React + Vite + TypeScript** | Small bundle, fast dev loop, works on Vercel static hosting. |
| **Styling** | **Tailwind CSS + CSS variables** | Quick theming with the Garden Courtyard palette, no heavy UI libs. |
| **Routing** | **React Router** (3 routes: `/`, `/admin/kds`, `/admin/menu`) |
| **State** | **Zustand** (or simple React context) for client‑side caching of `store_state`. |
| **Back‑end** | **Vercel Serverless Functions** (Node / TS) exposing two endpoints: <br>• `GET /api/store` – returns the JSON document. <br>• `POST /api/order` – validates payload, inserts immutable snapshot into SQLite, returns order number. |
| **Database** | **SQLite** (`better-sqlite3`) – one file (e.g., `data.db`) with two tables: `store_state` (single row JSON) and `orders`. |
| **Utilities** | Plain TS modules (no external deps) – chime, image compressor, WhatsApp builder. |
| **QR Generation** | Use Google Chart API (`https://chart.googleapis.com/chart?chs=200x200&cht=qr&chl=BIT_URL`) – rendered as an `<img>` on receipt. (No server‑side generation needed.) |
| **Testing** | **Jest + React Testing Library** for unit/UI tests; later **Playwright** for E2E (see plan). |
| **CI/CD** | GitHub Actions – lint, type‑check, run Jest, build Vercel preview, deploy on merge. |

---

## 5️⃣ Handoff – Detailed TODO List

### A️⃣ Planning the E2E Testing Strategy (next conversation)
| # | Goal | Key Points to Cover |
|---|------|---------------------|
| A‑1 | Choose framework | **Playwright** (Chromium/Firefox/WebKit) – supports RTL, keyboard, and file‑upload. |
| A‑2 | Define test environments | • Local dev (Docker compose with SQLite) <br>• Vercel preview deployment (public URL) |
| A‑3 | Map critical user journeys | 1️⃣ Customer order flow (untagged & tagged items) <br>2️⃣ Barista KDS notification & ticket lifecycle <br>3️⃣ Admin spreadsheet tag addition & stock toggling <br>4️⃣ QR‑code appearance & copy‑to‑clipboard <br>5️⃣ PIN‑gate enforcement |
| A‑4 | Data‑reset strategy | Script that wipes `orders` table & restores `store_state.json` to a known seed before each test run. |
| A‑5 | Reporting & CI integration | Collect Playwright HTML report, upload as artifact, fail CI on any regression. |
| A‑6 | Accessibility checks (optional) | Verify RTL layout, focus order, button labels (Hebrew). |

> **Outcome:** A written test plan (markdown) and a **playwright.config.ts** skeleton ready to be dropped into the repo.

### B️⃣ Scaffolding the Skeleton + Verifying It Works
| # | Deliverable | Description |
|---|-------------|-------------|
| B‑1 | Repo layout (tree) | ```<br>courtyard‑coffee/<br>│─ package.json<br>│─ tsconfig.json<br>│─ vite.config.ts<br>│─ src/<br>│  ├─ index.html<br>│  ├─ main.tsx<br>│  ├─ App.tsx<br>│  ├─ routes/<br>│  │  ├─ Customer.tsx<br>│  │  ├─ KDS.tsx<br>│  │  └─ AdminMenu.tsx<br>│  ├─ api/<br>│  │  ├─ store.ts (GET)<br>│  │  └─ order.ts (POST)<br>│  └─ utils/ (chime, image, wa)<br>│─ public/<br>│  └─ favicon…<br>│─ serverless/<br>│  ├─ getStore.ts<br>│  └─ postOrder.ts<br>│─ db/<br>│  └─ data.db<br>│─ tailwind.config.js<br>│─ .gitignore<br>``` |
| B‑2 | Minimal UI components | *Header*, *MenuItemCard*, *CartBar*, *Receipt* (with QR). No data fetching yet – static mock data to prove layout. |
| B‑3 | PIN modal stub | Simple modal that accepts any 4‑digit code and stores it in `localStorage`. |
| B‑4 | Serverless API stubs | Return a static `store_state.json` for GET; POST validates shape and returns a fake order number. |
| B‑5 | Verify on Vercel preview | Deploy the skeleton to a Vercel preview URL, ensure all three routes load, and QR image renders, and PIN modal blocks admin pages. |
| B‑6 | Unit test bootstrap | Add one Jest test per route that renders the component and checks for key text (e.g., “קפה בחצר”). |
| B‑7 | Documentation | `README.md` with **how to run locally** (`npm i && npm run dev`) and **how to deploy to Vercel** (`vercel`). |

> **Outcome:** A **Git repo** (or zip) that a developer can clone, run `npm run dev`, and see a working UI with mock data; a Vercel preview is live and passes the stub unit tests.

### C️⃣ Full Implementation (future)
| # | Feature | Notes / Dependencies |
|---|---------|----------------------|
| C‑1 | Persistent store_state JSON | SQLite `store_state` table (single JSON row). Write helpers (`loadStore`, `saveStore`). |
| C‑2 | Customer ordering flow | Fetch store state, handle instant‑add & bottom‑sheet tag selection, cart logic, POST order. |
| C‑3 | Barista KDS ticket handling | Server‑sent order notifications via **polling** (`/api/orders?since=timestamp`) – acceptable because live updates are forbidden for customers. |
| C‑4 | Admin spreadsheet (editable tables) | Inline‑edit components, batch `UPDATE store_state` on row changes. |
| C‑5 | QR‑code generation | Use Google Chart API URL (no extra lib). |
| C‑6 | Audio chime integration | Import `playGentleChime` and call on new order arrival. |
| C‑7 | PIN persistence & lockout | Store hashed PIN? (plain is okay per spec) in `localStorage`; optional lockout after 5 failures. |
| C‑8 | Full test suite | Expand Jest unit tests + Playwright E2E covering all A‑4 journeys. |
| C‑9 | CI/CD pipeline | GitHub Actions: lint → unit tests → build → Vercel preview → deploy on merge. |
| C‑10 | Accessibility / i18n audit | Ensure RTL spacing, proper `<label>` elements, aria‑labels for buttons (Hebrew). |
| C‑11 | Documentation & hand‑over | Detailed `CONTRIBUTING.md`, deployment checklist, troubleshooting guide. |

---

## 6️⃣ Next Conversation Blueprint

| Phase | What we’ll do together |
|-------|------------------------|
| **(a) Planning an E2E testing strategy in depth** | Flesh out the Playwright test matrix, decide on data‑seeding scripts, and draft the markdown test plan. |
| **(b) Scaffolding a skeleton + testing it** | Generate the repo tree, add minimal components, push a Vercel preview, write the first Jest tests, and verify the QR code works. |
| **(c) Implementing** | Fill in the real data layer, complete all UI flows, integrate the PIN gate, and expand the test suite. |
