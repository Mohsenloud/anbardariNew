import { Invoice, InvoiceItem, Product } from '../types';

/**
 * Helper to check whether a specific item in an invoice represents a service (خدمات)
 * or physical merchandise / goods (کالا / محصول).
 */
export function isServiceItem(
  item: InvoiceItem | { id?: string; productId?: string; productName?: string; productCode?: string; unit?: string; isService?: boolean; itemType?: string },
  products?: Product[]
): boolean {
  if (!item) return false;

  // 1. Explicit service flags
  if ((item as any).isService === true) return true;
  if ((item as any).itemType === 'service') return true;

  // 2. ID prefix from service modal
  if (item.id && typeof item.id === 'string' && item.id.startsWith('service-')) {
    return true;
  }

  // 3. Auto-generated service code prefix (SRV-...)
  if (item.productCode && typeof item.productCode === 'string') {
    const code = item.productCode.trim().toUpperCase();
    if (code.startsWith('SRV-') || code.startsWith('SRV')) {
      return true;
    }
  }

  // 4. Empty or missing productId indicates a custom non-inventory service/labor row
  if (item.productId === '' || item.productId === undefined || item.productId === null) {
    return true;
  }

  // 5. Match with product catalog if available
  if (products && products.length > 0 && item.productId) {
    const prod = products.find(
      (p) => p.id === item.productId || (p.code && item.productCode && p.code.trim() === item.productCode.trim())
    );
    if (prod) {
      if ((prod as any).isService === true || (prod as any).type === 'service') {
        return true;
      }
      const cat = (prod.category || '').trim().toLowerCase();
      if (cat === 'خدمات' || cat.includes('خدمات') || cat === 'service' || cat === 'services') {
        return true;
      }
    }
  }

  return false;
}

/**
 * Returns true if an invoice is solely composed of services (no physical warehouse products).
 * Invoices with only services must NOT generate an exit slip (حواله خروج).
 */
export function isPureServiceInvoice(
  invoice: Invoice,
  products?: Product[]
): boolean {
  if (!invoice || !invoice.items || invoice.items.length === 0) {
    return false;
  }
  return invoice.items.every((it) => isServiceItem(it, products));
}

/**
 * Returns true if an invoice has at least one physical inventory product requiring an exit slip.
 */
export function hasPhysicalGoods(
  invoice: Invoice,
  products?: Product[]
): boolean {
  if (!invoice || !invoice.items || invoice.items.length === 0) {
    return false;
  }
  return invoice.items.some((it) => !isServiceItem(it, products));
}

/**
 * Filters an invoice's items to return only physical products (excluding all services).
 * Useful for warehouse exit slips and delivery manifests.
 */
export function getInvoicePhysicalItems(
  invoice: Invoice,
  products?: Product[]
): InvoiceItem[] {
  if (!invoice || !invoice.items) return [];
  return invoice.items.filter((it) => !isServiceItem(it, products));
}

/**
 * Filters an invoice's items to return only service items.
 */
export function getInvoiceServiceItems(
  invoice: Invoice,
  products?: Product[]
): InvoiceItem[] {
  if (!invoice || !invoice.items) return [];
  return invoice.items.filter((it) => isServiceItem(it, products));
}
