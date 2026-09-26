import React from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { Invoice, ExitSlipData, StoreSettings, AppUser, InboundReceipt } from '../types';
import { toPersianDigits, formatPrice, getCurrentJalaliTime } from './jalali';
import { generatePdfBlob } from './pdfHelper';
import { StorageService } from './storage';
import { SimpleInvoiceLayout } from '../components/SimpleInvoiceLayout';
import { SimpleExitSlipLayout } from '../components/SimpleExitSlipLayout';

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

/**
 * Generate Invoice PDF Blob whether the invoice modal is currently open or not.
 */
export async function generateInvoicePdfBlob(
  invoice: Invoice,
  passedSettings?: StoreSettings
): Promise<{ success: boolean; blob?: Blob; file?: File; error?: string }> {
  const settings = StorageService.getSettings() || passedSettings;
  const filename = invoice.isProforma
    ? `پیش_فاکتور_${invoice.invoiceNumber}.pdf`
    : `فاکتور_فروش_${invoice.invoiceNumber}.pdf`;
  const quality = (settings?.pdfInvoiceQuality as any) || 'standard';

  // If printable-invoice element is already in the DOM, active and matches this invoice:
  const existingElement = document.getElementById('printable-invoice');
  const isInvoiceActiveInDom =
    existingElement &&
    existingElement.getAttribute('data-invoice-id') === invoice.id &&
    existingElement.innerHTML.length > 100;

  if (isInvoiceActiveInDom) {
    return await generatePdfBlob('printable-invoice', filename, {
      pageSize: 'a4',
      orientation: 'portrait',
      documentType: 'invoice',
      quality,
    });
  }

  // Otherwise, create an offscreen container in the DOM:
  // Positioned at (0, 0), behind the app, fully accessible for html2canvas
  const container = document.createElement('div');
  const containerId = `telegram-offscreen-invoice-${Date.now()}`;
  container.id = containerId;
  container.style.position = 'fixed';
  container.style.left = '0px';
  container.style.top = '0px';
  container.style.width = '820px';
  container.style.minHeight = '1175px';
  container.style.backgroundColor = '#ffffff';
  container.style.zIndex = '-99999';
  container.style.pointerEvents = 'none';
  container.style.opacity = '1'; // Hidden behind app layers, but fully visible for canvas
  container.dir = 'rtl';
  document.body.appendChild(container);

  const root = createRoot(container);
  try {
    flushSync(() => {
      root.render(
        React.createElement(
          'div',
          {
            id: 'printable-invoice-offscreen',
            'data-invoice-id': invoice.id,
            style: { width: '820px', minHeight: '1175px', backgroundColor: '#ffffff', padding: '24px' },
          },
          React.createElement(SimpleInvoiceLayout, {
            invoice,
            settings: settings as StoreSettings,
            pageSize: 'a4',
            orientation: 'portrait',
          })
        )
      );
    });

    // Wait for layout and web fonts to settle
    await new Promise((resolve) => setTimeout(resolve, 320));
    if (document.fonts) {
      try {
        await document.fonts.ready;
      } catch {}
    }

    const result = await generatePdfBlob(containerId, filename, {
      pageSize: 'a4',
      orientation: 'portrait',
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
    }, 200);
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

  // If printable-exit-slip element is already in the DOM and active for this invoice:
  const existingElement = document.getElementById('printable-exit-slip');
  const isExitSlipActiveInDom =
    existingElement &&
    existingElement.getAttribute('data-invoice-id') === invoice.id &&
    existingElement.innerHTML.length > 100;

  if (isExitSlipActiveInDom) {
    return await generatePdfBlob('printable-exit-slip', filename, {
      pageSize: 'a4',
      orientation: 'portrait',
      documentType: 'exit_slip',
      quality,
    });
  }

  // Otherwise, create an offscreen container in the DOM:
  const container = document.createElement('div');
  const containerId = `telegram-offscreen-exit-slip-${Date.now()}`;
  container.id = containerId;
  container.style.position = 'fixed';
  container.style.left = '0px';
  container.style.top = '0px';
  container.style.width = '820px';
  container.style.minHeight = '1175px';
  container.style.backgroundColor = '#ffffff';
  container.style.zIndex = '-99999';
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
    flushSync(() => {
      root.render(
        React.createElement(
          'div',
          {
            id: 'printable-exit-slip-offscreen',
            'data-invoice-id': invoice.id,
            style: { width: '820px', minHeight: '1175px', backgroundColor: '#ffffff', padding: '24px' },
          },
          React.createElement(SimpleExitSlipLayout, {
            invoice,
            settings: settings as StoreSettings,
            slipLog,
            currentUser,
            slipNumber,
            issuedTime,
            originWarehouseName,
            totalUnits,
            pageSize: 'a4',
            orientation: 'portrait',
          })
        )
      );
    });

    await new Promise((resolve) => setTimeout(resolve, 320));
    if (document.fonts) {
      try {
        await document.fonts.ready;
      } catch {}
    }

    const result = await generatePdfBlob(containerId, filename, {
      pageSize: 'a4',
      orientation: 'portrait',
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
    }, 200);
  }
}

/**
 * Automatically generate Invoice PDF and send directly to Telegram Bot.
 */
export async function autoSendInvoicePdfToTelegram(
  invoice: Invoice,
  passedSettings?: StoreSettings,
  callbacks?: {
    onStart?: () => void;
    onSuccess?: (msg: string) => void;
    onError?: (err: string) => void;
  }
): Promise<boolean> {
  const settings = StorageService.getSettings() || passedSettings;
  if (!settings?.telegramBotEnabled || !settings?.telegramAutoSendInvoice) {
    console.log('[Telegram Auto-Send] Invoice auto-send disabled in settings.');
    return false;
  }

  // اگر فاکتور پیش‌فاکتور است و گزینه «فقط پس از تایید نهایی ارسال شود» فعال است، تا زمان تایید منتظر می‌ماند
  if (invoice.isProforma && settings.telegramAutoSendOnlyConfirmed !== false) {
    console.log('[Telegram Auto-Send] Invoice is unconfirmed proforma. Auto-dispatch will execute after confirmation.');
    return false;
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

  try {
    callbacks?.onStart?.();

    const pdfResult = await generateInvoicePdfBlob(invoice, settings);
    if (!pdfResult.success || !pdfResult.blob) {
      const err = pdfResult.error || 'خطا در ایجاد خودکار فایل PDF فاکتور';
      callbacks?.onError?.(err);
      StorageService.logActivity({
        category: 'system',
        actionType: 'telegram_auto_failed',
        actionTitle: 'خطا در ارسال خودکار فاکتور به تلگرام',
        details: `تولید خودکار PDF فاکتور شماره ${invoice.invoiceNumber} با شکست مواجه شد: ${err}`,
      });
      return false;
    }

    const filename = invoice.isProforma
      ? `پیش_فاکتور_${invoice.invoiceNumber}.pdf`
      : `فاکتور_فروش_${invoice.invoiceNumber}.pdf`;
    const caption = formatInvoiceTelegramCaption(invoice, settings);

    const sendResult = await sendPdfToTelegram({
      botToken,
      chatId: targetChatId,
      pdfBlob: pdfResult.blob,
      filename,
      caption,
    });

    // در صورتی که به چت اختصاصی مشتری ارسال شد و کانال اصلی فروشگاه نیز ثبت شده باشد، یک نسخه به کانال اصلی نیز فرستاده می‌شود
    if (sendResult.success && targetChatId !== primaryChatId && primaryChatId) {
      sendPdfToTelegram({
        botToken,
        chatId: primaryChatId,
        pdfBlob: pdfResult.blob,
        filename,
        caption: caption + '\n\n📢 <i>نسخه رونوشت به کانال فروشگاه</i>',
      }).catch((e) => console.warn('Copy to main store channel failed:', e));
    }

    if (sendResult.success) {
      const successMsg = `فایل PDF ${invoice.isProforma ? 'پیش‌فاکتور' : 'فاکتور'} شماره ${invoice.invoiceNumber} با موفقیت به تلگرام ارسال شد.`;
      callbacks?.onSuccess?.(successMsg);
      StorageService.logActivity({
        category: 'system',
        actionType: 'telegram_auto_sent',
        actionTitle: 'ارسال خودکار فاکتور به تلگرام',
        details: `فایل PDF فاکتور شماره ${invoice.invoiceNumber} برای مشتری «${invoice.customerName}» به چت تلگرام (${targetChatId}) ارسال گردید.`,
      });
      return true;
    } else {
      const err = sendResult.error || 'خطا در ارسال فایل به تلگرام';
      callbacks?.onError?.(err);
      StorageService.logActivity({
        category: 'system',
        actionType: 'telegram_auto_failed',
        actionTitle: 'خطا در ارسال خودکار فاکتور به تلگرام',
        details: `ارسال فایل PDF فاکتور شماره ${invoice.invoiceNumber} به تلگرام با خطا مواجه شد: ${err}`,
      });
      return false;
    }
  } catch (err: any) {
    const errorMsg = err?.message || 'خطای غیرمنتظره در ارسال خودکار';
    callbacks?.onError?.(errorMsg);
    console.error('[Telegram Auto-Send Invoice] Exception:', err);
    return false;
  }
}

/**
 * Automatically generate Exit Slip PDF and send directly to Telegram Bot.
 */
export async function autoSendExitSlipPdfToTelegram(
  invoice: Invoice,
  slipLog: ExitSlipData,
  passedSettings?: StoreSettings,
  currentUser?: AppUser,
  callbacks?: {
    onStart?: () => void;
    onSuccess?: (msg: string) => void;
    onError?: (err: string) => void;
  }
): Promise<boolean> {
  const settings = StorageService.getSettings() || passedSettings;
  if (!settings?.telegramBotEnabled || !settings?.telegramAutoSendExitSlip) {
    console.log('[Telegram Auto-Send] Exit slip auto-send disabled in settings.');
    return false;
  }

  const botToken = settings.telegramBotToken?.trim();
  const chatId = (settings.telegramChatId || '').trim();

  if (!botToken || !chatId) {
    const missing = !botToken ? 'توکن ربات' : 'شناسه چت مقصد';
    console.warn(`[Telegram Auto-Send] ${missing} تنظیم نشده است.`);
    callbacks?.onError?.(`ارسال به تلگرام ناموفق بود: ${missing} در تنظیمات وارد نشده است.`);
    return false;
  }

  try {
    callbacks?.onStart?.();

    const pdfResult = await generateExitSlipPdfBlob(invoice, slipLog, settings, currentUser);
    if (!pdfResult.success || !pdfResult.blob) {
      const err = pdfResult.error || 'خطا در ایجاد خودکار فایل PDF حواله خروج';
      callbacks?.onError?.(err);
      StorageService.logActivity({
        category: 'system',
        actionType: 'telegram_auto_failed',
        actionTitle: 'خطا در ارسال خودکار حواله خروج به تلگرام',
        details: `تولید فایل PDF حواله خروج فاکتور ${invoice.invoiceNumber} با شکست مواجه شد: ${err}`,
      });
      return false;
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
      const successMsg = `فایل PDF حواله خروج فاکتور شماره ${invoice.invoiceNumber} با موفقیت به تلگرام ارسال شد.`;
      callbacks?.onSuccess?.(successMsg);
      StorageService.logActivity({
        category: 'system',
        actionType: 'telegram_auto_sent',
        actionTitle: 'ارسال خودکار حواله خروج به تلگرام',
        details: `فایل PDF حواله خروج فاکتور شماره ${invoice.invoiceNumber} (تحویل به «${slipLog.receiverName || invoice.customerName}») به تلگرام (${chatId}) ارسال گردید.`,
      });
      return true;
    } else {
      const err = sendResult.error || 'خطا در ارسال به تلگرام';
      callbacks?.onError?.(err);
      StorageService.logActivity({
        category: 'system',
        actionType: 'telegram_auto_failed',
        actionTitle: 'خطا در ارسال خودکار حواله خروج به تلگرام',
        details: `ارسال PDF حواله خروج فاکتور ${invoice.invoiceNumber} به تلگرام با خطا مواجه شد: ${err}`,
      });
      return false;
    }
  } catch (err: any) {
    const errorMsg = err?.message || 'خطای غیرمنتظره در ارسال خودکار';
    callbacks?.onError?.(errorMsg);
    console.error('[Telegram Auto-Send Exit Slip] Exception:', err);
    return false;
  }
}

/**
 * Format Inbound Receipt caption for Telegram message
 */
export function formatInboundReceiptTelegramCaption(
  receipt: InboundReceipt,
  settings?: StoreSettings
): string {
  const warehouse = settings?.originWarehouseName || 'انبار مرکزی';
  const hasDiscrepancy = receipt.status === 'has_discrepancy' || receipt.totalDiscrepancy !== 0;
  
  const lines: string[] = [
    `📥 <b>رسید ورود کالا به انبار (شماره ${receipt.receiptNumber})</b>`,
    `🏢 <b>انبار مقصد:</b> ${warehouse}`,
    `🏭 <b>تأمین‌کننده / فروشنده:</b> ${receipt.supplierName}`,
    `🧾 <b>فاکتور خرید مرتبط:</b> شماره ${receipt.purchaseInvoiceNumber}`,
    `📦 <b>تعداد اقلام شمارش‌شده:</b> ${toPersianDigits(receipt.totalReceivedQuantity)} قلم کالا`,
  ];

  if (hasDiscrepancy) {
    lines.push(`⚠️ <b>وضعیت شمارش:</b> تایید شده با مغایرت (${toPersianDigits(Math.abs(receipt.totalDiscrepancy))} قلم ${receipt.totalDiscrepancy < 0 ? 'کسری' : 'مازاد'})`);
  } else {
    lines.push(`✅ <b>وضعیت شمارش:</b> تایید کامل (بدون هرگونه مغایرت)`);
  }

  if (receipt.verifiedBy) {
    lines.push(`👨‍💼 <b>انباردار تاییدکننده:</b> ${receipt.verifiedBy}`);
  }

  if (receipt.verifiedDate) {
    lines.push(`📅 <b>تاریخ و زمان تایید انبار:</b> ${toPersianDigits(receipt.verifiedDate)}`);
  }

  if (receipt.warehouseNotes) {
    lines.push(`📝 <b>یادداشت انباردار:</b> ${receipt.warehouseNotes}`);
  }

  return lines.join('\n');
}

/**
 * Automatically send Inbound Receipt notification to Telegram upon verification/approval.
 */
export async function autoSendInboundReceiptToTelegram(
  receipt: InboundReceipt,
  passedSettings?: StoreSettings,
  callbacks?: {
    onStart?: () => void;
    onSuccess?: (msg: string) => void;
    onError?: (err: string) => void;
  }
): Promise<boolean> {
  const settings = StorageService.getSettings() || passedSettings;
  if (!settings?.telegramBotEnabled || !settings?.telegramAutoSendInboundReceipt) {
    console.log('[Telegram Auto-Send] Inbound receipt auto-send disabled in settings.');
    return false;
  }

  const botToken = settings.telegramBotToken?.trim();
  const chatId = (settings.telegramChatId || '').trim();

  if (!botToken || !chatId) {
    const missing = !botToken ? 'توکن ربات' : 'شناسه چت مقصد';
    console.warn(`[Telegram Auto-Send] ${missing} تنظیم نشده است.`);
    callbacks?.onError?.(`ارسال به تلگرام ناموفق بود: ${missing} در تنظیمات وارد نشده است.`);
    return false;
  }

  try {
    callbacks?.onStart?.();

    // Check if printable-inbound-receipt is in DOM
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

    const caption = formatInboundReceiptTelegramCaption(receipt, settings);

    if (pdfBlob) {
      const sendResult = await sendPdfToTelegram({
        botToken,
        chatId,
        pdfBlob,
        filename: `رسید_ورود_انبار_${receipt.receiptNumber}.pdf`,
        caption,
      });

      if (sendResult.success) {
        const successMsg = `فایل PDF رسید ورود کالا شماره ${receipt.receiptNumber} به تلگرام ارسال شد.`;
        callbacks?.onSuccess?.(successMsg);
        StorageService.logActivity({
          category: 'system',
          actionType: 'telegram_auto_sent',
          actionTitle: 'ارسال خودکار رسید ورود کالا به تلگرام',
          details: `رسید ورود کالا شماره ${receipt.receiptNumber} به تلگرام (${chatId}) ارسال گردید.`,
        });
        return true;
      }
    }

    // Fallback: send text message notification if PDF is not rendered
    const textRes = await testTelegramMessage(botToken, chatId, caption.replace(/<[^>]+>/g, ''));
    if (textRes.success) {
      const successMsg = `اطلاعیه تایید رسید ورود کالا شماره ${receipt.receiptNumber} به تلگرام ارسال شد.`;
      callbacks?.onSuccess?.(successMsg);
      StorageService.logActivity({
        category: 'system',
        actionType: 'telegram_auto_sent',
        actionTitle: 'ارسال اطلاعیه رسید ورود کالا به تلگرام',
        details: `اطلاعیه تایید رسید ورود کالا شماره ${receipt.receiptNumber} به تلگرام (${chatId}) ارسال شد.`,
      });
      return true;
    } else {
      const err = textRes.error || 'خطا در ارسال پیام به تلگرام';
      callbacks?.onError?.(err);
      return false;
    }
  } catch (err: any) {
    const errorMsg = err?.message || 'خطا در ارسال رسید ورود به تلگرام';
    callbacks?.onError?.(errorMsg);
    console.error('[Telegram Auto-Send Inbound Receipt] Exception:', err);
    return false;
  }
}

