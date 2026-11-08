/**
 * Central client state & API helper for Courtyard Coffee.
 */

export const appState = {
  store: null,
  cart: [],
  selectedCategory: "All",
  activeOrder: null,
};

export async function fetchStoreState() {
  const resp = await fetch("/api/store", { cache: "no-store" });
  if (!resp.ok) {
    throw new Error(`Failed to load store state: ${resp.status}`);
  }
  const data = await resp.json();
  appState.store = data;
  return data;
}

export async function saveStoreState(nextStore) {
  const resp = await fetch("/api/store", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(nextStore),
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error || `Failed to save store: ${resp.status}`);
  }
  const updated = await resp.json();
  appState.store = updated;
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

export async function patchOrderStatus(orderId, status) {
  const resp = await fetch(`/api/orders/${encodeURIComponent(orderId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  if (!resp.ok) {
    throw new Error(`Failed to update order status: ${resp.status}`);
  }
  return resp.json();
}

export async function resetAllOrders() {
  const resp = await fetch("/api/orders/reset", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
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
