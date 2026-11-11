/**
 * Customer Storefront Header Component (Hebrew RTL).
 */
export function renderCustomerHeader(store) {
  const isOpen = Boolean(store?.isOpen);
  return `
    <a href="#menu-main-content" class="skip-link" data-testid="skip-to-content-link">
      דלג לתוכן העיקרי
    </a>
    <header class="store-header">
      <div class="store-header-top">
        <div>
          <h1 class="store-brand-title">קפה בחצר</h1>
          <p class="store-brand-subtitle">קפה ומאפים טריים בחצר הפנימית</p>
        </div>
        <span class="status-badge ${isOpen ? "open" : "closed"}" data-testid="store-status-badge">
          ${isOpen ? "פתוח להזמנות" : "סגור כעת"}
        </span>
      </div>
      ${
        !isOpen
          ? `<div class="closed-banner" data-testid="closed-banner" role="status">${
              store?.closedNoteHe || store?.closedMessageHe || "סגור כעת, נשוב בקרוב"
            }</div>`
          : ""
      }
    </header>
  `;
}
