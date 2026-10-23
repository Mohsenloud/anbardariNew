import React, { useState, useMemo } from 'react';
import { 
  PurchaseInvoice, 
  Product, 
  InboundReceipt, 
  StoreSettings, 
  AppUser 
} from '../types';
import { toPersianDigits, toEnglishDigits, formatPrice } from '../utils/jalali';
import { NewPurchaseInvoiceModal } from './NewPurchaseInvoiceModal';
import { PurchaseInvoiceViewModal } from './PurchaseInvoiceViewModal';
import { 
  Plus, 
  Search, 
  ShoppingBag, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  Eye, 
  Trash2, 
  PackageCheck,
  Edit3,
  BarChart3,
  Package,
  ChevronDown,
  ChevronUp,
  X
} from 'lucide-react';

interface PurchaseInvoiceManagerProps {
  purchaseInvoices: PurchaseInvoice[];
  products: Product[];
  inboundReceipts: InboundReceipt[];
  settings: StoreSettings;
  currentUser?: AppUser;
  onSavePurchaseInvoice: (
    invoice: PurchaseInvoice,
    receipt: InboundReceipt,
    newProducts: Product[]
  ) => void;
  onDeletePurchaseInvoice: (invoiceId: string) => void;
  onNavigateToWarehouseReceipt?: (receiptId: string) => void;
}

export const PurchaseInvoiceManager: React.FC<PurchaseInvoiceManagerProps> = ({
  purchaseInvoices,
  products,
  settings,
  currentUser,
  onSavePurchaseInvoice,
  onDeletePurchaseInvoice,
  onNavigateToWarehouseReceipt,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending_receipt' | 'completed' | 'has_discrepancy' | 'unpaid'>('all');
  const [showStats, setShowStats] = useState(false);
  const [productStatsSearch, setProductStatsSearch] = useState('');
  const [productStatsSort, setProductStatsSort] = useState<'totalSpent' | 'totalQty' | 'invoiceCount' | 'lastDate'>('totalSpent');
  const [expandedStatProductKey, setExpandedStatProductKey] = useState<string | null>(null);

  // Modals
  const [isNewPurchaseModalOpen, setIsNewPurchaseModalOpen] = useState(false);
  const [editingPurchaseInvoice, setEditingPurchaseInvoice] = useState<PurchaseInvoice | null>(null);
  const [viewingPurchaseInvoice, setViewingPurchaseInvoice] = useState<PurchaseInvoice | null>(null);
  const [invoiceToDelete, setInvoiceToDelete] = useState<PurchaseInvoice | null>(null);

  const previousSuppliers = Array.from(
    new Set(purchaseInvoices.map((inv) => inv.supplierName).filter(Boolean))
  );

  const filteredInvoices = purchaseInvoices.filter((inv) => {
    const matchesSearch =
      inv.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inv.supplierName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (inv.notes && inv.notes.toLowerCase().includes(searchQuery.toLowerCase())) ||
      inv.items.some((i) => i.productName.toLowerCase().includes(searchQuery.toLowerCase()));

    let matchesStatus = true;
    if (statusFilter === 'pending_receipt') {
      matchesStatus = inv.status === 'pending_receipt';
    } else if (statusFilter === 'completed') {
      matchesStatus = inv.status === 'completed';
    } else if (statusFilter === 'has_discrepancy') {
      matchesStatus = inv.status === 'has_discrepancy';
    } else if (statusFilter === 'unpaid') {
      matchesStatus = inv.paymentStatus === 'unpaid' || inv.paymentStatus === 'partial';
    }

    return matchesSearch && matchesStatus;
  });

  const totalPurchasesAmount = purchaseInvoices.reduce((sum, inv) => sum + inv.finalTotal, 0);
  const pendingReceiptCount = purchaseInvoices.filter((inv) => inv.status === 'pending_receipt').length;
  const discrepancyCount = purchaseInvoices.filter((inv) => inv.status === 'has_discrepancy').length;
  const unpaidCount = purchaseInvoices.filter((inv) => inv.paymentStatus !== 'paid').length;

  // Per-Product Purchase Report Aggregation
  const productPurchaseStats = useMemo(() => {
    interface ProductPurchaseRecord {
      invoiceId: string;
      invoiceNumber: string;
      date: string;
      supplierName: string;
      quantity: number;
      buyPrice: number;
      total: number;
      invoiceRef: PurchaseInvoice;
    }

    interface ProductStatEntry {
      key: string;
      productId: string;
      productName: string;
      productCode: string;
      unit: string;
      currentStock?: number;
      totalQuantity: number;
      totalSpent: number;
      invoiceCount: number;
      minBuyPrice: number;
      maxBuyPrice: number;
      lastBuyPrice: number;
      lastPurchaseDate: string;
      lastSupplierName: string;
      records: ProductPurchaseRecord[];
    }

    const map = new Map<string, ProductStatEntry>();

    // Sort invoices chronologically ascending so the latest processed updates lastPurchaseDate
    const sortedInvoices = [...purchaseInvoices].sort((a, b) =>
      toEnglishDigits(a.date || '').localeCompare(toEnglishDigits(b.date || ''))
    );

    sortedInvoices.forEach((inv) => {
      inv.items.forEach((item) => {
        const key = item.productId || item.productName.trim().toLowerCase();
        if (!key) return;

        const matchedProduct = products.find(
          (p) => p.id === item.productId || p.name.trim().toLowerCase() === item.productName.trim().toLowerCase()
        );

        const existing = map.get(key);
        const qty = Number(item.quantity) || 0;
        const price = Number(item.buyPrice) || 0;
        const rowTotal = Number(item.total) || qty * price;

        const record: ProductPurchaseRecord = {
          invoiceId: inv.id,
          invoiceNumber: inv.invoiceNumber,
          date: inv.date,
          supplierName: inv.supplierName || 'نامشخص',
          quantity: qty,
          buyPrice: price,
          total: rowTotal,
          invoiceRef: inv,
        };

        if (!existing) {
          map.set(key, {
            key,
            productId: item.productId || matchedProduct?.id || '',
            productName: matchedProduct?.name || item.productName,
            productCode: matchedProduct?.code || item.productCode || '---',
            unit: matchedProduct?.unit || item.unit || 'عدد',
            currentStock: matchedProduct?.stock,
            totalQuantity: qty,
            totalSpent: rowTotal,
            invoiceCount: 1,
            minBuyPrice: price,
            maxBuyPrice: price,
            lastBuyPrice: price,
            lastPurchaseDate: inv.date,
            lastSupplierName: inv.supplierName || 'نامشخص',
            records: [record],
          });
        } else {
          existing.totalQuantity += qty;
          existing.totalSpent += rowTotal;
          existing.invoiceCount += 1;
          if (price > 0) {
            existing.minBuyPrice = existing.minBuyPrice > 0 ? Math.min(existing.minBuyPrice, price) : price;
            existing.maxBuyPrice = Math.max(existing.maxBuyPrice, price);
            existing.lastBuyPrice = price;
          }
          existing.lastPurchaseDate = inv.date;
          existing.lastSupplierName = inv.supplierName || existing.lastSupplierName;
          existing.records.unshift(record); // newest first in records list
        }
      });
    });

    const q = toEnglishDigits(productStatsSearch.trim()).toLowerCase();
    let list = Array.from(map.values());

    if (q) {
      list = list.filter(
        (it) =>
          it.productName.toLowerCase().includes(q) ||
          toEnglishDigits(it.productCode).toLowerCase().includes(q) ||
          it.lastSupplierName.toLowerCase().includes(q)
      );
    }

    list.sort((a, b) => {
      if (productStatsSort === 'totalQty') return b.totalQuantity - a.totalQuantity;
      if (productStatsSort === 'invoiceCount') return b.invoiceCount - a.invoiceCount;
      if (productStatsSort === 'lastDate') {
        return toEnglishDigits(b.lastPurchaseDate).localeCompare(toEnglishDigits(a.lastPurchaseDate));
      }
      return b.totalSpent - a.totalSpent;
    });

    return list;
  }, [purchaseInvoices, products, productStatsSearch, productStatsSort]);

  const handleConfirmDelete = () => {
    if (invoiceToDelete) {
      onDeletePurchaseInvoice(invoiceToDelete.id);
      setInvoiceToDelete(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Compact Header Bar */}
      <div className="flex items-center justify-between gap-3 bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200/60 flex items-center justify-center shrink-0">
            <ShoppingBag className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div className="flex items-center gap-2 min-w-0">
            <h1 className="text-sm sm:text-lg font-black text-slate-900 truncate">
              فاکتورهای خرید کالا
            </h1>
            <span className="text-[11px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full font-bold shrink-0">
              {toPersianDigits(purchaseInvoices.length)} سند
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setShowStats(!showStats)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
              showStats
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
            }`}
            title="نمایش / پنهان کردن خلاصه آمار خرید"
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">آمار خرید</span>
          </button>

          <button
            type="button"
            onClick={() => setIsNewPurchaseModalOpen(true)}
            className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm active:scale-95 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>ثبت فاکتور خرید</span>
          </button>
        </div>
      </div>

      {/* Collapsible KPI Strip + Per-Product Purchase Report */}
      {showStats && (
        <div className="space-y-3 animate-in fade-in duration-150">
          {/* 4 Summary KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs">
              <div className="text-[11px] text-slate-500">مجموع کل خریدها:</div>
              <div className="text-sm font-black text-slate-900 font-mono mt-0.5">
                {toPersianDigits(formatPrice(totalPurchasesAmount))} <span className="text-[10px] font-normal">تومان</span>
              </div>
            </div>

            <div className="bg-white p-3 rounded-2xl border border-blue-200 shadow-2xs">
              <div className="text-[11px] text-blue-700">در انتظار ورود به انبار:</div>
              <div className="text-sm font-black text-blue-900 font-mono mt-0.5">
                {toPersianDigits(pendingReceiptCount)} <span className="text-[10px] font-normal">حواله</span>
              </div>
            </div>

            <div className="bg-white p-3 rounded-2xl border border-amber-200 shadow-2xs">
              <div className="text-[11px] text-amber-700">دارای مغایرت شمارش:</div>
              <div className="text-sm font-black text-amber-900 font-mono mt-0.5">
                {toPersianDigits(discrepancyCount)} <span className="text-[10px] font-normal">مورد</span>
              </div>
            </div>

            <div className="bg-white p-3 rounded-2xl border border-rose-200 shadow-2xs">
              <div className="text-[11px] text-rose-700">تسویه نشده / نسیه:</div>
              <div className="text-sm font-black text-rose-900 font-mono mt-0.5">
                {toPersianDigits(unpaidCount)} <span className="text-[10px] font-normal">فاکتور</span>
              </div>
            </div>
          </div>

          {/* Per-Product Purchase Statistics & Report */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-3 sm:p-3.5 bg-slate-50/80 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                  <Package className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xs sm:text-sm font-black text-slate-900">
                      گزارش آمار خرید به تفکیک هر کالا / محصول
                    </h2>
                    <span className="text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-full">
                      {toPersianDigits(productPurchaseStats.length)} کالا
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    مجموع تعداد خریداری‌شده، میانگین و آخرین قیمت خرید هر کالا (برای مشاهده ریز فاکتورهای هر کالا روی آن کلیک کنید)
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Search inside product report */}
                <div className="relative flex-1 sm:w-56">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={productStatsSearch}
                    onChange={(e) => setProductStatsSearch(e.target.value)}
                    placeholder="جستجوی نام کالا، کد یا تامین‌کننده..."
                    className="w-full h-8 pr-8 pl-7 text-xs rounded-xl border border-slate-300 bg-white focus:outline-none focus:border-emerald-500"
                  />
                  {productStatsSearch && (
                    <button
                      type="button"
                      onClick={() => setProductStatsSearch('')}
                      className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {/* Sort selector */}
                <select
                  value={productStatsSort}
                  onChange={(e) => setProductStatsSort(e.target.value as any)}
                  className="h-8 px-2.5 text-xs font-bold text-slate-700 bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-emerald-500 cursor-pointer"
                >
                  <option value="totalSpent">مرتب‌سازی: بیشترین مبلغ خرید</option>
                  <option value="totalQty">مرتب‌سازی: بیشترین تعداد خرید</option>
                  <option value="invoiceCount">مرتب‌سازی: بیشترین دفعات خرید</option>
                  <option value="lastDate">مرتب‌سازی: جدیدترین خرید</option>
                </select>
              </div>
            </div>

            {productPurchaseStats.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                هیچ سابقه خریدی برای کالاها یافت نشد.
              </div>
            ) : (
              <div className="overflow-x-auto max-h-96">
                <table className="w-full text-right border-collapse text-xs">
                  <thead className="sticky top-0 z-10 bg-slate-100 text-slate-700 border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3 font-bold text-center w-9">#</th>
                      <th className="py-2.5 px-3 font-bold">نام و کد کالا</th>
                      <th className="py-2.5 px-3 font-bold text-center">دفعات خرید</th>
                      <th className="py-2.5 px-3 font-bold text-center">مجموع تعداد خرید</th>
                      <th className="py-2.5 px-3 font-bold text-center">میانگین قیمت واحد</th>
                      <th className="py-2.5 px-3 font-bold text-center">آخرین قیمت خرید</th>
                      <th className="py-2.5 px-3 font-bold text-left">مجموع مبلغ خرید</th>
                      <th className="py-2.5 px-3 font-bold text-center w-20">ریز خرید</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {productPurchaseStats.map((stat, idx) => {
                      const avgPrice = stat.totalQuantity > 0 ? Math.round(stat.totalSpent / stat.totalQuantity) : 0;
                      const isExpanded = expandedStatProductKey === stat.key;
                      const sharePercent =
                        totalPurchasesAmount > 0
                          ? Math.min(100, Math.round((stat.totalSpent / totalPurchasesAmount) * 100))
                          : 0;

                      return (
                        <React.Fragment key={stat.key}>
                          <tr
                            onClick={() => setExpandedStatProductKey(isExpanded ? null : stat.key)}
                            className={`transition-colors cursor-pointer ${
                              isExpanded
                                ? 'bg-emerald-50/70'
                                : idx % 2 === 1
                                ? 'bg-slate-50/50 hover:bg-emerald-50/30'
                                : 'bg-white hover:bg-emerald-50/30'
                            }`}
                          >
                            <td className="py-2.5 px-3 text-center font-mono text-slate-400 font-bold text-[11px]">
                              {toPersianDigits(idx + 1)}
                            </td>

                            <td className="py-2.5 px-3">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200 shrink-0">
                                  {toPersianDigits(stat.productCode)}
                                </span>
                                <span className="font-bold text-slate-900">{stat.productName}</span>
                                {typeof stat.currentStock === 'number' && (
                                  <span className="text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                                    موجودی فعلی: <strong className="font-mono text-slate-800">{toPersianDigits(stat.currentStock)}</strong> {stat.unit}
                                  </span>
                                )}
                              </div>
                            </td>

                            <td className="py-2.5 px-3 text-center whitespace-nowrap">
                              <span className="font-mono font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md">
                                {toPersianDigits(stat.invoiceCount)} فاکتور
                              </span>
                            </td>

                            <td className="py-2.5 px-3 text-center whitespace-nowrap">
                              <span className="font-mono font-black text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-lg">
                                {toPersianDigits(stat.totalQuantity)} <span className="font-normal text-[10px]">{stat.unit}</span>
                              </span>
                            </td>

                            <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-700 whitespace-nowrap">
                              {toPersianDigits(formatPrice(avgPrice))} <span className="text-[10px] font-normal text-slate-400">تومان</span>
                            </td>

                            <td className="py-2.5 px-3 text-center whitespace-nowrap">
                              <div className="font-mono font-bold text-slate-900">
                                {toPersianDigits(formatPrice(stat.lastBuyPrice))} <span className="text-[10px] font-normal text-slate-400">تومان</span>
                              </div>
                              <div className="text-[10px] text-slate-400">
                                {toPersianDigits(stat.lastPurchaseDate)} • {stat.lastSupplierName}
                              </div>
                            </td>

                            <td className="py-2.5 px-3 text-left whitespace-nowrap">
                              <div className="flex items-center justify-end gap-1.5">
                                <span className="font-mono font-black text-slate-900">
                                  {toPersianDigits(formatPrice(stat.totalSpent))} <span className="text-[10px] font-normal text-slate-500">تومان</span>
                                </span>
                                <span className="text-[10px] font-mono font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                                  {toPersianDigits(sharePercent)}٪
                                </span>
                              </div>
                            </td>

                            <td className="py-2.5 px-3 text-center">
                              <button
                                type="button"
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-100 hover:bg-emerald-100 text-slate-700 hover:text-emerald-900 text-[11px] font-bold transition-colors cursor-pointer"
                              >
                                <span>سوابق</span>
                                {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                              </button>
                            </td>
                          </tr>

                          {isExpanded && (
                            <tr className="bg-slate-50/90 border-b border-slate-200">
                              <td colSpan={8} className="p-3">
                                <div className="bg-white rounded-xl border border-emerald-200 p-2.5 space-y-2">
                                  <div className="flex items-center justify-between text-[11px] font-bold text-emerald-900 border-b border-slate-100 pb-1.5">
                                    <span>
                                      ریز فاکتورهای خرید کالای «{stat.productName}» ({toPersianDigits(stat.records.length)} مورد)
                                    </span>
                                    <span className="text-slate-500 font-normal">
                                      کمترین قیمت: <strong className="font-mono text-slate-800">{toPersianDigits(formatPrice(stat.minBuyPrice))}</strong> ت | بیشترین قیمت: <strong className="font-mono text-slate-800">{toPersianDigits(formatPrice(stat.maxBuyPrice))}</strong> ت
                                    </span>
                                  </div>

                                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                    {stat.records.map((rec, rIdx) => (
                                      <div
                                        key={`${rec.invoiceId}-${rIdx}`}
                                        className="p-2 rounded-lg bg-slate-50 border border-slate-200/80 flex items-center justify-between gap-2 text-[11px]"
                                      >
                                        <div className="min-w-0 space-y-0.5">
                                          <div className="flex items-center gap-1.5">
                                            <span className="font-mono font-black text-slate-900 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                                              {toPersianDigits(rec.invoiceNumber)}
                                            </span>
                                            <span className="font-mono text-slate-500">
                                              {toPersianDigits(rec.date)}
                                            </span>
                                          </div>
                                          <div className="text-slate-700 font-bold truncate">
                                            تامین‌کننده: {rec.supplierName}
                                          </div>
                                          <div className="text-slate-500 font-mono">
                                            {toPersianDigits(rec.quantity)} {stat.unit} × {toPersianDigits(formatPrice(rec.buyPrice))} ={' '}
                                            <strong className="text-emerald-800">{toPersianDigits(formatPrice(rec.total))} ت</strong>
                                          </div>
                                        </div>

                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setViewingPurchaseInvoice(rec.invoiceRef);
                                          }}
                                          className="px-2 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold text-[10px] shrink-0 cursor-pointer flex items-center gap-1"
                                        >
                                          <Eye className="w-3 h-3" />
                                          <span>فاکتور</span>
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main Container: Unified Toolbar + Table/Cards */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        {/* Filter and Search Bar */}
        <div className="p-3 sm:p-3.5 border-b border-slate-200/80 bg-slate-50/60 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="جستجوی شماره فاکتور، تامین‌کننده، کالا..."
              className="w-full pr-9 pl-8 py-1.5 text-xs rounded-xl border border-slate-200/90 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 shadow-2xs"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Status Filters */}
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar bg-slate-200/60 p-1 rounded-xl text-xs font-bold">
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`px-2.5 py-1 rounded-lg whitespace-nowrap transition-all cursor-pointer ${
                statusFilter === 'all'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              همه ({toPersianDigits(purchaseInvoices.length)})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('pending_receipt')}
              className={`px-2.5 py-1 rounded-lg whitespace-nowrap transition-all cursor-pointer ${
                statusFilter === 'pending_receipt'
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              منتظر ورود ({toPersianDigits(pendingReceiptCount)})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('completed')}
              className={`px-2.5 py-1 rounded-lg whitespace-nowrap transition-all cursor-pointer ${
                statusFilter === 'completed'
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              تایید انبار
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('has_discrepancy')}
              className={`px-2.5 py-1 rounded-lg whitespace-nowrap transition-all cursor-pointer ${
                statusFilter === 'has_discrepancy'
                  ? 'bg-amber-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              دارای مغایرت ({toPersianDigits(discrepancyCount)})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('unpaid')}
              className={`px-2.5 py-1 rounded-lg whitespace-nowrap transition-all cursor-pointer ${
                statusFilter === 'unpaid'
                  ? 'bg-rose-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              نسیه ({toPersianDigits(unpaidCount)})
            </button>
          </div>
        </div>

        {/* Invoices List */}
        {filteredInvoices.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-2.5">
              <ShoppingBag className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-slate-700 text-sm">
              فاکتور خریدی یافت نشد
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              {searchQuery
                ? 'موردی با مشخصات جستجو شده پیدا نشد.'
                : 'هنوز فاکتور خریدی ثبت نشده است.'}
            </p>
          </div>
        ) : (
          <>
            {/* Mobile View: Compact 2-Row Cards */}
            <div className="block sm:hidden divide-y divide-slate-100">
              {filteredInvoices.map((inv, index) => {
                const hasDiscrepancy = inv.status === 'has_discrepancy';
                const isPending = inv.status === 'pending_receipt';

                return (
                  <div
                    key={inv.id}
                    onClick={() => setViewingPurchaseInvoice(inv)}
                    className={`p-3 space-y-2 transition-colors cursor-pointer active:bg-slate-100 ${
                      index % 2 === 1 ? 'bg-slate-50/60' : 'bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-black text-xs text-slate-900 bg-slate-100 px-2 py-0.5 rounded-lg border border-slate-200">
                          {toPersianDigits(inv.invoiceNumber)}
                        </span>
                        <span className="text-[11px] text-slate-500 font-mono">
                          {toPersianDigits(inv.date)}
                        </span>
                      </div>

                      {isPending ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                          منتظر ورود انبار
                        </span>
                      ) : hasDiscrepancy ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                          دارای مغایرت
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                          تایید شده انبار
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100 text-xs">
                      <div className="min-w-0">
                        <div className="font-bold text-slate-900 truncate">
                          {inv.supplierName || 'تامین‌کننده ثبت‌نشده'}
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono">
                          {toPersianDigits(formatPrice(inv.finalTotal))} تومان • {toPersianDigits(inv.items.length)} قلم
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                        {inv.inboundReceiptId && onNavigateToWarehouseReceipt && (
                          <button
                            type="button"
                            onClick={() => onNavigateToWarehouseReceipt(inv.inboundReceiptId!)}
                            className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200"
                            title="حواله انبار"
                          >
                            <PackageCheck className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setEditingPurchaseInvoice(inv)}
                          className="p-1.5 rounded-lg bg-slate-100 text-slate-700"
                          title="ویرایش"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setViewingPurchaseInvoice(inv)}
                          className="px-2.5 py-1 rounded-lg bg-slate-900 text-white text-[11px] font-bold"
                        >
                          مشاهده
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop View: Ultra-Clean Single-Row Table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-right border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100/70 text-slate-700 border-b border-slate-200 select-none">
                    <th className="py-3 px-3 font-bold text-center w-10">#</th>
                    <th className="py-3 px-3 font-bold">شماره فاکتور</th>
                    <th className="py-3 px-3 font-bold">تامین‌کننده / فروشنده</th>
                    <th className="py-3 px-3 font-bold text-center">تاریخ خرید</th>
                    <th className="py-3 px-3 font-bold text-center">اقلام</th>
                    <th className="py-3 px-3 font-bold text-left">مبلغ کل و تسویه</th>
                    <th className="py-3 px-3 font-bold text-center">وضعیت ورود انبار</th>
                    <th className="py-3 px-3 font-bold text-center w-44">عملیات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredInvoices.map((inv, index) => {
                    const hasDiscrepancy = inv.status === 'has_discrepancy';
                    const isPending = inv.status === 'pending_receipt';
                    const isPaid = inv.paymentStatus === 'paid';

                    return (
                      <tr
                        key={inv.id}
                        onClick={() => setViewingPurchaseInvoice(inv)}
                        className={`${
                          index % 2 === 1 ? 'bg-slate-50/60' : 'bg-white'
                        } hover:bg-emerald-50/40 transition-colors cursor-pointer group`}
                      >
                        <td className="py-3 px-3 text-center font-mono text-slate-400 font-bold text-[11px]">
                          {toPersianDigits(index + 1)}
                        </td>

                        <td className="py-3 px-3">
                          <span className="font-mono font-black text-slate-900 bg-slate-100 group-hover:bg-white px-2.5 py-1 rounded-lg border border-slate-200">
                            {toPersianDigits(inv.invoiceNumber)}
                          </span>
                        </td>

                        <td className="py-3 px-3">
                          <div className="font-bold text-slate-900 truncate max-w-[200px]" title={inv.supplierName}>
                            {inv.supplierName || 'تامین‌کننده ثبت‌نشده'}
                          </div>
                        </td>

                        <td className="py-3 px-3 text-center font-mono text-slate-600 whitespace-nowrap">
                          {toPersianDigits(inv.date)}
                        </td>

                        <td className="py-3 px-3 text-center whitespace-nowrap">
                          <span className="font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md">
                            {toPersianDigits(inv.items.length)} قلم
                          </span>
                        </td>

                        <td className="py-3 px-3 text-left whitespace-nowrap">
                          <div className="flex items-center justify-end gap-2">
                            <span className="font-black font-mono text-slate-900">
                              {toPersianDigits(formatPrice(inv.finalTotal))} <span className="text-[10px] font-normal text-slate-500">تومان</span>
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                isPaid
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                  : 'bg-rose-50 text-rose-800 border-rose-200'
                              }`}
                            >
                              {isPaid ? 'تسویه' : 'نسیه'}
                            </span>
                          </div>
                        </td>

                        <td className="py-3 px-3 text-center whitespace-nowrap">
                          {isPending ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-800 border border-blue-200">
                              <Clock className="w-3 h-3 text-blue-600" />
                              <span>منتظر ورود</span>
                            </span>
                          ) : hasDiscrepancy ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-300">
                              <AlertTriangle className="w-3 h-3 text-amber-600" />
                              <span>دارای مغایرت</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              <span>تایید انبار</span>
                            </span>
                          )}
                        </td>

                        <td className="py-3 px-3 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1" onClick={(e) => e.stopPropagation()}>
                            {inv.inboundReceiptId && onNavigateToWarehouseReceipt && (
                              <button
                                type="button"
                                onClick={() => onNavigateToWarehouseReceipt(inv.inboundReceiptId!)}
                                className="p-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 transition-colors cursor-pointer"
                                title="مشاهده حواله ورود در انبار"
                              >
                                <PackageCheck className="w-3.5 h-3.5" />
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => setViewingPurchaseInvoice(inv)}
                              className="px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>مشاهده</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => setEditingPurchaseInvoice(inv)}
                              className="p-1.5 rounded-xl text-slate-600 hover:text-emerald-700 hover:bg-slate-100 transition-colors cursor-pointer"
                              title="ویرایش فاکتور خرید"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>

                            <button
                              type="button"
                              onClick={() => setInvoiceToDelete(inv)}
                              className="p-1.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                              title="حذف فاکتور خرید"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* New / Edit Purchase Invoice Modal */}
      {(isNewPurchaseModalOpen || editingPurchaseInvoice) && (
        <NewPurchaseInvoiceModal
          products={products}
          settings={settings}
          currentUser={currentUser}
          previousSuppliers={previousSuppliers}
          editingInvoice={editingPurchaseInvoice}
          onClose={() => {
            setIsNewPurchaseModalOpen(false);
            setEditingPurchaseInvoice(null);
          }}
          onSavePurchase={(savedInv, savedRec, newProds) => {
            onSavePurchaseInvoice(savedInv, savedRec, newProds);
            setIsNewPurchaseModalOpen(false);
            setEditingPurchaseInvoice(null);
          }}
        />
      )}

      {/* Viewing & Printing Modal */}
      {viewingPurchaseInvoice && (
        <PurchaseInvoiceViewModal
          invoice={viewingPurchaseInvoice}
          settings={settings}
          currentUser={currentUser}
          onClose={() => setViewingPurchaseInvoice(null)}
          onEdit={(inv) => {
            setViewingPurchaseInvoice(null);
            setEditingPurchaseInvoice(inv);
          }}
          onOpenReceipt={(receiptId) => {
            if (onNavigateToWarehouseReceipt) {
              onNavigateToWarehouseReceipt(receiptId);
            }
          }}
        />
      )}

      {/* Delete Confirmation Modal */}
      {invoiceToDelete && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-slate-200">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-3">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-center text-slate-900 text-sm">
              حذف فاکتور خرید {toPersianDigits(invoiceToDelete.invoiceNumber)}
            </h3>
            <p className="text-xs text-center text-slate-500 mt-1">
              آیا از حذف این فاکتور خرید اطمینان دارید؟
            </p>
            <div className="flex items-center gap-2 mt-5">
              <button
                type="button"
                onClick={() => setInvoiceToDelete(null)}
                className="flex-1 py-2 rounded-xl border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-50 cursor-pointer"
              >
                انصراف
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="flex-1 py-2 rounded-xl bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 shadow-xs cursor-pointer"
              >
                بله، حذف شود
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
