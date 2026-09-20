import React, { useState, useMemo, useEffect } from 'react';
import { Product, ProductVariant, Customer, Invoice, InvoiceItem, StoreSettings, PaymentMethod } from '../types';
import { getCurrentJalaliDate, formatPrice, toPersianDigits, toEnglishDigits } from '../utils/jalali';
import { 
  Plus, 
  Minus, 
  Trash2, 
  Search, 
  X, 
  Check, 
  ChevronLeft, 
  ChevronDown, 
  Package, 
  Boxes, 
  Shapes, 
  ScanLine, 
  Camera, 
  User, 
  UserPlus, 
  Contact, 
  FileText, 
  SlidersHorizontal, 
  ArrowUpDown, 
  CheckCircle2, 
  AlertTriangle, 
  CreditCard, 
  Banknote, 
  Landmark, 
  Calendar, 
  Hash, 
  Sparkles, 
  Pencil, 
  Printer,
  Percent,
  Layers,
  GraduationCap,
  RotateCcw,
  ShoppingBag,
  ArrowRight,
  Eye,
  Info,
  RefreshCw
} from 'lucide-react';
import { StorageService } from '../utils/storage';
import {
  generateNextProductCode,
  generateProductBarcode,
  generateNextServiceCode,
  generateServiceBarcode,
} from '../utils/codeGenerator';

interface InvoiceBuilderProps {
  products: Product[];
  customers: Customer[];
  settings: StoreSettings;
  initialIsProforma?: boolean;
  editingInvoice?: Invoice | null;
  onSaveInvoice: (invoice: Invoice, shouldPrint: boolean) => void;
  onUpdateInvoice?: (originalInvoice: Invoice, updatedInvoice: Invoice, shouldPrint: boolean) => void;
  onAddNewCustomer: (customer: Omit<Customer, 'id' | 'createdAt'>) => Customer;
  onSaveProduct?: (product: Product) => void;
  onCancel?: () => void;
}

export const InvoiceBuilder: React.FC<InvoiceBuilderProps> = ({
  products,
  customers,
  settings,
  initialIsProforma = false,
  editingInvoice,
  onSaveInvoice,
  onUpdateInvoice,
  onAddNewCustomer,
  onSaveProduct,
  onCancel,
}) => {
  const isEditing = !!editingInvoice;

  // Document mode (Regular invoice vs Proforma)
  const [isProforma, setIsProforma] = useState<boolean>(() => {
    if (editingInvoice) return !!editingInvoice.isProforma;
    return initialIsProforma;
  });

  // Invoice Number & Date & Type
  const initialInvoiceNum = useMemo(() => {
    return initialIsProforma
      ? `PF-${Math.floor(1000 + Math.random() * 9000)}`
      : `INV-${Math.floor(1000 + Math.random() * 9000)}`;
  }, [initialIsProforma]);

  const [invoiceNumber, setInvoiceNumber] = useState<string>(() => {
    if (editingInvoice) return editingInvoice.invoiceNumber;
    return initialInvoiceNum;
  });

  const [invoiceType, setInvoiceType] = useState<'standard' | 'official' | 'thermal'>(() => {
    if (editingInvoice) return editingInvoice.type || 'standard';
    return settings.defaultTemplate || 'standard';
  });

  const [invoiceDate, setInvoiceDate] = useState<string>(() => {
    if (editingInvoice) return editingInvoice.date;
    return getCurrentJalaliDate();
  });

  // Customer State
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(() => {
    if (editingInvoice && editingInvoice.customerId && editingInvoice.customerId !== 'guest') {
      return editingInvoice.customerId;
    }
    return '';
  });
  const [customerName, setCustomerName] = useState<string>(() => {
    if (editingInvoice) return editingInvoice.customerName || 'متفرقه';
    return 'متفرقه';
  });
  const [customerPhone, setCustomerPhone] = useState<string>(() => {
    if (editingInvoice) return editingInvoice.customerPhone || '';
    return '';
  });
  const [customerAddress, setCustomerAddress] = useState<string>(() => {
    if (editingInvoice) return editingInvoice.customerAddress || '';
    return '';
  });
  const [customerNationalId, setCustomerNationalId] = useState<string>(() => {
    if (editingInvoice) return editingInvoice.customerNationalId || '';
    return '';
  });

  // Items State
  const [items, setItems] = useState<InvoiceItem[]>(() => {
    if (editingInvoice && editingInvoice.items && editingInvoice.items.length > 0) {
      return editingInvoice.items.map((it, idx) => ({
        ...it,
        id: it.id || `row-${idx + 1}`,
      }));
    }
    return [];
  });

  // Sort order state
  const [sortOrder, setSortOrder] = useState<'default' | 'price-asc' | 'price-desc' | 'name'>('default');

  // Search filter query inside invoice
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);
  const [filterQuery, setFilterQuery] = useState<string>('');

  // Tax & Discount & Payments
  const [taxEnabled, setTaxEnabled] = useState<boolean>(() => {
    if (editingInvoice) return editingInvoice.taxRate > 0;
    return settings.taxEnabled;
  });
  const [taxRate, setTaxRate] = useState<number>(() => {
    if (editingInvoice && editingInvoice.taxRate > 0) return editingInvoice.taxRate;
    return settings.taxPercent || 10;
  });
  const [extraDiscount, setExtraDiscount] = useState<number>(() => {
    if (editingInvoice) {
      const itemsDisc = editingInvoice.items?.reduce((s, it) => s + (it.discount || 0), 0) || 0;
      return Math.max(0, (editingInvoice.totalDiscount || 0) - itemsDisc);
    }
    return 0;
  });
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(() => {
    if (editingInvoice) return editingInvoice.paymentMethod || 'cash';
    if (settings.enableCashPayment !== false) return 'cash';
    if (settings.enableChequePayment) return 'cheque';
    if (settings.enableTransferPayment !== false) return 'transfer';
    return 'cash';
  });
  const [paymentStatus, setPaymentStatus] = useState<'paid' | 'unpaid' | 'partial'>(() => {
    if (editingInvoice) return editingInvoice.paymentStatus || 'paid';
    return 'paid';
  });
  const [paidAmount, setPaidAmount] = useState<number>(() => {
    if (editingInvoice) return editingInvoice.paidAmount ?? (editingInvoice.paymentStatus === 'paid' ? editingInvoice.finalTotal : 0);
    return 0;
  });
  const [notes, setNotes] = useState<string>(() => {
    if (editingInvoice) return editingInvoice.notes || '';
    return '';
  });
  const [errorMessage, setErrorMessage] = useState<string>('');

  // Cheque Fields
  const [chequeNumber, setChequeNumber] = useState<string>(() => editingInvoice?.chequeNumber || '');
  const [chequeDueDate, setChequeDueDate] = useState<string>(() => editingInvoice?.chequeDueDate || '');
  const [chequeName, setChequeName] = useState<string>(() => editingInvoice?.chequeName || '');

  // Transfer Fields
  const [transferDescription, setTransferDescription] = useState<string>(() => editingInvoice?.transferDescription || '');

  // Modals state
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState<boolean>(false);
  const [isNewCustomerFormOpen, setIsNewCustomerFormOpen] = useState<boolean>(false);
  const [customerSearchQuery, setCustomerSearchQuery] = useState<string>('');

  const [isProductCatalogOpen, setIsProductCatalogOpen] = useState<boolean>(false);
  const [productCatalogSearch, setProductCatalogSearch] = useState<string>('');
  const [catalogCategory, setCatalogCategory] = useState<string>('all');
  const [catalogOnlyInStock, setCatalogOnlyInStock] = useState<boolean>(false);
  const [variantPickerProduct, setVariantPickerProduct] = useState<Product | null>(null);
  const [viewingCatalogProduct, setViewingCatalogProduct] = useState<Product | null>(null);
  const [editingCatalogProduct, setEditingCatalogProduct] = useState<Product | null>(null);
  const [editProductForm, setEditProductForm] = useState<{
    name: string;
    code: string;
    barcode: string;
    category: string;
    unit: string;
    stock: number;
    minStockAlert: number;
    buyPrice: number;
    sellPrice: number;
    description: string;
  }>({
    name: '',
    code: '',
    barcode: '',
    category: '',
    unit: 'عدد',
    stock: 0,
    minStockAlert: 5,
    buyPrice: 0,
    sellPrice: 0,
    description: '',
  });

  const [isServiceModalOpen, setIsServiceModalOpen] = useState<boolean>(false);
  const [serviceName, setServiceName] = useState<string>('');
  const [servicePrice, setServicePrice] = useState<number>(0);
  const [serviceQuantity, setServiceQuantity] = useState<number>(1);
  const [serviceUnit, setServiceUnit] = useState<string>('موردی');

  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState<boolean>(false);
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState<boolean>(false);

  // Quick Customer Creation Inputs
  const [newCustName, setNewCustName] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');
  const [newCustAddress, setNewCustAddress] = useState('');
  const [newCustNationalId, setNewCustNationalId] = useState('');

  // Calculations
  const subtotal = useMemo(() => {
    return items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  }, [items]);

  const rowDiscounts = useMemo(() => {
    return items.reduce((sum, item) => sum + (item.discount || 0), 0);
  }, [items]);

  const totalDiscount = useMemo(() => {
    return rowDiscounts + extraDiscount;
  }, [rowDiscounts, extraDiscount]);

  const taxableAmount = useMemo(() => {
    return Math.max(0, subtotal - totalDiscount);
  }, [subtotal, totalDiscount]);

  const taxAmount = useMemo(() => {
    return taxEnabled ? Math.round((taxableAmount * taxRate) / 100) : 0;
  }, [taxEnabled, taxableAmount, taxRate]);

  const finalTotal = useMemo(() => {
    return taxableAmount + taxAmount;
  }, [taxableAmount, taxAmount]);

  // Product Catalog Categories
  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      if (p.category) set.add(p.category);
    });
    return Array.from(set);
  }, [products]);

  // Filtered Products for Catalog
  const filteredProducts = useMemo(() => {
    let list = products;
    if (catalogCategory !== 'all') {
      list = list.filter((p) => p.category === catalogCategory);
    }
    if (catalogOnlyInStock) {
      list = list.filter((p) => p.stock > 0);
    }
    if (productCatalogSearch.trim()) {
      const q = productCatalogSearch.trim().toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.code.toLowerCase().includes(q) ||
          (p.barcode && p.barcode.toLowerCase().includes(q)) ||
          (p.category && p.category.toLowerCase().includes(q))
      );
    }
    return list;
  }, [products, catalogCategory, catalogOnlyInStock, productCatalogSearch]);

  // Filtered & Sorted Invoice Items
  const displayedItems = useMemo(() => {
    let list = [...items];
    if (filterQuery.trim()) {
      const q = filterQuery.trim().toLowerCase();
      list = list.filter((it) => it.productName.toLowerCase().includes(q) || it.productCode?.toLowerCase().includes(q));
    }
    if (sortOrder === 'price-asc') {
      list.sort((a, b) => a.unitPrice - b.unitPrice);
    } else if (sortOrder === 'price-desc') {
      list.sort((a, b) => b.unitPrice - a.unitPrice);
    } else if (sortOrder === 'name') {
      list.sort((a, b) => a.productName.localeCompare(b.productName, 'fa'));
    }
    return list;
  }, [items, filterQuery, sortOrder]);

  // Add a product from catalog (with variant support)
  const handleAddProduct = (prod: Product, variant?: ProductVariant) => {
    // If product has variants and no specific variant is passed, open variant picker
    if (prod.hasVariants && prod.variants && prod.variants.length > 0 && !variant) {
      setVariantPickerProduct(prod);
      return;
    }

    const targetVariantId = variant?.id;
    const existingIndex = items.findIndex(
      (it) => it.productId === prod.id && it.variantId === targetVariantId
    );

    if (existingIndex !== -1) {
      // Increment quantity
      setItems((prev) => {
        const next = [...prev];
        const item = { ...next[existingIndex] };
        item.quantity += 1;
        item.total = Math.max(0, item.quantity * item.unitPrice - (item.discount || 0));
        next[existingIndex] = item;
        return next;
      });
    } else {
      // Add new row
      const unitPrice = variant?.sellPrice && variant.sellPrice > 0 ? variant.sellPrice : prod.sellPrice;
      const newItem: InvoiceItem = {
        id: `row-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
        productId: prod.id,
        productName: variant ? `${prod.name} (${variant.name})` : prod.name,
        productCode: variant?.code || prod.code,
        barcode: variant?.barcode || prod.barcode,
        unit: prod.unit || 'عدد',
        quantity: 1,
        unitPrice: unitPrice,
        buyPrice: prod.buyPrice,
        discount: 0,
        total: unitPrice,
        variantId: variant?.id,
        variantName: variant?.name,
      };
      setItems((prev) => [newItem, ...prev]);
    }

    if (variantPickerProduct) {
      setVariantPickerProduct(null);
    }
  };

  // Decrement or remove product from invoice directly in catalog modal
  const handleDecrementProduct = (prod: Product) => {
    const existingIndex = items.findIndex((it) => it.productId === prod.id);
    if (existingIndex !== -1) {
      setItems((prev) => {
        const next = [...prev];
        const item = { ...next[existingIndex] };
        if (item.quantity > 1) {
          item.quantity -= 1;
          item.total = Math.max(0, item.quantity * item.unitPrice - (item.discount || 0));
          next[existingIndex] = item;
        } else {
          next.splice(existingIndex, 1);
        }
        return next;
      });
    }
  };

  // Open Quick Edit for a product from the catalog
  const handleOpenEditProduct = (prod: Product) => {
    setEditingCatalogProduct(prod);
    const otherProducts = products.filter((p) => p.id !== prod.id);
    const safeCode = prod.code?.trim() || generateNextProductCode(otherProducts);
    const safeBarcode = prod.barcode?.trim() || generateProductBarcode(safeCode, otherProducts);
    setEditProductForm({
      name: prod.name || '',
      code: safeCode,
      barcode: safeBarcode,
      category: prod.category || '',
      unit: prod.unit || 'عدد',
      stock: prod.stock ?? 0,
      minStockAlert: prod.minStockAlert ?? 5,
      buyPrice: prod.buyPrice ?? 0,
      sellPrice: prod.sellPrice ?? 0,
      description: prod.description || '',
    });
  };

  // Save product edit directly from catalog modal
  const handleSaveProductEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCatalogProduct || !editProductForm.name.trim()) return;

    const otherProducts = products.filter((p) => p.id !== editingCatalogProduct.id);
    const finalCode = editProductForm.code.trim() || generateNextProductCode(otherProducts);
    const finalBarcode = editProductForm.barcode.trim() || generateProductBarcode(finalCode, otherProducts);

    const updatedProduct: Product = {
      ...editingCatalogProduct,
      name: editProductForm.name.trim(),
      code: finalCode,
      barcode: finalBarcode,
      category: editProductForm.category.trim() || 'عمومی',
      unit: editProductForm.unit.trim() || 'عدد',
      stock: Math.max(0, Number(editProductForm.stock) || 0),
      minStockAlert: Math.max(0, Number(editProductForm.minStockAlert) || 0),
      buyPrice: Math.max(0, Number(editProductForm.buyPrice) || 0),
      sellPrice: Math.max(0, Number(editProductForm.sellPrice) || 0),
      description: editProductForm.description.trim() || undefined,
      updatedAt: getCurrentJalaliDate(),
    };

    if (onSaveProduct) {
      onSaveProduct(updatedProduct);
    } else {
      StorageService.saveProduct(updatedProduct);
    }

    // Update current invoice items if this product was already in items
    setItems((prev) =>
      prev.map((it) => {
        if (it.productId === updatedProduct.id) {
          return {
            ...it,
            productCode: updatedProduct.code,
            barcode: updatedProduct.barcode,
            productName: updatedProduct.name,
            unitPrice: updatedProduct.sellPrice,
            total: Math.max(0, it.quantity * updatedProduct.sellPrice - (it.discount || 0)),
          };
        }
        return it;
      })
    );

    // If details modal was open for this product, update it
    if (viewingCatalogProduct?.id === updatedProduct.id) {
      setViewingCatalogProduct(updatedProduct);
    }

    setEditingCatalogProduct(null);
  };

  // تولید مجدد کد در فرم ویرایش سریع کالا
  const handleRegenerateCatalogCode = () => {
    if (!editingCatalogProduct) return;
    const otherProducts = products.filter((p) => p.id !== editingCatalogProduct.id);
    const newCode = generateNextProductCode(otherProducts);
    setEditProductForm((prev) => ({ ...prev, code: newCode }));
  };

  // Add custom non-inventory / service item with automatic system code & barcode
  const handleAddServiceItem = () => {
    if (!serviceName.trim()) {
      setErrorMessage('لطفاً عنوان خدمات یا آیتم را وارد نمایید.');
      return;
    }
    const safeQty = Math.max(1, serviceQuantity || 1);
    const safePrice = Math.max(0, servicePrice || 0);
    const srvCode = generateNextServiceCode(items);
    const srvBarcode = generateServiceBarcode(srvCode, items);
    const newItem: InvoiceItem = {
      id: `service-${Date.now()}`,
      productId: '', // empty productId indicates non-inventory service item
      productName: serviceName.trim(),
      productCode: srvCode,
      barcode: srvBarcode,
      unit: serviceUnit || 'موردی',
      quantity: safeQty,
      unitPrice: safePrice,
      buyPrice: 0,
      discount: 0,
      total: safeQty * safePrice,
    };
    setItems((prev) => [newItem, ...prev]);
    setServiceName('');
    setServicePrice(0);
    setServiceQuantity(1);
    setIsServiceModalOpen(false);
  };

  // Adjust item quantity
  const handleAdjustQuantity = (itemId: string, delta: number) => {
    setItems((prev) => {
      return prev
        .map((it) => {
          if (it.id === itemId) {
            const newQty = it.quantity + delta;
            if (newQty <= 0) return null; // remove
            return {
              ...it,
              quantity: newQty,
              total: Math.max(0, newQty * it.unitPrice - (it.discount || 0)),
            };
          }
          return it;
        })
        .filter(Boolean) as InvoiceItem[];
    });
  };

  // Remove single item
  const handleRemoveItem = (itemId: string) => {
    setItems((prev) => prev.filter((it) => it.id !== itemId));
  };

  // Select customer
  const handleSelectCustomer = (cust: Customer | null) => {
    if (!cust) {
      setSelectedCustomerId('');
      setCustomerName('متفرقه');
      setCustomerPhone('');
      setCustomerAddress('');
      setCustomerNationalId('');
    } else {
      setSelectedCustomerId(cust.id);
      setCustomerName(cust.name);
      setCustomerPhone(cust.phone || '');
      setCustomerAddress(cust.address || '');
      setCustomerNationalId(cust.nationalId || '');
    }
    setIsCustomerModalOpen(false);
  };

  // Create new customer
  const handleCreateCustomer = () => {
    if (!newCustName.trim()) {
      setErrorMessage('لطفاً نام مشتری را وارد نمایید.');
      return;
    }
    const created = onAddNewCustomer({
      name: newCustName.trim(),
      phone: newCustPhone.trim(),
      address: newCustAddress.trim(),
      nationalId: newCustNationalId.trim(),
    });
    handleSelectCustomer(created);
    setNewCustName('');
    setNewCustPhone('');
    setNewCustAddress('');
    setNewCustNationalId('');
    setIsNewCustomerFormOpen(false);
  };

  // Continue to checkout or validate
  const handleProceedToCheckout = () => {
    // Normalize any zero quantities to 1
    setItems((prev) =>
      prev.map((it) =>
        it.quantity < 1
          ? { ...it, quantity: 1, total: Math.max(0, 1 * it.unitPrice - (it.discount || 0)) }
          : it
      )
    );
    if (items.length === 0) {
      setErrorMessage('لطفاً ابتدا حداقل یک کالا یا آیتم به فاکتور اضافه کنید.');
      setTimeout(() => setErrorMessage(''), 3000);
      return;
    }
    setIsCheckoutModalOpen(true);
  };

  // Final Submit
  const handleFinalSubmit = (shouldPrint: boolean) => {
    setErrorMessage('');

    if (items.length === 0) {
      setErrorMessage('حداقل یک قلم کالا در فاکتور الزامی است.');
      return;
    }

    // Stock check
    const stockIssues: string[] = [];
    items.forEach((item) => {
      if (item.productId) {
        const prod = products.find((p) => p.id === item.productId);
        if (prod && item.quantity > prod.stock) {
          stockIssues.push(`موجودی کالا "${prod.name}" (${prod.stock} ${prod.unit}) کمتر از تعداد فاکتور (${item.quantity}) است.`);
        }
      }
    });

    if (stockIssues.length > 0 && settings.autoDeductStock && !isProforma) {
      if (settings.allowNegativeStock === false) {
        setErrorMessage(
          `خطای کنترل موجودی انبار: اجازه ثبت کالای ناموجود در پنل غیرفعال است.\n${stockIssues.join('\n')}`
        );
        return;
      }
      const confirmContinue = window.confirm(
        `هشدار کسری موجودی:\n${stockIssues.join('\n')}\n\nآیا با وجود کسری موجودی، فاکتور ثبت گردد؟`
      );
      if (!confirmContinue) return;
    }

    const newInvoice: Invoice = {
      id: editingInvoice ? editingInvoice.id : `inv-${Date.now()}`,
      invoiceNumber: invoiceNumber.trim() || (isProforma ? `PF-${Date.now().toString().slice(-4)}` : `INV-${Date.now().toString().slice(-4)}`),
      type: invoiceType,
      isProforma,
      customerId: selectedCustomerId || 'guest',
      customerName: customerName.trim() || 'متفرقه',
      customerPhone: customerPhone.trim(),
      customerAddress: customerAddress.trim(),
      customerNationalId: customerNationalId.trim(),
      date: invoiceDate,
      items,
      subtotal,
      totalDiscount,
      taxRate: taxEnabled ? taxRate : 0,
      taxAmount,
      finalTotal,
      paymentStatus,
      paymentMethod,
      paidAmount: paymentStatus === 'paid' ? finalTotal : paidAmount,
      chequeNumber: paymentMethod === 'cheque' ? chequeNumber.trim() : undefined,
      chequeDueDate: paymentMethod === 'cheque' ? chequeDueDate.trim() : undefined,
      chequeName: paymentMethod === 'cheque' ? chequeName.trim() : undefined,
      transferDescription: paymentMethod === 'transfer' ? transferDescription.trim() : undefined,
      notes: notes.trim(),
      createdAt: editingInvoice ? editingInvoice.createdAt : new Date().toISOString(),
      updatedAt: isEditing ? new Date().toISOString() : undefined,
      convertedFromProforma: editingInvoice?.convertedFromProforma,
      convertedAt: editingInvoice?.convertedAt,
    };

    setIsCheckoutModalOpen(false);

    if (editingInvoice && onUpdateInvoice) {
      onUpdateInvoice(editingInvoice, newInvoice, shouldPrint || !!settings.autoPrintAfterSave);
    } else {
      onSaveInvoice(newInvoice, shouldPrint || !!settings.autoPrintAfterSave);
    }
  };

  // Desktop specific states
  const [desktopSidebarTab, setDesktopSidebarTab] = useState<'catalog' | 'checkout'>('catalog');
  const [desktopCatalogSearch, setDesktopCatalogSearch] = useState<string>('');
  const [desktopCatalogCategory, setDesktopCatalogCategory] = useState<string>('all');

  // Filtered Products for Desktop Quick Catalog
  const desktopFilteredProducts = useMemo(() => {
    let list = products;
    if (desktopCatalogCategory !== 'all') {
      list = list.filter((p) => p.category === desktopCatalogCategory);
    }
    if (desktopCatalogSearch.trim()) {
      const q = desktopCatalogSearch.trim().toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.code.toLowerCase().includes(q) ||
          (p.barcode && p.barcode.toLowerCase().includes(q))
      );
    }
    return list;
  }, [products, desktopCatalogCategory, desktopCatalogSearch]);

  // Directly set item quantity
  const handleSetQuantity = (itemId: string, newQty: number) => {
    setItems((prev) => {
      return prev
        .map((it) => {
          if (it.id === itemId) {
            const safeQty = Math.max(0, newQty);
            return {
              ...it,
              quantity: safeQty,
              total: Math.max(0, safeQty * it.unitPrice - (it.discount || 0)),
            };
          }
          return it;
        })
        .filter(Boolean) as InvoiceItem[];
    });
  };

  // Directly set item discount
  const handleSetItemDiscount = (itemId: string, disc: number) => {
    setItems((prev) => {
      return prev.map((it) => {
        if (it.id === itemId) {
          const safeDisc = Math.max(0, disc);
          return {
            ...it,
            discount: safeDisc,
            total: Math.max(0, it.quantity * it.unitPrice - safeDisc),
          };
        }
        return it;
      });
    });
  };

  // Clear all items
  const handleClearAllItems = () => {
    if (items.length === 0) return;
    if (window.confirm('آیا از حذف کلیه اقلام فاکتور جاری اطمینان دارید؟')) {
      setItems([]);
    }
  };

  // Desktop Global Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        isCustomerModalOpen ||
        isProductCatalogOpen ||
        isServiceModalOpen ||
        isSettingsModalOpen ||
        isCheckoutModalOpen
      ) {
        return;
      }

      if (e.key === 'F2') {
        e.preventDefault();
        setIsProductCatalogOpen(true);
      } else if (e.key === 'F4') {
        e.preventDefault();
        handleFinalSubmit(true);
      } else if (e.key === 'F8') {
        e.preventDefault();
        setDesktopSidebarTab((prev) => (prev === 'catalog' ? 'checkout' : 'catalog'));
      } else if (e.key === 'F9') {
        e.preventDefault();
        handleFinalSubmit(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  return (
    <div className="w-full max-w-7xl mx-auto select-none h-full flex flex-col">
      {/* ========================================================================= */}
      {/*                       1. MOBILE VIEW (Screens < lg)                       */}
      {/* ========================================================================= */}
      <div
        id="invoice-builder-mobile-card"
        className="lg:hidden max-w-md sm:max-w-xl mx-auto w-full flex flex-col bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden h-[calc(100vh-5rem)] h-[calc(100dvh-5rem)] min-h-[500px]"
      >
      {/* ================= 1. TOP HEADER (فروش کالا) ================= */}
      <div className="flex items-center justify-between px-3.5 py-3 border-b border-slate-100 bg-white sticky top-0 z-20 shrink-0">
        {/* Right side (RTL start): < ادامه (Green button) */}
        <button
          type="button"
          id="btn-invoice-continue-top"
          onClick={handleProceedToCheckout}
          className="flex items-center gap-1 text-emerald-500 hover:text-emerald-600 active:scale-95 text-sm sm:text-base font-extrabold transition-all cursor-pointer"
        >
          <ChevronLeft className="w-5 h-5 stroke-[2.8]" />
          <span>ادامه</span>
        </button>

        {/* Center: Title (فروش کالا) */}
        <div className="flex items-center gap-2">
          <h1 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
            {isEditing ? 'ویرایش فاکتور' : isProforma ? 'پیش‌فاکتور فروش' : 'فروش کالا'}
          </h1>
        </div>

        {/* Left side: Action items (Invoice/Proforma selector, Search, Settings) */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* 1. Invoice vs Proforma Quick Toggle */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200/80 text-[11px] font-bold">
            <button
              type="button"
              id="btn-mobile-type-invoice"
              onClick={() => setIsProforma(false)}
              className={`px-2 py-1 rounded-lg transition-all cursor-pointer ${
                !isProforma
                  ? 'bg-white text-emerald-700 shadow-xs font-black'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              فاکتور
            </button>
            <button
              type="button"
              id="btn-mobile-type-proforma"
              onClick={() => setIsProforma(true)}
              className={`px-2 py-1 rounded-lg transition-all cursor-pointer ${
                isProforma
                  ? 'bg-indigo-600 text-white shadow-xs font-black'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              پیش‌فاکتور
            </button>
          </div>

          {/* 2. Search Button */}
          <button
            type="button"
            id="btn-toggle-search-items"
            onClick={() => setIsSearchOpen(!isSearchOpen)}
            title="جستجوی اقلام فاکتور"
            className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all ${
              isSearchOpen ? 'bg-sky-100 text-sky-600' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Search className="w-4 h-4 stroke-[2.2]" />
          </button>

          {/* 3. Amber/Yellow Rounded Square Button with Cap / Options */}
          <button
            type="button"
            id="btn-invoice-settings-options"
            onClick={() => setIsSettingsModalOpen(true)}
            title="تنظیمات، شماره و نوع فاکتور"
            className="w-8 h-8 rounded-xl bg-amber-400 hover:bg-amber-500 active:scale-95 text-slate-950 flex items-center justify-center shadow-xs transition-all"
          >
            <GraduationCap className="w-4 h-4 stroke-[2.4]" />
          </button>
        </div>
      </div>

      {/* Quick In-Invoice Search Input (Collapsible) */}
      {isSearchOpen && (
        <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
          <Search className="w-4 h-4 text-slate-400 shrink-0" />
          <input
            type="text"
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            placeholder="جستجوی سریع بین اقلام اضافه شده به فاکتور..."
            className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            autoFocus
          />
          {filterQuery && (
            <button
              type="button"
              onClick={() => setFilterQuery('')}
              className="text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      {/* ================= 2. SUB-BAR (مشتری: متفرقه + MENU ICON) ================= */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-white shrink-0">
        {/* Right: Contact Card Icon + "مشتری: متفرقه" (Clickable) */}
        <div
          id="btn-customer-selector"
          onClick={() => setIsCustomerModalOpen(true)}
          className="flex items-center gap-2 cursor-pointer group select-none"
        >
          {/* Black Square Contact Card Icon with user silhouette */}
          <div className="w-7 h-7 rounded-lg bg-slate-900 text-white flex items-center justify-center shrink-0 group-hover:bg-emerald-600 transition-colors">
            <Contact className="w-4 h-4 stroke-[2]" />
          </div>

          <div className="flex items-baseline gap-1">
            <span className="text-sm font-black text-slate-900 group-hover:text-emerald-700 transition-colors">
              مشتری:
            </span>
            <span className="text-sm font-extrabold text-slate-800 group-hover:text-emerald-600 transition-colors">
              {customerName || 'متفرقه'}
            </span>
          </div>
        </div>

        {/* Left: Menu / Options Icon (3 horizontal bars with bullets) */}
        <button
          type="button"
          id="btn-sub-menu-options"
          onClick={() => setIsSettingsModalOpen(true)}
          className="w-8 h-8 rounded-lg text-sky-500 hover:bg-sky-50 flex items-center justify-center transition-colors"
          title="جزئیات فاکتور و تاریخ"
        >
          <SlidersHorizontal className="w-5 h-5 stroke-[2.2]" />
        </button>
      </div>

      {/* Error banner */}
      {errorMessage && (
        <div className="mx-3 my-2 p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2 animate-in fade-in shrink-0">
          <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
          <span>{errorMessage}</span>
          <button
            type="button"
            onClick={() => setErrorMessage('')}
            className="mr-auto text-rose-400 hover:text-rose-600"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ================= 3. CENTER / ITEMS LIST AREA ================= */}
      <div className="flex-1 min-h-0 overflow-y-auto px-3 py-3 flex flex-col justify-start">
        {displayedItems.length === 0 ? (
          /* EXACT EMPTY STATE MATCHING SCREENSHOT */
          <div className="flex-1 flex flex-col items-center justify-center text-center py-20 px-4">
            <div className="text-slate-500 font-bold text-sm sm:text-base leading-relaxed space-y-2 max-w-xs">
              <p className="flex items-center justify-center gap-1.5 flex-wrap">
                <span>برای افزودن کالا دکمه</span>
                <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-blue-500 text-white shadow-xs">
                  <Package className="w-4 h-4 stroke-[2.2]" />
                </span>
                <span>را بزنید</span>
              </p>
              <p className="flex items-center justify-center gap-1.5 flex-wrap">
                <span>و از</span>
                <span className="inline-flex items-center gap-0.5 text-blue-500 font-black tracking-tight text-xs bg-blue-50 px-1.5 py-0.5 rounded-md border border-blue-200">
                  <span>▲</span>
                  <span>■</span>
                  <span>●</span>
                </span>
                <span>برای افزودن آیتم بدون کالا استفاده کنید.</span>
              </p>
            </div>
          </div>
        ) : (
          /* ITEMS CARDS LIST */
          <div className="space-y-2.5">
            {displayedItems.map((item, idx) => {
              const isService = !item.productId;
              return (
                <div
                  key={item.id || idx}
                  className={`${
                    idx % 2 === 1 ? 'bg-slate-50/90' : 'bg-white'
                  } rounded-2xl border border-slate-200/90 p-3 shadow-xs hover:border-slate-300 transition-all space-y-2`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-extrabold text-slate-900 text-xs sm:text-sm truncate">
                          {item.productName}
                        </span>
                        {isService ? (
                          <span className="text-[10px] bg-amber-50 text-amber-700 font-bold px-1.5 py-0.5 rounded-md border border-amber-200">
                            خدماتی / بدون کالا
                          </span>
                        ) : item.productCode ? (
                          <span className="text-[10px] bg-slate-100 text-slate-600 font-bold px-1.5 py-0.5 rounded-md">
                            کد: {toPersianDigits(item.productCode)}
                          </span>
                        ) : null}
                        {item.variantName && (
                          <span className="text-[10px] bg-purple-100 text-purple-800 font-bold px-1.5 py-0.5 rounded-md border border-purple-200 flex items-center gap-1">
                            <Layers className="w-3 h-3 text-purple-600" />
                            <span>تنوع: {item.variantName}</span>
                          </span>
                        )}
                      </div>

                      <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-2">
                        <span>قیمت واحد:</span>
                        <span className="font-bold text-slate-700">{formatPrice(item.unitPrice)}</span>
                        {item.unit && <span className="text-slate-400">({item.unit})</span>}
                      </div>
                    </div>

                    {/* Delete Item Button */}
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(item.id)}
                      className="text-slate-300 hover:text-rose-500 p-1.5 rounded-lg hover:bg-rose-50 transition-colors"
                      title="حذف ردیف"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Quantity & Row Total Bar */}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                    {/* Quantity Selector: [-] [editable input] [+] */}
                    <div className="flex items-center gap-1 bg-slate-100/90 p-1 rounded-xl border border-slate-200/60 shadow-2xs">
                      <button
                        type="button"
                        onClick={() => handleAdjustQuantity(item.id, -1)}
                        className="w-7 h-7 rounded-lg bg-white shadow-xs text-slate-700 hover:bg-rose-50 hover:text-rose-600 active:scale-95 flex items-center justify-center transition-all cursor-pointer shrink-0"
                        title="کاهش تعداد"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>

                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={item.quantity === 0 ? '' : toPersianDigits(item.quantity)}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => {
                          const clean = toEnglishDigits(e.target.value).replace(/\D/g, '');
                          if (clean === '') {
                            handleSetQuantity(item.id, 0);
                          } else {
                            const val = parseInt(clean, 10);
                            handleSetQuantity(item.id, val);
                          }
                        }}
                        onBlur={(e) => {
                          const clean = toEnglishDigits(e.target.value).replace(/\D/g, '');
                          const val = parseInt(clean, 10);
                          if (!val || val < 1) {
                            handleSetQuantity(item.id, 1);
                          }
                        }}
                        className="w-12 h-7 text-center text-xs font-black text-slate-900 bg-white/80 hover:bg-white focus:bg-white rounded-md border border-transparent focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none transition-all"
                        title="جهت تغییر دستی تعداد، روی عدد کلیک کنید"
                        placeholder="۱"
                      />

                      <button
                        type="button"
                        onClick={() => handleAdjustQuantity(item.id, 1)}
                        className="w-7 h-7 rounded-lg bg-white shadow-xs text-slate-700 hover:bg-emerald-50 hover:text-emerald-600 active:scale-95 flex items-center justify-center transition-all cursor-pointer shrink-0"
                        title="افزایش تعداد"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Row Total */}
                    <div className="flex flex-col items-end">
                      <span className="text-[10px] text-slate-400 font-bold">مجموع ردیف</span>
                      <span className="text-xs sm:text-sm font-black text-emerald-600">
                        {formatPrice(item.total)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ================= 4. BOTTOM DOCK (ACTION BUTTONS) ================= */}
      <div className="p-3 bg-white border-t border-slate-100 space-y-2.5 shrink-0">
        <div className="grid grid-cols-2 gap-2.5">
          {/* Button 1 (Right in RTL): انتخاب کالا */}
          <button
            type="button"
            id="btn-dock-select-product"
            onClick={() => setIsProductCatalogOpen(true)}
            className="bg-slate-900 hover:bg-slate-800 active:scale-97 text-white rounded-2xl py-3 px-3 flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs"
          >
            <div className="w-6 h-6 rounded-lg bg-white/20 text-white flex items-center justify-center shrink-0">
              <Package className="w-4 h-4 stroke-[2.2]" />
            </div>
            <span className="text-xs sm:text-sm font-extrabold">
              انتخاب کالا
            </span>
          </button>

          {/* Button 2 (Left in RTL): آیتم خدماتی */}
          <button
            type="button"
            id="btn-dock-service-item"
            onClick={() => setIsServiceModalOpen(true)}
            className="bg-slate-100 hover:bg-slate-200/90 active:scale-97 border border-slate-200 rounded-2xl py-3 px-3 flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <div className="flex items-center gap-0.5 text-slate-800 font-black text-xs shrink-0">
              <span>▲</span>
              <span>■</span>
              <span>●</span>
            </div>
            <span className="text-xs sm:text-sm font-extrabold text-slate-800">
              آیتم خدماتی
            </span>
          </button>
        </div>

        {/* ================= 5. FULL-WIDTH BLUE TOTAL BANNER BUTTON ================= */}
        <button
          type="button"
          id="btn-invoice-total-footer"
          onClick={handleProceedToCheckout}
          className="w-full bg-[#1877f2] hover:bg-blue-600 active:scale-99 text-white rounded-2xl py-3 px-4 shadow-md shadow-blue-500/25 flex items-center justify-between transition-all cursor-pointer"
        >
          {/* Right side in RTL: < جمع کل پس از کسر تخفیف ها */}
          <div className="flex items-center gap-1.5">
            <ChevronLeft className="w-5 h-5 stroke-[2.8]" />
            <span className="text-xs sm:text-sm font-black tracking-tight">
              جمع کل پس از کسر تخفیف ها
            </span>
          </div>

          {/* Left side: ۰ ریال (or Total Price) */}
          <div className="text-sm sm:text-base font-black tracking-wide" dir="ltr">
            {formatPrice(finalTotal)}
          </div>
        </button>
      </div>
      </div>

      {/* ========================================================================= */}
      {/*                      2. DESKTOP VIEW (Screens >= lg)                      */}
      {/* ========================================================================= */}
      <div className="hidden lg:flex flex-col min-h-[calc(100vh-5rem)] bg-white rounded-3xl border border-slate-200/90 shadow-xl overflow-hidden">
        {/* DESKTOP HEADER */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 sm:gap-4 px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-200 bg-white sticky top-0 z-20">
          <div className="flex items-center gap-3 min-w-0">
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                title="بازگشت به داشبورد"
                className="w-9 h-9 rounded-xl border border-slate-200 hover:bg-slate-100 flex items-center justify-center text-slate-600 transition-colors cursor-pointer shrink-0"
              >
                <ArrowRight className="w-5 h-5" />
              </button>
            )}
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-xl font-black text-slate-900 tracking-tight">
                  {isEditing ? 'ویرایش فاکتور فروش' : isProforma ? 'پیش‌فاکتور فروش' : 'صدور فاکتور فروش'}
                </h1>
                {isProforma && (
                  <span className="text-xs bg-indigo-50 text-indigo-700 font-bold px-2.5 py-0.5 rounded-lg border border-indigo-200">
                    پیش‌نویس (بدون کسر از موجودی)
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-1 text-xs text-slate-500 font-medium flex-wrap">
                <span>شماره: <b className="text-slate-800 font-bold">{invoiceNumber}</b></span>
                <span>•</span>
                <span>تاریخ: <b className="text-slate-800 font-bold">{invoiceDate}</b></span>
                <span>•</span>
                <span>قالب چاپ: <b className="text-slate-800 font-bold">{invoiceType === 'standard' ? 'استاندارد A4/A5' : invoiceType === 'official' ? 'رسمی دارایی' : 'حرارتی ۸ سانتی'}</b></span>
              </div>
            </div>
          </div>

          <div className="flex items-center flex-wrap gap-2.5 w-full lg:w-auto justify-between lg:justify-end">
            {/* Invoice vs Proforma Toggle */}
            <div className="flex items-center p-0.5 bg-slate-100 rounded-xl border border-slate-200/80 text-xs font-bold shrink-0">
              <button
                type="button"
                id="btn-desktop-type-invoice"
                onClick={() => setIsProforma(false)}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                  !isProforma
                    ? 'bg-white text-emerald-700 shadow-xs font-black'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>فاکتور فروش</span>
              </button>
              <button
                type="button"
                id="btn-desktop-type-proforma"
                onClick={() => setIsProforma(true)}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                  isProforma
                    ? 'bg-indigo-600 text-white shadow-xs font-black'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>پیش‌فاکتور</span>
              </button>
            </div>

            {/* Document Settings */}
            <button
              type="button"
              onClick={() => setIsSettingsModalOpen(true)}
              className="px-3.5 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-900 text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer"
            >
              <GraduationCap className="w-4 h-4 text-amber-700" />
              <span>مشخصات سند و قالب</span>
            </button>

            <div className="w-px h-6 bg-slate-200 mx-1" />

            {/* Quick Save Final [F9] */}
            <button
              type="button"
              id="desktop-btn-save-final"
              onClick={() => handleFinalSubmit(false)}
              className="px-4 py-2 bg-[#1877f2] hover:bg-blue-600 active:scale-95 text-white font-extrabold text-xs rounded-xl transition-all shadow-xs flex items-center gap-2 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>ثبت نهایی</span>
              <kbd className="px-1.5 py-0.5 bg-white/20 rounded text-[10px] font-mono">F9</kbd>
            </button>

            {/* Quick Save & Print [F4] */}
            <button
              type="button"
              id="desktop-btn-save-print"
              onClick={() => handleFinalSubmit(true)}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-extrabold text-xs rounded-xl transition-all shadow-sm shadow-emerald-600/20 flex items-center gap-2 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>ثبت و چاپ فوری</span>
              <kbd className="px-1.5 py-0.5 bg-white/20 rounded text-[10px] font-mono">F4</kbd>
            </button>
          </div>
        </div>

        {/* DESKTOP WORKSTATION BODY */}
        <div className="grid grid-cols-12 gap-5 p-5 bg-slate-50/70 flex-1">
          {/* RIGHT COLUMN: INVOICE TABLE & FAST ADD (Col Span 8) */}
          <div className="col-span-8 flex flex-col gap-4">
            {/* 1. Customer Selection Card */}
            <div className="bg-white rounded-2xl p-3.5 border border-slate-200 shadow-xs flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-black">
                  <Contact className="w-5 h-5 stroke-[2.2]" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400 font-medium">طرف‌حساب فاکتور:</span>
                    <span className="text-sm font-black text-slate-900">
                      {customerName || 'مشتری متفرقه / گذری'}
                    </span>
                    {selectedCustomerId && (
                      <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-md">
                        ثبت شده در سیستم
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5">
                    <span>شماره تماس: <b className="font-semibold">{customerPhone || 'نامشخص'}</b></span>
                    {customerAddress && <span>• آدرس: {customerAddress.slice(0, 30)}...</span>}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsNewCustomerFormOpen(false);
                    setIsCustomerModalOpen(true);
                  }}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 hover:border-slate-300 bg-slate-50 hover:bg-white text-xs font-bold text-slate-700 transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <User className="w-3.5 h-3.5 text-slate-500" />
                  <span>انتخاب / تغییر مشتری</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsNewCustomerFormOpen(true);
                    setIsCustomerModalOpen(true);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>+ مشتری جدید</span>
                </button>
              </div>
            </div>

            {/* 2. Fast Item Addition Toolbar */}
            <div className="bg-white rounded-2xl p-3.5 border border-slate-200 shadow-xs flex items-center justify-between gap-3">
              {/* Action buttons */}
              <div className="flex items-center gap-2.5 flex-wrap">
                <button
                  type="button"
                  id="btn-desktop-open-catalog"
                  onClick={() => setIsProductCatalogOpen(true)}
                  className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs flex items-center gap-2 transition-all shadow-xs cursor-pointer"
                >
                  <Package className="w-4 h-4 text-emerald-400" />
                  <span>+ انتخاب کالا از کاتالوگ / انبار</span>
                  <kbd className="px-1.5 py-0.5 bg-white/20 rounded text-[10px] font-mono">F2</kbd>
                </button>

                <button
                  type="button"
                  id="btn-desktop-open-service"
                  onClick={() => setIsServiceModalOpen(true)}
                  className="px-4 py-2.5 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-900 border border-purple-200 font-extrabold text-xs flex items-center gap-2 transition-all cursor-pointer"
                >
                  <Shapes className="w-4 h-4 text-purple-600" />
                  <span>+ افزودن آیتم خدماتی / بدون کالا</span>
                </button>
              </div>

              {/* Status and Clear button */}
              <div className="flex items-center gap-3">
                {items.length > 0 && (
                  <div className="text-xs font-bold text-slate-500 hidden sm:flex items-center gap-1.5">
                    <span>تعداد اقلام ثبت‌شده:</span>
                    <strong className="text-slate-900 font-black font-mono bg-slate-100 px-2 py-0.5 rounded-md">
                      {toPersianDigits(items.length)}
                    </strong>
                  </div>
                )}

                {items.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearAllItems}
                    title="پاکسازی تمامی اقلام فاکتور"
                    className="px-3 py-2 rounded-xl hover:bg-rose-50 text-rose-600 border border-rose-200/80 transition-colors cursor-pointer text-xs font-bold flex items-center gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>پاکسازی اقلام</span>
                  </button>
                )}
              </div>
            </div>

            {/* 3. Invoice Items POS Table */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs flex-1 flex flex-col overflow-hidden">
              {items.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
                  <div className="w-20 h-20 rounded-3xl bg-slate-100 text-slate-400 flex items-center justify-center mb-4">
                    <ShoppingBag className="w-10 h-10 stroke-[1.4]" />
                  </div>
                  <h3 className="text-base font-extrabold text-slate-800 mb-1">
                    فاکتور در حال حاضر خالی است
                  </h3>
                  <p className="text-xs text-slate-400 max-w-md mb-6 leading-relaxed">
                    برای شروع، از کاتالوگ سریع در پنل سمت چپ روی کالا کلیک کنید، یا از دکمه «+ انتخاب کالا از کاتالوگ» استفاده فرمایید.
                  </p>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setIsProductCatalogOpen(true)}
                      className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition-colors flex items-center gap-2 cursor-pointer"
                    >
                      <Package className="w-4 h-4" />
                      <span>مشاهده و انتخاب از انبار کالا</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsServiceModalOpen(true)}
                      className="px-4 py-2.5 bg-purple-50 hover:bg-purple-100 border border-purple-200 text-purple-800 font-bold text-xs rounded-xl transition-colors flex items-center gap-2 cursor-pointer"
                    >
                      <Shapes className="w-4 h-4" />
                      <span>ثبت هزینه یا خدمات</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col">
                  {/* Table Scroll Area */}
                  <div className="flex-1 overflow-x-auto overflow-y-auto max-h-[480px]">
                    <table className="w-full text-right border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-100/90 text-slate-700 font-black border-b border-slate-200 sticky top-0 z-10">
                          <th className="py-3 px-3 text-center w-12">#</th>
                          <th className="py-3 px-4">شرح کالا یا خدمت</th>
                          <th className="py-3 px-3 w-24">کد کالا</th>
                          <th className="py-3 px-3 w-20 text-center">موجودی</th>
                          <th className="py-3 px-3 w-32">قیمت واحد (ریال)</th>
                          <th className="py-3 px-3 w-36 text-center">تعداد / مقدار</th>
                          <th className="py-3 px-3 w-28">تخفیف ردیف</th>
                          <th className="py-3 px-4 w-36">مبلغ کل (ریال)</th>
                          <th className="py-3 px-3 text-center w-12">حذف</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                        {displayedItems.map((item, idx) => {
                          const prod = products.find((p) => p.id === item.productId);
                          const isShortage = prod && !isProforma && item.quantity > prod.stock;
                          return (
                            <tr
                              key={item.id}
                              className={`${
                                idx % 2 === 1 ? 'bg-slate-50/85' : 'bg-white'
                              } hover:bg-slate-100/75 transition-colors`}
                            >
                              {/* Index */}
                              <td className="py-3 px-3 text-center font-bold text-slate-400">
                                {toPersianDigits(idx + 1)}
                              </td>

                              {/* Item name and variant */}
                              <td className="py-3 px-4">
                                <div className="font-extrabold text-slate-900 text-xs">
                                  {item.productName}
                                </div>
                                {item.variantName && (
                                  <span className="text-[10px] bg-purple-50 text-purple-700 font-bold px-1.5 py-0.5 rounded border border-purple-200 inline-block mt-0.5">
                                    تنوع: {item.variantName}
                                  </span>
                                )}
                                {!item.productId && (
                                  <span className="text-[10px] bg-amber-50 text-amber-700 font-bold px-1.5 py-0.5 rounded border border-amber-200 inline-block mt-0.5">
                                    آیتم خدماتی
                                  </span>
                                )}
                              </td>

                              {/* Product Code */}
                              <td className="py-3 px-3 text-slate-500 font-mono text-[11px]" dir="ltr">
                                {item.productCode || '-'}
                              </td>

                              {/* Stock */}
                              <td className="py-3 px-3 text-center">
                                {prod ? (
                                  <span
                                    className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                                      isShortage
                                        ? 'bg-rose-100 text-rose-800'
                                        : 'bg-slate-100 text-slate-700'
                                    }`}
                                  >
                                    {toPersianDigits(prod.stock)} {prod.unit || ''}
                                  </span>
                                ) : (
                                  <span className="text-slate-400">-</span>
                                )}
                              </td>

                              {/* Unit Price */}
                              <td className="py-3 px-3 font-bold text-slate-800">
                                {formatPrice(item.unitPrice)}
                              </td>

                              {/* Quantity Editor with +/- and direct input */}
                              <td className="py-3 px-3">
                                <div className="flex items-center justify-center gap-1 bg-slate-100/90 rounded-xl p-1 border border-slate-200 w-fit mx-auto">
                                  <button
                                    type="button"
                                    onClick={() => handleAdjustQuantity(item.id, -1)}
                                    className="w-6 h-6 rounded-lg bg-white hover:bg-rose-50 hover:text-rose-600 text-slate-700 flex items-center justify-center transition-colors shadow-2xs font-bold cursor-pointer"
                                  >
                                    <Minus className="w-3 h-3" />
                                  </button>

                                  <input
                                    type="text"
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                    value={item.quantity === 0 ? '' : toPersianDigits(item.quantity)}
                                    onFocus={(e) => e.target.select()}
                                    onChange={(e) => {
                                      const clean = toEnglishDigits(e.target.value).replace(/\D/g, '');
                                      if (clean === '') {
                                        handleSetQuantity(item.id, 0);
                                      } else {
                                        const val = parseInt(clean, 10);
                                        handleSetQuantity(item.id, val);
                                      }
                                    }}
                                    onBlur={(e) => {
                                      const clean = toEnglishDigits(e.target.value).replace(/\D/g, '');
                                      const val = parseInt(clean, 10);
                                      if (!val || val < 1) {
                                        handleSetQuantity(item.id, 1);
                                      }
                                    }}
                                    className="w-12 h-6 bg-white/80 hover:bg-white focus:bg-white rounded border border-transparent focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-center font-extrabold text-xs text-slate-900 focus:outline-none transition-all"
                                    title="جهت تغییر دستی تعداد، روی عدد کلیک کنید"
                                  />

                                  <button
                                    type="button"
                                    onClick={() => handleAdjustQuantity(item.id, 1)}
                                    className="w-6 h-6 rounded-lg bg-white hover:bg-emerald-50 hover:text-emerald-600 text-slate-700 flex items-center justify-center transition-colors shadow-2xs font-bold cursor-pointer"
                                  >
                                    <Plus className="w-3 h-3" />
                                  </button>
                                </div>
                              </td>

                              {/* Discount Input */}
                              <td className="py-3 px-3">
                                <input
                                  type="number"
                                  min="0"
                                  value={item.discount || ''}
                                  onChange={(e) => handleSetItemDiscount(item.id, parseFloat(e.target.value) || 0)}
                                  placeholder="۰"
                                  className="w-24 bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 rounded-lg px-2 py-1 text-left font-bold text-xs text-slate-800 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                                />
                              </td>

                              {/* Total Row Price */}
                              <td className="py-3 px-4 font-black text-emerald-700 text-xs">
                                {formatPrice(item.total)}
                              </td>

                              {/* Remove */}
                              <td className="py-3 px-3 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleRemoveItem(item.id)}
                                  className="w-7 h-7 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center transition-colors mx-auto cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Table Footer Bar */}
                  <div className="p-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs font-bold text-slate-700">
                    <div className="flex items-center gap-4">
                      <span>تعداد ردیف‌ها: <b className="text-slate-900">{toPersianDigits(items.length)} قلم</b></span>
                      <span>مجموع اقلام فاکتور: <b className="text-slate-900">{toPersianDigits(items.reduce((acc, it) => acc + it.quantity, 0))} عدد</b></span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-slate-500">جمع ناخالص اقلام:</span>
                      <span className="text-sm font-black text-slate-900">{formatPrice(subtotal)}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* LEFT COLUMN: DESKTOP ASSISTANT - CATALOG & CHECKOUT (Col Span 4) */}
          <div className="col-span-4 flex flex-col gap-4">
            {/* Sidebar Tabs */}
            <div className="bg-white rounded-2xl p-1.5 border border-slate-200 shadow-xs flex items-center gap-1">
              <button
                type="button"
                onClick={() => setDesktopSidebarTab('catalog')}
                className={`flex-1 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  desktopSidebarTab === 'catalog'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Boxes className="w-4 h-4" />
                <span>کاتالوگ سریع اقلام</span>
              </button>

              <button
                type="button"
                onClick={() => setDesktopSidebarTab('checkout')}
                className={`flex-1 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  desktopSidebarTab === 'checkout'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <FileText className="w-4 h-4" />
                <span>تسویه و ثبت فاکتور</span>
                {items.length > 0 && (
                  <span className="w-5 h-5 rounded-full bg-white/20 text-white text-[10px] flex items-center justify-center font-bold">
                    {items.length}
                  </span>
                )}
              </button>
            </div>

            {/* TAB CONTENT 1: QUICK CATALOG */}
            {desktopSidebarTab === 'catalog' && (
              <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex-1 flex flex-col gap-3">
                {/* Search */}
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
                  <input
                    type="text"
                    value={desktopCatalogSearch}
                    onChange={(e) => setDesktopCatalogSearch(e.target.value)}
                    placeholder="جستجوی سریع نام یا کد کالا..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-9 pl-3 py-2 text-xs font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                  {desktopCatalogSearch && (
                    <button
                      type="button"
                      onClick={() => setDesktopCatalogSearch('')}
                      className="absolute left-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Categories */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
                  <button
                    type="button"
                    onClick={() => setDesktopCatalogCategory('all')}
                    className={`px-2.5 py-1 rounded-lg font-bold text-[11px] whitespace-nowrap transition-colors cursor-pointer ${
                      desktopCatalogCategory === 'all'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    همه دسته‌ها
                  </button>
                  {categories.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setDesktopCatalogCategory(cat)}
                      className={`px-2.5 py-1 rounded-lg font-bold text-[11px] whitespace-nowrap transition-colors cursor-pointer ${
                        desktopCatalogCategory === cat
                          ? 'bg-emerald-600 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>

                {/* Products Grid / List */}
                <div className="flex-1 overflow-y-auto space-y-2 pr-1 max-h-[500px]">
                  {desktopFilteredProducts.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 text-xs font-medium">
                      کالایی مطابق جستجو یافت نشد.
                    </div>
                  ) : (
                    desktopFilteredProducts.map((prod) => {
                      const existing = items.find((it) => it.productId === prod.id);
                      return (
                        <div
                          key={prod.id}
                          onClick={() => handleAddProduct(prod)}
                          className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between group ${
                            existing
                              ? 'border-emerald-500 bg-emerald-50/40'
                              : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/70'
                          }`}
                        >
                          <div className="flex-1 min-w-0 pr-1">
                            <div className="flex items-center gap-1.5">
                              <span className="font-extrabold text-slate-900 text-xs truncate block">
                                {prod.name}
                              </span>
                              {prod.hasVariants && (
                                <span className="text-[9px] bg-purple-100 text-purple-800 font-bold px-1.5 py-0.2 rounded shrink-0">
                                  دارای تنوع
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500">
                              <span>کد: <b className="font-mono">{prod.code}</b></span>
                              <span>• موجودی: <b className={prod.stock <= 0 ? 'text-rose-600 font-bold' : 'text-slate-700'}>{toPersianDigits(prod.stock)}</b></span>
                            </div>
                          </div>

                          <div className="text-left shrink-0 pl-1">
                            <div className="font-black text-slate-900 text-xs">
                              {formatPrice(prod.sellPrice)}
                            </div>
                            {existing ? (
                              <span className="text-[10px] bg-emerald-600 text-white font-bold px-2 py-0.5 rounded-full inline-block mt-1">
                                {toPersianDigits(existing.quantity)} در فاکتور
                              </span>
                            ) : (
                              <span className="text-[10px] text-slate-400 group-hover:text-emerald-600 font-bold inline-flex items-center gap-0.5 mt-1">
                                <Plus className="w-3 h-3" /> افزودن
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* TAB CONTENT 2: CHECKOUT & SETTLEMENT */}
            {desktopSidebarTab === 'checkout' && (
              <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex-1 flex flex-col gap-3.5 overflow-y-auto max-h-[640px]">
                {/* Financial Summary */}
                <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200 space-y-2 text-xs">
                  <div className="flex items-center justify-between text-slate-600">
                    <span>جمع اقلام ({toPersianDigits(items.length)} قلم):</span>
                    <span className="font-bold">{formatPrice(subtotal)}</span>
                  </div>

                  {totalDiscount > 0 && (
                    <div className="flex items-center justify-between text-rose-600 font-bold">
                      <span>مجموع تخفیف‌ها:</span>
                      <span>- {formatPrice(totalDiscount)}</span>
                    </div>
                  )}

                  {taxEnabled && (
                    <div className="flex items-center justify-between text-slate-600">
                      <span>مالیات بر ارزش افزوده ({toPersianDigits(taxRate)}٪):</span>
                      <span className="font-bold">+ {formatPrice(taxAmount)}</span>
                    </div>
                  )}

                  <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
                    <span className="font-black text-slate-900 text-xs">مبلغ قابل پرداخت نهایی:</span>
                    <span className="font-black text-emerald-700 text-base">{formatPrice(finalTotal)}</span>
                  </div>
                </div>

                {/* Extra discount */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    تخفیف کلی مازاد روی فاکتور:
                  </label>
                  <input
                    type="number"
                    value={extraDiscount || ''}
                    onChange={(e) => setExtraDiscount(parseFloat(e.target.value) || 0)}
                    placeholder="مبلغ به ریال"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 text-left focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                {/* Payment Method */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1.5">
                    روش تسویه:
                  </label>
                  <div className="grid grid-cols-4 gap-1.5">
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('cash')}
                      className={`py-2 text-center rounded-xl text-xs font-bold border transition-colors flex flex-col items-center gap-1 cursor-pointer ${
                        paymentMethod === 'cash'
                          ? 'border-blue-500 bg-blue-50 text-blue-800'
                          : 'border-slate-200 bg-white text-slate-600'
                      }`}
                    >
                      <Banknote className="w-3.5 h-3.5" />
                      <span>نقدی</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPaymentMethod('pos')}
                      className={`py-2 text-center rounded-xl text-xs font-bold border transition-colors flex flex-col items-center gap-1 cursor-pointer ${
                        paymentMethod === 'pos'
                          ? 'border-blue-500 bg-blue-50 text-blue-800'
                          : 'border-slate-200 bg-white text-slate-600'
                      }`}
                    >
                      <CreditCard className="w-3.5 h-3.5" />
                      <span>کارتخوان</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPaymentMethod('cheque')}
                      className={`py-2 text-center rounded-xl text-xs font-bold border transition-colors flex flex-col items-center gap-1 cursor-pointer ${
                        paymentMethod === 'cheque'
                          ? 'border-blue-500 bg-blue-50 text-blue-800'
                          : 'border-slate-200 bg-white text-slate-600'
                      }`}
                    >
                      <Landmark className="w-3.5 h-3.5" />
                      <span>چک صیاد</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPaymentMethod('transfer')}
                      className={`py-2 text-center rounded-xl text-xs font-bold border transition-colors flex flex-col items-center gap-1 cursor-pointer ${
                        paymentMethod === 'transfer'
                          ? 'border-blue-500 bg-blue-50 text-blue-800'
                          : 'border-slate-200 bg-white text-slate-600'
                      }`}
                    >
                      <ArrowUpDown className="w-3.5 h-3.5" />
                      <span>حواله</span>
                    </button>
                  </div>
                </div>

                {/* Payment Status */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1.5">
                    وضعیت پرداخت:
                  </label>
                  <div className="grid grid-cols-3 gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setPaymentStatus('paid');
                        setPaidAmount(finalTotal);
                      }}
                      className={`py-1.5 text-center rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                        paymentStatus === 'paid'
                          ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
                          : 'border-slate-200 bg-white text-slate-600'
                      }`}
                    >
                      تسویه کامل
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setPaymentStatus('partial');
                        setPaidAmount(Math.round(finalTotal / 2));
                      }}
                      className={`py-1.5 text-center rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                        paymentStatus === 'partial'
                          ? 'border-amber-500 bg-amber-50 text-amber-800'
                          : 'border-slate-200 bg-white text-slate-600'
                      }`}
                    >
                      بیعانه / بخشی
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setPaymentStatus('unpaid');
                        setPaidAmount(0);
                      }}
                      className={`py-1.5 text-center rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                        paymentStatus === 'unpaid'
                          ? 'border-rose-500 bg-rose-50 text-rose-800'
                          : 'border-slate-200 bg-white text-slate-600'
                      }`}
                    >
                      نسیه
                    </button>
                  </div>
                </div>

                {paymentStatus === 'partial' && (
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      مبلغ پرداخت شده علی‌الحساب:
                    </label>
                    <input
                      type="number"
                      value={paidAmount || ''}
                      onChange={(e) => setPaidAmount(parseFloat(e.target.value) || 0)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 text-left focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>
                )}

                {/* Cheque Info if Cheque */}
                {paymentMethod === 'cheque' && (
                  <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl space-y-2 text-xs">
                    <span className="font-extrabold text-amber-900 block text-[11px]">مشخصات چک صیادی:</span>
                    <input
                      type="text"
                      value={chequeNumber}
                      onChange={(e) => setChequeNumber(e.target.value)}
                      placeholder="شناسه ۱۶ رقمی صیادی"
                      className="w-full bg-white border border-amber-300 rounded-lg px-2.5 py-1 text-xs"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={chequeDueDate}
                        onChange={(e) => setChequeDueDate(e.target.value)}
                        placeholder="سررسید (۱۴۰۳/۰۵/۰۱)"
                        className="w-full bg-white border border-amber-300 rounded-lg px-2 py-1 text-xs text-center"
                      />
                      <input
                        type="text"
                        value={chequeName}
                        onChange={(e) => setChequeName(e.target.value)}
                        placeholder="صاحب حساب"
                        className="w-full bg-white border border-amber-300 rounded-lg px-2 py-1 text-xs"
                      />
                    </div>
                  </div>
                )}

                {/* Notes */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    توضیحات و یادداشت فاکتور:
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={2}
                    placeholder="توضیحات تکمیلی..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                {/* Final Action Buttons */}
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => handleFinalSubmit(true)}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white font-extrabold text-xs py-3 rounded-xl transition-all shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Printer className="w-4 h-4" />
                    <span>ثبت و چاپ فوری فاکتور [F4]</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleFinalSubmit(false)}
                    className="w-full bg-[#1877f2] hover:bg-blue-600 active:scale-98 text-white font-extrabold text-xs py-3 rounded-xl transition-all shadow-md shadow-blue-500/20 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Check className="w-4 h-4" />
                    <span>ثبت نهایی فاکتور [F9]</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* DESKTOP FOOTER SHORTCUTS BAR */}
        <div className="px-6 py-2.5 bg-slate-900 text-white flex items-center justify-between text-xs">
          <div className="flex items-center gap-4 text-slate-300">
            <span className="flex items-center gap-1.5">
              <kbd className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded text-[10px] text-amber-300 font-mono">F2</kbd>
              <span>جستجوی کالا و کد</span>
            </span>
            <span>•</span>
            <span className="flex items-center gap-1.5">
              <kbd className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded text-[10px] text-amber-300 font-mono">F4</kbd>
              <span>ثبت و چاپ</span>
            </span>
            <span>•</span>
            <span className="flex items-center gap-1.5">
              <kbd className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded text-[10px] text-amber-300 font-mono">F8</kbd>
              <span>سوییچ کاتالوگ/تسویه</span>
            </span>
            <span>•</span>
            <span className="flex items-center gap-1.5">
              <kbd className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded text-[10px] text-amber-300 font-mono">F9</kbd>
              <span>ثبت نهایی</span>
            </span>
          </div>

          <div className="flex items-center gap-3 text-slate-400 font-medium">
            <span>واحد پولی: <b className="text-slate-200">{settings.currency || 'ریال'}</b></span>
            <span>|</span>
            <span>صندوق: <b className="text-slate-200">{settings.storeName || 'فروشگاه سپهر'}</b></span>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/*                               MODALS                                      */}
      {/* ========================================================================= */}

      {/* MODAL 1: PRODUCT CATALOG SELECTION (انتخاب کالا) */}
      {isProductCatalogOpen && (
        <div
          id="product-catalog-modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsProductCatalogOpen(false);
          }}
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-150"
        >
          <div
            id="product-catalog-modal"
            className="bg-white rounded-3xl w-full max-w-lg md:max-w-2xl lg:max-w-4xl xl:max-w-5xl shadow-2xl border border-slate-200/80 max-h-[92vh] sm:max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-3.5 py-3 sm:px-5 sm:py-3.5 bg-slate-50/90 border-b border-slate-200/80 shrink-0">
              <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-slate-900 text-white flex items-center justify-center shadow-xs shrink-0">
                  <Package className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.2]" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-black text-slate-900 text-sm sm:text-base leading-tight truncate">
                      انتخاب کالا از انبار
                    </h3>
                    <span className="inline-flex items-center text-[10px] sm:text-[11px] font-bold text-slate-600 bg-slate-200/70 px-2 py-0.5 rounded-full font-mono shrink-0">
                      {toPersianDigits(products.length)} کالا
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 font-medium truncate mt-0.5">
                    بررسی و افزودن مستقیم کالاها به فاکتور
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {items.length > 0 && (
                  <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>{toPersianDigits(items.length)} ردیف انتخاب‌شده</span>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => setIsProductCatalogOpen(false)}
                  className="w-8 h-8 rounded-full bg-slate-200/80 hover:bg-slate-300 text-slate-600 hover:text-slate-900 flex items-center justify-center cursor-pointer transition-colors"
                  title="بستن پنجره"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Search & Filter Toolbar */}
            <div className="p-3 sm:p-4 bg-white border-b border-slate-100 space-y-2.5 sm:space-y-3 shrink-0">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-2.5">
                {/* Search input with clear button */}
                <div className="relative flex-1 group min-w-0">
                  <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 transition-colors group-focus-within:text-emerald-600" />
                  <input
                    type="text"
                    value={productCatalogSearch}
                    onChange={(e) => setProductCatalogSearch(e.target.value)}
                    placeholder="جستجو بر اساس نام، کد یا دسته‌بندی..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl sm:rounded-2xl pr-10 pl-9 py-2 sm:py-2.5 text-xs sm:text-sm font-medium placeholder:text-slate-400 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 focus:outline-none transition-all"
                  />
                  {productCatalogSearch && (
                    <button
                      type="button"
                      onClick={() => setProductCatalogSearch('')}
                      className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-slate-200 hover:bg-slate-300 text-slate-600 flex items-center justify-center text-xs transition-colors cursor-pointer"
                      title="پاک کردن متن جستجو"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {/* Stock filter toggle */}
                <button
                  type="button"
                  onClick={() => setCatalogOnlyInStock(!catalogOnlyInStock)}
                  className={`flex items-center justify-center gap-2 px-3 py-2 sm:py-2.5 rounded-xl sm:rounded-2xl border text-xs font-bold transition-all cursor-pointer whitespace-nowrap select-none shrink-0 ${
                    catalogOnlyInStock
                      ? 'bg-emerald-50 border-emerald-500 text-emerald-800 shadow-2xs'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <Boxes className={`w-4 h-4 ${catalogOnlyInStock ? 'text-emerald-600' : 'text-slate-500'}`} />
                  <span>فقط کالاهای موجود</span>
                  {catalogOnlyInStock && (
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  )}
                </button>
              </div>

              {/* Category filter pills */}
              {categories.length > 0 && (
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
                  <button
                    type="button"
                    onClick={() => setCatalogCategory('all')}
                    className={`px-2.5 sm:px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                      catalogCategory === 'all'
                        ? 'bg-slate-900 text-white shadow-2xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    <span>همه دسته‌ها</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-md font-mono ${
                        catalogCategory === 'all' ? 'bg-slate-800 text-slate-200' : 'bg-white text-slate-500'
                      }`}
                    >
                      {toPersianDigits(products.length)}
                    </span>
                  </button>

                  {categories.map((cat) => {
                    const count = products.filter((p) => p.category === cat).length;
                    const isActive = catalogCategory === cat;
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setCatalogCategory(cat)}
                        className={`px-2.5 sm:px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                          isActive
                            ? 'bg-slate-900 text-white shadow-2xs'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        <span>{cat}</span>
                        <span
                          className={`text-[10px] px-1.5 py-0.2 rounded-md font-mono ${
                            isActive ? 'bg-slate-800 text-slate-200' : 'bg-white text-slate-500'
                          }`}
                        >
                          {toPersianDigits(count)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Product Cards Grid Area */}
            <div className="flex-1 overflow-y-auto p-3 sm:p-4 bg-slate-50/60">
              {filteredProducts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-14 px-4 text-center">
                  <div className="w-14 h-14 rounded-3xl bg-slate-100 border border-slate-200 text-slate-400 flex items-center justify-center mb-3 shadow-xs">
                    <Package className="w-7 h-7 stroke-[1.5]" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-800 mb-1">کالایی با مشخصات مورد نظر یافت نشد</h4>
                  <p className="text-xs text-slate-400 max-w-sm mb-4 leading-relaxed">
                    می‌توانید با جستجوی عبارتی دیگر یا حذف فیلتر دسته‌بندی و موجودی، کالای مورد نظرتان را بیابید.
                  </p>
                  {(productCatalogSearch || catalogCategory !== 'all' || catalogOnlyInStock) && (
                    <button
                      type="button"
                      onClick={() => {
                        setProductCatalogSearch('');
                        setCatalogCategory('all');
                        setCatalogOnlyInStock(false);
                      }}
                      className="px-4 py-2 rounded-xl text-xs font-bold bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 transition-colors shadow-2xs cursor-pointer"
                    >
                      پاک کردن همه فیلترها
                    </button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5">
                  {filteredProducts.map((p) => {
                    const invoiceItemsForProduct = items.filter((it) => it.productId === p.id);
                    const totalQtyInInvoice = invoiceItemsForProduct.reduce((sum, it) => sum + it.quantity, 0);
                    const inInvoice = totalQtyInInvoice > 0;

                    return (
                      <div
                        key={p.id}
                        id={`catalog-product-${p.id}`}
                        className={`rounded-2xl border transition-all p-3 sm:px-4 sm:py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 select-none ${
                          inInvoice
                            ? 'border-emerald-500 bg-emerald-50/50 shadow-2xs ring-1 ring-emerald-500/20'
                            : 'border-slate-200/90 bg-white hover:border-slate-300 hover:bg-slate-50/70 shadow-2xs'
                        }`}
                      >
                        {/* ONLY Product Name (Takes full row on mobile, full width on desktop) */}
                        <div
                          onClick={() => {
                            if (p.hasVariants && p.variants && p.variants.length > 0) {
                              setVariantPickerProduct(p);
                            } else {
                              handleAddProduct(p);
                            }
                          }}
                          className="flex items-center gap-2.5 cursor-pointer min-w-0 flex-1 group"
                          title="کلیک برای افزودن به فاکتور"
                        >
                          <div
                            className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                              inInvoice
                                ? 'bg-emerald-600 text-white shadow-2xs'
                                : 'bg-slate-100 text-slate-500 group-hover:bg-slate-200 group-hover:text-slate-800'
                            }`}
                          >
                            <Package className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-extrabold text-slate-900 text-xs sm:text-sm leading-snug group-hover:text-emerald-700 transition-colors break-words">
                                {p.name}
                              </span>
                              {p.category && (
                                <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-md shrink-0">
                                  {p.category}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Action Buttons: Details, Edit, Add/Stepper */}
                        <div className="flex items-center justify-end gap-1.5 sm:gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                          {/* Button to show details in separate window */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setViewingCatalogProduct(p);
                            }}
                            className="flex items-center justify-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200/80 transition-all cursor-pointer shadow-2xs active:scale-[0.98] whitespace-nowrap"
                            title="نمایش جزئیات کامل در پنجره جداگانه"
                          >
                            <Eye className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                            <span className="text-[11px] font-black">جزئیات</span>
                          </button>

                          {/* Button to edit product right here */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenEditProduct(p);
                            }}
                            className="flex items-center justify-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200/80 transition-all cursor-pointer shadow-2xs active:scale-[0.98] whitespace-nowrap"
                            title="ویرایش مشخصات کالا در همینجا"
                          >
                            <Pencil className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                            <span className="text-[11px] font-black">ویرایش</span>
                          </button>

                          {/* Add / Stepper */}
                          {p.hasVariants && p.variants && p.variants.length > 0 ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setVariantPickerProduct(p);
                              }}
                              className="flex items-center justify-center gap-1 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 text-xs font-bold px-2.5 sm:px-3 py-1.5 rounded-xl transition-all shadow-2xs cursor-pointer active:scale-[0.98] whitespace-nowrap"
                              title="انتخاب رنگ یا تنوع"
                            >
                              <Layers className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                              <span className="text-[11px] font-black">تنوع</span>
                              {totalQtyInInvoice > 0 && (
                                <span className="bg-purple-600 text-white text-[10px] px-1.5 py-0.2 rounded-md font-black">
                                  {toPersianDigits(totalQtyInInvoice)}
                                </span>
                              )}
                            </button>
                          ) : inInvoice ? (
                            <div className="flex items-center gap-0.5 bg-white border border-emerald-300 rounded-xl p-0.5 shadow-2xs shrink-0">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDecrementProduct(p);
                                }}
                                className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-rose-50 hover:text-rose-600 text-slate-700 flex items-center justify-center text-xs transition-colors cursor-pointer"
                                title="کاهش تعداد"
                              >
                                <Minus className="w-3.5 h-3.5" />
                              </button>
                              <span className="px-2 text-xs font-black text-emerald-700 min-w-[22px] text-center font-mono">
                                {toPersianDigits(totalQtyInInvoice)}
                              </span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleAddProduct(p);
                                }}
                                className="w-7 h-7 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center text-xs transition-colors cursor-pointer"
                                title="افزایش تعداد"
                              >
                                <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleAddProduct(p);
                              }}
                              className="flex items-center justify-center gap-1 bg-slate-900 hover:bg-emerald-600 text-white text-xs font-bold px-3 py-1.5 rounded-xl transition-all shadow-2xs cursor-pointer active:scale-[0.98] whitespace-nowrap"
                              title="افزودن به فاکتور"
                            >
                              <Plus className="w-3.5 h-3.5 stroke-[2.5] shrink-0" />
                              <span className="text-[11px] font-black">افزودن</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Modal Bottom Action Bar / Footer */}
            <div className="px-3.5 py-3 sm:px-5 sm:py-3.5 bg-white border-t border-slate-200/80 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 sm:gap-3 shrink-0">
              {/* Summary info */}
              <div className="flex items-center justify-between sm:justify-start gap-2 sm:gap-3 bg-slate-50 sm:bg-transparent p-2.5 sm:p-0 rounded-2xl border sm:border-0 border-slate-100">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
                  <span>اقلام انتخابی:</span>
                  <strong className="font-black text-emerald-700 font-mono">
                    {toPersianDigits(items.length)} ردیف
                  </strong>
                  <span className="text-slate-400 text-[11px]">
                    ({toPersianDigits(items.reduce((s, it) => s + it.quantity, 0))} قلم)
                  </span>
                </div>
                <div className="text-xs font-bold text-slate-700 flex items-center gap-1">
                  <span className="text-slate-300 hidden sm:inline">|</span>
                  <span className="text-slate-500 font-medium">مبلغ کل:</span>
                  <strong className="font-black text-slate-900 font-mono">
                    {formatPrice(finalTotal)}
                  </strong>
                  <span className="text-[11px] font-semibold text-slate-600">{settings.currency}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsProductCatalogOpen(false)}
                  className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer text-center"
                >
                  بستن
                </button>
                <button
                  type="button"
                  onClick={() => setIsProductCatalogOpen(false)}
                  className="flex-2 sm:flex-initial flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white font-extrabold text-xs px-5 py-2.5 rounded-xl transition-all shadow-xs cursor-pointer"
                >
                  <Check className="w-4 h-4 stroke-[2.5]" />
                  <span>تایید و بازگشت به فاکتور</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: PRODUCT DETAILS (پنجره جداگانه جزئیات کامل کالا) */}
      {viewingCatalogProduct && (
        <div
          id="product-details-modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) setViewingCatalogProduct(null);
          }}
          className="fixed inset-0 z-60 bg-black/60 backdrop-blur-xs flex items-center justify-center p-2.5 sm:p-4 animate-in fade-in duration-150"
        >
          <div
            id="product-details-modal"
            className="bg-white rounded-3xl w-full max-w-lg shadow-2xl border border-slate-200/80 max-h-[92vh] sm:max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-3.5 py-3 sm:px-5 sm:py-3.5 bg-slate-50/90 border-b border-slate-200/80 shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-sky-100 text-sky-700 flex items-center justify-center shadow-2xs shrink-0">
                  <Eye className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-black text-slate-900 text-sm sm:text-base leading-tight truncate">
                    جزئیات و مشخصات کالا
                  </h3>
                  <span className="text-[11px] text-slate-400 font-medium truncate block">
                    اطلاعات انبار و قیمت‌گذاری
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setViewingCatalogProduct(null)}
                className="w-8 h-8 rounded-full bg-slate-200/70 hover:bg-slate-200 text-slate-600 flex items-center justify-center cursor-pointer transition-colors shrink-0"
                title="بستن"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-3.5 sm:p-5 space-y-3 sm:space-y-4">
              {/* Product Title Card */}
              <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-50 border border-slate-200/80 flex flex-col sm:flex-row sm:items-start justify-between gap-2.5 sm:gap-3">
                <div className="space-y-1 flex-1 min-w-0">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    نام محصول
                  </span>
                  <h4 className="text-sm sm:text-base font-black text-slate-900 leading-snug break-words">
                    {viewingCatalogProduct.name}
                  </h4>
                </div>
                <div className="shrink-0 flex items-center sm:flex-col sm:items-end gap-1.5 flex-wrap">
                  {viewingCatalogProduct.category && (
                    <span className="px-2.5 py-1 rounded-xl bg-white border border-slate-200 text-slate-700 text-xs font-bold shadow-2xs">
                      {viewingCatalogProduct.category}
                    </span>
                  )}
                  {viewingCatalogProduct.stock <= 0 ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-lg">
                      <AlertTriangle className="w-3 h-3 shrink-0" />
                      ناموجود
                    </span>
                  ) : viewingCatalogProduct.stock <= (viewingCatalogProduct.minStockAlert || 5) ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-lg">
                      <AlertTriangle className="w-3 h-3 shrink-0" />
                      موجودی رو به اتمام
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-lg">
                      <CheckCircle2 className="w-3 h-3 shrink-0" />
                      موجود در انبار
                    </span>
                  )}
                </div>
              </div>

              {/* Specs Grid */}
              <div className="grid grid-cols-2 gap-2 sm:gap-2.5">
                {/* Sell Price */}
                <div className="p-3 rounded-2xl bg-emerald-50/50 border border-emerald-200/70 space-y-1">
                  <span className="text-[11px] font-bold text-emerald-800 flex items-center gap-1">
                    <CreditCard className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    قیمت فروش:
                  </span>
                  <div className="text-xs sm:text-base font-black text-emerald-700 font-mono">
                    {formatPrice(viewingCatalogProduct.sellPrice)} <span className="text-[11px] font-bold text-emerald-800/80">{settings.currency}</span>
                  </div>
                </div>

                {/* Buy Price */}
                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1">
                  <span className="text-[11px] font-bold text-slate-600 flex items-center gap-1">
                    <Banknote className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    قیمت خرید:
                  </span>
                  <div className="text-xs sm:text-base font-black text-slate-800 font-mono">
                    {viewingCatalogProduct.buyPrice ? formatPrice(viewingCatalogProduct.buyPrice) : '۰'} <span className="text-[11px] font-medium text-slate-500">{settings.currency}</span>
                  </div>
                </div>

                {/* Stock */}
                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1">
                  <span className="text-[11px] font-bold text-slate-600 flex items-center gap-1">
                    <Boxes className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    موجودی فعلی انبار:
                  </span>
                  <div className="text-xs sm:text-base font-black text-slate-900 font-mono">
                    {toPersianDigits(viewingCatalogProduct.stock)} <span className="text-[11px] font-medium text-slate-500">{viewingCatalogProduct.unit || 'عدد'}</span>
                  </div>
                </div>

                {/* Min Stock Alert */}
                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1">
                  <span className="text-[11px] font-bold text-slate-600 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    حداقل هشدار موجودی:
                  </span>
                  <div className="text-xs sm:text-base font-black text-slate-800 font-mono">
                    {toPersianDigits(viewingCatalogProduct.minStockAlert || 0)} <span className="text-[11px] font-medium text-slate-500">{viewingCatalogProduct.unit || 'عدد'}</span>
                  </div>
                </div>

                {/* Code */}
                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1">
                  <span className="text-[11px] font-bold text-slate-600 flex items-center gap-1">
                    <Hash className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    کد کالا:
                  </span>
                  <div className="text-xs sm:text-sm font-black font-mono text-slate-800 truncate">
                    {toPersianDigits(viewingCatalogProduct.code)}
                  </div>
                </div>

                {/* Unit */}
                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1">
                  <span className="text-[11px] font-bold text-slate-600 flex items-center gap-1">
                    <Boxes className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    واحد سنجش:
                  </span>
                  <div className="text-xs sm:text-sm font-black text-slate-800 truncate">
                    {viewingCatalogProduct.unit || 'عدد'}
                  </div>
                </div>
              </div>

              {/* Description if available */}
              {viewingCatalogProduct.description && (
                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1">
                  <span className="text-[11px] font-bold text-slate-500 block">توضیحات و مشخصات تکمیلی:</span>
                  <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap break-words">
                    {viewingCatalogProduct.description}
                  </p>
                </div>
              )}

              {/* Variants List if available */}
              {viewingCatalogProduct.hasVariants && viewingCatalogProduct.variants && viewingCatalogProduct.variants.length > 0 && (
                <div className="p-3 sm:p-3.5 rounded-2xl bg-purple-50/50 border border-purple-200/80 space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-purple-900">
                    <span className="flex items-center gap-1.5">
                      <Layers className="w-4 h-4 text-purple-600 shrink-0" />
                      تنوع‌های رنگ و مدل تعریف‌شده ({toPersianDigits(viewingCatalogProduct.variants.length)} مورد):
                    </span>
                  </div>
                  <div className="space-y-1.5 max-h-40 overflow-y-auto">
                    {viewingCatalogProduct.variants.map((v) => (
                      <div
                        key={v.id}
                        className="bg-white p-2.5 rounded-xl border border-purple-100 flex items-center justify-between text-xs gap-2"
                      >
                        <span className="font-bold text-slate-800 truncate">{v.name}</span>
                        <div className="flex items-center gap-2.5 shrink-0">
                          <span className="text-[11px] text-slate-500">
                            موجودی: <strong className="text-slate-800 font-mono">{toPersianDigits(v.stock)}</strong>
                          </span>
                          <span className="text-[11px] font-black text-emerald-700 font-mono">
                            {formatPrice(v.sellPrice || viewingCatalogProduct.sellPrice)} {settings.currency}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-3.5 py-3 sm:px-5 sm:py-3.5 bg-slate-50/80 border-t border-slate-200/80 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => {
                  const p = viewingCatalogProduct;
                  setViewingCatalogProduct(null);
                  handleOpenEditProduct(p);
                }}
                className="flex items-center justify-center gap-1.5 px-4 py-2.5 sm:py-2 rounded-xl text-xs font-bold bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 transition-all cursor-pointer shadow-2xs active:scale-[0.98]"
              >
                <Pencil className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span>ویرایش این کالا</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setViewingCatalogProduct(null)}
                  className="flex-1 sm:flex-none px-4 py-2.5 sm:py-2 rounded-xl text-xs font-bold bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 transition-colors cursor-pointer text-center"
                >
                  بستن
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (viewingCatalogProduct.hasVariants && viewingCatalogProduct.variants && viewingCatalogProduct.variants.length > 0) {
                      setVariantPickerProduct(viewingCatalogProduct);
                    } else {
                      handleAddProduct(viewingCatalogProduct);
                    }
                    setViewingCatalogProduct(null);
                  }}
                  className="flex-2 sm:flex-none flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2.5 sm:py-2 rounded-xl transition-all shadow-xs cursor-pointer active:scale-[0.98]"
                >
                  <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>افزودن به فاکتور</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: PRODUCT QUICK EDIT (پنجره ویرایش کالا در همانجا) */}
      {editingCatalogProduct && (
        <div
          id="product-edit-modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) setEditingCatalogProduct(null);
          }}
          className="fixed inset-0 z-70 bg-black/60 backdrop-blur-xs flex items-center justify-center p-2.5 sm:p-4 animate-in fade-in duration-150"
        >
          <div
            id="product-edit-modal"
            className="bg-white rounded-3xl w-full max-w-lg shadow-2xl border border-slate-200/80 max-h-[92vh] sm:max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 sm:px-5 sm:py-3.5 bg-slate-900 text-white shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30 shrink-0">
                  <Pencil className="w-4 h-4 stroke-[2.5]" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-black text-sm sm:text-base leading-tight truncate">
                    ویرایش مشخصات کالا
                  </h3>
                  <span className="text-[11px] text-slate-300 font-medium truncate block">
                    بروزرسانی مستقیم نام، قیمت و موجودی انبار
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingCatalogProduct(null)}
                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center cursor-pointer transition-colors shrink-0"
                title="بستن"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSaveProductEdit} className="flex-1 flex flex-col min-h-0 overflow-hidden">
              <div className="flex-1 overflow-y-auto p-3.5 sm:p-5 space-y-3 sm:space-y-4">
                {/* Product Name (الزامی) */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    نام کالا *
                  </label>
                  <input
                    type="text"
                    required
                    value={editProductForm.name}
                    onChange={(e) => setEditProductForm({ ...editProductForm, name: e.target.value })}
                    placeholder="نام کامل کالا..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 sm:py-2.5 text-xs sm:text-sm font-bold text-slate-900 outline-none focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 transition-all"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
                  {/* Code */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-bold text-slate-700">
                        کد کالا
                      </label>
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-1.5 py-0.2 rounded-full flex items-center gap-1">
                        <Sparkles className="w-2.5 h-2.5 text-emerald-600" />
                        <span>سیستم</span>
                      </span>
                    </div>
                    <div className="relative">
                      <input
                        type="text"
                        value={editProductForm.code}
                        onChange={(e) => setEditProductForm({ ...editProductForm, code: e.target.value })}
                        placeholder="کد کالا..."
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 pl-8 text-xs font-mono font-bold text-slate-900 outline-none focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 transition-all text-left"
                      />
                      <button
                        type="button"
                        onClick={handleRegenerateCatalogCode}
                        className="absolute left-1.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-emerald-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                        title="تولید مجدد کد کالا توسط سیستم"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Category */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      دسته‌بندی
                    </label>
                    <input
                      type="text"
                      value={editProductForm.category}
                      onChange={(e) => setEditProductForm({ ...editProductForm, category: e.target.value })}
                      placeholder="مثال: عمومی، ابزار..."
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-900 outline-none focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 transition-all"
                    />
                  </div>
                </div>

                {/* Unit */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    واحد سنجش
                  </label>
                  <select
                    value={editProductForm.unit}
                    onChange={(e) => setEditProductForm({ ...editProductForm, unit: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-900 outline-none focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 transition-all cursor-pointer"
                  >
                      <option value="عدد">عدد</option>
                      <option value="دستگاه">دستگاه</option>
                      <option value="بسته">بسته</option>
                      <option value="کیلوگرم">کیلوگرم</option>
                      <option value="متر">متر</option>
                      <option value="کارتن">کارتن</option>
                      <option value="جفت">جفت</option>
                      <option value="لیتر">لیتر</option>
                      <option value="قوطی">قوطی</option>
                      <option value="شاخه">شاخه</option>
                    </select>
                  </div>

                {/* Pricing Box */}
                <div className="p-3 sm:p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2.5 sm:space-y-3">
                  <span className="text-[11px] font-black text-slate-700 block">
                    قیمت‌گذاری مالی ({settings.currency}):
                  </span>
                  <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">
                        قیمت فروش ({settings.currency}) *
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={editProductForm.sellPrice}
                        onChange={(e) => setEditProductForm({ ...editProductForm, sellPrice: parseFloat(e.target.value) || 0 })}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-emerald-700 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">
                        قیمت خرید ({settings.currency})
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={editProductForm.buyPrice}
                        onChange={(e) => setEditProductForm({ ...editProductForm, buyPrice: parseFloat(e.target.value) || 0 })}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Stock Box */}
                <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      موجودی انبار ({editProductForm.unit})
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={editProductForm.stock}
                      onChange={(e) => setEditProductForm({ ...editProductForm, stock: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 outline-none focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      حداقل موجودی هشدار
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={editProductForm.minStockAlert}
                      onChange={(e) => setEditProductForm({ ...editProductForm, minStockAlert: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 outline-none focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 transition-all"
                    />
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    توضیحات و مشخصات
                  </label>
                  <textarea
                    rows={2}
                    value={editProductForm.description}
                    onChange={(e) => setEditProductForm({ ...editProductForm, description: e.target.value })}
                    placeholder="مشخصات فنی، محل قفسه یا یادداشت..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-900 outline-none focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 transition-all resize-none"
                  />
                </div>
              </div>

              {/* Footer */}
              <div className="px-3.5 py-3 sm:px-5 sm:py-3.5 bg-slate-50/80 border-t border-slate-200/80 flex items-center justify-end gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setEditingCatalogProduct(null)}
                  className="flex-1 sm:flex-none px-4 py-2.5 sm:py-2 rounded-xl text-xs font-bold bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 transition-colors cursor-pointer text-center"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="flex-2 sm:flex-none flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black px-5 py-2.5 sm:py-2 rounded-xl transition-all shadow-xs cursor-pointer active:scale-[0.98]"
                >
                  <Check className="w-4 h-4 stroke-[2.5]" />
                  <span>ذخیره تغییرات کالا</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: VARIANT SELECTION MODAL (انتخاب تنوع و رنگ کالا) */}
      {variantPickerProduct && (
        <div className="fixed inset-0 z-60 bg-black/60 backdrop-blur-xs flex items-center justify-center p-2.5 sm:p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl w-full max-w-md p-4 sm:p-5 shadow-2xl space-y-3.5 sm:space-y-4 max-h-[88vh] sm:max-h-[85vh] flex flex-col animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
                  <Layers className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-black text-slate-900 text-sm sm:text-base leading-tight truncate">
                    {variantPickerProduct.name}
                  </h3>
                  <span className="text-[11px] text-purple-700 font-medium truncate block">
                    انتخاب رنگ و مدل جهت درج در فاکتور
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setVariantPickerProduct(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-xs text-slate-500">
              این کالا دارای تنوع‌های مختلف است. رنگ یا مدل مورد نظرتان را برای افزودن به فاکتور انتخاب نمایید:
            </div>

            {/* List of variants */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-0.5">
              {(variantPickerProduct.variants || []).map((v) => {
                const inInvoice = items.find(
                  (it) => it.productId === variantPickerProduct.id && it.variantId === v.id
                );
                const isOutOfStock = v.stock <= 0;
                const price = (v.sellPrice && v.sellPrice > 0) ? v.sellPrice : variantPickerProduct.sellPrice;

                return (
                  <div
                    key={v.id}
                    onClick={() => handleAddProduct(variantPickerProduct, v)}
                    className={`p-3 sm:p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                      inInvoice
                        ? 'border-purple-500 bg-purple-50/50 shadow-xs'
                        : 'border-slate-200 hover:border-purple-300 hover:bg-purple-50/20 bg-white'
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-black text-slate-900 text-xs sm:text-sm">
                          {v.name}
                        </span>
                        {v.code && (
                          <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-md font-mono">
                            {v.code}
                          </span>
                        )}
                      </div>

                      <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-2 flex-wrap">
                        <span>
                          موجودی:{' '}
                          <strong className={isOutOfStock ? 'text-rose-600 font-bold' : 'text-slate-800 font-mono'}>
                            {toPersianDigits(v.stock)} {variantPickerProduct.unit}
                          </strong>
                        </span>
                        <span className="text-slate-300">|</span>
                        <span className="font-extrabold text-emerald-700 font-mono">
                          {formatPrice(price)} {settings.currency}
                        </span>
                      </div>
                    </div>

                    <div className="shrink-0">
                      {inInvoice ? (
                        <div className="flex items-center gap-1 bg-purple-600 text-white text-xs font-black px-2.5 py-1 rounded-xl shadow-xs">
                          <Check className="w-3.5 h-3.5" />
                          <span>{toPersianDigits(inInvoice.quantity)}</span>
                        </div>
                      ) : (
                        <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center hover:bg-purple-600 hover:text-white transition-colors">
                          <Plus className="w-4 h-4 stroke-[2.5]" />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2">
              <span className="text-[11px] sm:text-xs text-slate-500">
                موجودی کل کالا: <strong className="text-slate-800 font-mono">{toPersianDigits(variantPickerProduct.stock)} {variantPickerProduct.unit}</strong>
              </span>
              <button
                type="button"
                onClick={() => setVariantPickerProduct(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors cursor-pointer"
              >
                بستن
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: SERVICE / CUSTOM ITEM (آیتم خدماتی بدون کالا) */}
      {isServiceModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-3">
          <div className="bg-white rounded-3xl w-full max-w-md p-5 shadow-2xl space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-0.5 text-blue-600 font-black text-sm bg-blue-50 p-2 rounded-xl border border-blue-200">
                  <span>▲</span>
                  <span>■</span>
                  <span>●</span>
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-base">افزودن آیتم خدماتی / بدون کالا</h3>
                  <span className="text-[11px] text-slate-400 font-medium">خدمات، حمل و نقل، یا اقلام سفارشی بدون کسر از موجودی</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsServiceModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  شرح خدمات یا نام آیتم:
                </label>
                <input
                  type="text"
                  value={serviceName}
                  onChange={(e) => setServiceName(e.target.value)}
                  placeholder="مثلاً: هزینه حمل و ارسال، نصب و راه‌اندازی، بسته بندی..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    قیمت واحد:
                  </label>
                  <input
                    type="number"
                    value={servicePrice || ''}
                    onChange={(e) => setServicePrice(parseFloat(e.target.value) || 0)}
                    placeholder="مبلغ به ریال"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 text-left"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    واحد:
                  </label>
                  <input
                    type="text"
                    value={serviceUnit}
                    onChange={(e) => setServiceUnit(e.target.value)}
                    placeholder="موردی، ساعت، سرویس..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  تعداد / مقدار:
                </label>
                <input
                  type="number"
                  min="1"
                  value={serviceQuantity}
                  onChange={(e) => setServiceQuantity(parseInt(e.target.value, 10) || 1)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 text-center"
                />
              </div>

              {/* کد اختصاصی خدمات تعیین‌شده توسط سیستم */}
              <div className="bg-blue-50/70 border border-blue-200/80 rounded-2xl p-3 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-blue-900 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                    <span>شناسه و کد اختصاصی خدمات (سیستم خودکار):</span>
                  </span>
                  <span className="text-[10px] font-bold bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
                    سیستم هوشمند
                  </span>
                </div>
                <div className="text-xs">
                  <div className="bg-white p-2.5 rounded-xl border border-blue-100 flex items-center justify-between">
                    <span className="text-xs text-slate-500">کد خدمات:</span>
                    <span className="font-mono font-bold text-blue-950 text-sm">{toPersianDigits(generateNextServiceCode(items))}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 flex items-center gap-2">
              <button
                type="button"
                onClick={handleAddServiceItem}
                className="flex-1 bg-[#1877f2] hover:bg-blue-600 text-white font-extrabold text-xs py-2.5 rounded-xl transition-colors shadow-xs"
              >
                افزودن به فاکتور
              </button>
              <button
                type="button"
                onClick={() => setIsServiceModalOpen(false)}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors"
              >
                انصراف
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: CUSTOMER SELECTOR (انتخاب مشتری) */}
      {isCustomerModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-3">
          <div className="bg-white rounded-3xl w-full max-w-md lg:max-w-xl p-5 shadow-2xl space-y-4 max-h-[85vh] flex flex-col animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center">
                  <Contact className="w-5 h-5 stroke-[2]" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-base">انتخاب طرف حساب / خریدار</h3>
                  <span className="text-[11px] text-slate-400 font-medium">مشتری مورد نظر را انتخاب یا جدید تعریف کنید</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsCustomerModalOpen(false);
                  setIsNewCustomerFormOpen(false);
                }}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {!isNewCustomerFormOpen ? (
              <>
                {/* Search Customer Input */}
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
                  <input
                    type="text"
                    value={customerSearchQuery}
                    onChange={(e) => setCustomerSearchQuery(e.target.value)}
                    placeholder="جستجوی نام یا شماره تماس مشتری..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-9 pl-3 py-2 text-xs sm:text-sm font-medium focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    autoFocus
                  />
                </div>

                {/* Option: Walk-in (متفرقه) */}
                <div
                  onClick={() => handleSelectCustomer(null)}
                  className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                    !selectedCustomerId
                      ? 'border-emerald-500 bg-emerald-50/50'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-xs">
                      م
                    </div>
                    <div>
                      <span className="font-extrabold text-slate-900 text-xs sm:text-sm block">
                        مشتری متفرقه / گذری
                      </span>
                      <span className="text-[11px] text-slate-400">فروش بدون نیاز به ثبت حساب مشتری</span>
                    </div>
                  </div>
                  {!selectedCustomerId && <Check className="w-4 h-4 text-emerald-600" />}
                </div>

                {/* Customer List */}
                <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                  {customers
                    .filter(
                      (c) =>
                        !customerSearchQuery.trim() ||
                        c.name.toLowerCase().includes(customerSearchQuery.toLowerCase()) ||
                        (c.phone && c.phone.includes(customerSearchQuery))
                    )
                    .map((cust) => {
                      const isSelected = selectedCustomerId === cust.id;
                      return (
                        <div
                          key={cust.id}
                          onClick={() => handleSelectCustomer(cust)}
                          className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                            isSelected
                              ? 'border-emerald-500 bg-emerald-50/50'
                              : 'border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs">
                              {cust.name.slice(0, 1)}
                            </div>
                            <div>
                              <span className="font-extrabold text-slate-900 text-xs sm:text-sm block">
                                {cust.name}
                              </span>
                              {cust.phone && (
                                <span className="text-[11px] text-slate-400" dir="ltr">
                                  {cust.phone}
                                </span>
                              )}
                            </div>
                          </div>
                          {isSelected && <Check className="w-4 h-4 text-emerald-600" />}
                        </div>
                      );
                    })}
                </div>

                {/* Bottom: Add New Customer Button */}
                <div className="pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsNewCustomerFormOpen(true)}
                    className="w-full bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2 shadow-xs"
                  >
                    <UserPlus className="w-4 h-4" />
                    <span>تعریف و ثبت مشتری جدید</span>
                  </button>
                </div>
              </>
            ) : (
              /* New Customer Form */
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    نام و نام خانوادگی خریدار: *
                  </label>
                  <input
                    type="text"
                    value={newCustName}
                    onChange={(e) => setNewCustName(e.target.value)}
                    placeholder="مثلاً: علی رضایی"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    شماره تماس / موبایل:
                  </label>
                  <input
                    type="tel"
                    value={newCustPhone}
                    onChange={(e) => setNewCustPhone(e.target.value)}
                    placeholder="۰۹۱۲۳۴۵۶۷۸۹"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none text-left"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    آدرس خریدار:
                  </label>
                  <input
                    type="text"
                    value={newCustAddress}
                    onChange={(e) => setNewCustAddress(e.target.value)}
                    placeholder="نشانی کامل جهت درج در پیش‌فاکتور یا فاکتور..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    کد ملی / شناسه ملی:
                  </label>
                  <input
                    type="text"
                    value={newCustNationalId}
                    onChange={(e) => setNewCustNationalId(e.target.value)}
                    placeholder="۱۰ رقمی"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none text-left"
                  />
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCreateCustomer}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs py-2.5 rounded-xl transition-colors shadow-xs"
                  >
                    ذخیره و انتخاب مشتری
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsNewCustomerFormOpen(false)}
                    className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors"
                  >
                    بازگشت
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL 5: SETTINGS & DETAILS (تنظیمات فاکتور و سربرگ) */}
      {isSettingsModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-3">
          <div className="bg-white rounded-3xl w-full max-w-md p-5 shadow-2xl space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
                  <GraduationCap className="w-5 h-5 stroke-[2.2]" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-base">مشخصات سند و نوع فاکتور</h3>
                  <span className="text-[11px] text-slate-400 font-medium">شماره فاکتور، تاریخ، قالب و پیش‌فاکتور</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsSettingsModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              {/* Proforma Switcher */}
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between">
                <div>
                  <span className="text-xs font-extrabold text-slate-900 block">حالت پیش‌فاکتور</span>
                  <span className="text-[10px] text-slate-500">عدم کسر از موجودی انبار تا تایید مشتری</span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsProforma(!isProforma)}
                  className={`px-3 py-1.5 rounded-xl font-extrabold text-xs transition-colors ${
                    isProforma
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                  }`}
                >
                  {isProforma ? 'فعال (پیش‌فاکتور)' : 'فاکتور قطعی فروش'}
                </button>
              </div>

              {/* Number and Date */}
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    شماره فاکتور:
                  </label>
                  <input
                    type="text"
                    value={invoiceNumber}
                    onChange={(e) => setInvoiceNumber(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 text-center focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    تاریخ صدور:
                  </label>
                  <input
                    type="text"
                    value={invoiceDate}
                    onChange={(e) => setInvoiceDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 text-center focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Template Choice */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  قالب چاپ فاکتور:
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setInvoiceType('standard')}
                    className={`py-2 px-1 text-center rounded-xl text-xs font-bold border transition-colors ${
                      invoiceType === 'standard'
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
                        : 'border-slate-200 bg-white text-slate-600'
                    }`}
                  >
                    استاندارد
                  </button>
                  <button
                    type="button"
                    onClick={() => setInvoiceType('official')}
                    className={`py-2 px-1 text-center rounded-xl text-xs font-bold border transition-colors ${
                      invoiceType === 'official'
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
                        : 'border-slate-200 bg-white text-slate-600'
                    }`}
                  >
                    رسمی دارایی
                  </button>
                  <button
                    type="button"
                    onClick={() => setInvoiceType('thermal')}
                    className={`py-2 px-1 text-center rounded-xl text-xs font-bold border transition-colors ${
                      invoiceType === 'thermal'
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
                        : 'border-slate-200 bg-white text-slate-600'
                    }`}
                  >
                    حرارتی فیش
                  </button>
                </div>
              </div>

              {/* Tax Toggle */}
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between">
                <div>
                  <span className="text-xs font-extrabold text-slate-900 block">مالیات بر ارزش افزوده</span>
                  <span className="text-[10px] text-slate-500">نرخ: {toPersianDigits(taxRate)}٪</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={taxEnabled}
                    onChange={(e) => setTaxEnabled(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                </label>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsSettingsModalOpen(false)}
                className="w-full bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs py-2.5 rounded-xl transition-colors"
              >
                تایید و بستن
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 6: CHECKOUT / SETTLEMENT & PRINT (تسویه و ثبت نهایی) */}
      {isCheckoutModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-3">
          <div className="bg-white rounded-3xl w-full max-w-lg lg:max-w-2xl p-5 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center">
                  <FileText className="w-5 h-5 stroke-[2.2]" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-base">تسویه حساب و ثبت فاکتور</h3>
                  <span className="text-[11px] text-slate-400 font-medium">روش تسویه و ثبت نهایی سند</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCheckoutModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Financial Summary Card */}
            <div className="bg-slate-50 rounded-2xl p-3.5 border border-slate-200 space-y-2 text-xs">
              <div className="flex items-center justify-between text-slate-600">
                <span>جمع اقلام ({toPersianDigits(items.length)} قلم):</span>
                <span className="font-bold">{formatPrice(subtotal)}</span>
              </div>

              {totalDiscount > 0 && (
                <div className="flex items-center justify-between text-rose-600 font-bold">
                  <span>تخفیف کل:</span>
                  <span>- {formatPrice(totalDiscount)}</span>
                </div>
              )}

              {taxEnabled && (
                <div className="flex items-center justify-between text-slate-600">
                  <span>مالیات بر ارزش افزوده ({toPersianDigits(taxRate)}٪):</span>
                  <span className="font-bold">+ {formatPrice(taxAmount)}</span>
                </div>
              )}

              <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-sm font-black text-slate-900">
                <span>مبلغ قابل پرداخت نهایی:</span>
                <span className="text-emerald-700 text-base">{formatPrice(finalTotal)}</span>
              </div>
            </div>

            {/* Extra Discount Input */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                تخفیف کلی مازاد روی فاکتور:
              </label>
              <input
                type="number"
                value={extraDiscount || ''}
                onChange={(e) => setExtraDiscount(parseFloat(e.target.value) || 0)}
                placeholder="مبلغ تخفیف مازاد به ریال"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 text-left focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            {/* Payment Method Selector */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-2">
                روش پرداخت / تسویه:
              </label>
              <div id="checkout-payment-methods-grid" className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('cash')}
                  className={`group p-3 rounded-2xl border text-right transition-all flex items-center justify-between gap-3 cursor-pointer select-none active:scale-[0.99] ${
                    paymentMethod === 'cash'
                      ? 'border-blue-600 bg-blue-50/80 text-blue-950 shadow-xs ring-1 ring-blue-500/20'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50/70'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                        paymentMethod === 'cash'
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-600 group-hover:bg-slate-200'
                      }`}
                    >
                      <Banknote className="w-5 h-5" />
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs sm:text-sm font-bold text-slate-900 truncate">پرداخت نقدی</span>
                      <span className="text-[11px] text-slate-500 font-medium truncate">دریافت وجه نقد فوری</span>
                    </div>
                  </div>
                  <div
                    className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 transition-all ${
                      paymentMethod === 'cash'
                        ? 'border-blue-600 bg-blue-600 text-white'
                        : 'border-slate-300 bg-slate-50'
                    }`}
                  >
                    {paymentMethod === 'cash' && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod('pos')}
                  className={`group p-3 rounded-2xl border text-right transition-all flex items-center justify-between gap-3 cursor-pointer select-none active:scale-[0.99] ${
                    paymentMethod === 'pos'
                      ? 'border-blue-600 bg-blue-50/80 text-blue-950 shadow-xs ring-1 ring-blue-500/20'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50/70'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                        paymentMethod === 'pos'
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-600 group-hover:bg-slate-200'
                      }`}
                    >
                      <CreditCard className="w-5 h-5" />
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs sm:text-sm font-bold text-slate-900 truncate">کارتخوان (POS)</span>
                      <span className="text-[11px] text-slate-500 font-medium truncate">پایانه فروشگاهی</span>
                    </div>
                  </div>
                  <div
                    className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 transition-all ${
                      paymentMethod === 'pos'
                        ? 'border-blue-600 bg-blue-600 text-white'
                        : 'border-slate-300 bg-slate-50'
                    }`}
                  >
                    {paymentMethod === 'pos' && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod('cheque')}
                  className={`group p-3 rounded-2xl border text-right transition-all flex items-center justify-between gap-3 cursor-pointer select-none active:scale-[0.99] ${
                    paymentMethod === 'cheque'
                      ? 'border-blue-600 bg-blue-50/80 text-blue-950 shadow-xs ring-1 ring-blue-500/20'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50/70'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                        paymentMethod === 'cheque'
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-600 group-hover:bg-slate-200'
                      }`}
                    >
                      <Landmark className="w-5 h-5" />
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs sm:text-sm font-bold text-slate-900 truncate">چک صیادی</span>
                      <span className="text-[11px] text-slate-500 font-medium truncate">ثبت مشخصات و سررسید</span>
                    </div>
                  </div>
                  <div
                    className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 transition-all ${
                      paymentMethod === 'cheque'
                        ? 'border-blue-600 bg-blue-600 text-white'
                        : 'border-slate-300 bg-slate-50'
                    }`}
                  >
                    {paymentMethod === 'cheque' && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod('transfer')}
                  className={`group p-3 rounded-2xl border text-right transition-all flex items-center justify-between gap-3 cursor-pointer select-none active:scale-[0.99] ${
                    paymentMethod === 'transfer'
                      ? 'border-blue-600 bg-blue-50/80 text-blue-950 shadow-xs ring-1 ring-blue-500/20'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50/70'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                        paymentMethod === 'transfer'
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-600 group-hover:bg-slate-200'
                      }`}
                    >
                      <ArrowUpDown className="w-5 h-5" />
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs sm:text-sm font-bold text-slate-900 truncate">کارت به کارت / حواله</span>
                      <span className="text-[11px] text-slate-500 font-medium truncate">انتقال وجه و شماره پیگیری</span>
                    </div>
                  </div>
                  <div
                    className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 transition-all ${
                      paymentMethod === 'transfer'
                        ? 'border-blue-600 bg-blue-600 text-white'
                        : 'border-slate-300 bg-slate-50'
                    }`}
                  >
                    {paymentMethod === 'transfer' && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                  </div>
                </button>
              </div>
            </div>

            {/* Payment Status (Paid / Unpaid / Partial) */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                وضعیت پرداخت:
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setPaymentStatus('paid');
                    setPaidAmount(finalTotal);
                  }}
                  className={`py-2 text-center rounded-xl text-xs font-bold border transition-colors ${
                    paymentStatus === 'paid'
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
                      : 'border-slate-200 bg-white text-slate-600'
                  }`}
                >
                  تسویه کامل
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setPaymentStatus('partial');
                    setPaidAmount(Math.round(finalTotal / 2));
                  }}
                  className={`py-2 text-center rounded-xl text-xs font-bold border transition-colors ${
                    paymentStatus === 'partial'
                      ? 'border-amber-500 bg-amber-50 text-amber-800'
                      : 'border-slate-200 bg-white text-slate-600'
                  }`}
                >
                  بیعانه / بخشی
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setPaymentStatus('unpaid');
                    setPaidAmount(0);
                  }}
                  className={`py-2 text-center rounded-xl text-xs font-bold border transition-colors ${
                    paymentStatus === 'unpaid'
                      ? 'border-rose-500 bg-rose-50 text-rose-800'
                      : 'border-slate-200 bg-white text-slate-600'
                  }`}
                >
                  نسیه / مانده حساب
                </button>
              </div>
            </div>

            {/* If Partial: Paid Amount input */}
            {paymentStatus === 'partial' && (
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  مبلغ پرداخت شده نقدی / علی‌الحساب:
                </label>
                <input
                  type="number"
                  value={paidAmount || ''}
                  onChange={(e) => setPaidAmount(parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 text-left focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            )}

            {/* If Cheque: Cheque Details */}
            {paymentMethod === 'cheque' && (
              <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-2xl space-y-2">
                <span className="text-xs font-extrabold text-amber-900 block">مشخصات چک صیادی:</span>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={chequeNumber}
                    onChange={(e) => setChequeNumber(e.target.value)}
                    placeholder="شماره صیادی ۱۶ رقمی"
                    className="w-full bg-white border border-amber-300 rounded-xl px-2.5 py-1.5 text-xs text-slate-800"
                  />
                  <input
                    type="text"
                    value={chequeDueDate}
                    onChange={(e) => setChequeDueDate(e.target.value)}
                    placeholder="تاریخ سررسید (۱۴۰۳/۰۵/۰۱)"
                    className="w-full bg-white border border-amber-300 rounded-xl px-2.5 py-1.5 text-xs text-slate-800 text-center"
                  />
                </div>
                <input
                  type="text"
                  value={chequeName}
                  onChange={(e) => setChequeName(e.target.value)}
                  placeholder="نام صاحب حساب / بانک صادرکننده"
                  className="w-full bg-white border border-amber-300 rounded-xl px-2.5 py-1.5 text-xs text-slate-800"
                />
              </div>
            )}

            {/* Notes */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                توضیحات و یادداشت فاکتور:
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="توضیحات تکمیلی جهت درج در پایین برگه فاکتور..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            {/* Actions: Save & Print vs Save */}
            <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                id="btn-save-and-print"
                onClick={() => handleFinalSubmit(true)}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs sm:text-sm py-3 rounded-2xl transition-all shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>ثبت و چاپ فوری فاکتور</span>
              </button>

              <button
                type="button"
                id="btn-save-final"
                onClick={() => handleFinalSubmit(false)}
                className="flex-1 bg-[#1877f2] hover:bg-blue-600 text-white font-extrabold text-xs sm:text-sm py-3 rounded-2xl transition-all shadow-md shadow-blue-500/20 flex items-center justify-center gap-2 cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>ثبت نهایی فاکتور</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
