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
import { getRoleBadgeConfig } from '../utils/permissions';
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
  CreditCard
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
  const [isBarcodeModalOpen, setIsBarcodeModalOpen] = useState(false);
  const [isQuickInvoiceModalOpen, setIsQuickInvoiceModalOpen] = useState(false);
  const [isWarehouseModalOpen, setIsWarehouseModalOpen] = useState(false);
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);
  const [activeStatusFilter, setActiveStatusFilter] = useState<'draft' | 'confirmed' | 'cancelled' | null>(null);

  // Barcode Scanner Modal State
  const [barcodeQuery, setBarcodeQuery] = useState('');
  const [scannedProduct, setScannedProduct] = useState<Product | null>(null);
  const [cameraActive, setCameraActive] = useState(false);

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

    return list;
  }, [canInventory, canInvoice, canCustomers, canInvoicesList, onNavigate, onNewInvoice]);

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

  // Handle Barcode Scan search
  const handleBarcodeSearch = (query: string) => {
    setBarcodeQuery(query);
    if (!query.trim()) {
      setScannedProduct(null);
      return;
    }
    const q = query.trim().toLowerCase();
    const found = products.find(
      (p) =>
        p.code.toLowerCase() === q ||
        p.name.toLowerCase().includes(q) ||
        (p.description && p.description.toLowerCase().includes(q))
    );
    setScannedProduct(found || null);
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
            {/* Left Card: بارکد اسکنر کالا */}
            <div
              id="card-barcode-scanner"
              onClick={() => setIsBarcodeModalOpen(true)}
              className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-4 flex flex-col justify-between items-center text-center cursor-pointer hover:border-sky-300 hover:shadow-md transition-all active:scale-98 min-h-[155px]"
            >
              {/* Header: بارکد اسکنر کالا + Search Icon */}
              <div className="w-full flex items-center justify-between gap-1">
                <span className="text-xs sm:text-sm font-extrabold text-slate-800 tracking-tight">
                  بارکد اسکنر کالا
                </span>
                <div className="w-6 h-6 rounded-full bg-sky-50 text-sky-500 flex items-center justify-center shrink-0">
                  <Search className="w-3.5 h-3.5 stroke-[2.5]" />
                </div>
              </div>

              {/* Barcode graphic with brackets */}
              <div className="my-2 relative flex items-center justify-center py-2 px-3">
                {/* Scanner Bracket Corners */}
                <div className="relative border-2 border-dashed border-slate-300 rounded-lg p-2.5 bg-slate-50/70 group-hover:border-sky-400">
                  {/* Top-Left Corner Bracket */}
                  <span className="absolute -top-1 -left-1 w-2.5 h-2.5 border-t-2 border-l-2 border-slate-800" />
                  {/* Top-Right Corner Bracket */}
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 border-t-2 border-r-2 border-slate-800" />
                  {/* Bottom-Left Corner Bracket */}
                  <span className="absolute -bottom-1 -left-1 w-2.5 h-2.5 border-b-2 border-l-2 border-slate-800" />
                  {/* Bottom-Right Corner Bracket */}
                  <span className="absolute -bottom-1 -right-1 w-2.5 h-2.5 border-b-2 border-r-2 border-slate-800" />

                  {/* Vertical Barcode Lines */}
                  <div className="flex items-center gap-[2.5px] h-7 px-1">
                    <span className="w-[3px] h-full bg-slate-800 rounded-xs" />
                    <span className="w-[1.5px] h-full bg-slate-800 rounded-xs" />
                    <span className="w-[4px] h-full bg-slate-800 rounded-xs" />
                    <span className="w-[1.5px] h-full bg-slate-800 rounded-xs" />
                    <span className="w-[2px] h-full bg-slate-800 rounded-xs" />
                    <span className="w-[3.5px] h-full bg-slate-800 rounded-xs" />
                    <span className="w-[1.5px] h-full bg-slate-800 rounded-xs" />
                    <span className="w-[3px] h-full bg-slate-800 rounded-xs" />
                    <span className="w-[2px] h-full bg-slate-800 rounded-xs" />
                  </div>
                </div>
              </div>

              <span className="text-[11px] font-semibold text-sky-600 hover:underline">
                لمس برای اسکن و جستجو
              </span>
            </div>

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
                <div className={`grid grid-cols-${Math.min(permittedOperations.length, 3)} gap-2 pt-1`}>
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
              onClick={() => setIsQuickInvoiceModalOpen(true)}
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
                    روش: پاپ آپ انتخاب روش ظاهر شود
                  </span>
                </div>
              </div>

              {/* Left: Three Dots Button */}
              <button
                type="button"
                id="quick-invoice-options-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsQuickInvoiceModalOpen(true);
                }}
                className="w-8 h-8 rounded-full bg-white/15 hover:bg-white/30 text-white flex items-center justify-center transition-colors"
              >
                <MoreHorizontal className="w-5 h-5" />
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
            {/* 1. INTERACTIVE BARCODE & DIRECT PRODUCT SEARCH CONSOLE */}
            <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center">
                    <Search className="w-5 h-5 stroke-[2.2]" />
                  </div>
                  <div>
                    <h3 className="font-black text-slate-900 text-base">بارکد اسکنر و جستجوی آنی کالا</h3>
                    <p className="text-xs text-slate-400 font-medium">اسکن بارکد کالا یا جستجوی مستقیم بر اساس نام و کد جهت تسریع فرآیند فروش</p>
                  </div>
                </div>

                <button
                  type="button"
                  id="desktop-open-camera-scanner-btn"
                  onClick={() => {
                    setIsBarcodeModalOpen(true);
                    setCameraActive(true);
                  }}
                  className="flex items-center gap-1.5 bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 px-3.5 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  <Camera className="w-4 h-4 text-sky-600" />
                  <span>اسکن با دوربین / وبکم</span>
                </button>
              </div>

              {/* Direct Search Input */}
              <div className="relative">
                <input
                  type="text"
                  value={barcodeQuery}
                  onChange={(e) => handleBarcodeSearch(e.target.value)}
                  placeholder="بارکد را با بارکدخوان اسکن کنید یا کد/نام کالا را تایپ نمایید..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl pr-4 pl-10 py-3 text-sm font-medium focus:bg-white focus:ring-2 focus:ring-sky-500 focus:outline-none transition-all placeholder:text-slate-400"
                />
                {barcodeQuery ? (
                  <button
                    type="button"
                    onClick={() => {
                      setBarcodeQuery('');
                      setScannedProduct(null);
                    }}
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-slate-200 hover:bg-slate-300 text-slate-600 flex items-center justify-center text-xs"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                    <Search className="w-4 h-4" />
                  </div>
                )}
              </div>

              {/* Quick Sample Test Chips */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-slate-400 font-bold">کالاهای پرفروش انبار:</span>
                {products.slice(0, 5).map((p) => (
                  <button
                    key={`desk-chip-${p.id}`}
                    type="button"
                    onClick={() => handleBarcodeSearch(p.code)}
                    className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold px-2.5 py-1 rounded-xl transition-colors cursor-pointer"
                  >
                    {p.name.slice(0, 18)} (کد {p.code})
                  </button>
                ))}
              </div>

              {/* Live Found Product Detail Box */}
              {scannedProduct ? (
                <div className="bg-sky-50/80 border border-sky-200 rounded-2xl p-4 space-y-3 animate-in fade-in duration-150">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="bg-sky-600 text-white text-xs font-black px-2.5 py-0.5 rounded-full">
                        کد کالا: {toPersianDigits(scannedProduct.code)}
                      </span>
                      {scannedProduct.barcode && (
                        <span className="text-xs text-slate-500 font-mono bg-white px-2 py-0.5 rounded-md border border-slate-200">
                          بارکد: {scannedProduct.barcode}
                        </span>
                      )}
                    </div>
                    <span className="text-xs font-bold text-sky-900">اطلاعات لحظه‌ای کالا</span>
                  </div>

                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <h4 className="text-base font-black text-slate-900">{scannedProduct.name}</h4>
                    <div className="flex items-center gap-4">
                      <div className="text-left">
                        <span className="text-xs text-slate-500 block">موجودی انبار:</span>
                        <span className="text-sm font-black text-slate-900">
                          {toPersianDigits(scannedProduct.stock)} {scannedProduct.unit}
                        </span>
                      </div>
                      <div className="text-left">
                        <span className="text-xs text-slate-500 block">قیمت فروش:</span>
                        <span className="text-base font-black text-emerald-700">
                          {formatPrice(scannedProduct.sellPrice)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-1 flex items-center gap-2.5 border-t border-sky-100">
                    {canInvoice && (
                      <button
                        type="button"
                        onClick={onNewInvoice}
                        className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-2.5 rounded-xl text-center transition-colors shadow-xs cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <ShoppingCart className="w-4 h-4" />
                        <span>صدور فاکتور با این کالا</span>
                      </button>
                    )}
                    {canInventory && (
                      <button
                        type="button"
                        onClick={() => onNavigate('inventory')}
                        className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold px-4 py-2.5 rounded-xl transition-colors cursor-pointer"
                      >
                        مشاهده کاردکس کالا
                      </button>
                    )}
                  </div>
                </div>
              ) : barcodeQuery.trim() ? (
                <div className="text-center py-4 bg-slate-50 rounded-2xl border border-slate-200/80 text-xs text-slate-400">
                  کالایی با بارکد یا کد «{barcodeQuery}» در انبار یافت نشد.
                </div>
              ) : null}
            </div>

            {/* 2. GOODS & WAREHOUSE OPERATIONS CARD */}
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
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-2">
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
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsQuickInvoiceModalOpen(true);
                    }}
                    className="px-3.5 py-2 bg-white/15 hover:bg-white/25 rounded-xl text-xs font-bold text-white transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <MoreHorizontal className="w-4 h-4" />
                    <span>انتخاب روش</span>
                  </button>
                  <button
                    type="button"
                    onClick={onNewInvoice}
                    className="px-4 py-2 bg-white text-emerald-800 hover:bg-emerald-50 rounded-xl text-xs font-black transition-colors shadow-xs cursor-pointer"
                  >
                    شروع صدور
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
                  میز کار حسابدار
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

      {/* 1. BARCODE SCANNER & PRODUCT SEARCH MODAL */}
      {isBarcodeModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-3">
          <div className="bg-white rounded-3xl w-full max-w-md p-5 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-sky-100 text-sky-600 flex items-center justify-center">
                  <Search className="w-4 h-4 stroke-[2.2]" />
                </div>
                <span className="font-extrabold text-slate-900 text-base">بارکد اسکنر کالا</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsBarcodeModalOpen(false);
                  setCameraActive(false);
                  setScannedProduct(null);
                }}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Simulated / Live Camera Box */}
            <div className="relative rounded-2xl bg-slate-900 text-white h-44 flex flex-col items-center justify-center overflow-hidden border border-slate-700">
              {cameraActive ? (
                <div className="relative w-full h-full flex flex-col items-center justify-center bg-slate-950">
                  <div className="absolute inset-x-8 top-1/2 h-0.5 bg-rose-500 shadow-lg shadow-rose-500 animate-pulse" />
                  <span className="text-xs text-slate-400 font-medium">دوربین فعال شد - بارکد را مقابل لنز بگیرید</span>
                </div>
              ) : (
                <div className="text-center space-y-2 p-4">
                  <Camera className="w-10 h-10 text-slate-400 mx-auto stroke-[1.5]" />
                  <p className="text-xs text-slate-300">
                    برای اسکن زنده با دوربین روی دکمه زیر کلیک کنید یا بارکد/کد کالا را تایپ نمایید.
                  </p>
                  <button
                    type="button"
                    onClick={() => setCameraActive(true)}
                    className="bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold px-3 py-1.5 rounded-xl shadow-xs transition-colors"
                  >
                    فعال‌سازی دوربین
                  </button>
                </div>
              )}
            </div>

            {/* Quick Search Input */}
            <div className="relative">
              <input
                type="text"
                value={barcodeQuery}
                onChange={(e) => handleBarcodeSearch(e.target.value)}
                placeholder="اسکن بارکد یا جستجوی کد کالا (مثلاً 1001)..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-medium focus:bg-white focus:ring-2 focus:ring-sky-500 focus:outline-none"
              />
            </div>

            {/* Quick Suggestions for Demo / Fast Click */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              <span className="text-[11px] text-slate-400 font-bold self-center">تست سریع:</span>
              {products.slice(0, 3).map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleBarcodeSearch(p.code)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold px-2 py-1 rounded-lg transition-colors"
                >
                  {p.code} - {p.name.slice(0, 15)}...
                </button>
              ))}
            </div>

            {/* Scanned Product Details Card */}
            {scannedProduct ? (
              <div className="bg-sky-50 border border-sky-200 rounded-2xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-sky-900">کالای یافته شده:</span>
                  <span className="bg-sky-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full">
                    کد: {toPersianDigits(scannedProduct.code)}
                  </span>
                </div>
                <h4 className="text-sm font-extrabold text-slate-900">{scannedProduct.name}</h4>
                <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                  <div>
                    <span className="text-slate-500 block">موجودی انبار:</span>
                    <span className="font-extrabold text-slate-800">
                      {toPersianDigits(scannedProduct.stock)} {scannedProduct.unit}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">قیمت فروش:</span>
                    <span className="font-extrabold text-emerald-700">
                      {formatPrice(scannedProduct.sellPrice)}
                    </span>
                  </div>
                </div>

                {(canInvoice || canInventory) && (
                  <div className="pt-2 flex gap-2">
                    {canInvoice && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsBarcodeModalOpen(false);
                          onNewInvoice();
                        }}
                        className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-2 rounded-xl text-center transition-colors"
                      >
                        افزودن به فاکتور فروش
                      </button>
                    )}
                    {canInventory && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsBarcodeModalOpen(false);
                          onNavigate('inventory');
                        }}
                        className="bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold px-3 py-2 rounded-xl transition-colors"
                      >
                        کاردکس
                      </button>
                    )}
                  </div>
                )}
              </div>
            ) : barcodeQuery.trim() ? (
              <p className="text-center text-xs text-slate-400 py-2">کالایی با این بارکد یا کد یافت نشد.</p>
            ) : null}
          </div>
        </div>
      )}

      {/* 2. QUICK INVOICE METHOD POPUP MODAL ("روش: پاپ آپ انتخاب روش ظاهر شود") */}
      {isQuickInvoiceModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-3">
          <div className="bg-white rounded-3xl w-full max-w-md p-5 shadow-2xl space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center">
                  <Plus className="w-5 h-5 stroke-[2.5]" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-base">انتخاب روش صدور فاکتور سریع</h3>
                  <span className="text-[11px] text-slate-400 font-medium">روش مورد نظر خود را انتخاب کنید</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsQuickInvoiceModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Method Options */}
            <div className="space-y-2.5">
              {/* Option 1: صدور با بارکدخوان */}
              <div
                onClick={() => {
                  setIsQuickInvoiceModalOpen(false);
                  setIsBarcodeModalOpen(true);
                }}
                className="p-3.5 rounded-2xl border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/50 transition-all cursor-pointer flex items-center gap-3.5 group"
              >
                <div className="w-11 h-11 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <Search className="w-5 h-5 stroke-[2.2]" />
                </div>
                <div className="flex-1">
                  <span className="text-sm font-extrabold text-slate-800 group-hover:text-emerald-800 block">
                    ۱. صدور با بارکدخوان سریع
                  </span>
                  <span className="text-xs text-slate-500 mt-0.5 block leading-relaxed">
                    اسکن با دوربین یا بارکدخوان فیزیکی و درج آنی در ردیف‌های فاکتور
                  </span>
                </div>
                <ChevronLeft className="w-4 h-4 text-slate-400 group-hover:text-emerald-600" />
              </div>

              {/* Option 2: فاکتور استاندارد کامل */}
              <div
                onClick={() => {
                  setIsQuickInvoiceModalOpen(false);
                  onNewInvoice();
                }}
                className="p-3.5 rounded-2xl border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/50 transition-all cursor-pointer flex items-center gap-3.5 group"
              >
                <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <FileText className="w-5 h-5 stroke-[2.2]" />
                </div>
                <div className="flex-1">
                  <span className="text-sm font-extrabold text-slate-800 group-hover:text-emerald-800 block">
                    ۲. فاکتور استاندارد کامل (رسمی / عادی)
                  </span>
                  <span className="text-xs text-slate-500 mt-0.5 block leading-relaxed">
                    فرم جامع صدور فاکتور با انتخاب مشتری، تخفیفات، ارزش افزوده و چاپ فوری
                  </span>
                </div>
                <ChevronLeft className="w-4 h-4 text-slate-400 group-hover:text-emerald-600" />
              </div>

              {/* Option 3: فروش لمسی POS */}
              <div
                onClick={() => {
                  setIsQuickInvoiceModalOpen(false);
                  onNewInvoice();
                }}
                className="p-3.5 rounded-2xl border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/50 transition-all cursor-pointer flex items-center gap-3.5 group"
              >
                <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <ShoppingCart className="w-5 h-5 stroke-[2.2]" />
                </div>
                <div className="flex-1">
                  <span className="text-sm font-extrabold text-slate-800 group-hover:text-emerald-800 block">
                    ۳. انتخاب لمسی از لیست کالاها (POS)
                  </span>
                  <span className="text-xs text-slate-500 mt-0.5 block leading-relaxed">
                    لمس کالاهای پرفروش و ثبت تسویه حساب نقدی یا کارتخوان
                  </span>
                </div>
                <ChevronLeft className="w-4 h-4 text-slate-400 group-hover:text-emerald-600" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. WAREHOUSE SETTINGS MODAL ("ویرایش مشخصات انبار") */}
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
    </div>
  );
};
