import React, { useState, useMemo, useEffect } from 'react';
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
  Filter,
  FileDown,
  Loader2,
  ShoppingBag,
  Send,
  Pencil,
  Coins,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  SlidersHorizontal,
  RotateCcw,
  Hash,
  FilterX,
  Layers
} from 'lucide-react';
import { 
  Customer, 
  Invoice, 
  InvoiceItem,
  StoreSettings, 
  AppUser, 
  CustomerTransaction, 
  CustomerLedgerEntry, 
  CustomerPaymentMethod 
} from '../types';
import { StorageService } from '../utils/storage';
import { formatPrice, toPersianDigits, getCurrentJalaliDate, numberToPersianWords, addDaysToJalali } from '../utils/jalali';
import { exportCustomerStatementToExcel } from '../utils/excelHelper';
import { exportElementToPdf } from '../utils/pdfHelper';
import { CustomerTransactionModal } from './CustomerTransactionModal';
import { NumericInput } from './NumericInput';
import { SmartPagination, paginateArray } from './SmartPagination';
import { sendTelegramTextMessage } from '../utils/telegramService';

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
  onEditInvoice?: (invoice: Invoice) => void;
  onDeleteInvoice?: (invoiceId: string) => void;
  onUpdatePaymentStatus?: (invoiceId: string, status: 'paid' | 'unpaid' | 'partial', paidAmount?: number) => void;
  initialFormType?: 'none' | 'deposit' | 'debt';
}

const STATEMENT_DOC_TYPES = [
  { id: 'sales_goods', label: 'فروش (کالا)', fullName: 'فاکتورهای فروش کالا' },
  { id: 'sales_service', label: 'خدمات', fullName: 'فاکتورهای خدمات' },
  { id: 'deposit', label: 'واریزی‌ها', fullName: 'واریزی‌ها و دریافت‌ها' },
  { id: 'debt', label: 'بدهی دستی', fullName: 'اسناد بدهی دستی' },
  { id: 'purchase', label: 'خرید تامین‌کننده', fullName: 'فاکتور و پرداخت خرید' },
  { id: 'cheque', label: 'چک / پیگیری', fullName: 'اسناد شامل چک یا شماره پیگیری' },
] as const;

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
  onEditInvoice,
  onDeleteInvoice,
  onUpdatePaymentStatus,
  initialFormType = 'none',
}) => {
  // Active sub-modal for registering deposit or debt
  const [activeTxnModalType, setActiveTxnModalType] = useState<'deposit' | 'debt' | null>(
    initialFormType && initialFormType !== 'none' ? initialFormType : null
  );
  const [filterType, setFilterType] = useState<'all' | 'debt' | 'deposit'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Advanced multi-condition filters (supports multi-select document types)
  const [selectedDocTypes, setSelectedDocTypes] = useState<string[]>([]);
  const [dateFilterMode, setDateFilterMode] = useState<'all' | '30days' | '90days' | 'this_year' | 'custom'>('all');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [minAmount, setMinAmount] = useState<number | ''>('');
  const [maxAmount, setMaxAmount] = useState<number | ''>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'unsettled' | 'debtor' | 'creditor'>('all');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState<boolean>(false);

  // Toggle single document type in multi-select
  const handleToggleDocType = (typeId: string) => {
    setSelectedDocTypes((prev) =>
      prev.includes(typeId) ? prev.filter((t) => t !== typeId) : [...prev, typeId]
    );
  };

  // Set quick document type presets (e.g. sales + services without deposits, or sales + deposits without services)
  const handleSetDocTypePreset = (
    preset: 'all' | 'sales_and_services' | 'sales_and_deposits' | 'only_services' | 'only_deposits' | 'only_goods'
  ) => {
    switch (preset) {
      case 'sales_and_services':
        setSelectedDocTypes(['sales_goods', 'sales_service']);
        break;
      case 'sales_and_deposits':
        setSelectedDocTypes(['sales_goods', 'deposit']);
        break;
      case 'only_services':
        setSelectedDocTypes(['sales_service']);
        break;
      case 'only_deposits':
        setSelectedDocTypes(['deposit']);
        break;
      case 'only_goods':
        setSelectedDocTypes(['sales_goods']);
        break;
      case 'all':
      default:
        setSelectedDocTypes([]);
        break;
    }
  };

  // Sorting state by table headers
  const [sortField, setSortField] = useState<
    'default' | 'date' | 'documentType' | 'documentNumber' | 'description' | 'debit' | 'credit' | 'balance'
  >('default');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const [entriesPage, setEntriesPage] = useState(1);
  const [entriesPageSize, setEntriesPageSize] = useState(50);

  useEffect(() => {
    setEntriesPage(1);
  }, [
    filterType,
    searchQuery,
    selectedDocTypes,
    dateFilterMode,
    customStartDate,
    customEndDate,
    minAmount,
    maxAmount,
    statusFilter,
    sortField,
    sortDirection,
    customer?.id,
  ]);

  const [transactionToEdit, setTransactionToEdit] = useState<CustomerTransaction | null>(null);

  // Universal deletion state (for manual deposit/debt, invoice payment, or invoice debt)
  const [itemToDelete, setItemToDelete] = useState<{
    type: 'transaction' | 'invoice_payment' | 'invoice';
    id: string;
    amount: number;
    title: string;
    invoice?: Invoice;
    transaction?: CustomerTransaction;
  } | null>(null);

  // Invoice payment edit modal state
  const [invoicePaymentToEdit, setInvoicePaymentToEdit] = useState<Invoice | null>(null);
  const [editPaymentAmount, setEditPaymentAmount] = useState<number>(0);
  const [editPaymentMethod, setEditPaymentMethod] = useState<string>('cash');
  const [editPaymentTracking, setEditPaymentTracking] = useState<string>('');
  const [editPaymentNote, setEditPaymentNote] = useState<string>('');

  // Local state trigger to immediately reflect invoice changes if updated internally
  const [ledgerVersion, setLedgerVersion] = useState<number>(0);

  // View Controls: Default is 'table' (نمای جدولی پیش‌فرض)
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('table');
  const [showMobileDetails, setShowMobileDetails] = useState<boolean>(false);
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false);
  const [pdfSuccessMessage, setPdfSuccessMessage] = useState<string | null>(null);
  const [showSuppliers, setShowSuppliers] = useState<boolean>(true);
  // Compact brief invoice details modal state when clicking a ledger row
  const [briefInvoiceEntry, setBriefInvoiceEntry] = useState<CustomerLedgerEntry | null>(null);

  // Helper to check if an invoice item is a service
  const isServiceItem = (it: InvoiceItem) =>
    Boolean(
      it.isService ||
      it.itemType === 'service' ||
      it.id?.startsWith('service-') ||
      (it.productCode || it.code || '').toUpperCase().startsWith('SRV-') ||
      !it.productId
    );

  // Helper to inspect service status of an invoice
  const getInvoiceServiceInfo = (inv?: Invoice) => {
    if (!inv || !Array.isArray(inv.items) || inv.items.length === 0) {
      return { hasService: false, isOnlyService: false, serviceNames: [] as string[] };
    }
    const srvItems = inv.items.filter(isServiceItem);
    const prodItems = inv.items.filter((it) => !isServiceItem(it));
    return {
      hasService: srvItems.length > 0,
      isOnlyService: srvItems.length > 0 && prodItems.length === 0,
      serviceNames: srvItems.map((s) => (s.productName || s.name || '').trim()).filter(Boolean),
    };
  };

  // Open separate transaction modal
  const handleOpenTransactionModal = (type: 'deposit' | 'debt') => {
    setTransactionToEdit(null);
    setActiveTxnModalType(type);
  };

  // Helper to format document type label clean and concisely
  const getDisplayDocTypeLabel = (entry: { documentType: string; documentTypeLabel: string }) => {
    if (
      entry.documentType === 'deposit' ||
      entry.documentTypeLabel === 'واریزی / واریز به حساب (با ثبت توضیحات)' ||
      entry.documentTypeLabel?.startsWith('واریزی /')
    ) {
      return 'واریز';
    }
    return entry.documentTypeLabel;
  };

  // Open edit modal for a transaction
  const handleOpenEditTransaction = (txn: CustomerTransaction) => {
    setTransactionToEdit(txn);
    setActiveTxnModalType(txn.type);
  };

  // Open edit modal for invoice payment
  const handleOpenEditInvoicePayment = (inv: Invoice) => {
    setInvoicePaymentToEdit(inv);
    setEditPaymentAmount(inv.paidAmount || 0);
    setEditPaymentMethod(inv.paymentMethod || 'cash');
    setEditPaymentTracking(inv.chequeNumber || '');
    setEditPaymentNote(inv.transferDescription || inv.notes || '');
  };

  // Save edited invoice payment
  const handleSaveInvoicePayment = () => {
    if (!invoicePaymentToEdit) return;
    const cleanAmount = Math.max(0, Number(editPaymentAmount) || 0);
    const newStatus = cleanAmount >= invoicePaymentToEdit.finalTotal ? 'paid' : cleanAmount > 0 ? 'partial' : 'unpaid';
    const updatedInv: Invoice = {
      ...invoicePaymentToEdit,
      paidAmount: cleanAmount,
      paymentStatus: newStatus,
      paymentMethod: editPaymentMethod as any,
      chequeNumber: editPaymentTracking.trim() || undefined,
      transferDescription: editPaymentNote.trim() || undefined,
      updatedAt: getCurrentJalaliDate(),
    };

    StorageService.updateInvoice(updatedInv);
    if (onUpdatePaymentStatus) {
      onUpdatePaymentStatus(invoicePaymentToEdit.id, newStatus, cleanAmount);
    }

    StorageService.logActivity({
      category: 'sales',
      actionType: 'update_payment',
      actionTitle: 'ویرایش واریزی فاکتور',
      details: `ویرایش مبلغ پرداختی فاکتور شماره ${invoicePaymentToEdit.invoiceNumber} به ${cleanAmount.toLocaleString('fa-IR')} ${settings.currency}`,
    });

    setLedgerVersion((v) => v + 1);
    setInvoicePaymentToEdit(null);
  };

  // Universal deletion handler
  const handleConfirmDelete = () => {
    if (!itemToDelete) return;

    if (itemToDelete.type === 'transaction') {
      onDeleteTransaction(itemToDelete.id);
    } else if (itemToDelete.type === 'invoice_payment' && itemToDelete.invoice) {
      const updatedInv: Invoice = {
        ...itemToDelete.invoice,
        paidAmount: 0,
        paymentStatus: 'unpaid',
        updatedAt: getCurrentJalaliDate(),
      };
      StorageService.updateInvoice(updatedInv);
      if (onUpdatePaymentStatus) {
        onUpdatePaymentStatus(itemToDelete.invoice.id, 'unpaid', 0);
      }
      StorageService.logActivity({
        category: 'sales',
        actionType: 'update_payment',
        actionTitle: 'حذف واریزی فاکتور',
        details: `حذف واریزی فاکتور شماره ${itemToDelete.invoice.invoiceNumber} و بازگشت فاکتور به حالت بدهکار`,
      });
      setLedgerVersion((v) => v + 1);
    } else if (itemToDelete.type === 'invoice' && itemToDelete.invoice) {
      if (onDeleteInvoice) {
        onDeleteInvoice(itemToDelete.invoice.id);
      } else {
        StorageService.deleteInvoice(itemToDelete.invoice.id);
      }
      setLedgerVersion((v) => v + 1);
    }

    setItemToDelete(null);
  };

  // Sync initialFormType when modal opens
  React.useEffect(() => {
    if (isOpen && initialFormType && initialFormType !== 'none') {
      setActiveTxnModalType((prev) => (prev !== initialFormType ? initialFormType : prev));
    }
  }, [isOpen, initialFormType]);

  // Live invoices list (refreshes if user edited/deleted invoice payment directly)
  const activeInvoices = useMemo(() => {
    if (ledgerVersion > 0) {
      return StorageService.getInvoices();
    }
    return invoices;
  }, [invoices, ledgerVersion]);

  // Build the complete customer ledger
  const fullLedger = useMemo(() => {
    if (!customer) {
      return { 
        customer: null as any, 
        entries: [], 
        totalDebit: 0, 
        totalCredit: 0, 
        netBalance: 0,
        balanceStatus: 'settled' as const,
        unpaidInvoicesCount: 0,
      };
    }
    return StorageService.buildCustomerLedger(customer, activeInvoices, transactions);
  }, [customer, activeInvoices, transactions, ledgerVersion]);

  // Unpaid invoices for this customer
  const unpaidInvoices = useMemo(() => {
    if (!customer) return [];
    return activeInvoices
      .filter((inv) => {
        if (inv.isProforma) return false;
        const matchesCustomer = 
          (inv.customerId && inv.customerId === customer.id) ||
          (inv.customerName && inv.customerName.trim().toLowerCase() === customer.name.trim().toLowerCase());
        if (!matchesCustomer) return false;
        return inv.paymentStatus === 'unpaid' || inv.paymentStatus === 'partial';
      })
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [activeInvoices, customer]);

  // Sorting toggles
  const handleToggleSort = (
    field: 'date' | 'documentType' | 'documentNumber' | 'description' | 'debit' | 'credit' | 'balance'
  ) => {
    if (sortField === field) {
      if (sortDirection === 'desc') {
        setSortDirection('asc');
      } else {
        setSortField('default');
        setSortDirection('desc');
      }
    } else {
      setSortField(field);
      if (field === 'description' || field === 'documentType' || field === 'documentNumber') {
        setSortDirection('asc');
      } else {
        setSortDirection('desc');
      }
    }
  };

  const handleResetSort = () => {
    setSortField('default');
    setSortDirection('desc');
  };

  const handleResetAllFilters = () => {
    setSearchQuery('');
    setFilterType('all');
    setSelectedDocTypes([]);
    setDateFilterMode('all');
    setCustomStartDate('');
    setCustomEndDate('');
    setMinAmount('');
    setMaxAmount('');
    setStatusFilter('all');
    setSortField('default');
    setSortDirection('desc');
    setEntriesPage(1);
  };

  // Active conditions count for multi-condition search badge
  const activeConditionsCount = useMemo(() => {
    let count = 0;
    if (searchQuery.trim()) count++;
    if (filterType !== 'all') count++;
    if (selectedDocTypes.length > 0) count++;
    if (dateFilterMode !== 'all') count++;
    if (minAmount !== '' && typeof minAmount === 'number' && minAmount > 0) count++;
    if (maxAmount !== '' && typeof maxAmount === 'number' && maxAmount > 0) count++;
    if (statusFilter !== 'all') count++;
    return count;
  }, [searchQuery, filterType, selectedDocTypes, dateFilterMode, minAmount, maxAmount, statusFilter]);

  const isSearchOrFilterActive = activeConditionsCount > 0;

  // Multi-condition filtering
  const filteredEntries = useMemo(() => {
    const today = getCurrentJalaliDate();
    const currentYear = today.substring(0, 4);

    return fullLedger.entries.filter((entry) => {
      // 1. Basic Type Tabs (all, debt, deposit)
      if (filterType === 'debt' && entry.debit === 0) return false;
      if (filterType === 'deposit' && entry.credit === 0) return false;

      // 2. Specific Document Type condition (Multi-Select)
      // When selectedDocTypes has items, entry must match at least one selected type
      if (selectedDocTypes.length > 0) {
        const matchesAny = selectedDocTypes.some((typeId) => {
          if (typeId === 'sales_goods') {
            if (entry.documentType !== 'invoice') return false;
            const srvInfo = getInvoiceServiceInfo(entry.rawInvoice);
            // Must not be pure service (has goods/merchandise)
            return !srvInfo.isOnlyService;
          }
          if (typeId === 'sales_service') {
            if (entry.documentType !== 'invoice') return false;
            const srvInfo = getInvoiceServiceInfo(entry.rawInvoice);
            return srvInfo.hasService;
          }
          if (typeId === 'deposit') {
            return entry.documentType === 'deposit' || entry.documentType === 'invoice_payment';
          }
          if (typeId === 'debt') {
            return entry.documentType === 'debt';
          }
          if (typeId === 'purchase') {
            return entry.documentType === 'purchase_invoice' || entry.documentType === 'purchase_payment';
          }
          if (typeId === 'cheque') {
            return Boolean(
              entry.trackingNumber || 
              (entry.paymentMethod && (entry.paymentMethod.includes('cheque') || entry.paymentMethod.includes('چک'))) ||
              (entry.rawInvoice?.paymentMethod === 'cheque')
            );
          }
          return false;
        });

        if (!matchesAny) return false;
      }

      // 3. Date range condition
      if (dateFilterMode === 'this_year') {
        if (!entry.date.startsWith(currentYear)) return false;
      } else if (dateFilterMode === '30days') {
        const threshold = addDaysToJalali(-30);
        if (entry.date < threshold) return false;
      } else if (dateFilterMode === '90days') {
        const threshold = addDaysToJalali(-90);
        if (entry.date < threshold) return false;
      } else if (dateFilterMode === 'custom') {
        const normStart = customStartDate.replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d).toString()).trim();
        const normEnd = customEndDate.replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d).toString()).trim();
        if (normStart && entry.date < normStart) return false;
        if (normEnd && entry.date > normEnd) return false;
      }

      // 4. Amount range condition (evaluated on transaction debit or credit)
      const entryAmount = Math.max(entry.debit, entry.credit);
      if (minAmount !== '' && typeof minAmount === 'number' && minAmount > 0) {
        if (entryAmount < minAmount) return false;
      }
      if (maxAmount !== '' && typeof maxAmount === 'number' && maxAmount > 0) {
        if (entryAmount > maxAmount) return false;
      }

      // 5. Settlement / Status condition
      if (statusFilter === 'unsettled') {
        if (entry.rawInvoice && entry.rawInvoice.paymentStatus === 'paid') return false;
        if (entry.balance === 0) return false;
      } else if (statusFilter === 'debtor') {
        if (entry.debit <= 0) return false;
      } else if (statusFilter === 'creditor') {
        if (entry.credit <= 0) return false;
      }

      // 6. Multi-term space-separated search query (AND search)
      if (searchQuery.trim()) {
        const terms = searchQuery.toLowerCase().trim().split(/\s+/).filter(Boolean);
        const searchableText = [
          entry.documentNumber,
          entry.description,
          entry.notes || '',
          entry.trackingNumber || '',
          entry.paymentMethod || '',
          entry.documentTypeLabel || '',
          (entry.supplierNames || []).join(' '),
          entry.date,
          String(entry.debit),
          String(entry.credit),
          String(entry.balance),
        ].join(' ').toLowerCase();

        const allTermsMatch = terms.every((term) => searchableText.includes(term));
        if (!allTermsMatch) return false;
      }

      return true;
    });
  }, [
    fullLedger.entries,
    filterType,
    selectedDocTypes,
    dateFilterMode,
    customStartDate,
    customEndDate,
    minAmount,
    maxAmount,
    statusFilter,
    searchQuery,
  ]);

  // Sort filtered ledger entries according to selected header
  const sortedEntries = useMemo(() => {
    if (sortField === 'default') {
      return filteredEntries;
    }

    const items = [...filteredEntries];
    items.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'date':
          comparison = a.date.localeCompare(b.date);
          break;
        case 'documentType':
          comparison = (a.documentTypeLabel || '').localeCompare(b.documentTypeLabel || '', 'fa');
          break;
        case 'documentNumber': {
          const numA = Number(a.documentNumber.replace(/\D/g, '')) || 0;
          const numB = Number(b.documentNumber.replace(/\D/g, '')) || 0;
          comparison = numA !== numB ? numA - numB : a.documentNumber.localeCompare(b.documentNumber);
          break;
        }
        case 'description':
          comparison = (a.description || '').localeCompare(b.description || '', 'fa');
          break;
        case 'debit':
          comparison = a.debit - b.debit;
          break;
        case 'credit':
          comparison = a.credit - b.credit;
          break;
        case 'balance':
          comparison = a.balance - b.balance;
          break;
        default:
          comparison = 0;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });
    return items;
  }, [filteredEntries, sortField, sortDirection]);

  // Active totals calculated dynamically based on searched / filtered entries
  const activeTotals = useMemo(() => {
    let totalDebit = 0;
    let totalCredit = 0;
    filteredEntries.forEach((entry) => {
      totalDebit += entry.debit;
      totalCredit += entry.credit;
    });
    const netBalance = totalDebit - totalCredit;
    return {
      totalDebit,
      totalCredit,
      netBalance,
      entriesCount: filteredEntries.length,
      isFiltered: isSearchOrFilterActive,
    };
  }, [filteredEntries, isSearchOrFilterActive]);

  // Friendly label for currently active sorting
  const getSortLabel = () => {
    if (sortField === 'default') return 'ترتیب اولیه دفتری';
    const labels: Record<string, string> = {
      date: 'تاریخ',
      documentType: 'نوع سند',
      documentNumber: 'شماره سند',
      description: 'شرح',
      debit: 'مبلغ بدهکار',
      credit: 'مبلغ بستانکار',
      balance: 'مانده جاری',
    };
    return `${labels[sortField] || sortField} (${sortDirection === 'asc' ? 'صعودی' : 'نزولی'})`;
  };

  // Helper to render sortable table headers with interactive indicator
  const renderSortHeader = (
    field: 'date' | 'documentType' | 'documentNumber' | 'description' | 'debit' | 'credit' | 'balance',
    label: React.ReactNode,
    className: string,
    align: 'right' | 'left' | 'center' = 'right',
    title?: string
  ) => {
    const isActive = sortField === field;
    return (
      <th
        onClick={() => handleToggleSort(field)}
        className={`${className} cursor-pointer hover:bg-slate-200/90 transition-colors select-none group`}
        title={title || `مرتب‌سازی بر اساس ${typeof label === 'string' ? label : ''} (${isActive ? (sortDirection === 'desc' ? 'تغییر به صعودی' : 'بازنشانی') : 'کلیک کنید'})`}
      >
        <div className={`flex items-center gap-1.5 ${
          align === 'left' ? 'justify-end flex-row-reverse' : align === 'center' ? 'justify-center' : 'justify-between'
        }`}>
          <span className="truncate">{label}</span>
          <span className="shrink-0 inline-flex items-center">
            {isActive ? (
              sortDirection === 'asc' ? (
                <ArrowUp className="w-3.5 h-3.5 text-emerald-700 stroke-[2.5]" />
              ) : (
                <ArrowDown className="w-3.5 h-3.5 text-emerald-700 stroke-[2.5]" />
              )
            ) : (
              <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-30 group-hover:opacity-100 transition-opacity" />
            )}
          </span>
        </div>
      </th>
    );
  };

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
    // If search, filter, or custom sort is active, export the sorted/filtered ledger
    const ledgerToExport = (isSearchOrFilterActive || sortField !== 'default')
      ? {
          ...fullLedger,
          entries: sortedEntries,
          totalDebit: activeTotals.totalDebit,
          totalCredit: activeTotals.totalCredit,
          netBalance: activeTotals.netBalance,
          balanceStatus:
            activeTotals.netBalance > 0 ? ('debtor' as const) : activeTotals.netBalance < 0 ? ('creditor' as const) : ('settled' as const),
        }
      : fullLedger;
    exportCustomerStatementToExcel(customer, ledgerToExport, settings);
  };

  // Export to PDF
  const handleExportPdf = async () => {
    if (isExportingPdf) return;
    try {
      setIsExportingPdf(true);
      await new Promise((resolve) => setTimeout(resolve, 25));
      const safeCustomerName = customer.name.replace(/[/\\:*?"<>|]/g, '_');
      const safeDate = getCurrentJalaliDate().replace(/\//g, '-');
      const searchSuffix = searchQuery.trim()
        ? `_جستجو_${searchQuery.trim().replace(/[/\\:*?"<>|]/g, '_')}`
        : isSearchOrFilterActive
        ? '_فیلترشده'
        : '';
      const filename = `صورتحساب_مالی_${safeCustomerName}${searchSuffix}_${safeDate}.pdf`;

      const result = await exportElementToPdf('printable-customer-statement-pdf', filename, {
        pageSize: 'a4',
        orientation: 'portrait',
        quality: 'high',
        documentType: 'generic',
      });

      if (result.success) {
        setPdfSuccessMessage('فایل PDF رسمی صورتحساب با موفقیت دانلود شد.');
        setTimeout(() => setPdfSuccessMessage(null), 5000);
      } else {
        setPdfSuccessMessage(result.error || 'خطا در صدور فایل PDF صورتحساب');
        setTimeout(() => setPdfSuccessMessage(null), 5000);
      }
    } catch (err: any) {
      console.error('PDF export error:', err);
      setPdfSuccessMessage('خطا در تولید فایل PDF صورتحساب');
      setTimeout(() => setPdfSuccessMessage(null), 5000);
    } finally {
      setIsExportingPdf(false);
    }
  };

  // Send Statement Report to Telegram
  const [isSendingTelegram, setIsSendingTelegram] = useState(false);
  const handleSendTelegramStatement = async () => {
    if (!settings?.telegramBotEnabled) {
      setPdfSuccessMessage('ربات تلگرام در تنظیمات سیستم فعال نیست.');
      setTimeout(() => setPdfSuccessMessage(null), 5000);
      return;
    }
    const botToken = settings.telegramBotToken?.trim();
    const primaryChatId = (settings.telegramChatId || '').trim();
    const customerChatId = (customer.telegramChatId || '').trim();
    const targetChatId = (customerChatId && settings.telegramAutoSendCustomerDirect !== false)
      ? customerChatId
      : primaryChatId;

    if (!botToken || !targetChatId) {
      setPdfSuccessMessage('توکن ربات یا شناسه چت تلگرام در تنظیمات ثبت نشده است.');
      setTimeout(() => setPdfSuccessMessage(null), 5000);
      return;
    }

    setIsSendingTelegram(true);
    try {
      const store = settings.storeName || 'سامانه حسابداری و فروشگاه';
      const lines = [
        `📊 <b>گزارش صورتحساب و مانده حساب طرف‌حساب</b>`,
        `👤 طرف‌حساب: <b>${customer.name}</b>`,
        customer.phone ? `📞 شماره تماس: <code>${toPersianDigits(customer.phone)}</code>` : '',
        `📅 تاریخ گزارش: ${toPersianDigits(getCurrentJalaliDate())}`,
        `---------------------------------`,
        `▫️ مجموع کل بدهکاری (فاکتورها و اسناد): <b>${toPersianDigits(formatPrice(fullLedger.totalDebit))} ${settings.currency}</b>`,
        `▫️ مجموع کل بستانکاری (واریزی و دریافتی‌ها): <b>${toPersianDigits(formatPrice(fullLedger.totalCredit))} ${settings.currency}</b>`,
        `---------------------------------`,
        `💰 <b>وضعیت نهایی مانده حساب:</b> <b>${
          fullLedger.netBalance > 0
            ? `${toPersianDigits(formatPrice(fullLedger.netBalance))} ${settings.currency} (بدهکار به فروشگاه)`
            : fullLedger.netBalance < 0
            ? `${toPersianDigits(formatPrice(Math.abs(fullLedger.netBalance)))} ${settings.currency} (بستانکار / طلبکار از ما)`
            : '✅ تسویه کامل (صفر)'
        }</b>`,
        store ? `🏪 <i>${store}</i>` : '',
      ].filter(Boolean);

      const res = await sendTelegramTextMessage({
        botToken,
        chatId: targetChatId,
        text: lines.join('\n'),
      });

      if (res.success) {
        setPdfSuccessMessage('گزارش وضعیت حساب طرف‌حساب با موفقیت به تلگرام ارسال گردید.');
        setTimeout(() => setPdfSuccessMessage(null), 5000);
      } else {
        setPdfSuccessMessage(res.error || 'خطا در ارسال به تلگرام');
        setTimeout(() => setPdfSuccessMessage(null), 5000);
      }
    } catch (err: any) {
      setPdfSuccessMessage('خطا در ارسال: ' + (err?.message || ''));
      setTimeout(() => setPdfSuccessMessage(null), 5000);
    } finally {
      setIsSendingTelegram(false);
    }
  };

  if (!isOpen || !customer) return null;

  return (
    <div 
      id="customer-statement-modal" 
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/75 backdrop-blur-xs flex items-center justify-center p-0 sm:p-3 md:p-4 print:p-0 print:bg-white animate-in fade-in duration-150"
    >
      <div className="bg-white w-full max-w-[96vw] xl:max-w-7xl 2xl:max-w-[1440px] rounded-none sm:rounded-3xl shadow-2xl border-0 sm:border border-slate-200 print:border-0 print:shadow-none print:rounded-none print:max-w-none print:h-auto print:max-h-none print:overflow-visible overflow-hidden flex flex-col h-[100dvh] sm:h-[94vh] max-h-[100dvh] text-right">
        
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

        {/* PDF Success Toast Banner */}
        {pdfSuccessMessage && (
          <div className="no-print bg-emerald-600 text-white text-xs font-bold py-2 px-4 flex items-center justify-between gap-2 shadow-sm animate-in fade-in slide-in-from-top-1 shrink-0">
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

        {/* FINANCIAL SUMMARY: MOBILE HERO CARD + DESKTOP 4-COLUMN CARDS */}
        {/* 1. Mobile Financial Banner (< sm) */}
        <div className="no-print sm:hidden p-3 bg-gradient-to-b from-slate-900 to-slate-800 text-white shrink-0 border-b border-slate-700/60">
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3 border border-white/15">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-slate-300 font-medium flex items-center gap-1.5">
                <Wallet className="w-3.5 h-3.5 text-emerald-400" />
                {isSearchOrFilterActive ? 'مانده نتایج جستجو:' : 'مانده حساب جاری مشتری:'}
              </span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                activeTotals.netBalance > 0
                  ? 'bg-rose-500 text-white'
                  : activeTotals.netBalance < 0
                    ? 'bg-blue-500 text-white'
                    : 'bg-emerald-500 text-white'
              }`}>
                {activeTotals.netBalance > 0
                  ? 'مشتری بدهکار است'
                  : activeTotals.netBalance < 0
                    ? 'مشتری طلبکار است'
                    : 'کاملاً بی‌حساب / تسویه'}
                {isSearchOrFilterActive && ` (${toPersianDigits(activeTotals.entriesCount)} سند)`}
              </span>
            </div>

            <div className="flex items-baseline justify-between gap-2 mt-1">
              <div className="text-xl font-black font-mono tracking-tight">
                {formatPrice(Math.abs(activeTotals.netBalance), settings.currency)}
              </div>
              {activeTotals.netBalance > 0 && (
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
                <span className="text-[9px] text-rose-300 block">
                  {isSearchOrFilterActive ? 'بدهی جستجو' : 'کل بدهی (خرید)'}
                </span>
                <span className="text-[11px] font-bold font-mono text-rose-200">
                  {formatPrice(activeTotals.totalDebit, '')}
                </span>
              </div>
              <div className="bg-white/5 rounded-xl py-1 px-1">
                <span className="text-[9px] text-emerald-300 block">
                  {isSearchOrFilterActive ? 'واریزی جستجو' : 'کل واریزی‌ها'}
                </span>
                <span className="text-[11px] font-bold font-mono text-emerald-200">
                  {formatPrice(activeTotals.totalCredit, '')}
                </span>
              </div>
              <div className="bg-white/5 rounded-xl py-1 px-1">
                <span className="text-[9px] text-slate-300 block">
                  {isSearchOrFilterActive ? 'اسناد یافت‌شده' : 'تراکنش‌ها'}
                </span>
                <span className="text-[11px] font-bold font-mono text-slate-100">
                  {toPersianDigits(activeTotals.entriesCount)} سند
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 2. Desktop 4-Column KPI Cards (>= sm) - Compact & Uncluttered */}
        <div className="no-print hidden sm:grid sm:grid-cols-2 lg:grid-cols-4 gap-2 px-3.5 py-1.5 bg-slate-50/90 border-b border-slate-200/80 shrink-0">
          {/* 1. Total Debits (بدهکار) */}
          <div className="bg-white px-2.5 py-1.5 rounded-xl border border-rose-100 flex items-center justify-between gap-2">
            <span className="text-[11px] text-rose-600 font-bold flex items-center gap-1 shrink-0">
              <ArrowUpRight className="w-3 h-3 text-rose-500" />
              <span>{isSearchOrFilterActive ? 'بدهی فیلتر:' : 'جمع بدهی:'}</span>
            </span>
            <span className="text-xs sm:text-sm font-black text-rose-700 font-mono truncate">
              {formatPrice(activeTotals.totalDebit, settings.currency)}
            </span>
          </div>

          {/* 2. Total Credits (بستانکار) */}
          <div className="bg-white px-2.5 py-1.5 rounded-xl border border-emerald-100 flex items-center justify-between gap-2">
            <span className="text-[11px] text-emerald-600 font-bold flex items-center gap-1 shrink-0">
              <ArrowDownLeft className="w-3 h-3 text-emerald-500" />
              <span>{isSearchOrFilterActive ? 'واریزی فیلتر:' : 'جمع واریزی:'}</span>
            </span>
            <span className="text-xs sm:text-sm font-black text-emerald-700 font-mono truncate">
              {formatPrice(activeTotals.totalCredit, settings.currency)}
            </span>
          </div>

          {/* 3. Net Balance (مانده حساب) */}
          <div className={`px-2.5 py-1.5 rounded-xl border flex items-center justify-between gap-2 ${
            activeTotals.netBalance > 0
              ? 'bg-rose-50/70 border-rose-200 text-rose-800'
              : activeTotals.netBalance < 0
                ? 'bg-blue-50/70 border-blue-200 text-blue-800'
                : 'bg-emerald-50/70 border-emerald-200 text-emerald-800'
          }`}>
            <span className="text-[11px] font-bold flex items-center gap-1 shrink-0">
              <Wallet className="w-3 h-3" />
              <span>مانده ({activeTotals.netBalance > 0 ? 'بدهکار' : activeTotals.netBalance < 0 ? 'طلبکار' : 'تسویه'}):</span>
            </span>
            <span className="text-xs sm:text-sm font-black font-mono truncate">
              {formatPrice(Math.abs(activeTotals.netBalance), settings.currency)}
            </span>
          </div>

          {/* 4. Total Entries & Invoices */}
          <div className="bg-white px-2.5 py-1.5 rounded-xl border border-slate-200 flex items-center justify-between gap-2">
            <span className="text-[11px] text-slate-600 font-bold flex items-center gap-1 shrink-0">
              <FileText className="w-3 h-3 text-slate-400" />
              <span>{isSearchOrFilterActive ? 'اسناد فیلتر:' : 'کل اسناد:'}</span>
            </span>
            <div className="flex items-center gap-1 truncate">
              <span className="text-xs sm:text-sm font-black text-slate-800 font-mono">
                {toPersianDigits(activeTotals.entriesCount)}
              </span>
              <span className="text-[10px] text-slate-400">
                {isSearchOrFilterActive
                  ? `از ${toPersianDigits(fullLedger.entries.length)}`
                  : unpaidInvoices.length > 0
                    ? `(${toPersianDigits(unpaidInvoices.length)} باز)`
                    : 'تراکنش'}
              </span>
            </div>
          </div>
        </div>

        {/* ACTION TOOLBAR & FILTERS - Optimized Button Layout */}
        <div className="no-print px-3 py-2 border-b border-slate-200 bg-white space-y-2 shrink-0">
          {/* Row 1: Structured 3-Zone Toolbar (Right: Actions & Tabs | Center: Search & Filter | Left: View & Export) */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            {/* Right Zone: Primary Transaction Buttons + Quick Type Segmented Tabs */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  id="add-deposit-btn"
                  onClick={() => handleOpenTransactionModal('deposit')}
                  className="h-8 px-3 flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-lg text-[11px] font-bold shadow-2xs transition-all cursor-pointer shrink-0"
                >
                  <Plus className="w-3.5 h-3.5 shrink-0" />
                  <span>ثبت واریز</span>
                </button>

                <button
                  type="button"
                  id="add-debt-btn"
                  onClick={() => handleOpenTransactionModal('debt')}
                  className={`h-8 px-3 flex items-center gap-1 active:scale-95 text-white rounded-lg text-[11px] font-bold shadow-2xs transition-all cursor-pointer shrink-0 ${
                    fullLedger.netBalance < 0
                      ? 'bg-blue-600 hover:bg-blue-700'
                      : 'bg-rose-600 hover:bg-rose-700'
                  }`}
                >
                  <Plus className="w-3.5 h-3.5 shrink-0" />
                  <span>{fullLedger.netBalance < 0 ? 'ثبت پرداخت' : 'ثبت بدهی'}</span>
                </button>
              </div>

              <span className="h-5 w-px bg-slate-200 hidden sm:inline-block" />

              {/* Segmented Quick Type Tabs */}
              <div className="h-8 flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-[11px] shrink-0">
                <button
                  type="button"
                  onClick={() => setFilterType('all')}
                  className={`h-full px-2.5 rounded-md font-bold transition-all cursor-pointer whitespace-nowrap ${
                    filterType === 'all' ? 'bg-white text-slate-800 shadow-2xs' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  همه
                </button>
                <button
                  type="button"
                  onClick={() => setFilterType('debt')}
                  className={`h-full px-2.5 rounded-md font-bold transition-all cursor-pointer whitespace-nowrap ${
                    filterType === 'debt' ? 'bg-white text-rose-700 shadow-2xs' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  بدهی‌ها
                </button>
                <button
                  type="button"
                  onClick={() => setFilterType('deposit')}
                  className={`h-full px-2.5 rounded-md font-bold transition-all cursor-pointer whitespace-nowrap ${
                    filterType === 'deposit' ? 'bg-white text-emerald-700 shadow-2xs' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  واریزی‌ها
                </button>
              </div>
            </div>

            {/* Center Zone: Search Input + Advanced Filters Toggle */}
            <div className="flex items-center gap-1.5 flex-1 min-w-[220px]">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="جستجو (کالا، شماره سند، چک...)"
                  className="w-full h-8 bg-slate-50 border border-slate-200 rounded-lg pr-8 pl-6 text-[11px] text-slate-800 outline-none focus:bg-white focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute left-1.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-full cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>

              <button
                type="button"
                id="statement-advanced-filters-btn"
                onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                className={`h-8 px-2.5 text-[11px] font-bold rounded-lg border flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
                  showAdvancedFilters || (activeConditionsCount > (searchQuery ? 1 : 0))
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
                title="فیلترهای پیشرفته (نوع سند، تاریخ، مبلغ)"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>فیلترها</span>
                {activeConditionsCount > 0 && (
                  <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-bold ${
                    showAdvancedFilters || (activeConditionsCount > (searchQuery ? 1 : 0))
                      ? 'bg-white text-emerald-800'
                      : 'bg-emerald-100 text-emerald-800'
                  }`}>
                    {toPersianDigits(activeConditionsCount)}
                  </span>
                )}
                <ChevronDown className={`w-3 h-3 transition-transform ${showAdvancedFilters ? 'rotate-180' : ''}`} />
              </button>
            </div>

            {/* Left Zone: Display Mode + Export Group */}
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => setShowSuppliers(!showSuppliers)}
                className={`h-8 px-2.5 text-[11px] font-bold rounded-lg border flex items-center gap-1 transition-all cursor-pointer shrink-0 ${
                  showSuppliers
                    ? 'bg-amber-50 text-amber-800 border-amber-200'
                    : 'bg-white text-slate-400 border-slate-200 hover:bg-slate-50'
                }`}
                title={showSuppliers ? 'مخفی کردن نام تامین‌کننده' : 'نمایش نام تامین‌کننده'}
              >
                <Building2 className="w-3.5 h-3.5" />
                <span className="hidden md:inline">تامین‌کننده</span>
              </button>

              {/* View Switcher (Table vs Cards) */}
              <div className="h-8 flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-[11px] shrink-0">
                <button
                  type="button"
                  onClick={() => setViewMode('table')}
                  className={`h-full px-2 rounded-md flex items-center gap-1 font-bold transition-all cursor-pointer ${
                    viewMode === 'table' ? 'bg-white text-emerald-700 shadow-2xs' : 'text-slate-500 hover:text-slate-700'
                  }`}
                  title="نمای جدولی"
                >
                  <LayoutList className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('cards')}
                  className={`h-full px-2 rounded-md flex items-center gap-1 font-bold transition-all cursor-pointer ${
                    viewMode === 'cards' ? 'bg-white text-emerald-700 shadow-2xs' : 'text-slate-500 hover:text-slate-700'
                  }`}
                  title="نمای کارتی"
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Unified Export Buttons Group */}
              <div className="h-8 flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 gap-0.5 shrink-0">
                <button
                  type="button"
                  id="export-statement-pdf-btn"
                  onClick={handleExportPdf}
                  disabled={isExportingPdf}
                  className="h-full px-2.5 flex items-center gap-1 bg-white hover:bg-rose-50 text-rose-700 rounded-md text-[11px] font-bold transition-all cursor-pointer disabled:opacity-60 shadow-2xs"
                  title="دریافت فایل PDF صورتحساب"
                >
                  {isExportingPdf ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileDown className="w-3.5 h-3.5" />}
                  <span className="hidden sm:inline">PDF</span>
                </button>

                <button
                  type="button"
                  id="export-statement-excel-btn"
                  onClick={handleExportExcel}
                  className="h-full px-2.5 flex items-center gap-1 bg-white hover:bg-purple-50 text-purple-700 rounded-md text-[11px] font-bold transition-all cursor-pointer shadow-2xs"
                  title="خروجی اکسل"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">اکسل</span>
                </button>

                {settings?.telegramBotEnabled && (
                  <button
                    type="button"
                    id="send-statement-telegram-btn"
                    onClick={handleSendTelegramStatement}
                    disabled={isSendingTelegram}
                    className="h-full px-2.5 flex items-center gap-1 bg-white hover:bg-sky-50 text-sky-700 rounded-md text-[11px] font-bold transition-all cursor-pointer disabled:opacity-50 shadow-2xs"
                    title="ارسال به تلگرام"
                  >
                    {isSendingTelegram ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                    <span className="hidden sm:inline">تلگرام</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Collapsible Compact Multi-Condition Filter Panel (div:nth-of-type(2)) */}
          {showAdvancedFilters && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 space-y-2 text-[11px] animate-fadeIn">
              {/* Row 1: Document Types Button Bar + Combined Presets Group */}
              <div className="flex items-center justify-between gap-2 flex-wrap">
                {/* Multi-select Document Types Group */}
                <div className="flex items-center gap-1 flex-wrap">
                  <span className="font-bold text-slate-700 ml-1">نوع سند:</span>
                  <div className="flex items-center bg-white p-0.5 rounded-lg border border-slate-200 gap-0.5 flex-wrap">
                    <button
                      type="button"
                      onClick={() => handleSetDocTypePreset('all')}
                      className={`h-6 px-2.5 rounded-md text-[10px] font-bold transition-all cursor-pointer ${
                        selectedDocTypes.length === 0
                          ? 'bg-slate-800 text-white shadow-2xs'
                          : 'text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      همه
                    </button>
                    {STATEMENT_DOC_TYPES.map((opt) => {
                      const isSelected = selectedDocTypes.includes(opt.id);
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => handleToggleDocType(opt.id)}
                          className={`h-6 px-2.5 rounded-md text-[10px] font-medium transition-all cursor-pointer flex items-center gap-1 ${
                            isSelected
                              ? 'bg-emerald-600 text-white font-bold shadow-2xs'
                              : 'text-slate-600 hover:bg-slate-100'
                          }`}
                          title={opt.fullName}
                        >
                          <span>{opt.label}</span>
                          {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Combined Presets Segmented Group */}
                <div className="flex items-center bg-white p-0.5 rounded-lg border border-slate-200 gap-1">
                  <span className="text-[10px] font-bold text-slate-400 px-1.5">ترکیبی:</span>
                  <button
                    type="button"
                    onClick={() => handleSetDocTypePreset('sales_and_services')}
                    className={`h-6 px-2.5 rounded-md text-[10px] font-bold transition-all cursor-pointer ${
                      selectedDocTypes.length === 2 && selectedDocTypes.includes('sales_goods') && selectedDocTypes.includes('sales_service')
                        ? 'bg-blue-600 text-white shadow-2xs'
                        : 'bg-blue-50/70 text-blue-700 hover:bg-blue-100'
                    }`}
                    title="فقط فاکتورهای فروش کالا و خدمات (بدون واریزی‌ها)"
                  >
                    فروش + خدمات (بدون واریز)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetDocTypePreset('sales_and_deposits')}
                    className={`h-6 px-2.5 rounded-md text-[10px] font-bold transition-all cursor-pointer ${
                      selectedDocTypes.length === 2 && selectedDocTypes.includes('sales_goods') && selectedDocTypes.includes('deposit')
                        ? 'bg-emerald-600 text-white shadow-2xs'
                        : 'bg-emerald-50/70 text-emerald-700 hover:bg-emerald-100'
                    }`}
                    title="فقط فاکتورهای فروش کالا و واریزی‌ها (بدون خدمات)"
                  >
                    فروش + واریز (بدون خدمات)
                  </button>
                </div>
              </div>

              {/* Row 2: Date Range, Amount Inputs & Segmented Settlement Status */}
              <div className="flex items-center justify-between gap-2 flex-wrap pt-1.5 border-t border-slate-200/80">
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Date Control */}
                  <div className="flex items-center gap-1">
                    <span className="font-bold text-slate-700">تاریخ:</span>
                    <select
                      value={dateFilterMode}
                      onChange={(e) => setDateFilterMode(e.target.value as any)}
                      className="h-7 bg-white border border-slate-200 rounded-lg px-2 text-[11px] text-slate-800 outline-none cursor-pointer"
                    >
                      <option value="all">همه زمان‌ها</option>
                      <option value="30days">۳۰ روز اخیر</option>
                      <option value="90days">۳ ماه اخیر</option>
                      <option value="this_year">سال جاری</option>
                      <option value="custom">بازه دلخواه...</option>
                    </select>

                    {dateFilterMode === 'custom' && (
                      <div className="flex items-center gap-1">
                        <input
                          type="text"
                          value={customStartDate}
                          onChange={(e) => setCustomStartDate(e.target.value)}
                          placeholder="از ۱۴۰۴/۰۱/۰۱"
                          className="h-7 w-24 bg-white border border-slate-200 rounded-lg px-1.5 text-center font-mono text-[10px]"
                        />
                        <input
                          type="text"
                          value={customEndDate}
                          onChange={(e) => setCustomEndDate(e.target.value)}
                          placeholder="تا ۱۴۰۴/۱۲/۲۹"
                          className="h-7 w-24 bg-white border border-slate-200 rounded-lg px-1.5 text-center font-mono text-[10px]"
                        />
                      </div>
                    )}
                  </div>

                  <span className="h-4 w-px bg-slate-200 hidden sm:inline-block" />

                  {/* Amount Range Control */}
                  <div className="flex items-center gap-1">
                    <span className="font-bold text-slate-700">مبلغ:</span>
                    <NumericInput
                      value={minAmount}
                      onChange={(val) => setMinAmount(val)}
                      placeholder="از مبلغ..."
                      className="h-7 w-24 bg-white border border-slate-200 rounded-lg px-2 text-[10px] text-slate-800 outline-none"
                    />
                    <NumericInput
                      value={maxAmount}
                      onChange={(val) => setMaxAmount(val)}
                      placeholder="تا مبلغ..."
                      className="h-7 w-24 bg-white border border-slate-200 rounded-lg px-2 text-[10px] text-slate-800 outline-none"
                    />
                  </div>

                  <span className="h-4 w-px bg-slate-200 hidden sm:inline-block" />

                  {/* Settlement Status Segmented Buttons */}
                  <div className="flex items-center gap-1">
                    <span className="font-bold text-slate-700">وضعیت:</span>
                    <div className="flex items-center bg-white p-0.5 rounded-lg border border-slate-200 gap-0.5">
                      {(['all', 'unsettled', 'debtor', 'creditor'] as const).map((st) => (
                        <button
                          key={st}
                          type="button"
                          onClick={() => setStatusFilter(st)}
                          className={`h-6 px-2.5 rounded-md text-[10px] font-bold transition-all cursor-pointer ${
                            statusFilter === st
                              ? 'bg-slate-800 text-white shadow-2xs'
                              : 'text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          {st === 'all' ? 'همه' : st === 'unsettled' ? 'تسویه‌نشده' : st === 'debtor' ? 'بدهکار' : 'بستانکار'}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {isSearchOrFilterActive && (
                  <button
                    type="button"
                    onClick={handleResetAllFilters}
                    className="h-7 px-2.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>پاکسازی شروط</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Compact Active Filters Chips (only when filters/sort active and panel closed) */}
          {(isSearchOrFilterActive || sortField !== 'default') && !showAdvancedFilters && (
            <div className="flex items-center gap-1 flex-wrap text-[10px]">
              {searchQuery.trim() && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-md">
                  <span>جستجو: {searchQuery}</span>
                  <button onClick={() => setSearchQuery('')} className="hover:text-rose-600 cursor-pointer"><X className="w-2.5 h-2.5" /></button>
                </span>
              )}

              {selectedDocTypes.length > 0 && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-blue-50 text-blue-800 border border-blue-200 rounded-md">
                  <span>نوع: {selectedDocTypes.map(t => STATEMENT_DOC_TYPES.find(o => o.id === t)?.label || t).join(' + ')}</span>
                  <button onClick={() => setSelectedDocTypes([])} className="hover:text-rose-600 cursor-pointer"><X className="w-2.5 h-2.5" /></button>
                </span>
              )}

              {dateFilterMode !== 'all' && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-purple-50 text-purple-800 border border-purple-200 rounded-md">
                  <span>تاریخ: {dateFilterMode === '30days' ? '۳۰ روز' : dateFilterMode === '90days' ? '۳ ماه' : dateFilterMode === 'this_year' ? 'امسال' : `${customStartDate || '...'} تا ${customEndDate || '...'}`}</span>
                  <button onClick={() => { setDateFilterMode('all'); setCustomStartDate(''); setCustomEndDate(''); }} className="hover:text-rose-600 cursor-pointer"><X className="w-2.5 h-2.5" /></button>
                </span>
              )}

              {(minAmount !== '' || maxAmount !== '') && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-amber-50 text-amber-900 border border-amber-200 rounded-md">
                  <span>مبلغ: {minAmount ? `از ${formatPrice(minAmount)}` : ''} {maxAmount ? `تا ${formatPrice(maxAmount)}` : ''}</span>
                  <button onClick={() => { setMinAmount(''); setMaxAmount(''); }} className="hover:text-rose-600 cursor-pointer"><X className="w-2.5 h-2.5" /></button>
                </span>
              )}

              {statusFilter !== 'all' && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-teal-50 text-teal-800 border border-teal-200 rounded-md">
                  <span>وضعیت: {statusFilter === 'unsettled' ? 'تسویه‌نشده' : statusFilter === 'debtor' ? 'بدهکار' : 'بستانکار'}</span>
                  <button onClick={() => setStatusFilter('all')} className="hover:text-rose-600 cursor-pointer"><X className="w-2.5 h-2.5" /></button>
                </span>
              )}

              {sortField !== 'default' && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-slate-100 text-slate-700 border border-slate-300 rounded-md">
                  <span>مرتب‌سازی: {getSortLabel()}</span>
                  <button onClick={handleResetSort} className="hover:text-rose-600 cursor-pointer"><X className="w-2.5 h-2.5" /></button>
                </span>
              )}

              <button
                type="button"
                onClick={handleResetAllFilters}
                className="inline-flex items-center gap-0.5 px-1.5 py-0.5 font-bold text-rose-600 hover:underline cursor-pointer"
              >
                <RotateCcw className="w-2.5 h-2.5" />
                <span>پاکسازی</span>
              </button>
            </div>
          )}
        </div>

        {/* LEDGER ENTRIES LIST (RESPONSIVE CARDS FOR MOBILE & TABLE FOR DESKTOP) */}
        <div className="no-print flex-1 overflow-y-auto p-2.5 sm:p-4 md:p-5">
          {/* List Performance & Optimization Stats Toolbar */}
          <div className="bg-slate-50/90 border border-slate-200 rounded-2xl px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-xs mb-3 shadow-2xs">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-slate-700">
                تعداد: <strong className="text-emerald-700 font-mono text-sm">{toPersianDigits(sortedEntries.length)}</strong>
                {isSearchOrFilterActive && (
                  <span className="text-slate-400 font-normal mr-1"> (از کل {toPersianDigits(fullLedger.entries.length)})</span>
                )}
              </span>
              <span className="text-slate-300 hidden sm:inline">|</span>
              <span className="text-slate-600">
                بدهکار: <strong className="text-rose-700 font-mono">{toPersianDigits(activeTotals.totalDebit.toLocaleString('en-US'))}</strong> {settings.currency}
              </span>
              <span className="text-slate-300 hidden sm:inline">|</span>
              <span className="text-slate-600">
                بستانکار: <strong className="text-emerald-700 font-mono">{toPersianDigits(activeTotals.totalCredit.toLocaleString('en-US'))}</strong> {settings.currency}
              </span>
              <span className="text-slate-300 hidden sm:inline">|</span>
              <span className="font-bold">
                مانده: <strong className={`font-mono ${activeTotals.netBalance > 0 ? 'text-rose-700' : activeTotals.netBalance < 0 ? 'text-blue-700' : 'text-emerald-700'}`}>
                  {toPersianDigits(Math.abs(activeTotals.netBalance).toLocaleString('en-US'))}
                </strong> {settings.currency} ({activeTotals.netBalance > 0 ? 'بدهکار' : activeTotals.netBalance < 0 ? 'بستانکار' : 'تسویه'})
              </span>
            </div>

            {/* Mobile / Quick Sort Dropdown Control */}
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-[11px] text-slate-500 hidden md:inline">مرتب‌سازی:</span>
              <select
                value={sortField}
                onChange={(e) => {
                  const val = e.target.value as any;
                  setSortField(val);
                  if (val === 'default') setSortDirection('desc');
                }}
                className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-[11px] text-slate-700 font-medium outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                title="مرتب‌سازی لیست بر اساس ستون دلخواه"
              >
                <option value="default">پیش‌فرض (ترتیب دفتری)</option>
                <option value="date">تاریخ سند</option>
                <option value="documentType">نوع سند</option>
                <option value="documentNumber">شماره سند/پیگیری</option>
                <option value="description">شرح تراکنش</option>
                <option value="debit">مبلغ بدهکار</option>
                <option value="credit">مبلغ بستانکار</option>
                <option value="balance">مانده جاری</option>
              </select>
              {sortField !== 'default' && (
                <button
                  type="button"
                  onClick={() => setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')}
                  className="p-1 bg-white border border-slate-200 rounded-lg text-slate-600 hover:text-emerald-700 hover:bg-slate-50 transition-colors cursor-pointer"
                  title={sortDirection === 'asc' ? 'صعودی (کلیک جهت معکوس کردن به نزولی)' : 'نزولی (کلیک جهت معکوس کردن به صعودی)'}
                >
                  {sortDirection === 'asc' ? <ArrowUp className="w-3.5 h-3.5" /> : <ArrowDown className="w-3.5 h-3.5" />}
                </button>
              )}
            </div>
          </div>
          {/* A. MOBILE CARDS VIEW (Clean, Touch-Friendly, High Contrast) */}
          {viewMode === 'cards' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {sortedEntries.length === 0 ? (
                <div className="col-span-full bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-400">
                  <ReceiptText className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                  <p className="text-xs">
                    {fullLedger.entries.length === 0 
                      ? 'هنوز هیچ فاکتور یا تراکنش مالی برای این مشتری ثبت نشده است.' 
                      : 'هیچ تراکنشی با فیلترهای انتخابی یافت نشد.'}
                  </p>
                </div>
              ) : (
                paginateArray(sortedEntries, entriesPage, entriesPageSize).map((entry) => {
                  const isInvoice = entry.documentType === 'invoice';
                  const isPayment = entry.documentType === 'deposit' || entry.documentType === 'invoice_payment';
                  const isManualTxn = !!entry.rawTransaction;
                  const hasClickableInvoice = Boolean(entry.rawInvoice || entry.rawPurchaseInvoice);
                  const serviceInfo = getInvoiceServiceInfo(entry.rawInvoice);

                  return (
                    <div 
                      key={entry.id}
                      onClick={() => {
                        if (hasClickableInvoice) {
                          setBriefInvoiceEntry(entry);
                        }
                      }}
                      title={hasClickableInvoice ? 'کلیک جهت مشاهده خلاصه جزئیات فاکتور' : undefined}
                      className={`bg-white rounded-2xl border border-slate-200/90 shadow-xs p-3 hover:border-purple-300 transition-all text-right ${
                        hasClickableInvoice ? 'cursor-pointer hover:shadow-md' : ''
                      }`}
                    >
                      {/* Top Row: Type Badge + Doc Number + Date */}
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-lg ${
                            entry.documentType === 'invoice'
                              ? 'bg-purple-50 text-purple-700 border border-purple-200'
                              : entry.documentType === 'purchase_invoice'
                                ? 'bg-amber-50 text-amber-800 border border-amber-300'
                                : entry.documentType === 'purchase_payment'
                                  ? 'bg-blue-50 text-blue-700 border border-blue-200'
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
                            ) : entry.documentType === 'purchase_invoice' ? (
                              <ShoppingBag className="w-3 h-3 text-amber-600" />
                            ) : entry.documentType === 'purchase_payment' ? (
                              <ReceiptText className="w-3 h-3 text-blue-600" />
                            ) : entry.documentType === 'invoice_payment' ? (
                              <ReceiptText className="w-3 h-3 text-teal-600" />
                            ) : (
                              <ArrowUpRight className="w-3 h-3 text-rose-600" />
                            )}
                            <span>{getDisplayDocTypeLabel(entry)}</span>
                          </span>

                          {serviceInfo.hasService && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200">
                              <Sparkles className="w-2.5 h-2.5 text-indigo-600" />
                              <span>{serviceInfo.isOnlyService ? 'فاکتور خدماتی' : 'شامل خدمات'}</span>
                            </span>
                          )}

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
                        {showSuppliers && entry.supplierNames && entry.supplierNames.length > 0 && (
                          <div className="mt-1 flex items-center gap-1 flex-wrap">
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-900 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-md">
                              <Building2 className="w-3 h-3 text-amber-600" />
                              <span>تامین‌کننده / فروشنده کالا: {entry.supplierNames.join('، ')}</span>
                            </span>
                          </div>
                        )}
                        {entry.trackingNumber && (
                          <div className="flex items-center gap-1 mt-1 text-[10px] text-slate-500 font-mono" onClick={(e) => e.stopPropagation()}>
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

                      {/* Action buttons (View Invoice / Edit / Delete) */}
                      {(entry.rawInvoice || (isManualTxn && entry.rawTransaction)) && (
                        <div
                          className="flex items-center justify-end gap-1.5 mt-2 pt-2 border-t border-slate-100 flex-wrap"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {/* 1. View Invoice Button */}
                          {entry.rawInvoice && onViewInvoice && (
                            <button
                              type="button"
                              onClick={() => onViewInvoice(entry.rawInvoice!)}
                              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/70 rounded-xl transition-colors cursor-pointer"
                              title="مشاهده جزئیات فاکتور"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>مشاهده فاکتور</span>
                            </button>
                          )}

                          {/* 2. Manual Transaction (Deposit or Debt): Edit & Delete */}
                          {isManualTxn && entry.rawTransaction && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleOpenEditTransaction(entry.rawTransaction!)}
                                className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200/70 rounded-xl transition-colors cursor-pointer"
                                title={entry.rawTransaction.type === 'deposit' ? 'ویرایش سند واریزی' : 'ویرایش سند بدهی'}
                              >
                                <Pencil className="w-3.5 h-3.5" />
                                <span>ویرایش {entry.rawTransaction.type === 'deposit' ? 'واریزی' : 'بدهی'}</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setItemToDelete({
                                  type: 'transaction',
                                  id: entry.rawTransaction!.id,
                                  amount: entry.rawTransaction!.amount,
                                  title: entry.rawTransaction!.title || (entry.rawTransaction!.type === 'deposit' ? 'واریز وجه' : 'سند بدهی'),
                                  transaction: entry.rawTransaction,
                                })}
                                className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200/70 rounded-xl transition-colors cursor-pointer"
                                title="حذف سند مالی"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>حذف</span>
                              </button>
                            </>
                          )}

                          {/* 3. Invoice Payment (Deposit recorded on invoice): Edit & Delete */}
                          {entry.documentType === 'invoice_payment' && entry.rawInvoice && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleOpenEditInvoicePayment(entry.rawInvoice!)}
                                className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200/70 rounded-xl transition-colors cursor-pointer"
                                title="ویرایش واریزی فاکتور"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                                <span>ویرایش واریزی</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setItemToDelete({
                                  type: 'invoice_payment',
                                  id: entry.rawInvoice!.id,
                                  amount: entry.credit,
                                  title: `واریزی فاکتور شماره #${toPersianDigits(entry.rawInvoice!.invoiceNumber)}`,
                                  invoice: entry.rawInvoice,
                                })}
                                className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200/70 rounded-xl transition-colors cursor-pointer"
                                title="حذف واریزی فاکتور (بازگشت به بدهکاری)"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>حذف واریزی</span>
                              </button>
                            </>
                          )}

                          {/* 4. Invoice Debt (Sales Invoice): Edit & Delete */}
                          {entry.documentType === 'invoice' && entry.rawInvoice && (
                            <>
                              {onEditInvoice && (
                                <button
                                  type="button"
                                  onClick={() => onEditInvoice(entry.rawInvoice!)}
                                  className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200/70 rounded-xl transition-colors cursor-pointer"
                                  title="ویرایش اقلام فاکتور فروش"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                  <span>ویرایش فاکتور</span>
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => setItemToDelete({
                                  type: 'invoice',
                                  id: entry.rawInvoice!.id,
                                  amount: entry.debit,
                                  title: `فاکتور فروش شماره #${toPersianDigits(entry.rawInvoice!.invoiceNumber)}`,
                                  invoice: entry.rawInvoice,
                                })}
                                className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200/70 rounded-xl transition-colors cursor-pointer"
                                title="حذف کامل فاکتور و بدهی"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>حذف فاکتور</span>
                              </button>
                            </>
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
                <table className="w-full text-right text-xs border-collapse min-w-[880px]">
                  <thead className="sticky top-0 z-10 bg-slate-100 shadow-2xs">
                    <tr className="bg-slate-100 text-slate-700 border-b border-slate-200 font-bold">
                      <th
                        onClick={handleResetSort}
                        className="py-2.5 px-2 w-10 text-center font-bold text-slate-500 shrink-0 cursor-pointer hover:bg-slate-200/90 transition-colors select-none group"
                        title="کلیک جهت بازنشانی به ترتیب تاریخی اولیه حساب"
                      >
                        <div className="flex items-center justify-center gap-0.5">
                          <span>#</span>
                          {sortField === 'default' && (
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" title="ترتیب استاندارد دفتری" />
                          )}
                        </div>
                      </th>
                      {renderSortHeader('date', 'تاریخ', 'py-2.5 px-2.5 w-24 whitespace-nowrap text-right shrink-0')}
                      {renderSortHeader('documentType', 'نوع سند', 'py-2.5 px-2.5 w-24 whitespace-nowrap text-right shrink-0')}
                      {renderSortHeader('documentNumber', 'شماره سند/پیگیری', 'py-2.5 px-2.5 w-28 whitespace-nowrap text-right shrink-0')}
                      {renderSortHeader('description', 'شرح تراکنش', 'py-2.5 px-3 min-w-[200px] text-right')}
                      {renderSortHeader('debit', `بدهکار (${settings.currency})`, 'py-2.5 px-3 w-32 whitespace-nowrap text-left text-rose-700 font-bold shrink-0', 'left')}
                      {renderSortHeader('credit', `بستانکار (${settings.currency})`, 'py-2.5 px-3 w-32 whitespace-nowrap text-left text-emerald-700 font-bold shrink-0', 'left')}
                      {renderSortHeader('balance', 'مانده جاری', 'py-2.5 px-3 w-36 whitespace-nowrap text-left font-bold shrink-0', 'left', 'مانده لحظه‌ای حساب مشتری پس از اعمال هر ردیف')}
                      <th className="py-2.5 px-2 w-24 text-center whitespace-nowrap shrink-0">عملیات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {sortedEntries.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="py-12 text-center text-slate-400">
                          {fullLedger.entries.length === 0 
                            ? 'هنوز هیچ فاکتور یا تراکنش مالی برای این مشتری ثبت نشده است.' 
                            : 'هیچ تراکنشی با فیلترهای انتخابی یافت نشد.'}
                        </td>
                      </tr>
                    ) : (
                      paginateArray(sortedEntries, entriesPage, entriesPageSize).map((entry, index) => {
                        const globalIndex = entriesPageSize > 0 ? (entriesPage - 1) * entriesPageSize + index : index;
                        const isInvoice = entry.documentType === 'invoice';
                        const isManualTxn = !!entry.rawTransaction;
                        const hasClickableInvoice = Boolean(entry.rawInvoice || entry.rawPurchaseInvoice);
                        const serviceInfo = getInvoiceServiceInfo(entry.rawInvoice);

                        return (
                          <tr 
                            key={entry.id}
                            onClick={() => {
                              if (hasClickableInvoice) {
                                setBriefInvoiceEntry(entry);
                              }
                            }}
                            title={hasClickableInvoice ? 'کلیک جهت مشاهده خلاصه جزئیات فاکتور' : undefined}
                            className={`transition-colors ${
                              hasClickableInvoice
                                ? 'cursor-pointer hover:bg-purple-50/50'
                                : 'hover:bg-slate-50'
                            } ${
                              globalIndex % 2 === 1 ? 'bg-slate-50/40' : 'bg-white'
                            }`}
                          >
                            <td className="py-2.5 px-2 text-center text-slate-400 font-mono text-[11px] w-10 shrink-0">
                              {toPersianDigits(globalIndex + 1)}
                            </td>
                            <td className="py-2.5 px-2.5 font-mono text-slate-700 font-semibold whitespace-nowrap w-24 text-right shrink-0">
                              {toPersianDigits(entry.date)}
                            </td>
                            <td className="py-2.5 px-2.5 whitespace-nowrap w-24 text-right shrink-0">
                              <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md ${
                                entry.documentType === 'invoice'
                                  ? 'bg-purple-50 text-purple-700 border border-purple-200'
                                  : entry.documentType === 'purchase_invoice'
                                    ? 'bg-amber-50 text-amber-800 border border-amber-300'
                                    : entry.documentType === 'purchase_payment'
                                      ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                      : entry.documentType === 'deposit'
                                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                        : entry.documentType === 'invoice_payment'
                                          ? 'bg-teal-50 text-teal-700 border border-teal-200'
                                          : 'bg-rose-50 text-rose-700 border border-rose-200'
                              }`}>
                                {getDisplayDocTypeLabel(entry)}
                              </span>
                            </td>
                            <td className="py-2.5 px-2.5 font-mono text-slate-800 text-[11px] whitespace-nowrap font-medium w-28 text-right shrink-0">
                              {toPersianDigits(entry.documentNumber)}
                            </td>
                            <td className="py-2.5 px-3 text-slate-700 leading-relaxed min-w-[200px]">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span>{entry.description}</span>
                                {serviceInfo.hasService && (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 shrink-0">
                                    <Sparkles className="w-2.5 h-2.5 text-indigo-600" />
                                    <span>{serviceInfo.isOnlyService ? 'فاکتور خدماتی' : 'شامل خدمات'}</span>
                                  </span>
                                )}
                              </div>
                              {showSuppliers && entry.supplierNames && entry.supplierNames.length > 0 && (
                                <div className="mt-1 flex items-center gap-1 flex-wrap">
                                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-900 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-md">
                                    <Building2 className="w-3 h-3 text-amber-600 shrink-0" />
                                    <span>تامین‌کننده: {entry.supplierNames.join('، ')}</span>
                                  </span>
                                </div>
                              )}
                              {entry.trackingNumber && (
                                <span className="text-[10px] text-slate-400 block font-mono mt-0.5">
                                  پیگیری: {toPersianDigits(entry.trackingNumber)}
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 font-mono tabular-nums font-bold text-rose-700 whitespace-nowrap text-left w-32 shrink-0">
                              {entry.debit > 0 ? toPersianDigits(entry.debit.toLocaleString('en-US')) : '—'}
                            </td>
                            <td className="py-2.5 px-3 font-mono tabular-nums font-bold text-emerald-700 whitespace-nowrap text-left w-32 shrink-0">
                              {entry.credit > 0 ? toPersianDigits(entry.credit.toLocaleString('en-US')) : '—'}
                            </td>
                            <td className="py-2.5 px-3 font-mono tabular-nums font-bold whitespace-nowrap text-left w-36 shrink-0">
                              <div className="flex items-center justify-end gap-1.5">
                                <span className={entry.balance > 0 ? 'text-rose-800' : entry.balance < 0 ? 'text-blue-800' : 'text-slate-600'}>
                                  {toPersianDigits(Math.abs(entry.balance).toLocaleString('en-US'))}
                                </span>
                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0 ${
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
                            <td
                              className="py-2.5 px-2 text-center whitespace-nowrap w-24 shrink-0"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <div className="flex items-center justify-center gap-1">
                                {/* 1. View Invoice */}
                                {entry.rawInvoice && onViewInvoice && (
                                  <button
                                    type="button"
                                    onClick={() => onViewInvoice(entry.rawInvoice!)}
                                    title="مشاهده فاکتور"
                                    className="p-1.5 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 rounded-lg cursor-pointer transition-colors"
                                  >
                                    <Eye className="w-4 h-4" />
                                  </button>
                                )}

                                {/* 2. Manual Transaction (Deposit or Debt): Edit & Delete */}
                                {isManualTxn && entry.rawTransaction && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => handleOpenEditTransaction(entry.rawTransaction!)}
                                      title={entry.rawTransaction.type === 'deposit' ? 'ویرایش سند واریزی' : 'ویرایش سند بدهی'}
                                      className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg cursor-pointer transition-colors"
                                    >
                                      <Pencil className="w-4 h-4" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setItemToDelete({
                                        type: 'transaction',
                                        id: entry.rawTransaction!.id,
                                        amount: entry.rawTransaction!.amount,
                                        title: entry.rawTransaction!.title || (entry.rawTransaction!.type === 'deposit' ? 'واریز وجه' : 'سند بدهی'),
                                        transaction: entry.rawTransaction,
                                      })}
                                      title="حذف سند مالی"
                                      className="p-1.5 text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded-lg cursor-pointer transition-colors"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </>
                                )}

                                {/* 3. Invoice Payment (Deposit on Invoice): Edit & Delete */}
                                {entry.documentType === 'invoice_payment' && entry.rawInvoice && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => handleOpenEditInvoicePayment(entry.rawInvoice!)}
                                      title="ویرایش مبلغ واریزی فاکتور"
                                      className="p-1.5 text-teal-600 hover:text-teal-800 hover:bg-teal-50 rounded-lg cursor-pointer transition-colors"
                                    >
                                      <Pencil className="w-4 h-4" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setItemToDelete({
                                        type: 'invoice_payment',
                                        id: entry.rawInvoice!.id,
                                        amount: entry.credit,
                                        title: `واریزی فاکتور شماره #${toPersianDigits(entry.rawInvoice!.invoiceNumber)}`,
                                        invoice: entry.rawInvoice,
                                      })}
                                      title="حذف واریزی فاکتور (بازگشت به بدهکاری)"
                                      className="p-1.5 text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded-lg cursor-pointer transition-colors"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </>
                                )}

                                {/* 4. Invoice Debt (Sales Invoice): Edit & Delete */}
                                {entry.documentType === 'invoice' && entry.rawInvoice && (
                                  <>
                                    {onEditInvoice && (
                                      <button
                                        type="button"
                                        onClick={() => onEditInvoice(entry.rawInvoice!)}
                                        title="ویرایش اقلام فاکتور فروش"
                                        className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg cursor-pointer transition-colors"
                                      >
                                        <Pencil className="w-4 h-4" />
                                      </button>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() => setItemToDelete({
                                        type: 'invoice',
                                        id: entry.rawInvoice!.id,
                                        amount: entry.debit,
                                        title: `فاکتور فروش شماره #${toPersianDigits(entry.rawInvoice!.invoiceNumber)}`,
                                        invoice: entry.rawInvoice,
                                      })}
                                      title="حذف کامل فاکتور و بدهی"
                                      className="p-1.5 text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded-lg cursor-pointer transition-colors"
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
                  {/* Table Footer Totals */}
                  {sortedEntries.length > 0 && (
                    <tfoot className="sticky bottom-0 z-10 bg-slate-100 shadow-2xs">
                      <tr className="bg-slate-100 font-bold text-slate-800 border-t-2 border-slate-300">
                        <td colSpan={5} className="py-2.5 px-4 text-left font-bold text-xs">
                          {isSearchOrFilterActive
                            ? `مجموع گردش و مانده نتایج جستجو (${toPersianDigits(activeTotals.entriesCount)} سند) (${settings.currency}):`
                            : `مجموع گردش و مانده نهایی (${settings.currency}):`}
                        </td>
                        <td className="py-2.5 px-3 font-mono tabular-nums font-black text-rose-800 text-xs whitespace-nowrap text-left w-32 shrink-0">
                          {toPersianDigits(activeTotals.totalDebit.toLocaleString('en-US'))}
                        </td>
                        <td className="py-2.5 px-3 font-mono tabular-nums font-black text-emerald-800 text-xs whitespace-nowrap text-left w-32 shrink-0">
                          {toPersianDigits(activeTotals.totalCredit.toLocaleString('en-US'))}
                        </td>
                        <td colSpan={2} className="py-2.5 px-3 font-mono tabular-nums font-black text-xs whitespace-nowrap text-left w-60">
                          <span className={activeTotals.netBalance > 0 ? 'text-rose-800' : activeTotals.netBalance < 0 ? 'text-blue-800' : 'text-emerald-800'}>
                            {toPersianDigits(Math.abs(activeTotals.netBalance).toLocaleString('en-US'))} {settings.currency} (
                            {activeTotals.netBalance > 0 ? 'بدهکار' : activeTotals.netBalance < 0 ? 'بستانکار' : 'تسویه'})
                          </span>
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          )}

          {sortedEntries.length > 0 && (
            <div className="mt-3">
              <SmartPagination
                currentPage={entriesPage}
                totalItems={sortedEntries.length}
                pageSize={entriesPageSize}
                onPageChange={setEntriesPage}
                onPageSizeChange={setEntriesPageSize}
                itemLabel="تراکنش"
              />
            </div>
          )}
        </div>

        {/* MODAL FOOTER & MOBILE STICKY SUMMARY BAR */}
        <div className="no-print p-3 sm:p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-2.5 shrink-0">
          <div className="text-[11px] sm:text-xs text-slate-500 truncate min-w-0">
            {isSearchOrFilterActive ? 'مانده نتایج جستجو به حروف: ' : 'مانده به حروف: '}
            <strong className="text-slate-800">
              {activeTotals.netBalance === 0 
                ? 'تسویه کامل (بی‌حساب)' 
                : `${numberToPersianWords(Math.abs(activeTotals.netBalance))} ${settings.currency} ${activeTotals.netBalance > 0 ? 'بدهکار' : 'طلبکار (بستانکار)'}`}
            </strong>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {fullLedger.netBalance > 0 ? (
              <button
                type="button"
                onClick={() => handleOpenTransactionModal('deposit')}
                className="sm:hidden px-3 py-1.5 text-xs font-bold text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 cursor-pointer shadow-xs"
              >
                واریز سریع
              </button>
            ) : fullLedger.netBalance < 0 ? (
              <button
                type="button"
                onClick={() => handleOpenTransactionModal('debt')}
                className="sm:hidden px-3 py-1.5 text-xs font-bold text-white bg-blue-600 rounded-xl hover:bg-blue-700 cursor-pointer shadow-xs"
              >
                پرداخت وجه
              </button>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              className="px-4 sm:px-5 py-1.5 sm:py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-100 cursor-pointer transition-all"
            >
              بستن
            </button>
          </div>
        </div>

        {/* PRINTABLE OFFICIAL CUSTOMER STATEMENT SHEET (Visible only during print - No outer page border, pure white bg, internal borders preserved) */}
        <div className="print-only hidden p-8 text-black bg-white border-0 shadow-none">
          {/* Header */}
          <div className="border-b-2 border-slate-800 pb-4 mb-6 bg-white">
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
          <div className="border border-slate-300 rounded-xl p-4 mb-6 bg-white">
            <div className="grid grid-cols-2 gap-3 text-xs leading-relaxed">
              <div><strong>نام طرف‌حساب:</strong> {customer.name}</div>
              <div><strong>شماره تماس:</strong> {customer.phone ? toPersianDigits(customer.phone) : '—'}</div>
              <div><strong>کد ملی / شناسه اقتصادی:</strong> {customer.nationalId ? toPersianDigits(customer.nationalId) : '—'}</div>
              <div><strong>نشانی خریدار:</strong> {customer.address || '—'}</div>
            </div>
          </div>

          {/* Ledger Table for Print */}
          <table className="w-full text-right text-xs border border-slate-300 border-collapse mb-6 bg-white">
            <thead>
              <tr className="bg-white text-slate-900 font-bold border-b border-slate-300">
                <th className="py-2 px-2 border-l border-slate-300 text-center w-8 bg-white">#</th>
                <th className="py-2 px-2 border-l border-slate-300 w-24 bg-white">تاریخ</th>
                <th className="py-2 px-2 border-l border-slate-300 w-28 bg-white">نوع سند</th>
                <th className="py-2 px-2 border-l border-slate-300 w-24 bg-white">شماره سند/پیگیری</th>
                <th className="py-2 px-2 border-l border-slate-300 bg-white">شرح سند</th>
                <th className="py-2 px-2 border-l border-slate-300 w-24 bg-white">بدهکار ({settings.currency})</th>
                <th className="py-2 px-2 border-l border-slate-300 w-24 bg-white">بستانکار ({settings.currency})</th>
                <th className="py-2 px-2 w-28 bg-white">مانده حساب</th>
              </tr>
            </thead>
            <tbody>
              {(isSearchOrFilterActive || sortField !== 'default' ? sortedEntries : fullLedger.entries).map((item, idx) => (
                <tr key={item.id} className="bg-white border-b border-slate-300 text-[11px]">
                  <td className="py-1.5 px-2 border-l border-slate-300 text-center font-mono bg-white">{toPersianDigits(idx + 1)}</td>
                  <td className="py-1.5 px-2 border-l border-slate-300 font-mono bg-white">{toPersianDigits(item.date)}</td>
                  <td className="py-1.5 px-2 border-l border-slate-300 font-medium bg-white">{getDisplayDocTypeLabel(item)}</td>
                  <td className="py-1.5 px-2 border-l border-slate-300 font-mono bg-white">{toPersianDigits(item.documentNumber)}</td>
                  <td className="py-1.5 px-2 border-l border-slate-300 bg-white">
                    <div>{item.description}</div>
                    {showSuppliers && item.supplierNames && item.supplierNames.length > 0 && (
                      <div className="text-[9.5px] text-amber-800 font-medium mt-0.5">
                        تامین‌کننده / فروشنده: {item.supplierNames.join('، ')}
                      </div>
                    )}
                  </td>
                  <td className="py-1.5 px-2 border-l border-slate-300 font-mono bg-white">{item.debit > 0 ? toPersianDigits(item.debit.toLocaleString('en-US')) : '—'}</td>
                  <td className="py-1.5 px-2 border-l border-slate-300 font-mono bg-white">{item.credit > 0 ? toPersianDigits(item.credit.toLocaleString('en-US')) : '—'}</td>
                  <td className="py-1.5 px-2 font-mono font-bold bg-white">
                    {toPersianDigits(Math.abs(item.balance).toLocaleString('en-US'))} ({item.balance > 0 ? 'بد' : item.balance < 0 ? 'بس' : 'تسویه'})
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-white font-bold border-t-2 border-slate-400">
                <td colSpan={5} className="py-2 px-3 border-l border-slate-300 text-left font-bold bg-white">
                  جمع کل و مانده نهایی ({settings.currency}):
                </td>
                <td className="py-2 px-2 border-l border-slate-300 font-mono font-black bg-white">
                  {toPersianDigits(fullLedger.totalDebit.toLocaleString('en-US'))}
                </td>
                <td className="py-2 px-2 border-l border-slate-300 font-mono font-black bg-white">
                  {toPersianDigits(fullLedger.totalCredit.toLocaleString('en-US'))}
                </td>
                <td className="py-2 px-2 font-mono font-black bg-white">
                  {toPersianDigits(Math.abs(fullLedger.netBalance).toLocaleString('en-US'))} ({fullLedger.netBalance > 0 ? 'بدهکار' : fullLedger.netBalance < 0 ? 'بستانکار' : 'تسویه'})
                </td>
              </tr>
            </tfoot>
          </table>

          {/* Bottom Statement Summary & Signatures */}
          <div className="border border-slate-300 rounded-xl p-4 mb-8 bg-white">
            <div className="text-xs leading-relaxed mb-1">
              <strong>مانده نهایی حساب به حروف:</strong> {fullLedger.netBalance === 0 
                ? 'حساب کاملاً تسویه و بی‌حساب است.' 
                : `${numberToPersianWords(Math.abs(fullLedger.netBalance))} ${settings.currency} ${fullLedger.netBalance > 0 ? 'بدهکار' : 'بستانکار'}`}
            </div>
            {settings.invoiceFooterText && (
              <div className="text-[11px] text-slate-600 mt-2">{settings.invoiceFooterText}</div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-8 text-center text-xs mt-12 pt-4 bg-white">
            <div className="border-t border-slate-400 pt-3">
              <span className="font-bold">مهر و امضای امور مالی / فروشگاه</span>
            </div>
            <div className="border-t border-slate-400 pt-3">
              <span className="font-bold">امضا و تایید مانده حساب توسط خریدار</span>
            </div>
          </div>
        </div>

      </div>

      {/* UNIVERSAL DELETE CONFIRMATION MODAL (DEPOSIT, DEBT, INVOICE PAYMENT, INVOICE) */}
      {itemToDelete && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-sm w-full p-5 sm:p-6 shadow-2xl border border-slate-200 text-right animate-in zoom-in-95">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mb-3.5 mx-auto">
              <Trash2 className="w-6 h-6 stroke-[2.2]" />
            </div>
            <h4 className="text-sm sm:text-base font-extrabold text-slate-900 text-center mb-1.5">
              {itemToDelete.type === 'transaction'
                ? 'حذف سند تراکنش مالی'
                : itemToDelete.type === 'invoice_payment'
                ? 'حذف واریزی ثبت شده فاکتور'
                : 'حذف فاکتور فروش'}
            </h4>
            <div className="text-xs text-slate-600 text-center mb-4 leading-relaxed space-y-2">
              <p>
                آیا از حذف «<strong>{itemToDelete.title}</strong>» به مبلغ{' '}
                <strong className="font-mono font-bold text-rose-700">
                  {formatPrice(itemToDelete.amount, settings.currency)}
                </strong>{' '}
                اطمینان دارید؟
              </p>
              {itemToDelete.type === 'invoice_payment' && (
                <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-900 font-medium text-right leading-relaxed">
                  توجه: با حذف این واریزی، فاکتور به حالت پرداخت‌نشده تغییر یافته و مانده بدهی مشتری افزایش خواهد یافت.
                </div>
              )}
              {itemToDelete.type === 'invoice' && (
                <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-[11px] text-rose-900 font-medium text-right leading-relaxed">
                  هشدار: این فاکتور و کل مبلغ بدهی آن به طور قطعی از سیستم و صورتحساب مشتری حذف خواهد شد.
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setItemToDelete(null)}
                className="flex-1 py-2.5 px-3 rounded-xl text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 cursor-pointer transition-colors"
              >
                انصراف
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="flex-1 py-2.5 px-3 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 shadow-md shadow-rose-600/20 cursor-pointer transition-all active:scale-98"
              >
                بله، حذف شود
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT INVOICE PAYMENT MODAL */}
      {invoicePaymentToEdit && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-slate-200 text-right space-y-4 animate-in zoom-in-95">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-teal-100 text-teal-700 flex items-center justify-center shadow-xs">
                  <Coins className="w-5 h-5 stroke-[2.2]" />
                </div>
                <div>
                  <h4 className="text-sm sm:text-base font-extrabold text-slate-900">
                    ویرایش مبلغ واریزی فاکتور
                  </h4>
                  <span className="text-[11px] text-slate-500 font-mono">
                    فاکتور شماره #{toPersianDigits(invoicePaymentToEdit.invoiceNumber)}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setInvoicePaymentToEdit(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3.5">
              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 text-xs flex justify-between items-center">
                <span className="text-slate-500 font-medium">مبلغ کل فاکتور:</span>
                <span className="font-black text-slate-800 font-mono">
                  {formatPrice(invoicePaymentToEdit.finalTotal, settings.currency)}
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  مبلغ واریز شده جدید ({settings.currency}):
                </label>
                <NumericInput
                  min={0}
                  max={invoicePaymentToEdit.finalTotal * 1.5}
                  value={editPaymentAmount}
                  onChange={(val) => setEditPaymentAmount(val)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm font-bold text-slate-800 focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
                />
                <div className="mt-1 flex items-center justify-between text-[11px] text-slate-400">
                  <span>مانده بدهی پس از ویرایش:</span>
                  <span className={`font-mono font-bold ${invoicePaymentToEdit.finalTotal - editPaymentAmount > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                    {formatPrice(Math.max(0, invoicePaymentToEdit.finalTotal - editPaymentAmount), settings.currency)}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  روش پرداخت / تسویه:
                </label>
                <select
                  value={editPaymentMethod}
                  onChange={(e) => setEditPaymentMethod(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
                >
                  <option value="cash">نقدی</option>
                  <option value="pos">دستگاه کارتخوان (POS)</option>
                  <option value="card">کارت به کارت</option>
                  <option value="transfer">حواله بانکی پایا / ساتنا</option>
                  <option value="cheque">چک بانکی صیادی</option>
                  <option value="credit">اعتباری / نسیه</option>
                  <option value="other">سایر روش‌ها</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  شماره پیگیری / شماره چک (اختیاری):
                </label>
                <input
                  type="text"
                  value={editPaymentTracking}
                  onChange={(e) => setEditPaymentTracking(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
                  placeholder="مثال: ۲۵۸۷۴۱ یا سریال چک"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  توضیحات واریزی:
                </label>
                <input
                  type="text"
                  value={editPaymentNote}
                  onChange={(e) => setEditPaymentNote(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
                  placeholder="توضیحاتی در مورد نحوه تسویه یا حساب..."
                />
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setInvoicePaymentToEdit(null)}
                className="flex-1 py-2.5 px-4 rounded-xl text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
              >
                انصراف
              </button>
              <button
                type="button"
                onClick={handleSaveInvoicePayment}
                className="flex-1 py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 shadow-md shadow-teal-600/20 transition-all cursor-pointer active:scale-98"
              >
                ذخیره تغییرات واریزی
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* OFFSCREEN FULL-FIDELITY PDF REPORT CONTAINER FOR HTML2CANVAS */}
      {/* ========================================================================= */}
      <div style={{ position: 'absolute', left: '-9999px', top: '0', zIndex: -100 }}>
        <div
          id="printable-customer-statement-pdf"
          dir="rtl"
          style={{
            width: '820px',
            backgroundColor: '#ffffff',
            border: 'none',
            outline: 'none',
            boxShadow: 'none',
            padding: '20px 18px',
            fontFamily: "'Vazirmatn', -apple-system, BlinkMacSystemFont, sans-serif",
            color: '#0f172a',
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          {/* Top Section: Official Administrative Accounting Ledger Table */}
          <div className="pdf-statement-top-group" style={{ width: '100%', backgroundColor: '#ffffff' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', border: 'none', backgroundColor: '#ffffff', fontSize: '10.5px', direction: 'rtl' }}>
              <thead data-pdf-thead="true" style={{ border: 'none', backgroundColor: '#ffffff' }}>
                {/* 1. Official Administrative Document Header inside thead (Preserved on ALL pages in PDF export - No outer page border) */}
                <tr className="pdf-doc-header-row" style={{ backgroundColor: '#ffffff', color: '#0f172a', border: 'none' }}>
                  <th
                    colSpan={9}
                    className="pdf-doc-header-cell"
                    style={{
                      padding: '0 0 12px 0',
                      border: 'none',
                      backgroundColor: '#ffffff',
                      fontWeight: 'normal',
                      textAlign: 'right',
                    }}
                  >
                    {/* A. Official 3-Column Administrative Header */}
                    <div
                      style={{
                        borderBottom: '2px solid #1e293b',
                        backgroundColor: '#ffffff',
                        paddingBottom: '12px',
                        marginBottom: '12px',
                        display: 'grid',
                        gridTemplateColumns: '1.3fr 1.2fr 1fr',
                        alignItems: 'center',
                        gap: '12px',
                      }}
                    >
                      {/* Right: Store / Organization Info */}
                      <div style={{ textAlign: 'right', backgroundColor: '#ffffff' }}>
                        <div style={{ fontSize: '16px', fontWeight: '900', color: '#0f172a', lineHeight: '1.3' }}>
                          {settings.storeName || 'سامانه یکپارچه فروش و حسابداری'}
                        </div>
                        {settings.tagline && (
                          <div style={{ fontSize: '10px', color: '#334155', marginTop: '3px', fontWeight: '600' }}>
                            {settings.tagline}
                          </div>
                        )}
                        <div style={{ fontSize: '9.5px', color: '#475569', marginTop: '4px', lineHeight: '1.5' }}>
                          {settings.address ? `نشانی: ${settings.address}` : ''}
                          {settings.phone || settings.mobile
                            ? `${settings.address ? ' | ' : ''}تلفن: ${toPersianDigits(settings.phone || settings.mobile || '')}`
                            : ''}
                        </div>
                      </div>

                      {/* Center: Official Administrative Document Title */}
                      <div style={{ textAlign: 'center', backgroundColor: '#ffffff' }}>
                        <div
                          style={{
                            display: 'inline-block',
                            border: '1.5px solid #1e293b',
                            borderRadius: '6px',
                            padding: '6px 16px',
                            backgroundColor: '#ffffff',
                          }}
                        >
                          <div style={{ fontSize: '14px', fontWeight: '900', color: '#0f172a', letterSpacing: '-0.2px' }}>
                            صورتحساب
                          </div>
                          <div style={{ fontSize: '9.5px', fontWeight: '600', color: '#475569', marginTop: '2px' }}>
                            برگه وضعیت مالی و ریز گردش حساب دفتری
                          </div>
                        </div>
                      </div>

                      {/* Left: Official Administrative Document Metadata Box */}
                      <div
                        style={{
                          border: '1px solid #94a3b8',
                          borderRadius: '6px',
                          padding: '6px 10px',
                          backgroundColor: '#ffffff',
                          fontSize: '10px',
                          lineHeight: '1.65',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: '#475569' }}>تاریخ تنظیم سند:</span>
                          <strong style={{ fontFamily: 'monospace', color: '#0f172a' }}>
                            {toPersianDigits(getCurrentJalaliDate())}
                          </strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: '#475569' }}>شناسه طرف‌حساب:</span>
                          <strong style={{ fontFamily: 'monospace', color: '#0f172a' }}>
                            {toPersianDigits(customer.id.substring(0, 8).toUpperCase())}
                          </strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: '#475569' }}>واحد مالی گزارش:</span>
                          <strong style={{ color: '#0f172a' }}>{settings.currency}</strong>
                        </div>
                      </div>
                    </div>

                    {/* B. Customer Identification & Executive Financial Summary Box */}
                    <div
                      style={{
                        border: '1px solid #64748b',
                        borderRadius: '6px',
                        backgroundColor: '#ffffff',
                        overflow: 'hidden',
                        marginBottom: '6px',
                      }}
                    >
                      {/* Section Title Strip */}
                      <div
                        style={{
                          borderBottom: '1px solid #94a3b8',
                          padding: '5px 12px',
                          fontSize: '10px',
                          fontWeight: '800',
                          color: '#0f172a',
                          backgroundColor: '#ffffff',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
                      >
                        <span>مشخصات طرف‌حساب (خریدار / متقاضی)</span>
                        <span>
                          تعداد ردیف‌های گردش: {toPersianDigits(activeTotals.entriesCount)} سند
                          {isSearchOrFilterActive ? ' (بر اساس جستجو و فیلتر)' : ''}
                        </span>
                      </div>

                      {/* Filter notice banner in PDF if search/filter is active */}
                      {isSearchOrFilterActive && (
                        <div
                          style={{
                            borderBottom: '1px solid #94a3b8',
                            padding: '5px 12px',
                            fontSize: '9.5px',
                            backgroundColor: '#f8fafc',
                            color: '#1e293b',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                          }}
                        >
                          <div>
                            <strong style={{ color: '#0f172a' }}>فیلتر اعمال‌شده در گزارش: </strong>
                            <span>
                              {searchQuery.trim() ? `جستجو: «${searchQuery.trim()}» ` : ''}
                              {filterType === 'debt' ? '• فقط اسناد بدهکاری ' : filterType === 'deposit' ? '• فقط اسناد واریزی ' : ''}
                              {dateFilterMode === 'this_year' ? '• سال جاری ' : dateFilterMode === '30days' ? '• ۳۰ روز اخیر ' : dateFilterMode === '90days' ? '• ۳ ماه اخیر ' : dateFilterMode === 'custom' ? `• از ${customStartDate || 'ابتدا'} تا ${customEndDate || 'امروز'} ` : ''}
                              {selectedDocTypes.length > 0 ? `• نوع سند: ${selectedDocTypes.map(t => STATEMENT_DOC_TYPES.find(o => o.id === t)?.label || t).join(' + ')} ` : ''}
                              {sortField !== 'default' ? `• مرتب‌سازی: ${getSortLabel()}` : ''}
                            </span>
                          </div>
                          <span style={{ color: '#475569', fontWeight: 'bold' }}>
                            نمایش {toPersianDigits(activeTotals.entriesCount)} از کل {toPersianDigits(fullLedger.entries.length)} سند
                          </span>
                        </div>
                      )}

                      {/* Customer Details 4-Cell Grid */}
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '1.3fr 1fr 1fr',
                          padding: '8px 12px',
                          gap: '6px 16px',
                          fontSize: '10.5px',
                          lineHeight: '1.6',
                          color: '#0f172a',
                          backgroundColor: '#ffffff',
                        }}
                      >
                        <div>
                          <span style={{ color: '#475569' }}>نام شخص حقیقی / حقوقی: </span>
                          <strong style={{ fontSize: '11px' }}>{customer.name}</strong>
                        </div>
                        <div>
                          <span style={{ color: '#475569' }}>شماره تماس: </span>
                          <strong style={{ fontFamily: 'monospace' }}>
                            {customer.phone ? toPersianDigits(customer.phone) : '—'}
                          </strong>
                        </div>
                        <div>
                          <span style={{ color: '#475569' }}>کد ملی / اقتصادی: </span>
                          <strong style={{ fontFamily: 'monospace' }}>
                            {customer.nationalId ? toPersianDigits(customer.nationalId) : '—'}
                          </strong>
                        </div>
                        <div style={{ gridColumn: '1 / -1' }}>
                          <span style={{ color: '#475569' }}>نشانی کامل: </span>
                          <span>{customer.address || '—'}</span>
                        </div>
                      </div>

                      {/* Executive Financial Summary 3-Column Strip */}
                      <div
                        style={{
                          borderTop: '1px solid #94a3b8',
                          display: 'grid',
                          gridTemplateColumns: 'repeat(3, 1fr)',
                          backgroundColor: '#ffffff',
                          fontSize: '10.5px',
                        }}
                      >
                        <div style={{ padding: '6px 12px', borderLeft: '1px solid #cbd5e1', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#ffffff' }}>
                          <span style={{ color: '#475569', fontWeight: '600' }}>
                            {isSearchOrFilterActive ? 'جمع بدهکار (جستجو):' : 'جمع کل بدهکار:'}
                          </span>
                          <strong style={{ fontFamily: 'monospace', color: '#991b1b', fontSize: '11px' }}>
                            {toPersianDigits(activeTotals.totalDebit.toLocaleString('en-US'))} {settings.currency}
                          </strong>
                        </div>
                        <div style={{ padding: '6px 12px', borderLeft: '1px solid #cbd5e1', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#ffffff' }}>
                          <span style={{ color: '#475569', fontWeight: '600' }}>
                            {isSearchOrFilterActive ? 'جمع بستانکار (جستجو):' : 'جمع کل بستانکار:'}
                          </span>
                          <strong style={{ fontFamily: 'monospace', color: '#065f46', fontSize: '11px' }}>
                            {toPersianDigits(activeTotals.totalCredit.toLocaleString('en-US'))} {settings.currency}
                          </strong>
                        </div>
                        <div style={{ padding: '6px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#ffffff' }}>
                          <span style={{ color: '#0f172a', fontWeight: '800' }}>
                            {isSearchOrFilterActive ? 'مانده نتایج جستجو:' : 'مانده نهایی حساب:'}
                          </span>
                          <strong
                            style={{
                              fontFamily: 'monospace',
                              fontSize: '11px',
                              color:
                                activeTotals.netBalance > 0
                                  ? '#991b1b'
                                  : activeTotals.netBalance < 0
                                  ? '#1e40af'
                                  : '#065f46',
                            }}
                          >
                            {toPersianDigits(Math.abs(activeTotals.netBalance).toLocaleString('en-US'))} {settings.currency} (
                            {activeTotals.netBalance > 0 ? 'بدهکار' : activeTotals.netBalance < 0 ? 'بستانکار' : 'تسویه'})
                          </strong>
                        </div>
                      </div>
                    </div>
                  </th>
                </tr>

                {/* 2. Official Accounting Table Column Headers */}
                <tr
                  className="pdf-table-col-header-row"
                  style={{ backgroundColor: '#e2e8f0', color: '#0f172a', fontWeight: '900', fontSize: '10.5px', height: '40px' }}
                >
                  <th className="pdf-table-col-header-cell" style={{ padding: '10px 4px', border: '1px solid #64748b', backgroundColor: '#e2e8f0', textAlign: 'center', width: '32px' }}>ردیف</th>
                  <th className="pdf-table-col-header-cell" style={{ padding: '10px 5px', border: '1px solid #64748b', backgroundColor: '#e2e8f0', textAlign: 'center', width: '72px' }}>تاریخ</th>
                  <th className="pdf-table-col-header-cell" style={{ padding: '10px 5px', border: '1px solid #64748b', backgroundColor: '#e2e8f0', textAlign: 'center', width: '82px' }}>نوع سند</th>
                  <th className="pdf-table-col-header-cell" style={{ padding: '10px 5px', border: '1px solid #64748b', backgroundColor: '#e2e8f0', textAlign: 'center', width: '78px' }}>شماره سند</th>
                  <th className="pdf-table-col-header-cell" style={{ padding: '10px 8px', border: '1px solid #64748b', backgroundColor: '#e2e8f0', textAlign: 'right' }}>شرح کامل تراکنش و جزئیات سند</th>
                  <th className="pdf-table-col-header-cell" style={{ padding: '10px 6px', border: '1px solid #64748b', backgroundColor: '#e2e8f0', textAlign: 'center', width: '88px', color: '#991b1b' }}>بدهکار ({settings.currency})</th>
                  <th className="pdf-table-col-header-cell" style={{ padding: '10px 6px', border: '1px solid #64748b', backgroundColor: '#e2e8f0', textAlign: 'center', width: '88px', color: '#065f46' }}>بستانکار ({settings.currency})</th>
                  <th className="pdf-table-col-header-cell" style={{ padding: '10px 6px', border: '1px solid #64748b', backgroundColor: '#e2e8f0', textAlign: 'center', width: '92px' }}>مانده حساب</th>
                  <th className="pdf-table-col-header-cell" style={{ padding: '10px 4px', border: '1px solid #64748b', backgroundColor: '#e2e8f0', textAlign: 'center', width: '44px' }}>تشخیص</th>
                </tr>
              </thead>

              <tbody style={{ backgroundColor: '#ffffff' }}>
                {sortedEntries.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ textAlign: 'center', padding: '24px 10px', color: '#64748b', fontSize: '11px', border: '1px solid #94a3b8' }}>
                      هیچ سندی با معیارهای جستجو و فیلتر فعلی یافت نشد.
                    </td>
                  </tr>
                ) : (
                  sortedEntries.map((item, idx) => (
                    <tr
                      key={`pdf-${item.id}`}
                      style={{
                        backgroundColor: '#ffffff',
                      }}
                    >
                      <td style={{ padding: '5px 4px', border: '1px solid #94a3b8', backgroundColor: '#ffffff', textAlign: 'center', fontFamily: 'monospace', color: '#334155', fontWeight: 'bold' }}>
                        {toPersianDigits(idx + 1)}
                      </td>
                      <td style={{ padding: '5px 5px', border: '1px solid #94a3b8', backgroundColor: '#ffffff', textAlign: 'center', fontFamily: 'monospace', fontWeight: 'bold', color: '#0f172a' }}>
                        {toPersianDigits(item.date)}
                      </td>
                      <td style={{ padding: '5px 5px', border: '1px solid #94a3b8', backgroundColor: '#ffffff', textAlign: 'center', fontWeight: '600', color: '#1e293b' }}>
                        {getDisplayDocTypeLabel(item)}
                      </td>
                      <td style={{ padding: '5px 5px', border: '1px solid #94a3b8', backgroundColor: '#ffffff', textAlign: 'center', fontFamily: 'monospace', fontWeight: 'bold', color: '#334155' }}>
                        {toPersianDigits(item.documentNumber)}
                      </td>
                      <td style={{ padding: '5px 8px', border: '1px solid #94a3b8', backgroundColor: '#ffffff', lineHeight: '1.45', color: '#0f172a' }}>
                        <div style={{ fontWeight: '500' }}>{item.description}</div>
                        {showSuppliers && item.supplierNames && item.supplierNames.length > 0 && (
                          <div style={{ color: '#92400e', fontSize: '9px', marginTop: '2px', fontWeight: 'bold' }}>
                            تامین‌کننده / فروشنده کالا: {item.supplierNames.join('، ')}
                          </div>
                        )}
                        {item.trackingNumber && (
                          <span style={{ display: 'block', fontSize: '9px', color: '#475569', fontFamily: 'monospace', marginTop: '1px' }}>
                            کد پیگیری / سریال: {toPersianDigits(item.trackingNumber)}
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '5px 6px', border: '1px solid #94a3b8', backgroundColor: '#ffffff', textAlign: 'center', fontFamily: 'monospace', fontWeight: 'bold', color: '#991b1b' }}>
                        {item.debit > 0 ? toPersianDigits(item.debit.toLocaleString('en-US')) : '—'}
                      </td>
                      <td style={{ padding: '5px 6px', border: '1px solid #94a3b8', backgroundColor: '#ffffff', textAlign: 'center', fontFamily: 'monospace', fontWeight: 'bold', color: '#065f46' }}>
                        {item.credit > 0 ? toPersianDigits(item.credit.toLocaleString('en-US')) : '—'}
                      </td>
                      <td style={{ padding: '5px 6px', border: '1px solid #94a3b8', backgroundColor: '#ffffff', textAlign: 'center', fontFamily: 'monospace', fontWeight: '800', color: '#0f172a' }}>
                        {toPersianDigits(Math.abs(item.balance).toLocaleString('en-US'))}
                      </td>
                      <td
                        style={{
                          padding: '5px 4px',
                          border: '1px solid #94a3b8',
                          backgroundColor: '#ffffff',
                          textAlign: 'center',
                          fontWeight: '800',
                          fontSize: '9.5px',
                          color: item.balance > 0 ? '#991b1b' : item.balance < 0 ? '#1e40af' : '#065f46',
                        }}
                      >
                        {item.balance > 0 ? 'بد' : item.balance < 0 ? 'بس' : 'تسویه'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>

              <tfoot style={{ backgroundColor: '#ffffff' }}>
                {/* Grand Totals Row */}
                <tr style={{ backgroundColor: '#ffffff', fontWeight: '900', color: '#0f172a', fontSize: '10.5px' }}>
                  <td colSpan={5} style={{ padding: '8px 10px', border: '1px solid #64748b', backgroundColor: '#ffffff', textAlign: 'left', fontWeight: '900' }}>
                    {isSearchOrFilterActive
                      ? `جمع گردش و مانده نتایج جستجو (${toPersianDigits(activeTotals.entriesCount)} سند) (${settings.currency}):`
                      : `جمع کل گردش حساب و مانده نهایی (${settings.currency}):`}
                  </td>
                  <td style={{ padding: '8px 6px', border: '1px solid #64748b', backgroundColor: '#ffffff', textAlign: 'center', fontFamily: 'monospace', fontWeight: '900', color: '#991b1b' }}>
                    {toPersianDigits(activeTotals.totalDebit.toLocaleString('en-US'))}
                  </td>
                  <td style={{ padding: '8px 6px', border: '1px solid #64748b', backgroundColor: '#ffffff', textAlign: 'center', fontFamily: 'monospace', fontWeight: '900', color: '#065f46' }}>
                    {toPersianDigits(activeTotals.totalCredit.toLocaleString('en-US'))}
                  </td>
                  <td style={{ padding: '8px 6px', border: '1px solid #64748b', backgroundColor: '#ffffff', textAlign: 'center', fontFamily: 'monospace', fontWeight: '900', color: '#0f172a' }}>
                    {toPersianDigits(Math.abs(activeTotals.netBalance).toLocaleString('en-US'))}
                  </td>
                  <td
                    style={{
                      padding: '8px 4px',
                      border: '1px solid #64748b',
                      backgroundColor: '#ffffff',
                      textAlign: 'center',
                      fontWeight: '900',
                      fontSize: '9.5px',
                      color: activeTotals.netBalance > 0 ? '#991b1b' : activeTotals.netBalance < 0 ? '#1e40af' : '#065f46',
                    }}
                  >
                    {activeTotals.netBalance > 0 ? 'بدهکار' : activeTotals.netBalance < 0 ? 'بستانکار' : 'تسویه'}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Bottom Section: Pinned to bottom of page when row count is small */}
          <div
            className="pdf-statement-footer-group"
            data-pdf-footer="true"
            style={{
              width: '100%',
              marginTop: 'auto',
              paddingTop: '14px',
              backgroundColor: '#ffffff',
            }}
          >
            {/* C. Official Amount in Words Box */}
            <div
              style={{
                border: '1px solid #64748b',
                borderRadius: '6px',
                padding: '9px 14px',
                backgroundColor: '#ffffff',
                marginBottom: '12px',
                fontSize: '10.5px',
                lineHeight: '1.65',
              }}
            >
              <div>
                <strong style={{ color: '#0f172a' }}>
                  {isSearchOrFilterActive ? 'مانده نتایج جستجو به حروف: ' : 'مانده نهایی حساب به حروف: '}
                </strong>
                <span
                  style={{
                    fontWeight: '800',
                    color: activeTotals.netBalance > 0 ? '#991b1b' : activeTotals.netBalance < 0 ? '#1e40af' : '#065f46',
                  }}
                >
                  {activeTotals.netBalance === 0
                    ? 'حساب طرف‌حساب در این بازه/جستجو کاملاً تسویه و بی‌حساب می‌باشد.'
                    : `${numberToPersianWords(Math.abs(activeTotals.netBalance))} ${settings.currency}`}
                </span>
                {isSearchOrFilterActive && (
                  <div style={{ fontSize: '9px', color: '#64748b', marginTop: '4px' }}>
                    * ارقام، اقلام و مانده فوق بر اساس نتایج جستجو و فیلترهای انتخابی کاربر در سیستم استخراج و صادر گردیده است.
                  </div>
                )}
              </div>
            </div>

            {/* D. Official 3-Column Administrative Signature & Stamp Boxes */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '12px',
                textAlign: 'center',
                fontSize: '10px',
                backgroundColor: '#ffffff',
              }}
            >
              <div
                style={{
                  border: '1px solid #94a3b8',
                  borderRadius: '6px',
                  padding: '8px 10px',
                  minHeight: '68px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  backgroundColor: '#ffffff',
                }}
              >
                <span style={{ fontWeight: '800', color: '#1e293b' }}>تنظیم‌کننده / واحد حسابداری</span>
                <span style={{ fontSize: '9px', color: '#64748b' }}>نام، تاریخ و امضا</span>
              </div>

              <div
                style={{
                  border: '1px solid #94a3b8',
                  borderRadius: '6px',
                  padding: '8px 10px',
                  minHeight: '68px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  backgroundColor: '#ffffff',
                }}
              >
                <span style={{ fontWeight: '800', color: '#1e293b' }}>مهر و امضای مدیریت / فروشگاه</span>
                <span style={{ fontSize: '9px', color: '#64748b' }}>محل مهر و تایید رسمی</span>
              </div>

              <div
                style={{
                  border: '1px solid #94a3b8',
                  borderRadius: '6px',
                  padding: '8px 10px',
                  minHeight: '68px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  backgroundColor: '#ffffff',
                }}
              >
                <span style={{ fontWeight: '800', color: '#1e293b' }}>تایید و امضای طرف‌حساب (خریدار)</span>
                <span style={{ fontSize: '9px', color: '#64748b' }}>تایید صحت مانده حساب</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* COMPACT BRIEF INVOICE DETAILS MINI-MODAL (ON ROW CLICK) */}
      {briefInvoiceEntry && (briefInvoiceEntry.rawInvoice || briefInvoiceEntry.rawPurchaseInvoice) && (() => {
        const salesInv = briefInvoiceEntry.rawInvoice;
        const purchaseInv = briefInvoiceEntry.rawPurchaseInvoice;
        const srvInfo = getInvoiceServiceInfo(salesInv);

        const docNumber = salesInv ? salesInv.invoiceNumber : purchaseInv!.invoiceNumber;
        const docDate = salesInv ? salesInv.date : purchaseInv!.date;
        const finalTotal = salesInv ? salesInv.finalTotal : purchaseInv!.finalTotal;
        const paidAmount = salesInv
          ? salesInv.paymentStatus === 'paid'
            ? salesInv.finalTotal
            : salesInv.paidAmount || 0
          : purchaseInv!.paymentStatus === 'paid'
          ? purchaseInv!.finalTotal
          : purchaseInv!.paidAmount || 0;
        const remaining = Math.max(0, finalTotal - paidAmount);
        const totalDiscount = salesInv ? salesInv.totalDiscount || 0 : purchaseInv!.totalDiscount || 0;
        const taxAmount = salesInv ? salesInv.taxAmount || 0 : purchaseInv!.taxAmount || 0;
        const notes = salesInv ? salesInv.notes : purchaseInv!.notes;

        return (
          <div
            className="fixed inset-0 z-70 bg-slate-900/55 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150"
            onClick={() => setBriefInvoiceEntry(null)}
          >
            <div
              className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden text-right animate-in zoom-in-95 duration-150"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Compact Header */}
              <div className="bg-slate-900 text-white px-4 py-3 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-300 border border-purple-500/30 flex items-center justify-center shrink-0">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h4 className="font-black text-xs sm:text-sm text-white truncate">
                        {salesInv
                          ? srvInfo.isOnlyService
                            ? 'خلاصه فاکتور خدماتی'
                            : srvInfo.hasService
                            ? 'خلاصه فاکتور فروش و خدمات'
                            : 'خلاصه فاکتور فروش'
                          : 'خلاصه فاکتور خرید کالا'}
                      </h4>
                      <span className="font-mono text-[11px] font-bold bg-white/15 px-2 py-0.5 rounded-md text-emerald-300">
                        #{toPersianDigits(docNumber)}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-300 font-mono mt-0.5">
                      تاریخ سند: {toPersianDigits(docDate)}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setBriefInvoiceEntry(null)}
                  className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer shrink-0"
                  title="بستن"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Compact Body */}
              <div className="p-3.5 space-y-3 max-h-[70vh] overflow-y-auto text-xs">
                {/* Items List */}
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <div className="bg-slate-50 px-3 py-1.5 border-b border-slate-200 flex items-center justify-between text-[11px] font-bold text-slate-700">
                    <span>اقلام فاکتور</span>
                    <span className="font-mono text-slate-500">
                      {toPersianDigits(salesInv ? salesInv.items.length : purchaseInv!.items.length)} ردیف
                    </span>
                  </div>

                  <div className="divide-y divide-slate-100 max-h-52 overflow-y-auto">
                    {salesInv
                      ? salesInv.items.map((it, i) => {
                          const isSrv = isServiceItem(it);
                          const unitPrice = it.unitPrice ?? it.price ?? 0;
                          const rowTotal = it.total ?? it.quantity * unitPrice;
                          return (
                            <div key={it.id || i} className="px-3 py-2 flex items-center justify-between gap-2 bg-white hover:bg-slate-50/70">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="font-mono text-[10px] text-slate-400">{toPersianDigits(i + 1)}.</span>
                                  <span className="font-bold text-slate-900 truncate">
                                    {it.productName || it.name || 'آیتم'}
                                  </span>
                                  {isSrv && (
                                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                                      خدمات
                                    </span>
                                  )}
                                </div>
                                {(it.description || it.notes) && (
                                  <div className="text-[10px] text-slate-500 truncate mt-0.5">
                                    {it.description || it.notes}
                                  </div>
                                )}
                              </div>

                              <div className="text-left shrink-0 font-mono">
                                <div className="font-black text-slate-900 text-xs">
                                  {toPersianDigits(rowTotal.toLocaleString('en-US'))} <span className="text-[9px] font-normal text-slate-400">{settings.currency}</span>
                                </div>
                                <div className="text-[10px] text-slate-500">
                                  {toPersianDigits(it.quantity)} {it.unit || 'عدد'} × {toPersianDigits(unitPrice.toLocaleString('en-US'))}
                                </div>
                              </div>
                            </div>
                          );
                        })
                      : purchaseInv!.items.map((it, i) => (
                          <div key={it.id || i} className="px-3 py-2 flex items-center justify-between gap-2 bg-white">
                            <div className="min-w-0 flex-1">
                              <span className="font-mono text-[10px] text-slate-400 ml-1">{toPersianDigits(i + 1)}.</span>
                              <span className="font-bold text-slate-900 truncate">{it.productName}</span>
                            </div>
                            <div className="text-left shrink-0 font-mono">
                              <div className="font-black text-slate-900 text-xs">
                                {toPersianDigits(it.total.toLocaleString('en-US'))} <span className="text-[9px] font-normal text-slate-400">{settings.currency}</span>
                              </div>
                              <div className="text-[10px] text-slate-500">
                                {toPersianDigits(it.quantity)} {it.unit || 'عدد'} × {toPersianDigits(it.buyPrice.toLocaleString('en-US'))}
                              </div>
                            </div>
                          </div>
                        ))}
                  </div>
                </div>

                {/* Financial Summary Box */}
                <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-200 space-y-1.5 text-[11px]">
                  {totalDiscount > 0 && (
                    <div className="flex items-center justify-between text-rose-600">
                      <span>تخفیف فاکتور:</span>
                      <span className="font-mono font-bold">{formatPrice(totalDiscount, settings.currency)}</span>
                    </div>
                  )}
                  {taxAmount > 0 && (
                    <div className="flex items-center justify-between text-slate-600">
                      <span>مالیات بر ارزش افزوده:</span>
                      <span className="font-mono font-bold">{formatPrice(taxAmount, settings.currency)}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between font-bold text-slate-900 text-xs pt-0.5">
                    <span>مبلغ نهایی فاکتور:</span>
                    <span className="font-mono font-black">{formatPrice(finalTotal, settings.currency)}</span>
                  </div>
                  <div className="flex items-center justify-between text-emerald-700 pt-1 border-t border-slate-200/80">
                    <span>پرداخت شده:</span>
                    <span className="font-mono font-bold">{formatPrice(paidAmount, settings.currency)}</span>
                  </div>
                  <div className="flex items-center justify-between pt-1 border-t border-slate-200/80">
                    <span className="font-bold text-slate-700">وضعیت تسویه این فاکتور:</span>
                    {remaining > 0 ? (
                      <span className="font-mono font-black text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200">
                        مانده: {formatPrice(remaining, settings.currency)}
                      </span>
                    ) : (
                      <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                        تسویه کامل
                      </span>
                    )}
                  </div>
                </div>

                {notes && (
                  <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-2.5 text-[11px] text-slate-700">
                    <span className="font-bold text-amber-900 ml-1">توضیحات فاکتور:</span>
                    <span>{notes}</span>
                  </div>
                )}
              </div>

              {/* Compact Footer */}
              <div className="px-3.5 py-2.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-2">
                {salesInv && onViewInvoice ? (
                  <button
                    type="button"
                    onClick={() => {
                      setBriefInvoiceEntry(null);
                      onViewInvoice(salesInv);
                    }}
                    className="flex-1 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>مشاهده کامل و چاپ فاکتور</span>
                  </button>
                ) : (
                  <div />
                )}
                <button
                  type="button"
                  onClick={() => setBriefInvoiceEntry(null)}
                  className="py-2 px-4 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 font-bold text-xs transition-colors cursor-pointer"
                >
                  بستن
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* SEPARATE MODAL: REGISTER / EDIT DEPOSIT OR DEBT */}
      {activeTxnModalType && (
        <CustomerTransactionModal
          isOpen={!!activeTxnModalType}
          onClose={() => {
            setActiveTxnModalType(null);
            setTransactionToEdit(null);
          }}
          customer={customer}
          initialType={activeTxnModalType}
          editingTransaction={transactionToEdit}
          invoices={invoices}
          transactions={transactions}
          settings={settings}
          currentUser={currentUser}
          onSaveTransaction={(txn) => {
            onSaveTransaction(txn);
            setActiveTxnModalType(null);
            setTransactionToEdit(null);
          }}
        />
      )}
    </div>
  );
};
