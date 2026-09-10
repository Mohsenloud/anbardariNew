import React, { useState } from 'react';
import { Invoice, StoreSettings, AppUser } from '../types';
import { formatPrice, toPersianDigits } from '../utils/jalali';
import { 
  Search, 
  Printer, 
  Trash2, 
  RotateCcw, 
  ReceiptText, 
  CheckCircle, 
  Clock, 
  FileText,
  AlertCircle,
  Plus
} from 'lucide-react';

interface InvoicesListProps {
  invoices: Invoice[];
  settings: StoreSettings;
  currentUser?: AppUser;
  onViewInvoice: (invoice: Invoice) => void;
  onDeleteInvoice: (invoiceId: string) => void;
  onReturnInvoiceToStock: (invoice: Invoice) => void;
  onUpdatePaymentStatus: (invoiceId: string, status: 'paid' | 'unpaid' | 'partial', paidAmount?: number) => void;
  onNewInvoice: () => void;
}

export const InvoicesList: React.FC<InvoicesListProps> = ({
  invoices,
  settings,
  currentUser,
  onViewInvoice,
  onDeleteInvoice,
  onReturnInvoiceToStock,
  onUpdatePaymentStatus,
  onNewInvoice,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'paid' | 'partial' | 'unpaid'>('all');
  const [invoiceToDelete, setInvoiceToDelete] = useState<Invoice | null>(null);
  const [invoiceToReturn, setInvoiceToReturn] = useState<Invoice | null>(null);

  const filteredInvoices = invoices.filter((inv) => {
    const matchesSearch =
      inv.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inv.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (inv.customerPhone && inv.customerPhone.includes(searchQuery));

    const matchesStatus = statusFilter === 'all' || inv.paymentStatus === statusFilter;

    return matchesSearch && matchesStatus;
  });

  // KPI calculations
  const totalSalesVolume = invoices.reduce((sum, inv) => sum + inv.finalTotal, 0);
  const totalReceivedCash = invoices.reduce((sum, inv) => {
    if (inv.paymentStatus === 'paid') return sum + inv.finalTotal;
    if (inv.paymentStatus === 'partial') return sum + (inv.paidAmount || 0);
    return sum;
  }, 0);
  const totalPendingDebt = Math.max(0, totalSalesVolume - totalReceivedCash);

  const canCreate = !currentUser || currentUser.permissions.canCreateInvoice;
  const canDelete = !currentUser || currentUser.permissions.canDeleteInvoice;

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12">
      {/* Top Header Card */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-emerald-50 text-emerald-700">
              <ReceiptText className="w-5 h-5" />
            </span>
            <h2 className="text-xl font-bold text-slate-800">لیست و مدیریت فاکتورهای فروش</h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            مشاهده سوابق فاکتورها، چاپ مجدد، وضعیت تسویه حساب و امکان مرجوعی کالا به انبار
          </p>
        </div>

        {canCreate && (
          <button
            id="invoices-list-new-btn"
            onClick={onNewInvoice}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm shadow-emerald-200 cursor-pointer self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>صدور فاکتور جدید</span>
          </button>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <span className="text-xs text-slate-500 font-medium">مجموع فروش فاکتورها</span>
          <div className="text-lg font-black text-slate-800 mt-1">
            {formatPrice(totalSalesVolume, settings.currency)}
          </div>
          <span className="text-[11px] text-slate-400 mt-0.5 block">
            تعداد کل: {toPersianDigits(invoices.length)} فاکتور
          </span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <span className="text-xs text-slate-500 font-medium">مبلغ وصول شده (نقد و پوز)</span>
          <div className="text-lg font-black text-emerald-700 mt-1">
            {formatPrice(totalReceivedCash, settings.currency)}
          </div>
          <span className="text-[11px] text-slate-400 mt-0.5 block">
            دریافتی‌های قطعی
          </span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-amber-200 bg-amber-50/30 shadow-xs">
          <span className="text-xs text-amber-800 font-medium">مانده طلب و نسیه (وصول نشده)</span>
          <div className="text-lg font-black text-amber-700 mt-1">
            {formatPrice(totalPendingDebt, settings.currency)}
          </div>
          <span className="text-[11px] text-amber-600 mt-0.5 block">
            مطالبات دفتری مشتریان
          </span>
        </div>
      </div>

      {/* List Container */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        {/* Filter bar */}
        <div className="p-4 border-b border-slate-200/80 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between bg-slate-50/60">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              id="invoices-search-input"
              placeholder="جستجو بر اساس شماره فاکتور، نام مشتری یا تلفن..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-xl pr-9 pl-4 py-2 text-xs text-slate-800 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
            />
          </div>

          <div className="flex bg-white border border-slate-200 rounded-xl p-1 text-xs self-start sm:self-auto">
            <button
              id="filter-inv-all"
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                statusFilter === 'all' ? 'bg-slate-900 text-white font-medium' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              همه ({invoices.length})
            </button>
            <button
              id="filter-inv-paid"
              onClick={() => setStatusFilter('paid')}
              className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                statusFilter === 'paid' ? 'bg-emerald-600 text-white font-medium' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              تسویه شده
            </button>
            <button
              id="filter-inv-partial"
              onClick={() => setStatusFilter('partial')}
              className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                statusFilter === 'partial' ? 'bg-amber-600 text-white font-medium' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              بیعانه / اقساط
            </button>
            <button
              id="filter-inv-unpaid"
              onClick={() => setStatusFilter('unpaid')}
              className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                statusFilter === 'unpaid' ? 'bg-rose-600 text-white font-medium' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              نسیه
            </button>
          </div>
        </div>

        {/* Mobile View: Cards (Hidden on Desktop) */}
        <div className="block sm:hidden divide-y divide-slate-100">
          {filteredInvoices.length === 0 ? (
            <div className="text-center py-12 text-slate-400 p-4">
              <ReceiptText className="w-8 h-8 mx-auto mb-2 text-slate-300" />
              <span>هیچ فاکتوری با این مشخصات یافت نشد.</span>
            </div>
          ) : (
            filteredInvoices.map((inv) => {
              const itemCount = inv.items.reduce((s, i) => s + i.quantity, 0);

              return (
                <div key={inv.id} className="p-4 space-y-3 hover:bg-slate-50/50 transition-colors">
                  {/* Card Header: Invoice No + Date + Status */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-black text-slate-900 text-sm">
                          #{toPersianDigits(inv.invoiceNumber)}
                        </span>
                        <span className="text-[10px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md font-medium">
                          {inv.type === 'official' ? 'رسمی' : inv.type === 'thermal' ? 'حرارتی' : 'فروشگاهی'}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-400 font-mono mt-0.5 block">
                        {inv.date}
                      </span>
                    </div>

                    {/* Status Badge */}
                    <span
                      className={`px-2.5 py-1 rounded-full font-bold text-[11px] flex items-center gap-1 shrink-0 ${
                        inv.paymentStatus === 'paid'
                          ? 'bg-emerald-100 text-emerald-800'
                          : inv.paymentStatus === 'partial'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {inv.paymentStatus === 'paid' && <CheckCircle className="w-3 h-3" />}
                      {inv.paymentStatus === 'partial' && <Clock className="w-3 h-3" />}
                      {inv.paymentStatus === 'unpaid' && <AlertCircle className="w-3 h-3" />}
                      <span>
                        {inv.paymentStatus === 'paid'
                          ? 'تسویه کامل'
                          : inv.paymentStatus === 'partial'
                          ? 'بیعانه'
                          : 'نسیه'}
                      </span>
                    </span>
                  </div>

                  {/* Customer and Total */}
                  <div className="bg-slate-50/80 rounded-xl p-3 flex items-center justify-between border border-slate-100">
                    <div>
                      <span className="text-[10px] text-slate-400 block">خریدار:</span>
                      <span className="text-xs font-bold text-slate-800 block">{inv.customerName}</span>
                      {inv.customerPhone && (
                        <a
                          href={`tel:${inv.customerPhone}`}
                          className="text-[11px] text-emerald-700 font-mono mt-0.5 inline-block hover:underline"
                        >
                          {toPersianDigits(inv.customerPhone)}
                        </a>
                      )}
                    </div>
                    <div className="text-left">
                      <span className="text-[10px] text-slate-400 block">
                        {toPersianDigits(itemCount)} قلم کالا
                      </span>
                      <span className="text-sm font-black text-slate-900">
                        {formatPrice(inv.finalTotal, settings.currency)}
                      </span>
                    </div>
                  </div>

                  {/* Payment method & quick settle */}
                  <div className="flex flex-col gap-1 text-[11px] text-slate-500 pt-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span>روش دریافت:</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          inv.paymentMethod === 'cheque'
                            ? 'bg-sky-100 text-sky-800'
                            : inv.paymentMethod === 'cash'
                            ? 'bg-emerald-100 text-emerald-800'
                            : inv.paymentMethod === 'transfer'
                            ? 'bg-indigo-100 text-indigo-800'
                            : inv.paymentMethod === 'pos'
                            ? 'bg-teal-100 text-teal-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}>
                          {inv.paymentMethod === 'cheque'
                            ? 'چک'
                            : inv.paymentMethod === 'cash'
                            ? 'نقدی'
                            : inv.paymentMethod === 'transfer'
                            ? 'واریز به حساب'
                            : inv.paymentMethod === 'pos'
                            ? 'کارتخوان'
                            : 'دفتری'}
                        </span>
                      </div>
                      {inv.paymentStatus !== 'paid' && (
                        <button
                          type="button"
                          onClick={() => onUpdatePaymentStatus(inv.id, 'paid')}
                          className="text-emerald-700 font-bold hover:underline cursor-pointer flex items-center gap-1"
                        >
                          <CheckCircle className="w-3 h-3" />
                          <span>علامت‌گذاری به عنوان تسویه شده</span>
                        </button>
                      )}
                    </div>
                    {inv.paymentMethod === 'cheque' && (inv.chequeNumber || inv.chequeDueDate) && (
                      <div className="text-[10px] text-sky-700 bg-sky-50 px-2 py-1 rounded border border-sky-100">
                        {inv.chequeNumber && <span>شماره چک: {toPersianDigits(inv.chequeNumber)} </span>}
                        {inv.chequeDueDate && <span>(سررسید: {toPersianDigits(inv.chequeDueDate)}) </span>}
                        {inv.chequeName && <span>- {inv.chequeName}</span>}
                      </div>
                    )}
                    {inv.paymentMethod === 'transfer' && inv.transferDescription && (
                      <div className="text-[10px] text-indigo-700 bg-indigo-50 px-2 py-1 rounded border border-indigo-100 truncate max-w-full">
                        واریز: {inv.transferDescription}
                      </div>
                    )}
                  </div>

                  {/* Action Buttons for Mobile */}
                  <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => onViewInvoice(inv)}
                      className="flex-1 py-2 px-3 bg-emerald-600 active:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>مشاهده و چاپ</span>
                    </button>

                    {canDelete && (
                      <>
                        <button
                          type="button"
                          id={`mobile-return-invoice-btn-${inv.id}`}
                          onClick={() => setInvoiceToReturn(inv)}
                          title="مرجوعی به انبار"
                          className="p-2 text-amber-700 bg-amber-50 active:bg-amber-100 rounded-xl border border-amber-200 cursor-pointer"
                        >
                          <RotateCcw className="w-4 h-4" />
                        </button>

                        <button
                          type="button"
                          id={`mobile-delete-invoice-btn-${inv.id}`}
                          onClick={() => setInvoiceToDelete(inv)}
                          title="حذف فاکتور"
                          className="p-2 text-rose-600 bg-rose-50 active:bg-rose-100 rounded-xl border border-rose-200 cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Desktop View: Table (Hidden on Mobile) */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-right border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100/70 text-slate-700 border-b border-slate-200">
                <th className="p-3.5 font-bold">شماره فاکتور</th>
                <th className="p-3.5 font-bold">تاریخ صدور</th>
                <th className="p-3.5 font-bold">نام خریدار</th>
                <th className="p-3.5 font-bold text-center">اقلام</th>
                <th className="p-3.5 font-bold text-left">مبلغ نهایی</th>
                <th className="p-3.5 font-bold text-center">وضعیت تسویه</th>
                <th className="p-3.5 font-bold text-center">روش دریافت</th>
                <th className="p-3.5 font-bold text-center">عملیات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-slate-400">
                    <ReceiptText className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    <span>هیچ فاکتوری با این مشخصات یافت نشد.</span>
                  </td>
                </tr>
              ) : (
                filteredInvoices.map((inv) => {
                  const itemCount = inv.items.reduce((s, i) => s + i.quantity, 0);

                  return (
                    <tr key={inv.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="p-3.5">
                        <div className="font-bold text-slate-900 font-mono">
                          {toPersianDigits(inv.invoiceNumber)}
                        </div>
                        <span className="text-[10px] text-slate-400">
                          {inv.type === 'official' ? 'فاکتور رسمی' : inv.type === 'thermal' ? 'رسید حرارتی' : 'فروشگاهی'}
                        </span>
                      </td>

                      <td className="p-3.5 text-slate-600 font-mono">
                        {inv.date}
                      </td>

                      <td className="p-3.5">
                        <div className="font-bold text-slate-900">{inv.customerName}</div>
                        {inv.customerPhone && (
                          <div className="text-[11px] text-slate-500 font-mono">
                            {toPersianDigits(inv.customerPhone)}
                          </div>
                        )}
                      </td>

                      <td className="p-3.5 text-center">
                        <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md font-semibold">
                          {toPersianDigits(itemCount)} قلم
                        </span>
                      </td>

                      <td className="p-3.5 text-left font-black text-slate-900 text-sm">
                        {formatPrice(inv.finalTotal, settings.currency)}
                      </td>

                      {/* Payment Status */}
                      <td className="p-3.5 text-center">
                        <div className="inline-flex flex-col items-center">
                          <span
                            className={`px-2.5 py-1 rounded-full font-bold text-[11px] flex items-center gap-1 ${
                              inv.paymentStatus === 'paid'
                                ? 'bg-emerald-100 text-emerald-800'
                                : inv.paymentStatus === 'partial'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {inv.paymentStatus === 'paid' && <CheckCircle className="w-3 h-3" />}
                            {inv.paymentStatus === 'partial' && <Clock className="w-3 h-3" />}
                            {inv.paymentStatus === 'unpaid' && <AlertCircle className="w-3 h-3" />}
                            <span>
                              {inv.paymentStatus === 'paid'
                                ? 'تسویه کامل'
                                : inv.paymentStatus === 'partial'
                                ? 'بیعانه'
                                : 'نسیه'}
                            </span>
                          </span>

                          {inv.paymentStatus !== 'paid' && (
                            <button
                              id={`mark-paid-btn-${inv.id}`}
                              onClick={() => onUpdatePaymentStatus(inv.id, 'paid')}
                              className="text-[10px] text-emerald-700 hover:underline mt-1 cursor-pointer font-medium"
                            >
                              تسویه شد؟
                            </button>
                          )}
                        </div>
                      </td>

                      <td className="p-3.5 text-center text-slate-600 text-xs">
                        <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold ${
                          inv.paymentMethod === 'cheque'
                            ? 'bg-sky-100 text-sky-800'
                            : inv.paymentMethod === 'cash'
                            ? 'bg-emerald-100 text-emerald-800'
                            : inv.paymentMethod === 'transfer'
                            ? 'bg-indigo-100 text-indigo-800'
                            : inv.paymentMethod === 'pos'
                            ? 'bg-teal-100 text-teal-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}>
                          {inv.paymentMethod === 'cheque'
                            ? 'چک'
                            : inv.paymentMethod === 'cash'
                            ? 'نقدی'
                            : inv.paymentMethod === 'transfer'
                            ? 'واریز به حساب'
                            : inv.paymentMethod === 'pos'
                            ? 'کارتخوان'
                            : 'دفتری'}
                        </span>
                        {inv.paymentMethod === 'cheque' && (inv.chequeNumber || inv.chequeDueDate) && (
                          <div className="text-[10px] text-sky-700 mt-0.5 font-medium">
                            {inv.chequeNumber && <div>چک: {toPersianDigits(inv.chequeNumber)}</div>}
                            {inv.chequeDueDate && <div>سررسید: {toPersianDigits(inv.chequeDueDate)}</div>}
                          </div>
                        )}
                        {inv.paymentMethod === 'transfer' && inv.transferDescription && (
                          <div className="text-[10px] text-indigo-700 mt-0.5 max-w-[140px] truncate mx-auto" title={inv.transferDescription}>
                            {inv.transferDescription}
                          </div>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="p-3.5 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* Print / View */}
                          <button
                            id={`view-invoice-btn-${inv.id}`}
                            onClick={() => onViewInvoice(inv)}
                            title="مشاهده و چاپ فاکتور"
                            className="p-1.5 text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                          >
                            <Printer className="w-4 h-4" />
                          </button>

                          {/* Return products to stock and cancel invoice */}
                          {canDelete && (
                            <>
                              <button
                                id={`return-invoice-btn-${inv.id}`}
                                type="button"
                                onClick={() => setInvoiceToReturn(inv)}
                                title="مرجوعی کالاها به انبار و لغو فاکتور"
                                className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"
                              >
                                <RotateCcw className="w-4 h-4" />
                              </button>

                              {/* Delete without returning */}
                              <button
                                id={`delete-invoice-btn-${inv.id}`}
                                type="button"
                                onClick={() => setInvoiceToDelete(inv)}
                                title="حذف رکورد فاکتور"
                                className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delete Invoice Confirmation Modal */}
      {invoiceToDelete && (
        <div 
          id="delete-invoice-confirm-modal"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 text-right">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mb-4 mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900 text-center mb-2">
              حذف فاکتور
            </h3>
            <p className="text-sm text-slate-600 text-center mb-6 leading-relaxed">
              آیا از حذف فاکتور شماره <span className="font-bold text-slate-800 font-mono">«{invoiceToDelete.invoiceNumber}»</span> (مشتری: {invoiceToDelete.customerName}) اطمینان دارید؟
            </p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                id="cancel-delete-invoice-btn"
                onClick={() => setInvoiceToDelete(null)}
                className="flex-1 py-2.5 px-4 rounded-xl text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
              >
                انصراف
              </button>
              <button
                type="button"
                id="confirm-delete-invoice-btn"
                onClick={() => {
                  onDeleteInvoice(invoiceToDelete.id);
                  setInvoiceToDelete(null);
                }}
                className="flex-1 py-2.5 px-4 rounded-xl text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 shadow-sm shadow-rose-200 transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" />
                <span>بله، حذف شود</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Return Invoice to Stock Confirmation Modal */}
      {invoiceToReturn && (
        <div 
          id="return-invoice-confirm-modal"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 text-right">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mb-4 mx-auto">
              <RotateCcw className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900 text-center mb-2">
              مرجوعی فاکتور و بازگشت اقلام به انبار
            </h3>
            <p className="text-sm text-slate-600 text-center mb-6 leading-relaxed">
              آیا از مرجوع کردن فاکتور شماره <span className="font-bold text-slate-800 font-mono">«{invoiceToReturn.invoiceNumber}»</span> و بازگرداندن کلیه اقلام آن به موجودی انبار اطمینان دارید؟
            </p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                id="cancel-return-invoice-btn"
                onClick={() => setInvoiceToReturn(null)}
                className="flex-1 py-2.5 px-4 rounded-xl text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
              >
                انصراف
              </button>
              <button
                type="button"
                id="confirm-return-invoice-btn"
                onClick={() => {
                  onReturnInvoiceToStock(invoiceToReturn);
                  setInvoiceToReturn(null);
                }}
                className="flex-1 py-2.5 px-4 rounded-xl text-sm font-semibold text-white bg-amber-600 hover:bg-amber-700 shadow-sm shadow-amber-200 transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                <RotateCcw className="w-4 h-4" />
                <span>تایید مرجوعی</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
