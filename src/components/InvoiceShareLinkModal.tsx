import React, { useState, useEffect } from 'react';
import { Invoice, StoreSettings, InvoiceShareLink } from '../types';
import { StorageService } from '../utils/storage';
import { formatPrice, toPersianDigits } from '../utils/jalali';
import {
  Globe,
  X,
  Copy,
  Check,
  ExternalLink,
  ShieldCheck,
  Lock,
  Clock,
  Eye,
  RefreshCw,
  Share2,
  Smartphone,
  MessageCircle,
  Send,
  Power,
  Calendar,
  AlertCircle,
  FileCheck
} from 'lucide-react';

interface InvoiceShareLinkModalProps {
  isOpen: boolean;
  invoice: Invoice | null;
  settings: StoreSettings;
  onClose: () => void;
  onUpdateInvoice?: (updatedInvoice: Invoice) => void;
}

export const InvoiceShareLinkModal: React.FC<InvoiceShareLinkModalProps> = ({
  isOpen,
  invoice,
  settings,
  onClose,
  onUpdateInvoice,
}) => {
  if (!isOpen || !invoice) return null;

  const existingLink = invoice.shareLink;
  const [token, setToken] = useState<string>(existingLink?.token || '');
  const [enabled, setEnabled] = useState<boolean>(existingLink ? existingLink.enabled !== false : true);
  const [isOneTime, setIsOneTime] = useState<boolean>(existingLink?.isOneTime || false);
  const [pinRequired, setPinRequired] = useState<boolean>(existingLink?.pinRequired || false);
  const [pinCode, setPinCode] = useState<string>(existingLink?.pinCode || '');
  const [allowPdfDownload, setAllowPdfDownload] = useState<boolean>(existingLink ? existingLink.allowPdfDownload !== false : true);
  const [expiryPreset, setExpiryPreset] = useState<'never' | '24h' | '3d' | '7d' | '30d'>(() => {
    if (!existingLink?.expiresAt) return 'never';
    const diffHours = (new Date(existingLink.expiresAt).getTime() - Date.now()) / (1000 * 3600);
    if (diffHours <= 26) return '24h';
    if (diffHours <= 75) return '3d';
    if (diffHours <= 175) return '7d';
    return '30d';
  });

  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedText, setCopiedText] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // If no link exists yet, automatically initialize one
  useEffect(() => {
    if (!invoice.shareLink) {
      handleGenerateOrUpdate(false);
    } else {
      setToken(invoice.shareLink.token);
      setEnabled(invoice.shareLink.enabled !== false);
      setIsOneTime(!!invoice.shareLink.isOneTime);
      setPinRequired(!!invoice.shareLink.pinRequired);
      setPinCode(invoice.shareLink.pinCode || '');
      setAllowPdfDownload(invoice.shareLink.allowPdfDownload !== false);
    }
  }, [invoice.id]);

  const calculateExpiresAt = (preset: 'never' | '24h' | '3d' | '7d' | '30d'): string | null => {
    if (preset === 'never') return null;
    const now = new Date();
    const hoursMap = { '24h': 24, '3d': 72, '7d': 168, '30d': 720 };
    now.setHours(now.getHours() + hoursMap[preset]);
    return now.toISOString();
  };

  const handleGenerateOrUpdate = async (regenerate = false) => {
    try {
      setIsSaving(true);
      const computedExpiry = calculateExpiresAt(expiryPreset);
      const res = await StorageService.generateOrUpdateShareLink(invoice.id, {
        enabled,
        expiresAt: computedExpiry,
        isOneTime,
        pinRequired,
        pinCode: pinCode.trim(),
        allowPdfDownload,
        regenerateToken: regenerate,
      });

      if (res.success && res.invoice) {
        if (res.shareLink) {
          setToken(res.shareLink.token);
        }
        if (onUpdateInvoice) {
          onUpdateInvoice(res.invoice);
        }
        showToast(regenerate ? 'پیوند جدید صادر و پیوند قبلی ابطال گردید.' : 'تنظیمات لینک تحت وب ذخیره شد.');
      } else {
        showToast(res.message || 'خطا در ذخیره‌سازی پیوند');
      }
    } catch {
      showToast('خطا در ارتباط با سرور فاکتور');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleEnabled = async () => {
    const nextState = !enabled;
    setEnabled(nextState);
    try {
      setIsSaving(true);
      const res = await StorageService.generateOrUpdateShareLink(invoice.id, {
        enabled: nextState,
        expiresAt: calculateExpiresAt(expiryPreset),
        isOneTime,
        pinRequired,
        pinCode: pinCode.trim(),
        allowPdfDownload,
      });
      if (res.success && res.invoice && onUpdateInvoice) {
        onUpdateInvoice(res.invoice);
      }
      showToast(nextState ? 'پیوند فعال شد.' : 'دسترسی به پیوند مسدود گردید.');
    } finally {
      setIsSaving(false);
    }
  };

  // Helper: auto set PIN from last 4 digits of customer phone
  const handleSetPinFromPhone = () => {
    const cleanPhone = (invoice.customerPhone || '').replace(/[^0-9]/g, '');
    if (cleanPhone.length >= 4) {
      const last4 = cleanPhone.slice(-4);
      setPinCode(last4);
      setPinRequired(true);
      showToast(`پین‌کد به ۴ رقم آخر موبایل (${last4}) تنظیم گردید.`);
    } else {
      showToast('شماره تماس مشتری در فاکتور حداقل ۴ رقم ندارد.');
    }
  };

  const publicUrl = token
    ? StorageService.buildInvoicePublicUrl(token, settings.webInvoiceCustomDomain)
    : '';

  const handleCopyUrl = () => {
    if (!publicUrl) return;
    navigator.clipboard.writeText(publicUrl).then(() => {
      setCopiedLink(true);
      showToast('پیوند نسخه تحت وب کپی شد.');
      setTimeout(() => setCopiedLink(false), 2500);
    });
  };

  // Formatted message text for SMS / Messengers
  const getShareMessageText = (): string => {
    const docTitle = invoice.isProforma ? 'پیش‌فاکتور' : 'فاکتور فروش';
    const storeTitle = settings.storeName || 'فروشگاه سپهر';
    const totalFormatted = formatPrice(invoice.finalTotal, settings.currency);
    const pinPart = pinRequired && pinCode ? `\n🔑 رمز عبور فاکتور: ${toPersianDigits(pinCode)}` : '';

    return [
      `مشتری گرامی ${invoice.customerName}،`,
      `${docTitle} شماره ${toPersianDigits(invoice.invoiceNumber)} شما در «${storeTitle}» صادر شد.`,
      `مبلغ کل: ${totalFormatted}`,
      '',
      `مشاهده آنلاین فاکتور در مرورگر (بدون نیاز به دانلود):`,
      publicUrl,
      pinPart,
      '',
      `با تشکر، ${storeTitle}`,
    ].filter(Boolean).join('\n');
  };

  const handleCopyMessageText = () => {
    const text = getShareMessageText();
    navigator.clipboard.writeText(text).then(() => {
      setCopiedText(true);
      showToast('متن آماده ارسال پیامک کپی شد.');
      setTimeout(() => setCopiedText(false), 2500);
    });
  };

  const handleSendSms = () => {
    const text = encodeURIComponent(getShareMessageText());
    const phone = invoice.customerPhone ? invoice.customerPhone.replace(/[^0-9]/g, '') : '';
    window.open(`sms:${phone}?body=${text}`, '_self');
  };

  const handleSendWhatsApp = () => {
    const text = encodeURIComponent(getShareMessageText());
    const phone = invoice.customerPhone ? invoice.customerPhone.replace(/[^0-9]/g, '') : '';
    const intlPhone = phone.startsWith('09') ? `98${phone.slice(1)}` : phone;
    const url = intlPhone ? `https://api.whatsapp.com/send?phone=${intlPhone}&text=${text}` : `https://api.whatsapp.com/send?text=${text}`;
    window.open(url, '_blank');
  };

  const handleSendTelegram = () => {
    const text = encodeURIComponent(getShareMessageText());
    const url = `https://t.me/share/url?url=${encodeURIComponent(publicUrl)}&text=${text}`;
    window.open(url, '_blank');
  };

  const handleSendEitaa = () => {
    const text = encodeURIComponent(getShareMessageText());
    window.open(`https://eitaa.com/share/url?url=${encodeURIComponent(publicUrl)}&text=${text}`, '_blank');
  };

  const handleSendBale = () => {
    const text = encodeURIComponent(getShareMessageText());
    window.open(`https://ble.ir/share/compile?text=${text}`, '_blank');
  };

  const handleOpenPreview = () => {
    if (!publicUrl) return;
    window.open(publicUrl, '_blank');
  };

  const currentViewCount = Number(existingLink?.viewCount) || 0;
  const isExpired = existingLink?.expiresAt && new Date(existingLink.expiresAt).getTime() < Date.now();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      dir="rtl"
    >
      <div className="bg-white rounded-3xl max-w-xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden text-right font-['Vazirmatn']">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-sky-500/20 text-sky-400 border border-sky-400/30 flex items-center justify-center shrink-0">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-sm sm:text-base">
                  ارسال نسخه تحت وب فاکتور برای مشتری
                </h3>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                فاکتور #{toPersianDigits(invoice.invoiceNumber)} • {invoice.customerName}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 text-xs">
          {/* 1. Primary Public Link Card */}
          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-800">پیوند عمومی نسخه تحت وب:</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                  !enabled
                    ? 'bg-rose-50 text-rose-700 border-rose-200'
                    : isExpired
                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                    : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                }`}>
                  {!enabled ? 'غیرفعال / مسدود' : isExpired ? 'منقضی شده' : 'فعال و آنلاین'}
                </span>
              </div>

              {/* Status Toggle Switch */}
              <button
                type="button"
                onClick={handleToggleEnabled}
                disabled={isSaving}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-xl font-bold text-[11px] transition-all cursor-pointer ${
                  enabled
                    ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200'
                    : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200'
                }`}
                title="قطع یا اتصال آنی دسترسی مشتری به لینک"
              >
                <Power className="w-3.5 h-3.5" />
                <span>{enabled ? 'قطع دسترسی (مسدودسازی)' : 'فعال‌سازی مجدد لینک'}</span>
              </button>
            </div>

            {/* URL Display with Copy Button */}
            <div className="flex items-center gap-2 bg-white rounded-xl border border-slate-300 p-1.5 focus-within:border-sky-500 transition-all">
              <input
                type="text"
                readOnly
                value={publicUrl}
                className="w-full text-left font-mono text-xs text-slate-700 px-2 py-1 outline-none select-all bg-transparent truncate"
                dir="ltr"
              />
              <button
                type="button"
                onClick={handleCopyUrl}
                className="flex items-center gap-1 bg-sky-600 hover:bg-sky-700 active:scale-95 text-white px-3 py-1.5 rounded-lg font-bold text-xs transition-all cursor-pointer shrink-0 shadow-2xs"
              >
                {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedLink ? 'کپی شد' : 'کپی لینک'}</span>
              </button>
              <button
                type="button"
                onClick={handleOpenPreview}
                className="flex items-center gap-1 bg-slate-100 hover:bg-slate-200 text-slate-700 px-2.5 py-1.5 rounded-lg font-bold text-xs transition-all cursor-pointer shrink-0"
                title="مشاهده پیش‌نمایش صفحه مشتری در برگه جدید"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">پیش‌نمایش</span>
              </button>
            </div>

            {/* Statistics pill */}
            <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-200/60">
              <div className="flex items-center gap-1.5">
                <Eye className="w-3.5 h-3.5 text-slate-400" />
                <span>تعداد دفعات بازدید مشتری: <strong className="text-slate-800 font-mono font-bold">{toPersianDigits(currentViewCount)}</strong> بار</span>
              </div>
              {existingLink?.lastViewedAt && (
                <div className="flex items-center gap-1 text-slate-500">
                  <Clock className="w-3 h-3 text-slate-400" />
                  <span>آخرین بازدید: {toPersianDigits(new Date(existingLink.lastViewedAt).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }))}</span>
                </div>
              )}
            </div>
          </div>

          {/* 2. Security & Expiration Settings Card */}
          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 space-y-4">
            <h4 className="font-bold text-slate-800 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>تنظیمات امنیت، انقضا و یکبارمصرف بودن لینک:</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Expiration Preset */}
              <div className="space-y-1.5">
                <label className="text-slate-600 font-medium block">
                  مدت اعتبار پیوند:
                </label>
                <select
                  value={expiryPreset}
                  onChange={(e) => setExpiryPreset(e.target.value as any)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-sky-500/20 cursor-pointer"
                >
                  <option value="never">نامحدود (همیشه معتبر تا زمان ابطال)</option>
                  <option value="24h">۲۴ ساعت (۱ روز آینده)</option>
                  <option value="3d">۳ روز آینده</option>
                  <option value="7d">۷ روز (۱ هفته)</option>
                  <option value="30d">۳۰ روز (۱ ماه)</option>
                </select>
              </div>

              {/* One-Time Link Mode */}
              <div className="flex items-center justify-between p-2.5 bg-white rounded-xl border border-slate-200">
                <div>
                  <span className="font-bold text-slate-800 block">لینک یکبارمصرف</span>
                  <span className="text-[11px] text-slate-400">پس از ۱ بار باز شدن توسط مشتری باطل می‌شود</span>
                </div>
                <input
                  type="checkbox"
                  checked={isOneTime}
                  onChange={(e) => setIsOneTime(e.target.checked)}
                  className="w-4 h-4 text-sky-600 rounded cursor-pointer"
                />
              </div>

              {/* PIN Code Protection */}
              <div className="sm:col-span-2 bg-white rounded-xl p-3 border border-slate-200 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Lock className="w-4 h-4 text-indigo-600" />
                    <div>
                      <span className="font-bold text-slate-800">حفاظت با رمز عبور / پین‌کد</span>
                      <span className="text-[11px] text-slate-400 block">مشتری برای باز کردن باید رمز را وارد کند</span>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={pinRequired}
                    onChange={(e) => setPinRequired(e.target.checked)}
                    className="w-4 h-4 text-indigo-600 rounded cursor-pointer"
                  />
                </div>

                {pinRequired && (
                  <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row items-center gap-2">
                    <input
                      type="text"
                      placeholder="پین ۴ یا ۶ رقمی (مثلاً ۱۲۳۴)"
                      value={pinCode}
                      onChange={(e) => setPinCode(e.target.value)}
                      className="w-full sm:w-44 px-3 py-1.5 text-center font-mono font-bold text-xs bg-slate-50 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                    {invoice.customerPhone && (
                      <button
                        type="button"
                        onClick={handleSetPinFromPhone}
                        className="text-[11px] font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-3 py-1.5 rounded-xl transition-colors cursor-pointer whitespace-nowrap"
                      >
                        تنظیم ۴ رقم آخر موبایل ({invoice.customerPhone.slice(-4)})
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Allow PDF Download on Web View */}
              <div className="sm:col-span-2 flex items-center justify-between p-2.5 bg-white rounded-xl border border-slate-200">
                <div>
                  <span className="font-bold text-slate-800 block">اجازه دانلود فایل PDF و چاپ توسط مشتری</span>
                  <span className="text-[11px] text-slate-400">دکمه‌های دانلود PDF و چاپ فاکتور در صفحه وب مشتری نمایش داده شوند</span>
                </div>
                <input
                  type="checkbox"
                  checked={allowPdfDownload}
                  onChange={(e) => setAllowPdfDownload(e.target.checked)}
                  className="w-4 h-4 text-emerald-600 rounded cursor-pointer"
                />
              </div>
            </div>

            {/* Save Settings Button */}
            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => handleGenerateOrUpdate(true)}
                disabled={isSaving}
                className="text-[11px] font-bold text-slate-600 hover:text-slate-900 flex items-center gap-1 hover:underline cursor-pointer"
                title="تولید یک توکن کاملاً تازه و باطل کردن نشانی قبلی"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>تولید مجدد لینک جدید (ابطال لینک قبلی)</span>
              </button>

              <button
                type="button"
                onClick={() => handleGenerateOrUpdate(false)}
                disabled={isSaving}
                className="bg-slate-900 hover:bg-slate-800 active:scale-98 text-white px-4 py-2 rounded-xl font-bold text-xs transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
              >
                {isSaving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <FileCheck className="w-3.5 h-3.5 text-emerald-400" />}
                <span>ذخیره تنظیمات لینک</span>
              </button>
            </div>
          </div>

          {/* 3. Ready-to-Send SMS & Messenger Dispatch */}
          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-800 flex items-center gap-1.5">
                <Smartphone className="w-4 h-4 text-sky-600" />
                <span>ارسال مستقیم متن و لینک به پیام‌رسان‌ها:</span>
              </span>
              <button
                type="button"
                onClick={handleCopyMessageText}
                className="flex items-center gap-1 text-[11px] font-bold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
              >
                {copiedText ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                <span>{copiedText ? 'کپی شد' : 'کپی متن پیامک'}</span>
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {/* SMS */}
              <button
                type="button"
                onClick={handleSendSms}
                className="flex items-center justify-center gap-1.5 bg-slate-800 hover:bg-slate-900 active:scale-95 text-white py-2 px-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer shadow-2xs"
              >
                <Smartphone className="w-3.5 h-3.5 text-sky-400" />
                <span>پیامک (SMS)</span>
              </button>

              {/* WhatsApp */}
              <button
                type="button"
                onClick={handleSendWhatsApp}
                className="flex items-center justify-center gap-1.5 bg-[#25D366] hover:bg-[#1EBE5D] active:scale-95 text-white py-2 px-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer shadow-2xs"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                <span>واتساپ</span>
              </button>

              {/* Telegram */}
              <button
                type="button"
                onClick={handleSendTelegram}
                className="flex items-center justify-center gap-1.5 bg-[#229ED9] hover:bg-[#1C8AC2] active:scale-95 text-white py-2 px-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer shadow-2xs"
              >
                <Send className="w-3.5 h-3.5" />
                <span>تلگرام</span>
              </button>

              {/* Eitaa */}
              <button
                type="button"
                onClick={handleSendEitaa}
                className="flex items-center justify-center gap-1.5 bg-amber-600 hover:bg-amber-700 active:scale-95 text-white py-2 px-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer shadow-2xs"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>ایتا</span>
              </button>

              {/* Bale */}
              <button
                type="button"
                onClick={handleSendBale}
                className="flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white py-2 px-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer shadow-2xs col-span-2 sm:col-span-1"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                <span>بله</span>
              </button>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="bg-slate-50 border-t border-slate-200 px-5 py-3 flex items-center justify-between">
          {toastMessage && (
            <span className="text-xs text-emerald-800 font-bold bg-emerald-50 px-3 py-1 rounded-xl border border-emerald-200">
              {toastMessage}
            </span>
          )}
          <div className="flex items-center gap-2 mr-auto">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
            >
              بستن پنجره
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
