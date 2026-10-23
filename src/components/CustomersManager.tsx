import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Customer, Invoice, PurchaseInvoice, StoreSettings, AppUser, CustomerTransaction, CustomerFollowUpNote } from '../types';
import { formatPrice, toPersianDigits, getCurrentJalaliDate, addDaysToJalali } from '../utils/jalali';
import { StorageService } from '../utils/storage';
import { sendCustomerFollowUpReminderToTelegram, checkDueFollowUpRemindersOnTelegram, isTelegramConfigured } from '../utils/telegramService';
import { exportCustomersToExcel, exportPersonInvoicesAndExitSlipsToExcel } from '../utils/excelHelper';
import { ExcelImportModal } from './ExcelImportModal';
import { CustomerExportModal } from './CustomerExportModal';
import { CustomerBulkPaymentModal } from './CustomerBulkPaymentModal';
import { CustomerStatementModal } from './CustomerStatementModal';
import { CustomerStatementsReportModal } from './CustomerStatementsReportModal';
import { CustomerTransactionModal } from './CustomerTransactionModal';
import { JalaliDatePicker } from './JalaliDatePicker';
import { NumericInput } from './NumericInput';
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
  ChevronUp,
  SlidersHorizontal,
  FileText,
  Eye,
  User,
  Calendar,
  Copy,
  Check,
  Bell,
  MessageSquarePlus,
  Truck,
  Building2,
  Wallet,
  Send
} from 'lucide-react';

interface CustomersManagerProps {
  customers: Customer[];
  invoices: Invoice[];
  purchaseInvoices?: PurchaseInvoice[];
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
  onSaveTransaction?: (txn: CustomerTransaction) => void;
  onDeleteTransaction?: (txnId: string) => void;
  onViewInvoice?: (invoice: Invoice) => void;
  onEditInvoice?: (invoice: Invoice) => void;
  onDeleteInvoice?: (invoiceId: string) => void;
  onUpdatePaymentStatus?: (invoiceId: string, status: 'paid' | 'unpaid' | 'partial', paidAmount?: number) => void;
  onUpdatePurchaseInvoice?: (invoice: PurchaseInvoice) => void;
}

export interface SupplierSummary {
  key: string;
  supplierName: string;
  supplierPhone: string;
  invoices: PurchaseInvoice[];
  totalPurchased: number; // چقدر جنس از این تامین‌کننده خریده‌ایم
  totalPaid: number; // چقدر به او پرداخت کرده‌ایم
  remainingDebt: number; // چقدر هنوز به او بدهکاریم
  lastPurchaseDate: string;
}

export const CustomersManager: React.FC<CustomersManagerProps> = ({
  customers,
  invoices,
  purchaseInvoices = [],
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
  onEditInvoice,
  onDeleteInvoice,
  onUpdatePaymentStatus,
  onUpdatePurchaseInvoice,
}) => {
  const [activeSubSection, setActiveSubSection] = useState<'customers' | 'suppliers' | 'followups'>('customers');
  const [searchQuery, setSearchQuery] = useState('');
  const [supplierSearchQuery, setSupplierSearchQuery] = useState('');
  const [followUpFilter, setFollowUpFilter] = useState<'all' | 'due' | 'upcoming'>('all');
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportModalCustomer, setExportModalCustomer] = useState<Customer | null>(null);
  const [paymentModalCustomer, setPaymentModalCustomer] = useState<Customer | null>(null);
  const [statementCustomer, setStatementCustomer] = useState<Customer | null>(null);
  const [statementInitialForm, setStatementInitialForm] = useState<'none' | 'deposit' | 'debt'>('none');
  const [transactionCustomer, setTransactionCustomer] = useState<Customer | null>(null);
  const [transactionInitialType, setTransactionInitialType] = useState<'deposit' | 'debt'>('deposit');
  const [detailCustomer, setDetailCustomer] = useState<Customer | null>(null);
  const [isDetailActionsOpen, setIsDetailActionsOpen] = useState(false);
  const detailActionsDropdownRef = useRef<HTMLDivElement>(null);
  const [isStatementsReportOpen, setIsStatementsReportOpen] = useState(false);
  const [isActionsDropdownOpen, setIsActionsDropdownOpen] = useState(false);
  const actionsDropdownRef = useRef<HTMLDivElement>(null);

  // Follow-up & Negotiation Note Modal State (ثبت یادداشت مذاکره و یادآور تماس بعدی)
  const [followUpModalCustomer, setFollowUpModalCustomer] = useState<Customer | null>(null);
  const [newFollowUpNote, setNewFollowUpNote] = useState('');
  const [newFollowUpDate, setNewFollowUpDate] = useState('');
  const [sendingFollowUpTelegramId, setSendingFollowUpTelegramId] = useState<string | null>(null);
  const [followUpTelegramStatus, setFollowUpTelegramStatus] = useState<{
    message: string;
    type: 'success' | 'error' | 'info';
  } | null>(null);

  // Supplier Details & Payment Settlement Modal State (مانده حساب و ریز گردش تامین‌کننده)
  const [selectedSupplierKey, setSelectedSupplierKey] = useState<string | null>(null);
  const [payingPurchaseInvoice, setPayingPurchaseInvoice] = useState<PurchaseInvoice | null>(null);
  const [supplierPaymentInput, setSupplierPaymentInput] = useState<number>(0);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (actionsDropdownRef.current && !actionsDropdownRef.current.contains(event.target as Node)) {
        setIsActionsDropdownOpen(false);
      }
      if (detailActionsDropdownRef.current && !detailActionsDropdownRef.current.contains(event.target as Node)) {
        setIsDetailActionsOpen(false);
      }
    };
    if (isActionsDropdownOpen || isDetailActionsOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isActionsDropdownOpen, isDetailActionsOpen]);

  // Helper to open separate transaction window (deposit / debt)
  const handleOpenTransaction = (cust: Customer, type: 'deposit' | 'debt' = 'deposit') => {
    setTransactionCustomer(cust);
    setTransactionInitialType(type);
  };

  // Helper to open statement modal with optional initial form (deposit/debt)
  const handleOpenStatement = (cust: Customer, initialForm: 'none' | 'deposit' | 'debt' = 'none') => {
    setStatementCustomer(cust);
    setStatementInitialForm(initialForm);
  };

  // View Mode: 'table' (ردیفی) is default, with 'grid' (کارتی) option
  const [viewMode, setViewMode] = useState<'table' | 'grid'>(() => {
    return (localStorage.getItem('customers_view_mode') as 'table' | 'grid') || 'table';
  });
  const [statusFilter, setStatusFilter] = useState<'all' | 'debtors' | 'creditors' | 'settled'>(() => {
    try {
      return (localStorage.getItem('sepehr_customers_status_filter') as any) || 'all';
    } catch {
      return 'all';
    }
  });
  const [sortBy, setSortBy] = useState<'name-asc' | 'debt-desc' | 'orders-desc' | 'newest'>(() => {
    try {
      return (localStorage.getItem('sepehr_customers_sort_by') as any) || 'name-asc';
    } catch {
      return 'name-asc';
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('sepehr_customers_status_filter', statusFilter);
    } catch {}
  }, [statusFilter]);

  useEffect(() => {
    try {
      localStorage.setItem('sepehr_customers_sort_by', sortBy);
    } catch {}
  }, [sortBy]);

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
      customerType: 'regular',
      createdAt: getCurrentJalaliDate(),
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (cust: Customer) => {
    setEditingCustomer({ ...cust, customerType: cust.customerType || 'regular' });
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
      gender: editingCustomer.gender,
      titlePrefix: editingCustomer.titlePrefix,
      customerType: editingCustomer.customerType || 'regular',
      nextFollowUpDate: editingCustomer.nextFollowUpDate?.trim() || undefined,
      followUps: editingCustomer.followUps || [],
      createdAt: editingCustomer.createdAt || getCurrentJalaliDate(),
    };

    onSaveCustomer(saved);
    setIsModalOpen(false);
    setEditingCustomer(null);
  };

  // ------------------------------------------------------------------
  // 1. SUPPLIERS BALANCE & LEDGER AGGREGATION (مانده حساب تامین‌کنندگان)
  // ------------------------------------------------------------------
  const suppliersList = useMemo<SupplierSummary[]>(() => {
    const activePurchaseInvoices = (
      purchaseInvoices && purchaseInvoices.length > 0
        ? purchaseInvoices
        : StorageService.getPurchaseInvoices()
    ).filter((pi) => pi.status !== 'cancelled');

    const map = new Map<string, SupplierSummary>();

    activePurchaseInvoices.forEach((pi) => {
      const cleanName = (pi.supplierName || 'تامین‌کننده عمومی').trim();
      const key = cleanName.toLowerCase();
      const existing = map.get(key);

      const finalTotal = Number(pi.finalTotal) || 0;
      const paid =
        pi.paymentStatus === 'paid'
          ? finalTotal
          : Math.min(finalTotal, Math.max(0, Number(pi.paidAmount) || 0));
      const debt = Math.max(0, finalTotal - paid);

      if (!existing) {
        map.set(key, {
          key,
          supplierName: cleanName,
          supplierPhone: pi.supplierPhone || '',
          invoices: [pi],
          totalPurchased: finalTotal,
          totalPaid: paid,
          remainingDebt: debt,
          lastPurchaseDate: pi.date || '',
        });
      } else {
        existing.invoices.push(pi);
        existing.totalPurchased += finalTotal;
        existing.totalPaid += paid;
        existing.remainingDebt += debt;
        if (!existing.supplierPhone && pi.supplierPhone) {
          existing.supplierPhone = pi.supplierPhone;
        }
        if ((pi.date || '') > existing.lastPurchaseDate) {
          existing.lastPurchaseDate = pi.date || '';
        }
      }
    });

    const q = supplierSearchQuery.trim().toLowerCase();
    return Array.from(map.values())
      .filter((s) => !q || s.supplierName.toLowerCase().includes(q) || s.supplierPhone.includes(q))
      .sort((a, b) => b.remainingDebt - a.remainingDebt || b.totalPurchased - a.totalPurchased);
  }, [purchaseInvoices, supplierSearchQuery]);

  const suppliersTotals = useMemo(() => {
    return suppliersList.reduce(
      (acc, s) => {
        acc.totalPurchased += s.totalPurchased;
        acc.totalPaid += s.totalPaid;
        acc.remainingDebt += s.remainingDebt;
        if (s.remainingDebt > 0) acc.creditorSuppliersCount += 1;
        return acc;
      },
      { totalPurchased: 0, totalPaid: 0, remainingDebt: 0, creditorSuppliersCount: 0 }
    );
  }, [suppliersList]);

  const selectedSupplier = useMemo(
    () => suppliersList.find((s) => s.key === selectedSupplierKey) || null,
    [suppliersList, selectedSupplierKey]
  );

  const handleSaveSupplierPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!payingPurchaseInvoice) return;
    const newPaid = Math.min(
      payingPurchaseInvoice.finalTotal,
      Math.max(0, Number(supplierPaymentInput) || 0)
    );
    const newRemaining = Math.max(0, payingPurchaseInvoice.finalTotal - newPaid);
    const newStatus: 'paid' | 'unpaid' | 'partial' =
      newRemaining === 0 ? 'paid' : newPaid > 0 ? 'partial' : 'unpaid';

    const updatedPi: PurchaseInvoice = {
      ...payingPurchaseInvoice,
      paidAmount: newPaid,
      remainingAmount: newRemaining,
      paymentStatus: newStatus,
      updatedAt: new Date().toISOString(),
    };

    if (onUpdatePurchaseInvoice) {
      onUpdatePurchaseInvoice(updatedPi);
    } else {
      StorageService.savePurchaseInvoice(updatedPi);
    }
    setPayingPurchaseInvoice(null);
  };

  // ------------------------------------------------------------------
  // 2. CUSTOMER NEGOTIATION NOTES & CALL REMINDERS (یادداشت مذاکره و یادآور تماس)
  // ------------------------------------------------------------------
  const todayJalali = getCurrentJalaliDate();

  const handleOpenFollowUpModal = (cust: Customer) => {
    setFollowUpModalCustomer(cust);
    setNewFollowUpNote('');
    setNewFollowUpDate(cust.nextFollowUpDate || addDaysToJalali(7));
    setFollowUpTelegramStatus(null);
  };

  const handleManualSendFollowUpTelegram = async (cust: Customer, note?: CustomerFollowUpNote) => {
    const targetId = note?.id || cust.id;
    setSendingFollowUpTelegramId(targetId);
    setFollowUpTelegramStatus(null);
    try {
      const res = await sendCustomerFollowUpReminderToTelegram(cust, note, settings);
      if (res.success) {
        const nowIso = new Date().toISOString();
        const dueDate = note?.nextFollowUpDate || cust.nextFollowUpDate || todayJalali;
        const updatedFollowUps = (cust.followUps || []).map((f) =>
          note ? (f.id === note.id ? { ...f, telegramReminderSentAt: nowIso } : f) : f
        );
        const updatedCustomer: Customer = {
          ...cust,
          lastTelegramReminderForDate: dueDate,
          followUps: updatedFollowUps,
        };
        onSaveCustomer(updatedCustomer);
        if (followUpModalCustomer?.id === cust.id) {
          setFollowUpModalCustomer(updatedCustomer);
        }
        if (detailCustomer?.id === cust.id) {
          setDetailCustomer(updatedCustomer);
        }
        setFollowUpTelegramStatus({
          type: 'success',
          message: `پیام یادآوری تماس با «${cust.name}» با موفقیت به تلگرام ارسال شد.`,
        });
      } else {
        setFollowUpTelegramStatus({
          type: 'error',
          message: res.error || 'خطا در ارسال پیام یادآور به تلگرام.',
        });
      }
    } finally {
      setSendingFollowUpTelegramId(null);
    }
  };

  const handleAddFollowUpNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!followUpModalCustomer || !newFollowUpNote.trim()) return;

    const chosenDueDate = newFollowUpDate.trim() || undefined;
    const noteObj: CustomerFollowUpNote = {
      id: `fn-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      date: getCurrentJalaliDate(),
      note: newFollowUpNote.trim(),
      nextFollowUpDate: chosenDueDate,
      isCompleted: false,
      createdBy: currentUser?.fullName || currentUser?.username || 'مدیر سیستم',
      createdAt: new Date().toISOString(),
    };

    const existingFollowUps = Array.isArray(followUpModalCustomer.followUps)
      ? [...followUpModalCustomer.followUps]
      : [];

    const nextDate = chosenDueDate || followUpModalCustomer.nextFollowUpDate;
    const updatedCustomer: Customer = {
      ...followUpModalCustomer,
      nextFollowUpDate: nextDate,
      // Reset lastTelegramReminderForDate if a new reminder is registered so it triggers on the due date
      lastTelegramReminderForDate: chosenDueDate ? undefined : followUpModalCustomer.lastTelegramReminderForDate,
      followUps: [noteObj, ...existingFollowUps],
    };

    onSaveCustomer(updatedCustomer);
    setFollowUpModalCustomer(updatedCustomer);
    if (detailCustomer?.id === updatedCustomer.id) {
      setDetailCustomer(updatedCustomer);
    }
    setNewFollowUpNote('');

    if (chosenDueDate) {
      if (chosenDueDate <= todayJalali && isTelegramConfigured(settings)) {
        // Due date is today or earlier: send Telegram reminder immediately
        await handleManualSendFollowUpTelegram(updatedCustomer, noteObj);
      } else {
        // Trigger server background check and inform user about scheduled Telegram dispatch
        checkDueFollowUpRemindersOnTelegram().catch(() => {});
        setFollowUpTelegramStatus({
          type: 'info',
          message: `یادداشت مذاکره ثبت شد. در زمان فرارسیدن موعد (${toPersianDigits(chosenDueDate)})، پیام یادآوری تماس به صورت خودکار در تلگرام ارسال خواهد شد.`,
        });
      }
    } else {
      setFollowUpTelegramStatus({
        type: 'success',
        message: 'یادداشت مذاکره با موفقیت در پرونده مشتری ثبت شد.',
      });
    }
  };

  const handleToggleCompleteFollowUp = (cust: Customer, noteId?: string) => {
    const updatedFollowUps = (cust.followUps || []).map((f) =>
      noteId ? (f.id === noteId ? { ...f, isCompleted: !f.isCompleted } : f) : { ...f, isCompleted: true }
    );
    const updatedCustomer: Customer = {
      ...cust,
      nextFollowUpDate: noteId ? cust.nextFollowUpDate : undefined,
      followUps: updatedFollowUps,
    };
    onSaveCustomer(updatedCustomer);
    if (followUpModalCustomer?.id === cust.id) {
      setFollowUpModalCustomer(updatedCustomer);
    }
    if (detailCustomer?.id === cust.id) {
      setDetailCustomer(updatedCustomer);
    }
  };

  const handleDeleteFollowUpNote = (cust: Customer, noteId: string) => {
    const remaining = (cust.followUps || []).filter((f) => f.id !== noteId);
    const latestActiveReminder = remaining.find((f) => !f.isCompleted && f.nextFollowUpDate)?.nextFollowUpDate;
    const updatedCustomer: Customer = {
      ...cust,
      nextFollowUpDate: latestActiveReminder,
      followUps: remaining,
    };
    onSaveCustomer(updatedCustomer);
    if (followUpModalCustomer?.id === cust.id) {
      setFollowUpModalCustomer(updatedCustomer);
    }
    if (detailCustomer?.id === cust.id) {
      setDetailCustomer(updatedCustomer);
    }
  };

  const customersWithFollowUps = useMemo(() => {
    return customers
      .filter((c) => c.nextFollowUpDate || (c.followUps && c.followUps.length > 0))
      .filter((c) => {
        if (followUpFilter === 'due') {
          return !!c.nextFollowUpDate && c.nextFollowUpDate <= todayJalali;
        }
        if (followUpFilter === 'upcoming') {
          return !!c.nextFollowUpDate && c.nextFollowUpDate > todayJalali;
        }
        return true;
      })
      .sort((a, b) => (a.nextFollowUpDate || '9999').localeCompare(b.nextFollowUpDate || '9999'));
  }, [customers, followUpFilter, todayJalali]);

  const dueFollowUpsCount = useMemo(
    () => customers.filter((c) => c.nextFollowUpDate && c.nextFollowUpDate <= todayJalali).length,
    [customers, todayJalali]
  );

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="bg-white p-3 sm:p-4 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="flex items-center justify-between gap-3">
          {/* Title */}
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
            <span className="p-1.5 sm:p-2 rounded-xl bg-purple-50 text-purple-700 shrink-0">
              <Users className="w-4 h-4 sm:w-5 sm:h-5" />
            </span>
            <h2 className="text-sm sm:text-lg font-bold text-slate-800 truncate">
              مدیریت مشتریان و خریداران
            </h2>
          </div>

          {/* Single Compact Actions Dropdown Beside Title */}
          <div className="relative shrink-0" ref={actionsDropdownRef}>
            <button
              type="button"
              id="customers-actions-dropdown-btn"
              onClick={() => setIsActionsDropdownOpen(!isActionsDropdownOpen)}
              className="flex items-center gap-1.5 bg-purple-50 hover:bg-purple-100 active:scale-95 text-purple-900 border border-purple-200/90 px-3 py-2 rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer"
              title="عملیات و امکانات"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-purple-700" />
              <span>عملیات</span>
              <ChevronDown className={`w-3.5 h-3.5 text-purple-600 transition-transform duration-200 ${isActionsDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown Menu */}
            {isActionsDropdownOpen && (
              <div className="absolute left-0 top-full mt-1.5 w-56 sm:w-60 bg-white rounded-2xl border border-slate-200/90 shadow-xl z-50 p-1.5 space-y-1 animate-in fade-in zoom-in-95 duration-100">
                {/* 1. مشتری جدید */}
                <button
                  type="button"
                  id="add-customer-btn"
                  onClick={() => {
                    setIsActionsDropdownOpen(false);
                    handleOpenNew();
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-bold rounded-xl text-emerald-800 bg-emerald-50 hover:bg-emerald-100 transition-colors cursor-pointer text-right"
                >
                  <UserPlus className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>مشتری جدید</span>
                </button>

                <div className="my-1 border-t border-slate-100" />

                {/* 2. گزارش صورتحساب مشتریان */}
                <button
                  type="button"
                  id="open-customer-statements-report-btn"
                  onClick={() => {
                    setIsActionsDropdownOpen(false);
                    setIsStatementsReportOpen(true);
                  }}
                  title="مشاهده گزارش کلی بدهکاران، واریزی‌ها و صورتحساب همه مشتریان"
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-bold rounded-xl text-slate-700 hover:text-purple-900 hover:bg-purple-50 transition-colors cursor-pointer text-right"
                >
                  <ReceiptText className="w-4 h-4 text-purple-600 shrink-0" />
                  <span>گزارش صورتحساب مشتریان</span>
                </button>

                {/* 3. اکسپورت اسناد و حواله‌های شخص */}
                <button
                  type="button"
                  id="export-person-invoices-slips-btn"
                  onClick={() => {
                    setIsActionsDropdownOpen(false);
                    setExportModalCustomer(null);
                    setIsExportModalOpen(true);
                  }}
                  title="خروجی فاکتورها و حواله‌های خروج یک شخص با جزییات کامل اکسل"
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-bold rounded-xl text-slate-700 hover:text-purple-900 hover:bg-purple-50 transition-colors cursor-pointer text-right"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                  <span>اکسپورت اسناد و حواله‌ها</span>
                </button>

                <div className="my-1 border-t border-slate-100" />

                {/* 4. خروجی فایل اکسل مشتریان */}
                <button
                  type="button"
                  id="export-customers-excel-btn"
                  onClick={() => {
                    setIsActionsDropdownOpen(false);
                    exportCustomersToExcel(customers);
                  }}
                  title="خروجی فایل اکسل مشتریان"
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-bold rounded-xl text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer text-right"
                >
                  <Download className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  <span>خروجی اکسل مشتریان</span>
                </button>

                {/* 5. ورود مشتریان از فایل اکسل */}
                <button
                  type="button"
                  id="import-customers-excel-btn"
                  onClick={() => {
                    setIsActionsDropdownOpen(false);
                    setIsImportModalOpen(true);
                  }}
                  title="ورود مشتریان از فایل اکسل"
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-bold rounded-xl text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer text-right"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>ورود از اکسل</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Navigation Sub-Tabs: مشتریان | مانده حساب تامین‌کنندگان | یادداشت مذاکره و یادآور تماس */}
        <div className="mt-3 pt-3 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => setActiveSubSection('customers')}
            className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs transition-all cursor-pointer ${
              activeSubSection === 'customers'
                ? 'bg-purple-600 text-white font-black shadow-xs'
                : 'bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold border border-slate-200/80'
            }`}
          >
            <Users className="w-4 h-4 shrink-0" />
            <span>لیست مشتریان و خریداران</span>
            <span
              className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono ${
                activeSubSection === 'customers' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
              }`}
            >
              {toPersianDigits(customers.length)}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubSection('suppliers')}
            className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs transition-all cursor-pointer ${
              activeSubSection === 'suppliers'
                ? 'bg-indigo-600 text-white font-black shadow-xs'
                : 'bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold border border-slate-200/80'
            }`}
          >
            <Building2 className="w-4 h-4 shrink-0" />
            <span>مانده حساب تامین‌کنندگان</span>
            <span
              className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono ${
                activeSubSection === 'suppliers' ? 'bg-white/20 text-white' : 'bg-indigo-100 text-indigo-800'
              }`}
            >
              {toPersianDigits(suppliersList.length)}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubSection('followups')}
            className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs transition-all cursor-pointer ${
              activeSubSection === 'followups'
                ? 'bg-amber-600 text-white font-black shadow-xs'
                : 'bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold border border-slate-200/80'
            }`}
          >
            <Bell className="w-4 h-4 shrink-0" />
            <span>یادداشت مذاکره و یادآور تماس</span>
            {dueFollowUpsCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-mono font-black bg-rose-500 text-white">
                {toPersianDigits(dueFollowUpsCount)}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* =====================================================================
          SECTION B: DEDICATED SUPPLIERS BALANCE & LEDGER (مانده حساب تامین‌کنندگان)
          ===================================================================== */}
      {activeSubSection === 'suppliers' && (
        <div className="space-y-4">
          {/* 3 KPI Cards: چقدر خریده‌ایم، چقدر پرداخت کرده‌ایم، چقدر بدهکاریم */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-1">
              <div className="flex items-center justify-between text-xs text-slate-500 font-bold">
                <span>کل خرید کالا از تامین‌کنندگان</span>
                <Truck className="w-4 h-4 text-indigo-600" />
              </div>
              <div className="text-lg font-black font-mono text-slate-900">
                {formatPrice(suppliersTotals.totalPurchased, settings.currency)}
              </div>
              <div className="text-[11px] text-slate-400">
                مجموع ارزش فاکتورهای خرید ثبت‌شده از {toPersianDigits(suppliersList.length)} تامین‌کننده
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-emerald-200 shadow-xs space-y-1">
              <div className="flex items-center justify-between text-xs text-emerald-700 font-bold">
                <span>کل مبالغ پرداخت‌شده به تامین‌کنندگان</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-lg font-black font-mono text-emerald-700">
                {formatPrice(suppliersTotals.totalPaid, settings.currency)}
              </div>
              <div className="text-[11px] text-slate-400">
                مجموع تسویه‌ها و پرداخت‌های انجام‌شده به تامین‌کنندگان
              </div>
            </div>

            <div className="bg-rose-50/70 p-4 rounded-2xl border border-rose-200 shadow-xs space-y-1">
              <div className="flex items-center justify-between text-xs text-rose-800 font-bold">
                <span>مانده بدهی ما به تامین‌کنندگان (بستانکاران)</span>
                <Wallet className="w-4 h-4 text-rose-600" />
              </div>
              <div className="text-lg font-black font-mono text-rose-700">
                {formatPrice(suppliersTotals.remainingDebt, settings.currency)}
              </div>
              <div className="text-[11px] text-rose-600/80 font-medium">
                {suppliersTotals.creditorSuppliersCount > 0
                  ? `بدهکار به ${toPersianDigits(suppliersTotals.creditorSuppliersCount)} تامین‌کننده`
                  : 'تمامی حساب‌های تامین‌کنندگان تسویه کامل است'}
              </div>
            </div>
          </div>

          {/* Suppliers Table Card */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="p-3.5 border-b border-slate-200/80 bg-slate-50/70 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={supplierSearchQuery}
                  onChange={(e) => setSupplierSearchQuery(e.target.value)}
                  placeholder="جستجوی نام یا شماره تماس تامین‌کننده..."
                  className="w-full bg-white border border-slate-200 rounded-xl pr-9 pl-3 py-1.5 text-xs outline-none focus:border-indigo-500"
                />
              </div>
              <span className="text-[11px] text-slate-500 font-medium">
                لیست تفکیکی مانده حساب، خریدها و پرداختی‌های هر تامین‌کننده
              </span>
            </div>

            {suppliersList.length === 0 ? (
              <div className="text-center py-14 p-6 space-y-2 text-slate-400">
                <Building2 className="w-10 h-10 mx-auto text-slate-300" />
                <div className="text-sm font-bold text-slate-600">هنوز فاکتور خریدی از تامین‌کنندگان ثبت نشده است</div>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  با ثبت فاکتور خرید در بخش «فاکتور خرید و ورود کالا»، حساب هر تامین‌کننده (مجموع خرید، پرداختی و مانده بدهی شما) به صورت خودکار در این بخش ایجاد می‌شود.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-100/80 text-slate-700 border-b border-slate-200">
                      <th className="py-3 px-3 font-bold text-center w-10">#</th>
                      <th className="py-3 px-3 font-bold">نام تامین‌کننده / فروشنده</th>
                      <th className="py-3 px-3 font-bold text-center">تعداد فاکتور خرید</th>
                      <th className="py-3 px-3 font-bold text-left">کل خرید ما (جنس خریداری‌شده)</th>
                      <th className="py-3 px-3 font-bold text-left">کل پرداختی ما</th>
                      <th className="py-3 px-3 font-bold text-left">مانده بدهی ما به تامین‌کننده</th>
                      <th className="py-3 px-3 font-bold text-center">عملیات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {suppliersList.map((sup, idx) => (
                      <tr key={sup.key} className="hover:bg-indigo-50/30 transition-colors">
                        <td className="py-3 px-3 text-center font-mono text-slate-400 font-bold">
                          {toPersianDigits(idx + 1)}
                        </td>
                        <td className="py-3 px-3">
                          <div className="font-black text-slate-900 text-xs sm:text-sm">{sup.supplierName}</div>
                          <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                            {sup.supplierPhone && <span className="font-mono">{toPersianDigits(sup.supplierPhone)}</span>}
                            {sup.lastPurchaseDate && (
                              <span>آخرین خرید: {toPersianDigits(sup.lastPurchaseDate)}</span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-3 text-center font-mono font-bold text-slate-700">
                          {toPersianDigits(sup.invoices.length)} فاکتور
                        </td>
                        <td className="py-3 px-3 text-left font-mono font-bold text-slate-900">
                          {formatPrice(sup.totalPurchased, settings.currency)}
                        </td>
                        <td className="py-3 px-3 text-left font-mono font-bold text-emerald-700">
                          {formatPrice(sup.totalPaid, settings.currency)}
                        </td>
                        <td className="py-3 px-3 text-left whitespace-nowrap">
                          {sup.remainingDebt > 0 ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 font-mono font-black text-xs">
                              <span>بدهکاریم:</span>
                              <span>{formatPrice(sup.remainingDebt, settings.currency)}</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold text-[11px]">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>تسویه کامل</span>
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => setSelectedSupplierKey(sup.key)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 text-xs font-bold transition-colors cursor-pointer"
                          >
                            <ReceiptText className="w-3.5 h-3.5 text-indigo-600" />
                            <span>ریز حساب و ثبت پرداخت</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* =====================================================================
          SECTION C: CUSTOMER NEGOTIATION NOTES & CALL REMINDERS (یادداشت مذاکره و یادآور تماس)
          ===================================================================== */}
      {activeSubSection === 'followups' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="p-3.5 sm:p-4 border-b border-slate-200/80 bg-slate-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-xs sm:text-sm font-black text-slate-900 flex items-center gap-1.5">
                <Bell className="w-4 h-4 text-amber-600" />
                <span>مدیریت یادداشت‌های مذاکره و یادآوری تماس بعدی مشتریان</span>
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                ثبت خلاصه مذاکرات تلفنی یا حضوری به همراه تاریخ یادآوری تماس بعدی برای پیگیری فروش و وصول مطالبات
              </p>
            </div>

            <div className="flex items-center gap-1.5 bg-slate-200/60 p-1 rounded-xl border border-slate-200 text-xs self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setFollowUpFilter('all')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                  followUpFilter === 'all' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600'
                }`}
              >
                همه پیگیری‌ها
              </button>
              <button
                type="button"
                onClick={() => setFollowUpFilter('due')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1 ${
                  followUpFilter === 'due' ? 'bg-rose-600 text-white shadow-2xs' : 'text-slate-600'
                }`}
              >
                <span>موعد تماس (امروز و معوق)</span>
                {dueFollowUpsCount > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-rose-100 text-rose-800">
                    {toPersianDigits(dueFollowUpsCount)}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => setFollowUpFilter('upcoming')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                  followUpFilter === 'upcoming' ? 'bg-amber-600 text-white shadow-2xs' : 'text-slate-600'
                }`}
              >
                یادآوری‌های آینده
              </button>
            </div>
          </div>

          {customersWithFollowUps.length === 0 ? (
            <div className="text-center py-14 p-6 space-y-2 text-slate-400">
              <MessageSquarePlus className="w-10 h-10 mx-auto text-slate-300" />
              <div className="text-sm font-bold text-slate-600">هیچ یادداشت مذاکره یا یادآور تماسی در این بخش وجود ندارد</div>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                در لیست مشتریان بر روی دکمه «یادداشت مذاکره» کلیک کنید تا مذاکرات و تاریخ تماس بعدی را برای مشتری ثبت نمایید.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {customersWithFollowUps.map((cust) => {
                const isDue = !!cust.nextFollowUpDate && cust.nextFollowUpDate <= todayJalali;
                const latestNote = cust.followUps && cust.followUps.length > 0 ? cust.followUps[0] : null;
                return (
                  <div key={cust.id} className="p-4 hover:bg-amber-50/20 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1.5 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-black text-slate-900 text-sm">{cust.name}</span>
                        {cust.customerType === 'colleague' && (
                          <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] font-bold">
                            همکار / عمده
                          </span>
                        )}
                        {cust.phone && (
                          <a href={`tel:${cust.phone}`} className="font-mono text-xs text-emerald-700 font-bold hover:underline">
                            {toPersianDigits(cust.phone)}
                          </a>
                        )}
                        {cust.nextFollowUpDate && (
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[11px] font-bold border ${
                              isDue
                                ? 'bg-rose-100 text-rose-800 border-rose-300'
                                : 'bg-amber-50 text-amber-800 border-amber-200'
                            }`}
                          >
                            <Bell className="w-3 h-3" />
                            <span>
                              {isDue ? 'موعد تماس:' : 'یادآور تماس بعدی:'} {toPersianDigits(cust.nextFollowUpDate)}
                            </span>
                          </span>
                        )}
                        {(latestNote?.telegramReminderSentAt ||
                          (cust.nextFollowUpDate && cust.lastTelegramReminderForDate === cust.nextFollowUpDate)) ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-sky-50 text-sky-700 border border-sky-200 text-[10px] font-bold">
                            <Send className="w-2.5 h-2.5" />
                            <span>یادآور تلگرام ارسال شد ✓</span>
                          </span>
                        ) : cust.nextFollowUpDate ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-100 text-slate-600 border border-slate-200 text-[10px] font-medium">
                            <Send className="w-2.5 h-2.5 text-sky-600" />
                            <span>ارسال خودکار به تلگرام در موعد</span>
                          </span>
                        ) : null}
                      </div>

                      {latestNote && (
                        <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-2.5 text-xs text-slate-700">
                          <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                            <span>آخرین مذاکره ثبت‌شده ({toPersianDigits(latestNote.date)}):</span>
                            <span>ثبت توسط: {latestNote.createdBy || 'کاربر'}</span>
                          </div>
                          <p className="font-medium text-slate-800 leading-relaxed">{latestNote.note}</p>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-center flex-wrap">
                      <button
                        type="button"
                        disabled={sendingFollowUpTelegramId === (latestNote?.id || cust.id)}
                        onClick={() => handleManualSendFollowUpTelegram(cust, latestNote || undefined)}
                        className="px-2.5 py-1.5 rounded-xl bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 text-xs font-bold flex items-center gap-1 cursor-pointer disabled:opacity-50"
                        title="ارسال فوری پیام یادآوری تماس به تلگرام"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>
                          {sendingFollowUpTelegramId === (latestNote?.id || cust.id)
                            ? 'در حال ارسال...'
                            : 'ارسال به تلگرام'}
                        </span>
                      </button>
                      {cust.nextFollowUpDate && (
                        <button
                          type="button"
                          onClick={() => handleToggleCompleteFollowUp(cust)}
                          className="px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-bold flex items-center gap-1 cursor-pointer"
                          title="علامت‌گذاری تماس به عنوان انجام‌شده"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>تماس انجام شد</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleOpenFollowUpModal(cust)}
                        className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-2xs"
                      >
                        <MessageSquarePlus className="w-3.5 h-3.5" />
                        <span>مشاهده و ثبت مذاکره ({toPersianDigits((cust.followUps || []).length)})</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Customer List Card */}
      {activeSubSection === 'customers' && (
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        {/* Search, Sort, Filter & View Mode Toolbar (Decluttered & Mobile-Optimized) */}
        <div className="p-2.5 sm:p-3.5 border-b border-slate-200/80 bg-slate-50/70 space-y-2 sm:space-y-2.5">
          {/* Top Tier: Search, View Mode Toggle, and Sort */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 sm:gap-2.5">
            {/* Search Input */}
            <div className="relative flex-1 min-w-0">
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                id="customer-search-input"
                placeholder="جستجوی مشتری (نام، شماره، کد ملی)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white border border-slate-200/90 rounded-xl pr-9 pl-8 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none transition-all shadow-2xs"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-full hover:bg-slate-100 transition-colors cursor-pointer"
                  title="پاک کردن جستجو"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Right Controls: Sort & View Mode Switcher */}
            <div className="flex items-center justify-between sm:justify-start gap-2 shrink-0">
              {/* Sort Dropdown */}
              <div className="relative flex-1 sm:flex-initial sm:w-40 min-w-0">
                <select
                  id="customer-sort-select"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="w-full appearance-none bg-white border border-slate-200/90 rounded-xl pr-7 pl-6 py-1.5 text-xs font-semibold text-slate-700 focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none cursor-pointer shadow-2xs truncate"
                >
                  <option value="name-asc">نام (الفبا)</option>
                  <option value="debt-desc">بیشترین بدهی</option>
                  <option value="orders-desc">بیشترین سفارش</option>
                  <option value="newest">جدیدترین</option>
                </select>
                <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>

              {/* View Mode Toggle Switcher (Hidden on mobile) */}
              <div className="hidden sm:flex items-center bg-slate-200/60 p-0.5 rounded-xl border border-slate-200/80 text-xs shadow-2xs shrink-0">
                <button
                  type="button"
                  id="customers-view-table-btn"
                  onClick={() => handleToggleViewMode('table')}
                  className={`flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-lg font-medium text-xs transition-all cursor-pointer ${
                    viewMode === 'table'
                      ? 'bg-white text-purple-800 shadow-2xs font-bold'
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
                  className={`flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-lg font-medium text-xs transition-all cursor-pointer ${
                    viewMode === 'grid'
                      ? 'bg-white text-purple-800 shadow-2xs font-bold'
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

          {/* Bottom Tier: Streamlined Segmented Filter & Summary Count */}
          <div className="flex items-center justify-between gap-2 pt-1.5 sm:pt-2 border-t border-slate-200/70 overflow-hidden">
            {/* Unified Status Segmented Filter */}
            <div className="flex items-center bg-slate-200/60 p-0.5 rounded-xl border border-slate-200/80 text-xs shadow-2xs overflow-x-auto no-scrollbar scroll-smooth flex-1 sm:flex-initial">
              <button
                type="button"
                id="filter-cust-all"
                onClick={() => setStatusFilter('all')}
                className={`px-2 sm:px-2.5 py-1 rounded-lg text-xs transition-all cursor-pointer whitespace-nowrap font-medium ${
                  statusFilter === 'all'
                    ? 'bg-white text-slate-900 shadow-2xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                همه ({toPersianDigits(customers.length)})
              </button>

              <button
                type="button"
                id="filter-cust-debtors"
                onClick={() => setStatusFilter('debtors')}
                className={`px-2 sm:px-2.5 py-1 rounded-lg text-xs transition-all cursor-pointer flex items-center gap-1 whitespace-nowrap font-medium ${
                  statusFilter === 'debtors'
                    ? 'bg-rose-600 text-white shadow-2xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>بدهکاران</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                  statusFilter === 'debtors' ? 'bg-white/25 text-white' : 'bg-rose-100 text-rose-700'
                }`}>
                  {toPersianDigits(totalDebtorsCount)}
                </span>
              </button>

              <button
                type="button"
                id="filter-cust-creditors"
                onClick={() => setStatusFilter('creditors')}
                className={`px-2 sm:px-2.5 py-1 rounded-lg text-xs transition-all cursor-pointer flex items-center gap-1 whitespace-nowrap font-medium ${
                  statusFilter === 'creditors'
                    ? 'bg-blue-600 text-white shadow-2xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>بستانکاران</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                  statusFilter === 'creditors' ? 'bg-white/25 text-white' : 'bg-blue-100 text-blue-700'
                }`}>
                  {toPersianDigits(totalCreditorsCount)}
                </span>
              </button>

              <button
                type="button"
                id="filter-cust-settled"
                onClick={() => setStatusFilter('settled')}
                className={`px-2 sm:px-2.5 py-1 rounded-lg text-xs transition-all cursor-pointer flex items-center gap-1 whitespace-nowrap font-medium ${
                  statusFilter === 'settled'
                    ? 'bg-emerald-600 text-white shadow-2xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>تسویه‌شده</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                  statusFilter === 'settled' ? 'bg-white/25 text-white' : 'bg-emerald-100 text-emerald-700'
                }`}>
                  {toPersianDigits(totalSettledCount)}
                </span>
              </button>
            </div>

            {/* Total Counter */}
            <div className="text-[10px] sm:text-[11px] text-slate-500 font-medium shrink-0 whitespace-nowrap hidden sm:block">
              نمایش <strong className="text-slate-800 font-mono">{toPersianDigits(filteredCustomers.length)}</strong> از <strong className="text-slate-800 font-mono">{toPersianDigits(customers.length)}</strong>
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
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-bold text-slate-900 text-xs sm:text-sm group-hover:text-purple-800 transition-colors">
                                  {cust.name}
                                </span>
                                {cust.customerType === 'colleague' && (
                                  <span className="px-1.5 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] font-bold">
                                    همکار / عمده
                                  </span>
                                )}
                                {cust.nextFollowUpDate && (
                                  <span
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleOpenFollowUpModal(cust);
                                    }}
                                    className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold border cursor-pointer ${
                                      cust.nextFollowUpDate <= todayJalali
                                        ? 'bg-rose-50 text-rose-700 border-rose-200'
                                        : 'bg-amber-50 text-amber-800 border-amber-200'
                                    }`}
                                    title="یادآور تماس بعدی - کلیک برای مشاهده مذاکرات"
                                  >
                                    <Bell className="w-2.5 h-2.5" />
                                    <span>تماس: {toPersianDigits(cust.nextFollowUpDate)}</span>
                                  </span>
                                )}
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

                            {/* Follow-up & Negotiation Note Button */}
                            <button
                              type="button"
                              onClick={() => handleOpenFollowUpModal(cust)}
                              title="ثبت یادداشت مذاکره و تاریخ یادآوری تماس بعدی"
                              className={`flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-lg border transition-all cursor-pointer ${
                                cust.nextFollowUpDate
                                  ? 'bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-300'
                                  : 'bg-slate-50 hover:bg-amber-50 text-slate-700 hover:text-amber-800 border-slate-200'
                              }`}
                            >
                              <MessageSquarePlus className="w-3.5 h-3.5 text-amber-600" />
                              <span className="hidden xl:inline">مذاکره</span>
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
                                onClick={() => handleOpenTransaction(cust, 'deposit')}
                                title="ثبت واریزی به حساب مشتری"
                                className="flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 transition-all cursor-pointer"
                              >
                                <CreditCard className="w-3.5 h-3.5 text-emerald-600" />
                                <span className="hidden xl:inline">واریزی</span>
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

            {/* Mobile Single-Line Items View: فقط نام و موبایل در یک خط با کلیک جهت باز شدن جزئیات */}
            <div className="block sm:hidden divide-y divide-slate-100 bg-white">
              {filteredCustomers.map((cust, index) => (
                <div
                  key={cust.id}
                  onClick={() => setDetailCustomer(cust)}
                  className="flex items-center justify-between gap-3 px-3.5 py-3 hover:bg-purple-50/40 active:bg-slate-100 transition-colors cursor-pointer"
                >
                  {/* نام مشتری (با کلیک، جزئیات کامل مشتری باز می‌شود) */}
                  <div className="flex items-center gap-2 min-w-0 flex-1 group">
                    <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-500 group-hover:bg-purple-100 group-hover:text-purple-700 font-mono text-[10px] font-bold flex items-center justify-center shrink-0 transition-colors">
                      {toPersianDigits(index + 1)}
                    </span>
                    <span className="font-bold text-slate-800 text-xs group-hover:text-purple-700 transition-colors truncate">
                      {cust.name}
                    </span>
                  </div>

                  {/* شماره موبایل مشتری */}
                  <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
                    {cust.phone ? (
                      <a
                        href={`tel:${cust.phone}`}
                        className="font-mono text-xs font-semibold text-slate-600 hover:text-emerald-700 dir-ltr py-1 px-2 rounded-lg hover:bg-slate-100 active:bg-slate-200 transition-colors inline-block"
                        title="تماس با مشتری"
                      >
                        {toPersianDigits(cust.phone)}
                      </a>
                    ) : (
                      <span className="text-slate-300 font-mono text-xs px-2">---</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* ========================================================
             CARD / GRID VIEW (نمایش کارتی در صورت تمایل کاربر)
             ======================================================== */
          <div>
            {/* Desktop Grid View */}
            <div className="hidden sm:grid p-4 sm:p-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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

                      {/* Settle Debt / Deposit Button */}
                      {hasDebt && (
                        <button
                          type="button"
                          id={`settle-customer-debt-${cust.id}`}
                          onClick={() => handleOpenTransaction(cust, 'deposit')}
                          title="ثبت واریزی به حساب این مشتری"
                          className="flex items-center gap-1 text-xs font-bold px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-all cursor-pointer"
                        >
                          <CreditCard className="w-3.5 h-3.5" />
                          <span>ثبت واریزی</span>
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

            {/* Mobile Single-Line Items View */}
            <div className="block sm:hidden divide-y divide-slate-100 bg-white">
              {filteredCustomers.map((cust, index) => (
                <div
                  key={cust.id}
                  onClick={() => setDetailCustomer(cust)}
                  className="flex items-center justify-between gap-3 px-3.5 py-3 hover:bg-purple-50/40 active:bg-slate-100 transition-colors cursor-pointer"
                >
                  {/* نام مشتری (با کلیک، جزئیات کامل مشتری باز می‌شود) */}
                  <div className="flex items-center gap-2 min-w-0 flex-1 group">
                    <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-500 group-hover:bg-purple-100 group-hover:text-purple-700 font-mono text-[10px] font-bold flex items-center justify-center shrink-0 transition-colors">
                      {toPersianDigits(index + 1)}
                    </span>
                    <span className="font-bold text-slate-800 text-xs group-hover:text-purple-700 transition-colors truncate">
                      {cust.name}
                    </span>
                  </div>

                  {/* شماره موبایل مشتری */}
                  <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
                    {cust.phone ? (
                      <a
                        href={`tel:${cust.phone}`}
                        className="font-mono text-xs font-semibold text-slate-600 hover:text-emerald-700 dir-ltr py-1 px-2 rounded-lg hover:bg-slate-100 active:bg-slate-200 transition-colors inline-block"
                        title="تماس با مشتری"
                      >
                        {toPersianDigits(cust.phone)}
                      </a>
                    ) : (
                      <span className="text-slate-300 font-mono text-xs px-2">---</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      )}

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

                {/* Negotiation Notes & Call Reminder Section inside Customer Details Modal */}
                <div className="bg-amber-50/50 p-4 rounded-2xl border border-amber-200/80 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 font-bold text-amber-900 text-xs">
                      <Bell className="w-4 h-4 text-amber-600" />
                      <span>یادداشت‌های مذاکره و یادآور تماس بعدی:</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleOpenFollowUpModal(detailCustomer)}
                      className="px-2.5 py-1 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <MessageSquarePlus className="w-3.5 h-3.5" />
                      <span>ثبت مذاکره / یادآور جدید</span>
                    </button>
                  </div>

                  {detailCustomer.nextFollowUpDate && (
                    <div className="text-xs font-bold text-amber-800 bg-white px-3 py-1.5 rounded-xl border border-amber-200 flex items-center justify-between">
                      <span>تاریخ یادآوری تماس بعدی:</span>
                      <span className="font-mono font-black text-rose-700">{toPersianDigits(detailCustomer.nextFollowUpDate)}</span>
                    </div>
                  )}

                  {detailCustomer.followUps && detailCustomer.followUps.length > 0 ? (
                    <div className="space-y-1.5 max-h-36 overflow-y-auto">
                      {detailCustomer.followUps.slice(0, 3).map((fn) => (
                        <div key={fn.id} className="bg-white p-2.5 rounded-xl border border-amber-100 text-xs space-y-1">
                          <div className="flex items-center justify-between text-[10px] text-slate-400">
                            <span>تاریخ مذاکره: {toPersianDigits(fn.date)}</span>
                            {fn.nextFollowUpDate && <span>یادآور: {toPersianDigits(fn.nextFollowUpDate)}</span>}
                          </div>
                          <p className="text-slate-800 font-medium">{fn.note}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[11px] text-slate-400">هنوز یادداشت مذاکره‌ای برای این مشتری ثبت نشده است.</p>
                  )}
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

              {/* Footer Actions - بهینه‌سازی و خلوت‌سازی با منوی دراپ‌دان عملیات */}
              <div className="p-3 sm:p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-2.5 shrink-0">
                {/* Primary Action Button (سمت راست - صورتحساب مالی مشتری) */}
                <div className="flex-1 sm:flex-initial">
                  <button
                    type="button"
                    onClick={() => {
                      const target = detailCustomer;
                      setDetailCustomer(null);
                      setStatementCustomer(target);
                    }}
                    className="w-full sm:w-auto min-h-[40px] px-4 py-2 bg-purple-600 hover:bg-purple-700 active:scale-98 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md shadow-purple-200/70 cursor-pointer"
                  >
                    <ReceiptText className="w-4 h-4 shrink-0" />
                    <span>مشاهده صورتحساب مالی</span>
                  </button>
                </div>

                {/* Secondary Actions & Close (سمت چپ - منوی یکپارچه عملیات و دکمه بستن) */}
                <div className="flex items-center gap-2 shrink-0">
                  {/* Actions Dropdown */}
                  <div className="relative" ref={detailActionsDropdownRef}>
                    <button
                      type="button"
                      id="customer-details-actions-dropdown-btn"
                      onClick={() => setIsDetailActionsOpen((prev) => !prev)}
                      className={`min-h-[40px] px-3 sm:px-3.5 py-2 border rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer ${
                        isDetailActionsOpen
                          ? 'bg-slate-200 text-slate-900 border-slate-300'
                          : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300/80'
                      }`}
                      title="سایر عملیات مشتری"
                      aria-expanded={isDetailActionsOpen}
                    >
                      <SlidersHorizontal className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                      <span>عملیات</span>
                      {hasDebt && (
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" title="دارای بدهی" />
                      )}
                      <ChevronUp className={`w-3.5 h-3.5 text-slate-500 transition-transform duration-200 ${isDetailActionsOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {/* Dropup Menu (باز شدن به سمت بالا داخل مدال) */}
                    {isDetailActionsOpen && (
                      <div 
                        className="absolute bottom-full left-0 mb-2 w-56 sm:w-60 bg-white rounded-2xl border border-slate-200/90 shadow-2xl z-50 p-1.5 space-y-1 animate-in fade-in zoom-in-95 duration-100 text-right"
                        role="menu"
                      >
                        {/* New Invoice */}
                        {(!currentUser || currentUser.permissions.canCreateInvoice) && (
                          <button
                            type="button"
                            onClick={() => {
                              const target = detailCustomer;
                              setIsDetailActionsOpen(false);
                              setDetailCustomer(null);
                              onSelectCustomerForInvoice(target);
                            }}
                            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-bold rounded-xl text-emerald-800 bg-emerald-50/70 hover:bg-emerald-100 transition-colors cursor-pointer"
                            role="menuitem"
                          >
                            <Plus className="w-4 h-4 text-emerald-600 shrink-0" />
                            <span>صدور فاکتور جدید</span>
                          </button>
                        )}

                        {/* Register Deposit / Payment */}
                        <button
                          type="button"
                          onClick={() => {
                            const target = detailCustomer;
                            setIsDetailActionsOpen(false);
                            setDetailCustomer(null);
                            handleOpenTransaction(target, 'deposit');
                          }}
                          className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-bold rounded-xl transition-colors cursor-pointer ${
                            hasDebt 
                              ? 'text-emerald-800 bg-emerald-50/50 hover:bg-emerald-100' 
                              : 'text-slate-700 hover:bg-slate-100'
                          }`}
                          role="menuitem"
                        >
                          <CreditCard className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span>ثبت واریزی به حساب</span>
                          {hasDebt && (
                            <span className="mr-auto text-[10px] font-semibold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded-md">بدهکار</span>
                          )}
                        </button>

                        {/* Edit Customer Profile */}
                        <button
                          type="button"
                          onClick={() => {
                            const target = detailCustomer;
                            setIsDetailActionsOpen(false);
                            setDetailCustomer(null);
                            handleOpenEdit(target);
                          }}
                          className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-bold rounded-xl text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                          role="menuitem"
                        >
                          <Edit3 className="w-4 h-4 text-blue-600 shrink-0" />
                          <span>ویرایش مشخصات مشتری</span>
                        </button>

                        {/* Excel Export */}
                        <button
                          type="button"
                          onClick={() => {
                            const target = detailCustomer;
                            setIsDetailActionsOpen(false);
                            setDetailCustomer(null);
                            setExportModalCustomer(target);
                            setIsExportModalOpen(true);
                          }}
                          className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-bold rounded-xl text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                          role="menuitem"
                        >
                          <FileSpreadsheet className="w-4 h-4 text-purple-600 shrink-0" />
                          <span>خروجی اکسل و سوابق</span>
                        </button>

                        {/* Delete Customer */}
                        {(!currentUser || currentUser.role === 'admin' || currentUser.permissions.canManageCustomers) && (
                          <>
                            <div className="my-1 border-t border-slate-100" />
                            <button
                              type="button"
                              onClick={() => {
                                const target = detailCustomer;
                                setIsDetailActionsOpen(false);
                                setDetailCustomer(null);
                                setCustomerToDelete(target);
                              }}
                              className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-bold rounded-xl text-rose-700 hover:bg-rose-50 transition-colors cursor-pointer"
                              role="menuitem"
                            >
                              <Trash2 className="w-4 h-4 text-rose-600 shrink-0" />
                              <span>حذف مشتری</span>
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Close Modal Button */}
                  <button
                    type="button"
                    onClick={() => {
                      setIsDetailActionsOpen(false);
                      setDetailCustomer(null);
                    }}
                    className="min-h-[40px] px-3.5 sm:px-4 py-2 bg-slate-200/90 hover:bg-slate-300 active:scale-98 text-slate-700 rounded-xl font-bold text-xs transition-colors cursor-pointer"
                  >
                    بستن
                  </button>
                </div>
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
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  عنوان و جنسیت مشتری (جهت صدور فاکتور و نام‌گذاری استاندارد PDF)
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  {[
                    { id: '', label: 'تشخیص هوشمند' },
                    { id: 'آقای', label: 'آقای' },
                    { id: 'خانم', label: 'خانم' },
                    { id: 'شرکت', label: 'شرکت / حقوقی' },
                  ].map((p) => {
                    const isSelected = (editingCustomer.titlePrefix || '') === p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() =>
                          setEditingCustomer({
                            ...editingCustomer,
                            titlePrefix: p.id,
                            gender:
                              p.id === 'آقای'
                                ? 'male'
                                : p.id === 'خانم'
                                ? 'female'
                                : p.id === 'شرکت'
                                ? 'company'
                                : undefined,
                          })
                        }
                        className={`py-1.5 px-2 rounded-xl text-[11px] font-bold border transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-emerald-700 text-white border-emerald-700 shadow-2xs'
                            : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border-slate-200'
                        }`}
                      >
                        {p.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">نام کامل مشتری یا شرکت *</label>
                <input
                  type="text"
                  required
                  id="customer-modal-name"
                  value={editingCustomer.name}
                  onChange={(e) => setEditingCustomer({ ...editingCustomer, name: e.target.value })}
                  placeholder="مثال: علی رضایی یا شرکت امید"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  نوع مشتری و سطح قیمت‌گذاری پیش‌فرض در فاکتور
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingCustomer({ ...editingCustomer, customerType: 'regular' })}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      (editingCustomer.customerType || 'regular') === 'regular'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    مشتری عادی (نرخ پایه)
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingCustomer({ ...editingCustomer, customerType: 'colleague' })}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      editingCustomer.customerType === 'colleague'
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    همکار / عمده (نرخ همکار)
                  </button>
                </div>
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
                <label className="block text-xs font-medium text-slate-700 mb-1">تاریخ یادآوری تماس بعدی (اختیاری)</label>
                <JalaliDatePicker
                  value={editingCustomer.nextFollowUpDate || ''}
                  onChange={(d) => setEditingCustomer({ ...editingCustomer, nextFollowUpDate: d })}
                  placeholder="انتخاب تاریخ یادآوری تماس..."
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
      {isExportModalOpen && (
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
      )}

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
          onClose={() => {
            setStatementCustomer(null);
            setStatementInitialForm('none');
          }}
          customer={statementCustomer}
          invoices={invoices}
          transactions={transactions}
          settings={settings}
          currentUser={currentUser}
          initialFormType={statementInitialForm}
          onSaveTransaction={(txn) => {
            if (onSaveTransaction) {
              onSaveTransaction(txn);
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
          onEditInvoice={(inv) => {
            if (onEditInvoice) {
              setStatementCustomer(null);
              onEditInvoice(inv);
            }
          }}
          onDeleteInvoice={(invId) => {
            if (onDeleteInvoice) {
              onDeleteInvoice(invId);
            } else {
              StorageService.deleteInvoice(invId);
            }
          }}
          onUpdatePaymentStatus={onUpdatePaymentStatus}
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

      {/* SEPARATE TRANSACTION MODAL: REGISTER DEPOSIT OR REGISTER DEBT */}
      {transactionCustomer && (
        <CustomerTransactionModal
          isOpen={!!transactionCustomer}
          onClose={() => setTransactionCustomer(null)}
          customer={transactionCustomer}
          initialType={transactionInitialType}
          invoices={invoices}
          transactions={transactions}
          settings={settings}
          currentUser={currentUser}
          onSaveTransaction={(txn) => {
            if (onSaveTransaction) {
              onSaveTransaction(txn);
            } else {
              StorageService.addCustomerTransaction(txn);
            }
            setTransactionCustomer(null);
          }}
        />
      )}

      {/* MODAL: CUSTOMER NEGOTIATION NOTES & NEXT CALL REMINDER (ثبت یادداشت مذاکره و یادآور تماس بعدی) */}
      {followUpModalCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-lg w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden text-right">
            <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-400/30 flex items-center justify-center">
                  <MessageSquarePlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-sm sm:text-base">یادداشت مذاکره و یادآور تماس</h3>
                  <span className="text-[11px] text-slate-300">مشتری: {followUpModalCustomer.name}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setFollowUpModalCustomer(null)}
                className="text-slate-400 hover:text-white p-1.5 rounded-xl hover:bg-white/10 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs flex-1">
              <form onSubmit={handleAddFollowUpNote} className="bg-amber-50/50 border border-amber-200/80 rounded-2xl p-3.5 space-y-3">
                <div>
                  <label className="block font-bold text-slate-800 mb-1">
                    متن یادداشت مذاکره / توافقات انجام‌شده با مشتری *
                  </label>
                  <textarea
                    rows={3}
                    required
                    value={newFollowUpNote}
                    onChange={(e) => setNewFollowUpNote(e.target.value)}
                    placeholder="خلاصه صحبت‌ها، استعلام قیمت، شرایط تسویه یا سفارش بعدی مشتری..."
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-800 outline-none focus:border-amber-600 focus:ring-2 focus:ring-amber-500/20"
                  />
                </div>

                <div className="space-y-2">
                  <label className="block font-bold text-slate-800">
                    تاریخ یادآوری تماس بعدی (ارسال خودکار یادآور در تلگرام در تاریخ انتخابی)
                  </label>
                  <JalaliDatePicker
                    value={newFollowUpDate}
                    onChange={(d) => setNewFollowUpDate(d)}
                    placeholder="انتخاب تاریخ یادآوری تماس بعدی..."
                  />
                  {/* Quick Date Presets */}
                  <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                    <span className="text-[10px] text-slate-500 font-bold">انتخاب سریع:</span>
                    {[
                      { label: 'فردا', days: 1 },
                      { label: '۳ روز دیگر', days: 3 },
                      { label: 'هفته آینده (۷ روز)', days: 7 },
                      { label: '۲ هفته دیگر', days: 14 },
                      { label: 'ماه آینده', days: 30 },
                    ].map((preset) => {
                      const targetDate = addDaysToJalali(preset.days);
                      const isSelected = newFollowUpDate === targetDate;
                      return (
                        <button
                          key={preset.days}
                          type="button"
                          onClick={() => setNewFollowUpDate(targetDate)}
                          className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition-colors cursor-pointer ${
                            isSelected
                              ? 'bg-amber-600 text-white border-amber-600'
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-amber-50 hover:border-amber-300'
                          }`}
                        >
                          {preset.label}
                        </button>
                      );
                    })}
                    {newFollowUpDate && (
                      <button
                        type="button"
                        onClick={() => setNewFollowUpDate('')}
                        className="px-2 py-1 rounded-lg text-[10px] font-bold text-rose-600 hover:bg-rose-50 cursor-pointer"
                      >
                        بدون یادآور
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] text-sky-800 bg-sky-50/90 border border-sky-200/80 rounded-xl px-2.5 py-1.5">
                    <Send className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                    <span>
                      در زمان فرارسیدن تاریخ یادآوری (مثلاً هفته آینده)، پیام یادآوری جهت تماس با مشتری به صورت خودکار در تلگرام ارسال می‌شود.
                    </span>
                  </div>
                </div>

                {followUpTelegramStatus && (
                  <div
                    className={`p-2.5 rounded-xl border text-[11px] font-bold flex items-center justify-between gap-2 ${
                      followUpTelegramStatus.type === 'success'
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                        : followUpTelegramStatus.type === 'error'
                        ? 'bg-rose-50 border-rose-200 text-rose-800'
                        : 'bg-sky-50 border-sky-200 text-sky-800'
                    }`}
                  >
                    <span>{followUpTelegramStatus.message}</span>
                    <button
                      type="button"
                      onClick={() => setFollowUpTelegramStatus(null)}
                      className="text-slate-400 hover:text-slate-700"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                <div className="flex justify-end">
                  <button
                    type="submit"
                    className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-xs cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>ثبت یادداشت مذاکره و یادآور تلگرام</span>
                  </button>
                </div>
              </form>

              {/* History of Follow-Up Notes */}
              <div className="space-y-2">
                <div className="font-bold text-slate-800 flex items-center justify-between">
                  <span>سوابق مذاکرات قبلی ({toPersianDigits((followUpModalCustomer.followUps || []).length)} مورد)</span>
                  {followUpModalCustomer.nextFollowUpDate && (
                    <span className="text-[11px] font-mono text-amber-800 bg-amber-100 px-2 py-0.5 rounded-lg">
                      یادآور فعال: {toPersianDigits(followUpModalCustomer.nextFollowUpDate)}
                    </span>
                  )}
                </div>

                {(!followUpModalCustomer.followUps || followUpModalCustomer.followUps.length === 0) ? (
                  <div className="text-center py-6 bg-slate-50 rounded-2xl border border-slate-200 text-slate-400">
                    هنوز یادداشت مذاکره‌ای برای این مشتری ثبت نشده است.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {followUpModalCustomer.followUps.map((fn) => (
                      <div
                        key={fn.id}
                        className={`p-3 rounded-2xl border space-y-1.5 ${
                          fn.isCompleted
                            ? 'bg-slate-50 border-slate-200 opacity-75'
                            : 'bg-white border-slate-200 shadow-2xs'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500 flex-wrap">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-mono font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                              {toPersianDigits(fn.date)}
                            </span>
                            {fn.nextFollowUpDate && (
                              <span className="font-mono text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded font-bold">
                                تماس بعدی: {toPersianDigits(fn.nextFollowUpDate)}
                              </span>
                            )}
                            {fn.telegramReminderSentAt && (
                              <span className="text-[10px] font-bold text-sky-700 bg-sky-50 border border-sky-200 px-1.5 py-0.5 rounded flex items-center gap-1">
                                <Send className="w-2.5 h-2.5" />
                                <span>ارسال‌شده به تلگرام ✓</span>
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              disabled={sendingFollowUpTelegramId === fn.id}
                              onClick={() => handleManualSendFollowUpTelegram(followUpModalCustomer, fn)}
                              className="px-2 py-0.5 rounded-md text-[10px] font-bold border bg-sky-50 text-sky-700 border-sky-200 hover:bg-sky-100 flex items-center gap-1 cursor-pointer disabled:opacity-50"
                              title="ارسال این یادآور به تلگرام"
                            >
                              <Send className="w-2.5 h-2.5" />
                              <span>{sendingFollowUpTelegramId === fn.id ? '...' : 'تلگرام'}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleToggleCompleteFollowUp(followUpModalCustomer, fn.id)}
                              className={`px-2 py-0.5 rounded-md text-[10px] font-bold border cursor-pointer ${
                                fn.isCompleted
                                  ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                  : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-emerald-50'
                              }`}
                            >
                              {fn.isCompleted ? 'انجام شد ✓' : 'علامت انجام'}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteFollowUpNote(followUpModalCustomer, fn.id)}
                              className="p-1 text-slate-400 hover:text-rose-600 rounded cursor-pointer"
                              title="حذف یادداشت"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                        <p className="text-slate-800 font-medium leading-relaxed whitespace-pre-line">{fn.note}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: SUPPLIER LEDGER & PAYMENT SETTLEMENT (ریز گردش حساب و تسویه بدهی تامین‌کننده) */}
      {selectedSupplier && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden text-right">
            <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 flex items-center justify-center">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-sm sm:text-base">
                    صورتحساب و فاکتورهای خرید از: {selectedSupplier.supplierName}
                  </h3>
                  <span className="text-[11px] text-slate-300">
                    {selectedSupplier.supplierPhone
                      ? `شماره تماس: ${toPersianDigits(selectedSupplier.supplierPhone)}`
                      : 'ریز کل خریدها، پرداختی‌ها و مانده بدهی به تامین‌کننده'}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedSupplierKey(null);
                  setPayingPurchaseInvoice(null);
                }}
                className="text-slate-400 hover:text-white p-1.5 rounded-xl hover:bg-white/10 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs flex-1">
              {/* Supplier Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3">
                  <span className="text-[11px] text-slate-500 block mb-1">کل خرید ما از این تامین‌کننده:</span>
                  <span className="font-mono font-black text-sm text-slate-900">
                    {formatPrice(selectedSupplier.totalPurchased, settings.currency)}
                  </span>
                </div>
                <div className="bg-emerald-50/60 border border-emerald-200 rounded-2xl p-3">
                  <span className="text-[11px] text-emerald-700 block mb-1">کل پرداختی ما:</span>
                  <span className="font-mono font-black text-sm text-emerald-800">
                    {formatPrice(selectedSupplier.totalPaid, settings.currency)}
                  </span>
                </div>
                <div className="bg-rose-50/70 border border-rose-200 rounded-2xl p-3">
                  <span className="text-[11px] text-rose-700 block mb-1">مانده بدهی ما به تامین‌کننده:</span>
                  <span className="font-mono font-black text-sm text-rose-800">
                    {selectedSupplier.remainingDebt > 0
                      ? formatPrice(selectedSupplier.remainingDebt, settings.currency)
                      : 'تسویه کامل (۰)'}
                  </span>
                </div>
              </div>

              {/* Payment Adjustment Form for Selected Purchase Invoice */}
              {payingPurchaseInvoice && (
                <form
                  onSubmit={handleSaveSupplierPayment}
                  className="bg-indigo-50/70 border border-indigo-200 rounded-2xl p-3.5 space-y-3 animate-in fade-in"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-black text-indigo-950">
                      ثبت / اصلاح مبلغ پرداختی برای فاکتور خرید شماره {toPersianDigits(payingPurchaseInvoice.invoiceNumber)}
                    </span>
                    <button
                      type="button"
                      onClick={() => setPayingPurchaseInvoice(null)}
                      className="text-slate-400 hover:text-slate-700"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        مجموع مبلغ پرداخت‌شده بابت این فاکتور ({settings.currency}) — کل فاکتور:{' '}
                        {formatPrice(payingPurchaseInvoice.finalTotal, settings.currency)}
                      </label>
                      <NumericInput
                        min={0}
                        max={payingPurchaseInvoice.finalTotal}
                        value={supplierPaymentInput}
                        onChange={(num) => setSupplierPaymentInput(num)}
                        currency={settings.currency}
                        className="w-full bg-white border border-indigo-300 rounded-xl px-3 py-2 text-xs font-mono font-black text-slate-900"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setSupplierPaymentInput(payingPurchaseInvoice.finalTotal)}
                        className="px-3 py-2 rounded-xl bg-white border border-indigo-200 text-indigo-700 font-bold text-xs hover:bg-indigo-100 cursor-pointer"
                      >
                        تسویه کامل فاکتور
                      </button>
                      <button
                        type="submit"
                        className="flex-1 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs cursor-pointer"
                      >
                        ذخیره پرداخت
                      </button>
                    </div>
                  </div>
                </form>
              )}

              {/* Purchase Invoices List for this Supplier */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden">
                <table className="w-full text-right border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 border-b border-slate-200">
                      <th className="p-2.5 font-bold">شماره فاکتور خرید</th>
                      <th className="p-2.5 font-bold text-center">تاریخ</th>
                      <th className="p-2.5 font-bold">اقلام خریداری‌شده</th>
                      <th className="p-2.5 font-bold text-left">مبلغ کل</th>
                      <th className="p-2.5 font-bold text-left">پرداخت‌شده</th>
                      <th className="p-2.5 font-bold text-left">مانده بدهی</th>
                      <th className="p-2.5 font-bold text-center">تسویه / پرداخت</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedSupplier.invoices.map((pi) => {
                      const paid =
                        pi.paymentStatus === 'paid'
                          ? pi.finalTotal
                          : Math.min(pi.finalTotal, Math.max(0, Number(pi.paidAmount) || 0));
                      const rem = Math.max(0, pi.finalTotal - paid);
                      return (
                        <tr key={pi.id} className="hover:bg-slate-50">
                          <td className="p-2.5 font-mono font-bold text-slate-900">
                            {toPersianDigits(pi.invoiceNumber)}
                          </td>
                          <td className="p-2.5 text-center font-mono text-slate-600">
                            {toPersianDigits(pi.date)}
                          </td>
                          <td className="p-2.5 text-slate-600 max-w-xs truncate">
                            {(pi.items || []).map((it) => `${it.productName} (${toPersianDigits(it.quantity)})`).join('، ')}
                          </td>
                          <td className="p-2.5 text-left font-mono font-bold text-slate-900">
                            {formatPrice(pi.finalTotal, settings.currency)}
                          </td>
                          <td className="p-2.5 text-left font-mono font-bold text-emerald-700">
                            {formatPrice(paid, settings.currency)}
                          </td>
                          <td className="p-2.5 text-left font-mono font-black text-rose-700">
                            {rem > 0 ? formatPrice(rem, settings.currency) : '۰ (تسویه)'}
                          </td>
                          <td className="p-2.5 text-center">
                            <button
                              type="button"
                              onClick={() => {
                                setPayingPurchaseInvoice(pi);
                                setSupplierPaymentInput(paid);
                              }}
                              className="px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-bold text-[11px] cursor-pointer"
                            >
                              ثبت پرداخت
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
