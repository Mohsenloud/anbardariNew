import React, { useState, useRef, useEffect } from 'react';
import { StoreSettings, AppUser } from '../types';
import { StorageService, ROLE_LABELS } from '../utils/storage';
import { getCurrentJalaliDate, getCurrentJalaliTime } from '../utils/jalali';
import { isTabPermitted, getRoleBadgeConfig } from '../utils/permissions';
import { 
  LayoutDashboard,
  ReceiptText, 
  Boxes, 
  Users, 
  BarChart3, 
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
  onToggleSidebar?: () => void;
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
  onToggleSidebar,
}) => {
  const safeSettings = settings || StorageService.getSettings();
  const currentDate = getCurrentJalaliDate();
  const currentTime = getCurrentJalaliTime();

  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Close user menu on click outside or escape key
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsUserMenuOpen(false);
      }
    };

    if (isUserMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isUserMenuOpen]);

  return (
    <header className={`no-print bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs ${activeTab === 'new-invoice' ? 'hidden lg:block' : ''}`}>
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-2 sm:gap-3">
          {/* Right Section: Hamburger Button + Logo & Store Info */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            {/* Mobile & Quick Hamburger Button (دکمه همبرگری سایدبار) */}
            <button
              type="button"
              id="header-hamburger-btn"
              onClick={onToggleSidebar}
              title="باز کردن منوی سایدبار برنامه"
              aria-label="دکمه همبرگری منوی سایدبار"
              className="flex items-center justify-center w-10 h-10 rounded-xl bg-slate-100 hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 active:scale-95 transition-all cursor-pointer border border-slate-200/90 shadow-2xs shrink-0"
            >
              <Menu className="w-5 h-5 stroke-[2.3]" />
            </button>

            {/* Logo & Store Info */}
            <div 
              onClick={() => setActiveTab('dashboard')}
              className="flex items-center gap-2.5 min-w-0 cursor-pointer" 
              title={safeSettings?.storeName || 'سیستم فاکتور و انبارداری'}
            >
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white shadow-md shadow-emerald-200 shrink-0">
                <FileSpreadsheet className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <h1 className="font-extrabold text-sm sm:text-base md:text-lg text-slate-800 tracking-tight truncate">
                    {safeSettings?.appName || safeSettings?.storeName || 'سیستم فاکتور و انبارداری'}
                  </h1>
                  {safeSettings?.showStoreEditionBadge !== false && (
                    <span className="hidden sm:inline-block text-[10px] sm:text-[11px] font-semibold px-1.5 sm:px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                      نسخه فروشگاهی
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-400 hidden md:block truncate">
                  {safeSettings?.tagline || 'صدور فاکتور رسمی و کنترل بلادرنگ موجودی انبار'}
                </p>
              </div>
            </div>
          </div>

          {/* Left Action Area: Clock & User Switcher */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Current Date & Clock (on wider screens) */}
            {safeSettings?.showHeaderClock !== false && (
              <div className="hidden xl:flex flex-col items-end text-xs text-slate-500 bg-slate-50 border border-slate-200/80 px-3 py-1.5 rounded-lg">
                <span className="font-medium text-slate-700">امروز: {currentDate}</span>
                <span>ساعت: {currentTime}</span>
              </div>
            )}

            {/* User Profile / Switcher Dropdown */}
            {currentUser && (
              <div className="relative flex items-center gap-1.5" ref={userMenuRef}>
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

                {/* Mobile Direct Logout Button */}
                {onLogout && (
                  <button
                    type="button"
                    id="header-mobile-direct-logout"
                    onClick={onLogout}
                    title="خروج از حساب کاربری"
                    aria-label="خروج از حساب کاربری"
                    className="sm:hidden flex items-center justify-center w-8 h-8 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 transition-colors cursor-pointer shrink-0"
                  >
                    <LogOut className="w-4 h-4 text-rose-600" />
                  </button>
                )}

                {/* User Dropdown Menu */}
                {isUserMenuOpen && (
                  <>
                    {/* Backdrop for Mobile */}
                    <div
                      className="fixed inset-0 bg-slate-900/40 backdrop-blur-2xs z-40 sm:hidden animate-in fade-in duration-150"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsUserMenuOpen(false);
                      }}
                      aria-hidden="true"
                    />
                    <div
                      id="header-user-dropdown-popover"
                      className="fixed inset-x-3 top-[68px] sm:absolute sm:top-full sm:mt-2 sm:left-0 sm:right-auto sm:inset-x-auto w-auto max-w-sm sm:max-w-none sm:w-80 mx-auto sm:mx-0 bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200 p-2.5 z-50 animate-in fade-in slide-in-from-top-2 duration-150 text-right flex flex-col max-h-[calc(100vh-84px)] overflow-hidden"
                    >
                      {/* Active User Header */}
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 mb-2 shrink-0">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[10px] text-slate-400 font-medium">حساب کاربری فعال فعلی</span>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-bold px-1.5 py-0.2 bg-emerald-100 text-emerald-800 rounded-md">
                              آنلاین
                            </span>
                            <button
                              type="button"
                              onClick={() => setIsUserMenuOpen(false)}
                              className="sm:hidden p-0.5 text-slate-400 hover:text-slate-600 rounded-md hover:bg-slate-200 cursor-pointer"
                              title="بستن"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                        <div className="font-bold text-xs text-slate-900">{currentUser.fullName}</div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          سمت: {currentUser.roleTitle || ROLE_LABELS[currentUser.role]} (@{currentUser.username})
                        </div>
                      </div>

                      {currentUser.role === 'admin' ? (
                        <>
                          {/* Switch User List for Admin */}
                          <div className="px-2 py-1 text-[11px] font-bold text-slate-400 flex items-center justify-between shrink-0">
                            <span>لیست کاربران (دسترسی مدیریت):</span>
                            <span className="text-[10px] text-emerald-600 bg-emerald-50 px-1 rounded">ورود با رمز</span>
                          </div>
                          <div className="space-y-1 overflow-y-auto py-1 flex-1 min-h-0">
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
                                          : u.role === 'supervisor'
                                          ? 'bg-teal-600'
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
                        <div className="p-3 bg-slate-50/90 rounded-xl border border-slate-200/70 text-center my-1 shrink-0">
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
                      <div className="pt-2 border-t border-slate-100 mt-1 space-y-1.5 shrink-0">
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
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

