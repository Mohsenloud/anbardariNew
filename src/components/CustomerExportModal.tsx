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
import { Customer, Invoice, ExitSlipData, StoreSettings, Product } from '../types';
import { exportPersonInvoicesAndExitSlipsToExcel } from '../utils/excelHelper';
import { formatPrice, toPersianDigits, getCurrentJalaliDate, getCurrentJalaliTime } from '../utils/jalali';
import { StorageService } from '../utils/storage';
import { exportElementToPdf, printElementInNewWindow } from '../utils/pdfHelper';
import { isServiceItem, hasPhysicalGoods, isPureServiceInvoice } from '../utils/serviceHelper';
import {
  tokenizeSearchQuery,
  checkInvoiceMatchesSearch,
  checkItemMatchesSearch,
  checkInvoiceMetadataMatches,
  checkTokenMatchesText,
  normalizeDateString
} from '../utils/searchHelper';

interface CustomerExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  customers: Customer[];
  invoices: Invoice[];
  products?: Product[];
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
  products: propProducts,
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

  // Products catalog resolution
  const products = useMemo(() => {
    return propProducts && propProducts.length > 0 ? propProducts : StorageService.getProducts();
  }, [propProducts]);

  // Document type for PDF/Print report: 'exit_slips' (NO PRICE COLUMN) or 'invoices' (WITH PRICE COLUMN)
  const [reportType, setReportType] = useState<'exit_slips' | 'invoices'>(() => {
    if (initialReportType) return initialReportType;
    return StorageService.getExportModalPreferences().reportType || 'exit_slips';
  });

  // Filter for item type: all (همه اقلام) | products (فقط کالا و محصول) | services (فقط خدمات)
  const [itemTypeFilter, setItemTypeFilter] = useState<'all' | 'products' | 'services'>(() => {
    return StorageService.getExportModalPreferences().itemTypeFilter || 'all';
  });

  // Filter for specific product or service item
  const [selectedItemFilter, setSelectedItemFilter] = useState<string>(() => {
    return StorageService.getExportModalPreferences().selectedItemFilter || 'all';
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
  const [isPdfPreviewOpen, setIsPdfPreviewOpen] = useState(false);

  // Persist export modal preferences whenever they change (only when modal is actively open)
  React.useEffect(() => {
    if (!isOpen) return;
    StorageService.saveExportModalPreferences({
      pdfOrientation,
      activePreviewTab,
      docTypeFilter,
      deliveryFilter,
      reportType,
      itemTypeFilter,
      selectedItemFilter,
    });
  }, [isOpen, pdfOrientation, activePreviewTab, docTypeFilter, deliveryFilter, reportType, itemTypeFilter, selectedItemFilter]);

  // Sync initialCustomerId and initialReportType when modal opens
  React.useEffect(() => {
    if (!isOpen) return;
    if (initialCustomerId) {
      setSelectedCustomerId((prev) => (prev !== initialCustomerId ? initialCustomerId : prev));
    } else {
      setSelectedCustomerId((prev) => (prev !== 'all' ? 'all' : prev));
    }
  }, [initialCustomerId, isOpen]);

  React.useEffect(() => {
    if (!isOpen) return;
    if (initialReportType) {
      setReportType((prev) => (prev !== initialReportType ? initialReportType : prev));
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

  // Filtered customer list for selector (robust Persian/Arabic/English search)
  const filteredCustomerList = useMemo(() => {
    if (!customerSearch.trim()) return combinedCustomers;
    const tokens = tokenizeSearchQuery(customerSearch);
    return combinedCustomers.filter((c) => {
      const candidates = [c.name, c.phone, c.nationalId, c.address, c.notes];
      return tokens.every((tok) => candidates.some((cand) => checkTokenMatchesText(tok, cand)));
    });
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

  // Tokenized search query for items & invoices
  const searchTokens = useMemo(() => {
    return tokenizeSearchQuery(itemSearch);
  }, [itemSearch]);

  // Available distinct products and services in scope of target invoices
  const availableItems = useMemo(() => {
    const map = new Map<string, {
      name: string;
      code?: string;
      isService: boolean;
      count: number;
    }>();

    const baseInvoices = targetInvoices.length > 0 ? targetInvoices : invoices;
    baseInvoices.forEach((inv) => {
      inv.items?.forEach((it) => {
        const name = (it.productName || it.name || '').trim();
        if (!name) return;
        const isSrv = isServiceItem(it, products);
        const existing = map.get(name);
        if (existing) {
          existing.count += 1;
        } else {
          map.set(name, {
            name,
            code: it.productCode || it.code,
            isService: isSrv,
            count: 1,
          });
        }
      });
    });

    const list = Array.from(map.values());
    list.sort((a, b) => a.name.localeCompare(b.name, 'fa'));
    return list;
  }, [targetInvoices, invoices, products]);

  const physicalProductsList = useMemo(() => {
    return availableItems.filter((i) => !i.isService);
  }, [availableItems]);

  const servicesList = useMemo(() => {
    return availableItems.filter((i) => i.isService);
  }, [availableItems]);

  // Invoices after applying user filters
  const filteredCustomerInvoices = useMemo(() => {
    let result = [...targetInvoices];

    if (searchTokens.length > 0) {
      result = result.filter((inv) => {
        const slip = exitSlipLogs[inv.id];
        return checkInvoiceMatchesSearch(inv, slip, searchTokens);
      });
    }

    if (dateFrom.trim()) {
      const from = normalizeDateString(dateFrom);
      result = result.filter((i) => normalizeDateString(i.date) >= from);
    }
    if (dateTo.trim()) {
      const to = normalizeDateString(dateTo);
      result = result.filter((i) => normalizeDateString(i.date) <= to);
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

    // فیلتر بر اساس ماهیت آیتم: فقط کالا یا فقط خدمات
    if (itemTypeFilter === 'products') {
      result = result.filter((inv) => hasPhysicalGoods(inv, products));
    } else if (itemTypeFilter === 'services') {
      result = result.filter((inv) => inv.items.some((it) => isServiceItem(it, products)));
    }

    // فیلتر بر اساس نام یا کد کالا/خدمات خاص
    if (selectedItemFilter && selectedItemFilter !== 'all') {
      const sel = selectedItemFilter.trim();
      result = result.filter((inv) =>
        inv.items.some((it) => (it.productName && it.productName.trim() === sel) || it.productId === sel || it.productCode === sel)
      );
    }

    result.sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.invoiceNumber || '').localeCompare(a.invoiceNumber || ''));
    return result;
  }, [targetInvoices, searchTokens, dateFrom, dateTo, docTypeFilter, deliveryFilter, itemTypeFilter, selectedItemFilter, products, exitSlipLogs]);

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
      isService: boolean;
    }> = [];

    filteredCustomerInvoices.forEach((inv) => {
      const slip = exitSlipLogs[inv.id] || { invoiceId: inv.id, printCount: 0, history: [] };
      const slipNum = slip.slipNumber || inv.invoiceNumber;
      const isDelivered = Boolean(slip.isDelivered);

      if (inv.items.length === 0) {
        if (itemTypeFilter === 'all' && selectedItemFilter === 'all') {
          if (searchTokens.length === 0 || checkInvoiceMetadataMatches(inv, slip, searchTokens)) {
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
              isService: false,
            });
          }
        }
      } else {
        inv.items.forEach((it, idx) => {
          const isSrv = isServiceItem(it, products);

          // اعمال فیلتر نوع ردیف (کالا یا خدمات)
          if (itemTypeFilter === 'products' && isSrv) return;
          if (itemTypeFilter === 'services' && !isSrv) return;

          // اعمال فیلتر کالا یا خدمت خاص
          if (selectedItemFilter && selectedItemFilter !== 'all') {
            const sel = selectedItemFilter.trim();
            if (it.productName?.trim() !== sel && it.productId !== sel && it.productCode !== sel) return;
          }

          // قانون کلیدی انبارداری: در حواله خروج انبار، ردیف‌های خدماتی قرار نمی‌گیرند
          // ثبت خدمات نیازی به حواله خروج ندارد و نیازی به تولید حواله خروج نیست
          if (reportType === 'exit_slips' && isSrv) {
            return;
          }

          if (searchTokens.length > 0 && !checkItemMatchesSearch(it, inv, slip, searchTokens)) {
            return;
          }

          list.push({
            id: `${inv.id}-${it.productId || idx}`,
            invoiceId: inv.id,
            date: inv.date || '',
            invoiceNumber: inv.invoiceNumber,
            slipNumber: isSrv ? '—' : slipNum,
            customerName: inv.customerName || 'مشتری گذری',
            customerPhone: inv.customerPhone || '',
            productName: it.productName,
            variantName: it.variantName || '',
            quantity: Number(it.quantity) || 0,
            unit: it.unit || (isSrv ? 'موردی' : 'عدد'),
            unitPrice: it.unitPrice || 0,
            total: it.total || 0,
            isProforma: !!inv.isProforma,
            paymentStatus: inv.paymentStatus || 'unpaid',
            isDelivered,
            deliveredAt: slip.deliveredAt,
            deliveredBy: slip.deliveredBy,
            receiverName: slip.receiverName,
            vehicleInfo: slip.vehicleInfo,
            isService: isSrv,
          });
        });
      }
    });

    return list;
  }, [filteredCustomerInvoices, exitSlipLogs, searchTokens, itemTypeFilter, selectedItemFilter, reportType, products]);

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

    filteredCustomerInvoices.forEach((inv) => {
      // فقط فاکتورهای دارای کالای فیزیکی حواله دارند
      if (!inv.isProforma && hasPhysicalGoods(inv, products)) {
        const slip = exitSlipLogs[inv.id];
        if (slip?.isDelivered) {
          deliveredSlips++;
        } else {
          pendingSlips++;
        }
      }
    });

    const totalItemsCount = detailedReportItems.length;
    const totalPhysicalQty = detailedReportItems.reduce((s, it) => {
      return (it as any).isService ? s : s + (Number(it.quantity) || 0);
    }, 0);
    const totalServicesQty = detailedReportItems.reduce((s, it) => {
      return (it as any).isService ? s + (Number(it.quantity) || 0) : s;
    }, 0);

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
      totalServicesQty,
    };
  }, [filteredCustomerInvoices, exitSlipLogs, detailedReportItems, products]);

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
      itemType: itemTypeFilter,
      selectedItem: selectedItemFilter,
      products,
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
    await new Promise((resolve) => setTimeout(resolve, 25));

    try {
      const customerLabel = isAllCustomers ? 'کلیه_اسناد' : (currentCustomer?.name.replace(/[/\\:*?"<>|]/g, '_') || 'شخص');
      const safeDate = getCurrentJalaliDate().replace(/\//g, '-');
      const filename = reportType === 'exit_slips'
        ? `گزارش_حواله_های_خروج_کالا_از_انبار_${customerLabel}_${safeDate}.pdf`
        : `گزارش_رسمی_فاکتورهای_فروش_${customerLabel}_${safeDate}.pdf`;
      
      const res = await exportElementToPdf('invoices-slips-pdf-report-canvas', filename, {
        pageSize: 'a4',
        orientation: pdfOrientation,
        quality: 'high',
        documentType: reportType === 'exit_slips' ? 'exit_slip' : 'invoice',
        marginMm: 10,
      });

      if (res.success) {
        const typeLabel = reportType === 'exit_slips' ? 'حواله‌های خروج انبار' : 'فاکتورهای فروش (همراه با ستون قیمت)';
        setDownloadSuccessMessage(`فایل PDF رسمی ${typeLabel} با موفقیت دانلود شد (${toPersianDigits(detailedReportItems.length)} ردیف کالایی).`);
        setTimeout(() => setDownloadSuccessMessage(null), 6000);
      } else {
        setDownloadSuccessMessage(res.error || 'خطا در تولید فایل PDF');
        setTimeout(() => setDownloadSuccessMessage(null), 5000);
      }
    } catch (err: any) {
      console.error('PDF export error:', err);
      setDownloadSuccessMessage('خطا در صدور فایل PDF');
      setTimeout(() => setDownloadSuccessMessage(null), 5000);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // Handle Direct Print
  const handlePrint = () => {
    if (detailedReportItems.length === 0) return;
    const customerLabel = isAllCustomers ? 'کلیه اسناد' : (currentCustomer?.name || 'مشتری');
    const printTitle = reportType === 'exit_slips'
      ? `گزارش حواله های خروج کالا از انبار - ${customerLabel}`
      : `گزارش رسمی فاکتورهای فروش - ${customerLabel}`;

    printElementInNewWindow('invoices-slips-pdf-report-canvas', printTitle, {
      pageSize: 'a4',
      orientation: pdfOrientation,
    });
  };

  if (!isOpen) return null;

  return (
    <>
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
        <div className="px-3.5 py-2.5 sm:px-5 sm:py-4 border-b border-slate-800 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0">
              <FileSpreadsheet className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.2]" />
            </div>
            <div className="min-w-0">
              <h2 className="text-xs sm:text-base font-black text-white flex items-center gap-1.5 sm:gap-2 flex-wrap">
                <span className="truncate">اکسپورت اکسل و PDF فاکتورها و حواله‌ها</span>
                <span className="text-[10px] font-bold bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-500/30 shrink-0 font-mono">
                  <span className="sm:hidden">{toPersianDigits(filteredCustomerInvoices.length)} سند</span>
                  <span className="hidden sm:inline">{toPersianDigits(filteredCustomerInvoices.length)} سند ({toPersianDigits(detailedReportItems.length)} سطر)</span>
                </span>
              </h2>
              <p className="hidden sm:block text-xs text-slate-300 mt-0.5 truncate">
                تنظیم خروجی‌های رسمی، اکسل گزارش‌گیری و فایل PDF حواله‌های انبار یا فاکتورها
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 sm:p-2 rounded-lg sm:rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer shrink-0 mr-1 sm:mr-0"
            title="بستن"
          >
            <X className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>

        {/* Download Success Banner */}
        {downloadSuccessMessage && (
          <div className="bg-emerald-600 text-white px-4 py-2.5 text-xs font-bold flex items-center justify-between shadow-inner shrink-0">
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
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-slate-800 flex-1 bg-slate-50/60">
          
          {/* PANEL 1: SCOPE & DOCUMENT TYPE */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-2xs">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
              
              {/* Customer Scope Selector (7 cols) */}
              <div className="lg:col-span-7 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                    <User className="w-4 h-4 text-emerald-600" />
                    <span>محدوده طرف حساب / مشتری:</span>
                  </label>
                  {customerSearch && (
                    <button
                      type="button"
                      onClick={() => setCustomerSearch('')}
                      className="text-[10px] font-bold text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      پاک کردن جستجو
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative flex-1 min-w-0">
                    <select
                      id="customer-export-select"
                      value={selectedCustomerId}
                      onChange={(e) => setSelectedCustomerId(e.target.value)}
                      className="w-full h-10 pr-3 pl-8 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all shadow-2xs cursor-pointer"
                    >
                      <option value="all">
                        🌐 کلیه مشتریان و طرف‌های حساب (گزارش عمومی)
                      </option>
                      <optgroup label="مشتریان ثبت‌شده">
                        {filteredCustomerList.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name} {c.phone ? `(${toPersianDigits(c.phone)})` : ''}
                          </option>
                        ))}
                      </optgroup>
                    </select>
                  </div>

                  {/* Customer Quick Search input */}
                  <div className="relative w-40 sm:w-48 shrink-0">
                    <input
                      type="text"
                      value={customerSearch}
                      onChange={(e) => setCustomerSearch(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && filteredCustomerList.length > 0) {
                          setSelectedCustomerId(filteredCustomerList[0].id);
                        }
                      }}
                      placeholder="جستجوی مشتری..."
                      className="w-full h-10 pr-8 pl-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all shadow-2xs"
                    />
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>

                {/* Selected customer details pill */}
                {currentCustomer && (
                  <div className="p-2 bg-emerald-50/70 border border-emerald-200/80 rounded-xl text-xs flex items-center justify-between text-emerald-950 flex-wrap gap-2">
                    <div className="flex items-center gap-3 flex-wrap font-medium text-[11px]">
                      <span className="font-bold text-emerald-900 flex items-center gap-1">
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        {currentCustomer.name}
                      </span>
                      {currentCustomer.phone && (
                        <span className="font-mono text-slate-600">تلفن: {toPersianDigits(currentCustomer.phone)}</span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCustomerId('all');
                        setCustomerSearch('');
                      }}
                      className="text-[10px] font-bold text-indigo-700 hover:text-indigo-900 underline cursor-pointer"
                    >
                      نمایش کلیه اسناد
                    </button>
                  </div>
                )}
              </div>

              {/* PDF Document Mode Switch (5 cols) */}
              <div className="lg:col-span-5 space-y-2">
                <label className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-indigo-600" />
                  <span>نوع سند خروجی (PDF / چاپ):</span>
                </label>

                <div className="grid grid-cols-2 gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200">
                  <button
                    id="report-type-exit-slips-btn"
                    type="button"
                    onClick={() => setReportType('exit_slips')}
                    className={`flex items-center justify-center gap-1.5 h-8 px-2.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                      reportType === 'exit_slips'
                        ? 'bg-amber-600 text-white shadow-xs'
                        : 'text-slate-600 hover:bg-slate-200/70'
                    }`}
                    title="حواله خروج انبار (فاقد ستون قیمت)"
                  >
                    <Truck className="w-3.5 h-3.5" />
                    <span>حواله خروج (بدون قیمت)</span>
                  </button>

                  <button
                    id="report-type-invoices-btn"
                    type="button"
                    onClick={() => setReportType('invoices')}
                    className={`flex items-center justify-center gap-1.5 h-8 px-2.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                      reportType === 'invoices'
                        ? 'bg-indigo-700 text-white shadow-xs'
                        : 'text-slate-600 hover:bg-slate-200/70'
                    }`}
                    title="فاکتورهای فروش (با ستون قیمت و مبالغ مالی)"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>فاکتور فروش (با قیمت)</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* PANEL 2: FILTERS */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-2xs space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-slate-100">
              <div className="flex items-center gap-1.5 text-xs font-black text-slate-800">
                <Filter className="w-3.5 h-3.5 text-indigo-600" />
                <span>فیلترهای سفارشی</span>
              </div>

              {(itemSearch || dateFrom || dateTo || docTypeFilter !== 'all' || deliveryFilter !== 'all' || itemTypeFilter !== 'all' || selectedItemFilter !== 'all') && (
                <button
                  id="clear-export-filters-btn"
                  onClick={() => {
                    setItemSearch('');
                    setDateFrom('');
                    setDateTo('');
                    setDocTypeFilter('all');
                    setDeliveryFilter('all');
                    setItemTypeFilter('all');
                    setSelectedItemFilter('all');
                  }}
                  className="text-[11px] font-extrabold text-rose-600 hover:text-rose-800 hover:underline cursor-pointer"
                >
                  ✕ پاک کردن فیلترها
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 text-xs">
              {/* Search input */}
              <div className="col-span-2 sm:col-span-1 lg:col-span-1">
                <label className="text-[11px] font-bold text-slate-600 block mb-1">جستجو:</label>
                <div className="relative">
                  <input
                    id="export-search-input"
                    type="text"
                    value={itemSearch}
                    onChange={(e) => setItemSearch(e.target.value)}
                    placeholder="نام کالا، کد، شماره..."
                    className="w-full h-9 pr-8 pl-7 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  {itemSearch && (
                    <button
                      type="button"
                      onClick={() => setItemSearch('')}
                      className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Date From */}
              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">از تاریخ:</label>
                <input
                  id="filter-date-from"
                  type="text"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  placeholder="۱۴۰۳/۰۱/۰۱"
                  className="w-full h-9 px-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 text-center"
                />
              </div>

              {/* Date To */}
              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">تا تاریخ:</label>
                <input
                  id="filter-date-to"
                  type="text"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  placeholder="۱۴۰۳/۱۲/۲۹"
                  className="w-full h-9 px-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 text-center"
                />
              </div>

              {/* Item Type (همه / کالا / خدمات) */}
              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">نوع قلم:</label>
                <select
                  value={itemTypeFilter}
                  onChange={(e) => {
                    setItemTypeFilter(e.target.value as any);
                    setSelectedItemFilter('all');
                  }}
                  className="w-full h-9 px-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                >
                  <option value="all">همه اقلام</option>
                  <option value="products">فقط کالا</option>
                  <option value="services">فقط خدمات</option>
                </select>
              </div>

              {/* Specific Item Select */}
              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">کالا / خدمت خاص:</label>
                <select
                  id="product-service-filter-select"
                  value={selectedItemFilter}
                  onChange={(e) => setSelectedItemFilter(e.target.value)}
                  className="w-full h-9 px-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer truncate"
                >
                  <option value="all">همه موارد</option>
                  {itemTypeFilter !== 'services' && physicalProductsList.length > 0 && (
                    <optgroup label="📦 کالاها">
                      {physicalProductsList.map((item) => (
                        <option key={`prod-${item.name}`} value={item.name}>
                          {item.name}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {itemTypeFilter !== 'products' && servicesList.length > 0 && (
                    <optgroup label="🛠️ خدمات">
                      {servicesList.map((item) => (
                        <option key={`srv-${item.name}`} value={item.name}>
                          {item.name}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </div>
            </div>
          </div>

          {/* STATS RIBBON */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs font-medium">
            <div className="p-3 bg-white border border-slate-200/90 rounded-xl flex items-center justify-between shadow-2xs">
              <span className="text-[11px] text-slate-500 font-bold">تعداد کل اسناد:</span>
              <span className="font-mono font-black text-slate-900 text-sm">
                {toPersianDigits(stats.totalInvoices)} <span className="text-[10px] text-slate-400 font-normal">سند</span>
              </span>
            </div>

            <div className="p-3 bg-blue-50/60 border border-blue-200/70 rounded-xl flex items-center justify-between shadow-2xs">
              <span className="text-[11px] text-blue-800 font-bold">اقلام فیزیکی:</span>
              <span className="font-mono font-black text-blue-950 text-sm">
                {toPersianDigits(stats.totalPhysicalQty)} <span className="text-[10px] text-blue-600 font-normal">واحد</span>
              </span>
            </div>

            <div className="p-3 bg-amber-50/60 border border-amber-200/70 rounded-xl flex items-center justify-between shadow-2xs">
              <span className="text-[11px] text-amber-800 font-bold">وضعیت تحویل:</span>
              <span className="font-mono font-black text-amber-950 text-xs">
                {toPersianDigits(stats.deliveredSlips)} تحویل / {toPersianDigits(stats.pendingSlips)} معوق
              </span>
            </div>

            <div className="p-3 bg-emerald-50/60 border border-emerald-200/70 rounded-xl flex items-center justify-between shadow-2xs">
              <span className="text-[11px] text-emerald-800 font-bold">
                {reportType === 'exit_slips' ? 'بار مالی:' : 'جمع مالی فاکتورها:'}
              </span>
              <span className="font-mono font-black text-emerald-950 text-xs">
                {reportType === 'exit_slips' 
                  ? 'گردش کالا (بدون قیمت)' 
                  : toPersianDigits(formatPrice(stats.totalFinal, settings.currency))}
              </span>
            </div>
          </div>

          {/* LIVE PREVIEW SECTION */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
            <div className="p-3 border-b border-slate-200 bg-slate-50/80 flex items-center justify-between flex-wrap gap-2">
              {/* Preview Tabs */}
              <div className="flex items-center gap-1 bg-slate-200/70 p-1 rounded-xl">
                <button
                  id="preview-tab-items"
                  type="button"
                  onClick={() => setActivePreviewTab('items')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                    activePreviewTab === 'items'
                      ? (reportType === 'exit_slips' ? 'bg-amber-600 text-white shadow-xs' : 'bg-indigo-700 text-white shadow-xs')
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>
                    جدول ریز اقلام PDF ({toPersianDigits(detailedReportItems.length)} قلم)
                  </span>
                </button>

                <button
                  id="preview-tab-invoices"
                  type="button"
                  onClick={() => {
                    setActivePreviewTab('invoices');
                    setReportType('invoices');
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
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
                  type="button"
                  onClick={() => {
                    setActivePreviewTab('slips');
                    setReportType('exit_slips');
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                    activePreviewTab === 'slips'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <Truck className="w-3.5 h-3.5" />
                  <span>حواله‌های خروج ({toPersianDigits(filteredCustomerInvoices.length)})</span>
                </button>
              </div>

              {/* PDF Orientation Selector */}
              <div className="flex items-center gap-2 text-xs">
                <span className="text-[11px] text-slate-500 font-bold">جهت کاغذ PDF:</span>
                <div className="inline-flex bg-slate-200/80 p-0.5 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setPdfOrientation('landscape')}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-extrabold transition-all cursor-pointer ${
                      pdfOrientation === 'landscape' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500'
                    }`}
                  >
                    افقی
                  </button>
                  <button
                    type="button"
                    onClick={() => setPdfOrientation('portrait')}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-extrabold transition-all cursor-pointer ${
                      pdfOrientation === 'portrait' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500'
                    }`}
                  >
                    عمودی
                  </button>
                </div>
              </div>
            </div>

            {/* Tab 1: Detailed Items Table Preview */}
            {activePreviewTab === 'items' && (
              <div className="overflow-x-auto max-h-60 divide-y divide-slate-200">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-100/90 text-slate-700 font-bold sticky top-0 z-10 border-b border-slate-200">
                    <tr>
                      <th className="p-2.5 w-10 text-center">#</th>
                      <th className="p-2.5 w-24">تاریخ</th>
                      {reportType === 'exit_slips' ? (
                        <>
                          <th className="p-2.5 w-24 text-amber-900 font-bold">شماره حواله</th>
                          <th className="p-2.5 w-24">شماره فاکتور</th>
                          <th className="p-2.5 w-36">تحویل‌گیرنده / طرف حساب</th>
                          <th className="p-2.5">عنوان کالا</th>
                          <th className="p-2.5 w-20 text-center">مقدار</th>
                          <th className="p-2.5 w-20 text-center">وضعیت تحویل</th>
                          <th className="p-2.5 w-32 text-center">راننده / خودرو</th>
                        </>
                      ) : (
                        <>
                          <th className="p-2.5 w-24 font-bold text-indigo-900">شماره فاکتور</th>
                          <th className="p-2.5 w-24">شماره حواله</th>
                          <th className="p-2.5 w-36">خریدار / طرف حساب</th>
                          <th className="p-2.5">عنوان کالا / خدمت</th>
                          <th className="p-2.5 w-20 text-center">مقدار</th>
                          <th className="p-2.5 w-24 text-left">قیمت واحد</th>
                          <th className="p-2.5 w-28 text-left">مبلغ کل</th>
                          <th className="p-2.5 w-20 text-center">تسویه</th>
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
                        <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                          <td className="p-2 text-center text-slate-400 font-mono text-[11px]">{toPersianDigits(idx + 1)}</td>
                          <td className="p-2 font-mono text-slate-600 text-[11px]">{toPersianDigits(item.date)}</td>

                          {reportType === 'exit_slips' ? (
                            <>
                              <td className="p-2 font-mono text-amber-700 font-extrabold">{toPersianDigits(item.slipNumber)}</td>
                              <td className="p-2 font-mono text-slate-600">{toPersianDigits(item.invoiceNumber)}</td>
                              <td className="p-2 font-bold text-slate-800 truncate max-w-[130px]">{item.customerName}</td>
                              <td className="p-2">
                                <span className="font-extrabold text-slate-900">{item.productName}</span>
                                {item.variantName && (
                                  <span className="text-[10px] text-amber-700 bg-amber-50 px-1 py-0.2 rounded mr-1">
                                    {item.variantName}
                                  </span>
                                )}
                              </td>
                              <td className="p-2 text-center font-black text-slate-900">
                                {toPersianDigits(item.quantity)}{' '}
                                <span className="text-[10px] text-slate-400 font-normal">{item.unit}</span>
                              </td>
                              <td className="p-2 text-center">
                                <span className={`inline-block px-1.5 py-0.2 rounded text-[10px] font-bold ${
                                  item.isDelivered ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                                }`}>
                                  {item.isDelivered ? 'تحویل شد' : 'در انتظار'}
                                </span>
                              </td>
                              <td className="p-2 text-center text-[11px] text-slate-600 truncate max-w-[120px]">
                                {item.receiverName || item.vehicleInfo ? (
                                  <span>{item.receiverName || ''}{item.vehicleInfo ? ` (${item.vehicleInfo})` : ''}</span>
                                ) : (
                                  <span className="text-slate-300">—</span>
                                )}
                              </td>
                            </>
                          ) : (
                            <>
                              <td className="p-2 font-mono font-black text-slate-900">{toPersianDigits(item.invoiceNumber)}</td>
                              <td className="p-2 font-mono text-indigo-700 font-bold">{toPersianDigits(item.slipNumber)}</td>
                              <td className="p-2 font-bold text-slate-800 truncate max-w-[130px]">{item.customerName}</td>
                              <td className="p-2">
                                <span className="font-extrabold text-slate-900">{item.productName}</span>
                                {item.variantName && (
                                  <span className="text-[10px] text-indigo-600 bg-indigo-50 px-1 py-0.2 rounded mr-1">
                                    {item.variantName}
                                  </span>
                                )}
                              </td>
                              <td className="p-2 text-center font-black text-slate-900">
                                {toPersianDigits(item.quantity)}{' '}
                                <span className="text-[10px] text-slate-400 font-normal">{item.unit}</span>
                              </td>
                              <td className="p-2 text-left font-mono text-slate-700 text-[11px]">
                                {toPersianDigits(formatPrice(item.unitPrice, ''))}
                              </td>
                              <td className="p-2 text-left font-mono font-black text-slate-900">
                                {toPersianDigits(formatPrice(item.total, ''))}
                              </td>
                              <td className="p-2 text-center">
                                <span className={`inline-block px-1.5 py-0.2 rounded text-[10px] font-bold ${
                                  item.paymentStatus === 'paid'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : item.paymentStatus === 'partial'
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-rose-100 text-rose-800'
                                }`}>
                                  {item.paymentStatus === 'paid' ? 'تسویه' : item.paymentStatus === 'partial' ? 'ناقص' : 'نسیه'}
                                </span>
                              </td>
                            </>
                          )}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* Tab 2: Invoices Preview */}
            {activePreviewTab === 'invoices' && (
              <div className="max-h-60 overflow-y-auto divide-y divide-slate-100">
                {filteredCustomerInvoices.length === 0 ? (
                  <div className="text-center py-8 text-slate-400 text-xs">
                    هیچ فاکتوری یافت نشد.
                  </div>
                ) : (
                  filteredCustomerInvoices.map((inv) => {
                    const isPaid = inv.paymentStatus === 'paid';
                    const isPartial = inv.paymentStatus === 'partial';

                    return (
                      <div key={inv.id} className="p-2.5 bg-white hover:bg-slate-50 transition-colors flex items-center justify-between text-xs">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-slate-900 font-mono">
                              فاکتور: {toPersianDigits(inv.invoiceNumber)}
                            </span>
                            <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                              inv.isProforma ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'
                            }`}>
                              {inv.isProforma ? 'پیش‌فاکتور' : 'رسمی'}
                            </span>
                            <span className="text-slate-400 text-[11px] font-mono">{toPersianDigits(inv.date)}</span>
                            <span className="text-slate-800 font-bold">{inv.customerName}</span>
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {toPersianDigits(inv.items.length)} قلم کالا ({toPersianDigits(inv.items.reduce((s, it) => s + (Number(it.quantity) || 0), 0))} واحد)
                          </div>
                        </div>

                        <div className="text-left space-y-0.5">
                          <div className="font-black text-slate-900 font-mono">
                            {toPersianDigits(formatPrice(inv.finalTotal, settings.currency))}
                          </div>
                          <span className={`inline-block px-1.5 py-0.2 rounded text-[10px] font-bold ${
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
              <div className="max-h-60 overflow-y-auto divide-y divide-slate-100">
                {filteredCustomerInvoices.length === 0 ? (
                  <div className="text-center py-8 text-slate-400 text-xs">
                    هیچ حواله‌ای یافت نشد.
                  </div>
                ) : (
                  filteredCustomerInvoices.map((inv) => {
                    const slip = exitSlipLogs[inv.id] || { invoiceId: inv.id, printCount: 0, history: [] };
                    const slipNum = slip.slipNumber || inv.invoiceNumber;
                    const isDelivered = Boolean(slip.isDelivered);

                    return (
                      <div key={inv.id} className="p-2.5 bg-white hover:bg-slate-50 transition-colors flex items-center justify-between text-xs">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-slate-900 font-mono">
                              حواله خروج: {toPersianDigits(slipNum)}
                            </span>
                            <span className="text-[11px] text-slate-400 font-mono">
                              (فاکتور {toPersianDigits(inv.invoiceNumber)})
                            </span>
                            <span className="text-slate-400 text-[11px] font-mono">{toPersianDigits(inv.date)}</span>
                            <span className="text-slate-800 font-bold">{inv.customerName}</span>
                          </div>
                          <div className="text-[11px] text-slate-600 flex flex-wrap gap-x-3">
                            <span>کالاها: {toPersianDigits(inv.items.length)} ردیف</span>
                            {slip.receiverName && <span>تحویل‌گیرنده: {slip.receiverName}</span>}
                            {slip.vehicleInfo && <span>خودرو: {slip.vehicleInfo}</span>}
                          </div>
                        </div>

                        <div className="text-left">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                            isDelivered
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                              : 'bg-amber-100 text-amber-800 border border-amber-200'
                          }`}>
                            {isDelivered ? 'تحویل شد' : 'در انتظار تحویل'}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-3 sm:p-4 border-t border-slate-200 bg-slate-50/80 sm:bg-white flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-600 flex items-center justify-between sm:justify-start gap-2 px-1 sm:px-0">
            <span>
              {isAllCustomers ? (
                <>مجموع: <strong className="text-slate-900">{toPersianDigits(filteredCustomerInvoices.length)} سند</strong> ({toPersianDigits(detailedReportItems.length)} قلم کالا)</>
              ) : currentCustomer ? (
                <>طرف حساب: <strong className="text-slate-900">{currentCustomer.name}</strong> ({toPersianDigits(filteredCustomerInvoices.length)} سند)</>
              ) : null}
            </span>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full sm:w-auto">
            {/* Primary Export Buttons: 2 Equal Columns on Mobile */}
            <div className="grid grid-cols-2 gap-2 w-full sm:w-auto sm:flex sm:items-center order-1 sm:order-2">
              {/* PDF Preview & Export Button */}
              <button
                id="download-customer-pdf-btn"
                type="button"
                onClick={() => setIsPdfPreviewOpen(true)}
                disabled={detailedReportItems.length === 0}
                className={`w-full sm:w-auto px-3.5 sm:px-4 py-2.5 sm:py-2 text-xs font-black text-white rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:bg-slate-300 disabled:cursor-not-allowed ${
                  reportType === 'exit_slips'
                    ? 'bg-amber-600 hover:bg-amber-700 active:bg-amber-800'
                    : 'bg-indigo-700 hover:bg-indigo-800 active:bg-indigo-900'
                }`}
                title="پیش‌نمایش کامل برگه و صدور فایل PDF"
              >
                <Eye className="w-4 h-4 shrink-0" />
                <span className="truncate">پیش‌نمایش و PDF</span>
              </button>

              {/* Excel Export Button */}
              <button
                id="download-customer-excel-btn"
                type="button"
                onClick={handleExportExcel}
                disabled={filteredCustomerInvoices.length === 0}
                className="w-full sm:w-auto px-3.5 sm:px-4 py-2.5 sm:py-2 text-xs font-black text-white bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 disabled:bg-slate-300 disabled:cursor-not-allowed rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                title="دانلود فایل اکسل کامل"
              >
                <Download className="w-4 h-4 shrink-0" />
                <span className="truncate">اکسپورت اکسل</span>
              </button>
            </div>

            {/* Secondary Utility Buttons: 2 Equal Columns on Mobile */}
            <div className="grid grid-cols-2 gap-2 w-full sm:w-auto sm:flex sm:items-center order-2 sm:order-1">
              {/* Print Button */}
              <button
                id="print-customer-report-btn"
                type="button"
                onClick={handlePrint}
                disabled={detailedReportItems.length === 0}
                className="w-full sm:w-auto px-3 sm:px-3.5 py-2.5 sm:py-2 text-xs font-bold text-slate-800 bg-white hover:bg-slate-100 active:bg-slate-200 border border-slate-300 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-2xs"
                title="پیش‌نمایش و چاپ مستقیم بر روی کاغذ A4"
              >
                <Printer className="w-4 h-4 text-slate-600 shrink-0" />
                <span className="truncate">چاپ مستقیم</span>
              </button>

              {/* Cancel / Close Button */}
              <button
                id="cancel-customer-export-btn"
                type="button"
                onClick={onClose}
                className="w-full sm:w-auto px-4 py-2.5 sm:py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 border border-slate-300 rounded-xl transition-colors cursor-pointer text-center"
              >
                بستن
              </button>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* HIDDEN / OFFSCREEN FULL-FIDELITY PDF REPORT CONTAINER FOR HTML2CANVAS */}
        {/* In Exit Slips (حواله خروج): NO PRICE COLUMN! Only in Invoices (فاکتورها) price column exists! */}
        {/* ========================================================================= */}
        <div style={{ position: 'absolute', left: '-9999px', top: '0', zIndex: -100 }}>
          <div
            id="invoices-slips-pdf-report-canvas"
            className="no-pdf-border"
            dir="rtl"
            style={{
              width: pdfOrientation === 'landscape' ? '1180px' : '820px',
              backgroundColor: '#ffffff',
              padding: '0',
              fontFamily: "'Vazirmatn', -apple-system, BlinkMacSystemFont, sans-serif",
              color: '#0f172a',
              boxSizing: 'border-box',
              border: 'none',
              outline: 'none',
              boxShadow: 'none',
            }}
          >
            {/* Official Report Table with Persistent Repeating Header */}
            <table className="no-pdf-border" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px', direction: 'rtl', border: 'none' }}>
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
                      style={{ borderBottom: 'none', paddingBottom: '14px', marginBottom: '8px' }}
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
                              <span>گزارش حواله های خروج کالا از انبار</span>
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
                                  border: 'none'
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
                        border: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        fontSize: '11px'
                      }}>
                        <div>
                          <div>
                            طرف حساب: <strong style={{ color: '#0f172a' }}>{isAllCustomers ? 'کلیه طرف‌های حساب و متقاضیان (گزارش عمومی)' : currentCustomer?.name}</strong>
                            {currentCustomer?.phone && <span> — تلفن: {toPersianDigits(currentCustomer.phone)}</span>}
                            {currentCustomer?.nationalId && <span> — کد اقتصادی/ملی: {toPersianDigits(currentCustomer.nationalId)}</span>}
                          </div>
                          {(itemTypeFilter !== 'all' || (selectedItemFilter && selectedItemFilter !== 'all')) && (
                            <div style={{ marginTop: '3px', color: '#3730a3', fontSize: '10px', fontWeight: 'bold' }}>
                              فیلتر اقلام: {itemTypeFilter === 'products' ? 'فقط کالاهای فیزیکی' : itemTypeFilter === 'services' ? 'فقط خدمات و سرویس‌ها' : 'کلیه اقلام'}
                              {selectedItemFilter && selectedItemFilter !== 'all' ? ` — قلم انتخابی: «${selectedItemFilter}»` : ''}
                            </div>
                          )}
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
                  <th style={{ border: 'none', padding: '6px 4px', textAlign: 'center', width: '32px' }}>ردیف</th>
                  <th style={{ border: 'none', padding: '6px', textAlign: 'center', width: '70px' }}>تاریخ</th>
                  
                  {reportType === 'exit_slips' ? (
                    // EXIT SLIPS HEADER: STRICTLY NO PRICE COLUMN
                    <>
                      <th style={{ border: 'none', padding: '6px', textAlign: 'center', width: '85px' }}>شماره حواله خروج</th>
                      <th style={{ border: 'none', padding: '6px', textAlign: 'center', width: '75px' }}>شماره فاکتور</th>
                      <th style={{ border: 'none', padding: '6px', textAlign: 'right', width: '120px' }}>تحویل‌گیرنده / خریدار</th>
                      <th style={{ border: 'none', padding: '6px', textAlign: 'right' }}>نوع و شرح جنس (کالا)</th>
                      <th style={{ border: 'none', padding: '6px', textAlign: 'center', width: '80px' }}>مقدار و واحد</th>
                      <th style={{ border: 'none', padding: '6px', textAlign: 'center', width: '75px' }}>وضعیت تحویل</th>
                      <th style={{ border: 'none', padding: '6px', textAlign: 'right', width: '110px' }}>مشخصات راننده / خودرو</th>
                    </>
                  ) : (
                    // INVOICES HEADER: WITH UNIT PRICE AND ROW TOTAL AMOUNT
                    <>
                      <th style={{ border: 'none', padding: '6px', textAlign: 'center', width: '75px' }}>شماره فاکتور</th>
                      <th style={{ border: 'none', padding: '6px', textAlign: 'center', width: '75px' }}>شماره حواله</th>
                      <th style={{ border: 'none', padding: '6px', textAlign: 'right', width: '110px' }}>خریدار / طرف حساب</th>
                      <th style={{ border: 'none', padding: '6px', textAlign: 'right' }}>نوع و شرح جنس (کالا)</th>
                      <th style={{ border: 'none', padding: '6px', textAlign: 'center', width: '65px' }}>مقدار جنس</th>
                      <th style={{ border: 'none', padding: '6px', textAlign: 'left', width: '75px' }}>فی واحد ({settings.currency})</th>
                      <th style={{ border: 'none', padding: '6px', textAlign: 'left', width: '85px' }}>مبلغ کل ردیف</th>
                      <th style={{ border: 'none', padding: '6px', textAlign: 'center', width: '70px' }}>وضعیت تسویه</th>
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
                    <td style={{ border: 'none', padding: '5px 4px', textAlign: 'center', fontWeight: 'bold' }}>
                      {toPersianDigits(idx + 1)}
                    </td>
                    <td style={{ border: 'none', padding: '5px', textAlign: 'center', fontFamily: 'monospace' }}>
                      {toPersianDigits(item.date)}
                    </td>

                    {reportType === 'exit_slips' ? (
                      // EXIT SLIP ROW CELLS - STRICTLY NO PRICE OR FEE!
                      <>
                        <td style={{ border: 'none', padding: '5px', textAlign: 'center', fontWeight: 'bold', color: '#b45309', fontFamily: 'monospace' }}>
                          {toPersianDigits(item.slipNumber)}
                        </td>
                        <td style={{ border: 'none', padding: '5px', textAlign: 'center', fontFamily: 'monospace', color: '#475569' }}>
                          {toPersianDigits(item.invoiceNumber)}
                        </td>
                        <td style={{ border: 'none', padding: '5px', textAlign: 'right', fontWeight: 'bold' }}>
                          {item.customerName}
                        </td>
                        <td style={{ border: 'none', padding: '5px', textAlign: 'right' }}>
                          <span style={{ fontWeight: 'bold', color: '#0f172a' }}>{item.productName}</span>
                          {item.variantName ? <span style={{ color: '#b45309', fontSize: '9px', marginRight: '4px' }}>({item.variantName})</span> : null}
                        </td>
                        <td style={{ border: 'none', padding: '5px', textAlign: 'center', fontWeight: 'bold' }}>
                          {toPersianDigits(item.quantity)} {item.unit}
                        </td>
                        <td style={{ border: 'none', padding: '5px', textAlign: 'center' }}>
                          <span style={{ 
                            color: item.isDelivered ? '#065f46' : '#92400e',
                            fontWeight: 'bold',
                            fontSize: '9px'
                          }}>
                            {item.isDelivered ? 'تحویل شد' : 'در انتظار'}
                          </span>
                        </td>
                        <td style={{ border: 'none', padding: '5px', textAlign: 'right', fontSize: '9px', color: '#475569' }}>
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
                        <td style={{ border: 'none', padding: '5px', textAlign: 'center', fontWeight: 'bold', fontFamily: 'monospace' }}>
                          {toPersianDigits(item.invoiceNumber)}
                        </td>
                        <td style={{ border: 'none', padding: '5px', textAlign: 'center', fontWeight: 'bold', color: '#3730a3', fontFamily: 'monospace' }}>
                          {toPersianDigits(item.slipNumber)}
                        </td>
                        <td style={{ border: 'none', padding: '5px', textAlign: 'right', fontWeight: 'bold' }}>
                          {item.customerName}
                        </td>
                        <td style={{ border: 'none', padding: '5px', textAlign: 'right' }}>
                          <span style={{ fontWeight: 'bold', color: '#0f172a' }}>{item.productName}</span>
                          {item.variantName ? <span style={{ color: '#4338ca', fontSize: '9px', marginRight: '4px' }}>({item.variantName})</span> : null}
                        </td>
                        <td style={{ border: 'none', padding: '5px', textAlign: 'center', fontWeight: 'bold' }}>
                          {toPersianDigits(item.quantity)} {item.unit}
                        </td>
                        <td style={{ border: 'none', padding: '5px', textAlign: 'left', fontFamily: 'monospace', color: '#334155' }}>
                          {toPersianDigits(formatPrice(item.unitPrice, ''))}
                        </td>
                        <td style={{ border: 'none', padding: '5px', textAlign: 'left', fontFamily: 'monospace', fontWeight: 'bold' }}>
                          {toPersianDigits(formatPrice(item.total, ''))}
                        </td>
                        <td style={{ border: 'none', padding: '5px', textAlign: 'center', fontSize: '9px', fontWeight: 'bold' }}>
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
                    <td colSpan={6} style={{ border: 'none', padding: '8px', textAlign: 'right' }}>
                      مجموع کل اقلام فیزیکی تحویل شده از انبار ({toPersianDigits(detailedReportItems.length)} سطر کالایی):
                    </td>
                    <td style={{ border: 'none', padding: '8px', textAlign: 'center', color: '#0f172a' }}>
                      {toPersianDigits(stats.totalPhysicalQty)} واحد
                    </td>
                    <td style={{ border: 'none', padding: '8px', textAlign: 'center', color: '#065f46', fontSize: '10px' }}>
                      {toPersianDigits(stats.deliveredSlips)} تحویل شد
                    </td>
                    <td style={{ border: 'none', padding: '8px', textAlign: 'center', color: '#64748b', fontSize: '10px' }}>
                      (فاقد گردش مالی)
                    </td>
                  </tr>
                ) : (
                  // INVOICES FOOTER: WITH FINANCIAL TOTALS
                  <tr style={{ backgroundColor: '#e2e8f0', fontWeight: '900', fontSize: '11px' }}>
                    <td colSpan={6} style={{ border: 'none', padding: '8px', textAlign: 'right' }}>
                      جمع کل اقلام فیزیکی و مبالغ فاکتورها ({toPersianDigits(detailedReportItems.length)} سطر):
                    </td>
                    <td style={{ border: 'none', padding: '8px', textAlign: 'center', color: '#0f172a' }}>
                      {toPersianDigits(stats.totalPhysicalQty)} واحد
                    </td>
                    <td colSpan={2} style={{ border: 'none', padding: '8px', textAlign: 'left', color: '#0f172a', fontFamily: 'monospace' }}>
                      {toPersianDigits(formatPrice(stats.totalFinal, settings.currency))}
                    </td>
                    <td style={{ border: 'none', padding: '8px', textAlign: 'center', color: '#065f46', fontSize: '10px' }}>
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
              borderTop: 'none', 
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

      {/* ========================================================================= */}
      {/* INTERACTIVE FULL-SCREEN PDF PREVIEW MODAL DEDICATED OVERLAY               */}
      {/* ========================================================================= */}
      {isPdfPreviewOpen && (
        <div
          id="pdf-preview-modal-overlay"
          className="fixed inset-0 z-[60] flex items-center justify-center p-2 sm:p-4 bg-slate-950/85 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200"
          dir="rtl"
        >
          <div className="bg-slate-900 rounded-2xl shadow-2xl border border-slate-800 w-full max-w-5xl overflow-hidden flex flex-col max-h-[94vh]">
            {/* Preview Header */}
            <div className="px-3.5 py-2.5 sm:p-4 border-b border-slate-800 bg-slate-900 text-white flex items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center shrink-0">
                  <Eye className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.2]" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-xs sm:text-base font-black text-white flex items-center gap-1.5 sm:gap-2">
                    <span className="truncate">پیش‌نمایش PDF ({reportType === 'exit_slips' ? 'حواله خروج' : 'فاکتور فروش'})</span>
                    <span className="text-[10px] font-bold bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-full border border-indigo-500/30 font-mono shrink-0">
                      {toPersianDigits(detailedReportItems.length)} سطر
                    </span>
                  </h3>
                  <p className="hidden sm:block text-xs text-slate-300 mt-0.5 truncate">
                    نمای واقعی و دقیق سند PDF قبل از دانلود نهایی فایل
                  </p>
                </div>
              </div>

              {/* Header Right Actions */}
              <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                {/* Orientation Selector */}
                <div className="flex items-center gap-1 text-xs bg-slate-800 p-0.5 sm:p-1 rounded-lg sm:rounded-xl border border-slate-700">
                  <button
                    type="button"
                    onClick={() => setPdfOrientation('landscape')}
                    className={`px-2 py-1 sm:px-2.5 sm:py-1 rounded-md sm:rounded-lg text-[10px] sm:text-[11px] font-extrabold transition-all cursor-pointer ${
                      pdfOrientation === 'landscape' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    افقی
                  </button>
                  <button
                    type="button"
                    onClick={() => setPdfOrientation('portrait')}
                    className={`px-2 py-1 sm:px-2.5 sm:py-1 rounded-md sm:rounded-lg text-[10px] sm:text-[11px] font-extrabold transition-all cursor-pointer ${
                      pdfOrientation === 'portrait' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    عمودی
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setIsPdfPreviewOpen(false)}
                  className="p-1.5 sm:p-2 text-slate-400 hover:text-white rounded-lg sm:rounded-xl hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
                  title="بستن پیش‌نمایش"
                >
                  <X className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>
              </div>
            </div>

            {/* Simulated Paper Sheet Preview Container */}
            <div className="p-4 sm:p-8 overflow-y-auto bg-slate-950/70 flex-1 flex justify-center">
              <div
                className="bg-white text-slate-900 shadow-2xl rounded-none p-6 sm:p-8 w-full transition-all border-0"
                style={{
                  maxWidth: pdfOrientation === 'landscape' ? '1020px' : '780px',
                  fontFamily: "'Vazirmatn', -apple-system, BlinkMacSystemFont, sans-serif",
                  backgroundColor: '#ffffff',
                  border: 'none',
                  outline: 'none',
                  boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.25), 0 8px 10px -6px rgba(0, 0, 0, 0.25)',
                }}
              >
                {/* Paper Header */}
                <div className="border-b-2 border-slate-900 pb-3 mb-3 flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <h1 className="text-base sm:text-lg font-black text-slate-900">{settings.storeName || 'سامانه مدیریت انبار و فاکتورها'}</h1>
                    <h2 className={`text-xs sm:text-sm font-bold mt-1 ${reportType === 'exit_slips' ? 'text-amber-800' : 'text-indigo-900'}`}>
                      {reportType === 'exit_slips' ? 'گزارش رسمی حواله‌های خروج کالا از انبار' : 'گزارش رسمی اقلام و فاکتورهای فروش'}
                    </h2>
                  </div>
                  <div className="text-left text-[11px] text-slate-600 space-y-0.5 font-mono">
                    <div>تاریخ: <strong>{toPersianDigits(getCurrentJalaliDate())}</strong></div>
                    <div>ساعت: <strong>{toPersianDigits(getCurrentJalaliTime())}</strong></div>
                    <div>نوع سند: <strong>{reportType === 'exit_slips' ? 'برگه خروج انبار' : 'فاکتور فروش'}</strong></div>
                  </div>
                </div>

                {/* Scope Banner */}
                <div className="p-3 bg-slate-50/90 rounded-lg text-xs flex items-center justify-between flex-wrap gap-2 mb-4 border-0">
                  <div>
                    طرف حساب: <strong className="text-slate-900">{isAllCustomers ? 'کلیه مشتریان و متقاضیان (گزارش عمومی)' : currentCustomer?.name}</strong>
                    {currentCustomer?.phone && <span> — تلفن: {toPersianDigits(currentCustomer.phone)}</span>}
                  </div>
                  <div>
                    تعداد اسناد: <strong className="text-slate-900">{toPersianDigits(filteredCustomerInvoices.length)} فقره</strong> | سطر کالا: <strong className="text-slate-900">{toPersianDigits(detailedReportItems.length)}</strong>
                  </div>
                </div>

                {/* Table Sheet */}
                <div className="overflow-x-auto">
                  <table className="w-full text-right text-[11px] border-collapse border-0">
                    <thead>
                      <tr className={reportType === 'exit_slips' ? 'bg-amber-900 text-white' : 'bg-slate-900 text-white'}>
                        <th className="p-2 text-center w-8 border-0">ردیف</th>
                        <th className="p-2 text-center w-20 border-0">تاریخ</th>
                        {reportType === 'exit_slips' ? (
                          <>
                            <th className="p-2 text-center w-20 border-0">شماره حواله</th>
                            <th className="p-2 text-center w-20 border-0">شماره فاکتور</th>
                            <th className="p-2 w-32 border-0">تحویل‌گیرنده / خریدار</th>
                            <th className="p-2 border-0">عنوان کالا</th>
                            <th className="p-2 text-center w-16 border-0">مقدار</th>
                            <th className="p-2 text-center w-20 border-0">وضعیت</th>
                          </>
                        ) : (
                          <>
                            <th className="p-2 text-center w-20 border-0">شماره فاکتور</th>
                            <th className="p-2 text-center w-20 border-0">شماره حواله</th>
                            <th className="p-2 w-32 border-0">خریدار / طرف حساب</th>
                            <th className="p-2 border-0">عنوان کالا / خدمت</th>
                            <th className="p-2 text-center w-16 border-0">مقدار</th>
                            <th className="p-2 text-left w-20 border-0">فی واحد</th>
                            <th className="p-2 text-left w-24 border-0">مبلغ کل</th>
                          </>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {detailedReportItems.map((item, idx) => (
                        <tr key={`prev-${item.id}`} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/80'}>
                          <td className="p-2 text-center font-mono font-bold text-slate-500 border-0">{toPersianDigits(idx + 1)}</td>
                          <td className="p-2 text-center font-mono text-slate-600 border-0">{toPersianDigits(item.date)}</td>
                          {reportType === 'exit_slips' ? (
                            <>
                              <td className="p-2 text-center font-mono font-bold text-amber-800 border-0">{toPersianDigits(item.slipNumber)}</td>
                              <td className="p-2 text-center font-mono text-slate-600 border-0">{toPersianDigits(item.invoiceNumber)}</td>
                              <td className="p-2 font-bold text-slate-800 border-0">{item.customerName}</td>
                              <td className="p-2 font-black text-slate-900 border-0">{item.productName}</td>
                              <td className="p-2 text-center font-black border-0">{toPersianDigits(item.quantity)} {item.unit}</td>
                              <td className="p-2 text-center border-0">
                                <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded ${item.isDelivered ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                                  {item.isDelivered ? 'تحویل شد' : 'معوق'}
                                </span>
                              </td>
                            </>
                          ) : (
                            <>
                              <td className="p-2 text-center font-mono font-black text-slate-900 border-0">{toPersianDigits(item.invoiceNumber)}</td>
                              <td className="p-2 text-center font-mono text-indigo-700 font-bold border-0">{toPersianDigits(item.slipNumber)}</td>
                              <td className="p-2 font-bold text-slate-800 border-0">{item.customerName}</td>
                              <td className="p-2 font-black text-slate-900 border-0">{item.productName}</td>
                              <td className="p-2 text-center font-black border-0">{toPersianDigits(item.quantity)} {item.unit}</td>
                              <td className="p-2 text-left font-mono border-0">{toPersianDigits(formatPrice(item.unitPrice, ''))}</td>
                              <td className="p-2 text-left font-mono font-black border-0">{toPersianDigits(formatPrice(item.total, ''))}</td>
                            </>
                          )}
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-100 font-black text-[11px]">
                        <td colSpan={5} className="p-2.5 text-right border-0">
                          مجموع کل اقلام ({toPersianDigits(detailedReportItems.length)} سطر):
                        </td>
                        <td className="p-2.5 text-center text-indigo-950 font-mono border-0">
                          {toPersianDigits(stats.totalPhysicalQty)} واحد
                        </td>
                        {reportType === 'invoices' && (
                          <td colSpan={2} className="p-2.5 text-left font-mono text-emerald-900 border-0">
                            {toPersianDigits(formatPrice(stats.totalFinal, settings.currency))}
                          </td>
                        )}
                        {reportType === 'exit_slips' && (
                          <td colSpan={2} className="p-2.5 text-center text-slate-500 font-normal border-0">
                            (گردش کالا فاقد قیمت)
                          </td>
                        )}
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* Signatures */}
                <div className="mt-8 pt-4 grid grid-cols-3 gap-4 text-center text-[10px] text-slate-600 border-0">
                  <div>
                    <div className="font-bold mb-6">مسئول انبار / تحویل کالا</div>
                    <div className="text-slate-400">امضا و تاریخ</div>
                  </div>
                  <div>
                    <div className="font-bold mb-6">تحویل‌گیرنده / راننده</div>
                    <div className="text-slate-400">امضا و اثر انگشت</div>
                  </div>
                  <div>
                    <div className="font-bold mb-6">تاییدیه مدیریت / حسابداری</div>
                    <div className="text-slate-400">مهر و امضا</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Preview Modal Footer */}
            <div className="p-3 sm:p-4 border-t border-slate-800 bg-slate-900 text-white flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shrink-0">
              <div className="text-xs text-slate-400 flex items-center gap-2 px-1 sm:px-0">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="text-[11px] sm:text-xs">برگه آماده دریافت است. جهت صدور فایل نهایی دکمه دانلود را بفشارید.</span>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto justify-end">
                {/* Secondary buttons: 2 equal columns on mobile */}
                <div className="grid grid-cols-2 gap-2 w-full sm:w-auto sm:flex sm:items-center order-2 sm:order-1">
                  <button
                    type="button"
                    onClick={() => setIsPdfPreviewOpen(false)}
                    className="w-full sm:w-auto px-3.5 sm:px-4 py-2.5 sm:py-2 text-xs font-bold text-slate-300 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 border border-slate-700 rounded-xl transition-colors cursor-pointer text-center"
                  >
                    بازگشت
                  </button>

                  <button
                    type="button"
                    onClick={handlePrint}
                    disabled={detailedReportItems.length === 0}
                    className="w-full sm:w-auto px-3 sm:px-3.5 py-2.5 sm:py-2 text-xs font-bold text-slate-200 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 border border-slate-700 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 text-center"
                  >
                    <Printer className="w-4 h-4 text-slate-400 shrink-0" />
                    <span className="truncate">چاپ مستقیم</span>
                  </button>
                </div>

                {/* Primary Download Button: Full width on mobile, prominent */}
                <button
                  type="button"
                  onClick={() => {
                    handleExportPdf();
                  }}
                  disabled={detailedReportItems.length === 0 || isGeneratingPdf}
                  className={`w-full sm:w-auto px-5 py-2.5 sm:py-2 text-xs font-black text-white rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 order-1 sm:order-2 ${
                    reportType === 'exit_slips'
                      ? 'bg-amber-600 hover:bg-amber-700 active:bg-amber-800'
                      : 'bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800'
                  }`}
                >
                  {isGeneratingPdf ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                      <span>در حال ساخت PDF...</span>
                    </>
                  ) : (
                    <>
                      <FileDown className="w-4 h-4 shrink-0" />
                      <span>دانلود فایل PDF نهایی</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
