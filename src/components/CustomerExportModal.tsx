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
  Building2,
  ShieldCheck,
  Receipt
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
  initialReportType?: 'exit_slips' | 'invoices';
  settings: StoreSettings;
}

export const CustomerExportModal: React.FC<CustomerExportModalProps> = ({
  isOpen,
  onClose,
  customers,
  invoices,
  exitSlipLogs: propExitSlipLogs,
  initialCustomerId,
  initialReportType,
  settings,
}) => {
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(initialCustomerId || 'all');
  const [customerSearch, setCustomerSearch] = useState('');
  const [itemSearch, setItemSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  
  // Document type for PDF/Print report: 'exit_slips' (NO PRICE COLUMN) or 'invoices' (WITH PRICE COLUMN)
  const [reportType, setReportType] = useState<'exit_slips' | 'invoices'>(() => {
    if (initialReportType) return initialReportType;
    return StorageService.getExportModalPreferences().reportType || 'exit_slips';
  });

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

  // Persist export modal preferences whenever they change
  React.useEffect(() => {
    StorageService.saveExportModalPreferences({
      pdfOrientation,
      activePreviewTab,
      docTypeFilter,
      deliveryFilter,
      reportType,
    });
  }, [pdfOrientation, activePreviewTab, docTypeFilter, deliveryFilter, reportType]);

  // Sync initialCustomerId and initialReportType when modal opens
  React.useEffect(() => {
    if (initialCustomerId) {
      setSelectedCustomerId(initialCustomerId);
    } else {
      setSelectedCustomerId('all');
    }
  }, [initialCustomerId, isOpen]);

  React.useEffect(() => {
    if (initialReportType) {
      setReportType(initialReportType);
    }
  }, [initialReportType, isOpen]);

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
      setDownloadSuccessMessage(`فایل اکسل جامع چند شیته با ${toPersianDigits(result.exportedInvoicesCount)} فاکتور، ${toPersianDigits(result.exportedItemsCount)} ردیف کالا و ${toPersianDigits(result.exportedSlipsCount)} حواله خروج با موفقیت دریافت شد.`);
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
      const customerLabel = isAllCustomers ? 'کلیه_اسناد' : (currentCustomer?.name.replace(/[/\\:*?"<>|]/g, '_') || 'شخص');
      const safeDate = getCurrentJalaliDate().replace(/\//g, '-');
      const filename = reportType === 'exit_slips'
        ? `گزارش_رسمی_حواله_های_خروج_انبار_${customerLabel}_${safeDate}.pdf`
        : `گزارش_رسمی_فاکتورهای_فروش_${customerLabel}_${safeDate}.pdf`;
      
      const res = await exportElementToPdf('invoices-slips-pdf-report-canvas', filename, {
        pageSize: 'a4',
        orientation: pdfOrientation,
        quality: 'high',
        documentType: reportType === 'exit_slips' ? 'exit_slip' : 'invoice',
      });

      if (res.success) {
        const typeLabel = reportType === 'exit_slips' ? 'حواله‌های خروج انبار (فاقد قیمت)' : 'فاکتورهای فروش (همراه با ستون قیمت)';
        setDownloadSuccessMessage(`فایل PDF رسمی ${typeLabel} با موفقیت دانلود شد (${toPersianDigits(detailedReportItems.length)} ردیف کالایی).`);
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
    const customerLabel = isAllCustomers ? 'کلیه اسناد' : (currentCustomer?.name || 'مشتری');
    const printTitle = reportType === 'exit_slips'
      ? `گزارش رسمی حواله‌های خروج انبار (فاقد قیمت) - ${customerLabel}`
      : `گزارش رسمی فاکتورهای فروش - ${customerLabel}`;

    printElementInNewWindow('invoices-slips-pdf-report-canvas', printTitle, {
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
                خروجی جامع برای کلیه طرف‌های حساب یا مشتری خاص • ستون‌های استاندارد تحویل انبار و فاکتور فروش
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-white/80 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Download Success Banner */}
        {downloadSuccessMessage && (
          <div className="bg-emerald-500 text-white px-4 py-2.5 text-xs font-bold flex items-center justify-between shadow-inner">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{downloadSuccessMessage}</span>
            </div>
            <button
              onClick={() => setDownloadSuccessMessage(null)}
              className="text-white/80 hover:text-white text-xs cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 text-slate-800 flex-1">
          {/* Customer Selector Bar */}
          <div className="bg-slate-50 rounded-2xl p-3.5 sm:p-4 border border-slate-200 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2 font-bold text-slate-800 text-sm">
                <User className="w-4 h-4 text-emerald-600" />
                <span>دامنه گزارش (طرف حساب یا کلیه اسناد):</span>
              </div>
              <span className="text-xs text-slate-500 font-mono">
                {toPersianDigits(filteredCustomerInvoices.length)} سند منطبق با فیلترها
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {/* Dropdown Customer Selector */}
              <div className="sm:col-span-2">
                <select
                  id="customer-export-select"
                  value={selectedCustomerId}
                  onChange={(e) => {
                    setSelectedCustomerId(e.target.value);
                  }}
                  className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 shadow-2xs"
                >
                  <option value="all">
                    🌐 کلیه مشتریان و طرف‌های حساب (گزارش تجمیعی کل اسناد و حواله‌های خروج انبار)
                  </option>
                  <optgroup label="مشتریان و طرف‌های حساب ثبت‌شده">
                    {filteredCustomerList.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.phone ? `(${toPersianDigits(c.phone)})` : ''} {c.nationalId ? `[کد: ${toPersianDigits(c.nationalId)}]` : ''}
                      </option>
                    ))}
                  </optgroup>
                </select>
              </div>

              {/* Quick search input for customer list */}
              <div>
                <div className="relative">
                  <input
                    type="text"
                    value={customerSearch}
                    onChange={(e) => setCustomerSearch(e.target.value)}
                    placeholder="جستجوی نام یا تلفن مشتری..."
                    className="w-full pl-8 pr-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                  />
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                </div>
              </div>
            </div>

            {/* Selected Customer Details Chip */}
            {currentCustomer && (
              <div className="p-2.5 bg-white rounded-xl border border-slate-200 text-xs flex flex-wrap items-center gap-x-4 gap-y-1.5 text-slate-600">
                <div className="font-bold text-slate-900 flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span>{currentCustomer.name}</span>
                </div>
                {currentCustomer.phone && (
                  <div className="flex items-center gap-1">
                    <Phone className="w-3 h-3 text-slate-400" />
                    <span className="font-mono">{toPersianDigits(currentCustomer.phone)}</span>
                  </div>
                )}
                {currentCustomer.nationalId && (
                  <div className="flex items-center gap-1">
                    <CreditCard className="w-3 h-3 text-slate-400" />
                    <span>کد ملی/اقتصادی: <strong className="font-mono text-slate-700">{toPersianDigits(currentCustomer.nationalId)}</strong></span>
                  </div>
                )}
                {currentCustomer.address && (
                  <div className="flex items-center gap-1 text-[11px] text-slate-500 max-w-sm truncate">
                    <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                    <span>{currentCustomer.address}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* KEY TOGGLE: OFFICIAL PDF / PRINT DOCUMENT TYPE */}
          {/* CRITICAL: In Exit Slips (حواله خروج), NO price column exists. Only in Invoices (فاکتورها) price column exists! */}
          <div className="bg-gradient-to-r from-amber-50 via-slate-50 to-indigo-50 p-3 sm:p-3.5 rounded-2xl border-2 border-indigo-200/80 shadow-2xs space-y-2.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-white shadow-xs ${
                  reportType === 'exit_slips' ? 'bg-amber-600' : 'bg-indigo-700'
                }`}>
                  {reportType === 'exit_slips' ? <Truck className="w-4 h-4" /> : <Receipt className="w-4 h-4" />}
                </div>
                <div>
                  <div className="font-black text-xs sm:text-sm text-slate-900 flex items-center gap-2">
                    <span>نوع سند در اکسپورت PDF رسمی و چاپ:</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      reportType === 'exit_slips'
                        ? 'bg-amber-100 text-amber-900 border border-amber-300'
                        : 'bg-indigo-100 text-indigo-900 border border-indigo-300'
                    }`}>
                      {reportType === 'exit_slips' ? 'حواله خروج (فاقد ستون قیمت)' : 'فاکتور فروش (با ستون قیمت)'}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {reportType === 'exit_slips'
                      ? 'در خروجی حواله خروج، ستون قیمت و مبالغ حذف شده و فقط مشخصات فیزیکی کالا، مقادیر، تحویل‌گیرنده و خودرو درج می‌شود.'
                      : 'در خروجی فاکتورها، ستون‌های فی (قیمت واحد)، مبلغ کل ردیف و جمع کل مبالغ مالی به صورت کامل درج می‌شود.'}
                  </div>
                </div>
              </div>

              {/* Toggle Switch */}
              <div className="flex items-center gap-1.5 bg-white p-1 rounded-xl border border-slate-300 shadow-xs self-stretch sm:self-auto justify-center">
                <button
                  id="report-type-exit-slips-btn"
                  type="button"
                  onClick={() => setReportType('exit_slips')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    reportType === 'exit_slips'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                  title="سند رسمی خروج کالا از انبار (فاقد ستون قیمت)"
                >
                  <Truck className="w-3.5 h-3.5" />
                  <span>حواله خروج انبار (فاقد قیمت)</span>
                </button>

                <button
                  id="report-type-invoices-btn"
                  type="button"
                  onClick={() => setReportType('invoices')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    reportType === 'invoices'
                      ? 'bg-indigo-700 text-white shadow-xs'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                  title="سند رسمی فاکتور فروش (همراه با ستون قیمت و مبالغ)"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>فاکتورهای فروش (با ستون قیمت)</span>
                </button>
              </div>
            </div>
          </div>

          {/* Aggregate Stat Badges */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
              <span className="text-[11px] text-slate-500 block mb-0.5">تعداد کل اسناد:</span>
              <strong className="text-base font-black text-slate-900 font-mono">
                {toPersianDigits(stats.totalInvoices)}
              </strong>
              <span className="text-[10px] text-slate-400 mr-1.5">
                ({toPersianDigits(stats.regularInvoices)} رسمی / {toPersianDigits(stats.proformaInvoices)} پیش‌فاکتور)
              </span>
            </div>

            <div className="p-3 bg-blue-50/70 border border-blue-200/80 rounded-xl">
              <span className="text-[11px] text-blue-700 block mb-0.5">کل اقلام فیزیکی:</span>
              <strong className="text-base font-black text-blue-950 font-mono">
                {toPersianDigits(stats.totalPhysicalQty)} واحد
              </strong>
              <span className="text-[10px] text-blue-600 mr-1.5">
                ({toPersianDigits(detailedReportItems.length)} سطر کالایی)
              </span>
            </div>

            <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-xl">
              <span className="text-[11px] text-amber-700 block mb-0.5">وضعیت حواله‌های خروج:</span>
              <strong className="text-base font-black text-amber-950 font-mono">
                {toPersianDigits(stats.deliveredSlips)} تحویل شد
              </strong>
              <span className="text-[10px] text-amber-600 mr-1.5">
                ({toPersianDigits(stats.pendingSlips)} در انتظار)
              </span>
            </div>

            <div className="p-3 bg-emerald-50/70 border border-emerald-200/80 rounded-xl">
              <span className="text-[11px] text-emerald-700 block mb-0.5">
                {reportType === 'exit_slips' ? 'کنترل فیزیکی انبار:' : `جمع کل مبالغ فاکتورها:`}
              </span>
              <strong className="text-base font-black text-emerald-950 font-mono">
                {reportType === 'exit_slips' 
                  ? 'فاقد بار مالی' 
                  : toPersianDigits(formatPrice(stats.totalFinal, settings.currency))}
              </strong>
              <span className="text-[10px] text-emerald-600 mr-1.5">
                {reportType === 'exit_slips' ? '(فقط گردش کالا)' : `مانده: ${toPersianDigits(formatPrice(stats.balanceDue, ''))}`}
              </span>
            </div>
          </div>

          {/* Filters Section */}
          <div className="bg-white rounded-xl p-3 sm:p-4 border border-slate-200/90 shadow-xs space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                <Filter className="w-3.5 h-3.5 text-slate-500" />
                <span>فیلترهای پیشرفته تاریخ، کالا و نوع سند:</span>
              </div>

              {/* PDF Orientation Selector */}
              <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-lg">
                <span className="text-[11px] text-slate-600 px-1 font-semibold">جهت کاغذ PDF:</span>
                <button
                  type="button"
                  onClick={() => setPdfOrientation('landscape')}
                  className={`px-2 py-1 rounded text-[11px] font-bold transition-all cursor-pointer ${
                    pdfOrientation === 'landscape' ? 'bg-white text-indigo-900 shadow-2xs' : 'text-slate-500'
                  }`}
                >
                  افقی (Landscape - استاندارد جدول)
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
                      ? (reportType === 'exit_slips' ? 'bg-amber-600 text-white shadow-xs' : 'bg-indigo-700 text-white shadow-xs')
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>
                    ریز اقلام و ستون‌های خروجی PDF ({toPersianDigits(detailedReportItems.length)} قلم)
                  </span>
                </button>

                <button
                  id="preview-tab-invoices"
                  onClick={() => {
                    setActivePreviewTab('invoices');
                    setReportType('invoices');
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
                    activePreviewTab === 'invoices'
                      ? 'bg-indigo-700 text-white shadow-xs'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>فاکتورها ({toPersianDigits(filteredCustomerInvoices.length)})</span>
                </button>

                <button
                  id="preview-tab-slips"
                  onClick={() => {
                    setActivePreviewTab('slips');
                    setReportType('exit_slips');
                  }}
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
                پیش‌نمایش زنده ستون‌های رسمی گزارش قبل از دریافت PDF
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
                      {reportType === 'exit_slips' ? (
                        <>
                          <th className="p-2.5 w-28 text-amber-900">شماره حواله</th>
                          <th className="p-2.5 w-28">شماره فاکتور</th>
                          <th className="p-2.5 w-36">تحویل‌گیرنده / طرف حساب</th>
                          <th className="p-2.5">نوع و شرح جنس (کالا)</th>
                          <th className="p-2.5 w-24 text-center">مقدار جنس</th>
                          <th className="p-2.5 w-24 text-center">وضعیت تحویل</th>
                          <th className="p-2.5 w-36 text-center">راننده / خودرو</th>
                        </>
                      ) : (
                        <>
                          <th className="p-2.5 w-28">شماره فاکتور</th>
                          <th className="p-2.5 w-28">شماره حواله</th>
                          <th className="p-2.5 w-36">خریدار / طرف حساب</th>
                          <th className="p-2.5">نوع و شرح جنس (کالا)</th>
                          <th className="p-2.5 w-20 text-center">مقدار</th>
                          <th className="p-2.5 w-24 text-left">فی واحد ({settings.currency})</th>
                          <th className="p-2.5 w-28 text-left">مبلغ کل ({settings.currency})</th>
                          <th className="p-2.5 w-20 text-center">وضعیت تسویه</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {detailedReportItems.length === 0 ? (
                      <tr>
                        <td colSpan={reportType === 'exit_slips' ? 9 : 10} className="p-8 text-center text-slate-400">
                          هیچ موردی مطابق فیلترهای انتخابی یافت نشد.
                        </td>
                      </tr>
                    ) : (
                      detailedReportItems.map((item, idx) => (
                        <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="p-2 text-center text-slate-500 font-mono">{toPersianDigits(idx + 1)}</td>
                          <td className="p-2 font-mono text-slate-700">{toPersianDigits(item.date)}</td>

                          {reportType === 'exit_slips' ? (
                            // EXIT SLIP COLUMNS - STRICTLY NO PRICE / FEE COLUMN
                            <>
                              <td className="p-2 font-mono text-amber-700 font-bold">{toPersianDigits(item.slipNumber)}</td>
                              <td className="p-2 font-mono text-slate-700">{toPersianDigits(item.invoiceNumber)}</td>
                              <td className="p-2 font-semibold text-slate-800 truncate max-w-[140px]">{item.customerName}</td>
                              <td className="p-2">
                                <span className="font-bold text-slate-900">{item.productName}</span>
                                {item.variantName && (
                                  <span className="text-[10px] text-amber-700 bg-amber-50 px-1 py-0.5 rounded mr-1">
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
                              <td className="p-2 text-center text-[11px] text-slate-600">
                                {item.receiverName || item.vehicleInfo ? (
                                  <span>{item.receiverName || ''}{item.vehicleInfo ? ` (${item.vehicleInfo})` : ''}</span>
                                ) : (
                                  <span className="text-slate-400">—</span>
                                )}
                              </td>
                            </>
                          ) : (
                            // INVOICE COLUMNS - WITH PRICE, UNIT PRICE AND FINANCIAL SUMS
                            <>
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
                              <td className="p-2 text-left font-mono text-slate-700 text-[11px]">
                                {toPersianDigits(formatPrice(item.unitPrice, ''))}
                              </td>
                              <td className="p-2 text-left font-mono font-bold text-slate-900">
                                {toPersianDigits(formatPrice(item.total, ''))}
                              </td>
                              <td className="p-2 text-center">
                                <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                  item.paymentStatus === 'paid'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : item.paymentStatus === 'partial'
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-rose-100 text-rose-800'
                                }`}>
                                  {item.paymentStatus === 'paid' ? 'تسویه' : item.paymentStatus === 'partial' ? 'ناقص' : 'پرداخت‌نشده'}
                                </span>
                              </td>
                            </>
                          )}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>

                {/* Footer Notice for preview */}
                <div className={`p-2.5 text-[11px] font-semibold flex items-center justify-between border-t ${
                  reportType === 'exit_slips'
                    ? 'bg-amber-50 text-amber-950 border-amber-200'
                    : 'bg-indigo-50 text-indigo-950 border-indigo-200'
                }`}>
                  <div className="flex items-center gap-1.5">
                    {reportType === 'exit_slips' ? (
                      <>
                        <ShieldCheck className="w-4 h-4 text-amber-700" />
                        <span>سند رسمی حواله خروج انبار: فاقد هرگونه ستون قیمت و گردش مالی (صرفاً کنترل فیزیکی کالا و لجستیک تحویل)</span>
                      </>
                    ) : (
                      <>
                        <FileText className="w-4 h-4 text-indigo-700" />
                        <span>گزارش رسمی فاکتورها: همراه با ستون‌های مالی، فی واحد کالا، مبالغ ردیف و جمع کل مبالغ</span>
                      </>
                    )}
                  </div>
                  <div>
                    {reportType === 'exit_slips' ? (
                      <span>مجموع اقلام تحویلی انبار: <strong>{toPersianDigits(stats.totalPhysicalQty)} واحد</strong></span>
                    ) : (
                      <span>جمع کل مبالغ فاکتورها: <strong>{toPersianDigits(formatPrice(stats.totalFinal, settings.currency))}</strong></span>
                    )}
                  </div>
                </div>
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
                شامل ۴ شیت تفکیک‌شده (خلاصه پرونده، ریز اقلام فاکتورها، حواله‌های خروج انبار بدون قیمت با مشخصات راننده و خودرو، و سرجمع کلی)
              </p>
            </div>

            <div className="p-3 bg-indigo-50/70 border border-indigo-200/80 rounded-xl text-indigo-950 space-y-1">
              <div className="font-bold flex items-center gap-1.5 text-indigo-900">
                <FileDown className="w-4 h-4 text-indigo-700" />
                <span>فرمت رسمی PDF و پرینت مستقیم:</span>
              </div>
              <p className="text-[11px] text-indigo-900/90 leading-relaxed">
                <strong>حواله خروج انبار:</strong> ستون‌های تاریخ، شماره حواله و فاکتور، نوع و مقدار جنس، تحویل‌گیرنده و خودرو (فاقد ستون قیمت)<br />
                <strong>فاکتورهای فروش:</strong> ستون‌های تاریخ، شماره فاکتور، نوع و مقدار کالا، قیمت واحد و مبلغ کل
              </p>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50/90 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-slate-600 flex items-center gap-2">
            <span>
              {isAllCustomers ? (
                <>مجموع کل اسناد: <strong className="text-slate-900">{toPersianDigits(filteredCustomerInvoices.length)} سند</strong> ({toPersianDigits(detailedReportItems.length)} قلم کالا)</>
              ) : currentCustomer ? (
                <>طرف حساب: <strong className="text-slate-900">{currentCustomer.name}</strong> ({toPersianDigits(filteredCustomerInvoices.length)} سند)</>
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
              className={`px-4 py-2 text-xs font-black text-white rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:bg-slate-300 disabled:cursor-not-allowed ${
                reportType === 'exit_slips'
                  ? 'bg-amber-600 hover:bg-amber-700'
                  : 'bg-indigo-700 hover:bg-indigo-800'
              }`}
              title={
                reportType === 'exit_slips'
                  ? 'دانلود فایل PDF رسمی حواله‌های خروج انبار (فاقد ستون قیمت)'
                  : 'دانلود فایل PDF رسمی فاکتورهای فروش (با ستون قیمت و مبالغ)'
              }
            >
              {isGeneratingPdf ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>در حال ایجاد PDF...</span>
                </>
              ) : (
                <>
                  <FileDown className="w-4 h-4" />
                  <span>
                    {reportType === 'exit_slips' ? 'اکسپورت PDF حواله خروج (بدون قیمت)' : 'اکسپورت PDF رسمی فاکتورها (با قیمت)'}
                  </span>
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
        {/* In Exit Slips (حواله خروج): NO PRICE COLUMN! Only in Invoices (فاکتورها) price column exists! */}
        {/* ========================================================================= */}
        <div style={{ position: 'absolute', left: '-9999px', top: '0', zIndex: -100 }}>
          <div
            id="invoices-slips-pdf-report-canvas"
            dir="rtl"
            style={{
              width: pdfOrientation === 'landscape' ? '1180px' : '820px',
              backgroundColor: '#ffffff',
              padding: '24px',
              fontFamily: "'Vazirmatn', -apple-system, BlinkMacSystemFont, sans-serif",
              color: '#0f172a',
              boxSizing: 'border-box',
            }}
          >
            {/* Official Report Table with Persistent Repeating Header */}
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px', direction: 'rtl' }}>
              <thead data-pdf-thead="true">
                {/* 1. Official Report Document Header inside thead (Preserved on ALL pages in PDF export and print) */}
                <tr className="pdf-doc-header-row" style={{ backgroundColor: '#ffffff', color: '#0f172a' }}>
                  <th
                    colSpan={reportType === 'exit_slips' ? 9 : 10}
                    style={{
                      padding: '0 0 14px 0',
                      border: 'none',
                      fontWeight: 'normal',
                      textAlign: 'right',
                    }}
                  >
                    <div
                      data-pdf-header="true"
                      className="export-report-header"
                      style={{ borderBottom: '2px solid #0f172a', paddingBottom: '14px', marginBottom: '8px' }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div>
                          <h1 style={{ fontSize: '20px', fontWeight: '900', margin: '0 0 4px 0', color: '#0f172a' }}>
                            {settings.storeName || 'سامانه مدیریت انبار و فاکتورها'}
                          </h1>
                          <h2 style={{ 
                            fontSize: '14px', 
                            fontWeight: '700', 
                            margin: 0, 
                            color: reportType === 'exit_slips' ? '#b45309' : '#3730a3',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                          }}>
                            {reportType === 'exit_slips' ? (
                              <>
                                <span>گزارش رسمی حواله‌های خروج کالا از انبار</span>
                                <span style={{ 
                                  fontSize: '11px', 
                                  fontWeight: 'normal', 
                                  backgroundColor: '#fef3c7', 
                                  color: '#92400e', 
                                  padding: '2px 8px', 
                                  borderRadius: '4px',
                                  border: '1px solid #fde68a'
                                }}>
                                  (سند رسمی انبارداری و تحویل کالا - فاقد هرگونه قیمت و بار مالی)
                                </span>
                              </>
                            ) : (
                              <>
                                <span>گزارش رسمی اقلام و فاکتورهای فروش</span>
                                <span style={{ 
                                  fontSize: '11px', 
                                  fontWeight: 'normal', 
                                  backgroundColor: '#e0e7ff', 
                                  color: '#3730a3', 
                                  padding: '2px 8px', 
                                  borderRadius: '4px',
                                  border: '1px solid #c7d2fe'
                                }}>
                                  (گزارش مالی و حسابداری فروش کالا و خدمات)
                                </span>
                              </>
                            )}
                          </h2>
                        </div>

                        <div style={{ textAlign: 'left', fontSize: '11px', color: '#475569' }}>
                          <div>تاریخ گزارش: <strong>{toPersianDigits(getCurrentJalaliDate())}</strong></div>
                          <div>ساعت صدور: <strong>{toPersianDigits(getCurrentJalaliTime())}</strong></div>
                          <div>نوع سند: <strong>{reportType === 'exit_slips' ? 'برگه‌های خروج انبار' : 'فاکتورهای فروش'}</strong></div>
                          {reportType === 'invoices' && (
                            <div>واحد پولی: <strong>{settings.currency || 'تومان'}</strong></div>
                          )}
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
                          طرف حساب: <strong style={{ color: '#0f172a' }}>{isAllCustomers ? 'کلیه طرف‌های حساب و متقاضیان (گزارش عمومی)' : currentCustomer?.name}</strong>
                          {currentCustomer?.phone && <span> — تلفن: {toPersianDigits(currentCustomer.phone)}</span>}
                          {currentCustomer?.nationalId && <span> — کد اقتصادی/ملی: {toPersianDigits(currentCustomer.nationalId)}</span>}
                        </div>
                        <div>
                          {reportType === 'exit_slips' ? (
                            <>
                              تعداد حواله‌ها: <strong>{toPersianDigits(filteredCustomerInvoices.length)} فقره</strong> | مجموع اقلام فیزیکی: <strong>{toPersianDigits(stats.totalPhysicalQty)} واحد</strong> ({toPersianDigits(detailedReportItems.length)} سطر کالایی)
                            </>
                          ) : (
                            <>
                              تعداد فاکتورها: <strong>{toPersianDigits(filteredCustomerInvoices.length)} فقره</strong> | اقلام: <strong>{toPersianDigits(stats.totalPhysicalQty)} واحد</strong> | جمع کل مبالغ: <strong>{toPersianDigits(formatPrice(stats.totalFinal, settings.currency))}</strong>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </th>
                </tr>

                {/* 2. Official Table Column Headers */}
                <tr style={{ backgroundColor: reportType === 'exit_slips' ? '#1e293b' : '#0f172a', color: '#ffffff' }}>
                  <th style={{ border: '1px solid #0f172a', padding: '6px 4px', textAlign: 'center', width: '32px' }}>ردیف</th>
                  <th style={{ border: '1px solid #0f172a', padding: '6px', textAlign: 'center', width: '70px' }}>تاریخ</th>
                  
                  {reportType === 'exit_slips' ? (
                    // EXIT SLIPS HEADER: STRICTLY NO PRICE COLUMN
                    <>
                      <th style={{ border: '1px solid #0f172a', padding: '6px', textAlign: 'center', width: '85px' }}>شماره حواله خروج</th>
                      <th style={{ border: '1px solid #0f172a', padding: '6px', textAlign: 'center', width: '75px' }}>شماره فاکتور</th>
                      <th style={{ border: '1px solid #0f172a', padding: '6px', textAlign: 'right', width: '120px' }}>تحویل‌گیرنده / خریدار</th>
                      <th style={{ border: '1px solid #0f172a', padding: '6px', textAlign: 'right' }}>نوع و شرح جنس (کالا)</th>
                      <th style={{ border: '1px solid #0f172a', padding: '6px', textAlign: 'center', width: '80px' }}>مقدار و واحد</th>
                      <th style={{ border: '1px solid #0f172a', padding: '6px', textAlign: 'center', width: '75px' }}>وضعیت تحویل</th>
                      <th style={{ border: '1px solid #0f172a', padding: '6px', textAlign: 'right', width: '110px' }}>مشخصات راننده / خودرو</th>
                    </>
                  ) : (
                    // INVOICES HEADER: WITH UNIT PRICE AND ROW TOTAL AMOUNT
                    <>
                      <th style={{ border: '1px solid #0f172a', padding: '6px', textAlign: 'center', width: '75px' }}>شماره فاکتور</th>
                      <th style={{ border: '1px solid #0f172a', padding: '6px', textAlign: 'center', width: '75px' }}>شماره حواله</th>
                      <th style={{ border: '1px solid #0f172a', padding: '6px', textAlign: 'right', width: '110px' }}>خریدار / طرف حساب</th>
                      <th style={{ border: '1px solid #0f172a', padding: '6px', textAlign: 'right' }}>نوع و شرح جنس (کالا)</th>
                      <th style={{ border: '1px solid #0f172a', padding: '6px', textAlign: 'center', width: '65px' }}>مقدار جنس</th>
                      <th style={{ border: '1px solid #0f172a', padding: '6px', textAlign: 'left', width: '75px' }}>فی واحد ({settings.currency})</th>
                      <th style={{ border: '1px solid #0f172a', padding: '6px', textAlign: 'left', width: '85px' }}>مبلغ کل ردیف</th>
                      <th style={{ border: '1px solid #0f172a', padding: '6px', textAlign: 'center', width: '70px' }}>وضعیت تسویه</th>
                    </>
                  )}
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

                    {reportType === 'exit_slips' ? (
                      // EXIT SLIP ROW CELLS - STRICTLY NO PRICE OR FEE!
                      <>
                        <td style={{ border: '1px solid #cbd5e1', padding: '5px', textAlign: 'center', fontWeight: 'bold', color: '#b45309', fontFamily: 'monospace' }}>
                          {toPersianDigits(item.slipNumber)}
                        </td>
                        <td style={{ border: '1px solid #cbd5e1', padding: '5px', textAlign: 'center', fontFamily: 'monospace', color: '#475569' }}>
                          {toPersianDigits(item.invoiceNumber)}
                        </td>
                        <td style={{ border: '1px solid #cbd5e1', padding: '5px', textAlign: 'right', fontWeight: 'bold' }}>
                          {item.customerName}
                        </td>
                        <td style={{ border: '1px solid #cbd5e1', padding: '5px', textAlign: 'right' }}>
                          <span style={{ fontWeight: 'bold', color: '#0f172a' }}>{item.productName}</span>
                          {item.variantName ? <span style={{ color: '#b45309', fontSize: '9px', marginRight: '4px' }}>({item.variantName})</span> : null}
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
                        <td style={{ border: '1px solid #cbd5e1', padding: '5px', textAlign: 'right', fontSize: '9px', color: '#475569' }}>
                          {item.receiverName || item.vehicleInfo ? (
                            <span>{item.receiverName || ''}{item.vehicleInfo ? ` - ${item.vehicleInfo}` : ''}</span>
                          ) : (
                            <span>—</span>
                          )}
                        </td>
                      </>
                    ) : (
                      // INVOICE ROW CELLS - WITH UNIT PRICE AND ROW TOTAL
                      <>
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
                        <td style={{ border: '1px solid #cbd5e1', padding: '5px', textAlign: 'left', fontFamily: 'monospace', color: '#334155' }}>
                          {toPersianDigits(formatPrice(item.unitPrice, ''))}
                        </td>
                        <td style={{ border: '1px solid #cbd5e1', padding: '5px', textAlign: 'left', fontFamily: 'monospace', fontWeight: 'bold' }}>
                          {toPersianDigits(formatPrice(item.total, ''))}
                        </td>
                        <td style={{ border: '1px solid #cbd5e1', padding: '5px', textAlign: 'center', fontSize: '9px', fontWeight: 'bold' }}>
                          <span style={{
                            color: item.paymentStatus === 'paid' ? '#065f46' : item.paymentStatus === 'partial' ? '#92400e' : '#9f1239'
                          }}>
                            {item.paymentStatus === 'paid' ? 'تسویه کامل' : item.paymentStatus === 'partial' ? 'تسویه ناقص' : 'پرداخت‌نشده'}
                          </span>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                {reportType === 'exit_slips' ? (
                  // EXIT SLIPS FOOTER: NO FINANCIAL TOTALS!
                  <tr style={{ backgroundColor: '#f1f5f9', fontWeight: '900', fontSize: '11px' }}>
                    <td colSpan={6} style={{ border: '1px solid #94a3b8', padding: '8px', textAlign: 'right' }}>
                      مجموع کل اقلام فیزیکی تحویل شده از انبار ({toPersianDigits(detailedReportItems.length)} سطر کالایی):
                    </td>
                    <td style={{ border: '1px solid #94a3b8', padding: '8px', textAlign: 'center', color: '#0f172a' }}>
                      {toPersianDigits(stats.totalPhysicalQty)} واحد
                    </td>
                    <td style={{ border: '1px solid #94a3b8', padding: '8px', textAlign: 'center', color: '#065f46', fontSize: '10px' }}>
                      {toPersianDigits(stats.deliveredSlips)} تحویل شد
                    </td>
                    <td style={{ border: '1px solid #94a3b8', padding: '8px', textAlign: 'center', color: '#64748b', fontSize: '10px' }}>
                      (فاقد گردش مالی)
                    </td>
                  </tr>
                ) : (
                  // INVOICES FOOTER: WITH FINANCIAL TOTALS
                  <tr style={{ backgroundColor: '#e2e8f0', fontWeight: '900', fontSize: '11px' }}>
                    <td colSpan={6} style={{ border: '1px solid #94a3b8', padding: '8px', textAlign: 'right' }}>
                      جمع کل اقلام فیزیکی و مبالغ فاکتورها ({toPersianDigits(detailedReportItems.length)} سطر):
                    </td>
                    <td style={{ border: '1px solid #94a3b8', padding: '8px', textAlign: 'center', color: '#0f172a' }}>
                      {toPersianDigits(stats.totalPhysicalQty)} واحد
                    </td>
                    <td colSpan={2} style={{ border: '1px solid #94a3b8', padding: '8px', textAlign: 'left', color: '#0f172a', fontFamily: 'monospace' }}>
                      {toPersianDigits(formatPrice(stats.totalFinal, settings.currency))}
                    </td>
                    <td style={{ border: '1px solid #94a3b8', padding: '8px', textAlign: 'center', color: '#065f46', fontSize: '10px' }}>
                      {toPersianDigits(stats.regularInvoices)} رسمی / {toPersianDigits(stats.proformaInvoices)} پیش‌فاکتور
                    </td>
                  </tr>
                )}
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
              {reportType === 'exit_slips' ? (
                <>
                  <div>
                    <div style={{ fontWeight: 'bold', marginBottom: '35px' }}>مسئول انبار و تحویل کالا</div>
                    <div style={{ color: '#94a3b8', fontSize: '10px' }}>امضا و تاریخ تحویل</div>
                  </div>
                  <div>
                    <div style={{ fontWeight: 'bold', marginBottom: '35px' }}>راننده / تحویل‌گیرنده بار</div>
                    <div style={{ color: '#94a3b8', fontSize: '10px' }}>امضا و اثر انگشت</div>
                  </div>
                  <div>
                    <div style={{ fontWeight: 'bold', marginBottom: '35px' }}>تاییدیه سرپرست انبار و مدیریت</div>
                    <div style={{ color: '#94a3b8', fontSize: '10px' }}>مهر و امضا</div>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <div style={{ fontWeight: 'bold', marginBottom: '35px' }}>کارشناس صدور و فروش</div>
                    <div style={{ color: '#94a3b8', fontSize: '10px' }}>امضا و تاریخ</div>
                  </div>
                  <div>
                    <div style={{ fontWeight: 'bold', marginBottom: '35px' }}>امور مالی و حسابداری</div>
                    <div style={{ color: '#94a3b8', fontSize: '10px' }}>امضا و تاییدیه مالی</div>
                  </div>
                  <div>
                    <div style={{ fontWeight: 'bold', marginBottom: '35px' }}>تاییدیه مدیریت مجموعه</div>
                    <div style={{ color: '#94a3b8', fontSize: '10px' }}>مهر و امضا</div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
