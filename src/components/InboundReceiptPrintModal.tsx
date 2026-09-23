import React from 'react';
import { InboundReceipt, StoreSettings, AppUser } from '../types';
import { toPersianDigits, getCurrentJalaliDate } from '../utils/jalali';
import { Printer, X, CheckCircle2, AlertTriangle, ArrowDownRight, Package, FileSpreadsheet } from 'lucide-react';

interface InboundReceiptPrintModalProps {
  receipt: InboundReceipt;
  settings: StoreSettings;
  currentUser?: AppUser;
  onClose: () => void;
}

export const InboundReceiptPrintModal: React.FC<InboundReceiptPrintModalProps> = ({
  receipt,
  settings,
  currentUser,
  onClose,
}) => {
  const handlePrint = () => {
    window.print();
  };

  const hasDiscrepancy = receipt.items.some((i) => i.discrepancy !== 0);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
      <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[96vh]">
        {/* Top Action Bar (hidden in print) */}
        <div className="no-print bg-slate-900 text-white px-3 sm:px-5 py-2.5 sm:py-3.5 flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <Package className="w-5 h-5 text-emerald-400 shrink-0" />
            <span className="font-bold text-xs sm:text-base truncate">
              پیش‌نمایش و چاپ حواله ورود کالا به انبار
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 sm:px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs sm:text-sm shadow-md transition-all cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>چاپ حواله</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Receipt Paper Container */}
        <div className="p-4 sm:p-8 overflow-y-auto bg-slate-100 flex-1 flex justify-center">
          <div 
            id="printable-inbound-receipt"
            className="w-full max-w-[210mm] bg-white p-6 sm:p-8 rounded-xl shadow-md border border-slate-200 text-slate-800 text-xs sm:text-sm print:m-0 print:p-0 print:border-none print:shadow-none print:w-full print:rounded-none"
          >
            {/* Header */}
            <div className="border-b-2 border-slate-800 pb-4 mb-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-emerald-700 text-white flex items-center justify-center font-bold text-xl print:border print:border-slate-800">
                    <FileSpreadsheet className="w-7 h-7" />
                  </div>
                  <div>
                    <h1 className="text-base sm:text-lg font-black text-slate-900">
                      {settings.storeName || 'سامانه انبارداری'}
                    </h1>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {settings.tagline || 'حواله رسمی ورود و تحویل کالا به انبار مرکزی'}
                    </p>
                  </div>
                </div>

                <div className="text-center">
                  <div className="inline-block px-4 py-1.5 rounded-lg bg-emerald-50 border border-emerald-300 font-extrabold text-emerald-900 text-sm sm:text-base mb-1">
                    حواله ورود کالا به انبار
                  </div>
                  <div className="text-[11px] text-slate-500">
                    (رسید انبار / Goods Receipt Note)
                  </div>
                </div>

                <div className="text-left text-xs space-y-1 font-medium text-slate-600">
                  <div>
                    شماره حواله:{' '}
                    <strong className="text-slate-900 font-mono">
                      {toPersianDigits(receipt.receiptNumber)}
                    </strong>
                  </div>
                  <div>
                    شماره فاکتور خرید:{' '}
                    <strong className="text-slate-900 font-mono">
                      {toPersianDigits(receipt.purchaseInvoiceNumber)}
                    </strong>
                  </div>
                  <div>
                    تاریخ صدور:{' '}
                    <span className="text-slate-900">
                      {toPersianDigits(receipt.date)}
                    </span>
                  </div>
                  {receipt.verifiedDate && (
                    <div>
                      تاریخ تایید انبار:{' '}
                      <span className="text-slate-900">
                        {toPersianDigits(receipt.verifiedDate)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Supplier & Delivery Info Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200 mb-5 text-xs">
              <div>
                <span className="text-slate-500">تامین‌کننده / فروشنده:</span>
                <div className="font-bold text-slate-900 mt-0.5">
                  {receipt.supplierName}
                </div>
              </div>
              <div>
                <span className="text-slate-500">وضعیت رسیدگی انبار:</span>
                <div className="mt-0.5 font-bold">
                  {receipt.status === 'confirmed' ? (
                    <span className="text-emerald-700">تایید شده (ورود کامل به انبار)</span>
                  ) : receipt.status === 'has_discrepancy' ? (
                    <span className="text-amber-700">تایید شده با مغایرت (کسری/مازاد)</span>
                  ) : receipt.status === 'rejected' ? (
                    <span className="text-rose-700">عدم تایید / مرجوع شده</span>
                  ) : (
                    <span className="text-amber-600">در انتظار شمارش و تایید انباردار</span>
                  )}
                </div>
              </div>
              <div>
                <span className="text-slate-500">مسئول انبار / تاییدکننده:</span>
                <div className="font-bold text-slate-900 mt-0.5">
                  {receipt.verifiedBy || currentUser?.fullName || 'انباردار مرکزی'}
                </div>
              </div>
            </div>

            {/* Items Table */}
            <div className="overflow-x-auto mb-5">
              <table className="w-full text-right border-collapse text-xs border border-slate-300">
                <thead>
                  <tr className="bg-slate-100 text-slate-800 border-b border-slate-300">
                    <th className="p-2 border-l border-slate-300 text-center w-10">ردیف</th>
                    <th className="p-2 border-l border-slate-300 w-24">کد کالا</th>
                    <th className="p-2 border-l border-slate-300">شرح کالا / قطعه</th>
                    <th className="p-2 border-l border-slate-300 text-center w-16">واحد</th>
                    <th className="p-2 border-l border-slate-300 text-center w-20">تعداد فاکتور</th>
                    <th className="p-2 border-l border-slate-300 text-center w-24 bg-emerald-50">تعداد دریافتی انبار</th>
                    <th className="p-2 border-l border-slate-300 text-center w-20">مغایرت</th>
                    <th className="p-2">توضیحات و علت مغایرت</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {receipt.items.map((item, index) => {
                    const isDiff = item.discrepancy !== 0;
                    return (
                      <tr 
                        key={item.id || index}
                        className={isDiff ? 'bg-amber-50/50' : index % 2 === 1 ? 'bg-slate-50/50' : 'bg-white'}
                      >
                        <td className="p-2 border-l border-slate-200 text-center font-mono">
                          {toPersianDigits(index + 1)}
                        </td>
                        <td className="p-2 border-l border-slate-200 font-mono text-slate-600">
                          {toPersianDigits(item.productCode)}
                        </td>
                        <td className="p-2 border-l border-slate-200 font-semibold text-slate-900">
                          {item.productName}
                        </td>
                        <td className="p-2 border-l border-slate-200 text-center text-slate-600">
                          {item.unit || 'عدد'}
                        </td>
                        <td className="p-2 border-l border-slate-200 text-center font-bold">
                          {toPersianDigits(item.expectedQuantity)}
                        </td>
                        <td className="p-2 border-l border-slate-200 text-center font-black text-emerald-800 bg-emerald-50/70">
                          {toPersianDigits(item.receivedQuantity)}
                        </td>
                        <td className="p-2 border-l border-slate-200 text-center font-bold">
                          {item.discrepancy === 0 ? (
                            <span className="text-emerald-700 font-medium">۰ (بدون مغایرت)</span>
                          ) : item.discrepancy < 0 ? (
                            <span className="text-rose-700 font-black">
                              {toPersianDigits(item.discrepancy)} (کسری)
                            </span>
                          ) : (
                            <span className="text-blue-700 font-black">
                              +{toPersianDigits(item.discrepancy)} (مازاد)
                            </span>
                          )}
                        </td>
                        <td className="p-2 text-slate-600 text-[11px]">
                          {item.discrepancyReason || (item.discrepancy === 0 ? 'تحویل کامل و سالم' : '—')}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-100 font-bold border-t-2 border-slate-400">
                    <td colSpan={4} className="p-2 text-left pl-3 border-l border-slate-300">
                      مجموع اقلام حواله:
                    </td>
                    <td className="p-2 text-center border-l border-slate-300 font-black">
                      {toPersianDigits(receipt.totalExpectedQuantity)}
                    </td>
                    <td className="p-2 text-center border-l border-slate-300 font-black text-emerald-800 bg-emerald-100">
                      {toPersianDigits(receipt.totalReceivedQuantity)}
                    </td>
                    <td className="p-2 text-center border-l border-slate-300 font-black">
                      {receipt.totalDiscrepancy === 0 ? (
                        <span className="text-emerald-700">تطبیق ۱۰۰٪</span>
                      ) : (
                        <span className={receipt.totalDiscrepancy < 0 ? 'text-rose-700' : 'text-blue-700'}>
                          {toPersianDigits(receipt.totalDiscrepancy)}
                        </span>
                      )}
                    </td>
                    <td className="p-2 text-[11px] text-slate-500">
                      {receipt.totalDiscrepancy !== 0 ? 'نیازمند بررسی علت مغایرت' : 'کامل'}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Discrepancy or Warehouse Notes Box */}
            {(receipt.notes || receipt.warehouseNotes || hasDiscrepancy) && (
              <div className="mb-6 p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1.5">
                {receipt.notes && (
                  <div>
                    <strong className="text-slate-700">توضیحات فاکتور خرید:</strong>{' '}
                    <span className="text-slate-600">{receipt.notes}</span>
                  </div>
                )}
                {receipt.warehouseNotes && (
                  <div>
                    <strong className="text-emerald-800">گزارش و یادداشت انباردار:</strong>{' '}
                    <span className="text-slate-800 font-medium">{receipt.warehouseNotes}</span>
                  </div>
                )}
                {hasDiscrepancy && (
                  <div className="flex items-center gap-1.5 text-amber-800 font-semibold pt-1">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>توجه: این حواله دارای مغایرت بین اقلام فاکتور خرید و اقلام ورودی به انبار است و گزارش آن ثبت گردید.</span>
                  </div>
                )}
              </div>
            )}

            {/* Official Signatures Box */}
            <div className="grid grid-cols-3 gap-4 pt-8 border-t border-slate-300 text-center text-xs text-slate-700">
              <div className="border border-dashed border-slate-300 rounded-xl p-3 h-28 flex flex-col justify-between">
                <div className="font-bold text-slate-800">تحویل‌دهنده (راننده / تامین‌کننده)</div>
                <div className="text-[11px] text-slate-400">نام و امضا</div>
              </div>
              <div className="border border-dashed border-slate-300 rounded-xl p-3 h-28 flex flex-col justify-between">
                <div className="font-bold text-slate-800">تحویل‌گیرنده (انباردار)</div>
                <div className="text-[11px] text-slate-500">{receipt.verifiedBy || 'نام و امضا'}</div>
              </div>
              <div className="border border-dashed border-slate-300 rounded-xl p-3 h-28 flex flex-col justify-between">
                <div className="font-bold text-slate-800">مدیر انبار / کنترل کیفیت</div>
                <div className="text-[11px] text-slate-400">مهر و امضا</div>
              </div>
            </div>

            {/* Footer Note */}
            <div className="text-center text-[10px] text-slate-400 mt-6 pt-3 border-t border-slate-100">
              سامانه یکپارچه انبارداری و صدور فاکتور — چاپ شده در تاریخ {toPersianDigits(getCurrentJalaliDate())}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
