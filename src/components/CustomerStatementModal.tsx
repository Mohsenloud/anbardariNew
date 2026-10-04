import React, { useState, useMemo } from 'react';
import { 
  X, 
  ReceiptText, 
  CreditCard, 
  Plus, 
  Trash2, 
  Printer, 
  FileSpreadsheet, 
  Search, 
  Calendar, 
  AlertCircle, 
  CheckCircle2, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Building2, 
  Phone, 
  User, 
  FileText, 
  Sparkles,
  ChevronDown,
  ChevronUp,
  Eye, 
  Wallet, 
  Clock,
  Copy,
  Check,
  PhoneCall,
  LayoutGrid,
  LayoutList,
  Filter
} from 'lucide-react';
import { 
  Customer, 
  Invoice, 
  StoreSettings, 
  AppUser, 
  CustomerTransaction, 
  CustomerLedgerEntry, 
  CustomerPaymentMethod 
} from '../types';
import { StorageService } from '../utils/storage';
import { formatPrice, toPersianDigits, getCurrentJalaliDate, numberToPersianWords } from '../utils/jalali';
import { exportCustomerStatementToExcel } from '../utils/excelHelper';
import { CustomerTransactionModal } from './CustomerTransactionModal';

interface CustomerStatementModalProps {
  isOpen: boolean;
  onClose: () => void;
  customer: Customer | null;
  invoices: Invoice[];
  transactions: CustomerTransaction[];
  settings: StoreSettings;
  currentUser?: AppUser;
  onSaveTransaction: (txn: CustomerTransaction) => void;
  onDeleteTransaction: (txnId: string) => void;
  onViewInvoice?: (invoice: Invoice) => void;
  initialFormType?: 'none' | 'deposit' | 'debt';
}

export const CustomerStatementModal: React.FC<CustomerStatementModalProps> = ({
  isOpen,
  onClose,
  customer,
  invoices,
  transactions,
  settings,
  currentUser,
  onSaveTransaction,
  onDeleteTransaction,
  onViewInvoice,
  initialFormType = 'none',
}) => {
  if (!isOpen || !customer) return null;

  // Active sub-modal for registering deposit or debt
  const [activeTxnModalType, setActiveTxnModalType] = useState<'deposit' | 'debt' | null>(
    initialFormType && initialFormType !== 'none' ? initialFormType : null
  );
  const [filterType, setFilterType] = useState<'all' | 'debt' | 'deposit'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState<'all' | '30days' | 'this_year'>('all');
  const [transactionToDelete, setTransactionToDelete] = useState<CustomerTransaction | null>(null);

  // View Controls: Default is 'table' (نمای جدولی پیش‌فرض)
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('table');
  const [showMobileDetails, setShowMobileDetails] = useState<boolean>(false);
  const [copiedText, setCopiedText] = useState<string | null>(null);

  // Open separate transaction modal
  const handleOpenTransactionModal = (type: 'deposit' | 'debt') => {
    setActiveTxnModalType(type);
  };

  // Sync initialFormType when modal opens
  React.useEffect(() => {
    if (isOpen && initialFormType && initialFormType !== 'none') {
      setActiveTxnModalType(initialFormType);
    }
  }, [isOpen, initialFormType]);

  // Build the complete customer ledger
  const fullLedger = useMemo(() => {
    return StorageService.buildCustomerLedger(customer, invoices, transactions);
  }, [customer, invoices, transactions]);

  // Unpaid invoices for this customer
  const unpaidInvoices = useMemo(() => {
    return invoices
      .filter((inv) => {
        if (inv.isProforma) return false;
        const matchesCustomer = 
          (inv.customerId && inv.customerId === customer.id) ||
          (inv.customerName && inv.customerName.trim().toLowerCase() === customer.name.trim().toLowerCase());
        if (!matchesCustomer) return false;
        return inv.paymentStatus === 'unpaid' || inv.paymentStatus === 'partial';
      })
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [invoices, customer]);

  // Filter ledger entries
  const filteredEntries = useMemo(() => {
    return fullLedger.entries.filter((entry) => {
      // Filter by type
      if (filterType === 'debt' && entry.debit === 0) return false;
      if (filterType === 'deposit' && entry.credit === 0) return false;

      // Filter by date
      if (dateFilter === 'this_year') {
        const currentYear = getCurrentJalaliDate().substring(0, 4);
        if (!entry.date.startsWith(currentYear)) return false;
      }

      // Filter by search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesDoc = entry.documentNumber.toLowerCase().includes(q);
        const matchesDesc = entry.description.toLowerCase().includes(q);
        const matchesNotes = entry.notes?.toLowerCase().includes(q);
        const matchesTrack = entry.trackingNumber?.toLowerCase().includes(q);
        if (!matchesDoc && !matchesDesc && !matchesNotes && !matchesTrack) return false;
      }

      return true;
    });
  }, [fullLedger.entries, filterType, dateFilter, searchQuery]);

  // Copy helper
  const handleCopy = (text: string, label: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedText(label);
    setTimeout(() => setCopiedText(null), 2000);
  };

  // Print Trigger
  const handlePrint = () => {
    window.print();
  };

  // Export to Excel
  const handleExportExcel = () => {
    exportCustomerStatementToExcel(customer, fullLedger, settings);
  };

  return (
    <div 
      id="customer-statement-modal" 
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/75 backdrop-blur-xs flex items-center justify-center p-0 sm:p-3 md:p-5 animate-in fade-in duration-150"
    >
      <div className="bg-white w-full max-w-5xl rounded-none sm:rounded-3xl shadow-2xl border-0 sm:border border-slate-200 overflow-hidden flex flex-col h-[100dvh] sm:h-[92vh] max-h-[100dvh] text-right">
        
        {/* MODAL HEADER */}
        <div className="no-print bg-slate-900 text-white px-3.5 py-3 sm:px-5 sm:py-4 flex items-center justify-between gap-2.5 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <span className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center font-bold text-sm sm:text-base shrink-0 shadow-sm border border-white/10">
              {customer.name ? customer.name.charAt(0) : <ReceiptText className="w-5 h-5" />}
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                <h2 className="text-sm sm:text-base font-bold text-white truncate">
                  صورتحساب: {customer.name}
                </h2>
                {/* Mobile / Desktop Status Badge */}
                {fullLedger.netBalance > 0 ? (
                  <span className="text-[10px] sm:text-[11px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40 px-2 py-0.5 rounded-full flex items-center gap-1 shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" />
                    <span>بدهکار: {formatPrice(fullLedger.netBalance, settings.currency)}</span>
                  </span>
                ) : fullLedger.netBalance < 0 ? (
                  <span className="text-[10px] sm:text-[11px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/40 px-2 py-0.5 rounded-full flex items-center gap-1 shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                    <span>طلبکار: {formatPrice(Math.abs(fullLedger.netBalance), settings.currency)}</span>
                  </span>
                ) : (
                  <span className="text-[10px] sm:text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded-full flex items-center gap-1 shrink-0">
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                    <span>تسویه کامل</span>
                  </span>
                )}
              </div>
              <div className="text-[11px] sm:text-xs text-slate-400 mt-0.5 flex items-center gap-2 sm:gap-3 flex-wrap">
                {customer.phone && (
                  <a
                    href={`tel:${customer.phone}`}
                    className="flex items-center gap-1 text-slate-300 hover:text-emerald-400 transition-colors"
                    title="تماس تلفنی با مشتری"
                  >
                    <PhoneCall className="w-3 h-3 text-emerald-400 shrink-0" />
                    <span className="font-mono">{toPersianDigits(customer.phone)}</span>
                  </a>
                )}
                {customer.nationalId && (
                  <span className="hidden sm:inline">کد ملی: <strong className="font-mono text-slate-300">{toPersianDigits(customer.nationalId)}</strong></span>
                )}
                <span className="text-[10px] text-slate-400">({toPersianDigits(fullLedger.entries.length)} تراکنش)</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer shrink-0"
              title="بستن پنجره (Esc)"
              aria-label="بستن"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* FINANCIAL SUMMARY: MOBILE HERO CARD + DESKTOP 4-COLUMN CARDS */}
        {/* 1. Mobile Financial Banner (< sm) */}
        <div className="no-print sm:hidden p-3 bg-gradient-to-b from-slate-900 to-slate-800 text-white shrink-0 border-b border-slate-700/60">
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3 border border-white/15">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-slate-300 font-medium flex items-center gap-1.5">
                <Wallet className="w-3.5 h-3.5 text-emerald-400" />
                مانده حساب جاری مشتری:
              </span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                fullLedger.netBalance > 0
                  ? 'bg-rose-500 text-white'
                  : fullLedger.netBalance < 0
                    ? 'bg-blue-500 text-white'
                    : 'bg-emerald-500 text-white'
              }`}>
                {fullLedger.netBalance > 0
                  ? 'مشتری بدهکار است'
                  : fullLedger.netBalance < 0
                    ? 'مشتری طلبکار است'
                    : 'کاملاً بی‌حساب / تسویه'}
              </span>
            </div>

            <div className="flex items-baseline justify-between gap-2 mt-1">
              <div className="text-xl font-black font-mono tracking-tight">
                {formatPrice(Math.abs(fullLedger.netBalance), settings.currency)}
              </div>
              {fullLedger.netBalance > 0 && (
                <button
                  type="button"
                  onClick={() => handleOpenTransactionModal('deposit')}
                  className="bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white text-[11px] font-bold px-2.5 py-1 rounded-xl shadow-xs flex items-center gap-1 cursor-pointer transition-all"
                >
                  <Plus className="w-3 h-3" />
                  <span>ثبت واریز</span>
                </button>
              )}
            </div>

            {/* Compact 3-metrics breakdown bar */}
            <div className="grid grid-cols-3 gap-1.5 mt-2.5 pt-2 border-t border-white/10 text-center">
              <div className="bg-white/5 rounded-xl py-1 px-1">
                <span className="text-[9px] text-rose-300 block">کل بدهی (خرید)</span>
                <span className="text-[11px] font-bold font-mono text-rose-200">
                  {formatPrice(fullLedger.totalDebit, '')}
                </span>
              </div>
              <div className="bg-white/5 rounded-xl py-1 px-1">
                <span className="text-[9px] text-emerald-300 block">کل واریزی‌ها</span>
                <span className="text-[11px] font-bold font-mono text-emerald-200">
                  {formatPrice(fullLedger.totalCredit, '')}
                </span>
              </div>
              <div className="bg-white/5 rounded-xl py-1 px-1">
                <span className="text-[9px] text-slate-300 block">تراکنش‌ها</span>
                <span className="text-[11px] font-bold font-mono text-slate-100">
                  {toPersianDigits(fullLedger.entries.length)} سند
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 2. Desktop 4-Column KPI Cards (>= sm) */}
        <div className="no-print hidden sm:grid sm:grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3 p-3.5 sm:p-4 bg-slate-50/90 border-b border-slate-200/80 shrink-0">
          {/* 1. Total Debits (بدهکار) */}
          <div className="bg-white p-3 rounded-2xl border border-rose-100 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs text-rose-600 font-bold mb-1">
              <span>جمع کل بدهی‌ها</span>
              <span className="p-1 bg-rose-50 rounded-lg">
                <ArrowUpRight className="w-3.5 h-3.5 text-rose-600" />
              </span>
            </div>
            <div className="text-sm sm:text-base font-black text-rose-700 font-mono truncate">
              {formatPrice(fullLedger.totalDebit, settings.currency)}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5 truncate">
              فاکتورها و اسناد بدهکاری
            </div>
          </div>

          {/* 2. Total Credits (بستانکار) */}
          <div className="bg-white p-3 rounded-2xl border border-emerald-100 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs text-emerald-600 font-bold mb-1">
              <span>جمع کل واریزی‌ها</span>
              <span className="p-1 bg-emerald-50 rounded-lg">
                <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-600" />
              </span>
            </div>
            <div className="text-sm sm:text-base font-black text-emerald-700 font-mono truncate">
              {formatPrice(fullLedger.totalCredit, settings.currency)}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5 truncate">
              نقدی، کارت و واریزی‌ها
            </div>
          </div>

          {/* 3. Net Balance (مانده حساب) */}
          <div className={`p-3 rounded-2xl border shadow-xs flex flex-col justify-between ${
            fullLedger.netBalance > 0
              ? 'bg-rose-50/80 border-rose-200 text-rose-800'
              : fullLedger.netBalance < 0
                ? 'bg-blue-50/80 border-blue-200 text-blue-800'
                : 'bg-emerald-50/80 border-emerald-200 text-emerald-800'
          }`}>
            <div className="flex items-center justify-between text-xs font-bold mb-1">
              <span>مانده حساب جاری</span>
              <span className="p-1 bg-white/80 rounded-lg">
                <Wallet className="w-3.5 h-3.5" />
              </span>
            </div>
            <div className="text-sm sm:text-base font-black font-mono truncate">
              {formatPrice(Math.abs(fullLedger.netBalance), settings.currency)}
            </div>
            <div className="text-[10px] font-bold mt-0.5 truncate">
              {fullLedger.netBalance > 0
                ? 'مشتری بدهکار است'
                : fullLedger.netBalance < 0
                  ? 'مشتری طلبکار است'
                  : 'حساب کاملاً تسویه است'}
            </div>
          </div>

          {/* 4. Total Entries & Invoices */}
          <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs text-slate-600 font-bold mb-1">
              <span>تعداد کل اسناد</span>
              <span className="p-1 bg-slate-100 rounded-lg text-slate-600">
                <FileText className="w-3.5 h-3.5" />
              </span>
            </div>
            <div className="text-sm sm:text-base font-black text-slate-800 font-mono truncate">
              {toPersianDigits(fullLedger.entries.length)} تراکنش
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5 truncate">
              {toPersianDigits(unpaidInvoices.length)} فاکتور تسویه‌نشده
            </div>
          </div>
        </div>

        {/* ACTION TOOLBAR & FILTERS */}
        <div className="no-print p-2.5 sm:p-3.5 border-b border-slate-200 bg-white space-y-2.5 shrink-0">
          {/* Top Row: Primary Actions & View Controls */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            {/* Primary Action Buttons */}
            <div className="flex items-center gap-1.5 sm:gap-2 flex-1 sm:flex-initial">
              <button
                type="button"
                id="add-deposit-btn"
                onClick={() => handleOpenTransactionModal('deposit')}
                className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white px-3 sm:px-4 py-2 rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 shrink-0" />
                <span>ثبت واریز</span>
              </button>

              <button
                type="button"
                id="add-debt-btn"
                onClick={() => handleOpenTransactionModal('debt')}
                className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white px-3 sm:px-4 py-2 rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 shrink-0" />
                <span>ثبت بدهی</span>
              </button>
            </div>

            {/* Secondary Buttons & View Switch */}
            <div className="flex items-center gap-1.5 shrink-0">
              {/* View Switcher (Table vs Cards) */}
              <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200 text-xs">
                <button
                  type="button"
                  onClick={() => setViewMode('table')}
                  className={`p-1.5 sm:px-2.5 sm:py-1 rounded-lg font-bold flex items-center gap-1 transition-all cursor-pointer ${
                    viewMode === 'table' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-500 hover:text-slate-700'
                  }`}
                  title="نمای جدولی (پیش‌فرض)"
                >
                  <LayoutList className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">جدول</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('cards')}
                  className={`p-1.5 sm:px-2.5 sm:py-1 rounded-lg font-bold flex items-center gap-1 transition-all cursor-pointer ${
                    viewMode === 'cards' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-500 hover:text-slate-700'
                  }`}
                  title="نمای کارتی"
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">کارتی</span>
                </button>
              </div>

              {/* Print Statement */}
              <button
                type="button"
                id="print-statement-btn"
                onClick={handlePrint}
                className="p-2 sm:px-3 sm:py-1.5 flex items-center gap-1 bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold transition-all cursor-pointer"
                title="چاپ صورتحساب رسمی"
              >
                <Printer className="w-3.5 h-3.5 text-slate-600" />
                <span className="hidden sm:inline">چاپ</span>
              </button>

              {/* Export to Excel */}
              <button
                type="button"
                id="export-statement-excel-btn"
                onClick={handleExportExcel}
                className="p-2 sm:px-3 sm:py-1.5 flex items-center gap-1 bg-purple-50 hover:bg-purple-100 active:scale-95 text-purple-700 border border-purple-200 rounded-xl text-xs font-bold transition-all cursor-pointer"
                title="خروجی فایل اکسل صورتحساب"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-purple-600" />
                <span className="hidden sm:inline">اکسل</span>
              </button>
            </div>
          </div>

          {/* Bottom Row: Filters & Search */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Filter by Type Tabs */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200 text-xs overflow-x-auto shrink-0">
              <button
                type="button"
                onClick={() => setFilterType('all')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer whitespace-nowrap ${
                  filterType === 'all' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                همه ({toPersianDigits(fullLedger.entries.length)})
              </button>
              <button
                type="button"
                onClick={() => setFilterType('debt')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer whitespace-nowrap ${
                  filterType === 'debt' ? 'bg-white text-rose-700 shadow-xs' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                بدهی‌ها
              </button>
              <button
                type="button"
                onClick={() => setFilterType('deposit')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer whitespace-nowrap ${
                  filterType === 'deposit' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                واریزی‌ها
              </button>
            </div>

            {/* Quick Search Input */}
            <div className="relative flex-1 min-w-[150px]">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="جستجو در شرح، شماره، پیگیری..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-8 pl-7 py-1.5 text-xs text-slate-800 outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-full"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* LEDGER ENTRIES LIST (RESPONSIVE CARDS FOR MOBILE & TABLE FOR DESKTOP) */}
        <div className="no-print flex-1 overflow-y-auto p-2.5 sm:p-4 md:p-5">
          {/* A. MOBILE CARDS VIEW (Clean, Touch-Friendly, High Contrast) */}
          {viewMode === 'cards' ? (
            <div className="space-y-2.5">
              {filteredEntries.length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-400">
                  <ReceiptText className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                  <p className="text-xs">
                    {fullLedger.entries.length === 0 
                      ? 'هنوز هیچ فاکتور یا تراکنش مالی برای این مشتری ثبت نشده است.' 
                      : 'هیچ تراکنشی با فیلترهای انتخابی یافت نشد.'}
                  </p>
                </div>
              ) : (
                filteredEntries.map((entry, index) => {
                  const isInvoice = entry.documentType === 'invoice';
                  const isPayment = entry.documentType === 'deposit' || entry.documentType === 'invoice_payment';
                  const isManualTxn = !!entry.rawTransaction;

                  return (
                    <div 
                      key={entry.id}
                      className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-3 hover:border-slate-300 transition-all text-right"
                    >
                      {/* Top Row: Type Badge + Doc Number + Date */}
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-lg ${
                            entry.documentType === 'invoice'
                              ? 'bg-purple-50 text-purple-700 border border-purple-200'
                              : entry.documentType === 'deposit'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : entry.documentType === 'invoice_payment'
                                  ? 'bg-teal-50 text-teal-700 border border-teal-200'
                                  : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}>
                            {entry.documentType === 'deposit' ? (
                              <ArrowDownLeft className="w-3 h-3 text-emerald-600" />
                            ) : entry.documentType === 'invoice' ? (
                              <FileText className="w-3 h-3 text-purple-600" />
                            ) : entry.documentType === 'invoice_payment' ? (
                              <ReceiptText className="w-3 h-3 text-teal-600" />
                            ) : (
                              <ArrowUpRight className="w-3 h-3 text-rose-600" />
                            )}
                            <span>{entry.documentTypeLabel}</span>
                          </span>

                          <span className="font-mono text-xs font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded-md">
                            #{toPersianDigits(entry.documentNumber)}
                          </span>
                        </div>

                        <div className="flex items-center gap-1 text-[11px] text-slate-500 font-mono">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          <span>{toPersianDigits(entry.date)}</span>
                        </div>
                      </div>

                      {/* Description & Tracking info */}
                      <div className="text-xs text-slate-800 mb-2 leading-relaxed">
                        <span>{entry.description}</span>
                        {entry.trackingNumber && (
                          <div className="flex items-center gap-1 mt-1 text-[10px] text-slate-500 font-mono">
                            <span>کد پیگیری:</span>
                            <span className="font-bold text-slate-700">{toPersianDigits(entry.trackingNumber)}</span>
                            <button
                              type="button"
                              onClick={() => handleCopy(entry.trackingNumber!, `track-${entry.id}`)}
                              className="text-slate-400 hover:text-emerald-600 p-0.5"
                              title="کپی شماره پیگیری"
                            >
                              {copiedText === `track-${entry.id}` ? (
                                <Check className="w-3 h-3 text-emerald-600" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          </div>
                        )}
                        {entry.notes && (
                          <div className="text-[11px] text-slate-500 mt-0.5 italic">
                            {entry.notes}
                          </div>
                        )}
                      </div>

                      {/* Transaction Amount & Running Balance Row */}
                      <div className="flex items-center justify-between gap-2 p-2 bg-slate-50 rounded-xl border border-slate-100">
                        {/* Entry Amount */}
                        <div>
                          <span className="text-[10px] text-slate-400 block mb-0.5">
                            {entry.debit > 0 ? 'مبلغ بدهکاری' : 'مبلغ واریزی'}
                          </span>
                          <span className={`text-xs sm:text-sm font-black font-mono ${
                            entry.debit > 0 ? 'text-rose-700' : 'text-emerald-700'
                          }`}>
                            {entry.debit > 0
                              ? `+ ${toPersianDigits(entry.debit.toLocaleString('en-US'))}`
                              : `- ${toPersianDigits(entry.credit.toLocaleString('en-US'))}`} {settings.currency}
                          </span>
                        </div>

                        {/* Running Balance */}
                        <div className="text-left">
                          <span className="text-[10px] text-slate-400 block mb-0.5">مانده پس از تراکنش</span>
                          <div className="flex items-center justify-end gap-1">
                            <span className={`text-xs sm:text-sm font-black font-mono ${
                              entry.balance > 0 ? 'text-rose-800' : entry.balance < 0 ? 'text-blue-800' : 'text-slate-700'
                            }`}>
                              {toPersianDigits(Math.abs(entry.balance).toLocaleString('en-US'))}
                            </span>
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                              entry.balance > 0 
                                ? 'bg-rose-100 text-rose-700' 
                                : entry.balance < 0 
                                  ? 'bg-blue-100 text-blue-700' 
                                  : 'bg-emerald-100 text-emerald-700'
                            }`}>
                              {entry.balance > 0 ? 'بدهکار' : entry.balance < 0 ? 'طلبکار' : 'تسویه'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Action buttons (View Invoice / Delete Manual Txn) */}
                      {(entry.rawInvoice || (isManualTxn && entry.rawTransaction)) && (
                        <div className="flex items-center justify-end gap-1.5 mt-2 pt-2 border-t border-slate-100">
                          {entry.rawInvoice && onViewInvoice && (
                            <button
                              type="button"
                              onClick={() => onViewInvoice(entry.rawInvoice!)}
                              className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-xl transition-colors cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>مشاهده فاکتور</span>
                            </button>
                          )}
                          {isManualTxn && entry.rawTransaction && (
                            <button
                              type="button"
                              onClick={() => setTransactionToDelete(entry.rawTransaction!)}
                              className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-xl transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>حذف سند</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          ) : (
            /* B. TABLE VIEW (Desktop / Detailed) */
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 border-b border-slate-200 font-bold">
                      <th className="py-3 px-3 w-10 text-center">#</th>
                      <th className="py-3 px-3 w-24">تاریخ</th>
                      <th className="py-3 px-3 w-32">نوع سند</th>
                      <th className="py-3 px-3 w-28">شماره سند/پیگیری</th>
                      <th className="py-3 px-3 min-w-[200px]">شرح تراکنش</th>
                      <th className="py-3 px-3 w-28 text-rose-700">بدهکار ({settings.currency})</th>
                      <th className="py-3 px-3 w-28 text-emerald-700">بستانکار ({settings.currency})</th>
                      <th className="py-3 px-3 w-32" title="مانده لحظه‌ای حساب مشتری پس از اعمال هر ردیف">
                        <div className="flex items-center gap-1.5 cursor-help">
                          <span>مانده جاری</span>
                          <span
                            className="w-4 h-4 rounded-full bg-slate-200 text-slate-600 text-[10px] inline-flex items-center justify-center font-bold"
                            title="مانده جاری: مانده لحظه‌ای بدهی یا طلب مشتری پس از این تراکنش"
                          >
                            ؟
                          </span>
                        </div>
                      </th>
                      <th className="py-3 px-2 w-20 text-center">عملیات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredEntries.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="py-12 text-center text-slate-400">
                          {fullLedger.entries.length === 0 
                            ? 'هنوز هیچ فاکتور یا تراکنش مالی برای این مشتری ثبت نشده است.' 
                            : 'هیچ تراکنشی با فیلترهای انتخابی یافت نشد.'}
                        </td>
                      </tr>
                    ) : (
                      filteredEntries.map((entry, index) => {
                        const isInvoice = entry.documentType === 'invoice';
                        const isManualTxn = !!entry.rawTransaction;

                        return (
                          <tr 
                            key={entry.id} 
                            className={`hover:bg-slate-50 transition-colors ${
                              index % 2 === 1 ? 'bg-slate-50/40' : 'bg-white'
                            }`}
                          >
                            <td className="py-2.5 px-3 text-center text-slate-400 font-mono text-[11px]">
                              {toPersianDigits(index + 1)}
                            </td>
                            <td className="py-2.5 px-3 font-mono text-slate-700 font-semibold whitespace-nowrap">
                              {toPersianDigits(entry.date)}
                            </td>
                            <td className="py-2.5 px-3 whitespace-nowrap">
                              <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md ${
                                entry.documentType === 'invoice'
                                  ? 'bg-purple-50 text-purple-700 border border-purple-200'
                                  : entry.documentType === 'deposit'
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                    : entry.documentType === 'invoice_payment'
                                      ? 'bg-teal-50 text-teal-700 border border-teal-200'
                                      : 'bg-rose-50 text-rose-700 border border-rose-200'
                              }`}>
                                {entry.documentTypeLabel}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 font-mono text-slate-800 text-[11px] whitespace-nowrap font-medium">
                              {toPersianDigits(entry.documentNumber)}
                            </td>
                            <td className="py-2.5 px-3 text-slate-700 leading-relaxed">
                              <span>{entry.description}</span>
                              {entry.trackingNumber && (
                                <span className="text-[10px] text-slate-400 block font-mono">
                                  پیگیری: {toPersianDigits(entry.trackingNumber)}
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 font-mono font-bold text-rose-700 whitespace-nowrap">
                              {entry.debit > 0 ? toPersianDigits(entry.debit.toLocaleString('en-US')) : '—'}
                            </td>
                            <td className="py-2.5 px-3 font-mono font-bold text-emerald-700 whitespace-nowrap">
                              {entry.credit > 0 ? toPersianDigits(entry.credit.toLocaleString('en-US')) : '—'}
                            </td>
                            <td className="py-2.5 px-3 font-mono font-bold whitespace-nowrap">
                              <div className="flex items-center gap-1">
                                <span className={entry.balance > 0 ? 'text-rose-800' : entry.balance < 0 ? 'text-blue-800' : 'text-slate-600'}>
                                  {toPersianDigits(Math.abs(entry.balance).toLocaleString('en-US'))}
                                </span>
                                <span className={`text-[9px] font-bold px-1 py-0.5 rounded ${
                                  entry.balance > 0 
                                    ? 'bg-rose-100 text-rose-700' 
                                    : entry.balance < 0 
                                      ? 'bg-blue-100 text-blue-700' 
                                      : 'bg-emerald-100 text-emerald-700'
                                }`}>
                                  {entry.balance > 0 ? 'بد' : entry.balance < 0 ? 'بس' : 'تسویه'}
                                </span>
                              </div>
                            </td>
                            <td className="py-2.5 px-2 text-center whitespace-nowrap">
                              <div className="flex items-center justify-center gap-1">
                                {entry.rawInvoice && onViewInvoice && (
                                  <button
                                    type="button"
                                    onClick={() => onViewInvoice(entry.rawInvoice!)}
                                    title="مشاهده فاکتور"
                                    className="p-1 text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 rounded-md cursor-pointer transition-colors"
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                {isManualTxn && entry.rawTransaction && (
                                  <button
                                    type="button"
                                    onClick={() => setTransactionToDelete(entry.rawTransaction!)}
                                    title="حذف سند دستی"
                                    className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md cursor-pointer transition-colors"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                  {/* Table Footer Totals */}
                  {filteredEntries.length > 0 && (
                    <tfoot>
                      <tr className="bg-slate-100 font-bold text-slate-800 border-t-2 border-slate-300">
                        <td colSpan={5} className="py-3 px-4 text-left font-bold text-xs">
                          مجموع گردش و مانده نهایی ({settings.currency}):
                        </td>
                        <td className="py-3 px-3 font-mono font-black text-rose-800 text-xs whitespace-nowrap">
                          {toPersianDigits(fullLedger.totalDebit.toLocaleString('en-US'))}
                        </td>
                        <td className="py-3 px-3 font-mono font-black text-emerald-800 text-xs whitespace-nowrap">
                          {toPersianDigits(fullLedger.totalCredit.toLocaleString('en-US'))}
                        </td>
                        <td colSpan={2} className="py-3 px-3 font-mono font-black text-xs whitespace-nowrap">
                          <span className={fullLedger.netBalance > 0 ? 'text-rose-800' : fullLedger.netBalance < 0 ? 'text-blue-800' : 'text-emerald-800'}>
                            {toPersianDigits(Math.abs(fullLedger.netBalance).toLocaleString('en-US'))} {settings.currency} (
                            {fullLedger.netBalance > 0 ? 'بدهکار' : fullLedger.netBalance < 0 ? 'بستانکار' : 'تسویه'})
                          </span>
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          )}
        </div>

        {/* MODAL FOOTER & MOBILE STICKY SUMMARY BAR */}
        <div className="no-print p-3 sm:p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-2.5 shrink-0">
          <div className="text-[11px] sm:text-xs text-slate-500 truncate min-w-0">
            مانده به حروف: <strong className="text-slate-800">
              {fullLedger.netBalance === 0 
                ? 'تسویه کامل (بی‌حساب)' 
                : `${numberToPersianWords(Math.abs(fullLedger.netBalance))} ${settings.currency} ${fullLedger.netBalance > 0 ? 'بدهکار' : 'بستانکار'}`}
            </strong>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {fullLedger.netBalance > 0 && (
              <button
                type="button"
                onClick={() => handleOpenTransactionModal('deposit')}
                className="sm:hidden px-3 py-1.5 text-xs font-bold text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 cursor-pointer shadow-xs"
              >
                واریز سریع
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-4 sm:px-5 py-1.5 sm:py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-100 cursor-pointer transition-all"
            >
              بستن
            </button>
          </div>
        </div>

        {/* PRINTABLE OFFICIAL CUSTOMER STATEMENT SHEET (Visible only during print) */}
        <div className="print-only hidden p-8 text-black bg-white">
          {/* Header */}
          <div className="border-b-2 border-slate-800 pb-4 mb-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-black text-slate-900">{settings.storeName || 'سیستم صدور فاکتور و حسابداری'}</h1>
                <p className="text-xs text-slate-600 mt-1">{settings.tagline}</p>
                <p className="text-xs text-slate-600 mt-0.5">
                  نشانی: {settings.address} | تلفن: {settings.phone || settings.mobile}
                </p>
              </div>
              <div className="text-left font-mono text-xs space-y-1">
                <div className="text-base font-bold text-slate-900 font-sans">صورتحساب مالی مشتری</div>
                <div>تاریخ صدور: {toPersianDigits(getCurrentJalaliDate())}</div>
                <div>شناسه مشتری: {customer.id}</div>
              </div>
            </div>
          </div>

          {/* Customer Info Card */}
          <div className="border border-slate-300 rounded-xl p-4 mb-6 bg-slate-50/50">
            <div className="grid grid-cols-2 gap-3 text-xs leading-relaxed">
              <div><strong>نام طرف‌حساب:</strong> {customer.name}</div>
              <div><strong>شماره تماس:</strong> {customer.phone ? toPersianDigits(customer.phone) : '—'}</div>
              <div><strong>کد ملی / شناسه اقتصادی:</strong> {customer.nationalId ? toPersianDigits(customer.nationalId) : '—'}</div>
              <div><strong>نشانی خریدار:</strong> {customer.address || '—'}</div>
            </div>
          </div>

          {/* Ledger Table for Print */}
          <table className="w-full text-right text-xs border border-slate-300 border-collapse mb-6">
            <thead>
              <tr className="bg-slate-200 text-slate-900 font-bold border-b border-slate-300">
                <th className="py-2 px-2 border-l border-slate-300 text-center w-8">#</th>
                <th className="py-2 px-2 border-l border-slate-300 w-24">تاریخ</th>
                <th className="py-2 px-2 border-l border-slate-300 w-28">نوع سند</th>
                <th className="py-2 px-2 border-l border-slate-300 w-24">شماره سند/پیگیری</th>
                <th className="py-2 px-2 border-l border-slate-300">شرح سند</th>
                <th className="py-2 px-2 border-l border-slate-300 w-24">بدهکار ({settings.currency})</th>
                <th className="py-2 px-2 border-l border-slate-300 w-24">بستانکار ({settings.currency})</th>
                <th className="py-2 px-2 w-28">مانده حساب</th>
              </tr>
            </thead>
            <tbody>
              {fullLedger.entries.map((item, idx) => (
                <tr key={item.id} className="border-b border-slate-200 text-[11px]">
                  <td className="py-1.5 px-2 border-l border-slate-200 text-center font-mono">{toPersianDigits(idx + 1)}</td>
                  <td className="py-1.5 px-2 border-l border-slate-200 font-mono">{toPersianDigits(item.date)}</td>
                  <td className="py-1.5 px-2 border-l border-slate-200 font-medium">{item.documentTypeLabel}</td>
                  <td className="py-1.5 px-2 border-l border-slate-200 font-mono">{toPersianDigits(item.documentNumber)}</td>
                  <td className="py-1.5 px-2 border-l border-slate-200">{item.description}</td>
                  <td className="py-1.5 px-2 border-l border-slate-200 font-mono">{item.debit > 0 ? toPersianDigits(item.debit.toLocaleString('en-US')) : '—'}</td>
                  <td className="py-1.5 px-2 border-l border-slate-200 font-mono">{item.credit > 0 ? toPersianDigits(item.credit.toLocaleString('en-US')) : '—'}</td>
                  <td className="py-1.5 px-2 font-mono font-bold">
                    {toPersianDigits(Math.abs(item.balance).toLocaleString('en-US'))} ({item.balance > 0 ? 'بد' : item.balance < 0 ? 'بس' : 'تسویه'})
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-slate-100 font-bold border-t-2 border-slate-400">
                <td colSpan={5} className="py-2 px-3 border-l border-slate-300 text-left font-bold">
                  جمع کل و مانده نهایی ({settings.currency}):
                </td>
                <td className="py-2 px-2 border-l border-slate-300 font-mono font-black">
                  {toPersianDigits(fullLedger.totalDebit.toLocaleString('en-US'))}
                </td>
                <td className="py-2 px-2 border-l border-slate-300 font-mono font-black">
                  {toPersianDigits(fullLedger.totalCredit.toLocaleString('en-US'))}
                </td>
                <td className="py-2 px-2 font-mono font-black">
                  {toPersianDigits(Math.abs(fullLedger.netBalance).toLocaleString('en-US'))} ({fullLedger.netBalance > 0 ? 'بدهکار' : fullLedger.netBalance < 0 ? 'بستانکار' : 'تسویه'})
                </td>
              </tr>
            </tfoot>
          </table>

          {/* Bottom Statement Summary & Signatures */}
          <div className="border border-slate-300 rounded-xl p-4 mb-8 bg-slate-50">
            <div className="text-xs leading-relaxed mb-1">
              <strong>مانده نهایی حساب به حروف:</strong> {fullLedger.netBalance === 0 
                ? 'حساب کاملاً تسویه و بی‌حساب است.' 
                : `${numberToPersianWords(Math.abs(fullLedger.netBalance))} ${settings.currency} ${fullLedger.netBalance > 0 ? 'بدهکار' : 'بستانکار'}`}
            </div>
            {settings.invoiceFooterText && (
              <div className="text-[11px] text-slate-600 mt-2">{settings.invoiceFooterText}</div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-8 text-center text-xs mt-12 pt-4">
            <div className="border-t border-slate-400 pt-3">
              <span className="font-bold">مهر و امضای امور مالی / فروشگاه</span>
            </div>
            <div className="border-t border-slate-400 pt-3">
              <span className="font-bold">امضا و تایید مانده حساب توسط خریدار</span>
            </div>
          </div>
        </div>

      </div>

      {/* DELETE TRANSACTION CONFIRMATION MODAL */}
      {transactionToDelete && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-slate-200 text-right">
            <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center mb-3 mx-auto">
              <Trash2 className="w-5 h-5" />
            </div>
            <h4 className="text-sm font-bold text-slate-900 text-center mb-1">
              حذف سند تراکنش
            </h4>
            <p className="text-xs text-slate-600 text-center mb-4 leading-relaxed">
              آیا از حذف این سند مالی به مبلغ <strong className="font-mono font-bold text-rose-700">{formatPrice(transactionToDelete.amount, settings.currency)}</strong> اطمینان دارید؟
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setTransactionToDelete(null)}
                className="flex-1 py-2 px-3 rounded-xl text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 cursor-pointer"
              >
                انصراف
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteTransaction(transactionToDelete.id);
                  setTransactionToDelete(null);
                }}
                className="flex-1 py-2 px-3 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 cursor-pointer"
              >
                بله، حذف شود
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SEPARATE MODAL: REGISTER DEPOSIT OR REGISTER DEBT */}
      {activeTxnModalType && (
        <CustomerTransactionModal
          isOpen={!!activeTxnModalType}
          onClose={() => setActiveTxnModalType(null)}
          customer={customer}
          initialType={activeTxnModalType}
          invoices={invoices}
          transactions={transactions}
          settings={settings}
          currentUser={currentUser}
          onSaveTransaction={onSaveTransaction}
        />
      )}
    </div>
  );
};
