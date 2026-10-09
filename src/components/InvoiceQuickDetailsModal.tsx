import React, { useState, useEffect, useRef } from 'react';
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
  Globe,
  Building2,
  ChevronUp,
  SlidersHorizontal
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
  const [isActionsOpen, setIsActionsOpen] = useState(false);
  const actionsDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsActionsOpen(false);
  }, [isOpen, invoice?.id]);

  useEffect(() => {
    if (!isActionsOpen) return;
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (actionsDropdownRef.current && !actionsDropdownRef.current.contains(e.target as Node)) {
        setIsActionsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isActionsOpen]);

  if (!isOpen || !invoice) return null;

  const canDelete = !currentUser || currentUser.role === 'admin' || currentUser.role === 'supervisor' || Boolean(currentUser.permissions?.canDeleteInvoice);
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
          {/* مشخصات فروشنده رسمی در فاکتورهای رسمی دارایی */}
          {invoice.type === 'official' && (
            <div className="bg-gradient-to-r from-emerald-50 to-teal-50/70 p-3.5 rounded-2xl border border-emerald-300/80 shadow-2xs space-y-2">
              <div className="flex items-center justify-between pb-1.5 border-b border-emerald-200">
                <div className="flex items-center gap-1.5 font-black text-slate-900 text-xs">
                  <Building2 className="w-4 h-4 text-emerald-700" />
                  <span>مشخصات فروشنده رسمی (فاکتور دارایی):</span>
                </div>
                <span className="text-[10px] bg-emerald-600 text-white font-bold px-2 py-0.5 rounded-md">
                  سربرگ رسمی
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] text-slate-700 pt-0.5">
                <div>
                  <span className="text-slate-400 block text-[10px]">نام فروشنده:</span>
                  <strong className="text-slate-900 font-bold truncate block">
                    {invoice.sellerName || settings.sellerName || settings.storeName || '---'}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">شماره اقتصادی:</span>
                  <strong className="font-mono text-slate-900 font-bold block" dir="ltr">
                    {invoice.sellerEconomicCode || settings.economicCode ? toPersianDigits(invoice.sellerEconomicCode || settings.economicCode) : '---'}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">شماره ثبت / مجوز:</span>
                  <strong className="font-mono text-slate-900 font-bold block" dir="ltr">
                    {toPersianDigits(invoice.sellerRegistrationNumber || settings.registrationNumber || invoice.sellerNationalCode || settings.nationalCode || '---')}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">شماره تلفن:</span>
                  <strong className="font-mono text-slate-900 font-bold block" dir="ltr">
                    {(invoice.sellerPhone || settings.phone || settings.mobile) ? toPersianDigits(invoice.sellerPhone || settings.phone || settings.mobile) : '---'}
                  </strong>
                </div>
                <div className="col-span-2 sm:col-span-4 text-[10px] text-slate-600 border-t border-emerald-200/50 pt-1">
                  <span className="text-slate-400">نشانی و آدرس: </span>
                  <span className="text-slate-800 font-medium">{invoice.sellerAddress || settings.address || 'نشانی ثبت نشده'}</span>
                </div>
              </div>
            </div>
          )}

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
                    const itemName = item.productName || item.name || 'کالای بدون نام';
                    const itemCode = item.productCode || item.code;
                    const itemPrice = typeof item.unitPrice === 'number' && !isNaN(item.unitPrice)
                      ? item.unitPrice
                      : typeof item.price === 'number' && !isNaN(item.price)
                      ? item.price
                      : 0;
                    const rowTotal = typeof item.total === 'number' && item.total > 0
                      ? item.total
                      : (Number(item.quantity) || 0) * itemPrice;

                    return (
                      <tr key={item.id || idx} className={idx % 2 === 1 ? 'bg-slate-50/50' : 'bg-white'}>
                        <td className="p-2.5 text-center text-slate-400 font-mono">{toPersianDigits(idx + 1)}</td>
                        <td className="p-2.5">
                          <div className="font-bold text-slate-900">{itemName}</div>
                          <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-500 flex-wrap">
                            {itemCode && (
                              <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">
                                کد: {toPersianDigits(itemCode)}
                              </span>
                            )}
                            {item.variantName && (
                              <span className="text-purple-700 font-medium bg-purple-50 px-1.5 py-0.5 rounded">
                                تنوع: {item.variantName}
                              </span>
                            )}
                            {item.barcode && (
                              <span className="font-mono text-slate-400">
                                بارکد: {toPersianDigits(item.barcode)}
                              </span>
                            )}
                          </div>
                          {(item.description || item.notes) && (
                            <div className="text-[11px] text-slate-600 mt-1 leading-snug">
                              <span className="text-slate-400 font-medium">توضیح: </span>{item.description || item.notes}
                            </div>
                          )}
                        </td>
                        <td className="p-2.5 text-center font-mono font-bold text-slate-800">
                          {toPersianDigits(item.quantity)}
                        </td>
                        <td className="p-2.5 text-center text-slate-500">{item.unit || 'عدد'}</td>
                        <td className="p-2.5 text-left font-mono text-slate-700">
                          {formatPrice(itemPrice, settings.currency)}
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
              <p className="text-slate-800 leading-relaxed whitespace-pre-line font-medium">{invoice.notes}</p>
            </div>
          )}
        </div>

        {/* Footer Actions Toolbar - بهینه‌سازی و خلوت‌سازی با منوی دراپ‌دان عملیات */}
        <div className="p-3 sm:p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-2.5 shrink-0">
          {/* Primary View & Print Button (سمت راست - دسترسی سریع و برجسته) */}
          <div className="flex-1 sm:flex-initial">
            <button
              type="button"
              id="invoice-details-view-print-btn"
              onClick={() => {
                onClose();
                onViewInvoice(invoice);
              }}
              className="w-full sm:w-auto min-h-[40px] px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md shadow-emerald-200/70 cursor-pointer"
            >
              <Printer className="w-4 h-4 shrink-0" />
              <span>مشاهده و چاپ کامل فاکتور</span>
            </button>
          </div>

          {/* Secondary Actions & Close (سمت چپ - تجمیع در دراپ‌دان خلوت و دکمه بستن) */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Actions Dropdown */}
            <div className="relative" ref={actionsDropdownRef}>
              <button
                type="button"
                id="invoice-details-actions-dropdown-btn"
                data-testid="invoice-details-actions-btn"
                onClick={() => setIsActionsOpen((prev) => !prev)}
                className={`min-h-[40px] px-3 sm:px-3.5 py-2 border rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer ${
                  isActionsOpen
                    ? 'bg-slate-200 text-slate-900 border-slate-300'
                    : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300/80'
                }`}
                title="سایر عملیات فاکتور"
                aria-expanded={isActionsOpen}
              >
                <SlidersHorizontal className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                <span>عملیات</span>
                {(!isPaid || invoice.isProforma) && (
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                )}
                <ChevronUp className={`w-3.5 h-3.5 text-slate-500 transition-transform duration-200 ${isActionsOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Dropup Menu (Opens upward inside modal) */}
              {isActionsOpen && (
                <div 
                  className="absolute bottom-full left-0 mb-2 w-56 sm:w-64 bg-white rounded-2xl border border-slate-200/90 shadow-2xl z-50 p-1.5 space-y-1 animate-in fade-in zoom-in-95 duration-100 text-right"
                  role="menu"
                >
                  {/* Convert Proforma if proforma */}
                  {invoice.isProforma && onConvertProforma && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsActionsOpen(false);
                        onClose();
                        onConvertProforma(invoice);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-bold rounded-xl text-indigo-800 bg-indigo-50/70 hover:bg-indigo-100 transition-colors cursor-pointer"
                      role="menuitem"
                    >
                      <ArrowRightLeft className="w-4 h-4 text-indigo-600 shrink-0" />
                      <span>تبدیل به فاکتور رسمی</span>
                    </button>
                  )}

                  {/* Register Payment (if unpaid/partial) */}
                  {onOpenPaymentModal && !isPaid && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsActionsOpen(false);
                        onClose();
                        onOpenPaymentModal(invoice);
                      }}
                      className="w-full flex items-center justify-between px-3 py-2 text-xs font-bold rounded-xl text-emerald-800 bg-emerald-50/70 hover:bg-emerald-100 transition-colors cursor-pointer"
                      role="menuitem"
                    >
                      <div className="flex items-center gap-2.5">
                        <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>ثبت دریافتی (تسویه)</span>
                      </div>
                      <span className="text-[10px] bg-emerald-200/60 text-emerald-900 px-1.5 py-0.5 rounded-md font-mono">
                        {toPersianDigits(formatPrice(remainingDebt, settings.currency))}
                      </span>
                    </button>
                  )}

                  {/* Edit Invoice */}
                  {onEditInvoice && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsActionsOpen(false);
                        onClose();
                        onEditInvoice(invoice);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-bold rounded-xl text-blue-800 hover:bg-blue-50 transition-colors cursor-pointer"
                      role="menuitem"
                    >
                      <Pencil className="w-4 h-4 text-blue-600 shrink-0" />
                      <span>ویرایش فاکتور</span>
                    </button>
                  )}

                  {/* Public Web Link for Customer */}
                  {onOpenShareLinkModal && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsActionsOpen(false);
                        onClose();
                        onOpenShareLinkModal(invoice);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-bold rounded-xl text-sky-800 hover:bg-sky-50 transition-colors cursor-pointer"
                      role="menuitem"
                    >
                      <Globe className="w-4 h-4 text-sky-600 shrink-0" />
                      <span>لینک آنلاین مشتری</span>
                    </button>
                  )}

                  {/* Export Customer to Excel */}
                  {onExportCustomer && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsActionsOpen(false);
                        onClose();
                        onExportCustomer(invoice);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-bold rounded-xl text-purple-800 hover:bg-purple-50 transition-colors cursor-pointer"
                      role="menuitem"
                    >
                      <FileSpreadsheet className="w-4 h-4 text-purple-600 shrink-0" />
                      <span>اکسپورت مشتری</span>
                    </button>
                  )}

                  {/* Destructive actions (Divider + Return / Delete) */}
                  {canDelete && (
                    <>
                      <div className="my-1 border-t border-slate-100" />

                      {/* Return to stock */}
                      {onReturnInvoiceToStock && (
                        <button
                          type="button"
                          onClick={() => {
                            setIsActionsOpen(false);
                            onClose();
                            onReturnInvoiceToStock(invoice);
                          }}
                          className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-bold rounded-xl text-amber-800 hover:bg-amber-50 transition-colors cursor-pointer"
                          role="menuitem"
                        >
                          <RotateCcw className="w-4 h-4 text-amber-600 shrink-0" />
                          <span>{invoice.isProforma ? 'لغو و حذف پیش‌فاکتور' : 'مرجوعی به انبار'}</span>
                        </button>
                      )}

                      {/* Delete */}
                      {onDeleteInvoice && (
                        <button
                          type="button"
                          onClick={() => {
                            setIsActionsOpen(false);
                            onClose();
                            onDeleteInvoice(invoice.id);
                          }}
                          className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-bold rounded-xl text-rose-700 hover:bg-rose-50 transition-colors cursor-pointer"
                          role="menuitem"
                        >
                          <Trash2 className="w-4 h-4 text-rose-600 shrink-0" />
                          <span>حذف سند</span>
                        </button>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="min-h-[40px] px-3.5 sm:px-4 py-2 bg-slate-200 hover:bg-slate-300 active:scale-95 text-slate-700 rounded-xl font-bold text-xs transition-all cursor-pointer"
            >
              بستن
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
