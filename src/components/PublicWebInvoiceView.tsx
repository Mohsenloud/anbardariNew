import React, { useState, useEffect, useMemo } from 'react';
import { 
  Invoice, 
  StoreSettings, 
  InvoiceShareLink,
  PublicCustomerDeposit,
  PublicCustomerRemittance,
  PublicCustomerLedger,
  PublicCustomerLedgerEntry
} from '../types';
import { formatPrice, toPersianDigits, numberToPersianWords, getCurrentJalaliDate, cleanInvoiceNotes } from '../utils/jalali';
import { StorageService } from '../utils/storage';
import { printElementDirectly, generatePdfBlob, getInvoicePdfFilename, exportElementToPdf } from '../utils/pdfHelper';
import { 
  Receipt, 
  Printer, 
  Download, 
  Share2, 
  Phone, 
  MapPin, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Lock, 
  ShieldAlert, 
  Building2, 
  User, 
  Calendar, 
  CreditCard, 
  Copy, 
  ShieldCheck, 
  RefreshCw, 
  FileText, 
  BadgeCheck, 
  Truck, 
  Wallet, 
  DollarSign, 
  Layers, 
  Search, 
  FileCheck, 
  Eye, 
  ArrowUpRight, 
  ArrowDownLeft,
  CheckCheck, 
  Inbox, 
  ChevronLeft,
  X,
  FileSpreadsheet,
  Filter,
  LayoutList,
  LayoutGrid,
  ReceiptText,
  ShoppingBag,
  Sparkles,
  ArrowUpDown
} from 'lucide-react';

interface PublicWebInvoiceViewProps {
  token: string;
  onBackToApp?: () => void;
}

type CustomerPortalTab = 'current' | 'invoices' | 'deposits' | 'remittances' | 'ledger';

export const PublicWebInvoiceView: React.FC<PublicWebInvoiceViewProps> = ({ token }) => {
  const [loading, setLoading] = useState(true);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [settings, setSettings] = useState<StoreSettings | null>(null);
  const [shareLink, setShareLink] = useState<InvoiceShareLink | null>(null);
  const [customerInvoices, setCustomerInvoices] = useState<Invoice[]>([]);
  const [deposits, setDeposits] = useState<PublicCustomerDeposit[]>([]);
  const [remittances, setRemittances] = useState<PublicCustomerRemittance[]>([]);
  const [customerLedger, setCustomerLedger] = useState<PublicCustomerLedger | null>(null);

  const [activeTab, setActiveTab] = useState<CustomerPortalTab>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get('tab');
      if (tabParam === 'ledger' || tabParam === 'statement') return 'ledger';
      if (tabParam === 'invoices') return 'invoices';
      if (tabParam === 'deposits') return 'deposits';
      if (tabParam === 'remittances') return 'remittances';
    }
    return 'current';
  });
  const [pinRequired, setPinRequired] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [pinLoading, setPinLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [storeMeta, setStoreMeta] = useState<{ storeName?: string; storeLogo?: string; invoiceNumber?: string }>({});
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Filters for Invoices Tab
  const [searchInvoices, setSearchInvoices] = useState('');
  const [filterInvoiceStatus, setFilterInvoiceStatus] = useState<'all' | 'paid' | 'unpaid' | 'partial' | 'proforma'>('all');
  const [selectedRemittanceModal, setSelectedRemittanceModal] = useState<PublicCustomerRemittance | null>(null);

  // Filters & Search for Customer Statement (صورتحساب مشتری)
  const [statementSearch, setStatementSearch] = useState('');
  const [statementTypeFilter, setStatementTypeFilter] = useState<'all' | 'debit' | 'credit' | 'invoice' | 'deposit'>('all');
  const [statementPaymentFilter, setStatementPaymentFilter] = useState<'all' | 'cash' | 'transfer' | 'pos' | 'cheque'>('all');
  const [statementDateFilter, setStatementDateFilter] = useState<'all' | 'this_month' | '3months' | 'this_year' | 'custom'>('all');
  const [statementDateFrom, setStatementDateFrom] = useState('');
  const [statementDateTo, setStatementDateTo] = useState('');
  const [statementSortOrder, setStatementSortOrder] = useState<'asc' | 'desc'>('asc');
  const [statementViewMode, setStatementViewMode] = useState<'table' | 'cards'>('table');

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  };

  const loadInvoice = async (pin?: string) => {
    try {
      if (pin) {
        setPinLoading(true);
        setPinError('');
      } else {
        setLoading(true);
        setErrorMessage(null);
      }

      const res = await StorageService.fetchPublicInvoice(token, pin);

      if (res.success && res.invoice) {
        setInvoice(res.invoice);
        setSelectedInvoice(res.invoice);
        setSettings(res.settings || null);
        setShareLink(res.shareLink || null);
        const isCustomerPortalOnly = String(res.invoice.id || '').startsWith('cust-portal-');
        const loadedInvoices = res.customerInvoices || (isCustomerPortalOnly ? [] : [res.invoice]);
        setCustomerInvoices(loadedInvoices);
        setDeposits(res.deposits || []);
        setRemittances(res.remittances || []);
        setCustomerLedger(res.customerLedger || null);
        setPinRequired(false);
        if (isCustomerPortalOnly && loadedInvoices.length === 0) {
          setActiveTab('ledger');
        }
      } else if (res.pinRequired) {
        setPinRequired(true);
        setStoreMeta({
          storeName: res.storeName,
          storeLogo: res.storeLogo,
          invoiceNumber: res.invoiceNumber,
        });
        if (pin) {
          setPinError('پین‌کد وارد شده صحیح نمی‌باشد. لطفاً مجدداً بررسی نمایید.');
        }
      } else {
        setErrorMessage(res.message || 'فاکتور مورد نظر یافت نشد یا مهلت مشاهده آن به پایان رسیده است.');
      }
    } catch {
      setErrorMessage('خطا در برقراری ارتباط با سرور فاکتور. لطفاً اتصال اینترنت خود را بررسی نمایید.');
    } finally {
      setLoading(false);
      setPinLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      loadInvoice();
    }
  }, [token]);

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pinInput.trim()) {
      setPinError('لطفاً پین‌کد امنیتی را وارد نمایید.');
      return;
    }
    loadInvoice(pinInput.trim());
  };

  const displayedInvoice = selectedInvoice || invoice;
  const showCustomerStatement = shareLink?.includeCustomerStatement !== false;

  // Build or use complete chronological Customer Statement entries
  const fullStatementEntries = useMemo<PublicCustomerLedgerEntry[]>(() => {
    if (!showCustomerStatement) return [];
    if (customerLedger?.entries && customerLedger.entries.length > 0) {
      return customerLedger.entries;
    }

    // Fallback synthesis from customerInvoices and deposits if server didn't send entries
    const paymentMethodLabels: Record<string, string> = {
      cash: 'نقدی',
      transfer: 'واریز به حساب / کارت به کارت',
      pos: 'کارتخوان (POS)',
      cheque: 'چک بانکی',
      card: 'کارت به کارت',
      credit: 'نسیه / اعتباری',
      other: 'سایر',
    };

    const raw: Omit<PublicCustomerLedgerEntry, 'balance' | 'balanceStatus'>[] = [];
    const nonProformas = customerInvoices.filter((inv) => !inv.isProforma);

    nonProformas.forEach((inv) => {
      const itemsSummary = (inv.items || [])
        .map((it) => `${it.productName} (${it.quantity} ${it.unit || 'عدد'})`)
        .join(' ، ');
      raw.push({
        id: `inv-deb-${inv.id}`,
        date: inv.date || '',
        documentNumber: String(inv.invoiceNumber || ''),
        documentType: 'invoice',
        documentTypeLabel: inv.type === 'official' ? 'فاکتور رسمی فروش' : 'فاکتور فروش',
        description: `خرید کالا طبق فاکتور شماره ${inv.invoiceNumber} (${(inv.items || []).length} ردیف)${itemsSummary ? `: ${itemsSummary}` : ''}${inv.notes ? ` - ${inv.notes}` : ''}`,
        debit: Number(inv.finalTotal) || 0,
        credit: 0,
        paymentMethod: inv.paymentMethod ? paymentMethodLabels[inv.paymentMethod] || inv.paymentMethod : undefined,
        paymentMethodKey: inv.paymentMethod,
        notes: inv.notes,
        invoiceId: inv.id,
        itemsSummary,
      });

      if (Number(inv.paidAmount) > 0) {
        const payMethodTxt = inv.paymentMethod ? paymentMethodLabels[inv.paymentMethod] || inv.paymentMethod : 'نقدی';
        raw.push({
          id: `inv-pay-${inv.id}`,
          date: inv.date || '',
          documentNumber: String(inv.invoiceNumber || ''),
          documentType: 'invoice_payment',
          documentTypeLabel: 'واریز همزمان با فاکتور',
          description: `پرداخت وجه همزمان با صدور فاکتور شماره ${inv.invoiceNumber} [${payMethodTxt}]${inv.transferDescription ? ` (${inv.transferDescription})` : ''}`,
          debit: 0,
          credit: Number(inv.paidAmount) || 0,
          paymentMethod: payMethodTxt,
          paymentMethodKey: inv.paymentMethod || 'cash',
          trackingNumber: inv.chequeNumber,
          chequeDueDate: inv.chequeDueDate,
          bankName: inv.chequeName,
          notes: inv.transferDescription || inv.notes,
          invoiceId: inv.id,
        });
      }
    });

    // Standalone deposits/debts (excluding `inv-pay-*` already added above)
    deposits
      .filter((dep) => !String(dep.id || '').startsWith('inv-pay-'))
      .forEach((dep) => {
        const payMethodTxt = dep.paymentMethod ? paymentMethodLabels[dep.paymentMethod] || dep.paymentMethod : 'واریز به حساب';
        if (dep.type === 'deposit') {
          raw.push({
            id: `txn-${dep.id}`,
            date: dep.date || '',
            documentNumber: String(dep.trackingNumber || String(dep.id || '').substring(0, 8)),
            documentType: 'deposit',
            documentTypeLabel: 'واریز',
            description: `${dep.title || 'واریز وجه مشتری'}${dep.bankName ? ` - بانک ${dep.bankName}` : ''}${dep.invoiceNumber ? ` (بابت فاکتور ${dep.invoiceNumber})` : ''}${dep.notes ? ` - ${dep.notes}` : ''}`,
            debit: 0,
            credit: Number(dep.amount) || 0,
            paymentMethod: payMethodTxt,
            paymentMethodKey: dep.paymentMethod || 'transfer',
            trackingNumber: dep.trackingNumber,
            bankName: dep.bankName,
            chequeDueDate: dep.chequeDueDate,
            notes: dep.notes,
          });
        } else {
          raw.push({
            id: `txn-${dep.id}`,
            date: dep.date || '',
            documentNumber: String(dep.trackingNumber || String(dep.id || '').substring(0, 8)),
            documentType: 'debt',
            documentTypeLabel: 'ثبت بدهی دستی / مانده',
            description: `${dep.title || 'سند افزایش بدهی'}${dep.notes ? ` - ${dep.notes}` : ''}`,
            debit: Number(dep.amount) || 0,
            credit: 0,
            trackingNumber: dep.trackingNumber,
            notes: dep.notes,
          });
        }
      });

    raw.sort((a, b) => {
      const cmp = String(a.date || '').localeCompare(String(b.date || ''));
      if (cmp !== 0) return cmp;
      if (a.documentType === 'invoice' && b.documentType !== 'invoice') return -1;
      if (a.documentType !== 'invoice' && b.documentType === 'invoice') return 1;
      return 0;
    });

    let running = 0;
    return raw.map((e) => {
      running += e.debit - e.credit;
      return {
        ...e,
        balance: running,
        balanceStatus: running > 0 ? 'debtor' : running < 0 ? 'creditor' : 'settled',
      };
    });
  }, [showCustomerStatement, customerLedger?.entries, customerInvoices, deposits]);

  // Normalize digits for reliable Persian/English search
  const normalizeDigitsToEn = (str: string) =>
    String(str || '')
      .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
      .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));

  const normalizeComparableDate = (d: string) => {
    const clean = normalizeDigitsToEn(d).trim();
    const parts = clean.split(/[/-]/);
    if (parts.length === 3) {
      return `${parts[0].padStart(4, '0')}/${parts[1].padStart(2, '0')}/${parts[2].padStart(2, '0')}`;
    }
    return clean;
  };

  // Filtered & sorted Customer Statement entries
  const filteredStatementEntries = useMemo(() => {
    const todayJalali = normalizeComparableDate(getCurrentJalaliDate());
    const currentYear = todayJalali.substring(0, 4);
    const currentYearMonth = todayJalali.substring(0, 7);

    // Approximate 3 months ago in Jalali YYYY/MM
    const getThreeMonthsAgoPrefix = () => {
      const parts = todayJalali.split('/');
      if (parts.length < 2) return '';
      let y = parseInt(parts[0], 10);
      let m = parseInt(parts[1], 10) - 3;
      if (m <= 0) {
        m += 12;
        y -= 1;
      }
      return `${String(y).padStart(4, '0')}/${String(m).padStart(2, '0')}/01`;
    };
    const threeMonthsStart = getThreeMonthsAgoPrefix();

    const filtered = fullStatementEntries.filter((entry) => {
      // 1. Type filter
      if (statementTypeFilter === 'debit' && entry.debit === 0) return false;
      if (statementTypeFilter === 'credit' && entry.credit === 0) return false;
      if (statementTypeFilter === 'invoice' && entry.documentType !== 'invoice') return false;
      if (statementTypeFilter === 'deposit' && entry.documentType !== 'deposit' && entry.documentType !== 'invoice_payment') return false;

      // 2. Payment method filter
      if (statementPaymentFilter !== 'all') {
        const key = (entry.paymentMethodKey || '').toLowerCase();
        const label = (entry.paymentMethod || '').toLowerCase();
        if (statementPaymentFilter === 'cash' && key !== 'cash' && !label.includes('نقد')) return false;
        if (statementPaymentFilter === 'transfer' && key !== 'transfer' && key !== 'card' && !label.includes('واریز') && !label.includes('کارت')) return false;
        if (statementPaymentFilter === 'pos' && key !== 'pos' && !label.includes('کارتخوان') && !label.includes('pos')) return false;
        if (statementPaymentFilter === 'cheque' && key !== 'cheque' && !label.includes('چک')) return false;
      }

      // 3. Date filter
      const entryDateNorm = normalizeComparableDate(entry.date);
      if (statementDateFilter === 'this_year' && !entryDateNorm.startsWith(currentYear)) {
        return false;
      }
      if (statementDateFilter === 'this_month' && !entryDateNorm.startsWith(currentYearMonth)) {
        return false;
      }
      if (statementDateFilter === '3months' && threeMonthsStart && entryDateNorm < threeMonthsStart) {
        return false;
      }
      if (statementDateFilter === 'custom') {
        if (statementDateFrom.trim()) {
          const fromNorm = normalizeComparableDate(statementDateFrom);
          if (entryDateNorm < fromNorm) return false;
        }
        if (statementDateTo.trim()) {
          const toNorm = normalizeComparableDate(statementDateTo);
          if (entryDateNorm > toNorm) return false;
        }
      }

      // 4. Search query
      if (statementSearch.trim()) {
        const q = normalizeDigitsToEn(statementSearch.trim()).toLowerCase();
        const haystack = normalizeDigitsToEn(
          [
            entry.documentNumber,
            entry.documentTypeLabel,
            entry.description,
            entry.itemsSummary,
            entry.trackingNumber,
            entry.paymentMethod,
            entry.bankName,
            entry.notes,
            entry.date,
            String(entry.debit || ''),
            String(entry.credit || ''),
          ]
            .filter(Boolean)
            .join(' ')
        ).toLowerCase();

        if (!haystack.includes(q)) return false;
      }

      return true;
    });

    if (statementSortOrder === 'desc') {
      return [...filtered].reverse();
    }
    return filtered;
  }, [
    fullStatementEntries,
    statementTypeFilter,
    statementPaymentFilter,
    statementDateFilter,
    statementDateFrom,
    statementDateTo,
    statementSearch,
    statementSortOrder,
  ]);

  const isStatementFiltered = Boolean(
    statementSearch.trim() ||
    statementTypeFilter !== 'all' ||
    statementPaymentFilter !== 'all' ||
    statementDateFilter !== 'all'
  );

  // Dynamic totals based on customer's active search and filters
  const activeStatementTotals = useMemo(() => {
    let totalDebit = 0;
    let totalCredit = 0;
    filteredStatementEntries.forEach((e) => {
      totalDebit += e.debit || 0;
      totalCredit += e.credit || 0;
    });
    const netBalance = totalDebit - totalCredit;
    return {
      totalDebit,
      totalCredit,
      netBalance,
      entriesCount: filteredStatementEntries.length,
      totalAllCount: fullStatementEntries.length,
      isFiltered: isStatementFiltered,
    };
  }, [filteredStatementEntries, fullStatementEntries.length, isStatementFiltered]);

  const handleSwitchInvoice = (inv: Invoice) => {
    setSelectedInvoice(inv);
    setActiveTab('current');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const resetStatementFilters = () => {
    setStatementSearch('');
    setStatementTypeFilter('all');
    setStatementPaymentFilter('all');
    setStatementDateFilter('all');
    setStatementDateFrom('');
    setStatementDateTo('');
  };

  const handlePrintStatement = () => {
    printElementDirectly('printable-public-customer-statement-pdf', {
      pageSize: 'a4',
      orientation: 'portrait',
      documentType: 'generic',
    });
  };

  const handleDownloadStatementPdf = async () => {
    if (!invoice) return;
    try {
      setIsExportingPdf(true);
      const safeName = (invoice.customerName || 'مشتری').replace(/\s+/g, '_');
      const safeDate = getCurrentJalaliDate().replace(/\//g, '-');
      const searchSuffix = statementSearch.trim()
        ? `_جستجو_${statementSearch.trim().replace(/\s+/g, '_')}`
        : isStatementFiltered
        ? '_فیلترشده'
        : '';
      const filename = `صورتحساب_مالی_${safeName}${searchSuffix}_${safeDate}.pdf`;

      const res = await exportElementToPdf('printable-public-customer-statement-pdf', filename, {
        pageSize: 'a4',
        orientation: 'portrait',
        quality: 'high',
        documentType: 'generic',
      });

      if (res.success) {
        showToast('فایل PDF صورتحساب با موفقیت دانلود شد.');
      } else {
        showToast(res.error || 'خطا در تولید فایل PDF صورتحساب.');
      }
    } catch {
      showToast('خطا در تولید فایل PDF صورتحساب.');
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handlePrint = () => {
    if (activeTab === 'ledger' && showCustomerStatement) {
      handlePrintStatement();
      return;
    }
    if (!displayedInvoice) return;
    printElementDirectly('public-web-invoice-container', {
      pageSize: 'a4',
      orientation: 'portrait',
      documentType: 'invoice',
    });
  };

  const handleDownloadPdf = async () => {
    if (activeTab === 'ledger' && showCustomerStatement) {
      await handleDownloadStatementPdf();
      return;
    }
    if (!displayedInvoice) return;
    try {
      setIsExportingPdf(true);
      const filename = getInvoicePdfFilename(displayedInvoice, { includeExtension: true });

      const pdfResult = await generatePdfBlob('public-web-invoice-container', filename, {
        pageSize: 'a4',
        orientation: 'portrait',
        documentType: 'invoice',
        quality: 'high',
      });

      if (!pdfResult.success || !pdfResult.blob) {
        showToast('خطا در تولید فایل PDF. لطفاً از دکمه چاپ فاکتور استفاده فرمایید.');
        return;
      }

      const url = URL.createObjectURL(pdfResult.blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      showToast('فایل PDF با موفقیت دانلود شد.');
    } catch (err: any) {
      console.error(err);
      showToast('خطا در تولید فایل PDF فاکتور.');
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handleCopyLink = () => {
    if (typeof window === 'undefined') return;
    navigator.clipboard.writeText(window.location.href).then(() => {
      showToast('پیوند فاکتور در حافظه کپی شد.');
    });
  };

  const handleShareNative = async () => {
    if (!displayedInvoice) return;
    const title = displayedInvoice.isProforma
      ? `پیش‌فاکتور خرید شماره ${toPersianDigits(displayedInvoice.invoiceNumber)}`
      : `فاکتور خرید شماره ${toPersianDigits(displayedInvoice.invoiceNumber)}`;
    const text = `فاکتور خرید شما در فروشگاه ${settings?.storeName || 'سپهر'}\nمبلغ: ${formatPrice(displayedInvoice.finalTotal, settings?.currency || 'تومان')}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title,
          text,
          url: window.location.href,
        });
      } catch {}
    } else {
      handleCopyLink();
    }
  };

  const storePhone = settings?.phone || settings?.mobile || '';
  const cleanPhone = storePhone.replace(/[^0-9]/g, '');

  // Filtered invoices
  const filteredInvoices = useMemo(() => {
    return customerInvoices.filter((inv) => {
      const matchSearch =
        !searchInvoices.trim() ||
        inv.invoiceNumber.toLowerCase().includes(searchInvoices.trim().toLowerCase()) ||
        inv.date.includes(searchInvoices.trim()) ||
        (inv.notes && inv.notes.includes(searchInvoices.trim())) ||
        (inv.items && inv.items.some((it) => it.productName.includes(searchInvoices.trim())));

      if (!matchSearch) return false;

      if (filterInvoiceStatus === 'paid') return inv.paymentStatus === 'paid' && !inv.isProforma;
      if (filterInvoiceStatus === 'unpaid') return inv.paymentStatus === 'unpaid' && !inv.isProforma;
      if (filterInvoiceStatus === 'partial') return inv.paymentStatus === 'partial' && !inv.isProforma;
      if (filterInvoiceStatus === 'proforma') return !!inv.isProforma;

      return true;
    });
  }, [customerInvoices, searchInvoices, filterInvoiceStatus]);

  // Total deposits amount
  const totalDepositsAmount = useMemo(() => {
    return deposits
      .filter((d) => d.type === 'deposit')
      .reduce((sum, d) => sum + (d.amount || 0), 0);
  }, [deposits]);

  // 1. Loading State
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4 text-center select-none font-['Vazirmatn']" dir="rtl">
        <div className="w-16 h-16 rounded-3xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center mb-5 animate-pulse">
          <Receipt className="w-8 h-8 animate-bounce" />
        </div>
        <h2 className="text-white text-base sm:text-lg font-bold mb-2">
          در حال بارگذاری نسخه تحت وب فاکتور...
        </h2>
        <p className="text-slate-400 text-xs sm:text-sm max-w-sm leading-relaxed">
          لطفاً چند لحظه شکیبا باشید تا اطلاعات معتبر فاکتور از سامانه دریافت گردد.
        </p>
      </div>
    );
  }

  // 2. PIN Password Entry State
  if (pinRequired) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 flex flex-col items-center justify-center p-4 font-['Vazirmatn']" dir="rtl">
        <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-slate-200 text-center animate-in fade-in zoom-in-95 duration-200">
          <div className="w-16 h-16 rounded-3xl bg-indigo-50 text-indigo-600 border border-indigo-200 flex items-center justify-center mx-auto mb-4 shadow-sm">
            <Lock className="w-8 h-8" />
          </div>

          <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-200 inline-block mb-3">
            حفاظت شده با رمز عبور
          </span>

          <h2 className="text-lg sm:text-xl font-black text-slate-900 mb-1.5">
            ورود به نسخه تحت وب فاکتور
          </h2>

          {storeMeta.storeName && (
            <p className="text-xs text-slate-500 mb-1">
              صادرکننده: <strong className="text-slate-800 font-bold">{storeMeta.storeName}</strong>
            </p>
          )}

          {storeMeta.invoiceNumber && (
            <p className="text-xs text-slate-500 mb-5">
              شماره فاکتور: <span className="font-mono font-bold text-indigo-700 bg-slate-100 px-2 py-0.5 rounded">{toPersianDigits(storeMeta.invoiceNumber)}</span>
            </p>
          )}

          <p className="text-xs text-slate-600 leading-relaxed mb-5 bg-slate-50 p-3 rounded-2xl border border-slate-200">
            جهت حفظ محرمانگی مالی، این فاکتور با پین‌کد امنیتی محافظت شده است. لطفاً رمز عبور اعلام‌شده توسط فروشگاه را وارد نمایید.
          </p>

          <form onSubmit={handlePinSubmit} className="space-y-4">
            <div className="space-y-1.5 text-right">
              <label className="text-xs font-bold text-slate-700 block text-center">
                رمز عبور / پین کد فاکتور:
              </label>
              <input
                type="password"
                inputMode="numeric"
                autoFocus
                placeholder="••••"
                value={pinInput}
                onChange={(e) => {
                  setPinInput(e.target.value);
                  setPinError('');
                }}
                className="w-full text-center text-xl tracking-widest font-mono font-bold py-3 px-4 border border-slate-300 rounded-2xl focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all shadow-inner"
              />
            </div>

            {pinError && (
              <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold flex items-center justify-center gap-1.5">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{pinError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={pinLoading}
              className="w-full min-h-[44px] py-3 px-4 bg-indigo-600 hover:bg-indigo-700 active:scale-98 disabled:opacity-50 text-white rounded-2xl font-bold text-xs sm:text-sm transition-all shadow-md shadow-indigo-600/20 cursor-pointer flex items-center justify-center gap-2"
            >
              {pinLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>در حال بررسی رمز...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>مشاهده فاکتور</span>
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // 3. Error / Expired State
  if (errorMessage || !invoice) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 font-['Vazirmatn']" dir="rtl">
        <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-slate-200 text-center animate-in fade-in zoom-in-95 duration-200">
          <div className="w-16 h-16 rounded-3xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center mx-auto mb-4 shadow-sm">
            <ShieldAlert className="w-8 h-8" />
          </div>

          <h2 className="text-base sm:text-lg font-black text-slate-900 mb-2">
            عدم دسترسی به فاکتور آنلاین
          </h2>

          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed mb-6 bg-amber-50/70 p-3.5 rounded-2xl border border-amber-200/80">
            {errorMessage || 'این پیوند نامعتبر است، منقضی شده یا دسترسی به آن توسط صادرکننده باطل شده است.'}
          </p>

          {storePhone && (
            <a
              href={`tel:${cleanPhone}`}
              className="w-full min-h-[44px] py-3 px-4 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white rounded-2xl font-bold text-xs sm:text-sm transition-all shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2"
            >
              <Phone className="w-4 h-4" />
              <span>تماس با فروشگاه ({toPersianDigits(storePhone)})</span>
            </a>
          )}
        </div>
      </div>
    );
  }

  // Active displayed invoice calculations
  const currInv = displayedInvoice || invoice;
  const isPaid = currInv.paymentStatus === 'paid';
  const isPartial = currInv.paymentStatus === 'partial';
  const isUnpaid = currInv.paymentStatus === 'unpaid';
  const remainingDebt = Math.max(0, currInv.finalTotal - (isPaid ? currInv.finalTotal : (currInv.paidAmount || 0)));
  const totalItemsCount = (currInv.items || []).reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
  const allowPdf = shareLink?.allowPdfDownload !== false;

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 pb-16 font-['Vazirmatn'] selection:bg-emerald-500 selection:text-white" dir="rtl">
      {/* Top Header Bar */}
      <header className="no-print bg-slate-900 text-white sticky top-0 z-40 shadow-lg border-b border-slate-800">
        <div className="max-w-5xl mx-auto px-3 sm:px-6 py-2.5 flex items-center justify-between gap-3">
          {/* Brand & Store Name */}
          <div className="flex items-center gap-2.5 min-w-0">
            {settings?.logo ? (
              <img
                src={settings.logo}
                alt={settings.storeName}
                className="w-9 h-9 rounded-xl object-contain bg-white/10 p-1 border border-white/20 shrink-0"
              />
            ) : (
              <span className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shrink-0">
                <Receipt className="w-5 h-5" />
              </span>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-bold text-xs sm:text-sm text-white truncate">
                  {settings?.storeName || 'بازرگانی و فروشگاه سپهر'}
                </span>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-medium px-2 py-0.5 rounded-full border border-emerald-500/30 whitespace-nowrap">
                  پورتال مشتریان
                </span>
              </div>
              <p className="text-[11px] text-slate-400 truncate">
                مشتری گرامی: <strong className="text-slate-200 font-semibold">{invoice.customerName}</strong>
              </p>
            </div>
          </div>

          {/* Quick Header Actions */}
          <div className="flex items-center gap-1.5 shrink-0">
            {allowPdf && (
              <button
                type="button"
                onClick={handleDownloadPdf}
                disabled={isExportingPdf}
                className="min-h-[38px] flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 active:scale-98 disabled:opacity-50 text-white px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
                title="دانلود نسخه PDF"
              >
                {isExportingPdf ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span className="hidden sm:inline">در حال آماده‌سازی...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-3.5 h-3.5" />
                    <span className="hidden xs:inline">دانلود PDF</span>
                  </>
                )}
              </button>
            )}

            <button
              type="button"
              onClick={handlePrint}
              className="min-h-[38px] flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold border border-slate-700 transition-all cursor-pointer"
              title="چاپ مستقیم فاکتور"
            >
              <Printer className="w-3.5 h-3.5 text-blue-400" />
              <span className="hidden sm:inline">چاپ</span>
            </button>

            <button
              type="button"
              onClick={handleShareNative}
              className="min-h-[38px] flex items-center gap-1.5 bg-sky-950/80 hover:bg-sky-900 text-sky-300 hover:text-white px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold border border-sky-600/40 transition-colors cursor-pointer"
              title="اشتراک‌گذاری"
            >
              <Share2 className="w-3.5 h-3.5 text-sky-400" />
              <span className="hidden md:inline">اشتراک</span>
            </button>
          </div>
        </div>

        {/* Customer Navigation Tabs (Mobile-Optimized Horizontal Scroll) */}
        <div className="bg-slate-950/90 border-t border-slate-800/80 overflow-x-auto no-scrollbar">
          <div className="max-w-5xl mx-auto px-2 sm:px-6 flex items-center gap-1 py-1.5 min-w-max">
            <button
              type="button"
              onClick={() => setActiveTab('current')}
              className={`min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'current'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Receipt className="w-4 h-4 shrink-0" />
              <span>فاکتور فعلی ({toPersianDigits(currInv.invoiceNumber)})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('invoices')}
              className={`min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'invoices'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <FileSpreadsheet className="w-4 h-4 shrink-0" />
              <span>تمام فاکتورهای من</span>
              <span className="px-1.5 py-0.2 rounded-md bg-white/10 text-[10px] font-mono">
                {toPersianDigits(customerInvoices.length)}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('deposits')}
              className={`min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'deposits'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Wallet className="w-4 h-4 shrink-0" />
              <span>واریزی‌ها و پرداخت‌ها</span>
              <span className="px-1.5 py-0.2 rounded-md bg-white/10 text-[10px] font-mono">
                {toPersianDigits(deposits.length)}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('remittances')}
              className={`min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'remittances'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Truck className="w-4 h-4 shrink-0" />
              <span>حواله‌های انبار و باربری</span>
              <span className="px-1.5 py-0.2 rounded-md bg-white/10 text-[10px] font-mono">
                {toPersianDigits(remittances.length)}
              </span>
            </button>

            {showCustomerStatement && (
              <button
                type="button"
                onClick={() => setActiveTab('ledger')}
                className={`min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  activeTab === 'ledger'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-emerald-300 hover:text-white bg-emerald-950/50 hover:bg-emerald-900/60 border border-emerald-500/30'
                }`}
              >
                <ReceiptText className="w-4 h-4 shrink-0" />
                <span>صورتحساب کامل و گردش حساب</span>
                <span className="px-1.5 py-0.2 rounded-md bg-white/15 text-[10px] font-mono">
                  {toPersianDigits(fullStatementEntries.length)}
                </span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-5xl mx-auto px-2 sm:px-6 py-4 sm:py-6">
        
        {/* TAB 1: CURRENT INVOICE VIEW */}
        {activeTab === 'current' && (
          <div className="space-y-4">
            {/* Quick Status Bar for Active Invoice */}
            <div className="no-print bg-white rounded-2xl p-3.5 sm:p-4 border border-slate-200/90 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
                  isPaid ? 'bg-emerald-100 text-emerald-700' :
                  isPartial ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'
                }`}>
                  {isPaid ? <CheckCircle2 className="w-5 h-5" /> :
                   isPartial ? <Clock className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-sm text-slate-900">
                      {currInv.isProforma ? 'پیش‌فاکتور شماره' : 'فاکتور فروش شماره'} {toPersianDigits(currInv.invoiceNumber)}
                    </span>
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${
                      isPaid ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                      isPartial ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                      'bg-rose-50 text-rose-700 border border-rose-200'
                    }`}>
                      {isPaid ? 'کاملاً پرداخت و تسویه شده' :
                       isPartial ? `پرداخت بخشی (${formatPrice(currInv.paidAmount, settings?.currency || 'تومان')} دریافت شد)` :
                       'پرداخت نشده / نسیه'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    تاریخ صدور: {toPersianDigits(currInv.date)}
                    {currInv.dueDate && ` • سررسید: ${toPersianDigits(currInv.dueDate)}`}
                  </p>
                </div>
              </div>

              {/* Quick Mobile Action Buttons */}
              <div className="flex items-center gap-2 self-end sm:self-auto">
                <button
                  type="button"
                  onClick={handleDownloadPdf}
                  disabled={isExportingPdf}
                  className="min-h-[44px] px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer border border-emerald-200"
                >
                  <Download className="w-4 h-4 text-emerald-600" />
                  <span>دانلود PDF</span>
                </button>
                <button
                  type="button"
                  onClick={handlePrint}
                  className="min-h-[44px] px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer border border-slate-200"
                >
                  <Printer className="w-4 h-4 text-slate-600" />
                  <span>چاپ</span>
                </button>
              </div>
            </div>

            {/* Printable Digital Invoice Container */}
            <div
              id="public-web-invoice-container"
              className="print-white-bg bg-white rounded-3xl border border-slate-200 shadow-sm p-4 sm:p-8 space-y-6 print:p-0 print:border-none print:shadow-none"
            >
              {/* 1. Official Header */}
              <div className="flex flex-col sm:flex-row items-center sm:items-start justify-between pb-6 border-b border-slate-200 gap-4 text-center sm:text-right">
                {/* Store Identity */}
                <div className="flex flex-col sm:flex-row items-center gap-4">
                  {settings?.logo ? (
                    <img
                      src={settings.logo}
                      alt={settings.storeName}
                      className="w-16 h-16 sm:w-20 sm:h-20 object-contain rounded-2xl border border-slate-100 p-1"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center">
                      <Building2 className="w-8 h-8" />
                    </div>
                  )}

                  <div>
                    <h1 className="text-lg sm:text-xl font-black text-slate-900">
                      {settings?.storeName || 'سامانه حسابداری سپهر'}
                    </h1>
                    {settings?.tagline && (
                      <p className="text-xs text-slate-500 mt-1">{settings.tagline}</p>
                    )}
                    {settings?.sellerName && (
                      <p className="text-xs text-slate-600 mt-0.5">
                        مدیریت: <span className="font-bold">{settings.sellerName}</span>
                      </p>
                    )}
                  </div>
                </div>

                {/* Invoice Type Title & Meta Badges */}
                <div className="flex flex-col items-center sm:items-end space-y-1.5">
                  <div className="inline-block px-3.5 py-1 rounded-xl bg-slate-900 text-white text-xs font-bold tracking-tight">
                    {currInv.isProforma
                      ? 'پیش‌فاکتور فروش کالا'
                      : currInv.type === 'official'
                      ? 'صورتحساب رسمی فروش کالا و خدمات'
                      : 'فاکتور فروش کالا'}
                  </div>
                  {currInv.type === 'official' && (
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-md">
                      مشمول مالیات بر ارزش افزوده ({toPersianDigits(currInv.taxRate || settings?.officialTaxPercent || 10)}٪)
                    </span>
                  )}

                  <div className="text-xs text-slate-600 space-y-0.5 text-center sm:text-left">
                    <p>
                      شماره فاکتور: <span className="font-mono font-bold text-slate-900">{toPersianDigits(currInv.invoiceNumber)}</span>
                    </p>
                    <p>
                      تاریخ صدور: <span className="font-mono text-slate-800">{toPersianDigits(currInv.date)}</span>
                    </p>
                    {currInv.dueDate && (
                      <p className="text-amber-800 font-medium">
                        سررسید تسویه: <span className="font-mono font-bold">{toPersianDigits(currInv.dueDate)}</span>
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* 2. Seller and Customer Information Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                {/* Seller Box */}
                <div className="bg-slate-50/70 p-4 rounded-2xl border border-slate-200/80 space-y-2">
                  <div className="flex items-center gap-1.5 font-bold text-slate-800 border-b border-slate-200/80 pb-2">
                    <Building2 className="w-4 h-4 text-emerald-600" />
                    <span>مشخصات صادرکننده (فروشنده):</span>
                  </div>

                  <div className="space-y-1 text-slate-600 leading-relaxed">
                    <p>
                      <strong className="text-slate-800">نام شخص یا شرکت:</strong>{' '}
                      {currInv.type === 'official' ? (currInv.sellerName || settings?.sellerName || settings?.storeName || '—') : (settings?.storeName || '—')}
                    </p>
                    {currInv.type === 'official' && (currInv.sellerEconomicCode || settings?.economicCode) && (
                      <p>
                        <strong className="text-slate-800">شماره اقتصادی:</strong>{' '}
                        <span className="font-mono font-bold" dir="ltr">{toPersianDigits(currInv.sellerEconomicCode || settings?.economicCode || '')}</span>
                      </p>
                    )}
                    {currInv.type === 'official' && (currInv.sellerRegistrationNumber || settings?.registrationNumber || currInv.sellerNationalCode || settings?.nationalCode) && (
                      <p>
                        <strong className="text-slate-800">شماره ثبت / مجوز:</strong>{' '}
                        <span className="font-mono font-bold" dir="ltr">{toPersianDigits(currInv.sellerRegistrationNumber || settings?.registrationNumber || currInv.sellerNationalCode || settings?.nationalCode || '')}</span>
                      </p>
                    )}
                    {(currInv.sellerPhone || storePhone) && (
                      <p>
                        <strong className="text-slate-800">تلفن تماس:</strong> <span className="font-mono">{toPersianDigits(currInv.sellerPhone || storePhone || '')}</span>
                      </p>
                    )}
                    {currInv.type !== 'official' && settings?.nationalCode && (
                      <p>
                        <strong className="text-slate-800">شناسه ملی / ثبت:</strong> <span className="font-mono">{toPersianDigits(settings.nationalCode)}</span>
                      </p>
                    )}
                    {(currInv.sellerAddress || settings?.address) && (
                      <p>
                        <strong className="text-slate-800">نشانی فروشگاه:</strong> {currInv.sellerAddress || settings?.address}
                      </p>
                    )}
                  </div>
                </div>

                {/* Customer Box */}
                <div className="bg-slate-50/70 p-4 rounded-2xl border border-slate-200/80 space-y-2">
                  <div className="flex items-center gap-1.5 font-bold text-slate-800 border-b border-slate-200/80 pb-2">
                    <User className="w-4 h-4 text-blue-600" />
                    <span>مشخصات خریدار (مشتری):</span>
                  </div>

                  <div className="space-y-1 text-slate-600 leading-relaxed">
                    <p>
                      <strong className="text-slate-800">نام خریدار:</strong> {currInv.customerName || 'مشتری آزاد'}
                    </p>
                    {currInv.customerPhone && (
                      <p>
                        <strong className="text-slate-800">شماره تماس:</strong> <span className="font-mono">{toPersianDigits(currInv.customerPhone)}</span>
                      </p>
                    )}
                    {currInv.customerNationalId && (
                      <p>
                        <strong className="text-slate-800">شناسه / کدملی:</strong> <span className="font-mono">{toPersianDigits(currInv.customerNationalId)}</span>
                      </p>
                    )}
                    {currInv.customerAddress && (
                      <p>
                        <strong className="text-slate-800">آدرس تحویل:</strong> {currInv.customerAddress}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* 3. Items Presentation: Responsive Cards for Mobile + Classic Table for Desktop & Print */}
              <div>
                <h3 className="text-xs font-bold text-slate-800 mb-2 flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-slate-600" />
                  <span>اقلام و کالاهای فاکتور ({toPersianDigits((currInv.items || []).length)} ردیف):</span>
                </h3>

                {/* 3.A: Mobile Cards View (Visible on screens < md, hidden on desktop and print) */}
                <div className="block md:hidden space-y-2.5 print:hidden">
                  {(currInv.items || []).map((item, idx) => (
                    <div
                      key={item.id || idx}
                      className="bg-slate-50/90 rounded-2xl p-3.5 border border-slate-200 space-y-2 text-xs"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex items-start gap-2">
                          <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                            {toPersianDigits(idx + 1)}
                          </span>
                          <div>
                            <h4 className="font-bold text-slate-900 text-xs sm:text-sm">
                              {item.productName}
                            </h4>
                            {item.variantName && (
                              <span className="inline-block text-[10px] text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded mt-0.5 font-medium">
                                تنوع: {item.variantName}
                              </span>
                            )}
                            {(item.description || item.notes) && (
                              <p className="text-[11px] text-slate-600 mt-0.5 leading-snug">
                                <span className="text-slate-400 font-medium">توضیح: </span>{item.description || item.notes}
                              </p>
                            )}
                            {item.productCode && (
                              <p className="text-[11px] text-slate-400 mt-0.5 font-mono">
                                کد کالا: {toPersianDigits(item.productCode)}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="text-left shrink-0">
                          <span className="text-[11px] text-slate-500 block">جمع ردیف:</span>
                          <span className="font-bold font-mono text-emerald-800 text-xs sm:text-sm">
                            {formatPrice(item.total, settings?.currency || 'تومان')}
                          </span>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-slate-200/80 flex items-center justify-between text-[11px] text-slate-600">
                        <div>
                          <span>مقدار: </span>
                          <strong className="font-mono text-slate-800">
                            {toPersianDigits(item.quantity)} {item.unit || 'عدد'}
                          </strong>
                        </div>
                        <div>
                          <span>فی: </span>
                          <span className="font-mono text-slate-700">
                            {formatPrice(item.unitPrice, settings?.currency || 'تومان')}
                          </span>
                        </div>
                        {item.discount > 0 && (
                          <div className="text-rose-600 font-medium">
                            <span>تخفیف: </span>
                            <span className="font-mono">-{formatPrice(item.discount, settings?.currency || 'تومان')}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* 3.B: Classic Table View (Visible on md+ screens and strictly preserved for Print / PDF export) */}
                <div className="hidden md:block print:block overflow-x-auto rounded-2xl border border-slate-200">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3 w-10 text-center align-middle">#</th>
                        <th className="py-2.5 px-3 align-middle">شرح کالا یا خدمات</th>
                        <th className="py-2.5 px-3 text-center align-middle">تعداد / مقدار</th>
                        <th className="py-2.5 px-3 text-left align-middle">قیمت واحد</th>
                        <th className="py-2.5 px-3 text-left align-middle">تخفیف</th>
                        <th className="py-2.5 px-3 text-left align-middle">مبلغ کل ({settings?.currency || 'تومان'})</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(currInv.items || []).map((item, idx) => (
                        <tr key={item.id || idx} className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-2.5 px-3 text-center font-mono text-slate-400 align-middle">
                            {toPersianDigits(idx + 1)}
                          </td>
                          <td className="py-2.5 px-3 align-middle">
                            <span className="font-bold text-slate-900">{item.productName}</span>
                            {item.variantName && (
                              <span className="mr-1.5 text-[10px] text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded font-medium">
                                {item.variantName}
                              </span>
                            )}
                            {(item.description || item.notes) && (
                              <span className="block text-[11px] text-slate-600 mt-0.5 leading-snug">
                                <span className="text-slate-400 font-medium">توضیح: </span>{item.description || item.notes}
                              </span>
                            )}
                            {item.productCode && (
                              <span className="block text-[10px] text-slate-400 font-mono">
                                کد: {toPersianDigits(item.productCode)}
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-800 align-middle">
                            {toPersianDigits(item.quantity)} <span className="text-[10px] font-normal text-slate-500">{item.unit}</span>
                          </td>
                          <td className="py-2.5 px-3 text-left font-mono text-slate-700 align-middle">
                            {formatPrice(item.unitPrice, '')}
                          </td>
                          <td className="py-2.5 px-3 text-left font-mono text-rose-600 align-middle">
                            {item.discount > 0 ? formatPrice(item.discount, '') : '—'}
                          </td>
                          <td className="py-2.5 px-3 text-left font-mono font-bold text-slate-900 align-middle">
                            {formatPrice(item.total, '')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 4. Financial Totals & Payment Summary */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 pt-2">
                {/* Notes & Bank Details */}
                <div className="md:col-span-7 space-y-3">
                  <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                    <span className="text-[11px] text-slate-400 block mb-0.5">مبلغ کل قابل پرداخت به حروف:</span>
                    <span className="font-bold text-slate-800 text-xs sm:text-sm">
                      {numberToPersianWords(currInv.finalTotal)} {settings?.currency || 'تومان'}
                    </span>
                  </div>

                  {cleanInvoiceNotes(currInv.notes) && (
                    <div className="bg-amber-50/70 p-3.5 rounded-2xl border border-amber-200/80 text-xs text-amber-900">
                      <span className="font-bold block mb-1">یادداشت و شرایط فاکتور:</span>
                      <p className="leading-relaxed whitespace-pre-line">{cleanInvoiceNotes(currInv.notes)}</p>
                    </div>
                  )}

                  {/* Payment Details Card (Bank Transfer / Cheque) */}
                  {(currInv.transferDescription || currInv.chequeNumber) && (
                    <div className="bg-blue-50/70 p-3.5 rounded-2xl border border-blue-200/80 text-xs text-blue-900 space-y-1">
                      <span className="font-bold flex items-center gap-1 text-blue-950">
                        <CreditCard className="w-3.5 h-3.5" />
                        <span>مشخصات تسویه و پرداخت:</span>
                      </span>
                      {currInv.transferDescription && (
                        <p className="text-blue-800 leading-relaxed">
                          واریز بانکی: {currInv.transferDescription}
                        </p>
                      )}
                      {currInv.chequeNumber && (
                        <p className="text-blue-800 leading-relaxed">
                          شماره چک: {toPersianDigits(currInv.chequeNumber)} {currInv.chequeDueDate ? `(سررسید: ${toPersianDigits(currInv.chequeDueDate)})` : ''} {currInv.chequeName ? `- صاحب حساب: ${currInv.chequeName}` : ''}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Financial Totals Breakdown Table */}
                <div className="md:col-span-5 bg-slate-50 rounded-2xl p-4 border border-slate-200 space-y-2 text-xs">
                  <div className="flex items-center justify-between text-slate-600">
                    <span>تعداد کل اقلام:</span>
                    <span className="font-bold font-mono text-slate-800">{toPersianDigits(totalItemsCount)} واحد</span>
                  </div>

                  <div className="flex items-center justify-between text-slate-600">
                    <span>جمع اقلام (قبل از تخفیف):</span>
                    <span className="font-mono text-slate-800">{formatPrice(currInv.subtotal, settings?.currency || 'تومان')}</span>
                  </div>

                  {currInv.totalDiscount > 0 && (
                    <div className="flex items-center justify-between text-rose-600 font-medium">
                      <span>تخفیف کل فاکتور:</span>
                      <span className="font-mono">-{formatPrice(currInv.totalDiscount, settings?.currency || 'تومان')}</span>
                    </div>
                  )}

                  {currInv.taxAmount > 0 && (
                    <div className="flex items-center justify-between text-slate-600">
                      <span>مالیات ارزش افزوده ({toPersianDigits(currInv.taxRate)}٪):</span>
                      <span className="font-mono text-slate-800">+{formatPrice(currInv.taxAmount, settings?.currency || 'تومان')}</span>
                    </div>
                  )}

                  <div className="pt-2 border-t border-slate-200 flex items-center justify-between font-black text-slate-900 text-sm sm:text-base">
                    <span className="text-emerald-900">مبلغ نهایی قابل پرداخت:</span>
                    <span className="font-mono text-emerald-800">{formatPrice(currInv.finalTotal, settings?.currency || 'تومان')}</span>
                  </div>

                  {currInv.paidAmount > 0 && (
                    <div className="flex items-center justify-between text-emerald-700 font-bold pt-1">
                      <span>مبلغ دریافت شده:</span>
                      <span className="font-mono">{formatPrice(currInv.paidAmount, settings?.currency || 'تومان')}</span>
                    </div>
                  )}

                  {remainingDebt > 0 && (
                    <div className="flex items-center justify-between text-rose-700 font-black pt-1 bg-rose-50 -mx-2 p-2 rounded-xl border border-rose-200">
                      <span>مانده حساب / بدهی:</span>
                      <span className="font-mono">{formatPrice(remainingDebt, settings?.currency || 'تومان')}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* 5. Footer & Official Digital Seal */}
              <div className="pt-6 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="text-xs text-slate-500 text-center sm:text-right space-y-1">
                  {cleanInvoiceNotes(settings?.invoiceFooterText) && (
                    <p className="font-medium text-slate-700">{cleanInvoiceNotes(settings.invoiceFooterText)}</p>
                  )}
                  <p className="text-[11px] text-slate-400">
                    صادر شده توسط سامانه هوشمند فاکتور و انبارداری سپهر • تاریخ مشاهده: {toPersianDigits(new Date().toLocaleDateString('fa-IR'))}
                  </p>
                </div>

                {/* Digital Stamp Simulation */}
                <div className="w-36 h-20 rounded-2xl border-2 border-dashed border-emerald-400/80 bg-emerald-50/50 flex flex-col items-center justify-center p-2 text-center text-[10px] text-emerald-800 shadow-2xs rotate-[-2deg]">
                  <ShieldCheck className="w-5 h-5 text-emerald-600 mb-0.5" />
                  <span className="font-black text-emerald-950">تاییدیه رسمی الکترونیکی</span>
                  <span className="font-mono text-[9px] text-emerald-700 font-bold">VERIFIED #{toPersianDigits(currInv.invoiceNumber)}</span>
                </div>
              </div>
            </div>

            {/* Customer Statement Summary Banner & Direct Link on Invoice View */}
            {showCustomerStatement && (
              <div className="no-print bg-white rounded-3xl p-4 sm:p-5 border border-emerald-200 shadow-xs flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
                <div className="flex items-start sm:items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center shrink-0">
                    <ReceiptText className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-xs sm:text-sm font-black text-slate-900">
                        صورتحساب کامل و وضعیت کل حساب شما
                      </h3>
                      <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border ${
                        (customerLedger?.balance || 0) > 0
                          ? 'bg-rose-50 text-rose-700 border-rose-200'
                          : (customerLedger?.balance || 0) < 0
                          ? 'bg-blue-50 text-blue-700 border-blue-200'
                          : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      }`}>
                        {(customerLedger?.balance || 0) > 0
                          ? `بدهکار: ${formatPrice(customerLedger?.balance || 0, settings?.currency || 'تومان')}`
                          : (customerLedger?.balance || 0) < 0
                          ? `بستانکار: ${formatPrice(Math.abs(customerLedger?.balance || 0), settings?.currency || 'تومان')}`
                          : 'تسویه کامل (۰)'}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">
                      مجموع کل خریدها: <strong className="font-mono text-slate-800">{formatPrice(customerLedger?.totalDebit ?? customerLedger?.totalPurchases ?? 0, settings?.currency || 'تومان')}</strong>
                      {' • '}
                      مجموع پرداختی‌ها: <strong className="font-mono text-emerald-700">{formatPrice(customerLedger?.totalCredit ?? customerLedger?.totalPaid ?? 0, settings?.currency || 'تومان')}</strong>
                      {' • '}
                      تعداد کل تراکنش‌ها: <strong className="font-mono text-slate-800">{toPersianDigits(fullStatementEntries.length)} ردیف</strong>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('ledger');
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="w-full lg:w-auto min-h-[42px] px-4 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm shadow-emerald-600/20 transition-all cursor-pointer"
                  >
                    <ReceiptText className="w-4 h-4" />
                    <span>مشاهده صورتحساب کامل مشتری (با جستجو و فیلتر)</span>
                  </button>
                </div>
              </div>
            )}

            {/* Bottom Customer Utility Actions */}
            <div className="no-print grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              {storePhone && (
                <a
                  href={`tel:${cleanPhone}`}
                  className="min-h-[44px] flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white py-3 px-4 rounded-2xl font-bold text-xs sm:text-sm shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
                >
                  <Phone className="w-4 h-4" />
                  <span>تماس با فروشگاه ({toPersianDigits(storePhone)})</span>
                </a>
              )}

              {allowPdf && (
                <button
                  type="button"
                  onClick={handleDownloadPdf}
                  disabled={isExportingPdf}
                  className="min-h-[44px] flex items-center justify-center gap-2 bg-white hover:bg-slate-50 active:scale-98 text-slate-800 border border-slate-300 py-3 px-4 rounded-2xl font-bold text-xs sm:text-sm shadow-2xs transition-all cursor-pointer"
                >
                  <Download className="w-4 h-4 text-slate-600" />
                  <span>دانلود فایل PDF فاکتور</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleShareNative}
                className="min-h-[44px] flex items-center justify-center gap-2 bg-sky-600 hover:bg-sky-700 active:scale-98 text-white py-3 px-4 rounded-2xl font-bold text-xs sm:text-sm shadow-md shadow-sky-600/20 transition-all cursor-pointer"
              >
                <Share2 className="w-4 h-4" />
                <span>اشتراک‌گذاری این فاکتور</span>
              </button>
            </div>
          </div>
        )}

        {/* TAB 2: ALL CUSTOMER INVOICES */}
        {activeTab === 'invoices' && (
          <div className="space-y-4">
            {/* Header & Filters */}
            <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                    <span>آرشیو تمام فاکتورهای شما ({toPersianDigits(customerInvoices.length)} فاکتور)</span>
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    شما می‌توانید با لمس هر فاکتور، متن کامل و جزئیات آن را فوراً مشاهده نمایید.
                  </p>
                </div>

                {/* Search Bar */}
                <div className="relative w-full sm:w-64">
                  <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="جستجو در فاکتورها..."
                    value={searchInvoices}
                    onChange={(e) => setSearchInvoices(e.target.value)}
                    className="w-full pl-3 pr-9 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:border-emerald-500 focus:bg-white transition-colors"
                  />
                  {searchInvoices && (
                    <button
                      type="button"
                      onClick={() => setSearchInvoices('')}
                      className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Status Tabs */}
              <div className="flex items-center gap-1.5 flex-wrap pt-2 border-t border-slate-100 text-xs">
                <button
                  type="button"
                  onClick={() => setFilterInvoiceStatus('all')}
                  className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                    filterInvoiceStatus === 'all'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  همه ({toPersianDigits(customerInvoices.length)})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterInvoiceStatus('paid')}
                  className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                    filterInvoiceStatus === 'paid'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                  }`}
                >
                  تسویه شده
                </button>
                <button
                  type="button"
                  onClick={() => setFilterInvoiceStatus('unpaid')}
                  className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                    filterInvoiceStatus === 'unpaid'
                      ? 'bg-rose-600 text-white shadow-xs'
                      : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                  }`}
                >
                  پرداخت نشده / نسیه
                </button>
                <button
                  type="button"
                  onClick={() => setFilterInvoiceStatus('partial')}
                  className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                    filterInvoiceStatus === 'partial'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                  }`}
                >
                  پرداخت بخشی
                </button>
                <button
                  type="button"
                  onClick={() => setFilterInvoiceStatus('proforma')}
                  className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                    filterInvoiceStatus === 'proforma'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
                  }`}
                >
                  پیش‌فاکتورها
                </button>
              </div>
            </div>

            {/* Invoices List Grid */}
            {filteredInvoices.length === 0 ? (
              <div className="bg-white rounded-2xl p-12 text-center border border-slate-200">
                <Inbox className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <h3 className="text-sm font-bold text-slate-700 mb-1">فاکتوری با این مشخصات یافت نشد</h3>
                <p className="text-xs text-slate-400">عبارت جستجو یا فیلتر وضعیت را بررسی فرمایید.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {filteredInvoices.map((inv) => {
                  const isCurrent = (displayedInvoice?.id === inv.id);
                  const isInvPaid = inv.paymentStatus === 'paid';
                  const isInvPartial = inv.paymentStatus === 'partial';
                  const invRemDebt = Math.max(0, inv.finalTotal - (isInvPaid ? inv.finalTotal : (inv.paidAmount || 0)));

                  return (
                    <div
                      key={inv.id}
                      onClick={() => {
                        setSelectedInvoice(inv);
                        setActiveTab('current');
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      className={`bg-white rounded-2xl p-4 border transition-all cursor-pointer hover:shadow-md hover:border-emerald-400/80 relative space-y-3 ${
                        isCurrent ? 'ring-2 ring-emerald-500 border-emerald-500' : 'border-slate-200'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-black text-slate-900 text-sm">
                              {inv.isProforma ? 'پیش‌فاکتور' : 'فاکتور فروش'} {toPersianDigits(inv.invoiceNumber)}
                            </span>
                            {isCurrent && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                                در حال مشاهده
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-400 mt-0.5">
                            تاریخ: {toPersianDigits(inv.date)} • {toPersianDigits((inv.items || []).length)} قلم کالا
                          </p>
                        </div>

                        <span className={`text-[11px] font-bold px-2.5 py-1 rounded-xl shrink-0 ${
                          isInvPaid ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                          isInvPartial ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                          inv.isProforma ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' :
                          'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}>
                          {isInvPaid ? 'تسویه شده' :
                           isInvPartial ? 'بخشی پرداخت‌شده' :
                           inv.isProforma ? 'پیش‌فاکتور' : 'پرداخت نشده'}
                        </span>
                      </div>

                      {/* Items Preview */}
                      <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-xs text-slate-600 line-clamp-1">
                        {(inv.items || []).map((it) => it.productName).join(' ، ') || 'اقلام کالا'}
                      </div>

                      {/* Financial Figures & Action */}
                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                        <div>
                          <span className="text-[11px] text-slate-400 block">مبلغ نهایی:</span>
                          <span className="font-bold font-mono text-slate-900 text-sm">
                            {formatPrice(inv.finalTotal, settings?.currency || 'تومان')}
                          </span>
                        </div>

                        {invRemDebt > 0 && !inv.isProforma && (
                          <div className="text-left">
                            <span className="text-[11px] text-rose-500 block">مانده بدهی:</span>
                            <span className="font-bold font-mono text-rose-700 text-xs">
                              {formatPrice(invRemDebt, settings?.currency || 'تومان')}
                            </span>
                          </div>
                        )}

                        <span className="inline-flex items-center gap-1 text-emerald-700 font-bold text-xs bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-xl transition-colors">
                          <Eye className="w-3.5 h-3.5" />
                          <span>مشاهده</span>
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: DEPOSITS & PAYMENTS */}
        {activeTab === 'deposits' && (
          <div className="space-y-4">
            {/* Summary Banner */}
            <div className="bg-gradient-to-r from-emerald-600 to-teal-700 text-white rounded-3xl p-5 sm:p-6 shadow-md">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <span className="text-emerald-100 text-xs block mb-1">مجموع پرداختی‌ها و واریزهای تایید شده:</span>
                  <h3 className="text-2xl sm:text-3xl font-black font-mono">
                    {formatPrice(totalDepositsAmount, settings?.currency || 'تومان')}
                  </h3>
                  <p className="text-xs text-emerald-100/90 mt-1">
                    تعداد کل اسناد پرداختی: {toPersianDigits(deposits.length)} سند مالی
                  </p>
                </div>
                <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center shrink-0 border border-white/20">
                  <Wallet className="w-7 h-7 text-emerald-200" />
                </div>
              </div>
            </div>

            {/* Deposits List */}
            {deposits.length === 0 ? (
              <div className="bg-white rounded-2xl p-12 text-center border border-slate-200">
                <DollarSign className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <h3 className="text-sm font-bold text-slate-700 mb-1">هیچ واریزی یا پرداختی ثبت نشده است</h3>
                <p className="text-xs text-slate-400">به محض ثبت واریز وجه یا چک، سوابق در این قسمت نمایش داده خواهد شد.</p>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
                <div className="p-4 border-b border-slate-100 font-bold text-xs text-slate-700 flex items-center justify-between">
                  <span>ریز واریزها و فیش‌های بانکی ثبت‌شده</span>
                  <span className="text-slate-400 font-normal">{toPersianDigits(deposits.length)} ردیف</span>
                </div>

                <div className="divide-y divide-slate-100">
                  {deposits.map((dep, idx) => (
                    <div key={dep.id || idx} className="p-4 hover:bg-slate-50/70 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                      <div className="flex items-start gap-3">
                        <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5 border border-emerald-200">
                          <CheckCheck className="w-4 h-4" />
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-slate-900 text-sm">
                              {dep.title || 'واریز به حساب'}
                            </span>
                            {dep.invoiceNumber && (
                              <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-mono">
                                بابت فاکتور: {toPersianDigits(dep.invoiceNumber)}
                              </span>
                            )}
                          </div>
                          <div className="text-slate-500 text-[11px] flex items-center gap-3 flex-wrap">
                            <span>تاریخ: {toPersianDigits(dep.date)}</span>
                            {dep.trackingNumber && (
                              <span>شماره پیگیری/ارجاع: <strong className="font-mono text-slate-700">{toPersianDigits(dep.trackingNumber)}</strong></span>
                            )}
                            {dep.bankName && (
                              <span>بانک: {dep.bankName}</span>
                            )}
                            {dep.chequeDueDate && (
                              <span className="text-amber-800">سررسید چک: {toPersianDigits(dep.chequeDueDate)}</span>
                            )}
                          </div>
                          {dep.notes && (
                            <p className="text-[11px] text-slate-600 bg-slate-50 p-1.5 rounded-lg border border-slate-100">
                              توضیحات: {dep.notes}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="text-right sm:text-left self-end sm:self-auto shrink-0">
                        <span className="text-[11px] text-slate-400 block">مبلغ واریزی:</span>
                        <span className="font-black font-mono text-emerald-700 text-sm sm:text-base">
                          +{formatPrice(dep.amount, settings?.currency || 'تومان')}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 4: REMITTANCES & DELIVERY SLIPS */}
        {activeTab === 'remittances' && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Truck className="w-5 h-5 text-indigo-600" />
                <span>حواله‌های خروج انبار و بارگیری ({toPersianDigits(remittances.length)} حواله)</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                مشخصات کامل ارسال محموله‌ها، رانندگان حامل بار، پلاک خودرو و وضعیت تحویل فیزیکی اقلام.
              </p>
            </div>

            {remittances.length === 0 ? (
              <div className="bg-white rounded-2xl p-12 text-center border border-slate-200">
                <Truck className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <h3 className="text-sm font-bold text-slate-700 mb-1">هیچ حواله خروجی برای شما صادر نشده است</h3>
                <p className="text-xs text-slate-400">به محض بارگیری اقلام فاکتور در انبار، حواله خروج رسمی در این بخش درج می‌گردد.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {remittances.map((rem) => {
                  const isDelivered = rem.status === 'delivered';
                  return (
                    <div
                      key={rem.id}
                      className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs space-y-3 hover:border-indigo-300 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-slate-900 text-sm">
                              {rem.remittanceNumber}
                            </span>
                            {rem.invoiceNumber && (
                              <span className="text-[10px] bg-slate-100 text-slate-700 font-mono px-2 py-0.5 rounded">
                                فاکتور {toPersianDigits(rem.invoiceNumber)}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-400 mt-0.5">
                            تاریخ خروج / تحویل: {toPersianDigits(rem.date)}
                          </p>
                        </div>

                        <span className={`text-[11px] font-bold px-2.5 py-1 rounded-xl ${
                          isDelivered
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-blue-50 text-blue-700 border border-blue-200'
                        }`}>
                          {rem.statusTitle}
                        </span>
                      </div>

                      {/* Carrier & Receiver Info */}
                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-1.5 text-xs text-slate-600">
                        {rem.vehicleInfo && (
                          <div className="flex items-center gap-1.5">
                            <Truck className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span>مشخصات خودرو و پلاک: <strong className="text-slate-800">{rem.vehicleInfo}</strong></span>
                          </div>
                        )}
                        {rem.receiverName && (
                          <div className="flex items-center gap-1.5">
                            <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span>تحویل‌گیرنده / راننده: <strong className="text-slate-800">{rem.receiverName}</strong></span>
                            {rem.receiverPhone && (
                              <span className="text-slate-500 font-mono">({toPersianDigits(rem.receiverPhone)})</span>
                            )}
                          </div>
                        )}
                        {rem.deliveredBy && (
                          <p className="text-[11px] text-slate-400">
                            انباردار تاییدکننده: {rem.deliveredBy}
                          </p>
                        )}
                      </div>

                      {/* Items Summary in Remittance */}
                      {rem.items && rem.items.length > 0 && (
                        <div className="space-y-1 pt-1">
                          <span className="text-[11px] font-bold text-slate-500 block">اقلام تحویلی در این حواله:</span>
                          <div className="divide-y divide-slate-100 text-xs">
                            {rem.items.map((it, iIdx) => (
                              <div key={iIdx} className="py-1 flex items-center justify-between text-slate-700">
                                <span>{it.productName}</span>
                                <span className="font-bold font-mono text-slate-900">
                                  {toPersianDigits(it.quantity)} {it.unit}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 5: CUSTOMER STATEMENT & LEDGER (WITH SEARCH, FILTERS & PDF) */}
        {activeTab === 'ledger' && (
          <div className="space-y-4">
            {/* Header & Statement Export Actions */}
            <div className="bg-white rounded-3xl p-4 sm:p-6 border border-slate-200 shadow-2xs space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
                      <ReceiptText className="w-5 h-5 text-emerald-600" />
                      <span>صورتحساب کامل و ریز گردش حساب مشتری</span>
                    </h2>
                    {isStatementFiltered && (
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200 flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-amber-600" />
                        <span>محاسبه بر اساس نتایج فیلتر و جستجو</span>
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    ریز کامل فاکتورها، واریزی‌ها و مانده لحظه‌ای حساب <strong className="text-slate-700">{invoice.customerName}</strong> نزد {settings?.storeName || 'فروشگاه سپهر'}
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={handlePrintStatement}
                    className="min-h-[38px] px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center gap-1.5 border border-slate-200 transition-colors cursor-pointer"
                  >
                    <Printer className="w-4 h-4 text-slate-600" />
                    <span>چاپ صورتحساب</span>
                  </button>
                  {allowPdf && (
                    <button
                      type="button"
                      onClick={handleDownloadStatementPdf}
                      disabled={isExportingPdf}
                      className="min-h-[38px] px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
                    >
                      <Download className="w-4 h-4" />
                      <span>{isStatementFiltered ? 'دانلود PDF نتایج فیلتر شده' : 'دانلود PDF صورتحساب'}</span>
                    </button>
                  )}
                </div>
              </div>

              {/* 4 Dynamic KPI Cards (Recalculated on Search/Filter) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="bg-rose-50/60 p-3.5 rounded-2xl border border-rose-200/80">
                  <span className="text-[11px] font-bold text-rose-800 block mb-1">
                    {isStatementFiltered ? 'جمع بدهکار (فیلتر شده):' : 'مجموع کل بدهکار (خریدها):'}
                  </span>
                  <div className="text-base sm:text-lg font-black font-mono text-rose-900">
                    {formatPrice(activeStatementTotals.totalDebit, settings?.currency || 'تومان')}
                  </div>
                  <span className="text-[10px] text-rose-600 mt-1 block">
                    فاکتورهای فروش، خدمات و بدهی‌ها
                  </span>
                </div>

                <div className="bg-emerald-50/70 p-3.5 rounded-2xl border border-emerald-200/80">
                  <span className="text-[11px] font-bold text-emerald-800 block mb-1">
                    {isStatementFiltered ? 'جمع بستانکار (فیلتر شده):' : 'مجموع کل بستانکار (پرداختی‌ها):'}
                  </span>
                  <div className="text-base sm:text-lg font-black font-mono text-emerald-900">
                    {formatPrice(activeStatementTotals.totalCredit, settings?.currency || 'تومان')}
                  </div>
                  <span className="text-[10px] text-emerald-700 mt-1 block">
                    واریزی‌ها، نقد، کارتخوان و چک‌ها
                  </span>
                </div>

                <div className={`p-3.5 rounded-2xl border ${
                  activeStatementTotals.netBalance > 0
                    ? 'bg-rose-100/70 border-rose-300 text-rose-950'
                    : activeStatementTotals.netBalance < 0
                    ? 'bg-blue-50/80 border-blue-200 text-blue-900'
                    : 'bg-slate-100 border-slate-200 text-slate-800'
                }`}>
                  <span className="text-[11px] font-bold block mb-1">
                    {isStatementFiltered ? 'تراز خالص نتایج فیلتر:' : 'مانده نهایی حساب:'}
                  </span>
                  <div className="text-base sm:text-lg font-black font-mono">
                    {activeStatementTotals.netBalance === 0
                      ? 'تسویه کامل (۰)'
                      : formatPrice(Math.abs(activeStatementTotals.netBalance), settings?.currency || 'تومان')}
                  </div>
                  <span className="text-[10px] font-bold mt-1 block">
                    {activeStatementTotals.netBalance > 0
                      ? 'وضعیت: بدهکار به فروشگاه'
                      : activeStatementTotals.netBalance < 0
                      ? 'وضعیت: بستانکار از فروشگاه'
                      : 'حساب کاملاً تسویه است'}
                  </span>
                </div>

                <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                  <span className="text-[11px] font-bold text-slate-600 block mb-1">
                    تعداد ردیف‌های صورتحساب:
                  </span>
                  <div className="text-base sm:text-lg font-black font-mono text-slate-900">
                    {toPersianDigits(activeStatementTotals.entriesCount)}
                    <span className="text-xs font-normal text-slate-500 mr-1">
                      از {toPersianDigits(activeStatementTotals.totalAllCount)} تراکنش
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-500 mt-1 block">
                    شامل کلیه اسناد مالی ثبت‌شده
                  </span>
                </div>
              </div>

              {/* Search & Multi-Filter Control Panel */}
              <div className="bg-slate-50/90 rounded-2xl p-3.5 sm:p-4 border border-slate-200/90 space-y-3">
                {/* Row 1: Search Input + Sort + View Mode */}
                <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2.5">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={statementSearch}
                      onChange={(e) => setStatementSearch(e.target.value)}
                      placeholder="جستجو در صورتحساب (شماره سند، نام کالا/خدمات، کد رهگیری، نام بانک، مبلغ، تاریخ یا توضیحات)..."
                      className="w-full pr-10 pl-9 py-2.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15 transition-all"
                    />
                    {statementSearch && (
                      <button
                        type="button"
                        onClick={() => setStatementSearch('')}
                        className="absolute left-2.5 top-1/2 -translate-y-1/2 p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
                        title="پاک کردن جستجو"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {/* Sort Order Button */}
                    <button
                      type="button"
                      onClick={() => setStatementSortOrder((prev) => (prev === 'desc' ? 'asc' : 'desc'))}
                      className="min-h-[38px] px-3 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                      title="تغییر ترتیب نمایش تاریخ"
                    >
                      <ArrowUpDown className="w-3.5 h-3.5 text-emerald-600" />
                      <span>{statementSortOrder === 'desc' ? 'جدیدترین به قدیمی‌ترین' : 'قدیمی‌ترین به جدیدترین'}</span>
                    </button>

                    {/* View Mode Switcher */}
                    <div className="flex items-center bg-white border border-slate-300 rounded-xl p-0.5">
                      <button
                        type="button"
                        onClick={() => setStatementViewMode('table')}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-all cursor-pointer ${
                          statementViewMode === 'table'
                            ? 'bg-emerald-600 text-white shadow-2xs'
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                        title="نمای جدولی"
                      >
                        <LayoutList className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">جدول</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setStatementViewMode('cards')}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-all cursor-pointer ${
                          statementViewMode === 'cards'
                            ? 'bg-emerald-600 text-white shadow-2xs'
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                        title="نمای کارتی"
                      >
                        <LayoutGrid className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">کارتی</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Row 2: Transaction Type Filter Chips + Payment Method & Date Filters */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 pt-1">
                  {/* Type Filter Chips */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[11px] font-bold text-slate-500 flex items-center gap-1 ml-1">
                      <Filter className="w-3.5 h-3.5 text-slate-400" />
                      <span>نوع تراکنش:</span>
                    </span>
                    {([
                      { id: 'all', label: 'همه ردیف‌ها' },
                      { id: 'debit', label: 'بدهکار (خرید/بدهی)' },
                      { id: 'credit', label: 'بستانکار (واریزی‌ها)' },
                      { id: 'invoice', label: 'فقط فاکتورها' },
                      { id: 'deposit', label: 'فقط پرداخت‌ها' },
                    ] as const).map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setStatementTypeFilter(tab.id)}
                        className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold transition-all cursor-pointer border ${
                          statementTypeFilter === tab.id
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  {/* Payment Method & Date Range Selects */}
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={statementPaymentFilter}
                      onChange={(e) => setStatementPaymentFilter(e.target.value as any)}
                      className="bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-700 focus:outline-none focus:border-emerald-500"
                    >
                      <option value="all">همه روش‌های پرداخت</option>
                      <option value="cash">نقدی</option>
                      <option value="transfer">واریز بانکی / کارت به کارت</option>
                      <option value="pos">کارتخوان (POS)</option>
                      <option value="cheque">چک صیادی / مدت‌دار</option>
                    </select>

                    <select
                      value={statementDateFilter}
                      onChange={(e) => setStatementDateFilter(e.target.value as any)}
                      className="bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-700 focus:outline-none focus:border-emerald-500"
                    >
                      <option value="all">همه زمان‌ها</option>
                      <option value="this_month">ماه جاری</option>
                      <option value="3months">۳ ماه اخیر</option>
                      <option value="this_year">سال جاری</option>
                      <option value="custom">بازه تاریخ دلخواه...</option>
                    </select>

                    {isStatementFiltered && (
                      <button
                        type="button"
                        onClick={resetStatementFilters}
                        className="px-2.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>حذف فیلترها</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Optional Custom Date Range Inputs */}
                {statementDateFilter === 'custom' && (
                  <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-200/80 text-xs">
                    <span className="font-bold text-slate-600 flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                      <span>بازه تاریخ شمسی:</span>
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-500">از:</span>
                      <input
                        type="text"
                        dir="ltr"
                        value={statementDateFrom}
                        onChange={(e) => setStatementDateFrom(e.target.value)}
                        placeholder="1403/01/01"
                        className="w-28 px-2.5 py-1 bg-white border border-slate-300 rounded-lg font-mono text-xs text-center focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-500">تا:</span>
                      <input
                        type="text"
                        dir="ltr"
                        value={statementDateTo}
                        onChange={(e) => setStatementDateTo(e.target.value)}
                        placeholder="1403/12/29"
                        className="w-28 px-2.5 py-1 bg-white border border-slate-300 rounded-lg font-mono text-xs text-center focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Statement Entries Display (Table or Cards) */}
              {filteredStatementEntries.length === 0 ? (
                <div className="bg-slate-50 rounded-2xl p-8 text-center border border-slate-200/80">
                  <Inbox className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm font-bold text-slate-700">هیچ تراکنشی مطابق با جستجو یا فیلتر شما یافت نشد.</p>
                  {isStatementFiltered && (
                    <button
                      type="button"
                      onClick={resetStatementFilters}
                      className="mt-3 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                    >
                      نمایش تمام تراکنش‌های صورتحساب
                    </button>
                  )}
                </div>
              ) : statementViewMode === 'table' ? (
                <div className="overflow-x-auto border border-slate-200 rounded-2xl">
                  <table className="w-full text-right border-collapse">
                    <thead>
                      <tr className="bg-slate-900 text-white text-[11px] font-bold">
                        <th className="py-3 px-2.5 border-l border-slate-700 text-center w-10">#</th>
                        <th className="py-3 px-3 border-l border-slate-700 whitespace-nowrap">تاریخ</th>
                        <th className="py-3 px-3 border-l border-slate-700 whitespace-nowrap">نوع و شماره سند</th>
                        <th className="py-3 px-3 border-l border-slate-700 min-w-[200px]">شرح تراکنش / اقلام / جزئیات پرداخت</th>
                        <th className="py-3 px-3 border-l border-slate-700 text-left whitespace-nowrap bg-rose-950/40">بدهکار ({settings?.currency || 'تومان'})</th>
                        <th className="py-3 px-3 border-l border-slate-700 text-left whitespace-nowrap bg-emerald-950/40">بستانکار ({settings?.currency || 'تومان'})</th>
                        <th className="py-3 px-3 text-left whitespace-nowrap">مانده پس از ردیف</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-xs">
                      {filteredStatementEntries.map((entry, idx) => {
                        const matchedInvoice = entry.invoiceId
                          ? customerInvoices.find((inv) => inv.id === entry.invoiceId)
                          : entry.documentType === 'invoice'
                          ? customerInvoices.find((inv) => inv.invoiceNumber === entry.documentNumber)
                          : undefined;

                        return (
                          <tr
                            key={entry.id || idx}
                            className="hover:bg-slate-50/90 transition-colors"
                          >
                            <td className="py-3 px-2.5 text-center font-mono text-slate-400 border-l border-slate-100">
                              {toPersianDigits(idx + 1)}
                            </td>
                            <td className="py-3 px-3 font-mono font-bold text-slate-700 whitespace-nowrap border-l border-slate-100">
                              {toPersianDigits(entry.date)}
                            </td>
                            <td className="py-3 px-3 border-l border-slate-100 whitespace-nowrap">
                              <div className="flex flex-col gap-1">
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold w-fit ${
                                  entry.debit > 0
                                    ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                    : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                }`}>
                                  {entry.documentTypeLabel}
                                </span>
                                <span className="font-mono text-[11px] font-bold text-slate-800">
                                  سند: {toPersianDigits(entry.documentNumber)}
                                </span>
                              </div>
                            </td>
                            <td className="py-3 px-3 border-l border-slate-100">
                              <div className="space-y-1">
                                <div className="font-bold text-slate-800 leading-relaxed">
                                  {entry.description}
                                </div>
                                {entry.itemsSummary && (
                                  <div className="text-[11px] text-slate-500 bg-slate-50 px-2 py-1 rounded-lg border border-slate-200/70">
                                    <span className="font-semibold text-slate-600">اقلام: </span>
                                    {toPersianDigits(entry.itemsSummary)}
                                  </div>
                                )}
                                {(entry.paymentMethod || entry.trackingNumber || entry.bankName || entry.chequeDueDate) && (
                                  <div className="flex items-center gap-2 flex-wrap text-[11px] text-slate-600">
                                    {entry.paymentMethod && (
                                      <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-medium">
                                        روش: {entry.paymentMethod}
                                      </span>
                                    )}
                                    {entry.trackingNumber && (
                                      <span className="font-mono bg-slate-100 px-2 py-0.5 rounded-md">
                                        رهگیری/چک: {toPersianDigits(entry.trackingNumber)}
                                      </span>
                                    )}
                                    {entry.bankName && (
                                      <span className="bg-slate-100 px-2 py-0.5 rounded-md">
                                        بانک: {entry.bankName}
                                      </span>
                                    )}
                                    {entry.chequeDueDate && (
                                      <span className="font-mono bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-md">
                                        سررسید: {toPersianDigits(entry.chequeDueDate)}
                                      </span>
                                    )}
                                  </div>
                                )}
                                {entry.notes && (
                                  <p className="text-[11px] text-slate-500 italic">
                                    توضیحات: {entry.notes}
                                  </p>
                                )}
                                {matchedInvoice && (
                                  <button
                                    type="button"
                                    onClick={() => handleSwitchInvoice(matchedInvoice)}
                                    className="mt-1 inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1 rounded-lg border border-emerald-200 transition-colors cursor-pointer"
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                    <span>مشاهده کامل این فاکتور</span>
                                  </button>
                                )}
                              </div>
                            </td>
                            <td className="py-3 px-3 font-mono font-bold text-left whitespace-nowrap border-l border-slate-100 bg-rose-50/20 text-rose-700">
                              {entry.debit > 0 ? toPersianDigits(entry.debit.toLocaleString()) : '—'}
                            </td>
                            <td className="py-3 px-3 font-mono font-bold text-left whitespace-nowrap border-l border-slate-100 bg-emerald-50/20 text-emerald-700">
                              {entry.credit > 0 ? toPersianDigits(entry.credit.toLocaleString()) : '—'}
                            </td>
                            <td className="py-3 px-3 font-mono font-black text-left whitespace-nowrap">
                              <div className="flex flex-col items-end gap-0.5">
                                <span className={
                                  entry.balance > 0
                                    ? 'text-rose-700'
                                    : entry.balance < 0
                                    ? 'text-blue-700'
                                    : 'text-emerald-700'
                                }>
                                  {toPersianDigits(Math.abs(entry.balance).toLocaleString())}
                                </span>
                                <span className={`text-[10px] px-1.5 py-0.2 rounded font-bold ${
                                  entry.balance > 0
                                    ? 'bg-rose-100 text-rose-800'
                                    : entry.balance < 0
                                    ? 'bg-blue-100 text-blue-800'
                                    : 'bg-emerald-100 text-emerald-800'
                                }`}>
                                  {entry.balance > 0 ? 'بدهکار' : entry.balance < 0 ? 'بستانکار' : 'تسویه'}
                                </span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-900 text-white font-black text-xs">
                        <td colSpan={4} className="py-3.5 px-4 text-left border-l border-slate-700">
                          {isStatementFiltered
                            ? `جمع کل ردیف‌های فیلتر شده (${toPersianDigits(filteredStatementEntries.length)} ردیف):`
                            : `جمع کل صورتحساب (${toPersianDigits(filteredStatementEntries.length)} ردیف):`}
                        </td>
                        <td className="py-3.5 px-3 font-mono text-left text-rose-300 border-l border-slate-700 whitespace-nowrap">
                          {toPersianDigits(activeStatementTotals.totalDebit.toLocaleString())}
                        </td>
                        <td className="py-3.5 px-3 font-mono text-left text-emerald-300 border-l border-slate-700 whitespace-nowrap">
                          {toPersianDigits(activeStatementTotals.totalCredit.toLocaleString())}
                        </td>
                        <td className="py-3.5 px-3 font-mono text-left whitespace-nowrap">
                          <span className={
                            activeStatementTotals.netBalance > 0
                              ? 'text-rose-300'
                              : activeStatementTotals.netBalance < 0
                              ? 'text-sky-300'
                              : 'text-emerald-300'
                          }>
                            {toPersianDigits(Math.abs(activeStatementTotals.netBalance).toLocaleString())}{' '}
                            ({activeStatementTotals.netBalance > 0 ? 'بدهکار' : activeStatementTotals.netBalance < 0 ? 'بستانکار' : 'تسویه'})
                          </span>
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              ) : (
                /* Card View Mode for Mobile / Compact Browsing */
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {filteredStatementEntries.map((entry, idx) => {
                    const matchedInvoice = entry.invoiceId
                      ? customerInvoices.find((inv) => inv.id === entry.invoiceId)
                      : entry.documentType === 'invoice'
                      ? customerInvoices.find((inv) => inv.invoiceNumber === entry.documentNumber)
                      : undefined;

                    return (
                      <div
                        key={entry.id || idx}
                        className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs space-y-3 flex flex-col justify-between"
                      >
                        <div className="space-y-2">
                          <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2">
                            <div className="flex items-center gap-1.5">
                              <span className="w-6 h-6 rounded-lg bg-slate-100 text-slate-600 font-mono text-[11px] font-bold flex items-center justify-center">
                                {toPersianDigits(idx + 1)}
                              </span>
                              <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border ${
                                entry.debit > 0
                                  ? 'bg-rose-50 text-rose-700 border-rose-200'
                                  : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              }`}>
                                {entry.documentTypeLabel}
                              </span>
                              <span className="font-mono text-xs font-bold text-slate-800">
                                #{toPersianDigits(entry.documentNumber)}
                              </span>
                            </div>
                            <span className="font-mono text-xs font-bold text-slate-600">
                              {toPersianDigits(entry.date)}
                            </span>
                          </div>

                          <p className="text-xs font-bold text-slate-800 leading-relaxed">
                            {entry.description}
                          </p>

                          {entry.itemsSummary && (
                            <p className="text-[11px] text-slate-500 bg-slate-50 p-2 rounded-xl border border-slate-200/60">
                              <strong className="text-slate-700">اقلام: </strong>
                              {toPersianDigits(entry.itemsSummary)}
                            </p>
                          )}

                          {(entry.paymentMethod || entry.trackingNumber || entry.bankName) && (
                            <div className="flex items-center gap-1.5 flex-wrap text-[11px] text-slate-600">
                              {entry.paymentMethod && (
                                <span className="bg-slate-100 px-2 py-0.5 rounded-md">روش: {entry.paymentMethod}</span>
                              )}
                              {entry.trackingNumber && (
                                <span className="bg-slate-100 px-2 py-0.5 rounded-md font-mono">رهگیری: {toPersianDigits(entry.trackingNumber)}</span>
                              )}
                              {entry.bankName && (
                                <span className="bg-slate-100 px-2 py-0.5 rounded-md">بانک: {entry.bankName}</span>
                              )}
                            </div>
                          )}
                        </div>

                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                          <div>
                            {entry.debit > 0 ? (
                              <div className="text-xs font-black font-mono text-rose-700">
                                بدهکار: {formatPrice(entry.debit, settings?.currency || 'تومان')}
                              </div>
                            ) : (
                              <div className="text-xs font-black font-mono text-emerald-700">
                                بستانکار: {formatPrice(entry.credit, settings?.currency || 'تومان')}
                              </div>
                            )}
                            <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                              مانده پس از تراکنش:{' '}
                              <strong className={entry.balance > 0 ? 'text-rose-700' : entry.balance < 0 ? 'text-blue-700' : 'text-emerald-700'}>
                                {formatPrice(Math.abs(entry.balance), settings?.currency || 'تومان')} ({entry.balance > 0 ? 'بدهکار' : entry.balance < 0 ? 'بستانکار' : 'تسویه'})
                              </strong>
                            </div>
                          </div>

                          {matchedInvoice && (
                            <button
                              type="button"
                              onClick={() => handleSwitchInvoice(matchedInvoice)}
                              className="px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-[11px] font-bold flex items-center gap-1 shrink-0 cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>مشاهده فاکتور</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Amount in Persian Words + Customer Profile Summary */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 pt-2">
                <div className="bg-emerald-50/60 p-4 rounded-2xl border border-emerald-200 flex flex-col justify-center space-y-1">
                  <span className="text-[11px] font-bold text-emerald-800">
                    {isStatementFiltered ? 'مانده خالص نتایج فیلتر شده به حروف:' : 'مانده نهایی حساب به حروف:'}
                  </span>
                  <p className="text-xs sm:text-sm font-black text-emerald-950">
                    {activeStatementTotals.netBalance === 0
                      ? 'صفر — حساب کاملاً تسویه می‌باشد'
                      : `${numberToPersianWords(Math.abs(activeStatementTotals.netBalance))} ${settings?.currency || 'تومان'} (${
                          activeStatementTotals.netBalance > 0 ? 'بدهکار' : 'بستانکار'
                        })`}
                  </p>
                </div>

                <div className="bg-slate-50/70 p-4 rounded-2xl border border-slate-200 space-y-1.5 text-xs">
                  <h4 className="font-bold text-slate-800 flex items-center gap-1.5">
                    <User className="w-4 h-4 text-slate-600" />
                    <span>مشخصات صاحب حساب</span>
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-slate-600">
                    <p><strong>نام مشتری:</strong> {invoice.customerName}</p>
                    {invoice.customerPhone && <p><strong>شماره تماس:</strong> <span className="font-mono">{toPersianDigits(invoice.customerPhone)}</span></p>}
                    {invoice.customerNationalId && <p><strong>شناسه / کدملی:</strong> <span className="font-mono">{toPersianDigits(invoice.customerNationalId)}</span></p>}
                    {invoice.customerAddress && <p className="sm:col-span-2"><strong>آدرس:</strong> {invoice.customerAddress}</p>}
                  </div>
                </div>
              </div>
            </div>

            {/* Off-screen Printable / PDF Export Container for Customer Statement */}
            <div className="fixed -left-[9999px] top-0 pointer-events-none overflow-hidden" aria-hidden="true">
              <div
                id="printable-public-customer-statement-pdf"
                dir="rtl"
                className="w-[794px] bg-white text-slate-900 p-8 font-['Vazirmatn'] space-y-5"
              >
                {/* PDF Header */}
                <div className="border-b-2 border-slate-800 pb-4 flex items-center justify-between">
                  <div>
                    <h1 className="text-xl font-black text-slate-900">
                      {settings?.storeName || 'فروشگاه و بازرگانی سپهر'}
                    </h1>
                    <p className="text-xs font-bold text-slate-600 mt-1">
                      صورتحساب رسمی و گردش حساب مشتری {isStatementFiltered ? '(بر اساس فیلتر انتخابی)' : '(کامل)'}
                    </p>
                  </div>
                  <div className="text-left text-xs space-y-1">
                    <div><strong>مشتری:</strong> {invoice.customerName}</div>
                    {invoice.customerPhone && <div><strong>تلفن:</strong> {toPersianDigits(invoice.customerPhone)}</div>}
                    <div><strong>تاریخ گزارش:</strong> {toPersianDigits(getCurrentJalaliDate())}</div>
                  </div>
                </div>

                {/* Active Filter Summary in PDF if filtered */}
                {isStatementFiltered && (
                  <div className="bg-amber-50 border border-amber-300 rounded-xl p-2.5 text-[11px] text-amber-900 flex items-center justify-between">
                    <div>
                      <strong>فیلترهای اعمال‌شده: </strong>
                      {statementSearch && <span>جستجو: «{statementSearch}» | </span>}
                      {statementTypeFilter !== 'all' && <span>نوع تراکنش فیلتر شده | </span>}
                      {statementPaymentFilter !== 'all' && <span>روش پرداخت فیلتر شده | </span>}
                      {statementDateFilter !== 'all' && <span>بازه زمانی فیلتر شده</span>}
                    </div>
                    <span className="font-bold">
                      تعداد نتایج: {toPersianDigits(filteredStatementEntries.length)} از {toPersianDigits(fullStatementEntries.length)} ردیف
                    </span>
                  </div>
                )}

                {/* PDF Summary Metrics */}
                <div className="grid grid-cols-3 gap-3 text-xs">
                  <div className="border border-slate-300 rounded-xl p-3 bg-slate-50">
                    <div className="text-slate-500">مجموع بدهکار:</div>
                    <div className="text-sm font-black font-mono text-rose-700 mt-0.5">
                      {formatPrice(activeStatementTotals.totalDebit, settings?.currency || 'تومان')}
                    </div>
                  </div>
                  <div className="border border-slate-300 rounded-xl p-3 bg-slate-50">
                    <div className="text-slate-500">مجموع بستانکار:</div>
                    <div className="text-sm font-black font-mono text-emerald-700 mt-0.5">
                      {formatPrice(activeStatementTotals.totalCredit, settings?.currency || 'تومان')}
                    </div>
                  </div>
                  <div className="border border-slate-400 rounded-xl p-3 bg-slate-100">
                    <div className="text-slate-600 font-bold">مانده نهایی:</div>
                    <div className="text-sm font-black font-mono text-slate-900 mt-0.5">
                      {formatPrice(Math.abs(activeStatementTotals.netBalance), settings?.currency || 'تومان')}{' '}
                      ({activeStatementTotals.netBalance > 0 ? 'بدهکار' : activeStatementTotals.netBalance < 0 ? 'بستانکار' : 'تسویه'})
                    </div>
                  </div>
                </div>

                {/* PDF Statement Table */}
                <table className="w-full text-right border-collapse border border-slate-300 text-[11px]">
                  <thead>
                    <tr className="bg-slate-800 text-white">
                      <th className="py-2 px-2 border border-slate-600 text-center w-8">#</th>
                      <th className="py-2 px-2 border border-slate-600">تاریخ</th>
                      <th className="py-2 px-2 border border-slate-600">سند</th>
                      <th className="py-2 px-2 border border-slate-600">شرح تراکنش</th>
                      <th className="py-2 px-2 border border-slate-600 text-left">بدهکار</th>
                      <th className="py-2 px-2 border border-slate-600 text-left">بستانکار</th>
                      <th className="py-2 px-2 border border-slate-600 text-left">مانده</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStatementEntries.map((entry, idx) => (
                      <tr key={entry.id || idx} className="border-b border-slate-200">
                        <td className="py-1.5 px-2 border border-slate-200 text-center font-mono">{toPersianDigits(idx + 1)}</td>
                        <td className="py-1.5 px-2 border border-slate-200 font-mono whitespace-nowrap">{toPersianDigits(entry.date)}</td>
                        <td className="py-1.5 px-2 border border-slate-200 whitespace-nowrap">
                          {entry.documentTypeLabel} ({toPersianDigits(entry.documentNumber)})
                        </td>
                        <td className="py-1.5 px-2 border border-slate-200">
                          <div>{entry.description}</div>
                          {entry.itemsSummary && <div className="text-[10px] text-slate-500">{toPersianDigits(entry.itemsSummary)}</div>}
                        </td>
                        <td className="py-1.5 px-2 border border-slate-200 font-mono text-left">
                          {entry.debit > 0 ? toPersianDigits(entry.debit.toLocaleString()) : '-'}
                        </td>
                        <td className="py-1.5 px-2 border border-slate-200 font-mono text-left">
                          {entry.credit > 0 ? toPersianDigits(entry.credit.toLocaleString()) : '-'}
                        </td>
                        <td className="py-1.5 px-2 border border-slate-200 font-mono font-bold text-left">
                          {toPersianDigits(Math.abs(entry.balance).toLocaleString())} ({entry.balance > 0 ? 'بد' : entry.balance < 0 ? 'بس' : '۰'})
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Floating Bottom Quick Action for Mobile Devices */}
      <div className="no-print sm:hidden fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-md border-t border-slate-200 p-2.5 flex items-center justify-around gap-2 shadow-lg">
        {storePhone && (
          <a
            href={`tel:${cleanPhone}`}
            className="flex-1 min-h-[44px] bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm"
          >
            <Phone className="w-4 h-4" />
            <span>تماس تلفنی</span>
          </a>
        )}

        <button
          type="button"
          onClick={handleDownloadPdf}
          disabled={isExportingPdf}
          className="flex-1 min-h-[44px] bg-slate-900 hover:bg-slate-800 active:scale-98 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
        >
          <Download className="w-4 h-4 text-emerald-400" />
          <span>دانلود PDF</span>
        </button>

        <button
          type="button"
          onClick={handleShareNative}
          className="w-12 min-h-[44px] bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl flex items-center justify-center cursor-pointer"
          title="اشتراک‌گذاری"
        >
          <Share2 className="w-4 h-4" />
        </button>
      </div>

      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed bottom-16 sm:bottom-4 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-2xl text-xs font-bold shadow-xl border border-slate-800 flex items-center gap-2 animate-in fade-in slide-in-from-bottom-3 duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toastMsg}</span>
        </div>
      )}
    </div>
  );
};
