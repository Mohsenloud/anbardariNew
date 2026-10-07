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
  Filter,
  FileDown,
  Loader2,
  ShoppingBag,
  Send,
  Pencil,
  Coins
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
import { exportElementToPdf } from '../utils/pdfHelper';
import { CustomerTransactionModal } from './CustomerTransactionModal';
import { NumericInput } from './NumericInput';
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
  if (!isOpen || !customer) return null;

  // Active sub-modal for registering deposit or debt
  const [activeTxnModalType, setActiveTxnModalType] = useState<'deposit' | 'debt' | null>(
    initialFormType && initialFormType !== 'none' ? initialFormType : null
  );
  const [filterType, setFilterType] = useState<'all' | 'debt' | 'deposit'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState<'all' | '30days' | 'this_year'>('all');
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

  // Open separate transaction modal
  const handleOpenTransactionModal = (type: 'deposit' | 'debt') => {
    setTransactionToEdit(null);
    setActiveTxnModalType(type);
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
      setActiveTxnModalType(initialFormType);
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
    return StorageService.buildCustomerLedger(customer, activeInvoices, transactions);
  }, [customer, activeInvoices, transactions, ledgerVersion]);

  // Unpaid invoices for this customer
  const unpaidInvoices = useMemo(() => {
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

  // Export to PDF
  const handleExportPdf = async () => {
    if (isExportingPdf) return;
    try {
      setIsExportingPdf(true);
      const safeCustomerName = customer.name.replace(/[/\\:*?"<>|]/g, '_');
      const safeDate = getCurrentJalaliDate().replace(/\//g, '-');
      const filename = `صورتحساب_مالی_${safeCustomerName}_${safeDate}.pdf`;

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
        alert(result.error || 'خطا در صدور فایل PDF صورتحساب');
      }
    } catch (err: any) {
      console.error('PDF export error:', err);
      alert('خطا در تولید فایل PDF صورتحساب');
    } finally {
      setIsExportingPdf(false);
    }
  };

  // Send Statement Report to Telegram
  const [isSendingTelegram, setIsSendingTelegram] = useState(false);
  const handleSendTelegramStatement = async () => {
    if (!settings?.telegramBotEnabled) {
      alert('ربات تلگرام در تنظیمات سیستم فعال نیست.');
      return;
    }
    const botToken = settings.telegramBotToken?.trim();
    const primaryChatId = (settings.telegramChatId || '').trim();
    const customerChatId = (customer.telegramChatId || '').trim();
    const targetChatId = (customerChatId && settings.telegramAutoSendCustomerDirect !== false)
      ? customerChatId
      : primaryChatId;

    if (!botToken || !targetChatId) {
      alert('توکن ربات یا شناسه چت تلگرام در تنظیمات ثبت نشده است.');
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
        alert(res.error || 'خطا در ارسال به تلگرام');
      }
    } catch (err: any) {
      alert('خطا در ارسال: ' + (err?.message || ''));
    } finally {
      setIsSendingTelegram(false);
    }
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
                className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 active:scale-95 text-white px-3 sm:px-4 py-2 rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer ${
                  fullLedger.netBalance < 0
                    ? 'bg-blue-600 hover:bg-blue-700'
                    : 'bg-rose-600 hover:bg-rose-700'
                }`}
              >
                <Plus className="w-3.5 h-3.5 shrink-0" />
                <span>{fullLedger.netBalance < 0 ? 'پرداخت وجه به طرف‌حساب' : 'ثبت بدهی'}</span>
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

              {/* Export to PDF */}
              <button
                type="button"
                id="export-statement-pdf-btn"
                onClick={handleExportPdf}
                disabled={isExportingPdf}
                className="p-2 sm:px-3 sm:py-1.5 flex items-center gap-1 bg-rose-50 hover:bg-rose-100 active:scale-95 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition-all cursor-pointer disabled:opacity-60"
                title="دریافت فایل PDF رسمی صورتحساب"
              >
                {isExportingPdf ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-600" />
                ) : (
                  <FileDown className="w-3.5 h-3.5 text-rose-600" />
                )}
                <span className="hidden sm:inline">{isExportingPdf ? 'در حال صدور...' : 'PDF'}</span>
              </button>

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

              {/* Send to Telegram */}
              {settings?.telegramBotEnabled && (
                <button
                  type="button"
                  id="send-statement-telegram-btn"
                  onClick={handleSendTelegramStatement}
                  disabled={isSendingTelegram}
                  className="p-2 sm:px-3 sm:py-1.5 flex items-center gap-1 bg-sky-50 hover:bg-sky-100 active:scale-95 text-sky-700 border border-sky-300 rounded-xl text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
                  title="ارسال خلاصه صورتحساب به تلگرام"
                >
                  {isSendingTelegram ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-[#229ED9]" />
                  ) : (
                    <Send className="w-3.5 h-3.5 text-[#229ED9]" />
                  )}
                  <span className="hidden sm:inline">تلگرام</span>
                </button>
              )}
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

            {/* Show/Hide Suppliers Toggle */}
            <button
              type="button"
              onClick={() => setShowSuppliers(!showSuppliers)}
              className={`px-2.5 py-1.5 text-xs font-bold rounded-xl border flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
                showSuppliers
                  ? 'bg-amber-50 text-amber-900 border-amber-300 shadow-2xs'
                  : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
              }`}
              title="نمایش یا عدم نمایش نام شخصی تامین‌کننده و فروشنده کالا در صورتحساب"
            >
              <Building2 className={`w-3.5 h-3.5 ${showSuppliers ? 'text-amber-600' : 'text-slate-400'}`} />
              <span className="hidden sm:inline">نام تامین‌کننده:</span>
              <span>{showSuppliers ? 'نمایش' : 'مخفی'}</span>
            </button>
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
                        {showSuppliers && entry.supplierNames && entry.supplierNames.length > 0 && (
                          <div className="mt-1 flex items-center gap-1 flex-wrap">
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-900 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-md">
                              <Building2 className="w-3 h-3 text-amber-600" />
                              <span>تامین‌کننده / فروشنده کالا: {entry.supplierNames.join('، ')}</span>
                            </span>
                          </div>
                        )}
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

                      {/* Action buttons (View Invoice / Edit / Delete) */}
                      {(entry.rawInvoice || (isManualTxn && entry.rawTransaction)) && (
                        <div className="flex items-center justify-end gap-1.5 mt-2 pt-2 border-t border-slate-100 flex-wrap">
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
                      <th className="py-3 px-2 w-28 text-center">عملیات</th>
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
                                {entry.documentTypeLabel}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 font-mono text-slate-800 text-[11px] whitespace-nowrap font-medium">
                              {toPersianDigits(entry.documentNumber)}
                            </td>
                            <td className="py-2.5 px-3 text-slate-700 leading-relaxed">
                              <div>{entry.description}</div>
                              {showSuppliers && entry.supplierNames && entry.supplierNames.length > 0 && (
                                <div className="mt-1 flex items-center gap-1 flex-wrap">
                                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-900 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-md">
                                    <Building2 className="w-3 h-3 text-amber-600 shrink-0" />
                                    <span>تامین‌کننده: {entry.supplierNames.join('، ')}</span>
                                  </span>
                                </div>
                              )}
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
                : `${numberToPersianWords(Math.abs(fullLedger.netBalance))} ${settings.currency} ${fullLedger.netBalance > 0 ? 'بدهکار' : 'طلبکار (بستانکار)'}`}
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
                  <td className="py-1.5 px-2 border-l border-slate-200">
                    <div>{item.description}</div>
                    {showSuppliers && item.supplierNames && item.supplierNames.length > 0 && (
                      <div className="text-[9.5px] text-amber-800 font-medium mt-0.5">
                        تامین‌کننده / فروشنده: {item.supplierNames.join('، ')}
                      </div>
                    )}
                  </td>
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
            padding: '24px 20px',
            fontFamily: "'Vazirmatn', -apple-system, BlinkMacSystemFont, sans-serif",
            color: '#0f172a',
            boxSizing: 'border-box',
          }}
        >
          {/* Official Report Table with Persistent Repeating Header */}
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10.5px', direction: 'rtl' }}>
            <thead data-pdf-thead="true">
              {/* 1. Official Report Document Header inside thead (Preserved on ALL pages in PDF export) */}
              <tr className="pdf-doc-header-row" style={{ backgroundColor: '#ffffff', color: '#0f172a' }}>
                <th
                  colSpan={8}
                  style={{
                    padding: '0 0 14px 0',
                    border: 'none',
                    fontWeight: 'normal',
                    textAlign: 'right',
                  }}
                >
                  {/* Top Bar: Company Details & Statement Metadata */}
                  <div style={{ borderBottom: '2px solid #0f172a', paddingBottom: '12px', marginBottom: '14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '18px', fontWeight: '900', color: '#0f172a' }}>
                          {settings.storeName || 'سیستم صدور فاکتور و حسابداری'}
                        </div>
                        {settings.tagline && (
                          <div style={{ fontSize: '11px', color: '#475569', marginTop: '3px' }}>
                            {settings.tagline}
                          </div>
                        )}
                        <div style={{ fontSize: '10px', color: '#64748b', marginTop: '3px' }}>
                          نشانی: {settings.address || '—'} {settings.phone || settings.mobile ? ` | تلفن: ${toPersianDigits(settings.phone || settings.mobile || '')}` : ''}
                        </div>
                      </div>

                      <div style={{ textAlign: 'left', fontFamily: 'monospace', fontSize: '11px', lineHeight: '1.6' }}>
                        <div style={{ fontSize: '15px', fontWeight: 'bold', color: '#0f172a', fontFamily: "'Vazirmatn', sans-serif" }}>
                          صورتحساب رسمی طرف‌حساب
                        </div>
                        <div style={{ color: '#475569' }}>
                          تاریخ صدور: {toPersianDigits(getCurrentJalaliDate())}
                        </div>
                        <div style={{ color: '#475569' }}>
                          کد مشتری: #{toPersianDigits(customer.id.substring(0, 8))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Customer Information Card */}
                  <div
                    style={{
                      border: '1px solid #cbd5e1',
                      borderRadius: '10px',
                      padding: '10px 14px',
                      backgroundColor: '#f8fafc',
                      marginBottom: '14px',
                    }}
                  >
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(2, 1fr)',
                        gap: '6px 20px',
                        fontSize: '11px',
                        lineHeight: '1.6',
                        color: '#1e293b',
                      }}
                    >
                      <div>
                        <span style={{ color: '#64748b' }}>نام طرف‌حساب: </span>
                        <strong>{customer.name}</strong>
                      </div>
                      <div>
                        <span style={{ color: '#64748b' }}>شماره تماس: </span>
                        <strong style={{ fontFamily: 'monospace' }}>
                          {customer.phone ? toPersianDigits(customer.phone) : '—'}
                        </strong>
                      </div>
                      <div>
                        <span style={{ color: '#64748b' }}>کد ملی / شناسه اقتصادی: </span>
                        <strong style={{ fontFamily: 'monospace' }}>
                          {customer.nationalId ? toPersianDigits(customer.nationalId) : '—'}
                        </strong>
                      </div>
                      <div>
                        <span style={{ color: '#64748b' }}>نشانی: </span>
                        <span>{customer.address || '—'}</span>
                      </div>
                    </div>
                  </div>
                </th>
              </tr>

              {/* Table Column Headers */}
              <tr style={{ backgroundColor: '#f1f5f9', color: '#0f172a', fontWeight: 'bold' }}>
                <th style={{ padding: '7px 4px', border: '1px solid #cbd5e1', textAlign: 'center', width: '32px' }}>#</th>
                <th style={{ padding: '7px 6px', border: '1px solid #cbd5e1', textAlign: 'right', width: '75px' }}>تاریخ</th>
                <th style={{ padding: '7px 6px', border: '1px solid #cbd5e1', textAlign: 'right', width: '90px' }}>نوع سند</th>
                <th style={{ padding: '7px 6px', border: '1px solid #cbd5e1', textAlign: 'right', width: '85px' }}>شماره سند/پیگیری</th>
                <th style={{ padding: '7px 8px', border: '1px solid #cbd5e1', textAlign: 'right' }}>شرح تراکنش</th>
                <th style={{ padding: '7px 6px', border: '1px solid #cbd5e1', textAlign: 'right', width: '90px', color: '#b91c1c' }}>بدهکار ({settings.currency})</th>
                <th style={{ padding: '7px 6px', border: '1px solid #cbd5e1', textAlign: 'right', width: '90px', color: '#047857' }}>بستانکار ({settings.currency})</th>
                <th style={{ padding: '7px 6px', border: '1px solid #cbd5e1', textAlign: 'right', width: '100px' }}>مانده جاری</th>
              </tr>
            </thead>

            <tbody>
              {fullLedger.entries.map((item, idx) => (
                <tr
                  key={`pdf-${item.id}`}
                  style={{
                    backgroundColor: idx % 2 === 1 ? '#f8fafc' : '#ffffff',
                  }}
                >
                  <td style={{ padding: '5px 4px', border: '1px solid #cbd5e1', textAlign: 'center', fontFamily: 'monospace', color: '#64748b' }}>
                    {toPersianDigits(idx + 1)}
                  </td>
                  <td style={{ padding: '5px 6px', border: '1px solid #cbd5e1', fontFamily: 'monospace', fontWeight: 'bold' }}>
                    {toPersianDigits(item.date)}
                  </td>
                  <td style={{ padding: '5px 6px', border: '1px solid #cbd5e1' }}>
                    {item.documentTypeLabel}
                  </td>
                  <td style={{ padding: '5px 6px', border: '1px solid #cbd5e1', fontFamily: 'monospace' }}>
                    {toPersianDigits(item.documentNumber)}
                  </td>
                  <td style={{ padding: '5px 8px', border: '1px solid #cbd5e1', lineHeight: '1.4' }}>
                    <div>{item.description}</div>
                    {showSuppliers && item.supplierNames && item.supplierNames.length > 0 && (
                      <div style={{ color: '#b45309', fontSize: '9px', marginTop: '2px', fontWeight: 'bold' }}>
                        تامین‌کننده / فروشنده کالا: {item.supplierNames.join('، ')}
                      </div>
                    )}
                    {item.trackingNumber && (
                      <span style={{ display: 'block', fontSize: '9.5px', color: '#64748b', fontFamily: 'monospace' }}>
                        پیگیری: {toPersianDigits(item.trackingNumber)}
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '5px 6px', border: '1px solid #cbd5e1', fontFamily: 'monospace', fontWeight: 'bold', color: '#b91c1c' }}>
                    {item.debit > 0 ? toPersianDigits(item.debit.toLocaleString('en-US')) : '—'}
                  </td>
                  <td style={{ padding: '5px 6px', border: '1px solid #cbd5e1', fontFamily: 'monospace', fontWeight: 'bold', color: '#047857' }}>
                    {item.credit > 0 ? toPersianDigits(item.credit.toLocaleString('en-US')) : '—'}
                  </td>
                  <td style={{ padding: '5px 6px', border: '1px solid #cbd5e1', fontFamily: 'monospace', fontWeight: 'bold' }}>
                    {toPersianDigits(Math.abs(item.balance).toLocaleString('en-US'))} ({item.balance > 0 ? 'بدهکار' : item.balance < 0 ? 'بستانکار' : 'تسویه'})
                  </td>
                </tr>
              ))}
            </tbody>

            <tfoot>
              {/* Grand Totals */}
              <tr style={{ backgroundColor: '#f1f5f9', fontWeight: 'bold', borderTop: '2px solid #64748b', color: '#0f172a' }}>
                <td colSpan={5} style={{ padding: '7px 10px', border: '1px solid #cbd5e1', textAlign: 'left', fontWeight: 'bold' }}>
                  مجموع گردش و مانده نهایی ({settings.currency}):
                </td>
                <td style={{ padding: '7px 6px', border: '1px solid #cbd5e1', fontFamily: 'monospace', fontWeight: '900', color: '#b91c1c' }}>
                  {toPersianDigits(fullLedger.totalDebit.toLocaleString('en-US'))}
                </td>
                <td style={{ padding: '7px 6px', border: '1px solid #cbd5e1', fontFamily: 'monospace', fontWeight: '900', color: '#047857' }}>
                  {toPersianDigits(fullLedger.totalCredit.toLocaleString('en-US'))}
                </td>
                <td style={{ padding: '7px 6px', border: '1px solid #cbd5e1', fontFamily: 'monospace', fontWeight: '900' }}>
                  {toPersianDigits(Math.abs(fullLedger.netBalance).toLocaleString('en-US'))} ({fullLedger.netBalance > 0 ? 'بدهکار' : fullLedger.netBalance < 0 ? 'بستانکار' : 'تسویه'})
                </td>
              </tr>
            </tfoot>
          </table>

          {/* Bottom Statement Summary & Signatures */}
          <div
            style={{
              border: '1px solid #cbd5e1',
              borderRadius: '10px',
              padding: '10px 14px',
              backgroundColor: '#f8fafc',
              marginTop: '14px',
              marginBottom: '16px',
              fontSize: '11px',
              lineHeight: '1.6',
            }}
          >
            <div>
              <strong>مانده نهایی حساب به حروف: </strong>
              <span style={{ fontWeight: 'bold', color: fullLedger.netBalance > 0 ? '#b91c1c' : fullLedger.netBalance < 0 ? '#1d4ed8' : '#047857' }}>
                {fullLedger.netBalance === 0
                  ? 'حساب کاملاً تسویه و بی‌حساب است.'
                  : `${numberToPersianWords(Math.abs(fullLedger.netBalance))} ${settings.currency} (${fullLedger.netBalance > 0 ? 'بدهکار' : 'بستانکار'})`}
              </span>
            </div>
            {settings.invoiceFooterText && (
              <div style={{ color: '#64748b', fontSize: '10px', marginTop: '4px' }}>
                {settings.invoiceFooterText}
              </div>
            )}
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '28px',
              textAlign: 'center',
              fontSize: '11px',
              marginTop: '20px',
              paddingTop: '6px',
            }}
          >
            <div style={{ borderTop: '1px dashed #94a3b8', paddingTop: '8px' }}>
              <span style={{ fontWeight: 'bold', color: '#334155' }}>مهر و امضای امور مالی / صادرکننده</span>
            </div>
            <div style={{ borderTop: '1px dashed #94a3b8', paddingTop: '8px' }}>
              <span style={{ fontWeight: 'bold', color: '#334155' }}>امضا و تایید مانده حساب توسط طرف‌حساب</span>
            </div>
          </div>
        </div>
      </div>

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
