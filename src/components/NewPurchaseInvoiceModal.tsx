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
import { toPersianDigits, formatPrice, getCurrentJalaliDate, formatThousands } from '../utils/jalali';
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
  Calendar, 
  CreditCard, 
  X, 
  Check, 
  AlertCircle,
  Truck,
  PlusCircle,
  Calculator,
  Phone,
  MapPin,
  Hash,
  FileText,
  Search,
  ChevronDown,
  ChevronUp,
  UserCheck,
  CheckCircle2
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
  currentUser,
  lastInvoiceNumber,
  previousSuppliers = [],
  editingInvoice,
  onClose,
  onSavePurchase,
}) => {
  const isEditing = !!editingInvoice;

  // Generate sequential numbers for invoice and warehouse receipt or use editingInvoice
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

  // Supplier dropdown search & details UI states
  const [isSupplierDropdownOpen, setIsSupplierDropdownOpen] = useState(false);
  const [supplierSearchInput, setSupplierSearchInput] = useState('');
  const [showOptionalDetails, setShowOptionalDetails] = useState(() => 
    !!(editingInvoice && (editingInvoice.supplierPhone || editingInvoice.supplierAddress || editingInvoice.supplierEconomicCode || editingInvoice.dueDate))
  );
  const supplierDropdownRef = useRef<HTMLDivElement>(null);

  // Close supplier dropdown when clicking outside
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

    // 1. Registered customers / counterparties in database
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

    // 2. Previous purchase invoices suppliers
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

  // Filtered suppliers based on search query
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

  // Handle selecting a supplier from the list
  const handleSelectSupplier = (s: { name: string; phone?: string; address?: string; nationalId?: string }) => {
    setSupplierName(s.name);
    if (s.phone) setSupplierPhone(s.phone);
    if (s.address) setSupplierAddress(s.address);
    if (s.nationalId) setSupplierEconomicCode(s.nationalId);
    setIsSupplierDropdownOpen(false);
    setSupplierSearchInput('');
  };

  // Clear selected supplier
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
  const [taxRate, setTaxRate] = useState<number>(() => editingInvoice?.taxRate || 0);
  const [shippingCost, setShippingCost] = useState<number>(() => editingInvoice?.shippingCost || 0);
  const [overallDiscount, setOverallDiscount] = useState<number>(() => {
    if (!editingInvoice) return 0;
    const itemsDisc = editingInvoice.items?.reduce((s, it) => s + (it.discount || 0), 0) || 0;
    return Math.max(0, (editingInvoice.totalDiscount || 0) - itemsDisc);
  });

  // Payment configuration
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>(() => editingInvoice?.paymentStatus || 'paid');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(() => editingInvoice?.paymentMethod || 'transfer');
  const [paidAmount, setPaidAmount] = useState<number>(() => editingInvoice?.paidAmount || 0);
  const [chequeNumber, setChequeNumber] = useState(() => editingInvoice?.chequeNumber || '');
  const [chequeDueDate, setChequeDueDate] = useState(() => editingInvoice?.chequeDueDate || '');
  const [chequeName, setChequeName] = useState(() => editingInvoice?.chequeName || '');
  const [transferDescription, setTransferDescription] = useState(() => editingInvoice?.transferDescription || '');
  const [notes, setNotes] = useState(() => editingInvoice?.notes || '');

  // Quick product creation modal inside purchase
  const [isQuickProductModalOpen, setIsQuickProductModalOpen] = useState(false);
  const [newProductName, setNewProductName] = useState('');
  const [newProductCategory, setNewProductCategory] = useState('عمومی');
  const [newProductUnit, setNewProductUnit] = useState('عدد');
  const [newProductBuyPrice, setNewProductBuyPrice] = useState<number>(0);
  const [newProductSellPrice, setNewProductSellPrice] = useState<number>(0);

  // Calculations
  const subtotal = items.reduce((sum, item) => sum + item.total, 0);
  const totalDiscount = overallDiscount + items.reduce((sum, item) => sum + (item.discount || 0), 0);
  const taxableAmount = Math.max(0, subtotal - overallDiscount);
  const taxAmount = Math.round((taxableAmount * taxRate) / 100);
  const finalTotal = Math.max(0, taxableAmount + taxAmount + (shippingCost || 0));

  // Sync paidAmount when paymentStatus changes
  const handlePaymentStatusChange = (status: PaymentStatus) => {
    setPaymentStatus(status);
    if (status === 'paid') {
      setPaidAmount(finalTotal);
    } else if (status === 'unpaid') {
      setPaidAmount(0);
    }
  };

  // Add Item row
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
    const next = items.filter((_, i) => i !== index);
    setItems(next);
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
  };

  // Quick product save
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

    // Replace the last item or add as a new item
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

    // Reset quick product form
    setNewProductName('');
    setNewProductBuyPrice(0);
    setNewProductSellPrice(0);
    setIsQuickProductModalOpen(false);
  };

  // Form Submit
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!supplierName.trim()) {
      alert('لطفاً نام تامین‌کننده یا فروشنده را وارد و یا از لیست انتخاب نمایید.');
      return;
    }

    if (!invoiceNumber.trim()) {
      alert('لطفاً شماره فاکتور خرید را وارد نمایید.');
      return;
    }

    if (items.length === 0 || items.some((it) => !it.productId || it.quantity <= 0)) {
      alert('لطفاً حداقل یک قلم کالا با تعداد معتبر در فاکتور ثبت نمایید.');
      return;
    }

    const purchaseId = editingInvoice?.id || `pur-${Date.now()}`;
    const receiptId = editingInvoice?.inboundReceiptId || `inb-${Date.now()}`;
    const receiptNumber = StorageService.getNextInboundReceiptNumber();

    // 1. Build Inbound Warehouse Receipt (GRN)
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
      supplierName: supplierName.trim(),
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
      supplierName: supplierName.trim(),
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

    // 2. Build Purchase Invoice
    const purchaseInvoice: PurchaseInvoice = {
      id: purchaseId,
      invoiceNumber: invoiceNumber.trim(),
      supplierName: supplierName.trim(),
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

    // Auto-sync supplier to customers & counterparties list if not existing
    try {
      const customers = StorageService.getCustomers();
      const trimmedSup = supplierName.trim();
      const existingCustomer = customers.find(
        (c) => c.name.trim().toLowerCase() === trimmedSup.toLowerCase()
      );
      if (!existingCustomer) {
        const newCustomer: Customer = {
          id: `cust-supp-${Date.now()}`,
          name: trimmedSup,
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
      <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh] border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header Bar */}
        <div className="bg-slate-900 text-white px-4 sm:px-6 py-3.5 flex items-center justify-between shrink-0 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-black text-white">
                  {isEditing ? `ویرایش فاکتور خرید ${toPersianDigits(invoiceNumber)}` : 'ثبت فاکتور خرید کالا'}
                </h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  {isEditing ? 'حالت ویرایش' : 'ورود به انبار'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {isEditing ? 'اصلاح مشخصات فاکتور، اقلام و شرایط تسویه تامین‌کننده' : 'ثبت اقلام خریداری‌شده و صدور خودکار حواله ورود کالا جهت تایید انباردار'}
              </p>
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
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-3 sm:p-5 space-y-4">
          
          {/* SECTION 1: SUPPLIER & INVOICE DETAILS (DECLUTTERED, REGULAR & PERFECTLY ALIGNED) */}
          <div className="bg-slate-50/90 rounded-2xl border border-slate-200/90 p-4 sm:p-5 space-y-3.5 shadow-2xs">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5 items-start">
              
              {/* Supplier Selection Column (6 cols on md/lg) */}
              <div className="md:col-span-6 space-y-0" ref={supplierDropdownRef}>
                <div className="h-5 flex items-center justify-between mb-1.5">
                  <label className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>تامین‌کننده / فروشنده کالا</span>
                    <span className="text-rose-600">*</span>
                  </label>
                  {availableSuppliers.length > 0 && !supplierName && (
                    <span className="text-[10px] text-slate-400 font-bold">
                      {toPersianDigits(availableSuppliers.length)} طرف‌حساب
                    </span>
                  )}
                </div>

                {/* Display when supplier is SELECTED */}
                {supplierName ? (
                  <div className="h-10 bg-white rounded-xl border border-emerald-500/50 px-3 flex items-center justify-between gap-2 shadow-2xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
                        <UserCheck className="w-3.5 h-3.5 text-emerald-700" />
                      </div>
                      <span className="font-black text-slate-900 text-xs sm:text-sm truncate">
                        {supplierName}
                      </span>
                      {supplierPhone && (
                        <span className="text-[11px] text-slate-500 font-mono hidden lg:inline">
                          ({toPersianDigits(supplierPhone)})
                        </span>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={handleClearSupplier}
                      className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 text-[11px] font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1"
                      title="تغییر تامین‌کننده"
                    >
                      <X className="w-3 h-3" />
                      <span>تغییر</span>
                    </button>
                  </div>
                ) : (
                  /* Search & Select Input when NO supplier is selected */
                  <div className="relative">
                    <input
                      type="text"
                      required
                      value={supplierSearchInput}
                      onFocus={() => setIsSupplierDropdownOpen(true)}
                      onChange={(e) => {
                        setSupplierSearchInput(e.target.value);
                        setIsSupplierDropdownOpen(true);
                      }}
                      placeholder="جستجو یا تایپ نام تامین‌کننده / فروشنده..."
                      className="w-full h-10 bg-white border border-slate-300 rounded-xl pr-9 pl-8 text-xs sm:text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-medium shadow-2xs"
                    />
                    <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    {supplierSearchInput && (
                      <button
                        type="button"
                        onClick={() => setSupplierSearchInput('')}
                        className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-full"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {/* Interactive Dropdown Menu */}
                    {isSupplierDropdownOpen && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-2xl shadow-xl border border-slate-200 max-h-56 overflow-y-auto z-40 p-1.5 text-xs animate-in fade-in slide-in-from-top-2">
                        {/* Option to use custom typed text */}
                        {supplierSearchInput.trim() && (
                          <div
                            onClick={() => {
                              setSupplierName(supplierSearchInput.trim());
                              setIsSupplierDropdownOpen(false);
                            }}
                            className="p-2.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-900 font-bold flex items-center justify-between cursor-pointer mb-1 border border-emerald-200 transition-colors"
                          >
                            <span className="flex items-center gap-1.5">
                              <PlusCircle className="w-4 h-4 text-emerald-600" />
                              <span>ثبت با نام جدید: «{supplierSearchInput.trim()}»</span>
                            </span>
                            <span className="text-[10px] bg-emerald-200/80 px-2 py-0.5 rounded-md">انتخاب</span>
                          </div>
                        )}

                        {filteredSuppliers.length === 0 ? (
                          <div className="py-4 text-center text-slate-400">
                            {supplierSearchInput ? 'تامین‌کننده‌ای با این نام یافت نشد. دکمه بالا را برای ثبت نام کلیک کنید.' : 'هیچ تامین‌کننده‌ای در سیستم ثبت نشده است. نام دلخواه را تایپ کنید.'}
                          </div>
                        ) : (
                          <div className="space-y-0.5">
                            <div className="px-2 py-1 text-[10px] font-bold text-slate-400">
                              لیست طرف‌حساب‌ها و تامین‌کنندگان:
                            </div>
                            {filteredSuppliers.map((s, idx) => (
                              <div
                                key={idx}
                                onClick={() => handleSelectSupplier(s)}
                                className="p-2 rounded-xl hover:bg-slate-100 flex items-center justify-between transition-colors cursor-pointer group"
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <div className="w-7 h-7 rounded-lg bg-slate-100 group-hover:bg-emerald-100 text-slate-700 group-hover:text-emerald-800 flex items-center justify-center font-bold text-xs shrink-0 transition-colors">
                                    {s.name.charAt(0)}
                                  </div>
                                  <div className="min-w-0">
                                    <div className="font-bold text-slate-800 text-xs truncate group-hover:text-emerald-900">
                                      {s.name}
                                    </div>
                                    {s.phone && (
                                      <div className="text-[10px] text-slate-400 font-mono">
                                        {toPersianDigits(s.phone)}
                                      </div>
                                    )}
                                  </div>
                                </div>
                                {s.address && (
                                  <span className="text-[10px] text-slate-400 max-w-[120px] truncate hidden sm:inline">
                                    {s.address}
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

              {/* Invoice Number Column (3 cols on md/lg) */}
              <div className="md:col-span-3">
                <div className="h-5 flex items-center justify-between mb-1.5">
                  <label className="text-xs font-black text-slate-800 flex items-center gap-1">
                    <Hash className="w-3.5 h-3.5 text-slate-400" />
                    <span>شماره فاکتور خرید</span>
                    <span className="text-rose-600">*</span>
                  </label>
                  <span 
                    className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-md border border-emerald-200 select-none"
                    title="شماره فاکتور خرید بصورت خودکار توسط سیستم تعیین می‌شود"
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
                  title="شماره فاکتور خرید بصورت خودکار توسط خود برنامه تعیین شده است"
                  className="w-full h-10 bg-slate-50/90 border border-slate-300 rounded-xl px-3 text-xs sm:text-sm font-mono font-black text-slate-800 text-left focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all shadow-2xs"
                />
              </div>

              {/* Invoice Date Column (3 cols on md/lg) */}
              <div className="md:col-span-3">
                <JalaliDatePicker
                  value={date}
                  onChange={setDate}
                  label="تاریخ خرید"
                  required
                />
              </div>
            </div>

            {/* Optional Supplier Details Collapsible Toggle */}
            <div className="pt-2.5 border-t border-slate-200/80">
              <button
                type="button"
                onClick={() => setShowOptionalDetails(!showOptionalDetails)}
                className="text-xs font-bold text-slate-600 hover:text-slate-900 flex items-center gap-1.5 transition-colors cursor-pointer py-0.5"
              >
                <span>{showOptionalDetails ? 'پنهان‌سازی اطلاعات تکمیلی فروشنده' : '+ اطلاعات تکمیلی فروشنده (تلفن، آدرس، کد اقتصادی، سررسید تسویه)'}</span>
                {showOptionalDetails ? <ChevronUp className="w-3.5 h-3.5 text-slate-400" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-400" />}
              </button>

              {showOptionalDetails && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-3 text-xs animate-in fade-in">
                  <div>
                    <div className="h-4 flex items-center mb-1.5">
                      <label className="text-[11px] font-bold text-slate-600">تلفن فروشنده:</label>
                    </div>
                    <input
                      type="text"
                      value={supplierPhone}
                      onChange={(e) => setSupplierPhone(e.target.value)}
                      placeholder="۰۲۱-۸۸۲۲۳۳۴۴"
                      className="w-full h-9 bg-white border border-slate-300 rounded-xl px-3 font-mono text-xs text-left focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>

                  <div>
                    <div className="h-4 flex items-center mb-1.5">
                      <label className="text-[11px] font-bold text-slate-600">کد اقتصادی / ملی:</label>
                    </div>
                    <input
                      type="text"
                      value={supplierEconomicCode}
                      onChange={(e) => setSupplierEconomicCode(e.target.value)}
                      placeholder="شناسه ۱۰ یا ۱۱ رقمی"
                      className="w-full h-9 bg-white border border-slate-300 rounded-xl px-3 font-mono text-xs text-left focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>

                  <div>
                    <div className="h-4 flex items-center mb-1.5">
                      <label className="text-[11px] font-bold text-slate-600">تاریخ سررسید تسویه:</label>
                    </div>
                    <JalaliDatePicker
                      value={dueDate}
                      onChange={setDueDate}
                      placeholder="انتخاب سررسید"
                      buttonClassName="!h-9"
                    />
                  </div>

                  <div>
                    <div className="h-4 flex items-center mb-1.5">
                      <label className="text-[11px] font-bold text-slate-600">آدرس فروشنده / انبار مبدأ:</label>
                    </div>
                    <input
                      type="text"
                      value={supplierAddress}
                      onChange={(e) => setSupplierAddress(e.target.value)}
                      placeholder="تهران، خیابان..."
                      className="w-full h-9 bg-white border border-slate-300 rounded-xl px-3 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* SECTION 2: ITEMS TABLE (CLEAN, STREAMLINED & HIGHLY READABLE) */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
            {/* Items Toolbar */}
            <div className="bg-slate-50/90 px-3.5 py-2.5 border-b border-slate-200 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <PackagePlus className="w-4 h-4 text-emerald-600" />
                <span className="font-black text-slate-800 text-xs sm:text-sm">اقلام و کالاهای خریداری‌شده</span>
                <span className="text-[11px] font-mono font-bold bg-white text-slate-700 px-2 py-0.5 rounded-lg border border-slate-200">
                  {toPersianDigits(items.length)} ردیف
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsQuickProductModalOpen(true)}
                  className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-xl bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200 font-bold transition-colors cursor-pointer"
                >
                  <PlusCircle className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="hidden sm:inline">تعریف کالای جدید</span>
                  <span className="sm:hidden">کالای جدید</span>
                </button>

                <button
                  type="button"
                  onClick={handleAddItem}
                  className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-xl bg-slate-900 text-white hover:bg-slate-800 font-bold transition-all shadow-xs cursor-pointer active:scale-95"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>افزودن ردیف</span>
                </button>
              </div>
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-right text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100/70 text-slate-700 border-b border-slate-200 font-bold">
                    <th className="p-2.5 text-center w-10">#</th>
                    <th className="p-2.5 min-w-[240px]">انتخاب کالا از انبار</th>
                    <th className="p-2.5 text-center w-24">تعداد خرید</th>
                    <th className="p-2.5 text-center w-16">واحد</th>
                    <th className="p-2.5 text-center min-w-[130px]">قیمت خرید واحد (تومان)</th>
                    <th className="p-2.5 text-center min-w-[100px]">تخفیف (تومان)</th>
                    <th className="p-2.5 text-center min-w-[130px]">جمع ردیف</th>
                    <th className="p-2.5 text-center w-10">حذف</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((item, index) => {
                    const matchedProd = allAvailableProducts.find((p) => p.id === item.productId);
                    return (
                      <tr key={item.id} className={index % 2 === 1 ? 'bg-slate-50/50' : 'bg-white'}>
                        <td className="p-2 text-center font-mono text-slate-400 font-bold">
                          {toPersianDigits(index + 1)}
                        </td>
                        <td className="p-2">
                          <select
                            value={item.productId}
                            onChange={(e) => handleProductSelect(index, e.target.value)}
                            className="w-full px-2.5 py-1.5 rounded-xl border border-slate-300 bg-white font-bold text-slate-800 text-xs focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none cursor-pointer"
                          >
                            <option value="" disabled>-- انتخاب کالا --</option>
                            {allAvailableProducts.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name} (کد: {toPersianDigits(p.code)}) — موجودی: {toPersianDigits(p.stock)} {p.unit}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="p-2">
                          <NumericInput
                            min={1}
                            value={item.quantity}
                            onChange={(num) => handleItemChange(index, 'quantity', num || 1)}
                            textAlign="center"
                            className="w-full px-2 py-1.5 text-center font-mono font-black text-slate-900 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
                          />
                        </td>
                        <td className="p-2 text-center">
                          <span className="text-slate-600 font-medium bg-slate-100 px-2 py-0.5 rounded-lg text-[11px]">
                            {item.unit || 'عدد'}
                          </span>
                        </td>
                        <td className="p-2">
                          <NumericInput
                            min={0}
                            value={item.buyPrice}
                            onChange={(num) => handleItemChange(index, 'buyPrice', num)}
                            textAlign="center"
                            className="w-full px-2 py-1.5 text-center font-mono font-bold text-slate-800 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
                          />
                        </td>
                        <td className="p-2">
                          <NumericInput
                            min={0}
                            value={item.discount}
                            onChange={(num) => handleItemChange(index, 'discount', num)}
                            textAlign="center"
                            className="w-full px-2 py-1.5 text-center font-mono font-bold text-rose-600 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
                          />
                        </td>
                        <td className="p-2 text-center font-mono font-black text-emerald-900 text-sm">
                          {toPersianDigits(formatPrice(item.total))}
                        </td>
                        <td className="p-2 text-center">
                          <button
                            type="button"
                            disabled={items.length <= 1}
                            onClick={() => handleRemoveItem(index)}
                            className="p-1 text-slate-400 hover:text-rose-600 disabled:opacity-20 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                            title="حذف ردیف"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards View */}
            <div className="md:hidden p-3 space-y-2.5">
              {items.map((item, index) => (
                <div key={item.id} className="p-3 bg-slate-50/80 rounded-2xl border border-slate-200/90 space-y-2.5">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-emerald-600 text-white font-mono font-bold text-xs flex items-center justify-center shrink-0">
                      {toPersianDigits(index + 1)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <select
                        value={item.productId}
                        onChange={(e) => handleProductSelect(index, e.target.value)}
                        className="w-full px-2 py-1.5 rounded-xl border border-slate-300 bg-white font-bold text-slate-800 text-xs"
                      >
                        <option value="" disabled>-- انتخاب کالا --</option>
                        {allAvailableProducts.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} (موجودی: {toPersianDigits(p.stock)})
                          </option>
                        ))}
                      </select>
                    </div>
                    <button
                      type="button"
                      disabled={items.length <= 1}
                      onClick={() => handleRemoveItem(index)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 disabled:opacity-20"
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
                        className="w-full p-1.5 text-center font-mono font-black text-sm rounded-xl border border-slate-300 bg-white"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 block mb-0.5">قیمت خرید (فی):</span>
                      <NumericInput
                        min={0}
                        value={item.buyPrice}
                        onChange={(num) => handleItemChange(index, 'buyPrice', num)}
                        textAlign="center"
                        className="w-full p-1.5 text-center font-mono font-bold text-xs rounded-xl border border-slate-300 bg-white"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 block mb-0.5">جمع کل ردیف:</span>
                      <div className="p-1.5 text-center font-mono font-black text-emerald-900 bg-emerald-50 rounded-xl border border-emerald-200 text-xs">
                        {toPersianDigits(formatPrice(item.total))}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* SECTION 3: PAYMENT & FINANCIAL TOTALS (STREAMLINED & ELEGANT) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5">
            
            {/* Payment Configuration (7 cols) */}
            <div className="lg:col-span-7 bg-slate-50/90 rounded-2xl border border-slate-200/90 p-3.5 space-y-3">
              <div className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                <CreditCard className="w-4 h-4 text-blue-600" />
                <span>وضعیت و روش پرداخت فاکتور</span>
              </div>

              {/* Status Segmented Pills */}
              <div className="grid grid-cols-3 gap-1.5 bg-slate-200/60 p-1 rounded-xl text-xs font-bold">
                <button
                  type="button"
                  onClick={() => handlePaymentStatusChange('paid')}
                  className={`py-1.5 rounded-lg transition-all cursor-pointer ${
                    paymentStatus === 'paid'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  تسویه کامل (پرداخت شد)
                </button>
                <button
                  type="button"
                  onClick={() => handlePaymentStatusChange('partial')}
                  className={`py-1.5 rounded-lg transition-all cursor-pointer ${
                    paymentStatus === 'partial'
                      ? 'bg-amber-600 text-white shadow-xs'
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
                      ? 'bg-rose-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  نسیه / حساب دفتری
                </button>
              </div>

              {/* Method Selector */}
              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-600 font-bold shrink-0">روش پرداخت:</span>
                <div className="flex-1 grid grid-cols-4 gap-1 bg-white p-1 rounded-xl border border-slate-200 text-[11px] font-bold">
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
                      className={`py-1 rounded-lg transition-all cursor-pointer ${
                        paymentMethod === m.id
                          ? 'bg-slate-900 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Conditional Partial Amount */}
              {paymentStatus === 'partial' && (
                <div className="p-2.5 bg-amber-50 rounded-xl border border-amber-200 text-xs flex items-center justify-between gap-3 animate-in fade-in">
                  <span className="font-bold text-amber-900">مبلغ پرداخت شده نقد/کارت:</span>
                  <NumericInput
                    min={0}
                    max={finalTotal}
                    value={paidAmount}
                    onChange={(num) => setPaidAmount(num)}
                    textAlign="center"
                    className="w-40 p-1.5 font-mono font-bold rounded-lg border border-amber-300 bg-white text-xs"
                  />
                </div>
              )}

              {/* Conditional Cheque Details */}
              {paymentMethod === 'cheque' && (
                <div className="p-2.5 bg-amber-50 rounded-xl border border-amber-200 text-xs grid grid-cols-2 gap-2 animate-in fade-in">
                  <input
                    type="text"
                    placeholder="شماره صیاد / شماره چک"
                    value={chequeNumber}
                    onChange={(e) => setChequeNumber(e.target.value)}
                    className="p-1.5 rounded-lg border border-amber-300 bg-white font-mono text-xs text-left"
                  />
                  <input
                    type="text"
                    placeholder="تاریخ سررسید (۱۴۰۳/۰۹/۱۵)"
                    value={chequeDueDate}
                    onChange={(e) => setChequeDueDate(e.target.value)}
                    className="p-1.5 rounded-lg border border-amber-300 bg-white font-mono text-xs text-left"
                  />
                </div>
              )}

              {/* Notes */}
              <div>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="یادداشت، شرایط گارانتی یا تحویل بار..."
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs placeholder:text-slate-400"
                />
              </div>
            </div>

            {/* Calculations & Totals (5 cols) */}
            <div className="lg:col-span-5 bg-slate-50/90 rounded-2xl border border-slate-200/90 p-3.5 space-y-2.5 text-xs flex flex-col justify-between">
              <div className="space-y-2">
                <div className="flex items-center justify-between pb-1.5 border-b border-slate-200 text-slate-700">
                  <span>جمع ناخالص اقلام:</span>
                  <span className="font-mono font-bold text-slate-900 text-sm">
                    {toPersianDigits(formatPrice(subtotal))} تومان
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-600">تخفیف کلی فاکتور:</span>
                  <NumericInput
                    min={0}
                    value={overallDiscount}
                    onChange={(num) => setOverallDiscount(num)}
                    textAlign="center"
                    className="w-32 px-2 py-1 rounded-lg border border-slate-300 bg-white font-mono font-bold text-rose-600 text-xs"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-600">کرایه حمل / باربری:</span>
                  <NumericInput
                    min={0}
                    value={shippingCost}
                    onChange={(num) => setShippingCost(num)}
                    textAlign="center"
                    className="w-32 px-2 py-1 rounded-lg border border-slate-300 bg-white font-mono font-medium text-slate-800 text-xs"
                  />
                </div>
              </div>

              {/* Big Final Total Badge */}
              <div className="bg-emerald-600 text-white rounded-xl p-3 flex items-center justify-between shadow-xs">
                <span className="font-extrabold text-xs">مبلغ نهایی فاکتور خرید:</span>
                <span className="font-black font-mono text-base sm:text-lg">
                  {toPersianDigits(formatPrice(finalTotal))} تومان
                </span>
              </div>
            </div>
          </div>

          {/* Modal Action Buttons */}
          <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-bold text-xs transition-colors cursor-pointer"
            >
              انصراف
            </button>

            <button
              type="submit"
              id="submit-purchase-invoice-btn"
              className="flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white font-black text-xs sm:text-sm shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
            >
              <Check className="w-4 h-4 stroke-[2.5]" />
              <span>{isEditing ? 'ذخیره تغییرات فاکتور خرید' : 'ثبت فاکتور خرید و صدور حواله ورود به انبار'}</span>
            </button>
          </div>
        </form>

        {/* Quick Product Creation Modal */}
        {isQuickProductModalOpen && (
          <div className="fixed inset-0 z-60 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-md rounded-2xl shadow-xl p-5 border border-slate-200 animate-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-3">
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
                      placeholder="لوازم یدکی"
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
      </div>
    </div>
  );
};
