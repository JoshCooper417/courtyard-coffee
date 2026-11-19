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
  updateCartItem,
  updateCartItemQty,
} from "../state.js";
import { renderCustomerHeader } from "../components/CustomerHeader.js";
import { renderMenuItemCard } from "../components/MenuItemCard.js";
import { renderStickyCartBar } from "../components/StickyCartBar.js";
import { mountTagBottomSheet } from "../components/TagBottomSheet.js";
import { mountCheckoutSheet } from "../components/CheckoutSheet.js";
import { mountStaticReceipt } from "../components/StaticReceipt.js";
import {
  applyAccessibilityPrefsToDom,
  mountAccessibilityMenuModal,
} from "../components/AccessibilityWidget.js";
import {
  mountAccessibilityStatementModal,
  mountPrivacyPolicyModal,
  renderStoreFooter,
} from "../components/LegalModals.js";

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
  applyAccessibilityPrefsToDom();

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
                aria-pressed="${cat === activeCat ? "true" : "false"}"
              >
                ${CATEGORY_LABELS_HE[cat] || cat}
              </button>
            `
            )
            .join("")}
        </nav>

        <section id="menu-main-content" class="menu-list" data-testid="menu-list" tabindex="-1">
          ${visibleItems
            .map((item) => renderMenuItemCard(item, store, photosById))
            .join("")}
        </section>

        ${renderStoreFooter()}
        ${renderStickyCartBar()}
        <div id="customer-sheet-host"></div>
      </main>
    `;

    const sheetHost = container.querySelector("#customer-sheet-host");

    // Accessibility & Legal buttons (header + footer)
    const openA11yMenu = () => {
      appState.activeLegalModal = "a11y-menu";
      render();
    };
    const openA11yStatement = () => {
      appState.activeLegalModal = "a11y-statement";
      render();
    };
    const openPrivacyPolicy = () => {
      appState.activeLegalModal = "privacy-policy";
      render();
    };

    container
      .querySelector('[data-testid="footer-a11y-menu-btn"]')
      ?.addEventListener("click", openA11yMenu);
    container
      .querySelector('[data-testid="footer-a11y-statement-btn"]')
      ?.addEventListener("click", openA11yStatement);
    container
      .querySelector('[data-testid="footer-privacy-policy-btn"]')
      ?.addEventListener("click", openPrivacyPolicy);

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
          appState.activeTagSheetEditKey = null;
          appState.reopenCheckoutAfterTagSheet = false;
          render();
        } else if (isOpen) {
          addToCart(store, item, [], "", 1);
          render();
        }
      });
    });

    // Customized cart entry controls directly on MenuItemCard
    container.querySelectorAll("[data-inc-cart-key]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (!isOpen) return;
        const key = btn.getAttribute("data-inc-cart-key");
        const entry = appState.cart.find((c) => c.key === key);
        if (!entry) return;
        updateCartItemQty(key, entry.qty + 1);
        render();
      });
    });

    container.querySelectorAll("[data-dec-cart-key]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (!isOpen) return;
        const key = btn.getAttribute("data-dec-cart-key");
        const entry = appState.cart.find((c) => c.key === key);
        if (!entry) return;
        updateCartItemQty(key, entry.qty - 1);
        render();
      });
    });

    container.querySelectorAll("[data-remove-cart-key]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (!isOpen) return;
        const key = btn.getAttribute("data-remove-cart-key");
        updateCartItemQty(key, 0);
        render();
      });
    });

    container.querySelectorAll("[data-edit-cart-key]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (!isOpen) return;
        const key = btn.getAttribute("data-edit-cart-key");
        const entry = appState.cart.find((c) => c.key === key);
        if (!entry) return;
        appState.activeTagSheetItemId = entry.itemId;
        appState.activeTagSheetEditKey = entry.key;
        appState.reopenCheckoutAfterTagSheet = false;
        render();
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
      const editingEntry = appState.activeTagSheetEditKey
        ? appState.cart.find((c) => c.key === appState.activeTagSheetEditKey) || null
        : null;
      const finishTagSheet = () => {
        appState.activeTagSheetItemId = null;
        appState.activeTagSheetEditKey = null;
        if (appState.reopenCheckoutAfterTagSheet) {
          appState.reopenCheckoutAfterTagSheet = false;
          appState.isCheckoutOpen = appState.cart.length > 0;
        }
        render();
      };
      if (activeItem) {
        mountTagBottomSheet(
          sheetHost,
          activeItem,
          store,
          (selectedTagIds, note) => {
            if (editingEntry) {
              updateCartItem(store, editingEntry.key, selectedTagIds, note);
            } else {
              addToCart(store, activeItem, selectedTagIds, note, 1);
            }
            finishTagSheet();
          },
          finishTagSheet,
          editingEntry
            ? {
                isEdit: true,
                initialTagIds: editingEntry.selectedTagIds,
                initialNote: editingEntry.note,
                onRemove: () => {
                  updateCartItemQty(editingEntry.key, 0);
                  finishTagSheet();
                },
              }
            : {}
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
        },
        (entry) => {
          appState.isCheckoutOpen = false;
          appState.activeTagSheetItemId = entry.itemId;
          appState.activeTagSheetEditKey = entry.key;
          appState.reopenCheckoutAfterTagSheet = true;
          render();
        }
      );
    } else if (appState.activeLegalModal && sheetHost) {
      if (appState.activeLegalModal === "a11y-menu") {
        mountAccessibilityMenuModal(
          sheetHost,
          () => {
            appState.activeLegalModal = "a11y-statement";
            render();
          },
          () => {
            appState.activeLegalModal = null;
            render();
          }
        );
      } else if (appState.activeLegalModal === "a11y-statement") {
        mountAccessibilityStatementModal(sheetHost, store, () => {
          appState.activeLegalModal = null;
          render();
        });
      } else if (appState.activeLegalModal === "privacy-policy") {
        mountPrivacyPolicyModal(sheetHost, store, () => {
          appState.activeLegalModal = null;
          render();
        });
      }
    }
  }

  render();
}
