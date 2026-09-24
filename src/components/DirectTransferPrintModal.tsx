import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Printer, 
  Car, 
  User, 
  Phone, 
  Calendar, 
  Clock, 
  FileText, 
  CheckCircle2, 
  Share2,
  Building2,
  ShieldCheck,
  Wrench,
  FileDown,
  Download,
  Loader2,
  Check,
  Copy,
  ExternalLink,
  Smartphone,
  Layers,
  Sparkles,
  AlertCircle
} from 'lucide-react';
import { DirectTransfer, StoreSettings, PdfQualityPreset } from '../types';
import { exportElementToPdf, printElementDirectly, printElementInNewWindow, PDF_QUALITY_PRESETS } from '../utils/pdfHelper';
import { toPersianDigits, getCurrentJalaliDate, getCurrentJalaliTime } from '../utils/jalali';
import { parseVehicleInfo, MiniIranPlate } from './IranPlatePicker';

interface DirectTransferPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  transfer: DirectTransfer | null;
  settings: StoreSettings;
  autoExportPdf?: boolean;
}

export const DirectTransferPrintModal: React.FC<DirectTransferPrintModalProps> = ({
  isOpen,
  onClose,
  transfer,
  settings,
  autoExportPdf = false,
}) => {
  const [pageSize, setPageSize] = useState<'a4' | 'a5'>('a4');
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [quality, setQuality] = useState<PdfQualityPreset>(settings.pdfExitSlipQuality || 'high');
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [statusNotification, setStatusNotification] = useState<string | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [copiedText, setCopiedText] = useState(false);
  const hasAutoExported = useRef(false);

  useEffect(() => {
    if (isOpen && autoExportPdf && transfer && !hasAutoExported.current) {
      hasAutoExported.current = true;
      const timer = setTimeout(() => {
        handleExportPdf();
      }, 350);
      return () => clearTimeout(timer);
    }
    if (!isOpen) {
      hasAutoExported.current = false;
    }
  }, [isOpen, autoExportPdf, transfer]);

  if (!isOpen || !transfer) return null;

  const showNotification = (msg: string) => {
    setStatusNotification(msg);
    setTimeout(() => {
      setStatusNotification(null);
    }, 4500);
  };

  const getTypeBadge = () => {
    switch (transfer.type) {
      case 'repair':
        return { label: 'اعزام به تعمیرگاه و سرویس فنی', color: 'bg-amber-100 text-amber-900 border-amber-300' };
      case 'temporary_loan':
        return { label: 'خروج امانی و تست کالا', color: 'bg-blue-100 text-blue-900 border-blue-300' };
      case 'internal_use':
        return { label: 'مصرف داخلی و کارگاه', color: 'bg-slate-100 text-slate-800 border-slate-300' };
      case 'sample':
        return { label: 'نمونه‌گیری و آزمایشگاهی', color: 'bg-purple-100 text-purple-900 border-purple-300' };
      default:
        return { label: 'خروج مستقیم بدون فاکتور', color: 'bg-slate-100 text-slate-800 border-slate-300' };
    }
  };

  const getStatusBadge = () => {
    switch (transfer.status) {
      case 'dispatched':
        return { label: 'خارج از انبار (در جریان)', color: 'bg-amber-500 text-white' };
      case 'partially_returned':
        return { label: 'بخشی بازگشته به انبار', color: 'bg-indigo-500 text-white' };
      case 'returned':
        return { label: 'به طور کامل به انبار بازگشت', color: 'bg-emerald-600 text-white' };
      case 'completed_no_return':
        return { label: 'مختومه (بدون نیاز به بازگشت)', color: 'bg-slate-600 text-white' };
    }
  };

  const typeInfo = getTypeBadge();
  const statusInfo = getStatusBadge();

  // Export DOM to PDF using pdfHelper
  const handleExportPdf = async () => {
    try {
      setIsExportingPdf(true);
      const safeNum = transfer.transferNumber.replace(/[^a-zA-Z0-9_-]/g, '_');
      const filename = `حواله_خروج_دستگاه_امانی_${safeNum}_${pageSize}_${orientation}`;
      const result = await exportElementToPdf('printable-direct-transfer-slip', filename, {
        pageSize,
        orientation,
        documentType: 'exit_slip',
        quality,
      });

      if (result.success) {
        showNotification(`فایل PDF حواله خروج (${pageSize.toUpperCase()} ${orientation === 'portrait' ? 'عمودی' : 'افقی'}) با موفقیت تولید و دانلود شد.`);
      } else {
        showNotification(result.error || 'خطا در تبدیل به PDF');
      }
    } catch (err: any) {
      console.error('PDF export error:', err);
      showNotification('خطا در صدور فایل PDF حواله خروج دستگاه.');
    } finally {
      setIsExportingPdf(false);
    }
  };

  // Print handlers
  const handlePrintNewWindow = () => {
    const title = `حواله خروج دستگاه و کالای امانی - شماره ${transfer.transferNumber}`;
    const opened = printElementInNewWindow('printable-direct-transfer-slip', title, { pageSize, orientation });
    if (opened) {
      showNotification(`پنجره چاپ پرینتر در اندازه ${pageSize.toUpperCase()} آماده شد.`);
    } else {
      printElementDirectly('printable-direct-transfer-slip', { pageSize, orientation });
      showNotification('دستور چاپ مستقیم ارسال شد.');
    }
  };

  const handlePrintDirect = () => {
    const ok = printElementDirectly('printable-direct-transfer-slip', { pageSize, orientation });
    if (ok) {
      showNotification('دستور چاپ مستقیم ارسال شد.');
    } else {
      window.print();
    }
  };

  // Text summary for sharing
  const getShareText = () => {
    const lines = [
      `📦 *برگه خروج دستگاه و کالای امانی انبار*`,
      `شماره حواله: ${toPersianDigits(transfer.transferNumber)}`,
      `موضوع: ${transfer.title}`,
      `نوع خروج: ${typeInfo.label}`,
      `وضعیت: ${statusInfo.label}`,
      `تاریخ خروج: ${toPersianDigits(transfer.dispatchedAt)}`,
      transfer.expectedReturnDate ? `موعد احتمالی بازگشت: ${toPersianDigits(transfer.expectedReturnDate)}` : '',
      `راننده / تحویل‌گیرنده خروج: ${transfer.receiverName} ${transfer.receiverPhone ? `(${transfer.receiverPhone})` : ''}`,
      transfer.dispatchVehicleInfo ? `خودرو و پلاک: ${transfer.dispatchVehicleInfo}` : '',
      transfer.destination ? `مقصد / تعمیرگاه: ${transfer.destination}` : '',
      `انباردار صادرکننده: ${transfer.dispatchedBy}`,
      ``,
      `📋 *اقلام و دستگاه‌های خارج‌شده:*`,
      ...transfer.items.map((i, idx) => 
        `${idx + 1}. ${i.productName} (${i.quantity} ${i.unit}) ${i.serialNumber ? `- سریال: ${i.serialNumber}` : ''} ${i.returnedQuantity > 0 ? `[بازگشته: ${i.returnedQuantity}]` : ''}`
      ),
      ``,
      settings.storeName ? `🏢 ${settings.storeName}` : '',
      settings.phone ? `📞 تلفن: ${settings.phone}` : '',
    ].filter(Boolean);

    return lines.join('\n');
  };

  const handleCopyShareText = () => {
    const text = getShareText();
    navigator.clipboard.writeText(text);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 3000);
    showNotification('متن خلاصه حواله با موفقیت در حافظه کپی شد.');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/80 backdrop-blur-sm overflow-y-auto print:p-0 print:bg-white print:static">
      <div 
        id="direct-transfer-print-modal"
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[96vh] flex flex-col overflow-hidden my-auto print:max-h-none print:w-full print:shadow-none print:border-none print:rounded-none"
      >
        {/* Actions Bar (Hidden in Print) */}
        <div className="bg-slate-900 text-white px-3 sm:px-5 py-2.5 sm:py-3 flex flex-wrap items-center justify-between gap-2.5 shadow-sm print:hidden shrink-0 border-b border-slate-800">
          
          {/* Left Title */}
          <div className="flex items-center gap-2 min-w-0">
            <Wrench className="w-5 h-5 text-amber-400 shrink-0" />
            <div>
              <span className="text-xs sm:text-sm font-bold truncate block">
                برگه خروج دستگاه و کالای امانی
              </span>
              <span className="text-[11px] text-slate-400 font-mono">
                شماره حواله: {toPersianDigits(transfer.transferNumber)}
              </span>
            </div>
          </div>

          {/* Center Format & Orientation Controls */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Page Size: A4 / A5 */}
            <div className="flex items-center bg-slate-800/80 p-0.5 rounded-xl border border-slate-700 text-xs">
              <button
                type="button"
                onClick={() => setPageSize('a4')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                  pageSize === 'a4' 
                    ? 'bg-amber-500 text-slate-950 shadow-xs' 
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                A4
              </button>
              <button
                type="button"
                onClick={() => setPageSize('a5')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                  pageSize === 'a5' 
                    ? 'bg-amber-500 text-slate-950 shadow-xs' 
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                A5
              </button>
            </div>

            {/* Orientation: Portrait / Landscape */}
            <div className="flex items-center bg-slate-800/80 p-0.5 rounded-xl border border-slate-700 text-xs">
              <button
                type="button"
                onClick={() => setOrientation('portrait')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                  orientation === 'portrait' 
                    ? 'bg-slate-700 text-white font-bold shadow-xs' 
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                عمودی
              </button>
              <button
                type="button"
                onClick={() => setOrientation('landscape')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                  orientation === 'landscape' 
                    ? 'bg-slate-700 text-white font-bold shadow-xs' 
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                افقی
              </button>
            </div>

            {/* Quality Preset */}
            <select
              value={quality}
              onChange={(e) => setQuality(e.target.value as PdfQualityPreset)}
              className="bg-slate-800 text-slate-200 border border-slate-700 rounded-xl px-2 py-1 text-xs cursor-pointer focus:outline-none focus:border-amber-400"
              title="کیفیت خروجی PDF"
            >
              <option value="economy">کیفیت کم‌حجم</option>
              <option value="standard">کیفیت استاندارد (متعادل)</option>
              <option value="high">کیفیت بالا (شفاف)</option>
              <option value="ultra">کیفیت فوق‌العاده (چاپ Ultra)</option>
            </select>
          </div>

          {/* Right Action Buttons */}
          <div className="flex items-center gap-2 shrink-0">
            {/* PDF Export Button */}
            <button
              type="button"
              disabled={isExportingPdf}
              onClick={handleExportPdf}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold rounded-xl text-xs transition-all shadow-md cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              title="تولید و دانلود فایل PDF استاندارد برگه خروج"
            >
              {isExportingPdf ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>در حال تولید PDF...</span>
                </>
              ) : (
                <>
                  <FileDown className="w-4 h-4" />
                  <span>دانلود فایل PDF</span>
                </>
              )}
            </button>

            {/* Print Official Button */}
            <div className="inline-flex rounded-xl shadow-sm">
              <button
                type="button"
                onClick={handlePrintNewWindow}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-slate-950 font-bold rounded-r-xl text-xs transition-all cursor-pointer"
                title="چاپ برگه در پنجره جدید پرینتر"
              >
                <Printer className="w-4 h-4" />
                <span>چاپ</span>
              </button>
              <button
                type="button"
                onClick={handlePrintDirect}
                className="px-2 py-1.5 bg-amber-600 hover:bg-amber-700 text-slate-950 font-bold rounded-l-xl text-xs border-r border-amber-600 transition-all cursor-pointer"
                title="چاپ مستقیم در همین صفحه"
              >
                مستقیم
              </button>
            </div>

            {/* Share Menu Toggle */}
            <button
              type="button"
              onClick={() => setShowShareModal(true)}
              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl transition-colors cursor-pointer"
              title="اشتراک‌گذاری اطلاعات برگه"
            >
              <Share2 className="w-4 h-4" />
            </button>

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1.5 rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
              title="بستن پنجره"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Status Notification Toast */}
        {statusNotification && (
          <div className="bg-emerald-600 text-white px-4 py-2 text-xs font-bold flex items-center justify-between shadow-inner print:hidden">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              <span>{statusNotification}</span>
            </div>
            <button
              type="button"
              onClick={() => setStatusNotification(null)}
              className="text-white/80 hover:text-white cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Document Scroll Viewport */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-6 bg-slate-100 flex justify-center items-start print:p-0 print:bg-white print:overflow-visible">
          
          {/* Printable Document Sheet */}
          <div 
            id="printable-direct-transfer-slip"
            className={`w-full bg-white shadow-md border border-slate-300 rounded-xl p-5 sm:p-8 space-y-5 text-slate-900 font-['Vazirmatn'] text-xs sm:text-sm print:m-0 print:p-4 print:space-y-4 print:border-none print:shadow-none print:w-full print:rounded-none ${
              pageSize === 'a5' 
                ? orientation === 'landscape' ? 'max-w-[210mm]' : 'max-w-[148mm]'
                : orientation === 'landscape' ? 'max-w-[297mm]' : 'max-w-[210mm]'
            }`}
          >
            
            {/* Header of Official Machine & Loan Slip */}
            <div className="border-b-2 border-slate-800 pb-4">
              <div className="flex items-start justify-between gap-4">
                
                {/* Store & Warehouse Identity */}
                <div className="space-y-1.5 max-w-[55%]">
                  <div className="flex items-center gap-2.5">
                    {settings.logo ? (
                      <img 
                        src={settings.logo} 
                        alt={settings.storeName || 'لوگو'} 
                        className="h-10 sm:h-12 w-auto object-contain max-w-[120px]" 
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-bold print:border print:border-slate-800 shrink-0">
                        <Wrench className="w-6 h-6" />
                      </div>
                    )}
                    <div>
                      <h1 className="text-base sm:text-lg font-black tracking-tight text-slate-900">
                        {settings.storeName || 'مجموعه بازرگانی و صنعتی'}
                      </h1>
                      <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                        {settings.tagline || 'برگ رسمی خروج و ورود کالا، دستگاه و تجهیزات (امانی / سرویس فنی)'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-[11px] text-slate-600 flex-wrap pt-0.5">
                    {transfer.warehouseName && (
                      <div>
                        انبار مبدأ: <span className="font-bold text-slate-900">{transfer.warehouseName}</span>
                      </div>
                    )}
                    {settings.phone && (
                      <div>
                        تلفن انبار/دفتر: <span className="font-bold text-slate-900 font-mono">{toPersianDigits(settings.phone)}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Center Title Badge */}
                <div className="hidden sm:flex flex-col items-center justify-center">
                  <div className="px-3.5 py-1 rounded-lg bg-amber-100/80 border border-amber-300 font-black text-amber-950 text-xs sm:text-sm text-center">
                    حواله خروج دستگاه و امانی
                  </div>
                  <span className="text-[10px] text-slate-500 mt-1 font-mono">
                    (Equipment & Loan Exit Slip)
                  </span>
                </div>

                {/* Slip Number, Date & Badges */}
                <div className="text-left space-y-1 shrink-0">
                  <div className="flex items-center justify-end gap-1.5">
                    <span className="text-xs text-slate-500 font-medium">شماره حواله:</span>
                    <span className="font-black text-sm sm:text-base font-mono text-slate-950 bg-slate-100 px-2 py-0.5 rounded border border-slate-300">
                      {toPersianDigits(transfer.transferNumber)}
                    </span>
                  </div>
                  <div className="flex items-center justify-end gap-1.5 text-xs text-slate-600">
                    <span>تاریخ خروج:</span>
                    <span className="font-bold font-mono text-slate-900">{toPersianDigits(transfer.dispatchedAt)}</span>
                  </div>
                  <div className="flex items-center justify-end gap-1.5 pt-1 flex-wrap">
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${typeInfo.color}`}>
                      {typeInfo.label}
                    </span>
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${statusInfo.color}`}>
                      {statusInfo.label}
                    </span>
                  </div>
                </div>
              </div>

              {/* Title & Subject Bar */}
              <div className="mt-3 pt-2 border-t border-dashed border-slate-300 flex items-center justify-between text-xs flex-wrap gap-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-500 font-bold">موضوع حواله:</span>
                  <span className="font-extrabold text-slate-900 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                    {transfer.title}
                  </span>
                </div>
                {transfer.expectedReturnDate && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-500 font-medium">موعد احتمالی بازگشت به انبار:</span>
                    <span className="font-black text-amber-900 bg-amber-50 px-2 py-0.5 rounded border border-amber-300 font-mono">
                      {toPersianDigits(transfer.expectedReturnDate)}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Table of Items & Equipment */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                  <FileText className="w-4 h-4 text-amber-600" />
                  <span>مشخصات فنی دستگاه‌ها، تجهیزات و اقلام خارج‌شده:</span>
                </div>
                <span className="text-[11px] text-slate-500">
                  تعداد ردیف: {toPersianDigits(transfer.items.length)} قلم
                </span>
              </div>
              
              <div className="border border-slate-300 rounded-xl overflow-hidden shadow-2xs">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-100 text-slate-800 border-b border-slate-300 font-bold">
                    <tr>
                      <th className="p-2.5 text-center w-10">ردیف</th>
                      <th className="p-2.5">نام کالا / دستگاه</th>
                      <th className="p-2.5">مدل / تنوع</th>
                      <th className="p-2.5 font-mono">شماره سریال / پلاک فنی</th>
                      <th className="p-2.5 text-center w-24">تعداد خروجی</th>
                      <th className="p-2.5 text-center w-24">تعداد بازگشته</th>
                      <th className="p-2.5">شرح عیب، علت خروج یا توضیحات فنی</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {transfer.items.map((item, idx) => {
                      const isReturnedFully = (item.returnedQuantity || 0) >= item.quantity;
                      const hasPartialReturn = (item.returnedQuantity || 0) > 0 && !isReturnedFully;

                      return (
                        <tr key={item.id} className="hover:bg-slate-50/70">
                          <td className="p-2.5 text-center font-bold text-slate-500">
                            {toPersianDigits(idx + 1)}
                          </td>
                          <td className="p-2.5 font-bold text-slate-900">
                            {item.productName}
                            {item.productCode && (
                              <span className="text-[10px] text-slate-400 block font-mono">
                                کد: {toPersianDigits(item.productCode)}
                              </span>
                            )}
                          </td>
                          <td className="p-2.5 text-slate-600">
                            {item.variantName || '-'}
                          </td>
                          <td className="p-2.5 font-mono font-bold text-slate-800">
                            {item.serialNumber ? toPersianDigits(item.serialNumber) : '-'}
                          </td>
                          <td className="p-2.5 text-center font-black text-amber-900">
                            {toPersianDigits(item.quantity)} {item.unit}
                          </td>
                          <td className="p-2.5 text-center font-black">
                            {item.returnedQuantity > 0 ? (
                              <span className={isReturnedFully ? 'text-emerald-700' : 'text-indigo-600'}>
                                {toPersianDigits(item.returnedQuantity)} {item.unit}
                                {isReturnedFully && (
                                  <span className="text-[10px] text-emerald-600 block">(کامل)</span>
                                )}
                              </span>
                            ) : (
                              <span className="text-slate-400 font-normal">۰</span>
                            )}
                          </td>
                          <td className="p-2.5 text-slate-700">
                            {item.notes || '-'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Specifications Cards: Dispatch & Return Details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              
              {/* Box 1: Dispatch Details (مشخصات خروج) */}
              <div className="border border-amber-300 rounded-xl p-3.5 bg-amber-50/40 space-y-2 text-xs">
                <div className="flex items-center justify-between font-bold text-amber-900 border-b border-amber-200 pb-1.5">
                  <div className="flex items-center gap-1.5">
                    <Car className="w-4 h-4 text-amber-700" />
                    <span>۱. مشخصات راننده و خودروی خارج‌کننده بار</span>
                  </div>
                  <span className="text-[10px] text-amber-700 font-normal">مرحله خروج</span>
                </div>
                <div className="space-y-1.5 text-slate-800">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 font-medium">تحویل‌گیرنده / راننده خروج:</span>
                    <span className="font-bold text-slate-950">{transfer.receiverName}</span>
                  </div>
                  {transfer.receiverPhone && (
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">شماره تماس راننده:</span>
                      <span className="font-mono font-bold text-slate-900">{toPersianDigits(transfer.receiverPhone)}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">مشخصات خودرو و پلاک:</span>
                    <div>
                      {transfer.dispatchVehicleInfo ? (
                        <MiniIranPlate plateInfo={transfer.dispatchVehicleInfo} />
                      ) : (
                        <span className="text-slate-400">ثبت نشده</span>
                      )}
                    </div>
                  </div>
                  {transfer.destination && (
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">مقصد / کارگاه / تعمیرگاه:</span>
                      <span className="font-semibold text-slate-900">{transfer.destination}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">انباردار خارج‌کننده:</span>
                    <span className="font-bold text-slate-900">{transfer.dispatchedBy}</span>
                  </div>
                  {transfer.dispatchNotes && (
                    <div className="pt-1 text-[11px] text-slate-600 border-t border-amber-200">
                      <span className="font-bold text-slate-800">یادداشت خروج:</span> {transfer.dispatchNotes}
                    </div>
                  )}
                </div>
              </div>

              {/* Box 2: Return Records (مشخصات ورود و بازگشت) */}
              <div className="border border-emerald-300 rounded-xl p-3.5 bg-emerald-50/40 space-y-2 text-xs">
                <div className="flex items-center justify-between font-bold text-emerald-900 border-b border-emerald-200 pb-1.5">
                  <div className="flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-700" />
                    <span>۲. مشخصات آورنده و سوابق بازگشت به انبار</span>
                  </div>
                  <span className="text-[10px] text-emerald-700 font-normal">مرحله ورود</span>
                </div>
                
                {transfer.returnRecords && transfer.returnRecords.length > 0 ? (
                  <div className="space-y-2">
                    {transfer.returnRecords.map((ret, idx) => (
                      <div key={ret.id} className="space-y-1.5 text-slate-800 bg-white p-2.5 rounded-lg border border-emerald-200">
                        <div className="flex justify-between font-bold text-emerald-800 text-[11px]">
                          <span>نوبت بازگشت #{toPersianDigits(idx + 1)}</span>
                          <span className="font-mono">{toPersianDigits(ret.returnedAt)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-slate-500">آورنده / راننده بازگشت:</span>
                          <span className="font-bold text-slate-950">{ret.returnerName}</span>
                        </div>
                        {ret.returnVehicleInfo && (
                          <div className="flex justify-between items-center">
                            <span className="text-slate-500">خودرو و پلاک:</span>
                            <MiniIranPlate plateInfo={ret.returnVehicleInfo} />
                          </div>
                        )}
                        <div className="flex justify-between items-center">
                          <span className="text-slate-500">تحویل‌گیرنده در انبار:</span>
                          <span className="font-bold text-slate-900">{ret.receivedByWarehouseUser}</span>
                        </div>
                        {ret.notes && (
                          <div className="text-[11px] text-slate-600 pt-1 border-t border-emerald-100">
                            <span className="font-bold text-emerald-800">گزارش وضعیت سلامت:</span> {ret.notes}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 text-center text-slate-400 text-xs bg-white rounded-lg border border-dashed border-emerald-200 space-y-1">
                    <div className="font-bold text-slate-600">دستگاه هنوز به انبار بازنگشته است</div>
                    <div className="text-[11px] text-slate-400">
                      {transfer.isReturnable 
                        ? 'اقلام خارج‌شده در اختیار سرویس‌کار یا شخص تحویل‌گیرنده امانی می‌باشد.'
                        : 'این حواله بدون نیاز به عودت به انبار بسته شده است.'}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Official Signatures & Approvals (۴ ستون امضا) */}
            <div className="border border-slate-300 rounded-xl p-3.5 bg-slate-50/80 mt-2">
              <div className="text-xs font-bold text-slate-700 mb-2.5 text-center">
                تاییدات، مهر و امضای طرفین تحویل و تحول رسمی:
              </div>
              <div className="grid grid-cols-4 gap-2 text-center text-xs">
                <div className="border-l border-slate-200 pl-2">
                  <div className="text-slate-700 font-bold mb-7">امضای انباردار تحویل‌دهنده</div>
                  <div className="text-[11px] text-slate-400 font-mono">...................................</div>
                </div>
                <div className="border-l border-slate-200 pl-2">
                  <div className="text-slate-700 font-bold mb-7">امضای راننده / تحویل‌گیرنده</div>
                  <div className="text-[11px] text-slate-400 font-mono">...................................</div>
                </div>
                <div className="border-l border-slate-200 pl-2">
                  <div className="text-slate-700 font-bold mb-7">امضای نگهبانی درب خروج</div>
                  <div className="text-[11px] text-slate-400 font-mono">...................................</div>
                </div>
                <div>
                  <div className="text-slate-700 font-bold mb-7">امضا و تاریخ عودت به انبار</div>
                  <div className="text-[11px] text-slate-400 font-mono">...................................</div>
                </div>
              </div>
            </div>

            {/* Warehouse Notice / Legal Disclaimer */}
            <div className="text-[10px] text-slate-400 text-center pt-1 border-t border-slate-200">
              این برگه به عنوان سند قانونی حواله خروج و ورود فیزیکی اموال و ماشین‌آلات تلقی شده و دارنده آن متعهد به حفظ سلامت کالا و عودت به موقع آن به انبار می‌باشد.
            </div>
          </div>
        </div>

        {/* Share Modal Popover */}
        {showShareModal && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <div className="bg-white rounded-2xl p-5 max-w-md w-full shadow-2xl border border-slate-200 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                  <Share2 className="w-5 h-5 text-amber-500" />
                  <span>اشتراک‌گذاری حواله خروج دستگاه</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowShareModal(false)}
                  className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="text-xs text-slate-600">
                می‌توانید خلاصه این حواله را در پیام‌رسان‌ها ارسال فرمایید یا متن آن را کپی کنید:
              </div>

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs font-mono text-slate-700 max-h-48 overflow-y-auto whitespace-pre-wrap leading-relaxed">
                {getShareText()}
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleCopyShareText}
                  className="flex items-center justify-center gap-1.5 py-2 px-3 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  {copiedText ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-400" />
                      <span>کپی شد!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span>کپی متن حواله</span>
                    </>
                  )}
                </button>

                <a
                  href={`https://api.whatsapp.com/send?text=${encodeURIComponent(getShareText())}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-1.5 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>ارسال در واتساپ</span>
                </a>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
