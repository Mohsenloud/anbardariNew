import React from 'react';
import { Invoice, StoreSettings } from '../types';
import { formatPrice, toPersianDigits } from '../utils/jalali';
import { Building2 } from 'lucide-react';

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
                <span className={`rounded-lg bg-slate-900 text-white flex items-center justify-center font-black shrink-0 ${
                  isA5 ? 'w-7 h-7 text-xs' : 'w-8 h-8 text-sm'
                }`}>
                  {settings.storeName ? settings.storeName.charAt(0) : 'ف'}
                </span>
                <h2 className={`font-black text-slate-900 leading-tight ${isA5 ? 'text-sm' : 'text-lg'}`}>
                  {settings.storeName || 'فروشگاه سپهر'}
                </h2>
              </div>
              {settings.tagline && (
                <p className={`text-slate-600 mt-0.5 font-medium ${isA5 ? 'text-[9.5px]' : 'text-xs'}`}>
                  {settings.tagline}
                </p>
              )}
            </div>

            {/* Title / Meta */}
            <div className="text-left shrink-0">
              <h1 className={`font-black text-slate-900 tracking-wide border-b-2 border-slate-800 pb-0.5 text-center ${
                isA5 ? 'text-xs' : 'text-base'
              }`}>
                {invoice.isProforma ? 'پیش‌فاکتور رسمی فروش کالا' : 'فاکتور رسمی فروش کالا'}
              </h1>
              <div className={`flex items-center gap-2.5 mt-1 text-slate-600 ${isA5 ? 'text-[9.5px]' : 'text-xs'}`}>
                <span>
                  {invoice.isProforma ? 'شماره پیش‌فاکتور:' : 'شماره فاکتور:'}{' '}
                  <strong className="text-slate-900 font-bold">{toPersianDigits(invoice.invoiceNumber)}</strong>
                </span>
                <span>تاریخ: <strong className="text-slate-900 font-bold">{toPersianDigits(invoice.date)}</strong></span>
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
              <th className={`border-l border-slate-300 text-center w-8 ${isA5 ? 'p-1 text-[9px]' : 'p-2'}`}>ردیف</th>
              <th className={`border-l border-slate-300 ${isA5 ? 'p-1 text-[9.5px]' : 'p-2'}`}>کد کالا</th>
              <th className={`border-l border-slate-300 ${isA5 ? 'p-1 text-[9.5px]' : 'p-2'}`}>شرح کالا یا خدمات</th>
              <th className={`border-l border-slate-300 text-center ${isA5 ? 'p-1 text-[9.5px]' : 'p-2'}`}>تعداد</th>
              <th className={`border-l border-slate-300 text-center ${isA5 ? 'p-1 text-[9.5px]' : 'p-2'}`}>واحد</th>
              <th className={`border-l border-slate-300 text-left ${isA5 ? 'p-1 text-[9.5px]' : 'p-2'}`}>قیمت واحد ({settings.currency})</th>
              <th className={`border-l border-slate-300 text-left ${isA5 ? 'p-1 text-[9.5px]' : 'p-2'}`}>تخفیف</th>
              <th className={`text-left ${isA5 ? 'p-1 text-[9.5px]' : 'p-2'}`}>مبلغ کل ({settings.currency})</th>
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
                <td className={`border-l border-slate-200 text-slate-600 font-mono ${isA5 ? 'p-1 text-[9px]' : 'p-2'}`}>
                  {toPersianDigits(item.productCode || '---')}
                </td>
                <td className={`border-l border-slate-200 font-bold text-slate-900 ${isA5 ? 'p-1 text-[9.5px]' : 'p-2'}`}>
                  {item.productName}
                </td>
                <td className={`border-l border-slate-200 text-center font-bold ${isA5 ? 'p-1 text-[9.5px]' : 'p-2'}`}>
                  {toPersianDigits(item.quantity)}
                </td>
                <td className={`border-l border-slate-200 text-center text-slate-600 ${isA5 ? 'p-1 text-[9px]' : 'p-2'}`}>
                  {item.unit || 'عدد'}
                </td>
                <td className={`border-l border-slate-200 text-left ${isA5 ? 'p-1 text-[9.5px]' : 'p-2'}`}>
                  {formatPrice(item.unitPrice, '', false)}
                </td>
                <td className={`border-l border-slate-200 text-left text-slate-600 ${isA5 ? 'p-1 text-[9.5px]' : 'p-2'}`}>
                  {item.discount > 0 ? formatPrice(item.discount, '', false) : '۰'}
                </td>
                <td className={`text-left font-bold text-slate-900 ${isA5 ? 'p-1 text-[9.5px]' : 'p-2'}`}>
                  {formatPrice(item.total, '', false)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ZONE 3: BOTTOM (Totals, Payments & Signatures) */}
      <div className={`shrink-0 ${isA5Landscape ? 'space-y-1.5' : isA5 ? 'space-y-2' : 'space-y-2.5'}`}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 items-start">
          {/* Notes & Payment description */}
          <div className={`border border-slate-200 rounded-xl bg-slate-50/80 text-slate-700 space-y-1.5 ${
            isA5 ? 'p-2 text-[9.5px]' : 'p-2.5 text-xs'
          }`}>
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
              <p><strong>توضیحات:</strong> {invoice.notes}</p>
            )}
            <p className="text-slate-500 leading-relaxed text-[10px]">
              {settings.invoiceFooterText || 'از حسن انتخاب و همکاری صمیمانه شما سپاسگزاریم.'}
            </p>
          </div>

          {/* Calculations Table */}
          <div className="border border-slate-300 rounded-xl overflow-hidden text-xs">
            <div className={`flex justify-between border-b border-slate-200 bg-slate-50 ${isA5 ? 'p-1.5 text-[9.5px]' : 'p-2 text-xs'}`}>
              <span className="text-slate-600">جمع کل اقلام:</span>
              <span className="font-bold text-slate-800">{formatPrice(invoice.subtotal, settings.currency)}</span>
            </div>
            {invoice.totalDiscount > 0 && (
              <div className={`flex justify-between border-b border-slate-200 text-rose-700 bg-white ${isA5 ? 'p-1.5 text-[9.5px]' : 'p-2 text-xs'}`}>
                <span>مجموع تخفیفات:</span>
                <span>-{formatPrice(invoice.totalDiscount, settings.currency)}</span>
              </div>
            )}
            {invoice.taxAmount > 0 && (
              <div className={`flex justify-between border-b border-slate-200 bg-slate-50 ${isA5 ? 'p-1.5 text-[9.5px]' : 'p-2 text-xs'}`}>
                <span className="text-slate-600">مالیات ({toPersianDigits(invoice.taxRate)}٪):</span>
                <span className="font-bold text-slate-800">{formatPrice(invoice.taxAmount, settings.currency)}</span>
              </div>
            )}
            <div className={`flex justify-between bg-slate-900 text-white font-bold ${isA5 ? 'p-2 text-xs' : 'p-2.5 text-sm'}`}>
              <span>مبلغ نهایی قابل پرداخت:</span>
              <span className="text-emerald-400 font-extrabold">{formatPrice(invoice.finalTotal, settings.currency)}</span>
            </div>
          </div>
        </div>

        {/* Signatures */}
        <div className={`invoice-signatures grid grid-cols-2 text-center text-slate-600 border-t border-slate-200 ${
          isA5Landscape ? 'pt-1.5 pb-0.5' : isA5 ? 'pt-2 pb-1' : 'pt-3 pb-1'
        }`}>
          <div className={isA5Landscape ? 'space-y-1' : isA5 ? 'space-y-1.5' : 'space-y-3'}>
            <span className="font-bold text-slate-800 text-[11px]">مهر و امضای خریدار</span>
            <div className="text-[10px] text-slate-400">کالا صحیح و سالم تحویل گردید</div>
          </div>
          <div className={isA5Landscape ? 'space-y-1' : isA5 ? 'space-y-1.5' : 'space-y-3'}>
            <span className="font-bold text-slate-800 text-[11px]">مهر و امضای فروشنده</span>
            <div className="text-[10px] text-slate-400">{settings.storeName}</div>
          </div>
        </div>
      </div>
    </div>
  );
};
