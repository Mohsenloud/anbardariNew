import React, { useState, useMemo, useEffect } from 'react';
import { Invoice, StoreSettings, AppUser, Product, Customer } from '../types';
import { formatPrice, toPersianDigits } from '../utils/jalali';
import { exportInvoicesToCsv } from '../utils/csvExport';
import { StorageService } from '../utils/storage';
import { CustomerExportModal } from './CustomerExportModal';
import { InvoiceQuickDetailsModal } from './InvoiceQuickDetailsModal';
import { CustomerBulkPaymentModal } from './CustomerBulkPaymentModal';
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
  ChevronUp,
  BarChart3,
  SlidersHorizontal,
  MoreVertical,
  Download,
  Filter, 
  Check,
  Eye
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
  onBatchUpdatePaymentStatus?: (
    updates: { invoiceId: string; status: 'paid' | 'unpaid' | 'partial'; paidAmount: number }[],
    details?: string
  ) => void;
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
  onBatchUpdatePaymentStatus,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'paid' | 'partial' | 'unpaid'>('all');
  const [docTypeFilter, setDocTypeFilter] = useState<'all' | 'regular' | 'proforma'>('all');
  const [sortBy, setSortBy] = useState<SortOption>('date-desc');
  
  // Modals state
  const [quickDetailsInvoice, setQuickDetailsInvoice] = useState<Invoice | null>(null);
  const [invoiceToDelete, setInvoiceToDelete] = useState<Invoice | null>(null);
  const [invoiceToReturn, setInvoiceToReturn] = useState<Invoice | null>(null);
  const [proformaToConvert, setProformaToConvert] = useState<Invoice | null>(null);
  const [conversionNewNumber, setConversionNewNumber] = useState<string>('');
  
  // Quick payment update modal state
  const [paymentModalInvoice, setPaymentModalInvoice] = useState<Invoice | null>(null);
  const [paymentNewStatus, setPaymentNewStatus] = useState<'paid' | 'unpaid' | 'partial'>('paid');
  const [paymentNewAmount, setPaymentNewAmount] = useState<number>(0);

  // Bulk Payment state
  const [bulkPaymentCustomer, setBulkPaymentCustomer] = useState<Customer | null>(null);
  const [isBulkPickerOpen, setIsBulkPickerOpen] = useState(false);
  const [bulkPickerSearch, setBulkPickerSearch] = useState('');

  // Customer Excel Export Modal
  const [isCustomerExportModalOpen, setIsCustomerExportModalOpen] = useState(false);
  const [customerExportSelected, setCustomerExportSelected] = useState<Customer | null>(null);
  const [customersList, setCustomersList] = useState<Customer[]>(() => StorageService.getCustomers());

  // UI declutter states
  const [showStats, setShowStats] = useState(false);
  const [isToolsOpen, setIsToolsOpen] = useState(false);

  useEffect(() => {
    const unsub = StorageService.subscribe(() => {
      setCustomersList(StorageService.getCustomers());
    });
    return () => unsub();
  }, []);

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

  // Debtor customers for bulk payment settlement
  const debtorCustomers = useMemo(() => {
    const debtMap = new Map<string, { customer: Customer; debt: number; count: number }>();
    invoices.forEach((inv) => {
      if (inv.isProforma || inv.paymentStatus === 'paid') return;
      const remaining = Math.max(0, inv.finalTotal - (inv.paidAmount || 0));
      if (remaining <= 0) return;
      const key = inv.customerId || inv.customerName.trim().toLowerCase();
      if (!debtMap.has(key)) {
        let matchedCust = customersList.find(
          (c) => c.id === inv.customerId || c.name.trim().toLowerCase() === inv.customerName.trim().toLowerCase()
        );
        if (!matchedCust) {
          matchedCust = {
            id: inv.customerId || `cust-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
            name: inv.customerName,
            phone: inv.customerPhone || '',
            createdAt: inv.date,
          };
        }
        debtMap.set(key, { customer: matchedCust, debt: remaining, count: 1 });
      } else {
        const entry = debtMap.get(key)!;
        entry.debt += remaining;
        entry.count += 1;
      }
    });
    return Array.from(debtMap.values()).sort((a, b) => b.debt - a.debt);
  }, [invoices, customersList]);

  // Permission checks
  const canCreate = !currentUser || currentUser.permissions.canCreateInvoice;
  const canDelete = !currentUser || currentUser.permissions.canDeleteInvoice;
  const canAccessAdmin = !currentUser || currentUser.role === 'admin' || currentUser.permissions.canAccessAdmin;

  // Conversion Handlers
  const handleOpenConvertModal = (inv: Invoice) => {
    setProformaToConvert(inv);
    const existingInvoices = StorageService.getInvoices();
    let defaultNum = StorageService.getNextInvoiceNumber(false);
    
    // اگر شماره معادل INV بر اساس دنباله خالی و معتبر بود، پیشنهاد داده شود
    if (inv.invoiceNumber.startsWith('PF-')) {
      const candidateSameSeq = inv.invoiceNumber.replace('PF-', 'INV-');
      if (!existingInvoices.some((i) => i.invoiceNumber === candidateSameSeq)) {
        defaultNum = candidateSameSeq;
      }
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
      {/* 1. Header Card (Decluttered & Streamlined) */}
      <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-100 shrink-0">
            <ReceiptText className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-black text-slate-800">
                لیست و مدیریت فاکتورها
              </h2>
              <span className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full font-bold">
                {toPersianDigits(invoices.length)} سند
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              صدور، چاپ، پیگیری وصول مطالبات و تسویه فاکتورها
            </p>
          </div>
        </div>

        {/* Top Action Buttons: Primary + Tools Dropdown */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Toggle Financial Summary Stats */}
          <button
            type="button"
            onClick={() => setShowStats((prev) => !prev)}
            className={`min-h-[40px] px-3 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center gap-1.5 ${
              showStats 
                ? 'bg-slate-900 text-white border-slate-900 shadow-xs' 
                : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
            }`}
            title="نمایش یا پنهان‌سازی خلاصه آمار فروش و مطالبات"
          >
            <BarChart3 className="w-4 h-4" />
            <span className="hidden sm:inline">آمار مالی</span>
            {showStats ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          {/* Secondary Tools Menu */}
          <div className="relative">
            <button
              type="button"
              id="invoices-tools-menu-btn"
              onClick={() => setIsToolsOpen((prev) => !prev)}
              className="min-h-[40px] px-3 py-2 rounded-xl text-xs font-bold bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 transition-all cursor-pointer flex items-center gap-1.5"
              title="سایر ابزارها، تسویه تجمیعی و خروجی‌ها"
            >
              <SlidersHorizontal className="w-4 h-4 text-slate-500" />
              <span>عملیات و خروجی‌ها</span>
              {debtorCustomers.length > 0 && (
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              )}
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {isToolsOpen && (
              <>
                <div 
                  className="fixed inset-0 z-30" 
                  onClick={() => setIsToolsOpen(false)} 
                />
                <div className="absolute left-0 mt-1.5 w-64 bg-white rounded-2xl shadow-xl border border-slate-200 py-1.5 z-40 text-xs text-right animate-in fade-in duration-100">
                  <button
                    type="button"
                    onClick={() => {
                      setIsToolsOpen(false);
                      setIsBulkPickerOpen(true);
                    }}
                    className="w-full px-3.5 py-2.5 flex items-center justify-between hover:bg-amber-50/70 text-slate-700 hover:text-amber-900 font-bold transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <CreditCard className="w-4 h-4 text-amber-600" />
                      <span>تسویه تجمیعی مشتری</span>
                    </div>
                    {debtorCustomers.length > 0 && (
                      <span className="bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded-full text-[10px]">
                        {toPersianDigits(debtorCustomers.length)} بدهکار
                      </span>
                    )}
                  </button>

                  <div className="h-px bg-slate-100 my-1" />

                  {canAccessAdmin && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setIsToolsOpen(false);
                          const filterLabel = statusFilter === 'all' ? 'همه' : statusFilter === 'paid' ? 'تسویه_شده' : statusFilter === 'partial' ? 'اقساطی' : 'نسیه';
                          exportInvoicesToCsv(filteredInvoices, settings, `گزارش_فاکتورها_${filterLabel}_${filteredInvoices.length}_فقره`);
                        }}
                        disabled={filteredInvoices.length === 0}
                        className="w-full px-3.5 py-2 flex items-center gap-2 hover:bg-slate-50 text-slate-700 font-medium transition-colors cursor-pointer disabled:opacity-50"
                      >
                        <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                        <span>خروجی اکسل لیست جاری ({toPersianDigits(filteredInvoices.length)})</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setIsToolsOpen(false);
                          setCustomerExportSelected(null);
                          setIsCustomerExportModalOpen(true);
                        }}
                        className="w-full px-3.5 py-2 flex items-center gap-2 hover:bg-purple-50 text-purple-800 font-medium transition-colors cursor-pointer"
                      >
                        <FileSpreadsheet className="w-4 h-4 text-purple-600" />
                        <span>خروجی کلیه اسناد و حواله‌های یک شخص</span>
                      </button>
                    </>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Proforma Button */}
          {canCreate && onNewProforma && (
            <button
              id="invoices-list-new-proforma-btn"
              type="button"
              onClick={onNewProforma}
              className="min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 transition-all cursor-pointer flex items-center gap-1.5"
            >
              <FileClock className="w-4 h-4 text-indigo-600" />
              <span className="hidden sm:inline">پیش‌فاکتور جدید</span>
              <span className="sm:hidden">پیش‌فاکتور</span>
            </button>
          )}

          {/* Main Primary Action: New Invoice */}
          {canCreate && (
            <button
              id="invoices-list-new-btn"
              type="button"
              onClick={onNewInvoice}
              className="min-h-[40px] px-4 py-2 rounded-xl text-xs sm:text-sm font-bold bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>فاکتور جدید</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Collapsible Slim Financial Stats Strip */}
      {showStats && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 animate-in fade-in duration-150">
          <div 
            onClick={() => {
              setStatusFilter('all');
              setDocTypeFilter('all');
            }}
            className="bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs hover:border-slate-300 transition-all cursor-pointer flex items-center justify-between"
          >
            <div>
              <div className="text-[11px] font-bold text-slate-500">مجموع فروش فاکتورها</div>
              <div className="text-base font-black text-slate-900 mt-0.5 font-mono">
                {formatPrice(totalSalesVolume, settings.currency)}
              </div>
            </div>
            <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-lg font-bold">
              {toPersianDigits(regularInvoicesCount)} فاکتور
            </span>
          </div>

          <div 
            onClick={() => setStatusFilter('paid')}
            className="bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs hover:border-emerald-300 transition-all cursor-pointer flex items-center justify-between"
          >
            <div>
              <div className="text-[11px] font-bold text-emerald-800">مبلغ وصول شده (نقد / پوز)</div>
              <div className="text-base font-black text-emerald-700 mt-0.5 font-mono">
                {formatPrice(totalReceivedCash, settings.currency)}
              </div>
            </div>
            <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-lg font-bold">
              {toPersianDigits(statusCounts.paid)} تسویه
            </span>
          </div>

          <div 
            onClick={() => setStatusFilter(statusFilter === 'unpaid' ? 'partial' : 'unpaid')}
            className="bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs hover:border-amber-300 transition-all cursor-pointer flex items-center justify-between"
          >
            <div>
              <div className="text-[11px] font-bold text-amber-800">مانده طلب و نسیه</div>
              <div className="text-base font-black text-amber-700 mt-0.5 font-mono">
                {formatPrice(totalPendingDebt, settings.currency)}
              </div>
            </div>
            <span className="text-[10px] bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-lg font-bold">
              {toPersianDigits(statusCounts.unpaid + statusCounts.partial)} باز
            </span>
          </div>
        </div>
      )}

      {/* 3. Main Data Container */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
        {/* Unified Clean Filter & Search Toolbar */}
        <div className="p-3 sm:p-3.5 border-b border-slate-200/80 bg-slate-50/50 space-y-2.5">
          {/* Row 1: Search + Document Type Switcher + Sort */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 justify-between">
            {/* Search Input */}
            <div className="relative flex-1 group">
              <Search className="w-4 h-4 text-slate-400 group-focus-within:text-emerald-600 absolute right-3 top-1/2 -translate-y-1/2 transition-colors pointer-events-none" />
              <input
                type="text"
                id="invoices-search-input"
                placeholder="جستجوی فاکتور، خریدار، تلفن، چک..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full min-h-[38px] bg-white border border-slate-200 rounded-xl pr-9 pl-8 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-full hover:bg-slate-100 cursor-pointer"
                  title="پاک کردن"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Document Type Segmented Pills */}
            <div className="flex bg-slate-200/70 p-0.5 rounded-xl text-xs font-bold shrink-0 self-start sm:self-auto">
              <button
                type="button"
                id="doc-filter-all"
                onClick={() => setDocTypeFilter('all')}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap text-[11px] ${
                  docTypeFilter === 'all'
                    ? 'bg-white text-slate-900 shadow-2xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                همه ({toPersianDigits(invoices.length)})
              </button>
              <button
                type="button"
                id="doc-filter-regular"
                onClick={() => setDocTypeFilter('regular')}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap text-[11px] ${
                  docTypeFilter === 'regular'
                    ? 'bg-emerald-600 text-white shadow-2xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                فاکتورها ({toPersianDigits(regularInvoicesCount)})
              </button>
              <button
                type="button"
                id="doc-filter-proforma"
                onClick={() => setDocTypeFilter('proforma')}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap text-[11px] ${
                  docTypeFilter === 'proforma'
                    ? 'bg-indigo-600 text-white shadow-2xs font-bold'
                    : 'text-indigo-700 hover:text-indigo-900'
                }`}
              >
                پیش‌فاکتور ({toPersianDigits(proformaInvoicesCount)})
              </button>
            </div>

            {/* Sorting Dropdown */}
            <div className="relative shrink-0 w-36 sm:w-44">
              <select
                id="invoices-sort-select"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="w-full min-h-[38px] appearance-none bg-white border border-slate-200 rounded-xl pr-7 pl-6 py-1.5 text-[11px] font-bold text-slate-700 focus:ring-2 focus:ring-slate-500/20 focus:border-slate-400 outline-none cursor-pointer"
              >
                <option value="date-desc">جدیدترین تاریخ</option>
                <option value="date-asc">قدیمی‌ترین تاریخ</option>
                <option value="total-desc">بیشترین مبلغ</option>
                <option value="total-asc">کمترین مبلغ</option>
                <option value="debt-desc">بیشترین مانده طلب</option>
                <option value="customer-asc">نام خریدار</option>
              </select>
              <ArrowUpDown className="w-3 h-3 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
              <ChevronDown className="w-3 h-3 text-slate-400 absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* Row 2: Status Chips & Summary Counter */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <button
                id="filter-inv-all"
                type="button"
                onClick={() => setStatusFilter('all')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                  statusFilter === 'all'
                    ? 'bg-slate-900 text-white shadow-2xs'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                همه ({toPersianDigits(statusCounts.all)})
              </button>

              <button
                id="filter-inv-paid"
                type="button"
                onClick={() => setStatusFilter('paid')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
                  statusFilter === 'paid'
                    ? 'bg-emerald-600 text-white shadow-2xs'
                    : 'bg-emerald-50 text-emerald-800 border border-emerald-200/70 hover:bg-emerald-100'
                }`}
              >
                <CheckCircle className="w-3 h-3" />
                <span>تسویه شده ({toPersianDigits(statusCounts.paid)})</span>
              </button>

              <button
                id="filter-inv-partial"
                type="button"
                onClick={() => setStatusFilter('partial')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
                  statusFilter === 'partial'
                    ? 'bg-amber-600 text-white shadow-2xs'
                    : 'bg-amber-50 text-amber-800 border border-amber-200/70 hover:bg-amber-100'
                }`}
              >
                <Clock className="w-3 h-3" />
                <span>بیعانه ({toPersianDigits(statusCounts.partial)})</span>
              </button>

              <button
                id="filter-inv-unpaid"
                type="button"
                onClick={() => setStatusFilter('unpaid')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
                  statusFilter === 'unpaid'
                    ? 'bg-rose-600 text-white shadow-2xs'
                    : 'bg-rose-50 text-rose-800 border border-rose-200/70 hover:bg-rose-100'
                }`}
              >
                <AlertCircle className="w-3 h-3" />
                <span>نسیه ({toPersianDigits(statusCounts.unpaid)})</span>
              </button>
            </div>

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
            filteredInvoices.map((inv) => {
              const isPaid = inv.paymentStatus === 'paid';
              const isPartial = inv.paymentStatus === 'partial';

              return (
                <div
                  key={inv.id}
                  id={`mobile-invoice-card-${inv.id}`}
                  onClick={() => setQuickDetailsInvoice(inv)}
                  className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs hover:border-emerald-300 transition-all cursor-pointer active:bg-slate-50 space-y-2.5"
                >
                  {/* Row 1: Number, Date, and Status */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-black text-slate-900 text-sm bg-slate-100 px-2 py-0.5 rounded-lg border border-slate-200">
                        {toPersianDigits(inv.invoiceNumber)}
                      </span>
                      {inv.isProforma && (
                        <span className="text-[10px] bg-indigo-100 text-indigo-800 border border-indigo-200 px-2 py-0.5 rounded-md font-bold">
                          پیش‌فاکتور
                        </span>
                      )}
                      <span className="text-xs text-slate-500 font-mono">
                        {toPersianDigits(inv.date)}
                      </span>
                    </div>

                    <span
                      className={`px-2 py-0.5 rounded-full font-bold text-[10px] flex items-center gap-1 border shrink-0 ${
                        isPaid
                          ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                          : isPartial
                          ? 'bg-amber-100 text-amber-800 border-amber-300'
                          : 'bg-rose-100 text-rose-800 border-rose-300'
                      }`}
                    >
                      {isPaid ? 'تسویه' : isPartial ? 'بیعانه' : 'نسیه'}
                    </span>
                  </div>

                  {/* Row 2: Customer Name, Amount, and View Details Button */}
                  <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100 text-xs">
                    <div className="font-bold text-slate-900 truncate max-w-[170px]" title={inv.customerName}>
                      {inv.customerName}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-black font-mono text-slate-800 text-xs">
                        {formatPrice(inv.finalTotal, settings.currency)}
                      </span>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setQuickDetailsInvoice(inv);
                        }}
                        className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5 text-emerald-600" />
                        <span>جزئیات</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* 5. Desktop View: Ultra-Clean Single-Row Table */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-right border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100/80 text-slate-700 border-b border-slate-200 select-none">
                <th className="py-3.5 px-3 font-bold text-center w-12">#</th>
                <th className="py-3.5 px-3 font-bold">شماره فاکتور</th>
                <th className="py-3.5 px-3 font-bold">خریدار / مشتری</th>
                <th className="py-3.5 px-3 font-bold">تاریخ صدور</th>
                <th className="py-3.5 px-3 font-bold text-left">مبلغ کل و وضعیت مالی</th>
                <th className="py-3.5 px-3 font-bold text-center w-36">عملیات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-16 text-slate-400 bg-white">
                    <ReceiptText className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                    <div className="text-sm font-bold text-slate-600">هیچ فاکتوری با مشخصات انتخابی یافت نشد</div>
                    <p className="text-xs text-slate-400 mt-1">
                      می‌توانید عبارت جستجو را تغییر داده یا فیلترهای بالا را بازنشانی فرمایید.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredInvoices.map((inv, index) => {
                  const isPaid = inv.paymentStatus === 'paid';
                  const isPartial = inv.paymentStatus === 'partial';

                  return (
                    <tr 
                      key={inv.id} 
                      onClick={() => setQuickDetailsInvoice(inv)}
                      className={`${index % 2 === 1 ? 'bg-slate-50/70' : 'bg-white'} hover:bg-emerald-50/40 transition-colors cursor-pointer group`}
                    >
                      {/* Row index */}
                      <td className="py-3.5 px-3 text-center text-slate-400 font-mono font-bold text-[11px]">
                        {toPersianDigits(index + 1)}
                      </td>

                      {/* Invoice Number */}
                      <td className="py-3.5 px-3">
                        <div className="font-mono font-black text-slate-900 text-xs flex items-center gap-1.5">
                          <span className="bg-slate-100 group-hover:bg-white px-2.5 py-1 rounded-lg border border-slate-200">
                            {toPersianDigits(inv.invoiceNumber)}
                          </span>
                          {inv.isProforma && (
                            <span className="text-[10px] bg-indigo-100 text-indigo-800 border border-indigo-200 px-1.5 py-0.5 rounded font-bold">
                              پیش‌فاکتور
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Customer Name */}
                      <td className="py-3.5 px-3">
                        <div className="font-bold text-slate-900 truncate max-w-xs" title={inv.customerName}>
                          {inv.customerName}
                        </div>
                      </td>

                      {/* Issue Date */}
                      <td className="py-3.5 px-3 text-slate-600 font-mono text-xs whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span>{toPersianDigits(inv.date)}</span>
                        </div>
                      </td>

                      {/* Amount & Status */}
                      <td className="py-3.5 px-3 text-left whitespace-nowrap font-['Vazirmatn']">
                        <div className="flex items-center justify-end gap-2">
                          <span className="font-black text-slate-900 text-xs sm:text-sm font-mono">
                            {formatPrice(inv.finalTotal, settings.currency)}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full font-bold text-[10px] border ${
                              isPaid
                                ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                : isPartial
                                ? 'bg-amber-100 text-amber-800 border-amber-300'
                                : 'bg-rose-100 text-rose-800 border-rose-300'
                            }`}
                          >
                            {isPaid ? 'تسویه' : isPartial ? 'بیعانه' : 'نسیه'}
                          </span>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-3 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => setQuickDetailsInvoice(inv)}
                            className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer shadow-2xs"
                            title="مشاهده اطلاعات کامل، اقلام و عملیات فاکتور"
                          >
                            <Eye className="w-3.5 h-3.5 text-emerald-600" />
                            <span>مشاهده جزئیات</span>
                          </button>

                          <button
                            id={`view-invoice-btn-${inv.id}`}
                            type="button"
                            onClick={() => onViewInvoice(inv)}
                            title="مشاهده و چاپ مستقیم"
                            className="p-2 text-slate-600 hover:text-emerald-700 hover:bg-slate-100 active:bg-slate-200 rounded-xl transition-colors cursor-pointer"
                          >
                            <Printer className="w-4 h-4" />
                          </button>
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

      {/* INVOICE QUICK DETAILS MODAL */}
      <InvoiceQuickDetailsModal
        isOpen={Boolean(quickDetailsInvoice)}
        invoice={quickDetailsInvoice}
        settings={settings}
        currentUser={currentUser}
        onClose={() => setQuickDetailsInvoice(null)}
        onViewInvoice={(inv) => {
          setQuickDetailsInvoice(null);
          onViewInvoice(inv);
        }}
        onEditInvoice={onEditInvoice ? (inv) => {
          setQuickDetailsInvoice(null);
          onEditInvoice(inv);
        } : undefined}
        onOpenPaymentModal={(inv) => {
          setQuickDetailsInvoice(null);
          handleOpenPaymentModal(inv);
        }}
        onConvertProforma={onConvertProforma ? (inv) => {
          setQuickDetailsInvoice(null);
          handleOpenConvertModal(inv);
        } : undefined}
        onReturnInvoiceToStock={onReturnInvoiceToStock ? (inv) => {
          setQuickDetailsInvoice(null);
          setInvoiceToReturn(inv);
        } : undefined}
        onDeleteInvoice={onDeleteInvoice ? (invId) => {
          const inv = invoices.find((i) => i.id === invId);
          setQuickDetailsInvoice(null);
          if (inv) setInvoiceToDelete(inv);
        } : undefined}
        onExportCustomer={(inv) => {
          setQuickDetailsInvoice(null);
          const found = customersList.find((c) => c.id === inv.customerId || c.name.trim().toLowerCase() === inv.customerName.trim().toLowerCase());
          setCustomerExportSelected(found || {
            id: inv.customerId || `cust-${inv.customerName}`,
            name: inv.customerName,
            phone: inv.customerPhone || '',
            createdAt: inv.date,
          });
          setIsCustomerExportModalOpen(true);
        }}
      />

      {/* CUSTOMER INVOICES & EXIT SLIPS EXCEL EXPORT MODAL */}
      <CustomerExportModal
        isOpen={isCustomerExportModalOpen}
        onClose={() => {
          setIsCustomerExportModalOpen(false);
          setCustomerExportSelected(null);
        }}
        initialCustomerId={customerExportSelected?.id}
        customers={customersList}
        invoices={invoices}
        settings={settings}
      />

      {/* MODAL: CHOOSE CUSTOMER FOR BULK SETTLEMENT */}
      {isBulkPickerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-amber-400" />
                <h3 className="font-black text-sm sm:text-base">
                  انتخاب مشتری جهت تسویه یکباره فاکتورها
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsBulkPickerOpen(false);
                  setBulkPickerSearch('');
                }}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 border-b border-slate-100 bg-slate-50">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={bulkPickerSearch}
                  onChange={(e) => setBulkPickerSearch(e.target.value)}
                  placeholder="جستجوی نام یا شماره مشتری..."
                  className="w-full bg-white border border-slate-200 rounded-xl pr-9 pl-3 py-2 text-xs outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                />
              </div>
            </div>

            <div className="p-4 overflow-y-auto divide-y divide-slate-100 max-h-[50vh]">
              {debtorCustomers.filter((d) => 
                d.customer.name.toLowerCase().includes(bulkPickerSearch.toLowerCase()) ||
                (d.customer.phone && d.customer.phone.includes(bulkPickerSearch))
              ).length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs">
                  هیچ مشتری با بدهی تسویه‌نشده یافت نشد.
                </div>
              ) : (
                debtorCustomers
                  .filter((d) => 
                    d.customer.name.toLowerCase().includes(bulkPickerSearch.toLowerCase()) ||
                    (d.customer.phone && d.customer.phone.includes(bulkPickerSearch))
                  )
                  .map(({ customer, debt, count }) => (
                    <button
                      key={customer.id}
                      type="button"
                      onClick={() => {
                        setIsBulkPickerOpen(false);
                        setBulkPickerSearch('');
                        setBulkPaymentCustomer(customer);
                      }}
                      className="w-full p-3 flex items-center justify-between text-right hover:bg-amber-50/60 transition-colors rounded-xl group cursor-pointer"
                    >
                      <div>
                        <div className="font-bold text-slate-900 text-xs group-hover:text-amber-900">
                          {customer.name}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          {toPersianDigits(count)} فاکتور تسویه‌نشده
                          {customer.phone && ` | تلفن: ${toPersianDigits(customer.phone)}`}
                        </div>
                      </div>
                      <div className="text-left shrink-0">
                        <div className="text-xs font-black text-rose-700 font-mono">
                          {formatPrice(debt, settings.currency)}
                        </div>
                        <span className="text-[10px] text-amber-700 font-bold group-hover:underline">
                          تسویه فاکتورها ←
                        </span>
                      </div>
                    </button>
                  ))
              )}
            </div>

            <div className="p-3 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setIsBulkPickerOpen(false);
                  setBulkPickerSearch('');
                }}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                بستن
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CUSTOMER BULK PAYMENT MODAL */}
      {bulkPaymentCustomer && (
        <CustomerBulkPaymentModal
          isOpen={!!bulkPaymentCustomer}
          onClose={() => setBulkPaymentCustomer(null)}
          customer={bulkPaymentCustomer}
          invoices={invoices}
          settings={settings}
          onConfirmPayment={(updates, details) => {
            if (onBatchUpdatePaymentStatus) {
              onBatchUpdatePaymentStatus(updates, details);
            }
          }}
        />
      )}
    </div>
  );
};
