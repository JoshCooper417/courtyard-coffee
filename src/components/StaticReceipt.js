/**
 * StaticReceipt Component — Post-checkout confirmation screen with Order #101,
 * 240x240 ISO/IEC 18004 Bit QR Code, and Copy Phone button.
 */
import { buildBitPaymentUrl, generateQrDataUrl } from "../utils/qr.js";

export function mountStaticReceipt(container, order, store, onBackToMenu) {
  const bitPhone = store?.bitPhone || "050-0000000";
  const bitUrl = buildBitPaymentUrl(bitPhone);
  const qrDataUrl = generateQrDataUrl(bitUrl, 240);
  const orderNumber = order.number ?? order.orderNumber ?? 101;
  const totalNis = order.total ?? order.totalNis ?? 0;
  let copied = false;

  function render() {
    container.innerHTML = `
      <main class="customer-shell" dir="rtl" data-testid="static-receipt">
        <section class="receipt-card">
          <div class="receipt-badge-wrap">
            <span class="receipt-status-pill">ההזמנה התקבלה בהצלחה ✓</span>
            <h1 class="receipt-order-num" data-testid="receipt-order-number">#${orderNumber}</h1>
            <p class="receipt-customer-info">
              עבור <strong>${order.customerName}</strong> • <span dir="ltr">${order.customerPhone || ""}</span>
            </p>
          </div>

          <div class="receipt-items-box" data-testid="receipt-items-list">
            <h2 class="sheet-section-title">פירוט הזמנה</h2>
            ${(order.items || [])
              .map((item) => {
                const titleHe = item.nameHe || item.titleHe || "";
                const tagsHe = Array.isArray(item.tagsHe) ? item.tagsHe : [];
                return `
                  <div class="checkout-summary-item">
                    <div>
                      <strong>${item.qty} × ${titleHe}</strong>
                      ${
                        tagsHe.length > 0
                          ? `<div class="checkout-item-meta">${tagsHe.join(", ")}</div>`
                          : ""
                      }
                      ${
                        item.note
                          ? `<div class="checkout-item-note">הערה: "${item.note}"</div>`
                          : ""
                      }
                    </div>
                    <span class="price-tag">${item.lineTotal ?? item.unitPrice * item.qty} ₪</span>
                  </div>
                `;
              })
              .join("")}
            <div class="checkout-summary-total">
              <span>סה״כ לתשלום</span>
              <strong data-testid="receipt-total">${totalNis} ₪</strong>
            </div>
          </div>

          <div class="receipt-payment-box">
            <h2 class="sheet-section-title" style="text-align: center;">תשלום מהיר ב-Bit / PayBox</h2>
            <p style="margin: 0 0 8px; font-size: 0.85rem; color: var(--text-stone); text-align: center;">
              סרקו או לחצו על הקוד, או העתיקו את המספר לתשלום:
            </p>
            <a
              href="${bitUrl}"
              target="_blank"
              rel="noopener noreferrer"
              class="qr-frame"
              data-testid="receipt-qr-link"
            >
              <img
                src="${qrDataUrl}"
                alt="Bit QR Code"
                width="240"
                height="240"
                class="receipt-qr-img"
                data-testid="receipt-qr-img"
                data-qr-payload="${bitUrl}"
              />
            </a>
            <div class="copy-phone-row">
              <span class="bit-phone-display" dir="ltr" data-testid="bit-phone-display">${bitPhone}</span>
              <button
                type="button"
                class="btn-secondary copy-phone-btn"
                data-testid="copy-phone-btn"
              >
                ${copied ? "הועתק! ✓" : "העתק מספר"}
              </button>
            </div>
          </div>

          <button
            type="button"
            class="btn-primary"
            style="width: 100%; margin-top: 16px;"
            data-testid="back-to-menu-btn"
          >
            חזרה לתפריט
          </button>
        </section>
      </main>
    `;

    const copyBtn = container.querySelector('[data-testid="copy-phone-btn"]');
    if (copyBtn) {
      copyBtn.addEventListener("click", () => {
        if (typeof window !== "undefined") {
          window.__lastCopiedText = bitPhone;
        }
        if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
          navigator.clipboard.writeText(bitPhone).catch(() => {});
        }
        copied = true;
        render();
      });
    }

    const backBtn = container.querySelector('[data-testid="back-to-menu-btn"]');
    if (backBtn) {
      backBtn.addEventListener("click", () => {
        onBackToMenu();
      });
    }
  }

  render();
}
