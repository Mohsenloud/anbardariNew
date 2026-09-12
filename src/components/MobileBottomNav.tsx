import React from 'react';
import { StoreSettings, AppUser } from '../types';
import { StorageService } from '../utils/storage';
import { 
  ReceiptText, 
  Boxes, 
  Users, 
  BarChart3, 
  PlusCircle, 
  ShieldCheck,
  ShoppingCart
} from 'lucide-react';

interface MobileBottomNavProps {
  settings?: StoreSettings;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  lowStockCount: number;
  currentUser?: AppUser;
  onNewInvoice?: () => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  settings,
  activeTab,
  setActiveTab,
  lowStockCount,
  currentUser,
  onNewInvoice,
}) => {
  const safeSettings = settings || StorageService.getSettings();

  const navItems = [
    {
      id: 'invoices',
      label: 'فاکتورها',
      icon: ReceiptText,
      enabled: !currentUser || currentUser.permissions.canViewInvoices,
    },
    {
      id: 'purchases',
      label: 'خرید',
      icon: ShoppingCart,
      enabled:
        !currentUser ||
        currentUser.permissions.canCreateInvoice ||
        currentUser.permissions.canManageInventory ||
        currentUser.permissions.canViewInvoices,
    },
    {
      id: 'inventory',
      label: 'انبار',
      icon: Boxes,
      badge:
        safeSettings?.showLowStockAlerts !== false && lowStockCount > 0
          ? lowStockCount > 9
            ? '9+'
            : lowStockCount
          : undefined,
      enabled:
        safeSettings?.enableInventory !== false &&
        (!currentUser || currentUser.permissions.canManageInventory),
    },
    {
      id: 'new-invoice',
      label: 'فاکتور جدید',
      icon: PlusCircle,
      isPrimary: true,
      enabled: !currentUser || currentUser.permissions.canCreateInvoice,
    },
    {
      id: 'customers',
      label: 'مشتریان',
      icon: Users,
      enabled:
        safeSettings?.enableCustomers !== false &&
        (!currentUser || currentUser.permissions.canManageCustomers),
    },
    {
      id: 'reports',
      label: 'گزارشات',
      icon: BarChart3,
      enabled:
        safeSettings?.enableReports !== false &&
        (!currentUser || currentUser.permissions.canViewReports),
    },
    {
      id: 'admin',
      label: 'مدیریت',
      icon: ShieldCheck,
      enabled:
        !currentUser ||
        currentUser.permissions.canAccessAdmin ||
        currentUser.permissions.canManageUsers,
    },
  ];

  const permittedItems = navItems.filter((item) => item.enabled);

  return (
    <div className="no-print sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/90 shadow-[0_-4px_16px_rgba(0,0,0,0.06)] px-2 pt-1 pb-[max(env(safe-area-inset-bottom),0.5rem)]">
      <div className="flex items-center justify-around max-w-md mx-auto">
        {permittedItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          if (item.isPrimary) {
            return (
              <button
                key={item.id}
                type="button"
                id="mobile-nav-new-invoice"
                onClick={() => {
                  if (onNewInvoice) {
                    onNewInvoice();
                  } else {
                    setActiveTab('new-invoice');
                  }
                }}
                className="flex flex-col items-center justify-center -mt-5 min-w-[58px] cursor-pointer group"
              >
                <div
                  className={`w-12 h-12 rounded-full flex items-center justify-center text-white shadow-lg transition-transform active:scale-95 ${
                    isActive
                      ? 'bg-emerald-700 ring-4 ring-emerald-100 shadow-emerald-600/40'
                      : 'bg-emerald-600 shadow-emerald-500/30 group-hover:bg-emerald-700'
                  }`}
                >
                  <Icon className="w-6 h-6 stroke-[2.2px]" />
                </div>
                <span className="text-[10px] font-bold text-slate-800 mt-1">
                  {item.label}
                </span>
              </button>
            );
          }

          return (
            <button
              key={item.id}
              type="button"
              id={`mobile-nav-${item.id}`}
              onClick={() => setActiveTab(item.id)}
              className={`relative flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all cursor-pointer min-w-[46px] min-h-[46px] ${
                isActive
                  ? 'text-emerald-700 font-bold'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <div className="relative">
                <Icon
                  className={`w-5 h-5 ${
                    isActive ? 'stroke-[2.5px]' : 'stroke-2'
                  }`}
                />
                {item.badge !== undefined && (
                  <span className="absolute -top-1.5 -right-2 bg-amber-500 text-white text-[9px] font-black rounded-full w-4 h-4 flex items-center justify-center border-2 border-white shadow-xs">
                    {item.badge}
                  </span>
                )}
              </div>
              <span className="text-[10px] mt-1">{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
