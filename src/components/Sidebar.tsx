import React, { useEffect, useState, useRef } from 'react';
import { StoreSettings, AppUser } from '../types';
import { StorageService } from '../utils/storage';
import { toPersianDigits, getCurrentJalaliDate } from '../utils/jalali';
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
  X,
  User,
  LogOut,
  ArrowRightLeft,
  Settings,
  ShoppingCart,
  RefreshCw,
  Truck,
  History,
  ArrowDownRight,
} from 'lucide-react';

export type InventorySubTabKey =
  | 'items'
  | 'inbound-receipts'
  | 'exit-slips'
  | 'direct-transfers'
  | 'movements';

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

  const [isInventoryExpanded, setIsInventoryExpanded] = useState<boolean>(
    () => activeTab === 'inventory'
  );
  const [isInventoryFlyoutOpen, setIsInventoryFlyoutOpen] = useState(false);
  const [isUpdatingApp, setIsUpdatingApp] = useState(false);
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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpenMobile) {
        onCloseMobile();
      }
    };
    if (isOpenMobile) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpenMobile, onCloseMobile]);

  const inventorySubItems: Array<{
    id: InventorySubTabKey;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badgeCount?: number;
    badgeClass?: string;
  }> = [
    {
      id: 'items',
      label: 'کالاها و موجودی',
      icon: Boxes,
      badgeCount: lowStockCount > 0 ? lowStockCount : undefined,
      badgeClass: 'bg-amber-500 text-white',
    },
    {
      id: 'inbound-receipts',
      label: 'حواله‌های ورود کالا',
      icon: ArrowDownRight,
      badgeCount: pendingInboundCount > 0 ? pendingInboundCount : undefined,
      badgeClass: 'bg-rose-500 text-white',
    },
    {
      id: 'exit-slips',
      label: 'برگه‌های خروج انبار',
      icon: Truck,
    },
    {
      id: 'direct-transfers',
      label: 'امانی و تعمیرات (بدون فاکتور)',
      icon: ArrowRightLeft,
    },
    {
      id: 'movements',
      label: 'گردش و کاردکس انبار',
      icon: History,
    },
  ];

  const totalInventoryAlerts = lowStockCount + pendingInboundCount;

  const navSections = [
    {
      title: 'عملیات اصلی',
      items: [
        {
          id: 'dashboard',
          label: 'پیشخوان و داشبورد',
          icon: LayoutDashboard,
          enabled: isTabPermitted('dashboard', currentUser, safeSettings),
          badgeCount: undefined as number | undefined,
          onClick: () => {
            setActiveTab('dashboard');
            onCloseMobile();
          },
        },
        {
          id: 'invoices',
          label: 'لیست و مدیریت فاکتورها',
          icon: ReceiptText,
          enabled: isTabPermitted('invoices', currentUser, safeSettings),
          badgeCount: undefined as number | undefined,
          onClick: () => {
            setActiveTab('invoices');
            onCloseMobile();
          },
        },
        {
          id: 'purchases',
          label: 'فاکتورهای خرید کالا',
          icon: ShoppingCart,
          enabled: isTabPermitted('purchases', currentUser, safeSettings),
          badgeCount: undefined as number | undefined,
          onClick: () => {
            setActiveTab('purchases');
            onCloseMobile();
          },
        },
        {
          id: 'inventory',
          label: 'مدیریت انبار و کالا',
          icon: Boxes,
          enabled: isTabPermitted('inventory', currentUser, safeSettings),
          badgeCount: totalInventoryAlerts > 0 ? totalInventoryAlerts : undefined,
          onClick: () => {
            setActiveTab('inventory');
            onCloseMobile();
          },
        },
      ],
    },
    {
      title: 'حسابداری و تحلیل',
      items: [
        {
          id: 'customers',
          label: 'مشتریان و صورتحساب',
          icon: Users,
          enabled: isTabPermitted('customers', currentUser, safeSettings),
          badgeCount: undefined as number | undefined,
          onClick: () => {
            setActiveTab('customers');
            onCloseMobile();
          },
        },
        {
          id: 'reports',
          label: 'گزارشات و سود و زیان',
          icon: BarChart3,
          enabled: isTabPermitted('reports', currentUser, safeSettings),
          badgeCount: undefined as number | undefined,
          onClick: () => {
            setActiveTab('reports');
            onCloseMobile();
          },
        },
        {
          id: 'admin',
          label: 'پنل مدیریت و کاربران',
          icon: ShieldCheck,
          enabled: isTabPermitted('admin', currentUser, safeSettings),
          badgeCount: undefined as number | undefined,
          onClick: () => {
            setActiveTab('admin');
            onCloseMobile();
          },
        },
      ],
    },
  ];

  const roleBadge = currentUser?.role ? getRoleBadgeConfig(currentUser.role) : null;

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
      {/* 1. DESKTOP SIDEBAR (Compact, High-Density, Zero Unnecessary Scroll)        */}
      {/* ========================================================================= */}
      <aside
        id="desktop-sidebar"
        aria-label="سایدبار ناوبری اصلی"
        className={`no-print hidden md:flex flex-col bg-white border-l border-slate-200/80 h-screen sticky top-0 z-40 transition-all duration-200 ease-out shrink-0 select-none ${
          isCollapsedDesktop ? 'w-[68px]' : 'w-60'
        }`}
      >
        {/* Top Brand Header */}
        <div className="h-14 px-3 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              onClick={() => setActiveTab('dashboard')}
              className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-700 flex items-center justify-center text-white shadow-xs shrink-0 cursor-pointer hover:opacity-95 transition-opacity"
              title={safeSettings?.appName || safeSettings?.storeName || 'سیستم فاکتور و انبارداری'}
            >
              <FileSpreadsheet className="w-4 h-4 stroke-[2.2]" />
            </div>

            {!isCollapsedDesktop && (
              <div className="min-w-0 flex-1">
                <h1 className="font-black text-xs text-slate-800 truncate leading-tight">
                  {safeSettings?.appName || safeSettings?.storeName || 'فاکتورساز'}
                </h1>
                <p className="text-[10px] text-slate-400 truncate mt-0.5 font-medium">
                  {safeSettings?.storeName || 'فروش و انبارداری'}
                </p>
              </div>
            )}
          </div>

          <button
            type="button"
            id="btn-toggle-sidebar-collapse"
            onClick={onToggleCollapseDesktop}
            className="w-7 h-7 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer shrink-0"
            title={isCollapsedDesktop ? 'باز کردن سایدبار' : 'جمع کردن سایدبار'}
          >
            {isCollapsedDesktop ? (
              <ChevronLeft className="w-4 h-4 stroke-[2.2]" />
            ) : (
              <ChevronRight className="w-4 h-4 stroke-[2.2]" />
            )}
          </button>
        </div>

        {/* Primary CTA: صدور فاکتور جدید */}
        {isTabPermitted('new-invoice', currentUser, safeSettings) && (
          <div className="px-2.5 pt-2.5 pb-1.5 shrink-0">
            <button
              type="button"
              id="sidebar-btn-new-invoice"
              onClick={onOpenNewInvoice}
              className={`w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-all shadow-xs active:scale-98 cursor-pointer flex items-center justify-center gap-2 ${
                isCollapsedDesktop ? 'h-10 px-0' : 'h-10 px-3 text-xs'
              }`}
              title="صدور فاکتور جدید [F4]"
            >
              <PlusCircle className="w-4 h-4 shrink-0 stroke-[2.4]" />
              {!isCollapsedDesktop && <span className="truncate">صدور فاکتور جدید</span>}
            </button>
          </div>
        )}

        {/* Navigation Groups */}
        <div className="flex-1 overflow-y-auto px-2.5 py-1.5 space-y-3 scrollbar-thin scrollbar-thumb-slate-200">
          {navSections.map((section) => {
            const visibleItems = section.items.filter((it) => it.enabled);
            if (visibleItems.length === 0) return null;

            return (
              <div key={section.title} className="space-y-0.5">
                {!isCollapsedDesktop && (
                  <div className="px-2.5 pb-1 text-[10px] font-bold text-slate-400 tracking-wide">
                    {section.title}
                  </div>
                )}

                {visibleItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;

                  // Special Inventory Accordion / Flyout
                  if (item.id === 'inventory') {
                    if (isCollapsedDesktop) {
                      return (
                        <div key={item.id} className="relative" ref={flyoutRef}>
                          <button
                            type="button"
                            id="sidebar-item-inventory-collapsed"
                            onClick={() => {
                              item.onClick();
                              setIsInventoryFlyoutOpen((prev) => !prev);
                            }}
                            onMouseEnter={() => setIsInventoryFlyoutOpen(true)}
                            title={item.label}
                            className={`w-full flex items-center justify-center h-10 rounded-xl transition-all cursor-pointer relative ${
                              isActive
                                ? 'bg-emerald-50 text-emerald-700 font-bold border border-emerald-200/80'
                                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
                            }`}
                          >
                            {isActive && (
                              <span className="absolute right-0 top-2 bottom-2 w-1 bg-emerald-600 rounded-l-full" />
                            )}
                            <Icon className="w-4 h-4 stroke-[2.1]" />
                            {item.badgeCount && (
                              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-amber-500 rounded-full ring-2 ring-white" />
                            )}
                          </button>

                          {isInventoryFlyoutOpen && (
                            <div
                              onMouseLeave={() => setIsInventoryFlyoutOpen(false)}
                              className="absolute right-full top-0 mr-2 w-56 bg-white rounded-xl shadow-lg border border-slate-200 p-1.5 z-50 text-right"
                            >
                              <div className="px-2.5 py-1.5 border-b border-slate-100 mb-1 flex items-center justify-between">
                                <span className="text-xs font-extrabold text-slate-800">
                                  مدیریت انبار و کالا
                                </span>
                              </div>
                              <div className="space-y-0.5">
                                {inventorySubItems.map((sub) => {
                                  const isSubActive =
                                    activeTab === 'inventory' &&
                                    (inventorySubTab || 'items') === sub.id;
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
                                      className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-right text-xs transition-colors cursor-pointer ${
                                        isSubActive
                                          ? 'bg-emerald-600 text-white font-bold'
                                          : 'text-slate-700 hover:bg-slate-100'
                                      }`}
                                    >
                                      <div className="flex items-center gap-2 min-w-0">
                                        <SubIcon
                                          className={`w-3.5 h-3.5 shrink-0 ${
                                            isSubActive ? 'text-white' : 'text-slate-400'
                                          }`}
                                        />
                                        <span className="truncate">{sub.label}</span>
                                      </div>
                                      {sub.badgeCount && (
                                        <span
                                          className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full shrink-0 ${
                                            isSubActive
                                              ? 'bg-white/20 text-white'
                                              : sub.badgeClass || 'bg-amber-100 text-amber-800'
                                          }`}
                                        >
                                          {toPersianDigits(sub.badgeCount)}
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

                    return (
                      <div key={item.id} className="space-y-0.5">
                        <div
                          className={`w-full flex items-center justify-between rounded-xl transition-all relative px-2.5 py-2 text-right ${
                            isActive
                              ? 'bg-emerald-50/90 text-emerald-950 font-bold border border-emerald-200/70'
                              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70 font-medium'
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
                            <Icon
                              className={`w-4 h-4 shrink-0 ${
                                isActive ? 'text-emerald-600' : 'text-slate-500'
                              }`}
                            />
                            <span className="text-xs truncate flex-1">{item.label}</span>
                            {item.badgeCount && (
                              <span className="bg-amber-500 text-white text-[10px] font-bold rounded-full px-1.5 py-0.2 shrink-0 tabular-nums">
                                {toPersianDigits(item.badgeCount)}
                              </span>
                            )}
                          </div>

                          <button
                            type="button"
                            id="sidebar-inventory-accordion-toggle"
                            onClick={(e) => {
                              e.stopPropagation();
                              setIsInventoryExpanded(!isInventoryExpanded);
                            }}
                            className="w-5 h-5 rounded-md text-slate-400 hover:text-slate-700 flex items-center justify-center transition-transform shrink-0 cursor-pointer mr-1"
                            title={isInventoryExpanded ? 'بستن زیرمنو' : 'باز کردن زیرمنو'}
                          >
                            <ChevronDown
                              className={`w-3.5 h-3.5 transition-transform duration-200 ${
                                isInventoryExpanded ? 'rotate-180 text-emerald-700' : ''
                              }`}
                            />
                          </button>
                        </div>

                        {isInventoryExpanded && (
                          <div className="mr-3.5 pr-2 border-r border-slate-200 space-y-0.5 py-0.5">
                            {inventorySubItems.map((sub) => {
                              const isSubActive =
                                activeTab === 'inventory' &&
                                (inventorySubTab || 'items') === sub.id;
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
                                  className={`w-full flex items-center justify-between gap-1.5 px-2.5 py-1.5 rounded-lg text-right transition-colors cursor-pointer text-[11px] ${
                                    isSubActive
                                      ? 'bg-emerald-600 text-white font-bold shadow-2xs'
                                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80 font-medium'
                                  }`}
                                >
                                  <div className="flex items-center gap-2 min-w-0">
                                    <SubIcon
                                      className={`w-3.5 h-3.5 shrink-0 ${
                                        isSubActive ? 'text-white' : 'text-slate-400'
                                      }`}
                                    />
                                    <span className="truncate">{sub.label}</span>
                                  </div>
                                  {sub.badgeCount && (
                                    <span
                                      className={`text-[10px] font-bold px-1.5 rounded-full shrink-0 tabular-nums ${
                                        isSubActive
                                          ? 'bg-white/25 text-white'
                                          : sub.badgeClass || 'bg-amber-100 text-amber-800'
                                      }`}
                                    >
                                      {toPersianDigits(sub.badgeCount)}
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

                  // Standard Single-Line Nav Item
                  return (
                    <button
                      key={item.id}
                      type="button"
                      id={`sidebar-item-${item.id}`}
                      onClick={item.onClick}
                      title={isCollapsedDesktop ? item.label : undefined}
                      className={`w-full flex items-center rounded-xl transition-all cursor-pointer relative ${
                        isCollapsedDesktop
                          ? 'justify-center h-10 px-0'
                          : 'gap-2.5 px-2.5 py-2 text-right'
                      } ${
                        isActive
                          ? 'bg-emerald-50/90 text-emerald-950 font-bold border border-emerald-200/70'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70 font-medium'
                      }`}
                    >
                      {isActive && (
                        <span className="absolute right-0 top-2 bottom-2 w-1 bg-emerald-600 rounded-l-full" />
                      )}

                      <Icon
                        className={`w-4 h-4 shrink-0 ${
                          isActive ? 'text-emerald-600' : 'text-slate-500'
                        }`}
                      />

                      {!isCollapsedDesktop && (
                        <span className="text-xs truncate flex-1">{item.label}</span>
                      )}

                      {!isCollapsedDesktop && item.badgeCount && (
                        <span className="bg-amber-500 text-white text-[10px] font-bold rounded-full px-1.5 py-0.2 shrink-0 tabular-nums">
                          {toPersianDigits(item.badgeCount)}
                        </span>
                      )}

                      {isCollapsedDesktop && item.badgeCount && (
                        <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-amber-500 rounded-full ring-2 ring-white" />
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>

        {/* Consolidated Footer: Quick Tools Row + User Bar */}
        <div className="p-2.5 border-t border-slate-100 bg-slate-50/50 shrink-0 space-y-2">
          {/* Compact 2-Column Utility Row (Settings + Update) */}
          <div
            className={`grid gap-1.5 ${
              isCollapsedDesktop ? 'grid-cols-1' : 'grid-cols-2'
            }`}
          >
            <button
              type="button"
              id="sidebar-btn-settings"
              onClick={onOpenSettings}
              className="flex items-center justify-center gap-1.5 h-8 px-2 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-200/80 text-[11px] font-bold transition-colors cursor-pointer"
              title="تنظیمات سیستم"
            >
              <Settings className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              {!isCollapsedDesktop && <span className="truncate">تنظیمات</span>}
            </button>

            <button
              type="button"
              id="sidebar-btn-update-desktop"
              onClick={handleUpdateAppCache}
              disabled={isUpdatingApp}
              className="flex items-center justify-center gap-1.5 h-8 px-2 rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-200/80 text-[11px] font-bold transition-colors cursor-pointer"
              title="بروزرسانی برنامه و نوسازی کش"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 text-sky-600 shrink-0 ${
                  isUpdatingApp ? 'animate-spin' : ''
                }`}
              />
              {!isCollapsedDesktop && (
                <span className="truncate">{isUpdatingApp ? 'در حال آپدیت' : 'آپدیت'}</span>
              )}
            </button>
          </div>

          {/* User Profile Bar */}
          {currentUser ? (
            <div
              className={`rounded-xl bg-white border border-slate-200/80 p-1.5 flex items-center ${
                isCollapsedDesktop ? 'justify-center' : 'justify-between gap-2'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs shrink-0">
                  {currentUser.name ? currentUser.name.charAt(0) : <User className="w-3.5 h-3.5" />}
                </div>

                {!isCollapsedDesktop && (
                  <div className="min-w-0">
                    <span className="font-bold text-[11px] text-slate-800 block truncate leading-tight">
                      {currentUser.name}
                    </span>
                    {roleBadge && (
                      <span
                        className={`text-[9px] font-bold px-1.5 py-0.2 rounded inline-block mt-0.5 ${roleBadge.badgeBg} ${roleBadge.badgeText}`}
                      >
                        {roleBadge.label}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {!isCollapsedDesktop && (
                <div className="flex items-center gap-0.5 shrink-0">
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
                  isCollapsedDesktop ? 'h-8 px-0' : 'h-8 px-3 text-xs gap-1.5'
                }`}
                title="ورود کاربر"
              >
                <User className="w-3.5 h-3.5" />
                {!isCollapsedDesktop && <span>ورود کاربر</span>}
              </button>
            )
          )}
        </div>
      </aside>

      {/* ========================================================================= */}
      {/* 2. MOBILE SIDEBAR DRAWER                                                  */}
      {/* ========================================================================= */}
      {isOpenMobile && (
        <div
          className="fixed inset-0 z-50 md:hidden flex"
          role="dialog"
          aria-modal="true"
          aria-label="منوی سایدبار موبایل"
        >
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
            onClick={onCloseMobile}
            aria-hidden="true"
          />

          <div className="relative w-72 max-w-[85vw] h-full bg-white shadow-2xl flex flex-col z-10">
            {/* Drawer Header */}
            <div className="h-14 px-4 border-b border-slate-100 flex items-center justify-between shrink-0 bg-slate-50/70">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-emerald-600 flex items-center justify-center text-white shrink-0">
                  <FileSpreadsheet className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h2 className="font-black text-xs text-slate-800 truncate">
                    {safeSettings?.appName || safeSettings?.storeName || 'سیستم فاکتور'}
                  </h2>
                  <p className="text-[10px] text-slate-400 truncate">
                    {toPersianDigits(currentDate)}
                  </p>
                </div>
              </div>

              <button
                type="button"
                id="btn-close-mobile-sidebar"
                onClick={onCloseMobile}
                className="w-8 h-8 rounded-xl bg-white border border-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center cursor-pointer"
                title="بستن منو"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Fast Action: New Invoice Button */}
            {isTabPermitted('new-invoice', currentUser, safeSettings) && (
              <div className="p-3 pb-1 shrink-0">
                <button
                  type="button"
                  id="mobile-drawer-new-invoice-btn"
                  onClick={() => {
                    onOpenNewInvoice();
                    onCloseMobile();
                  }}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-2.5 px-3.5 rounded-xl transition-all shadow-xs cursor-pointer flex items-center justify-center gap-2"
                >
                  <PlusCircle className="w-4 h-4 stroke-[2.4]" />
                  <span>صدور فاکتور جدید</span>
                </button>
              </div>
            )}

            {/* Navigation Links */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {navSections.map((section) => {
                const visibleItems = section.items.filter((it) => it.enabled);
                if (visibleItems.length === 0) return null;

                return (
                  <div key={section.title} className="space-y-1">
                    <span className="px-2 text-[10px] font-bold text-slate-400 block">
                      {section.title}
                    </span>

                    {visibleItems.map((item) => {
                      const Icon = item.icon;
                      const isActive = activeTab === item.id;

                      if (item.id === 'inventory') {
                        return (
                          <div key={item.id} className="space-y-1">
                            <div
                              className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-right transition-all ${
                                isActive
                                  ? 'bg-emerald-50 text-emerald-950 font-bold border border-emerald-200'
                                  : 'text-slate-700 hover:bg-slate-50 font-medium'
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
                                className="flex items-center gap-2.5 flex-1 min-w-0 cursor-pointer"
                              >
                                <Icon
                                  className={`w-4 h-4 shrink-0 ${
                                    isActive ? 'text-emerald-600' : 'text-slate-500'
                                  }`}
                                />
                                <span className="text-xs truncate flex-1">{item.label}</span>
                                {item.badgeCount && (
                                  <span className="bg-amber-500 text-white text-[10px] font-bold rounded-full px-1.5 py-0.2 shrink-0">
                                    {toPersianDigits(item.badgeCount)}
                                  </span>
                                )}
                              </div>

                              <button
                                type="button"
                                id="mobile-drawer-inventory-accordion-toggle"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setIsInventoryExpanded(!isInventoryExpanded);
                                }}
                                className="w-6 h-6 rounded-lg text-slate-400 hover:text-slate-700 flex items-center justify-center shrink-0 cursor-pointer"
                              >
                                <ChevronDown
                                  className={`w-4 h-4 transition-transform ${
                                    isInventoryExpanded ? 'rotate-180 text-emerald-700' : ''
                                  }`}
                                />
                              </button>
                            </div>

                            {isInventoryExpanded && (
                              <div className="mr-3.5 pr-2.5 border-r border-slate-200 space-y-0.5">
                                {inventorySubItems.map((sub) => {
                                  const isSubActive =
                                    activeTab === 'inventory' &&
                                    (inventorySubTab || 'items') === sub.id;
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
                                      className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-right text-xs transition-all cursor-pointer ${
                                        isSubActive
                                          ? 'bg-emerald-600 text-white font-bold'
                                          : 'text-slate-600 hover:bg-slate-100 font-medium'
                                      }`}
                                    >
                                      <div className="flex items-center gap-2 min-w-0">
                                        <SubIcon
                                          className={`w-3.5 h-3.5 shrink-0 ${
                                            isSubActive ? 'text-white' : 'text-slate-400'
                                          }`}
                                        />
                                        <span className="truncate">{sub.label}</span>
                                      </div>
                                      {sub.badgeCount && (
                                        <span
                                          className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full shrink-0 ${
                                            isSubActive
                                              ? 'bg-white/20 text-white'
                                              : sub.badgeClass || 'bg-amber-100 text-amber-800'
                                          }`}
                                        >
                                          {toPersianDigits(sub.badgeCount)}
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
                          className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-right transition-all cursor-pointer ${
                            isActive
                              ? 'bg-emerald-50 text-emerald-950 font-bold border border-emerald-200'
                              : 'text-slate-700 hover:bg-slate-50 font-medium'
                          }`}
                        >
                          <Icon
                            className={`w-4 h-4 shrink-0 ${
                              isActive ? 'text-emerald-600' : 'text-slate-500'
                            }`}
                          />
                          <span className="text-xs truncate flex-1">{item.label}</span>
                          {item.badgeCount && (
                            <span className="bg-amber-500 text-white text-[10px] font-bold rounded-full px-1.5 py-0.2 shrink-0">
                              {toPersianDigits(item.badgeCount)}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>

            {/* Mobile Drawer Footer */}
            <div className="p-3 border-t border-slate-100 bg-slate-50/70 space-y-2 shrink-0">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    onCloseMobile();
                    onOpenSettings();
                  }}
                  className="flex items-center justify-center gap-1.5 py-2 px-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 cursor-pointer"
                >
                  <Settings className="w-3.5 h-3.5 text-slate-500" />
                  <span>تنظیمات</span>
                </button>

                <button
                  type="button"
                  id="sidebar-btn-update-mobile"
                  onClick={handleUpdateAppCache}
                  disabled={isUpdatingApp}
                  className="flex items-center justify-center gap-1.5 py-2 px-2.5 bg-sky-50 border border-sky-200 rounded-xl text-xs font-bold text-sky-800 cursor-pointer"
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 text-sky-600 shrink-0 ${
                      isUpdatingApp ? 'animate-spin' : ''
                    }`}
                  />
                  <span>{isUpdatingApp ? 'در حال آپدیت' : 'آپدیت برنامه'}</span>
                </button>
              </div>

              {currentUser && (
                <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
                      {currentUser.name ? currentUser.name.charAt(0) : <User className="w-3.5 h-3.5" />}
                    </div>
                    <div className="min-w-0">
                      <span className="text-xs font-bold text-slate-900 block truncate">
                        {currentUser.name}
                      </span>
                      {roleBadge && (
                        <span
                          className={`text-[9px] font-bold px-1.5 rounded inline-block ${roleBadge.badgeBg} ${roleBadge.badgeText}`}
                        >
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
                        className="p-1.5 text-slate-500 hover:bg-slate-100 rounded-lg cursor-pointer"
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
                        className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg cursor-pointer"
                        title="خروج"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
