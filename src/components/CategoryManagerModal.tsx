import React, { useState, useMemo, useEffect } from 'react';
import { Product, AppUser } from '../types';
import { toPersianDigits, formatPrice } from '../utils/jalali';
import { StorageService, canUserViewBuyPrices } from '../utils/storage';
import { SmartPagination } from './SmartPagination';
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
  Tag,
  AlertTriangle,
  Wand2,
  ShieldAlert,
  DollarSign,
  CheckCircle2,
  Box
} from 'lucide-react';

export interface CategoryManagerProps {
  categories: string[];
  products: Product[];
  currency?: string;
  currentUser?: AppUser | null;
  embedded?: boolean; // If true, renders inline without fixed modal backdrop (for AdminPanel)
  onAddCategory?: (categoryName: string) => boolean;
  onRenameCategory?: (oldName: string, newName: string) => boolean;
  onDeleteCategory?: (categoryName: string, reassignTo?: string) => boolean;
  onReorderCategories?: (newOrderedCategories: string[]) => void;
  onSelectCategory?: (categoryName: string) => void;
  onNavigateToInventory?: () => void;
  onClose?: () => void;
  onReloadProducts?: () => void;
}

export const CategoryManagerModal: React.FC<CategoryManagerProps> = ({
  categories: propCategories,
  products: propProducts,
  currency = 'تومان',
  currentUser,
  embedded = false,
  onAddCategory,
  onRenameCategory,
  onDeleteCategory,
  onReorderCategories,
  onSelectCategory,
  onNavigateToInventory,
  onClose,
  onReloadProducts,
}) => {
  const canViewBuyPrices = canUserViewBuyPrices(currentUser);

  // Reactive local state synced with StorageService so embedded & modal modes update immediately
  const [localCategories, setLocalCategories] = useState<string[]>(() =>
    propCategories && propCategories.length > 0 ? propCategories : StorageService.getCategories()
  );
  const [localProducts, setLocalProducts] = useState<Product[]>(() =>
    propProducts && propProducts.length > 0 ? propProducts : StorageService.getProducts()
  );

  useEffect(() => {
    setLocalCategories(StorageService.getCategories());
  }, [propCategories]);

  useEffect(() => {
    setLocalProducts(propProducts);
  }, [propProducts]);

  useEffect(() => {
    const unsub = StorageService.subscribe(() => {
      setLocalCategories(StorageService.getCategories());
      setLocalProducts(StorageService.getProducts());
    });
    return () => unsub();
  }, []);

  const categories = useMemo(() => {
    const fromProducts = localProducts.map((p) => p.category?.trim()).filter(Boolean) as string[];
    const merged = Array.from(new Set(['عمومی', ...localCategories, ...fromProducts]));
    return merged;
  }, [localCategories, localProducts]);

  const products = localProducts;

  const [newCatName, setNewCatName] = useState('');
  const [editingCatName, setEditingCatName] = useState<string | null>(null);
  const [renamedValue, setRenamedValue] = useState('');
  const [searchFilter, setSearchFilter] = useState('');
  const [categoryStatusFilter, setCategoryStatusFilter] = useState<'all' | 'with_items' | 'empty' | 'low_stock'>('all');
  const [deletingCat, setDeletingCat] = useState<string | null>(null);
  const [reassignTarget, setReassignTarget] = useState<string>('عمومی');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Active Tab
  const [activeTab, setActiveTab] = useState<'list' | 'batch_assign' | 'batch_reprice' | 'analytics'>('list');
  const [mergingSourceCat, setMergingSourceCat] = useState<string | null>(null);
  const [mergingTargetCat, setMergingTargetCat] = useState<string>('');
  const [viewingCategoryProducts, setViewingCategoryProducts] = useState<string | null>(null);
  const [accordionSearch, setAccordionSearch] = useState<string>('');

  // Tab 2: Quick Product Management & Batch Assignment State
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [batchActionMode, setBatchActionMode] = useState<'category' | 'unit' | 'minStock'>('category');
  const [batchTargetCategory, setBatchTargetCategory] = useState<string>(categories[0] || 'عمومی');
  const [batchTargetUnit, setBatchTargetUnit] = useState<string>('عدد');
  const [batchTargetMinStock, setBatchTargetMinStock] = useState<number>(5);
  const [batchSearchProduct, setBatchSearchProduct] = useState('');
  const [batchFilterCurrentCat, setBatchFilterCurrentCat] = useState<string>('all');
  const [batchHealthFilter, setBatchHealthFilter] = useState<
    'all' | 'out_of_stock' | 'low_stock' | 'zero_price' | 'under_cost'
  >('all');
  const [batchPage, setBatchPage] = useState<number>(1);
  const [batchPageSize, setBatchPageSize] = useState<number>(20);

  // Quick Add / Edit Product Modal State
  const [quickProductModal, setQuickProductModal] = useState<{
    isOpen: boolean;
    id?: string;
    code: string;
    name: string;
    category: string;
    unit: string;
    buyPrice: number;
    sellPrice: number;
    wholesalePrice: number;
    stock: number;
    minStockAlert: number;
  } | null>(null);

  // Product Delete Confirmation State (without window.confirm)
  const [deletingProductTarget, setDeletingProductTarget] = useState<Product | null>(null);

  // Tab 3: Batch Repricing State
  const [repriceCategory, setRepriceCategory] = useState<string>('__ALL__');
  const [repriceMode, setRepriceMode] = useState<'percent' | 'fixed_amount' | 'margin_from_buy'>('percent');
  const [repriceTarget, setRepriceTarget] = useState<'sellPrice' | 'buyPrice' | 'wholesalePrice' | 'both'>('sellPrice');
  const [repriceValue, setRepriceValue] = useState<number>(10);
  const [repriceDirection, setRepriceDirection] = useState<'increase' | 'decrease'>('increase');
  const [repriceRounding, setRepriceRounding] = useState<number>(1000);
  const [isApplyingReprice, setIsApplyingReprice] = useState(false);
  const [showRepriceConfirmModal, setShowRepriceConfirmModal] = useState(false);
  const [repriceSearch, setRepriceSearch] = useState('');
  const [repricePage, setRepricePage] = useState<number>(1);
  const [repricePageSize, setRepricePageSize] = useState<number>(15);

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
    'پیچ و مهره',
  ];

  const commonUnits = ['عدد', 'بسته', 'کارتن', 'کیلوگرم', 'متر', 'شاخه', 'کیسه', 'دستگاه', 'ست', 'لیتر', 'حلقه', 'جفت'];

  const showToastSuccess = (msg: string) => {
    setErrorMessage(null);
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(null), 4000);
  };

  // Helper: Export to CSV with UTF-8 BOM for Persian Excel support
  const downloadCsv = (filename: string, headers: string[], rows: (string | number)[][]) => {
    const csvContent =
      '\uFEFF' +
      [headers.join(','), ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))].join(
        '\n'
      );
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const triggerReload = () => {
    setLocalCategories(StorageService.getCategories());
    setLocalProducts(StorageService.getProducts());
    if (onReloadProducts) onReloadProducts();
  };

  const handleAddCategorySubmit = (nameToAdd?: string) => {
    const target = (nameToAdd || newCatName).trim();
    if (!target) {
      setErrorMessage('لطفاً نام دسته‌بندی را وارد نمایید.');
      return;
    }
    const success = onAddCategory ? onAddCategory(target) : StorageService.addCategory(target);
    if (!success) {
      setErrorMessage(`دسته‌بندی «${target}» از قبل وجود دارد.`);
    } else {
      setNewCatName('');
      triggerReload();
      showToastSuccess(`دسته‌بندی «${target}» با موفقیت افزوده شد.`);
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
    const success = onRenameCategory
      ? onRenameCategory(oldName, cleanNew)
      : StorageService.renameCategory(oldName, cleanNew, true);
    if (!success) {
      setErrorMessage(`خطا در تغییر نام دسته‌بندی.`);
    } else {
      setEditingCatName(null);
      triggerReload();
      showToastSuccess(`دسته‌بندی «${oldName}» به «${cleanNew}» تغییر نام یافت و کالاهای آن به‌روز شدند.`);
    }
  };

  const handleConfirmDelete = (cat: string) => {
    const success = onDeleteCategory
      ? onDeleteCategory(cat, reassignTarget)
      : StorageService.deleteCategory(cat, reassignTarget);
    if (success) {
      setDeletingCat(null);
      triggerReload();
      showToastSuccess(`دسته‌بندی «${cat}» حذف شد و کالاهای آن به «${reassignTarget}» منتقل شدند.`);
    }
  };

  const handleConfirmMerge = () => {
    if (!mergingSourceCat || !mergingTargetCat || mergingSourceCat === mergingTargetCat) {
      setErrorMessage('لطفاً دسته‌بندی مقصد معتبر را انتخاب فرمایید.');
      return;
    }
    const success = onDeleteCategory
      ? onDeleteCategory(mergingSourceCat, mergingTargetCat)
      : StorageService.deleteCategory(mergingSourceCat, mergingTargetCat);
    if (success) {
      const src = mergingSourceCat;
      const dst = mergingTargetCat;
      setMergingSourceCat(null);
      setMergingTargetCat('');
      triggerReload();
      showToastSuccess(`دسته‌بندی «${src}» با موفقیت در «${dst}» ادغام شد.`);
    }
  };

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
    }
    triggerReload();
  };

  const handleCleanupEmptyCategories = () => {
    const res = StorageService.cleanupEmptyCategories();
    if (res.removedCount === 0) {
      showToastSuccess('هیچ دسته‌بندی خالی قابل حذفی یافت نشد.');
    } else {
      triggerReload();
      showToastSuccess(`${toPersianDigits(res.removedCount)} دسته‌بندی خالی (${res.removedCategories.join('، ')}) پاکسازی شد.`);
    }
  };

  const handleNormalizeCategories = () => {
    const res = StorageService.normalizeAndDeduplicateCategories();
    triggerReload();
    showToastSuccess(
      `یکپارچه‌سازی انجام شد (${toPersianDigits(res.fixedProductsCount)} کالا استانداردسازی و ${toPersianDigits(
        res.mergedCategoriesCount
      )} دسته تکراری ادغام شد).`
    );
  };

  // Batch product action execution
  const handleExecuteBatchAction = () => {
    if (selectedProductIds.length === 0) {
      setErrorMessage('هیچ کالایی برای اعمال تغییرات انتخاب نشده است.');
      return;
    }
    if (batchActionMode === 'category') {
      const count = StorageService.batchAssignCategory(selectedProductIds, batchTargetCategory);
      setSelectedProductIds([]);
      triggerReload();
      showToastSuccess(`دسته‌بندی ${toPersianDigits(count)} قلم کالا به «${batchTargetCategory}» تغییر یافت.`);
    } else if (batchActionMode === 'unit') {
      const count = StorageService.batchUpdateProductsAttributes(selectedProductIds, { unit: batchTargetUnit });
      setSelectedProductIds([]);
      triggerReload();
      showToastSuccess(`واحد شمارش ${toPersianDigits(count)} قلم کالا به «${batchTargetUnit}» تغییر یافت.`);
    } else if (batchActionMode === 'minStock') {
      const count = StorageService.batchUpdateProductsAttributes(selectedProductIds, {
        minStockAlert: batchTargetMinStock,
      });
      setSelectedProductIds([]);
      triggerReload();
      showToastSuccess(
        `حداقل موجودی هشدار برای ${toPersianDigits(count)} قلم کالا روی ${toPersianDigits(batchTargetMinStock)} تنظیم شد.`
      );
    }
  };

  // Open Quick Product Modal (Create or Edit)
  const handleOpenQuickProductModal = (product?: Product, defaultCategory?: string) => {
    if (product) {
      setQuickProductModal({
        isOpen: true,
        id: product.id,
        code: product.code || '',
        name: product.name || '',
        category: product.category || 'عمومی',
        unit: product.unit || 'عدد',
        buyPrice: Number(product.buyPrice ?? product.purchasePrice) || 0,
        sellPrice: Number(product.sellPrice) || 0,
        wholesalePrice: Number(product.wholesalePrice) || 0,
        stock: Number(product.stock) || 0,
        minStockAlert: Number(product.minStockAlert ?? 5) || 0,
      });
    } else {
      setQuickProductModal({
        isOpen: true,
        code: '',
        name: '',
        category: defaultCategory || (batchFilterCurrentCat !== 'all' ? batchFilterCurrentCat : categories[0] || 'عمومی'),
        unit: 'عدد',
        buyPrice: 0,
        sellPrice: 0,
        wholesalePrice: 0,
        stock: 0,
        minStockAlert: 5,
      });
    }
  };

  const handleSaveQuickProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickProductModal) return;
    if (!quickProductModal.name.trim()) {
      setErrorMessage('لطفاً نام کالا را وارد نمایید.');
      return;
    }
    const isEdit = Boolean(quickProductModal.id);
    const saved = StorageService.quickSaveProduct({
      id: quickProductModal.id,
      code: quickProductModal.code,
      name: quickProductModal.name,
      category: quickProductModal.category,
      unit: quickProductModal.unit,
      buyPrice: canViewBuyPrices ? quickProductModal.buyPrice : undefined,
      sellPrice: quickProductModal.sellPrice,
      wholesalePrice: quickProductModal.wholesalePrice > 0 ? quickProductModal.wholesalePrice : undefined,
      stock: quickProductModal.stock,
      minStockAlert: quickProductModal.minStockAlert,
    });
    setQuickProductModal(null);
    triggerReload();
    showToastSuccess(
      isEdit ? `مشخصات کالای «${saved.name}» با موفقیت بروزرسانی شد.` : `کالای جدید «${saved.name}» در دسته «${saved.category}» ثبت شد.`
    );
  };

  const handleConfirmDeleteProduct = () => {
    if (!deletingProductTarget) return;
    const name = deletingProductTarget.name;
    StorageService.deleteProduct(deletingProductTarget.id);
    setSelectedProductIds((prev) => prev.filter((id) => id !== deletingProductTarget.id));
    setDeletingProductTarget(null);
    triggerReload();
    showToastSuccess(`کالای «${name}» از فهرست کالاها حذف شد.`);
  };

  // Batch Repricing execution
  const handleExecuteBatchReprice = () => {
    if (!repriceCategory) {
      setErrorMessage('لطفاً دسته‌بندی مورد نظر را انتخاب فرمایید.');
      return;
    }
    if (repriceValue <= 0) {
      setErrorMessage('مقدار تغییر باید بزرگتر از صفر باشد.');
      return;
    }

    setIsApplyingReprice(true);
    try {
      const effectiveVal =
        repriceMode === 'margin_from_buy'
          ? repriceValue
          : repriceDirection === 'increase'
          ? repriceValue
          : -repriceValue;

      const effectiveTarget = !canViewBuyPrices && (repriceTarget === 'buyPrice' || repriceTarget === 'both')
        ? 'sellPrice'
        : repriceTarget;

      const res = StorageService.batchRepriceCategory(
        repriceCategory,
        effectiveTarget,
        effectiveVal,
        repriceRounding,
        repriceMode
      );
      setShowRepriceConfirmModal(false);
      triggerReload();
      const catLabel = repriceCategory === '__ALL__' ? 'همه دسته‌بندی‌ها' : `دسته «${repriceCategory}»`;
      showToastSuccess(
        `قیمت‌های ${catLabel} با موفقیت به‌روز شد (${toPersianDigits(res.changedCount)} از ${toPersianDigits(
          res.count
        )} قلم کالا تغییر کرد).`
      );
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

      if (stock <= 0) {
        stats[cat].outOfStockCount += 1;
      } else if (stock <= (p.minStockAlert || 0)) {
        stats[cat].lowStockCount += 1;
      }
    });

    return stats;
  }, [categories, products]);

  // Overall totals & Health Metrics
  const totalAllStock = useMemo(() => products.reduce((s, p) => s + (Number(p.stock) || 0), 0), [products]);
  const totalAllValue = useMemo(
    () => products.reduce((s, p) => s + (Number(p.stock) || 0) * (Number(p.sellPrice) || 0), 0),
    [products]
  );
  const totalAllPurchaseValue = useMemo(
    () => products.reduce((s, p) => s + (Number(p.stock) || 0) * (Number(p.buyPrice ?? p.purchasePrice) || 0), 0),
    [products]
  );

  const healthMetrics = useMemo(() => {
    const emptyCategoriesCount = categories.filter((c) => c !== 'عمومی' && (categoryStats[c]?.count || 0) === 0).length;
    const outOfStockProductsCount = products.filter((p) => (Number(p.stock) || 0) <= 0).length;
    const lowStockProductsCount = products.filter(
      (p) => (Number(p.stock) || 0) > 0 && (Number(p.stock) || 0) <= (Number(p.minStockAlert) || 0)
    ).length;
    const zeroSellPriceCount = products.filter((p) => (Number(p.sellPrice) || 0) <= 0).length;
    const underCostCount = products.filter((p) => {
      const sell = Number(p.sellPrice) || 0;
      const buy = Number(p.buyPrice ?? p.purchasePrice) || 0;
      return sell > 0 && buy > 0 && sell < buy;
    }).length;
    return {
      emptyCategoriesCount,
      outOfStockProductsCount,
      lowStockProductsCount,
      zeroSellPriceCount,
      underCostCount,
    };
  }, [categories, categoryStats, products]);

  // Filtered & Sorted categories
  const processedCategories = useMemo(() => {
    let list = categories.filter((c) => c.toLowerCase().includes(searchFilter.trim().toLowerCase()));

    if (categoryStatusFilter === 'with_items') {
      list = list.filter((c) => (categoryStats[c]?.count || 0) > 0);
    } else if (categoryStatusFilter === 'empty') {
      list = list.filter((c) => (categoryStats[c]?.count || 0) === 0);
    } else if (categoryStatusFilter === 'low_stock') {
      list = list.filter(
        (c) => (categoryStats[c]?.outOfStockCount || 0) > 0 || (categoryStats[c]?.lowStockCount || 0) > 0
      );
    }

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
  }, [categories, searchFilter, categoryStatusFilter, sortBy, categoryStats]);

  // Products for Tab 2 (Quick Product Management & Batch Assignment)
  const batchFilteredProducts = useMemo(() => {
    const q = batchSearchProduct.trim().toLowerCase();
    return products.filter((p) => {
      const matchSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        (p.code || '').toLowerCase().includes(q) ||
        (p.category || '').toLowerCase().includes(q);
      const matchCat = batchFilterCurrentCat === 'all' || (p.category || 'عمومی') === batchFilterCurrentCat;
      if (!matchSearch || !matchCat) return false;

      const stock = Number(p.stock) || 0;
      const sell = Number(p.sellPrice) || 0;
      const buy = Number(p.buyPrice ?? p.purchasePrice) || 0;

      if (batchHealthFilter === 'out_of_stock') return stock <= 0;
      if (batchHealthFilter === 'low_stock') return stock > 0 && stock <= (Number(p.minStockAlert) || 0);
      if (batchHealthFilter === 'zero_price') return sell <= 0;
      if (batchHealthFilter === 'under_cost') return sell > 0 && buy > 0 && sell < buy;
      return true;
    });
  }, [products, batchSearchProduct, batchFilterCurrentCat, batchHealthFilter]);

  const paginatedBatchProducts = useMemo(() => {
    const start = (batchPage - 1) * batchPageSize;
    return batchFilteredProducts.slice(start, start + batchPageSize);
  }, [batchFilteredProducts, batchPage, batchPageSize]);

  // Reset page when filters change
  useEffect(() => {
    setBatchPage(1);
  }, [batchSearchProduct, batchFilterCurrentCat, batchHealthFilter]);

  // Reprice preview items (all matching products with pagination)
  const repricePreviewAllProducts = useMemo(() => {
    const isAll = repriceCategory === '__ALL__';
    const q = repriceSearch.trim().toLowerCase();
    const list = products.filter((p) => {
      const pCat = (p.category || 'عمومی').trim();
      if (!isAll && pCat !== repriceCategory) return false;
      if (q && !p.name.toLowerCase().includes(q) && !(p.code || '').toLowerCase().includes(q)) return false;
      return true;
    });

    const signedVal =
      repriceMode === 'margin_from_buy'
        ? repriceValue
        : repriceDirection === 'increase'
        ? repriceValue
        : -repriceValue;
    const factor = 1 + signedVal / 100;
    const round = (val: number, step: number) => {
      if (step <= 1) return Math.round(val);
      return Math.round(val / step) * step;
    };

    return list.map((p) => {
      const oldSell = Number(p.sellPrice) || 0;
      const oldBuy = Number(p.buyPrice ?? p.purchasePrice) || 0;
      const oldWholesale = Number(p.wholesalePrice) || 0;

      let newSell = oldSell;
      let newBuy = oldBuy;

      if (repriceMode === 'margin_from_buy') {
        if (oldBuy > 0) {
          newSell = Math.max(0, round(oldBuy * (1 + repriceValue / 100), repriceRounding));
        }
      } else if (repriceMode === 'fixed_amount') {
        if (repriceTarget === 'sellPrice' || repriceTarget === 'both') {
          if (oldSell > 0 || signedVal > 0) newSell = Math.max(0, round(oldSell + signedVal, repriceRounding));
        }
        if (repriceTarget === 'buyPrice' || repriceTarget === 'both') {
          if (oldBuy > 0 || signedVal > 0) newBuy = Math.max(0, round(oldBuy + signedVal, repriceRounding));
        }
      } else {
        if (repriceTarget === 'sellPrice' || repriceTarget === 'both') {
          if (oldSell > 0) newSell = Math.max(0, round(oldSell * factor, repriceRounding));
        }
        if (repriceTarget === 'buyPrice' || repriceTarget === 'both') {
          if (oldBuy > 0) newBuy = Math.max(0, round(oldBuy * factor, repriceRounding));
        }
      }

      return {
        id: p.id,
        code: p.code,
        name: p.name,
        category: p.category || 'عمومی',
        oldSell,
        newSell,
        oldBuy,
        newBuy,
        oldWholesale,
      };
    });
  }, [products, repriceCategory, repriceMode, repriceTarget, repriceValue, repriceDirection, repriceRounding, repriceSearch]);

  const paginatedRepricePreview = useMemo(() => {
    const start = (repricePage - 1) * repricePageSize;
    return repricePreviewAllProducts.slice(start, start + repricePageSize);
  }, [repricePreviewAllProducts, repricePage, repricePageSize]);

  // Export Category Products to CSV
  const handleExportCategoryToCsv = (catName: string) => {
    const catProducts = products.filter((p) => (p.category?.trim() || 'عمومی') === catName);
    const headers = canViewBuyPrices
      ? ['کد کالا', 'نام کالا', 'دسته‌بندی', 'واحد شمارش', 'موجودی انبار', 'قیمت خرید', 'قیمت فروش', 'ارزش کل موجودی فروش']
      : ['کد کالا', 'نام کالا', 'دسته‌بندی', 'واحد شمارش', 'موجودی انبار', 'قیمت فروش', 'ارزش کل موجودی فروش'];

    const rows = catProducts.map((p) => {
      const stock = Number(p.stock) || 0;
      const sell = Number(p.sellPrice) || 0;
      const buy = Number(p.buyPrice ?? p.purchasePrice) || 0;
      return canViewBuyPrices
        ? [p.code, p.name, p.category || 'عمومی', p.unit || 'عدد', stock, buy, sell, stock * sell]
        : [p.code, p.name, p.category || 'عمومی', p.unit || 'عدد', stock, sell, stock * sell];
    });
    downloadCsv(`کالاهای_دسته_${catName}`, headers, rows);
  };

  // Export Analytics Summary to CSV
  const handleExportAnalyticsToCsv = () => {
    const headers = canViewBuyPrices
      ? [
          'نام دسته‌بندی',
          'تعداد اقلام',
          'مجموع موجودی فیزیکی',
          'سهم از موجودی کل (درصد)',
          'ارزش موجودی فروش',
          'ارزش موجودی خرید',
          'سود ناخالص مورد انتظار',
          'اقلام رو به اتمام',
          'اقلام ناموجود',
        ]
      : [
          'نام دسته‌بندی',
          'تعداد اقلام',
          'مجموع موجودی فیزیکی',
          'سهم از موجودی کل (درصد)',
          'ارزش موجودی فروش',
          'اقلام رو به اتمام',
          'اقلام ناموجود',
        ];

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
      const profit = stat.totalInventoryValue - stat.totalPurchaseValue;
      return canViewBuyPrices
        ? [
            cat,
            stat.count,
            stat.totalStock,
            `${percentage}%`,
            stat.totalInventoryValue,
            stat.totalPurchaseValue,
            profit,
            stat.lowStockCount,
            stat.outOfStockCount,
          ]
        : [cat, stat.count, stat.totalStock, `${percentage}%`, stat.totalInventoryValue, stat.lowStockCount, stat.outOfStockCount];
    });
    downloadCsv('گزارش_تحلیل_دسته‌بندی_کالاها', headers, rows);
  };

  // Jump to filtered products in Tab 2
  const jumpToProductsFilter = (
    catFilter: string,
    healthFilter: 'all' | 'out_of_stock' | 'low_stock' | 'zero_price' | 'under_cost' = 'all'
  ) => {
    setBatchFilterCurrentCat(catFilter);
    setBatchHealthFilter(healthFilter);
    setActiveTab('batch_assign');
  };

  // Main UI Content Body
  const contentBody = (
    <div className="flex flex-col h-full overflow-hidden bg-white">
      {/* Header */}
      <div
        className={`shrink-0 ${
          embedded
            ? 'bg-slate-900 text-white p-4 sm:p-5'
            : 'bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white px-5 py-4'
        } flex flex-col sm:flex-row sm:items-center justify-between gap-3`}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 flex items-center justify-center shrink-0">
            <FolderTree className="w-5 h-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-black text-sm sm:text-base text-white">
                مرکز مدیریت هوشمند کالاها و دسته‌بندی‌ها
              </h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/30 text-indigo-200 border border-indigo-400/30">
                {toPersianDigits(categories.length)} دسته • {toPersianDigits(products.length)} کالا
              </span>
            </div>
            <p className="text-[11px] text-slate-300 mt-0.5">
              سازماندهی ساختار دسته‌ها، تعریف و ویرایش سریع کالاها، قیمت‌گذاری گروهی و پایش سلامت انبار
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <button
            type="button"
            onClick={() => handleOpenQuickProductModal()}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>تعریف سریع کالا</span>
          </button>

          {onNavigateToInventory && (
            <button
              type="button"
              onClick={onNavigateToInventory}
              className="flex items-center gap-1.5 px-3 py-2 bg-white/10 hover:bg-white/20 text-white border border-white/15 rounded-xl text-xs font-bold transition-all cursor-pointer"
            >
              <Package className="w-3.5 h-3.5 text-indigo-300" />
              <span>رفتن به انبار</span>
            </button>
          )}

          {!embedded && onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-300 hover:text-white rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
              title="بستن پنجره"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Quick KPI Summary Strip */}
      <div className="shrink-0 bg-slate-50 border-b border-slate-200 px-4 sm:px-6 py-3 grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        <div className="bg-white p-2.5 sm:p-3 rounded-xl border border-slate-200/80 flex items-center justify-between">
          <div>
            <div className="text-[10px] text-slate-500 font-bold">دسته‌بندی‌های فعال</div>
            <div className="text-sm sm:text-base font-black text-slate-900 mt-0.5">
              {toPersianDigits(categories.length)}{' '}
              <span className="text-[10px] font-normal text-slate-500">گروه</span>
            </div>
          </div>
          {healthMetrics.emptyCategoriesCount > 0 ? (
            <button
              type="button"
              onClick={handleCleanupEmptyCategories}
              className="text-[10px] font-bold px-2 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 transition-colors cursor-pointer"
              title="حذف خودکار دسته‌بندی‌های بدون کالا"
            >
              پاکسازی {toPersianDigits(healthMetrics.emptyCategoriesCount)} خالی
            </button>
          ) : (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-700">
              منظم
            </span>
          )}
        </div>

        <div className="bg-white p-2.5 sm:p-3 rounded-xl border border-slate-200/80 flex items-center justify-between">
          <div>
            <div className="text-[10px] text-slate-500 font-bold">کل اقلام و موجودی</div>
            <div className="text-sm sm:text-base font-black text-slate-900 mt-0.5">
              {toPersianDigits(products.length)} کالا{' '}
              <span className="text-[11px] font-mono font-bold text-indigo-600">
                ({toPersianDigits(totalAllStock)} واحد)
              </span>
            </div>
          </div>
          <Box className="w-5 h-5 text-indigo-500 shrink-0" />
        </div>

        <div className="bg-white p-2.5 sm:p-3 rounded-xl border border-slate-200/80 flex items-center justify-between">
          <div>
            <div className="text-[10px] text-slate-500 font-bold">وضعیت هشدار موجودی</div>
            <div className="flex items-center gap-2 mt-0.5">
              <button
                type="button"
                onClick={() => jumpToProductsFilter('all', 'out_of_stock')}
                className="text-xs font-black text-rose-600 hover:underline cursor-pointer"
              >
                {toPersianDigits(healthMetrics.outOfStockProductsCount)} ناموجود
              </button>
              <span className="text-slate-300">•</span>
              <button
                type="button"
                onClick={() => jumpToProductsFilter('all', 'low_stock')}
                className="text-xs font-bold text-amber-600 hover:underline cursor-pointer"
              >
                {toPersianDigits(healthMetrics.lowStockProductsCount)} کمبود
              </button>
            </div>
          </div>
          <AlertTriangle
            className={`w-5 h-5 shrink-0 ${
              healthMetrics.outOfStockProductsCount > 0 ? 'text-rose-500' : 'text-emerald-500'
            }`}
          />
        </div>

        <div className="bg-white p-2.5 sm:p-3 rounded-xl border border-slate-200/80 flex items-center justify-between">
          <div className="min-w-0">
            <div className="text-[10px] text-slate-500 font-bold">ارزش فروش موجودی</div>
            <div className="text-xs sm:text-sm font-black font-mono text-emerald-700 truncate mt-0.5">
              {formatPrice(totalAllValue)} <span className="text-[10px] font-normal">{currency}</span>
            </div>
          </div>
          <DollarSign className="w-5 h-5 text-emerald-600 shrink-0" />
        </div>
      </div>

      {/* Navigation Tabs Bar */}
      <div className="shrink-0 bg-slate-100 border-b border-slate-200 px-3 sm:px-6 pt-2 flex items-center justify-between gap-1 overflow-x-auto">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setActiveTab('list')}
            className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-bold rounded-t-xl transition-all border-b-2 cursor-pointer whitespace-nowrap ${
              activeTab === 'list'
                ? 'bg-white text-indigo-900 border-indigo-600 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 border-transparent'
            }`}
          >
            <FolderTree className="w-4 h-4 text-indigo-600" />
            <span>سازماندهی دسته‌بندی‌ها</span>
            <span className="text-[10px] bg-indigo-50 text-indigo-700 px-1.5 py-0.2 rounded-full font-mono">
              {toPersianDigits(categories.length)}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('batch_assign')}
            className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-bold rounded-t-xl transition-all border-b-2 cursor-pointer whitespace-nowrap ${
              activeTab === 'batch_assign'
                ? 'bg-white text-indigo-900 border-indigo-600 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 border-transparent'
            }`}
          >
            <Layers className="w-4 h-4 text-indigo-600" />
            <span>مدیریت سریع و ویرایش گروهی کالاها</span>
            <span className="text-[10px] bg-slate-200/80 text-slate-700 px-1.5 py-0.2 rounded-full font-mono">
              {toPersianDigits(products.length)}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('batch_reprice')}
            className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-bold rounded-t-xl transition-all border-b-2 cursor-pointer whitespace-nowrap ${
              activeTab === 'batch_reprice'
                ? 'bg-white text-indigo-900 border-indigo-600 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 border-transparent'
            }`}
          >
            <Percent className="w-4 h-4 text-emerald-600" />
            <span>تعدیل هوشمند قیمت‌ها</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('analytics')}
            className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-bold rounded-t-xl transition-all border-b-2 cursor-pointer whitespace-nowrap ${
              activeTab === 'analytics'
                ? 'bg-white text-indigo-900 border-indigo-600 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 border-transparent'
            }`}
          >
            <BarChart2 className="w-4 h-4 text-indigo-600" />
            <span>تحلیل سرمایه و پایش سلامت</span>
          </button>
        </div>
      </div>

      {/* Main Tab Content */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
        {/* Notifications */}
        {errorMessage && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-bold flex items-center justify-between gap-2">
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
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-bold flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successMessage}</span>
            </div>
            <button type="button" onClick={() => setSuccessMessage(null)} className="text-emerald-400 hover:text-emerald-700">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* ===================== TAB 1: LIST & ORGANIZE CATEGORIES ===================== */}
        {activeTab === 'list' && (
          <div className="space-y-5">
            {/* Quick Add Form & Maintenance Actions */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <FolderPlus className="w-4 h-4 text-emerald-600" />
                  <span>تعریف و افزودن دسته‌بندی جدید</span>
                </label>

                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleNormalizeCategories}
                    className="flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 border border-slate-200 rounded-lg text-[11px] font-bold transition-colors cursor-pointer"
                    title="حذف فاصله‌های اضافی و یکسان‌سازی نام دسته‌بندی‌های کالاها"
                  >
                    <Wand2 className="w-3.5 h-3.5 text-indigo-600" />
                    <span>یکپارچه‌سازی نام دسته‌ها</span>
                  </button>
                  {healthMetrics.emptyCategoriesCount > 0 && (
                    <button
                      type="button"
                      onClick={handleCleanupEmptyCategories}
                      className="flex items-center gap-1 px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg text-[11px] font-bold transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-amber-600" />
                      <span>حذف دسته‌های خالی ({toPersianDigits(healthMetrics.emptyCategoriesCount)})</span>
                    </button>
                  )}
                </div>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleAddCategorySubmit();
                }}
                className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2"
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
                  className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-xs rounded-xl shadow-xs transition-all shrink-0 cursor-pointer"
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
                      >
                        {exists ? `✓ ${sug}` : `+ ${sug}`}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Filter, Status Pills & Sort Controls */}
            <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 flex-1">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    placeholder="جستجو در نام دسته‌بندی‌ها..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-9 pl-4 py-2 text-xs text-slate-800 outline-none focus:bg-white focus:border-indigo-500"
                  />
                </div>

                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 overflow-x-auto">
                  {[
                    { id: 'all', label: 'همه' },
                    { id: 'with_items', label: 'دارای کالا' },
                    { id: 'empty', label: 'خالی' },
                    { id: 'low_stock', label: 'دارای کمبود' },
                  ].map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setCategoryStatusFilter(f.id as any)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer whitespace-nowrap ${
                        categoryStatusFilter === f.id
                          ? 'bg-white text-indigo-700 shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2 justify-between sm:justify-end">
                <div className="flex items-center gap-1.5 text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5">
                  <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400" />
                  <span>مرتب‌سازی:</span>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="bg-transparent font-bold text-slate-800 outline-none cursor-pointer text-xs"
                  >
                    <option value="default">ترتیب پیش‌فرض (دستی)</option>
                    <option value="name">بر اساس حروف الفبا</option>
                    <option value="products_count">بیشترین تعداد کالا</option>
                    <option value="stock">بیشترین موجودی فیزیکی</option>
                    <option value="value">بیشترین ارزش ریالی</option>
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
              <div className="p-4 bg-indigo-50 border-2 border-indigo-300 rounded-2xl space-y-3">
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
                  با تایید ادغام، کلیه کالاهای وابسته به <strong>«{mergingSourceCat}»</strong> به دسته‌بندی انتخابی زیر منتقل شده و دسته مبدا حذف خواهد شد:
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
                  هیچ دسته‌بندی مطابق با فیلتر انتخابی یافت نشد.
                </div>
              ) : (
                processedCategories.map((cat, idx) => {
                  const stat = categoryStats[cat] || {
                    count: 0,
                    totalStock: 0,
                    totalInventoryValue: 0,
                    totalPurchaseValue: 0,
                    lowStockCount: 0,
                    outOfStockCount: 0,
                    products: [],
                  };
                  const isEditing = editingCatName === cat;
                  const isDeleting = deletingCat === cat;
                  const stockShare = totalAllStock > 0 ? Math.round((stat.totalStock / totalAllStock) * 100) : 0;

                  return (
                    <div
                      key={cat}
                      className="p-3.5 bg-white hover:bg-slate-50/60 rounded-2xl border border-slate-200/90 shadow-2xs transition-all space-y-2.5"
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
                        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl space-y-2.5">
                          <div className="flex items-center gap-2 text-rose-800 text-xs font-bold">
                            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                            <span>حذف دسته‌بندی «{cat}»</span>
                          </div>
                          {stat.count > 0 ? (
                            <div className="text-xs text-slate-700 space-y-2">
                              <p className="text-[11.5px] text-slate-600 leading-relaxed">
                                این دسته‌بندی دارای{' '}
                                <strong className="text-rose-700 font-bold">{toPersianDigits(stat.count)} قلم کالا</strong>{' '}
                                است. کالاهای این دسته به کدام دسته‌بندی منتقل شوند؟
                              </p>
                              <select
                                value={reassignTarget}
                                onChange={(e) => setReassignTarget(e.target.value)}
                                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-800 font-medium outline-none cursor-pointer"
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
                            {/* Category Title & Stats */}
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-100 flex items-center justify-center font-bold text-xs shrink-0">
                                <Tag className="w-4 h-4 text-indigo-600" />
                              </div>
                              <div>
                                <div className="font-black text-sm text-slate-900 flex flex-wrap items-center gap-2">
                                  <span>{cat}</span>
                                  {cat === 'عمومی' && (
                                    <span className="text-[9px] font-normal text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded border border-slate-200">
                                      پیش‌فرض
                                    </span>
                                  )}
                                  {stat.outOfStockCount > 0 && (
                                    <span className="text-[10px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                                      {toPersianDigits(stat.outOfStockCount)} ناموجود
                                    </span>
                                  )}
                                  {stat.lowStockCount > 0 && (
                                    <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                                      {toPersianDigits(stat.lowStockCount)} کمبود
                                    </span>
                                  )}
                                </div>
                                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500 mt-0.5">
                                  <span>
                                    <strong className="text-slate-800">{toPersianDigits(stat.count)}</strong> قلم کالا
                                  </span>
                                  <span>•</span>
                                  <span>
                                    موجودی: <strong className="font-mono text-slate-700 font-bold">{toPersianDigits(stat.totalStock)}</strong> ({toPersianDigits(stockShare)}٪)
                                  </span>
                                  {stat.totalInventoryValue > 0 && (
                                    <>
                                      <span>•</span>
                                      <span>
                                        ارزش فروش:{' '}
                                        <strong className="font-mono text-emerald-700 font-bold">
                                          {formatPrice(stat.totalInventoryValue)} {currency}
                                        </strong>
                                      </span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex flex-wrap items-center gap-1 shrink-0">
                              {/* Up/Down Reorder */}
                              {sortBy === 'default' && !searchFilter && categoryStatusFilter === 'all' && (
                                <div className="flex items-center bg-slate-100 rounded-lg p-0.5 border border-slate-200">
                                  <button
                                    type="button"
                                    disabled={idx === 0}
                                    onClick={() => handleMoveCategory(idx, 'up')}
                                    className="p-1 text-slate-500 hover:text-slate-900 disabled:opacity-30 cursor-pointer"
                                    title="انتقال به بالا"
                                  >
                                    <ArrowUp className="w-3 h-3" />
                                  </button>
                                  <button
                                    type="button"
                                    disabled={idx === categories.length - 1}
                                    onClick={() => handleMoveCategory(idx, 'down')}
                                    className="p-1 text-slate-500 hover:text-slate-900 disabled:opacity-30 cursor-pointer"
                                    title="انتقال به پایین"
                                  >
                                    <ArrowDown className="w-3 h-3" />
                                  </button>
                                </div>
                              )}

                              {/* Quick Add Product to this Category */}
                              <button
                                type="button"
                                onClick={() => handleOpenQuickProductModal(undefined, cat)}
                                className="flex items-center gap-1 px-2 py-1.5 text-[11px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-xl border border-emerald-200 transition-colors cursor-pointer"
                                title={`افزودن سریع کالا در دسته «${cat}»`}
                              >
                                <Plus className="w-3 h-3" />
                                <span className="hidden sm:inline">کالای جدید</span>
                              </button>

                              {/* Manage Category Products in Tab 2 */}
                              {stat.count > 0 && (
                                <button
                                  type="button"
                                  onClick={() => jumpToProductsFilter(cat, 'all')}
                                  className="flex items-center gap-1 px-2 py-1.5 text-[11px] font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-xl border border-indigo-200 transition-colors cursor-pointer"
                                  title="مدیریت و ویرایش گروهی کالاهای این دسته"
                                >
                                  <Layers className="w-3 h-3" />
                                  <span className="hidden md:inline">مدیریت کالاها</span>
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
                                  className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors cursor-pointer"
                                  title="فیلتر کالاهای این دسته در صفحه انبار"
                                >
                                  <Filter className="w-3.5 h-3.5" />
                                </button>
                              )}

                              {/* CSV Export of this category */}
                              {stat.count > 0 && (
                                <button
                                  type="button"
                                  onClick={() => handleExportCategoryToCsv(cat)}
                                  className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors cursor-pointer"
                                  title="دانلود خروجی اکسل کالاهای این دسته"
                                >
                                  <Download className="w-3.5 h-3.5" />
                                </button>
                              )}

                              {/* Quick Accordion Toggle */}
                              {stat.count > 0 && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setViewingCategoryProducts(viewingCategoryProducts === cat ? null : cat);
                                    setAccordionSearch('');
                                  }}
                                  className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors cursor-pointer"
                                  title="پیش‌نمایش سریع کالاهای این دسته"
                                >
                                  <ChevronDown
                                    className={`w-3.5 h-3.5 transition-transform ${
                                      viewingCategoryProducts === cat ? 'rotate-180 text-indigo-600' : ''
                                    }`}
                                  />
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

                          {/* Accordion List of Products with Search & Quick Edit */}
                          {viewingCategoryProducts === cat && stat.products.length > 0 && (
                            <div className="mt-2.5 pt-2.5 border-t border-slate-100 bg-slate-50/70 p-3 rounded-xl space-y-2.5">
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                <span className="text-[11px] font-bold text-slate-700">
                                  کالاهای زیرمجموعه «{cat}» ({toPersianDigits(stat.products.length)} کالا):
                                </span>
                                <input
                                  type="text"
                                  value={accordionSearch}
                                  onChange={(e) => setAccordionSearch(e.target.value)}
                                  placeholder="جستجو در کالاهای این دسته..."
                                  className="bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-[11px] outline-none focus:border-indigo-400 sm:w-56"
                                />
                              </div>
                              <div className="max-h-56 overflow-y-auto divide-y divide-slate-200/60 text-xs">
                                {stat.products
                                  .filter(
                                    (p) =>
                                      !accordionSearch.trim() ||
                                      p.name.toLowerCase().includes(accordionSearch.trim().toLowerCase()) ||
                                      (p.code || '').toLowerCase().includes(accordionSearch.trim().toLowerCase())
                                  )
                                  .map((p) => (
                                    <div key={p.id} className="py-1.5 flex items-center justify-between gap-2">
                                      <div className="flex items-center gap-1.5 truncate">
                                        <span className="text-[10px] text-slate-400 font-mono">
                                          ({toPersianDigits(p.code)})
                                        </span>
                                        <span className="font-bold text-slate-800 truncate">{p.name}</span>
                                      </div>
                                      <div className="flex items-center gap-2 shrink-0">
                                        <span className="font-mono text-[11px] text-slate-600">
                                          فروش: <strong className="text-slate-900">{formatPrice(p.sellPrice || 0)}</strong>
                                        </span>
                                        <span
                                          className={`font-mono text-[10px] font-bold px-2 py-0.5 rounded border ${
                                            (p.stock || 0) <= 0
                                              ? 'bg-rose-50 text-rose-700 border-rose-200'
                                              : 'bg-white text-indigo-700 border-slate-200'
                                          }`}
                                        >
                                          {toPersianDigits(p.stock)} {p.unit || 'عدد'}
                                        </span>
                                        <button
                                          type="button"
                                          onClick={() => handleOpenQuickProductModal(p)}
                                          className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-white rounded-lg transition-colors cursor-pointer"
                                          title="ویرایش سریع این کالا"
                                        >
                                          <Edit2 className="w-3.5 h-3.5" />
                                        </button>
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

        {/* ===================== TAB 2: QUICK PRODUCT MANAGEMENT & BULK ACTIONS ===================== */}
        {activeTab === 'batch_assign' && (
          <div className="space-y-4">
            {/* Bulk Action Toolbar */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-indigo-600" />
                  <span className="text-xs font-black text-slate-800">
                    عملیات گروهی روی کالاهای انتخاب‌شده ({toPersianDigits(selectedProductIds.length)} مورد)
                  </span>
                </div>

                <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200">
                  {[
                    { id: 'category', label: 'تغییر دسته‌بندی' },
                    { id: 'unit', label: 'تغییر واحد شمارش' },
                    { id: 'minStock', label: 'تنظیم حد هشدار موجودی' },
                  ].map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setBatchActionMode(m.id as any)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                        batchActionMode === m.id
                          ? 'bg-indigo-600 text-white shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1 border-t border-slate-200/80">
                <div className="flex items-center gap-2 flex-1">
                  {batchActionMode === 'category' && (
                    <>
                      <span className="text-xs font-bold text-slate-700 whitespace-nowrap">انتقال به دسته:</span>
                      <select
                        value={batchTargetCategory}
                        onChange={(e) => setBatchTargetCategory(e.target.value)}
                        className="flex-1 sm:max-w-xs bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none cursor-pointer"
                      >
                        {categories.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </>
                  )}

                  {batchActionMode === 'unit' && (
                    <>
                      <span className="text-xs font-bold text-slate-700 whitespace-nowrap">واحد شمارش جدید:</span>
                      <select
                        value={batchTargetUnit}
                        onChange={(e) => setBatchTargetUnit(e.target.value)}
                        className="flex-1 sm:max-w-xs bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none cursor-pointer"
                      >
                        {commonUnits.map((u) => (
                          <option key={u} value={u}>
                            {u}
                          </option>
                        ))}
                      </select>
                    </>
                  )}

                  {batchActionMode === 'minStock' && (
                    <>
                      <span className="text-xs font-bold text-slate-700 whitespace-nowrap">حداقل موجودی هشدار:</span>
                      <input
                        type="number"
                        min={0}
                        value={batchTargetMinStock}
                        onChange={(e) => setBatchTargetMinStock(Math.max(0, Number(e.target.value)))}
                        className="w-28 bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-800 outline-none"
                      />
                    </>
                  )}
                </div>

                <div className="flex items-center gap-2 justify-end">
                  <button
                    type="button"
                    onClick={handleExecuteBatchAction}
                    disabled={selectedProductIds.length === 0}
                    className="flex items-center justify-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
                  >
                    <MoveRight className="w-3.5 h-3.5" />
                    <span>اعمال روی {toPersianDigits(selectedProductIds.length)} کالا</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Search, Category Filter & Health Filter Pills */}
            <div className="space-y-2.5">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={batchSearchProduct}
                    onChange={(e) => setBatchSearchProduct(e.target.value)}
                    placeholder="جستجوی نام، کد یا دسته‌بندی کالا..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-9 pl-3 py-2 text-xs outline-none focus:bg-white focus:border-indigo-500"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <select
                    value={batchFilterCurrentCat}
                    onChange={(e) => setBatchFilterCurrentCat(e.target.value)}
                    className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 outline-none cursor-pointer"
                  >
                    <option value="all">همه دسته‌بندی‌ها ({toPersianDigits(products.length)})</option>
                    {categories.map((c) => (
                      <option key={c} value={c}>
                        {c} ({toPersianDigits(categoryStats[c]?.count || 0)})
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    onClick={() => {
                      if (selectedProductIds.length === batchFilteredProducts.length && batchFilteredProducts.length > 0) {
                        setSelectedProductIds([]);
                      } else {
                        setSelectedProductIds(batchFilteredProducts.map((p) => p.id));
                      }
                    }}
                    className="px-3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer whitespace-nowrap"
                  >
                    {selectedProductIds.length === batchFilteredProducts.length && batchFilteredProducts.length > 0
                      ? 'لغو انتخاب همه'
                      : 'انتخاب همه نتایج'}
                  </button>
                </div>
              </div>

              {/* Health Filter Pills */}
              <div className="flex flex-wrap items-center gap-1.5">
                {[
                  { id: 'all', label: 'همه کالاها' },
                  { id: 'out_of_stock', label: `ناموجود (${toPersianDigits(healthMetrics.outOfStockProductsCount)})` },
                  { id: 'low_stock', label: `کمبود موجودی (${toPersianDigits(healthMetrics.lowStockProductsCount)})` },
                  { id: 'zero_price', label: `بدون قیمت فروش (${toPersianDigits(healthMetrics.zeroSellPriceCount)})` },
                  ...(canViewBuyPrices
                    ? [
                        {
                          id: 'under_cost',
                          label: `فروش زیر قیمت خرید (${toPersianDigits(healthMetrics.underCostCount)})`,
                        },
                      ]
                    : []),
                ].map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setBatchHealthFilter(f.id as any)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer border ${
                      batchHealthFilter === f.id
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Products Table with Quick Actions */}
            <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white">
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs border-collapse">
                  <thead className="bg-slate-100 text-slate-700 border-b border-slate-200">
                    <tr>
                      <th className="p-3 w-10 text-center">
                        <input
                          type="checkbox"
                          checked={
                            batchFilteredProducts.length > 0 &&
                            selectedProductIds.length === batchFilteredProducts.length
                          }
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
                      <th className="p-3 font-bold">دسته‌بندی</th>
                      {canViewBuyPrices && <th className="p-3 font-bold text-center">قیمت خرید</th>}
                      <th className="p-3 font-bold text-center">قیمت فروش ({currency})</th>
                      <th className="p-3 font-bold text-center">موجودی</th>
                      <th className="p-3 font-bold text-center w-24">عملیات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {paginatedBatchProducts.length === 0 ? (
                      <tr>
                        <td colSpan={canViewBuyPrices ? 8 : 7} className="text-center py-8 text-slate-400">
                          هیچ کالایی مطابق با فیلترهای انتخابی یافت نشد.
                        </td>
                      </tr>
                    ) : (
                      paginatedBatchProducts.map((p) => {
                        const isChecked = selectedProductIds.includes(p.id);
                        const buy = Number(p.buyPrice ?? p.purchasePrice) || 0;
                        const sell = Number(p.sellPrice) || 0;
                        const isUnderCost = canViewBuyPrices && sell > 0 && buy > 0 && sell < buy;

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
                            <td className="p-3">
                              <div className="font-bold text-slate-900">{p.name}</div>
                              {isUnderCost && (
                                <span className="text-[10px] text-rose-600 font-bold">
                                  هشدار: قیمت فروش کمتر از خرید!
                                </span>
                              )}
                            </td>
                            <td className="p-3" onClick={(e) => e.stopPropagation()}>
                              <select
                                value={p.category || 'عمومی'}
                                onChange={(e) => {
                                  StorageService.batchAssignCategory([p.id], e.target.value);
                                  triggerReload();
                                }}
                                className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-1 rounded-lg font-bold text-[11px] outline-none cursor-pointer"
                              >
                                {categories.map((c) => (
                                  <option key={c} value={c}>
                                    {c}
                                  </option>
                                ))}
                              </select>
                            </td>
                            {canViewBuyPrices && (
                              <td className="p-3 text-center font-mono text-slate-600">
                                {formatPrice(buy)}
                              </td>
                            )}
                            <td className="p-3 text-center font-mono font-bold text-emerald-700">
                              {sell > 0 ? formatPrice(sell) : <span className="text-rose-500 text-[10px]">تعیین نشده</span>}
                            </td>
                            <td className="p-3 text-center font-mono font-bold">
                              <span
                                className={`px-2 py-0.5 rounded-md text-[11px] ${
                                  (p.stock || 0) <= 0
                                    ? 'bg-rose-50 text-rose-700'
                                    : (p.stock || 0) <= (p.minStockAlert || 0)
                                    ? 'bg-amber-50 text-amber-700'
                                    : 'text-slate-700'
                                }`}
                              >
                                {toPersianDigits(p.stock)} {p.unit || 'عدد'}
                              </span>
                            </td>
                            <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleOpenQuickProductModal(p)}
                                  className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                                  title="ویرایش سریع مشخصات و قیمت"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setDeletingProductTarget(p)}
                                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                  title="حذف کالا"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              <div className="p-3 border-t border-slate-100 bg-slate-50/50">
                <SmartPagination
                  currentPage={batchPage}
                  totalItems={batchFilteredProducts.length}
                  pageSize={batchPageSize}
                  onPageChange={setBatchPage}
                  onPageSizeChange={setBatchPageSize}
                  itemLabel="کالا"
                />
              </div>
            </div>
          </div>
        )}

        {/* ===================== TAB 3: SMART BATCH REPRICING ===================== */}
        {activeTab === 'batch_reprice' && (
          <div className="space-y-5">
            {/* Reprice Mode Switcher & Configuration */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-200">
                <div className="flex items-center gap-2">
                  <Percent className="w-4 h-4 text-emerald-600" />
                  <span className="text-xs font-black text-slate-800">فرمول و روش تعدیل گروهی قیمت‌ها</span>
                </div>

                <div className="flex flex-wrap items-center gap-1 bg-white p-1 rounded-xl border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setRepriceMode('percent')}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                      repriceMode === 'percent' ? 'bg-emerald-600 text-white' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    تغییر درصدی (٪)
                  </button>
                  <button
                    type="button"
                    onClick={() => setRepriceMode('fixed_amount')}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                      repriceMode === 'fixed_amount' ? 'bg-emerald-600 text-white' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    مبلغ ثابت ({currency})
                  </button>
                  {canViewBuyPrices && (
                    <button
                      type="button"
                      onClick={() => setRepriceMode('margin_from_buy')}
                      className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                        repriceMode === 'margin_from_buy'
                          ? 'bg-emerald-600 text-white'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      قیمت فروش بر اساس ٪ سود روی خرید
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {/* 1. Target Category */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">دسته‌بندی هدف:</label>
                  <select
                    value={repriceCategory}
                    onChange={(e) => {
                      setRepriceCategory(e.target.value);
                      setRepricePage(1);
                    }}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none cursor-pointer"
                  >
                    <option value="__ALL__">همه دسته‌بندی‌ها ({toPersianDigits(products.length)} کالا)</option>
                    {categories.map((c) => (
                      <option key={c} value={c}>
                        {c} ({toPersianDigits(categoryStats[c]?.count || 0)} کالا)
                      </option>
                    ))}
                  </select>
                </div>

                {/* 2. Target Price Field */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">نوع قیمت مورد تغییر:</label>
                  {repriceMode === 'margin_from_buy' ? (
                    <div className="w-full bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2 text-xs font-bold text-emerald-800">
                      محاسبه قیمت فروش از روی قیمت خرید
                    </div>
                  ) : (
                    <select
                      value={repriceTarget}
                      onChange={(e) => setRepriceTarget(e.target.value as any)}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none cursor-pointer"
                    >
                      <option value="sellPrice">فقط قیمت فروش (مصرف‌کننده)</option>
                      {canViewBuyPrices && <option value="buyPrice">فقط قیمت خرید (تأمین‌کننده)</option>}
                      {canViewBuyPrices && <option value="both">هر دو قیمت (خرید و فروش)</option>}
                      <option value="wholesalePrice">فقط قیمت فروش همکار / عمده</option>
                    </select>
                  )}
                </div>

                {/* 3. Direction & Value */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    {repriceMode === 'margin_from_buy'
                      ? 'درصد سود هدف روی خرید:'
                      : repriceMode === 'fixed_amount'
                      ? `مبلغ تغییر (${currency}):`
                      : 'درصد تغییر:'}
                  </label>
                  <div className="flex items-center gap-1.5">
                    {repriceMode !== 'margin_from_buy' && (
                      <button
                        type="button"
                        onClick={() => setRepriceDirection(repriceDirection === 'increase' ? 'decrease' : 'increase')}
                        className={`px-2.5 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1 shrink-0 ${
                          repriceDirection === 'increase' ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'
                        }`}
                      >
                        {repriceDirection === 'increase' ? (
                          <>
                            <TrendingUp className="w-3.5 h-3.5" />
                            <span>افزایش</span>
                          </>
                        ) : (
                          <>
                            <TrendingDown className="w-3.5 h-3.5" />
                            <span>کاهش</span>
                          </>
                        )}
                      </button>
                    )}
                    <input
                      type="number"
                      min={0.1}
                      step={repriceMode === 'fixed_amount' ? 1000 : 0.5}
                      value={repriceValue}
                      onChange={(e) => setRepriceValue(Math.max(0, Number(e.target.value)))}
                      className="flex-1 bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-800 outline-none"
                    />
                    <span className="text-xs font-bold text-slate-500">
                      {repriceMode === 'fixed_amount' ? currency : '٪'}
                    </span>
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

              {/* Action Bar */}
              <div className="pt-3 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-200">
                <div className="text-xs text-slate-600">
                  کالاهای مشمول:{' '}
                  <strong className="text-slate-900 font-bold">
                    {toPersianDigits(repricePreviewAllProducts.length)} قلم کالا
                  </strong>
                </div>
                <button
                  type="button"
                  disabled={isApplyingReprice || repricePreviewAllProducts.length === 0 || repriceValue <= 0}
                  onClick={() => setShowRepriceConfirmModal(true)}
                  className="w-full sm:w-auto px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 disabled:opacity-40 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <RefreshCw className={`w-4 h-4 ${isApplyingReprice ? 'animate-spin' : ''}`} />
                  <span>بررسی و اعمال نهایی تغییرات قیمت</span>
                </button>
              </div>
            </div>

            {/* Live Paginated Preview Table */}
            <div className="space-y-2.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-indigo-600" />
                  <span>پیش‌نمایش زنده مبالغ قبل و بعد از اعمال تغییرات:</span>
                </span>
                <div className="relative sm:w-64">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={repriceSearch}
                    onChange={(e) => {
                      setRepriceSearch(e.target.value);
                      setRepricePage(1);
                    }}
                    placeholder="جستجو در پیش‌نمایش..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-8 pl-3 py-1.5 text-xs outline-none focus:bg-white focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white">
                <div className="overflow-x-auto">
                  <table className="w-full text-right text-xs border-collapse">
                    <thead className="bg-slate-100 text-slate-700 border-b border-slate-200">
                      <tr>
                        <th className="p-3 font-bold">کد</th>
                        <th className="p-3 font-bold">نام کالا</th>
                        <th className="p-3 font-bold">دسته</th>
                        {canViewBuyPrices && (repriceTarget === 'buyPrice' || repriceTarget === 'both' || repriceMode === 'margin_from_buy') && (
                          <th className="p-3 font-bold text-center">خرید (فعلی ← جدید)</th>
                        )}
                        <th className="p-3 font-bold text-center">قیمت فروش قبلی</th>
                        <th className="p-3 font-bold text-center">قیمت فروش جدید</th>
                        <th className="p-3 font-bold text-center">اختلاف فروش</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {paginatedRepricePreview.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="text-center py-6 text-slate-400">
                            هیچ کالایی در این دسته‌بندی یافت نشد.
                          </td>
                        </tr>
                      ) : (
                        paginatedRepricePreview.map((p) => {
                          const diff = p.newSell - p.oldSell;
                          return (
                            <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                              <td className="p-3 font-mono text-slate-500 font-bold">{toPersianDigits(p.code)}</td>
                              <td className="p-3 font-bold text-slate-900">{p.name}</td>
                              <td className="p-3">
                                <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-[10px] font-bold">
                                  {p.category}
                                </span>
                              </td>
                              {canViewBuyPrices &&
                                (repriceTarget === 'buyPrice' ||
                                  repriceTarget === 'both' ||
                                  repriceMode === 'margin_from_buy') && (
                                  <td className="p-3 text-center font-mono text-slate-600">
                                    {formatPrice(p.oldBuy)}
                                    {p.newBuy !== p.oldBuy && (
                                      <span className="text-indigo-600 font-bold"> ← {formatPrice(p.newBuy)}</span>
                                    )}
                                  </td>
                                )}
                              <td className="p-3 text-center font-mono text-slate-600">
                                {formatPrice(p.oldSell)}
                              </td>
                              <td className="p-3 text-center font-mono font-bold text-emerald-700">
                                {formatPrice(p.newSell)}
                              </td>
                              <td className="p-3 text-center font-mono font-bold">
                                <span className={diff > 0 ? 'text-emerald-600' : diff < 0 ? 'text-rose-600' : 'text-slate-400'}>
                                  {diff > 0 ? '+' : ''}
                                  {formatPrice(diff)}
                                </span>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
                <div className="p-3 border-t border-slate-100 bg-slate-50/50">
                  <SmartPagination
                    currentPage={repricePage}
                    totalItems={repricePreviewAllProducts.length}
                    pageSize={repricePageSize}
                    onPageChange={setRepricePage}
                    onPageSizeChange={setRepricePageSize}
                    itemLabel="کالا"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ===================== TAB 4: ANALYTICS, CAPITAL & DATA HEALTH ===================== */}
        {activeTab === 'analytics' && (
          <div className="space-y-5">
            {/* Capital & Margin Cards */}
            <div className={`grid grid-cols-1 ${canViewBuyPrices ? 'sm:grid-cols-4' : 'sm:grid-cols-2'} gap-3`}>
              <div className="bg-gradient-to-br from-emerald-50 to-white p-4 rounded-2xl border border-emerald-200">
                <span className="text-xs text-emerald-900 font-bold">ارزش کل موجودی (فروش)</span>
                <div className="text-base sm:text-lg font-black text-emerald-950 mt-1 font-mono">
                  {formatPrice(totalAllValue)} <span className="text-[11px] font-normal">{currency}</span>
                </div>
              </div>

              {canViewBuyPrices && (
                <>
                  <div className="bg-gradient-to-br from-blue-50 to-white p-4 rounded-2xl border border-blue-200">
                    <span className="text-xs text-blue-900 font-bold">ارزش بهای تمام‌شده (خرید)</span>
                    <div className="text-base sm:text-lg font-black text-blue-950 mt-1 font-mono">
                      {formatPrice(totalAllPurchaseValue)} <span className="text-[11px] font-normal">{currency}</span>
                    </div>
                  </div>

                  <div className="bg-gradient-to-br from-indigo-50 to-white p-4 rounded-2xl border border-indigo-200">
                    <span className="text-xs text-indigo-900 font-bold">سود ناخالص نهفته در انبار</span>
                    <div className="text-base sm:text-lg font-black text-indigo-950 mt-1 font-mono">
                      {formatPrice(Math.max(0, totalAllValue - totalAllPurchaseValue))}{' '}
                      <span className="text-[11px] font-normal">{currency}</span>
                    </div>
                  </div>
                </>
              )}

              <div className="bg-gradient-to-br from-amber-50 to-white p-4 rounded-2xl border border-amber-200">
                <span className="text-xs text-amber-900 font-bold">اقلام نیازمند شارژ یا قیمت‌گذاری</span>
                <div className="text-base sm:text-lg font-black text-amber-950 mt-1 font-mono">
                  {toPersianDigits(
                    healthMetrics.outOfStockProductsCount +
                      healthMetrics.lowStockProductsCount +
                      healthMetrics.zeroSellPriceCount
                  )}{' '}
                  <span className="text-[11px] font-normal">مورد</span>
                </div>
              </div>
            </div>

            {/* Product Data Health Inspector */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4 text-indigo-600" />
                  <span>پایش هوشمند سلامت شناسنامه کالاها</span>
                </h4>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                <div className="bg-white p-3 rounded-xl border border-slate-200 flex items-center justify-between">
                  <div>
                    <div className="text-[11px] font-bold text-slate-700">کالاهای بدون قیمت فروش</div>
                    <div className="text-sm font-black font-mono text-slate-900 mt-0.5">
                      {toPersianDigits(healthMetrics.zeroSellPriceCount)} کالا
                    </div>
                  </div>
                  {healthMetrics.zeroSellPriceCount > 0 && (
                    <button
                      type="button"
                      onClick={() => jumpToProductsFilter('all', 'zero_price')}
                      className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-[10px] font-bold cursor-pointer"
                    >
                      اصلاح سریع
                    </button>
                  )}
                </div>

                {canViewBuyPrices && (
                  <div className="bg-white p-3 rounded-xl border border-slate-200 flex items-center justify-between">
                    <div>
                      <div className="text-[11px] font-bold text-slate-700">فروش کمتر از خرید (زیان‌ده)</div>
                      <div className="text-sm font-black font-mono text-rose-600 mt-0.5">
                        {toPersianDigits(healthMetrics.underCostCount)} کالا
                      </div>
                    </div>
                    {healthMetrics.underCostCount > 0 && (
                      <button
                        type="button"
                        onClick={() => jumpToProductsFilter('all', 'under_cost')}
                        className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-[10px] font-bold cursor-pointer"
                      >
                        بررسی و اصلاح
                      </button>
                    )}
                  </div>
                )}

                <div className="bg-white p-3 rounded-xl border border-slate-200 flex items-center justify-between">
                  <div>
                    <div className="text-[11px] font-bold text-slate-700">کالاهای ناموجود (موجودی صفر)</div>
                    <div className="text-sm font-black font-mono text-amber-600 mt-0.5">
                      {toPersianDigits(healthMetrics.outOfStockProductsCount)} کالا
                    </div>
                  </div>
                  {healthMetrics.outOfStockProductsCount > 0 && (
                    <button
                      type="button"
                      onClick={() => jumpToProductsFilter('all', 'out_of_stock')}
                      className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-lg text-[10px] font-bold cursor-pointer"
                    >
                      مشاهده لیست
                    </button>
                  )}
                </div>

                <div className="bg-white p-3 rounded-xl border border-slate-200 flex items-center justify-between">
                  <div>
                    <div className="text-[11px] font-bold text-slate-700">دسته‌بندی‌های بدون کالا</div>
                    <div className="text-sm font-black font-mono text-slate-900 mt-0.5">
                      {toPersianDigits(healthMetrics.emptyCategoriesCount)} دسته
                    </div>
                  </div>
                  {healthMetrics.emptyCategoriesCount > 0 && (
                    <button
                      type="button"
                      onClick={handleCleanupEmptyCategories}
                      className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-[10px] font-bold cursor-pointer"
                    >
                      حذف خودکار
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Breakdown Table */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700">
                  جدول تحلیل سهم، ارزش موجودی و سود به تفکیک دسته‌بندی:
                </span>
                <button
                  type="button"
                  onClick={handleExportAnalyticsToCsv}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>دریافت خروجی اکسل کامل</span>
                </button>
              </div>

              <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white">
                <div className="overflow-x-auto">
                  <table className="w-full text-right text-xs border-collapse">
                    <thead className="bg-slate-100 text-slate-700 border-b border-slate-200">
                      <tr>
                        <th className="p-3 font-bold">نام دسته‌بندی</th>
                        <th className="p-3 font-bold text-center">تعداد کالا</th>
                        <th className="p-3 font-bold text-center">موجودی فیزیکی</th>
                        <th className="p-3 font-bold text-center">سهم از انبار</th>
                        <th className="p-3 font-bold text-center">ارزش فروش ({currency})</th>
                        {canViewBuyPrices && <th className="p-3 font-bold text-center">ارزش خرید ({currency})</th>}
                        {canViewBuyPrices && <th className="p-3 font-bold text-center">سود ناخالص</th>}
                        <th className="p-3 font-bold text-center">وضعیت</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {categories.map((cat) => {
                        const stat = categoryStats[cat] || {
                          count: 0,
                          totalStock: 0,
                          totalInventoryValue: 0,
                          totalPurchaseValue: 0,
                          lowStockCount: 0,
                          outOfStockCount: 0,
                        };
                        const percentage = totalAllStock > 0 ? Math.round((stat.totalStock / totalAllStock) * 100) : 0;
                        const profit = stat.totalInventoryValue - stat.totalPurchaseValue;

                        return (
                          <tr key={cat} className="hover:bg-slate-50/70 transition-colors">
                            <td className="p-3 font-bold text-slate-900 flex items-center gap-2">
                              <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 shrink-0"></span>
                              <button
                                type="button"
                                onClick={() => jumpToProductsFilter(cat, 'all')}
                                className="hover:text-indigo-600 hover:underline cursor-pointer text-right"
                              >
                                {cat}
                              </button>
                            </td>
                            <td className="p-3 text-center font-mono font-bold text-slate-700">
                              {toPersianDigits(stat.count)}
                            </td>
                            <td className="p-3 text-center font-mono font-bold text-slate-800">
                              {toPersianDigits(stat.totalStock)}
                            </td>
                            <td className="p-3 text-center">
                              <div className="flex items-center justify-center gap-2">
                                <div className="w-16 bg-slate-200 rounded-full h-1.5 overflow-hidden hidden sm:block">
                                  <div
                                    className="bg-indigo-600 h-1.5 rounded-full"
                                    style={{ width: `${Math.min(100, percentage)}%` }}
                                  ></div>
                                </div>
                                <span className="font-mono text-slate-600 font-bold">{toPersianDigits(percentage)}٪</span>
                              </div>
                            </td>
                            <td className="p-3 text-center font-mono font-black text-emerald-700">
                              {formatPrice(stat.totalInventoryValue)}
                            </td>
                            {canViewBuyPrices && (
                              <td className="p-3 text-center font-mono text-slate-600">
                                {formatPrice(stat.totalPurchaseValue)}
                              </td>
                            )}
                            {canViewBuyPrices && (
                              <td className="p-3 text-center font-mono font-bold text-indigo-700">
                                {formatPrice(profit)}
                              </td>
                            )}
                            <td className="p-3 text-center">
                              {stat.outOfStockCount > 0 ? (
                                <span className="text-rose-600 font-bold text-[11px]">
                                  {toPersianDigits(stat.outOfStockCount)} ناموجود
                                </span>
                              ) : stat.lowStockCount > 0 ? (
                                <span className="text-amber-600 font-bold text-[11px]">
                                  {toPersianDigits(stat.lowStockCount)} کمبود
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
            </div>
          </div>
        )}
      </div>

      {/* Footer for Modal mode */}
      {!embedded && (
        <div className="shrink-0 bg-slate-50 border-t border-slate-200 px-5 py-3 flex items-center justify-between">
          <span className="text-xs text-slate-500">
            تغییرات کالاها و دسته‌بندی‌ها به‌صورت آنی در انبار، فاکتورها و گزارشات اعمال می‌شوند.
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

      {/* ===================== MODAL 1: QUICK ADD / EDIT PRODUCT ===================== */}
      {quickProductModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden">
            <div className="bg-slate-900 text-white px-5 py-3.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-emerald-400" />
                <h4 className="font-bold text-sm">
                  {quickProductModal.id ? 'ویرایش سریع مشخصات و قیمت کالا' : 'تعریف سریع کالای جدید'}
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setQuickProductModal(null)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveQuickProduct} className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block font-bold text-slate-700 mb-1">نام کالا *</label>
                  <input
                    type="text"
                    required
                    value={quickProductModal.name}
                    onChange={(e) => setQuickProductModal({ ...quickProductModal, name: e.target.value })}
                    placeholder="مثلاً: پمپ آب صنعتی ۲ اسب"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-bold text-slate-900 outline-none focus:bg-white focus:border-indigo-500"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">کد کالا (اختیاری)</label>
                  <input
                    type="text"
                    value={quickProductModal.code}
                    onChange={(e) => setQuickProductModal({ ...quickProductModal, code: e.target.value })}
                    placeholder="تولید خودکار"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-mono text-slate-800 outline-none focus:bg-white focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">دسته‌بندی</label>
                  <select
                    value={quickProductModal.category}
                    onChange={(e) => setQuickProductModal({ ...quickProductModal, category: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-bold text-slate-800 outline-none cursor-pointer"
                  >
                    {categories.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">واحد شمارش</label>
                  <select
                    value={quickProductModal.unit}
                    onChange={(e) => setQuickProductModal({ ...quickProductModal, unit: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-bold text-slate-800 outline-none cursor-pointer"
                  >
                    {commonUnits.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className={`grid grid-cols-1 ${canViewBuyPrices ? 'sm:grid-cols-3' : 'sm:grid-cols-2'} gap-3`}>
                {canViewBuyPrices && (
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">قیمت خرید ({currency})</label>
                    <input
                      type="number"
                      min={0}
                      value={quickProductModal.buyPrice}
                      onChange={(e) =>
                        setQuickProductModal({ ...quickProductModal, buyPrice: Math.max(0, Number(e.target.value)) })
                      }
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-mono font-bold text-slate-800 outline-none focus:bg-white focus:border-indigo-500"
                    />
                  </div>
                )}
                <div>
                  <label className="block font-bold text-emerald-700 mb-1">قیمت فروش عادی ({currency})</label>
                  <input
                    type="number"
                    min={0}
                    value={quickProductModal.sellPrice}
                    onChange={(e) =>
                      setQuickProductModal({ ...quickProductModal, sellPrice: Math.max(0, Number(e.target.value)) })
                    }
                    className="w-full bg-emerald-50/50 border border-emerald-300 rounded-xl px-3 py-2 font-mono font-bold text-emerald-900 outline-none focus:bg-white focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">قیمت همکار ({currency})</label>
                  <input
                    type="number"
                    min={0}
                    value={quickProductModal.wholesalePrice}
                    onChange={(e) =>
                      setQuickProductModal({
                        ...quickProductModal,
                        wholesalePrice: Math.max(0, Number(e.target.value)),
                      })
                    }
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-mono font-bold text-slate-800 outline-none focus:bg-white focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">موجودی فعلی انبار</label>
                  <input
                    type="number"
                    min={0}
                    value={quickProductModal.stock}
                    onChange={(e) =>
                      setQuickProductModal({ ...quickProductModal, stock: Math.max(0, Number(e.target.value)) })
                    }
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-mono font-bold text-slate-800 outline-none focus:bg-white focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">حداقل موجودی هشدار</label>
                  <input
                    type="number"
                    min={0}
                    value={quickProductModal.minStockAlert}
                    onChange={(e) =>
                      setQuickProductModal({
                        ...quickProductModal,
                        minStockAlert: Math.max(0, Number(e.target.value)),
                      })
                    }
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-mono font-bold text-slate-800 outline-none focus:bg-white focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setQuickProductModal(null)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-slate-600 font-bold hover:bg-slate-100 cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>ذخیره اطلاعات کالا</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================== MODAL 2: CONFIRM DELETE PRODUCT ===================== */}
      {deletingProductTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl border border-rose-200 w-full max-w-md p-5 space-y-4">
            <div className="flex items-center gap-2.5 text-rose-700 font-black text-sm">
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
              <span>تایید حذف کالا از انبار</span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              آیا از حذف کالای <strong>«{deletingProductTarget.name}»</strong> (کد: {toPersianDigits(deletingProductTarget.code)}) اطمینان دارید؟
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingProductTarget(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl cursor-pointer"
              >
                انصراف
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteProduct}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-xs cursor-pointer"
              >
                حذف قطعی کالا
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================== MODAL 3: CONFIRM BATCH REPRICE ===================== */}
      {showRepriceConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl border border-emerald-200 w-full max-w-md p-5 space-y-4">
            <div className="flex items-center gap-2.5 text-emerald-800 font-black text-sm">
              <Percent className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>تایید نهایی تعدیل گروهی قیمت‌ها</span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              آیا از اعمال تغییرات قیمت روی{' '}
              <strong className="text-slate-900">{toPersianDigits(repricePreviewAllProducts.length)} قلم کالا</strong> در{' '}
              <strong>{repriceCategory === '__ALL__' ? 'همه دسته‌بندی‌ها' : `دسته «${repriceCategory}»`}</strong> اطمینان دارید؟
              سوابق قیمت قبلی در تاریخچه هر کالا ذخیره خواهد شد.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowRepriceConfirmModal(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl cursor-pointer"
              >
                انصراف
              </button>
              <button
                type="button"
                onClick={handleExecuteBatchReprice}
                disabled={isApplyingReprice}
                className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs cursor-pointer"
              >
                تایید و اعمال قیمت‌های جدید
              </button>
            </div>
          </div>
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
      <div className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {contentBody}
      </div>
    </div>
  );
};
