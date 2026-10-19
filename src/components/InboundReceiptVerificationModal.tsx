import React, { useState } from 'react';
import { InboundReceipt, InboundReceiptItem, AppUser } from '../types';
import { toPersianDigits, getCurrentJalaliDate } from '../utils/jalali';
import { StorageService } from '../utils/storage';
import { NumericInput } from './NumericInput';
import { 
  CheckCircle2, 
  AlertTriangle, 
  X, 
  Package, 
  Check, 
  Printer,
  Send,
  ChevronDown,
  ChevronUp,
  UserCheck,
  FileText
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
  const [items, setItems] = useState<InboundReceiptItem[]>(() => {
    return receipt.items.map((item) => ({
      ...item,
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
  const [showOptionalNotes, setShowOptionalNotes] = useState<boolean>(() =>
    Boolean(receipt.warehouseNotes)
  );
  const [showVoiceTranscript, setShowVoiceTranscript] = useState<boolean>(false);

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
  const hasDiscrepancy = items.some((i) => i.discrepancy !== 0);
  const discrepancyItemsCount = items.filter((i) => i.discrepancy !== 0).length;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirm(receipt.id, items, warehouseNotes, verifiedByName);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
      <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[94vh] border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
        {/* Compact Header */}
        <div className="bg-slate-900 text-white px-4 py-3 flex items-center justify-between shrink-0 border-b border-slate-800">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
              <Package className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-sm sm:text-base font-black text-white">
                  <span>شمارش و تایید ورود کالا به انبار</span>
                </h2>
                <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded-lg bg-slate-800 text-emerald-300 border border-slate-700">
                  #{toPersianDigits(receipt.receiptNumber)}
                </span>
                {receipt.source === 'telegram_voice' && (
                  <span className="bg-sky-500/20 text-sky-300 border border-sky-400/30 text-[10px] font-bold px-2 py-0.5 rounded-full">
                    🎙️ ثبت صوتی
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[11px] text-slate-400 mt-0.5">
                {receipt.source === 'telegram_voice' ? (
                  <span>
                    فرستنده: <strong className="text-slate-200">{receipt.voiceSender?.firstName || receipt.supplierName || 'کاربر تلگرام'}</strong>
                  </span>
                ) : (
                  <span>
                    فاکتور خرید: <strong className="text-slate-200 font-mono">{toPersianDigits(receipt.purchaseInvoiceNumber)}</strong>
                  </span>
                )}
                <span>•</span>
                <span className="truncate">طرف‌حساب: <strong className="text-slate-200">{receipt.supplierName}</strong></span>
                <span>•</span>
                <span className="font-mono">{toPersianDigits(getCurrentJalaliDate())}</span>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer shrink-0"
            title="بستن"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3">
          {/* Compact Collapsible Voice Transcription Box (if created from voice) */}
          {receipt.voiceTranscription && (
            <div className="bg-sky-50/80 border border-sky-200 rounded-xl p-2.5 text-xs">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 font-bold text-sky-900 truncate">
                  <span>🎙️</span>
                  <span className="truncate">متن ویس تلگرام: «{receipt.voiceTranscription}»</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowVoiceTranscript(!showVoiceTranscript)}
                  className="text-[11px] text-sky-700 hover:text-sky-900 font-bold shrink-0 flex items-center gap-0.5 cursor-pointer"
                >
                  <span>{showVoiceTranscript ? 'بستن' : 'مشاهده کامل'}</span>
                  {showVoiceTranscript ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
              </div>
              {showVoiceTranscript && (
                <p className="mt-2 text-xs text-sky-950 bg-white p-2.5 rounded-lg border border-sky-100 leading-relaxed">
                  «{receipt.voiceTranscription}»
                </p>
              )}
            </div>
          )}

          {/* Top Bar: Summary & One-Click Match All */}
          <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-slate-50 rounded-xl border border-slate-200/90 text-xs">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="font-bold text-slate-700">
                اقلام حواله: <strong className="font-mono text-slate-900">{toPersianDigits(items.length)}</strong> ردیف
              </span>
              <span className="text-slate-300">|</span>
              <span className="text-slate-600">
                جمع فاکتور: <strong className="font-mono text-slate-900">{toPersianDigits(totalExpected)}</strong>
              </span>
              <span className="text-slate-300">|</span>
              <span className="text-slate-600">
                شمارش انبار: <strong className={`font-mono font-black ${hasDiscrepancy ? 'text-amber-700' : 'text-emerald-700'}`}>{toPersianDigits(totalReceived)}</strong>
              </span>
            </div>

            {hasDiscrepancy && (
              <button
                type="button"
                onClick={handleAutoMatchAll}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold hover:bg-emerald-100 active:scale-95 transition-all cursor-pointer text-[11px]"
              >
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span>تطبیق همه با فاکتور</span>
              </button>
            )}
          </div>

          {/* Streamlined Items Table / List */}
          <div className="border border-slate-200 rounded-xl overflow-hidden bg-white divide-y divide-slate-100">
            {/* Desktop Header */}
            <div className="hidden sm:grid sm:grid-cols-12 gap-2 px-3 py-2 bg-slate-100/80 text-[11px] font-bold text-slate-600">
              <div className="col-span-5">شرح کالا و کد</div>
              <div className="col-span-2 text-center">تعداد فاکتور</div>
              <div className="col-span-3 text-center">تعداد شمارش شده</div>
              <div className="col-span-2 text-center">وضعیت</div>
            </div>

            {items.map((item, idx) => {
              const diff = item.discrepancy;
              const hasDiff = diff !== 0;

              return (
                <div
                  key={item.id || idx}
                  className={`p-2.5 sm:px-3 sm:py-2 transition-colors ${
                    hasDiff
                      ? diff < 0
                        ? 'bg-rose-50/40'
                        : 'bg-blue-50/40'
                      : idx % 2 === 1
                      ? 'bg-slate-50/40'
                      : 'bg-white'
                  }`}
                >
                  <div className="flex flex-col sm:grid sm:grid-cols-12 gap-2 sm:items-center">
                    {/* 1. Product Name & Code */}
                    <div className="sm:col-span-5 flex items-center gap-2 min-w-0">
                      <span className="w-5 h-5 rounded-md bg-slate-100 text-slate-600 font-mono text-[10px] font-bold flex items-center justify-center shrink-0">
                        {toPersianDigits(idx + 1)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-slate-900 text-xs sm:text-[13px] truncate" title={item.productName}>
                          {item.productName}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono flex items-center gap-2">
                          <span>کد: {toPersianDigits(item.productCode)}</span>
                          <span className="sm:hidden text-slate-600 font-sans">
                            • فاکتور: <strong className="font-mono">{toPersianDigits(item.expectedQuantity)} {item.unit || 'عدد'}</strong>
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* 2. Expected Qty (Desktop) */}
                    <div className="hidden sm:flex sm:col-span-2 items-center justify-center">
                      <span className="font-mono font-bold text-xs text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md">
                        {toPersianDigits(item.expectedQuantity)} <span className="text-[10px] font-normal text-slate-500 font-sans">{item.unit || 'عدد'}</span>
                      </span>
                    </div>

                    {/* 3. Counter Controls */}
                    <div className="sm:col-span-3 flex items-center justify-between sm:justify-center gap-2">
                      <span className="sm:hidden text-[11px] text-slate-500 font-medium">تعداد تحویلی:</span>
                      <div className="inline-flex items-center bg-white rounded-lg border border-slate-300 overflow-hidden shadow-2xs">
                        <button
                          type="button"
                          onClick={() => handleQuantityChange(idx, item.receivedQuantity - 1)}
                          className="w-7 h-7 bg-slate-50 hover:bg-slate-100 active:bg-slate-200 text-slate-700 font-bold border-l border-slate-200 flex items-center justify-center cursor-pointer"
                        >
                          -
                        </button>
                        <div className="w-16">
                          <NumericInput
                            min={0}
                            value={item.receivedQuantity}
                            onChange={(num) => handleQuantityChange(idx, num)}
                            textAlign="center"
                            className="w-full text-center py-1 font-mono font-black text-xs text-slate-900 focus:outline-none"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => handleQuantityChange(idx, item.receivedQuantity + 1)}
                          className="w-7 h-7 bg-slate-50 hover:bg-slate-100 active:bg-slate-200 text-slate-700 font-bold border-r border-slate-200 flex items-center justify-center cursor-pointer"
                        >
                          +
                        </button>
                      </div>
                    </div>

                    {/* 4. Discrepancy Status Badge */}
                    <div className="sm:col-span-2 flex items-center justify-end sm:justify-center">
                      {diff === 0 ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200/80 text-[11px] font-bold">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <span>مطابق</span>
                        </span>
                      ) : diff < 0 ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 text-[11px] font-bold font-mono">
                          <AlertTriangle className="w-3 h-3 text-rose-600 shrink-0" />
                          <span>{toPersianDigits(Math.abs(diff))} کسری</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 text-[11px] font-bold font-mono">
                          <span>+{toPersianDigits(diff)} مازاد</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Inline Discrepancy Reason Input (only when diff !== 0) */}
                  {hasDiff && (
                    <div className="mt-2 pt-2 border-t border-rose-200/60 flex flex-col sm:flex-row items-stretch sm:items-center gap-1.5">
                      <label className="text-[11px] font-bold text-rose-700 shrink-0 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        <span>علت مغایرت:</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={item.discrepancyReason || ''}
                        onChange={(e) => handleReasonChange(idx, e.target.value)}
                        placeholder="علت کسری یا مازاد را بنویسید (الزامی)..."
                        className="flex-1 text-xs px-2.5 py-1 rounded-lg border border-rose-300 bg-white focus:outline-none focus:ring-1 focus:ring-rose-500 text-slate-800"
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Compact Verifier & Optional Notes Row */}
          <div className="bg-slate-50/90 rounded-xl border border-slate-200/80 p-3 space-y-2.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="flex items-center gap-2 flex-1">
                <label className="text-xs font-bold text-slate-700 shrink-0 flex items-center gap-1">
                  <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>تحویل‌گیرنده (انباردار):</span>
                </label>
                <input
                  type="text"
                  required
                  value={verifiedByName}
                  onChange={(e) => setVerifiedByName(e.target.value)}
                  placeholder="نام و نام خانوادگی انباردار"
                  className="flex-1 max-w-xs text-xs px-3 py-1.5 rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-bold text-slate-800"
                />
              </div>

              <button
                type="button"
                onClick={() => setShowOptionalNotes(!showOptionalNotes)}
                className="text-xs font-bold text-slate-600 hover:text-slate-900 flex items-center gap-1 cursor-pointer self-start sm:self-auto"
              >
                <FileText className="w-3.5 h-3.5 text-slate-400" />
                <span>{showOptionalNotes ? 'بستن توضیحات تکمیلی' : '+ افزودن یادداشت یا شماره بارنامه'}</span>
                {showOptionalNotes ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            </div>

            {showOptionalNotes && (
              <div className="pt-1 animate-in fade-in duration-100">
                <input
                  type="text"
                  value={warehouseNotes}
                  onChange={(e) => setWarehouseNotes(e.target.value)}
                  placeholder="توضیحات انباردار (شماره بارنامه، نام راننده، وضعیت بسته‌بندی و...)"
                  className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-slate-800"
                />
              </div>
            )}
          </div>

          {/* Slim Discrepancy Alert (Only shown when there is a discrepancy) */}
          {hasDiscrepancy && (
            <div className="px-3 py-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                <strong>ثبت با مغایرت ({toPersianDigits(discrepancyItemsCount)} ردیف):</strong> موجودی انبار معادل شمارش واقعی ({toPersianDigits(totalReceived)} واحد) افزایش یافته و فاکتور خرید جهت پیگیری علامت‌گذاری می‌شود.
              </span>
            </div>
          )}

          {/* Actions Footer */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2.5 border-t border-slate-200">
            <div className="flex items-center gap-2">
              {onPrint && (
                <button
                  type="button"
                  onClick={() => onPrint(receipt)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-300 bg-white text-slate-700 font-bold text-xs hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5 text-slate-500" />
                  <span>چاپ حواله</span>
                </button>
              )}

              {StorageService.getSettings()?.telegramBotEnabled && StorageService.getSettings()?.telegramAutoSendInboundReceipt && (
                <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-sky-50 border border-sky-200 text-sky-800 text-[11px] font-bold" title="ارسال خودکار گزارش به تلگرام پس از تایید">
                  <Send className="w-3 h-3 text-[#229ED9]" />
                  <span>ارسال خودکار تلگرام</span>
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-bold text-xs transition-colors cursor-pointer"
              >
                انصراف
              </button>
              <button
                type="submit"
                className={`flex items-center gap-1.5 px-5 py-2 rounded-xl font-black text-xs sm:text-sm text-white shadow-sm transition-all active:scale-95 cursor-pointer ${
                  hasDiscrepancy
                    ? 'bg-amber-600 hover:bg-amber-700'
                    : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>
                  {hasDiscrepancy
                    ? 'تأیید شمارش (با مغایرت) و ورود به انبار'
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
