/**
 * Admin Menu & Store Settings ("/admin/menu") — English LTR layout.
 * Implements CUJ-07:
 *  - Store Settings & Live Store JSON Inspector (with byte size via Blob)
 *  - Photo Album Manager (client-side 400x400 JPEG 0.82 Canvas compression via compressImageFileToDataUrl)
 *  - Global Tags Spreadsheet Table (inline stock, EN/HE names, price delta, add/delete)
 *  - Menu Items Spreadsheet Table (inline stock, category, EN/HE names, HE desc, price, Photo Album dropdown, attached tag pills, add/delete)
 *  - Explicit "Save Changes" action persisting to SQLite via PUT /api/store (saveStoreState)
 */
import { saveStoreState } from "../state.js";
import { compressImageFileToDataUrl } from "../utils/image.js";
import { renderMenuItemCard } from "../components/MenuItemCard.js";

const ADMIN_CATEGORIES = ["Coffee", "Cold", "Pastry", "Other"];
const EMPTY_PIXEL_GIF =
  "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(str) {
  return escapeHtml(str);
}

function slugifyId(prefix, rawText, existingIds) {
  const baseSlug = String(rawText || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24);
  const root = baseSlug ? `${prefix}-${baseSlug}` : `${prefix}-${Date.now().toString(36)}`;
  if (!existingIds.has(root)) {
    return root;
  }
  let counter = 2;
  while (existingIds.has(`${root}-${counter}`)) {
    counter += 1;
  }
  return `${root}-${counter}`;
}

export function mountAdminMenuRoute(container, initialStore) {
  document.documentElement.setAttribute("dir", "ltr");
  document.documentElement.setAttribute("lang", "en");

  if (typeof window !== "undefined" && window.__kdsPollInterval) {
    clearInterval(window.__kdsPollInterval);
    window.__kdsPollInterval = null;
  }

  let store = JSON.parse(JSON.stringify(initialStore || {}));
  store.photoAlbum = Array.isArray(store.photoAlbum) ? store.photoAlbum : [];
  store.globalTags = Array.isArray(store.globalTags) ? store.globalTags : [];
  store.menuItems = Array.isArray(store.menuItems) ? store.menuItems : [];

  let saveStatusText = "All changes saved";
  let saveStatusTone = "saved"; // "saved" | "dirty" | "saving" | "error"

  container.innerHTML = `
    <main class="admin-shell admin-menu-shell" dir="ltr" data-testid="admin-menu-view">
      <header class="admin-topbar admin-menu-topbar">
        <div class="admin-menu-title-col">
          <div class="admin-menu-title-row">
            <h1 class="admin-menu-main-title">Courtyard Coffee — Admin Menu &amp; Settings</h1>
            <span class="admin-overview-counts" data-testid="admin-overview-counts"></span>
          </div>
          <p class="admin-menu-subtitle">
            Spreadsheet editor for menu items, global modifier tags, photo album, and store settings
          </p>
        </div>

        <div class="admin-menu-topbar-right">
          <span
            class="admin-save-status saved"
            data-testid="admin-save-status"
          >
            ${escapeHtml(saveStatusText)}
          </span>
          <button
            type="button"
            class="btn-primary admin-save-btn"
            data-testid="admin-save-btn"
          >
            Save Changes
          </button>
          <nav class="admin-nav-links" aria-label="Admin Navigation">
            <a href="/admin/kds" class="admin-nav-link" data-nav="/admin/kds">KDS Queue</a>
            <a href="/admin/menu" class="admin-nav-link active" data-nav="/admin/menu">Menu &amp; Settings</a>
            <a href="/" class="admin-nav-link" data-nav="/">Storefront</a>
          </nav>
        </div>
      </header>

      <div class="admin-top-grid">
        <section class="admin-panel-card" aria-label="Store Settings">
          <div class="admin-panel-header">
            <h2 class="admin-panel-title">Store Settings</h2>
            <div class="admin-settings-header-right">
              <details class="admin-legal-popover">
                <summary class="admin-legal-summary" data-testid="toggle-legal-settings">
                  Legal &amp; A11y Info
                </summary>
                <div class="admin-legal-popover-card">
                  <label class="admin-field-label">
                    <span>Contact Person / Owner (HE)</span>
                    <input
                      type="text"
                      dir="rtl"
                      class="admin-input admin-input-rtl"
                      data-testid="setting-owner-name-he"
                      placeholder="הנהלת קפה בחצר"
                      value="${escapeAttr(store.ownerNameHe || "")}"
                    />
                  </label>
                  <label class="admin-field-label">
                    <span>Contact Email (Privacy &amp; A11y)</span>
                    <input
                      type="email"
                      class="admin-input admin-input-mono"
                      data-testid="setting-contact-email"
                      placeholder="info@courtyard-coffee.co.il"
                      value="${escapeAttr(store.contactEmail || "")}"
                    />
                  </label>
                  <label class="admin-field-label">
                    <span>Business Address (HE)</span>
                    <input
                      type="text"
                      dir="rtl"
                      class="admin-input admin-input-rtl"
                      data-testid="setting-business-address-he"
                      placeholder="כתובת בית הקפה"
                      value="${escapeAttr(store.businessAddressHe || "")}"
                    />
                  </label>
                  <label class="admin-field-label">
                    <span>Physical Accessibility Note (HE)</span>
                    <input
                      type="text"
                      dir="rtl"
                      class="admin-input admin-input-rtl"
                      data-testid="setting-a11y-physical-he"
                      placeholder="הכניסה לחצר נגישה במפלס הרחוב..."
                      value="${escapeAttr(store.accessibilityPhysicalHe || "")}"
                    />
                  </label>
                </div>
              </details>
              <label class="admin-open-toggle-label">
                <input
                  type="checkbox"
                  data-testid="setting-is-open"
                  ${store.isOpen ? "checked" : ""}
                />
                <span>Store Open</span>
              </label>
            </div>
          </div>
          <div class="admin-settings-fields">
            <label class="admin-field-label">
              <span>Bit Phone</span>
              <input
                type="text"
                class="admin-input admin-input-mono"
                data-testid="setting-bit-phone"
                value="${escapeAttr(store.bitPhone || "")}"
              />
            </label>
            <label class="admin-field-label">
              <span>Admin PIN</span>
              <input
                type="text"
                class="admin-input admin-input-mono"
                data-testid="setting-admin-pin"
                value="${escapeAttr(store.adminPin || "")}"
              />
            </label>
            <label class="admin-field-label admin-field-wide">
              <span>Closed Note (HE)</span>
              <input
                type="text"
                dir="rtl"
                class="admin-input admin-input-rtl"
                data-testid="setting-closed-note-he"
                value="${escapeAttr(store.closedNoteHe || store.closedMessageHe || "")}"
              />
            </label>
          </div>
        </section>

        <section class="admin-panel-card" aria-label="Store JSON Inspector">
          <div class="admin-panel-header">
            <h2 class="admin-panel-title">Store JSON Inspector</h2>
            <span class="admin-byte-badge" data-testid="json-byte-size"></span>
          </div>
          <details class="admin-json-details">
            <summary class="admin-json-summary">Raw Store Payload Preview</summary>
            <pre class="admin-json-pre" data-testid="json-raw-preview"></pre>
          </details>
        </section>
      </div>

      <section class="admin-panel-card admin-photos-card" aria-label="Photo Album Manager">
        <div class="admin-panel-header">
          <div>
            <h2 class="admin-panel-title">Photo Album Manager (400×400 JPEG 0.82)</h2>
          </div>
          <div class="admin-photo-upload-bar">
            <input
              type="text"
              class="admin-input admin-photo-label-new"
              data-testid="new-photo-label-input"
              placeholder="New photo label (e.g. Iced Matcha Photo)"
            />
            <label class="btn-secondary admin-upload-btn-label">
              <span>+ Upload Photo</span>
              <input
                type="file"
                accept="image/*"
                class="admin-file-input-hidden"
                data-testid="new-photo-file-input"
              />
            </label>
          </div>
        </div>
        <div id="admin-photos-region" class="admin-photos-grid"></div>
      </section>

      <section class="admin-panel-card admin-tags-card" aria-label="Global Tags Spreadsheet">
        <div class="admin-panel-header">
          <h2 class="admin-panel-title">Global Modifier Tags</h2>
          <button
            type="button"
            class="btn-secondary admin-add-row-btn"
            data-testid="add-global-tag-btn"
          >
            + Add Global Tag
          </button>
        </div>
        <div class="admin-table-wrap">
          <table class="admin-spreadsheet-table admin-tags-table">
            <thead>
              <tr>
                <th style="width: 70px;">In Stock</th>
                <th>Name (EN)</th>
                <th>Name (HE)</th>
                <th style="width: 110px;">Price Δ (₪)</th>
                <th style="width: 84px;">Action</th>
              </tr>
            </thead>
            <tbody id="admin-tags-tbody"></tbody>
          </table>
        </div>
      </section>

      <section class="admin-panel-card admin-items-card" aria-label="Menu Items Spreadsheet">
        <div class="admin-panel-header">
          <h2 class="admin-panel-title">Menu Items Spreadsheet</h2>
          <div class="admin-header-btn-group">
            <button
              type="button"
              class="btn-primary admin-add-row-btn"
              data-testid="quick-add-item-btn"
            >
              + Quick Add Product
            </button>
            <button
              type="button"
              class="btn-secondary admin-add-row-btn"
              data-testid="add-menu-item-btn"
            >
              + Add Menu Item
            </button>
          </div>
        </div>
        <div class="admin-table-wrap">
          <table class="admin-spreadsheet-table admin-items-table">
            <thead>
              <tr>
                <th style="width: 44px;">Stock</th>
                <th style="width: 86px;">Category</th>
                <th style="width: 124px;">Name (EN)</th>
                <th style="width: 114px;">Name (HE)</th>
                <th>Description (HE)</th>
                <th style="width: 68px;">Price (₪)</th>
                <th style="width: 196px;">Photo</th>
                <th style="width: 296px;">Attached Tags</th>
                <th style="width: 96px;">Action</th>
              </tr>
            </thead>
            <tbody id="admin-items-tbody"></tbody>
          </table>
        </div>
      </section>
      <div id="admin-quick-add-modal-host"></div>
    </main>
  `;

  const overviewCountsEl = container.querySelector('[data-testid="admin-overview-counts"]');
  const saveStatusEl = container.querySelector('[data-testid="admin-save-status"]');
  const saveBtnEl = container.querySelector('[data-testid="admin-save-btn"]');
  const byteSizeEl = container.querySelector('[data-testid="json-byte-size"]');
  const rawPreviewEl = container.querySelector('[data-testid="json-raw-preview"]');
  const isOpenInput = container.querySelector('[data-testid="setting-is-open"]');
  const bitPhoneInput = container.querySelector('[data-testid="setting-bit-phone"]');
  const adminPinInput = container.querySelector('[data-testid="setting-admin-pin"]');
  const closedNoteInput = container.querySelector('[data-testid="setting-closed-note-he"]');
  const ownerNameInput = container.querySelector('[data-testid="setting-owner-name-he"]');
  const contactEmailInput = container.querySelector('[data-testid="setting-contact-email"]');
  const businessAddressInput = container.querySelector('[data-testid="setting-business-address-he"]');
  const a11yPhysicalInput = container.querySelector('[data-testid="setting-a11y-physical-he"]');
  const newPhotoLabelInput = container.querySelector('[data-testid="new-photo-label-input"]');
  const newPhotoFileInput = container.querySelector('[data-testid="new-photo-file-input"]');
  const photosRegion = container.querySelector("#admin-photos-region");
  const tagsTbody = container.querySelector("#admin-tags-tbody");
  const itemsTbody = container.querySelector("#admin-items-tbody");
  const addTagBtn = container.querySelector('[data-testid="add-global-tag-btn"]');
  const addItemBtn = container.querySelector('[data-testid="add-menu-item-btn"]');
  const quickAddItemBtn = container.querySelector('[data-testid="quick-add-item-btn"]');
  const quickAddModalHost = container.querySelector("#admin-quick-add-modal-host");

  function updateInspectorAndHeader() {
    const itemsCount = (store.menuItems || []).length;
    const tagsCount = (store.globalTags || []).length;
    const photosCount = (store.photoAlbum || []).length;
    if (overviewCountsEl) {
      overviewCountsEl.textContent = `Items: ${itemsCount} • Tags: ${tagsCount} • Photos: ${photosCount}`;
    }
    if (saveStatusEl) {
      saveStatusEl.textContent = saveStatusText;
      saveStatusEl.className = `admin-save-status ${saveStatusTone}`;
    }
    const serialized = JSON.stringify(store, null, 2);
    const byteSize = new Blob([JSON.stringify(store)]).size;
    if (byteSizeEl) {
      byteSizeEl.textContent = `${byteSize.toLocaleString()} bytes (${(byteSize / 1024).toFixed(1)} KB)`;
    }
    if (rawPreviewEl) {
      rawPreviewEl.textContent = serialized;
    }
  }

  function markDirty() {
    saveStatusText = "Unsaved changes";
    saveStatusTone = "dirty";
    updateInspectorAndHeader();
  }

  function renderPhotosRegion() {
    if (!photosRegion) return;
    const photos = store.photoAlbum || [];
    if (photos.length === 0) {
      photosRegion.innerHTML = `<p class="admin-empty-hint">No photos in album yet.</p>`;
      return;
    }
    photosRegion.innerHTML = photos
      .map((photo) => {
        const pid = escapeAttr(photo.id);
        const label = escapeAttr(photo.label || photo.name || "");
        const url = escapeAttr(photo.url || photo.dataUrl || "");
        return `
          <div class="admin-photo-card" data-testid="photo-card-${pid}">
            <img
              class="admin-photo-thumb"
              src="${url}"
              alt="${label}"
              width="52"
              height="52"
              data-testid="photo-img-${pid}"
            />
            <div class="admin-photo-card-controls">
              <input
                type="text"
                class="admin-input admin-photo-label-input"
                data-testid="photo-label-${pid}"
                data-photo-id="${pid}"
                value="${label}"
                aria-label="Photo Label"
              />
              <button
                type="button"
                class="btn-danger admin-btn-xs"
                data-testid="delete-photo-${pid}"
                data-delete-photo="${pid}"
              >
                Delete
              </button>
            </div>
          </div>
        `;
      })
      .join("");
  }

  function renderTagsRegion() {
    if (!tagsTbody) return;
    const tags = store.globalTags || [];
    tagsTbody.innerHTML = tags
      .map((tag) => {
        const tid = escapeAttr(tag.id);
        const nameEn = escapeAttr(tag.nameEn ?? tag.labelEn ?? "");
        const nameHe = escapeAttr(tag.nameHe ?? tag.labelHe ?? "");
        const price = Number(tag.price ?? tag.priceDelta ?? 0);
        return `
          <tr data-testid="tag-row-${tid}" data-tag-id="${tid}">
            <td class="admin-td-center">
              <input
                type="checkbox"
                data-testid="tag-instock-${tid}"
                data-tag-field="inStock"
                data-tag-id="${tid}"
                ${tag.inStock ? "checked" : ""}
              />
            </td>
            <td>
              <input
                type="text"
                class="admin-input"
                data-testid="tag-name-en-${tid}"
                data-tag-field="nameEn"
                data-tag-id="${tid}"
                value="${nameEn}"
                placeholder="English tag name"
              />
            </td>
            <td>
              <input
                type="text"
                dir="rtl"
                class="admin-input admin-input-rtl"
                data-testid="tag-name-he-${tid}"
                data-tag-field="nameHe"
                data-tag-id="${tid}"
                value="${nameHe}"
                placeholder="שם תגית בעברית"
              />
            </td>
            <td>
              <input
                type="number"
                class="admin-input admin-input-num"
                data-testid="tag-price-${tid}"
                data-tag-field="price"
                data-tag-id="${tid}"
                value="${price}"
                step="1"
              />
            </td>
            <td class="admin-td-center">
              <button
                type="button"
                class="btn-danger admin-btn-xs"
                data-testid="delete-tag-${tid}"
                data-delete-tag="${tid}"
              >
                Delete
              </button>
            </td>
          </tr>
        `;
      })
      .join("");
  }

  function resolveItemPhotoUrl(item) {
    const photos = store.photoAlbum || [];
    const currentPhotoId = item.photoId || "";
    const currentPhotoUrl = item.photo || item.imageUrl || item.photoUrl || "";
    if (currentPhotoId) {
      const matched = photos.find((p) => p.id === currentPhotoId);
      if (matched) {
        return matched.url || matched.dataUrl || "";
      }
    }
    return currentPhotoUrl;
  }

  function renderItemPhotoOptionsHtml(item) {
    const photos = store.photoAlbum || [];
    const currentPhotoId = item.photoId || "";
    const currentPhotoUrl = item.photo || item.imageUrl || item.photoUrl || "";
    let matchedAny = false;
    const options = photos.map((albumItem) => {
      const aUrl = albumItem.url || albumItem.dataUrl || "";
      const isSelected =
        (currentPhotoId && albumItem.id === currentPhotoId) ||
        (!currentPhotoId && currentPhotoUrl && aUrl === currentPhotoUrl);
      if (isSelected) matchedAny = true;
      return `<option value="${escapeAttr(aUrl)}" data-photo-id="${escapeAttr(albumItem.id)}" ${
        isSelected ? "selected" : ""
      }>${escapeHtml(albumItem.label || albumItem.name || albumItem.id)}</option>`;
    });
    const noneOption = `<option value="" data-photo-id="" ${
      !matchedAny ? "selected" : ""
    }>— None —</option>`;
    return [noneOption, ...options].join("");
  }

  function renderItemTagPillsHtml(item) {
    const tags = store.globalTags || [];
    const attachedSet = new Set(Array.isArray(item.tagIds) ? item.tagIds : []);
    if (tags.length === 0) {
      return `<span class="admin-empty-hint">No tags</span>`;
    }
    const allSelected = tags.every((t) => attachedSet.has(t.id));
    const pillsHtml = tags
      .map((tag) => {
        const isSelected = attachedSet.has(tag.id);
        const label = tag.nameEn || tag.labelEn || tag.nameHe || tag.id;
        return `
          <button
            type="button"
            class="admin-item-tag-pill ${isSelected ? "selected" : ""}"
            data-testid="item-tag-${escapeAttr(item.id)}-${escapeAttr(tag.id)}"
            data-toggle-item-tag="${escapeAttr(item.id)}"
            data-tag-id="${escapeAttr(tag.id)}"
            data-tag-name-en="${escapeAttr(tag.nameEn || tag.labelEn || "")}"
          >
            ${escapeHtml(label)}
          </button>
        `;
      })
      .join("");
    const bulkToggleHtml = `
      <button
        type="button"
        class="admin-item-tag-bulk-btn"
        data-testid="toggle-all-item-tags-${escapeAttr(item.id)}"
        data-toggle-all-item-tags="${escapeAttr(item.id)}"
        title="${allSelected ? "Clear all tags" : "Attach all tags"}"
      >
        ${allSelected ? "Clear" : "All"}
      </button>
    `;
    return pillsHtml + bulkToggleHtml;
  }

  function renderCategoryOptionsHtml(category) {
    return `
      <option value="Coffee" ${category === "Coffee" ? "selected" : ""}>Coffee</option>
      <option value="Cold" ${category === "Cold" ? "selected" : ""}>Cold</option>
      <option value="Pastry" ${category === "Pastry" ? "selected" : ""}>Pastry</option>
      <option value="Other" ${category === "Other" ? "selected" : ""}>Other</option>
    `;
  }

  function renderItemsRegion() {
    if (!itemsTbody) return;
    const items = store.menuItems || [];
    itemsTbody.innerHTML = items
      .map((item) => {
        const iid = escapeAttr(item.id);
        const category = item.category || "Coffee";
        const nameEn = escapeAttr(item.nameEn ?? item.titleEn ?? "");
        const nameHe = escapeAttr(item.nameHe ?? item.titleHe ?? "");
        const descHe = escapeAttr(item.descHe ?? "");
        const price = Number(item.price ?? 0);
        const resolvedPhotoUrl = resolveItemPhotoUrl(item);
        const catOptions = renderCategoryOptionsHtml(category);
        return `
          <tr data-testid="item-row-${iid}" data-item-id="${iid}">
            <td class="admin-td-center">
              <input
                type="checkbox"
                data-testid="item-instock-${iid}"
                data-item-field="inStock"
                data-item-id="${iid}"
                ${item.inStock ? "checked" : ""}
              />
            </td>
            <td>
              <select
                class="admin-select"
                data-testid="item-category-${iid}"
                data-item-field="category"
                data-item-id="${iid}"
              >
                ${catOptions}
              </select>
            </td>
            <td>
              <input
                type="text"
                class="admin-input"
                data-testid="item-name-en-${iid}"
                data-item-field="nameEn"
                data-item-id="${iid}"
                value="${nameEn}"
                placeholder="English name"
              />
            </td>
            <td>
              <input
                type="text"
                dir="rtl"
                class="admin-input admin-input-rtl"
                data-testid="item-name-he-${iid}"
                data-item-field="nameHe"
                data-item-id="${iid}"
                value="${nameHe}"
                placeholder="שם בעברית"
              />
            </td>
            <td>
              <input
                type="text"
                dir="rtl"
                class="admin-input admin-input-rtl"
                data-testid="item-desc-he-${iid}"
                data-item-field="descHe"
                data-item-id="${iid}"
                value="${descHe}"
                placeholder="תיאור מנה"
              />
            </td>
            <td>
              <input
                type="number"
                class="admin-input admin-input-num"
                data-testid="item-price-${iid}"
                data-item-field="price"
                data-item-id="${iid}"
                value="${price}"
                step="1"
              />
            </td>
            <td>
              <div class="admin-item-photo-cell">
                <img
                  class="admin-item-photo-thumb ${resolvedPhotoUrl ? "" : "is-empty"}"
                  data-testid="item-photo-thumb-${iid}"
                  src="${escapeAttr(resolvedPhotoUrl || EMPTY_PIXEL_GIF)}"
                  alt=""
                  width="24"
                  height="24"
                />
                <select
                  class="admin-select admin-item-photo-select"
                  data-testid="item-photo-${iid}"
                  data-item-field="photo"
                  data-item-id="${iid}"
                >
                  ${renderItemPhotoOptionsHtml(item)}
                </select>
                <label
                  class="btn-secondary admin-btn-xs admin-inline-upload-label"
                  title="Upload photo directly for this item"
                >
                  <span>+</span>
                  <input
                    type="file"
                    accept="image/*"
                    class="admin-file-input-hidden"
                    data-testid="item-photo-upload-${iid}"
                    data-item-photo-upload="${iid}"
                  />
                </label>
              </div>
            </td>
            <td>
              <div class="admin-item-tags-cell" data-item-tags-cell="${iid}">
                ${renderItemTagPillsHtml(item)}
              </div>
            </td>
            <td class="admin-td-center">
              <div class="admin-row-actions">
                <button
                  type="button"
                  class="btn-secondary admin-btn-xs"
                  data-testid="duplicate-item-${iid}"
                  data-duplicate-item="${iid}"
                  title="Duplicate item"
                >
                  Copy
                </button>
                <button
                  type="button"
                  class="btn-danger admin-btn-xs"
                  data-testid="delete-item-${iid}"
                  data-delete-item="${iid}"
                >
                  Delete
                </button>
              </div>
            </td>
          </tr>
        `;
      })
      .join("");
  }

  function refreshItemPhotoThumb(item) {
    if (!itemsTbody) return;
    const thumb = itemsTbody.querySelector(`[data-testid="item-photo-thumb-${item.id}"]`);
    if (thumb) {
      const resolvedUrl = resolveItemPhotoUrl(item);
      thumb.src = resolvedUrl || EMPTY_PIXEL_GIF;
      thumb.classList.toggle("is-empty", !resolvedUrl);
    }
  }

  function refreshAllItemPhotoSelects() {
    if (!itemsTbody) return;
    for (const item of store.menuItems || []) {
      const sel = itemsTbody.querySelector(`[data-testid="item-photo-${item.id}"]`);
      if (sel) {
        sel.innerHTML = renderItemPhotoOptionsHtml(item);
      }
      refreshItemPhotoThumb(item);
    }
  }

  function focusItemNameInput(itemId) {
    if (!itemsTbody) return;
    const nameInput = itemsTbody.querySelector(`[data-testid="item-name-en-${itemId}"]`);
    if (nameInput) {
      if (typeof nameInput.scrollIntoView === "function") {
        nameInput.scrollIntoView({ block: "nearest" });
      }
      nameInput.focus();
    }
  }

  function refreshAllItemTagCells() {
    if (!itemsTbody) return;
    for (const item of store.menuItems || []) {
      const cell = itemsTbody.querySelector(`[data-item-tags-cell="${item.id}"]`);
      if (cell) {
        cell.innerHTML = renderItemTagPillsHtml(item);
      }
    }
  }

  // Initial render
  renderPhotosRegion();
  renderTagsRegion();
  renderItemsRegion();
  updateInspectorAndHeader();

  // Store Settings listeners
  if (isOpenInput) {
    isOpenInput.addEventListener("change", () => {
      store.isOpen = Boolean(isOpenInput.checked);
      markDirty();
    });
  }
  if (bitPhoneInput) {
    bitPhoneInput.addEventListener("input", () => {
      store.bitPhone = bitPhoneInput.value;
      markDirty();
    });
  }
  if (adminPinInput) {
    adminPinInput.addEventListener("input", () => {
      store.adminPin = adminPinInput.value;
      markDirty();
    });
  }
  if (closedNoteInput) {
    closedNoteInput.addEventListener("input", () => {
      store.closedNoteHe = closedNoteInput.value;
      store.closedMessageHe = closedNoteInput.value;
      markDirty();
    });
  }
  if (ownerNameInput) {
    ownerNameInput.addEventListener("input", () => {
      store.ownerNameHe = ownerNameInput.value;
      markDirty();
    });
  }
  if (contactEmailInput) {
    contactEmailInput.addEventListener("input", () => {
      store.contactEmail = contactEmailInput.value;
      markDirty();
    });
  }
  if (businessAddressInput) {
    businessAddressInput.addEventListener("input", () => {
      store.businessAddressHe = businessAddressInput.value;
      markDirty();
    });
  }
  if (a11yPhysicalInput) {
    a11yPhysicalInput.addEventListener("input", () => {
      store.accessibilityPhysicalHe = a11yPhysicalInput.value;
      markDirty();
    });
  }

  // Photo upload listener
  if (newPhotoFileInput) {
    newPhotoFileInput.addEventListener("change", () => {
      const file = newPhotoFileInput.files && newPhotoFileInput.files[0];
      if (!file) return;

      const rawLabel = (newPhotoLabelInput?.value || "").trim();
      const fallbackLabel = (file.name || "Photo").replace(/\.[^.]+$/, "");
      const label = rawLabel || fallbackLabel || "Photo";

      const uploadPromise = compressImageFileToDataUrl(file, 400, 0.82).then((dataUrl) => {
        const existingIds = new Set((store.photoAlbum || []).map((p) => p.id));
        const newId = slugifyId("photo", label, existingIds);
        const newPhoto = {
          id: newId,
          label,
          name: label,
          url: dataUrl,
          dataUrl,
        };
        store.photoAlbum.push(newPhoto);
        if (newPhotoLabelInput) {
          newPhotoLabelInput.value = "";
        }
        newPhotoFileInput.value = "";
        renderPhotosRegion();
        refreshAllItemPhotoSelects();
        markDirty();
        return newPhoto;
      });

      if (typeof window !== "undefined") {
        window.__lastPhotoUploadPromise = uploadPromise;
      }
    });
  }

  // Photo album label edit & delete listeners
  if (photosRegion) {
    photosRegion.addEventListener("input", (e) => {
      const inputEl = e.target.closest("[data-photo-id]");
      if (!inputEl) return;
      const pid = inputEl.getAttribute("data-photo-id");
      const photo = (store.photoAlbum || []).find((p) => p.id === pid);
      if (!photo) return;
      photo.label = inputEl.value;
      photo.name = inputEl.value;
      refreshAllItemPhotoSelects();
      markDirty();
    });

    photosRegion.addEventListener("click", (e) => {
      const delBtn = e.target.closest("[data-delete-photo]");
      if (!delBtn) return;
      const pid = delBtn.getAttribute("data-delete-photo");
      const removed = (store.photoAlbum || []).find((p) => p.id === pid);
      store.photoAlbum = (store.photoAlbum || []).filter((p) => p.id !== pid);
      for (const item of store.menuItems || []) {
        if (item.photoId === pid || (removed && item.photo === removed.url)) {
          item.photoId = "";
          item.photo = "";
          item.imageUrl = "";
          item.photoUrl = "";
        }
      }
      renderPhotosRegion();
      refreshAllItemPhotoSelects();
      markDirty();
    });
  }

  // Add Global Tag button
  if (addTagBtn) {
    addTagBtn.addEventListener("click", () => {
      const existingIds = new Set((store.globalTags || []).map((t) => t.id));
      const nextNum = (store.globalTags || []).length + 1;
      const newTagId = slugifyId("tag", `custom-${nextNum}`, existingIds);
      store.globalTags.push({
        id: newTagId,
        nameEn: "",
        labelEn: "",
        nameHe: "",
        labelHe: "",
        price: 0,
        priceDelta: 0,
        inStock: true,
      });
      renderTagsRegion();
      refreshAllItemTagCells();
      markDirty();
    });
  }

  // Global Tags table inline edit & delete
  if (tagsTbody) {
    const handleTagFieldUpdate = (e) => {
      const el = e.target.closest("[data-tag-field]");
      if (!el) return;
      const tid = el.getAttribute("data-tag-id");
      const field = el.getAttribute("data-tag-field");
      const tag = (store.globalTags || []).find((t) => t.id === tid);
      if (!tag) return;

      if (field === "inStock") {
        tag.inStock = Boolean(el.checked);
      } else if (field === "nameEn") {
        tag.nameEn = el.value;
        tag.labelEn = el.value;
        refreshAllItemTagCells();
      } else if (field === "nameHe") {
        tag.nameHe = el.value;
        tag.labelHe = el.value;
        refreshAllItemTagCells();
      } else if (field === "price") {
        const num = Number(el.value || 0);
        tag.price = Number.isNaN(num) ? 0 : num;
        tag.priceDelta = tag.price;
      }
      markDirty();
    };

    tagsTbody.addEventListener("input", handleTagFieldUpdate);
    tagsTbody.addEventListener("change", handleTagFieldUpdate);

    tagsTbody.addEventListener("click", (e) => {
      const delBtn = e.target.closest("[data-delete-tag]");
      if (!delBtn) return;
      const tid = delBtn.getAttribute("data-delete-tag");
      store.globalTags = (store.globalTags || []).filter((t) => t.id !== tid);
      for (const item of store.menuItems || []) {
        if (Array.isArray(item.tagIds)) {
          item.tagIds = item.tagIds.filter((id) => id !== tid);
        }
      }
      renderTagsRegion();
      refreshAllItemTagCells();
      markDirty();
    });
  }

  // Add Menu Item button
  if (addItemBtn) {
    addItemBtn.addEventListener("click", () => {
      const existingIds = new Set((store.menuItems || []).map((i) => i.id));
      const nextNum = (store.menuItems || []).length + 1;
      const newItemId = slugifyId("item", `custom-${nextNum}`, existingIds);
      store.menuItems.push({
        id: newItemId,
        category: "Coffee",
        nameEn: "",
        titleEn: "",
        nameHe: "",
        titleHe: "",
        descHe: "",
        price: 14,
        inStock: true,
        photo: "",
        imageUrl: "",
        photoUrl: "",
        photoId: "",
        tagIds: [],
      });
      renderItemsRegion();
      focusItemNameInput(newItemId);
      markDirty();
    });
  }

  // Menu Items table inline edit, inline photo upload, tag pill toggle, bulk tag toggle, duplicate, and delete
  if (itemsTbody) {
    const handleItemFieldUpdate = (e) => {
      const uploadInput = e.target.closest("[data-item-photo-upload]");
      if (uploadInput && e.type === "change") {
        const iid = uploadInput.getAttribute("data-item-photo-upload");
        const item = (store.menuItems || []).find((i) => i.id === iid);
        const file = uploadInput.files && uploadInput.files[0];
        if (!item || !file) return;

        const baseName = (
          item.nameEn ||
          item.nameHe ||
          (file.name || "Photo").replace(/\.[^.]+$/, "")
        ).trim();
        const label = baseName.endsWith("Photo") ? baseName : `${baseName} Photo`;

        const uploadPromise = compressImageFileToDataUrl(file, 400, 0.82).then((dataUrl) => {
          const existingIds = new Set((store.photoAlbum || []).map((p) => p.id));
          const newPhotoId = slugifyId("photo", label, existingIds);
          const newPhoto = {
            id: newPhotoId,
            label,
            name: label,
            url: dataUrl,
            dataUrl,
          };
          store.photoAlbum.push(newPhoto);
          item.photo = dataUrl;
          item.imageUrl = dataUrl;
          item.photoUrl = dataUrl;
          item.photoId = newPhotoId;
          uploadInput.value = "";
          renderPhotosRegion();
          refreshAllItemPhotoSelects();
          markDirty();
          return newPhoto;
        });

        if (typeof window !== "undefined") {
          window.__lastPhotoUploadPromise = uploadPromise;
        }
        return;
      }

      const el = e.target.closest("[data-item-field]");
      if (!el) return;
      const iid = el.getAttribute("data-item-id");
      const field = el.getAttribute("data-item-field");
      const item = (store.menuItems || []).find((i) => i.id === iid);
      if (!item) return;

      if (field === "inStock") {
        item.inStock = Boolean(el.checked);
      } else if (field === "category") {
        item.category = el.value;
      } else if (field === "nameEn") {
        item.nameEn = el.value;
        item.titleEn = el.value;
      } else if (field === "nameHe") {
        item.nameHe = el.value;
        item.titleHe = el.value;
      } else if (field === "descHe") {
        item.descHe = el.value;
      } else if (field === "price") {
        const num = Number(el.value || 0);
        item.price = Number.isNaN(num) ? 0 : num;
      } else if (field === "photo") {
        const val = el.value;
        const selectedOpt = el.selectedOptions && el.selectedOptions[0];
        const optPhotoId = selectedOpt ? selectedOpt.getAttribute("data-photo-id") : "";
        const matched = (store.photoAlbum || []).find(
          (p) =>
            (optPhotoId && p.id === optPhotoId) ||
            p.url === val ||
            p.id === val ||
            p.label === val
        );
        if (matched) {
          item.photo = matched.url;
          item.imageUrl = matched.url;
          item.photoUrl = matched.url;
          item.photoId = matched.id;
        } else {
          item.photo = val || "";
          item.imageUrl = val || "";
          item.photoUrl = val || "";
          item.photoId = "";
        }
        refreshItemPhotoThumb(item);
      }
      markDirty();
    };

    itemsTbody.addEventListener("input", handleItemFieldUpdate);
    itemsTbody.addEventListener("change", handleItemFieldUpdate);

    itemsTbody.addEventListener("click", (e) => {
      const bulkToggleBtn = e.target.closest("[data-toggle-all-item-tags]");
      if (bulkToggleBtn) {
        const iid = bulkToggleBtn.getAttribute("data-toggle-all-item-tags");
        const item = (store.menuItems || []).find((i) => i.id === iid);
        if (!item) return;
        const allTagIds = (store.globalTags || []).map((t) => t.id);
        const currentSet = new Set(Array.isArray(item.tagIds) ? item.tagIds : []);
        const allSelected = allTagIds.length > 0 && allTagIds.every((id) => currentSet.has(id));
        item.tagIds = allSelected ? [] : [...allTagIds];
        const cell = itemsTbody.querySelector(`[data-item-tags-cell="${iid}"]`);
        if (cell) {
          cell.innerHTML = renderItemTagPillsHtml(item);
        }
        markDirty();
        return;
      }

      const tagPill = e.target.closest("[data-toggle-item-tag]");
      if (tagPill) {
        const iid = tagPill.getAttribute("data-toggle-item-tag");
        const tid = tagPill.getAttribute("data-tag-id");
        const item = (store.menuItems || []).find((i) => i.id === iid);
        if (!item) return;
        item.tagIds = Array.isArray(item.tagIds) ? item.tagIds : [];
        if (item.tagIds.includes(tid)) {
          item.tagIds = item.tagIds.filter((id) => id !== tid);
        } else {
          item.tagIds.push(tid);
        }
        const cell = itemsTbody.querySelector(`[data-item-tags-cell="${iid}"]`);
        if (cell) {
          cell.innerHTML = renderItemTagPillsHtml(item);
        }
        markDirty();
        return;
      }

      const dupBtn = e.target.closest("[data-duplicate-item]");
      if (dupBtn) {
        const iid = dupBtn.getAttribute("data-duplicate-item");
        const sourceItem = (store.menuItems || []).find((i) => i.id === iid);
        if (!sourceItem) return;
        const existingIds = new Set((store.menuItems || []).map((i) => i.id));
        const copyEn = sourceItem.nameEn ? `${sourceItem.nameEn} (Copy)` : "";
        const copyHe = sourceItem.nameHe ? `${sourceItem.nameHe} (עותק)` : "";
        const newItemId = slugifyId("item", copyEn || "copy", existingIds);
        store.menuItems.push({
          id: newItemId,
          category: sourceItem.category || "Coffee",
          nameEn: copyEn,
          titleEn: copyEn,
          nameHe: copyHe,
          titleHe: copyHe,
          descHe: sourceItem.descHe || "",
          price: Number(sourceItem.price ?? 14),
          inStock: Boolean(sourceItem.inStock ?? true),
          photo: sourceItem.photo || "",
          imageUrl: sourceItem.imageUrl || sourceItem.photo || "",
          photoUrl: sourceItem.photoUrl || sourceItem.photo || "",
          photoId: sourceItem.photoId || "",
          tagIds: Array.isArray(sourceItem.tagIds) ? [...sourceItem.tagIds] : [],
        });
        renderItemsRegion();
        focusItemNameInput(newItemId);
        markDirty();
        return;
      }

      const delBtn = e.target.closest("[data-delete-item]");
      if (delBtn) {
        const iid = delBtn.getAttribute("data-delete-item");
        store.menuItems = (store.menuItems || []).filter((i) => i.id !== iid);
        renderItemsRegion();
        markDirty();
      }
    });
  }

  function triggerSaveStore() {
    saveStatusText = "Saving...";
    saveStatusTone = "saving";
    updateInspectorAndHeader();

    const p = saveStoreState(store)
      .then((updated) => {
        store = JSON.parse(JSON.stringify(updated));
        saveStatusText = "Saved ✓";
        saveStatusTone = "saved";
        renderPhotosRegion();
        renderTagsRegion();
        renderItemsRegion();
        updateInspectorAndHeader();
        return updated;
      })
      .catch((err) => {
        saveStatusText = `Save failed: ${err.message}`;
        saveStatusTone = "error";
        updateInspectorAndHeader();
        throw err;
      });

    if (typeof window !== "undefined") {
      window.__lastAdminSavePromise = p;
      window.__lastStoreSavePromise = p;
    }
    return p;
  }

  // Save Changes button
  if (saveBtnEl) {
    saveBtnEl.addEventListener("click", () => {
      triggerSaveStore();
    });
  }

  // Guided Quick-Add Product Modal
  function openQuickAddModal() {
    if (!quickAddModalHost) return;
    const defaultCoffeeTagIds = (store.globalTags || [])
      .filter((t) => t.inStock)
      .map((t) => t.id);

    const draft = {
      id: "preview-item",
      category: "Coffee",
      nameEn: "",
      nameHe: "",
      descHe: "",
      price: 14,
      inStock: true,
      photoId: "",
      photo: "",
      tagIds: [...defaultCoffeeTagIds],
      errorMsg: "",
    };

    function getPhotosByIdMap() {
      const map = {};
      for (const p of store.photoAlbum || []) {
        map[p.id] = p.url || p.dataUrl || "";
      }
      return map;
    }

    function updatePreviewRegion() {
      const previewEl = quickAddModalHost.querySelector('[data-testid="quick-add-preview"]');
      if (!previewEl) return;
      const previewItem = {
        ...draft,
        nameHe: draft.nameHe || "שם מוצר לדוגמה",
        descHe: draft.descHe || "תיאור קצר שיופיע ללקוחות בתפריט",
      };
      previewEl.innerHTML = renderMenuItemCard(previewItem, store, getPhotosByIdMap());
    }

    function renderModal() {
      const catOpts = ADMIN_CATEGORIES.map(
        (cat) =>
          `<option value="${escapeAttr(cat)}" ${
            draft.category === cat ? "selected" : ""
          }>${escapeHtml(cat)}</option>`
      ).join("");
      const photoOpts = renderItemPhotoOptionsHtml(draft);
      const tags = store.globalTags || [];
      const attachedSet = new Set(draft.tagIds);
      const allTagsSelected = tags.length > 0 && tags.every((t) => attachedSet.has(t.id));

      quickAddModalHost.innerHTML = `
        <div class="modal-backdrop" data-testid="quick-add-modal">
          <div class="modal-card admin-quick-add-card">
            <div class="sheet-header">
              <div>
                <h2 class="sheet-title">Quick Add Product</h2>
                <p class="sheet-subtitle">Add a menu item with photo, tags &amp; live customer preview</p>
              </div>
              <button
                type="button"
                class="sheet-close-btn"
                data-testid="quick-add-close-btn"
                aria-label="Close modal"
              >✕</button>
            </div>

            ${
              draft.errorMsg
                ? `<div class="pin-error" data-testid="quick-add-error" role="alert">${escapeHtml(draft.errorMsg)}</div>`
                : ""
            }

            <div class="admin-quick-add-grid">
              <label class="admin-field-label">
                <span>Category</span>
                <select class="admin-select" data-testid="quick-add-category">
                  ${catOpts}
                </select>
              </label>
              <label class="admin-field-label">
                <span>Price (₪)</span>
                <input
                  type="number"
                  class="admin-input admin-input-num"
                  data-testid="quick-add-price"
                  value="${Number(draft.price || 0)}"
                  step="1"
                />
              </label>
              <label class="admin-field-label">
                <span>Name (EN — for Barista KDS)</span>
                <input
                  type="text"
                  class="admin-input"
                  data-testid="quick-add-name-en"
                  value="${escapeAttr(draft.nameEn)}"
                  placeholder="e.g. Cold Brew"
                />
              </label>
              <label class="admin-field-label">
                <span>Name (HE — for Storefront)</span>
                <input
                  type="text"
                  dir="rtl"
                  class="admin-input admin-input-rtl"
                  data-testid="quick-add-name-he"
                  value="${escapeAttr(draft.nameHe)}"
                  placeholder="למשל: קולד ברו"
                />
              </label>
              <label class="admin-field-label admin-quick-add-span-2">
                <span>Description (HE)</span>
                <input
                  type="text"
                  dir="rtl"
                  class="admin-input admin-input-rtl"
                  data-testid="quick-add-desc-he"
                  value="${escapeAttr(draft.descHe)}"
                  placeholder="תיאור מנה בעברית"
                />
              </label>
              <div class="admin-field-label admin-quick-add-span-2">
                <span>Product Photo (Select existing or Upload new 400×400 JPEG)</span>
                <div class="admin-item-photo-cell">
                  <select class="admin-select admin-item-photo-select" data-testid="quick-add-photo-select">
                    ${photoOpts}
                  </select>
                  <label class="btn-secondary admin-btn-xs admin-inline-upload-label">
                    <span>+ Upload Photo</span>
                    <input
                      type="file"
                      accept="image/*"
                      class="admin-file-input-hidden"
                      data-testid="quick-add-photo-file"
                    />
                  </label>
                </div>
              </div>
              <div class="admin-field-label admin-quick-add-span-2">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <span>Attached Modifier Tags</span>
                  <button
                    type="button"
                    class="admin-item-tag-bulk-btn"
                    data-testid="quick-add-toggle-all-tags"
                  >
                    ${allTagsSelected ? "Clear All" : "Select All"}
                  </button>
                </div>
                <div class="admin-item-tags-cell" style="margin-top: 4px;">
                  ${tags
                    .map((t) => {
                      const sel = attachedSet.has(t.id);
                      const lbl = t.nameEn || t.labelEn || t.nameHe || t.id;
                      return `
                        <button
                          type="button"
                          class="admin-item-tag-pill ${sel ? "selected" : ""}"
                          data-testid="quick-add-tag-${escapeAttr(t.id)}"
                          data-quick-add-tag="${escapeAttr(t.id)}"
                        >
                          ${escapeHtml(lbl)}
                        </button>
                      `;
                    })
                    .join("")}
                </div>
              </div>
            </div>

            <div class="admin-quick-add-preview-wrap">
              <span class="admin-field-label" style="margin-bottom: 4px;">Live Customer Storefront Preview (RTL)</span>
              <div dir="rtl" data-testid="quick-add-preview"></div>
            </div>

            <div class="admin-quick-add-actions">
              <button
                type="button"
                class="btn-primary"
                style="width: 100%;"
                data-testid="quick-add-save-btn"
              >
                Add &amp; Save Product
              </button>
            </div>
          </div>
        </div>
      `;

      updatePreviewRegion();

      const closeBtn = quickAddModalHost.querySelector('[data-testid="quick-add-close-btn"]');
      const catEl = quickAddModalHost.querySelector('[data-testid="quick-add-category"]');
      const priceEl = quickAddModalHost.querySelector('[data-testid="quick-add-price"]');
      const nameEnEl = quickAddModalHost.querySelector('[data-testid="quick-add-name-en"]');
      const nameHeEl = quickAddModalHost.querySelector('[data-testid="quick-add-name-he"]');
      const descHeEl = quickAddModalHost.querySelector('[data-testid="quick-add-desc-he"]');
      const photoSelectEl = quickAddModalHost.querySelector('[data-testid="quick-add-photo-select"]');
      const photoFileEl = quickAddModalHost.querySelector('[data-testid="quick-add-photo-file"]');
      const toggleAllTagsBtn = quickAddModalHost.querySelector('[data-testid="quick-add-toggle-all-tags"]');
      const saveProductBtn = quickAddModalHost.querySelector('[data-testid="quick-add-save-btn"]');

      closeBtn?.addEventListener("click", () => {
        quickAddModalHost.innerHTML = "";
      });

      catEl?.addEventListener("change", () => {
        draft.category = catEl.value;
        if (draft.category === "Pastry") {
          draft.tagIds = [];
        } else if (draft.category === "Coffee" || draft.category === "Cold") {
          draft.tagIds = [...defaultCoffeeTagIds];
        }
        renderModal();
      });

      priceEl?.addEventListener("input", () => {
        const num = Number(priceEl.value || 0);
        draft.price = Number.isNaN(num) ? 0 : num;
        updatePreviewRegion();
      });

      function clearErrorIfValid() {
        if (draft.errorMsg && (draft.nameEn || "").trim() && (draft.nameHe || "").trim()) {
          draft.errorMsg = "";
          const errEl = quickAddModalHost.querySelector('[data-testid="quick-add-error"]');
          if (errEl) errEl.remove();
        }
      }

      nameEnEl?.addEventListener("input", () => {
        draft.nameEn = nameEnEl.value;
        clearErrorIfValid();
        updatePreviewRegion();
      });

      nameHeEl?.addEventListener("input", () => {
        draft.nameHe = nameHeEl.value;
        clearErrorIfValid();
        updatePreviewRegion();
      });

      descHeEl?.addEventListener("input", () => {
        draft.descHe = descHeEl.value;
        updatePreviewRegion();
      });

      photoSelectEl?.addEventListener("change", () => {
        const val = photoSelectEl.value;
        const opt = photoSelectEl.selectedOptions && photoSelectEl.selectedOptions[0];
        const pid = opt ? opt.getAttribute("data-photo-id") : "";
        draft.photo = val || "";
        draft.photoId = pid || "";
        updatePreviewRegion();
      });

      photoFileEl?.addEventListener("change", () => {
        const file = photoFileEl.files && photoFileEl.files[0];
        if (!file) return;
        const baseName = (
          draft.nameEn ||
          draft.nameHe ||
          (file.name || "Photo").replace(/\.[^.]+$/, "")
        ).trim();
        const label = baseName.endsWith("Photo") ? baseName : `${baseName} Photo`;
        const p = compressImageFileToDataUrl(file, 400, 0.82).then((dataUrl) => {
          const existingIds = new Set((store.photoAlbum || []).map((ph) => ph.id));
          const newPhotoId = slugifyId("photo", label, existingIds);
          const newPhoto = {
            id: newPhotoId,
            label,
            name: label,
            url: dataUrl,
            dataUrl,
          };
          store.photoAlbum.push(newPhoto);
          draft.photo = dataUrl;
          draft.photoId = newPhotoId;
          renderPhotosRegion();
          refreshAllItemPhotoSelects();
          markDirty();
          renderModal();
          return newPhoto;
        });
        if (typeof window !== "undefined") {
          window.__lastPhotoUploadPromise = p;
        }
      });

      toggleAllTagsBtn?.addEventListener("click", () => {
        const allIds = (store.globalTags || []).map((t) => t.id);
        const cur = new Set(draft.tagIds);
        const isAll = allIds.length > 0 && allIds.every((id) => cur.has(id));
        draft.tagIds = isAll ? [] : [...allIds];
        renderModal();
      });

      quickAddModalHost.querySelectorAll("[data-quick-add-tag]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const tid = btn.getAttribute("data-quick-add-tag");
          if (draft.tagIds.includes(tid)) {
            draft.tagIds = draft.tagIds.filter((id) => id !== tid);
          } else {
            draft.tagIds.push(tid);
          }
          renderModal();
        });
      });

      saveProductBtn?.addEventListener("click", () => {
        const cleanEn = String(draft.nameEn || "").trim();
        const cleanHe = String(draft.nameHe || "").trim();
        if (!cleanEn || !cleanHe) {
          draft.errorMsg = "Both English Name and Hebrew Name are required.";
          renderModal();
          return;
        }
        const existingIds = new Set((store.menuItems || []).map((i) => i.id));
        const newItemId = slugifyId("item", cleanEn, existingIds);
        store.menuItems.push({
          id: newItemId,
          category: draft.category || "Coffee",
          nameEn: cleanEn,
          titleEn: cleanEn,
          nameHe: cleanHe,
          titleHe: cleanHe,
          descHe: String(draft.descHe || "").trim(),
          price: Number(draft.price || 0),
          inStock: true,
          photo: draft.photo || "",
          imageUrl: draft.photo || "",
          photoUrl: draft.photo || "",
          photoId: draft.photoId || "",
          tagIds: [...draft.tagIds],
        });
        quickAddModalHost.innerHTML = "";
        renderItemsRegion();
        markDirty();
        triggerSaveStore();
      });
    }

    renderModal();
  }

  if (quickAddItemBtn) {
    quickAddItemBtn.addEventListener("click", () => {
      openQuickAddModal();
    });
  }

  // Keyboard shortcut: Cmd/Ctrl + S to Save Changes
  container.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && String(e.key || "").toLowerCase() === "s") {
      e.preventDefault();
      triggerSaveStore();
    }
  });

  // SPA navigation links
  container.addEventListener("click", (e) => {
    const navLink = e.target.closest("[data-nav]");
    if (navLink) {
      e.preventDefault();
      const targetPath = navLink.getAttribute("data-nav");
      window.history.pushState({}, "", targetPath);
      window.dispatchEvent(new PopStateEvent("popstate"));
    }
  });
}
