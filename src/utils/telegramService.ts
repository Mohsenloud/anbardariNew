import React from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { Invoice, ExitSlipData, StoreSettings, AppUser, InboundReceipt, PurchaseInvoice, Customer, CustomerTransaction } from '../types';
import { toPersianDigits, formatPrice, getCurrentJalaliTime, getCurrentJalaliDate } from './jalali';
import { generatePdfBlob, getInvoicePdfFilename } from './pdfHelper';
import { StorageService } from './storage';
import { SimpleInvoiceLayout } from '../components/SimpleInvoiceLayout';
import { StandardInvoiceLayout } from '../components/StandardInvoiceLayout';
import { SimpleExitSlipLayout } from '../components/SimpleExitSlipLayout';
import { StandardExitSlipLayout } from '../components/StandardExitSlipLayout';

export async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('خطا در تبدیل فایل به Base64'));
      }
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export async function testTelegramBotConnection(botToken: string): Promise<{
  success: boolean;
  bot?: { id: number; first_name: string; username: string };
  message?: string;
  error?: string;
}> {
  try {
    const res = await fetch('/api/telegram/test-connection', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ botToken: botToken.trim() }),
    });
    const data = await res.json();
    return data;
  } catch (err: any) {
    return {
      success: false,
      error: 'عدم امکان برقراری ارتباط با سرور برنامه: ' + (err?.message || ''),
    };
  }
}

export async function testTelegramMessage(
  botToken: string,
  chatId: string,
  text?: string
): Promise<{
  success: boolean;
  message?: string;
  error?: string;
}> {
  try {
    const res = await fetch('/api/telegram/test-message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        botToken: botToken.trim(),
        chatId: chatId.trim(),
        text,
      }),
    });
    const data = await res.json();
    return data;
  } catch (err: any) {
    return {
      success: false,
      error: 'خطا در ارسال پیام تستی: ' + (err?.message || ''),
    };
  }
}

export async function sendTelegramTextMessage(params: {
  botToken?: string;
  chatId?: string;
  text: string;
  parseMode?: 'HTML' | 'Markdown';
}): Promise<{
  success: boolean;
  message?: string;
  error?: string;
}> {
  try {
    const res = await fetch('/api/telegram/send-message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        botToken: params.botToken?.trim(),
        chatId: params.chatId?.trim(),
        text: params.text,
        parse_mode: params.parseMode || 'HTML',
      }),
    });
    const data = await res.json();
    return data;
  } catch (err: any) {
    return {
      success: false,
      error: 'خطا در ارتباط با سرور: ' + (err?.message || ''),
    };
  }
}

export async function sendPdfToTelegram(params: {
  botToken?: string;
  chatId?: string;
  pdfBlob: Blob;
  filename: string;
  caption?: string;
}): Promise<{
  success: boolean;
  message?: string;
  error?: string;
}> {
  try {
    const pdfBase64 = await blobToBase64(params.pdfBlob);
    const res = await fetch('/api/telegram/send-pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        botToken: params.botToken?.trim(),
        chatId: params.chatId?.trim(),
        pdfBase64,
        filename: params.filename,
        caption: params.caption,
      }),
    });
    const data = await res.json();
    return data;
  } catch (err: any) {
    return {
      success: false,
      error: 'خطا در ارتباط با سرور: ' + (err?.message || ''),
    };
  }
}

export function isTelegramConfigured(settings?: StoreSettings): boolean {
  return Boolean(
    settings?.telegramBotEnabled &&
    settings?.telegramBotToken?.trim() &&
    settings?.telegramChatId?.trim()
  );
}

export function formatInvoiceTelegramCaption(invoice: Invoice, settings?: StoreSettings): string {
  const store = settings?.storeName || 'سامانه حسابداری و فروشگاه';
  const lines: string[] = [
    `🧾 <b>${invoice.isProforma ? 'پیش‌فاکتور' : 'فاکتور فروش'} شماره ${invoice.invoiceNumber}</b>`,
    `🏢 <b>فروشگاه:</b> ${store}`,
    `👤 <b>خریدار:</b> ${invoice.customerName}`,
  ];

  if (invoice.customerPhone) {
    lines.push(`📞 <b>شماره تماس:</b> ${toPersianDigits(invoice.customerPhone)}`);
  }

  lines.push(`💰 <b>مبلغ نهایی فاکتور:</b> ${formatPrice(invoice.finalTotal)}`);
  lines.push(`📅 <b>تاریخ صدور:</b> ${toPersianDigits(invoice.date)}`);

  if (invoice.items && invoice.items.length > 0) {
    lines.push(`📦 <b>تعداد اقلام:</b> ${toPersianDigits(invoice.items.length)} ردیف کالا`);
  }

  lines.push('');
  lines.push('📎 <i>فایل رسمی PDF فاکتور ضمیمه گردید.</i>');

  return lines.join('\n');
}

export function formatExitSlipTelegramCaption(
  invoice: Invoice,
  slipLog: ExitSlipData,
  settings?: StoreSettings
): string {
  const warehouse = settings?.originWarehouseName || 'انبار مرکزی';
  const lines: string[] = [
    `🚚 <b>حواله خروج انبار - فاکتور شماره ${invoice.invoiceNumber}</b>`,
    `🏢 <b>انبار مبدأ:</b> ${warehouse}`,
    `👤 <b>تحویل‌گیرنده / راننده:</b> ${slipLog.receiverName || invoice.customerName}`,
  ];

  if (slipLog.receiverPhone || invoice.customerPhone) {
    lines.push(`📞 <b>تلفن تماس:</b> ${toPersianDigits(slipLog.receiverPhone || invoice.customerPhone || '')}`);
  }

  if (slipLog.vehicleInfo) {
    lines.push(`🚛 <b>مشخصات خودرو:</b> ${toPersianDigits(slipLog.vehicleInfo)}`);
  }

  if (slipLog.deliveredAt) {
    lines.push(`🕒 <b>زمان تایید خروج:</b> ${toPersianDigits(slipLog.deliveredAt)}`);
  }

  if (slipLog.deliveredBy) {
    lines.push(`👨‍💼 <b>انباردار مسئول:</b> ${slipLog.deliveredBy}`);
  }

  if (slipLog.deliveryNotes) {
    lines.push(`📝 <b>توضیحات:</b> ${slipLog.deliveryNotes}`);
  }

  lines.push('');
  lines.push('📎 <i>فایل رسمی PDF برگه خروج انبار ضمیمه گردید.</i>');

  return lines.join('\n');
}

export function formatInboundReceiptTelegramCaption(
  receipt: InboundReceipt,
  settings?: StoreSettings
): string {
  const warehouse = settings?.originWarehouseName || 'انبار مرکزی';
  const lines: string[] = [
    `📥 <b>رسید ورود کالا به انبار - شماره #${receipt.receiptNumber}</b>`,
    `🏢 <b>انبار مقصد:</b> ${warehouse}`,
    `👤 <b>تامین‌کننده:</b> ${receipt.supplierName}`,
  ];

  if (receipt.purchaseInvoiceNumber) {
    lines.push(`🧾 <b>فاکتور خرید متناظر:</b> ${toPersianDigits(receipt.purchaseInvoiceNumber)}`);
  }

  lines.push(`📦 <b>تعداد اقلام:</b> ${toPersianDigits(receipt.items?.length || 0)} قلم (${toPersianDigits(receipt.totalReceivedQuantity || receipt.totalExpectedQuantity || 0)} واحد)`);

  if (receipt.verifiedBy) {
    lines.push(`👨‍💼 <b>انباردار تاییدکننده:</b> ${receipt.verifiedBy}`);
  }

  if (receipt.verifiedDate) {
    lines.push(`🕒 <b>تاریخ و ساعت تایید:</b> ${toPersianDigits(receipt.verifiedDate)}`);
  }

  lines.push('');
  lines.push('📎 <i>فایل رسمی PDF رسید ورود انبار ضمیمه گردید.</i>');

  return lines.join('\n');
}

/**
 * گزارش متنی ساده و کوتاه فاکتور فروش
 */
export function formatInvoiceTextReport(invoice: Invoice, settings?: StoreSettings): string {
  const store = settings?.storeName || 'سامانه حسابداری و بازرگانی';
  const lines = [
    `🧾 <b>گزارش ثبت فاکتور فروش</b>`,
    `▫️ شماره فاکتور: <code>${toPersianDigits(invoice.invoiceNumber)}</code>`,
    `▫️ خریدار: <b>${invoice.customerName}</b>`,
    invoice.customerPhone ? `▫️ تلفن: <code>${toPersianDigits(invoice.customerPhone)}</code>` : '',
    `▫️ تاریخ صدور: ${toPersianDigits(invoice.date)}`,
    `▫️ تعداد اقلام: ${toPersianDigits(invoice.items.length)} قلم کالا`,
    `▫️ مبلغ کل: <b>${toPersianDigits(formatPrice(invoice.finalTotal))} تومان</b>`,
    `▫️ وضعیت پرداخت: ${invoice.paymentStatus === 'paid' ? '✅ تسویه کامل شده' : invoice.paymentStatus === 'partial' ? '⚠️ بیعانه / بخشی' : '⏳ نسیه / حساب دفتری'}`,
    store ? `🏪 <i>${store}</i>` : '',
  ].filter(Boolean);
  return lines.join('\n');
}

/**
 * گزارش متنی ساده و کوتاه فاکتور خرید کالا
 */
export function formatPurchaseInvoiceTextReport(purchaseInvoice: PurchaseInvoice, settings?: StoreSettings): string {
  const store = settings?.storeName || 'سامانه حسابداری و بازرگانی';
  const currency = settings?.currency || 'تومان';
  const paymentLabel = purchaseInvoice.paymentStatus === 'paid'
    ? '✅ تسویه نقدی کامل'
    : purchaseInvoice.paymentStatus === 'partial'
      ? '⚠️ پرداخت بخشی / بیعانه'
      : '⏳ حساب دفتری / نسیه';

  const lines = [
    `🛒 <b>گزارش ثبت فاکتور خرید کالا</b>`,
    `▫️ شماره فاکتور: <code>${toPersianDigits(purchaseInvoice.invoiceNumber)}</code>`,
    `▫️ تامین‌کننده: <b>${purchaseInvoice.supplierName}</b>`,
    purchaseInvoice.supplierPhone ? `▫️ تلفن: <code>${toPersianDigits(purchaseInvoice.supplierPhone)}</code>` : '',
    `▫️ تاریخ صدور: ${toPersianDigits(purchaseInvoice.date)}`,
    `▫️ تعداد اقلام: ${toPersianDigits(purchaseInvoice.items?.length || 0)} قلم کالا`,
    `▫️ مبلغ نهایی: <b>${toPersianDigits(formatPrice(purchaseInvoice.finalTotal))} ${currency}</b>`,
    `▫️ وضعیت پرداخت: ${paymentLabel}`,
    purchaseInvoice.inboundReceiptId ? `▫️ وضعیت انبار: 📦 حواله ورود به انبار صادر شد` : '',
    purchaseInvoice.notes ? `▫️ توضیحات: <i>«${purchaseInvoice.notes}»</i>` : '',
    store ? `🏪 <i>${store}</i>` : '',
  ].filter(Boolean);
  return lines.join('\n');
}

/**
 * گزارش متنی ساده و کوتاه پیش‌فاکتور
 */
export function formatProformaTextReport(invoice: Invoice, settings?: StoreSettings): string {
  const store = settings?.storeName || 'سامانه حسابداری و بازرگانی';
  const lines = [
    `📑 <b>گزارش صدور پیش‌فاکتور</b>`,
    `▫️ شماره: <code>${toPersianDigits(invoice.invoiceNumber)}</code>`,
    `▫️ مشتری: <b>${invoice.customerName}</b>`,
    invoice.customerPhone ? `▫️ تلفن: <code>${toPersianDigits(invoice.customerPhone)}</code>` : '',
    `▫️ تاریخ صدور: ${toPersianDigits(invoice.date)}`,
    `▫️ تعداد اقلام: ${toPersianDigits(invoice.items.length)} قلم کالا`,
    `▫️ مبلغ برآورد: <b>${toPersianDigits(formatPrice(invoice.finalTotal))} تومان</b>`,
    `▫️ وضعیت: ⏳ در انتظار تایید مشتری`,
    store ? `🏪 <i>${store}</i>` : '',
  ].filter(Boolean);
  return lines.join('\n');
}

/**
 * گزارش متنی صدور حواله ورود کالا به انبار
 */
export function formatInboundReceiptIssueTextReport(receipt: InboundReceipt, settings?: StoreSettings): string {
  const store = settings?.storeName || 'سامانه بازرگانی و انبارداری';
  const warehouse = settings?.originWarehouseName || 'انبار مرکزی';
  const lines = [
    `📥 <b>گزارش صدور حواله ورود کالا به انبار</b>`,
    `▫️ شماره حواله: <code>#${toPersianDigits(receipt.receiptNumber)}</code>`,
    `▫️ تامین‌کننده: <b>${receipt.supplierName}</b>`,
    `▫️ فاکتور خرید متناظر: <code>${toPersianDigits(receipt.purchaseInvoiceNumber)}</code>`,
    `▫️ انبار مقصد: ${warehouse}`,
    `▫️ تعداد اقلام وارده: ${toPersianDigits(receipt.items.length)} قلم (${toPersianDigits(receipt.totalExpectedQuantity)} واحد)`,
    `▫️ تاریخ صدور: ${toPersianDigits(receipt.date)}`,
    `▫️ وضعیت: ⏳ در انتظار شمارش و تایید انباردار`,
    store ? `🏪 <i>${store}</i>` : '',
  ].filter(Boolean);
  return lines.join('\n');
}

/**
 * گزارش متنی تایید و تخلیه ورود کالا به انبار
 */
export function formatInboundReceiptConfirmTextReport(receipt: InboundReceipt, settings?: StoreSettings): string {
  const store = settings?.storeName || 'سامانه بازرگانی و انبارداری';
  const hasDiscrepancy = receipt.status === 'has_discrepancy' || receipt.totalDiscrepancy !== 0;
  const lines = [
    `✅ <b>گزارش تایید ورود و تخلیه کالا در انبار</b>`,
    `▫️ شماره حواله: <code>#${toPersianDigits(receipt.receiptNumber)}</code>`,
    `▫️ تامین‌کننده: <b>${receipt.supplierName}</b>`,
    `▫️ فاکتور خرید: <code>${toPersianDigits(receipt.purchaseInvoiceNumber)}</code>`,
    `▫️ وضعیت شمارش: ${hasDiscrepancy ? `⚠️ تایید با مغایرت (${toPersianDigits(Math.abs(receipt.totalDiscrepancy))} واحد ${receipt.totalDiscrepancy < 0 ? 'کسری' : 'مازاد'})` : '✅ تایید کامل و ثبت قطعی در کاردکس'}`,
    `▫️ تعداد تحویل‌شده: <b>${toPersianDigits(receipt.totalReceivedQuantity)} از ${toPersianDigits(receipt.totalExpectedQuantity)} واحد</b>`,
    receipt.verifiedBy ? `▫️ انباردار تاییدکننده: <b>${receipt.verifiedBy}</b>` : '',
    receipt.verifiedDate ? `▫️ زمان تایید: ${toPersianDigits(receipt.verifiedDate)}` : '',
    receipt.warehouseNotes ? `▫️ یادداشت انباردار: <i>«${receipt.warehouseNotes}»</i>` : '',
    store ? `🏪 <i>${store}</i>` : '',
  ].filter(Boolean);
  return lines.join('\n');
}

/**
 * گزارش متنی صدور حواله خروج کالا از انبار
 */
export function formatExitSlipIssueTextReport(invoice: Invoice, exitSlipNumber?: string, settings?: StoreSettings): string {
  const store = settings?.storeName || 'سامانه بازرگانی و انبارداری';
  const warehouse = settings?.originWarehouseName || 'انبار مرکزی';
  const lines = [
    `📤 <b>گزارش صدور حواله خروج کالا</b>`,
    `▫️ فاکتور متناظر: <code>${toPersianDigits(invoice.invoiceNumber)}</code>`,
    exitSlipNumber ? `▫️ شماره حواله خروج: <code>${toPersianDigits(exitSlipNumber)}</code>` : '',
    `▫️ انبار مبدأ: ${warehouse}`,
    `▫️ خریدار: <b>${invoice.customerName}</b>`,
    invoice.customerPhone ? `▫️ تلفن خریدار: <code>${toPersianDigits(invoice.customerPhone)}</code>` : '',
    `▫️ تعداد اقلام حواله: ${toPersianDigits(invoice.items.length)} قلم کالا`,
    `▫️ تاریخ صدور: ${toPersianDigits(invoice.date)}`,
    `▫️ وضعیت: ⏳ در انتظار بارگیری و تحویل نهایی`,
    store ? `🏪 <i>${store}</i>` : '',
  ].filter(Boolean);
  return lines.join('\n');
}

/**
 * گزارش متنی تایید خروج و تحویل بار به راننده / مشتری
 */
export function formatExitSlipConfirmTextReport(invoice: Invoice, slipLog: ExitSlipData, settings?: StoreSettings): string {
  const store = settings?.storeName || 'سامانه بازرگانی و انبارداری';
  const warehouse = settings?.originWarehouseName || 'انبار مرکزی';
  const lines = [
    `🚚 <b>گزارش تایید تحویل و خروج قطعی از انبار</b>`,
    `▫️ فاکتور فروش: <code>${toPersianDigits(invoice.invoiceNumber)}</code>`,
    `▫️ انبار مبدأ: ${warehouse}`,
    `▫️ تحویل‌گیرنده: <b>${slipLog.receiverName || invoice.customerName}</b>`,
    (slipLog.receiverPhone || invoice.customerPhone) ? `▫️ تلفن تماس: <code>${toPersianDigits(slipLog.receiverPhone || invoice.customerPhone || '')}</code>` : '',
    slipLog.vehicleInfo ? `▫️ مشخصات خودرو / باربری: <b>${toPersianDigits(slipLog.vehicleInfo)}</b>` : '',
    slipLog.deliveredBy ? `▫️ انباردار تحویل‌دهنده: <b>${slipLog.deliveredBy}</b>` : '',
    slipLog.deliveredAt ? `▫️ زمان خروج بار: ${toPersianDigits(slipLog.deliveredAt)}` : '',
    slipLog.deliveryNotes ? `▫️ توضیحات: <i>«${slipLog.deliveryNotes}»</i>` : '',
    store ? `🏪 <i>${store}</i>` : '',
  ].filter(Boolean);
  return lines.join('\n');
}

const PAYMENT_METHOD_MAP: Record<string, string> = {
  cash: 'نقدی',
  transfer: 'واریز بانکی / پایا / کارت‌به‌کارت',
  pos: 'دستگاه کارتخوان (POS)',
  cheque: 'چک بانکی',
  card: 'کارت‌به‌کارت',
  credit: 'نسیه / حساب دفتری',
  other: 'سایر / توافقی',
};

/**
 * فرمت پیام تلگرام برای دریافت مبلغ از مشتری (واریزی / چک / تسویه)
 */
export function formatCustomerPaymentTelegramReport(
  txn: CustomerTransaction,
  customer?: Customer | null,
  settings?: StoreSettings,
  balanceAfter?: number
): string {
  const store = settings?.storeName || 'سامانه حسابداری و بازرگانی';
  const currency = settings?.currency || 'تومان';
  const methodLabel = txn.paymentMethod
    ? PAYMENT_METHOD_MAP[txn.paymentMethod] || txn.paymentMethod
    : 'واریز بانکی / نقدی';

  const lines = [
    `💵 <b>رسید دریافت وجه از مشتری</b>`,
    `▫️ نام خریدار: <b>${txn.customerName}</b>`,
    customer?.phone ? `▫️ شماره تماس: <code>${toPersianDigits(customer.phone)}</code>` : '',
    `▫️ مبلغ دریافتی: <b>${toPersianDigits(formatPrice(txn.amount))} ${currency}</b>`,
    `▫️ روش دریافت: <b>${methodLabel}</b>`,
    txn.title ? `▫️ بابت / عنوان سند: <i>«${txn.title}»</i>` : '',
    txn.invoiceNumber ? `▫️ مربوط به فاکتور: شماره <code>${toPersianDigits(txn.invoiceNumber)}</code>` : '',
    txn.trackingNumber ? `▫️ شماره پیگیری / ارجاع / صیادی: <code>${toPersianDigits(txn.trackingNumber)}</code>` : '',
    txn.bankName ? `▫️ حساب / بانک مقصد: <b>${txn.bankName}</b>` : '',
    txn.chequeDueDate ? `▫️ سررسید چک: <b>${toPersianDigits(txn.chequeDueDate)}</b>` : '',
    `▫️ تاریخ ثبت: ${toPersianDigits(txn.date)}`,
    balanceAfter !== undefined
      ? `▫️ وضعیت مانده حساب مشتری: <b>${
          balanceAfter > 0
            ? `${toPersianDigits(formatPrice(balanceAfter))} ${currency} (بدهکار)`
            : balanceAfter < 0
            ? `${toPersianDigits(formatPrice(Math.abs(balanceAfter)))} ${currency} (بستانکار/طلبکار)`
            : '✅ تسویه حساب کامل (صفر)'
        }</b>`
      : '',
    txn.recordedBy ? `▫️ ثبت‌کننده: ${txn.recordedBy}` : '',
    txn.notes ? `▫️ توضیحات: <i>«${txn.notes}»</i>` : '',
    store ? `🏪 <i>${store}</i>` : '',
  ].filter(Boolean);

  return lines.join('\n');
}

/**
 * فرمت پیام تلگرام برای پرداخت مبلغ به تامین‌کننده (پرداختی / تسویه فاکتور خرید)
 */
export function formatSupplierPaymentTelegramReport(params: {
  supplierName: string;
  supplierPhone?: string;
  amount: number;
  paymentMethod?: string;
  trackingNumber?: string;
  bankName?: string;
  chequeDueDate?: string;
  invoiceNumber?: string;
  date?: string;
  title?: string;
  notes?: string;
  recordedBy?: string;
  settings?: StoreSettings;
  balanceAfter?: number;
}): string {
  const store = params.settings?.storeName || 'سامانه حسابداری و بازرگانی';
  const currency = params.settings?.currency || 'تومان';
  const methodLabel = params.paymentMethod
    ? PAYMENT_METHOD_MAP[params.paymentMethod] || params.paymentMethod
    : 'واریز بانکی / نقدی';

  const lines = [
    `💳 <b>رسید پرداخت وجه به تامین‌کننده</b>`,
    `▫️ تامین‌کننده / فروشنده: <b>${params.supplierName}</b>`,
    params.supplierPhone ? `▫️ شماره تماس: <code>${toPersianDigits(params.supplierPhone)}</code>` : '',
    `▫️ مبلغ پرداختی: <b>${toPersianDigits(formatPrice(params.amount))} ${currency}</b>`,
    `▫️ روش پرداخت: <b>${methodLabel}</b>`,
    params.title ? `▫️ بابت / عنوان سند: <i>«${params.title}»</i>` : '',
    params.invoiceNumber ? `▫️ مربوط به فاکتور خرید: شماره <code>${toPersianDigits(params.invoiceNumber)}</code>` : '',
    params.trackingNumber ? `▫️ شماره پیگیری / ارجاع / چک: <code>${toPersianDigits(params.trackingNumber)}</code>` : '',
    params.bankName ? `▫️ بانک / حساب مبدأ: <b>${params.bankName}</b>` : '',
    params.chequeDueDate ? `▫️ تاریخ سررسید چک: <b>${toPersianDigits(params.chequeDueDate)}</b>` : '',
    `▫️ تاریخ پرداخت: ${toPersianDigits(params.date || getCurrentJalaliDate())}`,
    params.balanceAfter !== undefined
      ? `▫️ وضعیت مانده با تامین‌کننده: <b>${
          params.balanceAfter < 0
            ? `${toPersianDigits(formatPrice(Math.abs(params.balanceAfter)))} ${currency} (طلبکار از ما)`
            : params.balanceAfter > 0
            ? `${toPersianDigits(formatPrice(params.balanceAfter))} ${currency} (بدهکار به ما)`
            : '✅ تسویه حساب کامل (صفر)'
        }</b>`
      : '',
    params.recordedBy ? `▫️ ثبت‌کننده: ${params.recordedBy}` : '',
    params.notes ? `▫️ توضیحات: <i>«${params.notes}»</i>` : '',
    store ? `🏪 <i>${store}</i>` : '',
  ].filter(Boolean);

  return lines.join('\n');
}

/**
 * Generate Invoice PDF Blob whether the invoice modal is currently open or not.
 */
export async function generateInvoicePdfBlob(
  invoice: Invoice,
  passedSettings?: StoreSettings
): Promise<{ success: boolean; blob?: Blob; file?: File; error?: string }> {
  const settings = StorageService.getSettings() || passedSettings;
  const filename = getInvoicePdfFilename(invoice, { includeExtension: true });
  const quality = (settings?.pdfInvoiceQuality as any) || 'standard';
  const pageSize = settings?.telegramInvoicePageSize || 'a4';
  const orientation = settings?.telegramInvoiceOrientation || 'portrait';
  const isA5 = pageSize === 'a5';
  const isLandscape = orientation === 'landscape';

  let containerWidth = '820px';
  let containerMinHeight = '1175px';
  if (isA5) {
    if (isLandscape) {
      containerWidth = '900px';
      containerMinHeight = '625px';
    } else {
      containerWidth = '620px';
      containerMinHeight = '892px';
    }
  } else {
    if (isLandscape) {
      containerWidth = '1180px';
      containerMinHeight = '824px';
    } else {
      containerWidth = '820px';
      containerMinHeight = '1175px';
    }
  }

  // Create an offscreen container in the DOM:
  // Positioned offscreen cleanly, fully accessible for html2canvas
  const container = document.createElement('div');
  const containerId = `telegram-offscreen-invoice-${Date.now()}`;
  container.id = containerId;
  container.style.position = 'fixed';
  container.style.left = '-9999px';
  container.style.top = '0px';
  container.style.width = containerWidth;
  container.style.minHeight = containerMinHeight;
  container.style.backgroundColor = '#ffffff';
  container.style.zIndex = '-9999';
  container.style.pointerEvents = 'none';
  container.style.opacity = '1';
  container.dir = 'rtl';
  document.body.appendChild(container);

  const root = createRoot(container);
  try {
    const invoiceTemplate = settings?.telegramInvoiceTemplate || 'standard';
    const InvoiceComponent = invoiceTemplate === 'simple' ? SimpleInvoiceLayout : StandardInvoiceLayout;

    root.render(
      React.createElement(
        'div',
        {
          id: 'printable-invoice-offscreen',
          'data-invoice-id': invoice.id,
          style: {
            width: containerWidth,
            minHeight: containerMinHeight,
            backgroundColor: '#ffffff',
            padding: isA5 ? '16px' : '24px',
            boxSizing: 'border-box',
            direction: 'rtl',
          },
        },
        React.createElement(InvoiceComponent, {
          invoice,
          settings: settings as StoreSettings,
          pageSize,
          orientation,
        })
      )
    );

    // Wait for React 19 render cycle and web fonts to settle
    await new Promise((resolve) => setTimeout(resolve, 380));
    if (document.fonts) {
      try {
        await document.fonts.ready;
      } catch {}
    }

    const result = await generatePdfBlob(containerId, filename, {
      pageSize,
      orientation,
      documentType: 'invoice',
      quality,
    });

    return result;
  } catch (err: any) {
    console.error('[generateInvoicePdfBlob] Error:', err);
    return {
      success: false,
      error: 'خطا در ایجاد خودکار فایل PDF فاکتور: ' + (err?.message || ''),
    };
  } finally {
    setTimeout(() => {
      try {
        root.unmount();
        container.remove();
      } catch (e) {
        console.warn('Offscreen cleanup warning:', e);
      }
    }, 500);
  }
}

/**
 * Generate Exit Slip PDF Blob whether the exit slip modal is currently open or not.
 */
export async function generateExitSlipPdfBlob(
  invoice: Invoice,
  slipLog: ExitSlipData,
  passedSettings?: StoreSettings,
  currentUser?: AppUser
): Promise<{ success: boolean; blob?: Blob; file?: File; error?: string }> {
  const settings = StorageService.getSettings() || passedSettings;
  const filename = `برگه_خروج_انبار_فاکتور_${invoice.invoiceNumber}.pdf`;
  const quality = (settings?.pdfExitSlipQuality as any) || 'high';
  const pageSize = settings?.telegramExitSlipPageSize || 'a4';
  const orientation = settings?.telegramExitSlipOrientation || 'portrait';
  const isA5 = pageSize === 'a5';
  const isLandscape = orientation === 'landscape';

  let containerWidth = '820px';
  let containerMinHeight = '1175px';
  if (isA5) {
    if (isLandscape) {
      containerWidth = '900px';
      containerMinHeight = '625px';
    } else {
      containerWidth = '620px';
      containerMinHeight = '892px';
    }
  } else {
    if (isLandscape) {
      containerWidth = '1180px';
      containerMinHeight = '824px';
    } else {
      containerWidth = '820px';
      containerMinHeight = '1175px';
    }
  }

  // Create an offscreen container in the DOM:
  const container = document.createElement('div');
  const containerId = `telegram-offscreen-exit-slip-${Date.now()}`;
  container.id = containerId;
  container.style.position = 'fixed';
  container.style.left = '-9999px';
  container.style.top = '0px';
  container.style.width = containerWidth;
  container.style.minHeight = containerMinHeight;
  container.style.backgroundColor = '#ffffff';
  container.style.zIndex = '-9999';
  container.style.pointerEvents = 'none';
  container.style.opacity = '1';
  container.dir = 'rtl';
  document.body.appendChild(container);

  const originWarehouseName =
    settings?.originWarehouseName ||
    settings?.warehouses?.find((w) => w.id === settings?.defaultWarehouseId)?.name ||
    'انبار مرکزی';
  const slipNumber = StorageService.getOrAssignExitSlipNumber(invoice.id, invoice.invoiceNumber);
  const issuedTime = getCurrentJalaliTime();
  const totalUnits = (invoice.items || []).reduce((sum, item) => sum + (Number(item?.quantity) || 0), 0);

  const root = createRoot(container);
  try {
    const exitSlipTemplate = settings?.telegramExitSlipTemplate || 'standard';
    const ExitSlipComponent = exitSlipTemplate === 'simple' ? SimpleExitSlipLayout : StandardExitSlipLayout;

    root.render(
      React.createElement(
        'div',
        {
          id: 'printable-exit-slip-offscreen',
          'data-invoice-id': invoice.id,
          style: {
            width: containerWidth,
            minHeight: containerMinHeight,
            backgroundColor: '#ffffff',
            padding: isA5 ? '16px' : '24px',
            boxSizing: 'border-box',
            direction: 'rtl',
          },
        },
        React.createElement(ExitSlipComponent, {
          invoice,
          settings: settings as StoreSettings,
          slipLog,
          currentUser,
          slipNumber,
          issuedTime,
          originWarehouseName,
          totalUnits,
          pageSize,
          orientation,
        })
      )
    );

    await new Promise((resolve) => setTimeout(resolve, 380));
    if (document.fonts) {
      try {
        await document.fonts.ready;
      } catch {}
    }

    const result = await generatePdfBlob(containerId, filename, {
      pageSize,
      orientation,
      documentType: 'exit_slip',
      quality,
    });

    return result;
  } catch (err: any) {
    console.error('[generateExitSlipPdfBlob] Error:', err);
    return {
      success: false,
      error: 'خطا در ایجاد خودکار فایل PDF حواله خروج: ' + (err?.message || ''),
    };
  } finally {
    setTimeout(() => {
      try {
        root.unmount();
        container.remove();
      } catch (e) {
        console.warn('Offscreen cleanup warning:', e);
      }
    }, 500);
  }
}

/**
 * Automatically send Invoice or Proforma Report to Telegram Bot (Text, PDF, or Both)
 */
export async function autoSendInvoiceReportToTelegram(
  invoice: Invoice,
  passedSettings?: StoreSettings,
  callbacks?: {
    onStart?: () => void;
    onSuccess?: (msg: string) => void;
    onError?: (err: string) => void;
  }
): Promise<boolean> {
  const settings = StorageService.getSettings() || passedSettings;
  if (!settings?.telegramBotEnabled) {
    return false;
  }

  // بررسی فعال بودن نوع فاکتور در تنظیمات
  if (invoice.isProforma) {
    const isProformaEnabled = !!settings.telegramAutoSendProforma || settings.telegramAutoSendOnlyConfirmed === false;
    if (!isProformaEnabled) {
      console.log('[Telegram Auto-Send] ارسال خودکار پیش‌فاکتور در تنظیمات غیرفعال است.');
      return false;
    }
  } else {
    if (!settings.telegramAutoSendInvoice) {
      console.log('[Telegram Auto-Send] ارسال خودکار فاکتور فروش در تنظیمات غیرفعال است.');
      return false;
    }
  }

  const botToken = settings.telegramBotToken?.trim();
  const primaryChatId = (settings.telegramChatId || '').trim();
  const customerChatId = (invoice.telegramChatId || '').trim();
  const targetChatId = (customerChatId && settings.telegramAutoSendCustomerDirect !== false) 
    ? customerChatId 
    : primaryChatId;

  if (!botToken || !targetChatId) {
    const missing = !botToken ? 'توکن ربات' : 'شناسه چت مقصد';
    console.warn(`[Telegram Auto-Send] ${missing} تنظیم نشده است.`);
    callbacks?.onError?.(`ارسال به تلگرام ناموفق بود: ${missing} در تنظیمات وارد نشده است.`);
    return false;
  }

  const sendMode = settings.telegramSendMode || 'text_only';
  const isTextOnly = sendMode === 'text_only' || (sendMode as string) === 'text';
  const isBoth = sendMode === 'both';
  const isFileOnly =
    sendMode === 'pdf_with_caption' ||
    (sendMode as string) === 'file' ||
    (sendMode as string) === 'pdf' ||
    (!isTextOnly && !isBoth);

  try {
    callbacks?.onStart?.();

    // ۱. حالت فقط متنی (اگر تنظیم روی متن بود -> فقط بصورت متنی)
    if (isTextOnly) {
      const textReport = invoice.isProforma
        ? formatProformaTextReport(invoice, settings)
        : formatInvoiceTextReport(invoice, settings);

      const res = await sendTelegramTextMessage({
        botToken,
        chatId: targetChatId,
        text: textReport,
      });

      if (!res.success) {
        callbacks?.onError?.(res.error || 'خطا در ارسال گزارش متنی به تلگرام');
        return false;
      }

      // در صورت ارسال مستقیم به مشتری، نسخه رونوشت به کانال اصلی فروشگاه
      if (targetChatId !== primaryChatId && primaryChatId) {
        sendTelegramTextMessage({
          botToken,
          chatId: primaryChatId,
          text: textReport + '\n\n📢 <i>نسخه رونوشت به کانال فروشگاه</i>',
        }).catch((e) => console.warn(e));
      }

      const successMsg = `گزارش متنی ${invoice.isProforma ? 'پیش‌فاکتور' : 'فاکتور'} شماره ${invoice.invoiceNumber} با موفقیت به تلگرام ارسال گردید.`;
      callbacks?.onSuccess?.(successMsg);
      StorageService.logActivity({
        category: 'system',
        actionType: 'telegram_auto_sent',
        actionTitle: `ارسال گزارش متنی ${invoice.isProforma ? 'پیش‌فاکتور' : 'فاکتور'} به تلگرام`,
        details: `گزارش متنی ${invoice.isProforma ? 'پیش‌فاکتور' : 'فاکتور'} شماره ${invoice.invoiceNumber} به چت (${targetChatId}) ارسال شد.`,
      });
      return true;
    }

    // ۲. حالت فقط فایل (اگر تنظیم روی فایل بود -> فقط بصورت فایل با کپشن)
    if (isFileOnly) {
      const pdfResult = await generateInvoicePdfBlob(invoice, settings);
      if (!pdfResult.success || !pdfResult.blob) {
        const errorDesc = pdfResult.error || 'خطا در ایجاد فایل PDF فاکتور';
        console.error('[Telegram Auto-Send] File-only PDF generation failed:', errorDesc);
        callbacks?.onError?.(`تولید فایل PDF فاکتور با خطا مواجه شد: ${errorDesc}`);
        return false;
      }

      const filename = getInvoicePdfFilename(invoice, { includeExtension: true });
      const caption = formatInvoiceTelegramCaption(invoice, settings);

      const sendResult = await sendPdfToTelegram({
        botToken,
        chatId: targetChatId,
        pdfBlob: pdfResult.blob,
        filename,
        caption,
      });

      if (!sendResult.success) {
        callbacks?.onError?.(sendResult.error || 'خطا در ارسال فایل PDF فاکتور به تلگرام');
        return false;
      }

      // رونوشت به کانال اصلی فروشگاه در صورت ارسال مستقیم به مشتری
      if (targetChatId !== primaryChatId && primaryChatId) {
        sendPdfToTelegram({
          botToken,
          chatId: primaryChatId,
          pdfBlob: pdfResult.blob,
          filename,
          caption: caption + '\n\n📢 <i>نسخه رونوشت به کانال فروشگاه</i>',
        }).catch((e) => console.warn(e));
      }

      const successMsg = `فایل PDF ${invoice.isProforma ? 'پیش‌فاکتور' : 'فاکتور'} شماره ${invoice.invoiceNumber} با موفقیت به تلگرام ارسال شد.`;
      callbacks?.onSuccess?.(successMsg);
      StorageService.logActivity({
        category: 'system',
        actionType: 'telegram_auto_sent',
        actionTitle: `ارسال فایل PDF ${invoice.isProforma ? 'پیش‌فاکتور' : 'فاکتور'} به تلگرام`,
        details: `فایل PDF «${filename}» شماره ${invoice.invoiceNumber} به تلگرام (${targetChatId}) ارسال شد.`,
      });
      return true;
    }

    // ۳. حالت هر دو (اگر تنظیم روی هر دو بود -> فایل PDF + گزارش متنی تفکیک‌شده)
    if (isBoth) {
      const pdfResult = await generateInvoicePdfBlob(invoice, settings);
      const textReport = invoice.isProforma
        ? formatProformaTextReport(invoice, settings)
        : formatInvoiceTextReport(invoice, settings);

      let pdfSent = false;
      let filename = '';

      if (pdfResult.success && pdfResult.blob) {
        filename = getInvoicePdfFilename(invoice, { includeExtension: true });
        const caption = formatInvoiceTelegramCaption(invoice, settings);
        const sendPdfRes = await sendPdfToTelegram({
          botToken,
          chatId: targetChatId,
          pdfBlob: pdfResult.blob,
          filename,
          caption,
        });

        if (sendPdfRes.success) {
          pdfSent = true;
          // رونوشت فایل PDF به کانال اصلی فروشگاه
          if (targetChatId !== primaryChatId && primaryChatId) {
            sendPdfToTelegram({
              botToken,
              chatId: primaryChatId,
              pdfBlob: pdfResult.blob,
              filename,
              caption: caption + '\n\n📢 <i>نسخه رونوشت به کانال فروشگاه</i>',
            }).catch((e) => console.warn(e));
          }
        } else {
          console.error('[Telegram Auto-Send] Failed to send PDF in both mode:', sendPdfRes.error);
        }
      } else {
        console.error('[Telegram Auto-Send] PDF blob generation failed in both mode:', pdfResult.error);
      }

      // ارسال پیام متنی مجزا و تفکیک‌شده
      const sendTextRes = await sendTelegramTextMessage({
        botToken,
        chatId: targetChatId,
        text: textReport,
      });

      if (sendTextRes.success) {
        if (targetChatId !== primaryChatId && primaryChatId) {
          sendTelegramTextMessage({
            botToken,
            chatId: primaryChatId,
            text: textReport + '\n\n📢 <i>نسخه رونوشت به کانال فروشگاه</i>',
          }).catch((e) => console.warn(e));
        }
      }

      if (pdfSent && sendTextRes.success) {
        const successMsg = `فایل PDF و گزارش متنی ${invoice.isProforma ? 'پیش‌فاکتور' : 'فاکتور'} شماره ${invoice.invoiceNumber} با موفقیت به تلگرام ارسال گردید.`;
        callbacks?.onSuccess?.(successMsg);
        StorageService.logActivity({
          category: 'system',
          actionType: 'telegram_auto_sent',
          actionTitle: `ارسال فایل PDF و متن ${invoice.isProforma ? 'پیش‌فاکتور' : 'فاکتور'} به تلگرام`,
          details: `فایل PDF «${filename}» و گزارش متنی فاکتور شماره ${invoice.invoiceNumber} به تلگرام (${targetChatId}) ارسال شد.`,
        });
        return true;
      } else if (pdfSent && !sendTextRes.success) {
        callbacks?.onSuccess?.(`فایل PDF فاکتور شماره ${invoice.invoiceNumber} ارسال شد (پیام متنی با خطا مواجه شد).`);
        return true;
      } else if (!pdfSent && sendTextRes.success) {
        callbacks?.onSuccess?.(`گزارش متنی فاکتور شماره ${invoice.invoiceNumber} ارسال شد (تولید فایل PDF با خطا مواجه شد).`);
        return true;
      } else {
        callbacks?.onError?.('خطا در ارسال فایل PDF و گزارش متنی به تلگرام.');
        return false;
      }
    }

    return false;
  } catch (err: any) {
    callbacks?.onError?.(err?.message || 'خطای غیرمنتظره در ارسال خودکار فاکتور');
    return false;
  }
}
export const autoSendInvoicePdfToTelegram = autoSendInvoiceReportToTelegram;

/**
 * Automatically send Purchase Invoice Report to Telegram Bot (Text Only or with PDF)
 */
export async function autoSendPurchaseInvoiceReportToTelegram(
  purchaseInvoice: PurchaseInvoice,
  passedSettings?: StoreSettings,
  callbacks?: {
    onStart?: () => void;
    onSuccess?: (msg: string) => void;
    onError?: (err: string) => void;
  }
): Promise<boolean> {
  const settings = StorageService.getSettings() || passedSettings;
  if (!settings?.telegramBotEnabled) {
    return false;
  }

  // بررسی وضعیت فعال بودن ارسال فاکتور خرید در تنظیمات
  const isEnabled = settings.telegramAutoSendPurchaseInvoice || settings.telegramAutoSendInvoice;
  if (!isEnabled) {
    return false;
  }

  const botToken = settings.telegramBotToken?.trim();
  const chatId = (settings.telegramChatId || '').trim();

  if (!botToken || !chatId) {
    return false;
  }

  try {
    callbacks?.onStart?.();

    const textReport = formatPurchaseInvoiceTextReport(purchaseInvoice, settings);
    const res = await sendTelegramTextMessage({
      botToken,
      chatId,
      text: textReport,
    });

    if (res.success) {
      callbacks?.onSuccess?.(`گزارش متنی فاکتور خرید شماره ${purchaseInvoice.invoiceNumber} به تلگرام ارسال گردید.`);
      StorageService.logActivity({
        category: 'purchase',
        actionType: 'telegram_auto_sent',
        actionTitle: 'ارسال گزارش متنی فاکتور خرید به تلگرام',
        details: `گزارش متنی فاکتور خرید شماره ${purchaseInvoice.invoiceNumber} به تلگرام (${chatId}) ارسال گردید.`,
      });
      return true;
    } else {
      callbacks?.onError?.(res.error || 'خطا در ارسال گزارش فاکتور خرید به تلگرام');
      return false;
    }
  } catch (err: any) {
    callbacks?.onError?.(err?.message || 'خطای غیرمنتظره در ارسال خودکار فاکتور خرید');
    return false;
  }
}

/**
 * ارسال خودکار یا دستی رسید دریافت وجه از مشتری به تلگرام
 */
export async function autoSendCustomerPaymentReportToTelegram(
  txn: CustomerTransaction,
  customer?: Customer | null,
  passedSettings?: StoreSettings,
  balanceAfter?: number,
  callbacks?: {
    onStart?: () => void;
    onSuccess?: (msg: string) => void;
    onError?: (err: string) => void;
  }
): Promise<boolean> {
  const settings = StorageService.getSettings() || passedSettings;
  if (!settings?.telegramBotEnabled) {
    return false;
  }

  // بررسی فعال بودن در تنظیمات (پیش‌فرض فعال در صورت عدم غیرفعال‌سازی صریح)
  if (settings.telegramAutoSendCustomerPayment === false) {
    return false;
  }

  const botToken = settings.telegramBotToken?.trim();
  const primaryChatId = (settings.telegramChatId || '').trim();
  const customerChatId = (customer?.telegramChatId || '').trim();
  const targetChatId = (customerChatId && settings.telegramAutoSendCustomerDirect !== false)
    ? customerChatId
    : primaryChatId;

  if (!botToken || !targetChatId) {
    const missing = !botToken ? 'توکن ربات' : 'شناسه چت تلگرام';
    callbacks?.onError?.(`ارسال به تلگرام انجام نشد: ${missing} در تنظیمات وارد نشده است.`);
    return false;
  }

  try {
    callbacks?.onStart?.();

    const reportText = formatCustomerPaymentTelegramReport(txn, customer, settings, balanceAfter);

    const res = await sendTelegramTextMessage({
      botToken,
      chatId: targetChatId,
      text: reportText,
    });

    if (res.success) {
      // در صورت ارسال به چت مستقیم مشتری، نسخه رونوشت به کانال فروشگاه
      if (targetChatId !== primaryChatId && primaryChatId) {
        sendTelegramTextMessage({
          botToken,
          chatId: primaryChatId,
          text: reportText + '\n\n📢 <i>نسخه رونوشت به کانال فروشگاه</i>',
        }).catch((e) => console.warn(e));
      }

      const successMsg = `رسید دریافت وجه از «${txn.customerName}» با موفقیت به تلگرام ارسال شد.`;
      callbacks?.onSuccess?.(successMsg);
      StorageService.logActivity({
        category: 'customer',
        actionType: 'telegram_auto_sent',
        actionTitle: 'ارسال رسید دریافت وجه مشتری به تلگرام',
        details: `رسید دریافت وجه به مبلغ ${txn.amount.toLocaleString('fa-IR')} تومان از «${txn.customerName}» به تلگرام ارسال شد.`,
      });
      return true;
    } else {
      callbacks?.onError?.(res.error || 'خطا در ارسال رسید دریافت وجه به تلگرام');
      return false;
    }
  } catch (err: any) {
    callbacks?.onError?.(err?.message || 'خطا در ارسال به تلگرام');
    return false;
  }
}

/**
 * ارسال خودکار یا دستی رسید پرداخت وجه به تامین‌کننده به تلگرام
 */
export async function autoSendSupplierPaymentReportToTelegram(
  params: {
    supplierName: string;
    supplierPhone?: string;
    amount: number;
    paymentMethod?: string;
    trackingNumber?: string;
    bankName?: string;
    chequeDueDate?: string;
    invoiceNumber?: string;
    date?: string;
    title?: string;
    notes?: string;
    recordedBy?: string;
    balanceAfter?: number;
  },
  passedSettings?: StoreSettings,
  callbacks?: {
    onStart?: () => void;
    onSuccess?: (msg: string) => void;
    onError?: (err: string) => void;
  }
): Promise<boolean> {
  const settings = StorageService.getSettings() || passedSettings;
  if (!settings?.telegramBotEnabled) {
    return false;
  }

  // بررسی فعال بودن در تنظیمات
  if (settings.telegramAutoSendSupplierPayment === false) {
    return false;
  }

  const botToken = settings.telegramBotToken?.trim();
  const chatId = (settings.telegramChatId || '').trim();

  if (!botToken || !chatId) {
    const missing = !botToken ? 'توکن ربات' : 'شناسه چت تلگرام';
    callbacks?.onError?.(`ارسال به تلگرام انجام نشد: ${missing} در تنظیمات وارد نشده است.`);
    return false;
  }

  try {
    callbacks?.onStart?.();

    const reportText = formatSupplierPaymentTelegramReport({ ...params, settings });

    const res = await sendTelegramTextMessage({
      botToken,
      chatId,
      text: reportText,
    });

    if (res.success) {
      const successMsg = `رسید پرداخت وجه به «${params.supplierName}» با موفقیت به تلگرام ارسال شد.`;
      callbacks?.onSuccess?.(successMsg);
      StorageService.logActivity({
        category: 'purchase',
        actionType: 'telegram_auto_sent',
        actionTitle: 'ارسال رسید پرداخت به تامین‌کننده به تلگرام',
        details: `رسید پرداخت وجه به مبلغ ${params.amount.toLocaleString('fa-IR')} تومان به «${params.supplierName}» به تلگرام ارسال شد.`,
      });
      return true;
    } else {
      callbacks?.onError?.(res.error || 'خطا در ارسال رسید پرداخت به تلگرام');
      return false;
    }
  } catch (err: any) {
    callbacks?.onError?.(err?.message || 'خطا در ارسال به تلگرام');
    return false;
  }
}

/**
 * Automatically send Exit Slip Report to Telegram Bot (Text, PDF, or Both)
 */
export async function autoSendExitSlipReportToTelegram(
  invoice: Invoice,
  slipLog: ExitSlipData | null,
  isConfirmation: boolean,
  passedSettings?: StoreSettings,
  currentUser?: AppUser,
  callbacks?: {
    onStart?: () => void;
    onSuccess?: (msg: string) => void;
    onError?: (err: string) => void;
  }
): Promise<boolean> {
  const settings = StorageService.getSettings() || passedSettings;
  if (!settings?.telegramBotEnabled) {
    return false;
  }

  // بررسی وضعیت فعال بودن ارسال صدور یا تایید حواله خروج
  const isEnabled = isConfirmation
    ? (!!settings.telegramAutoSendExitSlipConfirm || (settings.telegramAutoSendExitSlip !== false && !!settings.telegramAutoSendExitSlip))
    : (!!settings.telegramAutoSendExitSlipIssue || (!!settings.telegramAutoSendExitSlip && !settings.telegramAutoSendOnlyConfirmed));

  if (!isEnabled) {
    return false;
  }

  const botToken = settings.telegramBotToken?.trim();
  const chatId = (settings.telegramChatId || '').trim();

  if (!botToken || !chatId) {
    return false;
  }

  const sendMode = settings.telegramSendMode || 'text_only';

  try {
    callbacks?.onStart?.();

    if (sendMode === 'text_only' || !isConfirmation || !slipLog) {
      const textReport = (isConfirmation && slipLog)
        ? formatExitSlipConfirmTextReport(invoice, slipLog, settings)
        : formatExitSlipIssueTextReport(invoice, slipLog?.slipNumber, settings);

      const res = await sendTelegramTextMessage({
        botToken,
        chatId,
        text: textReport,
      });

      if (res.success) {
        const title = isConfirmation ? 'تایید خروج و تحویل بار' : 'صدور حواله خروج';
        callbacks?.onSuccess?.(`گزارش متنی ${title} فاکتور شماره ${invoice.invoiceNumber} به تلگرام ارسال شد.`);
        StorageService.logActivity({
          category: 'system',
          actionType: 'telegram_auto_sent',
          actionTitle: `ارسال گزارش متنی ${title} به تلگرام`,
          details: `گزارش متنی ${title} فاکتور ${invoice.invoiceNumber} به تلگرام (${chatId}) ارسال گردید.`,
        });
        return true;
      }
      return false;
    }

    // حالت PDF برای تایید خروج
    const pdfResult = await generateExitSlipPdfBlob(invoice, slipLog, settings, currentUser);
    if (!pdfResult.success || !pdfResult.blob) {
      const textReport = formatExitSlipConfirmTextReport(invoice, slipLog, settings);
      await sendTelegramTextMessage({ botToken, chatId, text: textReport });
      return true;
    }

    const filename = `برگه_خروج_انبار_فاکتور_${invoice.invoiceNumber}.pdf`;
    const caption = formatExitSlipTelegramCaption(invoice, slipLog, settings);

    const sendResult = await sendPdfToTelegram({
      botToken,
      chatId,
      pdfBlob: pdfResult.blob,
      filename,
      caption,
    });

    if (sendResult.success) {
      if (sendMode === 'both') {
        const textReport = formatExitSlipConfirmTextReport(invoice, slipLog, settings);
        await sendTelegramTextMessage({ botToken, chatId, text: textReport });
      }
      callbacks?.onSuccess?.(`حواله خروج فاکتور شماره ${invoice.invoiceNumber} با موفقیت به تلگرام ارسال شد.`);
      return true;
    }
    return false;
  } catch (err: any) {
    callbacks?.onError?.(err?.message || 'خطا در ارسال حواله خروج');
    return false;
  }
}
export const autoSendExitSlipPdfToTelegram = (
  invoice: Invoice,
  slipLog: ExitSlipData,
  passedSettings?: StoreSettings,
  currentUser?: AppUser,
  callbacks?: any
) => autoSendExitSlipReportToTelegram(invoice, slipLog, true, passedSettings, currentUser, callbacks);

/**
 * Automatically send Inbound Receipt Report to Telegram (Text, PDF, or Both)
 */
export async function autoSendInboundReceiptReportToTelegram(
  receipt: InboundReceipt,
  isConfirmation: boolean,
  passedSettings?: StoreSettings,
  callbacks?: {
    onStart?: () => void;
    onSuccess?: (msg: string) => void;
    onError?: (err: string) => void;
  }
): Promise<boolean> {
  const settings = StorageService.getSettings() || passedSettings;
  if (!settings?.telegramBotEnabled) {
    return false;
  }

  const isEnabled = isConfirmation
    ? (!!settings.telegramAutoSendInboundReceiptConfirm || (settings.telegramAutoSendInboundReceipt !== false && !!settings.telegramAutoSendInboundReceipt))
    : (!!settings.telegramAutoSendInboundReceiptIssue || (!!settings.telegramAutoSendInboundReceipt && !settings.telegramAutoSendOnlyConfirmed));

  if (!isEnabled) {
    return false;
  }

  const botToken = settings.telegramBotToken?.trim();
  const chatId = (settings.telegramChatId || '').trim();

  if (!botToken || !chatId) {
    return false;
  }

  const sendMode = settings.telegramSendMode || 'text_only';

  try {
    callbacks?.onStart?.();

    if (sendMode === 'text_only' || !isConfirmation) {
      const textReport = isConfirmation
        ? formatInboundReceiptConfirmTextReport(receipt, settings)
        : formatInboundReceiptIssueTextReport(receipt, settings);

      const res = await sendTelegramTextMessage({
        botToken,
        chatId,
        text: textReport,
      });

      if (res.success) {
        const title = isConfirmation ? 'تایید ورود کالا به انبار' : 'صدور حواله ورود کالا';
        callbacks?.onSuccess?.(`گزارش متنی ${title} شماره ${receipt.receiptNumber} به تلگرام ارسال شد.`);
        StorageService.logActivity({
          category: 'system',
          actionType: 'telegram_auto_sent',
          actionTitle: `ارسال گزارش متنی ${title} به تلگرام`,
          details: `گزارش متنی ${title} شماره ${receipt.receiptNumber} به تلگرام (${chatId}) ارسال شد.`,
        });
        return true;
      }
      return false;
    }

    // حالت PDF برای تایید ورود
    const printableEl = document.getElementById('printable-inbound-receipt');
    let pdfBlob: Blob | undefined;

    if (printableEl) {
      const pdfRes = await generatePdfBlob('printable-inbound-receipt', `رسید_ورود_انبار_${receipt.receiptNumber}.pdf`, {
        pageSize: 'a4',
        orientation: 'portrait',
        quality: 'standard',
      });
      if (pdfRes.success && pdfRes.blob) {
        pdfBlob = pdfRes.blob;
      }
    }

    if (pdfBlob) {
      const sendResult = await sendPdfToTelegram({
        botToken,
        chatId,
        pdfBlob,
        filename: `رسید_ورود_انبار_${receipt.receiptNumber}.pdf`,
        caption: formatInboundReceiptTelegramCaption(receipt, settings),
      });

      if (sendResult.success) {
        if (sendMode === 'both') {
          const textReport = formatInboundReceiptConfirmTextReport(receipt, settings);
          await sendTelegramTextMessage({ botToken, chatId, text: textReport });
        }
        callbacks?.onSuccess?.(`رسید ورود کالا شماره ${receipt.receiptNumber} به تلگرام ارسال شد.`);
        return true;
      }
    }

    // در صورت نبود المان چاپی، گزارش متنی تایید ارسال می‌شود
    const textReport = formatInboundReceiptConfirmTextReport(receipt, settings);
    const textRes = await sendTelegramTextMessage({ botToken, chatId, text: textReport });
    if (textRes.success) {
      callbacks?.onSuccess?.(`گزارش متنی تایید ورود کالا شماره ${receipt.receiptNumber} به تلگرام ارسال شد.`);
      return true;
    }
    return false;
  } catch (err: any) {
    callbacks?.onError?.(err?.message || 'خطا در ارسال رسید ورود به تلگرام');
    return false;
  }
}
export const autoSendInboundReceiptToTelegram = (
  receipt: InboundReceipt,
  passedSettings?: StoreSettings,
  callbacks?: any
) => autoSendInboundReceiptReportToTelegram(receipt, true, passedSettings, callbacks);

/**
 * Test AI Provider Connection & API Key
 */
export async function testAiConnection(params: {
  provider: 'gemini' | 'openai' | 'custom';
  apiKey?: string;
  model?: string;
  baseUrl?: string;
}): Promise<{
  success: boolean;
  message?: string;
  error?: string;
  provider?: string;
  model?: string;
}> {
  try {
    const res = await fetch('/api/ai/test-connection', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    const data = await res.json();
    return data;
  } catch (err: any) {
    return {
      success: false,
      error: 'خطا در ارتباط با سرور برنامه: ' + (err?.message || ''),
    };
  }
}

/**
 * Register Telegram Webhook for receiving voice messages
 */
export async function setTelegramWebhook(botToken: string, webhookUrl: string): Promise<{
  ok: boolean;
  description?: string;
  result?: boolean;
}> {
  try {
    const res = await fetch('/api/telegram/set-webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ botToken, webhookUrl }),
    });
    return await res.json();
  } catch (err: any) {
    return { ok: false, description: err?.message || 'خطا در اتصال به سرور' };
  }
}

/**
 * Get current Telegram Webhook Info
 */
export async function getTelegramWebhookInfo(botToken: string): Promise<{
  ok: boolean;
  result?: {
    url: string;
    has_custom_certificate: boolean;
    pending_update_count: number;
    last_error_date?: number;
    last_error_message?: string;
  };
  description?: string;
}> {
  try {
    const res = await fetch(`/api/telegram/webhook-info?botToken=${encodeURIComponent(botToken)}`);
    return await res.json();
  } catch (err: any) {
    return { ok: false, description: err?.message || 'خطا در دریافت وضعیت وبهوک' };
  }
}

/**
 * Test voice audio processing directly with AI
 */
export async function processVoiceDirectly(audioBase64: string, mimeType = 'audio/ogg'): Promise<{
  success: boolean;
  transcript?: string;
  supplierName?: string;
  items?: Array<{
    productName: string;
    quantity: number;
    unit?: string;
    notes?: string;
    matchedProductId?: string;
  }>;
  error?: string;
}> {
  try {
    const res = await fetch('/api/ai/process-voice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ audioBase64, mimeType }),
    });
    return await res.json();
  } catch (err: any) {
    return { success: false, error: err?.message || 'خطا در پردازش صدا' };
  }
}

