import React, { useState } from 'react';
import { Product, Customer, Invoice, InvoiceItem, StoreSettings, PaymentMethod } from '../types';
import { getCurrentJalaliDate, addDaysToJalali, formatPrice, toPersianDigits } from '../utils/jalali';
import { 
  Plus, 
  Trash2, 
  CheckCircle2, 
  Printer, 
  UserPlus, 
  AlertCircle, 
  ShoppingBag,
  RotateCcw,
  Sparkles,
  Banknote,
  FileCheck,
  Landmark,
  CreditCard,
  BookOpen,
  Calendar,
  Hash,
  User,
  HelpCircle
} from 'lucide-react';

interface InvoiceBuilderProps {
  products: Product[];
  customers: Customer[];
  settings: StoreSettings;
  onSaveInvoice: (invoice: Invoice, shouldPrint: boolean) => void;
  onAddNewCustomer: (customer: Omit<Customer, 'id' | 'createdAt'>) => Customer;
  onCancel?: () => void;
}

export const InvoiceBuilder: React.FC<InvoiceBuilderProps> = ({
  products,
  customers,
  settings,
  onSaveInvoice,
  onAddNewCustomer,
  onCancel,
}) => {
  // Generate a random / incremental invoice number
  const initialInvoiceNum = `INV-${Math.floor(1000 + Math.random() * 9000)}`;

  const [invoiceNumber, setInvoiceNumber] = useState<string>(initialInvoiceNum);
  const [invoiceType, setInvoiceType] = useState<'standard' | 'official' | 'thermal'>(settings.defaultTemplate || 'standard');
  const [invoiceDate, setInvoiceDate] = useState<string>(getCurrentJalaliDate());

  // Customer state
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [customerName, setCustomerName] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [customerAddress, setCustomerAddress] = useState<string>('');
  const [customerNationalId, setCustomerNationalId] = useState<string>('');
  const [isAddingNewCustomer, setIsAddingNewCustomer] = useState<boolean>(false);

  // Invoice Items
  const [items, setItems] = useState<InvoiceItem[]>([
    {
      id: 'row-1',
      productId: '',
      productName: '',
      productCode: '',
      unit: 'عدد',
      quantity: 1,
      unitPrice: 0,
      buyPrice: 0,
      discount: 0,
      total: 0,
    },
  ]);

  // Overall calculations & payment
  const [taxEnabled, setTaxEnabled] = useState<boolean>(settings.taxEnabled);
  const [taxRate, setTaxRate] = useState<number>(settings.taxPercent || 10);
  const [extraDiscount, setExtraDiscount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(() => {
    if (settings.enableCashPayment !== false) return 'cash';
    if (settings.enableChequePayment) return 'cheque';
    if (settings.enableTransferPayment !== false) return 'transfer';
    return 'cash';
  });
  const [paymentStatus, setPaymentStatus] = useState<'paid' | 'unpaid' | 'partial'>('paid');
  const [paidAmount, setPaidAmount] = useState<number>(0);
  const [notes, setNotes] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');

  // فیلدهای الزامی و مجاز چک (شماره چک، تاریخ سررسید، نام چک)
  const [chequeNumber, setChequeNumber] = useState<string>('');
  const [chequeDueDate, setChequeDueDate] = useState<string>('');
  const [chequeName, setChequeName] = useState<string>('');

  // فیلدهای الزامی و مجاز واریز به حساب (ثبت توضیحات)
  const [transferDescription, setTransferDescription] = useState<string>('');

  // Handle Customer Selection
  const handleCustomerSelect = (id: string) => {
    setSelectedCustomerId(id);
    if (!id) {
      setCustomerName('');
      setCustomerPhone('');
      setCustomerAddress('');
      setCustomerNationalId('');
      return;
    }
    const found = customers.find((c) => c.id === id);
    if (found) {
      setCustomerName(found.name);
      setCustomerPhone(found.phone || '');
      setCustomerAddress(found.address || '');
      setCustomerNationalId(found.nationalId || '');
    }
  };

  // Quick Save New Customer
  const handleSaveQuickCustomer = () => {
    if (!customerName.trim()) {
      setErrorMessage('لطفاً نام مشتری را وارد کنید');
      return;
    }
    const newCust = onAddNewCustomer({
      name: customerName.trim(),
      phone: customerPhone.trim(),
      address: customerAddress.trim(),
      nationalId: customerNationalId.trim(),
    });
    setSelectedCustomerId(newCust.id);
    setIsAddingNewCustomer(false);
  };

  // Handle Item row updates
  const handleProductSelect = (rowIndex: number, prodId: string) => {
    const selectedProd = products.find((p) => p.id === prodId);
    if (!selectedProd) return;

    setItems((prev) => {
      const updated = [...prev];
      const quantity = updated[rowIndex].quantity || 1;
      const unitPrice = selectedProd.sellPrice;
      const discount = updated[rowIndex].discount || 0;
      const total = Math.max(0, quantity * unitPrice - discount);

      updated[rowIndex] = {
        ...updated[rowIndex],
        productId: selectedProd.id,
        productName: selectedProd.name,
        productCode: selectedProd.code,
        unit: selectedProd.unit,
        unitPrice,
        buyPrice: selectedProd.buyPrice,
        quantity,
        discount,
        total,
      };
      return updated;
    });
  };

  const handleItemChange = (
    index: number,
    field: 'quantity' | 'unitPrice' | 'discount',
    val: number
  ) => {
    setItems((prev) => {
      const updated = [...prev];
      const item = { ...updated[index] };
      const safeVal = Math.max(0, isNaN(val) ? 0 : val);

      if (field === 'quantity') item.quantity = safeVal;
      if (field === 'unitPrice') item.unitPrice = safeVal;
      if (field === 'discount') item.discount = safeVal;

      item.total = Math.max(0, item.quantity * item.unitPrice - item.discount);
      updated[index] = item;
      return updated;
    });
  };

  const handleAddItemRow = () => {
    setItems((prev) => [
      ...prev,
      {
        id: `row-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
        productId: '',
        productName: '',
        productCode: '',
        unit: 'عدد',
        quantity: 1,
        unitPrice: 0,
        buyPrice: 0,
        discount: 0,
        total: 0,
      },
    ]);
  };

  const handleRemoveItemRow = (index: number) => {
    if (items.length === 1) {
      // Clear instead of removing last row
      setItems([
        {
          id: `row-${Date.now()}`,
          productId: '',
          productName: '',
          productCode: '',
          unit: 'عدد',
          quantity: 1,
          unitPrice: 0,
          buyPrice: 0,
          discount: 0,
          total: 0,
        },
      ]);
      return;
    }
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  // Calculations
  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const rowDiscounts = items.reduce((sum, item) => sum + item.discount, 0);
  const totalDiscount = rowDiscounts + extraDiscount;
  const taxableAmount = Math.max(0, subtotal - totalDiscount);
  const taxAmount = taxEnabled ? Math.round((taxableAmount * taxRate) / 100) : 0;
  const finalTotal = taxableAmount + taxAmount;

  // Auto set paidAmount if paid
  const handlePaymentStatusChange = (status: 'paid' | 'unpaid' | 'partial') => {
    setPaymentStatus(status);
    if (status === 'paid') {
      setPaidAmount(finalTotal);
    } else if (status === 'unpaid') {
      setPaidAmount(0);
    }
  };

  // Submit invoice
  const handleSubmit = (shouldPrint: boolean) => {
    setErrorMessage('');

    // Validation
    if (!customerName.trim()) {
      setErrorMessage('لطفاً نام خریدار یا مشتری را مشخص کنید.');
      return;
    }

    const validItems = items.filter((it) => it.productId && it.quantity > 0);
    if (validItems.length === 0) {
      setErrorMessage('حداقل یک قلم کالا با تعداد مشخص در فاکتور الزامی است.');
      return;
    }

    // Check stock warning
    const stockIssues: string[] = [];
    validItems.forEach((item) => {
      const prod = products.find((p) => p.id === item.productId);
      if (prod && item.quantity > prod.stock) {
        stockIssues.push(`موجودی کالا "${prod.name}" (${prod.stock} ${prod.unit}) کمتر از تعداد سفارش (${item.quantity}) است.`);
      }
    });

    if (stockIssues.length > 0 && settings.autoDeductStock) {
      if (settings.allowNegativeStock === false) {
        setErrorMessage(
          `خطای کنترل موجودی انبار: اجازه ثبت کالای ناموجود در پنل مدیریت غیرفعال است.\n${stockIssues.join('\n')}`
        );
        return;
      }
      const confirmContinue = window.confirm(
        `هشدار موجودی:\n${stockIssues.join('\n')}\n\nآیا با وجود کمبود موجودی، فاکتور ثبت و موجودی منفی شود؟`
      );
      if (!confirmContinue) return;
    }

    const newInvoice: Invoice = {
      id: `inv-${Date.now()}`,
      invoiceNumber: invoiceNumber.trim() || `INV-${Date.now().toString().slice(-4)}`,
      type: invoiceType,
      customerId: selectedCustomerId || 'guest',
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      customerAddress: customerAddress.trim(),
      customerNationalId: customerNationalId.trim(),
      date: invoiceDate,
      items: validItems,
      subtotal,
      totalDiscount,
      taxRate: taxEnabled ? taxRate : 0,
      taxAmount,
      finalTotal,
      paymentStatus,
      paymentMethod,
      paidAmount: paymentStatus === 'paid' ? finalTotal : paidAmount,
      // ثبت مشخصات چک (در صورت دریافت چکی)
      chequeNumber: paymentMethod === 'cheque' ? chequeNumber.trim() : undefined,
      chequeDueDate: paymentMethod === 'cheque' ? chequeDueDate.trim() : undefined,
      chequeName: paymentMethod === 'cheque' ? chequeName.trim() : undefined,
      // ثبت مشخصات واریز به حساب (در صورت واریز به حساب)
      transferDescription: paymentMethod === 'transfer' ? transferDescription.trim() : undefined,
      notes: notes.trim(),
      createdAt: new Date().toISOString(),
    };

    onSaveInvoice(newInvoice, shouldPrint || !!settings.autoPrintAfterSave);
  };

  return (
    <div className="max-w-7xl mx-auto pb-12">
      {/* Header Info */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-emerald-100 text-emerald-700">
              <ShoppingBag className="w-5 h-5" />
            </span>
            <h2 className="text-xl font-bold text-slate-800">صدور فاکتور فروش جدید</h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            با ثبت فاکتور، اقلام به صورت خودکار از انبار کسر شده و تاریخچه ثبت می‌شود.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl text-xs">
            <span className="text-slate-500 font-medium">شماره فاکتور:</span>
            <input
              type="text"
              id="invoice-number-input"
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
              className="font-bold text-slate-800 bg-white border border-slate-200 rounded-lg px-2 py-1 w-28 text-center text-xs focus:ring-1 focus:ring-emerald-500 outline-none"
            />
          </div>

          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl text-xs">
            <span className="text-slate-500 font-medium">تاریخ صدور:</span>
            <input
              type="text"
              id="invoice-date-input"
              value={invoiceDate}
              onChange={(e) => setInvoiceDate(e.target.value)}
              className="font-medium text-slate-800 bg-white border border-slate-200 rounded-lg px-2 py-1 w-24 text-center text-xs focus:ring-1 focus:ring-emerald-500 outline-none"
            />
          </div>
        </div>
      </div>

      {errorMessage && (
        <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-rose-500 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Grid: Customer Info & Items */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (Items Table + Details - 2 Cols) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Customer Selection Card */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                <span>مشخصات خریدار / مشتری</span>
              </h3>
              <button
                type="button"
                id="toggle-new-customer-btn"
                onClick={() => setIsAddingNewCustomer(!isAddingNewCustomer)}
                className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 flex items-center gap-1.5 py-1 px-2.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 transition-colors cursor-pointer"
              >
                <UserPlus className="w-3.5 h-3.5" />
                {isAddingNewCustomer ? 'انتخاب از لیست مشتریان' : 'تعریف مشتری جدید'}
              </button>
            </div>

            {!isAddingNewCustomer ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">
                    انتخاب مشتری از لیست:
                  </label>
                  <select
                    id="customer-dropdown-select"
                    value={selectedCustomerId}
                    onChange={(e) => handleCustomerSelect(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
                  >
                    <option value="">-- مشتری گذری / بدون پرونده --</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.phone ? `(${c.phone})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">
                    نام کامل مشتری یا شرکت:
                  </label>
                  <input
                    type="text"
                    id="customer-name-input"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="مثال: مهندس احمدی یا شرکت پارس"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">
                    شماره تماس / همراه:
                  </label>
                  <input
                    type="text"
                    id="customer-phone-input"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="مثال: ۰۹۱۲۳۴۵۶۷۸۹"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">
                    کد ملی / شناسه اقتصادی (اختیاری):
                  </label>
                  <input
                    type="text"
                    id="customer-nid-input"
                    value={customerNationalId}
                    onChange={(e) => setCustomerNationalId(e.target.value)}
                    placeholder="برای فاکتور رسمی"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">
                    آدرس خریدار:
                  </label>
                  <input
                    type="text"
                    id="customer-address-input"
                    value={customerAddress}
                    onChange={(e) => setCustomerAddress(e.target.value)}
                    placeholder="تهران، خیابان آزادی، پلاک ۱۰"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
                  />
                </div>
              </div>
            ) : (
              <div className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-200/70 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">نام مشتری *</label>
                    <input
                      type="text"
                      id="new-customer-name-field"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="نام شخص یا شرکت"
                      className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">شماره تماس</label>
                    <input
                      type="text"
                      id="new-customer-phone-field"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      placeholder="۰۹۱۲..."
                      className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">کد ملی / اقتصادی</label>
                    <input
                      type="text"
                      id="new-customer-nid-field"
                      value={customerNationalId}
                      onChange={(e) => setCustomerNationalId(e.target.value)}
                      placeholder="شناسه ملی"
                      className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">آدرس کامل</label>
                    <input
                      type="text"
                      id="new-customer-addr-field"
                      value={customerAddress}
                      onChange={(e) => setCustomerAddress(e.target.value)}
                      placeholder="نشانی پستی"
                      className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsAddingNewCustomer(false)}
                    className="px-3 py-1.5 text-xs text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer"
                  >
                    انصراف
                  </button>
                  <button
                    type="button"
                    id="save-new-customer-btn"
                    onClick={handleSaveQuickCustomer}
                    className="px-4 py-1.5 text-xs font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 cursor-pointer flex items-center gap-1.5"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    ثبت و ذخیره در دفتر مشتریان
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Items Table Card */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-slate-800 text-sm">اقلام و کالاهای فاکتور</h3>
                <p className="text-xs text-slate-500">کالاهای مورد نظر را انتخاب و تعداد و تخفیف را وارد کنید</p>
              </div>
              <button
                type="button"
                id="add-item-row-btn"
                onClick={handleAddItemRow}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 text-slate-700 text-xs font-semibold rounded-lg border border-slate-200 transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4 text-emerald-600" />
                افزودن سطر جدید
              </button>
            </div>

            {/* Items List */}
            <div className="space-y-3">
              {items.map((item, index) => {
                const selectedProd = products.find((p) => p.id === item.productId);
                const isOverStock = selectedProd && item.quantity > selectedProd.stock;
                const isLowStock = selectedProd && selectedProd.stock <= selectedProd.minStockAlert;

                return (
                  <div
                    key={item.id}
                    className={`p-3.5 rounded-xl border transition-all ${
                      isOverStock
                        ? 'bg-rose-50/40 border-rose-300'
                        : 'bg-slate-50/70 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="grid grid-cols-12 gap-3 items-end">
                      {/* Product Selector */}
                      <div className="col-span-12 lg:col-span-5">
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="text-xs font-semibold text-slate-700">
                            ردیف {index + 1}: انتخاب کالا
                          </label>
                          {selectedProd && (
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                                selectedProd.stock === 0
                                  ? 'bg-rose-100 text-rose-700'
                                  : isLowStock
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-emerald-100 text-emerald-800'
                              }`}
                            >
                              موجودی: {toPersianDigits(selectedProd.stock)} {selectedProd.unit}
                            </span>
                          )}
                        </div>
                        <select
                          id={`product-select-row-${index}`}
                          value={item.productId}
                          onChange={(e) => handleProductSelect(index, e.target.value)}
                          className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2.5 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-medium"
                        >
                          <option value="">-- انتخاب کالا از انبار --</option>
                          {products.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} (کد: {p.code} | موجودی: {p.stock} | فی: {formatPrice(p.sellPrice, '', false)})
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Quantity with touch-friendly Stepper */}
                      <div className="col-span-12 sm:col-span-4 lg:col-span-2">
                        <label className="block text-[11px] font-medium text-slate-600 mb-1">
                          تعداد ({item.unit || 'واحد'})
                        </label>
                        <div className="flex items-center">
                          <button
                            type="button"
                            onClick={() => handleItemChange(index, 'quantity', Math.max(1, item.quantity - 1))}
                            className="w-10 h-9 bg-slate-100 active:bg-slate-200 text-slate-700 rounded-r-xl flex items-center justify-center font-bold text-base border border-l-0 border-slate-300 cursor-pointer select-none"
                            title="کاهش تعداد"
                          >
                            -
                          </button>
                          <input
                            type="number"
                            id={`quantity-input-row-${index}`}
                            min="1"
                            value={item.quantity}
                            onChange={(e) => handleItemChange(index, 'quantity', parseInt(e.target.value, 10) || 1)}
                            className={`w-full h-9 bg-white border text-center font-black text-xs outline-none ${
                              isOverStock
                                ? 'border-rose-400 text-rose-700'
                                : 'border-slate-300 text-slate-800 focus:border-emerald-500'
                            }`}
                          />
                          <button
                            type="button"
                            onClick={() => handleItemChange(index, 'quantity', item.quantity + 1)}
                            className="w-10 h-9 bg-slate-100 active:bg-slate-200 text-slate-700 rounded-l-xl flex items-center justify-center font-bold text-base border border-r-0 border-slate-300 cursor-pointer select-none"
                            title="افزایش تعداد"
                          >
                            +
                          </button>
                        </div>
                      </div>

                      {/* Unit Price */}
                      <div className="col-span-6 sm:col-span-4 lg:col-span-2">
                        <label className="block text-[11px] font-medium text-slate-600 mb-1">
                          قیمت واحد ({settings.currency})
                        </label>
                        <input
                          type="number"
                          id={`unitprice-input-row-${index}`}
                          value={item.unitPrice}
                          onChange={(e) => handleItemChange(index, 'unitPrice', parseFloat(e.target.value) || 0)}
                          className="w-full h-9 bg-white border border-slate-300 rounded-xl px-2.5 text-xs text-center font-semibold text-slate-800 outline-none focus:border-emerald-500"
                        />
                      </div>

                      {/* Discount */}
                      <div className="col-span-4 sm:col-span-3 lg:col-span-2">
                        <label className="block text-[11px] font-medium text-slate-600 mb-1">
                          تخفیف ({settings.currency})
                        </label>
                        <input
                          type="number"
                          id={`discount-input-row-${index}`}
                          value={item.discount}
                          onChange={(e) => handleItemChange(index, 'discount', parseFloat(e.target.value) || 0)}
                          className="w-full h-9 bg-white border border-slate-300 rounded-xl px-2 text-xs text-center text-slate-800 outline-none focus:border-emerald-500"
                        />
                      </div>

                      {/* Delete Action */}
                      <div className="col-span-2 sm:col-span-1 flex justify-center pb-0.5">
                        <button
                          type="button"
                          id={`remove-row-btn-${index}`}
                          onClick={() => handleRemoveItemRow(index)}
                          title="حذف این ردیف"
                          className="h-9 w-9 flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 active:bg-rose-100 rounded-xl border border-slate-200 hover:border-rose-200 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Row Total preview */}
                    <div className="mt-2 pt-2 border-t border-slate-200/60 flex items-center justify-between text-xs">
                      <span className="text-slate-500">
                        {item.productName ? item.productName : 'نامشخص'}
                        {isOverStock && (
                          <span className="text-rose-600 mr-2 font-medium">
                            (توجه: تعداد انتخابی بیشتر از موجودی انبار است!)
                          </span>
                        )}
                      </span>
                      <span className="font-bold text-slate-800">
                        مبلغ ردیف: {formatPrice(item.total, settings.currency)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Notes Section */}
            <div className="mt-5">
              <label className="block text-xs font-medium text-slate-600 mb-1.5">
                توضیحات و شرایط اختصاصی این فاکتور (چاپ در ذیل فاکتور):
              </label>
              <textarea
                id="invoice-notes-input"
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="توضیحات مربوط به نحوه تحویل، مهلت تست، گارانتی یا هماهنگی..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
            </div>
          </div>
        </div>

        {/* Right Column: Invoice Totals, Payment & Final Actions (1 Col) */}
        <div className="space-y-6">
          {/* Summary & Calculations Card */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
            <h3 className="font-bold text-slate-800 text-sm mb-4 pb-3 border-b border-slate-100 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-600" />
              <span>محاسبه مالی و مبالغ فاکتور</span>
            </h3>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between items-center text-slate-600">
                <span>جمع اقلام (بدون تخفیف):</span>
                <span className="font-semibold text-slate-800">{formatPrice(subtotal, settings.currency)}</span>
              </div>

              <div className="flex justify-between items-center text-slate-600">
                <span>مجموع تخفیف اقلام:</span>
                <span className="font-semibold text-rose-600">-{formatPrice(rowDiscounts, settings.currency)}</span>
              </div>

              {/* Extra overall discount */}
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                <span className="text-slate-600">تخفیف کلی پای فاکتور:</span>
                <input
                  type="number"
                  id="extra-discount-input"
                  min="0"
                  value={extraDiscount}
                  onChange={(e) => setExtraDiscount(parseFloat(e.target.value) || 0)}
                  className="w-28 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs text-center font-medium outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              {/* VAT Tax Toggle */}
              <div className="pt-2 border-t border-slate-100 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      id="vat-tax-checkbox"
                      checked={taxEnabled}
                      onChange={(e) => setTaxEnabled(e.target.checked)}
                      className="rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                    />
                    <span className="text-slate-700 font-medium">محاسبه مالیات بر ارزش افزوده</span>
                  </label>
                  {taxEnabled && (
                    <div className="flex items-center gap-1 text-[11px] text-slate-500">
                      <span>نرخ:</span>
                      <input
                        type="number"
                        id="vat-tax-rate-input"
                        value={taxRate}
                        onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)}
                        className="w-12 bg-slate-50 border border-slate-200 rounded-md px-1 py-0.5 text-center text-xs"
                      />
                      <span>٪</span>
                    </div>
                  )}
                </div>

                {taxEnabled && (
                  <div className="flex justify-between items-center text-slate-600 pr-5">
                    <span>مبلغ ارزش افزوده ({toPersianDigits(taxRate)}٪):</span>
                    <span className="font-semibold text-slate-800">{formatPrice(taxAmount, settings.currency)}</span>
                  </div>
                )}
              </div>

              {/* Final Amount Total */}
              <div className="mt-4 pt-4 border-t-2 border-slate-200 bg-emerald-50/60 -mx-5 px-5 py-3 rounded-b-xl flex flex-col gap-1">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-extrabold text-slate-900">مبلغ نهایی فاکتور:</span>
                  <span className="text-base font-black text-emerald-700">
                    {formatPrice(finalTotal, settings.currency)}
                  </span>
                </div>
                <p className="text-[10px] text-slate-500">
                  شامل تخفیفات و مالیات نهایی
                </p>
              </div>
            </div>
          </div>

          {/* Payment Status & Details */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
            <h3 className="font-bold text-slate-800 text-sm pb-2 border-b border-slate-100">
              نحوه تسویه و وضعیت پرداخت
            </h3>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">وضعیت پرداخت:</label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  id="status-paid-btn"
                  onClick={() => handlePaymentStatusChange('paid')}
                  className={`py-2 text-xs font-semibold rounded-xl border transition-all cursor-pointer ${
                    paymentStatus === 'paid'
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  تسویه کامل
                </button>
                <button
                  type="button"
                  id="status-partial-btn"
                  onClick={() => handlePaymentStatusChange('partial')}
                  className={`py-2 text-xs font-semibold rounded-xl border transition-all cursor-pointer ${
                    paymentStatus === 'partial'
                      ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  بیعانه / قسطی
                </button>
                <button
                  type="button"
                  id="status-unpaid-btn"
                  onClick={() => handlePaymentStatusChange('unpaid')}
                  className={`py-2 text-xs font-semibold rounded-xl border transition-all cursor-pointer ${
                    paymentStatus === 'unpaid'
                      ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  نسیه (تسویه نشده)
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-2">روش دریافت وجه:</label>
              
              {/* Payment Method Quick Selector Buttons */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
                {/* 1. چک */}
                {settings.enableChequePayment !== false && (
                  <button
                    type="button"
                    id="payment-method-cheque-btn"
                    onClick={() => setPaymentMethod('cheque')}
                    className={`flex items-center justify-center gap-1.5 p-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      paymentMethod === 'cheque'
                        ? 'bg-sky-600 text-white border-sky-600 shadow-xs ring-2 ring-sky-300'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-sky-50 hover:border-sky-300'
                    }`}
                  >
                    <FileCheck className="w-3.5 h-3.5" />
                    <span>چک بانکی</span>
                  </button>
                )}

                {/* 2. نقدی */}
                {settings.enableCashPayment !== false && (
                  <button
                    type="button"
                    id="payment-method-cash-btn"
                    onClick={() => setPaymentMethod('cash')}
                    className={`flex items-center justify-center gap-1.5 p-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      paymentMethod === 'cash'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs ring-2 ring-emerald-300'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-emerald-50 hover:border-emerald-300'
                    }`}
                  >
                    <Banknote className="w-3.5 h-3.5" />
                    <span>نقدی</span>
                  </button>
                )}

                {/* 3. واریز به حساب */}
                {settings.enableTransferPayment !== false && (
                  <button
                    type="button"
                    id="payment-method-transfer-btn"
                    onClick={() => setPaymentMethod('transfer')}
                    className={`flex items-center justify-center gap-1.5 p-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      paymentMethod === 'transfer'
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs ring-2 ring-indigo-300'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-indigo-50 hover:border-indigo-300'
                    }`}
                  >
                    <Landmark className="w-3.5 h-3.5" />
                    <span>واریز به حساب</span>
                  </button>
                )}

                {/* 4. دستگاه کارتخوان POS */}
                {settings.enablePosPayment && (
                  <button
                    type="button"
                    id="payment-method-pos-btn"
                    onClick={() => setPaymentMethod('pos')}
                    className={`flex items-center justify-center gap-1.5 p-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      paymentMethod === 'pos'
                        ? 'bg-teal-600 text-white border-teal-600 shadow-xs ring-2 ring-teal-300'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-teal-50 hover:border-teal-300'
                    }`}
                  >
                    <CreditCard className="w-3.5 h-3.5" />
                    <span>کارتخوان (POS)</span>
                  </button>
                )}

                {/* 5. حساب دفتری / نسیه */}
                {settings.enableCreditPayment && (
                  <button
                    type="button"
                    id="payment-method-credit-btn"
                    onClick={() => setPaymentMethod('credit')}
                    className={`flex items-center justify-center gap-1.5 p-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      paymentMethod === 'credit'
                        ? 'bg-amber-600 text-white border-amber-600 shadow-xs ring-2 ring-amber-300'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-amber-50 hover:border-amber-300'
                    }`}
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>حساب دفتری</span>
                  </button>
                )}
              </div>

              {/* Amount input alongside method */}
              <div className="mb-3">
                <label className="block text-xs font-medium text-slate-600 mb-1">مبلغ دریافتی:</label>
                <input
                  type="number"
                  id="paid-amount-input"
                  value={paymentStatus === 'paid' ? finalTotal : paidAmount}
                  disabled={paymentStatus === 'paid'}
                  onChange={(e) => setPaidAmount(parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-50 disabled:bg-slate-100 border border-slate-200 rounded-xl px-2.5 py-2 text-xs text-slate-800 font-bold outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              {/* DYNAMIC SUB-PANELS BASED ON PAYMENT METHOD */}
              {/* 1. چک: شماره چک، تاریخ سررسید و نام چک */}
              {paymentMethod === 'cheque' && (
                <div className="bg-sky-50/70 border border-sky-200 rounded-xl p-3.5 space-y-3 transition-all animate-fadeIn">
                  <div className="flex items-center justify-between pb-2 border-b border-sky-200/70">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-sky-900">
                      <FileCheck className="w-4 h-4 text-sky-600" />
                      <span>مشخصات چک دریافتی</span>
                    </div>
                    <span className="text-[10px] text-sky-700 bg-sky-100 px-2 py-0.5 rounded-md font-semibold">
                      ثبت در فاکتور و کاردکس
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    {/* فیلد ۱: شماره چک */}
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1 flex items-center gap-1">
                        <Hash className="w-3 h-3 text-sky-600" />
                        <span>شماره چک *</span>
                      </label>
                      <input
                        type="text"
                        id="invoice-cheque-number-input"
                        value={chequeNumber}
                        onChange={(e) => setChequeNumber(e.target.value)}
                        placeholder="شماره صیادی یا سریال چک"
                        className="w-full bg-white border border-sky-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 font-medium"
                      />
                    </div>

                    {/* فیلد ۲: تاریخ سررسید چک */}
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1 flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-sky-600" />
                        <span>تاریخ چک *</span>
                      </label>
                      <input
                        type="text"
                        id="invoice-cheque-duedate-input"
                        value={chequeDueDate}
                        onChange={(e) => setChequeDueDate(e.target.value)}
                        placeholder="مثال: ۱۴۰۳/۰۹/۲۰"
                        className="w-full bg-white border border-sky-300 rounded-lg px-2 py-1.5 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 text-center font-bold"
                      />
                      {/* میانبرهای تاریخ سریع */}
                      <div className="flex items-center justify-between gap-1 mt-1 text-[10px]">
                        <button
                          type="button"
                          onClick={() => setChequeDueDate(getCurrentJalaliDate())}
                          className="text-sky-700 hover:bg-sky-200/60 px-1 py-0.5 rounded cursor-pointer transition-colors"
                        >
                          امروز
                        </button>
                        <button
                          type="button"
                          onClick={() => setChequeDueDate(addDaysToJalali(30))}
                          className="text-sky-700 hover:bg-sky-200/60 px-1 py-0.5 rounded cursor-pointer transition-colors"
                        >
                          +۳۰ روز
                        </button>
                        <button
                          type="button"
                          onClick={() => setChequeDueDate(addDaysToJalali(60))}
                          className="text-sky-700 hover:bg-sky-200/60 px-1 py-0.5 rounded cursor-pointer transition-colors"
                        >
                          +۶۰ روز
                        </button>
                        <button
                          type="button"
                          onClick={() => setChequeDueDate(addDaysToJalali(90))}
                          className="text-sky-700 hover:bg-sky-200/60 px-1 py-0.5 rounded cursor-pointer transition-colors"
                        >
                          +۹۰ روز
                        </button>
                      </div>
                    </div>

                    {/* فیلد ۳: نام چک */}
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1 flex items-center gap-1">
                        <User className="w-3 h-3 text-sky-600" />
                        <span>نام چک (صاحب حساب/بانک) *</span>
                      </label>
                      <input
                        type="text"
                        id="invoice-cheque-name-input"
                        value={chequeName}
                        onChange={(e) => setChequeName(e.target.value)}
                        placeholder="بانک ملت - به نام علی احمدی"
                        className="w-full bg-white border border-sky-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 font-medium"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* 2. واریز به حساب: ثبت توضیحات */}
              {paymentMethod === 'transfer' && (
                <div className="bg-indigo-50/70 border border-indigo-200 rounded-xl p-3.5 space-y-2 transition-all animate-fadeIn">
                  <div className="flex items-center justify-between pb-1.5 border-b border-indigo-200/70">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-900">
                      <Landmark className="w-4 h-4 text-indigo-600" />
                      <span>مشخصات واریز به حساب / کارت به کارت</span>
                    </div>
                    <span className="text-[10px] text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-md font-semibold">
                      حواله / پایا / ساتنا
                    </span>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      ثبت توضیحات واریز به حساب (شماره پیگیری، ارجاع، نام بانک، شماره فیش و ...):
                    </label>
                    <textarea
                      id="invoice-transfer-description-input"
                      rows={2}
                      value={transferDescription}
                      onChange={(e) => setTransferDescription(e.target.value)}
                      placeholder="مثال: واریز به شماره حساب سامان - شماره پیگیری: ۹۸۷۶۵۴۳۲۱ - واریز کننده: آقای علوی"
                      className="w-full bg-white border border-indigo-300 rounded-lg p-2 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium"
                    />
                  </div>
                </div>
              )}

              {/* 3. نقدی */}
              {paymentMethod === 'cash' && (
                <div className="bg-emerald-50/60 border border-emerald-200 rounded-xl p-3 flex items-center gap-2 text-xs text-emerald-800">
                  <Banknote className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>دریافت وجه به صورت <strong>نقد</strong> در صندوق فروشگاه ثبت می‌شود.</span>
                </div>
              )}
            </div>

            {paymentStatus === 'partial' && (
              <div className="p-2.5 rounded-xl bg-amber-50 text-amber-800 text-xs border border-amber-200 flex justify-between">
                <span>مانده بدهی مشتری:</span>
                <span className="font-bold">{formatPrice(Math.max(0, finalTotal - paidAmount), settings.currency)}</span>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="space-y-3 pt-2">
            <button
              type="button"
              id="save-and-print-invoice-btn"
              onClick={() => handleSubmit(true)}
              className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white rounded-xl text-sm font-bold shadow-md shadow-emerald-200 flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>ثبت فاکتور و چاپ فوری</span>
            </button>

            <button
              type="button"
              id="save-invoice-only-btn"
              onClick={() => handleSubmit(false)}
              className="w-full py-2.5 px-4 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>فقط ثبت در سیستم و کسر از انبار</span>
            </button>

            {onCancel && (
              <button
                type="button"
                id="cancel-invoice-builder-btn"
                onClick={onCancel}
                className="w-full py-2 text-slate-500 hover:text-slate-800 text-xs flex items-center justify-center gap-1 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>انصراف و بازگشت</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Sticky Mobile Summary & Checkout Bar (Shown only on small screens) */}
      <div className="sm:hidden fixed bottom-[57px] left-0 right-0 z-30 bg-white/95 backdrop-blur-md border-t border-slate-200/90 px-3 py-2 shadow-[0_-3px_12px_rgba(0,0,0,0.06)] flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <span className="text-[10px] text-slate-500 block leading-tight">مبلغ نهایی:</span>
          <span className="text-xs font-black text-emerald-700 truncate block">
            {formatPrice(finalTotal, settings.currency)}
          </span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => handleSubmit(false)}
            className="px-3 py-2 bg-slate-100 active:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold border border-slate-300 active:scale-95 cursor-pointer"
          >
            ثبت
          </button>
          <button
            type="button"
            onClick={() => handleSubmit(true)}
            className="px-3.5 py-2 bg-emerald-600 active:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1 active:scale-95 cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>ثبت و چاپ</span>
          </button>
        </div>
      </div>
    </div>
  );
};
