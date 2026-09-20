import { Product, ProductVariant, InvoiceItem } from '../types';

/**
 * محاسبه رقم کنترل (Check Digit) استاندارد بارکد EAN-13
 */
export function calculateEan13CheckDigit(twelveDigits: string): number {
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const digit = parseInt(twelveDigits[i] || '0', 10);
    // ارقام در موقعیت‌های فرد (ایندکس ۰، ۲، ۴...) با ضریب ۱ و زوج (ایندکس ۱، ۳، ۵...) با ضریب ۳
    sum += i % 2 === 0 ? digit : digit * 3;
  }
  const mod = sum % 10;
  return mod === 0 ? 0 : 10 - mod;
}

/**
 * تولید بارکد استاندارد EAN-13 با پیشوند مشخص
 * @param prefix پیشوند ۳ رقمی (مثلاً ۲۱۰ برای کالاهای داخلی، ۲۱۱ برای تنوع‌ها، ۲۹۰ برای خدمات)
 * @param seqNum شماره ترتیبی کالا یا خدمت
 */
export function generateEan13(prefix: string, seqNum: number): string {
  const cleanPrefix = prefix.padEnd(3, '0').slice(0, 3);
  const cleanSeq = Math.max(1, Math.abs(seqNum)).toString().padStart(9, '0').slice(-9);
  const first12 = `${cleanPrefix}${cleanSeq}`;
  const checkDigit = calculateEan13CheckDigit(first12);
  return `${first12}${checkDigit}`;
}

/**
 * استخراج عدد از کد متنی (مانند '1005' یا 'P-1005' یا 'SRV-1002')
 */
export function extractNumericFromCode(code: string): number {
  if (!code) return 0;
  const match = code.match(/\d+/);
  return match ? parseInt(match[0], 10) : 0;
}

/**
 * تعیین خودکار کد کالا/محصول بعدی توسط سیستم
 * با بررسی کلیه کدهای موجود و تولید کد متوالی آزاد نهایتاً ۳ رقمی (۱۰۱ تا ۹۹۹)
 */
export function generateNextProductCode(existingProducts: Product[] = []): string {
  const usedCodes = new Set<string>();
  let maxThreeDigit = 100;

  existingProducts.forEach((p) => {
    if (p.code) {
      const trimmed = p.code.trim();
      usedCodes.add(trimmed);
      const num = extractNumericFromCode(trimmed);
      // فقط کدهای حداکثر ۳ رقمی (۱۰۰ تا ۹۹۹) را در محاسبه دنباله در نظر می‌گیریم
      if (num >= 100 && num <= 999 && num > maxThreeDigit) {
        maxThreeDigit = num;
      }
    }
  });

  // تلاش اول: تولید کد بعدی بعد از بزرگترین کد ۳ رقمی موجود
  const candidate = maxThreeDigit + 1;
  if (candidate <= 999 && !usedCodes.has(candidate.toString())) {
    return candidate.toString();
  }

  // اگر کد بعدی موجود نبود، یافتن اولین کد خالی در بازه ۱۰۱ تا ۹۹۹
  for (let i = 101; i <= 999; i++) {
    if (!usedCodes.has(i.toString())) {
      return i.toString();
    }
  }

  // در صورت پر بودن ۱۰۱ تا ۹۹۹، بررسی بازه ۱ تا ۱۰۰ (که باز هم حداکثر ۳ رقم است)
  for (let i = 1; i <= 100; i++) {
    if (!usedCodes.has(i.toString())) {
      return i.toString();
    }
  }

  // سقف نهایی کدهای ۳ رقمی
  return '999';
}

/**
 * تعیین خودکار بارکد کالا/محصول توسط سیستم (استاندارد ۱۳ رقمی EAN-13 داخلی ۲۱۰)
 */
export function generateProductBarcode(
  productCode: string,
  existingProducts: Product[] = []
): string {
  const existingBarcodes = new Set<string>();

  existingProducts.forEach((p) => {
    if (p.barcode) existingBarcodes.add(p.barcode.trim());
    if (p.variants) {
      p.variants.forEach((v) => {
        if (v.barcode) existingBarcodes.add(v.barcode.trim());
      });
    }
  });

  let num = extractNumericFromCode(productCode);
  if (num <= 0) {
    num = existingProducts.length + 101;
  }

  let candidateBarcode = generateEan13('210', num);
  let offset = 0;
  while (existingBarcodes.has(candidateBarcode)) {
    offset++;
    candidateBarcode = generateEan13('210', num + offset);
  }

  return candidateBarcode;
}

/**
 * تعیین خودکار کد تنوع محصول (رنگ، سایز، مدل و...) توسط سیستم
 */
export function generateVariantCode(
  parentCode: string,
  variantIndex: number,
  variantName?: string
): string {
  const safeParent = parentCode ? parentCode.trim() : '101';
  const paddedIndex = String(variantIndex).padStart(2, '0');
  
  if (!variantName) {
    return `${safeParent}-${paddedIndex}`;
  }

  const nameMap: Record<string, string> = {
    طوسی: 'GR',
    خاکستری: 'GR',
    قرمز: 'RD',
    سبز: 'GN',
    آبی: 'BL',
    سرمه‌ای: 'NV',
    سفید: 'WH',
    مشکی: 'BK',
    زرد: 'YL',
    نارنجی: 'OR',
    قهوه‌ای: 'BR',
    سایز۱: 'S1',
    سایز۲: 'S2',
    سایز۳: 'S3',
  };

  const cleanName = variantName.trim();
  const shortCode = nameMap[cleanName];

  if (shortCode) {
    return `${safeParent}-${shortCode}`;
  }

  return `${safeParent}-${paddedIndex}`;
}

/**
 * تعیین خودکار بارکد تنوع کالا توسط سیستم (استاندارد ۱۳ رقمی EAN-13 با پیشوند ۲۱۱)
 */
export function generateVariantBarcode(
  parentCode: string,
  variantIndex: number,
  existingProducts: Product[] = []
): string {
  const existingBarcodes = new Set<string>();

  existingProducts.forEach((p) => {
    if (p.barcode) existingBarcodes.add(p.barcode.trim());
    if (p.variants) {
      p.variants.forEach((v) => {
        if (v.barcode) existingBarcodes.add(v.barcode.trim());
      });
    }
  });

  const parentNum = extractNumericFromCode(parentCode) || 101;
  const combinedSeq = parentNum * 100 + variantIndex;

  let candidateBarcode = generateEan13('211', combinedSeq);
  let offset = 0;
  while (existingBarcodes.has(candidateBarcode)) {
    offset++;
    candidateBarcode = generateEan13('211', combinedSeq + offset);
  }

  return candidateBarcode;
}

/**
 * تعیین خودکار کد خدمات توسط سیستم (مثلاً: SRV-1001, SRV-1002, ...)
 */
export function generateNextServiceCode(
  existingItems: { productCode?: string }[] = []
): string {
  const usedCodes = new Set<string>();
  let maxServiceNum = 1000;

  existingItems.forEach((item) => {
    if (item.productCode) {
      const code = item.productCode.trim();
      usedCodes.add(code);
      if (code.startsWith('SRV-') || code.startsWith('SRV')) {
        const num = extractNumericFromCode(code);
        if (num > maxServiceNum) {
          maxServiceNum = num;
        }
      }
    }
  });

  let candidateNum = maxServiceNum + 1;
  let candidateCode = `SRV-${candidateNum}`;

  while (usedCodes.has(candidateCode)) {
    candidateNum++;
    candidateCode = `SRV-${candidateNum}`;
  }

  return candidateCode;
}

/**
 * تعیین خودکار بارکد خدمات توسط سیستم (استاندارد ۱۳ رقمی EAN-13 با پیشوند اختصاصی خدمات ۲۹۰)
 */
export function generateServiceBarcode(
  serviceCode: string,
  existingItems: { barcode?: string }[] = []
): string {
  const existingBarcodes = new Set<string>();
  existingItems.forEach((it) => {
    if (it.barcode) existingBarcodes.add(it.barcode.trim());
  });

  let num = extractNumericFromCode(serviceCode);
  if (num <= 0) {
    num = 1001;
  }

  let candidateBarcode = generateEan13('290', num);
  let offset = 0;
  while (existingBarcodes.has(candidateBarcode)) {
    offset++;
    candidateBarcode = generateEan13('290', num + offset);
  }

  return candidateBarcode;
}

/**
 * تضمین و تصحیح کامل کدها و بارکدهای تمام کالاها و تنوع‌ها توسط سیستم
 * هر کالایی که کد یا بارکد نداشته باشد، سیستم به صورت خودکار برای آن مقدار معتبر تعیین می‌کند.
 */
export function ensureProductCodesAndBarcodes(products: Product[]): {
  products: Product[];
  changed: boolean;
} {
  let changed = false;
  const existingBarcodes = new Set<string>();

  // ابتدا بارکدهای موجود را جمع‌آوری می‌کنیم
  products.forEach((p) => {
    if (p.barcode && p.barcode.trim()) {
      existingBarcodes.add(p.barcode.trim());
    }
    if (p.variants) {
      p.variants.forEach((v) => {
        if (v.barcode && v.barcode.trim()) {
          existingBarcodes.add(v.barcode.trim());
        }
      });
    }
  });

  const updatedProducts = products.map((p, index) => {
    let pChanged = false;
    let code = p.code?.trim() || '';
    if (!code) {
      code = (101 + index).toString();
      pChanged = true;
      changed = true;
    }

    let barcode = p.barcode?.trim() || '';
    if (!barcode) {
      barcode = generateProductBarcode(code, products);
      existingBarcodes.add(barcode);
      pChanged = true;
      changed = true;
    }

    let updatedVariants = p.variants;
    if (p.hasVariants && p.variants && p.variants.length > 0) {
      updatedVariants = p.variants.map((v, vIdx) => {
        let vChanged = false;
        let vCode = v.code?.trim() || '';
        if (!vCode) {
          vCode = generateVariantCode(code, vIdx + 1, v.name);
          vChanged = true;
          changed = true;
        }

        let vBarcode = v.barcode?.trim() || '';
        if (!vBarcode) {
          vBarcode = generateVariantBarcode(code, vIdx + 1, products);
          existingBarcodes.add(vBarcode);
          vChanged = true;
          changed = true;
        }

        if (vChanged) {
          return { ...v, code: vCode, barcode: vBarcode };
        }
        return v;
      });
    }

    if (pChanged || (updatedVariants && updatedVariants !== p.variants)) {
      return {
        ...p,
        code,
        barcode,
        variants: updatedVariants,
      };
    }
    return p;
  });

  return { products: updatedProducts, changed };
}
