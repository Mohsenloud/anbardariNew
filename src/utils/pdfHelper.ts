import html2canvas from 'html2canvas-pro';
import jsPDF from 'jspdf';
import { StorageService } from './storage';
import { PdfQualityPreset, Invoice, PrintLayoutSettings, DEFAULT_PRINT_LAYOUT } from '../types';
import { toPersianDigits } from './jalali';
import { getPrintLayoutCssRules, getPrintLayoutCssVariables } from './printLayoutHelper';
import { shapeClonedElementText } from './persianShaper';

const PERSIAN_FEMALE_FIRST_NAMES = new Set([
  'مریم', 'سارا', 'فاطمه', 'زهرا', 'نرگس', 'مهسا', 'نیلوفر', 'زینب', 'بهاره', 'شیرین', 'پریسا', 'سپیده', 'الهام',
  'مینا', 'رویا', 'لاله', 'ساناز', 'نسترن', 'آیدا', 'نگار', 'معصومه', 'سمیه', 'شیما', 'پریچهر', 'مهشید', 'پروانه',
  'ناهید', 'مهناز', 'فرشته', 'مرجان', 'سمیرا', 'شبنم', 'رعنا', 'عاطفه', 'مونا', 'هنگامه', 'هدی', 'پگاه', 'غزل',
  'کیمیا', 'نگین', 'یلدا', 'صبا', 'شادی', 'شیوا', 'هما', 'خاطره', 'شکوفه', 'پریناز', 'تینا', 'سوگند', 'ریحانه',
  'سمانه', 'ندا', 'شیدا', 'مهدیه', 'طاهره', 'فرزانه', 'مژگان', 'بهنوش', 'آذر', 'گیتی', 'پردیس', 'مائده', 'مهلا',
  'بیتا', 'پانته‌آ', 'انسیه', 'هاجر', 'صدیقه', 'مرضیه', 'سکینه', 'فریبا', 'لیلا', 'شهناز', 'پری', 'نوشین', 'ثریا',
  'منیر', 'منیژه', 'مهین', 'پروین', 'عفت', 'اقدس', 'اشرف', 'افسانه', 'ملیحه', 'فرانک', 'درسا', 'حنانه', 'ثنا',
  'سوگل', 'یاسمن', 'ارغوان', 'ترانه', 'بهار', 'دریا', 'روژین', 'افسون', 'ساغر', 'نازنین', 'آرزو', 'طناز', 'آناهیتا'
]);

const PERSIAN_MALE_FIRST_NAMES = new Set([
  'علی', 'محمد', 'مهدی', 'رضا', 'حسین', 'احمد', 'حسن', 'سعید', 'حمید', 'کامران', 'آرش', 'مسعود', 'بابک', 'بهنام',
  'علیرضا', 'امیر', 'پویا', 'بهمن', 'پژمان', 'خسرو', 'فرهاد', 'میلاد', 'سینا', 'بهزاد', 'پیام', 'احسان', 'ایمان',
  'جواد', 'صادق', 'مجید', 'پیمان', 'مهرداد', 'نوید', 'وحید', 'امید', 'بهروز', 'رامین', 'سامان', 'فرزاد', 'داود',
  'داوود', 'هادی', 'حامد', 'مصطفی', 'شهاب', 'سیروان', 'سروش', 'کیوان', 'فرامرز', 'جمشید', 'کیان', 'کوروش', 'کورش',
  'بیژن', 'سهراب', 'دارا', 'شهریار', 'شاهرخ', 'آرمین', 'آرمان', 'شایان', 'فرزین', 'نادر', 'بهرام', 'سام', 'سجاد',
  'محسن', 'امیرحسین', 'امیرعلی', 'محمدرضا', 'محمدمهدی', 'عباس', 'اکبر', 'اصغر', 'مرتضی', 'مجتبی', 'جعفر', 'ابراهیم',
  'اسماعیل', 'یوسف', 'یعقوب', 'یونس', 'قاسم', 'کاظم', 'محمود', 'منصور', 'ناصر', 'جمال', 'جلال', 'جابر', 'یاسر',
  'صابر', 'یاشار', 'اردلان', 'افشین', 'اشکان', 'بردیا', 'ارسلان', 'سورنا', 'سیاوش', 'کیومرث', 'داریوش', 'حمیدرضا',
  'امیرمحمد', 'امیررضا', 'غلامرضا', 'احمدرضا', 'محمدحسین', 'سید', 'فرید', 'کیانوش', 'مهزیار', 'مهراد', 'ارشیا'
]);

/**
 * پاک‌سازی و شکل‌دهی عنوان مشتری به صورت:
 * آقا یا خانم [نام مشتری]
 */
export function formatCustomerHonorificTitle(
  name?: string,
  extra?: { gender?: string; titlePrefix?: string; customerId?: string }
): string {
  const raw = (name || '').trim();
  if (!raw || raw === 'مشتری محترم' || raw === 'مشتری') return 'آقا یا خانم مشتری';

  let gender = extra?.gender;
  let titlePrefix = extra?.titlePrefix;
  if ((!gender || !titlePrefix) && extra?.customerId) {
    try {
      const cust = StorageService.getCustomers().find((c) => c.id === extra.customerId);
      if (cust) {
        gender = gender || cust.gender;
        titlePrefix = titlePrefix || cust.titlePrefix;
      }
    } catch {}
  }

  if (titlePrefix) {
    if (raw.startsWith(titlePrefix)) return raw;
    return `${titlePrefix} ${raw}`;
  }

  if (gender === 'female') {
    if (/^(خانم|سرکار)/.test(raw)) return raw;
    return `خانم ${raw}`;
  }
  if (gender === 'male') {
    if (/^(آقا|آقای|جناب)/.test(raw)) return raw;
    return `آقای ${raw}`;
  }
  if (gender === 'company') {
    return raw;
  }

  if (/^(آقای|آقا|جناب\s+آقای|جناب)\s+/i.test(raw)) return raw;
  if (/^(خانم|سرکار\s+خانم)\s+/i.test(raw)) return raw;
  if (/^(شرکت|موسسه|سازمان|فروشگاه|اداره|بانک|کارخانه|مرکز|تعاونی|پیمانکاری)\s+/i.test(raw)) return raw;

  const words = raw.split(/\s+/).filter(Boolean);
  const firstWord = words[0];

  if (firstWord === 'دکتر' || firstWord === 'مهندس' || firstWord === 'استاد') {
    const secondWord = words[1];
    if (secondWord) {
      if (
        PERSIAN_FEMALE_FIRST_NAMES.has(secondWord) ||
        secondWord.startsWith('فاطمه') ||
        secondWord.startsWith('زهرا')
      ) {
        return `خانم ${raw}`;
      }
      if (
        PERSIAN_MALE_FIRST_NAMES.has(secondWord) ||
        secondWord.startsWith('علی') ||
        secondWord.startsWith('محمد') ||
        secondWord.startsWith('امیر') ||
        secondWord.startsWith('حمید')
      ) {
        return `آقای ${raw}`;
      }
    }
    return `آقا یا خانم ${raw}`;
  }

  if (
    PERSIAN_FEMALE_FIRST_NAMES.has(firstWord) ||
    firstWord.startsWith('فاطمه') ||
    firstWord.startsWith('زهرا')
  ) {
    return `خانم ${raw}`;
  }

  if (
    PERSIAN_MALE_FIRST_NAMES.has(firstWord) ||
    firstWord.startsWith('علی') ||
    firstWord.startsWith('محمد') ||
    firstWord.startsWith('امیر') ||
    firstWord.startsWith('حمید') ||
    firstWord.startsWith('غلام')
  ) {
    return `آقای ${raw}`;
  }

  return `آقا یا خانم ${raw}`;
}

/**
 * نام فایل خروجی PDF استاندارد در تمام برنامه:
 * فاکتور ـ شماره ـ آقا یا خانم نام مشتری
 */
export function getInvoicePdfFilename(
  invoice: Invoice,
  options?: { includeExtension?: boolean }
): string {
  const docType = invoice.isProforma ? 'پیش فاکتور' : 'فاکتور';
  const num = String(invoice.invoiceNumber || '1').trim();
  const customerTitle = formatCustomerHonorificTitle(invoice.customerName, {
    gender: invoice.customerGender,
    titlePrefix: invoice.customerTitlePrefix,
    customerId: invoice.customerId,
  });

  const base = `${docType} ـ ${num} ـ ${customerTitle}`;
  const sanitized = base.replace(/[\\/:*?"<>|]/g, '-').replace(/\s+/g, ' ').trim();
  return options?.includeExtension ? `${sanitized}.pdf` : sanitized;
}

export interface LayoutMeta {
  headerBottomPx: number;
  rowBottomsPx: number[];
  footerTopPx: number;
  rootWidthPx: number;
}

export interface PdfQualityProfile {
  preset: PdfQualityPreset;
  scale: number;
  compression: number; // 0.1 to 1.0 (for canvas.toDataURL)
  label: string;
  badge: string;
  approxSize: string;
  description: string;
}

export const PDF_QUALITY_PRESETS: Record<PdfQualityPreset, PdfQualityProfile> = {
  economy: {
    preset: 'economy',
    scale: 1.35,
    compression: 0.74,
    label: 'اقتصادی و کم‌حجم (فوق‌العاده سریع)',
    badge: 'کم‌حجم‌ترین',
    approxSize: '~۶۰ تا ۹۵ کیلوبایت',
    description: 'کمترین حجم فایل، ایده‌آل برای ارسال با پیام‌رسان‌ها و اینترنت همراه ضعیف',
  },
  standard: {
    preset: 'standard',
    scale: 1.9,
    compression: 0.87,
    label: 'استاندارد متعادل (پیشنهادی)',
    badge: 'تعادل هوشمند',
    approxSize: '~۱۲۰ تا ۱۸۵ کیلوبایت',
    description: 'تعادل هوشمند بین وضوح عالی نوشته‌ها و بارکدها با حجم بهینه برای بایگانی و اشتراک‌گذاری',
  },
  high: {
    preset: 'high',
    scale: 2.35,
    compression: 0.94,
    label: 'کیفیت بالا (شفاف و شارپ)',
    badge: 'تفکیک بالا',
    approxSize: '~۲۵۰ تا ۴۰۰ کیلوبایت',
    description: 'تفکیک تصویر بسیار بالا و فونت‌های شفاف و دقیق، مناسب نمایش در مانیتور و کامپیوتر مشتری',
  },
  ultra: {
    preset: 'ultra',
    scale: 3.0,
    compression: 0.98,
    label: 'کیفیت فوق‌العاده چاپ (Ultra HD)',
    badge: 'حداکثر رزولوشن',
    approxSize: '~۴۵۰ تا ۷۵۰ کیلوبایت',
    description: 'بیشترین وضوح خطوط و حروف جهت چاپ با پرینترهای لیزری صنعتی یا بایگانی اسناد رسمی دارایی',
  },
};

export interface PdfExportOptions {
  pageSize?: 'a4' | 'a5';
  orientation?: 'portrait' | 'landscape';
  documentType?: 'invoice' | 'exit_slip' | 'generic';
  quality?: PdfQualityPreset;
  scale?: number;
  compression?: number;
  marginMm?: number;
  printLayout?: Partial<PrintLayoutSettings>;
  repeatHeaderOnMultipage?: boolean;
  showPageNumbers?: boolean;
  title?: string;
}

function getEffectivePrintLayout(options?: PdfExportOptions): PrintLayoutSettings {
  try {
    const settings = StorageService.getSettings();
    return {
      ...DEFAULT_PRINT_LAYOUT,
      ...(settings?.printLayout || {}),
      ...(options?.printLayout || {}),
    };
  } catch {
    return {
      ...DEFAULT_PRINT_LAYOUT,
      ...(options?.printLayout || {}),
    };
  }
}

function releaseCanvasMemory(canvas: HTMLCanvasElement | null | undefined): void {
  if (!canvas) return;
  try {
    canvas.width = 0;
    canvas.height = 0;
  } catch {}
}

/**
 * Resolves render scale and JPEG compression according to user settings or caller overrides
 */
export function resolvePdfQuality(options?: PdfExportOptions): {
  scale: number;
  compression: number;
  preset: PdfQualityPreset;
  profile: PdfQualityProfile;
} {
  let preset: PdfQualityPreset = 'standard';

  if (options?.quality) {
    preset = options.quality;
  } else {
    try {
      const settings = StorageService.getSettings();
      if (options?.documentType === 'exit_slip') {
        preset = settings?.pdfExitSlipQuality || 'high';
      } else {
        preset = settings?.pdfInvoiceQuality || 'standard';
      }
    } catch {
      preset = options?.documentType === 'exit_slip' ? 'high' : 'standard';
    }
  }

  const profile = PDF_QUALITY_PRESETS[preset] || PDF_QUALITY_PRESETS.standard;
  const scale = options?.scale ?? profile.scale;
  const compression = options?.compression ?? profile.compression;

  return { scale, compression, preset, profile };
}

/**
 * Resolves paper target dimensions (ISO A4/A5 at 96dpi logical base)
 */
function getPaperCanvasMetrics(options?: PdfExportOptions, layout?: PrintLayoutSettings) {
  const effectiveLayout = layout || getEffectivePrintLayout(options);
  const paperSize = options?.pageSize || effectiveLayout.defaultPageSize || 'a4';
  const orientation = options?.orientation || effectiveLayout.defaultOrientation || 'portrait';
  const isLandscape = orientation === 'landscape';
  const isA5 = paperSize === 'a5';

  const defaultMarginMm = isA5 ? 3.5 : 4.5;
  const marginMm =
    options?.marginMm !== undefined
      ? options.marginMm
      : effectiveLayout.pageMarginMm !== undefined
      ? Math.max(2, Math.min(20, effectiveLayout.pageMarginMm))
      : defaultMarginMm;

  let targetWidthPx: number;
  let targetMinHeightPx: number;
  if (isA5) {
    if (isLandscape) {
      targetWidthPx = 900;
      targetMinHeightPx = Math.round(900 * (141 / 203));
    } else {
      targetWidthPx = 620;
      targetMinHeightPx = Math.round(620 * (203 / 141));
    }
  } else {
    if (isLandscape) {
      targetWidthPx = 1180;
      targetMinHeightPx = Math.round(1180 * (201 / 288));
    } else {
      targetWidthPx = 820;
      targetMinHeightPx = Math.round(820 * (288 / 201));
    }
  }

  return { paperSize, orientation, isLandscape, isA5, marginMm, targetWidthPx, targetMinHeightPx, layoutCfg: effectiveLayout };
}

/**
 * Assembles a single or multi-page jsPDF document from a captured canvas, ensuring:
 * 1. Single page fits cleanly with preserved aspect ratio.
 * 2. Multi-page documents optionally repeat the complete header on subsequent pages and split cleanly at row boundaries.
 * 3. Optional Persian page numbers (e.g. "صفحه ۲ از ۳") are stamped neatly at bottom-left.
 * 4. Temporary slice canvases are promptly released to avoid mobile/PWA memory pressure.
 */
export function buildPdfDocumentFromCanvas(
  canvas: HTMLCanvasElement,
  layoutMeta: LayoutMeta,
  options?: PdfExportOptions
): jsPDF {
  const layoutCfg = getEffectivePrintLayout(options);
  const paperSize = options?.pageSize || layoutCfg.defaultPageSize || 'a4';
  const orientation = options?.orientation || layoutCfg.defaultOrientation || 'portrait';
  const isA5 = paperSize === 'a5';
  const marginMm = options?.marginMm !== undefined ? options.marginMm : (isA5 ? 3.5 : 4.5);

  const repeatHeader =
    options?.repeatHeaderOnMultipage ?? layoutCfg.pdfRepeatHeaderOnMultipage ?? true;
  const showPageNumbers =
    options?.showPageNumbers ?? layoutCfg.pdfShowPageNumbers ?? true;

  const pdf = new jsPDF({
    orientation,
    unit: 'mm',
    format: paperSize,
    compress: true,
  });

  try {
    (pdf as any).setR2L?.(true);
    pdf.setProperties({
      title: options?.title || 'سند حسابداری',
      creator: 'سامانه حسابداری سپهر',
      subject: paperSize.toUpperCase() + ' ' + orientation,
    });
  } catch {}

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const usableWidth = pageWidth - marginMm * 2;
  const usableHeight = pageHeight - marginMm * 2;

  const bgColorHex = layoutCfg.pageBgColor && layoutCfg.pageBgColor !== '#ffffff' ? '#ffffff' : '#ffffff';
  const paintPageWhite = () => {
    pdf.setFillColor(255, 255, 255);
    pdf.rect(0, 0, pageWidth, pageHeight, 'F');
  };

  paintPageWhite();

  const { compression: jpegCompression } = resolvePdfQuality(options);

  const pxPerMm = canvas.width / usableWidth;
  const fullPageHeightPx = Math.floor(usableHeight * pxPerMm);

  // Single-page fast path
  if (canvas.height <= fullPageHeightPx * 1.12) {
    paintPageWhite();
    const naturalHeightMm = (canvas.height * usableWidth) / canvas.width;
    const imgData = canvas.toDataURL('image/jpeg', jpegCompression);
    if (naturalHeightMm > usableHeight) {
      const fitScale = usableHeight / naturalHeightMm;
      const scaledWidthMm = usableWidth * fitScale;
      const xOffsetMm = marginMm + (usableWidth - scaledWidthMm) / 2;
      pdf.addImage(imgData, 'JPEG', xOffsetMm, marginMm, scaledWidthMm, usableHeight, undefined, 'FAST');
    } else {
      pdf.addImage(imgData, 'JPEG', marginMm, marginMm, usableWidth, naturalHeightMm, undefined, 'FAST');
    }
    return pdf;
  }

  // Multi-page partitioning
  const scaleRatio = canvas.width / (layoutMeta.rootWidthPx || 1);
  let headerCanvasPx = repeatHeader ? Math.round(layoutMeta.headerBottomPx * scaleRatio) : 0;
  const rowBottomsCanvasPx = layoutMeta.rowBottomsPx.map((y) => Math.round(y * scaleRatio));

  const maxHeaderPx = Math.floor(fullPageHeightPx * 0.55);
  if (headerCanvasPx > maxHeaderPx) {
    headerCanvasPx = maxHeaderPx;
  }

  const hasValidHeader = repeatHeader && headerCanvasPx >= 25;
  const badgeHeightPx = showPageNumbers ? 28 : 0;

  let headerImgData = '';
  let headerHeightMm = 0;

  if (hasValidHeader) {
    const headerCanvas = document.createElement('canvas');
    headerCanvas.width = canvas.width;
    headerCanvas.height = headerCanvasPx;
    const hCtx = headerCanvas.getContext('2d');
    if (hCtx) {
      hCtx.fillStyle = bgColorHex;
      hCtx.fillRect(0, 0, headerCanvas.width, headerCanvas.height);
      hCtx.drawImage(
        canvas,
        0, 0, canvas.width, headerCanvasPx,
        0, 0, canvas.width, headerCanvasPx
      );
      headerImgData = headerCanvas.toDataURL('image/jpeg', jpegCompression);
      headerHeightMm = (headerCanvasPx * usableWidth) / canvas.width;
    }
    releaseCanvasMemory(headerCanvas);
  }

  const contentAvailHeightPx = Math.max(
    120,
    fullPageHeightPx - (hasValidHeader ? headerCanvasPx : 0) - badgeHeightPx
  );

  interface PageSlice {
    startY: number;
    endY: number;
    isFirstPage: boolean;
  }
  const pages: PageSlice[] = [];

  const page1Target = Math.max(120, fullPageHeightPx - badgeHeightPx);
  let page1Cut = page1Target;
  if (rowBottomsCanvasPx.length > 0) {
    const validRows = rowBottomsCanvasPx.filter((rb) => rb > headerCanvasPx && rb <= page1Target);
    if (validRows.length > 0) {
      page1Cut = validRows[validRows.length - 1];
    }
  }
  pages.push({ startY: 0, endY: Math.min(page1Cut, canvas.height), isFirstPage: true });

  let currentY = page1Cut;
  while (currentY < canvas.height) {
    const target = currentY + contentAvailHeightPx;
    if (target >= canvas.height) {
      pages.push({ startY: currentY, endY: canvas.height, isFirstPage: false });
      break;
    }

    let bestCut = target;
    if (rowBottomsCanvasPx.length > 0) {
      const validRows = rowBottomsCanvasPx.filter((rb) => rb > currentY && rb <= target);
      if (validRows.length > 0) {
        bestCut = validRows[validRows.length - 1];
      }
    }

    if (bestCut <= currentY) {
      bestCut = Math.min(target, canvas.height);
    }

    pages.push({ startY: currentY, endY: bestCut, isFirstPage: false });
    currentY = bestCut;
  }

  const totalPages = pages.length;

  for (let i = 0; i < pages.length; i++) {
    if (i > 0) {
      pdf.addPage();
    }
    paintPageWhite();
    const page = pages[i];
    const pageNumText = `صفحه ${toPersianDigits(i + 1)} از ${toPersianDigits(totalPages)}`;

    const sliceContentHeightPx = Math.max(1, page.endY - page.startY);
    const sliceCanvas = document.createElement('canvas');
    sliceCanvas.width = canvas.width;
    sliceCanvas.height = sliceContentHeightPx + badgeHeightPx;
    const sCtx = sliceCanvas.getContext('2d');

    if (sCtx) {
      sCtx.fillStyle = bgColorHex;
      sCtx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
      sCtx.drawImage(
        canvas,
        0, page.startY, canvas.width, sliceContentHeightPx,
        0, 0, canvas.width, sliceContentHeightPx
      );

      if (showPageNumbers) {
        sCtx.fillStyle = '#64748b';
        sCtx.font = "bold 13px 'Vazirmatn', -apple-system, sans-serif";
        sCtx.textAlign = 'left';
        sCtx.fillText(pageNumText, 24, sliceContentHeightPx + 18);
      }

      const sliceImgData = sliceCanvas.toDataURL('image/jpeg', jpegCompression);
      const sliceHeightMm = ((sliceContentHeightPx + badgeHeightPx) * usableWidth) / canvas.width;

      if (page.isFirstPage || !hasValidHeader || !headerImgData) {
        pdf.addImage(sliceImgData, 'JPEG', marginMm, marginMm, usableWidth, sliceHeightMm, undefined, 'FAST');
      } else {
        pdf.addImage(headerImgData, 'JPEG', marginMm, marginMm, usableWidth, headerHeightMm, undefined, 'FAST');
        pdf.addImage(sliceImgData, 'JPEG', marginMm, marginMm + headerHeightMm, usableWidth, sliceHeightMm, undefined, 'FAST');
      }
    }

    releaseCanvasMemory(sliceCanvas);
  }

  return pdf;
}

let cachedExtractedRules: string | null = null;
let lastStyleCacheSignature = '';

/**
 * Extracts all active local CSS rules in document.styleSheets with accurate cache invalidation
 * based on both stylesheet count and cumulative text length.
 * Remote cross-origin stylesheets (such as fonts.googleapis.com) are skipped to guarantee zero network stalls.
 */
function extractActiveStyleSheetRules(): string {
  try {
    const styleTags = Array.from(document.head.querySelectorAll('style'));
    let styleSignatureLen = 0;
    for (const tag of styleTags) {
      if (!tag.id.startsWith('pdf-') && !tag.id.startsWith('dynamic-direct-print')) {
        styleSignatureLen += tag.textContent ? tag.textContent.length : 0;
      }
    }
    const signature = `${document.styleSheets.length}:${styleTags.length}:${styleSignatureLen}`;
    if (cachedExtractedRules !== null && signature === lastStyleCacheSignature) {
      return cachedExtractedRules;
    }

    let combinedCss = '';
    for (const tag of styleTags) {
      if (tag.textContent && !tag.id.startsWith('pdf-') && !tag.id.startsWith('dynamic-direct-print')) {
        combinedCss += tag.textContent + '\n';
      }
    }

    const sheets = Array.from(document.styleSheets);
    for (const sheet of sheets) {
      try {
        if (sheet.ownerNode && (sheet.ownerNode as HTMLElement).tagName === 'STYLE') {
          continue;
        }
        if (sheet.href && !sheet.href.startsWith(window.location.origin)) {
          continue;
        }
        if (sheet.cssRules && sheet.cssRules.length > 0) {
          const rulesCount = sheet.cssRules.length;
          for (let i = 0; i < rulesCount; i++) {
            combinedCss += sheet.cssRules[i].cssText + '\n';
          }
        }
      } catch {
        // Cross-origin stylesheet access throws SecurityError; safely ignore
      }
    }

    cachedExtractedRules = combinedCss;
    lastStyleCacheSignature = signature;
    return combinedCss;
  } catch {
    return '';
  }
}

/**
 * Synchronously copies only same-origin stylesheets into cloned document or print iframe,
 * avoiding duplicate injection of inline <style> tags that are already extracted.
 */
function injectDocumentStylesCleanly(targetHead: HTMLHeadElement): void {
  const extractedRules = extractActiveStyleSheetRules();
  if (extractedRules) {
    const inlineExtractedStyle = targetHead.ownerDocument.createElement('style');
    inlineExtractedStyle.id = 'pdf-inlined-main-rules';
    inlineExtractedStyle.textContent = extractedRules;
    targetHead.appendChild(inlineExtractedStyle);
  }

  const mainLinks = document.head.querySelectorAll('link[rel="stylesheet"]');
  mainLinks.forEach((node) => {
    try {
      const href = (node as HTMLLinkElement).href;
      if (href && href.startsWith(window.location.origin)) {
        targetHead.appendChild(node.cloneNode(true));
      }
    } catch {}
  });
}

/**
 * Robustly configures cloned document and DOM elements for html2canvas PDF rendering.
 * Respects user PrintLayoutSettings (borders, header/zebra colors, padding, fonts)
 * while safeguarding special report layouts (.no-pdf-border, customer statement).
 */
function setupClonedDocumentForPdfCapture(
  clonedDoc: Document,
  clonedElement: HTMLElement,
  element: HTMLElement,
  targetWidthPx: number,
  targetMinHeightPx: number,
  isA5: boolean,
  isLandscape: boolean,
  layoutMeta: LayoutMeta,
  layoutCfg: PrintLayoutSettings
): void {
  if (clonedDoc.defaultView) {
    clonedDoc.defaultView.scrollTo(0, 0);
  }

  const pageBg = layoutCfg.pageBgColor || '#ffffff';
  const paperSize = isA5 ? 'a5' : 'a4';
  const orientation = isLandscape ? 'landscape' : 'portrait';
  const isBorderless =
    clonedElement.id === 'invoices-slips-pdf-report-canvas' ||
    clonedElement.classList.contains('no-pdf-border') ||
    element.id === 'invoices-slips-pdf-report-canvas' ||
    element.classList.contains('no-pdf-border');

  const isCustomerStatementPdf =
    clonedElement.id === 'printable-customer-statement-pdf' ||
    clonedElement.id === 'printable-public-customer-statement-pdf' ||
    element.id === 'printable-customer-statement-pdf' ||
    element.id === 'printable-public-customer-statement-pdf';

  const effectiveBg = isBorderless || isCustomerStatementPdf ? '#ffffff' : pageBg;

  if (clonedDoc.documentElement) {
    clonedDoc.documentElement.style.setProperty('background-color', '#ffffff', 'important');
    clonedDoc.documentElement.style.setProperty('background', '#ffffff', 'important');
  }
  if (clonedDoc.body) {
    clonedDoc.body.style.setProperty('background-color', '#ffffff', 'important');
    clonedDoc.body.style.setProperty('background', '#ffffff', 'important');
  }

  // Apply computed --print-* CSS custom properties on clonedElement (preserving any inline overrides on element)
  if (!isBorderless && !isCustomerStatementPdf) {
    const cssVars = getPrintLayoutCssVariables(layoutCfg, paperSize, orientation) as Record<string, string>;
    Object.entries(cssVars).forEach(([prop, val]) => {
      if (prop.startsWith('--print-') && !element.style.getPropertyValue(prop)) {
        clonedElement.style.setProperty(prop, val);
      }
    });
  }

  clonedElement.style.setProperty('background-color', effectiveBg, 'important');
  clonedElement.style.setProperty('background', effectiveBg, 'important');

  // 1. Clean single-pass stylesheet injection (no redundant duplicates, no remote font waits)
  injectDocumentStylesCleanly(clonedDoc.head);

  // 2. Scoped PDF print rules honoring user layout customization
  const pdfFixStyle = clonedDoc.createElement('style');
  pdfFixStyle.id = 'pdf-cloned-fix-styles-bulletproof';
  pdfFixStyle.textContent = `
    ${getPrintLayoutCssRules(undefined, layoutCfg)}

    html, body {
      background-color: #ffffff !important;
      background: #ffffff !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    *, *::before, *::after {
      box-sizing: border-box !important;
    }

    #invoices-slips-pdf-report-canvas,
    #invoices-slips-pdf-report-canvas *,
    .no-pdf-border,
    .no-pdf-border * {
      border: none !important;
      border-width: 0 !important;
      border-style: none !important;
      border-color: transparent !important;
      box-shadow: none !important;
      outline: none !important;
    }

    #printable-customer-statement-pdf,
    #printable-public-customer-statement-pdf {
      border: none !important;
      box-shadow: none !important;
      outline: none !important;
      background-color: #ffffff !important;
      background: #ffffff !important;
    }
    #printable-customer-statement-pdf *:not(.pdf-table-col-header-row):not(.pdf-table-col-header-cell),
    #printable-public-customer-statement-pdf *:not(.pdf-table-col-header-row):not(.pdf-table-col-header-cell) {
      background-color: #ffffff !important;
      background: #ffffff !important;
    }
    #printable-customer-statement-pdf table,
    #printable-public-customer-statement-pdf table {
      border: none !important;
    }
    #printable-customer-statement-pdf tr.pdf-doc-header-row,
    #printable-customer-statement-pdf tr.pdf-doc-header-row > th,
    #printable-public-customer-statement-pdf tr.pdf-doc-header-row,
    #printable-public-customer-statement-pdf tr.pdf-doc-header-row > th {
      border: none !important;
      border-width: 0 !important;
      background-color: #ffffff !important;
    }
    #printable-customer-statement-pdf thead tr:not(.pdf-doc-header-row),
    #printable-customer-statement-pdf thead tr:not(.pdf-doc-header-row) th,
    #printable-public-customer-statement-pdf thead tr:not(.pdf-doc-header-row),
    #printable-public-customer-statement-pdf thead tr:not(.pdf-doc-header-row) th {
      background-color: #e2e8f0 !important;
      background: #e2e8f0 !important;
      border: 1px solid #64748b !important;
      height: 40px !important;
      min-height: 40px !important;
    }

    p, span, div, td, th, h1, h2, h3, h4, h5, h6, strong, b, em {
      opacity: 1 !important;
      visibility: visible !important;
      letter-spacing: normal !important;
      font-feature-settings: "liga" 1, "calt" 1 !important;
      text-rendering: optimizeLegibility !important;
    }

    .item-description, [data-item-description="true"], .product-description {
      letter-spacing: normal !important;
      word-spacing: normal !important;
      font-feature-settings: "liga" 1, "calt" 1 !important;
      text-rendering: optimizeLegibility !important;
      direction: rtl !important;
      text-align: right !important;
      font-family: 'Vazirmatn', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
    }

    .pdf-hide-on-capture,
    .no-pdf {
      display: none !important;
    }
    .pdf-show-on-capture {
      display: block !important;
    }
  `;
  clonedDoc.head.appendChild(pdfFixStyle);

  // 3. DOM Isolation: Hide non-target sibling subtrees in clonedDoc.body for maximum capture speed
  if (element.id && element.id.startsWith('telegram-offscreen-')) {
    clonedElement.style.setProperty('opacity', '1', 'important');
    clonedElement.style.setProperty('visibility', 'visible', 'important');
    clonedElement.style.setProperty('z-index', '999999', 'important');
    clonedElement.style.setProperty('position', 'relative', 'important');
    clonedElement.style.setProperty('left', 'auto', 'important');
    clonedElement.style.setProperty('top', 'auto', 'important');
  }

  Array.from(clonedDoc.body.children).forEach((child) => {
    if (child !== clonedElement && !child.contains(clonedElement)) {
      (child as HTMLElement).style.setProperty('display', 'none', 'important');
    }
  });

  // 4. Strip interactive UI buttons and .no-print / .no-pdf controls
  const elementsToHide = clonedElement.querySelectorAll(
    '.no-print, .no-pdf, button, [data-html2canvas-ignore="true"]'
  );
  elementsToHide.forEach((el) => {
    (el as HTMLElement).style.setProperty('display', 'none', 'important');
    (el as HTMLElement).style.setProperty('visibility', 'hidden', 'important');
  });

  // 5. Dimensions & single-page vs multi-page balancing
  const naturalHeight = element.scrollHeight;
  const isSinglePageMode = naturalHeight <= targetMinHeightPx * 1.12;

  if (isSinglePageMode) {
    clonedElement.style.setProperty('min-height', `${targetMinHeightPx}px`, 'important');
    clonedElement.style.setProperty('height', `${targetMinHeightPx}px`, 'important');
    clonedElement.style.setProperty('max-height', `${targetMinHeightPx}px`, 'important');
    clonedElement.style.setProperty('display', 'flex', 'important');
    clonedElement.style.setProperty('flex-direction', 'column', 'important');
    clonedElement.style.setProperty('justify-content', 'space-between', 'important');
  } else {
    clonedElement.style.setProperty('height', 'auto', 'important');
    clonedElement.style.setProperty('min-height', `${targetMinHeightPx}px`, 'important');
    clonedElement.style.setProperty('display', 'flex', 'important');
    clonedElement.style.setProperty('flex-direction', 'column', 'important');
  }

  clonedElement.style.setProperty('align-self', 'flex-start', 'important');
  clonedElement.style.setProperty('position', 'relative', 'important');
  clonedElement.style.setProperty('left', '0px', 'important');
  clonedElement.style.setProperty('top', '0px', 'important');
  clonedElement.style.setProperty('transform', 'none', 'important');
  clonedElement.style.setProperty('visibility', 'visible', 'important');
  clonedElement.style.setProperty('opacity', '1', 'important');
  clonedElement.style.setProperty('z-index', '1', 'important');
  clonedElement.style.setProperty('overflow', 'visible', 'important');
  clonedElement.style.setProperty('width', `${targetWidthPx}px`, 'important');
  clonedElement.style.setProperty('max-width', `${targetWidthPx}px`, 'important');
  clonedElement.style.setProperty('min-width', `${targetWidthPx}px`, 'important');
  clonedElement.style.setProperty('box-sizing', 'border-box', 'important');
  clonedElement.style.setProperty('box-shadow', 'none', 'important');
  clonedElement.style.setProperty('background-color', effectiveBg, 'important');
  clonedElement.style.setProperty('background', effectiveBg, 'important');
  clonedElement.style.setProperty('direction', 'rtl', 'important');

  clonedElement.style.setProperty('font-family', "'Vazirmatn', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", 'important');
  clonedElement.style.setProperty('letter-spacing', 'normal', 'important');
  clonedElement.style.setProperty('word-spacing', 'normal', 'important');
  clonedElement.style.setProperty('font-feature-settings', "'liga' 1, 'calt' 1", 'important');
  clonedElement.style.setProperty('text-rendering', 'optimizeLegibility', 'important');

  const allTextElements = clonedElement.querySelectorAll('*');
  allTextElements.forEach((node) => {
    const el = node as HTMLElement;
    el.style.setProperty('letter-spacing', 'normal', 'important');
    el.style.setProperty('font-feature-settings', "'liga' 1, 'calt' 1", 'important');
    if (!el.classList.contains('font-mono') && !el.classList.contains('font-plate')) {
      el.style.setProperty('font-family', "'Vazirmatn', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", 'important');
    }
  });

  // Arabic / Persian glyph shaping for crisp html2canvas text rendering
  shapeClonedElementText(clonedElement);

  const rootLayouts = clonedElement.querySelectorAll(
    '.standard-exit-slip-layout, .simple-exit-slip-layout, .standard-invoice-layout, .simple-invoice-layout'
  );
  rootLayouts.forEach((rl) => {
    const rlel = rl as HTMLElement;
    rlel.style.setProperty('height', '100%', 'important');
    rlel.style.setProperty('min-height', '100%', 'important');
    rlel.style.setProperty('display', 'flex', 'important');
    rlel.style.setProperty('flex-direction', 'column', 'important');
    rlel.style.setProperty('justify-content', 'space-between', 'important');
    rlel.style.setProperty('width', '100%', 'important');
  });

  if (isSinglePageMode) {
    const tableBoxes = clonedElement.querySelectorAll(
      '.exit-slip-table-box, .invoice-table-box, .simple-invoice-table-box, .pdf-statement-top-group'
    );
    tableBoxes.forEach((tb) => {
      const tbel = tb as HTMLElement;
      tbel.style.setProperty('flex', '1 1 auto', 'important');
      tbel.style.setProperty('display', 'flex', 'important');
      tbel.style.setProperty('flex-direction', 'column', 'important');
      tbel.style.setProperty('justify-content', 'flex-start', 'important');
      tbel.style.setProperty('margin-top', '0px', 'important');
      tbel.style.setProperty('margin-bottom', 'auto', 'important');
      tbel.style.setProperty('width', '100%', 'important');
    });
  }

  const statementFooterGroup = clonedElement.querySelector('.pdf-statement-footer-group');
  if (statementFooterGroup) {
    const sfgEl = statementFooterGroup as HTMLElement;
    sfgEl.style.setProperty('margin-top', 'auto', 'important');
    sfgEl.style.setProperty('width', '100%', 'important');
  }

  const headerRow = clonedElement.querySelector('.exit-slip-header-row');
  if (headerRow) {
    (headerRow as HTMLElement).style.setProperty('display', 'flex', 'important');
    (headerRow as HTMLElement).style.setProperty('flex-direction', 'row', 'important');
    (headerRow as HTMLElement).style.setProperty('align-items', 'flex-start', 'important');
    (headerRow as HTMLElement).style.setProperty('justify-content', 'space-between', 'important');
  }

  const metaGrid = clonedElement.querySelector('.exit-slip-meta-grid');
  if (metaGrid) {
    (metaGrid as HTMLElement).style.setProperty('display', 'grid', 'important');
    (metaGrid as HTMLElement).style.setProperty('grid-template-columns', 'repeat(3, minmax(0, auto))', 'important');
    (metaGrid as HTMLElement).style.setProperty('gap', '4px 10px', 'important');
  }

  // Unconstrain overflow containers
  let cur: HTMLElement | null = clonedElement.parentElement;
  while (cur && cur !== clonedDoc.body) {
    cur.style.setProperty('overflow', 'visible', 'important');
    cur.style.setProperty('max-height', 'none', 'important');
    cur.style.setProperty('height', 'auto', 'important');
    cur.style.setProperty('position', 'static', 'important');
    cur.style.setProperty('transform', 'none', 'important');
    cur = cur.parentElement;
  }

  if (clonedDoc.body) {
    clonedDoc.body.style.setProperty('overflow', 'visible', 'important');
    clonedDoc.body.style.setProperty('max-height', 'none', 'important');
    clonedDoc.body.style.setProperty('height', 'auto', 'important');
    clonedDoc.body.style.setProperty('position', 'static', 'important');
    clonedDoc.body.style.setProperty('margin', '0', 'important');
    clonedDoc.body.style.setProperty('padding', '0', 'important');
  }
  if (clonedDoc.documentElement) {
    clonedDoc.documentElement.style.setProperty('overflow', 'visible', 'important');
    clonedDoc.documentElement.style.setProperty('max-height', 'none', 'important');
    clonedDoc.documentElement.style.setProperty('height', 'auto', 'important');
  }

  const scrollContainers = clonedElement.querySelectorAll('.overflow-x-auto, .overflow-y-auto, [class*="overflow"]');
  scrollContainers.forEach((el) => {
    (el as HTMLElement).style.setProperty('overflow', 'visible', 'important');
    (el as HTMLElement).style.setProperty('max-height', 'none', 'important');
    (el as HTMLElement).style.setProperty('height', 'auto', 'important');
  });

  // 6. Apply table styling respecting PrintLayoutSettings OR special report flags
  if (isBorderless || isCustomerStatementPdf) {
    clonedElement.style.setProperty('border', 'none', 'important');
    clonedElement.style.setProperty('border-width', '0', 'important');
    clonedElement.style.setProperty('border-color', 'transparent', 'important');
    clonedElement.style.setProperty('box-shadow', 'none', 'important');
    clonedElement.style.setProperty('outline', 'none', 'important');
  }

  const scaleRatio = isA5 ? (isLandscape ? 0.88 : 0.85) : (isLandscape ? 0.96 : 1.0);
  const compactFactor = layoutCfg.compactMode ? 0.82 : 1.0;
  const baseMinRow = layoutCfg.tableRowMinHeight
    ? Math.max(18, Math.round(layoutCfg.tableRowMinHeight * scaleRatio * compactFactor))
    : isA5
    ? isLandscape
      ? 24
      : 28
    : isLandscape
    ? 32
    : 36;

  const borderColor = layoutCfg.tableBorderColor || '#cbd5e1';
  const borderWidth = `${Math.max(0.5, Math.min(3, layoutCfg.tableBorderWidth ?? 1))}px`;
  const borderStyle = layoutCfg.tableBorderStyle || 'bordered';
  const headerBg = layoutCfg.tableHeaderBg || '#f1f5f9';
  const headerTextColor = layoutCfg.tableHeaderTextColor || '#0f172a';
  const bodyBg = layoutCfg.tableBodyBg || '#ffffff';
  const zebraEnabled = layoutCfg.tableZebraStriping !== false || borderStyle === 'striped';
  const zebraBg = zebraEnabled ? (layoutCfg.tableZebraBg || '#f8fafc') : bodyBg;

  const tables = clonedElement.querySelectorAll('table');
  tables.forEach((tbl) => {
    const tblEl = tbl as HTMLElement;
    const hasDocHeaderRow = Boolean(tblEl.querySelector('.pdf-doc-header-row'));
    const tblNoBorder =
      isBorderless ||
      isCustomerStatementPdf ||
      hasDocHeaderRow ||
      tblEl.classList.contains('no-pdf-border');

    tblEl.style.setProperty('width', '100%', 'important');
    tblEl.style.setProperty('min-width', '100%', 'important');
    tblEl.style.setProperty('table-layout', 'auto', 'important');
    tblEl.style.setProperty('border-collapse', 'collapse', 'important');

    if (tblNoBorder) {
      tblEl.style.setProperty('border', 'none', 'important');
      tblEl.style.setProperty('border-width', '0', 'important');
      tblEl.style.setProperty('border-color', 'transparent', 'important');
      tblEl.style.setProperty('box-shadow', 'none', 'important');
      tblEl.style.setProperty('outline', 'none', 'important');
    } else if (borderStyle === 'minimal') {
      tblEl.style.setProperty('border', 'none', 'important');
    } else if (borderStyle === 'striped') {
      tblEl.style.setProperty('border-top', `${borderWidth} solid ${borderColor}`, 'important');
      tblEl.style.setProperty('border-bottom', `${borderWidth} solid ${borderColor}`, 'important');
      tblEl.style.setProperty('border-left', 'none', 'important');
      tblEl.style.setProperty('border-right', 'none', 'important');
    } else {
      tblEl.style.setProperty('border', `${borderWidth} solid ${borderColor}`, 'important');
    }

    tblEl.querySelectorAll('thead th, th').forEach((th) => {
      const thEl = th as HTMLElement;
      const isDocHeaderCell =
        thEl.classList.contains('pdf-doc-header-cell') ||
        Boolean(thEl.closest('.pdf-doc-header-row'));
      thEl.style.setProperty('vertical-align', 'middle', 'important');
      thEl.style.setProperty('box-sizing', 'border-box', 'important');
      if (isBorderless || isDocHeaderCell || thEl.classList.contains('no-pdf-border')) {
        thEl.style.setProperty('border', 'none', 'important');
        thEl.style.setProperty('border-width', '0', 'important');
        thEl.style.setProperty('border-color', 'transparent', 'important');
        thEl.style.setProperty('box-shadow', 'none', 'important');
        thEl.style.setProperty('outline', 'none', 'important');
        if (isDocHeaderCell) {
          thEl.style.setProperty('background-color', '#ffffff', 'important');
          thEl.style.setProperty('background', '#ffffff', 'important');
        }
      } else if (isCustomerStatementPdf) {
        thEl.style.setProperty('border', '1px solid #64748b', 'important');
        thEl.style.setProperty('background-color', '#e2e8f0', 'important');
        thEl.style.setProperty('background', '#e2e8f0', 'important');
        thEl.style.setProperty('color', '#0f172a', 'important');
        thEl.style.setProperty('height', '40px', 'important');
        thEl.style.setProperty('min-height', '40px', 'important');
      } else {
        thEl.style.setProperty('background-color', headerBg, 'important');
        thEl.style.setProperty('background', headerBg, 'important');
        thEl.style.setProperty('color', headerTextColor, 'important');
        if (borderStyle === 'minimal' || borderStyle === 'modern') {
          thEl.style.setProperty('border-left', 'none', 'important');
          thEl.style.setProperty('border-right', 'none', 'important');
          thEl.style.setProperty('border-top', borderStyle === 'modern' ? `${borderWidth} solid ${borderColor}` : 'none', 'important');
          thEl.style.setProperty('border-bottom', `2px solid ${layoutCfg.themeColor || borderColor}`, 'important');
        } else if (borderStyle === 'striped') {
          thEl.style.setProperty('border-left', 'none', 'important');
          thEl.style.setProperty('border-right', 'none', 'important');
          thEl.style.setProperty('border-top', `${borderWidth} solid ${borderColor}`, 'important');
          thEl.style.setProperty('border-bottom', `${borderWidth} solid ${borderColor}`, 'important');
        } else {
          thEl.style.setProperty('border', `${borderWidth} solid ${borderColor}`, 'important');
        }
      }
      thEl.style.setProperty('opacity', '1', 'important');
      thEl.style.setProperty('visibility', 'visible', 'important');
    });

    tblEl.querySelectorAll('tbody tr').forEach((tr, rowIdx) => {
      const trEl = tr as HTMLElement;
      trEl.style.setProperty('height', 'auto', 'important');
      trEl.style.setProperty('min-height', `${baseMinRow}px`, 'important');
      trEl.style.setProperty('page-break-inside', 'avoid', 'important');
      trEl.style.setProperty('break-inside', 'avoid', 'important');

      if (!isBorderless && !isCustomerStatementPdf) {
        const rowBg = rowIdx % 2 === 1 ? zebraBg : bodyBg;
        trEl.style.setProperty('background-color', rowBg, 'important');
        trEl.style.setProperty('background', rowBg, 'important');
      }

      if (isBorderless) {
        trEl.style.setProperty('border', 'none', 'important');
        trEl.style.setProperty('border-width', '0', 'important');
        trEl.style.setProperty('border-color', 'transparent', 'important');
      }

      trEl.querySelectorAll('td').forEach((td) => {
        const tdEl = td as HTMLElement;
        tdEl.style.setProperty('height', `${baseMinRow}px`, 'important');
        tdEl.style.setProperty('min-height', `${baseMinRow}px`, 'important');
        tdEl.style.setProperty('vertical-align', 'middle', 'important');
        tdEl.style.setProperty('box-sizing', 'border-box', 'important');
        if (isBorderless || tdEl.classList.contains('no-pdf-border')) {
          tdEl.style.setProperty('border', 'none', 'important');
          tdEl.style.setProperty('border-width', '0', 'important');
          tdEl.style.setProperty('border-color', 'transparent', 'important');
          tdEl.style.setProperty('box-shadow', 'none', 'important');
          tdEl.style.setProperty('outline', 'none', 'important');
        } else if (isCustomerStatementPdf) {
          tdEl.style.setProperty('border', '1px solid #cbd5e1', 'important');
        } else if (borderStyle === 'striped' || borderStyle === 'minimal' || borderStyle === 'modern') {
          tdEl.style.setProperty('border-left', 'none', 'important');
          tdEl.style.setProperty('border-right', 'none', 'important');
          tdEl.style.setProperty('border-top', 'none', 'important');
          tdEl.style.setProperty('border-bottom', `${borderWidth} solid ${borderColor}`, 'important');
        } else {
          tdEl.style.setProperty('border', `${borderWidth} solid ${borderColor}`, 'important');
        }
        tdEl.style.setProperty('line-height', '1.4', 'important');
        tdEl.style.setProperty('word-break', 'break-word', 'important');
        tdEl.style.setProperty('overflow-wrap', 'break-word', 'important');
        tdEl.style.setProperty('overflow', 'visible', 'important');
        tdEl.style.setProperty('opacity', '1', 'important');
        tdEl.style.setProperty('visibility', 'visible', 'important');

        tdEl.querySelectorAll('*').forEach((child) => {
          const cEl = child as HTMLElement;
          cEl.style.setProperty('overflow', 'visible', 'important');
          cEl.style.setProperty('max-height', 'none', 'important');
          cEl.style.setProperty('line-height', '1.4', 'important');
          cEl.style.setProperty('opacity', '1', 'important');
          cEl.style.setProperty('visibility', 'visible', 'important');
          if (isBorderless) {
            cEl.style.setProperty('border', 'none', 'important');
            cEl.style.setProperty('border-width', '0', 'important');
            cEl.style.setProperty('box-shadow', 'none', 'important');
            cEl.style.setProperty('outline', 'none', 'important');
          }
        });
      });
    });

    tblEl.querySelectorAll('tfoot td, tfoot tr').forEach((tf) => {
      const tfEl = tf as HTMLElement;
      if (isBorderless) {
        tfEl.style.setProperty('border', 'none', 'important');
        tfEl.style.setProperty('border-width', '0', 'important');
        tfEl.style.setProperty('border-color', 'transparent', 'important');
        tfEl.style.setProperty('box-shadow', 'none', 'important');
        tfEl.style.setProperty('outline', 'none', 'important');
      }
    });
  });

  const sigs = clonedElement.querySelector('.exit-slip-signatures, .export-report-signatures');
  if (sigs) {
    (sigs as HTMLElement).style.setProperty('display', 'grid', 'important');
    (sigs as HTMLElement).style.setProperty('grid-template-columns', 'repeat(3, minmax(0, 1fr))', 'important');
    (sigs as HTMLElement).style.setProperty('gap', '10px', 'important');
  }

  const infoDeck = clonedElement.querySelector('.exit-slip-info-deck');
  if (infoDeck) {
    (infoDeck as HTMLElement).style.setProperty('display', 'grid', 'important');
    (infoDeck as HTMLElement).style.setProperty('grid-template-columns', 'repeat(2, minmax(0, 1fr))', 'important');
    (infoDeck as HTMLElement).style.setProperty('gap', '10px', 'important');
  }

  const termsGrid = clonedElement.querySelector('.exit-slip-terms-grid');
  if (termsGrid) {
    (termsGrid as HTMLElement).style.setProperty('display', 'grid', 'important');
    (termsGrid as HTMLElement).style.setProperty('grid-template-columns', 'repeat(2, minmax(0, 1fr))', 'important');
  }

  // 7. Measure layout metadata for accurate multi-page header repetition and row slicing
  const rootRect = clonedElement.getBoundingClientRect();
  layoutMeta.rootWidthPx = rootRect.width || clonedElement.offsetWidth || targetWidthPx;

  const theadEl = clonedElement.querySelector('table thead') as HTMLElement | null;
  const explicitHeaderEl = clonedElement.querySelector(
    '[data-pdf-header="true"], .export-report-header, .invoice-header, .exit-slip-header, .exit-slip-header-row'
  ) as HTMLElement | null;

  if (theadEl) {
    const theadRect = theadEl.getBoundingClientRect();
    layoutMeta.headerBottomPx = Math.max(0, theadRect.bottom - rootRect.top);
  } else if (explicitHeaderEl) {
    const hRect = explicitHeaderEl.getBoundingClientRect();
    layoutMeta.headerBottomPx = Math.max(0, hRect.bottom - rootRect.top);
  }

  const trList = Array.from(clonedElement.querySelectorAll('table tbody tr')) as HTMLElement[];
  layoutMeta.rowBottomsPx = trList.map((tr) => {
    const rRect = tr.getBoundingClientRect();
    return Math.max(0, rRect.bottom - rootRect.top);
  });

  const footerEl = clonedElement.querySelector(
    'table tfoot, .export-report-signatures, .exit-slip-signatures, .invoice-signatures, [data-pdf-footer="true"]'
  ) as HTMLElement | null;
  if (footerEl) {
    const fRect = footerEl.getBoundingClientRect();
    layoutMeta.footerTopPx = Math.max(0, fRect.top - rootRect.top);
  }
}

/**
 * Shared capture pipeline used by both exportElementToPdf and generatePdfBlob.
 */
async function captureElementToPdfInstance(
  element: HTMLElement,
  filename: string,
  options?: PdfExportOptions
): Promise<jsPDF> {
  const {
    paperSize,
    orientation,
    isLandscape,
    isA5,
    marginMm,
    targetWidthPx,
    targetMinHeightPx,
    layoutCfg,
  } = getPaperCanvasMetrics(options);

  const { scale: renderScale } = resolvePdfQuality(options);

  const layoutMeta: LayoutMeta = {
    headerBottomPx: 0,
    rowBottomsPx: [],
    footerTopPx: 0,
    rootWidthPx: targetWidthPx,
  };

  if (document.fonts) {
    try {
      await Promise.race([
        document.fonts.ready,
        new Promise((resolve) => setTimeout(resolve, 100)),
      ]);
    } catch {}
  }

  const canvas = await html2canvas(element, {
    scale: renderScale,
    useCORS: true,
    allowTaint: false,
    logging: false,
    imageTimeout: 2000,
    backgroundColor: '#ffffff',
    windowWidth: Math.max(1280, targetWidthPx + 200),
    windowHeight: Math.max(1200, Math.ceil(element.scrollHeight + 400)),
    onclone: (clonedDoc, clonedElement) => {
      setupClonedDocumentForPdfCapture(
        clonedDoc,
        clonedElement,
        element,
        targetWidthPx,
        targetMinHeightPx,
        isA5,
        isLandscape,
        layoutMeta,
        layoutCfg
      );
    },
  });

  try {
    return buildPdfDocumentFromCanvas(canvas, layoutMeta, {
      ...options,
      pageSize: paperSize,
      orientation,
      marginMm,
      printLayout: layoutCfg,
      title: options?.title || filename.replace(/\.pdf$/i, ''),
    });
  } finally {
    releaseCanvasMemory(canvas);
  }
}

/**
 * Exports a DOM element to a downloadable PDF file with user quality & layout settings.
 */
export const exportElementToPdf = async (
  elementId: string,
  filename: string,
  options?: PdfExportOptions
): Promise<{ success: boolean; error?: string }> => {
  const element = document.getElementById(elementId);
  if (!element) {
    return { success: false, error: 'عنصر مورد نظر جهت تولید PDF یافت نشد.' };
  }

  try {
    const pdf = await captureElementToPdfInstance(element, filename, options);
    const safeFilename = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;
    pdf.save(safeFilename);
    return { success: true };
  } catch (err: any) {
    console.error('PDF export error:', err);
    return { success: false, error: err?.message || 'خطا در تبدیل و دانلود PDF' };
  }
};

/**
 * Generates an optimized PDF Blob and File for Web Share API, Telegram bot upload, or previewing.
 */
export const generatePdfBlob = async (
  elementId: string,
  filename: string,
  options?: PdfExportOptions
): Promise<{ success: boolean; blob?: Blob; file?: File; error?: string }> => {
  const element = document.getElementById(elementId);
  if (!element) {
    return { success: false, error: 'عنصر مورد نظر جهت تولید PDF یافت نشد.' };
  }

  try {
    const pdf = await captureElementToPdfInstance(element, filename, options);
    const safeFilename = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;
    const blob = pdf.output('blob');
    let file: File | undefined;
    try {
      file = new File([blob], safeFilename, { type: 'application/pdf' });
    } catch {}
    return { success: true, blob, file };
  } catch (err: any) {
    console.error('PDF generation error:', err);
    return { success: false, error: err?.message || 'خطا در ایجاد فایل PDF' };
  }
};

/**
 * Triggers direct vector browser printing with clean @page scoping and afterprint cleanup.
 */
export const printElementDirectly = (
  elementId: string,
  options?: PdfExportOptions
): boolean => {
  const layoutCfg = getEffectivePrintLayout(options);
  const paperSize = options?.pageSize || layoutCfg.defaultPageSize || 'a4';
  const orientation = options?.orientation || layoutCfg.defaultOrientation || 'portrait';
  const marginMm =
    options?.marginMm !== undefined
      ? options.marginMm
      : layoutCfg.pageMarginMm || (paperSize === 'a5' ? 4 : 6);

  const element = document.getElementById(elementId);
  if (!element) {
    try {
      window.print();
      return true;
    } catch {
      return false;
    }
  }

  try {
    const existingStyle = document.getElementById('dynamic-direct-print-page-style');
    if (existingStyle) existingStyle.remove();

    const styleEl = document.createElement('style');
    styleEl.id = 'dynamic-direct-print-page-style';
    styleEl.textContent = `
      ${getPrintLayoutCssRules('#' + elementId, layoutCfg)}
      @media print {
        body.printing-active-element #${elementId},
        body.printing-active-element #${elementId} * {
          visibility: visible !important;
        }
        body.printing-active-element #${elementId} {
          position: absolute !important;
          left: 0 !important;
          top: 0 !important;
          width: 100% !important;
          max-width: 100% !important;
          margin: 0 !important;
          border: none !important;
          box-shadow: none !important;
        }
        @page {
          size: ${paperSize.toUpperCase()} ${orientation} !important;
          margin: ${marginMm}mm !important;
        }
        thead {
          display: table-header-group !important;
        }
        tfoot {
          display: table-footer-group !important;
        }
        tr {
          page-break-inside: avoid !important;
          break-inside: avoid !important;
        }
        table {
          page-break-inside: auto !important;
          break-inside: auto !important;
        }
      }
    `;
    document.head.appendChild(styleEl);
    document.body.classList.add('printing-active-element');

    let cleaned = false;
    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      styleEl.remove();
      document.body.classList.remove('printing-active-element');
      window.removeEventListener('afterprint', cleanup);
    };

    window.addEventListener('afterprint', cleanup, { once: true });
    setTimeout(cleanup, 60000);

    window.print();
    return true;
  } catch (err) {
    console.warn('Direct print error:', err);
    document.body.classList.remove('printing-active-element');
    return false;
  }
};

/**
 * Modern Zero-Popup Vector Print Engine using a hidden same-origin print <iframe>.
 * Works reliably inside sandboxed iframes, PWAs, and strict popup-blocker browsers,
 * preserves local Vazirmatn fonts & user PrintLayoutSettings, and cleans up automatically.
 */
export const printElementViaIframe = (
  elementId: string,
  title: string,
  options?: PdfExportOptions
): boolean => {
  const element = document.getElementById(elementId);
  if (!element) return false;

  const layoutCfg = getEffectivePrintLayout(options);
  const paperSize = options?.pageSize || layoutCfg.defaultPageSize || 'a4';
  const orientation = options?.orientation || layoutCfg.defaultOrientation || 'portrait';
  const marginMm =
    options?.marginMm !== undefined
      ? options.marginMm
      : layoutCfg.pageMarginMm || (paperSize === 'a5' ? 4 : 6);

  try {
    const existingFrame = document.getElementById('sepehr-hidden-print-iframe');
    if (existingFrame) existingFrame.remove();

    const iframe = document.createElement('iframe');
    iframe.id = 'sepehr-hidden-print-iframe';
    iframe.setAttribute('aria-hidden', 'true');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '1px';
    iframe.style.height = '1px';
    iframe.style.opacity = '0';
    iframe.style.pointerEvents = 'none';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
    const iframeWin = iframe.contentWindow;
    if (!iframeDoc || !iframeWin) {
      iframe.remove();
      return printElementDirectly(elementId, options);
    }

    const extractedCss = extractActiveStyleSheetRules();
    const localLinksHtml = Array.from(document.head.querySelectorAll('link[rel="stylesheet"]'))
      .filter((lnk) => {
        const href = (lnk as HTMLLinkElement).href;
        return href && href.startsWith(window.location.origin);
      })
      .map((lnk) => lnk.outerHTML)
      .join('\n');

    const cssVars = getPrintLayoutCssVariables(layoutCfg, paperSize, orientation) as Record<string, string>;
    const varsStyleString = Object.entries(cssVars)
      .map(([k, v]) => `${k}: ${v}`)
      .join('; ');

    const clone = element.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('.no-print, .no-pdf, button, [data-html2canvas-ignore="true"]').forEach((el) => el.remove());

    const safeTitle = String(title || 'چاپ سند').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const targetBg = layoutCfg.pageBgColor || '#ffffff';

    iframeDoc.open();
    iframeDoc.write(`<!DOCTYPE html>
<html dir="rtl" lang="fa">
<head>
  <meta charset="utf-8" />
  <title>${safeTitle}</title>
  ${localLinksHtml}
  <style>${extractedCss}</style>
  <style>
    ${getPrintLayoutCssRules('.iframe-print-wrapper, #' + elementId, layoutCfg)}
    * {
      box-sizing: border-box;
      font-family: 'Vazirmatn', -apple-system, BlinkMacSystemFont, sans-serif !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    html, body {
      margin: 0 !important;
      padding: 0 !important;
      background: ${targetBg} !important;
      background-color: ${targetBg} !important;
      direction: rtl !important;
      color: #0f172a;
    }
    .iframe-print-wrapper {
      width: 100% !important;
      max-width: 100% !important;
      margin: 0 !important;
      padding: 0 !important;
      background: ${targetBg} !important;
      border: none !important;
      box-shadow: none !important;
    }
    .no-print, .no-pdf, button, [data-html2canvas-ignore="true"] {
      display: none !important;
    }
    @page {
      size: ${paperSize.toUpperCase()} ${orientation};
      margin: ${marginMm}mm;
    }
    @media print {
      html, body {
        width: 100% !important;
        margin: 0 !important;
        padding: 0 !important;
      }
      thead {
        display: table-header-group !important;
      }
      tfoot {
        display: table-footer-group !important;
      }
      tr {
        page-break-inside: avoid !important;
        break-inside: avoid !important;
      }
      table {
        page-break-inside: auto !important;
        break-inside: auto !important;
      }
    }
  </style>
</head>
<body dir="rtl">
  <div class="iframe-print-wrapper" style="${varsStyleString}"></div>
</body>
</html>`);
    iframeDoc.close();

    const wrapper = iframeDoc.querySelector('.iframe-print-wrapper');
    if (wrapper) {
      wrapper.appendChild(iframeDoc.importNode(clone, true));
    }

    let cleaned = false;
    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      try {
        iframeWin.removeEventListener('afterprint', cleanup);
        iframe.remove();
      } catch {}
    };

    iframeWin.addEventListener('afterprint', cleanup, { once: true });
    setTimeout(cleanup, 60000);

    const runPrint = async () => {
      try {
        if (iframeDoc.fonts?.ready) {
          await Promise.race([iframeDoc.fonts.ready, new Promise((r) => setTimeout(r, 150))]);
        }
        const imgs = Array.from(iframeDoc.querySelectorAll('img'));
        if (imgs.length > 0) {
          await Promise.race([
            Promise.all(
              imgs.map((img) =>
                img.complete
                  ? Promise.resolve()
                  : new Promise<void>((res) => {
                      img.onload = () => res();
                      img.onerror = () => res();
                    })
              )
            ),
            new Promise((r) => setTimeout(r, 350)),
          ]);
        }
        iframeWin.focus();
        iframeWin.print();
      } catch {
        cleanup();
        printElementDirectly(elementId, options);
      }
    };

    // Wait a single frame for layout calculation inside iframe
    requestAnimationFrame(() => {
      void runPrint();
    });

    return true;
  } catch (err) {
    console.warn('Iframe print error, falling back to direct print:', err);
    return printElementDirectly(elementId, options);
  }
};

/**
 * Backward-compatible alias that now delegates to the modern zero-popup hidden iframe print engine.
 */
export const printElementInNewWindow = (
  elementId: string,
  title: string,
  options?: PdfExportOptions
): boolean => {
  return printElementViaIframe(elementId, title, options);
};
