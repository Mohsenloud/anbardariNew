import React, { useState, useEffect, useMemo } from 'react';
import QRCode from 'qrcode';
import { Invoice, StoreSettings } from '../types';
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
  Smartphone,
  MessageCircle,
  Send,
  Power,
  AlertCircle,
  FileCheck,
  QrCode,
  Download,
  Calendar,
} from 'lucide-react';

interface InvoiceShareLinkModalProps {
  isOpen: boolean;
  invoice: Invoice | null;
  settings: StoreSettings;
  onClose: () => void;
  onUpdateInvoice?: (updatedInvoice: Invoice) => void;
}

type ExpiryPreset = 'never' | '24h' | '3d' | '7d' | '30d';

function presetFromHours(hours?: number): ExpiryPreset {
  if (!hours || hours <= 0) return 'never';
  if (hours <= 26) return '24h';
  if (hours <= 75) return '3d';
  if (hours <= 175) return '7d';
  return '30d';
}

function presetFromExpiresAt(expiresAt?: string | null): ExpiryPreset {
  if (!expiresAt) return 'never';
  const diffHours = (new Date(expiresAt).getTime() - Date.now()) / (1000 * 3600);
  if (diffHours <= 0) return '24h';
  return presetFromHours(diffHours);
}

function calculateExpiresAt(preset: ExpiryPreset): string | null {
  if (preset === 'never') return null;
  const now = new Date();
  const hoursMap: Record<Exclude<ExpiryPreset, 'never'>, number> = {
    '24h': 24,
    '3d': 72,
    '7d': 168,
    '30d': 720,
  };
  now.setHours(now.getHours() + hoursMap[preset]);
  return now.toISOString();
}

function extractLast4Phone(phone?: string): string {
  const clean = String(phone || '').replace(/[^0-9]/g, '');
  return clean.length >= 4 ? clean.slice(-4) : '';
}

export const InvoiceShareLinkModal: React.FC<InvoiceShareLinkModalProps> = ({
  isOpen,
  invoice,
  settings,
  onClose,
  onUpdateInvoice,
}) => {
  const isGloballyDisabled = settings.webInvoiceEnabled === false;

  const [token, setToken] = useState<string>('');
  const [enabled, setEnabled] = useState<boolean>(true);
  const [isOneTime, setIsOneTime] = useState<boolean>(false);
  const [maxViews, setMaxViews] = useState<number>(0);
  const [pinRequired, setPinRequired] = useState<boolean>(false);
  const [pinCode, setPinCode] = useState<string>('');
  const [allowPdfDownload, setAllowPdfDownload] = useState<boolean>(true);
  const [includeCustomerStatement, setIncludeCustomerStatement] = useState<boolean>(true);
  const [expiryPreset, setExpiryPreset] = useState<ExpiryPreset>('never');
  const [currentViewCount, setCurrentViewCount] = useState<number>(0);
  const [lastViewedAt, setLastViewedAt] = useState<string | null>(null);
  const [expiresAtIso, setExpiresAtIso] = useState<string | null>(null);

  const [showQr, setShowQr] = useState<boolean>(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedText, setCopiedText] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  useEffect(() => {
    if (!isOpen || !invoice) return;

    const existing = invoice.shareLink;
    if (existing?.token) {
      setToken(existing.token);
      setEnabled(existing.enabled !== false);
      setIsOneTime(!!existing.isOneTime);
      setMaxViews(existing.maxViews && existing.maxViews > 0 ? existing.maxViews : 0);
      setPinRequired(!!existing.pinRequired);
      setPinCode(existing.pinCode || '');
      setAllowPdfDownload(existing.allowPdfDownload !== false);
      setIncludeCustomerStatement(existing.includeCustomerStatement !== false);
      setExpiryPreset(presetFromExpiresAt(existing.expiresAt));
      setCurrentViewCount(Number(existing.viewCount) || 0);
      setLastViewedAt(existing.lastViewedAt || null);
      setExpiresAtIso(existing.expiresAt || null);
      return;
    }

    // Apply store defaults when issuing a brand-new link
    const defaultPreset = presetFromHours(settings.webInvoiceDefaultExpiryHours);
    const defaultAllowPdf = settings.webInvoiceAllowPdfDownload !== false;
    const defaultPinFromPhone = settings.webInvoiceRequirePinDefault
      ? extractLast4Phone(invoice.customerPhone)
      : '';
    const defaultPinReq = Boolean(settings.webInvoiceRequirePinDefault && defaultPinFromPhone);

    setToken('');
    setEnabled(true);
    setIsOneTime(false);
    setMaxViews(0);
    setPinRequired(defaultPinReq);
    setPinCode(defaultPinFromPhone);
    setAllowPdfDownload(defaultAllowPdf);
    setIncludeCustomerStatement(true);
    setExpiryPreset(defaultPreset);
    setCurrentViewCount(0);
    setLastViewedAt(null);
    setExpiresAtIso(calculateExpiresAt(defaultPreset));

    if (!isGloballyDisabled) {
      void (async () => {
        try {
          setIsSaving(true);
          const computedExpiry = calculateExpiresAt(defaultPreset);
          const res = await StorageService.generateOrUpdateShareLink(invoice.id, {
            enabled: true,
            expiresAt: computedExpiry,
            isOneTime: false,
            maxViews: null,
            pinRequired: defaultPinReq,
            pinCode: defaultPinFromPhone,
            allowPdfDownload: defaultAllowPdf,
            includeCustomerStatement: true,
            regenerateToken: false,
          });
          if (res.success && res.invoice) {
            const finalLink = res.shareLink || res.invoice.shareLink;
            if (finalLink) {
              setToken(finalLink.token);
              setExpiresAtIso(finalLink.expiresAt || null);
              setCurrentViewCount(Number(finalLink.viewCount) || 0);
              setLastViewedAt(finalLink.lastViewedAt || null);
            }
            if (onUpdateInvoice) {
              onUpdateInvoice(res.invoice);
            }
          }
        } catch {
          showToast('خطا در ایجاد اولیه پیوند تحت وب');
        } finally {
          setIsSaving(false);
        }
      })();
    }
  }, [isOpen, invoice?.id]);

  const publicUrl = useMemo(() => {
    return token ? StorageService.buildInvoicePublicUrl(token, settings.webInvoiceCustomDomain) : '';
  }, [token, settings.webInvoiceCustomDomain]);

  const statementPreviewUrl = useMemo(() => {
    if (!publicUrl) return '';
    const sep = publicUrl.includes('?') ? '&' : '?';
    return `${publicUrl}${sep}tab=ledger`;
  }, [publicUrl]);

  // Generate local offline QR code whenever publicUrl updates
  useEffect(() => {
    if (!publicUrl) {
      setQrDataUrl('');
      return;
    }
    let cancelled = false;
    QRCode.toDataURL(publicUrl, {
      width: 220,
      margin: 1,
      color: { dark: '#0f172a', light: '#ffffff' },
    })
      .then((url) => {
        if (!cancelled) setQrDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setQrDataUrl('');
      });
    return () => {
      cancelled = true;
    };
  }, [publicUrl]);

  const handleGenerateOrUpdate = async (regenerate = false) => {
    if (!invoice || isGloballyDisabled) return;
    if (pinRequired && !pinCode.trim()) {
      showToast('لطفاً قبل از ذخیره، پین‌کد امنیتی را وارد نمایید.');
      return;
    }
    try {
      setIsSaving(true);
      const computedExpiry = calculateExpiresAt(expiryPreset);
      const effectiveMaxViews = isOneTime ? 1 : maxViews > 0 ? maxViews : null;

      const res = await StorageService.generateOrUpdateShareLink(invoice.id, {
        enabled,
        expiresAt: computedExpiry,
        isOneTime,
        maxViews: effectiveMaxViews,
        pinRequired,
        pinCode: pinCode.trim(),
        allowPdfDownload,
        includeCustomerStatement,
        regenerateToken: regenerate,
      });

      if (res.success && res.invoice) {
        const finalLink = res.shareLink || res.invoice.shareLink;
        if (finalLink) {
          setToken(finalLink.token);
          setExpiresAtIso(finalLink.expiresAt || null);
          setCurrentViewCount(Number(finalLink.viewCount) || 0);
          setLastViewedAt(finalLink.lastViewedAt || null);
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
    if (!invoice || isGloballyDisabled) return;
    const nextState = !enabled;
    setEnabled(nextState);
    try {
      setIsSaving(true);
      const res = await StorageService.generateOrUpdateShareLink(invoice.id, {
        enabled: nextState,
        expiresAt: expiresAtIso,
        isOneTime,
        maxViews: isOneTime ? 1 : maxViews > 0 ? maxViews : null,
        pinRequired,
        pinCode: pinCode.trim(),
        allowPdfDownload,
        includeCustomerStatement,
      });
      if (res.success && res.invoice) {
        if (onUpdateInvoice) {
          onUpdateInvoice(res.invoice);
        }
        showToast(nextState ? 'پیوند فعال شد.' : 'دسترسی به پیوند مسدود گردید.');
      } else {
        setEnabled(!nextState);
        showToast(res.message || 'خطا در تغییر وضعیت پیوند');
      }
    } catch {
      setEnabled(!nextState);
      showToast('خطا در ارتباط با سرور');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSetPinFromPhone = () => {
    if (!invoice) return;
    const last4 = extractLast4Phone(invoice.customerPhone);
    if (last4) {
      setPinCode(last4);
      setPinRequired(true);
      showToast(`پین‌کد به ۴ رقم آخر موبایل (${toPersianDigits(last4)}) تنظیم گردید.`);
    } else {
      showToast('شماره تماس مشتری در فاکتور حداقل ۴ رقم ندارد.');
    }
  };

  const handleCopyUrl = () => {
    if (!publicUrl) return;
    navigator.clipboard.writeText(publicUrl).then(() => {
      setCopiedLink(true);
      showToast('پیوند نسخه تحت وب کپی شد.');
      setTimeout(() => setCopiedLink(false), 2500);
    });
  };

  const isCustomerPortalOnly = String(invoice?.id || '').startsWith('cust-portal-');

  const shareMessageText = useMemo(() => {
    if (!invoice || !publicUrl) return '';
    const storeTitle = settings.storeName || 'فروشگاه سپهر';
    const pinPart = pinRequired && pinCode ? `\nرمز عبور: ${toPersianDigits(pinCode)}` : '';

    if (isCustomerPortalOnly) {
      return [
        `مشتری گرامی ${invoice.customerName}،`,
        `صورتحساب آنلاین و گردش حساب شما در «${storeTitle}» آماده مشاهده است.`,
        '',
        'مشاهده آنلاین صورتحساب کامل شما (با قابلیت جستجو و فیلتر گردش حساب):',
        publicUrl,
        pinPart,
        '',
        `با تشکر، ${storeTitle}`,
      ]
        .filter(Boolean)
        .join('\n');
    }

    const docTitle = invoice.isProforma ? 'پیش‌فاکتور' : 'فاکتور فروش';
    const totalFormatted = formatPrice(invoice.finalTotal, settings.currency);
    const statementPart = includeCustomerStatement
      ? 'مشاهده آنلاین فاکتور و صورتحساب کامل شما (با قابلیت جستجو و فیلتر گردش حساب):'
      : 'مشاهده آنلاین فاکتور در مرورگر (بدون نیاز به دانلود):';

    return [
      `مشتری گرامی ${invoice.customerName}،`,
      `${docTitle} شماره ${toPersianDigits(invoice.invoiceNumber)} شما در «${storeTitle}» صادر شد.`,
      `مبلغ کل: ${totalFormatted}`,
      '',
      statementPart,
      publicUrl,
      pinPart,
      '',
      `با تشکر، ${storeTitle}`,
    ]
      .filter(Boolean)
      .join('\n');
  }, [invoice, publicUrl, settings.storeName, settings.currency, pinRequired, pinCode, isCustomerPortalOnly, includeCustomerStatement]);

  const handleCopyMessageText = () => {
    if (!shareMessageText) return;
    navigator.clipboard.writeText(shareMessageText).then(() => {
      setCopiedText(true);
      showToast('متن آماده ارسال پیامک کپی شد.');
      setTimeout(() => setCopiedText(false), 2500);
    });
  };

  // Native href URLs for zero-popup / iframe-safe dispatch
  const messengerLinks = useMemo(() => {
    const encodedText = encodeURIComponent(shareMessageText);
    const encodedUrl = encodeURIComponent(publicUrl);
    const cleanPhone = (invoice?.customerPhone || '').replace(/[^0-9]/g, '');
    const intlPhone = cleanPhone.startsWith('09') ? `98${cleanPhone.slice(1)}` : cleanPhone;

    return {
      sms: `sms:${cleanPhone}?body=${encodedText}`,
      whatsapp: intlPhone
        ? `https://api.whatsapp.com/send?phone=${intlPhone}&text=${encodedText}`
        : `https://api.whatsapp.com/send?text=${encodedText}`,
      telegram: `https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`,
      eitaa: `https://eitaa.com/share/url?url=${encodedUrl}&text=${encodedText}`,
      bale: `https://ble.ir/share/compile?text=${encodedText}`,
    };
  }, [shareMessageText, publicUrl, invoice?.customerPhone]);

  const isExpired = Boolean(expiresAtIso && new Date(expiresAtIso).getTime() < Date.now());
  const isLimitReached = Boolean(
    (isOneTime && currentViewCount >= 1) || (maxViews > 0 && currentViewCount >= maxViews)
  );

  if (!isOpen || !invoice) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      dir="rtl"
    >
      <div className="bg-white rounded-3xl max-w-xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden text-right font-['Vazirmatn']">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 bg-slate-900 text-white flex items-center justify-between gap-3 shrink-0 border-b border-slate-800">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-sky-500/20 text-sky-400 border border-sky-400/30 flex items-center justify-center shrink-0">
              <Globe className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="font-extrabold text-sm sm:text-base truncate">
                {isCustomerPortalOnly
                  ? 'پیوند عمومی پورتال و صورتحساب مشتری'
                  : 'پیوند عمومی نسخه آنلاین فاکتور'}
              </h3>
              <p className="text-xs text-slate-300 mt-0.5 truncate">
                {isCustomerPortalOnly
                  ? `پورتال آنلاین و گردش حساب • ${invoice.customerName}`
                  : `فاکتور #${toPersianDigits(invoice.invoiceNumber)} • ${invoice.customerName}`}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="بستن"
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 text-xs">
          {/* Global Disabled Notice */}
          {isGloballyDisabled && (
            <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <p className="font-bold">سیستم نسخه آنلاین در تنظیمات کل سامانه غیرفعال شده است</p>
                <p className="text-[11px] text-rose-700 leading-relaxed">
                  در حال حاضر هیچ‌یک از لینک‌های مشتری باز نخواهند شد. برای فعال‌سازی، به «پنل مدیریت ← نسخه آنلاین و لینک مشتری» مراجعه نمایید.
                </p>
              </div>
            </div>
          )}

          {/* 1. Primary Public Link & QR Card */}
          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-800">وضعیت پیوند:</span>
                <span
                  className={`px-2.5 py-0.5 rounded-lg text-[11px] font-bold border ${
                    isGloballyDisabled || !enabled
                      ? 'bg-rose-50 text-rose-700 border-rose-200'
                      : isExpired || isLimitReached
                      ? 'bg-amber-50 text-amber-700 border-amber-200'
                      : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  }`}
                >
                  {isGloballyDisabled
                    ? 'غیرفعال سراسری'
                    : !enabled
                    ? 'مسدود شده'
                    : isExpired
                    ? 'منقضی شده'
                    : isLimitReached
                    ? 'سقف بازدید تکمیل شده'
                    : 'فعال و آنلاین'}
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                {publicUrl && (
                  <button
                    type="button"
                    onClick={() => setShowQr((prev) => !prev)}
                    className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl font-bold text-[11px] border transition-colors cursor-pointer ${
                      showQr
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
                    }`}
                  >
                    <QrCode className="w-3.5 h-3.5" />
                    <span>کیوآر کد</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleToggleEnabled}
                  disabled={isSaving || isGloballyDisabled || !token}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-[11px] transition-all cursor-pointer disabled:opacity-50 ${
                    enabled
                      ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200'
                      : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200'
                  }`}
                  title="قطع یا اتصال آنی دسترسی مشتری به لینک"
                >
                  <Power className="w-3.5 h-3.5" />
                  <span>{enabled ? 'مسدودسازی' : 'فعال‌سازی'}</span>
                </button>
              </div>
            </div>

            {/* URL Display with Native Anchor Previews */}
            <div className="flex items-center gap-1.5 bg-white rounded-xl border border-slate-300 p-1.5 focus-within:border-sky-500 transition-all">
              <input
                type="text"
                readOnly
                value={publicUrl || (isSaving ? 'در حال صدور پیوند امن...' : 'پیوندی صادر نشده است')}
                className="w-full text-left font-mono text-xs text-slate-700 px-2 py-1 outline-none select-all bg-transparent truncate"
                dir="ltr"
              />
              <button
                type="button"
                onClick={handleCopyUrl}
                disabled={!publicUrl}
                className="flex items-center gap-1 bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg font-bold text-xs transition-colors cursor-pointer shrink-0"
              >
                {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedLink ? 'کپی شد' : 'کپی'}</span>
              </button>

              {publicUrl && (
                <a
                  href={publicUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 bg-slate-100 hover:bg-slate-200 text-slate-700 px-2.5 py-1.5 rounded-lg font-bold text-xs transition-colors shrink-0"
                  title="پیش‌نمایش در برگه جدید"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">پیش‌نمایش</span>
                </a>
              )}

              {publicUrl && includeCustomerStatement && !isCustomerPortalOnly && (
                <a
                  href={statementPreviewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 px-2.5 py-1.5 rounded-lg font-bold text-xs transition-colors shrink-0"
                  title="مشاهده مستقیم صورتحساب مشتری"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="hidden sm:inline">صورتحساب</span>
                </a>
              )}
            </div>

            {/* Expandable Inline QR Code Panel */}
            {showQr && qrDataUrl && (
              <div className="bg-white rounded-xl border border-slate-200 p-3.5 flex flex-col sm:flex-row items-center gap-4">
                <img
                  src={qrDataUrl}
                  alt="QR Code پیوند فاکتور"
                  className="w-36 h-36 rounded-xl border border-slate-200 p-1.5 bg-white shrink-0"
                />
                <div className="space-y-2 text-center sm:text-right">
                  <h5 className="font-bold text-slate-900 text-xs">اسکن سریع با دوربین موبایل مشتری</h5>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    مشتری می‌تواند برای مشاهده فوری فاکتور یا صورتحساب خود، این رمزینه را مستقیماً از روی نمایشگر اسکن کند.
                  </p>
                  <a
                    href={qrDataUrl}
                    download={`QR_${isCustomerPortalOnly ? invoice.customerName : invoice.invoiceNumber}.png`}
                    className="inline-flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white px-3 py-1.5 rounded-xl font-bold text-[11px] transition-colors"
                  >
                    <Download className="w-3.5 h-3.5 text-emerald-400" />
                    <span>دانلود تصویر QR</span>
                  </a>
                </div>
              </div>
            )}

            {/* Metadata strip */}
            <div className="flex items-center justify-between flex-wrap gap-2 text-[11px] text-slate-500 pt-2 border-t border-slate-200/70 tabular-nums">
              <div className="flex items-center gap-1.5">
                <Eye className="w-3.5 h-3.5 text-slate-400" />
                <span>
                  بازدید:{' '}
                  <strong className="text-slate-800 font-mono font-bold">
                    {toPersianDigits(currentViewCount)}
                    {isOneTime ? ' / ۱' : maxViews > 0 ? ` / ${toPersianDigits(maxViews)}` : ''}
                  </strong>{' '}
                  بار
                </span>
              </div>

              {expiresAtIso && (
                <div className="flex items-center gap-1 text-slate-500">
                  <Calendar className="w-3 h-3 text-slate-400" />
                  <span>
                    اعتبار تا:{' '}
                    <strong className="font-mono text-slate-700">
                      {toPersianDigits(new Date(expiresAtIso).toLocaleDateString('fa-IR'))}
                    </strong>
                  </span>
                </div>
              )}

              {lastViewedAt && (
                <div className="flex items-center gap-1 text-slate-500">
                  <Clock className="w-3 h-3 text-slate-400" />
                  <span>
                    آخرین بازدید:{' '}
                    {toPersianDigits(
                      new Date(lastViewedAt).toLocaleTimeString('fa-IR', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    )}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* 2. Security & Expiration Settings Card */}
          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 space-y-4">
            <h4 className="font-bold text-slate-800 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>تنظیمات امنیت، انقضا و محدودیت بازدید:</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Expiration Preset */}
              <div className="space-y-1.5">
                <label className="text-slate-600 font-medium block">مدت اعتبار پیوند:</label>
                <select
                  value={expiryPreset}
                  onChange={(e) => setExpiryPreset(e.target.value as ExpiryPreset)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-sky-500/20 cursor-pointer"
                >
                  <option value="never">نامحدود (همیشه معتبر تا زمان ابطال)</option>
                  <option value="24h">۲۴ ساعت (۱ روز آینده)</option>
                  <option value="3d">۳ روز آینده</option>
                  <option value="7d">۷ روز (۱ هفته)</option>
                  <option value="30d">۳۰ روز (۱ ماه)</option>
                </select>
              </div>

              {/* Max Views Limit */}
              <div className="space-y-1.5">
                <label className="text-slate-600 font-medium block">سقف تعداد بازدید مجاز:</label>
                <select
                  value={isOneTime ? 1 : maxViews}
                  disabled={isOneTime}
                  onChange={(e) => setMaxViews(Number(e.target.value))}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-sky-500/20 cursor-pointer disabled:opacity-60"
                >
                  {isOneTime && <option value={1}>۱ بار (حالت یکبارمصرف)</option>}
                  <option value={0}>نامحدود</option>
                  <option value={3}>حداکثر ۳ بازدید</option>
                  <option value={5}>حداکثر ۵ بازدید</option>
                  <option value={10}>حداکثر ۱۰ بازدید</option>
                  <option value={20}>حداکثر ۲۰ بازدید</option>
                </select>
              </div>

              {/* One-Time Link Mode */}
              <label className="sm:col-span-2 flex items-center justify-between p-2.5 bg-white rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-50 transition-colors">
                <div>
                  <span className="font-bold text-slate-800 block">لینک یکبارمصرف</span>
                  <span className="text-[11px] text-slate-500">
                    پس از ۱ بار باز شدن کامل توسط مشتری، دسترسی مجدد مسدود می‌شود
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={isOneTime}
                  onChange={(e) => {
                    setIsOneTime(e.target.checked);
                    if (e.target.checked) setMaxViews(0);
                  }}
                  className="w-4 h-4 text-sky-600 rounded cursor-pointer shrink-0 mr-2"
                />
              </label>

              {/* PIN Code Protection */}
              <div className="sm:col-span-2 bg-white rounded-xl p-3 border border-slate-200 space-y-2.5">
                <label className="flex items-center justify-between cursor-pointer">
                  <div className="flex items-center gap-1.5">
                    <Lock className="w-4 h-4 text-indigo-600 shrink-0" />
                    <div>
                      <span className="font-bold text-slate-800 block">حفاظت با رمز عبور / پین‌کد</span>
                      <span className="text-[11px] text-slate-500 block">
                        مشتری قبل از نمایش اطلاعات مالی باید رمز را وارد کند
                      </span>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={pinRequired}
                    onChange={(e) => setPinRequired(e.target.checked)}
                    className="w-4 h-4 text-indigo-600 rounded cursor-pointer shrink-0 mr-2"
                  />
                </label>

                {pinRequired && (
                  <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row items-center gap-2">
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="پین ۴ یا ۶ رقمی (مثلاً ۱۲۳۴)"
                      value={pinCode}
                      onChange={(e) => setPinCode(e.target.value)}
                      className="w-full sm:w-44 px-3 py-1.5 text-center font-mono font-bold text-xs bg-slate-50 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                    {extractLast4Phone(invoice.customerPhone) && (
                      <button
                        type="button"
                        onClick={handleSetPinFromPhone}
                        className="text-[11px] font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-3 py-1.5 rounded-xl transition-colors cursor-pointer whitespace-nowrap"
                      >
                        ۴ رقم آخر موبایل ({toPersianDigits(extractLast4Phone(invoice.customerPhone))})
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Include Customer Statement */}
              <label className="sm:col-span-2 flex items-center justify-between p-2.5 bg-emerald-50/60 rounded-xl border border-emerald-200 cursor-pointer">
                <div>
                  <span className="font-bold text-emerald-950 block">
                    گنجاندن صورتحساب کامل مشتری (گردش حساب و مانده)
                  </span>
                  <span className="text-[11px] text-emerald-700">
                    نمایش ریز بدهکار، بستانکار و مانده پس از هر تراکنش همراه با جستجو و فیلتر
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={includeCustomerStatement}
                  onChange={(e) => setIncludeCustomerStatement(e.target.checked)}
                  className="w-4 h-4 text-emerald-600 rounded cursor-pointer shrink-0 mr-2"
                />
              </label>

              {/* Allow PDF Download & Print */}
              <label className="sm:col-span-2 flex items-center justify-between p-2.5 bg-white rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-50 transition-colors">
                <div>
                  <span className="font-bold text-slate-800 block">
                    اجازه دانلود فایل PDF و چاپ توسط مشتری
                  </span>
                  <span className="text-[11px] text-slate-500">
                    در صورت غیرفعال کردن، دکمه‌های چاپ و دانلود PDF در صفحه مشتری مخفی می‌شوند
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={allowPdfDownload}
                  onChange={(e) => setAllowPdfDownload(e.target.checked)}
                  className="w-4 h-4 text-emerald-600 rounded cursor-pointer shrink-0 mr-2"
                />
              </label>
            </div>

            {/* Save Settings Bar */}
            <div className="flex items-center justify-between flex-wrap gap-2 pt-2 border-t border-slate-200/70">
              <button
                type="button"
                onClick={() => handleGenerateOrUpdate(true)}
                disabled={isSaving || isGloballyDisabled}
                className="text-[11px] font-bold text-slate-600 hover:text-slate-900 disabled:opacity-50 flex items-center gap-1 hover:underline cursor-pointer"
                title="تولید توکن جدید و باطل کردن نشانی قبلی"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>ابطال و تولید لینک جدید</span>
              </button>

              <button
                type="button"
                onClick={() => handleGenerateOrUpdate(false)}
                disabled={isSaving || isGloballyDisabled}
                className="bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white px-4 py-2 rounded-xl font-bold text-xs transition-colors cursor-pointer flex items-center gap-1.5"
              >
                {isSaving ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <FileCheck className="w-3.5 h-3.5 text-emerald-400" />
                )}
                <span>ذخیره تنظیمات لینک</span>
              </button>
            </div>
          </div>

          {/* 3. Ready-to-Send SMS & Messenger Dispatch (Native Anchor Links) */}
          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="font-bold text-slate-800 flex items-center gap-1.5">
                <Smartphone className="w-4 h-4 text-sky-600" />
                <span>ارسال مستقیم متن و لینک به مشتری:</span>
              </span>
              <button
                type="button"
                onClick={handleCopyMessageText}
                disabled={!shareMessageText}
                className="flex items-center gap-1 text-[11px] font-bold text-slate-700 bg-white hover:bg-slate-100 disabled:opacity-50 border border-slate-200 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
              >
                {copiedText ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                <span>{copiedText ? 'کپی شد' : 'کپی متن پیامک'}</span>
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              <a
                href={publicUrl ? messengerLinks.sms : undefined}
                aria-disabled={!publicUrl}
                className={`flex items-center justify-center gap-1.5 bg-slate-800 hover:bg-slate-900 text-white py-2.5 px-2.5 rounded-xl font-bold text-xs transition-colors ${
                  !publicUrl ? 'pointer-events-none opacity-50' : ''
                }`}
              >
                <Smartphone className="w-3.5 h-3.5 text-sky-400" />
                <span>پیامک</span>
              </a>

              <a
                href={publicUrl ? messengerLinks.whatsapp : undefined}
                target="_blank"
                rel="noopener noreferrer"
                aria-disabled={!publicUrl}
                className={`flex items-center justify-center gap-1.5 bg-[#25D366] hover:bg-[#1EBE5D] text-white py-2.5 px-2.5 rounded-xl font-bold text-xs transition-colors ${
                  !publicUrl ? 'pointer-events-none opacity-50' : ''
                }`}
              >
                <MessageCircle className="w-3.5 h-3.5" />
                <span>واتساپ</span>
              </a>

              <a
                href={publicUrl ? messengerLinks.telegram : undefined}
                target="_blank"
                rel="noopener noreferrer"
                aria-disabled={!publicUrl}
                className={`flex items-center justify-center gap-1.5 bg-[#229ED9] hover:bg-[#1C8AC2] text-white py-2.5 px-2.5 rounded-xl font-bold text-xs transition-colors ${
                  !publicUrl ? 'pointer-events-none opacity-50' : ''
                }`}
              >
                <Send className="w-3.5 h-3.5" />
                <span>تلگرام</span>
              </a>

              <a
                href={publicUrl ? messengerLinks.eitaa : undefined}
                target="_blank"
                rel="noopener noreferrer"
                aria-disabled={!publicUrl}
                className={`flex items-center justify-center gap-1.5 bg-amber-600 hover:bg-amber-700 text-white py-2.5 px-2.5 rounded-xl font-bold text-xs transition-colors ${
                  !publicUrl ? 'pointer-events-none opacity-50' : ''
                }`}
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>ایتا</span>
              </a>

              <a
                href={publicUrl ? messengerLinks.bale : undefined}
                target="_blank"
                rel="noopener noreferrer"
                aria-disabled={!publicUrl}
                className={`flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 px-2.5 rounded-xl font-bold text-xs transition-colors col-span-2 sm:col-span-1 ${
                  !publicUrl ? 'pointer-events-none opacity-50' : ''
                }`}
              >
                <MessageCircle className="w-3.5 h-3.5" />
                <span>بله</span>
              </a>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="bg-slate-50 border-t border-slate-200 px-5 py-3 flex items-center justify-between gap-2 shrink-0">
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
