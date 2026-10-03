import React, { useState } from 'react';
import { PurchaseInvoice, StoreSettings, AppUser } from '../types';
import { toPersianDigits, formatPrice } from '../utils/jalali';
import { PAYMENT_METHOD_LABELS } from '../utils/storage';
import { exportElementToPdf, printElementDirectly } from '../utils/pdfHelper';
import { 
  Printer, 
  X, 
  ShoppingBag, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  Building2, 
  Phone, 
  MapPin, 
  CreditCard,
  FileSpreadsheet,
  ArrowRight,
  FileDown,
  Loader2,
  Copy,
  Check,
  Hash,
  Calendar,
  Warehouse
} from 'lucide-react';

interface PurchaseInvoiceViewModalProps {
  invoice: PurchaseInvoice;
  settings: StoreSettings;
  currentUser?: AppUser;
  onClose: () => void;
  onOpenReceipt?: (receiptId: string) => void;
}

export const PurchaseInvoiceViewModal: React.FC<PurchaseInvoiceViewModalProps> = ({
  invoice,
  settings,
  currentUser,
  onClose,
  onOpenReceipt,
}) => {
  const [pageSize, setPageSize] = useState<'a4' | 'a5'>('a4');
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Direct Print Handler
  const handlePrint = () => {
    const success = printElementDirectly('printable-purchase-invoice', {
      pageSize,
      orientation,
    });
    if (!success) {
      window.print();
    }
  };

  // Export PDF Handler
  const handleExportPdf = async () => {
    try {
      setIsExportingPdf(true);
      const filename = `فاکتور_خرید_${invoice.invoiceNumber}_${pageSize}_${orientation}`;
      const result = await exportElementToPdf('printable-purchase-invoice', filename, {
        pageSize,
        orientation,
        documentType: 'invoice',
      });

      if (result.success) {
        showToast('فایل PDF فاکتور خرید با موفقیت ایجاد و دانلود شد.');
      } else {
        showToast(result.error || 'خطا در ایجاد فایل PDF.');
      }
    } catch (err: any) {
      console.error(err);
      showToast('خطا در تبدیل فاکتور خرید به PDF.');
    } finally {
      setIsExportingPdf(false);
    }
  };

  // Share text summary
  const handleCopyText = () => {
    const lines = [
      `🧾 *فاکتور خرید کالا*`,
      `شماره فاکتور: ${toPersianDigits(invoice.invoiceNumber)}`,
      `تاریخ: ${toPersianDigits(invoice.date)}`,
      `تامین‌کننده / فروشنده: ${invoice.supplierName || 'ثبت‌نشده'}`,
      invoice.supplierPhone ? `تلفن فروشنده: ${toPersianDigits(invoice.supplierPhone)}` : '',
      `---------------------------------`,
      `📋 *اقلام خریداری‌شده:*`,
      ...invoice.items.map(
        (it, idx) =>
          `${toPersianDigits(idx + 1)}. ${it.productName} ➔ ${toPersianDigits(it.quantity)} ${it.unit || 'عدد'} × ${toPersianDigits(formatPrice(it.buyPrice))} = ${toPersianDigits(formatPrice(it.total))} تومان`
      ),
      `---------------------------------`,
      `جمع کل ناخالص: ${toPersianDigits(formatPrice(invoice.subtotal))} تومان`,
      invoice.totalDiscount > 0 ? `تخفیف: ${toPersianDigits(formatPrice(invoice.totalDiscount))} تومان` : '',
      invoice.shippingCost ? `کرایه حمل: ${toPersianDigits(formatPrice(invoice.shippingCost))} تومان` : '',
      `*مبلغ نهایی فاکتور: ${toPersianDigits(formatPrice(invoice.finalTotal))} تومان*`,
      `وضعیت پرداخت: ${invoice.paymentStatus === 'paid' ? 'تسویه کامل' : invoice.paymentStatus === 'partial' ? 'بیعانه' : 'نسیه / دفتری'}`,
      `فروشگاه: ${settings.storeName || 'سامانه بازرگانی'}`
    ].filter(Boolean).join('\n');

    navigator.clipboard.writeText(lines);
    setIsCopied(true);
    showToast('خلاصه متنی فاکتور خرید در حافظه کپی شد.');
    setTimeout(() => setIsCopied(false), 2500);
  };

  const getStatusBadge = () => {
    switch (invoice.status) {
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
            <CheckCircle2 className="w-3.5 h-3.5" />
            تحویل کامل و ثبت در انبار
          </span>
        );
      case 'has_discrepancy':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
            <AlertTriangle className="w-3.5 h-3.5" />
            دارای مغایرت اقلام
          </span>
        );
      case 'pending_receipt':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800 border border-blue-300">
            <Clock className="w-3.5 h-3.5" />
            در انتظار ورود به انبار
          </span>
        );
    }
  };

  // Determine container dimensions based on paper size and orientation
  const isA5 = pageSize === 'a5';
  const isLandscape = orientation === 'landscape';

  const containerDimensionClass = isA5
    ? isLandscape
      ? 'max-w-[210mm] min-h-[148mm] text-[11px]'
      : 'max-w-[148mm] min-h-[210mm] text-[11px]'
    : isLandscape
      ? 'max-w-[297mm] min-h-[210mm] text-xs sm:text-sm'
      : 'max-w-[210mm] min-h-[297mm] text-xs sm:text-sm';

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/65 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
      
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-60 pointer-events-none animate-in fade-in slide-in-from-top-3">
          <div className="bg-slate-900 text-white px-4 py-2 rounded-2xl shadow-2xl border border-slate-700 text-xs font-bold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{toastMessage}</span>
          </div>
        </div>
      )}

      <div className="bg-white w-full max-w-5xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[96vh] border border-slate-200">
        
        {/* Top Control Bar (Hidden in Print) */}
        <div className="no-print bg-slate-900 text-white px-3 sm:px-6 py-2.5 sm:py-3 flex flex-wrap items-center justify-between gap-2.5 border-b border-slate-800 shrink-0 select-none">
          
          {/* Title & Invoice Identifier */}
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/30">
              <ShoppingBag className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-black text-xs sm:text-sm text-white">
                  فاکتور خرید شماره
                </span>
                <span className="font-mono font-black text-emerald-300 bg-slate-800 px-2 py-0.5 rounded-lg border border-slate-700 text-xs">
                  {toPersianDigits(invoice.invoiceNumber)}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 truncate hidden sm:block">
                فروشنده: {invoice.supplierName || 'عمومی'} • تاریخ: {toPersianDigits(invoice.date)}
              </p>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="flex items-center gap-2 flex-wrap">
            
            {/* Paper Size Selector (A4 / A5) */}
            <div className="flex items-center bg-slate-800 rounded-xl p-0.5 border border-slate-700 text-xs font-bold">
              <button
                type="button"
                onClick={() => setPageSize('a4')}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer font-mono ${
                  pageSize === 'a4'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="قطع کاغذ A4 (استاندارد اداری)"
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
                title="قطع کاغذ A5 (جمع‌وجور و اقتصادی)"
              >
                A5
              </button>
            </div>

            {/* Orientation Selector (Portrait / Landscape) */}
            <div className="flex items-center bg-slate-800 rounded-xl p-0.5 border border-slate-700 text-xs font-bold">
              <button
                type="button"
                onClick={() => setOrientation('portrait')}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                  orientation === 'portrait'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="جهت چاپ عمودی"
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
                title="جهت چاپ افقی"
              >
                افقی
              </button>
            </div>

            {/* Link to inbound receipt if present */}
            {invoice.inboundReceiptId && onOpenReceipt && (
              <button
                type="button"
                onClick={() => {
                  onOpenReceipt(invoice.inboundReceiptId!);
                  onClose();
                }}
                className="hidden md:flex items-center gap-1 px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-emerald-500/30 text-xs font-bold transition-all cursor-pointer"
                title="مشاهده حواله ورود کالا متناظر"
              >
                <span>حواله انبار</span>
                <ArrowRight className="w-3.5 h-3.5 rotate-180" />
              </button>
            )}

            {/* Copy Text Summary */}
            <button
              type="button"
              onClick={handleCopyText}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-bold transition-all cursor-pointer active:scale-95"
              title="کپی خلاصه متنی فاکتور"
            >
              {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
              <span className="hidden lg:inline">{isCopied ? 'کپی شد' : 'کپی متن'}</span>
            </button>

            {/* Export PDF Button */}
            <button
              type="button"
              id="btn-download-purchase-invoice-pdf"
              onClick={handleExportPdf}
              disabled={isExportingPdf}
              className="flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-bold text-xs sm:text-sm shadow-md transition-all cursor-pointer disabled:opacity-50"
              title="دانلود فایل PDF فاکتور خرید"
            >
              {isExportingPdf ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <FileDown className="w-3.5 h-3.5" />
              )}
              <span>خروجی PDF</span>
            </button>

            {/* Direct Print Button */}
            <button
              type="button"
              id="btn-print-purchase-invoice"
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 sm:px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold text-xs sm:text-sm shadow-md transition-all cursor-pointer"
              title="چاپ مستقیم فاکتور"
            >
              <Printer className="w-4 h-4" />
              <span>چاپ فاکتور</span>
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

        {/* Scrollable Preview Canvas */}
        <div className="p-3 sm:p-8 overflow-y-auto bg-slate-200/90 flex-1 flex justify-center items-start">
          <div 
            id="printable-purchase-invoice"
            className={`w-full bg-white rounded-2xl shadow-xl border border-slate-300 text-slate-800 print:m-0 print:p-0 print:border-none print:shadow-none print:w-full print:rounded-none transition-all ${containerDimensionClass} ${
              isA5 ? 'p-4 sm:p-5' : 'p-6 sm:p-8'
            }`}
          >
            {/* Header Tier */}
            <div className={`border-b-2 border-slate-900 ${isA5 ? 'pb-2.5 mb-3' : 'pb-4 mb-4'}`}>
              <div className="flex items-center justify-between gap-3 flex-wrap sm:flex-nowrap">
                {/* Store Info & Logo */}
                <div className="flex items-center gap-2.5">
                  {settings.logo ? (
                    <img 
                      src={settings.logo} 
                      alt="لوگو" 
                      className={`${isA5 ? 'w-10 h-10' : 'w-12 h-12'} object-contain rounded-xl border border-slate-200 bg-white p-1 shrink-0`} 
                    />
                  ) : (
                    <div className={`${isA5 ? 'w-10 h-10 text-base' : 'w-12 h-12 text-lg'} rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold shadow-xs shrink-0 print:border print:border-slate-800`}>
                      <FileSpreadsheet className={isA5 ? 'w-5 h-5' : 'w-6 h-6'} />
                    </div>
                  )}
                  <div>
                    <h1 className={`${isA5 ? 'text-sm sm:text-base' : 'text-base sm:text-lg'} font-black text-slate-900`}>
                      {settings.storeName || 'سامانه بازرگانی و انبارداری'}
                    </h1>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      فاکتور رسمی خرید کالا و اقلام ورودی
                    </p>
                    {settings.phone && (
                      <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                        تلفن تماس: {toPersianDigits(settings.phone)}
                      </p>
                    )}
                  </div>
                </div>

                {/* Document Title Badge */}
                <div className="text-center shrink-0">
                  <div className={`inline-block px-3.5 py-1 rounded-xl bg-slate-900 text-white font-black ${isA5 ? 'text-xs' : 'text-sm sm:text-base'} mb-0.5 shadow-2xs`}>
                    فاکتور خرید کالا
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono font-bold tracking-wider">
                    PURCHASE INVOICE
                  </div>
                </div>

                {/* Invoice Meta Numbers */}
                <div className="text-left text-xs space-y-1 font-medium text-slate-600 shrink-0">
                  <div className="flex items-center justify-end gap-1.5">
                    <span className="text-slate-500 text-[11px]">شماره فاکتور:</span>
                    <strong className="text-slate-900 font-mono text-sm bg-slate-100 px-2 py-0.5 rounded-lg border border-slate-200">
                      {toPersianDigits(invoice.invoiceNumber)}
                    </strong>
                  </div>
                  <div className="flex items-center justify-end gap-1.5">
                    <span className="text-slate-500 text-[11px]">تاریخ خرید:</span>
                    <span className="text-slate-900 font-mono font-bold">
                      {toPersianDigits(invoice.date)}
                    </span>
                  </div>
                  {invoice.dueDate && (
                    <div className="flex items-center justify-end gap-1.5">
                      <span className="text-slate-500 text-[11px]">سررسید تسویه:</span>
                      <span className="text-slate-900 font-mono">
                        {toPersianDigits(invoice.dueDate)}
                      </span>
                    </div>
                  )}
                  <div className="pt-0.5 flex justify-end">
                    {getStatusBadge()}
                  </div>
                </div>
              </div>
            </div>

            {/* Supplier Information Bar (Decluttered, Optimized & Buyer Removed) */}
            <div className={`bg-slate-50/80 rounded-xl border border-slate-200/90 ${isA5 ? 'p-2.5 mb-2.5' : 'p-3 mb-3.5'}`}>
              <div className="flex flex-wrap items-center justify-between gap-y-2 gap-x-4 text-xs">
                
                {/* Supplier Name */}
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
                    <Building2 className="w-3.5 h-3.5 text-emerald-700" />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block font-medium">فروشنده / تامین‌کننده کالا:</span>
                    <strong className="text-slate-900 text-xs sm:text-sm font-black truncate block">
                      {invoice.supplierName || 'تامین‌کننده متفرقه'}
                    </strong>
                  </div>
                </div>

                {/* Supplier Phone */}
                {invoice.supplierPhone && (
                  <div className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-lg border border-slate-200/70">
                    <Phone className="w-3 h-3 text-slate-400" />
                    <span className="text-slate-500 text-[11px]">تلفن تماس:</span>
                    <span className="text-slate-900 font-mono font-bold">
                      {toPersianDigits(invoice.supplierPhone)}
                    </span>
                  </div>
                )}

                {/* Supplier Economic/National Code */}
                {invoice.supplierEconomicCode && (
                  <div className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-lg border border-slate-200/70">
                    <span className="text-slate-500 text-[11px]">کد اقتصادی / ملی:</span>
                    <span className="text-slate-900 font-mono font-bold">
                      {toPersianDigits(invoice.supplierEconomicCode)}
                    </span>
                  </div>
                )}

                {/* Supplier Address */}
                {invoice.supplierAddress && (
                  <div className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-lg border border-slate-200/70 min-w-0">
                    <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                    <span className="text-slate-500 text-[11px] shrink-0">نشانی مبدأ:</span>
                    <span className="text-slate-800 text-[11px] truncate" title={invoice.supplierAddress}>
                      {invoice.supplierAddress}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Items Table */}
            <div className={`overflow-x-auto ${isA5 ? 'mb-3' : 'mb-4'}`}>
              <table className="w-full text-right border-collapse text-xs border border-slate-300">
                <thead>
                  <tr className="bg-slate-100 text-slate-800 border-b border-slate-300 font-bold">
                    <th className={`${isA5 ? 'p-1.5' : 'p-2.5'} border-l border-slate-300 text-center w-8`}>#</th>
                    <th className={`${isA5 ? 'p-1.5' : 'p-2.5'} border-l border-slate-300 w-20 text-center`}>کد کالا</th>
                    <th className={`${isA5 ? 'p-1.5' : 'p-2.5'} border-l border-slate-300`}>شرح کالا / اقلام</th>
                    <th className={`${isA5 ? 'p-1.5' : 'p-2.5'} border-l border-slate-300 text-center w-14`}>واحد</th>
                    <th className={`${isA5 ? 'p-1.5' : 'p-2.5'} border-l border-slate-300 text-center w-16`}>تعداد</th>
                    <th className={`${isA5 ? 'p-1.5' : 'p-2.5'} border-l border-slate-300 text-left w-24 sm:w-28`}>قیمت خرید (فی)</th>
                    <th className={`${isA5 ? 'p-1.5' : 'p-2.5'} border-l border-slate-300 text-left w-20`}>تخفیف</th>
                    <th className={`${isA5 ? 'p-1.5' : 'p-2.5'} text-left w-28 sm:w-32`}>مبلغ کل (تومان)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {invoice.items.map((item, index) => (
                    <tr key={item.id || index} className={index % 2 === 1 ? 'bg-slate-50/60' : 'bg-white'}>
                      <td className={`${isA5 ? 'p-1.5' : 'p-2'} border-l border-slate-200 text-center font-mono text-slate-500`}>
                        {toPersianDigits(index + 1)}
                      </td>
                      <td className={`${isA5 ? 'p-1.5' : 'p-2'} border-l border-slate-200 font-mono text-center text-slate-600`}>
                        {toPersianDigits(item.productCode)}
                      </td>
                      <td className={`${isA5 ? 'p-1.5' : 'p-2'} border-l border-slate-200 font-bold text-slate-900`}>
                        {item.productName}
                      </td>
                      <td className={`${isA5 ? 'p-1.5' : 'p-2'} border-l border-slate-200 text-center text-slate-600 text-[11px]`}>
                        {item.unit || 'عدد'}
                      </td>
                      <td className={`${isA5 ? 'p-1.5' : 'p-2'} border-l border-slate-200 text-center font-black font-mono text-slate-900`}>
                        {toPersianDigits(item.quantity)}
                      </td>
                      <td className={`${isA5 ? 'p-1.5' : 'p-2'} border-l border-slate-200 text-left font-mono font-medium text-slate-800`}>
                        {toPersianDigits(formatPrice(item.buyPrice))}
                      </td>
                      <td className={`${isA5 ? 'p-1.5' : 'p-2'} border-l border-slate-200 text-left font-mono text-slate-600`}>
                        {item.discount > 0 ? toPersianDigits(formatPrice(item.discount)) : '—'}
                      </td>
                      <td className={`${isA5 ? 'p-1.5' : 'p-2'} text-left font-black font-mono text-emerald-900`}>
                        {toPersianDigits(formatPrice(item.total))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Financial Summary & Payment Info (Adaptable for portrait / landscape) */}
            <div className={`grid grid-cols-1 ${isLandscape ? 'sm:grid-cols-2' : 'sm:grid-cols-2'} gap-3 ${isA5 ? 'mb-3' : 'mb-5'}`}>
              
              {/* Payment Details Card */}
              <div className={`bg-slate-50/90 rounded-xl border border-slate-200/90 ${isA5 ? 'p-2.5 text-[11px] space-y-1.5' : 'p-3.5 text-xs space-y-2'}`}>
                <div className="font-bold text-slate-800 flex items-center gap-1.5 pb-1 border-b border-slate-200/80">
                  <CreditCard className="w-3.5 h-3.5 text-emerald-600" />
                  <span>اطلاعات و نحوه تسویه فاکتور خرید:</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">روش پرداخت:</span>
                  <strong className="text-slate-800">
                    {PAYMENT_METHOD_LABELS[invoice.paymentMethod] || invoice.paymentMethod}
                  </strong>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">وضعیت پرداخت:</span>
                  <strong className={invoice.paymentStatus === 'paid' ? 'text-emerald-700' : 'text-amber-700'}>
                    {invoice.paymentStatus === 'paid' ? 'تسویه کامل شده' : invoice.paymentStatus === 'partial' ? 'پرداخت بیعانه / بخشی' : 'نسیه / حساب دفتری'}
                  </strong>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">مبلغ پرداخت شده:</span>
                  <strong className="font-mono text-slate-900">
                    {toPersianDigits(formatPrice(invoice.paidAmount))} تومان
                  </strong>
                </div>
                {invoice.paymentMethod === 'cheque' && (
                  <div className="p-2 rounded-lg bg-amber-50 border border-amber-200 text-[10px] text-amber-900 space-y-0.5">
                    <div>شماره چک: {toPersianDigits(invoice.chequeNumber || '—')}</div>
                    <div>سررسید چک: {toPersianDigits(invoice.chequeDueDate || '—')}</div>
                    <div>صاحب حساب: {invoice.chequeName || '—'}</div>
                  </div>
                )}
                {invoice.transferDescription && (
                  <div className="text-[10px] text-slate-600 pt-0.5">
                    پیگیری فیش/حواله: {invoice.transferDescription}
                  </div>
                )}
                {invoice.notes && (
                  <div className="text-[10px] text-slate-600 pt-1 border-t border-slate-200">
                    یادداشت: {invoice.notes}
                  </div>
                )}
              </div>

              {/* Totals Table */}
              <div className={`bg-slate-50/90 rounded-xl border border-slate-200/90 ${isA5 ? 'p-2.5 text-[11px] space-y-1.5' : 'p-3.5 text-xs space-y-2'}`}>
                <div className="flex justify-between text-slate-600">
                  <span>جمع کل ناخالص اقلام:</span>
                  <span className="font-mono font-bold text-slate-900">{toPersianDigits(formatPrice(invoice.subtotal))} تومان</span>
                </div>
                {invoice.totalDiscount > 0 && (
                  <div className="flex justify-between text-rose-600 font-medium">
                    <span>مجموع تخفیفات:</span>
                    <span className="font-mono font-bold">-{toPersianDigits(formatPrice(invoice.totalDiscount))} تومان</span>
                  </div>
                )}
                {invoice.shippingCost && invoice.shippingCost > 0 && (
                  <div className="flex justify-between text-slate-600">
                    <span>کرایه حمل و باربری:</span>
                    <span className="font-mono font-medium">+{toPersianDigits(formatPrice(invoice.shippingCost))} تومان</span>
                  </div>
                )}
                {invoice.taxAmount > 0 && (
                  <div className="flex justify-between text-slate-600">
                    <span>مالیات بر ارزش افزوده ({toPersianDigits(invoice.taxRate)}٪):</span>
                    <span className="font-mono font-medium">+{toPersianDigits(formatPrice(invoice.taxAmount))} تومان</span>
                  </div>
                )}

                {/* Final Total Highlight */}
                <div className="flex justify-between items-center pt-2 border-t-2 border-slate-300 font-black text-slate-900 bg-white/70 -mx-1 px-2 py-1.5 rounded-lg">
                  <span className={isA5 ? 'text-xs' : 'text-sm'}>مبلغ نهایی قابل پرداخت:</span>
                  <span className={`font-mono text-emerald-800 ${isA5 ? 'text-sm' : 'text-base'}`}>
                    {toPersianDigits(formatPrice(invoice.finalTotal))} تومان
                  </span>
                </div>

                {invoice.finalTotal - invoice.paidAmount > 0 && (
                  <div className="flex justify-between pt-1 text-rose-700 font-bold text-xs">
                    <span>مانده بدهی به فروشنده:</span>
                    <span className="font-mono">
                      {toPersianDigits(formatPrice(invoice.finalTotal - invoice.paidAmount))} تومان
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Signatures Tier */}
            <div className={`grid grid-cols-2 gap-4 ${isA5 ? 'pt-3' : 'pt-5'} border-t border-slate-300 text-center text-xs text-slate-700`}>
              <div className={`border border-dashed border-slate-300 rounded-xl p-2.5 ${isA5 ? 'h-16' : 'h-20'} flex flex-col justify-between`}>
                <div className="font-bold text-slate-800 text-[11px]">مهر و امضای تامین‌کننده / فروشنده کالا</div>
                <div className="text-[10px] text-slate-400">نام و تاریخ</div>
              </div>
              <div className={`border border-dashed border-slate-300 rounded-xl p-2.5 ${isA5 ? 'h-16' : 'h-20'} flex flex-col justify-between`}>
                <div className="font-bold text-slate-800 text-[11px]">مهر و امضای خریدار / انباردار دریافت‌کننده</div>
                <div className="text-[10px] text-slate-400">تایید و تحویل</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
