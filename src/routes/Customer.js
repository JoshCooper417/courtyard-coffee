/**
 * Customer Storefront Route ("/") — Hebrew RTL mobile-first layout
 * orchestrating CUJ-01 (Storefront & Inline Stepper), CUJ-02 (TagBottomSheet),
 * and CUJ-03 (CheckoutSheet & StaticReceipt).
 */
import {
  appState,
  addToCart,
  clearCart,
  fetchStoreState,
  getUntaggedCartEntry,
  submitCustomerOrder,
  updateCartItemQty,
} from "../state.js";
import { renderCustomerHeader } from "../components/CustomerHeader.js";
import { renderMenuItemCard } from "../components/MenuItemCard.js";
import { renderStickyCartBar } from "../components/StickyCartBar.js";
import { mountTagBottomSheet } from "../components/TagBottomSheet.js";
import { mountCheckoutSheet } from "../components/CheckoutSheet.js";
import { mountStaticReceipt } from "../components/StaticReceipt.js";

const CATEGORY_LABELS_HE = {
  All: "הכל",
  Coffee: "קפה",
  Pastry: "מאפים",
  Cold: "משקאות קרים",
  Other: "אחר",
};

export function mountCustomerRoute(container, initialStore) {
  document.documentElement.setAttribute("dir", "rtl");
  document.documentElement.setAttribute("lang", "he");

  let store = initialStore;

  function getPhotosById() {
    const map = {};
    for (const photo of store?.photoAlbum || []) {
      map[photo.id] = photo.url || photo.dataUrl;
    }
    return map;
  }

  function render() {
    if (appState.activeOrder) {
      mountStaticReceipt(container, appState.activeOrder, store, () => {
        appState.activeOrder = null;
        render();
      });
      return;
    }

    const isOpen = Boolean(store?.isOpen);
    const photosById = getPhotosById();
    const categories = [
      "All",
      ...new Set((store?.menuItems || []).map((i) => i.category || "Other")),
    ];
    const activeCat = appState.selectedCategory || "All";
    const visibleItems = (store?.menuItems || []).filter(
      (item) => activeCat === "All" || item.category === activeCat
    );
    const itemsById = {};
    for (const item of store?.menuItems || []) {
      itemsById[item.id] = item;
    }

    container.innerHTML = `
      <main class="customer-shell" dir="rtl" data-testid="customer-storefront">
        ${renderCustomerHeader(store)}

        <nav class="category-tabs" aria-label="קטגוריות תפריט">
          ${categories
            .map(
              (cat) => `
              <button
                type="button"
                class="category-pill ${cat === activeCat ? "active" : ""}"
                data-category="${cat}"
                data-testid="category-pill-${cat}"
              >
                ${CATEGORY_LABELS_HE[cat] || cat}
              </button>
            `
            )
            .join("")}
        </nav>

        <section class="menu-list" data-testid="menu-list">
          ${visibleItems
            .map((item) => renderMenuItemCard(item, store, photosById))
            .join("")}
        </section>

        ${renderStickyCartBar()}
        <div id="customer-sheet-host"></div>
      </main>
    `;

    const sheetHost = container.querySelector("#customer-sheet-host");

    // Category filter tabs
    container.querySelectorAll(".category-pill").forEach((btn) => {
      btn.addEventListener("click", () => {
        appState.selectedCategory = btn.getAttribute("data-category") || "All";
        render();
      });
    });

    // Add item buttons (instant inline stepper for untagged, TagBottomSheet for tagged)
    container.querySelectorAll("[data-add-item]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const itemId = btn.getAttribute("data-add-item");
        const item = itemsById[itemId];
        if (!item || !item.inStock) return;
        const hasTags = Array.isArray(item.tagIds) && item.tagIds.length > 0;
        if (hasTags) {
          appState.activeTagSheetItemId = item.id;
          render();
        } else if (isOpen) {
          addToCart(store, item, [], "", 1);
          render();
        }
      });
    });

    // Inline stepper increment / decrement for untagged items
    container.querySelectorAll("[data-stepper-inc]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (!isOpen) return;
        const itemId = btn.getAttribute("data-stepper-inc");
        const item = itemsById[itemId];
        if (!item) return;
        addToCart(store, item, [], "", 1);
        render();
      });
    });

    container.querySelectorAll("[data-stepper-dec]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (!isOpen) return;
        const itemId = btn.getAttribute("data-stepper-dec");
        const entry = getUntaggedCartEntry(itemId);
        if (!entry) return;
        updateCartItemQty(entry.key, entry.qty - 1);
        render();
      });
    });

    // Sticky Cart Bar -> Open Checkout Sheet
    const cartBar = container.querySelector('[data-testid="sticky-cart-bar"]');
    if (cartBar) {
      cartBar.addEventListener("click", () => {
        if (!isOpen) return;
        appState.isCheckoutOpen = true;
        render();
      });
    }

    // Mount active TagBottomSheet if open
    if (appState.activeTagSheetItemId && sheetHost) {
      const activeItem = itemsById[appState.activeTagSheetItemId];
      if (activeItem) {
        mountTagBottomSheet(
          sheetHost,
          activeItem,
          store,
          (selectedTagIds, note) => {
            addToCart(store, activeItem, selectedTagIds, note, 1);
            appState.activeTagSheetItemId = null;
            render();
          },
          () => {
            appState.activeTagSheetItemId = null;
            render();
          }
        );
      }
    } else if (appState.isCheckoutOpen && sheetHost) {
      mountCheckoutSheet(
        sheetHost,
        async ({ customerName, customerPhone }) => {
          const orderPayload = {
            customerName,
            customerPhone,
            items: appState.cart.map((c) => ({
              itemId: c.itemId,
              qty: c.qty,
              selectedTagIds: c.selectedTagIds,
              note: c.note,
            })),
          };
          const createdOrder = await submitCustomerOrder(orderPayload);
          store = await fetchStoreState();
          clearCart();
          appState.isCheckoutOpen = false;
          appState.activeOrder = createdOrder;
          render();
        },
        () => {
          appState.isCheckoutOpen = false;
          render();
        }
      );
    }
  }

  render();
}
