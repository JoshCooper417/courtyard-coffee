/**
 * CheckoutSheet Component — Collects customer name & phone and submits order via POST /api/order.
 * Includes Section 11 (Amendment 13 to the Israeli Privacy Protection Law) point-of-collection disclosure.
 */
import { appState, escapeHtml, getCartTotals, updateCartItemQty } from "../state.js";
import { mountPrivacyPolicyModal } from "./LegalModals.js";

export function mountCheckoutSheet(hostEl, onSubmitOrder, onClose, onEditCartEntry = null) {
  let customerName = appState.checkoutDraft?.customerName || "";
  let customerPhone = appState.checkoutDraft?.customerPhone || "";
  let errorMsg = "";
  let isSubmitting = false;

  const itemsById = {};
  for (const item of appState.store?.menuItems || []) {
    itemsById[item.id] = item;
  }

  function handleKeyDown(e) {
    if (e.key === "Escape") {
      cleanupAndClose();
    }
  }

  function cleanupAndClose() {
    if (typeof window !== "undefined") {
      window.removeEventListener("keydown", handleKeyDown);
    }
    onClose();
  }

  if (typeof window !== "undefined") {
    window.addEventListener("keydown", handleKeyDown);
  }

  function render() {
    const { totalPrice } = getCartTotals();

    hostEl.innerHTML = `
      <div class="modal-backdrop sheet-backdrop" data-testid="checkout-sheet" dir="rtl">
        <div class="modal-card bottom-sheet-card" role="dialog" aria-modal="true" aria-label="סיום הזמנה">
          <div class="sheet-header">
            <div>
              <h2 class="sheet-title">סיום הזמנה</h2>
              <p class="sheet-subtitle">נא להזין פרטים לקבלת עדכון כשהמנה מוכנה</p>
            </div>
            <button
              type="button"
              class="sheet-close-btn"
              data-testid="close-checkout-btn"
              aria-label="סגור"
            >✕</button>
          </div>

          <div class="checkout-summary-list" data-testid="checkout-summary-list">
            ${appState.cart
              .map((entry, idx) => {
                const menuItem = itemsById[entry.itemId];
                const isCustomizable = Boolean(
                  menuItem && Array.isArray(menuItem.tagIds) && menuItem.tagIds.length > 0
                );
                const safeKey = escapeHtml(entry.key);
                return `
                <div class="checkout-summary-item" data-testid="checkout-summary-item-${idx}">
                  <div class="checkout-summary-item-main">
                    <strong>${entry.qty} × ${escapeHtml(entry.nameHe)}</strong>
                    ${
                      entry.tagsHe && entry.tagsHe.length > 0
                        ? `<div class="checkout-item-meta">${escapeHtml(entry.tagsHe.join(", "))}</div>`
                        : ""
                    }
                    ${
                      entry.note
                        ? `<div class="checkout-item-note">הערה: "${escapeHtml(entry.note)}"</div>`
                        : ""
                    }
                    <div class="checkout-item-actions">
                      <div class="inline-stepper compact" role="group" aria-label="כמות עבור ${escapeHtml(entry.nameHe)}">
                        <button
                          type="button"
                          class="stepper-btn compact"
                          data-testid="checkout-dec-${idx}"
                          data-checkout-dec="${safeKey}"
                          aria-label="הפחת כמות של ${escapeHtml(entry.nameHe)}"
                        >−</button>
                        <span class="stepper-qty" data-testid="checkout-qty-${idx}">${entry.qty}</span>
                        <button
                          type="button"
                          class="stepper-btn compact"
                          data-testid="checkout-inc-${idx}"
                          data-checkout-inc="${safeKey}"
                          aria-label="הוסף כמות של ${escapeHtml(entry.nameHe)}"
                        >+</button>
                      </div>
                      ${
                        isCustomizable && typeof onEditCartEntry === "function"
                          ? `<button
                              type="button"
                              class="cart-entry-btn edit"
                              data-testid="checkout-edit-${idx}"
                              data-checkout-edit="${safeKey}"
                              aria-label="ערוך ${escapeHtml(entry.nameHe)}"
                            >ערוך</button>`
                          : ""
                      }
                      <button
                        type="button"
                        class="cart-entry-btn remove"
                        data-testid="checkout-remove-${idx}"
                        data-checkout-remove="${safeKey}"
                        aria-label="הסר ${escapeHtml(entry.nameHe)} מהעגלה"
                      >הסר</button>
                    </div>
                  </div>
                  <span class="price-tag">${entry.lineTotal} ₪</span>
                </div>
              `;
              })
              .join("")}
            <div class="checkout-summary-total">
              <span>סה״כ לתשלום</span>
              <strong data-testid="checkout-total-price">${totalPrice} ₪</strong>
            </div>
          </div>

          <form id="checkout-form" class="checkout-form">
            <div class="sheet-section">
              <label class="sheet-section-title" for="checkout-name-input">שם מלא *</label>
              <input
                id="checkout-name-input"
                type="text"
                class="sheet-input"
                data-testid="checkout-name-input"
                placeholder="למשל: דניאל"
                value="${customerName.replace(/"/g, "&quot;")}"
                required
              />
            </div>

            <div class="sheet-section">
              <label class="sheet-section-title" for="checkout-phone-input">טלפון נייד (לוואטסאפ) *</label>
              <input
                id="checkout-phone-input"
                type="tel"
                dir="ltr"
                class="sheet-input"
                data-testid="checkout-phone-input"
                placeholder="054-9876543"
                value="${customerPhone.replace(/"/g, "&quot;")}"
                required
              />
            </div>

            <div class="checkout-privacy-notice" data-testid="checkout-privacy-notice">
              <span>
                מסירת הפרטים אינה חובה על פי דין, אך ללא מסירתם לא נוכל להפיק את ההזמנה ולשלוח עדכון בוואטסאפ כשהיא מוכנה. הפרטים ישמשו להכנת ההזמנה בלבד (ללא דיוור שיווקי) בהתאם ל־
              </span>
              <button
                type="button"
                class="inline-legal-link-btn"
                data-testid="checkout-open-privacy-btn"
              >מדיניות הפרטיות (תיקון 13)</button>.
            </div>

            ${
              errorMsg
                ? `<div class="pin-error" data-testid="checkout-error" role="alert">${errorMsg}</div>`
                : ""
            }

            <button
              type="submit"
              class="btn-primary sheet-confirm-btn"
              data-testid="submit-order-btn"
              ${isSubmitting ? "disabled" : ""}
            >
              ${isSubmitting ? "שולח הזמנה..." : `שלח הזמנה • ${totalPrice} ₪`}
            </button>
          </form>
        </div>
      </div>
    `;

    const nameInput = hostEl.querySelector('[data-testid="checkout-name-input"]');
    const phoneInput = hostEl.querySelector('[data-testid="checkout-phone-input"]');
    if (nameInput) {
      nameInput.addEventListener("input", (e) => {
        customerName = e.target.value;
        appState.checkoutDraft.customerName = customerName;
      });
    }
    if (phoneInput) {
      phoneInput.addEventListener("input", (e) => {
        customerPhone = e.target.value;
        appState.checkoutDraft.customerPhone = customerPhone;
      });
    }

    hostEl.querySelectorAll("[data-checkout-inc]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const key = btn.getAttribute("data-checkout-inc");
        const entry = appState.cart.find((c) => c.key === key);
        if (!entry) return;
        updateCartItemQty(key, entry.qty + 1);
        render();
      });
    });

    hostEl.querySelectorAll("[data-checkout-dec]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const key = btn.getAttribute("data-checkout-dec");
        const entry = appState.cart.find((c) => c.key === key);
        if (!entry) return;
        updateCartItemQty(key, entry.qty - 1);
        if (appState.cart.length === 0) {
          cleanupAndClose();
        } else {
          render();
        }
      });
    });

    hostEl.querySelectorAll("[data-checkout-remove]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const key = btn.getAttribute("data-checkout-remove");
        updateCartItemQty(key, 0);
        if (appState.cart.length === 0) {
          cleanupAndClose();
        } else {
          render();
        }
      });
    });

    hostEl.querySelectorAll("[data-checkout-edit]").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (typeof onEditCartEntry !== "function") return;
        const key = btn.getAttribute("data-checkout-edit");
        const entry = appState.cart.find((c) => c.key === key);
        if (!entry) return;
        if (typeof window !== "undefined") {
          window.removeEventListener("keydown", handleKeyDown);
        }
        onEditCartEntry(entry);
      });
    });

    const openPrivacyBtn = hostEl.querySelector('[data-testid="checkout-open-privacy-btn"]');
    if (openPrivacyBtn) {
      openPrivacyBtn.addEventListener("click", () => {
        if (typeof window !== "undefined") {
          window.removeEventListener("keydown", handleKeyDown);
        }
        mountPrivacyPolicyModal(hostEl, appState.store, () => {
          if (typeof window !== "undefined") {
            window.addEventListener("keydown", handleKeyDown);
          }
          render();
        });
      });
    }

    const closeBtn = hostEl.querySelector('[data-testid="close-checkout-btn"]');
    if (closeBtn) {
      closeBtn.addEventListener("click", () => cleanupAndClose());
    }

    const backdrop = hostEl.querySelector('[data-testid="checkout-sheet"]');
    if (backdrop) {
      backdrop.addEventListener("click", (e) => {
        if (e.target === backdrop) cleanupAndClose();
      });
    }

    const form = hostEl.querySelector("#checkout-form");
    if (form) {
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const trimmedName = String(customerName || "").trim();
        const trimmedPhone = String(customerPhone || "").trim();
        if (!trimmedName || !trimmedPhone) {
          errorMsg = "נא למלא שם ומספר טלפון";
          render();
          return;
        }
        isSubmitting = true;
        errorMsg = "";
        render();
        try {
          if (typeof window !== "undefined") {
            window.removeEventListener("keydown", handleKeyDown);
          }
          await onSubmitOrder({
            customerName: trimmedName,
            customerPhone: trimmedPhone,
          });
        } catch (err) {
          if (typeof window !== "undefined") {
            window.addEventListener("keydown", handleKeyDown);
          }
          isSubmitting = false;
          errorMsg = err.message || "שגיאה בשליחת ההזמנה";
          render();
        }
      });
    }
  }

  render();
}
