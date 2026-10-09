import React, { useState, useMemo } from 'react';
import { 
  Product, 
  Invoice, 
  Customer, 
  PurchaseInvoice, 
  InboundReceipt, 
  StoreSettings, 
  AppUser,
  WarehouseInfo,
  CustomerTransaction 
} from '../types';
import { formatPrice, toPersianDigits, getCurrentJalaliDate, getCurrentJalaliTime, formatNumber } from '../utils/jalali';
import { StorageService } from '../utils/storage';
import { getRoleBadgeConfig, isTabPermitted } from '../utils/permissions';
import { clearAppCacheAndReload, getLastCacheUpdatedTime } from '../utils/appUpdater';
import { NumericInput } from './NumericInput';
import { CustomerTransactionModal } from './CustomerTransactionModal';
import { 
  LayoutGrid, 
  BarChart3, 
  Search, 
  Plus, 
  MoreHorizontal, 
  Package, 
  Warehouse, 
  ArrowDown, 
  ArrowUp, 
  RotateCw, 
  Calendar, 
  Store, 
  CheckCircle2, 
  X, 
  FileText, 
  Camera, 
  AlertTriangle, 
  DollarSign, 
  Check, 
  ShoppingCart,
  TrendingUp,
  Boxes,
  Eye,
  ChevronLeft,
  Users,
  ReceiptText,
  PlusCircle,
  UserCheck,
  ShieldCheck,
  Lock,
  LogOut,
  CreditCard,
  ArrowLeftRight,
  RefreshCw,
  Sparkles,
  Coins,
  Wallet,
  Phone,
  Truck,
  ArrowDownRight,
  History,
  Clock,
  ArrowUpRight,
  PieChart,
  Filter
} from 'lucide-react';

const getAvatarBgClass = (color?: string, role?: string) => {
  if (color === 'emerald' || color === 'green') return 'bg-emerald-600 text-white';
  if (color === 'blue') return 'bg-blue-600 text-white';
  if (color === 'amber' || color === 'yellow') return 'bg-amber-600 text-white';
  if (color === 'purple') return 'bg-purple-600 text-white';
  if (color === 'rose' || color === 'red') return 'bg-rose-600 text-white';
  if (color === 'teal') return 'bg-teal-600 text-white';
  if (color === 'indigo') return 'bg-indigo-600 text-white';
  if (role === 'admin') return 'bg-emerald-600 text-white';
  if (role === 'supervisor') return 'bg-teal-600 text-white';
  if (role === 'cashier') return 'bg-blue-600 text-white';
  if (role === 'warehouse') return 'bg-amber-600 text-white';
  if (role === 'accountant') return 'bg-purple-600 text-white';
  return 'bg-slate-800 text-white';
};

interface QuickDashboardProps {
  products: Product[];
  invoices: Invoice[];
  customers: Customer[];
  purchaseInvoices: PurchaseInvoice[];
  inboundReceipts: InboundReceipt[];
  settings: StoreSettings;
  currentUser?: AppUser | null;
  onNavigate: (tab: string) => void;
  onNewInvoice: () => void;
  onViewInvoice: (invoice: Invoice) => void;
  onOpenSettings?: () => void;
  onUpdateSettings?: (newSettings: StoreSettings) => void;
  onLogout?: () => void;
  onRequestLogin?: (targetUser?: AppUser | null) => void;
  onSaveTransaction?: (txn: CustomerTransaction) => void;
}

export const QuickDashboard: React.FC<QuickDashboardProps> = ({
  products,
  invoices,
  customers,
  purchaseInvoices,
  inboundReceipts,
  settings,
  currentUser,
  onNavigate,
  onNewInvoice,
  onViewInvoice,
  onOpenSettings,
  onUpdateSettings,
  onLogout,
  onRequestLogin,
  onSaveTransaction,
}) => {
  const currentDate = getCurrentJalaliDate();
  const currentTime = getCurrentJalaliTime();

  // State for Customer Deposit Picker and Modal
  const [isDepositPickerOpen, setIsDepositPickerOpen] = useState(false);
  const [depositSelectedCustomer, setDepositSelectedCustomer] = useState<Customer | null>(null);
  const [depositSearchQuery, setDepositSearchQuery] = useState('');
  const [depositFilterOnlyDebtors, setDepositFilterOnlyDebtors] = useState(false);

  // User Permissions derived from currentUser (configured by manager)
  const userPerms = useMemo(() => {
    return currentUser?.permissions || {
      canCreateInvoice: true,
      canViewInvoices: true,
      canDeleteInvoice: true,
      canManageInventory: true,
      canManageCustomers: true,
      canViewReports: true,
      canAccessAdmin: true,
      canManageUsers: true,
    };
  }, [currentUser]);

  const canReports = Boolean(userPerms.canViewReports && settings.enableReports !== false);
  const canInvoice = Boolean(userPerms.canCreateInvoice);
  const canInvoicesList = Boolean(userPerms.canViewInvoices);
  const canInventory = Boolean(userPerms.canManageInventory && settings.enableInventory !== false);
  const canCustomers = Boolean(userPerms.canManageCustomers && settings.enableCustomers !== false);
  const canAdmin = Boolean(userPerms.canAccessAdmin || userPerms.canManageUsers);
  const canPurchases = Boolean(
    isTabPermitted('purchases', currentUser, settings) ||
    canInvoice || canInventory || canAdmin
  );

  const roleConfig = useMemo(() => {
    return currentUser ? getRoleBadgeConfig(currentUser.role) : null;
  }, [currentUser]);

  // Top Tab Switcher: "داشبورد" vs "نمودارها"
  const [activeSubTab, setActiveSubTab] = useState<'dashboard' | 'charts'>('dashboard');

  // If user lacks permission for reports, keep them on dashboard tab
  React.useEffect(() => {
    if (!canReports && activeSubTab === 'charts') {
      setActiveSubTab('dashboard');
    }
  }, [canReports, activeSubTab]);

  // Interactive Modals State
  const [isWarehouseModalOpen, setIsWarehouseModalOpen] = useState(false);
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);
  const [activeStatusFilter, setActiveStatusFilter] = useState<'draft' | 'confirmed' | 'cancelled' | null>(null);

  // App Update & Cache Invalidation State
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [isUpdatingApp, setIsUpdatingApp] = useState(false);
  const [updateProgressMsg, setUpdateProgressMsg] = useState('');
  const [lastCacheTime, setLastCacheTime] = useState<string | null>(() => getLastCacheUpdatedTime());

  // Role-Based "بیشتر امکانات" Modal State
  const [isMoreFeaturesModalOpen, setIsMoreFeaturesModalOpen] = useState(false);

  // Trigger app update and clear browser cache
  const handlePerformAppUpdate = async () => {
    setIsUpdatingApp(true);
    setUpdateProgressMsg('در حال پاکسازی حافظه موقت مرورگر...');
    await clearAppCacheAndReload((prog) => {
      setUpdateProgressMsg(prog.message);
    });
  };

  // Warehouse Modal State
  const initialWarehouses: WarehouseInfo[] = useMemo(() => {
    if (settings.warehouses && settings.warehouses.length > 0) {
      return settings.warehouses;
    }
    return [
      { id: 'wh-1', name: 'انبار مرکزی', isDefault: true },
      { id: 'wh-2', name: 'انبار شعبه ۱', isDefault: false },
      { id: 'wh-3', name: 'انبار ضایعات و رزرو', isDefault: false },
    ];
  }, [settings.warehouses]);

  const [warehouseList, setWarehouseList] = useState<WarehouseInfo[]>(initialWarehouses);
  const [selectedDefaultWh, setSelectedDefaultWh] = useState<string>(
    settings.defaultWarehouseId || initialWarehouses.find((w) => w.isDefault)?.id || 'wh-1'
  );

  const defaultWarehouse = useMemo(() => {
    return warehouseList.find((w) => w.id === selectedDefaultWh) || warehouseList[0];
  }, [warehouseList, selectedDefaultWh]);

  // Calculate Status Numbers for "عملیات کالا"
  // 1. پیش نویس (Drafts / Proformas / Pending purchase invoices)
  const draftInvoices = useMemo(() => {
    return invoices.filter((inv) => inv.isProforma);
  }, [invoices]);

  // 2. تایید شده (Confirmed / Approved invoices & inbound receipts)
  const confirmedInvoices = useMemo(() => {
    return invoices.filter((inv) => !inv.isProforma);
  }, [invoices]);

  // 3. لغو شده (Cancelled invoices)
  const cancelledInvoices = useMemo(() => {
    return invoices.filter((inv) => inv.notes && inv.notes.includes('لغو'));
  }, [invoices]);

  // Financial Metrics for Charts tab
  const totalRevenue = useMemo(() => {
    return invoices
      .filter((inv) => !inv.isProforma)
      .reduce((sum, inv) => sum + (inv.finalTotal || 0), 0);
  }, [invoices]);

  const todayRevenue = useMemo(() => {
    return invoices
      .filter((inv) => inv.date === currentDate && !inv.isProforma)
      .reduce((sum, inv) => sum + (inv.finalTotal || 0), 0);
  }, [invoices, currentDate]);

  const todayInvoices = useMemo(() => {
    return invoices.filter((inv) => inv.date === currentDate && !inv.isProforma);
  }, [invoices, currentDate]);

  const recentInvoices = useMemo(() => {
    return [...invoices].reverse().slice(0, 8);
  }, [invoices]);

  const [recentInvoicesFilter, setRecentInvoicesFilter] = useState<'all' | 'confirmed' | 'draft' | 'cancelled'>('all');

  const filteredRecentInvoices = useMemo(() => {
    if (recentInvoicesFilter === 'all') return recentInvoices.slice(0, 5);
    if (recentInvoicesFilter === 'confirmed') return invoices.filter(inv => !inv.isProforma).reverse().slice(0, 5);
    if (recentInvoicesFilter === 'draft') return invoices.filter(inv => inv.isProforma).reverse().slice(0, 5);
    if (recentInvoicesFilter === 'cancelled') return invoices.filter(inv => inv.notes?.includes('لغو')).reverse().slice(0, 5);
    return recentInvoices.slice(0, 5);
  }, [invoices, recentInvoices, recentInvoicesFilter]);

  // Customer Receivables (مطالبات و بدهی مشتریان)
  const { totalCustomerReceivables, debtorCustomersCount, topDebtors } = useMemo(() => {
    const allTxns = StorageService.getCustomerTransactions();
    let totalReceivables = 0;
    let debtorCount = 0;
    const debtorList: Array<{ customer: Customer; balance: number }> = [];

    customers.forEach((c) => {
      const ledger = StorageService.buildCustomerLedger(c, invoices, allTxns);
      if (ledger.netBalance > 0) {
        totalReceivables += ledger.netBalance;
        debtorCount += 1;
        debtorList.push({ customer: c, balance: ledger.netBalance });
      }
    });

    debtorList.sort((a, b) => b.balance - a.balance);

    return {
      totalCustomerReceivables: totalReceivables,
      debtorCustomersCount: debtorCount,
      topDebtors: debtorList.slice(0, 5),
    };
  }, [customers, invoices]);

  // Warehouse inventory valuation (ارزش ریالی انبار)
  const totalInventoryValuation = useMemo(() => {
    return products.reduce((sum, p) => {
      const unitValue = p.buyPrice || p.sellPrice || 0;
      return sum + (p.stock * unitValue);
    }, 0);
  }, [products]);

  const lowStockProducts = useMemo(() => {
    return products.filter((p) => p.stock <= p.minStockAlert);
  }, [products]);

  // Stock audit adjustments local state
  const [auditQuantities, setAuditQuantities] = useState<Record<string, number>>({});
  const [auditNotes, setAuditNotes] = useState<Record<string, string>>({});
  const [auditSuccessMsg, setAuditSuccessMsg] = useState('');

  // Filter customers for Deposit Picker Modal
  const filteredDepositCustomers = useMemo(() => {
    const q = depositSearchQuery.trim().toLowerCase();
    const allTxns = StorageService.getCustomerTransactions();

    return customers
      .filter((c) => {
        if (q) {
          const matchName = c.name.toLowerCase().includes(q);
          const matchPhone = c.phone?.toLowerCase().includes(q);
          const matchNat = c.nationalId?.toLowerCase().includes(q);
          if (!matchName && !matchPhone && !matchNat) return false;
        }

        if (depositFilterOnlyDebtors) {
          const ledger = StorageService.buildCustomerLedger(c, invoices, allTxns);
          if (ledger.netBalance <= 0) return false;
        }

        return true;
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [customers, invoices, depositSearchQuery, depositFilterOnlyDebtors]);

  // Operations permitted for the active user
  const permittedOperations = useMemo(() => {
    const list: Array<{
      id: string;
      label: string;
      icon: React.ComponentType<{ className?: string }>;
      borderClass: string;
      bgClass: string;
      textClass: string;
      hoverBgClass: string;
      hoverTextClass: string;
      hoverBorderClass: string;
      hoverLabelClass: string;
      onClick: () => void;
    }> = [];

    if (canInventory) {
      list.push({
        id: 'inbound',
        label: 'ورود کالا',
        icon: ArrowDown,
        borderClass: 'border-teal-200',
        bgClass: 'bg-teal-50',
        textClass: 'text-teal-600',
        hoverBgClass: 'group-hover:bg-teal-600',
        hoverTextClass: 'group-hover:text-white',
        hoverBorderClass: 'group-hover:border-teal-600',
        hoverLabelClass: 'group-hover:text-teal-700',
        onClick: () => onNavigate('purchases'),
      });
    }

    if (canInvoice) {
      list.push({
        id: 'outbound',
        label: 'خروج کالا (فروش)',
        icon: ArrowUp,
        borderClass: 'border-rose-200',
        bgClass: 'bg-rose-50',
        textClass: 'text-rose-500',
        hoverBgClass: 'group-hover:bg-rose-500',
        hoverTextClass: 'group-hover:text-white',
        hoverBorderClass: 'group-hover:border-rose-500',
        hoverLabelClass: 'group-hover:text-rose-600',
        onClick: () => onNewInvoice(),
      });
    }

    if (canInventory) {
      list.push({
        id: 'audit',
        label: 'انبار گردانی',
        icon: RotateCw,
        borderClass: 'border-emerald-200',
        bgClass: 'bg-emerald-50',
        textClass: 'text-emerald-600',
        hoverBgClass: 'group-hover:bg-emerald-600',
        hoverTextClass: 'group-hover:text-white',
        hoverBorderClass: 'group-hover:border-emerald-600',
        hoverLabelClass: 'group-hover:text-emerald-700',
        onClick: () => setIsAuditModalOpen(true),
      });

      list.push({
        id: 'direct-transfers',
        label: 'خروج/ورود بدون فاکتور (تعمیرات)',
        icon: ArrowLeftRight,
        borderClass: 'border-amber-200',
        bgClass: 'bg-amber-50',
        textClass: 'text-amber-600',
        hoverBgClass: 'group-hover:bg-amber-600',
        hoverTextClass: 'group-hover:text-white',
        hoverBorderClass: 'group-hover:border-amber-600',
        hoverLabelClass: 'group-hover:text-amber-700',
        onClick: () => onNavigate('direct-transfers'),
      });
    }

    // If not inventory, but has customer permission
    if (!canInventory && canCustomers) {
      list.push({
        id: 'customers',
        label: 'مشتریان',
        icon: Users,
        borderClass: 'border-indigo-200',
        bgClass: 'bg-indigo-50',
        textClass: 'text-indigo-600',
        hoverBgClass: 'group-hover:bg-indigo-600',
        hoverTextClass: 'group-hover:text-white',
        hoverBorderClass: 'group-hover:border-indigo-600',
        hoverLabelClass: 'group-hover:text-indigo-700',
        onClick: () => onNavigate('customers'),
      });
    }

    // If not inventory and not invoice, but can view invoices
    if (!canInventory && !canInvoice && canInvoicesList) {
      list.push({
        id: 'invoices',
        label: 'لیست سفارشات',
        icon: ReceiptText,
        borderClass: 'border-sky-200',
        bgClass: 'bg-sky-50',
        textClass: 'text-sky-600',
        hoverBgClass: 'group-hover:bg-sky-600',
        hoverTextClass: 'group-hover:text-white',
        hoverBorderClass: 'group-hover:border-sky-600',
        hoverLabelClass: 'group-hover:text-sky-700',
        onClick: () => onNavigate('invoices'),
      });
    }

    // Always include the "بیشتر امکانات" action button for accessing role-based features
    list.push({
      id: 'more-features',
      label: 'بیشتر امکانات',
      icon: MoreHorizontal,
      borderClass: 'border-purple-200',
      bgClass: 'bg-purple-50',
      textClass: 'text-purple-600',
      hoverBgClass: 'group-hover:bg-purple-600',
      hoverTextClass: 'group-hover:text-white',
      hoverBorderClass: 'group-hover:border-purple-600',
      hoverLabelClass: 'group-hover:text-purple-700',
      onClick: () => setIsMoreFeaturesModalOpen(true),
    });

    return list;
  }, [canInventory, canInvoice, canCustomers, canInvoicesList, canAdmin, onNavigate, onNewInvoice]);

  // Comprehensive features list strictly filtered by user's permitted role
  const allPermittedFeatures = useMemo(() => {
    const items: Array<{
      id: string;
      title: string;
      subtitle: string;
      icon: React.ComponentType<{ className?: string }>;
      colorClass: string;
      bgClass: string;
      badgeText?: string;
      onClick: () => void;
    }> = [];

    if (canInvoice) {
      items.push({
        id: 'feat-new-invoice',
        title: 'صدور فاکتور فروش',
        subtitle: 'صدور سریع فاکتور با بارکدخوان، تخفیف، تسویه نقد و چک',
        icon: PlusCircle,
        colorClass: 'text-emerald-600',
        bgClass: 'bg-emerald-50/80 border-emerald-200 hover:bg-emerald-100/90',
        badgeText: 'عملیات مالی',
        onClick: () => {
          setIsMoreFeaturesModalOpen(false);
          onNewInvoice();
        },
      });
    }

    if (canCustomers || canInvoice || canAdmin) {
      items.push({
        id: 'feat-customer-deposit',
        title: 'ثبت واریزی و دریافت وجه از مشتری',
        subtitle: 'دریافت نقدی، پوز، کارت به کارت یا چک مشتری و تسویه حساب',
        icon: Coins,
        colorClass: 'text-emerald-600',
        bgClass: 'bg-emerald-50/80 border-emerald-200 hover:bg-emerald-100/90',
        badgeText: 'عملیات مالی',
        onClick: () => {
          setIsMoreFeaturesModalOpen(false);
          setIsDepositPickerOpen(true);
        },
      });
    }

    if (canInvoicesList) {
      items.push({
        id: 'feat-invoices-list',
        title: 'مدیریت و لیست فاکتورها',
        subtitle: 'مشاهده سفارشات، جستجو، تسویه، چاپ و فاکتور رسمی',
        icon: ReceiptText,
        colorClass: 'text-teal-600',
        bgClass: 'bg-teal-50/80 border-teal-200 hover:bg-teal-100/90',
        badgeText: 'فروش',
        onClick: () => {
          setIsMoreFeaturesModalOpen(false);
          onNavigate('invoices');
        },
      });
    }

    if (canPurchases) {
      items.push({
        id: 'feat-purchases',
        title: 'فاکتور خرید و ورود کالا',
        subtitle: 'ثبت ورود اقلام از تامین‌کنندگان و افزایش موجودی انبار',
        icon: ShoppingCart,
        colorClass: 'text-orange-600',
        bgClass: 'bg-orange-50/80 border-orange-200 hover:bg-orange-100/90',
        badgeText: 'تامین و انبار',
        onClick: () => {
          setIsMoreFeaturesModalOpen(false);
          onNavigate('purchases');
        },
      });
    }

    if (canInventory) {
      items.push({
        id: 'feat-inventory',
        title: 'انبار و موجودی کالاها',
        subtitle: 'کنترل نقطه سفارش، موجودی ریالی و کاردکس کالا',
        icon: Boxes,
        colorClass: 'text-amber-600',
        bgClass: 'bg-amber-50/80 border-amber-200 hover:bg-amber-100/90',
        badgeText: 'انبارداری',
        onClick: () => {
          setIsMoreFeaturesModalOpen(false);
          onNavigate('inventory');
        },
      });

      items.push({
        id: 'feat-direct-transfers',
        title: 'خروج/ورود بدون فاکتور (تعمیرات و امانی)',
        subtitle: 'حواله انتقال کالا بین انبارها یا ارسال برای تعمیرات',
        icon: ArrowLeftRight,
        colorClass: 'text-cyan-600',
        bgClass: 'bg-cyan-50/80 border-cyan-200 hover:bg-cyan-100/90',
        badgeText: 'حواله داخلی',
        onClick: () => {
          setIsMoreFeaturesModalOpen(false);
          onNavigate('direct-transfers');
        },
      });

      items.push({
        id: 'feat-audit',
        title: 'انبارگردانی و تطبیق موجودی',
        subtitle: 'شمارش موجودی فیزیکی و ثبت کسری یا مازاد',
        icon: RotateCw,
        colorClass: 'text-emerald-700',
        bgClass: 'bg-emerald-50/80 border-emerald-200 hover:bg-emerald-100/90',
        badgeText: 'انبارداری',
        onClick: () => {
          setIsMoreFeaturesModalOpen(false);
          setIsAuditModalOpen(true);
        },
      });
    }

    if (canInventory || canAdmin) {
      items.push({
        id: 'feat-warehouses',
        title: 'تنظیمات انبارها و تفکیک موجودی',
        subtitle: 'مدیریت انبار مرکزی، انبار ضایعات و انبار پیش‌فرض',
        icon: Warehouse,
        colorClass: 'text-amber-700',
        bgClass: 'bg-amber-50/80 border-amber-200 hover:bg-amber-100/90',
        badgeText: 'پیکربندی',
        onClick: () => {
          setIsMoreFeaturesModalOpen(false);
          setIsWarehouseModalOpen(true);
        },
      });
    }

    if (canCustomers) {
      items.push({
        id: 'feat-customers',
        title: 'مدیریت مشتریان و حساب‌ها',
        subtitle: 'فهرست خریداران، مانده بدهی، کارت حساب و اطلاعات تماس',
        icon: Users,
        colorClass: 'text-blue-600',
        bgClass: 'bg-blue-50/80 border-blue-200 hover:bg-blue-100/90',
        badgeText: 'مشتریان',
        onClick: () => {
          setIsMoreFeaturesModalOpen(false);
          onNavigate('customers');
        },
      });
    }

    if (canReports) {
      items.push({
        id: 'feat-reports',
        title: 'گزارشات مالی، فروش و سود',
        subtitle: 'نمودار فروش روزانه، اقلام پرفروش، سود ناخالص و تراز',
        icon: BarChart3,
        colorClass: 'text-purple-600',
        bgClass: 'bg-purple-50/80 border-purple-200 hover:bg-purple-100/90',
        badgeText: 'تحلیل مالی',
        onClick: () => {
          setIsMoreFeaturesModalOpen(false);
          setActiveSubTab('charts');
        },
      });
    }

    if (canAdmin) {
      items.push({
        id: 'feat-admin',
        title: 'مدیریت کاربران و دسترسی‌ها',
        subtitle: 'تعریف پرسنل، نقش‌های صندوق‌دار، انباردار و حسابدار',
        icon: ShieldCheck,
        colorClass: 'text-indigo-600',
        bgClass: 'bg-indigo-50/80 border-indigo-200 hover:bg-indigo-100/90',
        badgeText: 'امنیت و پرسنل',
        onClick: () => {
          setIsMoreFeaturesModalOpen(false);
          onNavigate('admin');
        },
      });

      items.push({
        id: 'feat-settings',
        title: 'تنظیمات کلی فروشگاه و چاپ',
        subtitle: 'نام کسب‌وکار، لوگو، مالیات، الگوی فاکتور و قالب خروج',
        icon: Store,
        colorClass: 'text-slate-700',
        bgClass: 'bg-slate-100 border-slate-300 hover:bg-slate-200',
        badgeText: 'تنظیمات سیستم',
        onClick: () => {
          setIsMoreFeaturesModalOpen(false);
          if (onOpenSettings) onOpenSettings();
          else onNavigate('admin');
        },
      });
    }

    // Always available to all user roles: Update App & Clear Browser Cache
    items.push({
      id: 'feat-cache-updater',
      title: 'بروزرسانی برنامه و پاکسازی کش مرورگر',
      subtitle: 'حذف فایل‌های قدیمی ذخیره شده در مرورگر و بارگذاری نسخه جدید',
      icon: RefreshCw,
      colorClass: 'text-sky-600',
      bgClass: 'bg-sky-50/80 border-sky-200 hover:bg-sky-100/90',
      badgeText: 'نگهداری سیستم',
      onClick: () => {
        setIsMoreFeaturesModalOpen(false);
        setIsUpdateModalOpen(true);
      },
    });

    return items;
  }, [canInvoice, canInvoicesList, canPurchases, canInventory, canCustomers, canReports, canAdmin, onNavigate, onNewInvoice, onOpenSettings]);

  // Handle Save Warehouses
  const handleSaveWarehouses = () => {
    const updated = warehouseList.map((wh) => ({
      ...wh,
      isDefault: wh.id === selectedDefaultWh,
    }));
    const selectedWh = updated.find(w => w.id === selectedDefaultWh) || updated[0];
    const newSettings: StoreSettings = {
      ...settings,
      warehouses: updated,
      defaultWarehouseId: selectedDefaultWh,
      originWarehouseName: selectedWh?.name || settings.originWarehouseName || 'انبار مرکزی سپهر',
      originWarehouseCode: selectedWh?.code || settings.originWarehouseCode || 'WH-01',
      originWarehouseAddress: selectedWh?.address || settings.originWarehouseAddress || '',
      originWarehousePhone: selectedWh?.phone || settings.originWarehousePhone || '',
      originWarehouseManager: selectedWh?.managerName || settings.originWarehouseManager || '',
    };
    if (onUpdateSettings) {
      onUpdateSettings(newSettings);
    } else {
      StorageService.saveSettings(newSettings);
    }
    setIsWarehouseModalOpen(false);
  };

  // Stocktaking Adjustment Submission
  const handleApplyAudit = (productId: string) => {
    const count = auditQuantities[productId];
    if (count === undefined || isNaN(count)) return;
    const prod = products.find((p) => p.id === productId);
    if (!prod) return;

    const diff = count - prod.stock;
    if (diff === 0) return;

    StorageService.adjustStock(
      productId,
      'adjustment',
      diff,
      auditNotes[productId] || 'انبارگردانی و تطبیق موجودی فیزیکی'
    );
    setAuditSuccessMsg(`موجودی «${prod.name}» به ${toPersianDigits(count)} اصلاح شد.`);
    setTimeout(() => setAuditSuccessMsg(''), 3000);
  };

  return (
    <div className="w-full max-w-7xl mx-auto flex flex-col space-y-4 sm:space-y-6 select-none pb-8">
      {/* MAIN WORKSTATION vs CHARTS TAB */}
      {activeSubTab === 'dashboard' ? (
        <>
          {/* ===================== WORKSTATION COMMAND HUB (AT VERY TOP ON MOBILE VIA order-1) ===================== */}
          <div className="order-1 lg:order-2 bg-white rounded-2xl sm:rounded-3xl border border-slate-200/90 shadow-xs p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-slate-900 text-white flex items-center justify-center shrink-0">
                  <LayoutGrid className="w-4 h-4 stroke-[2.2]" />
                </div>
                <div>
                  <h2 className="text-sm sm:text-base font-black text-slate-900">
                    مرکز فرماندهی و عملیات سامانه
                  </h2>
                  <span className="text-[11px] text-slate-400 font-medium hidden sm:inline">
                    دسترسی سریع به ماژول‌های فروش، انبارداری، حسابداری و تنظیمات
                  </span>
                </div>
              </div>

              {/* Quick Actions & Tab Switch */}
              <div className="flex items-center gap-1.5 sm:gap-2">
                {canReports && (
                  <button
                    type="button"
                    id="btn-hub-switch-charts"
                    onClick={() => setActiveSubTab('charts')}
                    className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer"
                    title="مشاهده آمار و تحلیل مالی"
                  >
                    <BarChart3 className="w-3.5 h-3.5 text-slate-500" />
                    <span>آمار و تحلیل</span>
                  </button>
                )}

                <button
                  type="button"
                  id="btn-hub-more-features"
                  onClick={() => setIsMoreFeaturesModalOpen(true)}
                  className="px-2.5 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-xl text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer"
                  title="فهرست تمامی امکانات سامانه"
                >
                  <MoreHorizontal className="w-3.5 h-3.5 text-purple-600" />
                  <span>بیشتر امکانات</span>
                </button>

                <button
                  type="button"
                  id="btn-hub-update-cache"
                  onClick={() => setIsUpdateModalOpen(true)}
                  className="p-1.5 sm:px-2.5 sm:py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 rounded-xl text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer"
                  title="بروزرسانی برنامه و پاکسازی حافظه موقت"
                >
                  <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${isUpdatingApp ? 'animate-spin' : ''}`} />
                  <span className="hidden md:inline">بروزرسانی کش</span>
                </button>
              </div>
            </div>

            {/* THREE OPERATION CLUSTERS */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 sm:gap-4">
              {/* CLUSTER 1: فروش و صندوقداری */}
              <div className="p-3.5 sm:p-4 rounded-2xl border border-emerald-200/70 bg-gradient-to-b from-emerald-50/40 to-white space-y-3 flex flex-col justify-between">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center">
                        <ReceiptText className="w-4 h-4" />
                      </div>
                      <span className="font-black text-xs sm:text-sm text-slate-800">
                        فروش و صندوقداری
                      </span>
                    </div>
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md">
                      POS
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    صدور فاکتور جدید، بارکدخوان، تسویه واریزی مشتری و پیگیری سفارشات
                  </p>
                </div>

                <div className="space-y-1.5 pt-1">
                  {canInvoice && (
                    <button
                      type="button"
                      id="hub-btn-new-invoice"
                      onClick={() => onNewInvoice()}
                      className="w-full py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white rounded-xl text-xs font-black transition-all flex items-center justify-between shadow-xs cursor-pointer"
                    >
                      <span className="flex items-center gap-1.5">
                        <Plus className="w-4 h-4 stroke-[3]" />
                        <span>صدور فاکتور جدید</span>
                      </span>
                      <span className="text-[10px] bg-emerald-700/80 px-1.5 py-0.5 rounded text-emerald-100 font-mono">
                        Alt+N
                      </span>
                    </button>
                  )}

                  {(canCustomers || canInvoice || canAdmin) && (
                    <button
                      type="button"
                      id="hub-btn-customer-deposit"
                      onClick={() => setIsDepositPickerOpen(true)}
                      className="w-full py-2 px-3 bg-white hover:bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold transition-all flex items-center justify-between cursor-pointer"
                    >
                      <span className="flex items-center gap-1.5">
                        <Coins className="w-3.5 h-3.5 text-amber-500" />
                        <span>ثبت واریزی و تسویه مشتری</span>
                      </span>
                      <ChevronLeft className="w-3.5 h-3.5 text-slate-400" />
                    </button>
                  )}

                  {canInvoicesList && (
                    <button
                      type="button"
                      id="hub-btn-invoices-list"
                      onClick={() => onNavigate('invoices')}
                      className="w-full py-2 px-3 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition-all flex items-center justify-between cursor-pointer"
                    >
                      <span className="flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-slate-500" />
                        <span>لیست و مدیریت فاکتورها</span>
                      </span>
                      <span className="text-[10px] font-mono text-slate-400">
                        {toPersianDigits(invoices.length)}
                      </span>
                    </button>
                  )}
                </div>
              </div>

              {/* CLUSTER 2: مدیریت انبار و زنجیره اقلام */}
              <div className="p-3.5 sm:p-4 rounded-2xl border border-amber-200/70 bg-gradient-to-b from-amber-50/40 to-white space-y-3 flex flex-col justify-between">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-amber-600 text-white flex items-center justify-center">
                        <Boxes className="w-4 h-4" />
                      </div>
                      <span className="font-black text-xs sm:text-sm text-slate-800">
                        انبارداری و زنجیره کالا
                      </span>
                    </div>
                    <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-md">
                      {defaultWarehouse?.name || 'انبار'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    موجودی، حواله خرید، خروج امانی/تعمیرات، انبارگردانی و تفکیک شعب
                  </p>
                </div>

                <div className="space-y-1.5 pt-1">
                  {canInventory && (
                    <button
                      type="button"
                      id="hub-btn-inventory-items"
                      onClick={() => onNavigate('inventory')}
                      className="w-full py-2 px-3 bg-white hover:bg-amber-50 text-amber-900 border border-amber-200 rounded-xl text-xs font-bold transition-all flex items-center justify-between cursor-pointer"
                    >
                      <span className="flex items-center gap-1.5">
                        <Boxes className="w-3.5 h-3.5 text-amber-600" />
                        <span>کالاها و گردش موجودی</span>
                      </span>
                      <span className="text-[10px] font-mono text-slate-400">
                        {toPersianDigits(products.length)}
                      </span>
                    </button>
                  )}

                  {canPurchases && (
                    <button
                      type="button"
                      id="hub-btn-purchases"
                      onClick={() => onNavigate('purchases')}
                      className="w-full py-2 px-3 bg-white hover:bg-orange-50 text-orange-900 border border-orange-200 rounded-xl text-xs font-bold transition-all flex items-center justify-between cursor-pointer"
                    >
                      <span className="flex items-center gap-1.5">
                        <ShoppingCart className="w-3.5 h-3.5 text-orange-600" />
                        <span>فاکتور خرید (ورود به انبار)</span>
                      </span>
                      <ChevronLeft className="w-3.5 h-3.5 text-slate-400" />
                    </button>
                  )}

                  {canInventory && (
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        id="hub-btn-direct-transfers"
                        onClick={() => onNavigate('direct-transfers')}
                        className="py-1.5 px-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-[11px] font-bold transition-all flex items-center justify-center gap-1 cursor-pointer truncate"
                        title="خروج و ورود بدون فاکتور (امانی/تعمیرات)"
                      >
                        <ArrowLeftRight className="w-3 h-3 text-cyan-600 shrink-0" />
                        <span className="truncate">امانی/تعمیرات</span>
                      </button>

                      <button
                        type="button"
                        id="hub-btn-stock-audit"
                        onClick={() => setIsAuditModalOpen(true)}
                        className="py-1.5 px-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-[11px] font-bold transition-all flex items-center justify-center gap-1 cursor-pointer truncate"
                        title="انبارگردانی و تطبیق موجودی فیزیکی"
                      >
                        <RotateCw className="w-3 h-3 text-emerald-600 shrink-0" />
                        <span className="truncate">انبارگردانی</span>
                      </button>
                    </div>
                  )}

                  {(canInventory || canAdmin) && (
                    <button
                      type="button"
                      id="hub-btn-warehouse-settings"
                      onClick={() => setIsWarehouseModalOpen(true)}
                      className="w-full py-1.5 px-2 bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 rounded-xl text-[11px] font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Warehouse className="w-3 h-3 text-slate-500" />
                      <span>پیکربندی ۳ انبار و پیش‌فرض</span>
                    </button>
                  )}
                </div>
              </div>

              {/* CLUSTER 3: طرف‌حساب‌ها، حسابداری و سامانه */}
              <div className="p-3.5 sm:p-4 rounded-2xl border border-indigo-200/70 bg-gradient-to-b from-indigo-50/40 to-white space-y-3 flex flex-col justify-between">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center">
                        <Users className="w-4 h-4" />
                      </div>
                      <span className="font-black text-xs sm:text-sm text-slate-800">
                        طرف‌حساب‌ها و مدیریت
                      </span>
                    </div>
                    <span className="text-[10px] font-bold text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-md">
                      سیستم
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    مدیریت مشتریان، گزارشات سود و تراز مالی، کاربران و تنظیمات چاپ
                  </p>
                </div>

                <div className="space-y-1.5 pt-1">
                  {canCustomers && (
                    <button
                      type="button"
                      id="hub-btn-customers"
                      onClick={() => onNavigate('customers')}
                      className="w-full py-2 px-3 bg-white hover:bg-indigo-50 text-indigo-900 border border-indigo-200 rounded-xl text-xs font-bold transition-all flex items-center justify-between cursor-pointer"
                    >
                      <span className="flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-indigo-600" />
                        <span>مشتریان و حساب‌ها</span>
                      </span>
                      <span className="text-[10px] font-mono text-slate-400">
                        {toPersianDigits(customers.length)}
                      </span>
                    </button>
                  )}

                  {canReports && (
                    <button
                      type="button"
                      id="hub-btn-reports-analytics"
                      onClick={() => setActiveSubTab('charts')}
                      className="w-full py-2 px-3 bg-white hover:bg-purple-50 text-purple-900 border border-purple-200 rounded-xl text-xs font-bold transition-all flex items-center justify-between cursor-pointer"
                    >
                      <span className="flex items-center gap-1.5">
                        <BarChart3 className="w-3.5 h-3.5 text-purple-600" />
                        <span>گزارشات و تحلیل سود</span>
                      </span>
                      <ChevronLeft className="w-3.5 h-3.5 text-slate-400" />
                    </button>
                  )}

                  {canAdmin && (
                    <button
                      type="button"
                      id="hub-btn-admin-panel"
                      onClick={() => onNavigate('admin')}
                      className="w-full py-2 px-3 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition-all flex items-center justify-between cursor-pointer"
                    >
                      <span className="flex items-center gap-1.5">
                        <ShieldCheck className="w-3.5 h-3.5 text-slate-600" />
                        <span>کاربران، نقش‌ها و پرسنل</span>
                      </span>
                      <ChevronLeft className="w-3.5 h-3.5 text-slate-400" />
                    </button>
                  )}

                  <button
                    type="button"
                    id="hub-btn-settings"
                    onClick={() => {
                      if (onOpenSettings) onOpenSettings();
                      else onNavigate('admin');
                    }}
                    className="w-full py-1.5 px-2 bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 rounded-xl text-[11px] font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Store className="w-3 h-3 text-slate-500" />
                    <span>تنظیمات فروشگاه و قالب چاپ</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* ===================== EXECUTIVE FINANCIAL & OPERATIONAL KPIS (BELOW HUB ON MOBILE, ABOVE HUB ON DESKTOP) ===================== */}
          <div className="order-2 lg:order-1 grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {/* KPI 1: فروش امروز */}
            <div
              onClick={() => canInvoicesList && onNavigate('invoices')}
              className={`bg-white rounded-2xl border border-slate-200/90 shadow-xs p-4 flex flex-col justify-between transition-all ${
                canInvoicesList ? 'cursor-pointer hover:border-emerald-300 hover:shadow-sm active:scale-99' : ''
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400">فروش امروز</span>
                <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
                  <TrendingUp className="w-4 h-4 stroke-[2.4]" />
                </div>
              </div>
              <div className="mt-2.5">
                <span className="text-lg lg:text-xl font-black text-slate-900 block font-mono tabular-nums">
                  {formatPrice(todayRevenue)}
                </span>
                <div className="flex items-center justify-between text-[11px] font-semibold text-emerald-700 mt-1">
                  <span>{toPersianDigits(todayInvoices.length)} فاکتور ثبت شده</span>
                  {canInvoice && (
                    <span className="text-emerald-600 hover:underline font-bold">+ صدور جدید</span>
                  )}
                </div>
              </div>
            </div>

            {/* KPI 2: کل فروش سامانه */}
            <div
              onClick={() => canReports ? setActiveSubTab('charts') : (canInvoicesList && onNavigate('invoices'))}
              className={`bg-white rounded-2xl border border-slate-200/90 shadow-xs p-4 flex flex-col justify-between transition-all ${
                (canReports || canInvoicesList) ? 'cursor-pointer hover:border-teal-300 hover:shadow-sm active:scale-99' : ''
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400">مجموع فروش کل</span>
                <div className="w-9 h-9 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center border border-teal-100">
                  <DollarSign className="w-4 h-4 stroke-[2.4]" />
                </div>
              </div>
              <div className="mt-2.5">
                <span className="text-lg lg:text-xl font-black text-teal-800 block font-mono tabular-nums">
                  {formatPrice(totalRevenue)}
                </span>
                <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 mt-1">
                  <span>{toPersianDigits(confirmedInvoices.length)} فاکتور تایید شده</span>
                  <span className="text-teal-600 font-bold">رسمی</span>
                </div>
              </div>
            </div>

            {/* KPI 3: مطالبات از مشتریان (بدهی طرف‌حساب‌ها) */}
            <div
              onClick={() => {
                if (canCustomers || canInvoice || canAdmin) {
                  setDepositFilterOnlyDebtors(true);
                  setIsDepositPickerOpen(true);
                }
              }}
              className={`bg-white rounded-2xl border border-slate-200/90 shadow-xs p-4 flex flex-col justify-between transition-all ${
                (canCustomers || canInvoice || canAdmin) ? 'cursor-pointer hover:border-rose-300 hover:shadow-sm active:scale-99' : ''
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400">مطالبات و طلب از مشتریان</span>
                <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-100">
                  <Wallet className="w-4 h-4 stroke-[2.4]" />
                </div>
              </div>
              <div className="mt-2.5">
                <span className="text-lg lg:text-xl font-black text-rose-700 block font-mono tabular-nums">
                  {formatPrice(totalCustomerReceivables)}
                </span>
                <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 mt-1">
                  <span>{toPersianDigits(debtorCustomersCount)} طرف‌حساب بدهکار</span>
                  <span className="text-rose-600 font-bold">تسویه سریع ←</span>
                </div>
              </div>
            </div>

            {/* KPI 4: سرمایه و موجودی اقلام انبار */}
            <div
              onClick={() => canInventory && onNavigate('inventory')}
              className={`bg-white rounded-2xl border border-slate-200/90 shadow-xs p-4 flex flex-col justify-between transition-all ${
                canInventory ? 'cursor-pointer hover:border-amber-300 hover:shadow-sm active:scale-99' : ''
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400">اقلام و سرمایه انبار</span>
                <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100">
                  <Boxes className="w-4 h-4 stroke-[2.4]" />
                </div>
              </div>
              <div className="mt-2.5">
                <div className="flex items-baseline justify-between">
                  <span className="text-lg lg:text-xl font-black text-slate-900 block font-mono tabular-nums">
                    {toPersianDigits(products.length)} <span className="text-xs font-normal text-slate-500">قلم</span>
                  </span>
                  <span className="text-xs font-bold text-slate-500 font-mono">
                    {formatPrice(totalInventoryValuation)}
                  </span>
                </div>
                <div className="mt-1">
                  {lowStockProducts.length > 0 ? (
                    <div className="flex items-center justify-between text-[11px] font-bold text-rose-600">
                      <span className="flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                        <span>{toPersianDigits(lowStockProducts.length)} قلم به حداقل رسیده</span>
                      </span>
                      <span className="text-rose-700 underline">بررسی</span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between text-[11px] font-semibold text-emerald-600">
                      <span>موجودی اقلام در وضعیت امن</span>
                      <span>کاردکس فعال</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ===================== 2-COLUMN SPLIT WORKSPACE ===================== */}
          <div className="order-3 grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {/* RIGHT COLUMN (7 or 8 COLS): OPERATIONAL FEED & ALERTS */}
            <div className="lg:col-span-7 xl:col-span-8 space-y-4">
              {/* 1. CRITICAL STOCK REPLENISHMENT ALERTS (IF ANY LOW STOCK) */}
              {lowStockProducts.length > 0 ? (
                <div className="bg-rose-50/70 border border-rose-200/90 rounded-2xl sm:rounded-3xl p-4 sm:p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-rose-600 text-white flex items-center justify-center">
                        <AlertTriangle className="w-4 h-4 stroke-[2.4]" />
                      </div>
                      <div>
                        <h3 className="font-extrabold text-rose-950 text-sm sm:text-base">
                          هشدارهای فوری کسری موجودی انبار ({toPersianDigits(lowStockProducts.length)} قلم)
                        </h3>
                        <span className="text-[11px] text-rose-700 font-medium">
                          اقلامی که موجودی آن‌ها به حداقل نقطه سفارش رسیده یا تمام شده است
                        </span>
                      </div>
                    </div>

                    {canPurchases && (
                      <button
                        type="button"
                        onClick={() => onNavigate('purchases')}
                        className="text-xs font-black bg-rose-600 hover:bg-rose-700 text-white px-3 py-1.5 rounded-xl transition-colors cursor-pointer shadow-xs"
                      >
                        ثبت فاکتور خرید
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                    {lowStockProducts.slice(0, 4).map((p) => (
                      <div
                        key={`alert-${p.id}`}
                        className="p-2.5 rounded-xl bg-white border border-rose-200/80 flex items-center justify-between text-xs shadow-2xs"
                      >
                        <div className="min-w-0 pr-1">
                          <span className="font-black text-slate-800 block truncate">
                            {p.name}
                          </span>
                          <span className="text-[11px] text-rose-600 font-bold block mt-0.5">
                            موجودی فعلی: {toPersianDigits(p.stock)} {p.unit} (حداقل: {toPersianDigits(p.minStockAlert)})
                          </span>
                        </div>
                        {canInventory && (
                          <button
                            type="button"
                            onClick={() => onNavigate('inventory')}
                            className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-[11px] rounded-lg border border-rose-200 transition-colors cursor-pointer shrink-0"
                          >
                            تامین
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  {lowStockProducts.length > 4 && (
                    <div className="text-left pt-1">
                      <button
                        type="button"
                        onClick={() => onNavigate('inventory')}
                        className="text-xs font-bold text-rose-700 hover:underline cursor-pointer"
                      >
                        مشاهده همه {toPersianDigits(lowStockProducts.length)} قلم کالای کسری ←
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-emerald-50/50 border border-emerald-200/80 rounded-2xl p-3.5 flex items-center justify-between text-xs text-emerald-900">
                  <div className="flex items-center gap-2 font-bold">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>وضعیت موجودی انبارها مطلوب است؛ هیچ کالایی در نقطه بحرانی قرار ندارد.</span>
                  </div>
                  {canInventory && (
                    <button
                      type="button"
                      onClick={() => onNavigate('inventory')}
                      className="text-[11px] font-extrabold text-emerald-700 hover:underline cursor-pointer"
                    >
                      مشاهده کاردکس
                    </button>
                  )}
                </div>
              )}

              {/* 2. RECENT INVOICES STREAM WITH QUICK FILTER */}
              <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/90 shadow-xs p-4 sm:p-5 space-y-3.5">
                {/* Header with Quick Status Filter Tabs */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="font-black text-slate-900 text-sm sm:text-base">
                        آخرین فاکتورهای ثبت شده
                      </h3>
                      <span className="text-[11px] text-slate-400 font-medium">
                        گردش فروش و وضعیت تسویه سفارشات اخیر
                      </span>
                    </div>
                  </div>

                  {/* Filter tabs */}
                  <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl text-xs overflow-x-auto">
                    <button
                      type="button"
                      onClick={() => setRecentInvoicesFilter('all')}
                      className={`px-2.5 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                        recentInvoicesFilter === 'all'
                          ? 'bg-white text-slate-900 shadow-2xs'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      همه ({toPersianDigits(invoices.length)})
                    </button>
                    <button
                      type="button"
                      onClick={() => setRecentInvoicesFilter('confirmed')}
                      className={`px-2.5 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                        recentInvoicesFilter === 'confirmed'
                          ? 'bg-white text-teal-800 shadow-2xs'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      تایید ({toPersianDigits(confirmedInvoices.length)})
                    </button>
                    <button
                      type="button"
                      onClick={() => setRecentInvoicesFilter('draft')}
                      className={`px-2.5 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                        recentInvoicesFilter === 'draft'
                          ? 'bg-white text-amber-800 shadow-2xs'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      پیش‌نویس ({toPersianDigits(draftInvoices.length)})
                    </button>
                    {cancelledInvoices.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setRecentInvoicesFilter('cancelled')}
                        className={`px-2.5 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                          recentInvoicesFilter === 'cancelled'
                            ? 'bg-white text-rose-800 shadow-2xs'
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        لغو ({toPersianDigits(cancelledInvoices.length)})
                      </button>
                    )}
                  </div>
                </div>

                {/* Invoices List */}
                {filteredRecentInvoices.length === 0 ? (
                  <div className="py-10 text-center text-slate-400 text-xs space-y-2">
                    <p>هیچ فاکتوری در این وضعیت یافت نشد.</p>
                    {canInvoice && (
                      <button
                        type="button"
                        onClick={() => onNewInvoice()}
                        className="text-emerald-700 font-bold hover:underline cursor-pointer"
                      >
                        + صدور اولین فاکتور فروش
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredRecentInvoices.map((inv) => {
                      const isPaid = inv.paymentStatus === 'paid';
                      const isPartial = inv.paymentStatus === 'partial';

                      return (
                        <div
                          key={`rec-${inv.id}`}
                          onClick={() => onViewInvoice(inv)}
                          className="p-3 rounded-2xl border border-slate-200/80 hover:border-slate-300 hover:bg-slate-50/70 transition-all cursor-pointer flex items-center justify-between text-xs group"
                        >
                          <div className="space-y-1 min-w-0 flex-1 pr-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-extrabold text-slate-900 group-hover:text-emerald-800 transition-colors truncate">
                                {inv.customerName || 'مشتری آزاد / متفرقه'}
                              </span>
                              <span className="text-[10px] text-slate-400 font-mono">
                                #{inv.invoiceNumber}
                              </span>
                              {inv.isProforma && (
                                <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.2 rounded">
                                  پیش‌فاکتور
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-[11px] text-slate-500">
                              <span>{toPersianDigits(inv.date)}</span>
                              <span aria-hidden="true">·</span>
                              <span>{toPersianDigits(inv.items?.length || 0)} قلم کالا</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 shrink-0">
                            <div className="text-left space-y-0.5">
                              <span className="text-xs sm:text-sm font-black text-slate-900 block font-mono tabular-nums">
                                {formatPrice(inv.finalTotal || 0)}
                              </span>
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full inline-block border ${
                                  isPaid
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : isPartial
                                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                                    : 'bg-rose-50 text-rose-700 border-rose-200'
                                }`}
                              >
                                {isPaid ? 'تسویه کامل' : isPartial ? 'قسطی / بیعانه' : 'نسیه'}
                              </span>
                            </div>

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onViewInvoice(inv);
                              }}
                              className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
                              title="مشاهده جزئیات فاکتور"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {canInvoicesList && (
                  <div className="pt-2 text-center">
                    <button
                      type="button"
                      onClick={() => onNavigate('invoices')}
                      className="text-xs font-bold text-slate-600 hover:text-slate-900 hover:underline cursor-pointer"
                    >
                      مشاهده تمامی فاکتورها در بخش مدیریت فاکتورها ←
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* LEFT COLUMN (5 or 4 COLS): DEBTORS, WAREHOUSES & FAST SHORTCUTS */}
            <div className="lg:col-span-5 xl:col-span-4 space-y-4">
              {/* 1. TOP OUTSTANDING DEBTORS (مشتریان بدهکار جهت تسویه سریع) */}
              <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/90 shadow-xs p-4 sm:p-5 space-y-3.5">
                <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
                      <Wallet className="w-4 h-4 stroke-[2.2]" />
                    </div>
                    <div>
                      <h4 className="font-black text-slate-900 text-sm">
                        بدهکاران نیازمند تسویه
                      </h4>
                      <span className="text-[11px] text-slate-400 font-medium">
                        طرف‌حساب‌های با بیشترین مانده بدهی
                      </span>
                    </div>
                  </div>

                  {(canCustomers || canInvoice || canAdmin) && (
                    <button
                      type="button"
                      onClick={() => {
                        setDepositFilterOnlyDebtors(true);
                        setIsDepositPickerOpen(true);
                      }}
                      className="text-xs font-bold text-rose-600 hover:underline cursor-pointer"
                    >
                      تسویه
                    </button>
                  )}
                </div>

                {topDebtors.length === 0 ? (
                  <div className="py-6 text-center text-xs text-slate-400">
                    تمامی حساب‌های مشتریان تسویه است و مانده بدهی وجود ندارد.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {topDebtors.map(({ customer: cust, balance }) => (
                      <div
                        key={`debtor-${cust.id}`}
                        className="p-2.5 rounded-xl border border-slate-200/80 bg-slate-50/50 hover:bg-slate-100/70 transition-all flex items-center justify-between text-xs"
                      >
                        <div className="min-w-0 pr-1">
                          <span className="font-extrabold text-slate-800 block truncate">
                            {cust.name}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono block mt-0.5">
                            {cust.phone ? toPersianDigits(cust.phone) : 'بدون شماره'}
                          </span>
                        </div>

                        <div className="text-left space-y-1 shrink-0">
                          <span className="text-xs font-black text-rose-700 block font-mono tabular-nums">
                            {formatPrice(balance)}
                          </span>
                          {(canCustomers || canInvoice || canAdmin) && (
                            <button
                              type="button"
                              onClick={() => setDepositSelectedCustomer(cust)}
                              className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] rounded-md transition-colors cursor-pointer shadow-xs"
                            >
                              ثبت واریزی
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {canCustomers && (
                  <button
                    type="button"
                    onClick={() => onNavigate('customers')}
                    className="w-full text-center py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                  >
                    مشاهده تمامی {toPersianDigits(customers.length)} مخاطب و دفاتر حساب
                  </button>
                )}
              </div>

              {/* 2. ACTIVE WAREHOUSE & INVENTORY STRUCTURE */}
              {(canInventory || canAdmin) && (
                <div
                  id="card-active-warehouse-status"
                  onClick={() => setIsWarehouseModalOpen(true)}
                  className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/90 shadow-xs p-4 sm:p-5 space-y-3 cursor-pointer hover:border-amber-300 transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-slate-900 text-amber-300 flex items-center justify-center shadow-xs">
                        <Warehouse className="w-4 h-4 stroke-[2.2]" />
                      </div>
                      <div>
                        <h4 className="font-black text-slate-900 text-xs sm:text-sm">
                          انبار پیش‌فرض سامانه
                        </h4>
                        <span className="text-[11px] font-bold text-amber-800">
                          {defaultWarehouse?.name || 'انبار مرکزی'}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsWarehouseModalOpen(true);
                      }}
                      className="text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                    >
                      تغییر
                    </button>
                  </div>

                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    سامانه از ۳ انبار تفکیک‌شده پشتیبانی می‌کند. برای تعیین انبار پیش‌فرض در صدور فاکتور و ورود کالا، روی این بخش کلیک کنید.
                  </p>
                </div>
              )}

              {/* 3. FAST SHORTCUTS & APP HEALTH */}
              <div className="bg-slate-900 text-white rounded-2xl sm:rounded-3xl p-4 sm:p-5 space-y-3 shadow-md">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-slate-200">
                    نگهداری و ابزارهای سریع
                  </span>
                  <span className="text-[10px] text-amber-400 font-bold bg-amber-400/15 px-2 py-0.5 rounded-full">
                    آماده به کار
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  {canInvoice && (
                    <button
                      type="button"
                      onClick={onNewInvoice}
                      className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-right font-bold text-slate-200 hover:text-white transition-colors flex items-center gap-2 cursor-pointer"
                    >
                      <PlusCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span className="truncate">فاکتور جدید</span>
                    </button>
                  )}

                  {canInvoicesList && (
                    <button
                      type="button"
                      onClick={() => onNavigate('invoices')}
                      className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-right font-bold text-slate-200 hover:text-white transition-colors flex items-center gap-2 cursor-pointer"
                    >
                      <ReceiptText className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                      <span className="truncate">سفارشات</span>
                    </button>
                  )}

                  {canInventory && (
                    <button
                      type="button"
                      onClick={() => onNavigate('inventory')}
                      className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-right font-bold text-slate-200 hover:text-white transition-colors flex items-center gap-2 cursor-pointer"
                    >
                      <Boxes className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span className="truncate">انبار و کالا</span>
                    </button>
                  )}

                  {canPurchases && (
                    <button
                      type="button"
                      onClick={() => onNavigate('purchases')}
                      className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-right font-bold text-slate-200 hover:text-white transition-colors flex items-center gap-2 cursor-pointer"
                    >
                      <ShoppingCart className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                      <span className="truncate">خرید کالا</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setIsUpdateModalOpen(true)}
                    className="col-span-2 p-2.5 rounded-xl bg-sky-950/70 hover:bg-sky-900 border border-sky-800/60 text-right font-bold text-sky-200 hover:text-white transition-colors flex items-center justify-between cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <RefreshCw className={`w-3.5 h-3.5 text-sky-400 ${isUpdatingApp ? 'animate-spin' : ''}`} />
                      <span>بروزرسانی نسخه برنامه و پاکسازی کش</span>
                    </div>
                    <span className="text-[10px] text-sky-300 font-mono">PWA</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      ) : (
        /* ===================== CHARTS & FINANCIAL ANALYTICS TAB ===================== */
        <div className="space-y-5">
          <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/90 p-4 sm:p-5 shadow-xs flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center">
                <BarChart3 className="w-5 h-5 stroke-[2.2] text-amber-400" />
              </div>
              <div>
                <h3 className="font-black text-slate-900 text-sm sm:text-base">
                  گزارشات و تحلیل مالی
                </h3>
                <span className="text-[11px] text-slate-400 font-medium">
                  نمای تحلیلی فروش، توزیع پرداخت‌ها و وضعیت اقلام انبار
                </span>
              </div>
            </div>

            <button
              type="button"
              id="btn-charts-back-to-dashboard"
              onClick={() => setActiveSubTab('dashboard')}
              className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 active:scale-98 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>پیشخوان عملیات</span>
            </button>
          </div>

          {/* Revenue & Sales Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
              <span className="text-xs text-slate-400 font-bold block">فروش کل سامانه</span>
              <span className="text-base sm:text-lg font-black text-slate-900 mt-1 block font-mono tabular-nums">
                {formatPrice(totalRevenue)}
              </span>
              <span className="text-[10px] text-emerald-600 font-semibold mt-0.5 block">
                {toPersianDigits(confirmedInvoices.length)} فاکتور تایید شده
              </span>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
              <span className="text-xs text-slate-400 font-bold block">فروش امروز</span>
              <span className="text-base sm:text-lg font-black text-teal-600 mt-1 block font-mono tabular-nums">
                {formatPrice(todayRevenue)}
              </span>
              <span className="text-[10px] text-slate-400 font-semibold mt-0.5 block">
                تاریخ: {toPersianDigits(currentDate)}
              </span>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
              <span className="text-xs text-slate-400 font-bold block">میانگین هر فاکتور</span>
              <span className="text-base sm:text-lg font-black text-blue-600 mt-1 block font-mono tabular-nums">
                {formatPrice(confirmedInvoices.length ? Math.round(totalRevenue / confirmedInvoices.length) : 0)}
              </span>
              <span className="text-[10px] text-slate-400 font-semibold mt-0.5 block">
                بر اساس فاکتورهای رسمی
              </span>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
              <span className="text-xs text-slate-400 font-bold block">مشتریان فعال</span>
              <span className="text-base sm:text-lg font-black text-purple-600 mt-1 block font-mono tabular-nums">
                {toPersianDigits(customers.length)} مخاطب
              </span>
              <span className="text-[10px] text-slate-400 font-semibold mt-0.5 block">
                طرف‌حساب‌های فروشگاه
              </span>
            </div>
          </div>

          {/* 2 Columns on Desktop */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Column 1: Inventory stock list */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <span className="font-extrabold text-slate-800 text-sm sm:text-base">وضعیت کالاهای انبار</span>
                <span className="text-xs font-bold text-slate-500">
                  مجموع: {toPersianDigits(products.length)} قلم کالا
                </span>
              </div>

              <div className="space-y-1.5">
                {products.slice(0, 7).map((p, idx) => {
                  const isLow = p.stock <= p.minStockAlert;
                  return (
                    <div
                      key={`chart-p-${p.id}`}
                      className={`flex items-center justify-between text-xs py-2 px-2.5 rounded-xl transition-colors ${
                        idx % 2 === 1 ? 'bg-slate-100/70' : 'bg-white'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${isLow ? 'bg-rose-500' : 'bg-emerald-500'}`} />
                        <span className="font-bold text-slate-800 truncate max-w-[200px] sm:max-w-xs">{p.name}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-slate-500 font-mono">{formatPrice(p.sellPrice)}</span>
                        <span className={`px-2.5 py-0.5 rounded-lg font-bold text-[11px] font-mono ${
                          isLow ? 'bg-rose-50 text-rose-600 border border-rose-200' : 'bg-slate-100 text-slate-700'
                        }`}>
                          {toPersianDigits(p.stock)} {p.unit}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={() => onNavigate('inventory')}
                className="w-full text-center py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                مشاهده کاردکس و موجودی کلیه اقلام
              </button>
            </div>

            {/* Column 2: Payment Status Breakdown */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <span className="font-extrabold text-slate-800 text-sm sm:text-base">توزیع وضعیت پرداخت فاکتورها</span>
                  <span className="text-xs font-bold text-slate-500">
                    {toPersianDigits(invoices.length)} فاکتور ثبت شده
                  </span>
                </div>

                <div className="space-y-3 pt-2">
                  <div>
                    <div className="flex justify-between text-xs font-bold mb-1">
                      <span className="text-emerald-700">تسویه کامل نقدی/کارتخوان</span>
                      <span className="font-mono">{toPersianDigits(invoices.filter(i => i.paymentStatus === 'paid').length)} فاکتور</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                      <div
                        className="bg-emerald-500 h-full rounded-full transition-all"
                        style={{ width: `${invoices.length ? (invoices.filter(i => i.paymentStatus === 'paid').length / invoices.length) * 100 : 0}%` }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs font-bold mb-1">
                      <span className="text-amber-700">پرداخت قسطی / بیعانه</span>
                      <span className="font-mono">{toPersianDigits(invoices.filter(i => i.paymentStatus === 'partial').length)} فاکتور</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                      <div
                        className="bg-amber-500 h-full rounded-full transition-all"
                        style={{ width: `${invoices.length ? (invoices.filter(i => i.paymentStatus === 'partial').length / invoices.length) * 100 : 0}%` }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs font-bold mb-1">
                      <span className="text-rose-700">نسیه / پرداخت‌نشده</span>
                      <span className="font-mono">{toPersianDigits(invoices.filter(i => i.paymentStatus === 'unpaid').length)} فاکتور</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                      <div
                        className="bg-rose-500 h-full rounded-full transition-all"
                        style={{ width: `${invoices.length ? (invoices.filter(i => i.paymentStatus === 'unpaid').length / invoices.length) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => onNavigate('reports')}
                className="w-full text-center py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-xl text-xs font-bold transition-colors cursor-pointer mt-4"
              >
                مشاهده گزارشات تفصیلی مالی و نمودارهای تحلیلی
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================== MODALS ===================== */}

      {/* 1. WAREHOUSE SETTINGS MODAL ("ویرایش مشخصات انبار") */}
      {isWarehouseModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-3">
          <div className="bg-white rounded-3xl w-full max-w-md p-5 shadow-2xl space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-slate-900 text-amber-300 flex items-center justify-center">
                  <Warehouse className="w-5 h-5 stroke-[2.2]" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-base">ویرایش مشخصات انبارها</h3>
                  <span className="text-[11px] text-slate-400 font-medium">تعریف نام ۳ انبار و انتخاب انبار پیش‌فرض</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsWarehouseModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              شما می‌توانید برای هر یک از ۳ انبار خود یک نام دلخواه تعریف کرده و یکی را به عنوان انبار پیش‌فرض سامانه تعیین نمایید:
            </p>

            {/* Warehouse Form Inputs */}
            <div className="space-y-3">
              {warehouseList.map((wh, idx) => {
                const isSelected = selectedDefaultWh === wh.id;
                return (
                  <div
                    key={wh.id}
                    className={`p-3.5 rounded-2xl border transition-all ${
                      isSelected
                        ? 'border-amber-400 bg-amber-50/40'
                        : 'border-slate-200 bg-slate-50/50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-black text-slate-800">
                        انبار شماره {toPersianDigits(idx + 1)}
                      </span>
                      <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 cursor-pointer">
                        <input
                          type="radio"
                          name="default-warehouse"
                          checked={isSelected}
                          onChange={() => setSelectedDefaultWh(wh.id)}
                          className="accent-amber-600 w-4 h-4 cursor-pointer"
                        />
                        <span>پیش‌فرض</span>
                      </label>
                    </div>

                    <input
                      type="text"
                      value={wh.name}
                      onChange={(e) => {
                        const val = e.target.value;
                        setWarehouseList((prev) =>
                          prev.map((item) => (item.id === wh.id ? { ...item, name: val } : item))
                        );
                      }}
                      placeholder={`نام انبار ${idx + 1}`}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                );
              })}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={handleSaveWarehouses}
                className="flex-1 bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs py-2.5 rounded-xl shadow-md transition-colors flex items-center justify-center gap-1.5"
              >
                <Check className="w-4 h-4 text-emerald-400" />
                <span>ذخیره مشخصات انبارها</span>
              </button>
              <button
                type="button"
                onClick={() => setIsWarehouseModalOpen(false)}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors"
              >
                انصراف
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. STOCKTAKING AUDIT MODAL ("انبار گردانی") */}
      {isAuditModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-3">
          <div className="bg-white rounded-3xl w-full max-w-lg p-5 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center">
                  <RotateCw className="w-5 h-5 stroke-[2.2]" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-base">انبارگردانی و تطبیق موجودی</h3>
                  <span className="text-[11px] text-slate-400 font-medium">شمارش فیزیکی اقلام و اصلاح کسری/مازاد</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAuditModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {auditSuccessMsg && (
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold p-3 rounded-xl flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>{auditSuccessMsg}</span>
              </div>
            )}

            <div className="space-y-2.5 max-h-[50vh] overflow-y-auto pr-1">
              {products.map((p, idx) => {
                const currentPhysical = auditQuantities[p.id] ?? p.stock;
                const diff = currentPhysical - p.stock;

                return (
                  <div
                    key={p.id}
                    className={`p-3 rounded-2xl border border-slate-200/80 space-y-2 ${
                      idx % 2 === 1 ? 'bg-slate-100/80' : 'bg-slate-50/50'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-extrabold text-slate-800">{p.name}</span>
                      <span className="text-[11px] text-slate-500">کد: {toPersianDigits(p.code)}</span>
                    </div>

                    <div className="flex items-center justify-between gap-3 text-xs">
                      <div className="text-slate-500">
                        موجودی سیستمی: <strong className="text-slate-800">{formatNumber(p.stock)} {p.unit}</strong>
                      </div>

                      <div className="flex items-center gap-2">
                        <label className="text-slate-600 font-bold text-[11px]">شمارش جدید:</label>
                        <div className="w-20">
                          <NumericInput
                            min={0}
                            value={currentPhysical}
                            onChange={(num) => {
                              setAuditQuantities((prev) => ({
                                ...prev,
                                [p.id]: num,
                              }));
                            }}
                            textAlign="center"
                            className="w-full bg-white border border-slate-300 rounded-lg px-2 py-1 text-center font-bold text-xs focus:ring-1 focus:ring-emerald-500"
                          />
                        </div>
                        {diff !== 0 && (
                          <button
                            type="button"
                            onClick={() => handleApplyAudit(p.id)}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                          >
                            ثبت
                          </button>
                        )}
                      </div>
                    </div>

                    {diff !== 0 && (
                      <div className="text-[11px] flex items-center gap-1 font-bold">
                        <span className={diff > 0 ? 'text-teal-600' : 'text-rose-600'}>
                          اختلاف: {diff > 0 ? `+${formatNumber(diff)}` : formatNumber(diff)} {p.unit} ({diff > 0 ? 'مازاد' : 'کسری'})
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 5. STATUS FILTER VIEW MODAL (پیش نویس / تایید شده / لغو شده) */}
      {activeStatusFilter && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-3">
          <div className="bg-white rounded-3xl w-full max-w-md p-5 shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <span className="font-extrabold text-slate-900 text-base">
                فاکتورهای {activeStatusFilter === 'draft' ? 'پیش نویس' : activeStatusFilter === 'confirmed' ? 'تایید شده' : 'لغو شده'}
              </span>
              <button
                type="button"
                onClick={() => setActiveStatusFilter(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2">
              {(activeStatusFilter === 'draft'
                ? draftInvoices
                : activeStatusFilter === 'confirmed'
                ? confirmedInvoices
                : cancelledInvoices
              ).map((inv, idx) => (
                <div
                  key={inv.id}
                  onClick={() => {
                    setActiveStatusFilter(null);
                    onViewInvoice(inv);
                  }}
                  className={`p-3 rounded-2xl border border-slate-200 cursor-pointer transition-colors flex items-center justify-between text-xs ${
                    idx % 2 === 1 ? 'bg-slate-100/80' : 'bg-white'
                  } hover:bg-slate-100`}
                >
                  <div>
                    <span className="font-bold text-slate-800 block">فاکتور شماره {toPersianDigits(inv.invoiceNumber)}</span>
                    <span className="text-[11px] text-slate-500 mt-0.5 block">{inv.customerName} • {toPersianDigits(inv.date)}</span>
                  </div>
                  <div className="text-left">
                    <span className="font-extrabold text-emerald-700 block">{formatPrice(inv.finalTotal)}</span>
                    <span className="text-[10px] text-slate-400 font-bold block">مشاهده فاکتور</span>
                  </div>
                </div>
              ))}

              {(activeStatusFilter === 'draft' ? draftInvoices : activeStatusFilter === 'confirmed' ? confirmedInvoices : cancelledInvoices).length === 0 && (
                <p className="text-center text-xs text-slate-400 py-6">موردی در این بخش وجود ندارد.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ROLE-BASED "بیشتر امکانات" MODAL */}
      {isMoreFeaturesModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-3 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-2xl p-5 sm:p-6 shadow-2xl space-y-4 max-h-[88vh] overflow-y-auto border border-slate-200 animate-in zoom-in-95">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold shadow-xs">
                  <MoreHorizontal className="w-5 h-5 stroke-[2.5]" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-extrabold text-slate-900 text-base sm:text-lg">امکانات و بخش‌های سامانه</h3>
                    <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-700 border border-purple-200">
                      {currentUser?.roleTitle || roleConfig?.label || 'دسترسی مجاز'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    فهرست ابزارها بر اساس سطح دسترسی و نقش شما فیلتر شده است
                  </p>
                </div>
              </div>
              <button
                type="button"
                id="btn-close-more-features-modal"
                onClick={() => setIsMoreFeaturesModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Permitted Features Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              {allPermittedFeatures.map((feat) => {
                const Icon = feat.icon;
                return (
                  <div
                    key={feat.id}
                    id={`feature-card-${feat.id}`}
                    onClick={feat.onClick}
                    className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between group active:scale-98 shadow-xs ${feat.bgClass}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-xs border border-slate-100 shrink-0 group-hover:scale-105 transition-transform ${feat.colorClass}`}>
                          <Icon className="w-5 h-5 stroke-[2.2]" />
                        </div>
                        <div>
                          <span className="font-extrabold text-slate-900 text-sm block">
                            {feat.title}
                          </span>
                          <span className="text-[11px] text-slate-600 font-medium block mt-0.5 line-clamp-2">
                            {feat.subtitle}
                          </span>
                        </div>
                      </div>
                    </div>

                    {feat.badgeText && (
                      <div className="mt-3 pt-2 border-t border-slate-200/60 flex items-center justify-between text-[11px]">
                        <span className="font-bold text-slate-500">{feat.badgeText}</span>
                        <span className="font-extrabold text-slate-700 flex items-center gap-1 group-hover:translate-x-[-2px] transition-transform">
                          <span>ورود به بخش</span>
                          <ChevronLeft className="w-3.5 h-3.5" />
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Modal Footer Note */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
              <span>تعداد امکانات مجاز برای شما: {toPersianDigits(allPermittedFeatures.length)} مورد</span>
              <button
                type="button"
                onClick={() => setIsMoreFeaturesModalOpen(false)}
                className="text-slate-600 hover:text-slate-900 font-bold cursor-pointer"
              >
                بستن پنجره
              </button>
            </div>
          </div>
        </div>
      )}

      {/* APP UPDATE & CLEAR BROWSER CACHE MODAL */}
      {isUpdateModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-3 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-md p-5 sm:p-6 shadow-2xl space-y-4 border border-slate-200 animate-in zoom-in-95">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-sky-100 text-sky-700 flex items-center justify-center font-bold shadow-xs">
                  <RefreshCw className={`w-5 h-5 ${isUpdatingApp ? 'animate-spin' : ''}`} />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-base">بروزرسانی برنامه و پاکسازی کش</h3>
                  <span className="text-[11px] text-slate-400 font-medium block">بارگذاری سریع آخرین فایل‌ها و امکانات</span>
                </div>
              </div>
              <button
                type="button"
                disabled={isUpdatingApp}
                onClick={() => setIsUpdateModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Explanation card */}
            <div className="p-3.5 rounded-2xl bg-sky-50/70 border border-sky-200/80 text-xs text-sky-950 space-y-2">
              <div className="flex items-center gap-1.5 font-bold text-sky-900">
                <Sparkles className="w-4 h-4 text-sky-600 shrink-0" />
                <span>چرا کش مرورگر باید پاکسازی شود؟</span>
              </div>
              <p className="text-[12px] leading-relaxed text-slate-600">
                مرورگر برای افزایش سرعت، کدهای سامانه را ذخیره (کش) می‌کند. زمانی که برنامه به روز می‌شود، ممکن است فایل‌های قدیمی همچنان از حافظه موقت خوانده شوند. با زدن دکمه زیر، فایل‌های قدیمی پاکسازی شده و آخرین نسخه برنامه بارگذاری می‌شود.
              </p>
            </div>

            {/* Safety badge */}
            <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-start gap-2.5 text-xs text-emerald-900">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <span className="font-bold block">اطلاعات شما کاملاً امن است</span>
                <span className="text-[11px] text-emerald-700 block">
                  این عملیات فقط کدهای رابط کاربری را نوسازی می‌کند و هیچ‌یک از فاکتورها، اقلام انبار یا مشتریان شما حذف نخواهند شد.
                </span>
              </div>
            </div>

            {lastCacheTime && (
              <div className="text-[11px] text-slate-400 text-center font-medium">
                آخرین بروزرسانی ثبت‌شده در مرورگر: {toPersianDigits(lastCacheTime)}
              </div>
            )}

            {updateProgressMsg && (
              <div className="p-2.5 rounded-xl bg-slate-100 text-center text-xs font-bold text-slate-700 animate-pulse">
                {updateProgressMsg}
              </div>
            )}

            {/* Actions */}
            <div className="pt-2 flex items-center gap-2.5">
              <button
                type="button"
                id="btn-confirm-app-update"
                disabled={isUpdatingApp}
                onClick={handlePerformAppUpdate}
                className="flex-1 py-3 px-4 rounded-xl bg-sky-600 hover:bg-sky-700 active:scale-98 text-white font-extrabold text-xs shadow-md shadow-sky-600/20 transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-70"
              >
                <RefreshCw className={`w-4 h-4 ${isUpdatingApp ? 'animate-spin' : ''}`} />
                <span>{isUpdatingApp ? 'در حال پاکسازی و بارگذاری...' : 'پاکسازی کش و دریافت آخرین نسخه'}</span>
              </button>

              <button
                type="button"
                disabled={isUpdatingApp}
                onClick={() => setIsUpdateModalOpen(false)}
                className="py-3 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
              >
                انصراف
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. CUSTOMER DEPOSIT PICKER MODAL (ثبت واریزی از مشتری) */}
      {isDepositPickerOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-3 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-lg p-5 sm:p-6 shadow-2xl space-y-4 max-h-[88vh] flex flex-col border border-slate-200 animate-in zoom-in-95">
            {/* Header */}
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold shadow-xs">
                  <Coins className="w-5 h-5 stroke-[2.4]" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-base sm:text-lg">
                    ثبت واریزی و دریافت وجه از مشتری
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    طرف‌حساب مورد نظر را جهت ثبت پرداخت نقد، پوز یا چک انتخاب کنید
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsDepositPickerOpen(false);
                  setDepositSearchQuery('');
                  setDepositFilterOnlyDebtors(false);
                }}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Search and Filters */}
            <div className="space-y-2.5 shrink-0">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={depositSearchQuery}
                  onChange={(e) => setDepositSearchQuery(e.target.value)}
                  placeholder="جستجوی مشتری (نام، شماره تماس یا کد ملی)..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-10 pl-3 py-2.5 text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden transition-all"
                  autoFocus
                />
              </div>

              <div className="flex items-center justify-between gap-2 text-xs">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={depositFilterOnlyDebtors}
                    onChange={(e) => setDepositFilterOnlyDebtors(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300"
                  />
                  <span className="font-bold text-slate-700 text-xs">
                    فقط مشتریان دارای بدهی
                  </span>
                </label>
                <span className="text-[11px] text-slate-400 font-medium">
                  {toPersianDigits(filteredDepositCustomers.length)} طرف‌حساب
                </span>
              </div>
            </div>

            {/* Customers List */}
            <div className="overflow-y-auto flex-1 space-y-2 pr-1 divide-y divide-slate-50">
              {filteredDepositCustomers.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs space-y-2">
                  <p>هیچ مشتری با مشخصات وارد شده یافت نشد.</p>
                  <button
                    type="button"
                    onClick={() => {
                      setIsDepositPickerOpen(false);
                      onNavigate('customers');
                    }}
                    className="text-emerald-700 font-bold hover:underline cursor-pointer"
                  >
                    رفتن به مدیریت مشتریان
                  </button>
                </div>
              ) : (
                filteredDepositCustomers.map((cust) => {
                  const allTxns = StorageService.getCustomerTransactions();
                  const ledger = StorageService.buildCustomerLedger(cust, invoices, allTxns);
                  const isDebtor = ledger.netBalance > 0;
                  const isCreditor = ledger.netBalance < 0;

                  return (
                    <div
                      key={cust.id}
                      onClick={() => {
                        setDepositSelectedCustomer(cust);
                        setIsDepositPickerOpen(false);
                      }}
                      className="p-3 rounded-2xl border border-slate-200/80 hover:border-emerald-300 hover:bg-emerald-50/40 transition-all cursor-pointer flex items-center justify-between group active:scale-99"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-slate-100 group-hover:bg-emerald-100 group-hover:text-emerald-700 text-slate-600 flex items-center justify-center font-bold text-xs shrink-0 transition-colors">
                          <Users className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <span className="font-extrabold text-slate-900 text-xs sm:text-sm block truncate group-hover:text-emerald-800 transition-colors">
                            {cust.name}
                          </span>
                          <span className="text-[11px] text-slate-400 font-mono block mt-0.5">
                            {cust.phone ? toPersianDigits(cust.phone) : 'بدون شماره تماس'}
                          </span>
                        </div>
                      </div>

                      <div className="text-left shrink-0 space-y-1">
                        <div className="flex items-center justify-end gap-1.5">
                          <span className={`text-xs sm:text-sm font-black font-mono ${
                            isDebtor ? 'text-rose-700' : isCreditor ? 'text-blue-700' : 'text-slate-500'
                          }`}>
                            {toPersianDigits(Math.abs(ledger.netBalance).toLocaleString('en-US'))} {settings.currency}
                          </span>
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                            isDebtor ? 'bg-rose-100 text-rose-700' : isCreditor ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'
                          }`}>
                            {isDebtor ? 'بدهکار' : isCreditor ? 'طلبکار' : 'بی‌حساب'}
                          </span>
                        </div>
                        <span className="text-[10px] text-emerald-600 font-bold block group-hover:underline">
                          ثبت واریزی ←
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* 7. CUSTOMER TRANSACTION MODAL (REGISTER DEPOSIT / PAYMENT) */}
      {depositSelectedCustomer && (
        <CustomerTransactionModal
          isOpen={!!depositSelectedCustomer}
          onClose={() => setDepositSelectedCustomer(null)}
          customer={depositSelectedCustomer}
          initialType="deposit"
          invoices={invoices}
          transactions={StorageService.getCustomerTransactions()}
          settings={settings}
          currentUser={currentUser || undefined}
          onSaveTransaction={(txn) => {
            if (onSaveTransaction) {
              onSaveTransaction(txn);
            } else {
              StorageService.addCustomerTransaction(txn);
            }
            setDepositSelectedCustomer(null);
          }}
        />
      )}
    </div>
  );
};
