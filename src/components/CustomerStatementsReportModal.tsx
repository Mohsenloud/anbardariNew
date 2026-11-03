import React, { useState, useMemo } from 'react';
import { 
  X, 
  ReceiptText, 
  FileSpreadsheet, 
  Printer, 
  Search, 
  Users, 
  AlertCircle, 
  CheckCircle2, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Eye, 
  Phone, 
  MapPin, 
  Wallet,
  Filter,
  ArrowUpDown,
  PhoneCall,
  LayoutGrid,
  LayoutList,
  FileDown,
  Loader2
} from 'lucide-react';
import { Customer, Invoice, StoreSettings, CustomerTransaction } from '../types';
import { StorageService } from '../utils/storage';
import { formatPrice, toPersianDigits, getCurrentJalaliDate } from '../utils/jalali';
import { exportAllCustomerStatementsToExcel } from '../utils/excelHelper';
import { exportElementToPdf } from '../utils/pdfHelper';

interface CustomerStatementsReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  customers: Customer[];
  invoices: Invoice[];
  transactions: CustomerTransaction[];
  settings: StoreSettings;
  onSelectCustomerForStatement: (customer: Customer) => void;
}

export const CustomerStatementsReportModal: React.FC<CustomerStatementsReportModalProps> = ({
  isOpen,
  onClose,
  customers,
  invoices,
  transactions,
  settings,
  onSelectCustomerForStatement,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'debtor' | 'settled' | 'creditor'>('all');
  const [sortBy, setSortBy] = useState<'debt_desc' | 'name' | 'activity'>('debt_desc');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false);
  const [pdfSuccessMessage, setPdfSuccessMessage] = useState<string | null>(null);

  // Compute ledger info for each customer
  const customerLedgers = useMemo(() => {
    return customers.map((c) => {
      const ledger = StorageService.buildCustomerLedger(c, invoices, transactions);
      return {
        customer: c,
        ledger,
      };
    });
  }, [customers, invoices, transactions]);

  // Filtered & Sorted Customer list based on search and status
  const filteredList = useMemo(() => {
    let list = customerLedgers.filter(({ customer, ledger }) => {
      // Status filter
      if (statusFilter === 'debtor' && ledger.netBalance <= 0) return false;
      if (statusFilter === 'settled' && ledger.netBalance !== 0) return false;
      if (statusFilter === 'creditor' && ledger.netBalance >= 0) return false;

      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = customer.name.toLowerCase().includes(q);
        const matchesPhone = customer.phone?.includes(q);
        const matchesNid = customer.nationalId?.includes(q);
        const matchesAddress = customer.address?.toLowerCase().includes(q);
        if (!matchesName && !matchesPhone && !matchesNid && !matchesAddress) return false;
      }

      return true;
    });

    // Sorting
    list.sort((a, b) => {
      if (sortBy === 'debt_desc') {
        return b.ledger.netBalance - a.ledger.netBalance;
      }
      if (sortBy === 'name') {
        return a.customer.name.localeCompare(b.customer.name);
      }
      return 0;
    });

    return list;
  }, [customerLedgers, statusFilter, searchQuery, sortBy]);

  const isFiltered = Boolean(searchQuery.trim() || statusFilter !== 'all');

  // Dynamic calculations computed strictly from filteredList
  const overallStats = useMemo(() => {
    let totalReceivables = 0; // بدهی مشتریان به فروشگاه (طلب‌های ما)
    let totalPayables = 0;    // بستانکاری مشتریان از ما
    let totalAllDebits = 0;
    let totalAllCredits = 0;
    let debtorCount = 0;
    let settledCount = 0;
    let creditorCount = 0;

    filteredList.forEach(({ ledger }) => {
      totalAllDebits += ledger.totalDebit;
      totalAllCredits += ledger.totalCredit;

      if (ledger.netBalance > 0) {
        totalReceivables += ledger.netBalance;
        debtorCount++;
      } else if (ledger.netBalance < 0) {
        totalPayables += Math.abs(ledger.netBalance);
        creditorCount++;
      } else {
        settledCount++;
      }
    });

    return {
      totalReceivables,
      totalPayables,
      totalAllDebits,
      totalAllCredits,
      debtorCount,
      settledCount,
      creditorCount,
      filteredCount: filteredList.length,
      allCount: customerLedgers.length,
      isFiltered,
    };
  }, [filteredList, customerLedgers.length, isFiltered]);

  const handlePrint = () => {
    window.print();
  };

  const handleExportExcel = () => {
    const listToExport = filteredList.map((item) => item.customer);
    exportAllCustomerStatementsToExcel(listToExport, invoices, transactions, settings);
  };

  const handleExportPdf = async () => {
    if (isExportingPdf) return;
    try {
      setIsExportingPdf(true);
      await new Promise((resolve) => setTimeout(resolve, 30));
      const safeDate = getCurrentJalaliDate().replace(/\//g, '-');
      const searchSuffix = searchQuery.trim()
        ? `_جستجو_${searchQuery.trim().replace(/[/\\:*?"<>|]/g, '_')}`
        : statusFilter !== 'all'
        ? `_${statusFilter}`
        : '';
      const filename = `گزارش_مانده_حساب_مشتریان${searchSuffix}_${safeDate}.pdf`;

      const result = await exportElementToPdf('printable-customer-statements-report-pdf', filename, {
        pageSize: 'a4',
        orientation: 'landscape',
        quality: 'high',
        documentType: 'generic',
      });

      if (result.success) {
        setPdfSuccessMessage('فایل PDF گزارش مانده حساب مشتریان با موفقیت دانلود شد.');
        setTimeout(() => setPdfSuccessMessage(null), 5000);
      } else {
        setPdfSuccessMessage(result.error || 'خطا در صدور فایل PDF گزارش');
        setTimeout(() => setPdfSuccessMessage(null), 5000);
      }
    } catch (err: any) {
      console.error('PDF export error:', err);
      setPdfSuccessMessage('خطا در تولید فایل PDF گزارش');
      setTimeout(() => setPdfSuccessMessage(null), 5000);
    } finally {
      setIsExportingPdf(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      id="customer-statements-report-modal"
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/75 backdrop-blur-xs flex items-center justify-center p-0 sm:p-3 md:p-5 animate-in fade-in duration-150"
    >
      <div className="bg-white w-full max-w-6xl rounded-none sm:rounded-3xl shadow-2xl border-0 sm:border border-slate-200 overflow-hidden flex flex-col h-[100dvh] sm:h-[92vh] max-h-[100dvh] text-right">
        
        {/* HEADER */}
        <div className="no-print bg-slate-900 text-white px-3.5 py-3 sm:px-5 sm:py-4 flex items-center justify-between gap-2.5 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <span className="p-2 sm:p-2.5 bg-purple-500/20 text-purple-400 rounded-xl sm:rounded-2xl border border-purple-500/30 shrink-0">
              <ReceiptText className="w-4 h-4 sm:w-5 sm:h-5" />
            </span>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-bold text-white truncate">
                گزارش صورتحساب و گردش مالی مشتریان
              </h2>
              <p className="text-[11px] sm:text-xs text-slate-400 mt-0.5 truncate">
                وضعیت حساب‌های دفتری، بدهکاران، واریزی‌ها و وصول مطالبات
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              id="export-all-statements-pdf-btn"
              onClick={handleExportPdf}
              disabled={isExportingPdf}
              className="flex items-center gap-1 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white p-2 sm:px-3 sm:py-1.5 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer disabled:opacity-60"
              title="خروجی PDF گزارش مانده حساب مشتریان"
            >
              {isExportingPdf ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <FileDown className="w-3.5 h-3.5" />
              )}
              <span className="hidden sm:inline">{isExportingPdf ? 'در حال صدور...' : 'خروجی PDF'}</span>
            </button>

            <button
              type="button"
              id="export-all-statements-excel-btn"
              onClick={handleExportExcel}
              className="flex items-center gap-1 bg-purple-600 hover:bg-purple-700 active:scale-95 text-white p-2 sm:px-3 sm:py-1.5 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
              title={isFiltered ? 'خروجی اکسل نتایج فیلتر و جستجو' : 'خروجی اکسل کامل'}
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">خروجی اکسل</span>
            </button>

            <button
              type="button"
              id="print-master-report-btn"
              onClick={handlePrint}
              className="flex items-center gap-1 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 border border-slate-700 p-2 sm:px-3 sm:py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer"
              title="چاپ گزارش جامع"
            >
              <Printer className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">چاپ</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 sm:w-8 sm:h-8 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
              title="بستن پنجره"
              aria-label="بستن"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* PDF Success Toast Banner */}
        {pdfSuccessMessage && (
          <div className="no-print bg-emerald-600 text-white text-xs font-bold py-2 px-4 flex items-center justify-between gap-2 shadow-sm animate-in fade-in shrink-0">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-100" />
              <span>{pdfSuccessMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => setPdfSuccessMessage(null)}
              className="text-white/80 hover:text-white p-1 rounded-lg cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* OVERALL FINANCIAL STATS CARDS (DYNAMICALLY COMPUTED FROM SEARCH & FILTERS) */}
        <div className="no-print p-2.5 sm:p-4 bg-slate-50/80 border-b border-slate-200/80 grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 shrink-0">
          {/* 1. Total Receivables (کل طلب‌های وصول نشده) */}
          <div className="bg-white p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl border border-rose-200 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between text-[11px] sm:text-xs text-rose-700 font-bold mb-1">
              <span>{isFiltered ? 'طلب‌های نتایج جستجو' : 'کل طلب‌های وصول‌نشده'}</span>
              <span className="p-1 bg-rose-50 rounded-lg">
                <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
              </span>
            </div>
            <div className="text-sm sm:text-lg font-black text-rose-800 font-mono truncate">
              {formatPrice(overallStats.totalReceivables, settings.currency)}
            </div>
            <div className="text-[9px] sm:text-[10px] text-slate-500 mt-0.5 truncate">
              {toPersianDigits(overallStats.debtorCount)} طرف‌حساب بدهکار {isFiltered ? '(در جستجو)' : ''}
            </div>
          </div>

          {/* 2. Total Invoiced (کل بدهکاری‌های ثبت‌شده) */}
          <div className="bg-white p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between text-[11px] sm:text-xs text-slate-600 font-bold mb-1">
              <span>{isFiltered ? 'خریدها (نتایج جستجو)' : 'مجموع کل خریدها'}</span>
              <span className="p-1 bg-slate-100 rounded-lg text-slate-600">
                <ArrowUpRight className="w-3.5 h-3.5" />
              </span>
            </div>
            <div className="text-sm sm:text-lg font-black text-slate-800 font-mono truncate">
              {formatPrice(overallStats.totalAllDebits, settings.currency)}
            </div>
            <div className="text-[9px] sm:text-[10px] text-slate-400 mt-0.5 truncate">
              {isFiltered ? `محاسبه از ${toPersianDigits(filteredList.length)} مشتری فیلترشده` : 'فروش‌ها و بدهی‌های تجمیعی'}
            </div>
          </div>

          {/* 3. Total Payments (مجموع کل دریافتی‌ها) */}
          <div className="bg-white p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl border border-emerald-200 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between text-[11px] sm:text-xs text-emerald-700 font-bold mb-1">
              <span>{isFiltered ? 'دریافتی‌ها (نتایج جستجو)' : 'مجموع کل دریافتی‌ها'}</span>
              <span className="p-1 bg-emerald-50 rounded-lg text-emerald-600">
                <ArrowDownLeft className="w-3.5 h-3.5" />
              </span>
            </div>
            <div className="text-sm sm:text-lg font-black text-emerald-800 font-mono truncate">
              {formatPrice(overallStats.totalAllCredits, settings.currency)}
            </div>
            <div className="text-[9px] sm:text-[10px] text-slate-500 mt-0.5 truncate">
              واریزی‌های نقدی، کارت و چک
            </div>
          </div>

          {/* 4. Filtered / Settled Customers Count */}
          <div className="bg-white p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between text-[11px] sm:text-xs text-slate-600 font-bold mb-1">
              <span>{isFiltered ? 'طرف‌حساب‌های یافت‌شده' : 'کل طرف‌حساب‌ها'}</span>
              <span className="p-1 bg-slate-100 rounded-lg text-slate-600">
                <Users className="w-3.5 h-3.5" />
              </span>
            </div>
            <div className="text-sm sm:text-lg font-black text-slate-800 font-mono truncate">
              {toPersianDigits(filteredList.length)} مشتری
            </div>
            <div className="text-[9px] sm:text-[10px] text-emerald-700 font-bold mt-0.5 truncate">
              {isFiltered
                ? `از کل ${toPersianDigits(customerLedgers.length)} طرف‌حساب (${toPersianDigits(overallStats.settledCount)} تسویه)`
                : `${toPersianDigits(overallStats.settledCount)} مشتری کاملاً تسویه`}
            </div>
          </div>
        </div>

        {/* SEARCH & FILTERS BAR */}
        <div className="no-print p-2.5 sm:p-3.5 border-b border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 bg-white shrink-0">
          {/* Quick Filters */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200 text-xs overflow-x-auto">
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer whitespace-nowrap ${
                statusFilter === 'all' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              همه ({toPersianDigits(customers.length)})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('debtor')}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer whitespace-nowrap ${
                statusFilter === 'debtor' ? 'bg-white text-rose-700 shadow-xs' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              بدهکاران ({toPersianDigits(overallStats.debtorCount)})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('settled')}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer whitespace-nowrap ${
                statusFilter === 'settled' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              تسویه ({toPersianDigits(overallStats.settledCount)})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('creditor')}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer whitespace-nowrap ${
                statusFilter === 'creditor' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              بستانکاران ({toPersianDigits(overallStats.creditorCount)})
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            {/* View Mode Toggle */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200 text-xs">
              <button
                type="button"
                onClick={() => setViewMode('cards')}
                className={`p-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                  viewMode === 'cards' ? 'bg-white text-purple-700 shadow-xs' : 'text-slate-500'
                }`}
                title="نمای کارتی (مناسب موبایل)"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                  viewMode === 'table' ? 'bg-white text-purple-700 shadow-xs' : 'text-slate-500'
                }`}
                title="نمای جدولی (کامل)"
              >
                <LayoutList className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Sort Dropdown */}
            <div className="flex items-center gap-1 text-xs text-slate-600 bg-slate-50 px-2 py-1.5 rounded-xl border border-slate-200 shrink-0">
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="bg-transparent outline-none cursor-pointer font-medium text-[11px]"
              >
                <option value="debt_desc">بیشترین بدهی</option>
                <option value="name">نام الفبایی</option>
              </select>
            </div>

            {/* Search Input */}
            <div className="relative flex-1 sm:w-52">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="جستجو نام، تماس..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-8 pl-3 py-1.5 text-xs text-slate-800 outline-none focus:bg-white focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
              />
            </div>
          </div>
        </div>

        {/* CUSTOMERS STATEMENTS LIST: CARDS FOR MOBILE OR TABLE FOR DESKTOP */}
        <div className="no-print flex-1 overflow-y-auto p-2.5 sm:p-4 md:p-5">
          {viewMode === 'cards' ? (
            /* MOBILE CARDS VIEW */
            <div className="space-y-2.5">
              {filteredList.length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-400">
                  <Users className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                  <p className="text-xs">مشتری با این مشخصات یافت نشد.</p>
                </div>
              ) : (
                filteredList.map(({ customer, ledger }, index) => {
                  return (
                    <div
                      key={customer.id}
                      className="bg-white rounded-2xl border border-slate-200 shadow-xs p-3 hover:border-purple-300 transition-all text-right"
                    >
                      {/* Top Row: Name + Phone + Status Badge */}
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="min-w-0">
                          <h4 className="font-bold text-sm text-slate-900 truncate">
                            {customer.name}
                          </h4>
                          {customer.phone && (
                            <a
                              href={`tel:${customer.phone}`}
                              className="inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-purple-600 font-mono mt-0.5"
                            >
                              <PhoneCall className="w-3 h-3 text-emerald-600" />
                              <span>{toPersianDigits(customer.phone)}</span>
                            </a>
                          )}
                        </div>

                        {/* Balance Badge */}
                        <div>
                          {ledger.balanceStatus === 'debtor' ? (
                            <span className="text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200 px-2.5 py-1 rounded-xl block text-center">
                              بدهکار: {formatPrice(ledger.netBalance, settings.currency)}
                            </span>
                          ) : ledger.balanceStatus === 'creditor' ? (
                            <span className="text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-1 rounded-xl block text-center">
                              طلبکار: {formatPrice(Math.abs(ledger.netBalance), settings.currency)}
                            </span>
                          ) : (
                            <span className="text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-xl block text-center">
                              تسویه کامل
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Middle: Turnover Breakdown */}
                      <div className="grid grid-cols-3 gap-1.5 p-2 bg-slate-50 rounded-xl border border-slate-100 text-center mb-2.5">
                        <div>
                          <span className="text-[9px] text-rose-400 block">جمع بدهی (خریدها)</span>
                          <span className="text-xs font-mono font-bold text-rose-700">
                            {toPersianDigits(ledger.totalDebit.toLocaleString('en-US'))}
                          </span>
                        </div>
                        <div>
                          <span className="text-[9px] text-emerald-400 block">جمع واریزی‌ها</span>
                          <span className="text-xs font-mono font-bold text-emerald-700">
                            {toPersianDigits(ledger.totalCredit.toLocaleString('en-US'))}
                          </span>
                        </div>
                        <div>
                          <span className="text-[9px] text-slate-400 block">تعداد اسناد</span>
                          <span className="text-xs font-mono font-bold text-slate-700">
                            {toPersianDigits(ledger.entries.length)} سند
                          </span>
                        </div>
                      </div>

                      {/* Bottom Button: View Statement & Turnover */}
                      <button
                        type="button"
                        onClick={() => onSelectCustomerForStatement(customer)}
                        className="w-full flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-bold text-purple-800 bg-purple-50 hover:bg-purple-100 active:scale-98 rounded-xl border border-purple-200 transition-all cursor-pointer"
                      >
                        <ReceiptText className="w-3.5 h-3.5 text-purple-600" />
                        <span>مشاهده صورتحساب و ریز گردش مالی</span>
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          ) : (
            /* TABLE VIEW */
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 border-b border-slate-200 font-bold">
                      <th className="py-3 px-3 w-10 text-center">#</th>
                      <th className="py-3 px-3 min-w-[160px]">نام مشتری / طرف‌حساب</th>
                      <th className="py-3 px-3 w-28">شماره تماس</th>
                      <th className="py-3 px-3 min-w-[160px]">نشانی</th>
                      <th className="py-3 px-2 w-20 text-center">تعداد اسناد</th>
                      <th className="py-3 px-3 w-28 text-rose-700">جمع بدهکار</th>
                      <th className="py-3 px-3 w-28 text-emerald-700">جمع بستانکار</th>
                      <th className="py-3 px-3 w-32">مانده حساب</th>
                      <th className="py-3 px-3 w-24">وضعیت</th>
                      <th className="py-3 px-2 w-24 text-center">صورتحساب</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredList.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="py-12 text-center text-slate-400">
                          مشتری با این مشخصات یافت نشد.
                        </td>
                      </tr>
                    ) : (
                      filteredList.map(({ customer, ledger }, index) => {
                        return (
                          <tr
                            key={customer.id}
                            className={`hover:bg-slate-50 transition-colors ${
                              index % 2 === 1 ? 'bg-slate-50/40' : 'bg-white'
                            }`}
                          >
                            <td className="py-2.5 px-3 text-center text-slate-400 font-mono text-[11px]">
                              {toPersianDigits(index + 1)}
                            </td>
                            <td className="py-2.5 px-3">
                              <span className="font-bold text-slate-900 block">{customer.name}</span>
                              {customer.nationalId && (
                                <span className="text-[10px] text-slate-400 font-mono block">
                                  کد ملی: {toPersianDigits(customer.nationalId)}
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 font-mono text-slate-700 text-[11px]">
                              {customer.phone ? toPersianDigits(customer.phone) : '—'}
                            </td>
                            <td className="py-2.5 px-3 text-slate-600 text-[11px] line-clamp-1">
                              {customer.address || '—'}
                            </td>
                            <td className="py-2.5 px-2 text-center font-mono text-slate-700">
                              {toPersianDigits(ledger.entries.length)}
                            </td>
                            <td className="py-2.5 px-3 font-mono font-bold text-rose-700 whitespace-nowrap">
                              {toPersianDigits(ledger.totalDebit.toLocaleString('en-US'))}
                            </td>
                            <td className="py-2.5 px-3 font-mono font-bold text-emerald-700 whitespace-nowrap">
                              {toPersianDigits(ledger.totalCredit.toLocaleString('en-US'))}
                            </td>
                            <td className="py-2.5 px-3 font-mono font-black whitespace-nowrap">
                              <span className={
                                ledger.netBalance > 0
                                  ? 'text-rose-800'
                                  : ledger.netBalance < 0
                                    ? 'text-blue-800'
                                    : 'text-slate-600'
                              }>
                                {toPersianDigits(Math.abs(ledger.netBalance).toLocaleString('en-US'))}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 whitespace-nowrap">
                              {ledger.balanceStatus === 'debtor' ? (
                                <span className="text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 px-2 py-0.5 rounded-md">
                                  بدهکار
                                </span>
                              ) : ledger.balanceStatus === 'creditor' ? (
                                <span className="text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-md">
                                  طلبکار
                                </span>
                              ) : (
                                <span className="text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-md">
                                  بی‌حساب
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-2 text-center whitespace-nowrap">
                              <button
                                type="button"
                                onClick={() => {
                                  onSelectCustomerForStatement(customer);
                                }}
                                className="inline-flex items-center gap-1 bg-purple-50 hover:bg-purple-100 text-purple-800 px-2.5 py-1 rounded-lg text-[11px] font-bold border border-purple-200 transition-colors cursor-pointer"
                                title="مشاهده ریز صورتحساب این مشتری"
                              >
                                <ReceiptText className="w-3.5 h-3.5" />
                                <span>صورتحساب</span>
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* MODAL FOOTER */}
        <div className="no-print p-3 sm:p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-500">
            تعداد طرف‌حساب‌ها: <strong>{toPersianDigits(filteredList.length)}</strong> مشتری
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 sm:px-5 py-1.5 sm:py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-100 cursor-pointer"
          >
            بستن پنجره
          </button>
        </div>

        {/* PRINTABLE REPORT FOR BROWSER PRINT */}
        <div className="print-only hidden p-8 text-black bg-white">
          <div className="border-b-2 border-slate-800 pb-4 mb-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-black text-slate-900">{settings.storeName || 'سیستم صدور فاکتور و حسابداری'}</h1>
                <p className="text-xs text-slate-600 mt-1">{settings.tagline}</p>
                <p className="text-xs text-slate-600 mt-0.5">نشانی: {settings.address} | تلفن: {settings.phone || settings.mobile}</p>
              </div>
              <div className="text-left font-mono text-xs space-y-1">
                <div className="text-base font-bold text-slate-900 font-sans">
                  گزارش وضعیت بدهی و مانده حساب مشتریان {isFiltered ? '(نتایج فیلتر و جستجو)' : ''}
                </div>
                <div>تاریخ گزارش: {toPersianDigits(getCurrentJalaliDate())}</div>
                <div>
                  تعداد طرف‌حساب‌ها: {toPersianDigits(filteredList.length)} {isFiltered ? `(از کل ${toPersianDigits(customerLedgers.length)})` : ''}
                </div>
                {searchQuery.trim() && <div>عبارت جستجو: «{searchQuery.trim()}»</div>}
              </div>
            </div>
          </div>

          {/* Overall Stats Table */}
          <div className="grid grid-cols-4 gap-3 text-center text-xs mb-6 border border-slate-300 p-3 rounded-xl bg-slate-50">
            <div>
              <div className="text-slate-500">کل طلب‌های وصول‌نشده</div>
              <div className="font-bold text-rose-700 font-mono mt-1">{formatPrice(overallStats.totalReceivables, settings.currency)}</div>
            </div>
            <div>
              <div className="text-slate-500">کل فاکتورها و خریدها</div>
              <div className="font-bold text-slate-800 font-mono mt-1">{formatPrice(overallStats.totalAllDebits, settings.currency)}</div>
            </div>
            <div>
              <div className="text-slate-500">کل دریافتی‌ها و واریزها</div>
              <div className="font-bold text-emerald-700 font-mono mt-1">{formatPrice(overallStats.totalAllCredits, settings.currency)}</div>
            </div>
            <div>
              <div className="text-slate-500">مشتریان بدهکار</div>
              <div className="font-bold text-slate-800 font-mono mt-1">{toPersianDigits(overallStats.debtorCount)} نفر</div>
            </div>
          </div>

          <table className="w-full text-right text-xs border border-slate-300 border-collapse mb-6">
            <thead>
              <tr className="bg-slate-200 text-slate-900 font-bold border-b border-slate-300">
                <th className="py-2 px-2 border-l border-slate-300 text-center w-8">#</th>
                <th className="py-2 px-2 border-l border-slate-300">نام مشتری</th>
                <th className="py-2 px-2 border-l border-slate-300 w-28">شماره تماس</th>
                <th className="py-2 px-2 border-l border-slate-300 text-center w-16">اسناد</th>
                <th className="py-2 px-2 border-l border-slate-300 w-28">جمع بدهکار</th>
                <th className="py-2 px-2 border-l border-slate-300 w-28">جمع بستانکار</th>
                <th className="py-2 px-2 border-l border-slate-300 w-32">مانده حساب</th>
                <th className="py-2 px-2 w-20 text-center">وضعیت</th>
              </tr>
            </thead>
            <tbody>
              {filteredList.map(({ customer, ledger }, idx) => (
                <tr key={customer.id} className="border-b border-slate-200 text-[11px]">
                  <td className="py-1.5 px-2 border-l border-slate-200 text-center font-mono">{toPersianDigits(idx + 1)}</td>
                  <td className="py-1.5 px-2 border-l border-slate-200 font-bold">{customer.name}</td>
                  <td className="py-1.5 px-2 border-l border-slate-200 font-mono">{customer.phone ? toPersianDigits(customer.phone) : '—'}</td>
                  <td className="py-1.5 px-2 border-l border-slate-200 text-center font-mono">{toPersianDigits(ledger.entries.length)}</td>
                  <td className="py-1.5 px-2 border-l border-slate-200 font-mono">{toPersianDigits(ledger.totalDebit.toLocaleString('en-US'))}</td>
                  <td className="py-1.5 px-2 border-l border-slate-200 font-mono">{toPersianDigits(ledger.totalCredit.toLocaleString('en-US'))}</td>
                  <td className="py-1.5 px-2 border-l border-slate-200 font-mono font-bold">
                    {toPersianDigits(Math.abs(ledger.netBalance).toLocaleString('en-US'))}
                  </td>
                  <td className="py-1.5 px-2 text-center font-bold">
                    {ledger.balanceStatus === 'debtor' ? 'بدهکار' : ledger.balanceStatus === 'creditor' ? 'طلبکار' : 'تسویه'}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-slate-100 font-bold text-slate-900 border-t-2 border-slate-400">
                <td colSpan={4} className="py-2 px-2 text-left">
                  جمع کل ({settings.currency}):
                </td>
                <td className="py-2 px-2 border-l border-slate-300 font-mono">
                  {toPersianDigits(overallStats.totalAllDebits.toLocaleString('en-US'))}
                </td>
                <td className="py-2 px-2 border-l border-slate-300 font-mono">
                  {toPersianDigits(overallStats.totalAllCredits.toLocaleString('en-US'))}
                </td>
                <td className="py-2 px-2 border-l border-slate-300 font-mono">
                  {toPersianDigits(overallStats.totalReceivables.toLocaleString('en-US'))} (طلب)
                </td>
                <td className="py-2 px-2 text-center text-rose-700">
                  {toPersianDigits(overallStats.debtorCount)} بدهکار
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

      </div>

      {/* OFFSCREEN FULL-FIDELITY PDF REPORT CONTAINER FOR HTML2CANVAS */}
      <div style={{ position: 'absolute', left: '-9999px', top: '0', zIndex: -100 }}>
        <div
          id="printable-customer-statements-report-pdf"
          dir="rtl"
          style={{
            width: '1100px',
            backgroundColor: '#ffffff',
            padding: '24px',
            fontFamily: "'Vazirmatn', -apple-system, BlinkMacSystemFont, sans-serif",
            color: '#0f172a',
            boxSizing: 'border-box',
          }}
        >
          {/* Header */}
          <div
            style={{
              borderBottom: '2px solid #1e293b',
              paddingBottom: '12px',
              marginBottom: '16px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div>
              <div style={{ fontSize: '18px', fontWeight: '900', color: '#0f172a' }}>
                {settings.storeName || 'سامانه یکپارچه فروش و حسابداری'}
              </div>
              <div style={{ fontSize: '11px', color: '#475569', marginTop: '3px' }}>
                گزارش تجمیعی مانده حساب و وضعیت مالی مشتریان
              </div>
              <div style={{ fontSize: '10px', color: '#64748b', marginTop: '2px' }}>
                {settings.address ? `نشانی: ${settings.address}` : ''}
                {settings.phone ? ` | تلفن: ${toPersianDigits(settings.phone)}` : ''}
              </div>
            </div>

            <div
              style={{
                border: '1px solid #94a3b8',
                borderRadius: '6px',
                padding: '6px 12px',
                fontSize: '10px',
                lineHeight: '1.7',
                textAlign: 'left',
              }}
            >
              <div><strong>تاریخ تنظیم: </strong>{toPersianDigits(getCurrentJalaliDate())}</div>
              <div>
                <strong>تعداد مشتریان: </strong>
                {toPersianDigits(filteredList.length)} نفر
                {isFiltered ? ` (از کل ${toPersianDigits(customerLedgers.length)})` : ''}
              </div>
              {searchQuery.trim() && (
                <div style={{ color: '#0369a1' }}>
                  <strong>جستجو: </strong>«{searchQuery.trim()}»
                </div>
              )}
              {statusFilter !== 'all' && (
                <div style={{ color: '#0369a1' }}>
                  <strong>فیلتر وضعیت: </strong>
                  {statusFilter === 'debtor' ? 'بدهکاران' : statusFilter === 'creditor' ? 'بستانکاران' : 'تسویه شده'}
                </div>
              )}
            </div>
          </div>

          {/* KPI Strip */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '10px',
              marginBottom: '16px',
              textAlign: 'center',
            }}
          >
            <div style={{ border: '1px solid #fecdd3', backgroundColor: '#fff1f2', padding: '10px', borderRadius: '8px' }}>
              <div style={{ fontSize: '10px', color: '#9f1239', fontWeight: 'bold' }}>
                {isFiltered ? 'طلب‌های نتایج جستجو' : 'کل طلب‌های وصول‌نشده'}
              </div>
              <div style={{ fontSize: '14px', fontWeight: '900', color: '#881337', fontFamily: 'monospace', marginTop: '4px' }}>
                {formatPrice(overallStats.totalReceivables, settings.currency)}
              </div>
              <div style={{ fontSize: '9px', color: '#9f1239', marginTop: '2px' }}>
                {toPersianDigits(overallStats.debtorCount)} مشتری بدهکار
              </div>
            </div>

            <div style={{ border: '1px solid #e2e8f0', backgroundColor: '#f8fafc', padding: '10px', borderRadius: '8px' }}>
              <div style={{ fontSize: '10px', color: '#475569', fontWeight: 'bold' }}>
                {isFiltered ? 'خریدها (نتایج جستجو)' : 'مجموع کل خریدها'}
              </div>
              <div style={{ fontSize: '14px', fontWeight: '900', color: '#0f172a', fontFamily: 'monospace', marginTop: '4px' }}>
                {formatPrice(overallStats.totalAllDebits, settings.currency)}
              </div>
              <div style={{ fontSize: '9px', color: '#64748b', marginTop: '2px' }}>
                فروش‌ها و بدهی‌های ثبت‌شده
              </div>
            </div>

            <div style={{ border: '1px solid #a7f3d0', backgroundColor: '#ecfdf5', padding: '10px', borderRadius: '8px' }}>
              <div style={{ fontSize: '10px', color: '#065f46', fontWeight: 'bold' }}>
                {isFiltered ? 'دریافتی‌ها (نتایج جستجو)' : 'مجموع کل دریافتی‌ها'}
              </div>
              <div style={{ fontSize: '14px', fontWeight: '900', color: '#064e3b', fontFamily: 'monospace', marginTop: '4px' }}>
                {formatPrice(overallStats.totalAllCredits, settings.currency)}
              </div>
              <div style={{ fontSize: '9px', color: '#065f46', marginTop: '2px' }}>
                واریزی‌های نقدی، کارت و چک
              </div>
            </div>

            <div style={{ border: '1px solid #cbd5e1', backgroundColor: '#f1f5f9', padding: '10px', borderRadius: '8px' }}>
              <div style={{ fontSize: '10px', color: '#334155', fontWeight: 'bold' }}>
                {isFiltered ? 'مشتریان یافت‌شده' : 'کل مشتریان'}
              </div>
              <div style={{ fontSize: '14px', fontWeight: '900', color: '#0f172a', fontFamily: 'monospace', marginTop: '4px' }}>
                {toPersianDigits(filteredList.length)} مشتری
              </div>
              <div style={{ fontSize: '9px', color: '#475569', marginTop: '2px' }}>
                {toPersianDigits(overallStats.settledCount)} تسویه | {toPersianDigits(overallStats.debtorCount)} بدهکار
              </div>
            </div>
          </div>

          {/* Table */}
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px', border: '1px solid #64748b' }}>
            <thead>
              <tr style={{ backgroundColor: '#e2e8f0', color: '#0f172a', fontWeight: '900' }}>
                <th style={{ padding: '8px 4px', border: '1px solid #64748b', textAlign: 'center', width: '35px' }}>#</th>
                <th style={{ padding: '8px 8px', border: '1px solid #64748b', textAlign: 'right' }}>نام مشتری / شرکت</th>
                <th style={{ padding: '8px 8px', border: '1px solid #64748b', textAlign: 'center', width: '95px' }}>شماره تماس</th>
                <th style={{ padding: '8px 8px', border: '1px solid #64748b', textAlign: 'right' }}>نشانی</th>
                <th style={{ padding: '8px 4px', border: '1px solid #64748b', textAlign: 'center', width: '45px' }}>اسناد</th>
                <th style={{ padding: '8px 6px', border: '1px solid #64748b', textAlign: 'center', width: '100px', color: '#991b1b' }}>جمع بدهکار ({settings.currency})</th>
                <th style={{ padding: '8px 6px', border: '1px solid #64748b', textAlign: 'center', width: '100px', color: '#065f46' }}>جمع بستانکار ({settings.currency})</th>
                <th style={{ padding: '8px 6px', border: '1px solid #64748b', textAlign: 'center', width: '105px' }}>مانده حساب</th>
                <th style={{ padding: '8px 4px', border: '1px solid #64748b', textAlign: 'center', width: '55px' }}>وضعیت</th>
              </tr>
            </thead>
            <tbody>
              {filteredList.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ padding: '24px', textAlign: 'center', color: '#64748b', border: '1px solid #94a3b8' }}>
                    مشتری با این مشخصات یافت نشد.
                  </td>
                </tr>
              ) : (
                filteredList.map(({ customer, ledger }, idx) => (
                  <tr key={`pdf-rpt-${customer.id}`} style={{ backgroundColor: idx % 2 === 1 ? '#f8fafc' : '#ffffff' }}>
                    <td style={{ padding: '6px 4px', border: '1px solid #94a3b8', textAlign: 'center', fontFamily: 'monospace' }}>
                      {toPersianDigits(idx + 1)}
                    </td>
                    <td style={{ padding: '6px 8px', border: '1px solid #94a3b8', fontWeight: 'bold' }}>
                      {customer.name}
                      {customer.nationalId && (
                        <span style={{ fontSize: '8.5px', color: '#64748b', display: 'block', fontFamily: 'monospace' }}>
                          کد ملی: {toPersianDigits(customer.nationalId)}
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '6px 8px', border: '1px solid #94a3b8', textAlign: 'center', fontFamily: 'monospace' }}>
                      {customer.phone ? toPersianDigits(customer.phone) : '—'}
                    </td>
                    <td style={{ padding: '6px 8px', border: '1px solid #94a3b8', color: '#475569', fontSize: '9px' }}>
                      {customer.address || '—'}
                    </td>
                    <td style={{ padding: '6px 4px', border: '1px solid #94a3b8', textAlign: 'center', fontFamily: 'monospace' }}>
                      {toPersianDigits(ledger.entries.length)}
                    </td>
                    <td style={{ padding: '6px 6px', border: '1px solid #94a3b8', textAlign: 'center', fontFamily: 'monospace', fontWeight: 'bold', color: '#991b1b' }}>
                      {toPersianDigits(ledger.totalDebit.toLocaleString('en-US'))}
                    </td>
                    <td style={{ padding: '6px 6px', border: '1px solid #94a3b8', textAlign: 'center', fontFamily: 'monospace', fontWeight: 'bold', color: '#065f46' }}>
                      {toPersianDigits(ledger.totalCredit.toLocaleString('en-US'))}
                    </td>
                    <td style={{ padding: '6px 6px', border: '1px solid #94a3b8', textAlign: 'center', fontFamily: 'monospace', fontWeight: '800' }}>
                      {toPersianDigits(Math.abs(ledger.netBalance).toLocaleString('en-US'))}
                    </td>
                    <td
                      style={{
                        padding: '6px 4px',
                        border: '1px solid #94a3b8',
                        textAlign: 'center',
                        fontWeight: 'bold',
                        color: ledger.balanceStatus === 'debtor' ? '#991b1b' : ledger.balanceStatus === 'creditor' ? '#1e40af' : '#065f46',
                      }}
                    >
                      {ledger.balanceStatus === 'debtor' ? 'بدهکار' : ledger.balanceStatus === 'creditor' ? 'طلبکار' : 'تسویه'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            <tfoot>
              <tr style={{ backgroundColor: '#e2e8f0', fontWeight: '900', color: '#0f172a' }}>
                <td colSpan={5} style={{ padding: '8px 10px', border: '1px solid #64748b', textAlign: 'left' }}>
                  {isFiltered ? `جمع نتایج جستجو (${toPersianDigits(filteredList.length)} مشتری):` : 'جمع کل همه طرف‌حساب‌ها:'}
                </td>
                <td style={{ padding: '8px 6px', border: '1px solid #64748b', textAlign: 'center', fontFamily: 'monospace', color: '#991b1b' }}>
                  {toPersianDigits(overallStats.totalAllDebits.toLocaleString('en-US'))}
                </td>
                <td style={{ padding: '8px 6px', border: '1px solid #64748b', textAlign: 'center', fontFamily: 'monospace', color: '#065f46' }}>
                  {toPersianDigits(overallStats.totalAllCredits.toLocaleString('en-US'))}
                </td>
                <td style={{ padding: '8px 6px', border: '1px solid #64748b', textAlign: 'center', fontFamily: 'monospace' }}>
                  {toPersianDigits(overallStats.totalReceivables.toLocaleString('en-US'))} (طلب)
                </td>
                <td style={{ padding: '8px 4px', border: '1px solid #64748b', textAlign: 'center' }}>
                  {toPersianDigits(overallStats.debtorCount)} بدهکار
                </td>
              </tr>
            </tfoot>
          </table>

          {/* Signature / Certification Footer */}
          <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#475569' }}>
            <div>
              <span>تهیه و تنظیم گزارش: حسابداری</span>
            </div>
            <div>
              <span>تایید مدیریت مالی / فروشگاه: ................................</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
