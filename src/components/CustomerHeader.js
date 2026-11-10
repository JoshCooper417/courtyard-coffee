/**
 * Customer Storefront Header Component (Hebrew RTL).
 */
import { hasActiveAccessibilityPrefs } from "./AccessibilityWidget.js";

export function renderCustomerHeader(store) {
  const isOpen = Boolean(store?.isOpen);
  const a11yActive = hasActiveAccessibilityPrefs();
  return `
    <a href="#menu-main-content" class="skip-link" data-testid="skip-to-content-link">
      דלג לתוכן העיקרי
    </a>
    <header class="store-header">
      <div class="store-header-top">
        <div>
          <div class="store-brand-title-row">
            <h1 class="store-brand-title">קפה בחצר</h1>
            <button
              type="button"
              class="a11y-header-btn ${a11yActive ? "active" : ""}"
              data-testid="a11y-widget-toggle"
              aria-label="תפריט התאמות נגישות"
              title="התאמות נגישות (ת״י 5568)"
            >
              <span aria-hidden="true">♿</span>
              <span>נגישות</span>
            </button>
          </div>
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
