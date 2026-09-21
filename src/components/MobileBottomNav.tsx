import React, { useState } from 'react';
import { StoreSettings, AppUser } from '../types';
import { StorageService } from '../utils/storage';
import { toPersianDigits } from '../utils/jalali';
import { isTabPermitted } from '../utils/permissions';
import { clearAppCacheAndReload } from '../utils/appUpdater';
import { 
  LayoutGrid,
  Package,
  ReceiptText, 
  MoreHorizontal,
  Boxes, 
  Users, 
  BarChart3, 
  PlusCircle, 
  ShieldCheck,
  ShoppingCart,
  Settings,
  LogOut,
  X,
  RefreshCw,
  ArrowLeftRight
} from 'lucide-react';

interface MobileBottomNavProps {
  settings?: StoreSettings;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  lowStockCount: number;
  currentUser?: AppUser;
  onNewInvoice?: () => void;
  onLogout?: () => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  settings,
  activeTab,
  setActiveTab,
  lowStockCount,
  currentUser,
  onNewInvoice,
  onLogout,
}) => {
  const safeSettings = settings || StorageService.getSettings();
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [isUpdatingCache, setIsUpdatingCache] = useState(false);
  const [updateMsg, setUpdateMsg] = useState('');

  // Permission checks
  const canInvoice = isTabPermitted('new-invoice', currentUser, safeSettings);
  const canInvoicesList = isTabPermitted('invoices', currentUser, safeSettings);
  const canInventory = isTabPermitted('inventory', currentUser, safeSettings);
  const canPurchases = isTabPermitted('purchases', currentUser, safeSettings);
  const canCustomers = isTabPermitted('customers', currentUser, safeSettings);
  const canReports = isTabPermitted('reports', currentUser, safeSettings);
  const canAdmin = isTabPermitted('admin', currentUser, safeSettings);

  const handleUpdateApp = async () => {
    setIsUpdatingCache(true);
    setUpdateMsg('در حال پاکسازی کش مرورگر و دریافت نسخه جدید...');
    await clearAppCacheAndReload((p) => {
      setUpdateMsg(p.message);
    });
  };

  // Products count for the red badge on dashboard
  const productCount = StorageService.getProducts().length || 0;

  // The bottom nav items:
  // داشبورد | کالا (در صورت دسترسی) یا سفارشات | بیشتر
  const mainBarItems = [
    {
      id: 'dashboard',
      label: 'داشبورد',
      icon: LayoutGrid,
      badge: productCount > 0 ? toPersianDigits(productCount) : undefined,
      onClick: () => {
        setShowMoreMenu(false);
        setActiveTab('dashboard');
      },
    },
    ...(canInventory
      ? [
          {
            id: 'inventory',
            label: 'کالا',
            icon: Package,
            badge: lowStockCount > 0 ? toPersianDigits(lowStockCount) : undefined,
            onClick: () => {
              setShowMoreMenu(false);
              setActiveTab('inventory');
            },
          },
        ]
      : []),
    ...(canInvoicesList
      ? [
          {
            id: 'invoices',
            label: 'سفارشات',
            icon: ReceiptText,
            onClick: () => {
              setShowMoreMenu(false);
              setActiveTab('invoices');
            },
          },
        ]
      : []),
    {
      id: 'more',
      label: 'بیشتر',
      icon: MoreHorizontal,
      onClick: () => {
        setShowMoreMenu((prev) => !prev);
      },
    },
  ];

  return (
    <>
      {/* More Options Bottom Drawer */}
      {showMoreMenu && (
        <div className="sm:hidden fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex flex-col justify-end transition-opacity" onClick={() => setShowMoreMenu(false)}>
          <div 
            className="bg-white rounded-t-3xl p-5 shadow-2xl border-t border-slate-200 animate-in slide-in-from-bottom duration-200 max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-800 text-sm">امکانات و ابزارهای سریع</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                  {currentUser?.roleTitle || 'دسترسی مجاز'}
                </span>
              </div>
              <button 
                type="button" 
                onClick={() => setShowMoreMenu(false)}
                className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:text-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Update App & Clear Browser Cache Banner */}
            <div className="mb-3.5 p-3 rounded-2xl bg-gradient-to-l from-sky-50 to-blue-50 border border-sky-200/80 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-sky-600 text-white flex items-center justify-center shadow-xs shrink-0">
                  <RefreshCw className={`w-4 h-4 ${isUpdatingCache ? 'animate-spin' : ''}`} />
                </div>
                <div>
                  <span className="text-xs font-bold text-sky-950 block">بروزرسانی برنامه و پاکسازی کش</span>
                  <span className="text-[10px] text-sky-700 font-medium block">
                    {updateMsg || 'دریافت فوری آخرین نسخه بدون حذف داده‌ها'}
                  </span>
                </div>
              </div>
              <button
                type="button"
                disabled={isUpdatingCache}
                onClick={handleUpdateApp}
                className="px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 active:scale-95 text-white font-bold text-[11px] shadow-xs cursor-pointer transition-all shrink-0"
              >
                {isUpdatingCache ? 'در حال بروزرسانی...' : 'آپدیت'}
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2.5">
              {/* صدور فاکتور جدید */}
              {canInvoice && (
                <button
                  type="button"
                  id="drawer-btn-new-invoice"
                  onClick={() => {
                    setShowMoreMenu(false);
                    if (onNewInvoice) onNewInvoice();
                    else setActiveTab('new-invoice');
                  }}
                  className="flex flex-col items-center justify-center p-3 rounded-2xl bg-emerald-50 border border-emerald-100 text-emerald-800 hover:bg-emerald-100 transition-colors cursor-pointer"
                >
                  <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-sm mb-1.5">
                    <PlusCircle className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-bold">فاکتور جدید</span>
                </button>
              )}

              {/* سفارشات و فاکتورها */}
              {canInvoicesList && (
                <button
                  type="button"
                  id="drawer-btn-invoices"
                  onClick={() => {
                    setShowMoreMenu(false);
                    setActiveTab('invoices');
                  }}
                  className="flex flex-col items-center justify-center p-3 rounded-2xl bg-teal-50 border border-teal-100 text-teal-800 hover:bg-teal-100 transition-colors cursor-pointer"
                >
                  <div className="w-10 h-10 rounded-xl bg-teal-600 text-white flex items-center justify-center shadow-sm mb-1.5">
                    <ReceiptText className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-bold">لیست فاکتورها</span>
                </button>
              )}

              {/* انبار و کالاها */}
              {canInventory && (
                <button
                  type="button"
                  id="drawer-btn-inventory"
                  onClick={() => {
                    setShowMoreMenu(false);
                    setActiveTab('inventory');
                  }}
                  className="flex flex-col items-center justify-center p-3 rounded-2xl bg-amber-50 border border-amber-100 text-amber-800 hover:bg-amber-100 transition-colors cursor-pointer"
                >
                  <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-sm mb-1.5">
                    <Boxes className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-bold">انبار و کالاها</span>
                </button>
              )}

              {/* خریدهای انبار */}
              {canPurchases && (
                <button
                  type="button"
                  id="drawer-btn-purchases"
                  onClick={() => {
                    setShowMoreMenu(false);
                    setActiveTab('purchases');
                  }}
                  className="flex flex-col items-center justify-center p-3 rounded-2xl bg-orange-50 border border-orange-100 text-orange-800 hover:bg-orange-100 transition-colors cursor-pointer"
                >
                  <div className="w-10 h-10 rounded-xl bg-orange-500 text-white flex items-center justify-center shadow-sm mb-1.5">
                    <ShoppingCart className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-bold">فاکتور خرید</span>
                </button>
              )}

              {/* انتقال مستقیم / امانی انبار */}
              {canInventory && (
                <button
                  type="button"
                  id="drawer-btn-transfers"
                  onClick={() => {
                    setShowMoreMenu(false);
                    setActiveTab('direct-transfers');
                  }}
                  className="flex flex-col items-center justify-center p-3 rounded-2xl bg-cyan-50 border border-cyan-100 text-cyan-800 hover:bg-cyan-100 transition-colors cursor-pointer"
                >
                  <div className="w-10 h-10 rounded-xl bg-cyan-600 text-white flex items-center justify-center shadow-sm mb-1.5">
                    <ArrowLeftRight className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-bold">انتقال بدون فاکتور</span>
                </button>
              )}

              {/* مشتریان */}
              {canCustomers && (
                <button
                  type="button"
                  id="drawer-btn-customers"
                  onClick={() => {
                    setShowMoreMenu(false);
                    setActiveTab('customers');
                  }}
                  className="flex flex-col items-center justify-center p-3 rounded-2xl bg-blue-50 border border-blue-100 text-blue-800 hover:bg-blue-100 transition-colors cursor-pointer"
                >
                  <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-sm mb-1.5">
                    <Users className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-bold">مشتریان</span>
                </button>
              )}

              {/* گزارشات و نمودارها */}
              {canReports && (
                <button
                  type="button"
                  id="drawer-btn-reports"
                  onClick={() => {
                    setShowMoreMenu(false);
                    setActiveTab('reports');
                  }}
                  className="flex flex-col items-center justify-center p-3 rounded-2xl bg-purple-50 border border-purple-100 text-purple-800 hover:bg-purple-100 transition-colors cursor-pointer"
                >
                  <div className="w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center shadow-sm mb-1.5">
                    <BarChart3 className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-bold">گزارشات</span>
                </button>
              )}

              {/* مدیریت کاربران */}
              {canAdmin && (
                <button
                  type="button"
                  id="drawer-btn-admin"
                  onClick={() => {
                    setShowMoreMenu(false);
                    setActiveTab('admin');
                  }}
                  className="flex flex-col items-center justify-center p-3 rounded-2xl bg-slate-50 border border-slate-200 text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <div className="w-10 h-10 rounded-xl bg-slate-700 text-white flex items-center justify-center shadow-sm mb-1.5">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-bold">مدیریت</span>
                </button>
              )}

              {/* تنظیمات */}
              {canAdmin && (
                <button
                  type="button"
                  id="drawer-btn-settings"
                  onClick={() => {
                    setShowMoreMenu(false);
                    setActiveTab('admin');
                  }}
                  className="flex flex-col items-center justify-center p-3 rounded-2xl bg-slate-50 border border-slate-200 text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <div className="w-10 h-10 rounded-xl bg-slate-600 text-white flex items-center justify-center shadow-sm mb-1.5">
                    <Settings className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-bold">تنظیمات</span>
                </button>
              )}

              {/* خروج از حساب کاربری (موبایل) */}
              {onLogout && (
                <button
                  type="button"
                  id="btn-mobile-drawer-logout"
                  onClick={() => {
                    setShowMoreMenu(false);
                    onLogout();
                  }}
                  className="col-span-3 flex items-center justify-center gap-2 p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 transition-colors cursor-pointer font-bold text-xs shadow-xs mt-1"
                >
                  <LogOut className="w-4 h-4 text-rose-600" />
                  <span>خروج از حساب کاربری و قفل برنامه</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Main Bottom Bar */}
      <nav 
        dir="ltr"
        className="no-print sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/90 shadow-[0_-4px_16px_rgba(0,0,0,0.06)] px-2 pt-1 pb-[max(env(safe-area-inset-bottom),0.5rem)]"
      >
        <div className="flex items-center justify-around max-w-md mx-auto">
          {mainBarItems.map((item) => {
            const Icon = item.icon;
            const isActive = (item.id === 'dashboard' && activeTab === 'dashboard') ||
                             (item.id === 'inventory' && activeTab === 'inventory') ||
                             (item.id === 'invoices' && activeTab === 'invoices');

            return (
              <button
                key={item.id}
                type="button"
                id={`mobile-nav-${item.id}`}
                onClick={item.onClick}
                className={`relative flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all cursor-pointer min-w-[54px] min-h-[46px] ${
                  isActive
                    ? 'text-[#f05a28] font-bold'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <div className="relative">
                  <Icon
                    className={`w-5 h-5 ${
                      isActive ? 'stroke-[2.5px] text-[#f05a28]' : 'stroke-[1.8px]'
                    }`}
                  />
                  {item.badge !== undefined && (
                    <span className="absolute -top-1.5 -right-2.5 bg-rose-600 text-white text-[10px] font-bold rounded-full min-w-[17px] h-[17px] px-1 flex items-center justify-center shadow-xs">
                      {item.badge}
                    </span>
                  )}
                </div>
                <span className="text-[10px] mt-1 tracking-tight font-medium">
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
};
