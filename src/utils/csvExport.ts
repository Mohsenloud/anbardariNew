import { Invoice, StoreSettings } from '../types';
import { getCurrentJalaliDate } from './jalali';

function escapeCsvField(val: unknown): string {
  if (val === null || val === undefined) return '""';
  const str = String(val).replace(/"/g, '""');
  return `"${str}"`;
}

export function exportInvoicesToCsv(invoices: Invoice[], settings: StoreSettings, filenamePrefix = 'گزارش_فاکتورها') {
  if (!invoices || invoices.length === 0) {
    alert('هیچ فاکتوری برای خروجی یافت نشد.');
    return false;
  }

  // Define headers compatible with Iranian accounting software (Holoo, Sepidar, Parsian, Rahkaran, Excel)
  const headers = [
    'ردیف',
    'شماره فاکتور',
    'نوع سند (فاکتور / پیش‌فاکتور)',
    'تاریخ صدور (شمسی)',
    'نام خریدار / طرف‌حساب',
    'تلفن خریدار',
    'کد ملی / شناسه اقتصادی',
    'نشانی خریدار',
    'تعداد اقلام',
    'شرح کالاها و خدمات (اقلام فاکتور)',
    `جمع کل اقلام (${settings.currency})`,
    `مبلغ تخفیف (${settings.currency})`,
    `مالیات و عوارض ارزش افزوده (${settings.currency})`,
    `مبلغ قابل پرداخت فاکتور (${settings.currency})`,
    'وضعیت تسویه و پرداخت',
    `مبلغ وصول / پرداخت شده (${settings.currency})`,
    `مانده حساب / بدهی فاکتور (${settings.currency})`,
    'روش پرداخت',
    'مشخصات چک / واریزی',
    'شماره چک / پیگیری',
    'توضیحات و شرایط فاکتور',
  ];

  const rows: string[][] = invoices.map((inv, index) => {
    // Summarize items into a readable string: "کالا ۱ (۲ عدد - فی ۵۰۰۰)، کالا ۲ (۱ عدد)"
    const itemsSummary = (inv.items || [])
      .map((it) => `${it.productName || 'کالا'} (${it.quantity} ${it.unit || 'عدد'} - فی ${Math.round(it.unitPrice).toLocaleString('en-US')})`)
      .join(' | ');

    const paymentStatusText =
      inv.paymentStatus === 'paid'
        ? 'تسویه کامل'
        : inv.paymentStatus === 'partial'
        ? 'تسویه جزئی (اقساطی / بیعانه)'
        : 'تسویه نشده (نسیه / بدهکار)';

    const paymentMethodText =
      inv.paymentMethod === 'cash'
        ? 'نقدی'
        : inv.paymentMethod === 'pos'
        ? 'دستگاه پوز (کارتخوان)'
        : inv.paymentMethod === 'transfer'
        ? 'واریز بانکی / کارت به کارت'
        : inv.paymentMethod === 'cheque'
        ? 'چک'
        : inv.paymentMethod === 'credit'
        ? 'نسیه / حساب دفتری'
        : 'سایر';

    const paidAmount = inv.paymentStatus === 'paid' ? inv.finalTotal : (inv.paidAmount || 0);
    const balanceDue = Math.max(0, inv.finalTotal - paidAmount);

    const documentTypeText = inv.isProforma
      ? 'پیش‌فاکتور (غیرقطعی)'
      : inv.convertedFromProforma
      ? `فاکتور فروش (تبدیل شده از پیش‌فاکتور ${inv.convertedFromProforma})`
      : 'فاکتور فروش قطعی';

    return [
      String(index + 1),
      inv.invoiceNumber || '',
      documentTypeText,
      inv.date || '',
      inv.customerName || 'مشتری گذری',
      inv.customerPhone || '',
      inv.customerNationalId || '',
      inv.customerAddress || '',
      String(inv.items?.length || 0),
      itemsSummary,
      String(Math.round(inv.subtotal || 0)),
      String(Math.round(inv.totalDiscount || 0)),
      String(Math.round(inv.taxAmount || 0)),
      String(Math.round(inv.finalTotal || 0)),
      paymentStatusText,
      String(Math.round(paidAmount)),
      String(Math.round(balanceDue)),
      paymentMethodText,
      inv.transferDescription || inv.chequeName || '',
      inv.chequeNumber || '',
      inv.notes || '',
    ];
  });

  // Construct CSV content with UTF-8 BOM (\uFEFF)
  const csvContent =
    '\uFEFF' +
    [headers.map(escapeCsvField).join(','), ...rows.map((r) => r.map(escapeCsvField).join(','))].join('\r\n');

  // Trigger browser download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const safeDate = getCurrentJalaliDate().replace(/\//g, '-');
  a.download = `${filenamePrefix}_${safeDate}.csv`;
  a.href = url;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  return true;
}
