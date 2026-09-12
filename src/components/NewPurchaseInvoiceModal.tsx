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
  PlusCircle
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
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {/* Top Section: Supplier & Header Details */}
          <div className="bg-slate-50 p-4 sm:p-5 rounded-2xl border border-slate-200 space-y-4">
            <div className="text-xs font-bold text-slate-700 flex items-center gap-1.5 pb-1 border-b border-slate-200">
              <Building2 className="w-4 h-4 text-emerald-600" />
              <span>اطلاعات تامین‌کننده و شماره فاکتور خرید</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  نام تامین‌کننده / فروشنده <span className="text-rose-600">*</span>:
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    list="suppliers-list"
                    value={supplierName}
                    onChange={(e) => setSupplierName(e.target.value)}
                    placeholder="مثلاً شرکت بازرگانی سپهر..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                  />
                  <datalist id="suppliers-list">
                    {previousSuppliers.map((s, idx) => (
                      <option key={idx} value={s} />
                    ))}
                  </datalist>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  شماره فاکتور خرید:
                </label>
                <input
                  type="text"
                  required
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  placeholder="PUR-1002"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  تاریخ فاکتور خرید:
                </label>
                <input
                  type="text"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-600 mb-1">
                  تلفن تماس فروشنده:
                </label>
                <input
                  type="text"
                  value={supplierPhone}
                  onChange={(e) => setSupplierPhone(e.target.value)}
                  placeholder="۰۲۱-۸۸۲۲۳۳۴۴"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono text-left"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-600 mb-1">
                  کد اقتصادی / شناسه ملی:
                </label>
                <input
                  type="text"
                  value={supplierEconomicCode}
                  onChange={(e) => setSupplierEconomicCode(e.target.value)}
                  placeholder="کد ۱۲ رقمی"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono text-left"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-600 mb-1">
                  تاریخ سررسید تسویه (اختیاری):
                </label>
                <input
                  type="text"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  placeholder="۱۴۰۳/۰۸/۳۰"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                />
              </div>

              <div className="sm:col-span-3">
                <label className="block font-medium text-slate-600 mb-1">
                  آدرس و مشخصات تامین‌کننده (اختیاری):
                </label>
                <input
                  type="text"
                  value={supplierAddress}
                  onChange={(e) => setSupplierAddress(e.target.value)}
                  placeholder="آدرس دقیق انبار یا دفتر فروشنده..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>
          </div>

          {/* Items Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <PackagePlus className="w-4 h-4 text-emerald-600" />
                <span>اقلام و کالاهای خریداری شده ({toPersianDigits(items.length)} ردیف)</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsQuickProductModalOpen(true)}
                  className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 transition-colors font-semibold cursor-pointer"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>تعریف کالای جدید</span>
                </button>
                <button
                  type="button"
                  onClick={handleAddItem}
                  className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-slate-900 text-white hover:bg-slate-800 transition-colors font-bold cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>افزودن ردیف</span>
                </button>
              </div>
            </div>

            {/* Items Table / Cards */}
            <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 border-b border-slate-200">
                      <th className="p-2.5 text-center w-10">ردیف</th>
                      <th className="p-2.5 min-w-[220px]">انتخاب کالا</th>
                      <th className="p-2.5 text-center w-24">تعداد</th>
                      <th className="p-2.5 text-center w-20">واحد</th>
                      <th className="p-2.5 text-center min-w-[140px]">قیمت خرید واحد (تومان)</th>
                      <th className="p-2.5 text-center min-w-[110px]">تخفیف (تومان)</th>
                      <th className="p-2.5 text-center min-w-[130px]">جمع ردیف</th>
                      <th className="p-2.5 text-center w-12">حذف</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {items.map((item, index) => (
                      <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="p-2.5 text-center font-mono text-slate-500">
                          {toPersianDigits(index + 1)}
                        </td>
                        <td className="p-2.5">
                          <select
                            value={item.productId}
                            onChange={(e) => handleProductSelect(index, e.target.value)}
                            className="w-full p-1.5 rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 text-xs font-medium"
                          >
                            <option value="" disabled>-- انتخاب کالا --</option>
                            {allAvailableProducts.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name} (کد: {p.code}) — موجودی: {p.stock} {p.unit}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="p-2.5">
                          <input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => handleItemChange(index, 'quantity', parseInt(e.target.value) || 0)}
                            className="w-full p-1.5 text-center font-mono font-bold rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                          />
                        </td>
                        <td className="p-2.5 text-center text-slate-600 font-medium">
                          {item.unit || 'عدد'}
                        </td>
                        <td className="p-2.5">
                          <input
                            type="number"
                            min="0"
                            step="1000"
                            value={item.buyPrice}
                            onChange={(e) => handleItemChange(index, 'buyPrice', parseInt(e.target.value) || 0)}
                            className="w-full p-1.5 text-center font-mono rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                          />
                        </td>
                        <td className="p-2.5">
                          <input
                            type="number"
                            min="0"
                            step="1000"
                            value={item.discount}
                            onChange={(e) => handleItemChange(index, 'discount', parseInt(e.target.value) || 0)}
                            className="w-full p-1.5 text-center font-mono rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 text-slate-600"
                          />
                        </td>
                        <td className="p-2.5 text-center font-mono font-bold text-slate-900">
                          {toPersianDigits(formatPrice(item.total))}
                        </td>
                        <td className="p-2.5 text-center">
                          <button
                            type="button"
                            disabled={items.length <= 1}
                            onClick={() => handleRemoveItem(index)}
                            className="p-1 text-slate-400 hover:text-rose-600 disabled:opacity-30 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
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
          </div>

          {/* Financials & Payment Configuration */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-2">
            {/* Payment Options */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs space-y-3">
              <div className="font-bold text-slate-700 flex items-center gap-1.5 pb-1 border-b border-slate-200">
                <CreditCard className="w-4 h-4 text-emerald-600" />
                <span>روش و وضعیت پرداخت فاکتور خرید</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-600 mb-1">
                    وضعیت تسویه:
                  </label>
                  <select
                    value={paymentStatus}
                    onChange={(e) => handlePaymentStatusChange(e.target.value as PaymentStatus)}
                    className="w-full p-2 rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-bold"
                  >
                    <option value="paid">تسویه کامل (پرداخت شد)</option>
                    <option value="partial">پرداخت بیعانه / بخشی</option>
                    <option value="unpaid">نسیه / حساب دفتری</option>
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-slate-600 mb-1">
                    روش پرداخت:
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                    className="w-full p-2 rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
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
                <div>
                  <label className="block font-medium text-slate-600 mb-1">
                    مبلغ پرداخت شده (تومان):
                  </label>
                  <input
                    type="number"
                    min="0"
                    max={finalTotal}
                    value={paidAmount}
                    onChange={(e) => setPaidAmount(parseInt(e.target.value) || 0)}
                    className="w-full p-2 font-mono rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              )}

              {paymentMethod === 'cheque' && (
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 space-y-2 text-xs">
                  <div className="font-bold text-amber-900">مشخصات چک صادره:</div>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder="شماره صیاد / شماره چک"
                      value={chequeNumber}
                      onChange={(e) => setChequeNumber(e.target.value)}
                      className="p-1.5 rounded-lg border border-amber-300 bg-white font-mono text-xs"
                    />
                    <input
                      type="text"
                      placeholder="تاریخ سررسید چک"
                      value={chequeDueDate}
                      onChange={(e) => setChequeDueDate(e.target.value)}
                      className="p-1.5 rounded-lg border border-amber-300 bg-white font-mono text-xs"
                    />
                  </div>
                  <input
                    type="text"
                    placeholder="نام صاحب حساب / بانک"
                    value={chequeName}
                    onChange={(e) => setChequeName(e.target.value)}
                    className="w-full p-1.5 rounded-lg border border-amber-300 bg-white text-xs"
                  />
                </div>
              )}

              {paymentMethod === 'transfer' && (
                <div>
                  <label className="block font-medium text-slate-600 mb-1">
                    شماره پیگیری / توضیحات فیش واریزی:
                  </label>
                  <input
                    type="text"
                    value={transferDescription}
                    onChange={(e) => setTransferDescription(e.target.value)}
                    placeholder="مثلاً: شماره پیگیری ۷۸۴۵۱۲ بانک ملت"
                    className="w-full p-2 rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              )}

              <div>
                <label className="block font-medium text-slate-600 mb-1">
                  توضیحات و شرایط فاکتور خرید:
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="توضیحات تکمیلی، شرایط تحویل، ضمانت یا گارانتی..."
                  className="w-full p-2 rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs"
                />
              </div>
            </div>

            {/* Totals & Extra Fees */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs space-y-3">
              <div className="font-bold text-slate-700 pb-1 border-b border-slate-200">
                محاسبه مبالغ و کسورات
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">جمع کل اقلام:</span>
                  <span className="font-mono font-bold text-slate-800">
                    {toPersianDigits(formatPrice(subtotal))} تومان
                  </span>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <span className="text-slate-600">تخفیف کلی فاکتور:</span>
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    value={overallDiscount}
                    onChange={(e) => setOverallDiscount(parseInt(e.target.value) || 0)}
                    className="w-36 text-center p-1 rounded-lg border border-slate-300 bg-white font-mono text-rose-600 font-bold"
                  />
                </div>

                <div className="flex items-center justify-between gap-3">
                  <span className="text-slate-600">هزینه حمل و باربری:</span>
                  <input
                    type="number"
                    min="0"
                    step="5000"
                    value={shippingCost}
                    onChange={(e) => setShippingCost(parseInt(e.target.value) || 0)}
                    placeholder="۰"
                    className="w-36 text-center p-1 rounded-lg border border-slate-300 bg-white font-mono"
                  />
                </div>

                <div className="flex items-center justify-between gap-3">
                  <span className="text-slate-600">درصد مالیات / ارزش افزوده:</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={taxRate}
                      onChange={(e) => setTaxRate(parseInt(e.target.value) || 0)}
                      className="w-16 text-center p-1 rounded-lg border border-slate-300 bg-white font-mono"
                    />
                    <span className="text-slate-500">٪</span>
                  </div>
                </div>

                {taxAmount > 0 && (
                  <div className="flex items-center justify-between text-slate-600">
                    <span>مبلغ مالیات:</span>
                    <span className="font-mono">{toPersianDigits(formatPrice(taxAmount))} تومان</span>
                  </div>
                )}

                <div className="pt-3 border-t-2 border-slate-300 flex items-center justify-between">
                  <span className="font-black text-slate-900 text-sm">مبلغ کل فاکتور خرید:</span>
                  <span className="font-black text-emerald-800 font-mono text-base">
                    {toPersianDigits(formatPrice(finalTotal))} تومان
                  </span>
                </div>
              </div>

              <div className="mt-3 p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-[11px] leading-relaxed flex items-start gap-2">
                <Truck className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                <span>
                  <strong>سیستم انبارداری هوشمند:</strong> با ثبت این فاکتور، یک حواله ورود در بخش انبارداری صادر می‌شود تا انباردار تعداد فیزیکی را بشمارد، مغایرت‌های احتمالی را ثبت کرده و موجودی را تایید نماید.
                </span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-slate-600 hover:bg-slate-100 font-bold text-xs transition-colors cursor-pointer"
            >
              انصراف
            </button>
            <button
              type="submit"
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md active:scale-95 transition-all cursor-pointer"
            >
              <Check className="w-4 h-4" />
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
