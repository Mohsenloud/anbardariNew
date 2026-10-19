import React, { useState } from 'react';
import { InboundReceipt, InboundReceiptItem, StoreSettings, AppUser } from '../types';
import { toPersianDigits } from '../utils/jalali';
import { InboundReceiptVerificationModal } from './InboundReceiptVerificationModal';
import { InboundReceiptPrintModal } from './InboundReceiptPrintModal';
import { 
  Search, 
  Package, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  Printer, 
  Check,
  X
} from 'lucide-react';

interface InboundReceiptsListProps {
  inboundReceipts: InboundReceipt[];
  settings: StoreSettings;
  currentUser?: AppUser;
  onConfirmReceipt: (
    receiptId: string,
    verifiedItems: InboundReceiptItem[],
    warehouseNotes: string,
    verifiedBy: string
  ) => void;
  initialSelectedReceiptId?: string | null;
}

export const InboundReceiptsList: React.FC<InboundReceiptsListProps> = ({
  inboundReceipts,
  settings,
  currentUser,
  onConfirmReceipt,
  initialSelectedReceiptId,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'confirmed' | 'has_discrepancy' | 'voice'>('all');

  const [verifyingReceipt, setVerifyingReceipt] = useState<InboundReceipt | null>(() => {
    if (initialSelectedReceiptId) {
      return inboundReceipts.find((r) => r.id === initialSelectedReceiptId) || null;
    }
    return null;
  });
  const [printingReceipt, setPrintingReceipt] = useState<InboundReceipt | null>(null);

  const filteredReceipts = inboundReceipts.filter((receipt) => {
    const matchesSearch =
      receipt.receiptNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      receipt.purchaseInvoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      receipt.supplierName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      receipt.items.some((i) => i.productName.toLowerCase().includes(searchQuery.toLowerCase()));

    let matchesStatus = true;
    if (statusFilter === 'pending') {
      matchesStatus = receipt.status === 'pending_verification';
    } else if (statusFilter === 'confirmed') {
      matchesStatus = receipt.status === 'confirmed';
    } else if (statusFilter === 'has_discrepancy') {
      matchesStatus = receipt.status === 'has_discrepancy';
    } else if (statusFilter === 'voice') {
      matchesStatus = receipt.source === 'telegram_voice';
    }

    return matchesSearch && matchesStatus;
  });

  const pendingCount = inboundReceipts.filter((r) => r.status === 'pending_verification').length;
  const discrepancyCount = inboundReceipts.filter((r) => r.status === 'has_discrepancy').length;
  const confirmedCount = inboundReceipts.filter((r) => r.status === 'confirmed').length;
  const voiceCount = inboundReceipts.filter((r) => r.source === 'telegram_voice').length;

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
      {/* Unified Search & Filter Toolbar */}
      <div className="p-3 sm:p-3.5 border-b border-slate-200/80 bg-slate-50/60 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="جستجوی شماره حواله، فاکتور خرید، تامین‌کننده یا کالا..."
            className="w-full pr-9 pl-8 py-1.5 text-xs rounded-xl border border-slate-200/90 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 shadow-2xs"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-full hover:bg-slate-100 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Status Segmented Filter Pills */}
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar bg-slate-200/60 p-1 rounded-xl text-xs font-bold">
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`px-2.5 py-1 rounded-lg whitespace-nowrap transition-all cursor-pointer ${
              statusFilter === 'all'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            همه ({toPersianDigits(inboundReceipts.length)})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('pending')}
            className={`px-2.5 py-1 rounded-lg whitespace-nowrap transition-all cursor-pointer flex items-center gap-1 ${
              statusFilter === 'pending'
                ? 'bg-blue-600 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>منتظر شمارش</span>
            <span className="font-mono">({toPersianDigits(pendingCount)})</span>
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('confirmed')}
            className={`px-2.5 py-1 rounded-lg whitespace-nowrap transition-all cursor-pointer ${
              statusFilter === 'confirmed'
                ? 'bg-emerald-600 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            تایید شده ({toPersianDigits(confirmedCount)})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('has_discrepancy')}
            className={`px-2.5 py-1 rounded-lg whitespace-nowrap transition-all cursor-pointer ${
              statusFilter === 'has_discrepancy'
                ? 'bg-amber-600 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            دارای مغایرت ({toPersianDigits(discrepancyCount)})
          </button>
          {voiceCount > 0 && (
            <button
              type="button"
              onClick={() => setStatusFilter('voice')}
              className={`px-2.5 py-1 rounded-lg whitespace-nowrap transition-all cursor-pointer flex items-center gap-1 ${
                statusFilter === 'voice'
                  ? 'bg-purple-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>🎙️ صوتی ({toPersianDigits(voiceCount)})</span>
            </button>
          )}
        </div>
      </div>

      {/* Empty State */}
      {filteredReceipts.length === 0 ? (
        <div className="p-12 text-center">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-2.5">
            <Package className="w-6 h-6" />
          </div>
          <h3 className="font-bold text-slate-700 text-sm">
            حواله ورود کالایی یافت نشد
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            {searchQuery
              ? 'موردی با مشخصات جستجو شده پیدا نشد.'
              : 'با ثبت فاکتورهای خرید، حواله‌های ورود به صورت خودکار در این قسمت ایجاد می‌شوند.'}
          </p>
        </div>
      ) : (
        <>
          {/* Mobile View: Compact 2-Row Cards */}
          <div className="block sm:hidden divide-y divide-slate-100">
            {filteredReceipts.map((receipt, index) => {
              const isPending = receipt.status === 'pending_verification';
              const hasDiscrepancy = receipt.status === 'has_discrepancy';

              return (
                <div
                  key={receipt.id}
                  onClick={() => setVerifyingReceipt(receipt)}
                  className={`p-3 space-y-2 transition-colors cursor-pointer active:bg-slate-100 ${
                    index % 2 === 1 ? 'bg-slate-50/60' : 'bg-white'
                  }`}
                >
                  {/* Row 1: Receipt Number, Invoice Ref, Status Badge */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-mono font-black text-xs text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200">
                        {toPersianDigits(receipt.receiptNumber)}
                      </span>
                      {receipt.source === 'telegram_voice' ? (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-sky-100 text-sky-800">
                          🎙️ صوتی
                        </span>
                      ) : (
                        <span className="text-[11px] text-slate-500 font-mono">
                          (فاکتور: {toPersianDigits(receipt.purchaseInvoiceNumber)})
                        </span>
                      )}
                      <span className="text-[11px] text-slate-400 font-mono">
                        {toPersianDigits(receipt.date)}
                      </span>
                    </div>

                    {isPending ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200 shrink-0">
                        منتظر شمارش
                      </span>
                    ) : hasDiscrepancy ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200 shrink-0">
                        دارای مغایرت
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 shrink-0">
                        تایید شده
                      </span>
                    )}
                  </div>

                  {/* Row 2: Supplier, Item Count & Actions */}
                  <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100 text-xs">
                    <div className="min-w-0">
                      <span className="font-bold text-slate-900 truncate block">
                        {receipt.supplierName}
                      </span>
                      <span className="text-[10px] text-slate-500">
                        {toPersianDigits(receipt.items.length)} ردیف کالا ({toPersianDigits(receipt.totalExpectedQuantity)} واحد)
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => setVerifyingReceipt(receipt)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer ${
                          isPending
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        <Check className="w-3 h-3" />
                        <span>{isPending ? 'شمارش و تایید' : 'بررسی شمارش'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setPrintingReceipt(receipt)}
                        className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 cursor-pointer"
                        title="چاپ و PDF حواله"
                      >
                        <Printer className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop View: Clean Single-Row Table */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-right border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100/70 text-slate-700 border-b border-slate-200 select-none">
                  <th className="py-3 px-3 font-bold text-center w-10">#</th>
                  <th className="py-3 px-3 font-bold">شماره حواله و فاکتور خرید</th>
                  <th className="py-3 px-3 font-bold">تامین‌کننده / مبدأ</th>
                  <th className="py-3 px-3 font-bold text-center">تاریخ صدور</th>
                  <th className="py-3 px-3 font-bold text-center">تعداد اقلام</th>
                  <th className="py-3 px-3 font-bold text-center">وضعیت انبار</th>
                  <th className="py-3 px-3 font-bold text-center w-44">عملیات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredReceipts.map((receipt, index) => {
                  const isPending = receipt.status === 'pending_verification';
                  const hasDiscrepancy = receipt.status === 'has_discrepancy';

                  return (
                    <tr
                      key={receipt.id}
                      onClick={() => setVerifyingReceipt(receipt)}
                      className={`${
                        index % 2 === 1 ? 'bg-slate-50/60' : 'bg-white'
                      } hover:bg-emerald-50/40 transition-colors cursor-pointer group`}
                    >
                      <td className="py-3 px-3 text-center font-mono text-slate-400 font-bold text-[11px]">
                        {toPersianDigits(index + 1)}
                      </td>

                      {/* Receipt & Purchase Invoice Numbers */}
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-black text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200">
                            {toPersianDigits(receipt.receiptNumber)}
                          </span>
                          {receipt.source === 'telegram_voice' ? (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-sky-100 text-sky-800 border border-sky-200">
                              🎙️ ویس تلگرام
                            </span>
                          ) : (
                            <span className="text-[11px] text-slate-500 font-mono">
                              (فاکتور: <strong className="text-slate-700">{toPersianDigits(receipt.purchaseInvoiceNumber)}</strong>)
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Supplier */}
                      <td className="py-3 px-3">
                        <div className="font-bold text-slate-900 truncate max-w-[200px]" title={receipt.supplierName}>
                          {receipt.supplierName}
                        </div>
                        {receipt.verifiedBy && !isPending && (
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            تایید: {receipt.verifiedBy}
                          </div>
                        )}
                      </td>

                      {/* Date */}
                      <td className="py-3 px-3 text-center font-mono text-slate-600 whitespace-nowrap">
                        {toPersianDigits(receipt.date)}
                      </td>

                      {/* Items & Quantity Summary */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <span className="font-bold text-slate-800">
                          {toPersianDigits(receipt.items.length)} ردیف
                        </span>
                        <span className="text-[11px] text-slate-400 font-mono mr-1">
                          ({toPersianDigits(receipt.totalExpectedQuantity)} واحد)
                        </span>
                      </td>

                      {/* Status Badge */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        {isPending ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                            <Clock className="w-3 h-3 text-blue-600" />
                            <span>منتظر شمارش</span>
                          </span>
                        ) : hasDiscrepancy ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                            <AlertTriangle className="w-3 h-3 text-amber-600" />
                            <span>دارای مغایرت ({toPersianDigits(receipt.totalDiscrepancy)})</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>تایید کامل</span>
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => setVerifyingReceipt(receipt)}
                            className={`px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 transition-all cursor-pointer shadow-2xs ${
                              isPending
                                ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                                : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
                            }`}
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>{isPending ? 'شمارش و تایید' : 'ویرایش شمارش'}</span>
                          </button>

                          <button
                            type="button"
                            id={`btn-preview-inbound-${receipt.id}`}
                            onClick={() => setPrintingReceipt(receipt)}
                            className="p-1.5 text-slate-600 hover:text-emerald-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                            title="پیش‌نمایش، چاپ و دانلود PDF حواله ورود"
                          >
                            <Printer className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Verification Modal */}
      {verifyingReceipt && (
        <InboundReceiptVerificationModal
          receipt={verifyingReceipt}
          currentUser={currentUser}
          onClose={() => setVerifyingReceipt(null)}
          onConfirm={(receiptId, verifiedItems, notes, verifiedBy) => {
            onConfirmReceipt(receiptId, verifiedItems, notes, verifiedBy);
            setVerifyingReceipt(null);
          }}
          onPrint={(receipt) => {
            setPrintingReceipt(receipt);
          }}
        />
      )}

      {/* Print Modal */}
      {printingReceipt && (
        <InboundReceiptPrintModal
          receipt={printingReceipt}
          settings={settings}
          currentUser={currentUser}
          onClose={() => setPrintingReceipt(null)}
        />
      )}
    </div>
  );
};
