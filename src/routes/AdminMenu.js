/**
 * Admin Menu & Store Settings ("/admin/menu") — English LTR layout.
 */

export function mountAdminMenuRoute(container, store) {
  document.documentElement.setAttribute("dir", "ltr");
  document.documentElement.setAttribute("lang", "en");

  container.innerHTML = `
    <main class="admin-shell" dir="ltr" data-testid="admin-menu-view">
      <header class="admin-topbar">
        <div>
          <h1 style="margin: 0; font-size: 1.5rem; font-weight: 800;">Courtyard Coffee — Admin Menu &amp; Settings</h1>
          <p style="margin: 4px 0 0; color: var(--text-stone); font-size: 0.9rem;">
            Manage store status, menu spreadsheet, global modifier tags, and photo album
          </p>
        </div>
        <nav class="admin-nav-links" aria-label="Admin Navigation">
          <a href="/admin/kds" class="admin-nav-link" data-nav="/admin/kds">KDS Queue</a>
          <a href="/admin/menu" class="admin-nav-link active" data-nav="/admin/menu">Menu &amp; Settings</a>
          <a href="/" class="admin-nav-link" data-nav="/">Storefront</a>
        </nav>
      </header>

      <section
        style="background: var(--bg-card); border: 1px solid var(--border-warm); border-radius: var(--radius-card); padding: 24px;"
      >
        <h2 style="margin: 0 0 12px; font-size: 1.2rem;">Store Overview</h2>
        <p style="margin: 0; color: var(--text-stone);">
          Items: ${(store.menuItems || []).length} • Tags: ${(store.globalTags || []).length} • Photos: ${(store.photoAlbum || []).length}
        </p>
      </section>
    </main>
  `;
}
