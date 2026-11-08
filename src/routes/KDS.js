/**
 * Barista Kitchen Display System ("/admin/kds") — English LTR layout.
 * Implements CUJ-04 (unlocked KDS shell), CUJ-05 (2000ms order polling, Web Audio chime,
 * 2-tap WhatsApp -> Done ticket lifecycle, and Completed Orders drawer), and
 * CUJ-06 (Quick-86 stock toggles, Store Open/Close toggle, and Hebrew Closed-Note auto-save).
 */
import {
  fetchOrders,
  fetchStoreState,
  patchOrderStatus,
  resetAllOrders,
  saveStoreState,
} from "../state.js";
import { playGentleChime } from "../utils/chime.js";
import { buildHebrewWhatsAppUrl } from "../utils/wa.js";

function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function decodeWaPreviewText(waUrl) {
  try {
    const qIdx = waUrl.indexOf("?text=");
    if (qIdx === -1) return "";
    return decodeURIComponent(waUrl.slice(qIdx + 6));
  } catch (_err) {
    return "";
  }
}

export function mountKdsRoute(container, initialStore) {
  document.documentElement.setAttribute("dir", "ltr");
  document.documentElement.setAttribute("lang", "en");

  if (typeof window !== "undefined" && window.__kdsPollInterval) {
    clearInterval(window.__kdsPollInterval);
    window.__kdsPollInterval = null;
  }

  let store = initialStore;
  let allOrders = [];
  let lastOrdersSignature = "";
  let isDrawerOpen = false;
  const seenOrderIds = new Set();
  const copiedTicketNums = new Set();

  if (typeof window !== "undefined") {
    window.__resetKdsSeenOrders = () => {
      seenOrderIds.clear();
    };
  }

  function persistStore(nextStore) {
    const p = saveStoreState(nextStore)
      .then((updated) => {
        store = updated;
        return updated;
      })
      .catch(() => store);
    if (typeof window !== "undefined") {
      window.__lastStoreSavePromise = p;
    }
    return p;
  }

  // Mount static region skeleton so polling never clobbers the Closed-Note input
  container.innerHTML = `
    <main class="admin-shell kds-shell" dir="ltr" data-testid="kds-view">
      <div id="kds-header-region"></div>
      <div id="kds-controls-region"></div>
      <div id="kds-orders-region"></div>
      <div id="kds-drawer-region"></div>
    </main>
  `;

  const headerRegion = container.querySelector("#kds-header-region");
  const controlsRegion = container.querySelector("#kds-controls-region");
  const ordersRegion = container.querySelector("#kds-orders-region");
  const drawerRegion = container.querySelector("#kds-drawer-region");

  function renderHeader() {
    if (!headerRegion) return;
    const isOpen = Boolean(store?.isOpen);
    headerRegion.innerHTML = `
      <header class="admin-topbar kds-topbar">
        <div class="kds-brand-col">
          <div class="kds-title-row">
            <h1 class="kds-main-title">Courtyard Coffee — Barista KDS</h1>
            <span
              class="status-badge ${isOpen ? "open" : "closed"}"
              data-testid="kds-status-badge"
            >
              ${isOpen ? "OPEN" : "CLOSED"}
            </span>
          </div>
          <p class="kds-subtitle">
            Live Order Queue • Next Order #${store?.nextOrderNumber || 101}
          </p>
        </div>

        <div class="kds-topbar-actions">
          <button
            type="button"
            class="${isOpen ? "btn-danger" : "btn-primary"} kds-open-toggle-btn"
            data-testid="kds-open-toggle"
          >
            ${isOpen ? "Close Store" : "Open Store"}
          </button>

          <button
            type="button"
            class="btn-secondary kds-reset-btn"
            data-testid="kds-shift-reset-btn"
          >
            Reset Shift (101)
          </button>

          <nav class="admin-nav-links" aria-label="Admin Navigation">
            <a href="/admin/kds" class="admin-nav-link active" data-nav="/admin/kds">KDS Queue</a>
            <a href="/admin/menu" class="admin-nav-link" data-nav="/admin/menu">Menu &amp; Settings</a>
            <a href="/" class="admin-nav-link" data-nav="/">Storefront</a>
          </nav>
        </div>
      </header>
    `;

    const openToggleBtn = headerRegion.querySelector('[data-testid="kds-open-toggle"]');
    if (openToggleBtn) {
      openToggleBtn.addEventListener("click", async () => {
        store.isOpen = !store.isOpen;
        renderHeader();
        await persistStore(store);
        renderHeader();
      });
    }

    const resetBtn = headerRegion.querySelector('[data-testid="kds-shift-reset-btn"]');
    if (resetBtn) {
      resetBtn.addEventListener("click", async () => {
        await resetAllOrders();
        seenOrderIds.clear();
        store = await fetchStoreState();
        allOrders = await fetchOrders();
        lastOrdersSignature = JSON.stringify(allOrders);
        renderHeader();
        renderQuick86Host();
        renderOrders();
        renderDrawer();
      });
    }
  }

  function renderControls() {
    if (!controlsRegion) return;
    const currentNote = store?.closedNoteHe || store?.closedMessageHe || "סגור כעת, נשוב בקרוב";

    controlsRegion.innerHTML = `
      <section class="kds-ops-panel">
        <div class="kds-closed-note-bar">
          <div class="kds-closed-note-label-group">
            <label for="kds-closed-note-input" class="kds-panel-label">
              Closed Banner Note (Hebrew RTL — Auto-Saves)
            </label>
            <span class="kds-panel-hint">Displayed on customer storefront when store is CLOSED</span>
          </div>
          <input
            id="kds-closed-note-input"
            type="text"
            dir="rtl"
            class="kds-closed-note-input"
            data-testid="kds-closed-note-input"
            placeholder="סגור כעת, נשוב בקרוב"
            value="${escapeHtml(currentNote)}"
          />
        </div>

        <div id="kds-quick86-host"></div>
      </section>
    `;

    const noteInput = controlsRegion.querySelector('[data-testid="kds-closed-note-input"]');
    if (noteInput) {
      const saveNote = () => {
        const val = noteInput.value;
        store.closedNoteHe = val;
        store.closedMessageHe = val;
        persistStore(store);
      };
      noteInput.addEventListener("input", saveNote);
      noteInput.addEventListener("change", saveNote);
      noteInput.addEventListener("blur", saveNote);
    }

    renderQuick86Host();
  }

  function renderQuick86Host() {
    const host = controlsRegion?.querySelector("#kds-quick86-host");
    if (!host) return;
    const globalTags = store?.globalTags || [];
    const menuItems = store?.menuItems || [];

    host.innerHTML = `
      <div class="kds-quick86-strip" data-testid="kds-quick86-strip">
        <div class="kds-quick86-group">
          <span class="kds-quick86-title">Quick-86 Modifiers:</span>
          <div class="kds-quick86-pills">
            ${globalTags
              .map((tag) => {
                const nameEn = tag.nameEn || tag.labelEn || tag.id;
                const inStock = Boolean(tag.inStock);
                return `
                  <button
                    type="button"
                    class="kds-quick86-pill ${inStock ? "in-stock" : "out-of-stock"}"
                    data-testid="quick86-tag-${tag.id}"
                    data-q86-tag="${tag.id}"
                    aria-pressed="${!inStock}"
                  >
                    <span class="${inStock ? "kds-stock-name" : "tag-strike"}">${escapeHtml(nameEn)}</span>
                    <span class="kds-86-badge ${inStock ? "stock-ok" : "stock-out"}">
                      ${inStock ? "In Stock" : "86'd"}
                    </span>
                  </button>
                `;
              })
              .join("")}
          </div>
        </div>

        <div class="kds-quick86-group">
          <span class="kds-quick86-title">Quick-86 Menu Items:</span>
          <div class="kds-quick86-pills">
            ${menuItems
              .map((item) => {
                const nameEn = item.nameEn || item.titleEn || item.id;
                const inStock = Boolean(item.inStock);
                return `
                  <button
                    type="button"
                    class="kds-quick86-pill ${inStock ? "in-stock" : "out-of-stock"}"
                    data-testid="quick86-item-${item.id}"
                    data-q86-item="${item.id}"
                    aria-pressed="${!inStock}"
                  >
                    <span class="${inStock ? "kds-stock-name" : "tag-strike"}">${escapeHtml(nameEn)}</span>
                    <span class="kds-86-badge ${inStock ? "stock-ok" : "stock-out"}">
                      ${inStock ? "In Stock" : "86'd"}
                    </span>
                  </button>
                `;
              })
              .join("")}
          </div>
        </div>
      </div>
    `;

    host.querySelectorAll("[data-q86-tag]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const tagId = btn.getAttribute("data-q86-tag");
        const target = (store.globalTags || []).find((t) => t.id === tagId);
        if (!target) return;
        target.inStock = !target.inStock;
        renderQuick86Host();
        await persistStore(store);
        renderQuick86Host();
      });
    });

    host.querySelectorAll("[data-q86-item]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const itemId = btn.getAttribute("data-q86-item");
        const target = (store.menuItems || []).find((i) => i.id === itemId);
        if (!target) return;
        target.inStock = !target.inStock;
        renderQuick86Host();
        await persistStore(store);
        renderQuick86Host();
      });
    });
  }

  function renderOrders() {
    if (!ordersRegion) return;
    const activeOrders = allOrders.filter((o) => !o.isDone);

    if (activeOrders.length === 0) {
      ordersRegion.innerHTML = `
        <section class="kds-orders-grid empty" data-testid="kds-orders-grid">
          <div class="kds-empty-card" data-testid="kds-empty-state">
            <h2 class="kds-empty-title">No Active Tickets in Queue</h2>
            <p class="kds-empty-desc">
              Waiting for incoming orders (#${store?.nextOrderNumber || 101}+). Polling every 2s with gentle audio chime.
            </p>
          </div>
        </section>
      `;
      return;
    }

    ordersRegion.innerHTML = `
      <section class="kds-orders-grid" data-testid="kds-orders-grid">
        ${activeOrders
          .map((order) => {
            const num = order.number ?? order.orderNumber;
            const isNotified = Boolean(order.isNotified);
            const waUrl = buildHebrewWhatsAppUrl(order.customerPhone, order);
            const waPreviewText = decodeWaPreviewText(waUrl);
            const isCopied = copiedTicketNums.has(num);

            return `
              <article
                class="kds-ticket-card ${isNotified ? "notified" : "pending"}"
                data-testid="kds-ticket-${num}"
              >
                <div class="kds-ticket-header">
                  <div class="kds-ticket-id-group">
                    <span class="kds-ticket-num" data-testid="kds-ticket-number-${num}">#${num}</span>
                    <span
                      class="kds-ticket-badge ${isNotified ? "notified" : "new"}"
                      data-testid="kds-ticket-status-${num}"
                    >
                      ${isNotified ? "✓ WhatsApp Sent" : "New Ticket"}
                    </span>
                  </div>
                  <div class="kds-ticket-total" data-testid="kds-ticket-total-${num}">₪${order.total}</div>
                </div>

                <div class="kds-ticket-customer">
                  <strong>${escapeHtml(order.customerName)}</strong>
                  <span class="kds-ticket-phone">${escapeHtml(order.customerPhone)}</span>
                </div>

                <ul class="kds-ticket-items">
                  ${(order.items || [])
                    .map((item) => {
                      const qty = item.qty ?? 1;
                      const nameEn = item.nameEn || item.titleEn || item.nameHe || "";
                      const tagsEn = Array.isArray(item.tagsEn) ? item.tagsEn : [];
                      const note = String(item.note || "").trim();
                      return `
                        <li class="kds-ticket-item">
                          <div class="kds-item-main-line">
                            <span class="kds-item-title">${qty}x ${escapeHtml(nameEn)}</span>
                            <span class="kds-item-line-price">₪${item.lineTotal ?? item.unitPrice * qty}</span>
                          </div>
                          ${
                            tagsEn.length > 0
                              ? `<div class="kds-item-tags">
                                  ${tagsEn
                                    .map((t) => `<span class="kds-tag-pill">${escapeHtml(t)}</span>`)
                                    .join("")}
                                </div>`
                              : ""
                          }
                          ${
                            note
                              ? `<div class="kds-ticket-note" data-testid="kds-ticket-note-${num}">
                                  Note: "${escapeHtml(note)}"
                                </div>`
                              : ""
                          }
                        </li>
                      `;
                    })
                    .join("")}
                </ul>

                <div class="kds-wa-preview-box">
                  <div class="kds-wa-preview-header">
                    <span class="kds-wa-preview-label">WhatsApp Ready Message (Hebrew)</span>
                    <button
                      type="button"
                      class="kds-copy-wa-btn"
                      data-testid="copy-wa-text-${num}"
                      data-copy-wa-num="${num}"
                    >
                      ${isCopied ? "Copied! ✓" : "Copy Text"}
                    </button>
                  </div>
                  <pre class="kds-wa-preview-text" dir="rtl" data-testid="wa-preview-${num}">${escapeHtml(waPreviewText)}</pre>
                </div>

                <div class="kds-ticket-actions">
                  ${
                    !isNotified
                      ? `<button
                          type="button"
                          class="btn-primary kds-action-btn"
                          data-testid="notify-wa-btn-${num}"
                          data-notify-id="${order.id}"
                          data-notify-num="${num}"
                        >
                          Notify on WhatsApp
                        </button>`
                      : `<button
                          type="button"
                          class="btn-terracotta kds-action-btn"
                          data-testid="done-order-btn-${num}"
                          data-done-id="${order.id}"
                          data-done-num="${num}"
                        >
                          Done / Pick-up
                        </button>`
                  }
                </div>
              </article>
            `;
          })
          .join("")}
      </section>
    `;

    ordersRegion.querySelectorAll("[data-copy-wa-num]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const num = Number(btn.getAttribute("data-copy-wa-num"));
        const order = allOrders.find((o) => (o.number ?? o.orderNumber) === num);
        if (!order) return;
        const waUrl = buildHebrewWhatsAppUrl(order.customerPhone, order);
        const text = decodeWaPreviewText(waUrl);
        if (typeof window !== "undefined") {
          window.__lastCopiedText = text;
        }
        try {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(text);
          }
        } catch (_err) {
          // Fallback already stored on window.__lastCopiedText
        }
        copiedTicketNums.add(num);
        renderOrders();
      });
    });

    ordersRegion.querySelectorAll("[data-notify-id]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const orderId = btn.getAttribute("data-notify-id");
        const order = allOrders.find((o) => o.id === orderId);
        if (!order) return;
        const waUrl = buildHebrewWhatsAppUrl(order.customerPhone, order);
        if (typeof window !== "undefined") {
          window.__lastWindowOpenUrl = waUrl;
          try {
            window.open(waUrl, "_blank", "noopener,noreferrer");
          } catch (_err) {
            // Popup blocked or headless environment
          }
        }
        const updated = await patchOrderStatus(orderId, { isNotified: true });
        const idx = allOrders.findIndex((o) => o.id === orderId);
        if (idx !== -1) {
          allOrders[idx] = updated;
        }
        lastOrdersSignature = JSON.stringify(allOrders);
        renderOrders();
        renderDrawer();
      });
    });

    ordersRegion.querySelectorAll("[data-done-id]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const orderId = btn.getAttribute("data-done-id");
        const updated = await patchOrderStatus(orderId, {
          isDone: true,
          status: "done",
        });
        const idx = allOrders.findIndex((o) => o.id === orderId);
        if (idx !== -1) {
          allOrders[idx] = updated;
        }
        lastOrdersSignature = JSON.stringify(allOrders);
        renderOrders();
        renderDrawer();
      });
    });
  }

  function renderDrawer() {
    if (!drawerRegion) return;
    const doneOrders = allOrders.filter((o) => o.isDone);

    drawerRegion.innerHTML = `
      <section class="kds-completed-section">
        <button
          type="button"
          class="kds-drawer-toggle-btn"
          data-testid="kds-completed-drawer-toggle"
          aria-expanded="${isDrawerOpen ? "true" : "false"}"
        >
          <span>Completed Orders (${doneOrders.length})</span>
          <span>${isDrawerOpen ? "▲ Hide" : "▼ Show"}</span>
        </button>

        ${
          isDrawerOpen
            ? `<div class="kds-completed-drawer" data-testid="kds-completed-drawer">
                ${
                  doneOrders.length === 0
                    ? `<p class="kds-completed-empty">No completed orders in this shift yet.</p>`
                    : doneOrders
                        .map((order) => {
                          const num = order.number ?? order.orderNumber;
                          const itemSummary = (order.items || [])
                            .map((i) => {
                              const tags =
                                Array.isArray(i.tagsEn) && i.tagsEn.length > 0
                                  ? ` (${i.tagsEn.join(", ")})`
                                  : "";
                              return `${i.qty ?? 1}x ${i.nameEn || i.titleEn || i.nameHe}${tags}`;
                            })
                            .join(" • ");
                          return `
                            <div
                              class="kds-completed-card"
                              data-testid="completed-ticket-${num}"
                            >
                              <div class="kds-completed-main">
                                <span class="kds-completed-num">#${num}</span>
                                <span class="kds-completed-cust">${escapeHtml(order.customerName)} (${escapeHtml(order.customerPhone)})</span>
                                <span class="kds-completed-items">${escapeHtml(itemSummary)}</span>
                              </div>
                              <div class="kds-completed-right">
                                <span class="kds-completed-total">₪${order.total}</span>
                                <span class="kds-completed-badge">Picked Up ✓</span>
                              </div>
                            </div>
                          `;
                        })
                        .join("")
                }
              </div>`
            : ""
        }
      </section>
    `;

    const toggleBtn = drawerRegion.querySelector('[data-testid="kds-completed-drawer-toggle"]');
    if (toggleBtn) {
      toggleBtn.addEventListener("click", () => {
        isDrawerOpen = !isDrawerOpen;
        renderDrawer();
      });
    }
  }

  async function pollOrders() {
    if (typeof document !== "undefined" && !document.querySelector('[data-testid="kds-view"]')) {
      if (typeof window !== "undefined" && window.__kdsPollInterval) {
        clearInterval(window.__kdsPollInterval);
        window.__kdsPollInterval = null;
      }
      return;
    }

    try {
      const fetched = await fetchOrders();
      let hasNewActiveOrder = false;
      for (const ord of fetched) {
        if (!ord.isDone && !seenOrderIds.has(ord.id)) {
          seenOrderIds.add(ord.id);
          hasNewActiveOrder = true;
        }
      }
      if (hasNewActiveOrder) {
        playGentleChime();
      }

      const nextSig = JSON.stringify(fetched);
      if (nextSig !== lastOrdersSignature) {
        allOrders = fetched;
        lastOrdersSignature = nextSig;
        renderOrders();
        renderDrawer();
      }
    } catch (_err) {
      // Ignore transient network errors during background poll
    }
  }

  if (typeof window !== "undefined") {
    window.__triggerKdsPoll = pollOrders;
  }

  renderHeader();
  renderControls();
  renderOrders();
  renderDrawer();

  pollOrders();
  if (typeof window !== "undefined") {
    window.__kdsPollInterval = setInterval(pollOrders, 2000);
  }
}
