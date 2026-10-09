import React, { useState, useRef, useEffect } from 'react';
import { PrintLayoutSettings, DEFAULT_PRINT_LAYOUT, OPTIMAL_PRINT_LAYOUT, StoreSettings } from '../types';
import { toPersianDigits, formatPrice } from '../utils/jalali';
import { getPrintLayoutCssVariables } from '../utils/printLayoutHelper';
import { printElementInNewWindow, exportElementToPdf } from '../utils/pdfHelper';
import { broadcastLivePreview } from '../utils/livePreviewSync';
import { 
  Type, 
  Table, 
  Maximize2, 
  Palette, 
  RotateCcw, 
  Printer, 
  Eye, 
  FileDown, 
  Check, 
  Sliders, 
  Sparkles, 
  RectangleHorizontal, 
  RectangleVertical, 
  Scan, 
  Minimize2, 
  ZoomIn, 
  ZoomOut, 
  X, 
  Split, 
  Upload, 
  Trash2, 
  Image, 
  FileText, 
  SlidersHorizontal, 
  CheckCircle2, 
  RefreshCw, 
  Columns, 
  Compass, 
  Zap, 
  ArrowUpRight,
  ExternalLink,
  Move,
  Minus,
  Square,
  Monitor
} from 'lucide-react';

interface PrintLayoutCustomizerProps {
  value?: PrintLayoutSettings;
  onChange: (layout: PrintLayoutSettings) => void;
  settings: StoreSettings;
  onSave?: () => void;
}

// 8 stylish preset vector badges for businesses that don't have an image ready
export const PRESET_LOGOS = [
  {
    id: 'tech',
    title: 'فناوری و دیجیتال',
    svg: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none"><rect width="100" height="100" rx="20" fill="%230284c7"/><path d="M25 35h50v30H25z" stroke="white" stroke-width="6" rx="4"/><circle cx="50" cy="50" r="7" fill="white"/><path d="M40 73h20" stroke="white" stroke-width="6" stroke-linecap="round"/></svg>`
  },
  {
    id: 'store',
    title: 'فروشگاهی و هایپر',
    svg: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none"><rect width="100" height="100" rx="20" fill="%23059669"/><path d="M25 30h10l8 32h28l6-24H35" stroke="white" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/><circle cx="45" cy="72" r="5" fill="white"/><circle cx="68" cy="72" r="5" fill="white"/></svg>`
  },
  {
    id: 'corporate',
    title: 'شرکتی و بازرگانی',
    svg: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none"><rect width="100" height="100" rx="20" fill="%230f172a"/><path d="M30 75V35l20-10v50m0 0V45l20-8v38" stroke="white" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/><circle cx="40" cy="45" r="3" fill="white"/><circle cx="60" cy="52" r="3" fill="white"/></svg>`
  },
  {
    id: 'shield',
    title: 'امنیت و گارانتی',
    svg: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none"><rect width="100" height="100" rx="20" fill="%234f46e5"/><path d="M50 22L28 32v20c0 18 22 28 22 28s22-10 22-28V32L50 22z" stroke="white" stroke-width="6" stroke-linejoin="round"/><path d="M42 50l6 6 12-14" stroke="white" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/></svg>`
  },
  {
    id: 'diamond',
    title: 'طلا، جواهر و لوکس',
    svg: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none"><rect width="100" height="100" rx="20" fill="%23d97706"/><path d="M30 38l20-18 20 18-20 42-20-42z" stroke="white" stroke-width="6" stroke-linejoin="round"/><path d="M30 38h40M42 20l-4 18 12 42 12-42-4-18" stroke="white" stroke-width="4"/></svg>`
  },
  {
    id: 'industry',
    title: 'صنعتی و تجهیزات',
    svg: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none"><rect width="100" height="100" rx="20" fill="%23dc2626"/><path d="M35 30l30 30m-20-40a12 12 0 0115 15l-35 35a8 8 0 01-11-11l35-35a12 12 0 01-4-4z" stroke="white" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/></svg>`
  },
  {
    id: 'health',
    title: 'پزشکی و سلامت',
    svg: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none"><rect width="100" height="100" rx="20" fill="%230d9488"/><circle cx="50" cy="50" r="30" stroke="white" stroke-width="6"/><path d="M50 34v32m-16-16h32" stroke="white" stroke-width="8" stroke-linecap="round"/></svg>`
  },
  {
    id: 'minimal',
    title: 'مینیمال مدرن',
    svg: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none"><rect width="100" height="100" rx="20" fill="%231e293b"/><circle cx="50" cy="50" r="26" stroke="white" stroke-width="6"/><circle cx="50" cy="50" r="12" fill="%2338bdf8"/></svg>`
  }
];

// Preset footer descriptions
export const FOOTER_NOTE_PRESETS = [
  {
    title: 'مهلت تست ۲۴ ساعته',
    text: 'کالای فروخته شده در صورت سلامت فیزیکی تا ۲۴ ساعت دارای مهلت تست سلامت می‌باشد.'
  },
  {
    title: 'مهلت تسویه ۵ روزه',
    text: 'مهلت پرداخت و تسویه حساب این فاکتور حداکثر ۵ روز کاری پس از تاریخ صدور و تحویل کالا می‌باشد.'
  },
  {
    title: 'تحویل قطعی و سالم',
    text: 'امضای این فاکتور به منزله رویت، آزمایش و تحویل قطعی، کامل و بدون نقص کالا توسط خریدار است.'
  },
  {
    title: 'هماهنگی و ارسال رسمی',
    text: 'سفارشات طبق هماهنگی انجام شده ارسال گردید. از حسن انتخاب و همکاری صمیمانه شما سپاسگزاریم.'
  }
];

/**
 * Reusable Invoice Preview Sheet Component
 */
export interface LivePreviewSheetProps {
  config: PrintLayoutSettings;
  settings: StoreSettings;
  previewPageSize: 'a4' | 'a5';
  previewOrientation: 'portrait' | 'landscape';
  sampleItems: Array<{
    code: string;
    name: string;
    qty: number;
    unit: string;
    price: number;
    discount: number;
    total: number;
  }>;
  subtotal: number;
  totalDiscount: number;
  finalTotal: number;
  sampleNotes?: string;
  showMarginGuide?: boolean;
  containerId: string;
}

export const LiveInvoicePreviewSheet: React.FC<LivePreviewSheetProps> = ({
  config,
  settings,
  previewPageSize,
  previewOrientation,
  sampleItems,
  subtotal,
  totalDiscount,
  finalTotal,
  sampleNotes,
  showMarginGuide,
  containerId,
}) => {
  const isA5 = previewPageSize === 'a5';
  const isLandscape = previewOrientation === 'landscape';
  const currentLogo = config.customLogoUrl || settings.logo;
  const currentNotes = config.customFooterNotes || settings.invoiceFooterText || 'کالای فروخته شده در صورت سلامت فیزیکی تا ۲۴ ساعت دارای مهلت تست می‌باشد.';

  return (
    <div
      id={containerId}
      className={`print-container bg-white text-slate-800 transition-all duration-200 relative select-none ${
        isLandscape
          ? (isA5 ? 'w-full max-w-[620px] aspect-[1.414/1]' : 'w-full max-w-[780px] aspect-[1.414/1]')
          : (isA5 ? 'w-full max-w-[460px] aspect-[1/1.414]' : 'w-full max-w-[560px] aspect-[1/1.414]')
      } shadow-2xl rounded-sm border border-slate-300 mx-auto flex flex-col justify-between overflow-hidden`}
      style={{
        boxShadow: '0 10px 35px -5px rgba(0, 0, 0, 0.15), 0 0 1px 1px rgba(0, 0, 0, 0.05)',
        padding: `${config.pageMarginMm || (isA5 ? 4 : 6)}mm`,
        fontSize: `${config.baseFontSize}px`,
        lineHeight: 1.35,
        backgroundColor: '#ffffff'
      }}
    >
      {/* TOP ZONE: Header & Meta */}
      <div className="shrink-0 space-y-2">
        <div 
          className="invoice-header border-b-2 pb-2 transition-all flex items-center justify-between gap-3"
          style={{ borderColor: config.themeColor }}
        >
          <div className="flex items-center gap-2.5">
            {config.showStoreLogo !== false && (
              currentLogo ? (
                <img 
                  src={currentLogo} 
                  alt={settings.storeName || 'لوگو'} 
                  className="object-contain rounded-lg border border-slate-200 shrink-0 bg-white shadow-2xs"
                  style={{ 
                    height: `${config.logoHeight || 38}px`, 
                    maxHeight: `${config.logoHeight || 38}px`,
                    maxWidth: `${(config.logoHeight || 38) * 2.5}px`
                  }}
                />
              ) : (
                <span 
                  className="rounded-xl text-white flex items-center justify-center font-black text-sm shrink-0 shadow-2xs"
                  style={{ 
                    backgroundColor: config.themeColor,
                    width: `${config.logoHeight || 38}px`,
                    height: `${config.logoHeight || 38}px`,
                  }}
                >
                  {settings.storeName ? settings.storeName.charAt(0) : 'ف'}
                </span>
              )
            )}
            <div>
              <h2 
                className="font-black leading-tight tracking-tight"
                style={{ fontSize: `${config.headerTitleSize}px`, color: config.themeColor }}
              >
                {settings.storeName || 'فروشگاه سپهر'}
              </h2>
              <p className="text-[10px] text-slate-500 mt-0.5">
                {settings.tagline || 'توزیع‌کننده تجهیزات دیجیتال و اداری'}
              </p>
            </div>
          </div>

          <div className="text-left shrink-0">
            <div 
              className="font-black px-2.5 py-0.5 rounded border inline-block text-[11px]"
              style={{ borderColor: config.themeColor, color: config.themeColor }}
            >
              فاکتور رسمی فروش
            </div>
            <div className="text-[10px] text-slate-500 mt-1 flex items-center gap-2 font-mono">
              <span>شماره: <strong>۱۰۲۵</strong></span>
              <span>تاریخ: ۱۴۰۳/۰۷/۱۰</span>
            </div>
          </div>
        </div>

        {/* Customer & Info strip */}
        {isLandscape ? (
          <div 
            className="p-1.5 bg-slate-50 rounded-lg border border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-2 text-slate-700"
            style={{ fontSize: `${config.headerMetaSize}px` }}
          >
            <div><strong>خریدار:</strong> شرکت فناوری سپهر</div>
            <div><strong>شناسه اقتصادی:</strong> ۱۴۰۰۹۸۷۲۳۵</div>
            <div><strong>تلفن:</strong> ۰۲۱-۸۸۸۸۴۳۲۱</div>
            <div><strong>وضعیت تسویه:</strong> <span className="font-bold text-emerald-700">کامل نقدی</span></div>
          </div>
        ) : (
          <div 
            className="p-1.5 bg-slate-50 rounded-lg border border-slate-200 flex flex-wrap justify-between items-center gap-1.5 text-slate-700"
            style={{ fontSize: `${config.headerMetaSize}px` }}
          >
            <div><strong>خریدار:</strong> شرکت فناوری سپهر</div>
            <div><strong>تلفن:</strong> ۰۹۱۲۳۴۵۶۷۸۹</div>
            <div><strong>تسویه:</strong> <span className="font-bold text-emerald-700">کامل نقدی</span></div>
          </div>
        )}
      </div>

      {/* MIDDLE ZONE: Live Preview Table with WIDE Total Column */}
      <div className="invoice-table-box my-auto py-1 overflow-x-auto">
        <table 
          className="w-full text-right border-collapse border"
          style={{ 
            borderColor: config.tableBorderColor || '#cbd5e1',
            borderWidth: `${config.tableBorderWidth || 1}px`,
            borderStyle: config.tableBorderStyle || 'solid',
          }}
        >
          <thead>
            <tr 
              className="font-bold text-slate-800"
              style={{ 
                fontSize: `${config.tableHeaderSize}px`,
                backgroundColor: config.tableHeaderBg || '#f8fafc',
                color: config.tableHeaderTextColor || '#1e293b',
                borderColor: config.tableBorderColor || '#cbd5e1',
              }}
            >
              <th className="text-center" style={{ width: `${config.colWidthIndex}px`, padding: `${config.tableRowPaddingY}px ${config.tableCellPaddingX}px` }}>#</th>
              {config.showItemCodeCol !== false && (
                <th style={{ width: `${config.colWidthCode}px`, padding: `${config.tableRowPaddingY}px ${config.tableCellPaddingX}px` }}>کد</th>
              )}
              <th style={{ padding: `${config.tableRowPaddingY}px ${config.tableCellPaddingX}px` }}>شرح کالا / خدمات</th>
              <th className="text-center" style={{ width: `${config.colWidthQty}px`, padding: `${config.tableRowPaddingY}px ${config.tableCellPaddingX}px` }}>تعداد</th>
              {config.showItemUnitCol !== false && (
                <th className="text-center" style={{ width: `${config.colWidthUnit}px`, padding: `${config.tableRowPaddingY}px ${config.tableCellPaddingX}px` }}>واحد</th>
              )}
              <th className="text-left" style={{ width: `${config.colWidthPrice}px`, padding: `${config.tableRowPaddingY}px ${config.tableCellPaddingX}px` }}>قیمت واحد</th>
              {config.showItemDiscountCol !== false && (
                <th className="text-left" style={{ width: `${config.colWidthDiscount}px`, padding: `${config.tableRowPaddingY}px ${config.tableCellPaddingX}px` }}>تخفیف</th>
              )}
              <th className="text-left" style={{ width: `${config.colWidthTotal}px`, minWidth: `${config.colWidthTotal}px`, padding: `${config.tableRowPaddingY}px ${config.tableCellPaddingX}px` }}>
                مبلغ کل ({settings.currency})
              </th>
            </tr>
          </thead>
          <tbody>
            {sampleItems.map((item, idx) => (
              <tr 
                key={idx}
                className={config.tableZebraStriping !== false && idx % 2 === 1 ? 'bg-slate-50/70' : 'bg-white'}
                style={{ fontSize: `${config.tableBodySize}px` }}
              >
                <td className="text-center text-slate-400 font-mono align-middle" style={{ padding: `${config.tableRowPaddingY}px ${config.tableCellPaddingX}px`, border: `1px solid ${config.tableBorderColor || '#cbd5e1'}` }}>{toPersianDigits(idx + 1)}</td>
                {config.showItemCodeCol !== false && (
                  <td className="text-slate-600 font-mono align-middle" style={{ padding: `${config.tableRowPaddingY}px ${config.tableCellPaddingX}px`, border: `1px solid ${config.tableBorderColor || '#cbd5e1'}` }}>{toPersianDigits(item.code)}</td>
                )}
                <td className="font-bold text-slate-900 align-middle" style={{ padding: `${config.tableRowPaddingY}px ${config.tableCellPaddingX}px`, border: `1px solid ${config.tableBorderColor || '#cbd5e1'}` }}>{item.name}</td>
                <td className="text-center font-bold align-middle" style={{ padding: `${config.tableRowPaddingY}px ${config.tableCellPaddingX}px`, border: `1px solid ${config.tableBorderColor || '#cbd5e1'}` }}>{toPersianDigits(item.qty)}</td>
                {config.showItemUnitCol !== false && (
                  <td className="text-center text-slate-500 align-middle" style={{ padding: `${config.tableRowPaddingY}px ${config.tableCellPaddingX}px`, border: `1px solid ${config.tableBorderColor || '#cbd5e1'}` }}>{item.unit}</td>
                )}
                <td className="text-left font-mono align-middle" style={{ padding: `${config.tableRowPaddingY}px ${config.tableCellPaddingX}px`, border: `1px solid ${config.tableBorderColor || '#cbd5e1'}` }}>{formatPrice(item.price, '', false)}</td>
                {config.showItemDiscountCol !== false && (
                  <td className="text-left font-mono text-slate-500 align-middle" style={{ padding: `${config.tableRowPaddingY}px ${config.tableCellPaddingX}px`, border: `1px solid ${config.tableBorderColor || '#cbd5e1'}` }}>{item.discount > 0 ? formatPrice(item.discount, '', false) : '۰'}</td>
                )}
                <td className="text-left font-mono font-bold text-slate-900 align-middle" style={{ width: `${config.colWidthTotal}px`, minWidth: `${config.colWidthTotal}px`, padding: `${config.tableRowPaddingY}px ${config.tableCellPaddingX}px`, border: `1px solid ${config.tableBorderColor || '#cbd5e1'}` }}>
                  {formatPrice(item.total, '', false)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* BOTTOM ZONE: OPTIMIZED 3-ZONE BALANCED FOOTER */}
      <div className="shrink-0 mt-2">
        {isLandscape ? (
          <div className="pt-2 border-t-2 border-slate-300 grid grid-cols-12 gap-2.5 items-end">
            <div className="col-span-4 border border-slate-200 rounded-xl p-2 bg-slate-50/70 text-slate-700 space-y-1 text-right">
              <div className="flex items-center justify-between pb-0.5 border-b border-slate-200 text-[10px]">
                <span className="font-bold text-slate-700">روش پرداخت:</span>
                <span className="text-sky-900 bg-sky-100/90 font-bold px-1.5 py-0.5 rounded text-[9px]">تسویه کامل نقدی</span>
              </div>
              {sampleNotes && (
                <div className="text-[10px] text-slate-700"><strong>یادداشت:</strong> {sampleNotes}</div>
              )}
              {config.showTermsBlock !== false && (
                <div className="invoice-notes text-slate-500 leading-tight pt-0.5" style={{ fontSize: `${Math.max(7, config.notesFontSize - 1)}px` }}>{currentNotes}</div>
              )}
            </div>

            <div className="col-span-3 text-center text-slate-600">
              {config.showSignaturesBlock !== false && (
                <div className="grid grid-cols-2 gap-1.5 items-end border border-slate-200 rounded-xl p-1.5 bg-slate-50/50" style={{ minHeight: `${Math.max(30, Math.round(config.signatureBoxHeight * 0.8))}px` }}>
                  <div className="border-t border-dashed border-slate-300 pt-1 text-[9px]"><span className="font-bold text-slate-800 block">امضای خریدار</span></div>
                  <div className="border-t border-dashed border-slate-300 pt-1 text-[9px]"><span className="font-bold text-slate-800 block">امضای فروشنده</span></div>
                </div>
              )}
            </div>

            <div className="col-span-5">
              <div className="invoice-totals-box border border-slate-300 rounded-xl overflow-hidden shadow-2xs bg-white" style={{ fontSize: `${config.totalsSize}px` }}>
                <div className="flex items-center justify-between p-1.5 border-b border-slate-200 bg-slate-50 text-slate-600 text-xs">
                  <span>جمع ناخالص اقلام:</span>
                  <span className="font-mono font-bold text-slate-900">{formatPrice(subtotal, settings.currency)}</span>
                </div>
                {totalDiscount > 0 && config.showItemDiscountCol !== false && (
                  <div className="flex items-center justify-between p-1.5 border-b border-slate-200 text-rose-700 bg-white text-xs">
                    <span>مجموع تخفیفات:</span>
                    <span className="font-mono font-bold">-{formatPrice(totalDiscount, settings.currency)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between p-2 font-bold text-white" style={{ backgroundColor: config.themeColor }}>
                  <span className="text-xs">مبلغ نهایی قابل پرداخت:</span>
                  <span className="font-mono font-black text-sm tracking-tight text-emerald-400">{formatPrice(finalTotal, settings.currency)}</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-2 pt-1 border-t-2 border-slate-300">
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-stretch">
              <div className="sm:col-span-6 border border-slate-200 rounded-xl p-2 bg-slate-50/80 text-slate-700 space-y-1.5 text-right flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between pb-1 border-b border-slate-200 text-xs font-bold text-slate-800">
                    <span>روش پرداخت:</span>
                    <span className="text-sky-900 bg-sky-100/90 px-2 py-0.5 rounded text-[10px]">تسویه کامل نقدی</span>
                  </div>
                  {sampleNotes && (
                    <div className="text-xs text-slate-800 mt-1"><strong>یادداشت:</strong> {sampleNotes}</div>
                  )}
                </div>
                {config.showTermsBlock !== false && (
                  <div className="invoice-notes text-slate-500 leading-relaxed border-t border-slate-200/80 pt-1" style={{ fontSize: `${config.notesFontSize}px` }}>{currentNotes}</div>
                )}
              </div>

              <div className="sm:col-span-6">
                <div className="invoice-totals-box border border-slate-300 rounded-xl overflow-hidden shadow-2xs bg-white h-full flex flex-col justify-between" style={{ fontSize: `${config.totalsSize}px` }}>
                  <div className="p-1.5 border-b border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-600">
                    <span>جمع ناخالص اقلام:</span>
                    <span className="font-mono font-bold text-slate-900">{formatPrice(subtotal, settings.currency)}</span>
                  </div>
                  {totalDiscount > 0 && config.showItemDiscountCol !== false && (
                    <div className="p-1.5 border-b border-slate-200 bg-white flex items-center justify-between text-xs text-rose-700">
                      <span>مجموع تخفیفات:</span>
                      <span className="font-mono font-bold">-{formatPrice(totalDiscount, settings.currency)}</span>
                    </div>
                  )}
                  <div className="p-2.5 flex items-center justify-between font-bold text-white" style={{ backgroundColor: config.themeColor }}>
                    <span className="text-xs shrink-0">مبلغ قابل پرداخت:</span>
                    <span className="font-mono font-black text-sm sm:text-base tracking-tight text-emerald-400">{formatPrice(finalTotal, settings.currency)}</span>
                  </div>
                </div>
              </div>
            </div>

            {config.showSignaturesBlock !== false && (
              <div className="invoice-signatures grid grid-cols-2 text-center text-slate-600 border-t border-slate-200 items-end pt-1" style={{ minHeight: `${config.signatureBoxHeight}px` }}>
                <div className="border-t border-dashed border-slate-300 pt-1 mx-3"><span className="font-bold text-slate-800 text-[11px] block">مهر و امضای خریدار</span><span className="text-[9px] text-slate-400">کالا صحیح و سالم تحویل گردید</span></div>
                <div className="border-t border-dashed border-slate-300 pt-1 mx-3"><span className="font-bold text-slate-800 text-[11px] block">مهر و امضای فروشنده</span><span className="text-[9px] text-slate-400">{settings.storeName || 'فروشگاه'}</span></div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export const PrintLayoutCustomizer: React.FC<PrintLayoutCustomizerProps> = ({
  value,
  onChange,
  settings,
  onSave,
}) => {
  const config: PrintLayoutSettings = { ...DEFAULT_PRINT_LAYOUT, ...(value || {}) };
  const [activeTab, setActiveTab] = useState<'fonts' | 'table' | 'footer' | 'logo' | 'notes'>('table');
  const [previewPageSize, setPreviewPageSize] = useState<'a4' | 'a5'>('a4');
  const [previewOrientation, setPreviewOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [showSavedToast, setShowSavedToast] = useState(false);
  const [toastText, setToastText] = useState('تنظیمات ابعاد، فونت‌ها و ظاهر فاکتور با موفقیت ذخیره شد.');
  const [zoomLevel, setZoomLevel] = useState<number>(1.0);
  const [showMarginGuide, setShowMarginGuide] = useState<boolean>(false);
  const [isFullscreenModal, setIsFullscreenModal] = useState<boolean>(false);

  // In-App Draggable & Resizable Floating Detached Window
  const [detachedWindow, setDetachedWindow] = useState<{
    isOpen: boolean;
    isMinimized: boolean;
    x: number;
    y: number;
    width: number;
    height: number;
  }>({
    isOpen: false,
    isMinimized: false,
    x: 60,
    y: 80,
    width: 620,
    height: 680
  });

  const dragRef = useRef<{ isDragging: boolean; startX: number; startY: number; initX: number; initY: number }>({
    isDragging: false,
    startX: 0,
    startY: 0,
    initX: 0,
    initY: 0
  });

  const resizeRef = useRef<{ isResizing: boolean; startX: number; startY: number; initW: number; initH: number }>({
    isResizing: false,
    startX: 0,
    startY: 0,
    initW: 0,
    initH: 0
  });

  // Custom live preview notes text state for testing
  const [sampleLiveNote, setSampleLiveNote] = useState<string>('ارسال فوری با پیک اختصاصی - بسته تحویل جناب مهندس رضایی گردید.');
  const [urlInput, setUrlInput] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Synchronize across windows/tabs in 0ms!
  useEffect(() => {
    broadcastLivePreview({
      config,
      settings,
      previewPageSize,
      previewOrientation,
      sampleNotes: sampleLiveNote,
      updatedAt: Date.now()
    });
  }, [config, settings, previewPageSize, previewOrientation, sampleLiveNote]);

  const update = <K extends keyof PrintLayoutSettings>(key: K, val: PrintLayoutSettings[K]) => {
    onChange({
      ...config,
      [key]: val,
    });
  };

  const handleReset = () => {
    if (window.confirm('آیا مایلید تمام ابعاد، سایز فونت‌ها، عرض ستون‌ها و فاصله‌های چاپ به مقادیر پیش‌فرض اولیه بازنشانی شوند؟')) {
      onChange(DEFAULT_PRINT_LAYOUT);
    }
  };

  // تنظیم خودکار تمام تنظیمات به بهینه‌ترین و استانداردترین چیدمان
  const handleAutoOptimizeLayout = () => {
    const optimal: PrintLayoutSettings = {
      ...config,
      ...OPTIMAL_PRINT_LAYOUT,
      customLogoUrl: config.customLogoUrl,
      customFooterNotes: config.customFooterNotes || OPTIMAL_PRINT_LAYOUT.customFooterNotes,
    };
    onChange(optimal);
    broadcastLivePreview({
      config: optimal,
      settings: settings,
      previewPageSize,
      previewOrientation,
      mode: 'layout_config',
      updatedAt: Date.now(),
    });
    setToastText('✨ تمامی ابعاد، ستون‌ها، فونت‌ها و حاشیه‌ها با موفقیت به بهینه‌ترین حالت خودکار تنظیم شدند.');
    setShowSavedToast(true);
    setTimeout(() => setShowSavedToast(false), 3500);
  };

  const handleSaveClick = () => {
    if (onSave) onSave();
    setToastText('تنظیمات ابعاد، فونت‌ها و ظاهر فاکتور با موفقیت ذخیره شد.');
    setShowSavedToast(true);
    setTimeout(() => setShowSavedToast(false), 2500);
  };

  // Mock invoice data for live interactive preview
  const sampleItems = [
    { code: '۱۰۱', name: 'لپ‌تاپ گیمینگ ایسوس مدل ROG Strix', qty: 1, unit: 'دستگاه', price: 68500000, discount: 500000, total: 68000000 },
    { code: '۱۰۲', name: 'مانیتور ۲۷ اینچ خمیده سامسونگ', qty: 2, unit: 'عدد', price: 12400000, discount: 0, total: 24800000 },
    { code: '۱۰۳', name: 'کیبورد مکانیکال RGB تسکو', qty: 3, unit: 'عدد', price: 1850000, discount: 150000, total: 5400000 },
  ];

  const subtotal = sampleItems.reduce((s, it) => s + (it.price * it.qty), 0);
  const totalDiscount = sampleItems.reduce((s, it) => s + it.discount, 0);
  const finalTotal = subtotal - totalDiscount;

  // Open standalone browser window or tab (e.g. for second screen)
  const handleOpenBrowserWindow = () => {
    const previewUrl = `${window.location.origin}${window.location.pathname}?live-preview=1`;
    try {
      const newWin = window.open(
        previewUrl, 
        'SepehrLiveInvoicePreview', 
        'width=1000,height=960,menubar=no,toolbar=no,location=no,status=no,resizable=yes,scrollbars=yes'
      );
      if (!newWin || newWin.closed || typeof newWin.closed === 'undefined') {
        // Pop-up was blocked by browser or iframe -> Open detached floating window
        setDetachedWindow(prev => ({ ...prev, isOpen: true, isMinimized: false }));
        setToastText('پنجره شناور مستقل در داخل برنامه فعال شد (مرورگر پاپ‌آپ خارجی را مسدود کرده است).');
        setShowSavedToast(true);
        setTimeout(() => setShowSavedToast(false), 3500);
      } else {
        setToastText('پیش‌نمایش زنده در برگه/پنجره جدید مرورگر باز شد و همگام‌سازی بلادرنگ فعال است.');
        setShowSavedToast(true);
        setTimeout(() => setShowSavedToast(false), 3500);
      }
    } catch {
      setDetachedWindow(prev => ({ ...prev, isOpen: true, isMinimized: false }));
    }
  };

  // Test Print in new window
  const handleTestPrint = (targetId = 'admin-print-live-preview-box') => {
    printElementInNewWindow(
      targetId,
      `پیش‌نمایش تستی چاپ فاکتور (${previewPageSize.toUpperCase()} - ${previewOrientation === 'landscape' ? 'افقی' : 'عمودی'})`,
      { pageSize: previewPageSize, orientation: previewOrientation, marginMm: config.pageMarginMm }
    );
  };

  // Test PDF Export
  const handleTestPdf = async (targetId = 'admin-print-live-preview-box') => {
    await exportElementToPdf(
      targetId,
      `تست_خروجی_چاپ_${previewPageSize}_${previewOrientation}`,
      { pageSize: previewPageSize, orientation: previewOrientation, marginMm: config.pageMarginMm }
    );
  };

  // Handle Logo File Upload (PNG, JPG, SVG, WebP) -> Base64 Data URL
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('لطفاً یک فایل تصویری معتبر (PNG, JPG, SVG, WebP) انتخاب فرمایید.');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      alert('حجم فایل انتخابی بیش از ۲ مگابایت است. لطفاً تصویر کم‌حجم‌تری انتخاب فرمایید.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        update('customLogoUrl', reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleApplyLogoUrl = () => {
    if (!urlInput.trim()) return;
    update('customLogoUrl', urlInput.trim());
    setUrlInput('');
  };

  const handleRemoveLogo = () => {
    update('customLogoUrl', '');
  };

  const previewUrl = typeof window !== 'undefined' ? `${window.location.origin}${window.location.pathname}?live-preview=1` : '';

  // Docking handlers
  const handleDockLeft = () => {
    const targetW = Math.min(680, Math.max(380, Math.floor(window.innerWidth * 0.46)));
    setDetachedWindow(prev => ({
      ...prev,
      isOpen: true,
      isMinimized: false,
      x: 16,
      y: 60,
      width: targetW,
      height: Math.min(780, Math.floor(window.innerHeight * 0.85))
    }));
  };

  const handleDockRight = () => {
    const targetW = Math.min(680, Math.max(380, Math.floor(window.innerWidth * 0.46)));
    setDetachedWindow(prev => ({
      ...prev,
      isOpen: true,
      isMinimized: false,
      x: Math.max(16, window.innerWidth - targetW - 24),
      y: 60,
      width: targetW,
      height: Math.min(780, Math.floor(window.innerHeight * 0.85))
    }));
  };

  const handleDockCenter = () => {
    const targetW = Math.min(650, window.innerWidth - 40);
    const targetH = Math.min(720, window.innerHeight - 80);
    setDetachedWindow(prev => ({
      ...prev,
      isOpen: true,
      isMinimized: false,
      x: Math.max(16, Math.floor((window.innerWidth - targetW) / 2)),
      y: Math.max(20, Math.floor((window.innerHeight - targetH) / 2)),
      width: targetW,
      height: targetH
    }));
  };

  // Dragging event handlers for Floating Detached Window
  const handleDragStart = (e: React.MouseEvent) => {
    dragRef.current = {
      isDragging: true,
      startX: e.clientX,
      startY: e.clientY,
      initX: detachedWindow.x,
      initY: detachedWindow.y
    };

    const handleMouseMove = (moveEv: MouseEvent) => {
      if (!dragRef.current.isDragging) return;
      const dx = moveEv.clientX - dragRef.current.startX;
      const dy = moveEv.clientY - dragRef.current.startY;
      setDetachedWindow(prev => ({
        ...prev,
        x: Math.max(10, Math.min(window.innerWidth - 100, dragRef.current.initX + dx)),
        y: Math.max(10, Math.min(window.innerHeight - 100, dragRef.current.initY + dy))
      }));
    };

    const handleMouseUp = () => {
      dragRef.current.isDragging = false;
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  // Touch Dragging event handlers for Mobile/Tablets
  const handleTouchDragStart = (e: React.TouchEvent) => {
    if (e.touches.length === 0) return;
    const touch = e.touches[0];
    dragRef.current = {
      isDragging: true,
      startX: touch.clientX,
      startY: touch.clientY,
      initX: detachedWindow.x,
      initY: detachedWindow.y
    };

    const handleTouchMove = (moveEv: TouchEvent) => {
      if (!dragRef.current.isDragging || moveEv.touches.length === 0) return;
      const t = moveEv.touches[0];
      const dx = t.clientX - dragRef.current.startX;
      const dy = t.clientY - dragRef.current.startY;
      setDetachedWindow(prev => ({
        ...prev,
        x: Math.max(5, Math.min(window.innerWidth - 80, dragRef.current.initX + dx)),
        y: Math.max(5, Math.min(window.innerHeight - 80, dragRef.current.initY + dy))
      }));
    };

    const handleTouchEnd = () => {
      dragRef.current.isDragging = false;
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };

    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd);
  };

  // Resizing event handlers for Floating Detached Window
  const handleResizeStart = (e: React.MouseEvent) => {
    e.stopPropagation();
    resizeRef.current = {
      isResizing: true,
      startX: e.clientX,
      startY: e.clientY,
      initW: detachedWindow.width,
      initH: detachedWindow.height
    };

    const handleMouseMove = (moveEv: MouseEvent) => {
      if (!resizeRef.current.isResizing) return;
      const dx = moveEv.clientX - resizeRef.current.startX;
      const dy = moveEv.clientY - resizeRef.current.startY;
      setDetachedWindow(prev => ({
        ...prev,
        width: Math.max(360, Math.min(window.innerWidth - 30, resizeRef.current.initW + dx)),
        height: Math.max(340, Math.min(window.innerHeight - 30, resizeRef.current.initH + dy))
      }));
    };

    const handleMouseUp = () => {
      resizeRef.current.isResizing = false;
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  // Touch Resizing event handlers
  const handleTouchResizeStart = (e: React.TouchEvent) => {
    e.stopPropagation();
    if (e.touches.length === 0) return;
    const touch = e.touches[0];
    resizeRef.current = {
      isResizing: true,
      startX: touch.clientX,
      startY: touch.clientY,
      initW: detachedWindow.width,
      initH: detachedWindow.height
    };

    const handleTouchMove = (moveEv: TouchEvent) => {
      if (!resizeRef.current.isResizing || moveEv.touches.length === 0) return;
      const t = moveEv.touches[0];
      const dx = t.clientX - resizeRef.current.startX;
      const dy = t.clientY - resizeRef.current.startY;
      setDetachedWindow(prev => ({
        ...prev,
        width: Math.max(340, Math.min(window.innerWidth - 20, resizeRef.current.initW + dx)),
        height: Math.max(320, Math.min(window.innerHeight - 20, resizeRef.current.initH + dy))
      }));
    };

    const handleTouchEnd = () => {
      resizeRef.current.isResizing = false;
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };

    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd);
  };

  // Preset theme colors
  const themeColors = [
    { label: 'سرمه‌ای / مشکی کلاسیک', color: '#0f172a' },
    { label: 'طوسی نوک‌مدادی اداری', color: '#334155' },
    { label: 'سرمه‌ای رسمی دارایی', color: '#1e3a8a' },
    { label: 'آبی نفتی شرکتی', color: '#0369a1' },
    { label: 'سبز تیره فاخر', color: '#065f46' },
    { label: 'زرشکی و عنابی مدرن', color: '#881337' },
  ];

  return (
    <div className="space-y-6 text-slate-800">
      {/* Top Banner and Quick Actions - Optimized for Desktop & Mobile */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-850 to-slate-900 text-white p-4 sm:p-5 rounded-2xl shadow-lg border border-slate-700/80 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        {/* Info & Title Area */}
        <div className="space-y-1.5 min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-400/30 shrink-0">
              <Zap className="w-5 h-5" />
            </span>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base sm:text-lg font-black tracking-tight text-white">
                تنظیمات چاپ و قالب‌بندی ابعاد فاکتور
              </h3>
              <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-emerald-400 bg-emerald-950/80 px-2.5 py-0.5 rounded-full border border-emerald-700/50">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                <span>پیش‌نمایش بلادرنگ (۰ms)</span>
              </span>
            </div>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed max-w-2xl">
            شخصی‌سازی دقیق فونت‌ها، ابعاد ستون‌ها، حاشیه‌ها، نشان تجاری و متن شروط با پیش‌نمایش زنده در پنجره مستقل و شناور.
          </p>
        </div>

        {/* Action Buttons: Responsive Grid on Mobile, Neat Groups on Desktop */}
        <div className="flex flex-col sm:flex-row xl:flex-row items-stretch sm:items-center gap-2 flex-wrap shrink-0">
          {/* Group 1: Live Preview Options */}
          <div className="grid grid-cols-2 sm:flex sm:items-center gap-1.5 p-1 bg-slate-950/60 rounded-xl border border-slate-800">
            {/* Detached Floating Window */}
            <button
              type="button"
              onClick={() => setDetachedWindow(prev => ({ ...prev, isOpen: true, isMinimized: false }))}
              className={`px-3 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                detachedWindow.isOpen
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
              title="مشاهده پیش‌نمایش در یک پنجره شناور مجزا با قابلیت جابجایی"
            >
              <Square className="w-3.5 h-3.5 text-emerald-400" />
              <span>پنجره شناور</span>
            </button>

            {/* Separate Browser Window / Dual Screen */}
            <a
              href={previewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 text-slate-300 hover:text-white hover:bg-slate-800 transition-all cursor-pointer"
              title="باز کردن پیش‌نمایش زنده در برگه/پنجره جدید مرورگر یا مانیتور دوم"
            >
              <ExternalLink className="w-3.5 h-3.5 text-indigo-400" />
              <span>مانیتور دوم</span>
            </a>

            {/* Fullscreen Preview */}
            <button
              type="button"
              onClick={() => setIsFullscreenModal(true)}
              className="col-span-2 sm:col-span-1 px-3 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 text-slate-300 hover:text-white hover:bg-slate-800 transition-all cursor-pointer"
              title="مشاهده تمام‌صفحه پیش‌نمایش"
            >
              <Maximize2 className="w-3.5 h-3.5 text-sky-400" />
              <span>تمام‌صفحه</span>
            </button>
          </div>

          {/* Group 2: Output Tools & Management */}
          <div className="grid grid-cols-3 sm:flex sm:items-center gap-1.5">
            <button
              type="button"
              onClick={() => handleTestPrint('detached-live-preview-box')}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer border border-slate-700 shadow-2xs"
              title="تست مستقیم ارسال به پرینتر"
            >
              <Printer className="w-3.5 h-3.5 text-emerald-400" />
              <span>چاپ</span>
            </button>

            <button
              type="button"
              onClick={() => handleTestPdf('detached-live-preview-box')}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer border border-slate-700 shadow-2xs"
              title="تولید و دانلود آزمایشی فایل PDF"
            >
              <FileDown className="w-3.5 h-3.5 text-indigo-400" />
              <span>PDF</span>
            </button>

            <button
              type="button"
              onClick={handleReset}
              className="px-3 py-2 bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer border border-rose-500/30"
              title="بازنشانی تمام تنظیمات به مقادیر پیش‌فرض"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>پیش‌فرض</span>
            </button>
          </div>

          {/* Group 3: Auto-Optimize Best Layout & Save */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            {/* Best Layout Automatically Button */}
            <button
              type="button"
              id="btn-auto-optimize-layout"
              onClick={handleAutoOptimizeLayout}
              className="flex-1 sm:flex-initial px-4 py-2.5 bg-gradient-to-r from-amber-400 via-amber-300 to-emerald-400 hover:from-amber-300 hover:to-emerald-300 text-slate-950 font-black text-xs rounded-xl flex items-center justify-center gap-2 shadow-md shadow-amber-500/25 border border-amber-300/60 transition-all cursor-pointer active:scale-95 group"
              title="تنظیم خودکار تمام ابعاد، ستون‌ها، فونت‌ها و حاشیه‌ها به بهترین و بهینه‌ترین حالت استاندارد"
            >
              <Sparkles className="w-4 h-4 text-slate-950 group-hover:rotate-12 transition-transform" />
              <span>بهترین چیدمان خودکار</span>
              <span className="w-1.5 h-1.5 rounded-full bg-slate-950 animate-ping"></span>
            </button>

            {onSave && (
              <button
                type="button"
                onClick={handleSaveClick}
                className="flex-1 sm:flex-initial px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white rounded-xl text-xs font-black flex items-center justify-center gap-2 transition-all shadow-md shadow-emerald-950/40 cursor-pointer active:scale-98"
                title="ذخیره کلیه تنظیمات ابعاد و قالب‌بندی فاکتور"
              >
                <Check className="w-4 h-4 text-emerald-200" />
                <span>ذخیره نهایی</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Toast Notification on Save */}
      {showSavedToast && (
        <div className="bg-emerald-50 text-emerald-900 border border-emerald-300 p-3 rounded-xl text-xs font-bold flex items-center gap-2 animate-in fade-in duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{toastText}</span>
        </div>
      )}

      {/* Live Preview Bar */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2.5">
          <span className="p-2 bg-emerald-500/10 text-emerald-600 rounded-xl">
            <Eye className="w-4 h-4" />
          </span>
          <div>
            <h4 className="text-xs font-black text-slate-800">
              پیش‌نمایش زنده در پنجره مستقل و شناور
            </h4>
            <p className="text-[11px] text-slate-500">
              تغییرات اسلایدرها و مقادیر زیر به صورت بلادرنگ در پنجره جداگانه همگام‌سازی می‌شود.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Detached Window Toggle */}
          <button
            type="button"
            onClick={() => setDetachedWindow(prev => ({ ...prev, isOpen: !prev.isOpen, isMinimized: false }))}
            className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
              detachedWindow.isOpen
                ? 'bg-emerald-600 text-white border-emerald-700 shadow-2xs'
                : 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
            }`}
            title="مشاهده همزمان پیش‌نمایش زنده در پنجره شناور جداگانه"
          >
            <Square className="w-3.5 h-3.5" />
            <span>{detachedWindow.isOpen ? 'پنجره شناور فعال است ✓' : 'پنجره شناور جداگانه'}</span>
          </button>

          {/* Browser Tab Window */}
          <a
            href={previewUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl border border-slate-800 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
            title="باز کردن پیش‌نمایش در برگه/پنجره جدید مرورگر یا مانیتور دوم"
          >
            <ExternalLink className="w-3.5 h-3.5 text-emerald-400" />
            <span>برگه / مانیتور دوم</span>
          </a>

          {/* Fullscreen Preview Modal Toggle */}
          <button
            type="button"
            onClick={() => setIsFullscreenModal(true)}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl border border-slate-200 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
            title="مشاهده تمام‌صفحه"
          >
            <Maximize2 className="w-3.5 h-3.5" />
            <span>تمام‌صفحه</span>
          </button>
        </div>
      </div>

      {/* Settings Controls (Full Width) */}
      <div className="w-full space-y-4">
        {/* Navigation Sub-Tabs */}
            <div className="bg-slate-100 p-1.5 rounded-2xl flex items-center gap-1 border border-slate-200 overflow-x-auto">
              <button
                type="button"
                onClick={() => setActiveTab('table')}
                className={`flex-1 min-w-[105px] py-2 px-2.5 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  activeTab === 'table'
                    ? 'bg-white text-emerald-700 shadow-xs border border-slate-200/80'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                }`}
              >
                <Table className="w-4 h-4" />
                <span>جدول و ستون‌ها</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('footer')}
                className={`flex-1 min-w-[105px] py-2 px-2.5 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  activeTab === 'footer'
                    ? 'bg-white text-emerald-700 shadow-xs border border-slate-200/80'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                }`}
              >
                <Maximize2 className="w-4 h-4" />
                <span>فضای پایین و مبالغ</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('logo')}
                className={`flex-1 min-w-[105px] py-2 px-2.5 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  activeTab === 'logo'
                    ? 'bg-white text-emerald-700 shadow-xs border border-slate-200/80'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                }`}
              >
                <Image className="w-4 h-4" />
                <span>جایگذاری لوگو</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('notes')}
                className={`flex-1 min-w-[105px] py-2 px-2.5 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  activeTab === 'notes'
                    ? 'bg-white text-emerald-700 shadow-xs border border-slate-200/80'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                }`}
              >
                <FileText className="w-4 h-4" />
                <span>ویرایش شروط</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('fonts')}
                className={`flex-1 min-w-[105px] py-2 px-2.5 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  activeTab === 'fonts'
                    ? 'bg-white text-emerald-700 shadow-xs border border-slate-200/80'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                }`}
              >
                <Type className="w-4 h-4" />
                <span>فونت‌ها و رنگ</span>
              </button>
            </div>

            {/* TAB 1: TABLE & COLUMNS (Including prominent Wide Total Column) */}
            {activeTab === 'table' && (
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-5 animate-in fade-in">
                <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
                  <div>
                    <h4 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
                      <Table className="w-4 h-4 text-emerald-600" />
                      <span>ابعاد جدول، ردیف‌ها و تنظیم ستون مبلغ کل</span>
                    </h4>
                    <p className="text-[11px] text-slate-500 mt-1">
                      می‌توانید ستون مبلغ کل را عریض‌تر کنید تا مبالغ میلیونی و میلیاردی بدون فشردگی نمایش یابند.
                    </p>
                  </div>
                  <span className="hidden sm:inline-flex items-center gap-1 text-[10px] text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full font-bold">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
                    همگام‌سازی زنده
                  </span>
                </div>

                {/* PROMINENT: Total Column Width Slider & Presets */}
                <div className="p-4 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-2xl border border-emerald-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="p-1.5 bg-emerald-600 text-white rounded-lg text-xs font-black">
                        مبلغ کل
                      </span>
                      <span className="font-black text-sm text-emerald-950">عرض ستون مبلغ کل:</span>
                    </div>
                    <div className="flex items-center gap-1 font-mono font-black text-emerald-700 text-sm bg-white px-3 py-1 rounded-lg border border-emerald-300">
                      <span>{toPersianDigits(config.colWidthTotal)}</span>
                      <span className="text-xs text-slate-500">px</span>
                    </div>
                  </div>

                  <input
                    type="range"
                    min={110}
                    max={260}
                    step={5}
                    value={config.colWidthTotal}
                    onChange={(e) => update('colWidthTotal', Number(e.target.value))}
                    className="w-full h-2 bg-emerald-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                  />

                  {/* Preset Chips */}
                  <div className="flex items-center gap-1.5 flex-wrap pt-1">
                    <span className="text-[10px] text-emerald-800 font-bold">اندازه‌های پیشنهادی:</span>
                    {[
                      { label: 'عادی (۱۴۰px)', val: 140 },
                      { label: 'عریض استاندارد (۱۶۵px)', val: 165 },
                      { label: 'فوق‌عریض (۲۰۰px)', val: 200 },
                      { label: 'حداکثر فضا (۲۴۰px)', val: 240 },
                    ].map((p) => (
                      <button
                        key={p.val}
                        type="button"
                        onClick={() => update('colWidthTotal', p.val)}
                        className={`text-[10px] font-bold px-2 py-1 rounded-lg border transition-all cursor-pointer ${
                          config.colWidthTotal === p.val
                            ? 'bg-emerald-600 text-white border-emerald-700 shadow-2xs'
                            : 'bg-white hover:bg-emerald-100/60 text-slate-700 border-slate-300'
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 1. Row Height (Padding Y) */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-slate-700">ارتفاع ردیف‌ها (پدینگ عمودی):</span>
                    <span className="font-mono text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      {toPersianDigits(config.tableRowPaddingY)} px
                    </span>
                  </div>
                  <input
                    type="range"
                    min={2}
                    max={14}
                    step={1}
                    value={config.tableRowPaddingY}
                    onChange={(e) => update('tableRowPaddingY', Number(e.target.value))}
                    className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                  />
                  <div className="flex justify-between text-[10px] text-slate-400">
                    <span>فوق فشرده (جا شدن اقلام بیشتر)</span>
                    <span>معمولی</span>
                    <span>باز و درشت</span>
                  </div>
                </div>

                {/* 2. Cell Padding X */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-slate-700">فاصله افقی سلول‌ها (پدینگ افقی):</span>
                    <span className="font-mono text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      {toPersianDigits(config.tableCellPaddingX)} px
                    </span>
                  </div>
                  <input
                    type="range"
                    min={3}
                    max={12}
                    step={1}
                    value={config.tableCellPaddingX}
                    onChange={(e) => update('tableCellPaddingX', Number(e.target.value))}
                    className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                  />
                </div>

                {/* 3. Table Column Widths Grid */}
                <div className="pt-2 border-t border-slate-100">
                  <div className="flex items-center justify-between mb-2 flex-wrap gap-1.5">
                    <h5 className="font-bold text-xs text-slate-800">عرض ستون‌های جدول (پیکسل):</h5>
                    <button
                      type="button"
                      onClick={() => {
                        onChange({
                          ...config,
                          colWidthIndex: OPTIMAL_PRINT_LAYOUT.colWidthIndex,
                          colWidthCode: OPTIMAL_PRINT_LAYOUT.colWidthCode,
                          colWidthQty: OPTIMAL_PRINT_LAYOUT.colWidthQty,
                          colWidthUnit: OPTIMAL_PRINT_LAYOUT.colWidthUnit,
                          colWidthPrice: OPTIMAL_PRINT_LAYOUT.colWidthPrice,
                          colWidthDiscount: OPTIMAL_PRINT_LAYOUT.colWidthDiscount,
                          colWidthTotal: OPTIMAL_PRINT_LAYOUT.colWidthTotal,
                        });
                        setToastText('✨ عرض ستون‌ها به بهترین و متوازن‌ترین تناسب استاندارد تنظیم شد.');
                        setShowSavedToast(true);
                        setTimeout(() => setShowSavedToast(false), 2500);
                      }}
                      className="text-[11px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2.5 py-1 rounded-lg flex items-center gap-1 transition-colors cursor-pointer active:scale-95"
                      title="تنظیم خودکار ابعاد ستون‌ها بر اساس تناسب استاندارد طلایی فاکتور"
                    >
                      <Sparkles className="w-3 h-3 text-emerald-600" />
                      <span>تنظیم خودکار تناسب ستون‌ها</span>
                    </button>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
                    {/* Col: Index */}
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 flex items-center justify-between">
                      <span className="text-slate-600 font-bold">ردیف:</span>
                      <input
                        type="number"
                        min={24}
                        max={60}
                        value={config.colWidthIndex}
                        onChange={(e) => update('colWidthIndex', Number(e.target.value))}
                        className="w-14 bg-white border border-slate-300 rounded px-1.5 py-0.5 text-center font-mono font-bold text-xs"
                      />
                    </div>

                    {/* Col: Code */}
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 flex items-center justify-between">
                      <span className="text-slate-600 font-bold">کد کالا:</span>
                      <input
                        type="number"
                        min={40}
                        max={120}
                        value={config.colWidthCode}
                        onChange={(e) => update('colWidthCode', Number(e.target.value))}
                        className="w-14 bg-white border border-slate-300 rounded px-1.5 py-0.5 text-center font-mono font-bold text-xs"
                      />
                    </div>

                    {/* Col: Qty */}
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 flex items-center justify-between">
                      <span className="text-slate-600 font-bold">تعداد:</span>
                      <input
                        type="number"
                        min={35}
                        max={90}
                        value={config.colWidthQty}
                        onChange={(e) => update('colWidthQty', Number(e.target.value))}
                        className="w-14 bg-white border border-slate-300 rounded px-1.5 py-0.5 text-center font-mono font-bold text-xs"
                      />
                    </div>

                    {/* Col: Unit */}
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 flex items-center justify-between">
                      <span className="text-slate-600 font-bold">واحد:</span>
                      <input
                        type="number"
                        min={35}
                        max={90}
                        value={config.colWidthUnit}
                        onChange={(e) => update('colWidthUnit', Number(e.target.value))}
                        className="w-14 bg-white border border-slate-300 rounded px-1.5 py-0.5 text-center font-mono font-bold text-xs"
                      />
                    </div>

                    {/* Col: Price */}
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 flex items-center justify-between">
                      <span className="text-slate-600 font-bold">قیمت واحد:</span>
                      <input
                        type="number"
                        min={70}
                        max={150}
                        value={config.colWidthPrice}
                        onChange={(e) => update('colWidthPrice', Number(e.target.value))}
                        className="w-14 bg-white border border-slate-300 rounded px-1.5 py-0.5 text-center font-mono font-bold text-xs"
                      />
                    </div>

                    {/* Col: Discount */}
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 flex items-center justify-between">
                      <span className="text-slate-600 font-bold">تخفیف:</span>
                      <input
                        type="number"
                        min={50}
                        max={120}
                        value={config.colWidthDiscount}
                        onChange={(e) => update('colWidthDiscount', Number(e.target.value))}
                        className="w-14 bg-white border border-slate-300 rounded px-1.5 py-0.5 text-center font-mono font-bold text-xs"
                      />
                    </div>
                  </div>
                </div>

                {/* 4. Zebra Striping */}
                <label className="flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100/80 rounded-xl border border-slate-200 cursor-pointer transition-colors text-xs">
                  <div>
                    <span className="font-bold text-slate-800 block">سطرهای یک‌درمیان رنگی (Zebra Striping)</span>
                    <span className="text-[10px] text-slate-500">برای خوانایی بهتر ردیف‌های جدول در فاکتورهای پر از قلم کالا</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={config.tableZebraStriping !== false}
                    onChange={(e) => update('tableZebraStriping', e.target.checked)}
                    className="w-4 h-4 text-emerald-600 rounded cursor-pointer"
                  />
                </label>
              </div>
            )}

            {/* TAB 2: FOOTER, TOTALS DECK & SIGNATURES */}
            {activeTab === 'footer' && (
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-5 animate-in fade-in">
                <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
                  <div>
                    <h4 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
                      <Maximize2 className="w-4 h-4 text-emerald-600" />
                      <span>فضای پایین صفحه، کارت مبالغ کل و کادر امضاها</span>
                    </h4>
                    <p className="text-[11px] text-slate-500 mt-1">
                      فضای پایین صفحه شامل روش پرداخت، توضیحات، کارت مبالغ کل و کادر مهر و امضا با تناسب دقیق بهینه‌سازی شده است.
                    </p>
                  </div>
                  <span className="hidden sm:inline-flex items-center gap-1 text-[10px] text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full font-bold">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
                    همگام‌سازی زنده
                  </span>
                </div>

                {/* Structure Explanation Banner */}
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600 space-y-1.5">
                  <div className="font-bold text-slate-800 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                    <span>بهینه‌سازی فضای پایین در اندازه A4 و A5:</span>
                  </div>
                  <p className="text-[11px] leading-relaxed">
                    • در <strong>چاپ افقی (Landscape)</strong>: چیدمان متوازن ۳ گانه (توضیحات و پرداخت راست، امضاها وسط، مبالغ کل عریض چپ) فعال است تا ارتفاع بیهوده مصرف نشود.
                    <br />
                    • در <strong>چاپ عمودی (Portrait)</strong>: کارت مبالغ کل عریض در کنار توضیحات پرداخت قرار گرفته و کادر امضا در زیر آن با ارتفاع کنترل‌شده تعبیه گردیده است.
                  </p>
                </div>

                {/* 1. Totals Font Size */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-slate-700">سایز قلم مبالغ کل و جمع نهایی:</span>
                    <span className="font-mono text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      {toPersianDigits(config.totalsSize)} px
                    </span>
                  </div>
                  <input
                    type="range"
                    min={10}
                    max={20}
                    step={1}
                    value={config.totalsSize}
                    onChange={(e) => update('totalsSize', Number(e.target.value))}
                    className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                  />
                </div>

                {/* 2. Signature Box Height */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-slate-700">ارتفاع کادر مهر و امضای طرفین:</span>
                    <span className="font-mono text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      {toPersianDigits(config.signatureBoxHeight)} px
                    </span>
                  </div>
                  <input
                    type="range"
                    min={30}
                    max={120}
                    step={5}
                    value={config.signatureBoxHeight}
                    onChange={(e) => update('signatureBoxHeight', Number(e.target.value))}
                    className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                  />
                  <div className="flex justify-between text-[10px] text-slate-400">
                    <span>فشرده (۳۰px)</span>
                    <span>معمولی (۶۵px)</span>
                    <span>بزرگ برای مهر شرکتی (۱۲۰px)</span>
                  </div>
                </div>

                {/* 3. Page Margin MM */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-slate-700">حاشیه کاغذ چاپ (میلی‌متر):</span>
                    <span className="font-mono text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      {toPersianDigits(config.pageMarginMm)} mm
                    </span>
                  </div>
                  <input
                    type="range"
                    min={2}
                    max={20}
                    step={1}
                    value={config.pageMarginMm}
                    onChange={(e) => update('pageMarginMm', Number(e.target.value))}
                    className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                  />
                  <div className="flex justify-between text-[10px] text-slate-400">
                    <span>کمترین حاشیه (۲mm)</span>
                    <span>استاندارد (۶mm)</span>
                    <span>حاشیه پهن (۲۰mm)</span>
                  </div>
                </div>

                {/* 4. Toggles for Signatures and Terms */}
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <label className="flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100/80 rounded-xl border border-slate-200 cursor-pointer transition-colors text-xs">
                    <div>
                      <span className="font-bold text-slate-800 block">نمایش کادر مهر و امضای طرفین در پایین فاکتور</span>
                      <span className="text-[10px] text-slate-500">کادر امضای خریدار و مهر و امضای فروشگاه</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={config.showSignaturesBlock !== false}
                      onChange={(e) => update('showSignaturesBlock', e.target.checked)}
                      className="w-4 h-4 text-emerald-600 rounded cursor-pointer"
                    />
                  </label>

                  <label className="flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100/80 rounded-xl border border-slate-200 cursor-pointer transition-colors text-xs">
                    <div>
                      <span className="font-bold text-slate-800 block">نمایش کادر شروط و توضیحات پایانی</span>
                      <span className="text-[10px] text-slate-500">متن ضمانت، شرایط تسویه و پیام سپاسگزاری</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={config.showTermsBlock !== false}
                      onChange={(e) => update('showTermsBlock', e.target.checked)}
                      className="w-4 h-4 text-emerald-600 rounded cursor-pointer"
                    />
                  </label>
                </div>
              </div>
            )}

            {/* TAB 3: LOGO & HEADER BRANDING */}
            {activeTab === 'logo' && (
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-5 animate-in fade-in">
                <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
                  <div>
                    <h4 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
                      <Image className="w-4 h-4 text-emerald-600" />
                      <span>جایگذاری لوگو، آرم و هویت بصری سربرگ فاکتور</span>
                    </h4>
                    <p className="text-[11px] text-slate-500 mt-1">
                      می‌توانید تصویر آرم و لوگوی فروشگاه خود را بارگذاری کرده یا از بین نمادهای تجاری آماده انتخاب فرمایید.
                    </p>
                  </div>
                  <span className="hidden sm:inline-flex items-center gap-1 text-[10px] text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full font-bold">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
                    همگام‌سازی زنده
                  </span>
                </div>

                {/* Logo Visibility Toggle */}
                <label className="flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100/80 rounded-xl border border-slate-200 cursor-pointer transition-colors text-xs">
                  <div>
                    <span className="font-bold text-slate-800 block">نمایش لوگوی فروشگاه در سربرگ فاکتور</span>
                    <span className="text-[10px] text-slate-500">در صورت غیرفعال بودن، تنها عنوان متنی نمایش داده خواهد شد</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={config.showStoreLogo !== false}
                    onChange={(e) => update('showStoreLogo', e.target.checked)}
                    className="w-4 h-4 text-emerald-600 rounded cursor-pointer"
                  />
                </label>

                {/* Current Active Logo Preview & Actions */}
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                  <span className="text-xs font-bold text-slate-700 block">لوگوی فعال فعلی:</span>
                  <div className="flex items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200">
                    <div className="flex items-center gap-3">
                      {config.customLogoUrl || settings.logo ? (
                        <img
                          src={config.customLogoUrl || settings.logo}
                          alt="لوگو"
                          className="h-12 max-h-12 w-auto object-contain rounded-lg border border-slate-200 bg-white p-1"
                        />
                      ) : (
                        <div 
                          className="w-12 h-12 rounded-xl text-white flex items-center justify-center font-black text-lg"
                          style={{ backgroundColor: config.themeColor }}
                        >
                          {settings.storeName ? settings.storeName.charAt(0) : 'ف'}
                        </div>
                      )}
                      <div>
                        <div className="font-bold text-xs text-slate-800">
                          {config.customLogoUrl || settings.logo ? 'تصویر لوگوی اختصاصی بارگذاری شده' : 'نشان پیش‌فرض با حرف اول نام فروشگاه'}
                        </div>
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          ارتفاع فعلی: {toPersianDigits(config.logoHeight || 40)} پیکسل
                        </div>
                      </div>
                    </div>

                    {(config.customLogoUrl || settings.logo) && (
                      <button
                        type="button"
                        onClick={handleRemoveLogo}
                        className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-xs font-bold flex items-center gap-1 border border-rose-200 cursor-pointer transition-colors"
                        title="حذف لوگو و بازگشت به نشان متنی"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>حذف لوگو</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Direct File Upload Dropzone */}
                <div className="space-y-2">
                  <span className="text-xs font-bold text-slate-800 block">۱. آپلود مستقیم فایل تصویر از کامپیوتر یا موبایل:</span>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    accept="image/png, image/jpeg, image/jpg, image/svg+xml, image/webp"
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full py-4 px-4 bg-emerald-50 hover:bg-emerald-100/70 border-2 border-dashed border-emerald-300 rounded-2xl flex flex-col items-center justify-center gap-2 cursor-pointer transition-all text-emerald-800"
                  >
                    <Upload className="w-6 h-6 text-emerald-600" />
                    <span className="text-xs font-black">انتخاب و بارگذاری تصویر لوگو (PNG, JPG, SVG, WebP)</span>
                    <span className="text-[10px] text-slate-500">حداکثر حجم ۲ مگابایت — تصویر به صورت خودکار آفلاین ذخیره می‌شود</span>
                  </button>
                </div>

                {/* Or Enter Logo URL */}
                <div className="space-y-1.5 pt-2 border-t border-slate-100">
                  <span className="text-xs font-bold text-slate-800 block">۲. یا درج آدرس اینترنتی تصویر (Image URL):</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="url"
                      value={urlInput}
                      onChange={(e) => setUrlInput(e.target.value)}
                      placeholder="https://example.com/logo.png"
                      className="flex-1 bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono text-left focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                      dir="ltr"
                    />
                    <button
                      type="button"
                      onClick={handleApplyLogoUrl}
                      disabled={!urlInput.trim()}
                      className="px-3 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shrink-0"
                    >
                      ثبت لینک
                    </button>
                  </div>
                </div>

                {/* Ready-made Vector Presets */}
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <span className="text-xs font-bold text-slate-800 block">۳. یا انتخاب از نشان‌های آماده تجاری:</span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {PRESET_LOGOS.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => update('customLogoUrl', item.svg)}
                        className="p-2.5 bg-slate-50 hover:bg-emerald-50 rounded-xl border border-slate-200 hover:border-emerald-300 flex flex-col items-center gap-1.5 transition-all cursor-pointer group"
                      >
                        <img src={item.svg} alt={item.title} className="w-8 h-8 object-contain" />
                        <span className="text-[10px] font-bold text-slate-700 group-hover:text-emerald-800 text-center">
                          {item.title}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Logo Height Slider */}
                <div className="space-y-1.5 pt-2 border-t border-slate-100">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-slate-700">ارتفاع و اندازه نمایش لوگو:</span>
                    <span className="font-mono text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      {toPersianDigits(config.logoHeight || 40)} px
                    </span>
                  </div>
                  <input
                    type="range"
                    min={24}
                    max={80}
                    step={2}
                    value={config.logoHeight || 40}
                    onChange={(e) => update('logoHeight', Number(e.target.value))}
                    className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                  />
                  <div className="flex justify-between text-[10px] text-slate-400">
                    <span>کوچک (۲۴px)</span>
                    <span>متوسط (۴۰px)</span>
                    <span>بزرگ (۸۰px)</span>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 4: EDIT NOTES & TERMS */}
            {activeTab === 'notes' && (
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-5 animate-in fade-in">
                <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
                  <div>
                    <h4 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
                      <FileText className="w-4 h-4 text-emerald-600" />
                      <span>ویرایش متن توضیحات، شروط فروش و پاورقی فاکتور</span>
                    </h4>
                    <p className="text-[11px] text-slate-500 mt-1">
                      متن پیش‌فرض شروط و توضیحات پاورقی که در پایین برگه فاکتور چاپ می‌شود را به دلخواه ویرایش فرمایید.
                    </p>
                  </div>
                  <span className="hidden sm:inline-flex items-center gap-1 text-[10px] text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full font-bold">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
                    همگام‌سازی زنده
                  </span>
                </div>

                {/* Footer Terms Textarea */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center text-xs">
                    <label className="font-bold text-slate-700">متن شروط و ضوابط پیش‌فرض فاکتور:</label>
                    <button
                      type="button"
                      onClick={() => update('customFooterNotes', DEFAULT_PRINT_LAYOUT.customFooterNotes || '')}
                      className="text-[10px] text-slate-500 hover:text-emerald-700 flex items-center gap-1 cursor-pointer"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>بازنشانی به متن اولیه</span>
                    </button>
                  </div>
                  <textarea
                    value={config.customFooterNotes ?? (settings.invoiceFooterText || 'کالای فروخته شده در صورت سلامت فیزیکی تا ۲۴ ساعت دارای مهلت تست می‌باشد.')}
                    onChange={(e) => update('customFooterNotes', e.target.value)}
                    rows={3}
                    placeholder="متن شروط گارانتی، مهلت تسویه، پیام تشکر..."
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-xs leading-relaxed text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                {/* Ready Presets for Quick Insertion */}
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <span className="text-xs font-bold text-slate-800 block">عبارات آماده تجاری (کلیک جهت درج سریع):</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {FOOTER_NOTE_PRESETS.map((p, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => update('customFooterNotes', p.text)}
                        className="p-2.5 bg-slate-50 hover:bg-emerald-50 text-right rounded-xl border border-slate-200 hover:border-emerald-300 transition-all cursor-pointer group"
                      >
                        <div className="font-bold text-xs text-slate-800 group-hover:text-emerald-900">{p.title}</div>
                        <div className="text-[10px] text-slate-500 line-clamp-1 mt-0.5">{p.text}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Notes Font Size */}
                <div className="space-y-1.5 pt-2 border-t border-slate-100">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-slate-700">اندازه قلم متن توضیحات و شروط:</span>
                    <span className="font-mono text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      {toPersianDigits(config.notesFontSize)} px
                    </span>
                  </div>
                  <input
                    type="range"
                    min={7}
                    max={14}
                    step={1}
                    value={config.notesFontSize}
                    onChange={(e) => update('notesFontSize', Number(e.target.value))}
                    className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                  />
                </div>

                {/* Sample Note in Live Preview */}
                <div className="space-y-1.5 pt-2 border-t border-slate-100">
                  <label className="text-xs font-bold text-slate-800 block">آزمایش متن یادداشت فاکتور در پیش‌نمایش زنده:</label>
                  <input
                    type="text"
                    value={sampleLiveNote}
                    onChange={(e) => setSampleLiveNote(e.target.value)}
                    placeholder="یادداشت فاکتور تستی برای مشاهده در پیش‌نمایش..."
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              </div>
            )}

            {/* TAB 5: FONTS & COLOR THEME */}
            {activeTab === 'fonts' && (
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-5 animate-in fade-in">
                <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
                  <div>
                    <h4 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
                      <Type className="w-4 h-4 text-emerald-600" />
                      <span>تنظیم مقیاس قلم‌ها و رنگ‌بندی تم فاکتور</span>
                    </h4>
                    <p className="text-[11px] text-slate-500 mt-1">
                      سایز متن‌های هر بخش را متناسب با سلیقه و نوع چاپگر خود (لیزری، جوهرافشان یا حرارتی) تنظیم فرمایید.
                    </p>
                  </div>
                  <span className="hidden sm:inline-flex items-center gap-1 text-[10px] text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full font-bold">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
                    همگام‌سازی زنده
                  </span>
                </div>

                {/* Theme Color Selector */}
                <div className="space-y-2">
                  <span className="font-bold text-xs text-slate-700 block">رنگ تم و کادرهای فاکتور:</span>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {themeColors.map((t) => (
                      <button
                        key={t.color}
                        type="button"
                        onClick={() => update('themeColor', t.color)}
                        className={`p-2 rounded-xl border text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                          config.themeColor === t.color
                            ? 'border-emerald-600 bg-emerald-50/50 shadow-2xs'
                            : 'border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <span className="w-4 h-4 rounded-full border border-black/10 shrink-0" style={{ backgroundColor: t.color }}></span>
                        <span className="text-[11px] truncate">{t.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Base Font Size */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-slate-700">سایز فونت پایه کل برگه:</span>
                    <span className="font-mono text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      {toPersianDigits(config.baseFontSize)} px
                    </span>
                  </div>
                  <input
                    type="range"
                    min={9}
                    max={16}
                    step={1}
                    value={config.baseFontSize}
                    onChange={(e) => update('baseFontSize', Number(e.target.value))}
                    className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                  />
                </div>

                {/* Header Title Size */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-slate-700">سایز نام فروشگاه و سربرگ:</span>
                    <span className="font-mono text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      {toPersianDigits(config.headerTitleSize)} px
                    </span>
                  </div>
                  <input
                    type="range"
                    min={12}
                    max={26}
                    step={1}
                    value={config.headerTitleSize}
                    onChange={(e) => update('headerTitleSize', Number(e.target.value))}
                    className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                  />
                </div>

                {/* Header Meta Size */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-slate-700">سایز مشخصات خریدار و تاریخ:</span>
                    <span className="font-mono text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      {toPersianDigits(config.headerMetaSize)} px
                    </span>
                  </div>
                  <input
                    type="range"
                    min={9}
                    max={14}
                    step={1}
                    value={config.headerMetaSize}
                    onChange={(e) => update('headerMetaSize', Number(e.target.value))}
                    className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                  />
                </div>

                {/* Table Body Text Size */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-slate-700">سایز متن ردیف‌های اقلام جدول:</span>
                    <span className="font-mono text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      {toPersianDigits(config.tableBodySize)} px
                    </span>
                  </div>
                  <input
                    type="range"
                    min={9}
                    max={15}
                    step={1}
                    value={config.tableBodySize}
                    onChange={(e) => update('tableBodySize', Number(e.target.value))}
                    className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                  />
                </div>
              </div>
            )}
      </div>

      {/* DRAGGABLE & RESIZABLE FLOATING DETACHED WINDOW (مشاهده در پنجره جداگانه شناور) */}
      {detachedWindow.isOpen && (
        <div
          className="fixed z-50 bg-slate-900 text-white rounded-2xl shadow-2xl border border-slate-700 flex flex-col overflow-hidden transition-shadow select-none"
          style={{
            left: `${detachedWindow.x}px`,
            top: `${detachedWindow.y}px`,
            width: detachedWindow.isMinimized ? '280px' : `${detachedWindow.width}px`,
            height: detachedWindow.isMinimized ? 'auto' : `${detachedWindow.height}px`,
            boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.7)'
          }}
        >
          {/* Window Header (Draggable Handle) */}
          <div
            onMouseDown={handleDragStart}
            onTouchStart={handleTouchDragStart}
            className="p-3 bg-slate-950/95 border-b border-slate-800 flex items-center justify-between cursor-move text-white shrink-0"
            title="برای جابجایی پنجره بکشید (Drag to move)"
          >
            <div className="flex items-center gap-2">
              <span className="p-1 bg-emerald-500/20 text-emerald-400 rounded-md">
                <Move className="w-3.5 h-3.5" />
              </span>
              <span className="text-xs font-black tracking-tight">
                پیش‌نمایش زنده در پنجره جداگانه
              </span>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
            </div>

            <div className="flex items-center gap-1" onMouseDown={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()}>
              {/* Docking Controls */}
              <div className="hidden sm:flex items-center bg-slate-900 rounded p-0.5 border border-slate-800 text-[10px] text-slate-400">
                <button
                  type="button"
                  onClick={handleDockLeft}
                  className="px-1.5 py-0.5 hover:text-white hover:bg-slate-800 rounded cursor-pointer transition-colors"
                  title="پین به سمت چپ صفحه"
                >
                  چپ
                </button>
                <button
                  type="button"
                  onClick={handleDockCenter}
                  className="px-1.5 py-0.5 hover:text-white hover:bg-slate-800 rounded cursor-pointer transition-colors"
                  title="مرکز صفحه"
                >
                  وسط
                </button>
                <button
                  type="button"
                  onClick={handleDockRight}
                  className="px-1.5 py-0.5 hover:text-white hover:bg-slate-800 rounded cursor-pointer transition-colors"
                  title="پین به سمت راست صفحه"
                >
                  راست
                </button>
              </div>

              {/* Pop to external browser window */}
              <a
                href={previewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 text-indigo-400 hover:text-white rounded hover:bg-slate-800 cursor-pointer transition-colors flex items-center"
                title="باز کردن در برگه جداگانه مرورگر / مانیتور دوم"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>

              {/* Minimize/Restore */}
              <button
                type="button"
                onClick={() => setDetachedWindow(prev => ({ ...prev, isMinimized: !prev.isMinimized }))}
                className="p-1.5 text-slate-400 hover:text-white rounded hover:bg-slate-800 cursor-pointer transition-colors"
                title={detachedWindow.isMinimized ? 'بزرگ کردن پنجره' : 'کوچک کردن پنجره'}
              >
                <Minus className="w-3.5 h-3.5" />
              </button>

              {/* Maximize to full modal */}
              <button
                type="button"
                onClick={() => {
                  setDetachedWindow(prev => ({ ...prev, isOpen: false }));
                  setIsFullscreenModal(true);
                }}
                className="p-1.5 text-slate-400 hover:text-white rounded hover:bg-slate-800 cursor-pointer transition-colors"
                title="تمام‌صفحه"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>

              {/* Close */}
              <button
                type="button"
                onClick={() => setDetachedWindow(prev => ({ ...prev, isOpen: false }))}
                className="p-1.5 text-slate-400 hover:text-rose-400 rounded hover:bg-slate-800 cursor-pointer transition-colors"
                title="بستن پنجره شناور"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Window Body (When not minimized) */}
          {!detachedWindow.isMinimized && (
            <>
              {/* Window Controls Bar */}
              <div className="p-2 bg-slate-900 border-b border-slate-800 flex items-center justify-between gap-2 text-xs flex-wrap shrink-0">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setPreviewPageSize(previewPageSize === 'a4' ? 'a5' : 'a4')}
                    className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-emerald-400 rounded border border-slate-700 font-bold font-mono text-[11px]"
                  >
                    {previewPageSize.toUpperCase()}
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewOrientation(previewOrientation === 'portrait' ? 'landscape' : 'portrait')}
                    className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 font-bold text-[11px]"
                  >
                    {previewOrientation === 'landscape' ? 'افقی' : 'عمودی'}
                  </button>
                </div>

                <div className="flex items-center gap-1 text-[11px]">
                  <button
                    type="button"
                    onClick={() => handleTestPrint('detached-live-preview-box')}
                    className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded text-slate-300 hover:text-white"
                    title="چاپ"
                  >
                    <Printer className="w-3.5 h-3.5 text-emerald-400" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleTestPdf('detached-live-preview-box')}
                    className="p-1.5 bg-indigo-600 hover:bg-indigo-500 rounded text-white"
                    title="دانلود PDF"
                  >
                    <FileDown className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Scrollable Preview Workspace */}
              <div className="flex-1 overflow-auto bg-slate-200/90 p-4 flex items-center justify-center relative">
                <div className="scale-[0.85] origin-top transform-gpu">
                  <LiveInvoicePreviewSheet
                    config={config}
                    settings={settings}
                    previewPageSize={previewPageSize}
                    previewOrientation={previewOrientation}
                    sampleItems={sampleItems}
                    subtotal={subtotal}
                    totalDiscount={totalDiscount}
                    finalTotal={finalTotal}
                    sampleNotes={sampleLiveNote}
                    showMarginGuide={showMarginGuide}
                    containerId="detached-live-preview-box"
                  />
                </div>

                {/* Resize Handle at Bottom Corner */}
                <div
                  onMouseDown={handleResizeStart}
                  onTouchStart={handleTouchResizeStart}
                  className="absolute bottom-1 left-1 w-5 h-5 cursor-nwse-resize text-slate-500 hover:text-emerald-400 flex items-center justify-center p-1"
                  title="برای تغییر اندازه بکشید (Drag to resize)"
                >
                  <div className="w-2.5 h-2.5 border-b-2 border-l-2 border-slate-400"></div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Persistent Quick Action Button to toggle detached window anywhere */}
      {!detachedWindow.isOpen && (
        <button
          type="button"
          onClick={() => setDetachedWindow(prev => ({ ...prev, isOpen: true, isMinimized: false }))}
          className="fixed bottom-6 left-6 z-40 bg-slate-900/95 hover:bg-slate-800 text-white px-3.5 py-2.5 rounded-2xl shadow-2xl border border-slate-700/90 flex items-center gap-2 text-xs font-black backdrop-blur-md cursor-pointer transition-all hover:scale-105 active:scale-95 group"
          title="مشاهده همزمان پیش‌نمایش در پنجره شناور جداگانه"
        >
          <span className="p-1.5 bg-emerald-500/20 text-emerald-400 rounded-lg group-hover:bg-emerald-500 group-hover:text-white transition-colors">
            <Square className="w-4 h-4" />
          </span>
          <span className="hidden sm:inline">پنجره شناور پیش‌نمایش</span>
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
        </button>
      )}

      {/* Fullscreen Preview Modal */}
      {isFullscreenModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex flex-col p-4 sm:p-6 overflow-hidden animate-in fade-in duration-200">
          {/* Modal Header */}
          <div className="bg-slate-900 text-white p-3.5 rounded-2xl flex items-center justify-between gap-3 shadow-lg border border-slate-800 shrink-0 mb-4">
            <div className="flex items-center gap-2.5">
              <span className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl">
                <Eye className="w-5 h-5" />
              </span>
              <div>
                <h3 className="font-black text-sm sm:text-base">
                  پیش‌نمایش تمام‌صفحه و با کیفیت واقعی فاکتور
                </h3>
                <p className="text-[11px] text-slate-400">
                  سایز برگه: {previewPageSize.toUpperCase()} | حالت: {previewOrientation === 'landscape' ? 'افقی' : 'عمودی'}
                </p>
              </div>
            </div>

            {/* Quick Sizing & Actions */}
            <div className="flex items-center gap-2">
              <div className="hidden sm:flex items-center bg-slate-800 rounded-xl p-1 border border-slate-700">
                <button
                  type="button"
                  onClick={() => setPreviewPageSize('a4')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    previewPageSize === 'a4' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  A4
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewPageSize('a5')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    previewPageSize === 'a5' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  A5
                </button>
              </div>

              <div className="hidden sm:flex items-center bg-slate-800 rounded-xl p-1 border border-slate-700">
                <button
                  type="button"
                  onClick={() => setPreviewOrientation('portrait')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    previewOrientation === 'portrait' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  عمودی
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewOrientation('landscape')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    previewOrientation === 'landscape' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  افقی
                </button>
              </div>

              <button
                type="button"
                onClick={handleOpenBrowserWindow}
                className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                title="باز کردن در برگه جداگانه مرورگر"
              >
                <ExternalLink className="w-3.5 h-3.5 text-indigo-400" />
                <span className="hidden sm:inline">برگه مستقل</span>
              </button>

              <button
                type="button"
                onClick={() => handleTestPrint('admin-print-modal-preview-box')}
                className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5 text-emerald-400" />
                <span>چاپ</span>
              </button>

              <button
                type="button"
                onClick={() => handleTestPdf('admin-print-modal-preview-box')}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <FileDown className="w-3.5 h-3.5" />
                <span>دانلود PDF</span>
              </button>

              <button
                type="button"
                onClick={() => setIsFullscreenModal(false)}
                className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl transition-colors cursor-pointer border border-slate-700"
                title="بستن پنجره"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Modal Content Scroll Area */}
          <div className="flex-1 overflow-auto bg-slate-900/60 p-4 sm:p-8 rounded-3xl border border-slate-800 flex items-center justify-center">
            <LiveInvoicePreviewSheet
              config={config}
              settings={settings}
              previewPageSize={previewPageSize}
              previewOrientation={previewOrientation}
              sampleItems={sampleItems}
              subtotal={subtotal}
              totalDiscount={totalDiscount}
              finalTotal={finalTotal}
              sampleNotes={sampleLiveNote}
              showMarginGuide={showMarginGuide}
              containerId="admin-print-modal-preview-box"
            />
          </div>
        </div>
      )}
    </div>
  );
};
