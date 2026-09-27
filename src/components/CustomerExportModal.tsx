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
  Check,
  Printer,
  FileDown,
  Loader2,
  Sparkles,
  Layers,
  Building2
} from 'lucide-react';
import { Customer, Invoice, ExitSlipData, StoreSettings } from '../types';
import { exportPersonInvoicesAndExitSlipsToExcel } from '../utils/excelHelper';
import { formatPrice, toPersianDigits, getCurrentJalaliDate, getCurrentJalaliTime } from '../utils/jalali';
import { StorageService } from '../utils/storage';
import { exportElementToPdf, printElementInNewWindow } from '../utils/pdfHelper';

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
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(initialCustomerId || 'all');
  const [customerSearch, setCustomerSearch] = useState('');
  const [itemSearch, setItemSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [docTypeFilter, setDocTypeFilter] = useState<'all' | 'regular' | 'proforma'>(() => {
    return StorageService.getExportModalPreferences().docTypeFilter;
  });
  const [deliveryFilter, setDeliveryFilter] = useState<'all' | 'delivered' | 'pending'>(() => {
    return StorageService.getExportModalPreferences().deliveryFilter;
  });
  const [activePreviewTab, setActivePreviewTab] = useState<'items' | 'invoices' | 'slips'>(() => {
    return StorageService.getExportModalPreferences().activePreviewTab;
  });
  const [pdfOrientation, setPdfOrientation] = useState<'landscape' | 'portrait'>(() => {
    return StorageService.getExportModalPreferences().pdfOrientation;
  });
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [downloadSuccessMessage, setDownloadSuccessMessage] = useState<string | null>(null);

  // Persist export modal preferences
  React.useEffect(() => {
    StorageService.saveExportModalPreferences({
      pdfOrientation,
      activePreviewTab,
      docTypeFilter,
      deliveryFilter,
    });
  }, [pdfOrientation, activePreviewTab, docTypeFilter, deliveryFilter]);

  // Sync initialCustomerId when modal opens
  React.useEffect(() => {
    if (initialCustomerId) {
      setSelectedCustomerId(initialCustomerId);
    } else {
      setSelectedCustomerId('all');
    }
  }, [initialCustomerId, isOpen]);

  // Logs source
  const exitSlipLogs = useMemo(() => {
    return propExitSlipLogs || StorageService.getExitSlipLogs();
  }, [propExitSlipLogs]);

  // Combine customers with any unregistered customer names from invoices
  const combinedCustomers = useMemo(() => {
    const list = [...customers];
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

  const isAllCustomers = selectedCustomerId === 'all' || !selectedCustomerId;

  // Selected customer object
  const currentCustomer = useMemo(() => {
    if (isAllCustomers) return null;
    return combinedCustomers.find((c) => c.id === selectedCustomerId) || null;
  }, [combinedCustomers, selectedCustomerId, isAllCustomers]);

  // All invoices belonging to this selection
  const targetInvoices = useMemo(() => {
    if (isAllCustomers) return invoices;
    if (!currentCustomer) return [];
    return invoices.filter((inv) =>
      (inv.customerId && inv.customerId === currentCustomer.id) ||
      (inv.customerName && inv.customerName.trim().toLowerCase() === currentCustomer.name.trim().toLowerCase())
    );
  }, [invoices, currentCustomer, isAllCustomers]);

  // Invoices after applying user filters
  const filteredCustomerInvoices = useMemo(() => {
    let result = [...targetInvoices];

    if (itemSearch.trim()) {
      const q = itemSearch.trim().toLowerCase();
      result = result.filter((inv) => {
        const slip = exitSlipLogs[inv.id];
        const slipNum = slip?.slipNumber || '';
        return (
          inv.invoiceNumber.toLowerCase().includes(q) ||
          slipNum.toLowerCase().includes(q) ||
          inv.customerName.toLowerCase().includes(q) ||
          (inv.customerPhone && inv.customerPhone.includes(q)) ||
          (inv.notes && inv.notes.toLowerCase().includes(q)) ||
          (slip?.receiverName && slip.receiverName.toLowerCase().includes(q)) ||
          (slip?.vehicleInfo && slip.vehicleInfo.toLowerCase().includes(q)) ||
          inv.items.some((it) => it.productName.toLowerCase().includes(q) || (it.variantName && it.variantName.toLowerCase().includes(q)))
        );
      });
    }

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

    result.sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.invoiceNumber || '').localeCompare(a.invoiceNumber || ''));
    return result;
  }, [targetInvoices, itemSearch, dateFrom, dateTo, docTypeFilter, deliveryFilter, exitSlipLogs]);

  // Flattened detailed item rows (تاریخ، شماره فاکتور، شماره حواله، نوع و مقدار جنس)
  const detailedReportItems = useMemo(() => {
    const list: Array<{
      id: string;
      invoiceId: string;
      date: string;
      invoiceNumber: string;
      slipNumber: string;
      customerName: string;
      customerPhone?: string;
      productName: string;
      variantName?: string;
      quantity: number;
      unit: string;
      unitPrice: number;
      total: number;
      isProforma: boolean;
      paymentStatus: 'paid' | 'unpaid' | 'partial';
      isDelivered: boolean;
      deliveredAt?: string;
      deliveredBy?: string;
      receiverName?: string;
      vehicleInfo?: string;
    }> = [];

    filteredCustomerInvoices.forEach((inv) => {
      const slip = exitSlipLogs[inv.id] || { invoiceId: inv.id, printCount: 0, history: [] };
      const slipNum = slip.slipNumber || inv.invoiceNumber;
      const isDelivered = Boolean(slip.isDelivered);

      if (inv.items.length === 0) {
        list.push({
          id: `${inv.id}-empty`,
          invoiceId: inv.id,
          date: inv.date || '',
          invoiceNumber: inv.invoiceNumber,
          slipNumber: slipNum,
          customerName: inv.customerName || 'مشتری گذری',
          customerPhone: inv.customerPhone || '',
          productName: '(بدون قلم کالا)',
          variantName: '',
          quantity: 0,
          unit: '—',
          unitPrice: 0,
          total: inv.finalTotal,
          isProforma: !!inv.isProforma,
          paymentStatus: inv.paymentStatus || 'unpaid',
          isDelivered,
          deliveredAt: slip.deliveredAt,
          deliveredBy: slip.deliveredBy,
          receiverName: slip.receiverName,
          vehicleInfo: slip.vehicleInfo,
        });
      } else {
        inv.items.forEach((it, idx) => {
          list.push({
            id: `${inv.id}-${it.productId || idx}`,
            invoiceId: inv.id,
            date: inv.date || '',
            invoiceNumber: inv.invoiceNumber,
            slipNumber: slipNum,
            customerName: inv.customerName || 'مشتری گذری',
            customerPhone: inv.customerPhone || '',
            productName: it.productName,
            variantName: it.variantName || '',
            quantity: Number(it.quantity) || 0,
            unit: it.unit || 'عدد',
            unitPrice: it.unitPrice || 0,
            total: it.total || 0,
            isProforma: !!inv.isProforma,
            paymentStatus: inv.paymentStatus || 'unpaid',
            isDelivered,
            deliveredAt: slip.deliveredAt,
            deliveredBy: slip.deliveredBy,
            receiverName: slip.receiverName,
            vehicleInfo: slip.vehicleInfo,
          });
        });
      }
    });

    return list;
  }, [filteredCustomerInvoices, exitSlipLogs]);

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
  const handleExportExcel = () => {
    if (filteredCustomerInvoices.length === 0) return;

    const result = exportPersonInvoicesAndExitSlipsToExcel({
      customer: currentCustomer,
      invoices,
      exitSlipLogs,
      currency: settings.currency || 'تومان',
      dateFrom,
      dateTo,
      docType: docTypeFilter,
      deliveryStatus: deliveryFilter,
      searchQuery: itemSearch,
    });

    if (result.success) {
      setDownloadSuccessMessage(`فایل اکسل چند شیته با ${toPersianDigits(result.exportedInvoicesCount)} فاکتور، ${toPersianDigits(result.exportedItemsCount)} ردیف کالا و ${toPersianDigits(result.exportedSlipsCount)} حواله خروج با موفقیت دریافت شد.`);
      setTimeout(() => {
        setDownloadSuccessMessage(null);
      }, 6000);
    }
  };

  // Handle PDF Export
  const handleExportPdf = async () => {
    if (detailedReportItems.length === 0) return;
    setIsGeneratingPdf(true);
    try {
      const customerLabel = isAllCustomers ? 'کلیه_اسناد_و_حواله_ها' : (currentCustomer?.name.replace(/[/\\:*?"<>|]/g, '_') || 'شخص');
      const filename = `گزارش_فاکتورها_و_حواله_های_خروج_${customerLabel}_${getCurrentJalaliDate().replace(/\//g, '-')}.pdf`;
      
      const res = await exportElementToPdf('invoices-slips-pdf-report-canvas', filename, {
        pageSize: 'a4',
        orientation: pdfOrientation,
        quality: 'high',
      });

      if (res.success) {
        setDownloadSuccessMessage(`فایل PDF گزارش رسمی فاکتورها، حواله‌های خروج و اقلام (${toPersianDigits(detailedReportItems.length)} ردیف) با موفقیت دانلود شد.`);
        setTimeout(() => setDownloadSuccessMessage(null), 6000);
      } else {
        alert(res.error || 'خطا در تولید فایل PDF');
      }
    } catch (err: any) {
      console.error('PDF export error:', err);
      alert('خطا در صدور فایل PDF');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // Handle Direct Print
  const handlePrint = () => {
    if (detailedReportItems.length === 0) return;
    const customerLabel = isAllCustomers ? 'کلیه اسناد و حواله‌های خروج' : (currentCustomer?.name || 'مشتری');
    printElementInNewWindow('invoices-slips-pdf-report-canvas', `گزارش فاکتورها و حواله‌های خروج - ${customerLabel}`, {
      pageSize: 'a4',
      orientation: pdfOrientation,
    });
  };

  if (!isOpen) return null;

  return (
    <div
      id="customer-export-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/65 backdrop-blur-xs overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        id="customer-export-modal-container"
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl overflow-hidden flex flex-col max-h-[94vh] animate-in fade-in zoom-in-95 duration-200"
        dir="rtl"
      >
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 bg-gradient-to-r from-emerald-700 via-teal-700 to-indigo-800 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-white/15 flex items-center justify-center backdrop-blur-xs shadow-inner">
              <FileSpreadsheet className="w-6 h-6 text-emerald-200" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-white flex items-center gap-2 flex-wrap">
                <span>اکسپورت اکسل و PDF فاکتورها و حواله‌های خروج</span>
                <span className="text-xs font-normal bg-emerald-900/60 text-emerald-200 px-2.5 py-0.5 rounded-full border border-emerald-500/30">
                  شامل ستون‌های تاریخ، شماره فاکتور و حواله، نوع و مقدار جنس
                </span>
              </h2>
              <p className="text-xs text-emerald-100/90 mt-0.5">
                استخراج رسمی و جامع اسناد در قالب فایل اکسل چند شیته (XLSX) و گزارش استاندارد پی‌دی‌اف (PDF) با فونت فارسی
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
                <span>محدوده گزارش (طرف حساب / خریدار):</span>
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
                    placeholder="جستجوی نام شخص یا تلفن..."
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
                  <option value="all">
                    🌟 کلیه طرف‌های حساب و خریداران (گزارش تجمیعی کل {toPersianDigits(invoices.length)} فاکتور و حواله)
                  </option>
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

              {/* Quick Customer / Scope Card */}
              {isAllCustomers ? (
                <div className="bg-emerald-50/70 p-2.5 rounded-xl border border-emerald-200 text-xs flex items-center justify-between text-emerald-900 font-bold">
                  <div className="flex items-center gap-1.5">
                    <Building2 className="w-4 h-4 text-emerald-700" />
                    <span>محدوده: کل فروشگاه و انبار (کلیه خریداران و اسناد)</span>
                  </div>
                  <span className="text-[11px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-mono">
                    {toPersianDigits(invoices.length)} سند فعال
                  </span>
                </div>
              ) : currentCustomer ? (
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
              ) : null}
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {/* Total Invoices */}
            <div className="bg-slate-50 border border-slate-200/90 rounded-xl p-3 text-right">
              <div className="flex items-center justify-between text-slate-500 mb-1">
                <span className="text-[11px] font-semibold">تعداد فاکتورها</span>
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

            {/* Total Items & Physical Qty */}
            <div className="bg-slate-50 border border-slate-200/90 rounded-xl p-3 text-right">
              <div className="flex items-center justify-between text-slate-500 mb-1">
                <span className="text-[11px] font-semibold">تعداد و مقدار کل کالاها</span>
                <Package className="w-4 h-4 text-indigo-600" />
              </div>
              <div className="text-lg font-black text-indigo-900">
                {toPersianDigits(stats.totalPhysicalQty)}{' '}
                <span className="text-xs font-normal text-slate-500">واحد کالا</span>
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">
                در {toPersianDigits(stats.totalItemsCount)} ردیف قلم جنس
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

            {/* Total Financial Volume */}
            <div className="bg-slate-50 border border-slate-200/90 rounded-xl p-3 text-right">
              <div className="flex items-center justify-between text-slate-500 mb-1">
                <span className="text-[11px] font-semibold">جمع مبالغ اسناد</span>
                <CreditCard className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-base sm:text-lg font-black text-emerald-700">
                {toPersianDigits(formatPrice(stats.totalFinal, ''))}{' '}
                <span className="text-[10px] font-bold text-slate-500">{settings.currency}</span>
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">
                مانده بدهی: {toPersianDigits(formatPrice(stats.balanceDue, ''))}
              </div>
            </div>
          </div>

          {/* Filters Row */}
          <div className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5 text-slate-500" />
                <span>فیلترهای گزارش جهت استخراج اکسل و PDF:</span>
              </div>

              {/* PDF Orientation Picker */}
              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-500 text-[11px]">جهت صفحه PDF:</span>
                <div className="flex bg-slate-100 p-0.5 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setPdfOrientation('landscape')}
                    className={`px-2 py-1 rounded text-[11px] font-bold transition-all cursor-pointer ${
                      pdfOrientation === 'landscape' ? 'bg-white text-indigo-900 shadow-2xs' : 'text-slate-500'
                    }`}
                  >
                    افقی (Landscape - پیشنهادی)
                  </button>
                  <button
                    type="button"
                    onClick={() => setPdfOrientation('portrait')}
                    className={`px-2 py-1 rounded text-[11px] font-bold transition-all cursor-pointer ${
                      pdfOrientation === 'portrait' ? 'bg-white text-indigo-900 shadow-2xs' : 'text-slate-500'
                    }`}
                  >
                    عمودی (Portrait)
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-5 gap-2.5 text-xs">
              {/* Search text */}
              <div className="sm:col-span-1">
                <label className="text-[11px] text-slate-500 block mb-1">جستجو در اقلام / اسناد:</label>
                <input
                  type="text"
                  value={itemSearch}
                  onChange={(e) => setItemSearch(e.target.value)}
                  placeholder="کالا، شماره فاکتور، حواله..."
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              </div>

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
                  <option value="regular">فقط فاکتورهای رسمی</option>
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
                  <option value="all">همه حواله‌ها</option>
                  <option value="delivered">فقط بارهای تحویل‌شده</option>
                  <option value="pending">فقط بارهای در انتظار تحویل</option>
                </select>
              </div>
            </div>

            {(itemSearch || dateFrom || dateTo || docTypeFilter !== 'all' || deliveryFilter !== 'all') && (
              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px] text-emerald-700 font-semibold">
                  فیلتر فعال است: نمایش {toPersianDigits(filteredCustomerInvoices.length)} سند ({toPersianDigits(detailedReportItems.length)} قلم کالا)
                </span>
                <button
                  id="clear-export-filters-btn"
                  onClick={() => {
                    setItemSearch('');
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
            <div className="p-2 border-b border-slate-200 bg-white flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-1 flex-wrap">
                <button
                  id="preview-tab-items"
                  onClick={() => setActivePreviewTab('items')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
                    activePreviewTab === 'items'
                      ? 'bg-indigo-700 text-white shadow-xs'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>ریز اقلام و ستون‌های PDF ({toPersianDigits(detailedReportItems.length)} قلم)</span>
                </button>

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
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <Truck className="w-3.5 h-3.5" />
                  <span>حواله‌های خروج انبار ({toPersianDigits(filteredCustomerInvoices.length)})</span>
                </button>
              </div>

              <div className="text-[11px] text-slate-500">
                پیش‌نمایش زنده ستون‌های گزارش قبل از دانلود
              </div>
            </div>

            {/* Tab 1: Detailed Items Table Preview (Matches PDF exact columns!) */}
            {activePreviewTab === 'items' && (
              <div className="overflow-x-auto max-h-64 divide-y divide-slate-200">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-100 text-slate-700 font-bold sticky top-0 z-10">
                    <tr className="border-b border-slate-200">
                      <th className="p-2.5 w-12 text-center">ردیف</th>
                      <th className="p-2.5 w-24">تاریخ</th>
                      <th className="p-2.5 w-28">شماره فاکتور</th>
                      <th className="p-2.5 w-28">شماره حواله</th>
                      <th className="p-2.5 w-36">خریدار / طرف حساب</th>
                      <th className="p-2.5">نوع و شرح جنس (کالا)</th>
                      <th className="p-2.5 w-24 text-center">مقدار جنس</th>
                      <th className="p-2.5 w-24 text-center">وضعیت تحویل</th>
                      <th className="p-2.5 w-28 text-left">مبلغ ({settings.currency})</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {detailedReportItems.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="p-8 text-center text-slate-400">
                          هیچ موردی مطابق فیلترهای انتخابی یافت نشد.
                        </td>
                      </tr>
                    ) : (
                      detailedReportItems.map((item, idx) => (
                        <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="p-2 text-center text-slate-500 font-mono">{toPersianDigits(idx + 1)}</td>
                          <td className="p-2 font-mono text-slate-700">{toPersianDigits(item.date)}</td>
                          <td className="p-2 font-mono font-bold text-slate-900">{toPersianDigits(item.invoiceNumber)}</td>
                          <td className="p-2 font-mono text-indigo-700 font-bold">{toPersianDigits(item.slipNumber)}</td>
                          <td className="p-2 font-semibold text-slate-800 truncate max-w-[140px]">{item.customerName}</td>
                          <td className="p-2">
                            <span className="font-bold text-slate-900">{item.productName}</span>
                            {item.variantName && (
                              <span className="text-[10px] text-indigo-600 bg-indigo-50 px-1 py-0.5 rounded mr-1">
                                {item.variantName}
                              </span>
                            )}
                          </td>
                          <td className="p-2 text-center font-bold text-slate-900">
                            {toPersianDigits(item.quantity)}{' '}
                            <span className="text-[10px] text-slate-500 font-normal">{item.unit}</span>
                          </td>
                          <td className="p-2 text-center">
                            <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              item.isDelivered ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                            }`}>
                              {item.isDelivered ? 'تحویل شد' : 'در انتظار'}
                            </span>
                          </td>
                          <td className="p-2 text-left font-mono font-bold text-slate-900">
                            {toPersianDigits(formatPrice(item.total, ''))}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* Tab 2: Invoices Preview */}
            {activePreviewTab === 'invoices' && (
              <div className="max-h-64 overflow-y-auto divide-y divide-slate-200">
                {filteredCustomerInvoices.length === 0 ? (
                  <div className="text-center py-8 text-slate-400 text-xs">
                    هیچ فاکتوری مطابق با فیلترهای انتخابی یافت نشد.
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
                            <span className="text-slate-700 font-semibold">{inv.customerName}</span>
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

            {/* Tab 3: Exit Slips Preview */}
            {activePreviewTab === 'slips' && (
              <div className="max-h-64 overflow-y-auto divide-y divide-slate-200">
                {filteredCustomerInvoices.length === 0 ? (
                  <div className="text-center py-8 text-slate-400 text-xs">
                    هیچ حواله خروجی مطابق با فیلترها یافت نشد.
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
                            <span className="text-[11px] text-slate-500 font-mono">
                              (فاکتور {toPersianDigits(inv.invoiceNumber)})
                            </span>
                            <span className="text-slate-500 text-[11px] font-mono">{toPersianDigits(inv.date)}</span>
                            <span className="text-slate-800 font-semibold">{inv.customerName}</span>
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

          {/* Description of Output Formats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="p-3 bg-emerald-50/70 border border-emerald-200/80 rounded-xl text-emerald-950 space-y-1">
              <div className="font-bold flex items-center gap-1.5 text-emerald-900">
                <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
                <span>فرمت اکسل جامع (XLSX):</span>
              </div>
              <p className="text-[11px] text-emerald-900/90 leading-relaxed">
                شامل ۴ شیت تفکیک‌شده (خلاصه پرونده و حساب، ریز اقلام کالاها با قیمت و فی، حواله‌های خروج انبار با مشخصات راننده و خودرو، و سرجمع کلی فاکتورها)
              </p>
            </div>

            <div className="p-3 bg-indigo-50/70 border border-indigo-200/80 rounded-xl text-indigo-950 space-y-1">
              <div className="font-bold flex items-center gap-1.5 text-indigo-900">
                <FileDown className="w-4 h-4 text-indigo-700" />
                <span>فرمت رسمی PDF و پرینت مستقیم:</span>
              </div>
              <p className="text-[11px] text-indigo-900/90 leading-relaxed">
                شامل جدول شیک و اداری با ستون‌های درخواستی: <strong>تاریخ، شماره فاکتور و حواله، نام طرف حساب، نوع و شرح جنس، مقدار و واحد جنس</strong>، وضعیت تحویل و سرجمع مقادیر
              </p>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50/90 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-slate-600 flex items-center gap-2">
            <span>
              {isAllCustomers ? (
                <>مجموع کل اسناد: <strong className="text-slate-900">{toPersianDigits(filteredCustomerInvoices.length)} فاکتور و حواله</strong> ({toPersianDigits(detailedReportItems.length)} قلم کالا)</>
              ) : currentCustomer ? (
                <>طرف حساب: <strong className="text-slate-900">{currentCustomer.name}</strong> ({toPersianDigits(filteredCustomerInvoices.length)} فاکتور و حواله)</>
              ) : null}
            </span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap justify-end">
            <button
              id="cancel-customer-export-btn"
              type="button"
              onClick={onClose}
              className="px-3 py-2 text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-xl transition-colors cursor-pointer"
            >
              بستن
            </button>

            {/* Print Button */}
            <button
              id="print-customer-report-btn"
              type="button"
              onClick={handlePrint}
              disabled={detailedReportItems.length === 0}
              className="px-3.5 py-2 text-xs font-bold text-slate-800 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              title="پیش‌نمایش و چاپ مستقیم بر روی کاغذ A4"
            >
              <Printer className="w-4 h-4 text-slate-600" />
              <span>چاپ مستقیم (Print)</span>
            </button>

            {/* PDF Export Button */}
            <button
              id="download-customer-pdf-btn"
              type="button"
              onClick={handleExportPdf}
              disabled={detailedReportItems.length === 0 || isGeneratingPdf}
              className="px-4 py-2 text-xs font-black text-white bg-indigo-700 hover:bg-indigo-800 disabled:bg-slate-300 disabled:cursor-not-allowed rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
              title="دانلود فایل PDF گزارش ستون‌های تاریخ، شماره فاکتور و حواله، نوع و مقدار جنس"
            >
              {isGeneratingPdf ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>در حال ایجاد PDF...</span>
                </>
              ) : (
                <>
                  <FileDown className="w-4 h-4" />
                  <span>اکسپورت PDF رسمی</span>
                </>
              )}
            </button>

            {/* Excel Export Button */}
            <button
              id="download-customer-excel-btn"
              type="button"
              onClick={handleExportExcel}
              disabled={filteredCustomerInvoices.length === 0}
              className="px-4 py-2 text-xs font-black text-white bg-emerald-700 hover:bg-emerald-800 disabled:bg-slate-300 disabled:cursor-not-allowed rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
              title="دانلود فایل اکسل کامل چهار شیته"
            >
              <Download className="w-4 h-4" />
              <span>اکسپورت اکسل (XLSX)</span>
            </button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* HIDDEN / OFFSCREEN FULL-FIDELITY PDF REPORT CONTAINER FOR HTML2CANVAS */}
        {/* ========================================================================= */}
        <div style={{ position: 'absolute', left: '-9999px', top: '0', zIndex: -100 }}>
          <div
            id="invoices-slips-pdf-report-canvas"
            dir="rtl"
            style={{
              width: pdfOrientation === 'landscape' ? '1140px' : '820px',
              backgroundColor: '#ffffff',
              padding: '24px',
              fontFamily: "'Vazirmatn', -apple-system, BlinkMacSystemFont, sans-serif",
              color: '#0f172a',
              boxSizing: 'border-box',
            }}
          >
            {/* Report Header */}
            <div style={{ borderBottom: '2px solid #0f172a', paddingBottom: '14px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <h1 style={{ fontSize: '20px', fontWeight: '900', margin: '0 0 4px 0', color: '#0f172a' }}>
                    {settings.storeName || 'سامانه مدیریت انبار و فاکتورها'}
                  </h1>
                  <h2 style={{ fontSize: '14px', fontWeight: '700', margin: 0, color: '#4338ca' }}>
                    گزارش تجمیعی فاکتورها و حواله‌های خروج انبار
                  </h2>
                </div>

                <div style={{ textAlign: 'left', fontSize: '11px', color: '#475569' }}>
                  <div>تاریخ گزارش: <strong>{toPersianDigits(getCurrentJalaliDate())}</strong></div>
                  <div>ساعت صدور: <strong>{toPersianDigits(getCurrentJalaliTime())}</strong></div>
                  <div>واحد پولی: <strong>{settings.currency || 'تومان'}</strong></div>
                </div>
              </div>

              {/* Sub-header Scope Banner */}
              <div style={{ 
                marginTop: '10px', 
                padding: '8px 12px', 
                backgroundColor: '#f8fafc', 
                borderRadius: '8px', 
                border: '1px solid #e2e8f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: '11px'
              }}>
                <div>
                  طرف حساب: <strong style={{ color: '#0f172a' }}>{isAllCustomers ? 'کلیه طرف‌های حساب و خریداران (گزارش عمومی)' : currentCustomer?.name}</strong>
                  {currentCustomer?.phone && <span> — تلفن: {toPersianDigits(currentCustomer.phone)}</span>}
                  {currentCustomer?.nationalId && <span> — کد اقتصادی/ملی: {toPersianDigits(currentCustomer.nationalId)}</span>}
                </div>
                <div>
                  تعداد کل اسناد: <strong>{toPersianDigits(filteredCustomerInvoices.length)} فاکتور</strong> | مجموع اقلام: <strong>{toPersianDigits(stats.totalPhysicalQty)} واحد</strong> ({toPersianDigits(detailedReportItems.length)} سطر)
                </div>
              </div>
            </div>

            {/* Official Report Table with exact requested columns */}
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px', direction: 'rtl' }}>
              <thead>
                <tr style={{ backgroundColor: '#0f172a', color: '#ffffff' }}>
                  <th style={{ border: '1px solid #0f172a', padding: '6px 4px', textAlign: 'center', width: '32px' }}>ردیف</th>
                  <th style={{ border: '1px solid #0f172a', padding: '6px', textAlign: 'center', width: '70px' }}>تاریخ</th>
                  <th style={{ border: '1px solid #0f172a', padding: '6px', textAlign: 'center', width: '75px' }}>شماره فاکتور</th>
                  <th style={{ border: '1px solid #0f172a', padding: '6px', textAlign: 'center', width: '80px' }}>شماره حواله</th>
                  <th style={{ border: '1px solid #0f172a', padding: '6px', textAlign: 'right', width: '110px' }}>خریدار / طرف حساب</th>
                  <th style={{ border: '1px solid #0f172a', padding: '6px', textAlign: 'right' }}>نوع و شرح جنس (کالا)</th>
                  <th style={{ border: '1px solid #0f172a', padding: '6px', textAlign: 'center', width: '75px' }}>مقدار جنس</th>
                  <th style={{ border: '1px solid #0f172a', padding: '6px', textAlign: 'center', width: '70px' }}>وضعیت تحویل</th>
                  <th style={{ border: '1px solid #0f172a', padding: '6px', textAlign: 'left', width: '85px' }}>مبلغ ردیف</th>
                </tr>
              </thead>
              <tbody>
                {detailedReportItems.map((item, idx) => (
                  <tr 
                    key={item.id} 
                    style={{ 
                      backgroundColor: idx % 2 === 0 ? '#ffffff' : '#f8fafc',
                      pageBreakInside: 'avoid'
                    }}
                  >
                    <td style={{ border: '1px solid #cbd5e1', padding: '5px 4px', textAlign: 'center', fontWeight: 'bold' }}>
                      {toPersianDigits(idx + 1)}
                    </td>
                    <td style={{ border: '1px solid #cbd5e1', padding: '5px', textAlign: 'center', fontFamily: 'monospace' }}>
                      {toPersianDigits(item.date)}
                    </td>
                    <td style={{ border: '1px solid #cbd5e1', padding: '5px', textAlign: 'center', fontWeight: 'bold', fontFamily: 'monospace' }}>
                      {toPersianDigits(item.invoiceNumber)}
                    </td>
                    <td style={{ border: '1px solid #cbd5e1', padding: '5px', textAlign: 'center', fontWeight: 'bold', color: '#3730a3', fontFamily: 'monospace' }}>
                      {toPersianDigits(item.slipNumber)}
                    </td>
                    <td style={{ border: '1px solid #cbd5e1', padding: '5px', textAlign: 'right', fontWeight: 'bold' }}>
                      {item.customerName}
                    </td>
                    <td style={{ border: '1px solid #cbd5e1', padding: '5px', textAlign: 'right' }}>
                      <span style={{ fontWeight: 'bold', color: '#0f172a' }}>{item.productName}</span>
                      {item.variantName ? <span style={{ color: '#4338ca', fontSize: '9px', marginRight: '4px' }}>({item.variantName})</span> : null}
                    </td>
                    <td style={{ border: '1px solid #cbd5e1', padding: '5px', textAlign: 'center', fontWeight: 'bold' }}>
                      {toPersianDigits(item.quantity)} {item.unit}
                    </td>
                    <td style={{ border: '1px solid #cbd5e1', padding: '5px', textAlign: 'center' }}>
                      <span style={{ 
                        color: item.isDelivered ? '#065f46' : '#92400e',
                        fontWeight: 'bold',
                        fontSize: '9px'
                      }}>
                        {item.isDelivered ? 'تحویل شد' : 'در انتظار'}
                      </span>
                    </td>
                    <td style={{ border: '1px solid #cbd5e1', padding: '5px', textAlign: 'left', fontFamily: 'monospace', fontWeight: 'bold' }}>
                      {toPersianDigits(formatPrice(item.total, ''))}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ backgroundColor: '#e2e8f0', fontWeight: '900', fontSize: '11px' }}>
                  <td colSpan={6} style={{ border: '1px solid #94a3b8', padding: '8px', textAlign: 'right' }}>
                    جمع کل اقلام فیزیکی و مبالغ گزارش ({toPersianDigits(detailedReportItems.length)} سطر):
                  </td>
                  <td style={{ border: '1px solid #94a3b8', padding: '8px', textAlign: 'center', color: '#0f172a' }}>
                    {toPersianDigits(stats.totalPhysicalQty)} واحد
                  </td>
                  <td style={{ border: '1px solid #94a3b8', padding: '8px', textAlign: 'center', color: '#065f46', fontSize: '10px' }}>
                    {toPersianDigits(stats.deliveredSlips)} تحویل شد
                  </td>
                  <td style={{ border: '1px solid #94a3b8', padding: '8px', textAlign: 'left', color: '#0f172a', fontFamily: 'monospace' }}>
                    {toPersianDigits(formatPrice(stats.totalFinal, ''))}
                  </td>
                </tr>
              </tfoot>
            </table>

            {/* Bottom Signatures */}
            <div style={{ 
              marginTop: '32px', 
              paddingTop: '16px', 
              borderTop: '1px solid #cbd5e1', 
              display: 'grid', 
              gridTemplateColumns: 'repeat(3, 1fr)', 
              gap: '16px', 
              textAlign: 'center',
              fontSize: '11px',
              color: '#334155'
            }}>
              <div>
                <div style={{ fontWeight: 'bold', marginBottom: '35px' }}>مسئول صدور و حسابداری</div>
                <div style={{ color: '#94a3b8', fontSize: '10px' }}>امضا و تاریخ</div>
              </div>
              <div>
                <div style={{ fontWeight: 'bold', marginBottom: '35px' }}>مسئول انبار و تحویل کالا</div>
                <div style={{ color: '#94a3b8', fontSize: '10px' }}>امضا و تاریخ</div>
              </div>
              <div>
                <div style={{ fontWeight: 'bold', marginBottom: '35px' }}>تاییدیه مدیریت مجموعه</div>
                <div style={{ color: '#94a3b8', fontSize: '10px' }}>مهر و امضا</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
