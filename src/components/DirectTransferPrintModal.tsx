import React, { useRef } from 'react';
import { 
  X, 
  Printer, 
  Car, 
  User, 
  Phone, 
  Calendar, 
  Clock, 
  FileText, 
  CheckCircle2, 
  Share2,
  Building2,
  ShieldCheck,
  Wrench
} from 'lucide-react';
import { DirectTransfer, StoreSettings } from '../types';

interface DirectTransferPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  transfer: DirectTransfer | null;
  settings: StoreSettings;
}

export const DirectTransferPrintModal: React.FC<DirectTransferPrintModalProps> = ({
  isOpen,
  onClose,
  transfer,
  settings,
}) => {
  const printContentRef = useRef<HTMLDivElement>(null);

  if (!isOpen || !transfer) return null;

  const handlePrint = () => {
    window.print();
  };

  const getTypeBadge = () => {
    switch (transfer.type) {
      case 'repair':
        return { label: 'اعزام به تعمیرگاه و سرویس فنی', color: 'bg-amber-100 text-amber-800 border-amber-300' };
      case 'temporary_loan':
        return { label: 'خروج امانی و تست کالا', color: 'bg-blue-100 text-blue-800 border-blue-300' };
      case 'internal_use':
        return { label: 'مصرف داخلی و کارگاه', color: 'bg-slate-100 text-slate-800 border-slate-300' };
      case 'sample':
        return { label: 'نمونه‌گیری و آزمایشگاهی', color: 'bg-purple-100 text-purple-800 border-purple-300' };
      default:
        return { label: 'خروج مستقیم بدون فاکتور', color: 'bg-slate-100 text-slate-800 border-slate-300' };
    }
  };

  const getStatusBadge = () => {
    switch (transfer.status) {
      case 'dispatched':
        return { label: 'خارج از انبار (در جریان)', color: 'bg-amber-500 text-white' };
      case 'partially_returned':
        return { label: 'بخشی بازگشته به انبار', color: 'bg-indigo-500 text-white' };
      case 'returned':
        return { label: 'به طور کامل به انبار بازگشت', color: 'bg-emerald-600 text-white' };
      case 'completed_no_return':
        return { label: 'مختومه (بدون نیاز به بازگشت)', color: 'bg-slate-600 text-white' };
    }
  };

  const typeInfo = getTypeBadge();
  const statusInfo = getStatusBadge();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/75 backdrop-blur-sm overflow-y-auto print:p-0 print:bg-white print:static">
      <div 
        id="direct-transfer-print-modal"
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[95vh] flex flex-col overflow-hidden my-auto print:max-h-none print:w-full print:shadow-none print:border-none print:rounded-none"
      >
        {/* Actions Bar (Hidden in Print) */}
        <div className="bg-slate-900 text-white px-3 sm:px-4 py-2.5 sm:py-3 flex flex-wrap items-center justify-between gap-2 shadow-sm print:hidden shrink-0 border-b border-slate-800">
          <div className="flex items-center gap-2 min-w-0">
            <Printer className="w-5 h-5 text-amber-400 shrink-0" />
            <span className="text-xs sm:text-sm font-bold truncate">پیش‌نمایش چاپ برگه خروج و ورود انبار</span>
            <span className="text-xs text-slate-400 font-mono hidden sm:inline">({transfer.transferNumber})</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 sm:px-4 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl text-xs transition-all shadow cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>چاپ رسمی</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Document Canvas */}
        <div ref={printContentRef} className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-6 text-slate-900 bg-white font-sans text-xs sm:text-sm print:p-4 print:space-y-4">
          
          {/* Header of the Official Slip */}
          <div className="border-b-2 border-slate-800 pb-4">
            <div className="flex items-start justify-between">
              {/* Store & Warehouse Identity */}
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Building2 className="w-6 h-6 text-amber-600 print:text-black" />
                  <h1 className="text-lg sm:text-xl font-black tracking-tight text-slate-900">
                    {settings.storeName || 'مجموعه صنعتی و بازرگانی'}
                  </h1>
                </div>
                <p className="text-xs text-slate-500 font-medium">
                  حواله خروج و ورود مستقیم انبار (امانی / تعمیرات / سرویس فنی)
                </p>
                {transfer.warehouseName && (
                  <p className="text-[11px] text-slate-600">
                    انبار مبدأ: <span className="font-bold">{transfer.warehouseName}</span>
                  </p>
                )}
              </div>

              {/* Number, Date & Badges */}
              <div className="text-left space-y-1">
                <div className="flex items-center justify-end gap-1.5">
                  <span className="text-xs text-slate-500">شماره حواله:</span>
                  <span className="font-bold text-base font-mono text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-300">
                    {transfer.transferNumber}
                  </span>
                </div>
                <div className="flex items-center justify-end gap-1.5 text-xs text-slate-600">
                  <span>تاریخ خروج:</span>
                  <span className="font-bold font-mono">{transfer.dispatchedAt}</span>
                </div>
                <div className="flex items-center justify-end gap-2 pt-1">
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${typeInfo.color}`}>
                    {typeInfo.label}
                  </span>
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${statusInfo.color}`}>
                    {statusInfo.label}
                  </span>
                </div>
              </div>
            </div>

            {/* Title & Subject */}
            <div className="mt-3 pt-2.5 border-t border-dashed border-slate-300 flex items-center justify-between text-xs">
              <div>
                <span className="text-slate-500 font-semibold">موضوع حواله:</span>{' '}
                <span className="font-bold text-slate-900">{transfer.title}</span>
              </div>
              {transfer.expectedReturnDate && (
                <div>
                  <span className="text-slate-500">موعد احتمالی بازگشت:</span>{' '}
                  <span className="font-bold text-amber-800 font-mono">{transfer.expectedReturnDate}</span>
                </div>
              )}
            </div>
          </div>

          {/* Table of Items */}
          <div>
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 mb-2">
              <FileText className="w-4 h-4 text-amber-600" />
              <span>مشخصات تجهیزات، ماشین‌آلات و اقلام خروجی:</span>
            </div>
            <div className="border border-slate-300 rounded-xl overflow-hidden">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-100 text-slate-800 border-b border-slate-300 font-bold">
                  <tr>
                    <th className="p-2.5 text-center w-12">ردیف</th>
                    <th className="p-2.5">نام کالا / دستگاه</th>
                    <th className="p-2.5">مدل / تنوع</th>
                    <th className="p-2.5 font-mono">شماره سریال / پلاک</th>
                    <th className="p-2.5 text-center w-24">تعداد خروج</th>
                    <th className="p-2.5 text-center w-24">تعداد بازگشته</th>
                    <th className="p-2.5">شرح عیب ظاهری یا علت خروج</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {transfer.items.map((item, idx) => (
                    <tr key={item.id} className="hover:bg-slate-50">
                      <td className="p-2.5 text-center font-bold text-slate-500">{idx + 1}</td>
                      <td className="p-2.5 font-bold text-slate-900">
                        {item.productName}
                        <span className="text-[10px] text-slate-400 block font-mono">کد: {item.productCode}</span>
                      </td>
                      <td className="p-2.5 text-slate-600">{item.variantName || '-'}</td>
                      <td className="p-2.5 font-mono font-bold text-slate-800">{item.serialNumber || '-'}</td>
                      <td className="p-2.5 text-center font-bold text-amber-800">
                        {item.quantity} {item.unit}
                      </td>
                      <td className="p-2.5 text-center font-bold text-emerald-700">
                        {item.returnedQuantity || 0} {item.unit}
                      </td>
                      <td className="p-2.5 text-slate-600">{item.notes || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Specifications Box: Dispatch & Return Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            {/* Box 1: Dispatch (مشخصات خروج) */}
            <div className="border border-amber-300 rounded-xl p-3.5 bg-amber-50/40 space-y-2 text-xs">
              <div className="flex items-center gap-1.5 font-bold text-amber-900 border-b border-amber-200 pb-1.5">
                <Car className="w-4 h-4 text-amber-700" />
                <span>۱. مشخصات راننده و خودروی خارج‌کننده بار</span>
              </div>
              <div className="space-y-1.5 text-slate-800">
                <div className="flex justify-between">
                  <span className="text-slate-500">تحویل‌گیرنده / راننده خروج:</span>
                  <span className="font-bold">{transfer.receiverName}</span>
                </div>
                {transfer.receiverPhone && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">شماره تماس راننده:</span>
                    <span className="font-mono font-bold">{transfer.receiverPhone}</span>
                  </div>
                )}
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">مشخصات ماشین و پلاک:</span>
                  <span className="font-bold text-amber-900 bg-white px-2 py-0.5 rounded border border-amber-200">
                    {transfer.dispatchVehicleInfo || 'نامشخص'}
                  </span>
                </div>
                {transfer.destination && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">مقصد / کارگاه / تعمیرگاه:</span>
                    <span className="font-medium">{transfer.destination}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-slate-500">انباردار خارج‌کننده:</span>
                  <span className="font-medium">{transfer.dispatchedBy}</span>
                </div>
                {transfer.dispatchNotes && (
                  <div className="pt-1 text-[11px] text-slate-600 border-t border-amber-100">
                    <span className="font-semibold text-slate-700">یادداشت خروج:</span> {transfer.dispatchNotes}
                  </div>
                )}
              </div>
            </div>

            {/* Box 2: Return Records (مشخصات ورود و بازگشت) */}
            <div className="border border-emerald-300 rounded-xl p-3.5 bg-emerald-50/40 space-y-2 text-xs">
              <div className="flex items-center gap-1.5 font-bold text-emerald-900 border-b border-emerald-200 pb-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-700" />
                <span>۲. مشخصات آورنده و بازگشت به انبار</span>
              </div>
              
              {transfer.returnRecords && transfer.returnRecords.length > 0 ? (
                <div className="space-y-2">
                  {transfer.returnRecords.map((ret, idx) => (
                    <div key={ret.id} className="space-y-1.5 text-slate-800 bg-white p-2 rounded-lg border border-emerald-200">
                      <div className="flex justify-between font-bold text-emerald-800 text-[11px]">
                        <span>نوبت بازگشت #{idx + 1}</span>
                        <span className="font-mono">{ret.returnedAt}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">آورنده / راننده برگشت:</span>
                        <span className="font-bold">{ret.returnerName}</span>
                      </div>
                      {ret.returnVehicleInfo && (
                        <div className="flex justify-between">
                          <span className="text-slate-500">ماشین و پلاک آورنده:</span>
                          <span className="font-bold text-emerald-900">{ret.returnVehicleInfo}</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="text-slate-500">تحویل‌گیرنده در انبار:</span>
                        <span className="font-medium">{ret.receivedByWarehouseUser}</span>
                      </div>
                      {ret.notes && (
                        <div className="text-[11px] text-slate-600 pt-1 border-t border-slate-100">
                          <span className="font-bold text-emerald-800">وضعیت سلامت / گزارش:</span> {ret.notes}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 text-center text-slate-400 text-xs">
                  دستگاه هنوز به انبار بازگردانده نشده و در دست تعمیر یا امانی است.
                </div>
              )}
            </div>
          </div>

          {/* Signatures and Approvals */}
          <div className="border border-slate-300 rounded-xl p-4 bg-slate-50 mt-4">
            <div className="text-xs font-bold text-slate-700 mb-3 text-center">
              تاییدات، مهر و امضای طرفین تحویل و تحول:
            </div>
            <div className="grid grid-cols-4 gap-2 text-center text-xs">
              <div className="border-l border-slate-200 pl-2">
                <div className="text-slate-500 font-semibold mb-8">امضای انباردار تحویل‌دهنده</div>
                <div className="text-[11px] text-slate-400 font-mono">...................................</div>
              </div>
              <div className="border-l border-slate-200 pl-2">
                <div className="text-slate-500 font-semibold mb-8">امضای راننده / خارج‌کننده</div>
                <div className="text-[11px] text-slate-400 font-mono">...................................</div>
              </div>
              <div className="border-l border-slate-200 pl-2">
                <div className="text-slate-500 font-semibold mb-8">امضای نگهبانی درب خروج</div>
                <div className="text-[11px] text-slate-400 font-mono">...................................</div>
              </div>
              <div>
                <div className="text-slate-500 font-semibold mb-8">امضا و تاریخ بازگشت به انبار</div>
                <div className="text-[11px] text-slate-400 font-mono">...................................</div>
              </div>
            </div>
          </div>

          {/* Legal / Warehouse Notice */}
          <div className="text-[10px] text-slate-400 text-center pt-2">
            این برگه به منزله حواله ورود و خروج رسمی اموال از انبار بوده و پس از اتمام سرویس فنی یا دوره امانی، نسخه بازگشت بایستی به بایگانی انبار عودت گردد.
          </div>
        </div>
      </div>
    </div>
  );
};
