/**
 * MenuItemCard Component — supports instant inline stepper for untagged items
 * and TagBottomSheet trigger for tagged items.
 */
import { getUntaggedCartEntry } from "../state.js";

export function renderMenuItemCard(item, store, photosById) {
  const isOpen = Boolean(store?.isOpen);
  const itemTitleHe = item.nameHe || item.titleHe || "";
  const thumbUrl = item.photo || photosById[item.photoId] || "";
  const hasTags = Array.isArray(item.tagIds) && item.tagIds.length > 0;
  const untaggedEntry = !hasTags ? getUntaggedCartEntry(item.id) : null;
  const isOut = !item.inStock;
  const cardDisabled = isOut || (!isOpen && !hasTags);

  let actionHtml = "";
  if (isOut) {
    actionHtml = `
      <button
        type="button"
        class="add-btn"
        data-testid="add-item-${item.id}"
        aria-label="${itemTitleHe} — אזל מהמלאי"
        disabled
      >
        אזל מהמלאי
      </button>
    `;
  } else if (!hasTags && untaggedEntry && untaggedEntry.qty > 0) {
    actionHtml = `
      <div class="inline-stepper" data-testid="inline-stepper-${item.id}" role="group" aria-label="כמות עבור ${itemTitleHe}">
        <button
          type="button"
          class="stepper-btn"
          data-testid="stepper-dec-${item.id}"
          data-stepper-dec="${item.id}"
          aria-label="הפחת כמות של ${itemTitleHe}"
          ${!isOpen ? "disabled" : ""}
        >−</button>
        <span class="stepper-qty" data-testid="stepper-qty-${item.id}" aria-live="polite">${untaggedEntry.qty}</span>
        <button
          type="button"
          class="stepper-btn"
          data-testid="stepper-inc-${item.id}"
          data-stepper-inc="${item.id}"
          aria-label="הוסף כמות של ${itemTitleHe}"
          ${!isOpen ? "disabled" : ""}
        >+</button>
      </div>
    `;
  } else {
    actionHtml = `
      <button
        type="button"
        class="add-btn"
        data-testid="add-item-${item.id}"
        data-add-item="${item.id}"
        aria-label="הוסף ${itemTitleHe} להזמנה"
        ${!isOpen && !hasTags ? "disabled" : ""}
      >
        + הוסף
      </button>
    `;
  }

  return `
    <article
      class="menu-card ${cardDisabled ? "disabled" : "clickable"}"
      data-testid="menu-card-${item.id}"
      data-item-id="${item.id}"
    >
      ${
        thumbUrl
          ? `<img class="menu-thumb" src="${thumbUrl}" alt="${itemTitleHe}" width="88" height="88" />`
          : `<div class="menu-thumb" aria-hidden="true"></div>`
      }
      <div class="menu-card-body">
        <h2 class="menu-card-title">${itemTitleHe}</h2>
        <p class="menu-card-desc">${item.descHe || ""}</p>
        <div class="menu-card-footer">
          <span class="price-tag">₪${item.price}</span>
          ${actionHtml}
        </div>
      </div>
    </article>
  `;
}
