import React, { useState, useEffect } from 'react';
import { StoreSettings, Product, Customer, Invoice, StockMovement, AppUser } from '../types';
import { StorageService } from '../utils/storage';
import { formatPrice, toPersianDigits } from '../utils/jalali';
import { UsersManager } from './UsersManager';
import {
  ShieldCheck,
  SlidersHorizontal,
  LayoutGrid,
  Boxes,
  Users,
  BarChart3,
  ReceiptText,
  Printer,
  CreditCard,
  Building2,
  Database,
  Save,
  Download,
  Upload,
  RotateCcw,
  AlertTriangle,
  CheckCircle2,
  Trash2,
  Clock,
  DollarSign,
  Percent,
  Check,
  FileText,
  Receipt,
  Eye,
  Settings,
  HelpCircle,
  UserCheck
} from 'lucide-react';

interface AdminPanelProps {
  settings: StoreSettings;
  products: Product[];
  customers: Customer[];
  invoices: Invoice[];
  movements: StockMovement[];
  users: AppUser[];
  currentUser: AppUser;
  onSaveSettings: (newSettings: StoreSettings) => void;
  onReloadData: () => void;
  onNavigateToTab: (tab: string) => void;
  onAddUser: (userData: Omit<AppUser, 'id' | 'createdAt'>) => void;
  onUpdateUser: (user: AppUser) => void;
  onDeleteUser: (userId: string) => { success: boolean; message?: string };
  onSwitchUser: (user: AppUser) => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({
  settings,
  products,
  customers,
  invoices,
  movements,
  users,
  currentUser,
  onSaveSettings,
  onReloadData,
  onNavigateToTab,
  onAddUser,
  onUpdateUser,
  onDeleteUser,
  onSwitchUser,
}) => {
  const safeInitialSettings = settings || StorageService.getSettings();
  const [formData, setFormData] = useState<StoreSettings>({ ...safeInitialSettings });

  const canAccessFullAdmin = !currentUser || currentUser.permissions.canAccessAdmin;
  const canManageUsers = !currentUser || currentUser.permissions.canManageUsers;

  const [activeSection, setActiveSection] = useState<'overview' | 'modules' | 'invoice' | 'templates' | 'store' | 'users' | 'data'>(
    canAccessFullAdmin ? 'overview' : 'users'
  );
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [importStatus, setImportStatus] = useState<string>('');

  useEffect(() => {
    if (settings) {
      setFormData({ ...settings });
    }
  }, [settings]);

  const storageStats = StorageService.getStorageStats();
  const totalRevenue = invoices.reduce((sum, inv) => sum + inv.finalTotal, 0);
  const lowStockProducts = products.filter(p => p.stock <= p.minStockAlert);

  const handleToggle = (key: keyof StoreSettings) => {
    setFormData((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'number' ? parseFloat(value) || 0 : value,
    }));
  };

  const handleSave = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    onSaveSettings(formData);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2500);
  };

  // Export JSON backup file
  const handleExportBackup = () => {
    const jsonStr = StorageService.exportAllData();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Import JSON backup file
  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const content = evt.target?.result as string;
        const success = StorageService.importAllData(content);
        if (success) {
          setImportStatus('پشتیبان با موفقیت بازیابی شد.');
          onReloadData();
          setFormData(StorageService.getSettings());
          setTimeout(() => setImportStatus(''), 3000);
        } else {
          setImportStatus('خطا: قالب فایل پشتیبان معتبر نیست.');
        }
      } catch (err) {
        setImportStatus('خطا در خواندن فایل.');
      }
    };
    reader.readAsText(file);
  };

  // Clear invoices only
  const handleClearInvoices = () => {
    if (window.confirm('آیا از حذف تمامی فاکتورهای صادر شده اطمینان دارید؟ (کالاها و مشتریان حفظ خواهند شد)')) {
      StorageService.clearInvoices();
      onReloadData();
      setImportStatus('تمامی فاکتورها پاک شدند.');
      setTimeout(() => setImportStatus(''), 2500);
    }
  };

  // Reset to initial store demo
  const handleResetDemoData = () => {
    if (window.confirm('آیا مطمئن هستید؟ تمامی داده‌ها با اطلاعات نمونه اولیه فروشگاه جایگزین خواهد شد.')) {
      StorageService.resetToDefaults();
      onReloadData();
      setFormData(StorageService.getSettings());
      setImportStatus('سامانه با داده‌های پیش‌فرض بارگذاری شد.');
      setTimeout(() => setImportStatus(''), 2500);
    }
  };

  // Factory reset
  const handleFactoryReset = () => {
    if (window.confirm('هشدار قطعی: کلیه اطلاعات کالاها، مشتریان و فاکتورها به طور کامل پاک خواهند شد. آیا ادامه می‌دهید؟')) {
      StorageService.clearAllData();
      const defaultSettings = StorageService.resetSettingsToDefault();
      setFormData(defaultSettings);
      onReloadData();
      setImportStatus('تنظیمات کارخانه اعمال شد و کلیه اطلاعات پاک گردید.');
      setTimeout(() => setImportStatus(''), 2500);
    }
  };

  const sections = [
    ...(canAccessFullAdmin
      ? [
          { id: 'overview', label: 'داشبورد و وضعیت اجزا', icon: LayoutGrid },
          { id: 'modules', label: 'کنترل ماژول‌های سیستم', icon: SlidersHorizontal },
          { id: 'invoice', label: 'قوانین و رفتار فاکتورساز', icon: ReceiptText },
          { id: 'templates', label: 'قالب‌های چاپ و پرداخت', icon: Printer },
          { id: 'store', label: 'مشخصات فروشگاه و برند', icon: Building2 },
        ]
      : []),
    ...(canManageUsers
      ? [{ id: 'users', label: 'کاربران و سطوح دسترسی', icon: UserCheck }]
      : []),
    ...(canAccessFullAdmin
      ? [{ id: 'data', label: 'مرکز داده و پشتیبان‌گیری', icon: Database }]
      : []),
  ];

  return (
    <div className="space-y-6">
      {/* Top Banner Header */}
      <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-emerald-700 text-white flex items-center justify-center shadow-md shadow-emerald-700/20 shrink-0">
            <ShieldCheck className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg sm:text-xl font-black text-slate-900">
                پنل مدیریت و پیکربندی اجزای سامانه
              </h2>
              <span className="bg-emerald-100 text-emerald-800 text-xs font-bold px-2.5 py-0.5 rounded-full">
                دسترسی مدیر
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              کنترل یکپارچه ماژول‌ها، فعال‌سازی ابزارها، قوانین صدور فاکتور و مدیریت پایگاه‌داده
            </p>
          </div>
        </div>

        {/* Action Save Button */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            id="admin-save-btn"
            onClick={() => handleSave()}
            className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm shadow-emerald-300 cursor-pointer w-full sm:w-auto"
          >
            {saveSuccess ? (
              <>
                <Check className="w-4 h-4 text-emerald-200" />
                <span>تغییرات ذخیره شد</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>ذخیره کلیه تنظیمات</span>
              </>
            )}
          </button>
        </div>
      </div>

      {importStatus && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-bold flex items-center gap-2 shadow-xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{importStatus}</span>
        </div>
      )}

      {/* Main Grid: Sidebar Sections Navigation + Section Content View */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Navigation Tabs (Sidebar on Desktop, Horizontal Pill row on Mobile) */}
        <div className="lg:col-span-3 space-y-1">
          <div className="bg-white rounded-2xl p-2 border border-slate-200 shadow-xs flex lg:flex-col overflow-x-auto gap-1 scrollbar-none">
            {sections.map((sec) => {
              const Icon = sec.icon;
              const isActive = activeSection === sec.id;
              return (
                <button
                  key={sec.id}
                  type="button"
                  id={`admin-nav-${sec.id}`}
                  onClick={() => setActiveSection(sec.id as any)}
                  className={`flex items-center gap-2.5 px-3.5 py-3 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer text-right w-full ${
                    isActive
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                  <span>{sec.label}</span>
                </button>
              );
            })}
          </div>

          {/* Quick System Health Box */}
          <div className="hidden lg:block bg-slate-50 rounded-2xl p-4 border border-slate-200/80 text-xs space-y-2.5 text-slate-600">
            <div className="flex items-center justify-between text-[11px] font-bold text-slate-700">
              <span className="flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-emerald-600" />
                وضعیت حافظه محلی
              </span>
              <span className="font-mono text-emerald-700">{storageStats.sizeKB} KB</span>
            </div>
            <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
              <div className="bg-emerald-500 h-full w-[12%] rounded-full"></div>
            </div>
            <p className="text-[10px] text-slate-400 leading-relaxed">
              اطلاعات برنامه به‌صورت پایدار در مرورگر شما ذخیره شده و بدون اینترنت نیز کاملاً در دسترس است.
            </p>
          </div>
        </div>

        {/* Content Section Panel */}
        <div className="lg:col-span-9 space-y-6">
          {/* 1. OVERVIEW & COMPONENTS STATUS */}
          {activeSection === 'overview' && (
            <div className="space-y-6">
              {/* Component Health Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Invoices Component */}
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                        <ReceiptText className="w-5 h-5" />
                      </div>
                      <span className="text-xs font-bold text-slate-800">سامانه صدور فاکتور</span>
                    </div>
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-xs"></span>
                  </div>
                  <div>
                    <div className="text-xl font-black text-slate-900">
                      {toPersianDigits(invoices.length)} فاکتور
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1">
                      گردش فروش: {formatPrice(totalRevenue, formData.currency)}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onNavigateToTab('invoices')}
                    className="mt-3 text-xs text-emerald-700 font-bold hover:underline text-right flex items-center gap-1 cursor-pointer"
                  >
                    <span>مشاهده فاکتورها</span>
                    <span>←</span>
                  </button>
                </div>

                {/* Inventory Component */}
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                        <Boxes className="w-5 h-5" />
                      </div>
                      <span className="text-xs font-bold text-slate-800">ماژول انبارداری</span>
                    </div>
                    <span className={`w-2.5 h-2.5 rounded-full ${formData.enableInventory ? 'bg-emerald-500' : 'bg-slate-300'}`}></span>
                  </div>
                  <div>
                    <div className="text-xl font-black text-slate-900">
                      {toPersianDigits(products.length)} قلم کالا
                    </div>
                    <div className="text-[11px] text-amber-600 font-medium mt-1">
                      {lowStockProducts.length > 0
                        ? `${toPersianDigits(lowStockProducts.length)} کالا نیازمند سفارش مجدد`
                        : 'موجودی انبار متعادل'}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onNavigateToTab('inventory')}
                    className="mt-3 text-xs text-blue-700 font-bold hover:underline text-right flex items-center gap-1 cursor-pointer"
                  >
                    <span>مدیریت کالا و انبار</span>
                    <span>←</span>
                  </button>
                </div>

                {/* Customers Component */}
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-purple-50 text-purple-600 rounded-xl">
                        <Users className="w-5 h-5" />
                      </div>
                      <span className="text-xs font-bold text-slate-800">دفتر مشتریان</span>
                    </div>
                    <span className={`w-2.5 h-2.5 rounded-full ${formData.enableCustomers ? 'bg-emerald-500' : 'bg-slate-300'}`}></span>
                  </div>
                  <div>
                    <div className="text-xl font-black text-slate-900">
                      {toPersianDigits(customers.length)} مخاطب
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1">
                      دفتر حساب و سوابق مشتریان
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onNavigateToTab('customers')}
                    className="mt-3 text-xs text-purple-700 font-bold hover:underline text-right flex items-center gap-1 cursor-pointer"
                  >
                    <span>مدیریت مشتریان</span>
                    <span>←</span>
                  </button>
                </div>

                {/* Users & Access Component */}
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                        <UserCheck className="w-5 h-5" />
                      </div>
                      <span className="text-xs font-bold text-slate-800">کاربران و دسترسی‌ها</span>
                    </div>
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-xs"></span>
                  </div>
                  <div>
                    <div className="text-xl font-black text-slate-900">
                      {toPersianDigits(users.length)} کاربر فعال
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1 truncate">
                      کاربر جاری: {currentUser.fullName}
                    </div>
                  </div>
                  <button
                    type="button"
                    id="admin-overview-users-btn"
                    onClick={() => setActiveSection('users')}
                    className="mt-3 text-xs text-indigo-700 font-bold hover:underline text-right flex items-center gap-1 cursor-pointer"
                  >
                    <span>تعریف و مدیریت کاربران</span>
                    <span>←</span>
                  </button>
                </div>
              </div>

              {/* Quick Actions Panel */}
              <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
                <h3 className="font-bold text-sm text-slate-800 flex items-center gap-2">
                  <SlidersHorizontal className="w-4 h-4 text-emerald-600" />
                  وضعیت اجزای فعال در سیستم
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                    <span className="font-medium text-slate-700">کسر خودکار موجودی از انبار با صدور فاکتور:</span>
                    <span className={`font-bold px-2 py-0.5 rounded-md ${formData.autoDeductStock ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                      {formData.autoDeductStock ? 'فعال' : 'غیرفعال'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                    <span className="font-medium text-slate-700">فروش کالای ناموجود یا منفی:</span>
                    <span className={`font-bold px-2 py-0.5 rounded-md ${formData.allowNegativeStock ? 'bg-amber-100 text-amber-800' : 'bg-slate-200 text-slate-700'}`}>
                      {formData.allowNegativeStock ? 'مجاز' : 'غیرمجاز (کنترل موجودی)'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                    <span className="font-medium text-slate-700">مالیات بر ارزش افزوده در فاکتورها:</span>
                    <span className={`font-bold px-2 py-0.5 rounded-md ${formData.taxEnabled ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'}`}>
                      {formData.taxEnabled ? `${toPersianDigits(formData.taxPercent)}٪ فعال` : 'غیرفعال'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                    <span className="font-medium text-slate-700">واحد پولی محاسبات:</span>
                    <span className="font-bold text-slate-800 bg-slate-200/80 px-2 py-0.5 rounded-md">
                      {formData.currency}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 2. MODULES CONTROL (کنترل ماژول‌های سیستم) */}
          {activeSection === 'modules' && (
            <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 shadow-xs space-y-6">
              <div>
                <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                  <SlidersHorizontal className="w-5 h-5 text-emerald-600" />
                  فعال یا غیرفعال‌سازی ماژول‌ها و تب‌های سامانه
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  می‌توانید بخش‌هایی از نرم‌افزار که نیاز ندارید را خاموش کنید تا ظاهر برنامه خلوت‌تر و سریع‌تر شود.
                </p>
              </div>

              {/* Branding & App Title Configuration */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/90 space-y-4">
                <div className="flex items-center gap-2">
                  <SlidersHorizontal className="w-4 h-4 text-emerald-600" />
                  <span className="font-bold text-xs sm:text-sm text-slate-900">
                    نام و عنوان اصلی نرم‌افزار در سربرگ
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-slate-700 font-bold mb-1 text-xs">
                      نام برنامه (عنوان بالای صفحه)
                    </label>
                    <input
                      type="text"
                      name="appName"
                      id="admin-app-name-input"
                      value={formData.appName || ''}
                      onChange={handleInputChange}
                      placeholder="سیستم فاکتور و انبارداری"
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-800 font-semibold focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                    />
                    <p className="text-[10px] text-slate-400 mt-1">
                      عنوان دلخواه برای نرم‌افزار که در گوشه راست بالای سربرگ نمایش داده می‌شود.
                    </p>
                  </div>

                  <div className="flex flex-col justify-between">
                    <div>
                      <span className="block text-slate-700 font-bold mb-1 text-xs">
                        نشان «نسخه فروشگاهی» در بالای صفحه
                      </span>
                      <p className="text-[10px] text-slate-400">
                        فعال یا غیرفعال کردن برچسب سبز رنگ «نسخه فروشگاهی» کنار نام برنامه.
                      </p>
                    </div>

                    <div className="pt-2 flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-600">
                        {formData.showStoreEditionBadge !== false ? 'فعال (نمایش در سربرگ)' : 'غیرفعال (مخفی)'}
                      </span>
                      <button
                        type="button"
                        id="toggle-store-edition-badge-btn"
                        onClick={() => handleToggle('showStoreEditionBadge')}
                        className={`w-12 h-6.5 flex items-center rounded-full p-1 transition-colors cursor-pointer shrink-0 ${
                          formData.showStoreEditionBadge !== false ? 'bg-emerald-600' : 'bg-slate-300'
                        }`}
                      >
                        <div
                          className={`bg-white w-4.5 h-4.5 rounded-full shadow-md transform transition-transform ${
                            formData.showStoreEditionBadge !== false ? '-translate-x-5.5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="divide-y divide-slate-100 space-y-4 pt-2">
                {/* Module 1: Inventory */}
                <div className="pt-4 flex items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Boxes className="w-4 h-4 text-emerald-600" />
                      <span className="font-bold text-xs sm:text-sm text-slate-800">
                        ماژول انبارداری و کاردکس کالا
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      نمایش تب انبار در منوی اصلی، تعریف کالا، مدیریت موجودی، ورود و خروج کالا و گردش کالا.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleToggle('enableInventory')}
                    className={`w-12 h-6.5 flex items-center rounded-full p-1 transition-colors cursor-pointer shrink-0 ${
                      formData.enableInventory ? 'bg-emerald-600' : 'bg-slate-300'
                    }`}
                  >
                    <div
                      className={`bg-white w-4.5 h-4.5 rounded-full shadow-md transform transition-transform ${
                        formData.enableInventory ? '-translate-x-5.5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {/* Module 2: Customers */}
                <div className="pt-4 flex items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-purple-600" />
                      <span className="font-bold text-xs sm:text-sm text-slate-800">
                        ماژول مدیریت مشتریان و خریداران
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      نمایش تب مشتریان در منو، ثبت مشخصات، شماره تماس، کد اقتصادی و سوابق خریدهای هر مشتری.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleToggle('enableCustomers')}
                    className={`w-12 h-6.5 flex items-center rounded-full p-1 transition-colors cursor-pointer shrink-0 ${
                      formData.enableCustomers ? 'bg-emerald-600' : 'bg-slate-300'
                    }`}
                  >
                    <div
                      className={`bg-white w-4.5 h-4.5 rounded-full shadow-md transform transition-transform ${
                        formData.enableCustomers ? '-translate-x-5.5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {/* Module 3: Reports */}
                <div className="pt-4 flex items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <BarChart3 className="w-4 h-4 text-blue-600" />
                      <span className="font-bold text-xs sm:text-sm text-slate-800">
                        ماژول گزارشات تحلیلی و سود و زیان
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      محاسبه خودکار سود ناخالص، درآمد کل، پرفروش‌ترین کالاها و نمودار ماهانه فروش.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleToggle('enableReports')}
                    className={`w-12 h-6.5 flex items-center rounded-full p-1 transition-colors cursor-pointer shrink-0 ${
                      formData.enableReports ? 'bg-emerald-600' : 'bg-slate-300'
                    }`}
                  >
                    <div
                      className={`bg-white w-4.5 h-4.5 rounded-full shadow-md transform transition-transform ${
                        formData.enableReports ? '-translate-x-5.5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {/* Module 4: Low Stock Alert in Header */}
                <div className="pt-4 flex items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-500" />
                      <span className="font-bold text-xs sm:text-sm text-slate-800">
                        نمایش نشانگر هشدار کمبود موجودی در بالای صفحه
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      اگر کالایی به حداقل موجودی برسد، دکمه چشمک‌زن قرمز/زرد در نوار بالای صفحه ظاهر می‌شود.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleToggle('showLowStockAlerts')}
                    className={`w-12 h-6.5 flex items-center rounded-full p-1 transition-colors cursor-pointer shrink-0 ${
                      formData.showLowStockAlerts ? 'bg-emerald-600' : 'bg-slate-300'
                    }`}
                  >
                    <div
                      className={`bg-white w-4.5 h-4.5 rounded-full shadow-md transform transition-transform ${
                        formData.showLowStockAlerts ? '-translate-x-5.5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {/* Module 5: Header Clock */}
                <div className="pt-4 flex items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-slate-600" />
                      <span className="font-bold text-xs sm:text-sm text-slate-800">
                        نمایش ساعت و تاریخ زنده در سربرگ
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      نمایش تاریخ روز شمسی و ساعت جاری در نوار بالایی صفحه.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleToggle('showHeaderClock')}
                    className={`w-12 h-6.5 flex items-center rounded-full p-1 transition-colors cursor-pointer shrink-0 ${
                      formData.showHeaderClock ? 'bg-emerald-600' : 'bg-slate-300'
                    }`}
                  >
                    <div
                      className={`bg-white w-4.5 h-4.5 rounded-full shadow-md transform transition-transform ${
                        formData.showHeaderClock ? '-translate-x-5.5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 3. INVOICE BUILDER RULES (قوانین و رفتار فاکتورساز) */}
          {activeSection === 'invoice' && (
            <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 shadow-xs space-y-6">
              <div>
                <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                  <ReceiptText className="w-5 h-5 text-emerald-600" />
                  کنترل رفتار و فیلدهای فرم صدور فاکتور
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  مشخص کنید در هنگام ثبت فاکتور کدام گزینه‌ها، مالیات، تخفیف‌ها و رفتار انبارداری اعمال گردند.
                </p>
              </div>

              <div className="divide-y divide-slate-100 space-y-4 pt-2">
                {/* Rule: Auto Deduct Stock */}
                <div className="pt-4 flex items-center justify-between gap-4">
                  <div className="space-y-1">
                    <span className="font-bold text-xs sm:text-sm text-slate-800">
                      کسر خودکار موجودی کالا از انبار با صدور فاکتور
                    </span>
                    <p className="text-[11px] text-slate-500">
                      به محض زدن دکمه ثبت فاکتور، تعداد اقلام از انبار کسر و در کاردکس کالا ثبت می‌گردد.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleToggle('autoDeductStock')}
                    className={`w-12 h-6.5 flex items-center rounded-full p-1 transition-colors cursor-pointer shrink-0 ${
                      formData.autoDeductStock ? 'bg-emerald-600' : 'bg-slate-300'
                    }`}
                  >
                    <div
                      className={`bg-white w-4.5 h-4.5 rounded-full shadow-md transform transition-transform ${
                        formData.autoDeductStock ? '-translate-x-5.5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {/* Rule: Allow Negative Stock */}
                <div className="pt-4 flex items-center justify-between gap-4">
                  <div className="space-y-1">
                    <span className="font-bold text-xs sm:text-sm text-slate-800">
                      مجوز فروش کالا در صورت عدم موجودی کافی (موجودی منفی)
                    </span>
                    <p className="text-[11px] text-slate-500">
                      در صورت فعال بودن، حتی اگر موجودی کالا صفر یا ناکافی باشد، فاکتور صادر می‌شود. در صورت خاموش بودن، سیستم اخطار عدم موجودی می‌دهد.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleToggle('allowNegativeStock')}
                    className={`w-12 h-6.5 flex items-center rounded-full p-1 transition-colors cursor-pointer shrink-0 ${
                      formData.allowNegativeStock ? 'bg-amber-500' : 'bg-slate-300'
                    }`}
                  >
                    <div
                      className={`bg-white w-4.5 h-4.5 rounded-full shadow-md transform transition-transform ${
                        formData.allowNegativeStock ? '-translate-x-5.5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {/* Rule: Item Discount Field */}
                <div className="pt-4 flex items-center justify-between gap-4">
                  <div className="space-y-1">
                    <span className="font-bold text-xs sm:text-sm text-slate-800">
                      ستون تخفیف روی هر قلم کالا
                    </span>
                    <p className="text-[11px] text-slate-500">
                      امکان وارد کردن تخفیف ویژه برای هر ردیف کالا به صورت مجزا در فاکتور.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleToggle('enableItemDiscount')}
                    className={`w-12 h-6.5 flex items-center rounded-full p-1 transition-colors cursor-pointer shrink-0 ${
                      formData.enableItemDiscount ? 'bg-emerald-600' : 'bg-slate-300'
                    }`}
                  >
                    <div
                      className={`bg-white w-4.5 h-4.5 rounded-full shadow-md transform transition-transform ${
                        formData.enableItemDiscount ? '-translate-x-5.5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {/* Rule: Total Invoice Discount */}
                <div className="pt-4 flex items-center justify-between gap-4">
                  <div className="space-y-1">
                    <span className="font-bold text-xs sm:text-sm text-slate-800">
                      فیلد تخفیف کلی انتهای فاکتور
                    </span>
                    <p className="text-[11px] text-slate-500">
                      نمایش کادر تخفیف کلی بر روی کل جمع اقلام در انتهای فرم فاکتور.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleToggle('enableInvoiceDiscount')}
                    className={`w-12 h-6.5 flex items-center rounded-full p-1 transition-colors cursor-pointer shrink-0 ${
                      formData.enableInvoiceDiscount ? 'bg-emerald-600' : 'bg-slate-300'
                    }`}
                  >
                    <div
                      className={`bg-white w-4.5 h-4.5 rounded-full shadow-md transform transition-transform ${
                        formData.enableInvoiceDiscount ? '-translate-x-5.5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {/* Rule: Due Date Field */}
                <div className="pt-4 flex items-center justify-between gap-4">
                  <div className="space-y-1">
                    <span className="font-bold text-xs sm:text-sm text-slate-800">
                      فیلد تاریخ سررسید و تسویه فاکتور
                    </span>
                    <p className="text-[11px] text-slate-500">
                      مناسب برای فروش‌های نسیه، چک یا تعیین مهلت پرداخت مشتری.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleToggle('enableDueDate')}
                    className={`w-12 h-6.5 flex items-center rounded-full p-1 transition-colors cursor-pointer shrink-0 ${
                      formData.enableDueDate ? 'bg-emerald-600' : 'bg-slate-300'
                    }`}
                  >
                    <div
                      className={`bg-white w-4.5 h-4.5 rounded-full shadow-md transform transition-transform ${
                        formData.enableDueDate ? '-translate-x-5.5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {/* Rule: Invoice Notes Field */}
                <div className="pt-4 flex items-center justify-between gap-4">
                  <div className="space-y-1">
                    <span className="font-bold text-xs sm:text-sm text-slate-800">
                      کادر یادداشت‌ها و شروط فاکتور
                    </span>
                    <p className="text-[11px] text-slate-500">
                      امکان درج توضیحات اختصاصی برای هر فاکتور در هنگام صدور.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleToggle('enableInvoiceNotes')}
                    className={`w-12 h-6.5 flex items-center rounded-full p-1 transition-colors cursor-pointer shrink-0 ${
                      formData.enableInvoiceNotes ? 'bg-emerald-600' : 'bg-slate-300'
                    }`}
                  >
                    <div
                      className={`bg-white w-4.5 h-4.5 rounded-full shadow-md transform transition-transform ${
                        formData.enableInvoiceNotes ? '-translate-x-5.5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {/* Rule: Auto Print After Save */}
                <div className="pt-4 flex items-center justify-between gap-4">
                  <div className="space-y-1">
                    <span className="font-bold text-xs sm:text-sm text-slate-800">
                      چاپ فوری پس از ثبت (Auto-Print)
                    </span>
                    <p className="text-[11px] text-slate-500">
                      به محض کلیک روی «ثبت فاکتور»، پنجره پیش‌نمایش و چاپگر مستقیماً باز می‌شود.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleToggle('autoPrintAfterSave')}
                    className={`w-12 h-6.5 flex items-center rounded-full p-1 transition-colors cursor-pointer shrink-0 ${
                      formData.autoPrintAfterSave ? 'bg-emerald-600' : 'bg-slate-300'
                    }`}
                  >
                    <div
                      className={`bg-white w-4.5 h-4.5 rounded-full shadow-md transform transition-transform ${
                        formData.autoPrintAfterSave ? '-translate-x-5.5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {/* Tax Configuration Box */}
                <div className="pt-5 space-y-3">
                  <div className="flex items-center justify-between gap-4">
                    <div className="space-y-1">
                      <span className="font-bold text-xs sm:text-sm text-slate-800">
                        محاسبه مالیات بر ارزش افزوده (VAT)
                      </span>
                      <p className="text-[11px] text-slate-500">
                        افزودن درصد مشخصی به عنوان مالیات قانونی به جمع فاکتور.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleToggle('taxEnabled')}
                      className={`w-12 h-6.5 flex items-center rounded-full p-1 transition-colors cursor-pointer shrink-0 ${
                        formData.taxEnabled ? 'bg-emerald-600' : 'bg-slate-300'
                      }`}
                    >
                      <div
                        className={`bg-white w-4.5 h-4.5 rounded-full shadow-md transform transition-transform ${
                          formData.taxEnabled ? '-translate-x-5.5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  {formData.taxEnabled && (
                    <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 flex items-center gap-4 max-w-sm mt-2">
                      <label className="text-xs font-bold text-slate-700 whitespace-nowrap">
                        درصد مالیات ارزش افزوده:
                      </label>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          name="taxPercent"
                          min="0"
                          max="100"
                          value={formData.taxPercent}
                          onChange={handleInputChange}
                          className="w-20 bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-center font-bold text-slate-800 outline-none focus:border-emerald-500"
                        />
                        <span className="text-xs text-slate-500 font-bold">٪</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 4. TEMPLATES & PAYMENT METHODS (قالب‌های چاپ و روش‌های پرداخت) */}
          {activeSection === 'templates' && (
            <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 shadow-xs space-y-8">
              {/* Part A: Templates */}
              <div className="space-y-4">
                <div>
                  <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                    <Printer className="w-5 h-5 text-emerald-600" />
                    قالب‌های مجاز چاپ و صدور فاکتور
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    تعیین کنید کدام قالب‌های فاکتور برای پرسنل در دسترس باشند.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Template 1: Standard */}
                  <div className={`p-4 rounded-xl border-2 transition-all flex flex-col justify-between ${
                    formData.enableStandardTemplate ? 'border-emerald-500 bg-emerald-50/20' : 'border-slate-200 opacity-60'
                  }`}>
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <FileText className="w-5 h-5 text-emerald-600" />
                        <button
                          type="button"
                          onClick={() => handleToggle('enableStandardTemplate')}
                          className={`text-xs font-bold px-2 py-0.5 rounded cursor-pointer ${
                            formData.enableStandardTemplate ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-700'
                          }`}
                        >
                          {formData.enableStandardTemplate ? 'فعال' : 'غیرفعال'}
                        </button>
                      </div>
                      <h4 className="font-bold text-xs text-slate-800">فاکتور استاندارد A4/A5</h4>
                      <p className="text-[11px] text-slate-500 mt-1">
                        قالب عمومی با طراحی شیک برای شرکت‌ها، عمده‌فروشی و خرده‌فروشی.
                      </p>
                    </div>
                  </div>

                  {/* Template 2: Official */}
                  <div className={`p-4 rounded-xl border-2 transition-all flex flex-col justify-between ${
                    formData.enableOfficialTemplate ? 'border-emerald-500 bg-emerald-50/20' : 'border-slate-200 opacity-60'
                  }`}>
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <Building2 className="w-5 h-5 text-blue-600" />
                        <button
                          type="button"
                          onClick={() => handleToggle('enableOfficialTemplate')}
                          className={`text-xs font-bold px-2 py-0.5 rounded cursor-pointer ${
                            formData.enableOfficialTemplate ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-700'
                          }`}
                        >
                          {formData.enableOfficialTemplate ? 'فعال' : 'غیرفعال'}
                        </button>
                      </div>
                      <h4 className="font-bold text-xs text-slate-800">فاکتور رسمی مالیاتی دارایی</h4>
                      <p className="text-[11px] text-slate-500 mt-1">
                        مطابق ساختار مصوب سازمان امور مالیاتی کشور با کد اقتصادی و شناسه ملی.
                      </p>
                    </div>
                  </div>

                  {/* Template 3: Thermal */}
                  <div className={`p-4 rounded-xl border-2 transition-all flex flex-col justify-between ${
                    formData.enableThermalTemplate ? 'border-emerald-500 bg-emerald-50/20' : 'border-slate-200 opacity-60'
                  }`}>
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <Receipt className="w-5 h-5 text-amber-600" />
                        <button
                          type="button"
                          onClick={() => handleToggle('enableThermalTemplate')}
                          className={`text-xs font-bold px-2 py-0.5 rounded cursor-pointer ${
                            formData.enableThermalTemplate ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-700'
                          }`}
                        >
                          {formData.enableThermalTemplate ? 'فعال' : 'غیرفعال'}
                        </button>
                      </div>
                      <h4 className="font-bold text-xs text-slate-800">رسید فیش پرینتر حرارتی (POS)</h4>
                      <p className="text-[11px] text-slate-500 mt-1">
                        چاپ سریع برای رول حرارتی ۸ سانتی مناسب فروشگاه‌ها و فست‌فود.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Default Template Choice */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <span className="text-xs font-bold text-slate-700">قالب پیش‌فرض در پیش‌نمایش چاپ:</span>
                  <select
                    name="defaultTemplate"
                    value={formData.defaultTemplate}
                    onChange={handleInputChange}
                    className="bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-emerald-500"
                  >
                    <option value="standard">فاکتور استاندارد (A4 / A5)</option>
                    <option value="official">فاکتور رسمی دارایی</option>
                    <option value="thermal">رسید حرارتی ۸۰ میلی‌متری</option>
                  </select>
                </div>
              </div>

              {/* Part B: Payment Methods */}
              <div className="space-y-4 pt-4 border-t border-slate-100">
                <div>
                  <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                    <CreditCard className="w-5 h-5 text-emerald-600" />
                    روش‌های مجاز دریافت وجه در فاکتور
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    فعال یا غیرفعال کردن گزینه‌های پرداخت در فرم تسویه فاکتور.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                  {/* Method: POS */}
                  <div
                    onClick={() => handleToggle('enablePosPayment')}
                    className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all flex items-center justify-between ${
                      formData.enablePosPayment ? 'border-emerald-500 bg-emerald-50/20' : 'border-slate-200 bg-slate-50 opacity-60'
                    }`}
                  >
                    <div>
                      <span className="font-bold text-slate-800 block">دستگاه کارتخوان (POS)</span>
                      <span className="text-[10px] text-slate-400">کارت بانکی</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={formData.enablePosPayment}
                      readOnly
                      className="w-4 h-4 text-emerald-600 rounded"
                    />
                  </div>

                  {/* Method: Cash */}
                  <div
                    onClick={() => handleToggle('enableCashPayment')}
                    className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all flex items-center justify-between ${
                      formData.enableCashPayment ? 'border-emerald-500 bg-emerald-50/20' : 'border-slate-200 bg-slate-50 opacity-60'
                    }`}
                  >
                    <div>
                      <span className="font-bold text-slate-800 block">پرداخت نقدی</span>
                      <span className="text-[10px] text-slate-400">اسکناس و پول نقد</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={formData.enableCashPayment}
                      readOnly
                      className="w-4 h-4 text-emerald-600 rounded"
                    />
                  </div>

                  {/* Method: Transfer */}
                  <div
                    onClick={() => handleToggle('enableTransferPayment')}
                    className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all flex items-center justify-between ${
                      formData.enableTransferPayment ? 'border-emerald-500 bg-emerald-50/20' : 'border-slate-200 bg-slate-50 opacity-60'
                    }`}
                  >
                    <div>
                      <span className="font-bold text-slate-800 block">کارت به کارت / پایا</span>
                      <span className="text-[10px] text-slate-400">انتقال آنلاین بانکی</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={formData.enableTransferPayment}
                      readOnly
                      className="w-4 h-4 text-emerald-600 rounded"
                    />
                  </div>

                  {/* Method: Credit */}
                  <div
                    onClick={() => handleToggle('enableCreditPayment')}
                    className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all flex items-center justify-between ${
                      formData.enableCreditPayment ? 'border-emerald-500 bg-emerald-50/20' : 'border-slate-200 bg-slate-50 opacity-60'
                    }`}
                  >
                    <div>
                      <span className="font-bold text-slate-800 block">حساب دفتری / نسیه</span>
                      <span className="text-[10px] text-slate-400">طلب و چک</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={formData.enableCreditPayment}
                      readOnly
                      className="w-4 h-4 text-emerald-600 rounded"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 5. STORE IDENTITY (مشخصات فروشگاه و برند) */}
          {activeSection === 'store' && (
            <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 shadow-xs space-y-6">
              <div>
                <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-emerald-600" />
                  مشخصات فروشگاه و اطلاعات سربرگ فاکتورها
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  این اطلاعات در بالای تمامی فاکتورهای چاپی رسمی و استاندارد درج می‌گردد.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                {/* App Name */}
                <div className="md:col-span-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <label className="block text-slate-700 font-bold mb-1">
                    نام سامانه و عنوان برنامه در سربرگ
                  </label>
                  <input
                    type="text"
                    name="appName"
                    value={formData.appName || ''}
                    onChange={handleInputChange}
                    placeholder="سیستم فاکتور و انبارداری"
                    className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-slate-800 font-semibold outline-none focus:border-emerald-500"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    عنوانی که در بالاترین نقطه نرم‌افزار در نوار ابزار اصلی نمایش می‌یابد.
                  </p>
                </div>

                {/* Store Name */}
                <div>
                  <label className="block text-slate-700 font-bold mb-1.5">
                    نام فروشگاه یا واحد تجاری <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="storeName"
                    value={formData.storeName}
                    onChange={handleInputChange}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-slate-800 font-semibold outline-none focus:bg-white focus:border-emerald-500"
                  />
                </div>

                {/* Seller / Manager Name */}
                <div>
                  <label className="block text-slate-700 font-bold mb-1.5">
                    نام فروشنده یا مدیر مسئول
                  </label>
                  <input
                    type="text"
                    name="sellerName"
                    value={formData.sellerName}
                    onChange={handleInputChange}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-slate-800 font-semibold outline-none focus:bg-white focus:border-emerald-500"
                  />
                </div>

                {/* Tagline */}
                <div className="md:col-span-2">
                  <label className="block text-slate-700 font-bold mb-1.5">
                    شعار تبلیغاتی یا زمینه فعالیت
                  </label>
                  <input
                    type="text"
                    name="tagline"
                    value={formData.tagline}
                    onChange={handleInputChange}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-slate-800 outline-none focus:bg-white focus:border-emerald-500"
                  />
                </div>

                {/* Phone */}
                <div>
                  <label className="block text-slate-700 font-bold mb-1.5">
                    شماره تلفن ثابت
                  </label>
                  <input
                    type="text"
                    name="phone"
                    value={formData.phone}
                    onChange={handleInputChange}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-slate-800 font-mono outline-none focus:bg-white focus:border-emerald-500 text-left"
                    dir="ltr"
                  />
                </div>

                {/* Mobile */}
                <div>
                  <label className="block text-slate-700 font-bold mb-1.5">
                    شماره تلفن همراه (جهت هماهنگی و واتساپ)
                  </label>
                  <input
                    type="text"
                    name="mobile"
                    value={formData.mobile}
                    onChange={handleInputChange}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-slate-800 font-mono outline-none focus:bg-white focus:border-emerald-500 text-left"
                    dir="ltr"
                  />
                </div>

                {/* Economic Code */}
                <div>
                  <label className="block text-slate-700 font-bold mb-1.5">
                    کد اقتصادی (ویژه فاکتورهای رسمی دارایی)
                  </label>
                  <input
                    type="text"
                    name="economicCode"
                    value={formData.economicCode}
                    onChange={handleInputChange}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-slate-800 font-mono outline-none focus:bg-white focus:border-emerald-500 text-left"
                    dir="ltr"
                  />
                </div>

                {/* National Code */}
                <div>
                  <label className="block text-slate-700 font-bold mb-1.5">
                    شناسه ملی / کد ملی
                  </label>
                  <input
                    type="text"
                    name="nationalCode"
                    value={formData.nationalCode}
                    onChange={handleInputChange}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-slate-800 font-mono outline-none focus:bg-white focus:border-emerald-500 text-left"
                    dir="ltr"
                  />
                </div>

                {/* Address */}
                <div className="md:col-span-2">
                  <label className="block text-slate-700 font-bold mb-1.5">
                    نشانی دقیق فروشگاه یا انبار
                  </label>
                  <input
                    type="text"
                    name="address"
                    value={formData.address}
                    onChange={handleInputChange}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-slate-800 outline-none focus:bg-white focus:border-emerald-500"
                  />
                </div>

                {/* Currency */}
                <div>
                  <label className="block text-slate-700 font-bold mb-1.5">
                    واحد پولی سیستم
                  </label>
                  <select
                    name="currency"
                    value={formData.currency}
                    onChange={handleInputChange}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-slate-800 font-bold outline-none focus:bg-white focus:border-emerald-500"
                  >
                    <option value="تومان">تومان (پیش‌نهادی)</option>
                    <option value="ریال">ریال</option>
                  </select>
                </div>

                {/* Postal Code */}
                <div>
                  <label className="block text-slate-700 font-bold mb-1.5">
                    کد پستی ۱۰ رقمی
                  </label>
                  <input
                    type="text"
                    name="postalCode"
                    value={formData.postalCode}
                    onChange={handleInputChange}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-slate-800 font-mono outline-none focus:bg-white focus:border-emerald-500 text-left"
                    dir="ltr"
                  />
                </div>

                {/* Invoice Footer Text */}
                <div className="md:col-span-2">
                  <label className="block text-slate-700 font-bold mb-1.5">
                    متن پانویس فاکتورها (شرایط گارانتی، شماره کارت یا پیام تشکر)
                  </label>
                  <textarea
                    name="invoiceFooterText"
                    rows={2}
                    value={formData.invoiceFooterText}
                    onChange={handleInputChange}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-slate-800 outline-none focus:bg-white focus:border-emerald-500 leading-relaxed"
                  />
                </div>
              </div>
            </div>
          )}

          {/* 6. DATA CENTER & BACKUP (مرکز داده و پشتیبان‌گیری) */}
          {activeSection === 'data' && (
            <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 shadow-xs space-y-6">
              <div>
                <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                  <Database className="w-5 h-5 text-emerald-600" />
                  مدیریت پایگاه‌داده مرکزی سرور و پشتیبان‌گیری
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  سامانه به صورت متمرکز به دیتابیس سرور متصل است؛ تغییرات ثبت‌شده در هر دستگاه بلافاصله برای سایر کاربران و سیستم‌ها همگام‌سازی می‌شود.
                </p>
              </div>

              {/* Central Server Sync Status Banner */}
              <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-600"></span>
                  </span>
                  <div>
                    <h4 className="text-xs font-bold text-emerald-950">پایگاه‌داده مرکزی سرور فعال است</h4>
                    <p className="text-[11px] text-emerald-700 mt-0.5">
                      اطلاعات در ولوم داکر سرور (<code className="font-mono bg-emerald-100 px-1 py-0.5 rounded text-[10px]">/app/data/database.json</code>) به طور ایمن ذخیره می‌شوند.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  id="force-sync-server-btn"
                  onClick={async () => {
                    const ok = await StorageService.syncFromServer();
                    if (ok) {
                      onReloadData();
                      alert('همگام‌سازی با پایگاه‌داده سرور با موفقیت انجام شد.');
                    } else {
                      alert('داده‌های محلی در سرور بازنویسی و همگام شد.');
                      StorageService.pushToServer();
                    }
                  }}
                  className="w-full sm:w-auto px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer transition-all flex items-center justify-center gap-1.5 shrink-0"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>همگام‌سازی فوری با سرور</span>
                </button>
              </div>

              {/* Data Export and Import Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Export Card */}
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
                  <div className="flex items-center gap-2 text-emerald-700">
                    <Download className="w-5 h-5" />
                    <h4 className="font-bold text-xs text-slate-800">دانلود نسخه پشتیبان (JSON)</h4>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    یک فایل استاندارد حاوی تمام اطلاعات سیستم (کالاها، فاکتورها، مشتریان و تنظیمات) دانلود می‌شود.
                  </p>
                  <button
                    type="button"
                    onClick={handleExportBackup}
                    className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>دانلود فایل پشتیبان کامل</span>
                  </button>
                </div>

                {/* Import Card */}
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
                  <div className="flex items-center gap-2 text-blue-700">
                    <Upload className="w-5 h-5" />
                    <h4 className="font-bold text-xs text-slate-800">بازیابی اطلاعات از فایل پشتیبان</h4>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    فایل JSON پشتیبان قبلی خود را انتخاب کنید تا اطلاعات در این دستگاه بارگذاری شود.
                  </p>
                  <label className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer text-center">
                    <Upload className="w-4 h-4" />
                    <span>انتخاب فایل پشتیبان</span>
                    <input
                      type="file"
                      accept=".json"
                      onChange={handleImportBackup}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              {/* Maintenance & Reset Operations */}
              <div className="pt-4 border-t border-slate-100 space-y-4">
                <h4 className="font-bold text-xs text-slate-800 flex items-center gap-1.5 text-rose-700">
                  <AlertTriangle className="w-4 h-4 text-rose-600" />
                  عملیات حساس و پاکسازی داده‌ها
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Clear Invoices Only */}
                  <button
                    type="button"
                    onClick={handleClearInvoices}
                    className="p-3.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 rounded-xl text-xs font-bold flex flex-col items-center justify-center gap-2 text-center cursor-pointer transition-colors"
                  >
                    <Trash2 className="w-5 h-5 text-amber-600" />
                    <span>پاکسازی فاکتورهای آزمایشی</span>
                    <span className="text-[10px] text-amber-700 font-normal">کالاها و مشتریان حفظ می‌شوند</span>
                  </button>

                  {/* Reset to Demo Defaults */}
                  <button
                    type="button"
                    onClick={handleResetDemoData}
                    className="p-3.5 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 rounded-xl text-xs font-bold flex flex-col items-center justify-center gap-2 text-center cursor-pointer transition-colors"
                  >
                    <RotateCcw className="w-5 h-5 text-slate-600" />
                    <span>بارگذاری داده‌های دمو و نمونه</span>
                    <span className="text-[10px] text-slate-500 font-normal">بازگردانی نمونه اولیه محصولات</span>
                  </button>

                  {/* Factory Reset */}
                  <button
                    type="button"
                    onClick={handleFactoryReset}
                    className="p-3.5 bg-rose-50 hover:bg-rose-100 text-rose-900 border border-rose-200 rounded-xl text-xs font-bold flex flex-col items-center justify-center gap-2 text-center cursor-pointer transition-colors"
                  >
                    <AlertTriangle className="w-5 h-5 text-rose-600" />
                    <span>بازنشانی به تنظیمات کارخانه</span>
                    <span className="text-[10px] text-rose-700 font-normal">حذف کامل تمامی اطلاعات</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 6. USERS & ACCESS CONTROL (کاربران و سطوح دسترسی) */}
          {activeSection === 'users' && (
            <UsersManager
              users={users}
              currentUser={currentUser}
              onAddUser={onAddUser}
              onUpdateUser={onUpdateUser}
              onDeleteUser={onDeleteUser}
              onSwitchUser={onSwitchUser}
            />
          )}
        </div>
      </div>
    </div>
  );
};
