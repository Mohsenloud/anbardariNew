import React, { useEffect, useState, useRef } from 'react';
import { StoreSettings, AppUser } from '../types';
import { StorageService } from '../utils/storage';
import { toPersianDigits, getCurrentJalaliDate, getCurrentJalaliTime } from '../utils/jalali';
import { isTabPermitted, getRoleBadgeConfig } from '../utils/permissions';
import { clearAppCacheAndReload } from '../utils/appUpdater';
import { 
  LayoutDashboard,
  ReceiptText, 
  Boxes, 
  Users, 
  BarChart3, 
  PlusCircle, 
  FileSpreadsheet,
  ShieldCheck,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  X,
  User,
  LogOut,
  ArrowRightLeft,
  Settings,
  ShoppingCart,
  RefreshCw,
  Building2,
  Sparkles,
  Lock,
  Layers,
  Truck,
  History,
  ArrowDownRight
} from 'lucide-react';

export type InventorySubTabKey = 'items' | 'inbound-receipts' | 'exit-slips' | 'direct-transfers' | 'movements';

export interface SidebarProps {
  settings?: StoreSettings;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  inventorySubTab?: InventorySubTabKey;
  onSelectInventorySubTab?: (subTab: InventorySubTabKey) => void;
  lowStockCount: number;
  pendingInboundCount?: number;
  currentUser?: AppUser | null;
  users?: AppUser[];
  onSwitchUser?: (user: AppUser) => void;
  onRequestLogin?: (targetUser?: AppUser | null) => void;
  onLogout?: () => void;
  onOpenNewInvoice: () => void;
  onOpenSettings: () => void;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
  isCollapsedDesktop: boolean;
  onToggleCollapseDesktop: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  settings,
  activeTab,
  setActiveTab,
  inventorySubTab = 'items',
  onSelectInventorySubTab,
  lowStockCount,
  pendingInboundCount = 0,
  currentUser,
  users = [],
  onSwitchUser,
  onRequestLogin,
  onLogout,
  onOpenNewInvoice,
  onOpenSettings,
  isOpenMobile,
  onCloseMobile,
  isCollapsedDesktop,
  onToggleCollapseDesktop,
}) => {
  const safeSettings = settings || StorageService.getSettings();
  const currentDate = getCurrentJalaliDate();
  const currentTime = getCurrentJalaliTime();

  // Accordion state for inventory sub-items
  const [isInventoryExpanded, setIsInventoryExpanded] = useState<boolean>(() => activeTab === 'inventory');
  const [isInventoryFlyoutOpen, setIsInventoryFlyoutOpen] = useState(false);
  const flyoutRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (activeTab === 'inventory') {
      setIsInventoryExpanded(true);
    }
  }, [activeTab]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (flyoutRef.current && !flyoutRef.current.contains(e.target as Node)) {
        setIsInventoryFlyoutOpen(false);
      }
    };
    if (isInventoryFlyoutOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isInventoryFlyoutOpen]);

  // Inventory 5 sub-items requested by user
  const inventorySubItems: Array<{
    id: InventorySubTabKey;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: string;
    badgeClass?: string;
  }> = [
    {
      id: 'items',
      label: 'کالاها و موجودی',
      icon: Boxes,
      badge: lowStockCount > 0 ? `${toPersianDigits(lowStockCount)} هشدار` : undefined,
      badgeClass: 'bg-amber-500 text-white',
    },
    {
      id: 'inbound-receipts',
      label: 'حواله‌های ورود کالا',
      icon: ArrowDownRight,
      badge: (pendingInboundCount > 0) ? `${toPersianDigits(pendingInboundCount)} منتظر` : undefined,
      badgeClass: 'bg-rose-500 text-white',
    },
    {
      id: 'exit-slips',
      label: 'برگه‌های خروج انبار',
      icon: Truck,
    },
    {
      id: 'direct-transfers',
      label: 'خروج و ورود بدون فاکتور (امانی/تعمیرات)',
      icon: ArrowRightLeft,
    },
    {
      id: 'movements',
      label: 'گردش و کاردکس',
      icon: History,
    },
  ];

  // Close mobile drawer on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpenMobile) {
        onCloseMobile();
      }
    };
    if (isOpenMobile) {
      document.addEventListener('keydown', handleKeyDown);
      // Prevent background scrolling on mobile when drawer is open
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpenMobile, onCloseMobile]);

  // All application navigation items
  const allNavItems = [
    { 
      id: 'dashboard', 
      label: 'داشبورد', 
      shortLabel: 'داشبورد',
      description: 'پیشخوان جامع و دسترسی سریع به آمار',
      icon: LayoutDashboard, 
      enabled: isTabPermitted('dashboard', currentUser, safeSettings),
      badge: undefined as string | number | undefined,
      onClick: () => {
        setActiveTab('dashboard');
        onCloseMobile();
      }
    },
    { 
      id: 'new-invoice', 
      label: 'صدور فاکتور جدید', 
      shortLabel: 'فاکتور جدید',
      description: 'ثبت سریع فاکتور فروشگاهی، رسمی یا حرارتی',
      icon: PlusCircle, 
      isPrimary: true, 
      enabled: isTabPermitted('new-invoice', currentUser, safeSettings),
      badge: undefined as string | number | undefined,
      onClick: () => {
        onOpenNewInvoice();
        onCloseMobile();
      }
    },
    { 
      id: 'invoices', 
      label: 'لیست فاکتورها', 
      shortLabel: 'فاکتورها',
      description: 'مشاهده، چاپ، تسویه و جستجوی فاکتورها',
      icon: ReceiptText, 
      enabled: isTabPermitted('invoices', currentUser, safeSettings),
      badge: undefined as string | number | undefined,
      onClick: () => {
        setActiveTab('invoices');
        onCloseMobile();
      }
    },
    { 
      id: 'purchases', 
      label: 'فاکتورهای خرید', 
      shortLabel: 'خرید',
      description: 'ثبت خرید کالا، تامین‌کنندگان و ورود به انبار',
      icon: ShoppingCart, 
      enabled: isTabPermitted('purchases', currentUser, safeSettings),
      badge: undefined as string | number | undefined,
      onClick: () => {
        setActiveTab('purchases');
        onCloseMobile();
      }
    },
    { 
      id: 'inventory', 
      label: 'مدیریت انبار و کالا', 
      shortLabel: 'انبار و کالا',
      description: 'کنترل موجودی، رسید، حواله و کاردکس',
      icon: Boxes, 
      badge: lowStockCount > 0 ? `${toPersianDigits(lowStockCount)} هشدار` : undefined,
      enabled: isTabPermitted('inventory', currentUser, safeSettings),
      onClick: () => {
        setActiveTab('inventory');
        onCloseMobile();
      }
    },
    { 
      id: 'customers', 
      label: 'مدیریت مشتریان', 
      shortLabel: 'مشتریان',
      description: 'پرونده مشتریان، سابقه خرید و مانده‌حساب',
      icon: Users,
      badge: undefined as string | number | undefined,
      enabled: isTabPermitted('customers', currentUser, safeSettings),
      onClick: () => {
        setActiveTab('customers');
        onCloseMobile();
      }
    },
    { 
      id: 'reports', 
      label: 'گزارشات و سود و زیان', 
      shortLabel: 'گزارشات',
      description: 'آمار مالی، سود ناخالص و کالاهای پرفروش',
      icon: BarChart3,
      badge: undefined as string | number | undefined,
      enabled: isTabPermitted('reports', currentUser, safeSettings),
      onClick: () => {
        setActiveTab('reports');
        onCloseMobile();
      }
    },
    { 
      id: 'admin', 
      label: 'پنل مدیریت و تنظیمات', 
      shortLabel: 'مدیریت',
      description: 'تنظیمات جامع سیستم، کاربران و دسترسی‌ها',
      icon: ShieldCheck, 
      badge: undefined as string | number | undefined,
      enabled: isTabPermitted('admin', currentUser, safeSettings),
      onClick: () => {
        setActiveTab('admin');
        onCloseMobile();
      }
    },
  ];

  const permittedNavItems = allNavItems.filter(item => item.enabled);

  const roleBadge = currentUser?.role ? getRoleBadgeConfig(currentUser.role) : null;

  const [isUpdatingApp, setIsUpdatingApp] = useState(false);

  const handleUpdateAppCache = async () => {
    try {
      setIsUpdatingApp(true);
      await clearAppCacheAndReload();
    } catch (err) {
      console.warn('Update app cache error:', err);
      setIsUpdatingApp(false);
    }
  };

  return (
    <>
      {/* ========================================================================= */}
      {/* 1. DESKTOP SIDEBAR (RTL Right side, fixed height, collapsable)             */}
      {/* ========================================================================= */}
      <aside 
        id="desktop-sidebar"
        aria-label="سایدبار ناوبری اصلی"
        className={`no-print hidden md:flex flex-col bg-white border-l border-slate-200/90 h-screen sticky top-0 z-40 transition-all duration-300 ease-in-out shrink-0 select-none shadow-xs ${
          isCollapsedDesktop ? 'w-[76px]' : 'w-64 lg:w-72'
        }`}
      >
        {/* Brand & Header Section */}
        <div className="h-16 px-3.5 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div 
              onClick={() => setActiveTab('dashboard')}
              className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-700 flex items-center justify-center text-white shadow-md shadow-emerald-600/20 shrink-0 cursor-pointer hover:scale-105 transition-transform"
              title={safeSettings?.appName || safeSettings?.storeName || 'سیستم فاکتور و انبارداری'}
            >
              <FileSpreadsheet className="w-5 h-5 stroke-[2.2]" />
            </div>

            {!isCollapsedDesktop && (
              <div className="min-w-0 flex-1 animate-in fade-in duration-200">
                <div className="flex items-center gap-1.5">
                  <h1 className="font-black text-sm text-slate-800 truncate leading-tight">
                    {safeSettings?.appName || safeSettings?.storeName || 'فاکتورساز'}
                  </h1>
                </div>
                <p className="text-[11px] text-slate-400 truncate mt-0.5 font-medium">
                  {safeSettings?.storeName || 'سیستم فروش و انبارداری'}
                </p>
              </div>
            )}
          </div>

          {/* Collapse/Expand Toggle Button */}
          <button
            type="button"
            id="btn-toggle-sidebar-collapse"
            onClick={onToggleCollapseDesktop}
            className="w-7 h-7 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer shrink-0"
            title={isCollapsedDesktop ? 'باز کردن سایدبار' : 'جمع کردن سایدبار (حالت باریک)'}
          >
            {isCollapsedDesktop ? (
              <ChevronLeft className="w-4 h-4 stroke-[2.2]" />
            ) : (
              <ChevronRight className="w-4 h-4 stroke-[2.2]" />
            )}
          </button>
        </div>

        {/* Primary Action Button: صدور فاکتور جدید */}
        <div className="p-3 shrink-0">
          {isTabPermitted('new-invoice', currentUser, safeSettings) && (
            <button
              type="button"
              id="sidebar-btn-new-invoice"
              onClick={onOpenNewInvoice}
              className={`w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-extrabold rounded-xl transition-all shadow-md shadow-emerald-600/25 active:scale-97 cursor-pointer flex items-center justify-center gap-2 ${
                isCollapsedDesktop ? 'h-11 px-0' : 'h-11 px-3 text-xs'
              }`}
              title="صدور فاکتور جدید [کلید میانبر F4]"
            >
              <PlusCircle className="w-5 h-5 shrink-0 stroke-[2.5]" />
              {!isCollapsedDesktop && (
                <span className="truncate">صدور فاکتور جدید</span>
              )}
            </button>
          )}
        </div>

        {/* Navigation Items List */}
        <div className="flex-1 overflow-y-auto px-2.5 py-1 space-y-1 divide-y-0 scrollbar-thin scrollbar-thumb-slate-200">
          <div className="space-y-1">
            {!isCollapsedDesktop && (
              <span className="px-3 text-[10px] font-black text-slate-400 uppercase tracking-wider block py-1">
                بخش‌های برنامه
              </span>
            )}
            
            {permittedNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              const isPrimaryAction = item.id === 'new-invoice';

              // If it's new-invoice, we already show it prominently above, but also keep in list if collapsed
              if (isPrimaryAction && !isCollapsedDesktop) {
                return null;
              }

              // Special handling for inventory tab: render accordion with 5 sub-items
              if (item.id === 'inventory') {
                if (isCollapsedDesktop) {
                  return (
                    <div key={item.id} className="relative group/inv" ref={flyoutRef}>
                      <button
                        type="button"
                        id="sidebar-item-inventory-collapsed"
                        onClick={() => {
                          item.onClick();
                          setIsInventoryFlyoutOpen((prev) => !prev);
                        }}
                        onMouseEnter={() => setIsInventoryFlyoutOpen(true)}
                        title={`${item.label}: ${item.description}`}
                        className={`w-full flex items-center justify-center h-11 rounded-xl transition-all cursor-pointer relative ${
                          isActive
                            ? 'bg-emerald-50 text-emerald-900 font-black shadow-2xs border border-emerald-200/80'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                        }`}
                      >
                        {isActive && (
                          <span className="absolute right-0 top-2 bottom-2 w-1 bg-emerald-600 rounded-l-full" />
                        )}
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                          isActive
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'bg-slate-100/80 text-slate-600 group-hover/inv:bg-slate-200 group-hover/inv:text-slate-900'
                        }`}>
                          <Icon className="w-4 h-4 stroke-[2.2]" />
                        </div>
                        {item.badge && (
                          <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-amber-500 rounded-full ring-2 ring-white" />
                        )}
                      </button>

                      {/* Collapsed Flyout Popover */}
                      {isInventoryFlyoutOpen && (
                        <div 
                          onMouseLeave={() => setIsInventoryFlyoutOpen(false)}
                          className="absolute right-full top-0 mr-2 w-64 bg-white rounded-2xl shadow-xl border border-slate-200 p-2 z-50 text-right animate-in fade-in zoom-in-95 duration-150"
                        >
                          <div className="px-2.5 py-1.5 border-b border-slate-100 mb-1 flex items-center justify-between">
                            <span className="text-xs font-black text-slate-800">مدیریت انبار و کالا</span>
                            <span className="text-[10px] text-slate-400">بخش‌های انبار</span>
                          </div>
                          <div className="space-y-0.5">
                            {inventorySubItems.map((sub) => {
                              const isSubActive = activeTab === 'inventory' && (inventorySubTab || 'items') === sub.id;
                              const SubIcon = sub.icon;
                              return (
                                <button
                                  key={sub.id}
                                  type="button"
                                  id={`sidebar-flyout-sub-${sub.id}`}
                                  onClick={() => {
                                    setActiveTab('inventory');
                                    onSelectInventorySubTab?.(sub.id);
                                    setIsInventoryFlyoutOpen(false);
                                  }}
                                  className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-xl text-right text-xs transition-colors cursor-pointer ${
                                    isSubActive
                                      ? 'bg-emerald-600 text-white font-bold shadow-xs'
                                      : 'text-slate-700 hover:bg-slate-100'
                                  }`}
                                >
                                  <div className="flex items-center gap-2 min-w-0">
                                    <SubIcon className={`w-4 h-4 shrink-0 ${isSubActive ? 'text-white' : 'text-slate-500'}`} />
                                    <span className="truncate">{sub.label}</span>
                                  </div>
                                  {sub.badge && (
                                    <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full shrink-0 ${
                                      isSubActive ? 'bg-white/20 text-white' : (sub.badgeClass || 'bg-amber-100 text-amber-800')
                                    }`}>
                                      {sub.badge}
                                    </span>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                }

                // Expanded Desktop Mode: Accordion with 5 sub-items
                return (
                  <div key={item.id} className="space-y-1">
                    <div
                      className={`w-full flex items-center justify-between rounded-xl transition-all group relative px-2.5 py-2 text-right ${
                        isActive
                          ? 'bg-emerald-50 text-emerald-900 font-black shadow-2xs border border-emerald-200/80'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                      }`}
                    >
                      {isActive && (
                        <span className="absolute right-0 top-2 bottom-2 w-1 bg-emerald-600 rounded-l-full" />
                      )}

                      <div 
                        onClick={() => {
                          if (activeTab !== 'inventory') {
                            setActiveTab('inventory');
                            setIsInventoryExpanded(true);
                          } else {
                            setIsInventoryExpanded(!isInventoryExpanded);
                          }
                        }}
                        className="flex items-center gap-2.5 flex-1 min-w-0 cursor-pointer"
                      >
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                          isActive
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'bg-slate-100/80 text-slate-600 group-hover:bg-slate-200 group-hover:text-slate-900'
                        }`}>
                          <Icon className="w-4 h-4 stroke-[2.2]" />
                        </div>

                        <div className="flex-1 min-w-0 text-right">
                          <div className="flex items-center justify-between gap-1">
                            <span className={`text-xs font-black truncate ${
                              isActive ? 'text-emerald-950' : 'text-slate-800'
                            }`}>
                              {item.label}
                            </span>
                            {item.badge && (
                              <span className="bg-amber-500 text-white text-[10px] font-bold rounded-full px-1.5 py-0.2 shrink-0 shadow-2xs">
                                {item.badge}
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-slate-400 truncate mt-0.5">
                            {item.description}
                          </p>
                        </div>
                      </div>

                      {/* Accordion Toggle Chevron */}
                      <button
                        type="button"
                        id="sidebar-inventory-accordion-toggle"
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsInventoryExpanded(!isInventoryExpanded);
                        }}
                        className="w-6 h-6 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 flex items-center justify-center transition-colors shrink-0 cursor-pointer"
                        title={isInventoryExpanded ? 'بستن زیرمجموعه‌ها' : 'مشاهده زیرمجموعه‌ها'}
                      >
                        {isInventoryExpanded ? (
                          <ChevronUp className="w-4 h-4 text-emerald-700" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-slate-500" />
                        )}
                      </button>
                    </div>

                    {/* Accordion Sub-items */}
                    {isInventoryExpanded && (
                      <div className="mr-3 pr-2.5 border-r-2 border-emerald-300/70 my-1 space-y-0.5 animate-in fade-in slide-in-from-top-1 duration-150">
                        {inventorySubItems.map((sub) => {
                          const isSubActive = activeTab === 'inventory' && (inventorySubTab || 'items') === sub.id;
                          const SubIcon = sub.icon;
                          return (
                            <button
                              key={sub.id}
                              type="button"
                              id={`sidebar-subitem-${sub.id}`}
                              onClick={() => {
                                setActiveTab('inventory');
                                onSelectInventorySubTab?.(sub.id);
                              }}
                              className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-right transition-all cursor-pointer group text-xs ${
                                isSubActive
                                  ? 'bg-emerald-600 text-white font-black shadow-xs shadow-emerald-600/25 ring-1 ring-emerald-500'
                                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/90 font-medium'
                              }`}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <SubIcon className={`w-3.5 h-3.5 shrink-0 transition-colors ${
                                  isSubActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-700'
                                }`} />
                                <span className="truncate">{sub.label}</span>
                              </div>
                              {sub.badge && (
                                <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full shrink-0 ${
                                  isSubActive ? 'bg-white/20 text-white' : (sub.badgeClass || 'bg-amber-100 text-amber-800')
                                }`}>
                                  {sub.badge}
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              }

              return (
                <button
                  key={item.id}
                  type="button"
                  id={`sidebar-item-${item.id}`}
                  onClick={item.onClick}
                  title={isCollapsedDesktop ? `${item.label}: ${item.description}` : undefined}
                  className={`w-full flex items-center rounded-xl transition-all cursor-pointer group relative ${
                    isCollapsedDesktop 
                      ? 'justify-center h-11 px-0' 
                      : 'gap-3 px-3 py-2.5 text-right'
                  } ${
                    isActive
                      ? 'bg-emerald-50 text-emerald-900 font-black shadow-2xs border border-emerald-200/80'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  {/* Active Indicator Bar */}
                  {isActive && (
                    <span className="absolute right-0 top-2 bottom-2 w-1 bg-emerald-600 rounded-l-full" />
                  )}

                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                    isActive
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-slate-100/80 text-slate-600 group-hover:bg-slate-200 group-hover:text-slate-900'
                  }`}>
                    <Icon className="w-4 h-4 stroke-[2.2]" />
                  </div>

                  {!isCollapsedDesktop && (
                    <div className="flex-1 min-w-0 text-right">
                      <div className="flex items-center justify-between gap-1">
                        <span className={`text-xs font-black truncate ${
                          isActive ? 'text-emerald-950' : 'text-slate-800'
                        }`}>
                          {item.label}
                        </span>
                        {item.badge && (
                          <span className="bg-amber-500 text-white text-[10px] font-bold rounded-full px-1.5 py-0.2 shrink-0 shadow-2xs">
                            {item.badge}
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-400 truncate mt-0.5">
                        {item.description}
                      </p>
                    </div>
                  )}

                  {/* Badge in collapsed mode */}
                  {isCollapsedDesktop && item.badge && (
                    <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-amber-500 rounded-full ring-2 ring-white" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Bottom Section: Settings & User Profile Card */}
        <div className="p-3 border-t border-slate-100 bg-slate-50/60 shrink-0 space-y-2">
          {/* Update App Button (دکمه آپدیت برنامه در سایدبار دسکتاپ) */}
          <button
            type="button"
            id="sidebar-btn-update-desktop"
            onClick={handleUpdateAppCache}
            disabled={isUpdatingApp}
            className={`w-full flex items-center rounded-xl text-sky-800 hover:text-sky-950 bg-sky-50/80 hover:bg-sky-100 border border-sky-200/90 hover:border-sky-300 transition-all cursor-pointer shadow-2xs ${
              isCollapsedDesktop ? 'justify-center h-10 px-0' : 'justify-between px-2.5 py-2 text-xs font-bold'
            }`}
            title="بروزرسانی برنامه و نوسازی کش مرورگر"
          >
            <div className="flex items-center gap-2 min-w-0">
              <RefreshCw className={`w-4 h-4 text-sky-600 shrink-0 ${isUpdatingApp ? 'animate-spin' : ''}`} />
              {!isCollapsedDesktop && (
                <span className="truncate">
                  {isUpdatingApp ? 'در حال آپدیت...' : 'بروزرسانی برنامه'}
                </span>
              )}
            </div>
            {!isCollapsedDesktop && (
              <span className="text-[10px] bg-sky-200/80 text-sky-900 font-extrabold px-1.5 py-0.2 rounded shrink-0">
                آپدیت
              </span>
            )}
          </button>

          {/* Settings Button */}
          <button
            type="button"
            id="sidebar-btn-settings"
            onClick={onOpenSettings}
            className={`w-full flex items-center rounded-xl text-slate-700 hover:text-slate-900 hover:bg-white border border-transparent hover:border-slate-200 transition-all cursor-pointer ${
              isCollapsedDesktop ? 'justify-center h-10 px-0' : 'gap-2.5 px-2.5 py-2 text-xs font-bold'
            }`}
            title="تنظیمات سیستم و شخصی‌سازی"
          >
            <Settings className="w-4 h-4 text-slate-500 shrink-0" />
            {!isCollapsedDesktop && (
              <span className="truncate">تنظیمات سیستم</span>
            )}
          </button>

          {/* Current User Card */}
          {currentUser ? (
            <div className={`rounded-xl bg-white border border-slate-200/80 p-2 shadow-2xs flex items-center ${
              isCollapsedDesktop ? 'justify-center' : 'justify-between gap-2'
            }`}>
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs shrink-0">
                  {currentUser.name ? currentUser.name.charAt(0) : <User className="w-4 h-4" />}
                </div>

                {!isCollapsedDesktop && (
                  <div className="min-w-0">
                    <span className="font-black text-xs text-slate-900 block truncate">
                      {currentUser.name}
                    </span>
                    {roleBadge && (
                      <span className={`text-[10px] font-extrabold px-1.5 py-0.2 rounded-md inline-block ${roleBadge.badgeBg} ${roleBadge.badgeText}`}>
                        {roleBadge.label}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {!isCollapsedDesktop && (
                <div className="flex items-center gap-1 shrink-0">
                  {onRequestLogin && (
                    <button
                      type="button"
                      onClick={() => onRequestLogin(null)}
                      title="تغییر کاربر"
                      className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer"
                    >
                      <ArrowRightLeft className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {onLogout && (
                    <button
                      type="button"
                      onClick={onLogout}
                      title="خروج از حساب"
                      className="p-1.5 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              )}
            </div>
          ) : (
            onRequestLogin && (
              <button
                type="button"
                onClick={() => onRequestLogin(null)}
                className={`w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold flex items-center justify-center cursor-pointer transition-colors ${
                  isCollapsedDesktop ? 'h-9 px-0' : 'h-9 px-3 text-xs gap-1.5'
                }`}
                title="ورود کاربر"
              >
                <User className="w-4 h-4" />
                {!isCollapsedDesktop && <span>ورود کاربر</span>}
              </button>
            )
          )}
        </div>
      </aside>

      {/* ========================================================================= */}
      {/* 2. MOBILE SIDEBAR DRAWER (Shown when hamburger button is clicked)         */}
      {/* ========================================================================= */}
      {isOpenMobile && (
        <div 
          className="fixed inset-0 z-50 md:hidden flex"
          role="dialog"
          aria-modal="true"
          aria-label="منوی سایدبار موبایل"
        >
          {/* Animated Backdrop */}
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity duration-300 animate-in fade-in"
            onClick={onCloseMobile}
            aria-hidden="true"
          />

          {/* Drawer Content Panel (Slide in from right) */}
          <div className="relative w-72 sm:w-80 max-w-[85vw] h-full bg-white shadow-2xl flex flex-col z-10 transition-transform duration-300 ease-in-out animate-in slide-in-from-right">
            {/* Drawer Header */}
            <div className="p-4 border-b border-slate-100 flex items-center justify-between shrink-0 bg-slate-50/70">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-emerald-600 flex items-center justify-center text-white shadow-md shadow-emerald-200 shrink-0">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h2 className="font-black text-sm text-slate-800 truncate">
                    {safeSettings?.appName || safeSettings?.storeName || 'سیستم فاکتور'}
                  </h2>
                  <p className="text-[10px] text-slate-400 truncate">
                    منوی ناوبری و دسترسی به بخش‌ها
                  </p>
                </div>
              </div>

              <button
                type="button"
                id="btn-close-mobile-sidebar"
                onClick={onCloseMobile}
                className="w-8 h-8 rounded-xl bg-white border border-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-colors shadow-2xs cursor-pointer active:scale-95"
                title="بستن منو"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Current User Quick Banner */}
            {currentUser && (
              <div className="p-3 bg-gradient-to-r from-emerald-50/80 to-teal-50/60 border-b border-emerald-100 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-black text-xs shrink-0 shadow-2xs">
                    {currentUser.name ? currentUser.name.charAt(0) : <User className="w-4 h-4" />}
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs font-black text-slate-900 block truncate">
                      {currentUser.name}
                    </span>
                    {roleBadge && (
                      <span className={`text-[10px] font-extrabold px-1.5 py-0.2 rounded-md inline-block ${roleBadge.badgeBg} ${roleBadge.badgeText}`}>
                        {roleBadge.label}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  {onRequestLogin && (
                    <button
                      type="button"
                      onClick={() => {
                        onCloseMobile();
                        onRequestLogin(null);
                      }}
                      className="p-1.5 bg-white text-slate-600 hover:text-slate-900 rounded-lg border border-emerald-200 text-xs shadow-2xs cursor-pointer"
                      title="تعویض کاربر"
                    >
                      <ArrowRightLeft className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {onLogout && (
                    <button
                      type="button"
                      onClick={() => {
                        onCloseMobile();
                        onLogout();
                      }}
                      className="p-1.5 bg-white text-rose-600 hover:text-rose-800 rounded-lg border border-rose-200 text-xs shadow-2xs cursor-pointer"
                      title="خروج"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Fast Action: New Invoice Button */}
            {isTabPermitted('new-invoice', currentUser, safeSettings) && (
              <div className="p-3 shrink-0">
                <button
                  type="button"
                  id="mobile-drawer-new-invoice-btn"
                  onClick={() => {
                    onOpenNewInvoice();
                    onCloseMobile();
                  }}
                  className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-extrabold text-xs py-3 px-3.5 rounded-xl transition-all shadow-md shadow-emerald-600/20 active:scale-97 cursor-pointer flex items-center justify-center gap-2"
                >
                  <PlusCircle className="w-4 h-4 stroke-[2.5]" />
                  <span>+ صدور فاکتور جدید</span>
                </button>
              </div>
            )}

            {/* Navigation Links Scrollable List */}
            <div className="flex-1 overflow-y-auto p-3 space-y-1">
              <span className="px-2 text-[10px] font-black text-slate-400 uppercase tracking-wider block pb-1">
                دسترسی به بخش‌ها
              </span>

              {permittedNavItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                const isPrimaryAction = item.id === 'new-invoice';

                if (isPrimaryAction) return null; // already shown prominently above

                // Special handling for inventory tab in mobile drawer: render accordion with 5 sub-items
                if (item.id === 'inventory') {
                  return (
                    <div key={item.id} className="space-y-1">
                      <div
                        className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl text-right transition-all ${
                          isActive
                            ? 'bg-emerald-50 text-emerald-950 font-black border border-emerald-200 shadow-2xs'
                            : 'text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <div
                          onClick={() => {
                            if (activeTab !== 'inventory') {
                              setActiveTab('inventory');
                              setIsInventoryExpanded(true);
                            } else {
                              setIsInventoryExpanded(!isInventoryExpanded);
                            }
                          }}
                          className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
                        >
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                            isActive
                              ? 'bg-emerald-600 text-white shadow-2xs'
                              : 'bg-slate-100 text-slate-600'
                          }`}>
                            <Icon className="w-4 h-4 stroke-[2.2]" />
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-xs font-black truncate">
                                {item.label}
                              </span>
                              {item.badge && (
                                <span className="bg-amber-500 text-white text-[10px] font-bold rounded-full px-1.5 py-0.2 shrink-0">
                                  {item.badge}
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] text-slate-400 truncate mt-0.5 font-medium">
                              {item.description}
                            </p>
                          </div>
                        </div>

                        {/* Accordion Toggle Chevron Button */}
                        <button
                          type="button"
                          id="mobile-drawer-inventory-accordion-toggle"
                          onClick={(e) => {
                            e.stopPropagation();
                            setIsInventoryExpanded(!isInventoryExpanded);
                          }}
                          className="w-7 h-7 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 flex items-center justify-center transition-colors shrink-0 cursor-pointer"
                          title={isInventoryExpanded ? 'بستن زیرمجموعه‌ها' : 'مشاهده زیرمجموعه‌ها'}
                        >
                          {isInventoryExpanded ? (
                            <ChevronUp className="w-4 h-4 text-emerald-700" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-slate-500" />
                          )}
                        </button>
                      </div>

                      {/* Mobile Accordion Sub-items */}
                      {isInventoryExpanded && (
                        <div className="mr-3.5 pr-2.5 border-r-2 border-emerald-300/80 my-1 space-y-1 animate-in fade-in slide-in-from-top-1 duration-150">
                          {inventorySubItems.map((sub) => {
                            const isSubActive = activeTab === 'inventory' && (inventorySubTab || 'items') === sub.id;
                            const SubIcon = sub.icon;
                            return (
                              <button
                                key={sub.id}
                                type="button"
                                id={`mobile-drawer-subitem-${sub.id}`}
                                onClick={() => {
                                  setActiveTab('inventory');
                                  onSelectInventorySubTab?.(sub.id);
                                  onCloseMobile();
                                }}
                                className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-right transition-all cursor-pointer ${
                                  isSubActive
                                    ? 'bg-emerald-600 text-white font-black shadow-xs shadow-emerald-600/20 ring-1 ring-emerald-500'
                                    : 'text-slate-700 hover:bg-slate-100 font-medium'
                                }`}
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <SubIcon className={`w-3.5 h-3.5 shrink-0 ${
                                    isSubActive ? 'text-white' : 'text-slate-400'
                                  }`} />
                                  <span className="text-xs truncate">{sub.label}</span>
                                </div>
                                {sub.badge && (
                                  <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full shrink-0 ${
                                    isSubActive ? 'bg-white/20 text-white' : (sub.badgeClass || 'bg-amber-100 text-amber-800')
                                  }`}>
                                    {sub.badge}
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                }

                return (
                  <button
                    key={item.id}
                    type="button"
                    id={`mobile-drawer-item-${item.id}`}
                    onClick={item.onClick}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-right transition-all cursor-pointer ${
                      isActive
                        ? 'bg-emerald-50 text-emerald-950 font-black border border-emerald-200 shadow-2xs'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                      isActive
                        ? 'bg-emerald-600 text-white shadow-2xs'
                        : 'bg-slate-100 text-slate-600'
                    }`}>
                      <Icon className="w-4 h-4 stroke-[2.2]" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs font-black truncate">
                          {item.label}
                        </span>
                        {item.badge && (
                          <span className="bg-amber-500 text-white text-[10px] font-bold rounded-full px-1.5 py-0.2 shrink-0">
                            {item.badge}
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-400 truncate mt-0.5 font-medium">
                        {item.description}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Drawer Bottom Actions */}
            <div className="p-3 border-t border-slate-100 bg-slate-50/70 space-y-2 shrink-0">
              {/* Update Button (دکمه آپدیت برنامه در سایدبار موبایل) */}
              <button
                type="button"
                id="sidebar-btn-update-mobile"
                onClick={handleUpdateAppCache}
                disabled={isUpdatingApp}
                className="w-full flex items-center justify-between py-2.5 px-3.5 bg-gradient-to-r from-sky-50 to-blue-50/80 hover:from-sky-100 hover:to-blue-100 border border-sky-200 hover:border-sky-300 rounded-xl text-xs font-black text-sky-850 shadow-2xs cursor-pointer active:scale-95 transition-all"
                title="بروزرسانی برنامه و پاکسازی حافظه موقت (کش)"
              >
                <div className="flex items-center gap-2">
                  <RefreshCw className={`w-4 h-4 text-sky-600 shrink-0 ${isUpdatingApp ? 'animate-spin' : ''}`} />
                  <span>{isUpdatingApp ? 'در حال بروزرسانی و دریافت نسخه جدید...' : 'بروزرسانی برنامه'}</span>
                </div>
                <span className="text-[10px] bg-sky-600 text-white font-black px-2 py-0.5 rounded-lg shadow-2xs">
                  آپدیت
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onCloseMobile();
                  onOpenSettings();
                }}
                className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-white border border-slate-200 hover:border-slate-300 rounded-xl text-xs font-bold text-slate-700 shadow-2xs cursor-pointer active:scale-95 transition-all"
              >
                <Settings className="w-4 h-4 text-slate-500" />
                <span>تنظیمات سیستم</span>
              </button>

              <div className="flex items-center justify-center text-[10px] text-slate-400 px-1 pt-0.5">
                <span>{currentDate} - {currentTime}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
