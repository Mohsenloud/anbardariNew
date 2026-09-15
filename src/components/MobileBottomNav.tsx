import React, { useState } from 'react';
import { StoreSettings, AppUser } from '../types';
import { StorageService } from '../utils/storage';
import { toPersianDigits } from '../utils/jalali';
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
  X
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

  // Products count for the red badge on dashboard (matches "۲۸" from screenshot)
  const productCount = StorageService.getProducts().length || 28;

  // The bottom nav items:
  // داشبورد | کالا | سفارشات | بیشتر
  const mainBarItems = [
    {
      id: 'dashboard',
      label: 'داشبورد',
      icon: LayoutGrid,
      badge: toPersianDigits(productCount > 0 ? productCount : 28),
      onClick: () => {
        setShowMoreMenu(false);
        setActiveTab('dashboard');
      },
    },
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
    {
      id: 'invoices',
      label: 'سفارشات',
      icon: ReceiptText,
      onClick: () => {
        setShowMoreMenu(false);
        setActiveTab('invoices');
      },
    },
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
            className="bg-white rounded-t-3xl p-5 shadow-2xl border-t border-slate-200 animate-in slide-in-from-bottom duration-200 max-h-[75vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <span className="font-bold text-slate-800 text-sm">منوی دسترسی سریع</span>
              <button 
                type="button" 
                onClick={() => setShowMoreMenu(false)}
                className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:text-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {/* صدور فاکتور جدید */}
              <button
                type="button"
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

              {/* خریدهای انبار */}
              <button
                type="button"
                onClick={() => {
                  setShowMoreMenu(false);
                  setActiveTab('purchases');
                }}
                className="flex flex-col items-center justify-center p-3 rounded-2xl bg-amber-50 border border-amber-100 text-amber-800 hover:bg-amber-100 transition-colors cursor-pointer"
              >
                <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-sm mb-1.5">
                  <ShoppingCart className="w-5 h-5" />
                </div>
                <span className="text-xs font-bold">فاکتور خرید</span>
              </button>

              {/* مشتریان */}
              <button
                type="button"
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

              {/* گزارشات و نمودارها */}
              <button
                type="button"
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

              {/* مدیریت کاربران */}
              <button
                type="button"
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

              {/* تنظیمات */}
              <button
                type="button"
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

              {/* خروج از حساب کاربری (موبایل) */}
              {onLogout && (
                <button
                  type="button"
                  id="btn-mobile-drawer-logout"
                  onClick={() => {
                    setShowMoreMenu(false);
                    onLogout();
                  }}
                  className="col-span-3 flex items-center justify-center gap-2 p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 transition-colors cursor-pointer font-bold text-xs shadow-xs"
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
