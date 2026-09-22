import React from 'react';
import { Invoice, StoreSettings, AppUser, ExitSlipData } from '../types';
import { toPersianDigits } from '../utils/jalali';
import { parseVehicleInfo } from './IranPlatePicker';
import { Warehouse, Truck, User } from 'lucide-react';

interface SimpleExitSlipLayoutProps {
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

// Compact Iran Plate for Simple Exit Slip
const SimpleIranPlate: React.FC<{ plateInfo: string; isCompact?: boolean }> = ({ plateInfo, isCompact }) => {
  const parsed = parseVehicleInfo(plateInfo);
  if (!parsed || parsed.isFreeText || !parsed.part1 || !parsed.letter || !parsed.part2 || !parsed.iranCode) {
    return (
      <span className="font-bold text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-300 font-['Vazirmatn'] text-[10px]">
        {plateInfo}
      </span>
    );
  }

  const isYellow = parsed.letter === 'ع' || parsed.letter === 'ت';
  const height = isCompact ? '18px' : '20px';

  return (
    <div className="inline-flex items-center gap-1 flex-wrap">
      {parsed.vehicleType && (
        <span className="text-[10px] font-bold text-slate-700">
          {parsed.vehicleType}:
        </span>
      )}
      <div 
        dir="ltr"
        className={`inline-flex items-stretch border border-slate-800 rounded-xs overflow-hidden text-slate-950 font-black select-none ${
          isYellow ? 'bg-amber-300' : 'bg-white'
        }`}
        style={{ height }}
      >
        <div className="bg-[#003399] text-white w-3 flex flex-col items-center justify-between py-0.5 px-0.5 shrink-0">
          <div className="w-1.5 h-1 flex flex-col justify-between">
            <span className="h-[0.5px] bg-[#239f40] w-full block"></span>
            <span className="h-[0.5px] bg-white w-full block"></span>
            <span className="h-[0.5px] bg-[#da0000] w-full block"></span>
          </div>
          <span className="text-[4px] font-sans font-bold leading-none">IR</span>
        </div>
        <div className="px-1 flex items-center justify-center font-['Vazirmatn'] text-[10px] font-black min-w-[14px]">
          {toPersianDigits(parsed.part1)}
        </div>
        <div className="px-0.5 flex items-center justify-center font-['Vazirmatn'] text-[9px] font-black min-w-[12px]">
          {parsed.letter}
        </div>
        <div className="px-1 flex items-center justify-center font-['Vazirmatn'] text-[10px] font-black min-w-[18px]">
          {toPersianDigits(parsed.part2)}
        </div>
        <div className="border-r border-slate-800 bg-slate-50/80 px-1 flex flex-col items-center justify-center leading-none">
          <span className="text-[4px] text-slate-500 font-bold">ایران</span>
          <span className="font-['Vazirmatn'] text-[9px] font-black text-slate-950">
            {toPersianDigits(parsed.iranCode)}
          </span>
        </div>
      </div>
    </div>
  );
};

export const SimpleExitSlipLayout: React.FC<SimpleExitSlipLayoutProps> = ({
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
  const isA5Portrait = isA5 && !isLandscape;
  const isA4Portrait = !isA5 && !isLandscape;
  const isA4Landscape = !isA5 && isLandscape;

  // Adaptive spacing & typography to fill each page size (A4 / A5 - Portrait / Landscape) harmoniously
  const tableCellPy = isA5Landscape ? 'py-1' : isA5Portrait ? 'py-1.5' : isA4Landscape ? 'py-2' : 'py-2.5';
  const tableCellPx = isA5Landscape ? 'px-1.5' : isA5Portrait ? 'px-2' : 'px-3';
  const tableFontSize = isA5Landscape ? 'text-[9.5px]' : isA5Portrait ? 'text-[10.5px]' : isA4Landscape ? 'text-xs' : 'text-xs sm:text-[13px]';
  const qtyFontSize = isA5Landscape ? 'text-[11px]' : isA5Portrait ? 'text-xs' : isA4Landscape ? 'text-sm' : 'text-base';
  const signatureHeight = isA5Landscape ? 'min-h-[46px]' : isA5Portrait ? 'min-h-[64px]' : isA4Landscape ? 'min-h-[74px]' : 'min-h-[88px]';

  return (
    <div 
      className={`simple-exit-slip-layout h-full flex-1 flex flex-col justify-between text-slate-900 font-sans leading-snug w-full ${
        isA5Landscape 
          ? 'space-y-1.5 text-[9.5px]' 
          : isA5Portrait 
          ? 'space-y-2.5 text-[10.5px]' 
          : isA4Landscape 
          ? 'space-y-3 text-[11.5px]' 
          : 'space-y-4 text-xs'
      }`} 
      dir="rtl"
    >
      {/* SECTION 1: TOP ZONE (Header + Logistics Deck) */}
      <div className={`shrink-0 ${isA5Landscape ? 'space-y-1.5' : isA5Portrait ? 'space-y-2' : 'space-y-2.5'}`}>
        {/* ۱. سربرگ افقی فشرده و منظم */}
        <div className={`exit-slip-header-row border-b-2 border-slate-800 flex flex-row justify-between items-center gap-2 ${
          isA5Landscape ? 'pb-1.5' : isA5Portrait ? 'pb-2' : 'pb-2.5'
        }`}>
          {/* راست: لوگو/حرف، نام فروشگاه و عنوان برگه */}
          <div className="flex items-center gap-2.5">
            <span className={`rounded-lg bg-slate-900 text-white flex items-center justify-center font-black shrink-0 print:border print:border-slate-800 ${
              isA5Landscape ? 'w-7 h-7 text-xs' : isA5Portrait ? 'w-8 h-8 text-sm' : 'w-9 h-9 text-base'
            }`}>
              {settings.storeName ? settings.storeName.charAt(0) : 'ا'}
            </span>
            <div>
              <h1 className={`font-black text-slate-900 leading-tight ${
                isA5Landscape ? 'text-sm' : isA5Portrait ? 'text-base' : isA4Landscape ? 'text-lg' : 'text-xl'
              }`}>
                {settings.storeName || 'فروشگاه و انبار مرکزی'}
              </h1>
              <div className={`font-bold text-slate-700 ${
                isA5Landscape ? 'text-[10px]' : isA5Portrait ? 'text-[11px]' : 'text-xs'
              }`}>
                برگ خروج کالا از انبار (حواله تحویل فیزیکی اجناس)
              </div>
            </div>
          </div>

          {/* مرکز: شناسه حواله و فاکتور در کادر متمرکز */}
          <div className={`bg-slate-50 border border-slate-400 rounded-md text-center flex flex-col items-center justify-center ${
            isA5Landscape ? 'px-2 py-0.5 min-w-[140px]' : isA5Portrait ? 'px-3 py-1 min-w-[160px]' : 'px-4 py-1.5 min-w-[190px]'
          }`}>
            <div className={`text-slate-500 font-semibold leading-none ${isA5Landscape ? 'text-[8.5px]' : 'text-[10px]'}`}>
              شماره حواله خروج انبار
            </div>
            <div className={`font-black text-slate-950 tracking-wider font-['Vazirmatn'] my-0.5 ${
              isA5Landscape ? 'text-xs' : isA5Portrait ? 'text-sm' : 'text-base'
            }`}>
              {toPersianDigits(slipNumber)}
            </div>
            {invoice.invoiceNumber && (
              <div className={`text-slate-600 font-medium leading-none ${isA5Landscape ? 'text-[8.5px]' : 'text-[10px]'}`}>
                عطف به فاکتور: <strong className="text-slate-800">{toPersianDigits(invoice.invoiceNumber)}</strong>
              </div>
            )}
          </div>

          {/* چپ: تاریخ، ساعت، تلفن */}
          <div className={`text-left text-slate-600 space-y-0.5 ${
            isA5Landscape ? 'text-[9px] min-w-[110px]' : isA5Portrait ? 'text-[10px] min-w-[130px]' : 'text-xs min-w-[150px]'
          }`}>
            <div>تاریخ: <strong className="text-slate-900 font-bold">{toPersianDigits(invoice.date)}</strong></div>
            <div>ساعت: <strong className="text-slate-900 font-mono">{toPersianDigits(issuedTime)}</strong></div>
            <div>نوبت: <span className="font-semibold text-slate-800">{slipLog.printCount > 0 ? `نوبت ${toPersianDigits(slipLog.printCount + 1)}` : 'نسخه اول (اصل)'}</span></div>
            {settings.phone && <div>تلفن: <span className="font-mono text-slate-800">{toPersianDigits(settings.phone)}</span></div>}
          </div>
        </div>

        {/* ۲. کادر مشخصات لجستیک: انبار مبدأ، تحویل‌گیرنده و ناوگان در ۳ ستون افقی */}
        <div className={`exit-slip-logistics-deck border border-slate-300 rounded-lg bg-slate-50/70 ${
          isA5Landscape ? 'p-1.5 text-[9.5px]' : isA5Portrait ? 'p-2 text-[10.5px]' : 'p-2.5 text-xs'
        }`}>
          <div className="grid grid-cols-3 divide-x divide-x-reverse divide-slate-300 gap-1.5">
            {/* ستون ۱: انبار مبدأ بارگیری */}
            <div className="px-2 space-y-0.5">
              <div className="font-bold text-slate-900 flex items-center gap-1.5 mb-1">
                <Warehouse className={`${isA5Landscape ? 'w-3 h-3' : 'w-3.5 h-3.5'} text-slate-700 shrink-0`} />
                <span className="font-extrabold">انبار مبدأ: {originWarehouseName}</span>
              </div>
              <div className="text-slate-600">
                انباردار: <span className="font-semibold text-slate-800">{settings.originWarehouseManager || currentUser?.fullName || 'انباردار مرکزی'}</span>
              </div>
              <div className="text-slate-600">
                تلفن انبار: <span className="font-mono text-slate-800">{toPersianDigits(settings.originWarehousePhone || settings.phone || '---')}</span>
              </div>
            </div>

            {/* ستون ۲: مشخصات تحویل‌گیرنده / خریدار */}
            <div className="px-2 space-y-0.5">
              <div className="font-bold text-slate-900 flex items-center gap-1.5 mb-1">
                <User className={`${isA5Landscape ? 'w-3 h-3' : 'w-3.5 h-3.5'} text-slate-700 shrink-0`} />
                <span className="font-extrabold">تحویل‌گیرنده: {invoice.customerName}</span>
              </div>
              <div className="text-slate-600">
                تلفن خریدار: <span className="font-mono text-slate-800">{toPersianDigits(invoice.customerPhone || '---')}</span>
              </div>
              {invoice.customerAddress && (
                <div className="text-slate-600 truncate" title={invoice.customerAddress}>
                  نشانی: <span className="text-slate-800">{invoice.customerAddress}</span>
                </div>
              )}
            </div>

            {/* ستون ۳: ناوگان، راننده و خودرو */}
            <div className="px-2 space-y-0.5">
              <div className="font-bold text-slate-900 flex items-center gap-1.5 mb-1">
                <Truck className={`${isA5Landscape ? 'w-3 h-3' : 'w-3.5 h-3.5'} text-slate-700 shrink-0`} />
                <span className="font-extrabold">راننده: {slipLog.receiverName || invoice.customerName || '---'}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-slate-600 shrink-0">خودرو/پلاک:</span>
                {slipLog.vehicleInfo ? (
                  <SimpleIranPlate plateInfo={slipLog.vehicleInfo} isCompact={isA5Landscape} />
                ) : (
                  <span className="text-slate-400 italic">ثبت نشده</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 2: MIDDLE ZONE (Table of Items - Fills available vertical space gracefully) */}
      <div className="flex-1 flex flex-col justify-start w-full my-auto overflow-hidden">
        <div className="border border-slate-700 rounded-md overflow-hidden bg-white shadow-2xs">
          <table className={`w-full text-right border-collapse ${tableFontSize}`}>
            <thead>
              <tr className="bg-slate-100 text-slate-900 font-bold border-b border-slate-700 divide-x divide-x-reverse divide-slate-300">
                <th className={`${tableCellPy} ${tableCellPx} text-center w-10`}>ردیف</th>
                <th className={`${tableCellPy} ${tableCellPx} text-center w-20`}>کد کالا</th>
                <th className={`${tableCellPy} ${tableCellPx} text-right`}>شرح اقلام و مشخصات کالا</th>
                <th className={`${tableCellPy} ${tableCellPx} text-center w-16`}>واحد</th>
                <th className={`${tableCellPy} ${tableCellPx} text-center w-24 bg-slate-200/80 font-black`}>تعداد حواله</th>
                <th className={`${tableCellPy} ${tableCellPx} text-center w-24 font-bold`}>تعداد تحویلی</th>
                <th className={`${tableCellPy} ${tableCellPx} text-center w-20`}>کنترل فیزیکی</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {invoice.items.map((item, idx) => (
                <tr
                  key={item.id || idx}
                  className={`divide-x divide-x-reverse divide-slate-200 ${
                    idx % 2 === 1 ? 'bg-slate-50/50' : 'bg-white'
                  }`}
                >
                  <td className={`${tableCellPy} ${tableCellPx} text-center text-slate-600 font-medium`}>
                    {toPersianDigits(idx + 1)}
                  </td>
                  <td className={`${tableCellPy} ${tableCellPx} text-center text-slate-600 font-mono`}>
                    {toPersianDigits(item.productCode || item.productId.replace('prod-', ''))}
                  </td>
                  <td className={`${tableCellPy} ${tableCellPx} text-right font-bold text-slate-900`}>
                    <span>{item.productName}</span>
                    {item.variantName && (
                      <span className="text-[9px] font-normal text-slate-600 mr-2">
                        ({item.variantName})
                      </span>
                    )}
                  </td>
                  <td className={`${tableCellPy} ${tableCellPx} text-center text-slate-700`}>
                    {item.unit || 'عدد'}
                  </td>
                  <td className={`${tableCellPy} ${tableCellPx} text-center font-black text-slate-950 ${qtyFontSize} bg-slate-100/60 font-['Vazirmatn']`}>
                    {toPersianDigits(item.quantity)}
                  </td>
                  <td className={`${tableCellPy} ${tableCellPx} text-center font-bold text-slate-900 ${qtyFontSize} font-['Vazirmatn']`}>
                    {toPersianDigits(item.quantity)}
                  </td>
                  <td className={`${tableCellPy} ${tableCellPx} text-center text-emerald-700 font-bold`}>
                    ✓ تایید
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-slate-100 font-bold border-t-2 border-slate-700 divide-x divide-x-reverse divide-slate-300 text-slate-900">
                <td colSpan={2} className={`${tableCellPy} ${tableCellPx} text-center text-slate-700`}>
                  جمع کل:
                </td>
                <td className={`${tableCellPy} ${tableCellPx} text-right`}>
                  {toPersianDigits(invoice.items.length)} ردیف کالایی در حواله خروج
                </td>
                <td className={`${tableCellPy} ${tableCellPx} text-center text-slate-600`}>
                  مجموع
                </td>
                <td className={`${tableCellPy} ${tableCellPx} text-center font-black text-slate-950 ${qtyFontSize} bg-slate-200/80 font-['Vazirmatn']`}>
                  {toPersianDigits(totalUnits)}
                </td>
                <td className={`${tableCellPy} ${tableCellPx} text-center font-black text-slate-900 ${qtyFontSize} font-['Vazirmatn']`}>
                  {toPersianDigits(totalUnits)}
                </td>
                <td className={`${tableCellPy} ${tableCellPx} text-center text-slate-600 text-xs`}>
                  کامل
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* SECTION 3: BOTTOM ZONE (Notes/Terms + Signatures + Metadata Footer) */}
      <div className={`shrink-0 ${isA5Landscape ? 'space-y-1.5' : isA5Portrait ? 'space-y-2' : 'space-y-2.5'}`}>
        {/* ۴. نوار ضوابط و یادداشت تحویل کالا */}
        <div className={`border border-slate-300 rounded-md bg-white flex items-center justify-between text-slate-600 gap-2 ${
          isA5Landscape ? 'px-2 py-0.5 text-[8.5px]' : isA5Portrait ? 'px-2.5 py-1 text-[9.5px]' : 'px-3 py-1.5 text-xs'
        }`}>
          <div className="truncate">
            <span className="font-bold text-slate-800">ضوابط ترخیص:</span> اقلام فوق به صورت فیزیکی تحویل و بارگیری گردید. این سند صرفاً حواله خروج انبارداری بوده و فاقد محاسبه مالی است.
          </div>
          {(slipLog.deliveryNotes || invoice.notes) && (
            <div className="shrink-0 font-bold text-slate-800 truncate max-w-[45%]">
              یادداشت: <span className="font-normal text-slate-700">{slipLog.deliveryNotes || invoice.notes}</span>
            </div>
          )}
        </div>

        {/* ۵. سه کادر متوازن و متناسب امضاها با فضای مناسب مهر و امضا */}
        <div className={`exit-slip-signatures pt-1 border-t-2 border-slate-800 grid grid-cols-3 gap-2.5 text-center ${
          isA5Landscape ? 'text-[9px]' : isA5Portrait ? 'text-[10px]' : 'text-xs'
        }`}>
          {/* ۱. انباردار */}
          <div className={`border border-slate-300 rounded-lg p-2 bg-slate-50/70 flex flex-col justify-between ${signatureHeight}`}>
            <div>
              <div className="font-black text-slate-900">امضای متصدی انبار</div>
              <div className="text-slate-600 mt-0.5">
                {settings.originWarehouseManager || currentUser?.fullName || 'انباردار'}
              </div>
            </div>
            <div className="border-t border-dashed border-slate-300 pt-1 text-[9px] text-slate-400">
              مهر و امضای خروج بار
            </div>
          </div>

          {/* ۲. راننده و خودرو */}
          <div className={`border border-slate-300 rounded-lg p-2 bg-slate-50/70 flex flex-col justify-between ${signatureHeight}`}>
            <div>
              <div className="font-black text-slate-900">امضای راننده و حامل بار</div>
              <div className="text-slate-600 mt-0.5">
                {slipLog.receiverName ? `راننده: ${slipLog.receiverName}` : 'حامل بار'}
              </div>
            </div>
            <div className="border-t border-dashed border-slate-300 pt-1 text-[9px] text-slate-400">
              تایید دریافت و سلامت بارگیری
            </div>
          </div>

          {/* ۳. مشتری یا تحویل‌گیرنده */}
          <div className={`border border-slate-300 rounded-lg p-2 bg-slate-50/70 flex flex-col justify-between ${signatureHeight}`}>
            <div>
              <div className="font-black text-slate-900">امضای تحویل‌گیرنده / خریدار</div>
              <div className="text-slate-600 mt-0.5">
                {invoice.customerName || 'مشتری'}
              </div>
            </div>
            <div className="border-t border-dashed border-slate-300 pt-1 text-[9px] text-slate-400">
              تایید دریافت قطعی اجناس
            </div>
          </div>
        </div>

        {/* ۶. پانویس متادیتا و شناسه سند */}
        <div className={`text-slate-400 flex items-center justify-between pt-0.5 border-t border-slate-200 ${
          isA5Landscape ? 'text-[8px]' : 'text-[9.5px]'
        }`}>
          <div>
            <span>زمان صدور: {toPersianDigits(invoice.date)} - ساعت {toPersianDigits(issuedTime)}</span>
            <span className="mx-1.5">•</span>
            <span>قالب: {pageSize.toUpperCase()} ({orientation === 'portrait' ? 'عمودی' : 'افقی'})</span>
            <span className="mx-1.5">•</span>
            <span>نوبت چاپ: {toPersianDigits(slipLog.printCount + 1)}</span>
          </div>
          <div>
            <span>صادرکننده: {currentUser?.fullName || 'انباردار'}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
