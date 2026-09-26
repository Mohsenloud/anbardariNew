import React, { useState, useEffect } from 'react';
import { Invoice, StoreSettings, InvoiceShareLink } from '../types';
import { formatPrice, toPersianDigits, numberToPersianWords } from '../utils/jalali';
import { StorageService } from '../utils/storage';
import { printElementDirectly, generatePdfBlob } from '../utils/pdfHelper';
import { 
  Receipt, 
  Printer, 
  Download, 
  Share2, 
  Phone, 
  MapPin, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Lock, 
  ShieldAlert, 
  Building2, 
  User, 
  Calendar, 
  CreditCard, 
  Check, 
  Copy, 
  ArrowLeft, 
  ExternalLink,
  MessageCircle,
  ShieldCheck,
  RefreshCw,
  FileText,
  BadgeCheck,
  Smartphone
} from 'lucide-react';

interface PublicWebInvoiceViewProps {
  token: string;
  onBackToApp?: () => void;
}

export const PublicWebInvoiceView: React.FC<PublicWebInvoiceViewProps> = ({ token, onBackToApp }) => {
  const [loading, setLoading] = useState(true);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [settings, setSettings] = useState<StoreSettings | null>(null);
  const [shareLink, setShareLink] = useState<InvoiceShareLink | null>(null);
  const [pinRequired, setPinRequired] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [pinLoading, setPinLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [storeMeta, setStoreMeta] = useState<{ storeName?: string; storeLogo?: string; invoiceNumber?: string }>({});
  const [copiedLink, setCopiedLink] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  };

  const loadInvoice = async (pin?: string) => {
    try {
      if (pin) {
        setPinLoading(true);
        setPinError('');
      } else {
        setLoading(true);
        setErrorMessage(null);
      }

      const res = await StorageService.fetchPublicInvoice(token, pin);

      if (res.success && res.invoice) {
        setInvoice(res.invoice);
        setSettings(res.settings || null);
        setShareLink(res.shareLink || null);
        setPinRequired(false);
      } else if (res.pinRequired) {
        setPinRequired(true);
        setStoreMeta({
          storeName: res.storeName,
          storeLogo: res.storeLogo,
          invoiceNumber: res.invoiceNumber,
        });
        if (pin) {
          setPinError('پین‌کد وارد شده صحیح نمی‌باشد. لطفاً مجدداً بررسی نمایید.');
        }
      } else {
        setErrorMessage(res.message || 'فاکتور مورد نظر یافت نشد یا مهلت مشاهده آن به پایان رسیده است.');
      }
    } catch {
      setErrorMessage('خطا در برقراری ارتباط با سرور فاکتور. لطفاً اتصال اینترنت خود را بررسی نمایید.');
    } finally {
      setLoading(false);
      setPinLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      loadInvoice();
    }
  }, [token]);

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pinInput.trim()) {
      setPinError('لطفاً پین‌کد امنیتی را وارد نمایید.');
      return;
    }
    loadInvoice(pinInput.trim());
  };

  const handlePrint = () => {
    if (!invoice) return;
    printElementDirectly('public-web-invoice-container', {
      pageSize: 'a4',
      orientation: 'portrait',
      documentType: 'invoice',
    });
  };

  const handleDownloadPdf = async () => {
    if (!invoice) return;
    try {
      setIsExportingPdf(true);
      const filename = invoice.isProforma
        ? `پیش_فاکتور_${invoice.invoiceNumber}.pdf`
        : `فاکتور_${invoice.invoiceNumber}.pdf`;

      const pdfResult = await generatePdfBlob('public-web-invoice-container', filename, {
        pageSize: 'a4',
        orientation: 'portrait',
        documentType: 'invoice',
        quality: 'high',
      });

      if (!pdfResult.success || !pdfResult.blob) {
        showToast('خطا در تولید فایل PDF. لطفاً از دکمه چاپ فاکتور استفاده فرمایید.');
        return;
      }

      const url = URL.createObjectURL(pdfResult.blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      showToast('فایل PDF با موفقیت دانلود شد.');
    } catch (err: any) {
      console.error(err);
      showToast('خطا در تولید فایل PDF فاکتور.');
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handleCopyLink = () => {
    if (typeof window === 'undefined') return;
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopiedLink(true);
      showToast('پیوند فاکتور در حافظه کپی شد.');
      setTimeout(() => setCopiedLink(false), 2500);
    });
  };

  const handleShareNative = async () => {
    if (!invoice) return;
    const title = invoice.isProforma
      ? `پیش‌فاکتور خرید شماره ${toPersianDigits(invoice.invoiceNumber)}`
      : `فاکتور خرید شماره ${toPersianDigits(invoice.invoiceNumber)}`;
    const text = `فاکتور خرید شما در فروشگاه ${settings?.storeName || 'سپهر'}\nمبلغ: ${formatPrice(invoice.finalTotal, settings?.currency || 'تومان')}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title,
          text,
          url: window.location.href,
        });
      } catch {}
    } else {
      handleCopyLink();
    }
  };

  const storePhone = settings?.phone || settings?.mobile || '';
  const cleanPhone = storePhone.replace(/[^0-9]/g, '');

  // 1. Loading State
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4 text-center select-none" dir="rtl">
        <div className="w-16 h-16 rounded-3xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center mb-5 animate-pulse">
          <Receipt className="w-8 h-8 animate-bounce" />
        </div>
        <h2 className="text-white text-base sm:text-lg font-bold mb-2 font-['Vazirmatn']">
          در حال بارگذاری نسخه تحت وب فاکتور...
        </h2>
        <p className="text-slate-400 text-xs sm:text-sm max-w-sm leading-relaxed">
          لطفاً چند لحظه شکیبا باشید تا اطلاعات معتبر فاکتور از سامانه دریافت گردد.
        </p>
      </div>
    );
  }

  // 2. PIN Password Entry State
  if (pinRequired) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 flex flex-col items-center justify-center p-4" dir="rtl">
        <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-slate-200 text-center animate-in fade-in zoom-in-95 duration-200">
          <div className="w-16 h-16 rounded-3xl bg-indigo-50 text-indigo-600 border border-indigo-200 flex items-center justify-center mx-auto mb-4 shadow-sm">
            <Lock className="w-8 h-8" />
          </div>

          <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-200 inline-block mb-3">
            حفاظت شده با رمز عبور
          </span>

          <h2 className="text-lg sm:text-xl font-black text-slate-900 mb-1.5 font-['Vazirmatn']">
            ورود به نسخه تحت وب فاکتور
          </h2>

          {storeMeta.storeName && (
            <p className="text-xs text-slate-500 mb-1">
              صادرکننده: <strong className="text-slate-800 font-bold">{storeMeta.storeName}</strong>
            </p>
          )}

          {storeMeta.invoiceNumber && (
            <p className="text-xs text-slate-500 mb-5">
              شماره فاکتور: <span className="font-mono font-bold text-indigo-700 bg-slate-100 px-2 py-0.5 rounded">{toPersianDigits(storeMeta.invoiceNumber)}</span>
            </p>
          )}

          <p className="text-xs text-slate-600 leading-relaxed mb-5 bg-slate-50 p-3 rounded-2xl border border-slate-200">
            جهت حفظ محرمانگی مالی، این فاکتور با پین‌کد امنیتی محافظت شده است. لطفاً رمز عبور اعلام‌شده توسط فروشگاه را وارد نمایید.
          </p>

          <form onSubmit={handlePinSubmit} className="space-y-4">
            <div className="space-y-1.5 text-right">
              <label className="text-xs font-bold text-slate-700 block text-center">
                رمز عبور / پین کد فاکتور:
              </label>
              <input
                type="password"
                inputMode="numeric"
                autoFocus
                placeholder="••••"
                value={pinInput}
                onChange={(e) => {
                  setPinInput(e.target.value);
                  setPinError('');
                }}
                className="w-full text-center text-xl tracking-widest font-mono font-bold py-3 px-4 border border-slate-300 rounded-2xl focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all shadow-inner"
              />
            </div>

            {pinError && (
              <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold flex items-center justify-center gap-1.5">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{pinError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={pinLoading}
              className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 active:scale-98 disabled:opacity-50 text-white rounded-2xl font-bold text-xs sm:text-sm transition-all shadow-md shadow-indigo-600/20 cursor-pointer flex items-center justify-center gap-2"
            >
              {pinLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>در حال بررسی رمز...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>مشاهده فاکتور</span>
                </>
              )}
            </button>
          </form>

          {onBackToApp && (
            <div className="mt-5 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={onBackToApp}
                className="text-xs text-slate-500 hover:text-slate-800 transition-colors cursor-pointer flex items-center justify-center gap-1 mx-auto"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>ورود به سامانه مدیریت فروشگاه</span>
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // 3. Error / Expired / Deactivated State
  if (errorMessage || !invoice) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4" dir="rtl">
        <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-slate-200 text-center animate-in fade-in zoom-in-95 duration-200">
          <div className="w-16 h-16 rounded-3xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center mx-auto mb-4 shadow-sm">
            <ShieldAlert className="w-8 h-8" />
          </div>

          <h2 className="text-base sm:text-lg font-black text-slate-900 mb-2 font-['Vazirmatn']">
            عدم دسترسی به فاکتور آنلاین
          </h2>

          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed mb-6 bg-amber-50/70 p-3.5 rounded-2xl border border-amber-200/80">
            {errorMessage || 'این پیوند نامعتبر است، منقضی شده یا دسترسی به آن توسط صادرکننده باطل شده است.'}
          </p>

          <div className="space-y-2.5">
            {storePhone && (
              <a
                href={`tel:${cleanPhone}`}
                className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white rounded-2xl font-bold text-xs sm:text-sm transition-all shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2"
              >
                <Phone className="w-4 h-4" />
                <span>تماس با فروشگاه ({toPersianDigits(storePhone)})</span>
              </a>
            )}

            {onBackToApp && (
              <button
                type="button"
                onClick={onBackToApp}
                className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-bold text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>ورود به پنل اصلی سامانه</span>
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // 4. Successful Invoice Presentation
  const isPaid = invoice.paymentStatus === 'paid';
  const isPartial = invoice.paymentStatus === 'partial';
  const isUnpaid = invoice.paymentStatus === 'unpaid';
  const remainingDebt = Math.max(0, invoice.finalTotal - (isPaid ? invoice.finalTotal : (invoice.paidAmount || 0)));
  const totalItemsCount = (invoice.items || []).reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
  const allowPdf = shareLink?.allowPdfDownload !== false;

  return (
    <div className="min-h-screen bg-slate-100/90 text-slate-900 pb-16 font-['Vazirmatn']" dir="rtl">
      {/* Top Banner Navigation Bar */}
      <header className="no-print bg-slate-900 text-white sticky top-0 z-40 shadow-lg border-b border-slate-800">
        <div className="max-w-4xl mx-auto px-3 sm:px-6 py-2.5 flex items-center justify-between gap-2">
          {/* Brand & Document Tag */}
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shrink-0">
              <Receipt className="w-4 h-4" />
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-bold text-xs sm:text-sm text-white truncate">
                  {invoice.isProforma ? 'پیش‌فاکتور آنلاین شماره' : 'فاکتور فروش آنلاین شماره'} {toPersianDigits(invoice.invoiceNumber)}
                </span>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-bold px-2 py-0.5 rounded-full border border-emerald-500/30 whitespace-nowrap">
                  نسخه دیجیتال رسمی
                </span>
              </div>
              <p className="text-[11px] text-slate-400 truncate">
                {settings?.storeName || 'سامانه حسابداری سپهر'}
              </p>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="flex items-center gap-1.5 shrink-0">
            {allowPdf && (
              <button
                type="button"
                id="customer-download-pdf-btn"
                onClick={handleDownloadPdf}
                disabled={isExportingPdf}
                className="hidden xs:flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 active:scale-98 disabled:opacity-50 text-white px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
                title="دانلود نسخه PDF فاکتور"
              >
                {isExportingPdf ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span className="hidden sm:inline">در حال آماده‌سازی...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-3.5 h-3.5" />
                    <span>دانلود PDF</span>
                  </>
                )}
              </button>
            )}

            <button
              type="button"
              id="customer-print-invoice-btn"
              onClick={handlePrint}
              className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold border border-slate-700 transition-all cursor-pointer"
              title="چاپ فاکتور"
            >
              <Printer className="w-3.5 h-3.5 text-blue-400" />
              <span className="hidden sm:inline">چاپ</span>
            </button>

            <button
              type="button"
              id="customer-share-invoice-btn"
              onClick={handleShareNative}
              className="flex items-center gap-1.5 bg-sky-950/80 hover:bg-sky-900 text-sky-300 hover:text-white px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold border border-sky-600/40 transition-colors cursor-pointer"
              title="اشتراک‌گذاری پیوند"
            >
              <Share2 className="w-3.5 h-3.5 text-sky-400" />
              <span className="hidden sm:inline">اشتراک</span>
            </button>

            {onBackToApp && (
              <button
                type="button"
                onClick={onBackToApp}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                title="بازگشت به برنامه اصلی"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Page Container */}
      <main className="max-w-4xl mx-auto px-2 sm:px-4 py-4 sm:py-6">
        {/* Verification & Trust Badge Notice */}
        <div className="no-print bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 border border-emerald-200 rounded-2xl p-3 sm:p-4 mb-4 flex items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <BadgeCheck className="w-5 h-5" />
            </div>
            <div className="min-w-0 text-xs">
              <h4 className="font-bold text-emerald-950 text-xs sm:text-sm">
                نسخه آنلاین معتبر و رسمی
              </h4>
              <p className="text-emerald-800 text-[11px] leading-relaxed truncate sm:whitespace-normal">
                این فاکتور مستقیماً از سامانه فروشگاه استعلام شده و بدون نیاز به دانلود فایل یا نصب نرم‌افزار، همواره در دسترس شماست.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleCopyLink}
            className="shrink-0 flex items-center gap-1 text-[11px] font-bold bg-white text-emerald-800 border border-emerald-300 hover:bg-emerald-50 px-2.5 py-1.5 rounded-xl transition-all cursor-pointer shadow-2xs"
          >
            {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedLink ? 'کپی شد' : 'کپی لینک'}</span>
          </button>
        </div>

        {/* PRINTABLE INVOICE SHEET */}
        <div 
          id="public-web-invoice-container"
          className="bg-white rounded-3xl shadow-xl border border-slate-200/90 overflow-hidden p-4 sm:p-8 space-y-6"
        >
          {/* 1. Header Section */}
          <div className="border-b border-slate-200 pb-5">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              {/* Store Branding */}
              <div className="flex items-center gap-3.5">
                {settings?.logo ? (
                  <img
                    src={settings.logo}
                    alt={settings.storeName}
                    className="w-14 h-14 sm:w-16 sm:h-16 object-contain rounded-2xl border border-slate-100 p-1"
                  />
                ) : (
                  <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-tr from-slate-900 to-slate-700 text-white flex items-center justify-center shadow-md">
                    <Building2 className="w-7 h-7 text-emerald-400" />
                  </div>
                )}
                <div>
                  <h1 className="text-lg sm:text-xl font-black text-slate-900">
                    {settings?.storeName || 'بازرگانی و فروشگاه سپهر'}
                  </h1>
                  {settings?.tagline && (
                    <p className="text-xs text-slate-500 font-medium mt-0.5">
                      {settings.tagline}
                    </p>
                  )}
                  {settings?.sellerName && (
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      مدیریت / فروشنده: <span className="text-slate-600 font-bold">{settings.sellerName}</span>
                    </p>
                  )}
                </div>
              </div>

              {/* Document Metadata & Status Badges */}
              <div className="flex flex-col sm:items-end w-full sm:w-auto bg-slate-50 sm:bg-transparent p-3 sm:p-0 rounded-2xl border sm:border-0 border-slate-200">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <span className={`px-2.5 py-1 rounded-xl text-xs font-black border ${
                    invoice.isProforma
                      ? 'bg-indigo-50 text-indigo-800 border-indigo-200'
                      : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  }`}>
                    {invoice.isProforma ? 'پیش‌فاکتور فروش' : 'فاکتور رسمی فروش'}
                  </span>

                  <span className={`px-2.5 py-1 rounded-xl text-xs font-bold border flex items-center gap-1 ${
                    isPaid
                      ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                      : isPartial
                      ? 'bg-amber-100 text-amber-800 border-amber-300'
                      : 'bg-rose-100 text-rose-800 border-rose-300'
                  }`}>
                    {isPaid ? <CheckCircle2 className="w-3.5 h-3.5" /> : isPartial ? <Clock className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                    <span>{isPaid ? 'تسویه کامل' : isPartial ? 'بیعانه / پرداخت جزئی' : 'تسویه نشده (نسیه)'}</span>
                  </span>
                </div>

                <div className="text-xs text-slate-600 space-y-0.5 text-right sm:text-left font-mono">
                  <div>شماره فاکتور: <strong className="text-slate-900 font-bold">{toPersianDigits(invoice.invoiceNumber)}</strong></div>
                  <div>تاریخ صدور: <span className="text-slate-700">{toPersianDigits(invoice.date)}</span></div>
                  {invoice.dueDate && (
                    <div>سررسید: <span className="text-amber-700 font-bold">{toPersianDigits(invoice.dueDate)}</span></div>
                  )}
                </div>
              </div>
            </div>

            {/* Store Address & Contact */}
            {(settings?.address || settings?.phone || settings?.mobile) && (
              <div className="mt-4 pt-3 border-t border-slate-100 text-xs text-slate-500 flex flex-wrap items-center gap-x-6 gap-y-1.5">
                {settings?.address && (
                  <div className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>{settings.address}</span>
                  </div>
                )}
                {settings?.phone && (
                  <div className="flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>تلفن: {toPersianDigits(settings.phone)}</span>
                  </div>
                )}
                {settings?.economicCode && (
                  <div className="text-[11px] text-slate-400">
                    کد اقتصادی: <span className="font-mono">{toPersianDigits(settings.economicCode)}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 2. Customer Information Card */}
          <div className="bg-slate-50/80 rounded-2xl p-4 border border-slate-200/90">
            <h3 className="text-xs font-bold text-slate-500 mb-2 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-slate-400" />
              <span>مشخصات خریدار / مشتری:</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
              <div>
                <span className="text-slate-400 block text-[11px]">نام خریدار:</span>
                <span className="font-black text-slate-900 text-sm">{invoice.customerName || 'مشتری آزاد'}</span>
              </div>
              {invoice.customerPhone && (
                <div>
                  <span className="text-slate-400 block text-[11px]">شماره تماس:</span>
                  <span className="font-mono font-bold text-slate-800">{toPersianDigits(invoice.customerPhone)}</span>
                </div>
              )}
              {invoice.customerNationalId && (
                <div>
                  <span className="text-slate-400 block text-[11px]">کد ملی / شناسه اقتصادی:</span>
                  <span className="font-mono font-bold text-slate-800">{toPersianDigits(invoice.customerNationalId)}</span>
                </div>
              )}
              {invoice.customerAddress && (
                <div className="sm:col-span-2 md:col-span-3">
                  <span className="text-slate-400 block text-[11px]">نشانی تحویل:</span>
                  <span className="text-slate-700">{invoice.customerAddress}</span>
                </div>
              )}
            </div>
          </div>

          {/* 3. Items Table */}
          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3 text-center w-10">ردیف</th>
                  <th className="py-2.5 px-3">شرح کالا / خدمات</th>
                  <th className="py-2.5 px-3 text-center">کد / بارکد</th>
                  <th className="py-2.5 px-3 text-center">تعداد</th>
                  <th className="py-2.5 px-3 text-left">قیمت واحد</th>
                  {invoice.totalDiscount > 0 && (
                    <th className="py-2.5 px-3 text-left">تخفیف</th>
                  )}
                  <th className="py-2.5 px-3 text-left">مبلغ کل</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(invoice.items || []).map((item, idx) => (
                  <tr key={item.id || idx} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-2.5 px-3 text-center font-mono text-slate-400">
                      {toPersianDigits(idx + 1)}
                    </td>
                    <td className="py-2.5 px-3 font-bold text-slate-800">
                      <div>{item.productName || 'کالا'}</div>
                      {item.variantName && (
                        <span className="text-[11px] font-normal text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200 inline-block mt-0.5">
                          تنوع: {item.variantName}
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono text-slate-500 text-[11px]">
                      {item.barcode ? toPersianDigits(item.barcode) : item.productCode ? toPersianDigits(item.productCode) : '-'}
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-900 whitespace-nowrap">
                      {toPersianDigits(item.quantity)} <span className="text-slate-400 font-normal text-[11px]">{item.unit || 'عدد'}</span>
                    </td>
                    <td className="py-2.5 px-3 text-left font-mono whitespace-nowrap text-slate-700">
                      {formatPrice(item.unitPrice, settings?.currency || 'تومان')}
                    </td>
                    {invoice.totalDiscount > 0 && (
                      <td className="py-2.5 px-3 text-left font-mono whitespace-nowrap text-rose-600">
                        {item.discount > 0 ? formatPrice(item.discount, settings?.currency || 'تومان') : '-'}
                      </td>
                    )}
                    <td className="py-2.5 px-3 text-left font-mono font-bold text-slate-900 whitespace-nowrap">
                      {formatPrice(item.total, settings?.currency || 'تومان')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 4. Financial Summary & Amount in Words */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
            {/* Amount in words & Notes */}
            <div className="md:col-span-7 space-y-3">
              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                <span className="text-[11px] text-slate-400 block mb-0.5">مبلغ کل قابل پرداخت به حروف:</span>
                <span className="font-bold text-slate-800 text-xs sm:text-sm">
                  {numberToPersianWords(invoice.finalTotal)} {settings?.currency || 'تومان'}
                </span>
              </div>

              {invoice.notes && (
                <div className="bg-amber-50/60 p-3.5 rounded-2xl border border-amber-200/80 text-xs text-amber-900">
                  <span className="font-bold block mb-1">یادداشت و شرایط فاکتور:</span>
                  <p className="leading-relaxed whitespace-pre-line">{invoice.notes}</p>
                </div>
              )}

              {/* Payment Details Card (Bank Transfer / Cheque) */}
              {(invoice.transferDescription || invoice.chequeNumber) && (
                <div className="bg-blue-50/60 p-3.5 rounded-2xl border border-blue-200/80 text-xs text-blue-900 space-y-1">
                  <span className="font-bold flex items-center gap-1 text-blue-950">
                    <CreditCard className="w-3.5 h-3.5" />
                    <span>مشخصات تسویه و پرداخت:</span>
                  </span>
                  {invoice.transferDescription && (
                    <p className="text-blue-800 leading-relaxed">
                      واریز بانکی: {invoice.transferDescription}
                    </p>
                  )}
                  {invoice.chequeNumber && (
                    <p className="text-blue-800 leading-relaxed">
                      شماره چک: {toPersianDigits(invoice.chequeNumber)} {invoice.chequeDueDate ? `(سررسید: ${toPersianDigits(invoice.chequeDueDate)})` : ''} {invoice.chequeName ? `- صاحب حساب: ${invoice.chequeName}` : ''}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Financial Totals Breakdown Table */}
            <div className="md:col-span-5 bg-slate-50 rounded-2xl p-4 border border-slate-200 space-y-2 text-xs">
              <div className="flex items-center justify-between text-slate-600">
                <span>تعداد کل اقلام:</span>
                <span className="font-bold font-mono text-slate-800">{toPersianDigits(totalItemsCount)} واحد</span>
              </div>

              <div className="flex items-center justify-between text-slate-600">
                <span>جمع اقلام (قبل از تخفیف):</span>
                <span className="font-mono text-slate-800">{formatPrice(invoice.subtotal, settings?.currency || 'تومان')}</span>
              </div>

              {invoice.totalDiscount > 0 && (
                <div className="flex items-center justify-between text-rose-600 font-medium">
                  <span>تخفیف کل فاکتور:</span>
                  <span className="font-mono">-{formatPrice(invoice.totalDiscount, settings?.currency || 'تومان')}</span>
                </div>
              )}

              {invoice.taxAmount > 0 && (
                <div className="flex items-center justify-between text-slate-600">
                  <span>مالیات بر ارزش افزوده ({toPersianDigits(invoice.taxRate)}٪):</span>
                  <span className="font-mono text-slate-800">+{formatPrice(invoice.taxAmount, settings?.currency || 'تومان')}</span>
                </div>
              )}

              <div className="pt-2 border-t border-slate-200 flex items-center justify-between font-black text-slate-900 text-sm sm:text-base">
                <span className="text-emerald-900">مبلغ نهایی قابل پرداخت:</span>
                <span className="font-mono text-emerald-800">{formatPrice(invoice.finalTotal, settings?.currency || 'تومان')}</span>
              </div>

              {invoice.paidAmount > 0 && (
                <div className="flex items-center justify-between text-emerald-700 font-bold pt-1">
                  <span>مبلغ دریافت شده:</span>
                  <span className="font-mono">{formatPrice(invoice.paidAmount, settings?.currency || 'تومان')}</span>
                </div>
              )}

              {remainingDebt > 0 && (
                <div className="flex items-center justify-between text-rose-700 font-black pt-1 bg-rose-50 -mx-2 p-2 rounded-xl border border-rose-200">
                  <span>مانده حساب / بدهی:</span>
                  <span className="font-mono">{formatPrice(remainingDebt, settings?.currency || 'تومان')}</span>
                </div>
              )}
            </div>
          </div>

          {/* 5. Footer & Official Digital Seal */}
          <div className="pt-6 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-xs text-slate-500 text-center sm:text-right space-y-1">
              {settings?.invoiceFooterText && (
                <p className="font-medium text-slate-700">{settings.invoiceFooterText}</p>
              )}
              <p className="text-[11px] text-slate-400">
                صادر شده توسط سامانه هوشمند فاکتور و انبارداری سپهر • تاریخ مشاهده: {toPersianDigits(new Date().toLocaleDateString('fa-IR'))}
              </p>
            </div>

            {/* Digital Stamp Simulation */}
            <div className="w-36 h-20 rounded-2xl border-2 border-dashed border-emerald-400/80 bg-emerald-50/50 flex flex-col items-center justify-center p-2 text-center text-[10px] text-emerald-800 shadow-2xs rotate-[-2deg]">
              <ShieldCheck className="w-5 h-5 text-emerald-600 mb-0.5" />
              <span className="font-black text-emerald-950">تاییدیه رسمی الکترونیکی</span>
              <span className="font-mono text-[9px] text-emerald-700 font-bold">VERIFIED #{toPersianDigits(invoice.invoiceNumber)}</span>
            </div>
          </div>
        </div>

        {/* Bottom Interactive Contact & Action Buttons for Customer */}
        <div className="no-print mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
          {storePhone && (
            <a
              href={`tel:${cleanPhone}`}
              className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white py-3 px-4 rounded-2xl font-bold text-xs sm:text-sm shadow-md shadow-emerald-600/20 transition-all"
            >
              <Phone className="w-4 h-4" />
              <span>تماس با فروشگاه ({toPersianDigits(storePhone)})</span>
            </a>
          )}

          {allowPdf && (
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={isExportingPdf}
              className="flex items-center justify-center gap-2 bg-white hover:bg-slate-50 active:scale-98 text-slate-800 border border-slate-300 py-3 px-4 rounded-2xl font-bold text-xs sm:text-sm shadow-2xs transition-all cursor-pointer"
            >
              <Download className="w-4 h-4 text-slate-600" />
              <span>دانلود فایل PDF فاکتور</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleShareNative}
            className="flex items-center justify-center gap-2 bg-sky-600 hover:bg-sky-700 active:scale-98 text-white py-3 px-4 rounded-2xl font-bold text-xs sm:text-sm shadow-md shadow-sky-600/20 transition-all cursor-pointer"
          >
            <Share2 className="w-4 h-4" />
            <span>اشتراک‌گذاری این فاکتور</span>
          </button>
        </div>

        {/* Small discrete back button for store users */}
        {onBackToApp && (
          <div className="no-print text-center mt-8">
            <button
              type="button"
              onClick={onBackToApp}
              className="text-xs text-slate-400 hover:text-slate-700 font-medium transition-colors cursor-pointer inline-flex items-center gap-1 bg-white px-3 py-1.5 rounded-full border border-slate-200 shadow-2xs"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>ورود به پنل حسابداری و فروشگاه</span>
            </button>
          </div>
        )}
      </main>

      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-2xl text-xs font-bold shadow-xl border border-slate-800 flex items-center gap-2 animate-in fade-in slide-in-from-bottom-3 duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toastMsg}</span>
        </div>
      )}
    </div>
  );
};
