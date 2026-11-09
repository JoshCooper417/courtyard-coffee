# Handover — Milestone 4 (Final): Admin Spreadsheet & Photo Album Manager (`CUJ-07`) & Full `CUJ-01..07` Regression

> [!IMPORTANT]
> **Human-in-the-Loop (HITL) Checkpoint 4 (Final Walkthrough) — Complete State, Artifacts & Operational Playbook**
> All 4 Milestones (`M1` through `M4`) and all 7 Critical User Journeys (`CUJ-01` through `CUJ-07`) are complete, verified in headless Google Chrome via WebSocket CDP, backed by 17 passing `unittest` unit/route/contract tests, and tagged in Git (`m1-red`, `m1-green`, `m2-red`, `m2-green`, `m3-red`, `m3-green`, `m4-red`, `m4-green`).

---

## TL;DR — What the App Can Now Do Across All 7 CUJs (& How Each Point Was Verified)

### Milestone 4 Capabilities (`CUJ-07` on `/admin/menu` → `/`)

1. **Store Settings & Live Store JSON Inspector (`CUJ-07` on `/admin/menu`)**:
   - **What it does**: [`src/routes/AdminMenu.js`](file:///Users/joshuacooper/Documents/code/courtyard-coffee/src/routes/AdminMenu.js) renders in English LTR (`dir="ltr"`, gated behind [`PinGateModal.js`](file:///Users/joshuacooper/Documents/code/courtyard-coffee/src/components/PinGateModal.js)) with a top navigation bar, overview counter (`[data-testid="admin-overview-counts"]`), save status badge (`[data-testid="admin-save-status"]`: `"All changes saved"` → `"Unsaved changes"` → `"Saved ✓"`), and explicit **Save Changes** button (`[data-testid="admin-save-btn"]`, `PUT /api/store`). The Store Settings card provides inline editors for `isOpen` (`[data-testid="setting-is-open"]`), `bitPhone` (`[data-testid="setting-bit-phone"]`), `adminPin` (`[data-testid="setting-admin-pin"]`), and Hebrew `closedNoteHe` (`[data-testid="setting-closed-note-he"]`). Alongside it, the Store JSON Inspector computes the exact serialized UTF-8 byte size via `new Blob([JSON.stringify(store)]).size` (`[data-testid="json-byte-size"]`) and provides a collapsible raw JSON preview (`[data-testid="json-raw-preview"]`).
   - **How it was verified**:
     - **Python HTTP/SQLite + Static JS Contract Tests**: `test_cuj07_admin_menu_spreadsheet_photo_album_and_store_persistence` in [`tests/test_routes.py`](file:///Users/joshuacooper/Documents/code/courtyard-coffee/tests/test_routes.py) and `test_cuj07_image_compressor_and_admin_spreadsheet_normalization` in [`tests/test_utils.py`](file:///Users/joshuacooper/Documents/code/courtyard-coffee/tests/test_utils.py).
     - **Live Chrome Telemetry** ([`screenshots/m4_cuj_report.json`](file:///Users/joshuacooper/Documents/code/courtyard-coffee/screenshots/m4_cuj_report.json)): Verified `initialByteSizeText === "55,409 bytes (54.1 KB)"` (`Items: 2 • Tags: 3 • Photos: 2`) transitioning after CRUD and `Save Changes` to `byteSizeBadgeText === "115,749 bytes (113.0 KB)"`, `exactBlobBytes === 115749`, `byteBadgeMatchesBlobSize === true`, `statusBeforeSave === "Unsaved changes"`, `saveStatusAfter === "Saved ✓"`, `overviewCountsText === "Items: 3 • Tags: 4 • Photos: 3"`, and `adminViewBottomPx === 715 <= 800` (`fitsIn800pxViewport === true`).
     - **Visual Screenshot**: [`cuj07_admin_spreadsheet.png`](file:///Users/joshuacooper/Documents/code/courtyard-coffee/screenshots/cuj07_admin_spreadsheet.png).

2. **Photo Album Manager & Client-Side `400×400` JPEG Compression (`CUJ-07` on `/admin/menu`)**:
   - **What it does**: Entering a label (`"Iced Matcha Photo"`) in `[data-testid="new-photo-label-input"]` and attaching an image file (`1000×800` PNG [`test_upload_1000x800.png`](file:///Users/joshuacooper/Documents/code/courtyard-coffee/screenshots/test_upload_1000x800.png)) to `[data-testid="new-photo-file-input"]` invokes [`compressImageFileToDataUrl(file, 400, 0.82)`](file:///Users/joshuacooper/Documents/code/courtyard-coffee/src/utils/image.js), center-cropping the `1000×800` PNG on an HTML5 `<canvas>` and encoding a `400×400` `data:image/jpeg;base64,...` data URL. The new photo is appended to `store.photoAlbum`, rendered as a square thumbnail card (`[data-testid="photo-card-photo-iced-matcha-photo"]`) with an editable label input and delete button, and added to all Menu Item Photo `<select>` dropdowns.
   - **How it was verified**:
     - **Live Chrome CDP File Upload & Image Telemetry** ([`screenshots/m4_cuj_report.json`](file:///Users/joshuacooper/Documents/code/courtyard-coffee/screenshots/m4_cuj_report.json)): Generated `1000×800` PNG (`byteSize = 13273`, `width = 1000`, `height = 800`), verified live photo deletion (`tempPhotoDeleted === true`), uploaded `"Iced Matcha Photo"` via CDP `DOM.setFileInputFiles`, and verified `photoId === "photo-iced-matcha-photo"`, `label === "Iced Matcha Photo"`, `dataUrlPrefix === "data:image/jpeg;base64,"`, `thumbPresentInDom === true`, `thumbComplete === true`, `thumbNaturalWidth === 400`, and `thumbNaturalHeight === 400`.
     - **Visual Screenshots**: [`test_upload_1000x800.png`](file:///Users/joshuacooper/Documents/code/courtyard-coffee/screenshots/test_upload_1000x800.png), [`cuj07_admin_spreadsheet.png`](file:///Users/joshuacooper/Documents/code/courtyard-coffee/screenshots/cuj07_admin_spreadsheet.png), [`cuj07_customer_new_item.png`](file:///Users/joshuacooper/Documents/code/courtyard-coffee/screenshots/cuj07_customer_new_item.png).

3. **Global Modifier Tags & Menu Items Spreadsheets + End-to-End Customer Storefront Verification (`CUJ-07` on `/admin/menu` → `/`)**:
   - **What it does**: Clicking `[data-testid="add-global-tag-btn"]` (`+ Add Global Tag`) appends a new inline-editable tag row populated with `nameEn = "Almond Milk"`, `nameHe = "חלב שקדים"`, `price = 2`, `inStock = true`, immediately refreshing the tag pills in the Menu Items table. Clicking `[data-testid="add-menu-item-btn"]` (`+ Add Menu Item`) appends a new inline-editable item row populated with `category = "Coffee"`, `nameEn = "Iced Matcha"`, `nameHe = "מאצ׳ה אייס"`, `descHe = "מאצ׳ה יפנית על חלב קר"`, `price = 18`, `inStock = true`, Photo `<select>` set to `"Iced Matcha Photo"`, and attached tag pill `"Almond Milk"` toggled on. Deleting a tag or item removes the row and cascades removal from `item.tagIds`. Clicking **Save Changes** (`PUT /api/store`) persists the updated store state to SQLite (`./db/data.db`) while preserving monotonic `nextOrderNumber = 102`. Navigating to `/` on a `390×844` mobile RTL viewport renders `"מאצ׳ה אייס"` (`₪18`) with its `400×400` JPEG photo, and clicking **+ הוסף** opens `TagBottomSheet` where selecting `"חלב שקדים (+2 ₪)"` updates the CTA from `"הוסף להזמנה • 18 ₪"` to `"הוסף להזמנה • 20 ₪"`.
   - **How it was verified**:
     - **Python HTTP/SQLite + Static JS Contract Tests**: `test_cuj07_admin_menu_spreadsheet_photo_album_and_store_persistence` in [`tests/test_routes.py`](file:///Users/joshuacooper/Documents/code/courtyard-coffee/tests/test_routes.py) verifies `PUT /api/store` persistence and `POST /api/order` for `item-matcha` + `tag-almond` (`201 Created`, `total === 20`, `tagsHe === ["חלב שקדים"]`, `tagsEn === ["Almond Milk"]`).
     - **SQLite & Live Chrome Telemetry** ([`screenshots/m4_cuj_report.json`](file:///Users/joshuacooper/Documents/code/courtyard-coffee/screenshots/m4_cuj_report.json)): Verified live row deletion & cascade unlink (`deleteProof.tempTagDeletedAndUnlinked === true`, `deleteProof.tempItemDeleted === true`); verified SQLite `store_state` output `1|102|3|4|3|Almond Milk|חלב שקדים|2|Iced Matcha|מאצ׳ה אייס|18|data:image/jpeg;base64,`; on `/` (`390×844` mobile RTL), verified `matchaTitleText === "מאצ׳ה אייס"`, `matchaPriceText === "₪18"`, `matchaImgSrcPrefix === "data:image/jpeg;base64,"`, `matchaImgNaturalWidth === 400`, `matchaImgNaturalHeight === 400`, `almondPillText === "חלב שקדים (+2 ₪)"`, `almondPillSelected === true`, `confirmBtnTextBeforeSelect === "הוסף להזמנה • 18 ₪"`, `confirmBtnTextAfterSelect === "הוסף להזמנה • 20 ₪"`, and `matchaCardBottomPx === 504 <= sheetCardTopPx === 555` (`matchaCardVisibleAboveSheet === true`).
     - **Visual Screenshots**: [`cuj07_admin_spreadsheet.png`](file:///Users/joshuacooper/Documents/code/courtyard-coffee/screenshots/cuj07_admin_spreadsheet.png), [`cuj07_customer_new_item.png`](file:///Users/joshuacooper/Documents/code/courtyard-coffee/screenshots/cuj07_customer_new_item.png).

---

### Milestones 1–3 Capabilities (`CUJ-01` – `CUJ-06`, Regression-Verified in `m4_cuj_report.json`)

4. **Customer Storefront, Zero-Polling Guarantee & Inline Stepper (`CUJ-01` on `/`)**:
   - Verified in [`m4_cuj_report.json`](file:///Users/joshuacooper/Documents/code/courtyard-coffee/screenshots/m4_cuj_report.json) (`zeroBackgroundPolls: true` over 3.1s idle wait, `qtyAfterFirstClick === "1"` → `qtyAfterSecondClick === "2"`, `cartTotalText === "24 ₪"`) and [`cuj01_initial_storefront.png`](file:///Users/joshuacooper/Documents/code/courtyard-coffee/screenshots/cuj01_initial_storefront.png), [`cuj01_pastry_added.png`](file:///Users/joshuacooper/Documents/code/courtyard-coffee/screenshots/cuj01_pastry_added.png).
5. **Tag Customization Bottom Sheet & Dynamic Price Calculation (`CUJ-02` on `/`)**:
   - Verified in [`m4_cuj_report.json`](file:///Users/joshuacooper/Documents/code/courtyard-coffee/screenshots/m4_cuj_report.json) (`syrupDisabled: true`, `oatSelected: true`, `noteValue: "חם מאוד"`, `confirmBtnUpdatedText: "הוסף להזמנה • 16 ₪"`, `cartTotalText: "40 ₪"`) and [`cuj02_bottom_sheet_open.png`](file:///Users/joshuacooper/Documents/code/courtyard-coffee/screenshots/cuj02_bottom_sheet_open.png), [`cuj02_bottom_sheet_selected.png`](file:///Users/joshuacooper/Documents/code/courtyard-coffee/screenshots/cuj02_bottom_sheet_selected.png), [`cuj02_cart_updated.png`](file:///Users/joshuacooper/Documents/code/courtyard-coffee/screenshots/cuj02_cart_updated.png).
6. **Customer Checkout, Order `#101` Submission & Static Receipt with `240×240` ISO-18004 Bit QR (`CUJ-03` on `/`)**:
   - Verified in [`m4_cuj_report.json`](file:///Users/joshuacooper/Documents/code/courtyard-coffee/screenshots/m4_cuj_report.json) (`orderNumberText: "#101"`, `qrNaturalWidth: 240`, `qrNaturalHeight: 240`, `copyBtnTextAfter: "הועתק! ✓"`, `nextOrderNumberAfter101: 102`) and [`cuj03_checkout_sheet_filled.png`](file:///Users/joshuacooper/Documents/code/courtyard-coffee/screenshots/cuj03_checkout_sheet_filled.png), [`cuj03_receipt_with_qr.png`](file:///Users/joshuacooper/Documents/code/courtyard-coffee/screenshots/cuj03_receipt_with_qr.png).
7. **Admin 4-Digit PIN Gate & `localStorage` Persistence (`CUJ-04` on `/admin/kds` & `/admin/menu`)**:
   - Verified in [`m4_cuj_report.json`](file:///Users/joshuacooper/Documents/code/courtyard-coffee/screenshots/m4_cuj_report.json) (`locked.pinModalPresent: true`, `error.errorText: "Invalid PIN code. Please try again."`, `unlocked.storedPin: "1234"`, `reloadedKdsBypass.kdsViewPresent: true`, `adminMenuBypass.adminMenuViewPresent: true`) and [`cuj04_pin_modal_locked.png`](file:///Users/joshuacooper/Documents/code/courtyard-coffee/screenshots/cuj04_pin_modal_locked.png), [`cuj04_pin_modal_error.png`](file:///Users/joshuacooper/Documents/code/courtyard-coffee/screenshots/cuj04_pin_modal_error.png), [`cuj04_kds_unlocked.png`](file:///Users/joshuacooper/Documents/code/courtyard-coffee/screenshots/cuj04_kds_unlocked.png).
8. **Barista KDS `2000ms` Polling, Web Audio Chime & 2-Tap Ticket Lifecycle (`CUJ-05` on `/admin/kds`)**:
   - Verified in [`m4_cuj_report.json`](file:///Users/joshuacooper/Documents/code/courtyard-coffee/screenshots/m4_cuj_report.json) (`chimeCountAfter2sPoll: 1`, `chimeSynthSuccessCount: 1`, `sqliteAfterTap1: "1|0"`, `sqliteAfterTap2: "1|1"`, `completedTicket101Present: true`) and [`cuj05_kds_active_ticket.png`](file:///Users/joshuacooper/Documents/code/courtyard-coffee/screenshots/cuj05_kds_active_ticket.png), [`cuj05_kds_ticket_notified.png`](file:///Users/joshuacooper/Documents/code/courtyard-coffee/screenshots/cuj05_kds_ticket_notified.png), [`cuj05_kds_completed_drawer.png`](file:///Users/joshuacooper/Documents/code/courtyard-coffee/screenshots/cuj05_kds_completed_drawer.png).
9. **Barista KDS Quick-86 Stock Toggling & Auto-Persisting Closed Banner (`CUJ-06` on `/admin/kds` → `/`)**:
   - Verified in [`m4_cuj_report.json`](file:///Users/joshuacooper/Documents/code/courtyard-coffee/screenshots/m4_cuj_report.json) (`closedNotePutRequestCount: 1`, `sqliteStoreState: "0|יצאנו להפסקת צהריים, נחזור ב-14:00|102"`, `oatTagDisabled: true`, `confirmBtnDisabled: true`) and [`cuj06_kds_86_and_closed.png`](file:///Users/joshuacooper/Documents/code/courtyard-coffee/screenshots/cuj06_kds_86_and_closed.png), [`cuj06_customer_closed_and_86.png`](file:///Users/joshuacooper/Documents/code/courtyard-coffee/screenshots/cuj06_customer_closed_and_86.png).

---

## 1. Complete Index of Artifacts & Conversation Logs

### A. Planning, Specification & Walkthrough Artifacts
- **Master Implementation Plan**: [`implementation_plan.md`](file:///Users/joshuacooper/.gemini/antigravity/brain/d7a3ec9f-d77b-4283-af4d-ff6ac2aa2e89/implementation_plan.md)
- **Product & Technical Specification**: [`spec_courtyard_coffee.md`](file:///Users/joshuacooper/.gemini/antigravity/brain/9a11f9b7-4968-4ff0-9f73-f8956f462c6f/spec_courtyard_coffee.md)
- **7-CUJ Live Testing & Verification Plan**: [`live_testing_plan.md`](file:///Users/joshuacooper/.gemini/antigravity/brain/e9431844-28e0-4b4a-9793-127d96d61942/live_testing_plan.md)
- **Final Walkthrough Artifact (`M1`–`M4`)**: [`walkthrough.md`](file:///Users/joshuacooper/.gemini/antigravity/brain/b71430ef-9e3e-4fa4-99f9-4e7150dddf24/walkthrough.md)
- **Active Handover Artifact (`M4`)**: [`handover.md`](file:///Users/joshuacooper/.gemini/antigravity/brain/b71430ef-9e3e-4fa4-99f9-4e7150dddf24/handover.md)
- **Repository Handover Document**: [`HANDOVER.md`](file:///Users/joshuacooper/Documents/code/courtyard-coffee/HANDOVER.md)
- **Repository README**: [`README.md`](file:///Users/joshuacooper/Documents/code/courtyard-coffee/README.md)

### B. Custom Subagent Definitions
- **TDD Builder (`tdd-builder`)**: [`tdd-builder/agent.md`](file:///Users/joshuacooper/.gemini/antigravity/brain/76acbd3f-a1ae-4038-83c8-19e5cc95f5a3/.agents/agents/tdd-builder/agent.md)
- **Critical Evidence Auditor (`critical-auditor`)**: [`critical-auditor/agent.md`](file:///Users/joshuacooper/.gemini/antigravity/brain/76acbd3f-a1ae-4038-83c8-19e5cc95f5a3/.agents/agents/critical-auditor/agent.md)
- **CUJ Verifier (`cuj-verifier`)**: [`cuj-verifier/agent.md`](file:///Users/joshuacooper/.gemini/antigravity/brain/76acbd3f-a1ae-4038-83c8-19e5cc95f5a3/.agents/agents/cuj-verifier/agent.md)

### C. Subagent Conversations & Transcript Logs
- **Milestone 4 Orchestrator Conversation (`M4`)**: [b71430ef-9e3e-4fa4-99f9-4e7150dddf24](conversation://b71430ef-9e3e-4fa4-99f9-4e7150dddf24) — [`transcript.jsonl`](file:///Users/joshuacooper/.gemini/antigravity/brain/b71430ef-9e3e-4fa4-99f9-4e7150dddf24/.system_generated/logs/transcript.jsonl)
- **Milestone 4 TDD Builder (`m4-red` → `m4-green`)**: [b47bea7b-0429-4161-be29-664e65df9bf6](conversation://b47bea7b-0429-4161-be29-664e65df9bf6) — [`transcript.jsonl`](file:///Users/joshuacooper/.gemini/antigravity/brain/b47bea7b-0429-4161-be29-664e65df9bf6/.system_generated/logs/transcript.jsonl)
- **Milestone 4 Critical Auditor**: [f7046247-5208-4db1-8da3-0c71e76fc97e](conversation://f7046247-5208-4db1-8da3-0c71e76fc97e) — [`transcript.jsonl`](file:///Users/joshuacooper/.gemini/antigravity/brain/f7046247-5208-4db1-8da3-0c71e76fc97e/.system_generated/logs/transcript.jsonl)
- **Milestone 3 Orchestrator Conversation (`M3`)**: [495a17db-e8d3-46a2-8cc7-15f5903a8cc0](conversation://495a17db-e8d3-46a2-8cc7-15f5903a8cc0) — [`transcript.jsonl`](file:///Users/joshuacooper/.gemini/antigravity/brain/495a17db-e8d3-46a2-8cc7-15f5903a8cc0/.system_generated/logs/transcript.jsonl)
- **Milestone 3 TDD Builder (`m3-red` → `m3-green`)**: [cbf754c6-1ee9-44db-a1cd-bb7939969338](conversation://cbf754c6-1ee9-44db-a1cd-bb7939969338) — [`transcript.jsonl`](file:///Users/joshuacooper/.gemini/antigravity/brain/cbf754c6-1ee9-44db-a1cd-bb7939969338/.system_generated/logs/transcript.jsonl)
- **Milestone 3 Critical Auditor**: [7bcaf2c7-fb31-4da0-8c80-dddfa3b1b2ca](conversation://7bcaf2c7-fb31-4da0-8c80-dddfa3b1b2ca) — [`transcript.jsonl`](file:///Users/joshuacooper/.gemini/antigravity/brain/7bcaf2c7-fb31-4da0-8c80-dddfa3b1b2ca/.system_generated/logs/transcript.jsonl)
- **Milestone 1–2 Parent Conversation (`M1`–`M2`)**: [76acbd3f-a1ae-4038-83c8-19e5cc95f5a3](conversation://76acbd3f-a1ae-4038-83c8-19e5cc95f5a3) — [`transcript.jsonl`](file:///Users/joshuacooper/.gemini/antigravity/brain/76acbd3f-a1ae-4038-83c8-19e5cc95f5a3/.system_generated/logs/transcript.jsonl)
- **Milestone 1 Critical Auditor**: [94fd2253-9424-49c4-8611-d8c0817dec12](conversation://94fd2253-9424-49c4-8611-d8c0817dec12) — [`transcript.jsonl`](file:///Users/joshuacooper/.gemini/antigravity/brain/94fd2253-9424-49c4-8611-d8c0817dec12/.system_generated/logs/transcript.jsonl)
- **Milestone 2 Critical Auditor**: [f34c6921-7c4b-4bce-b500-062f5716a63a](conversation://f34c6921-7c4b-4bce-b500-062f5716a63a) — [`transcript.jsonl`](file:///Users/joshuacooper/.gemini/antigravity/brain/f34c6921-7c4b-4bce-b500-062f5716a63a/.system_generated/logs/transcript.jsonl)

### D. Telemetry JSON Reports & Screenshots (23 PNGs + 4 JSON Reports)
- **Telemetry Reports**:
  - [`screenshots/m1_smoke_report.json`](file:///Users/joshuacooper/Documents/code/courtyard-coffee/screenshots/m1_smoke_report.json)
  - [`screenshots/m2_cuj_report.json`](file:///Users/joshuacooper/Documents/code/courtyard-coffee/screenshots/m2_cuj_report.json)
  - [`screenshots/m3_cuj_report.json`](file:///Users/joshuacooper/Documents/code/courtyard-coffee/screenshots/m3_cuj_report.json)
  - [`screenshots/m4_cuj_report.json`](file:///Users/joshuacooper/Documents/code/courtyard-coffee/screenshots/m4_cuj_report.json)
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
- **Milestone 4 Screenshots (`CUJ-07`, 3 PNGs)**:
  - [`test_upload_1000x800.png`](file:///Users/joshuacooper/Documents/code/courtyard-coffee/screenshots/test_upload_1000x800.png) (`1000×800` source PNG uploaded via CDP)
  - [`cuj07_admin_spreadsheet.png`](file:///Users/joshuacooper/Documents/code/courtyard-coffee/screenshots/cuj07_admin_spreadsheet.png)
  - [`cuj07_customer_new_item.png`](file:///Users/joshuacooper/Documents/code/courtyard-coffee/screenshots/cuj07_customer_new_item.png)

---

## 2. Complete Codebase & Database State Index

### A. Git Tags & Commit SHAs (`m1-red` – `m4-green`)
| Tag | Commit SHA | Summary |
| :--- | :--- | :--- |
| `m1-red` | `32edca1455b179c30e9ef29db32ef635fba4034f` | `test(m1): add failing assertions [RED]` (8 failing M1 tests) |
| `m1-green` | `de8c9403e5438b3c76a5d459b75dc379f76510c0` | `fix(m1): resolve all critical audit caveats with ISO-18004 QR and full live proofs [GREEN]` (8 passing M1 tests) |
| `m2-red` | `d15c40a6a514cc4c1a2bbc6a989446370e249760` | `test(m2): add failing assertions for CUJ-01, CUJ-02, CUJ-03 [RED]` (3 failing M2 tests, 8 passing M1 tests) |
| `m2-green` | `602084b4bd171d2a4fc3f4c2eafb4e09629edd54` | `docs(m2): update repository HANDOVER.md with full artifact links, state index, and operational playbook` (11 passing M1+M2 tests) |
| `m3-red` | `bc1da9336de1c5a3f16bd0fa4f787bd67c6df235` | `test(m3): add failing assertions for CUJ-04, CUJ-05, CUJ-06 [RED]` (4 failing M3 tests, 11 passing M1+M2 tests) |
| `m3-green` | `2199d781fda4b2b4f5f2098cb2d0f244f25d9bd7` | `fix(m3): resolve all M3 critical audit caveats with live order arrival chime and debounced closed note [GREEN]` (15 passing M1+M2+M3 tests) |
| `m4-red` | `fc2be6f201426e9811b542c8ee301310f4220135` | `test(m4): add failing assertions for CUJ-07 admin spreadsheet and photo album [RED]` (2 failing M4 tests, 15 passing M1–M3 tests) |
| `m4-green` | `0d0850a2f85972d71883cd5da2394df5ea49d5a3` | `fix(m4): resolve all M4 critical audit caveats with runtime delete proofs and unclipped columns [GREEN]` (17 passing M1–M4 tests; followed on `main` by `docs(m4): update repository HANDOVER.md for Milestone 4 and full 7-CUJ completion`) |

### B. Live SQLite Database State (`./db/data.db`) After Full `CUJ-01..07` Run
- **`orders` Table**: Contains Order `#101` (`id = "ord-101-f25365"`, `customerName = "דניאל"`, `customerPhone = "054-9876543"`, `total = 40.0`, `isNotified = 1`, `isDone = 1`).
- **`store_state` Table (`id = 1`)**:
  - `isOpen = true` (`1`), `nextOrderNumber = 102`
  - `photoAlbum` (`3` items): `photo-cappuccino`, `photo-croissant`, `photo-iced-matcha-photo` (`400×400` `data:image/jpeg;base64,...`)
  - `globalTags` (`4` items): `tag-oat` (`inStock: true`), `tag-decaf` (`inStock: true`), `tag-syrup` (`inStock: false`), `tag-custom-4` (`"Almond Milk"` / `"חלב שקדים"`, `price: 2`, `inStock: true`)
  - `menuItems` (`3` items): `item-cappuccino` (`14 ₪`), `item-croissant` (`12 ₪`, `inStock: true`), `item-custom-3` (`"Iced Matcha"` / `"מאצ׳ה אייס"`, `descHe: "מאצ׳ה יפנית על חלב קר"`, `price: 18`, `photoId: "photo-iced-matcha-photo"`, `tagIds: ["tag-custom-4"]`, `inStock: true`)

---

## 3. Operational Playbook

1. **Zero-Node Policy**: Never invoke `node`, `npm`, `npx`, or `brew` (blocked by macOS Santa). Use `/usr/bin/python3`, `/usr/bin/sqlite3`, `/usr/local/git/current/bin/git`, and `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`.
2. **Run Unit & Route Test Suite (`BypassSandbox: false`)**:
   ```bash
   /usr/bin/python3 -m unittest discover -s /Users/joshuacooper/Documents/code/courtyard-coffee/tests -t /Users/joshuacooper/Documents/code/courtyard-coffee -v
   ```
3. **Run Full 7-CUJ Headless Chrome CDP Verification Suite (`BypassSandbox: true`)**:
   ```bash
   /usr/bin/python3 /Users/joshuacooper/Documents/code/courtyard-coffee/scripts/cdp_harness.py
   ```
