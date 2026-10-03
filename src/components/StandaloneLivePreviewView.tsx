import React, { useState, useEffect } from 'react';
import { PrintLayoutSettings, DEFAULT_PRINT_LAYOUT, StoreSettings } from '../types';
import { StorageService } from '../utils/storage';
import { subscribeLivePreview, LivePreviewSyncData, LiveInvoiceDraft } from '../utils/livePreviewSync';
import { printElementInNewWindow, exportElementToPdf } from '../utils/pdfHelper';
import { toPersianDigits, formatPrice } from '../utils/jalali';
import { 
  Eye, 
  Printer, 
  FileDown, 
  ZoomIn, 
  ZoomOut, 
  RectangleHorizontal, 
  RectangleVertical, 
  Scan, 
  Sparkles, 
  Zap, 
  Layers,
  ArrowRight,
  Maximize2,
  Minimize2,
  Copy,
  Check,
  RotateCcw,
  CheckCircle2,
  FileText
} from 'lucide-react';

export const StandaloneLivePreviewView: React.FC<{ onBackToApp?: () => void }> = ({ onBackToApp }) => {
  const initialSettings = StorageService.getSettings();
  const [config, setConfig] = useState<PrintLayoutSettings>(initialSettings.printLayout || DEFAULT_PRINT_LAYOUT);
  const [settings, setSettings] = useState<StoreSettings>(initialSettings);
  const [previewPageSize, setPreviewPageSize] = useState<'a4' | 'a5'>('a4');
  const [previewOrientation, setPreviewOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [sampleNotes, setSampleNotes] = useState<string>('ارسال فوری با پیک اختصاصی - بسته تحویل جناب مهندس رضایی گردید.');
  const [draftInvoice, setDraftInvoice] = useState<LiveInvoiceDraft | null>(null);
  const [activeSource, setActiveSource] = useState<'config' | 'draft'>('config');
  const [zoomLevel, setZoomLevel] = useState<number>(0.95);
  const [showMarginGuide, setShowMarginGuide] = useState<boolean>(true);
  const [lastUpdate, setLastUpdate] = useState<number>(Date.now());
  const [isLiveConnected, setIsLiveConnected] = useState<boolean>(true);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);

  // Default sample items if no draft is present
  const defaultSampleItems = [
    { code: '۱۰۱', name: 'لپ‌تاپ گیمینگ ایسوس مدل ROG Strix', qty: 1, unit: 'دستگاه', price: 68500000, discount: 500000, total: 68000000 },
    { code: '۱۰۲', name: 'مانیتور ۲۷ اینچ خمیده سامسونگ', qty: 2, unit: 'عدد', price: 12400000, discount: 0, total: 24800000 },
    { code: '۱۰۳', name: 'کیبورد مکانیکال RGB تسکو', qty: 3, unit: 'عدد', price: 1850000, discount: 150000, total: 5400000 },
  ];

  useEffect(() => {
    const unsubscribe = subscribeLivePreview((data: LivePreviewSyncData) => {
      if (data.config) setConfig(data.config);
      if (data.settings) setSettings(data.settings);
      if (data.previewPageSize) setPreviewPageSize(data.previewPageSize);
      if (data.previewOrientation) setPreviewOrientation(data.previewOrientation);
      if (data.sampleNotes !== undefined) setSampleNotes(data.sampleNotes);
      if (data.draftInvoice) {
        setDraftInvoice(data.draftInvoice);
        setActiveSource('draft');
      } else if (data.mode === 'layout_config') {
        setActiveSource('config');
      }
      setLastUpdate(Date.now());
      setIsLiveConnected(true);
    });

    return () => unsubscribe();
  }, []);

  // Listen to fullscreen changes
  useEffect(() => {
    const handleFs = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFs);
    return () => document.removeEventListener('fullscreenchange', handleFs);
  }, []);

  const isA5 = previewPageSize === 'a5';
  const isLandscape = previewOrientation === 'landscape';
  const currentLogo = config.customLogoUrl || settings.logo;
  const currentNotes = config.customFooterNotes || settings.invoiceFooterText || 'کالای فروخته شده در صورت سلامت فیزیکی تا ۲۴ ساعت دارای مهلت تست می‌باشد.';

  const isUsingDraft = activeSource === 'draft' && draftInvoice && draftInvoice.items.length > 0;
  
  const displayItems = isUsingDraft 
    ? draftInvoice.items.map(it => ({
        code: it.code || '---',
        name: it.productName,
        qty: it.quantity,
        unit: it.unit || 'عدد',
        price: it.unitPrice,
        discount: it.discount || 0,
        total: it.total
      }))
    : defaultSampleItems;

  const subtotal = isUsingDraft ? draftInvoice.subtotal : defaultSampleItems.reduce((s, it) => s + (it.price * it.qty), 0);
  const totalDiscount = isUsingDraft ? draftInvoice.totalDiscount : defaultSampleItems.reduce((s, it) => s + it.discount, 0);
  const finalTotal = isUsingDraft ? draftInvoice.finalTotal : subtotal - totalDiscount;
  const displayNotes = isUsingDraft ? (draftInvoice.notes || sampleNotes) : sampleNotes;
  const displayCustomerName = isUsingDraft ? draftInvoice.customerName : 'شرکت فناوری سپهر';
  const displayInvoiceNum = isUsingDraft ? draftInvoice.invoiceNumber : '۱۰۲۵';
  const displayDate = isUsingDraft ? draftInvoice.date : '۱۴۰۳/۰۷/۱۰';

  const autoFitToWindow = () => {
    const containerWidth = window.innerWidth - 60;
    const targetWidth = isLandscape ? (isA5 ? 620 : 840) : (isA5 ? 480 : 620);
    const calculatedScale = Math.min(1.25, Math.max(0.45, Number((containerWidth / targetWidth).toFixed(2))));
    setZoomLevel(calculatedScale);
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  const handleCopyLink = () => {
    try {
      const url = window.location.href;
      navigator.clipboard.writeText(url);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {}
  };

  const handleTestPrint = () => {
    printElementInNewWindow(
      'standalone-live-preview-sheet',
      `پیش‌نمایش زنده فاکتور (${previewPageSize.toUpperCase()} - ${isLandscape ? 'افقی' : 'عمودی'})`,
      { pageSize: previewPageSize, orientation: previewOrientation, marginMm: config.pageMarginMm }
    );
  };

  const handleTestPdf = async () => {
    await exportElementToPdf(
      'standalone-live-preview-sheet',
      `پیش‌نمایش_فاکتور_${previewPageSize}_${previewOrientation}`,
      { pageSize: previewPageSize, orientation: previewOrientation, marginMm: config.pageMarginMm }
    );
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col font-['Vazirmatn'] selection:bg-emerald-500 selection:text-white" dir="rtl">
      {/* Top Application Bar */}
      <header className="bg-slate-900/90 backdrop-blur-md border-b border-slate-800 p-3 sm:px-6 sticky top-0 z-50 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          {onBackToApp && (
            <button
              type="button"
              onClick={onBackToApp}
              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer border border-slate-700"
              title="بازگشت به پنل اصلی سامانه"
            >
              <ArrowRight className="w-4 h-4" />
              <span className="hidden sm:inline">بازگشت به برنامه</span>
            </button>
          )}

          <div className="flex items-center gap-2">
            <span className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30">
              <Eye className="w-5 h-5" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm sm:text-base font-black tracking-tight text-white">
                  پیش‌نمایش زنده در پنجره مستقل
                </h1>
                <span className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded-full border border-emerald-700/50">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                  <span>متصل بلادرنگ (۰ میلی‌ثانیه)</span>
                </span>
                {draftInvoice && (
                  <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-bold text-indigo-300 bg-indigo-950/80 px-2 py-0.5 rounded-full border border-indigo-700/50">
                    <FileText className="w-3 h-3 text-indigo-400" />
                    <span>فاکتور در حال صدور</span>
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400">
                هرگونه تغییر در تنظیمات ابعاد، فونت، متن یا اقلام فاکتور بلافاصله در این پنجره منعکس می‌گردد.
              </p>
            </div>
          </div>
        </div>

        {/* Paper Size, Orientation, Zoom and Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Paper Size */}
          <div className="flex items-center bg-slate-800 rounded-xl p-1 border border-slate-700">
            <button
              type="button"
              onClick={() => setPreviewPageSize('a4')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                previewPageSize === 'a4' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
              }`}
            >
              A4
            </button>
            <button
              type="button"
              onClick={() => setPreviewPageSize('a5')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                previewPageSize === 'a5' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
              }`}
            >
              A5
            </button>
          </div>

          {/* Orientation */}
          <div className="flex items-center bg-slate-800 rounded-xl p-1 border border-slate-700">
            <button
              type="button"
              onClick={() => setPreviewOrientation('portrait')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 transition-all cursor-pointer ${
                previewOrientation === 'portrait' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
              }`}
            >
              <RectangleVertical className="w-3.5 h-3.5" />
              <span>عمودی</span>
            </button>
            <button
              type="button"
              onClick={() => setPreviewOrientation('landscape')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 transition-all cursor-pointer ${
                previewOrientation === 'landscape' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
              }`}
            >
              <RectangleHorizontal className="w-3.5 h-3.5" />
              <span>افقی</span>
            </button>
          </div>

          {/* Zoom & Fit */}
          <div className="flex items-center bg-slate-800 rounded-xl p-1 border border-slate-700 text-slate-300">
            <button
              type="button"
              onClick={() => setZoomLevel(prev => Math.max(0.4, Number((prev - 0.1).toFixed(2))))}
              className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-white cursor-pointer"
              title="کوچک‌نمایی"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setZoomLevel(1.0)}
              className="px-2 py-0.5 text-xs font-mono font-bold hover:text-emerald-400 cursor-pointer"
              title="زوم ۱۰۰٪"
            >
              {Math.round(zoomLevel * 100)}%
            </button>
            <button
              type="button"
              onClick={() => setZoomLevel(prev => Math.min(1.5, Number((prev + 0.1).toFixed(2))))}
              className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-white cursor-pointer"
              title="بزرگ‌نمایی"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={autoFitToWindow}
              className="px-2 py-0.5 text-[11px] bg-slate-700 hover:bg-slate-600 rounded text-emerald-400 font-bold cursor-pointer mr-1"
              title="اندازه‌گیری خودکار بر اساس صفحه"
            >
              Auto-Fit
            </button>
          </div>

          {/* Margin Guide Toggle */}
          <button
            type="button"
            onClick={() => setShowMarginGuide(!showMarginGuide)}
            className={`p-2 rounded-xl border text-xs cursor-pointer transition-colors ${
              showMarginGuide
                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
            }`}
            title="راهنمای حاشیه چاپ"
          >
            <Scan className="w-4 h-4" />
          </button>

          {/* Fullscreen Button */}
          <button
            type="button"
            onClick={toggleFullscreen}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl border border-slate-700 cursor-pointer transition-colors"
            title={isFullscreen ? 'خروج از تمام‌صفحه' : 'تمام‌صفحه'}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4 text-amber-400" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          {/* Copy Link */}
          <button
            type="button"
            onClick={handleCopyLink}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl border border-slate-700 cursor-pointer transition-colors"
            title="کپی لینک اختصاصی این پنجره"
          >
            {copiedLink ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
          </button>

          {/* Print & PDF */}
          <button
            type="button"
            onClick={handleTestPrint}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer border border-slate-700"
          >
            <Printer className="w-4 h-4 text-emerald-400" />
            <span>چاپ</span>
          </button>

          <button
            type="button"
            onClick={handleTestPdf}
            className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-md shadow-indigo-900/30"
          >
            <FileDown className="w-4 h-4" />
            <span>دانلود PDF</span>
          </button>
        </div>
      </header>

      {/* Main Preview Sheet Container */}
      <main className="flex-1 p-4 sm:p-8 flex items-center justify-center overflow-auto">
        <div 
          className="transition-transform duration-150 ease-out"
          style={{ transform: `scale(${zoomLevel})`, transformOrigin: 'top center' }}
        >
          <div
            id="standalone-live-preview-sheet"
            className={`print-container bg-white text-slate-800 transition-all relative select-none ${
              isLandscape
                ? (isA5 ? 'w-[620px] aspect-[1.414/1]' : 'w-[840px] aspect-[1.414/1]')
                : (isA5 ? 'w-[480px] aspect-[1/1.414]' : 'w-[620px] aspect-[1/1.414]')
            } shadow-2xl rounded-sm border border-slate-300 mx-auto flex flex-col justify-between overflow-hidden`}
            style={{
              padding: `${config.pageMarginMm || (isA5 ? 4 : 6)}mm`,
              fontSize: `${config.baseFontSize}px`,
              lineHeight: 1.35,
              backgroundColor: '#ffffff'
            }}
          >
            {/* Margin Guidelines */}
            {showMarginGuide && (
              <div 
                className="absolute inset-0 pointer-events-none border border-dashed border-emerald-400/40 z-20"
                style={{ margin: `${config.pageMarginMm || (isA5 ? 4 : 6)}mm` }}
              >
                <span className="absolute top-1 right-1 text-[8px] font-mono text-emerald-800 bg-emerald-100/90 px-1 py-0.5 rounded border border-emerald-300">
                  حاشیه چاپ: {toPersianDigits(config.pageMarginMm || (isA5 ? 4 : 6))}mm
                </span>
              </div>
            )}

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
                    <span>شماره: <strong>{toPersianDigits(displayInvoiceNum)}</strong></span>
                    <span>تاریخ: {toPersianDigits(displayDate)}</span>
                  </div>
                </div>
              </div>

              {/* Customer Info Strip */}
              {isLandscape ? (
                <div 
                  className="p-1.5 bg-slate-50 rounded-lg border border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-2 text-slate-700"
                  style={{ fontSize: `${config.headerMetaSize}px` }}
                >
                  <div><strong>خریدار:</strong> {displayCustomerName}</div>
                  <div><strong>شناسه / تلفن:</strong> {draftInvoice?.customerPhone ? toPersianDigits(draftInvoice.customerPhone) : '۰۲۱-۸۸۸۸۴۳۲۱'}</div>
                  <div><strong>نوع فاکتور:</strong> {draftInvoice?.isProforma ? 'پیش‌فاکتور' : 'فروش قطعی'}</div>
                  <div><strong>وضعیت تسویه:</strong> <span className="font-bold text-emerald-700">{draftInvoice?.paymentMethod || 'کامل نقدی'}</span></div>
                </div>
              ) : (
                <div 
                  className="p-1.5 bg-slate-50 rounded-lg border border-slate-200 flex flex-wrap justify-between items-center gap-1.5 text-slate-700"
                  style={{ fontSize: `${config.headerMetaSize}px` }}
                >
                  <div><strong>خریدار:</strong> {displayCustomerName}</div>
                  <div><strong>تلفن:</strong> {draftInvoice?.customerPhone ? toPersianDigits(draftInvoice.customerPhone) : '۰۹۱۲۳۴۵۶۷۸۹'}</div>
                  <div><strong>تسویه:</strong> <span className="font-bold text-emerald-700">{draftInvoice?.paymentMethod || 'کامل نقدی'}</span></div>
                </div>
              )}
            </div>

            {/* MIDDLE ZONE: Table with Wide Total Column */}
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
                  {displayItems.map((item, idx) => (
                    <tr 
                      key={idx}
                      className={config.tableZebraStriping !== false && idx % 2 === 1 ? 'bg-slate-50/70' : 'bg-white'}
                      style={{ fontSize: `${config.tableBodySize}px` }}
                    >
                      <td className="text-center font-mono text-slate-400" style={{ padding: `${config.tableRowPaddingY}px ${config.tableCellPaddingX}px`, border: `1px solid ${config.tableBorderColor || '#cbd5e1'}` }}>{toPersianDigits(idx + 1)}</td>
                      {config.showItemCodeCol !== false && (
                        <td className="text-slate-600 font-mono" style={{ padding: `${config.tableRowPaddingY}px ${config.tableCellPaddingX}px`, border: `1px solid ${config.tableBorderColor || '#cbd5e1'}` }}>{toPersianDigits(item.code)}</td>
                      )}
                      <td className="font-bold text-slate-900" style={{ padding: `${config.tableRowPaddingY}px ${config.tableCellPaddingX}px`, border: `1px solid ${config.tableBorderColor || '#cbd5e1'}` }}>{item.name}</td>
                      <td className="text-center font-bold" style={{ padding: `${config.tableRowPaddingY}px ${config.tableCellPaddingX}px`, border: `1px solid ${config.tableBorderColor || '#cbd5e1'}` }}>{toPersianDigits(item.qty)}</td>
                      {config.showItemUnitCol !== false && (
                        <td className="text-center text-slate-500" style={{ padding: `${config.tableRowPaddingY}px ${config.tableCellPaddingX}px`, border: `1px solid ${config.tableBorderColor || '#cbd5e1'}` }}>{item.unit}</td>
                      )}
                      <td className="text-left font-mono" style={{ padding: `${config.tableRowPaddingY}px ${config.tableCellPaddingX}px`, border: `1px solid ${config.tableBorderColor || '#cbd5e1'}` }}>{formatPrice(item.price, '', false)}</td>
                      {config.showItemDiscountCol !== false && (
                        <td className="text-left font-mono text-slate-500" style={{ padding: `${config.tableRowPaddingY}px ${config.tableCellPaddingX}px`, border: `1px solid ${config.tableBorderColor || '#cbd5e1'}` }}>{item.discount > 0 ? formatPrice(item.discount, '', false) : '۰'}</td>
                      )}
                      <td className="text-left font-mono font-bold text-slate-900" style={{ width: `${config.colWidthTotal}px`, minWidth: `${config.colWidthTotal}px`, padding: `${config.tableRowPaddingY}px ${config.tableCellPaddingX}px`, border: `1px solid ${config.tableBorderColor || '#cbd5e1'}` }}>
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
                      <span className="text-sky-900 bg-sky-100/90 font-bold px-1.5 py-0.5 rounded text-[9px]">{draftInvoice?.paymentMethod || 'تسویه کامل نقدی'}</span>
                    </div>
                    {displayNotes && (
                      <div className="text-[10px] text-slate-700"><strong>یادداشت:</strong> {displayNotes}</div>
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
                          <span className="text-sky-900 bg-sky-100/90 px-2 py-0.5 rounded text-[10px]">{draftInvoice?.paymentMethod || 'تسویه کامل نقدی'}</span>
                        </div>
                        {displayNotes && (
                          <div className="text-xs text-slate-800 mt-1"><strong>یادداشت:</strong> {displayNotes}</div>
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
        </div>
      </main>
    </div>
  );
};
