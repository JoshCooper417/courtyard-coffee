/**
 * Admin Issue Reporter Route (/admin/issues).
 * PIN-gated. Lets the admin paste a WhatsApp message and create a GitHub issue.
 */

import { getAdminHeaders } from "../state.js";

export function mountAdminIssuesRoute(appEl, store) {
  appEl.innerHTML = `
    <div class="admin-shell" data-testid="admin-issues-view">
      <nav class="admin-nav">
        <a href="/admin/kds" class="admin-nav-link" data-route="/admin/kds">KDS</a>
        <a href="/admin/menu" class="admin-nav-link" data-route="/admin/menu">Menu</a>
        <a href="/admin/issues" class="admin-nav-link admin-nav-link--active" data-route="/admin/issues">Issues</a>
      </nav>
      <div class="admin-content" style="max-width: 600px; margin: 0 auto; padding: 20px 16px;">
        <h1 style="font-size: 22px; margin: 0 0 4px;">📋 Report Issue</h1>
        <p style="color: var(--text-stone); font-size: 14px; margin: 0 0 20px;">
          Paste a WhatsApp message or describe a bug / feature request.
          It will be created as a GitHub issue.
        </p>

        <div style="margin-bottom: 16px;">
          <label style="display: block; font-size: 13px; font-weight: 600; margin-bottom: 6px; color: var(--text-stone);">
            Type
          </label>
          <div style="display: flex; gap: 8px;" data-testid="issue-type-selector">
            <button type="button" class="issue-type-btn issue-type-btn--active" data-type="bug"
              style="flex: 1; padding: 10px; border-radius: 10px; border: 2px solid var(--color-sage); background: var(--color-sage); color: white; font-size: 14px; font-weight: 600;">
              🐛 Bug
            </button>
            <button type="button" class="issue-type-btn" data-type="enhancement"
              style="flex: 1; padding: 10px; border-radius: 10px; border: 2px solid var(--border-warm); background: var(--bg-card); color: var(--text-espresso); font-size: 14px; font-weight: 600;">
              ✨ Feature
            </button>
          </div>
        </div>

        <div style="margin-bottom: 16px;">
          <label for="issue-message" style="display: block; font-size: 13px; font-weight: 600; margin-bottom: 6px; color: var(--text-stone);">
            Message
          </label>
          <textarea
            id="issue-message"
            data-testid="issue-message-input"
            rows="6"
            placeholder="Paste the WhatsApp message here, or describe the issue..."
            style="width: 100%; padding: 12px; border: 2px solid var(--border-warm); border-radius: 12px; background: var(--bg-card); color: var(--text-espresso); font-size: 15px; line-height: 1.5; resize: vertical; font-family: inherit;"
          ></textarea>
        </div>

        <button
          type="button"
          data-testid="issue-submit-btn"
          style="width: 100%; padding: 14px; border: none; border-radius: 12px; background: var(--color-sage); color: white; font-size: 16px; font-weight: 700; cursor: pointer;"
        >
          Create Issue
        </button>

        <div data-testid="issue-result" style="margin-top: 16px;"></div>
      </div>
    </div>
  `;

  let selectedType = "bug";

  // Type selector
  const typeButtons = appEl.querySelectorAll(".issue-type-btn");
  typeButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      selectedType = btn.getAttribute("data-type");
      typeButtons.forEach((b) => {
        const isActive = b === btn;
        b.style.border = isActive
          ? "2px solid var(--color-sage)"
          : "2px solid var(--border-warm)";
        b.style.background = isActive ? "var(--color-sage)" : "var(--bg-card)";
        b.style.color = isActive ? "white" : "var(--text-espresso)";
        b.classList.toggle("issue-type-btn--active", isActive);
      });
    });
  });

  // Nav links
  appEl.querySelectorAll(".admin-nav-link").forEach((link) => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      const route = link.getAttribute("data-route");
      history.pushState(null, "", route);
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
  });

  // Submit
  const submitBtn = appEl.querySelector('[data-testid="issue-submit-btn"]');
  const messageInput = appEl.querySelector('[data-testid="issue-message-input"]');
  const resultDiv = appEl.querySelector('[data-testid="issue-result"]');

  submitBtn.addEventListener("click", async () => {
    const message = messageInput.value.trim();
    if (!message) {
      resultDiv.innerHTML = `<p style="color: var(--color-danger); font-size: 14px;">Please enter a message.</p>`;
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = "Creating...";
    submitBtn.style.opacity = "0.6";
    resultDiv.innerHTML = "";

    try {
      const resp = await fetch("/api/issues", {
        method: "POST",
        headers: getAdminHeaders(),
        body: JSON.stringify({ message, label: selectedType }),
      });

      const data = await resp.json();

      if (!resp.ok) {
        throw new Error(data.error || `Server error ${resp.status}`);
      }

      resultDiv.innerHTML = `
        <div style="padding: 16px; background: #E8F5E9; border-radius: 12px; text-align: center;">
          <p style="font-size: 16px; font-weight: 700; margin: 0 0 6px; color: #2E7D32;">
            ✅ Issue #${data.number} created!
          </p>
          <a href="${data.html_url}" target="_blank" rel="noopener"
            style="color: var(--color-sage); font-size: 14px;">
            View on GitHub →
          </a>
        </div>
      `;
      messageInput.value = "";
    } catch (err) {
      resultDiv.innerHTML = `
        <div style="padding: 16px; background: #FFEBEE; border-radius: 12px;">
          <p style="font-size: 14px; color: var(--color-danger); margin: 0;">
            ❌ ${err.message}
          </p>
        </div>
      `;
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Create Issue";
      submitBtn.style.opacity = "1";
    }
  });
}
