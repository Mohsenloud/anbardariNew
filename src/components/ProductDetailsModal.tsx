import React, { useMemo } from 'react';
import { Product, StoreSettings, AppUser, ProductPriceHistoryEntry } from '../types';
import { toPersianDigits, formatPrice, formatNumber } from '../utils/jalali';
import { StorageService } from '../utils/storage';
import {
  X,
  Package,
  Layers,
  ArrowDownRight,
  ArrowUpLeft,
  Pencil,
  Trash2,
  AlertTriangle,
  FileText,
  Barcode,
  Calendar,
  Tag,
  DollarSign,
  TrendingUp,
  TrendingDown,
  History,
  Users
} from 'lucide-react';

interface ProductDetailsModalProps {
  isOpen: boolean;
  product: Product | null;
  settings: StoreSettings;
  currentUser?: AppUser;
  onClose: () => void;
  onOpenEdit: (product: Product) => void;
  onOpenStockIn: (product: Product) => void;
  onOpenInventoryCount: (product: Product) => void;
  onDelete: (product: Product) => void;
}

export const ProductDetailsModal: React.FC<ProductDetailsModalProps> = ({
  isOpen,
  product,
  settings,
  currentUser,
  onClose,
  onOpenEdit,
  onOpenStockIn,
  onOpenInventoryCount,
  onDelete,
}) => {
  const combinedPriceHistory = useMemo(() => {
    if (!product) return [];
    const entries: ProductPriceHistoryEntry[] = [];
    const seenKeys = new Set<string>();

    // 1. Explicit priceHistory stored on the product
    if (Array.isArray(product.priceHistory)) {
      product.priceHistory.forEach((h) => {
        if (h && h.buyPrice > 0) {
          const key = `${h.date}_${h.buyPrice}_${h.invoiceNumber || ''}`;
          seenKeys.add(key);
          entries.push(h);
        }
      });
    }

    // 2. Purchase invoices containing this product
    try {
      const pInvoices = StorageService.getPurchaseInvoices() || [];
      pInvoices.forEach((pi) => {
        if (pi.status === 'cancelled') return;
        (pi.items || []).forEach((item) => {
          if (item.productId === product.id && item.buyPrice > 0) {
            const key = `${pi.date}_${item.buyPrice}_${pi.invoiceNumber || ''}`;
            if (!seenKeys.has(key)) {
              seenKeys.add(key);
              entries.push({
                id: `pi_${pi.id}_${item.id}`,
                date: pi.date,
                buyPrice: item.buyPrice,
                sellPrice: item.sellPrice,
                supplierName: pi.supplierName,
                invoiceNumber: pi.invoiceNumber,
                note: item.variantName ? `فاکتور خرید (${item.variantName})` : 'فاکتور خرید کالا',
              });
            }
          }
        });
      });
    } catch {
      // ignore
    }

    // 3. Inbound receipts containing this product
    try {
      const receipts = StorageService.getInboundReceipts() || [];
      receipts.forEach((rec) => {
        (rec.items || []).forEach((item) => {
          if (item.productId === product.id && item.buyPrice && item.buyPrice > 0) {
            const key = `${rec.date}_${item.buyPrice}_${rec.receiptNumber || ''}`;
            if (!seenKeys.has(key)) {
              seenKeys.add(key);
              entries.push({
                id: `rec_${rec.id}_${item.id}`,
                date: rec.date,
                buyPrice: item.buyPrice,
                sellPrice: item.sellPrice,
                supplierName: rec.supplierName,
                invoiceNumber: rec.receiptNumber,
                note: 'سند ورود به انبار',
              });
            }
          }
        });
      });
    } catch {
      // ignore
    }

    // Ensure current buyPrice is represented if list is empty
    if (entries.length === 0 && product.buyPrice > 0) {
      entries.push({
        id: 'current_price',
        date: product.updatedAt || 'فعلی',
        buyPrice: product.buyPrice,
        sellPrice: product.sellPrice,
        wholesalePrice: product.wholesalePrice,
        note: 'قیمت خرید فعلی ثبت‌شده در سیستم',
      });
    }

    // Sort oldest to newest to compute deltas, then reverse for display
    const sortedAsc = [...entries].sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    return sortedAsc.map((entry, idx) => {
      const prev = idx > 0 ? sortedAsc[idx - 1] : null;
      const diff = prev ? entry.buyPrice - prev.buyPrice : 0;
      const diffPercent = prev && prev.buyPrice > 0 ? Math.round((diff / prev.buyPrice) * 100) : 0;
      return {
        ...entry,
        diff,
        diffPercent,
      };
    }).reverse();
  }, [product]);

  if (!isOpen || !product) return null;

  const canDelete = !currentUser || currentUser.role === 'admin' || currentUser.role === 'supervisor' || Boolean(currentUser.permissions?.canManageInventory);
  const isOut = product.stock === 0;
  const isLow = product.stock > 0 && product.stock <= product.minStockAlert;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden text-right">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-400/30 flex items-center justify-center">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black tracking-tight">{product.name}</h3>
                <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-white/10 text-emerald-300 font-mono border border-white/10">
                  کد: {toPersianDigits(product.code)}
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5 flex items-center gap-2">
                <span>دسته‌بندی: <strong className="text-white">{product.category}</strong></span>
                <span>•</span>
                <span>واحد سنجش: <strong className="text-white">{product.unit}</strong></span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
            title="بستن پنجره"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 text-xs">
          {/* Main Status & Stock Card */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="space-y-1 text-center sm:text-right">
              <span className="text-slate-500 text-[11px] block">موجودی فیزیکی کل در انبار:</span>
              <div className="flex items-center justify-center sm:justify-start gap-2">
                <span className="text-2xl font-black font-mono text-slate-900">
                  {formatNumber(product.stock)}
                </span>
                <span className="text-sm font-bold text-slate-600">{product.unit}</span>
              </div>
            </div>

            <div className="flex flex-col items-center sm:items-end gap-1.5">
              <span
                className={`px-3 py-1 rounded-full font-bold text-xs flex items-center gap-1.5 border ${
                  isOut
                    ? 'bg-rose-100 text-rose-800 border-rose-300'
                    : isLow
                    ? 'bg-amber-100 text-amber-800 border-amber-300'
                    : 'bg-emerald-100 text-emerald-800 border-emerald-300'
                }`}
              >
                {isOut && <span className="w-2 h-2 rounded-full bg-rose-600"></span>}
                {isLow && <AlertTriangle className="w-4 h-4 text-amber-600" />}
                <span>
                  {isOut ? 'اتمام موجودی' : isLow ? 'هشدار کسری موجودی' : 'موجودی کافی در انبار'}
                </span>
              </span>

              <span className="text-[11px] text-slate-500 font-medium">
                حداقل موجودی (نقطه هشدار): <strong className="font-mono text-slate-700">{formatNumber(product.minStockAlert)}</strong> {product.unit}
              </span>
            </div>
          </div>

          {/* Pricing & Financial Info (3 Tiers: Regular Sell, Wholesale/Colleague, Buy Cost) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-white border border-slate-200 rounded-xl p-3">
              <span className="text-slate-500 text-[11px] block mb-1">قیمت فروش عادی:</span>
              <div className="flex items-center gap-1 text-emerald-700 font-mono font-bold text-sm">
                <DollarSign className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>{formatPrice(product.sellPrice || 0, settings.currency)}</span>
              </div>
            </div>

            <div className="bg-indigo-50/50 border border-indigo-200 rounded-xl p-3">
              <span className="text-indigo-700 text-[11px] font-bold block mb-1 flex items-center gap-1">
                <Users className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                <span>قیمت فروش همکار / عمده:</span>
              </span>
              <div className="flex items-center gap-1 text-indigo-900 font-mono font-black text-sm">
                {product.wholesalePrice && product.wholesalePrice > 0 ? (
                  <span>{formatPrice(product.wholesalePrice, settings.currency)}</span>
                ) : (
                  <span className="text-xs font-normal text-slate-400">تعریف نشده (نرخ عادی)</span>
                )}
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-3">
              <span className="text-slate-500 text-[11px] block mb-1">آخرین قیمت خرید (تأمین):</span>
              <div className="flex items-center gap-1 text-slate-900 font-mono font-bold text-sm">
                <Tag className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                <span>{formatPrice(product.buyPrice || 0, settings.currency)}</span>
              </div>
            </div>
          </div>

          {/* Variants / Color / Size Breakdown */}
          {product.hasVariants && product.variants && product.variants.length > 0 && (
            <div className="border border-purple-200 bg-purple-50/50 rounded-2xl p-3.5 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 font-bold text-purple-900 text-xs">
                  <Layers className="w-4 h-4 text-purple-600" />
                  <span>تنوع‌های رنگ، مدل و سایز ({toPersianDigits(product.variants.length)} مورد)</span>
                </div>
              </div>

              <div className="divide-y divide-purple-100 bg-white rounded-xl border border-purple-200/80 overflow-hidden">
                {product.variants.map((v) => (
                  <div key={v.id} className="p-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                      <span className="font-bold text-slate-800">{v.name}</span>
                      {v.code && (
                        <span className="text-[10px] text-slate-400 font-mono bg-slate-100 px-1.5 py-0.5 rounded">
                          کد: {toPersianDigits(v.code)}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 font-mono flex-wrap">
                      {v.wholesalePrice && v.wholesalePrice > 0 ? (
                        <span className="text-[10px] text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded font-bold">
                          همکار: {formatPrice(v.wholesalePrice, settings.currency)}
                        </span>
                      ) : null}
                      <span className="text-slate-500 text-[11px]">موجودی:</span>
                      <span className="font-black text-purple-900 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded-lg text-xs">
                        {formatNumber(v.stock)} {product.unit}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Purchase Price History Timeline (تاریخچه تغییرات قیمت خرید کالا در طول زمان) */}
          <div className="border border-slate-200 bg-slate-50/80 rounded-2xl p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-black text-slate-800 text-xs">
                <History className="w-4 h-4 text-blue-600" />
                <span>تاریخچه تغییرات قیمت خرید در طول زمان</span>
              </div>
              <span className="text-[10px] font-bold text-slate-500 bg-white px-2 py-0.5 rounded-md border border-slate-200">
                {toPersianDigits(combinedPriceHistory.length)} سابقه ثبت‌شده
              </span>
            </div>

            {combinedPriceHistory.length === 0 ? (
              <div className="text-center py-4 text-slate-400 text-xs bg-white rounded-xl border border-slate-200/70">
                هنوز سابقه تغییری برای قیمت خرید این کالا ثبت نشده است.
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden max-h-48 overflow-y-auto divide-y divide-slate-100">
                {combinedPriceHistory.map((item, idx) => (
                  <div key={item.id || idx} className="p-2.5 flex flex-wrap items-center justify-between gap-2 hover:bg-slate-50/80 transition-colors">
                    <div className="flex flex-col gap-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-slate-700 text-[11px] bg-slate-100 px-1.5 py-0.5 rounded">
                          {toPersianDigits(item.date)}
                        </span>
                        {item.supplierName && (
                          <span className="font-bold text-slate-800 text-xs">
                            تامین‌کننده: {item.supplierName}
                          </span>
                        )}
                        {item.invoiceNumber && (
                          <span className="text-[10px] font-mono text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded">
                            سند: {toPersianDigits(item.invoiceNumber)}
                          </span>
                        )}
                      </div>
                      {item.note && (
                        <span className="text-[10px] text-slate-500 pr-1">{item.note}</span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 font-mono">
                      {item.diff !== 0 && (
                        <span
                          className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            item.diff > 0
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          }`}
                          title={item.diff > 0 ? 'افزایش قیمت خرید نسبت به خرید قبلی' : 'کاهش قیمت خرید نسبت به خرید قبلی'}
                        >
                          {item.diff > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                          <span dir="ltr">
                            {item.diff > 0 ? '+' : ''}
                            {toPersianDigits(item.diffPercent)}٪
                          </span>
                        </span>
                      )}
                      <span className="font-black text-slate-900 text-xs bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-lg">
                        {formatPrice(item.buyPrice, settings.currency)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Barcode & Extra Technical Data */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-600">
            {product.barcode && (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Barcode className="w-4 h-4 text-slate-400" />
                  <span>بارکد کالا:</span>
                </div>
                <span className="font-mono font-bold text-slate-800 bg-white px-2 py-0.5 rounded border border-slate-200 text-xs">
                  {toPersianDigits(product.barcode)}
                </span>
              </div>
            )}

            {product.updatedAt && (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-slate-400" />
                  <span>آخرین بروزرسانی:</span>
                </div>
                <span className="font-mono text-slate-700">
                  {toPersianDigits(product.updatedAt)}
                </span>
              </div>
            )}
          </div>

          {/* Description / Notes */}
          {product.description && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-1">
              <div className="flex items-center gap-1.5 text-slate-500 font-bold text-[11px]">
                <FileText className="w-3.5 h-3.5 text-slate-400" />
                <span>توضیحات و مشخصات تکمیلی:</span>
              </div>
              <p className="text-slate-700 leading-relaxed text-xs pr-5 whitespace-pre-line">
                {product.description}
              </p>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-3.5 sm:p-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Stock In */}
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenStockIn(product);
              }}
              className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
            >
              <ArrowDownRight className="w-4 h-4" />
              <span>ورود کالا (خرید)</span>
            </button>

            {/* Inventory Count / Stock Out */}
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenInventoryCount(product);
              }}
              className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
            >
              <ArrowUpLeft className="w-4 h-4" />
              <span>انبارگردانی</span>
            </button>

            {/* Edit */}
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenEdit(product);
              }}
              className="px-3 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
            >
              <Pencil className="w-3.5 h-3.5 text-slate-500" />
              <span>ویرایش مشخصات</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            {canDelete && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onDelete(product);
                }}
                className="p-2 text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-xl transition-colors cursor-pointer"
                title="حذف کالا از سیستم"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              بستن
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
