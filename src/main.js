/**
 * SPA Router and Bootstrap for Courtyard Coffee ("/", "/admin/kds", "/admin/menu").
 */
import { fetchStoreState, isPinUnlocked } from "./state.js";
import { mountPinGateModal } from "./components/PinGateModal.js";
import { mountCustomerRoute } from "./routes/Customer.js";
import { mountKdsRoute } from "./routes/KDS.js";
import { mountAdminMenuRoute } from "./routes/AdminMenu.js";

export async function renderCurrentRoute() {
  const appEl = document.getElementById("app");
  if (!appEl) return;

  try {
    const store = await fetchStoreState();
    const path = window.location.pathname;

    if (path.startsWith("/admin/kds")) {
      document.documentElement.setAttribute("dir", "ltr");
      document.documentElement.setAttribute("lang", "en");
      if (!isPinUnlocked(store)) {
        mountPinGateModal(appEl, store, () => renderCurrentRoute());
        return;
      }
      mountKdsRoute(appEl, store);
      return;
    }

    if (path.startsWith("/admin/menu")) {
      document.documentElement.setAttribute("dir", "ltr");
      document.documentElement.setAttribute("lang", "en");
      if (!isPinUnlocked(store)) {
        mountPinGateModal(appEl, store, () => renderCurrentRoute());
        return;
      }
      mountAdminMenuRoute(appEl, store);
      return;
    }

    mountCustomerRoute(appEl, store);
  } catch (err) {
    appEl.innerHTML = `<div style="padding: 24px; color: var(--color-danger);">Error loading store: ${err.message}</div>`;
  }
}

window.addEventListener("popstate", () => {
  renderCurrentRoute();
});

if (typeof document !== "undefined") {
  renderCurrentRoute();
}
