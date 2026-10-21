import html2canvas from 'html2canvas-pro';
import jsPDF from 'jspdf';
import { StorageService } from './storage';
import { PdfQualityPreset, Invoice } from '../types';
import { toPersianDigits } from './jalali';
import { getPrintLayoutCssRules } from './printLayoutHelper';

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
  let raw = (name || '').trim();
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
 * نام فایل خروجی PDF طبق درخواست کاربر در تمام برنامه:
 * فاکتور یا پیش فاکتور ـ شماره؟ـ آقا یا خانم ؟
 * مثال:
 * فاکتور ـ 1001 ـ آقای علی رضایی.pdf
 * پیش فاکتور ـ 1002 ـ خانم سارا محمدی.pdf
 * فاکتور ـ 1003 ـ آقا یا خانم احمدی.pdf
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
    scale: 1.3,
    compression: 0.72,
    label: 'اقتصادی و کم‌حجم (فوق‌العاده سریع)',
    badge: 'کم‌حجم ترین',
    approxSize: '~۶۰ تا ۹۵ کیلوبایت',
    description: 'کمترین حجم فایل، ایده‌آل برای ارسال با پیام‌رسان‌ها (ایتا، بله، واتساپ) و اینترنت ضعیف همراه',
  },
  standard: {
    preset: 'standard',
    scale: 1.85,
    compression: 0.86,
    label: 'استاندارد متعادل (پیشنهادی)',
    badge: 'تعادل هوشمند',
    approxSize: '~۱۲۰ تا ۱۸۰ کیلوبایت',
    description: 'تعادل هوشمند بین وضوح عالی نوشته‌ها و بارکدها با حجم بهینه و مناسب برای بایگانی و اشتراک‌گذاری',
  },
  high: {
    preset: 'high',
    scale: 2.3,
    compression: 0.94,
    label: 'کیفیت بالا (شفاف و شارپ)',
    badge: 'تفکیک بالا',
    approxSize: '~۲۵۰ تا ۴۰۰ کیلوبایت',
    description: 'تفکیک تصویر بسیار بالا و فونت‌های بدون تارشدگی، مناسب نمایش در مانیتور و کامپیوتر مشتری',
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
 * Assembles a multi-page jsPDF document from an html2canvas result, ensuring:
 * 1. Single page fits perfectly if content height is within standard bounds.
 * 2. Multi-page documents repeat the complete header (store name, title, customer banner, and table headers) at the top of every page.
 * 3. Page breaks occur cleanly at table row boundaries (avoiding cutting text mid-row).
 * 4. Persian page numbers (e.g., "صفحه ۲ از ۳") are added to every page.
 */
export function buildPdfDocumentFromCanvas(
  canvas: HTMLCanvasElement,
  layoutMeta: LayoutMeta,
  options?: PdfExportOptions
): jsPDF {
  const paperSize = options?.pageSize || 'a4';
  const orientation = options?.orientation || 'portrait';
  const isA5 = paperSize === 'a5';
  const marginMm = options?.marginMm !== undefined ? options.marginMm : (isA5 ? 3.5 : 4.5);

  const pdf = new jsPDF({
    orientation,
    unit: 'mm',
    format: paperSize,
    compress: true,
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const usableWidth = pageWidth - marginMm * 2;
  const usableHeight = pageHeight - marginMm * 2;

  // Helper to guarantee every single PDF page has an edge-to-edge pure white (#ffffff) background
  const paintPageWhite = () => {
    pdf.setFillColor(255, 255, 255);
    pdf.rect(0, 0, pageWidth, pageHeight, 'F');
  };

  // Always paint the initial page white immediately
  paintPageWhite();

  const { compression: jpegCompression } = resolvePdfQuality(options);

  const pxPerMm = canvas.width / usableWidth;
  const fullPageHeightPx = Math.floor(usableHeight * pxPerMm);

  // If content fits comfortably on a single page, render full single page coverage with 100% preserved aspect ratio
  if (canvas.height <= fullPageHeightPx * 1.15) {
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

  // Multi-page document handling: Repeat header on all pages & avoid cutting rows
  const scaleRatio = canvas.width / (layoutMeta.rootWidthPx || 1);
  let headerCanvasPx = Math.round(layoutMeta.headerBottomPx * scaleRatio);
  const rowBottomsCanvasPx = layoutMeta.rowBottomsPx.map((y) => Math.round(y * scaleRatio));

  // Cap header height to at most 55% of the page
  const maxHeaderPx = Math.floor(fullPageHeightPx * 0.55);
  if (headerCanvasPx > maxHeaderPx) {
    headerCanvasPx = maxHeaderPx;
  }

  const hasValidHeader = headerCanvasPx >= 25;
  const badgeHeightPx = 28;

  if (hasValidHeader) {
    // 1. Extract header canvas
    const headerCanvas = document.createElement('canvas');
    headerCanvas.width = canvas.width;
    headerCanvas.height = headerCanvasPx;
    const hCtx = headerCanvas.getContext('2d');
    if (hCtx) {
      hCtx.fillStyle = '#ffffff';
      hCtx.fillRect(0, 0, headerCanvas.width, headerCanvas.height);
      hCtx.drawImage(
        canvas,
        0, 0, canvas.width, headerCanvasPx,
        0, 0, canvas.width, headerCanvasPx
      );
    }
    const headerImgData = headerCanvas.toDataURL('image/jpeg', jpegCompression);
    const headerHeightMm = (headerCanvasPx * usableWidth) / canvas.width;

    // Available height for content beneath the header on pages 2+
    const contentAvailHeightPx = fullPageHeightPx - headerCanvasPx - badgeHeightPx;

    // 2. Partition canvas rows into pages
    interface PageSlice {
      startY: number;
      endY: number;
      isFirstPage: boolean;
    }
    const pages: PageSlice[] = [];

    // Page 1: Starts at 0 (naturally contains header). Content ends at best row cut <= fullPageHeightPx - badgeHeightPx
    const page1Target = fullPageHeightPx - badgeHeightPx;
    let page1Cut = page1Target;
    if (rowBottomsCanvasPx.length > 0) {
      const validRows = rowBottomsCanvasPx.filter((rb) => rb > headerCanvasPx && rb <= page1Target);
      if (validRows.length > 0) {
        page1Cut = validRows[validRows.length - 1];
      }
    }
    pages.push({ startY: 0, endY: page1Cut, isFirstPage: true });

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

      // Safety guard against non-advancing slice
      if (bestCut <= currentY) {
        bestCut = Math.min(target, canvas.height);
      }

      pages.push({ startY: currentY, endY: bestCut, isFirstPage: false });
      currentY = bestCut;
    }

    const totalPages = pages.length;

    // 3. Render each page
    for (let i = 0; i < pages.length; i++) {
      if (i > 0) {
        pdf.addPage();
      }
      paintPageWhite();
      const page = pages[i];
      const pageNumText = `صفحه ${toPersianDigits(i + 1)} از ${toPersianDigits(totalPages)}`;

      if (page.isFirstPage) {
        // Page 1: Render slice from 0 to page.endY
        const sliceHeightPx = page.endY;
        const sliceCanvas = document.createElement('canvas');
        sliceCanvas.width = canvas.width;
        sliceCanvas.height = sliceHeightPx + badgeHeightPx;
        const sCtx = sliceCanvas.getContext('2d');
        if (sCtx) {
          sCtx.fillStyle = '#ffffff';
          sCtx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
          sCtx.drawImage(
            canvas,
            0, 0, canvas.width, sliceHeightPx,
            0, 0, canvas.width, sliceHeightPx
          );

          // Page badge
          sCtx.fillStyle = '#64748b';
          sCtx.font = "bold 13px 'Vazirmatn', -apple-system, sans-serif";
          sCtx.textAlign = 'left';
          sCtx.fillText(pageNumText, 24, sliceHeightPx + 18);

          const sliceImgData = sliceCanvas.toDataURL('image/jpeg', jpegCompression);
          const sliceHeightMm = ((sliceHeightPx + badgeHeightPx) * usableWidth) / canvas.width;
          pdf.addImage(sliceImgData, 'JPEG', marginMm, marginMm, usableWidth, sliceHeightMm, undefined, 'FAST');
        }
      } else {
        // Page 2+:
        // A. Repeat preserved header at top
        pdf.addImage(headerImgData, 'JPEG', marginMm, marginMm, usableWidth, headerHeightMm, undefined, 'FAST');

        // B. Render slice content below header
        const sliceContentHeightPx = page.endY - page.startY;
        const sliceCanvas = document.createElement('canvas');
        sliceCanvas.width = canvas.width;
        sliceCanvas.height = sliceContentHeightPx + badgeHeightPx;
        const sCtx = sliceCanvas.getContext('2d');
        if (sCtx) {
          sCtx.fillStyle = '#ffffff';
          sCtx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
          sCtx.drawImage(
            canvas,
            0, page.startY, canvas.width, sliceContentHeightPx,
            0, 0, canvas.width, sliceContentHeightPx
          );

          // Page badge
          sCtx.fillStyle = '#64748b';
          sCtx.font = "bold 13px 'Vazirmatn', -apple-system, sans-serif";
          sCtx.textAlign = 'left';
          sCtx.fillText(pageNumText, 24, sliceContentHeightPx + 18);

          const sliceImgData = sliceCanvas.toDataURL('image/jpeg', jpegCompression);
          const sliceHeightMm = ((sliceContentHeightPx + badgeHeightPx) * usableWidth) / canvas.width;
          pdf.addImage(sliceImgData, 'JPEG', marginMm, marginMm + headerHeightMm, usableWidth, sliceHeightMm, undefined, 'FAST');
        }
      }
    }
  } else {
    // Fallback: Uniform slicing if no header could be determined
    const sliceHeightPx = fullPageHeightPx;
    let yOffsetPx = 0;
    let isFirstPage = true;

    while (yOffsetPx < canvas.height) {
      if (!isFirstPage) {
        pdf.addPage();
      }
      paintPageWhite();
      const currentSliceHeightPx = Math.min(sliceHeightPx, canvas.height - yOffsetPx);
      const sliceCanvas = document.createElement('canvas');
      sliceCanvas.width = canvas.width;
      sliceCanvas.height = currentSliceHeightPx;
      const sliceCtx = sliceCanvas.getContext('2d');
      if (sliceCtx) {
        sliceCtx.fillStyle = '#ffffff';
        sliceCtx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
        sliceCtx.drawImage(
          canvas,
          0, yOffsetPx, canvas.width, currentSliceHeightPx,
          0, 0, canvas.width, currentSliceHeightPx
        );
        const sliceImgData = sliceCanvas.toDataURL('image/jpeg', jpegCompression);
        const sliceHeightMm = (currentSliceHeightPx * usableWidth) / canvas.width;
        pdf.addImage(sliceImgData, 'JPEG', marginMm, marginMm, usableWidth, sliceHeightMm, undefined, 'FAST');
      }
      yOffsetPx += sliceHeightPx;
      isFirstPage = false;
    }
  }

  return pdf;
}

let cachedExtractedRules: string | null = null;
let lastStyleSheetsCount = 0;

/**
 * Safely extracts all active CSS rules currently loaded in document.styleSheets.
 * Caches the extracted rules so subsequent PDF exports are instantaneous (0ms overhead).
 * Avoids slow CSSOM iteration when <style> textContent is already available.
 */
function extractActiveStyleSheetRules(): string {
  if (cachedExtractedRules && document.styleSheets.length === lastStyleSheetsCount) {
    return cachedExtractedRules;
  }

  let combinedCss = '';
  try {
    // 1. Instant path: Extract textContent directly from all local <style> tags (0ms vs thousands of getter calls)
    const styleTags = document.head.querySelectorAll('style');
    styleTags.forEach((tag) => {
      if (tag.textContent && !tag.id.startsWith('pdf-')) {
        combinedCss += tag.textContent + '\n';
      }
    });

    // 2. Only inspect external stylesheets if needed
    const sheets = Array.from(document.styleSheets);
    for (const sheet of sheets) {
      try {
        if (sheet.ownerNode && (sheet.ownerNode as HTMLElement).tagName === 'STYLE') {
          continue; // Already processed above via textContent
        }
        if (sheet.cssRules && sheet.cssRules.length > 0) {
          const rulesCount = sheet.cssRules.length;
          for (let i = 0; i < rulesCount; i++) {
            combinedCss += sheet.cssRules[i].cssText + '\n';
          }
        }
      } catch {
        // Cross-origin stylesheets without CORS headers will throw security error, safely ignore
      }
    }
  } catch {
    // Fallback if document.styleSheets is inaccessible
  }

  cachedExtractedRules = combinedCss;
  lastStyleSheetsCount = document.styleSheets.length;
  return combinedCss;
}

/**
 * Robustly configures cloned document and DOM elements for html2canvas PDF rendering.
 * Inlines all styles, guarantees table borders, forces Persian fonts, and removes scroll clipping.
 */
function setupClonedDocumentForPdfCapture(
  clonedDoc: Document,
  clonedElement: HTMLElement,
  element: HTMLElement,
  targetWidthPx: number,
  targetMinHeightPx: number,
  isA5: boolean,
  isLandscape: boolean,
  layoutMeta: LayoutMeta
): void {
  // 1. Reset scroll in cloned window
  if (clonedDoc.defaultView) {
    clonedDoc.defaultView.scrollTo(0, 0);
  }

  // Force pure white background on cloned document root and body
  if (clonedDoc.documentElement) {
    clonedDoc.documentElement.style.setProperty('background-color', '#ffffff', 'important');
    clonedDoc.documentElement.style.setProperty('background', '#ffffff', 'important');
  }
  if (clonedDoc.body) {
    clonedDoc.body.style.setProperty('background-color', '#ffffff', 'important');
    clonedDoc.body.style.setProperty('background', '#ffffff', 'important');
  }
  clonedElement.style.setProperty('background-color', '#ffffff', 'important');
  clonedElement.style.setProperty('background', '#ffffff', 'important');

  // 2. Synchronously inject live CSS rules into clonedDoc
  const extractedRules = extractActiveStyleSheetRules();
  if (extractedRules) {
    const inlineExtractedStyle = clonedDoc.createElement('style');
    inlineExtractedStyle.id = 'pdf-inlined-main-rules';
    inlineExtractedStyle.textContent = extractedRules;
    clonedDoc.head.appendChild(inlineExtractedStyle);
  }

  // Also copy local style and link tags from main document, but filter out external remote links (e.g. fonts.googleapis.com)
  // which trigger multi-second network latency in the cloned iframe before html2canvas can start.
  const mainDocStyles = document.head.querySelectorAll('style, link[rel="stylesheet"]');
  mainDocStyles.forEach((node) => {
    try {
      if (node.tagName.toLowerCase() === 'link') {
        const href = (node as HTMLLinkElement).href;
        if (href && (href.startsWith('http://') || href.startsWith('https://')) && !href.startsWith(window.location.origin)) {
          // Skip external remote stylesheet links to avoid iframe network hangs
          return;
        }
      }
      clonedDoc.head.appendChild(node.cloneNode(true));
    } catch {}
  });

  // 3. Inject high-priority infallible PDF print fixes (without blocking @import)
  const pdfFixStyle = clonedDoc.createElement('style');
  pdfFixStyle.id = 'pdf-cloned-fix-styles-bulletproof';
  pdfFixStyle.innerHTML = `
    ${getPrintLayoutCssRules()}
    
    html, body {
      background-color: #ffffff !important;
      background: #ffffff !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    #printable-invoice,
    #printable-purchase-invoice,
    #printable-exit-slip,
    #printable-inbound-receipt,
    #printable-direct-transfer-slip,
    #printable-customer-statement-pdf,
    #invoices-slips-pdf-report-canvas,
    #public-web-invoice-container,
    .print-container,
    .print-white-bg,
    .standard-invoice-layout,
    .simple-invoice-layout,
    .standard-exit-slip-layout,
    .simple-exit-slip-layout {
      background-color: #ffffff !important;
      background: #ffffff !important;
      box-shadow: none !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }

    *, *::before, *::after {
      box-sizing: border-box !important;
    }
    
    /* Strict border override for elements configured without borders (e.g. export PDF canvas) */
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

    /* Bulletproof Table & Border Styles (only for standard tables with borders) */
    table:not(.no-pdf-border):not([style*="border: none"]):not([style*="border:none"]):not([style*="border: 0"]) {
      border-collapse: collapse !important;
      border-spacing: 0 !important;
      width: 100% !important;
      border: 1px solid #94a3b8 !important;
      background-color: #ffffff !important;
    }
    th:not(.no-pdf-border):not([style*="border: none"]):not([style*="border:none"]):not([style*="border: 0"]), 
    thead th:not(.no-pdf-border):not([style*="border: none"]):not([style*="border:none"]):not([style*="border: 0"]) {
      border: 1px solid #94a3b8 !important;
      border-color: #94a3b8 !important;
      border-style: solid !important;
      border-width: 1px !important;
      background-color: #f1f5f9 !important;
      color: #0f172a !important;
      font-weight: 700 !important;
      vertical-align: middle !important;
      opacity: 1 !important;
      visibility: visible !important;
    }
    td:not(.no-pdf-border):not([style*="border: none"]):not([style*="border:none"]):not([style*="border: 0"]), 
    tbody td:not(.no-pdf-border):not([style*="border: none"]):not([style*="border:none"]):not([style*="border: 0"]) {
      border: 1px solid #cbd5e1 !important;
      border-color: #cbd5e1 !important;
      border-style: solid !important;
      border-width: 1px !important;
      color: #1e293b !important;
      vertical-align: middle !important;
      opacity: 1 !important;
      visibility: visible !important;
    }
    .border-b {
      border-bottom-width: 1px !important;
      border-bottom-style: solid !important;
    }
    .border-t {
      border-top-width: 1px !important;
      border-top-style: solid !important;
    }
    .border-l {
      border-left-width: 1px !important;
      border-left-style: solid !important;
    }
    .border-r {
      border-right-width: 1px !important;
      border-right-style: solid !important;
    }
    .border {
      border-width: 1px !important;
      border-style: solid !important;
    }
    .border-slate-300, .border-gray-300 {
      border-color: #cbd5e1 !important;
    }
    .border-slate-200, .border-gray-200 {
      border-color: #e2e8f0 !important;
    }
    .bg-slate-100, .bg-gray-100 {
      background-color: #f1f5f9 !important;
    }
    .bg-slate-50, .bg-gray-50 {
      background-color: #f8fafc !important;
    }

    /* Text & Legibility */
    p, span, div, td, th, h1, h2, h3, h4, h5, h6, strong, b, em {
      opacity: 1 !important;
      visibility: visible !important;
      letter-spacing: normal !important;
      font-feature-settings: "liga" 1, "calt" 1 !important;
      text-rendering: optimizeLegibility !important;
    }
  `;
  clonedDoc.head.appendChild(pdfFixStyle);

  // 4. DOM Isolation: Hide all background UI and non-essential elements in clonedDoc.body
  // This drastically speeds up html2canvas by skipping thousands of irrelevant DOM nodes in the rest of the application
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

  // 5. Hide all buttons, action controls, and .no-print elements
  const elementsToHide = clonedElement.querySelectorAll(
    '.no-print, .no-pdf, button, [data-html2canvas-ignore="true"]'
  );
  elementsToHide.forEach((el) => {
    (el as HTMLElement).style.setProperty('display', 'none', 'important');
    (el as HTMLElement).style.setProperty('visibility', 'hidden', 'important');
  });

  // 6. Dimensions and single-page vs multi-page balancing
  const naturalHeight = element.scrollHeight;
  const isSinglePageMode = naturalHeight <= targetMinHeightPx * 1.15;

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
  clonedElement.style.setProperty('background-color', '#ffffff', 'important');
  clonedElement.style.setProperty('background', '#ffffff', 'important');
  clonedElement.style.setProperty('direction', 'rtl', 'important');

  // Prevent Persian font glyph disconnects and broken cursive joins
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
      '.exit-slip-table-box, .invoice-table-box, .simple-invoice-table-box'
    );
    tableBoxes.forEach((tb) => {
      const tbel = tb as HTMLElement;
      tbel.style.setProperty('flex', '1 1 auto', 'important');
      tbel.style.setProperty('display', 'flex', 'important');
      tbel.style.setProperty('flex-direction', 'column', 'important');
      tbel.style.setProperty('justify-content', 'flex-start', 'important');
      tbel.style.setProperty('margin-top', '4px', 'important');
      tbel.style.setProperty('margin-bottom', 'auto', 'important');
    });
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

  // Unconstrain ancestors
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

  // 7. Explicitly force table borders and styles directly on every table, th, and td
  const isBorderless =
    clonedElement.id === 'invoices-slips-pdf-report-canvas' ||
    clonedElement.classList.contains('no-pdf-border') ||
    element.id === 'invoices-slips-pdf-report-canvas' ||
    element.classList.contains('no-pdf-border');

  if (isBorderless) {
    clonedElement.style.setProperty('border', 'none', 'important');
    clonedElement.style.setProperty('border-width', '0', 'important');
    clonedElement.style.setProperty('border-color', 'transparent', 'important');
    clonedElement.style.setProperty('box-shadow', 'none', 'important');
    clonedElement.style.setProperty('outline', 'none', 'important');
  }

  const tables = clonedElement.querySelectorAll('table');
  const defaultMinRowH = isA5 ? (isLandscape ? 24 : 28) : (isLandscape ? 32 : 36);
  tables.forEach((tbl) => {
    const tblEl = tbl as HTMLElement;
    tblEl.style.setProperty('width', '100%', 'important');
    tblEl.style.setProperty('min-width', '100%', 'important');
    tblEl.style.setProperty('table-layout', 'auto', 'important');
    tblEl.style.setProperty('border-collapse', 'collapse', 'important');

    if (isBorderless) {
      tblEl.style.setProperty('border', 'none', 'important');
      tblEl.style.setProperty('border-width', '0', 'important');
      tblEl.style.setProperty('border-color', 'transparent', 'important');
      tblEl.style.setProperty('box-shadow', 'none', 'important');
      tblEl.style.setProperty('outline', 'none', 'important');
    } else {
      tblEl.style.setProperty('border', '1px solid #94a3b8', 'important');
    }

    tblEl.querySelectorAll('thead th, th').forEach((th) => {
      const thEl = th as HTMLElement;
      thEl.style.setProperty('vertical-align', 'middle', 'important');
      thEl.style.setProperty('box-sizing', 'border-box', 'important');
      if (isBorderless) {
        thEl.style.setProperty('border', 'none', 'important');
        thEl.style.setProperty('border-width', '0', 'important');
        thEl.style.setProperty('border-color', 'transparent', 'important');
        thEl.style.setProperty('box-shadow', 'none', 'important');
        thEl.style.setProperty('outline', 'none', 'important');
      } else {
        thEl.style.setProperty('border', '1px solid #94a3b8', 'important');
        thEl.style.setProperty('border-color', '#94a3b8', 'important');
        thEl.style.setProperty('border-style', 'solid', 'important');
        thEl.style.setProperty('border-width', '1px', 'important');
        thEl.style.setProperty('background-color', '#f1f5f9', 'important');
      }
      thEl.style.setProperty('opacity', '1', 'important');
      thEl.style.setProperty('visibility', 'visible', 'important');
    });

    tblEl.querySelectorAll('tbody tr').forEach((tr) => {
      const trEl = tr as HTMLElement;
      trEl.style.setProperty('height', 'auto', 'important');
      trEl.style.setProperty('min-height', `${defaultMinRowH}px`, 'important');
      trEl.style.setProperty('page-break-inside', 'avoid', 'important');
      trEl.style.setProperty('break-inside', 'avoid', 'important');
      if (isBorderless) {
        trEl.style.setProperty('border', 'none', 'important');
        trEl.style.setProperty('border-width', '0', 'important');
        trEl.style.setProperty('border-color', 'transparent', 'important');
      }

      trEl.querySelectorAll('td').forEach((td) => {
        const tdEl = td as HTMLElement;
        tdEl.style.setProperty('height', `${defaultMinRowH}px`, 'important');
        tdEl.style.setProperty('min-height', `${defaultMinRowH}px`, 'important');
        tdEl.style.setProperty('vertical-align', 'middle', 'important');
        tdEl.style.setProperty('box-sizing', 'border-box', 'important');
        if (isBorderless) {
          tdEl.style.setProperty('border', 'none', 'important');
          tdEl.style.setProperty('border-width', '0', 'important');
          tdEl.style.setProperty('border-color', 'transparent', 'important');
          tdEl.style.setProperty('box-shadow', 'none', 'important');
          tdEl.style.setProperty('outline', 'none', 'important');
        } else {
          tdEl.style.setProperty('border', '1px solid #cbd5e1', 'important');
          tdEl.style.setProperty('border-color', '#cbd5e1', 'important');
          tdEl.style.setProperty('border-style', 'solid', 'important');
          tdEl.style.setProperty('border-width', '1px', 'important');
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

  // 8. Measure layout metadata for multi-page header preservation
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
 * Exports a DOM element to a PDF configured with user quality settings.
 * Supports configurable page format (A4 or A5) and orientation (portrait or landscape).
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

  const paperSize = options?.pageSize || 'a4';
  const orientation = options?.orientation || 'portrait';
  const isLandscape = orientation === 'landscape';
  const isA5 = paperSize === 'a5';

  // Standard margins: 4.5mm for A4, 3.5mm for A5 to maximize usable page coverage
  const marginMm = isA5 ? 3.5 : 4.5;

  // Exact standard ISO aspect-ratio canvas dimensions to ensure full-sheet coverage
  let targetWidthPx: number;
  let targetMinHeightPx: number;
  if (isA5) {
    if (isLandscape) {
      targetWidthPx = 900;
      targetMinHeightPx = Math.round(900 * (141 / 203)); // 625px
    } else {
      targetWidthPx = 620;
      targetMinHeightPx = Math.round(620 * (203 / 141)); // 892px
    }
  } else {
    if (isLandscape) {
      targetWidthPx = 1180;
      targetMinHeightPx = Math.round(1180 * (201 / 288)); // 824px
    } else {
      targetWidthPx = 820;
      targetMinHeightPx = Math.round(820 * (288 / 201)); // 1175px
    }
  }

  const { scale: renderScale } = resolvePdfQuality(options);

  const layoutMeta: LayoutMeta = {
    headerBottomPx: 0,
    rowBottomsPx: [],
    footerTopPx: 0,
    rootWidthPx: targetWidthPx,
  };

  try {
    // 0. Ensure all web fonts are loaded, but never stall more than 80ms if remote CDN is slow/offline
    if (document.fonts) {
      try {
        await Promise.race([
          document.fonts.ready,
          new Promise((resolve) => setTimeout(resolve, 80))
        ]);
      } catch {
        // Ignore font loading errors if browser API fails
      }
    }

    // 1. Capture element with unclipped height and properly aligned coordinates
    const canvas = await html2canvas(element, {
      scale: renderScale,
      useCORS: true,
      logging: false,
      imageTimeout: 1500,
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
          layoutMeta
        );
      },
    });

    // 2. Assemble PDF (repeating header on every page in multi-page mode)
    const pdf = buildPdfDocumentFromCanvas(canvas, layoutMeta, options);
    const safeFilename = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;
    pdf.save(safeFilename);
    return { success: true };
  } catch (err: any) {
    console.error('PDF export error:', err);
    return { success: false, error: err?.message || 'خطا در تبدیل و دانلود PDF' };
  }
};

/**
 * Generates an ultra-compact PDF Blob and File without forcing immediate save,
 * making it possible to share the file directly via Web Share API or attach to messengers.
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

  const paperSize = options?.pageSize || 'a4';
  const orientation = options?.orientation || 'portrait';
  const isLandscape = orientation === 'landscape';
  const isA5 = paperSize === 'a5';

  // Standard margins: 4.5mm for A4, 3.5mm for A5 to maximize usable page coverage
  const marginMm = isA5 ? 3.5 : 4.5;

  // Exact standard ISO aspect-ratio canvas dimensions to ensure full-sheet coverage
  let targetWidthPx: number;
  let targetMinHeightPx: number;
  if (isA5) {
    if (isLandscape) {
      targetWidthPx = 900;
      targetMinHeightPx = Math.round(900 * (141 / 203)); // 625px
    } else {
      targetWidthPx = 620;
      targetMinHeightPx = Math.round(620 * (203 / 141)); // 892px
    }
  } else {
    if (isLandscape) {
      targetWidthPx = 1180;
      targetMinHeightPx = Math.round(1180 * (201 / 288)); // 824px
    } else {
      targetWidthPx = 820;
      targetMinHeightPx = Math.round(820 * (288 / 201)); // 1175px
    }
  }

  const { scale: renderScale } = resolvePdfQuality(options);

  const layoutMeta: LayoutMeta = {
    headerBottomPx: 0,
    rowBottomsPx: [],
    footerTopPx: 0,
    rootWidthPx: targetWidthPx,
  };

  try {
    // Ensure all web fonts are loaded, but never stall more than 80ms if remote CDN is slow/offline
    if (document.fonts) {
      try {
        await Promise.race([
          document.fonts.ready,
          new Promise((resolve) => setTimeout(resolve, 80))
        ]);
      } catch {
        // Ignore font loading errors if browser API fails
      }
    }

    const canvas = await html2canvas(element, {
      scale: renderScale,
      useCORS: true,
      logging: false,
      imageTimeout: 1500,
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
          layoutMeta
        );
      },
    });

    // 2. Assemble PDF (repeating header on every page in multi-page mode)
    const pdf = buildPdfDocumentFromCanvas(canvas, layoutMeta, options);
    const safeFilename = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;
    const blob = pdf.output('blob');
    let file: File | undefined;
    try {
      file = new File([blob], safeFilename, { type: 'application/pdf' });
    } catch {
      // In environments where File constructor is restricted
    }
    return { success: true, blob, file };
  } catch (err: any) {
    console.error('PDF generation error:', err);
    return { success: false, error: err?.message || 'خطا در ایجاد فایل PDF' };
  }
};

/**
 * Triggers direct browser printing synchronously within user gesture.
 * Applies temporary clean CSS scoping so only the target sheet prints.
 */
export const printElementDirectly = (
  elementId: string,
  options?: PdfExportOptions
): boolean => {
  const paperSize = options?.pageSize || 'a4';
  const orientation = options?.orientation || 'portrait';
  
  let resolvedMargin = options?.marginMm;
  if (!resolvedMargin) {
    try {
      const s = StorageService.getSettings();
      if (s?.printLayout?.pageMarginMm) resolvedMargin = s.printLayout.pageMarginMm;
    } catch {}
  }
  const marginMm = resolvedMargin || (paperSize === 'a5' ? 4 : 6);

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
    styleEl.innerHTML = `
      ${getPrintLayoutCssRules('#' + elementId)}
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

    // Apply printing-active-element class to isolate the element on paper
    document.body.classList.add('printing-active-element');

    // Call window.print() synchronously inside user gesture
    window.print();

    // Clean up
    setTimeout(() => {
      styleEl.remove();
      document.body.classList.remove('printing-active-element');
    }, 1500);

    return true;
  } catch (err) {
    console.warn('Direct print error:', err);
    document.body.classList.remove('printing-active-element');
    return false;
  }
};

/**
 * Opens a dedicated top-level print window and immediately displays the browser's printer dialog.
 * This completely bypasses any iframe sandbox restrictions (e.g., missing allow-modals in preview containers).
 */
export const printElementInNewWindow = (
  elementId: string,
  title: string,
  options?: PdfExportOptions
): boolean => {
  const element = document.getElementById(elementId);
  if (!element) return false;

  const paperSize = options?.pageSize || 'a4';
  const orientation = options?.orientation || 'portrait';
  
  let resolvedMargin = options?.marginMm;
  if (!resolvedMargin) {
    try {
      const s = StorageService.getSettings();
      if (s?.printLayout?.pageMarginMm) resolvedMargin = s.printLayout.pageMarginMm;
    } catch {}
  }
  const marginMm = resolvedMargin || (paperSize === 'a5' ? 4 : 6);
  const targetWidthPx = 
    paperSize === 'a5'
      ? (orientation === 'landscape' ? 850 : 600)
      : (orientation === 'landscape' ? 1140 : 840);

  try {
    // Open a new standalone window
    const windowWidth = orientation === 'landscape' ? 1160 : 920;
    const printWindow = window.open('', '_blank', `width=${windowWidth},height=800`);
    if (!printWindow) {
      // If popup blocked, fallback to direct print
      return printElementDirectly(elementId, options);
    }

    // Collect all stylesheets from main document
    const styles = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
      .map((s) => s.outerHTML)
      .join('\n');

    printWindow.document.open();
    printWindow.document.write(`
      <!DOCTYPE html>
      <html dir="rtl" lang="fa">
      <head>
        <meta charset="utf-8" />
        <title>${title}</title>
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Vazirmatn:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
        ${styles}
        <style>
          ${getPrintLayoutCssRules()}
          * {
            box-sizing: border-box;
            font-family: 'Vazirmatn', -apple-system, BlinkMacSystemFont, sans-serif !important;
          }
          body {
            margin: 0;
            padding: ${paperSize === 'a5' ? '12px' : '24px'};
            background: #ffffff;
            direction: rtl;
            color: #0f172a;
          }
          .print-wrapper {
            max-width: ${targetWidthPx}px;
            margin: 0 auto;
            background: #ffffff;
            border: 1px solid #cbd5e1;
            border-radius: 12px;
            padding: ${paperSize === 'a5' ? '14px' : '24px'};
            box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
          }
          .top-print-toolbar {
            max-width: ${targetWidthPx}px;
            margin: 0 auto 16px auto;
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 10px 16px;
            background: #0f172a;
            color: #ffffff;
            border-radius: 8px;
          }
          .top-print-btn {
            background: #10b981;
            color: #ffffff;
            border: none;
            padding: 8px 16px;
            border-radius: 6px;
            font-size: 14px;
            font-weight: bold;
            cursor: pointer;
          }
          @page {
            size: ${paperSize.toUpperCase()} ${orientation};
            margin: ${marginMm}mm;
          }
          @media print {
            body {
              background: #ffffff !important;
              padding: 0 !important;
              margin: 0 !important;
            }
            .no-print, .no-pdf, .top-print-toolbar, button, [data-html2canvas-ignore="true"] {
              display: none !important;
            }
            .print-wrapper {
              border: none !important;
              border-radius: 0 !important;
              padding: 0 !important;
              max-width: 100% !important;
              min-height: calc(100vh - ${marginMm * 2}mm) !important;
              height: calc(100vh - ${marginMm * 2}mm) !important;
              display: flex !important;
              flex-direction: column !important;
              justify-content: space-between !important;
              box-shadow: none !important;
            }
            @page {
              size: ${paperSize.toUpperCase()} ${orientation};
              margin: ${marginMm}mm;
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
      <body>
        <div class="top-print-toolbar no-print">
          <span style="font-size: 13px; font-weight: 500;">آماده‌سازی چاپ ${title} (${paperSize.toUpperCase()} ${orientation === 'portrait' ? 'عمودی' : 'افقی'})</span>
          <button class="top-print-btn" onclick="window.print()">باز کردن پرینتر (Print)</button>
        </div>
        <div class="print-wrapper" style="${element.getAttribute('style') || ''}">
          ${element.innerHTML}
        </div>
        <script>
          // Automatically trigger the printer dialog once loaded
          window.addEventListener('load', function() {
            setTimeout(function() {
              window.focus();
              window.print();
            }, 300);
          });
        </script>
      </body>
      </html>
    `);
    printWindow.document.close();
    return true;
  } catch (err) {
    console.warn('Print in new window error, falling back to direct print:', err);
    return printElementDirectly(elementId, options);
  }
};
