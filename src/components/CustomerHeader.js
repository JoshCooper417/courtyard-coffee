/**
 * Customer Storefront Header Component (Hebrew RTL) — Café Eden (קפה עדן).
 */
const LEAF_SPRIG_SVG = `
  <svg class="brand-leaf-sprig" viewBox="0 0 24 14" width="20" height="12" aria-hidden="true" focusable="false">
    <path d="M2 11 C7 9, 13 5, 22 3" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" />
    <path d="M8 8.5 C7 4, 11 2, 13.5 5.2 C11.5 7.2, 9.5 8.2, 8 8.5 Z" fill="currentColor" />
    <path d="M14.5 5.8 C15 2, 19.5 1.5, 20.5 4.2 C18.2 5.6, 16.2 6, 14.5 5.8 Z" fill="currentColor" />
  </svg>
`;

export function renderCustomerHeader(store) {
  const isOpen = Boolean(store?.isOpen);
  return `
    <a href="#menu-main-content" class="skip-link" data-testid="skip-to-content-link">
      דלג לתוכן העיקרי
    </a>
    <header class="store-header">
      <div class="store-header-top">
        <div class="store-brand-wrap">
          <div class="store-logo-frame">
            <img
              src="/src/assets/cafe-eden-logo.jpg"
              alt="לוגו קפה עדן"
              width="68"
              height="68"
              class="store-logo-img"
              data-testid="store-brand-logo"
            />
          </div>
          <div class="store-brand-text">
            <h1 class="store-brand-title">קפה עדן</h1>
            <p class="store-brand-subtitle">
              ${LEAF_SPRIG_SVG}
              <span>קפה בטבע</span>
              ${LEAF_SPRIG_SVG}
            </p>
          </div>
        </div>
        <span class="status-badge ${isOpen ? "open" : "closed"}" data-testid="store-status-badge">
          ${isOpen ? "פתוח להזמנות" : "סגור כעת"}
        </span>
      </div>
      ${
        !isOpen
          ? `<div class="closed-banner" data-testid="closed-banner" role="status">${
              store?.closedNoteHe || store?.closedMessageHe || "קפה עדן סגור כעת, נשוב בקרוב"
            }</div>`
          : ""
      }
    </header>
  `;
}
