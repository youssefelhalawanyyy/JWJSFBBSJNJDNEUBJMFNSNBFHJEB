/**
 * Storage utilities to safely interact with browser localStorage.
 * Prevents QuotaExceededError from breaking critical application flows
 * and sanitizes bulky base64 data (signatures, images) before caching.
 */

export function safeSetLocalStorage(key: string, value: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (_err) {
    try {
      // Clear non-critical large cache items if quota exceeded
      const disposableKeys = [
        "cached_detailed_credits",
        "cached_detailed_payments",
        "cached_detailed_deposits",
        "anh_dismissed_anomalies"
      ];
      for (const dKey of disposableKeys) {
        if (dKey !== key) {
          try { localStorage.removeItem(dKey); } catch (_) {}
        }
      }
      // Retry once after clearing old caches
      localStorage.setItem(key, value);
      return true;
    } catch (_retryErr) {
      return false;
    }
  }
}

export function safeGetLocalStorage(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(key);
  } catch (_err) {
    return null;
  }
}

/**
 * Strips heavy data (base64 signatures, large image blobs, raw items)
 * so storing credits in localStorage never exceeds quota limits and loads instantly.
 */
export function sanitizeCreditForCache(credit: any) {
  if (!credit) return null;
  return {
    id: credit.id,
    amountDue: Number(credit.amountDue || 0),
    collectionDate: credit.collectionDate || "",
    companyName: credit.companyName || "",
    createdAt: credit.createdAt || null,
    createdBy: credit.createdBy || "",
    invoiceNumber: credit.invoiceNumber || "",
    isTaxable: Boolean(credit.isTaxable),
    onSalesOnly: Boolean(credit.onSalesOnly),
    poNumber: credit.poNumber || "",
    poImageUrl: (credit.poImageUrl && credit.poImageUrl.length < 2500) ? credit.poImageUrl : "",
    items: Array.isArray(credit.items) ? credit.items.slice(0, 30).map((it: any) => ({
      barcode: it.barcode || "N/A",
      description: it.description || it.name || it.itemName || "",
      name: it.name || it.description || it.itemName || "",
      quantity: Number(it.quantity) || 1,
      unitPrice: Number(it.unitPrice ?? it.price ?? 0),
      price: Number(it.price ?? it.unitPrice ?? 0),
      total: Number(it.total ?? it.totalPrice ?? 0)
    })) : [],
    status: credit.status || "open",
    storeId: credit.storeId || "",
    tax: Number(credit.tax || 0),
    paidAmount: Number(credit.paidAmount || 0),
    priceAdjustment: Number(credit.priceAdjustment || 0),
    date: credit.date || "",
    supplierRepName: credit.supplierRepName || "",
    isEdited: Boolean(credit.isEdited),
    settledAsFull: Boolean(credit.settledAsFull),
    settlementReason: credit.settlementReason || "",
    waivedAmount: Number(credit.waivedAmount || 0),
  };
}

/**
 * Strips heavy data from deposits before caching
 */
export function sanitizeDepositForCache(deposit: any) {
  if (!deposit) return null;
  return {
    id: deposit.id,
    amount: Number(deposit.amount || 0),
    type: deposit.type || "",
    date: deposit.date || "",
    source: deposit.source || "",
    destination: deposit.destination || "",
    notes: deposit.notes || "",
    storeId: deposit.storeId || "",
    createdAt: deposit.createdAt || null,
    createdBy: deposit.createdBy || "",
  };
}

/**
 * Strips heavy image/photo URLs from payments before caching
 */
export function sanitizePaymentForCache(payment: any) {
  if (!payment) return null;
  const { invoiceUrls, invoiceUrl, photoUrls, ...rest } = payment;
  return rest;
}
