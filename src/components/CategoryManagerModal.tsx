import React, { useState, useMemo } from 'react';
import { Product } from '../types';
import { toPersianDigits, formatPrice } from '../utils/jalali';
import { StorageService } from '../utils/storage';
import {
  FolderTree,
  Plus,
  Edit2,
  Trash2,
  Check,
  X,
  Sparkles,
  AlertCircle,
  Search,
  Filter,
  Layers,
  Package,
  ArrowUp,
  ArrowDown,
  Merge,
  MoveRight,
  TrendingUp,
  TrendingDown,
  BarChart2,
  SlidersHorizontal,
  ChevronDown,
  Download,
  Percent,
  RefreshCw,
  FolderPlus,
  Tag
} from 'lucide-react';

export interface CategoryManagerProps {
  categories: string[];
  products: Product[];
  currency?: string;
  embedded?: boolean; // If true, renders inline without fixed modal backdrop (for AdminPanel)
  onAddCategory?: (categoryName: string) => boolean;
  onRenameCategory?: (oldName: string, newName: string) => boolean;
  onDeleteCategory?: (categoryName: string, reassignTo?: string) => boolean;
  onReorderCategories?: (newOrderedCategories: string[]) => void;
  onSelectCategory?: (categoryName: string) => void;
  onClose?: () => void;
  onReloadProducts?: () => void;
}

export const CategoryManagerModal: React.FC<CategoryManagerProps> = ({
  categories,
  products,
  currency = 'تومان',
  embedded = false,
  onAddCategory,
  onRenameCategory,
  onDeleteCategory,
  onReorderCategories,
  onSelectCategory,
  onClose,
  onReloadProducts,
}) => {
  const [newCatName, setNewCatName] = useState('');
  const [editingCatName, setEditingCatName] = useState<string | null>(null);
  const [renamedValue, setRenamedValue] = useState('');
  const [searchFilter, setSearchFilter] = useState('');
  const [deletingCat, setDeletingCat] = useState<string | null>(null);
  const [reassignTarget, setReassignTarget] = useState<string>('عمومی');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Active Tab
  const [activeTab, setActiveTab] = useState<'list' | 'batch_assign' | 'batch_reprice' | 'analytics'>('list');
  const [mergingSourceCat, setMergingSourceCat] = useState<string | null>(null);
  const [mergingTargetCat, setMergingTargetCat] = useState<string>('');
  const [viewingCategoryProducts, setViewingCategoryProducts] = useState<string | null>(null);

  // Batch assignment state
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [batchTargetCategory, setBatchTargetCategory] = useState<string>(categories[0] || 'عمومی');
  const [batchSearchProduct, setBatchSearchProduct] = useState('');
  const [batchFilterCurrentCat, setBatchFilterCurrentCat] = useState<string>('all');

  // Batch Repricing state (به‌روزرسانی درصدی قیمت‌های رسته)
  const [repriceCategory, setRepriceCategory] = useState<string>(categories[0] || 'عمومی');
  const [repriceTarget, setRepriceTarget] = useState<'sellPrice' | 'buyPrice' | 'both'>('sellPrice');
  const [repricePercent, setRepricePercent] = useState<number>(10);
  const [repriceDirection, setRepriceDirection] = useState<'increase' | 'decrease'>('increase');
  const [repriceRounding, setRepriceRounding] = useState<number>(1000);
  const [isApplyingReprice, setIsApplyingReprice] = useState(false);

  // Sort order in list
  const [sortBy, setSortBy] = useState<'default' | 'name' | 'products_count' | 'stock' | 'value'>('default');

  // Suggested popular business & industrial categories
  const suggestedCategories = [
    'قطعات یدکی',
    'لوازم جانبی',
    'مواد اولیه',
    'ابزارآلات',
    'تجهیزات صنعتی',
    'تجهیزات الکترونیکی',
    'ملزومات اداری',
    'رنگ و پوشش',
    'بسته‌بندی',
    'کابل و اتصالات',
    'روغن و روانکار',
    'فیلترجات',
    'شیرآلات و لوله',
    'پیچ و مهره'
  ];

  // Helper: Export to CSV with UTF-8 BOM for Persian Excel support
  const downloadCsv = (filename: string, headers: string[], rows: (string | number)[][]) => {
    const csvContent =
      '\uFEFF' +
      [headers.join(','), ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleAddCategorySubmit = (nameToAdd?: string) => {
    const target = (nameToAdd || newCatName).trim();
    if (!target) {
      setErrorMessage('لطفاً نام دسته‌بندی را وارد نمایید.');
      return;
    }
    if (onAddCategory) {
      const success = onAddCategory(target);
      if (!success) {
        setErrorMessage(`دسته‌بندی «${target}» از قبل وجود دارد.`);
      } else {
        setErrorMessage(null);
        setSuccessMessage(`دسته‌بندی «${target}» با موفقیت افزوده شد.`);
        setNewCatName('');
        setTimeout(() => setSuccessMessage(null), 3000);
      }
    } else {
      const success = StorageService.addCategory(target);
      if (!success) {
        setErrorMessage(`دسته‌بندی «${target}» از قبل وجود دارد.`);
      } else {
        setErrorMessage(null);
        setSuccessMessage(`دسته‌بندی «${target}» با موفقیت افزوده شد.`);
        setNewCatName('');
        if (onReloadProducts) onReloadProducts();
        setTimeout(() => setSuccessMessage(null), 3000);
      }
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
      setErrorMessage('نام دسته‌بندی نمی‌تواند خالی باشد.');
      return;
    }
    if (cleanNew === oldName) {
      setEditingCatName(null);
      return;
    }
    if (onRenameCategory) {
      const success = onRenameCategory(oldName, cleanNew);
      if (!success) {
        setErrorMessage(`دسته‌بندی «${cleanNew}» از قبل وجود دارد.`);
      } else {
        setEditingCatName(null);
        setErrorMessage(null);
        setSuccessMessage(`دسته‌بندی «${oldName}» به «${cleanNew}» تغییر نام یافت.`);
        setTimeout(() => setSuccessMessage(null), 3000);
      }
    } else {
      const success = StorageService.renameCategory(oldName, cleanNew);
      if (!success) {
        setErrorMessage(`دسته‌بندی «${cleanNew}» از قبل وجود دارد.`);
      } else {
        setEditingCatName(null);
        setErrorMessage(null);
        setSuccessMessage(`دسته‌بندی «${oldName}» به «${cleanNew}» تغییر نام یافت.`);
        if (onReloadProducts) onReloadProducts();
        setTimeout(() => setSuccessMessage(null), 3000);
      }
    }
  };

  const handleConfirmDelete = (cat: string) => {
    if (onDeleteCategory) {
      const success = onDeleteCategory(cat, reassignTarget);
      if (success) {
        setDeletingCat(null);
        setErrorMessage(null);
        setSuccessMessage(`دسته‌بندی «${cat}» حذف شد و کالاها به «${reassignTarget}» منتقل شدند.`);
        setTimeout(() => setSuccessMessage(null), 3000);
      }
    } else {
      const success = StorageService.deleteCategory(cat, reassignTarget);
      if (success) {
        setDeletingCat(null);
        setErrorMessage(null);
        setSuccessMessage(`دسته‌بندی «${cat}» حذف شد و کالاها به «${reassignTarget}» منتقل شدند.`);
        if (onReloadProducts) onReloadProducts();
        setTimeout(() => setSuccessMessage(null), 3000);
      }
    }
  };

  // Merge Category logic
  const handleConfirmMerge = () => {
    if (!mergingSourceCat || !mergingTargetCat || mergingSourceCat === mergingTargetCat) {
      setErrorMessage('لطفاً دسته‌بندی مقصد معتبر را انتخاب فرمایید.');
      return;
    }
    if (onDeleteCategory) {
      const success = onDeleteCategory(mergingSourceCat, mergingTargetCat);
      if (success) {
        setSuccessMessage(`دسته‌بندی «${mergingSourceCat}» با موفقیت با دسته‌بندی «${mergingTargetCat}» ادغام شد.`);
        setMergingSourceCat(null);
        setMergingTargetCat('');
        setErrorMessage(null);
        setTimeout(() => setSuccessMessage(null), 3500);
      }
    } else {
      const success = StorageService.deleteCategory(mergingSourceCat, mergingTargetCat);
      if (success) {
        setSuccessMessage(`دسته‌بندی «${mergingSourceCat}» با موفقیت با دسته‌بندی «${mergingTargetCat}» ادغام شد.`);
        setMergingSourceCat(null);
        setMergingTargetCat('');
        setErrorMessage(null);
        if (onReloadProducts) onReloadProducts();
        setTimeout(() => setSuccessMessage(null), 3500);
      }
    }
  };

  // Reorder categories (move up / down)
  const handleMoveCategory = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= categories.length) return;

    const copy = [...categories];
    const [moved] = copy.splice(index, 1);
    copy.splice(targetIndex, 0, moved);

    if (onReorderCategories) {
      onReorderCategories(copy);
    } else {
      StorageService.reorderCategories(copy);
      if (onReloadProducts) onReloadProducts();
    }
  };

  // Batch assign execution
  const handleExecuteBatchAssign = () => {
    if (selectedProductIds.length === 0) {
      setErrorMessage('هیچ کالایی برای انتقال انتخاب نشده است.');
      return;
    }
    const count = StorageService.batchAssignCategory(selectedProductIds, batchTargetCategory);
    setSuccessMessage(`دسته‌بندی ${toPersianDigits(count)} قلم کالا با موفقیت به «${batchTargetCategory}» تغییر یافت.`);
    setSelectedProductIds([]);
    if (onReloadProducts) onReloadProducts();
    setTimeout(() => setSuccessMessage(null), 3500);
  };

  // Batch Repricing execution
  const handleExecuteBatchReprice = () => {
    if (!repriceCategory) {
      setErrorMessage('لطفاً دسته‌بندی مورد نظر را انتخاب فرمایید.');
      return;
    }
    if (repricePercent <= 0) {
      setErrorMessage('درصد تغییر باید بزرگتر از صفر باشد.');
      return;
    }

    const effectivePercent = repriceDirection === 'increase' ? repricePercent : -repricePercent;
    const confirmText = `آیا مطمئن هستید که می‌خواهید قیمت‌های دسته‌بندی «${repriceCategory}» را به میزان ${toPersianDigits(repricePercent)}٪ ${
      repriceDirection === 'increase' ? 'افزایش' : 'کاهش'
    } دهید؟`;

    if (!window.confirm(confirmText)) return;

    setIsApplyingReprice(true);
    try {
      const res = StorageService.batchRepriceCategory(
        repriceCategory,
        repriceTarget,
        effectivePercent,
        repriceRounding
      );
      setSuccessMessage(
        `قیمت‌های دسته‌بندی «${repriceCategory}» به‌روز شد (${toPersianDigits(res.changedCount)} از ${toPersianDigits(res.count)} قلم کالا تغییر کرد).`
      );
      if (onReloadProducts) onReloadProducts();
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch {
      setErrorMessage('خطا در اعمال تغییرات قیمت.');
    } finally {
      setIsApplyingReprice(false);
    }
  };

  // Compute category statistics
  const categoryStats = useMemo(() => {
    const stats: Record<
      string,
      {
        count: number;
        totalStock: number;
        totalInventoryValue: number;
        totalPurchaseValue: number;
        lowStockCount: number;
        outOfStockCount: number;
        products: Product[];
      }
    > = {};

    categories.forEach((cat) => {
      stats[cat] = {
        count: 0,
        totalStock: 0,
        totalInventoryValue: 0,
        totalPurchaseValue: 0,
        lowStockCount: 0,
        outOfStockCount: 0,
        products: [],
      };
    });

    products.forEach((p) => {
      const cat = p.category?.trim() || 'عمومی';
      if (!stats[cat]) {
        stats[cat] = {
          count: 0,
          totalStock: 0,
          totalInventoryValue: 0,
          totalPurchaseValue: 0,
          lowStockCount: 0,
          outOfStockCount: 0,
          products: [],
        };
      }
      stats[cat].count += 1;
      stats[cat].products.push(p);
      const stock = Number(p.stock) || 0;
      stats[cat].totalStock += stock;
      stats[cat].totalInventoryValue += stock * (Number(p.sellPrice) || 0);
      stats[cat].totalPurchaseValue += stock * (Number(p.buyPrice ?? p.purchasePrice) || 0);

      if (stock === 0) {
        stats[cat].outOfStockCount += 1;
      } else if (stock <= (p.minStockAlert || 0)) {
        stats[cat].lowStockCount += 1;
      }
    });

    return stats;
  }, [categories, products]);

  // Overall totals
  const totalAllStock = useMemo(() => products.reduce((s, p) => s + (Number(p.stock) || 0), 0), [products]);
  const totalAllValue = useMemo(
    () => products.reduce((s, p) => s + (Number(p.stock) || 0) * (Number(p.sellPrice) || 0), 0),
    [products]
  );
  const totalAllPurchaseValue = useMemo(
    () => products.reduce((s, p) => s + (Number(p.stock) || 0) * (Number(p.buyPrice ?? p.purchasePrice) || 0), 0),
    [products]
  );

  // Filtered & Sorted categories
  const processedCategories = useMemo(() => {
    let list = categories.filter((c) => c.toLowerCase().includes(searchFilter.trim().toLowerCase()));

    if (sortBy === 'name') {
      list = [...list].sort((a, b) => a.localeCompare(b, 'fa'));
    } else if (sortBy === 'products_count') {
      list = [...list].sort((a, b) => (categoryStats[b]?.count || 0) - (categoryStats[a]?.count || 0));
    } else if (sortBy === 'stock') {
      list = [...list].sort((a, b) => (categoryStats[b]?.totalStock || 0) - (categoryStats[a]?.totalStock || 0));
    } else if (sortBy === 'value') {
      list = [...list].sort(
        (a, b) => (categoryStats[b]?.totalInventoryValue || 0) - (categoryStats[a]?.totalInventoryValue || 0)
      );
    }

    return list;
  }, [categories, searchFilter, sortBy, categoryStats]);

  // Products for batch assignment tab
  const batchFilteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchSearch =
        p.name.toLowerCase().includes(batchSearchProduct.toLowerCase()) ||
        p.code.toLowerCase().includes(batchSearchProduct.toLowerCase());
      const matchCat = batchFilterCurrentCat === 'all' || p.category === batchFilterCurrentCat;
      return matchSearch && matchCat;
    });
  }, [products, batchSearchProduct, batchFilterCurrentCat]);

  // Reprice preview items
  const repricePreviewProducts = useMemo(() => {
    const list = products.filter((p) => p.category === repriceCategory).slice(0, 5);
    const factor = 1 + (repriceDirection === 'increase' ? repricePercent : -repricePercent) / 100;
    const round = (val: number, step: number) => {
      if (step <= 1) return Math.round(val);
      return Math.round(val / step) * step;
    };

    return list.map((p) => {
      const oldSell = Number(p.sellPrice) || 0;
      const oldBuy = Number(p.buyPrice ?? p.purchasePrice) || 0;
      const newSell = Math.max(0, round(oldSell * factor, repriceRounding));
      const newBuy = Math.max(0, round(oldBuy * factor, repriceRounding));
      return {
        id: p.id,
        code: p.code,
        name: p.name,
        oldSell,
        newSell,
        oldBuy,
        newBuy,
      };
    });
  }, [products, repriceCategory, repricePercent, repriceDirection, repriceRounding]);

  // Export Category Products to CSV
  const handleExportCategoryToCsv = (catName: string) => {
    const catProducts = products.filter((p) => (p.category?.trim() || 'عمومی') === catName);
    const headers = ['کد کالا', 'نام کالا', 'دسته‌بندی', 'واحد شمارش', 'موجودی انبار', 'قیمت خرید', 'قیمت فروش', 'ارزش کل موجودی'];
    const rows = catProducts.map((p) => {
      const stock = Number(p.stock) || 0;
      const sell = Number(p.sellPrice) || 0;
      const buy = Number(p.buyPrice ?? p.purchasePrice) || 0;
      return [
        p.code,
        p.name,
        p.category || 'عمومی',
        p.unit || 'عدد',
        stock,
        buy,
        sell,
        stock * sell,
      ];
    });
    downloadCsv(`کالاهای_دسته_${catName}`, headers, rows);
  };

  // Export Analytics Summary to CSV
  const handleExportAnalyticsToCsv = () => {
    const headers = ['نام دسته‌بندی', 'تعداد اقلام', 'مجموع موجودی فیزیکی', 'سهم از موجودی کل (درصد)', 'ارزش موجودی فروش (تومان)', 'ارزش موجودی خرید (تومان)', 'اقلام رو به اتمام', 'اقلام ناموجود'];
    const rows = categories.map((cat) => {
      const stat = categoryStats[cat] || {
        count: 0,
        totalStock: 0,
        totalInventoryValue: 0,
        totalPurchaseValue: 0,
        lowStockCount: 0,
        outOfStockCount: 0,
      };
      const percentage = totalAllStock > 0 ? Math.round((stat.totalStock / totalAllStock) * 100) : 0;
      return [
        cat,
        stat.count,
        stat.totalStock,
        `${percentage}%`,
        stat.totalInventoryValue,
        stat.totalPurchaseValue,
        stat.lowStockCount,
        stat.outOfStockCount,
      ];
    });
    downloadCsv('گزارش_ارزش_موجودی_دسته‌بندی‌ها', headers, rows);
  };

  // Main UI Content Body
  const contentBody = (
    <div className="flex flex-col h-full overflow-hidden bg-white">
      {/* Header (Different if embedded in Admin Panel vs Modal) */}
      <div className={`shrink-0 ${embedded ? 'bg-slate-50 border-b border-slate-200 p-4 sm:p-5' : 'bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white px-5 py-4'} flex items-center justify-between`}>
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${embedded ? 'bg-indigo-100 text-indigo-700 border border-indigo-200' : 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 shadow-inner'}`}>
            <FolderTree className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className={`font-black text-base sm:text-lg ${embedded ? 'text-slate-900' : 'text-white'}`}>
                مدیریت پیشرفته و بهینه دسته‌بندی کالاها
              </h3>
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${embedded ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-indigo-500/30 text-indigo-200 border border-indigo-400/20'}`}>
                {toPersianDigits(categories.length)} گروه کالا
              </span>
            </div>
            <p className={`text-xs mt-0.5 ${embedded ? 'text-slate-500' : 'text-indigo-200/80'}`}>
              سازماندهی موجودی انبار، تغییر نام، ادغام، جابجایی دسته‌جمعی، به‌روزرسانی درصدی قیمت‌ها و گزارش ارزش سرمایه
            </p>
          </div>
        </div>

        {!embedded && onClose && (
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
            title="بستن پنجره"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Navigation Tabs Bar */}
      <div className="shrink-0 bg-slate-100/90 border-b border-slate-200 px-4 sm:px-6 pt-2 flex items-center justify-between gap-2 overflow-x-auto">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setActiveTab('list')}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-t-xl transition-all border-b-2 cursor-pointer whitespace-nowrap ${
              activeTab === 'list'
                ? 'bg-white text-indigo-900 border-indigo-600 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 border-transparent'
            }`}
          >
            <FolderTree className="w-4 h-4 text-indigo-600" />
            <span>فهرست و سازماندهی دسته‌ها</span>
            <span className="text-[10px] bg-slate-100 px-1.5 py-0.2 rounded-full font-mono">
              {toPersianDigits(categories.length)}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('batch_assign')}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-t-xl transition-all border-b-2 cursor-pointer whitespace-nowrap ${
              activeTab === 'batch_assign'
                ? 'bg-white text-indigo-900 border-indigo-600 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 border-transparent'
            }`}
          >
            <Layers className="w-4 h-4 text-indigo-600" />
            <span>تخصیص و جابجایی دسته‌جمعی</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('batch_reprice')}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-t-xl transition-all border-b-2 cursor-pointer whitespace-nowrap ${
              activeTab === 'batch_reprice'
                ? 'bg-white text-indigo-900 border-indigo-600 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 border-transparent'
            }`}
          >
            <Percent className="w-4 h-4 text-emerald-600" />
            <span>به‌روزرسانی درصدی قیمت‌های رسته</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('analytics')}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-t-xl transition-all border-b-2 cursor-pointer whitespace-nowrap ${
              activeTab === 'analytics'
                ? 'bg-white text-indigo-900 border-indigo-600 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 border-transparent'
            }`}
          >
            <BarChart2 className="w-4 h-4 text-indigo-600" />
            <span>ارزش سرمایه و تحلیل انبار</span>
          </button>
        </div>

        <div className="text-[11px] text-slate-500 font-medium hidden md:flex items-center gap-2">
          <span>مجموع کالاها:</span>
          <strong className="text-slate-800 font-mono font-bold">{toPersianDigits(products.length)}</strong>
        </div>
      </div>

      {/* Main Tab Content */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
        {/* Messages */}
        {errorMessage && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center justify-between gap-2 animate-fadeIn">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <button type="button" onClick={() => setErrorMessage(null)} className="text-rose-400 hover:text-rose-700">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {successMessage && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-center justify-between gap-2 animate-fadeIn">
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successMessage}</span>
            </div>
            <button type="button" onClick={() => setSuccessMessage(null)} className="text-emerald-400 hover:text-emerald-700">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* ===================== TAB 1: LIST & ORGANIZE ===================== */}
        {activeTab === 'list' && (
          <div className="space-y-5">
            {/* Quick Add Form */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
              <label className="block text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <FolderPlus className="w-4 h-4 text-emerald-600" />
                <span>تعریف و افزودن دسته‌بندی جدید</span>
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
                  placeholder="نام دسته جدید: مثلاً قطعات یدکی، لوازم برقی، ابزارآلات و..."
                  className="flex-1 bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 placeholder-slate-400 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-medium"
                />
                <button
                  type="submit"
                  className="flex items-center gap-1.5 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-xs rounded-xl shadow-xs transition-all shrink-0 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>افزودن دسته‌بندی</span>
                </button>
              </form>

              {/* Suggestions */}
              <div>
                <div className="text-[11px] font-semibold text-slate-500 mb-2 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  <span>پیشنهادهای پرکاربرد صنعتی و فروشگاهی (افزودن سریع با یک کلیک):</span>
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

            {/* Filter & Sort Controls */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
              <div className="relative flex-1 w-full">
                <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  placeholder="جستجو در بین نام دسته‌بندی‌ها..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-9 pl-4 py-2 text-xs text-slate-800 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
                <div className="flex items-center gap-1.5 text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5">
                  <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400" />
                  <span>مرتب‌سازی:</span>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="bg-transparent font-bold text-slate-800 outline-none cursor-pointer text-xs"
                  >
                    <option value="default">ترتیب پیش‌فرض (قابل جابجایی)</option>
                    <option value="name">بر اساس حروف الفبا</option>
                    <option value="products_count">بیشترین تعداد کالا</option>
                    <option value="stock">بیشترین موجودی فیزیکی</option>
                    <option value="value">بیشترین ارزش ریالی انبار</option>
                  </select>
                </div>

                <button
                  type="button"
                  onClick={handleExportAnalyticsToCsv}
                  className="flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer shrink-0"
                  title="خروجی گزارش کل دسته‌بندی‌ها در فایل اکسل/CSV"
                >
                  <Download className="w-3.5 h-3.5 text-slate-600" />
                  <span>خروجی اکسل</span>
                </button>
              </div>
            </div>

            {/* Merge Box if active */}
            {mergingSourceCat && (
              <div className="p-4 bg-indigo-50 border-2 border-indigo-300 rounded-2xl space-y-3 animate-fadeIn">
                <div className="flex items-center justify-between text-indigo-950 font-bold text-xs">
                  <div className="flex items-center gap-1.5">
                    <Merge className="w-4 h-4 text-indigo-600" />
                    <span>ادغام دسته‌بندی «{mergingSourceCat}» در دسته‌بندی دیگر</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setMergingSourceCat(null)}
                    className="text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-[11.5px] text-slate-600 leading-relaxed">
                  با تایید ادغام، کلیه کالاهای وابسته به <strong>«{mergingSourceCat}»</strong> بدون تغییر در سایر مشخصات، به دسته‌بندی انتخابی زیر منتقل و این دسته حذف خواهد شد:
                </p>
                <div className="flex flex-col sm:flex-row items-center gap-2">
                  <select
                    value={mergingTargetCat}
                    onChange={(e) => setMergingTargetCat(e.target.value)}
                    className="flex-1 w-full bg-white border border-indigo-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none cursor-pointer"
                  >
                    <option value="">-- انتخاب دسته‌بندی مقصد --</option>
                    {categories
                      .filter((c) => c !== mergingSourceCat)
                      .map((c) => (
                        <option key={c} value={c}>
                          انتقال به: {c} ({toPersianDigits(categoryStats[c]?.count || 0)} کالا)
                        </option>
                      ))}
                  </select>
                  <button
                    type="button"
                    onClick={handleConfirmMerge}
                    disabled={!mergingTargetCat}
                    className="w-full sm:w-auto px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl font-bold text-xs transition-colors cursor-pointer shrink-0"
                  >
                    تایید و اجرای ادغام
                  </button>
                </div>
              </div>
            )}

            {/* Categories List Cards */}
            <div className="space-y-2.5">
              {processedCategories.length === 0 ? (
                <div className="text-center py-10 text-slate-400 text-xs bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  هیچ دسته‌بندی مطابق با عبارت جستجو یافت نشد.
                </div>
              ) : (
                processedCategories.map((cat, idx) => {
                  const stat = categoryStats[cat] || {
                    count: 0,
                    totalStock: 0,
                    totalInventoryValue: 0,
                    lowStockCount: 0,
                    outOfStockCount: 0,
                    products: [],
                  };
                  const isEditing = editingCatName === cat;
                  const isDeleting = deletingCat === cat;

                  return (
                    <div
                      key={cat}
                      className="p-3.5 bg-white hover:bg-slate-50/70 rounded-2xl border border-slate-200/90 shadow-2xs transition-all space-y-2.5"
                    >
                      {isEditing ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={renamedValue}
                            onChange={(e) => setRenamedValue(e.target.value)}
                            className="flex-1 bg-white border border-indigo-400 rounded-xl px-3 py-2 text-xs text-slate-800 font-bold outline-none focus:ring-2 focus:ring-indigo-500/20"
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
                        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl space-y-2.5 animate-fadeIn">
                          <div className="flex items-center gap-2 text-rose-800 text-xs font-bold">
                            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                            <span>حذف قطعی دسته‌بندی «{cat}»</span>
                          </div>
                          {stat.count > 0 ? (
                            <div className="text-xs text-slate-700 space-y-2">
                              <p className="text-[11.5px] text-slate-600 leading-relaxed">
                                این دسته‌بندی دارای <strong className="text-rose-700 font-bold">{toPersianDigits(stat.count)} قلم کالا</strong> است. کالاهای این دسته به کدام دسته‌بندی منتقل شوند؟
                              </p>
                              <div className="flex items-center gap-2">
                                <select
                                  value={reassignTarget}
                                  onChange={(e) => setReassignTarget(e.target.value)}
                                  className="flex-1 bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-800 font-medium outline-none cursor-pointer"
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
                              این دسته‌بندی فاقد کالاست و حذف آن تاثیری در موجودی انبار نخواهد داشت.
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
                              className="px-3.5 py-1.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-xs cursor-pointer"
                            >
                              تایید حذف
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            {/* Category Title & Info */}
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-100 flex items-center justify-center font-bold text-xs shrink-0">
                                <Tag className="w-4 h-4 text-indigo-600" />
                              </div>
                              <div>
                                <div className="font-black text-sm text-slate-900 flex items-center gap-2">
                                  <span>{cat}</span>
                                  {cat === 'عمومی' && (
                                    <span className="text-[9px] font-normal text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded border border-slate-200">
                                      پیش‌فرض
                                    </span>
                                  )}
                                </div>
                                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500 mt-0.5">
                                  <span>
                                    <strong>{toPersianDigits(stat.count)}</strong> قلم کالا
                                  </span>
                                  <span>•</span>
                                  <span>
                                    موجودی فیزیکی: <strong className="font-mono text-slate-700 font-bold">{toPersianDigits(stat.totalStock)}</strong>
                                  </span>
                                  {stat.totalInventoryValue > 0 && (
                                    <>
                                      <span>•</span>
                                      <span>
                                        ارزش فروش: <strong className="font-mono text-emerald-700 font-bold">{formatPrice(stat.totalInventoryValue)} {currency}</strong>
                                      </span>
                                    </>
                                  )}
                                  {stat.lowStockCount > 0 && (
                                    <>
                                      <span>•</span>
                                      <span className="text-amber-600 font-bold">
                                        {toPersianDigits(stat.lowStockCount)} قلم کمبود/رو به اتمام
                                      </span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex items-center gap-1 shrink-0">
                              {/* Up/Down Reorder */}
                              {sortBy === 'default' && (
                                <div className="flex items-center bg-slate-100 rounded-lg p-0.5 border border-slate-200">
                                  <button
                                    type="button"
                                    disabled={idx === 0}
                                    onClick={() => handleMoveCategory(idx, 'up')}
                                    className="p-1 text-slate-500 hover:text-slate-900 disabled:opacity-30 cursor-pointer"
                                    title="انتقال به بالا در اولویت منوها"
                                  >
                                    <ArrowUp className="w-3 h-3" />
                                  </button>
                                  <button
                                    type="button"
                                    disabled={idx === categories.length - 1}
                                    onClick={() => handleMoveCategory(idx, 'down')}
                                    className="p-1 text-slate-500 hover:text-slate-900 disabled:opacity-30 cursor-pointer"
                                    title="انتقال به پایین در اولویت منوها"
                                  >
                                    <ArrowDown className="w-3 h-3" />
                                  </button>
                                </div>
                              )}

                              {/* CSV Export of this category */}
                              {stat.count > 0 && (
                                <button
                                  type="button"
                                  onClick={() => handleExportCategoryToCsv(cat)}
                                  className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors cursor-pointer"
                                  title="دانلود خروجی اکسل این دسته‌بندی"
                                >
                                  <Download className="w-3.5 h-3.5" />
                                </button>
                              )}

                              {/* Filter in Inventory Button */}
                              {onSelectCategory && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    onSelectCategory(cat);
                                    if (onClose) onClose();
                                  }}
                                  className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-xl border border-indigo-200 transition-colors cursor-pointer"
                                  title="مشاهده و فیلتر کالاهای این دسته در انبار"
                                >
                                  <Filter className="w-3 h-3 text-indigo-600" />
                                  <span className="hidden sm:inline">فیلتر در انبار</span>
                                </button>
                              )}

                              {/* Quick Preview Toggle */}
                              {stat.count > 0 && (
                                <button
                                  type="button"
                                  onClick={() => setViewingCategoryProducts(viewingCategoryProducts === cat ? null : cat)}
                                  className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors cursor-pointer"
                                  title="مشاهده فهرست سریع کالاهای این دسته"
                                >
                                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${viewingCategoryProducts === cat ? 'rotate-180 text-indigo-600' : ''}`} />
                                </button>
                              )}

                              {/* Merge Button */}
                              {categories.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setMergingSourceCat(cat);
                                    setMergingTargetCat(categories.find((c) => c !== cat) || '');
                                  }}
                                  className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors cursor-pointer"
                                  title="ادغام با دسته‌بندی دیگر"
                                >
                                  <Merge className="w-3.5 h-3.5" />
                                </button>
                              )}

                              {/* Rename Button */}
                              <button
                                type="button"
                                onClick={() => handleStartRename(cat)}
                                className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors cursor-pointer"
                                title="تغییر نام دسته‌بندی"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>

                              {/* Delete Button */}
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

                          {/* Accordion List of Products */}
                          {viewingCategoryProducts === cat && stat.products.length > 0 && (
                            <div className="mt-2.5 pt-2.5 border-t border-slate-100 bg-slate-50/60 p-3 rounded-xl space-y-2 animate-fadeIn">
                              <div className="text-[11px] font-bold text-slate-700 flex items-center justify-between">
                                <span>کالاهای زیرمجموعه «{cat}»:</span>
                                <span className="text-[10px] text-slate-500">
                                  {toPersianDigits(stat.products.length)} کالا
                                </span>
                              </div>
                              <div className="max-h-48 overflow-y-auto space-y-1.5 text-xs divide-y divide-slate-100">
                                {stat.products.map((p) => (
                                  <div key={p.id} className="pt-1.5 flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-1.5 truncate">
                                      <span className="text-[10px] text-slate-400 font-mono">({toPersianDigits(p.code)})</span>
                                      <span className="font-medium text-slate-800 truncate">{p.name}</span>
                                    </div>
                                    <div className="flex items-center gap-3 shrink-0">
                                      <span className="font-mono text-[11px] text-slate-500">
                                        قیمت فروش: <strong className="text-slate-800 font-bold">{formatPrice(p.sellPrice || 0)}</strong>
                                      </span>
                                      <span className="font-mono text-[11px] text-indigo-700 font-bold bg-white px-2 py-0.5 rounded border border-slate-200">
                                        {toPersianDigits(p.stock)} {p.unit || 'عدد'}
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* ===================== TAB 2: BATCH ASSIGN ===================== */}
        {activeTab === 'batch_assign' && (
          <div className="space-y-4">
            <div className="p-3.5 bg-indigo-50/70 border border-indigo-200 rounded-2xl text-xs space-y-1 text-indigo-950">
              <div className="font-bold flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-indigo-600" />
                <span>تغییر و تخصیص دسته‌جمعی دسته‌بندی کالاها</span>
              </div>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                کالاهای مورد نظر خود را با تیک‌زدن انتخاب نمایید و همه آنها را با یک کلیک به دسته‌بندی دلخواه منتقل کنید.
              </p>
            </div>

            {/* Target Selector & Execute Bar */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <span className="text-xs font-bold text-slate-700 whitespace-nowrap">انتقال موارد انتخابی به:</span>
                <select
                  value={batchTargetCategory}
                  onChange={(e) => setBatchTargetCategory(e.target.value)}
                  className="flex-1 sm:w-60 bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none cursor-pointer"
                >
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      دسته‌بندی: {c}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <span className="text-xs text-slate-500 font-medium">
                  انتخاب شده: <strong className="text-indigo-600 font-mono font-bold">{toPersianDigits(selectedProductIds.length)}</strong> کالا
                </span>
                <button
                  type="button"
                  onClick={handleExecuteBatchAssign}
                  disabled={selectedProductIds.length === 0}
                  className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
                >
                  <MoveRight className="w-3.5 h-3.5" />
                  <span>اعمال انتقال</span>
                </button>
              </div>
            </div>

            {/* Filter bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5">
              <div className="relative flex-1 w-full">
                <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={batchSearchProduct}
                  onChange={(e) => setBatchSearchProduct(e.target.value)}
                  placeholder="جستجوی نام یا کد کالا..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-9 pl-3 py-2 text-xs outline-none focus:bg-white focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <select
                  value={batchFilterCurrentCat}
                  onChange={(e) => setBatchFilterCurrentCat(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-700 outline-none cursor-pointer"
                >
                  <option value="all">فیلتر بر اساس دسته فعلی (همه)</option>
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={() => {
                    if (selectedProductIds.length === batchFilteredProducts.length) {
                      setSelectedProductIds([]);
                    } else {
                      setSelectedProductIds(batchFilteredProducts.map((p) => p.id));
                    }
                  }}
                  className="px-3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer whitespace-nowrap"
                >
                  {selectedProductIds.length === batchFilteredProducts.length && batchFilteredProducts.length > 0
                    ? 'لغو انتخاب همه'
                    : 'انتخاب همه'}
                </button>
              </div>
            </div>

            {/* Checkbox Table */}
            <div className="max-h-[45vh] overflow-y-auto border border-slate-200 rounded-2xl">
              <table className="w-full text-right text-xs border-collapse">
                <thead className="bg-slate-100 text-slate-700 sticky top-0 border-b border-slate-200 z-10">
                  <tr>
                    <th className="p-3 w-10 text-center">
                      <input
                        type="checkbox"
                        checked={selectedProductIds.length > 0 && selectedProductIds.length === batchFilteredProducts.length}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedProductIds(batchFilteredProducts.map((p) => p.id));
                          } else {
                            setSelectedProductIds([]);
                          }
                        }}
                        className="w-4 h-4 rounded text-indigo-600 cursor-pointer"
                      />
                    </th>
                    <th className="p-3 font-bold">کد</th>
                    <th className="p-3 font-bold">نام کالا</th>
                    <th className="p-3 font-bold">دسته فعلی</th>
                    <th className="p-3 font-bold text-center">موجودی</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {batchFilteredProducts.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-8 text-slate-400">
                        هیچ کالایی یافت نشد.
                      </td>
                    </tr>
                  ) : (
                    batchFilteredProducts.map((p) => {
                      const isChecked = selectedProductIds.includes(p.id);
                      return (
                        <tr
                          key={p.id}
                          onClick={() => {
                            setSelectedProductIds((prev) =>
                              isChecked ? prev.filter((id) => id !== p.id) : [...prev, p.id]
                            );
                          }}
                          className={`cursor-pointer transition-colors ${
                            isChecked ? 'bg-indigo-50/70' : 'hover:bg-slate-50'
                          }`}
                        >
                          <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                setSelectedProductIds((prev) =>
                                  e.target.checked ? [...prev, p.id] : prev.filter((id) => id !== p.id)
                                );
                              }}
                              className="w-4 h-4 rounded text-indigo-600 cursor-pointer"
                            />
                          </td>
                          <td className="p-3 font-mono text-slate-500 font-bold">{toPersianDigits(p.code)}</td>
                          <td className="p-3 font-bold text-slate-900">{p.name}</td>
                          <td className="p-3">
                            <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md font-medium text-[11px]">
                              {p.category || 'عمومی'}
                            </span>
                          </td>
                          <td className="p-3 text-center font-mono font-bold text-slate-700">
                            {toPersianDigits(p.stock)} {p.unit || 'عدد'}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ===================== TAB 3: BATCH REPRICE ===================== */}
        {activeTab === 'batch_reprice' && (
          <div className="space-y-5">
            <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-2xl text-xs space-y-1.5 text-emerald-950">
              <div className="font-bold flex items-center gap-1.5">
                <Percent className="w-4 h-4 text-emerald-700" />
                <span>به‌روزرسانی و تعدیل درصدی قیمت‌های یک رسته کالا (مدیریت تورم و لیست قیمت)</span>
              </div>
              <p className="text-[11.5px] text-slate-600 leading-relaxed">
                با این ابزار کاربردی می‌توانید قیمت فروش یا خرید کلیه کالاهای یک دسته‌بندی را با درصد مشخصی افزایش یا کاهش داده و با قاعده دلخواه گرد کنید.
              </p>
            </div>

            {/* Reprice Configuration Card */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {/* 1. Category */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">دسته‌بندی هدف:</label>
                  <select
                    value={repriceCategory}
                    onChange={(e) => setRepriceCategory(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none cursor-pointer"
                  >
                    {categories.map((c) => (
                      <option key={c} value={c}>
                        {c} ({toPersianDigits(categoryStats[c]?.count || 0)} کالا)
                      </option>
                    ))}
                  </select>
                </div>

                {/* 2. Target Price */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">نوع قیمت مورد تغییر:</label>
                  <select
                    value={repriceTarget}
                    onChange={(e) => setRepriceTarget(e.target.value as any)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none cursor-pointer"
                  >
                    <option value="sellPrice">فقط قیمت فروش (مصرف‌کننده)</option>
                    <option value="buyPrice">فقط قیمت خرید (تأمین‌کننده)</option>
                    <option value="both">همزمان هر دو قیمت (خرید و فروش)</option>
                  </select>
                </div>

                {/* 3. Direction & Percentage */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">درصد تغییر:</label>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setRepriceDirection(repriceDirection === 'increase' ? 'decrease' : 'increase')}
                      className={`px-2.5 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1 ${
                        repriceDirection === 'increase'
                          ? 'bg-emerald-600 text-white'
                          : 'bg-rose-600 text-white'
                      }`}
                      title="تغییر حالت افزایش / کاهش"
                    >
                      {repriceDirection === 'increase' ? (
                        <>
                          <TrendingUp className="w-3.5 h-3.5" />
                          <span>افزایش (+)</span>
                        </>
                      ) : (
                        <>
                          <TrendingDown className="w-3.5 h-3.5" />
                          <span>کاهش (-)</span>
                        </>
                      )}
                    </button>
                    <input
                      type="number"
                      min={0.1}
                      max={500}
                      step={0.5}
                      value={repricePercent}
                      onChange={(e) => setRepricePercent(Math.max(0.1, Number(e.target.value)))}
                      className="flex-1 bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-800 outline-none"
                    />
                    <span className="text-xs font-bold text-slate-500">٪</span>
                  </div>
                </div>

                {/* 4. Rounding */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">گرد کردن مبالغ نهایی:</label>
                  <select
                    value={repriceRounding}
                    onChange={(e) => setRepriceRounding(Number(e.target.value))}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none cursor-pointer"
                  >
                    <option value={1}>دقیق (بدون گرد کردن)</option>
                    <option value={100}>گرد به ۱۰۰ {currency}</option>
                    <option value={500}>گرد به ۵۰۰ {currency}</option>
                    <option value={1000}>گرد به ۱,۰۰۰ {currency} (رایج)</option>
                    <option value={5000}>گرد به ۵,۰۰۰ {currency}</option>
                    <option value={10000}>گرد به ۱۰,۰۰۰ {currency}</option>
                  </select>
                </div>
              </div>

              {/* Action Button */}
              <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-200">
                <div className="text-xs text-slate-600">
                  کالاهای مشمول: <strong className="text-slate-900 font-bold">{toPersianDigits(categoryStats[repriceCategory]?.count || 0)} قلم</strong> در دسته «{repriceCategory}»
                </div>
                <button
                  type="button"
                  disabled={isApplyingReprice || (categoryStats[repriceCategory]?.count || 0) === 0}
                  onClick={handleExecuteBatchReprice}
                  className="w-full sm:w-auto px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 disabled:opacity-40 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <RefreshCw className={`w-4 h-4 ${isApplyingReprice ? 'animate-spin' : ''}`} />
                  <span>اعمال {repriceDirection === 'increase' ? 'افزایش' : 'کاهش'} {toPersianDigits(repricePercent)}٪ روی دسته «{repriceCategory}»</span>
                </button>
              </div>
            </div>

            {/* Live Preview Card */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-indigo-600" />
                <span>پیش‌نمایش زنده مبالغ قبل و بعد (۵ نمونه اول از این دسته):</span>
              </span>

              <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white">
                <table className="w-full text-right text-xs border-collapse">
                  <thead className="bg-slate-100 text-slate-700 border-b border-slate-200">
                    <tr>
                      <th className="p-3 font-bold">کد</th>
                      <th className="p-3 font-bold">نام کالا</th>
                      <th className="p-3 font-bold text-center">قیمت فروش قبلی</th>
                      <th className="p-3 font-bold text-center">قیمت فروش جدید (محاسبه شده)</th>
                      <th className="p-3 font-bold text-center">اختلاف مبلغ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {repricePreviewProducts.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="text-center py-6 text-slate-400">
                          هیچ کالایی در این دسته‌بندی وجود ندارد.
                        </td>
                      </tr>
                    ) : (
                      repricePreviewProducts.map((p) => {
                        const diff = p.newSell - p.oldSell;
                        return (
                          <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                            <td className="p-3 font-mono text-slate-500 font-bold">{toPersianDigits(p.code)}</td>
                            <td className="p-3 font-bold text-slate-900">{p.name}</td>
                            <td className="p-3 text-center font-mono text-slate-600">
                              {formatPrice(p.oldSell)} {currency}
                            </td>
                            <td className="p-3 text-center font-mono font-bold text-emerald-700">
                              {formatPrice(p.newSell)} {currency}
                            </td>
                            <td className="p-3 text-center font-mono font-bold">
                              <span className={diff >= 0 ? 'text-emerald-600' : 'text-rose-600'}>
                                {diff >= 0 ? '+' : ''}{formatPrice(diff)} {currency}
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ===================== TAB 4: ANALYTICS & CAPITAL ===================== */}
        {activeTab === 'analytics' && (
          <div className="space-y-4">
            {/* Top Stat Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-gradient-to-br from-indigo-50 to-white p-4 rounded-2xl border border-indigo-200 shadow-2xs">
                <span className="text-xs text-indigo-900 font-bold">تعداد کل دسته‌بندی‌ها</span>
                <div className="text-xl font-black text-indigo-950 mt-1">
                  {toPersianDigits(categories.length)}{' '}
                  <span className="text-xs font-normal text-slate-500">گروه کالا</span>
                </div>
              </div>

              <div className="bg-gradient-to-br from-blue-50 to-white p-4 rounded-2xl border border-blue-200 shadow-2xs">
                <span className="text-xs text-blue-900 font-bold">کل موجودی فیزیکی انبار</span>
                <div className="text-xl font-black text-blue-950 mt-1 font-mono">
                  {toPersianDigits(totalAllStock)}{' '}
                  <span className="text-xs font-normal text-slate-500">واحد / عدد</span>
                </div>
              </div>

              <div className="bg-gradient-to-br from-emerald-50 to-white p-4 rounded-2xl border border-emerald-200 shadow-2xs">
                <span className="text-xs text-emerald-900 font-bold">ارزش کل دارایی کالاها (فروش)</span>
                <div className="text-lg font-black text-emerald-950 mt-1 font-mono">
                  {formatPrice(totalAllValue)}{' '}
                  <span className="text-xs font-normal text-slate-500">{currency}</span>
                </div>
              </div>
            </div>

            {/* Export Bar */}
            <div className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-200">
              <span className="text-xs font-bold text-slate-700">جدول تحلیل سهم و ارزش موجودی به تفکیک دسته‌بندی:</span>
              <button
                type="button"
                onClick={handleExportAnalyticsToCsv}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>دریافت خروجی اکسل کامل</span>
              </button>
            </div>

            {/* Breakdown Table */}
            <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white">
              <table className="w-full text-right text-xs border-collapse">
                <thead className="bg-slate-100 text-slate-700 border-b border-slate-200">
                  <tr>
                    <th className="p-3 font-bold">نام دسته‌بندی</th>
                    <th className="p-3 font-bold text-center">تعداد اقلام</th>
                    <th className="p-3 font-bold text-center">مجموع موجودی</th>
                    <th className="p-3 font-bold text-center">سهم از کل موجودی</th>
                    <th className="p-3 font-bold text-center">ارزش فروش ({currency})</th>
                    <th className="p-3 font-bold text-center">وضعیت هشدار</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {categories.map((cat) => {
                    const stat = categoryStats[cat] || {
                      count: 0,
                      totalStock: 0,
                      totalInventoryValue: 0,
                      lowStockCount: 0,
                      outOfStockCount: 0,
                    };
                    const percentage = totalAllStock > 0 ? Math.round((stat.totalStock / totalAllStock) * 100) : 0;

                    return (
                      <tr key={cat} className="hover:bg-slate-50/70 transition-colors">
                        <td className="p-3 font-bold text-slate-900 flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 shrink-0"></span>
                          <span>{cat}</span>
                        </td>
                        <td className="p-3 text-center font-mono font-bold text-slate-700">
                          {toPersianDigits(stat.count)}
                        </td>
                        <td className="p-3 text-center font-mono font-bold text-slate-800">
                          {toPersianDigits(stat.totalStock)}
                        </td>
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <div className="w-20 bg-slate-200 rounded-full h-2 overflow-hidden hidden sm:block">
                              <div
                                className="bg-indigo-600 h-2 rounded-full"
                                style={{ width: `${Math.min(100, percentage)}%` }}
                              ></div>
                            </div>
                            <span className="font-mono text-slate-600 font-bold">{toPersianDigits(percentage)}٪</span>
                          </div>
                        </td>
                        <td className="p-3 text-center font-mono font-black text-emerald-700">
                          {formatPrice(stat.totalInventoryValue)}
                        </td>
                        <td className="p-3 text-center">
                          {stat.outOfStockCount > 0 ? (
                            <span className="text-rose-600 font-bold text-[11px]">
                              {toPersianDigits(stat.outOfStockCount)} ناموجود
                            </span>
                          ) : stat.lowStockCount > 0 ? (
                            <span className="text-amber-600 font-bold text-[11px]">
                              {toPersianDigits(stat.lowStockCount)} رو به اتمام
                            </span>
                          ) : (
                            <span className="text-emerald-600 font-medium text-[11px]">مطلوب</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      {!embedded && (
        <div className="shrink-0 bg-slate-50 border-t border-slate-200 px-5 py-3 flex items-center justify-between">
          <span className="text-xs text-slate-500">
            دسته‌بندی‌های تغییر یافته به صورت آنی در فاکتورها، انبار و گزارش‌ها اعمال می‌شوند.
          </span>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
            >
              بستن
            </button>
          )}
        </div>
      )}
    </div>
  );

  // If embedded in a page (like AdminPanel), render card directly without modal overlay
  if (embedded) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {contentBody}
      </div>
    );
  }

  // Otherwise, render full modal dialog
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-xs">
      <div className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {contentBody}
      </div>
    </div>
  );
};
