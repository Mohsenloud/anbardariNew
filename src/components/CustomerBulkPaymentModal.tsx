import React, { useState, useMemo } from 'react';
import { 
  X, 
  CreditCard, 
  CheckCircle2, 
  AlertCircle, 
  Receipt, 
  ArrowRight, 
  DollarSign, 
  Calendar, 
  User, 
  Check, 
  Building2,
  FileText,
  Clock,
  Sparkles
} from 'lucide-react';
import { Customer, Invoice, StoreSettings } from '../types';
import { formatPrice, toPersianDigits, getCurrentJalaliDate } from '../utils/jalali';
import { NumericInput } from './NumericInput';

interface CustomerBulkPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  customer: Customer | null;
  invoices: Invoice[];
  settings: StoreSettings;
  onConfirmPayment: (
    updates: { invoiceId: string; status: 'paid' | 'unpaid' | 'partial'; paidAmount: number }[],
    note: string
  ) => void;
}

export const CustomerBulkPaymentModal: React.FC<CustomerBulkPaymentModalProps> = ({
  isOpen,
  onClose,
  customer,
  invoices,
  settings,
  onConfirmPayment,
}) => {
  if (!isOpen || !customer) return null;

  // Filter regular unpaid/partially-paid invoices for this customer
  const unpaidCustomerInvoices = useMemo(() => {
    return invoices
      .filter((inv) => {
        if (inv.isProforma) return false;
        // Match customer
        const matchesCustomer = 
          (inv.customerId && inv.customerId === customer.id) ||
          (inv.customerName && inv.customerName.trim().toLowerCase() === customer.name.trim().toLowerCase());
        
        if (!matchesCustomer) return false;
        return inv.paymentStatus === 'unpaid' || inv.paymentStatus === 'partial';
      })
      .sort((a, b) => a.date.localeCompare(b.date)); // Oldest first (FIFO)
  }, [invoices, customer]);

  // Selected invoices for settlement (default: all)
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<string[]>(() => 
    unpaidCustomerInvoices.map((i) => i.id)
  );

  // Settlement Mode: 'full_selected' (settle 100% of chosen invoices) vs 'custom_amount' (distribute custom deposit)
  const [settleMode, setSettleMode] = useState<'full_selected' | 'custom_amount'>('full_selected');
  const [customDepositAmount, setCustomDepositAmount] = useState<number>(() => {
    return unpaidCustomerInvoices.reduce((sum, inv) => {
      const remaining = Math.max(0, inv.finalTotal - (inv.paidAmount || 0));
      return sum + remaining;
    }, 0);
  });

  const [paymentMethod, setPaymentMethod] = useState<'bank_transfer' | 'card' | 'cash' | 'cheque'>('bank_transfer');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [notes, setNotes] = useState('');

  // Calculate selected total debt
  const selectedInvoices = useMemo(() => {
    return unpaidCustomerInvoices.filter((inv) => selectedInvoiceIds.includes(inv.id));
  }, [unpaidCustomerInvoices, selectedInvoiceIds]);

  const totalRemainingDebt = useMemo(() => {
    return unpaidCustomerInvoices.reduce((sum, inv) => {
      const remaining = Math.max(0, inv.finalTotal - (inv.paidAmount || 0));
      return sum + remaining;
    }, 0);
  }, [unpaidCustomerInvoices]);

  const selectedRemainingDebt = useMemo(() => {
    return selectedInvoices.reduce((sum, inv) => {
      const remaining = Math.max(0, inv.finalTotal - (inv.paidAmount || 0));
      return sum + remaining;
    }, 0);
  }, [selectedInvoices]);

  // Toggle selection
  const handleToggleInvoice = (invId: string) => {
    setSelectedInvoiceIds((prev) => 
      prev.includes(invId) ? prev.filter((id) => id !== invId) : [...prev, invId]
    );
  };

  const handleSelectAll = () => {
    setSelectedInvoiceIds(unpaidCustomerInvoices.map((i) => i.id));
  };

  const handleDeselectAll = () => {
    setSelectedInvoiceIds([]);
  };

  // Preview how money will be allocated
  const allocationPreview = useMemo(() => {
    if (selectedInvoices.length === 0) return [];

    if (settleMode === 'full_selected') {
      return selectedInvoices.map((inv) => ({
        invoice: inv,
        currentPaid: inv.paidAmount || 0,
        newPaid: inv.finalTotal,
        newStatus: 'paid' as const,
        changeAmount: Math.max(0, inv.finalTotal - (inv.paidAmount || 0)),
      }));
    } else {
      // Distribute customDepositAmount across selectedInvoices in FIFO order
      let remainingMoney = Math.max(0, customDepositAmount);
      return selectedInvoices.map((inv) => {
        const curPaid = inv.paidAmount || 0;
        const needed = Math.max(0, inv.finalTotal - curPaid);
        const allocate = Math.min(needed, remainingMoney);
        remainingMoney -= allocate;
        const totalNewPaid = curPaid + allocate;
        const isPaidFull = totalNewPaid >= inv.finalTotal;
        const isPartial = totalNewPaid > 0 && !isPaidFull;

        return {
          invoice: inv,
          currentPaid: curPaid,
          newPaid: totalNewPaid,
          newStatus: (isPaidFull ? 'paid' : isPartial ? 'partial' : 'unpaid') as 'paid' | 'partial' | 'unpaid',
          changeAmount: allocate,
        };
      });
    }
  }, [selectedInvoices, settleMode, customDepositAmount]);

  const totalAllocated = useMemo(() => {
    return allocationPreview.reduce((sum, item) => sum + item.changeAmount, 0);
  }, [allocationPreview]);

  // Submit handler
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (allocationPreview.length === 0) return;

    const updates = allocationPreview.map((item) => ({
      invoiceId: item.invoice.id,
      status: item.newStatus,
      paidAmount: item.newPaid,
    }));

    const methodLabels: Record<string, string> = {
      bank_transfer: 'واریز بانکی / کارت‌به‌کارت',
      card: 'کارتخوان / پوز',
      cash: 'نقدی',
      cheque: 'چک بانکی',
    };

    const details = [
      `واریزی یکباره مشتری: «${customer.name}»`,
      `مبلغ واریزی ثبت‌شده: ${formatPrice(totalAllocated, settings.currency)}`,
      `روش واریز: ${methodLabels[paymentMethod] || paymentMethod}`,
      referenceNumber ? `شماره پیگیری/ارجاع: ${referenceNumber}` : '',
      `تعداد فاکتورهای تحت تاثیر: ${updates.length} فاکتور`,
      notes ? `توضیحات: ${notes}` : '',
    ].filter(Boolean).join(' | ');

    onConfirmPayment(updates, details);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/75 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden flex flex-col max-h-[95vh] my-auto animate-scaleUp">
        
        {/* Header */}
        <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-sm sm:text-base">
                ثبت واریزی یکباره و تسویه تجمیعی فاکتورها
              </h3>
              <p className="text-xs text-slate-400">
                مشتری: <span className="font-bold text-white">{customer.name}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1 text-slate-800 text-xs sm:text-sm">
          
          {/* Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
              <span className="text-[11px] text-slate-500 block">تعداد فاکتورهای باز:</span>
              <span className="font-black text-base text-slate-900 mt-1 font-mono block">
                {toPersianDigits(unpaidCustomerInvoices.length)} فاکتور
              </span>
            </div>

            <div className="bg-rose-50 p-3 rounded-xl border border-rose-200">
              <span className="text-[11px] text-rose-700 font-medium block">کل بدهی تسویه‌نشده:</span>
              <span className="font-black text-base text-rose-800 mt-1 font-mono block">
                {formatPrice(totalRemainingDebt, settings.currency)}
              </span>
            </div>

            <div className="col-span-2 sm:col-span-1 bg-emerald-50 p-3 rounded-xl border border-emerald-200">
              <span className="text-[11px] text-emerald-800 font-medium block">مبلغ واریزی تخصیص‌یافته:</span>
              <span className="font-black text-base text-emerald-700 mt-1 font-mono block">
                {formatPrice(totalAllocated, settings.currency)}
              </span>
            </div>
          </div>

          {unpaidCustomerInvoices.length === 0 ? (
            <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 space-y-2">
              <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
              <div className="font-bold text-slate-800 text-sm">تمامی فاکتورهای این مشتری تسویه کامل شده‌اند!</div>
              <p className="text-xs text-slate-500">هیچ فاکتور نسیه یا پرداخت‌نشده‌ای برای این مشتری وجود ندارد.</p>
            </div>
          ) : (
            <>
              {/* Step 1: Mode Selector */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-800">
                  ۱. نحوه اعمال واریزی مشتری:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setSettleMode('full_selected')}
                    className={`p-3 rounded-xl border text-right transition-all cursor-pointer flex items-start gap-2.5 ${
                      settleMode === 'full_selected'
                        ? 'bg-amber-50/80 border-amber-500 text-amber-950 ring-2 ring-amber-500/20 shadow-xs'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className={`w-4 h-4 rounded-full border mt-0.5 flex items-center justify-center shrink-0 ${
                      settleMode === 'full_selected' ? 'border-amber-600 bg-amber-600 text-white' : 'border-slate-300'
                    }`}>
                      {settleMode === 'full_selected' && <Check className="w-3 h-3 stroke-[3]" />}
                    </div>
                    <div>
                      <div className="font-bold text-xs">تسویه کامل فاکتورهای انتخاب‌شده</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        تمام بدهی فاکتورهای تیک‌خورده به صورت ۱۰۰٪ تسویه‌شده ثبت می‌شود.
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSettleMode('custom_amount')}
                    className={`p-3 rounded-xl border text-right transition-all cursor-pointer flex items-start gap-2.5 ${
                      settleMode === 'custom_amount'
                        ? 'bg-emerald-50/80 border-emerald-500 text-emerald-950 ring-2 ring-emerald-500/20 shadow-xs'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className={`w-4 h-4 rounded-full border mt-0.5 flex items-center justify-center shrink-0 ${
                      settleMode === 'custom_amount' ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-300'
                    }`}>
                      {settleMode === 'custom_amount' && <Check className="w-3 h-3 stroke-[3]" />}
                    </div>
                    <div>
                      <div className="font-bold text-xs">واریز مبلغ مشخص و تسهیم خودکار (FIFO)</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        مبلغ واریزی از فاکتور قدیمی‌تر به جدیدتر پر شده و مانده نسیه می‌ماند.
                      </div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Custom Amount Input if mode is custom_amount */}
              {settleMode === 'custom_amount' && (
                <div className="p-3.5 bg-emerald-50/50 rounded-xl border border-emerald-200 space-y-2">
                  <label className="block text-xs font-bold text-emerald-950">
                    مبلغ واریزی فیش / رسید مشتری ({settings.currency || 'تومان'}):
                  </label>
                  <div className="flex items-center gap-2">
                    <NumericInput
                      id="custom-deposit-amount-input"
                      min={0}
                      value={customDepositAmount || ''}
                      onChange={(num) => setCustomDepositAmount(num)}
                      className="w-full bg-white border border-emerald-300 rounded-xl px-3 py-2 text-sm font-bold font-mono text-emerald-900 outline-none focus:ring-2 focus:ring-emerald-500"
                      placeholder="مثال: ۵۰,۰۰۰,۰۰۰"
                      currency={settings.currency || 'تومان'}
                      showWords={true}
                    />
                    <button
                      type="button"
                      onClick={() => setCustomDepositAmount(selectedRemainingDebt)}
                      className="px-3 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold shrink-0 hover:bg-emerald-700 transition-colors cursor-pointer self-start mt-0.5"
                    >
                      تسویه کامل انتخابی
                    </button>
                  </div>
                  <div className="text-[11px] text-slate-500">
                    معادل حروف/خوانا: <span className="font-bold text-slate-800">{formatPrice(customDepositAmount, settings.currency)}</span>
                  </div>
                </div>
              )}

              {/* Step 2: Invoices Selection List */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-800">
                    ۲. فاکتورهای مورد نظر جهت تسویه ({toPersianDigits(selectedInvoiceIds.length)} از {toPersianDigits(unpaidCustomerInvoices.length)}):
                  </label>
                  <div className="flex items-center gap-2 text-xs">
                    <button
                      type="button"
                      onClick={handleSelectAll}
                      className="text-amber-700 hover:underline font-medium cursor-pointer"
                    >
                      انتخاب همه
                    </button>
                    <span className="text-slate-300">|</span>
                    <button
                      type="button"
                      onClick={handleDeselectAll}
                      className="text-slate-500 hover:underline font-medium cursor-pointer"
                    >
                      لغو همه
                    </button>
                  </div>
                </div>

                <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 max-h-56 overflow-y-auto">
                  {unpaidCustomerInvoices.map((inv) => {
                    const isSelected = selectedInvoiceIds.includes(inv.id);
                    const remaining = Math.max(0, inv.finalTotal - (inv.paidAmount || 0));
                    const isPartial = inv.paymentStatus === 'partial';
                    const alloc = allocationPreview.find((a) => a.invoice.id === inv.id);

                    return (
                      <div
                        key={inv.id}
                        onClick={() => handleToggleInvoice(inv.id)}
                        className={`p-3 flex items-center justify-between gap-3 transition-colors cursor-pointer text-xs ${
                          isSelected ? 'bg-amber-50/40 hover:bg-amber-50/70' : 'bg-white hover:bg-slate-50 opacity-60'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {}} // handled by parent div
                            className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 cursor-pointer"
                          />
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-900 font-mono">
                                فاکتور #{toPersianDigits(inv.invoiceNumber)}
                              </span>
                              <span className="text-[10px] text-slate-400 font-mono">
                                ({toPersianDigits(inv.date)})
                              </span>
                              {isPartial && (
                                <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-bold">
                                  بخشی پرداخت‌شده
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-500 mt-0.5">
                              مبلغ کل فاکتور: {formatPrice(inv.finalTotal, settings.currency)}
                              {inv.paidAmount ? ` | پرداختی قبلی: ${formatPrice(inv.paidAmount, settings.currency)}` : ''}
                            </div>
                          </div>
                        </div>

                        <div className="text-left shrink-0">
                          <div className="text-[11px] text-rose-700 font-bold font-mono">
                            مانده بدهی: {formatPrice(remaining, settings.currency)}
                          </div>
                          {isSelected && alloc && (
                            <div className="text-[10px] text-emerald-700 font-bold font-mono mt-0.5">
                              واریزی این نوبت: +{formatPrice(alloc.changeAmount, settings.currency)}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Step 3: Payment Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    روش واریز وجه:
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs outline-none focus:bg-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  >
                    <option value="bank_transfer">واریز بانکی / کارت به کارت / پایا</option>
                    <option value="card">کارتخوان انبار / فروشگاه (POS)</option>
                    <option value="cash">نقدی</option>
                    <option value="cheque">چک بانکی صیادی</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    شماره پیگیری واریز / شماره فیش بانکی:
                  </label>
                  <input
                    type="text"
                    value={referenceNumber}
                    onChange={(e) => setReferenceNumber(e.target.value)}
                    placeholder="مثال: ۹۸۲۳۴۱۷۸"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs outline-none focus:bg-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 font-mono"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    یادداشت تسویه (اختیاری):
                  </label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="توضیحات تکمیلی تسویه حساب یکباره مشتری..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs outline-none focus:bg-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  />
                </div>
              </div>
            </>
          )}

          {/* Action Buttons */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              انصراف
            </button>
            <button
              type="submit"
              disabled={allocationPreview.length === 0 || totalAllocated === 0}
              className="flex items-center gap-1.5 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl text-xs font-black transition-all shadow-md cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Check className="w-4 h-4" />
              <span>ثبت واریزی و تسویه فاکتورها ({formatPrice(totalAllocated, settings.currency)})</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
