import React, { useState } from 'react';
import { Product, Invoice, InboundReceipt, DirectTransfer } from '../types';
import { toPersianDigits, formatPrice, formatNumber } from '../utils/jalali';
import { 
  X, 
  BarChart3, 
  Boxes, 
  PackageCheck, 
  AlertTriangle, 
  Truck, 
  ArrowDownRight, 
  ArrowLeftRight, 
  CheckCircle2, 
  PackageX,
  TrendingUp,
  DollarSign
} from 'lucide-react';

interface WarehouseStatsModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  invoices: Invoice[];
  inboundReceipts: InboundReceipt[];
  directTransfers: DirectTransfer[];
  currency?: string;
  onNavigateSubTab?: (subTab: 'items' | 'inbound-receipts' | 'exit-slips' | 'direct-transfers' | 'movements') => void;
  onFilterLowStock?: () => void;
}

export const WarehouseStatsModal: React.FC<WarehouseStatsModalProps> = ({
  isOpen,
  onClose,
  products,
  invoices,
  inboundReceipts,
  directTransfers,
  currency = 'ریال',
  onNavigateSubTab,
  onFilterLowStock
}) => {
  const [activeTab, setActiveTab] = useState<'inventory' | 'exit-slips' | 'inbound'>('inventory');

  if (!isOpen) return null;

  // Inventory calculations
  const totalItemsCount = products.length;
  const totalStockUnits = products.reduce((sum, p) => {
    if (p.hasVariants && p.variants && p.variants.length > 0) {
      return sum + p.variants.reduce((vSum, v) => vSum + (v.stock || 0), 0);
    }
    return sum + (p.stock || 0);
  }, 0);

  const lowStockProducts = products.filter((p) => {
    const currentStock = p.hasVariants && p.variants && p.variants.length > 0
      ? p.variants.reduce((sum, v) => sum + (v.stock || 0), 0)
      : (p.stock || 0);
    const minStock = p.minStockAlert || 5;
    return currentStock > 0 && currentStock <= minStock;
  });

  const outOfStockProducts = products.filter((p) => {
    const currentStock = p.hasVariants && p.variants && p.variants.length > 0
      ? p.variants.reduce((sum, v) => sum + (v.stock || 0), 0)
      : (p.stock || 0);
    return currentStock <= 0;
  });

  const totalBuyValue = products.reduce((sum, p) => {
    if (p.hasVariants && p.variants && p.variants.length > 0) {
      return sum + p.variants.reduce((vSum, v) => vSum + ((v.stock || 0) * (v.buyPrice || p.buyPrice || 0)), 0);
    }
    return sum + ((p.stock || 0) * (p.buyPrice || 0));
  }, 0);

  const totalSaleValue = products.reduce((sum, p) => {
    if (p.hasVariants && p.variants && p.variants.length > 0) {
      return sum + p.variants.reduce((vSum, v) => vSum + ((v.stock || 0) * (v.sellPrice || p.sellPrice || 0)), 0);
    }
    return sum + ((p.stock || 0) * (p.sellPrice || 0));
  }, 0);

  // Exit slips calculations
  const regularInvoices = invoices.filter((inv) => !inv.isProforma);
  const totalDispatchedUnits = regularInvoices.reduce(
    (sum, inv) => sum + inv.items.reduce((s, it) => s + it.quantity, 0),
    0
  );

  // Inbound calculations
  const pendingInbound = inboundReceipts.filter((r) => r.status === 'pending_verification').length;
  const verifiedInbound = inboundReceipts.filter((r) => r.status === 'confirmed').length;

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div 
        className="bg-white rounded-3xl w-full max-w-3xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden max-h-[90vh] animate-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-slate-50 border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20 shrink-0">
              <BarChart3 className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <h3 className="font-black text-slate-900 text-base sm:text-lg leading-tight">
                آمار و خلاصه وضعیت انبارداری
              </h3>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                بررسی شاخص‌های کلیدی موجودی، برگه‌های خروج، ورود کالا و ارزش انبار
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-200/80 hover:bg-slate-300 text-slate-600 hover:text-slate-900 flex items-center justify-center transition-colors cursor-pointer"
            title="بستن پنجره"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Subtabs Navigation */}
        <div className="flex border-b border-slate-200 px-5 bg-white shrink-0 gap-2 pt-2">
          <button
            type="button"
            onClick={() => setActiveTab('inventory')}
            className={`flex items-center gap-2 pb-3 px-3 text-xs sm:text-sm font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === 'inventory'
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Boxes className="w-4 h-4" />
            <span>موجودی و اقلام کالا</span>
            <span className="text-[10px] font-mono bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded-full">
              {toPersianDigits(totalItemsCount)}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('exit-slips')}
            className={`flex items-center gap-2 pb-3 px-3 text-xs sm:text-sm font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === 'exit-slips'
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Truck className="w-4 h-4" />
            <span>برگه‌های خروج و بارگیری</span>
            <span className="text-[10px] font-mono bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded-full">
              {toPersianDigits(regularInvoices.length)}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('inbound')}
            className={`flex items-center gap-2 pb-3 px-3 text-xs sm:text-sm font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === 'inbound'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <ArrowDownRight className="w-4 h-4" />
            <span>حواله‌های ورود و رسید</span>
            <span className="text-[10px] font-mono bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded-full">
              {toPersianDigits(inboundReceipts.length)}
            </span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-5">
          {/* TAB 1: INVENTORY & STOCK */}
          {activeTab === 'inventory' && (
            <div className="space-y-4">
              {/* Primary 4 Metric Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs">
                  <span className="text-[11px] text-slate-500 font-medium block">تنوع کالا در سیستم</span>
                  <div className="text-xl font-black text-slate-900 mt-1">
                    {formatNumber(totalItemsCount)} <span className="text-xs font-normal text-slate-400">ردیف</span>
                  </div>
                </div>

                <div className="bg-blue-50/60 p-3.5 rounded-2xl border border-blue-200/80 shadow-2xs">
                  <span className="text-[11px] text-blue-800 font-medium block">مجموع موجودی اقلام</span>
                  <div className="text-xl font-black text-blue-700 mt-1">
                    {formatNumber(totalStockUnits)} <span className="text-xs font-normal text-slate-400">واحد</span>
                  </div>
                </div>

                <div 
                  onClick={() => {
                    if (onFilterLowStock) {
                      onFilterLowStock();
                      onClose();
                    }
                  }}
                  className={`p-3.5 rounded-2xl border shadow-2xs transition-all ${
                    lowStockProducts.length > 0 
                      ? 'bg-amber-50/80 border-amber-300 hover:border-amber-400 cursor-pointer' 
                      : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <span className="text-[11px] text-amber-900 font-medium block">نقطه سفارش (کسری)</span>
                  <div className="text-xl font-black text-amber-700 mt-1 flex items-center gap-1.5">
                    <span>{formatNumber(lowStockProducts.length)}</span>
                    {lowStockProducts.length > 0 && (
                      <span className="text-[9px] bg-amber-200/90 text-amber-900 font-bold px-1.5 py-0.2 rounded-full">
                        نیازمند شارژ
                      </span>
                    )}
                  </div>
                </div>

                <div className="bg-rose-50/80 p-3.5 rounded-2xl border border-rose-200/80 shadow-2xs">
                  <span className="text-[11px] text-rose-800 font-medium block">کالاهای ناموجود</span>
                  <div className="text-xl font-black text-rose-700 mt-1">
                    {formatNumber(outOfStockProducts.length)} <span className="text-xs font-normal text-slate-400">قلم</span>
                  </div>
                </div>
              </div>

              {/* Estimated Inventory Valuation Box */}
              <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white rounded-2xl p-4 shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs font-bold text-slate-300">ارزش ریالی تخمینی موجودی انبار</span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    محاسبه شده بر اساس مجموع موجودی لحظه‌ای و قیمت‌های خرید / فروش اقلام
                  </p>
                </div>

                <div className="flex items-center gap-4 flex-wrap">
                  {totalBuyValue > 0 && (
                    <div className="bg-white/10 px-3 py-1.5 rounded-xl border border-white/10">
                      <span className="text-[10px] text-slate-300 block">ارزش بر مبنای قیمت خرید:</span>
                      <span className="text-sm font-black text-amber-300 font-['Vazirmatn']">
                        {formatPrice(totalBuyValue, currency)}
                      </span>
                    </div>
                  )}
                  <div className="bg-white/10 px-3 py-1.5 rounded-xl border border-white/10">
                    <span className="text-[10px] text-slate-300 block">ارزش بر مبنای قیمت فروش:</span>
                    <span className="text-sm font-black text-emerald-400 font-['Vazirmatn']">
                      {formatPrice(totalSaleValue, currency)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Low stock list if any */}
              {lowStockProducts.length > 0 && (
                <div className="border border-amber-200 rounded-2xl p-3.5 bg-amber-50/40 space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-amber-900">
                    <span className="flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-amber-600" />
                      <span>کالاهایی که موجودی آن‌ها به نقطه سفارش رسیده ({toPersianDigits(lowStockProducts.length)} کالا)</span>
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                    {lowStockProducts.slice(0, 6).map((prod) => (
                      <div key={prod.id} className="bg-white p-2.5 rounded-xl border border-amber-200/80 flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-800 truncate max-w-[200px]">{prod.name}</span>
                        <span className="font-black text-amber-700 font-mono bg-amber-100 px-2 py-0.5 rounded-md text-[11px]">
                          {toPersianDigits(prod.stock)} {prod.unit || 'عدد'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: EXIT SLIPS */}
          {activeTab === 'exit-slips' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
                  <span className="text-[11px] text-slate-500 font-medium block">کل برگه‌های خروج</span>
                  <div className="text-xl font-black text-slate-900 mt-1">
                    {toPersianDigits(regularInvoices.length)} <span className="text-xs font-normal text-slate-400">حواله</span>
                  </div>
                </div>

                <div className="bg-indigo-50/60 p-3.5 rounded-2xl border border-indigo-200/80 shadow-2xs">
                  <span className="text-[11px] text-indigo-800 font-medium block">مجموع اقلام تحویلی</span>
                  <div className="text-xl font-black text-indigo-700 mt-1">
                    {formatNumber(totalDispatchedUnits)} <span className="text-xs font-normal text-slate-400">واحد</span>
                  </div>
                </div>

                <div className="bg-amber-50/80 p-3.5 rounded-2xl border border-amber-200 shadow-2xs">
                  <span className="text-[11px] text-amber-900 font-medium block">خروج مستقیم بدون فاکتور</span>
                  <div className="text-xl font-black text-amber-700 mt-1">
                    {toPersianDigits(directTransfers.length)} <span className="text-xs font-normal text-slate-400">حواله</span>
                  </div>
                </div>

                <div className="bg-emerald-50/70 p-3.5 rounded-2xl border border-emerald-200 shadow-2xs">
                  <span className="text-[11px] text-emerald-800 font-medium block">انبارداری رسمی</span>
                  <div className="text-xl font-black text-emerald-700 mt-1 flex items-center gap-1.5">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    <span className="text-xs font-bold">۱۰۰٪ سیستمی</span>
                  </div>
                </div>
              </div>

              {onNavigateSubTab && (
                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      onNavigateSubTab('exit-slips');
                      onClose();
                    }}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all cursor-pointer"
                  >
                    رفتن به مدیریت برگه‌های خروج انبار
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: INBOUND */}
          {activeTab === 'inbound' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
                  <span className="text-[11px] text-slate-500 font-medium block">کل رسیدهای ورود کالا</span>
                  <div className="text-xl font-black text-slate-900 mt-1">
                    {toPersianDigits(inboundReceipts.length)} <span className="text-xs font-normal text-slate-400">رسید</span>
                  </div>
                </div>

                <div className="bg-emerald-50/70 p-3.5 rounded-2xl border border-emerald-200 shadow-2xs">
                  <span className="text-[11px] text-emerald-800 font-medium block">رسیدهای تایید شده</span>
                  <div className="text-xl font-black text-emerald-700 mt-1">
                    {toPersianDigits(verifiedInbound)} <span className="text-xs font-normal text-slate-400">تایید شده</span>
                  </div>
                </div>

                <div className="bg-rose-50/80 p-3.5 rounded-2xl border border-rose-200 shadow-2xs">
                  <span className="text-[11px] text-rose-800 font-medium block">در انتظار تایید انباردار</span>
                  <div className="text-xl font-black text-rose-700 mt-1">
                    {toPersianDigits(pendingInbound)} <span className="text-xs font-normal text-slate-400">مورد</span>
                  </div>
                </div>
              </div>

              {onNavigateSubTab && (
                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      onNavigateSubTab('inbound-receipts');
                      onClose();
                    }}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all cursor-pointer"
                  >
                    رفتن به حواله‌های ورود و تایید رسید
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <span>واحد ارزی: <strong className="text-slate-800 font-bold">{currency}</strong></span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl transition-all cursor-pointer"
          >
            بستن پنجره
          </button>
        </div>
      </div>
    </div>
  );
};
