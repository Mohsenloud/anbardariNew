import React from 'react';
import { Product, StoreSettings, AppUser } from '../types';
import { toPersianDigits, formatPrice } from '../utils/jalali';
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
  DollarSign
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
  if (!isOpen || !product) return null;

  const canDelete = currentUser?.role === 'admin' || !currentUser;
  const isOut = product.stock === 0;
  const isLow = product.stock > 0 && product.stock <= product.minStockAlert;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white rounded-3xl max-w-xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden text-right">
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
                  {toPersianDigits(product.stock)}
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
                حداقل موجودی (نقطه هشدار): <strong className="font-mono text-slate-700">{toPersianDigits(product.minStockAlert)}</strong> {product.unit}
              </span>
            </div>
          </div>

          {/* Pricing & Financial Info (If Available) */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white border border-slate-200 rounded-xl p-3">
              <span className="text-slate-500 text-[11px] block mb-1">قیمت فروش پایه:</span>
              <div className="flex items-center gap-1 text-slate-900 font-mono font-bold text-sm">
                <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                <span>{formatPrice(product.sellPrice || 0, settings.currency)}</span>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-3">
              <span className="text-slate-500 text-[11px] block mb-1">قیمت خرید (تمام‌شده):</span>
              <div className="flex items-center gap-1 text-slate-900 font-mono font-bold text-sm">
                <Tag className="w-3.5 h-3.5 text-blue-600" />
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
                  <div key={v.id} className="p-2.5 flex items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                      <span className="font-bold text-slate-800">{v.name}</span>
                      {v.code && (
                        <span className="text-[10px] text-slate-400 font-mono bg-slate-100 px-1.5 py-0.5 rounded">
                          کد: {toPersianDigits(v.code)}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 font-mono">
                      <span className="text-slate-500 text-[11px]">موجودی:</span>
                      <span className="font-black text-purple-900 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded-lg text-xs">
                        {toPersianDigits(v.stock)} {product.unit}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

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
