/**
 * Customer Storefront Route ("/") — Hebrew RTL mobile-first layout.
 */
import { appState } from "../state.js";

const CATEGORY_LABELS_HE = {
  All: "הכל",
  Coffee: "קפה",
  Pastry: "מאפים",
  Cold: "משקאות קרים",
  Other: "אחר",
};

export function mountCustomerRoute(container, store) {
  document.documentElement.setAttribute("dir", "rtl");
  document.documentElement.setAttribute("lang", "he");

  const photosById = {};
  for (const photo of store.photoAlbum || []) {
    photosById[photo.id] = photo.url || photo.dataUrl;
  }

  function render() {
    const isOpen = Boolean(store.isOpen);
    const categories = ["All", ...new Set((store.menuItems || []).map((i) => i.category || "Other"))];
    const activeCat = appState.selectedCategory || "All";
    const visibleItems = (store.menuItems || []).filter(
      (item) => activeCat === "All" || item.category === activeCat
    );

    container.innerHTML = `
      <main class="customer-shell" dir="rtl" data-testid="customer-storefront">
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
                  store.closedNoteHe || "סגור כעת, נשוב בקרוב"
                }</div>`
              : ""
          }
        </header>

        <nav class="category-tabs" aria-label="קטגוריות תפריט">
          ${categories
            .map(
              (cat) => `
              <button
                type="button"
                class="category-pill ${cat === activeCat ? "active" : ""}"
                data-category="${cat}"
              >
                ${CATEGORY_LABELS_HE[cat] || cat}
              </button>
            `
            )
            .join("")}
        </nav>

        <section class="menu-list" data-testid="menu-list">
          ${visibleItems
            .map((item) => {
              const itemTitleHe = item.nameHe || item.titleHe || "";
              const thumbUrl = item.photo || photosById[item.photoId] || "";
              const disabled = !isOpen || !item.inStock;
              return `
                <article
                  class="menu-card ${disabled ? "disabled" : "clickable"}"
                  data-testid="menu-card-${item.id}"
                  data-item-id="${item.id}"
                >
                  ${
                    thumbUrl
                      ? `<img class="menu-thumb" src="${thumbUrl}" alt="${itemTitleHe}" />`
                      : `<div class="menu-thumb" aria-hidden="true"></div>`
                  }
                  <div class="menu-card-body">
                    <h2 class="menu-card-title">${itemTitleHe}</h2>
                    <p class="menu-card-desc">${item.descHe || ""}</p>
                    <div class="menu-card-footer">
                      <span class="price-tag">₪${item.price}</span>
                      <button
                        type="button"
                        class="add-btn"
                        data-testid="add-item-${item.id}"
                        ${disabled ? "disabled" : ""}
                      >
                        ${item.inStock ? "+ הוסף" : "אזל מהמלאי"}
                      </button>
                    </div>
                  </div>
                </article>
              `;
            })
            .join("")}
        </section>
      </main>
    `;

    container.querySelectorAll(".category-pill").forEach((btn) => {
      btn.addEventListener("click", () => {
        appState.selectedCategory = btn.getAttribute("data-category") || "All";
        render();
      });
    });
  }

  render();
}
