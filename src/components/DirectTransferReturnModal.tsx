import React, { useState, useEffect } from 'react';
import {
  X,
  ArrowDownLeft,
  Car,
  User,
  Phone,
  Clock,
  FileText,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  PackageCheck,
  Truck,
  RotateCcw,
  Search,
  Trash2,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { DirectTransfer, DirectTransferReturnRecord, StoreSettings, SavedVehicle } from '../types';
import { getCurrentJalaliDate, getCurrentJalaliTime, toPersianDigits } from '../utils/jalali';
import { StorageService } from '../utils/storage';
import { IranPlatePicker } from './IranPlatePicker';
import { VehicleFleetModal } from './VehicleFleetModal';
import { NumericInput } from './NumericInput';
import { JalaliDatePicker } from './JalaliDatePicker';

interface DirectTransferReturnModalProps {
  isOpen: boolean;
  onClose: () => void;
  transfer: DirectTransfer | null;
  settings: StoreSettings;
  currentUserName?: string;
  onSaveReturn: (
    transferId: string,
    returnData: Omit<DirectTransferReturnRecord, 'id'>
  ) => void;
}

export const DirectTransferReturnModal: React.FC<DirectTransferReturnModalProps> = ({
  isOpen,
  onClose,
  transfer,
  settings,
  currentUserName,
  onSaveReturn,
}) => {
  const [returnQtys, setReturnQtys] = useState<Record<string, number>>({});

  useEffect(() => {
    if (isOpen && transfer?.items) {
      const initial: Record<string, number> = {};
      transfer.items.forEach((item) => {
        const remaining = Math.max(0, item.quantity - (item.returnedQuantity || 0));
        initial[item.id] = remaining;
      });
      setReturnQtys(initial);
    }
  }, [isOpen, transfer]);

  const [returnerName, setReturnerName] = useState<string>('');
  const [returnerPhone, setReturnerPhone] = useState<string>('');
  const [returnVehicleInfo, setReturnVehicleInfo] = useState<string>('');
  const [receivedByWarehouseUser, setReceivedByWarehouseUser] = useState<string>(
    () => currentUserName || settings.sellerName || 'انباردار مرکزی'
  );
  const [returnedAtDate, setReturnedAtDate] = useState<string>(() => getCurrentJalaliDate());
  const [returnedAtTime, setReturnedAtTime] = useState<string>(() => getCurrentJalaliTime());
  const [healthStatus, setHealthStatus] = useState<
    'repaired' | 'healthy' | 'damaged' | 'unrepaired' | 'scrapped'
  >(() => (transfer?.type === 'repair' ? 'repaired' : 'healthy'));
  const [repairCost, setRepairCost] = useState<number>(0);
  const [notes, setNotes] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');

  const [savedVehicles, setSavedVehicles] = useState<Array<SavedVehicle & { sourceLabel?: string }>>(
    () => StorageService.getExitSlipVehicles()
  );
  const [showSavedFleet, setShowSavedFleet] = useState<boolean>(false);
  const [isFleetModalOpen, setIsFleetModalOpen] = useState<boolean>(false);
  const [fleetSearchQuery, setFleetSearchQuery] = useState<string>('');
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  useEffect(() => {
    const unsub = StorageService.subscribe(() => {
      setSavedVehicles(StorageService.getExitSlipVehicles());
    });
    return () => unsub();
  }, []);

  if (!isOpen || !transfer) return null;

  const handleDeleteSavedVehicle = (id: string, vehicleInfo?: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (window.confirm('آیا از حذف این خودرو از فهرست ناوگان اطمینان دارید؟')) {
      StorageService.deleteSavedVehicle(id, vehicleInfo);
      setSavedVehicles(StorageService.getExitSlipVehicles());
    }
  };

  const handleUseOriginalDispatchVehicle = () => {
    if (transfer.dispatchVehicleInfo) {
      setReturnVehicleInfo(transfer.dispatchVehicleInfo);
    }
    if (transfer.receiverName) {
      setReturnerName(transfer.receiverName);
    }
    if (transfer.receiverPhone) {
      setReturnerPhone(transfer.receiverPhone);
    }
    setFeedbackMsg('مشخصات راننده و خودروی خروج اولیه جایگذاری شد.');
    setTimeout(() => setFeedbackMsg(null), 3500);
  };

  const handleSelectFleetVehicle = (veh: SavedVehicle & { sourceLabel?: string }) => {
    setReturnVehicleInfo(veh.vehicleInfo);
    if (veh.driverName) setReturnerName(veh.driverName);
    if (veh.driverPhone) setReturnerPhone(veh.driverPhone);
    setShowSavedFleet(false);
    setFeedbackMsg(`مشخصات خودرو «${veh.vehicleType}» جایگذاری شد.`);
    setTimeout(() => setFeedbackMsg(null), 3500);
  };

  const handleQtyChange = (itemId: string, maxRemaining: number, val: number) => {
    const safeVal = Math.min(maxRemaining, Math.max(0, val));
    setReturnQtys((prev) => ({
      ...prev,
      [itemId]: safeVal,
    }));
  };

  const handleSetAllFull = () => {
    const updated: Record<string, number> = {};
    transfer.items.forEach((item) => {
      const remaining = Math.max(0, item.quantity - (item.returnedQuantity || 0));
      updated[item.id] = remaining;
    });
    setReturnQtys(updated);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!returnerName.trim()) {
      setErrorMsg('لطفاً نام تحویل‌دهنده یا راننده آورنده کالا به انبار را وارد نمایید.');
      return;
    }

    const itemsReturned = transfer.items
      .map((item) => ({
        itemId: item.id,
        productId: item.productId,
        productName: item.productName,
        quantity: returnQtys[item.id] || 0,
      }))
      .filter((i) => i.quantity > 0);

    if (itemsReturned.length === 0) {
      setErrorMsg('حداقل باید تعداد بازگشتی یک قلم بزرگ‌تر از صفر باشد.');
      return;
    }

    const returnedAt = `${returnedAtDate} - ${returnedAtTime}`;

    onSaveReturn(transfer.id, {
      returnedAt,
      receivedByWarehouseUser: receivedByWarehouseUser.trim() || 'انباردار',
      returnerName: returnerName.trim(),
      returnerPhone: returnerPhone.trim() || undefined,
      returnVehicleInfo: returnVehicleInfo.trim() || undefined,
      itemsReturned,
      healthStatus,
      repairCost: repairCost > 0 ? repairCost : undefined,
      notes: notes.trim() || undefined,
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/70 backdrop-blur-xs overflow-y-auto">
      <div
        id="direct-transfer-return-modal"
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl max-h-[94vh] flex flex-col overflow-hidden my-auto"
      >
        {/* Header */}
        <div className="bg-slate-900 text-white px-4 sm:px-6 py-4 flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30 shrink-0">
              <ArrowDownLeft className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-black">
                ثبت ورود و بازگشت کالا / دستگاه به انبار
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                برگه مرجع: {toPersianDigits(transfer.transferNumber)} — {transfer.title}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 text-slate-800">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-bold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Transfer Reference Summary */}
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-slate-700">
              <FileText className="w-4 h-4 text-amber-600 shrink-0" />
              <span>تحویل‌گیرنده خروج: <strong className="text-slate-900">{transfer.receiverName}</strong></span>
              {transfer.receiverPhone && (
                <span className="font-mono text-slate-500">({toPersianDigits(transfer.receiverPhone)})</span>
              )}
            </div>
            <div className="flex items-center gap-3 text-slate-500 font-mono text-[11px]">
              <span>تاریخ خروج: {toPersianDigits(transfer.dispatchedAt)}</span>
              {transfer.expectedReturnDate && (
                <span>· موعد: {toPersianDigits(transfer.expectedReturnDate)}</span>
              )}
            </div>
          </div>

          {/* Items Return Table */}
          <div className="bg-slate-50/80 p-4 rounded-2xl border border-slate-200/90 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
              <div className="flex items-center gap-2 text-xs sm:text-sm font-black text-slate-800">
                <PackageCheck className="w-4 h-4 text-emerald-600" />
                <span>۱. شمارش و تعیین تعداد بازگشتی به انبار</span>
              </div>
              <button
                type="button"
                onClick={handleSetAllFull}
                className="text-xs text-emerald-700 hover:text-emerald-800 font-bold hover:underline cursor-pointer"
              >
                انتخاب کل مانده اقلام
              </button>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-100 text-slate-700 border-b border-slate-200 font-bold">
                  <tr>
                    <th className="p-2.5">نام کالا / دستگاه</th>
                    <th className="p-2.5 text-center">تعداد خروج</th>
                    <th className="p-2.5 text-center">برگشتی قبلی</th>
                    <th className="p-2.5 text-center">مانده بیرون</th>
                    <th className="p-2.5 text-center w-36">تعداد ورود فعلی</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {transfer.items.map((item) => {
                    const remaining = Math.max(0, item.quantity - (item.returnedQuantity || 0));
                    const currentVal =
                      returnQtys[item.id] !== undefined ? returnQtys[item.id] : remaining;

                    return (
                      <tr key={item.id} className="hover:bg-slate-50/80">
                        <td className="p-2.5">
                          <div className="font-bold text-slate-900">{item.productName}</div>
                          <div className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-2">
                            {item.serialNumber && (
                              <span className="font-mono text-amber-700">سریال: {item.serialNumber}</span>
                            )}
                            {item.variantName && <span>مدل: {item.variantName}</span>}
                          </div>
                        </td>
                        <td className="p-2.5 text-center text-slate-600 font-mono font-bold">
                          {toPersianDigits(item.quantity)} {item.unit}
                        </td>
                        <td className="p-2.5 text-center text-emerald-700 font-mono font-medium">
                          {toPersianDigits(item.returnedQuantity || 0)} {item.unit}
                        </td>
                        <td className="p-2.5 text-center text-amber-700 font-mono font-bold">
                          {toPersianDigits(remaining)} {item.unit}
                        </td>
                        <td className="p-2.5 text-center">
                          {remaining > 0 ? (
                            <div className="flex items-center justify-center gap-1">
                              <div className="w-20">
                                <NumericInput
                                  min={0}
                                  max={remaining}
                                  value={currentVal}
                                  onChange={(num) => handleQtyChange(item.id, remaining, num)}
                                  textAlign="center"
                                  className="w-full bg-emerald-50/60 border border-emerald-300 rounded-lg px-2 py-1 text-center font-bold font-mono text-emerald-900 focus:ring-2 focus:ring-emerald-500/30 focus:outline-none"
                                />
                              </div>
                              <span className="text-[11px] text-slate-500">{item.unit}</span>
                            </div>
                          ) : (
                            <span className="text-[11px] text-emerald-600 font-bold">تکمیل شده</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 2: Returner & Inbound Vehicle */}
          <div className="bg-slate-50/80 p-4 rounded-2xl border border-slate-200/90 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200/80 pb-2 flex-wrap gap-2">
              <div className="flex items-center gap-2 text-xs sm:text-sm font-black text-slate-800">
                <Car className="w-4 h-4 text-emerald-600" />
                <span>۲. مشخصات آورنده، خودرو و وضعیت سلامت</span>
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={handleUseOriginalDispatchVehicle}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition-all cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>کپی مشخصات راننده و خودروی خروج</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsFleetModalOpen(true)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 transition-all cursor-pointer"
                >
                  <Truck className="w-3.5 h-3.5 text-slate-500" />
                  <span>مدیریت ناوگان</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowSavedFleet(!showSavedFleet)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer border ${
                    showSavedFleet
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300'
                  }`}
                >
                  <span>خودروها ({toPersianDigits(savedVehicles.length)})</span>
                  {showSavedFleet ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>
              </div>
            </div>

            {feedbackMsg && (
              <div className="p-2.5 rounded-xl text-xs bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="font-medium">{feedbackMsg}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setFeedbackMsg(null)}
                  className="text-slate-400 hover:text-slate-700 p-0.5 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {showSavedFleet && (
              <div className="bg-white rounded-xl border border-emerald-300 p-3 shadow-xs space-y-2.5">
                <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2">
                  <span className="text-xs font-bold text-slate-800">انتخاب از خودروهای ناوگان:</span>
                  <div className="relative w-52">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-2" />
                    <input
                      type="text"
                      placeholder="جستجوی پلاک یا راننده..."
                      value={fleetSearchQuery}
                      onChange={(e) => setFleetSearchQuery(e.target.value)}
                      className="w-full pr-8 pl-2.5 py-1 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-44 overflow-y-auto">
                  {savedVehicles
                    .filter((v) => {
                      if (!fleetSearchQuery.trim()) return true;
                      const q = fleetSearchQuery.toLowerCase();
                      return (
                        (v.vehicleInfo || '').toLowerCase().includes(q) ||
                        (v.vehicleType || '').toLowerCase().includes(q) ||
                        (v.driverName || '').toLowerCase().includes(q) ||
                        (v.plateNumber || '').includes(q)
                      );
                    })
                    .map((veh) => (
                      <div
                        key={veh.id}
                        onClick={() => handleSelectFleetVehicle(veh)}
                        className="p-2 rounded-xl border border-slate-200 hover:border-emerald-400 hover:bg-emerald-50/40 transition-all cursor-pointer flex items-center justify-between gap-2 text-xs"
                      >
                        <div className="truncate flex-1">
                          <div className="font-bold text-slate-800 truncate">{veh.vehicleType}</div>
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            {veh.driverName && <span>راننده: {veh.driverName} </span>}
                            {veh.plateNumber && (
                              <span className="font-mono text-emerald-800 font-bold">
                                ({toPersianDigits(veh.plateNumber)})
                              </span>
                            )}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => handleDeleteSavedVehicle(veh.id, veh.vehicleInfo, e)}
                          className="text-slate-300 hover:text-rose-600 p-1.5 rounded-lg cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  نام تحویل‌دهنده / آورنده به انبار: <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
                  <input
                    type="text"
                    required
                    placeholder="نام شخص یا راننده آورنده"
                    value={returnerName}
                    onChange={(e) => setReturnerName(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl pr-9 pl-3 py-2 text-xs sm:text-sm font-bold focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  شماره تماس آورنده:
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
                  <input
                    type="tel"
                    dir="ltr"
                    placeholder="0912..."
                    value={returnerPhone}
                    onChange={(e) => setReturnerPhone(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl pr-9 pl-3 py-2 text-xs sm:text-sm font-mono text-right focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  انباردار تحویل‌گیرنده:
                </label>
                <input
                  type="text"
                  value={receivedByWarehouseUser}
                  onChange={(e) => setReceivedByWarehouseUser(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs sm:text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Return Vehicle & Plate */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                مشخصات خودرو و پلاک آورنده:
              </label>
              <IranPlatePicker
                value={returnVehicleInfo}
                onChange={setReturnVehicleInfo}
                placeholder="نوع خودرو و شماره پلاک آورنده بار"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 pt-1 items-end">
              <div className="sm:col-span-5">
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  وضعیت سلامت پس از بازگشت:
                </label>
                <select
                  value={healthStatus}
                  onChange={(e) => setHealthStatus(e.target.value as any)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-none"
                >
                  <option value="repaired">تعمیر شده، تست‌شده و سالم (افزایش موجودی)</option>
                  <option value="healthy">سالم و بدون نقص - بازگشت امانی (افزایش موجودی)</option>
                  <option value="unrepaired">غیرقابل تعمیر / تعمیر نشده (بازگشت به انبار)</option>
                  <option value="damaged">دارای نقص یا آسیب‌دیدگی (بازگشت به انبار)</option>
                  <option value="scrapped">اسقاط / غیرقابل بازگشت به موجودی فروش</option>
                </select>
              </div>

              <div className="sm:col-span-3">
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  هزینه تعمیر / سرویس ({settings.currency}):
                </label>
                <NumericInput
                  min={0}
                  value={repairCost}
                  onChange={(val) => setRepairCost(val)}
                  placeholder="۰ (اختیاری)"
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div className="sm:col-span-4 flex gap-2 items-end">
                <div className="flex-1">
                  <JalaliDatePicker
                    label="تاریخ ورود:"
                    value={returnedAtDate}
                    onChange={setReturnedAtDate}
                  />
                </div>
                <div className="w-24">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    ساعت:
                  </label>
                  <div className="relative">
                    <Clock className="w-3.5 h-3.5 text-slate-400 absolute right-2 top-2.5" />
                    <input
                      type="text"
                      value={returnedAtTime}
                      onChange={(e) => setReturnedAtTime(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl pr-7 pl-1.5 py-2 text-xs font-mono text-center focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                گزارش فنی تعمیرات یا توضیحات تحویل در انبار:
              </label>
              <input
                type="text"
                placeholder="مثلاً: بلبرینگ و سیم‌پیچ تعویض شد و دستگاه با سلامت کامل تحویل انبار گردید"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Footer Actions */}
          <div className="border-t border-slate-200 pt-4 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-xs text-slate-500 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                {healthStatus === 'scrapped'
                  ? 'اقلام به عنوان اسقاط ثبت شده و به موجودی قابل فروش انبار اضافه نمی‌شوند.'
                  : 'موجودی کالاهای انباری بازگردانده شده و سند ورود در کاردکس ثبت می‌شود.'}
              </span>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 font-bold text-xs transition-colors flex-1 sm:flex-none cursor-pointer"
              >
                انصراف
              </button>
              <button
                type="submit"
                className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm transition-all flex items-center justify-center gap-1.5 flex-1 sm:flex-none cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>ثبت قطعی بازگشت به انبار</span>
              </button>
            </div>
          </div>
        </form>
      </div>

      <VehicleFleetModal
        isOpen={isFleetModalOpen}
        onClose={() => setIsFleetModalOpen(false)}
        onSelectVehicle={(veh) => handleSelectFleetVehicle(veh)}
      />
    </div>
  );
};
