import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Product, ProductVariant } from '../types';
import { toPersianDigits, formatNumber } from '../utils/jalali';
import { NumericInput } from './NumericInput';
import {
  X,
  PackagePlus,
  Edit3,
  RefreshCw,
  FolderTree,
  Layers,
  SlidersHorizontal,
  CheckCircle2,
  DollarSign,
  Boxes,
  Tag,
  FileText,
  ChevronDown,
  Check,
  Plus
} from 'lucide-react';

export interface ProductModalProps {
  product: Product;
  categories: string[];
  currency?: string;
  isAdmin?: boolean;
  onSave: (e: React.FormEvent) => void;
  onClose: () => void;
  onRegenerateCode: () => void;
  onOpenCategoryManager: () => void;
  onOpenVariantManager: () => void;
  onUpdateProduct: (updated: Product) => void;
  onToggleHasVariants: (enabled: boolean) => void;
}

export const ProductModal: React.FC<ProductModalProps> = ({
  product,
  categories,
  currency = 'تومان',
  isAdmin = true,
  onSave,
  onClose,
  onRegenerateCode,
  onOpenCategoryManager,
  onOpenVariantManager,
  onUpdateProduct,
  onToggleHasVariants,
}) => {
  const nameInputRef = useRef<HTMLInputElement>(null);
  const isEditing = Boolean(product.id);

  // Category Dropdown & Combobox State
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);
  const [categorySearchQuery, setCategorySearchQuery] = useState('');
  const [isSearchingCategory, setIsSearchingCategory] = useState(false);
  const categoryContainerRef = useRef<HTMLDivElement>(null);
  const categoryInputRef = useRef<HTMLInputElement>(null);

  // Safe unique categories
  const safeCategories = useMemo(() => {
    const list = categories.map((c) => c.trim()).filter(Boolean);
    const unique = Array.from(new Set(list));
    if (!unique.includes('عمومی')) {
      unique.unshift('عمومی');
    }
    return unique;
  }, [categories]);

  // Filtered categories: shows ALL categories on click/open, and only filters when user actively types
  const filteredCategories = useMemo(() => {
    if (!isSearchingCategory) {
      return safeCategories;
    }
    const query = categorySearchQuery.trim().toLowerCase();
    if (!query) {
      return safeCategories;
    }
    return safeCategories.filter((c) => c.toLowerCase().includes(query));
  }, [safeCategories, isSearchingCategory, categorySearchQuery]);

  // Click outside listener for category dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (categoryContainerRef.current && !categoryContainerRef.current.contains(e.target as Node)) {
        setIsCategoryDropdownOpen(false);
        setIsSearchingCategory(false);
        setCategorySearchQuery('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Auto focus product name on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      nameInputRef.current?.focus();
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  // Keyboard shortcut: ESC to close dropdown or modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isCategoryDropdownOpen) {
          setIsCategoryDropdownOpen(false);
          e.stopPropagation();
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isCategoryDropdownOpen, onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-xs transition-all">
      <div
        className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
        aria-labelledby="product-modal-title"
      >
        {/* Header */}
        <div className="shrink-0 bg-slate-50/80 border-b border-slate-200 px-5 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                isEditing
                  ? 'bg-indigo-50 text-indigo-700 border border-indigo-200/80'
                  : 'bg-emerald-50 text-emerald-700 border border-emerald-200/80'
              }`}
            >
              {isEditing ? (
                <Edit3 className="w-4 h-4 text-indigo-600" />
              ) : (
                <PackagePlus className="w-4 h-4 text-emerald-600" />
              )}
            </div>
            <div>
              <h2 id="product-modal-title" className="text-sm sm:text-base font-black text-slate-900">
                {isEditing ? 'ویرایش مشخصات کالا' : 'تعریف کالای جدید در انبار'}
              </h2>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {isEditing
                  ? `کد کالا: ${toPersianDigits(product.code || '')}`
                  : 'مشخصات پایه، نرخ‌های خرید و فروش و موجودی انبار را وارد کنید'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-lg transition-colors cursor-pointer"
            title="بستن پنجره (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body (Scrollable) */}
        <form onSubmit={onSave} className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
            {/* SECTION 1: PRODUCT IDENTITY & CLASSIFICATION (12-Column Aligned Grid) */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3.5">
              {/* Product Name (8 cols on desktop) */}
              <div className="sm:col-span-8">
                <label htmlFor="product-modal-name" className="block text-xs font-bold text-slate-800 mb-1.5">
                  نام و عنوان کالا <span className="text-rose-500">*</span>
                </label>
                <input
                  ref={nameInputRef}
                  type="text"
                  required
                  id="product-modal-name"
                  value={product.name}
                  onChange={(e) => onUpdateProduct({ ...product, name: e.target.value })}
                  placeholder="مثال: سیمان تیپ ۲، کابل برق افشان، روغن موتور..."
                  className="w-full h-10 bg-white border border-slate-300 rounded-xl px-3.5 text-xs sm:text-sm text-slate-900 placeholder-slate-400 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all font-medium"
                />
              </div>

              {/* Product Code + Regenerate Button (4 cols on desktop) */}
              <div className="sm:col-span-4">
                <label htmlFor="product-modal-code" className="block text-xs font-bold text-slate-800 mb-1.5">
                  کد اختصاصی کالا
                </label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    id="product-modal-code"
                    value={product.code}
                    onChange={(e) => onUpdateProduct({ ...product, code: e.target.value })}
                    placeholder="101"
                    maxLength={14}
                    dir="ltr"
                    className="flex-1 min-w-0 h-10 bg-white border border-slate-300 rounded-xl px-3 text-sm font-mono font-bold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all text-center"
                  />
                  <button
                    type="button"
                    onClick={onRegenerateCode}
                    className="h-10 w-10 shrink-0 flex items-center justify-center bg-slate-100 hover:bg-emerald-50 text-slate-600 hover:text-emerald-700 border border-slate-300 hover:border-emerald-300 rounded-xl transition-colors cursor-pointer"
                    title="تولید خودکار کد بعدی"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Category Field + Category Manager Button (7 cols on desktop) */}
              <div ref={categoryContainerRef} className="sm:col-span-7 relative">
                <label htmlFor="product-modal-category" className="block text-xs font-bold text-slate-800 mb-1.5">
                  دسته‌بندی کالا
                </label>

                <div className="flex items-center gap-1.5">
                  <div className="relative flex-1 min-w-0">
                    <input
                      ref={categoryInputRef}
                      type="text"
                      id="product-modal-category"
                      value={product.category || ''}
                      autoComplete="off"
                      onFocus={() => {
                        setIsCategoryDropdownOpen(true);
                        setIsSearchingCategory(false);
                        setCategorySearchQuery('');
                        categoryInputRef.current?.select();
                      }}
                      onClick={() => {
                        setIsCategoryDropdownOpen(true);
                        setIsSearchingCategory(false);
                        setCategorySearchQuery('');
                        categoryInputRef.current?.select();
                      }}
                      onChange={(e) => {
                        const val = e.target.value;
                        onUpdateProduct({ ...product, category: val });
                        setCategorySearchQuery(val);
                        setIsSearchingCategory(true);
                        setIsCategoryDropdownOpen(true);
                      }}
                      placeholder="انتخاب یا تایپ دسته‌بندی (مثلاً عمومی)..."
                      className="w-full h-10 bg-white border border-slate-300 rounded-xl pr-3 pl-14 text-xs sm:text-sm text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all font-medium cursor-text"
                    />

                    {/* Left Actions inside Category Input */}
                    <div className="absolute left-1.5 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
                      {product.category && (
                        <button
                          type="button"
                          tabIndex={-1}
                          onClick={(e) => {
                            e.stopPropagation();
                            onUpdateProduct({ ...product, category: '' });
                            setCategorySearchQuery('');
                            setIsSearchingCategory(false);
                            setIsCategoryDropdownOpen(true);
                            categoryInputRef.current?.focus();
                          }}
                          className="p-1 text-slate-400 hover:text-slate-600 rounded-md transition-colors cursor-pointer"
                          title="پاک کردن"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}

                      <button
                        type="button"
                        tabIndex={-1}
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsCategoryDropdownOpen((prev) => !prev);
                          setIsSearchingCategory(false);
                          setCategorySearchQuery('');
                          categoryInputRef.current?.focus();
                        }}
                        className="p-1 text-slate-400 hover:text-slate-700 rounded-md transition-colors cursor-pointer"
                        title="مشاهده فهرست دسته‌ها"
                      >
                        <ChevronDown
                          className={`w-4 h-4 transition-transform duration-200 ${
                            isCategoryDropdownOpen ? 'rotate-180 text-emerald-600' : ''
                          }`}
                        />
                      </button>
                    </div>
                  </div>

                  {/* Dedicated Category Manager Button aligned beside input */}
                  <button
                    type="button"
                    onClick={() => {
                      setIsCategoryDropdownOpen(false);
                      onOpenCategoryManager();
                    }}
                    className="h-10 px-3 shrink-0 flex items-center gap-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                    title="مدیریت و ویرایش دسته‌بندی‌ها"
                  >
                    <FolderTree className="w-3.5 h-3.5 shrink-0" />
                    <span className="hidden xs:inline">دسته‌ها</span>
                  </button>
                </div>

                {/* Searchable Dropdown Menu */}
                {isCategoryDropdownOpen && (
                  <div className="absolute z-30 left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
                    <div className="px-3 py-2 bg-slate-50 border-b border-slate-100 flex items-center justify-between text-[11px] text-slate-500 font-medium">
                      <div className="flex items-center gap-2">
                        <span>
                          {isSearchingCategory && categorySearchQuery.trim()
                            ? 'نتایج جستجو:'
                            : 'فهرست دسته‌بندی‌ها:'}
                        </span>
                        {isSearchingCategory && categorySearchQuery.trim() && (
                          <button
                            type="button"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              setIsSearchingCategory(false);
                              setCategorySearchQuery('');
                            }}
                            className="text-emerald-700 font-bold hover:underline"
                          >
                            (نمایش همه)
                          </button>
                        )}
                      </div>
                      <span>{toPersianDigits(filteredCategories.length)} دسته</span>
                    </div>

                    <div className="max-h-48 overflow-y-auto p-1.5 space-y-0.5">
                      {filteredCategories.length > 0 ? (
                        filteredCategories.map((c) => {
                          const isSelected = (product.category || '').trim() === c;
                          return (
                            <button
                              key={c}
                              type="button"
                              onMouseDown={(e) => {
                                e.preventDefault();
                                onUpdateProduct({ ...product, category: c });
                                setIsCategoryDropdownOpen(false);
                                setIsSearchingCategory(false);
                                setCategorySearchQuery('');
                              }}
                              className={`w-full text-right px-3 py-2 text-xs rounded-xl flex items-center justify-between transition-colors cursor-pointer ${
                                isSelected
                                  ? 'bg-emerald-50 text-emerald-800 font-bold border border-emerald-200/80'
                                  : 'text-slate-700 hover:bg-slate-100/80 hover:text-slate-900 font-medium'
                              }`}
                            >
                              <div className="flex items-center gap-2 truncate">
                                <Tag
                                  className={`w-3.5 h-3.5 shrink-0 ${
                                    isSelected ? 'text-emerald-600' : 'text-slate-400'
                                  }`}
                                />
                                <span className="truncate">{c}</span>
                              </div>
                              {isSelected && <Check className="w-4 h-4 text-emerald-600 shrink-0" />}
                            </button>
                          );
                        })
                      ) : (
                        <div className="px-3 py-2.5 text-center text-xs text-slate-500">
                          دسته‌بندی با عنوان «{categorySearchQuery || product.category}» یافت نشد.
                        </div>
                      )}

                      {isSearchingCategory &&
                        categorySearchQuery.trim() &&
                        !safeCategories.some(
                          (c) => c.toLowerCase() === categorySearchQuery.trim().toLowerCase()
                        ) && (
                          <button
                            type="button"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              onUpdateProduct({ ...product, category: categorySearchQuery.trim() });
                              setIsCategoryDropdownOpen(false);
                              setIsSearchingCategory(false);
                              setCategorySearchQuery('');
                            }}
                            className="w-full text-right px-3 py-2 mt-1 text-xs text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-xl flex items-center gap-2 font-bold border border-emerald-200 transition-colors cursor-pointer"
                          >
                            <Plus className="w-4 h-4 text-emerald-600 shrink-0" />
                            <span>ثبت دسته جدید: «{categorySearchQuery.trim()}»</span>
                          </button>
                        )}
                    </div>
                  </div>
                )}
              </div>

              {/* Unit of Measurement (5 cols on desktop) */}
              <div className="sm:col-span-5">
                <label htmlFor="product-modal-unit" className="block text-xs font-bold text-slate-800 mb-1.5">
                  واحد سنجش و شمارش
                </label>
                <div className="relative">
                  <select
                    id="product-modal-unit"
                    value={product.unit || 'عدد'}
                    onChange={(e) => onUpdateProduct({ ...product, unit: e.target.value })}
                    className="w-full h-10 appearance-none bg-white border border-slate-300 rounded-xl pr-3.5 pl-9 text-xs sm:text-sm text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all cursor-pointer font-medium"
                  >
                    <option value="عدد">عدد</option>
                    <option value="دستگاه">دستگاه</option>
                    <option value="بسته">بسته</option>
                    <option value="کیلوگرم">کیلوگرم</option>
                    <option value="متر">متر</option>
                    <option value="کارتن">کارتن</option>
                    <option value="جفت">جفت</option>
                    <option value="لیتر">لیتر</option>
                    <option value="شاخه">شاخه</option>
                    <option value="قوطی">قوطی</option>
                    <option value="تن">تن</option>
                  </select>
                  <ChevronDown className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>
            </div>

            {/* SECTION 2: FINANCIAL PRICING (3 Equal, Symmetrical Columns) */}
            <div className="bg-slate-50/80 border border-slate-200/90 rounded-2xl p-3.5 sm:p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                  <DollarSign className="w-4 h-4 text-emerald-600" />
                  <span>نرخ‌گذاری خرید و فروش کالا</span>
                </span>
                <span className="text-[11px] text-slate-500 font-medium">واحد پول: {currency}</span>
              </div>

              <div className={`grid grid-cols-1 ${isAdmin ? 'sm:grid-cols-3' : 'sm:grid-cols-2'} gap-3`}>
                {/* 1. Buy Price */}
                {isAdmin && (
                  <div>
                    <label htmlFor="product-modal-buyprice" className="block text-xs font-bold text-slate-700 mb-1.5">
                      قیمت خرید (تأمین)
                    </label>
                    <NumericInput
                      id="product-modal-buyprice"
                      min={0}
                      value={product.buyPrice}
                      onChange={(num) => onUpdateProduct({ ...product, buyPrice: num, purchasePrice: num })}
                      currency={currency}
                      className="w-full h-10 bg-white border border-slate-300 rounded-xl px-3 text-xs sm:text-sm font-bold font-mono text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                    />
                  </div>
                )}

                {/* 2. Sell Price (Regular Customer) */}
                <div>
                  <label htmlFor="product-modal-sellprice" className="block text-xs font-bold text-emerald-800 mb-1.5">
                    قیمت فروش عادی
                  </label>
                  <NumericInput
                    id="product-modal-sellprice"
                    min={0}
                    value={product.sellPrice}
                    onChange={(num) => onUpdateProduct({ ...product, sellPrice: num })}
                    currency={currency}
                    className="w-full h-10 bg-white border border-slate-300 rounded-xl px-3 text-xs sm:text-sm font-bold font-mono text-emerald-700 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                  />
                </div>

                {/* 3. Wholesale / Colleague Price */}
                <div>
                  <label
                    htmlFor="product-modal-wholesaleprice"
                    className="block text-xs font-bold text-indigo-800 mb-1.5 flex items-center justify-between"
                  >
                    <span>قیمت فروش همکار / عمده</span>
                    <span className="text-[10px] font-normal text-indigo-500">اختیاری</span>
                  </label>
                  <NumericInput
                    id="product-modal-wholesaleprice"
                    min={0}
                    value={product.wholesalePrice || 0}
                    onChange={(num) => onUpdateProduct({ ...product, wholesalePrice: num > 0 ? num : undefined })}
                    currency={currency}
                    placeholder="نرخ همکار..."
                    className="w-full h-10 bg-white border border-indigo-200 rounded-xl px-3 text-xs sm:text-sm font-bold font-mono text-indigo-700 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                  />
                </div>
              </div>
            </div>

            {/* SECTION 3: INVENTORY STOCK, MIN ALERT & VARIANTS */}
            <div className="bg-slate-50/80 border border-slate-200/90 rounded-2xl p-3.5 sm:p-4 space-y-3.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                  <Boxes className="w-4 h-4 text-indigo-600" />
                  <span>کنترل موجودی انبار و تنوع کالا</span>
                </span>
                <span className="text-[11px] text-slate-500 font-medium">واحد شمارش: {product.unit || 'عدد'}</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Physical Stock */}
                {!product.hasVariants ? (
                  <div>
                    <label
                      htmlFor="product-modal-initialstock"
                      className="block text-xs font-bold text-slate-700 mb-1.5"
                    >
                      موجودی فعلی در انبار ({product.unit || 'عدد'})
                    </label>
                    <NumericInput
                      id="product-modal-initialstock"
                      min={0}
                      value={product.stock}
                      onChange={(num) => onUpdateProduct({ ...product, stock: num })}
                      textAlign="center"
                      className="w-full h-10 bg-white border border-slate-300 rounded-xl px-3 text-sm font-bold font-mono text-slate-900 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 text-center"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-bold text-purple-800 mb-1.5">
                      مجموع موجودی تنوع‌ها ({product.unit || 'عدد'})
                    </label>
                    <div className="w-full h-10 bg-purple-50/70 border border-purple-200 rounded-xl px-3 text-sm font-bold font-mono text-purple-900 flex items-center justify-center gap-1.5">
                      <span>{formatNumber(product.stock)}</span>
                      <span className="text-xs font-normal text-purple-700">{product.unit || 'عدد'}</span>
                    </div>
                  </div>
                )}

                {/* Min Stock Alert */}
                <div>
                  <label htmlFor="product-modal-minstock" className="block text-xs font-bold text-slate-700 mb-1.5">
                    حداقل موجودی (نقطه هشدار کسری)
                  </label>
                  <NumericInput
                    id="product-modal-minstock"
                    min={0}
                    value={product.minStockAlert}
                    onChange={(num) => onUpdateProduct({ ...product, minStockAlert: num })}
                    textAlign="center"
                    placeholder="مثلاً ۵"
                    className="w-full h-10 bg-white border border-slate-300 rounded-xl px-3 text-sm font-bold font-mono text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 text-center"
                  />
                </div>
              </div>

              {/* Variants Toggle & Action Row */}
              <div className="pt-3 border-t border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="flex items-center justify-between sm:justify-start gap-3">
                  <label className="relative inline-flex items-center cursor-pointer shrink-0">
                    <input
                      type="checkbox"
                      id="product-has-variants-toggle"
                      checked={!!product.hasVariants}
                      onChange={(e) => onToggleHasVariants(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-600"></div>
                  </label>
                  <div>
                    <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-purple-600" />
                      <span>کالا دارای تنوع (رنگ، سایز، مدل) است</span>
                    </div>
                  </div>
                </div>

                {product.hasVariants && (
                  <div className="flex items-center justify-between sm:justify-end gap-2">
                    <span className="text-[11px] font-bold text-purple-800">
                      {toPersianDigits((product.variants || []).length)} تنوع ثبت‌شده
                    </span>
                    <button
                      type="button"
                      onClick={onOpenVariantManager}
                      className="h-9 px-3 flex items-center gap-1.5 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 active:scale-95 rounded-xl transition-all shadow-2xs cursor-pointer"
                    >
                      <SlidersHorizontal className="w-3.5 h-3.5" />
                      <span>مدیریت تنوع‌ها</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Variants Summary List */}
              {product.hasVariants && (product.variants || []).length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1 max-h-20 overflow-y-auto">
                  {product.variants?.map((v) => (
                    <span
                      key={v.id}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-white text-slate-800 border border-slate-200"
                    >
                      <span>{v.name}</span>
                      <span className="text-[10px] text-purple-700 font-mono font-bold bg-purple-50 px-1.5 py-0.5 rounded">
                        {formatNumber(v.stock)}
                      </span>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* SECTION 4: TECHNICAL DESCRIPTION */}
            <div>
              <label
                htmlFor="product-modal-desc"
                className="block text-xs font-bold text-slate-800 mb-1.5 flex items-center gap-1.5"
              >
                <FileText className="w-3.5 h-3.5 text-slate-500" />
                <span>توضیحات و مشخصات فنی (اختیاری)</span>
              </label>
              <textarea
                rows={2}
                id="product-modal-desc"
                value={product.description || ''}
                onChange={(e) => onUpdateProduct({ ...product, description: e.target.value })}
                placeholder="مدل فنی، ابعاد، گارانتی یا شرایط نگهداری..."
                className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs text-slate-800 placeholder-slate-400 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all font-medium resize-none"
              />
            </div>
          </div>

          {/* Sticky Bottom Actions Bar */}
          <div className="shrink-0 bg-slate-50 border-t border-slate-200 px-5 py-3 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="h-10 px-5 text-xs font-bold text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-100 active:scale-95 transition-all cursor-pointer"
            >
              انصراف
            </button>
            <button
              type="submit"
              id="save-product-modal-btn"
              className="h-10 px-6 flex items-center justify-center gap-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-95 rounded-xl shadow-xs transition-all cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isEditing ? 'ذخیره تغییرات کالا' : 'ذخیره و ثبت کالا در انبار'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
