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
  Eye,
  Wallet,
  Clock
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

interface CustomerStatementModalProps {
  isOpen: boolean;
  onClose: () => void;
  customer: Customer | null;
  invoices: Invoice[];
  transactions: CustomerTransaction[];
  settings: StoreSettings;
  currentUser?: AppUser;
  onSaveTransaction: (txn: CustomerTransaction, autoSettleInvoices?: boolean) => void;
  onDeleteTransaction: (txnId: string) => void;
  onViewInvoice?: (invoice: Invoice) => void;
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
}) => {
  if (!isOpen || !customer) return null;

  // Active sub-view or forms
  const [formType, setFormType] = useState<'none' | 'deposit' | 'debt'>('none');
  const [filterType, setFilterType] = useState<'all' | 'debt' | 'deposit'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState<'all' | '30days' | 'this_year'>('all');
  const [transactionToDelete, setTransactionToDelete] = useState<CustomerTransaction | null>(null);

  // New Transaction Form State
  const [formAmount, setFormAmount] = useState<string>('');
  const [formDate, setFormDate] = useState<string>(getCurrentJalaliDate());
  const [formTitle, setFormTitle] = useState<string>('');
  const [formPaymentMethod, setFormPaymentMethod] = useState<CustomerPaymentMethod>('transfer');
  const [formTrackingNumber, setFormTrackingNumber] = useState<string>('');
  const [formBankName, setFormBankName] = useState<string>('');
  const [formChequeDueDate, setFormChequeDueDate] = useState<string>('');
  const [formSelectedInvoiceId, setFormSelectedInvoiceId] = useState<string>('');
  const [formNotes, setFormNotes] = useState<string>('');
  const [formAutoSettle, setFormAutoSettle] = useState<boolean>(true);

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

  // Open Form
  const handleOpenForm = (type: 'deposit' | 'debt') => {
    setFormType(type);
    setFormDate(getCurrentJalaliDate());
    setFormTrackingNumber('');
    setFormBankName('');
    setFormChequeDueDate('');
    setFormSelectedInvoiceId('');
    setFormNotes('');
    setFormAutoSettle(type === 'deposit');

    if (type === 'deposit') {
      // Default deposit to remaining debt if any
      const debtAmount = fullLedger.netBalance > 0 ? fullLedger.netBalance : 0;
      setFormAmount(debtAmount > 0 ? String(debtAmount) : '');
      setFormTitle('واریز به حساب / تسویه');
      setFormPaymentMethod('transfer');
    } else {
      setFormAmount('');
      setFormTitle('ثبت بدهی جدید / مانده گذشته');
      setFormPaymentMethod('other');
    }
  };

  const handleCloseForm = () => {
    setFormType('none');
    setFormAmount('');
    setFormTitle('');
    setFormNotes('');
  };

  // Submit new transaction
  const handleSubmitTransaction = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanAmount = parseFloat(formAmount.replace(/,/g, ''));
    if (!cleanAmount || cleanAmount <= 0) return;

    const chosenInvoice = unpaidInvoices.find((i) => i.id === formSelectedInvoiceId);

    const newTxn: CustomerTransaction = {
      id: `ctxn-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      customerId: customer.id,
      customerName: customer.name,
      type: formType === 'deposit' ? 'deposit' : 'debt',
      amount: cleanAmount,
      date: formDate.trim() || getCurrentJalaliDate(),
      title: formTitle.trim() || (formType === 'deposit' ? 'واریز وجه' : 'ثبت بدهی'),
      paymentMethod: formType === 'deposit' ? formPaymentMethod : undefined,
      trackingNumber: formTrackingNumber.trim() || undefined,
      bankName: formBankName.trim() || undefined,
      chequeDueDate: formPaymentMethod === 'cheque' ? formChequeDueDate.trim() : undefined,
      invoiceId: chosenInvoice?.id,
      invoiceNumber: chosenInvoice?.invoiceNumber,
      notes: formNotes.trim() || undefined,
      recordedBy: currentUser?.fullName || currentUser?.username || 'مدیر سیستم',
      createdAt: getCurrentJalaliDate(),
    };

    onSaveTransaction(newTxn, formType === 'deposit' && formAutoSettle);
    handleCloseForm();
  };

  // Print Trigger
  const handlePrint = () => {
    window.print();
  };

  // Export to Excel
  const handleExportExcel = () => {
    exportCustomerStatementToExcel(customer, fullLedger, settings);
  };

  const numericAmount = parseFloat(formAmount.replace(/,/g, '')) || 0;

  return (
    <div 
      id="customer-statement-modal" 
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-150"
    >
      <div className="bg-white w-full max-w-5xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[95vh] text-right">
        
        {/* MODAL HEADER */}
        <div className="no-print bg-slate-900 text-white px-5 py-4 flex items-center justify-between gap-3 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <span className="p-2.5 bg-emerald-500/20 text-emerald-400 rounded-2xl border border-emerald-500/30">
              <ReceiptText className="w-5 h-5" />
            </span>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-bold text-white">
                  صورتحساب و گردش مالی: {customer.name}
                </h2>
                {/* Status Badge */}
                {fullLedger.netBalance > 0 ? (
                  <span className="text-[11px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    <span>بدهکار: {formatPrice(fullLedger.netBalance, settings.currency)}</span>
                  </span>
                ) : fullLedger.netBalance < 0 ? (
                  <span className="text-[11px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/40 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>طلبکار: {formatPrice(Math.abs(fullLedger.netBalance), settings.currency)}</span>
                  </span>
                ) : (
                  <span className="text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>تسویه کامل (بی‌حساب)</span>
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-3 flex-wrap">
                {customer.phone && (
                  <span className="flex items-center gap-1">
                    <Phone className="w-3 h-3 text-slate-500" />
                    <span className="font-mono text-slate-300">{toPersianDigits(customer.phone)}</span>
                  </span>
                )}
                {customer.nationalId && (
                  <span>کد ملی: <strong className="font-mono text-slate-300">{toPersianDigits(customer.nationalId)}</strong></span>
                )}
                <span>تاریخ عضویت: {toPersianDigits(customer.createdAt)}</span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
            title="بستن پنجره"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* FINANCIAL SUMMARY KPI CARDS */}
        <div className="no-print p-4 sm:p-5 bg-slate-50/80 border-b border-slate-200/80 grid grid-cols-2 sm:grid-cols-4 gap-3">
          {/* 1. Total Debits (بدهکار) */}
          <div className="bg-white p-3.5 rounded-2xl border border-rose-100 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs text-rose-600 font-bold mb-1">
              <span>جمع کل بدهی‌ها</span>
              <span className="p-1.5 bg-rose-50 rounded-lg">
                <ArrowUpRight className="w-4 h-4 text-rose-600" />
              </span>
            </div>
            <div className="text-sm sm:text-base font-black text-rose-700 font-mono">
              {formatPrice(fullLedger.totalDebit, settings.currency)}
            </div>
            <div className="text-[10px] text-slate-400 mt-1">
              فاکتورها و اسناد بدهکاری
            </div>
          </div>

          {/* 2. Total Credits (بستانکار) */}
          <div className="bg-white p-3.5 rounded-2xl border border-emerald-100 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs text-emerald-600 font-bold mb-1">
              <span>جمع کل واریزی‌ها</span>
              <span className="p-1.5 bg-emerald-50 rounded-lg">
                <ArrowDownLeft className="w-4 h-4 text-emerald-600" />
              </span>
            </div>
            <div className="text-sm sm:text-base font-black text-emerald-700 font-mono">
              {formatPrice(fullLedger.totalCredit, settings.currency)}
            </div>
            <div className="text-[10px] text-slate-400 mt-1">
              نقدی، کارت، چک و واریزی‌ها
            </div>
          </div>

          {/* 3. Net Balance (مانده حساب) */}
          <div className={`p-3.5 rounded-2xl border shadow-xs flex flex-col justify-between ${
            fullLedger.netBalance > 0
              ? 'bg-rose-50/70 border-rose-200 text-rose-800'
              : fullLedger.netBalance < 0
                ? 'bg-blue-50/70 border-blue-200 text-blue-800'
                : 'bg-emerald-50/70 border-emerald-200 text-emerald-800'
          }`}>
            <div className="flex items-center justify-between text-xs font-bold mb-1">
              <span>مانده حساب جاری</span>
              <span className="p-1.5 bg-white/80 rounded-lg">
                <Wallet className="w-4 h-4" />
              </span>
            </div>
            <div className="text-sm sm:text-base font-black font-mono">
              {formatPrice(Math.abs(fullLedger.netBalance), settings.currency)}
            </div>
            <div className="text-[10px] font-bold mt-1">
              {fullLedger.netBalance > 0
                ? 'مشتری بدهکار است'
                : fullLedger.netBalance < 0
                  ? 'مشتری طلبکار است'
                  : 'حساب کاملاً تسویه است'}
            </div>
          </div>

          {/* 4. Total Entries & Invoices */}
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs text-slate-600 font-bold mb-1">
              <span>تعداد کل اسناد</span>
              <span className="p-1.5 bg-slate-100 rounded-lg text-slate-600">
                <FileText className="w-4 h-4" />
              </span>
            </div>
            <div className="text-sm sm:text-base font-black text-slate-800 font-mono">
              {toPersianDigits(fullLedger.entries.length)} تراکنش
            </div>
            <div className="text-[10px] text-slate-500 mt-1">
              {toPersianDigits(unpaidInvoices.length)} فاکتور تسویه‌نشده
            </div>
          </div>
        </div>

        {/* ACTION TOOLBAR & FILTERS */}
        <div className="no-print p-4 border-b border-slate-200 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 bg-white">
          {/* Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              id="add-deposit-btn"
              onClick={() => handleOpenForm('deposit')}
              className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white px-3.5 py-2 rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>ثبت واریز جدید (دریافتی)</span>
            </button>

            <button
              type="button"
              id="add-debt-btn"
              onClick={() => handleOpenForm('debt')}
              className="flex items-center gap-1.5 bg-rose-600 hover:bg-rose-700 active:scale-98 text-white px-3.5 py-2 rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>ثبت بدهی جدید (مانده / متفرقه)</span>
            </button>

            <button
              type="button"
              id="print-statement-btn"
              onClick={handlePrint}
              className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 active:scale-98 text-slate-700 border border-slate-300 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer"
            >
              <Printer className="w-4 h-4 text-slate-600" />
              <span>چاپ صورتحساب</span>
            </button>

            <button
              type="button"
              id="export-statement-excel-btn"
              onClick={handleExportExcel}
              className="flex items-center gap-1.5 bg-purple-50 hover:bg-purple-100 active:scale-98 text-purple-700 border border-purple-200 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4 text-purple-600" />
              <span>خروجی اکسل صورتحساب</span>
            </button>
          </div>

          {/* Search & Filters */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Filter by Type */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200 text-xs">
              <button
                type="button"
                onClick={() => setFilterType('all')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                  filterType === 'all' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                همه ({toPersianDigits(fullLedger.entries.length)})
              </button>
              <button
                type="button"
                onClick={() => setFilterType('debt')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                  filterType === 'debt' ? 'bg-white text-rose-700 shadow-xs' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                فقط بدهی‌ها
              </button>
              <button
                type="button"
                onClick={() => setFilterType('deposit')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                  filterType === 'deposit' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                فقط واریزی‌ها
              </button>
            </div>

            {/* Quick Search */}
            <div className="relative flex-1 sm:w-48">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="جستجو در شرح، شماره..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-8 pl-3 py-1.5 text-xs text-slate-800 outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
            </div>
          </div>
        </div>

        {/* INLINE FORM: ADD DEPOSIT OR DEBT */}
        {formType !== 'none' && (
          <div className="no-print p-5 bg-gradient-to-br from-slate-50 to-slate-100/90 border-b border-slate-200 animate-in fade-in duration-150">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className={`p-2 rounded-xl text-white ${formType === 'deposit' ? 'bg-emerald-600' : 'bg-rose-600'}`}>
                  {formType === 'deposit' ? <CreditCard className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                </span>
                <h3 className="font-bold text-sm text-slate-800">
                  {formType === 'deposit' ? 'ثبت واریزی جدید به حساب مشتری' : 'ثبت سند بدهی جدید برای مشتری'}
                </h3>
              </div>
              <button
                type="button"
                onClick={handleCloseForm}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitTransaction} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* 1. Amount */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    مبلغ ({settings.currency}) *
                  </label>
                  <input
                    type="text"
                    required
                    id="txn-amount-input"
                    value={formAmount ? Number(formAmount.replace(/,/g, '')).toLocaleString('en-US') : ''}
                    onChange={(e) => {
                      const val = e.target.value.replace(/[^\d]/g, '');
                      setFormAmount(val);
                    }}
                    placeholder="مثال: ۲,۵۰۰,۰۰۰"
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                  />
                  {numericAmount > 0 && (
                    <p className="text-[10px] text-emerald-700 font-bold mt-1 leading-tight">
                      {numberToPersianWords(numericAmount)} {settings.currency}
                    </p>
                  )}
                </div>

                {/* 2. Date */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">تاریخ ثبت (شمسی) *</label>
                  <div className="relative">
                    <Calendar className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      id="txn-date-input"
                      value={formDate}
                      onChange={(e) => setFormDate(e.target.value)}
                      placeholder="۱۴۰۳/۰۶/۲۴"
                      className="w-full bg-white border border-slate-300 rounded-xl pr-8 pl-3 py-2 text-xs font-mono text-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                    />
                  </div>
                </div>

                {/* 3. Title */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">عنوان / بابت سند</label>
                  <input
                    type="text"
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder={formType === 'deposit' ? 'واریز نقدی، کارت به کارت...' : 'مانده گذشته، هزینه حمل...'}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>
              </div>

              {/* Deposit-specific Fields */}
              {formType === 'deposit' && (
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-1">
                  {/* Payment Method */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">روش پرداخت</label>
                    <select
                      value={formPaymentMethod}
                      onChange={(e) => setFormPaymentMethod(e.target.value as CustomerPaymentMethod)}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-800 outline-none focus:border-emerald-500 cursor-pointer"
                    >
                      <option value="transfer">واریز به حساب / پایا / ساتنا</option>
                      <option value="card">کارت به کارت</option>
                      <option value="pos">کارتخوان فروشگاه (POS)</option>
                      <option value="cheque">چک بانکی</option>
                      <option value="cash">وجه نقد</option>
                      <option value="other">سایر روش‌ها</option>
                    </select>
                  </div>

                  {/* Tracking / Ref Number */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      {formPaymentMethod === 'cheque' ? 'شماره چک' : 'شماره پیگیری / فیش'}
                    </label>
                    <input
                      type="text"
                      value={formTrackingNumber}
                      onChange={(e) => setFormTrackingNumber(e.target.value)}
                      placeholder={formPaymentMethod === 'cheque' ? 'شماره چک صیادی' : 'شماره پیگیری یا ارجاع'}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono text-slate-800 outline-none focus:border-emerald-500"
                    />
                  </div>

                  {/* Bank Name */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">نام بانک / صاحب حساب</label>
                    <input
                      type="text"
                      value={formBankName}
                      onChange={(e) => setFormBankName(e.target.value)}
                      placeholder="مثال: بانک ملت"
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-800 outline-none focus:border-emerald-500"
                    />
                  </div>

                  {/* Cheque Due Date if cheque */}
                  {formPaymentMethod === 'cheque' ? (
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">تاریخ سررسید چک</label>
                      <input
                        type="text"
                        value={formChequeDueDate}
                        onChange={(e) => setFormChequeDueDate(e.target.value)}
                        placeholder="۱۴۰۳/۰۸/۱۵"
                        className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono text-slate-800 outline-none focus:border-emerald-500"
                      />
                    </div>
                  ) : (
                    /* Target Invoice */
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">بابت فاکتور خاص (اختیاری)</label>
                      <select
                        value={formSelectedInvoiceId}
                        onChange={(e) => setFormSelectedInvoiceId(e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-800 outline-none focus:border-emerald-500 cursor-pointer"
                      >
                        <option value="">واریز عمومی / علی‌الحساب</option>
                        {unpaidInvoices.map((inv) => (
                          <option key={inv.id} value={inv.id}>
                            فاکتور {inv.invoiceNumber} (مانده: {formatPrice(inv.finalTotal - (inv.paidAmount || 0), settings.currency)})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              )}

              {/* Notes & Auto-settle toggle */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">توضیحات تکمیلی</label>
                  <input
                    type="text"
                    value={formNotes}
                    onChange={(e) => setFormNotes(e.target.value)}
                    placeholder="توضیحات و شرح واریز یا بدهی..."
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-800 outline-none focus:border-emerald-500"
                  />
                </div>

                {formType === 'deposit' && (
                  <div className="flex items-center gap-2 pb-2">
                    <input
                      type="checkbox"
                      id="auto-settle-check"
                      checked={formAutoSettle}
                      onChange={(e) => setFormAutoSettle(e.target.checked)}
                      className="rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer w-4 h-4"
                    />
                    <label htmlFor="auto-settle-check" className="text-xs text-slate-700 font-medium cursor-pointer">
                      تسویه خودکار فاکتورهای دارای مانده
                    </label>
                  </div>
                )}
              </div>

              {/* Form Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={handleCloseForm}
                  className="px-4 py-2 text-xs text-slate-600 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  id="submit-transaction-btn"
                  className={`flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white rounded-xl shadow-xs transition-all cursor-pointer ${
                    formType === 'deposit' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{formType === 'deposit' ? 'ثبت واریز وجه' : 'ثبت سند بدهی'}</span>
                </button>
              </div>
            </form>
          </div>
        )}

        {/* LEDGER TABLE (SCREEN VIEW) */}
        <div className="no-print flex-1 overflow-y-auto p-4 sm:p-5">
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
                    <th className="py-3 px-3 w-32">مانده جاری</th>
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
                      const isPayment = entry.documentType === 'deposit' || entry.documentType === 'invoice_payment';
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
        </div>

        {/* MODAL FOOTER */}
        <div className="no-print p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3">
          <div className="text-xs text-slate-500">
            مانده حساب به حروف: <strong className="text-slate-800">
              {fullLedger.netBalance === 0 
                ? 'تسویه کامل (بی‌حساب)' 
                : `${numberToPersianWords(Math.abs(fullLedger.netBalance))} ${settings.currency} ${fullLedger.netBalance > 0 ? 'بدهکار' : 'بستانکار'}`}
            </strong>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-100 cursor-pointer transition-all"
          >
            بستن پنجره
          </button>
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
    </div>
  );
};
