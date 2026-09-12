import React, { useState, useRef, useEffect } from 'react';
import { StoreSettings, AppUser } from '../types';
import { StorageService, ROLE_LABELS } from '../utils/storage';
import { getCurrentJalaliDate, getCurrentJalaliTime } from '../utils/jalali';
import { isTabPermitted, getRoleBadgeConfig } from '../utils/permissions';
import { 
  ReceiptText, 
  Boxes, 
  Users, 
  BarChart3, 
  PlusCircle, 
  FileSpreadsheet,
  ShieldCheck,
  Menu,
  ChevronDown,
  Check,
  X,
  User,
  UserCheck,
  ArrowRightLeft,
  KeyRound,
  Lock,
  LogIn,
  LogOut,
  ShoppingCart
} from 'lucide-react';

interface HeaderProps {
  settings?: StoreSettings;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  lowStockCount: number;
  currentUser?: AppUser;
  users?: AppUser[];
  onSwitchUser?: (user: AppUser) => void;
  onRequestLogin?: (targetUser?: AppUser | null) => void;
  onLogout?: () => void;
  onOpenNewInvoice: () => void;
  onOpenSettings: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  settings,
  activeTab,
  setActiveTab,
  lowStockCount,
  currentUser,
  users = [],
  onSwitchUser,
  onRequestLogin,
  onLogout,
  onOpenNewInvoice,
  onOpenSettings,
}) => {
  const safeSettings = settings || StorageService.getSettings();
  const currentDate = getCurrentJalaliDate();
  const currentTime = getCurrentJalaliTime();

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Close menus on click outside or escape key
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsMenuOpen(false);
        setIsUserMenuOpen(false);
      }
    };

    if (isMenuOpen || isUserMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMenuOpen, isUserMenuOpen]);

  const allNavItems = [
    { 
      id: 'new-invoice', 
      label: 'صدور فاکتور جدید', 
      description: 'ثبت سریع فاکتور فروشگاهی، رسمی یا حرارتی',
      icon: PlusCircle, 
      isPrimary: true, 
      enabled: isTabPermitted('new-invoice', currentUser, safeSettings),
      onClick: () => {
        onOpenNewInvoice();
        setIsMenuOpen(false);
      }
    },
    { 
      id: 'invoices', 
      label: 'لیست فاکتورها', 
      description: 'مشاهده، چاپ، اشتراک‌گذاری و جستجوی فاکتورها',
      icon: ReceiptText, 
      enabled: isTabPermitted('invoices', currentUser, safeSettings),
      onClick: () => {
        setActiveTab('invoices');
        setIsMenuOpen(false);
      }
    },
    { 
      id: 'purchases', 
      label: 'فاکتورهای خرید', 
      description: 'ثبت فاکتور خرید کالا، تامین‌کنندگان و ورود به انبار',
      icon: ShoppingCart, 
      enabled: isTabPermitted('purchases', currentUser, safeSettings),
      onClick: () => {
        setActiveTab('purchases');
        setIsMenuOpen(false);
      }
    },
    { 
      id: 'inventory', 
      label: 'مدیریت انبار و کالا', 
      description: 'کنترل موجودی، بارکد، کاردکس و گردش کالاها',
      icon: Boxes, 
      badge: lowStockCount > 0 ? lowStockCount : undefined,
      enabled: isTabPermitted('inventory', currentUser, safeSettings),
      onClick: () => {
        setActiveTab('inventory');
        setIsMenuOpen(false);
      }
    },
    { 
      id: 'customers', 
      label: 'مشتریان', 
      description: 'پرونده مشتریان، سابقه خرید و مانده‌حساب',
      icon: Users,
      enabled: isTabPermitted('customers', currentUser, safeSettings),
      onClick: () => {
        setActiveTab('customers');
        setIsMenuOpen(false);
      }
    },
    { 
      id: 'reports', 
      label: 'گزارشات و سود', 
      description: 'آمار مالی، سود ناخالص و کالاهای پرفروش',
      icon: BarChart3,
      enabled: isTabPermitted('reports', currentUser, safeSettings),
      onClick: () => {
        setActiveTab('reports');
        setIsMenuOpen(false);
      }
    },
    { 
      id: 'admin', 
      label: 'پنل مدیریت', 
      description: 'تنظیمات جامع سیستم، کاربران و پشتیبان‌گیری',
      icon: ShieldCheck, 
      enabled: isTabPermitted('admin', currentUser, safeSettings),
      onClick: () => {
        setActiveTab('admin');
        setIsMenuOpen(false);
      }
    },
  ];

  const navItems = allNavItems.filter(item => item.enabled);
  const currentActiveItem = navItems.find(item => item.id === activeTab) || navItems[0];
  const ActiveIcon = currentActiveItem?.icon || Menu;

  return (
    <header className="no-print bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-3">
          {/* Logo & Store Info */}
          <div className="flex items-center gap-3 min-w-0" title={safeSettings?.storeName || 'سیستم فاکتور و انبارداری'}>
            <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white shadow-md shadow-emerald-200 shrink-0">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div className="hidden sm:block min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="font-extrabold text-base sm:text-lg text-slate-800 tracking-tight truncate">
                  {safeSettings?.appName || safeSettings?.storeName || 'سیستم فاکتور و انبارداری'}
                </h1>
                {safeSettings?.showStoreEditionBadge !== false && (
                  <span className="hidden md:inline-block text-[11px] font-semibold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                    نسخه فروشگاهی
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 hidden lg:block truncate">
                {safeSettings?.tagline || 'صدور فاکتور رسمی و کنترل بلادرنگ موجودی انبار'}
              </p>
            </div>
          </div>

          {/* Center / Action Area: The Unified Menu Button */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Unified Menu Button & Dropdown */}
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                id="header-unified-menu-btn"
                onClick={() => setIsMenuOpen(prev => !prev)}
                title={`بخش جاری: ${currentActiveItem?.label}`}
                className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-2 rounded-xl text-sm font-bold transition-all cursor-pointer border ${
                  isMenuOpen
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-200 ring-2 ring-emerald-200'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-800 border-slate-200/90 shadow-xs hover:border-slate-300'
                }`}
                aria-expanded={isMenuOpen}
                aria-haspopup="true"
              >
                <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${
                  isMenuOpen ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-700'
                }`}>
                  <ActiveIcon className="w-4 h-4" />
                </div>
                
                <div className="hidden sm:flex items-center gap-1.5">
                  <span className="text-xs font-medium text-slate-500 hidden md:inline">
                    بخش جاری:
                  </span>
                  <span className={`${isMenuOpen ? 'text-white' : 'text-slate-900'} font-bold`}>
                    {currentActiveItem?.label}
                  </span>
                </div>

                {/* Badge if inventory has low stock alerts */}
                {lowStockCount > 0 && (
                  <span 
                    title={`${lowStockCount} قلم کالای کم‌موجود`}
                    className={`text-[11px] font-black rounded-full px-1.5 py-0.5 flex items-center justify-center leading-none ${
                      isMenuOpen ? 'bg-amber-400 text-slate-950' : 'bg-amber-500 text-white'
                    }`}
                  >
                    {lowStockCount}
                  </span>
                )}

                <ChevronDown className={`w-3.5 h-3.5 sm:w-4 sm:h-4 transition-transform duration-200 ${
                  isMenuOpen ? 'rotate-180 text-white' : 'text-slate-400'
                }`} />
              </button>

              {/* Dropdown Menu Container */}
              {isMenuOpen && (
                <div
                  id="header-dropdown-popover"
                  className="absolute left-0 sm:left-auto sm:right-0 mt-2 w-72 sm:w-80 bg-white rounded-2xl shadow-2xl border border-slate-200 p-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150"
                  role="menu"
                >
                  <div className="px-3 py-2 border-b border-slate-100 flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-slate-800 block">
                        منوی بخش‌های سیستم
                      </span>
                      <span className="text-[10px] text-slate-400">
                        جهت جابجایی بین قسمت‌ها کلیک کنید
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsMenuOpen(false)}
                      className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
                      title="بستن منو"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="py-1 space-y-1 max-h-[calc(100vh-140px)] overflow-y-auto">
                    {navItems.map((item) => {
                      const Icon = item.icon;
                      const isActive = activeTab === item.id;
                      const isPrimaryAction = item.id === 'new-invoice';

                      return (
                        <button
                          key={item.id}
                          id={`dropdown-menu-item-${item.id}`}
                          type="button"
                          onClick={item.onClick}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-right transition-all cursor-pointer group ${
                            isActive
                              ? 'bg-emerald-50 text-emerald-900 border border-emerald-200 font-semibold shadow-xs'
                              : isPrimaryAction
                              ? 'bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-800'
                              : 'text-slate-700 hover:bg-slate-100/80 hover:text-slate-900'
                          }`}
                          role="menuitem"
                        >
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                            isActive
                              ? 'bg-emerald-600 text-white'
                              : isPrimaryAction
                              ? 'bg-emerald-600 text-white'
                              : 'bg-slate-100 text-slate-600 group-hover:bg-slate-200 group-hover:text-slate-900'
                          }`}>
                            <Icon className="w-4 h-4" />
                          </div>

                          <div className="flex-1 min-w-0 text-right">
                            <div className="flex items-center justify-between gap-1">
                              <span className={`text-xs font-bold ${
                                isActive ? 'text-emerald-900' : 'text-slate-800'
                              }`}>
                                {item.label}
                              </span>
                              {item.badge !== undefined && (
                                <span className="bg-amber-500 text-white text-[10px] font-black rounded-full px-1.5 py-0.2 shrink-0">
                                  {item.badge} هشدار
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] text-slate-400 truncate mt-0.5">
                              {item.description}
                            </p>
                          </div>

                          {isActive && (
                            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Current Date & Clock (on wider screens) */}
            {safeSettings?.showHeaderClock !== false && (
              <div className="hidden xl:flex flex-col items-end text-xs text-slate-500 bg-slate-50 border border-slate-200/80 px-3 py-1.5 rounded-lg">
                <span className="font-medium text-slate-700">امروز: {currentDate}</span>
                <span>ساعت: {currentTime}</span>
              </div>
            )}

            {/* User Profile / Switcher Dropdown */}
            {currentUser && (
              <div className="relative" ref={userMenuRef}>
                <button
                  type="button"
                  id="header-user-switcher-btn"
                  onClick={() => setIsUserMenuOpen((p) => !p)}
                  className={`flex items-center gap-1.5 sm:gap-2 px-2 sm:px-2.5 py-1.5 rounded-xl border text-xs transition-all cursor-pointer ${
                    isUserMenuOpen
                      ? 'bg-slate-100 border-slate-300 ring-2 ring-slate-200'
                      : 'bg-slate-50 hover:bg-slate-100/90 border-slate-200/90 text-slate-800'
                  }`}
                  title={`کاربر: ${currentUser.fullName} (${currentUser.roleTitle || ROLE_LABELS[currentUser.role]})`}
                >
                  <div
                    className={`w-7 h-7 rounded-lg ${
                      currentUser.role === 'admin'
                        ? 'bg-emerald-600'
                        : currentUser.role === 'cashier'
                        ? 'bg-blue-600'
                        : currentUser.role === 'warehouse'
                        ? 'bg-amber-600'
                        : 'bg-purple-600'
                    } text-white flex items-center justify-center font-bold text-xs shrink-0`}
                  >
                    <User className="w-4 h-4 sm:hidden" />
                    <span className="hidden sm:inline">{currentUser.fullName.slice(0, 2)}</span>
                  </div>
                  <div className="hidden md:flex flex-col text-right leading-tight min-w-0 max-w-[130px]">
                    <span className="font-bold text-slate-800 truncate text-[11px]">
                      {currentUser.fullName}
                    </span>
                    <span className="text-[10px] text-slate-500 truncate">
                      {currentUser.roleTitle || ROLE_LABELS[currentUser.role]}
                    </span>
                  </div>
                  <ChevronDown
                    className={`w-3 h-3 sm:w-3.5 sm:h-3.5 transition-transform text-slate-400 shrink-0 ${
                      isUserMenuOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {/* User Dropdown Menu */}
                {isUserMenuOpen && (
                  <div
                    id="header-user-dropdown-popover"
                    className="absolute left-0 mt-2 w-72 bg-white rounded-2xl shadow-2xl border border-slate-200 p-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150 text-right"
                  >
                    {/* Active User Header */}
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 mb-2">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] text-slate-400 font-medium">حساب کاربری فعال فعلی</span>
                        <span className="text-[10px] font-bold px-1.5 py-0.2 bg-emerald-100 text-emerald-800 rounded-md">
                          آنلاین
                        </span>
                      </div>
                      <div className="font-bold text-xs text-slate-900">{currentUser.fullName}</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        سمت: {currentUser.roleTitle || ROLE_LABELS[currentUser.role]} (@{currentUser.username})
                      </div>
                    </div>

                    {currentUser.role === 'admin' ? (
                      <>
                        {/* Switch User List for Admin */}
                        <div className="px-2 py-1 text-[11px] font-bold text-slate-400 flex items-center justify-between">
                          <span>لیست کاربران (دسترسی مدیریت):</span>
                          <span className="text-[10px] text-emerald-600 bg-emerald-50 px-1 rounded">ورود با رمز</span>
                        </div>
                        <div className="space-y-1 max-h-48 overflow-y-auto py-1">
                          {users.map((u) => {
                            const isCurrent = u.id === currentUser.id;
                            return (
                              <button
                                key={u.id}
                                type="button"
                                disabled={isCurrent || !u.isActive}
                                onClick={() => {
                                  if (onRequestLogin) {
                                    onRequestLogin(u);
                                  } else if (onSwitchUser) {
                                    onSwitchUser(u);
                                  }
                                  setIsUserMenuOpen(false);
                                }}
                                className={`w-full flex items-center justify-between p-2 rounded-xl text-xs transition-all ${
                                  isCurrent
                                    ? 'bg-emerald-50 text-emerald-900 border border-emerald-200 font-bold'
                                    : !u.isActive
                                    ? 'text-slate-400 bg-slate-50 opacity-60 cursor-not-allowed'
                                    : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900 cursor-pointer'
                                }`}
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <div
                                    className={`w-6 h-6 rounded-md ${
                                      u.role === 'admin'
                                        ? 'bg-emerald-600'
                                        : u.role === 'cashier'
                                        ? 'bg-blue-600'
                                        : u.role === 'warehouse'
                                        ? 'bg-amber-600'
                                        : 'bg-purple-600'
                                    } text-white flex items-center justify-center font-bold text-[10px] shrink-0`}
                                  >
                                    {u.fullName.slice(0, 1)}
                                  </div>
                                  <div className="min-w-0 text-right">
                                    <span className="block truncate font-medium">{u.fullName}</span>
                                    <span className="text-[9px] text-slate-400 block truncate">
                                      {u.roleTitle || ROLE_LABELS[u.role]}
                                    </span>
                                  </div>
                                </div>
                                {isCurrent ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                ) : (
                                  <Lock className="w-3 h-3 text-slate-400 shrink-0" />
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </>
                    ) : (
                      /* Non-Admin View: No other user names are shown! */
                      <div className="p-3 bg-slate-50/90 rounded-xl border border-slate-200/70 text-center my-1">
                        <div className="flex items-center justify-center gap-1.5 text-[11px] font-bold text-slate-700 mb-1">
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                          <span>حالت کاربری امن و اختصاصی</span>
                        </div>
                        <p className="text-[10px] text-slate-400 leading-relaxed">
                          جهت حفظ امنیت و محرمانگی، اسامی سایر کاربران برای شما نمایش داده نمی‌شود.
                        </p>
                      </div>
                    )}

                    {/* Login with another account button & Logout */}
                    <div className="pt-2 border-t border-slate-100 mt-1 space-y-1.5">
                      <button
                        type="button"
                        id="header-switch-with-password-btn"
                        onClick={() => {
                          setIsUserMenuOpen(false);
                          if (onRequestLogin) {
                            onRequestLogin(null);
                          }
                        }}
                        className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
                      >
                        <LogIn className="w-3.5 h-3.5 text-emerald-600" />
                        <span>تغییر حساب کاربری با رمز</span>
                      </button>

                      {/* Explicit Logout Button */}
                      <button
                        type="button"
                        id="header-logout-btn"
                        onClick={() => {
                          setIsUserMenuOpen(false);
                          if (onLogout) {
                            onLogout();
                          }
                        }}
                        className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-colors cursor-pointer"
                      >
                        <LogOut className="w-3.5 h-3.5 text-rose-600" />
                        <span>خروج از حساب و قفل برنامه</span>
                      </button>

                      {/* Direct link to Users management if admin */}
                      {currentUser.role === 'admin' && currentUser.permissions.canManageUsers && (
                        <button
                          type="button"
                          id="header-user-manage-btn"
                          onClick={() => {
                            setActiveTab('admin');
                            setIsUserMenuOpen(false);
                          }}
                          className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition-colors cursor-pointer"
                        >
                          <UserCheck className="w-3.5 h-3.5" />
                          <span>مدیریت و تعریف کاربران و رمزها</span>
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Quick Primary New Invoice Action Button */}
            {(!currentUser || currentUser.permissions.canCreateInvoice) && (
              <button
                type="button"
                id="header-new-invoice-btn"
                onClick={onOpenNewInvoice}
                title="صدور فاکتور جدید"
                aria-label="صدور فاکتور جدید"
                className="flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white px-2.5 sm:px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold shadow-sm shadow-emerald-200 transition-all cursor-pointer"
              >
                <PlusCircle className="w-4 h-4" />
                <span className="hidden sm:inline">فاکتور جدید</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

