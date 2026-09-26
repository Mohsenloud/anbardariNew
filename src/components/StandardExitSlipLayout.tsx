import React from 'react';
import { Invoice, StoreSettings, AppUser, ExitSlipData } from '../types';
import { toPersianDigits } from '../utils/jalali';
import { PackageCheck, Truck, Warehouse, Check, Clock, Phone } from 'lucide-react';
import { parseVehicleInfo } from './IranPlatePicker';

export interface StandardExitSlipLayoutProps {
  invoice: Invoice;
  settings: StoreSettings;
  slipLog: ExitSlipData;
  currentUser?: AppUser;
  slipNumber: string;
  issuedTime: string;
  originWarehouseName: string;
  totalUnits: number;
  pageSize?: 'a4' | 'a5';
  orientation?: 'portrait' | 'landscape';
}

// Mini graphic Iranian license plate
const MiniPlate: React.FC<{ plateInfo: string }> = ({ plateInfo }) => {
  const parsed = parseVehicleInfo(plateInfo);
  if (!parsed || parsed.isFreeText || !parsed.part1 || !parsed.letter || !parsed.part2 || !parsed.iranCode) {
    return (
      <span className="font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-300 font-mono text-[10px]">
        {plateInfo}
      </span>
    );
  }
  const isYellow = parsed.letter === 'ع' || parsed.letter === 'ت';

  return (
    <div className="inline-flex items-center gap-1.5 flex-wrap">
      {parsed.vehicleType && (
        <span className="text-[10px] font-bold text-slate-800">
          {parsed.vehicleType}:
        </span>
      )}
      <div 
        dir="ltr"
        className={`inline-flex items-stretch border border-slate-800 rounded-xs overflow-hidden text-slate-950 font-black select-none text-[10px] ${
          isYellow ? 'bg-amber-300' : 'bg-white'
        }`}
        style={{ height: '20px' }}
      >
        <div className="bg-[#003399] text-white w-3.5 flex flex-col items-center justify-between py-0.5 px-0.5 shrink-0">
          <div className="w-2 h-1 flex flex-col justify-between">
            <span className="h-[0.5px] bg-[#239f40] w-full block"></span>
            <span className="h-[0.5px] bg-[#ffffff] w-full block"></span>
            <span className="h-[0.5px] bg-[#da0000] w-full block"></span>
          </div>
          <span className="text-[5px] font-bold tracking-tighter uppercase leading-none">I.R.</span>
        </div>
        <div className="flex items-center px-1.5 gap-0.5 tracking-tight font-bold">
          <span>{toPersianDigits(parsed.part1)}</span>
          <span className="text-[10px] font-extrabold mx-0.5">{parsed.letter}</span>
          <span>{toPersianDigits(parsed.part2)}</span>
        </div>
        <div className="border-l border-slate-800 bg-slate-100 flex flex-col items-center justify-center px-1 leading-none shrink-0 min-w-[20px]">
          <span className="text-[5px] text-slate-500 font-bold block scale-90">ایران</span>
          <span className="text-[9px] font-black text-slate-900 leading-tight">{toPersianDigits(parsed.iranCode)}</span>
        </div>
      </div>
    </div>
  );
};

export const StandardExitSlipLayout: React.FC<StandardExitSlipLayoutProps> = ({
  invoice,
  settings,
  slipLog,
  currentUser,
  slipNumber,
  issuedTime,
  originWarehouseName,
  totalUnits,
  pageSize = 'a4',
  orientation = 'portrait',
}) => {
  const isA5 = pageSize === 'a5';
  const isLandscape = orientation === 'landscape';
  const isA5Landscape = isA5 && isLandscape;

  return (
    <div className={`standard-exit-slip-layout h-full flex-1 flex flex-col justify-between w-full text-slate-900 font-sans ${
      isA5Landscape ? 'space-y-1.5 text-[9.5px]' : isA5 ? 'space-y-2 text-[10.5px]' : 'space-y-3.5 text-xs'
    }`} dir="rtl">
      {/* Header: Store details & Exit Voucher Title */}
      <div className={`exit-slip-header border-b-2 border-slate-900 ${isA5 ? 'pb-1.5' : 'pb-3'}`}>
        <div className="flex flex-row items-center justify-between gap-3">
          {/* Store Branding */}
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <span className={`rounded-lg bg-slate-900 text-white flex items-center justify-center font-black shrink-0 ${
                isA5 ? 'w-7 h-7 text-xs' : 'w-8 h-8 text-sm'
              }`}>
                {settings.storeName ? settings.storeName.charAt(0) : 'ا'}
              </span>
              <h1 className={`font-black text-slate-900 leading-tight ${isA5 ? 'text-sm' : 'text-lg'}`}>
                {settings.storeName || 'فروشگاه و انبار مرکزی'}
              </h1>
            </div>
            {settings.phone && (
              <p className="text-[10px] text-slate-500">تلفن: {toPersianDigits(settings.phone)}</p>
            )}
          </div>

          {/* Title & Document Numbers */}
          <div className="text-left shrink-0">
            <div className="bg-slate-900 text-white px-3 py-1 rounded-lg text-center font-black">
              <h2 className={`${isA5 ? 'text-xs' : 'text-sm'}`}>حواله رسمی خروج کالا از انبار</h2>
            </div>
            <div className={`flex items-center gap-3 mt-1.5 text-slate-700 font-medium ${isA5 ? 'text-[9.5px]' : 'text-xs'}`}>
              <span>شماره حواله: <strong className="text-slate-900 font-bold">{toPersianDigits(slipNumber)}</strong></span>
              <span>فاکتور: <strong className="text-slate-900 font-bold">{toPersianDigits(invoice.invoiceNumber)}</strong></span>
              <span>تاریخ: <strong className="text-slate-900 font-bold">{toPersianDigits(invoice.date)}</strong></span>
            </div>
          </div>
        </div>
      </div>

      {/* Warehouse and Destination Cards */}
      <div className={`grid grid-cols-1 sm:grid-cols-2 gap-2.5 ${isA5 ? 'text-[10px]' : 'text-xs'}`}>
        {/* Origin Warehouse Card */}
        <div className="bg-slate-50 border border-slate-300 rounded-xl p-2.5 space-y-1">
          <div className="font-bold text-slate-900 pb-1 border-b border-slate-200 flex items-center gap-1.5">
            <Warehouse className="w-3.5 h-3.5 text-amber-600" />
            <span>مشخصات انبار مبدأ:</span>
          </div>
          <div className="grid grid-cols-2 gap-1.5 text-slate-700">
            <div>انبار مبدأ: <strong>{originWarehouseName}</strong></div>
            <div>انباردار: <strong>{slipLog.deliveredBy || currentUser?.fullName || settings.originWarehouseManager || 'مسئول انبار'}</strong></div>
            <div className="col-span-2 truncate">نشانی: {settings.originWarehouseAddress || settings.address || 'انبار مرکزی'}</div>
          </div>
        </div>

        {/* Destination & Driver Card */}
        <div className="bg-slate-50 border border-slate-300 rounded-xl p-2.5 space-y-1">
          <div className="font-bold text-slate-900 pb-1 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Truck className="w-3.5 h-3.5 text-blue-600" />
              <span>تحویل‌گیرنده و راننده:</span>
            </div>
            {slipLog.isDelivered ? (
              <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded">
                تایید خروج قطعی
              </span>
            ) : (
              <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded">
                در انتظار بارگیری
              </span>
            )}
          </div>
          <div className="space-y-1 text-slate-700">
            <div className="flex justify-between">
              <span>خریدار: <strong>{invoice.customerName}</strong></span>
              {invoice.customerPhone && <span>تماس: <strong>{toPersianDigits(invoice.customerPhone)}</strong></span>}
            </div>
            <div className="flex justify-between items-center">
              <span>راننده: <strong>{slipLog.receiverName || invoice.customerName}</strong></span>
              {slipLog.vehicleInfo && <MiniPlate plateInfo={slipLog.vehicleInfo} />}
            </div>
          </div>
        </div>
      </div>

      {/* Items Physical Inventory Table */}
      <div className="exit-slip-table-box overflow-x-auto flex-1 flex flex-col justify-start my-auto border border-slate-300 rounded-xl overflow-hidden bg-white">
        <table className="w-full text-right border-collapse text-xs">
          <thead>
            <tr className="bg-slate-100 text-slate-900 border-b border-slate-300 font-bold">
              <th className={`border-l border-slate-300 text-center w-8 ${isA5 ? 'p-1 text-[9px]' : 'p-2'}`}>ردیف</th>
              <th className={`border-l border-slate-300 text-center w-20 ${isA5 ? 'p-1 text-[9px]' : 'p-2'}`}>کد کالا</th>
              <th className={`border-l border-slate-300 ${isA5 ? 'p-1 text-[9.5px]' : 'p-2'}`}>شرح اقلام و کالاهای حواله شده</th>
              <th className={`border-l border-slate-300 text-center w-16 ${isA5 ? 'p-1 text-[9px]' : 'p-2'}`}>واحد</th>
              <th className={`border-l border-slate-300 text-center w-20 bg-slate-200/80 font-black ${isA5 ? 'p-1 text-[9.5px]' : 'p-2'}`}>تعداد حواله</th>
              <th className={`border-l border-slate-300 text-center w-20 ${isA5 ? 'p-1 text-[9px]' : 'p-2'}`}>تحویلی</th>
              <th className={`text-center w-16 ${isA5 ? 'p-1 text-[9px]' : 'p-2'}`}>سلامت بار</th>
            </tr>
          </thead>
          <tbody>
            {(invoice.items || []).map((item, idx) => (
              <tr key={item.id || idx} className={`border-b border-slate-200 ${idx % 2 === 1 ? 'bg-slate-50/70' : 'bg-white'}`}>
                <td className={`border-l border-slate-200 text-center ${isA5 ? 'p-1 text-[9px]' : 'p-2'}`}>{toPersianDigits(idx + 1)}</td>
                <td className={`border-l border-slate-200 text-center font-mono text-slate-600 ${isA5 ? 'p-1 text-[9px]' : 'p-2'}`}>{toPersianDigits(item.productCode || '---')}</td>
                <td className={`border-l border-slate-200 font-bold text-slate-900 ${isA5 ? 'p-1 text-[9.5px]' : 'p-2'}`}>{item.productName}</td>
                <td className={`border-l border-slate-200 text-center text-slate-600 ${isA5 ? 'p-1 text-[9px]' : 'p-2'}`}>{item.unit || 'عدد'}</td>
                <td className={`border-l border-slate-200 text-center font-black text-slate-900 bg-slate-100/60 ${isA5 ? 'p-1 text-[9.5px]' : 'p-2'}`}>
                  {toPersianDigits(item.quantity)}
                </td>
                <td className={`border-l border-slate-200 text-center font-bold text-slate-800 ${isA5 ? 'p-1 text-[9px]' : 'p-2'}`}>
                  {toPersianDigits(item.quantity)}
                </td>
                <td className={`text-center text-emerald-700 font-bold ${isA5 ? 'p-1 text-[9px]' : 'p-2'}`}>✓ سالم</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-slate-100 font-bold border-t border-slate-300">
              <td colSpan={4} className="p-2 text-left">مجموع اقلام بارگیری شده:</td>
              <td className="p-2 text-center font-black text-slate-950 bg-slate-200/90">{toPersianDigits(totalUnits)}</td>
              <td colSpan={2} className="p-2 text-center text-[10px] text-slate-600">کنترل کامل محموله انجام شد</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Signatures & Confirmations */}
      <div className={`grid grid-cols-3 gap-2 border-t-2 border-slate-800 text-center text-slate-700 ${
        isA5Landscape ? 'pt-1 pb-0.5' : isA5 ? 'pt-1.5 pb-1' : 'pt-2.5 pb-1.5'
      }`}>
        <div className="border border-slate-300 rounded-lg p-2 bg-slate-50/50">
          <div className="font-bold text-slate-900 text-[11px] mb-1">امضا و تایید انباردار</div>
          <div className="text-[10px] text-slate-500 min-h-[35px] flex items-end justify-center">
            {slipLog.deliveredBy || currentUser?.fullName || 'تحویل‌دهنده انبار'}
          </div>
        </div>

        <div className="border border-slate-300 rounded-lg p-2 bg-slate-50/50">
          <div className="font-bold text-slate-900 text-[11px] mb-1">امضا و تایید راننده / متصدی حمل</div>
          <div className="text-[10px] text-slate-500 min-h-[35px] flex items-end justify-center">
            {slipLog.receiverName || 'صحت بارگیری و تعداد'}
          </div>
        </div>

        <div className="border border-slate-300 rounded-lg p-2 bg-slate-50/50">
          <div className="font-bold text-slate-900 text-[11px] mb-1">امضا و تایید تحویل‌گیرنده نهایی</div>
          <div className="text-[10px] text-slate-500 min-h-[35px] flex items-end justify-center">
            {invoice.customerName}
          </div>
        </div>
      </div>
    </div>
  );
};
