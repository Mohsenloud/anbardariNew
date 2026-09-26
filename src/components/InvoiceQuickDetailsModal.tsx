import React from 'react';
import { Invoice, StoreSettings, AppUser } from '../types';
import { formatPrice, toPersianDigits } from '../utils/jalali';
import { 
  X, 
  Printer, 
  Pencil, 
  Trash2, 
  RotateCcw, 
  ArrowRightLeft, 
  CheckCircle, 
  Clock, 
  AlertCircle, 
  User, 
  Phone, 
  Calendar, 
  Coins, 
  ReceiptText, 
  FileSpreadsheet, 
  CreditCard,
  Layers,
  FileClock,
  ShieldAlert,
  Globe
} from 'lucide-react';

interface InvoiceQuickDetailsModalProps {
  isOpen: boolean;
  invoice: Invoice | null;
  settings: StoreSettings;
  currentUser?: AppUser;
  onClose: () => void;
  onViewInvoice: (invoice: Invoice) => void;
  onEditInvoice?: (invoice: Invoice) => void;
  onOpenPaymentModal?: (invoice: Invoice) => void;
  onOpenShareLinkModal?: (invoice: Invoice) => void;
  onConvertProforma?: (invoice: Invoice) => void;
  onReturnInvoiceToStock?: (invoice: Invoice) => void;
  onDeleteInvoice?: (invoiceId: string) => void;
  onExportCustomer?: (invoice: Invoice) => void;
}

export const InvoiceQuickDetailsModal: React.FC<InvoiceQuickDetailsModalProps> = ({
  isOpen,
  invoice,
  settings,
  currentUser,
  onClose,
  onViewInvoice,
  onEditInvoice,
  onOpenPaymentModal,
  onOpenShareLinkModal,
  onConvertProforma,
  onReturnInvoiceToStock,
  onDeleteInvoice,
  onExportCustomer,
}) => {
  if (!isOpen || !invoice) return null;

  const canDelete = currentUser?.role === 'admin' || !currentUser;
  const isPaid = invoice.paymentStatus === 'paid';
  const isPartial = invoice.paymentStatus === 'partial';
  const isUnpaid = invoice.paymentStatus === 'unpaid';
  const remainingDebt = Math.max(0, invoice.finalTotal - (isPaid ? invoice.finalTotal : (invoice.paidAmount || 0)));
  const totalItemCount = invoice.items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden text-right">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${
              invoice.isProforma ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-400/30' : 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30'
            }`}>
              {invoice.isProforma ? <FileClock className="w-5 h-5" /> : <ReceiptText className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-base sm:text-lg">
                  {invoice.isProforma ? 'جزئیات پیش‌فاکتور' : 'جزئیات فاکتور فروش'}
                </h3>
                <span className="font-mono font-bold bg-white/20 text-white text-xs px-2.5 py-0.5 rounded-lg border border-white/20">
                  {toPersianDigits(invoice.invoiceNumber)}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-300 mt-0.5">
                <span>تاریخ صدور: {toPersianDigits(invoice.date)}</span>
                {invoice.type && (
                  <>
                    <span>•</span>
                    <span>
                      {invoice.type === 'official' ? 'فاکتور رسمی' : invoice.type === 'thermal' ? 'رسید حرارتی' : invoice.type === 'simple' ? 'ساده' : 'فروشگاهی'}
                    </span>
                  </>
                )}
                {invoice.convertedFromProforma && (
                  <span className="text-emerald-300 font-bold">
                    (تبدیل از پیش‌فاکتور {toPersianDigits(invoice.convertedFromProforma)})
                  </span>
                )}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
            title="بستن"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 text-xs text-slate-700">
          {/* Customer & Status Top Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Customer info */}
            <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/90 space-y-2">
              <div className="flex items-center gap-1.5 text-slate-500 font-bold pb-1.5 border-b border-slate-200">
                <User className="w-4 h-4 text-slate-600" />
                <span>مشخصات خریدار:</span>
              </div>
              <div className="space-y-1 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">نام شخص / شرکت:</span>
                  <span className="font-bold text-slate-900 text-sm">{invoice.customerName}</span>
                </div>
                {invoice.customerPhone && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">شماره تماس:</span>
                    <span className="font-mono text-slate-800 font-bold">{toPersianDigits(invoice.customerPhone)}</span>
                  </div>
                )}
                {invoice.customerNationalId && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">کد ملی / شناسه اقتصادی:</span>
                    <span className="font-mono text-slate-700">{toPersianDigits(invoice.customerNationalId)}</span>
                  </div>
                )}
                {invoice.customerAddress && (
                  <div className="pt-1 text-[11px] text-slate-600 border-t border-slate-200/60">
                    <span className="text-slate-500">آدرس: </span>
                    <span>{invoice.customerAddress}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Financial Status Card */}
            <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/90 space-y-2">
              <div className="flex items-center justify-between pb-1.5 border-b border-slate-200">
                <div className="flex items-center gap-1.5 text-slate-500 font-bold">
                  <Coins className="w-4 h-4 text-slate-600" />
                  <span>وضعیت تسویه و پرداخت:</span>
                </div>
                {onOpenPaymentModal && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenPaymentModal(invoice);
                    }}
                    className="text-[11px] text-emerald-700 hover:text-emerald-900 font-bold cursor-pointer underline"
                  >
                    ثبت دریافت / تسویه
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2 pt-0.5">
                <span
                  className={`px-3 py-1 rounded-xl font-bold text-xs flex items-center gap-1.5 border shadow-2xs ${
                    isPaid
                      ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                      : isPartial
                      ? 'bg-amber-100 text-amber-800 border-amber-300'
                      : 'bg-rose-100 text-rose-800 border-rose-300'
                  }`}
                >
                  {isPaid && <CheckCircle className="w-4 h-4 text-emerald-600" />}
                  {isPartial && <Clock className="w-4 h-4 text-amber-600" />}
                  {isUnpaid && <AlertCircle className="w-4 h-4 text-rose-600" />}
                  <span>
                    {isPaid ? 'تسویه کامل شده' : isPartial ? 'بیعانه / پرداخت اقساطی' : 'نسیه / پرداخت نشده'}
                  </span>
                </span>

                <span className="bg-white border border-slate-200 px-2.5 py-1 rounded-xl font-bold text-slate-700">
                  {invoice.paymentMethod === 'cheque'
                    ? 'چک بانکی'
                    : invoice.paymentMethod === 'cash'
                    ? 'نقد'
                    : invoice.paymentMethod === 'transfer'
                    ? 'حواله بانکی'
                    : invoice.paymentMethod === 'pos'
                    ? 'کارتخوان'
                    : 'دفتری'}
                </span>
              </div>

              {/* Financial summary numbers */}
              <div className="space-y-1 pt-1 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">مبلغ کل فاکتور:</span>
                  <span className="font-bold font-mono text-slate-900 text-sm">{formatPrice(invoice.finalTotal, settings.currency)}</span>
                </div>
                {!isPaid && (
                  <div className="flex items-center justify-between text-rose-700 font-bold">
                    <span>مانده طلب (بدهی):</span>
                    <span className="font-mono">{formatPrice(remainingDebt, settings.currency)}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Cheque Details Box (if applicable) */}
          {invoice.paymentMethod === 'cheque' && (invoice.chequeNumber || invoice.chequeDueDate) && (
            <div className="bg-sky-50 p-3.5 rounded-2xl border border-sky-200/90 text-xs space-y-1.5 text-sky-900">
              <div className="font-bold flex items-center gap-1.5 pb-1 border-b border-sky-200">
                <CreditCard className="w-4 h-4 text-sky-600" />
                <span>مشخصات چک دریافتی</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                <div>
                  <span className="text-sky-700">شماره چک: </span>
                  <strong className="font-mono">{toPersianDigits(invoice.chequeNumber || '---')}</strong>
                </div>
                <div>
                  <span className="text-sky-700">تاریخ سررسید: </span>
                  <strong className="font-mono">{toPersianDigits(invoice.chequeDueDate || '---')}</strong>
                </div>
                <div>
                  <span className="text-sky-700">صاحب چک: </span>
                  <strong>{invoice.chequeName || '---'}</strong>
                </div>
              </div>
            </div>
          )}

          {/* Items Table */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-bold text-slate-800">
                <Layers className="w-4 h-4 text-emerald-600" />
                <span>اقلام فاکتور ({toPersianDigits(invoice.items.length)} ردیف کالایی)</span>
              </div>
              <span className="font-bold text-slate-700 bg-slate-100 px-2.5 py-0.5 rounded-lg">
                مجموع تعداد: <strong className="font-mono font-black text-emerald-700">{toPersianDigits(totalItemCount)}</strong>
              </span>
            </div>

            <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white">
              <table className="w-full text-right border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100/80 text-slate-700 border-b border-slate-200">
                    <th className="p-2.5 font-bold text-center w-10">#</th>
                    <th className="p-2.5 font-bold">شرح کالا</th>
                    <th className="p-2.5 font-bold text-center">تعداد</th>
                    <th className="p-2.5 font-bold text-center">واحد</th>
                    <th className="p-2.5 font-bold text-left">قیمت واحد</th>
                    <th className="p-2.5 font-bold text-left">مبلغ کل</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {invoice.items.map((item, idx) => {
                    const rowTotal = (Number(item.quantity) || 0) * (Number(item.price) || 0);
                    return (
                      <tr key={item.id || idx} className={idx % 2 === 1 ? 'bg-slate-50/50' : 'bg-white'}>
                        <td className="p-2.5 text-center text-slate-400 font-mono">{toPersianDigits(idx + 1)}</td>
                        <td className="p-2.5">
                          <div className="font-bold text-slate-900">{item.name}</div>
                          {item.variantName && (
                            <div className="text-[10px] text-purple-700 font-medium mt-0.5">
                              تنوع: {item.variantName}
                            </div>
                          )}
                        </td>
                        <td className="p-2.5 text-center font-mono font-bold text-slate-800">
                          {toPersianDigits(item.quantity)}
                        </td>
                        <td className="p-2.5 text-center text-slate-500">{item.unit || 'عدد'}</td>
                        <td className="p-2.5 text-left font-mono text-slate-700">
                          {formatPrice(item.price, settings.currency)}
                        </td>
                        <td className="p-2.5 text-left font-mono font-bold text-slate-900">
                          {formatPrice(rowTotal, settings.currency)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Notes if present */}
          {invoice.notes && (
            <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 text-xs">
              <span className="text-slate-500 font-bold block mb-1">یادداشت و توضیحات فاکتور:</span>
              <p className="text-slate-800 leading-relaxed">{invoice.notes}</p>
            </div>
          )}
        </div>

        {/* Footer Actions Toolbar */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            {/* Convert Proforma if proforma */}
            {invoice.isProforma && onConvertProforma && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onConvertProforma(invoice);
                }}
                className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
              >
                <ArrowRightLeft className="w-4 h-4" />
                <span>تبدیل به فاکتور رسمی</span>
              </button>
            )}

            {/* Edit */}
            {onEditInvoice && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onEditInvoice(invoice);
                }}
                className="px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Pencil className="w-4 h-4" />
                <span>ویرایش</span>
              </button>
            )}

            {/* Settle / Payment */}
            {onOpenPaymentModal && !isPaid && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenPaymentModal(invoice);
                }}
                className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <CheckCircle className="w-4 h-4 text-emerald-600" />
                <span>ثبت دریافتی</span>
              </button>
            )}

            {/* Export customer */}
            {onExportCustomer && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onExportCustomer(invoice);
                }}
                className="px-3 py-2 bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-200 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                title="خروجی اکسل فاکتورها و حواله‌های این مشتری"
              >
                <FileSpreadsheet className="w-4 h-4 text-purple-600" />
                <span className="hidden sm:inline">اکسپورت مشتری</span>
              </button>
            )}

            {/* Public Web Link for Customer */}
            {onOpenShareLinkModal && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenShareLinkModal(invoice);
                }}
                className="px-3 py-2 bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-200 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                title="ایجاد و اشتراک لینک نسخه تحت وب برای مشتری (بدون نیاز به دانلود PDF)"
              >
                <Globe className="w-4 h-4 text-sky-600" />
                <span>لینک آنلاین مشتری</span>
              </button>
            )}

            {canDelete && (
              <>
                {/* Return */}
                {onReturnInvoiceToStock && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onReturnInvoiceToStock(invoice);
                    }}
                    title={invoice.isProforma ? 'لغو و حذف پیش‌فاکتور' : 'مرجوعی به انبار'}
                    className="p-2 text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-xl border border-amber-200 cursor-pointer"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                )}

                {/* Delete */}
                {onDeleteInvoice && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onDeleteInvoice(invoice.id);
                    }}
                    title="حذف سند"
                    className="p-2 text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-xl border border-rose-200 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                onClose();
                onViewInvoice(invoice);
              }}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all shadow-md shadow-emerald-200 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>مشاهده و چاپ کامل فاکتور</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl font-bold text-xs transition-colors cursor-pointer"
            >
              بستن
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
