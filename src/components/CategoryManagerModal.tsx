import React, { useState } from 'react';
import { Product } from '../types';
import { toPersianDigits, formatPrice } from '../utils/jalali';
import {
  FolderTree,
  Plus,
  Edit2,
  Trash2,
  Check,
  X,
  Boxes,
  Sparkles,
  AlertCircle,
  Search,
  Filter,
  Layers,
  ArrowRight,
  Package
} from 'lucide-react';

interface CategoryManagerModalProps {
  categories: string[];
  products: Product[];
  currency?: string;
  onAddCategory: (categoryName: string) => boolean;
  onRenameCategory: (oldName: string, newName: string) => boolean;
  onDeleteCategory: (categoryName: string, reassignTo?: string) => boolean;
  onSelectCategory?: (categoryName: string) => void;
  onClose: () => void;
}

export const CategoryManagerModal: React.FC<CategoryManagerModalProps> = ({
  categories,
  products,
  currency = 'تومان',
  onAddCategory,
  onRenameCategory,
  onDeleteCategory,
  onSelectCategory,
  onClose,
}) => {
  const [newCatName, setNewCatName] = useState('');
  const [editingCatName, setEditingCatName] = useState<string | null>(null);
  const [renamedValue, setRenamedValue] = useState('');
  const [searchFilter, setSearchFilter] = useState('');
  const [deletingCat, setDeletingCat] = useState<string | null>(null);
  const [reassignTarget, setReassignTarget] = useState<string>('عمومی');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Suggested popular categories
  const suggestedCategories = [
    'قطعات',
    'لوازم جانبی',
    'مواد اولیه',
    'ابزارآلات',
    'تجهیزات الکترونیکی',
    'ملزومات اداری',
    'محصول نهایی',
    'بسته‌بندی',
    'قطعات یدکی',
    'کابل و اتصالات',
  ];

  const handleAddCategorySubmit = (nameToAdd?: string) => {
    const target = (nameToAdd || newCatName).trim();
    if (!target) {
      setErrorMessage('لطفاً نام دسته‌بندی را وارد نمایید.');
      return;
    }
    const success = onAddCategory(target);
    if (!success) {
      setErrorMessage(`دسته‌بندی «${target}» از قبل وجود دارد.`);
    } else {
      setErrorMessage(null);
      setSuccessMessage(`دسته‌بندی «${target}» با موفقیت اضافه شد.`);
      setNewCatName('');
      setTimeout(() => setSuccessMessage(null), 3000);
    }
  };

  const handleStartRename = (cat: string) => {
    setEditingCatName(cat);
    setRenamedValue(cat);
    setErrorMessage(null);
  };

  const handleSaveRename = (oldName: string) => {
    const cleanNew = renamedValue.trim();
    if (!cleanNew) {
      setErrorMessage('نام دسته نمی‌تواند خالی باشد.');
      return;
    }
    if (cleanNew === oldName) {
      setEditingCatName(null);
      return;
    }
    const success = onRenameCategory(oldName, cleanNew);
    if (!success) {
      setErrorMessage(`دسته‌بندی «${cleanNew}» از قبل وجود دارد.`);
    } else {
      setEditingCatName(null);
      setErrorMessage(null);
      setSuccessMessage(`دسته‌بندی «${oldName}» به «${cleanNew}» تغییر یافت.`);
      setTimeout(() => setSuccessMessage(null), 3000);
    }
  };

  const handleConfirmDelete = (cat: string) => {
    const success = onDeleteCategory(cat, reassignTarget);
    if (success) {
      setDeletingCat(null);
      setErrorMessage(null);
      setSuccessMessage(`دسته‌بندی «${cat}» حذف شد و کالاها به «${reassignTarget}» منتقل شدند.`);
      setTimeout(() => setSuccessMessage(null), 3000);
    }
  };

  // Compute category statistics
  const categoryStats = React.useMemo(() => {
    const stats: Record<string, { count: number; totalStock: number; lowStockCount: number }> = {};
    categories.forEach((cat) => {
      stats[cat] = { count: 0, totalStock: 0, lowStockCount: 0 };
    });

    products.forEach((p) => {
      const cat = p.category?.trim() || 'عمومی';
      if (!stats[cat]) {
        stats[cat] = { count: 0, totalStock: 0, lowStockCount: 0 };
      }
      stats[cat].count += 1;
      stats[cat].totalStock += Number(p.stock) || 0;
      if (p.stock <= p.minStockAlert) {
        stats[cat].lowStockCount += 1;
      }
    });

    return stats;
  }, [categories, products]);

  // Filtered categories
  const filteredCategories = categories.filter((c) =>
    c.toLowerCase().includes(searchFilter.trim().toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-xs">
      <div className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="shrink-0 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white px-5 py-4 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 text-indigo-300 flex items-center justify-center border border-indigo-500/30 shadow-inner">
              <FolderTree className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-base sm:text-lg text-white">مدیریت دسته‌بندی‌های کالا</h3>
                <span className="text-[11px] font-bold bg-indigo-500/30 text-indigo-200 px-2 py-0.5 rounded-full border border-indigo-400/20">
                  {toPersianDigits(categories.length)} گروه
                </span>
              </div>
              <p className="text-xs text-indigo-200/80 mt-0.5">
                تفکیک، نام‌گذاری و دسته‌بندی موجودی انبار بر اساس قطعات، لوازم جانبی و گروه‌های دلخواه
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
            title="بستن پنجره"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          
          {/* Messages */}
          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Define New Category Form */}
          <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-4 space-y-3">
            <label className="block text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Plus className="w-4 h-4 text-emerald-600" />
              <span>تعریف دسته‌بندی جدید</span>
            </label>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleAddCategorySubmit();
              }}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                value={newCatName}
                onChange={(e) => {
                  setNewCatName(e.target.value);
                  setErrorMessage(null);
                }}
                placeholder="نام دسته جدید: مثلاً قطعات یدکی، لوازم جانبی، ابزارآلات و..."
                className="flex-1 bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 placeholder-slate-400 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
              />
              <button
                type="submit"
                className="flex items-center gap-1.5 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-xs rounded-xl shadow-xs transition-all shrink-0 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>افزودن دسته‌بندی</span>
              </button>
            </form>

            {/* Quick Suggestions */}
            <div>
              <div className="text-[11px] font-semibold text-slate-500 mb-2 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>پیشنهادهای پرکاربرد (با یک کلیک اضافه کنید):</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {suggestedCategories.map((sug) => {
                  const exists = categories.some((c) => c.toLowerCase() === sug.toLowerCase());
                  return (
                    <button
                      key={sug}
                      type="button"
                      disabled={exists}
                      onClick={() => handleAddCategorySubmit(sug)}
                      className={`text-[11px] px-2.5 py-1 rounded-lg font-medium transition-all ${
                        exists
                          ? 'bg-slate-200/70 text-slate-400 cursor-default'
                          : 'bg-white hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 border border-slate-200 hover:border-indigo-300 shadow-2xs active:scale-95 cursor-pointer'
                      }`}
                      title={exists ? 'قبلاً اضافه شده است' : `افزودن دسته «${sug}»`}
                    >
                      {exists ? `✓ ${sug}` : `+ ${sug}`}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Search in Categories */}
          <div className="flex items-center justify-between gap-3 pt-1">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="جستجو در دسته‌بندی‌های تعریف شده..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-9 pl-4 py-2 text-xs text-slate-800 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
            </div>
            <div className="text-xs text-slate-500 font-medium shrink-0">
              تعداد: <span className="font-bold text-slate-800 font-mono">{toPersianDigits(filteredCategories.length)}</span> دسته
            </div>
          </div>

          {/* Categories Grid / Cards */}
          <div className="space-y-2.5">
            {filteredCategories.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-xs bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                هیچ دسته‌بندی با این مشخصات یافت نشد.
              </div>
            ) : (
              filteredCategories.map((cat) => {
                const stat = categoryStats[cat] || { count: 0, totalStock: 0, lowStockCount: 0 };
                const isEditing = editingCatName === cat;
                const isDeleting = deletingCat === cat;

                return (
                  <div
                    key={cat}
                    className="p-3.5 bg-white hover:bg-slate-50/80 rounded-2xl border border-slate-200/90 shadow-2xs transition-all space-y-2"
                  >
                    {isEditing ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={renamedValue}
                          onChange={(e) => setRenamedValue(e.target.value)}
                          className="flex-1 bg-white border border-indigo-400 rounded-xl px-3 py-1.5 text-xs text-slate-800 font-bold outline-none focus:ring-2 focus:ring-indigo-500/20"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveRename(cat);
                            if (e.key === 'Escape') setEditingCatName(null);
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => handleSaveRename(cat)}
                          className="p-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors cursor-pointer"
                          title="ذخیره نام جدید"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingCatName(null)}
                          className="p-2 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition-colors cursor-pointer"
                          title="انصراف"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : isDeleting ? (
                      <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl space-y-2.5">
                        <div className="flex items-center gap-2 text-rose-800 text-xs font-bold">
                          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                          <span>حذف دسته‌بندی «{cat}»</span>
                        </div>
                        {stat.count > 0 ? (
                          <div className="text-xs text-slate-700 space-y-2">
                            <p className="text-[11px] text-slate-600">
                              این دسته‌بندی دارای <strong className="text-rose-700">{toPersianDigits(stat.count)} قلم کالا</strong> است. کالاهای این دسته به کدام دسته‌بندی منتقل شوند؟
                            </p>
                            <div className="flex items-center gap-2">
                              <select
                                value={reassignTarget}
                                onChange={(e) => setReassignTarget(e.target.value)}
                                className="flex-1 bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-800 font-medium outline-none cursor-pointer"
                              >
                                {categories
                                  .filter((c) => c !== cat)
                                  .map((c) => (
                                    <option key={c} value={c}>
                                      انتقال به: {c}
                                    </option>
                                  ))}
                              </select>
                            </div>
                          </div>
                        ) : (
                          <p className="text-[11px] text-slate-600">
                            این دسته‌بندی فاقد کالاست و با خیال راحت می‌توانید آن را حذف کنید.
                          </p>
                        )}
                        <div className="flex items-center justify-end gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => setDeletingCat(null)}
                            className="px-3 py-1.5 text-xs font-semibold text-slate-600 bg-white border border-slate-300 rounded-xl hover:bg-slate-100 cursor-pointer"
                          >
                            انصراف
                          </button>
                          <button
                            type="button"
                            onClick={() => handleConfirmDelete(cat)}
                            className="px-3 py-1.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-xs cursor-pointer"
                          >
                            تایید حذف قطعی
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        {/* Title & Badge */}
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-xs shrink-0">
                            <Package className="w-4 h-4 text-slate-600" />
                          </div>
                          <div>
                            <div className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
                              <span>{cat}</span>
                              {cat === 'عمومی' && (
                                <span className="text-[9px] font-normal text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded border border-slate-200">
                                  پیش‌فرض
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                              <span>
                                {toPersianDigits(stat.count)} ردیف کالا
                              </span>
                              <span>•</span>
                              <span>
                                مجموع موجودی: <strong className="font-mono text-slate-700 font-bold">{toPersianDigits(stat.totalStock)}</strong>
                              </span>
                              {stat.lowStockCount > 0 && (
                                <>
                                  <span>•</span>
                                  <span className="text-amber-600 font-bold">
                                    {toPersianDigits(stat.lowStockCount)} کسری
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          {/* Quick Filter button */}
                          {onSelectCategory && (
                            <button
                              type="button"
                              onClick={() => {
                                onSelectCategory(cat);
                                onClose();
                              }}
                              className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-xl border border-indigo-200 transition-colors cursor-pointer"
                              title="مشاهده کالاهای این دسته‌بندی در انبار"
                            >
                              <Filter className="w-3 h-3 text-indigo-600" />
                              <span>مشاهده کالاها</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => handleStartRename(cat)}
                            className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors cursor-pointer"
                            title="تغییر نام دسته‌بندی"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          {cat !== 'عمومی' && (
                            <button
                              type="button"
                              onClick={() => {
                                setDeletingCat(cat);
                                setReassignTarget(categories.find((c) => c !== cat) || 'عمومی');
                              }}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                              title="حذف دسته‌بندی"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="shrink-0 bg-slate-50 border-t border-slate-200 px-5 py-3 flex items-center justify-between">
          <span className="text-xs text-slate-500">
            دسته‌بندی‌های تعریف شده در فرم کالا، فیلترها و گزارش‌های انبارداری اعمال خواهند شد.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
          >
            بستن
          </button>
        </div>
      </div>
    </div>
  );
};
