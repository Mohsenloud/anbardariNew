import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Product, AppUser } from '../types';
import { toPersianDigits, formatPrice } from '../utils/jalali';
import {
  StorageService,
  canUserViewBuyPrices,
  normalizeCategoryName,
  categoryKey,
  COMMON_PRODUCT_UNITS,
} from '../utils/storage';
import { isReadOnlyUser } from '../utils/permissions';
import { SmartPagination } from './SmartPagination';
import { NumericInput } from './NumericInput';
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
  Tag,
  AlertTriangle,
  Wand2,
  ShieldAlert,
  CheckCircle2,
  Lock,
} from 'lucide-react';

export interface CategoryManagerProps {
  categories: string[];
  products: Product[];
  currency?: string;
  currentUser?: AppUser | null;
  embedded?: boolean;
  onAddCategory?: (categoryName: string) => boolean;
  onRenameCategory?: (oldName: string, newName: string) => boolean;
  onDeleteCategory?: (categoryName: string, reassignTo?: string) => boolean;
  onReorderCategories?: (newOrderedCategories: string[]) => void;
  onSelectCategory?: (categoryName: string) => void;
  onNavigateToInventory?: () => void;
  onClose?: () => void;
  onReloadProducts?: () => void;
}

const SUGGESTED_CATEGORIES = [
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

const DEFAULT_CAT = 'عمومی';
const DEFAULT_CAT_KEY = categoryKey(DEFAULT_CAT);

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
  const canManage = useMemo(() => {
    if (isReadOnlyUser(currentUser)) return false;
    if (!currentUser) return true;
    return (
      currentUser.role === 'admin' ||
      Boolean(currentUser.permissions?.canAccessAdmin || currentUser.permissions?.canManageInventory)
    );
  }, [currentUser]);

  // Reactive local state synced with StorageService
  const [localCategories, setLocalCategories] = useState<string[]>(() =>
    propCategories && propCategories.length > 0 ? propCategories : StorageService.getCategories()
  );
  const [localProducts, setLocalProducts] = useState<Product[]>(() =>
    propProducts && propProducts.length > 0 ? propProducts : StorageService.getProducts()
  );

  useEffect(() => {
    if (propCategories && propCategories.length > 0) {
      setLocalCategories(propCategories);
    }
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

  // Preserve user-defined category order without forcing 'عمومی' to index 0
  const categories = useMemo(() => {
    const seen = new Set<string>();
    const ordered: string[] = [];
    const pushIfNew = (raw?: string) => {
      const clean = normalizeCategoryName(raw);
      if (!clean) return;
      const key = clean.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      ordered.push(key === DEFAULT_CAT_KEY ? DEFAULT_CAT : clean);
    };
    localCategories.forEach(pushIfNew);
    localProducts.forEach((p) => pushIfNew(p.category));
    if (!seen.has(DEFAULT_CAT_KEY)) {
      ordered.unshift(DEFAULT_CAT);
    }
    return ordered;
  }, [localCategories, localProducts]);

  const products = localProducts;

  // UI & feedback state
  const [activeTab, setActiveTab] = useState<'list' | 'batch_assign' | 'batch_reprice' | 'analytics'>('list');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Tab 1: Categories state
  const [newCatName, setNewCatName] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [editingCatName, setEditingCatName] = useState<string | null>(null);
  const [renamedValue, setRenamedValue] = useState('');
  const [searchFilter, setSearchFilter] = useState('');
  const [categoryStatusFilter, setCategoryStatusFilter] = useState<'all' | 'with_items' | 'empty' | 'low_stock'>('all');
  const [sortBy, setSortBy] = useState<'default' | 'name' | 'products_count' | 'stock' | 'value'>('default');
  const [deletingCat, setDeletingCat] = useState<string | null>(null);
  const [reassignTarget, setReassignTarget] = useState<string>(DEFAULT_CAT);
  const [mergingSourceCat, setMergingSourceCat] = useState<string | null>(null);
  const [mergingTargetCat, setMergingTargetCat] = useState<string>('');
  const [viewingCategoryProducts, setViewingCategoryProducts] = useState<string | null>(null);
  const [accordionSearch, setAccordionSearch] = useState<string>('');

  // Tab 2: Quick Product Management & Batch Assignment state
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [batchActionMode, setBatchActionMode] = useState<'category' | 'unit' | 'minStock'>('category');
  const [batchTargetCategory, setBatchTargetCategory] = useState<string>(categories[0] || DEFAULT_CAT);
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
    hasVariants: boolean;
    variantCount: number;
  } | null>(null);

  const [deletingProductTarget, setDeletingProductTarget] = useState<Product | null>(null);

  // Tab 3: Batch Repricing State
  const [repriceCategory, setRepriceCategory] = useState<string>('__ALL__');
  const [repriceMode, setRepriceMode] = useState<'percent' | 'fixed_amount' | 'margin_from_buy'>('percent');
  const [repriceTarget, setRepriceTarget] = useState<'sellPrice' | 'buyPrice' | 'wholesalePrice' | 'both'>('sellPrice');
  const [repriceValue, setRepriceValue] = useState<number>(10);
  const [repriceDirection, setRepriceDirection] = useState<'increase' | 'decrease'>('increase');
  const [repriceRounding, setRepriceRounding] = useState<number>(1000);
  const [includeVariantPrices, setIncludeVariantPrices] = useState<boolean>(true);
  const [isApplyingReprice, setIsApplyingReprice] = useState(false);
  const [showRepriceConfirmModal, setShowRepriceConfirmModal] = useState(false);
  const [repriceSearch, setRepriceSearch] = useState('');
  const [repricePage, setRepricePage] = useState<number>(1);
  const [repricePageSize, setRepricePageSize] = useState<number>(15);

  // Guard buy-price reprice modes for users without buy-price visibility
  useEffect(() => {
    if (!canViewBuyPrices) {
      if (repriceMode === 'margin_from_buy') setRepriceMode('percent');
      if (repriceTarget === 'buyPrice' || repriceTarget === 'both') setRepriceTarget('sellPrice');
      if (batchHealthFilter === 'under_cost') setBatchHealthFilter('all');
    }
  }, [canViewBuyPrices, repriceMode, repriceTarget, batchHealthFilter]);

  // Keep category selections valid whenever categories list changes (after rename/delete/cleanup)
  useEffect(() => {
    const validKeys = new Set(categories.map((c) => categoryKey(c)));
    if (!validKeys.has(categoryKey(batchTargetCategory))) {
      setBatchTargetCategory(categories[0] || DEFAULT_CAT);
    }
    if (batchFilterCurrentCat !== 'all' && !validKeys.has(categoryKey(batchFilterCurrentCat))) {
      setBatchFilterCurrentCat('all');
    }
    if (repriceCategory !== '__ALL__' && !validKeys.has(categoryKey(repriceCategory))) {
      setRepriceCategory('__ALL__');
    }
    if (viewingCategoryProducts && !validKeys.has(categoryKey(viewingCategoryProducts))) {
      setViewingCategoryProducts(null);
    }
    if (deletingCat && !validKeys.has(categoryKey(deletingCat))) {
      setDeletingCat(null);
    }
    if (mergingSourceCat && !validKeys.has(categoryKey(mergingSourceCat))) {
      setMergingSourceCat(null);
    }
  }, [
    categories,
    batchTargetCategory,
    batchFilterCurrentCat,
    repriceCategory,
    viewingCategoryProducts,
    deletingCat,
    mergingSourceCat,
  ]);

  // Prune deleted product IDs from selection
  useEffect(() => {
    if (selectedProductIds.length === 0) return;
    const existingIds = new Set(products.map((p) => p.id));
    setSelectedProductIds((prev) => {
      const next = prev.filter((id) => existingIds.has(id));
      return next.length === prev.length ? prev : next;
    });
  }, [products]);

  // Keyboard ESC handler for sub-modals and main modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (quickProductModal) {
        setQuickProductModal(null);
      } else if (deletingProductTarget) {
        setDeletingProductTarget(null);
      } else if (showRepriceConfirmModal) {
        setShowRepriceConfirmModal(false);
      } else if (editingCatName) {
        setEditingCatName(null);
      } else if (deletingCat) {
        setDeletingCat(null);
      } else if (mergingSourceCat) {
        setMergingSourceCat(null);
      } else if (!embedded && onClose) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    quickProductModal,
    deletingProductTarget,
    showRepriceConfirmModal,
    editingCatName,
    deletingCat,
    mergingSourceCat,
    embedded,
    onClose,
  ]);

  const showToastSuccess = useCallback((msg: string) => {
    setErrorMessage(null);
    setSuccessMessage(msg);
    setTimeout(() => {
      setSuccessMessage((curr) => (curr === msg ? null : curr));
    }, 4000);
  }, []);

  const triggerReload = useCallback(() => {
    setLocalCategories(StorageService.getCategories());
    setLocalProducts(StorageService.getProducts());
    if (onReloadProducts) onReloadProducts();
  }, [onReloadProducts]);

  // CSV export helper with proper Blob URL revocation
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
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  // Category CRUD Handlers
  const handleAddCategorySubmit = (nameToAdd?: string) => {
    if (!canManage) return;
    const target = normalizeCategoryName(nameToAdd ?? newCatName);
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
      showToastSuccess(`دسته‌بندی «${target}» افزوده شد.`);
    }
  };

  const handleStartRename = (cat: string) => {
    if (!canManage || categoryKey(cat) === DEFAULT_CAT_KEY) return;
    setDeletingCat(null);
    setMergingSourceCat(null);
    setEditingCatName(cat);
    setRenamedValue(cat);
    setErrorMessage(null);
  };

  const handleSaveRename = (oldName: string) => {
    if (!canManage || categoryKey(oldName) === DEFAULT_CAT_KEY) return;
    const cleanNew = normalizeCategoryName(renamedValue);
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
      setErrorMessage('تغییر نام دسته‌بندی انجام نشد.');
    } else {
      setEditingCatName(null);
      if (viewingCategoryProducts === oldName) setViewingCategoryProducts(cleanNew);
      if (batchFilterCurrentCat === oldName) setBatchFilterCurrentCat(cleanNew);
      if (repriceCategory === oldName) setRepriceCategory(cleanNew);
      triggerReload();
      showToastSuccess(`دسته‌بندی «${oldName}» به «${cleanNew}» تغییر نام یافت.`);
    }
  };

  const handleConfirmDelete = (cat: string) => {
    if (!canManage || categoryKey(cat) === DEFAULT_CAT_KEY) return;
    const target = reassignTarget && categoryKey(reassignTarget) !== categoryKey(cat) ? reassignTarget : DEFAULT_CAT;
    const success = onDeleteCategory
      ? onDeleteCategory(cat, target)
      : StorageService.deleteCategory(cat, target);
    if (success) {
      setDeletingCat(null);
      triggerReload();
      showToastSuccess(`دسته‌بندی «${cat}» حذف و کالاهای آن به «${target}» منتقل شد.`);
    }
  };

  const handleConfirmMerge = () => {
    if (!canManage || !mergingSourceCat || !mergingTargetCat) return;
    if (categoryKey(mergingSourceCat) === DEFAULT_CAT_KEY) {
      setErrorMessage('دسته پیش‌فرض «عمومی» قابل ادغام به عنوان مبدا نیست.');
      return;
    }
    if (categoryKey(mergingSourceCat) === categoryKey(mergingTargetCat)) {
      setErrorMessage('دسته‌بندی مبدا و مقصد نمی‌توانند یکسان باشند.');
      return;
    }
    const src = mergingSourceCat;
    const dst = mergingTargetCat;
    const success = onDeleteCategory
      ? onDeleteCategory(src, dst)
      : StorageService.deleteCategory(src, dst);
    if (success) {
      setMergingSourceCat(null);
      setMergingTargetCat('');
      triggerReload();
      showToastSuccess(`دسته‌بندی «${src}» با موفقیت در «${dst}» ادغام شد.`);
    }
  };

  // Reorder by category name (never relies on filtered index)
  const handleMoveCategory = (catName: string, direction: 'up' | 'down') => {
    if (!canManage) return;
    const currentIndex = categories.findIndex((c) => categoryKey(c) === categoryKey(catName));
    if (currentIndex === -1) return;
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= categories.length) return;

    const copy = [...categories];
    const [moved] = copy.splice(currentIndex, 1);
    copy.splice(targetIndex, 0, moved);

    if (onReorderCategories) {
      onReorderCategories(copy);
    } else {
      StorageService.reorderCategories(copy);
    }
    setLocalCategories(copy);
    if (onReloadProducts) onReloadProducts();
  };

  const handleCleanupEmptyCategories = () => {
    if (!canManage) return;
    const res = StorageService.cleanupEmptyCategories();
    if (res.removedCount === 0) {
      showToastSuccess('هیچ دسته‌بندی خالی قابل حذفی یافت نشد.');
    } else {
      triggerReload();
      showToastSuccess(`${toPersianDigits(res.removedCount)} دسته‌بندی خالی پاکسازی شد.`);
    }
  };

  const handleNormalizeCategories = () => {
    if (!canManage) return;
    const res = StorageService.normalizeAndDeduplicateCategories();
    triggerReload();
    if (res.fixedProductsCount === 0 && res.mergedCategoriesCount === 0) {
      showToastSuccess('تمامی نام‌های دسته‌بندی و کالاها استاندارد و یکپارچه هستند.');
    } else {
      showToastSuccess(
        `یکپارچه‌سازی انجام شد: ${toPersianDigits(res.fixedProductsCount)} کالا استانداردسازی و ${toPersianDigits(
          res.mergedCategoriesCount
        )} عنوان تکراری ادغام شد.`
      );
    }
  };

  // Tab 2: Batch Actions
  const handleExecuteBatchAction = () => {
    if (!canManage) return;
    if (selectedProductIds.length === 0) {
      setErrorMessage('هیچ کالایی برای اعمال تغییرات انتخاب نشده است.');
      return;
    }
    if (batchActionMode === 'category') {
      const count = StorageService.batchAssignCategory(selectedProductIds, batchTargetCategory);
      setSelectedProductIds([]);
      triggerReload();
      showToastSuccess(
        count > 0
          ? `دسته‌بندی ${toPersianDigits(count)} قلم کالا به «${batchTargetCategory}» تغییر یافت.`
          : 'کالاهای انتخاب‌شده از قبل در همین دسته‌بندی بودند.'
      );
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
        `حد هشدار موجودی برای ${toPersianDigits(count)} قلم کالا روی ${toPersianDigits(batchTargetMinStock)} تنظیم شد.`
      );
    }
  };

  const handleOpenQuickProductModal = (product?: Product, defaultCategory?: string) => {
    if (!canManage) return;
    if (product) {
      const hasVars = Boolean(product.hasVariants && product.variants && product.variants.length > 0);
      setQuickProductModal({
        id: product.id,
        code: product.code || '',
        name: product.name || '',
        category: normalizeCategoryName(product.category) || DEFAULT_CAT,
        unit: normalizeCategoryName(product.unit) || 'عدد',
        buyPrice: Number(product.buyPrice ?? product.purchasePrice) || 0,
        sellPrice: Number(product.sellPrice) || 0,
        wholesalePrice: Number(product.wholesalePrice) || 0,
        stock: Number(product.stock) || 0,
        minStockAlert: Number(product.minStockAlert ?? 5) || 0,
        hasVariants: hasVars,
        variantCount: product.variants?.length || 0,
      });
    } else {
      setQuickProductModal({
        code: '',
        name: '',
        category:
          defaultCategory ||
          (batchFilterCurrentCat !== 'all' ? batchFilterCurrentCat : categories[0] || DEFAULT_CAT),
        unit: 'عدد',
        buyPrice: 0,
        sellPrice: 0,
        wholesalePrice: 0,
        stock: 0,
        minStockAlert: 5,
        hasVariants: false,
        variantCount: 0,
      });
    }
  };

  const handleSaveQuickProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManage || !quickProductModal) return;
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
      wholesalePrice: quickProductModal.wholesalePrice > 0 ? quickProductModal.wholesalePrice : 0,
      stock: quickProductModal.hasVariants ? undefined : quickProductModal.stock,
      minStockAlert: quickProductModal.minStockAlert,
    });
    setQuickProductModal(null);
    triggerReload();
    showToastSuccess(
      isEdit
        ? `مشخصات کالای «${saved.name}» بروزرسانی شد.`
        : `کالای جدید «${saved.name}» در دسته «${saved.category}» ثبت شد.`
    );
  };

  const handleConfirmDeleteProduct = () => {
    if (!canManage || !deletingProductTarget) return;
    const target = deletingProductTarget;
    StorageService.deleteProduct(target.id);
    StorageService.logActivity({
      category: 'warehouse',
      actionType: 'delete_product',
      actionTitle: 'حذف کالا از انبار',
      details: `حذف کالای «${target.name}» (کد: ${target.code || '-'} • دسته: ${target.category || DEFAULT_CAT} • موجودی: ${target.stock ?? 0} ${target.unit || 'عدد'})`,
      severity: 'critical',
      entityType: 'product',
      entityId: target.id,
      entityLabel: target.name,
      metadata: { code: target.code || null, lastStock: target.stock ?? 0 },
    });
    setSelectedProductIds((prev) => prev.filter((id) => id !== target.id));
    setDeletingProductTarget(null);
    triggerReload();
    showToastSuccess(`کالای «${target.name}» از انبار حذف شد.`);
  };

  // Tab 3: Execute Batch Reprice
  const handleExecuteBatchReprice = () => {
    if (!canManage) return;
    if (!repriceCategory) {
      setErrorMessage('لطفاً دسته‌بندی هدف را انتخاب فرمایید.');
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

      const effectiveTarget =
        !canViewBuyPrices && (repriceTarget === 'buyPrice' || repriceTarget === 'both')
          ? 'sellPrice'
          : repriceTarget;

      const res = StorageService.batchRepriceCategory(
        repriceCategory,
        effectiveTarget,
        effectiveVal,
        repriceRounding,
        repriceMode,
        includeVariantPrices
      );
      setShowRepriceConfirmModal(false);
      triggerReload();
      const catLabel = repriceCategory === '__ALL__' ? 'همه دسته‌بندی‌ها' : `دسته «${repriceCategory}»`;
      showToastSuccess(
        `تعدیل قیمت ${catLabel} انجام شد (${toPersianDigits(res.changedCount)} از ${toPersianDigits(res.count)} کالا تغییر کرد).`
      );
    } catch {
      setErrorMessage('خطا در اعمال تغییرات قیمت.');
    } finally {
      setIsApplyingReprice(false);
    }
  };

  // Normalized category statistics (keyed by categoryKey)
  const categoryStatsByKey = useMemo(() => {
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

    const ensureBucket = (key: string) => {
      if (!stats[key]) {
        stats[key] = {
          count: 0,
          totalStock: 0,
          totalInventoryValue: 0,
          totalPurchaseValue: 0,
          lowStockCount: 0,
          outOfStockCount: 0,
          products: [],
        };
      }
      return stats[key];
    };

    categories.forEach((cat) => ensureBucket(categoryKey(cat)));

    products.forEach((p) => {
      const key = categoryKey(p.category || DEFAULT_CAT) || DEFAULT_CAT_KEY;
      const bucket = ensureBucket(key);
      bucket.count += 1;
      bucket.products.push(p);
      const stock = Number(p.stock) || 0;
      bucket.totalStock += stock;
      bucket.totalInventoryValue += stock * (Number(p.sellPrice) || 0);
      bucket.totalPurchaseValue += stock * (Number(p.buyPrice ?? p.purchasePrice) || 0);
      if (stock <= 0) {
        bucket.outOfStockCount += 1;
      } else if (stock <= (Number(p.minStockAlert) || 0)) {
        bucket.lowStockCount += 1;
      }
    });

    return stats;
  }, [categories, products]);

  const getCatStat = useCallback(
    (cat: string) =>
      categoryStatsByKey[categoryKey(cat)] || {
        count: 0,
        totalStock: 0,
        totalInventoryValue: 0,
        totalPurchaseValue: 0,
        lowStockCount: 0,
        outOfStockCount: 0,
        products: [],
      },
    [categoryStatsByKey]
  );

  // Totals & Health Metrics
  const { totalAllStock, totalAllValue, totalAllPurchaseValue, healthMetrics } = useMemo(() => {
    let stockSum = 0;
    let sellValSum = 0;
    let buyValSum = 0;
    let outOfStock = 0;
    let lowStock = 0;
    let zeroSell = 0;
    let underCost = 0;

    for (const p of products) {
      const stock = Number(p.stock) || 0;
      const sell = Number(p.sellPrice) || 0;
      const buy = Number(p.buyPrice ?? p.purchasePrice) || 0;
      const minAlert = Number(p.minStockAlert) || 0;

      stockSum += stock;
      sellValSum += stock * sell;
      buyValSum += stock * buy;

      if (stock <= 0) outOfStock++;
      else if (stock <= minAlert) lowStock++;
      if (sell <= 0) zeroSell++;
      if (sell > 0 && buy > 0 && sell < buy) underCost++;
    }

    const emptyCategoriesCount = categories.filter(
      (c) => categoryKey(c) !== DEFAULT_CAT_KEY && (categoryStatsByKey[categoryKey(c)]?.count || 0) === 0
    ).length;

    return {
      totalAllStock: stockSum,
      totalAllValue: sellValSum,
      totalAllPurchaseValue: buyValSum,
      healthMetrics: {
        emptyCategoriesCount,
        outOfStockProductsCount: outOfStock,
        lowStockProductsCount: lowStock,
        zeroSellPriceCount: zeroSell,
        underCostCount: underCost,
      },
    };
  }, [categories, categoryStatsByKey, products]);

  // Tab 1: Filtered & Sorted Categories
  const processedCategories = useMemo(() => {
    const q = categoryKey(searchFilter);
    let list = categories.filter((c) => !q || categoryKey(c).includes(q));

    if (categoryStatusFilter === 'with_items') {
      list = list.filter((c) => getCatStat(c).count > 0);
    } else if (categoryStatusFilter === 'empty') {
      list = list.filter((c) => getCatStat(c).count === 0);
    } else if (categoryStatusFilter === 'low_stock') {
      list = list.filter((c) => getCatStat(c).outOfStockCount > 0 || getCatStat(c).lowStockCount > 0);
    }

    if (sortBy === 'name') {
      list = [...list].sort((a, b) => a.localeCompare(b, 'fa'));
    } else if (sortBy === 'products_count') {
      list = [...list].sort((a, b) => getCatStat(b).count - getCatStat(a).count);
    } else if (sortBy === 'stock') {
      list = [...list].sort((a, b) => getCatStat(b).totalStock - getCatStat(a).totalStock);
    } else if (sortBy === 'value') {
      list = [...list].sort((a, b) => getCatStat(b).totalInventoryValue - getCatStat(a).totalInventoryValue);
    }

    return list;
  }, [categories, searchFilter, categoryStatusFilter, sortBy, getCatStat]);

  // Tab 2: Filtered Products
  const batchFilteredProducts = useMemo(() => {
    const q = categoryKey(batchSearchProduct);
    const catFilterKey = batchFilterCurrentCat === 'all' ? 'all' : categoryKey(batchFilterCurrentCat);

    return products.filter((p) => {
      const matchSearch =
        !q ||
        categoryKey(p.name).includes(q) ||
        (p.code || '').toLowerCase().includes(q) ||
        categoryKey(p.category || DEFAULT_CAT).includes(q);
      const matchCat = catFilterKey === 'all' || categoryKey(p.category || DEFAULT_CAT) === catFilterKey;
      if (!matchSearch || !matchCat) return false;

      const stock = Number(p.stock) || 0;
      const sell = Number(p.sellPrice) || 0;
      const buy = Number(p.buyPrice ?? p.purchasePrice) || 0;

      if (batchHealthFilter === 'out_of_stock') return stock <= 0;
      if (batchHealthFilter === 'low_stock') return stock > 0 && stock <= (Number(p.minStockAlert) || 0);
      if (batchHealthFilter === 'zero_price') return sell <= 0;
      if (batchHealthFilter === 'under_cost') return canViewBuyPrices && sell > 0 && buy > 0 && sell < buy;
      return true;
    });
  }, [products, batchSearchProduct, batchFilterCurrentCat, batchHealthFilter, canViewBuyPrices]);

  useEffect(() => {
    setBatchPage(1);
  }, [batchSearchProduct, batchFilterCurrentCat, batchHealthFilter]);

  useEffect(() => {
    const maxPage = Math.max(1, Math.ceil(batchFilteredProducts.length / batchPageSize));
    if (batchPage > maxPage) setBatchPage(maxPage);
  }, [batchFilteredProducts.length, batchPageSize, batchPage]);

  const paginatedBatchProducts = useMemo(() => {
    const start = (batchPage - 1) * batchPageSize;
    return batchFilteredProducts.slice(start, start + batchPageSize);
  }, [batchFilteredProducts, batchPage, batchPageSize]);

  // Tab 3: Live Reprice Preview (supports sellPrice, buyPrice, wholesalePrice, and both!)
  const repricePreviewAllProducts = useMemo(() => {
    const isAll = repriceCategory === '__ALL__';
    const targetCatKey = categoryKey(repriceCategory);
    const q = categoryKey(repriceSearch);

    const list = products.filter((p) => {
      if (!isAll && categoryKey(p.category || DEFAULT_CAT) !== targetCatKey) return false;
      if (q && !categoryKey(p.name).includes(q) && !(p.code || '').toLowerCase().includes(q)) return false;
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

    const effectiveTarget =
      !canViewBuyPrices && (repriceTarget === 'buyPrice' || repriceTarget === 'both')
        ? 'sellPrice'
        : repriceTarget;

    return list.map((p) => {
      const oldSell = Number(p.sellPrice) || 0;
      const oldBuy = Number(p.buyPrice ?? p.purchasePrice) || 0;
      const oldWholesale = Number(p.wholesalePrice) || 0;

      let newSell = oldSell;
      let newBuy = oldBuy;
      let newWholesale = oldWholesale;

      if (repriceMode === 'margin_from_buy') {
        if (oldBuy > 0) {
          newSell = Math.max(0, round(oldBuy * (1 + repriceValue / 100), repriceRounding));
        }
      } else if (repriceMode === 'fixed_amount') {
        if (effectiveTarget === 'sellPrice' || effectiveTarget === 'both') {
          if (oldSell > 0 || signedVal > 0) newSell = Math.max(0, round(oldSell + signedVal, repriceRounding));
        }
        if (effectiveTarget === 'buyPrice' || effectiveTarget === 'both') {
          if (oldBuy > 0 || signedVal > 0) newBuy = Math.max(0, round(oldBuy + signedVal, repriceRounding));
        }
        if (effectiveTarget === 'wholesalePrice') {
          if (oldWholesale > 0 || signedVal > 0) {
            newWholesale = Math.max(0, round(oldWholesale + signedVal, repriceRounding));
          }
        }
      } else {
        if (effectiveTarget === 'sellPrice' || effectiveTarget === 'both') {
          if (oldSell > 0) newSell = Math.max(0, round(oldSell * factor, repriceRounding));
        }
        if (effectiveTarget === 'buyPrice' || effectiveTarget === 'both') {
          if (oldBuy > 0) newBuy = Math.max(0, round(oldBuy * factor, repriceRounding));
        }
        if (effectiveTarget === 'wholesalePrice') {
          if (oldWholesale > 0) newWholesale = Math.max(0, round(oldWholesale * factor, repriceRounding));
        }
      }

      const willChange = newSell !== oldSell || newBuy !== oldBuy || newWholesale !== oldWholesale;

      return {
        id: p.id,
        code: p.code,
        name: p.name,
        category: normalizeCategoryName(p.category) || DEFAULT_CAT,
        oldSell,
        newSell,
        oldBuy,
        newBuy,
        oldWholesale,
        newWholesale,
        willChange,
        hasVariants: Boolean(p.hasVariants && p.variants && p.variants.length > 0),
      };
    });
  }, [
    products,
    repriceCategory,
    repriceMode,
    repriceTarget,
    repriceValue,
    repriceDirection,
    repriceRounding,
    repriceSearch,
    canViewBuyPrices,
  ]);

  const repriceWillChangeCount = useMemo(
    () => repricePreviewAllProducts.filter((item) => item.willChange).length,
    [repricePreviewAllProducts]
  );

  useEffect(() => {
    setRepricePage(1);
  }, [repriceCategory, repriceSearch]);

  useEffect(() => {
    const maxPage = Math.max(1, Math.ceil(repricePreviewAllProducts.length / repricePageSize));
    if (repricePage > maxPage) setRepricePage(maxPage);
  }, [repricePreviewAllProducts.length, repricePageSize, repricePage]);

  const paginatedRepricePreview = useMemo(() => {
    const start = (repricePage - 1) * repricePageSize;
    return repricePreviewAllProducts.slice(start, start + repricePageSize);
  }, [repricePreviewAllProducts, repricePage, repricePageSize]);

  // CSV Exports
  const handleExportCategoryToCsv = (catName: string) => {
    const targetKey = categoryKey(catName);
    const catProducts = products.filter((p) => categoryKey(p.category || DEFAULT_CAT) === targetKey);
    const headers = canViewBuyPrices
      ? ['کد کالا', 'نام کالا', 'دسته‌بندی', 'واحد شمارش', 'موجودی انبار', 'قیمت خرید', 'قیمت فروش', 'قیمت همکار', 'ارزش کل موجودی فروش']
      : ['کد کالا', 'نام کالا', 'دسته‌بندی', 'واحد شمارش', 'موجودی انبار', 'قیمت فروش', 'قیمت همکار', 'ارزش کل موجودی فروش'];

    const rows = catProducts.map((p) => {
      const stock = Number(p.stock) || 0;
      const sell = Number(p.sellPrice) || 0;
      const buy = Number(p.buyPrice ?? p.purchasePrice) || 0;
      const wholesale = Number(p.wholesalePrice) || 0;
      return canViewBuyPrices
        ? [p.code, p.name, p.category || DEFAULT_CAT, p.unit || 'عدد', stock, buy, sell, wholesale, stock * sell]
        : [p.code, p.name, p.category || DEFAULT_CAT, p.unit || 'عدد', stock, sell, wholesale, stock * sell];
    });
    downloadCsv(`کالاهای_دسته_${catName}`, headers, rows);
  };

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
      const stat = getCatStat(cat);
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

  const jumpToProductsFilter = (
    catFilter: string,
    healthFilter: 'all' | 'out_of_stock' | 'low_stock' | 'zero_price' | 'under_cost' = 'all'
  ) => {
    setBatchFilterCurrentCat(catFilter);
    setBatchHealthFilter(healthFilter);
    setActiveTab('batch_assign');
  };

  // Unit options for quick modal (preserves custom units)
  const quickModalUnitOptions = useMemo(() => {
    if (!quickProductModal) return COMMON_PRODUCT_UNITS;
    const curr = normalizeCategoryName(quickProductModal.unit);
    if (curr && !COMMON_PRODUCT_UNITS.includes(curr)) {
      return [curr, ...COMMON_PRODUCT_UNITS];
    }
    return COMMON_PRODUCT_UNITS;
  }, [quickProductModal]);

  const canReorderNow =
    canManage && sortBy === 'default' && !searchFilter.trim() && categoryStatusFilter === 'all';

  const allBatchVisibleSelected =
    batchFilteredProducts.length > 0 &&
    batchFilteredProducts.every((p) => selectedProductIds.includes(p.id));

  // Tab 3 preview columns helper
  const showBuyColumn =
    canViewBuyPrices &&
    (repriceTarget === 'buyPrice' || repriceTarget === 'both' || repriceMode === 'margin_from_buy');
  const showSellColumn =
    repriceMode === 'margin_from_buy' || repriceTarget === 'sellPrice' || repriceTarget === 'both';
  const showWholesaleColumn = repriceMode !== 'margin_from_buy' && repriceTarget === 'wholesalePrice';

  // Main UI Content Body
  const contentBody = (
    <div className="flex flex-col h-full overflow-hidden bg-white">
      {/* Clean Single-Elevation Header */}
      <div className="shrink-0 bg-white border-b border-slate-200 px-4 sm:px-6 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center shrink-0">
            <FolderTree className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-black text-sm sm:text-base text-slate-900 truncate">
                مدیریت کالاها و دسته‌بندی‌ها
              </h3>
              {!canManage && (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700">
                  <Lock className="w-3 h-3" />
                  <span>فقط مشاهده</span>
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5 tabular-nums">
              {toPersianDigits(categories.length)} دسته‌بندی • {toPersianDigits(products.length)} قلم کالا •{' '}
              {toPersianDigits(totalAllStock)} واحد موجودی
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
          {canManage && (
            <button
              type="button"
              onClick={() => handleOpenQuickProductModal()}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>کالای جدید</span>
            </button>
          )}

          {onNavigateToInventory && (
            <button
              type="button"
              onClick={onNavigateToInventory}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <Package className="w-3.5 h-3.5" />
              <span>رفتن به انبار</span>
            </button>
          )}

          {!embedded && onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              title="بستن پنجره (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Hairline-Divided Flat KPI Summary Strip (no nested cards) */}
      <div className="shrink-0 bg-slate-50/70 border-b border-slate-200 grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x lg:divide-x-reverse divide-slate-200">
        <div className="px-4 py-2.5 flex items-center justify-between gap-2">
          <div>
            <div className="text-[11px] text-slate-500 font-medium">دسته‌بندی‌ها</div>
            <div className="text-sm font-black text-slate-900 mt-0.5 tabular-nums">
              {toPersianDigits(categories.length)}{' '}
              <span className="text-[11px] font-normal text-slate-500">گروه</span>
            </div>
          </div>
          {canManage && healthMetrics.emptyCategoriesCount > 0 && (
            <button
              type="button"
              onClick={handleCleanupEmptyCategories}
              className="text-[11px] font-bold text-amber-700 hover:text-amber-900 hover:underline cursor-pointer whitespace-nowrap"
              title="حذف خودکار دسته‌بندی‌های بدون کالا"
            >
              پاکسازی {toPersianDigits(healthMetrics.emptyCategoriesCount)} خالی
            </button>
          )}
        </div>

        <div className="px-4 py-2.5">
          <div className="text-[11px] text-slate-500 font-medium">اقلام و موجودی کل</div>
          <div className="text-sm font-black text-slate-900 mt-0.5 tabular-nums">
            {toPersianDigits(products.length)} کالا{' '}
            <span className="text-xs font-semibold text-slate-500">({toPersianDigits(totalAllStock)} واحد)</span>
          </div>
        </div>

        <div className="px-4 py-2.5">
          <div className="text-[11px] text-slate-500 font-medium">وضعیت هشدار انبار</div>
          <div className="flex items-center gap-2 mt-0.5 tabular-nums">
            <button
              type="button"
              onClick={() => jumpToProductsFilter('all', 'out_of_stock')}
              className={`text-xs font-black hover:underline cursor-pointer ${
                healthMetrics.outOfStockProductsCount > 0 ? 'text-rose-600' : 'text-slate-700'
              }`}
            >
              {toPersianDigits(healthMetrics.outOfStockProductsCount)} ناموجود
            </button>
            <span className="text-slate-300">/</span>
            <button
              type="button"
              onClick={() => jumpToProductsFilter('all', 'low_stock')}
              className={`text-xs font-bold hover:underline cursor-pointer ${
                healthMetrics.lowStockProductsCount > 0 ? 'text-amber-600' : 'text-slate-500'
              }`}
            >
              {toPersianDigits(healthMetrics.lowStockProductsCount)} کمبود
            </button>
          </div>
        </div>

        <div className="px-4 py-2.5">
          <div className="text-[11px] text-slate-500 font-medium">ارزش فروش موجودی</div>
          <div className="text-sm font-black font-mono tabular-nums text-emerald-700 truncate mt-0.5">
            {formatPrice(totalAllValue)} <span className="text-[11px] font-sans font-normal text-slate-500">{currency}</span>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="shrink-0 bg-white border-b border-slate-200 px-3 sm:px-6 flex items-center gap-1 overflow-x-auto no-scrollbar">
        {[
          { id: 'list', label: 'دسته‌بندی‌ها', count: categories.length, icon: FolderTree },
          { id: 'batch_assign', label: 'مدیریت و ویرایش گروهی کالاها', count: products.length, icon: Layers },
          ...(canManage ? [{ id: 'batch_reprice', label: 'تعدیل گروهی قیمت‌ها', count: null, icon: Percent }] : []),
          { id: 'analytics', label: 'تحلیل سرمایه و سلامت', count: null, icon: BarChart2 },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-bold border-b-2 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                isActive
                  ? 'text-indigo-700 border-indigo-600'
                  : 'text-slate-500 hover:text-slate-900 border-transparent'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
              {tab.count !== null && (
                <span className="text-[11px] font-mono tabular-nums text-slate-400">
                  ({toPersianDigits(tab.count)})
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Scrollable Main Content */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
        {/* Notifications */}
        {errorMessage && (
          <div className="px-3.5 py-2.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-bold flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <button type="button" onClick={() => setErrorMessage(null)} className="text-rose-400 hover:text-rose-700 cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {successMessage && (
          <div className="px-3.5 py-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-bold flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successMessage}</span>
            </div>
            <button type="button" onClick={() => setSuccessMessage(null)} className="text-emerald-400 hover:text-emerald-700 cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* ===================== TAB 1: CATEGORIES LIST & ORGANIZATION ===================== */}
        {activeTab === 'list' && (
          <div className="space-y-4">
            {/* Compact Add Category & Tools Bar */}
            {canManage && (
              <div className="bg-slate-50/70 border border-slate-200 rounded-xl p-3 space-y-2.5">
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
                    placeholder="نام دسته‌بندی جدید (مثلاً: قطعات یدکی، ابزارآلات...)"
                    className="flex-1 h-9 bg-white border border-slate-300 rounded-lg px-3 text-xs text-slate-900 placeholder-slate-400 outline-none focus:border-indigo-500 transition-colors font-medium"
                  />
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="submit"
                      className="flex-1 sm:flex-initial h-9 flex items-center justify-center gap-1.5 px-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>افزودن دسته</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowSuggestions((prev) => !prev)}
                      className={`h-9 px-2.5 border rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1 whitespace-nowrap ${
                        showSuggestions
                          ? 'bg-amber-50 border-amber-300 text-amber-800'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                      title="نمایش پیشنهادهای آماده دسته‌بندی"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                      <span className="hidden sm:inline">پیشنهادها</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleNormalizeCategories}
                      className="h-9 px-2.5 bg-white hover:bg-indigo-50 text-slate-600 hover:text-indigo-700 border border-slate-200 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1 whitespace-nowrap"
                      title="استانداردسازی حروف فارسی/عربی (ي/ی و ك/ک)، حذف فاصله اضافه و ادغام تکراری‌ها"
                    >
                      <Wand2 className="w-3.5 h-3.5 text-indigo-600" />
                      <span className="hidden md:inline">یکپارچه‌سازی</span>
                    </button>
                  </div>
                </form>

                {showSuggestions && (
                  <div className="pt-2 border-t border-slate-200/80 flex flex-wrap gap-1.5">
                    {SUGGESTED_CATEGORIES.map((sug) => {
                      const exists = categories.some((c) => categoryKey(c) === categoryKey(sug));
                      return (
                        <button
                          key={sug}
                          type="button"
                          disabled={exists}
                          onClick={() => handleAddCategorySubmit(sug)}
                          className={`text-[11px] px-2.5 py-1 rounded-lg font-medium transition-colors ${
                            exists
                              ? 'bg-slate-200/70 text-slate-400 cursor-default'
                              : 'bg-white hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 border border-slate-200 hover:border-indigo-300 cursor-pointer'
                          }`}
                        >
                          {exists ? `✓ ${sug}` : `+ ${sug}`}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Search, Filter & Sort Toolbar */}
            <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-2.5">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 flex-1">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    placeholder="جستجو در نام دسته‌بندی‌ها..."
                    className="w-full h-9 bg-white border border-slate-200 rounded-lg pr-8 pl-3 text-xs text-slate-800 outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="flex items-center gap-0.5 bg-slate-100 p-0.5 rounded-lg border border-slate-200 overflow-x-auto">
                  {[
                    { id: 'all', label: 'همه' },
                    { id: 'with_items', label: 'دارای کالا' },
                    { id: 'empty', label: 'خالی' },
                    { id: 'low_stock', label: 'کمبود/ناموجود' },
                  ].map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setCategoryStatusFilter(f.id as any)}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-colors cursor-pointer whitespace-nowrap ${
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
                <div className="flex items-center gap-1.5 h-9 text-xs text-slate-600 bg-white border border-slate-200 rounded-lg px-2.5">
                  <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400" />
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="bg-transparent font-bold text-slate-800 outline-none cursor-pointer text-xs"
                  >
                    <option value="default">ترتیب دستی</option>
                    <option value="name">حروف الفبا</option>
                    <option value="products_count">بیشترین تعداد کالا</option>
                    <option value="stock">بیشترین موجودی</option>
                    <option value="value">بیشترین ارزش فروش</option>
                  </select>
                </div>

                <button
                  type="button"
                  onClick={handleExportAnalyticsToCsv}
                  className="h-9 flex items-center gap-1 px-3 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg text-xs font-bold transition-colors cursor-pointer shrink-0"
                  title="خروجی اکسل گزارش دسته‌بندی‌ها"
                >
                  <Download className="w-3.5 h-3.5 text-slate-500" />
                  <span>خروجی اکسل</span>
                </button>
              </div>
            </div>

            {/* Inline Merge Panel */}
            {canManage && mergingSourceCat && (
              <div className="p-3.5 bg-indigo-50/70 border border-indigo-200 rounded-xl space-y-2.5">
                <div className="flex items-center justify-between text-indigo-950 font-bold text-xs">
                  <div className="flex items-center gap-1.5">
                    <Merge className="w-4 h-4 text-indigo-600" />
                    <span>ادغام دسته‌بندی «{mergingSourceCat}» در دسته‌بندی مقصد</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setMergingSourceCat(null)}
                    className="text-slate-400 hover:text-slate-700 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-[11px] text-slate-600">
                  تمامی کالاهای دسته «{mergingSourceCat}» به دسته‌بندی مقصد منتقل شده و دسته مبدا حذف می‌شود.
                </p>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <select
                    value={mergingTargetCat}
                    onChange={(e) => setMergingTargetCat(e.target.value)}
                    className="flex-1 h-9 bg-white border border-indigo-200 rounded-lg px-3 text-xs font-bold text-slate-800 outline-none cursor-pointer"
                  >
                    <option value="">-- انتخاب دسته‌بندی مقصد --</option>
                    {categories
                      .filter((c) => categoryKey(c) !== categoryKey(mergingSourceCat))
                      .map((c) => (
                        <option key={c} value={c}>
                          انتقال به: {c} ({toPersianDigits(getCatStat(c).count)} کالا)
                        </option>
                      ))}
                  </select>
                  <button
                    type="button"
                    onClick={handleConfirmMerge}
                    disabled={!mergingTargetCat}
                    className="h-9 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white rounded-lg font-bold text-xs transition-colors cursor-pointer shrink-0"
                  >
                    تایید ادغام
                  </button>
                </div>
              </div>
            )}

            {/* Categories Table / Flat List Container */}
            <div className="border border-slate-200 rounded-xl overflow-hidden bg-white divide-y divide-slate-200">
              {processedCategories.length === 0 ? (
                <div className="text-center py-10 text-slate-400 text-xs">
                  هیچ دسته‌بندی مطابق با جستجو یا فیلتر انتخابی یافت نشد.
                </div>
              ) : (
                processedCategories.map((cat) => {
                  const stat = getCatStat(cat);
                  const isDefault = categoryKey(cat) === DEFAULT_CAT_KEY;
                  const isEditing = editingCatName === cat;
                  const isDeleting = deletingCat === cat;
                  const globalIdx = categories.findIndex((c) => categoryKey(c) === categoryKey(cat));
                  const stockShare = totalAllStock > 0 ? Math.round((stat.totalStock / totalAllStock) * 100) : 0;

                  return (
                    <div key={cat} className="px-3.5 py-3 hover:bg-slate-50/70 transition-colors">
                      {isEditing ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={renamedValue}
                            onChange={(e) => setRenamedValue(e.target.value)}
                            className="flex-1 h-9 bg-white border border-indigo-400 rounded-lg px-3 text-xs text-slate-900 font-bold outline-none focus:ring-2 focus:ring-indigo-500/20"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveRename(cat);
                              if (e.key === 'Escape') setEditingCatName(null);
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => handleSaveRename(cat)}
                            className="h-9 px-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors cursor-pointer flex items-center gap-1 text-xs font-bold"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>ذخیره</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingCatName(null)}
                            className="h-9 px-2.5 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-colors cursor-pointer"
                            title="انصراف"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : isDeleting ? (
                        <div className="p-3 bg-rose-50/80 border border-rose-200 rounded-xl space-y-2.5">
                          <div className="flex items-center gap-2 text-rose-800 text-xs font-bold">
                            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                            <span>حذف دسته‌بندی «{cat}»</span>
                          </div>
                          {stat.count > 0 ? (
                            <div className="text-xs text-slate-700 space-y-2">
                              <p className="text-[11px] text-slate-600">
                                این دسته دارای <strong className="text-rose-700">{toPersianDigits(stat.count)} قلم کالا</strong> است. کالاها به کدام دسته منتقل شوند؟
                              </p>
                              <select
                                value={reassignTarget}
                                onChange={(e) => setReassignTarget(e.target.value)}
                                className="w-full h-9 bg-white border border-slate-300 rounded-lg px-3 text-xs text-slate-800 font-medium outline-none cursor-pointer"
                              >
                                {categories
                                  .filter((c) => categoryKey(c) !== categoryKey(cat))
                                  .map((c) => (
                                    <option key={c} value={c}>
                                      انتقال به: {c}
                                    </option>
                                  ))}
                              </select>
                            </div>
                          ) : (
                            <p className="text-[11px] text-slate-600">
                              این دسته‌بندی بدون کالاست و حذف آن اثری بر موجودی ندارد.
                            </p>
                          )}
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setDeletingCat(null)}
                              className="px-3 py-1.5 text-xs font-bold text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 cursor-pointer"
                            >
                              انصراف
                            </button>
                            <button
                              type="button"
                              onClick={() => handleConfirmDelete(cat)}
                              className="px-3.5 py-1.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg cursor-pointer"
                            >
                              تایید حذف
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5">
                            {/* Category Info & Metrics */}
                            <div className="flex items-start sm:items-center gap-2.5 min-w-0">
                              <button
                                type="button"
                                disabled={stat.count === 0}
                                onClick={() => {
                                  if (stat.count === 0) return;
                                  setViewingCategoryProducts(viewingCategoryProducts === cat ? null : cat);
                                  setAccordionSearch('');
                                }}
                                className={`w-7 h-7 mt-0.5 sm:mt-0 rounded-lg border flex items-center justify-center shrink-0 transition-colors ${
                                  stat.count > 0
                                    ? 'bg-slate-50 border-slate-200 text-slate-500 hover:text-indigo-700 hover:border-indigo-300 cursor-pointer'
                                    : 'bg-slate-50/50 border-slate-100 text-slate-300 cursor-default'
                                }`}
                                title={stat.count > 0 ? 'مشاهده سریع کالاهای این دسته' : 'بدون کالا'}
                              >
                                <ChevronDown
                                  className={`w-3.5 h-3.5 transition-transform ${
                                    viewingCategoryProducts === cat ? 'rotate-180 text-indigo-600' : ''
                                  }`}
                                />
                              </button>

                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="font-bold text-sm text-slate-900">{cat}</span>
                                  {isDefault && (
                                    <span className="text-[10px] font-semibold text-slate-500">پیش‌فرض سیستم</span>
                                  )}
                                  {stat.outOfStockCount > 0 && (
                                    <span className="text-[11px] font-bold text-rose-600 tabular-nums">
                                      • {toPersianDigits(stat.outOfStockCount)} ناموجود
                                    </span>
                                  )}
                                  {stat.lowStockCount > 0 && (
                                    <span className="text-[11px] font-bold text-amber-600 tabular-nums">
                                      • {toPersianDigits(stat.lowStockCount)} کمبود
                                    </span>
                                  )}
                                </div>
                                <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-slate-500 mt-0.5 tabular-nums">
                                  <span>
                                    <strong className="text-slate-800">{toPersianDigits(stat.count)}</strong> کالا
                                  </span>
                                  <span>
                                    موجودی: <strong className="font-mono text-slate-700">{toPersianDigits(stat.totalStock)}</strong> ({toPersianDigits(stockShare)}٪)
                                  </span>
                                  {stat.totalInventoryValue > 0 && (
                                    <span>
                                      ارزش فروش:{' '}
                                      <strong className="font-mono text-emerald-700">
                                        {formatPrice(stat.totalInventoryValue)}
                                      </strong>{' '}
                                      {currency}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Streamlined Actions */}
                            <div className="flex flex-wrap items-center gap-1 shrink-0 mr-9 md:mr-0">
                              {canReorderNow && (
                                <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden bg-white ml-1">
                                  <button
                                    type="button"
                                    disabled={globalIdx <= 0}
                                    onClick={() => handleMoveCategory(cat, 'up')}
                                    className="p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-25 cursor-pointer"
                                    title="انتقال به بالا"
                                  >
                                    <ArrowUp className="w-3 h-3" />
                                  </button>
                                  <button
                                    type="button"
                                    disabled={globalIdx === -1 || globalIdx >= categories.length - 1}
                                    onClick={() => handleMoveCategory(cat, 'down')}
                                    className="p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-25 cursor-pointer border-r border-slate-200"
                                    title="انتقال به پایین"
                                  >
                                    <ArrowDown className="w-3 h-3" />
                                  </button>
                                </div>
                              )}

                              {canManage && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenQuickProductModal(undefined, cat)}
                                  className="px-2 py-1.5 text-[11px] font-bold text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                                  title={`افزودن کالا در دسته «${cat}»`}
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                  <span className="hidden sm:inline">کالا</span>
                                </button>
                              )}

                              {stat.count > 0 && (
                                <button
                                  type="button"
                                  onClick={() => jumpToProductsFilter(cat, 'all')}
                                  className="px-2 py-1.5 text-[11px] font-bold text-indigo-700 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                                  title="مدیریت گروهی کالاهای این دسته"
                                >
                                  <Layers className="w-3.5 h-3.5" />
                                  <span className="hidden sm:inline">کالاها</span>
                                </button>
                              )}

                              {onSelectCategory && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    onSelectCategory(cat);
                                    if (onClose) onClose();
                                  }}
                                  className="p-1.5 text-slate-500 hover:text-indigo-700 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                                  title="فیلتر این دسته در صفحه انبار"
                                >
                                  <Filter className="w-3.5 h-3.5" />
                                </button>
                              )}

                              {stat.count > 0 && (
                                <button
                                  type="button"
                                  onClick={() => handleExportCategoryToCsv(cat)}
                                  className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                                  title="خروجی اکسل کالاهای این دسته"
                                >
                                  <Download className="w-3.5 h-3.5" />
                                </button>
                              )}

                              {canManage && !isDefault && (
                                <>
                                  <span className="w-px h-4 bg-slate-200 mx-0.5" />
                                  {categories.length > 1 && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setDeletingCat(null);
                                        setEditingCatName(null);
                                        setMergingSourceCat(cat);
                                        setMergingTargetCat(
                                          categories.find((c) => categoryKey(c) !== categoryKey(cat)) || ''
                                        );
                                      }}
                                      className="p-1.5 text-slate-500 hover:text-indigo-700 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                                      title="ادغام در دسته‌بندی دیگر"
                                    >
                                      <Merge className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => handleStartRename(cat)}
                                    className="p-1.5 text-slate-500 hover:text-indigo-700 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                                    title="تغییر نام"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingCatName(null);
                                      setMergingSourceCat(null);
                                      setDeletingCat(cat);
                                      setReassignTarget(
                                        categories.find((c) => categoryKey(c) !== categoryKey(cat)) || DEFAULT_CAT
                                      );
                                    }}
                                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                    title="حذف دسته‌بندی"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </>
                              )}
                            </div>
                          </div>

                          {/* Expandable Product Preview */}
                          {viewingCategoryProducts === cat && stat.products.length > 0 && (
                            <div className="mt-3 pt-2.5 border-t border-slate-100 mr-0 sm:mr-9 space-y-2">
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                <span className="text-[11px] font-bold text-slate-600">
                                  اقلام دسته «{cat}» ({toPersianDigits(stat.products.length)} مورد)
                                </span>
                                <input
                                  type="text"
                                  value={accordionSearch}
                                  onChange={(e) => setAccordionSearch(e.target.value)}
                                  placeholder="جستجو در اقلام این دسته..."
                                  className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-[11px] outline-none focus:bg-white focus:border-indigo-400 sm:w-52"
                                />
                              </div>
                              <div className="max-h-52 overflow-y-auto divide-y divide-slate-100 text-xs">
                                {stat.products
                                  .filter((p) => {
                                    const q = categoryKey(accordionSearch);
                                    return (
                                      !q ||
                                      categoryKey(p.name).includes(q) ||
                                      (p.code || '').toLowerCase().includes(q)
                                    );
                                  })
                                  .map((p) => (
                                    <div key={p.id} className="py-1.5 flex items-center justify-between gap-2">
                                      <div className="flex items-center gap-2 truncate">
                                        <span className="text-[11px] text-slate-400 font-mono tabular-nums">
                                          {toPersianDigits(p.code)}
                                        </span>
                                        <span className="font-semibold text-slate-800 truncate">{p.name}</span>
                                      </div>
                                      <div className="flex items-center gap-3 shrink-0 tabular-nums">
                                        <span className="font-mono text-[11px] text-slate-600">
                                          {formatPrice(p.sellPrice || 0)}
                                        </span>
                                        <span
                                          className={`font-mono text-[11px] font-bold ${
                                            (p.stock || 0) <= 0 ? 'text-rose-600' : 'text-slate-700'
                                          }`}
                                        >
                                          {toPersianDigits(p.stock)} {p.unit || 'عدد'}
                                        </span>
                                        {canManage && (
                                          <button
                                            type="button"
                                            onClick={() => handleOpenQuickProductModal(p)}
                                            className="p-1 text-slate-400 hover:text-indigo-600 rounded transition-colors cursor-pointer"
                                            title="ویرایش سریع"
                                          >
                                            <Edit2 className="w-3.5 h-3.5" />
                                          </button>
                                        )}
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
          <div className="space-y-3.5">
            {/* Bulk Action Toolbar (only for users with manage permission) */}
            {canManage && (
              <div className="p-3 bg-slate-50/70 rounded-xl border border-slate-200 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-bold text-slate-800 tabular-nums">
                    عملیات گروهی ({toPersianDigits(selectedProductIds.length)} کالای انتخاب‌شده)
                  </span>

                  <div className="flex items-center gap-0.5 bg-white p-0.5 rounded-lg border border-slate-200">
                    {[
                      { id: 'category', label: 'تغییر دسته‌بندی' },
                      { id: 'unit', label: 'تغییر واحد' },
                      { id: 'minStock', label: 'حد هشدار موجودی' },
                    ].map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setBatchActionMode(m.id as any)}
                        className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-colors cursor-pointer ${
                          batchActionMode === m.id
                            ? 'bg-indigo-600 text-white'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 pt-2 border-t border-slate-200/80">
                  <div className="flex items-center gap-2 flex-1">
                    {batchActionMode === 'category' && (
                      <>
                        <span className="text-xs font-semibold text-slate-600 whitespace-nowrap">انتقال به دسته:</span>
                        <select
                          value={batchTargetCategory}
                          onChange={(e) => setBatchTargetCategory(e.target.value)}
                          className="flex-1 sm:max-w-xs h-9 bg-white border border-slate-300 rounded-lg px-3 text-xs font-bold text-slate-800 outline-none cursor-pointer"
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
                        <span className="text-xs font-semibold text-slate-600 whitespace-nowrap">واحد جدید:</span>
                        <select
                          value={batchTargetUnit}
                          onChange={(e) => setBatchTargetUnit(e.target.value)}
                          className="flex-1 sm:max-w-xs h-9 bg-white border border-slate-300 rounded-lg px-3 text-xs font-bold text-slate-800 outline-none cursor-pointer"
                        >
                          {COMMON_PRODUCT_UNITS.map((u) => (
                            <option key={u} value={u}>
                              {u}
                            </option>
                          ))}
                        </select>
                      </>
                    )}

                    {batchActionMode === 'minStock' && (
                      <>
                        <span className="text-xs font-semibold text-slate-600 whitespace-nowrap">حد هشدار:</span>
                        <input
                          type="number"
                          min={0}
                          value={batchTargetMinStock}
                          onChange={(e) => setBatchTargetMinStock(Math.max(0, Number(e.target.value)))}
                          className="w-28 h-9 bg-white border border-slate-300 rounded-lg px-3 text-xs font-mono tabular-nums font-bold text-slate-800 outline-none"
                        />
                      </>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={handleExecuteBatchAction}
                    disabled={selectedProductIds.length === 0}
                    className="h-9 flex items-center justify-center gap-1.5 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer shrink-0"
                  >
                    <MoveRight className="w-3.5 h-3.5" />
                    <span>اعمال روی {toPersianDigits(selectedProductIds.length)} کالا</span>
                  </button>
                </div>
              </div>
            )}

            {/* Search & Filters */}
            <div className="space-y-2">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={batchSearchProduct}
                    onChange={(e) => setBatchSearchProduct(e.target.value)}
                    placeholder="جستجوی نام، کد یا دسته‌بندی کالا..."
                    className="w-full h-9 bg-white border border-slate-200 rounded-lg pr-8 pl-3 text-xs outline-none focus:border-indigo-500"
                  />
                </div>

                <select
                  value={batchFilterCurrentCat}
                  onChange={(e) => setBatchFilterCurrentCat(e.target.value)}
                  className="h-9 bg-white border border-slate-200 rounded-lg px-3 text-xs font-bold text-slate-700 outline-none cursor-pointer"
                >
                  <option value="all">همه دسته‌بندی‌ها ({toPersianDigits(products.length)})</option>
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      {c} ({toPersianDigits(getCatStat(c).count)})
                    </option>
                  ))}
                </select>

                {canManage && (
                  <button
                    type="button"
                    onClick={() => {
                      if (allBatchVisibleSelected) {
                        const visibleSet = new Set(batchFilteredProducts.map((p) => p.id));
                        setSelectedProductIds((prev) => prev.filter((id) => !visibleSet.has(id)));
                      } else {
                        setSelectedProductIds((prev) =>
                          Array.from(new Set([...prev, ...batchFilteredProducts.map((p) => p.id)]))
                        );
                      }
                    }}
                    className="h-9 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap"
                  >
                    {allBatchVisibleSelected ? 'لغو انتخاب نتایج' : 'انتخاب همه نتایج'}
                  </button>
                )}
              </div>

              {/* Health Filter Tabs */}
              <div className="flex flex-wrap items-center gap-1.5">
                {[
                  { id: 'all', label: 'همه کالاها' },
                  { id: 'out_of_stock', label: `ناموجود (${toPersianDigits(healthMetrics.outOfStockProductsCount)})` },
                  { id: 'low_stock', label: `کمبود (${toPersianDigits(healthMetrics.lowStockProductsCount)})` },
                  { id: 'zero_price', label: `بدون قیمت فروش (${toPersianDigits(healthMetrics.zeroSellPriceCount)})` },
                  ...(canViewBuyPrices
                    ? [
                        {
                          id: 'under_cost',
                          label: `فروش زیر خرید (${toPersianDigits(healthMetrics.underCostCount)})`,
                        },
                      ]
                    : []),
                ].map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setBatchHealthFilter(f.id as any)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors cursor-pointer border tabular-nums ${
                      batchHealthFilter === f.id
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Compact High-Density Products Data Grid */}
            <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs border-collapse">
                  <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                    <tr>
                      {canManage && (
                        <th className="px-3 py-2.5 w-10 text-center">
                          <input
                            type="checkbox"
                            checked={allBatchVisibleSelected}
                            onChange={(e) => {
                              const visibleIds = batchFilteredProducts.map((p) => p.id);
                              if (e.target.checked) {
                                setSelectedProductIds((prev) => Array.from(new Set([...prev, ...visibleIds])));
                              } else {
                                const visibleSet = new Set(visibleIds);
                                setSelectedProductIds((prev) => prev.filter((id) => !visibleSet.has(id)));
                              }
                            }}
                            className="w-4 h-4 rounded text-indigo-600 cursor-pointer"
                          />
                        </th>
                      )}
                      <th className="px-3 py-2.5 font-bold">کد</th>
                      <th className="px-3 py-2.5 font-bold">نام کالا</th>
                      <th className="px-3 py-2.5 font-bold">دسته‌بندی</th>
                      {canViewBuyPrices && <th className="px-3 py-2.5 font-bold text-center">خرید</th>}
                      <th className="px-3 py-2.5 font-bold text-center">فروش ({currency})</th>
                      <th className="px-3 py-2.5 font-bold text-center">موجودی</th>
                      {canManage && <th className="px-3 py-2.5 font-bold text-center w-20">عملیات</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {paginatedBatchProducts.length === 0 ? (
                      <tr>
                        <td
                          colSpan={(canViewBuyPrices ? 6 : 5) + (canManage ? 2 : 0)}
                          className="text-center py-8 text-slate-400"
                        >
                          هیچ کالایی مطابق با فیلترهای انتخابی یافت نشد.
                        </td>
                      </tr>
                    ) : (
                      paginatedBatchProducts.map((p) => {
                        const isChecked = selectedProductIds.includes(p.id);
                        const buy = Number(p.buyPrice ?? p.purchasePrice) || 0;
                        const sell = Number(p.sellPrice) || 0;
                        const isUnderCost = canViewBuyPrices && sell > 0 && buy > 0 && sell < buy;
                        const normCat = normalizeCategoryName(p.category) || DEFAULT_CAT;
                        const matchedCat = categories.find((c) => categoryKey(c) === categoryKey(normCat)) || normCat;

                        return (
                          <tr
                            key={p.id}
                            onClick={() => {
                              if (!canManage) return;
                              setSelectedProductIds((prev) =>
                                isChecked ? prev.filter((id) => id !== p.id) : [...prev, p.id]
                              );
                            }}
                            className={`transition-colors ${canManage ? 'cursor-pointer' : ''} ${
                              isChecked ? 'bg-indigo-50/60' : 'hover:bg-slate-50/80'
                            }`}
                          >
                            {canManage && (
                              <td className="px-3 py-2 text-center" onClick={(e) => e.stopPropagation()}>
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
                            )}
                            <td className="px-3 py-2 font-mono tabular-nums text-slate-500 font-semibold">
                              {toPersianDigits(p.code)}
                            </td>
                            <td className="px-3 py-2">
                              <div className="font-bold text-slate-900">{p.name}</div>
                              {isUnderCost && (
                                <span className="text-[10px] text-rose-600 font-bold">
                                  فروش کمتر از خرید
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                              {canManage ? (
                                <select
                                  value={matchedCat}
                                  onChange={(e) => {
                                    StorageService.batchAssignCategory([p.id], e.target.value);
                                    triggerReload();
                                  }}
                                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-1 rounded-md font-semibold text-[11px] outline-none cursor-pointer"
                                >
                                  {categories.map((c) => (
                                    <option key={c} value={c}>
                                      {c}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                <span className="text-slate-600 font-medium">{matchedCat}</span>
                              )}
                            </td>
                            {canViewBuyPrices && (
                              <td className="px-3 py-2 text-center font-mono tabular-nums text-slate-600">
                                {formatPrice(buy)}
                              </td>
                            )}
                            <td className="px-3 py-2 text-center font-mono tabular-nums font-bold text-emerald-700">
                              {sell > 0 ? formatPrice(sell) : <span className="text-rose-500 text-[10px] font-sans">تعیین نشده</span>}
                            </td>
                            <td className="px-3 py-2 text-center font-mono tabular-nums font-bold">
                              <span
                                className={
                                  (p.stock || 0) <= 0
                                    ? 'text-rose-600'
                                    : (p.stock || 0) <= (p.minStockAlert || 0)
                                    ? 'text-amber-600'
                                    : 'text-slate-700'
                                }
                              >
                                {toPersianDigits(p.stock)} {p.unit || 'عدد'}
                              </span>
                            </td>
                            {canManage && (
                              <td className="px-3 py-2 text-center" onClick={(e) => e.stopPropagation()}>
                                <div className="flex items-center justify-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => handleOpenQuickProductModal(p)}
                                    className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                                    title="ویرایش سریع"
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
                            )}
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              <div className="px-3 py-2.5 border-t border-slate-100 bg-slate-50/50">
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
        {activeTab === 'batch_reprice' && canManage && (
          <div className="space-y-4">
            <div className="bg-slate-50/70 border border-slate-200 rounded-xl p-4 space-y-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-200">
                <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Percent className="w-4 h-4 text-emerald-600" />
                  <span>روش تعدیل گروهی قیمت‌ها</span>
                </span>

                <div className="flex flex-wrap items-center gap-0.5 bg-white p-0.5 rounded-lg border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setRepriceMode('percent')}
                    className={`px-3 py-1 rounded-md text-[11px] font-bold transition-colors cursor-pointer ${
                      repriceMode === 'percent' ? 'bg-emerald-600 text-white' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    تغییر درصدی (٪)
                  </button>
                  <button
                    type="button"
                    onClick={() => setRepriceMode('fixed_amount')}
                    className={`px-3 py-1 rounded-md text-[11px] font-bold transition-colors cursor-pointer ${
                      repriceMode === 'fixed_amount' ? 'bg-emerald-600 text-white' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    مبلغ ثابت ({currency})
                  </button>
                  {canViewBuyPrices && (
                    <button
                      type="button"
                      onClick={() => setRepriceMode('margin_from_buy')}
                      className={`px-3 py-1 rounded-md text-[11px] font-bold transition-colors cursor-pointer ${
                        repriceMode === 'margin_from_buy'
                          ? 'bg-emerald-600 text-white'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      ٪ سود روی خرید
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">دسته‌بندی هدف</label>
                  <select
                    value={repriceCategory}
                    onChange={(e) => {
                      setRepriceCategory(e.target.value);
                      setRepricePage(1);
                    }}
                    className="w-full h-9 bg-white border border-slate-300 rounded-lg px-2.5 text-xs font-bold text-slate-800 outline-none cursor-pointer"
                  >
                    <option value="__ALL__">همه دسته‌بندی‌ها ({toPersianDigits(products.length)} کالا)</option>
                    {categories.map((c) => (
                      <option key={c} value={c}>
                        {c} ({toPersianDigits(getCatStat(c).count)} کالا)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">نوع قیمت مورد تغییر</label>
                  {repriceMode === 'margin_from_buy' ? (
                    <div className="w-full h-9 flex items-center bg-emerald-50 border border-emerald-200 rounded-lg px-2.5 text-xs font-bold text-emerald-800">
                      محاسبه فروش از روی خرید
                    </div>
                  ) : (
                    <select
                      value={repriceTarget}
                      onChange={(e) => setRepriceTarget(e.target.value as any)}
                      className="w-full h-9 bg-white border border-slate-300 rounded-lg px-2.5 text-xs font-bold text-slate-800 outline-none cursor-pointer"
                    >
                      <option value="sellPrice">قیمت فروش عادی</option>
                      {canViewBuyPrices && <option value="buyPrice">قیمت خرید</option>}
                      {canViewBuyPrices && <option value="both">هر دو (خرید و فروش)</option>}
                      <option value="wholesalePrice">قیمت فروش همکار / عمده</option>
                    </select>
                  )}
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    {repriceMode === 'margin_from_buy'
                      ? 'درصد سود هدف روی خرید'
                      : repriceMode === 'fixed_amount'
                      ? `مبلغ تغییر (${currency})`
                      : 'درصد تغییر'}
                  </label>
                  <div className="flex items-center gap-1.5">
                    {repriceMode !== 'margin_from_buy' && (
                      <button
                        type="button"
                        onClick={() => setRepriceDirection(repriceDirection === 'increase' ? 'decrease' : 'increase')}
                        className={`h-9 px-2.5 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1 shrink-0 ${
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
                      min={0}
                      step={repriceMode === 'fixed_amount' ? 1000 : 0.5}
                      value={repriceValue}
                      onChange={(e) => setRepriceValue(Math.max(0, Number(e.target.value)))}
                      className="flex-1 min-w-0 h-9 bg-white border border-slate-300 rounded-lg px-2.5 text-xs font-mono tabular-nums font-bold text-slate-800 outline-none"
                    />
                    <span className="text-xs font-bold text-slate-500 shrink-0">
                      {repriceMode === 'fixed_amount' ? currency : '٪'}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">گرد کردن مبالغ نهایی</label>
                  <select
                    value={repriceRounding}
                    onChange={(e) => setRepriceRounding(Number(e.target.value))}
                    className="w-full h-9 bg-white border border-slate-300 rounded-lg px-2.5 text-xs font-bold text-slate-800 outline-none cursor-pointer"
                  >
                    <option value={1}>دقیق (بدون گرد کردن)</option>
                    <option value={100}>گرد به ۱۰۰ {currency}</option>
                    <option value={500}>گرد به ۵۰۰ {currency}</option>
                    <option value={1000}>گرد به ۱,۰۰۰ {currency}</option>
                    <option value={5000}>گرد به ۵,۰۰۰ {currency}</option>
                    <option value={10000}>گرد به ۱۰,۰۰۰ {currency}</option>
                  </select>
                </div>
              </div>

              <div className="pt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-slate-200">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-600 tabular-nums">
                  <span>
                    مشمول تغییر:{' '}
                    <strong className="text-emerald-700 font-black">{toPersianDigits(repriceWillChangeCount)}</strong> از{' '}
                    <strong className="text-slate-900">{toPersianDigits(repricePreviewAllProducts.length)}</strong> کالا
                  </span>
                  {repriceMode !== 'margin_from_buy' && (
                    <label className="inline-flex items-center gap-1.5 cursor-pointer text-[11px] text-slate-600 select-none">
                      <input
                        type="checkbox"
                        checked={includeVariantPrices}
                        onChange={(e) => setIncludeVariantPrices(e.target.checked)}
                        className="w-3.5 h-3.5 rounded text-emerald-600 cursor-pointer"
                      />
                      <span>اعمال روی نرخ اختصاصی تنوع‌ها</span>
                    </label>
                  )}
                </div>

                <button
                  type="button"
                  disabled={isApplyingReprice || repriceWillChangeCount === 0 || repriceValue <= 0}
                  onClick={() => setShowRepriceConfirmModal(true)}
                  className="h-9 px-5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1.5 shrink-0"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isApplyingReprice ? 'animate-spin' : ''}`} />
                  <span>بررسی و اعمال قیمت‌های جدید</span>
                </button>
              </div>
            </div>

            {/* Live Reprice Preview Table */}
            <div className="space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-indigo-600" />
                  <span>پیش‌نمایش زنده تغییرات قیمت</span>
                </span>
                <div className="relative sm:w-60">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={repriceSearch}
                    onChange={(e) => setRepriceSearch(e.target.value)}
                    placeholder="جستجو در پیش‌نمایش..."
                    className="w-full h-8 bg-white border border-slate-200 rounded-lg pr-8 pl-3 text-xs outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
                <div className="overflow-x-auto">
                  <table className="w-full text-right text-xs border-collapse">
                    <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                      <tr>
                        <th className="px-3 py-2.5 font-bold">کد</th>
                        <th className="px-3 py-2.5 font-bold">نام کالا</th>
                        <th className="px-3 py-2.5 font-bold">دسته</th>
                        {showBuyColumn && <th className="px-3 py-2.5 font-bold text-center">خرید (قبلی ← جدید)</th>}
                        {showSellColumn && (
                          <>
                            <th className="px-3 py-2.5 font-bold text-center">فروش قبلی</th>
                            <th className="px-3 py-2.5 font-bold text-center">فروش جدید</th>
                            <th className="px-3 py-2.5 font-bold text-center">تفاوت</th>
                          </>
                        )}
                        {showWholesaleColumn && (
                          <>
                            <th className="px-3 py-2.5 font-bold text-center">همکار قبلی</th>
                            <th className="px-3 py-2.5 font-bold text-center">همکار جدید</th>
                            <th className="px-3 py-2.5 font-bold text-center">تفاوت</th>
                          </>
                        )}
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
                          const sellDiff = p.newSell - p.oldSell;
                          const wholeDiff = p.newWholesale - p.oldWholesale;
                          return (
                            <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                              <td className="px-3 py-2 font-mono tabular-nums text-slate-500 font-semibold">
                                {toPersianDigits(p.code)}
                              </td>
                              <td className="px-3 py-2 font-bold text-slate-900">{p.name}</td>
                              <td className="px-3 py-2 text-slate-500 text-[11px]">{p.category}</td>
                              {showBuyColumn && (
                                <td className="px-3 py-2 text-center font-mono tabular-nums text-slate-600">
                                  {formatPrice(p.oldBuy)}
                                  {p.newBuy !== p.oldBuy && (
                                    <span className="text-indigo-700 font-bold"> ← {formatPrice(p.newBuy)}</span>
                                  )}
                                </td>
                              )}
                              {showSellColumn && (
                                <>
                                  <td className="px-3 py-2 text-center font-mono tabular-nums text-slate-600">
                                    {formatPrice(p.oldSell)}
                                  </td>
                                  <td className="px-3 py-2 text-center font-mono tabular-nums font-bold text-emerald-700">
                                    {formatPrice(p.newSell)}
                                  </td>
                                  <td className="px-3 py-2 text-center font-mono tabular-nums font-bold">
                                    <span
                                      className={
                                        sellDiff > 0
                                          ? 'text-emerald-600'
                                          : sellDiff < 0
                                          ? 'text-rose-600'
                                          : 'text-slate-400'
                                      }
                                    >
                                      {sellDiff > 0 ? '+' : ''}
                                      {formatPrice(sellDiff)}
                                    </span>
                                  </td>
                                </>
                              )}
                              {showWholesaleColumn && (
                                <>
                                  <td className="px-3 py-2 text-center font-mono tabular-nums text-slate-600">
                                    {p.oldWholesale > 0 ? formatPrice(p.oldWholesale) : '—'}
                                  </td>
                                  <td className="px-3 py-2 text-center font-mono tabular-nums font-bold text-indigo-700">
                                    {p.newWholesale > 0 ? formatPrice(p.newWholesale) : '—'}
                                  </td>
                                  <td className="px-3 py-2 text-center font-mono tabular-nums font-bold">
                                    <span
                                      className={
                                        wholeDiff > 0
                                          ? 'text-emerald-600'
                                          : wholeDiff < 0
                                          ? 'text-rose-600'
                                          : 'text-slate-400'
                                      }
                                    >
                                      {wholeDiff > 0 ? '+' : ''}
                                      {formatPrice(wholeDiff)}
                                    </span>
                                  </td>
                                </>
                              )}
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
                <div className="px-3 py-2.5 border-t border-slate-100 bg-slate-50/50">
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

        {/* ===================== TAB 4: ANALYTICS & DATA HEALTH ===================== */}
        {activeTab === 'analytics' && (
          <div className="space-y-4">
            {/* Flat Divided Capital Summary */}
            <div
              className={`border border-slate-200 rounded-xl bg-white grid grid-cols-1 ${
                canViewBuyPrices ? 'sm:grid-cols-4' : 'sm:grid-cols-2'
              } divide-y sm:divide-y-0 sm:divide-x sm:divide-x-reverse divide-slate-200`}
            >
              <div className="p-3.5">
                <div className="text-[11px] text-slate-500 font-semibold">ارزش کل موجودی (فروش)</div>
                <div className="text-base font-black text-emerald-700 mt-1 font-mono tabular-nums">
                  {formatPrice(totalAllValue)}{' '}
                  <span className="text-[11px] font-sans font-normal text-slate-500">{currency}</span>
                </div>
              </div>

              {canViewBuyPrices && (
                <>
                  <div className="p-3.5">
                    <div className="text-[11px] text-slate-500 font-semibold">بهای تمام‌شده (خرید)</div>
                    <div className="text-base font-black text-slate-900 mt-1 font-mono tabular-nums">
                      {formatPrice(totalAllPurchaseValue)}{' '}
                      <span className="text-[11px] font-sans font-normal text-slate-500">{currency}</span>
                    </div>
                  </div>

                  <div className="p-3.5">
                    <div className="text-[11px] text-slate-500 font-semibold">سود ناخالص نهفته</div>
                    <div className="text-base font-black text-indigo-700 mt-1 font-mono tabular-nums">
                      {formatPrice(Math.max(0, totalAllValue - totalAllPurchaseValue))}{' '}
                      <span className="text-[11px] font-sans font-normal text-slate-500">{currency}</span>
                    </div>
                  </div>
                </>
              )}

              <div className="p-3.5">
                <div className="text-[11px] text-slate-500 font-semibold">نیازمند شارژ یا قیمت‌گذاری</div>
                <div className="text-base font-black text-amber-700 mt-1 font-mono tabular-nums">
                  {toPersianDigits(
                    healthMetrics.outOfStockProductsCount +
                      healthMetrics.lowStockProductsCount +
                      healthMetrics.zeroSellPriceCount
                  )}{' '}
                  <span className="text-[11px] font-sans font-normal text-slate-500">مورد</span>
                </div>
              </div>
            </div>

            {/* Flat Health Checklist Bar (no card sandwiches) */}
            <div className="border border-slate-200 rounded-xl bg-white overflow-hidden">
              <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4 text-indigo-600" />
                <span className="text-xs font-bold text-slate-800">پایش سلامت شناسنامه کالاها</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x sm:divide-x-reverse divide-slate-200">
                <div className="px-4 py-3 flex items-center justify-between gap-2">
                  <div>
                    <div className="text-[11px] text-slate-500 font-medium">بدون قیمت فروش</div>
                    <div className="text-sm font-black font-mono tabular-nums text-slate-900 mt-0.5">
                      {toPersianDigits(healthMetrics.zeroSellPriceCount)} کالا
                    </div>
                  </div>
                  {healthMetrics.zeroSellPriceCount > 0 && (
                    <button
                      type="button"
                      onClick={() => jumpToProductsFilter('all', 'zero_price')}
                      className="text-[11px] font-bold text-indigo-600 hover:underline cursor-pointer"
                    >
                      اصلاح
                    </button>
                  )}
                </div>

                {canViewBuyPrices && (
                  <div className="px-4 py-3 flex items-center justify-between gap-2">
                    <div>
                      <div className="text-[11px] text-slate-500 font-medium">فروش زیر خرید</div>
                      <div className="text-sm font-black font-mono tabular-nums text-rose-600 mt-0.5">
                        {toPersianDigits(healthMetrics.underCostCount)} کالا
                      </div>
                    </div>
                    {healthMetrics.underCostCount > 0 && (
                      <button
                        type="button"
                        onClick={() => jumpToProductsFilter('all', 'under_cost')}
                        className="text-[11px] font-bold text-rose-600 hover:underline cursor-pointer"
                      >
                        بررسی
                      </button>
                    )}
                  </div>
                )}

                <div className="px-4 py-3 flex items-center justify-between gap-2">
                  <div>
                    <div className="text-[11px] text-slate-500 font-medium">کالاهای ناموجود</div>
                    <div className="text-sm font-black font-mono tabular-nums text-amber-600 mt-0.5">
                      {toPersianDigits(healthMetrics.outOfStockProductsCount)} کالا
                    </div>
                  </div>
                  {healthMetrics.outOfStockProductsCount > 0 && (
                    <button
                      type="button"
                      onClick={() => jumpToProductsFilter('all', 'out_of_stock')}
                      className="text-[11px] font-bold text-amber-700 hover:underline cursor-pointer"
                    >
                      مشاهده
                    </button>
                  )}
                </div>

                <div className="px-4 py-3 flex items-center justify-between gap-2">
                  <div>
                    <div className="text-[11px] text-slate-500 font-medium">دسته‌های بدون کالا</div>
                    <div className="text-sm font-black font-mono tabular-nums text-slate-900 mt-0.5">
                      {toPersianDigits(healthMetrics.emptyCategoriesCount)} دسته
                    </div>
                  </div>
                  {canManage && healthMetrics.emptyCategoriesCount > 0 && (
                    <button
                      type="button"
                      onClick={handleCleanupEmptyCategories}
                      className="text-[11px] font-bold text-rose-600 hover:underline cursor-pointer"
                    >
                      پاکسازی
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Breakdown Table */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700">
                  تفکیک سهم، موجودی و ارزش به تفکیک دسته‌بندی
                </span>
                <button
                  type="button"
                  onClick={handleExportAnalyticsToCsv}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>خروجی اکسل</span>
                </button>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
                <div className="overflow-x-auto">
                  <table className="w-full text-right text-xs border-collapse">
                    <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                      <tr>
                        <th className="px-3 py-2.5 font-bold">دسته‌بندی</th>
                        <th className="px-3 py-2.5 font-bold text-center">تعداد کالا</th>
                        <th className="px-3 py-2.5 font-bold text-center">موجودی</th>
                        <th className="px-3 py-2.5 font-bold text-center">سهم انبار</th>
                        <th className="px-3 py-2.5 font-bold text-center">ارزش فروش ({currency})</th>
                        {canViewBuyPrices && <th className="px-3 py-2.5 font-bold text-center">ارزش خرید</th>}
                        {canViewBuyPrices && <th className="px-3 py-2.5 font-bold text-center">سود ناخالص</th>}
                        <th className="px-3 py-2.5 font-bold text-center">وضعیت</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {categories.map((cat) => {
                        const stat = getCatStat(cat);
                        const percentage = totalAllStock > 0 ? Math.round((stat.totalStock / totalAllStock) * 100) : 0;
                        const profit = stat.totalInventoryValue - stat.totalPurchaseValue;

                        return (
                          <tr key={cat} className="hover:bg-slate-50/70 transition-colors">
                            <td className="px-3 py-2.5 font-bold text-slate-900">
                              <button
                                type="button"
                                onClick={() => jumpToProductsFilter(cat, 'all')}
                                className="hover:text-indigo-600 hover:underline cursor-pointer text-right"
                              >
                                {cat}
                              </button>
                            </td>
                            <td className="px-3 py-2.5 text-center font-mono tabular-nums font-bold text-slate-700">
                              {toPersianDigits(stat.count)}
                            </td>
                            <td className="px-3 py-2.5 text-center font-mono tabular-nums font-bold text-slate-800">
                              {toPersianDigits(stat.totalStock)}
                            </td>
                            <td className="px-3 py-2.5 text-center">
                              <div className="flex items-center justify-center gap-2">
                                <div className="w-14 bg-slate-200 rounded-full h-1.5 overflow-hidden hidden sm:block">
                                  <div
                                    className="bg-indigo-600 h-1.5 rounded-full"
                                    style={{ width: `${Math.min(100, percentage)}%` }}
                                  />
                                </div>
                                <span className="font-mono tabular-nums text-slate-600 font-bold">
                                  {toPersianDigits(percentage)}٪
                                </span>
                              </div>
                            </td>
                            <td className="px-3 py-2.5 text-center font-mono tabular-nums font-bold text-emerald-700">
                              {formatPrice(stat.totalInventoryValue)}
                            </td>
                            {canViewBuyPrices && (
                              <td className="px-3 py-2.5 text-center font-mono tabular-nums text-slate-600">
                                {formatPrice(stat.totalPurchaseValue)}
                              </td>
                            )}
                            {canViewBuyPrices && (
                              <td className="px-3 py-2.5 text-center font-mono tabular-nums font-bold text-indigo-700">
                                {formatPrice(profit)}
                              </td>
                            )}
                            <td className="px-3 py-2.5 text-center tabular-nums">
                              {stat.outOfStockCount > 0 ? (
                                <span className="text-rose-600 font-bold text-[11px]">
                                  {toPersianDigits(stat.outOfStockCount)} ناموجود
                                </span>
                              ) : stat.lowStockCount > 0 ? (
                                <span className="text-amber-600 font-bold text-[11px]">
                                  {toPersianDigits(stat.lowStockCount)} کمبود
                                </span>
                              ) : (
                                <span className="text-emerald-600 font-semibold text-[11px]">مطلوب</span>
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

      {/* Modal Footer */}
      {!embedded && (
        <div className="shrink-0 bg-slate-50 border-t border-slate-200 px-5 py-3 flex items-center justify-between">
          <span className="text-[11px] text-slate-500">
            تغییرات به‌صورت آنی در انبار، فاکتورها و گزارش‌ها ذخیره می‌شوند.
          </span>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 text-xs font-bold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
            >
              بستن
            </button>
          )}
        </div>
      )}

      {/* ===================== MODAL 1: QUICK ADD / EDIT PRODUCT ===================== */}
      {quickProductModal && canManage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden">
            <div className="bg-slate-50 border-b border-slate-200 px-5 py-3.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-emerald-600" />
                <h4 className="font-black text-sm text-slate-900">
                  {quickProductModal.id ? 'ویرایش سریع مشخصات کالا' : 'تعریف سریع کالای جدید'}
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setQuickProductModal(null)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveQuickProduct} className="p-5 space-y-3.5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block font-bold text-slate-700 mb-1">نام کالا *</label>
                  <input
                    type="text"
                    required
                    value={quickProductModal.name}
                    onChange={(e) => setQuickProductModal({ ...quickProductModal, name: e.target.value })}
                    placeholder="مثلاً: پمپ آب صنعتی ۲ اسب"
                    className="w-full h-9 bg-white border border-slate-300 rounded-lg px-3 font-bold text-slate-900 outline-none focus:border-indigo-500"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">کد کالا</label>
                  <input
                    type="text"
                    value={quickProductModal.code}
                    onChange={(e) => setQuickProductModal({ ...quickProductModal, code: e.target.value })}
                    placeholder="تولید خودکار"
                    dir="ltr"
                    className="w-full h-9 bg-white border border-slate-300 rounded-lg px-3 font-mono text-center text-slate-800 outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">دسته‌بندی</label>
                  <select
                    value={quickProductModal.category}
                    onChange={(e) => setQuickProductModal({ ...quickProductModal, category: e.target.value })}
                    className="w-full h-9 bg-white border border-slate-300 rounded-lg px-2.5 font-bold text-slate-800 outline-none cursor-pointer"
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
                    className="w-full h-9 bg-white border border-slate-300 rounded-lg px-2.5 font-bold text-slate-800 outline-none cursor-pointer"
                  >
                    {quickModalUnitOptions.map((u) => (
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
                    <NumericInput
                      min={0}
                      value={quickProductModal.buyPrice}
                      onChange={(num) => setQuickProductModal({ ...quickProductModal, buyPrice: num })}
                      currency={currency}
                      className="w-full h-9 bg-white border border-slate-300 rounded-lg px-2.5 font-mono tabular-nums font-bold text-slate-800 outline-none focus:border-indigo-500"
                    />
                  </div>
                )}
                <div>
                  <label className="block font-bold text-emerald-700 mb-1">قیمت فروش ({currency})</label>
                  <NumericInput
                    min={0}
                    value={quickProductModal.sellPrice}
                    onChange={(num) => setQuickProductModal({ ...quickProductModal, sellPrice: num })}
                    currency={currency}
                    className="w-full h-9 bg-emerald-50/40 border border-emerald-300 rounded-lg px-2.5 font-mono tabular-nums font-bold text-emerald-900 outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">قیمت همکار ({currency})</label>
                  <NumericInput
                    min={0}
                    value={quickProductModal.wholesalePrice}
                    onChange={(num) => setQuickProductModal({ ...quickProductModal, wholesalePrice: num })}
                    currency={currency}
                    className="w-full h-9 bg-white border border-slate-300 rounded-lg px-2.5 font-mono tabular-nums font-bold text-slate-800 outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">موجودی فعلی</label>
                  {quickProductModal.hasVariants ? (
                    <div className="h-9 bg-slate-100 border border-slate-200 rounded-lg px-3 flex items-center justify-between text-slate-600 font-mono tabular-nums">
                      <span className="font-bold">{toPersianDigits(quickProductModal.stock)}</span>
                      <span className="text-[10px] font-sans">مجموع {toPersianDigits(quickProductModal.variantCount)} تنوع</span>
                    </div>
                  ) : (
                    <NumericInput
                      min={0}
                      value={quickProductModal.stock}
                      onChange={(num) => setQuickProductModal({ ...quickProductModal, stock: num })}
                      textAlign="center"
                      className="w-full h-9 bg-white border border-slate-300 rounded-lg px-3 font-mono tabular-nums font-bold text-slate-800 outline-none focus:border-indigo-500 text-center"
                    />
                  )}
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">حداقل موجودی هشدار</label>
                  <NumericInput
                    min={0}
                    value={quickProductModal.minStockAlert}
                    onChange={(num) => setQuickProductModal({ ...quickProductModal, minStockAlert: num })}
                    textAlign="center"
                    className="w-full h-9 bg-white border border-slate-300 rounded-lg px-3 font-mono tabular-nums font-bold text-slate-800 outline-none focus:border-indigo-500 text-center"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setQuickProductModal(null)}
                  className="h-9 px-4 rounded-lg border border-slate-300 text-slate-600 font-bold hover:bg-slate-100 cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="h-9 px-5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>ذخیره کالا</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================== MODAL 2: CONFIRM DELETE PRODUCT ===================== */}
      {deletingProductTarget && canManage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl border border-rose-200 w-full max-w-md p-5 space-y-4">
            <div className="flex items-center gap-2 text-rose-700 font-black text-sm">
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
              <span>تایید حذف کالا</span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              آیا از حذف کالای <strong>«{deletingProductTarget.name}»</strong> (کد:{' '}
              {toPersianDigits(deletingProductTarget.code)}) اطمینان دارید؟
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingProductTarget(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
              >
                انصراف
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteProduct}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg cursor-pointer"
              >
                حذف قطعی
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================== MODAL 3: CONFIRM BATCH REPRICE ===================== */}
      {showRepriceConfirmModal && canManage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl border border-emerald-200 w-full max-w-md p-5 space-y-4">
            <div className="flex items-center gap-2 text-emerald-800 font-black text-sm">
              <Percent className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>تایید نهایی تعدیل قیمت‌ها</span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              تغییرات قیمت روی{' '}
              <strong className="text-slate-900">{toPersianDigits(repriceWillChangeCount)} قلم کالا</strong> در{' '}
              <strong>{repriceCategory === '__ALL__' ? 'همه دسته‌بندی‌ها' : `دسته «${repriceCategory}»`}</strong> اعمال شده و در تاریخچه قیمت هر کالا ثبت خواهد شد.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowRepriceConfirmModal(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
              >
                انصراف
              </button>
              <button
                type="button"
                onClick={handleExecuteBatchReprice}
                disabled={isApplyingReprice}
                className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg cursor-pointer"
              >
                تایید و اعمال
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  if (embedded) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        {contentBody}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden">
        {contentBody}
      </div>
    </div>
  );
};
