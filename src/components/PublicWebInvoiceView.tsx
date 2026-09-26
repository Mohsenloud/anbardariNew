import React, { useState, useEffect, useMemo } from 'react';
import { 
  Invoice, 
  StoreSettings, 
  InvoiceShareLink,
  PublicCustomerDeposit,
  PublicCustomerRemittance,
  PublicCustomerLedger
} from '../types';
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
  Copy, 
  ShieldCheck, 
  RefreshCw, 
  FileText, 
  BadgeCheck, 
  Truck, 
  Wallet, 
  DollarSign, 
  Layers, 
  Search, 
  FileCheck, 
  Eye, 
  ArrowUpRight, 
  CheckCheck, 
  Inbox, 
  ChevronLeft,
  X,
  FileSpreadsheet
} from 'lucide-react';

interface PublicWebInvoiceViewProps {
  token: string;
  onBackToApp?: () => void;
}

type CustomerPortalTab = 'current' | 'invoices' | 'deposits' | 'remittances' | 'ledger';

export const PublicWebInvoiceView: React.FC<PublicWebInvoiceViewProps> = ({ token }) => {
  const [loading, setLoading] = useState(true);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [settings, setSettings] = useState<StoreSettings | null>(null);
  const [shareLink, setShareLink] = useState<InvoiceShareLink | null>(null);
  const [customerInvoices, setCustomerInvoices] = useState<Invoice[]>([]);
  const [deposits, setDeposits] = useState<PublicCustomerDeposit[]>([]);
  const [remittances, setRemittances] = useState<PublicCustomerRemittance[]>([]);
  const [customerLedger, setCustomerLedger] = useState<PublicCustomerLedger | null>(null);

  const [activeTab, setActiveTab] = useState<CustomerPortalTab>('current');
  const [pinRequired, setPinRequired] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [pinLoading, setPinLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [storeMeta, setStoreMeta] = useState<{ storeName?: string; storeLogo?: string; invoiceNumber?: string }>({});
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Filters
  const [searchInvoices, setSearchInvoices] = useState('');
  const [filterInvoiceStatus, setFilterInvoiceStatus] = useState<'all' | 'paid' | 'unpaid' | 'partial' | 'proforma'>('all');
  const [selectedRemittanceModal, setSelectedRemittanceModal] = useState<PublicCustomerRemittance | null>(null);

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
        setSelectedInvoice(res.invoice);
        setSettings(res.settings || null);
        setShareLink(res.shareLink || null);
        setCustomerInvoices(res.customerInvoices || [res.invoice]);
        setDeposits(res.deposits || []);
        setRemittances(res.remittances || []);
        setCustomerLedger(res.customerLedger || null);
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

  const displayedInvoice = selectedInvoice || invoice;

  const handlePrint = () => {
    if (!displayedInvoice) return;
    printElementDirectly('public-web-invoice-container', {
      pageSize: 'a4',
      orientation: 'portrait',
      documentType: 'invoice',
    });
  };

  const handleDownloadPdf = async () => {
    if (!displayedInvoice) return;
    try {
      setIsExportingPdf(true);
      const filename = displayedInvoice.isProforma
        ? `پیش_فاکتور_${displayedInvoice.invoiceNumber}.pdf`
        : `فاکتور_${displayedInvoice.invoiceNumber}.pdf`;

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
      showToast('پیوند فاکتور در حافظه کپی شد.');
    });
  };

  const handleShareNative = async () => {
    if (!displayedInvoice) return;
    const title = displayedInvoice.isProforma
      ? `پیش‌فاکتور خرید شماره ${toPersianDigits(displayedInvoice.invoiceNumber)}`
      : `فاکتور خرید شماره ${toPersianDigits(displayedInvoice.invoiceNumber)}`;
    const text = `فاکتور خرید شما در فروشگاه ${settings?.storeName || 'سپهر'}\nمبلغ: ${formatPrice(displayedInvoice.finalTotal, settings?.currency || 'تومان')}`;

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

  // Filtered invoices
  const filteredInvoices = useMemo(() => {
    return customerInvoices.filter((inv) => {
      const matchSearch =
        !searchInvoices.trim() ||
        inv.invoiceNumber.toLowerCase().includes(searchInvoices.trim().toLowerCase()) ||
        inv.date.includes(searchInvoices.trim()) ||
        (inv.notes && inv.notes.includes(searchInvoices.trim())) ||
        (inv.items && inv.items.some((it) => it.productName.includes(searchInvoices.trim())));

      if (!matchSearch) return false;

      if (filterInvoiceStatus === 'paid') return inv.paymentStatus === 'paid' && !inv.isProforma;
      if (filterInvoiceStatus === 'unpaid') return inv.paymentStatus === 'unpaid' && !inv.isProforma;
      if (filterInvoiceStatus === 'partial') return inv.paymentStatus === 'partial' && !inv.isProforma;
      if (filterInvoiceStatus === 'proforma') return !!inv.isProforma;

      return true;
    });
  }, [customerInvoices, searchInvoices, filterInvoiceStatus]);

  // Total deposits amount
  const totalDepositsAmount = useMemo(() => {
    return deposits
      .filter((d) => d.type === 'deposit')
      .reduce((sum, d) => sum + (d.amount || 0), 0);
  }, [deposits]);

  // 1. Loading State
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4 text-center select-none font-['Vazirmatn']" dir="rtl">
        <div className="w-16 h-16 rounded-3xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center mb-5 animate-pulse">
          <Receipt className="w-8 h-8 animate-bounce" />
        </div>
        <h2 className="text-white text-base sm:text-lg font-bold mb-2">
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
      <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 flex flex-col items-center justify-center p-4 font-['Vazirmatn']" dir="rtl">
        <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-slate-200 text-center animate-in fade-in zoom-in-95 duration-200">
          <div className="w-16 h-16 rounded-3xl bg-indigo-50 text-indigo-600 border border-indigo-200 flex items-center justify-center mx-auto mb-4 shadow-sm">
            <Lock className="w-8 h-8" />
          </div>

          <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-200 inline-block mb-3">
            حفاظت شده با رمز عبور
          </span>

          <h2 className="text-lg sm:text-xl font-black text-slate-900 mb-1.5">
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
              className="w-full min-h-[44px] py-3 px-4 bg-indigo-600 hover:bg-indigo-700 active:scale-98 disabled:opacity-50 text-white rounded-2xl font-bold text-xs sm:text-sm transition-all shadow-md shadow-indigo-600/20 cursor-pointer flex items-center justify-center gap-2"
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
        </div>
      </div>
    );
  }

  // 3. Error / Expired State
  if (errorMessage || !invoice) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 font-['Vazirmatn']" dir="rtl">
        <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-slate-200 text-center animate-in fade-in zoom-in-95 duration-200">
          <div className="w-16 h-16 rounded-3xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center mx-auto mb-4 shadow-sm">
            <ShieldAlert className="w-8 h-8" />
          </div>

          <h2 className="text-base sm:text-lg font-black text-slate-900 mb-2">
            عدم دسترسی به فاکتور آنلاین
          </h2>

          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed mb-6 bg-amber-50/70 p-3.5 rounded-2xl border border-amber-200/80">
            {errorMessage || 'این پیوند نامعتبر است، منقضی شده یا دسترسی به آن توسط صادرکننده باطل شده است.'}
          </p>

          {storePhone && (
            <a
              href={`tel:${cleanPhone}`}
              className="w-full min-h-[44px] py-3 px-4 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white rounded-2xl font-bold text-xs sm:text-sm transition-all shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2"
            >
              <Phone className="w-4 h-4" />
              <span>تماس با فروشگاه ({toPersianDigits(storePhone)})</span>
            </a>
          )}
        </div>
      </div>
    );
  }

  // Active displayed invoice calculations
  const currInv = displayedInvoice || invoice;
  const isPaid = currInv.paymentStatus === 'paid';
  const isPartial = currInv.paymentStatus === 'partial';
  const isUnpaid = currInv.paymentStatus === 'unpaid';
  const remainingDebt = Math.max(0, currInv.finalTotal - (isPaid ? currInv.finalTotal : (currInv.paidAmount || 0)));
  const totalItemsCount = (currInv.items || []).reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
  const allowPdf = shareLink?.allowPdfDownload !== false;

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 pb-16 font-['Vazirmatn'] selection:bg-emerald-500 selection:text-white" dir="rtl">
      {/* Top Header Bar */}
      <header className="no-print bg-slate-900 text-white sticky top-0 z-40 shadow-lg border-b border-slate-800">
        <div className="max-w-5xl mx-auto px-3 sm:px-6 py-2.5 flex items-center justify-between gap-3">
          {/* Brand & Store Name */}
          <div className="flex items-center gap-2.5 min-w-0">
            {settings?.logo ? (
              <img
                src={settings.logo}
                alt={settings.storeName}
                className="w-9 h-9 rounded-xl object-contain bg-white/10 p-1 border border-white/20 shrink-0"
              />
            ) : (
              <span className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shrink-0">
                <Receipt className="w-5 h-5" />
              </span>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-bold text-xs sm:text-sm text-white truncate">
                  {settings?.storeName || 'بازرگانی و فروشگاه سپهر'}
                </span>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-medium px-2 py-0.5 rounded-full border border-emerald-500/30 whitespace-nowrap">
                  پورتال مشتریان
                </span>
              </div>
              <p className="text-[11px] text-slate-400 truncate">
                مشتری گرامی: <strong className="text-slate-200 font-semibold">{invoice.customerName}</strong>
              </p>
            </div>
          </div>

          {/* Quick Header Actions */}
          <div className="flex items-center gap-1.5 shrink-0">
            {allowPdf && (
              <button
                type="button"
                onClick={handleDownloadPdf}
                disabled={isExportingPdf}
                className="min-h-[38px] flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 active:scale-98 disabled:opacity-50 text-white px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
                title="دانلود نسخه PDF"
              >
                {isExportingPdf ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span className="hidden sm:inline">در حال آماده‌سازی...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-3.5 h-3.5" />
                    <span className="hidden xs:inline">دانلود PDF</span>
                  </>
                )}
              </button>
            )}

            <button
              type="button"
              onClick={handlePrint}
              className="min-h-[38px] flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold border border-slate-700 transition-all cursor-pointer"
              title="چاپ مستقیم فاکتور"
            >
              <Printer className="w-3.5 h-3.5 text-blue-400" />
              <span className="hidden sm:inline">چاپ</span>
            </button>

            <button
              type="button"
              onClick={handleShareNative}
              className="min-h-[38px] flex items-center gap-1.5 bg-sky-950/80 hover:bg-sky-900 text-sky-300 hover:text-white px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold border border-sky-600/40 transition-colors cursor-pointer"
              title="اشتراک‌گذاری"
            >
              <Share2 className="w-3.5 h-3.5 text-sky-400" />
              <span className="hidden md:inline">اشتراک</span>
            </button>
          </div>
        </div>

        {/* Customer Navigation Tabs (Mobile-Optimized Horizontal Scroll) */}
        <div className="bg-slate-950/90 border-t border-slate-800/80 overflow-x-auto no-scrollbar">
          <div className="max-w-5xl mx-auto px-2 sm:px-6 flex items-center gap-1 py-1.5 min-w-max">
            <button
              type="button"
              onClick={() => setActiveTab('current')}
              className={`min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'current'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Receipt className="w-4 h-4 shrink-0" />
              <span>فاکتور فعلی ({toPersianDigits(currInv.invoiceNumber)})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('invoices')}
              className={`min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'invoices'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <FileSpreadsheet className="w-4 h-4 shrink-0" />
              <span>تمام فاکتورهای من</span>
              <span className="px-1.5 py-0.2 rounded-md bg-white/10 text-[10px] font-mono">
                {toPersianDigits(customerInvoices.length)}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('deposits')}
              className={`min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'deposits'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Wallet className="w-4 h-4 shrink-0" />
              <span>واریزی‌ها و پرداخت‌ها</span>
              <span className="px-1.5 py-0.2 rounded-md bg-white/10 text-[10px] font-mono">
                {toPersianDigits(deposits.length)}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('remittances')}
              className={`min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'remittances'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Truck className="w-4 h-4 shrink-0" />
              <span>حواله‌های انبار و باربری</span>
              <span className="px-1.5 py-0.2 rounded-md bg-white/10 text-[10px] font-mono">
                {toPersianDigits(remittances.length)}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('ledger')}
              className={`min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'ledger'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <DollarSign className="w-4 h-4 shrink-0" />
              <span>خلاصه حساب و مانده</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-5xl mx-auto px-2 sm:px-6 py-4 sm:py-6">
        
        {/* TAB 1: CURRENT INVOICE VIEW */}
        {activeTab === 'current' && (
          <div className="space-y-4">
            {/* Quick Status Bar for Active Invoice */}
            <div className="no-print bg-white rounded-2xl p-3.5 sm:p-4 border border-slate-200/90 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
                  isPaid ? 'bg-emerald-100 text-emerald-700' :
                  isPartial ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'
                }`}>
                  {isPaid ? <CheckCircle2 className="w-5 h-5" /> :
                   isPartial ? <Clock className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-sm text-slate-900">
                      {currInv.isProforma ? 'پیش‌فاکتور شماره' : 'فاکتور فروش شماره'} {toPersianDigits(currInv.invoiceNumber)}
                    </span>
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${
                      isPaid ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                      isPartial ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                      'bg-rose-50 text-rose-700 border border-rose-200'
                    }`}>
                      {isPaid ? 'کاملاً پرداخت و تسویه شده' :
                       isPartial ? `پرداخت بخشی (${formatPrice(currInv.paidAmount, settings?.currency || 'تومان')} دریافت شد)` :
                       'پرداخت نشده / نسیه'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    تاریخ صدور: {toPersianDigits(currInv.date)}
                    {currInv.dueDate && ` • سررسید: ${toPersianDigits(currInv.dueDate)}`}
                  </p>
                </div>
              </div>

              {/* Quick Mobile Action Buttons */}
              <div className="flex items-center gap-2 self-end sm:self-auto">
                <button
                  type="button"
                  onClick={handleDownloadPdf}
                  disabled={isExportingPdf}
                  className="min-h-[44px] px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer border border-emerald-200"
                >
                  <Download className="w-4 h-4 text-emerald-600" />
                  <span>دانلود PDF</span>
                </button>
                <button
                  type="button"
                  onClick={handlePrint}
                  className="min-h-[44px] px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer border border-slate-200"
                >
                  <Printer className="w-4 h-4 text-slate-600" />
                  <span>چاپ</span>
                </button>
              </div>
            </div>

            {/* Printable Digital Invoice Container */}
            <div
              id="public-web-invoice-container"
              className="bg-white rounded-3xl border border-slate-200 shadow-sm p-4 sm:p-8 space-y-6 print:p-0 print:border-none print:shadow-none"
            >
              {/* 1. Official Header */}
              <div className="flex flex-col sm:flex-row items-center sm:items-start justify-between pb-6 border-b border-slate-200 gap-4 text-center sm:text-right">
                {/* Store Identity */}
                <div className="flex flex-col sm:flex-row items-center gap-4">
                  {settings?.logo ? (
                    <img
                      src={settings.logo}
                      alt={settings.storeName}
                      className="w-16 h-16 sm:w-20 sm:h-20 object-contain rounded-2xl border border-slate-100 p-1"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center">
                      <Building2 className="w-8 h-8" />
                    </div>
                  )}

                  <div>
                    <h1 className="text-lg sm:text-xl font-black text-slate-900">
                      {settings?.storeName || 'سامانه حسابداری سپهر'}
                    </h1>
                    {settings?.tagline && (
                      <p className="text-xs text-slate-500 mt-1">{settings.tagline}</p>
                    )}
                    {settings?.sellerName && (
                      <p className="text-xs text-slate-600 mt-0.5">
                        مدیریت: <span className="font-bold">{settings.sellerName}</span>
                      </p>
                    )}
                  </div>
                </div>

                {/* Invoice Type Title & Meta Badges */}
                <div className="flex flex-col items-center sm:items-end space-y-1.5">
                  <div className="inline-block px-3.5 py-1 rounded-xl bg-slate-900 text-white text-xs font-bold tracking-tight">
                    {currInv.isProforma ? 'پیش‌فاکتور فروش کالا' : 'فاکتور رسمی فروش کالا'}
                  </div>

                  <div className="text-xs text-slate-600 space-y-0.5 text-center sm:text-left">
                    <p>
                      شماره فاکتور: <span className="font-mono font-bold text-slate-900">{toPersianDigits(currInv.invoiceNumber)}</span>
                    </p>
                    <p>
                      تاریخ صدور: <span className="font-mono text-slate-800">{toPersianDigits(currInv.date)}</span>
                    </p>
                    {currInv.dueDate && (
                      <p className="text-amber-800 font-medium">
                        سررسید تسویه: <span className="font-mono font-bold">{toPersianDigits(currInv.dueDate)}</span>
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* 2. Seller and Customer Information Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                {/* Seller Box */}
                <div className="bg-slate-50/70 p-4 rounded-2xl border border-slate-200/80 space-y-2">
                  <div className="flex items-center gap-1.5 font-bold text-slate-800 border-b border-slate-200/80 pb-2">
                    <Building2 className="w-4 h-4 text-emerald-600" />
                    <span>مشخصات صادرکننده (فروشنده):</span>
                  </div>

                  <div className="space-y-1 text-slate-600 leading-relaxed">
                    <p>
                      <strong className="text-slate-800">نام شخص یا شرکت:</strong> {settings?.storeName || '—'}
                    </p>
                    {storePhone && (
                      <p>
                        <strong className="text-slate-800">تلفن تماس:</strong> <span className="font-mono">{toPersianDigits(storePhone)}</span>
                      </p>
                    )}
                    {settings?.nationalCode && (
                      <p>
                        <strong className="text-slate-800">شناسه ملی / ثبت:</strong> <span className="font-mono">{toPersianDigits(settings.nationalCode)}</span>
                      </p>
                    )}
                    {settings?.address && (
                      <p>
                        <strong className="text-slate-800">نشانی فروشگاه:</strong> {settings.address}
                      </p>
                    )}
                  </div>
                </div>

                {/* Customer Box */}
                <div className="bg-slate-50/70 p-4 rounded-2xl border border-slate-200/80 space-y-2">
                  <div className="flex items-center gap-1.5 font-bold text-slate-800 border-b border-slate-200/80 pb-2">
                    <User className="w-4 h-4 text-blue-600" />
                    <span>مشخصات خریدار (مشتری):</span>
                  </div>

                  <div className="space-y-1 text-slate-600 leading-relaxed">
                    <p>
                      <strong className="text-slate-800">نام خریدار:</strong> {currInv.customerName || 'مشتری آزاد'}
                    </p>
                    {currInv.customerPhone && (
                      <p>
                        <strong className="text-slate-800">شماره تماس:</strong> <span className="font-mono">{toPersianDigits(currInv.customerPhone)}</span>
                      </p>
                    )}
                    {currInv.customerNationalId && (
                      <p>
                        <strong className="text-slate-800">شناسه / کدملی:</strong> <span className="font-mono">{toPersianDigits(currInv.customerNationalId)}</span>
                      </p>
                    )}
                    {currInv.customerAddress && (
                      <p>
                        <strong className="text-slate-800">آدرس تحویل:</strong> {currInv.customerAddress}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* 3. Items Presentation: Responsive Cards for Mobile + Classic Table for Desktop & Print */}
              <div>
                <h3 className="text-xs font-bold text-slate-800 mb-2 flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-slate-600" />
                  <span>اقلام و کالاهای فاکتور ({toPersianDigits((currInv.items || []).length)} ردیف):</span>
                </h3>

                {/* 3.A: Mobile Cards View (Visible on screens < md, hidden on desktop and print) */}
                <div className="block md:hidden space-y-2.5 print:hidden">
                  {(currInv.items || []).map((item, idx) => (
                    <div
                      key={item.id || idx}
                      className="bg-slate-50/90 rounded-2xl p-3.5 border border-slate-200 space-y-2 text-xs"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex items-start gap-2">
                          <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                            {toPersianDigits(idx + 1)}
                          </span>
                          <div>
                            <h4 className="font-bold text-slate-900 text-xs sm:text-sm">
                              {item.productName}
                            </h4>
                            {item.variantName && (
                              <span className="inline-block text-[10px] text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded mt-0.5 font-medium">
                                تنوع: {item.variantName}
                              </span>
                            )}
                            {item.productCode && (
                              <p className="text-[11px] text-slate-400 mt-0.5 font-mono">
                                کد کالا: {toPersianDigits(item.productCode)}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="text-left shrink-0">
                          <span className="text-[11px] text-slate-500 block">جمع ردیف:</span>
                          <span className="font-bold font-mono text-emerald-800 text-xs sm:text-sm">
                            {formatPrice(item.total, settings?.currency || 'تومان')}
                          </span>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-slate-200/80 flex items-center justify-between text-[11px] text-slate-600">
                        <div>
                          <span>مقدار: </span>
                          <strong className="font-mono text-slate-800">
                            {toPersianDigits(item.quantity)} {item.unit || 'عدد'}
                          </strong>
                        </div>
                        <div>
                          <span>فی: </span>
                          <span className="font-mono text-slate-700">
                            {formatPrice(item.unitPrice, settings?.currency || 'تومان')}
                          </span>
                        </div>
                        {item.discount > 0 && (
                          <div className="text-rose-600 font-medium">
                            <span>تخفیف: </span>
                            <span className="font-mono">-{formatPrice(item.discount, settings?.currency || 'تومان')}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* 3.B: Classic Table View (Visible on md+ screens and strictly preserved for Print / PDF export) */}
                <div className="hidden md:block print:block overflow-x-auto rounded-2xl border border-slate-200">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3 w-10 text-center">#</th>
                        <th className="py-2.5 px-3">شرح کالا یا خدمات</th>
                        <th className="py-2.5 px-3 text-center">تعداد / مقدار</th>
                        <th className="py-2.5 px-3 text-left">قیمت واحد</th>
                        <th className="py-2.5 px-3 text-left">تخفیف</th>
                        <th className="py-2.5 px-3 text-left">مبلغ کل ({settings?.currency || 'تومان'})</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(currInv.items || []).map((item, idx) => (
                        <tr key={item.id || idx} className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-2.5 px-3 text-center font-mono text-slate-400">
                            {toPersianDigits(idx + 1)}
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="font-bold text-slate-900">{item.productName}</span>
                            {item.variantName && (
                              <span className="mr-1.5 text-[10px] text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded font-medium">
                                {item.variantName}
                              </span>
                            )}
                            {item.productCode && (
                              <span className="block text-[10px] text-slate-400 font-mono">
                                کد: {toPersianDigits(item.productCode)}
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-800">
                            {toPersianDigits(item.quantity)} <span className="text-[10px] font-normal text-slate-500">{item.unit}</span>
                          </td>
                          <td className="py-2.5 px-3 text-left font-mono text-slate-700">
                            {formatPrice(item.unitPrice, '')}
                          </td>
                          <td className="py-2.5 px-3 text-left font-mono text-rose-600">
                            {item.discount > 0 ? formatPrice(item.discount, '') : '—'}
                          </td>
                          <td className="py-2.5 px-3 text-left font-mono font-bold text-slate-900">
                            {formatPrice(item.total, '')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 4. Financial Totals & Payment Summary */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 pt-2">
                {/* Notes & Bank Details */}
                <div className="md:col-span-7 space-y-3">
                  <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                    <span className="text-[11px] text-slate-400 block mb-0.5">مبلغ کل قابل پرداخت به حروف:</span>
                    <span className="font-bold text-slate-800 text-xs sm:text-sm">
                      {numberToPersianWords(currInv.finalTotal)} {settings?.currency || 'تومان'}
                    </span>
                  </div>

                  {currInv.notes && (
                    <div className="bg-amber-50/70 p-3.5 rounded-2xl border border-amber-200/80 text-xs text-amber-900">
                      <span className="font-bold block mb-1">یادداشت و شرایط فاکتور:</span>
                      <p className="leading-relaxed whitespace-pre-line">{currInv.notes}</p>
                    </div>
                  )}

                  {/* Payment Details Card (Bank Transfer / Cheque) */}
                  {(currInv.transferDescription || currInv.chequeNumber) && (
                    <div className="bg-blue-50/70 p-3.5 rounded-2xl border border-blue-200/80 text-xs text-blue-900 space-y-1">
                      <span className="font-bold flex items-center gap-1 text-blue-950">
                        <CreditCard className="w-3.5 h-3.5" />
                        <span>مشخصات تسویه و پرداخت:</span>
                      </span>
                      {currInv.transferDescription && (
                        <p className="text-blue-800 leading-relaxed">
                          واریز بانکی: {currInv.transferDescription}
                        </p>
                      )}
                      {currInv.chequeNumber && (
                        <p className="text-blue-800 leading-relaxed">
                          شماره چک: {toPersianDigits(currInv.chequeNumber)} {currInv.chequeDueDate ? `(سررسید: ${toPersianDigits(currInv.chequeDueDate)})` : ''} {currInv.chequeName ? `- صاحب حساب: ${currInv.chequeName}` : ''}
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
                    <span className="font-mono text-slate-800">{formatPrice(currInv.subtotal, settings?.currency || 'تومان')}</span>
                  </div>

                  {currInv.totalDiscount > 0 && (
                    <div className="flex items-center justify-between text-rose-600 font-medium">
                      <span>تخفیف کل فاکتور:</span>
                      <span className="font-mono">-{formatPrice(currInv.totalDiscount, settings?.currency || 'تومان')}</span>
                    </div>
                  )}

                  {currInv.taxAmount > 0 && (
                    <div className="flex items-center justify-between text-slate-600">
                      <span>مالیات ارزش افزوده ({toPersianDigits(currInv.taxRate)}٪):</span>
                      <span className="font-mono text-slate-800">+{formatPrice(currInv.taxAmount, settings?.currency || 'تومان')}</span>
                    </div>
                  )}

                  <div className="pt-2 border-t border-slate-200 flex items-center justify-between font-black text-slate-900 text-sm sm:text-base">
                    <span className="text-emerald-900">مبلغ نهایی قابل پرداخت:</span>
                    <span className="font-mono text-emerald-800">{formatPrice(currInv.finalTotal, settings?.currency || 'تومان')}</span>
                  </div>

                  {currInv.paidAmount > 0 && (
                    <div className="flex items-center justify-between text-emerald-700 font-bold pt-1">
                      <span>مبلغ دریافت شده:</span>
                      <span className="font-mono">{formatPrice(currInv.paidAmount, settings?.currency || 'تومان')}</span>
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
                  <span className="font-mono text-[9px] text-emerald-700 font-bold">VERIFIED #{toPersianDigits(currInv.invoiceNumber)}</span>
                </div>
              </div>
            </div>

            {/* Bottom Customer Utility Actions */}
            <div className="no-print grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              {storePhone && (
                <a
                  href={`tel:${cleanPhone}`}
                  className="min-h-[44px] flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white py-3 px-4 rounded-2xl font-bold text-xs sm:text-sm shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
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
                  className="min-h-[44px] flex items-center justify-center gap-2 bg-white hover:bg-slate-50 active:scale-98 text-slate-800 border border-slate-300 py-3 px-4 rounded-2xl font-bold text-xs sm:text-sm shadow-2xs transition-all cursor-pointer"
                >
                  <Download className="w-4 h-4 text-slate-600" />
                  <span>دانلود فایل PDF فاکتور</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleShareNative}
                className="min-h-[44px] flex items-center justify-center gap-2 bg-sky-600 hover:bg-sky-700 active:scale-98 text-white py-3 px-4 rounded-2xl font-bold text-xs sm:text-sm shadow-md shadow-sky-600/20 transition-all cursor-pointer"
              >
                <Share2 className="w-4 h-4" />
                <span>اشتراک‌گذاری این فاکتور</span>
              </button>
            </div>
          </div>
        )}

        {/* TAB 2: ALL CUSTOMER INVOICES */}
        {activeTab === 'invoices' && (
          <div className="space-y-4">
            {/* Header & Filters */}
            <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                    <span>آرشیو تمام فاکتورهای شما ({toPersianDigits(customerInvoices.length)} فاکتور)</span>
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    شما می‌توانید با لمس هر فاکتور، متن کامل و جزئیات آن را فوراً مشاهده نمایید.
                  </p>
                </div>

                {/* Search Bar */}
                <div className="relative w-full sm:w-64">
                  <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="جستجو در فاکتورها..."
                    value={searchInvoices}
                    onChange={(e) => setSearchInvoices(e.target.value)}
                    className="w-full pl-3 pr-9 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:border-emerald-500 focus:bg-white transition-colors"
                  />
                  {searchInvoices && (
                    <button
                      type="button"
                      onClick={() => setSearchInvoices('')}
                      className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Status Tabs */}
              <div className="flex items-center gap-1.5 flex-wrap pt-2 border-t border-slate-100 text-xs">
                <button
                  type="button"
                  onClick={() => setFilterInvoiceStatus('all')}
                  className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                    filterInvoiceStatus === 'all'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  همه ({toPersianDigits(customerInvoices.length)})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterInvoiceStatus('paid')}
                  className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                    filterInvoiceStatus === 'paid'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                  }`}
                >
                  تسویه شده
                </button>
                <button
                  type="button"
                  onClick={() => setFilterInvoiceStatus('unpaid')}
                  className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                    filterInvoiceStatus === 'unpaid'
                      ? 'bg-rose-600 text-white shadow-xs'
                      : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                  }`}
                >
                  پرداخت نشده / نسیه
                </button>
                <button
                  type="button"
                  onClick={() => setFilterInvoiceStatus('partial')}
                  className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                    filterInvoiceStatus === 'partial'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                  }`}
                >
                  پرداخت بخشی
                </button>
                <button
                  type="button"
                  onClick={() => setFilterInvoiceStatus('proforma')}
                  className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                    filterInvoiceStatus === 'proforma'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
                  }`}
                >
                  پیش‌فاکتورها
                </button>
              </div>
            </div>

            {/* Invoices List Grid */}
            {filteredInvoices.length === 0 ? (
              <div className="bg-white rounded-2xl p-12 text-center border border-slate-200">
                <Inbox className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <h3 className="text-sm font-bold text-slate-700 mb-1">فاکتوری با این مشخصات یافت نشد</h3>
                <p className="text-xs text-slate-400">عبارت جستجو یا فیلتر وضعیت را بررسی فرمایید.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {filteredInvoices.map((inv) => {
                  const isCurrent = (displayedInvoice?.id === inv.id);
                  const isInvPaid = inv.paymentStatus === 'paid';
                  const isInvPartial = inv.paymentStatus === 'partial';
                  const invRemDebt = Math.max(0, inv.finalTotal - (isInvPaid ? inv.finalTotal : (inv.paidAmount || 0)));

                  return (
                    <div
                      key={inv.id}
                      onClick={() => {
                        setSelectedInvoice(inv);
                        setActiveTab('current');
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      className={`bg-white rounded-2xl p-4 border transition-all cursor-pointer hover:shadow-md hover:border-emerald-400/80 relative space-y-3 ${
                        isCurrent ? 'ring-2 ring-emerald-500 border-emerald-500' : 'border-slate-200'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-black text-slate-900 text-sm">
                              {inv.isProforma ? 'پیش‌فاکتور' : 'فاکتور فروش'} {toPersianDigits(inv.invoiceNumber)}
                            </span>
                            {isCurrent && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                                در حال مشاهده
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-400 mt-0.5">
                            تاریخ: {toPersianDigits(inv.date)} • {toPersianDigits((inv.items || []).length)} قلم کالا
                          </p>
                        </div>

                        <span className={`text-[11px] font-bold px-2.5 py-1 rounded-xl shrink-0 ${
                          isInvPaid ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                          isInvPartial ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                          inv.isProforma ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' :
                          'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}>
                          {isInvPaid ? 'تسویه شده' :
                           isInvPartial ? 'بخشی پرداخت‌شده' :
                           inv.isProforma ? 'پیش‌فاکتور' : 'پرداخت نشده'}
                        </span>
                      </div>

                      {/* Items Preview */}
                      <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-xs text-slate-600 line-clamp-1">
                        {(inv.items || []).map((it) => it.productName).join(' ، ') || 'اقلام کالا'}
                      </div>

                      {/* Financial Figures & Action */}
                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                        <div>
                          <span className="text-[11px] text-slate-400 block">مبلغ نهایی:</span>
                          <span className="font-bold font-mono text-slate-900 text-sm">
                            {formatPrice(inv.finalTotal, settings?.currency || 'تومان')}
                          </span>
                        </div>

                        {invRemDebt > 0 && !inv.isProforma && (
                          <div className="text-left">
                            <span className="text-[11px] text-rose-500 block">مانده بدهی:</span>
                            <span className="font-bold font-mono text-rose-700 text-xs">
                              {formatPrice(invRemDebt, settings?.currency || 'تومان')}
                            </span>
                          </div>
                        )}

                        <span className="inline-flex items-center gap-1 text-emerald-700 font-bold text-xs bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-xl transition-colors">
                          <Eye className="w-3.5 h-3.5" />
                          <span>مشاهده</span>
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: DEPOSITS & PAYMENTS */}
        {activeTab === 'deposits' && (
          <div className="space-y-4">
            {/* Summary Banner */}
            <div className="bg-gradient-to-r from-emerald-600 to-teal-700 text-white rounded-3xl p-5 sm:p-6 shadow-md">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <span className="text-emerald-100 text-xs block mb-1">مجموع پرداختی‌ها و واریزهای تایید شده:</span>
                  <h3 className="text-2xl sm:text-3xl font-black font-mono">
                    {formatPrice(totalDepositsAmount, settings?.currency || 'تومان')}
                  </h3>
                  <p className="text-xs text-emerald-100/90 mt-1">
                    تعداد کل اسناد پرداختی: {toPersianDigits(deposits.length)} سند مالی
                  </p>
                </div>
                <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center shrink-0 border border-white/20">
                  <Wallet className="w-7 h-7 text-emerald-200" />
                </div>
              </div>
            </div>

            {/* Deposits List */}
            {deposits.length === 0 ? (
              <div className="bg-white rounded-2xl p-12 text-center border border-slate-200">
                <DollarSign className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <h3 className="text-sm font-bold text-slate-700 mb-1">هیچ واریزی یا پرداختی ثبت نشده است</h3>
                <p className="text-xs text-slate-400">به محض ثبت واریز وجه یا چک، سوابق در این قسمت نمایش داده خواهد شد.</p>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
                <div className="p-4 border-b border-slate-100 font-bold text-xs text-slate-700 flex items-center justify-between">
                  <span>ریز واریزها و فیش‌های بانکی ثبت‌شده</span>
                  <span className="text-slate-400 font-normal">{toPersianDigits(deposits.length)} ردیف</span>
                </div>

                <div className="divide-y divide-slate-100">
                  {deposits.map((dep, idx) => (
                    <div key={dep.id || idx} className="p-4 hover:bg-slate-50/70 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                      <div className="flex items-start gap-3">
                        <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5 border border-emerald-200">
                          <CheckCheck className="w-4 h-4" />
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-slate-900 text-sm">
                              {dep.title || 'واریز به حساب'}
                            </span>
                            {dep.invoiceNumber && (
                              <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-mono">
                                بابت فاکتور: {toPersianDigits(dep.invoiceNumber)}
                              </span>
                            )}
                          </div>
                          <div className="text-slate-500 text-[11px] flex items-center gap-3 flex-wrap">
                            <span>تاریخ: {toPersianDigits(dep.date)}</span>
                            {dep.trackingNumber && (
                              <span>شماره پیگیری/ارجاع: <strong className="font-mono text-slate-700">{toPersianDigits(dep.trackingNumber)}</strong></span>
                            )}
                            {dep.bankName && (
                              <span>بانک: {dep.bankName}</span>
                            )}
                            {dep.chequeDueDate && (
                              <span className="text-amber-800">سررسید چک: {toPersianDigits(dep.chequeDueDate)}</span>
                            )}
                          </div>
                          {dep.notes && (
                            <p className="text-[11px] text-slate-600 bg-slate-50 p-1.5 rounded-lg border border-slate-100">
                              توضیحات: {dep.notes}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="text-right sm:text-left self-end sm:self-auto shrink-0">
                        <span className="text-[11px] text-slate-400 block">مبلغ واریزی:</span>
                        <span className="font-black font-mono text-emerald-700 text-sm sm:text-base">
                          +{formatPrice(dep.amount, settings?.currency || 'تومان')}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 4: REMITTANCES & DELIVERY SLIPS */}
        {activeTab === 'remittances' && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Truck className="w-5 h-5 text-indigo-600" />
                <span>حواله‌های خروج انبار و بارگیری ({toPersianDigits(remittances.length)} حواله)</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                مشخصات کامل ارسال محموله‌ها، رانندگان حامل بار، پلاک خودرو و وضعیت تحویل فیزیکی اقلام.
              </p>
            </div>

            {remittances.length === 0 ? (
              <div className="bg-white rounded-2xl p-12 text-center border border-slate-200">
                <Truck className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <h3 className="text-sm font-bold text-slate-700 mb-1">هیچ حواله خروجی برای شما صادر نشده است</h3>
                <p className="text-xs text-slate-400">به محض بارگیری اقلام فاکتور در انبار، حواله خروج رسمی در این بخش درج می‌گردد.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {remittances.map((rem) => {
                  const isDelivered = rem.status === 'delivered';
                  return (
                    <div
                      key={rem.id}
                      className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs space-y-3 hover:border-indigo-300 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-slate-900 text-sm">
                              {rem.remittanceNumber}
                            </span>
                            {rem.invoiceNumber && (
                              <span className="text-[10px] bg-slate-100 text-slate-700 font-mono px-2 py-0.5 rounded">
                                فاکتور {toPersianDigits(rem.invoiceNumber)}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-400 mt-0.5">
                            تاریخ خروج / تحویل: {toPersianDigits(rem.date)}
                          </p>
                        </div>

                        <span className={`text-[11px] font-bold px-2.5 py-1 rounded-xl ${
                          isDelivered
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-blue-50 text-blue-700 border border-blue-200'
                        }`}>
                          {rem.statusTitle}
                        </span>
                      </div>

                      {/* Carrier & Receiver Info */}
                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-1.5 text-xs text-slate-600">
                        {rem.vehicleInfo && (
                          <div className="flex items-center gap-1.5">
                            <Truck className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span>مشخصات خودرو و پلاک: <strong className="text-slate-800">{rem.vehicleInfo}</strong></span>
                          </div>
                        )}
                        {rem.receiverName && (
                          <div className="flex items-center gap-1.5">
                            <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span>تحویل‌گیرنده / راننده: <strong className="text-slate-800">{rem.receiverName}</strong></span>
                            {rem.receiverPhone && (
                              <span className="text-slate-500 font-mono">({toPersianDigits(rem.receiverPhone)})</span>
                            )}
                          </div>
                        )}
                        {rem.deliveredBy && (
                          <p className="text-[11px] text-slate-400">
                            انباردار تاییدکننده: {rem.deliveredBy}
                          </p>
                        )}
                      </div>

                      {/* Items Summary in Remittance */}
                      {rem.items && rem.items.length > 0 && (
                        <div className="space-y-1 pt-1">
                          <span className="text-[11px] font-bold text-slate-500 block">اقلام تحویلی در این حواله:</span>
                          <div className="divide-y divide-slate-100 text-xs">
                            {rem.items.map((it, iIdx) => (
                              <div key={iIdx} className="py-1 flex items-center justify-between text-slate-700">
                                <span>{it.productName}</span>
                                <span className="font-bold font-mono text-slate-900">
                                  {toPersianDigits(it.quantity)} {it.unit}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 5: CUSTOMER STATEMENT & LEDGER */}
        {activeTab === 'ledger' && (
          <div className="space-y-4">
            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-2xs space-y-6">
              <div>
                <h2 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-emerald-600" />
                  <span>صورت‌حساب و وضعیت تراز مالی</span>
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  خلاصه کامل کلیه تعاملات تجاری شما با فروشگاه {settings?.storeName || 'سپهر'}.
                </p>
              </div>

              {/* 3 Metric Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                  <span className="text-xs text-slate-500 block mb-1">مجموع کل خریدها:</span>
                  <div className="text-lg sm:text-xl font-black font-mono text-slate-900">
                    {formatPrice(customerLedger?.totalPurchases || 0, settings?.currency || 'تومان')}
                  </div>
                  <span className="text-[11px] text-slate-400 mt-1 block">
                    از {toPersianDigits(customerInvoices.filter((i) => !i.isProforma).length)} فاکتور نهایی
                  </span>
                </div>

                <div className="bg-emerald-50/70 p-4 rounded-2xl border border-emerald-200">
                  <span className="text-xs text-emerald-800 block mb-1">مجموع کل واریزها و تسویه‌ها:</span>
                  <div className="text-lg sm:text-xl font-black font-mono text-emerald-900">
                    {formatPrice(customerLedger?.totalPaid || 0, settings?.currency || 'تومان')}
                  </div>
                  <span className="text-[11px] text-emerald-700 mt-1 block">
                    واریزی‌های تایید شده در سیستم
                  </span>
                </div>

                <div className={`p-4 rounded-2xl border ${
                  (customerLedger?.balance || 0) > 0 ? 'bg-rose-50/80 border-rose-200 text-rose-900' :
                  (customerLedger?.balance || 0) < 0 ? 'bg-blue-50/80 border-blue-200 text-blue-900' :
                  'bg-emerald-50/80 border-emerald-200 text-emerald-900'
                }`}>
                  <span className="text-xs block mb-1">
                    {(customerLedger?.balance || 0) > 0 ? 'مانده بدهکاری جاری:' :
                     (customerLedger?.balance || 0) < 0 ? 'مانده بستانکاری (طلب شما):' : 'وضعیت حساب:'}
                  </span>
                  <div className="text-lg sm:text-xl font-black font-mono">
                    {(customerLedger?.balance || 0) === 0 ? 'کاملاً تسویه شده (۰)' :
                     formatPrice(Math.abs(customerLedger?.balance || 0), settings?.currency || 'تومان')}
                  </div>
                  <span className="text-[11px] font-bold mt-1 block">
                    {(customerLedger?.balance || 0) > 0 ? 'جهت تسویه با فروشگاه تماس حاصل فرمایید.' :
                     (customerLedger?.balance || 0) < 0 ? 'حساب شما دارای اعتبار مازاد می‌باشد.' : 'حساب شما فاقد هرگونه بدهی است.'}
                  </span>
                </div>
              </div>

              {/* Customer Profile Card */}
              <div className="bg-slate-50/70 p-4 rounded-2xl border border-slate-200 space-y-2 text-xs">
                <h4 className="font-bold text-slate-800 border-b border-slate-200/80 pb-2 flex items-center gap-1.5">
                  <User className="w-4 h-4 text-slate-600" />
                  <span>اطلاعات پروفایل طرف‌حساب</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-600">
                  <p><strong>نام مشتری:</strong> {invoice.customerName}</p>
                  {invoice.customerPhone && <p><strong>شماره تماس:</strong> <span className="font-mono">{toPersianDigits(invoice.customerPhone)}</span></p>}
                  {invoice.customerNationalId && <p><strong>شناسه / کدملی:</strong> <span className="font-mono">{toPersianDigits(invoice.customerNationalId)}</span></p>}
                  {invoice.customerAddress && <p><strong>آدرس ثبت‌شده:</strong> {invoice.customerAddress}</p>}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Floating Bottom Quick Action for Mobile Devices */}
      <div className="no-print sm:hidden fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-md border-t border-slate-200 p-2.5 flex items-center justify-around gap-2 shadow-lg">
        {storePhone && (
          <a
            href={`tel:${cleanPhone}`}
            className="flex-1 min-h-[44px] bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm"
          >
            <Phone className="w-4 h-4" />
            <span>تماس تلفنی</span>
          </a>
        )}

        <button
          type="button"
          onClick={handleDownloadPdf}
          disabled={isExportingPdf}
          className="flex-1 min-h-[44px] bg-slate-900 hover:bg-slate-800 active:scale-98 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
        >
          <Download className="w-4 h-4 text-emerald-400" />
          <span>دانلود PDF</span>
        </button>

        <button
          type="button"
          onClick={handleShareNative}
          className="w-12 min-h-[44px] bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl flex items-center justify-center cursor-pointer"
          title="اشتراک‌گذاری"
        >
          <Share2 className="w-4 h-4" />
        </button>
      </div>

      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed bottom-16 sm:bottom-4 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-2xl text-xs font-bold shadow-xl border border-slate-800 flex items-center gap-2 animate-in fade-in slide-in-from-bottom-3 duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toastMsg}</span>
        </div>
      )}
    </div>
  );
};
