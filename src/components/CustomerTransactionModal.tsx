import React, { useState, useMemo, useEffect } from 'react';
import {
  X,
  CreditCard,
  AlertCircle,
  CheckCircle2,
  Calendar,
  ArrowDownLeft,
  ArrowUpRight,
  Send,
  Eye,
  Wallet,
} from 'lucide-react';
import { Customer, Invoice, StoreSettings, AppUser, CustomerTransaction, CustomerPaymentMethod } from '../types';
import { StorageService } from '../utils/storage';
import { formatPrice, toPersianDigits, getCurrentJalaliDate, addDaysToJalali } from '../utils/jalali';
import { NumericInput } from './NumericInput';
import { JalaliDatePicker } from './JalaliDatePicker';
import {
  autoSendCustomerPaymentReportToTelegram,
  autoSendSupplierPaymentReportToTelegram,
  formatCustomerPaymentTelegramReport,
  formatSupplierPaymentTelegramReport,
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
  editingTransaction?: CustomerTransaction | null;
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
  editingTransaction,
}) => {
  const isEditing = Boolean(editingTransaction);

  // Transaction type: deposit (واریز) or debt (بدهی)
  const [txnType, setTxnType] = useState<'deposit' | 'debt'>(
    editingTransaction ? editingTransaction.type : initialType
  );
  const [amount, setAmount] = useState<string>(
    editingTransaction ? String(editingTransaction.amount) : ''
  );
  const [date, setDate] = useState<string>(
    editingTransaction?.date || getCurrentJalaliDate()
  );
  const [title, setTitle] = useState<string>(
    editingTransaction?.title || ''
  );
  const [paymentMethod, setPaymentMethod] = useState<CustomerPaymentMethod>(
    editingTransaction?.paymentMethod || 'card'
  );
  const [trackingNumber, setTrackingNumber] = useState<string>(
    editingTransaction?.trackingNumber || ''
  );
  const [bankName, setBankName] = useState<string>(
    editingTransaction?.bankName || ''
  );
  const [chequeDueDate, setChequeDueDate] = useState<string>(
    editingTransaction?.chequeDueDate || ''
  );
  const [notes, setNotes] = useState<string>(
    editingTransaction?.notes || ''
  );

  // Calculate current customer net balance
  const fullLedger = useMemo(() => {
    if (!customer) {
      return { customer: null as any, entries: [], totalDebit: 0, totalCredit: 0, netBalance: 0 };
    }
    return StorageService.buildCustomerLedger(customer, invoices, transactions);
  }, [customer, invoices, transactions]);

  // Telegram reporting toggle
  const [sendToTelegram, setSendToTelegram] = useState<boolean>(() => {
    if (!settings?.telegramBotEnabled) return false;
    // Don't auto-send telegram on edit unless user specifically enables it
    if (editingTransaction) return false;
    return initialType === 'deposit'
      ? settings?.telegramAutoSendCustomerPayment !== false
      : settings?.telegramAutoSendSupplierPayment !== false;
  });
  const [showTelegramPreview, setShowTelegramPreview] = useState<boolean>(false);

  // Estimated balance after transaction
  const netBalanceAfter = useMemo(() => {
    const cleanAmount = parseFloat(amount.replace(/,/g, '')) || 0;
    // If editing, adjust for previous amount
    const prevAmount = editingTransaction ? editingTransaction.amount : 0;
    const prevType = editingTransaction ? editingTransaction.type : txnType;
    let baseBalance = fullLedger.netBalance;

    if (editingTransaction) {
      // Revert previous transaction effect
      if (prevType === 'deposit') {
        baseBalance += prevAmount;
      } else {
        baseBalance -= prevAmount;
      }
    }

    if (txnType === 'deposit') {
      return baseBalance - cleanAmount;
    } else {
      return baseBalance + cleanAmount;
    }
  }, [fullLedger.netBalance, amount, txnType, editingTransaction]);

  useEffect(() => {
    if (isOpen) {
      if (editingTransaction) {
        setTxnType(editingTransaction.type);
        setAmount(String(editingTransaction.amount));
        setDate(editingTransaction.date || getCurrentJalaliDate());
        setTitle(editingTransaction.title || (editingTransaction.type === 'deposit' ? 'واریز' : 'ثبت بدهی جدید'));
        setPaymentMethod(editingTransaction.paymentMethod || 'card');
        setTrackingNumber(editingTransaction.trackingNumber || '');
        setBankName(editingTransaction.bankName || '');
        setChequeDueDate(editingTransaction.chequeDueDate || '');
        setNotes(editingTransaction.notes || '');
        setShowTelegramPreview(false);
        setSendToTelegram(false); // Default to off when editing to avoid spamming telegram
      } else {
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
          setTitle('واریز');
          setPaymentMethod('card');
        } else {
          const creditAmount = fullLedger.netBalance < 0 ? Math.abs(fullLedger.netBalance) : 0;
          setAmount(creditAmount > 0 ? String(creditAmount) : '');
          setTitle(fullLedger.netBalance < 0 ? 'پرداخت وجه به طرف‌حساب' : 'ثبت بدهی جدید');
          setPaymentMethod(fullLedger.netBalance < 0 ? 'transfer' : 'other');
        }
      }
    }
  }, [isOpen, initialType, fullLedger.netBalance, editingTransaction]);

  // Switch type handler (when creating new)
  const handleSwitchType = (type: 'deposit' | 'debt') => {
    setTxnType(type);
    if (type === 'deposit') {
      const debtAmount = fullLedger.netBalance > 0 ? fullLedger.netBalance : 0;
      if (!amount && debtAmount > 0) {
        setAmount(String(debtAmount));
      }
      if (!title || title.includes('بدهی') || title.includes('پرداخت')) {
        setTitle('واریز');
      }
      setPaymentMethod('card');
    } else {
      const creditAmount = fullLedger.netBalance < 0 ? Math.abs(fullLedger.netBalance) : 0;
      if (!amount && creditAmount > 0) {
        setAmount(String(creditAmount));
      }
      if (!title || title.includes('واریز')) {
        setTitle(fullLedger.netBalance < 0 ? 'پرداخت وجه به طرف‌حساب' : 'ثبت بدهی جدید');
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

    const finalTxn: CustomerTransaction = editingTransaction
      ? {
          ...editingTransaction,
          type: txnType,
          amount: cleanAmount,
          date: date.trim() || getCurrentJalaliDate(),
          title: title.trim() || (txnType === 'deposit' ? 'واریز' : 'ثبت بدهی'),
          paymentMethod: txnType === 'deposit' ? paymentMethod : undefined,
          trackingNumber: trackingNumber.trim() || undefined,
          bankName: bankName.trim() || undefined,
          chequeDueDate: paymentMethod === 'cheque' ? chequeDueDate.trim() : undefined,
          notes: notes.trim() || undefined,
          updatedAt: getCurrentJalaliDate(),
        }
      : {
          id: `ctxn-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          customerId: customer!.id,
          customerName: customer!.name,
          type: txnType,
          amount: cleanAmount,
          date: date.trim() || getCurrentJalaliDate(),
          title: title.trim() || (txnType === 'deposit' ? 'واریز' : 'ثبت بدهی'),
          paymentMethod: txnType === 'deposit' ? paymentMethod : undefined,
          trackingNumber: trackingNumber.trim() || undefined,
          bankName: bankName.trim() || undefined,
          chequeDueDate: paymentMethod === 'cheque' ? chequeDueDate.trim() : undefined,
          notes: notes.trim() || undefined,
          recordedBy: currentUser?.fullName || currentUser?.username || 'مدیر سیستم',
          createdAt: getCurrentJalaliDate(),
        };

    onSaveTransaction(finalTxn);

    // Send Telegram message if enabled
    if (sendToTelegram && settings?.telegramBotEnabled && customer) {
      if (txnType === 'deposit') {
        autoSendCustomerPaymentReportToTelegram(finalTxn, customer, settings, netBalanceAfter).catch((err) => {
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
            title: title.trim() || (fullLedger.netBalance < 0 ? 'پرداخت وجه به طرف‌حساب' : 'ثبت سند بدهی'),
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

  if (!isOpen || !customer) return null;

  const isDeposit = txnType === 'deposit';

  return (
    <div
      id="customer-transaction-window"
      className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="bg-white w-full max-w-lg rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col text-right animate-in zoom-in-95 duration-150 my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* HEADER: Clean, Quiet, Professional */}
        <div className="px-5 py-3.5 sm:py-4 flex items-center justify-between gap-3 border-b border-slate-100 bg-white">
          <div className="flex items-center gap-3 min-w-0">
            <span
              className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold shrink-0 ${
                isDeposit
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/80'
                  : 'bg-rose-50 text-rose-700 border border-rose-200/80'
              }`}
            >
              {isDeposit ? (
                <CreditCard className="w-4 h-4 text-emerald-600" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600" />
              )}
            </span>
            <div className="min-w-0">
              <h3 className="font-black text-sm sm:text-base text-slate-800 truncate">
                {isEditing
                  ? (isDeposit ? 'ویرایش سند واریزی طرف‌حساب' : 'ویرایش سند بدهی طرف‌حساب')
                  : (isDeposit ? 'ثبت واریزی طرف‌حساب' : 'ثبت بدهی جدید طرف‌حساب')}
              </h3>
              <div className="text-[11px] text-slate-500 truncate mt-0.5 flex items-center gap-2">
                <span>طرف‌حساب: <strong className="text-slate-800">{customer.name}</strong></span>
                <span>·</span>
                <span className="tabular-nums">
                  مانده:{' '}
                  <strong
                    className={
                      fullLedger.netBalance > 0
                        ? 'text-rose-600'
                        : fullLedger.netBalance < 0
                        ? 'text-blue-600'
                        : 'text-emerald-600'
                    }
                  >
                    {fullLedger.netBalance === 0
                      ? 'تسویه'
                      : `${formatPrice(Math.abs(fullLedger.netBalance), settings.currency)} (${
                          fullLedger.netBalance > 0 ? 'بدهکار' : 'طلبکار'
                        })`}
                  </strong>
                </span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors cursor-pointer shrink-0"
            title="بستن پنجره"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* SUBHEADER: Only show type toggle when CREATING a new transaction (not during edit) */}
        {!isEditing && (
          <div className="bg-slate-50/80 px-5 py-2.5 border-b border-slate-100 flex items-center justify-between gap-2 shrink-0">
            <div className="flex items-center bg-slate-200/70 p-0.5 rounded-xl gap-1 w-full sm:w-auto">
              <button
                type="button"
                id="txn-type-deposit-tab"
                onClick={() => handleSwitchType('deposit')}
                className={`flex-1 sm:flex-initial px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  isDeposit
                    ? 'bg-emerald-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <ArrowDownLeft className="w-3.5 h-3.5" />
                <span>واریز (دریافتی)</span>
              </button>
              <button
                type="button"
                id="txn-type-debt-tab"
                onClick={() => handleSwitchType('debt')}
                className={`flex-1 sm:flex-initial px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  !isDeposit
                    ? 'bg-rose-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <ArrowUpRight className="w-3.5 h-3.5" />
                <span>ثبت بدهی جدید</span>
              </button>
            </div>

            {/* Quick Settle Full Debt helper (when creating new deposit and customer owes money) */}
            {isDeposit && fullLedger.netBalance > 0 && (
              <button
                type="button"
                onClick={handleSetFullDebtAmount}
                className="text-[11px] font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2.5 py-1 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                title="قرار دادن کل مانده بدهی در فیلد مبلغ"
              >
                <Wallet className="w-3 h-3 text-emerald-600" />
                <span>تسویه کل بدهی</span>
              </button>
            )}
          </div>
        )}

        {/* FORM BODY */}
        <form
          id="customer-transaction-form"
          onSubmit={handleSubmit}
          className="p-5 space-y-3.5 flex-1 text-slate-800 text-xs sm:text-sm overflow-y-auto"
        >
          {/* Row 1: Amount & Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                مبلغ ({settings.currency}) <span className="text-rose-500">*</span>
              </label>
              <NumericInput
                required
                id="txn-amount-input"
                value={amount}
                onChange={(_num, raw) => setAmount(raw.replace(/,/g, ''))}
                placeholder="مثال: ۲,۵۰۰,۰۰۰"
                currency={settings.currency}
                showWords={true}
                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm font-mono font-bold text-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all tabular-nums"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                  <span>تاریخ سند (شمسی)</span>
                  <span className="text-rose-500">*</span>
                </label>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setDate(getCurrentJalaliDate())}
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-md transition-all cursor-pointer ${
                      date === getCurrentJalaliDate()
                        ? 'bg-emerald-600 text-white shadow-2xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    امروز
                  </button>
                  <button
                    type="button"
                    onClick={() => setDate(addDaysToJalali(-1))}
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-md transition-all cursor-pointer ${
                      date === addDaysToJalali(-1)
                        ? 'bg-emerald-600 text-white shadow-2xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    دیروز
                  </button>
                </div>
              </div>
              <JalaliDatePicker
                value={date}
                onChange={(newDate) => setDate(newDate)}
                placeholder="انتخاب تاریخ سند"
                buttonClassName="h-9.5 text-xs sm:text-sm"
              />
            </div>
          </div>

          {/* Row 2: Payment Method (Segmented Row for Deposit) */}
          {isDeposit && (
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">روش واریز وجه:</label>
              <div className="flex items-center gap-1.5 flex-wrap">
                {[
                  { id: 'card', label: 'کارت به کارت' },
                  { id: 'pos', label: 'کارتخوان' },
                  { id: 'transfer', label: 'حواله بانکی / پایا' },
                  { id: 'cash', label: 'نقدی' },
                  { id: 'cheque', label: 'چک' },
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
          )}

          {/* Row 3: Reference/Tracking Number & Bank Name (or Cheque Due Date) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {paymentMethod === 'cheque' ? 'شماره چک صیادی' : 'شماره پیگیری / فیش (اختیاری)'}
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
                <JalaliDatePicker
                  value={chequeDueDate}
                  onChange={(newDate) => setChequeDueDate(newDate)}
                  placeholder="انتخاب سررسید چک"
                  buttonClassName="h-9.5 text-xs sm:text-sm"
                />
              </div>
            ) : (
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">نام بانک / حساب مقصد</label>
                <input
                  type="text"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  placeholder="مثال: ملت، ملی، سامان..."
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>
            )}
          </div>

          {/* Row 4: Title & Notes in a clean grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">عنوان سند / بابت</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={isDeposit ? 'واریز وجه، تسویه فاکتور...' : 'مانده گذشته، هزینه حمل...'}
                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">توضیحات تکمیلی (اختیاری)</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="توضیحات اضافی..."
                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>
          </div>

          {/* Balance Preview Badge */}
          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between text-xs tabular-nums">
            <span className="text-slate-500 font-medium">مانده طرف‌حساب پس از ثبت این سند:</span>
            <span
              className={`font-mono font-bold ${
                netBalanceAfter > 0
                  ? 'text-rose-700'
                  : netBalanceAfter < 0
                  ? 'text-blue-700'
                  : 'text-emerald-700'
              }`}
            >
              {netBalanceAfter === 0
                ? 'تسویه کامل (صفر)'
                : `${formatPrice(Math.abs(netBalanceAfter), settings.currency)} (${
                    netBalanceAfter > 0 ? 'بدهکار' : 'طلبکار'
                  })`}
            </span>
          </div>

          {/* Telegram Notification (Quiet, Decluttered Single-Line) */}
          {settings?.telegramBotEnabled && (
            <div className="pt-1">
              <div className="flex items-center justify-between gap-2">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={sendToTelegram}
                    onChange={(e) => setSendToTelegram(e.target.checked)}
                    className="w-4 h-4 rounded text-[#229ED9] focus:ring-[#229ED9] cursor-pointer"
                  />
                  <span className="text-xs font-medium text-slate-700 flex items-center gap-1.5">
                    <Send className="w-3.5 h-3.5 text-[#229ED9]" />
                    <span>ارسال گزارش سند به تلگرام</span>
                  </span>
                </label>

                {sendToTelegram && (
                  <button
                    type="button"
                    onClick={() => setShowTelegramPreview((prev) => !prev)}
                    className="text-[11px] font-bold text-sky-700 hover:text-sky-900 transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <Eye className="w-3 h-3 text-[#229ED9]" />
                    <span>{showTelegramPreview ? 'بستن پیش‌نمایش' : 'پیش‌نمایش'}</span>
                  </button>
                )}
              </div>

              {sendToTelegram && showTelegramPreview && (
                <div className="mt-2 p-2.5 bg-slate-50 rounded-xl border border-sky-200 font-mono text-[10.5px] text-slate-800 whitespace-pre-line text-right max-h-32 overflow-y-auto leading-relaxed">
                  {isDeposit
                    ? formatCustomerPaymentTelegramReport(
                        {
                          id: 'preview',
                          customerId: customer.id,
                          customerName: customer.name,
                          type: 'deposit',
                          amount: parseFloat(amount.replace(/,/g, '')) || 0,
                          date: date || getCurrentJalaliDate(),
                          title: title || 'واریز',
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
                        title: title || 'ثبت سند بدهی',
                        notes: notes || undefined,
                        recordedBy: currentUser?.fullName || currentUser?.username || 'مدیر سیستم',
                        settings,
                        balanceAfter: netBalanceAfter,
                      }).replace(/<[^>]+>/g, '')}
                </div>
              )}
            </div>
          )}
        </form>

        {/* FOOTER ACTIONS: Minimal & Clean */}
        <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-100 rounded-xl cursor-pointer transition-colors"
          >
            انصراف
          </button>
          <button
            type="submit"
            form="customer-transaction-form"
            id="submit-customer-transaction-btn"
            className={`flex items-center justify-center gap-1.5 px-5 py-2 text-xs font-bold text-white rounded-xl shadow-xs transition-all cursor-pointer ${
              isDeposit
                ? 'bg-emerald-600 hover:bg-emerald-700 active:scale-95'
                : 'bg-rose-600 hover:bg-rose-700 active:scale-95'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>
              {isEditing
                ? 'ذخیره تغییرات'
                : isDeposit
                ? 'ثبت واریز'
                : 'ثبت بدهی'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
