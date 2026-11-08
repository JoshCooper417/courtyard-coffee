/**
 * TagBottomSheet Component — Hebrew RTL modifier tag selector & kitchen note input.
 */

export function mountTagBottomSheet(hostEl, item, store, onConfirm, onClose) {
  const isOpen = Boolean(store?.isOpen);
  const tagsById = {};
  for (const t of store?.globalTags || []) {
    tagsById[t.id] = t;
  }
  const attachedTags = (item.tagIds || [])
    .map((tid) => tagsById[tid])
    .filter(Boolean);

  const selectedIds = new Set();
  let noteValue = "";

  function computeUnitPrice() {
    let total = Number(item.price || 0);
    for (const tid of selectedIds) {
      const t = tagsById[tid];
      if (t && t.inStock) {
        total += Number(t.price ?? t.priceDelta ?? 0);
      }
    }
    return total;
  }

  function render() {
    const unitPrice = computeUnitPrice();
    const itemTitleHe = item.nameHe || item.titleHe || "";

    hostEl.innerHTML = `
      <div class="modal-backdrop sheet-backdrop" data-testid="tag-bottom-sheet" dir="rtl">
        <div class="modal-card bottom-sheet-card" role="dialog" aria-modal="true" aria-label="${itemTitleHe}">
          <div class="sheet-header">
            <div>
              <h2 class="sheet-title">${itemTitleHe}</h2>
              <p class="sheet-subtitle">מחיר בסיס: ₪${item.price}</p>
            </div>
            <button
              type="button"
              class="sheet-close-btn"
              data-testid="close-tag-sheet-btn"
              aria-label="סגור"
            >✕</button>
          </div>

          <div class="sheet-section">
            <h3 class="sheet-section-title">תוספות ושינויים</h3>
            <div class="tag-pills-grid">
              ${attachedTags
                .map((tag) => {
                  const tagNameHe = tag.nameHe || tag.labelHe || "";
                  const tagPrice = Number(tag.price ?? tag.priceDelta ?? 0);
                  const priceLabel = tagPrice > 0 ? ` (+${tagPrice} ₪)` : "";
                  const isSelected = selectedIds.has(tag.id);
                  if (!tag.inStock) {
                    return `
                      <button
                        type="button"
                        class="tag-option-pill out-of-stock"
                        data-testid="tag-pill-${tag.id}"
                        data-tag-id="${tag.id}"
                        disabled
                      >
                        <span class="tag-strike">${tagNameHe}${priceLabel}</span>
                        <span class="tag-oos-badge">(אזל)</span>
                      </button>
                    `;
                  }
                  return `
                    <button
                      type="button"
                      class="tag-option-pill ${isSelected ? "selected" : ""}"
                      data-testid="tag-pill-${tag.id}"
                      data-tag-id="${tag.id}"
                      aria-pressed="${isSelected ? "true" : "false"}"
                    >
                      <span>${tagNameHe}${priceLabel}</span>
                    </button>
                  `;
                })
                .join("")}
            </div>
          </div>

          <div class="sheet-section">
            <label class="sheet-section-title" for="item-note-input">הערות למנה</label>
            <input
              id="item-note-input"
              type="text"
              class="sheet-input"
              data-testid="item-note-input"
              placeholder="הערה למנה (למשל: חם מאוד)..."
              value="${noteValue.replace(/"/g, "&quot;")}"
            />
          </div>

          <button
            type="button"
            class="btn-primary sheet-confirm-btn"
            data-testid="confirm-customization-btn"
            ${!isOpen ? "disabled" : ""}
          >
            ${isOpen ? `הוסף להזמנה • ${unitPrice} ₪` : "החנות סגורה כעת"}
          </button>
        </div>
      </div>
    `;

    const noteInput = hostEl.querySelector('[data-testid="item-note-input"]');
    if (noteInput) {
      noteInput.addEventListener("input", (e) => {
        noteValue = e.target.value;
      });
    }

    hostEl.querySelectorAll(".tag-option-pill:not([disabled])").forEach((btn) => {
      btn.addEventListener("click", () => {
        const tid = btn.getAttribute("data-tag-id");
        if (selectedIds.has(tid)) {
          selectedIds.delete(tid);
        } else {
          selectedIds.add(tid);
        }
        render();
      });
    });

    const closeBtn = hostEl.querySelector('[data-testid="close-tag-sheet-btn"]');
    if (closeBtn) {
      closeBtn.addEventListener("click", () => onClose());
    }

    const backdrop = hostEl.querySelector('[data-testid="tag-bottom-sheet"]');
    if (backdrop) {
      backdrop.addEventListener("click", (e) => {
        if (e.target === backdrop) onClose();
      });
    }

    const confirmBtn = hostEl.querySelector('[data-testid="confirm-customization-btn"]');
    if (confirmBtn) {
      confirmBtn.addEventListener("click", () => {
        if (!isOpen) return;
        onConfirm(Array.from(selectedIds), noteValue);
      });
    }
  }

  render();
}
