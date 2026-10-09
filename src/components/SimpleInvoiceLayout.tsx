import React, { useMemo } from 'react';
import { Invoice, StoreSettings } from '../types';
import { formatPrice, toPersianDigits } from '../utils/jalali';
import { getPrintLayoutCssVariables } from '../utils/printLayoutHelper';
import { StorageService } from '../utils/storage';

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

  const buyerMobile = useMemo(() => {
    if (invoice.customerPhone && invoice.customerPhone.trim()) return invoice.customerPhone.trim();
    try {
      const customers = StorageService.getCustomers();
      if (invoice.customerId) {
        const found = customers.find((c) => c.id === invoice.customerId);
        if (found?.phone) return found.phone;
      }
      if (invoice.customerName) {
        const found = customers.find(
          (c) => c.name.trim().toLowerCase() === invoice.customerName.trim().toLowerCase()
        );
        if (found?.phone) return found.phone;
      }
    } catch {}
    return '';
  }, [invoice.customerPhone, invoice.customerId, invoice.customerName]);

  const totalQuantity = invoice.items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
  const hasDiscounts = invoice.items.some((item) => (item.discount || 0) > 0) || (invoice.totalDiscount || 0) > 0;
  const remainingBalance = Math.max(0, invoice.finalTotal - (invoice.paidAmount || 0));

  // Pure Persian price formatter with commas
  const formatPersianPrice = (val: number) => toPersianDigits(Math.round(val || 0).toLocaleString('en-US'));

  // Adaptive typography and spacing based on sheet size and orientation
  const scaleRatio = isA5 ? (isLandscape ? 0.88 : 0.85) : (isLandscape ? 0.96 : 1.0);
  const layout = settings.printLayout;
  const customRowMinH = layout?.tableRowMinHeight;
  const defaultRowMin = isA5 ? (isLandscape ? 24 : 28) : (isLandscape ? 32 : 36);
  const rowMinH = customRowMinH ? Math.max(18, Math.round(customRowMinH * scaleRatio)) : defaultRowMin;
  const rowPy = layout?.tableRowPaddingY !== undefined ? Math.max(1, Math.round(layout.tableRowPaddingY * scaleRatio)) : (isA5Landscape ? 4 : isA5Portrait ? 6 : 8);
  const cellPx = layout?.tableCellPaddingX !== undefined ? Math.max(2, Math.round(layout.tableCellPaddingX * scaleRatio)) : (isA5Landscape ? 6 : isA5Portrait ? 8 : 10);
  const headerH = Math.max(24, Math.round(rowMinH * 1.08));

  const tableFontSize = isA5Landscape ? 'text-[9px]' : isA5Portrait ? 'text-[10px]' : isA4Landscape ? 'text-[11.5px]' : 'text-xs';
  const signatureHeight = isA5Landscape ? 'min-h-[46px]' : isA5Portrait ? 'min-h-[60px]' : isA4Landscape ? 'min-h-[72px]' : 'min-h-[82px]';

  return (
    <div 
      style={getPrintLayoutCssVariables(settings.printLayout, pageSize, orientation)}
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
            {settings.printLayout?.showStoreLogo !== false && (
              (settings.printLayout?.customLogoUrl || settings.logo) ? (
                <img 
                  src={settings.printLayout?.customLogoUrl || settings.logo} 
                  alt={settings.storeName} 
                  className={`object-contain bg-white rounded-lg border border-slate-200 shrink-0 ${
                    isA5Landscape ? 'h-7 max-h-7 max-w-[80px]' : isA5Portrait ? 'h-8 max-h-8 max-w-[100px]' : 'h-10 max-h-10 max-w-[120px]'
                  }`}
                  style={settings.printLayout?.logoHeight ? { height: `${settings.printLayout.logoHeight}px`, maxHeight: `${settings.printLayout.logoHeight}px` } : undefined}
                />
              ) : (
                <span className={`rounded-lg bg-slate-900 text-white flex items-center justify-center font-black shrink-0 print:border print:border-slate-800 ${
                  isA5Landscape ? 'w-7 h-7 text-xs' : isA5Portrait ? 'w-8 h-8 text-sm' : 'w-9 h-9 text-base'
                }`}>
                  {settings.storeName ? settings.storeName.charAt(0) : 'ف'}
                </span>
              )
            )}
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
              {/* نشانی طبق درخواست کاربر از هدر حذف شد */}
              <div className={`flex flex-wrap items-center gap-x-3 text-slate-600 pt-0.5 ${
                isA5Landscape ? 'text-[8.5px]' : isA5Portrait ? 'text-[9.5px]' : 'text-[11px]'
              }`}>
                {settings.phone && (
                  <span>تلفن: <strong className="text-slate-800 font-bold">{toPersianDigits(settings.phone)}</strong></span>
                )}
                {settings.mobile && (
                  <span>همراه: <strong className="text-slate-800 font-bold">{toPersianDigits(settings.mobile)}</strong></span>
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
                <span className="text-slate-600 font-medium">تاریخ صدور:</span>
                <span className="font-bold text-slate-900">{toPersianDigits(invoice.date)}</span>
              </div>
              <div className="flex justify-between items-center gap-2 pt-0.5">
                <span className="text-slate-600 font-medium">شماره سند:</span>
                <span className={`font-black text-slate-900 tracking-wider font-['Vazirmatn'] ${isA5Landscape ? 'text-[10px]' : isA5Portrait ? 'text-[11.5px]' : 'text-sm'}`}>
                  {toPersianDigits(invoice.invoiceNumber)}
                </span>
              </div>
              {invoice.dueDate && (
                <div className="flex justify-between items-center gap-2">
                  <span className="text-slate-600 font-medium">تاریخ سررسید:</span>
                  <span className="font-bold text-slate-800">{toPersianDigits(invoice.dueDate)}</span>
                </div>
              )}
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
                <span className="font-bold truncate">{invoice.sellerName || settings.storeName} {settings.sellerName && !invoice.sellerName ? `(${settings.sellerName})` : ''}</span>
              </div>
              {(invoice.sellerEconomicCode || settings.economicCode) && (
                <div className="grid grid-cols-[68px_1fr] items-start gap-1">
                  <span className="text-slate-600 font-medium">کد اقتصادی:</span>
                  <span className="font-bold font-['Vazirmatn'] font-mono">{toPersianDigits(invoice.sellerEconomicCode || settings.economicCode || '')}</span>
                </div>
              )}
              {(invoice.sellerRegistrationNumber || settings.registrationNumber || invoice.sellerNationalCode || settings.nationalCode) && (
                <div className="grid grid-cols-[68px_1fr] items-start gap-1">
                  <span className="text-slate-600 font-medium">شماره ثبت/ملی:</span>
                  <span className="font-bold font-['Vazirmatn'] font-mono">{toPersianDigits(invoice.sellerRegistrationNumber || settings.registrationNumber || invoice.sellerNationalCode || settings.nationalCode || '')}</span>
                </div>
              )}
              <div className="grid grid-cols-[68px_1fr] items-start gap-1">
                <span className="text-slate-600 font-medium">شماره تماس:</span>
                <span className="font-bold font-['Vazirmatn'] font-mono">{toPersianDigits(invoice.sellerPhone || settings.phone || settings.mobile || '---')}</span>
              </div>
              <div className="grid grid-cols-[68px_1fr] items-start gap-1">
                <span className="text-slate-600 font-medium">نشانی:</span>
                <span className="truncate">{invoice.sellerAddress || settings.address || '---'}</span>
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
              <div className="grid grid-cols-[78px_1fr] items-start gap-1">
                <span className="text-slate-600 font-medium">موبایل خریدار:</span>
                <span className="font-bold font-['Vazirmatn']">{buyerMobile ? toPersianDigits(buyerMobile) : '---'}</span>
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
              <tr className="bg-slate-100 text-slate-900 font-bold border-b border-slate-700 divide-x divide-x-reverse divide-slate-400" style={{ height: `${headerH}px` }}>
                <th className="text-center align-middle" style={{ width: settings.printLayout?.colWidthIndex ? `${settings.printLayout.colWidthIndex}px` : '32px', minWidth: settings.printLayout?.colWidthIndex ? `${settings.printLayout.colWidthIndex}px` : '32px', paddingTop: `${rowPy}px`, paddingBottom: `${rowPy}px`, paddingLeft: `${cellPx}px`, paddingRight: `${cellPx}px`, height: `${headerH}px` }}>ردیف</th>
                {settings.printLayout?.showItemCodeCol !== false && (
                  <th className="text-center align-middle" style={{ width: settings.printLayout?.colWidthCode ? `${settings.printLayout.colWidthCode}px` : (isA5 ? '56px' : '80px'), minWidth: settings.printLayout?.colWidthCode ? `${settings.printLayout.colWidthCode}px` : (isA5 ? '56px' : '80px'), paddingTop: `${rowPy}px`, paddingBottom: `${rowPy}px`, paddingLeft: `${cellPx}px`, paddingRight: `${cellPx}px`, height: `${headerH}px` }}>کد کالا</th>
                )}
                <th className="text-right align-middle" style={{ paddingTop: `${rowPy}px`, paddingBottom: `${rowPy}px`, paddingLeft: `${cellPx}px`, paddingRight: `${cellPx}px`, height: `${headerH}px` }}>شرح کالا یا خدمات</th>
                <th className="text-center align-middle" style={{ width: settings.printLayout?.colWidthQty ? `${settings.printLayout.colWidthQty}px` : (isA5 ? '48px' : '64px'), minWidth: settings.printLayout?.colWidthQty ? `${settings.printLayout.colWidthQty}px` : (isA5 ? '48px' : '64px'), paddingTop: `${rowPy}px`, paddingBottom: `${rowPy}px`, paddingLeft: `${cellPx}px`, paddingRight: `${cellPx}px`, height: `${headerH}px` }}>تعداد</th>
                {settings.printLayout?.showItemUnitCol !== false && (
                  <th className="text-center align-middle" style={{ width: settings.printLayout?.colWidthUnit ? `${settings.printLayout.colWidthUnit}px` : (isA5 ? '40px' : '56px'), minWidth: settings.printLayout?.colWidthUnit ? `${settings.printLayout.colWidthUnit}px` : (isA5 ? '40px' : '56px'), paddingTop: `${rowPy}px`, paddingBottom: `${rowPy}px`, paddingLeft: `${cellPx}px`, paddingRight: `${cellPx}px`, height: `${headerH}px` }}>واحد</th>
                )}
                <th className="text-left align-middle" style={{ width: settings.printLayout?.colWidthPrice ? `${settings.printLayout.colWidthPrice}px` : (isA5 ? '88px' : '112px'), minWidth: settings.printLayout?.colWidthPrice ? `${settings.printLayout.colWidthPrice}px` : (isA5 ? '88px' : '112px'), paddingTop: `${rowPy}px`, paddingBottom: `${rowPy}px`, paddingLeft: `${cellPx}px`, paddingRight: `${cellPx}px`, height: `${headerH}px` }}>قیمت واحد ({settings.currency})</th>
                {hasDiscounts && settings.printLayout?.showItemDiscountCol !== false && (
                  <th className="text-left align-middle" style={{ width: settings.printLayout?.colWidthDiscount ? `${settings.printLayout.colWidthDiscount}px` : (isA5 ? '64px' : '80px'), minWidth: settings.printLayout?.colWidthDiscount ? `${settings.printLayout.colWidthDiscount}px` : (isA5 ? '64px' : '80px'), paddingTop: `${rowPy}px`, paddingBottom: `${rowPy}px`, paddingLeft: `${cellPx}px`, paddingRight: `${cellPx}px`, height: `${headerH}px` }}>تخفیف</th>
                )}
                <th className="text-left align-middle" style={{ width: settings.printLayout?.colWidthTotal ? `${settings.printLayout.colWidthTotal}px` : (isA5 ? '135px' : '165px'), minWidth: isA5 ? '120px' : '150px', paddingTop: `${rowPy}px`, paddingBottom: `${rowPy}px`, paddingLeft: `${cellPx}px`, paddingRight: `${cellPx}px`, height: `${headerH}px` }}>مبلغ کل ({settings.currency})</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-300">
              {invoice.items.map((item, idx) => (
                <tr
                  key={item.id || idx}
                  className={`divide-x divide-x-reverse divide-slate-300 ${
                    idx % 2 === 1 ? 'bg-slate-50/70' : 'bg-white'
                  }`}
                  style={{ height: `${rowMinH}px` }}
                >
                  <td className="text-center text-slate-700 font-medium font-['Vazirmatn'] align-middle" style={{ height: `${rowMinH}px`, paddingTop: `${rowPy}px`, paddingBottom: `${rowPy}px`, paddingLeft: `${cellPx}px`, paddingRight: `${cellPx}px` }}>
                    {toPersianDigits(idx + 1)}
                  </td>
                  {settings.printLayout?.showItemCodeCol !== false && (
                    <td className="text-center text-slate-600 font-mono text-[10px] align-middle" style={{ height: `${rowMinH}px`, paddingTop: `${rowPy}px`, paddingBottom: `${rowPy}px`, paddingLeft: `${cellPx}px`, paddingRight: `${cellPx}px` }}>
                      {toPersianDigits(item.productCode || '---')}
                    </td>
                  )}
                  <td className="text-right align-middle" style={{ height: `${rowMinH}px`, paddingTop: `${rowPy}px`, paddingBottom: `${rowPy}px`, paddingLeft: `${cellPx}px`, paddingRight: `${cellPx}px` }}>
                    <div className="font-bold text-slate-900">{item.productName}</div>
                    {item.variantName && (
                      <div className="text-[10px] text-slate-600 mt-0.5">
                        تنوع: <span className="font-semibold text-slate-800">{item.variantName}</span>
                      </div>
                    )}
                    {(item.description || item.notes) && (
                      <div className={`text-slate-600 font-normal mt-0.5 leading-snug whitespace-pre-wrap ${isA5 ? 'text-[8px]' : 'text-[9.5px]'}`}>
                        <span className="text-slate-400 font-medium">توضیح: </span>{item.description || item.notes}
                      </div>
                    )}
                  </td>
                  <td className="text-center font-black text-slate-900 font-['Vazirmatn'] align-middle" style={{ height: `${rowMinH}px`, paddingTop: `${rowPy}px`, paddingBottom: `${rowPy}px`, paddingLeft: `${cellPx}px`, paddingRight: `${cellPx}px` }}>
                    {toPersianDigits(item.quantity)}
                  </td>
                  {settings.printLayout?.showItemUnitCol !== false && (
                    <td className="text-center text-slate-700 align-middle" style={{ height: `${rowMinH}px`, paddingTop: `${rowPy}px`, paddingBottom: `${rowPy}px`, paddingLeft: `${cellPx}px`, paddingRight: `${cellPx}px` }}>
                      {item.unit || 'عدد'}
                    </td>
                  )}
                  <td className="text-left font-medium text-slate-800 font-['Vazirmatn'] tabular-nums align-middle" style={{ height: `${rowMinH}px`, paddingTop: `${rowPy}px`, paddingBottom: `${rowPy}px`, paddingLeft: `${cellPx}px`, paddingRight: `${cellPx}px` }}>
                    {formatPersianPrice(item.unitPrice)}
                  </td>
                  {hasDiscounts && settings.printLayout?.showItemDiscountCol !== false && (
                    <td className="text-left text-slate-700 font-['Vazirmatn'] tabular-nums align-middle" style={{ height: `${rowMinH}px`, paddingTop: `${rowPy}px`, paddingBottom: `${rowPy}px`, paddingLeft: `${cellPx}px`, paddingRight: `${cellPx}px` }}>
                      {(item.discount || 0) > 0 ? formatPersianPrice(item.discount || 0) : '۰'}
                    </td>
                  )}
                  <td className="text-left font-black text-slate-900 font-['Vazirmatn'] tabular-nums align-middle" style={{ width: settings.printLayout?.colWidthTotal ? `${settings.printLayout.colWidthTotal}px` : (isA5 ? '135px' : '165px'), minWidth: isA5 ? '120px' : '150px', height: `${rowMinH}px`, paddingTop: `${rowPy}px`, paddingBottom: `${rowPy}px`, paddingLeft: `${cellPx}px`, paddingRight: `${cellPx}px` }}>
                    {formatPersianPrice(item.total)}
                  </td>
                </tr>
              ))}
            </tbody>
            {/* ردیف جمع جدول */}
            <tfoot>
              <tr className="bg-slate-100/95 font-bold border-t-2 border-slate-700 divide-x divide-x-reverse divide-slate-400 text-slate-900" style={{ height: `${rowMinH}px` }}>
                <td colSpan={2} className="text-center text-slate-700 align-middle" style={{ paddingTop: `${rowPy}px`, paddingBottom: `${rowPy}px`, paddingLeft: `${cellPx}px`, paddingRight: `${cellPx}px` }}>
                  جمع اقلام:
                </td>
                <td className="text-right align-middle" style={{ paddingTop: `${rowPy}px`, paddingBottom: `${rowPy}px`, paddingLeft: `${cellPx}px`, paddingRight: `${cellPx}px` }}>
                  {toPersianDigits(invoice.items.length)} ردیف کالایی
                </td>
                <td className="text-center font-black font-['Vazirmatn'] align-middle" style={{ paddingTop: `${rowPy}px`, paddingBottom: `${rowPy}px`, paddingLeft: `${cellPx}px`, paddingRight: `${cellPx}px` }}>
                  {toPersianDigits(totalQuantity)}
                </td>
                <td className="text-center text-slate-600 align-middle" style={{ paddingTop: `${rowPy}px`, paddingBottom: `${rowPy}px`, paddingLeft: `${cellPx}px`, paddingRight: `${cellPx}px` }}>
                  مجموع
                </td>
                <td colSpan={hasDiscounts ? 2 : 1} className="text-left text-slate-700 align-middle" style={{ paddingTop: `${rowPy}px`, paddingBottom: `${rowPy}px`, paddingLeft: `${cellPx}px`, paddingRight: `${cellPx}px` }}>
                  جمع ناخالص:
                </td>
                <td className="text-left font-black text-slate-900 font-['Vazirmatn'] tabular-nums align-middle" style={{ paddingTop: `${rowPy}px`, paddingBottom: `${rowPy}px`, paddingLeft: `${cellPx}px`, paddingRight: `${cellPx}px` }}>
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
              <span className="text-slate-700">روش دریافت وجه:</span>
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
                <div>{(invoice.transferDescription || 'واریز به شماره حساب بانکی').replace(/فروشگاه/g, '').replace(/\s+/g, ' ').trim()}</div>
              </div>
            )}

            {/* توضیحات فاکتور */}
            {invoice.notes && (
              <div className="pt-0.5 text-slate-800 leading-relaxed whitespace-pre-line">
                <span className="font-bold text-slate-900">توضیحات: </span>
                <span className="text-slate-750 font-medium leading-relaxed whitespace-pre-line">{invoice.notes}</span>
              </div>
            )}

            {/* متن پایانی و تشکر */}
            {settings.printLayout?.showTermsBlock !== false && (
              <div className="text-slate-500 pt-0.5 border-t border-slate-200 text-[8.5px] sm:text-[9.5px]">
                {settings.printLayout?.customFooterNotes || settings.invoiceFooterText || 'از اعتماد و همکاری شما صمیمانه سپاسگزاریم.'}
              </div>
            )}
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
        {settings.printLayout?.showSignaturesBlock !== false && (
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
        )}
      </div>
    </div>
  );
};

