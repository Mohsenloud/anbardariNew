import { Invoice, ExitSlipData, StoreSettings } from '../types';
import { toPersianDigits, formatPrice } from './jalali';

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
    `🧾 <b>فاکتور فروش شماره ${invoice.invoiceNumber}</b>`,
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
