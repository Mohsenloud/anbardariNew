import React, { useState, useMemo } from 'react';
import {
  X,
  FileSpreadsheet,
  Download,
  Search,
  User,
  Phone,
  MapPin,
  CreditCard,
  Truck,
  CheckCircle2,
  Clock,
  Calendar,
  Filter,
  Package,
  FileText,
  AlertCircle,
  Eye,
  Check
} from 'lucide-react';
import { Customer, Invoice, ExitSlipData, StoreSettings } from '../types';
import { exportPersonInvoicesAndExitSlipsToExcel } from '../utils/excelHelper';
import { formatPrice, toPersianDigits, getCurrentJalaliDate } from '../utils/jalali';
import { StorageService } from '../utils/storage';

interface CustomerExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  customers: Customer[];
  invoices: Invoice[];
  exitSlipLogs?: Record<string, ExitSlipData>;
  initialCustomerId?: string | null;
  settings: StoreSettings;
}

export const CustomerExportModal: React.FC<CustomerExportModalProps> = ({
  isOpen,
  onClose,
  customers,
  invoices,
  exitSlipLogs: propExitSlipLogs,
  initialCustomerId,
  settings,
}) => {
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(initialCustomerId || '');
  const [customerSearch, setCustomerSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [docTypeFilter, setDocTypeFilter] = useState<'all' | 'regular' | 'proforma'>('all');
  const [deliveryFilter, setDeliveryFilter] = useState<'all' | 'delivered' | 'pending'>('all');
  const [activePreviewTab, setActivePreviewTab] = useState<'invoices' | 'slips'>('invoices');
  const [downloadSuccessMessage, setDownloadSuccessMessage] = useState<string | null>(null);

  // Sync initialCustomerId when modal opens
  React.useEffect(() => {
    if (initialCustomerId) {
      setSelectedCustomerId(initialCustomerId);
    } else if (customers.length > 0 && !selectedCustomerId) {
      setSelectedCustomerId(customers[0].id);
    }
  }, [initialCustomerId, isOpen, customers]);

  // Logs source
  const exitSlipLogs = useMemo(() => {
    return propExitSlipLogs || StorageService.getExitSlipLogs();
  }, [propExitSlipLogs]);

  // Combine customers with any unregistered customer names from invoices
  const combinedCustomers = useMemo(() => {
    const list = [...customers];
    const existingIds = new Set(customers.map((c) => c.id));
    const existingNames = new Set(customers.map((c) => c.name.trim().toLowerCase()));

    invoices.forEach((inv) => {
      const invName = inv.customerName?.trim();
      if (invName && !existingNames.has(invName.toLowerCase())) {
        const dummyCustomer: Customer = {
          id: inv.customerId || `unregistered-${invName}`,
          name: invName,
          phone: inv.customerPhone || '',
          nationalId: inv.customerNationalId || '',
          address: inv.customerAddress || '',
          createdAt: inv.date || '',
          notes: 'مشتری ثبت‌شده در فاکتور',
        };
        list.push(dummyCustomer);
        existingNames.add(invName.toLowerCase());
      }
    });

    return list;
  }, [customers, invoices]);

  // Filtered customer list for selector
  const filteredCustomerList = useMemo(() => {
    if (!customerSearch.trim()) return combinedCustomers;
    const q = customerSearch.trim().toLowerCase();
    return combinedCustomers.filter((c) =>
      c.name.toLowerCase().includes(q) ||
      (c.phone && c.phone.includes(q)) ||
      (c.nationalId && c.nationalId.includes(q))
    );
  }, [combinedCustomers, customerSearch]);

  // Selected customer object
  const currentCustomer = useMemo(() => {
    return combinedCustomers.find((c) => c.id === selectedCustomerId) || combinedCustomers[0] || null;
  }, [combinedCustomers, selectedCustomerId]);

  // All invoices belonging to this customer
  const customerInvoices = useMemo(() => {
    if (!currentCustomer) return [];
    return invoices.filter((inv) =>
      (inv.customerId && inv.customerId === currentCustomer.id) ||
      (inv.customerName && inv.customerName.trim().toLowerCase() === currentCustomer.name.trim().toLowerCase())
    );
  }, [invoices, currentCustomer]);

  // Invoices after applying user filters
  const filteredCustomerInvoices = useMemo(() => {
    let result = [...customerInvoices];

    if (dateFrom.trim()) {
      result = result.filter((i) => i.date >= dateFrom.trim());
    }
    if (dateTo.trim()) {
      result = result.filter((i) => i.date <= dateTo.trim());
    }
    if (docTypeFilter === 'regular') {
      result = result.filter((i) => !i.isProforma);
    } else if (docTypeFilter === 'proforma') {
      result = result.filter((i) => !!i.isProforma);
    }
    if (deliveryFilter === 'delivered') {
      result = result.filter((i) => Boolean(exitSlipLogs[i.id]?.isDelivered));
    } else if (deliveryFilter === 'pending') {
      result = result.filter((i) => !Boolean(exitSlipLogs[i.id]?.isDelivered));
    }

    result.sort((a, b) => b.date.localeCompare(a.date));
    return result;
  }, [customerInvoices, dateFrom, dateTo, docTypeFilter, deliveryFilter, exitSlipLogs]);

  // Stats calculation
  const stats = useMemo(() => {
    const totalInvoices = filteredCustomerInvoices.length;
    const regularInvoices = filteredCustomerInvoices.filter((i) => !i.isProforma).length;
    const proformaInvoices = filteredCustomerInvoices.filter((i) => !!i.isProforma).length;
    const totalSubtotal = filteredCustomerInvoices.reduce((s, i) => s + (i.subtotal || 0), 0);
    const totalDiscount = filteredCustomerInvoices.reduce((s, i) => s + (i.totalDiscount || 0), 0);
    const totalFinal = filteredCustomerInvoices.reduce((s, i) => s + (i.finalTotal || 0), 0);
    const totalPaid = filteredCustomerInvoices.reduce((s, i) => s + (i.paidAmount || 0), 0);
    const balanceDue = Math.max(0, totalFinal - totalPaid);

    let deliveredSlips = 0;
    let pendingSlips = 0;
    let totalItemsCount = 0;
    let totalPhysicalQty = 0;

    filteredCustomerInvoices.forEach((inv) => {
      const slip = exitSlipLogs[inv.id];
      if (slip?.isDelivered) {
        deliveredSlips++;
      } else {
        pendingSlips++;
      }
      inv.items.forEach((it) => {
        totalItemsCount++;
        totalPhysicalQty += (Number(it.quantity) || 0);
      });
    });

    return {
      totalInvoices,
      regularInvoices,
      proformaInvoices,
      totalSubtotal,
      totalDiscount,
      totalFinal,
      totalPaid,
      balanceDue,
      deliveredSlips,
      pendingSlips,
      totalItemsCount,
      totalPhysicalQty,
    };
  }, [filteredCustomerInvoices, exitSlipLogs]);

  // Handle Excel Export
  const handleExport = () => {
    if (!currentCustomer) return;

    const result = exportPersonInvoicesAndExitSlipsToExcel({
      customer: currentCustomer,
      invoices,
      exitSlipLogs,
      currency: settings.currency || 'تومان',
      dateFrom,
      dateTo,
      docType: docTypeFilter,
      deliveryStatus: deliveryFilter,
    });

    if (result.success) {
      setDownloadSuccessMessage(`فایل اکسل با ${toPersianDigits(result.exportedInvoicesCount)} فاکتور، ${toPersianDigits(result.exportedItemsCount)} ردیف کالا و ${toPersianDigits(result.exportedSlipsCount)} ردیف حواله خروج با موفقیت دریافت شد.`);
      setTimeout(() => {
        setDownloadSuccessMessage(null);
      }, 5000);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      id="customer-export-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-xs overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        id="customer-export-modal-container"
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-200"
        dir="rtl"
      >
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 bg-gradient-to-r from-emerald-700 via-teal-700 to-emerald-800 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center backdrop-blur-xs shadow-inner">
              <FileSpreadsheet className="w-5 h-5 text-emerald-200" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                <span>اکسپورت اکسل فاکتورها و حواله‌های خروج</span>
                <span className="text-xs font-normal bg-emerald-900/60 text-emerald-200 px-2 py-0.5 rounded-full border border-emerald-500/30">
                  چند شیته با جزییات کامل
                </span>
              </h2>
              <p className="text-xs text-emerald-100/90 mt-0.5">
                دریافت فایل اکسل رسمی و جامع شامل خلاصه حساب، ریز اقلام کالاها و حواله‌های خروج انبار یک شخص
              </p>
            </div>
          </div>

          <button
            id="close-customer-export-modal"
            onClick={onClose}
            className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
            title="بستن"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {/* Success Banner */}
          {downloadSuccessMessage && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-xl flex items-center gap-2.5 text-xs font-semibold animate-in fade-in">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>{downloadSuccessMessage}</span>
            </div>
          )}

          {/* Customer Selection Row */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/90 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <label htmlFor="customer-selector" className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <User className="w-4 h-4 text-emerald-700" />
                <span>انتخاب طرف حساب / خریدار:</span>
              </label>

              {/* Search in dropdown if many */}
              {combinedCustomers.length > 5 && (
                <div className="relative w-full sm:w-64">
                  <Search className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    id="search-customer-input"
                    type="text"
                    value={customerSearch}
                    onChange={(e) => setCustomerSearch(e.target.value)}
                    placeholder="جستجوی نام یا تلفن..."
                    className="w-full pl-3 pr-8 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                  />
                  {customerSearch && (
                    <button
                      onClick={() => setCustomerSearch('')}
                      className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
                    >
                      ×
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Select Dropdown */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <select
                  id="customer-selector"
                  value={selectedCustomerId}
                  onChange={(e) => setSelectedCustomerId(e.target.value)}
                  className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 shadow-2xs"
                >
                  {filteredCustomerList.map((c) => {
                    const count = invoices.filter(
                      (inv) =>
                        inv.customerId === c.id ||
                        (inv.customerName && inv.customerName.trim().toLowerCase() === c.name.trim().toLowerCase())
                    ).length;
                    return (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.phone ? `(${toPersianDigits(c.phone)})` : ''} — {toPersianDigits(count)} فاکتور
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Quick Customer Card Info */}
              {currentCustomer && (
                <div className="bg-white p-2.5 rounded-xl border border-slate-200 text-xs flex flex-wrap items-center gap-x-4 gap-y-1 text-slate-600">
                  <div className="flex items-center gap-1">
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    <span className="font-bold text-slate-900">{currentCustomer.name}</span>
                  </div>
                  {currentCustomer.phone && (
                    <div className="flex items-center gap-1 font-mono text-[11px]">
                      <Phone className="w-3 h-3 text-slate-400" />
                      <span>{toPersianDigits(currentCustomer.phone)}</span>
                    </div>
                  )}
                  {currentCustomer.nationalId && (
                    <div className="flex items-center gap-1 font-mono text-[11px]">
                      <CreditCard className="w-3 h-3 text-slate-400" />
                      <span>کد ملی: {toPersianDigits(currentCustomer.nationalId)}</span>
                    </div>
                  )}
                  {currentCustomer.address && (
                    <div className="flex items-center gap-1 text-[11px] truncate max-w-full">
                      <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                      <span className="truncate">{currentCustomer.address}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {/* Total Invoices */}
            <div className="bg-slate-50 border border-slate-200/90 rounded-xl p-3 text-right">
              <div className="flex items-center justify-between text-slate-500 mb-1">
                <span className="text-[11px] font-semibold">تعداد کل فاکتورها</span>
                <FileText className="w-4 h-4 text-blue-600" />
              </div>
              <div className="text-lg font-black text-slate-900">
                {toPersianDigits(stats.totalInvoices)}{' '}
                <span className="text-xs font-normal text-slate-500">سند</span>
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">
                {toPersianDigits(stats.regularInvoices)} رسمی / {toPersianDigits(stats.proformaInvoices)} پیش‌فاکتور
              </div>
            </div>

            {/* Total Financial Volume */}
            <div className="bg-slate-50 border border-slate-200/90 rounded-xl p-3 text-right">
              <div className="flex items-center justify-between text-slate-500 mb-1">
                <span className="text-[11px] font-semibold">جمع مبالغ خرید</span>
                <CreditCard className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-base sm:text-lg font-black text-emerald-700">
                {toPersianDigits(formatPrice(stats.totalFinal, ''))}{' '}
                <span className="text-[10px] font-bold text-slate-500">{settings.currency}</span>
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">
                تخفیفات: {toPersianDigits(formatPrice(stats.totalDiscount, ''))}
              </div>
            </div>

            {/* Balance Due / Account State */}
            <div className={`border rounded-xl p-3 text-right ${
              stats.balanceDue > 0 ? 'bg-rose-50/70 border-rose-200' : 'bg-emerald-50/70 border-emerald-200'
            }`}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-semibold text-slate-700">مانده بدهی</span>
                <AlertCircle className={`w-4 h-4 ${stats.balanceDue > 0 ? 'text-rose-600' : 'text-emerald-600'}`} />
              </div>
              <div className={`text-base sm:text-lg font-black ${stats.balanceDue > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                {toPersianDigits(formatPrice(stats.balanceDue, ''))}{' '}
                <span className="text-[10px] font-bold text-slate-500">{settings.currency}</span>
              </div>
              <div className="text-[10px] text-slate-600 mt-0.5">
                {stats.balanceDue > 0 ? 'بدهکار به فروشگاه' : 'تسویه کامل'}
              </div>
            </div>

            {/* Warehouse Exit Slips */}
            <div className="bg-slate-50 border border-slate-200/90 rounded-xl p-3 text-right">
              <div className="flex items-center justify-between text-slate-500 mb-1">
                <span className="text-[11px] font-semibold">حواله‌های خروج انبار</span>
                <Truck className="w-4 h-4 text-amber-600" />
              </div>
              <div className="text-lg font-black text-slate-900">
                {toPersianDigits(stats.totalInvoices)}{' '}
                <span className="text-xs font-normal text-slate-500">حواله</span>
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-1">
                <span className="text-emerald-700 font-bold">{toPersianDigits(stats.deliveredSlips)} تحویل شد</span>
                <span>/</span>
                <span className="text-amber-700 font-bold">{toPersianDigits(stats.pendingSlips)} در انتظار</span>
              </div>
            </div>
          </div>

          {/* Filters Row */}
          <div className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-2.5">
            <div className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-slate-500" />
              <span>فیلترهای اختیاری جهت محدود کردن خروجی اکسل:</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 text-xs">
              {/* Date From */}
              <div>
                <label className="text-[11px] text-slate-500 block mb-1">از تاریخ (شمسی):</label>
                <input
                  id="filter-date-from"
                  type="text"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  placeholder="مثال: ۱۴۰۳/۰۱/۰۱"
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Date To */}
              <div>
                <label className="text-[11px] text-slate-500 block mb-1">تا تاریخ (شمسی):</label>
                <input
                  id="filter-date-to"
                  type="text"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  placeholder="مثال: ۱۴۰۳/۱۲/۲۹"
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Document Type Filter */}
              <div>
                <label className="text-[11px] text-slate-500 block mb-1">نوع سند فاکتور:</label>
                <select
                  id="filter-doc-type"
                  value={docTypeFilter}
                  onChange={(e) => setDocTypeFilter(e.target.value as any)}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="all">همه اسناد (رسمی و پیش‌فاکتور)</option>
                  <option value="regular">فقط فاکتورهای قطعی رسمی</option>
                  <option value="proforma">فقط پیش‌فاکتورها</option>
                </select>
              </div>

              {/* Delivery Filter */}
              <div>
                <label className="text-[11px] text-slate-500 block mb-1">وضعیت تحویل حواله خروج:</label>
                <select
                  id="filter-delivery-status"
                  value={deliveryFilter}
                  onChange={(e) => setDeliveryFilter(e.target.value as any)}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="all">همه حواله‌ها (تحویل‌شده و در انتظار)</option>
                  <option value="delivered">فقط بارهای تحویل‌شده</option>
                  <option value="pending">فقط بارهای در انتظار تحویل</option>
                </select>
              </div>
            </div>

            {(dateFrom || dateTo || docTypeFilter !== 'all' || deliveryFilter !== 'all') && (
              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px] text-emerald-700 font-semibold">
                  فیلتر فعال است: نمایش {toPersianDigits(filteredCustomerInvoices.length)} از {toPersianDigits(customerInvoices.length)} فاکتور
                </span>
                <button
                  id="clear-export-filters-btn"
                  onClick={() => {
                    setDateFrom('');
                    setDateTo('');
                    setDocTypeFilter('all');
                    setDeliveryFilter('all');
                  }}
                  className="text-[11px] text-rose-600 hover:text-rose-800 font-bold underline cursor-pointer"
                >
                  پاک کردن همه فیلترها
                </button>
              </div>
            )}
          </div>

          {/* Live Preview Tabs */}
          <div className="bg-slate-50 rounded-xl border border-slate-200/90 overflow-hidden">
            <div className="p-2 border-b border-slate-200 bg-white flex items-center justify-between">
              <div className="flex items-center gap-1">
                <button
                  id="preview-tab-invoices"
                  onClick={() => setActivePreviewTab('invoices')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
                    activePreviewTab === 'invoices'
                      ? 'bg-emerald-700 text-white shadow-xs'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>فاکتورها ({toPersianDigits(filteredCustomerInvoices.length)})</span>
                </button>

                <button
                  id="preview-tab-slips"
                  onClick={() => setActivePreviewTab('slips')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
                    activePreviewTab === 'slips'
                      ? 'bg-emerald-700 text-white shadow-xs'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <Truck className="w-3.5 h-3.5" />
                  <span>حواله‌های خروج انبار ({toPersianDigits(filteredCustomerInvoices.length)})</span>
                </button>
              </div>

              <div className="text-[11px] text-slate-500">
                پیش‌نمایش اسنادی که در اکسل قرار می‌گیرند
              </div>
            </div>

            {/* Tab 1: Invoices Preview */}
            {activePreviewTab === 'invoices' && (
              <div className="max-h-56 overflow-y-auto divide-y divide-slate-200">
                {filteredCustomerInvoices.length === 0 ? (
                  <div className="text-center py-8 text-slate-400 text-xs">
                    هیچ فاکتوری برای این شخص مطابق با فیلترهای انتخابی یافت نشد.
                  </div>
                ) : (
                  filteredCustomerInvoices.map((inv) => {
                    const isPaid = inv.paymentStatus === 'paid';
                    const isPartial = inv.paymentStatus === 'partial';

                    return (
                      <div key={inv.id} className="p-3 bg-white hover:bg-slate-50/80 transition-colors flex items-center justify-between text-xs">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900 font-mono">
                              فاکتور: {toPersianDigits(inv.invoiceNumber)}
                            </span>
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              inv.isProforma ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'
                            }`}>
                              {inv.isProforma ? 'پیش‌فاکتور' : 'رسمی'}
                            </span>
                            <span className="text-slate-500 text-[11px] font-mono">{toPersianDigits(inv.date)}</span>
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {toPersianDigits(inv.items.length)} قلم کالا ({toPersianDigits(inv.items.reduce((s, it) => s + (Number(it.quantity) || 0), 0))} واحد)
                            {inv.notes && ` — یادداشت: ${inv.notes}`}
                          </div>
                        </div>

                        <div className="text-left space-y-1">
                          <div className="font-black text-slate-900">
                            {toPersianDigits(formatPrice(inv.finalTotal, settings.currency))}
                          </div>
                          <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            isPaid
                              ? 'bg-emerald-100 text-emerald-800'
                              : isPartial
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}>
                            {isPaid ? 'تسویه کامل' : isPartial ? 'تسویه ناقص' : 'پرداخت نشده'}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* Tab 2: Exit Slips Preview */}
            {activePreviewTab === 'slips' && (
              <div className="max-h-56 overflow-y-auto divide-y divide-slate-200">
                {filteredCustomerInvoices.length === 0 ? (
                  <div className="text-center py-8 text-slate-400 text-xs">
                    هیچ حواله خروجی برای این شخص مطابق با فیلترها یافت نشد.
                  </div>
                ) : (
                  filteredCustomerInvoices.map((inv) => {
                    const slip = exitSlipLogs[inv.id] || { invoiceId: inv.id, printCount: 0, history: [] };
                    const slipNum = slip.slipNumber || inv.invoiceNumber;
                    const isDelivered = Boolean(slip.isDelivered);

                    return (
                      <div key={inv.id} className="p-3 bg-white hover:bg-slate-50/80 transition-colors flex items-center justify-between text-xs">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900 font-mono">
                              حواله خروج: {toPersianDigits(slipNum)}
                            </span>
                            <span className="text-[11px] text-slate-500">
                              (متناظر فاکتور {toPersianDigits(inv.invoiceNumber)})
                            </span>
                            <span className="text-slate-500 text-[11px] font-mono">{toPersianDigits(inv.date)}</span>
                          </div>
                          <div className="text-[11px] text-slate-600 flex flex-wrap gap-x-3">
                            <span>کالاها: {toPersianDigits(inv.items.length)} ردیف</span>
                            {slip.receiverName && <span>تحویل‌گیرنده/راننده: {slip.receiverName}</span>}
                            {slip.vehicleInfo && <span>خودرو: {slip.vehicleInfo}</span>}
                            {slip.deliveredAt && <span>زمان تحویل: {toPersianDigits(slip.deliveredAt)}</span>}
                          </div>
                        </div>

                        <div className="text-left space-y-1">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold ${
                            isDelivered
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                              : 'bg-amber-100 text-amber-800 border border-amber-300'
                          }`}>
                            {isDelivered ? (
                              <>
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                <span>بار تحویل شد</span>
                              </>
                            ) : (
                              <>
                                <Clock className="w-3 h-3 text-amber-600" />
                                <span>در انتظار تحویل</span>
                              </>
                            )}
                          </span>
                          <div className="text-[10px] text-slate-400">
                            {slip.printCount > 0 ? `چاپ شده (${toPersianDigits(slip.printCount)} بار)` : 'منتظر چاپ'}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>

          {/* Description of Sheets in the Generated Excel */}
          <div className="p-3 bg-emerald-50/60 border border-emerald-200/80 rounded-xl text-xs text-emerald-950 space-y-1.5">
            <div className="font-bold flex items-center gap-1.5 text-emerald-900">
              <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
              <span>محتوای فایل اکسل نهایی (۴ شیت مجزا با چیدمان راست‌به‌چپ):</span>
            </div>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-[11px] text-emerald-900/90 list-disc list-inside">
              <li><strong>شیت ۱ (خلاصه پرونده و حساب):</strong> مشخصات کامل خریدار، گردش حساب، سود و مانده بدهی</li>
              <li><strong>شیت ۲ (ریز اقلام فاکتورها):</strong> سطر به سطر کالاهای خریداری شده با تعداد، فی، تخفیف و مبالغ</li>
              <li><strong>شیت ۳ (حواله‌های خروج انبار):</strong> ریز اقلام تحویلی انبار، نام راننده، خودرو، پلاک و ساعت تحویل</li>
              <li><strong>شیت ۴ (لیست کلی فاکتورها):</strong> سرجمع اسناد با مبالغ دریافتی، مانده‌ها، شماره چک و پیگیری</li>
            </ul>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50/80 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-slate-500">
            {currentCustomer ? (
              <span>
                آماده استخراج برای <strong className="text-slate-900">{currentCustomer.name}</strong> ({toPersianDigits(filteredCustomerInvoices.length)} فاکتور)
              </span>
            ) : (
              <span>لطفاً ابتدا یک شخص را انتخاب نمایید.</span>
            )}
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <button
              id="cancel-customer-export-btn"
              type="button"
              onClick={onClose}
              className="flex-1 sm:flex-initial px-4 py-2.5 text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-xl transition-colors cursor-pointer"
            >
              بستن
            </button>

            <button
              id="download-customer-excel-btn"
              type="button"
              onClick={handleExport}
              disabled={!currentCustomer || filteredCustomerInvoices.length === 0}
              className="flex-1 sm:flex-initial px-5 py-2.5 text-xs font-black text-white bg-emerald-700 hover:bg-emerald-800 disabled:bg-slate-300 disabled:cursor-not-allowed rounded-xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>دانلود فایل اکسل کامل (XLSX)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
