import React from 'react';
import { StoreSettings, AppUser } from '../types';
import { StorageService } from '../utils/storage';
import { 
  ReceiptText, 
  Boxes, 
  Users, 
  BarChart3, 
  PlusCircle, 
  ShieldCheck
} from 'lucide-react';

interface MobileBottomNavProps {
  settings?: StoreSettings;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  lowStockCount: number;
  currentUser?: AppUser;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  settings,
  activeTab,
  setActiveTab,
  lowStockCount,
  currentUser,
}) => {
  const safeSettings = settings || StorageService.getSettings();

  return (
    <div className="no-print sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/90 shadow-[0_-4px_16px_rgba(0,0,0,0.06)] px-2 pt-1 pb-[max(env(safe-area-inset-bottom),0.5rem)]">
      <div className="flex items-center justify-around max-w-md mx-auto">
        {/* Tab 1: Invoices */}
        {(!currentUser || currentUser.permissions.canViewInvoices) && (
          <button
            type="button"
            id="mobile-nav-invoices"
            onClick={() => setActiveTab('invoices')}
            className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all cursor-pointer min-w-[50px] min-h-[46px] ${
              activeTab === 'invoices'
                ? 'text-emerald-700 font-bold'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <ReceiptText className={`w-5 h-5 ${activeTab === 'invoices' ? 'stroke-[2.5px]' : 'stroke-2'}`} />
            <span className="text-[10px] mt-1">فاکتورها</span>
          </button>
        )}

        {/* Tab 2: Inventory (if enabled & permitted) */}
        {safeSettings?.enableInventory !== false && (!currentUser || currentUser.permissions.canManageInventory) && (
          <button
            type="button"
            id="mobile-nav-inventory"
            onClick={() => setActiveTab('inventory')}
            className={`relative flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all cursor-pointer min-w-[50px] min-h-[46px] ${
              activeTab === 'inventory'
                ? 'text-emerald-700 font-bold'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <div className="relative">
              <Boxes className={`w-5 h-5 ${activeTab === 'inventory' ? 'stroke-[2.5px]' : 'stroke-2'}`} />
              {safeSettings?.showLowStockAlerts !== false && lowStockCount > 0 && (
                <span className="absolute -top-1.5 -right-2 bg-amber-500 text-white text-[9px] font-black rounded-full w-4 h-4 flex items-center justify-center border-2 border-white shadow-xs">
                  {lowStockCount > 9 ? '9+' : lowStockCount}
                </span>
              )}
            </div>
            <span className="text-[10px] mt-1">انبار</span>
          </button>
        )}

        {/* Center Primary Action - New Invoice (if permitted) */}
        {(!currentUser || currentUser.permissions.canCreateInvoice) && (
          <button
            type="button"
            id="mobile-nav-new-invoice"
            onClick={() => setActiveTab('new-invoice')}
            className="flex flex-col items-center justify-center -mt-5 min-w-[58px] cursor-pointer group"
          >
            <div
              className={`w-12 h-12 rounded-full flex items-center justify-center text-white shadow-lg transition-transform active:scale-95 ${
                activeTab === 'new-invoice'
                  ? 'bg-emerald-700 ring-4 ring-emerald-100 shadow-emerald-600/40'
                  : 'bg-emerald-600 shadow-emerald-500/30 group-hover:bg-emerald-700'
              }`}
            >
              <PlusCircle className="w-6 h-6 stroke-[2.2px]" />
            </div>
            <span className="text-[10px] font-bold text-slate-800 mt-1">فاکتور</span>
          </button>
        )}

        {/* Tab 4: Customers or Reports */}
        {safeSettings?.enableCustomers !== false && (!currentUser || currentUser.permissions.canManageCustomers) ? (
          <button
            type="button"
            id="mobile-nav-customers"
            onClick={() => setActiveTab('customers')}
            className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all cursor-pointer min-w-[50px] min-h-[46px] ${
              activeTab === 'customers'
                ? 'text-emerald-700 font-bold'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Users className={`w-5 h-5 ${activeTab === 'customers' ? 'stroke-[2.5px]' : 'stroke-2'}`} />
            <span className="text-[10px] mt-1">مشتریان</span>
          </button>
        ) : safeSettings?.enableReports !== false && (!currentUser || currentUser.permissions.canViewReports) ? (
          <button
            type="button"
            id="mobile-nav-reports"
            onClick={() => setActiveTab('reports')}
            className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all cursor-pointer min-w-[50px] min-h-[46px] ${
              activeTab === 'reports'
                ? 'text-emerald-700 font-bold'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <BarChart3 className={`w-5 h-5 ${activeTab === 'reports' ? 'stroke-[2.5px]' : 'stroke-2'}`} />
            <span className="text-[10px] mt-1">گزارشات</span>
          </button>
        ) : null}

        {/* Tab 5: Admin Panel (if permitted) */}
        {(!currentUser || currentUser.permissions.canAccessAdmin || currentUser.permissions.canManageUsers) && (
          <button
            type="button"
            id="mobile-nav-admin"
            onClick={() => setActiveTab('admin')}
            className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all cursor-pointer min-w-[50px] min-h-[46px] ${
              activeTab === 'admin'
                ? 'text-emerald-700 font-bold'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <ShieldCheck className={`w-5 h-5 ${activeTab === 'admin' ? 'stroke-[2.5px]' : 'stroke-2'}`} />
            <span className="text-[10px] mt-1">مدیریت</span>
          </button>
        )}
      </div>
    </div>
  );
};
