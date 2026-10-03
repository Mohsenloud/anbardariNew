import React from 'react';
import { Invoice, StoreSettings } from '../types';
import { formatPrice, toPersianDigits } from '../utils/jalali';
import { Building2 } from 'lucide-react';
import { getPrintLayoutCssVariables } from '../utils/printLayoutHelper';

export interface StandardInvoiceLayoutProps {
  invoice: Invoice;
  settings: StoreSettings;
  pageSize?: 'a4' | 'a5';
  orientation?: 'portrait' | 'landscape';
}

export const StandardInvoiceLayout: React.FC<StandardInvoiceLayoutProps> = ({
  invoice,
  settings,
  pageSize = 'a4',
  orientation = 'portrait',
}) => {
  const isA5 = pageSize === 'a5';
  const isLandscape = orientation === 'landscape';
  const isA5Landscape = isA5 && isLandscape;

  return (
    <div
      style={getPrintLayoutCssVariables(settings.printLayout, pageSize, orientation)}
      className={`standard-invoice-layout h-full flex-1 flex flex-col justify-between w-full text-slate-900 font-sans ${
        isA5Landscape ? 'space-y-1.5 text-[10px]' : isA5 ? 'space-y-2 text-[11px]' : 'space-y-3.5 text-xs'
      }`}
      dir="rtl"
    >
      {/* ZONE 1: TOP (Header, Seller & Buyer details) */}
      <div className={`shrink-0 ${isA5Landscape ? 'space-y-1.5' : isA5 ? 'space-y-2' : 'space-y-2.5'}`}>
        {/* Header: Seller Brand + Invoice Title & Meta */}
        <div className={`invoice-header border-b-2 border-slate-900 ${isA5 ? 'pb-1.5' : 'pb-2.5'}`}>
          <div className="flex flex-row justify-between items-center gap-3">
            <div>
              <div className="flex items-center gap-2">
                {settings.printLayout?.showStoreLogo !== false && (
                  (settings.printLayout?.customLogoUrl || settings.logo) ? (
                    <img 
                      src={settings.printLayout?.customLogoUrl || settings.logo} 
                      alt={settings.storeName} 
                      className={`object-contain bg-white rounded-lg border border-slate-200 shrink-0 ${
                        isA5 ? 'h-7 max-h-7 max-w-[80px]' : 'h-9 max-h-9 max-w-[120px]'
                      }`}
                      style={settings.printLayout?.logoHeight ? { height: `${settings.printLayout.logoHeight}px`, maxHeight: `${settings.printLayout.logoHeight}px` } : undefined}
                    />
                  ) : (
                    <span className={`rounded-lg bg-slate-900 text-white flex items-center justify-center font-black shrink-0 ${
                      isA5 ? 'w-7 h-7 text-xs' : 'w-8 h-8 text-sm'
                    }`}>
                      {settings.storeName ? settings.storeName.charAt(0) : 'ف'}
                    </span>
                  )
                )}
                <h2 className={`font-black text-slate-900 leading-tight ${isA5 ? 'text-sm' : 'text-lg'}`}>
                  {settings.storeName || 'فروشگاه سپهر'}
                </h2>
              </div>
              {settings.tagline && (
                <p className={`text-slate-600 mt-0.5 font-medium ${isA5 ? 'text-[9.5px]' : 'text-xs'}`}>
                  {settings.tagline}
                </p>
              )}
              {/* Seller Phone & Address */}
              <div className={`flex flex-wrap items-center gap-x-3 text-slate-600 pt-0.5 ${
                isA5 ? 'text-[9px]' : 'text-[11px]'
              }`}>
                {(settings.phone || settings.mobile) && (
                  <span>
                    تلفن: <strong className="text-slate-800 font-semibold">{toPersianDigits(settings.phone || settings.mobile)}</strong>
                  </span>
                )}
                {settings.address && (
                  <span className="truncate max-w-[280px]">نشانی: {settings.address}</span>
                )}
              </div>
            </div>

            {/* Title / Meta */}
            <div className="text-left shrink-0">
              <h1 className={`font-black text-slate-900 tracking-wide border-b-2 border-slate-800 pb-0.5 text-center ${
                isA5 ? 'text-xs' : 'text-base'
              }`}>
                {invoice.isProforma ? 'پیش‌فاکتور رسمی فروش کالا' : 'فاکتور رسمی فروش کالا'}
              </h1>
              <div className={`flex flex-col items-center sm:items-start gap-0.5 mt-1 text-slate-600 ${isA5 ? 'text-[9.5px]' : 'text-xs'}`}>
                <div className="flex items-center gap-1.5">
                  <span>تاریخ:</span>
                  <strong className="text-slate-900 font-bold">{toPersianDigits(invoice.date)}</strong>
                </div>
                <div className="flex items-center gap-1.5 pt-0.5">
                  <span>{invoice.isProforma ? 'شماره پیش‌فاکتور:' : 'شماره فاکتور:'}</span>
                  <strong className={`text-slate-900 font-black tracking-wide ${isA5 ? 'text-[11px]' : 'text-sm'}`}>
                    {toPersianDigits(invoice.invoiceNumber)}
                  </strong>
                </div>
              </div>
            </div>
          </div>
        </div>

        {invoice.isProforma && (
          <div className={`bg-indigo-50 border border-indigo-200 text-indigo-900 rounded-lg text-center font-semibold ${
            isA5 ? 'p-1 text-[9.5px]' : 'p-1.5 text-xs'
          }`}>
            این سند «پیش‌فاکتور» است و فاقد اثر قطعی خروج از انبار می‌باشد (برای نهایی شدن به فاکتور رسمی تبدیل خواهد شد).
          </div>
        )}
        {invoice.convertedFromProforma && (
          <div className={`bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-lg text-center font-medium ${
            isA5 ? 'p-1 text-[9.5px]' : 'p-1.5 text-xs'
          }`}>
            این فاکتور رسمی بر اساس پیش‌فاکتور شماره <strong>{toPersianDigits(invoice.convertedFromProforma)}</strong> صادر گردیده است.
          </div>
        )}

        {/* Customer & Transaction info bar */}
        <div className={`bg-slate-50 border border-slate-300 rounded-lg flex flex-wrap justify-between items-center gap-2 text-slate-700 ${
          isA5 ? 'p-1.5 text-[9.5px]' : 'p-2.5 text-xs'
        }`}>
          <div>
            <strong>خریدار:</strong> <span className="font-bold text-slate-900">{invoice.customerName || 'مشتری محترم'}</span>
          </div>
          {invoice.customerPhone && (
            <div>
              <strong>تلفن:</strong> <span className="font-mono text-slate-900">{toPersianDigits(invoice.customerPhone)}</span>
            </div>
          )}
          {invoice.customerNationalId && (
            <div>
              <strong>شناسه/کد ملی:</strong> <span className="font-mono text-slate-900">{toPersianDigits(invoice.customerNationalId)}</span>
            </div>
          )}
          {invoice.customerAddress && (
            <div className="truncate max-w-[280px]">
              <strong>نشانی:</strong> {invoice.customerAddress}
            </div>
          )}
          <div>
            <strong>وضعیت تسویه:</strong>{' '}
            <span className="font-bold text-slate-900">
              {invoice.paymentStatus === 'paid'
                ? 'تسویه کامل'
                : invoice.paymentStatus === 'partial'
                ? 'بیعانه'
                : 'نسیه / بدهکار'}
            </span>
          </div>
        </div>
      </div>

      {/* ZONE 2: MIDDLE (Items Table) */}
      <div className="invoice-table-box overflow-x-auto flex-1 flex flex-col justify-start my-auto py-1">
        <table className="w-full text-right border-collapse text-xs border border-slate-300">
          <thead>
            <tr className="bg-slate-100 text-slate-900 border-b border-slate-300 font-bold">
              <th className={`border-l border-slate-300 text-center ${isA5 ? 'p-1 text-[9px]' : 'p-2'}`} style={{ width: settings.printLayout?.colWidthIndex ? `${settings.printLayout.colWidthIndex}px` : '38px' }}>ردیف</th>
              {settings.printLayout?.showItemCodeCol !== false && (
                <th className={`border-l border-slate-300 ${isA5 ? 'p-1 text-[9.5px]' : 'p-2'}`} style={{ width: settings.printLayout?.colWidthCode ? `${settings.printLayout.colWidthCode}px` : '75px' }}>کد کالا</th>
              )}
              <th className={`border-l border-slate-300 ${isA5 ? 'p-1 text-[9.5px]' : 'p-2'}`}>شرح کالا یا خدمات</th>
              <th className={`border-l border-slate-300 text-center ${isA5 ? 'p-1 text-[9.5px]' : 'p-2'}`} style={{ width: settings.printLayout?.colWidthQty ? `${settings.printLayout.colWidthQty}px` : '60px' }}>تعداد</th>
              {settings.printLayout?.showItemUnitCol !== false && (
                <th className={`border-l border-slate-300 text-center ${isA5 ? 'p-1 text-[9.5px]' : 'p-2'}`} style={{ width: settings.printLayout?.colWidthUnit ? `${settings.printLayout.colWidthUnit}px` : '55px' }}>واحد</th>
              )}
              <th className={`border-l border-slate-300 text-left ${isA5 ? 'p-1 text-[9.5px]' : 'p-2'}`} style={{ width: settings.printLayout?.colWidthPrice ? `${settings.printLayout.colWidthPrice}px` : '95px' }}>قیمت واحد ({settings.currency})</th>
              {settings.printLayout?.showItemDiscountCol !== false && (
                <th className={`border-l border-slate-300 text-left ${isA5 ? 'p-1 text-[9.5px]' : 'p-2'}`} style={{ width: settings.printLayout?.colWidthDiscount ? `${settings.printLayout.colWidthDiscount}px` : '75px' }}>تخفیف</th>
              )}
              <th className={`text-left ${isA5 ? 'p-1 text-[9.5px]' : 'p-2'}`} style={{ width: settings.printLayout?.colWidthTotal ? `${settings.printLayout.colWidthTotal}px` : (isA5 ? '135px' : '165px'), minWidth: isA5 ? '120px' : '150px' }}>مبلغ کل ({settings.currency})</th>
            </tr>
          </thead>
          <tbody>
            {invoice.items.map((item, idx) => (
              <tr
                key={item.id || idx}
                className={`border-b border-slate-200 ${
                  idx % 2 === 1 ? 'bg-slate-50/70' : 'bg-white'
                }`}
              >
                <td className={`border-l border-slate-200 text-center ${isA5 ? 'p-1 text-[9px]' : 'p-2'}`}>
                  {toPersianDigits(idx + 1)}
                </td>
                {settings.printLayout?.showItemCodeCol !== false && (
                  <td className={`border-l border-slate-200 text-slate-600 font-mono ${isA5 ? 'p-1 text-[9px]' : 'p-2'}`}>
                    {toPersianDigits(item.productCode || '---')}
                  </td>
                )}
                <td className={`border-l border-slate-200 font-bold text-slate-900 ${isA5 ? 'p-1 text-[9.5px]' : 'p-2'}`}>
                  {item.productName}
                </td>
                <td className={`border-l border-slate-200 text-center font-bold ${isA5 ? 'p-1 text-[9.5px]' : 'p-2'}`}>
                  {toPersianDigits(item.quantity)}
                </td>
                {settings.printLayout?.showItemUnitCol !== false && (
                  <td className={`border-l border-slate-200 text-center text-slate-600 ${isA5 ? 'p-1 text-[9px]' : 'p-2'}`}>
                    {item.unit || 'عدد'}
                  </td>
                )}
                <td className={`border-l border-slate-200 text-left font-['Vazirmatn'] ${isA5 ? 'p-1 text-[9.5px]' : 'p-2'}`}>
                  {formatPrice(item.unitPrice, '', true)}
                </td>
                {settings.printLayout?.showItemDiscountCol !== false && (
                  <td className={`border-l border-slate-200 text-left text-slate-600 font-['Vazirmatn'] ${isA5 ? 'p-1 text-[9.5px]' : 'p-2'}`}>
                    {item.discount > 0 ? formatPrice(item.discount, '', true) : '۰'}
                  </td>
                )}
                <td className={`text-left font-bold text-slate-900 font-['Vazirmatn'] ${isA5 ? 'p-1 text-[9.5px]' : 'p-2'}`} style={{ width: settings.printLayout?.colWidthTotal ? `${settings.printLayout.colWidthTotal}px` : (isA5 ? '135px' : '165px'), minWidth: isA5 ? '120px' : '150px' }}>
                  {formatPrice(item.total, '', true)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ZONE 3: BOTTOM (Totals, Payments, Notes & Signatures - Highly Optimized) */}
      <div className={`shrink-0 ${isA5Landscape ? 'space-y-1.5' : isA5 ? 'space-y-2' : 'space-y-2.5'}`}>
        {isLandscape ? (
          /* Landscape Multi-Column Footer: Space-saving 3-zone layout with WIDE totals */
          <div className="grid grid-cols-12 gap-3 items-end border-t border-slate-200 pt-2">
            {/* Notes & Payment description (col-span-4) */}
            <div className={`col-span-4 border border-slate-200 rounded-xl bg-slate-50/80 text-slate-700 space-y-1 ${
              isA5 ? 'p-1.5 text-[9px]' : 'p-2 text-[11px]'
            }`}>
              <div className="flex items-center justify-between font-bold text-slate-800 pb-0.5 border-b border-slate-200">
                <span>روش پرداخت:</span>
                <span className="text-sky-900 bg-sky-100/90 px-1.5 py-0.5 rounded text-[9.5px]">
                  {invoice.paymentMethod === 'cheque' 
                    ? 'چک صیادی' 
                    : invoice.paymentMethod === 'cash' 
                    ? 'نقدی' 
                    : invoice.paymentMethod === 'transfer' 
                    ? 'واریز به حساب / کارت به کارت' 
                    : invoice.paymentMethod === 'pos' 
                    ? 'کارتخوان' 
                    : 'حساب دفتری / نسیه'}
                </span>
              </div>
              {invoice.notes && (
                <p><strong>توضیحات:</strong> {invoice.notes}</p>
              )}
              {settings.printLayout?.showTermsBlock !== false && (
                <p className="text-slate-500 leading-relaxed text-[9.5px]">
                  {settings.printLayout?.customFooterNotes || settings.invoiceFooterText || 'از حسن انتخاب و همکاری صمیمانه شما سپاسگزاریم.'}
                </p>
              )}
            </div>

            {/* Signatures in Landscape (col-span-3) */}
            <div className="col-span-3 text-center text-slate-600">
              {settings.printLayout?.showSignaturesBlock !== false && (
                <div 
                  className="grid grid-cols-2 gap-2 items-end pb-1 border border-slate-200 rounded-xl p-2 bg-slate-50/50"
                  style={{ minHeight: `${Math.max(35, Math.round((settings.printLayout?.signatureBoxHeight || 60) * 0.85))}px` }}
                >
                  <div className="border-t border-dashed border-slate-300 pt-1 text-[10px]">
                    <span className="font-bold text-slate-800 block">امضای خریدار</span>
                  </div>
                  <div className="border-t border-dashed border-slate-300 pt-1 text-[10px]">
                    <span className="font-bold text-slate-800 block">امضای فروشنده</span>
                  </div>
                </div>
              )}
            </div>

            {/* Calculations Table in Landscape with Wide Totals (col-span-5) */}
            <div className="col-span-5 border border-slate-300 rounded-xl overflow-hidden text-xs shadow-2xs">
              <div className={`flex justify-between border-b border-slate-200 bg-slate-50 ${isA5 ? 'p-1 text-[9px]' : 'p-1.5 text-[11px]'}`}>
                <span className="text-slate-600">جمع کل:</span>
                <span className="font-bold text-slate-800">{formatPrice(invoice.subtotal, settings.currency)}</span>
              </div>
              {invoice.totalDiscount > 0 && (
                <div className={`flex justify-between border-b border-slate-200 text-rose-700 bg-white ${isA5 ? 'p-1 text-[9px]' : 'p-1.5 text-[11px]'}`}>
                  <span>مجموع تخفیف:</span>
                  <span>-{formatPrice(invoice.totalDiscount, settings.currency)}</span>
                </div>
              )}
              {invoice.taxAmount > 0 && (
                <div className={`flex justify-between border-b border-slate-200 bg-slate-50 ${isA5 ? 'p-1 text-[9px]' : 'p-1.5 text-[11px]'}`}>
                  <span className="text-slate-600">مالیات ({toPersianDigits(invoice.taxRate)}٪):</span>
                  <span className="font-bold text-slate-800">{formatPrice(invoice.taxAmount, settings.currency)}</span>
                </div>
              )}
              <div className={`flex justify-between bg-slate-900 text-white font-bold items-center ${isA5 ? 'p-1.5 text-[11px]' : 'p-2 text-xs sm:text-sm'}`}>
                <span>قابل پرداخت:</span>
                <span className="text-emerald-400 font-black tracking-wide">{formatPrice(invoice.finalTotal, settings.currency)}</span>
              </div>
            </div>
          </div>
        ) : (
          /* Portrait Optimized Footer with Wide Totals (sm:col-span-6) */
          <div className="space-y-2">
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-stretch">
              {/* Notes & Payment description (sm:col-span-6) */}
              <div className={`sm:col-span-6 border border-slate-200 rounded-xl bg-slate-50/80 text-slate-700 space-y-1.5 flex flex-col justify-between ${
                isA5 ? 'p-2 text-[9.5px]' : 'p-2.5 text-xs'
              }`}>
                <div>
                  <div className="flex items-center justify-between font-bold text-slate-800 pb-1 border-b border-slate-200">
                    <span>روش پرداخت:</span>
                    <span className="text-sky-900 bg-sky-100/90 px-2 py-0.5 rounded text-[10px]">
                      {invoice.paymentMethod === 'cheque' 
                        ? 'چک صیادی' 
                        : invoice.paymentMethod === 'cash' 
                        ? 'نقدی' 
                        : invoice.paymentMethod === 'transfer' 
                        ? 'واریز به حساب / کارت به کارت' 
                        : invoice.paymentMethod === 'pos' 
                        ? 'کارتخوان' 
                        : 'حساب دفتری / نسیه'}
                    </span>
                  </div>

                  {invoice.notes && (
                    <p className="mt-1"><strong>توضیحات:</strong> {invoice.notes}</p>
                  )}
                </div>
                {settings.printLayout?.showTermsBlock !== false && (
                  <p className="text-slate-500 leading-relaxed text-[10px] border-t border-slate-200/80 pt-1">
                    {settings.printLayout?.customFooterNotes || settings.invoiceFooterText || 'از حسن انتخاب و همکاری صمیمانه شما سپاسگزاریم.'}
                  </p>
                )}
              </div>

              {/* Calculations Table with Wide, Prominent Total Box (sm:col-span-6) */}
              <div className="sm:col-span-6 border border-slate-300 rounded-xl overflow-hidden text-xs shadow-2xs flex flex-col justify-between">
                <div>
                  <div className={`flex justify-between border-b border-slate-200 bg-slate-50 ${isA5 ? 'p-1.5 text-[9.5px]' : 'p-2 text-xs'}`}>
                    <span className="text-slate-600">جمع کل:</span>
                    <span className="font-bold text-slate-800">{formatPrice(invoice.subtotal, settings.currency)}</span>
                  </div>
                  {invoice.totalDiscount > 0 && (
                    <div className={`flex justify-between border-b border-slate-200 text-rose-700 bg-white ${isA5 ? 'p-1.5 text-[9.5px]' : 'p-2 text-xs'}`}>
                      <span>تخفیفات:</span>
                      <span>-{formatPrice(invoice.totalDiscount, settings.currency)}</span>
                    </div>
                  )}
                  {invoice.taxAmount > 0 && (
                    <div className={`flex justify-between border-b border-slate-200 bg-slate-50 ${isA5 ? 'p-1.5 text-[9.5px]' : 'p-2 text-xs'}`}>
                      <span className="text-slate-600">مالیات ({toPersianDigits(invoice.taxRate)}٪):</span>
                      <span className="font-bold text-slate-800">{formatPrice(invoice.taxAmount, settings.currency)}</span>
                    </div>
                  )}
                </div>
                <div className={`flex justify-between bg-slate-900 text-white font-bold items-center ${isA5 ? 'p-2 text-xs' : 'p-2.5 text-sm'}`}>
                  <span className="shrink-0">مبلغ نهایی:</span>
                  <span className="text-emerald-400 font-black tracking-tight">{formatPrice(invoice.finalTotal, settings.currency)}</span>
                </div>
              </div>
            </div>

            {/* Signatures */}
            {settings.printLayout?.showSignaturesBlock !== false && (
              <div 
                className={`invoice-signatures grid grid-cols-2 text-center text-slate-600 border-t border-slate-200 items-end ${
                  isA5 ? 'pt-1.5' : 'pt-2'
                }`}
                style={{ minHeight: `${settings.printLayout?.signatureBoxHeight || 55}px` }}
              >
                <div className="border-t border-dashed border-slate-300 pt-1 mx-4">
                  <span className="font-bold text-slate-800 text-[11px] block">مهر و امضای خریدار</span>
                  <span className="text-[9.5px] text-slate-400">کالا صحیح و سالم تحویل گردید</span>
                </div>
                <div className="border-t border-dashed border-slate-300 pt-1 mx-4">
                  <span className="font-bold text-slate-800 text-[11px] block">مهر و امضای فروشنده</span>
                  <span className="text-[9.5px] text-slate-400">{settings.storeName}</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
