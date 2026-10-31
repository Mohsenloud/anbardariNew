import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  Product, 
  Customer,
  PurchaseInvoice, 
  PurchaseInvoiceItem, 
  InboundReceipt, 
  PaymentMethod, 
  PaymentStatus, 
  StoreSettings, 
  AppUser 
} from '../types';
import { 
  toPersianDigits, 
  toEnglishDigits,
  formatPrice, 
  getCurrentJalaliDate,
  addDaysToJalali,
  JALALI_MONTH_NAMES,
  getJalaliMonthDays,
  getJalaliMonthStartWeekday
} from '../utils/jalali';
import { NumericInput } from './NumericInput';
import { JalaliDatePicker } from './JalaliDatePicker';
import { StorageService } from '../utils/storage';
import { generateNextProductCode } from '../utils/codeGenerator';
import { 
  Plus, 
  Trash2, 
  ShoppingBag, 
  PackagePlus, 
  Building2, 
  CreditCard, 
  X, 
  Check, 
  AlertCircle,
  PlusCircle,
  Hash,
  FileText,
  Search,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  ChevronLeft,
  Calendar,
  UserCheck,
  Send,
  Wrench
} from 'lucide-react';
import { isServiceItem } from '../utils/serviceHelper';

interface NewPurchaseInvoiceModalProps {
  products: Product[];
  settings: StoreSettings;
  currentUser?: AppUser;
  lastInvoiceNumber?: string;
  previousSuppliers?: string[];
  editingInvoice?: PurchaseInvoice | null;
  initialMode?: 'product' | 'service';
  onClose: () => void;
  onSavePurchase: (
    purchaseInvoice: PurchaseInvoice,
    inboundReceipt: InboundReceipt | null,
    newProductsCreated: Product[]
  ) => void;
}

export const NewPurchaseInvoiceModal: React.FC<NewPurchaseInvoiceModalProps> = ({
  products,
  settings,
  editingInvoice,
  previousSuppliers = [],
  initialMode = 'product',
  onClose,
  onSavePurchase,
}) => {
  const isEditing = !!editingInvoice;

  const [invoiceNumber, setInvoiceNumber] = useState(() => 
    editingInvoice?.invoiceNumber || StorageService.getNextPurchaseInvoiceNumber()
  );
  const [date, setDate] = useState(() => editingInvoice?.date || getCurrentJalaliDate());
  const [dueDate, setDueDate] = useState(() => editingInvoice?.dueDate || '');

  // Supplier state
  const [supplierName, setSupplierName] = useState(() => editingInvoice?.supplierName || '');
  const [supplierPhone, setSupplierPhone] = useState(() => editingInvoice?.supplierPhone || '');
  const [supplierAddress, setSupplierAddress] = useState(() => editingInvoice?.supplierAddress || '');
  const [supplierEconomicCode, setSupplierEconomicCode] = useState(() => editingInvoice?.supplierEconomicCode || '');

  // Validation error message (replacing blocking browser alert)
  const [validationError, setValidationError] = useState<string | null>(null);

  // Supplier dropdown search & details UI states
  const [isSupplierDropdownOpen, setIsSupplierDropdownOpen] = useState(false);
  const [supplierSearchInput, setSupplierSearchInput] = useState('');
  const [showOptionalDetails, setShowOptionalDetails] = useState(() => 
    !!(editingInvoice && (editingInvoice.supplierPhone || editingInvoice.supplierAddress || editingInvoice.supplierEconomicCode || editingInvoice.dueDate))
  );
  const supplierDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (supplierDropdownRef.current && !supplierDropdownRef.current.contains(e.target as Node)) {
        setIsSupplierDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Aggregate suppliers from database counterparties and previous purchases
  const availableSuppliers = useMemo(() => {
    const list: { name: string; phone?: string; address?: string; nationalId?: string }[] = [];
    const seen = new Set<string>();

    try {
      const registered = StorageService.getCustomers();
      registered.forEach((c) => {
        const trimmed = c.name?.trim();
        if (trimmed && !seen.has(trimmed.toLowerCase())) {
          seen.add(trimmed.toLowerCase());
          list.push({
            name: trimmed,
            phone: c.phone,
            address: c.address,
            nationalId: c.nationalId,
          });
        }
      });
    } catch (err) {
      console.error(err);
    }

    try {
      const purchases = StorageService.getPurchaseInvoices();
      const fromPurchases = purchases.map((p) => p.supplierName).filter(Boolean);
      [...previousSuppliers, ...fromPurchases].forEach((s) => {
        const trimmed = s?.trim();
        if (trimmed && !seen.has(trimmed.toLowerCase())) {
          seen.add(trimmed.toLowerCase());
          list.push({ name: trimmed });
        }
      });
    } catch (err) {
      console.error(err);
    }

    return list;
  }, [previousSuppliers]);

  const filteredSuppliers = useMemo(() => {
    if (!supplierSearchInput.trim()) return availableSuppliers;
    const query = supplierSearchInput.trim().toLowerCase();
    return availableSuppliers.filter(
      (s) =>
        s.name.toLowerCase().includes(query) ||
        (s.phone && s.phone.includes(query)) ||
        (s.nationalId && s.nationalId.includes(query))
    );
  }, [availableSuppliers, supplierSearchInput]);

  const handleSelectSupplier = (s: { name: string; phone?: string; address?: string; nationalId?: string }) => {
    setSupplierName(s.name);
    if (s.phone) setSupplierPhone(s.phone);
    if (s.address) setSupplierAddress(s.address);
    if (s.nationalId) setSupplierEconomicCode(s.nationalId);
    setIsSupplierDropdownOpen(false);
    setSupplierSearchInput('');
    setValidationError(null);
  };

  const handleClearSupplier = () => {
    setSupplierName('');
    setSupplierPhone('');
    setSupplierAddress('');
    setSupplierEconomicCode('');
    setSupplierSearchInput('');
  };

  // Quick product creation inside purchase
  const [createdNewProducts, setCreatedNewProducts] = useState<Product[]>([]);
  const allAvailableProducts = useMemo(() => [...products, ...createdNewProducts], [products, createdNewProducts]);

  // Live product search state (toolbar quick-add + per-row combobox)
  const [quickItemSearch, setQuickItemSearch] = useState('');
  const [isQuickItemDropdownOpen, setIsQuickItemDropdownOpen] = useState(false);
  const [activeRowDropdownIndex, setActiveRowDropdownIndex] = useState<number | null>(null);
  const [rowSearchQuery, setRowSearchQuery] = useState('');
  const quickItemSearchRef = useRef<HTMLDivElement>(null);
  const rowDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideProductClick = (e: MouseEvent) => {
      if (quickItemSearchRef.current && !quickItemSearchRef.current.contains(e.target as Node)) {
        setIsQuickItemDropdownOpen(false);
      }
      if (rowDropdownRef.current && !rowDropdownRef.current.contains(e.target as Node)) {
        setActiveRowDropdownIndex(null);
      }
    };
    document.addEventListener('mousedown', handleOutsideProductClick);
    return () => document.removeEventListener('mousedown', handleOutsideProductClick);
  }, []);

  const filteredQuickProducts = useMemo(() => {
    const q = toEnglishDigits(quickItemSearch.trim()).toLowerCase();
    if (!q) return allAvailableProducts.slice(0, 30);
    return allAvailableProducts.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        toEnglishDigits(p.code || '').toLowerCase().includes(q) ||
        (p.category && p.category.toLowerCase().includes(q))
    );
  }, [allAvailableProducts, quickItemSearch]);

  const filteredRowProducts = useMemo(() => {
    const q = toEnglishDigits(rowSearchQuery.trim()).toLowerCase();
    if (!q) return allAvailableProducts;
    return allAvailableProducts.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        toEnglishDigits(p.code || '').toLowerCase().includes(q) ||
        (p.category && p.category.toLowerCase().includes(q))
    );
  }, [allAvailableProducts, rowSearchQuery]);

  // Items in purchase invoice
  const [items, setItems] = useState<PurchaseInvoiceItem[]>(() => {
    if (editingInvoice && editingInvoice.items && editingInvoice.items.length > 0) {
      return editingInvoice.items.map((it) => ({
        ...it,
        isService: isServiceItem(it, products),
        itemType: isServiceItem(it, products) ? 'service' : 'product',
      }));
    }
    if (initialMode === 'service') {
      return [
        {
          id: `pur-srv-${Date.now()}-1`,
          productId: `service-${Date.now()}-1`,
          productName: '',
          productCode: 'SRV-101',
          unit: 'سرویس',
          quantity: 1,
          buyPrice: 0,
          discount: 0,
          total: 0,
          isService: true,
          itemType: 'service',
        },
      ];
    }
    const firstProd = products[0];
    return [
      {
        id: `item-${Date.now()}-1`,
        productId: firstProd?.id || '',
        productName: firstProd?.name || '',
        productCode: firstProd?.code || '',
        unit: firstProd?.unit || 'عدد',
        quantity: 1,
        buyPrice: firstProd?.purchasePrice || firstProd?.buyPrice || 0,
        discount: 0,
        total: firstProd?.purchasePrice || firstProd?.buyPrice || 0,
        isService: false,
        itemType: 'product',
      },
    ];
  });

  // Check if current items have services or are pure services
  const serviceItemsCount = useMemo(
    () => items.filter((it) => Boolean(it.isService || it.itemType === 'service' || isServiceItem(it, allAvailableProducts))).length,
    [items, allAvailableProducts]
  );
  const physicalItemsCount = items.length - serviceItemsCount;
  const isCurrentlyPureService = items.length > 0 && physicalItemsCount === 0;

  // Financials
  const [taxRate] = useState<number>(() => editingInvoice?.taxRate || 0);
  const [shippingCost, setShippingCost] = useState<number>(() => editingInvoice?.shippingCost || 0);
  const [overallDiscount, setOverallDiscount] = useState<number>(() => {
    if (!editingInvoice) return 0;
    const itemsDisc = editingInvoice.items?.reduce((s, it) => s + (it.discount || 0), 0) || 0;
    return Math.max(0, (editingInvoice.totalDiscount || 0) - itemsDisc);
  });
  const [showExtraFinancials, setShowExtraFinancials] = useState<boolean>(() =>
    Boolean(editingInvoice && ((editingInvoice.totalDiscount || 0) > 0 || (editingInvoice.shippingCost || 0) > 0))
  );

  // Payment configuration
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>(() => editingInvoice?.paymentStatus || 'paid');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(() => editingInvoice?.paymentMethod || 'transfer');
  const [paidAmount, setPaidAmount] = useState<number>(() => editingInvoice?.paidAmount || 0);
  const [chequeNumber, setChequeNumber] = useState(() => editingInvoice?.chequeNumber || '');
  const [chequeDueDate, setChequeDueDate] = useState(() => editingInvoice?.chequeDueDate || '');
  const [isChequeDateModalOpen, setIsChequeDateModalOpen] = useState(false);

  const parsedInitialChequeDate = useMemo(() => {
    const baseDate = toEnglishDigits(chequeDueDate || getCurrentJalaliDate());
    const parts = baseDate.split('/').map(Number);
    return {
      year: parts[0] || 1404,
      month: parts[1] || 1,
    };
  }, [chequeDueDate]);

  const [chequeCalYear, setChequeCalYear] = useState(parsedInitialChequeDate.year);
  const [chequeCalMonth, setChequeCalMonth] = useState(parsedInitialChequeDate.month);

  const openChequeDateModal = () => {
    const baseDate = toEnglishDigits(chequeDueDate || date || getCurrentJalaliDate());
    const parts = baseDate.split('/').map(Number);
    if (parts[0] && parts[1]) {
      setChequeCalYear(parts[0]);
      setChequeCalMonth(parts[1]);
    }
    setIsChequeDateModalOpen(true);
  };

  const [chequeName, setChequeName] = useState(() => editingInvoice?.chequeName || '');
  const [transferDescription, setTransferDescription] = useState(() => editingInvoice?.transferDescription || '');
  const [notes, setNotes] = useState(() => editingInvoice?.notes || '');
  const [showNotesField, setShowNotesField] = useState<boolean>(() => Boolean(editingInvoice?.notes));

  // Quick product creation modal inside purchase
  const [isQuickProductModalOpen, setIsQuickProductModalOpen] = useState(false);
  const [newProductName, setNewProductName] = useState('');
  const [newProductCategory, setNewProductCategory] = useState('عمومی');
  const [newProductUnit, setNewProductUnit] = useState('عدد');
  const [newProductBuyPrice, setNewProductBuyPrice] = useState<number>(0);
  const [newProductSellPrice, setNewProductSellPrice] = useState<number>(0);

  // Customizable Service Units (persisted in localStorage)
  const DEFAULT_SERVICE_UNITS = ['سرویس', 'مورد', 'ساعت', 'روز', 'پروژه', 'دستگاه', 'دوره', 'عدد'];
  const [serviceUnits, setServiceUnits] = useState<string[]>(() => {
    const savedSet = new Set<string>(DEFAULT_SERVICE_UNITS);
    try {
      const raw = localStorage.getItem('custom_service_units');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          parsed.forEach((u) => {
            if (typeof u === 'string' && u.trim()) savedSet.add(u.trim());
          });
        }
      }
    } catch (e) {
      console.error(e);
    }
    if (editingInvoice?.items) {
      editingInvoice.items.forEach((it) => {
        if (it.unit && it.unit.trim()) savedSet.add(it.unit.trim());
      });
    }
    return Array.from(savedSet);
  });

  const [isServiceUnitCreatorOpen, setIsServiceUnitCreatorOpen] = useState(false);
  const [newServiceUnitName, setNewServiceUnitName] = useState('');
  const [targetRowForNewUnit, setTargetRowForNewUnit] = useState<number | null>(null);

  const handleAddCustomServiceUnit = () => {
    const trimmed = newServiceUnitName.trim();
    if (!trimmed) return;

    const updatedUnits = serviceUnits.includes(trimmed) ? serviceUnits : [...serviceUnits, trimmed];
    setServiceUnits(updatedUnits);
    try {
      const customOnly = updatedUnits.filter((u) => !DEFAULT_SERVICE_UNITS.includes(u));
      localStorage.setItem('custom_service_units', JSON.stringify(customOnly));
    } catch (e) {
      console.error(e);
    }

    // Apply the newly defined unit to the target service row (or the last service row)
    setItems((prev) => {
      const next = [...prev];
      if (targetRowForNewUnit !== null && next[targetRowForNewUnit]) {
        next[targetRowForNewUnit] = { ...next[targetRowForNewUnit], unit: trimmed };
        return next;
      }
      // Otherwise apply to the last service row if one exists
      for (let i = next.length - 1; i >= 0; i--) {
        if (next[i].isService || next[i].itemType === 'service') {
          next[i] = { ...next[i], unit: trimmed };
          break;
        }
      }
      return next;
    });

    setNewServiceUnitName('');
    setTargetRowForNewUnit(null);
    setIsServiceUnitCreatorOpen(false);
  };

  const handleRemoveCustomServiceUnit = (unitToRemove: string) => {
    if (DEFAULT_SERVICE_UNITS.includes(unitToRemove)) return;
    const updatedUnits = serviceUnits.filter((u) => u !== unitToRemove);
    setServiceUnits(updatedUnits);
    try {
      const customOnly = updatedUnits.filter((u) => !DEFAULT_SERVICE_UNITS.includes(u));
      localStorage.setItem('custom_service_units', JSON.stringify(customOnly));
    } catch (e) {
      console.error(e);
    }
  };

  // Calculations
  const subtotal = items.reduce((sum, item) => sum + item.total, 0);
  const itemsDiscountSum = items.reduce((sum, item) => sum + (item.discount || 0), 0);
  const totalDiscount = overallDiscount + itemsDiscountSum;
  const taxableAmount = Math.max(0, subtotal - overallDiscount);
  const taxAmount = Math.round((taxableAmount * taxRate) / 100);
  const finalTotal = Math.max(0, taxableAmount + taxAmount + (shippingCost || 0));

  const handlePaymentStatusChange = (status: PaymentStatus) => {
    setPaymentStatus(status);
    if (status === 'paid') {
      setPaidAmount(finalTotal);
    } else if (status === 'unpaid') {
      setPaidAmount(0);
    } else if (status === 'partial') {
      if (paidAmount <= 0 || paidAmount >= finalTotal) {
        setPaidAmount(Math.round(finalTotal / 2));
      }
    }
    setValidationError(null);
  };

  // Switch between Product Mode and Service/Expense Mode cleanly from top header bar
  const handleSwitchHeaderMode = (targetMode: 'product' | 'service') => {
    setValidationError(null);
    if (targetMode === 'service') {
      if (isCurrentlyPureService) return;
      if (items.length === 1) {
        handleToggleRowType(0, 'service');
        return;
      }
      const hasUntouchedProductRow = items.some((it) => !it.isService && (!it.productId || it.buyPrice === 0));
      if (hasUntouchedProductRow) {
        setItems(
          items.map((it, idx) => {
            if (!it.isService && (!it.productId || it.buyPrice === 0)) {
              return {
                ...it,
                id: `pur-srv-${Date.now()}-${idx}`,
                productId: `service-${Date.now()}-${idx}`,
                productName: '',
                productCode: `SRV-${101 + idx}`,
                unit: 'سرویس',
                buyPrice: 0,
                total: 0,
                isService: true,
                itemType: 'service',
              };
            }
            return it;
          })
        );
      } else {
        handleAddServiceItem();
      }
    } else {
      if (!isCurrentlyPureService && serviceItemsCount === 0) return;
      if (items.length === 1) {
        handleToggleRowType(0, 'product');
        return;
      }
      const hasEmptyServiceRow = items.some((it) => (it.isService || it.itemType === 'service') && !it.productName.trim());
      if (hasEmptyServiceRow) {
        const firstProd = allAvailableProducts[0];
        const buyPrice = firstProd?.purchasePrice || firstProd?.buyPrice || 0;
        setItems(
          items.map((it, idx) => {
            if ((it.isService || it.itemType === 'service') && !it.productName.trim()) {
              return {
                ...it,
                id: `item-${Date.now()}-${idx}`,
                productId: firstProd?.id || '',
                productName: firstProd?.name || '',
                productCode: firstProd?.code || '',
                unit: firstProd?.unit || 'عدد',
                buyPrice,
                total: Math.max(0, (it.quantity || 1) * buyPrice - (it.discount || 0)),
                isService: false,
                itemType: 'product',
              };
            }
            return it;
          })
        );
      } else {
        handleAddItem();
      }
    }
  };

  const handleAddItem = () => {
    const firstProd = allAvailableProducts[0];
    const newItem: PurchaseInvoiceItem = {
      id: `item-${Date.now()}-${items.length + 1}`,
      productId: firstProd?.id || '',
      productName: firstProd?.name || '',
      productCode: firstProd?.code || '',
      unit: firstProd?.unit || 'عدد',
      quantity: 1,
      buyPrice: firstProd?.purchasePrice || firstProd?.buyPrice || 0,
      discount: 0,
      total: firstProd?.purchasePrice || firstProd?.buyPrice || 0,
      isService: false,
      itemType: 'product',
    };
    setItems([...items, newItem]);
    setValidationError(null);
  };

  const handleAddServiceItem = (presetTitle = '', presetUnit = 'سرویس') => {
    setValidationError(null);

    if (presetTitle) {
      const emptySrvIdx = items.findIndex(
        (it) => Boolean(it.isService || it.itemType === 'service' || isServiceItem(it, allAvailableProducts)) && !it.productName.trim()
      );
      if (emptySrvIdx !== -1) {
        const updated = [...items];
        updated[emptySrvIdx] = {
          ...updated[emptySrvIdx],
          productName: presetTitle,
          unit: presetUnit || updated[emptySrvIdx].unit || 'سرویس',
          isService: true,
          itemType: 'service',
        };
        setItems(updated);
        return;
      }
    }

    const nextSrvIndex = items.filter((i) => i.isService || i.itemType === 'service').length + 1;
    const srvCode = `SRV-${100 + nextSrvIndex}`;
    const newSrvItem: PurchaseInvoiceItem = {
      id: `pur-srv-${Date.now()}-${items.length + 1}`,
      productId: `service-${Date.now()}-${items.length + 1}`,
      productName: presetTitle,
      productCode: srvCode,
      unit: presetUnit,
      quantity: 1,
      buyPrice: 0,
      discount: 0,
      total: 0,
      isService: true,
      itemType: 'service',
    };

    setItems([...items, newSrvItem]);
  };

  const handleToggleRowType = (index: number, targetType: 'product' | 'service') => {
    const next = [...items];
    const current = next[index];
    if (targetType === 'service') {
      const srvIdx = next.filter((i) => i.isService || i.itemType === 'service').length + 1;
      next[index] = {
        ...current,
        id: current.id.startsWith('pur-srv-') ? current.id : `pur-srv-${Date.now()}-${index}`,
        productId: `service-${Date.now()}-${index}`,
        productName: current.isService ? current.productName : '',
        productCode: `SRV-${100 + srvIdx}`,
        unit: 'سرویس',
        buyPrice: current.isService ? current.buyPrice : 0,
        total: current.isService ? current.total : 0,
        isService: true,
        itemType: 'service',
      };
    } else {
      const firstProd = allAvailableProducts[0];
      const buyPrice = firstProd?.purchasePrice || firstProd?.buyPrice || 0;
      next[index] = {
        ...current,
        id: `item-${Date.now()}-${index}`,
        productId: firstProd?.id || '',
        productName: firstProd?.name || '',
        productCode: firstProd?.code || '',
        unit: firstProd?.unit || 'عدد',
        buyPrice,
        total: Math.max(0, (current.quantity || 1) * buyPrice - (current.discount || 0)),
        isService: false,
        itemType: 'product',
      };
    }
    setItems(next);
    setValidationError(null);
  };

  const handleRemoveItem = (index: number) => {
    setValidationError(null);
    if (items.length <= 1) {
      const current = items[0];
      const rowIsService = Boolean(current.isService || current.itemType === 'service' || isServiceItem(current, allAvailableProducts));
      if (rowIsService) {
        setItems([
          {
            ...current,
            productName: '',
            unit: 'سرویس',
            quantity: 1,
            buyPrice: 0,
            discount: 0,
            total: 0,
          },
        ]);
      } else {
        setItems([
          {
            ...current,
            productId: '',
            productName: '',
            productCode: '',
            unit: 'عدد',
            quantity: 1,
            buyPrice: 0,
            discount: 0,
            total: 0,
          },
        ]);
      }
      return;
    }
    setItems(items.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: keyof PurchaseInvoiceItem, val: any) => {
    const next = [...items];
    const item = { ...next[index], [field]: val };

    if (field === 'quantity' || field === 'buyPrice' || field === 'discount') {
      const q = field === 'quantity' ? Number(val) : item.quantity;
      const price = field === 'buyPrice' ? Number(val) : item.buyPrice;
      const disc = field === 'discount' ? Number(val) : item.discount;
      item.total = Math.max(0, q * price - disc);
    }

    next[index] = item;
    setItems(next);
  };

  const handleProductSelect = (index: number, productId: string) => {
    const prod = allAvailableProducts.find((p) => p.id === productId);
    if (!prod) return;

    const next = [...items];
    const item = { ...next[index] };
    item.productId = prod.id;
    item.productName = prod.name;
    item.productCode = prod.code;
    item.unit = prod.unit;
    item.buyPrice = prod.purchasePrice || prod.buyPrice || 0;
    item.total = Math.max(0, item.quantity * item.buyPrice - item.discount);
    item.isService = false;
    item.itemType = 'product';

    next[index] = item;
    setItems(next);
    setActiveRowDropdownIndex(null);
    setRowSearchQuery('');
    setValidationError(null);
  };

  const handleQuickAddProductFromSearch = (prod: Product) => {
    const buyPrice = prod.purchasePrice || prod.buyPrice || 0;
    setItems((prev) => {
      // Check if product already exists in rows
      const existingIdx = prev.findIndex((it) => !it.isService && it.productId === prod.id);
      if (existingIdx !== -1) {
        const updated = [...prev];
        const current = updated[existingIdx];
        const newQty = (current.quantity || 0) + 1;
        updated[existingIdx] = {
          ...current,
          quantity: newQty,
          total: Math.max(0, newQty * current.buyPrice - (current.discount || 0)),
        };
        return updated;
      }

      // If there's a single row without a selected product (and not a filled service), replace it
      if (prev.length === 1 && !prev[0].productId && !prev[0].productName.trim()) {
        return [
          {
            ...prev[0],
            productId: prod.id,
            productName: prod.name,
            productCode: prod.code,
            unit: prod.unit || 'عدد',
            quantity: 1,
            buyPrice,
            discount: 0,
            total: buyPrice,
            isService: false,
            itemType: 'product',
          },
        ];
      }

      return [
        ...prev,
        {
          id: `item-${Date.now()}-${prev.length + 1}`,
          productId: prod.id,
          productName: prod.name,
          productCode: prod.code,
          unit: prod.unit || 'عدد',
          quantity: 1,
          buyPrice,
          discount: 0,
          total: buyPrice,
          isService: false,
          itemType: 'product',
        },
      ];
    });
    setQuickItemSearch('');
    setIsQuickItemDropdownOpen(false);
    setValidationError(null);
  };

  const handleCreateQuickProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProductName.trim()) return;

    const nextCode = generateNextProductCode(allAvailableProducts);
    const newProd: Product = {
      id: `prod-${Date.now()}`,
      code: nextCode,
      name: newProductName.trim(),
      category: newProductCategory.trim() || 'عمومی',
      unit: newProductUnit.trim() || 'عدد',
      buyPrice: newProductBuyPrice,
      sellPrice: newProductSellPrice || newProductBuyPrice,
      purchasePrice: newProductBuyPrice,
      stock: 0,
      minStockAlert: 5,
      updatedAt: new Date().toISOString(),
    };

    setCreatedNewProducts([...createdNewProducts, newProd]);

    setItems((prev) => {
      const updated = [...prev];
      const lastIdx = updated.length - 1;
      if (updated[lastIdx] && !updated[lastIdx].productName && !updated[lastIdx].isService) {
        updated[lastIdx] = {
          ...updated[lastIdx],
          productId: newProd.id,
          productName: newProd.name,
          productCode: newProd.code,
          unit: newProd.unit,
          buyPrice: newProd.buyPrice,
          total: updated[lastIdx].quantity * newProd.buyPrice,
          isService: false,
          itemType: 'product',
        };
      } else {
        updated.push({
          id: `item-${Date.now()}`,
          productId: newProd.id,
          productName: newProd.name,
          productCode: newProd.code,
          unit: newProd.unit,
          quantity: 1,
          buyPrice: newProd.buyPrice,
          discount: 0,
          total: newProd.buyPrice,
          isService: false,
          itemType: 'product',
        });
      }
      return updated;
    });

    setNewProductName('');
    setNewProductBuyPrice(0);
    setNewProductSellPrice(0);
    setIsQuickProductModalOpen(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    const finalSupplierName = supplierName.trim() || supplierSearchInput.trim();
    if (!finalSupplierName) {
      setValidationError(
        isCurrentlyPureService
          ? 'لطفاً نام مجری خدمات / طرف حساب (دریافت‌کننده وجه) را وارد و یا از لیست انتخاب نمایید.'
          : 'لطفاً نام تامین‌کننده، فروشنده یا مجری خدمات را وارد و یا از لیست انتخاب نمایید.'
      );
      return;
    }

    if (!invoiceNumber.trim()) {
      setValidationError('لطفاً شماره فاکتور خرید را وارد نمایید.');
      return;
    }

    if (items.length === 0) {
      setValidationError('لطفاً حداقل یک ردیف کالا یا خدمات در فاکتور ثبت نمایید.');
      return;
    }

    // Validate each row according to its type (Product vs Service)
    for (let idx = 0; idx < items.length; idx++) {
      const it = items[idx];
      const rowIsService = Boolean(it.isService || it.itemType === 'service' || isServiceItem(it, allAvailableProducts));
      if (rowIsService) {
        if (!it.productName || !it.productName.trim()) {
          setValidationError(`لطفاً شرح خدمات / عنوان هزینه را در ردیف ${toPersianDigits(idx + 1)} وارد نمایید.`);
          return;
        }
        if (it.quantity <= 0) {
          setValidationError(`تعداد/مقدار خدمت در ردیف ${toPersianDigits(idx + 1)} باید بیشتر از صفر باشد.`);
          return;
        }
        if ((it.buyPrice || 0) <= 0) {
          setValidationError(`لطفاً مبلغ / هزینه خدمت «${it.productName.trim()}» را در ردیف ${toPersianDigits(idx + 1)} وارد نمایید.`);
          return;
        }
      } else {
        if (!it.productId) {
          setValidationError(`لطفاً کالای ردیف ${toPersianDigits(idx + 1)} را انتخاب کنید (یا نوع ردیف را به «خدمات» تغییر دهید).`);
          return;
        }
        if (it.quantity <= 0) {
          setValidationError(`تعداد کالای ردیف ${toPersianDigits(idx + 1)} باید بیشتر از صفر باشد.`);
          return;
        }
      }
    }

    if (paymentStatus === 'partial') {
      if (paidAmount <= 0) {
        setValidationError('در حالت «بیعانه / بخشی»، مبلغ پرداختی باید بیشتر از صفر باشد (در صورت عدم پرداخت، وضعیت را روی «نسیه» قرار دهید).');
        return;
      }
      if (paidAmount > finalTotal) {
        setValidationError(`مبلغ پرداختی (${toPersianDigits(formatPrice(paidAmount))} تومان) نمی‌تواند بیشتر از مبلغ نهایی فاکتور (${toPersianDigits(formatPrice(finalTotal))} تومان) باشد.`);
        return;
      }
    }

    const normalizedItems: PurchaseInvoiceItem[] = items.map((it, idx) => {
      const rowIsService = Boolean(it.isService || it.itemType === 'service' || isServiceItem(it, allAvailableProducts));
      if (rowIsService) {
        return {
          ...it,
          id: it.id.startsWith('pur-srv-') ? it.id : `pur-srv-${Date.now()}-${idx}`,
          productId: it.productId && it.productId.startsWith('service-') ? it.productId : `service-${Date.now()}-${idx}`,
          productName: it.productName.trim(),
          productCode: it.productCode && it.productCode.startsWith('SRV') ? it.productCode : `SRV-${101 + idx}`,
          unit: it.unit?.trim() || 'سرویس',
          isService: true,
          itemType: 'service',
        };
      }
      return {
        ...it,
        isService: false,
        itemType: 'product',
      };
    });

    const physicalItems = normalizedItems.filter((it) => !it.isService);
    const isServiceOnlyInvoice = physicalItems.length === 0;

    const purchaseId = editingInvoice?.id || `pur-${Date.now()}`;
    let inboundReceipt: InboundReceipt | null = null;
    let receiptId: string | undefined = undefined;

    if (!isServiceOnlyInvoice) {
      receiptId = editingInvoice?.inboundReceiptId || `inb-${Date.now()}`;
      const receiptNumber = StorageService.getNextInboundReceiptNumber();

      let existingReceipt: InboundReceipt | undefined;
      if (editingInvoice?.inboundReceiptId) {
        try {
          existingReceipt = StorageService.getInboundReceipts().find((r) => r.id === editingInvoice.inboundReceiptId);
        } catch (err) {
          console.error(err);
        }
      }

      inboundReceipt = existingReceipt
        ? {
            ...existingReceipt,
            purchaseInvoiceNumber: invoiceNumber.trim(),
            supplierName: finalSupplierName,
            date,
            items: physicalItems.map((item, idx) => {
              const existingItem = existingReceipt?.items.find((ri) => ri.productId === item.productId);
              const received = existingItem ? existingItem.receivedQuantity : 0;
              return {
                id: existingItem?.id || `rec-item-${Date.now()}-${idx}`,
                productId: item.productId,
                productName: item.productName,
                productCode: item.productCode,
                unit: item.unit,
                expectedQuantity: item.quantity,
                receivedQuantity: received,
                discrepancy: received - item.quantity,
                buyPrice: item.buyPrice,
              };
            }),
            totalExpectedQuantity: physicalItems.reduce((sum, i) => sum + i.quantity, 0),
            totalDiscrepancy: existingReceipt.items
              ? existingReceipt.totalReceivedQuantity - physicalItems.reduce((sum, i) => sum + i.quantity, 0)
              : -physicalItems.reduce((sum, i) => sum + i.quantity, 0),
            notes: notes.trim() || existingReceipt.notes || `رسید ورود انبار متناظر با فاکتور خرید ${invoiceNumber.trim()}`,
            updatedAt: new Date().toISOString(),
          }
        : {
            id: receiptId,
            receiptNumber,
            purchaseInvoiceId: purchaseId,
            purchaseInvoiceNumber: invoiceNumber.trim(),
            supplierName: finalSupplierName,
            date,
            status: 'pending_verification',
            items: physicalItems.map((item, idx) => ({
              id: `rec-item-${Date.now()}-${idx}`,
              productId: item.productId,
              productName: item.productName,
              productCode: item.productCode,
              unit: item.unit,
              expectedQuantity: item.quantity,
              receivedQuantity: 0,
              discrepancy: -item.quantity,
              buyPrice: item.buyPrice,
            })),
            totalExpectedQuantity: physicalItems.reduce((sum, i) => sum + i.quantity, 0),
            totalReceivedQuantity: 0,
            totalDiscrepancy: -physicalItems.reduce((sum, i) => sum + i.quantity, 0),
            notes: notes.trim() || `رسید ورود انبار متناظر با فاکتور خرید ${invoiceNumber.trim()}`,
            createdAt: new Date().toISOString(),
          };
    }

    const effectivePaidAmount =
      paymentStatus === 'paid'
        ? finalTotal
        : paymentStatus === 'unpaid'
        ? 0
        : Math.min(finalTotal, Math.max(0, paidAmount));
    const effectivePaymentStatus: PaymentStatus =
      paymentStatus === 'partial' && effectivePaidAmount === finalTotal ? 'paid' : paymentStatus;

    const purchaseInvoice: PurchaseInvoice = {
      id: purchaseId,
      invoiceNumber: invoiceNumber.trim(),
      supplierName: finalSupplierName,
      supplierPhone: supplierPhone.trim() || undefined,
      supplierAddress: supplierAddress.trim() || undefined,
      supplierEconomicCode: supplierEconomicCode.trim() || undefined,
      date,
      dueDate: dueDate.trim() || undefined,
      items: normalizedItems,
      subtotal,
      totalDiscount,
      taxRate,
      taxAmount,
      shippingCost: shippingCost || undefined,
      finalTotal,
      paymentStatus: effectivePaymentStatus,
      paymentMethod: effectivePaymentStatus === 'unpaid' ? 'credit' : paymentMethod,
      paidAmount: effectivePaidAmount,
      chequeNumber: effectivePaymentStatus !== 'unpaid' && paymentMethod === 'cheque' ? chequeNumber.trim() || undefined : undefined,
      chequeDueDate: effectivePaymentStatus !== 'unpaid' && paymentMethod === 'cheque' ? chequeDueDate.trim() || undefined : undefined,
      chequeName: effectivePaymentStatus !== 'unpaid' && paymentMethod === 'cheque' ? chequeName.trim() || undefined : undefined,
      transferDescription: effectivePaymentStatus !== 'unpaid' && paymentMethod !== 'cheque' ? transferDescription.trim() || undefined : undefined,
      notes: notes.trim() || undefined,
      status: isServiceOnlyInvoice ? 'completed' : editingInvoice?.status || 'pending_receipt',
      inboundReceiptId: isServiceOnlyInvoice ? undefined : receiptId,
      isServiceOnly: isServiceOnlyInvoice,
      createdAt: editingInvoice?.createdAt || new Date().toISOString(),
      updatedAt: isEditing ? new Date().toISOString() : undefined,
    };

    try {
      const customers = StorageService.getCustomers();
      const existingCustomer = customers.find(
        (c) => c.name.trim().toLowerCase() === finalSupplierName.toLowerCase()
      );
      if (!existingCustomer) {
        const newCustomer: Customer = {
          id: `cust-supp-${Date.now()}`,
          name: finalSupplierName,
          phone: supplierPhone.trim() || '',
          address: supplierAddress.trim() || undefined,
          nationalId: supplierEconomicCode.trim() || undefined,
          notes: isServiceOnlyInvoice
            ? 'مجری خدمات / طرف‌حساب خدماتی (ثبت خودکار از فاکتور خرید خدمات)'
            : 'تامین‌کننده / فروشنده کالا (ثبت خودکار از فاکتور خرید)',
          createdAt: new Date().toISOString(),
        };
        StorageService.saveCustomers([newCustomer, ...customers]);
      } else if (supplierPhone.trim() && !existingCustomer.phone) {
        const updated = customers.map((c) =>
          c.id === existingCustomer.id
            ? {
                ...c,
                phone: supplierPhone.trim(),
                address: c.address || supplierAddress.trim() || undefined,
              }
            : c
        );
        StorageService.saveCustomers(updated);
      }
    } catch (e) {
      console.error('Failed to sync supplier to customers list', e);
    }

    onSavePurchase(purchaseInvoice, inboundReceipt, createdNewProducts);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
      <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh] border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
        
        {/* Compact Header Bar */}
        <div className="bg-slate-900 text-white px-4 py-3 flex items-center justify-between gap-2 shrink-0 border-b border-slate-800 flex-wrap">
          <div className="flex items-center gap-2.5">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
                isCurrentlyPureService
                  ? 'bg-violet-500/20 text-violet-300 border-violet-500/30'
                  : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
              }`}
            >
              {isCurrentlyPureService ? <Wrench className="w-4 h-4" /> : <ShoppingBag className="w-4 h-4" />}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-sm sm:text-base font-black text-white">
                  {isEditing
                    ? isCurrentlyPureService
                      ? `ویرایش فاکتور خرید خدمات ${toPersianDigits(invoiceNumber)}`
                      : `ویرایش فاکتور خرید ${toPersianDigits(invoiceNumber)}`
                    : isCurrentlyPureService
                    ? 'ثبت فاکتور خرید خدمات و هزینه'
                    : serviceItemsCount > 0
                    ? 'ثبت فاکتور خرید کالا و خدمات'
                    : 'ثبت فاکتور خرید کالا'}
                </h2>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                    isCurrentlyPureService
                      ? 'bg-violet-500/20 text-violet-300 border-violet-500/30'
                      : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                  }`}
                >
                  {isEditing
                    ? 'در حال ویرایش'
                    : isCurrentlyPureService
                    ? 'ثبت آنی هزینه خدمات (بدون نیاز به انبار)'
                    : 'صدور حواله انبار'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Quick Mode Switcher */}
            <div className="flex items-center bg-slate-800 p-0.5 rounded-xl border border-slate-700 text-[11px] font-bold">
              <button
                type="button"
                onClick={() => handleSwitchHeaderMode('product')}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                  !isCurrentlyPureService
                    ? 'bg-emerald-600 text-white shadow-2xs'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <ShoppingBag className="w-3 h-3" />
                <span>خرید کالا</span>
              </button>
              <button
                type="button"
                onClick={() => handleSwitchHeaderMode('service')}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                  isCurrentlyPureService
                    ? 'bg-violet-600 text-white shadow-2xs'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Wrench className="w-3 h-3" />
                <span>خرید خدمات / هزینه</span>
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              title="بستن پنجره"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3">
          {validationError && (
            <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-center justify-between gap-2 animate-in fade-in">
              <div className="flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{validationError}</span>
              </div>
              <button type="button" onClick={() => setValidationError(null)} className="text-rose-500 hover:text-rose-800">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* SECTION 1: SUPPLIER / SERVICE PROVIDER & INVOICE DETAILS */}
          <div
            className={`rounded-xl border p-3 space-y-2.5 transition-colors ${
              isCurrentlyPureService
                ? 'bg-violet-50/40 border-violet-200/80'
                : 'bg-slate-50/90 border-slate-200/90'
            }`}
          >
            <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5 items-start">
              
              {/* Counterparty Selection Column (6 cols) */}
              <div className="md:col-span-6" ref={supplierDropdownRef}>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                    {isCurrentlyPureService ? (
                      <Wrench className="w-3.5 h-3.5 text-violet-600" />
                    ) : (
                      <Building2 className="w-3.5 h-3.5 text-emerald-600" />
                    )}
                    <span>
                      {isCurrentlyPureService
                        ? 'مجری خدمات / طرف حساب (دریافت‌کننده وجه)'
                        : 'تامین‌کننده / فروشنده'}
                    </span>
                    <span className="text-rose-600">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowOptionalDetails(!showOptionalDetails)}
                    className={`text-[11px] font-bold flex items-center gap-0.5 cursor-pointer ${
                      isCurrentlyPureService
                        ? 'text-violet-700 hover:text-violet-900'
                        : 'text-emerald-700 hover:text-emerald-900'
                    }`}
                  >
                    <span>
                      {showOptionalDetails
                        ? 'بستن مشخصات تکمیلی'
                        : `+ مشخصات تکمیلی${supplierPhone || supplierAddress || supplierEconomicCode || dueDate ? ' (ثبت‌شده)' : ''}`}
                    </span>
                    {showOptionalDetails ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>
                </div>

                {supplierName ? (
                  <div
                    className={`h-9 bg-white rounded-xl border px-2.5 flex items-center justify-between gap-2 ${
                      isCurrentlyPureService ? 'border-violet-400' : 'border-emerald-500/50'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <UserCheck
                        className={`w-3.5 h-3.5 shrink-0 ${
                          isCurrentlyPureService ? 'text-violet-600' : 'text-emerald-600'
                        }`}
                      />
                      <span className="font-black text-slate-900 text-xs truncate">
                        {supplierName}
                      </span>
                      {supplierPhone && (
                        <span className="text-[10px] text-slate-400 font-mono hidden sm:inline">
                          ({toPersianDigits(supplierPhone)})
                        </span>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={handleClearSupplier}
                      className="px-2 py-0.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 text-[10px] font-bold transition-all shrink-0 cursor-pointer flex items-center gap-0.5"
                    >
                      <X className="w-3 h-3" />
                      <span>تغییر</span>
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <input
                      type="text"
                      value={supplierSearchInput}
                      onFocus={() => setIsSupplierDropdownOpen(true)}
                      onChange={(e) => {
                        setSupplierSearchInput(e.target.value);
                        setIsSupplierDropdownOpen(true);
                        setValidationError(null);
                      }}
                      placeholder={
                        isCurrentlyPureService
                          ? 'جستجو یا تایپ نام مجری خدمات، تعمیرکار، باربری یا شرکت...'
                          : 'جستجو یا تایپ نام فروشنده...'
                      }
                      className={`w-full h-9 bg-white border border-slate-300 rounded-xl pr-8 pl-7 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 font-medium ${
                        isCurrentlyPureService
                          ? 'focus:ring-violet-500/20 focus:border-violet-500'
                          : 'focus:ring-emerald-500/20 focus:border-emerald-500'
                      }`}
                    />
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    {supplierSearchInput && (
                      <button
                        type="button"
                        onClick={() => setSupplierSearchInput('')}
                        className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}

                    {isSupplierDropdownOpen && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-xl border border-slate-200 max-h-48 overflow-y-auto z-40 p-1 text-xs">
                        {supplierSearchInput.trim() && (
                          <div
                            onClick={() => {
                              setSupplierName(supplierSearchInput.trim());
                              setIsSupplierDropdownOpen(false);
                              setValidationError(null);
                            }}
                            className={`p-2 rounded-lg font-bold flex items-center justify-between cursor-pointer mb-1 border ${
                              isCurrentlyPureService
                                ? 'bg-violet-50 hover:bg-violet-100 text-violet-900 border-violet-200'
                                : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border-emerald-200'
                            }`}
                          >
                            <span className="flex items-center gap-1.5">
                              <PlusCircle
                                className={`w-3.5 h-3.5 ${
                                  isCurrentlyPureService ? 'text-violet-600' : 'text-emerald-600'
                                }`}
                              />
                              <span>انتخاب نام جدید: «{supplierSearchInput.trim()}»</span>
                            </span>
                            <span
                              className={`text-[10px] px-1.5 py-0.5 rounded ${
                                isCurrentlyPureService ? 'bg-violet-200/80' : 'bg-emerald-200/80'
                              }`}
                            >
                              ثبت
                            </span>
                          </div>
                        )}

                        {filteredSuppliers.length === 0 ? (
                          <div className="py-3 text-center text-slate-400 text-[11px]">
                            {isCurrentlyPureService
                              ? 'مجری خدمات یا طرف حسابی یافت نشد. نام دلخواه را تایپ کنید.'
                              : 'تامین‌کننده‌ای یافت نشد. نام دلخواه را تایپ کنید.'}
                          </div>
                        ) : (
                          <div className="space-y-0.5">
                            {filteredSuppliers.map((s, idx) => (
                              <div
                                key={idx}
                                onClick={() => handleSelectSupplier(s)}
                                className="px-2.5 py-1.5 rounded-lg hover:bg-slate-100 flex items-center justify-between transition-colors cursor-pointer"
                              >
                                <span className="font-bold text-slate-800 text-xs truncate">{s.name}</span>
                                {s.phone && (
                                  <span className="text-[10px] text-slate-400 font-mono">
                                    {toPersianDigits(s.phone)}
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Invoice Number Column (3 cols) */}
              <div className="md:col-span-3">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                    <Hash className="w-3.5 h-3.5 text-slate-400" />
                    <span>{isCurrentlyPureService ? 'شماره فاکتور / سند' : 'شماره فاکتور'}</span>
                  </label>
                  <span
                    className={`text-[9px] font-bold px-1.5 rounded border ${
                      isCurrentlyPureService
                        ? 'text-violet-700 bg-violet-50 border-violet-200'
                        : 'text-emerald-700 bg-emerald-50 border-emerald-200'
                    }`}
                  >
                    خودکار
                  </span>
                </div>
                <input
                  type="text"
                  required
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  placeholder="PUR-1002"
                  className="w-full h-9 bg-white border border-slate-300 rounded-xl px-2.5 text-xs font-mono font-black text-slate-800 text-left focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              {/* Invoice Date Column (3 cols) */}
              <div className="md:col-span-3">
                <JalaliDatePicker
                  value={date}
                  onChange={setDate}
                  label={isCurrentlyPureService ? 'تاریخ انجام خدمت / ثبت' : 'تاریخ خرید'}
                  required
                  buttonClassName="!h-9"
                />
              </div>
            </div>

            {/* Optional Supplier / Service Provider Details Collapsible Panel */}
            {showOptionalDetails && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-2.5 border-t border-slate-200/80 text-xs animate-in fade-in">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    {isCurrentlyPureService ? 'تلفن مجری / طرف حساب:' : 'تلفن فروشنده:'}
                  </label>
                  <input
                    type="text"
                    value={supplierPhone}
                    onChange={(e) => setSupplierPhone(e.target.value)}
                    placeholder="۰۲۱-۸۸۲۲۳۳۴۴"
                    className="w-full h-8 bg-white border border-slate-300 rounded-lg px-2.5 font-mono text-xs text-left focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">کد اقتصادی / ملی:</label>
                  <input
                    type="text"
                    value={supplierEconomicCode}
                    onChange={(e) => setSupplierEconomicCode(e.target.value)}
                    placeholder="شناسه ۱۰ یا ۱۱ رقمی"
                    className="w-full h-8 bg-white border border-slate-300 rounded-lg px-2.5 font-mono text-xs text-left focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">سررسید تسویه:</label>
                  <JalaliDatePicker
                    value={dueDate}
                    onChange={setDueDate}
                    placeholder="انتخاب سررسید"
                    buttonClassName="!h-8"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    {isCurrentlyPureService ? 'آدرس / محل انجام خدمت:' : 'آدرس فروشنده:'}
                  </label>
                  <input
                    type="text"
                    value={supplierAddress}
                    onChange={(e) => setSupplierAddress(e.target.value)}
                    placeholder="تهران، خیابان..."
                    className="w-full h-8 bg-white border border-slate-300 rounded-lg px-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>
            )}
          </div>

          {/* SECTION 2: ITEMS TABLE (PRODUCTS & SERVICES) */}
          <div className="bg-white rounded-xl border border-slate-200/90">
            {/* Items Toolbar + Live Search Bar */}
            <div className="bg-slate-50/90 p-2.5 sm:px-3 border-b border-slate-200 rounded-t-xl space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {isCurrentlyPureService ? (
                    <Wrench className="w-4 h-4 text-violet-600" />
                  ) : (
                    <PackagePlus className="w-4 h-4 text-emerald-600" />
                  )}
                  <span className="font-bold text-slate-800 text-xs">
                    {isCurrentlyPureService ? 'شرح خدمات و هزینه‌های فاکتور' : 'اقلام فاکتور خرید (کالا و خدمات)'}
                  </span>
                  <span className="text-[10px] font-mono font-bold bg-white text-slate-600 px-1.5 py-0.5 rounded border border-slate-200">
                    {toPersianDigits(items.length)} ردیف
                  </span>
                  {serviceItemsCount > 0 && !isCurrentlyPureService && (
                    <span className="text-[10px] font-bold bg-violet-100 text-violet-800 px-2 py-0.5 rounded-full border border-violet-200">
                      {toPersianDigits(serviceItemsCount)} ردیف خدمات
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                  {(isCurrentlyPureService || serviceItemsCount > 0) && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsServiceUnitCreatorOpen((prev) => !prev);
                        setTargetRowForNewUnit(null);
                      }}
                      className={`flex items-center gap-1 text-[11px] px-2.5 py-1.5 rounded-lg border font-bold transition-all cursor-pointer active:scale-95 ${
                        isServiceUnitCreatorOpen
                          ? 'bg-violet-100 text-violet-900 border-violet-400 shadow-2xs'
                          : 'bg-violet-50 text-violet-800 hover:bg-violet-100 border-violet-200'
                      }`}
                      title="تعریف و مدیریت واحدهای اندازه‌گیری خدمات (مانند نفر-ساعت، مترمربع، جلسه و...)"
                    >
                      <PlusCircle className="w-3.5 h-3.5 text-violet-600" />
                      <span>تعریف واحد خدمت</span>
                    </button>
                  )}

                  {isCurrentlyPureService ? (
                    <>
                      <button
                        type="button"
                        onClick={() => handleAddServiceItem()}
                        className="flex items-center gap-1 text-[11px] px-3 py-1.5 rounded-lg bg-violet-600 text-white hover:bg-violet-700 font-bold transition-all cursor-pointer active:scale-95 shadow-2xs"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>افزودن ردیف خدمت / هزینه جدید</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleAddItem}
                        className="flex items-center gap-1 text-[11px] px-2.5 py-1.5 rounded-lg bg-white text-slate-700 hover:bg-slate-100 border border-slate-300 font-bold transition-all cursor-pointer active:scale-95"
                        title="در صورتی که همراه با این خدمت، قطعه یا کالایی هم خریداری شده است کلیک کنید"
                      >
                        <ShoppingBag className="w-3.5 h-3.5 text-emerald-600" />
                        <span>+ افزودن کالا / قطعه به این فاکتور</span>
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => setIsQuickProductModalOpen(true)}
                        className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200 font-bold transition-colors cursor-pointer"
                      >
                        <PlusCircle className="w-3.5 h-3.5 text-emerald-600" />
                        <span>تعریف کالای جدید</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleAddServiceItem()}
                        className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-lg bg-violet-600 text-white hover:bg-violet-700 font-bold transition-all cursor-pointer active:scale-95 shadow-2xs"
                      >
                        <Wrench className="w-3.5 h-3.5" />
                        <span>+ افزودن خرید خدمات / هزینه</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleAddItem}
                        className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-lg bg-slate-900 text-white hover:bg-slate-800 font-bold transition-all cursor-pointer active:scale-95"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>+ افزودن ردیف کالا</span>
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Inline Service Unit Creator Bar */}
              {isServiceUnitCreatorOpen && (
                <div className="p-2.5 rounded-xl bg-violet-50/90 border border-violet-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 animate-in fade-in duration-150">
                  <div className="flex items-center gap-2 flex-wrap flex-1">
                    <span className="text-[11px] font-black text-violet-900 flex items-center gap-1 shrink-0">
                      <PlusCircle className="w-3.5 h-3.5 text-violet-600" />
                      <span>
                        {targetRowForNewUnit !== null
                          ? `تعریف واحد خدمت جدید (برای ردیف ${toPersianDigits(targetRowForNewUnit + 1)}):`
                          : 'تعریف واحد خدمت جدید:'}
                      </span>
                    </span>
                    <input
                      type="text"
                      autoFocus
                      value={newServiceUnitName}
                      onChange={(e) => setNewServiceUnitName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddCustomServiceUnit();
                        }
                      }}
                      placeholder="نام واحد (مثلاً: نفر-ساعت، مترمربع، جلسه، نوبت، کورس...)"
                      className="flex-1 min-w-[200px] max-w-xs h-8 px-2.5 rounded-lg border border-violet-300 bg-white text-xs font-bold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
                    />
                    <button
                      type="button"
                      onClick={handleAddCustomServiceUnit}
                      disabled={!newServiceUnitName.trim()}
                      className="h-8 px-3 rounded-lg bg-violet-600 hover:bg-violet-700 disabled:bg-violet-300 text-white text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer shrink-0"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>ثبت واحد</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsServiceUnitCreatorOpen(false);
                        setNewServiceUnitName('');
                        setTargetRowForNewUnit(null);
                      }}
                      className="h-8 px-2 rounded-lg bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 text-[11px] font-bold transition-colors cursor-pointer shrink-0"
                    >
                      بستن
                    </button>
                  </div>

                  {/* Display custom defined units with ability to remove */}
                  {serviceUnits.some((u) => !DEFAULT_SERVICE_UNITS.includes(u)) && (
                    <div className="flex items-center gap-1 flex-wrap pt-1.5 sm:pt-0 border-t sm:border-t-0 border-violet-200/70">
                      <span className="text-[10px] font-bold text-violet-700">واحدهای سفارشی:</span>
                      {serviceUnits
                        .filter((u) => !DEFAULT_SERVICE_UNITS.includes(u))
                        .map((customUnit) => (
                          <span
                            key={customUnit}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white border border-violet-200 text-violet-900 text-[10px] font-bold"
                          >
                            <span>{customUnit}</span>
                            <button
                              type="button"
                              onClick={() => handleRemoveCustomServiceUnit(customUnit)}
                              className="text-slate-400 hover:text-rose-600 cursor-pointer"
                              title="حذف این واحد سفارشی"
                            >
                              <X className="w-2.5 h-2.5" />
                            </button>
                          </span>
                        ))}
                    </div>
                  )}
                </div>
              )}

              {/* Live Product Search & Instant Add Bar (shown when not pure service) */}
              {!isCurrentlyPureService && (
                <div className="relative" ref={quickItemSearchRef}>
                  <div className="relative flex items-center">
                    <Search className="w-4 h-4 text-emerald-600 absolute right-3 pointer-events-none" />
                    <input
                      type="text"
                      value={quickItemSearch}
                      onFocus={() => setIsQuickItemDropdownOpen(true)}
                      onChange={(e) => {
                        setQuickItemSearch(e.target.value);
                        setIsQuickItemDropdownOpen(true);
                      }}
                      placeholder="جستجوی زنده کالا (نام، کد یا دسته‌بندی) برای افزودن سریع به فاکتور..."
                      className="w-full h-9 pr-9 pl-8 rounded-xl border border-emerald-300 bg-white text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 shadow-2xs"
                    />
                    {quickItemSearch && (
                      <button
                        type="button"
                        onClick={() => {
                          setQuickItemSearch('');
                          setIsQuickItemDropdownOpen(false);
                        }}
                        className="absolute left-2.5 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {isQuickItemDropdownOpen && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-2xl border border-slate-200 max-h-60 overflow-y-auto z-50 p-1.5 text-xs animate-in fade-in duration-100">
                      {quickItemSearch.trim() && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 mb-1">
                          <button
                            type="button"
                            onClick={() => {
                              setNewProductName(quickItemSearch.trim());
                              setIsQuickItemDropdownOpen(false);
                              setQuickItemSearch('');
                              setIsQuickProductModalOpen(true);
                            }}
                            className="w-full p-2 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-900 font-bold flex items-center justify-between border border-emerald-200 cursor-pointer transition-colors"
                          >
                            <span className="flex items-center gap-1.5 truncate">
                              <PlusCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                              <span className="truncate">تعریف کالای جدید: «{quickItemSearch.trim()}»</span>
                            </span>
                            <span className="text-[10px] bg-emerald-200/80 px-1.5 py-0.5 rounded shrink-0">کالا</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              handleAddServiceItem(quickItemSearch.trim(), 'سرویس');
                              setIsQuickItemDropdownOpen(false);
                              setQuickItemSearch('');
                            }}
                            className="w-full p-2 rounded-lg bg-violet-50 hover:bg-violet-100 text-violet-900 font-bold flex items-center justify-between border border-violet-200 cursor-pointer transition-colors"
                          >
                            <span className="flex items-center gap-1.5 truncate">
                              <Wrench className="w-3.5 h-3.5 text-violet-600 shrink-0" />
                              <span className="truncate">ثبت به عنوان خدمت: «{quickItemSearch.trim()}»</span>
                            </span>
                            <span className="text-[10px] bg-violet-200/80 px-1.5 py-0.5 rounded shrink-0">خدمات</span>
                          </button>
                        </div>
                      )}

                      {filteredQuickProducts.length === 0 ? (
                        <div className="py-4 text-center text-slate-400 text-[11px]">
                          کالایی با این مشخصات یافت نشد. می‌توانید آن را به عنوان کالای جدید یا خدمت ثبت کنید.
                        </div>
                      ) : (
                        <div className="space-y-0.5">
                          {filteredQuickProducts.map((p) => {
                            const inInvoiceItem = items.find((it) => !it.isService && it.productId === p.id);
                            return (
                              <button
                                key={p.id}
                                type="button"
                                onClick={() => handleQuickAddProductFromSearch(p)}
                                className="w-full px-2.5 py-2 rounded-lg hover:bg-emerald-50/80 flex items-center justify-between gap-2 text-right transition-colors cursor-pointer group border border-transparent hover:border-emerald-200/70"
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200 shrink-0">
                                    کد {toPersianDigits(p.code)}
                                  </span>
                                  <span className="font-bold text-slate-900 truncate group-hover:text-emerald-900">
                                    {p.name}
                                  </span>
                                  {inInvoiceItem && (
                                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 shrink-0">
                                      در فاکتور ({toPersianDigits(inInvoiceItem.quantity)} {p.unit})
                                    </span>
                                  )}
                                </div>

                                <div className="flex items-center gap-3 shrink-0 text-[11px]">
                                  <span className="text-slate-500">
                                    موجودی: <strong className="font-mono text-slate-800">{toPersianDigits(p.stock)}</strong> {p.unit}
                                  </span>
                                  <span className="font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200/60">
                                    خرید: {toPersianDigits(formatPrice(p.purchasePrice || p.buyPrice || 0))} ت
                                  </span>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block">
              <table className="w-full text-right text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100/70 text-slate-600 border-b border-slate-200 font-bold text-[11px]">
                    <th className="py-2 px-2 text-center w-9">#</th>
                    <th className="py-2 px-2 text-center w-24">نوع ردیف</th>
                    <th className="py-2 px-2 min-w-[240px]">
                      {isCurrentlyPureService ? 'شرح خدمات / عنوان هزینه' : 'انتخاب کالا / شرح خدمات و هزینه'}
                    </th>
                    <th className="py-2 px-2 text-center w-20">تعداد / مقدار</th>
                    <th className="py-2 px-2 text-center w-22">
                      {isCurrentlyPureService ? 'واحد خدمت' : 'واحد'}
                    </th>
                    <th className="py-2 px-2 text-center w-36">
                      {isCurrentlyPureService ? 'مبلغ واحد / اجرت (تومان)' : 'قیمت واحد / هزینه (تومان)'}
                    </th>
                    <th className="py-2 px-2 text-center w-32">جمع ردیف</th>
                    <th className="py-2 px-2 text-center w-9">{items.length <= 1 ? 'پاک' : 'حذف'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((item, index) => {
                    const rowIsService = Boolean(
                      item.isService || item.itemType === 'service' || isServiceItem(item, allAvailableProducts)
                    );
                    const selectedProd = !rowIsService
                      ? allAvailableProducts.find((p) => p.id === item.productId)
                      : undefined;
                    const isRowOpen = activeRowDropdownIndex === index;

                    return (
                      <tr
                        key={item.id}
                        className={
                          rowIsService
                            ? 'bg-violet-50/35 hover:bg-violet-50/60'
                            : index % 2 === 1
                            ? 'bg-slate-50/40'
                            : 'bg-white'
                        }
                      >
                        <td className="p-1.5 text-center font-mono text-slate-400 font-bold text-[11px]">
                          {toPersianDigits(index + 1)}
                        </td>
                        <td className="p-1.5 text-center">
                          <div className="inline-flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-[10px] font-bold">
                            <button
                              type="button"
                              onClick={() => handleToggleRowType(index, 'product')}
                              className={`px-1.5 py-0.5 rounded-md transition-all cursor-pointer ${
                                !rowIsService
                                  ? 'bg-emerald-600 text-white shadow-2xs'
                                  : 'text-slate-500 hover:text-slate-800'
                              }`}
                            >
                              کالا
                            </button>
                            <button
                              type="button"
                              onClick={() => handleToggleRowType(index, 'service')}
                              className={`px-1.5 py-0.5 rounded-md transition-all cursor-pointer ${
                                rowIsService
                                  ? 'bg-violet-600 text-white shadow-2xs'
                                  : 'text-slate-500 hover:text-slate-800'
                              }`}
                            >
                              خدمات
                            </button>
                          </div>
                        </td>
                        <td className="p-1.5 relative">
                          {rowIsService ? (
                            <div className="flex items-center gap-1.5">
                              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-violet-100 text-violet-800 border border-violet-200 text-[10px] font-bold shrink-0">
                                <Wrench className="w-3 h-3 text-violet-600" />
                                <span>خدمت</span>
                              </span>
                              <input
                                type="text"
                                value={item.productName}
                                onChange={(e) => {
                                  handleItemChange(index, 'productName', e.target.value);
                                  setValidationError(null);
                                }}
                                placeholder="شرح خدمت یا هزینه (مثلاً: تعمیر دستگاه، حمل و نقل، خدمات فنی...)"
                                className="w-full px-2.5 py-1.5 rounded-lg border border-violet-300 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 bg-white font-bold text-slate-900 text-xs outline-none"
                              />
                            </div>
                          ) : (
                            <div className="relative" ref={isRowOpen ? rowDropdownRef : undefined}>
                              <button
                                type="button"
                                onClick={() => {
                                  if (isRowOpen) {
                                    setActiveRowDropdownIndex(null);
                                  } else {
                                    setActiveRowDropdownIndex(index);
                                    setRowSearchQuery('');
                                  }
                                }}
                                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 hover:border-emerald-500 bg-white font-bold text-slate-800 text-xs flex items-center justify-between gap-2 transition-colors cursor-pointer text-right"
                              >
                                <div className="flex items-center gap-1.5 min-w-0 truncate">
                                  <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                  {selectedProd ? (
                                    <span className="truncate">
                                      {selectedProd.name}{' '}
                                      <span className="text-[10px] font-mono text-slate-500 font-normal">
                                        (کد: {toPersianDigits(selectedProd.code)} | موجودی: {toPersianDigits(selectedProd.stock)})
                                      </span>
                                    </span>
                                  ) : (
                                    <span className="text-slate-400 font-normal">-- جستجو و انتخاب کالا --</span>
                                  )}
                                </div>
                                <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              </button>

                              {isRowOpen && (
                                <div className="absolute top-full right-0 left-0 mt-1 bg-white rounded-xl shadow-2xl border border-slate-200 z-50 p-1.5 min-w-[300px] animate-in fade-in duration-100">
                                  <div className="relative mb-1.5">
                                    <Search className="w-3.5 h-3.5 text-emerald-600 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                                    <input
                                      type="text"
                                      autoFocus
                                      value={rowSearchQuery}
                                      onChange={(e) => setRowSearchQuery(e.target.value)}
                                      placeholder="تایپ نام یا کد کالا..."
                                      className="w-full h-8 pr-8 pl-7 rounded-lg border border-emerald-400 bg-slate-50 focus:bg-white text-xs text-slate-800 focus:outline-none"
                                    />
                                    {rowSearchQuery && (
                                      <button
                                        type="button"
                                        onClick={() => setRowSearchQuery('')}
                                        className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                      >
                                        <X className="w-3 h-3" />
                                      </button>
                                    )}
                                  </div>

                                  <div className="max-h-48 overflow-y-auto space-y-0.5">
                                    {filteredRowProducts.length === 0 ? (
                                      <div className="py-3 text-center text-slate-400 text-[11px]">
                                        کالایی یافت نشد
                                      </div>
                                    ) : (
                                      filteredRowProducts.map((p) => (
                                        <button
                                          key={p.id}
                                          type="button"
                                          onClick={() => handleProductSelect(index, p.id)}
                                          className={`w-full px-2.5 py-1.5 rounded-lg flex items-center justify-between gap-2 text-right text-xs transition-colors cursor-pointer ${
                                            p.id === item.productId
                                              ? 'bg-emerald-50 text-emerald-900 font-black border border-emerald-200'
                                              : 'hover:bg-slate-100 text-slate-800 font-bold'
                                          }`}
                                        >
                                          <span className="truncate">
                                            {p.name}{' '}
                                            <span className="text-[10px] font-mono text-slate-400 font-normal">
                                              (کد {toPersianDigits(p.code)})
                                            </span>
                                          </span>
                                          <span className="text-[10px] font-mono text-slate-500 shrink-0">
                                            موجودی: {toPersianDigits(p.stock)} {p.unit}
                                          </span>
                                        </button>
                                      ))
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="p-1.5">
                          <NumericInput
                            min={1}
                            value={item.quantity}
                            onChange={(num) => handleItemChange(index, 'quantity', num || 1)}
                            textAlign="center"
                            className="w-full px-2 py-1 text-center font-mono font-black text-slate-900 rounded-lg border border-slate-300 text-xs focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
                          />
                        </td>
                        <td className="p-1.5 text-center">
                          {rowIsService ? (
                            <select
                              value={item.unit || 'سرویس'}
                              onChange={(e) => {
                                if (e.target.value === '__custom__') {
                                  setTargetRowForNewUnit(index);
                                  setIsServiceUnitCreatorOpen(true);
                                } else {
                                  handleItemChange(index, 'unit', e.target.value);
                                }
                              }}
                              className="w-full px-1 py-1 rounded-lg border border-violet-200 bg-white text-violet-900 font-bold text-[10px] focus:outline-none focus:border-violet-500 cursor-pointer"
                            >
                              {Array.from(new Set([...serviceUnits, item.unit || 'سرویس'])).map((u) => (
                                <option key={u} value={u}>
                                  {u}
                                </option>
                              ))}
                              <option value="__custom__" className="font-black text-violet-700">
                                + تعریف واحد جدید...
                              </option>
                            </select>
                          ) : (
                            <span className="text-slate-600 font-medium bg-slate-100 px-1.5 py-0.5 rounded text-[10px]">
                              {item.unit || 'عدد'}
                            </span>
                          )}
                        </td>
                        <td className="p-1.5">
                          <NumericInput
                            min={0}
                            value={item.buyPrice}
                            onChange={(num) => {
                              handleItemChange(index, 'buyPrice', num);
                              setValidationError(null);
                            }}
                            textAlign="center"
                            className={`w-full px-2 py-1 text-center font-mono font-bold rounded-lg border text-xs outline-none ${
                              rowIsService
                                ? 'border-violet-300 text-violet-900 focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 bg-white'
                                : 'border-slate-300 text-slate-800 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500'
                            }`}
                          />
                        </td>
                        <td className={`p-1.5 text-center font-mono font-black text-xs ${rowIsService ? 'text-violet-900' : 'text-emerald-900'}`}>
                          {toPersianDigits(formatPrice(item.total, ''))}
                        </td>
                        <td className="p-1.5 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(index)}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                            title={items.length <= 1 ? 'پاک کردن مقادیر این ردیف' : 'حذف ردیف'}
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

            {/* Mobile Cards View */}
            <div className="md:hidden p-2.5 space-y-2">
              {items.map((item, index) => {
                const rowIsService = Boolean(
                  item.isService || item.itemType === 'service' || isServiceItem(item, allAvailableProducts)
                );
                const selectedProd = !rowIsService
                  ? allAvailableProducts.find((p) => p.id === item.productId)
                  : undefined;
                const isRowOpen = activeRowDropdownIndex === index;

                return (
                  <div
                    key={item.id}
                    className={`p-2.5 rounded-xl border space-y-2 ${
                      rowIsService
                        ? 'bg-violet-50/50 border-violet-200'
                        : 'bg-slate-50/80 border-slate-200/90'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`w-5 h-5 rounded-md text-white font-mono font-bold text-[11px] flex items-center justify-center shrink-0 ${
                            rowIsService ? 'bg-violet-600' : 'bg-emerald-600'
                          }`}
                        >
                          {toPersianDigits(index + 1)}
                        </span>
                        <div className="inline-flex items-center bg-white p-0.5 rounded-lg border border-slate-200 text-[10px] font-bold">
                          <button
                            type="button"
                            onClick={() => handleToggleRowType(index, 'product')}
                            className={`px-2 py-0.5 rounded-md ${
                              !rowIsService ? 'bg-emerald-600 text-white' : 'text-slate-500'
                            }`}
                          >
                            کالا
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleRowType(index, 'service')}
                            className={`px-2 py-0.5 rounded-md ${
                              rowIsService ? 'bg-violet-600 text-white' : 'text-slate-500'
                            }`}
                          >
                            خدمات
                          </button>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(index)}
                        className="p-1 text-slate-400 hover:text-rose-600"
                        title={items.length <= 1 ? 'پاک کردن ردیف' : 'حذف ردیف'}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {rowIsService ? (
                      <div className="grid grid-cols-12 gap-1.5">
                        <div className="col-span-8">
                          <input
                            type="text"
                            value={item.productName}
                            onChange={(e) => {
                              handleItemChange(index, 'productName', e.target.value);
                              setValidationError(null);
                            }}
                            placeholder="شرح خدمات / هزینه (مثلاً: تعمیر دستگاه...)"
                            className="w-full px-2.5 py-1.5 rounded-lg border border-violet-300 bg-white font-bold text-slate-900 text-xs"
                          />
                        </div>
                        <div className="col-span-4">
                          <select
                            value={item.unit || 'سرویس'}
                            onChange={(e) => {
                              if (e.target.value === '__custom__') {
                                setTargetRowForNewUnit(index);
                                setIsServiceUnitCreatorOpen(true);
                              } else {
                                handleItemChange(index, 'unit', e.target.value);
                              }
                            }}
                            className="w-full h-full px-1.5 py-1.5 rounded-lg border border-violet-200 bg-white text-violet-900 font-bold text-[11px]"
                          >
                            {Array.from(new Set([...serviceUnits, item.unit || 'سرویس'])).map((u) => (
                              <option key={u} value={u}>
                                واحد: {u}
                              </option>
                            ))}
                            <option value="__custom__" className="font-black text-violet-700">
                              + تعریف واحد جدید...
                            </option>
                          </select>
                        </div>
                      </div>
                    ) : (
                      <div className="relative" ref={isRowOpen ? rowDropdownRef : undefined}>
                        <button
                          type="button"
                          onClick={() => {
                            if (isRowOpen) {
                              setActiveRowDropdownIndex(null);
                            } else {
                              setActiveRowDropdownIndex(index);
                              setRowSearchQuery('');
                            }
                          }}
                          className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-bold text-slate-800 text-xs flex items-center justify-between gap-1 text-right"
                        >
                          <span className="truncate">
                            {selectedProd
                              ? `${selectedProd.name} (موجودی: ${toPersianDigits(selectedProd.stock)})`
                              : '-- جستجو و انتخاب کالا --'}
                          </span>
                          <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        </button>

                        {isRowOpen && (
                          <div className="absolute top-full right-0 left-0 mt-1 bg-white rounded-xl shadow-2xl border border-slate-200 z-50 p-1.5">
                            <input
                              type="text"
                              autoFocus
                              value={rowSearchQuery}
                              onChange={(e) => setRowSearchQuery(e.target.value)}
                              placeholder="جستجوی نام یا کد کالا..."
                              className="w-full h-8 px-2.5 mb-1.5 rounded-lg border border-emerald-400 bg-slate-50 text-xs"
                            />
                            <div className="max-h-44 overflow-y-auto space-y-0.5">
                              {filteredRowProducts.map((p) => (
                                <button
                                  key={p.id}
                                  type="button"
                                  onClick={() => handleProductSelect(index, p.id)}
                                  className="w-full px-2 py-1.5 rounded-lg hover:bg-slate-100 flex items-center justify-between text-right text-xs font-bold"
                                >
                                  <span className="truncate">{p.name}</span>
                                  <span className="text-[10px] font-mono text-slate-500">
                                    موجودی: {toPersianDigits(p.stock)}
                                  </span>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <span className="text-[10px] text-slate-500 block mb-0.5">
                          تعداد ({item.unit || (rowIsService ? 'سرویس' : 'عدد')}):
                        </span>
                        <NumericInput
                          min={1}
                          value={item.quantity}
                          onChange={(num) => handleItemChange(index, 'quantity', num || 1)}
                          textAlign="center"
                          className="w-full p-1 text-center font-mono font-black text-xs rounded-lg border border-slate-300 bg-white"
                        />
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 block mb-0.5">
                          {rowIsService ? 'هزینه واحد:' : 'قیمت خرید:'}
                        </span>
                        <NumericInput
                          min={0}
                          value={item.buyPrice}
                          onChange={(num) => {
                            handleItemChange(index, 'buyPrice', num);
                            setValidationError(null);
                          }}
                          textAlign="center"
                          className="w-full p-1 text-center font-mono font-bold text-xs rounded-lg border border-slate-300 bg-white"
                        />
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 block mb-0.5">جمع ردیف:</span>
                        <div className="p-1 text-center font-mono font-black text-emerald-900 bg-emerald-50 rounded-lg border border-emerald-200 text-xs">
                          {toPersianDigits(formatPrice(item.total, ''))}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* SECTION 3: PAYMENT & FINANCIAL TOTALS (COMPACT & UNIFIED) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
            
            {/* Payment Configuration (7 cols) */}
            <div className="lg:col-span-7 bg-slate-50/90 rounded-xl border border-slate-200/90 p-3 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <CreditCard className="w-3.5 h-3.5 text-blue-600" />
                  <span>
                    {isCurrentlyPureService
                      ? 'وضعیت و روش پرداخت هزینه خدمات'
                      : 'وضعیت و روش تسویه فاکتور خرید'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowNotesField(!showNotesField)}
                  className="text-[11px] font-bold text-slate-500 hover:text-slate-800 flex items-center gap-1 cursor-pointer"
                >
                  <FileText className="w-3 h-3" />
                  <span>{showNotesField ? 'بستن یادداشت' : `+ افزودن یادداشت${notes.trim() ? ' (دارای متن)' : ''}`}</span>
                </button>
              </div>

              {/* Status Segmented Pills */}
              <div className="grid grid-cols-3 gap-1 bg-slate-200/70 p-1 rounded-xl text-xs font-bold">
                <button
                  type="button"
                  onClick={() => handlePaymentStatusChange('paid')}
                  className={`py-1.5 rounded-lg transition-all cursor-pointer ${
                    paymentStatus === 'paid'
                      ? 'bg-emerald-600 text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  تسویه کامل (پرداخت‌شده)
                </button>
                <button
                  type="button"
                  onClick={() => handlePaymentStatusChange('partial')}
                  className={`py-1.5 rounded-lg transition-all cursor-pointer ${
                    paymentStatus === 'partial'
                      ? 'bg-amber-600 text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  بیعانه / بخشی
                </button>
                <button
                  type="button"
                  onClick={() => handlePaymentStatusChange('unpaid')}
                  className={`py-1.5 rounded-lg transition-all cursor-pointer ${
                    paymentStatus === 'unpaid'
                      ? 'bg-rose-600 text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  نسیه / طلبکار از ما
                </button>
              </div>

              {/* Method Selector (Shown when paid or partial) */}
              {paymentStatus !== 'unpaid' && (
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-slate-600 font-bold shrink-0 text-[11px]">روش پرداخت:</span>
                  <div className="flex-1 grid grid-cols-4 gap-1 bg-white p-0.5 rounded-lg border border-slate-200 text-[11px] font-bold">
                    {[
                      { id: 'transfer', label: 'کارت/شبا' },
                      { id: 'pos', label: 'کارتخوان' },
                      { id: 'cash', label: 'نقدی' },
                      { id: 'cheque', label: 'چک بانکی' },
                    ].map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setPaymentMethod(m.id as PaymentMethod)}
                        className={`py-1 rounded-md transition-all cursor-pointer ${
                          paymentMethod === m.id
                            ? 'bg-slate-900 text-white'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Conditional Partial Amount + Remaining Balance */}
              {paymentStatus === 'partial' && (
                <div className="p-2.5 bg-amber-50 rounded-xl border border-amber-200 text-xs space-y-2">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="font-bold text-amber-900">مبلغ پرداختی فعلی (تومان):</span>
                    <NumericInput
                      min={0}
                      max={finalTotal}
                      value={paidAmount}
                      onChange={(num) => {
                        setPaidAmount(num);
                        setValidationError(null);
                      }}
                      textAlign="center"
                      className="w-40 p-1.5 font-mono font-black rounded-lg border border-amber-300 bg-white text-xs text-amber-950"
                    />
                  </div>
                  <div className="flex items-center justify-between pt-1.5 border-t border-amber-200/70 text-[11px]">
                    <span className="text-amber-800 font-medium">مانده بدهی به طرف حساب:</span>
                    <span className="font-mono font-black text-rose-700">
                      {toPersianDigits(formatPrice(Math.max(0, finalTotal - paidAmount)))} تومان
                    </span>
                  </div>
                </div>
              )}

              {/* Due Date selector right inside payment box when Unpaid or Partial */}
              {(paymentStatus === 'unpaid' || paymentStatus === 'partial') && (
                <div className="grid grid-cols-1 sm:grid-cols-12 items-center gap-2 p-2 rounded-xl bg-rose-50/60 border border-rose-200/80 text-xs">
                  <div className="sm:col-span-6 flex items-center gap-1.5 font-bold text-rose-900">
                    <Calendar className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                    <span>تاریخ سررسید تسویه بدهی (اختیاری):</span>
                  </div>
                  <div className="sm:col-span-6">
                    <JalaliDatePicker
                      value={dueDate}
                      onChange={setDueDate}
                      placeholder="انتخاب تاریخ سررسید پرداخت..."
                      buttonClassName="!h-8 !bg-white"
                    />
                  </div>
                </div>
              )}

              {/* Payment Tracking / Reference Description (when paid or partial with transfer/pos/cash) */}
              {paymentStatus !== 'unpaid' && paymentMethod !== 'cheque' && (
                <div>
                  <input
                    type="text"
                    value={transferDescription}
                    onChange={(e) => setTransferDescription(e.target.value)}
                    placeholder="شماره پیگیری پرداخت، چهار رقم کارت، نام بانک یا توضیحات پرداخت هزینه..."
                    className="w-full h-8 bg-white border border-slate-300 rounded-lg px-2.5 text-xs placeholder:text-slate-400 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              )}

              {/* Conditional Cheque Details */}
              {paymentStatus !== 'unpaid' && paymentMethod === 'cheque' && (
                <div className="p-2 bg-amber-50 rounded-lg border border-amber-200 text-xs grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <input
                    type="text"
                    placeholder="شماره صیاد / چک"
                    value={chequeNumber}
                    onChange={(e) => setChequeNumber(e.target.value)}
                    className="h-8 px-2.5 rounded-lg border border-amber-300 bg-white font-mono text-xs text-left focus:outline-none focus:border-amber-500"
                  />
                  <input
                    type="text"
                    placeholder="بانک / صاحب حساب چک"
                    value={chequeName}
                    onChange={(e) => setChequeName(e.target.value)}
                    className="h-8 px-2.5 rounded-lg border border-amber-300 bg-white text-xs focus:outline-none focus:border-amber-500"
                  />
                  <div className="relative flex items-center">
                    <button
                      type="button"
                      onClick={openChequeDateModal}
                      className="w-full h-8 px-2.5 rounded-lg border border-amber-300 bg-white hover:bg-amber-50/60 transition-colors flex items-center justify-between gap-1.5 text-xs cursor-pointer"
                      title="انتخاب تاریخ سررسید چک"
                    >
                      <span className="flex items-center gap-1.5 text-amber-800 font-bold truncate">
                        <Calendar className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        {chequeDueDate ? (
                          <span className="font-mono font-black text-slate-900" dir="ltr">
                            {toPersianDigits(chequeDueDate)}
                          </span>
                        ) : (
                          <span className="text-slate-400 font-medium text-[11px]">
                            سررسید چک
                          </span>
                        )}
                      </span>
                      <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded shrink-0">
                        تقویم
                      </span>
                    </button>
                    {chequeDueDate && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setChequeDueDate('');
                        }}
                        className="mr-1 p-1 text-slate-400 hover:text-rose-600 rounded-md transition-colors cursor-pointer"
                        title="پاک کردن تاریخ چک"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Collapsible Notes */}
              {showNotesField && (
                <div>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder={
                      isCurrentlyPureService
                        ? 'یادداشت، شماره فاکتور مجری خدمات، شرح تکمیلی هزینه یا شرایط گارانتی تعمیر...'
                        : 'یادداشت، شماره بارنامه، شرح تکمیلی خدمات یا شرایط گارانتی...'
                    }
                    className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs placeholder:text-slate-400 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              )}
            </div>

            {/* Calculations & Totals (5 cols) */}
            <div className="lg:col-span-5 bg-slate-50/90 rounded-xl border border-slate-200/90 p-3 space-y-2 text-xs flex flex-col justify-between">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-slate-700">
                  <span>
                    {isCurrentlyPureService
                      ? `جمع خدمات (${toPersianDigits(items.length)} ردیف):`
                      : `جمع اقلام (${toPersianDigits(items.length)} ردیف):`}
                  </span>
                  <span className="font-mono font-bold text-slate-900">
                    {toPersianDigits(formatPrice(subtotal))} تومان
                  </span>
                </div>

                {!showExtraFinancials && (overallDiscount > 0 || shippingCost > 0) && (
                  <div className="space-y-1 text-[11px] pt-1 border-t border-slate-200/60">
                    {overallDiscount > 0 && (
                      <div className="flex items-center justify-between text-rose-600">
                        <span>تخفیف کلی:</span>
                        <span className="font-mono font-bold">-{toPersianDigits(formatPrice(overallDiscount))} تومان</span>
                      </div>
                    )}
                    {shippingCost > 0 && (
                      <div className="flex items-center justify-between text-slate-600">
                        <span>{isCurrentlyPureService ? 'هزینه ایاب و ذهاب / جانبی:' : 'کرایه حمل:'}</span>
                        <span className="font-mono font-bold">+{toPersianDigits(formatPrice(shippingCost))} تومان</span>
                      </div>
                    )}
                  </div>
                )}

                <div className="pt-1 border-t border-slate-200/80">
                  <button
                    type="button"
                    onClick={() => setShowExtraFinancials(!showExtraFinancials)}
                    className={`text-[11px] font-bold flex items-center gap-0.5 cursor-pointer ${
                      isCurrentlyPureService
                        ? 'text-violet-700 hover:text-violet-900'
                        : 'text-emerald-700 hover:text-emerald-900'
                    }`}
                  >
                    <span>
                      {showExtraFinancials
                        ? 'بستن تخفیف و هزینه جانبی'
                        : isCurrentlyPureService
                        ? `+ افزودن تخفیف یا هزینه ایاب و ذهاب${overallDiscount > 0 || shippingCost > 0 ? ' (دارای مقدار)' : ''}`
                        : `+ افزودن تخفیف یا کرایه حمل${overallDiscount > 0 || shippingCost > 0 ? ' (دارای مقدار)' : ''}`}
                    </span>
                    {showExtraFinancials ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>

                  {showExtraFinancials && (
                    <div className="space-y-1.5 pt-2 animate-in fade-in">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-600 text-[11px]">تخفیف کلی (تومان):</span>
                        <NumericInput
                          min={0}
                          value={overallDiscount}
                          onChange={(num) => setOverallDiscount(num)}
                          textAlign="center"
                          className="w-28 px-2 py-1 rounded-lg border border-slate-300 bg-white font-mono font-bold text-rose-600 text-xs"
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-slate-600 text-[11px]">
                          {isCurrentlyPureService ? 'ایاب و ذهاب / حمل (تومان):' : 'کرایه حمل (تومان):'}
                        </span>
                        <NumericInput
                          min={0}
                          value={shippingCost}
                          onChange={(num) => setShippingCost(num)}
                          textAlign="center"
                          className="w-28 px-2 py-1 rounded-lg border border-slate-300 bg-white font-mono font-medium text-slate-800 text-xs"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-1.5 pt-1">
                {/* Payment vs Remaining Balance Summary Strip */}
                {finalTotal > 0 && (
                  <div
                    className={`px-2.5 py-1.5 rounded-lg border text-[11px] flex items-center justify-between ${
                      paymentStatus === 'paid'
                        ? 'bg-emerald-50/80 border-emerald-200 text-emerald-800'
                        : paymentStatus === 'partial'
                        ? 'bg-amber-50/80 border-amber-200 text-amber-900'
                        : 'bg-rose-50/80 border-rose-200 text-rose-800'
                    }`}
                  >
                    <span className="font-bold">
                      {paymentStatus === 'paid'
                        ? 'وضعیت: تسویه کامل'
                        : paymentStatus === 'partial'
                        ? `پرداختی: ${toPersianDigits(formatPrice(paidAmount))} ت`
                        : 'وضعیت: نسیه (بدهکار به طرف حساب)'}
                    </span>
                    <span className="font-mono font-black">
                      {paymentStatus === 'paid'
                        ? 'مانده: ۰ تومان'
                        : `مانده بدهی: ${toPersianDigits(
                            formatPrice(paymentStatus === 'unpaid' ? finalTotal : Math.max(0, finalTotal - paidAmount))
                          )} ت`}
                    </span>
                  </div>
                )}

                {/* Final Total Box */}
                <div
                  className={`text-white rounded-xl px-3 py-2.5 flex items-center justify-between shadow-2xs ${
                    isCurrentlyPureService ? 'bg-violet-600' : 'bg-emerald-600'
                  }`}
                >
                  <span className="font-bold text-xs">
                    {isCurrentlyPureService ? 'مبلغ نهایی هزینه خدمات:' : 'مبلغ نهایی فاکتور:'}
                  </span>
                  <span className="font-black font-mono text-sm sm:text-base">
                    {toPersianDigits(formatPrice(finalTotal))} تومان
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Modal Action Buttons */}
          <div className="flex items-center justify-between gap-2 pt-2.5 border-t border-slate-200">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-bold text-xs transition-colors cursor-pointer"
              >
                انصراف
              </button>
              {settings?.telegramBotEnabled && (
                <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-sky-50 border border-sky-200 text-sky-800 text-[10px] font-bold">
                  <Send className="w-3 h-3 text-[#229ED9]" />
                  <span>ارسال خودکار به تلگرام فعال</span>
                </span>
              )}
            </div>

            <button
              type="submit"
              id="submit-purchase-invoice-btn"
              className={`flex items-center justify-center gap-1.5 px-5 py-2 rounded-xl active:scale-98 text-white font-black text-xs sm:text-sm shadow-sm transition-all cursor-pointer ${
                isCurrentlyPureService
                  ? 'bg-violet-600 hover:bg-violet-700'
                  : 'bg-emerald-600 hover:bg-emerald-700'
              }`}
            >
              <Check className="w-4 h-4 stroke-[2.5]" />
              <span>
                {isEditing
                  ? isCurrentlyPureService
                    ? 'ذخیره تغییرات فاکتور خدمات و هزینه'
                    : 'ذخیره تغییرات فاکتور خرید'
                  : isCurrentlyPureService
                  ? 'ثبت نهایی خرید خدمات و پرداخت هزینه'
                  : serviceItemsCount > 0
                  ? 'ثبت فاکتور خرید (کالا و خدمات) و صدور حواله انبار'
                  : 'ثبت فاکتور خرید و صدور حواله انبار'}
              </span>
            </button>
          </div>
        </form>

        {/* Quick Product Creation Modal */}
        {isQuickProductModalOpen && (
          <div className="fixed inset-0 z-60 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-md rounded-2xl shadow-xl p-4 border border-slate-200 animate-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between pb-2.5 border-b border-slate-200 mb-3">
                <h3 className="font-black text-sm text-slate-900">
                  تعریف سریع کالای جدید
                </h3>
                <button
                  type="button"
                  onClick={() => setIsQuickProductModalOpen(false)}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleCreateQuickProduct} className="space-y-3 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    نام کالا <span className="text-rose-600">*</span>:
                  </label>
                  <input
                    type="text"
                    required
                    value={newProductName}
                    onChange={(e) => setNewProductName(e.target.value)}
                    placeholder="مثلاً: فیلتر روغن بهران"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block font-medium text-slate-600 mb-1">دسته‌بندی:</label>
                    <input
                      type="text"
                      value={newProductCategory}
                      onChange={(e) => setNewProductCategory(e.target.value)}
                      placeholder="عمومی"
                      className="w-full px-3 py-1.5 rounded-xl border border-slate-300"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-slate-600 mb-1">واحد سنجش:</label>
                    <input
                      type="text"
                      value={newProductUnit}
                      onChange={(e) => setNewProductUnit(e.target.value)}
                      placeholder="عدد / کارتن"
                      className="w-full px-3 py-1.5 rounded-xl border border-slate-300"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">قیمت خرید (تومان):</label>
                    <NumericInput
                      min={0}
                      value={newProductBuyPrice}
                      onChange={(num) => setNewProductBuyPrice(num)}
                      className="w-full px-3 py-1.5 font-mono rounded-xl border border-slate-300"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">قیمت فروش (تومان):</label>
                    <NumericInput
                      min={0}
                      value={newProductSellPrice}
                      onChange={(num) => setNewProductSellPrice(num)}
                      className="w-full px-3 py-1.5 font-mono rounded-xl border border-slate-300"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => setIsQuickProductModalOpen(false)}
                    className="px-3 py-1.5 rounded-lg text-slate-600 hover:bg-slate-100 font-bold"
                  >
                    انصراف
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                  >
                    ثبت کالا و افزودن
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
        {/* Simple & Uncluttered Cheque Due Date Modal */}
        {isChequeDateModalOpen && (
          <div
            className="fixed inset-0 z-70 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
            onClick={() => setIsChequeDateModalOpen(false)}
          >
            <div
              className="bg-white w-full max-w-xs rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-150"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 bg-amber-50/80 border-b border-amber-200/70">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-amber-600" />
                  <h3 className="font-black text-xs sm:text-sm text-slate-900">
                    انتخاب تاریخ سررسید چک
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsChequeDateModalOpen(false)}
                  className="p-1 text-slate-400 hover:text-slate-700 hover:bg-amber-100/60 rounded-lg transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-3.5 space-y-3">
                {/* Quick Presets for Cheque */}
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { label: 'امروز', days: 0 },
                    { label: '۱۵ روزه', days: 15 },
                    { label: '۱ ماهه', days: 30 },
                    { label: '۴۵ روزه', days: 45 },
                    { label: '۲ ماهه', days: 60 },
                    { label: '۳ ماهه', days: 90 },
                  ].map((preset) => {
                    const targetDate = preset.days === 0 ? getCurrentJalaliDate() : addDaysToJalali(preset.days);
                    const isSelected = toEnglishDigits(chequeDueDate) === toEnglishDigits(targetDate);
                    return (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => {
                          setChequeDueDate(targetDate);
                          setIsChequeDateModalOpen(false);
                        }}
                        className={`py-1.5 px-2 rounded-lg text-[11px] font-bold transition-all cursor-pointer border ${
                          isSelected
                            ? 'bg-amber-500 text-white border-amber-600 shadow-xs'
                            : 'bg-slate-50 hover:bg-amber-50 text-slate-700 border-slate-200 hover:border-amber-300'
                        }`}
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                </div>

                {/* Month & Year Navigation */}
                <div className="flex items-center justify-between bg-slate-50 rounded-xl px-2 py-1.5 border border-slate-200/80">
                  <button
                    type="button"
                    onClick={() => {
                      if (chequeCalMonth === 1) {
                        setChequeCalMonth(12);
                        setChequeCalYear((y) => y - 1);
                      } else {
                        setChequeCalMonth((m) => m - 1);
                      }
                    }}
                    className="p-1 text-slate-600 hover:bg-white hover:shadow-2xs rounded-lg transition-all cursor-pointer"
                    title="ماه قبل"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>

                  <div className="flex items-center gap-1.5 text-xs font-black text-slate-800">
                    <span>{JALALI_MONTH_NAMES[chequeCalMonth - 1]}</span>
                    <span className="font-mono text-amber-700">{toPersianDigits(chequeCalYear)}</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      if (chequeCalMonth === 12) {
                        setChequeCalMonth(1);
                        setChequeCalYear((y) => y + 1);
                      } else {
                        setChequeCalMonth((m) => m + 1);
                      }
                    }}
                    className="p-1 text-slate-600 hover:bg-white hover:shadow-2xs rounded-lg transition-all cursor-pointer"
                    title="ماه بعد"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                </div>

                {/* Days Grid */}
                <div>
                  <div className="grid grid-cols-7 gap-1 text-center mb-1">
                    {['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'].map((w) => (
                      <div key={w} className="text-[10px] font-bold text-slate-400 py-0.5">
                        {w}
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-7 gap-1">
                    {Array.from({ length: getJalaliMonthStartWeekday(chequeCalYear, chequeCalMonth) }).map((_, idx) => (
                      <div key={`empty-${idx}`} className="h-8" />
                    ))}
                    {Array.from({ length: getJalaliMonthDays(chequeCalYear, chequeCalMonth) }).map((_, idx) => {
                      const d = idx + 1;
                      const formatted = `${chequeCalYear}/${String(chequeCalMonth).padStart(2, '0')}/${String(d).padStart(2, '0')}`;
                      const isSelected = toEnglishDigits(chequeDueDate) === formatted;
                      const isToday = toEnglishDigits(getCurrentJalaliDate()) === formatted;

                      return (
                        <button
                          key={d}
                          type="button"
                          onClick={() => {
                            setChequeDueDate(formatted);
                            setIsChequeDateModalOpen(false);
                          }}
                          className={`h-8 rounded-lg font-mono text-xs font-bold flex items-center justify-center transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-amber-500 text-white font-black shadow-xs scale-105'
                              : isToday
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-300 font-black'
                              : 'hover:bg-amber-50 text-slate-700'
                          }`}
                        >
                          {toPersianDigits(d)}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
