/**
 * Central client state, cart management, and API helper for Courtyard Coffee.
 */

export function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export const appState = {
  store: null,
  cart: [],
  selectedCategory: "All",
  activeOrder: null,
  activeTagSheetItemId: null,
  activeTagSheetEditKey: null,
  reopenCheckoutAfterTagSheet: false,
  isCheckoutOpen: false,
  checkoutDraft: {
    customerName: "",
    customerPhone: "",
  },
  activeLegalModal: null,
};

export function buildCartKey(itemId, selectedTagIds = [], note = "") {
  const sortedTagIds = [...(selectedTagIds || [])].map(String).sort();
  return `${itemId}::${sortedTagIds.join(",")}::${String(note || "").trim()}`;
}

function resolveCartCustomization(store, item, selectedTagIds = [], note = "") {
  const tagsById = {};
  for (const t of store?.globalTags || []) {
    tagsById[t.id] = t;
  }
  const validTags = (selectedTagIds || [])
    .map((tid) => tagsById[tid])
    .filter((t) => t && t.inStock);
  const validTagIds = validTags.map((t) => t.id).sort();
  const tagPriceSum = validTags.reduce(
    (sum, t) => sum + Number(t.price ?? t.priceDelta ?? 0),
    0
  );
  const unitPrice = Number(item.price || 0) + tagPriceSum;
  const trimmedNote = String(note || "").trim();
  return {
    key: buildCartKey(item.id, validTagIds, trimmedNote),
    validTags,
    validTagIds,
    unitPrice,
    trimmedNote,
  };
}

export function addToCart(store, item, selectedTagIds = [], note = "", qtyDelta = 1) {
  const { key, validTags, validTagIds, unitPrice, trimmedNote } = resolveCartCustomization(
    store,
    item,
    selectedTagIds,
    note
  );

  const existing = appState.cart.find((c) => c.key === key);
  if (existing) {
    existing.qty += qtyDelta;
    if (existing.qty <= 0) {
      appState.cart = appState.cart.filter((c) => c.key !== key);
    } else {
      existing.lineTotal = existing.qty * existing.unitPrice;
    }
    return existing;
  }

  if (qtyDelta <= 0) return null;

  const entry = {
    key,
    itemId: item.id,
    nameHe: item.nameHe || item.titleHe || "",
    nameEn: item.nameEn || item.titleEn || "",
    qty: qtyDelta,
    unitPrice,
    lineTotal: unitPrice * qtyDelta,
    selectedTagIds: validTagIds,
    tagsHe: validTags.map((t) => t.nameHe || t.labelHe || ""),
    tagsEn: validTags.map((t) => t.nameEn || t.labelEn || ""),
    note: trimmedNote,
  };
  appState.cart.push(entry);
  return entry;
}

export function updateCartItem(store, existingKey, selectedTagIds = [], note = "") {
  const idx = appState.cart.findIndex((c) => c.key === existingKey);
  if (idx === -1) return null;

  const existing = appState.cart[idx];
  const item =
    (store?.menuItems || []).find((i) => i.id === existing.itemId) || {
      id: existing.itemId,
      price: existing.unitPrice,
      nameHe: existing.nameHe,
      nameEn: existing.nameEn,
    };

  const { key: newKey, validTags, validTagIds, unitPrice, trimmedNote } = resolveCartCustomization(
    store,
    item,
    selectedTagIds,
    note
  );

  const mergeIdx = appState.cart.findIndex((c, i) => i !== idx && c.key === newKey);
  if (mergeIdx !== -1) {
    const target = appState.cart[mergeIdx];
    target.qty += existing.qty;
    target.unitPrice = unitPrice;
    target.lineTotal = target.qty * target.unitPrice;
    appState.cart.splice(idx, 1);
    return target;
  }

  const updated = {
    ...existing,
    key: newKey,
    unitPrice,
    lineTotal: unitPrice * existing.qty,
    selectedTagIds: validTagIds,
    tagsHe: validTags.map((t) => t.nameHe || t.labelHe || ""),
    tagsEn: validTags.map((t) => t.nameEn || t.labelEn || ""),
    note: trimmedNote,
  };
  appState.cart[idx] = updated;
  return updated;
}

export function updateCartItemQty(key, nextQty) {
  const idx = appState.cart.findIndex((c) => c.key === key);
  if (idx === -1) return;
  if (nextQty <= 0) {
    appState.cart.splice(idx, 1);
  } else {
    appState.cart[idx].qty = nextQty;
    appState.cart[idx].lineTotal = nextQty * appState.cart[idx].unitPrice;
  }
}

export function getCartEntriesForItem(itemId) {
  return appState.cart.filter((c) => c.itemId === itemId);
}

export function getUntaggedCartEntry(itemId) {
  const key = buildCartKey(itemId, [], "");
  return appState.cart.find((c) => c.key === key) || null;
}

export function getCartTotals() {
  let totalItems = 0;
  let totalPrice = 0;
  for (const entry of appState.cart) {
    totalItems += Number(entry.qty || 0);
    totalPrice += Number(entry.lineTotal || 0);
  }
  return { totalItems, totalPrice };
}

export function clearCart() {
  appState.cart = [];
  appState.checkoutDraft = { customerName: "", customerPhone: "" };
}

export async function fetchStoreState() {
  if (typeof window !== "undefined") {
    window.__storeFetchCount = (window.__storeFetchCount || 0) + 1;
  }
  const resp = await fetch("/api/store", { cache: "no-store" });
  if (!resp.ok) {
    throw new Error(`Failed to load store state: ${resp.status}`);
  }
  const data = await resp.json();
  appState.store = data;
  return data;
}

export function getAdminHeaders() {
  const headers = { "Content-Type": "application/json" };
  const savedPin =
    typeof localStorage !== "undefined" ? localStorage.getItem("adminPin") : null;
  if (savedPin) {
    headers["X-Admin-Pin"] = String(savedPin);
  }
  return headers;
}

export async function saveStoreState(nextStore) {
  const resp = await fetch("/api/store", {
    method: "PUT",
    headers: getAdminHeaders(),
    body: JSON.stringify(nextStore),
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error || `Failed to save store: ${resp.status}`);
  }
  const updated = await resp.json();
  appState.store = updated;
  if (
    typeof localStorage !== "undefined" &&
    localStorage.getItem("adminPin") &&
    updated?.adminPin
  ) {
    localStorage.setItem("adminPin", String(updated.adminPin));
  }
  return updated;
}

export async function submitCustomerOrder(payload) {
  const resp = await fetch("/api/order", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error || `Failed to submit order: ${resp.status}`);
  }
  return resp.json();
}

export async function fetchOrders(status = null) {
  const url = status ? `/api/orders?status=${encodeURIComponent(status)}` : "/api/orders";
  const resp = await fetch(url, { cache: "no-store" });
  if (!resp.ok) {
    throw new Error(`Failed to fetch orders: ${resp.status}`);
  }
  return resp.json();
}

export async function patchOrderStatus(orderId, patchOrStatus) {
  const bodyObj =
    typeof patchOrStatus === "object" && patchOrStatus !== null
      ? patchOrStatus
      : { status: patchOrStatus };
  const resp = await fetch(`/api/orders/${encodeURIComponent(orderId)}`, {
    method: "PATCH",
    headers: getAdminHeaders(),
    body: JSON.stringify(bodyObj),
  });
  if (!resp.ok) {
    throw new Error(`Failed to update order status: ${resp.status}`);
  }
  return resp.json();
}

export async function resetAllOrders() {
  const resp = await fetch("/api/orders/reset", {
    method: "POST",
    headers: getAdminHeaders(),
    body: JSON.stringify({}),
  });
  if (!resp.ok) {
    throw new Error(`Failed to reset orders: ${resp.status}`);
  }
  return resp.json();
}

export function isPinUnlocked(store) {
  const expectedPin = String(store?.adminPin || "1234");
  const savedPin = typeof localStorage !== "undefined" ? localStorage.getItem("adminPin") : null;
  return savedPin === expectedPin;
}
