import React, { useMemo, useState, useEffect } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Search,
  Download,
  Plus,
  X,
  Eye,
  Edit3,
  Trash2,
  RotateCcw,
  Wallet,
  FileSpreadsheet,
  SlidersHorizontal,
  User,
} from 'lucide-react';
import {
  Customer,
  Invoice,
  PurchaseInvoice,
  CustomerTransaction,
  StoreSettings,
  AppUser,
} from '../types';
import { formatPrice, toPersianDigits, toEnglishDigits, getCurrentJalaliDate } from '../utils/jalali';
import { canUserModifyCustomers, canUserSettleInvoice, isReadOnlyUser } from '../utils/permissions';
import { confirmAction } from '../utils/confirmDialog';
import { SmartPagination, paginateArray } from './SmartPagination';
import { JalaliDatePicker } from './JalaliDatePicker';
import { CustomerTransactionModal } from './CustomerTransactionModal';

export interface CustomerPaymentsLedgerProps {
  customers: Customer[];
  invoices: Invoice[];
  purchaseInvoices: PurchaseInvoice[];
  transactions: CustomerTransaction[];
  settings: StoreSettings;
  currentUser?: AppUser;
  onSaveTransaction: (txn: CustomerTransaction) => void;
  onDeleteTransaction: (txnId: string) => void;
  onViewInvoice?: (invoice: Invoice) => void;
}

type FlowDirection = 'receipt' | 'payment';
type CanonicalMethod = 'cash' | 'card' | 'pos' | 'transfer' | 'cheque' | 'other';
type SortMode = 'date_desc' | 'date_asc' | 'amount_desc' | 'amount_asc';

interface UnifiedPaymentEntry {
  id: string;
  direction: FlowDirection;
  source: 'customer_deposit' | 'customer_payment' | 'invoice_payment' | 'purchase_payment';
  sourceLabel: string;
  date: string;
  sortDate: string;
  createdAt?: string;
  customerId?: string;
  customerName: string;
  customerPhone?: string;
  amount: number;
  method: CanonicalMethod;
  methodLabel: string;
  title: string;
  notes?: string;
  trackingNumber?: string;
  bankName?: string;
  chequeDueDate?: string;
  chequeOwner?: string;
  invoiceNumber?: string;
  recordedBy?: string;
  rawTransaction?: CustomerTransaction;
  rawInvoice?: Invoice;
  rawPurchaseInvoice?: PurchaseInvoice;
}

const METHOD_LABELS: Record<CanonicalMethod, string> = {
  cash: 'نقدی',
  card: 'کارت به کارت',
  pos: 'کارتخوان',
  transfer: 'حواله بانکی',
  cheque: 'چک',
  other: 'سایر',
};

const PAYMENT_TITLE_REGEX = /(پرداخت|واریز|عودت|استرداد|چک|تسویه|کارت|حواله|نقد)/;

function normalizeJalaliComparable(raw?: string): string {
  if (!raw) return '';
  const eng = toEnglishDigits(raw).trim();
  const match = eng.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
  if (!match) return eng;
  const [, y, m, d] = match;
  return `${y}/${m.padStart(2, '0')}/${d.padStart(2, '0')}`;
}

function normalizeMethod(raw?: string): CanonicalMethod {
  switch (raw) {
    case 'cash':
      return 'cash';
    case 'card':
      return 'card';
    case 'pos':
      return 'pos';
    case 'transfer':
      return 'transfer';
    case 'cheque':
      return 'cheque';
    default:
      return 'other';
  }
}

function isActualOutgoingPaymentTxn(txn: CustomerTransaction): boolean {
  if (txn.type !== 'debt') return false;
  if (
    txn.paymentMethod === 'cash' ||
    txn.paymentMethod === 'card' ||
    txn.paymentMethod === 'pos' ||
    txn.paymentMethod === 'transfer' ||
    txn.paymentMethod === 'cheque'
  ) {
    return true;
  }
  const combinedText = `${txn.title || ''} ${txn.notes || ''}`;
  return PAYMENT_TITLE_REGEX.test(combinedText);
}

export const CustomerPaymentsLedger: React.FC<CustomerPaymentsLedgerProps> = ({
  customers,
  invoices,
  purchaseInvoices,
  transactions,
  settings,
  currentUser,
  onSaveTransaction,
  onDeleteTransaction,
  onViewInvoice,
}) => {
  const canModify =
    !isReadOnlyUser(currentUser) &&
    (canUserModifyCustomers(currentUser) || canUserSettleInvoice(currentUser));

  // Filters
  const [directionFilter, setDirectionFilter] = useState<'all' | FlowDirection>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCustomerKey, setSelectedCustomerKey] = useState<string>('all');
  const [methodFilter, setMethodFilter] = useState<'all' | CanonicalMethod>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('date_desc');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Record / Edit Transaction Modal
  const [showCustomerPicker, setShowCustomerPicker] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');
  const [pickerInitialType, setPickerInitialType] = useState<'deposit' | 'debt'>('deposit');
  const [activeModalCustomer, setActiveModalCustomer] = useState<Customer | null>(null);
  const [activeModalInitialType, setActiveModalInitialType] = useState<'deposit' | 'debt'>('deposit');
  const [editingTransaction, setEditingTransaction] = useState<CustomerTransaction | null>(null);

  // Selected entry for dedicated Details Modal (derived live from allEntries so edits/deletes stay in sync)
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);

  // Build customer lookup maps by ID and normalized name
  const customerMaps = useMemo(() => {
    const byId = new Map<string, Customer>();
    const byName = new Map<string, Customer>();
    customers.forEach((c) => {
      byId.set(c.id, c);
      if (c.name && c.name.trim()) {
        byName.set(c.name.trim().toLowerCase(), c);
      }
    });
    return { byId, byName };
  }, [customers]);

  const resolveCustomer = (id?: string, name?: string): Customer | undefined => {
    if (id && customerMaps.byId.has(id)) return customerMaps.byId.get(id);
    if (name && name.trim()) {
      return customerMaps.byName.get(name.trim().toLowerCase());
    }
    return undefined;
  };

  // Aggregate ONLY actual receipts and payments across all customers (zero non-payment invoices, zero double-counting)
  const allEntries = useMemo<UnifiedPaymentEntry[]>(() => {
    const list: UnifiedPaymentEntry[] = [];

    // 1. Standalone customer transactions (deposits = receipts, cash/bank/cheque debts = outgoing payments)
    transactions.forEach((txn) => {
      const amount = Number(txn.amount) || 0;
      if (amount <= 0) return;

      const matchedCustomer = resolveCustomer(txn.customerId, txn.customerName);
      const displayName = matchedCustomer?.name || txn.customerName || 'مشتری نامشخص';

      if (txn.type === 'deposit') {
        const method = normalizeMethod(txn.paymentMethod);
        list.push({
          id: `txn-${txn.id}`,
          direction: 'receipt',
          source: 'customer_deposit',
          sourceLabel: 'دریافت وجه / واریز مشتری',
          date: txn.date || '',
          sortDate: normalizeJalaliComparable(txn.date),
          createdAt: txn.createdAt,
          customerId: matchedCustomer?.id || txn.customerId,
          customerName: displayName,
          customerPhone: matchedCustomer?.phone,
          amount,
          method,
          methodLabel: method === 'cheque' ? 'چک دریافتی' : METHOD_LABELS[method],
          title: txn.title || 'دریافت وجه از مشتری',
          notes: txn.notes,
          trackingNumber: txn.trackingNumber,
          bankName: txn.bankName,
          chequeDueDate: txn.chequeDueDate,
          invoiceNumber: txn.invoiceNumber,
          recordedBy: txn.recordedBy,
          rawTransaction: txn,
        });
      } else if (isActualOutgoingPaymentTxn(txn)) {
        const method = normalizeMethod(txn.paymentMethod);
        list.push({
          id: `txn-${txn.id}`,
          direction: 'payment',
          source: 'customer_payment',
          sourceLabel: 'پرداخت وجه به طرف‌حساب',
          date: txn.date || '',
          sortDate: normalizeJalaliComparable(txn.date),
          createdAt: txn.createdAt,
          customerId: matchedCustomer?.id || txn.customerId,
          customerName: displayName,
          customerPhone: matchedCustomer?.phone,
          amount,
          method,
          methodLabel: method === 'cheque' ? 'چک پرداختی' : METHOD_LABELS[method],
          title: txn.title || 'پرداخت وجه به طرف‌حساب',
          notes: txn.notes,
          trackingNumber: txn.trackingNumber,
          bankName: txn.bankName,
          chequeDueDate: txn.chequeDueDate,
          invoiceNumber: txn.invoiceNumber,
          recordedBy: txn.recordedBy,
          rawTransaction: txn,
        });
      }
    });

    // 2. Direct payments recorded on sales/service invoices (non-proforma, paidAmount > 0)
    invoices.forEach((inv) => {
      if (inv.isProforma) return;
      const paid = Number(inv.paidAmount) || 0;
      if (paid <= 0) return;

      const matchedCustomer = resolveCustomer(inv.customerId, inv.customerName);
      const displayName = matchedCustomer?.name || inv.customerName || 'مشتری حضوری';
      const method = normalizeMethod(inv.paymentMethod);
      const isFull = inv.paymentStatus === 'paid' || paid >= inv.finalTotal;

      list.push({
        id: `inv-pay-${inv.id}`,
        direction: 'receipt',
        source: 'invoice_payment',
        sourceLabel: isFull ? 'تسویه فاکتور فروش' : 'دریافت علی‌الحساب فاکتور',
        date: inv.date || '',
        sortDate: normalizeJalaliComparable(inv.date),
        createdAt: inv.createdAt,
        customerId: matchedCustomer?.id || inv.customerId,
        customerName: displayName,
        customerPhone: matchedCustomer?.phone || inv.customerPhone,
        amount: paid,
        method,
        methodLabel: method === 'cheque' ? 'چک دریافتی' : METHOD_LABELS[method],
        title: isFull
          ? `تسویه فاکتور شماره ${inv.invoiceNumber}`
          : `دریافت بخشی از فاکتور شماره ${inv.invoiceNumber}`,
        notes: inv.transferDescription || inv.notes,
        trackingNumber: inv.chequeNumber,
        chequeDueDate: inv.chequeDueDate,
        chequeOwner: inv.chequeName,
        invoiceNumber: inv.invoiceNumber,
        recordedBy: inv.createdByName,
        rawInvoice: inv,
      });
    });

    // 3. Direct payments recorded on purchase/service invoices (paidAmount > 0)
    purchaseInvoices.forEach((pur) => {
      const paid = Number(pur.paidAmount) || 0;
      if (paid <= 0) return;

      const matchedCustomer = resolveCustomer(undefined, pur.supplierName);
      const displayName = matchedCustomer?.name || pur.supplierName || 'تامین‌کننده نامشخص';
      const method = normalizeMethod(pur.paymentMethod);
      const isFull = pur.paymentStatus === 'paid' || paid >= pur.finalTotal;

      list.push({
        id: `pur-pay-${pur.id}`,
        direction: 'payment',
        source: 'purchase_payment',
        sourceLabel: pur.isServiceOnly ? 'پرداخت هزینه خدمات' : 'پرداخت بابت فاکتور خرید',
        date: pur.date || '',
        sortDate: normalizeJalaliComparable(pur.date),
        createdAt: pur.createdAt,
        customerId: matchedCustomer?.id,
        customerName: displayName,
        customerPhone: matchedCustomer?.phone || pur.supplierPhone,
        amount: paid,
        method,
        methodLabel: method === 'cheque' ? 'چک پرداختی' : METHOD_LABELS[method],
        title: isFull
          ? `پرداخت تسویه فاکتور خرید ${pur.invoiceNumber}`
          : `پرداخت بخشی از فاکتور خرید ${pur.invoiceNumber}`,
        notes: pur.transferDescription || pur.notes,
        trackingNumber: pur.chequeNumber,
        chequeDueDate: pur.chequeDueDate,
        chequeOwner: pur.chequeName,
        invoiceNumber: pur.invoiceNumber,
        recordedBy: pur.createdByName,
        rawPurchaseInvoice: pur,
      });
    });

    return list;
  }, [transactions, invoices, purchaseInvoices, customerMaps]);

  // Unique customer/party options for the dropdown
  const customerFilterOptions = useMemo(() => {
    const map = new Map<string, string>();
    allEntries.forEach((entry) => {
      const key = entry.customerName.trim().toLowerCase();
      if (key && !map.has(key)) {
        map.set(key, entry.customerName.trim());
      }
    });
    return Array.from(map.entries())
      .map(([key, label]) => ({ key, label }))
      .sort((a, b) => a.label.localeCompare(b.label, 'fa'));
  }, [allEntries]);

  // Filtered and sorted entries
  const filteredEntries = useMemo(() => {
    const q = toEnglishDigits(searchQuery).trim().toLowerCase();
    const fromNorm = normalizeJalaliComparable(dateFrom);
    const toNorm = normalizeJalaliComparable(dateTo);

    const result = allEntries.filter((entry) => {
      if (directionFilter !== 'all' && entry.direction !== directionFilter) {
        return false;
      }
      if (selectedCustomerKey !== 'all' && entry.customerName.trim().toLowerCase() !== selectedCustomerKey) {
        return false;
      }
      if (methodFilter !== 'all' && entry.method !== methodFilter) {
        return false;
      }
      if (fromNorm && entry.sortDate && entry.sortDate < fromNorm) {
        return false;
      }
      if (toNorm && entry.sortDate && entry.sortDate > toNorm) {
        return false;
      }
      if (q) {
        const haystack = toEnglishDigits(
          [
            entry.customerName,
            entry.customerPhone,
            entry.title,
            entry.notes,
            entry.invoiceNumber,
            entry.trackingNumber,
            entry.bankName,
            entry.chequeOwner,
            entry.chequeDueDate,
            entry.methodLabel,
            entry.sourceLabel,
            entry.date,
            String(entry.amount),
          ]
            .filter(Boolean)
            .join(' ')
        ).toLowerCase();

        if (!haystack.includes(q)) return false;
      }
      return true;
    });

    result.sort((a, b) => {
      if (sortMode === 'date_desc') {
        const cmp = b.sortDate.localeCompare(a.sortDate);
        if (cmp !== 0) return cmp;
        return (b.createdAt || '').localeCompare(a.createdAt || '');
      }
      if (sortMode === 'date_asc') {
        const cmp = a.sortDate.localeCompare(b.sortDate);
        if (cmp !== 0) return cmp;
        return (a.createdAt || '').localeCompare(b.createdAt || '');
      }
      if (sortMode === 'amount_desc') {
        return b.amount - a.amount;
      }
      return a.amount - b.amount;
    });

    return result;
  }, [allEntries, directionFilter, selectedCustomerKey, methodFilter, dateFrom, dateTo, searchQuery, sortMode]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [directionFilter, selectedCustomerKey, methodFilter, dateFrom, dateTo, searchQuery, sortMode]);

  // Summary KPIs for the currently filtered dataset
  const stats = useMemo(() => {
    let totalReceipts = 0;
    let receiptCount = 0;
    let totalPayments = 0;
    let paymentCount = 0;
    let chequeTotal = 0;
    let chequeCount = 0;

    filteredEntries.forEach((e) => {
      if (e.direction === 'receipt') {
        totalReceipts += e.amount;
        receiptCount += 1;
      } else {
        totalPayments += e.amount;
        paymentCount += 1;
      }
      if (e.method === 'cheque') {
        chequeTotal += e.amount;
        chequeCount += 1;
      }
    });

    return {
      totalReceipts,
      receiptCount,
      totalPayments,
      paymentCount,
      netFlow: totalReceipts - totalPayments,
      chequeTotal,
      chequeCount,
    };
  }, [filteredEntries]);

  // Global counts for segmented tabs
  const globalCounts = useMemo(() => {
    let receipts = 0;
    let payments = 0;
    allEntries.forEach((e) => {
      if (e.direction === 'receipt') receipts += 1;
      else payments += 1;
    });
    return { all: allEntries.length, receipts, payments };
  }, [allEntries]);

  const hasActiveFilters = Boolean(
    directionFilter !== 'all' ||
      searchQuery.trim() ||
      selectedCustomerKey !== 'all' ||
      methodFilter !== 'all' ||
      dateFrom ||
      dateTo
  );

  const resetAllFilters = () => {
    setDirectionFilter('all');
    setSearchQuery('');
    setSelectedCustomerKey('all');
    setMethodFilter('all');
    setDateFrom('');
    setDateTo('');
    setSortMode('date_desc');
  };

  const paginatedEntries = useMemo(
    () => paginateArray(filteredEntries, currentPage, pageSize),
    [filteredEntries, currentPage, pageSize]
  );

  // Filtered customers for the "record new transaction" picker
  const filteredPickerCustomers = useMemo(() => {
    const q = toEnglishDigits(pickerSearch).trim().toLowerCase();
    const sorted = [...customers].sort((a, b) => a.name.localeCompare(b.name, 'fa'));
    if (!q) return sorted;
    return sorted.filter((c) => {
      const hay = toEnglishDigits(`${c.name} ${c.phone || ''} ${c.address || ''}`).toLowerCase();
      return hay.includes(q);
    });
  }, [customers, pickerSearch]);

  const selectedEntry = useMemo(
    () => (selectedEntryId ? allEntries.find((e) => e.id === selectedEntryId) || null : null),
    [allEntries, selectedEntryId]
  );

  useEffect(() => {
    if (!selectedEntryId) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedEntryId(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedEntryId]);

  // Edit standalone transaction
  const handleEditEntry = (entry: UnifiedPaymentEntry) => {
    if (!canModify || !entry.rawTransaction) return;
    const customer =
      resolveCustomer(entry.customerId, entry.customerName) || {
        id: entry.customerId || `temp-${entry.id}`,
        name: entry.customerName,
        phone: entry.customerPhone || '',
        createdAt: getCurrentJalaliDate(),
      };
    setEditingTransaction(entry.rawTransaction);
    setActiveModalInitialType(entry.rawTransaction.type);
    setActiveModalCustomer(customer);
  };

  // Delete standalone transaction
  const handleDeleteEntry = async (entry: UnifiedPaymentEntry) => {
    if (!canModify || !entry.rawTransaction) return;
    const confirmed = await confirmAction(
      `آیا از حذف این سند «${entry.direction === 'receipt' ? 'دریافتی' : 'پرداختی'}» به مبلغ ${formatPrice(entry.amount, settings.currency)} برای «${entry.customerName}» اطمینان دارید؟`,
      {
        title: 'حذف سند دریافت / پرداخت',
        confirmLabel: 'حذف سند',
        cancelLabel: 'انصراف',
        variant: 'danger',
      }
    );
    if (confirmed) {
      if (selectedEntryId === entry.id) {
        setSelectedEntryId(null);
      }
      onDeleteTransaction(entry.rawTransaction.id);
    }
  };

  // Export CSV (UTF-8 BOM for clean Persian Excel opening)
  const handleExportCsv = () => {
    if (filteredEntries.length === 0) return;

    const escapeCell = (val?: string | number) => {
      const str = val === undefined || val === null ? '' : String(val);
      return `"${str.replace(/"/g, '""')}"`;
    };

    const headers = [
      'ردیف',
      'تاریخ',
      'مشتری / طرف‌حساب',
      'شماره تماس',
      'نوع تراکنش',
      'منبع سند',
      'روش پرداخت',
      'شماره چک / پیگیری',
      'سررسید چک',
      'بانک / صاحب چک',
      'شماره فاکتور',
      'شرح و توضیحات',
      `مبلغ (${settings.currency})`,
    ];

    const rows = filteredEntries.map((e, idx) => [
      idx + 1,
      e.date,
      e.customerName,
      e.customerPhone || '',
      e.direction === 'receipt' ? 'دریافتی از مشتری' : 'پرداختی به طرف‌حساب',
      e.sourceLabel,
      e.methodLabel,
      e.trackingNumber || '',
      e.chequeDueDate || '',
      e.bankName || e.chequeOwner || '',
      e.invoiceNumber || '',
      [e.title, e.notes].filter(Boolean).join(' - '),
      e.direction === 'receipt' ? e.amount : -e.amount,
    ]);

    const csvContent =
      '\uFEFF' +
      [headers, ...rows].map((row) => row.map(escapeCell).join(',')).join('\r\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const safeDate = toEnglishDigits(getCurrentJalaliDate()).replace(/\//g, '-');
    link.download = `receipts-payments-${safeDate}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4 sm:space-y-5 text-right pb-8" dir="rtl">
      {/* TOP BAR */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight">
            لیست دریافت‌ها و پرداخت‌های مشتریان
          </h2>
          <p className="text-xs text-slate-500 mt-1 tabular-nums">
            <span>{toPersianDigits(globalCounts.all)} تراکنش مالی ثبت‌شده</span>
            <span className="mx-1.5 text-slate-300">·</span>
            <span className="text-emerald-700 font-medium">
              {toPersianDigits(globalCounts.receipts)} دریافتی
            </span>
            <span className="mx-1.5 text-slate-300">·</span>
            <span className="text-rose-700 font-medium">
              {toPersianDigits(globalCounts.payments)} پرداختی
            </span>
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            id="btn-export-payments-csv"
            disabled={filteredEntries.length === 0}
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>خروجی اکسل</span>
          </button>

          {canModify && customers.length > 0 && (
            <button
              type="button"
              id="btn-new-payment-entry"
              onClick={() => {
                setPickerSearch('');
                setPickerInitialType('deposit');
                setShowCustomerPicker(true);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>ثبت دریافت / پرداخت</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI METRIC STRIP (Single-Elevation, Clean Hairline Grid) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white border border-slate-200 rounded-2xl p-3.5 sm:p-4">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>جمع کل دریافتی‌ها</span>
            <ArrowDownLeft className="w-4 h-4 text-emerald-600 shrink-0" />
          </div>
          <div className="mt-2 font-mono tabular-nums text-base sm:text-lg font-extrabold text-emerald-700 truncate">
            {formatPrice(stats.totalReceipts, settings.currency)}
          </div>
          <div className="mt-1 text-[11px] text-slate-500 tabular-nums">
            {toPersianDigits(stats.receiptCount)} فقره دریافتی از مشتریان
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-3.5 sm:p-4">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>جمع کل پرداختی‌ها</span>
            <ArrowUpRight className="w-4 h-4 text-rose-600 shrink-0" />
          </div>
          <div className="mt-2 font-mono tabular-nums text-base sm:text-lg font-extrabold text-rose-700 truncate">
            {formatPrice(stats.totalPayments, settings.currency)}
          </div>
          <div className="mt-1 text-[11px] text-slate-500 tabular-nums">
            {toPersianDigits(stats.paymentCount)} فقره پرداختی به طرف‌حساب‌ها
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-3.5 sm:p-4">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>تراز خالص جریان نقدی</span>
            <Wallet className="w-4 h-4 text-slate-500 shrink-0" />
          </div>
          <div
            className={`mt-2 font-mono tabular-nums text-base sm:text-lg font-extrabold truncate ${
              stats.netFlow > 0
                ? 'text-emerald-700'
                : stats.netFlow < 0
                ? 'text-rose-700'
                : 'text-slate-800'
            }`}
          >
            {stats.netFlow < 0 ? '−' : stats.netFlow > 0 ? '+' : ''}
            {formatPrice(Math.abs(stats.netFlow), settings.currency)}
          </div>
          <div className="mt-1 text-[11px] text-slate-500">
            {stats.netFlow >= 0 ? 'خالص ورودی مثبت' : 'خالص خروجی بیشتر از ورودی'}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-3.5 sm:p-4">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>مجموع چک‌های ثبت‌شده</span>
            <FileSpreadsheet className="w-4 h-4 text-amber-600 shrink-0" />
          </div>
          <div className="mt-2 font-mono tabular-nums text-base sm:text-lg font-extrabold text-slate-900 truncate">
            {formatPrice(stats.chequeTotal, settings.currency)}
          </div>
          <div className="mt-1 text-[11px] text-slate-500 tabular-nums">
            {toPersianDigits(stats.chequeCount)} فقره چک در لیست فعلی
          </div>
        </div>
      </div>

      {/* FILTER BAR */}
      <div className="bg-white border border-slate-200 rounded-2xl p-3.5 sm:p-4 space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Segmented Direction Filter */}
          <div className="inline-flex items-center bg-slate-100 p-1 rounded-xl gap-1 w-full lg:w-auto">
            <button
              type="button"
              id="filter-dir-all"
              onClick={() => setDirectionFilter('all')}
              className={`flex-1 lg:flex-initial px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap tabular-nums ${
                directionFilter === 'all'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              همه ({toPersianDigits(globalCounts.all)})
            </button>
            <button
              type="button"
              id="filter-dir-receipt"
              onClick={() => setDirectionFilter('receipt')}
              className={`flex-1 lg:flex-initial px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap tabular-nums ${
                directionFilter === 'receipt'
                  ? 'bg-emerald-600 text-white'
                  : 'text-slate-600 hover:text-emerald-700'
              }`}
            >
              دریافتی‌ها ({toPersianDigits(globalCounts.receipts)})
            </button>
            <button
              type="button"
              id="filter-dir-payment"
              onClick={() => setDirectionFilter('payment')}
              className={`flex-1 lg:flex-initial px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap tabular-nums ${
                directionFilter === 'payment'
                  ? 'bg-rose-600 text-white'
                  : 'text-slate-600 hover:text-rose-700'
              }`}
            >
              پرداختی‌ها ({toPersianDigits(globalCounts.payments)})
            </button>
          </div>

          {/* Search + Toggle Advanced Filters */}
          <div className="flex items-center gap-2 flex-1 lg:max-w-xl">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                id="payments-search-input"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="جستجو بر اساس نام مشتری، شماره فاکتور، شماره چک، بانک، مبلغ یا شرح..."
                className="w-full pr-9 pl-8 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder:text-slate-400 outline-none focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15 transition-all"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  title="پاک کردن جستجو"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <button
              type="button"
              id="toggle-advanced-filters-btn"
              onClick={() => setShowAdvancedFilters((prev) => !prev)}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                showAdvancedFilters || selectedCustomerKey !== 'all' || methodFilter !== 'all' || dateFrom || dateTo
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">فیلترها</span>
            </button>

            {hasActiveFilters && (
              <button
                type="button"
                id="reset-payments-filters-btn"
                onClick={resetAllFilters}
                className="inline-flex items-center gap-1 px-2.5 py-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:text-rose-600 hover:border-rose-200 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0"
                title="پاک کردن تمام فیلترها"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span className="hidden md:inline">بازنشانی</span>
              </button>
            )}
          </div>
        </div>

        {/* Advanced Filter Row */}
        {showAdvancedFilters && (
          <div className="pt-3 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">مشتری / طرف‌حساب</label>
              <select
                value={selectedCustomerKey}
                onChange={(e) => setSelectedCustomerKey(e.target.value)}
                className="w-full h-9 px-2.5 text-xs bg-white border border-slate-200 rounded-xl text-slate-800 outline-none focus:border-emerald-500"
              >
                <option value="all">همه مشتریان ({toPersianDigits(customerFilterOptions.length)})</option>
                {customerFilterOptions.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">روش پرداخت</label>
              <select
                value={methodFilter}
                onChange={(e) => setMethodFilter(e.target.value as 'all' | CanonicalMethod)}
                className="w-full h-9 px-2.5 text-xs bg-white border border-slate-200 rounded-xl text-slate-800 outline-none focus:border-emerald-500"
              >
                <option value="all">همه روش‌ها</option>
                <option value="cash">نقدی</option>
                <option value="card">کارت به کارت</option>
                <option value="pos">کارتخوان</option>
                <option value="transfer">حواله بانکی</option>
                <option value="cheque">چک</option>
                <option value="other">سایر</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">از تاریخ (شمسی)</label>
              <JalaliDatePicker
                value={dateFrom}
                onChange={setDateFrom}
                placeholder="انتخاب تاریخ شروع"
                buttonClassName="h-9 text-xs"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">تا تاریخ (شمسی)</label>
              <JalaliDatePicker
                value={dateTo}
                onChange={setDateTo}
                placeholder="انتخاب تاریخ پایان"
                buttonClassName="h-9 text-xs"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">مرتب‌سازی</label>
              <select
                value={sortMode}
                onChange={(e) => setSortMode(e.target.value as SortMode)}
                className="w-full h-9 px-2.5 text-xs bg-white border border-slate-200 rounded-xl text-slate-800 outline-none focus:border-emerald-500"
              >
                <option value="date_desc">جدیدترین تاریخ</option>
                <option value="date_asc">قدیمی‌ترین تاریخ</option>
                <option value="amount_desc">بیشترین مبلغ</option>
                <option value="amount_asc">کمترین مبلغ</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* DATA VIEW: POPULATED OR EMPTY */}
      {filteredEntries.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
            <Wallet className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-slate-800">
            {allEntries.length === 0
              ? 'هنوز هیچ دریافت یا پرداختی ثبت نشده است'
              : 'موردی با فیلترهای انتخاب‌شده یافت نشد'}
          </h3>
          <p className="text-xs text-slate-500 mt-1.5 max-w-md mx-auto leading-relaxed">
            {allEntries.length === 0
              ? 'تمام واریزها، چک‌های دریافتی، تسویه فاکتورهای فروش و پرداخت‌های انجام‌شده به طرف‌حساب‌ها به‌صورت خودکار در این بخش نمایش داده می‌شوند.'
              : 'برای مشاهده سایر تراکنش‌ها، عبارت جستجو یا فیلترهای تاریخ و مشتری را تغییر دهید.'}
          </p>
          <div className="mt-4 flex items-center justify-center gap-2">
            {hasActiveFilters ? (
              <button
                type="button"
                onClick={resetAllFilters}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>پاک کردن فیلترها</span>
              </button>
            ) : (
              canModify &&
              customers.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setPickerSearch('');
                    setPickerInitialType('deposit');
                    setShowCustomerPicker(true);
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>ثبت اولین دریافت / پرداخت</span>
                </button>
              )
            )}
          </div>
        </div>
      ) : (
        <>
          {/* DESKTOP HIGH-DENSITY DATA TABLE */}
          <div className="hidden md:block bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-bold text-slate-500">
                    <th className="py-2.5 px-3 w-11 text-center">#</th>
                    <th className="py-2.5 px-3 whitespace-nowrap">تاریخ</th>
                    <th className="py-2.5 px-3">مشتری / طرف‌حساب</th>
                    <th className="py-2.5 px-3 whitespace-nowrap">نوع</th>
                    <th className="py-2.5 px-3">روش و جزئیات</th>
                    <th className="py-2.5 px-3">شرح و مرجع</th>
                    <th className="py-2.5 px-3 text-left whitespace-nowrap">مبلغ ({settings.currency})</th>
                    <th className="py-2.5 px-3 text-center w-24 whitespace-nowrap">عملیات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                  {paginatedEntries.map((entry, idx) => {
                    const rowNumber = pageSize === 0 ? idx + 1 : (currentPage - 1) * pageSize + idx + 1;
                    const isReceipt = entry.direction === 'receipt';

                    const detailBits = [
                      entry.trackingNumber
                        ? entry.method === 'cheque'
                          ? `شماره چک: ${toPersianDigits(entry.trackingNumber)}`
                          : `پیگیری: ${toPersianDigits(entry.trackingNumber)}`
                        : '',
                      entry.chequeDueDate ? `سررسید: ${toPersianDigits(entry.chequeDueDate)}` : '',
                      entry.bankName ? `بانک ${entry.bankName}` : '',
                      entry.chequeOwner ? `صاحب چک: ${entry.chequeOwner}` : '',
                    ].filter(Boolean);

                    return (
                      <tr
                        key={entry.id}
                        onClick={() => setSelectedEntryId(entry.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setSelectedEntryId(entry.id);
                          }
                        }}
                        tabIndex={0}
                        title="برای مشاهده جزئیات کامل این رکورد کلیک کنید"
                        className="hover:bg-slate-50/90 focus:bg-slate-50 focus:outline-none transition-colors align-middle cursor-pointer"
                      >
                        <td className="py-2.5 px-3 text-center text-slate-400 font-mono tabular-nums text-[11px]">
                          {toPersianDigits(rowNumber)}
                        </td>

                        <td className="py-2.5 px-3 whitespace-nowrap font-mono tabular-nums text-slate-700">
                          {toPersianDigits(entry.date || '—')}
                        </td>

                        <td className="py-2.5 px-3 max-w-[200px]">
                          <div className="font-bold text-slate-900 truncate">{entry.customerName}</div>
                          {entry.customerPhone && (
                            <div className="text-[11px] text-slate-400 font-mono tabular-nums truncate mt-0.5">
                              {toPersianDigits(entry.customerPhone)}
                            </div>
                          )}
                        </td>

                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1 font-bold text-xs ${
                              isReceipt ? 'text-emerald-700' : 'text-rose-700'
                            }`}
                          >
                            {isReceipt ? (
                              <ArrowDownLeft className="w-3.5 h-3.5 shrink-0" />
                            ) : (
                              <ArrowUpRight className="w-3.5 h-3.5 shrink-0" />
                            )}
                            <span>{isReceipt ? 'دریافتی' : 'پرداختی'}</span>
                          </span>
                          <div className="text-[10.5px] text-slate-400 mt-0.5">{entry.sourceLabel}</div>
                        </td>

                        <td className="py-2.5 px-3 max-w-[220px]">
                          <div className="font-semibold text-slate-800">{entry.methodLabel}</div>
                          {detailBits.length > 0 && (
                            <div className="text-[11px] text-slate-500 mt-0.5 truncate" title={detailBits.join(' · ')}>
                              {detailBits.join(' · ')}
                            </div>
                          )}
                        </td>

                        <td className="py-2.5 px-3 max-w-[260px]">
                          <div className="text-slate-800 font-medium truncate" title={entry.title}>
                            {entry.title}
                          </div>
                          <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mt-0.5 truncate">
                            {entry.invoiceNumber && entry.rawInvoice && onViewInvoice ? (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onViewInvoice(entry.rawInvoice!);
                                }}
                                className="text-sky-700 hover:text-sky-900 hover:underline font-mono tabular-nums font-semibold cursor-pointer shrink-0"
                              >
                                فاکتور #{toPersianDigits(entry.invoiceNumber)}
                              </button>
                            ) : entry.invoiceNumber ? (
                              <span className="font-mono tabular-nums text-slate-500 shrink-0">
                                فاکتور #{toPersianDigits(entry.invoiceNumber)}
                              </span>
                            ) : null}
                            {entry.invoiceNumber && entry.notes && <span>·</span>}
                            {entry.notes && (
                              <span className="truncate" title={entry.notes}>
                                {entry.notes}
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="py-2.5 px-3 text-left whitespace-nowrap">
                          <span
                            className={`font-mono tabular-nums font-extrabold text-[13px] ${
                              isReceipt ? 'text-emerald-700' : 'text-rose-700'
                            }`}
                          >
                            {isReceipt ? '+' : '−'}
                            {formatPrice(entry.amount, '')}
                          </span>
                        </td>

                        <td
                          className="py-2.5 px-3 text-center whitespace-nowrap"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="inline-flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => setSelectedEntryId(entry.id)}
                              title="مشاهده جزئیات رکورد"
                              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            {entry.rawTransaction && canModify && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleEditEntry(entry)}
                                  title="ویرایش سند"
                                  className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 transition-colors cursor-pointer"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteEntry(entry)}
                                  title="حذف سند"
                                  className="p-1.5 rounded-lg text-slate-500 hover:text-rose-700 hover:bg-rose-50 transition-colors cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* MOBILE COMPACT LIST */}
          <div className="md:hidden space-y-2.5">
            {paginatedEntries.map((entry) => {
              const isReceipt = entry.direction === 'receipt';
              const detailBits = [
                entry.methodLabel,
                entry.trackingNumber ? `کد: ${toPersianDigits(entry.trackingNumber)}` : '',
                entry.chequeDueDate ? `سررسید: ${toPersianDigits(entry.chequeDueDate)}` : '',
                entry.bankName ? `بانک ${entry.bankName}` : '',
              ].filter(Boolean);

              return (
                <div
                  key={entry.id}
                  onClick={() => setSelectedEntryId(entry.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setSelectedEntryId(entry.id);
                    }
                  }}
                  className="bg-white border border-slate-200 hover:border-slate-300 rounded-2xl p-3.5 space-y-2 transition-colors cursor-pointer"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-bold text-sm text-slate-900 truncate">{entry.customerName}</div>
                      <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1.5 flex-wrap">
                        <span
                          className={`inline-flex items-center gap-0.5 font-bold ${
                            isReceipt ? 'text-emerald-700' : 'text-rose-700'
                          }`}
                        >
                          {isReceipt ? (
                            <ArrowDownLeft className="w-3 h-3" />
                          ) : (
                            <ArrowUpRight className="w-3 h-3" />
                          )}
                          <span>{isReceipt ? 'دریافتی' : 'پرداختی'}</span>
                        </span>
                        <span className="text-slate-300">·</span>
                        <span className="font-mono tabular-nums">{toPersianDigits(entry.date || '—')}</span>
                      </div>
                    </div>
                    <div
                      className={`font-mono tabular-nums font-extrabold text-sm shrink-0 ${
                        isReceipt ? 'text-emerald-700' : 'text-rose-700'
                      }`}
                    >
                      {isReceipt ? '+' : '−'}
                      {formatPrice(entry.amount, settings.currency)}
                    </div>
                  </div>

                  <div className="text-xs text-slate-600">{detailBits.join(' · ')}</div>

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                    <div className="text-[11px] text-slate-500 truncate min-w-0">
                      {entry.title}
                      {entry.notes ? ` — ${entry.notes}` : ''}
                    </div>
                    <div
                      className="flex items-center gap-1 shrink-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        onClick={() => setSelectedEntryId(entry.id)}
                        className="p-1.5 rounded-lg text-slate-600 bg-slate-100 hover:bg-slate-200 cursor-pointer"
                        title="مشاهده جزئیات"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      {entry.rawTransaction && canModify && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleEditEntry(entry)}
                            className="p-1.5 rounded-lg text-emerald-700 bg-emerald-50 hover:bg-emerald-100 cursor-pointer"
                            title="ویرایش"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteEntry(entry)}
                            className="p-1.5 rounded-lg text-rose-700 bg-rose-50 hover:bg-rose-100 cursor-pointer"
                            title="حذف"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* PAGINATION */}
          <SmartPagination
            currentPage={currentPage}
            totalItems={filteredEntries.length}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setCurrentPage(1);
            }}
            itemLabel="تراکنش"
          />
        </>
      )}

      {/* PAYMENT / RECEIPT ENTRY DETAILS MODAL */}
      {selectedEntry && (() => {
        const isReceipt = selectedEntry.direction === 'receipt';
        const linkedInvoice = selectedEntry.rawInvoice;
        const linkedPurchase = selectedEntry.rawPurchaseInvoice;
        const invoiceTotal = linkedInvoice?.finalTotal ?? linkedPurchase?.finalTotal;
        const invoicePaid = linkedInvoice?.paidAmount ?? linkedPurchase?.paidAmount;
        const invoiceRemaining =
          invoiceTotal !== undefined && invoicePaid !== undefined
            ? Math.max(0, invoiceTotal - invoicePaid)
            : undefined;

        return (
          <div
            id="payment-entry-details-modal"
            className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
            onClick={() => setSelectedEntryId(null)}
          >
            <div
              className="bg-white w-full max-w-lg rounded-2xl border border-slate-200 shadow-2xl overflow-hidden text-right my-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${
                      isReceipt
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                        : 'bg-rose-50 border-rose-200 text-rose-700'
                    }`}
                  >
                    {isReceipt ? (
                      <ArrowDownLeft className="w-5 h-5" />
                    ) : (
                      <ArrowUpRight className="w-5 h-5" />
                    )}
                  </span>
                  <div className="min-w-0">
                    <h3 className="font-extrabold text-sm sm:text-base text-slate-900 truncate">
                      {isReceipt ? 'جزئیات سند دریافتی از مشتری' : 'جزئیات سند پرداختی به طرف‌حساب'}
                    </h3>
                    <div className="text-[11px] text-slate-500 mt-0.5 truncate">
                      <span>{selectedEntry.sourceLabel}</span>
                      <span className="mx-1.5 text-slate-300">·</span>
                      <span className="font-mono tabular-nums">
                        {toPersianDigits(selectedEntry.date || '—')}
                      </span>
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedEntryId(null)}
                  className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors cursor-pointer shrink-0"
                  title="بستن"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Amount Highlight Strip */}
              <div className="px-5 py-4 bg-slate-50/80 border-b border-slate-100">
                <div className="text-[11px] font-medium text-slate-500">
                  {isReceipt ? 'مبلغ دریافت‌شده' : 'مبلغ پرداخت‌شده'}
                </div>
                <div
                  className={`mt-1 font-mono tabular-nums text-2xl font-black tracking-tight ${
                    isReceipt ? 'text-emerald-700' : 'text-rose-700'
                  }`}
                >
                  {isReceipt ? '+' : '−'}
                  {formatPrice(selectedEntry.amount, settings.currency)}
                </div>

                {invoiceTotal !== undefined && invoiceRemaining !== undefined && (
                  <div className="mt-2 pt-2 border-t border-slate-200/70 text-[11px] text-slate-600 flex flex-wrap items-center gap-x-2 gap-y-1 tabular-nums">
                    <span>
                      مبلغ کل فاکتور:{' '}
                      <strong className="font-mono text-slate-900">
                        {formatPrice(invoiceTotal, settings.currency)}
                      </strong>
                    </span>
                    <span className="text-slate-300">·</span>
                    <span>
                      مانده فاکتور:{' '}
                      <strong
                        className={`font-mono ${
                          invoiceRemaining > 0 ? 'text-rose-700' : 'text-emerald-700'
                        }`}
                      >
                        {invoiceRemaining === 0
                          ? 'تسویه کامل'
                          : formatPrice(invoiceRemaining, settings.currency)}
                      </strong>
                    </span>
                  </div>
                )}
              </div>

              {/* Structured Details Body */}
              <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <div className="text-[11px] text-slate-400 font-medium">مشتری / طرف‌حساب</div>
                    <div className="mt-0.5 font-bold text-slate-900">{selectedEntry.customerName}</div>
                    {selectedEntry.customerPhone && (
                      <div className="text-[11px] text-slate-500 font-mono tabular-nums mt-0.5">
                        {toPersianDigits(selectedEntry.customerPhone)}
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="text-[11px] text-slate-400 font-medium">تاریخ سند</div>
                    <div className="mt-0.5 font-mono tabular-nums font-bold text-slate-900">
                      {toPersianDigits(selectedEntry.date || '—')}
                    </div>
                  </div>

                  <div>
                    <div className="text-[11px] text-slate-400 font-medium">نوع تراکنش</div>
                    <div
                      className={`mt-0.5 font-bold ${
                        isReceipt ? 'text-emerald-700' : 'text-rose-700'
                      }`}
                    >
                      {isReceipt ? 'دریافتی (ورودی به صندوق/حساب)' : 'پرداختی (خروجی به طرف‌حساب)'}
                    </div>
                  </div>

                  <div>
                    <div className="text-[11px] text-slate-400 font-medium">روش پرداخت</div>
                    <div className="mt-0.5 font-bold text-slate-900">{selectedEntry.methodLabel}</div>
                  </div>

                  {selectedEntry.trackingNumber && (
                    <div>
                      <div className="text-[11px] text-slate-400 font-medium">
                        {selectedEntry.method === 'cheque' ? 'شماره چک صیادی' : 'شماره پیگیری / ارجاع'}
                      </div>
                      <div className="mt-0.5 font-mono tabular-nums font-bold text-slate-900">
                        {toPersianDigits(selectedEntry.trackingNumber)}
                      </div>
                    </div>
                  )}

                  {selectedEntry.chequeDueDate && (
                    <div>
                      <div className="text-[11px] text-slate-400 font-medium">تاریخ سررسید چک</div>
                      <div className="mt-0.5 font-mono tabular-nums font-bold text-amber-700">
                        {toPersianDigits(selectedEntry.chequeDueDate)}
                      </div>
                    </div>
                  )}

                  {(selectedEntry.bankName || selectedEntry.chequeOwner) && (
                    <div>
                      <div className="text-[11px] text-slate-400 font-medium">
                        {selectedEntry.method === 'cheque' ? 'بانک / صاحب حساب چک' : 'بانک / حساب'}
                      </div>
                      <div className="mt-0.5 font-bold text-slate-900">
                        {[selectedEntry.bankName, selectedEntry.chequeOwner].filter(Boolean).join(' · ')}
                      </div>
                    </div>
                  )}

                  {selectedEntry.invoiceNumber && (
                    <div>
                      <div className="text-[11px] text-slate-400 font-medium">شماره فاکتور مرتبط</div>
                      <div className="mt-0.5 font-mono tabular-nums font-bold text-slate-900">
                        {linkedInvoice && onViewInvoice ? (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedEntryId(null);
                              onViewInvoice(linkedInvoice);
                            }}
                            className="text-sky-700 hover:text-sky-900 hover:underline cursor-pointer"
                          >
                            فاکتور #{toPersianDigits(selectedEntry.invoiceNumber)}
                          </button>
                        ) : (
                          `فاکتور #${toPersianDigits(selectedEntry.invoiceNumber)}`
                        )}
                      </div>
                    </div>
                  )}

                  {selectedEntry.recordedBy && (
                    <div>
                      <div className="text-[11px] text-slate-400 font-medium">ثبت‌کننده</div>
                      <div className="mt-0.5 font-semibold text-slate-800">{selectedEntry.recordedBy}</div>
                    </div>
                  )}

                  {selectedEntry.createdAt && (
                    <div>
                      <div className="text-[11px] text-slate-400 font-medium">تاریخ ثبت سیستمی</div>
                      <div className="mt-0.5 font-mono tabular-nums text-slate-700">
                        {toPersianDigits(selectedEntry.createdAt)}
                      </div>
                    </div>
                  )}
                </div>

                {/* Title & Full Notes */}
                <div className="pt-3.5 border-t border-slate-100 space-y-2.5">
                  <div>
                    <div className="text-[11px] text-slate-400 font-medium">عنوان / بابت</div>
                    <div className="mt-0.5 font-semibold text-slate-900 leading-relaxed">
                      {selectedEntry.title}
                    </div>
                  </div>

                  {selectedEntry.notes && (
                    <div>
                      <div className="text-[11px] text-slate-400 font-medium">توضیحات تکمیلی</div>
                      <div className="mt-1 p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-slate-700 leading-relaxed whitespace-pre-wrap">
                        {selectedEntry.notes}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Modal Footer */}
              <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  {linkedInvoice && onViewInvoice && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedEntryId(null);
                        onViewInvoice(linkedInvoice);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold transition-colors cursor-pointer whitespace-nowrap"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>مشاهده فاکتور مرتبط</span>
                    </button>
                  )}

                  {selectedEntry.rawTransaction && canModify && (
                    <>
                      <button
                        type="button"
                        onClick={() => handleEditEntry(selectedEntry)}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors cursor-pointer whitespace-nowrap"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>ویرایش سند</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteEntry(selectedEntry)}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-rose-200 bg-white hover:bg-rose-50 text-rose-700 text-xs font-bold transition-colors cursor-pointer whitespace-nowrap"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>حذف</span>
                      </button>
                    </>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedEntryId(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold transition-colors cursor-pointer whitespace-nowrap"
                >
                  بستن
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* CUSTOMER PICKER MODAL FOR QUICK RECORDING */}
      {showCustomerPicker && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4"
          onClick={() => setShowCustomerPicker(false)}
        >
          <div
            className="bg-white w-full max-w-md rounded-2xl border border-slate-200 shadow-2xl overflow-hidden text-right"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3.5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm text-slate-900">انتخاب مشتری برای ثبت دریافت / پرداخت</h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  ابتدا نوع سند و مشتری مورد نظر را انتخاب کنید.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCustomerPicker(false)}
                className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPickerInitialType('deposit')}
                  className={`py-2 px-3 rounded-xl text-xs font-bold border transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
                    pickerInitialType === 'deposit'
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <ArrowDownLeft className="w-3.5 h-3.5" />
                  <span>ثبت دریافتی</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPickerInitialType('debt')}
                  className={`py-2 px-3 rounded-xl text-xs font-bold border transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
                    pickerInitialType === 'debt'
                      ? 'bg-rose-600 text-white border-rose-600'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <ArrowUpRight className="w-3.5 h-3.5" />
                  <span>ثبت پرداختی</span>
                </button>
              </div>

              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  autoFocus
                  value={pickerSearch}
                  onChange={(e) => setPickerSearch(e.target.value)}
                  placeholder="جستجوی نام یا شماره تماس مشتری..."
                  className="w-full pr-9 pl-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-emerald-500"
                />
              </div>

              <div className="max-h-64 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-xl">
                {filteredPickerCustomers.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-400">مشتری با این مشخصات یافت نشد.</div>
                ) : (
                  filteredPickerCustomers.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        setShowCustomerPicker(false);
                        setEditingTransaction(null);
                        setActiveModalInitialType(pickerInitialType);
                        setActiveModalCustomer(c);
                      }}
                      className="w-full px-3 py-2.5 flex items-center justify-between gap-2 hover:bg-slate-50 transition-colors text-right cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="w-7 h-7 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
                          <User className="w-3.5 h-3.5" />
                        </span>
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-slate-900 truncate">{c.name}</div>
                          {c.phone && (
                            <div className="text-[11px] text-slate-400 font-mono tabular-nums truncate">
                              {toPersianDigits(c.phone)}
                            </div>
                          )}
                        </div>
                      </div>
                      <span className="text-[11px] font-semibold text-emerald-700 shrink-0">انتخاب</span>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TRANSACTION CREATE / EDIT MODAL */}
      <CustomerTransactionModal
        isOpen={Boolean(activeModalCustomer)}
        onClose={() => {
          setActiveModalCustomer(null);
          setEditingTransaction(null);
        }}
        customer={activeModalCustomer}
        initialType={activeModalInitialType}
        invoices={invoices}
        transactions={transactions}
        settings={settings}
        currentUser={currentUser}
        onSaveTransaction={onSaveTransaction}
        editingTransaction={editingTransaction}
      />
    </div>
  );
};
