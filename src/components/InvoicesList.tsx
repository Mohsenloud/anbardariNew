import React, { useState, useMemo } from 'react';
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
  AlertCircle,
  Plus,
  FileSpreadsheet,
  ArrowRightLeft,
  FileClock,
  CheckCircle2,
  X,
  PackageCheck,
  Pencil,
  Calendar,
  User,
  Phone,
  ArrowUpDown,
  CreditCard,
  Banknote,
  Coins,
  ChevronDown,
  Filter,
  Check
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

type SortOption = 'date-desc' | 'date-asc' | 'total-desc' | 'total-asc' | 'debt-desc' | 'customer-asc';

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
  const [sortBy, setSortBy] = useState<SortOption>('date-desc');
  
  // Modals state
  const [invoiceToDelete, setInvoiceToDelete] = useState<Invoice | null>(null);
  const [invoiceToReturn, setInvoiceToReturn] = useState<Invoice | null>(null);
  const [proformaToConvert, setProformaToConvert] = useState<Invoice | null>(null);
  const [conversionNewNumber, setConversionNewNumber] = useState<string>('');
  
  // Quick payment update modal state
  const [paymentModalInvoice, setPaymentModalInvoice] = useState<Invoice | null>(null);
  const [paymentNewStatus, setPaymentNewStatus] = useState<'paid' | 'unpaid' | 'partial'>('paid');
  const [paymentNewAmount, setPaymentNewAmount] = useState<number>(0);

  // Counts for document types
  const regularInvoicesCount = useMemo(() => invoices.filter((i) => !i.isProforma).length, [invoices]);
  const proformaInvoicesCount = useMemo(() => invoices.filter((i) => i.isProforma).length, [invoices]);

  // Counts for payment statuses
  const statusCounts = useMemo(() => {
    let paid = 0;
    let partial = 0;
    let unpaid = 0;
    invoices.forEach((inv) => {
      if (inv.paymentStatus === 'paid') paid++;
      else if (inv.paymentStatus === 'partial') partial++;
      else unpaid++;
    });
    return { all: invoices.length, paid, partial, unpaid };
  }, [invoices]);

  // Filtered and Sorted invoices
  const filteredInvoices = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    const filtered = invoices.filter((inv) => {
      const matchesSearch =
        !q ||
        inv.invoiceNumber.toLowerCase().includes(q) ||
        inv.customerName.toLowerCase().includes(q) ||
        (inv.customerPhone && inv.customerPhone.includes(q)) ||
        (inv.customerNationalId && inv.customerNationalId.includes(q)) ||
        (inv.chequeNumber && inv.chequeNumber.includes(q)) ||
        (inv.notes && inv.notes.toLowerCase().includes(q));

      const matchesDocType =
        docTypeFilter === 'all'
          ? true
          : docTypeFilter === 'proforma'
          ? !!inv.isProforma
          : !inv.isProforma;

      const matchesStatus = statusFilter === 'all' || inv.paymentStatus === statusFilter;

      return matchesSearch && matchesDocType && matchesStatus;
    });

    // Sorting
    return filtered.sort((a, b) => {
      switch (sortBy) {
        case 'date-desc':
          return (b.date || '').localeCompare(a.date || '') || (b.createdAt || '').localeCompare(a.createdAt || '');
        case 'date-asc':
          return (a.date || '').localeCompare(b.date || '') || (a.createdAt || '').localeCompare(b.createdAt || '');
        case 'total-desc':
          return b.finalTotal - a.finalTotal;
        case 'total-asc':
          return a.finalTotal - b.finalTotal;
        case 'debt-desc': {
          const debtA = Math.max(0, a.finalTotal - (a.paymentStatus === 'paid' ? a.finalTotal : (a.paidAmount || 0)));
          const debtB = Math.max(0, b.finalTotal - (b.paymentStatus === 'paid' ? b.finalTotal : (b.paidAmount || 0)));
          return debtB - debtA;
        }
        case 'customer-asc':
          return a.customerName.localeCompare(b.customerName, 'fa');
        default:
          return 0;
      }
    });
  }, [invoices, searchQuery, docTypeFilter, statusFilter, sortBy]);

  // Filtered totals
  const filteredSummary = useMemo(() => {
    const totalAmount = filteredInvoices.reduce((sum, inv) => sum + inv.finalTotal, 0);
    const totalCollected = filteredInvoices.reduce((sum, inv) => {
      if (inv.paymentStatus === 'paid') return sum + inv.finalTotal;
      if (inv.paymentStatus === 'partial') return sum + (inv.paidAmount || 0);
      return sum;
    }, 0);
    const totalDebt = Math.max(0, totalAmount - totalCollected);
    return { totalAmount, totalCollected, totalDebt };
  }, [filteredInvoices]);

  // Overall KPI calculations
  const totalSalesVolume = useMemo(() => invoices.reduce((sum, inv) => sum + inv.finalTotal, 0), [invoices]);
  const totalReceivedCash = useMemo(() => {
    return invoices.reduce((sum, inv) => {
      if (inv.paymentStatus === 'paid') return sum + inv.finalTotal;
      if (inv.paymentStatus === 'partial') return sum + (inv.paidAmount || 0);
      return sum;
    }, 0);
  }, [invoices]);
  const totalPendingDebt = Math.max(0, totalSalesVolume - totalReceivedCash);

  // Permission checks
  const canCreate = !currentUser || currentUser.permissions.canCreateInvoice;
  const canDelete = !currentUser || currentUser.permissions.canDeleteInvoice;
  const canAccessAdmin = !currentUser || currentUser.role === 'admin' || currentUser.permissions.canAccessAdmin;

  // Conversion Handlers
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

  // Payment Status Modal Handlers
  const handleOpenPaymentModal = (inv: Invoice) => {
    setPaymentModalInvoice(inv);
    setPaymentNewStatus(inv.paymentStatus);
    setPaymentNewAmount(inv.paidAmount || 0);
  };

  const handleSavePaymentStatus = () => {
    if (!paymentModalInvoice) return;
    let finalPaid = paymentNewAmount;
    if (paymentNewStatus === 'paid') {
      finalPaid = paymentModalInvoice.finalTotal;
    } else if (paymentNewStatus === 'unpaid') {
      finalPaid = 0;
    } else {
      finalPaid = Math.min(Math.max(0, paymentNewAmount), paymentModalInvoice.finalTotal);
    }

    onUpdatePaymentStatus(paymentModalInvoice.id, paymentNewStatus, finalPaid);
    setPaymentModalInvoice(null);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6 pb-16 px-2 sm:px-4">
      {/* 1. Header Card (Desktop & Mobile Optimized) */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-3">
          <div className="p-2.5 sm:p-3 rounded-2xl bg-emerald-50 text-emerald-700 border border-emerald-100 shrink-0">
            <ReceiptText className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg sm:text-xl font-black text-slate-800">
                لیست و مدیریت فاکتورهای فروش
              </h2>
              <span className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full font-bold">
                {toPersianDigits(invoices.length)} سند ثبت‌شده
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              سوابق صدور، چاپ فاکتور رسمی و حرارتی، مدیریت مطالبات و مرجوعی کالا به انبار
            </p>
          </div>
        </div>

        {/* Top Action Buttons (Mobile: Full width grid, Desktop: Flex row) */}
        <div className="flex items-center gap-2 flex-wrap">
          {canCreate && (
            <>
              <button
                id="invoices-list-new-btn"
                type="button"
                onClick={onNewInvoice}
                className="flex-1 sm:flex-initial min-h-[44px] flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all shadow-sm shadow-emerald-200 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>صدور فاکتور جدید</span>
              </button>

              {onNewProforma && (
                <button
                  id="invoices-list-new-proforma-btn"
                  type="button"
                  onClick={onNewProforma}
                  className="flex-1 sm:flex-initial min-h-[44px] flex items-center justify-center gap-2 bg-indigo-50 hover:bg-indigo-100 active:bg-indigo-200 text-indigo-700 border border-indigo-200 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer shadow-2xs"
                >
                  <FileClock className="w-4 h-4 text-indigo-600" />
                  <span>صدور پیش‌فاکتور</span>
                </button>
              )}
            </>
          )}

          {canAccessAdmin && (
            <button
              type="button"
              id="export-filtered-invoices-csv-btn"
              onClick={() => {
                const filterLabel = statusFilter === 'all' ? 'همه' : statusFilter === 'paid' ? 'تسویه_شده' : statusFilter === 'partial' ? 'اقساطی' : 'نسیه';
                exportInvoicesToCsv(filteredInvoices, settings, `گزارش_فاکتورها_${filterLabel}_${filteredInvoices.length}_فقره`);
              }}
              disabled={filteredInvoices.length === 0}
              className="min-h-[44px] flex items-center justify-center gap-1.5 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 border border-slate-300 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
              title="خروجی فایل اکسل و CSV فاکتورها جهت بارگذاری در نرم‌افزارهای حسابداری"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span className="hidden sm:inline">خروجی اکسل</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Interactive KPI Overview Cards (Clickable Quick Filters) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        {/* Card 1: Total Sales */}
        <div 
          onClick={() => {
            setStatusFilter('all');
            setDocTypeFilter('all');
          }}
          className={`bg-white p-4 rounded-2xl border transition-all cursor-pointer shadow-xs hover:border-slate-300 group ${
            statusFilter === 'all' && docTypeFilter === 'all' ? 'ring-2 ring-slate-900/10 border-slate-400' : 'border-slate-200/90'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">مجموع فروش فاکتورها</span>
            <span className="p-1.5 rounded-xl bg-slate-100 text-slate-700 group-hover:bg-slate-200 transition-colors">
              <Coins className="w-4 h-4" />
            </span>
          </div>
          <div className="text-lg sm:text-xl font-black text-slate-900 mt-2 font-['Vazirmatn'] tracking-tight">
            {formatPrice(totalSalesVolume, settings.currency)}
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-500 mt-2 pt-2 border-t border-slate-100">
            <span>{toPersianDigits(regularInvoicesCount)} فاکتور قطعی</span>
            <span className="text-indigo-600 font-medium">{toPersianDigits(proformaInvoicesCount)} پیش‌فاکتور</span>
          </div>
        </div>

        {/* Card 2: Received Cash / POS */}
        <div 
          onClick={() => setStatusFilter('paid')}
          className={`bg-white p-4 rounded-2xl border transition-all cursor-pointer shadow-xs hover:border-emerald-300 group ${
            statusFilter === 'paid' ? 'ring-2 ring-emerald-500/20 border-emerald-500 bg-emerald-50/20' : 'border-slate-200/90'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-800">مبلغ وصول شده (نقدی / پوز)</span>
            <span className="p-1.5 rounded-xl bg-emerald-100 text-emerald-700 group-hover:bg-emerald-200 transition-colors">
              <CheckCircle2 className="w-4 h-4" />
            </span>
          </div>
          <div className="text-lg sm:text-xl font-black text-emerald-700 mt-2 font-['Vazirmatn'] tracking-tight">
            {formatPrice(totalReceivedCash, settings.currency)}
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-500 mt-2 pt-2 border-t border-slate-100">
            <span>دریافتی‌های تسویه‌شده</span>
            <span className="text-emerald-700 font-bold">{toPersianDigits(statusCounts.paid)} فقره</span>
          </div>
        </div>

        {/* Card 3: Outstanding Debts */}
        <div 
          onClick={() => setStatusFilter(statusFilter === 'unpaid' ? 'partial' : 'unpaid')}
          className={`bg-white p-4 rounded-2xl border transition-all cursor-pointer shadow-xs hover:border-amber-300 group ${
            statusFilter === 'unpaid' || statusFilter === 'partial' ? 'ring-2 ring-amber-500/20 border-amber-500 bg-amber-50/20' : 'border-slate-200/90'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-800">مانده طلب و نسیه (وصول نشده)</span>
            <span className="p-1.5 rounded-xl bg-amber-100 text-amber-700 group-hover:bg-amber-200 transition-colors">
              <Clock className="w-4 h-4" />
            </span>
          </div>
          <div className="text-lg sm:text-xl font-black text-amber-700 mt-2 font-['Vazirmatn'] tracking-tight">
            {formatPrice(totalPendingDebt, settings.currency)}
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-500 mt-2 pt-2 border-t border-slate-100">
            <span>مطالبات باز مشتریان</span>
            <span className="text-amber-800 font-bold">
              {toPersianDigits(statusCounts.unpaid + statusCounts.partial)} فاکتور
            </span>
          </div>
        </div>
      </div>

      {/* 3. Main Data Container */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
        {/* Document Type Selector Segmented Tabs */}
        <div className="bg-slate-50/90 p-2 sm:p-3 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex bg-slate-200/70 p-1 rounded-xl text-xs font-bold shadow-inner max-w-full overflow-x-auto">
            <button
              id="doc-filter-all"
              type="button"
              onClick={() => setDocTypeFilter('all')}
              className={`min-h-[38px] px-3.5 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                docTypeFilter === 'all'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>همه اسناد</span>
              <span className="text-[10px] px-1.5 py-0.2 bg-slate-100 text-slate-700 rounded-full font-mono">
                {toPersianDigits(invoices.length)}
              </span>
            </button>
            <button
              id="doc-filter-regular"
              type="button"
              onClick={() => setDocTypeFilter('regular')}
              className={`min-h-[38px] px-3.5 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                docTypeFilter === 'regular'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>فاکتورهای فروش</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                docTypeFilter === 'regular' ? 'bg-emerald-700 text-white' : 'bg-slate-200 text-slate-700'
              }`}>
                {toPersianDigits(regularInvoicesCount)}
              </span>
            </button>
            <button
              id="doc-filter-proforma"
              type="button"
              onClick={() => setDocTypeFilter('proforma')}
              className={`min-h-[38px] px-3.5 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                docTypeFilter === 'proforma'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-indigo-700 hover:text-indigo-900'
              }`}
            >
              <FileClock className="w-3.5 h-3.5" />
              <span>پیش‌فاکتورها</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                docTypeFilter === 'proforma' ? 'bg-indigo-700 text-white' : 'bg-indigo-100 text-indigo-800'
              }`}>
                {toPersianDigits(proformaInvoicesCount)}
              </span>
            </button>
          </div>

          <div className="text-[11px] text-slate-500 font-medium hidden md:block">
            {docTypeFilter === 'proforma'
              ? 'پیش‌فاکتورها اسناد اولیه هستند و تا زمان تبدیل، موجودی انبار را کسر نمی‌کنند.'
              : 'فیلتر سریع بر اساس نوع سند فروش'}
          </div>
        </div>

        {/* Proforma Educational Banner */}
        {docTypeFilter === 'proforma' && (
          <div className="bg-indigo-50 border-b border-indigo-100 px-4 py-2.5 text-xs text-indigo-900 flex items-center gap-2">
            <FileClock className="w-4 h-4 text-indigo-600 shrink-0" />
            <span className="leading-relaxed">
              <strong>راهنما:</strong> پیش‌فاکتورها هنوز از انبار خارج نشده‌اند. با کلیک بر روی دکمه «تبدیل به فاکتور»، اقلام به صورت خودکار از موجودی انبار کسر و سند قطعی صادر می‌شود.
            </span>
          </div>
        )}

        {/* Search & Filter & Sorting Toolbar */}
        <div className="p-3 sm:p-4 border-b border-slate-200/80 bg-white space-y-3">
          <div className="flex flex-col md:flex-row gap-2.5 items-stretch md:items-center justify-between">
            {/* Search Input */}
            <div className="relative flex-1 group">
              <Search className="w-4 h-4 text-slate-400 group-focus-within:text-emerald-600 absolute right-3.5 top-1/2 -translate-y-1/2 transition-colors pointer-events-none" />
              <input
                type="text"
                id="invoices-search-input"
                placeholder="جستجو بر اساس شماره فاکتور، نام خریدار، تلفن، چک..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full min-h-[44px] bg-slate-50 border border-slate-200 rounded-xl pr-10 pl-9 py-2 text-xs sm:text-sm text-slate-800 placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-200 transition-colors cursor-pointer"
                  title="پاک کردن جستجو"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Sorting Dropdown */}
            <div className="flex items-center gap-2 shrink-0">
              <div className="relative flex-1 sm:flex-initial">
                <select
                  id="invoices-sort-select"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortOption)}
                  className="w-full min-h-[44px] appearance-none bg-slate-50 border border-slate-200 rounded-xl pr-8 pl-8 py-2 text-xs font-bold text-slate-700 focus:bg-white focus:ring-2 focus:ring-slate-500/20 focus:border-slate-400 outline-none cursor-pointer"
                >
                  <option value="date-desc">جدیدترین تاریخ صدور</option>
                  <option value="date-asc">قدیمی‌ترین تاریخ صدور</option>
                  <option value="total-desc">بیشترین مبلغ فاکتور</option>
                  <option value="total-asc">کمترین مبلغ فاکتور</option>
                  <option value="debt-desc">بیشترین مانده طلب (نسیه)</option>
                  <option value="customer-asc">نام خریدار (الفبا)</option>
                </select>
                <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Status Filter Pills Row */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <button
                id="filter-inv-all"
                type="button"
                onClick={() => setStatusFilter('all')}
                className={`min-h-[36px] px-3 py-1.5 rounded-xl transition-all cursor-pointer font-bold flex items-center gap-1.5 ${
                  statusFilter === 'all'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <span>همه</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full font-mono bg-white/20">
                  {toPersianDigits(statusCounts.all)}
                </span>
              </button>

              <button
                id="filter-inv-paid"
                type="button"
                onClick={() => setStatusFilter('paid')}
                className={`min-h-[36px] px-3 py-1.5 rounded-xl transition-all cursor-pointer font-bold flex items-center gap-1.5 ${
                  statusFilter === 'paid'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200/60'
                }`}
              >
                <CheckCircle className="w-3.5 h-3.5" />
                <span>تسویه شده</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full font-mono bg-white/20">
                  {toPersianDigits(statusCounts.paid)}
                </span>
              </button>

              <button
                id="filter-inv-partial"
                type="button"
                onClick={() => setStatusFilter('partial')}
                className={`min-h-[36px] px-3 py-1.5 rounded-xl transition-all cursor-pointer font-bold flex items-center gap-1.5 ${
                  statusFilter === 'partial'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200/60'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>بیعانه / اقساط</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full font-mono bg-white/20">
                  {toPersianDigits(statusCounts.partial)}
                </span>
              </button>

              <button
                id="filter-inv-unpaid"
                type="button"
                onClick={() => setStatusFilter('unpaid')}
                className={`min-h-[36px] px-3 py-1.5 rounded-xl transition-all cursor-pointer font-bold flex items-center gap-1.5 ${
                  statusFilter === 'unpaid'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'bg-rose-50 text-rose-800 hover:bg-rose-100 border border-rose-200/60'
                }`}
              >
                <AlertCircle className="w-3.5 h-3.5" />
                <span>نسیه / پرداخت‌نشده</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full font-mono bg-white/20">
                  {toPersianDigits(statusCounts.unpaid)}
                </span>
              </button>
            </div>

            {/* Filtered records counter */}
            <div className="text-[11px] text-slate-500 font-medium">
              نمایش <strong className="text-slate-800 font-mono">{toPersianDigits(filteredInvoices.length)}</strong> از <strong className="text-slate-800 font-mono">{toPersianDigits(invoices.length)}</strong> سند
            </div>
          </div>
        </div>

        {/* 4. Mobile View: Responsive Card Deck (Hidden on Desktop) */}
        <div className="block sm:hidden p-3 space-y-3 bg-slate-100/50">
          {filteredInvoices.length === 0 ? (
            <div className="text-center py-12 text-slate-400 bg-white rounded-2xl border border-slate-200 p-6 space-y-3">
              <ReceiptText className="w-10 h-10 mx-auto text-slate-300" />
              <div className="text-sm font-bold text-slate-600">هیچ فاکتوری با این مشخصات یافت نشد</div>
              <p className="text-xs text-slate-400">
                می‌توانید فیلترهای بالا را تغییر دهید یا فاکتور جدید ثبت نمایید.
              </p>
              {(searchQuery || statusFilter !== 'all' || docTypeFilter !== 'all') && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setStatusFilter('all');
                    setDocTypeFilter('all');
                  }}
                  className="min-h-[44px] px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold cursor-pointer"
                >
                  پاک کردن همه فیلترها
                </button>
              )}
            </div>
          ) : (
            filteredInvoices.map((inv, index) => {
              const itemCount = inv.items.reduce((s, i) => s + i.quantity, 0);
              const remainingDebt = Math.max(0, inv.finalTotal - (inv.paymentStatus === 'paid' ? inv.finalTotal : (inv.paidAmount || 0)));

              return (
                <div
                  key={inv.id}
                  id={`mobile-invoice-card-${inv.id}`}
                  className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden transition-all"
                >
                  {/* Card Header Strip */}
                  <div className="p-3.5 pb-2.5 bg-slate-50/80 border-b border-slate-200/80 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-slate-200 text-slate-700 font-mono shrink-0">
                        #{toPersianDigits(index + 1)}
                      </span>
                      <span className="font-mono font-black text-slate-900 text-sm">
                        {toPersianDigits(inv.invoiceNumber)}
                      </span>
                      {inv.isProforma ? (
                        <span className="text-[10px] bg-indigo-100 text-indigo-800 border border-indigo-200 px-2 py-0.5 rounded-md font-bold flex items-center gap-1">
                          <FileClock className="w-3 h-3 text-indigo-600" />
                          پیش‌فاکتور
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-600 bg-white border border-slate-200 px-1.5 py-0.5 rounded-md font-medium">
                          {inv.type === 'official' ? 'فاکتور رسمی' : inv.type === 'thermal' ? 'رسید حرارتی' : 'فروشگاهی'}
                        </span>
                      )}
                      {inv.convertedFromProforma && (
                        <span className="text-[9.5px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-semibold">
                          تبدیل از {inv.convertedFromProforma}
                        </span>
                      )}
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

                  {/* Card Body */}
                  <div className="p-3.5 space-y-3">
                    {/* Customer & Date Info */}
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-1.5 truncate">
                        <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="font-bold text-slate-900 truncate">{inv.customerName}</span>
                        {inv.customerPhone && (
                          <a
                            href={`tel:${inv.customerPhone}`}
                            className="text-emerald-700 font-mono text-[11px] hover:underline shrink-0 mr-1 flex items-center gap-0.5 bg-emerald-50 px-1.5 py-0.5 rounded"
                          >
                            <Phone className="w-3 h-3" />
                            <span>{toPersianDigits(inv.customerPhone)}</span>
                          </a>
                        )}
                      </div>

                      <div className="flex items-center gap-1 text-[11px] text-slate-500 font-mono shrink-0">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <span>{inv.date}</span>
                      </div>
                    </div>

                    {/* Financial Inset Box */}
                    <div className="bg-slate-50/90 rounded-xl p-3 border border-slate-200/80 space-y-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-[10.5px] text-slate-500 block">اقلام فاکتور:</span>
                          <span className="text-xs font-bold text-slate-700">
                            {toPersianDigits(itemCount)} قلم ({toPersianDigits(inv.items.length)} ردیف)
                          </span>
                        </div>
                        <div className="text-left">
                          <span className="text-[10.5px] text-slate-500 block">مبلغ کل قابل پرداخت:</span>
                          <span className="text-sm font-black text-slate-900 font-mono font-['Vazirmatn']">
                            {formatPrice(inv.finalTotal, settings.currency)}
                          </span>
                        </div>
                      </div>

                      {/* Remaining Debt notice if not fully paid */}
                      {inv.paymentStatus !== 'paid' && (
                        <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-[11px]">
                          <span className="text-slate-500">
                            پرداخت شده: <strong className="text-emerald-700 font-mono">{formatPrice(inv.paidAmount || 0, settings.currency)}</strong>
                          </span>
                          <span className="text-rose-700 font-bold">
                            مانده طلب: <strong className="font-mono">{formatPrice(remainingDebt, settings.currency)}</strong>
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Payment Method & Cheque/Transfer details */}
                    <div className="flex items-center justify-between text-[11px] text-slate-600 pt-0.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-slate-400">روش پرداخت:</span>
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
                            ? 'چک بانکی'
                            : inv.paymentMethod === 'cash'
                            ? 'وجه نقد'
                            : inv.paymentMethod === 'transfer'
                            ? 'واریز به حساب'
                            : inv.paymentMethod === 'pos'
                            ? 'دستگاه پوز'
                            : 'دفتری'}
                        </span>
                      </div>

                      {/* Quick settle button */}
                      {inv.paymentStatus !== 'paid' && (
                        <button
                          type="button"
                          onClick={() => handleOpenPaymentModal(inv)}
                          className="min-h-[32px] px-2 text-emerald-700 hover:text-emerald-900 font-bold flex items-center gap-1 text-[11px] cursor-pointer"
                        >
                          <CheckCircle className="w-3.5 h-3.5" />
                          <span>ثبت دریافت / تسویه</span>
                        </button>
                      )}
                    </div>

                    {inv.paymentMethod === 'cheque' && (inv.chequeNumber || inv.chequeDueDate) && (
                      <div className="text-[10px] text-sky-800 bg-sky-50 px-2.5 py-1 rounded-lg border border-sky-100">
                        {inv.chequeNumber && <span>شماره چک: {toPersianDigits(inv.chequeNumber)} </span>}
                        {inv.chequeDueDate && <span>(سررسید: {toPersianDigits(inv.chequeDueDate)}) </span>}
                        {inv.chequeName && <span>- {inv.chequeName}</span>}
                      </div>
                    )}

                    {/* Touch-Friendly Action Buttons for Mobile (min 44px height) */}
                    <div className="space-y-2 pt-2 border-t border-slate-100">
                      {/* Convert Proforma full button if proforma */}
                      {inv.isProforma && onConvertProforma && (
                        <button
                          type="button"
                          id={`mobile-convert-proforma-btn-${inv.id}`}
                          onClick={() => handleOpenConvertModal(inv)}
                          className="w-full min-h-[44px] py-2.5 px-3 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs"
                        >
                          <ArrowRightLeft className="w-4 h-4" />
                          <span>تبدیل به فاکتور رسمی (با کسر از انبار)</span>
                        </button>
                      )}

                      <div className="flex items-center gap-2">
                        {/* View / Print Button */}
                        <button
                          type="button"
                          onClick={() => onViewInvoice(inv)}
                          className="flex-1 min-h-[44px] py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                        >
                          <Printer className="w-4 h-4" />
                          <span>مشاهده و چاپ</span>
                        </button>

                        {/* Edit Button */}
                        {onEditInvoice && (
                          <button
                            type="button"
                            id={`mobile-edit-invoice-btn-${inv.id}`}
                            onClick={() => onEditInvoice(inv)}
                            className="min-h-[44px] px-3.5 bg-blue-50 hover:bg-blue-100 active:bg-blue-200 text-blue-700 border border-blue-200 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shrink-0"
                            title="ویرایش فاکتور"
                          >
                            <Pencil className="w-4 h-4" />
                            <span>ویرایش</span>
                          </button>
                        )}

                        {canDelete && (
                          <>
                            {/* Return to stock */}
                            <button
                              type="button"
                              id={`mobile-return-invoice-btn-${inv.id}`}
                              onClick={() => setInvoiceToReturn(inv)}
                              title={inv.isProforma ? 'لغو و حذف پیش‌فاکتور' : 'مرجوعی به انبار'}
                              className="w-[44px] h-[44px] flex items-center justify-center text-amber-700 bg-amber-50 hover:bg-amber-100 active:bg-amber-200 rounded-xl border border-amber-200 cursor-pointer shrink-0"
                            >
                              <RotateCcw className="w-4 h-4" />
                            </button>

                            {/* Delete */}
                            <button
                              type="button"
                              id={`mobile-delete-invoice-btn-${inv.id}`}
                              onClick={() => setInvoiceToDelete(inv)}
                              title="حذف سند"
                              className="w-[44px] h-[44px] flex items-center justify-center text-rose-600 bg-rose-50 hover:bg-rose-100 active:bg-rose-200 rounded-xl border border-rose-200 cursor-pointer shrink-0"
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

        {/* 5. Desktop View: High-Density Table (Hidden on Mobile, Visible on sm:) */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-right border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100/80 text-slate-700 border-b border-slate-200 select-none">
                <th className="py-3.5 px-3 font-bold text-center w-12">#</th>
                <th className="py-3.5 px-3 font-bold">شماره و نوع سند</th>
                <th className="py-3.5 px-3 font-bold">تاریخ صدور</th>
                <th className="py-3.5 px-3 font-bold">خریدار / مشتری</th>
                <th className="py-3.5 px-3 font-bold text-center">اقلام</th>
                <th className="py-3.5 px-3 font-bold text-left">مبلغ کل و وضعیت مالی</th>
                <th className="py-3.5 px-3 font-bold text-center">وضعیت تسویه</th>
                <th className="py-3.5 px-3 font-bold text-center">روش دریافت</th>
                <th className="py-3.5 px-3 font-bold text-center min-w-[160px]">عملیات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-16 text-slate-400 bg-white">
                    <ReceiptText className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                    <div className="text-sm font-bold text-slate-600">هیچ فاکتوری با مشخصات انتخابی یافت نشد</div>
                    <p className="text-xs text-slate-400 mt-1">
                      می‌توانید عبارت جستجو را تغییر داده یا فیلترهای بالا را بازنشانی فرمایید.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredInvoices.map((inv, index) => {
                  const itemCount = inv.items.reduce((s, i) => s + i.quantity, 0);
                  const remainingDebt = Math.max(0, inv.finalTotal - (inv.paymentStatus === 'paid' ? inv.finalTotal : (inv.paidAmount || 0)));

                  return (
                    <tr 
                      key={inv.id} 
                      className={`${index % 2 === 1 ? 'bg-slate-50/70' : 'bg-white'} hover:bg-emerald-50/30 transition-colors`}
                    >
                      {/* Row index */}
                      <td className="py-3 px-3 text-center text-slate-400 font-mono font-bold text-[11px]">
                        {toPersianDigits(index + 1)}
                      </td>

                      {/* Invoice Number & Type */}
                      <td className="py-3 px-3">
                        <div className="font-black text-slate-900 font-mono text-xs flex items-center gap-1.5">
                          <span>{toPersianDigits(inv.invoiceNumber)}</span>
                          {inv.isProforma && (
                            <span className="text-[10px] bg-indigo-100 text-indigo-800 border border-indigo-200 px-1.5 py-0.2 rounded font-bold">
                              پیش‌فاکتور
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5 text-[10.5px]">
                          <span className="text-slate-500">
                            {inv.isProforma
                              ? 'غیرقطعی (بدون کسر انبار)'
                              : inv.type === 'official'
                              ? 'فاکتور رسمی'
                              : inv.type === 'thermal'
                              ? 'رسید حرارتی'
                              : 'فروشگاهی'}
                          </span>
                          {inv.convertedFromProforma && (
                            <span className="text-emerald-700 font-semibold">
                              (از {inv.convertedFromProforma})
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Issue Date */}
                      <td className="py-3 px-3 text-slate-600 font-mono text-xs whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span>{inv.date}</span>
                        </div>
                      </td>

                      {/* Customer Info */}
                      <td className="py-3 px-3 max-w-[200px]">
                        <div className="font-bold text-slate-900 truncate" title={inv.customerName}>
                          {inv.customerName}
                        </div>
                        {inv.customerPhone && (
                          <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                            <a 
                              href={`tel:${inv.customerPhone}`}
                              className="hover:text-emerald-700 hover:underline"
                            >
                              {toPersianDigits(inv.customerPhone)}
                            </a>
                          </div>
                        )}
                      </td>

                      {/* Items Count */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md font-bold text-[11px]">
                          {toPersianDigits(itemCount)} قلم
                        </span>
                        <span className="text-[10px] text-slate-400 block mt-0.5">
                          ({toPersianDigits(inv.items.length)} ردیف)
                        </span>
                      </td>

                      {/* Financial Amount & Remaining Debt */}
                      <td className="py-3 px-3 text-left whitespace-nowrap font-['Vazirmatn']">
                        <div className="font-black text-slate-900 text-sm font-mono">
                          {formatPrice(inv.finalTotal, settings.currency)}
                        </div>
                        {inv.paymentStatus !== 'paid' && remainingDebt > 0 && (
                          <div className="text-[10.5px] text-rose-700 font-bold mt-0.5">
                            مانده: {formatPrice(remainingDebt, settings.currency)}
                          </div>
                        )}
                      </td>

                      {/* Payment Status Pill with Quick Update trigger */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <div className="inline-flex flex-col items-center">
                          <button
                            type="button"
                            onClick={() => handleOpenPaymentModal(inv)}
                            className={`px-2.5 py-1 rounded-full font-bold text-[11px] flex items-center gap-1 cursor-pointer transition-transform hover:scale-102 ${
                              inv.paymentStatus === 'paid'
                                ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                                : inv.paymentStatus === 'partial'
                                ? 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                                : 'bg-rose-100 text-rose-800 hover:bg-rose-200'
                            }`}
                            title="کلیک جهت ویرایش و ثبت دریافتی"
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
                          </button>

                          {inv.paymentStatus !== 'paid' && (
                            <button
                              id={`mark-paid-btn-${inv.id}`}
                              type="button"
                              onClick={() => onUpdatePaymentStatus(inv.id, 'paid')}
                              className="text-[10px] text-emerald-700 hover:underline mt-1 cursor-pointer font-semibold"
                              title="تسویه آنی کل مبلغ فاکتور"
                            >
                              تسویه کامل؟
                            </button>
                          )}
                        </div>
                      </td>

                      {/* Payment Method Details */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
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
                            ? 'چک بانکی'
                            : inv.paymentMethod === 'cash'
                            ? 'وجه نقد'
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
                      </td>

                      {/* Operations / Actions */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1">
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
                              <span>تبدیل</span>
                            </button>
                          )}

                          {/* Print / View */}
                          <button
                            id={`view-invoice-btn-${inv.id}`}
                            type="button"
                            onClick={() => onViewInvoice(inv)}
                            title={inv.isProforma ? 'مشاهده و چاپ پیش‌فاکتور' : 'مشاهده و چاپ فاکتور'}
                            className="p-2 text-emerald-700 hover:bg-emerald-50 active:bg-emerald-100 rounded-lg transition-colors cursor-pointer"
                          >
                            <Printer className="w-4 h-4" />
                          </button>

                          {/* Edit Invoice / Proforma */}
                          {onEditInvoice && (
                            <button
                              id={`edit-invoice-btn-${inv.id}`}
                              type="button"
                              onClick={() => onEditInvoice(inv)}
                              title={inv.isProforma ? 'ویرایش پیش‌فاکتور' : 'ویرایش فاکتور فروش'}
                              className="p-2 text-blue-600 hover:bg-blue-50 active:bg-blue-100 rounded-lg transition-colors cursor-pointer"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                          )}

                          {/* Return products to stock or cancel proforma */}
                          {canDelete && (
                            <>
                              <button
                                id={`return-invoice-btn-${inv.id}`}
                                type="button"
                                onClick={() => setInvoiceToReturn(inv)}
                                title={inv.isProforma ? 'لغو و حذف پیش‌فاکتور' : 'مرجوعی کالاها به انبار و لغو فاکتور'}
                                className="p-2 text-amber-600 hover:bg-amber-50 active:bg-amber-100 rounded-lg transition-colors cursor-pointer"
                              >
                                <RotateCcw className="w-4 h-4" />
                              </button>

                              {/* Delete without returning */}
                              <button
                                id={`delete-invoice-btn-${inv.id}`}
                                type="button"
                                onClick={() => setInvoiceToDelete(inv)}
                                title="حذف رکورد فاکتور"
                                className="p-2 text-rose-500 hover:bg-rose-50 active:bg-rose-100 rounded-lg transition-colors cursor-pointer"
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

        {/* 6. Summary Footer Bar */}
        {filteredInvoices.length > 0 && (
          <div className="bg-slate-50 p-3 sm:p-4 border-t border-slate-200/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-4 text-slate-600">
              <span>
                تعداد کل: <strong className="text-slate-900 font-mono">{toPersianDigits(filteredInvoices.length)}</strong> فقره سند
              </span>
              <span className="hidden sm:inline text-slate-300">|</span>
              <span className="hidden sm:inline">
                جمع وصول شده: <strong className="text-emerald-700 font-bold">{formatPrice(filteredSummary.totalCollected, settings.currency)}</strong>
              </span>
            </div>

            <div className="flex items-center gap-3">
              {filteredSummary.totalDebt > 0 && (
                <span className="text-amber-800 font-bold">
                  مانده طلب فیلترشده: {formatPrice(filteredSummary.totalDebt, settings.currency)}
                </span>
              )}
              <div className="bg-white border border-slate-200 px-3 py-1.5 rounded-xl font-bold text-slate-900 shadow-2xs">
                جمع کل مبلغ فیلترشده: <span className="font-black text-emerald-800 font-mono">{formatPrice(filteredSummary.totalAmount, settings.currency)}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* MODAL 1: Quick Payment Status Update Modal */}
      {paymentModalInvoice && (
        <div
          id="update-payment-modal"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-slate-200 text-right space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-emerald-700">
                <div className="p-2 rounded-xl bg-emerald-50">
                  <Banknote className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    ثبت دریافت و تسویه حساب
                  </h3>
                  <span className="text-xs text-slate-500 font-mono">
                    فاکتور #{toPersianDigits(paymentModalInvoice.invoiceNumber)} - {paymentModalInvoice.customerName}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPaymentModalInvoice(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Total invoice info */}
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs flex items-center justify-between">
              <span className="text-slate-500">مبلغ کل فاکتور:</span>
              <span className="font-bold text-slate-900 font-mono text-sm">
                {formatPrice(paymentModalInvoice.finalTotal, settings.currency)}
              </span>
            </div>

            {/* Status Selection */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 block">
                وضعیت تسویه فاکتور:
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setPaymentNewStatus('paid');
                    setPaymentNewAmount(paymentModalInvoice.finalTotal);
                  }}
                  className={`min-h-[44px] py-2 px-2 rounded-xl text-xs font-bold border transition-all cursor-pointer flex flex-col items-center justify-center gap-1 ${
                    paymentNewStatus === 'paid'
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <CheckCircle className="w-4 h-4" />
                  <span>تسویه کامل</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setPaymentNewStatus('partial');
                    if (paymentNewAmount === 0 || paymentNewAmount === paymentModalInvoice.finalTotal) {
                      setPaymentNewAmount(Math.round(paymentModalInvoice.finalTotal / 2));
                    }
                  }}
                  className={`min-h-[44px] py-2 px-2 rounded-xl text-xs font-bold border transition-all cursor-pointer flex flex-col items-center justify-center gap-1 ${
                    paymentNewStatus === 'partial'
                      ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <Clock className="w-4 h-4" />
                  <span>بیعانه / قسط</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setPaymentNewStatus('unpaid');
                    setPaymentNewAmount(0);
                  }}
                  className={`min-h-[44px] py-2 px-2 rounded-xl text-xs font-bold border transition-all cursor-pointer flex flex-col items-center justify-center gap-1 ${
                    paymentNewStatus === 'unpaid'
                      ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <AlertCircle className="w-4 h-4" />
                  <span>نسیه</span>
                </button>
              </div>
            </div>

            {/* If partial, show amount input */}
            {paymentNewStatus === 'partial' && (
              <div className="space-y-2 p-3 bg-amber-50/70 border border-amber-200/80 rounded-xl">
                <label htmlFor="partial-paid-amount-input" className="text-xs font-bold text-amber-900 block">
                  مبلغ پرداخت‌شده تا کنون ({settings.currency}):
                </label>
                <input
                  type="number"
                  id="partial-paid-amount-input"
                  value={paymentNewAmount}
                  onChange={(e) => setPaymentNewAmount(Number(e.target.value) || 0)}
                  min={0}
                  max={paymentModalInvoice.finalTotal}
                  className="w-full min-h-[44px] bg-white border border-amber-300 rounded-xl px-3 py-2 text-sm font-mono font-bold text-slate-900 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none"
                />

                <div className="flex items-center justify-between text-[11px] text-amber-900 pt-1 font-['Vazirmatn']">
                  <span>مانده طلب پس از این پرداخت:</span>
                  <strong className="text-rose-700 font-mono">
                    {formatPrice(Math.max(0, paymentModalInvoice.finalTotal - paymentNewAmount), settings.currency)}
                  </strong>
                </div>
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex items-center gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setPaymentModalInvoice(null)}
                className="flex-1 min-h-[44px] py-2.5 px-4 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
              >
                انصراف
              </button>
              <button
                type="button"
                onClick={handleSavePaymentStatus}
                className="flex-1 min-h-[44px] py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm shadow-emerald-200 transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                <span>ذخیره تغییرات</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Delete Invoice Confirmation Modal */}
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
                className="flex-1 min-h-[44px] py-2.5 px-4 rounded-xl text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
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
                className="flex-1 min-h-[44px] py-2.5 px-4 rounded-xl text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 shadow-sm shadow-rose-200 transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" />
                <span>بله، حذف شود</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: Return Invoice to Stock Confirmation Modal */}
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
                className="flex-1 min-h-[44px] py-2.5 px-4 rounded-xl text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
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
                className="flex-1 min-h-[44px] py-2.5 px-4 rounded-xl text-sm font-semibold text-white bg-amber-600 hover:bg-amber-700 shadow-sm shadow-amber-200 transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                <RotateCcw className="w-4 h-4" />
                <span>تایید مرجوعی</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: Convert Proforma to Invoice Modal */}
      {proformaToConvert && (
        <div
          id="convert-proforma-modal"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-2xl max-w-xl w-full p-5 sm:p-6 shadow-2xl border border-slate-200 text-right overflow-hidden flex flex-col max-h-[90vh]">
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
                <label htmlFor="conversion-new-number-input" className="font-bold text-slate-700 block">
                  شماره فاکتور رسمی جدید:
                </label>
                <input
                  type="text"
                  id="conversion-new-number-input"
                  value={conversionNewNumber}
                  onChange={(e) => setConversionNewNumber(e.target.value)}
                  placeholder="مثال: INV-1001"
                  className="w-full min-h-[44px] bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono text-slate-800 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
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
                            <td className="p-2 font-medium text-slate-800">
                              {item.productName}
                              {item.variantName && (
                                <span className="text-slate-400 text-[10.5px] mr-1">
                                  ({item.variantName})
                                </span>
                              )}
                            </td>
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
                className="flex-1 min-h-[44px] py-2.5 px-4 rounded-xl text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
              >
                انصراف
              </button>
              <button
                type="button"
                id="confirm-convert-proforma-btn"
                onClick={handleConfirmConvert}
                className="flex-1 min-h-[44px] py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm shadow-indigo-200 transition-all cursor-pointer flex items-center justify-center gap-1.5"
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
