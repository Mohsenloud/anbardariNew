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
  ArrowDownRight, 
  Eye, 
  Check, 
  Calendar,
  Building2,
  FileSpreadsheet
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
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'confirmed' | 'has_discrepancy'>('all');

  // Modals state
  const [verifyingReceipt, setVerifyingReceipt] = useState<InboundReceipt | null>(() => {
    if (initialSelectedReceiptId) {
      return inboundReceipts.find((r) => r.id === initialSelectedReceiptId) || null;
    }
    return null;
  });
  const [printingReceipt, setPrintingReceipt] = useState<InboundReceipt | null>(null);

  // Filtered receipts
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
    }

    return matchesSearch && matchesStatus;
  });

  const pendingCount = inboundReceipts.filter((r) => r.status === 'pending_verification').length;
  const discrepancyCount = inboundReceipts.filter((r) => r.status === 'has_discrepancy').length;
  const confirmedCount = inboundReceipts.filter((r) => r.status === 'confirmed').length;

  return (
    <div className="space-y-4">
      {/* KPI Cards for Inbound Receipts */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <span className="text-xs text-slate-500 font-medium">کل حواله‌های ورود</span>
          <div className="text-xl font-black text-slate-800 mt-1">
            {toPersianDigits(inboundReceipts.length)}{' '}
            <span className="text-xs font-normal text-slate-400">حواله</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-blue-200 bg-blue-50/40 shadow-xs">
          <span className="text-xs text-blue-800 font-bold flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            در انتظار شمارش و تایید
          </span>
          <div className="text-xl font-black text-blue-700 mt-1 flex items-center gap-2">
            <span>{toPersianDigits(pendingCount)}</span>
            {pendingCount > 0 && (
              <span className="text-[10px] bg-blue-200 text-blue-900 font-bold px-1.5 py-0.5 rounded">
                اقدام انباردار
              </span>
            )}
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-emerald-200 bg-emerald-50/30 shadow-xs">
          <span className="text-xs text-emerald-800 font-medium">ورود قطعی (تایید شده)</span>
          <div className="text-xl font-black text-emerald-700 mt-1">
            {toPersianDigits(confirmedCount)}{' '}
            <span className="text-xs font-normal text-slate-400">حواله</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-amber-200 bg-amber-50/30 shadow-xs">
          <span className="text-xs text-amber-800 font-medium">حواله‌های دارای مغایرت</span>
          <div className="text-xl font-black text-amber-700 mt-1">
            {toPersianDigits(discrepancyCount)}{' '}
            <span className="text-xs font-normal text-slate-400">مورد کسری/مازاد</span>
          </div>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white p-3 sm:p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="جستجوی شماره حواله، فاکتور خرید، تامین‌کننده..."
            className="w-full pl-3 pr-9 py-2 text-xs rounded-xl border border-slate-300 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0 text-xs">
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all cursor-pointer ${
              statusFilter === 'all'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            همه ({toPersianDigits(inboundReceipts.length)})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('pending')}
            className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all cursor-pointer ${
              statusFilter === 'pending'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
            }`}
          >
            در انتظار شمارش ({toPersianDigits(pendingCount)})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('confirmed')}
            className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all cursor-pointer ${
              statusFilter === 'confirmed'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
            }`}
          >
            تایید شده کامل ({toPersianDigits(confirmedCount)})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('has_discrepancy')}
            className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all cursor-pointer ${
              statusFilter === 'has_discrepancy'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
            }`}
          >
            دارای مغایرت ({toPersianDigits(discrepancyCount)})
          </button>
        </div>
      </div>

      {/* Receipts List */}
      {filteredReceipts.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-slate-200/80 shadow-xs">
          <div className="w-16 h-16 rounded-3xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
            <Package className="w-8 h-8" />
          </div>
          <h3 className="font-bold text-slate-800 text-sm sm:text-base">
            حواله ورود کالایی یافت نشد
          </h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            {searchQuery
              ? 'موردی با مشخصات جستجو شده پیدا نشد.'
              : 'با ثبت فاکتورهای خرید، حواله‌های ورود به صورت خودکار در این قسمت ایجاد خواهند شد.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredReceipts.map((receipt, index) => {
            const isPending = receipt.status === 'pending_verification';
            const hasDiscrepancy = receipt.status === 'has_discrepancy';
            const isConfirmed = receipt.status === 'confirmed';

            return (
              <div
                key={receipt.id}
                className={`rounded-2xl border transition-all p-4 shadow-2xs hover:shadow-xs ${
                  index % 2 === 1 ? 'bg-slate-50/85' : 'bg-white'
                } ${
                  isPending
                    ? 'border-blue-200 hover:border-blue-300'
                    : hasDiscrepancy
                    ? 'border-amber-200 hover:border-amber-300'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  {/* Left Column: Number & Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono font-black text-sm text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-lg border border-emerald-200">
                        {toPersianDigits(receipt.receiptNumber)}
                      </span>
                      <span className="text-xs text-slate-500 font-medium">
                        (متناظر با فاکتور خرید{' '}
                        <strong className="text-slate-900 font-mono">
                          {toPersianDigits(receipt.purchaseInvoiceNumber)}
                        </strong>
                        )
                      </span>
                      <span className="font-bold text-slate-900 text-sm truncate">
                        {receipt.supplierName}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-2 text-xs text-slate-600">
                      <div>
                        تاریخ صدور:{' '}
                        <span className="text-slate-800 font-mono">
                          {toPersianDigits(receipt.date)}
                        </span>
                      </div>
                      <div>
                        اقلام حواله:{' '}
                        <strong className="text-slate-800">
                          {toPersianDigits(receipt.items.length)} قلم کالا
                        </strong>
                      </div>
                      <div>
                        تعداد مورد انتظار:{' '}
                        <strong className="text-slate-800 font-mono">
                          {toPersianDigits(receipt.totalExpectedQuantity)}
                        </strong>
                      </div>
                      {receipt.verifiedDate && (
                        <div>
                          تایید انباردار:{' '}
                          <span className="text-slate-800 font-mono">
                            {toPersianDigits(receipt.verifiedDate)} ({receipt.verifiedBy || 'انباردار'})
                          </span>
                        </div>
                      )}
                      {receipt.totalDiscrepancy !== 0 && !isPending && (
                        <div>
                          مغایرت:{' '}
                          <strong className={receipt.totalDiscrepancy < 0 ? 'text-rose-700' : 'text-blue-700'}>
                            {toPersianDigits(receipt.totalDiscrepancy)} ({receipt.totalDiscrepancy < 0 ? 'کسری' : 'مازاد'})
                          </strong>
                        </div>
                      )}
                    </div>

                    {receipt.warehouseNotes && (
                      <div className="mt-2 text-[11px] text-slate-600 bg-slate-50 p-2 rounded-xl border border-slate-200 inline-block">
                        <strong>یادداشت انباردار:</strong> {receipt.warehouseNotes}
                      </div>
                    )}
                  </div>

                  {/* Right Column: Status & Actions */}
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {/* Status Badge */}
                    {isPending ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold bg-blue-100 text-blue-800 border border-blue-300 animate-pulse">
                        <Clock className="w-3.5 h-3.5 text-blue-600" />
                        در انتظار شمارش و تایید انباردار
                      </span>
                    ) : hasDiscrepancy ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                        ثبت شده با مغایرت (کسری/مازاد)
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        تایید کامل (ورود به انبار)
                      </span>
                    )}

                    {/* Verification Action Button */}
                    <button
                      type="button"
                      onClick={() => setVerifyingReceipt(receipt)}
                      className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        isPending
                          ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm active:scale-95'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                      }`}
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>{isPending ? 'شمارش و تایید ورود کالا' : 'ویرایش شمارش / مغایرت'}</span>
                    </button>

                    {/* Print Slip Button */}
                    <button
                      type="button"
                      onClick={() => setPrintingReceipt(receipt)}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-colors cursor-pointer"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>چاپ حواله انبار</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
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
