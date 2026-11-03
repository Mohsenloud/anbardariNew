import React, { useState, useMemo } from 'react';
import { 
  PurchaseInvoice, 
  Product, 
  InboundReceipt, 
  StoreSettings, 
  AppUser,
  PaymentStatus,
  PaymentMethod
} from '../types';
import { toPersianDigits, toEnglishDigits, formatPrice, getCurrentJalaliDate } from '../utils/jalali';
import { NewPurchaseInvoiceModal } from './NewPurchaseInvoiceModal';
import { PurchaseInvoiceViewModal } from './PurchaseInvoiceViewModal';
import { NumericInput } from './NumericInput';
import { isPureServicePurchaseInvoice, hasServicePurchaseItems, isServiceItem } from '../utils/serviceHelper';
import { StorageService, PAYMENT_METHOD_LABELS } from '../utils/storage';
import { canUserCreatePurchase, canUserSettleInvoice, canUserDeleteInvoice } from '../utils/permissions';
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
  X,
  Wrench,
  CreditCard,
  Check,
  ShieldCheck,
  UserCheck,
  Building2,
  Calendar,
  Hash
} from 'lucide-react';

interface PurchaseInvoiceManagerProps {
  purchaseInvoices: PurchaseInvoice[];
  products: Product[];
  inboundReceipts: InboundReceipt[];
  settings: StoreSettings;
  currentUser?: AppUser;
  onSavePurchaseInvoice: (
    invoice: PurchaseInvoice,
    receipt: InboundReceipt | null,
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
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending_receipt' | 'completed' | 'has_discrepancy' | 'unpaid' | 'services'>('all');
  const [creatorFilter, setCreatorFilter] = useState<string>('all');
  const [showStats, setShowStats] = useState(false);
  const [productStatsSearch, setProductStatsSearch] = useState('');
  const [productStatsSort, setProductStatsSort] = useState<'totalSpent' | 'totalQty' | 'invoiceCount' | 'lastDate'>('totalSpent');
  const [expandedStatProductKey, setExpandedStatProductKey] = useState<string | null>(null);

  // Modals
  const [isNewPurchaseModalOpen, setIsNewPurchaseModalOpen] = useState(false);
  const [newModalInitialMode, setNewModalInitialMode] = useState<'product' | 'service'>('product');
  const [editingPurchaseInvoice, setEditingPurchaseInvoice] = useState<PurchaseInvoice | null>(null);
  const [viewingPurchaseInvoice, setViewingPurchaseInvoice] = useState<PurchaseInvoice | null>(null);
  const [invoiceToDelete, setInvoiceToDelete] = useState<PurchaseInvoice | null>(null);

  // Permission flags
  const canCreatePurchase = !currentUser || canUserCreatePurchase(currentUser);
  const canSettlePurchase = !currentUser || canUserSettleInvoice(currentUser);
  const canDeletePurchase = !currentUser || canUserDeleteInvoice(currentUser);

  // Quick Payment / Service Cost Settlement Modal State
  const [settlingInvoice, setSettlingInvoice] = useState<PurchaseInvoice | null>(null);
  const [settleStatus, setSettleStatus] = useState<PaymentStatus>('paid');
  const [settleMethod, setSettleMethod] = useState<PaymentMethod>('transfer');
  const [settlePaidAmount, setSettlePaidAmount] = useState<number>(0);
  const [settleTrackingDesc, setSettleTrackingDesc] = useState<string>('');
  const [settleChequeNumber, setSettleChequeNumber] = useState<string>('');
  const [settleChequeDueDate, setSettleChequeDueDate] = useState<string>('');

  const handleOpenSettleModal = (inv: PurchaseInvoice) => {
    if (!canSettlePurchase) return;
    setSettlingInvoice(inv);
    setSettleStatus(inv.paymentStatus === 'unpaid' ? 'paid' : inv.paymentStatus);
    setSettleMethod(inv.paymentMethod || 'transfer');
    setSettlePaidAmount(inv.paymentStatus === 'unpaid' ? inv.finalTotal : inv.paidAmount || inv.finalTotal);
    setSettleTrackingDesc(inv.transferDescription || '');
    setSettleChequeNumber(inv.chequeNumber || '');
    setSettleChequeDueDate(inv.chequeDueDate || '');
  };

  const handleSaveQuickSettlement = (e: React.FormEvent) => {
    e.preventDefault();
    if (!settlingInvoice) return;
    const finalPaid =
      settleStatus === 'paid'
        ? settlingInvoice.finalTotal
        : settleStatus === 'unpaid'
        ? 0
        : Math.min(settlingInvoice.finalTotal, Math.max(0, settlePaidAmount));
    const updatedInvoice: PurchaseInvoice = {
      ...settlingInvoice,
      paymentStatus: settleStatus,
      paymentMethod: settleMethod,
      paidAmount: finalPaid,
      transferDescription: settleTrackingDesc.trim() || undefined,
      chequeNumber: settleMethod === 'cheque' ? settleChequeNumber.trim() || undefined : settlingInvoice.chequeNumber,
      chequeDueDate: settleMethod === 'cheque' ? settleChequeDueDate.trim() || undefined : settlingInvoice.chequeDueDate,
      updatedAt: getCurrentJalaliDate(),
    };
    const existingReceipt = settlingInvoice.inboundReceiptId
      ? StorageService.getInboundReceipts().find((r) => r.id === settlingInvoice.inboundReceiptId) || null
      : null;
    onSavePurchaseInvoice(updatedInvoice, existingReceipt, []);
    setSettlingInvoice(null);
  };

  const previousSuppliers = Array.from(
    new Set(purchaseInvoices.map((inv) => inv.supplierName).filter(Boolean))
  );

  // Extract unique creators from purchase/service invoices for filter dropdown
  const availableCreators = useMemo(() => {
    const map = new Map<string, string>();
    purchaseInvoices.forEach((inv) => {
      const id = inv.createdById || inv.createdByName || 'system';
      const name = inv.createdByName || 'مدیر سیستم';
      if (!map.has(id)) {
        map.set(id, name);
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [purchaseInvoices]);

  const filteredInvoices = purchaseInvoices.filter((inv) => {
    const q = searchQuery.toLowerCase();
    const creatorName = (inv.createdByName || 'مدیر سیستم').toLowerCase();
    const creatorRole = (inv.createdByRole || '').toLowerCase();
    const matchesSearch =
      inv.invoiceNumber.toLowerCase().includes(q) ||
      inv.supplierName.toLowerCase().includes(q) ||
      creatorName.includes(q) ||
      creatorRole.includes(q) ||
      (inv.notes && inv.notes.toLowerCase().includes(q)) ||
      inv.items.some((i) => i.productName.toLowerCase().includes(q));

    let matchesStatus = true;
    if (statusFilter === 'pending_receipt') {
      matchesStatus = inv.status === 'pending_receipt';
    } else if (statusFilter === 'completed') {
      matchesStatus = inv.status === 'completed';
    } else if (statusFilter === 'has_discrepancy') {
      matchesStatus = inv.status === 'has_discrepancy';
    } else if (statusFilter === 'unpaid') {
      matchesStatus = inv.paymentStatus === 'unpaid' || inv.paymentStatus === 'partial';
    } else if (statusFilter === 'services') {
      matchesStatus = hasServicePurchaseItems(inv, products);
    }

    let matchesCreator = true;
    if (creatorFilter !== 'all') {
      const invCreatorKey = inv.createdById || inv.createdByName || 'system';
      matchesCreator = invCreatorKey === creatorFilter || inv.createdByName === creatorFilter;
    }

    return matchesSearch && matchesStatus && matchesCreator;
  });

  const totalPurchasesAmount = purchaseInvoices.reduce((sum, inv) => sum + inv.finalTotal, 0);
  const serviceInvoicesCount = purchaseInvoices.filter((inv) => hasServicePurchaseItems(inv, products)).length;
  const totalServicesSpent = purchaseInvoices.reduce((sum, inv) => {
    const srvSum = (inv.items || [])
      .filter((it) => isServiceItem(it, products))
      .reduce((s, it) => s + (it.total || 0), 0);
    return sum + srvSum;
  }, 0);
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
    <div className="space-y-3 sm:space-y-4">
      {/* Responsive Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="flex items-center justify-between gap-2 min-w-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200/60 flex items-center justify-center shrink-0">
              <ShoppingBag className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="flex items-center gap-2 min-w-0">
              <h1 className="text-sm sm:text-lg font-black text-slate-900 truncate">
                فاکتورهای خرید کالا و خدمات
              </h1>
              <span className="text-[11px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full font-bold shrink-0">
                {toPersianDigits(purchaseInvoices.length)} سند
              </span>
            </div>
          </div>

          {/* Mobile-only quick stats toggle right in top row */}
          <button
            type="button"
            onClick={() => setShowStats(!showStats)}
            className={`sm:hidden flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-[11px] font-bold transition-all cursor-pointer shrink-0 ${
              showStats
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
            }`}
            title="نمایش / پنهان کردن خلاصه آمار خرید"
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>آمار خرید</span>
          </button>
        </div>

        <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setShowStats(!showStats)}
            className={`hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
              showStats
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
            }`}
            title="نمایش / پنهان کردن خلاصه آمار خرید"
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>آمار خرید</span>
          </button>

          {canCreatePurchase ? (
            <>
              <button
                type="button"
                onClick={() => {
                  setNewModalInitialMode('service');
                  setIsNewPurchaseModalOpen(true);
                }}
                className="flex items-center justify-center gap-1.5 px-3 sm:px-3.5 py-2.5 sm:py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-sm active:scale-95 transition-all cursor-pointer"
                title="ثبت فاکتور خرید خدمات و پرداخت هزینه خدمات"
              >
                <Wrench className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">ثبت خرید خدمات / هزینه</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setNewModalInitialMode('product');
                  setIsNewPurchaseModalOpen(true);
                }}
                className="flex items-center justify-center gap-1.5 px-3 sm:px-4 py-2.5 sm:py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm active:scale-95 transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4 shrink-0" />
                <span className="truncate">ثبت فاکتور خرید کالا</span>
              </button>
            </>
          ) : (
            <div className="col-span-2 sm:col-span-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-50 text-purple-800 border border-purple-200 text-[11px] font-bold">
              <ShieldCheck className="w-3.5 h-3.5 text-purple-600 shrink-0" />
              <span>{canSettlePurchase ? 'مشاهده و تسویه مالی' : 'دسترسی فقط مشاهده'}</span>
            </div>
          )}
        </div>
      </div>

      {/* Collapsible KPI Strip + Per-Product Purchase Report */}
      {showStats && (
        <div className="space-y-3 animate-in fade-in duration-150">
          {/* 5 Summary KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
            <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs">
              <div className="text-[11px] text-slate-500">مجموع کل خریدها:</div>
              <div className="text-xs sm:text-sm font-black text-slate-900 font-mono mt-0.5">
                {toPersianDigits(formatPrice(totalPurchasesAmount))} <span className="text-[10px] font-normal">تومان</span>
              </div>
            </div>

            <div className="bg-white p-3 rounded-2xl border border-amber-200 shadow-2xs">
              <div className="text-[11px] text-amber-700">خرید خدمات و هزینه‌ها:</div>
              <div className="text-xs sm:text-sm font-black text-amber-900 font-mono mt-0.5">
                {toPersianDigits(formatPrice(totalServicesSpent))} <span className="text-[10px] font-normal">تومان ({toPersianDigits(serviceInvoicesCount)} سند)</span>
              </div>
            </div>

            <div className="bg-white p-3 rounded-2xl border border-blue-200 shadow-2xs">
              <div className="text-[11px] text-blue-700">در انتظار ورود به انبار:</div>
              <div className="text-xs sm:text-sm font-black text-blue-900 font-mono mt-0.5">
                {toPersianDigits(pendingReceiptCount)} <span className="text-[10px] font-normal">حواله</span>
              </div>
            </div>

            <div className="bg-white p-3 rounded-2xl border border-orange-200 shadow-2xs">
              <div className="text-[11px] text-orange-700">دارای مغایرت شمارش:</div>
              <div className="text-xs sm:text-sm font-black text-orange-900 font-mono mt-0.5">
                {toPersianDigits(discrepancyCount)} <span className="text-[10px] font-normal">مورد</span>
              </div>
            </div>

            <div className="col-span-2 sm:col-span-1 bg-white p-3 rounded-2xl border border-rose-200 shadow-2xs flex sm:block items-center justify-between">
              <div className="text-[11px] text-rose-700">تسویه نشده / نسیه:</div>
              <div className="text-xs sm:text-sm font-black text-rose-900 font-mono sm:mt-0.5">
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
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-xs sm:text-sm font-black text-slate-900">
                      گزارش آمار خرید به تفکیک هر کالا / خدمات
                    </h2>
                    <span className="text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-full">
                      {toPersianDigits(productPurchaseStats.length)} مورد
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    مجموع تعداد خریداری‌شده، میانگین و آخرین قیمت خرید هر کالا یا خدمت (روی هر ردیف کلیک کنید)
                  </p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                {/* Search inside product report */}
                <div className="relative flex-1 sm:w-56">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={productStatsSearch}
                    onChange={(e) => setProductStatsSearch(e.target.value)}
                    placeholder="جستجوی نام کالا، خدمات یا تامین‌کننده..."
                    className="w-full h-9 sm:h-8 pr-8 pl-7 text-xs rounded-xl border border-slate-300 bg-white focus:outline-none focus:border-emerald-500"
                  />
                  {productStatsSearch && (
                    <button
                      type="button"
                      onClick={() => setProductStatsSearch('')}
                      className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Sort selector */}
                <select
                  value={productStatsSort}
                  onChange={(e) => setProductStatsSort(e.target.value as any)}
                  className="h-9 sm:h-8 px-2.5 text-xs font-bold text-slate-700 bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-emerald-500 cursor-pointer"
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
                هیچ سابقه خریدی یافت نشد.
              </div>
            ) : (
              <>
                {/* Mobile Cards for Product Purchase Stats */}
                <div className="block sm:hidden divide-y divide-slate-100 max-h-96 overflow-y-auto">
                  {productPurchaseStats.map((stat, idx) => {
                    const avgPrice = stat.totalQuantity > 0 ? Math.round(stat.totalSpent / stat.totalQuantity) : 0;
                    const isExpanded = expandedStatProductKey === stat.key;
                    const sharePercent =
                      totalPurchasesAmount > 0
                        ? Math.min(100, Math.round((stat.totalSpent / totalPurchasesAmount) * 100))
                        : 0;

                    return (
                      <div key={stat.key} className="p-3 space-y-2">
                        <div
                          onClick={() => setExpandedStatProductKey(isExpanded ? null : stat.key)}
                          className="cursor-pointer space-y-2"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                              <span className="w-5 h-5 rounded-md bg-slate-100 text-slate-600 font-mono text-[10px] font-bold flex items-center justify-center shrink-0">
                                {toPersianDigits(idx + 1)}
                              </span>
                              <span className="font-bold text-xs text-slate-900 truncate">{stat.productName}</span>
                              <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">
                                {toPersianDigits(stat.productCode)}
                              </span>
                            </div>
                            <button
                              type="button"
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-100 text-slate-700 text-[10px] font-bold shrink-0"
                            >
                              <span>{toPersianDigits(stat.invoiceCount)} فاکتور</span>
                              {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                            </button>
                          </div>

                          <div className="grid grid-cols-3 gap-1.5 bg-slate-50 p-2 rounded-xl border border-slate-200/60 text-[11px]">
                            <div>
                              <span className="text-[10px] text-slate-400 block">مجموع خرید:</span>
                              <span className="font-mono font-black text-emerald-700">
                                {toPersianDigits(stat.totalQuantity)} {stat.unit}
                              </span>
                            </div>
                            <div>
                              <span className="text-[10px] text-slate-400 block">میانگین فی:</span>
                              <span className="font-mono font-bold text-slate-700">
                                {toPersianDigits(formatPrice(avgPrice))}
                              </span>
                            </div>
                            <div className="text-left">
                              <span className="text-[10px] text-slate-400 block">مبلغ کل ({toPersianDigits(sharePercent)}٪):</span>
                              <span className="font-mono font-black text-slate-900">
                                {toPersianDigits(formatPrice(stat.totalSpent))}
                              </span>
                            </div>
                          </div>
                        </div>

                        {isExpanded && (
                          <div className="pt-2 border-t border-slate-100 space-y-1.5">
                            {stat.records.map((rec, rIdx) => (
                              <div
                                key={`${rec.invoiceId}-${rIdx}`}
                                className="p-2 rounded-lg bg-emerald-50/40 border border-emerald-200/70 flex items-center justify-between gap-2 text-[11px]"
                              >
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-mono font-black text-slate-900">{toPersianDigits(rec.invoiceNumber)}</span>
                                    <span className="text-slate-400 font-mono text-[10px]">{toPersianDigits(rec.date)}</span>
                                  </div>
                                  <div className="text-slate-600 truncate text-[10px]">{rec.supplierName}</div>
                                  <div className="font-mono text-[10px] text-emerald-900 font-bold">
                                    {toPersianDigits(rec.quantity)} {stat.unit} × {toPersianDigits(formatPrice(rec.buyPrice))} = {toPersianDigits(formatPrice(rec.total))} ت
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => setViewingPurchaseInvoice(rec.invoiceRef)}
                                  className="px-2.5 py-1.5 rounded-lg bg-slate-900 text-white font-bold text-[10px] shrink-0 flex items-center gap-1"
                                >
                                  <Eye className="w-3 h-3" />
                                  <span>فاکتور</span>
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Desktop Table for Product Purchase Stats */}
                <div className="hidden sm:block overflow-x-auto max-h-96">
                  <table className="w-full text-right border-collapse text-xs">
                    <thead className="sticky top-0 z-10 bg-slate-100 text-slate-700 border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3 font-bold text-center w-9">#</th>
                        <th className="py-2.5 px-3 font-bold">نام و کد کالا / خدمات</th>
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
                                        ریز فاکتورهای خرید «{stat.productName}» ({toPersianDigits(stat.records.length)} مورد)
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
              </>
            )}
          </div>
        </div>
      )}

      {/* Main Container: Unified Toolbar + Table/Cards */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        {/* Filter and Search Bar */}
        <div className="p-3 sm:p-3.5 border-b border-slate-200/80 bg-slate-50/60 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 flex-1 max-w-2xl">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="جستجوی شماره فاکتور، تامین‌کننده، ثبت‌کننده، کالا یا خدمات..."
                className="w-full h-9 sm:h-auto pr-9 pl-8 py-1.5 text-xs rounded-xl border border-slate-200/90 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 shadow-2xs"
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

            {availableCreators.length > 0 && (
              <div className="flex items-center gap-1.5 bg-white border border-slate-200/90 rounded-xl px-2.5 h-9 sm:h-auto sm:py-1 shadow-2xs shrink-0">
                <UserCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <select
                  aria-label="فیلتر بر اساس کاربر ثبت‌کننده"
                  value={creatorFilter}
                  onChange={(e) => setCreatorFilter(e.target.value)}
                  className="w-full bg-transparent text-xs font-bold text-slate-700 focus:outline-none cursor-pointer"
                >
                  <option value="all">همه ثبت‌کنندگان</option>
                  {availableCreators.map((c) => (
                    <option key={c.id} value={c.id}>
                      ثبت توسط: {c.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Status Filters */}
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar bg-slate-200/60 p-1 rounded-xl text-xs font-bold">
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`px-2.5 py-1.5 sm:py-1 rounded-lg whitespace-nowrap transition-all cursor-pointer ${
                statusFilter === 'all'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              همه ({toPersianDigits(purchaseInvoices.length)})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('services')}
              className={`px-2.5 py-1.5 sm:py-1 rounded-lg whitespace-nowrap transition-all cursor-pointer flex items-center gap-1 ${
                statusFilter === 'services'
                  ? 'bg-amber-600 text-white shadow-2xs'
                  : 'text-amber-800 hover:text-amber-950'
              }`}
            >
              <Wrench className="w-3 h-3" />
              <span>خدمات و هزینه‌ها ({toPersianDigits(serviceInvoicesCount)})</span>
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('pending_receipt')}
              className={`px-2.5 py-1.5 sm:py-1 rounded-lg whitespace-nowrap transition-all cursor-pointer ${
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
              className={`px-2.5 py-1.5 sm:py-1 rounded-lg whitespace-nowrap transition-all cursor-pointer ${
                statusFilter === 'completed'
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              تایید شده
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('has_discrepancy')}
              className={`px-2.5 py-1.5 sm:py-1 rounded-lg whitespace-nowrap transition-all cursor-pointer ${
                statusFilter === 'has_discrepancy'
                  ? 'bg-orange-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              دارای مغایرت ({toPersianDigits(discrepancyCount)})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('unpaid')}
              className={`px-2.5 py-1.5 sm:py-1 rounded-lg whitespace-nowrap transition-all cursor-pointer ${
                statusFilter === 'unpaid'
                  ? 'bg-rose-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              نسیه / تسویه نشده ({toPersianDigits(unpaidCount)})
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
            {/* Mobile & Tablet Portrait View: Rich Touch-Friendly Cards */}
            <div className="block md:hidden divide-y divide-slate-200/70">
              {filteredInvoices.map((inv, index) => {
                const hasDiscrepancy = inv.status === 'has_discrepancy';
                const isPending = inv.status === 'pending_receipt';
                const isPaid = inv.paymentStatus === 'paid';
                const isPartial = inv.paymentStatus === 'partial';
                const remainingDebt = Math.max(0, (inv.finalTotal || 0) - (inv.paidAmount || 0));
                const isServiceOnly = isPureServicePurchaseInvoice(inv, products);
                const hasServices = hasServicePurchaseItems(inv, products);

                return (
                  <div
                    key={inv.id}
                    onClick={() => setViewingPurchaseInvoice(inv)}
                    className={`p-3.5 space-y-2.5 transition-colors cursor-pointer active:bg-slate-100/80 ${
                      index % 2 === 1 ? 'bg-slate-50/50' : 'bg-white'
                    }`}
                  >
                    {/* Top Row: Invoice Number, Date & Warehouse/Service Status */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                        <span className="font-mono font-black text-xs text-slate-900 bg-slate-100 px-2 py-0.5 rounded-lg border border-slate-200">
                          {toPersianDigits(inv.invoiceNumber)}
                        </span>
                        <span className="text-[11px] text-slate-500 font-mono">
                          {toPersianDigits(inv.date)}
                        </span>
                        {isServiceOnly ? (
                          <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200 flex items-center gap-0.5">
                            <Wrench className="w-2.5 h-2.5" />
                            <span>خرید خدمات</span>
                          </span>
                        ) : hasServices ? (
                          <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                            کالا + خدمات
                          </span>
                        ) : null}
                      </div>

                      {isServiceOnly ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200 shrink-0">
                          ثبت قطعی خدمات
                        </span>
                      ) : isPending ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-800 border border-blue-200 shrink-0">
                          منتظر ورود انبار
                        </span>
                      ) : hasDiscrepancy ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-300 shrink-0">
                          دارای مغایرت
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 shrink-0">
                          تایید انبار
                        </span>
                      )}
                    </div>

                    {/* Middle Row: Supplier Name, Creator & Financial Box */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 space-y-1">
                        <div className="font-black text-sm text-slate-900 truncate">
                          {inv.supplierName || 'تامین‌کننده ثبت‌نشده'}
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap text-[11px] text-slate-500">
                          <span className="font-bold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded">
                            {toPersianDigits(inv.items.length)} قلم
                          </span>
                          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded-md border border-slate-200/70">
                            <UserCheck className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                            <span className="truncate max-w-[110px]">{inv.createdByName || 'مدیر سیستم'}</span>
                          </span>
                        </div>
                        {/* Brief Items Preview on Mobile */}
                        {inv.items.length > 0 && (
                          <div className="text-[11px] text-slate-500 truncate max-w-[220px] sm:max-w-xs">
                            {inv.items.slice(0, 2).map((it) => it.productName).join('، ')}
                            {inv.items.length > 2 ? ` و ${toPersianDigits(inv.items.length - 2)} مورد دیگر` : ''}
                          </div>
                        )}
                      </div>

                      {/* Financial & Payment Status Summary */}
                      <div className="text-left shrink-0 space-y-1">
                        <div className="font-mono font-black text-sm text-slate-900">
                          {toPersianDigits(formatPrice(inv.finalTotal))}{' '}
                          <span className="text-[10px] font-normal text-slate-500">تومان</span>
                        </div>
                        <div className="flex flex-col items-end gap-0.5">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                              isPaid
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                : isPartial
                                ? 'bg-amber-50 text-amber-800 border-amber-200'
                                : 'bg-rose-50 text-rose-800 border-rose-200'
                            }`}
                          >
                            {isPaid ? 'تسویه شده' : isPartial ? 'بیعانه / بخشی' : 'نسیه / پرداخت‌نشده'}
                          </span>
                          {!isPaid && remainingDebt > 0 && (
                            <span className="text-[10px] font-mono font-bold text-rose-600">
                              مانده: {toPersianDigits(formatPrice(remainingDebt))} ت
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Bottom Action Bar (Touch-Friendly Buttons) */}
                    <div
                      className="flex items-center justify-between gap-1.5 pt-2 border-t border-slate-100"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <button
                          type="button"
                          onClick={() => setViewingPurchaseInvoice(inv)}
                          className="h-8 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>مشاهده و چاپ</span>
                        </button>

                        {canSettlePurchase && (
                          <button
                            type="button"
                            onClick={() => handleOpenSettleModal(inv)}
                            className={`h-8 px-2.5 rounded-xl border text-[11px] font-bold flex items-center gap-1 cursor-pointer ${
                              isPaid
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-amber-50 text-amber-800 border-amber-200'
                            }`}
                            title="ثبت پرداخت / تسویه هزینه"
                          >
                            <CreditCard className="w-3.5 h-3.5" />
                            <span>{isPaid ? 'پرداختی' : 'ثبت پرداخت'}</span>
                          </button>
                        )}

                        {inv.inboundReceiptId && !isServiceOnly && onNavigateToWarehouseReceipt && (
                          <button
                            type="button"
                            onClick={() => onNavigateToWarehouseReceipt(inv.inboundReceiptId!)}
                            className="h-8 px-2.5 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                            title="مشاهده حواله ورود انبار"
                          >
                            <PackageCheck className="w-3.5 h-3.5" />
                            <span>حواله</span>
                          </button>
                        )}
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        {canCreatePurchase && (
                          <button
                            type="button"
                            onClick={() => setEditingPurchaseInvoice(inv)}
                            className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center cursor-pointer"
                            title="ویرایش فاکتور خرید"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {canDeletePurchase && (
                          <button
                            type="button"
                            onClick={() => setInvoiceToDelete(inv)}
                            className="w-8 h-8 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 flex items-center justify-center cursor-pointer"
                            title="حذف فاکتور خرید"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop View: Ultra-Clean Responsive Table (Optimized for all desktop & laptop sizes) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-right border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100/80 text-slate-700 border-b border-slate-200 select-none text-[11px]">
                    <th className="py-2.5 px-2.5 font-bold text-center w-10">#</th>
                    <th className="py-2.5 px-3 font-bold w-36">
                      <div className="flex items-center gap-1.5">
                        <Hash className="w-3.5 h-3.5 text-slate-400" />
                        <span>فاکتور و نوع</span>
                      </div>
                    </th>
                    <th className="py-2.5 px-3 font-bold min-w-[180px]">
                      <div className="flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-slate-400" />
                        <span>تامین‌کننده / مجری</span>
                      </div>
                    </th>
                    <th className="py-2.5 px-3 font-bold text-center w-28">
                      <div className="flex items-center justify-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <span>تاریخ</span>
                      </div>
                    </th>
                    <th className="py-2.5 px-2 font-bold text-center w-16" title="تعداد اقلام فاکتور">
                      <div className="flex items-center justify-center gap-1">
                        <Package className="w-3.5 h-3.5 text-slate-400" />
                        <span>اقلام</span>
                      </div>
                    </th>
                    <th className="py-2.5 px-3 font-bold text-left w-44">
                      <div className="flex items-center justify-end gap-1.5">
                        <CreditCard className="w-3.5 h-3.5 text-slate-400" />
                        <span>مبلغ و تسویه</span>
                      </div>
                    </th>
                    <th className="py-2.5 px-2 font-bold text-center w-20" title="وضعیت رسید ورود انبار / خدمات">
                      <div className="flex items-center justify-center gap-1">
                        <PackageCheck className="w-3.5 h-3.5 text-slate-400" />
                        <span>انبار</span>
                      </div>
                    </th>
                    <th className="py-2.5 px-3 font-bold text-center w-40">
                      <span>عملیات</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredInvoices.map((inv, index) => {
                    const hasDiscrepancy = inv.status === 'has_discrepancy';
                    const isPending = inv.status === 'pending_receipt';
                    const isPaid = inv.paymentStatus === 'paid';
                    const isPartial = inv.paymentStatus === 'partial';
                    const isServiceOnly = isPureServicePurchaseInvoice(inv, products);
                    const hasServices = hasServicePurchaseItems(inv, products);
                    const remainingDebt = Math.max(0, (inv.finalTotal || 0) - (inv.paidAmount || 0));

                    const itemsTooltip = inv.items && inv.items.length > 0
                      ? inv.items.map((i, idx) => `${toPersianDigits(idx + 1)}. ${i.productName} (${toPersianDigits(i.quantity)} ${i.unit || ''})`).join('\n')
                      : 'بدون اقلام';

                    return (
                      <tr
                        key={inv.id}
                        onClick={() => setViewingPurchaseInvoice(inv)}
                        className={`${
                          index % 2 === 1 ? 'bg-slate-50/50' : 'bg-white'
                        } hover:bg-emerald-50/30 transition-colors cursor-pointer group`}
                      >
                        {/* Index */}
                        <td className="py-2.5 px-2 text-center font-mono text-slate-400 font-bold text-[11px]">
                          {toPersianDigits(index + 1)}
                        </td>

                        {/* Invoice Number + Type Icon Badge */}
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-black text-slate-900 bg-slate-100 group-hover:bg-white px-2 py-0.5 rounded-lg border border-slate-200 text-xs">
                              {toPersianDigits(inv.invoiceNumber)}
                            </span>
                            {isServiceOnly ? (
                              <span
                                className="w-6 h-6 rounded-lg bg-violet-100 text-violet-800 border border-violet-200 flex items-center justify-center shrink-0"
                                title="خرید خدمات و هزینه (بی‌نیاز از انبار)"
                              >
                                <Wrench className="w-3 h-3" />
                              </span>
                            ) : hasServices ? (
                              <span
                                className="w-6 h-6 rounded-lg bg-amber-100 text-amber-800 border border-amber-200 flex items-center justify-center shrink-0"
                                title="خرید ترکیبی کالا و خدمات"
                              >
                                <Wrench className="w-3 h-3 text-amber-700" />
                              </span>
                            ) : (
                              <span
                                className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center justify-center shrink-0"
                                title="خرید کالا (ورود به انبار)"
                              >
                                <ShoppingBag className="w-3 h-3 text-emerald-700" />
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Supplier / Service Provider + Creator Subtitle */}
                        <td className="py-2.5 px-3 min-w-[180px]">
                          <div className="min-w-0">
                            <div className="font-black text-slate-900 truncate max-w-[220px]" title={inv.supplierName}>
                              {inv.supplierName || 'تامین‌کننده ثبت‌نشده'}
                            </div>
                            <div
                              className="flex items-center gap-1 text-[10px] text-slate-400 mt-0.5"
                              title={`ثبت‌کننده: ${inv.createdByName || 'مدیر سیستم'}${inv.createdByRole ? ` (${inv.createdByRole})` : ''}${inv.updatedByName ? ` • آخرین ویرایش: ${inv.updatedByName}` : ''}`}
                            >
                              <UserCheck className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                              <span className="truncate max-w-[160px]">{inv.createdByName || 'مدیر سیستم'}</span>
                            </div>
                          </div>
                        </td>

                        {/* Date */}
                        <td className="py-2.5 px-3 text-center font-mono text-slate-600 whitespace-nowrap text-xs">
                          {toPersianDigits(inv.date)}
                        </td>

                        {/* Items Count Badge */}
                        <td className="py-2.5 px-2 text-center whitespace-nowrap">
                          <span
                            className="inline-flex items-center justify-center gap-1 font-mono font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-lg border border-slate-200 text-[11px] cursor-help"
                            title={itemsTooltip}
                          >
                            <Package className="w-3 h-3 text-slate-400" />
                            <span>{toPersianDigits(inv.items.length)}</span>
                          </span>
                        </td>

                        {/* Total Amount + Payment Status Icon Badge */}
                        <td className="py-2.5 px-3 text-left whitespace-nowrap">
                          <div className="flex items-center justify-end gap-2">
                            <span className="font-black font-mono text-slate-900 text-xs">
                              {toPersianDigits(formatPrice(inv.finalTotal))}{' '}
                              <span className="text-[10px] font-normal text-slate-400">ت</span>
                            </span>
                            <button
                              type="button"
                              disabled={!canSettlePurchase}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (canSettlePurchase) {
                                  handleOpenSettleModal(inv);
                                }
                              }}
                              className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 border transition-all ${
                                canSettlePurchase ? 'hover:scale-110 cursor-pointer shadow-2xs' : 'cursor-default'
                              } ${
                                isPaid
                                  ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                  : isPartial
                                  ? 'bg-amber-100 text-amber-800 border-amber-300'
                                  : 'bg-rose-100 text-rose-800 border-rose-300'
                              }`}
                              title={
                                isPaid
                                  ? 'تسویه کامل شده (کلیک برای مشاهده/ویرایش پرداخت)'
                                  : isPartial
                                  ? `پرداخت بیعانه / بخشی (مانده: ${toPersianDigits(formatPrice(remainingDebt))} تومان)`
                                  : `نسیه / حساب دفتری (بدهکار: ${toPersianDigits(formatPrice(inv.finalTotal))} تومان)`
                              }
                            >
                              {isPaid ? (
                                <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                              ) : isPartial ? (
                                <Clock className="w-3.5 h-3.5" />
                              ) : (
                                <AlertTriangle className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        </td>

                        {/* Warehouse / Service Status Icon Badge */}
                        <td className="py-2.5 px-2 text-center whitespace-nowrap">
                          {isServiceOnly ? (
                            <span
                              className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-violet-50 text-violet-700 border border-violet-200"
                              title="خرید خدمات و هزینه (بی‌نیاز از انبار)"
                            >
                              <Wrench className="w-3.5 h-3.5" />
                            </span>
                          ) : isPending ? (
                            <span
                              className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-blue-50 text-blue-700 border border-blue-200"
                              title="در انتظار ورود به انبار و تایید اقلام"
                            >
                              <Clock className="w-3.5 h-3.5" />
                            </span>
                          ) : hasDiscrepancy ? (
                            <span
                              className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-amber-50 text-amber-700 border border-amber-300"
                              title="دارای مغایرت در تحویل کالا به انبار"
                            >
                              <AlertTriangle className="w-3.5 h-3.5" />
                            </span>
                          ) : (
                            <span
                              className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200"
                              title="تحویل کامل و تایید انبار"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            </span>
                          )}
                        </td>

                        {/* Actions: Icon-Only Touch/Click Buttons with Tooltips */}
                        <td className="py-2.5 px-3 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1" onClick={(e) => e.stopPropagation()}>
                            {canSettlePurchase && (
                              <button
                                type="button"
                                onClick={() => handleOpenSettleModal(inv)}
                                className={`w-8 h-8 rounded-xl border flex items-center justify-center transition-all cursor-pointer ${
                                  isPaid
                                    ? 'bg-slate-50 hover:bg-emerald-50 text-slate-600 hover:text-emerald-700 border-slate-200'
                                    : 'bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-200'
                                }`}
                                title={isPaid ? 'مشاهده و ویرایش تسویه فاکتور' : 'ثبت پرداخت وجه و تسویه'}
                              >
                                <CreditCard className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {inv.inboundReceiptId && !isServiceOnly && onNavigateToWarehouseReceipt && (
                              <button
                                type="button"
                                onClick={() => onNavigateToWarehouseReceipt(inv.inboundReceiptId!)}
                                className="w-8 h-8 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 flex items-center justify-center transition-all cursor-pointer"
                                title="مشاهده حواله ورود در انبار"
                              >
                                <PackageCheck className="w-3.5 h-3.5" />
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => setViewingPurchaseInvoice(inv)}
                              className="w-8 h-8 rounded-xl bg-slate-900 hover:bg-slate-800 text-white flex items-center justify-center transition-all cursor-pointer shadow-2xs"
                              title="مشاهده و چاپ فاکتور خرید"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>

                            {canCreatePurchase && (
                              <button
                                type="button"
                                onClick={() => setEditingPurchaseInvoice(inv)}
                                className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-emerald-700 border border-slate-200 flex items-center justify-center transition-all cursor-pointer"
                                title="ویرایش فاکتور خرید"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {canDeletePurchase && (
                              <button
                                type="button"
                                onClick={() => setInvoiceToDelete(inv)}
                                className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-rose-50 text-slate-400 hover:text-rose-600 border border-slate-200 flex items-center justify-center transition-all cursor-pointer"
                                title="حذف فاکتور خرید"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
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
      {canCreatePurchase && (isNewPurchaseModalOpen || editingPurchaseInvoice) && (
        <NewPurchaseInvoiceModal
          products={products}
          settings={settings}
          currentUser={currentUser}
          previousSuppliers={previousSuppliers}
          editingInvoice={editingPurchaseInvoice}
          initialMode={newModalInitialMode}
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

      {/* Quick Payment / Service Cost Settlement Modal */}
      {settlingInvoice && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl max-w-md w-full p-4 sm:p-5 max-h-[92vh] overflow-y-auto shadow-2xl border border-slate-200 animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-3.5">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-black text-slate-900 text-xs sm:text-sm truncate">
                    ثبت پرداخت و تسویه فاکتور {toPersianDigits(settlingInvoice.invoiceNumber)}
                  </h3>
                  <p className="text-[11px] text-slate-500 truncate">
                    {settlingInvoice.supplierName} • مبلغ کل: {toPersianDigits(formatPrice(settlingInvoice.finalTotal))} تومان
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSettlingInvoice(null)}
                className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveQuickSettlement} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1.5">وضعیت پرداخت هزینه / فاکتور:</label>
                <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSettleStatus('paid');
                      setSettlePaidAmount(settlingInvoice.finalTotal);
                    }}
                    className={`py-2 px-1.5 rounded-xl font-bold border text-center cursor-pointer transition-all ${
                      settleStatus === 'paid'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    تسویه کامل
                  </button>
                  <button
                    type="button"
                    onClick={() => setSettleStatus('partial')}
                    className={`py-2 px-1.5 rounded-xl font-bold border text-center cursor-pointer transition-all ${
                      settleStatus === 'partial'
                        ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    پرداخت بخشی
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSettleStatus('unpaid');
                      setSettlePaidAmount(0);
                    }}
                    className={`py-2 px-1.5 rounded-xl font-bold border text-center cursor-pointer transition-all ${
                      settleStatus === 'unpaid'
                        ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    نسیه (دفتری)
                  </button>
                </div>
              </div>

              {settleStatus !== 'unpaid' && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">روش پرداخت وجه:</label>
                      <select
                        value={settleMethod}
                        onChange={(e) => setSettleMethod(e.target.value as PaymentMethod)}
                        className="w-full h-10 sm:h-9 px-2.5 rounded-xl border border-slate-300 bg-white font-bold text-slate-800 focus:outline-none focus:border-emerald-500"
                      >
                        {Object.entries(PAYMENT_METHOD_LABELS)
                          .filter(([k]) => k !== 'credit')
                          .map(([key, label]) => (
                            <option key={key} value={key}>
                              {label}
                            </option>
                          ))}
                      </select>
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">مبلغ پرداختی (تومان):</label>
                      <NumericInput
                        value={settleStatus === 'paid' ? settlingInvoice.finalTotal : settlePaidAmount}
                        disabled={settleStatus === 'paid'}
                        onChange={(val) => setSettlePaidAmount(val)}
                        className="w-full h-10 sm:h-9 px-3 rounded-xl border border-slate-300 bg-white font-mono font-bold text-emerald-700 text-left disabled:bg-slate-100"
                      />
                    </div>
                  </div>

                  {settleStatus === 'partial' && (
                    <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-rose-50 border border-rose-200 text-[11px]">
                      <span className="font-bold text-rose-800">مانده بدهی پس از این پرداخت:</span>
                      <span className="font-mono font-black text-rose-700">
                        {toPersianDigits(formatPrice(Math.max(0, settlingInvoice.finalTotal - settlePaidAmount)))} تومان
                      </span>
                    </div>
                  )}

                  {settleMethod === 'cheque' && (
                    <div className="grid grid-cols-2 gap-2 p-2.5 bg-amber-50/70 rounded-xl border border-amber-200">
                      <div>
                        <label className="block text-[11px] font-bold text-amber-900 mb-1">شماره چک:</label>
                        <input
                          type="text"
                          value={settleChequeNumber}
                          onChange={(e) => setSettleChequeNumber(e.target.value)}
                          placeholder="شماره صیادی/چک..."
                          className="w-full h-9 sm:h-8 px-2.5 rounded-lg border border-amber-300 bg-white text-xs font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-amber-900 mb-1">تاریخ سررسید:</label>
                        <input
                          type="text"
                          value={settleChequeDueDate}
                          onChange={(e) => setSettleChequeDueDate(e.target.value)}
                          placeholder="1404/02/15"
                          className="w-full h-9 sm:h-8 px-2.5 rounded-lg border border-amber-300 bg-white text-xs font-mono text-center"
                        />
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">شماره پیگیری / شرح پرداخت هزینه:</label>
                    <input
                      type="text"
                      value={settleTrackingDesc}
                      onChange={(e) => setSettleTrackingDesc(e.target.value)}
                      placeholder="شماره فیش، کارت به کارت، شبا یا توضیحات پرداخت..."
                      className="w-full h-10 sm:h-9 px-3 rounded-xl border border-slate-300 bg-white text-xs focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </>
              )}

              <div className="flex items-center gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setSettlingInvoice(null)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-bold hover:bg-slate-50 cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>ذخیره اطلاعات پرداخت</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Viewing & Printing Modal */}
      {viewingPurchaseInvoice && (
        <PurchaseInvoiceViewModal
          invoice={viewingPurchaseInvoice}
          settings={settings}
          currentUser={currentUser}
          onClose={() => setViewingPurchaseInvoice(null)}
          onEdit={
            canCreatePurchase
              ? (inv) => {
                  setViewingPurchaseInvoice(null);
                  setEditingPurchaseInvoice(inv);
                }
              : undefined
          }
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
