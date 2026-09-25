import React, { useState, useMemo } from 'react';
import { Customer, Invoice, StoreSettings, AppUser, CustomerTransaction } from '../types';
import { formatPrice, toPersianDigits, getCurrentJalaliDate } from '../utils/jalali';
import { StorageService } from '../utils/storage';
import { exportCustomersToExcel, exportPersonInvoicesAndExitSlipsToExcel } from '../utils/excelHelper';
import { ExcelImportModal } from './ExcelImportModal';
import { CustomerExportModal } from './CustomerExportModal';
import { CustomerBulkPaymentModal } from './CustomerBulkPaymentModal';
import { CustomerStatementModal } from './CustomerStatementModal';
import { CustomerStatementsReportModal } from './CustomerStatementsReportModal';
import { 
  Users, 
  Search, 
  UserPlus, 
  Phone, 
  MapPin, 
  ReceiptText, 
  Edit3, 
  Trash2, 
  Plus,
  X,
  CheckCircle2,
  FileSpreadsheet,
  Download,
  Upload,
  CreditCard,
  AlertCircle,
  List,
  LayoutGrid,
  ArrowUpDown,
  ChevronDown,
  FileText,
  Eye,
  User,
  Calendar,
  Copy,
  Check
} from 'lucide-react';

interface CustomersManagerProps {
  customers: Customer[];
  invoices: Invoice[];
  transactions?: CustomerTransaction[];
  settings: StoreSettings;
  currentUser?: AppUser;
  onSaveCustomer: (customer: Customer) => void;
  onDeleteCustomer: (customerId: string) => void;
  onSelectCustomerForInvoice: (customer: Customer) => void;
  onImportCustomers?: (customers: Customer[], mode: 'merge' | 'replace') => void;
  onBatchUpdatePaymentStatus?: (
    updates: { invoiceId: string; status: 'paid' | 'unpaid' | 'partial'; paidAmount: number }[],
    details?: string
  ) => void;
  onSaveTransaction?: (txn: CustomerTransaction, autoSettleInvoices?: boolean) => void;
  onDeleteTransaction?: (txnId: string) => void;
  onViewInvoice?: (invoice: Invoice) => void;
}

export const CustomersManager: React.FC<CustomersManagerProps> = ({
  customers,
  invoices,
  transactions = [],
  settings,
  currentUser,
  onSaveCustomer,
  onDeleteCustomer,
  onSelectCustomerForInvoice,
  onImportCustomers,
  onBatchUpdatePaymentStatus,
  onSaveTransaction,
  onDeleteTransaction,
  onViewInvoice,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportModalCustomer, setExportModalCustomer] = useState<Customer | null>(null);
  const [paymentModalCustomer, setPaymentModalCustomer] = useState<Customer | null>(null);
  const [statementCustomer, setStatementCustomer] = useState<Customer | null>(null);
  const [detailCustomer, setDetailCustomer] = useState<Customer | null>(null);
  const [isStatementsReportOpen, setIsStatementsReportOpen] = useState(false);

  // View Mode: 'table' (ردیفی) is default, with 'grid' (کارتی) option
  const [viewMode, setViewMode] = useState<'table' | 'grid'>(() => {
    return (localStorage.getItem('customers_view_mode') as 'table' | 'grid') || 'table';
  });
  const [statusFilter, setStatusFilter] = useState<'all' | 'debtors' | 'creditors' | 'settled'>('all');
  const [sortBy, setSortBy] = useState<'name-asc' | 'debt-desc' | 'orders-desc' | 'newest'>('name-asc');

  const handleToggleViewMode = (mode: 'table' | 'grid') => {
    setViewMode(mode);
    localStorage.setItem('customers_view_mode', mode);
  };

  // Pre-calculate ledger & metrics for each customer
  const customerMetrics = useMemo(() => {
    const map = new Map<string, {
      invoices: Invoice[];
      totalSpent: number;
      ledger: ReturnType<typeof StorageService.buildCustomerLedger>;
      hasDebt: boolean;
      hasCredit: boolean;
      isSettled: boolean;
    }>();

    customers.forEach((cust) => {
      const custInvoices = invoices.filter((i) => i.customerId === cust.id || i.customerName?.trim().toLowerCase() === cust.name?.trim().toLowerCase());
      const totalSpent = custInvoices.reduce((sum, i) => sum + (Number(i.finalTotal) || 0), 0);
      const ledger = StorageService.buildCustomerLedger(cust, invoices, transactions);
      const hasDebt = ledger.netBalance > 0;
      const hasCredit = ledger.netBalance < 0;
      const isSettled = (custInvoices.length > 0 || ledger.entries.length > 0) && ledger.netBalance === 0;

      map.set(cust.id, {
        invoices: custInvoices,
        totalSpent,
        ledger,
        hasDebt,
        hasCredit,
        isSettled,
      });
    });

    return map;
  }, [customers, invoices, transactions]);

  // Overall counts for filter badges
  const totalDebtorsCount = useMemo(() => {
    let count = 0;
    customerMetrics.forEach((m) => {
      if (m.hasDebt) count++;
    });
    return count;
  }, [customerMetrics]);

  const totalCreditorsCount = useMemo(() => {
    let count = 0;
    customerMetrics.forEach((m) => {
      if (m.hasCredit) count++;
    });
    return count;
  }, [customerMetrics]);

  const totalSettledCount = useMemo(() => {
    let count = 0;
    customerMetrics.forEach((m) => {
      if (m.isSettled) count++;
    });
    return count;
  }, [customerMetrics]);

  // Filter & Sort customers
  const filteredCustomers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return customers
      .filter((c) => {
        // Search query
        if (q) {
          const matchName = (c.name || '').toLowerCase().includes(q);
          const matchPhone = c.phone ? c.phone.includes(q) : false;
          const matchNationalId = c.nationalId ? c.nationalId.includes(q) : false;
          const matchAddress = c.address ? c.address.toLowerCase().includes(q) : false;
          if (!matchName && !matchPhone && !matchNationalId && !matchAddress) {
            return false;
          }
        }

        // Status filter
        const m = customerMetrics.get(c.id);
        if (statusFilter === 'debtors') {
          return m?.hasDebt;
        }
        if (statusFilter === 'creditors') {
          return m?.hasCredit;
        }
        if (statusFilter === 'settled') {
          return m?.isSettled;
        }

        return true;
      })
      .sort((a, b) => {
        const mA = customerMetrics.get(a.id);
        const mB = customerMetrics.get(b.id);

        if (sortBy === 'name-asc') {
          return (a.name || '').localeCompare(b.name || '', 'fa');
        }
        if (sortBy === 'debt-desc') {
          const balA = mA?.hasDebt ? mA.ledger.netBalance : 0;
          const balB = mB?.hasDebt ? mB.ledger.netBalance : 0;
          return balB - balA;
        }
        if (sortBy === 'orders-desc') {
          const ordA = mA?.invoices.length || 0;
          const ordB = mB?.invoices.length || 0;
          return ordB - ordA;
        }
        if (sortBy === 'newest') {
          return (b.createdAt || '').localeCompare(a.createdAt || '');
        }
        return 0;
      });
  }, [customers, searchQuery, statusFilter, sortBy, customerMetrics]);

  const handleOpenNew = () => {
    setEditingCustomer({
      id: '',
      name: '',
      phone: '',
      nationalId: '',
      address: '',
      notes: '',
      createdAt: getCurrentJalaliDate(),
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (cust: Customer) => {
    setEditingCustomer({ ...cust });
    setIsModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCustomer || !editingCustomer.name.trim()) return;

    const saved: Customer = {
      ...editingCustomer,
      id: editingCustomer.id || `cust-${Date.now()}`,
      name: editingCustomer.name.trim(),
      phone: editingCustomer.phone?.trim() || '',
      nationalId: editingCustomer.nationalId?.trim() || '',
      address: editingCustomer.address?.trim() || '',
      notes: editingCustomer.notes?.trim() || '',
      createdAt: editingCustomer.createdAt || getCurrentJalaliDate(),
    };

    onSaveCustomer(saved);
    setIsModalOpen(false);
    setEditingCustomer(null);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-purple-50 text-purple-700">
              <Users className="w-5 h-5" />
            </span>
            <h2 className="text-xl font-bold text-slate-800">مدیریت مشتریان و خریداران</h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            دفترچه مشتریان، تاریخچه خریدها و ثبت سریع فاکتور برای مشتری
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto shrink-0 flex-wrap">
          <button
            type="button"
            id="open-customer-statements-report-btn"
            onClick={() => setIsStatementsReportOpen(true)}
            title="مشاهده گزارش کلی بدهکاران، واریزی‌ها و صورتحساب همه مشتریان"
            className="flex items-center gap-1.5 bg-purple-600 hover:bg-purple-700 active:scale-95 text-white px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-sm shadow-purple-200 cursor-pointer"
          >
            <ReceiptText className="w-4 h-4" />
            <span>گزارش صورتحساب مشتریان</span>
          </button>

          <button
            type="button"
            id="export-person-invoices-slips-btn"
            onClick={() => {
              setExportModalCustomer(null);
              setIsExportModalOpen(true);
            }}
            title="خروجی فاکتورها و حواله‌های خروج یک شخص با جزییات کامل اکسل"
            className="flex items-center gap-1.5 bg-purple-50 hover:bg-purple-100 active:scale-95 text-purple-800 border border-purple-300 px-3 py-2 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-purple-600" />
            <span>اکسپورت اسناد و حواله‌های شخص</span>
          </button>

          <button
            type="button"
            id="export-customers-excel-btn"
            onClick={() => exportCustomersToExcel(customers)}
            title="خروجی فایل اکسل مشتریان"
            className="flex items-center gap-1.5 bg-white hover:bg-slate-50 active:scale-95 text-slate-700 border border-slate-300 px-3 py-2 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span className="hidden sm:inline">خروجی اکسل مشتریان</span>
          </button>

          <button
            type="button"
            id="import-customers-excel-btn"
            onClick={() => setIsImportModalOpen(true)}
            title="ورود مشتریان از فایل اکسل"
            className="flex items-center gap-1.5 bg-emerald-50 hover:bg-emerald-100 active:scale-95 text-emerald-800 border border-emerald-300 px-3 py-2 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span>ورود از اکسل</span>
          </button>

          <button
            id="add-customer-btn"
            onClick={handleOpenNew}
            className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-sm shadow-emerald-200 cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>مشتری جدید</span>
          </button>
        </div>
      </div>

      {/* Customer List Card */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        {/* Search, Sort, Filter & View Mode Toolbar */}
        <div className="p-3.5 sm:p-4 border-b border-slate-200/80 bg-slate-50/70 space-y-3">
          {/* Top Tier: Search, View Mode Toggle, and Sort */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                id="customer-search-input"
                placeholder="جستجو در نام، شماره تلفن، کد ملی یا آدرس..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl pr-9 pl-8 py-2 text-xs text-slate-800 focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none transition-all"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-full hover:bg-slate-100 cursor-pointer"
                  title="پاک کردن جستجو"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Right Controls: Sort & View Mode Switcher */}
            <div className="flex items-center gap-2 self-end sm:self-auto flex-wrap">
              {/* Sort Dropdown */}
              <div className="relative w-36 sm:w-44">
                <select
                  id="customer-sort-select"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="w-full appearance-none bg-white border border-slate-200 rounded-xl pr-7 pl-6 py-2 text-[11px] font-bold text-slate-700 focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none cursor-pointer"
                >
                  <option value="name-asc">نام (الفبا)</option>
                  <option value="debt-desc">بیشترین بدهی</option>
                  <option value="orders-desc">بیشترین سفارش</option>
                  <option value="newest">جدیدترین مشتریان</option>
                </select>
                <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>

              {/* View Mode Toggle Switcher */}
              <div className="flex items-center bg-slate-200/80 p-0.5 rounded-xl border border-slate-300/60 text-xs">
                <button
                  type="button"
                  id="customers-view-table-btn"
                  onClick={() => handleToggleViewMode('table')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold text-xs transition-all cursor-pointer ${
                    viewMode === 'table'
                      ? 'bg-white text-purple-800 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="نمایش ردیفی (جدولی)"
                >
                  <List className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">ردیفی</span>
                </button>
                <button
                  type="button"
                  id="customers-view-grid-btn"
                  onClick={() => handleToggleViewMode('grid')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold text-xs transition-all cursor-pointer ${
                    viewMode === 'grid'
                      ? 'bg-white text-purple-800 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="نمایش کارتی"
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">کارتی</span>
                </button>
              </div>
            </div>
          </div>

          {/* Bottom Tier: Filter Chips & Summary Count */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-200/60">
            {/* Filter Chips */}
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <button
                type="button"
                id="filter-cust-all"
                onClick={() => setStatusFilter('all')}
                className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                  statusFilter === 'all'
                    ? 'bg-slate-900 text-white shadow-2xs'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                همه ({toPersianDigits(customers.length)})
              </button>

              <button
                type="button"
                id="filter-cust-debtors"
                onClick={() => setStatusFilter('debtors')}
                className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  statusFilter === 'debtors'
                    ? 'bg-rose-600 text-white shadow-2xs'
                    : 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100'
                }`}
              >
                <span>دارای بدهی</span>
                <span className="bg-white/30 text-current px-1.5 py-0.2 rounded-full text-[10px] font-mono">
                  {toPersianDigits(totalDebtorsCount)}
                </span>
              </button>

              <button
                type="button"
                id="filter-cust-creditors"
                onClick={() => setStatusFilter('creditors')}
                className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  statusFilter === 'creditors'
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100'
                }`}
              >
                <span>بستانکاران</span>
                <span className="bg-white/30 text-current px-1.5 py-0.2 rounded-full text-[10px] font-mono">
                  {toPersianDigits(totalCreditorsCount)}
                </span>
              </button>

              <button
                type="button"
                id="filter-cust-settled"
                onClick={() => setStatusFilter('settled')}
                className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  statusFilter === 'settled'
                    ? 'bg-emerald-600 text-white shadow-2xs'
                    : 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                }`}
              >
                <span>تسویه‌شده</span>
                <span className="bg-white/30 text-current px-1.5 py-0.2 rounded-full text-[10px] font-mono">
                  {toPersianDigits(totalSettledCount)}
                </span>
              </button>
            </div>

            {/* Total Counter */}
            <div className="text-[11px] text-slate-500 font-medium">
              نمایش <strong className="text-slate-800 font-mono">{toPersianDigits(filteredCustomers.length)}</strong> از <strong className="text-slate-800 font-mono">{toPersianDigits(customers.length)}</strong> مشتری
            </div>
          </div>
        </div>

        {/* Empty State */}
        {filteredCustomers.length === 0 ? (
          <div className="text-center py-16 text-slate-400 space-y-3 p-6">
            <Users className="w-12 h-12 mx-auto text-slate-300" />
            <div className="text-sm font-bold text-slate-600">هیچ مشتری با این مشخصات یافت نشد</div>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              می‌توانید عبارت جستجو یا فیلتر وضعیت بدهی را تغییر دهید یا مشتری جدید ثبت نمایید.
            </p>
            {(searchQuery || statusFilter !== 'all') && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setStatusFilter('all');
                }}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                پاک کردن فیلترها
              </button>
            )}
          </div>
        ) : viewMode === 'table' ? (
          /* ========================================================
             ROW / TABLE VIEW (نمایش ردیفی مشتریان)
             ======================================================== */
          <div>
            {/* Desktop Table View */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-right border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100/80 text-slate-700 border-b border-slate-200 select-none">
                    <th className="py-3.5 px-3 font-bold text-center w-12">#</th>
                    <th className="py-3.5 px-3 font-bold">نام خریدار / مشتری</th>
                    <th className="py-3.5 px-3 font-bold">شماره تماس</th>
                    <th className="py-3.5 px-3 font-bold text-left">مانده حساب و وضعیت مالی</th>
                    <th className="py-3.5 px-3 font-bold text-center w-72">عملیات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredCustomers.map((cust, index) => {
                    const m = customerMetrics.get(cust.id);
                    const customerInvoices = m?.invoices || [];
                    const totalSpent = m?.totalSpent || 0;
                    const custLedger = m?.ledger || StorageService.buildCustomerLedger(cust, invoices, transactions);
                    const hasDebt = m?.hasDebt ?? (custLedger.netBalance > 0);
                    const hasCredit = m?.hasCredit ?? (custLedger.netBalance < 0);
                    const isSettled = m?.isSettled ?? ((customerInvoices.length > 0 || custLedger.entries.length > 0) && custLedger.netBalance === 0);

                    return (
                      <tr
                        key={cust.id}
                        className={`${
                          index % 2 === 1 ? 'bg-slate-50/70' : 'bg-white'
                        } hover:bg-purple-50/40 transition-colors group`}
                      >
                        {/* Index */}
                        <td className="py-3.5 px-3 text-center text-slate-400 font-mono font-bold text-[11px]">
                          {toPersianDigits(index + 1)}
                        </td>

                        {/* Customer Name & National ID (Clickable to open details) */}
                        <td className="py-3.5 px-3">
                          <div 
                            onClick={() => setDetailCustomer(cust)}
                            className="flex items-center gap-2.5 cursor-pointer"
                            title="مشاهده جزئیات کامل مشتری"
                          >
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-100 to-indigo-100 text-purple-700 font-black text-xs flex items-center justify-center shrink-0 border border-purple-200/70 shadow-2xs group-hover:scale-105 transition-transform">
                              {cust.name.trim().charAt(0) || 'م'}
                            </div>
                            <div>
                              <div className="font-bold text-slate-900 text-xs sm:text-sm group-hover:text-purple-800 transition-colors">
                                {cust.name}
                              </div>
                              {cust.nationalId && (
                                <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                                  کد ملی: {toPersianDigits(cust.nationalId)}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Phone Number */}
                        <td className="py-3.5 px-3 whitespace-nowrap">
                          {cust.phone ? (
                            <div className="flex items-center gap-1.5">
                              <Phone className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                              <a
                                href={`tel:${cust.phone}`}
                                className="font-mono text-slate-700 hover:text-emerald-700 hover:underline text-xs font-semibold"
                              >
                                {toPersianDigits(cust.phone)}
                              </a>
                            </div>
                          ) : (
                            <span className="text-slate-300 font-mono text-[11px]">---</span>
                          )}
                        </td>

                        {/* Financial balance status */}
                        <td className="py-3.5 px-3 text-left whitespace-nowrap">
                          {hasDebt ? (
                            <button
                              type="button"
                              onClick={() => setStatementCustomer(cust)}
                              title="کلیک برای باز کردن صورتحساب و ثبت واریزی"
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold transition-all cursor-pointer shadow-2xs"
                            >
                              <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                              <span>بدهکار:</span>
                              <span className="font-mono font-black">{formatPrice(custLedger.netBalance, settings.currency)}</span>
                            </button>
                          ) : hasCredit ? (
                            <button
                              type="button"
                              onClick={() => setStatementCustomer(cust)}
                              title="کلیک برای باز کردن صورتحساب"
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-bold transition-all cursor-pointer shadow-2xs"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                              <span>بستانکار:</span>
                              <span className="font-mono font-black">{formatPrice(Math.abs(custLedger.netBalance), settings.currency)}</span>
                            </button>
                          ) : isSettled ? (
                            <button
                              type="button"
                              onClick={() => setStatementCustomer(cust)}
                              title="کلیک برای باز کردن صورتحساب"
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-[11px] font-bold transition-all cursor-pointer"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                              <span>تسویه کامل</span>
                            </button>
                          ) : (
                            <span className="text-[11px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md">
                              بدون گردش
                            </span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-3 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1.5">
                            {/* Primary Details Button */}
                            <button
                              type="button"
                              id={`customer-details-btn-${cust.id}`}
                              onClick={() => setDetailCustomer(cust)}
                              title="مشاهده جزئیات کامل، آدرس، سوابق خرید و وضعیت مشتری"
                              className="flex items-center gap-1 text-[11px] font-bold px-2.5 py-1.5 rounded-xl bg-purple-100 hover:bg-purple-200 text-purple-800 border border-purple-300 shadow-2xs transition-all cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5 text-purple-700" />
                              <span>جزئیات</span>
                            </button>

                            {/* Statement Button */}
                            <button
                              type="button"
                              id={`customer-statement-btn-${cust.id}`}
                              onClick={() => setStatementCustomer(cust)}
                              title="مشاهده گردش حساب، ثبت بدهی و واریزی مشتری و چاپ صورتحساب"
                              className="flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 transition-all cursor-pointer"
                            >
                              <ReceiptText className="w-3.5 h-3.5 text-slate-500" />
                              <span className="hidden xl:inline">صورتحساب</span>
                            </button>

                            {/* Settle Debt Button if has debt */}
                            {hasDebt && (
                              <button
                                type="button"
                                id={`settle-customer-debt-${cust.id}`}
                                onClick={() => setPaymentModalCustomer(cust)}
                                title="ثبت واریزی یکباره و تسویه تجمیعی فاکتورها"
                                className="flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 transition-all cursor-pointer"
                              >
                                <CreditCard className="w-3.5 h-3.5 text-amber-600" />
                                <span className="hidden xl:inline">تسویه</span>
                              </button>
                            )}

                            {/* New Invoice Button */}
                            {(!currentUser || currentUser.permissions.canCreateInvoice) && (
                              <button
                                type="button"
                                onClick={() => onSelectCustomerForInvoice(cust)}
                                title="صدور فاکتور جدید برای این مشتری"
                                className="flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 transition-all cursor-pointer"
                              >
                                <Plus className="w-3.5 h-3.5 text-emerald-600" />
                                <span className="hidden xl:inline">فاکتور</span>
                              </button>
                            )}

                            {/* Export Button */}
                            <button
                              type="button"
                              id={`export-customer-excel-${cust.id}`}
                              onClick={() => {
                                setExportModalCustomer(cust);
                                setIsExportModalOpen(true);
                              }}
                              title="خروجی اکسل فاکتورها و حواله‌های خروج"
                              className="p-1.5 text-slate-400 hover:text-purple-700 hover:bg-purple-50 rounded-lg cursor-pointer transition-colors"
                            >
                              <FileSpreadsheet className="w-3.5 h-3.5" />
                            </button>

                            {/* Edit Button */}
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(cust)}
                              title="ویرایش مشخصات مشتری"
                              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer transition-colors"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>

                            {/* Delete Button */}
                            {(!currentUser || currentUser.role === 'admin' || currentUser.permissions.canManageCustomers) && (
                              <button
                                id={`delete-customer-btn-${cust.id}`}
                                type="button"
                                onClick={() => setCustomerToDelete(cust)}
                                title="حذف مشتری"
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Row Items View */}
            <div className="block sm:hidden divide-y divide-slate-100 p-3 space-y-3">
              {filteredCustomers.map((cust, index) => {
                const m = customerMetrics.get(cust.id);
                const customerInvoices = m?.invoices || [];
                const totalSpent = m?.totalSpent || 0;
                const custLedger = m?.ledger || StorageService.buildCustomerLedger(cust, invoices, transactions);
                const hasDebt = m?.hasDebt ?? (custLedger.netBalance > 0);
                const hasCredit = m?.hasCredit ?? (custLedger.netBalance < 0);
                const isSettled = m?.isSettled ?? ((customerInvoices.length > 0 || custLedger.entries.length > 0) && custLedger.netBalance === 0);

                return (
                  <div
                    key={cust.id}
                    className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs space-y-3"
                  >
                    {/* Row 1: Index, Name, Debt status */}
                    <div className="flex items-start justify-between gap-2">
                      <div 
                        onClick={() => setDetailCustomer(cust)}
                        className="flex items-center gap-2 cursor-pointer"
                      >
                        <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-500 font-mono text-[11px] font-bold flex items-center justify-center shrink-0">
                          {toPersianDigits(index + 1)}
                        </span>
                        <div>
                          <div className="font-bold text-slate-900 text-xs">
                            {cust.name}
                          </div>
                          {cust.nationalId && (
                            <span className="text-[10px] text-slate-400 font-mono">
                              کد ملی: {toPersianDigits(cust.nationalId)}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Financial Status Badge */}
                      {hasDebt ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200 shrink-0 font-mono">
                          بدهکار: {formatPrice(custLedger.netBalance, settings.currency)}
                        </span>
                      ) : hasCredit ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200 shrink-0 font-mono">
                          بستانکار: {formatPrice(Math.abs(custLedger.netBalance), settings.currency)}
                        </span>
                      ) : isSettled ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 shrink-0">
                          تسویه کامل
                        </span>
                      ) : null}
                    </div>

                    {/* Row 2: Phone */}
                    {cust.phone && (
                      <div className="text-xs bg-slate-50 px-3 py-2 rounded-xl border border-slate-100 flex items-center justify-between">
                        <span className="text-[11px] text-slate-500">شماره تماس:</span>
                        <a
                          href={`tel:${cust.phone}`}
                          className="font-mono text-slate-800 font-bold hover:text-emerald-700 hover:underline"
                        >
                          {toPersianDigits(cust.phone)}
                        </a>
                      </div>
                    )}

                    {/* Row 3: Action Buttons */}
                    <div className="flex items-center justify-between gap-1.5 pt-1 border-t border-slate-100 flex-wrap">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {/* Details Button */}
                        <button
                          type="button"
                          onClick={() => setDetailCustomer(cust)}
                          className="flex items-center gap-1 text-[11px] font-bold px-2.5 py-1.5 rounded-xl bg-purple-100 hover:bg-purple-200 text-purple-800 border border-purple-300 shadow-2xs cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5 text-purple-700" />
                          <span>جزئیات</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setStatementCustomer(cust)}
                          className="flex items-center gap-1 text-[11px] font-bold px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 cursor-pointer"
                        >
                          <ReceiptText className="w-3.5 h-3.5" />
                          <span>صورتحساب</span>
                        </button>

                        {hasDebt && (
                          <button
                            type="button"
                            onClick={() => setPaymentModalCustomer(cust)}
                            className="flex items-center gap-1 text-[11px] font-bold px-2 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white shadow-2xs cursor-pointer"
                          >
                            <CreditCard className="w-3.5 h-3.5" />
                            <span>واریزی</span>
                          </button>
                        )}

                        {(!currentUser || currentUser.permissions.canCreateInvoice) && (
                          <button
                            type="button"
                            onClick={() => onSelectCustomerForInvoice(cust)}
                            className="flex items-center gap-1 text-[11px] font-bold px-2 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>فاکتور</span>
                          </button>
                        )}
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setExportModalCustomer(cust);
                            setIsExportModalOpen(true);
                          }}
                          className="p-1.5 text-slate-400 hover:text-purple-700 hover:bg-purple-50 rounded-lg cursor-pointer"
                          title="اکسپورت اکسل"
                        >
                          <FileSpreadsheet className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(cust)}
                          className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer"
                          title="ویرایش"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        {(!currentUser || currentUser.role === 'admin' || currentUser.permissions.canManageCustomers) && (
                          <button
                            type="button"
                            onClick={() => setCustomerToDelete(cust)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                            title="حذف"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          /* ========================================================
             CARD / GRID VIEW (نمایش کارتی در صورت تمایل کاربر)
             ======================================================== */
          <div className="p-4 sm:p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredCustomers.map((cust, index) => {
              const m = customerMetrics.get(cust.id);
              const customerInvoices = m?.invoices || [];
              const totalSpent = m?.totalSpent || 0;
              const custLedger = m?.ledger || StorageService.buildCustomerLedger(cust, invoices, transactions);
              const hasDebt = m?.hasDebt ?? (custLedger.netBalance > 0);
              const hasCredit = m?.hasCredit ?? (custLedger.netBalance < 0);
              const isSettled = m?.isSettled ?? ((customerInvoices.length > 0 || custLedger.entries.length > 0) && custLedger.netBalance === 0);

              return (
                <div
                  key={cust.id}
                  className={`${
                    index % 2 === 1 ? 'bg-slate-100/75' : 'bg-white'
                  } border border-slate-200 rounded-2xl p-4 hover:border-slate-300 hover:shadow-xs transition-all flex flex-col justify-between space-y-3`}
                >
                  <div>
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-bold text-slate-900 text-sm">{cust.name}</h3>
                        {cust.nationalId && (
                          <span className="text-[10px] text-slate-400 font-mono">
                            کد ملی: {toPersianDigits(cust.nationalId)}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleOpenEdit(cust)}
                          title="ویرایش اطلاعات"
                          className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-lg cursor-pointer transition-colors"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        {(!currentUser || currentUser.role === 'admin' || currentUser.permissions.canManageCustomers) && (
                          <button
                            id={`delete-customer-btn-${cust.id}`}
                            type="button"
                            onClick={() => setCustomerToDelete(cust)}
                            title="حذف مشتری"
                            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="mt-3 space-y-1.5 text-xs text-slate-600">
                      {cust.phone && (
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Phone className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            <a
                              href={`tel:${cust.phone}`}
                              className="font-mono text-slate-700 hover:text-emerald-700 hover:underline text-xs font-semibold"
                            >
                              {toPersianDigits(cust.phone)}
                            </a>
                          </div>
                          <a
                            href={`tel:${cust.phone}`}
                            className="text-[10px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-md font-medium hover:bg-emerald-100"
                          >
                            تماس
                          </a>
                        </div>
                      )}
                      {cust.address && (
                        <div className="flex items-start gap-2 text-[11px] text-slate-500">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                          <span className="line-clamp-2">{cust.address}</span>
                        </div>
                      )}

                      {/* Debt / Settle Status Banner */}
                      {hasDebt ? (
                        <div 
                          onClick={() => setStatementCustomer(cust)}
                          title="کلیک برای باز کردن صورتحساب مالی و ثبت واریزی"
                          className="mt-2 p-2 bg-rose-50 hover:bg-rose-100/80 border border-rose-200 rounded-xl flex items-center justify-between gap-1 text-[11px] cursor-pointer transition-all"
                        >
                          <div className="flex items-center gap-1.5 text-rose-700 font-bold">
                            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                            <span>بدهی تسویه‌نشده:</span>
                          </div>
                          <span className="font-mono font-black text-rose-800">
                            {formatPrice(custLedger.netBalance, settings.currency)}
                          </span>
                        </div>
                      ) : hasCredit ? (
                        <div 
                          onClick={() => setStatementCustomer(cust)}
                          title="کلیک برای باز کردن صورتحساب"
                          className="mt-2 p-1.5 bg-blue-50 hover:bg-blue-100/80 border border-blue-200 rounded-xl flex items-center justify-between gap-1 text-[11px] cursor-pointer transition-all"
                        >
                          <div className="flex items-center gap-1.5 text-blue-700 font-bold">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>طلبکار / بستانکار:</span>
                          </div>
                          <span className="font-mono font-black text-blue-800">
                            {formatPrice(Math.abs(custLedger.netBalance), settings.currency)}
                          </span>
                        </div>
                      ) : isSettled ? (
                        <div 
                          onClick={() => setStatementCustomer(cust)}
                          title="کلیک برای باز کردن صورتحساب"
                          className="mt-2 p-1.5 bg-emerald-50 hover:bg-emerald-100/80 border border-emerald-200 rounded-xl flex items-center justify-center gap-1 text-[11px] text-emerald-700 font-bold cursor-pointer transition-all"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>تسویه حساب کامل (مشاهده صورتحساب)</span>
                        </div>
                      ) : null}
                    </div>
                  </div>

                  {/* Summary & Action Buttons */}
                  <div className="pt-3 border-t border-slate-200/80 flex items-center justify-between gap-2 flex-wrap">
                    <div>
                      <div className="text-[10px] text-slate-400">سفارشات:</div>
                      <div className="text-xs font-bold text-slate-800">
                        {toPersianDigits(customerInvoices.length)} فاکتور ({formatPrice(totalSpent, settings.currency)})
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap">
                      {/* Customer Details Button */}
                      <button
                        type="button"
                        id={`customer-grid-details-btn-${cust.id}`}
                        onClick={() => setDetailCustomer(cust)}
                        title="مشاهده جزئیات کامل، آدرس و سوابق مشتری"
                        className="flex items-center gap-1 text-xs font-bold px-2.5 py-1.5 rounded-xl bg-purple-100 hover:bg-purple-200 text-purple-800 border border-purple-300 shadow-xs transition-all cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5 text-purple-700" />
                        <span>جزئیات</span>
                      </button>

                      {/* Customer Statement Button */}
                      <button
                        type="button"
                        id={`customer-statement-btn-${cust.id}`}
                        onClick={() => setStatementCustomer(cust)}
                        title="مشاهده گردش حساب، ثبت بدهی و واریزی مشتری و چاپ صورتحساب"
                        className="flex items-center gap-1 text-xs font-bold px-2.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white shadow-xs transition-all cursor-pointer"
                      >
                        <ReceiptText className="w-3.5 h-3.5" />
                        <span>صورتحساب مالی</span>
                      </button>

                      {/* Settle Debt / Bulk Payment Button */}
                      {hasDebt && (
                        <button
                          type="button"
                          id={`settle-customer-debt-${cust.id}`}
                          onClick={() => setPaymentModalCustomer(cust)}
                          title="ثبت واریزی یکباره و تسویه تجمیعی فاکتورهای این مشتری"
                          className="flex items-center gap-1 text-xs font-bold px-2.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white shadow-xs transition-all cursor-pointer"
                        >
                          <CreditCard className="w-3.5 h-3.5" />
                          <span>ثبت واریزی و تسویه</span>
                        </button>
                      )}

                      <button
                        type="button"
                        id={`export-customer-excel-${cust.id}`}
                        onClick={() => {
                          setExportModalCustomer(cust);
                          setIsExportModalOpen(true);
                        }}
                        title="خروجی اکسل فاکتورها و حواله‌های خروج این شخص با جزییات کامل"
                        className="flex items-center gap-1 text-xs font-bold px-2.5 py-1.5 rounded-xl bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200 transition-colors cursor-pointer"
                      >
                        <FileSpreadsheet className="w-3.5 h-3.5 text-purple-600" />
                        <span>اکسپورت اسناد</span>
                      </button>

                      {(!currentUser || currentUser.permissions.canCreateInvoice) && (
                        <button
                          onClick={() => onSelectCustomerForInvoice(cust)}
                          className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>فاکتور جدید</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* CUSTOMER DETAILS MODAL (پنجره مشخصات و جزئیات کامل مشتری) */}
      {detailCustomer && (() => {
        const m = customerMetrics.get(detailCustomer.id);
        const customerInvoices = m?.invoices || [];
        const totalSpent = m?.totalSpent || 0;
        const custLedger = m?.ledger || StorageService.buildCustomerLedger(detailCustomer, invoices, transactions);
        const hasDebt = m?.hasDebt ?? (custLedger.netBalance > 0);
        const hasCredit = m?.hasCredit ?? (custLedger.netBalance < 0);

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden text-right">
              {/* Header */}
              <div className="p-4 sm:p-5 bg-gradient-to-r from-purple-900 via-slate-900 to-purple-950 text-white flex items-center justify-between gap-3 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-purple-500/20 border border-purple-400/30 flex items-center justify-center text-purple-300">
                    <User className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-base sm:text-lg">
                      جزئیات کامل خریدار / مشتری
                    </h3>
                    <p className="text-xs text-purple-200 mt-0.5">
                      مشاهده پروفایل، نشانی، مانده حساب مالی و سوابق سفارشات
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setDetailCustomer(null)}
                  className="w-8 h-8 flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
                  title="بستن"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-4 sm:p-6 overflow-y-auto space-y-4 text-xs text-slate-700">
                {/* Profile Card */}
                <div className="bg-gradient-to-br from-slate-50 to-purple-50/40 p-4 rounded-2xl border border-purple-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 text-white font-black text-xl flex items-center justify-center shadow-md shadow-purple-200 shrink-0">
                      {detailCustomer.name.trim().charAt(0) || 'م'}
                    </div>
                    <div>
                      <h4 className="font-extrabold text-slate-900 text-base sm:text-lg">
                        {detailCustomer.name}
                      </h4>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        {detailCustomer.nationalId ? (
                          <span className="font-mono text-[11px] bg-white px-2 py-0.5 rounded-md border border-slate-200 text-slate-600 font-semibold">
                            کد ملی / شناسه: {toPersianDigits(detailCustomer.nationalId)}
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-400">بدون کد ملی</span>
                        )}
                        {detailCustomer.createdAt && (
                          <span className="font-mono text-[10px] text-slate-400 bg-white/60 px-2 py-0.5 rounded-md">
                            عضویت: {toPersianDigits(detailCustomer.createdAt)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Phone action */}
                  {detailCustomer.phone && (
                    <div className="flex items-center gap-2 self-start sm:self-auto">
                      <a
                        href={`tel:${detailCustomer.phone}`}
                        className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs shadow-xs transition-colors"
                      >
                        <Phone className="w-3.5 h-3.5" />
                        <span className="font-mono">{toPersianDigits(detailCustomer.phone)}</span>
                      </a>
                    </div>
                  )}
                </div>

                {/* 3 Metric Summary Boxes */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Total Invoices */}
                  <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                    <div className="flex items-center gap-1.5 text-slate-500 font-bold text-[11px] mb-1">
                      <FileText className="w-3.5 h-3.5 text-blue-600" />
                      <span>تعداد فاکتورها:</span>
                    </div>
                    <div className="font-black text-slate-900 text-base font-mono">
                      {toPersianDigits(customerInvoices.length)} فاکتور
                    </div>
                  </div>

                  {/* Total Purchases */}
                  <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                    <div className="flex items-center gap-1.5 text-slate-500 font-bold text-[11px] mb-1">
                      <CreditCard className="w-3.5 h-3.5 text-emerald-600" />
                      <span>مجموع خرید:</span>
                    </div>
                    <div className="font-black text-emerald-700 text-sm font-mono">
                      {formatPrice(totalSpent, settings.currency)}
                    </div>
                  </div>

                  {/* Net Balance */}
                  <div className={`p-3.5 rounded-2xl border ${
                    hasDebt
                      ? 'bg-rose-50/80 border-rose-200 text-rose-800'
                      : hasCredit
                      ? 'bg-blue-50/80 border-blue-200 text-blue-800'
                      : 'bg-emerald-50/80 border-emerald-200 text-emerald-800'
                  }`}>
                    <div className="flex items-center gap-1.5 font-bold text-[11px] mb-1">
                      {hasDebt ? (
                        <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                      ) : (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      )}
                      <span>
                        {hasDebt ? 'مانده بدهی مشتری:' : hasCredit ? 'مانده طلب (بستانکار):' : 'وضعیت حساب:'}
                      </span>
                    </div>
                    <div className="font-black text-sm font-mono">
                      {hasDebt
                        ? formatPrice(custLedger.netBalance, settings.currency)
                        : hasCredit
                        ? formatPrice(Math.abs(custLedger.netBalance), settings.currency)
                        : 'تسویه حساب کامل'}
                    </div>
                  </div>
                </div>

                {/* Address Section */}
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-1.5">
                  <div className="flex items-center gap-1.5 font-bold text-slate-700 text-xs">
                    <MapPin className="w-4 h-4 text-purple-600" />
                    <span>آدرس و نشانی تحویل / شرکت:</span>
                  </div>
                  <p className="text-slate-800 text-xs leading-relaxed pr-5">
                    {detailCustomer.address ? detailCustomer.address : 'هنوز آدرسی برای این مشتری ثبت نشده است.'}
                  </p>
                </div>

                {/* Notes Section */}
                {detailCustomer.notes && (
                  <div className="bg-amber-50/60 p-3.5 rounded-2xl border border-amber-200/80 space-y-1 text-xs">
                    <div className="font-bold text-amber-900">توضیحات و یادداشت مشتری:</div>
                    <p className="text-amber-800 leading-relaxed">{detailCustomer.notes}</p>
                  </div>
                )}

                {/* Recent Invoices List */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800 text-xs">
                      آخرین فاکتورهای ثبت‌شده برای این شخص ({toPersianDigits(customerInvoices.length)} فاکتور):
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const target = detailCustomer;
                        setDetailCustomer(null);
                        setStatementCustomer(target);
                      }}
                      className="text-purple-700 hover:text-purple-900 font-bold text-[11px] cursor-pointer"
                    >
                      مشاهده صورتحساب کامل ←
                    </button>
                  </div>

                  {customerInvoices.length === 0 ? (
                    <div className="p-4 bg-slate-50 text-slate-400 text-center rounded-xl border border-slate-200 text-xs">
                      تاکنون فاکتوری برای این خریدار صادر نشده است.
                    </div>
                  ) : (
                    <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white">
                      <table className="w-full text-right border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-100/70 text-slate-700 border-b border-slate-200">
                            <th className="p-2.5 font-bold">شماره فاکتور</th>
                            <th className="p-2.5 font-bold text-center">تاریخ</th>
                            <th className="p-2.5 font-bold text-left">مبلغ کل</th>
                            <th className="p-2.5 font-bold text-center">وضعیت تسویه</th>
                            {onViewInvoice && <th className="p-2.5 font-bold text-center w-16">مشاهده</th>}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {customerInvoices.slice(0, 4).map((inv) => (
                            <tr key={inv.id} className="hover:bg-slate-50">
                              <td className="p-2.5 font-mono font-bold text-slate-900">
                                {toPersianDigits(inv.invoiceNumber)}
                              </td>
                              <td className="p-2.5 text-center font-mono text-slate-600">
                                {toPersianDigits(inv.date)}
                              </td>
                              <td className="p-2.5 text-left font-mono font-bold text-slate-900">
                                {formatPrice(inv.finalTotal, settings.currency)}
                              </td>
                              <td className="p-2.5 text-center">
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  inv.paymentStatus === 'paid'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : inv.paymentStatus === 'partial'
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-rose-100 text-rose-800'
                                }`}>
                                  {inv.paymentStatus === 'paid' ? 'تسویه' : inv.paymentStatus === 'partial' ? 'بیعانه' : 'نسیه'}
                                </span>
                              </td>
                              {onViewInvoice && (
                                <td className="p-2.5 text-center">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setDetailCustomer(null);
                                      onViewInvoice(inv);
                                    }}
                                    className="p-1 text-slate-400 hover:text-purple-700 rounded-lg cursor-pointer"
                                    title="مشاهده فاکتور"
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                  </button>
                                </td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>

              {/* Footer Actions */}
              <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 shrink-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => {
                      const target = detailCustomer;
                      setDetailCustomer(null);
                      setStatementCustomer(target);
                    }}
                    className="px-3.5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                  >
                    <ReceiptText className="w-4 h-4" />
                    <span>صورتحساب مالی</span>
                  </button>

                  {hasDebt && (
                    <button
                      type="button"
                      onClick={() => {
                        const target = detailCustomer;
                        setDetailCustomer(null);
                        setPaymentModalCustomer(target);
                      }}
                      className="px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                    >
                      <CreditCard className="w-4 h-4" />
                      <span>ثبت واریزی و تسویه</span>
                    </button>
                  )}

                  {(!currentUser || currentUser.permissions.canCreateInvoice) && (
                    <button
                      type="button"
                      onClick={() => {
                        const target = detailCustomer;
                        setDetailCustomer(null);
                        onSelectCustomerForInvoice(target);
                      }}
                      className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                    >
                      <Plus className="w-4 h-4" />
                      <span>صدور فاکتور جدید</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      const target = detailCustomer;
                      setDetailCustomer(null);
                      handleOpenEdit(target);
                    }}
                    className="px-3 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>ویرایش مشخصات</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setDetailCustomer(null)}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl font-bold text-xs transition-colors cursor-pointer"
                >
                  بستن
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* MODAL: ADD / EDIT CUSTOMER */}
      {isModalOpen && editingCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden">
            <div className="bg-slate-900 text-white px-5 py-3.5 flex items-center justify-between">
              <h3 className="font-bold text-sm">
                {editingCustomer.id ? 'ویرایش مشخصات مشتری' : 'ثبت مشتری جدید'}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">نام کامل مشتری یا شرکت *</label>
                <input
                  type="text"
                  required
                  id="customer-modal-name"
                  value={editingCustomer.name}
                  onChange={(e) => setEditingCustomer({ ...editingCustomer, name: e.target.value })}
                  placeholder="مثال: مهندس حسینی"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">شماره تماس / همراه</label>
                <input
                  type="text"
                  id="customer-modal-phone"
                  value={editingCustomer.phone}
                  onChange={(e) => setEditingCustomer({ ...editingCustomer, phone: e.target.value })}
                  placeholder="۰۹۱۲۳۴۵۶۷۸۹"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">کد ملی یا شناسه اقتصادی (برای فاکتور رسمی)</label>
                <input
                  type="text"
                  id="customer-modal-nid"
                  value={editingCustomer.nationalId || ''}
                  onChange={(e) => setEditingCustomer({ ...editingCustomer, nationalId: e.target.value })}
                  placeholder="شناسه ملی"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">نشانی و آدرس خریدار</label>
                <input
                  type="text"
                  id="customer-modal-address"
                  value={editingCustomer.address || ''}
                  onChange={(e) => setEditingCustomer({ ...editingCustomer, address: e.target.value })}
                  placeholder="شهر، خیابان، پلاک، طبقه..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">یادداشت‌های داخلی</label>
                <textarea
                  rows={2}
                  id="customer-modal-notes"
                  value={editingCustomer.notes || ''}
                  onChange={(e) => setEditingCustomer({ ...editingCustomer, notes: e.target.value })}
                  placeholder="توضیحات مربوط به اعتبار یا شرایط پرداخت..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs text-slate-600 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  id="save-customer-modal-btn"
                  className="flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>ذخیره مشتری</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Customer Confirmation Modal */}
      {customerToDelete && (
        <div 
          id="delete-customer-confirm-modal"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 text-right">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mb-4 mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900 text-center mb-2">
              حذف مشتری
            </h3>
            <p className="text-sm text-slate-600 text-center mb-6 leading-relaxed">
              آیا از حذف پرونده مشتری <span className="font-bold text-slate-800">«{customerToDelete.name}»</span> اطمینان دارید؟
            </p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                id="cancel-delete-customer-btn"
                onClick={() => setCustomerToDelete(null)}
                className="flex-1 py-2.5 px-4 rounded-xl text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
              >
                انصراف
              </button>
              <button
                type="button"
                id="confirm-delete-customer-btn"
                onClick={() => {
                  onDeleteCustomer(customerToDelete.id);
                  setCustomerToDelete(null);
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

      {/* EXCEL IMPORT MODAL */}
      {isImportModalOpen && (
        <ExcelImportModal
          isOpen={isImportModalOpen}
          onClose={() => setIsImportModalOpen(false)}
          type="customers"
          mode="customers"
          existingCustomers={customers}
          onImportCustomers={(imported, importMode) => {
            if (onImportCustomers) {
              onImportCustomers(imported, importMode);
            } else {
              let updated: Customer[];
              if (importMode === 'replace') {
                updated = imported;
              } else {
                const map = new Map<string, Customer>(customers.map((c) => [c.name.trim().toLowerCase(), c]));
                imported.forEach((c) => map.set(c.name.trim().toLowerCase(), c));
                updated = Array.from(map.values()) as Customer[];
              }
              StorageService.saveCustomers(updated);
            }
            setIsImportModalOpen(false);
          }}
        />
      )}

      {/* CUSTOMER INVOICES & EXIT SLIPS EXCEL EXPORT MODAL */}
      <CustomerExportModal
        isOpen={isExportModalOpen}
        onClose={() => {
          setIsExportModalOpen(false);
          setExportModalCustomer(null);
        }}
        initialCustomerId={exportModalCustomer?.id}
        customers={customers}
        invoices={invoices}
        settings={settings}
      />

      {/* CUSTOMER BULK PAYMENT / LUMP-SUM DEPOSIT MODAL */}
      {paymentModalCustomer && (
        <CustomerBulkPaymentModal
          isOpen={!!paymentModalCustomer}
          onClose={() => setPaymentModalCustomer(null)}
          customer={paymentModalCustomer}
          invoices={invoices}
          settings={settings}
          onConfirmPayment={(updates, details) => {
            if (onBatchUpdatePaymentStatus) {
              onBatchUpdatePaymentStatus(updates, details);
            }
          }}
        />
      )}

      {/* CUSTOMER FINANCIAL STATEMENT & TRANSACTIONS MODAL */}
      {statementCustomer && (
        <CustomerStatementModal
          isOpen={!!statementCustomer}
          onClose={() => setStatementCustomer(null)}
          customer={statementCustomer}
          invoices={invoices}
          transactions={transactions}
          settings={settings}
          currentUser={currentUser}
          onSaveTransaction={(txn, autoSettle) => {
            if (onSaveTransaction) {
              onSaveTransaction(txn, autoSettle);
            } else {
              StorageService.addCustomerTransaction(txn);
            }
          }}
          onDeleteTransaction={(txnId) => {
            if (onDeleteTransaction) {
              onDeleteTransaction(txnId);
            } else {
              StorageService.deleteCustomerTransaction(txnId);
            }
          }}
          onViewInvoice={onViewInvoice}
        />
      )}

      {/* CUSTOMER MASTER STATEMENTS & DEBTORS REPORT MODAL */}
      {isStatementsReportOpen && (
        <CustomerStatementsReportModal
          isOpen={isStatementsReportOpen}
          onClose={() => setIsStatementsReportOpen(false)}
          customers={customers}
          invoices={invoices}
          transactions={transactions}
          settings={settings}
          onSelectCustomerForStatement={(cust) => {
            setIsStatementsReportOpen(false);
            setStatementCustomer(cust);
          }}
        />
      )}
    </div>
  );
};
