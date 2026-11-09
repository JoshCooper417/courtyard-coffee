/**
 * 4-digit PIN Gate Modal for /admin/kds and /admin/menu.
 * Checks localStorage.getItem('adminPin') against store.adminPin.
 */

export function mountPinGateModal(container, store, onUnlocked) {
  const expectedPin = String(store?.adminPin || "1234");
  const maxAttempts = 5;
  let failedAttempts = 0;
  let errorMsg = "";

  function render() {
    const isLockedOut = failedAttempts >= maxAttempts;
    const errClass = errorMsg ? "has-error" : "";
    container.innerHTML = `
      <div class="admin-shell" dir="ltr">
        <div class="modal-backdrop" data-testid="pin-gate-modal" data-failed-attempts="${failedAttempts}">
          <div class="modal-card ${errClass}">
            <h1 class="pin-modal-title">Staff Access Required</h1>
            <p class="pin-modal-desc">Enter the 4-digit staff PIN to access Courtyard Coffee Admin &amp; KDS.</p>
            <form id="pin-gate-form">
              <input
                id="pin-gate-input"
                data-testid="pin-input"
                class="pin-input ${errClass}"
                type="password"
                inputmode="numeric"
                maxlength="8"
                placeholder="••••"
                autocomplete="off"
                ${isLockedOut ? "disabled" : ""}
                required
              />
              ${
                errorMsg
                  ? `<div class="pin-error" data-testid="pin-error" data-locked-out="${isLockedOut ? "true" : "false"}" role="alert">${errorMsg}</div>`
                  : ""
              }
              <button
                type="submit"
                data-testid="pin-submit"
                class="btn-primary"
                style="width: 100%;"
                ${isLockedOut ? "disabled" : ""}
              >
                ${isLockedOut ? "Locked Out" : "Unlock Admin"}
              </button>
            </form>
          </div>
        </div>
      </div>
    `;

    const form = container.querySelector("#pin-gate-form");
    const input = container.querySelector("#pin-gate-input");
    if (input && !isLockedOut) {
      input.focus();
    }
    if (form) {
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        if (failedAttempts >= maxAttempts) {
          return;
        }
        const entered = String(input.value || "").trim();
        if (entered === expectedPin) {
          failedAttempts = 0;
          localStorage.setItem("adminPin", entered);
          onUnlocked();
        } else {
          failedAttempts += 1;
          if (failedAttempts >= maxAttempts) {
            errorMsg = "Too many failed attempts (5/5). Admin access locked.";
          } else {
            errorMsg = "Invalid PIN code. Please try again.";
          }
          render();
        }
      });
    }
  }

  render();
}
