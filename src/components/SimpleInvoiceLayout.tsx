import React from 'react';
import { Invoice, StoreSettings } from '../types';
import { formatPrice, toPersianDigits } from '../utils/jalali';

interface SimpleInvoiceLayoutProps {
  invoice: Invoice;
  settings: StoreSettings;
  pageSize?: 'a4' | 'a5';
  orientation?: 'portrait' | 'landscape';
}

export const SimpleInvoiceLayout: React.FC<SimpleInvoiceLayoutProps> = ({ 
  invoice, 
  settings,
  pageSize = 'a4',
  orientation = 'portrait'
}) => {
  const isA5 = pageSize === 'a5';
  const isLandscape = orientation === 'landscape';
  const isA5Landscape = isA5 && isLandscape;
  const isA5Portrait = isA5 && !isLandscape;
  const isA4Portrait = !isA5 && !isLandscape;
  const isA4Landscape = !isA5 && isLandscape;

  const totalQuantity = invoice.items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
  const hasDiscounts = invoice.items.some((item) => (item.discount || 0) > 0) || (invoice.totalDiscount || 0) > 0;
  const remainingBalance = Math.max(0, invoice.finalTotal - (invoice.paidAmount || 0));

  // Pure Persian price formatter with commas
  const formatPersianPrice = (val: number) => toPersianDigits(Math.round(val || 0).toLocaleString('en-US'));

  // Adaptive typography and spacing based on sheet size and orientation
  const tableCellPy = isA5Landscape ? 'py-1' : isA5Portrait ? 'py-1.5' : isA4Landscape ? 'py-2' : 'py-2.5';
  const tableCellPx = isA5Landscape ? 'px-1.5' : isA5Portrait ? 'px-2' : 'px-2.5 sm:px-3';
  const tableFontSize = isA5Landscape ? 'text-[9px]' : isA5Portrait ? 'text-[10px]' : isA4Landscape ? 'text-[11.5px]' : 'text-xs';
  const signatureHeight = isA5Landscape ? 'min-h-[46px]' : isA5Portrait ? 'min-h-[60px]' : isA4Landscape ? 'min-h-[72px]' : 'min-h-[82px]';

  return (
    <div 
      className={`simple-invoice-layout h-full flex-1 flex flex-col justify-between text-slate-900 font-sans leading-snug w-full ${
        isA5Landscape 
          ? 'space-y-1.5 text-[9.5px]' 
          : isA5Portrait 
          ? 'space-y-2 text-[10.5px]' 
          : isA4Landscape 
          ? 'space-y-3 text-[12px]' 
          : 'space-y-3.5 text-[13px]'
      }`} 
      dir="rtl"
    >
      {/* 1. SECTION: TOP ZONE (Header + Notices + Seller/Buyer Cards) */}
      <div className={`shrink-0 ${isA5Landscape ? 'space-y-1.5' : isA5Portrait ? 'space-y-2' : 'space-y-2.5'}`}>
        
        {/* سربرگ فاکتور (Header) */}
        <div className={`invoice-header border-b-2 border-slate-800 flex flex-row justify-between items-center gap-2 ${
          isA5Landscape ? 'pb-1.5' : isA5Portrait ? 'pb-2' : 'pb-2.5'
        }`}>
          {/* راست: مشخصات فروشگاه */}
          <div className="flex items-center gap-2.5">
            <span className={`rounded-lg bg-slate-900 text-white flex items-center justify-center font-black shrink-0 print:border print:border-slate-800 ${
              isA5Landscape ? 'w-7 h-7 text-xs' : isA5Portrait ? 'w-8 h-8 text-sm' : 'w-9 h-9 text-base'
            }`}>
              {settings.storeName ? settings.storeName.charAt(0) : 'ف'}
            </span>
            <div>
              <h1 className={`font-black text-slate-900 leading-tight ${
                isA5Landscape ? 'text-sm' : isA5Portrait ? 'text-base' : isA4Landscape ? 'text-lg' : 'text-xl'
              }`}>
                {settings.storeName || 'فروشگاه سپهر'}
              </h1>
              {settings.tagline && (
                <p className={`text-slate-600 font-medium ${isA5Landscape ? 'text-[9px]' : isA5Portrait ? 'text-[10px]' : 'text-xs'}`}>
                  {settings.tagline}
                </p>
              )}
              <div className={`flex flex-wrap items-center gap-x-3 text-slate-600 pt-0.5 ${
                isA5Landscape ? 'text-[8.5px]' : isA5Portrait ? 'text-[9.5px]' : 'text-[11px]'
              }`}>
                {settings.phone && (
                  <span>تلفن: <strong className="text-slate-800 font-bold">{toPersianDigits(settings.phone)}</strong></span>
                )}
                {settings.mobile && (
                  <span>همراه: <strong className="text-slate-800 font-bold">{toPersianDigits(settings.mobile)}</strong></span>
                )}
                {settings.address && (
                  <span className="truncate max-w-[280px]">نشانی: {settings.address}</span>
                )}
              </div>
            </div>
          </div>

          {/* چپ: عنوان سند و اطلاعات شماره/تاریخ */}
          <div className={`border border-slate-400 rounded-md bg-slate-50/80 text-right shrink-0 ${
            isA5Landscape ? 'p-1.5 min-w-[170px]' : isA5Portrait ? 'p-2 min-w-[190px]' : 'p-2.5 min-w-[220px]'
          }`}>
            <div className={`text-center font-black text-slate-900 pb-1 mb-1 border-b border-slate-300 ${
              isA5Landscape ? 'text-xs' : isA5Portrait ? 'text-sm' : 'text-base'
            }`}>
              {invoice.isProforma ? 'پیش‌فاکتور فروش کالا' : 'فاکتور فروش کالا'}
            </div>
            <div className={`space-y-0.5 ${isA5Landscape ? 'text-[9px]' : isA5Portrait ? 'text-[10px]' : 'text-xs'}`}>
              <div className="flex justify-between items-center gap-2">
                <span className="text-slate-600 font-medium">شماره سند:</span>
                <span className="font-extrabold text-slate-900 tracking-wider font-['Vazirmatn']">
                  {toPersianDigits(invoice.invoiceNumber)}
                </span>
              </div>
              <div className="flex justify-between items-center gap-2">
                <span className="text-slate-600 font-medium">تاریخ صدور:</span>
                <span className="font-bold text-slate-900">{toPersianDigits(invoice.date)}</span>
              </div>
              {invoice.dueDate && (
                <div className="flex justify-between items-center gap-2">
                  <span className="text-slate-600 font-medium">تاریخ سررسید:</span>
                  <span className="font-bold text-slate-800">{toPersianDigits(invoice.dueDate)}</span>
                </div>
              )}
              <div className="flex justify-between items-center gap-2 pt-0.5 border-t border-slate-200">
                <span className="text-slate-600 font-medium">وضعیت:</span>
                <span className="font-bold text-slate-900">
                  {invoice.paymentStatus === 'paid'
                    ? 'تسویه شده'
                    : invoice.paymentStatus === 'partial'
                    ? 'پرداخت مرحله‌ای'
                    : 'در انتظار پرداخت'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* یادداشت پیش‌فاکتور یا سند مرجع در صورت وجود */}
        {invoice.isProforma && (
          <div className={`bg-amber-50/90 border border-amber-300 text-amber-900 rounded font-semibold text-center ${
            isA5Landscape ? 'px-2 py-0.5 text-[8.5px]' : isA5Portrait ? 'px-2.5 py-1 text-[9.5px]' : 'px-3 py-1.5 text-xs'
          }`}>
            این سند صرفاً پیش‌فاکتور غیرقطعی بوده و جنبه استعلام قیمت دارد.
          </div>
        )}
        {invoice.convertedFromProforma && (
          <div className={`bg-emerald-50 border border-emerald-300 text-emerald-900 rounded font-medium text-center ${
            isA5Landscape ? 'px-2 py-0.5 text-[8.5px]' : isA5Portrait ? 'px-2.5 py-1 text-[9.5px]' : 'px-3 py-1.5 text-xs'
          }`}>
            این فاکتور رسمی بر اساس پیش‌فاکتور شماره <strong>{toPersianDigits(invoice.convertedFromProforma)}</strong> قطعی شده است.
          </div>
        )}

        {/* مشخصات خریدار و فروشنده در ۲ ستون تراز و مشخص */}
        <div className={`invoice-parties grid grid-cols-2 ${
          isA5Landscape ? 'gap-1.5 text-[9px]' : isA5Portrait ? 'gap-2 text-[10px]' : 'gap-3 text-xs'
        }`}>
          {/* مشخصات فروشنده */}
          <div className="border border-slate-400 rounded-md overflow-hidden bg-white shadow-2xs">
            <div className={`bg-slate-100 font-bold text-slate-900 border-b border-slate-300 ${
              isA5Landscape ? 'px-2 py-0.5 text-[9px]' : isA5Portrait ? 'px-2.5 py-1 text-[10px]' : 'px-3 py-1.5 text-xs'
            }`}>
              مشخصات فروشنده
            </div>
            <div className={`space-y-0.5 text-slate-800 ${
              isA5Landscape ? 'p-1.5' : isA5Portrait ? 'p-2' : 'p-2.5'
            }`}>
              <div className="grid grid-cols-[68px_1fr] items-start gap-1">
                <span className="text-slate-600 font-medium">نام / برند:</span>
                <span className="font-bold truncate">{settings.storeName} {settings.sellerName ? `(${settings.sellerName})` : ''}</span>
              </div>
              {(settings.economicCode || settings.nationalCode) && (
                <div className="grid grid-cols-[68px_1fr] items-start gap-1">
                  <span className="text-slate-600 font-medium">کد ملی/اقتصادی:</span>
                  <span className="font-bold font-['Vazirmatn']">{toPersianDigits(settings.economicCode || settings.nationalCode || '')}</span>
                </div>
              )}
              <div className="grid grid-cols-[68px_1fr] items-start gap-1">
                <span className="text-slate-600 font-medium">شماره تماس:</span>
                <span className="font-bold font-['Vazirmatn']">{toPersianDigits(settings.phone || settings.mobile || '---')}</span>
              </div>
              <div className="grid grid-cols-[68px_1fr] items-start gap-1">
                <span className="text-slate-600 font-medium">نشانی:</span>
                <span className="truncate">{settings.address || '---'}</span>
              </div>
            </div>
          </div>

          {/* مشخصات خریدار */}
          <div className="border border-slate-400 rounded-md overflow-hidden bg-white shadow-2xs">
            <div className={`bg-slate-100 font-bold text-slate-900 border-b border-slate-300 ${
              isA5Landscape ? 'px-2 py-0.5 text-[9px]' : isA5Portrait ? 'px-2.5 py-1 text-[10px]' : 'px-3 py-1.5 text-xs'
            }`}>
              مشخصات خریدار
            </div>
            <div className={`space-y-0.5 text-slate-800 ${
              isA5Landscape ? 'p-1.5' : isA5Portrait ? 'p-2' : 'p-2.5'
            }`}>
              <div className="grid grid-cols-[68px_1fr] items-start gap-1">
                <span className="text-slate-600 font-medium">نام خریدار:</span>
                <span className="font-bold text-slate-900 truncate">{invoice.customerName || 'مشتری محترم'}</span>
              </div>
              <div className="grid grid-cols-[68px_1fr] items-start gap-1">
                <span className="text-slate-600 font-medium">شماره تماس:</span>
                <span className="font-bold font-['Vazirmatn']">{toPersianDigits(invoice.customerPhone || '---')}</span>
              </div>
              {invoice.customerNationalId && (
                <div className="grid grid-cols-[68px_1fr] items-start gap-1">
                  <span className="text-slate-600 font-medium">کد ملی/اقتصادی:</span>
                  <span className="font-bold font-['Vazirmatn']">{toPersianDigits(invoice.customerNationalId)}</span>
                </div>
              )}
              <div className="grid grid-cols-[68px_1fr] items-start gap-1">
                <span className="text-slate-600 font-medium">نشانی:</span>
                <span className="truncate">{invoice.customerAddress || '---'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. SECTION: MIDDLE ZONE (جدول اقلام کالا و خدمات با خوانایی بالا) */}
      <div className="flex-1 flex flex-col justify-start w-full my-auto overflow-hidden">
        <div className="border border-slate-700 rounded-md overflow-hidden bg-white shadow-2xs">
          <table className={`w-full text-right border-collapse ${tableFontSize}`}>
            <thead>
              <tr className="bg-slate-100 text-slate-900 font-bold border-b border-slate-700 divide-x divide-x-reverse divide-slate-400">
                <th className={`${tableCellPy} ${tableCellPx} text-center w-8`}>ردیف</th>
                <th className={`${tableCellPy} ${tableCellPx} text-center ${isA5 ? 'w-14' : 'w-20'}`}>کد کالا</th>
                <th className={`${tableCellPy} ${tableCellPx} text-right`}>شرح کالا یا خدمات</th>
                <th className={`${tableCellPy} ${tableCellPx} text-center ${isA5 ? 'w-12' : 'w-16'}`}>تعداد</th>
                <th className={`${tableCellPy} ${tableCellPx} text-center ${isA5 ? 'w-10' : 'w-14'}`}>واحد</th>
                <th className={`${tableCellPy} ${tableCellPx} text-left ${isA5 ? 'w-22' : 'w-28'}`}>قیمت واحد ({settings.currency})</th>
                {hasDiscounts && (
                  <th className={`${tableCellPy} ${tableCellPx} text-left ${isA5 ? 'w-16' : 'w-20'}`}>تخفیف</th>
                )}
                <th className={`${tableCellPy} ${tableCellPx} text-left ${isA5 ? 'w-24' : 'w-32'}`}>مبلغ کل ({settings.currency})</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-300">
              {invoice.items.map((item, idx) => (
                <tr
                  key={item.id || idx}
                  className={`divide-x divide-x-reverse divide-slate-300 ${
                    idx % 2 === 1 ? 'bg-slate-50/70' : 'bg-white'
                  }`}
                >
                  <td className={`${tableCellPy} ${tableCellPx} text-center text-slate-700 font-medium font-['Vazirmatn']`}>
                    {toPersianDigits(idx + 1)}
                  </td>
                  <td className={`${tableCellPy} ${tableCellPx} text-center text-slate-600 font-mono text-[10px]`}>
                    {toPersianDigits(item.productCode || '---')}
                  </td>
                  <td className={`${tableCellPy} ${tableCellPx} text-right`}>
                    <div className="font-bold text-slate-900">{item.productName}</div>
                    {item.variantName && (
                      <div className="text-[10px] text-slate-600 mt-0.5">
                        تنوع: <span className="font-semibold text-slate-800">{item.variantName}</span>
                      </div>
                    )}
                  </td>
                  <td className={`${tableCellPy} ${tableCellPx} text-center font-black text-slate-900 font-['Vazirmatn']`}>
                    {toPersianDigits(item.quantity)}
                  </td>
                  <td className={`${tableCellPy} ${tableCellPx} text-center text-slate-700`}>
                    {item.unit || 'عدد'}
                  </td>
                  <td className={`${tableCellPy} ${tableCellPx} text-left font-medium text-slate-800 font-['Vazirmatn'] tabular-nums`}>
                    {formatPersianPrice(item.unitPrice)}
                  </td>
                  {hasDiscounts && (
                    <td className={`${tableCellPy} ${tableCellPx} text-left text-slate-700 font-['Vazirmatn'] tabular-nums`}>
                      {(item.discount || 0) > 0 ? formatPersianPrice(item.discount || 0) : '۰'}
                    </td>
                  )}
                  <td className={`${tableCellPy} ${tableCellPx} text-left font-black text-slate-900 font-['Vazirmatn'] tabular-nums`}>
                    {formatPersianPrice(item.total)}
                  </td>
                </tr>
              ))}
            </tbody>
            {/* ردیف جمع جدول */}
            <tfoot>
              <tr className="bg-slate-100/95 font-bold border-t-2 border-slate-700 divide-x divide-x-reverse divide-slate-400 text-slate-900">
                <td colSpan={2} className={`${tableCellPy} ${tableCellPx} text-center text-slate-700`}>
                  جمع اقلام:
                </td>
                <td className={`${tableCellPy} ${tableCellPx} text-right`}>
                  {toPersianDigits(invoice.items.length)} ردیف کالایی
                </td>
                <td className={`${tableCellPy} ${tableCellPx} text-center font-black font-['Vazirmatn']`}>
                  {toPersianDigits(totalQuantity)}
                </td>
                <td className={`${tableCellPy} ${tableCellPx} text-center text-slate-600`}>
                  مجموع
                </td>
                <td colSpan={hasDiscounts ? 2 : 1} className={`${tableCellPy} ${tableCellPx} text-left text-slate-700`}>
                  جمع ناخالص:
                </td>
                <td className={`${tableCellPy} ${tableCellPx} text-left font-black text-slate-900 font-['Vazirmatn'] tabular-nums`}>
                  {formatPersianPrice(invoice.subtotal)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* 3. SECTION: BOTTOM ZONE (مبالغ، وضعیت پرداخت، چک/یادداشت + محل مهر و امضاها) */}
      <div className={`shrink-0 ${isA5Landscape ? 'space-y-1.5' : isA5Portrait ? 'space-y-2' : 'space-y-2.5'}`}>
        
        {/* بخش مبالغ، روش پرداخت و شروط فاکتور */}
        <div className={`invoice-financials-deck grid grid-cols-2 items-start ${
          isA5Landscape ? 'gap-1.5' : isA5Portrait ? 'gap-2' : 'gap-3 sm:gap-4'
        }`}>
          {/* ستون راست: اطلاعات و روش پرداخت و توضیحات */}
          <div className={`border border-slate-400 rounded-md bg-white text-slate-800 shadow-2xs ${
            isA5Landscape ? 'p-1.5 space-y-1 text-[9px]' : isA5Portrait ? 'p-2 space-y-1.5 text-[10px]' : 'p-2.5 space-y-2 text-xs'
          }`}>
            <div className="flex items-center justify-between pb-1 border-b border-slate-300 font-bold">
              <span className="text-slate-700">روش پرداخت وجه:</span>
              <span className="font-extrabold text-slate-900 border border-slate-400 rounded px-1.5 py-0.5 bg-slate-50">
                {invoice.paymentMethod === 'cheque'
                  ? 'چک بانکی'
                  : invoice.paymentMethod === 'cash'
                  ? 'نقدی'
                  : invoice.paymentMethod === 'transfer'
                  ? 'واریز بانکی / پایا'
                  : invoice.paymentMethod === 'pos'
                  ? 'کارتخوان (POS)'
                  : 'نسیه / حساب دفتری'}
              </span>
            </div>

            {/* مشخصات چک در صورت انتخاب چک */}
            {invoice.paymentMethod === 'cheque' && (
              <div className="border border-slate-300 rounded p-1.5 bg-slate-50/80 space-y-0.5 text-[9.5px]">
                <div className="font-bold text-slate-900">مشخصات چک دریافتی:</div>
                {invoice.chequeNumber && (
                  <div>شماره صیادی: <strong>{toPersianDigits(invoice.chequeNumber)}</strong></div>
                )}
                {invoice.chequeDueDate && (
                  <div>سررسید: <strong>{toPersianDigits(invoice.chequeDueDate)}</strong></div>
                )}
                {invoice.chequeName && (
                  <div>بانک / صاحب حساب: <strong>{invoice.chequeName}</strong></div>
                )}
              </div>
            )}

            {/* مشخصات واریز بانکی در صورت وجود */}
            {invoice.paymentMethod === 'transfer' && (
              <div className="border border-slate-300 rounded p-1.5 bg-slate-50/80 space-y-0.5 text-[9.5px]">
                <div className="font-bold text-slate-900">مشخصات واریز:</div>
                <div>{invoice.transferDescription || 'واریز به شماره حساب بانکی فروشگاه'}</div>
              </div>
            )}

            {/* توضیحات فاکتور */}
            {invoice.notes && (
              <div className="pt-0.5">
                <span className="font-bold text-slate-800">توضیحات: </span>
                <span className="text-slate-700 leading-relaxed">{invoice.notes}</span>
              </div>
            )}

            {/* متن پایانی و تشکر */}
            <div className="text-slate-500 pt-0.5 border-t border-slate-200 text-[8.5px] sm:text-[9.5px]">
              {settings.invoiceFooterText || 'از اعتماد و همکاری شما صمیمانه سپاسگزاریم.'}
            </div>
          </div>

          {/* ستون چپ: جدول محاسبات نهایی (Clean Totals Table) */}
          <div className="border border-slate-700 rounded-md overflow-hidden bg-white shadow-2xs">
            <div className={`flex justify-between border-b border-slate-300 bg-slate-50 ${
              isA5Landscape ? 'p-1 text-[9px]' : isA5Portrait ? 'p-1.5 text-[10px]' : 'p-2 text-xs'
            }`}>
              <span className="text-slate-700 font-medium">مجموع اقلام (ناخالص):</span>
              <span className="font-bold text-slate-900 font-['Vazirmatn'] tabular-nums">
                {formatPrice(invoice.subtotal, settings.currency)}
              </span>
            </div>

            {(invoice.totalDiscount || 0) > 0 && (
              <div className={`flex justify-between border-b border-slate-300 bg-white ${
                isA5Landscape ? 'p-1 text-[9px]' : isA5Portrait ? 'p-1.5 text-[10px]' : 'p-2 text-xs'
              }`}>
                <span className="text-slate-700 font-medium">مجموع تخفیفات:</span>
                <span className="font-bold text-slate-800 font-['Vazirmatn'] tabular-nums">
                  -{formatPrice(invoice.totalDiscount, settings.currency)}
                </span>
              </div>
            )}

            {(invoice.taxAmount || 0) > 0 && (
              <div className={`flex justify-between border-b border-slate-300 bg-slate-50 ${
                isA5Landscape ? 'p-1 text-[9px]' : isA5Portrait ? 'p-1.5 text-[10px]' : 'p-2 text-xs'
              }`}>
                <span className="text-slate-700 font-medium">
                  مالیات ارزش افزوده ({toPersianDigits(invoice.taxRate)}٪):
                </span>
                <span className="font-bold text-slate-900 font-['Vazirmatn'] tabular-nums">
                  {formatPrice(invoice.taxAmount, settings.currency)}
                </span>
              </div>
            )}

            {/* مبلغ نهایی قابل پرداخت - با وضوح ۱۰۰٪ */}
            <div className={`flex justify-between items-center bg-slate-900 text-white font-bold ${
              isA5Landscape ? 'p-1.5' : isA5Portrait ? 'p-2' : 'p-2.5'
            }`}>
              <span className={isA5Landscape ? 'text-[10px]' : isA5Portrait ? 'text-xs' : 'text-sm'}>
                مبلغ نهایی فاکتور:
              </span>
              <span className={`font-black text-white font-['Vazirmatn'] tabular-nums tracking-wide ${
                isA5Landscape ? 'text-xs' : isA5Portrait ? 'text-sm' : 'text-base sm:text-lg'
              }`}>
                {formatPrice(invoice.finalTotal, settings.currency)}
              </span>
            </div>

            {/* مبالغ تسویه یا مانده بدهی */}
            {invoice.paymentStatus !== 'paid' && (
              <div className="divide-y divide-slate-200 border-t border-slate-300 bg-slate-50/70 font-medium">
                <div className={`flex justify-between text-slate-800 ${
                  isA5Landscape ? 'p-1 text-[8.5px]' : isA5Portrait ? 'p-1.5 text-[9.5px]' : 'p-2 text-xs'
                }`}>
                  <span>مبلغ پرداخت شده:</span>
                  <span className="font-bold font-['Vazirmatn'] tabular-nums">
                    {formatPrice(invoice.paidAmount || 0, settings.currency)}
                  </span>
                </div>
                <div className={`flex justify-between text-slate-900 font-bold bg-slate-100 ${
                  isA5Landscape ? 'p-1 text-[9px]' : isA5Portrait ? 'p-1.5 text-[10px]' : 'p-2 text-xs'
                }`}>
                  <span>مانده حساب / بدهی:</span>
                  <span className="font-black font-['Vazirmatn'] tabular-nums">
                    {formatPrice(remainingBalance, settings.currency)}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* محل مهر و امضای طرفین */}
        <div className={`invoice-signatures pt-1.5 border-t-2 border-slate-700 grid grid-cols-2 gap-2.5 text-center ${
          isA5Landscape ? 'text-[9px]' : isA5Portrait ? 'text-[10px]' : 'text-xs'
        }`}>
          <div className={`border border-slate-300 rounded-lg p-2 bg-slate-50/70 flex flex-col justify-between ${signatureHeight}`}>
            <div>
              <div className="font-black text-slate-900">مهر و امضای خریدار</div>
              <div className="text-slate-600 mt-0.5 text-[9px] sm:text-[10px]">
                {invoice.customerName || 'خریدار محترم'}
              </div>
            </div>
            <div className="border-t border-dashed border-slate-300 pt-1 text-[8.5px] text-slate-400">
              کالا صحیح و سالم و مطابق فاکتور تحویل گرفته شد
            </div>
          </div>

          <div className={`border border-slate-300 rounded-lg p-2 bg-slate-50/70 flex flex-col justify-between ${signatureHeight}`}>
            <div>
              <div className="font-black text-slate-900">مهر و امضای فروشنده</div>
              <div className="text-slate-600 mt-0.5 text-[9px] sm:text-[10px]">
                {settings.storeName}
              </div>
            </div>
            <div className="border-t border-dashed border-slate-300 pt-1 text-[8.5px] text-slate-400">
              تایید صحت صدور فاکتور و ترخیص اجناس
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

