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
  Send
} from 'lucide-react';

interface NewPurchaseInvoiceModalProps {
  products: Product[];
  settings: StoreSettings;
  currentUser?: AppUser;
  lastInvoiceNumber?: string;
  previousSuppliers?: string[];
  editingInvoice?: PurchaseInvoice | null;
  onClose: () => void;
  onSavePurchase: (
    purchaseInvoice: PurchaseInvoice,
    inboundReceipt: InboundReceipt,
    newProductsCreated: Product[]
  ) => void;
}

export const NewPurchaseInvoiceModal: React.FC<NewPurchaseInvoiceModalProps> = ({
  products,
  settings,
  editingInvoice,
  previousSuppliers = [],
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
      return editingInvoice.items;
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
      },
    ];
  });

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

  const [chequeName] = useState(() => editingInvoice?.chequeName || '');
  const [transferDescription] = useState(() => editingInvoice?.transferDescription || '');
  const [notes, setNotes] = useState(() => editingInvoice?.notes || '');
  const [showNotesField, setShowNotesField] = useState<boolean>(() => Boolean(editingInvoice?.notes));

  // Quick product creation modal inside purchase
  const [isQuickProductModalOpen, setIsQuickProductModalOpen] = useState(false);
  const [newProductName, setNewProductName] = useState('');
  const [newProductCategory, setNewProductCategory] = useState('عمومی');
  const [newProductUnit, setNewProductUnit] = useState('عدد');
  const [newProductBuyPrice, setNewProductBuyPrice] = useState<number>(0);
  const [newProductSellPrice, setNewProductSellPrice] = useState<number>(0);

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
    };
    setItems([...items, newItem]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) return;
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
      const existingIdx = prev.findIndex((it) => it.productId === prod.id);
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

      // If there's a single row or last row without a selected product, replace it
      if (prev.length === 1 && !prev[0].productId) {
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
      if (updated[lastIdx] && !updated[lastIdx].productName) {
        updated[lastIdx] = {
          ...updated[lastIdx],
          productId: newProd.id,
          productName: newProd.name,
          productCode: newProd.code,
          unit: newProd.unit,
          buyPrice: newProd.buyPrice,
          total: updated[lastIdx].quantity * newProd.buyPrice,
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
      setValidationError('لطفاً نام تامین‌کننده یا فروشنده را وارد و یا از لیست انتخاب نمایید.');
      return;
    }

    if (!invoiceNumber.trim()) {
      setValidationError('لطفاً شماره فاکتور خرید را وارد نمایید.');
      return;
    }

    if (items.length === 0 || items.some((it) => !it.productId || it.quantity <= 0)) {
      setValidationError('لطفاً حداقل یک قلم کالا با تعداد معتبر در فاکتور ثبت نمایید.');
      return;
    }

    const purchaseId = editingInvoice?.id || `pur-${Date.now()}`;
    const receiptId = editingInvoice?.inboundReceiptId || `inb-${Date.now()}`;
    const receiptNumber = StorageService.getNextInboundReceiptNumber();

    let existingReceipt: InboundReceipt | undefined;
    if (editingInvoice?.inboundReceiptId) {
      try {
        existingReceipt = StorageService.getInboundReceipts().find((r) => r.id === editingInvoice.inboundReceiptId);
      } catch (err) {
        console.error(err);
      }
    }

    const inboundReceipt: InboundReceipt = existingReceipt ? {
      ...existingReceipt,
      purchaseInvoiceNumber: invoiceNumber.trim(),
      supplierName: finalSupplierName,
      date,
      items: items.map((item, idx) => {
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
      totalExpectedQuantity: items.reduce((sum, i) => sum + i.quantity, 0),
      totalDiscrepancy: existingReceipt.items ? (existingReceipt.totalReceivedQuantity - items.reduce((sum, i) => sum + i.quantity, 0)) : -items.reduce((sum, i) => sum + i.quantity, 0),
      notes: notes.trim() || existingReceipt.notes || `رسید ورود انبار متناظر با فاکتور خرید ${invoiceNumber.trim()}`,
      updatedAt: new Date().toISOString(),
    } : {
      id: receiptId,
      receiptNumber,
      purchaseInvoiceId: purchaseId,
      purchaseInvoiceNumber: invoiceNumber.trim(),
      supplierName: finalSupplierName,
      date,
      status: 'pending_verification',
      items: items.map((item, idx) => ({
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
      totalExpectedQuantity: items.reduce((sum, i) => sum + i.quantity, 0),
      totalReceivedQuantity: 0,
      totalDiscrepancy: -items.reduce((sum, i) => sum + i.quantity, 0),
      notes: notes.trim() || `رسید ورود انبار متناظر با فاکتور خرید ${invoiceNumber.trim()}`,
      createdAt: new Date().toISOString(),
    };

    const purchaseInvoice: PurchaseInvoice = {
      id: purchaseId,
      invoiceNumber: invoiceNumber.trim(),
      supplierName: finalSupplierName,
      supplierPhone: supplierPhone.trim() || undefined,
      supplierAddress: supplierAddress.trim() || undefined,
      supplierEconomicCode: supplierEconomicCode.trim() || undefined,
      date,
      dueDate: dueDate.trim() || undefined,
      items,
      subtotal,
      totalDiscount,
      taxRate,
      taxAmount,
      shippingCost: shippingCost || undefined,
      finalTotal,
      paymentStatus,
      paymentMethod,
      paidAmount: paymentStatus === 'paid' ? finalTotal : paidAmount,
      chequeNumber: chequeNumber.trim() || undefined,
      chequeDueDate: chequeDueDate.trim() || undefined,
      chequeName: chequeName.trim() || undefined,
      transferDescription: transferDescription.trim() || undefined,
      notes: notes.trim() || undefined,
      status: editingInvoice?.status || 'pending_receipt',
      inboundReceiptId: receiptId,
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
          notes: 'تامین‌کننده / فروشنده کالا (ثبت خودکار از فاکتور خرید)',
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
        <div className="bg-slate-900 text-white px-4 py-3 flex items-center justify-between shrink-0 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0">
              <ShoppingBag className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-black text-white">
                  {isEditing ? `ویرایش فاکتور خرید ${toPersianDigits(invoiceNumber)}` : 'ثبت فاکتور خرید کالا'}
                </h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  {isEditing ? 'ویرایش' : 'صدور حواله انبار'}
                </span>
              </div>
            </div>
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

          {/* SECTION 1: SUPPLIER & INVOICE DETAILS (COMPACT SINGLE STRIP) */}
          <div className="bg-slate-50/90 rounded-xl border border-slate-200/90 p-3 space-y-2.5">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5 items-start">
              
              {/* Supplier Selection Column (6 cols) */}
              <div className="md:col-span-6" ref={supplierDropdownRef}>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                    <Building2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>تامین‌کننده / فروشنده</span>
                    <span className="text-rose-600">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowOptionalDetails(!showOptionalDetails)}
                    className="text-[11px] font-bold text-emerald-700 hover:text-emerald-900 flex items-center gap-0.5 cursor-pointer"
                  >
                    <span>{showOptionalDetails ? 'بستن مشخصات تکمیلی' : '+ مشخصات تکمیلی'}</span>
                    {showOptionalDetails ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>
                </div>

                {supplierName ? (
                  <div className="h-9 bg-white rounded-xl border border-emerald-500/50 px-2.5 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <UserCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
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
                      placeholder="جستجو یا تایپ نام فروشنده..."
                      className="w-full h-9 bg-white border border-slate-300 rounded-xl pr-8 pl-7 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-medium"
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
                            className="p-2 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-900 font-bold flex items-center justify-between cursor-pointer mb-1 border border-emerald-200"
                          >
                            <span className="flex items-center gap-1.5">
                              <PlusCircle className="w-3.5 h-3.5 text-emerald-600" />
                              <span>انتخاب نام جدید: «{supplierSearchInput.trim()}»</span>
                            </span>
                            <span className="text-[10px] bg-emerald-200/80 px-1.5 py-0.5 rounded">ثبت</span>
                          </div>
                        )}

                        {filteredSuppliers.length === 0 ? (
                          <div className="py-3 text-center text-slate-400 text-[11px]">
                            تامین‌کننده‌ای یافت نشد. نام دلخواه را تایپ کنید.
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
                    <span>شماره فاکتور</span>
                  </label>
                  <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1.5 rounded border border-emerald-200">
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
                  label="تاریخ خرید"
                  required
                  buttonClassName="!h-9"
                />
              </div>
            </div>

            {/* Optional Supplier Details Collapsible Panel */}
            {showOptionalDetails && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-2.5 border-t border-slate-200/80 text-xs animate-in fade-in">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">تلفن فروشنده:</label>
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
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">آدرس فروشنده:</label>
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

          {/* SECTION 2: ITEMS TABLE (WITH LIVE PRODUCT SEARCH) */}
          <div className="bg-white rounded-xl border border-slate-200/90">
            {/* Items Toolbar + Live Search Bar */}
            <div className="bg-slate-50/90 p-2.5 sm:px-3 border-b border-slate-200 rounded-t-xl space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <PackagePlus className="w-4 h-4 text-emerald-600" />
                  <span className="font-bold text-slate-800 text-xs">اقلام فاکتور خرید</span>
                  <span className="text-[10px] font-mono font-bold bg-white text-slate-600 px-1.5 py-0.5 rounded border border-slate-200">
                    {toPersianDigits(items.length)} ردیف
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
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
                    onClick={handleAddItem}
                    className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-lg bg-slate-900 text-white hover:bg-slate-800 font-bold transition-all cursor-pointer active:scale-95"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>افزودن ردیف</span>
                  </button>
                </div>
              </div>

              {/* Live Product Search & Instant Add Bar */}
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
                      <button
                        type="button"
                        onClick={() => {
                          setNewProductName(quickItemSearch.trim());
                          setIsQuickItemDropdownOpen(false);
                          setQuickItemSearch('');
                          setIsQuickProductModalOpen(true);
                        }}
                        className="w-full p-2 mb-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-900 font-bold flex items-center justify-between border border-emerald-200 cursor-pointer transition-colors"
                      >
                        <span className="flex items-center gap-1.5">
                          <PlusCircle className="w-3.5 h-3.5 text-emerald-600" />
                          <span>تعریف کالای جدید با نام «{quickItemSearch.trim()}»</span>
                        </span>
                        <span className="text-[10px] bg-emerald-200/80 px-1.5 py-0.5 rounded">ایجاد سریع</span>
                      </button>
                    )}

                    {filteredQuickProducts.length === 0 ? (
                      <div className="py-4 text-center text-slate-400 text-[11px]">
                        کالایی با این مشخصات یافت نشد. می‌توانید آن را به عنوان کالای جدید تعریف کنید.
                      </div>
                    ) : (
                      <div className="space-y-0.5">
                        {filteredQuickProducts.map((p) => {
                          const inInvoiceItem = items.find((it) => it.productId === p.id);
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
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block">
              <table className="w-full text-right text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100/70 text-slate-600 border-b border-slate-200 font-bold text-[11px]">
                    <th className="py-2 px-2 text-center w-9">#</th>
                    <th className="py-2 px-2 min-w-[250px]">انتخاب / جستجوی زنده کالا</th>
                    <th className="py-2 px-2 text-center w-24">تعداد خرید</th>
                    <th className="py-2 px-2 text-center w-14">واحد</th>
                    <th className="py-2 px-2 text-center w-36">قیمت واحد (تومان)</th>
                    <th className="py-2 px-2 text-center w-32">جمع ردیف</th>
                    <th className="py-2 px-2 text-center w-9">حذف</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((item, index) => {
                    const selectedProd = allAvailableProducts.find((p) => p.id === item.productId);
                    const isRowOpen = activeRowDropdownIndex === index;

                    return (
                      <tr key={item.id} className={index % 2 === 1 ? 'bg-slate-50/40' : 'bg-white'}>
                        <td className="p-1.5 text-center font-mono text-slate-400 font-bold text-[11px]">
                          {toPersianDigits(index + 1)}
                        </td>
                        <td className="p-1.5 relative">
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
                          <span className="text-slate-600 font-medium bg-slate-100 px-1.5 py-0.5 rounded text-[10px]">
                            {item.unit || 'عدد'}
                          </span>
                        </td>
                        <td className="p-1.5">
                          <NumericInput
                            min={0}
                            value={item.buyPrice}
                            onChange={(num) => handleItemChange(index, 'buyPrice', num)}
                            textAlign="center"
                            className="w-full px-2 py-1 text-center font-mono font-bold text-slate-800 rounded-lg border border-slate-300 text-xs focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
                          />
                        </td>
                        <td className="p-1.5 text-center font-mono font-black text-emerald-900 text-xs">
                          {toPersianDigits(formatPrice(item.total, ''))}
                        </td>
                        <td className="p-1.5 text-center">
                          <button
                            type="button"
                            disabled={items.length <= 1}
                            onClick={() => handleRemoveItem(index)}
                            className="p-1 text-slate-400 hover:text-rose-600 disabled:opacity-20 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                            title="حذف ردیف"
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
                const selectedProd = allAvailableProducts.find((p) => p.id === item.productId);
                const isRowOpen = activeRowDropdownIndex === index;

                return (
                  <div key={item.id} className="p-2.5 bg-slate-50/80 rounded-xl border border-slate-200/90 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-md bg-emerald-600 text-white font-mono font-bold text-[11px] flex items-center justify-center shrink-0">
                        {toPersianDigits(index + 1)}
                      </span>
                      <div className="flex-1 min-w-0 relative" ref={isRowOpen ? rowDropdownRef : undefined}>
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
                            {selectedProd ? `${selectedProd.name} (موجودی: ${toPersianDigits(selectedProd.stock)})` : '-- جستجو و انتخاب کالا --'}
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
                      <button
                        type="button"
                        disabled={items.length <= 1}
                        onClick={() => handleRemoveItem(index)}
                        className="p-1 text-slate-400 hover:text-rose-600 disabled:opacity-20"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <span className="text-[10px] text-slate-500 block mb-0.5">تعداد ({item.unit || 'عدد'}):</span>
                        <NumericInput
                          min={1}
                          value={item.quantity}
                          onChange={(num) => handleItemChange(index, 'quantity', num || 1)}
                          textAlign="center"
                          className="w-full p-1 text-center font-mono font-black text-xs rounded-lg border border-slate-300 bg-white"
                        />
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 block mb-0.5">قیمت خرید:</span>
                        <NumericInput
                          min={0}
                          value={item.buyPrice}
                          onChange={(num) => handleItemChange(index, 'buyPrice', num)}
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
                  <span>وضعیت و روش تسویه</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowNotesField(!showNotesField)}
                  className="text-[11px] font-bold text-slate-500 hover:text-slate-800 flex items-center gap-1 cursor-pointer"
                >
                  <FileText className="w-3 h-3" />
                  <span>{showNotesField ? 'بستن یادداشت' : '+ افزودن یادداشت'}</span>
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
                  تسویه کامل
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
                  بیعانه / قسطی
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
                  نسیه / دفتری
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

              {/* Conditional Partial Amount */}
              {paymentStatus === 'partial' && (
                <div className="p-2 bg-amber-50 rounded-lg border border-amber-200 text-xs flex items-center justify-between gap-2">
                  <span className="font-bold text-amber-900">مبلغ پرداختی (تومان):</span>
                  <NumericInput
                    min={0}
                    max={finalTotal}
                    value={paidAmount}
                    onChange={(num) => setPaidAmount(num)}
                    textAlign="center"
                    className="w-36 p-1 font-mono font-bold rounded-lg border border-amber-300 bg-white text-xs"
                  />
                </div>
              )}

              {/* Conditional Cheque Details */}
              {paymentStatus !== 'unpaid' && paymentMethod === 'cheque' && (
                <div className="p-2 bg-amber-50 rounded-lg border border-amber-200 text-xs grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="شماره صیاد / چک"
                    value={chequeNumber}
                    onChange={(e) => setChequeNumber(e.target.value)}
                    className="h-8 px-2.5 rounded-lg border border-amber-300 bg-white font-mono text-xs text-left focus:outline-none focus:border-amber-500"
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
                            انتخاب تاریخ سررسید چک
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
                    placeholder="یادداشت، شماره بارنامه یا شرایط گارانتی..."
                    className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs placeholder:text-slate-400 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              )}
            </div>

            {/* Calculations & Totals (5 cols) */}
            <div className="lg:col-span-5 bg-slate-50/90 rounded-xl border border-slate-200/90 p-3 space-y-2 text-xs flex flex-col justify-between">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-slate-700">
                  <span>جمع اقلام ({toPersianDigits(items.length)} ردیف):</span>
                  <span className="font-mono font-bold text-slate-900">
                    {toPersianDigits(formatPrice(subtotal))} تومان
                  </span>
                </div>

                <div className="pt-1 border-t border-slate-200/80">
                  <button
                    type="button"
                    onClick={() => setShowExtraFinancials(!showExtraFinancials)}
                    className="text-[11px] font-bold text-emerald-700 hover:text-emerald-900 flex items-center gap-0.5 cursor-pointer"
                  >
                    <span>
                      {showExtraFinancials
                        ? 'بستن تخفیف و کرایه حمل'
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
                        <span className="text-slate-600 text-[11px]">کرایه حمل (تومان):</span>
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

              {/* Final Total Box */}
              <div className="bg-emerald-600 text-white rounded-xl px-3 py-2.5 flex items-center justify-between shadow-2xs">
                <span className="font-bold text-xs">مبلغ نهایی فاکتور:</span>
                <span className="font-black font-mono text-sm sm:text-base">
                  {toPersianDigits(formatPrice(finalTotal))} تومان
                </span>
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
              className="flex items-center justify-center gap-1.5 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white font-black text-xs sm:text-sm shadow-sm transition-all cursor-pointer"
            >
              <Check className="w-4 h-4 stroke-[2.5]" />
              <span>{isEditing ? 'ذخیره تغییرات فاکتور خرید' : 'ثبت فاکتور خرید و صدور حواله انبار'}</span>
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
                    const base = toEnglishDigits(date || getCurrentJalaliDate());
                    const targetDate = preset.days === 0 ? getCurrentJalaliDate() : addDaysToJalali(base, preset.days);
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
