/**
 * WhatsApp phone formatter and Hebrew pre-filled message link builder.
 */

export function formatWaPhone(rawPhone) {
  let digits = String(rawPhone || "").replace(/\D+/g, "");
  if (!digits) return "";
  if (digits.startsWith("00972")) {
    digits = "972" + digits.slice(5);
  } else if (digits.startsWith("0") && digits.length === 10) {
    digits = "972" + digits.slice(1);
  } else if (digits.length === 9 && digits.startsWith("5")) {
    digits = "972" + digits;
  }
  return digits;
}

export function buildHebrewWhatsAppUrl(rawPhoneOrOrder, maybeOrder = {}) {
  const isFirstArgObject =
    typeof rawPhoneOrOrder === "object" && rawPhoneOrOrder !== null;
  const order = isFirstArgObject ? rawPhoneOrOrder : maybeOrder || {};
  const rawPhone = isFirstArgObject
    ? order.customerPhone || order.phone || ""
    : rawPhoneOrOrder;
  const phone = formatWaPhone(rawPhone);
  const orderNumber = order.number ?? order.orderNumber ?? "";
  const customerName = order.customerName ?? "";
  const totalNis = order.total ?? order.totalNis ?? 0;
  const items = Array.isArray(order.items) ? order.items : [];

  const lines = [
    `שלום ${customerName}! ההזמנה שלך (#${orderNumber}) מ-קפה בחצר מוכנה ☕`,
    "פירוט הזמנה:",
  ];

  for (const item of items) {
    const qty = item.qty ?? 1;
    const titleHe = item.nameHe || item.titleHe || item.title || "";
    const rawTags = Array.isArray(item.tagsHe)
      ? item.tagsHe
      : Array.isArray(item.selectedTags)
      ? item.selectedTags
      : [];
    const tagLabels = rawTags
      .map((t) =>
        typeof t === "object" && t !== null
          ? t.nameHe || t.labelHe || t.nameEn || t.labelEn || ""
          : String(t)
      )
      .filter(Boolean);
    const tagSuffix = tagLabels.length > 0 ? ` (${tagLabels.join(", ")})` : "";
    lines.push(`• ${qty}x ${titleHe}${tagSuffix}`);
  }

  lines.push(`סה"כ לתשלום: ₪${totalNis}`);
  const message = lines.join("\n");
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}
