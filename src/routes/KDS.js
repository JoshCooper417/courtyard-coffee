/**
 * Barista Kitchen Display System ("/admin/kds") — English LTR layout.
 */

export function mountKdsRoute(container, store) {
  document.documentElement.setAttribute("dir", "ltr");
  document.documentElement.setAttribute("lang", "en");

  container.innerHTML = `
    <main class="admin-shell" dir="ltr" data-testid="kds-view">
      <header class="admin-topbar">
        <div>
          <h1 style="margin: 0; font-size: 1.5rem; font-weight: 800;">Courtyard Coffee — Barista KDS</h1>
          <p style="margin: 4px 0 0; color: var(--text-stone); font-size: 0.9rem;">
            Live Order Queue • Store is ${store.isOpen ? "Open" : "Closed"}
          </p>
        </div>
        <nav class="admin-nav-links" aria-label="Admin Navigation">
          <a href="/admin/kds" class="admin-nav-link active" data-nav="/admin/kds">KDS Queue</a>
          <a href="/admin/menu" class="admin-nav-link" data-nav="/admin/menu">Menu &amp; Settings</a>
          <a href="/" class="admin-nav-link" data-nav="/">Storefront</a>
        </nav>
      </header>

      <section
        data-testid="kds-orders-grid"
        style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 16px;"
      >
        <div
          style="background: var(--bg-card); border: 1px solid var(--border-warm); border-radius: var(--radius-card); padding: 24px;"
        >
          <p style="margin: 0; color: var(--text-stone);">Ready for incoming orders (#${store.nextOrderNumber}+).</p>
        </div>
      </section>
    </main>
  `;
}
