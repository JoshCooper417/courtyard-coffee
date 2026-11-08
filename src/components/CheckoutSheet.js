/**
 * CheckoutSheet Component — Collects customer name & phone and submits order via POST /api/order.
 */
import { appState, getCartTotals } from "../state.js";

export function mountCheckoutSheet(hostEl, onSubmitOrder, onClose) {
  let customerName = "";
  let customerPhone = "";
  let errorMsg = "";
  let isSubmitting = false;

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
              .map(
                (entry) => `
                <div class="checkout-summary-item">
                  <div>
                    <strong>${entry.qty} × ${entry.nameHe}</strong>
                    ${
                      entry.tagsHe && entry.tagsHe.length > 0
                        ? `<div class="checkout-item-meta">${entry.tagsHe.join(", ")}</div>`
                        : ""
                    }
                    ${
                      entry.note
                        ? `<div class="checkout-item-note">הערה: "${entry.note}"</div>`
                        : ""
                    }
                  </div>
                  <span class="price-tag">${entry.lineTotal} ₪</span>
                </div>
              `
              )
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
      });
    }
    if (phoneInput) {
      phoneInput.addEventListener("input", (e) => {
        customerPhone = e.target.value;
      });
    }

    const closeBtn = hostEl.querySelector('[data-testid="close-checkout-btn"]');
    if (closeBtn) {
      closeBtn.addEventListener("click", () => onClose());
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
          await onSubmitOrder({
            customerName: trimmedName,
            customerPhone: trimmedPhone,
          });
        } catch (err) {
          isSubmitting = false;
          errorMsg = err.message || "שגיאה בשליחת ההזמנה";
          render();
        }
      });
    }
  }

  render();
}
