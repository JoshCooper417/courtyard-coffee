/**
 * MenuItemCard Component — supports instant inline stepper for untagged items
 * and TagBottomSheet trigger for tagged items.
 */
import { escapeHtml, getCartEntriesForItem, getUntaggedCartEntry } from "../state.js";

export function renderMenuItemCard(item, store, photosById) {
  const isOpen = Boolean(store?.isOpen);
  const itemTitleHe = item.nameHe || item.titleHe || "";
  const thumbUrl = item.photo || photosById[item.photoId] || "";
  const hasTags = Array.isArray(item.tagIds) && item.tagIds.length > 0;
  const untaggedEntry = !hasTags ? getUntaggedCartEntry(item.id) : null;
  const taggedEntries = hasTags ? getCartEntriesForItem(item.id) : [];
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
      ${
        taggedEntries.length > 0
          ? `<div class="card-cart-entries" data-testid="card-cart-entries-${item.id}">
              ${taggedEntries
                .map((entry, idx) => {
                  const tagsLabel =
                    entry.tagsHe && entry.tagsHe.length > 0
                      ? entry.tagsHe.join(", ")
                      : "ללא תוספות";
                  const noteLabel = entry.note ? ` • "${escapeHtml(entry.note)}"` : "";
                  const safeKey = escapeHtml(entry.key);
                  return `
                    <div class="card-cart-entry-row" data-testid="card-cart-entry-${item.id}-${idx}">
                      <div class="card-cart-entry-info">
                        <span class="card-cart-entry-meta">${escapeHtml(tagsLabel)}${noteLabel}</span>
                        <span class="card-cart-entry-price">${entry.lineTotal} ₪</span>
                      </div>
                      <div class="card-cart-entry-actions">
                        <div class="inline-stepper compact" role="group" aria-label="כמות עבור ${escapeHtml(itemTitleHe)}">
                          <button
                            type="button"
                            class="stepper-btn compact"
                            data-testid="dec-card-entry-${item.id}-${idx}"
                            data-dec-cart-key="${safeKey}"
                            aria-label="הפחת כמות של ${escapeHtml(itemTitleHe)}"
                            ${!isOpen ? "disabled" : ""}
                          >−</button>
                          <span class="stepper-qty" data-testid="qty-card-entry-${item.id}-${idx}">${entry.qty}</span>
                          <button
                            type="button"
                            class="stepper-btn compact"
                            data-testid="inc-card-entry-${item.id}-${idx}"
                            data-inc-cart-key="${safeKey}"
                            aria-label="הוסף כמות של ${escapeHtml(itemTitleHe)}"
                            ${!isOpen ? "disabled" : ""}
                          >+</button>
                        </div>
                        <button
                          type="button"
                          class="cart-entry-btn edit"
                          data-testid="edit-card-entry-${item.id}-${idx}"
                          data-edit-cart-key="${safeKey}"
                          aria-label="ערוך ${escapeHtml(itemTitleHe)}"
                          ${!isOpen ? "disabled" : ""}
                        >ערוך</button>
                        <button
                          type="button"
                          class="cart-entry-btn remove"
                          data-testid="remove-card-entry-${item.id}-${idx}"
                          data-remove-cart-key="${safeKey}"
                          aria-label="הסר ${escapeHtml(itemTitleHe)} מהעגלה"
                          ${!isOpen ? "disabled" : ""}
                        >הסר</button>
                      </div>
                    </div>
                  `;
                })
                .join("")}
            </div>`
          : ""
      }
    </article>
  `;
}
