/**
 * StickyCartBar Component — Fixed bottom bar displaying item count and total price in NIS.
 */
import { getCartTotals } from "../state.js";

export function renderStickyCartBar() {
  const { totalItems, totalPrice } = getCartTotals();
  if (totalItems <= 0) {
    return "";
  }
  const itemsLabel = totalItems === 1 ? "פריט 1" : `${totalItems} פריטים`;
  return `
    <div class="sticky-cart-wrapper" dir="rtl">
      <button
        type="button"
        class="sticky-cart-bar"
        data-testid="sticky-cart-bar"
      >
        <div class="sticky-cart-right">
          <span class="sticky-cart-count" data-testid="cart-bar-count">${itemsLabel}</span>
          <span class="sticky-cart-cta">לסיום הזמנה ותשלום</span>
        </div>
        <span class="sticky-cart-total" data-testid="cart-bar-total">${totalPrice} ₪</span>
      </button>
    </div>
  `;
}
