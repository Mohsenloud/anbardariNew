import React, { useState, useEffect, useMemo } from 'react';
import { Product, ProductVariant, StockMovement, StoreSettings, AppUser, Invoice, ExitSlipData, InboundReceipt, InboundReceiptItem, DirectTransfer, Customer } from '../types';
import { toPersianDigits, toEnglishDigits, getCurrentJalaliDate, getCurrentJalaliTime, formatPrice, formatNumber, formatThousands } from '../utils/jalali';
import { StorageService } from '../utils/storage';
import { exportProductsToExcel } from '../utils/excelHelper';
import { ExcelImportModal } from './ExcelImportModal';
import { ExitSlipModal } from './ExitSlipModal';
import { ExitSlipDeliveryModal } from './ExitSlipDeliveryModal';
import { ExitSlipDetailsModal } from './ExitSlipDetailsModal';
import { CustomerExportModal } from './CustomerExportModal';
import { InboundReceiptsList } from './InboundReceiptsList';
import { DirectTransfersList } from './DirectTransfersList';
import { CategoryManagerModal } from './CategoryManagerModal';
import { ProductDetailsModal } from './ProductDetailsModal';
import { ErrorBoundary } from './ErrorBoundary';
import { NumericInput } from './NumericInput';
import { 
  Plus, 
  Search, 
  AlertTriangle, 
  ArrowDownRight, 
  ArrowUpLeft, 
  ArrowLeftRight,
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
  Sparkles,
  SlidersHorizontal,
  Barcode,
  RefreshCw,
  Hash,
  FolderTree,
  Tag
} from 'lucide-react';
import {
  generateNextProductCode,
  generateProductBarcode,
  generateVariantCode,
  generateVariantBarcode,
} from '../utils/codeGenerator';

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
    type: 'purchase' | 'adjustment' | 'return' | 'set_stock', 
    quantity: number, 
    note: string,
    variantId?: string,
    exactStock?: number
  ) => void;
  onImportProducts?: (products: Product[], mode: 'merge' | 'replace') => void;
  onConfirmInboundReceipt?: (
    receiptId: string,
    verifiedItems: InboundReceiptItem[],
    warehouseNotes: string,
    verifiedBy: string
  ) => void;
  selectedInboundReceiptId?: string | null;
  initialSubTab?: 'items' | 'inbound-receipts' | 'exit-slips' | 'direct-transfers' | 'movements';
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
  initialSubTab,
  onUpdateSettings,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'items' | 'inbound-receipts' | 'exit-slips' | 'direct-transfers' | 'movements'>(() => {
    if (selectedInboundReceiptId) return 'inbound-receipts';
    if (initialSubTab) return initialSubTab;
    return 'items';
  });

  useEffect(() => {
    if (initialSubTab) {
      setActiveSubTab(initialSubTab);
    }
  }, [initialSubTab]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [stockStatusFilter, setStockStatusFilter] = useState<'all' | 'in_stock' | 'low_stock' | 'out_of_stock'>('all');

  // Direct Transfers (خروج و ورود بدون فاکتور - امانی/تعمیرات)
  const [directTransfers, setDirectTransfers] = useState<DirectTransfer[]>(() => StorageService.getDirectTransfers());

  // Exit Slips State
  const [exitSlipLogs, setExitSlipLogs] = useState<Record<string, ExitSlipData>>(() => StorageService.getExitSlipLogs());
  const [selectedExitSlipInvoice, setSelectedExitSlipInvoice] = useState<Invoice | null>(null);
  const [historyModalInvoice, setHistoryModalInvoice] = useState<Invoice | null>(null);
  const [deliveryModalInvoice, setDeliveryModalInvoice] = useState<Invoice | null>(null);
  const [detailSlipInvoice, setDetailSlipInvoice] = useState<Invoice | null>(null);
  const [exitSlipSearch, setExitSlipSearch] = useState('');
  const [exitSlipFilter, setExitSlipFilter] = useState<'all' | 'pending_delivery' | 'delivered' | 'unprinted' | 'printed'>('all');
  const [isCustomerExportModalOpen, setIsCustomerExportModalOpen] = useState(false);
  const [customerExportSelected, setCustomerExportSelected] = useState<Customer | null>(null);
  const [customersList, setCustomersList] = useState<Customer[]>(() => StorageService.getCustomers());

  // Categories State & Management
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [categoriesList, setCategoriesList] = useState<string[]>(() => StorageService.getCategories());

  // Keep storage in sync with updates
  useEffect(() => {
    const unsub = StorageService.subscribe(() => {
      setExitSlipLogs(StorageService.getExitSlipLogs());
      setDirectTransfers(StorageService.getDirectTransfers());
      setCustomersList(StorageService.getCustomers());
      setCategoriesList(StorageService.getCategories());
    });
    return () => unsub();
  }, []);

  // Modal states
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [isVariantModalOpen, setIsVariantModalOpen] = useState(false);
  
  // Excel Import Modal State
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  // Stock Adjustment Modal
  const [adjustingProduct, setAdjustingProduct] = useState<Product | null>(null);
  const [adjustType, setAdjustType] = useState<'purchase' | 'adjustment' | 'set_stock'>('purchase');
  const [adjustQuantity, setAdjustQuantity] = useState<number>(1);
  const [exactStockTarget, setExactStockTarget] = useState<number>(0);
  const [selectedVariantId, setSelectedVariantId] = useState<string>('');
  const [adjustNote, setAdjustNote] = useState<string>('');

  // Delete Confirmation Modal
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);

  // Detail Modal for Clean 1-Row / 2-Row List View
  const [detailProduct, setDetailProduct] = useState<Product | null>(null);

  // User selection for table display: 'single_row' (فقط نام و دسته) | 'double_row' (دو ردیفه)
  const [productTableView, setProductTableView] = useState<'single_row' | 'double_row'>(() => {
    const saved = localStorage.getItem('inventory_product_table_view');
    return saved === 'double_row' ? 'double_row' : 'single_row';
  });

  const handleSetProductTableView = (mode: 'single_row' | 'double_row') => {
    setProductTableView(mode);
    localStorage.setItem('inventory_product_table_view', mode);
  };

  // Combined & Deduped Categories list
  const categories = useMemo(() => {
    const fromStorage = categoriesList;
    const fromProducts = products.map((p) => p.category?.trim()).filter(Boolean);
    const set = new Set([...fromStorage, ...fromProducts]);
    if (!set.has('عمومی')) {
      return ['عمومی', ...Array.from(set)];
    }
    return Array.from(set);
  }, [categoriesList, products]);

  // Category CRUD Handlers
  const handleAddCategory = (name: string) => {
    const success = StorageService.addCategory(name);
    if (success) {
      setCategoriesList(StorageService.getCategories());
    }
    return success;
  };

  const handleRenameCategory = (oldName: string, newName: string) => {
    const success = StorageService.renameCategory(oldName, newName, true);
    if (success) {
      setCategoriesList(StorageService.getCategories());
      if (selectedCategory === oldName) {
        setSelectedCategory(newName);
      }
    }
    return success;
  };

  const handleDeleteCategory = (name: string, reassignTo = 'عمومی') => {
    const success = StorageService.deleteCategory(name, reassignTo);
    if (success) {
      setCategoriesList(StorageService.getCategories());
      if (selectedCategory === name) {
        setSelectedCategory('all');
      }
    }
    return success;
  };

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

  // Open New Product Modal - با تعیین خودکار کد و بارکد توسط سیستم
  const handleOpenNewProduct = () => {
    const nextCode = generateNextProductCode(products);
    const nextBarcode = generateProductBarcode(nextCode, products);
    setEditingProduct({
      id: '',
      code: nextCode,
      barcode: nextBarcode,
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
    const otherProducts = products.filter((p) => p.id !== prod.id);
    const safeCode = prod.code?.trim() || generateNextProductCode(otherProducts);
    const safeBarcode = prod.barcode?.trim() || generateProductBarcode(safeCode, otherProducts);
    setEditingProduct({
      ...prod,
      code: safeCode,
      barcode: safeBarcode,
      hasVariants: !!prod.hasVariants,
      variants: prod.variants ? prod.variants.map((v, idx) => ({
        ...v,
        code: v.code?.trim() || generateVariantCode(safeCode, idx + 1, v.name),
        barcode: v.barcode?.trim() || generateVariantBarcode(safeCode, idx + 1, products),
      })) : [],
    });
    setIsProductModalOpen(true);
  };

  // تولید مجدد کد کالا توسط سیستم
  const handleRegenerateCode = () => {
    if (!editingProduct) return;
    const otherProducts = products.filter((p) => p.id !== editingProduct.id);
    const newCode = generateNextProductCode(otherProducts);
    setEditingProduct({
      ...editingProduct,
      code: newCode,
    });
  };

  // Variant helper functions for Product Modal
  const handleToggleHasVariants = (enabled: boolean) => {
    if (!editingProduct) return;
    if (enabled && (!editingProduct.variants || editingProduct.variants.length === 0)) {
      const vCode = generateVariantCode(editingProduct.code || '101', 1, 'طوسی');
      const vBarcode = generateVariantBarcode(editingProduct.code || '101', 1, products);
      const defaultVariant: ProductVariant = {
        id: `var-${Date.now()}-1`,
        name: 'طوسی',
        code: vCode,
        barcode: vBarcode,
        stock: editingProduct.stock || 0,
        buyPrice: editingProduct.buyPrice || 0,
        sellPrice: editingProduct.sellPrice || 0,
      };
      setEditingProduct({
        ...editingProduct,
        hasVariants: true,
        variants: [defaultVariant],
      });
      setIsVariantModalOpen(true);
    } else {
      setEditingProduct({
        ...editingProduct,
        hasVariants: enabled,
      });
      if (enabled) {
        setIsVariantModalOpen(true);
      }
    }
  };

  const handleAddQuickVariant = (variantName: string) => {
    if (!editingProduct) return;
    const currentVariants = editingProduct.variants || [];
    if (currentVariants.some((v) => v.name.trim().toLowerCase() === variantName.trim().toLowerCase())) {
      return;
    }
    const variantIndex = currentVariants.length + 1;
    const vCode = generateVariantCode(editingProduct.code || '101', variantIndex, variantName);
    const vBarcode = generateVariantBarcode(editingProduct.code || '101', variantIndex, products);
    const newVariant: ProductVariant = {
      id: `var-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
      name: variantName,
      code: vCode,
      barcode: vBarcode,
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

    const otherProducts = products.filter((p) => p.id !== editingProduct.id);
    const finalCode = editingProduct.code.trim() || generateNextProductCode(otherProducts);
    const finalBarcode = editingProduct.barcode?.trim() || generateProductBarcode(finalCode, otherProducts);

    const hasVars = !!editingProduct.hasVariants && (editingProduct.variants?.length || 0) > 0;
    const cleanVariants = hasVars 
      ? (editingProduct.variants || [])
          .filter((v) => v.name && v.name.trim().length > 0)
          .map((v, vIdx) => ({
            ...v,
            code: v.code?.trim() || generateVariantCode(finalCode, vIdx + 1, v.name),
            barcode: v.barcode?.trim() || generateVariantBarcode(finalCode, vIdx + 1, products),
          }))
      : [];
    const totalStock = hasVars && cleanVariants.length > 0
      ? cleanVariants.reduce((sum, v) => sum + (Number(v.stock) || 0), 0)
      : Math.max(0, Number(editingProduct.stock) || 0);

    const catName = editingProduct.category?.trim() || 'عمومی';
    if (catName) {
      handleAddCategory(catName);
    }

    const saved: Product = {
      ...editingProduct,
      category: catName,
      id: editingProduct.id || `prod-${Date.now()}`,
      name: editingProduct.name.trim(),
      code: finalCode,
      barcode: finalBarcode,
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
  const handleOpenAdjustStock = (prod: Product, type: 'purchase' | 'adjustment' | 'set_stock' = 'purchase') => {
    setAdjustingProduct(prod);
    setAdjustType(type);
    setAdjustQuantity(1);
    const hasVars = !!prod.hasVariants && Array.isArray(prod.variants) && prod.variants.length > 0;
    const firstVarId = hasVars ? prod.variants![0].id : '';
    setSelectedVariantId(firstVarId);

    const initialCurrentStock = hasVars && firstVarId
      ? (prod.variants?.find((v) => v.id === firstVarId)?.stock || 0)
      : (prod.stock || 0);
    setExactStockTarget(initialCurrentStock);

    setAdjustNote(
      type === 'purchase'
        ? 'ورود کالای جدید به انبار (خرید)'
        : type === 'set_stock'
        ? 'ثبت موجودی واقعی در انبارگردانی'
        : 'کاهش موجودی و انبارگردانی'
    );
  };

  // Submit Stock Adjustment
  const handleSubmitStockAdjust = (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustingProduct) return;

    const hasVars = !!adjustingProduct.hasVariants && Array.isArray(adjustingProduct.variants) && adjustingProduct.variants.length > 0;
    const currentTargetStock = hasVars && selectedVariantId
      ? (adjustingProduct.variants?.find((v) => v.id === selectedVariantId)?.stock || 0)
      : (adjustingProduct.stock || 0);

    if (adjustType === 'set_stock') {
      const cleanExact = Math.max(0, Number(exactStockTarget) || 0);
      const diff = Math.abs(cleanExact - currentTargetStock);
      onAdjustStock(
        adjustingProduct.id,
        'set_stock',
        diff,
        adjustNote.trim() || 'ثبت موجودی واقعی در انبارگردانی',
        selectedVariantId || undefined,
        cleanExact
      );
    } else {
      const cleanQty = Math.max(1, Number(adjustQuantity) || 1);
      onAdjustStock(
        adjustingProduct.id,
        adjustType,
        cleanQty,
        adjustNote.trim() || (adjustType === 'purchase' ? 'ورود کالای جدید به انبار' : 'کاهش و خروج از انبار'),
        selectedVariantId || undefined
      );
    }
    setAdjustingProduct(null);
  };

  // Quick stats
  const totalItemsCount = products.length;
  const lowStockCount = products.filter((p) => p.stock > 0 && p.stock <= p.minStockAlert).length;
  const outOfStockCount = products.filter((p) => p.stock === 0).length;
  const totalStockUnits = products.reduce((sum, p) => sum + p.stock, 0);

  // Exit slip stats & filters (فقط فاکتورهای قطعی و رسمی دارای حواله خروج هستند، پیش‌فاکتورها حواله ندارند)
  const regularInvoices = useMemo(() => invoices.filter((inv) => !inv.isProforma), [invoices]);

  const unprintedSlipsCount = regularInvoices.filter(
    (inv) => !exitSlipLogs[inv.id] || exitSlipLogs[inv.id].printCount === 0
  ).length;
  const printedSlipsCount = regularInvoices.length - unprintedSlipsCount;
  const pendingDeliverySlipsCount = regularInvoices.filter(
    (inv) => !exitSlipLogs[inv.id]?.isDelivered
  ).length;
  const deliveredSlipsCount = regularInvoices.filter(
    (inv) => Boolean(exitSlipLogs[inv.id]?.isDelivered)
  ).length;

  const totalDispatchedUnits = regularInvoices.reduce(
    (sum, inv) => sum + inv.items.reduce((s, it) => s + it.quantity, 0),
    0
  );

  const pendingInboundCount = inboundReceipts.filter(
    (r) => r.status === 'pending_verification'
  ).length;

  const handleOpenExitSlip = (inv: Invoice) => {
    if (inv.isProforma) {
      alert('امکان صدور حواله خروج برای پیش‌فاکتور وجود ندارد. حواله خروج انبار صرفاً برای فاکتورهای رسمی و قطعی صادر می‌گردد.');
      return;
    }
    // اطمینان از تخصیص شماره ترتیبی و منظم به حواله خروج انبار
    let currentLog = exitSlipLogs[inv.id];
    if (!currentLog?.slipNumber) {
      const assignedSlipNum = StorageService.getOrAssignExitSlipNumber(inv.id, inv.invoiceNumber);
      currentLog = {
        ...(currentLog || { invoiceId: inv.id, printCount: 0, history: [] }),
        slipNumber: assignedSlipNum,
      };
      setExitSlipLogs((prev) => ({
        ...prev,
        [inv.id]: currentLog,
      }));
    }
    setSelectedExitSlipInvoice(inv);
  };

  const handleRecordExitSlipPrint = (invoiceId: string, currentSlipLog?: ExitSlipData) => {
    const currentInMemory = currentSlipLog || exitSlipLogs[invoiceId];
    const updated = StorageService.recordExitSlipPrint(
      invoiceId,
      currentUser?.fullName || 'انباردار',
      undefined,
      currentInMemory
    );
    setExitSlipLogs((prev) => ({
      ...prev,
      [invoiceId]: updated,
    }));
  };

  const handleSaveExitSlipDelivery = (
    invoiceId: string,
    deliveryData: {
      isDelivered: boolean;
      deliveredAt: string;
      deliveredBy: string;
      receiverName: string;
      receiverPhone: string;
      vehicleInfo: string;
      deliveryNotes: string;
    }
  ) => {
    const updated = StorageService.updateExitSlipDelivery(invoiceId, deliveryData);
    setExitSlipLogs((prev) => ({
      ...prev,
      [invoiceId]: updated,
    }));
  };

  const handleQuickToggleDelivery = (invoiceId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const current = exitSlipLogs[invoiceId] || { invoiceId, printCount: 0, history: [] };
    const nextIsDelivered = !current.isDelivered;
    const updated = StorageService.updateExitSlipDelivery(invoiceId, {
      isDelivered: nextIsDelivered,
      deliveredAt: nextIsDelivered ? `${getCurrentJalaliDate()} - ساعت ${getCurrentJalaliTime()}` : '',
      deliveredBy: nextIsDelivered ? (currentUser?.fullName || 'انباردار') : '',
      receiverName: current.receiverName || '',
      receiverPhone: current.receiverPhone || '',
      vehicleInfo: current.vehicleInfo || '',
      deliveryNotes: current.deliveryNotes || '',
    });
    setExitSlipLogs((prev) => ({
      ...prev,
      [invoiceId]: updated,
    }));
  };

  // Direct Transfers Handlers (خروج و ورود بدون فاکتور - تعمیرات/امانی)
  const activeDirectCount = directTransfers.filter(
    (t) => t.status === 'dispatched' || t.status === 'partially_returned'
  ).length;

  const handleSaveDirectDispatch = (data: Omit<DirectTransfer, 'id' | 'createdAt'>) => {
    StorageService.createDirectTransferDispatch(data);
    setDirectTransfers(StorageService.getDirectTransfers());
  };

  const handleSaveDirectReturn = (transferId: string, returnData: any) => {
    StorageService.recordDirectTransferReturn(transferId, returnData);
    setDirectTransfers(StorageService.getDirectTransfers());
  };

  const handleDeleteDirectTransfer = (transferId: string, returnStock: boolean) => {
    StorageService.deleteDirectTransfer(transferId, returnStock);
    setDirectTransfers(StorageService.getDirectTransfers());
  };

  const filteredExitSlips = regularInvoices.filter((inv) => {
    const log: Partial<ExitSlipData> = exitSlipLogs[inv.id] || { printCount: 0, isDelivered: false };
    if (exitSlipFilter === 'pending_delivery' && log.isDelivered) return false;
    if (exitSlipFilter === 'delivered' && !log.isDelivered) return false;
    if (exitSlipFilter === 'unprinted' && log.printCount > 0) return false;
    if (exitSlipFilter === 'printed' && log.printCount === 0) return false;

    if (exitSlipSearch.trim()) {
      const q = exitSlipSearch.toLowerCase();
      const matchesSlipNum = (log.slipNumber || '').toLowerCase().includes(q);
      const matchesNum = inv.invoiceNumber.toLowerCase().includes(q) || matchesSlipNum;
      const matchesCust = inv.customerName.toLowerCase().includes(q);
      const matchesItem = inv.items.some((it) => it.productName.toLowerCase().includes(q));
      const matchesReceiver = (log.receiverName || '').toLowerCase().includes(q);
      const matchesPhone = (log.receiverPhone || '').includes(q);
      const matchesVehicle = (log.vehicleInfo || '').toLowerCase().includes(q);
      return matchesNum || matchesCust || matchesItem || matchesReceiver || matchesPhone || matchesVehicle;
    }
    return true;
  });

  return (
    <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6 pb-12">
      {/* MOBILE-FIRST DEDICATED WAREHOUSE NAVIGATION BAR (STICKY BELOW MAIN HEADER) */}
      <div className="sm:hidden sticky top-16 z-20 bg-slate-100 pb-2 pt-1.5 -mx-3 px-3 border-b border-slate-200/90 shadow-xs">
        {/* 5 Ergonomic Mobile Touch Tabs */}
        <div className="grid grid-cols-5 gap-1 p-1 bg-white rounded-2xl border border-slate-200 shadow-xs">
          {/* Tab 1: کالاها و موجودی */}
          <button
            type="button"
            id="mobile-tab-items"
            onClick={() => setActiveSubTab('items')}
            className={`flex flex-col items-center justify-center py-2 px-0.5 rounded-xl transition-all active:scale-95 cursor-pointer relative ${
              activeSubTab === 'items'
                ? 'bg-blue-600 text-white shadow-xs font-bold'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 font-medium'
            }`}
          >
            <div className="relative">
              <PackageCheck className="w-4 h-4" />
              {lowStockCount > 0 && (
                <span className={`absolute -top-1.5 -right-2 text-[8px] font-bold px-1 py-0.2 rounded-full ${
                  activeSubTab === 'items' ? 'bg-amber-400 text-amber-950' : 'bg-amber-500 text-white'
                }`}>
                  {toPersianDigits(lowStockCount)}
                </span>
              )}
            </div>
            <span className="text-[10px] mt-0.5 whitespace-nowrap">کالاها</span>
            <span className={`text-[8px] ${activeSubTab === 'items' ? 'text-blue-100' : 'text-slate-400'}`}>
              ({toPersianDigits(products.length)})
            </span>
          </button>

          {/* Tab 2: حواله ورود کالا */}
          <button
            type="button"
            id="mobile-tab-inbound"
            onClick={() => setActiveSubTab('inbound-receipts')}
            className={`flex flex-col items-center justify-center py-2 px-0.5 rounded-xl transition-all active:scale-95 cursor-pointer relative ${
              activeSubTab === 'inbound-receipts'
                ? 'bg-emerald-600 text-white shadow-xs font-bold'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 font-medium'
            }`}
          >
            <div className="relative">
              <ArrowDownRight className="w-4 h-4" />
              {pendingInboundCount > 0 && (
                <span className="absolute -top-1.5 -right-2 bg-rose-500 text-white text-[8px] font-bold px-1 py-0.2 rounded-full animate-pulse shadow-xs">
                  {toPersianDigits(pendingInboundCount)}
                </span>
              )}
            </div>
            <span className="text-[10px] mt-0.5 whitespace-nowrap">حواله ورود</span>
            <span className={`text-[8px] ${activeSubTab === 'inbound-receipts' ? 'text-emerald-100' : 'text-slate-400'}`}>
              ({toPersianDigits(inboundReceipts.length)})
            </span>
          </button>

          {/* Tab 3: برگه خروج فاکتورها */}
          <button
            type="button"
            id="mobile-tab-exit-slips"
            onClick={() => setActiveSubTab('exit-slips')}
            className={`flex flex-col items-center justify-center py-2 px-0.5 rounded-xl transition-all active:scale-95 cursor-pointer relative ${
              activeSubTab === 'exit-slips'
                ? 'bg-indigo-600 text-white shadow-xs font-bold'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 font-medium'
            }`}
          >
            <div className="relative">
              <Truck className="w-4 h-4" />
              {unprintedSlipsCount > 0 && (
                <span className="absolute -top-1.5 -right-2 bg-amber-500 text-white text-[8px] font-bold px-1 py-0.2 rounded-full shadow-xs">
                  {toPersianDigits(unprintedSlipsCount)}
                </span>
              )}
            </div>
            <span className="text-[10px] mt-0.5 whitespace-nowrap">برگه خروج</span>
            <span className={`text-[8px] ${activeSubTab === 'exit-slips' ? 'text-indigo-100' : 'text-slate-400'}`}>
              ({toPersianDigits(invoices.length)})
            </span>
          </button>

          {/* Tab 4: خروج مستقیم بدون فاکتور (امانی / تعمیرات) */}
          <button
            type="button"
            id="mobile-tab-direct-transfers"
            onClick={() => setActiveSubTab('direct-transfers')}
            className={`flex flex-col items-center justify-center py-2 px-0.5 rounded-xl transition-all active:scale-95 cursor-pointer relative ${
              activeSubTab === 'direct-transfers'
                ? 'bg-amber-600 text-white shadow-xs font-bold'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 font-medium'
            }`}
          >
            <div className="relative">
              <ArrowLeftRight className="w-4 h-4" />
              {activeDirectCount > 0 && (
                <span className="absolute -top-1.5 -right-2 bg-amber-500 text-slate-950 text-[8px] font-black px-1 py-0.2 rounded-full shadow-xs animate-pulse">
                  {toPersianDigits(activeDirectCount)}
                </span>
              )}
            </div>
            <span className="text-[10px] mt-0.5 whitespace-nowrap">تعمیرات/امانی</span>
            <span className={`text-[8px] ${activeSubTab === 'direct-transfers' ? 'text-amber-100' : 'text-slate-400'}`}>
              ({toPersianDigits(directTransfers.length)})
            </span>
          </button>

          {/* Tab 5: گردش و کاردکس */}
          <button
            type="button"
            id="mobile-tab-movements"
            onClick={() => setActiveSubTab('movements')}
            className={`flex flex-col items-center justify-center py-2 px-0.5 rounded-xl transition-all active:scale-95 cursor-pointer relative ${
              activeSubTab === 'movements'
                ? 'bg-slate-800 text-white shadow-xs font-bold'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 font-medium'
            }`}
          >
            <History className="w-4 h-4" />
            <span className="text-[10px] mt-0.5 whitespace-nowrap">کاردکس</span>
            <span className={`text-[8px] ${activeSubTab === 'movements' ? 'text-slate-300' : 'text-slate-400'}`}>
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
            {activeSubTab === 'direct-transfers' && 'خروج و ورود بدون فاکتور (امانی/تعمیرات)'}
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
      <div className="hidden sm:flex flex-col gap-4 bg-white p-5 sm:p-6 rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-xs">
        {/* Top Tier: Title, Description & Action Buttons */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="p-2.5 rounded-2xl bg-blue-50 text-blue-700 shrink-0 shadow-2xs">
              <PackageCheck className="w-6 h-6" />
            </span>
            <div>
              <h2 className="text-lg sm:text-xl font-black text-slate-900 leading-tight">
                مدیریت انبار و موجودی کالاها
              </h2>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                کنترل لحظه‌ای موجودی، برگه‌های خروج انبارداری (حواله تحویل)، رسید ورود و تاریخچه گردش کالا
              </p>
            </div>
          </div>

          {/* Action Buttons (Categories, Excel Export/Import & New Product) */}
          <div className="flex flex-wrap items-center gap-2 shrink-0 self-start md:self-auto">
            {/* Category Management Button */}
            <button
              type="button"
              id="manage-categories-btn"
              onClick={() => setIsCategoryModalOpen(true)}
              title="مدیریت و تعریف دسته‌بندی‌های محصولات (قطعات، لوازم جانبی و...)"
              className="flex items-center gap-1.5 bg-indigo-50 hover:bg-indigo-100 active:scale-95 text-indigo-900 border border-indigo-200/90 hover:border-indigo-300 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer"
            >
              <FolderTree className="w-4 h-4 text-indigo-600" />
              <span>دسته‌بندی‌ها</span>
              <span className="bg-indigo-200/70 text-indigo-900 text-[10px] font-mono px-1.5 py-0.2 rounded-full font-bold">
                {toPersianDigits(categories.length)}
              </span>
            </button>

            {/* Excel Export */}
            <button
              type="button"
              id="export-inventory-excel-btn"
              onClick={() => exportProductsToExcel(products)}
              title="خروجی فایل اکسل از همه کالاها و تنوع‌ها"
              className="flex items-center gap-1.5 bg-white hover:bg-slate-50 active:scale-95 text-slate-700 border border-slate-200/90 hover:border-slate-300 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer"
            >
              <Download className="w-4 h-4 text-slate-500" />
              <span>خروجی اکسل</span>
            </button>

            {/* Excel Import */}
            <button
              type="button"
              id="import-inventory-excel-btn"
              onClick={() => setIsImportModalOpen(true)}
              title="ورود کالاها و تنوع‌ها از فایل اکسل"
              className="flex items-center gap-1.5 bg-emerald-50 hover:bg-emerald-100 active:scale-95 text-emerald-800 border border-emerald-200 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>ورود از اکسل</span>
            </button>

            {/* New Product */}
            <button
              id="add-new-product-btn"
              onClick={handleOpenNewProduct}
              className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm shadow-emerald-200/80 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>کالای جدید</span>
            </button>
          </div>
        </div>

        {/* Bottom Tier: Sub-Tab Navigation Bar */}
        <div className="border-t border-slate-100/90 pt-3.5 flex items-center justify-between gap-3 overflow-x-auto no-scrollbar">
          {/* Sub Tab Switcher */}
          <div className="flex items-center bg-slate-100/90 p-1.5 rounded-2xl border border-slate-200/90 gap-1.5 shadow-2xs shrink-0">
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

            {/* Tab 4: خروج و ورود مستقیم (بدون فاکتور - امانی/تعمیرات) */}
            <button
              id="subtab-direct-transfers"
              onClick={() => setActiveSubTab('direct-transfers')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm transition-all cursor-pointer whitespace-nowrap ${
                activeSubTab === 'direct-transfers'
                  ? 'bg-white text-slate-900 shadow-xs ring-1 ring-slate-900/5 font-extrabold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60 font-semibold'
              }`}
            >
              <ArrowLeftRight className={`w-4 h-4 shrink-0 transition-colors ${activeSubTab === 'direct-transfers' ? 'text-amber-600' : 'text-slate-400'}`} />
              <span>خروج و ورود بدون فاکتور (امانی/تعمیرات)</span>
              <span
                className={`text-[11px] font-bold px-2 py-0.5 rounded-full transition-colors ${
                  activeSubTab === 'direct-transfers'
                    ? 'bg-amber-50 text-amber-700 ring-1 ring-amber-500/20'
                    : 'bg-slate-200/80 text-slate-600'
                }`}
              >
                {toPersianDigits(directTransfers.length)}
              </span>
              {activeDirectCount > 0 && (
                <span className="bg-amber-500 text-slate-950 text-[10px] font-black px-2 py-0.5 rounded-full shadow-xs animate-pulse">
                  {toPersianDigits(activeDirectCount)} بیرون انبار
                </span>
              )}
            </button>

            {/* Tab 5: گردش و کاردکس */}
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
              <span>{formatNumber(unprintedSlipsCount)}</span>
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
              {formatNumber(printedSlipsCount)} <span className="text-[11px] sm:text-xs font-normal text-slate-400">حواله</span>
            </div>
          </div>

          <div className="bg-white p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-200/80 shadow-xs">
            <span className="text-[11px] sm:text-xs text-slate-500 font-medium">مجموع اقلام فیزیکی تحویلی</span>
            <div className="text-lg sm:text-xl font-black text-blue-700 mt-1">
              {formatNumber(totalDispatchedUnits)} <span className="text-[11px] sm:text-xs font-normal text-slate-400">واحد</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
          <div className="bg-white p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-200/80 shadow-xs">
            <span className="text-[11px] sm:text-xs text-slate-500 font-medium">تنوع کالا در سیستم</span>
            <div className="text-lg sm:text-xl font-black text-slate-800 mt-1">
              {formatNumber(totalItemsCount)} <span className="text-[11px] sm:text-xs font-normal text-slate-400">ردیف</span>
            </div>
          </div>

          <div className="bg-white p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-200/80 shadow-xs">
            <span className="text-[11px] sm:text-xs text-slate-500 font-medium">مجموع موجودی اقلام انبار</span>
            <div className="text-lg sm:text-xl font-black text-blue-700 mt-1">
              {formatNumber(totalStockUnits)} <span className="text-[11px] sm:text-xs font-normal text-slate-400">واحد / عدد</span>
            </div>
          </div>

          <div className="bg-white p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-amber-200 bg-amber-50/40 shadow-xs">
            <span className="text-[11px] sm:text-xs text-amber-800 font-medium">کالاهای رو به اتمام (نقطه سفارش)</span>
            <div className="text-lg sm:text-xl font-black text-amber-700 mt-1 flex items-center gap-1.5 sm:gap-2">
              <span>{formatNumber(lowStockCount)}</span>
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
              {formatNumber(outOfStockCount)} <span className="text-[11px] sm:text-xs font-normal text-slate-400">قلم</span>
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
                placeholder="جستجو در نام یا کد کالا..."
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
                  <option value="all">همه دسته‌ها ({toPersianDigits(products.length)})</option>
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      {c} ({toPersianDigits(products.filter((p) => p.category === c).length)})
                    </option>
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
              {/* Layout Mode Switcher (تک ردیفه / دو ردیفه) */}
              <div className="flex bg-slate-100 p-0.5 border border-slate-200 rounded-xl text-xs gap-1">
                <button
                  type="button"
                  id="view-mode-single-row"
                  onClick={() => handleSetProductTableView('single_row')}
                  className={`px-2.5 py-1 rounded-lg transition-all font-bold cursor-pointer flex items-center gap-1.5 ${
                    productTableView === 'single_row'
                      ? 'bg-white text-indigo-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="جدول تک‌ردیفه (فقط نام و دسته‌بندی با دکمه مشاهده اطلاعات کامل)"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>تک‌ردیفه (نام و دسته)</span>
                </button>
                <button
                  type="button"
                  id="view-mode-double-row"
                  onClick={() => handleSetProductTableView('double_row')}
                  className={`px-2.5 py-1 rounded-lg transition-all font-bold cursor-pointer flex items-center gap-1.5 ${
                    productTableView === 'double_row'
                      ? 'bg-white text-indigo-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="نمای دو ردیفه فشرده"
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>دو ردیفه</span>
                </button>
              </div>
            </div>
          </div>

          {/* Visual Category Quick-Filter Bar with Horizontal Scroll */}
          <div className="px-4 py-2.5 bg-slate-100/70 border-b border-slate-200/80 flex items-center gap-2 overflow-x-auto no-scrollbar">
            <span className="text-[11px] font-bold text-slate-500 shrink-0 flex items-center gap-1">
              <FolderTree className="w-3.5 h-3.5 text-indigo-600" />
              <span>دسته‌ها:</span>
            </span>

            <button
              type="button"
              onClick={() => setSelectedCategory('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
                selectedCategory === 'all'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200/90'
              }`}
            >
              <span>همه کالاها</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                selectedCategory === 'all' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
              }`}>
                {toPersianDigits(products.length)}
              </span>
            </button>

            {categories.map((cat) => {
              const catCount = products.filter((p) => p.category === cat).length;
              const isSelected = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-indigo-600 text-white shadow-xs ring-2 ring-indigo-500/20'
                      : 'bg-white hover:bg-indigo-50 text-slate-700 hover:text-indigo-900 border border-slate-200/90 hover:border-indigo-300'
                  }`}
                >
                  <span>{cat}</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                    isSelected ? 'bg-indigo-700 text-white' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {toPersianDigits(catCount)}
                  </span>
                </button>
              );
            })}

            <button
              type="button"
              onClick={() => setIsCategoryModalOpen(true)}
              className="px-2.5 py-1.5 rounded-xl text-xs font-bold text-indigo-700 hover:bg-indigo-100 bg-indigo-50 border border-indigo-200/90 transition-all shrink-0 cursor-pointer flex items-center gap-1 shadow-2xs"
              title="مدیریت و تعریف دسته‌بندی جدید"
            >
              <Plus className="w-3.5 h-3.5 text-indigo-600" />
              <span>تعریف دسته جدید</span>
            </button>
          </div>

          {/* Active Category Information Banner */}
          {selectedCategory !== 'all' && (
            <div className="mx-4 mt-3 mb-1 p-3 bg-gradient-to-r from-indigo-50/90 via-blue-50/70 to-indigo-50/90 border border-indigo-200/90 rounded-2xl flex flex-wrap items-center justify-between gap-2 text-xs animate-in fade-in">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold shadow-xs shrink-0">
                  <FolderTree className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-extrabold text-slate-900 flex items-center gap-2">
                    <span className="text-slate-500 font-normal">دسته‌بندی فیلتر شده:</span>
                    <span className="text-indigo-900 bg-white px-2.5 py-0.5 rounded-lg border border-indigo-200 font-black shadow-2xs">
                      {selectedCategory}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-600 mt-1 flex flex-wrap items-center gap-2">
                    <span>
                      <strong>{toPersianDigits(filteredProducts.length)}</strong> قلم کالا
                    </span>
                    <span>•</span>
                    <span>
                      مجموع موجودی فیزیکی این دسته: <strong className="font-mono font-bold text-indigo-950">{formatNumber(filteredProducts.reduce((s, p) => s + (Number(p.stock) || 0), 0))}</strong> عدد
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsCategoryModalOpen(true)}
                  className="px-2.5 py-1.5 bg-white hover:bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-xl font-bold text-xs transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
                >
                  <Edit3 className="w-3.5 h-3.5 text-indigo-600" />
                  <span>مدیریت این دسته</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedCategory('all')}
                  className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl font-bold text-xs transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
                >
                  <X className="w-3.5 h-3.5 text-slate-400" />
                  <span>نمایش همه کالاها</span>
                </button>
              </div>
            </div>
          )}

          {/* PRODUCT LIST VIEWS (تک ردیفه یا دو ردیفه بر اساس انتخاب کاربر) */}
          {productTableView === 'single_row' ? (
            /* 1. SINGLE-ROW TABLE (فقط نام و دسته‌بندی - اطلاعات کالا در صفحه جداگانه) */
            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100/80 text-slate-700 border-b border-slate-200">
                    <th className="p-3.5 font-bold w-16 text-center">ردیف</th>
                    <th className="p-3.5 font-bold">نام کالا</th>
                    <th className="p-3.5 font-bold w-56">دسته‌بندی</th>
                    <th className="p-3.5 font-bold text-center w-48">اطلاعات کالا</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredProducts.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="text-center py-12 text-slate-400">
                        هیچ کالایی با معیارهای جستجو یافت نشد.
                      </td>
                    </tr>
                  ) : (
                    filteredProducts.map((prod, index) => (
                      <tr
                        key={prod.id}
                        onClick={() => setDetailProduct(prod)}
                        className={`cursor-pointer transition-colors ${
                          index % 2 === 1 ? 'bg-slate-50/60' : 'bg-white'
                        } hover:bg-emerald-50/40`}
                        title="جهت مشاهده تمام اطلاعات این کالا کلیک کنید"
                      >
                        {/* 1. Index */}
                        <td className="p-3.5 text-center text-slate-400 font-mono text-xs">
                          {toPersianDigits(index + 1)}
                        </td>

                        {/* 2. Product Name */}
                        <td className="p-3.5">
                          <div className="font-extrabold text-slate-900 text-xs sm:text-sm flex items-center gap-2">
                            <span>{prod.name}</span>
                            {prod.hasVariants && prod.variants && prod.variants.length > 0 && (
                              <span className="text-[10px] font-bold text-purple-700 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded-md">
                                {toPersianDigits(prod.variants.length)} تنوع
                              </span>
                            )}
                          </div>
                        </td>

                        {/* 3. Category */}
                        <td className="p-3.5">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedCategory(prod.category);
                            }}
                            className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200/80 px-3 py-1 rounded-lg font-bold text-xs transition-colors cursor-pointer"
                            title={`فیلتر بر اساس دسته «${prod.category}»`}
                          >
                            {prod.category}
                          </button>
                        </td>

                        {/* 4. Complete Details Button */}
                        <td className="p-3.5 text-center">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDetailProduct(prod);
                            }}
                            className="px-3.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                          >
                            <Eye className="w-3.5 h-3.5 text-emerald-600" />
                            <span>مشاهده صفحه کالا</span>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            /* 2. DOUBLE-ROW STREAMLINED VIEW (جدول / نمای دو ردیفه) */
            <div className="divide-y divide-slate-100">
              {filteredProducts.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  هیچ کالایی با معیارهای جستجو یافت نشد.
                </div>
              ) : (
                filteredProducts.map((prod, index) => (
                  <div
                    key={prod.id}
                    onClick={() => setDetailProduct(prod)}
                    className={`p-3.5 space-y-2 cursor-pointer transition-colors hover:bg-emerald-50/40 active:bg-slate-100 ${
                      index % 2 === 1 ? 'bg-slate-50/60' : 'bg-white'
                    }`}
                    title="جهت مشاهده تمام اطلاعات این کالا کلیک کنید"
                  >
                    {/* Row 1: Index & Product Name */}
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="font-mono text-slate-400 text-xs w-6 text-center shrink-0">
                          {toPersianDigits(index + 1)}.
                        </span>
                        <span className="font-extrabold text-slate-900 text-xs sm:text-sm truncate">
                          {prod.name}
                        </span>
                        {prod.hasVariants && prod.variants && prod.variants.length > 0 && (
                          <span className="text-[10px] font-bold text-purple-700 bg-purple-50 border border-purple-200 px-1.5 py-0.2 rounded shrink-0">
                            {toPersianDigits(prod.variants.length)} تنوع
                          </span>
                        )}
                      </div>

                      <span className="font-mono text-[10px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 shrink-0">
                        کد: {toPersianDigits(prod.code)}
                      </span>
                    </div>

                    {/* Row 2: Category & Complete Details Button */}
                    <div className="flex items-center justify-between gap-3 pt-1 border-t border-slate-100/90 text-xs">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-slate-400 text-[11px]">دسته‌بندی:</span>
                        <span className="bg-indigo-50 text-indigo-700 border border-indigo-200/80 px-2.5 py-0.5 rounded-lg font-bold text-xs truncate">
                          {prod.category}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDetailProduct(prod);
                        }}
                        className="px-3.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs shrink-0"
                      >
                        <Eye className="w-3.5 h-3.5 text-emerald-600" />
                        <span>مشاهده صفحه جزئیات کالا</span>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
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
                placeholder="جستجو در فاکتور، مشتری، کالا، راننده، ماشین یا تلفن..."
                value={exitSlipSearch}
                onChange={(e) => setExitSlipSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-right"
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
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
                  id="filter-pending-delivery-slips"
                  onClick={() => setExitSlipFilter('pending_delivery')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                    exitSlipFilter === 'pending_delivery' ? 'bg-white text-amber-900 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Clock className="w-3.5 h-3.5 text-amber-600" />
                  <span>در انتظار تحویل ({toPersianDigits(pendingDeliverySlipsCount)})</span>
                </button>
                <button
                  id="filter-delivered-slips"
                  onClick={() => setExitSlipFilter('delivered')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                    exitSlipFilter === 'delivered' ? 'bg-white text-emerald-900 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Truck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>بار تحویل شد ({toPersianDigits(deliveredSlipsCount)})</span>
                </button>
                <button
                  id="filter-unprinted-slips"
                  onClick={() => setExitSlipFilter('unprinted')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                    exitSlipFilter === 'unprinted' ? 'bg-white text-blue-900 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <AlertCircle className="w-3.5 h-3.5 text-blue-600" />
                  <span>منتظر چاپ ({toPersianDigits(unprintedSlipsCount)})</span>
                </button>
                <button
                  id="filter-printed-slips"
                  onClick={() => setExitSlipFilter('printed')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                    exitSlipFilter === 'printed' ? 'bg-white text-slate-900 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
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
            <div className="p-4 border-b border-slate-200/80 bg-slate-50/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="font-bold text-slate-800 text-sm">لیست برگه‌های خروج کالای انبار (کنترل فیزیکی و تحویل بار)</h3>
                <p className="text-xs text-slate-500">
                  ثبت تاییدیه تحویل بار توسط انباردار، ثبت مشخصات ماشین و شماره تماس راننده، به همراه چاپ فیزیکی و سوابق
                </p>
              </div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <button
                  type="button"
                  id="export-customer-slips-from-inventory-btn"
                  onClick={() => {
                    setCustomerExportSelected(null);
                    setIsCustomerExportModalOpen(true);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-200 rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer"
                  title="خروجی اکسل فاکتورها و حواله‌های خروج انبار یک شخص با تمام جزییات"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-purple-600" />
                  <span>اکسپورت اسناد و حواله‌های شخص</span>
                </button>
                <div className="text-xs text-slate-500 font-mono">
                  نمایش {toPersianDigits(filteredExitSlips.length)} از {toPersianDigits(invoices.length)} حواله
                </div>
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
                {/* Mobile View: Ultra-Clean 2-Row Cards */}
                <div className="block sm:hidden divide-y divide-slate-100">
                  {filteredExitSlips.map((inv) => {
                    const slipLog = exitSlipLogs[inv.id] || { invoiceId: inv.id, printCount: 0, history: [] };
                    const isDelivered = Boolean(slipLog.isDelivered);
                    const slipNumber = slipLog.slipNumber || inv.invoiceNumber;

                    return (
                      <div 
                        key={inv.id} 
                        onClick={() => setDetailSlipInvoice(inv)}
                        className="p-3.5 space-y-2.5 bg-white hover:bg-slate-50 transition-colors cursor-pointer active:bg-slate-100"
                      >
                        {/* Row 1: Number, Date, and Delivery Status */}
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-black text-slate-900 text-sm bg-slate-100 px-2 py-0.5 rounded-lg border border-slate-200" title="شماره حواله">
                              {toPersianDigits(slipNumber)}
                            </span>
                            {slipLog.slipNumber && slipLog.slipNumber !== inv.invoiceNumber && (
                              <span className="text-[10px] text-slate-400 font-mono">
                                (فاکتور: {toPersianDigits(inv.invoiceNumber)})
                              </span>
                            )}
                            <span className="text-xs text-slate-500 font-mono">
                              {toPersianDigits(inv.date)}
                            </span>
                          </div>

                          <span
                            className={`px-2 py-0.5 rounded-full font-bold text-[10px] flex items-center gap-1 border shrink-0 ${
                              isDelivered
                                ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                : 'bg-amber-100 text-amber-800 border-amber-300'
                            }`}
                          >
                            {isDelivered ? (
                              <>
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                <span>تحویل شد</span>
                              </>
                            ) : (
                              <>
                                <Clock className="w-3 h-3 text-amber-600" />
                                <span>در انتظار تحویل</span>
                              </>
                            )}
                          </span>
                        </div>

                        {/* Row 2: Customer Name and Details Button */}
                        <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100 text-xs">
                          <div className="font-bold text-slate-900 truncate max-w-[200px]" title={inv.customerName}>
                            {inv.customerName}
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDetailSlipInvoice(inv);
                              }}
                              className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5 text-emerald-600" />
                              <span>جزئیات</span>
                            </button>

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenExitSlip(inv);
                              }}
                              title="چاپ برگه خروج"
                              className="p-1 text-slate-500 hover:text-emerald-700 bg-slate-100 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                            >
                              <Printer className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Desktop View: Ultra-Clean Single-Row Table */}
                <div className="hidden sm:block overflow-x-auto">
                  <table className="w-full text-right border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-100/70 text-slate-700 border-b border-slate-200 select-none">
                        <th className="py-3.5 px-3 font-bold text-center w-12">#</th>
                        <th className="py-3.5 px-3 font-bold">شماره حواله</th>
                        <th className="py-3.5 px-3 font-bold">خریدار / تحویل‌گیرنده</th>
                        <th className="py-3.5 px-3 font-bold">تاریخ صدور</th>
                        <th className="py-3.5 px-3 font-bold text-center">وضعیت تحویل بار</th>
                        <th className="py-3.5 px-3 font-bold text-center w-36">عملیات</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredExitSlips.map((inv, index) => {
                        const slipLog = exitSlipLogs[inv.id] || { invoiceId: inv.id, printCount: 0, history: [] };
                        const isDelivered = Boolean(slipLog.isDelivered);
                        const slipNumber = slipLog.slipNumber || inv.invoiceNumber;

                        return (
                          <tr 
                            key={inv.id} 
                            onClick={() => setDetailSlipInvoice(inv)}
                            className={`${index % 2 === 1 ? 'bg-slate-50/70' : 'bg-white'} hover:bg-emerald-50/40 transition-colors cursor-pointer group`}
                          >
                            {/* Row index */}
                            <td className="py-3.5 px-3 text-center text-slate-400 font-mono font-bold text-[11px]">
                              {toPersianDigits(index + 1)}
                            </td>

                            {/* Slip Number */}
                            <td className="py-3.5 px-3">
                              <div className="flex items-center gap-1.5 font-mono font-black text-slate-900 text-xs">
                                <span className="bg-slate-100 group-hover:bg-white px-2.5 py-1 rounded-lg border border-slate-200">
                                  {toPersianDigits(slipNumber)}
                                </span>
                                {slipLog.slipNumber && slipLog.slipNumber !== inv.invoiceNumber && (
                                  <span className="text-[10px] text-slate-400 font-mono">
                                    (فاکتور: {toPersianDigits(inv.invoiceNumber)})
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Customer Name */}
                            <td className="py-3.5 px-3">
                              <div className="font-bold text-slate-900 truncate max-w-xs" title={inv.customerName}>
                                {inv.customerName}
                              </div>
                            </td>

                            {/* Issue Date */}
                            <td className="py-3.5 px-3 font-mono text-slate-600 whitespace-nowrap text-xs">
                              {toPersianDigits(inv.date)}
                            </td>

                            {/* Delivery Status */}
                            <td className="py-3.5 px-3 text-center whitespace-nowrap">
                              <span
                                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-bold text-[11px] border ${
                                  isDelivered
                                    ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                    : 'bg-amber-100 text-amber-800 border-amber-300'
                                }`}
                              >
                                {isDelivered ? (
                                  <>
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                    <span>تحویل شد</span>
                                  </>
                                ) : (
                                  <>
                                    <Clock className="w-3.5 h-3.5 text-amber-600" />
                                    <span>در انتظار تحویل</span>
                                  </>
                                )}
                              </span>
                            </td>

                            {/* Actions */}
                            <td className="py-3.5 px-3 text-center whitespace-nowrap">
                              <div className="flex items-center justify-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                                <button
                                  type="button"
                                  onClick={() => setDetailSlipInvoice(inv)}
                                  className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer shadow-2xs"
                                  title="مشاهده جزئیات کامل، خودرو و اقلام حواله خروج"
                                >
                                  <Eye className="w-3.5 h-3.5 text-emerald-600" />
                                  <span>مشاهده جزئیات</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleOpenExitSlip(inv)}
                                  className="p-2 text-slate-600 hover:text-emerald-700 hover:bg-slate-100 active:bg-slate-200 rounded-xl transition-colors cursor-pointer"
                                  title="چاپ برگه خروج"
                                >
                                  <Printer className="w-4 h-4" />
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

      {/* SUBTAB: DIRECT TRANSFERS (خروج و ورود مستقیم کالا بدون فاکتور - امانی / تعمیرات) */}
      {activeSubTab === 'direct-transfers' && (
        <DirectTransfersList
          transfers={directTransfers}
          products={products}
          settings={settings}
          currentUserName={currentUser?.fullName || currentUser?.name || 'انباردار'}
          onSaveDispatch={handleSaveDirectDispatch}
          onSaveReturn={handleSaveDirectReturn}
          onDeleteTransfer={handleDeleteDirectTransfer}
        />
      )}

      {/* MODAL: ADD / EDIT PRODUCT */}
      {isProductModalOpen && editingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200 w-full max-w-lg max-h-[92vh] flex flex-col overflow-hidden">
            {/* Sticky Header */}
            <div className="shrink-0 bg-slate-900 text-white px-5 py-3.5 flex items-center justify-between">
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

            {/* Form with scrollable body and sticky action buttons */}
            <form onSubmit={handleSaveProductForm} className="flex-1 flex flex-col min-h-0 overflow-hidden">
              <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
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

                  {/* فیلد کد کالا - با تعیین هوشمند خودکار توسط سیستم */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-semibold text-slate-700">کد اختصاصی کالا</label>
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-1.5 py-0.5 rounded-full flex items-center gap-1">
                        <Sparkles className="w-2.5 h-2.5 text-emerald-600" />
                        <span>سیستم</span>
                      </span>
                    </div>
                    <div className="relative">
                      <input
                        type="text"
                        id="product-modal-code"
                        value={editingProduct.code}
                        onChange={(e) => setEditingProduct({ ...editingProduct, code: e.target.value })}
                        placeholder="101"
                        maxLength={10}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 pl-9 text-xs font-mono font-bold text-slate-800 outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-left"
                      />
                      <button
                        type="button"
                        onClick={handleRegenerateCode}
                        className="absolute left-1.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-emerald-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                        title="تخصیص مجدد کد بعدی توسط سیستم"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-medium text-slate-700">دسته‌بندی</label>
                      <button
                        type="button"
                        onClick={() => setIsCategoryModalOpen(true)}
                        className="text-[10px] text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 cursor-pointer"
                        title="مدیریت و تعریف دسته‌بندی جدید"
                      >
                        <FolderTree className="w-3 h-3" />
                        <span>مدیریت دسته‌ها</span>
                      </button>
                    </div>
                    <div className="relative">
                      <input
                        type="text"
                        list="product-modal-categories-datalist"
                        id="product-modal-category"
                        value={editingProduct.category}
                        onChange={(e) => setEditingProduct({ ...editingProduct, category: e.target.value })}
                        placeholder="انتخاب یا تایپ دسته‌بندی..."
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-medium"
                      />
                      <datalist id="product-modal-categories-datalist">
                        {categories.map((c) => (
                          <option key={c} value={c} />
                        ))}
                      </datalist>
                    </div>
                    {/* Quick suggestion chips */}
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {categories.slice(0, 6).map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setEditingProduct({ ...editingProduct, category: c })}
                          className={`text-[10px] px-2 py-0.5 rounded-md font-medium transition-colors cursor-pointer ${
                            editingProduct.category === c
                              ? 'bg-indigo-600 text-white font-bold'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          {c}
                        </button>
                      ))}
                    </div>
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
                    <NumericInput
                      id="product-modal-minstock"
                      min={0}
                      value={editingProduct.minStockAlert}
                      onChange={(num) => setEditingProduct({ ...editingProduct, minStockAlert: num })}
                      textAlign="center"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-center font-bold font-mono"
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
                        <NumericInput
                          id="product-modal-buyprice"
                          min={0}
                          value={editingProduct.buyPrice}
                          onChange={(num) => setEditingProduct({ ...editingProduct, buyPrice: num })}
                          currency={settings.currency}
                          className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-bold font-mono text-slate-700"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">قیمت فروش ({settings.currency})</label>
                        <NumericInput
                          id="product-modal-sellprice"
                          min={0}
                          value={editingProduct.sellPrice}
                          onChange={(num) => setEditingProduct({ ...editingProduct, sellPrice: num })}
                          currency={settings.currency}
                          className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-bold font-mono text-emerald-700"
                        />
                      </div>
                    </div>
                  ) : null}

                  {/* VARIANT MANAGEMENT SECTION */}
                  <div className="col-span-2 bg-gradient-to-br from-purple-50/80 to-slate-50 border border-purple-200/90 rounded-2xl p-3.5 space-y-3">
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
                      <label className="relative inline-flex items-center cursor-pointer shrink-0">
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
                      <div className="pt-2.5 border-t border-purple-100 space-y-2.5">
                        <div className="flex flex-wrap items-center justify-between gap-2 bg-white p-2.5 rounded-xl border border-purple-200 shadow-2xs">
                          <div className="flex items-center gap-2 text-xs">
                            <span className="w-2 h-2 rounded-full bg-purple-600 animate-pulse"></span>
                            <span className="font-bold text-purple-900">
                              {toPersianDigits((editingProduct.variants || []).length)} تنوع تعریف شده
                            </span>
                            <span className="text-[11px] text-slate-500">
                              (مجموع: <strong className="font-mono font-bold text-purple-950">{formatNumber(editingProduct.stock)} {editingProduct.unit}</strong>)
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() => setIsVariantModalOpen(true)}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 active:scale-95 rounded-xl transition-all shadow-xs cursor-pointer"
                          >
                            <SlidersHorizontal className="w-3.5 h-3.5" />
                            <span>مدیریت تنوع‌ها در پنجره جدید</span>
                          </button>
                        </div>

                        {/* Summary pills of variants */}
                        {(editingProduct.variants || []).length > 0 ? (
                          <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-1">
                            {editingProduct.variants?.map((v) => (
                              <span
                                key={v.id}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-white text-purple-900 border border-purple-200 shadow-2xs"
                              >
                                <span>{v.name}</span>
                                <span className="text-[10px] text-purple-700 bg-purple-100 px-1.5 py-0.5 rounded font-mono">
                                  {formatNumber(v.stock)} {editingProduct.unit}
                                </span>
                              </span>
                            ))}
                          </div>
                        ) : (
                          <p className="text-[11px] text-amber-700 bg-amber-50 p-2 rounded-lg border border-amber-200">
                            هنوز تنوعی ثبت نشده است. لطفاً روی دکمه «مدیریت تنوع‌ها در پنجره جدید» کلیک کنید.
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  {!editingProduct.hasVariants && (
                    <div className="col-span-2 bg-emerald-50/50 p-3.5 rounded-2xl border border-emerald-200/80">
                      <label className="block text-xs font-bold text-slate-800 mb-1.5 flex items-center justify-between">
                        <span>موجودی کالا در انبار (موجودی اولیه / فعلی)</span>
                        <span className="text-[10px] text-emerald-700 bg-emerald-100/90 px-2 py-0.5 rounded-md font-semibold border border-emerald-300">
                          قابل ویرایش مستقیم
                        </span>
                      </label>
                      <div className="relative">
                        <NumericInput
                          id="product-modal-initialstock"
                          min={0}
                          value={editingProduct.stock}
                          onChange={(num) => setEditingProduct({ ...editingProduct, stock: num })}
                          textAlign="center"
                          className="w-full bg-white border border-emerald-300 rounded-xl px-3 py-2 text-xs font-bold font-mono outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 text-slate-900 text-center"
                        />
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1.5 leading-relaxed">
                        با ویرایش این مقدار، موجودی فعلی انبار تغییر کرده و سند اصلاحی کاردکس نیز به صورت خودکار ثبت خواهد شد.
                      </p>
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
              </div>

              {/* Sticky Action Footer */}
              <div className="shrink-0 bg-slate-50 border-t border-slate-200 px-5 py-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsProductModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 bg-white border border-slate-300 rounded-xl hover:bg-slate-100 cursor-pointer"
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

      {/* SUB-MODAL: MANAGE PRODUCT VARIANTS (پنجره اختصاصی مدیریت تنوع‌های کالا) */}
      {isVariantModalOpen && editingProduct && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-xs">
          <div className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="shrink-0 bg-gradient-to-r from-purple-900 to-indigo-900 text-white px-4 sm:px-6 py-3.5 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-purple-800/80 text-purple-200 flex items-center justify-center shrink-0 border border-purple-700">
                  <Layers className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-black text-sm">مدیریت تنوع کالا (رنگ، مدل، سایز)</h3>
                  <div className="text-[11px] text-purple-200 flex items-center gap-1">
                    <span>کالا:</span>
                    <span className="font-bold text-white">{editingProduct.name || 'بدون نام'}</span>
                    <span className="text-purple-300">({toPersianDigits((editingProduct.variants || []).length)} تنوع)</span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsVariantModalOpen(false)}
                className="text-purple-300 hover:text-white p-1 rounded-lg hover:bg-purple-800/50 transition-colors cursor-pointer"
                title="بستن و بازگشت به فرم کالا"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content (Scrollable) */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
              {/* Quick color additions */}
              <div className="bg-purple-50/70 p-3 rounded-2xl border border-purple-100 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-purple-900 font-bold flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                    <span>افزودن سریع رنگ‌های پرکاربرد:</span>
                  </span>
                  <span className="text-[10px] text-purple-700 font-medium">با یک کلیک اضافه کنید</span>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {['طوسی', 'قرمز', 'سبز', 'زرد', 'آبی', 'مشکی', 'سفید', 'نچرال'].map((color) => {
                    const exists = (editingProduct.variants || []).some((v) => v.name.trim() === color);
                    return (
                      <button
                        key={color}
                        type="button"
                        disabled={exists}
                        onClick={() => handleAddQuickVariant(color)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                          exists
                            ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                            : 'bg-white text-purple-900 border border-purple-200 hover:bg-purple-100 hover:border-purple-300 cursor-pointer shadow-2xs active:scale-95'
                        }`}
                      >
                        + {color}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Custom Variant Form */}
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  id="custom-variant-name-input"
                  placeholder="نام تنوع دلخواه (مثلاً: مدل Pro، سایز XL، رنگ خاکی)..."
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      const val = (e.target as HTMLInputElement).value.trim();
                      if (val) {
                        handleAddQuickVariant(val);
                        (e.target as HTMLInputElement).value = '';
                      }
                    }
                  }}
                  className="flex-1 bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20"
                />
                <button
                  type="button"
                  onClick={() => {
                    const inp = document.getElementById('custom-variant-name-input') as HTMLInputElement;
                    if (inp && inp.value.trim()) {
                      handleAddQuickVariant(inp.value.trim());
                      inp.value = '';
                    }
                  }}
                  className="px-3.5 py-2 bg-purple-700 hover:bg-purple-800 text-white rounded-xl text-xs font-bold flex items-center gap-1 shrink-0 cursor-pointer shadow-xs active:scale-95"
                >
                  <Plus className="w-4 h-4" />
                  <span>افزودن</span>
                </button>
              </div>

              {/* Variants List: Desktop Table + Mobile Cards */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-slate-700 px-1">
                  <span>لیست تنوع‌های تعریف شده ({toPersianDigits((editingProduct.variants || []).length)} قلم):</span>
                  <span className="text-[11px] text-purple-800 font-medium">
                    مجموع موجودی: <strong className="font-mono text-purple-950 font-bold">{toPersianDigits(editingProduct.stock)} {editingProduct.unit}</strong>
                  </span>
                </div>

                {(editingProduct.variants || []).length === 0 ? (
                  <div className="p-8 text-center bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl text-slate-400 text-xs">
                    هنوز تنوعی اضافه نشده است. از رنگ‌های سریع یا کادر بالا برای ایجاد تنوع استفاده کنید.
                  </div>
                ) : (
                  <>
                    {/* Desktop Table */}
                    <div className="hidden sm:block bg-white rounded-2xl border border-purple-200/90 overflow-hidden shadow-2xs">
                      <table className="w-full text-right text-xs">
                        <thead className="bg-purple-50 text-purple-900 border-b border-purple-100 font-bold">
                          <tr>
                            <th className="p-3">نام تنوع / رنگ *</th>
                            <th className="p-3">کد تنوع (سیستم)</th>
                            <th className="p-3 text-center w-24">موجودی</th>
                            {currentUser?.role === 'admin' && <th className="p-3 text-center w-28">قیمت فروش</th>}
                            <th className="p-3 text-center w-10">حذف</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-purple-50">
                          {(editingProduct.variants || []).map((v, vIndex) => (
                            <tr key={v.id} className="hover:bg-purple-50/30 transition-colors">
                              <td className="p-2">
                                <input
                                  type="text"
                                  required
                                  placeholder="مثلاً: طوسی"
                                  value={v.name}
                                  onChange={(e) => handleUpdateVariantField(v.id, 'name', e.target.value)}
                                  className="w-full bg-slate-50 focus:bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs outline-none focus:border-purple-500 font-bold text-slate-800"
                                />
                              </td>
                              <td className="p-2">
                                <input
                                  type="text"
                                  placeholder={`${editingProduct.code || '101'}-${v.name}`}
                                  value={v.code || ''}
                                  onChange={(e) => handleUpdateVariantField(v.id, 'code', e.target.value)}
                                  className="w-full bg-slate-50 focus:bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-mono outline-none focus:border-purple-500 text-left font-bold"
                                />
                              </td>
                              <td className="p-2">
                                <NumericInput
                                  min={0}
                                  value={v.stock}
                                  onChange={(num) => handleUpdateVariantField(v.id, 'stock', num)}
                                  textAlign="center"
                                  className="w-full bg-slate-50 focus:bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-center font-bold font-mono outline-none focus:border-purple-500"
                                />
                              </td>
                              {currentUser?.role === 'admin' && (
                                <td className="p-2">
                                  <NumericInput
                                    min={0}
                                    value={v.sellPrice || editingProduct.sellPrice || 0}
                                    onChange={(num) => handleUpdateVariantField(v.id, 'sellPrice', num)}
                                    textAlign="center"
                                    className="w-full bg-slate-50 focus:bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-center font-mono outline-none focus:border-purple-500"
                                  />
                                </td>
                              )}
                              <td className="p-2 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleRemoveVariant(v.id)}
                                  className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                                  title="حذف تنوع"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Mobile Cards (no horizontal overflow) */}
                    <div className="sm:hidden space-y-2.5">
                      {(editingProduct.variants || []).map((v, idx) => (
                        <div key={v.id} className="bg-white p-3 rounded-2xl border border-purple-200 shadow-2xs space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-black text-purple-900">
                              تنوع {toPersianDigits(idx + 1)}:
                            </span>
                            <button
                              type="button"
                              onClick={() => handleRemoveVariant(v.id)}
                              className="text-rose-500 hover:text-rose-700 p-1 rounded-lg"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                          <div>
                            <label className="block text-[11px] font-bold text-slate-600 mb-1">نام تنوع / رنگ *</label>
                            <input
                              type="text"
                              value={v.name}
                              onChange={(e) => handleUpdateVariantField(v.id, 'name', e.target.value)}
                              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800"
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[10px] font-medium text-slate-500 mb-1">موجودی ({editingProduct.unit})</label>
                              <NumericInput
                                min={0}
                                value={v.stock}
                                onChange={(num) => handleUpdateVariantField(v.id, 'stock', num)}
                                textAlign="center"
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2 py-1.5 text-xs font-mono font-bold text-center"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-medium text-slate-500 mb-1">کد اختصاصی (سیستم)</label>
                              <input
                                type="text"
                                value={v.code || ''}
                                onChange={(e) => handleUpdateVariantField(v.id, 'code', e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2 py-1.5 text-xs font-mono text-left font-bold"
                              />
                            </div>
                          </div>
                          {currentUser?.role === 'admin' && (
                            <div>
                              <label className="block text-[10px] font-medium text-slate-500 mb-1">قیمت فروش ({settings.currency})</label>
                              <NumericInput
                                min={0}
                                value={v.sellPrice || editingProduct.sellPrice || 0}
                                onChange={(num) => handleUpdateVariantField(v.id, 'sellPrice', num)}
                                textAlign="center"
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-mono text-center"
                              />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="shrink-0 bg-slate-50 border-t border-slate-200 px-4 sm:px-6 py-3 flex items-center justify-between">
              <div className="text-xs text-slate-600">
                <span>تعداد تنوع‌ها: </span>
                <strong className="text-purple-900 font-bold font-mono">{toPersianDigits((editingProduct.variants || []).length)}</strong>
              </div>
              <button
                type="button"
                onClick={() => setIsVariantModalOpen(false)}
                className="flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white bg-purple-700 hover:bg-purple-800 rounded-xl shadow-xs cursor-pointer active:scale-95"
              >
                <Check className="w-4 h-4" />
                <span>تایید و بازگشت به فرم کالا</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: STOCK ADJUSTMENT / INTAKE */}
      {adjustingProduct && (() => {
        const hasVars = !!adjustingProduct.hasVariants && Array.isArray(adjustingProduct.variants) && adjustingProduct.variants.length > 0;
        const currentTargetStock = hasVars && selectedVariantId
          ? (adjustingProduct.variants?.find((v) => v.id === selectedVariantId)?.stock || 0)
          : (adjustingProduct.stock || 0);

        const projectedStock = adjustType === 'set_stock'
          ? Math.max(0, exactStockTarget)
          : adjustType === 'purchase'
          ? currentTargetStock + Math.max(0, adjustQuantity)
          : Math.max(0, currentTargetStock - Math.max(0, adjustQuantity));

        const diff = projectedStock - currentTargetStock;

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
              <div className="bg-slate-900 text-white px-5 py-3.5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {adjustType === 'purchase' && <ArrowDownRight className="w-5 h-5 text-emerald-400" />}
                  {adjustType === 'set_stock' && <Boxes className="w-5 h-5 text-blue-400" />}
                  {adjustType === 'adjustment' && <ArrowUpLeft className="w-5 h-5 text-rose-400" />}
                  <h3 className="font-bold text-sm">
                    {adjustType === 'purchase'
                      ? 'ورود کالا به انبار (افزایش موجودی)'
                      : adjustType === 'set_stock'
                      ? 'انبارگردانی (شمارش فیزیکی و ثبت موجودی)'
                      : 'خروج کالا از انبار (کاهش موجودی)'}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setAdjustingProduct(null)}
                  className="text-slate-400 hover:text-white p-1 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmitStockAdjust} className="p-5 space-y-4">
                {/* Product Summary Card */}
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs flex items-center justify-between">
                  <div>
                    <div className="font-bold text-slate-800 text-sm">{adjustingProduct.name}</div>
                    <div className="text-slate-500 mt-0.5">کد: {toPersianDigits(adjustingProduct.code)}</div>
                  </div>
                  <div className="text-left">
                    <span className="text-[10px] text-slate-400 block">موجودی کل فعلی</span>
                    <strong className="text-sm font-bold text-slate-800">
                      {formatNumber(adjustingProduct.stock)} {adjustingProduct.unit}
                    </strong>
                  </div>
                </div>

                {/* Variant Selector (if applicable) */}
                {hasVars && (
                  <div>
                    <label className="block text-xs font-bold text-purple-900 mb-1.5 flex items-center gap-1">
                      <Layers className="w-3.5 h-3.5 text-purple-600" />
                      <span>انتخاب تنوع کالا جهت عملیات:</span>
                    </label>
                    <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto p-1">
                      {adjustingProduct.variants!.map((v) => {
                        const isSelected = selectedVariantId === v.id;
                        return (
                          <button
                            key={v.id}
                            type="button"
                            onClick={() => {
                              setSelectedVariantId(v.id);
                              if (adjustType === 'set_stock') {
                                setExactStockTarget(Number(v.stock) || 0);
                              }
                            }}
                            className={`p-2.5 rounded-xl border text-right transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-purple-50 border-purple-500 text-purple-950 font-bold ring-2 ring-purple-500/20 shadow-xs'
                                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                            }`}
                          >
                            <div className="text-xs font-bold">{v.name}</div>
                            <div className="text-[10px] text-slate-500 mt-0.5">
                              موجودی: <strong className="font-mono text-purple-700">{formatNumber(v.stock)}</strong> {adjustingProduct.unit}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Operation Type Switcher */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">نوع عملیات انبار:</label>
                  <div className="grid grid-cols-3 gap-1.5 bg-slate-100 p-1 rounded-xl">
                    <button
                      type="button"
                      onClick={() => {
                        setAdjustType('purchase');
                        setAdjustNote('ورود کالای جدید به انبار (خرید)');
                      }}
                      className={`py-2 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
                        adjustType === 'purchase'
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      + ورود کالا
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAdjustType('set_stock');
                        setExactStockTarget(currentTargetStock);
                        setAdjustNote('ثبت موجودی واقعی در انبارگردانی');
                      }}
                      className={`py-2 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
                        adjustType === 'set_stock'
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      📋 انبارگردانی
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAdjustType('adjustment');
                        setAdjustNote('کاهش و خروج از انبار');
                      }}
                      className={`py-2 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
                        adjustType === 'adjustment'
                          ? 'bg-rose-600 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      - خروج / کاهش
                    </button>
                  </div>
                </div>

                {/* Main Input Field */}
                {adjustType === 'set_stock' ? (
                  <div className="bg-blue-50/60 p-3 rounded-xl border border-blue-200 space-y-1">
                    <label className="block text-xs font-bold text-blue-900 mb-1">
                      موجودی فیزیکی شمارش‌شده در انبار ({adjustingProduct.unit}) *
                    </label>
                    <NumericInput
                      min={0}
                      required
                      id="stock-adjust-exact-input"
                      value={exactStockTarget}
                      onChange={(num) => setExactStockTarget(num)}
                      textAlign="center"
                      className="w-full bg-white border border-blue-300 rounded-xl px-3 py-2 text-sm font-bold text-center font-mono outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-600"
                    />
                    <p className="text-[10px] text-blue-600 text-center mt-1">
                      موجودی انبار مستقیماً روی این عدد تنظیم خواهد شد.
                    </p>
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      {adjustType === 'purchase' ? 'تعداد ورودی به انبار' : 'تعداد خروجی از انبار'} ({adjustingProduct.unit}) *
                    </label>
                    <NumericInput
                      min={1}
                      required
                      id="stock-adjust-quantity-input"
                      value={adjustQuantity}
                      onChange={(num) => setAdjustQuantity(num || 1)}
                      textAlign="center"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-center font-mono outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                  </div>
                )}

                {/* Calculation Preview Box */}
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex items-center justify-between text-xs">
                  <div className="text-center flex-1">
                    <span className="text-[10px] text-slate-400 block">موجودی فعلی</span>
                    <strong className="text-slate-700 font-bold font-mono">
                      {toPersianDigits(currentTargetStock)}
                    </strong>
                  </div>
                  <div className="text-slate-300 font-bold text-lg">➔</div>
                  <div className="text-center flex-1">
                    <span className="text-[10px] text-slate-400 block">موجودی جدید نهایی</span>
                    <strong className="text-slate-900 font-black font-mono text-sm">
                      {toPersianDigits(projectedStock)} {adjustingProduct.unit}
                    </strong>
                  </div>
                  <div className="text-center flex-1">
                    <span className="text-[10px] text-slate-400 block">میزان تغییر</span>
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold font-mono ${
                        diff > 0
                          ? 'bg-emerald-100 text-emerald-800'
                          : diff < 0
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      {diff > 0 ? `+${toPersianDigits(diff)}` : toPersianDigits(diff)}
                    </span>
                  </div>
                </div>

                {/* Note */}
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
                    className="flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl shadow-xs cursor-pointer active:scale-98 transition-all"
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>ثبت تغییر در انبار</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

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

      {/* EXIT SLIP DETAILS MODAL */}
      {detailSlipInvoice && (
        <ErrorBoundary fallbackTitle="خطا در نمایش جزئیات حواله خروج" onReset={() => setDetailSlipInvoice(null)}>
          <ExitSlipDetailsModal
            isOpen={Boolean(detailSlipInvoice)}
            invoice={detailSlipInvoice}
            slipLog={exitSlipLogs[detailSlipInvoice.id] || { invoiceId: detailSlipInvoice.id, printCount: 0, history: [] }}
            settings={settings}
            currentUser={currentUser}
            onClose={() => setDetailSlipInvoice(null)}
            onPrint={(inv) => {
              setDetailSlipInvoice(null);
              handleOpenExitSlip(inv);
            }}
            onOpenDeliveryModal={(inv) => {
              setDetailSlipInvoice(null);
              setDeliveryModalInvoice(inv);
            }}
            onOpenHistoryModal={(inv) => {
              setDetailSlipInvoice(null);
              setHistoryModalInvoice(inv);
            }}
            onExportCustomer={(inv) => {
              setDetailSlipInvoice(null);
              const found = customersList.find((c) => c.id === inv.customerId || c.name.trim().toLowerCase() === inv.customerName.trim().toLowerCase());
              setCustomerExportSelected(found || {
                id: inv.customerId || `cust-${inv.customerName}`,
                name: inv.customerName,
                phone: inv.customerPhone || '',
                createdAt: inv.date,
              });
              setIsCustomerExportModalOpen(true);
            }}
            onToggleDelivery={(invId) => {
              handleQuickToggleDelivery(invId);
            }}
          />
        </ErrorBoundary>
      )}

      {/* EXIT SLIP PRINT MODAL */}
      {selectedExitSlipInvoice && (
        <ErrorBoundary fallbackTitle="خطا در نمایش برگه چاپ حواله خروج" onReset={() => setSelectedExitSlipInvoice(null)}>
          <ExitSlipModal
            invoice={selectedExitSlipInvoice}
            settings={settings}
            currentUser={currentUser}
            slipLog={exitSlipLogs[selectedExitSlipInvoice.id] || { invoiceId: selectedExitSlipInvoice.id, printCount: 0, history: [] }}
            onRecordPrint={(currentSlip) => handleRecordExitSlipPrint(selectedExitSlipInvoice.id, currentSlip)}
            onUpdateDelivery={(deliveryData) => handleSaveExitSlipDelivery(selectedExitSlipInvoice.id, deliveryData)}
            onUpdateSettings={onUpdateSettings}
            onClose={() => setSelectedExitSlipInvoice(null)}
          />
        </ErrorBoundary>
      )}

      {/* EXIT SLIP DELIVERY & VEHICLE MODAL */}
      {deliveryModalInvoice && (
        <ErrorBoundary fallbackTitle="خطا در باز کردن پنجره ثبت راننده و خودرو" onReset={() => setDeliveryModalInvoice(null)}>
          <ExitSlipDeliveryModal
            isOpen={Boolean(deliveryModalInvoice)}
            invoice={deliveryModalInvoice}
            slipLog={exitSlipLogs[deliveryModalInvoice.id] || { invoiceId: deliveryModalInvoice.id, printCount: 0, history: [] }}
            settings={settings}
            currentUser={currentUser}
            onClose={() => setDeliveryModalInvoice(null)}
            onSave={(deliveryData) => handleSaveExitSlipDelivery(deliveryModalInvoice.id, deliveryData)}
            onSaveAndPrint={(deliveryData) => {
              handleSaveExitSlipDelivery(deliveryModalInvoice.id, deliveryData);
              const targetInv = deliveryModalInvoice;
              setDeliveryModalInvoice(null);
              handleOpenExitSlip(targetInv);
            }}
          />
        </ErrorBoundary>
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
                      handleOpenExitSlip(targetInv);
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

      {/* CUSTOMER INVOICES & EXIT SLIPS EXCEL EXPORT MODAL */}
      <CustomerExportModal
        isOpen={isCustomerExportModalOpen}
        onClose={() => {
          setIsCustomerExportModalOpen(false);
          setCustomerExportSelected(null);
        }}
        initialCustomerId={customerExportSelected?.id}
        customers={customersList}
        invoices={invoices || []}
        settings={settings}
      />

      {/* CATEGORY MANAGER MODAL */}
      {isCategoryModalOpen && (
        <CategoryManagerModal
          categories={categories}
          products={products}
          currency={settings.currency}
          onAddCategory={handleAddCategory}
          onRenameCategory={handleRenameCategory}
          onDeleteCategory={handleDeleteCategory}
          onSelectCategory={(cat) => setSelectedCategory(cat)}
          onClose={() => setIsCategoryModalOpen(false)}
        />
      )}

      {/* PRODUCT DETAILS MODAL (صفحه جداگانه / مودال مشخصات کامل کالا) */}
      {detailProduct && (
        <ProductDetailsModal
          isOpen={Boolean(detailProduct)}
          product={detailProduct}
          settings={settings}
          currentUser={currentUser}
          onClose={() => setDetailProduct(null)}
          onOpenEdit={(prod) => {
            setDetailProduct(null);
            handleOpenEditProduct(prod);
          }}
          onOpenStockIn={(prod) => {
            setDetailProduct(null);
            handleOpenAdjustStock(prod, 'purchase');
          }}
          onOpenInventoryCount={(prod) => {
            setDetailProduct(null);
            handleOpenAdjustStock(prod, 'set_stock');
          }}
          onDelete={(prod) => {
            setDetailProduct(null);
            setProductToDelete(prod);
          }}
        />
      )}
    </div>
  );
};
