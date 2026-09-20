import React, { useState } from 'react';
import { 
  X, 
  ArrowDownLeft, 
  Car, 
  User, 
  Phone, 
  Calendar, 
  Clock, 
  FileText, 
  CheckCircle2, 
  AlertCircle,
  ShieldCheck,
  PackageCheck
} from 'lucide-react';
import { DirectTransfer, DirectTransferReturnRecord, StoreSettings } from '../types';
import { getCurrentJalaliDate, getCurrentJalaliTime } from '../utils/jalali';
import { IranPlatePicker } from './IranPlatePicker';

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
  if (!isOpen || !transfer) return null;

  // Initialize return quantities per item based on remaining unreturned quantity
  const [returnQtys, setReturnQtys] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    transfer.items.forEach((item) => {
      const remaining = Math.max(0, item.quantity - (item.returnedQuantity || 0));
      initial[item.id] = remaining; // Default to return full remaining
    });
    return initial;
  });

  // Returner and Vehicle State
  const [returnerName, setReturnerName] = useState<string>('');
  const [returnerPhone, setReturnerPhone] = useState<string>('');
  const [returnVehicleInfo, setReturnVehicleInfo] = useState<string>('');
  const [receivedByWarehouseUser, setReceivedByWarehouseUser] = useState<string>(() => currentUserName || settings.sellerName || 'انباردار مرکزی');
  const [returnedAtDate, setReturnedAtDate] = useState<string>(() => getCurrentJalaliDate());
  const [returnedAtTime, setReturnedAtTime] = useState<string>(() => getCurrentJalaliTime());
  const [healthStatus, setHealthStatus] = useState<'repaired' | 'healthy' | 'damaged' | 'unrepaired'>('repaired');
  const [notes, setNotes] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');

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
      setErrorMsg('لطفاً نام شخص یا راننده آورنده دستگاه به انبار را وارد نمایید.');
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
      setErrorMsg('حداقل باید تعداد بازگشتی یک قلم کالا بزرگ‌تر از صفر باشد.');
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
      notes: notes.trim() || undefined,
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/70 backdrop-blur-sm overflow-y-auto">
      <div 
        id="direct-transfer-return-modal"
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-600 to-teal-700 text-white p-4 sm:p-5 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center border border-white/20">
              <ArrowDownLeft className="w-6 h-6 text-emerald-100" />
            </div>
            <div>
              <h3 className="text-lg font-bold">ثبت بازگشت / ورود دستگاه به انبار</h3>
              <p className="text-xs text-emerald-100 mt-0.5">
                ورود به انبار پس از اتمام تعمیرات، پایان دوره امانی یا بازگشت تجهیزات به انبار
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-white/80 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 text-slate-800">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-sm flex items-center gap-2">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Transfer Summary Card */}
          <div className="bg-amber-50/60 p-3.5 rounded-xl border border-amber-200 text-xs space-y-2">
            <div className="flex items-center justify-between font-bold text-amber-900">
              <div className="flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-amber-700" />
                <span>حواله خروج مرجع: {transfer.transferNumber} - {transfer.title}</span>
              </div>
              <span className="font-mono bg-white px-2 py-0.5 rounded border border-amber-200">
                تاریخ خروج: {transfer.dispatchedAt}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-amber-800">
              <div>
                <span className="text-slate-500">تحویل‌گیرنده خروج:</span>{' '}
                <span className="font-bold">{transfer.receiverName}</span>
                {transfer.receiverPhone && <span className="font-mono mr-1">({transfer.receiverPhone})</span>}
              </div>
              <div>
                <span className="text-slate-500">ماشین خارج‌کننده:</span>{' '}
                <span className="font-bold">{transfer.dispatchVehicleInfo || 'نامشخص'}</span>
              </div>
            </div>
          </div>

          {/* Items Return Table */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-700">
                <PackageCheck className="w-4 h-4 text-emerald-600" />
                <span>شمارش و تعیین تعداد بازگشتی اقلام به انبار</span>
              </div>
              <button
                type="button"
                onClick={handleSetAllFull}
                className="text-xs text-emerald-700 hover:text-emerald-800 font-bold hover:underline"
              >
                برگشت کامل تمام اقلام
              </button>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-100 text-slate-600 border-b border-slate-200">
                  <tr>
                    <th className="p-2.5">نام دستگاه / کالا</th>
                    <th className="p-2.5 text-center">تعداد کل خروج</th>
                    <th className="p-2.5 text-center">قبلاً بازگشته</th>
                    <th className="p-2.5 text-center">مانده بیرون انبار</th>
                    <th className="p-2.5 text-center w-36">تعداد بازگشتی فعلی</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {transfer.items.map((item) => {
                    const remaining = Math.max(0, item.quantity - (item.returnedQuantity || 0));
                    const currentVal = returnQtys[item.id] !== undefined ? returnQtys[item.id] : remaining;

                    return (
                      <tr key={item.id} className="hover:bg-slate-50">
                        <td className="p-2.5">
                          <div className="font-bold text-slate-800">{item.productName}</div>
                          {item.serialNumber && (
                            <div className="text-[10px] text-amber-700 font-mono mt-0.5">
                              سریال: {item.serialNumber}
                            </div>
                          )}
                          {item.variantName && (
                            <div className="text-[10px] text-slate-400">مدل: {item.variantName}</div>
                          )}
                        </td>
                        <td className="p-2.5 text-center text-slate-600 font-bold">
                          {item.quantity} {item.unit}
                        </td>
                        <td className="p-2.5 text-center text-emerald-600 font-medium">
                          {item.returnedQuantity || 0} {item.unit}
                        </td>
                        <td className="p-2.5 text-center text-rose-600 font-bold">
                          {remaining} {item.unit}
                        </td>
                        <td className="p-2.5 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <input
                              type="number"
                              min="0"
                              max={remaining}
                              value={currentVal}
                              onChange={(e) => handleQtyChange(item.id, remaining, parseInt(e.target.value) || 0)}
                              className="w-20 bg-emerald-50/60 border border-emerald-300 rounded-lg px-2 py-1 text-center font-bold text-emerald-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                            />
                            <span className="text-[11px] text-slate-500">{item.unit}</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section: Returner & Inbound Vehicle (کسی که وارد کرده و مشخصات خودرو) */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-700 border-b border-slate-200 pb-2">
              <Car className="w-4 h-4 text-emerald-600" />
              <span>مشخصات کسی که دستگاه را وارد کرده و خودروی آورنده بار</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  نام شخص / کسی که وارد کرده: <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
                  <input
                    type="text"
                    required
                    placeholder="نام تحویل‌دهنده، تعمیرکار یا راننده آورنده"
                    value={returnerName}
                    onChange={(e) => setReturnerName(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl pr-9 pl-3 py-2 text-sm font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  شماره تماس کسی که وارد کرده:
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
                  <input
                    type="tel"
                    dir="ltr"
                    placeholder="0912..."
                    value={returnerPhone}
                    onChange={(e) => setReturnerPhone(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl pr-9 pl-3 py-2 text-sm font-mono text-right focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  انباردار تحویل‌گیرنده در انبار:
                </label>
                <input
                  type="text"
                  value={receivedByWarehouseUser}
                  onChange={(e) => setReceivedByWarehouseUser(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Return Vehicle & Plate */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                مشخصات ماشین و پلاک کسی که وارد کرده:
              </label>
              <IranPlatePicker
                value={returnVehicleInfo}
                onChange={setReturnVehicleInfo}
                placeholder="نوع خودرو (مثلاً وانت مزدا، وانت آریسان، پراید) و شماره پلاک"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  وضعیت سلامت و فنی دستگاه:
                </label>
                <select
                  value={healthStatus}
                  onChange={(e) => setHealthStatus(e.target.value as any)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                >
                  <option value="repaired">✅ تعمیر شده، تست‌شده و کاملاً سالم</option>
                  <option value="healthy">🌟 سالم و بدون نقص (بازگشت امانی)</option>
                  <option value="unrepaired">⚠️ غیرقابل تعمیر یا تعمیر نشده</option>
                  <option value="damaged">❌ دارای نقص یا آسیب‌دیدگی ظاهری</option>
                </select>
              </div>

              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    تاریخ ورود:
                  </label>
                  <div className="relative">
                    <Calendar className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
                    <input
                      type="text"
                      value={returnedAtDate}
                      onChange={(e) => setReturnedAtDate(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl pr-9 pl-2 py-2 text-xs font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>
                <div className="w-24">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    ساعت:
                  </label>
                  <div className="relative">
                    <Clock className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
                    <input
                      type="text"
                      value={returnedAtTime}
                      onChange={(e) => setReturnedAtTime(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl pr-8 pl-1 py-2 text-xs font-mono text-center focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  گزارش فنی یا یادداشت تحویل:
                </label>
                <input
                  type="text"
                  placeholder="مثلاً: بلبرینگ تعویض شد و کارکرد روان است"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="border-t border-slate-200 pt-4 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-xs text-slate-500 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>موجودی اقلام به انبار بازگردانده شده و گردش ورود در کاردکس ثبت خواهد شد.</span>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-600 hover:bg-slate-100 font-medium text-xs transition-colors flex-1 sm:flex-none"
              >
                انصراف
              </button>
              <button
                type="submit"
                className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-1.5 flex-1 sm:flex-none"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>ثبت قطعی ورود به انبار</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
