import * as XLSX from 'xlsx';
import { Product, ProductVariant, Customer, Invoice, ExitSlipData } from '../types';
import { getCurrentJalaliDate } from './jalali';
import { generateNextProductCode } from './codeGenerator';
import { StorageService } from './storage';

// Helper to normalize strings for header matching
function normalizeKey(str: string): string {
  return (str || '')
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[*\(\)\[\]{}:;.,،؟!~`#$^+=|\\/]+/g, '')
    .replace(/[\s_\-]+/g, '')
    .replace(/[یي]/g, 'ی')
    .replace(/[کك]/g, 'ک')
    .replace(/[آاإأ]/g, 'ا')
    .replace(/ة/g, 'ه');
}

// Convert Persian/Arabic digits to English digits
export function parseNumber(val: any): number {
  if (val === undefined || val === null || val === '') return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  const str = String(val)
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 1776))
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 1632))
    .replace(/[,\s_]/g, '');
  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
}

export function parseString(val: any): string {
  if (val === undefined || val === null) return '';
  return String(val).trim();
}

// Format Iranian phone numbers, preserving leading 0 for mobile numbers if stripped by Excel
export function parsePhoneNumber(val: any): string {
  if (val === undefined || val === null || val === '') return '';
  let str = String(val).trim()
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 1776))
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 1632))
    .replace(/[^\d+]/g, '');
  // If Excel stored 0912... as number 912... (10 digits)
  if (str.length === 10 && str.startsWith('9')) {
    str = '0' + str;
  }
  return str;
}

/**
 * GENERATE SAMPLE EXCEL TEMPLATE FOR PRODUCTS (with variants example)
 */
export function generateProductExcelTemplate(): void {
  const wb = XLSX.utils.book_new();

  // 1. Data Sheet with Realistic Concrete / Hardener Powder Example
  const productData = [
    {
      'نام کالا *': 'پودر سخت کننده خشک پاش',
      'کد کالا': 'DS-100',
      'تنوع / رنگ / مدل': 'طوسی',
      'کد اختصاصی تنوع': 'DS-GR',
      'دسته‌بندی': 'مصالح بتن و کفسازی',
      'واحد سنجش': 'کیسه',
      'قیمت خرید (ریال)': 2800000,
      'قیمت فروش (ریال)': 3500000,
      'موجودی انبار': 80,
      'حداقل هشدار موجودی': 15,
      'توضیحات': 'پودر سخت کننده خشک پاش صنعتی پایه سیمانی طوسی',
    },
    {
      'نام کالا *': 'پودر سخت کننده خشک پاش',
      'کد کالا': 'DS-100',
      'تنوع / رنگ / مدل': 'قرمز',
      'کد اختصاصی تنوع': 'DS-RD',
      'دسته‌بندی': 'مصالح بتن و کفسازی',
      'واحد سنجش': 'کیسه',
      'قیمت خرید (ریال)': 2950000,
      'قیمت فروش (ریال)': 3750000,
      'موجودی انبار': 45,
      'حداقل هشدار موجودی': 10,
      'توضیحات': 'پودر سخت کننده با پیگمنت قرمز مرغوب',
    },
    {
      'نام کالا *': 'پودر سخت کننده خشک پاش',
      'کد کالا': 'DS-100',
      'تنوع / رنگ / مدل': 'سبز',
      'کد اختصاصی تنوع': 'DS-GN',
      'دسته‌بندی': 'مصالح بتن و کفسازی',
      'واحد سنجش': 'کیسه',
      'قیمت خرید (ریال)': 3200000,
      'قیمت فروش (ریال)': 4100000,
      'موجودی انبار': 30,
      'حداقل هشدار موجودی': 10,
      'توضیحات': 'پودر خشک پاش رنگ سبز بتن پایه اکسید کروم',
    },
    {
      'نام کالا *': 'چسب سرامیک پرسلان پودری',
      'کد کالا': 'TL-200',
      'تنوع / رنگ / مدل': '',
      'کد اختصاصی تنوع': '',
      'دسته‌بندی': 'چسب و ملات',
      'واحد سنجش': 'کیسه ۲۵ کیلویی',
      'قیمت خرید (ریال)': 1900000,
      'قیمت فروش (ریال)': 2450000,
      'موجودی انبار': 60,
      'حداقل هشدار موجودی': 20,
      'توضیحات': 'چسب کاشی و پرسلان ضدآب پایه پلیمری',
    },
    {
      'نام کالا *': 'فوق روان کننده کربوکسیلاتی بتن',
      'کد کالا': 'AD-300',
      'تنوع / رنگ / مدل': '',
      'کد اختصاصی تنوع': '',
      'دسته‌بندی': 'افزودنی بتن',
      'واحد سنجش': 'گالن ۲۰ لیتری',
      'قیمت خرید (ریال)': 3400000,
      'قیمت فروش (ریال)': 4300000,
      'موجودی انبار': 25,
      'حداقل هشدار موجودی': 5,
      'توضیحات': 'افزودنی زودگیر و کاهنده آب بتن',
    },
  ];

  const ws = XLSX.utils.json_to_sheet(productData);

  // Set column widths
  ws['!cols'] = [
    { wch: 28 }, // نام کالا
    { wch: 12 }, // کد کالا
    { wch: 18 }, // تنوع / رنگ
    { wch: 16 }, // کد تنوع
    { wch: 20 }, // دسته‌بندی
    { wch: 15 }, // واحد
    { wch: 16 }, // خرید
    { wch: 16 }, // فروش
    { wch: 14 }, // موجودی
    { wch: 18 }, // حداقل هشدار
    { wch: 35 }, // توضیحات
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'لیست_کالاها');

  // Download file
  XLSX.writeFile(wb, 'قالب_اکسل_ورود_کالاها_با_تنوع.xlsx');
}

/**
 * GENERATE SAMPLE EXCEL TEMPLATE FOR CUSTOMERS
 */
export function generateCustomerExcelTemplate(): void {
  const wb = XLSX.utils.book_new();

  const customerData = [
    {
      'نام مشتری یا شرکت *': 'شرکت بتن سازان پارسیان',
      'شماره تماس': '09121112233',
      'کد ملی یا شناسه اقتصادی': '10103456789',
      'آدرس': 'تهران، شهرک صنعتی شمس آباد، بلوار بهارستان',
      'یادداشت': 'خریدار عمده پودر سخت کننده و روان کننده بتن',
    },
    {
      'نام مشتری یا شرکت *': 'مهندس محمدرضا اکبری',
      'شماره تماس': '09123334455',
      'کد ملی یا شناسه اقتصادی': '0078965412',
      'آدرس': 'کرج، میدان آزادگان، پروژه سوله صنعتی ۲',
      'یادداشت': 'تسویه توافقی ۴۵ روزه',
    },
    {
      'نام مشتری یا شرکت *': 'فروشگاه مصالح ساختمانی میلاد',
      'شماره تماس': '02188776655',
      'کد ملی یا شناسه اقتصادی': '14008976543',
      'آدرس': 'اصفهان، خیابان امام خمینی، روبروی پمپ بنزین',
      'یادداشت': 'تخفیف همکاری ۳ درصد',
    },
  ];

  const ws = XLSX.utils.json_to_sheet(customerData);

  ws['!cols'] = [
    { wch: 30 }, // نام مشتری
    { wch: 16 }, // شماره تماس
    { wch: 24 }, // کد ملی
    { wch: 45 }, // آدرس
    { wch: 35 }, // یادداشت
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'مشتریان');
  XLSX.writeFile(wb, 'قالب_اکسل_ورود_مشتریان.xlsx');
}

/**
 * EXPORT CURRENT PRODUCTS TO EXCEL
 */
export function exportProductsToExcel(products: Product[]): void {
  const rows: any[] = [];

  products.forEach((p) => {
    if (p.hasVariants && p.variants && p.variants.length > 0) {
      p.variants.forEach((v) => {
        rows.push({
          'نام کالا': p.name,
          'کد کالا': p.code,
          'تنوع / رنگ / مدل': v.name,
          'کد اختصاصی تنوع': v.code || '',
          'دسته‌بندی': p.category,
          'واحد سنجش': p.unit,
          'قیمت خرید (ریال)': v.buyPrice || p.buyPrice,
          'قیمت فروش (ریال)': v.sellPrice || p.sellPrice,
          'موجودی این تنوع': v.stock,
          'کل موجودی کالا': p.stock,
          'حداقل هشدار': p.minStockAlert,
          'توضیحات': p.description || '',
        });
      });
    } else {
      rows.push({
        'نام کالا': p.name,
        'کد کالا': p.code,
        'تنوع / رنگ / مدل': '',
        'کد اختصاصی تنوع': '',
        'دسته‌بندی': p.category,
        'واحد سنجش': p.unit,
        'قیمت خرید (ریال)': p.buyPrice,
        'قیمت فروش (ریال)': p.sellPrice,
        'موجودی این تنوع': p.stock,
        'کل موجودی کالا': p.stock,
        'حداقل هشدار': p.minStockAlert,
        'توضیحات': p.description || '',
      });
    }
  });

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = [
    { wch: 28 },
    { wch: 12 },
    { wch: 18 },
    { wch: 16 },
    { wch: 18 },
    { wch: 14 },
    { wch: 16 },
    { wch: 16 },
    { wch: 16 },
    { wch: 16 },
    { wch: 14 },
    { wch: 35 },
  ];
  XLSX.utils.book_append_sheet(wb, ws, 'موجودی_کالاها');
  XLSX.writeFile(wb, `لیست_کالاها_${getCurrentJalaliDate().replace(/\//g, '-')}.xlsx`);
}

/**
 * EXPORT CURRENT CUSTOMERS TO EXCEL
 */
export function exportCustomersToExcel(customers: Customer[]): void {
  const rows = customers.map((c) => ({
    'نام مشتری یا شرکت': c.name,
    'شماره تماس': c.phone,
    'کد ملی یا شناسه اقتصادی': c.nationalId || '',
    'آدرس': c.address || '',
    'یادداشت': c.notes || '',
    'تاریخ عضویت': c.createdAt || '',
  }));

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = [
    { wch: 30 },
    { wch: 16 },
    { wch: 24 },
    { wch: 45 },
    { wch: 35 },
    { wch: 15 },
  ];
  XLSX.utils.book_append_sheet(wb, ws, 'مشتریان');
  XLSX.writeFile(wb, `لیست_مشتریان_${getCurrentJalaliDate().replace(/\//g, '-')}.xlsx`);
}

/**
 * EXPORT CUSTOMER INVOICES & OUTBOUND EXIT SLIPS TO EXCEL WITH FULL DETAILS
 * خروجی اکسل چند شیته جامع شامل: خلاصه حساب، ریز اقلام فاکتورها، حواله‌های خروج انبار و سرجمع اسناد
 */
export interface ExportPersonOptions {
  customer: Customer;
  invoices: Invoice[];
  exitSlipLogs?: Record<string, ExitSlipData>;
  currency?: string;
  dateFrom?: string;
  dateTo?: string;
  docType?: 'all' | 'regular' | 'proforma';
  deliveryStatus?: 'all' | 'delivered' | 'pending';
}

export function exportPersonInvoicesAndExitSlipsToExcel(options: ExportPersonOptions): {
  success: boolean;
  exportedInvoicesCount: number;
  exportedItemsCount: number;
  exportedSlipsCount: number;
  fileName: string;
} {
  const { customer, currency = 'تومان' } = options;
  const exitSlipLogs = options.exitSlipLogs || StorageService.getExitSlipLogs();

  // 1. Filter customer invoices
  let customerInvoices = options.invoices.filter((inv) =>
    (inv.customerId && inv.customerId === customer.id) ||
    (inv.customerName && inv.customerName.trim().toLowerCase() === customer.name.trim().toLowerCase())
  );

  // 2. Apply filters
  if (options.dateFrom && options.dateFrom.trim()) {
    const from = options.dateFrom.trim();
    customerInvoices = customerInvoices.filter((i) => i.date >= from);
  }
  if (options.dateTo && options.dateTo.trim()) {
    const to = options.dateTo.trim();
    customerInvoices = customerInvoices.filter((i) => i.date <= to);
  }
  if (options.docType === 'regular') {
    customerInvoices = customerInvoices.filter((i) => !i.isProforma);
  } else if (options.docType === 'proforma') {
    customerInvoices = customerInvoices.filter((i) => !!i.isProforma);
  }

  if (options.deliveryStatus === 'delivered') {
    customerInvoices = customerInvoices.filter((i) => Boolean(exitSlipLogs[i.id]?.isDelivered));
  } else if (options.deliveryStatus === 'pending') {
    customerInvoices = customerInvoices.filter((i) => !Boolean(exitSlipLogs[i.id]?.isDelivered));
  }

  // Sort descending by date, then invoiceNumber
  customerInvoices.sort((a, b) => b.date.localeCompare(a.date));

  // Compute stats
  const regularCount = customerInvoices.filter((i) => !i.isProforma).length;
  const proformaCount = customerInvoices.filter((i) => !!i.isProforma).length;
  const totalSubtotal = customerInvoices.reduce((s, i) => s + (i.subtotal || 0), 0);
  const totalDiscount = customerInvoices.reduce((s, i) => s + (i.totalDiscount || 0), 0);
  const totalTax = customerInvoices.reduce((s, i) => s + (i.taxAmount || 0), 0);
  const totalFinal = customerInvoices.reduce((s, i) => s + (i.finalTotal || 0), 0);
  const totalPaid = customerInvoices.reduce((s, i) => s + (i.paidAmount || 0), 0);
  const balanceDue = Math.max(0, totalFinal - totalPaid);

  let deliveredCount = 0;
  let pendingDeliveryCount = 0;
  let totalPhysicalQty = 0;

  customerInvoices.forEach((inv) => {
    const slip = exitSlipLogs[inv.id];
    if (slip?.isDelivered) {
      deliveredCount++;
    } else {
      pendingDeliveryCount++;
    }
    inv.items.forEach((it) => {
      totalPhysicalQty += (Number(it.quantity) || 0);
    });
  });

  const wb = XLSX.utils.book_new();

  // ----------------------------------------------------
  // Sheet 1: خلاصه پرونده و گردش حساب مشتری
  // ----------------------------------------------------
  const summaryRows = [
    { 'عنوان شاخص': 'نام طرف حساب / خریدار', 'مقدار / توضیحات': customer.name },
    { 'عنوان شاخص': 'شماره تماس', 'مقدار / توضیحات': customer.phone || '—' },
    { 'عنوان شاخص': 'کد ملی یا شناسه اقتصادی', 'مقدار / توضیحات': customer.nationalId || '—' },
    { 'عنوان شاخص': 'نشانی و آدرس', 'مقدار / توضیحات': customer.address || '—' },
    { 'عنوان شاخص': 'یادداشت پرونده مشتری', 'مقدار / توضیحات': customer.notes || '—' },
    { 'عنوان شاخص': 'تاریخ عضویت / پرونده', 'مقدار / توضیحات': customer.createdAt || '—' },
    { 'عنوان شاخص': 'تاریخ استخراج گزارش', 'مقدار / توضیحات': getCurrentJalaliDate() },
    { 'عنوان شاخص': 'واحد پولی سیستم', 'مقدار / توضیحات': currency },
    { 'عنوان شاخص': '------------------------------------', 'مقدار / توضیحات': '------------------------------------' },
    { 'عنوان شاخص': 'تعداد کل فاکتورها و اسناد', 'مقدار / توضیحات': customerInvoices.length },
    { 'عنوان شاخص': 'تعداد فاکتورهای فروش رسمی (قطعی)', 'مقدار / توضیحات': regularCount },
    { 'عنوان شاخص': 'تعداد پیش‌فاکتورها', 'مقدار / توضیحات': proformaCount },
    { 'عنوان شاخص': `جمع کل ناخالص قبل از تخفیف (${currency})`, 'مقدار / توضیحات': totalSubtotal },
    { 'عنوان شاخص': `مجموع کل تخفیفات اعطایی (${currency})`, 'مقدار / توضیحات': totalDiscount },
    { 'عنوان شاخص': `مجموع مالیات بر ارزش افزوده (${currency})`, 'مقدار / توضیحات': totalTax },
    { 'عنوان شاخص': `مبلغ نهایی قابل پرداخت (${currency})`, 'مقدار / توضیحات': totalFinal },
    { 'عنوان شاخص': `مجموع مبالغ واریز و تسویه شده (${currency})`, 'مقدار / توضیحات': totalPaid },
    { 'عنوان شاخص': `مانده بدهی تسویه نشده (${currency})`, 'مقدار / توضیحات': balanceDue },
    { 'عنوان شاخص': 'وضعیت کلی مالی مشتری', 'مقدار / توضیحات': balanceDue <= 0 ? 'تسویه کامل (بی‌حساب)' : `بدهکار به مبلغ ${balanceDue.toLocaleString('fa-IR')} ${currency}` },
    { 'عنوان شاخص': '------------------------------------', 'مقدار / توضیحات': '------------------------------------' },
    { 'عنوان شاخص': 'تعداد کل حواله‌های خروج انبار', 'مقدار / توضیحات': customerInvoices.length },
    { 'عنوان شاخص': 'تعداد بارهای تحویل‌شده به خریدار', 'مقدار / توضیحات': deliveredCount },
    { 'عنوان شاخص': 'تعداد بارهای در انتظار تحویل در انبار', 'مقدار / توضیحات': pendingDeliveryCount },
    { 'عنوان شاخص': 'مجموع کل اقلام فیزیکی کالاهای مندرج در اسناد', 'مقدار / توضیحات': totalPhysicalQty },
  ];

  const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
  wsSummary['!cols'] = [{ wch: 38 }, { wch: 45 }];
  wsSummary['!views'] = [{ rightToLeft: true }];
  XLSX.utils.book_append_sheet(wb, wsSummary, 'خلاصه_پرونده_و_حساب');

  // ----------------------------------------------------
  // Sheet 2: ریز اقلام فاکتورها (با تمام جزئیات تجاری)
  // ----------------------------------------------------
  const itemRows: any[] = [];
  let itemCounter = 1;

  for (const inv of customerInvoices) {
    const slip = exitSlipLogs[inv.id] || { invoiceId: inv.id, printCount: 0, history: [] };
    const slipNum = slip.slipNumber || inv.invoiceNumber;
    const payStatusFa = inv.paymentStatus === 'paid' ? 'تسویه شده' : inv.paymentStatus === 'partial' ? 'تسویه ناقص' : 'پرداخت نشده';
    const payMethodFa = inv.paymentMethod === 'pos' ? 'کارتخوان' : inv.paymentMethod === 'cash' ? 'نقدی' : inv.paymentMethod === 'transfer' ? 'واریز به حساب / کارت' : inv.paymentMethod === 'cheque' ? 'چک' : 'اعتباری / نسیه';
    const docTypeFa = inv.isProforma ? 'پیش‌فاکتور' : 'فاکتور فروش قطعی';

    if (inv.items.length === 0) {
      itemRows.push({
        'ردیف': itemCounter++,
        'شماره فاکتور': inv.invoiceNumber,
        'نوع سند': docTypeFa,
        'تاریخ فاکتور': inv.date,
        'کد کالا': '—',
        'بارکد کالا': '—',
        'شرح کالا یا خدمات': '(بدون قلم کالا)',
        'تنوع / مدل': '—',
        'تعداد': 0,
        'واحد': '—',
        [`فی واحد (${currency})`]: 0,
        [`تخفیف ردیف (${currency})`]: 0,
        [`مبلغ کل ردیف (${currency})`]: 0,
        'وضعیت تسویه فاکتور': payStatusFa,
        [`مبلغ پرداختی فاکتور (${currency})`]: inv.paidAmount || 0,
        [`مانده فاکتور (${currency})`]: Math.max(0, inv.finalTotal - (inv.paidAmount || 0)),
        'شیوه پرداخت': payMethodFa,
        'شماره حواله خروج انبار': slipNum,
        'وضعیت تحویل فیزیکی بار': slip.isDelivered ? 'تحویل شد' : 'در انتظار تحویل',
        'توضیحات فاکتور': inv.notes || '',
      });
    } else {
      for (const it of inv.items) {
        itemRows.push({
          'ردیف': itemCounter++,
          'شماره فاکتور': inv.invoiceNumber,
          'نوع سند': docTypeFa,
          'تاریخ فاکتور': inv.date,
          'کد کالا': it.productCode || '—',
          'بارکد کالا': it.barcode || '—',
          'شرح کالا یا خدمات': it.productName,
          'تنوع / مدل': it.variantName || '—',
          'تعداد': it.quantity,
          'واحد': it.unit || 'عدد',
          [`فی واحد (${currency})`]: it.unitPrice,
          [`تخفیف ردیف (${currency})`]: it.discount || 0,
          [`مبلغ کل ردیف (${currency})`]: it.total,
          'وضعیت تسویه فاکتور': payStatusFa,
          [`مبلغ پرداختی فاکتور (${currency})`]: inv.paidAmount || 0,
          [`مانده فاکتور (${currency})`]: Math.max(0, inv.finalTotal - (inv.paidAmount || 0)),
          'شیوه پرداخت': payMethodFa,
          'شماره حواله خروج انبار': slipNum,
          'وضعیت تحویل فیزیکی بار': slip.isDelivered ? 'تحویل شد' : 'در انتظار تحویل',
          'توضیحات فاکتور': inv.notes || '',
        });
      }
    }
  }

  const wsItems = XLSX.utils.json_to_sheet(itemRows);
  wsItems['!cols'] = [
    { wch: 8 },  // ردیف
    { wch: 16 }, // شماره فاکتور
    { wch: 16 }, // نوع سند
    { wch: 13 }, // تاریخ فاکتور
    { wch: 14 }, // کد کالا
    { wch: 15 }, // بارکد
    { wch: 32 }, // شرح کالا
    { wch: 16 }, // تنوع
    { wch: 10 }, // تعداد
    { wch: 10 }, // واحد
    { wch: 16 }, // فی واحد
    { wch: 14 }, // تخفیف
    { wch: 18 }, // مبلغ کل ردیف
    { wch: 14 }, // وضعیت تسویه
    { wch: 16 }, // مبلغ پرداختی
    { wch: 16 }, // مانده فاکتور
    { wch: 18 }, // شیوه پرداخت
    { wch: 20 }, // شماره حواله خروج
    { wch: 18 }, // وضعیت تحویل بار
    { wch: 30 }, // توضیحات فاکتور
  ];
  wsItems['!views'] = [{ rightToLeft: true }];
  XLSX.utils.book_append_sheet(wb, wsItems, 'ریز_اقلام_فاکتورها');

  // ----------------------------------------------------
  // Sheet 3: حواله‌های خروج انبار با جزییات تحویل و لجستیک
  // ----------------------------------------------------
  const slipRows: any[] = [];
  let slipCounter = 1;

  for (const inv of customerInvoices) {
    const slip = exitSlipLogs[inv.id] || { invoiceId: inv.id, printCount: 0, history: [] };
    const slipNum = slip.slipNumber || inv.invoiceNumber;
    const isDeliveredFa = slip.isDelivered ? 'بار تحویل شد' : 'در انتظار تحویل انبار';
    const printStatusFa = slip.printCount > 0 ? `چاپ شده (${slip.printCount} مرتبه)` : 'منتظر اولین چاپ';
    const docTypeFa = inv.isProforma ? 'پیش‌فاکتور' : 'فاکتور قطعی';

    if (inv.items.length === 0) {
      slipRows.push({
        'ردیف': slipCounter++,
        'شماره حواله خروج (بیجک)': slipNum,
        'شماره فاکتور متناظر': inv.invoiceNumber,
        'نوع فاکتور': docTypeFa,
        'تاریخ حواله': inv.date,
        'کد کالا': '—',
        'نام کالای تحویلی': '(بدون قلم کالا)',
        'تنوع / مدل کالا': '—',
        'تعداد تحویلی': 0,
        'واحد سنجش': '—',
        'وضعیت تحویل فیزیکی بار': isDeliveredFa,
        'تاریخ و ساعت تحویل': slip.deliveredAt || '—',
        'انباردار تحویل‌دهنده': slip.deliveredBy || '—',
        'نام راننده / تحویل‌گیرنده': slip.receiverName || '—',
        'تلفن تماس راننده': slip.receiverPhone || '—',
        'مشخصات خودرو و پلاک': slip.vehicleInfo || '—',
        'شماره بارنامه / یادداشت خروج': slip.deliveryNotes || '—',
        'وضعیت چاپ برگه خروج': printStatusFa,
        'زمان آخرین چاپ': slip.lastPrintedAt || '—',
        'نام مشتری در سند': inv.customerName,
      });
    } else {
      for (const it of inv.items) {
        slipRows.push({
          'ردیف': slipCounter++,
          'شماره حواله خروج (بیجک)': slipNum,
          'شماره فاکتور متناظر': inv.invoiceNumber,
          'نوع فاکتور': docTypeFa,
          'تاریخ حواله': inv.date,
          'کد کالا': it.productCode || '—',
          'نام کالای تحویلی': it.productName,
          'تنوع / مدل کالا': it.variantName || '—',
          'تعداد تحویلی': it.quantity,
          'واحد سنجش': it.unit || 'عدد',
          'وضعیت تحویل فیزیکی بار': isDeliveredFa,
          'تاریخ و ساعت تحویل': slip.deliveredAt || '—',
          'انباردار تحویل‌دهنده': slip.deliveredBy || '—',
          'نام راننده / تحویل‌گیرنده': slip.receiverName || '—',
          'تلفن تماس راننده': slip.receiverPhone || '—',
          'مشخصات خودرو و پلاک': slip.vehicleInfo || '—',
          'شماره بارنامه / یادداشت خروج': slip.deliveryNotes || '—',
          'وضعیت چاپ برگه خروج': printStatusFa,
          'زمان آخرین چاپ': slip.lastPrintedAt || '—',
          'نام مشتری در سند': inv.customerName,
        });
      }
    }
  }

  const wsSlips = XLSX.utils.json_to_sheet(slipRows);
  wsSlips['!cols'] = [
    { wch: 8 },  // ردیف
    { wch: 22 }, // شماره حواله خروج
    { wch: 18 }, // شماره فاکتور
    { wch: 14 }, // نوع فاکتور
    { wch: 13 }, // تاریخ حواله
    { wch: 14 }, // کد کالا
    { wch: 32 }, // نام کالا
    { wch: 16 }, // تنوع
    { wch: 12 }, // تعداد
    { wch: 10 }, // واحد
    { wch: 20 }, // وضعیت تحویل
    { wch: 20 }, // تاریخ و ساعت تحویل
    { wch: 18 }, // انباردار
    { wch: 22 }, // نام راننده
    { wch: 16 }, // تلفن راننده
    { wch: 22 }, // مشخصات ماشین
    { wch: 26 }, // شماره بارنامه
    { wch: 20 }, // وضعیت چاپ
    { wch: 20 }, // آخرین زمان چاپ
    { wch: 22 }, // نام مشتری
  ];
  wsSlips['!views'] = [{ rightToLeft: true }];
  XLSX.utils.book_append_sheet(wb, wsSlips, 'حواله_های_خروج_انبار');

  // ----------------------------------------------------
  // Sheet 4: سرجمع فاکتورها (سطح فاکتور)
  // ----------------------------------------------------
  const invoiceOverviewRows = customerInvoices.map((inv, idx) => {
    const slip = exitSlipLogs[inv.id] || { invoiceId: inv.id, printCount: 0, history: [] };
    const slipNum = slip.slipNumber || inv.invoiceNumber;
    const payStatusFa = inv.paymentStatus === 'paid' ? 'تسویه کامل' : inv.paymentStatus === 'partial' ? 'تسویه ناقص' : 'پرداخت نشده';
    const payMethodFa = inv.paymentMethod === 'pos' ? 'کارتخوان' : inv.paymentMethod === 'cash' ? 'نقدی' : inv.paymentMethod === 'transfer' ? 'واریز به حساب / کارت' : inv.paymentMethod === 'cheque' ? 'چک' : 'اعتباری / نسیه';
    const docTypeFa = inv.isProforma ? 'پیش‌فاکتور' : 'فاکتور رسمی';
    const itemsCount = inv.items.length;
    const totalQty = inv.items.reduce((sum, it) => sum + (Number(it.quantity) || 0), 0);

    return {
      'ردیف': idx + 1,
      'شماره فاکتور': inv.invoiceNumber,
      'نوع سند': docTypeFa,
      'تاریخ فاکتور': inv.date,
      'تاریخ سررسید': inv.dueDate || '—',
      'تعداد ردیف کالا': itemsCount,
      'مجموع تعداد اقلام': totalQty,
      [`جمع ناخالص (${currency})`]: inv.subtotal,
      [`مبلغ تخفیف (${currency})`]: inv.totalDiscount,
      [`مالیات (${currency})`]: inv.taxAmount,
      [`مبلغ نهایی فاکتور (${currency})`]: inv.finalTotal,
      [`مبلغ پرداختی (${currency})`]: inv.paidAmount || 0,
      [`مانده بدهی (${currency})`]: Math.max(0, inv.finalTotal - (inv.paidAmount || 0)),
      'وضعیت پرداخت': payStatusFa,
      'روش پرداخت': payMethodFa,
      'اطلاعات چک / واریز': inv.chequeNumber ? `چک ش: ${inv.chequeNumber}` : (inv.transferDescription || '—'),
      'شماره حواله خروج انبار': slipNum,
      'وضعیت تحویل بار': slip.isDelivered ? 'تحویل شد' : 'در انتظار تحویل',
      'تاریخ تحویل بار': slip.deliveredAt || '—',
      'راننده / تحویل‌گیرنده': slip.receiverName || '—',
      'مشخصات خودرو': slip.vehicleInfo || '—',
      'توضیحات فاکتور': inv.notes || '',
    };
  });

  const wsOverview = XLSX.utils.json_to_sheet(invoiceOverviewRows);
  wsOverview['!cols'] = [
    { wch: 8 },  // ردیف
    { wch: 16 }, // شماره فاکتور
    { wch: 14 }, // نوع سند
    { wch: 13 }, // تاریخ
    { wch: 13 }, // سررسید
    { wch: 14 }, // تعداد ردیف
    { wch: 15 }, // مجموع تعداد
    { wch: 16 }, // جمع ناخالص
    { wch: 14 }, // تخفیف
    { wch: 14 }, // مالیات
    { wch: 18 }, // مبلغ نهایی
    { wch: 16 }, // مبلغ پرداختی
    { wch: 16 }, // مانده بدهی
    { wch: 14 }, // وضعیت پرداخت
    { wch: 18 }, // روش پرداخت
    { wch: 22 }, // چک / واریز
    { wch: 20 }, // شماره حواله
    { wch: 18 }, // وضعیت تحویل
    { wch: 18 }, // تاریخ تحویل
    { wch: 20 }, // راننده
    { wch: 20 }, // مشخصات خودرو
    { wch: 30 }, // توضیحات
  ];
  wsOverview['!views'] = [{ rightToLeft: true }];
  XLSX.utils.book_append_sheet(wb, wsOverview, 'لیست_کلی_فاکتورها');

  // Generate File Name
  const safeName = customer.name.replace(/[/\\:*?"<>|]/g, '_').trim();
  const safeDate = getCurrentJalaliDate().replace(/\//g, '-');
  const fileName = `فاکتورها_و_حواله_های_${safeName}_${safeDate}.xlsx`;

  XLSX.writeFile(wb, fileName);

  return {
    success: true,
    exportedInvoicesCount: customerInvoices.length,
    exportedItemsCount: itemRows.length,
    exportedSlipsCount: slipRows.length,
    fileName,
  };
}

/**
 * PARSE PRODUCTS EXCEL FILE (with variants grouping support)
 */
export interface ProductImportResult {
  products: Product[];
  totalRows: number;
  validRows: number;
  errors: string[];
  totalVariantsCount: number;
}

export async function parseProductsExcel(file: File): Promise<ProductImportResult> {
  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data, { type: 'array' });

  // Find sheet with data
  let worksheet: XLSX.WorkSheet | null = null;
  for (const name of workbook.SheetNames) {
    const ws = workbook.Sheets[name];
    if (ws && ws['!ref']) {
      const testRows: any[] = XLSX.utils.sheet_to_json(ws, { header: 1 });
      if (testRows && testRows.length >= 2) {
        worksheet = ws;
        break;
      }
    }
  }

  if (!worksheet) {
    const firstSheetName = workbook.SheetNames[0];
    worksheet = workbook.Sheets[firstSheetName];
  }

  if (!worksheet) {
    throw new Error('فایل اکسل انتخاب شده خالی است یا شیت معتبری ندارد.');
  }

  const rawRows: any[] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
  if (rawRows.length < 2) {
    throw new Error('فایل اکسل باید حداقل دارای یک سطر عنوان و یک سطر داده باشد.');
  }

  // Detect header row by scanning first 10 rows
  let headerRowIndex = 0;
  for (let i = 0; i < Math.min(rawRows.length, 10); i++) {
    const candidateRow = (rawRows[i] || []).map((h: any) => normalizeKey(String(h || '')));
    const hasProductCol = candidateRow.some((h: string) =>
      h.includes('نامکالا') || h.includes('ناممحصول') || h.includes('کالا') || h.includes('محصول') || h.includes('product')
    );
    if (hasProductCol) {
      headerRowIndex = i;
      break;
    }
  }

  const headerRow: string[] = (rawRows[headerRowIndex] || []).map((h: any) => String(h || '').trim());
  const normalizedHeaders = headerRow.map(normalizeKey);

  // Column matching helper
  const findColIndex = (...candidates: string[]) => {
    for (const c of candidates) {
      const norm = normalizeKey(c);
      const idx = normalizedHeaders.findIndex((h) => h.includes(norm) || norm.includes(h));
      if (idx !== -1) return idx;
    }
    return -1;
  };

  let nameIdx = findColIndex('نامکالا', 'ناممحصول', 'کالا', 'محصول', 'نام', 'title', 'productname', 'itemname', 'item', 'name');
  const codeIdx = findColIndex('کدکالا', 'کدمحصول', 'شناسهکالا', 'کد', 'بارکد', 'code', 'sku', 'barcode', 'itemcode');
  const variantIdx = findColIndex('تنوعرنگمدل', 'تنوع', 'رنگ', 'مدل', 'سایز', 'ابعاد', 'variant', 'color', 'attribute');
  const variantCodeIdx = findColIndex('کداختصاصیتنوع', 'کدتنوع', 'شناسهتنوع', 'variantcode', 'variantsku');
  const categoryIdx = findColIndex('دستهبندی', 'دسته', 'گروهکالا', 'گروه', 'category', 'group');
  const unitIdx = findColIndex('واحدسنجش', 'واحد', 'unit');
  const buyPriceIdx = findColIndex('قیمتخرید', 'فیخرید', 'خرید', 'buyprice', 'purchaseprice', 'cost');
  const sellPriceIdx = findColIndex('قیمتفروش', 'فیفروش', 'قیمت', 'فروش', 'sellprice', 'price');
  const stockIdx = findColIndex('موجودیانبار', 'موجودی', 'تعداد', 'موجودیفعلی', 'stock', 'qty', 'quantity', 'count');
  const minStockIdx = findColIndex('حداقلحداکثر', 'حداقلهشدارموجودی', 'حداقلهشدار', 'نقطهسفارش', 'هشدارموجودی', 'minstock', 'alert');
  const descIdx = findColIndex('توضیحات', 'مشخصات', 'شرح', 'description', 'desc', 'notes');

  if (nameIdx === -1) {
    // Fallback: check if header row has any item that contains 'نام'
    nameIdx = normalizedHeaders.findIndex((h) => h.includes('نام'));
  }
  if (nameIdx === -1) {
    throw new Error('ستون «نام کالا» در فایل اکسل یافت نشد. لطفاً از قالب استاندارد اکسل استفاده فرمایید.');
  }

  const productMap = new Map<string, { product: Product; variants: ProductVariant[] }>();
  const errors: string[] = [];
  let validRows = 0;
  let totalVariantsCount = 0;

  for (let r = headerRowIndex + 1; r < rawRows.length; r++) {
    const row = rawRows[r];
    if (!row || row.length === 0) continue;

    const rawName = parseString(row[nameIdx]);
    if (!rawName) continue; // skip empty rows

    validRows++;

    const rawCode = codeIdx !== -1 ? parseString(row[codeIdx]) : '';
    const rawVariant = variantIdx !== -1 ? parseString(row[variantIdx]) : '';
    const rawVariantCode = variantCodeIdx !== -1 ? parseString(row[variantCodeIdx]) : '';
    const rawCategory = categoryIdx !== -1 ? parseString(row[categoryIdx]) || 'عمومی' : 'عمومی';
    const rawUnit = unitIdx !== -1 ? parseString(row[unitIdx]) || 'عدد' : 'عدد';
    const rawBuyPrice = buyPriceIdx !== -1 ? parseNumber(row[buyPriceIdx]) : 0;
    const rawSellPrice = sellPriceIdx !== -1 ? parseNumber(row[sellPriceIdx]) : 0;
    const rawStock = stockIdx !== -1 ? parseNumber(row[stockIdx]) : 0;
    const rawMinStock = minStockIdx !== -1 ? parseNumber(row[minStockIdx]) : 5;
    const rawDesc = descIdx !== -1 ? parseString(row[descIdx]) : '';

    // Grouping key by product name or base code
    const key = (rawCode ? `${rawCode}___` : '') + rawName.trim().toLowerCase();

    let entry = productMap.get(key);
    if (!entry) {
      const existingParsedProducts = Array.from(productMap.values()).map((v) => v.product);
      const autoCode = generateNextProductCode(existingParsedProducts);
      const newProd: Product = {
        id: `prod-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        name: rawName.trim(),
        code: rawCode || autoCode,
        category: rawCategory,
        unit: rawUnit,
        buyPrice: rawBuyPrice,
        sellPrice: rawSellPrice,
        stock: 0,
        minStockAlert: rawMinStock,
        description: rawDesc,
        hasVariants: false,
        variants: [],
        updatedAt: getCurrentJalaliDate(),
      };
      entry = { product: newProd, variants: [] };
      productMap.set(key, entry);
    }

    // Check if this row defines a variant (e.g. "طوسی", "قرمز")
    if (rawVariant) {
      totalVariantsCount++;
      const variantItem: ProductVariant = {
        id: `var-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        name: rawVariant.trim(),
        code: rawVariantCode || `${entry.product.code}-${entry.variants.length + 1}`,
        buyPrice: rawBuyPrice || entry.product.buyPrice,
        sellPrice: rawSellPrice || entry.product.sellPrice,
        stock: Math.max(0, rawStock),
        minStockAlert: rawMinStock,
      };
      entry.variants.push(variantItem);
      entry.product.hasVariants = true;
      entry.product.stock += Math.max(0, rawStock);
    } else {
      // Direct stock if no variant
      if (entry.variants.length === 0) {
        entry.product.stock = Math.max(0, rawStock);
      }
      if (rawBuyPrice && !entry.product.buyPrice) entry.product.buyPrice = rawBuyPrice;
      if (rawSellPrice && !entry.product.sellPrice) entry.product.sellPrice = rawSellPrice;
    }
  }

  const finalProducts: Product[] = [];
  productMap.forEach(({ product, variants }) => {
    if (variants.length > 0) {
      product.hasVariants = true;
      product.variants = variants;
      product.stock = variants.reduce((sum, v) => sum + v.stock, 0);
    }
    finalProducts.push(product);
  });

  return {
    products: finalProducts,
    totalRows: rawRows.length - 1,
    validRows,
    errors,
    totalVariantsCount,
  };
}

/**
 * PARSE CUSTOMERS EXCEL FILE
 */
export interface CustomerImportResult {
  customers: Customer[];
  totalRows: number;
  validRows: number;
  errors: string[];
}

export async function parseCustomersExcel(file: File): Promise<CustomerImportResult> {
  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data, { type: 'array' });

  // Find sheet with data
  let worksheet: XLSX.WorkSheet | null = null;
  for (const name of workbook.SheetNames) {
    const ws = workbook.Sheets[name];
    if (ws && ws['!ref']) {
      const testRows: any[] = XLSX.utils.sheet_to_json(ws, { header: 1 });
      if (testRows && testRows.length >= 2) {
        worksheet = ws;
        break;
      }
    }
  }

  if (!worksheet) {
    const firstSheetName = workbook.SheetNames[0];
    worksheet = workbook.Sheets[firstSheetName];
  }

  if (!worksheet) {
    throw new Error('فایل اکسل انتخاب شده خالی است یا شیت معتبری ندارد.');
  }

  const rawRows: any[] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
  if (rawRows.length < 2) {
    throw new Error('فایل اکسل باید حداقل دارای یک سطر عنوان و یک سطر داده باشد.');
  }

  // Detect header row by scanning first 10 rows for customer/name columns
  let headerRowIndex = 0;
  for (let i = 0; i < Math.min(rawRows.length, 10); i++) {
    const candidateRow = (rawRows[i] || []).map((h: any) => normalizeKey(String(h || '')));
    const hasCustomerCol = candidateRow.some((h: string) =>
      h.includes('مشتری') || h.includes('خریدار') || h.includes('طرفحساب') || h.includes('نام') || h.includes('customer') || h.includes('client')
    );
    if (hasCustomerCol) {
      headerRowIndex = i;
      break;
    }
  }

  const headerRow: string[] = (rawRows[headerRowIndex] || []).map((h: any) => String(h || '').trim());
  const normalizedHeaders = headerRow.map(normalizeKey);

  const findColIndex = (...candidates: string[]) => {
    for (const c of candidates) {
      const norm = normalizeKey(c);
      const idx = normalizedHeaders.findIndex((h) => h.includes(norm) || norm.includes(h));
      if (idx !== -1) return idx;
    }
    return -1;
  };

  let nameIdx = findColIndex(
    'ناممشترییاشرکت',
    'ناممشتری',
    'نامشرکت',
    'خریدار',
    'نامطرفحساب',
    'طرفحساب',
    'نامشخص',
    'ناموخانوادگی',
    'نامخانوادگی',
    'نام',
    'عنوان',
    'شخص',
    'customer',
    'customername',
    'buyer',
    'client',
    'company',
    'name',
    'contact'
  );

  const phoneIdx = findColIndex(
    'شمارهتماس',
    'شمارههمراه',
    'تلفنهمراه',
    'شمارهتلفن',
    'موبایل',
    'تلفن',
    'همراه',
    'تماس',
    'شماره',
    'phone',
    'mobile',
    'tel',
    'cell'
  );

  const nationalIdIdx = findColIndex(
    'کدملییاشناسهاقتصادی',
    'شناسهملییاکدملی',
    'کدملی',
    'شناسهملی',
    'شناسهاقتصادی',
    'کداقتصادی',
    'کدشخص',
    'کدمشتری',
    'کدطرفحساب',
    'nationalid',
    'economiccode',
    'nationalcode',
    'id'
  );

  const addressIdx = findColIndex(
    'آدرس',
    'نشانی',
    'محل',
    'محلتحویل',
    'اقامتگاه',
    'محلکار',
    'آدرسشرکت',
    'آدرسمشتری',
    'address',
    'location'
  );

  const notesIdx = findColIndex(
    'یادداشت',
    'توضیحات',
    'شرح',
    'ملاحظات',
    'توضیح',
    'notes',
    'description',
    'memo',
    'comment'
  );

  // Fallback 1: check if any column header has "نام" or "خریدار" or "مشتری"
  if (nameIdx === -1) {
    nameIdx = normalizedHeaders.findIndex((h) => h.includes('نام') || h.includes('مشتری') || h.includes('طرف'));
  }

  // Fallback 2: if still not found, check if column 0 has data in subsequent rows
  if (nameIdx === -1 && rawRows.length > headerRowIndex + 1) {
    nameIdx = 0;
  }

  if (nameIdx === -1) {
    throw new Error('ستون «نام مشتری» در فایل اکسل یافت نشد. لطفاً از قالب استاندارد اکسل استفاده فرمایید.');
  }

  const customers: Customer[] = [];
  const errors: string[] = [];
  let validRows = 0;

  for (let r = headerRowIndex + 1; r < rawRows.length; r++) {
    const row = rawRows[r];
    if (!row || row.length === 0) continue;

    const rawName = parseString(row[nameIdx]);
    if (!rawName) continue;

    validRows++;

    const rawPhone = phoneIdx !== -1 ? parsePhoneNumber(row[phoneIdx]) : '';
    const rawNationalId = nationalIdIdx !== -1 ? parseString(row[nationalIdIdx]) : '';
    const rawAddress = addressIdx !== -1 ? parseString(row[addressIdx]) : '';
    const rawNotes = notesIdx !== -1 ? parseString(row[notesIdx]) : '';

    customers.push({
      id: `cust-${Date.now()}-${Math.random().toString(36).substring(2, 6)}-${validRows}`,
      name: rawName.trim(),
      phone: rawPhone,
      nationalId: rawNationalId,
      address: rawAddress,
      notes: rawNotes,
      createdAt: getCurrentJalaliDate(),
    });
  }

  return {
    customers,
    totalRows: rawRows.length - 1,
    validRows,
    errors,
  };
}
