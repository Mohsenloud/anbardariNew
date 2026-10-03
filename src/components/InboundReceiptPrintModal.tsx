import React, { useState } from 'react';
import { InboundReceipt, StoreSettings, AppUser } from '../types';
import { toPersianDigits, getCurrentJalaliDate, getCurrentJalaliTime } from '../utils/jalali';
import { exportElementToPdf, printElementDirectly } from '../utils/pdfHelper';
import { 
  Printer, 
  X, 
  CheckCircle2, 
  AlertTriangle, 
  ArrowDownRight, 
  Package, 
  FileSpreadsheet, 
  FileDown, 
  Share2, 
  Copy, 
  Check, 
  Loader2,
  Warehouse,
  Building2,
  Calendar,
  Clock,
  User,
  Info
} from 'lucide-react';

interface InboundReceiptPrintModalProps {
  receipt: InboundReceipt;
  settings: StoreSettings;
  currentUser?: AppUser;
  onClose: () => void;
}

export const InboundReceiptPrintModal: React.FC<InboundReceiptPrintModalProps> = ({
  receipt,
  settings,
  currentUser,
  onClose,
}) => {
  const [pageSize, setPageSize] = useState<'a4' | 'a5'>('a4');
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);

  const showNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 4000);
  };

  const hasDiscrepancy = receipt.items.some((i) => i.discrepancy !== 0);

  // Direct Print Handler
  const handlePrint = () => {
    const printed = printElementDirectly('printable-inbound-receipt', {
      pageSize,
      orientation,
    });
    if (!printed) {
      window.print();
    }
  };

  // PDF Export Handler
  const handleExportPdf = async () => {
    try {
      setIsExportingPdf(true);
      const filename = `حواله_ورود_انبار_${receipt.receiptNumber}_فاکتور_${receipt.purchaseInvoiceNumber}_${pageSize}_${orientation}`;
      const result = await exportElementToPdf('printable-inbound-receipt', filename, {
        pageSize,
        orientation,
        documentType: 'exit_slip',
      });

      if (result.success) {
        showNotification(`فایل PDF حواله ورود انبار با موفقیت ایجاد و دانلود شد.`);
      } else {
        showNotification(result.error || 'خطا در تولید فایل PDF.');
      }
    } catch (err: any) {
      console.error(err);
      showNotification('خطا در تبدیل حواله به فایل PDF.');
    } finally {
      setIsExportingPdf(false);
    }
  };

  // Share text summary handler
  const handleCopyText = () => {
    const text = [
      `📥 *حواله ورود کالا به انبار (رسید انبار / GRN)*`,
      `شماره حواله ورود: ${toPersianDigits(receipt.receiptNumber)}`,
      `شماره فاکتور خرید متناظر: ${toPersianDigits(receipt.purchaseInvoiceNumber)}`,
      `تاریخ صدور: ${toPersianDigits(receipt.date)}`,
      receipt.verifiedDate ? `تاریخ تایید انباردار: ${toPersianDigits(receipt.verifiedDate)}` : `وضعیت: در انتظار تایید انباردار`,
      `تامین‌کننده / فروشنده: ${receipt.supplierName}`,
      `مسئول انبار: ${receipt.verifiedBy || currentUser?.fullName || 'انباردار مرکزی'}`,
      `---------------------------------`,
      `📋 *اقلام دریافتی:*`,
      ...receipt.items.map(
        (it, idx) =>
          `${toPersianDigits(idx + 1)}. ${it.productName} ➔ تعداد فاکتور: ${toPersianDigits(it.expectedQuantity)} | تحویلی: ${toPersianDigits(it.receivedQuantity)} ${it.unit || 'واحد'}${it.discrepancy !== 0 ? ` (${it.discrepancy < 0 ? 'کسری' : 'مازاد'}: ${toPersianDigits(Math.abs(it.discrepancy))})` : ''}`
      ),
      `---------------------------------`,
      `مجموع تعداد فاکتور: ${toPersianDigits(receipt.totalExpectedQuantity)}`,
      `مجموع دریافتی انبار: ${toPersianDigits(receipt.totalReceivedQuantity)}`,
      receipt.totalDiscrepancy !== 0 ? `⚠️ مغایرت کل: ${toPersianDigits(receipt.totalDiscrepancy)}` : `✅ تطبیق ۱۰۰٪ اقلام`,
      receipt.warehouseNotes ? `یادداشت انباردار: ${receipt.warehouseNotes}` : '',
      `فروشگاه: ${settings.storeName || 'سامانه انبارداری'}`
    ].filter(Boolean).join('\n');

    navigator.clipboard.writeText(text);
    setIsCopied(true);
    showNotification('خلاصه متنی حواله ورود کالا در حافظه کپی شد.');
    setTimeout(() => setIsCopied(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
      {/* Toast Notification */}
      {notification && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-60 pointer-events-none animate-in fade-in slide-in-from-top-3">
          <div className="bg-slate-900 text-white px-4 py-2.5 rounded-2xl shadow-2xl border border-slate-700 text-xs font-bold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{notification}</span>
          </div>
        </div>
      )}

      <div className="bg-white w-full max-w-5xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[96vh] border border-slate-200">
        {/* Top Control Bar (Hidden in Print) */}
        <div className="no-print bg-slate-900 text-white px-3 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 shrink-0 select-none">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/30">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black text-xs sm:text-sm text-white">
                  پیش‌نمایش، چاپ و خروجی PDF حواله ورود کالا
                </span>
                <span className="text-[11px] font-mono bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-500/30 font-bold">
                  #{toPersianDigits(receipt.receiptNumber)}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium truncate mt-0.5">
                رسید انبار متناظر با فاکتور خرید {toPersianDigits(receipt.purchaseInvoiceNumber)} • {receipt.supplierName}
              </p>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Paper Size Selector */}
            <div className="flex items-center bg-slate-800 rounded-xl p-0.5 border border-slate-700 text-xs font-bold">
              <button
                type="button"
                onClick={() => setPageSize('a4')}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer font-mono ${
                  pageSize === 'a4'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="اندازه استاندارد اداری A4"
              >
                A4
              </button>
              <button
                type="button"
                onClick={() => setPageSize('a5')}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer font-mono ${
                  pageSize === 'a5'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="اندازه فشرده و صرفه‌جویی A5"
              >
                A5
              </button>
            </div>

            {/* Orientation Selector */}
            <div className="flex items-center bg-slate-800 rounded-xl p-0.5 border border-slate-700 text-xs font-bold">
              <button
                type="button"
                onClick={() => setOrientation('portrait')}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                  orientation === 'portrait'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                عمودی
              </button>
              <button
                type="button"
                onClick={() => setOrientation('landscape')}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                  orientation === 'landscape'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                افقی
              </button>
            </div>

            {/* Copy / Share Button */}
            <button
              type="button"
              onClick={handleCopyText}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold transition-all cursor-pointer active:scale-95"
              title="کپی خلاصه متنی حواله برای شبکه‌های اجتماعی و پیام‌رسان‌ها"
            >
              {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
              <span className="hidden sm:inline">{isCopied ? 'کپی شد' : 'کپی متن'}</span>
            </button>

            {/* PDF Export Button */}
            <button
              type="button"
              id="btn-download-inbound-receipt-pdf"
              onClick={handleExportPdf}
              disabled={isExportingPdf}
              className="flex items-center gap-1.5 px-3.5 sm:px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-bold text-xs sm:text-sm shadow-md transition-all cursor-pointer disabled:opacity-50"
              title="دانلود فایل کم‌حجم و استاندارد PDF حواله ورود"
            >
              {isExportingPdf ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <FileDown className="w-4 h-4" />
              )}
              <span>دانلود PDF</span>
            </button>

            {/* Direct Print Button */}
            <button
              type="button"
              id="btn-print-inbound-receipt"
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3.5 sm:px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold text-xs sm:text-sm shadow-md transition-all cursor-pointer"
              title="ارسال مستقیم به چاپگر"
            >
              <Printer className="w-4 h-4" />
              <span>چاپ حواله</span>
            </button>

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              title="بستن پنجره"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Preview Canvas Container */}
        <div className="p-3 sm:p-8 overflow-y-auto bg-slate-200/90 flex-1 flex justify-center items-start">
          <div 
            id="printable-inbound-receipt"
            className={`w-full bg-white p-6 sm:p-8 rounded-2xl shadow-xl border border-slate-300 text-slate-800 text-xs sm:text-sm print:m-0 print:p-0 print:border-none print:shadow-none print:w-full print:rounded-none transition-all ${
              pageSize === 'a5'
                ? orientation === 'landscape' ? 'max-w-[210mm] min-h-[148mm]' : 'max-w-[148mm] min-h-[210mm]'
                : orientation === 'landscape' ? 'max-w-[297mm] min-h-[210mm]' : 'max-w-[210mm] min-h-[297mm]'
            }`}
          >
            {/* Header Tier */}
            <div className="border-b-2 border-slate-900 pb-4 mb-4">
              <div className="flex items-center justify-between gap-4">
                {/* Store Info & Logo */}
                <div className="flex items-center gap-3">
                  {settings.logo ? (
                    <img 
                      src={settings.logo} 
                      alt="لوگو" 
                      className="w-14 h-14 object-contain rounded-xl border border-slate-200 bg-white p-1 shrink-0" 
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-2xl bg-emerald-700 text-white flex items-center justify-center font-bold text-xl print:border print:border-slate-800 shadow-xs shrink-0">
                      <FileSpreadsheet className="w-6 h-6" />
                    </div>
                  )}
                  <div>
                    <h1 className="text-base sm:text-lg font-black text-slate-900">
                      {settings.storeName || 'سامانه انبارداری و بازرگانی'}
                    </h1>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {settings.tagline || 'رسید رسمی تحویل و ورود کالا به انبار (Good Receipt Note)'}
                    </p>
                    {settings.phone && (
                      <p className="text-[11px] text-slate-400 mt-0.5 font-mono">
                        تلفن: {toPersianDigits(settings.phone)}
                      </p>
                    )}
                  </div>
                </div>

                {/* Document Title Badge */}
                <div className="text-center shrink-0">
                  <div className="inline-block px-4 py-1.5 rounded-xl bg-emerald-50 border-2 border-emerald-500 font-black text-emerald-950 text-sm sm:text-base mb-1 shadow-2xs">
                    حواله ورود کالا به انبار
                  </div>
                  <div className="text-[11px] text-slate-500 font-mono">
                    (رسید انبار / Goods Receipt Note)
                  </div>
                </div>

                {/* Document Numbers & Dates */}
                <div className="text-left text-xs space-y-1 font-medium text-slate-600 shrink-0">
                  <div className="bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200">
                    شماره حواله ورود:{' '}
                    <strong className="text-emerald-800 font-mono text-sm">
                      {toPersianDigits(receipt.receiptNumber)}
                    </strong>
                  </div>
                  <div>
                    شماره فاکتور خرید:{' '}
                    <strong className="text-slate-900 font-mono">
                      {toPersianDigits(receipt.purchaseInvoiceNumber)}
                    </strong>
                  </div>
                  <div>
                    تاریخ صدور:{' '}
                    <span className="text-slate-900 font-mono font-bold">
                      {toPersianDigits(receipt.date)}
                    </span>
                  </div>
                  {receipt.verifiedDate && (
                    <div>
                      تاریخ تایید انبار:{' '}
                      <span className="text-emerald-800 font-mono font-bold">
                        {toPersianDigits(receipt.verifiedDate)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Supplier & Warehouse Metadata Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-200 mb-4 text-xs">
              <div>
                <span className="text-slate-500 block text-[11px]">تامین‌کننده / فروشنده:</span>
                <div className="font-black text-slate-900 mt-0.5 text-xs sm:text-sm">
                  {receipt.supplierName}
                </div>
              </div>

              <div>
                <span className="text-slate-500 block text-[11px]">انبار مقصد:</span>
                <div className="font-bold text-slate-800 mt-0.5 flex items-center gap-1">
                  <Warehouse className="w-3.5 h-3.5 text-slate-400" />
                  <span>{settings.originWarehouseName || 'انبار مرکزی'}</span>
                  {settings.originWarehouseCode && (
                    <span className="text-[10px] text-slate-400 font-mono">({toPersianDigits(settings.originWarehouseCode)})</span>
                  )}
                </div>
              </div>

              <div>
                <span className="text-slate-500 block text-[11px]">وضعیت رسیدگی انبار:</span>
                <div className="mt-0.5 font-bold">
                  {receipt.status === 'confirmed' ? (
                    <span className="text-emerald-800 bg-emerald-100/80 px-2 py-0.5 rounded-md inline-block text-[11px]">
                      ✓ تایید کامل و ورود به انبار
                    </span>
                  ) : receipt.status === 'has_discrepancy' ? (
                    <span className="text-amber-800 bg-amber-100/80 px-2 py-0.5 rounded-md inline-block text-[11px]">
                      ⚠ تایید با مغایرت (کسری/مازاد)
                    </span>
                  ) : receipt.status === 'rejected' ? (
                    <span className="text-rose-800 bg-rose-100/80 px-2 py-0.5 rounded-md inline-block text-[11px]">
                      ✕ عدم تایید / مرجوعی
                    </span>
                  ) : (
                    <span className="text-blue-800 bg-blue-100/80 px-2 py-0.5 rounded-md inline-block text-[11px]">
                      ⏳ در انتظار شمارش انباردار
                    </span>
                  )}
                </div>
              </div>

              <div>
                <span className="text-slate-500 block text-[11px]">مسئول انبار / تاییدکننده:</span>
                <div className="font-bold text-slate-900 mt-0.5">
                  {receipt.verifiedBy || currentUser?.fullName || 'انباردار مرکزی'}
                </div>
              </div>
            </div>

            {/* Items Table */}
            <div className="overflow-x-auto mb-4">
              <table className="w-full text-right border-collapse text-xs border border-slate-300">
                <thead>
                  <tr className="bg-slate-100 text-slate-900 border-b-2 border-slate-300 font-bold">
                    <th className="p-2 border-l border-slate-300 text-center w-10">#</th>
                    <th className="p-2 border-l border-slate-300 w-24">کد کالا</th>
                    <th className="p-2 border-l border-slate-300">شرح کالا / قطعه</th>
                    <th className="p-2 border-l border-slate-300 text-center w-16">واحد</th>
                    <th className="p-2 border-l border-slate-300 text-center w-24 bg-slate-200/50">تعداد فاکتور</th>
                    <th className="p-2 border-l border-slate-300 text-center w-28 bg-emerald-100/60 font-black text-emerald-950">تعداد دریافتی انبار</th>
                    <th className="p-2 border-l border-slate-300 text-center w-24">مغایرت</th>
                    <th className="p-2">توضیحات و علت مغایرت</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {receipt.items.map((item, index) => {
                    const isDiff = item.discrepancy !== 0;
                    return (
                      <tr 
                        key={item.id || index}
                        className={isDiff ? 'bg-amber-50/60' : index % 2 === 1 ? 'bg-slate-50/60' : 'bg-white'}
                      >
                        <td className="p-2 border-l border-slate-200 text-center font-mono text-slate-500">
                          {toPersianDigits(index + 1)}
                        </td>
                        <td className="p-2 border-l border-slate-200 font-mono text-slate-700">
                          {toPersianDigits(item.productCode)}
                        </td>
                        <td className="p-2 border-l border-slate-200 font-bold text-slate-900">
                          {item.productName}
                        </td>
                        <td className="p-2 border-l border-slate-200 text-center text-slate-600">
                          {item.unit || 'عدد'}
                        </td>
                        <td className="p-2 border-l border-slate-200 text-center font-bold bg-slate-50 font-mono">
                          {toPersianDigits(item.expectedQuantity)}
                        </td>
                        <td className="p-2 border-l border-slate-200 text-center font-black text-emerald-900 bg-emerald-50 font-mono text-sm">
                          {toPersianDigits(item.receivedQuantity)}
                        </td>
                        <td className="p-2 border-l border-slate-200 text-center font-bold">
                          {item.discrepancy === 0 ? (
                            <span className="text-emerald-700 font-medium">۰ (تطبیق کامل)</span>
                          ) : item.discrepancy < 0 ? (
                            <span className="text-rose-700 font-black bg-rose-100/70 px-1.5 py-0.5 rounded font-mono">
                              {toPersianDigits(item.discrepancy)} (کسری)
                            </span>
                          ) : (
                            <span className="text-blue-700 font-black bg-blue-100/70 px-1.5 py-0.5 rounded font-mono">
                              +{toPersianDigits(item.discrepancy)} (مازاد)
                            </span>
                          )}
                        </td>
                        <td className="p-2 text-slate-700 text-[11px]">
                          {item.discrepancyReason || (item.discrepancy === 0 ? 'تحویل کامل و سالم' : '—')}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-100 font-bold border-t-2 border-slate-400">
                    <td colSpan={4} className="p-2.5 text-left pl-3 border-l border-slate-300 text-slate-800">
                      مجموع کل اقلام حواله ورود:
                    </td>
                    <td className="p-2.5 text-center border-l border-slate-300 font-black font-mono text-slate-900">
                      {toPersianDigits(receipt.totalExpectedQuantity)}
                    </td>
                    <td className="p-2.5 text-center border-l border-slate-300 font-black text-emerald-950 bg-emerald-200/70 font-mono text-sm">
                      {toPersianDigits(receipt.totalReceivedQuantity)}
                    </td>
                    <td className="p-2.5 text-center border-l border-slate-300 font-black font-mono">
                      {receipt.totalDiscrepancy === 0 ? (
                        <span className="text-emerald-700 font-bold">تطبیق ۱۰۰٪</span>
                      ) : (
                        <span className={receipt.totalDiscrepancy < 0 ? 'text-rose-700 font-bold' : 'text-blue-700 font-bold'}>
                          {toPersianDigits(receipt.totalDiscrepancy)}
                        </span>
                      )}
                    </td>
                    <td className="p-2 text-[11px] text-slate-600">
                      {receipt.totalDiscrepancy !== 0 ? 'دارای مغایرت در تحویل' : 'تایید بدون مغایرت'}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Discrepancy & Warehouse Notes Box */}
            {(receipt.notes || receipt.warehouseNotes || hasDiscrepancy) && (
              <div className="mb-4 p-3 rounded-2xl bg-slate-50 border border-slate-200 text-xs space-y-1.5">
                {receipt.notes && (
                  <div>
                    <strong className="text-slate-700">توضیحات فاکتور خرید:</strong>{' '}
                    <span className="text-slate-600">{receipt.notes}</span>
                  </div>
                )}
                {receipt.warehouseNotes && (
                  <div>
                    <strong className="text-emerald-900">گزارش و یادداشت مسئول انبار:</strong>{' '}
                    <span className="text-slate-800 font-medium">{receipt.warehouseNotes}</span>
                  </div>
                )}
                {hasDiscrepancy && (
                  <div className="flex items-center gap-1.5 text-amber-900 font-bold pt-1 bg-amber-50 p-2 rounded-xl border border-amber-200">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>توجه: این حواله دارای مغایرت بین اقلام فاکتور خرید و تعداد فیزیکی ورودی به انبار است و صورت‌جلسه آن ثبت گردید.</span>
                  </div>
                )}
              </div>
            )}

            {/* Official Signatures Box */}
            <div className="grid grid-cols-3 gap-3 pt-4 border-t border-slate-300 text-center text-xs text-slate-700">
              <div className="border border-dashed border-slate-300 rounded-2xl p-3 h-24 flex flex-col justify-between bg-slate-50/50">
                <div className="font-bold text-slate-800">تحویل‌دهنده (راننده / تامین‌کننده)</div>
                <div className="text-[11px] text-slate-400">نام و امضا</div>
              </div>
              <div className="border border-dashed border-slate-300 rounded-2xl p-3 h-24 flex flex-col justify-between bg-slate-50/50">
                <div className="font-bold text-slate-800">تحویل‌گیرنده (انباردار)</div>
                <div className="text-[11px] text-slate-700 font-bold">{receipt.verifiedBy || currentUser?.fullName || 'نام و امضا'}</div>
              </div>
              <div className="border border-dashed border-slate-300 rounded-2xl p-3 h-24 flex flex-col justify-between bg-slate-50/50">
                <div className="font-bold text-slate-800">مدیر انبار / کنترل کیفی</div>
                <div className="text-[11px] text-slate-400">مهر و امضا</div>
              </div>
            </div>

            {/* Print Footer Note */}
            <div className="text-center text-[10px] text-slate-400 mt-4 pt-2 border-t border-slate-100 flex items-center justify-between">
              <span>سامانه یکپارچه انبارداری و حسابداری — سند رسمی حواله ورود کالا</span>
              <span>تاریخ و زمان چاپ: {toPersianDigits(getCurrentJalaliDate())} - ساعت {toPersianDigits(getCurrentJalaliTime())}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
