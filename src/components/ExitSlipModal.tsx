import React, { useState } from 'react';
import { Invoice, StoreSettings, AppUser, ExitSlipData } from '../types';
import { toPersianDigits } from '../utils/jalali';
import { exportElementToPdf, printElementDirectly, printElementInNewWindow, generatePdfBlob } from '../utils/pdfHelper';
import { 
  Printer, 
  X, 
  PackageCheck, 
  History, 
  Calendar, 
  User, 
  Phone, 
  MapPin, 
  FileText, 
  CheckSquare, 
  ShieldCheck,
  Clock,
  FileDown,
  Share2,
  Send,
  Copy,
  Check,
  Loader2,
  MessageCircle,
  ExternalLink,
  AlertCircle,
  Settings,
  Smartphone,
  Download,
  Truck
} from 'lucide-react';
import { ExitSlipDeliveryModal } from './ExitSlipDeliveryModal';

interface ExitSlipModalProps {
  invoice: Invoice | null;
  settings: StoreSettings;
  currentUser?: AppUser;
  slipLog: ExitSlipData;
  onRecordPrint: (currentSlipLog?: ExitSlipData) => void;
  onUpdateDelivery?: (deliveryData: any) => void;
  onUpdateSettings?: (settings: StoreSettings) => void;
  onClose: () => void;
}

export const ExitSlipModal: React.FC<ExitSlipModalProps> = ({
  invoice,
  settings,
  currentUser,
  slipLog,
  onRecordPrint,
  onUpdateDelivery,
  onUpdateSettings,
  onClose,
}) => {
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showDeliveryModal, setShowDeliveryModal] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [showSocialModal, setShowSocialModal] = useState(false);
  const [statusNotification, setStatusNotification] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  if (!invoice) return null;

  const totalUnits = invoice.items.reduce((sum, item) => sum + item.quantity, 0);

  const showNotification = (text: string) => {
    setStatusNotification(text);
    setTimeout(() => {
      setStatusNotification(null);
    }, 4500);
  };

  // 1. PRINT HANDLER
  const handlePrint = (mode: 'new-window' | 'direct' = 'new-window') => {
    // 1. Record print log in storage, explicitly preserving driver and vehicle info
    onRecordPrint(slipLog);
    
    if (mode === 'new-window') {
      const opened = printElementInNewWindow(
        'printable-exit-slip', 
        `برگ خروج انبار - فاکتور ${invoice.invoiceNumber}`
      );
      if (opened) {
        showNotification('پنجره چاپ پرینتر در حال آماده‌سازی و باز شدن است.');
      } else {
        // Fallback to direct print if popup was blocked
        printElementDirectly('printable-exit-slip');
        showNotification('دستور چاپ مستقیم ارسال شد.');
      }
    } else {
      const printed = printElementDirectly('printable-exit-slip');
      if (printed) {
        showNotification('دستور چاپ مستقیم در همین صفحه ارسال شد.');
      } else {
        printElementInNewWindow(
          'printable-exit-slip', 
          `برگ خروج انبار - فاکتور ${invoice.invoiceNumber}`
        );
      }
    }
  };

  // 2. PDF EXPORT HANDLER
  const handleExportPdf = async () => {
    try {
      setIsExportingPdf(true);
      onRecordPrint(slipLog);
      
      const filename = `برگه_خروج_انبار_فاکتور_${invoice.invoiceNumber}`;
      const result = await exportElementToPdf('printable-exit-slip', filename);
      
      if (result.success) {
        showNotification('فایل PDF برگه خروج با موفقیت تولید و دانلود شد.');
      } else {
        showNotification(result.error || 'خطا در تبدیل به PDF');
      }
    } catch (err: any) {
      console.error(err);
      showNotification('خطا در ایجاد فایل PDF برگه خروج.');
    } finally {
      setIsExportingPdf(false);
    }
  };

  // 3. GENERATE EXIT SLIP TEXT FOR SOCIAL MEDIA
  const getExitSlipShareText = () => {
    const lines = [
      `📦 *برگ خروج کالا از انبار (حواله تحویل فیزیکی)*`,
      `شماره حواله / فاکتور: ${toPersianDigits(invoice.invoiceNumber)}`,
      `تاریخ صدور: ${toPersianDigits(invoice.date)}`,
      `تحویل‌گیرنده: ${invoice.customerName}`,
      invoice.customerPhone ? `شماره تماس: ${toPersianDigits(invoice.customerPhone)}` : '',
      invoice.customerAddress ? `نشانی تحویل: ${invoice.customerAddress}` : '',
      `---------------------------------`,
      `📋 *اقلام فیزیکی تحویلی:*`,
      ...invoice.items.map(
        (it, idx) =>
          `${toPersianDigits(idx + 1)}. ${it.productName} ➔ تعداد: *${toPersianDigits(it.quantity)} ${it.unit || 'واحد'}*`
      ),
      `---------------------------------`,
      `مجموع کل واحدهای تحویلی: *${toPersianDigits(totalUnits)} واحد فیزیکی*`,
      slipLog.isDelivered 
        ? `✅ *وضعیت: بار تحویل شد (خروج قطعی)* ${slipLog.deliveredAt ? `[${toPersianDigits(slipLog.deliveredAt)}]` : ''}` 
        : `⏳ *وضعیت: در انتظار بارگیری و تحویل بار*`,
      slipLog.receiverName ? `👤 تحویل‌گیرنده / راننده: ${slipLog.receiverName}` : '',
      slipLog.receiverPhone ? `📞 تلفن راننده: ${toPersianDigits(slipLog.receiverPhone)}` : '',
      slipLog.vehicleInfo ? `🚚 مشخصات ماشین: ${slipLog.vehicleInfo}` : '',
      slipLog.deliveryNotes ? `📝 یادداشت / بارنامه: ${slipLog.deliveryNotes}` : '',
      currentUser?.fullName ? `انباردار صادرکننده: ${currentUser.fullName}` : '',
      settings.storeName ? `مرکز: ${settings.storeName}` : '',
      settings.phone ? `تلفن انبار: ${toPersianDigits(settings.phone)}` : '',
    ].filter(Boolean);
    return lines.join('\n');
  };

  // Copy share text
  const handleCopyText = async () => {
    const text = getExitSlipShareText();
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
      showNotification('متن کامل برگه خروج با موفقیت در کلیپ‌بورد کپی شد.');
    } catch {
      showNotification('خطا در کپی متن');
    }
  };

  // Direct native PDF sharing (uses Android/iOS/Desktop share sheet with actual PDF file)
  const handleSharePdfDirectly = async () => {
    setIsExportingPdf(true);
    try {
      const filename = `برگه_خروج_انبار_فاکتور_${invoice.invoiceNumber}.pdf`;
      const { success, blob, file, error } = await generatePdfBlob('printable-exit-slip', filename);
      if (!success || (!file && !blob)) {
        showNotification(error || 'خطا در تولید فایل PDF');
        return;
      }
      const shareFile = file || new File([blob!], filename, { type: 'application/pdf' });
      onRecordPrint();

      if (navigator.canShare && navigator.canShare({ files: [shareFile] })) {
        await navigator.share({
          files: [shareFile],
          title: `برگه خروج انبار - فاکتور ${toPersianDigits(invoice.invoiceNumber)}`,
          text: `فایل PDF حواله خروج کالا برای ${invoice.customerName} (فاکتور: ${toPersianDigits(invoice.invoiceNumber)})`,
        });
        showNotification('فایل PDF برگه خروج با موفقیت به اشتراک گذاشته شد.');
      } else {
        // Fallback: auto download + inform user
        const url = URL.createObjectURL(shareFile);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showNotification('فایل PDF برگه خروج دانلود شد و آماده ارسال در هر برنامه و پیام‌رسان است.');
      }
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        console.error(err);
        showNotification('خطا در اشتراک‌گذاری مستقیم فایل PDF');
      }
    } finally {
      setIsExportingPdf(false);
    }
  };

  // Text-only direct messengers sending
  const handleSendWhatsApp = () => {
    const text = encodeURIComponent(getExitSlipShareText());
    const phone = invoice.customerPhone ? invoice.customerPhone.replace(/[^0-9]/g, '') : (settings.whatsappNumber ? settings.whatsappNumber.replace(/[^0-9]/g, '') : '');
    const intlPhone = phone.startsWith('09') ? `98${phone.slice(1)}` : phone;
    const url = intlPhone ? `https://api.whatsapp.com/send?phone=${intlPhone}&text=${text}` : `https://api.whatsapp.com/send?text=${text}`;
    window.open(url, '_blank');
    showNotification('متن حواله در واتساپ ارسال شد.');
  };

  const handleSendTelegram = () => {
    const text = encodeURIComponent(getExitSlipShareText());
    const url = `https://t.me/share/url?url=${encodeURIComponent(window.location.origin)}&text=${text}`;
    window.open(url, '_blank');
    showNotification('متن حواله در تلگرام ارسال شد.');
  };

  const handleSendEitaa = () => {
    const text = encodeURIComponent(getExitSlipShareText());
    const url = `https://eitaa.com/share/url?url=${encodeURIComponent(window.location.origin)}&text=${text}`;
    window.open(url, '_blank');
    showNotification('متن حواله در ایتا ارسال شد.');
  };

  const handleSendBale = () => {
    const text = encodeURIComponent(getExitSlipShareText());
    const url = `https://ble.ir/share/compile?text=${text}`;
    window.open(url, '_blank');
    showNotification('متن حواله در بله ارسال شد.');
  };

  const handleSendRubika = () => {
    const text = getExitSlipShareText();
    navigator.clipboard.writeText(text).then(() => {
      showNotification('متن حواله کپی شد و سامانه روبیکا باز گردید.');
      window.open('https://web.rubika.ir', '_blank');
    }).catch(() => {
      window.open('https://web.rubika.ir', '_blank');
    });
  };

  const handleSendSms = () => {
    const text = encodeURIComponent(getExitSlipShareText());
    const phone = invoice.customerPhone ? invoice.customerPhone.replace(/[^0-9]/g, '') : '';
    const url = `sms:${phone}?body=${text}`;
    window.open(url, '_self');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto print:p-0 print:bg-white print:static print:overflow-visible font-['Vazirmatn']">
      {/* Container Dialog */}
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden my-auto print:max-h-none print:shadow-none print:border-none print:w-full print:rounded-none">
        
        {/* MODAL HEADER (No Print) */}
        <div className="no-print bg-slate-900 text-white px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <PackageCheck className="w-5 h-5" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-bold text-white">
                  برگ خروج کالا از انبار (حواله تحویل)
                </h3>
                <span className="text-xs font-['Vazirmatn'] text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
                  فاکتور: {toPersianDigits(invoice.invoiceNumber)}
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                حواله رسمی تحویل اقلام فیزیکی بدون مبالغ مالی
              </p>
            </div>
          </div>

          {/* Header Action Badges & Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Print Status Badge */}
            <div className="flex items-center gap-1.5 bg-slate-800 border border-slate-700 px-2.5 py-1 rounded-lg text-xs">
              <Printer className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-slate-300">دفعات چاپ:</span>
              <span className="font-bold text-emerald-400 font-['Vazirmatn']">
                {toPersianDigits(slipLog.printCount)} بار
              </span>
            </div>

            {/* History Toggle Button */}
            <button
              id="exit-slip-history-toggle-btn"
              onClick={() => setShowHistoryModal(!showHistoryModal)}
              className="flex items-center gap-1 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-300 hover:text-white px-2.5 py-1.5 rounded-lg text-xs font-medium border border-slate-700 transition-colors cursor-pointer"
              title="مشاهده تاریخچه دفعات چاپ"
            >
              <History className="w-3.5 h-3.5 text-blue-400" />
              <span className="hidden sm:inline">تاریخچه چاپ</span>
            </button>

            {/* Delivery & Vehicle Specs Button */}
            <button
              id="exit-slip-header-delivery-btn"
              onClick={() => setShowDeliveryModal(true)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer ${
                slipLog.isDelivered 
                  ? 'bg-emerald-700 hover:bg-emerald-600 text-white border border-emerald-500/50' 
                  : 'bg-amber-600 hover:bg-amber-500 text-white'
              }`}
              title="ثبت یا ویرایش نام راننده، مشخصات ماشین و تایید تحویل بار"
            >
              <Truck className="w-3.5 h-3.5" />
              <span>{slipLog.isDelivered ? 'بار تحویل شد (مشخصات)' : 'ثبت تحویل بار و خودرو'}</span>
            </button>

            {/* Social Media Share Button */}
            <button
              id="exit-slip-header-social-btn"
              onClick={() => setShowSocialModal(true)}
              className="flex items-center gap-1.5 bg-sky-600 hover:bg-sky-500 active:scale-95 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer"
              title="ارسال به شبکه‌های اجتماعی و پیام‌رسان‌ها"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>ارسال به شبکه اجتماعی</span>
            </button>

            {/* PDF Export Button */}
            <button
              id="exit-slip-header-pdf-btn"
              onClick={handleExportPdf}
              disabled={isExportingPdf}
              className="flex items-center gap-1.5 bg-rose-600 hover:bg-rose-500 active:scale-95 disabled:opacity-60 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer"
              title="تبدیل و دانلود فایل PDF برگه خروج در کمترین حجم ممکن (فشرده، زیر ۱۵۰ کیلوبایت)"
            >
              {isExportingPdf ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>در حال تولید PDF...</span>
                </>
              ) : (
                <>
                  <FileDown className="w-3.5 h-3.5" />
                  <span>تبدیل به PDF (کم‌حجم)</span>
                </>
              )}
            </button>

            {/* Main Print Button (New Window Popup with Auto-Print) */}
            <button
              id="exit-slip-print-action-btn"
              onClick={() => handlePrint('new-window')}
              className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer"
              title="باز کردن پنجره پرینتر و چاپ برگه خروج (تضمینی بدون محدودیت فریم مرورگر)"
            >
              <Printer className="w-4 h-4" />
              <span>چاپ برگه خروج</span>
            </button>

            {/* Direct In-Page Print Button */}
            <button
              id="exit-slip-print-direct-btn"
              onClick={() => handlePrint('direct')}
              className="hidden lg:flex items-center gap-1 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-300 hover:text-white px-2.5 py-1.5 rounded-lg text-xs font-medium border border-slate-700 transition-colors cursor-pointer"
              title="چاپ مستقیم در همین صفحه بدون پنجره مجزا"
            >
              <Printer className="w-3.5 h-3.5 text-emerald-400" />
              <span>چاپ در صفحه</span>
            </button>

            {/* Close Button */}
            <button
              id="exit-slip-close-modal-btn"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* STATUS NOTIFICATION BANNER */}
        {statusNotification && (
          <div className="no-print bg-blue-50 border-b border-blue-200 text-blue-900 px-4 py-2.5 text-xs flex items-center justify-between animate-fadeIn">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-blue-600 shrink-0" />
              <span>{statusNotification}</span>
            </div>
            <button
              onClick={() => setStatusNotification(null)}
              className="text-blue-500 hover:text-blue-800 p-0.5 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* PRINT HISTORY PANEL (If toggled - No Print) */}
        {showHistoryModal && (
          <div className="no-print bg-amber-50/70 border-b border-amber-200 p-4 shrink-0 transition-all">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-xs font-bold text-amber-900">
                <Clock className="w-4 h-4 text-amber-700" />
                <span>سوابق و دفعات چاپ این برگ خروج:</span>
              </div>
              <button
                onClick={() => setShowHistoryModal(false)}
                className="text-[11px] text-amber-700 hover:underline cursor-pointer"
              >
                بستن تاریخچه
              </button>
            </div>

            {(!slipLog.history || slipLog.history.length === 0) ? (
              <p className="text-xs text-amber-700/80">
                تاکنون هیچ پرینتی از این برگه خروج ثبت نشده است (نسخه اولیه).
              </p>
            ) : (
              <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
                {slipLog.history.map((h, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between text-xs bg-white px-3 py-1.5 rounded-lg border border-amber-200 shadow-2xs"
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-900 text-[10px] font-bold flex items-center justify-center font-['Vazirmatn']">
                        {toPersianDigits(slipLog.history.length - idx)}
                      </span>
                      <span className="font-semibold text-slate-800">
                        چاپ نوبت {toPersianDigits(slipLog.history.length - idx)}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-slate-600 font-['Vazirmatn'] text-[11px]">
                      <span>{toPersianDigits(h.printedAt)}</span>
                      <span className="text-slate-400 font-sans">توسط: {h.printedBy || 'انباردار'}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* PRINTABLE SLIP CONTENT VIEW (Scrollable on screen, Full page on Print) */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-slate-100/60 print:p-0 print:bg-white">
          <div 
            id="printable-exit-slip"
            className="print-container bg-white border border-slate-300 rounded-xl p-6 sm:p-8 max-w-3xl mx-auto text-slate-900 shadow-sm print:border-none print:shadow-none print:p-0"
          >
            
            {/* Header: Store details & Exit Voucher Title */}
            <div className="border-b-2 border-slate-800 pb-4 mb-5">
              <div className="flex items-start justify-between gap-4">
                {/* Store Branding */}
                <div className="space-y-1">
                  <h1 className="text-lg sm:text-xl font-black text-slate-900">
                    {settings.storeName || 'فروشگاه و انبار مرکزی'}
                  </h1>
                  {settings.tagline && (
                    <p className="text-xs text-slate-500 font-medium">{settings.tagline}</p>
                  )}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600 pt-1">
                    {settings.phone && (
                      <span className="flex items-center gap-1">
                        <Phone className="w-3.5 h-3.5 text-slate-400" />
                        <span>تلفن: {toPersianDigits(settings.phone)}</span>
                      </span>
                    )}
                    {settings.address && (
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                        <span>{settings.address}</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Slip Badge Title */}
                <div className="text-left shrink-0">
                  <div className="inline-block border-2 border-slate-900 bg-slate-900 text-white px-4 py-1.5 rounded-lg text-sm sm:text-base font-extrabold shadow-xs">
                    برگ خروج کالا از انبار
                  </div>
                  <div className="text-[11px] text-slate-500 font-bold mt-1 text-center">
                    حواله تحویل قطعی اجناس
                  </div>
                </div>
              </div>
            </div>

            {/* Voucher Metadata Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200 mb-5 text-xs">
              <div className="space-y-1">
                <span className="text-slate-400 block text-[11px]">شماره حواله / فاکتور:</span>
                <span className="font-['Vazirmatn'] font-black text-slate-900 text-sm">
                  {toPersianDigits(invoice.invoiceNumber)}
                </span>
              </div>

              <div className="space-y-1">
                <span className="text-slate-400 block text-[11px]">تاریخ صدور فاکتور:</span>
                <span className="font-['Vazirmatn'] font-bold text-slate-800">
                  {toPersianDigits(invoice.date)}
                </span>
              </div>

              <div className="space-y-1">
                <span className="text-slate-400 block text-[11px]">انبار مبدأ:</span>
                <span className="font-bold text-slate-800">
                  انبار مرکزی سپهر
                </span>
              </div>

              <div className="space-y-1">
                <span className="text-slate-400 block text-[11px]">دفعات چاپ برگه:</span>
                <span className="font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded text-[11px] inline-block font-['Vazirmatn']">
                  {slipLog.printCount > 0 ? `چاپ نوبت ${toPersianDigits(slipLog.printCount + 1)}` : 'نسخه اول (اصل)'}
                </span>
              </div>
            </div>

            {/* Recipient / Customer Information */}
            <div className="border border-slate-200 rounded-xl p-3.5 mb-5 bg-white text-xs">
              <div className="text-slate-500 font-bold mb-2 pb-1 border-b border-slate-100 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-slate-400" />
                <span>مشخصات تحویل‌گیرنده / خریدار:</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <span className="text-slate-400">نام شخص یا شرکت: </span>
                  <span className="font-bold text-slate-900">{invoice.customerName}</span>
                </div>
                <div>
                  <span className="text-slate-400">شماره تماس: </span>
                  <span className="font-['Vazirmatn'] font-semibold text-slate-800">
                    {invoice.customerPhone ? toPersianDigits(invoice.customerPhone) : '—'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400">کد / شناسه ملی: </span>
                  <span className="font-['Vazirmatn'] text-slate-800">
                    {invoice.customerNationalId ? toPersianDigits(invoice.customerNationalId) : '—'}
                  </span>
                </div>
                {invoice.customerAddress && (
                  <div className="sm:col-span-3">
                    <span className="text-slate-400">نشانی تحویل: </span>
                    <span className="text-slate-700">{invoice.customerAddress}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Delivery, Vehicle & Driver Information Box */}
            <div className="border border-slate-300 rounded-xl p-3.5 mb-5 bg-slate-50/80 text-xs">
              <div className="flex items-center justify-between pb-1.5 mb-2 border-b border-slate-200">
                <div className="text-slate-800 font-bold flex items-center gap-1.5">
                  <Truck className="w-4 h-4 text-blue-600" />
                  <span>مشخصات بارگیری، وسیله نقلیه و تحویل کالا:</span>
                </div>
                <div>
                  {slipLog.isDelivered ? (
                    <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full text-[11px] font-bold border border-emerald-300">
                      <Check className="w-3 h-3 text-emerald-600" />
                      <span>بار تحویل شد (خروج قطعی)</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-800 px-2.5 py-0.5 rounded-full text-[11px] font-bold border border-amber-300">
                      <Clock className="w-3 h-3 text-amber-600" />
                      <span>در انتظار بارگیری و تحویل</span>
                    </span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <span className="text-slate-500">تحویل‌گیرنده / راننده: </span>
                  <span className="font-bold text-slate-900 font-['Vazirmatn']">
                    {slipLog.receiverName || invoice.customerName || '—'}
                  </span>
                </div>

                <div>
                  <span className="text-slate-500">تلفن راننده / تحویل‌گیرنده: </span>
                  <span className="font-['Vazirmatn'] font-semibold text-slate-800">
                    {slipLog.receiverPhone ? toPersianDigits(slipLog.receiverPhone) : (invoice.customerPhone ? toPersianDigits(invoice.customerPhone) : '—')}
                  </span>
                </div>

                <div>
                  <span className="text-slate-500">مشخصات ماشین و پلاک: </span>
                  <span className="font-bold text-slate-900 font-['Vazirmatn']">
                    {slipLog.vehicleInfo || '—'}
                  </span>
                </div>

                {slipLog.deliveredAt && (
                  <div>
                    <span className="text-slate-500">زمان تایید تحویل: </span>
                    <span className="font-['Vazirmatn'] text-slate-700">
                      {toPersianDigits(slipLog.deliveredAt)}
                    </span>
                  </div>
                )}

                {slipLog.deliveredBy && (
                  <div>
                    <span className="text-slate-500">انباردار تاییدکننده: </span>
                    <span className="font-medium text-slate-800">
                      {slipLog.deliveredBy}
                    </span>
                  </div>
                )}

                {slipLog.deliveryNotes && (
                  <div className="sm:col-span-3">
                    <span className="text-slate-500">شماره بارنامه / یادداشت خروج: </span>
                    <span className="text-slate-800 font-medium">{slipLog.deliveryNotes}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Items Physical Inventory Table (NO FINANCIAL / PRICE DATA) */}
            <div className="mb-5 overflow-hidden border border-slate-300 rounded-xl">
              <div className="bg-slate-100 px-4 py-2 text-xs font-bold text-slate-800 border-b border-slate-300 flex items-center justify-between">
                <span>لیست اقلام تحویلی از انبار (کنترل فیزیکی)</span>
                <span className="text-[11px] text-slate-500 font-normal">
                  (فاقد هرگونه قیمت و گردش مالی)
                </span>
              </div>
              <table className="w-full text-right border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-700 border-b border-slate-300 font-bold">
                    <th className="p-2.5 text-center w-12 border-l border-slate-200">ردیف</th>
                    <th className="p-2.5 w-24 border-l border-slate-200">کد کالا</th>
                    <th className="p-2.5 border-l border-slate-200">شرح کالا و مشخصات فنی</th>
                    <th className="p-2.5 text-center w-20 border-l border-slate-200">واحد</th>
                    <th className="p-2.5 text-center w-24 border-l border-slate-200 bg-slate-100 font-black">
                      تعداد حواله
                    </th>
                    <th className="p-2.5 text-center w-24 border-l border-slate-200">تعداد تحویلی</th>
                    <th className="p-2.5 text-center w-20">کنترل سلامت</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {invoice.items.map((item, index) => (
                    <tr
                      key={item.id || index}
                      className={`${
                        index % 2 === 1 ? 'bg-slate-50/85' : 'bg-white'
                      } hover:bg-slate-100/70 transition-colors`}
                    >
                      <td className="p-2.5 text-center font-['Vazirmatn'] border-l border-slate-200 text-slate-500">
                        {toPersianDigits(index + 1)}
                      </td>
                      <td className="p-2.5 font-['Vazirmatn'] text-slate-600 border-l border-slate-200 text-[11px]">
                        {toPersianDigits(item.productId.replace('prod-', ''))}
                      </td>
                      <td className="p-2.5 font-bold text-slate-900 border-l border-slate-200">
                        {item.productName}
                      </td>
                      <td className="p-2.5 text-center text-slate-600 border-l border-slate-200">
                        {item.unit || 'عدد'}
                      </td>
                      <td className="p-2.5 text-center font-['Vazirmatn'] font-black text-slate-900 text-sm bg-slate-50/80 border-l border-slate-200">
                        {toPersianDigits(item.quantity)}
                      </td>
                      <td className="p-2.5 text-center border-l border-slate-200">
                        <span className="font-['Vazirmatn'] font-bold text-slate-800">
                          {toPersianDigits(item.quantity)}
                        </span>
                      </td>
                      <td className="p-2.5 text-center">
                        <div className="w-4 h-4 border border-slate-400 rounded-sm mx-auto flex items-center justify-center text-[10px] text-slate-400">
                          ✓
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-100 font-bold border-t-2 border-slate-300 text-slate-900">
                    <td colSpan={4} className="p-2.5 text-left border-l border-slate-300">
                      مجموع اقلام تحویل شده:
                    </td>
                    <td className="p-2.5 text-center font-['Vazirmatn'] font-black text-base text-emerald-800 bg-emerald-50 border-l border-slate-300">
                      {toPersianDigits(totalUnits)}
                    </td>
                    <td colSpan={2} className="p-2.5 text-slate-500 text-[11px]">
                      (تعداد {toPersianDigits(invoice.items.length)} ردیف کالای فیزیکی)
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Delivery Terms & Notes */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 mb-6 text-xs text-slate-600 space-y-1">
              <div className="font-bold text-slate-800 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>شروط و ضوابط خروج از انبار:</span>
              </div>
              <p className="text-[11px] leading-relaxed">
                ۱. کلیه اقلام فوق از لحاظ تعداد فیزیکی، بسته‌بندی و سلامت ظاهری به رویت و تایید تحویل‌گیرنده رسیده و تحویل گردید.
              </p>
              <p className="text-[11px] leading-relaxed">
                ۲. خروج هرگونه کالا از درب انبار منوط به اخذ امضای کامل متصدی انبار و برگه تایید نگهبانی می‌باشد.
              </p>
              {invoice.notes && (
                <div className="pt-1 border-t border-slate-200 text-slate-700">
                  <span className="font-bold">یادداشت حواله: </span>
                  <span>{invoice.notes}</span>
                </div>
              )}
            </div>

            {/* Print Log Footer on Paper */}
            <div className="flex items-center justify-between text-[11px] text-slate-400 pb-4 mb-4 border-b border-dashed border-slate-200">
              <div className="flex items-center gap-2">
                <span>رهگیری برگه:</span>
                <span className="font-['Vazirmatn'] font-bold text-slate-600">
                  نوبت چاپ {toPersianDigits(slipLog.printCount + 1)}
                </span>
              </div>

              <div className="flex items-center gap-3 font-['Vazirmatn']">
                {slipLog.lastPrintedAt && (
                  <span>آخرین چاپ: {toPersianDigits(slipLog.lastPrintedAt)}</span>
                )}
                <span>صادرکننده: {currentUser?.fullName || 'انباردار'}</span>
              </div>
            </div>

            {/* Official Signatures Grid */}
            <div className="grid grid-cols-3 gap-4 pt-3 border-t border-slate-300 text-center text-xs">
              <div className="space-y-12">
                <span className="font-bold text-slate-700 block">امضا و مهر انباردار</span>
                <span className="text-[10px] text-slate-400 block">نام مسئول انبار / تاریخ</span>
              </div>

              <div className="space-y-12 border-x border-slate-200">
                <span className="font-bold text-slate-700 block">امضا و اثر انگشت تحویل‌گیرنده</span>
                <span className="text-[10px] text-slate-400 block">نام راننده یا مشتری / تاریخ</span>
              </div>

              <div className="space-y-12">
                <span className="font-bold text-slate-700 block">کنترل نهایی گیت خروج</span>
                <span className="text-[10px] text-slate-400 block">امضا و تایید نگهبانی</span>
              </div>
            </div>

          </div>
        </div>

        {/* MODAL FOOTER (No Print) */}
        <div className="no-print bg-slate-50 border-t border-slate-200 px-4 sm:px-6 py-3 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-500 flex items-center gap-1.5 text-center sm:text-right">
            <CheckSquare className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>با فشردن دکمه پرینت یا تبدیل به PDF، زمان دقیق و دفعات چاپ به صورت رسمی در انبار ثبت می‌شود.</span>
          </div>

          <div className="flex flex-wrap items-center justify-center sm:justify-end gap-2 w-full sm:w-auto">
            {/* Social Share Button in Footer */}
            <button
              id="exit-slip-footer-social-btn"
              type="button"
              onClick={() => setShowSocialModal(true)}
              className="flex items-center gap-1.5 bg-sky-600 hover:bg-sky-700 active:scale-95 text-white px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
              title="ارسال به شبکه‌های اجتماعی"
            >
              <Share2 className="w-4 h-4" />
              <span>ارسال به شبکه اجتماعی</span>
            </button>

            {/* PDF Export Button in Footer */}
            <button
              id="exit-slip-footer-pdf-btn"
              type="button"
              onClick={handleExportPdf}
              disabled={isExportingPdf}
              className="flex items-center gap-1.5 bg-rose-600 hover:bg-rose-700 active:scale-95 disabled:opacity-60 text-white px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
              title="تبدیل به PDF با حجم بسیار کم (زیر ۱۵۰ کیلوبایت)"
            >
              {isExportingPdf ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>در حال تبدیل به PDF...</span>
                </>
              ) : (
                <>
                  <FileDown className="w-4 h-4" />
                  <span>تبدیل به PDF (کم‌حجم)</span>
                </>
              )}
            </button>

            {/* Close Button */}
            <button
              id="exit-slip-footer-close-btn"
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 text-xs text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer font-medium"
            >
              بستن
            </button>

            {/* Main Print Button in Footer (Guaranteed Printer Dialog) */}
            <button
              id="exit-slip-footer-print-btn"
              type="button"
              onClick={() => handlePrint('new-window')}
              className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white px-4 py-2 rounded-xl text-xs font-bold transition-colors shadow-xs cursor-pointer"
              title="باز کردن پنجره پرینتر جهت چاپ مستقیم برگه خروج"
            >
              <Printer className="w-4 h-4" />
              <span>چاپ برگه خروج</span>
            </button>
          </div>
        </div>

      </div>

      {/* MODAL: SOCIAL MEDIA SHARE & MANAGER ADDRESS CONFIGURATION */}
      {showSocialModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-fadeIn">
            
            {/* Social Modal Header */}
            <div className="bg-slate-900 text-white px-5 py-3.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Share2 className="w-4 h-4 text-sky-400" />
                <h3 className="font-bold text-sm">ارسال برگه خروج به شبکه‌های اجتماعی</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowSocialModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
              {/* PRIMARY: DIRECT PDF SHARE & DOWNLOAD (REMAINS EXACTLY AS PDF) */}
              <div className="bg-sky-50 border border-sky-200 rounded-xl p-3.5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileDown className="w-4 h-4 text-sky-700 shrink-0" />
                    <span className="text-xs font-bold text-sky-950">
                      ارسال برگه خروج به صورت فایل PDF
                    </span>
                  </div>
                  <span className="text-[10px] bg-sky-100 text-sky-800 font-bold px-2 py-0.5 rounded">
                    سند رسمی انبارداری
                  </span>
                </div>
                <p className="text-[11px] text-sky-800 leading-relaxed">
                  فایل PDF کم‌حجم تولید شده و از طریق منوی اشتراک‌گذاری سیستم یا پیام‌رسان‌ها به عنوان سند رسمی ارسال می‌گردد:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    id="exit-slip-share-pdf-direct-btn"
                    onClick={handleSharePdfDirectly}
                    disabled={isExportingPdf}
                    className="flex items-center justify-center gap-2 bg-sky-600 hover:bg-sky-700 active:scale-98 disabled:opacity-60 text-white py-2.5 px-3 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
                  >
                    {isExportingPdf ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>در حال آماده‌سازی PDF...</span>
                      </>
                    ) : (
                      <>
                        <Share2 className="w-4 h-4" />
                        <span>📲 اشتراک‌گذاری فایل PDF</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    id="exit-slip-modal-download-pdf-btn"
                    onClick={handleExportPdf}
                    disabled={isExportingPdf}
                    className="flex items-center justify-center gap-2 bg-white hover:bg-slate-100 active:scale-98 disabled:opacity-60 text-slate-700 border border-slate-300 py-2.5 px-3 rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer"
                  >
                    <Download className="w-4 h-4 text-slate-500" />
                    <span>دانلود مستقیم فایل PDF</span>
                  </button>
                </div>
              </div>

              {/* QUICK MESSENGERS LIST (TEXT ONLY) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700">
                    ارسال اختصاصی به پیام‌رسان‌ها (بصورت متنی):
                  </span>
                  <span className="text-[10px] text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full font-medium border border-indigo-200">
                    متن آماده و سریع
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {/* WhatsApp */}
                  <button
                    type="button"
                    onClick={handleSendWhatsApp}
                    className="flex items-center justify-center gap-1.5 bg-[#25D366] hover:bg-[#1EBE5D] text-white py-2.5 px-2.5 rounded-xl text-xs font-bold cursor-pointer transition-all active:scale-95 shadow-2xs"
                  >
                    <MessageCircle className="w-4 h-4" />
                    <span>واتساپ (متنی)</span>
                  </button>

                  {/* Telegram */}
                  <button
                    type="button"
                    onClick={handleSendTelegram}
                    className="flex items-center justify-center gap-1.5 bg-[#229ED9] hover:bg-[#1C8AC2] text-white py-2.5 px-2.5 rounded-xl text-xs font-bold cursor-pointer transition-all active:scale-95 shadow-2xs"
                  >
                    <Send className="w-4 h-4" />
                    <span>تلگرام (متنی)</span>
                  </button>

                  {/* Eitaa */}
                  <button
                    type="button"
                    onClick={handleSendEitaa}
                    className="flex items-center justify-center gap-1.5 bg-amber-600 hover:bg-amber-700 text-white py-2.5 px-2.5 rounded-xl text-xs font-bold cursor-pointer transition-all active:scale-95 shadow-2xs"
                  >
                    <ExternalLink className="w-4 h-4" />
                    <span>ایتا (متنی)</span>
                  </button>

                  {/* Bale */}
                  <button
                    type="button"
                    onClick={handleSendBale}
                    className="flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 px-2.5 rounded-xl text-xs font-bold cursor-pointer transition-all active:scale-95 shadow-2xs"
                  >
                    <MessageCircle className="w-4 h-4" />
                    <span>بله (متنی)</span>
                  </button>

                  {/* Rubika */}
                  <button
                    type="button"
                    onClick={handleSendRubika}
                    className="flex items-center justify-center gap-1.5 bg-purple-600 hover:bg-purple-700 text-white py-2.5 px-2.5 rounded-xl text-xs font-bold cursor-pointer transition-all active:scale-95 shadow-2xs"
                  >
                    <ExternalLink className="w-4 h-4" />
                    <span>روبیکا (متنی)</span>
                  </button>

                  {/* SMS */}
                  <button
                    type="button"
                    onClick={handleSendSms}
                    className="flex items-center justify-center gap-1.5 bg-slate-700 hover:bg-slate-800 text-white py-2.5 px-2.5 rounded-xl text-xs font-bold cursor-pointer transition-all active:scale-95 shadow-2xs"
                  >
                    <Smartphone className="w-4 h-4" />
                    <span>پیامک (SMS)</span>
                  </button>
                </div>
              </div>

              {/* SECTION 3: COPY COMPLETE TEXT */}
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                <span className="text-xs text-slate-500">کپی متن خلاصه حواله در حافظه:</span>
                <button
                  type="button"
                  onClick={handleCopyText}
                  className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'کپی شد!' : 'کپی متن حواله'}</span>
                </button>
              </div>

            </div>

            {/* Modal Footer */}
            <div className="bg-slate-50 border-t border-slate-200 px-5 py-3 flex justify-end">
              <button
                type="button"
                onClick={() => setShowSocialModal(false)}
                className="px-4 py-1.5 text-xs text-slate-600 hover:bg-slate-200 rounded-xl cursor-pointer"
              >
                بستن پنجره
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Exit Slip Delivery Modal (for quick confirmation from inside print view) */}
      {showDeliveryModal && (
        <ExitSlipDeliveryModal
          isOpen={showDeliveryModal}
          invoice={invoice}
          slipLog={slipLog}
          currentUser={currentUser}
          onClose={() => setShowDeliveryModal(false)}
          onSave={(deliveryData) => {
            if (onUpdateDelivery) {
              onUpdateDelivery(deliveryData);
            }
            showNotification(
              deliveryData.isDelivered 
                ? 'وضعیت تحویل بار و مشخصات وسیله نقلیه با موفقیت ثبت شد.' 
                : 'مشخصات راننده و خودرو ذخیره شد.'
            );
          }}
        />
      )}

    </div>
  );
};
