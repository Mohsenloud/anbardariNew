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
  LayoutList
} from 'lucide-react';
import { Customer, Invoice, StoreSettings, CustomerTransaction } from '../types';
import { StorageService } from '../utils/storage';
import { formatPrice, toPersianDigits, getCurrentJalaliDate } from '../utils/jalali';
import { exportAllCustomerStatementsToExcel } from '../utils/excelHelper';

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
  if (!isOpen) return null;

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'debtor' | 'settled' | 'creditor'>('all');
  const [sortBy, setSortBy] = useState<'debt_desc' | 'name' | 'activity'>('debt_desc');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');

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

  // High-level KPIs across all customers
  const overallStats = useMemo(() => {
    let totalReceivables = 0; // بدهی مشتریان به فروشگاه (طلب‌های ما)
    let totalPayables = 0;    // بستانکاری مشتریان از ما
    let totalAllDebits = 0;
    let totalAllCredits = 0;
    let debtorCount = 0;
    let settledCount = 0;
    let creditorCount = 0;

    customerLedgers.forEach(({ ledger }) => {
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
    };
  }, [customerLedgers]);

  // Filtered & Sorted Customer list
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

  const handlePrint = () => {
    window.print();
  };

  const handleExportExcel = () => {
    exportAllCustomerStatementsToExcel(customers, invoices, transactions, settings);
  };

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
              id="export-all-statements-excel-btn"
              onClick={handleExportExcel}
              className="flex items-center gap-1 bg-purple-600 hover:bg-purple-700 active:scale-95 text-white p-2 sm:px-3 sm:py-1.5 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
              title="خروجی اکسل کامل"
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

        {/* OVERALL FINANCIAL STATS CARDS */}
        <div className="no-print p-2.5 sm:p-4 bg-slate-50/80 border-b border-slate-200/80 grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 shrink-0">
          {/* 1. Total Receivables (کل طلب‌های وصول نشده) */}
          <div className="bg-white p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl border border-rose-200 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between text-[11px] sm:text-xs text-rose-700 font-bold mb-1">
              <span>کل طلب‌های وصول‌نشده</span>
              <span className="p-1 bg-rose-50 rounded-lg">
                <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
              </span>
            </div>
            <div className="text-sm sm:text-lg font-black text-rose-800 font-mono truncate">
              {formatPrice(overallStats.totalReceivables, settings.currency)}
            </div>
            <div className="text-[9px] sm:text-[10px] text-slate-500 mt-0.5 truncate">
              {toPersianDigits(overallStats.debtorCount)} طرف‌حساب بدهکار
            </div>
          </div>

          {/* 2. Total Invoiced (کل بدهکاری‌های ثبت‌شده) */}
          <div className="bg-white p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between text-[11px] sm:text-xs text-slate-600 font-bold mb-1">
              <span>مجموع کل خریدها</span>
              <span className="p-1 bg-slate-100 rounded-lg text-slate-600">
                <ArrowUpRight className="w-3.5 h-3.5" />
              </span>
            </div>
            <div className="text-sm sm:text-lg font-black text-slate-800 font-mono truncate">
              {formatPrice(overallStats.totalAllDebits, settings.currency)}
            </div>
            <div className="text-[9px] sm:text-[10px] text-slate-400 mt-0.5 truncate">
              فروش‌ها و بدهی‌های تجمیعی
            </div>
          </div>

          {/* 3. Total Payments (مجموع کل دریافتی‌ها) */}
          <div className="bg-white p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl border border-emerald-200 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between text-[11px] sm:text-xs text-emerald-700 font-bold mb-1">
              <span>مجموع کل دریافتی‌ها</span>
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

          {/* 4. Settled Customers Count */}
          <div className="bg-white p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between text-[11px] sm:text-xs text-slate-600 font-bold mb-1">
              <span>کل طرف‌حساب‌ها</span>
              <span className="p-1 bg-slate-100 rounded-lg text-slate-600">
                <Users className="w-3.5 h-3.5" />
              </span>
            </div>
            <div className="text-sm sm:text-lg font-black text-slate-800 font-mono truncate">
              {toPersianDigits(customers.length)} مشتری
            </div>
            <div className="text-[9px] sm:text-[10px] text-emerald-700 font-bold mt-0.5 truncate">
              {toPersianDigits(overallStats.settledCount)} مشتری کاملاً تسویه
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

        {/* PRINTABLE REPORT */}
        <div className="print-only hidden p-8 text-black bg-white">
          <div className="border-b-2 border-slate-800 pb-4 mb-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-black text-slate-900">{settings.storeName || 'سیستم صدور فاکتور و حسابداری'}</h1>
                <p className="text-xs text-slate-600 mt-1">{settings.tagline}</p>
                <p className="text-xs text-slate-600 mt-0.5">نشانی: {settings.address} | تلفن: {settings.phone || settings.mobile}</p>
              </div>
              <div className="text-left font-mono text-xs space-y-1">
                <div className="text-base font-bold text-slate-900 font-sans">گزارش وضعیت بدهی و صورتحساب مشتریان</div>
                <div>تاریخ گزارش: {toPersianDigits(getCurrentJalaliDate())}</div>
                <div>تعداد کل طرف‌حساب‌ها: {toPersianDigits(customers.length)}</div>
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
          </table>
        </div>

      </div>
    </div>
  );
};
