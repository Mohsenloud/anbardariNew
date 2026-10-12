/**
 * Comprehensive Persian / Arabic / English Search Normalizer & Matcher
 * Handles:
 * - Persian & Arabic digits -> English digits (۰-۹, ٠-٩ -> 0-9)
 * - Arabic character variants -> Persian (ي -> ی, ك -> ک, ة -> ه, آ/أ/إ -> ا)
 * - Zero-width characters (Nim-faseleh / ZWNJ \u200C, \u200B, \uFEFF)
 * - Punctuation & symbols stripping for compound word matching (e.g. سخت‌کننده vs سخت کننده vs سختکننده)
 * - Multi-token matching across multiple entity fields
 */

export function normalizeSearchText(val: any): string {
  if (val === null || val === undefined) return '';
  return String(val)
    .toLowerCase()
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 1776))
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 1632))
    .replace(/[ي]/g, 'ی')
    .replace(/[ك]/g, 'ک')
    .replace(/[آاإأ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/[\u200C\u200B\u200E\u200F\uFEFF]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function stripSpacesAndSymbols(str: string): string {
  return (str || '')
    .replace(/[\s\-_/.,،:;()\[\]{}*+?!~`#$^|\\'"«»]+/g, '')
    .trim();
}

export function normalizeDateString(dateVal: any): string {
  if (!dateVal) return '';
  return normalizeSearchText(String(dateVal))
    .replace(/-/g, '/')
    .replace(/\s+/g, '');
}

export function tokenizeSearchQuery(query: string): string[] {
  const norm = normalizeSearchText(query);
  if (!norm) return [];
  return norm.split(/\s+/).filter(Boolean);
}

/**
 * Checks whether a single search token matches a target text string
 */
export function checkTokenMatchesText(token: string, targetText: any): boolean {
  if (!token) return true;
  if (targetText === null || targetText === undefined || targetText === '') return false;

  const normTarget = normalizeSearchText(targetText);
  if (!normTarget) return false;

  // Direct substring match
  if (normTarget.includes(token)) return true;

  // Stripped space & symbol match for Persian compound words
  const strippedToken = stripSpacesAndSymbols(token);
  const strippedTarget = stripSpacesAndSymbols(normTarget);
  if (strippedToken && strippedTarget.includes(strippedToken)) return true;

  return false;
}

/**
 * Checks whether a token matches ANY candidate string in an array
 */
export function tokenMatchesAny(token: string, candidates: (string | number | undefined | null)[]): boolean {
  for (const c of candidates) {
    if (checkTokenMatchesText(token, c)) return true;
  }
  return false;
}

/**
 * Checks whether an invoice's top-level metadata matches all search tokens
 */
export function checkInvoiceMetadataMatches(
  invoice: any,
  slip: any,
  tokens: string[]
): boolean {
  if (tokens.length === 0) return true;

  const invoiceCandidates: (string | number | undefined | null)[] = [
    invoice.invoiceNumber,
    slip?.slipNumber,
    invoice.date,
    invoice.customerName,
    invoice.customerPhone,
    invoice.customerNationalId,
    invoice.customerAddress,
    invoice.notes,
    invoice.chequeNumber,
    slip?.receiverName,
    slip?.receiverPhone,
    slip?.vehicleInfo,
    slip?.deliveryNotes,
    slip?.deliveredBy,
    slip?.deliveredAt,
    invoice.isProforma ? 'پیش‌فاکتور proforma پیشفاکتور' : 'فاکتور رسمی قطعی official',
    slip?.isDelivered ? 'تحویل شد تحویل‌گردید delivered' : 'در انتظار تحویل pending',
    invoice.paymentStatus === 'paid' ? 'تسویه پرداخت شده' : invoice.paymentStatus === 'partial' ? 'تسویه ناقص اقساط' : 'پرداخت نشده نسیه',
    invoice.finalTotal ? String(invoice.finalTotal) : undefined,
  ];

  return tokens.every((tok) => tokenMatchesAny(tok, invoiceCandidates));
}

/**
 * Checks whether a specific item row (together with its parent invoice metadata) matches all search tokens
 */
export function checkItemMatchesSearch(
  item: any,
  invoice: any,
  slip: any,
  tokens: string[]
): boolean {
  if (tokens.length === 0) return true;

  // If the invoice metadata alone satisfies all tokens, the item matches
  if (checkInvoiceMetadataMatches(invoice, slip, tokens)) {
    return true;
  }

  // Otherwise, test whether the combination of invoice metadata + item fields satisfies all tokens
  const allCandidates: (string | number | undefined | null)[] = [
    invoice.invoiceNumber,
    slip?.slipNumber,
    invoice.date,
    invoice.customerName,
    invoice.customerPhone,
    invoice.customerNationalId,
    invoice.customerAddress,
    invoice.notes,
    slip?.receiverName,
    slip?.receiverPhone,
    slip?.vehicleInfo,
    slip?.deliveryNotes,
    item.productName,
    item.variantName,
    item.productCode,
    item.unit,
    item.description,
    item.quantity ? String(item.quantity) : undefined,
    item.unitPrice ? String(item.unitPrice) : undefined,
    item.total ? String(item.total) : undefined,
  ];

  return tokens.every((tok) => tokenMatchesAny(tok, allCandidates));
}

/**
 * Checks whether an invoice matches either by its own metadata OR by containing at least one matching item
 */
export function checkInvoiceMatchesSearch(
  invoice: any,
  slip: any,
  tokens: string[]
): boolean {
  if (tokens.length === 0) return true;

  if (checkInvoiceMetadataMatches(invoice, slip, tokens)) {
    return true;
  }

  if (invoice.items && invoice.items.length > 0) {
    return invoice.items.some((it: any) => checkItemMatchesSearch(it, invoice, slip, tokens));
  }

  return false;
}
