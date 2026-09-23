import React from 'react';
import { Invoice, ExitSlipData, StoreSettings, AppUser } from '../types';
import { toPersianDigits } from '../utils/jalali';
import { 
  X, 
  Printer, 
  Truck, 
  Clock, 
  CheckCircle2, 
  Calendar, 
  User, 
  Phone, 
  Package, 
  FileText, 
  History, 
  FileSpreadsheet,
  Edit3,
  Layers,
  MapPin,
  Check
} from 'lucide-react';

interface ExitSlipDetailsModalProps {
  isOpen: boolean;
  invoice: Invoice | null;
  slipLog: ExitSlipData;
  settings: StoreSettings;
  currentUser?: AppUser;
  onClose: () => void;
  onPrint: (invoice: Invoice) => void;
  onOpenDeliveryModal: (invoice: Invoice) => void;
  onOpenHistoryModal?: (invoice: Invoice) => void;
  onExportCustomer?: (invoice: Invoice) => void;
  onToggleDelivery?: (invoiceId: string) => void;
}

export const ExitSlipDetailsModal: React.FC<ExitSlipDetailsModalProps> = ({
  isOpen,
  invoice,
  slipLog,
  settings,
  onClose,
  onPrint,
  onOpenDeliveryModal,
  onOpenHistoryModal,
  onExportCustomer,
  onToggleDelivery,
}) => {
  if (!isOpen || !invoice) return null;

  const isDelivered = Boolean(slipLog.isDelivered);
  const isPrinted = slipLog.printCount > 0;
  const totalQuantity = invoice.items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
  const slipNumber = slipLog.slipNumber || invoice.invoiceNumber;

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
            <div className="w-10 h-10 rounded-2xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-300">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-base sm:text-lg">
                  جزئیات برگه خروج انبار
                </h3>
                <span className="font-mono font-bold bg-white/20 text-white text-xs px-2.5 py-0.5 rounded-lg border border-white/20">
                  {toPersianDigits(slipNumber)}
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                فاکتور مرجع: {toPersianDigits(invoice.invoiceNumber)} | تاریخ صدور: {toPersianDigits(invoice.date)}
              </p>
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

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 text-xs text-slate-700">
          {/* Top Status & Customer Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Customer Information Card */}
            <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/90 space-y-2">
              <div className="flex items-center gap-1.5 text-slate-500 font-bold pb-1.5 border-b border-slate-200">
                <User className="w-4 h-4 text-slate-600" />
                <span>مشخصات مشتری / خریدار:</span>
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
                {invoice.customerAddress && (
                  <div className="pt-1 text-[11px] text-slate-600 border-t border-slate-200/60">
                    <span className="text-slate-500">نشانی: </span>
                    <span>{invoice.customerAddress}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Delivery Status & Quick Toggle Card */}
            <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/90 space-y-2">
              <div className="flex items-center justify-between pb-1.5 border-b border-slate-200">
                <div className="flex items-center gap-1.5 text-slate-500 font-bold">
                  <Clock className="w-4 h-4 text-slate-600" />
                  <span>وضعیت تحویل فیزیکی:</span>
                </div>
                {onToggleDelivery && (
                  <button
                    type="button"
                    onClick={() => onToggleDelivery(invoice.id)}
                    className="text-[11px] text-blue-600 hover:text-blue-800 font-bold cursor-pointer underline"
                  >
                    {isDelivered ? 'تغییر به در انتظار تحویل' : 'تایید فوری تحویل بار'}
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2 pt-0.5">
                <span
                  className={`px-3 py-1 rounded-xl font-bold text-xs flex items-center gap-1.5 border shadow-2xs ${
                    isDelivered
                      ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                      : 'bg-amber-100 text-amber-800 border-amber-300'
                  }`}
                >
                  {isDelivered ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>بار با موفقیت تحویل شد</span>
                    </>
                  ) : (
                    <>
                      <Clock className="w-4 h-4 text-amber-600" />
                      <span>در انتظار بارگیری و تحویل</span>
                    </>
                  )}
                </span>

                <span
                  className={`px-2.5 py-1 rounded-xl font-bold text-xs flex items-center gap-1 border ${
                    isPrinted
                      ? 'bg-blue-100 text-blue-800 border-blue-200'
                      : 'bg-slate-200/70 text-slate-700 border-slate-300'
                  }`}
                >
                  {isPrinted ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-blue-600" />
                      <span>چاپ شده ({toPersianDigits(slipLog.printCount)} بار)</span>
                    </>
                  ) : (
                    <span>هنوز چاپ نشده</span>
                  )}
                </span>
              </div>
              {slipLog.deliveredAt && (
                <div className="text-[11px] text-slate-500 pt-0.5">
                  زمان تایید خروج: <strong className="font-mono text-slate-700">{toPersianDigits(slipLog.deliveredAt)}</strong>
                  {slipLog.deliveredBy && <span> (توسط: {slipLog.deliveredBy})</span>}
                </div>
              )}
            </div>
          </div>

          {/* Driver & Vehicle Details Box */}
          <div className="bg-blue-50/60 p-4 rounded-2xl border border-blue-200/80 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-blue-200/80">
              <div className="flex items-center gap-2 font-bold text-slate-800 text-xs sm:text-sm">
                <Truck className="w-4 h-4 text-blue-600" />
                <span>مشخصات راننده، خودرو و بارگیری</span>
              </div>
              <button
                type="button"
                onClick={() => onOpenDeliveryModal(invoice)}
                className="px-3 py-1 bg-white hover:bg-blue-50 text-blue-700 border border-blue-300 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>{isDelivered || slipLog.vehicleInfo ? 'ویرایش مشخصات ماشین' : 'ثبت راننده و خودرو'}</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-slate-500 block mb-0.5">راننده / تحویل‌گیرنده:</span>
                <span className="font-bold text-slate-900 bg-white px-2.5 py-1 rounded-lg border border-blue-100 block">
                  {slipLog.receiverName || invoice.customerName || 'ثبت نشده'}
                </span>
              </div>

              <div>
                <span className="text-slate-500 block mb-0.5">شماره تماس راننده / هماهنگی:</span>
                <span className="font-bold font-mono text-slate-900 bg-white px-2.5 py-1 rounded-lg border border-blue-100 block">
                  {slipLog.receiverPhone ? toPersianDigits(slipLog.receiverPhone) : (invoice.customerPhone ? toPersianDigits(invoice.customerPhone) : 'ثبت نشده')}
                </span>
              </div>

              <div className="sm:col-span-2">
                <span className="text-slate-500 block mb-0.5">مشخصات خودرو، بارگیر و پلاک:</span>
                <span className="font-bold text-slate-900 bg-white px-2.5 py-1.5 rounded-lg border border-blue-100 block">
                  {slipLog.vehicleInfo || 'مشخصات خودرو هنوز ثبت نشده است.'}
                </span>
              </div>

              {slipLog.deliveryNotes && (
                <div className="sm:col-span-2">
                  <span className="text-slate-500 block mb-0.5">توضیحات انباردار / بارگیری:</span>
                  <span className="text-slate-700 bg-white px-2.5 py-1.5 rounded-lg border border-blue-100 block">
                    {slipLog.deliveryNotes}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Items Table */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-bold text-slate-800">
                <Package className="w-4 h-4 text-emerald-600" />
                <span>اقلام برگه خروج انبار ({toPersianDigits(invoice.items.length)} ردیف کالایی)</span>
              </div>
              <span className="font-bold text-slate-700 bg-slate-100 px-2.5 py-0.5 rounded-lg">
                مجموع تعداد کل: <strong className="font-mono font-black text-emerald-700">{toPersianDigits(totalQuantity)}</strong>
              </span>
            </div>

            <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white">
              <table className="w-full text-right border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100/80 text-slate-700 border-b border-slate-200">
                    <th className="p-2.5 font-bold text-center w-12">#</th>
                    <th className="p-2.5 font-bold">شرح کالا</th>
                    <th className="p-2.5 font-bold text-center">کد کالا</th>
                    <th className="p-2.5 font-bold text-center">تعداد / مقدار</th>
                    <th className="p-2.5 font-bold text-center">واحد</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {invoice.items.map((item, idx) => (
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
                      <td className="p-2.5 text-center font-mono text-slate-600">{toPersianDigits(item.code || '---')}</td>
                      <td className="p-2.5 text-center font-mono font-bold text-emerald-700 text-sm">
                        {toPersianDigits(item.quantity)}
                      </td>
                      <td className="p-2.5 text-center text-slate-600">{item.unit || 'عدد'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Print History Information */}
          {slipLog.lastPrintedAt && (
            <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 flex items-center justify-between text-[11px] text-slate-500">
              <div className="flex items-center gap-1.5">
                <Printer className="w-3.5 h-3.5 text-slate-400" />
                <span>آخرین بار چاپ شده: <strong className="font-mono text-slate-700">{toPersianDigits(slipLog.lastPrintedAt)}</strong></span>
              </div>
              {onOpenHistoryModal && slipLog.history && slipLog.history.length > 0 && (
                <button
                  type="button"
                  onClick={() => onOpenHistoryModal(invoice)}
                  className="text-blue-600 hover:text-blue-800 font-bold flex items-center gap-1 cursor-pointer"
                >
                  <History className="w-3.5 h-3.5" />
                  <span>مشاهده تاریخچه کامل چاپ</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2">
            {onExportCustomer && (
              <button
                type="button"
                onClick={() => onExportCustomer(invoice)}
                className="px-3.5 py-2 bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-200 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                title="خروجی اکسل فاکتورها و حواله‌های این شخص"
              >
                <FileSpreadsheet className="w-4 h-4 text-purple-600" />
                <span className="hidden sm:inline">اکسپورت اسناد مشتری</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => onOpenDeliveryModal(invoice)}
              className="px-3.5 py-2 bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Truck className="w-4 h-4 text-blue-600" />
              <span>مشخصات ماشین و تحویل</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                onClose();
                onPrint(invoice);
              }}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all shadow-md shadow-emerald-200 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>چاپ برگه خروج انبار</span>
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
