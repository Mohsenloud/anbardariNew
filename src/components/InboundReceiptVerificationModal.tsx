import React, { useState } from 'react';
import { InboundReceipt, InboundReceiptItem, AppUser } from '../types';
import { toPersianDigits, getCurrentJalaliDate, formatNumber } from '../utils/jalali';
import { StorageService } from '../utils/storage';
import { NumericInput } from './NumericInput';
import { 
  CheckCircle2, 
  AlertTriangle, 
  X, 
  Package, 
  Check, 
  ArrowRight, 
  RotateCcw, 
  FileText,
  Printer,
  Send
} from 'lucide-react';

interface InboundReceiptVerificationModalProps {
  receipt: InboundReceipt;
  currentUser?: AppUser;
  onClose: () => void;
  onConfirm: (
    receiptId: string,
    verifiedItems: InboundReceiptItem[],
    warehouseNotes: string,
    verifiedBy: string
  ) => void;
  onPrint?: (receipt: InboundReceipt) => void;
}

export const InboundReceiptVerificationModal: React.FC<InboundReceiptVerificationModalProps> = ({
  receipt,
  currentUser,
  onClose,
  onConfirm,
  onPrint,
}) => {
  // Local state for items
  const [items, setItems] = useState<InboundReceiptItem[]>(() => {
    return receipt.items.map((item) => ({
      ...item,
      // Default to expectedQuantity if not already set or if 0
      receivedQuantity:
        item.receivedQuantity > 0 ? item.receivedQuantity : item.expectedQuantity,
      discrepancy:
        item.receivedQuantity > 0
          ? item.receivedQuantity - item.expectedQuantity
          : 0,
      discrepancyReason: item.discrepancyReason || '',
    }));
  });

  const [warehouseNotes, setWarehouseNotes] = useState(
    receipt.warehouseNotes || ''
  );
  const [verifiedByName, setVerifiedByName] = useState(
    receipt.verifiedBy || currentUser?.fullName || 'مسئول انبار'
  );

  const handleQuantityChange = (index: number, newQty: number) => {
    const validQty = Math.max(0, isNaN(newQty) ? 0 : newQty);
    setItems((prev) => {
      const copy = [...prev];
      const itm = copy[index];
      const diff = validQty - itm.expectedQuantity;
      copy[index] = {
        ...itm,
        receivedQuantity: validQty,
        discrepancy: diff,
        // If discrepancy becomes 0, optionally clear reason
        discrepancyReason: diff === 0 ? '' : itm.discrepancyReason,
      };
      return copy;
    });
  };

  const handleReasonChange = (index: number, reason: string) => {
    setItems((prev) => {
      const copy = [...prev];
      copy[index] = {
        ...copy[index],
        discrepancyReason: reason,
      };
      return copy;
    });
  };

  // Match all items to expected in one click
  const handleAutoMatchAll = () => {
    setItems((prev) =>
      prev.map((item) => ({
        ...item,
        receivedQuantity: item.expectedQuantity,
        discrepancy: 0,
        discrepancyReason: '',
      }))
    );
  };

  const totalExpected = items.reduce((sum, i) => sum + i.expectedQuantity, 0);
  const totalReceived = items.reduce((sum, i) => sum + i.receivedQuantity, 0);
  const totalDiscrepancy = totalReceived - totalExpected;
  const hasDiscrepancy = items.some((i) => i.discrepancy !== 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirm(receipt.id, items, warehouseNotes, verifiedByName);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
      <div className="bg-white w-full max-w-3xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[94vh] animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-700 via-teal-700 to-emerald-800 text-white p-4 sm:p-6 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-emerald-100 shadow-inner">
              <Package className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-white">
                شمارش و تایید ورود کالا به انبار
              </h2>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-emerald-100 mt-1">
                <span>
                  حواله ورود:{' '}
                  <strong className="text-white font-mono">
                    {toPersianDigits(receipt.receiptNumber)}
                  </strong>
                </span>
                <span>•</span>
                <span>
                  فاکتور خرید:{' '}
                  <strong className="text-white font-mono">
                    {toPersianDigits(receipt.purchaseInvoiceNumber)}
                  </strong>
                </span>
                <span>•</span>
                <span>تامین‌کننده: {receipt.supplierName}</span>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-white/80 hover:text-white rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content & Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {/* Quick Actions & Status Banner */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-slate-50 rounded-2xl border border-slate-200 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-700">راهنما:</span>
              <span className="text-slate-500">
                تعداد فیزیکی تحویل گرفته شده را وارد کنید. سیستم کسری یا مازاد را خودکار محاسبه می‌کند.
              </span>
            </div>
            <button
              type="button"
              onClick={handleAutoMatchAll}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-emerald-300 text-emerald-700 font-bold hover:bg-emerald-50 active:scale-95 transition-all shadow-2xs cursor-pointer"
            >
              <Check className="w-4 h-4 text-emerald-600" />
              <span>تطبیق کامل همه اقلام (بدون مغایرت)</span>
            </button>
          </div>

          {/* Items Verification List */}
          <div className="space-y-3">
            <div className="text-xs font-bold text-slate-700 flex items-center justify-between px-1">
              <span>اقلام حواله ورود ({toPersianDigits(items.length)} قلم کالا)</span>
              <span className="text-[11px] text-slate-500">
                مجموع فاکتور: {toPersianDigits(totalExpected)} | مجموع شمارش انبار: {toPersianDigits(totalReceived)}
              </span>
            </div>

            {items.map((item, idx) => {
              const diff = item.discrepancy;
              const hasDiff = diff !== 0;

              return (
                <div
                  key={item.id || idx}
                  className={`p-4 rounded-2xl border transition-all ${
                    hasDiff
                      ? diff < 0
                        ? 'bg-rose-50/40 border-rose-200'
                        : 'bg-blue-50/40 border-blue-200'
                      : 'bg-white border-slate-200 hover:border-emerald-300'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    {/* Item Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-600 font-mono text-[11px] font-bold flex items-center justify-center shrink-0">
                          {toPersianDigits(idx + 1)}
                        </span>
                        <h4 className="font-bold text-slate-900 text-sm truncate">
                          {item.productName}
                        </h4>
                        <span className="text-[11px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-mono">
                          کد: {toPersianDigits(item.productCode)}
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-slate-500 flex items-center gap-2 mr-7">
                        <span>تعداد در فاکتور خرید:</span>
                        <strong className="text-slate-800 font-mono">
                          {toPersianDigits(item.expectedQuantity)} {item.unit || 'عدد'}
                        </strong>
                      </div>
                    </div>

                    {/* Quantity Input & Counter */}
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="flex items-center bg-white rounded-xl border border-slate-300 shadow-2xs overflow-hidden">
                        <button
                          type="button"
                          onClick={() => handleQuantityChange(idx, item.receivedQuantity - 1)}
                          className="px-3 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold border-l border-slate-200 cursor-pointer"
                        >
                          -
                        </button>
                        <div className="w-24">
                          <NumericInput
                            min={0}
                            value={item.receivedQuantity}
                            onChange={(num) => handleQuantityChange(idx, num)}
                            textAlign="center"
                            className="w-full text-center py-2 font-mono font-black text-sm text-slate-900 focus:outline-none"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => handleQuantityChange(idx, item.receivedQuantity + 1)}
                          className="px-3 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold border-r border-slate-200 cursor-pointer"
                        >
                          +
                        </button>
                      </div>

                      {/* Discrepancy Status Badge */}
                      <div className="w-28 text-center">
                        {diff === 0 ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 text-xs font-bold">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            کامل
                          </span>
                        ) : diff < 0 ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-100 text-rose-800 text-xs font-bold">
                            <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                            {toPersianDigits(Math.abs(diff))} کسری
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-100 text-blue-800 text-xs font-bold">
                            +{toPersianDigits(diff)} مازاد
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Discrepancy Reason Input (Shown if there's discrepancy) */}
                  {hasDiff && (
                    <div className="mt-3 pt-3 border-t border-slate-200/80 mr-7 animate-in fade-in duration-150">
                      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
                        <label className="text-xs font-semibold text-rose-700 shrink-0 flex items-center gap-1">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          علت و شرح مغایرت:
                        </label>
                        <input
                          type="text"
                          required
                          value={item.discrepancyReason || ''}
                          onChange={(e) => handleReasonChange(idx, e.target.value)}
                          placeholder="مثلاً: کسری باربری بین‌راهی، شکستگی در کارتن، عدم ارسال توسط تامین‌کننده..."
                          className="w-full text-xs px-3 py-1.5 rounded-xl border border-rose-300 bg-white focus:outline-none focus:ring-2 focus:ring-rose-500 text-slate-800"
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Warehouse Keeper Info & Notes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                نام انباردار / تحویل‌گیرنده کالا:
              </label>
              <input
                type="text"
                required
                value={verifiedByName}
                onChange={(e) => setVerifiedByName(e.target.value)}
                placeholder="نام و نام خانوادگی انباردار"
                className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                تاریخ تحویل و شمارش:
              </label>
              <input
                type="text"
                readOnly
                value={toPersianDigits(getCurrentJalaliDate())}
                className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-100 text-slate-600 font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              یادداشت و ملاحظات انباردار (اختیاری):
            </label>
            <textarea
              rows={2}
              value={warehouseNotes}
              onChange={(e) => setWarehouseNotes(e.target.value)}
              placeholder="مثلاً شماره بارنامه، نام راننده، وضعیت بسته‌بندی، یا توضیحات اضافی..."
              className="w-full text-xs p-3 rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-800"
            />
          </div>

          {/* Summary Warning Box */}
          {hasDiscrepancy ? (
            <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-300 text-amber-900 text-xs flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
              <div>
                <strong>ثبت با مغایرت:</strong> موجودی انبار بر اساس تعداد واقعی شمارش شده ({toPersianDigits(totalReceived)} قلم) افزایش خواهد یافت و فاکتور خرید با وضعیت «دارای مغایرت» ثبت می‌شود تا با تامین‌کننده پیگیری گردد.
              </div>
            </div>
          ) : (
            <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>همه اقلام بدون هیچ‌گونه مغایرتی با فاکتور خرید مطابقت دارند.</span>
            </div>
          )}

          {/* Actions Footer */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-200">
            <div className="flex items-center gap-2 flex-wrap">
              {onPrint && (
                <button
                  type="button"
                  onClick={() => onPrint(receipt)}
                  className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-700 font-bold text-xs hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  <Printer className="w-4 h-4 text-slate-500" />
                  <span>چاپ برگه حواله ورود</span>
                </button>
              )}

              {StorageService.getSettings()?.telegramBotEnabled && StorageService.getSettings()?.telegramAutoSendInboundReceipt && (
                <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-sky-50 border border-sky-200 text-[#1C8AC2] text-[11px] font-bold">
                  <Send className="w-3.5 h-3.5 text-[#229ED9]" />
                  <span>ارسال خودکار به تلگرام پس از تأیید فعال است</span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl text-slate-600 hover:bg-slate-100 font-bold text-xs transition-colors cursor-pointer"
              >
                انصراف
              </button>
              <button
                type="submit"
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs text-white shadow-md transition-all active:scale-95 cursor-pointer ${
                  hasDiscrepancy
                    ? 'bg-amber-600 hover:bg-amber-700'
                    : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>
                  {hasDiscrepancy
                    ? 'تأیید نهایی، ثبت مغایرت و افزایش موجودی انبار'
                    : 'تأیید نهایی و افزایش موجودی انبار'}
                </span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
