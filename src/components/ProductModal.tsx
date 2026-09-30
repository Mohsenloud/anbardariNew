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

  // Filtered categories based on user typed value
  const filteredCategories = useMemo(() => {
    const query = (product.category || '').trim().toLowerCase();
    if (!query) return safeCategories;
    return safeCategories.filter((c) => c.toLowerCase().includes(query));
  }, [safeCategories, product.category]);

  // Click outside listener for category dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (categoryContainerRef.current && !categoryContainerRef.current.contains(e.target as Node)) {
        setIsCategoryDropdownOpen(false);
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
        className="bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
        aria-labelledby="product-modal-title"
      >
        {/* Header */}
        <div className="shrink-0 bg-white border-b border-slate-200 px-5 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${isEditing ? 'bg-indigo-50 text-indigo-700 border border-indigo-100' : 'bg-emerald-50 text-emerald-700 border border-emerald-100'}`}>
              {isEditing ? <Edit3 className="w-5 h-5 text-indigo-600" /> : <PackagePlus className="w-5 h-5 text-emerald-600" />}
            </div>
            <div>
              <h2 id="product-modal-title" className="text-base sm:text-lg font-black text-slate-900">
                {isEditing ? 'ویرایش مشخصات کالا' : 'تعریف کالای جدید در انبار'}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {isEditing ? `کد کالا: ${toPersianDigits(product.code || '')}` : 'ثبت نام، کد رهگیری، نرخ‌گذاری و موجودی اولیه در انبار'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            title="بستن پنجره (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body (Scrollable) */}
        <form onSubmit={onSave} className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
            
            {/* SECTION 1: MAIN PRODUCT IDENTITY */}
            <div className="space-y-3.5">
              {/* Product Name */}
              <div>
                <label htmlFor="product-modal-name" className="block text-xs font-bold text-slate-800 mb-1.5">
                  نام کالا <span className="text-rose-500">*</span>
                </label>
                <input
                  ref={nameInputRef}
                  type="text"
                  required
                  id="product-modal-name"
                  value={product.name}
                  onChange={(e) => onUpdateProduct({ ...product, name: e.target.value })}
                  placeholder="مثال: سیمان تیپ ۲، کابل برق افشان، پیچ و مهره..."
                  className="w-full bg-slate-50/70 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all font-medium"
                />
              </div>

              {/* Code & Category (2 Columns on Desktop, Stacks on Narrow Mobile) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* Code Field */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label htmlFor="product-modal-code" className="block text-xs font-bold text-slate-800">
                      کد اختصاصی کالا
                    </label>
                    <span className="text-[11px] text-slate-400 font-mono">شناسه یکتا</span>
                  </div>
                  <div className="relative">
                    <input
                      type="text"
                      id="product-modal-code"
                      value={product.code}
                      onChange={(e) => onUpdateProduct({ ...product, code: e.target.value })}
                      placeholder="101"
                      maxLength={14}
                      className="w-full bg-slate-50/70 border border-slate-300 rounded-xl px-3.5 py-2.5 pl-10 text-sm font-mono font-bold text-slate-800 outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all text-left"
                    />
                    <button
                      type="button"
                      onClick={onRegenerateCode}
                      className="absolute left-1.5 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                      title="تولید خودکار کد بعدی توسط سیستم"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Category Field with Searchable Dropdown Combobox */}
                <div ref={categoryContainerRef} className="relative">
                  <div className="flex items-center justify-between mb-1.5">
                    <label htmlFor="product-modal-category" className="block text-xs font-bold text-slate-800">
                      دسته‌بندی کالا
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setIsCategoryDropdownOpen(false);
                        onOpenCategoryManager();
                      }}
                      className="text-[11px] text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 cursor-pointer transition-colors"
                      title="مدیریت و سازماندهی دسته‌بندی‌ها"
                    >
                      <FolderTree className="w-3 h-3" />
                      <span>مدیریت دسته‌ها</span>
                    </button>
                  </div>

                  <div className="relative">
                    <input
                      ref={categoryInputRef}
                      type="text"
                      id="product-modal-category"
                      value={product.category || ''}
                      autoComplete="off"
                      onFocus={() => setIsCategoryDropdownOpen(true)}
                      onClick={() => setIsCategoryDropdownOpen(true)}
                      onChange={(e) => {
                        onUpdateProduct({ ...product, category: e.target.value });
                        setIsCategoryDropdownOpen(true);
                      }}
                      placeholder="کلیک برای مشاهده لیست یا جستجو و تایپ..."
                      className="w-full bg-slate-50/70 border border-slate-300 rounded-xl px-3.5 py-2.5 pl-14 text-sm text-slate-800 outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all font-medium cursor-text"
                    />

                    {/* Left Actions: Clear button (if text present) + Chevron toggle */}
                    <div className="absolute left-1.5 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
                      {product.category && (
                        <button
                          type="button"
                          tabIndex={-1}
                          onClick={(e) => {
                            e.stopPropagation();
                            onUpdateProduct({ ...product, category: '' });
                            setIsCategoryDropdownOpen(true);
                            categoryInputRef.current?.focus();
                          }}
                          className="p-1 text-slate-400 hover:text-slate-600 rounded-md transition-colors cursor-pointer"
                          title="پاک کردن متن برای دیدن همه دسته‌ها"
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
                          categoryInputRef.current?.focus();
                        }}
                        className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                        title="باز و بسته کردن فهرست دسته‌ها"
                      >
                        <ChevronDown
                          className={`w-4 h-4 transition-transform duration-200 ${
                            isCategoryDropdownOpen ? 'rotate-180 text-emerald-600' : ''
                          }`}
                        />
                      </button>
                    </div>
                  </div>

                  {/* Searchable Dropdown Menu */}
                  {isCategoryDropdownOpen && (
                    <div className="absolute z-30 left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
                      {/* Top Header of Dropdown */}
                      <div className="px-3 py-2 bg-slate-50 border-b border-slate-100 flex items-center justify-between text-[11px] text-slate-500 font-medium">
                        <span>انتخاب دسته‌بندی کالا:</span>
                        <span>{toPersianDigits(safeCategories.length)} دسته‌بندی موجود</span>
                      </div>

                      {/* Categories Scrollable List */}
                      <div className="max-h-52 overflow-y-auto p-1.5 space-y-0.5">
                        {filteredCategories.length > 0 ? (
                          filteredCategories.map((c) => {
                            const isSelected = (product.category || '').trim() === c;
                            return (
                              <button
                                key={c}
                                type="button"
                                onMouseDown={(e) => {
                                  // Use onMouseDown to prevent blur before click registers
                                  e.preventDefault();
                                  onUpdateProduct({ ...product, category: c });
                                  setIsCategoryDropdownOpen(false);
                                }}
                                className={`w-full text-right px-3 py-2 text-xs rounded-xl flex items-center justify-between transition-colors cursor-pointer ${
                                  isSelected
                                    ? 'bg-emerald-50 text-emerald-800 font-bold border border-emerald-200/80'
                                    : 'text-slate-700 hover:bg-slate-100/80 hover:text-slate-900 font-medium'
                                }`}
                              >
                                <div className="flex items-center gap-2 truncate">
                                  <Tag className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-emerald-600' : 'text-slate-400'}`} />
                                  <span className="truncate">{c}</span>
                                  {c === 'عمومی' && (
                                    <span className="text-[10px] text-slate-400 font-normal"> (پیش‌فرض)</span>
                                  )}
                                </div>
                                {isSelected && <Check className="w-4 h-4 text-emerald-600 shrink-0" />}
                              </button>
                            );
                          })
                        ) : (
                          <div className="px-3 py-2.5 text-center text-xs text-slate-500">
                            دسته‌بندی با عنوان «{product.category}» پیدا نشد.
                          </div>
                        )}

                        {/* Option to create new category with typed text if not exists */}
                        {product.category &&
                          !safeCategories.some(
                            (c) => c.toLowerCase() === (product.category || '').trim().toLowerCase()
                          ) && (
                            <button
                              type="button"
                              onMouseDown={(e) => {
                                e.preventDefault();
                                setIsCategoryDropdownOpen(false);
                              }}
                              className="w-full text-right px-3 py-2.5 mt-1 text-xs text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-xl flex items-center gap-2 font-bold border border-emerald-200 transition-colors cursor-pointer"
                            >
                              <Plus className="w-4 h-4 text-emerald-600 shrink-0" />
                              <span>ثبت به عنوان دسته جدید: «{product.category}»</span>
                            </button>
                          )}
                      </div>

                      {/* Footer Link to Category Manager */}
                      <div className="p-1.5 bg-slate-50 border-t border-slate-100">
                        <button
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            setIsCategoryDropdownOpen(false);
                            onOpenCategoryManager();
                          }}
                          className="w-full text-center px-3 py-1.5 text-[11px] font-bold text-indigo-700 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                        >
                          <FolderTree className="w-3.5 h-3.5 text-indigo-600" />
                          <span>مدیریت پیشرفته و تعریف دسته‌ها</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Unit & Physical Stock (2 Columns) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* Unit of Measurement */}
                <div>
                  <label htmlFor="product-modal-unit" className="block text-xs font-bold text-slate-800 mb-1.5">
                    واحد سنجش و شمارش
                  </label>
                  <select
                    id="product-modal-unit"
                    value={product.unit || 'عدد'}
                    onChange={(e) => onUpdateProduct({ ...product, unit: e.target.value })}
                    className="w-full bg-slate-50/70 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all cursor-pointer font-medium"
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
                </div>

                {/* Stock (Only if product has NO variants) */}
                {!product.hasVariants ? (
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label htmlFor="product-modal-initialstock" className="block text-xs font-bold text-slate-800">
                        موجودی انبار ({product.unit || 'عدد'})
                      </label>
                      <span className="text-[11px] text-slate-400">موجودی فیزیکی فعلی</span>
                    </div>
                    <NumericInput
                      id="product-modal-initialstock"
                      min={0}
                      value={product.stock}
                      onChange={(num) => onUpdateProduct({ ...product, stock: num })}
                      textAlign="center"
                      className="w-full bg-slate-50/70 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm font-bold font-mono text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all text-center"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1.5">مجموع موجودی تنوع‌ها</label>
                    <div className="w-full bg-purple-50/60 border border-purple-200 rounded-xl px-3.5 py-2.5 text-sm font-bold font-mono text-purple-900 text-center flex items-center justify-center gap-1.5">
                      <span>{formatNumber(product.stock)}</span>
                      <span className="text-xs font-normal text-purple-700">{product.unit || 'عدد'}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* SECTION 2: FINANCIAL PRICING & REORDER ALERT */}
            <div className="bg-slate-50/90 border border-slate-200 rounded-2xl p-4 sm:p-4.5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                  <DollarSign className="w-4 h-4 text-emerald-600" />
                  <span>قیمت‌گذاری و نقطه سفارش انبار</span>
                </span>
                <span className="text-[11px] text-slate-500 font-medium">مبالغ به {currency}</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Buy Price */}
                {isAdmin && (
                  <div>
                    <label htmlFor="product-modal-buyprice" className="block text-[11.5px] font-bold text-slate-700 mb-1">
                      قیمت خرید (تأمین)
                    </label>
                    <NumericInput
                      id="product-modal-buyprice"
                      min={0}
                      value={product.buyPrice}
                      onChange={(num) => onUpdateProduct({ ...product, buyPrice: num, purchasePrice: num })}
                      currency={currency}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold font-mono text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                    />
                  </div>
                )}

                {/* Sell Price */}
                <div>
                  <label htmlFor="product-modal-sellprice" className="block text-[11.5px] font-bold text-slate-700 mb-1">
                    قیمت فروش (مشتری)
                  </label>
                  <NumericInput
                    id="product-modal-sellprice"
                    min={0}
                    value={product.sellPrice}
                    onChange={(num) => onUpdateProduct({ ...product, sellPrice: num })}
                    currency={currency}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold font-mono text-emerald-700 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                  />
                </div>

                {/* Min Stock Alert */}
                <div>
                  <label htmlFor="product-modal-minstock" className="block text-[11.5px] font-bold text-slate-700 mb-1">
                    حداقل موجودی (نقطه هشدار)
                  </label>
                  <NumericInput
                    id="product-modal-minstock"
                    min={0}
                    value={product.minStockAlert}
                    onChange={(num) => onUpdateProduct({ ...product, minStockAlert: num })}
                    textAlign="center"
                    placeholder="مثلاً ۵"
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold font-mono text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 text-center"
                  />
                </div>
              </div>
            </div>

            {/* SECTION 3: VARIANTS & SPECIFICATIONS (CLEAN & OPTIONAL) */}
            <div className="space-y-3 pt-1">
              {/* Variants Card */}
              <div className="bg-white border border-slate-200 rounded-2xl p-3.5 space-y-3 shadow-2xs">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-700 border border-purple-100 flex items-center justify-center shrink-0">
                      <Layers className="w-4 h-4 text-purple-600" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900">کالا دارای تنوع (رنگ، سایز، مدل) است</div>
                      <div className="text-[11px] text-slate-500">
                        برای کالاهایی با مشخصه‌های چندگانه و موجودی مجزا
                      </div>
                    </div>
                  </div>

                  <label className="relative inline-flex items-center cursor-pointer shrink-0">
                    <input
                      type="checkbox"
                      id="product-has-variants-toggle"
                      checked={!!product.hasVariants}
                      onChange={(e) => onToggleHasVariants(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-600"></div>
                  </label>
                </div>

                {/* If Variants Enabled: Clean Management Bar */}
                {product.hasVariants && (
                  <div className="pt-2.5 border-t border-slate-100 space-y-2.5 animate-fadeIn">
                    <div className="flex flex-wrap items-center justify-between gap-2 bg-purple-50/50 p-2.5 rounded-xl border border-purple-100">
                      <div className="flex items-center gap-2 text-xs">
                        <span className="font-bold text-purple-950">
                          {toPersianDigits((product.variants || []).length)} تنوع تعریف شده
                        </span>
                        <span className="text-[11px] text-slate-500">
                          (مجموع: <strong className="font-mono font-bold text-purple-900">{formatNumber(product.stock)} {product.unit || 'عدد'}</strong>)
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={onOpenVariantManager}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 active:scale-95 rounded-xl transition-all shadow-2xs cursor-pointer"
                      >
                        <SlidersHorizontal className="w-3.5 h-3.5" />
                        <span>مدیریت و ثبت تنوع‌ها</span>
                      </button>
                    </div>

                    {/* Preview Pills */}
                    {(product.variants || []).length > 0 && (
                      <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto">
                        {product.variants?.map((v) => (
                          <span
                            key={v.id}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-slate-100 text-slate-800 border border-slate-200"
                          >
                            <span>{v.name}</span>
                            <span className="text-[10px] text-slate-600 font-mono font-bold bg-white px-1.5 py-0.5 rounded border border-slate-200">
                              {formatNumber(v.stock)}
                            </span>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Technical Description */}
              <div>
                <label htmlFor="product-modal-desc" className="block text-xs font-bold text-slate-800 mb-1.5 flex items-center gap-1">
                  <FileText className="w-3.5 h-3.5 text-slate-500" />
                  <span>توضیحات و مشخصات فنی (اختیاری)</span>
                </label>
                <textarea
                  rows={2}
                  id="product-modal-desc"
                  value={product.description || ''}
                  onChange={(e) => onUpdateProduct({ ...product, description: e.target.value })}
                  placeholder="مدل فنی، ابعاد، گارانتی یا شرایط نگهداری..."
                  className="w-full bg-slate-50/70 border border-slate-300 rounded-xl px-3.5 py-2 text-xs text-slate-800 placeholder-slate-400 outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all font-medium resize-none"
                />
              </div>
            </div>

          </div>

          {/* Sticky Bottom Actions Bar */}
          <div className="shrink-0 bg-slate-50 border-t border-slate-200 px-5 sm:px-6 py-3.5 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-xs font-bold text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-100 active:scale-95 transition-all cursor-pointer"
            >
              انصراف
            </button>
            <button
              type="submit"
              id="save-product-modal-btn"
              className="flex items-center justify-center gap-1.5 px-6 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-95 rounded-xl shadow-xs transition-all cursor-pointer"
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
