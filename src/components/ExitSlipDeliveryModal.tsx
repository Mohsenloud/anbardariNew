import React, { useState, useEffect } from 'react';
import { Invoice, ExitSlipData, AppUser, StoreSettings } from '../types';
import { getCurrentJalaliDate, getCurrentJalaliTime, toPersianDigits } from '../utils/jalali';
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
  MapPin
} from 'lucide-react';
import { IranPlatePicker } from './IranPlatePicker';

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isDelivered && !receiverName.trim()) {
      setErrorMsg('لطفاً نام تحویل‌گیرنده یا راننده را مشخص فرمایید.');
      return;
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
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 overflow-y-auto space-y-5 text-xs">
          
          {/* Top Status Switcher Banner */}
          <div className={`p-4 rounded-2xl border transition-all ${
            isDelivered 
              ? 'bg-emerald-50/90 border-emerald-300 shadow-xs' 
              : 'bg-amber-50/70 border-amber-200 shadow-xs'
          }`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  isDelivered 
                    ? 'bg-emerald-600 text-white shadow-xs' 
                    : 'bg-amber-500 text-white shadow-xs'
                }`}>
                  {isDelivered ? <CheckCircle2 className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
                </div>
                <div className="space-y-0.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-sm text-slate-900">
                      وضعیت تحویل بار از انبار:
                    </span>
                    <span className={`px-2.5 py-0.5 rounded-full font-bold text-xs border ${
                      isDelivered 
                        ? 'bg-emerald-100 text-emerald-800 border-emerald-300' 
                        : 'bg-amber-100 text-amber-800 border-amber-300'
                    }`}>
                      {isDelivered ? 'بار تحویل گردید (خروج قطعی)' : 'در انتظار تحویل و بارگیری'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    {isDelivered
                      ? 'با تایید این بخش، انباردار گواهی می‌دهد اقلام فیزیکی تحویل راننده یا مشتری شده است.'
                      : 'این حواله در لیست انبار به عنوان «در انتظار تحویل» نمایش داده می‌شود.'}
                  </p>
                </div>
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
                className={`px-4 py-2.5 rounded-xl font-bold transition-all shadow-xs cursor-pointer flex items-center justify-center gap-2 shrink-0 select-none ${
                  isDelivered
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-700/20'
                    : 'bg-white hover:bg-amber-100 text-amber-900 border border-amber-300 hover:border-amber-400'
                }`}
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{isDelivered ? 'تایید شده (بار تحویل شد)' : 'تغییر به وضعیت تحویل شد'}</span>
              </button>
            </div>
          </div>

          {/* Quick Invoice Goods Summary */}
          <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-600">
            <div className="flex items-center gap-2">
              <PackageCheck className="w-4 h-4 text-blue-600" />
              <span>اقلام حواله خروج:</span>
              <strong className="text-slate-800 font-['Vazirmatn']">
                {toPersianDigits(invoice.items.length)} قلم کالا
              </strong>
              <span>معادل</span>
              <strong className="text-emerald-700 font-bold font-['Vazirmatn']">
                {toPersianDigits(totalUnits)} واحد فیزیکی
              </strong>
            </div>
            <div className="flex items-center gap-1.5 text-slate-600 font-medium">
              <Warehouse className="w-3.5 h-3.5 text-slate-400" />
              <span>انبار مبدأ: <strong className="text-slate-800">{originWarehouseName}</strong></span>
              {settings?.originWarehouseCode && (
                <span className="text-[10px] text-slate-400 font-mono">[{toPersianDigits(settings.originWarehouseCode)}]</span>
              )}
            </div>
          </div>

          {/* Error Message */}
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl flex items-center gap-2 text-xs">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Fields Grid */}
          <div className="space-y-4">
            {/* 1 & 2. Receiver Name and Phone (Compact 2-Column Grid) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-slate-500" />
                    <span>تحویل‌گیرنده / راننده</span>
                    <span className="text-rose-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setReceiverName(invoice.customerName)}
                    className="text-[10px] text-blue-600 hover:text-blue-800 hover:underline cursor-pointer flex items-center gap-0.5"
                  >
                    <Sparkles className="w-3 h-3 text-blue-500" />
                    <span>درج نام خریدار</span>
                  </button>
                </div>
                <input
                  type="text"
                  id="receiver-name-input"
                  placeholder="مثال: رضا احمدی یا نام خریدار"
                  value={receiverName}
                  onChange={(e) => {
                    setReceiverName(e.target.value);
                    if (errorMsg) setErrorMsg(null);
                  }}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-xs sm:text-sm font-medium text-slate-900"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-slate-500" />
                    <span>شماره تماس راننده / تحویل‌گیرنده</span>
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
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-xs sm:text-sm font-['Vazirmatn'] text-left text-slate-900"
                />
              </div>
            </div>

            {/* 3. Vehicle Specifications & Plate (Selectable Fields) */}
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1.5 flex items-center gap-1.5">
                <Truck className="w-3.5 h-3.5 text-blue-600" />
                <span>مشخصات ماشین و پلاک ملی حمل‌کننده:</span>
              </label>
              <IranPlatePicker
                value={vehicleInfo}
                onChange={(formatted) => setVehicleInfo(formatted)}
                customerName={invoice.customerName}
              />
            </div>

            {/* 4. Delivery Date/Time & Confirmed By Storekeeper */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="font-bold text-slate-700 flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-slate-400" />
                    <span>تاریخ و زمان تایید تحویل بار</span>
                  </label>
                  <button
                    type="button"
                    onClick={handleRefreshTimestamp}
                    className="text-[10px] text-blue-600 hover:underline cursor-pointer"
                  >
                    زمان جاری
                  </button>
                </div>
                <input
                  type="text"
                  id="delivered-at-input"
                  value={deliveredAt}
                  onChange={(e) => setDeliveredAt(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-['Vazirmatn'] text-slate-800 text-xs"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 flex items-center gap-1.5 mb-1.5">
                  <UserCheck className="w-4 h-4 text-slate-400" />
                  <span>انباردار تاییدکننده تحویل</span>
                </label>
                <input
                  type="text"
                  id="delivered-by-input"
                  placeholder="نام انباردار یا متصدی تحویل"
                  value={deliveredBy}
                  onChange={(e) => setDeliveredBy(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-slate-800 text-xs"
                />
              </div>
            </div>

            {/* 5. Notes & Waybill */}
            <div>
              <label className="font-bold text-slate-700 flex items-center gap-1.5 mb-1.5">
                <FileText className="w-4 h-4 text-slate-400" />
                <span>شماره بارنامه، گیت خروج یا یادداشت تحویل</span>
              </label>
              <textarea
                rows={2}
                id="delivery-notes-input"
                placeholder="در صورت وجود شماره بارنامه، بیجک، نام باربری یا توضیحات تکمیلی وارد فرمایید..."
                value={deliveryNotes}
                onChange={(e) => setDeliveryNotes(e.target.value)}
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-slate-800 resize-none"
              />
            </div>
          </div>

          {/* Modal Actions */}
          <div className="pt-3 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 font-bold transition-all cursor-pointer text-center text-xs"
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
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold transition-all shadow-md active:scale-95 cursor-pointer flex items-center justify-center gap-1.5 text-xs"
                title="ذخیره اطلاعات و باز کردن پنجره چاپ برگه خروج"
              >
                <Printer className="w-4 h-4" />
                <span>ذخیره و چاپ برگه خروج</span>
              </button>
            )}

            <button
              type="submit"
              id="save-delivery-details-btn"
              className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition-all shadow-md active:scale-95 cursor-pointer flex items-center justify-center gap-2 text-xs"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>
                {isDelivered
                  ? 'ثبت و تایید قطعی تحویل بار'
                  : 'ذخیره مشخصات راننده و خودرو'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
