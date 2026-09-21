import React, { useState, useMemo } from 'react';
import { 
  Product, 
  Invoice, 
  Customer, 
  PurchaseInvoice, 
  InboundReceipt, 
  StoreSettings, 
  AppUser,
  WarehouseInfo 
} from '../types';
import { formatPrice, toPersianDigits, getCurrentJalaliDate, getCurrentJalaliTime } from '../utils/jalali';
import { StorageService } from '../utils/storage';
import { getRoleBadgeConfig, isTabPermitted } from '../utils/permissions';
import { clearAppCacheAndReload, getLastCacheUpdatedTime } from '../utils/appUpdater';
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
  Sparkles
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
}) => {
  const currentDate = getCurrentJalaliDate();
  const currentTime = getCurrentJalaliTime();

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
    return [...invoices].reverse().slice(0, 5);
  }, [invoices]);

  const lowStockProducts = useMemo(() => {
    return products.filter((p) => p.stock <= p.minStockAlert);
  }, [products]);

  // Stock audit adjustments local state
  const [auditQuantities, setAuditQuantities] = useState<Record<string, number>>({});
  const [auditNotes, setAuditNotes] = useState<Record<string, string>>({});
  const [auditSuccessMsg, setAuditSuccessMsg] = useState('');

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
  }, [canInventory, canInvoice, canCustomers, canInvoicesList, onNavigate, onNewInvoice]);

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
    <div className="w-full max-w-7xl mx-auto space-y-4 sm:space-y-6 select-none">
      {/* ACTIVE USER & PERMISSION ROLE BANNER */}
      {currentUser && (
        <div className="flex items-center justify-between bg-white px-3.5 py-2.5 sm:px-5 sm:py-3 rounded-2xl border border-slate-200/90 shadow-xs text-xs">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl ${getAvatarBgClass(currentUser.avatarColor, currentUser.role)} flex items-center justify-center font-black text-sm shrink-0 shadow-xs`}>
              {currentUser.fullName ? currentUser.fullName.charAt(0) : <UserCheck className="w-5 h-5" />}
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                <span className="font-extrabold text-slate-900 text-xs sm:text-base">
                  {currentUser.fullName}
                </span>
                {roleConfig && (
                  <span className={`text-[10px] sm:text-xs font-extrabold px-2 py-0.5 rounded-full border ${roleConfig.badgeBg} ${roleConfig.badgeText} ${roleConfig.borderColor}`}>
                    {currentUser.roleTitle || roleConfig.label}
                  </span>
                )}
              </div>
              <span className="text-[10px] sm:text-xs text-slate-400 font-medium mt-0.5">
                {currentUser.role === 'admin'
                  ? 'دسترسی نامحدود به تمامی بخش‌های سامانه'
                  : `امکانات فعال: ${[
                      canInvoice ? 'صدور فاکتور' : null,
                      canInvoicesList ? 'مشاهده سفارشات' : null,
                      canInventory ? 'انبارداری' : null,
                      canCustomers ? 'مشتریان' : null,
                      canReports ? 'گزارشات مالی' : null,
                    ].filter(Boolean).join(' • ') || 'دسترسی پایه'}`
                }
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* APP UPDATE & CLEAR CACHE BUTTON */}
            <button
              type="button"
              id="btn-dashboard-update-cache"
              onClick={() => setIsUpdateModalOpen(true)}
              title="بروزرسانی برنامه و نوسازی کش مرورگر"
              className="text-[11px] sm:text-xs font-bold text-sky-700 hover:text-sky-900 bg-sky-50 hover:bg-sky-100 border border-sky-200 hover:border-sky-300 px-2.5 sm:px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 active:scale-95 shadow-xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-sky-600 ${isUpdatingApp ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">بروزرسانی برنامه</span>
              <span className="sm:hidden">آپدیت</span>
            </button>

            {canAdmin && (
              <button
                type="button"
                onClick={() => onNavigate('admin')}
                className="text-[11px] sm:text-xs font-bold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-2.5 sm:px-3 py-1.5 rounded-xl transition-colors cursor-pointer flex items-center gap-1"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span className="hidden sm:inline">پنل مدیریت</span>
                <span className="sm:hidden">مدیر</span>
              </button>
            )}

            {/* DIRECT LOGOUT BUTTON (EXPLICIT FOR MOBILE & DESKTOP) */}
            {onLogout && (
              <button
                type="button"
                id="btn-dashboard-user-logout"
                onClick={onLogout}
                title="خروج از حساب کاربری"
                className="text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 hover:border-rose-300 px-2.5 sm:px-3.5 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 active:scale-95 shadow-xs"
              >
                <LogOut className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-rose-600 shrink-0" />
                <span>خروج</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* GUEST / NO MULTI-USER TOP HEADER BANNER */}
      {!currentUser && (
        <div className="flex items-center justify-between bg-white px-3.5 py-2.5 sm:px-5 sm:py-3 rounded-2xl border border-slate-200/90 shadow-xs text-xs">
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-slate-900 text-sm">{settings.storeName || 'سامانه مدیریت و حسابداری سپهر'}</span>
            <span className="text-slate-400 text-xs hidden sm:inline">• {toPersianDigits(getCurrentJalaliDate())}</span>
          </div>
          <button
            type="button"
            id="btn-dashboard-update-cache-guest"
            onClick={() => setIsUpdateModalOpen(true)}
            title="بروزرسانی برنامه و نوسازی کش مرورگر"
            className="text-[11px] sm:text-xs font-bold text-sky-700 hover:text-sky-900 bg-sky-50 hover:bg-sky-100 border border-sky-200 hover:border-sky-300 px-2.5 sm:px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 active:scale-95 shadow-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-sky-600 ${isUpdatingApp ? 'animate-spin' : ''}`} />
            <span>بروزرسانی برنامه و کش</span>
          </button>
        </div>
      )}

      {/* DESKTOP TOP KPI METRIC CARDS */}
      <div className="hidden sm:grid sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Card 1: فروش امروز */}
        <div
          onClick={() => canInvoicesList && onNavigate('invoices')}
          className={`bg-white rounded-2xl border border-slate-200/90 shadow-xs p-4 flex items-center justify-between transition-all ${
            canInvoicesList ? 'cursor-pointer hover:border-emerald-400 hover:shadow-sm active:scale-99' : ''
          }`}
        >
          <div className="space-y-1">
            <span className="text-xs font-bold text-slate-400 block">فروش امروز</span>
            <span className="text-lg lg:text-xl font-black text-slate-900 block">
              {formatPrice(todayRevenue)}
            </span>
            <span className="text-[11px] font-semibold text-emerald-600 block">
              {toPersianDigits(todayInvoices.length)} فاکتور تایید شده امروز
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100 shadow-xs">
            <TrendingUp className="w-6 h-6 stroke-[2.4]" />
          </div>
        </div>

        {/* Card 2: مجموع فروش کل */}
        <div
          onClick={() => canReports ? setActiveSubTab('charts') : (canInvoicesList && onNavigate('invoices'))}
          className={`bg-white rounded-2xl border border-slate-200/90 shadow-xs p-4 flex items-center justify-between transition-all ${
            (canReports || canInvoicesList) ? 'cursor-pointer hover:border-teal-400 hover:shadow-sm active:scale-99' : ''
          }`}
        >
          <div className="space-y-1">
            <span className="text-xs font-bold text-slate-400 block">مجموع فروش کل سامانه</span>
            <span className="text-lg lg:text-xl font-black text-teal-700 block">
              {formatPrice(totalRevenue)}
            </span>
            <span className="text-[11px] font-semibold text-slate-500 block">
              {toPersianDigits(confirmedInvoices.length)} کل فاکتورهای رسمی
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center shrink-0 border border-teal-100 shadow-xs">
            <DollarSign className="w-6 h-6 stroke-[2.4]" />
          </div>
        </div>

        {/* Card 3: موجودی اقلام انبار */}
        <div
          onClick={() => canInventory && onNavigate('inventory')}
          className={`bg-white rounded-2xl border border-slate-200/90 shadow-xs p-4 flex items-center justify-between transition-all ${
            canInventory ? 'cursor-pointer hover:border-amber-400 hover:shadow-sm active:scale-99' : ''
          }`}
        >
          <div className="space-y-1">
            <span className="text-xs font-bold text-slate-400 block">اقلام تعریف شده انبار</span>
            <span className="text-lg lg:text-xl font-black text-slate-900 block">
              {toPersianDigits(products.length)} قلم کالا
            </span>
            {lowStockProducts.length > 0 ? (
              <span className="text-[11px] font-bold text-rose-600 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3 shrink-0 text-rose-500" />
                <span>{toPersianDigits(lowStockProducts.length)} قلم به نقطه سفارش رسیده</span>
              </span>
            ) : (
              <span className="text-[11px] font-semibold text-emerald-600 block">
                موجودی انبار در محدوده امن
              </span>
            )}
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 border border-amber-100 shadow-xs">
            <Boxes className="w-6 h-6 stroke-[2.4]" />
          </div>
        </div>

        {/* Card 4: مشتریان و مخاطبین */}
        <div
          onClick={() => canCustomers && onNavigate('customers')}
          className={`bg-white rounded-2xl border border-slate-200/90 shadow-xs p-4 flex items-center justify-between transition-all ${
            canCustomers ? 'cursor-pointer hover:border-indigo-400 hover:shadow-sm active:scale-99' : ''
          }`}
        >
          <div className="space-y-1">
            <span className="text-xs font-bold text-slate-400 block">طرف‌حساب‌ها و خریداران</span>
            <span className="text-lg lg:text-xl font-black text-slate-900 block">
              {toPersianDigits(customers.length)} مخاطب
            </span>
            <span className="text-[11px] font-semibold text-indigo-600 block">
              مدیریت حساب و سوابق خرید
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 border border-indigo-100 shadow-xs">
            <Users className="w-6 h-6 stroke-[2.4]" />
          </div>
        </div>
      </div>

      {/* 2. SUB-TABS: "داشبورد" vs "نمودارها" (With Orange Indicator) */}
      <div className="flex items-center justify-center border-b border-slate-200/80">
        {/* Tab 1: داشبورد */}
        <button
          type="button"
          id="tab-btn-dashboard"
          onClick={() => setActiveSubTab('dashboard')}
          className={`flex-1 flex items-center justify-center gap-2 pb-2.5 text-sm sm:text-base font-extrabold transition-all relative cursor-pointer ${
            activeSubTab === 'dashboard'
              ? 'text-slate-900'
              : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          <LayoutGrid className="w-4 h-4 stroke-[2.2]" />
          <span>داشبورد سریع</span>
          {activeSubTab === 'dashboard' && (
            <span className="absolute bottom-0 left-0 right-0 h-[2.5px] bg-[#f05a28] rounded-full" />
          )}
        </button>

        {/* Tab 2: نمودارها (Only if user has reports permission) */}
        {canReports && (
          <button
            type="button"
            id="tab-btn-charts"
            onClick={() => setActiveSubTab('charts')}
            className={`flex-1 flex items-center justify-center gap-2 pb-2.5 text-sm sm:text-base font-extrabold transition-all relative cursor-pointer ${
              activeSubTab === 'charts'
                ? 'text-slate-900'
                : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <BarChart3 className="w-4 h-4 stroke-[2.2]" />
            <span>نمودارها و آمار</span>
            {activeSubTab === 'charts' && (
              <span className="absolute bottom-0 left-0 right-0 h-[2.5px] bg-[#f05a28] rounded-full" />
            )}
          </button>
        )}
      </div>

      {/* 3. MAIN DASHBOARD CONTENT */}
      {activeSubTab === 'dashboard' ? (
        <>
          {/* MOBILE VIEW (< 1024px) */}
          <div className="lg:hidden space-y-3.5">
            {/* ROW 1: TWO LARGE CARDS (SIDE BY SIDE) */}
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            {/* Left Card: صدور فاکتور جدید */}
            {canInvoice ? (
              <div
                id="card-quick-new-invoice-mobile"
                onClick={() => onNewInvoice()}
                className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-4 flex flex-col justify-center items-center text-center cursor-pointer hover:border-emerald-300 hover:shadow-md transition-all active:scale-98 min-h-[155px]"
              >
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-md shadow-emerald-500/25 flex items-center justify-center text-white mb-2.5">
                  <PlusCircle className="w-7 h-7 stroke-[2.2]" />
                </div>
                <span className="text-sm sm:text-base font-extrabold text-slate-800">
                  صدور فاکتور
                </span>
                <span className="text-[10px] text-slate-400 font-medium mt-0.5">
                  فروش نقدی، اعتباری و رسمی
                </span>
              </div>
            ) : canInventory ? (
              <div
                id="card-inventory-list-mobile"
                onClick={() => onNavigate('inventory')}
                className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-4 flex flex-col justify-center items-center text-center cursor-pointer hover:border-amber-300 hover:shadow-md transition-all active:scale-98 min-h-[155px]"
              >
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 shadow-md shadow-amber-500/25 flex items-center justify-center text-white mb-2.5">
                  <Boxes className="w-7 h-7 stroke-[2.2]" />
                </div>
                <span className="text-sm sm:text-base font-extrabold text-slate-800">
                  موجودی انبار
                </span>
                <span className="text-[10px] text-slate-400 font-medium mt-0.5">
                  کاردکس و گردش اقلام
                </span>
              </div>
            ) : (
              <div
                id="card-invoices-list-mobile"
                onClick={() => onNavigate('invoices')}
                className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-4 flex flex-col justify-center items-center text-center cursor-pointer hover:border-sky-300 hover:shadow-md transition-all active:scale-98 min-h-[155px]"
              >
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-sky-500 to-blue-600 shadow-md shadow-sky-500/25 flex items-center justify-center text-white mb-2.5">
                  <ReceiptText className="w-7 h-7 stroke-[2.2]" />
                </div>
                <span className="text-sm sm:text-base font-extrabold text-slate-800">
                  لیست سفارشات
                </span>
                <span className="text-[10px] text-slate-400 font-medium mt-0.5">
                  مشاهده و بررسی فاکتورها
                </span>
              </div>
            )}

            {/* Right Card: Context-Sensitive to Permissions */}
            {canReports ? (
              <div
                id="card-reports"
                onClick={() => setActiveSubTab('charts')}
                className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-4 flex flex-col justify-center items-center text-center cursor-pointer hover:border-orange-300 hover:shadow-md transition-all active:scale-98 min-h-[155px]"
              >
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#f05a28] to-orange-600 shadow-md shadow-orange-500/25 flex items-center justify-center text-white mb-2.5">
                  <BarChart3 className="w-7 h-7 stroke-[2.2]" />
                </div>
                <span className="text-sm sm:text-base font-extrabold text-slate-800">
                  گزارشات
                </span>
                <span className="text-[10px] text-slate-400 font-medium mt-0.5">
                  فروش، سود و آمار انبار
                </span>
              </div>
            ) : canInvoice ? (
              <div
                id="card-quick-new-invoice"
                onClick={() => onNewInvoice()}
                className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-4 flex flex-col justify-center items-center text-center cursor-pointer hover:border-emerald-300 hover:shadow-md transition-all active:scale-98 min-h-[155px]"
              >
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-md shadow-emerald-500/25 flex items-center justify-center text-white mb-2.5">
                  <PlusCircle className="w-7 h-7 stroke-[2.2]" />
                </div>
                <span className="text-sm sm:text-base font-extrabold text-slate-800">
                  صدور فاکتور
                </span>
                <span className="text-[10px] text-slate-400 font-medium mt-0.5">
                  فروش نقدی، اعتباری و چاپ
                </span>
              </div>
            ) : canInvoicesList ? (
              <div
                id="card-invoices-list"
                onClick={() => onNavigate('invoices')}
                className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-4 flex flex-col justify-center items-center text-center cursor-pointer hover:border-sky-300 hover:shadow-md transition-all active:scale-98 min-h-[155px]"
              >
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-sky-500 to-blue-600 shadow-md shadow-sky-500/25 flex items-center justify-center text-white mb-2.5">
                  <ReceiptText className="w-7 h-7 stroke-[2.2]" />
                </div>
                <span className="text-sm sm:text-base font-extrabold text-slate-800">
                  لیست سفارشات
                </span>
                <span className="text-[10px] text-slate-400 font-medium mt-0.5">
                  مشاهده و جستجوی فاکتورها
                </span>
              </div>
            ) : canCustomers ? (
              <div
                id="card-customers"
                onClick={() => onNavigate('customers')}
                className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-4 flex flex-col justify-center items-center text-center cursor-pointer hover:border-indigo-300 hover:shadow-md transition-all active:scale-98 min-h-[155px]"
              >
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-600 shadow-md shadow-indigo-500/25 flex items-center justify-center text-white mb-2.5">
                  <Users className="w-7 h-7 stroke-[2.2]" />
                </div>
                <span className="text-sm sm:text-base font-extrabold text-slate-800">
                  مشتریان
                </span>
                <span className="text-[10px] text-slate-400 font-medium mt-0.5">
                  ثبت و مدیریت خریداران
                </span>
              </div>
            ) : canInventory ? (
              <div
                id="card-inventory-list"
                onClick={() => onNavigate('inventory')}
                className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-4 flex flex-col justify-center items-center text-center cursor-pointer hover:border-amber-300 hover:shadow-md transition-all active:scale-98 min-h-[155px]"
              >
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 shadow-md shadow-amber-500/25 flex items-center justify-center text-white mb-2.5">
                  <Boxes className="w-7 h-7 stroke-[2.2]" />
                </div>
                <span className="text-sm sm:text-base font-extrabold text-slate-800">
                  موجودی انبار
                </span>
                <span className="text-[10px] text-slate-400 font-medium mt-0.5">
                  کاردکس و گردش اقلام
                </span>
              </div>
            ) : (
              <div
                id="card-inventory-readonly"
                className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-4 flex flex-col justify-center items-center text-center min-h-[155px]"
              >
                <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-500 flex items-center justify-center mb-2.5">
                  <Package className="w-7 h-7 stroke-[2.2]" />
                </div>
                <span className="text-sm sm:text-base font-extrabold text-slate-800">
                  کاتالوگ کالاها
                </span>
                <span className="text-[10px] text-slate-400 font-medium mt-0.5">
                  {toPersianDigits(products.length)} قلم کالای تعریف شده
                </span>
              </div>
            )}
          </div>

          {/* ROW 2: عملیات کالا / عملیات سریع (GOODS & QUICK OPERATIONS) */}
          {(permittedOperations.length > 0 || canInvoicesList) && (
            <div
              id="card-goods-operations"
              className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-4 space-y-3.5"
            >
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center">
                    <Package className="w-4 h-4 stroke-[2.2]" />
                  </div>
                  <span className="text-sm sm:text-base font-extrabold text-slate-800">
                    {canInventory ? 'عملیات کالا و انبار' : 'عملیات سریع فروش'}
                  </span>
                </div>
                <span className="text-[11px] font-medium text-slate-400">
                  {canInventory ? 'انبارداری و گردش اقلام' : 'دسترسی‌های مجاز کاربر'}
                </span>
              </div>

              {/* Circular Action Buttons */}
              {permittedOperations.length > 0 && (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2.5 pt-1">
                  {permittedOperations.map((op) => {
                    const IconComp = op.icon;
                    return (
                      <button
                        key={op.id}
                        type="button"
                        id={`btn-goods-${op.id}`}
                        onClick={op.onClick}
                        className="flex flex-col items-center justify-center group cursor-pointer"
                      >
                        <div className={`w-13 h-13 sm:w-14 sm:h-14 rounded-full border ${op.borderClass} ${op.bgClass} ${op.textClass} flex items-center justify-center shadow-xs ${op.hoverBgClass} ${op.hoverTextClass} ${op.hoverBorderClass} group-active:scale-95 transition-all`}>
                          <IconComp className="w-6 h-6 stroke-[2.4]" />
                        </div>
                        <span className={`text-xs font-extrabold text-slate-700 mt-2 ${op.hoverLabelClass}`}>
                          {op.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Status Stat Boxes (Visible only to users with invoice viewing access) */}
              {canInvoicesList && (
                <div className="grid grid-cols-3 gap-2 pt-1 border-t border-slate-100">
                  {/* Right: پیش نویس */}
                  <div 
                    onClick={() => setActiveStatusFilter('draft')}
                    className="bg-slate-100/80 hover:bg-slate-200/70 rounded-xl py-2 px-1 text-center cursor-pointer transition-colors"
                  >
                    <div className="text-sm font-extrabold text-amber-600">
                      {toPersianDigits(draftInvoices.length)}
                    </div>
                    <div className="text-[11px] font-bold text-slate-500 mt-0.5">
                      پیش نویس
                    </div>
                  </div>

                  {/* Center: تایید شده */}
                  <div 
                    onClick={() => setActiveStatusFilter('confirmed')}
                    className="bg-slate-100/80 hover:bg-slate-200/70 rounded-xl py-2 px-1 text-center cursor-pointer transition-colors"
                  >
                    <div className="text-sm font-extrabold text-teal-600">
                      {toPersianDigits(confirmedInvoices.length)}
                    </div>
                    <div className="text-[11px] font-bold text-slate-500 mt-0.5">
                      تایید شده
                    </div>
                  </div>

                  {/* Left: لغو شده */}
                  <div 
                    onClick={() => setActiveStatusFilter('cancelled')}
                    className="bg-slate-100/80 hover:bg-slate-200/70 rounded-xl py-2 px-1 text-center cursor-pointer transition-colors"
                  >
                    <div className="text-sm font-extrabold text-rose-500">
                      {toPersianDigits(cancelledInvoices.length)}
                    </div>
                    <div className="text-[11px] font-bold text-slate-500 mt-0.5">
                      لغو شده
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ROW 3: فاکتور فروش سریع (Only visible if canCreateInvoice) */}
          {canInvoice && (
            <div
              id="banner-quick-invoice"
              onClick={() => onNewInvoice()}
              className="bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-500 text-white rounded-2xl p-4 shadow-md shadow-emerald-600/15 flex items-center justify-between cursor-pointer hover:shadow-lg hover:brightness-105 active:scale-99 transition-all"
            >
              {/* Right: White Circle with Green Plus */}
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-white text-emerald-600 shadow-md flex items-center justify-center shrink-0">
                  <Plus className="w-7 h-7 stroke-[3]" />
                </div>

                {/* Center: Title & Subtitle */}
                <div className="flex flex-col">
                  <span className="text-sm sm:text-base font-black text-white">
                    فاکتور فروش سریع
                  </span>
                  <span className="text-[11px] font-medium text-white/90 mt-0.5">
                    ثبت فوری اقلام، مشتری و صدور فاکتور
                  </span>
                </div>
              </div>

              {/* Left: Button */}
              <button
                type="button"
                id="quick-invoice-options-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  onNewInvoice();
                }}
                className="w-8 h-8 rounded-full bg-white/15 hover:bg-white/30 text-white flex items-center justify-center transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            </div>
          )}

          {/* ROW 4: ویرایش مشخصات انبار (Only visible if canManageInventory or canAccessAdmin) */}
          {(canInventory || canAdmin) && (
            <div
              id="card-warehouse-settings"
              onClick={() => setIsWarehouseModalOpen(true)}
              className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-4 flex items-start gap-3.5 cursor-pointer hover:border-slate-300 hover:shadow-sm active:scale-99 transition-all"
            >
              {/* Right: Dark Octagon/Shield Container with Warehouse Icon */}
              <div className="w-11 h-11 rounded-2xl bg-slate-900 text-white flex items-center justify-center shrink-0 shadow-sm">
                <Warehouse className="w-5 h-5 stroke-[2.2] text-amber-300" />
              </div>

              {/* Left: Text Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-sm sm:text-base font-extrabold text-slate-900">
                    ویرایش مشخصات انبار
                  </span>
                  <ChevronLeft className="w-4 h-4 text-slate-400" />
                </div>
                <p className="text-xs text-slate-500 font-medium leading-relaxed mt-1">
                  شما می توانید برای هر یک از ۳ انبار خود یک نام تعریف کنید و یکی را پیش فرض نمایید.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* DESKTOP VIEW (≥ 1024px) */}
        <div className="hidden lg:grid lg:grid-cols-12 gap-6 items-start">
          {/* RIGHT COLUMN (8 COLS): CORE WORKSTATION */}
          <div className="lg:col-span-8 space-y-5">
            {/* 1. GOODS & WAREHOUSE OPERATIONS CARD */}
            <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs p-5 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                    <Boxes className="w-4 h-4 stroke-[2.4]" />
                  </div>
                  <h3 className="font-extrabold text-slate-900 text-base">عملیات کالا و گردش انبار</h3>
                </div>
                <span className="text-xs text-slate-400 font-medium">دسته‌بندی‌های اصلی سیستم</span>
              </div>

              {/* Action Buttons Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5 py-2">
                {permittedOperations.map((op) => {
                  const Icon = op.icon;
                  return (
                    <div
                      key={`desk-${op.id}`}
                      id={`desk-btn-op-${op.id}`}
                      onClick={op.onClick}
                      className="group flex flex-col items-center justify-center text-center p-3 rounded-2xl hover:bg-slate-50 transition-all cursor-pointer border border-transparent hover:border-slate-200/80"
                    >
                      <div className={`w-14 h-14 rounded-full border-2 ${op.borderClass} ${op.bgClass} ${op.textClass} ${op.hoverBgClass} ${op.hoverTextClass} ${op.hoverBorderClass} flex items-center justify-center mb-2.5 transition-all group-hover:scale-105 shadow-xs`}>
                        <Icon className="w-6 h-6 stroke-[2.2]" />
                      </div>
                      <span className={`text-xs sm:text-sm font-extrabold text-slate-700 ${op.hoverLabelClass} transition-colors line-clamp-1`}>
                        {op.label}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Status Counters */}
              <div className="grid grid-cols-3 gap-3 pt-3 border-t border-slate-100">
                {/* پیش‌نویس */}
                <div
                  id="desk-filter-draft"
                  onClick={() => canInvoicesList && onNavigate('invoices')}
                  className={`p-3 rounded-2xl border border-slate-200/80 bg-slate-50 flex items-center justify-between transition-all ${
                    canInvoicesList ? 'cursor-pointer hover:border-slate-300 hover:bg-slate-100/70' : ''
                  }`}
                >
                  <div>
                    <span className="text-[11px] font-bold text-slate-500 block">پیش‌نویس‌ها</span>
                    <span className="text-xs text-slate-400 font-medium">سفارشات در انتظار</span>
                  </div>
                  <span className="bg-slate-800 text-white font-black text-sm px-2.5 py-1 rounded-xl">
                    {toPersianDigits(draftInvoices.length)}
                  </span>
                </div>

                {/* تایید شده */}
                <div
                  id="desk-filter-confirmed"
                  onClick={() => canInvoicesList && onNavigate('invoices')}
                  className={`p-3 rounded-2xl border border-emerald-200/80 bg-emerald-50/50 flex items-center justify-between transition-all ${
                    canInvoicesList ? 'cursor-pointer hover:border-emerald-300 hover:bg-emerald-50' : ''
                  }`}
                >
                  <div>
                    <span className="text-[11px] font-bold text-emerald-800 block">تایید شده</span>
                    <span className="text-xs text-emerald-600/80 font-medium">فاکتورهای رسمی</span>
                  </div>
                  <span className="bg-emerald-600 text-white font-black text-sm px-2.5 py-1 rounded-xl">
                    {toPersianDigits(confirmedInvoices.length)}
                  </span>
                </div>

                {/* لغو شده */}
                <div
                  id="desk-filter-cancelled"
                  onClick={() => canInvoicesList && onNavigate('invoices')}
                  className={`p-3 rounded-2xl border border-rose-200/80 bg-rose-50/50 flex items-center justify-between transition-all ${
                    canInvoicesList ? 'cursor-pointer hover:border-rose-300 hover:bg-rose-50' : ''
                  }`}
                >
                  <div>
                    <span className="text-[11px] font-bold text-rose-800 block">لغو شده</span>
                    <span className="text-xs text-rose-600/80 font-medium">فاکتورهای ابطالی</span>
                  </div>
                  <span className="bg-rose-600 text-white font-black text-sm px-2.5 py-1 rounded-xl">
                    {toPersianDigits(cancelledInvoices.length)}
                  </span>
                </div>
              </div>
            </div>

            {/* 3. QUICK INVOICE BANNER */}
            {canInvoice && (
              <div
                id="desk-card-quick-invoice-banner"
                onClick={onNewInvoice}
                className="bg-gradient-to-r from-emerald-600 to-teal-700 rounded-3xl p-5 text-white flex items-center justify-between shadow-md shadow-emerald-600/20 cursor-pointer hover:from-emerald-700 hover:to-teal-800 active:scale-99 transition-all"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-xs flex items-center justify-center shrink-0">
                    <Plus className="w-6 h-6 stroke-[3]" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-black text-lg">صدور فاکتور فروش سریع (POS)</span>
                      <span className="text-[11px] bg-white/20 px-2 py-0.5 rounded-full font-bold">کلید میانبر Alt+N</span>
                    </div>
                    <span className="text-xs text-emerald-100 font-medium mt-0.5 block">
                      صدور فاکتور رسمی / عادی، محاسبه ارزش افزوده، تخفیفات و چاپ حرارتی یا A4
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onNewInvoice}
                    className="px-5 py-2.5 bg-white text-emerald-800 hover:bg-emerald-50 rounded-xl text-xs font-black transition-colors shadow-xs cursor-pointer flex items-center gap-1.5"
                  >
                    <Plus className="w-4 h-4" />
                    <span>شروع صدور فاکتور</span>
                  </button>
                </div>
              </div>
            )}

            {/* 4. WAREHOUSE SETTINGS CARD */}
            {(canInventory || canAdmin) && (
              <div
                id="desk-card-warehouse-settings"
                onClick={() => setIsWarehouseModalOpen(true)}
                className="bg-white rounded-3xl border border-slate-200/90 shadow-xs p-4 sm:p-5 flex items-center justify-between cursor-pointer hover:border-slate-300 hover:shadow-sm transition-all"
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-11 h-11 rounded-2xl bg-slate-900 text-white flex items-center justify-center shrink-0 shadow-sm">
                    <Warehouse className="w-5 h-5 stroke-[2.2] text-amber-300" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm sm:text-base font-extrabold text-slate-900">
                        مشخصات و انبارهای تعریف شده
                      </span>
                      <span className="text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md">
                        انبار پیش‌فرض: {defaultWarehouse?.name || 'انبار مرکزی'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 font-medium mt-0.5">
                      امکان پیکربندی نام ۳ انبار، انتخاب انبار فعال و سوییچ سریع در هنگام ثبت ورودی و خروجی
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsWarehouseModalOpen(true)}
                  className="text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-xl transition-colors cursor-pointer"
                >
                  ویرایش مشخصات
                </button>
              </div>
            )}
          </div>

          {/* LEFT COLUMN (4 COLS): RECENT ACTIVITY & SYSTEM FEED */}
          <div className="lg:col-span-4 space-y-5">
            {/* 1. RECENT INVOICES FEED */}
            <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs p-5 space-y-3.5">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <ReceiptText className="w-4 h-4 text-emerald-600 stroke-[2.4]" />
                  <h4 className="font-extrabold text-slate-900 text-sm">آخرین فاکتورهای صادر شده</h4>
                </div>
                {canInvoicesList && (
                  <button
                    type="button"
                    onClick={() => onNavigate('invoices')}
                    className="text-xs font-bold text-emerald-600 hover:underline cursor-pointer"
                  >
                    مشاهده همه
                  </button>
                )}
              </div>

              {recentInvoices.length === 0 ? (
                <div className="text-center py-6 text-xs text-slate-400">
                  هنوز فاکتوری در سامانه ثبت نشده است.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {recentInvoices.map((inv, idx) => {
                    const isPaid = inv.paymentStatus === 'paid';
                    const isPartial = inv.paymentStatus === 'partial';
                    return (
                      <div
                        key={inv.id}
                        className={`p-2.5 rounded-2xl border border-slate-200/80 ${
                          idx % 2 === 1 ? 'bg-slate-100/75' : 'bg-white'
                        } hover:border-slate-300 transition-all flex items-center justify-between text-xs`}
                      >
                        <div className="space-y-0.5 min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="font-extrabold text-slate-900 truncate">
                              {inv.customerName || 'مشتری آزاد / متفرقه'}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              #{inv.invoiceNumber}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-[11px] text-slate-500">
                            <span>{toPersianDigits(inv.date)}</span>
                            <span className="font-black text-slate-800">
                              {formatPrice(inv.finalTotal || 0)}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <span
                            className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${
                              isPaid
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : isPartial
                                ? 'bg-amber-50 text-amber-700 border-amber-200'
                                : 'bg-rose-50 text-rose-700 border-rose-200'
                            }`}
                          >
                            {isPaid ? 'تسویه' : isPartial ? 'قسطی' : 'نسیه'}
                          </span>
                          <button
                            type="button"
                            onClick={() => onViewInvoice(inv)}
                            title="مشاهده فاکتور"
                            className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 2. LOW STOCK ALERT PANEL */}
            <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs p-5 space-y-3.5">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500 stroke-[2.4]" />
                  <h4 className="font-extrabold text-slate-900 text-sm">هشدارهای کسری انبار</h4>
                </div>
                {canInventory && (
                  <button
                    type="button"
                    onClick={() => onNavigate('inventory')}
                    className="text-xs font-bold text-amber-600 hover:underline cursor-pointer"
                  >
                    مدیریت موجودی
                  </button>
                )}
              </div>

              {lowStockProducts.length === 0 ? (
                <div className="flex items-center gap-2.5 p-3 rounded-2xl bg-emerald-50/60 border border-emerald-100 text-emerald-800 text-xs font-bold">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  <span>کلیه کالاهای انبار دارای موجودی کافی و بالاتر از حداقل هشدار هستند.</span>
                </div>
              ) : (
                <div className="space-y-2">
                  {lowStockProducts.slice(0, 4).map((p, idx) => (
                    <div
                      key={p.id}
                      className={`p-2.5 rounded-2xl border flex items-center justify-between text-xs ${
                        idx % 2 === 1
                          ? 'bg-rose-100/60 border-rose-200'
                          : 'bg-rose-50/50 border-rose-100'
                      }`}
                    >
                      <div className="space-y-0.5 min-w-0">
                        <span className="font-extrabold text-rose-900 block truncate">{p.name}</span>
                        <span className="text-[10px] text-rose-600 block">
                          موجودی: {toPersianDigits(p.stock)} {p.unit} (حداقل: {toPersianDigits(p.minStockAlert)})
                        </span>
                      </div>
                      {canInventory && (
                        <button
                          type="button"
                          onClick={() => onNavigate('inventory')}
                          className="px-2.5 py-1 bg-white hover:bg-rose-100 text-rose-700 font-bold text-[11px] rounded-lg border border-rose-200 shadow-xs transition-colors cursor-pointer shrink-0"
                        >
                          تامین
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 3. QUICK SYSTEM SHORTCUTS */}
            <div className="bg-slate-900 text-white rounded-3xl p-5 space-y-3.5 shadow-md">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-slate-300">امکانات و ابزارهای سریع</span>
                <span className="text-[10px] text-amber-400 font-bold bg-amber-400/15 px-2 py-0.5 rounded-full">
                  {currentUser?.roleTitle || roleConfig?.label || 'دسترسی مجاز'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                {canInvoice && (
                  <button
                    type="button"
                    onClick={onNewInvoice}
                    className="p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-right font-bold text-slate-200 hover:text-white transition-colors flex items-center gap-2 cursor-pointer"
                  >
                    <PlusCircle className="w-4 h-4 text-emerald-400" />
                    <span>فاکتور جدید</span>
                  </button>
                )}
                {canInvoicesList && (
                  <button
                    type="button"
                    onClick={() => onNavigate('invoices')}
                    className="p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-right font-bold text-slate-200 hover:text-white transition-colors flex items-center gap-2 cursor-pointer"
                  >
                    <ReceiptText className="w-4 h-4 text-sky-400" />
                    <span>لیست سفارشات</span>
                  </button>
                )}
                {canInventory && (
                  <button
                    type="button"
                    onClick={() => onNavigate('inventory')}
                    className="p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-right font-bold text-slate-200 hover:text-white transition-colors flex items-center gap-2 cursor-pointer"
                  >
                    <Boxes className="w-4 h-4 text-amber-400" />
                    <span>انبار و کالاها</span>
                  </button>
                )}
                {canPurchases && (
                  <button
                    type="button"
                    onClick={() => onNavigate('purchases')}
                    className="p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-right font-bold text-slate-200 hover:text-white transition-colors flex items-center gap-2 cursor-pointer"
                  >
                    <ShoppingCart className="w-4 h-4 text-orange-400" />
                    <span>فاکتور خرید</span>
                  </button>
                )}
                {canCustomers && (
                  <button
                    type="button"
                    onClick={() => onNavigate('customers')}
                    className="p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-right font-bold text-slate-200 hover:text-white transition-colors flex items-center gap-2 cursor-pointer"
                  >
                    <Users className="w-4 h-4 text-purple-400" />
                    <span>مشتریان</span>
                  </button>
                )}

                {/* More Features Button */}
                <button
                  type="button"
                  id="btn-desktop-more-features"
                  onClick={() => setIsMoreFeaturesModalOpen(true)}
                  className="p-2.5 rounded-xl bg-purple-950/50 hover:bg-purple-900/60 border border-purple-800/50 text-right font-bold text-purple-200 hover:text-white transition-colors flex items-center gap-2 cursor-pointer"
                >
                  <MoreHorizontal className="w-4 h-4 text-purple-400" />
                  <span>بیشتر امکانات...</span>
                </button>

                {/* Update App & Clear Browser Cache */}
                <button
                  type="button"
                  id="btn-desktop-clear-cache"
                  onClick={() => setIsUpdateModalOpen(true)}
                  className="col-span-2 p-2.5 rounded-xl bg-sky-950/60 hover:bg-sky-900/70 border border-sky-800/50 text-right font-bold text-sky-200 hover:text-white transition-colors flex items-center justify-between cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <RefreshCw className={`w-4 h-4 text-sky-400 ${isUpdatingApp ? 'animate-spin' : ''}`} />
                    <span>بروزرسانی برنامه و پاکسازی کش</span>
                  </div>
                  <span className="text-[10px] text-sky-300 font-normal bg-sky-900/80 px-2 py-0.5 rounded-md">
                    نسخه جدید
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </>
    ) : (
      /* CHARTS & ANALYTICS SUB-TAB (RESPONSIVE GRID) */
        <div className="space-y-5">
          {/* Revenue & Sales Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
              <span className="text-xs text-slate-400 font-bold block">فروش کل سامانه</span>
              <span className="text-base sm:text-lg font-black text-slate-900 mt-1 block">
                {formatPrice(totalRevenue)}
              </span>
              <span className="text-[10px] text-emerald-600 font-semibold mt-0.5 block">
                {toPersianDigits(confirmedInvoices.length)} فاکتور تایید شده
              </span>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
              <span className="text-xs text-slate-400 font-bold block">فروش امروز</span>
              <span className="text-base sm:text-lg font-black text-teal-600 mt-1 block">
                {formatPrice(todayRevenue)}
              </span>
              <span className="text-[10px] text-slate-400 font-semibold mt-0.5 block">
                تاریخ: {toPersianDigits(currentDate)}
              </span>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
              <span className="text-xs text-slate-400 font-bold block">میانگین هر فاکتور</span>
              <span className="text-base sm:text-lg font-black text-blue-600 mt-1 block">
                {formatPrice(confirmedInvoices.length ? Math.round(totalRevenue / confirmedInvoices.length) : 0)}
              </span>
              <span className="text-[10px] text-slate-400 font-semibold mt-0.5 block">
                بر اساس فاکتورهای رسمی
              </span>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
              <span className="text-xs text-slate-400 font-bold block">مشتریان فعال</span>
              <span className="text-base sm:text-lg font-black text-purple-600 mt-1 block">
                {toPersianDigits(customers.length)} مخاطب
              </span>
              <span className="text-[10px] text-slate-400 font-semibold mt-0.5 block">
                طرف‌حساب‌های فروشگاه
              </span>
            </div>
          </div>

          {/* Top Selling Products / Inventory Status in 2 Columns on Desktop */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
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
                      key={p.id}
                      className={`flex items-center justify-between text-xs py-2 px-2.5 rounded-xl transition-colors ${
                        idx % 2 === 1 ? 'bg-slate-100/70' : 'bg-white'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${isLow ? 'bg-rose-500' : 'bg-emerald-500'}`} />
                        <span className="font-bold text-slate-800 truncate max-w-[200px] sm:max-w-xs">{p.name}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-slate-500">{formatPrice(p.sellPrice)}</span>
                        <span className={`px-2.5 py-0.5 rounded-lg font-bold text-[11px] ${
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
                      <span>{toPersianDigits(invoices.filter(i => i.paymentStatus === 'paid').length)} فاکتور</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                      <div
                        className="bg-emerald-500 h-full rounded-full"
                        style={{ width: `${invoices.length ? (invoices.filter(i => i.paymentStatus === 'paid').length / invoices.length) * 100 : 0}%` }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs font-bold mb-1">
                      <span className="text-amber-700">پرداخت قسطی / بیعانه</span>
                      <span>{toPersianDigits(invoices.filter(i => i.paymentStatus === 'partial').length)} فاکتور</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                      <div
                        className="bg-amber-500 h-full rounded-full"
                        style={{ width: `${invoices.length ? (invoices.filter(i => i.paymentStatus === 'partial').length / invoices.length) * 100 : 0}%` }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs font-bold mb-1">
                      <span className="text-rose-700">نسیه / پرداخت‌نشده</span>
                      <span>{toPersianDigits(invoices.filter(i => i.paymentStatus === 'unpaid').length)} فاکتور</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                      <div
                        className="bg-rose-500 h-full rounded-full"
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
                        موجودی سیستمی: <strong className="text-slate-800">{toPersianDigits(p.stock)} {p.unit}</strong>
                      </div>

                      <div className="flex items-center gap-2">
                        <label className="text-slate-600 font-bold text-[11px]">شمارش جدید:</label>
                        <input
                          type="number"
                          value={currentPhysical}
                          onChange={(e) => {
                            const val = parseInt(e.target.value, 10);
                            setAuditQuantities((prev) => ({
                              ...prev,
                              [p.id]: isNaN(val) ? 0 : val,
                            }));
                          }}
                          className="w-18 bg-white border border-slate-300 rounded-lg px-2 py-1 text-center font-bold text-xs focus:ring-1 focus:ring-emerald-500"
                        />
                        {diff !== 0 && (
                          <button
                            type="button"
                            onClick={() => handleApplyAudit(p.id)}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] px-2.5 py-1 rounded-lg transition-colors"
                          >
                            ثبت
                          </button>
                        )}
                      </div>
                    </div>

                    {diff !== 0 && (
                      <div className="text-[11px] flex items-center gap-1 font-bold">
                        <span className={diff > 0 ? 'text-teal-600' : 'text-rose-600'}>
                          اختلاف: {diff > 0 ? `+${toPersianDigits(diff)}` : toPersianDigits(diff)} {p.unit} ({diff > 0 ? 'مازاد' : 'کسری'})
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
    </div>
  );
};
