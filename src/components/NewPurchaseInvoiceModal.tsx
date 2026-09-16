import React, { useState } from 'react';
import { 
  Product, 
  PurchaseInvoice, 
  PurchaseInvoiceItem, 
  InboundReceipt, 
  PaymentMethod, 
  PaymentStatus, 
  StoreSettings, 
  AppUser 
} from '../types';
import { toPersianDigits, formatPrice, getCurrentJalaliDate } from '../utils/jalali';
import { PAYMENT_METHOD_LABELS } from '../utils/storage';
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
  FileText
} from 'lucide-react';

interface NewPurchaseInvoiceModalProps {
  products: Product[];
  settings: StoreSettings;
  currentUser?: AppUser;
  lastInvoiceNumber?: string;
  previousSuppliers?: string[];
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
  onClose,
  onSavePurchase,
}) => {
  // Generate invoice number
  const generateNextNumber = () => {
    const timestamp = Date.now().toString().slice(-4);
    return `PUR-${timestamp}`;
  };

  const generateReceiptNumber = () => {
    const timestamp = Date.now().toString().slice(-4);
    return `REC-${timestamp}`;
  };

  const [invoiceNumber, setInvoiceNumber] = useState(generateNextNumber());
  const [supplierName, setSupplierName] = useState('');
  const [supplierPhone, setSupplierPhone] = useState('');
  const [supplierAddress, setSupplierAddress] = useState('');
  const [supplierEconomicCode, setSupplierEconomicCode] = useState('');
  const [date, setDate] = useState(getCurrentJalaliDate());
  const [dueDate, setDueDate] = useState('');
  
  // Items in purchase invoice
  const [items, setItems] = useState<PurchaseInvoiceItem[]>([
    {
      id: `item-${Date.now()}-1`,
      productId: products[0]?.id || '',
      productName: products[0]?.name || '',
      productCode: products[0]?.code || '',
      unit: products[0]?.unit || 'عدد',
      quantity: 1,
      buyPrice: products[0]?.purchasePrice || 0,
      discount: 0,
      total: products[0]?.purchasePrice || 0,
    },
  ]);

  // Financials
  const [taxRate, setTaxRate] = useState<number>(0);
  const [shippingCost, setShippingCost] = useState<number>(0);
  const [overallDiscount, setOverallDiscount] = useState<number>(0);

  // Payment
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('paid');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('transfer');
  const [paidAmount, setPaidAmount] = useState<number>(0);
  const [chequeNumber, setChequeNumber] = useState('');
  const [chequeDueDate, setChequeDueDate] = useState('');
  const [chequeName, setChequeName] = useState('');
  const [transferDescription, setTransferDescription] = useState('');
  const [notes, setNotes] = useState('');

  // Quick product creation modal inside purchase
  const [isQuickProductModalOpen, setIsQuickProductModalOpen] = useState(false);
  const [newProductName, setNewProductName] = useState('');
  const [newProductCategory, setNewProductCategory] = useState('عمومی');
  const [newProductUnit, setNewProductUnit] = useState('عدد');
  const [newProductBuyPrice, setNewProductBuyPrice] = useState<number>(0);
  const [newProductSellPrice, setNewProductSellPrice] = useState<number>(0);
  const [createdNewProducts, setCreatedNewProducts] = useState<Product[]>([]);

  // Calculate totals
  const subtotal = items.reduce((sum, item) => sum + item.total, 0);
  const totalDiscount = overallDiscount + items.reduce((sum, item) => sum + (item.discount || 0), 0);
  const taxableAmount = Math.max(0, subtotal - overallDiscount);
  const taxAmount = Math.round((taxableAmount * taxRate) / 100);
  const finalTotal = Math.max(0, taxableAmount + taxAmount + (shippingCost || 0));

  // Sync paidAmount if paymentStatus is paid
  const handlePaymentStatusChange = (status: PaymentStatus) => {
    setPaymentStatus(status);
    if (status === 'paid') {
      setPaidAmount(finalTotal);
    } else if (status === 'unpaid') {
      setPaidAmount(0);
    }
  };

  // Add Item
  const handleAddItem = () => {
    const firstProd = products[0];
    const newItem: PurchaseInvoiceItem = {
      id: `item-${Date.now()}-${items.length + 1}`,
      productId: firstProd?.id || '',
      productName: firstProd?.name || '',
      productCode: firstProd?.code || '',
      unit: firstProd?.unit || 'عدد',
      quantity: 1,
      buyPrice: firstProd?.purchasePrice || 0,
      discount: 0,
      total: firstProd?.purchasePrice || 0,
    };
    setItems([...items, newItem]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) return;
    setItems(items.filter((_, i) => i !== index));
  };

  const handleProductSelect = (index: number, productId: string) => {
    const prod = [...products, ...createdNewProducts].find((p) => p.id === productId);
    if (!prod) return;

    setItems((prev) => {
      const copy = [...prev];
      const qty = copy[index].quantity || 1;
      const price = prod.purchasePrice || 0;
      const discount = copy[index].discount || 0;
      copy[index] = {
        ...copy[index],
        productId: prod.id,
        productName: prod.name,
        productCode: prod.code,
        unit: prod.unit,
        buyPrice: price,
        total: Math.max(0, qty * price - discount),
      };
      return copy;
    });
  };

  const handleItemChange = (
    index: number,
    field: 'quantity' | 'buyPrice' | 'discount',
    value: number
  ) => {
    setItems((prev) => {
      const copy = [...prev];
      const itm = { ...copy[index], [field]: Math.max(0, isNaN(value) ? 0 : value) };
      itm.total = Math.max(0, itm.quantity * itm.buyPrice - itm.discount);
      copy[index] = itm;
      return copy;
    });
  };

  // Handle Quick Product Creation
  const handleCreateQuickProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProductName.trim()) return;

    const newProd: Product = {
      id: `prod-${Date.now()}`,
      name: newProductName.trim(),
      code: `${1000 + products.length + createdNewProducts.length + 1}`,
      category: newProductCategory.trim() || 'عمومی',
      buyPrice: newProductBuyPrice,
      sellPrice: newProductSellPrice > 0 ? newProductSellPrice : Math.round(newProductBuyPrice * 1.25),
      stock: 0, // Stock will be added when inbound receipt is verified
      minStockAlert: 5,
      unit: newProductUnit,
      updatedAt: getCurrentJalaliDate(),
    };

    setCreatedNewProducts([...createdNewProducts, newProd]);

    // Add this new product directly into the items list
    const newItem: PurchaseInvoiceItem = {
      id: `item-${Date.now()}`,
      productId: newProd.id,
      productName: newProd.name,
      productCode: newProd.code,
      unit: newProd.unit,
      quantity: 1,
      buyPrice: newProd.buyPrice,
      discount: 0,
      total: newProd.buyPrice,
    };

    setItems([...items, newItem]);
    setIsQuickProductModalOpen(false);
    setNewProductName('');
    setNewProductBuyPrice(0);
    setNewProductSellPrice(0);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierName.trim()) {
      alert('لطفاً نام تامین‌کننده یا فروشنده را وارد کنید.');
      return;
    }
    if (items.length === 0 || items.some((i) => !i.productId || i.quantity <= 0)) {
      alert('لطفاً حداقل یک قلم کالا با تعداد معتبر مشخص کنید.');
      return;
    }

    const purchaseId = `pur-${Date.now()}`;
    const receiptId = `rec-${Date.now()}`;
    const receiptNum = generateReceiptNumber();

    // 1. Build Inbound Receipt in pending_verification status
    const inboundReceipt: InboundReceipt = {
      id: receiptId,
      receiptNumber: receiptNum,
      purchaseInvoiceId: purchaseId,
      purchaseInvoiceNumber: invoiceNumber,
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
      notes: notes.trim() || `حواله ورود صادر شده از فاکتور خرید ${invoiceNumber}`,
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
      status: 'pending_receipt',
      inboundReceiptId: receiptId,
      createdAt: new Date().toISOString(),
    };

    onSavePurchase(purchaseInvoice, inboundReceipt, createdNewProducts);
  };

  const allAvailableProducts = [...products, ...createdNewProducts];

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
      <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh] animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-emerald-800 via-teal-800 to-slate-900 text-white p-4 sm:p-5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-emerald-100 shadow-inner">
              <ShoppingBag className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-white">
                ثبت فاکتور خرید کالا
              </h2>
              <p className="text-xs text-emerald-200 mt-0.5">
                پس از ثبت، حواله ورود به انبار به صورت خودکار جهت بررسی و تایید انباردار ایجاد خواهد شد
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-white/80 hover:text-white rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form */}
        <form id="new-purchase-invoice-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-3 sm:p-6 space-y-4 sm:space-y-6">
          {/* Top Section: Supplier & Header Details */}
          <div className="w-full max-w-full bg-slate-50/90 p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-200/90 shadow-2xs space-y-3.5 sm:space-y-4 box-border overflow-hidden">
            <div className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 pb-2.5 border-b border-slate-200/80 w-full min-w-0">
              <div className="text-xs sm:text-sm font-black text-slate-800 flex items-center gap-2 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
                  <Building2 className="w-4 h-4" />
                </div>
                <span className="truncate sm:whitespace-normal">مشخصات تامین‌کننده و شماره فاکتور خرید</span>
              </div>
              <span className="text-[10px] sm:text-xs font-bold text-slate-400 bg-white px-2 py-0.5 rounded-lg border border-slate-200 shrink-0">
                اطلاعات پایه
              </span>
            </div>

            {/* Vertically stacked inputs on mobile (flex flex-col), responsive grid on desktop */}
            <div className="flex flex-col sm:grid sm:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4 text-xs w-full min-w-0">
              {/* Supplier Name */}
              <div className="w-full min-w-0 flex flex-col sm:col-span-2 lg:col-span-1">
                <label className="block font-bold text-slate-700 mb-1.5 leading-snug break-words">
                  نام تامین‌کننده / فروشنده <span className="text-rose-600">*</span>
                </label>
                <div className="relative w-full min-w-0">
                  <input
                    type="text"
                    required
                    list="suppliers-list"
                    value={supplierName}
                    onChange={(e) => setSupplierName(e.target.value)}
                    placeholder="مثلاً شرکت بازرگانی سپهر..."
                    className="w-full min-w-0 box-border px-3.5 py-2.5 rounded-xl border border-slate-300/90 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-medium text-slate-800 placeholder:text-slate-400 transition-all text-xs sm:text-sm"
                  />
                  <datalist id="suppliers-list">
                    {previousSuppliers.map((s, idx) => (
                      <option key={idx} value={s} />
                    ))}
                  </datalist>
                </div>
              </div>

              {/* Invoice Number */}
              <div className="w-full min-w-0 flex flex-col">
                <label className="block font-bold text-slate-700 mb-1.5 flex items-center gap-1 leading-snug break-words">
                  <Hash className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span>شماره فاکتور خرید <span className="text-rose-600">*</span></span>
                </label>
                <input
                  type="text"
                  required
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  placeholder="PUR-1002"
                  className="w-full min-w-0 box-border px-3.5 py-2.5 rounded-xl border border-slate-300/90 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-mono font-bold text-slate-800 placeholder:text-slate-400 transition-all text-xs sm:text-sm text-left"
                />
              </div>

              {/* Invoice Date */}
              <div className="w-full min-w-0 flex flex-col">
                <label className="block font-bold text-slate-700 mb-1.5 flex items-center gap-1 leading-snug break-words">
                  <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span>تاریخ فاکتور خرید <span className="text-rose-600">*</span></span>
                </label>
                <input
                  type="text"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full min-w-0 box-border px-3.5 py-2.5 rounded-xl border border-slate-300/90 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-mono font-bold text-slate-800 transition-all text-xs sm:text-sm text-left"
                />
              </div>

              {/* Supplier Phone */}
              <div className="w-full min-w-0 flex flex-col">
                <label className="block font-medium text-slate-600 mb-1.5 flex items-center gap-1 leading-snug break-words">
                  <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span>تلفن تماس فروشنده:</span>
                </label>
                <input
                  type="text"
                  value={supplierPhone}
                  onChange={(e) => setSupplierPhone(e.target.value)}
                  placeholder="۰۲۱-۸۸۲۲۳۳۴۴"
                  className="w-full min-w-0 box-border px-3.5 py-2.5 rounded-xl border border-slate-300/90 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-mono text-slate-800 placeholder:text-slate-400 transition-all text-xs sm:text-sm text-left"
                />
              </div>

              {/* Economic Code / National ID */}
              <div className="w-full min-w-0 flex flex-col">
                <label className="block font-medium text-slate-600 mb-1.5 flex items-center gap-1 leading-snug break-words">
                  <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span>کد اقتصادی / شناسه ملی:</span>
                </label>
                <input
                  type="text"
                  value={supplierEconomicCode}
                  onChange={(e) => setSupplierEconomicCode(e.target.value)}
                  placeholder="کد ۱۰ الی ۱۲ رقمی"
                  className="w-full min-w-0 box-border px-3.5 py-2.5 rounded-xl border border-slate-300/90 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-mono text-slate-800 placeholder:text-slate-400 transition-all text-xs sm:text-sm text-left"
                />
              </div>

              {/* Due Date */}
              <div className="w-full min-w-0 flex flex-col">
                <label className="block font-medium text-slate-600 mb-1.5 flex items-center gap-1 leading-snug break-words">
                  <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span>تاریخ سررسید تسویه (اختیاری):</span>
                </label>
                <input
                  type="text"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  placeholder="۱۴۰۳/۰۸/۳۰"
                  className="w-full min-w-0 box-border px-3.5 py-2.5 rounded-xl border border-slate-300/90 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-mono text-slate-800 placeholder:text-slate-400 transition-all text-xs sm:text-sm text-left"
                />
              </div>

              {/* Supplier Address */}
              <div className="w-full min-w-0 flex flex-col sm:col-span-2 lg:col-span-3">
                <label className="block font-medium text-slate-600 mb-1.5 flex items-center gap-1 leading-snug break-words">
                  <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span>آدرس و مشخصات تامین‌کننده (اختیاری):</span>
                </label>
                <input
                  type="text"
                  value={supplierAddress}
                  onChange={(e) => setSupplierAddress(e.target.value)}
                  placeholder="آدرس دقیق انبار یا دفتر فروشنده..."
                  className="w-full min-w-0 box-border px-3.5 py-2.5 rounded-xl border border-slate-300/90 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-slate-800 placeholder:text-slate-400 transition-all text-xs sm:text-sm"
                />
              </div>
            </div>
          </div>

          {/* Items Section */}
          <div className="bg-white p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-200/90 shadow-2xs space-y-3.5 sm:space-y-4">
            <div className="flex flex-col xs:flex-row items-start xs:items-center justify-between gap-2.5 pb-2.5 border-b border-slate-100">
              <div className="text-xs sm:text-sm font-black text-slate-800 flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-teal-100 text-teal-800 flex items-center justify-center shrink-0">
                  <PackagePlus className="w-4 h-4" />
                </div>
                <span>اقلام و کالاهای فاکتور خرید</span>
                <span className="bg-slate-100 text-slate-700 font-bold px-2 py-0.5 rounded-lg text-[11px] font-mono border border-slate-200">
                  {toPersianDigits(items.length)} ردیف
                </span>
              </div>
              <div className="flex items-center gap-2 w-full xs:w-auto justify-end">
                <button
                  type="button"
                  onClick={() => setIsQuickProductModalOpen(true)}
                  className="flex-1 xs:flex-none flex items-center justify-center gap-1 text-xs px-3 py-2 rounded-xl bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200 transition-colors font-bold cursor-pointer"
                >
                  <PlusCircle className="w-3.5 h-3.5 text-emerald-600" />
                  <span>تعریف کالای جدید</span>
                </button>
                <button
                  type="button"
                  onClick={handleAddItem}
                  className="flex-1 xs:flex-none flex items-center justify-center gap-1 text-xs px-3 py-2 rounded-xl bg-slate-900 text-white hover:bg-slate-800 active:scale-97 transition-all font-bold cursor-pointer shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>افزودن ردیف</span>
                </button>
              </div>
            </div>

            {/* Desktop Table View (screens >= md) */}
            <div className="hidden md:block border border-slate-200/90 rounded-2xl overflow-hidden bg-white shadow-2xs">
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100/80 text-slate-700 border-b border-slate-200 font-bold">
                      <th className="p-3 text-center w-12">ردیف</th>
                      <th className="p-3 min-w-[220px]">انتخاب کالا</th>
                      <th className="p-3 text-center w-24">تعداد</th>
                      <th className="p-3 text-center w-20">واحد</th>
                      <th className="p-3 text-center min-w-[140px]">قیمت خرید واحد (تومان)</th>
                      <th className="p-3 text-center min-w-[110px]">تخفیف (تومان)</th>
                      <th className="p-3 text-center min-w-[130px]">جمع ردیف</th>
                      <th className="p-3 text-center w-12">حذف</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {items.map((item, index) => (
                      <tr
                        key={item.id}
                        className={`${
                          index % 2 === 1 ? 'bg-slate-50/60' : 'bg-white'
                        } hover:bg-emerald-50/40 transition-colors`}
                      >
                        <td className="p-3 text-center font-mono text-slate-500 font-bold">
                          {toPersianDigits(index + 1)}
                        </td>
                        <td className="p-3">
                          <select
                            value={item.productId}
                            onChange={(e) => handleProductSelect(index, e.target.value)}
                            className="w-full px-2.5 py-2 rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-xs font-bold text-slate-800 cursor-pointer"
                          >
                            <option value="" disabled>-- انتخاب کالا از انبار --</option>
                            {allAvailableProducts.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name} (کد: {p.code}) — موجودی فعلی: {toPersianDigits(p.stock)} {p.unit}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="p-3">
                          <input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => handleItemChange(index, 'quantity', parseInt(e.target.value) || 0)}
                            className="w-full px-2 py-2 text-center font-mono font-black rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-slate-900 text-sm"
                          />
                        </td>
                        <td className="p-3 text-center">
                          <span className="inline-block px-2 py-1 bg-slate-100 text-slate-600 rounded-lg font-medium text-[11px]">
                            {item.unit || 'عدد'}
                          </span>
                        </td>
                        <td className="p-3">
                          <input
                            type="number"
                            min="0"
                            step="1000"
                            value={item.buyPrice}
                            onChange={(e) => handleItemChange(index, 'buyPrice', parseInt(e.target.value) || 0)}
                            className="w-full px-2 py-2 text-center font-mono font-bold rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-slate-800 text-xs"
                          />
                        </td>
                        <td className="p-3">
                          <input
                            type="number"
                            min="0"
                            step="1000"
                            value={item.discount}
                            onChange={(e) => handleItemChange(index, 'discount', parseInt(e.target.value) || 0)}
                            className="w-full px-2 py-2 text-center font-mono rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-rose-600 font-bold text-xs"
                          />
                        </td>
                        <td className="p-3 text-center font-mono font-black text-slate-900 text-xs sm:text-sm">
                          {toPersianDigits(formatPrice(item.total))}
                        </td>
                        <td className="p-3 text-center">
                          <button
                            type="button"
                            disabled={items.length <= 1}
                            onClick={() => handleRemoveItem(index)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 disabled:opacity-25 rounded-xl hover:bg-rose-50 transition-colors cursor-pointer"
                            title="حذف ردیف"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile Card List View (screens < md) - Optimized for touch & small screens */}
            <div className="md:hidden space-y-3">
              {items.map((item, index) => (
                <div
                  key={item.id}
                  className="bg-slate-50/80 rounded-2xl p-3.5 border border-slate-200/90 shadow-2xs space-y-3"
                >
                  {/* Top Bar: Row Number + Product Select + Delete */}
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-emerald-600 text-white font-mono font-bold text-xs flex items-center justify-center shrink-0">
                      {toPersianDigits(index + 1)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <select
                        value={item.productId}
                        onChange={(e) => handleProductSelect(index, e.target.value)}
                        className="w-full px-2.5 py-2 rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-xs font-bold text-slate-800"
                      >
                        <option value="" disabled>-- انتخاب کالا --</option>
                        {allAvailableProducts.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} (کد: {p.code}) — موجودی: {toPersianDigits(p.stock)} {p.unit}
                          </option>
                        ))}
                      </select>
                    </div>
                    <button
                      type="button"
                      disabled={items.length <= 1}
                      onClick={() => handleRemoveItem(index)}
                      className="p-2 text-slate-400 hover:text-rose-600 disabled:opacity-20 rounded-xl hover:bg-rose-50 transition-colors shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* 2x2 Grid: Quantity, Buy Price, Discount, Total */}
                  <div className="grid grid-cols-2 gap-2.5 text-xs pt-1">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">
                        تعداد ({item.unit || 'عدد'}):
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => handleItemChange(index, 'quantity', parseInt(e.target.value) || 0)}
                        className="w-full px-3 py-2 text-center font-mono font-black rounded-xl border border-slate-300 bg-white text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">
                        قیمت خرید واحد (تومان):
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="1000"
                        value={item.buyPrice}
                        onChange={(e) => handleItemChange(index, 'buyPrice', parseInt(e.target.value) || 0)}
                        className="w-full px-3 py-2 text-center font-mono font-bold rounded-xl border border-slate-300 bg-white text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">
                        تخفیف ردیف (تومان):
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="1000"
                        value={item.discount}
                        onChange={(e) => handleItemChange(index, 'discount', parseInt(e.target.value) || 0)}
                        className="w-full px-3 py-2 text-center font-mono rounded-xl border border-slate-300 bg-white text-rose-600 font-bold text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">
                        جمع کل ردیف:
                      </label>
                      <div className="w-full px-3 py-2 bg-white rounded-xl border border-slate-200 text-center font-mono font-black text-emerald-800 text-xs flex items-center justify-center">
                        {toPersianDigits(formatPrice(item.total))} تومان
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Financials & Payment Configuration */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
            {/* Payment Options */}
            <div className="p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-slate-50/90 border border-slate-200/90 shadow-2xs text-xs space-y-3.5">
              <div className="font-bold text-slate-800 flex items-center justify-between pb-2.5 border-b border-slate-200/80">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-800 flex items-center justify-center shrink-0">
                    <CreditCard className="w-4 h-4" />
                  </div>
                  <span className="text-xs sm:text-sm font-black">روش و وضعیت پرداخت فاکتور خرید</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1.5">
                    وضعیت تسویه:
                  </label>
                  <select
                    value={paymentStatus}
                    onChange={(e) => handlePaymentStatusChange(e.target.value as PaymentStatus)}
                    className="w-full p-2.5 rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-bold text-slate-800"
                  >
                    <option value="paid">تسویه کامل (پرداخت شد)</option>
                    <option value="partial">پرداخت بیعانه / بخشی</option>
                    <option value="unpaid">نسیه / حساب دفتری</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1.5">
                    روش پرداخت:
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                    className="w-full p-2.5 rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-medium text-slate-800"
                  >
                    <option value="transfer">واریز به حساب / کارت به کارت</option>
                    <option value="pos">کارتخوان (POS)</option>
                    <option value="cash">نقدی</option>
                    <option value="cheque">چک بانکی</option>
                    <option value="credit">حساب دفتری / نسیه</option>
                  </select>
                </div>
              </div>

              {paymentStatus === 'partial' && (
                <div className="p-3 bg-amber-50/80 rounded-xl border border-amber-200 animate-in fade-in">
                  <label className="block font-bold text-amber-900 mb-1">
                    مبلغ پرداخت شده (تومان):
                  </label>
                  <input
                    type="number"
                    min="0"
                    max={finalTotal}
                    value={paidAmount}
                    onChange={(e) => setPaidAmount(parseInt(e.target.value) || 0)}
                    className="w-full p-2 font-mono font-bold rounded-xl border border-amber-300 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  <span className="text-[10px] text-amber-700 mt-1 block">
                    باقیمانده حساب به عنوان بدهی دفتری به تامین‌کننده منظور خواهد شد.
                  </span>
                </div>
              )}

              {paymentMethod === 'cheque' && (
                <div className="p-3.5 bg-amber-50/90 rounded-2xl border border-amber-200/90 space-y-2.5 text-xs animate-in fade-in">
                  <div className="font-extrabold text-amber-900 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-amber-700" />
                    <span>مشخصات چک صادره:</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder="شماره صیاد / شماره چک"
                      value={chequeNumber}
                      onChange={(e) => setChequeNumber(e.target.value)}
                      className="p-2 rounded-xl border border-amber-300 bg-white font-mono text-xs focus:outline-none focus:ring-1 focus:ring-amber-500 text-left"
                    />
                    <input
                      type="text"
                      placeholder="تاریخ سررسید چک (مثال: ۱۴۰۳/۰۹/۱۵)"
                      value={chequeDueDate}
                      onChange={(e) => setChequeDueDate(e.target.value)}
                      className="p-2 rounded-xl border border-amber-300 bg-white font-mono text-xs focus:outline-none focus:ring-1 focus:ring-amber-500 text-left"
                    />
                  </div>
                  <input
                    type="text"
                    placeholder="نام صاحب حساب / بانک عامل"
                    value={chequeName}
                    onChange={(e) => setChequeName(e.target.value)}
                    className="w-full p-2 rounded-xl border border-amber-300 bg-white text-xs focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>
              )}

              {paymentMethod === 'transfer' && (
                <div className="animate-in fade-in">
                  <label className="block font-medium text-slate-700 mb-1">
                    شماره پیگیری / توضیحات فیش واریزی:
                  </label>
                  <input
                    type="text"
                    value={transferDescription}
                    onChange={(e) => setTransferDescription(e.target.value)}
                    placeholder="مثلاً: شماره پیگیری ۷۸۴۵۱۲ بانک ملت"
                    className="w-full p-2.5 rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-xs"
                  />
                </div>
              )}

              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  توضیحات و شرایط فاکتور خرید:
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="توضیحات تکمیلی، شرایط تحویل کالا، ضمانت یا گارانتی اقلام..."
                  className="w-full p-2.5 rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-xs leading-relaxed"
                />
              </div>
            </div>

            {/* Totals & Extra Fees */}
            <div className="p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-slate-50/90 border border-slate-200/90 shadow-2xs text-xs space-y-3.5 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="font-bold text-slate-800 flex items-center gap-2 pb-2.5 border-b border-slate-200/80">
                  <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
                    <Calculator className="w-4 h-4" />
                  </div>
                  <span className="text-xs sm:text-sm font-black">محاسبه مبالغ، تخفیفات و هزینه‌ها</span>
                </div>

                <div className="space-y-2.5 pt-1">
                  <div className="flex items-center justify-between py-1 border-b border-slate-200/60">
                    <span className="text-slate-600 font-medium">جمع کل ناخالص اقلام:</span>
                    <span className="font-mono font-extrabold text-slate-800 text-sm">
                      {toPersianDigits(formatPrice(subtotal))} تومان
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <span className="text-slate-600 font-medium">تخفیف کلی فاکتور:</span>
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        step="1000"
                        value={overallDiscount}
                        onChange={(e) => setOverallDiscount(parseInt(e.target.value) || 0)}
                        className="w-36 text-center px-2 py-1.5 rounded-xl border border-slate-300 bg-white font-mono text-rose-600 font-bold focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 text-xs"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <span className="text-slate-600 font-medium">هزینه حمل و باربری:</span>
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        step="5000"
                        value={shippingCost}
                        onChange={(e) => setShippingCost(parseInt(e.target.value) || 0)}
                        placeholder="۰"
                        className="w-36 text-center px-2 py-1.5 rounded-xl border border-slate-300 bg-white font-mono text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-xs"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <span className="text-slate-600 font-medium">درصد مالیات / ارزش افزوده:</span>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={taxRate}
                        onChange={(e) => setTaxRate(parseInt(e.target.value) || 0)}
                        className="w-16 text-center px-2 py-1.5 rounded-xl border border-slate-300 bg-white font-mono font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-xs"
                      />
                      <span className="text-slate-500 font-bold">٪</span>
                    </div>
                  </div>

                  {taxAmount > 0 && (
                    <div className="flex items-center justify-between text-slate-600 py-1 border-b border-slate-200/60">
                      <span>مبلغ مالیات بر ارزش افزوده:</span>
                      <span className="font-mono font-bold text-slate-700">{toPersianDigits(formatPrice(taxAmount))} تومان</span>
                    </div>
                  )}

                  {/* Final Total Highlight */}
                  <div className="pt-2">
                    <div className="bg-emerald-50 rounded-2xl p-3.5 border border-emerald-200 flex items-center justify-between">
                      <span className="font-black text-slate-900 text-xs sm:text-sm">مبلغ قابل پرداخت فاکتور خرید:</span>
                      <span className="font-black text-emerald-800 font-mono text-base sm:text-lg">
                        {toPersianDigits(formatPrice(finalTotal))} تومان
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-3 p-3 rounded-2xl bg-emerald-50/70 border border-emerald-200/80 text-emerald-950 text-[11px] leading-relaxed flex items-start gap-2.5">
                <Truck className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                <span>
                  <strong>سیستم انبارداری هوشمند:</strong> پس از ثبت این فاکتور، سند حواله ورود کالا به صورت خودکار به انبارداری ارسال می‌شود تا انباردار تعداد فیزیکی را ارزیابی و تطبیق داده و به موجودی انبار اضافه نماید.
                </span>
              </div>
            </div>
          </div>

          {/* Action Buttons - Fully responsive */}
          <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2.5 pt-4 border-t border-slate-200/80 sticky bottom-0 bg-white/95 backdrop-blur-xs py-2">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl text-slate-600 hover:bg-slate-100 font-bold text-xs transition-colors cursor-pointer text-center"
            >
              انصراف
            </button>
            <button
              type="submit"
              className="flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white font-extrabold text-xs shadow-md shadow-emerald-600/20 transition-all cursor-pointer text-center"
            >
              <Check className="w-4 h-4 stroke-[2.5]" />
              <span>ثبت فاکتور خرید و صدور حواله ورود به انبار</span>
            </button>
          </div>
        </form>

        {/* Quick Product Creation Sub-Modal */}
        {isQuickProductModalOpen && (
          <div className="fixed inset-0 z-60 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-md rounded-2xl shadow-xl p-5 border border-slate-200 animate-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
                <h3 className="font-bold text-sm text-slate-900">
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
                    placeholder="مثلاً: کابل شارژ Type-C انکر"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-medium text-slate-600 mb-1">
                      دسته‌بندی:
                    </label>
                    <input
                      type="text"
                      value={newProductCategory}
                      onChange={(e) => setNewProductCategory(e.target.value)}
                      placeholder="لوازم جانبی"
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-slate-600 mb-1">
                      واحد شمارش:
                    </label>
                    <input
                      type="text"
                      value={newProductUnit}
                      onChange={(e) => setNewProductUnit(e.target.value)}
                      placeholder="عدد / بسته"
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      قیمت خرید (تومان):
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="1000"
                      value={newProductBuyPrice}
                      onChange={(e) => setNewProductBuyPrice(parseInt(e.target.value) || 0)}
                      className="w-full px-3 py-2 font-mono rounded-xl border border-slate-300 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      قیمت فروش (تومان):
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="1000"
                      value={newProductSellPrice}
                      onChange={(e) => setNewProductSellPrice(parseInt(e.target.value) || 0)}
                      placeholder="اختیاری"
                      className="w-full px-3 py-2 font-mono rounded-xl border border-slate-300 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
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
                    ثبت و افزودن به فاکتور
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
