/**
 * AccessibilityWidget Component (IS 5568 / WCAG 2.0 AA Assistive Menu).
 * Provides persistent client-side visual & motor adjustments (font scaling, high contrast,
 * grayscale, link/button highlighting, readable font, animation pause, and reset)
 * plus a direct link to the Accessibility Statement.
 */

const A11Y_STORAGE_KEY = "courtyard_a11y_prefs";

const DEFAULT_PREFS = {
  fontScale: 0, // 0 = 100%, 1 = 112%, 2 = 124%
  highContrast: false,
  grayscale: false,
  highlightLinks: false,
  readableFont: false,
  stopAnimations: false,
};

export function getAccessibilityPrefs() {
  if (typeof localStorage === "undefined") {
    return { ...DEFAULT_PREFS };
  }
  try {
    const raw = localStorage.getItem(A11Y_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PREFS };
    const parsed = JSON.parse(raw);
    return {
      fontScale: [0, 1, 2].includes(Number(parsed.fontScale)) ? Number(parsed.fontScale) : 0,
      highContrast: Boolean(parsed.highContrast),
      grayscale: Boolean(parsed.grayscale),
      highlightLinks: Boolean(parsed.highlightLinks),
      readableFont: Boolean(parsed.readableFont),
      stopAnimations: Boolean(parsed.stopAnimations),
    };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

export function saveAccessibilityPrefs(nextPrefs) {
  const normalized = {
    ...DEFAULT_PREFS,
    ...(nextPrefs || {}),
  };
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(A11Y_STORAGE_KEY, JSON.stringify(normalized));
    } catch {
      // Ignore storage quota errors
    }
  }
  applyAccessibilityPrefsToDom(normalized);
  return normalized;
}

export function resetAccessibilityPrefs() {
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.removeItem(A11Y_STORAGE_KEY);
    } catch {
      // Ignore storage errors
    }
  }
  applyAccessibilityPrefsToDom(DEFAULT_PREFS);
  return { ...DEFAULT_PREFS };
}

export function applyAccessibilityPrefsToDom(prefs = getAccessibilityPrefs()) {
  if (typeof document === "undefined" || !document.documentElement) return;
  const root = document.documentElement;
  root.classList.toggle("a11y-font-1", prefs.fontScale === 1);
  root.classList.toggle("a11y-font-2", prefs.fontScale === 2);
  root.classList.toggle("a11y-high-contrast", Boolean(prefs.highContrast));
  root.classList.toggle("a11y-grayscale", Boolean(prefs.grayscale));
  root.classList.toggle("a11y-highlight-links", Boolean(prefs.highlightLinks));
  root.classList.toggle("a11y-readable-font", Boolean(prefs.readableFont));
  root.classList.toggle("a11y-stop-animations", Boolean(prefs.stopAnimations));
}

export function hasActiveAccessibilityPrefs(prefs = getAccessibilityPrefs()) {
  return Boolean(
    prefs.fontScale > 0 ||
      prefs.highContrast ||
      prefs.grayscale ||
      prefs.highlightLinks ||
      prefs.readableFont ||
      prefs.stopAnimations
  );
}

export function mountAccessibilityMenuModal(hostEl, onOpenStatement, onClose) {
  let prefs = getAccessibilityPrefs();

  function handleKeyDown(e) {
    if (e.key === "Escape") {
      cleanupAndClose();
    }
  }

  function cleanupAndClose() {
    if (typeof window !== "undefined") {
      window.removeEventListener("keydown", handleKeyDown);
    }
    onClose();
  }

  if (typeof window !== "undefined") {
    window.addEventListener("keydown", handleKeyDown);
  }

  function render() {
    const fontScaleLabels = ["רגיל (100%)", "גדול (+12%)", "גדול מאוד (+24%)"];
    const currentFontLabel = fontScaleLabels[prefs.fontScale] || fontScaleLabels[0];

    hostEl.innerHTML = `
      <div class="modal-backdrop sheet-backdrop" data-testid="a11y-menu-modal" dir="rtl">
        <div
          class="modal-card bottom-sheet-card a11y-modal-card"
          role="dialog"
          aria-modal="true"
          aria-label="תפריט התאמות נגישות"
        >
          <div class="sheet-header">
            <div>
              <h2 class="sheet-title">♿ התאמות נגישות באתר</h2>
              <p class="sheet-subtitle">התאמת תצוגה וניווט לפי תקן ישראלי ת״י 5568 (WCAG 2.0 AA)</p>
            </div>
            <button
              type="button"
              class="sheet-close-btn"
              data-testid="close-a11y-menu-btn"
              aria-label="סגור תפריט נגישות"
            >✕</button>
          </div>

          <div class="a11y-controls-grid">
            <button
              type="button"
              class="a11y-Option-btn ${prefs.fontScale > 0 ? "active" : ""}"
              data-testid="a11y-toggle-font"
              aria-pressed="${prefs.fontScale > 0 ? "true" : "false"}"
            >
              <span class="a11y-option-title">גודל טקסט</span>
              <span class="a11y-option-state">${currentFontLabel}</span>
            </button>

            <button
              type="button"
              class="a11y-Option-btn ${prefs.highContrast ? "active" : ""}"
              data-testid="a11y-toggle-contrast"
              aria-pressed="${prefs.highContrast ? "true" : "false"}"
            >
              <span class="a11y-option-title">ניגודיות גבוהה</span>
              <span class="a11y-option-state">${prefs.highContrast ? "פעיל ✓" : "כבוי"}</span>
            </button>

            <button
              type="button"
              class="a11y-Option-btn ${prefs.grayscale ? "active" : ""}"
              data-testid="a11y-toggle-grayscale"
              aria-pressed="${prefs.grayscale ? "true" : "false"}"
            >
              <span class="a11y-option-title">גווני אפור</span>
              <span class="a11y-option-state">${prefs.grayscale ? "פעיל ✓" : "כבוי"}</span>
            </button>

            <button
              type="button"
              class="a11y-Option-btn ${prefs.highlightLinks ? "active" : ""}"
              data-testid="a11y-toggle-links"
              aria-pressed="${prefs.highlightLinks ? "true" : "false"}"
            >
              <span class="a11y-option-title">הדגשת קישורים וכפתורים</span>
              <span class="a11y-option-state">${prefs.highlightLinks ? "פעיל ✓" : "כבוי"}</span>
            </button>

            <button
              type="button"
              class="a11y-Option-btn ${prefs.readableFont ? "active" : ""}"
              data-testid="a11y-toggle-readable-font"
              aria-pressed="${prefs.readableFont ? "true" : "false"}"
            >
              <span class="a11y-option-title">גופן קריא ומרווח</span>
              <span class="a11y-option-state">${prefs.readableFont ? "פעיל ✓" : "כבוי"}</span>
            </button>

            <button
              type="button"
              class="a11y-Option-btn ${prefs.stopAnimations ? "active" : ""}"
              data-testid="a11y-toggle-animations"
              aria-pressed="${prefs.stopAnimations ? "true" : "false"}"
            >
              <span class="a11y-option-title">עצירת אנימציות</span>
              <span class="a11y-option-state">${prefs.stopAnimations ? "פעיל ✓" : "כבוי"}</span>
            </button>
          </div>

          <div class="a11y-modal-actions">
            <button
              type="button"
              class="btn-secondary a11y-reset-btn"
              data-testid="a11y-reset-btn"
            >
              איפוס הגדרות נגישות
            </button>
            <button
              type="button"
              class="btn-primary a11y-statement-link-btn"
              data-testid="a11y-open-statement-btn"
            >
              להצהרת הנגישות המלאה
            </button>
          </div>
        </div>
      </div>
    `;

    const closeBtn = hostEl.querySelector('[data-testid="close-a11y-menu-btn"]');
    closeBtn?.addEventListener("click", () => cleanupAndClose());

    const backdrop = hostEl.querySelector('[data-testid="a11y-menu-modal"]');
    backdrop?.addEventListener("click", (e) => {
      if (e.target === backdrop) cleanupAndClose();
    });

    hostEl.querySelector('[data-testid="a11y-toggle-font"]')?.addEventListener("click", () => {
      prefs = saveAccessibilityPrefs({
        ...prefs,
        fontScale: (prefs.fontScale + 1) % 3,
      });
      render();
    });

    hostEl.querySelector('[data-testid="a11y-toggle-contrast"]')?.addEventListener("click", () => {
      prefs = saveAccessibilityPrefs({
        ...prefs,
        highContrast: !prefs.highContrast,
      });
      render();
    });

    hostEl.querySelector('[data-testid="a11y-toggle-grayscale"]')?.addEventListener("click", () => {
      prefs = saveAccessibilityPrefs({
        ...prefs,
        grayscale: !prefs.grayscale,
      });
      render();
    });

    hostEl.querySelector('[data-testid="a11y-toggle-links"]')?.addEventListener("click", () => {
      prefs = saveAccessibilityPrefs({
        ...prefs,
        highlightLinks: !prefs.highlightLinks,
      });
      render();
    });

    hostEl.querySelector('[data-testid="a11y-toggle-readable-font"]')?.addEventListener("click", () => {
      prefs = saveAccessibilityPrefs({
        ...prefs,
        readableFont: !prefs.readableFont,
      });
      render();
    });

    hostEl.querySelector('[data-testid="a11y-toggle-animations"]')?.addEventListener("click", () => {
      prefs = saveAccessibilityPrefs({
        ...prefs,
        stopAnimations: !prefs.stopAnimations,
      });
      render();
    });

    hostEl.querySelector('[data-testid="a11y-reset-btn"]')?.addEventListener("click", () => {
      prefs = resetAccessibilityPrefs();
      render();
    });

    hostEl.querySelector('[data-testid="a11y-open-statement-btn"]')?.addEventListener("click", () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("keydown", handleKeyDown);
      }
      onOpenStatement();
    });
  }

  render();
}
