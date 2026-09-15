import React, { useState } from 'react';
import { Product, ProductVariant, StockMovement, StoreSettings, AppUser, Invoice, ExitSlipData, InboundReceipt, InboundReceiptItem } from '../types';
import { toPersianDigits, getCurrentJalaliDate, formatPrice } from '../utils/jalali';
import { StorageService } from '../utils/storage';
import { exportProductsToExcel } from '../utils/excelHelper';
import { ExcelImportModal } from './ExcelImportModal';
import { ExitSlipModal } from './ExitSlipModal';
import { InboundReceiptsList } from './InboundReceiptsList';
import { 
  Plus, 
  Search, 
  AlertTriangle, 
  ArrowDownRight, 
  ArrowUpLeft, 
  Edit3, 
  Trash2, 
  History, 
  PackageCheck,
  Boxes,
  Filter,
  CheckCircle2,
  X,
  Printer,
  FileText,
  Clock,
  Truck,
  AlertCircle,
  Eye,
  Check,
  Layers,
  FileSpreadsheet,
  Download,
  Upload,
  Sparkles
} from 'lucide-react';

interface InventoryManagerProps {
  products: Product[];
  movements: StockMovement[];
  invoices?: Invoice[];
  inboundReceipts?: InboundReceipt[];
  settings: StoreSettings;
  currentUser?: AppUser;
  onSaveProduct: (product: Product) => void;
  onDeleteProduct: (productId: string) => void;
  onAdjustStock: (
    productId: string, 
    type: 'purchase' | 'adjustment' | 'return', 
    quantity: number, 
    note: string,
    variantId?: string
  ) => void;
  onImportProducts?: (products: Product[], mode: 'merge' | 'replace') => void;
  onConfirmInboundReceipt?: (
    receiptId: string,
    verifiedItems: InboundReceiptItem[],
    warehouseNotes: string,
    verifiedBy: string
  ) => void;
  selectedInboundReceiptId?: string | null;
  onUpdateSettings?: (newSettings: StoreSettings) => void;
}

export const InventoryManager: React.FC<InventoryManagerProps> = ({
  products,
  movements,
  invoices = [],
  inboundReceipts = [],
  settings,
  currentUser,
  onSaveProduct,
  onDeleteProduct,
  onAdjustStock,
  onImportProducts,
  onConfirmInboundReceipt,
  selectedInboundReceiptId,
  onUpdateSettings,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'items' | 'inbound-receipts' | 'exit-slips' | 'movements'>(() => {
    if (selectedInboundReceiptId) return 'inbound-receipts';
    return 'items';
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [stockStatusFilter, setStockStatusFilter] = useState<'all' | 'in_stock' | 'low_stock' | 'out_of_stock'>('all');

  // Exit Slips State
  const [exitSlipLogs, setExitSlipLogs] = useState<Record<string, ExitSlipData>>(() => StorageService.getExitSlipLogs());
  const [selectedExitSlipInvoice, setSelectedExitSlipInvoice] = useState<Invoice | null>(null);
  const [historyModalInvoice, setHistoryModalInvoice] = useState<Invoice | null>(null);
  const [exitSlipSearch, setExitSlipSearch] = useState('');
  const [exitSlipFilter, setExitSlipFilter] = useState<'all' | 'unprinted' | 'printed'>('all');

  // Modal states
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  
  // Excel Import Modal State
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  // Stock Adjustment Modal
  const [adjustingProduct, setAdjustingProduct] = useState<Product | null>(null);
  const [adjustType, setAdjustType] = useState<'purchase' | 'adjustment'>('purchase');
  const [adjustQuantity, setAdjustQuantity] = useState<number>(1);
  const [selectedVariantId, setSelectedVariantId] = useState<string>('');
  const [adjustNote, setAdjustNote] = useState<string>('');

  // Delete Confirmation Modal
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);

  // Categories list
  const categories = Array.from(new Set(products.map((p) => p.category).filter(Boolean)));

  // Filtered products
  const filteredProducts = products.filter((p) => {
    const matchesSearch = 
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.variants && p.variants.some((v) => v.name.toLowerCase().includes(searchQuery.toLowerCase()) || (v.code && v.code.toLowerCase().includes(searchQuery.toLowerCase())))) ||
      (p.description && p.description.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesCategory = selectedCategory === 'all' || p.category === selectedCategory;

    let matchesStock = true;
    if (stockStatusFilter === 'out_of_stock') {
      matchesStock = p.stock === 0;
    } else if (stockStatusFilter === 'low_stock') {
      matchesStock = p.stock > 0 && p.stock <= p.minStockAlert;
    } else if (stockStatusFilter === 'in_stock') {
      matchesStock = p.stock > p.minStockAlert;
    }

    return matchesSearch && matchesCategory && matchesStock;
  });

  // Open New Product Modal
  const handleOpenNewProduct = () => {
    setEditingProduct({
      id: '',
      code: `${1000 + products.length + 1}`,
      name: '',
      category: 'عمومی',
      unit: 'عدد',
      buyPrice: 0,
      sellPrice: 0,
      stock: 0,
      minStockAlert: 5,
      description: '',
      updatedAt: getCurrentJalaliDate(),
      hasVariants: false,
      variants: [],
    });
    setIsProductModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEditProduct = (prod: Product) => {
    setEditingProduct({
      ...prod,
      hasVariants: !!prod.hasVariants,
      variants: prod.variants ? [...prod.variants] : [],
    });
    setIsProductModalOpen(true);
  };

  // Variant helper functions for Product Modal
  const handleToggleHasVariants = (enabled: boolean) => {
    if (!editingProduct) return;
    if (enabled && (!editingProduct.variants || editingProduct.variants.length === 0)) {
      const defaultVariant: ProductVariant = {
        id: `var-${Date.now()}-1`,
        name: 'طوسی',
        code: `${editingProduct.code || '1000'}-GR`,
        stock: editingProduct.stock || 0,
        buyPrice: editingProduct.buyPrice || 0,
        sellPrice: editingProduct.sellPrice || 0,
      };
      setEditingProduct({
        ...editingProduct,
        hasVariants: true,
        variants: [defaultVariant],
      });
    } else {
      setEditingProduct({
        ...editingProduct,
        hasVariants: enabled,
      });
    }
  };

  const handleAddQuickVariant = (variantName: string) => {
    if (!editingProduct) return;
    const currentVariants = editingProduct.variants || [];
    if (currentVariants.some((v) => v.name.trim().toLowerCase() === variantName.trim().toLowerCase())) {
      return;
    }
    const newVariant: ProductVariant = {
      id: `var-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
      name: variantName,
      code: `${editingProduct.code || '1000'}-${variantName}`,
      stock: 0,
      buyPrice: editingProduct.buyPrice || 0,
      sellPrice: editingProduct.sellPrice || 0,
    };
    const nextList = [...currentVariants, newVariant];
    const totalStock = nextList.reduce((sum, v) => sum + (Number(v.stock) || 0), 0);
    setEditingProduct({
      ...editingProduct,
      hasVariants: true,
      variants: nextList,
      stock: totalStock,
    });
  };

  const handleUpdateVariantField = (varId: string, field: keyof ProductVariant, value: any) => {
    if (!editingProduct || !editingProduct.variants) return;
    const nextVariants = editingProduct.variants.map((v) => {
      if (v.id === varId) {
        return { ...v, [field]: value };
      }
      return v;
    });
    const totalStock = nextVariants.reduce((sum, v) => sum + (Number(v.stock) || 0), 0);
    setEditingProduct({
      ...editingProduct,
      variants: nextVariants,
      stock: totalStock,
    });
  };

  const handleRemoveVariant = (varId: string) => {
    if (!editingProduct || !editingProduct.variants) return;
    const nextVariants = editingProduct.variants.filter((v) => v.id !== varId);
    const totalStock = nextVariants.reduce((sum, v) => sum + (Number(v.stock) || 0), 0);
    setEditingProduct({
      ...editingProduct,
      variants: nextVariants,
      hasVariants: nextVariants.length > 0,
      stock: totalStock,
    });
  };

  // Save Product Form
  const handleSaveProductForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct || !editingProduct.name.trim()) return;

    const hasVars = !!editingProduct.hasVariants && (editingProduct.variants?.length || 0) > 0;
    const cleanVariants = hasVars 
      ? (editingProduct.variants || []).filter((v) => v.name && v.name.trim().length > 0)
      : [];
    const totalStock = hasVars && cleanVariants.length > 0
      ? cleanVariants.reduce((sum, v) => sum + (Number(v.stock) || 0), 0)
      : Math.max(0, Number(editingProduct.stock) || 0);

    const saved: Product = {
      ...editingProduct,
      id: editingProduct.id || `prod-${Date.now()}`,
      name: editingProduct.name.trim(),
      code: editingProduct.code.trim() || `P-${Date.now().toString().slice(-4)}`,
      buyPrice: Math.max(0, Number(editingProduct.buyPrice) || 0),
      sellPrice: Math.max(0, Number(editingProduct.sellPrice) || 0),
      stock: totalStock,
      minStockAlert: Math.max(0, Number(editingProduct.minStockAlert) || 0),
      updatedAt: getCurrentJalaliDate(),
      hasVariants: hasVars,
      variants: cleanVariants,
    };

    onSaveProduct(saved);
    setIsProductModalOpen(false);
    setEditingProduct(null);
  };

  // Open Adjust Modal
  const handleOpenAdjustStock = (prod: Product, type: 'purchase' | 'adjustment') => {
    setAdjustingProduct(prod);
    setAdjustType(type);
    setAdjustQuantity(1);
    setSelectedVariantId(prod.hasVariants && prod.variants && prod.variants.length > 0 ? prod.variants[0].id : '');
    setAdjustNote(type === 'purchase' ? 'ورود کالای جدید به انبار (خرید)' : 'تعدیل و انبارگردانی');
  };

  // Submit Stock Adjustment
  const handleSubmitStockAdjust = (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustingProduct || adjustQuantity <= 0) return;

    onAdjustStock(adjustingProduct.id, adjustType, adjustQuantity, adjustNote, selectedVariantId || undefined);
    setAdjustingProduct(null);
  };

  // Quick stats
  const totalItemsCount = products.length;
  const lowStockCount = products.filter((p) => p.stock > 0 && p.stock <= p.minStockAlert).length;
  const outOfStockCount = products.filter((p) => p.stock === 0).length;
  const totalStockUnits = products.reduce((sum, p) => sum + p.stock, 0);

  // Exit slip stats & filters
  const unprintedSlipsCount = invoices.filter(
    (inv) => !exitSlipLogs[inv.id] || exitSlipLogs[inv.id].printCount === 0
  ).length;
  const printedSlipsCount = invoices.length - unprintedSlipsCount;
  const totalDispatchedUnits = invoices.reduce(
    (sum, inv) => sum + inv.items.reduce((s, it) => s + it.quantity, 0),
    0
  );

  const pendingInboundCount = inboundReceipts.filter(
    (r) => r.status === 'pending_verification'
  ).length;

  const handleRecordExitSlipPrint = (invoiceId: string) => {
    const updated = StorageService.recordExitSlipPrint(
      invoiceId,
      currentUser?.fullName || 'انباردار'
    );
    setExitSlipLogs((prev) => ({
      ...prev,
      [invoiceId]: updated,
    }));
  };

  const filteredExitSlips = invoices.filter((inv) => {
    const log = exitSlipLogs[inv.id] || { printCount: 0 };
    if (exitSlipFilter === 'unprinted' && log.printCount > 0) return false;
    if (exitSlipFilter === 'printed' && log.printCount === 0) return false;

    if (exitSlipSearch.trim()) {
      const q = exitSlipSearch.toLowerCase();
      const matchesNum = inv.invoiceNumber.toLowerCase().includes(q);
      const matchesCust = inv.customerName.toLowerCase().includes(q);
      const matchesItem = inv.items.some((it) => it.productName.toLowerCase().includes(q));
      return matchesNum || matchesCust || matchesItem;
    }
    return true;
  });

  return (
    <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6 pb-12">
      {/* MOBILE-FIRST DEDICATED WAREHOUSE NAVIGATION BAR (STICKY BELOW MAIN HEADER) */}
      <div className="sm:hidden sticky top-16 z-20 bg-slate-100 pb-2 pt-1.5 -mx-3 px-3 border-b border-slate-200/90 shadow-xs">
        {/* 4 Ergonomic Mobile Touch Tabs */}
        <div className="grid grid-cols-4 gap-1.5 p-1 bg-white rounded-2xl border border-slate-200 shadow-xs">
          {/* Tab 1: کالاها و موجودی */}
          <button
            type="button"
            id="mobile-tab-items"
            onClick={() => setActiveSubTab('items')}
            className={`flex flex-col items-center justify-center py-2 px-1 rounded-xl transition-all active:scale-95 cursor-pointer relative ${
              activeSubTab === 'items'
                ? 'bg-blue-600 text-white shadow-xs font-bold'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 font-medium'
            }`}
          >
            <div className="relative">
              <PackageCheck className="w-5 h-5" />
              {lowStockCount > 0 && (
                <span className={`absolute -top-1.5 -right-2 text-[9px] font-bold px-1 py-0.2 rounded-full ${
                  activeSubTab === 'items' ? 'bg-amber-400 text-amber-950' : 'bg-amber-500 text-white'
                }`}>
                  {toPersianDigits(lowStockCount)}
                </span>
              )}
            </div>
            <span className="text-[11px] mt-0.5 whitespace-nowrap">کالاها</span>
            <span className={`text-[9px] ${activeSubTab === 'items' ? 'text-blue-100' : 'text-slate-400'}`}>
              ({toPersianDigits(products.length)})
            </span>
          </button>

          {/* Tab 2: حواله ورود کالا */}
          <button
            type="button"
            id="mobile-tab-inbound"
            onClick={() => setActiveSubTab('inbound-receipts')}
            className={`flex flex-col items-center justify-center py-2 px-1 rounded-xl transition-all active:scale-95 cursor-pointer relative ${
              activeSubTab === 'inbound-receipts'
                ? 'bg-emerald-600 text-white shadow-xs font-bold'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 font-medium'
            }`}
          >
            <div className="relative">
              <ArrowDownRight className="w-5 h-5" />
              {pendingInboundCount > 0 && (
                <span className="absolute -top-1.5 -right-2 bg-rose-500 text-white text-[9px] font-bold px-1 py-0.2 rounded-full animate-pulse shadow-xs">
                  {toPersianDigits(pendingInboundCount)}
                </span>
              )}
            </div>
            <span className="text-[11px] mt-0.5 whitespace-nowrap">حواله ورود</span>
            <span className={`text-[9px] ${activeSubTab === 'inbound-receipts' ? 'text-emerald-100' : 'text-slate-400'}`}>
              ({toPersianDigits(inboundReceipts.length)})
            </span>
          </button>

          {/* Tab 3: برگه خروج انبار */}
          <button
            type="button"
            id="mobile-tab-exit-slips"
            onClick={() => setActiveSubTab('exit-slips')}
            className={`flex flex-col items-center justify-center py-2 px-1 rounded-xl transition-all active:scale-95 cursor-pointer relative ${
              activeSubTab === 'exit-slips'
                ? 'bg-indigo-600 text-white shadow-xs font-bold'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 font-medium'
            }`}
          >
            <div className="relative">
              <Truck className="w-5 h-5" />
              {unprintedSlipsCount > 0 && (
                <span className="absolute -top-1.5 -right-2 bg-amber-500 text-white text-[9px] font-bold px-1 py-0.2 rounded-full shadow-xs">
                  {toPersianDigits(unprintedSlipsCount)}
                </span>
              )}
            </div>
            <span className="text-[11px] mt-0.5 whitespace-nowrap">برگه خروج</span>
            <span className={`text-[9px] ${activeSubTab === 'exit-slips' ? 'text-indigo-100' : 'text-slate-400'}`}>
              ({toPersianDigits(invoices.length)})
            </span>
          </button>

          {/* Tab 4: گردش و کاردکس */}
          <button
            type="button"
            id="mobile-tab-movements"
            onClick={() => setActiveSubTab('movements')}
            className={`flex flex-col items-center justify-center py-2 px-1 rounded-xl transition-all active:scale-95 cursor-pointer relative ${
              activeSubTab === 'movements'
                ? 'bg-slate-800 text-white shadow-xs font-bold'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 font-medium'
            }`}
          >
            <History className="w-5 h-5" />
            <span className="text-[11px] mt-0.5 whitespace-nowrap">کاردکس</span>
            <span className={`text-[9px] ${activeSubTab === 'movements' ? 'text-slate-300' : 'text-slate-400'}`}>
              گردش
            </span>
          </button>
        </div>
      </div>

      {/* Quick Action & Active Tab Title for Mobile (In Page Flow) */}
      <div className="sm:hidden flex items-center justify-between gap-2 px-1 -mt-1">
        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 truncate">
          <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
          <span className="truncate">
            {activeSubTab === 'items' && 'کالاها و موجودی انبار'}
            {activeSubTab === 'inbound-receipts' && 'حواله‌های ورود و رسید انبار'}
            {activeSubTab === 'exit-slips' && 'برگه‌های خروج و تحویل انبار'}
            {activeSubTab === 'movements' && 'کاردکس و تاریخچه گردش کالا'}
          </span>
        </div>

        <button
          type="button"
          id="mobile-quick-add-product-btn"
          onClick={handleOpenNewProduct}
          className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-xs shrink-0 cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>کالای جدید</span>
        </button>
      </div>

      {/* Top Header Card (Desktop & Tablet) */}
      <div className="hidden sm:flex flex-col xl:flex-row xl:items-center justify-between gap-4 xl:gap-6 bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-blue-50 text-blue-700 shrink-0">
              <PackageCheck className="w-5 h-5" />
            </span>
            <h2 className="text-xl font-bold text-slate-800">مدیریت انبار و موجودی کالاها</h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            کنترل لحظه‌ای موجودی، برگه‌های خروج انبارداری (حواله تحویل)، رسید ورود و تاریخچه گردش کالا
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Sub Tab Switcher */}
          <div className="flex flex-wrap items-center bg-slate-100/90 p-1.5 rounded-2xl border border-slate-200/90 gap-1.5 shadow-2xs">
            {/* Tab 1: کالاها و موجودی */}
            <button
              id="subtab-items"
              onClick={() => setActiveSubTab('items')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm transition-all cursor-pointer whitespace-nowrap ${
                activeSubTab === 'items'
                  ? 'bg-white text-slate-900 shadow-xs ring-1 ring-slate-900/5 font-extrabold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60 font-semibold'
              }`}
            >
              <Boxes className={`w-4 h-4 shrink-0 transition-colors ${activeSubTab === 'items' ? 'text-blue-600' : 'text-slate-400'}`} />
              <span>کالاها و موجودی</span>
              <span
                className={`text-[11px] font-bold px-2 py-0.5 rounded-full transition-colors ${
                  activeSubTab === 'items'
                    ? 'bg-blue-50 text-blue-700 ring-1 ring-blue-500/20'
                    : 'bg-slate-200/80 text-slate-600'
                }`}
              >
                {toPersianDigits(products.length)}
              </span>
              {lowStockCount > 0 && (
                <span className="bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full shadow-2xs">
                  {toPersianDigits(lowStockCount)} کسری
                </span>
              )}
            </button>

            {/* Tab 2: حواله‌های ورود کالا */}
            <button
              id="subtab-inbound-receipts"
              onClick={() => setActiveSubTab('inbound-receipts')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm transition-all cursor-pointer whitespace-nowrap ${
                activeSubTab === 'inbound-receipts'
                  ? 'bg-white text-slate-900 shadow-xs ring-1 ring-slate-900/5 font-extrabold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60 font-semibold'
              }`}
            >
              <ArrowDownRight className={`w-4 h-4 shrink-0 transition-colors ${activeSubTab === 'inbound-receipts' ? 'text-emerald-600' : 'text-slate-400'}`} />
              <span>حواله‌های ورود کالا</span>
              <span
                className={`text-[11px] font-bold px-2 py-0.5 rounded-full transition-colors ${
                  activeSubTab === 'inbound-receipts'
                    ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-500/20'
                    : 'bg-slate-200/80 text-slate-600'
                }`}
              >
                {toPersianDigits(inboundReceipts.length)}
              </span>
              {pendingInboundCount > 0 && (
                <span className="bg-rose-500 text-white text-[10px] font-extrabold px-2 py-0.5 rounded-full animate-pulse shadow-xs">
                  {toPersianDigits(pendingInboundCount)} منتظر تایید
                </span>
              )}
            </button>

            {/* Tab 3: برگه‌های خروج انبار */}
            <button
              id="subtab-exit-slips"
              onClick={() => setActiveSubTab('exit-slips')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm transition-all cursor-pointer whitespace-nowrap ${
                activeSubTab === 'exit-slips'
                  ? 'bg-white text-slate-900 shadow-xs ring-1 ring-slate-900/5 font-extrabold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60 font-semibold'
              }`}
            >
              <Truck className={`w-4 h-4 shrink-0 transition-colors ${activeSubTab === 'exit-slips' ? 'text-indigo-600' : 'text-slate-400'}`} />
              <span>برگه‌های خروج انبار</span>
              <span
                className={`text-[11px] font-bold px-2 py-0.5 rounded-full transition-colors ${
                  activeSubTab === 'exit-slips'
                    ? 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-500/20'
                    : 'bg-slate-200/80 text-slate-600'
                }`}
              >
                {toPersianDigits(invoices.length)}
              </span>
              {unprintedSlipsCount > 0 && (
                <span className="bg-amber-500 text-white text-[10px] font-extrabold px-2 py-0.5 rounded-full shadow-xs">
                  {toPersianDigits(unprintedSlipsCount)} جدید
                </span>
              )}
            </button>

            {/* Tab 4: گردش و کاردکس */}
            <button
              id="subtab-movements"
              onClick={() => setActiveSubTab('movements')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm transition-all cursor-pointer whitespace-nowrap ${
                activeSubTab === 'movements'
                  ? 'bg-white text-slate-900 shadow-xs ring-1 ring-slate-900/5 font-extrabold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60 font-semibold'
              }`}
            >
              <History className={`w-4 h-4 shrink-0 transition-colors ${activeSubTab === 'movements' ? 'text-purple-600' : 'text-slate-400'}`} />
              <span>گردش و کاردکس</span>
            </button>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Excel Export */}
            <button
              type="button"
              id="export-inventory-excel-btn"
              onClick={() => exportProductsToExcel(products)}
              title="خروجی فایل اکسل از همه کالاها و تنوع‌ها"
              className="flex items-center gap-1.5 bg-white hover:bg-slate-50 active:scale-95 text-slate-700 border border-slate-300 px-3 py-2 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span className="hidden sm:inline">خروجی اکسل</span>
            </button>

            {/* Excel Import */}
            <button
              type="button"
              id="import-inventory-excel-btn"
              onClick={() => setIsImportModalOpen(true)}
              title="ورود کالاها و تنوع‌ها از فایل اکسل"
              className="flex items-center gap-1.5 bg-emerald-50 hover:bg-emerald-100 active:scale-95 text-emerald-800 border border-emerald-300 px-3 py-2 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span>ورود از اکسل</span>
            </button>

            {/* New Product */}
            <button
              id="add-new-product-btn"
              onClick={handleOpenNewProduct}
              className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-sm shadow-emerald-200 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>کالای جدید</span>
            </button>
          </div>
        </div>
      </div>

      {/* Summary KPI Cards */}
      {activeSubTab === 'exit-slips' ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
          <div className="bg-white p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-200/80 shadow-xs">
            <span className="text-[11px] sm:text-xs text-slate-500 font-medium">کل برگه‌های خروج صادر شده</span>
            <div className="text-lg sm:text-xl font-black text-slate-800 mt-1">
              {toPersianDigits(invoices.length)} <span className="text-[11px] sm:text-xs font-normal text-slate-400">حواله</span>
            </div>
          </div>

          <div className="bg-white p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-amber-200 bg-amber-50/40 shadow-xs">
            <span className="text-[11px] sm:text-xs text-amber-800 font-medium">در انتظار پرینت و تحویل</span>
            <div className="text-lg sm:text-xl font-black text-amber-700 mt-1 flex items-center gap-1.5 sm:gap-2">
              <span>{toPersianDigits(unprintedSlipsCount)}</span>
              {unprintedSlipsCount > 0 && (
                <span className="text-[9px] sm:text-[10px] bg-amber-200/80 text-amber-900 font-bold px-1.5 py-0.5 rounded">
                  اقدام فوری
                </span>
              )}
            </div>
          </div>

          <div className="bg-white p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-emerald-200 bg-emerald-50/30 shadow-xs">
            <span className="text-[11px] sm:text-xs text-emerald-800 font-medium">حواله‌های چاپ شده</span>
            <div className="text-lg sm:text-xl font-black text-emerald-700 mt-1">
              {toPersianDigits(printedSlipsCount)} <span className="text-[11px] sm:text-xs font-normal text-slate-400">حواله</span>
            </div>
          </div>

          <div className="bg-white p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-200/80 shadow-xs">
            <span className="text-[11px] sm:text-xs text-slate-500 font-medium">مجموع اقلام فیزیکی تحویلی</span>
            <div className="text-lg sm:text-xl font-black text-blue-700 mt-1">
              {toPersianDigits(totalDispatchedUnits)} <span className="text-[11px] sm:text-xs font-normal text-slate-400">واحد</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
          <div className="bg-white p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-200/80 shadow-xs">
            <span className="text-[11px] sm:text-xs text-slate-500 font-medium">تنوع کالا در سیستم</span>
            <div className="text-lg sm:text-xl font-black text-slate-800 mt-1">
              {toPersianDigits(totalItemsCount)} <span className="text-[11px] sm:text-xs font-normal text-slate-400">ردیف</span>
            </div>
          </div>

          <div className="bg-white p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-200/80 shadow-xs">
            <span className="text-[11px] sm:text-xs text-slate-500 font-medium">مجموع موجودی اقلام انبار</span>
            <div className="text-lg sm:text-xl font-black text-blue-700 mt-1">
              {toPersianDigits(totalStockUnits)} <span className="text-[11px] sm:text-xs font-normal text-slate-400">واحد / عدد</span>
            </div>
          </div>

          <div className="bg-white p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-amber-200 bg-amber-50/40 shadow-xs">
            <span className="text-[11px] sm:text-xs text-amber-800 font-medium">کالاهای رو به اتمام (نقطه سفارش)</span>
            <div className="text-lg sm:text-xl font-black text-amber-700 mt-1 flex items-center gap-1.5 sm:gap-2">
              <span>{toPersianDigits(lowStockCount)}</span>
              {lowStockCount > 0 && (
                <span className="text-[10px] sm:text-[11px] font-normal px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                  نیازمند شارژ
                </span>
              )}
            </div>
          </div>

          <div className="bg-white p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-rose-200 bg-rose-50/40 shadow-xs">
            <span className="text-[11px] sm:text-xs text-rose-800 font-medium">کالاهای ناموجود در انبار</span>
            <div className="text-lg sm:text-xl font-black text-rose-700 mt-1">
              {toPersianDigits(outOfStockCount)} <span className="text-[11px] sm:text-xs font-normal text-slate-400">قلم</span>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 1: PRODUCTS LIST */}
      {activeSubTab === 'items' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          {/* Filters Bar */}
          <div className="p-4 border-b border-slate-200/80 flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between bg-slate-50/60">
            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                id="inventory-search-input"
                placeholder="جستجو در نام، بارکد یا کد کالا..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl pr-9 pl-4 py-2 text-xs text-slate-800 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
              />
            </div>

            {/* Category & Stock Status Selectors */}
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="flex items-center gap-1.5 text-xs text-slate-600 bg-white border border-slate-200 rounded-xl px-2.5 py-1.5">
                <Filter className="w-3.5 h-3.5 text-slate-400" />
                <span>دسته:</span>
                <select
                  id="inventory-category-select"
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="bg-transparent font-medium text-slate-800 outline-none cursor-pointer"
                >
                  <option value="all">همه دسته‌ها</option>
                  {categories.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              {/* Status Pills */}
              <div className="flex bg-white border border-slate-200 rounded-xl p-1 text-xs">
                <button
                  id="filter-stock-all"
                  onClick={() => setStockStatusFilter('all')}
                  className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                    stockStatusFilter === 'all' ? 'bg-slate-900 text-white font-medium' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  همه
                </button>
                <button
                  id="filter-stock-in"
                  onClick={() => setStockStatusFilter('in_stock')}
                  className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                    stockStatusFilter === 'in_stock' ? 'bg-emerald-600 text-white font-medium' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  موجود
                </button>
                <button
                  id="filter-stock-low"
                  onClick={() => setStockStatusFilter('low_stock')}
                  className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                    stockStatusFilter === 'low_stock' ? 'bg-amber-600 text-white font-medium' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  رو به اتمام
                </button>
                <button
                  id="filter-stock-out"
                  onClick={() => setStockStatusFilter('out_of_stock')}
                  className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                    stockStatusFilter === 'out_of_stock' ? 'bg-rose-600 text-white font-medium' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  ناموجود
                </button>
              </div>
            </div>
          </div>

          {/* Mobile View: Product Cards (Hidden on Desktop) */}
          <div className="block sm:hidden divide-y divide-slate-100">
            {filteredProducts.length === 0 ? (
              <div className="text-center py-10 text-slate-400 p-4">
                هیچ کالایی با معیارهای جستجو یافت نشد.
              </div>
            ) : (
              filteredProducts.map((prod, index) => {
                const isOut = prod.stock === 0;
                const isLow = prod.stock > 0 && prod.stock <= prod.minStockAlert;

                return (
                  <div key={prod.id} className={`p-4 space-y-3 ${index % 2 === 1 ? 'bg-slate-50/85' : 'bg-white'} hover:bg-slate-100/60 transition-colors`}>
                    {/* Header: Name + Code + Stock badge */}
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="font-bold text-slate-900 text-sm leading-tight">{prod.name}</h4>
                        <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500">
                          <span className="bg-slate-100 px-2 py-0.5 rounded-md font-medium">{prod.category}</span>
                          <span className="font-mono text-slate-400">کد: {toPersianDigits(prod.code)}</span>
                        </div>
                      </div>

                      {/* Stock badge */}
                      <span
                        className={`px-2.5 py-1 rounded-full font-bold text-xs flex items-center gap-1.5 shrink-0 ${
                          isOut
                            ? 'bg-rose-100 text-rose-800'
                            : isLow
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {isOut && <span className="w-1.5 h-1.5 rounded-full bg-rose-600"></span>}
                        {isLow && <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />}
                        <span>
                          {toPersianDigits(prod.stock)} {prod.unit}
                        </span>
                      </span>
                    </div>

                    {/* Variant Breakdown (Mobile) */}
                    {prod.hasVariants && prod.variants && prod.variants.length > 0 && (
                      <div className="bg-purple-50/70 border border-purple-200/80 rounded-xl p-2.5 space-y-1.5">
                        <div className="flex items-center gap-1.5 text-[11px] font-bold text-purple-900">
                          <Layers className="w-3.5 h-3.5 text-purple-600" />
                          <span>تنوع‌های رنگ و مدل ({toPersianDigits(prod.variants.length)} قلم):</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {prod.variants.map((v) => (
                            <span
                              key={v.id}
                              className="inline-flex items-center gap-1 bg-white text-purple-950 border border-purple-200 px-2 py-0.5 rounded-lg text-[10px] font-medium shadow-2xs"
                            >
                              <span>{v.name}:</span>
                              <strong className="text-purple-700 font-bold font-mono">{toPersianDigits(v.stock)} {prod.unit}</strong>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Stock Details & Specifications (No Prices) */}
                    <div className="flex items-center justify-between bg-slate-50/80 p-2.5 rounded-xl text-xs border border-slate-100">
                      <div className="text-slate-600 text-[11px] flex items-center gap-1">
                        <span className="text-slate-400">نقطه سفارش:</span>
                        <span className="font-bold text-slate-700">{toPersianDigits(prod.minStockAlert)} {prod.unit}</span>
                      </div>
                      {prod.description ? (
                        <span className="text-[11px] text-slate-500 truncate max-w-[55%]">
                          {prod.description}
                        </span>
                      ) : (
                        <span className="text-[10px] text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">
                          موجودی فیزیکی
                        </span>
                      )}
                    </div>

                    {/* Mobile Action Buttons */}
                    <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => handleOpenAdjustStock(prod, 'purchase')}
                        className="flex-1 py-2 px-2.5 bg-emerald-50 active:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <ArrowDownRight className="w-3.5 h-3.5 text-emerald-600" />
                        <span>ورود کالا</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleOpenAdjustStock(prod, 'adjustment')}
                        className="flex-1 py-2 px-2.5 bg-blue-50 active:bg-blue-100 text-blue-800 border border-blue-200 rounded-xl text-xs font-bold flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <ArrowUpLeft className="w-3.5 h-3.5 text-blue-600" />
                        <span>انبارگردانی</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleOpenEditProduct(prod)}
                        title="ویرایش مشخصات"
                        className="p-2 text-slate-600 bg-slate-100 active:bg-slate-200 rounded-xl border border-slate-200 cursor-pointer"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        id={`mobile-delete-prod-btn-${prod.id}`}
                        onClick={() => setProductToDelete(prod)}
                        title="حذف کالا"
                        className="p-2 text-rose-600 bg-rose-50 active:bg-rose-100 rounded-xl border border-rose-200 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Desktop View: Table (Hidden on Mobile) */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-right border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100/70 text-slate-700 border-b border-slate-200">
                  <th className="p-3.5 font-bold">کد / بارکد</th>
                  <th className="p-3.5 font-bold">نام کالا و دسته‌بندی</th>
                  <th className="p-3.5 font-bold text-center">وضعیت و موجودی انبار</th>
                  <th className="p-3.5 font-bold">توضیحات و مشخصات</th>
                  <th className="p-3.5 font-bold text-center">عملیات انبار و ویرایش</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-10 text-slate-400">
                      هیچ کالایی با معیارهای جستجو یافت نشد.
                    </td>
                  </tr>
                ) : (
                  filteredProducts.map((prod, index) => {
                    const isOut = prod.stock === 0;
                    const isLow = prod.stock > 0 && prod.stock <= prod.minStockAlert;

                    return (
                      <tr key={prod.id} className={`${index % 2 === 1 ? 'bg-slate-50/80' : 'bg-white'} hover:bg-slate-100/70 transition-colors`}>
                        <td className="p-3.5 font-mono text-slate-600 font-semibold">
                          {toPersianDigits(prod.code)}
                        </td>
                        <td className="p-3.5">
                          <div className="font-bold text-slate-900">{prod.name}</div>
                          <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-500">
                            <span className="bg-slate-100 px-2 py-0.5 rounded-md">{prod.category}</span>
                            <span>واحد: {prod.unit}</span>
                          </div>
                          {prod.hasVariants && prod.variants && prod.variants.length > 0 && (
                            <div className="flex flex-wrap items-center gap-1.5 mt-2">
                              <span className="inline-flex items-center gap-1 bg-purple-100 text-purple-800 text-[10px] font-bold px-2 py-0.5 rounded-md border border-purple-200">
                                <Layers className="w-3 h-3 text-purple-600" />
                                <span>{toPersianDigits(prod.variants.length)} تنوع:</span>
                              </span>
                              {prod.variants.map((v) => (
                                <span
                                  key={v.id}
                                  className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 border border-slate-200 text-[10px] font-medium px-1.5 py-0.5 rounded"
                                >
                                  <span>{v.name}:</span>
                                  <strong className="text-purple-900 font-bold font-mono">{toPersianDigits(v.stock)}</strong>
                                </span>
                              ))}
                            </div>
                          )}
                        </td>

                        {/* Stock Badge */}
                        <td className="p-3.5 text-center">
                          <div className="inline-flex flex-col items-center">
                            <span
                              className={`px-3 py-1 rounded-full font-bold text-xs flex items-center gap-1.5 ${
                                isOut
                                  ? 'bg-rose-100 text-rose-800'
                                  : isLow
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-emerald-100 text-emerald-800'
                              }`}
                            >
                              {isOut && <span className="w-1.5 h-1.5 rounded-full bg-rose-600"></span>}
                              {isLow && <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />}
                              <span>
                                {toPersianDigits(prod.stock)} {prod.unit}
                              </span>
                            </span>
                            <span className="text-[10px] text-slate-400 mt-1">
                              حداقل: {toPersianDigits(prod.minStockAlert)}
                            </span>
                          </div>
                        </td>

                        {/* Description / Notes Column (No Prices) */}
                        <td className="p-3.5 text-slate-500 max-w-xs truncate text-[11px]">
                          {prod.description || '—'}
                        </td>

                        {/* Actions */}
                        <td className="p-3.5 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {/* Stock In button */}
                            <button
                              id={`stock-in-btn-${prod.id}`}
                              onClick={() => handleOpenAdjustStock(prod, 'purchase')}
                              title="ورود کالا به انبار (خرید جدید)"
                              className="p-1.5 text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                            >
                              <ArrowDownRight className="w-4 h-4" />
                            </button>

                            {/* Stock Out/Adjust */}
                            <button
                              id={`stock-adjust-btn-${prod.id}`}
                              onClick={() => handleOpenAdjustStock(prod, 'adjustment')}
                              title="انبارگردانی و اصلاح موجودی"
                              className="p-1.5 text-blue-700 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                            >
                              <ArrowUpLeft className="w-4 h-4" />
                            </button>

                            {/* Edit */}
                            <button
                              id={`edit-prod-btn-${prod.id}`}
                              onClick={() => handleOpenEditProduct(prod)}
                              title="ویرایش مشخصات کالا"
                              className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>

                            {/* Delete */}
                            <button
                              id={`delete-prod-btn-${prod.id}`}
                              type="button"
                              onClick={() => setProductToDelete(prod)}
                              title="حذف کالا"
                              className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
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
        </div>
      )}

      {/* SUBTAB 2: STOCK MOVEMENTS (KARDEX LOG) */}
      {activeSubTab === 'movements' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-200/80 bg-slate-50/60 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-800 text-sm">کاردکس و لاگ گردش انبار</h3>
              <p className="text-xs text-slate-500">تمامی ورود، خروج و کسر خودکار انبار توسط فاکتورها</p>
            </div>
          </div>

          {/* Mobile View: Movements Cards (Hidden on Desktop) */}
          <div className="block sm:hidden divide-y divide-slate-100">
            {movements.length === 0 ? (
              <div className="text-center py-8 text-slate-400 p-4">
                هیچ تراکنشی در انبار ثبت نشده است.
              </div>
            ) : (
              movements.map((mov, index) => {
                const isPositive = mov.quantity > 0;
                return (
                  <div key={mov.id} className={`p-3.5 space-y-2 ${index % 2 === 1 ? 'bg-slate-50/85' : 'bg-white'} hover:bg-slate-100/60 transition-colors`}>
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900 text-xs">{mov.productName}</span>
                      <span
                        className={`px-2 py-0.5 rounded-md font-semibold text-[10px] ${
                          mov.type === 'sale'
                            ? 'bg-purple-100 text-purple-800'
                            : mov.type === 'purchase'
                            ? 'bg-emerald-100 text-emerald-800'
                            : mov.type === 'return'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-slate-100 text-slate-800'
                        }`}
                      >
                        {mov.type === 'sale'
                          ? 'کسر با فروش'
                          : mov.type === 'purchase'
                          ? 'ورود (خرید)'
                          : mov.type === 'return'
                          ? 'مرجوعی'
                          : 'تعدیل دستی'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs bg-slate-50 p-2 rounded-lg border border-slate-100">
                      <div>
                        <span className="text-[10px] text-slate-400 block">تغییر موجودی:</span>
                        <span className={`font-black font-mono ${isPositive ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {isPositive ? `+${toPersianDigits(mov.quantity)}` : toPersianDigits(mov.quantity)}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block">مانده انبار:</span>
                        <span className="font-bold font-mono text-slate-800">
                          {toPersianDigits(mov.remainingStock)}
                        </span>
                      </div>
                      <div className="text-left">
                        <span className="text-[10px] text-slate-400 block">تاریخ:</span>
                        <span className="font-mono text-slate-600 text-[11px]">
                          {mov.date}
                        </span>
                      </div>
                    </div>

                    {(mov.invoiceNumber || mov.note) && (
                      <div className="text-[11px] text-slate-500 flex items-center justify-between pt-0.5">
                        {mov.invoiceNumber && (
                          <span className="font-semibold text-slate-700">
                            فاکتور شماره: {toPersianDigits(mov.invoiceNumber)}
                          </span>
                        )}
                        {mov.note && <span className="text-slate-400 truncate">{mov.note}</span>}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Desktop View: Table (Hidden on Mobile) */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-right border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100/70 text-slate-700 border-b border-slate-200">
                  <th className="p-3.5 font-bold">تاریخ</th>
                  <th className="p-3.5 font-bold">نام کالا</th>
                  <th className="p-3.5 font-bold">نوع تراکنش</th>
                  <th className="p-3.5 font-bold text-center">تعداد تغییر</th>
                  <th className="p-3.5 font-bold text-center">مانده موجودی</th>
                  <th className="p-3.5 font-bold">ارجاع / فاکتور</th>
                  <th className="p-3.5 font-bold">توضیحات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {movements.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-slate-400">
                      هیچ تراکنشی در انبار ثبت نشده است.
                    </td>
                  </tr>
                ) : (
                  movements.map((mov, index) => {
                    const isPositive = mov.quantity > 0;
                    return (
                      <tr key={mov.id} className={`${index % 2 === 1 ? 'bg-slate-50/80' : 'bg-white'} hover:bg-slate-100/70 transition-colors`}>
                        <td className="p-3.5 text-slate-600 font-mono">{mov.date}</td>
                        <td className="p-3.5 font-bold text-slate-900">{mov.productName}</td>
                        <td className="p-3.5">
                          <span
                            className={`px-2.5 py-0.5 rounded-md font-semibold text-[11px] ${
                              mov.type === 'sale'
                                ? 'bg-purple-100 text-purple-800'
                                : mov.type === 'purchase'
                                ? 'bg-emerald-100 text-emerald-800'
                                : mov.type === 'return'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-slate-100 text-slate-800'
                            }`}
                          >
                            {mov.type === 'sale'
                              ? 'کسر با فروش'
                              : mov.type === 'purchase'
                              ? 'ورود به انبار (خرید)'
                              : mov.type === 'return'
                              ? 'مرجوعی به انبار'
                              : 'تعدیل دستی'}
                          </span>
                        </td>
                        <td className="p-3.5 text-center font-bold font-mono">
                          <span className={isPositive ? 'text-emerald-600' : 'text-rose-600'}>
                            {isPositive ? `+${toPersianDigits(mov.quantity)}` : toPersianDigits(mov.quantity)}
                          </span>
                        </td>
                        <td className="p-3.5 text-center font-bold text-slate-800 font-mono">
                          {toPersianDigits(mov.remainingStock)}
                        </td>
                        <td className="p-3.5 text-slate-600">
                          {mov.invoiceNumber ? (
                            <span className="font-semibold text-slate-800">
                              فاکتور {toPersianDigits(mov.invoiceNumber)}
                            </span>
                          ) : (
                            '---'
                          )}
                        </td>
                        <td className="p-3.5 text-slate-500 text-[11px]">{mov.note}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUBTAB: INBOUND GOODS RECEIPTS (حواله‌های ورود به انبار) */}
      {activeSubTab === 'inbound-receipts' && (
        <InboundReceiptsList
          inboundReceipts={inboundReceipts}
          settings={settings}
          currentUser={currentUser}
          initialSelectedReceiptId={selectedInboundReceiptId}
          onConfirmReceipt={(receiptId, verifiedItems, warehouseNotes, verifiedBy) => {
            if (onConfirmInboundReceipt) {
              onConfirmInboundReceipt(receiptId, verifiedItems, warehouseNotes, verifiedBy);
            }
          }}
        />
      )}

      {/* SUBTAB 3: EXIT SLIPS (برگه‌های خروج از انبار) */}
      {activeSubTab === 'exit-slips' && (
        <div className="space-y-4">
          {/* Filter and Search Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="relative w-full sm:w-80">
              <input
                id="exit-slip-search-input"
                type="text"
                placeholder="جستجو در شماره فاکتور، نام خریدار یا کالا..."
                value={exitSlipSearch}
                onChange={(e) => setExitSlipSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-right"
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto">
              <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-medium">
                <button
                  id="filter-all-slips"
                  onClick={() => setExitSlipFilter('all')}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                    exitSlipFilter === 'all' ? 'bg-white text-slate-900 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  همه حواله‌ها ({toPersianDigits(invoices.length)})
                </button>
                <button
                  id="filter-unprinted-slips"
                  onClick={() => setExitSlipFilter('unprinted')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                    exitSlipFilter === 'unprinted' ? 'bg-white text-amber-900 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                  <span>منتظر چاپ ({toPersianDigits(unprintedSlipsCount)})</span>
                </button>
                <button
                  id="filter-printed-slips"
                  onClick={() => setExitSlipFilter('printed')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                    exitSlipFilter === 'printed' ? 'bg-white text-emerald-900 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>چاپ شده ({toPersianDigits(printedSlipsCount)})</span>
                </button>
              </div>
            </div>
          </div>

          {/* Slips Content Container */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-200/80 bg-slate-50/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="font-bold text-slate-800 text-sm">لیست برگه‌های خروج کالای انبار (حواله‌های تحویل فیزیکی)</h3>
                <p className="text-xs text-slate-500">
                  برای هر فاکتور فروش صادر شده، یک برگ خروج با رهگیری دقیق دفعات، ساعت و تاریخ چاپ جهت تحویل اجناس قرار دارد
                </p>
              </div>
              <div className="text-xs text-slate-500 font-mono">
                نمایش {toPersianDigits(filteredExitSlips.length)} از {toPersianDigits(invoices.length)} حواله
              </div>
            </div>

            {filteredExitSlips.length === 0 ? (
              <div className="text-center py-12 text-slate-400 p-4 space-y-2">
                <Truck className="w-10 h-10 mx-auto text-slate-300 stroke-1" />
                <p className="text-sm font-semibold text-slate-600">هیچ برگ خروجی با این مشخصات یافت نشد.</p>
                <p className="text-xs text-slate-400">
                  {invoices.length === 0
                    ? 'ابتدا در بخش صدور فاکتور، یک فاکتور صادر نمایید تا برگ خروج آن در این قسمت ایجاد شود.'
                    : 'فیلتر جستجو را پاک کنید تا کلیه حواله‌ها نمایش داده شوند.'}
                </p>
              </div>
            ) : (
              <>
                {/* Mobile View: Exit Slip Cards */}
                <div className="block sm:hidden divide-y divide-slate-100">
                  {filteredExitSlips.map((inv, index) => {
                    const slipLog = exitSlipLogs[inv.id] || { invoiceId: inv.id, printCount: 0, history: [] };
                    const isPrinted = slipLog.printCount > 0;
                    const totalQty = inv.items.reduce((s, it) => s + it.quantity, 0);

                    return (
                      <div key={inv.id} className={`p-4 space-y-3 ${index % 2 === 1 ? 'bg-slate-50/85' : 'bg-white'} hover:bg-slate-100/60 transition-colors`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-['Vazirmatn'] font-bold text-slate-900 text-sm bg-slate-100 px-2.5 py-0.5 rounded border border-slate-200">
                              {toPersianDigits(inv.invoiceNumber)}
                            </span>
                            <span className="text-xs text-slate-500 font-['Vazirmatn']">{toPersianDigits(inv.date)}</span>
                          </div>

                          <span
                            className={`px-2 py-0.5 rounded-md font-semibold text-[11px] flex items-center gap-1 ${
                              isPrinted
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {isPrinted ? (
                              <>
                                <Check className="w-3 h-3 text-emerald-600" />
                                <span>چاپ شده ({toPersianDigits(slipLog.printCount)} بار)</span>
                              </>
                            ) : (
                              <>
                                <AlertCircle className="w-3 h-3 text-amber-600" />
                                <span>منتظر چاپ</span>
                              </>
                            )}
                          </span>
                        </div>

                        <div>
                          <div className="text-xs font-bold text-slate-900">{inv.customerName}</div>
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            اقلام حواله: {toPersianDigits(inv.items.length)} قلم کالا ({toPersianDigits(totalQty)} واحد فیزیکی)
                          </div>
                        </div>

                        {/* Print details */}
                        <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-[11px] space-y-1">
                          <div className="flex items-center justify-between text-slate-600">
                            <span>تعداد دفعات چاپ:</span>
                            <span className="font-['Vazirmatn'] font-bold text-slate-800">{toPersianDigits(slipLog.printCount)} بار</span>
                          </div>
                          <div className="flex items-center justify-between text-slate-600">
                            <span>آخرین چاپ:</span>
                            <span className="font-['Vazirmatn'] text-slate-700">
                              {slipLog.lastPrintedAt ? toPersianDigits(slipLog.lastPrintedAt) : 'هنوز چاپ نشده'}
                            </span>
                          </div>
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center gap-2 pt-1">
                          <button
                            onClick={() => setSelectedExitSlipInvoice(inv)}
                            className="flex-1 flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white py-2 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
                          >
                            <Printer className="w-4 h-4" />
                            <span>مشاهده و چاپ برگه خروج</span>
                          </button>

                          {slipLog.history && slipLog.history.length > 0 && (
                            <button
                              onClick={() => setHistoryModalInvoice(inv)}
                              className="p-2 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-xl border border-blue-200 transition-colors cursor-pointer"
                              title="مشاهده سوابق، تاریخ و زمان چاپ‌ها"
                            >
                              <History className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Desktop View: Table */}
                <div className="hidden sm:block overflow-x-auto">
                  <table className="w-full text-right border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-100/70 text-slate-700 border-b border-slate-200">
                        <th className="p-3.5 font-bold">شماره حواله / فاکتور</th>
                        <th className="p-3.5 font-bold">تاریخ صدور</th>
                        <th className="p-3.5 font-bold">تحویل‌گیرنده / خریدار</th>
                        <th className="p-3.5 font-bold text-center">تنوع اقلام</th>
                        <th className="p-3.5 font-bold text-center">مجموع واحد تحویلی</th>
                        <th className="p-3.5 font-bold text-center">وضعیت و دفعات چاپ</th>
                        <th className="p-3.5 font-bold">زمان و تاریخ آخرین چاپ</th>
                        <th className="p-3.5 font-bold text-center">عملیات انبارداری</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredExitSlips.map((inv, index) => {
                        const slipLog = exitSlipLogs[inv.id] || { invoiceId: inv.id, printCount: 0, history: [] };
                        const isPrinted = slipLog.printCount > 0;
                        const totalQty = inv.items.reduce((s, it) => s + it.quantity, 0);

                        return (
                          <tr key={inv.id} className={`${index % 2 === 1 ? 'bg-slate-50/80' : 'bg-white'} hover:bg-slate-100/70 transition-colors`}>
                            <td className="p-3.5">
                              <span className="font-['Vazirmatn'] font-bold text-slate-900 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">
                                {toPersianDigits(inv.invoiceNumber)}
                              </span>
                            </td>
                            <td className="p-3.5 font-['Vazirmatn'] text-slate-700">{toPersianDigits(inv.date)}</td>
                            <td className="p-3.5">
                              <div className="font-bold text-slate-900">{inv.customerName}</div>
                              {inv.customerPhone && (
                                <div className="text-[11px] text-slate-500 font-['Vazirmatn']">{toPersianDigits(inv.customerPhone)}</div>
                              )}
                            </td>
                            <td className="p-3.5 text-center font-['Vazirmatn'] font-semibold text-slate-700">
                              {toPersianDigits(inv.items.length)} قلم
                            </td>
                            <td className="p-3.5 text-center font-['Vazirmatn'] font-black text-slate-900 text-sm">
                              {toPersianDigits(totalQty)}
                            </td>
                            <td className="p-3.5 text-center">
                              {isPrinted ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                                  <span>چاپ شده ({toPersianDigits(slipLog.printCount)} بار)</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                  <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                                  <span>منتظر چاپ (جدید)</span>
                                </span>
                              )}
                            </td>
                            <td className="p-3.5">
                              {slipLog.lastPrintedAt ? (
                                <div className="space-y-0.5">
                                  <div className="font-['Vazirmatn'] text-slate-800 text-xs font-medium">
                                    {toPersianDigits(slipLog.lastPrintedAt)}
                                  </div>
                                  <div className="text-[10px] text-slate-400">
                                    انباردار: {slipLog.lastPrintedBy || 'انباردار'}
                                  </div>
                                </div>
                              ) : (
                                <span className="text-slate-400 text-xs italic">هنوز پرینت گرفته نشده</span>
                              )}
                            </td>
                            <td className="p-3.5 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  onClick={() => setSelectedExitSlipInvoice(inv)}
                                  className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer"
                                  title="پرینت برگه خروج از انبار"
                                >
                                  <Printer className="w-3.5 h-3.5" />
                                  <span>چاپ برگه خروج</span>
                                </button>

                                <button
                                  onClick={() => setHistoryModalInvoice(inv)}
                                  className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg border border-blue-200 transition-colors cursor-pointer"
                                  title="مشاهده سوابق و دفعات چاپ با زمان و تاریخ"
                                >
                                  <History className="w-4 h-4" />
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
        </div>
      )}

      {/* MODAL: ADD / EDIT PRODUCT */}
      {isProductModalOpen && editingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden">
            <div className="bg-slate-900 text-white px-5 py-3.5 flex items-center justify-between">
              <h3 className="font-bold text-sm">
                {editingProduct.id ? 'ویرایش مشخصات کالا' : 'تعریف کالای جدید در انبار'}
              </h3>
              <button
                type="button"
                onClick={() => setIsProductModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProductForm} className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-slate-700 mb-1">نام کالا *</label>
                  <input
                    type="text"
                    required
                    id="product-modal-name"
                    value={editingProduct.name}
                    onChange={(e) => setEditingProduct({ ...editingProduct, name: e.target.value })}
                    placeholder="مثال: لپ‌تاپ ایسوس مدل Vivobook"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">کد کالا / بارکد</label>
                  <input
                    type="text"
                    id="product-modal-code"
                    value={editingProduct.code}
                    onChange={(e) => setEditingProduct({ ...editingProduct, code: e.target.value })}
                    placeholder="1001"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">دسته‌بندی</label>
                  <input
                    type="text"
                    id="product-modal-category"
                    value={editingProduct.category}
                    onChange={(e) => setEditingProduct({ ...editingProduct, category: e.target.value })}
                    placeholder="لوازم جانبی، دیجیتال، ..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">واحد سنجش</label>
                  <select
                    id="product-modal-unit"
                    value={editingProduct.unit}
                    onChange={(e) => setEditingProduct({ ...editingProduct, unit: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 cursor-pointer"
                  >
                    <option value="عدد">عدد</option>
                    <option value="دستگاه">دستگاه</option>
                    <option value="بسته">بسته</option>
                    <option value="کیلوگرم">کیلوگرم</option>
                    <option value="متر">متر</option>
                    <option value="کارتن">کارتن</option>
                    <option value="جفت">جفت</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">حداقل موجودی (نقطه سفارش)</label>
                  <input
                    type="number"
                    id="product-modal-minstock"
                    min="0"
                    value={editingProduct.minStockAlert}
                    onChange={(e) => setEditingProduct({ ...editingProduct, minStockAlert: parseInt(e.target.value, 10) || 0 })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>

                {/* Price configuration - restricted to admin */}
                {currentUser?.role === 'admin' ? (
                  <div className="col-span-2 grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                    <div className="col-span-2 flex items-center justify-between text-[11px] font-bold text-slate-700">
                      <span>نرخ‌گذاری مالی کالا (دسترسی مدیر جهت صدور فاکتور):</span>
                      <span className="text-[10px] text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">مدیریت مالی</span>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">قیمت خرید ({settings.currency})</label>
                      <input
                        type="number"
                        id="product-modal-buyprice"
                        min="0"
                        value={editingProduct.buyPrice}
                        onChange={(e) => setEditingProduct({ ...editingProduct, buyPrice: parseFloat(e.target.value) || 0 })}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">قیمت فروش ({settings.currency})</label>
                      <input
                        type="number"
                        id="product-modal-sellprice"
                        min="0"
                        value={editingProduct.sellPrice}
                        onChange={(e) => setEditingProduct({ ...editingProduct, sellPrice: parseFloat(e.target.value) || 0 })}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                      />
                    </div>
                  </div>
                ) : null}

                {/* VARIANT MANAGEMENT SECTION */}
                <div className="col-span-2 bg-gradient-to-br from-purple-50/70 to-slate-50 border border-purple-200/80 rounded-2xl p-3.5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
                        <Layers className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-800">تنوع کالا (رنگ، مدل، سایز یا مشخصه فنی)</div>
                        <div className="text-[10px] text-slate-500">
                          مانند پودر سخت کننده خشک پاش در رنگ‌های طوسی، قرمز، سبز یا سایر تنوع‌ها
                        </div>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        id="product-has-variants-toggle"
                        checked={!!editingProduct.hasVariants}
                        onChange={(e) => handleToggleHasVariants(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-600"></div>
                    </label>
                  </div>

                  {editingProduct.hasVariants && (
                    <div className="space-y-2.5 pt-2 border-t border-purple-100">
                      {/* Quick color shortcuts */}
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[10px] text-purple-700 font-bold flex items-center gap-1">
                          <Sparkles className="w-3 h-3 text-purple-500" />
                          <span>افزودن سریع رنگ:</span>
                        </span>
                        {['طوسی', 'قرمز', 'سبز', 'زرد', 'آبی', 'مشکی', 'سفید', 'نچرال'].map((color) => {
                          const exists = (editingProduct.variants || []).some((v) => v.name.trim() === color);
                          return (
                            <button
                              key={color}
                              type="button"
                              disabled={exists}
                              onClick={() => handleAddQuickVariant(color)}
                              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
                                exists
                                  ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                                  : 'bg-white text-purple-900 border border-purple-200 hover:bg-purple-100 hover:border-purple-300 cursor-pointer shadow-2xs'
                              }`}
                            >
                              + {color}
                            </button>
                          );
                        })}
                      </div>

                      {/* Variants table */}
                      <div className="bg-white rounded-xl border border-purple-200/90 overflow-hidden shadow-2xs">
                        <table className="w-full text-right text-[11px]">
                          <thead className="bg-purple-50/80 text-purple-900 border-b border-purple-100 font-bold">
                            <tr>
                              <th className="p-2">نام تنوع / رنگ *</th>
                              <th className="p-2">کد اختصاصی</th>
                              <th className="p-2 text-center w-24">موجودی انبار</th>
                              {currentUser?.role === 'admin' && <th className="p-2 text-center w-28">قیمت فروش</th>}
                              <th className="p-2 text-center w-8">حذف</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-purple-50">
                            {(editingProduct.variants || []).map((v) => (
                              <tr key={v.id} className="hover:bg-purple-50/30">
                                <td className="p-1.5">
                                  <input
                                    type="text"
                                    required
                                    placeholder="مثلاً: طوسی"
                                    value={v.name}
                                    onChange={(e) => handleUpdateVariantField(v.id, 'name', e.target.value)}
                                    className="w-full bg-slate-50 focus:bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs outline-none focus:border-purple-500 font-bold text-slate-800"
                                  />
                                </td>
                                <td className="p-1.5">
                                  <input
                                    type="text"
                                    placeholder={`${editingProduct.code || '1000'}-${v.name}`}
                                    value={v.code || ''}
                                    onChange={(e) => handleUpdateVariantField(v.id, 'code', e.target.value)}
                                    className="w-full bg-slate-50 focus:bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-mono outline-none focus:border-purple-500"
                                  />
                                </td>
                                <td className="p-1.5">
                                  <input
                                    type="number"
                                    min="0"
                                    value={v.stock}
                                    onChange={(e) => handleUpdateVariantField(v.id, 'stock', Math.max(0, parseInt(e.target.value, 10) || 0))}
                                    className="w-full bg-slate-50 focus:bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs text-center font-bold font-mono outline-none focus:border-purple-500"
                                  />
                                </td>
                                {currentUser?.role === 'admin' && (
                                  <td className="p-1.5">
                                    <input
                                      type="number"
                                      min="0"
                                      value={v.sellPrice || editingProduct.sellPrice || 0}
                                      onChange={(e) => handleUpdateVariantField(v.id, 'sellPrice', Math.max(0, parseFloat(e.target.value) || 0))}
                                      className="w-full bg-slate-50 focus:bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs text-center font-mono outline-none focus:border-purple-500"
                                    />
                                  </td>
                                )}
                                <td className="p-1.5 text-center">
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveVariant(v.id)}
                                    className="p-1 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>

                        <div className="p-2 bg-purple-50/50 border-t border-purple-100 flex items-center justify-between">
                          <button
                            type="button"
                            onClick={() => handleAddQuickVariant(`تنوع ${(editingProduct.variants?.length || 0) + 1}`)}
                            className="text-[11px] font-bold text-purple-700 hover:text-purple-900 flex items-center gap-1 cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>افزودن تنوع دلخواه</span>
                          </button>
                          <span className="text-[10px] text-purple-800 font-medium">
                            مجموع موجودی تنوع‌ها: <strong className="font-bold text-purple-950 font-mono">{toPersianDigits(editingProduct.stock)} {editingProduct.unit}</strong>
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {!editingProduct.hasVariants && !editingProduct.id && (
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-slate-700 mb-1">موجودی اولیه در انبار</label>
                    <input
                      type="number"
                      id="product-modal-initialstock"
                      min="0"
                      value={editingProduct.stock}
                      onChange={(e) => setEditingProduct({ ...editingProduct, stock: parseInt(e.target.value, 10) || 0 })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                  </div>
                )}

                <div className="col-span-2">
                  <label className="block text-xs font-medium text-slate-700 mb-1">توضیحات و مشخصات فنی</label>
                  <textarea
                    rows={2}
                    id="product-modal-desc"
                    value={editingProduct.description || ''}
                    onChange={(e) => setEditingProduct({ ...editingProduct, description: e.target.value })}
                    placeholder="رنگ، مدل، دوره گارانتی و..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsProductModalOpen(false)}
                  className="px-4 py-2 text-xs text-slate-600 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  id="save-product-modal-btn"
                  className="flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>ذخیره در انبار</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: STOCK ADJUSTMENT / INTAKE */}
      {adjustingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden">
            <div className="bg-slate-900 text-white px-5 py-3.5 flex items-center justify-between">
              <h3 className="font-bold text-sm">
                {adjustType === 'purchase' ? 'رسید ورود به انبار (خرید جدید)' : 'تعدیل و انبارگردانی'}
              </h3>
              <button
                type="button"
                onClick={() => setAdjustingProduct(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitStockAdjust} className="p-5 space-y-4">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs space-y-1">
                <div className="font-bold text-slate-800">{adjustingProduct.name}</div>
                <div className="text-slate-500">
                  موجودی کل فعلی: <strong className="text-slate-800">{toPersianDigits(adjustingProduct.stock)} {adjustingProduct.unit}</strong>
                </div>
              </div>

              {adjustingProduct.hasVariants && adjustingProduct.variants && adjustingProduct.variants.length > 0 && (
                <div>
                  <label className="block text-xs font-bold text-purple-900 mb-1.5 flex items-center gap-1">
                    <Layers className="w-3.5 h-3.5 text-purple-600" />
                    <span>انتخاب رنگ / تنوع جهت عملیات انبار:</span>
                  </label>
                  <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto p-1">
                    {adjustingProduct.variants.map((v) => (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => setSelectedVariantId(v.id)}
                        className={`p-2.5 rounded-xl border text-right transition-all cursor-pointer ${
                          selectedVariantId === v.id
                            ? 'bg-purple-50 border-purple-500 text-purple-950 font-bold ring-2 ring-purple-500/20 shadow-xs'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <div className="text-xs font-bold">{v.name}</div>
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          موجودی فعلی: <strong className="font-mono text-purple-700">{toPersianDigits(v.stock)}</strong> {adjustingProduct.unit}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">عملیات انبار:</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setAdjustType('purchase')}
                    className={`py-2 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                      adjustType === 'purchase'
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-slate-50 text-slate-700 border-slate-200'
                    }`}
                  >
                    + افزایش موجودی (ورود)
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdjustType('adjustment')}
                    className={`py-2 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                      adjustType === 'adjustment'
                        ? 'bg-rose-600 text-white border-rose-600'
                        : 'bg-slate-50 text-slate-700 border-slate-200'
                    }`}
                  >
                    - کاهش موجودی (خروج)
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  تعداد ({adjustingProduct.unit}) *
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  id="stock-adjust-quantity-input"
                  value={adjustQuantity}
                  onChange={(e) => setAdjustQuantity(parseInt(e.target.value, 10) || 1)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-center outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">علت و یادداشت تراکنش</label>
                <input
                  type="text"
                  id="stock-adjust-note-input"
                  value={adjustNote}
                  onChange={(e) => setAdjustNote(e.target.value)}
                  placeholder="خرید از تامین‌کننده، ضایعات، مغایرت انبارگردانی و..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setAdjustingProduct(null)}
                  className="px-4 py-2 text-xs text-slate-600 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  id="confirm-stock-adjust-btn"
                  className="flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl shadow-xs cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>ثبت تغییر در انبار</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Product Confirmation Modal */}
      {productToDelete && (
        <div 
          id="delete-product-confirm-modal"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 text-right">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mb-4 mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900 text-center mb-2">
              حذف کالا از انبار
            </h3>
            <p className="text-sm text-slate-600 text-center mb-6 leading-relaxed">
              آیا از حذف کالای <span className="font-bold text-slate-800">«{productToDelete.name}»</span> (کد کالا: {productToDelete.code}) اطمینان دارید؟
            </p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                id="cancel-delete-product-btn"
                onClick={() => setProductToDelete(null)}
                className="flex-1 py-2.5 px-4 rounded-xl text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
              >
                انصراف
              </button>
              <button
                type="button"
                id="confirm-delete-product-btn"
                onClick={() => {
                  onDeleteProduct(productToDelete.id);
                  setProductToDelete(null);
                }}
                className="flex-1 py-2.5 px-4 rounded-xl text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 shadow-sm shadow-rose-200 transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" />
                <span>بله، حذف شود</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EXIT SLIP PRINT MODAL */}
      {selectedExitSlipInvoice && (
        <ExitSlipModal
          invoice={selectedExitSlipInvoice}
          settings={settings}
          currentUser={currentUser}
          slipLog={exitSlipLogs[selectedExitSlipInvoice.id] || { invoiceId: selectedExitSlipInvoice.id, printCount: 0, history: [] }}
          onRecordPrint={() => handleRecordExitSlipPrint(selectedExitSlipInvoice.id)}
          onUpdateSettings={onUpdateSettings}
          onClose={() => setSelectedExitSlipInvoice(null)}
        />
      )}

      {/* EXIT SLIP DETAILED PRINT HISTORY MODAL */}
      {historyModalInvoice && (() => {
        const slipLog = exitSlipLogs[historyModalInvoice.id] || { invoiceId: historyModalInvoice.id, printCount: 0, history: [] };
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden">
              <div className="bg-slate-900 text-white px-5 py-3.5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <History className="w-4 h-4 text-blue-400" />
                  <h3 className="font-bold text-sm">
                    سوابق چاپ حواله خروج فاکتور {toPersianDigits(historyModalInvoice.invoiceNumber)}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setHistoryModalInvoice(null)}
                  className="text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-5 space-y-4">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-slate-500">خریدار:</span>
                    <span className="font-bold text-slate-800">{historyModalInvoice.customerName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">تعداد کل دفعات چاپ شده:</span>
                    <span className="font-mono font-bold text-emerald-700 text-sm">
                      {toPersianDigits(slipLog.printCount)} بار
                    </span>
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-bold text-slate-700 mb-2">لیست جزئیات زمان و تاریخ هر نوبت چاپ:</h4>
                  {(!slipLog.history || slipLog.history.length === 0) ? (
                    <div className="text-center py-6 text-slate-400 text-xs bg-slate-50 rounded-xl border border-slate-100">
                      هنوز هیچ پرینتی برای این برگه خروج ثبت نشده است.
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                      {slipLog.history.map((record, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between text-xs bg-slate-50 p-2.5 rounded-xl border border-slate-200"
                        >
                          <div className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-800 text-[11px] font-bold flex items-center justify-center font-mono">
                              {toPersianDigits(slipLog.history.length - idx)}
                            </span>
                            <span className="font-semibold text-slate-800">
                              نوبت چاپ {toPersianDigits(slipLog.history.length - idx)}
                            </span>
                          </div>
                          <div className="text-left font-mono text-slate-600 text-[11px]">
                            <div>{toPersianDigits(record.printedAt)}</div>
                            <div className="text-[10px] text-slate-400 font-sans">
                              کاربر: {record.printedBy || 'انباردار'}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => {
                      const targetInv = historyModalInvoice;
                      setHistoryModalInvoice(null);
                      setSelectedExitSlipInvoice(targetInv);
                    }}
                    className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-1.5 rounded-xl text-xs font-bold cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>باز کردن و چاپ حواله</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setHistoryModalInvoice(null)}
                    className="px-3.5 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                  >
                    بستن
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* EXCEL IMPORT MODAL */}
      {isImportModalOpen && (
        <ExcelImportModal
          isOpen={isImportModalOpen}
          onClose={() => setIsImportModalOpen(false)}
          mode="products"
          existingProducts={products}
          onImportProducts={(imported, importMode) => {
            if (onImportProducts) {
              onImportProducts(imported, importMode);
            } else {
              let updated: Product[];
              if (importMode === 'replace') {
                updated = imported;
              } else {
                const map = new Map<string, Product>(products.map((p) => [p.code, p]));
                imported.forEach((p) => map.set(p.code, p));
                updated = Array.from(map.values()) as Product[];
              }
              StorageService.saveProducts(updated);
            }
            setIsImportModalOpen(false);
          }}
        />
      )}
    </div>
  );
};
