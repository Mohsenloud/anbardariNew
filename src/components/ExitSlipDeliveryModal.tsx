import React, { useState, useEffect } from 'react';
import { Invoice, ExitSlipData, AppUser, StoreSettings, SavedVehicle } from '../types';
import { getCurrentJalaliDate, getCurrentJalaliTime, toPersianDigits } from '../utils/jalali';
import { StorageService } from '../utils/storage';
import {
  Truck,
  X,
  CheckCircle2,
  Clock,
  User,
  Phone,
  Calendar,
  UserCheck,
  FileText,
  AlertCircle,
  PackageCheck,
  Sparkles,
  ArrowRight,
  Printer,
  Warehouse,
  MapPin,
  BookmarkPlus,
  BookmarkCheck,
  Save,
  Trash2,
  Search,
  ChevronDown,
  ChevronUp,
  Check
} from 'lucide-react';
import { IranPlatePicker, parseVehicleInfo } from './IranPlatePicker';
import { VehicleFleetModal } from './VehicleFleetModal';

interface ExitSlipDeliveryModalProps {
  isOpen: boolean;
  invoice: Invoice | null;
  slipLog: ExitSlipData;
  settings?: StoreSettings;
  currentUser?: AppUser;
  onClose: () => void;
  onSave: (deliveryData: {
    isDelivered: boolean;
    deliveredAt: string;
    deliveredBy: string;
    receiverName: string;
    receiverPhone: string;
    vehicleInfo: string;
    deliveryNotes: string;
  }) => void;
  onSaveAndPrint?: (deliveryData: {
    isDelivered: boolean;
    deliveredAt: string;
    deliveredBy: string;
    receiverName: string;
    receiverPhone: string;
    vehicleInfo: string;
    deliveryNotes: string;
  }) => void;
}

export const ExitSlipDeliveryModal: React.FC<ExitSlipDeliveryModalProps> = ({
  isOpen,
  invoice,
  slipLog,
  settings,
  currentUser,
  onClose,
  onSave,
  onSaveAndPrint,
}) => {
  const originWarehouseName = settings?.originWarehouseName || 
    settings?.warehouses?.find(w => w.id === settings?.defaultWarehouseId)?.name || 
    'انبار مرکزی سپهر';
  const [isDelivered, setIsDelivered] = useState<boolean>(slipLog.isDelivered ?? false);
  const [receiverName, setReceiverName] = useState<string>(slipLog.receiverName || '');
  const [receiverPhone, setReceiverPhone] = useState<string>(slipLog.receiverPhone || '');
  const [vehicleInfo, setVehicleInfo] = useState<string>(slipLog.vehicleInfo || '');
  const [deliveredAt, setDeliveredAt] = useState<string>(
    slipLog.deliveredAt || `${getCurrentJalaliDate()} - ساعت ${getCurrentJalaliTime()}`
  );
  const [deliveredBy, setDeliveredBy] = useState<string>(
    slipLog.deliveredBy || currentUser?.fullName || 'انباردار'
  );
  const [deliveryNotes, setDeliveryNotes] = useState<string>(slipLog.deliveryNotes || '');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // مشخصات ماشین‌های ثبت‌شده در ناوگان جهت تسریع ورود اطلاعات
  const [savedVehicles, setSavedVehicles] = useState<Array<SavedVehicle & { sourceLabel?: string }>>(() => StorageService.getExitSlipVehicles());
  const [showSavedFleet, setShowSavedFleet] = useState<boolean>(false);
  const [isFleetModalOpen, setIsFleetModalOpen] = useState<boolean>(false);
  const [fleetSearchQuery, setFleetSearchQuery] = useState<string>('');
  const [vehicleFeedback, setVehicleFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [autoSaveToFleet, setAutoSaveToFleet] = useState<boolean>(true);

  // اشتراک در تغییرات ذخیره‌سازی ماشین‌ها
  useEffect(() => {
    const unsub = StorageService.subscribe(() => {
      setSavedVehicles(StorageService.getExitSlipVehicles());
    });
    return () => unsub();
  }, []);

  // Keep track of which invoice has been loaded into form to prevent periodic background sync resets
  const loadedInvoiceIdRef = React.useRef<string | null>(null);

  // Sync state ONLY when modal is initially opened or target invoice changes
  useEffect(() => {
    if (isOpen && invoice) {
      if (loadedInvoiceIdRef.current !== invoice.id) {
        loadedInvoiceIdRef.current = invoice.id;
        setIsDelivered(slipLog.isDelivered ?? false);
        setReceiverName(slipLog.receiverName || invoice.customerName || '');
        setReceiverPhone(slipLog.receiverPhone || invoice.customerPhone || '');
        setVehicleInfo(slipLog.vehicleInfo || '');
        setDeliveredAt(
          slipLog.deliveredAt || `${getCurrentJalaliDate()} - ساعت ${getCurrentJalaliTime()}`
        );
        setDeliveredBy(slipLog.deliveredBy || currentUser?.fullName || 'انباردار');
        setDeliveryNotes(slipLog.deliveryNotes || '');
        setErrorMsg(null);
        setVehicleFeedback(null);
        setShowSavedFleet(false);
      }
    } else if (!isOpen) {
      // Reset ref when modal is closed so next opening gets fresh data
      loadedInvoiceIdRef.current = null;
    }
  }, [isOpen, invoice?.id]);

  if (!isOpen || !invoice) return null;

  const totalUnits = invoice.items.reduce((sum, item) => sum + item.quantity, 0);

  const handleRefreshTimestamp = () => {
    setDeliveredAt(`${getCurrentJalaliDate()} - ساعت ${getCurrentJalaliTime()}`);
  };

  // ثبت دستی و سریع مشخصات ماشین فعلی در ناوگان ذخیره‌شده
  const handleRegisterVehicle = () => {
    if (!vehicleInfo.trim() && !receiverName.trim()) {
      setVehicleFeedback({
        type: 'error',
        message: 'لطفاً ابتدا مشخصات یا پلاک ماشین را وارد فرمایید.',
      });
      return;
    }

    const parsed = parseVehicleInfo(vehicleInfo);
    const vehicleType = parsed?.vehicleType || 'وانت باربری';
    const plateNumber = (!parsed?.isFreeText && parsed?.part1 && parsed?.part2)
      ? `${parsed.part1} ${parsed.letter} ${parsed.part2} ایران ${parsed.iranCode}`
      : '';

    const saved = StorageService.addOrUpdateSavedVehicle({
      vehicleType,
      vehicleInfo: vehicleInfo.trim() || 'خودرو تحویل بار',
      driverName: receiverName.trim(),
      driverPhone: receiverPhone.trim(),
      plateNumber,
      colorDesc: parsed?.colorDesc || '',
    });

    setSavedVehicles(StorageService.getExitSlipVehicles());
    setVehicleFeedback({
      type: 'success',
      message: `مشخصات ماشین «${saved.vehicleType}${saved.driverName ? ` - ${saved.driverName}` : ''}» با موفقیت ذخیره شد و در دفعات بعد با یک کلیک در دسترس است.`,
    });
    setTimeout(() => setVehicleFeedback(null), 5000);
  };

  // انتخاب یک ماشین از لیست ذخیره‌شده و پرکردن آنی فیلدهای فرم
  const handleSelectSavedVehicle = (veh: SavedVehicle) => {
    setVehicleInfo(veh.vehicleInfo);
    if (veh.driverName) {
      setReceiverName(veh.driverName);
    }
    if (veh.driverPhone) {
      setReceiverPhone(veh.driverPhone);
    }
    setShowSavedFleet(false);
    setVehicleFeedback({
      type: 'success',
      message: `اطلاعات «${veh.vehicleType}${veh.driverName ? ` (راننده: ${veh.driverName})` : ''}» در فرم جای‌گذاری شد.`,
    });
    setTimeout(() => setVehicleFeedback(null), 3500);
  };

  // حذف ماشین از لیست ذخیره‌شده‌ها
  const handleDeleteSavedVehicle = (id: string, vehicleInfo?: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (window.confirm('آیا از حذف این مشخصات ماشین از لیست ذخیره‌شده‌ها اطمینان دارید؟')) {
      StorageService.deleteSavedVehicle(id, vehicleInfo);
      setSavedVehicles(StorageService.getExitSlipVehicles());
      setVehicleFeedback({
        type: 'success',
        message: 'مشخصات ماشین با موفقیت از ناوگان حذف شد.',
      });
      setTimeout(() => setVehicleFeedback(null), 3500);
    }
  };

  const filteredSavedVehicles = savedVehicles.filter((v) => {
    if (!fleetSearchQuery.trim()) return true;
    const q = fleetSearchQuery.toLowerCase();
    return (
      (v.vehicleInfo || '').toLowerCase().includes(q) ||
      (v.vehicleType || '').toLowerCase().includes(q) ||
      (v.driverName || '').toLowerCase().includes(q) ||
      (v.driverPhone || '').includes(q) ||
      (v.plateNumber || '').includes(q)
    );
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isDelivered && !receiverName.trim()) {
      setErrorMsg('لطفاً نام تحویل‌گیرنده یا راننده را مشخص فرمایید.');
      return;
    }

    // ذخیره خودکار در ناوگان در صورت فعال بودن تیک
    if (autoSaveToFleet && vehicleInfo.trim()) {
      StorageService.addOrUpdateSavedVehicle({
        vehicleInfo: vehicleInfo.trim(),
        driverName: receiverName.trim(),
        driverPhone: receiverPhone.trim(),
      });
    }

    onSave({
      isDelivered,
      deliveredAt: isDelivered ? deliveredAt : '',
      deliveredBy: isDelivered ? (deliveredBy.trim() || 'انباردار') : '',
      receiverName: receiverName.trim(),
      receiverPhone: receiverPhone.trim(),
      vehicleInfo: vehicleInfo.trim(),
      deliveryNotes: deliveryNotes.trim(),
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/65 backdrop-blur-xs">
      <div 
        id="exit-slip-delivery-modal"
        className="bg-white w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden border border-slate-200 animate-scaleUp flex flex-col max-h-[92vh]"
      >
        {/* Modal Header */}
        <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between shrink-0 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/30 border border-blue-400/30 flex items-center justify-center text-blue-400 shrink-0">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base">
                ثبت مشخصات بارگیری و تایید تحویل بار
              </h3>
              <p className="text-xs text-slate-300 mt-0.5 flex flex-wrap items-center gap-1.5">
                <span>حواله خروج شماره <strong className="text-blue-300 font-['Vazirmatn']">{toPersianDigits(invoice.invoiceNumber)}</strong></span>
                <span>•</span>
                <span>تحویل به <strong className="text-white">{invoice.customerName}</strong></span>
                {originWarehouseName && (
                  <>
                    <span>•</span>
                    <span className="text-amber-300 font-medium flex items-center gap-1">
                      <Warehouse className="w-3 h-3 text-amber-400" />
                      انبار مبدأ: {originWarehouseName}
                    </span>
                  </>
                )}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            title="بستن پنجره"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-5 overflow-y-auto space-y-3.5 text-xs">
          
          {/* Top Status Switcher Strip (Clean & Compact) */}
          <div className={`p-2.5 rounded-xl border flex flex-wrap items-center justify-between gap-2 transition-all ${
            isDelivered 
              ? 'bg-emerald-50/80 border-emerald-200 shadow-2xs' 
              : 'bg-slate-50 border-slate-200'
          }`}>
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${isDelivered ? 'bg-emerald-500 ring-2 ring-emerald-300' : 'bg-amber-400'}`} />
              <span className="font-bold text-xs text-slate-800">وضعیت تحویل:</span>
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md border ${
                isDelivered 
                  ? 'bg-emerald-100 text-emerald-800 border-emerald-300' 
                  : 'bg-amber-100 text-amber-800 border-amber-300'
              }`}>
                {isDelivered ? 'بار تحویل گردید (خروج قطعی)' : 'در انتظار تحویل و بارگیری'}
              </span>
            </div>

            {/* Delivery Toggle Button */}
            <button
              type="button"
              id="toggle-delivery-status-btn"
              onClick={() => {
                const next = !isDelivered;
                setIsDelivered(next);
                if (next && !slipLog.deliveredAt) {
                  setDeliveredAt(`${getCurrentJalaliDate()} - ساعت ${getCurrentJalaliTime()}`);
                }
              }}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all shadow-2xs cursor-pointer flex items-center gap-1.5 select-none ${
                isDelivered
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-300'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{isDelivered ? 'تایید شده (خروج قطعی)' : 'تغییر به تحویل شد'}</span>
            </button>
          </div>

          {/* Quick Invoice Goods Summary Strip */}
          <div className="bg-slate-100/70 rounded-lg px-3 py-1.5 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-600 border border-slate-200/60">
            <div className="flex items-center gap-1.5">
              <PackageCheck className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <span>اقلام: <strong className="text-slate-800 font-['Vazirmatn']">{toPersianDigits(invoice.items.length)} قلم</strong> ({toPersianDigits(totalUnits)} عدد)</span>
            </div>
            <div className="flex items-center gap-1 text-slate-600">
              <Warehouse className="w-3 h-3 text-slate-400 shrink-0" />
              <span>انبار: <strong className="text-slate-700">{originWarehouseName}</strong></span>
              {settings?.originWarehouseCode && (
                <span className="text-[10px] text-slate-400 font-mono">[{toPersianDigits(settings.originWarehouseCode)}]</span>
              )}
            </div>
          </div>

          {/* Error Message */}
          {errorMsg && (
            <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl flex items-center gap-2 text-xs">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Fields Container */}
          <div className="space-y-3">
            {/* 1 & 2. Receiver Name and Phone */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    <span>تحویل‌گیرنده / راننده</span>
                    <span className="text-rose-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setReceiverName(invoice.customerName)}
                    className="text-[10px] text-blue-600 hover:text-blue-800 hover:underline cursor-pointer flex items-center gap-0.5"
                  >
                    <Sparkles className="w-2.5 h-2.5 text-blue-500" />
                    <span>نام خریدار</span>
                  </button>
                </div>
                <input
                  type="text"
                  id="receiver-name-input"
                  placeholder="نام راننده یا مشتری"
                  value={receiverName}
                  onChange={(e) => {
                    setReceiverName(e.target.value);
                    if (errorMsg) setErrorMsg(null);
                  }}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-blue-500 transition-all text-xs font-medium text-slate-900"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    <span>شماره تماس راننده</span>
                  </label>
                  {invoice.customerPhone && (
                    <button
                      type="button"
                      onClick={() => setReceiverPhone(invoice.customerPhone || '')}
                      className="text-[10px] text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                    >
                      تلفن خریدار ({toPersianDigits(invoice.customerPhone)})
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  id="receiver-phone-input"
                  dir="ltr"
                  placeholder="۰۹۱۲۳۴۵۶۷۸۹"
                  value={receiverPhone}
                  onChange={(e) => setReceiverPhone(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-blue-500 transition-all text-xs font-['Vazirmatn'] text-left text-slate-900"
                />
              </div>
            </div>

            {/* 3. مشخصات ماشین، پلاک ملی و ثبت در ناوگان */}
            <div className="bg-slate-50/70 p-2.5 rounded-xl border border-slate-200 space-y-2">
              <div className="flex items-center justify-between flex-wrap gap-1.5">
                <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Truck className="w-3.5 h-3.5 text-blue-600" />
                  <span>مشخصات خودرو و پلاک ملی:</span>
                </label>

                {/* دکمه‌های ناوبری سریع ناوگان */}
                <div className="flex items-center gap-1 flex-wrap">
                  <button
                    type="button"
                    id="register-vehicle-btn"
                    onClick={handleRegisterVehicle}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold bg-amber-500 hover:bg-amber-600 text-white shadow-2xs transition-all cursor-pointer"
                    title="ذخیره مشخصات این خودرو در ناوگان"
                  >
                    <BookmarkPlus className="w-3 h-3" />
                    <span>ثبت خودرو</span>
                  </button>

                  <button
                    type="button"
                    id="exit-slip-manage-fleet-btn"
                    onClick={() => setIsFleetModalOpen(true)}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold bg-white hover:bg-rose-50 text-slate-700 hover:text-rose-700 border border-slate-300 hover:border-rose-300 shadow-2xs transition-all cursor-pointer"
                    title="مدیریت جامع و حذف خودروهای ثبت‌شده در ناوگان"
                  >
                    <Trash2 className="w-3 h-3 text-rose-500" />
                    <span>مدیریت و حذف خودروها</span>
                  </button>

                  <button
                    type="button"
                    id="toggle-saved-fleet-btn"
                    onClick={() => setShowSavedFleet(!showSavedFleet)}
                    className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer border ${
                      showSavedFleet
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300'
                    }`}
                    title="مشاهده فهرست خودروهای ثبت‌شده"
                  >
                    <Truck className="w-3 h-3" />
                    <span>ناوگان ({toPersianDigits(savedVehicles.length)})</span>
                    {showSavedFleet ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>
                </div>
              </div>

              {/* پیام بازخورد عملیات ثبت ماشین */}
              {vehicleFeedback && (
                <div
                  className={`p-2 rounded-lg text-[11px] flex items-center justify-between animate-fadeIn ${
                    vehicleFeedback.type === 'success'
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      : 'bg-rose-50 text-rose-800 border border-rose-200'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    {vehicleFeedback.type === 'success' ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    ) : (
                      <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                    )}
                    <span>{vehicleFeedback.message}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setVehicleFeedback(null)}
                    className="text-slate-400 hover:text-slate-700 p-0.5 cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}

              {/* انتخاب سریع از ماشین‌های پرکاربرد (چیپ‌های یک کلیکی فشرده) */}
              {!showSavedFleet && savedVehicles.length > 0 && (
                <div className="flex flex-wrap gap-1 items-center pt-0.5">
                  <span className="text-[10px] text-slate-400 font-medium ml-1">انتخاب سریع:</span>
                  {savedVehicles.slice(0, 4).map((veh) => (
                    <button
                      key={veh.id}
                      type="button"
                      onClick={() => handleSelectSavedVehicle(veh)}
                      className="inline-flex items-center gap-1 px-2 py-0.5 bg-white hover:bg-blue-50 text-slate-700 hover:text-blue-700 border border-slate-200 hover:border-blue-300 rounded-md text-[11px] font-medium transition-all shadow-2xs cursor-pointer"
                    >
                      <span className="font-bold">{veh.vehicleType}</span>
                      {veh.plateNumber && (
                        <span className="font-mono text-[9.5px] text-slate-500 bg-slate-100 px-1 py-0.2 rounded">
                          {toPersianDigits(veh.plateNumber.split(' ').slice(0, 3).join(' '))}
                        </span>
                      )}
                      {veh.driverName && (
                        <span className="text-[10px] text-slate-400">({veh.driverName})</span>
                      )}
                    </button>
                  ))}
                </div>
              )}

              {/* پنل بازشونده مدیریت ناوگان */}
              {showSavedFleet && (
                <div className="bg-white rounded-xl border border-blue-200 p-2.5 shadow-xs space-y-2 animate-fadeIn">
                  <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-1.5">
                    <span className="text-[11px] font-bold text-slate-800">فهرست ماشین‌های ثبت‌شده:</span>
                    <div className="relative w-44 sm:w-52">
                      <Search className="w-3 h-3 text-slate-400 absolute right-2 top-1.5" />
                      <input
                        type="text"
                        placeholder="جستجوی پلاک یا راننده..."
                        value={fleetSearchQuery}
                        onChange={(e) => setFleetSearchQuery(e.target.value)}
                        className="w-full pr-7 pl-2 py-0.5 text-[11px] bg-slate-50 border border-slate-200 rounded-md focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  {filteredSavedVehicles.length === 0 ? (
                    <div className="text-center py-2 text-[11px] text-slate-400">
                      {fleetSearchQuery ? 'موردی یافت نشد.' : 'هنوز خودرویی ثبت نشده است.'}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-36 overflow-y-auto pr-0.5">
                      {filteredSavedVehicles.map((veh) => (
                        <div
                          key={veh.id}
                          onClick={() => handleSelectSavedVehicle(veh)}
                          className="p-1.5 rounded-lg border border-slate-200 hover:border-blue-400 hover:bg-blue-50/40 transition-all cursor-pointer flex items-center justify-between gap-1 text-[11px]"
                        >
                          <div className="truncate">
                            <div className="flex items-center gap-1 truncate">
                              <span className="font-bold text-slate-800 truncate">{veh.vehicleType}</span>
                              {veh.driverName && <span className="text-slate-500 truncate">({veh.driverName})</span>}
                            </div>
                            {veh.plateNumber && (
                              <div className="font-mono text-[9.5px] text-slate-600 mt-0.5 truncate">
                                {toPersianDigits(veh.plateNumber)}
                              </div>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={(e) => handleDeleteSavedVehicle(veh.id, veh.vehicleInfo, e)}
                            className="text-slate-300 hover:text-rose-600 p-1 shrink-0"
                            title="حذف"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* پلاک‌خوان و فرم ساخت پلاک */}
              <IranPlatePicker
                value={vehicleInfo}
                onChange={(formatted) => setVehicleInfo(formatted)}
                customerName={invoice.customerName}
              />

              {/* تنظیم ذخیره خودکار در ناوگان */}
              <label className="flex items-center gap-1.5 cursor-pointer select-none pt-0.5">
                <input
                  type="checkbox"
                  checked={autoSaveToFleet}
                  onChange={(e) => setAutoSaveToFleet(e.target.checked)}
                  className="w-3.5 h-3.5 rounded text-blue-600 focus:ring-blue-500 border-slate-300"
                />
                <span className="text-[11px] text-slate-600">
                  ذخیره خودکار مشخصات خودرو و راننده در ناوگان برای مراجعات بعد
                </span>
              </label>
            </div>

            {/* 4. تاریخ و زمان و متصدی انبار (اگر تحویل فعال باشد) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-bold text-slate-700 flex items-center gap-1 text-xs">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span>تاریخ و زمان تحویل</span>
                  </label>
                  <button
                    type="button"
                    onClick={handleRefreshTimestamp}
                    className="text-[10px] text-blue-600 hover:underline cursor-pointer"
                  >
                    اکنون
                  </button>
                </div>
                <input
                  type="text"
                  id="delivered-at-input"
                  value={deliveredAt}
                  onChange={(e) => setDeliveredAt(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-blue-500 transition-all font-['Vazirmatn'] text-slate-800 text-xs"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 flex items-center gap-1 mb-1 text-xs">
                  <UserCheck className="w-3.5 h-3.5 text-slate-400" />
                  <span>انباردار تاییدکننده</span>
                </label>
                <input
                  type="text"
                  id="delivered-by-input"
                  placeholder="نام انباردار یا متصدی"
                  value={deliveredBy}
                  onChange={(e) => setDeliveredBy(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-blue-500 transition-all text-slate-800 text-xs"
                />
              </div>
            </div>

            {/* 5. بارنامه / یادداشت */}
            <div>
              <label className="font-bold text-slate-700 flex items-center gap-1 mb-1 text-xs">
                <FileText className="w-3.5 h-3.5 text-slate-400" />
                <span>شماره بارنامه یا توضیحات خروج</span>
              </label>
              <input
                type="text"
                id="delivery-notes-input"
                placeholder="شماره بارنامه، بیجک یا توضیحات خروج..."
                value={deliveryNotes}
                onChange={(e) => setDeliveryNotes(e.target.value)}
                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-blue-500 transition-all text-slate-800 text-xs"
              />
            </div>
          </div>

          {/* Modal Actions */}
          <div className="pt-2.5 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto px-3.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 font-bold transition-all cursor-pointer text-center text-xs"
            >
              انصراف
            </button>

            {onSaveAndPrint && (
              <button
                type="button"
                id="save-and-print-delivery-btn"
                onClick={() => {
                  if (isDelivered && !receiverName.trim()) {
                    setErrorMsg('لطفاً نام تحویل‌گیرنده یا راننده را مشخص فرمایید.');
                    return;
                  }
                  if (autoSaveToFleet && vehicleInfo.trim()) {
                    StorageService.addOrUpdateSavedVehicle({
                      vehicleInfo: vehicleInfo.trim(),
                      driverName: receiverName.trim(),
                      driverPhone: receiverPhone.trim(),
                    });
                  }
                  onSaveAndPrint({
                    isDelivered,
                    deliveredAt: isDelivered ? deliveredAt : '',
                    deliveredBy: isDelivered ? (deliveredBy.trim() || 'انباردار') : '',
                    receiverName: receiverName.trim(),
                    receiverPhone: receiverPhone.trim(),
                    vehicleInfo: vehicleInfo.trim(),
                    deliveryNotes: deliveryNotes.trim(),
                  });
                }}
                className="w-full sm:w-auto px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold transition-all shadow-xs active:scale-98 cursor-pointer flex items-center justify-center gap-1.5 text-xs"
                title="ذخیره اطلاعات و چاپ برگه خروج"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>ذخیره و چاپ حواله</span>
              </button>
            )}

            <button
              type="submit"
              id="save-delivery-details-btn"
              className="w-full sm:w-auto px-5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition-all shadow-xs active:scale-98 cursor-pointer flex items-center justify-center gap-1.5 text-xs"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>
                {isDelivered
                  ? 'ثبت و تایید قطعی تحویل'
                  : 'ذخیره مشخصات'}
              </span>
            </button>
          </div>
        </form>
      </div>

      {/* مودال جامع مدیریت و حذف خودروهای ثبت‌شده در ناوگان */}
      <VehicleFleetModal
        isOpen={isFleetModalOpen}
        onClose={() => setIsFleetModalOpen(false)}
        onSelectVehicle={(veh) => {
          handleSelectSavedVehicle(veh);
        }}
      />
    </div>
  );
};
