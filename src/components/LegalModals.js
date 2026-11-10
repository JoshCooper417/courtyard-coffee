/**
 * LegalModals Component — Hebrew RTL modals for:
 *  1. Accessibility Statement (הצהרת נגישות לפי חוק שוויון זכויות לאנשים עם מוגבלות ות"י 5568 / WCAG 2.0 AA)
 *  2. Privacy Policy & Terms (מדיניות פרטיות ותנאי שימוש לפי תיקון 13 לחוק הגנת הפרטיות, התשמ"א-1981, לרבות סעיפים 11, 13 ו-14)
 *  3. Storefront Legal & Accessibility Footer (renderStoreFooter)
 */

function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function getLegalContactInfo(store) {
  const businessNameHe = "קפה בחצר";
  const ownerNameHe = (store?.ownerNameHe || "").trim() || "הנהלת קפה בחצר";
  const contactPhone = (store?.contactPhone || store?.bitPhone || "050-0000000").trim();
  const contactEmail = (store?.contactEmail || "").trim();
  const businessAddressHe = (store?.businessAddressHe || "").trim();
  const accessibilityPhysicalHe =
    (store?.accessibilityPhysicalHe || "").trim() ||
    "הכניסה לחצר בית הקפה נגישה במפלס הרחוב, קיימים מקומות ישיבה נגישים בחצר, וצוות המקום עומד לרשותכם להגשת סיוע אישי בהזמנה ובאיסוף.";

  return {
    businessNameHe,
    ownerNameHe,
    contactPhone,
    contactEmail,
    businessAddressHe,
    accessibilityPhysicalHe,
  };
}

export function renderStoreFooter() {
  return `
    <footer class="store-footer" data-testid="store-footer" aria-label="מידע משפטי ונגישות">
      <div class="store-footer-links">
        <button
          type="button"
          class="footer-link-btn"
          data-testid="footer-a11y-menu-btn"
        >
          ♿ תפריט נגישות
        </button>
        <span class="footer-sep" aria-hidden="true">•</span>
        <button
          type="button"
          class="footer-link-btn"
          data-testid="footer-a11y-statement-btn"
        >
          הצהרת נגישות
        </button>
        <span class="footer-sep" aria-hidden="true">•</span>
        <button
          type="button"
          class="footer-link-btn"
          data-testid="footer-privacy-policy-btn"
        >
          מדיניות פרטיות (תיקון 13)
        </button>
      </div>
      <p class="store-footer-copy">© קפה בחצר — הזמנה מקוונת נגישה ושקופה</p>
    </footer>
  `;
}

export function mountAccessibilityStatementModal(hostEl, store, onClose) {
  const info = getLegalContactInfo(store);

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

  hostEl.innerHTML = `
    <div class="modal-backdrop sheet-backdrop" data-testid="accessibility-statement-modal" dir="rtl">
      <div
        class="modal-card bottom-sheet-card legal-modal-card"
        role="dialog"
        aria-modal="true"
        aria-label="הצהרת נגישות"
      >
        <div class="sheet-header">
          <div>
            <h2 class="sheet-title">הצהרת נגישות — ${escapeHtml(info.businessNameHe)}</h2>
            <p class="sheet-subtitle">בהתאם לחוק שוויון זכויות לאנשים עם מוגבלות ותקן ישראלי ת״י 5568 (WCAG 2.0 AA)</p>
          </div>
          <button
            type="button"
            class="sheet-close-btn"
            data-testid="close-a11y-statement-btn"
            aria-label="סגור הצהרת נגישות"
          >✕</button>
        </div>

        <div class="legal-modal-body">
          <section class="legal-section">
            <h3>1. מחויבות לנגישות השירות והאתר</h3>
            <p>
              ב<strong>${escapeHtml(info.businessNameHe)}</strong> אנו רואים חשיבות עליונה במתן שירות שוויוני, מכבד, עצמאי ונגיש לכלל הלקוחות, לרבות אנשים עם מוגבלות. אתר ההזמנות הונגש בהתאם להוראות חוק שוויון זכויות לאנשים עם מוגבלות, התשנ״ח-1998, תקנות שוויון זכויות לאנשים עם מוגבלות (התאמות נגישות לשירות), התשע״ג-2013, ותקן ישראלי <strong>ת״י 5568</strong> המבוסס על הנחיות <strong>WCAG 2.0 ברמת AA</strong>.
            </p>
          </section>

          <section class="legal-section">
            <h3>2. התאמות הנגישות באתר האינטרנט</h3>
            <ul class="legal-list">
              <li><strong>ניווט מלא באמצעות מקלדת:</strong> ניתן לנווט בין כל רכיבי האתר, קטגוריות התפריט, בחירת התוספות וטופס ההזמנה באמצעות מקשי <code>Tab</code>, <code>Shift+Tab</code>, <code>Enter</code> וסגירת חלונות באמצעות מקש <code>Escape</code>, כולל קישור ״דלג לתוכן העיקרי״ בראש העמוד.</li>
              <li><strong>תמיכה בקוראי מסך:</strong> האתר בנוי במבנה סמנטי תקני (<code>main</code>, <code>header</code>, <code>nav</code>, <code>footer</code>, <code>dialog</code>), כולל תוויות <code>ARIA</code>, תיאורי תמונות חלופיים (<code>alt</code>) וחיווי מצב לפריטים ולכפתורים.</li>
              <li><strong>תפריט נגישות מובנה (♿):</strong> לחיצה על כפתור הנגישות מאפשרת הגדלת טקסט (עד 124%), מעבר לניגודיות גבוהה, גווני אפור, הדגשת קישורים וכפתורים, גופן קריא ועצירת אנימציות. ההעדפות נשמרות אוטומטית בדפדפן.</li>
              <li><strong>תצוגה רספונסיבית וניגודיות:</strong> האתר מותאם למכשירים ניידים, טאבלטים ומחשבים, ושומר על יחס ניגודיות תקני של לפחות 4.5:1.</li>
            </ul>
          </section>

          <section class="legal-section">
            <h3>3. הסדרי נגישות פיזיים בבית העסק</h3>
            <p>${escapeHtml(info.accessibilityPhysicalHe)}</p>
            ${
              info.businessAddressHe
                ? `<p><strong>כתובת המקום:</strong> ${escapeHtml(info.businessAddressHe)}</p>`
                : ""
            }
          </section>

          <section class="legal-section">
            <h3>4. יצירת קשר ופניות בנושא נגישות</h3>
            <p>
              בהתאם לסעיף 19מב לחוק שוויון זכויות לאנשים עם מוגבלות, בית עסק המעסיק פחות מ-25 עובדים פטור ממינוי רכז נגישות רשמי, אך אנו עומדים לרשותכם בכל שאלה, בקשה להתאמה או דיווח על תקלת נגישות:
            </p>
            <ul class="legal-list">
              <li><strong>איש קשר לנושאי נגישות:</strong> ${escapeHtml(info.ownerNameHe)}</li>
              <li><strong>טלפון / וואטסאפ לפניות נגישות:</strong> <span dir="ltr">${escapeHtml(info.contactPhone)}</span></li>
              ${
                info.contactEmail
                  ? `<li><strong>דוא״ל:</strong> <span dir="ltr">${escapeHtml(info.contactEmail)}</span></li>`
                  : ""
              }
            </ul>
            <p class="legal-updated-note">תאריך עדכון אחרון של ההצהרה: נובמבר 2026</p>
          </section>
        </div>

        <button
          type="button"
          class="btn-primary sheet-confirm-btn"
          data-testid="done-a11y-statement-btn"
        >
          סגירה וחזרה לאתר
        </button>
      </div>
    </div>
  `;

  hostEl.querySelector('[data-testid="close-a11y-statement-btn"]')?.addEventListener("click", () => cleanupAndClose());
  hostEl.querySelector('[data-testid="done-a11y-statement-btn"]')?.addEventListener("click", () => cleanupAndClose());

  const backdrop = hostEl.querySelector('[data-testid="accessibility-statement-modal"]');
  backdrop?.addEventListener("click", (e) => {
    if (e.target === backdrop) cleanupAndClose();
  });
}

export function mountPrivacyPolicyModal(hostEl, store, onClose) {
  const info = getLegalContactInfo(store);

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

  hostEl.innerHTML = `
    <div class="modal-backdrop sheet-backdrop" data-testid="privacy-policy-modal" dir="rtl">
      <div
        class="modal-card bottom-sheet-card legal-modal-card"
        role="dialog"
        aria-modal="true"
        aria-label="מדיניות פרטיות ותנאי שימוש"
      >
        <div class="sheet-header">
          <div>
            <h2 class="sheet-title">מדיניות פרטיות — ${escapeHtml(info.businessNameHe)}</h2>
            <p class="sheet-subtitle">ערוכה בהתאם לחוק הגנת הפרטיות, התשמ״א-1981 ולתיקון מס׳ 13 לחוק</p>
          </div>
          <button
            type="button"
            class="sheet-close-btn"
            data-testid="close-privacy-policy-btn"
            aria-label="סגור מדיניות פרטיות"
          >✕</button>
        </div>

        <div class="legal-modal-body">
          <section class="legal-section">
            <h3>1. כללי וזהות בעל השליטה במאגר המידע</h3>
            <p>
              ברוכים הבאים לאתר ההזמנות של <strong>${escapeHtml(info.businessNameHe)}</strong> (להלן: ״בית העסק״ או ״האתר״). בית העסק (באמצעות ${escapeHtml(info.ownerNameHe)}) הוא בעל השליטה במאגר המידע של הזמנות הלקוחות באתר, ומחויב להגנה על פרטיות המשתמשים בהתאם לחוק הגנת הפרטיות, התשמ״א-1981 ו<strong>תיקון מס׳ 13 לחוק</strong>.
            </p>
          </section>

          <section class="legal-section">
            <h3>2. הודעה לפי סעיף 11 לחוק: איזה מידע נאסף, האם מסירתו חובה, ומהן מטרות השימוש</h3>
            <ul class="legal-list">
              <li><strong>המידע האישי הנאסף:</strong> בעת ביצוע הזמנה באתר אנו אוספים את <strong>שמך המלא</strong>, <strong>מספר הטלפון הנייד שלך</strong>, ו<strong>פירוט המוצרים וההערות בהזמנה</strong> (וכן נתונים טכניים בסיסיים של בקשת הגלישה לצורכי תפעול ואבטחה).</li>
              <li><strong>היעדר חובה חוקית והשלכות אי-מסירה (סעיף 11):</strong> לא חלה עליך חובה על פי דין למסור פרטים אישיים אלו, ומסירתם תלויה ברצונך ובהסכמתך החופשית. עם זאת, ללא מסירת שם ומספר טלפון נייד <strong>לא נוכל לקלוט את ההזמנה המקוונת, לשייך אותה אליך בדלפק האיסוף, או לשלוח לך עדכון בוואטסאפ כשהמנה מוכנה</strong>.</li>
              <li><strong>צמידות המטרה (מטרות השימוש במידע):</strong> המידע שנמסר משמש <strong>אך ורק</strong> לצורך הכנת ההזמנה, זיהוי הלקוח בעת האיסוף ושליחת הודעת שירות חד-פעמית (וואטסאפ) על מוכנות ההזמנה. <strong>אנו לא עושים במידע שימוש לדיוור ישיר או להודעות פרסומיות ושיווקיות.</strong></li>
            </ul>
          </section>

          <section class="legal-section">
            <h3>3. העברת מידע לצדדים שלישיים, תשלומים ואחסון בענן</h3>
            <ul class="legal-list">
              <li><strong>תשתיות אירוח ומסד נתונים:</strong> האתר ומסד הנתונים מתארחים על גבי תשתיות ענן מאובטחות (Vercel ו-Turso Serverless SQLite), אשר עשויות לשמור או לעבד נתונים בשרתים מחוץ לישראל (ארה״ב/אירופה) תחת תקני אבטחת מידע מחמירים.</li>
              <li><strong>וואטסאפ (WhatsApp) ואפליקציות תשלום (Bit / PayBox):</strong> לצורך שליחת הודעה שההזמנה מוכנה נעשה שימוש בקישור ישיר לשירות WhatsApp, ולצורך תשלום מוצג קוד QR/מספר טלפון להעברה באפליקציית Bit או PayBox. האתר אינו סולק כרטיסי אשראי ואינו אוסף או שומר פרטי אשראי או חשבון בנק.</li>
            </ul>
          </section>

          <section class="legal-section">
            <h3>4. עוגיות (Cookies), כלי מעקב ואחסון מקומי</h3>
            <p>
              אתר זה <strong>אינו מטמיע פיקסלים שיווקיים, עוגיות פרסום או כלי מעקב צד-שלישי</strong> (כגון Google Analytics או Meta Pixel). האתר עושה שימוש באחסון מקומי תפקודי בלבד בדפדפן (<code>localStorage</code>) לצורך שמירת העדפות הנגישות שבחרת בלבד.
            </p>
          </section>

          <section class="legal-section">
            <h3>5. שמירת המידע וזכויותיך לעיון, תיקון ומחיקה (סעיפים 13 ו-14 לחוק)</h3>
            <p>
              פרטי ההזמנות הפעילות נשמרים במערכת התפעולית של בית העסק למשך המשמרת לצורך הכנת המנות ואיפוס משמרות שוטף. על פי סעיפים 13 ו-14 לחוק הגנת הפרטיות, הנך זכאי/ת לעיין במידע האישי השמור עליך במאגר, וכן לבקש את תיקונו או מחיקתו.
            </p>
            <ul class="legal-list">
              <li><strong>פניות בנושא פרטיות ומימוש זכויות:</strong> ${escapeHtml(info.ownerNameHe)}</li>
              <li><strong>טלפון / וואטסאפ:</strong> <span dir="ltr">${escapeHtml(info.contactPhone)}</span></li>
              ${
                info.contactEmail
                  ? `<li><strong>דוא״ל:</strong> <span dir="ltr">${escapeHtml(info.contactEmail)}</span></li>`
                  : ""
              }
              ${
                info.businessAddressHe
                  ? `<li><strong>כתובת:</strong> ${escapeHtml(info.businessAddressHe)}</li>`
                  : ""
              }
            </ul>
            <p class="legal-updated-note">תאריך עדכון אחרון של מדיניות הפרטיות: נובמבר 2026</p>
          </section>
        </div>

        <button
          type="button"
          class="btn-primary sheet-confirm-btn"
          data-testid="done-privacy-policy-btn"
        >
          סגירה וחזרה לאתר
        </button>
      </div>
    </div>
  `;

  hostEl.querySelector('[data-testid="close-privacy-policy-btn"]')?.addEventListener("click", () => cleanupAndClose());
  hostEl.querySelector('[data-testid="done-privacy-policy-btn"]')?.addEventListener("click", () => cleanupAndClose());

  const backdrop = hostEl.querySelector('[data-testid="privacy-policy-modal"]');
  backdrop?.addEventListener("click", (e) => {
    if (e.target === backdrop) cleanupAndClose();
  });
}
