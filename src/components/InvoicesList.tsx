import React, { useState } from 'react';
import { Invoice, StoreSettings, AppUser, Product } from '../types';
import { formatPrice, toPersianDigits } from '../utils/jalali';
import { exportInvoicesToCsv } from '../utils/csvExport';
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
  Plus,
  Download,
  FileSpreadsheet,
  ArrowRightLeft,
  FileClock,
  CheckCircle2,
  X,
  PackageCheck,
  Pencil,
  Calendar,
  User
} from 'lucide-react';

interface InvoicesListProps {
  invoices: Invoice[];
  products?: Product[];
  settings: StoreSettings;
  currentUser?: AppUser;
  onViewInvoice: (invoice: Invoice) => void;
  onEditInvoice?: (invoice: Invoice) => void;
  onDeleteInvoice: (invoiceId: string) => void;
  onReturnInvoiceToStock: (invoice: Invoice) => void;
  onUpdatePaymentStatus: (invoiceId: string, status: 'paid' | 'unpaid' | 'partial', paidAmount?: number) => void;
  onNewInvoice: () => void;
  onNewProforma?: () => void;
  onConvertProforma?: (invoice: Invoice, newInvoiceNumber?: string) => boolean | void;
}

export const InvoicesList: React.FC<InvoicesListProps> = ({
  invoices,
  products = [],
  settings,
  currentUser,
  onViewInvoice,
  onEditInvoice,
  onDeleteInvoice,
  onReturnInvoiceToStock,
  onUpdatePaymentStatus,
  onNewInvoice,
  onNewProforma,
  onConvertProforma,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'paid' | 'partial' | 'unpaid'>('all');
  const [docTypeFilter, setDocTypeFilter] = useState<'all' | 'regular' | 'proforma'>('all');
  const [invoiceToDelete, setInvoiceToDelete] = useState<Invoice | null>(null);
  const [invoiceToReturn, setInvoiceToReturn] = useState<Invoice | null>(null);
  const [proformaToConvert, setProformaToConvert] = useState<Invoice | null>(null);
  const [conversionNewNumber, setConversionNewNumber] = useState<string>('');

  const regularInvoicesCount = invoices.filter((i) => !i.isProforma).length;
  const proformaInvoicesCount = invoices.filter((i) => i.isProforma).length;

  const filteredInvoices = invoices.filter((inv) => {
    const matchesSearch =
      inv.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inv.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (inv.customerPhone && inv.customerPhone.includes(searchQuery));

    const matchesDocType =
      docTypeFilter === 'all'
        ? true
        : docTypeFilter === 'proforma'
        ? !!inv.isProforma
        : !inv.isProforma;

    const matchesStatus = statusFilter === 'all' || inv.paymentStatus === statusFilter;

    return matchesSearch && matchesDocType && matchesStatus;
  });

  const handleOpenConvertModal = (inv: Invoice) => {
    setProformaToConvert(inv);
    let defaultNum = '';
    if (inv.invoiceNumber.startsWith('PF-')) {
      defaultNum = inv.invoiceNumber.replace('PF-', 'INV-');
    } else {
      defaultNum = `INV-${Math.floor(1000 + Math.random() * 9000)}`;
    }
    setConversionNewNumber(defaultNum);
  };

  const handleConfirmConvert = () => {
    if (!proformaToConvert || !onConvertProforma) return;
    const success = onConvertProforma(proformaToConvert, conversionNewNumber.trim());
    if (success !== false) {
      setProformaToConvert(null);
    }
  };

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
  const canAccessAdmin = !currentUser || currentUser.role === 'admin' || currentUser.permissions.canAccessAdmin;

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
          <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
            <button
              id="invoices-list-new-btn"
              onClick={onNewInvoice}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm shadow-emerald-200 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>صدور فاکتور جدید</span>
            </button>
            {onNewProforma && (
              <button
                id="invoices-list-new-proforma-btn"
                onClick={onNewProforma}
                className="flex items-center gap-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 active:scale-98 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-2xs"
              >
                <FileClock className="w-4 h-4 text-indigo-600" />
                <span>صدور پیش‌فاکتور جدید</span>
              </button>
            )}
          </div>
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
            تعداد: {toPersianDigits(regularInvoicesCount)} فاکتور قطعی | {toPersianDigits(proformaInvoicesCount)} پیش‌فاکتور
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
        {/* Document Type Selector Tabs */}
        <div className="bg-slate-100/80 p-2.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
          <div className="flex bg-white/90 p-1 rounded-xl border border-slate-200 text-xs shadow-2xs">
            <button
              id="doc-filter-all"
              onClick={() => setDocTypeFilter('all')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer font-bold ${
                docTypeFilter === 'all'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              همه اسناد ({toPersianDigits(invoices.length)})
            </button>
            <button
              id="doc-filter-regular"
              onClick={() => setDocTypeFilter('regular')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer font-bold ${
                docTypeFilter === 'regular'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              فاکتورهای فروش ({toPersianDigits(regularInvoicesCount)})
            </button>
            <button
              id="doc-filter-proforma"
              onClick={() => setDocTypeFilter('proforma')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer font-bold flex items-center gap-1.5 ${
                docTypeFilter === 'proforma'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-indigo-700 hover:text-indigo-900'
              }`}
            >
              <FileClock className="w-3.5 h-3.5" />
              <span>پیش‌فاکتورها ({toPersianDigits(proformaInvoicesCount)})</span>
            </button>
          </div>

          <div className="text-[11px] text-slate-500 font-medium hidden sm:block">
            {docTypeFilter === 'proforma'
              ? 'پیش‌فاکتورها پیش از تبدیل نهایی، از موجودی انبار کسر نمی‌گردند.'
              : 'فیلتر بر اساس نوع سند فروش'}
          </div>
        </div>

        {/* Proforma info banner when filtered */}
        {docTypeFilter === 'proforma' && (
          <div className="bg-indigo-50/90 border-b border-indigo-100 px-4 py-2.5 text-xs text-indigo-900 flex items-center gap-2">
            <FileClock className="w-4 h-4 text-indigo-600 shrink-0" />
            <span>
              <strong>راهنما:</strong> پیش‌فاکتورها اسناد غیرقطعی هستند و تا زمان نهایی شدن، موجودی انبار را کسر نمی‌کنند. با کلیک بر روی دکمه «تبدیل به فاکتور اصلی» می‌توانید پیش‌فاکتور را به فاکتور قطعی تبدیل کرده و اقلام آن را از موجودی انبار کسر نمایید.
            </span>
          </div>
        )}

        {/* Filter bar */}
        <div className="p-4 border-b border-slate-200/80 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between bg-slate-50/70">
          <div className="relative flex-1 max-w-md group">
            <Search className="w-4 h-4 text-slate-400 group-focus-within:text-emerald-600 absolute right-3.5 top-1/2 -translate-y-1/2 transition-colors pointer-events-none" />
            <input
              type="text"
              id="invoices-search-input"
              placeholder="جستجو بر اساس شماره فاکتور، نام مشتری یا تلفن..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-xl pr-10 pl-9 py-2.5 text-xs sm:text-sm text-slate-800 placeholder:text-slate-400 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all shadow-2xs"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-full hover:bg-slate-100 transition-colors cursor-pointer"
                title="پاک کردن جستجو"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
            <div className="flex bg-white border border-slate-200 rounded-xl p-1 text-xs">
              <button
                id="filter-inv-all"
                onClick={() => setStatusFilter('all')}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                  statusFilter === 'all' ? 'bg-slate-900 text-white font-medium' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                همه ({toPersianDigits(invoices.length)})
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

            {/* Admin-only CSV Export button for accounting software */}
            {canAccessAdmin && (
              <button
                type="button"
                id="export-filtered-invoices-csv-btn"
                onClick={() => {
                  const filterLabel = statusFilter === 'all' ? 'همه' : statusFilter === 'paid' ? 'تسویه_شده' : statusFilter === 'partial' ? 'اقساطی' : 'نسیه';
                  exportInvoicesToCsv(filteredInvoices, settings, `گزارش_فاکتورها_${filterLabel}_${filteredInvoices.length}_فقره`);
                }}
                disabled={filteredInvoices.length === 0}
                className="flex items-center gap-1.5 bg-emerald-700 hover:bg-emerald-800 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed text-white px-3 py-2 rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer"
                title="دانلود فایل اکسل / CSV فاکتورهای فیلترشده جهت ورود به نرم‌افزارهای حسابداری (هلو، سپیدار، راه‌کاران، پارسیان)"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-200" />
                <span>خروجی CSV حسابداری ({toPersianDigits(filteredInvoices.length)})</span>
              </button>
            )}
          </div>
        </div>

        {/* Mobile View: Cards (Hidden on Desktop) */}
        <div className="block sm:hidden p-3 space-y-3.5 bg-slate-100/40">
          {filteredInvoices.length === 0 ? (
            <div className="text-center py-12 text-slate-400 bg-white rounded-2xl border border-slate-200 p-6">
              <ReceiptText className="w-8 h-8 mx-auto mb-2 text-slate-300" />
              <span>هیچ فاکتوری با این مشخصات یافت نشد.</span>
            </div>
          ) : (
            filteredInvoices.map((inv, index) => {
              const itemCount = inv.items.reduce((s, i) => s + i.quantity, 0);
              const cardBg = index % 2 === 1 ? 'bg-slate-100/90' : 'bg-white';

              return (
                <div
                  key={inv.id}
                  id={`mobile-invoice-card-${inv.id}`}
                  className={`rounded-2xl border-2 shadow-xs transition-all overflow-hidden relative ${cardBg} ${
                    inv.isProforma
                      ? 'border-indigo-200 border-r-6 border-r-indigo-600'
                      : inv.paymentStatus === 'paid'
                      ? 'border-slate-200/90 border-r-6 border-r-emerald-500'
                      : inv.paymentStatus === 'partial'
                      ? 'border-slate-200/90 border-r-6 border-r-amber-500'
                      : 'border-slate-200/90 border-r-6 border-r-rose-500'
                  }`}
                >
                  {/* Card Top Strip: Row Number + Type + Status */}
                  <div className={`p-3.5 pb-2.5 border-b border-slate-200/60 flex items-start justify-between gap-2 ${index % 2 === 1 ? 'bg-slate-200/40' : 'bg-slate-50/60'}`}>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {/* Row Counter Badge */}
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-slate-200/80 text-slate-700 border border-slate-300/70 shrink-0">
                        ردیف {toPersianDigits(index + 1)}
                      </span>

                      {/* Invoice Number */}
                      <span className="font-mono font-black text-slate-900 text-sm">
                        #{toPersianDigits(inv.invoiceNumber)}
                      </span>

                      {/* Type Badge */}
                      {inv.isProforma ? (
                        <span className="text-[10px] bg-indigo-100 text-indigo-800 border border-indigo-200 px-2 py-0.5 rounded-md font-bold flex items-center gap-1">
                          <FileClock className="w-3 h-3 text-indigo-600" />
                          پیش‌فاکتور
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-600 bg-white border border-slate-200 px-2 py-0.5 rounded-md font-medium">
                          {inv.type === 'official' ? 'فاکتور رسمی' : inv.type === 'thermal' ? 'فاکتور حرارتی' : 'فاکتور فروش'}
                        </span>
                      )}

                      {inv.convertedFromProforma && (
                        <span className="text-[10px] bg-emerald-100 text-emerald-800 border border-emerald-200 px-1.5 py-0.5 rounded-md font-semibold">
                          تبدیل از {inv.convertedFromProforma}
                        </span>
                      )}
                    </div>

                    {/* Status Badge */}
                    <span
                      className={`px-2.5 py-0.5 rounded-full font-bold text-[11px] flex items-center gap-1 shrink-0 ${
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

                  <div className="p-3.5 pt-3 space-y-3">
                    {/* Customer Info & Date */}
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-1.5 truncate">
                        <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="text-slate-500 text-[11px]">مشتری:</span>
                        <span className="font-bold text-slate-800 truncate">{inv.customerName}</span>
                        {inv.customerPhone && (
                          <a
                            href={`tel:${inv.customerPhone}`}
                            className="text-[11px] text-emerald-700 font-mono inline-block hover:underline shrink-0 mr-1"
                          >
                            ({toPersianDigits(inv.customerPhone)})
                          </a>
                        )}
                      </div>

                      <div className="flex items-center gap-1 text-[11px] text-slate-500 font-mono shrink-0">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <span>{inv.date}</span>
                      </div>
                    </div>

                    {/* Customer and Total Inset Box */}
                    <div className="bg-slate-50 rounded-xl p-3 flex items-center justify-between border border-slate-200/80">
                      <div>
                        <span className="text-[10px] text-slate-500 block">تعداد اقلام فاکتور:</span>
                        <span className="text-xs font-bold text-slate-700">
                          {toPersianDigits(itemCount)} ردیف کالا
                        </span>
                      </div>
                      <div className="text-left">
                        <span className="text-[10px] text-slate-500 block">مبلغ کل قابل پرداخت:</span>
                        <span className="text-sm font-black text-slate-900 font-mono">
                          {formatPrice(inv.finalTotal, settings.currency)}
                        </span>
                      </div>
                    </div>

                    {/* Payment method & quick settle */}
                    <div className="flex flex-col gap-1 text-[11px] text-slate-500 pt-0.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span>نحوه پرداخت:</span>
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
                            <span>تسویه فاکتور</span>
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
                    <div className="flex flex-col gap-2 pt-2 border-t border-slate-100">
                      {/* Convert Proforma button if proforma */}
                      {inv.isProforma && onConvertProforma && (
                        <button
                          type="button"
                          id={`mobile-convert-proforma-btn-${inv.id}`}
                          onClick={() => handleOpenConvertModal(inv)}
                          className="w-full py-2.5 px-3 bg-indigo-600 hover:bg-indigo-700 active:scale-98 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs"
                        >
                          <ArrowRightLeft className="w-4 h-4" />
                          <span>تبدیل به فاکتور اصلی (با کسر از انبار)</span>
                        </button>
                      )}

                      <div className="flex items-center gap-2">
                        {/* Edit Button */}
                        {onEditInvoice && (
                          <button
                            type="button"
                            id={`mobile-edit-invoice-btn-${inv.id}`}
                            onClick={() => onEditInvoice(inv)}
                            className="py-2 px-3 bg-blue-50 hover:bg-blue-100 active:bg-blue-200 text-blue-700 border border-blue-200/90 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shrink-0"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                            <span>ویرایش</span>
                          </button>
                        )}

                        {/* View / Print Button */}
                        <button
                          type="button"
                          onClick={() => onViewInvoice(inv)}
                          className="flex-1 py-2 px-3 bg-emerald-600 active:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>{inv.isProforma ? 'مشاهده و چاپ' : 'مشاهده و چاپ'}</span>
                        </button>

                        {canDelete && (
                          <>
                            <button
                              type="button"
                              id={`mobile-return-invoice-btn-${inv.id}`}
                              onClick={() => setInvoiceToReturn(inv)}
                              title={inv.isProforma ? 'لغو و حذف پیش‌فاکتور' : 'مرجوعی به انبار'}
                              className="p-2 text-amber-700 bg-amber-50 active:bg-amber-100 rounded-xl border border-amber-200 cursor-pointer shrink-0"
                            >
                              <RotateCcw className="w-4 h-4" />
                            </button>

                            <button
                              type="button"
                              id={`mobile-delete-invoice-btn-${inv.id}`}
                              onClick={() => setInvoiceToDelete(inv)}
                              title="حذف سند"
                              className="p-2 text-rose-600 bg-rose-50 active:bg-rose-100 rounded-xl border border-rose-200 cursor-pointer shrink-0"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
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
                filteredInvoices.map((inv, index) => {
                  const itemCount = inv.items.reduce((s, i) => s + i.quantity, 0);

                  return (
                    <tr key={inv.id} className={`${index % 2 === 1 ? 'bg-slate-50/80' : 'bg-white'} hover:bg-slate-100/70 transition-colors`}>
                      <td className="p-3.5">
                        <div className="font-bold text-slate-900 font-mono flex items-center gap-1.5">
                          <span>{toPersianDigits(inv.invoiceNumber)}</span>
                          {inv.isProforma && (
                            <span className="text-[10px] bg-indigo-100 text-indigo-800 border border-indigo-200 px-1.5 py-0.5 rounded font-bold">
                              پیش‌فاکتور
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1 mt-0.5">
                          <span className="text-[10px] text-slate-400">
                            {inv.isProforma
                              ? 'غیرقطعی (بدون کسر انبار)'
                              : inv.type === 'official'
                              ? 'فاکتور رسمی'
                              : inv.type === 'thermal'
                              ? 'رسید حرارتی'
                              : 'فروشگاهی'}
                          </span>
                          {inv.convertedFromProforma && (
                            <span className="text-[10px] text-emerald-700 font-medium">
                              (تبدیل از {inv.convertedFromProforma})
                            </span>
                          )}
                        </div>
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
                          {/* Convert Proforma to Official Invoice */}
                          {inv.isProforma && onConvertProforma && (
                            <button
                              id={`convert-proforma-btn-${inv.id}`}
                              type="button"
                              onClick={() => handleOpenConvertModal(inv)}
                              title="تبدیل به فاکتور رسمی فروش و کسر از انبار"
                              className="flex items-center gap-1 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-2xs"
                            >
                              <ArrowRightLeft className="w-3.5 h-3.5" />
                              <span>تبدیل به فاکتور</span>
                            </button>
                          )}

                          {/* Edit Invoice / Proforma */}
                          {onEditInvoice && (
                            <button
                              id={`edit-invoice-btn-${inv.id}`}
                              type="button"
                              onClick={() => onEditInvoice(inv)}
                              title={inv.isProforma ? 'ویرایش پیش‌فاکتور' : 'ویرایش فاکتور فروش'}
                              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                          )}

                          {/* Print / View */}
                          <button
                            id={`view-invoice-btn-${inv.id}`}
                            onClick={() => onViewInvoice(inv)}
                            title={inv.isProforma ? 'مشاهده و چاپ پیش‌فاکتور' : 'مشاهده و چاپ فاکتور'}
                            className="p-1.5 text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                          >
                            <Printer className="w-4 h-4" />
                          </button>

                          {/* Return products to stock or cancel proforma */}
                          {canDelete && (
                            <>
                              <button
                                id={`return-invoice-btn-${inv.id}`}
                                type="button"
                                onClick={() => setInvoiceToReturn(inv)}
                                title={inv.isProforma ? 'لغو و حذف پیش‌فاکتور' : 'مرجوعی کالاها به انبار و لغو فاکتور'}
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

      {/* Convert Proforma to Invoice Modal */}
      {proformaToConvert && (
        <div
          id="convert-proforma-modal"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 text-right overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <div className="flex items-center gap-2 text-indigo-700">
                <div className="p-2 rounded-xl bg-indigo-50">
                  <ArrowRightLeft className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    تبدیل پیش‌فاکتور به فاکتور رسمی فروش
                  </h3>
                  <span className="text-xs text-slate-500">
                    نهایی‌سازی سند و کسر خودکار اقلام از موجودی انبار
                  </span>
                </div>
              </div>
              <button
                type="button"
                id="close-convert-proforma-modal-btn"
                onClick={() => setProformaToConvert(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto space-y-4 pr-1 text-xs">
              {/* Summary card */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div>
                  <span className="text-[11px] text-slate-400 block">شماره پیش‌فاکتور:</span>
                  <strong className="text-slate-800 font-mono">{toPersianDigits(proformaToConvert.invoiceNumber)}</strong>
                </div>
                <div>
                  <span className="text-[11px] text-slate-400 block">خریدار:</span>
                  <strong className="text-slate-800">{proformaToConvert.customerName}</strong>
                </div>
                <div>
                  <span className="text-[11px] text-slate-400 block">تاریخ صدور:</span>
                  <strong className="text-slate-800 font-mono">{proformaToConvert.date}</strong>
                </div>
                <div>
                  <span className="text-[11px] text-slate-400 block">جمع کل مبلغ:</span>
                  <strong className="text-slate-900 font-bold">{formatPrice(proformaToConvert.finalTotal, settings.currency)}</strong>
                </div>
              </div>

              {/* New Invoice Number Input */}
              <div className="space-y-1">
                <label htmlFor="conversion-new-number-input" className="font-bold text-slate-700">
                  شماره فاکتور رسمی جدید:
                </label>
                <input
                  type="text"
                  id="conversion-new-number-input"
                  value={conversionNewNumber}
                  onChange={(e) => setConversionNewNumber(e.target.value)}
                  placeholder="مثال: INV-1001"
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono text-slate-800 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                />
                <span className="text-[10px] text-slate-500 block">
                  پیش‌فرض بر اساس پیشوند فاکتورهای قطعی (INV-) ایجاد شده و قابل ویرایش است.
                </span>
              </div>

              {/* Inventory Stock Verification Check */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800 flex items-center gap-1.5">
                    <PackageCheck className="w-4 h-4 text-slate-600" />
                    <span>بررسی وضعیت موجودی انبار برای اقلام پیش‌فاکتور:</span>
                  </span>
                  <span className="text-[11px] text-slate-500">
                    {toPersianDigits(proformaToConvert.items.length)} ردیف کالا
                  </span>
                </div>

                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-100 text-slate-700 border-b border-slate-200">
                      <tr>
                        <th className="p-2 font-bold">نام کالا</th>
                        <th className="p-2 font-bold text-center">تعداد فاکتور</th>
                        <th className="p-2 font-bold text-center">موجودی فعلی انبار</th>
                        <th className="p-2 font-bold text-center">وضعیت</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {proformaToConvert.items.map((item, idx) => {
                        const prod = products.find((p) => p.id === item.productId);
                        const currentStock = prod ? prod.stock : 0;
                        const isSufficient = currentStock >= item.quantity;
                        const remaining = currentStock - item.quantity;

                        return (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="p-2 font-medium text-slate-800">{item.productName}</td>
                            <td className="p-2 text-center font-bold font-mono">
                              {toPersianDigits(item.quantity)} {item.unit}
                            </td>
                            <td className="p-2 text-center font-mono text-slate-700">
                              {toPersianDigits(currentStock)} {item.unit}
                            </td>
                            <td className="p-2 text-center">
                              {isSufficient ? (
                                <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-bold">
                                  <CheckCircle2 className="w-3 h-3" />
                                  <span>کافی (باقی: {toPersianDigits(remaining)})</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[11px] text-rose-700 bg-rose-50 px-2 py-0.5 rounded font-bold">
                                  <AlertCircle className="w-3 h-3" />
                                  <span>کسری موجودی ({toPersianDigits(Math.abs(remaining))})</span>
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Explanation Note */}
              <div className="bg-indigo-50/70 border border-indigo-100 rounded-xl p-3 text-indigo-900 leading-relaxed">
                <strong>توجه:</strong> با تایید این عملیات، این سند بلافاصله از حالت پیش‌فاکتور خارج شده و با شماره انتخابی به فاکتور قطعی تبدیل می‌گردد؛ همچنین کلیه اقلام فوق از کاردکس و موجودی انبار کسر خواهند شد.
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center gap-3 pt-4 border-t border-slate-100 mt-2">
              <button
                type="button"
                id="cancel-convert-proforma-btn"
                onClick={() => setProformaToConvert(null)}
                className="flex-1 py-2.5 px-4 rounded-xl text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
              >
                انصراف
              </button>
              <button
                type="button"
                id="confirm-convert-proforma-btn"
                onClick={handleConfirmConvert}
                className="flex-1 py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm shadow-indigo-200 transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>تایید تبدیل و کسر از انبار</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
