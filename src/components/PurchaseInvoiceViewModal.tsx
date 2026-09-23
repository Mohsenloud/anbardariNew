import React from 'react';
import { PurchaseInvoice, StoreSettings, AppUser } from '../types';
import { toPersianDigits, formatPrice } from '../utils/jalali';
import { PAYMENT_METHOD_LABELS } from '../utils/storage';
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
  ArrowRight
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
  const handlePrint = () => {
    window.print();
  };

  const getStatusBadge = () => {
    switch (invoice.status) {
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
            <CheckCircle2 className="w-3.5 h-3.5" />
            تحویل کامل و ثبت در انبار
          </span>
        );
      case 'has_discrepancy':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
            <AlertTriangle className="w-3.5 h-3.5" />
            تحویل شده با مغایرت (کسری/مازاد)
          </span>
        );
      case 'pending_receipt':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-300">
            <Clock className="w-3.5 h-3.5" />
            در انتظار تایید ورود به انبار
          </span>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
      <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[96vh]">
        {/* Top Actions (Hidden in Print) */}
        <div className="no-print bg-slate-900 text-white px-3 sm:px-5 py-2.5 sm:py-3.5 flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <ShoppingBag className="w-5 h-5 text-emerald-400 shrink-0" />
            <span className="font-bold text-xs sm:text-base truncate">
              فاکتور خرید شماره {toPersianDigits(invoice.invoiceNumber)}
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {invoice.inboundReceiptId && onOpenReceipt && (
              <button
                type="button"
                onClick={() => {
                  onOpenReceipt(invoice.inboundReceiptId!);
                  onClose();
                }}
                className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-emerald-500/30 font-bold text-xs transition-all cursor-pointer"
              >
                <span>حواله ورود</span>
                <ArrowRight className="w-3.5 h-3.5 rotate-180" />
              </button>
            )}
            <button
              type="button"
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 sm:px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs sm:text-sm shadow-md transition-all cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>چاپ فاکتور</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Invoice Paper Body */}
        <div className="p-4 sm:p-8 overflow-y-auto bg-slate-100 flex-1 flex justify-center">
          <div 
            id="printable-purchase-invoice"
            className="w-full max-w-[210mm] bg-white p-6 sm:p-8 rounded-xl shadow-md border border-slate-200 text-slate-800 text-xs sm:text-sm print:m-0 print:p-0 print:border-none print:shadow-none print:w-full print:rounded-none"
          >
            {/* Header */}
            <div className="border-b-2 border-slate-800 pb-4 mb-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-slate-800 text-white flex items-center justify-center font-bold text-xl print:border print:border-slate-800">
                    <FileSpreadsheet className="w-7 h-7" />
                  </div>
                  <div>
                    <h1 className="text-base sm:text-lg font-black text-slate-900">
                      {settings.storeName || 'سامانه بازرگانی و انبارداری'}
                    </h1>
                    <p className="text-xs text-slate-500 mt-0.5">
                      فاکتور رسمی خرید کالا و اقلام ورودی
                    </p>
                  </div>
                </div>

                <div className="text-center">
                  <div className="inline-block px-4 py-1.5 rounded-lg bg-slate-100 border border-slate-300 font-black text-slate-900 text-sm sm:text-base mb-1">
                    فاکتور خرید کالا
                  </div>
                  <div className="text-[11px] text-slate-500">
                    (Purchase Invoice)
                  </div>
                </div>

                <div className="text-left text-xs space-y-1 font-medium text-slate-600">
                  <div>
                    شماره فاکتور خرید:{' '}
                    <strong className="text-slate-900 font-mono text-sm">
                      {toPersianDigits(invoice.invoiceNumber)}
                    </strong>
                  </div>
                  <div>
                    تاریخ فاکتور:{' '}
                    <span className="text-slate-900 font-mono">
                      {toPersianDigits(invoice.date)}
                    </span>
                  </div>
                  {invoice.dueDate && (
                    <div>
                      تاریخ سررسید:{' '}
                      <span className="text-slate-900 font-mono">
                        {toPersianDigits(invoice.dueDate)}
                      </span>
                    </div>
                  )}
                  <div className="pt-1">
                    {getStatusBadge()}
                  </div>
                </div>
              </div>
            </div>

            {/* Supplier Information Card */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 mb-5">
              <div className="text-xs font-bold text-slate-500 mb-2 flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-emerald-600" />
                <span>مشخصات تامین‌کننده / فروشنده کالا:</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <span className="text-slate-500">نام شرکت / تامین‌کننده:</span>
                  <div className="font-bold text-slate-900 mt-0.5">
                    {invoice.supplierName}
                  </div>
                </div>
                {invoice.supplierPhone && (
                  <div>
                    <span className="text-slate-500">تلفن تماس:</span>
                    <div className="font-mono text-slate-900 mt-0.5">
                      {toPersianDigits(invoice.supplierPhone)}
                    </div>
                  </div>
                )}
                {invoice.supplierEconomicCode && (
                  <div>
                    <span className="text-slate-500">کد اقتصادی / شناسه ملی:</span>
                    <div className="font-mono text-slate-900 mt-0.5">
                      {toPersianDigits(invoice.supplierEconomicCode)}
                    </div>
                  </div>
                )}
                {invoice.supplierAddress && (
                  <div className="sm:col-span-3">
                    <span className="text-slate-500">آدرس:</span>
                    <div className="text-slate-800 mt-0.5">
                      {invoice.supplierAddress}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Items Table */}
            <div className="overflow-x-auto mb-5">
              <table className="w-full text-right border-collapse text-xs border border-slate-300">
                <thead>
                  <tr className="bg-slate-100 text-slate-800 border-b border-slate-300">
                    <th className="p-2.5 border-l border-slate-300 text-center w-10">ردیف</th>
                    <th className="p-2.5 border-l border-slate-300 w-24">کد کالا</th>
                    <th className="p-2.5 border-l border-slate-300">شرح کالا / خدمات</th>
                    <th className="p-2.5 border-l border-slate-300 text-center w-16">واحد</th>
                    <th className="p-2.5 border-l border-slate-300 text-center w-20">تعداد</th>
                    <th className="p-2.5 border-l border-slate-300 text-left w-28">قیمت واحد (تومان)</th>
                    <th className="p-2.5 border-l border-slate-300 text-left w-24">تخفیف</th>
                    <th className="p-2.5 text-left w-32">مبلغ کل (تومان)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {invoice.items.map((item, index) => (
                    <tr key={item.id || index} className={index % 2 === 1 ? 'bg-slate-50/50' : 'bg-white'}>
                      <td className="p-2.5 border-l border-slate-200 text-center font-mono">
                        {toPersianDigits(index + 1)}
                      </td>
                      <td className="p-2.5 border-l border-slate-200 font-mono text-slate-600">
                        {toPersianDigits(item.productCode)}
                      </td>
                      <td className="p-2.5 border-l border-slate-200 font-semibold text-slate-900">
                        {item.productName}
                      </td>
                      <td className="p-2.5 border-l border-slate-200 text-center text-slate-600">
                        {item.unit || 'عدد'}
                      </td>
                      <td className="p-2.5 border-l border-slate-200 text-center font-bold">
                        {toPersianDigits(item.quantity)}
                      </td>
                      <td className="p-2.5 border-l border-slate-200 text-left font-mono">
                        {toPersianDigits(formatPrice(item.buyPrice))}
                      </td>
                      <td className="p-2.5 border-l border-slate-200 text-left font-mono text-slate-600">
                        {item.discount > 0 ? toPersianDigits(formatPrice(item.discount)) : '—'}
                      </td>
                      <td className="p-2.5 text-left font-bold font-mono text-slate-900">
                        {toPersianDigits(formatPrice(item.total))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Financial Summary & Payment Info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              {/* Payment Details */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-2">
                <div className="font-bold text-slate-800 flex items-center gap-1.5 mb-1">
                  <CreditCard className="w-4 h-4 text-emerald-600" />
                  <span>اطلاعات و نحوه پرداخت فاکتور خرید:</span>
                </div>
                <div>
                  <span className="text-slate-500">روش پرداخت:</span>{' '}
                  <strong className="text-slate-800">
                    {PAYMENT_METHOD_LABELS[invoice.paymentMethod] || invoice.paymentMethod}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-500">وضعیت تسویه:</span>{' '}
                  <strong className={invoice.paymentStatus === 'paid' ? 'text-emerald-700' : 'text-amber-700'}>
                    {invoice.paymentStatus === 'paid' ? 'تسویه کامل شده' : invoice.paymentStatus === 'partial' ? 'پرداخت بیعانه / بخشی' : 'پرداخت نشده (نسیه)'}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-500">مبلغ پرداخت شده:</span>{' '}
                  <strong className="font-mono text-slate-900">
                    {toPersianDigits(formatPrice(invoice.paidAmount))} تومان
                  </strong>
                </div>
                {invoice.paymentMethod === 'cheque' && (
                  <div className="p-2 rounded-lg bg-amber-50 border border-amber-200 text-[11px] text-amber-900 space-y-1">
                    <div>شماره چک: {toPersianDigits(invoice.chequeNumber || '—')}</div>
                    <div>سررسید: {toPersianDigits(invoice.chequeDueDate || '—')}</div>
                    <div>نام صاحب حساب/چک: {invoice.chequeName || '—'}</div>
                  </div>
                )}
                {invoice.transferDescription && (
                  <div className="text-[11px] text-slate-600">
                    توضیحات فیش / حواله: {invoice.transferDescription}
                  </div>
                )}
                {invoice.notes && (
                  <div className="text-[11px] text-slate-600 pt-1 border-t border-slate-200">
                    یادداشت: {invoice.notes}
                  </div>
                )}
              </div>

              {/* Totals Table */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-2">
                <div className="flex justify-between text-slate-600">
                  <span>جمع کل اقلام:</span>
                  <span className="font-mono">{toPersianDigits(formatPrice(invoice.subtotal))} تومان</span>
                </div>
                {invoice.totalDiscount > 0 && (
                  <div className="flex justify-between text-rose-600 font-medium">
                    <span>مجموع تخفیف:</span>
                    <span className="font-mono">-{toPersianDigits(formatPrice(invoice.totalDiscount))} تومان</span>
                  </div>
                )}
                {invoice.shippingCost && invoice.shippingCost > 0 && (
                  <div className="flex justify-between text-slate-600">
                    <span>هزینه حمل و باربری:</span>
                    <span className="font-mono">+{toPersianDigits(formatPrice(invoice.shippingCost))} تومان</span>
                  </div>
                )}
                {invoice.taxAmount > 0 && (
                  <div className="flex justify-between text-slate-600">
                    <span>مالیات ({toPersianDigits(invoice.taxRate)}٪):</span>
                    <span className="font-mono">+{toPersianDigits(formatPrice(invoice.taxAmount))} تومان</span>
                  </div>
                )}
                <div className="flex justify-between pt-2 border-t-2 border-slate-300 font-black text-sm text-slate-900">
                  <span>مبلغ قابل پرداخت نهایی:</span>
                  <span className="font-mono text-emerald-800 text-base">
                    {toPersianDigits(formatPrice(invoice.finalTotal))} تومان
                  </span>
                </div>
                {invoice.finalTotal - invoice.paidAmount > 0 && (
                  <div className="flex justify-between pt-1 text-rose-700 font-bold text-xs">
                    <span>مانده بدهی به تامین‌کننده:</span>
                    <span className="font-mono">
                      {toPersianDigits(formatPrice(invoice.finalTotal - invoice.paidAmount))} تومان
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Signatures */}
            <div className="grid grid-cols-2 gap-8 pt-6 border-t border-slate-300 text-center text-xs text-slate-700">
              <div className="border border-dashed border-slate-300 rounded-xl p-3 h-24 flex flex-col justify-between">
                <div className="font-bold text-slate-800">امضا و مهر تامین‌کننده / فروشنده</div>
                <div className="text-[11px] text-slate-400">نام و تاریخ</div>
              </div>
              <div className="border border-dashed border-slate-300 rounded-xl p-3 h-24 flex flex-col justify-between">
                <div className="font-bold text-slate-800">امضا و تایید خریدار / مدیریت بازرگانی</div>
                <div className="text-[11px] text-slate-400">مهر و امضا</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
