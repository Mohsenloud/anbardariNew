import React, { useState } from 'react';
import {
  Send,
  X,
  CheckCircle2,
  AlertCircle,
  Loader2,
  FileText,
  Bot,
  Settings,
  HelpCircle,
  ExternalLink,
  MessageSquare,
  Building2,
  User
} from 'lucide-react';
import { StoreSettings } from '../types';
import { isTelegramConfigured, sendPdfToTelegram } from '../utils/telegramService';
import { toPersianDigits } from '../utils/jalali';

interface TelegramSendPdfModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings?: StoreSettings;
  pdfBlobGenerator: () => Promise<{ success: boolean; blob?: Blob; file?: File; error?: string }>;
  defaultFilename: string;
  defaultCaption: string;
  documentTitle: string; // e.g. "فاکتور فروش شماره ۱۴۰۳-۱۰۲" or "حواله خروج انبار شماره ۱۰۲"
  customerTelegramChatId?: string;
  customerName?: string;
  onNavigateToAdmin?: () => void;
}

export const TelegramSendPdfModal: React.FC<TelegramSendPdfModalProps> = ({
  isOpen,
  onClose,
  settings,
  pdfBlobGenerator,
  defaultFilename,
  defaultCaption,
  documentTitle,
  customerTelegramChatId,
  customerName,
  onNavigateToAdmin,
}) => {
  const configured = isTelegramConfigured(settings);

  // Target destination mode
  type DestinationType = 'default' | 'customer' | 'custom';
  const [destType, setDestType] = useState<DestinationType>(
    customerTelegramChatId ? 'customer' : 'default'
  );
  const [customChatId, setCustomChatId] = useState<string>('');
  const [caption, setCaption] = useState<string>(defaultCaption);
  const [isSending, setIsSending] = useState<boolean>(false);
  const [status, setStatus] = useState<{
    type: 'idle' | 'success' | 'error';
    message?: string;
  }>({ type: 'idle' });

  if (!isOpen) return null;

  const getEffectiveChatId = (): string => {
    if (destType === 'customer' && customerTelegramChatId) {
      return customerTelegramChatId.trim();
    }
    if (destType === 'custom') {
      return customChatId.trim();
    }
    return (settings?.telegramChatId || '').trim();
  };

  const handleSend = async () => {
    const targetChatId = getEffectiveChatId();
    if (!targetChatId) {
      setStatus({
        type: 'error',
        message: 'لطفاً شناسه چت یا کانال مقصد را مشخص فرمایید.',
      });
      return;
    }

    setIsSending(true);
    setStatus({ type: 'idle' });

    try {
      // 1. Generate the PDF Blob
      const pdfResult = await pdfBlobGenerator();
      if (!pdfResult.success || !pdfResult.blob) {
        setStatus({
          type: 'error',
          message: pdfResult.error || 'خطا در ایجاد فایل PDF برای ارسال.',
        });
        setIsSending(false);
        return;
      }

      // 2. Send via server proxy to Telegram Bot API
      const response = await sendPdfToTelegram({
        botToken: settings?.telegramBotToken,
        chatId: targetChatId,
        pdfBlob: pdfResult.blob,
        filename: defaultFilename,
        caption: caption.trim(),
      });

      if (response.success) {
        setStatus({
          type: 'success',
          message: response.message || 'فایل PDF با موفقیت به تلگرام ارسال شد.',
        });
        setTimeout(() => {
          onClose();
        }, 2200);
      } else {
        setStatus({
          type: 'error',
          message: response.error || 'ارسال به تلگرام ناموفق بود.',
        });
      }
    } catch (err: any) {
      setStatus({
        type: 'error',
        message: 'خطا در برقراری ارتباط: ' + (err?.message || ''),
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs font-['Vazirmatn']">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden border border-slate-200 animate-scaleUp flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="bg-[#229ED9] text-white px-5 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
              <Send className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base">
                ارسال مستقیم فایل PDF به تلگرام
              </h3>
              <p className="text-xs text-white/80 mt-0.5">
                {documentTitle}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs">
          
          {/* Status Message If Not Configured */}
          {!configured ? (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-3">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="font-bold text-amber-900 text-xs sm:text-sm">
                    ربات تلگرام هنوز پیکربندی نشده است
                  </h4>
                  <p className="text-xs text-amber-800 leading-relaxed">
                    جهت ارسال خودکار و مستقیم فایل‌های PDF به تلگرام، باید توکن ربات و شناسه چت را در پنل مدیریت ثبت فرمایید.
                  </p>
                </div>
              </div>

              <div className="pt-2 border-t border-amber-200 flex flex-wrap gap-2">
                {onNavigateToAdmin && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onNavigateToAdmin();
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold transition-all shadow-xs cursor-pointer text-xs"
                  >
                    <Settings className="w-3.5 h-3.5" />
                    <span>رفتن به تنظیمات ربات در پنل مدیریت</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    const text = encodeURIComponent(defaultCaption);
                    const url = `https://t.me/share/url?url=&text=${text}`;
                    window.open(url, '_blank');
                    onClose();
                  }}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white hover:bg-amber-100 text-amber-900 border border-amber-300 font-bold transition-all cursor-pointer text-xs"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>اشتراک‌گذاری معمولی متن در تلگرام</span>
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Bot Active Banner */}
              <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-xs text-emerald-800">
                <div className="flex items-center gap-2">
                  <Bot className="w-4 h-4 text-emerald-600" />
                  <span>ربات تلگرام متصل و آماده ارسال فایل است.</span>
                </div>
                <span className="text-[10px] font-bold bg-emerald-200/70 text-emerald-900 px-2 py-0.5 rounded-md">
                  سرویس فعال
                </span>
              </div>

              {/* Target Destination Choice */}
              <div className="space-y-2">
                <label className="font-bold text-slate-700 flex items-center gap-1 text-xs">
                  <span>مقصد ارسال فایل:</span>
                </label>

                <div className="grid grid-cols-1 gap-2">
                  {/* Option 1: Default Store Chat / Channel */}
                  <label
                    className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 cursor-pointer transition-all ${
                      destType === 'default'
                        ? 'border-[#229ED9] bg-blue-50/60 shadow-2xs'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <input
                        type="radio"
                        name="destType"
                        checked={destType === 'default'}
                        onChange={() => setDestType('default')}
                        className="w-4 h-4 text-[#229ED9] focus:ring-[#229ED9]"
                      />
                      <div>
                        <div className="font-bold text-slate-800 flex items-center gap-1">
                          <Building2 className="w-3.5 h-3.5 text-slate-500" />
                          <span>کانال یا گروه پیش‌فرض فروشگاه</span>
                        </div>
                        <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                          {settings?.telegramChatId || 'تنظیم نشده'}
                        </p>
                      </div>
                    </div>
                    <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-bold">
                      پیش‌فرض سیستم
                    </span>
                  </label>

                  {/* Option 2: Customer Specific Chat (if available) */}
                  {customerTelegramChatId && (
                    <label
                      className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 cursor-pointer transition-all ${
                        destType === 'customer'
                          ? 'border-[#229ED9] bg-blue-50/60 shadow-2xs'
                          : 'border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <input
                          type="radio"
                          name="destType"
                          checked={destType === 'customer'}
                          onChange={() => setDestType('customer')}
                          className="w-4 h-4 text-[#229ED9] focus:ring-[#229ED9]"
                        />
                        <div>
                          <div className="font-bold text-slate-800 flex items-center gap-1">
                            <User className="w-3.5 h-3.5 text-slate-500" />
                            <span>چت‌آیدی اختصاصی خریدار ({customerName || 'مشتری'})</span>
                          </div>
                          <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                            {customerTelegramChatId}
                          </p>
                        </div>
                      </div>
                      <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded font-bold">
                        مشتری
                      </span>
                    </label>
                  )}

                  {/* Option 3: Custom Chat ID */}
                  <label
                    className={`p-2.5 rounded-xl border flex flex-col gap-2 cursor-pointer transition-all ${
                      destType === 'custom'
                        ? 'border-[#229ED9] bg-blue-50/60 shadow-2xs'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <input
                        type="radio"
                        name="destType"
                        checked={destType === 'custom'}
                        onChange={() => setDestType('custom')}
                        className="w-4 h-4 text-[#229ED9] focus:ring-[#229ED9]"
                      />
                      <div className="font-bold text-slate-800">
                        ارسال به شناسه یا کانال دلخواه دیگر
                      </div>
                    </div>
                    {destType === 'custom' && (
                      <div className="pt-1.5 pl-6 animate-fadeIn">
                        <input
                          type="text"
                          dir="ltr"
                          placeholder="مثال: @MyChannel یا 123456789 یا -1001234567890"
                          value={customChatId}
                          onChange={(e) => setCustomChatId(e.target.value)}
                          className="w-full px-3 py-1.5 bg-white border border-blue-300 rounded-lg text-xs font-mono text-left focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                    )}
                  </label>
                </div>
              </div>

              {/* Caption Text Box */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-700 flex items-center gap-1">
                    <MessageSquare className="w-3.5 h-3.5 text-slate-500" />
                    <span>متن کپشن پیام ارسالی:</span>
                  </label>
                  <span className="text-[10px] text-slate-400">همراه با فایل PDF ارسال می‌شود</span>
                </div>
                <textarea
                  rows={4}
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 leading-relaxed focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {/* PDF File Attachment Badge */}
              <div className="p-2.5 bg-slate-100 rounded-xl border border-slate-200 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 text-slate-700">
                  <FileText className="w-4 h-4 text-rose-600" />
                  <span className="font-mono text-[11px] font-bold text-slate-800">{defaultFilename}</span>
                </div>
                <span className="text-[10px] text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">
                  فرمت استاندارد PDF
                </span>
              </div>

              {/* Status Alert */}
              {status.type === 'error' && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl flex items-center gap-2 text-xs animate-shake">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{status.message}</span>
                </div>
              )}

              {status.type === 'success' && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl flex items-center gap-2 text-xs animate-fadeIn">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{status.message}</span>
                </div>
              )}
            </>
          )}

        </div>

        {/* Modal Footer Actions */}
        <div className="p-3 sm:p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-end gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isSending}
            className="w-full sm:w-auto px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 font-bold transition-all cursor-pointer text-center text-xs"
          >
            بستن
          </button>

          {configured && (
            <button
              type="button"
              onClick={handleSend}
              disabled={isSending || status.type === 'success'}
              className="w-full sm:w-auto px-5 py-2 rounded-xl bg-[#229ED9] hover:bg-[#1e8ec4] active:scale-98 text-white font-bold transition-all shadow-md shadow-blue-500/20 cursor-pointer flex items-center justify-center gap-2 text-xs disabled:opacity-50"
            >
              {isSending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>در حال ایجاد PDF و ارسال به تلگرام...</span>
                </>
              ) : status.type === 'success' ? (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>ارسال شد!</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>ارسال مستقیم فایل PDF به تلگرام</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
