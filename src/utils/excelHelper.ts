import * as XLSX from 'xlsx';
import { Product, ProductVariant, Customer } from '../types';
import { getCurrentJalaliDate } from './jalali';

// Helper to normalize strings for header matching
function normalizeKey(str: string): string {
  return (str || '')
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[\s_\-/\\]+/g, '')
    .replace(/[یي]/g, 'ی')
    .replace(/[کك]/g, 'ک');
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

  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];
  if (!worksheet) {
    throw new Error('فایل اکسل انتخاب شده خالی است یا شیت معتبری ندارد.');
  }

  const rawRows: any[] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
  if (rawRows.length < 2) {
    throw new Error('فایل اکسل باید حداقل دارای یک سطر عنوان و یک سطر داده باشد.');
  }

  const headerRow: string[] = (rawRows[0] || []).map((h: any) => String(h || '').trim());
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

  const nameIdx = findColIndex('نامکالا', 'ناممحصول', 'نام', 'title', 'productname', 'name');
  const codeIdx = findColIndex('کدکالا', 'کد', 'بارکد', 'code', 'sku', 'barcode');
  const variantIdx = findColIndex('تنوع', 'رنگ', 'مدل', 'سایز', 'variant', 'color', 'attribute');
  const variantCodeIdx = findColIndex('کداختصاصیتنوع', 'کدتنوع', 'variantcode', 'variantsku');
  const categoryIdx = findColIndex('دستهبندی', 'دسته', 'گروه', 'category', 'group');
  const unitIdx = findColIndex('واحدسنجش', 'واحد', 'unit');
  const buyPriceIdx = findColIndex('قیمتخرید', 'فیخرید', 'خرید', 'buyprice', 'purchaseprice');
  const sellPriceIdx = findColIndex('قیمتفروش', 'فیفروش', 'فروش', 'sellprice', 'price');
  const stockIdx = findColIndex('موجودیانبار', 'موجودی', 'تعداد', 'stock', 'qty', 'quantity');
  const minStockIdx = findColIndex('حداقلحداکثر', 'حداقلهشدارموجودی', 'حداقلهشدار', 'نقطهسفارش', 'minstock', 'alert');
  const descIdx = findColIndex('توضیحات', 'مشخصات', 'شرح', 'description', 'desc', 'notes');

  if (nameIdx === -1) {
    throw new Error('ستون «نام کالا» در فایل اکسل یافت نشد. لطفاً از قالب استاندارد اکسل استفاده فرمایید.');
  }

  const productMap = new Map<string, { product: Product; variants: ProductVariant[] }>();
  const errors: string[] = [];
  let validRows = 0;
  let totalVariantsCount = 0;

  for (let r = 1; r < rawRows.length; r++) {
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
      const newProd: Product = {
        id: `prod-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        name: rawName.trim(),
        code: rawCode || `${1000 + productMap.size + 1}`,
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

  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];
  if (!worksheet) {
    throw new Error('فایل اکسل انتخاب شده خالی است یا شیت معتبری ندارد.');
  }

  const rawRows: any[] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
  if (rawRows.length < 2) {
    throw new Error('فایل اکسل باید حداقل دارای یک سطر عنوان و یک سطر داده باشد.');
  }

  const headerRow: string[] = (rawRows[0] || []).map((h: any) => String(h || '').trim());
  const normalizedHeaders = headerRow.map(normalizeKey);

  const findColIndex = (...candidates: string[]) => {
    for (const c of candidates) {
      const norm = normalizeKey(c);
      const idx = normalizedHeaders.findIndex((h) => h.includes(norm) || norm.includes(h));
      if (idx !== -1) return idx;
    }
    return -1;
  };

  const nameIdx = findColIndex('ناممشترییاشرکت', 'ناممشتری', 'خریدار', 'نامطرفحساب', 'نام', 'customer', 'customername', 'name');
  const phoneIdx = findColIndex('شمارهتماس', 'تلفنهمراه', 'موبایل', 'تلفن', 'شماره', 'phone', 'mobile', 'tel');
  const nationalIdIdx = findColIndex('کدملییاشناسهاقتصادی', 'کدملی', 'شناسهاقتصادی', 'کداقتصادی', 'nationalid', 'economiccode', 'nationalcode');
  const addressIdx = findColIndex('آدرس', 'نشانی', 'محل', 'address', 'location');
  const notesIdx = findColIndex('یادداشت', 'توضیحات', 'شرح', 'notes', 'description');

  if (nameIdx === -1) {
    throw new Error('ستون «نام مشتری» در فایل اکسل یافت نشد. لطفاً از قالب استاندارد اکسل استفاده فرمایید.');
  }

  const customers: Customer[] = [];
  const errors: string[] = [];
  let validRows = 0;

  for (let r = 1; r < rawRows.length; r++) {
    const row = rawRows[r];
    if (!row || row.length === 0) continue;

    const rawName = parseString(row[nameIdx]);
    if (!rawName) continue;

    validRows++;

    const rawPhone = phoneIdx !== -1 ? parseString(row[phoneIdx]) : '';
    const rawNationalId = nationalIdIdx !== -1 ? parseString(row[nationalIdIdx]) : '';
    const rawAddress = addressIdx !== -1 ? parseString(row[addressIdx]) : '';
    const rawNotes = notesIdx !== -1 ? parseString(row[notesIdx]) : '';

    customers.push({
      id: `cust-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
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
