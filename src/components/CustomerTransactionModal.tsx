import React, { useState, useMemo, useEffect } from 'react';
import {
  X,
  CreditCard,
  AlertCircle,
  CheckCircle2,
  Calendar,
  ArrowDownLeft,
  ArrowUpRight,
  Wallet,
  Building2,
  FileText,
  User,
  Check,
  Send,
  Eye,
  MessageSquare,
  Bot
} from 'lucide-react';
import { Customer, Invoice, StoreSettings, AppUser, CustomerTransaction, CustomerPaymentMethod } from '../types';
import { StorageService } from '../utils/storage';
import { formatPrice, toPersianDigits, getCurrentJalaliDate } from '../utils/jalali';
import { NumericInput } from './NumericInput';
import {
  autoSendCustomerPaymentReportToTelegram,
  autoSendSupplierPaymentReportToTelegram,
  formatCustomerPaymentTelegramReport,
  formatSupplierPaymentTelegramReport,
  isTelegramConfigured
} from '../utils/telegramService';

export interface CustomerTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  customer: Customer | null;
  initialType?: 'deposit' | 'debt';
  invoices: Invoice[];
  transactions: CustomerTransaction[];
  settings: StoreSettings;
  currentUser?: AppUser;
  onSaveTransaction: (txn: CustomerTransaction) => void;
}

export const CustomerTransactionModal: React.FC<CustomerTransactionModalProps> = ({
  isOpen,
  onClose,
  customer,
  initialType = 'deposit',
  invoices,
  transactions,
  settings,
  currentUser,
  onSaveTransaction,
}) => {
  if (!isOpen || !customer) return null;

  // Transaction type: deposit (واریز) or debt (بدهی)
  const [txnType, setTxnType] = useState<'deposit' | 'debt'>(initialType);
  const [amount, setAmount] = useState<string>('');
  const [date, setDate] = useState<string>(getCurrentJalaliDate());
  const [title, setTitle] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<CustomerPaymentMethod>('transfer');
  const [trackingNumber, setTrackingNumber] = useState<string>('');
  const [bankName, setBankName] = useState<string>('');
  const [chequeDueDate, setChequeDueDate] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  // Calculate current customer net balance
  const fullLedger = useMemo(() => {
    return StorageService.buildCustomerLedger(customer, invoices, transactions);
  }, [customer, invoices, transactions]);

  // Sync initial type when opening
  const isTelegramReady = isTelegramConfigured(settings);
  const [sendToTelegram, setSendToTelegram] = useState<boolean>(() => {
    if (!settings?.telegramBotEnabled) return false;
    return initialType === 'deposit'
      ? settings?.telegramAutoSendCustomerPayment !== false
      : settings?.telegramAutoSendSupplierPayment !== false;
  });
  const [showTelegramPreview, setShowTelegramPreview] = useState<boolean>(false);

  // Estimated balance after transaction
  const netBalanceAfter = useMemo(() => {
    const cleanAmount = parseFloat(amount.replace(/,/g, '')) || 0;
    if (txnType === 'deposit') {
      return fullLedger.netBalance - cleanAmount;
    } else {
      return fullLedger.netBalance + cleanAmount;
    }
  }, [fullLedger.netBalance, amount, txnType]);

  useEffect(() => {
    if (isOpen) {
      setTxnType(initialType);
      setDate(getCurrentJalaliDate());
      setTrackingNumber('');
      setBankName('');
      setChequeDueDate('');
      setNotes('');
      setShowTelegramPreview(false);
      if (settings?.telegramBotEnabled) {
        setSendToTelegram(
          initialType === 'deposit'
            ? settings?.telegramAutoSendCustomerPayment !== false
            : settings?.telegramAutoSendSupplierPayment !== false
        );
      }
      if (initialType === 'deposit') {
        const debtAmount = fullLedger.netBalance > 0 ? fullLedger.netBalance : 0;
        setAmount(debtAmount > 0 ? String(debtAmount) : '');
        setTitle('واریز به حساب / تسویه');
        setPaymentMethod('transfer');
      } else {
        const creditAmount = fullLedger.netBalance < 0 ? Math.abs(fullLedger.netBalance) : 0;
        setAmount(creditAmount > 0 ? String(creditAmount) : '');
        setTitle(fullLedger.netBalance < 0 ? 'پرداخت وجه به طرف‌حساب / تسویه طلب' : 'ثبت بدهی جدید / مانده گذشته');
        setPaymentMethod(fullLedger.netBalance < 0 ? 'transfer' : 'other');
      }
    }
  }, [isOpen, initialType, fullLedger.netBalance]);

  // Switch type handler
  const handleSwitchType = (type: 'deposit' | 'debt') => {
    setTxnType(type);
    if (type === 'deposit') {
      const debtAmount = fullLedger.netBalance > 0 ? fullLedger.netBalance : 0;
      if (!amount && debtAmount > 0) {
        setAmount(String(debtAmount));
      }
      if (!title || title.includes('بدهی') || title.includes('پرداخت')) {
        setTitle('واریز به حساب / تسویه');
      }
      setPaymentMethod('transfer');
    } else {
      const creditAmount = fullLedger.netBalance < 0 ? Math.abs(fullLedger.netBalance) : 0;
      if (!amount && creditAmount > 0) {
        setAmount(String(creditAmount));
      }
      if (!title || title.includes('واریز')) {
        setTitle(fullLedger.netBalance < 0 ? 'پرداخت وجه به طرف‌حساب / تسویه طلب' : 'ثبت بدهی جدید');
      }
      setPaymentMethod(fullLedger.netBalance < 0 ? 'transfer' : 'other');
    }
  };

  // Quick set full debt into amount input
  const handleSetFullDebtAmount = () => {
    if (fullLedger.netBalance > 0) {
      setAmount(String(fullLedger.netBalance));
    } else if (fullLedger.netBalance < 0) {
      setAmount(String(Math.abs(fullLedger.netBalance)));
    }
  };

  // Submit form
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanAmount = parseFloat(amount.replace(/,/g, ''));
    if (!cleanAmount || cleanAmount <= 0) return;

    const newTxn: CustomerTransaction = {
      id: `ctxn-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      customerId: customer.id,
      customerName: customer.name,
      type: txnType,
      amount: cleanAmount,
      date: date.trim() || getCurrentJalaliDate(),
      title: title.trim() || (txnType === 'deposit' ? 'واریز وجه' : 'ثبت بدهی'),
      paymentMethod: txnType === 'deposit' ? paymentMethod : undefined,
      trackingNumber: trackingNumber.trim() || undefined,
      bankName: bankName.trim() || undefined,
      chequeDueDate: paymentMethod === 'cheque' ? chequeDueDate.trim() : undefined,
      notes: notes.trim() || undefined,
      recordedBy: currentUser?.fullName || currentUser?.username || 'مدیر سیستم',
      createdAt: getCurrentJalaliDate(),
    };

    onSaveTransaction(newTxn);

    // ارسال گزارش به تلگرام در صورت فعال بودن
    if (sendToTelegram && settings?.telegramBotEnabled) {
      if (txnType === 'deposit') {
        autoSendCustomerPaymentReportToTelegram(newTxn, customer, settings, netBalanceAfter).catch((err) => {
          console.warn('[Telegram Auto-Send] Error sending customer payment receipt:', err);
        });
      } else {
        autoSendSupplierPaymentReportToTelegram(
          {
            supplierName: customer.name,
            supplierPhone: customer.phone,
            amount: cleanAmount,
            paymentMethod,
            trackingNumber: trackingNumber.trim() || undefined,
            bankName: bankName.trim() || undefined,
            chequeDueDate: chequeDueDate.trim() || undefined,
            date: date.trim() || getCurrentJalaliDate(),
            title: title.trim() || (fullLedger.netBalance < 0 ? 'پرداخت وجه به طرف‌حساب / تسویه طلب' : 'ثبت سند بدهی'),
            notes: notes.trim() || undefined,
            recordedBy: currentUser?.fullName || currentUser?.username || 'مدیر سیستم',
            balanceAfter: netBalanceAfter,
          },
          settings
        ).catch((err) => {
          console.warn('[Telegram Auto-Send] Error sending supplier payment receipt:', err);
        });
      }
    }

    onClose();
  };

  return (
    <div
      id="customer-transaction-window"
      className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-2.5 sm:p-4 md:p-6 overflow-y-auto animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="bg-white w-full max-w-lg sm:max-w-xl rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[94vh] text-right animate-in zoom-in-95 duration-150 my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* HEADER */}
        <div
          className={`px-4 sm:px-6 py-3.5 sm:py-4 flex items-center justify-between gap-3 text-white border-b shrink-0 transition-colors ${
            txnType === 'deposit'
              ? 'bg-gradient-to-r from-emerald-800 to-teal-900 border-emerald-700/60'
              : 'bg-gradient-to-r from-rose-800 to-slate-900 border-rose-700/60'
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white shadow-xs shrink-0 ${
                txnType === 'deposit'
                  ? 'bg-emerald-500/30 border border-emerald-400/40 text-emerald-200'
                  : 'bg-rose-500/30 border border-rose-400/40 text-rose-200'
              }`}
            >
              {txnType === 'deposit' ? (
                <CreditCard className="w-5 h-5 text-emerald-300" />
              ) : (
                <AlertCircle className="w-5 h-5 text-rose-300" />
              )}
            </div>
            <div className="min-w-0">
              <h3 className="font-black text-sm sm:text-base truncate">
                {txnType === 'deposit' ? 'ثبت واریزی وجه طرف‌حساب' : 'ثبت بدهی جدید طرف‌حساب'}
              </h3>
              <p className="text-[11px] text-slate-300 truncate mt-0.5 flex items-center gap-1.5">
                <span>مشتری:</span>
                <span className="font-bold text-white">{customer.name}</span>
                {customer.phone && (
                  <span className="text-slate-400 font-mono text-[10px]">({toPersianDigits(customer.phone)})</span>
                )}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center text-slate-300 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer shrink-0"
            title="بستن پنجره"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* SUBHEADER: TABS & BALANCE */}
        <div className="bg-slate-50 px-4 sm:px-6 py-2.5 border-b border-slate-200 flex items-center justify-between gap-2 shrink-0 flex-wrap">
          {/* Segmented switcher */}
          <div className="flex items-center bg-slate-200/80 p-0.5 rounded-xl gap-1 w-full sm:w-auto">
            <button
              type="button"
              id="txn-type-deposit-tab"
              onClick={() => handleSwitchType('deposit')}
              className={`flex-1 sm:flex-initial px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                txnType === 'deposit'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ArrowDownLeft className="w-3.5 h-3.5" />
              <span>ثبت واریز (دریافتی)</span>
            </button>
            <button
              type="button"
              id="txn-type-debt-tab"
              onClick={() => handleSwitchType('debt')}
              className={`flex-1 sm:flex-initial px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                txnType === 'debt'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ArrowUpRight className="w-3.5 h-3.5" />
              <span>ثبت بدهی جدید</span>
            </button>
          </div>

          {/* Current balance indicator */}
          <div className="flex items-center gap-1.5 text-xs w-full sm:w-auto justify-between sm:justify-end mt-1 sm:mt-0 pt-1 sm:pt-0 border-t sm:border-t-0 border-slate-200">
            <span className="text-slate-500 font-medium">مانده کل فعلی:</span>
            <span
              className={`font-mono font-bold ${
                fullLedger.netBalance > 0
                  ? 'text-rose-700'
                  : fullLedger.netBalance < 0
                    ? 'text-blue-700'
                    : 'text-emerald-700'
              }`}
            >
              {fullLedger.netBalance === 0
                ? 'تسویه (صفر)'
                : `${formatPrice(Math.abs(fullLedger.netBalance), settings.currency)} (${
                    fullLedger.netBalance > 0 ? 'بدهکار' : 'طلبکار'
                  })`}
            </span>
          </div>
        </div>

        {/* FORM BODY */}
        <form
          id="customer-transaction-form"
          onSubmit={handleSubmit}
          className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1 text-slate-800 text-xs sm:text-sm"
        >
          {/* Quick Settle Full Debt Banner (if customer owes money and deposit mode) */}
          {txnType === 'deposit' && fullLedger.netBalance > 0 && (
            <div className="flex items-center justify-between bg-emerald-50/90 border border-emerald-200 p-2.5 sm:p-3 rounded-2xl gap-2 flex-wrap">
              <div className="flex items-center gap-2 text-xs text-emerald-950">
                <Wallet className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  مانده بدهی جاری طرف‌حساب:{' '}
                  <strong className="font-mono font-bold text-rose-700">
                    {formatPrice(fullLedger.netBalance, settings.currency)}
                  </strong>
                </span>
              </div>
              <button
                type="button"
                onClick={handleSetFullDebtAmount}
                className="text-xs bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold px-3 py-1.5 rounded-xl transition-all cursor-pointer shadow-xs flex items-center gap-1"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>تسویه کل مانده</span>
              </button>
            </div>
          )}

          {/* Amount & Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* Amount */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                مبلغ ({settings.currency}) <span className="text-rose-500">*</span>
              </label>
              <NumericInput
                required
                id="txn-amount-input"
                value={amount}
                onChange={(num, raw) => setAmount(raw.replace(/,/g, ''))}
                placeholder="مثال: ۲,۵۰۰,۰۰۰"
                currency={settings.currency}
                showWords={true}
                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2.5 text-sm font-mono font-bold text-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
              />
            </div>

            {/* Date */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                تاریخ سند (شمسی) <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <Calendar className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  required
                  id="txn-date-input"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  placeholder="۱۴۰۳/۰۶/۲۴"
                  className="w-full bg-white border border-slate-300 rounded-xl pr-9 pl-3 py-2.5 text-xs sm:text-sm font-mono text-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                />
              </div>
            </div>
          </div>

          {/* Title / Description */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">عنوان / بابت سند</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={txnType === 'deposit' ? 'واریز نقدی، کارت به کارت، پایا...' : 'مانده گذشته، هزینه حمل و نقل...'}
              className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
            />
          </div>

          {/* Deposit Specific Options */}
          {txnType === 'deposit' && (
            <div className="space-y-3 pt-1">
              {/* Payment Method Quick Chips */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">روش واریز وجه:</label>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {[
                    { id: 'transfer', label: 'حواله / پایا / ساتنا' },
                    { id: 'card', label: 'کارت به کارت' },
                    { id: 'pos', label: 'کارتخوان (POS)' },
                    { id: 'cash', label: 'وجه نقد' },
                    { id: 'cheque', label: 'چک صیادی' },
                    { id: 'other', label: 'سایر' },
                  ].map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setPaymentMethod(m.id as CustomerPaymentMethod)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                        paymentMethod === m.id
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Ref Number & Bank Name / Cheque Due Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {paymentMethod === 'cheque' ? 'شماره چک صیادی' : 'شماره پیگیری / فیش واریز'}
                  </label>
                  <input
                    type="text"
                    value={trackingNumber}
                    onChange={(e) => setTrackingNumber(e.target.value)}
                    placeholder={paymentMethod === 'cheque' ? 'شماره ۱۶ رقمی صیاد' : 'کد پیگیری یا شماره ارجاع'}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs sm:text-sm font-mono text-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>

                {paymentMethod === 'cheque' ? (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">تاریخ سررسید چک</label>
                    <input
                      type="text"
                      value={chequeDueDate}
                      onChange={(e) => setChequeDueDate(e.target.value)}
                      placeholder="۱۴۰۳/۰۸/۱۵"
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs sm:text-sm font-mono text-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">نام بانک / مبدا</label>
                    <input
                      type="text"
                      value={bankName}
                      onChange={(e) => setBankName(e.target.value)}
                      placeholder="مثال: بانک ملت، ملی، صادرات..."
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Debt Quick Presets if Debt */}
          {txnType === 'debt' && (
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">عناوین پرتکرار بدهی:</label>
              <div className="flex items-center gap-1.5 flex-wrap">
                {[
                  'مانده بدهی گذشته (انتقالی)',
                  'فروش کالا / فاکتور دستی',
                  'هزینه حمل و نقل',
                  'سایر خدمات',
                ].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setTitle(preset)}
                    className="px-2.5 py-1 bg-white hover:bg-rose-50 text-slate-700 hover:text-rose-800 border border-slate-200 hover:border-rose-300 rounded-lg text-xs transition-colors cursor-pointer"
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">توضیحات تکمیلی (اختیاری)</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="هرگونه یادداشت یا توضیحات اضافی..."
              className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>

          {/* Telegram Reporting Option Card */}
          {settings?.telegramBotEnabled && (
            <div className="p-3 bg-gradient-to-r from-sky-50 to-blue-50/60 rounded-2xl border border-sky-200/90 space-y-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={sendToTelegram}
                    onChange={(e) => setSendToTelegram(e.target.checked)}
                    className="w-4 h-4 rounded text-[#229ED9] focus:ring-[#229ED9] cursor-pointer"
                  />
                  <span className="font-bold text-xs text-sky-950 flex items-center gap-1.5">
                    <Send className="w-3.5 h-3.5 text-[#229ED9]" />
                    <span>
                      {txnType === 'deposit'
                        ? 'ارسال خودکار رسید دریافت وجه به تلگرام'
                        : 'ارسال رسید پرداخت وجه به تامین‌کننده/طرف‌حساب به تلگرام'}
                    </span>
                  </span>
                </label>

                {sendToTelegram && (
                  <button
                    type="button"
                    onClick={() => setShowTelegramPreview((prev) => !prev)}
                    className="text-[11px] font-bold text-sky-700 hover:text-sky-900 bg-white/80 hover:bg-white px-2.5 py-1 rounded-lg border border-sky-300 transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <Eye className="w-3 h-3 text-[#229ED9]" />
                    <span>{showTelegramPreview ? 'بستن پیش‌نمایش' : 'پیش‌نمایش پیام'}</span>
                  </button>
                )}
              </div>

              {sendToTelegram && (
                <div className="text-[11px] text-sky-800/90 leading-relaxed pr-6 space-y-1">
                  <p>
                    مقصد ارسال:{' '}
                    <strong>
                      {customer?.telegramChatId
                        ? `چت اختصاصی مشتری (${toPersianDigits(customer.telegramChatId)})`
                        : `کانال/گروه ثبت‌شده در سیستم (${toPersianDigits(settings?.telegramChatId || 'کانال اصلی')})`}
                    </strong>
                  </p>

                  {/* Message Preview Accordion */}
                  {showTelegramPreview && (
                    <div className="mt-2 p-2.5 bg-white/95 rounded-xl border border-sky-300/80 shadow-2xs font-mono text-[10.5px] text-slate-800 whitespace-pre-line text-right max-h-40 overflow-y-auto leading-relaxed">
                      {txnType === 'deposit'
                        ? formatCustomerPaymentTelegramReport(
                            {
                              id: 'preview',
                              customerId: customer.id,
                              customerName: customer.name,
                              type: 'deposit',
                              amount: parseFloat(amount.replace(/,/g, '')) || 0,
                              date: date || getCurrentJalaliDate(),
                              title: title || 'واریز وجه به حساب',
                              paymentMethod,
                              trackingNumber: trackingNumber || undefined,
                              bankName: bankName || undefined,
                              chequeDueDate: chequeDueDate || undefined,
                              notes: notes || undefined,
                              recordedBy: currentUser?.fullName || currentUser?.username || 'مدیر سیستم',
                              createdAt: getCurrentJalaliDate(),
                            },
                            customer,
                            settings,
                            netBalanceAfter
                          ).replace(/<[^>]+>/g, '')
                        : formatSupplierPaymentTelegramReport({
                            supplierName: customer.name,
                            supplierPhone: customer.phone,
                            amount: parseFloat(amount.replace(/,/g, '')) || 0,
                            paymentMethod,
                            trackingNumber: trackingNumber || undefined,
                            bankName: bankName || undefined,
                            chequeDueDate: chequeDueDate || undefined,
                            date: date || getCurrentJalaliDate(),
                            title: title || 'پرداخت وجه به طرف‌حساب',
                            notes: notes || undefined,
                            recordedBy: currentUser?.fullName || currentUser?.username || 'مدیر سیستم',
                            settings,
                            balanceAfter: netBalanceAfter,
                          }).replace(/<[^>]+>/g, '')}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </form>

        {/* FOOTER ACTIONS */}
        <div className="p-3.5 sm:p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 sm:py-2.5 text-xs sm:text-sm font-bold text-slate-600 bg-white border border-slate-300 rounded-xl hover:bg-slate-100 cursor-pointer transition-all"
          >
            انصراف
          </button>
          <button
            type="submit"
            form="customer-transaction-form"
            id="submit-customer-transaction-btn"
            className={`flex items-center justify-center gap-1.5 px-6 py-2.5 text-xs sm:text-sm font-bold text-white rounded-xl shadow-xs transition-all cursor-pointer ${
              txnType === 'deposit'
                ? 'bg-emerald-600 hover:bg-emerald-700 active:scale-95'
                : 'bg-rose-600 hover:bg-rose-700 active:scale-95'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>{txnType === 'deposit' ? 'ثبت واریز به حساب' : 'ثبت سند بدهی'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
