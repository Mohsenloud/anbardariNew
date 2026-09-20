import React, { useState, useEffect } from 'react';
import { Invoice, StoreSettings, AppUser, ExitSlipData } from '../types';
import { toPersianDigits, getCurrentJalaliTime, toEnglishDigits } from '../utils/jalali';
import { exportElementToPdf, printElementDirectly, printElementInNewWindow, generatePdfBlob } from '../utils/pdfHelper';
import { StorageService } from '../utils/storage';
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
  Truck,
  Warehouse,
  Building2
} from 'lucide-react';
import { ExitSlipDeliveryModal } from './ExitSlipDeliveryModal';
import { parseVehicleInfo } from './IranPlatePicker';

// Mini graphic Iranian license plate for clean display in delivery slip
const MiniIranPlate: React.FC<{ plateInfo: string }> = ({ plateInfo }) => {
  const parsed = parseVehicleInfo(plateInfo);
  if (!parsed || parsed.isFreeText || !parsed.part1 || !parsed.letter || !parsed.part2 || !parsed.iranCode) {
    return (
      <span className="font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-300 font-['Vazirmatn'] text-[11px]">
        {plateInfo}
      </span>
    );
  }

  const isYellow = parsed.letter === 'ع' || parsed.letter === 'ت';

  return (
    <div className="inline-flex items-center gap-1.5 flex-wrap">
      {parsed.vehicleType && (
        <span className="text-[11px] font-bold text-slate-800">
          {parsed.vehicleType}
          {parsed.colorDesc ? ` (${parsed.colorDesc})` : ''}:
        </span>
      )}
      <div 
        dir="ltr"
        className={`inline-flex items-stretch border border-slate-900 rounded-sm overflow-hidden text-slate-950 font-black shadow-2xs select-none ${
          isYellow ? 'bg-amber-300' : 'bg-white'
        }`}
        style={{ height: '22px' }}
      >
        {/* Blue band */}
        <div className="bg-[#003399] text-white w-3.5 flex flex-col items-center justify-between py-0.5 px-0.5 shrink-0">
          <div className="w-2 h-1 flex flex-col justify-between">
            <span className="h-[0.5px] bg-[#239f40] w-full block"></span>
            <span className="h-[0.5px] bg-white w-full block"></span>
            <span className="h-[0.5px] bg-[#da0000] w-full block"></span>
          </div>
          <span className="text-[5px] font-sans font-bold leading-none">IR</span>
        </div>

        {/* 2 digits */}
        <div className="px-1 flex items-center justify-center font-['Vazirmatn'] text-[11px] font-black min-w-[16px]">
          {toPersianDigits(parsed.part1)}
        </div>

        {/* Letter */}
        <div className="px-1 flex items-center justify-center font-['Vazirmatn'] text-[10px] font-black min-w-[14px]">
          {parsed.letter}
        </div>

        {/* 3 digits */}
        <div className="px-1 flex items-center justify-center font-['Vazirmatn'] text-[11px] font-black min-w-[22px]">
          {toPersianDigits(parsed.part2)}
        </div>

        {/* Iran code */}
        <div className="border-r border-slate-900 bg-slate-50/70 px-1 flex flex-col items-center justify-center leading-none">
          <span className="text-[5px] text-slate-600 font-bold">ایران</span>
          <span className="font-['Vazirmatn'] text-[10px] font-black text-slate-950">
            {toPersianDigits(parsed.iranCode)}
          </span>
        </div>
      </div>
    </div>
  );
};

// Helper to extract or fallback issuance time
export const getInvoiceIssueTime = (inv: Invoice): string => {
  const anyInv = inv as any;
  if (anyInv.time && typeof anyInv.time === 'string' && anyInv.time.includes(':')) {
    return anyInv.time;
  }
  if (anyInv.invoiceTime && typeof anyInv.invoiceTime === 'string' && anyInv.invoiceTime.includes(':')) {
    return anyInv.invoiceTime;
  }
  if (inv.createdAt) {
    try {
      const d = new Date(inv.createdAt);
      if (!isNaN(d.getTime())) {
        const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
        return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
      }
    } catch {}

    const english = toEnglishDigits(inv.createdAt);
    const match = english.match(/(\d{1,2}):(\d{2})/);
    if (match) {
      const pad = (s: string) => (s.length === 1 ? `0${s}` : s);
      return `${pad(match[1])}:${match[2]}`;
    }
  }
  return getCurrentJalaliTime();
};

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
  const [showWarehouseConfigModal, setShowWarehouseConfigModal] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [showSocialModal, setShowSocialModal] = useState(false);
  const [statusNotification, setStatusNotification] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Paper format & orientation settings (persisted across sessions)
  const [pageSize, setPageSize] = useState<'a4' | 'a5'>(() => {
    try {
      return (localStorage.getItem('exit_slip_paper_size') as 'a4' | 'a5') || 'a4';
    } catch {
      return 'a4';
    }
  });
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>(() => {
    try {
      return (localStorage.getItem('exit_slip_orientation') as 'portrait' | 'landscape') || 'portrait';
    } catch {
      return 'portrait';
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('exit_slip_paper_size', pageSize);
    } catch {}
  }, [pageSize]);

  useEffect(() => {
    try {
      localStorage.setItem('exit_slip_orientation', orientation);
    } catch {}
  }, [orientation]);

  // Proportional layout helpers
  const isA5 = pageSize === 'a5';
  const isLandscape = orientation === 'landscape';
  const isA5Landscape = isA5 && isLandscape;
  const isA5Portrait = isA5 && !isLandscape;
  const isA4Landscape = !isA5 && isLandscape;
  const isA4Portrait = !isA5 && !isLandscape;

  // Derive issuance time from invoice or fallback to current time
  const issuedTime = React.useMemo(() => {
    return invoice ? getInvoiceIssueTime(invoice) : getCurrentJalaliTime();
  }, [invoice?.id, invoice?.createdAt]);

  const originWarehouseName = settings.originWarehouseName || 
    settings.warehouses?.find(w => w.id === settings.defaultWarehouseId)?.name || 
    'انبار مرکزی سپهر';

  const [originWarehouseFormData, setOriginWarehouseFormData] = useState({
    originWarehouseName: settings.originWarehouseName || 'انبار مرکزی سپهر',
    originWarehouseCode: settings.originWarehouseCode || 'WH-01',
    originWarehouseAddress: settings.originWarehouseAddress || '',
    originWarehousePhone: settings.originWarehousePhone || '',
    originWarehouseManager: settings.originWarehouseManager || '',
  });

  useEffect(() => {
    setOriginWarehouseFormData({
      originWarehouseName: settings.originWarehouseName || 'انبار مرکزی سپهر',
      originWarehouseCode: settings.originWarehouseCode || 'WH-01',
      originWarehouseAddress: settings.originWarehouseAddress || '',
      originWarehousePhone: settings.originWarehousePhone || '',
      originWarehouseManager: settings.originWarehouseManager || '',
    });
  }, [settings]);

  const handleSaveOriginWarehouse = (e: React.FormEvent) => {
    e.preventDefault();
    const updatedSettings: StoreSettings = {
      ...settings,
      originWarehouseName: originWarehouseFormData.originWarehouseName.trim() || 'انبار مرکزی سپهر',
      originWarehouseCode: originWarehouseFormData.originWarehouseCode.trim(),
      originWarehouseAddress: originWarehouseFormData.originWarehouseAddress.trim(),
      originWarehousePhone: originWarehouseFormData.originWarehousePhone.trim(),
      originWarehouseManager: originWarehouseFormData.originWarehouseManager.trim(),
    };
    if (onUpdateSettings) {
      onUpdateSettings(updatedSettings);
    } else {
      StorageService.saveSettings(updatedSettings);
    }
    setShowWarehouseConfigModal(false);
    showNotification('نام و مشخصات انبار مبدأ با موفقیت ذخیره شد.');
  };

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
    
    const printOptions = { pageSize, orientation };

    if (mode === 'new-window') {
      const opened = printElementInNewWindow(
        'printable-exit-slip', 
        `برگ خروج انبار (${pageSize.toUpperCase()} ${orientation === 'portrait' ? 'عمودی' : 'افقی'}) - فاکتور ${invoice.invoiceNumber}`,
        printOptions
      );
      if (opened) {
        showNotification(`پنجره چاپ پرینتر در اندازه ${pageSize.toUpperCase()} ${orientation === 'portrait' ? 'عمودی' : 'افقی'} آماده‌سازی شد.`);
      } else {
        // Fallback to direct print if popup was blocked
        printElementDirectly('printable-exit-slip', printOptions);
        showNotification('دستور چاپ مستقیم ارسال شد.');
      }
    } else {
      const printed = printElementDirectly('printable-exit-slip', printOptions);
      if (printed) {
        showNotification('دستور چاپ مستقیم در همین صفحه ارسال شد.');
      } else {
        printElementInNewWindow(
          'printable-exit-slip', 
          `برگ خروج انبار - فاکتور ${invoice.invoiceNumber}`,
          printOptions
        );
      }
    }
  };

  // 2. PDF EXPORT HANDLER
  const handleExportPdf = async () => {
    try {
      setIsExportingPdf(true);
      onRecordPrint(slipLog);
      
      const filename = `برگه_خروج_انبار_فاکتور_${invoice.invoiceNumber}_${pageSize}_${orientation}`;
      const result = await exportElementToPdf('printable-exit-slip', filename, { pageSize, orientation });
      
      if (result.success) {
        showNotification(`فایل PDF برگه خروج در اندازه ${pageSize.toUpperCase()} ${orientation === 'portrait' ? 'عمودی' : 'افقی'} با موفقیت تولید و دانلود شد.`);
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
      `تاریخ و ساعت صدور: ${toPersianDigits(invoice.date)} - ساعت ${toPersianDigits(issuedTime)}`,
      `قالب سند: ${pageSize.toUpperCase()} (${orientation === 'portrait' ? 'عمودی' : 'افقی'})`,
      `🏭 انبار مبدأ بارگیری: ${originWarehouseName}${settings.originWarehouseCode ? ` (کد: ${toPersianDigits(settings.originWarehouseCode)})` : ''}`,
      settings.originWarehouseAddress ? `📍 نشانی انبار مبدأ: ${settings.originWarehouseAddress}` : '',
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
      settings.originWarehouseManager ? `مسئول انبار مبدأ: ${settings.originWarehouseManager}` : '',
      settings.originWarehousePhone ? `تلفن انبار: ${toPersianDigits(settings.originWarehousePhone)}` : (settings.phone ? `تلفن انبار: ${toPersianDigits(settings.phone)}` : ''),
      settings.storeName ? `مرکز فروشگاه: ${settings.storeName}` : '',
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
      const filename = `برگه_خروج_انبار_فاکتور_${invoice.invoiceNumber}_${pageSize}_${orientation}.pdf`;
      const { success, blob, file, error } = await generatePdfBlob('printable-exit-slip', filename, { pageSize, orientation });
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
        <div className="no-print bg-slate-900 text-white px-3.5 sm:px-6 py-3 border-b border-slate-800 shrink-0">
          {/* Top Line: Title & Core Badges + Actions & Close Button */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="p-1.5 sm:p-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shrink-0">
                <PackageCheck className="w-4 h-4 sm:w-5 sm:h-5" />
              </span>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                  <h3 className="text-xs sm:text-base font-bold text-white truncate">
                    برگ خروج کالا از انبار (حواله تحویل)
                  </h3>
                  <span className="text-[10px] sm:text-xs font-['Vazirmatn'] text-emerald-300 bg-emerald-950/80 border border-emerald-600/40 px-2 py-0.5 rounded font-bold">
                    فاکتور: {toPersianDigits(invoice.invoiceNumber)}
                  </span>
                  <span className="hidden md:inline-flex items-center gap-1 text-[11px] font-['Vazirmatn'] text-slate-400 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                    <Printer className="w-3 h-3 text-emerald-400" />
                    <span>{slipLog.printCount > 0 ? `چاپ نوبت ${toPersianDigits(slipLog.printCount + 1)}` : 'نسخه اول (اصل)'}</span>
                  </span>
                </div>
                <p className="hidden sm:block text-[11px] text-slate-400 truncate">
                  حواله رسمی تحویل فیزیکی اقلام انبار بدون مبالغ مالی
                </p>
              </div>
            </div>

            {/* Header Action Badges & Buttons */}
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              {/* Delivery & Vehicle Specs Button (Desktop) */}
              <button
                type="button"
                id="exit-slip-header-delivery-btn"
                onClick={() => setShowDeliveryModal(true)}
                className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer ${
                  slipLog.isDelivered 
                    ? 'bg-emerald-700 hover:bg-emerald-600 text-white border border-emerald-500/50' 
                    : 'bg-amber-600 hover:bg-amber-500 text-white'
                }`}
                title="ثبت یا ویرایش نام راننده، مشخصات ماشین و تایید تحویل بار"
              >
                <Truck className="w-3.5 h-3.5" />
                <span>{slipLog.isDelivered ? 'بار تحویل شد' : 'ثبت تحویل بار'}</span>
              </button>

              {/* Origin Warehouse Settings Button (Desktop) */}
              <button
                type="button"
                id="exit-slip-header-warehouse-settings-btn"
                onClick={() => {
                  setOriginWarehouseFormData({
                    originWarehouseName: settings.originWarehouseName || 'انبار مرکزی سپهر',
                    originWarehouseCode: settings.originWarehouseCode || 'WH-01',
                    originWarehouseAddress: settings.originWarehouseAddress || '',
                    originWarehousePhone: settings.originWarehousePhone || '',
                    originWarehouseManager: settings.originWarehouseManager || '',
                  });
                  setShowWarehouseConfigModal(true);
                }}
                className="hidden md:flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white px-2.5 py-1.5 rounded-lg text-xs font-medium border border-slate-700 transition-colors cursor-pointer"
                title="تنظیم نام و مشخصات انبار مبدأ"
              >
                <Warehouse className="w-3.5 h-3.5 text-amber-400" />
                <span>انبار مبدأ</span>
              </button>

              {/* History Toggle Button */}
              <button
                type="button"
                id="exit-slip-history-toggle-btn"
                onClick={() => setShowHistoryModal(!showHistoryModal)}
                className="flex items-center gap-1 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-300 hover:text-white px-2 sm:px-2.5 py-1.5 rounded-lg text-xs font-medium border border-slate-700 transition-colors cursor-pointer"
                title="مشاهده تاریخچه دفعات چاپ"
              >
                <History className="w-3.5 h-3.5 text-blue-400" />
                <span className="hidden lg:inline">تاریخچه</span>
                {slipLog.printCount > 0 && (
                  <span className="font-['Vazirmatn'] font-bold text-blue-300 text-[10px] bg-blue-900/60 px-1.5 py-0.2 rounded-full border border-blue-500/30">
                    {toPersianDigits(slipLog.printCount)}
                  </span>
                )}
              </button>

              {/* Social Media Share Button (Desktop) */}
              <button
                type="button"
                id="exit-slip-header-social-btn"
                onClick={() => setShowSocialModal(true)}
                className="hidden sm:flex items-center gap-1 bg-sky-600 hover:bg-sky-500 active:scale-95 text-white px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer"
                title="ارسال به شبکه‌های اجتماعی"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>اشتراک</span>
              </button>

              {/* PDF Export Button (Desktop) */}
              <button
                type="button"
                id="exit-slip-header-pdf-btn"
                onClick={handleExportPdf}
                disabled={isExportingPdf}
                className="hidden sm:flex items-center gap-1 bg-rose-600 hover:bg-rose-500 active:scale-95 disabled:opacity-60 text-white px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer"
                title="تبدیل به PDF"
              >
                {isExportingPdf ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <FileDown className="w-3.5 h-3.5" />
                )}
                <span>PDF</span>
              </button>

              {/* Main Print Button */}
              <button
                type="button"
                id="exit-slip-print-action-btn"
                onClick={() => handlePrint('new-window')}
                className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white px-3 sm:px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer"
                title="چاپ برگه خروج"
              >
                <Printer className="w-4 h-4" />
                <span>چاپ</span>
              </button>

              {/* Close Button */}
              <button
                type="button"
                id="exit-slip-close-modal-btn"
                onClick={onClose}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Mobile Secondary Action Toolbar */}
          <div className="flex sm:hidden items-center justify-between gap-1.5 pt-2 mt-2 border-t border-slate-800/80 text-xs">
            {/* Delivery status button on mobile */}
            <button
              type="button"
              onClick={() => setShowDeliveryModal(true)}
              className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-bold ${
                slipLog.isDelivered
                  ? 'bg-emerald-700 text-white border border-emerald-500/50'
                  : 'bg-amber-600 text-white'
              }`}
            >
              <Truck className="w-3.5 h-3.5" />
              <span>{slipLog.isDelivered ? 'تحویل شد' : 'ثبت تحویل'}</span>
            </button>

            {/* Warehouse settings on mobile */}
            <button
              type="button"
              onClick={() => {
                setOriginWarehouseFormData({
                  originWarehouseName: settings.originWarehouseName || 'انبار مرکزی سپهر',
                  originWarehouseCode: settings.originWarehouseCode || 'WH-01',
                  originWarehouseAddress: settings.originWarehouseAddress || '',
                  originWarehousePhone: settings.originWarehousePhone || '',
                  originWarehouseManager: settings.originWarehouseManager || '',
                });
                setShowWarehouseConfigModal(true);
              }}
              className="flex items-center gap-1 bg-slate-800 text-slate-300 px-2.5 py-1.5 rounded-lg text-[11px] border border-slate-700"
            >
              <Warehouse className="w-3.5 h-3.5 text-amber-400" />
              <span>انبار</span>
            </button>

            {/* Share on mobile */}
            <button
              type="button"
              onClick={() => setShowSocialModal(true)}
              className="flex items-center gap-1 bg-sky-600 text-white px-2.5 py-1.5 rounded-lg text-[11px] font-bold"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>اشتراک</span>
            </button>

            {/* PDF on mobile */}
            <button
              type="button"
              onClick={handleExportPdf}
              disabled={isExportingPdf}
              className="flex items-center gap-1 bg-rose-600 disabled:opacity-60 text-white px-2.5 py-1.5 rounded-lg text-[11px] font-bold"
            >
              {isExportingPdf ? <Loader2 className="w-3 h-3 animate-spin" /> : <FileDown className="w-3.5 h-3.5" />}
              <span>PDF</span>
            </button>
          </div>
        </div>

        {/* PAPER SETTINGS TOOLBAR (No Print - User paper format selection) */}
        <div className="no-print bg-slate-800 text-slate-200 px-3.5 sm:px-6 py-2 border-b border-slate-700/80 flex flex-wrap items-center justify-between gap-2 shrink-0 text-xs">
          <div className="flex items-center gap-1.5 text-slate-300">
            <Settings className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span className="font-bold text-slate-200 text-xs">تنظیمات قطع و جهت چاپ:</span>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            {/* Paper Size selector: A4 / A5 */}
            <div className="inline-flex items-center bg-slate-900/90 rounded-lg p-0.5 border border-slate-700">
              <span className="text-[10px] text-slate-400 px-2 select-none">اندازه کاغذ:</span>
              <button
                type="button"
                id="exit-slip-size-a4-btn"
                onClick={() => setPageSize('a4')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                  pageSize === 'a4'
                    ? 'bg-amber-500 text-slate-950 shadow-xs'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                A4
              </button>
              <button
                type="button"
                id="exit-slip-size-a5-btn"
                onClick={() => setPageSize('a5')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                  pageSize === 'a5'
                    ? 'bg-amber-500 text-slate-950 shadow-xs'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                A5
              </button>
            </div>

            {/* Orientation selector: عمودی (portrait) / افقی (landscape) */}
            <div className="inline-flex items-center bg-slate-900/90 rounded-lg p-0.5 border border-slate-700">
              <span className="text-[10px] text-slate-400 px-2 select-none">جهت کاغذ:</span>
              <button
                type="button"
                id="exit-slip-orientation-portrait-btn"
                onClick={() => setOrientation('portrait')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                  orientation === 'portrait'
                    ? 'bg-amber-500 text-slate-950 shadow-xs'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                عمودی
              </button>
              <button
                type="button"
                id="exit-slip-orientation-landscape-btn"
                onClick={() => setOrientation('landscape')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                  orientation === 'landscape'
                    ? 'bg-amber-500 text-slate-950 shadow-xs'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                افقی
              </button>
            </div>

            {/* Current Active Label Badge */}
            <span className="bg-emerald-950/70 border border-emerald-500/40 text-emerald-300 px-2 py-0.5 rounded text-[11px] font-bold hidden sm:inline-flex items-center gap-1 font-['Vazirmatn']">
              <span>قالب:</span>
              <strong>{pageSize.toUpperCase()} {orientation === 'portrait' ? 'عمودی' : 'افقی'}</strong>
            </span>
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

        {/* Dynamic print stylesheet for selected paper size and orientation */}
        <style>{`
          @media print {
            @page {
              size: ${pageSize.toUpperCase()} ${orientation} !important;
              margin: ${isA5Landscape ? '3mm' : isA5Portrait ? '4mm' : '8mm'} !important;
            }
            body {
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
          }

          /* === A5 GENERAL COMPACTING (All info fits on single sheet) === */
          #printable-exit-slip.paper-a5 {
            font-size: 10px;
          }
          #printable-exit-slip.paper-a5 table th,
          #printable-exit-slip.paper-a5 table td {
            padding: 3px 5px !important;
            font-size: 10px !important;
          }

          /* A5 Landscape - Specifically optimized for 148mm paper height */
          #printable-exit-slip.paper-a5.paper-landscape {
            padding: 10px 14px !important;
            max-width: 760px !important;
          }
          #printable-exit-slip.paper-a5.paper-landscape .exit-slip-header {
            padding-bottom: 5px !important;
            margin-bottom: 5px !important;
          }
          #printable-exit-slip.paper-a5.paper-landscape .exit-slip-title {
            font-size: 13px !important;
          }
          #printable-exit-slip.paper-a5.paper-landscape .exit-slip-badge {
            font-size: 10.5px !important;
            padding: 2px 8px !important;
          }
          #printable-exit-slip.paper-a5.paper-landscape .exit-slip-info-deck {
            gap: 6px !important;
            margin-bottom: 6px !important;
            font-size: 9.5px !important;
          }
          #printable-exit-slip.paper-a5.paper-landscape .exit-slip-card {
            padding: 5px 8px !important;
            border-radius: 8px !important;
          }
          #printable-exit-slip.paper-a5.paper-landscape .exit-slip-table-box {
            margin-bottom: 6px !important;
            border-radius: 8px !important;
          }
          #printable-exit-slip.paper-a5.paper-landscape .exit-slip-table-header {
            padding: 3px 8px !important;
            font-size: 9.5px !important;
          }
          #printable-exit-slip.paper-a5.paper-landscape .exit-slip-terms {
            padding: 4px 8px !important;
            margin-bottom: 6px !important;
            font-size: 8.5px !important;
            line-height: 1.35 !important;
            border-radius: 8px !important;
          }
          #printable-exit-slip.paper-a5.paper-landscape .signature-box {
            height: 52px !important;
            padding: 3px 6px !important;
            border-radius: 8px !important;
          }
          #printable-exit-slip.paper-a5.paper-landscape .signature-box-title {
            font-size: 9px !important;
          }
          #printable-exit-slip.paper-a5.paper-landscape .signature-box-subtitle {
            font-size: 8px !important;
          }
          #printable-exit-slip.paper-a5.paper-landscape .signature-box-line {
            font-size: 8px !important;
            padding-top: 2px !important;
          }
          #printable-exit-slip.paper-a5.paper-landscape .exit-slip-tracking {
            padding-top: 4px !important;
            margin-top: 4px !important;
            font-size: 8.5px !important;
          }

          /* A5 Portrait */
          #printable-exit-slip.paper-a5.paper-portrait {
            padding: 12px 14px !important;
            max-width: 540px !important;
          }
          #printable-exit-slip.paper-a5.paper-portrait .exit-slip-header {
            padding-bottom: 8px !important;
            margin-bottom: 8px !important;
          }
          #printable-exit-slip.paper-a5.paper-portrait .exit-slip-info-deck {
            gap: 8px !important;
            margin-bottom: 8px !important;
          }
          #printable-exit-slip.paper-a5.paper-portrait .exit-slip-card {
            padding: 6px 10px !important;
          }
          #printable-exit-slip.paper-a5.paper-portrait .exit-slip-table-box {
            margin-bottom: 8px !important;
          }
          #printable-exit-slip.paper-a5.paper-portrait .exit-slip-terms {
            padding: 6px 10px !important;
            margin-bottom: 8px !important;
            font-size: 9px !important;
          }
          #printable-exit-slip.paper-a5.paper-portrait .signature-box {
            height: 70px !important;
            padding: 5px 8px !important;
          }

          /* === A4 FORMATS (Spacious executive proportions) === */
          #printable-exit-slip.paper-a4.paper-landscape {
            padding: 18px 24px !important;
            max-width: 1040px !important;
          }
          #printable-exit-slip.paper-a4.paper-landscape .signature-box {
            height: 84px !important;
          }

          #printable-exit-slip.paper-a4.paper-portrait {
            padding: 24px 32px !important;
            max-width: 860px !important;
          }
          #printable-exit-slip.paper-a4.paper-portrait .signature-box {
            height: 105px !important;
          }
        `}</style>

        {/* PRINTABLE SLIP CONTENT VIEW (Scrollable on screen, Full page on Print) */}
        <div className="flex-1 overflow-y-auto p-2.5 sm:p-5 md:p-8 bg-slate-100/70 print:p-0 print:bg-white flex justify-center">
          <div 
            id="printable-exit-slip"
            className={`print-container bg-white border border-slate-300 rounded-2xl text-slate-900 shadow-sm print:border-none print:shadow-none print:p-0 print:m-0 print:max-w-none print:rounded-none w-full transition-all ${
              isA5 ? 'paper-a5' : 'paper-a4'
            } ${isLandscape ? 'paper-landscape' : 'paper-portrait'}`}
          >
            {/* Header: Store details & Exit Voucher Title */}
            <div className="exit-slip-header border-b-2 border-slate-900 pb-3 sm:pb-4 mb-4">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 sm:gap-4">
                {/* Store Branding */}
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center font-black text-sm print:border print:border-slate-800">
                      {settings.storeName ? settings.storeName.charAt(0) : 'ا'}
                    </span>
                    <h1 className="exit-slip-title text-base sm:text-xl font-black text-slate-900 tracking-tight">
                      {settings.storeName || 'فروشگاه و انبار مرکزی'}
                    </h1>
                  </div>
                  {settings.tagline && (
                    <p className="text-[11px] sm:text-xs text-slate-500 font-medium">{settings.tagline}</p>
                  )}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-600 pt-0.5">
                    {settings.phone && (
                      <span className="flex items-center gap-1">
                        <Phone className="w-3 h-3 text-slate-400" />
                        <span>تلفن: {toPersianDigits(settings.phone)}</span>
                      </span>
                    )}
                    {settings.address && (
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-slate-400" />
                        <span>{settings.address}</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Slip Badge Title & Serial */}
                <div className="text-right sm:text-left shrink-0 bg-slate-50 border border-slate-200 rounded-xl p-2.5 sm:p-3 print:bg-white print:border-slate-800">
                  <div className="exit-slip-badge inline-block border-2 border-slate-900 bg-slate-900 text-white px-3 sm:px-4 py-1 rounded-lg text-xs sm:text-sm font-black shadow-2xs">
                    برگ خروج کالا از انبار
                  </div>
                  <div className="text-[10px] sm:text-[11px] text-slate-600 font-bold mt-1">
                    حواله رسمی تحویل قطعی اجناس
                  </div>
                  <div className="flex flex-wrap items-center justify-between sm:justify-end gap-x-3 gap-y-1 text-[11px] font-['Vazirmatn'] text-slate-700 pt-1.5 mt-1 border-t border-slate-200">
                    <div>
                      <span className="text-slate-400 text-[10px]">شماره حواله: </span>
                      <strong className="text-slate-900 text-xs">{toPersianDigits(invoice.invoiceNumber)}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[10px]">تاریخ صدور: </span>
                      <strong className="text-slate-900 text-xs">{toPersianDigits(invoice.date)}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[10px]">ساعت صدور: </span>
                      <strong className="text-slate-900 text-xs font-mono">{toPersianDigits(issuedTime)}</strong>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Consolidated 2-Column Info Deck */}
            <div className="exit-slip-info-deck grid grid-cols-1 md:grid-cols-2 gap-3 mb-4 text-xs">
              
              {/* Card 1: Origin Warehouse (مشخصات انبار مبدأ و بارگیری) */}
              <div className="exit-slip-card bg-slate-50/90 border border-slate-200/90 rounded-xl p-3 flex flex-col justify-between print:bg-white">
                <div>
                  <div className="flex items-center justify-between pb-1.5 mb-2 border-b border-slate-200">
                    <div className="flex items-center gap-1.5 font-bold text-slate-800">
                      <Warehouse className="w-3.5 h-3.5 text-amber-600" />
                      <span>انبار مبدأ بارگیری و خروج:</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200">
                        {originWarehouseName}
                      </span>
                      {settings.originWarehouseCode && (
                        <span className="text-[10px] font-mono text-slate-500">
                          ({toPersianDigits(settings.originWarehouseCode)})
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setOriginWarehouseFormData({
                            originWarehouseName: settings.originWarehouseName || 'انبار مرکزی سپهر',
                            originWarehouseCode: settings.originWarehouseCode || 'WH-01',
                            originWarehouseAddress: settings.originWarehouseAddress || '',
                            originWarehousePhone: settings.originWarehousePhone || '',
                            originWarehouseManager: settings.originWarehouseManager || '',
                          });
                          setShowWarehouseConfigModal(true);
                        }}
                        className="no-print text-[10px] text-blue-600 hover:text-blue-800 underline mr-1 cursor-pointer"
                        title="ویرایش مشخصات انبار مبدأ"
                      >
                        ویرایش
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div>
                      <span className="text-slate-500">متصدی / انباردار: </span>
                      <strong className="text-slate-800">{settings.originWarehouseManager || currentUser?.fullName || '—'}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500">تلفن انبار: </span>
                      <span className="font-['Vazirmatn'] font-semibold text-slate-800">
                        {settings.originWarehousePhone ? toPersianDigits(settings.originWarehousePhone) : (settings.phone ? toPersianDigits(settings.phone) : '—')}
                      </span>
                    </div>
                    <div className="col-span-2 pt-1 border-t border-slate-200/60">
                      <span className="text-slate-500">نشانی محل بارگیری: </span>
                      <span className="text-slate-800 font-medium">
                        {settings.originWarehouseAddress || settings.address || 'آدرس انبار مرکزی'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-2 pt-1.5 border-t border-slate-200/60 flex items-center justify-between text-[10px] text-slate-500">
                  <span>وضعیت چاپ سند:</span>
                  <span className="font-['Vazirmatn'] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    {slipLog.printCount > 0 ? `چاپ نوبت ${toPersianDigits(slipLog.printCount + 1)}` : 'نسخه اول (اصل سند)'}
                  </span>
                </div>
              </div>

              {/* Card 2: Destination, Customer & Transport Fleet (مشخصات تحویل‌گیرنده و ناوگان حمل) */}
              <div className="exit-slip-card bg-slate-50/90 border border-slate-200/90 rounded-xl p-3 flex flex-col justify-between print:bg-white">
                <div>
                  <div className="flex items-center justify-between pb-1.5 mb-2 border-b border-slate-200">
                    <div className="flex items-center gap-1.5 font-bold text-slate-800">
                      <Truck className="w-3.5 h-3.5 text-blue-600" />
                      <span>تحویل‌گیرنده و ناوگان حمل:</span>
                    </div>
                    <div>
                      {slipLog.isDelivered ? (
                        <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full text-[10px] font-bold border border-emerald-300">
                          <Check className="w-3 h-3 text-emerald-600" />
                          <span>بار تحویل شد</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full text-[10px] font-bold border border-amber-300">
                          <Clock className="w-3 h-3 text-amber-600" />
                          <span>در انتظار بارگیری</span>
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1.5 text-[11px]">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-slate-500">خریدار / مشتری: </span>
                        <strong className="text-slate-900">{invoice.customerName}</strong>
                      </div>
                      {invoice.customerPhone && (
                        <div className="font-['Vazirmatn'] text-slate-700">
                          {toPersianDigits(invoice.customerPhone)}
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-200/60">
                      <div>
                        <span className="text-slate-500">تحویل‌گیرنده / راننده: </span>
                        <strong className="text-slate-800 font-['Vazirmatn']">
                          {slipLog.receiverName || invoice.customerName || '—'}
                        </strong>
                      </div>
                      <div>
                        <span className="text-slate-500">تماس راننده: </span>
                        <span className="font-['Vazirmatn'] font-semibold text-slate-800">
                          {slipLog.receiverPhone ? toPersianDigits(slipLog.receiverPhone) : (invoice.customerPhone ? toPersianDigits(invoice.customerPhone) : '—')}
                        </span>
                      </div>
                    </div>

                    {/* Vehicle & Iranian License Plate */}
                    <div className="pt-1 border-t border-slate-200/60 flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-slate-500">مشخصات خودرو و پلاک: </span>
                        {slipLog.vehicleInfo ? (
                          <MiniIranPlate plateInfo={slipLog.vehicleInfo} />
                        ) : (
                          <span className="text-slate-400 italic">ثبت نشده</span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowDeliveryModal(true)}
                        className="no-print text-[10px] text-blue-600 hover:text-blue-800 underline cursor-pointer"
                      >
                        {slipLog.vehicleInfo ? 'ویرایش' : 'ثبت خودرو'}
                      </button>
                    </div>

                    {slipLog.deliveryNotes && (
                      <div className="pt-1 text-slate-600">
                        <span className="text-slate-400">یادداشت خروج / بارنامه: </span>
                        <span className="font-medium text-slate-800">{slipLog.deliveryNotes}</span>
                      </div>
                    )}
                  </div>
                </div>

                {slipLog.deliveredAt && (
                  <div className="mt-2 pt-1.5 border-t border-slate-200/60 flex items-center justify-between text-[10px] text-slate-500 font-['Vazirmatn']">
                    <span>زمان تایید خروج: {toPersianDigits(slipLog.deliveredAt)}</span>
                    {slipLog.deliveredBy && <span>توسط: {slipLog.deliveredBy}</span>}
                  </div>
                )}
              </div>

            </div>

            {/* Items Physical Inventory Table (NO FINANCIAL / PRICE DATA) */}
            <div className="exit-slip-table-box mb-4 overflow-hidden border border-slate-300 rounded-xl bg-white">
              <div className="exit-slip-table-header bg-slate-100/90 px-3.5 py-2 text-xs font-bold text-slate-800 border-b border-slate-300 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <PackageCheck className="w-4 h-4 text-emerald-600" />
                  <span>لیست اقلام تحویلی از انبار (کنترل فیزیکی اقلام)</span>
                </span>
                <span className="text-[10px] sm:text-[11px] text-slate-500 font-normal">
                  (سند انبارداری - فاقد هرگونه قیمت و گردش مالی)
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-right border-collapse text-xs min-w-[540px] sm:min-w-full">
                  <thead>
                    <tr className="bg-slate-50 text-slate-700 border-b border-slate-300 font-bold text-[11px] sm:text-xs">
                      <th className="py-2.5 px-2 text-center w-10 border-l border-slate-200">ردیف</th>
                      <th className="py-2.5 px-2 text-center w-20 border-l border-slate-200">کد کالا</th>
                      <th className="py-2.5 px-3 border-l border-slate-200">شرح کالا و مشخصات فنی</th>
                      <th className="py-2.5 px-2 text-center w-16 border-l border-slate-200">واحد</th>
                      <th className="py-2.5 px-2 text-center w-20 border-l border-slate-200 bg-slate-100 font-black">
                        تعداد حواله
                      </th>
                      <th className="py-2.5 px-2 text-center w-20 border-l border-slate-200">تعداد تحویلی</th>
                      <th className="py-2.5 px-2 text-center w-16">کنترل سلامت</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {invoice.items.map((item, index) => (
                      <tr
                        key={item.id || index}
                        className={`${
                          index % 2 === 1 ? 'bg-slate-50/70' : 'bg-white'
                        } hover:bg-slate-100/60 transition-colors`}
                      >
                        <td className="py-2.5 px-2 text-center font-['Vazirmatn'] border-l border-slate-200 text-slate-500 font-bold">
                          {toPersianDigits(index + 1)}
                        </td>
                        <td className="py-2.5 px-2 text-center font-['Vazirmatn'] text-slate-600 border-l border-slate-200 text-[11px] font-mono">
                          {toPersianDigits(item.productId.replace('prod-', ''))}
                        </td>
                        <td className="py-2.5 px-3 font-bold text-slate-900 border-l border-slate-200">
                          {item.productName}
                        </td>
                        <td className="py-2.5 px-2 text-center text-slate-600 border-l border-slate-200 text-[11px]">
                          {item.unit || 'عدد'}
                        </td>
                        <td className="py-2.5 px-2 text-center font-['Vazirmatn'] font-black text-slate-900 text-sm bg-slate-50/60 border-l border-slate-200">
                          {toPersianDigits(item.quantity)}
                        </td>
                        <td className="py-2.5 px-2 text-center border-l border-slate-200">
                          <span className="font-['Vazirmatn'] font-bold text-slate-800">
                            {toPersianDigits(item.quantity)}
                          </span>
                        </td>
                        <td className="py-2.5 px-2 text-center">
                          <div className="w-4 h-4 border border-slate-400 rounded-xs mx-auto flex items-center justify-center text-[10px] text-slate-400">
                            ✓
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-100 font-bold border-t-2 border-slate-300 text-slate-900 text-xs">
                      <td colSpan={4} className="py-2.5 px-3 text-left border-l border-slate-300">
                        مجموع کل اقلام فیزیکی تحویل شده:
                      </td>
                      <td className="py-2.5 px-2 text-center font-['Vazirmatn'] font-black text-sm sm:text-base text-emerald-800 bg-emerald-50 border-l border-slate-300">
                        {toPersianDigits(totalUnits)}
                      </td>
                      <td colSpan={2} className="py-2.5 px-3 text-slate-600 text-[11px]">
                        ({toPersianDigits(invoice.items.length)} ردیف کالایی)
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Delivery Terms & Notes */}
            <div className="exit-slip-terms bg-slate-50 border border-slate-200 rounded-xl p-2.5 sm:p-3 mb-4 text-xs text-slate-600 space-y-1">
              <div className="font-bold text-slate-800 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>ضوابط و شرایط ترخیص و خروج از انبار:</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-[11px] leading-relaxed pt-0.5">
                <p>
                  ۱. کلیه اقلام فوق از لحاظ تعداد فیزیکی، بسته‌بندی و سلامت ظاهری به رویت و تایید کامل تحویل‌گیرنده رسید.
                </p>
                <p>
                  ۲. خروج هرگونه بار از محوطه انبار منوط به امضای متصدی انبار و برگه تایید گیت نگهبانی می‌باشد.
                </p>
              </div>
              {invoice.notes && (
                <div className="pt-1.5 mt-1 border-t border-slate-200 text-slate-700 text-[11px]">
                  <span className="font-bold">یادداشت فاکتور / حواله: </span>
                  <span>{invoice.notes}</span>
                </div>
              )}
            </div>

            {/* Official Signatures & Approvals Grid */}
            <div className="exit-slip-signatures grid grid-cols-3 gap-2 sm:gap-4 pt-2 border-t border-slate-300 text-center text-xs">
              
              {/* Box 1: Warehouse keeper */}
              <div className="signature-box bg-slate-50/70 border border-slate-200 rounded-xl p-2.5 flex flex-col justify-between h-28 sm:h-32">
                <div>
                  <span className="signature-box-title font-bold text-slate-800 block text-[11px] sm:text-xs">امضا و مهر انباردار</span>
                  <span className="signature-box-subtitle text-[10px] text-slate-500 block mt-0.5">
                    {settings.originWarehouseManager || currentUser?.fullName || 'متصدی انبار'}
                  </span>
                </div>
                <div className="signature-box-line border-t border-dashed border-slate-300 pt-1 text-[9px] text-slate-400">
                  محل مهر و تایید خروج
                </div>
              </div>

              {/* Box 2: Receiver / Driver */}
              <div className="signature-box bg-slate-50/70 border border-slate-200 rounded-xl p-2.5 flex flex-col justify-between h-28 sm:h-32">
                <div>
                  <span className="signature-box-title font-bold text-slate-800 block text-[11px] sm:text-xs">امضا و اثر انگشت تحویل‌گیرنده</span>
                  <span className="signature-box-subtitle text-[10px] text-slate-500 block mt-0.5">
                    {slipLog.receiverName || invoice.customerName}
                  </span>
                </div>
                <div className="signature-box-line border-t border-dashed border-slate-300 pt-1 text-[9px] text-slate-400">
                  محل امضا و اثر انگشت
                </div>
              </div>

              {/* Box 3: Exit Gate & Security */}
              <div className="signature-box bg-slate-50/70 border border-slate-200 rounded-xl p-2.5 flex flex-col justify-between h-28 sm:h-32">
                <div>
                  <span className="signature-box-title font-bold text-slate-800 block text-[11px] sm:text-xs">کنترل نهایی گیت خروج</span>
                  <span className="signature-box-subtitle text-[10px] text-slate-500 block mt-0.5">نگهبانی و بازرسی درب</span>
                </div>
                <div className="signature-box-line border-t border-dashed border-slate-300 pt-1 text-[9px] text-slate-400">
                  ساعت خروج: ..........
                </div>
              </div>

            </div>

            {/* Document Tracking Bar */}
            <div className="exit-slip-tracking flex items-center justify-between text-[10px] text-slate-400 pt-3 mt-3 border-t border-slate-200 font-['Vazirmatn']">
              <div>
                <span>شناسه سند: </span>
                <span className="font-mono text-slate-600 font-bold">OUT-{invoice.invoiceNumber}</span>
                <span className="mx-1.5">•</span>
                <span>نوبت چاپ: {toPersianDigits(slipLog.printCount + 1)}</span>
                <span className="mx-1.5">•</span>
                <span>زمان صدور: {toPersianDigits(invoice.date)} - ساعت {toPersianDigits(issuedTime)}</span>
                <span className="mx-1.5">•</span>
                <span>قالب: {pageSize.toUpperCase()} ({orientation === 'portrait' ? 'عمودی' : 'افقی'})</span>
              </div>
              <div className="flex items-center gap-2">
                {slipLog.lastPrintedAt && (
                  <span>آخرین چاپ: {toPersianDigits(slipLog.lastPrintedAt)}</span>
                )}
                <span>صادرکننده: {currentUser?.fullName || 'انباردار'}</span>
              </div>
            </div>

          </div>
        </div>

        {/* MODAL FOOTER (No Print) */}
        <div className="no-print bg-slate-50 border-t border-slate-200 px-3.5 sm:px-6 py-2.5 sm:py-3 flex flex-col sm:flex-row items-center justify-between gap-2.5 sm:gap-4 shrink-0">
          <div className="hidden sm:flex text-xs text-slate-500 items-center gap-1.5">
            <CheckSquare className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>با فشردن دکمه چاپ یا خروجی PDF، تاریخچه و دفعات پرینت در سامانه انبار ثبت می‌گردد.</span>
          </div>

          <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center justify-end gap-2 w-full sm:w-auto">
            {/* Social Share Button */}
            <button
              id="exit-slip-footer-social-btn"
              type="button"
              onClick={() => setShowSocialModal(true)}
              className="flex items-center justify-center gap-1.5 bg-sky-600 hover:bg-sky-700 active:scale-95 text-white px-3 py-2 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
              title="ارسال به شبکه‌های اجتماعی"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>اشتراک‌گذاری</span>
            </button>

            {/* PDF Export Button */}
            <button
              id="exit-slip-footer-pdf-btn"
              type="button"
              onClick={handleExportPdf}
              disabled={isExportingPdf}
              className="flex items-center justify-center gap-1.5 bg-rose-600 hover:bg-rose-700 active:scale-95 disabled:opacity-60 text-white px-3 py-2 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
              title="تبدیل به PDF استاندارد و کم‌حجم"
            >
              {isExportingPdf ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>در حال ساخت...</span>
                </>
              ) : (
                <>
                  <FileDown className="w-3.5 h-3.5" />
                  <span>دانلود PDF</span>
                </>
              )}
            </button>

            {/* Close Button */}
            <button
              id="exit-slip-footer-close-btn"
              type="button"
              onClick={onClose}
              className="flex items-center justify-center px-3 py-2 text-xs text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer font-medium"
            >
              بستن
            </button>

            {/* Main Print Button */}
            <button
              id="exit-slip-footer-print-btn"
              type="button"
              onClick={() => handlePrint('new-window')}
              className="flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white px-4 py-2 rounded-xl text-xs font-bold transition-colors shadow-xs cursor-pointer"
              title="باز کردن پنجره پرینتر جهت چاپ مستقیم برگه خروج"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>چاپ حواله خروج</span>
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
          settings={settings}
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

      {/* Origin Warehouse Settings Modal (Quick Edit by Management) */}
      {showWarehouseConfigModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs font-['Vazirmatn']">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden border border-slate-200 animate-scaleUp">
            <div className="bg-slate-900 text-white px-5 py-3.5 flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Warehouse className="w-5 h-5 text-amber-400" />
                <div>
                  <h4 className="font-bold text-sm text-white">تنظیم مشخصات انبار مبدأ (حواله خروج)</h4>
                  <p className="text-[11px] text-slate-400">تغییر نام، آدرس، تلفن و متصدی انبار مبدأ جهت درج در برگه خروج</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowWarehouseConfigModal(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveOriginWarehouse} className="p-4 sm:p-5 space-y-4 text-xs">
              {/* Warehouse selector if warehouses exist */}
              {settings.warehouses && settings.warehouses.length > 0 && (
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                  <label className="block font-bold text-slate-700 mb-1">
                    انتخاب از انبارهای تعریف‌شده:
                  </label>
                  <select
                    onChange={(e) => {
                      const selId = e.target.value;
                      const wh = settings.warehouses?.find(w => w.id === selId);
                      if (wh) {
                        setOriginWarehouseFormData({
                          originWarehouseName: wh.name,
                          originWarehouseCode: wh.code || originWarehouseFormData.originWarehouseCode,
                          originWarehouseAddress: wh.address || originWarehouseFormData.originWarehouseAddress,
                          originWarehousePhone: wh.phone || originWarehouseFormData.originWarehousePhone,
                          originWarehouseManager: wh.managerName || originWarehouseFormData.originWarehouseManager,
                        });
                      }
                    }}
                    className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 font-bold cursor-pointer"
                  >
                    <option value="">-- انتخاب انبار جهت جایگذاری مشخصات --</option>
                    {settings.warehouses.map((wh) => (
                      <option key={wh.id} value={wh.id}>
                        {wh.name} {wh.isDefault ? '(پیش‌فرض)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    نام انبار مبدأ <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={originWarehouseFormData.originWarehouseName}
                    onChange={(e) => setOriginWarehouseFormData({ ...originWarehouseFormData, originWarehouseName: e.target.value })}
                    placeholder="مثال: انبار مرکزی سپهر"
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    کد / شناسه انبار مبدأ
                  </label>
                  <input
                    type="text"
                    value={originWarehouseFormData.originWarehouseCode}
                    onChange={(e) => setOriginWarehouseFormData({ ...originWarehouseFormData, originWarehouseCode: e.target.value })}
                    placeholder="مثال: WH-01"
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono text-left focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    شماره تماس انبار مبدأ
                  </label>
                  <input
                    type="text"
                    value={originWarehouseFormData.originWarehousePhone}
                    onChange={(e) => setOriginWarehouseFormData({ ...originWarehouseFormData, originWarehousePhone: e.target.value })}
                    placeholder="مثال: ۰۲۱-۵۵۶۶۷۷۸۸"
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs dir-ltr text-right focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    نام مسئول / سرپرست انبار
                  </label>
                  <input
                    type="text"
                    value={originWarehouseFormData.originWarehouseManager}
                    onChange={(e) => setOriginWarehouseFormData({ ...originWarehouseFormData, originWarehouseManager: e.target.value })}
                    placeholder="مثال: مرتضی اکبری"
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-bold text-slate-700 mb-1">
                    نشانی و آدرس دقیق محل بارگیری
                  </label>
                  <textarea
                    rows={2}
                    value={originWarehouseFormData.originWarehouseAddress}
                    onChange={(e) => setOriginWarehouseFormData({ ...originWarehouseFormData, originWarehouseAddress: e.target.value })}
                    placeholder="آدرس دقیق و راهنمای بارگیری رانندگان..."
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowWarehouseConfigModal(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold bg-amber-600 hover:bg-amber-700 active:scale-95 text-white rounded-xl shadow-md cursor-pointer transition-all"
                >
                  ذخیره تنظیمات انبار
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
