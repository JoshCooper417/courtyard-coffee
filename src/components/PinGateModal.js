/**
 * 4-digit PIN Gate Modal for /admin/kds and /admin/menu.
 * Checks localStorage.getItem('adminPin') against store.adminPin.
 */

export function mountPinGateModal(container, store, onUnlocked) {
  const expectedPin = String(store?.adminPin || "1234");
  let errorMsg = "";

  function render() {
    container.innerHTML = `
      <div class="admin-shell" dir="ltr">
        <div class="modal-backdrop" data-testid="pin-gate-modal">
          <div class="modal-card">
            <h1 class="pin-modal-title">Staff Access Required</h1>
            <p class="pin-modal-desc">Enter the 4-digit staff PIN to access Courtyard Coffee Admin &amp; KDS.</p>
            <form id="pin-gate-form">
              <input
                id="pin-gate-input"
                data-testid="pin-input"
                class="pin-input"
                type="password"
                inputmode="numeric"
                maxlength="8"
                placeholder="••••"
                autocomplete="off"
                required
              />
              ${
                errorMsg
                  ? `<div class="pin-error" data-testid="pin-error" role="alert">${errorMsg}</div>`
                  : ""
              }
              <button
                type="submit"
                data-testid="pin-submit"
                class="btn-primary"
                style="width: 100%;"
              >
                Unlock Admin
              </button>
            </form>
          </div>
        </div>
      </div>
    `;

    const form = container.querySelector("#pin-gate-form");
    const input = container.querySelector("#pin-gate-input");
    if (input) {
      input.focus();
    }
    if (form) {
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        const entered = String(input.value || "").trim();
        if (entered === expectedPin) {
          localStorage.setItem("adminPin", entered);
          onUnlocked();
        } else {
          errorMsg = "Invalid PIN code. Please try again.";
          render();
        }
      });
    }
  }

  render();
}
