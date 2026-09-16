import React from 'react';
import { Product, Invoice, StoreSettings, AppUser } from '../types';
import { formatPrice, toPersianDigits } from '../utils/jalali';
import { 
  TrendingUp, 
  DollarSign, 
  Boxes, 
  ShoppingBag, 
  AlertTriangle, 
  Award, 
  ArrowUpRight,
  PieChart
} from 'lucide-react';

interface ReportsDashboardProps {
  products: Product[];
  invoices: Invoice[];
  settings: StoreSettings;
  currentUser?: AppUser;
  onOpenNewInvoice: () => void;
  onOpenInventory: () => void;
}

export const ReportsDashboard: React.FC<ReportsDashboardProps> = ({
  products,
  invoices,
  settings,
  currentUser,
  onOpenNewInvoice,
  onOpenInventory,
}) => {
  // Financial metrics
  const totalRevenue = invoices.reduce((sum, inv) => sum + inv.finalTotal, 0);

  // Calculate COGS (Cost of Goods Sold) and Profit
  let totalCostOfGoodsSold = 0;
  invoices.forEach((inv) => {
    inv.items.forEach((item) => {
      totalCostOfGoodsSold += item.quantity * (item.buyPrice || 0);
    });
  });

  const grossProfit = Math.max(0, totalRevenue - totalCostOfGoodsSold);
  const profitMargin = totalRevenue > 0 ? Math.round((grossProfit / totalRevenue) * 100) : 0;

  // Inventory valuation
  const inventoryCostValue = products.reduce((sum, p) => sum + p.stock * p.buyPrice, 0);
  const inventorySalesValue = products.reduce((sum, p) => sum + p.stock * p.sellPrice, 0);
  const potentialInventoryProfit = Math.max(0, inventorySalesValue - inventoryCostValue);

  // Top selling products
  const productSalesMap: Record<string, { name: string; quantity: number; totalAmount: number }> = {};
  invoices.forEach((inv) => {
    inv.items.forEach((item) => {
      if (!productSalesMap[item.productId]) {
        productSalesMap[item.productId] = {
          name: item.productName,
          quantity: 0,
          totalAmount: 0,
        };
      }
      productSalesMap[item.productId].quantity += item.quantity;
      productSalesMap[item.productId].totalAmount += item.total;
    });
  });

  const topSellingProducts = Object.values(productSalesMap)
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 5);

  // Critical Low Stock Products
  const lowStockProducts = products
    .filter((p) => p.stock <= p.minStockAlert)
    .sort((a, b) => a.stock - b.stock);

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-indigo-50 text-indigo-700">
              <TrendingUp className="w-5 h-5" />
            </span>
            <h2 className="text-xl font-bold text-slate-800">گزارشات مالی، سود و تحلیل انبار</h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            بررسی درآمد کل، سود ناخالص فروش، ارزش دارایی‌های انبار و کالاهای پرفروش
          </p>
        </div>
      </div>

      {/* Main KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Revenue */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold">فروش و درآمد کل</span>
            <span className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
              <DollarSign className="w-4 h-4" />
            </span>
          </div>
          <div className="text-lg sm:text-xl font-black text-slate-900">
            {formatPrice(totalRevenue, settings.currency)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            بر اساس {toPersianDigits(invoices.length)} فاکتور ثبت شده
          </div>
        </div>

        {/* Gross Profit */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold">سود ناخالص برآوردی</span>
            <span className="p-2 rounded-xl bg-blue-50 text-blue-600">
              <TrendingUp className="w-4 h-4" />
            </span>
          </div>
          <div className="text-lg sm:text-xl font-black text-emerald-700">
            {formatPrice(grossProfit, settings.currency)}
          </div>
          <div className="text-[11px] text-emerald-600 font-semibold mt-1 flex items-center gap-1">
            <ArrowUpRight className="w-3.5 h-3.5" />
            <span>حاشیه سود: {toPersianDigits(profitMargin)}٪</span>
          </div>
        </div>

        {/* Cost of Goods Sold */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold">بهای تمام شده فروش (COGS)</span>
            <span className="p-2 rounded-xl bg-slate-100 text-slate-600">
              <ShoppingBag className="w-4 h-4" />
            </span>
          </div>
          <div className="text-lg sm:text-xl font-black text-slate-700">
            {formatPrice(totalCostOfGoodsSold, settings.currency)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            قیمت خرید کالاهای فروخته شده
          </div>
        </div>

        {/* Stock Capital Value */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold">سرمایه راکد در انبار (خرید)</span>
            <span className="p-2 rounded-xl bg-purple-50 text-purple-600">
              <Boxes className="w-4 h-4" />
            </span>
          </div>
          <div className="text-lg sm:text-xl font-black text-purple-700">
            {formatPrice(inventoryCostValue, settings.currency)}
          </div>
          <div className="text-[11px] text-purple-600 mt-1">
            ارزش فروش: {formatPrice(inventorySalesValue, settings.currency)}
          </div>
        </div>
      </div>

      {/* Two Column Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Selling Products */}
        <div id="reports-top-selling-card" className="p-4 sm:p-6 bg-white rounded-2xl shadow-sm border border-slate-100">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Award className="w-4 h-4 text-amber-500" />
              <h3 className="font-bold text-slate-800 text-sm">پرفروش‌ترین کالاها</h3>
            </div>
            <span className="text-xs text-slate-400">بر اساس تعداد فروش در فاکتورها</span>
          </div>

          {topSellingProducts.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-xs">
              هنوز کالایی به فروش نرسیده است.
            </div>
          ) : (
            <div className="space-y-3">
              {topSellingProducts.map((item, idx) => (
                <div
                  key={idx}
                  className={`flex items-center justify-between p-3 rounded-xl ${
                    idx % 2 === 1 ? 'bg-slate-100/80' : 'bg-slate-50/50'
                  } border border-slate-200/70 hover:border-slate-300 transition-colors text-xs`}
                >
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-slate-200 text-slate-700 font-bold flex items-center justify-center text-[11px]">
                      {toPersianDigits(idx + 1)}
                    </span>
                    <div>
                      <h4 className="font-bold text-slate-800">{item.name}</h4>
                      <span className="text-[11px] text-slate-500">
                        تعداد فروش: <strong className="text-slate-800">{toPersianDigits(item.quantity)}</strong>
                      </span>
                    </div>
                  </div>

                  <div className="text-left font-bold text-emerald-700">
                    {formatPrice(item.totalAmount, settings.currency)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Low Stock Warning & Replenish List */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <span className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 border border-rose-100 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-4 h-4" />
              </span>
              <div>
                <h3 className="font-extrabold text-slate-800 text-sm">کالاهای نیازمند تامین فوری انبار</h3>
                <span className="text-[11px] text-slate-400 font-medium">موجودی به زیر حداقل نقطه سفارش رسیده</span>
              </div>
            </div>
            {(!currentUser || currentUser.permissions.canManageInventory) && (
              <button
                type="button"
                onClick={onOpenInventory}
                className="text-xs font-bold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-xl transition-colors cursor-pointer"
              >
                مدیریت انبار
              </button>
            )}
          </div>

          {lowStockProducts.length === 0 ? (
            <div className="text-center py-8 text-emerald-600 text-xs">
              تمامی کالاها موجودی کافی و بالاتر از حد مجاز دارند.
            </div>
          ) : (
            <div className="space-y-3">
              {lowStockProducts.map((prod, idx) => (
                <div
                  key={prod.id}
                  className={`flex items-center justify-between p-3 rounded-xl ${
                    idx % 2 === 1 ? 'bg-amber-100/60' : 'bg-amber-50/40'
                  } border border-amber-200 text-xs`}
                >
                  <div>
                    <h4 className="font-bold text-slate-800">{prod.name}</h4>
                    <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-500">
                      <span>کد: {prod.code}</span>
                      <span>حداقل مجاز: {toPersianDigits(prod.minStockAlert)} {prod.unit}</span>
                    </div>
                  </div>

                  <div className="text-center">
                    <span
                      className={`px-3 py-1 rounded-full font-bold text-xs ${
                        prod.stock === 0 ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {prod.stock === 0 ? 'ناموجود' : `مانده: ${toPersianDigits(prod.stock)} ${prod.unit}`}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
