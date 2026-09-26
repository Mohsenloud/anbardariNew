import React, { useState, useEffect, useRef } from 'react';
import { StoreSettings, Product, Customer, Invoice, StockMovement, AppUser, PdfQualityPreset } from '../types';
import { StorageService } from '../utils/storage';
import { formatPrice, toPersianDigits } from '../utils/jalali';
import { exportInvoicesToCsv } from '../utils/csvExport';
import { PDF_QUALITY_PRESETS } from '../utils/pdfHelper';
import { UsersManager } from './UsersManager';
import { ActivityLogsViewer } from './ActivityLogsViewer';
import { BackupManager } from './BackupManager';
import { WarehouseSettingsManager } from './WarehouseSettingsManager';
import { testTelegramBotConnection, testTelegramMessage } from '../utils/telegramService';
import {
  ShieldCheck,
  SlidersHorizontal,
  LayoutGrid,
  Boxes,
  Warehouse,
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
  EyeOff,
  Settings,
  HelpCircle,
  UserCheck,
  Search,
  FileSpreadsheet,
  ExternalLink,
  Filter,
  History,
  ChevronLeft,
  ChevronRight,
  FileDown,
  Sparkles,
  Send,
  Bot,
  Zap,
  Loader2,
  MessageSquare
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

  const [activeSection, setActiveSection] = useState<'overview' | 'invoices' | 'logs' | 'warehouses' | 'modules' | 'invoice' | 'templates' | 'telegram' | 'store' | 'users' | 'data'>(
    canAccessFullAdmin ? 'overview' : 'users'
  );
  const [adminInvoiceSearch, setAdminInvoiceSearch] = useState('');
  const [adminInvoiceStatus, setAdminInvoiceStatus] = useState<'all' | 'paid' | 'partial' | 'unpaid'>('all');
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [importStatus, setImportStatus] = useState<string>('');

  // Telegram Bot configuration testing states
  const [showBotToken, setShowBotToken] = useState(false);
  const [isTestingBot, setIsTestingBot] = useState(false);
  const [botTestResult, setBotTestResult] = useState<{ success: boolean; message: string; botInfo?: any } | null>(null);
  const [isTestingMsg, setIsTestingMsg] = useState(false);
  const [msgTestResult, setMsgTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleTestBotConnection = async () => {
    if (!formData.telegramBotToken?.trim()) {
      setBotTestResult({ success: false, message: 'لطفاً ابتدا توکن ربات تلگرام را وارد فرمایید.' });
      return;
    }
    setIsTestingBot(true);
    setBotTestResult(null);
    try {
      const res = await testTelegramBotConnection(formData.telegramBotToken);
      if (res.success) {
        setBotTestResult({
          success: true,
          message: res.message || 'اتصال به ربات با موفقیت برقرار شد.',
          botInfo: res.bot,
        });
      } else {
        setBotTestResult({
          success: false,
          message: res.error || 'خطا در اتصال به ربات تلگرام. توکن را بررسی نمایید.',
        });
      }
    } catch (err: any) {
      setBotTestResult({
        success: false,
        message: 'خطا در برقراری ارتباط با سرور: ' + (err?.message || ''),
      });
    } finally {
      setIsTestingBot(false);
    }
  };

  const handleTestTelegramMessage = async () => {
    if (!formData.telegramBotToken?.trim()) {
      setMsgTestResult({ success: false, message: 'لطفاً ابتدا توکن ربات تلگرام را وارد فرمایید.' });
      return;
    }
    if (!formData.telegramChatId?.trim()) {
      setMsgTestResult({ success: false, message: 'لطفاً ابتدا شناسه چت، گروه یا کانال را وارد فرمایید.' });
      return;
    }
    setIsTestingMsg(true);
    setMsgTestResult(null);
    try {
      const res = await testTelegramMessage(formData.telegramBotToken, formData.telegramChatId);
      if (res.success) {
        setMsgTestResult({
          success: true,
          message: res.message || 'پیام تستی با موفقیت به تلگرام ارسال گردید.',
        });
      } else {
        setMsgTestResult({
          success: false,
          message: res.error || 'ارسال پیام به چت تلگرام با خطا مواجه شد.',
        });
      }
    } catch (err: any) {
      setMsgTestResult({
        success: false,
        message: 'خطا در ارسال پیام: ' + (err?.message || ''),
      });
    } finally {
      setIsTestingMsg(false);
    }
  };

  useEffect(() => {
    if (settings) {
      setFormData({ ...settings });
    }
  }, [settings]);

  const storageStats = StorageService.getStorageStats();
  const totalRevenue = invoices.reduce((sum, inv) => sum + inv.finalTotal, 0);
  const lowStockProducts = products.filter(p => p.stock <= p.minStockAlert);

  const filteredAdminInvoices = invoices.filter((inv) => {
    const matchesSearch =
      inv.invoiceNumber.toLowerCase().includes(adminInvoiceSearch.toLowerCase()) ||
      inv.customerName.toLowerCase().includes(adminInvoiceSearch.toLowerCase()) ||
      (inv.customerPhone && inv.customerPhone.includes(adminInvoiceSearch));
    const matchesStatus = adminInvoiceStatus === 'all' || inv.paymentStatus === adminInvoiceStatus;
    return matchesSearch && matchesStatus;
  });

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
    StorageService.saveSettings(formData);
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
          { id: 'warehouses', label: 'تنظیمات و تعریف انبارها', icon: Warehouse },
          { id: 'invoices', label: 'لیست فاکتورها و خروجی CSV', icon: FileSpreadsheet },
          { id: 'logs', label: 'لاگ فعالیت و ردگیری رویدادها', icon: History },
          { id: 'modules', label: 'کنترل ماژول‌های سیستم', icon: SlidersHorizontal },
          { id: 'invoice', label: 'قوانین و رفتار فاکتورساز', icon: ReceiptText },
          { id: 'templates', label: 'قالب‌های چاپ و کیفیت PDF', icon: Printer },
          { id: 'telegram', label: 'ربات تلگرام (ارسال PDF)', icon: Send },
          { id: 'store', label: 'مشخصات فروشگاه و برند', icon: Building2 },
        ]
      : []),
    ...(canManageUsers
      ? [{ id: 'users', label: 'کاربران و سطوح دسترسی', icon: UserCheck }]
      : []),
    ...(canAccessFullAdmin
      ? [{ id: 'data', label: 'پایگاه داده، بکاپ و بازیابی', icon: Database }]
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
              <span
                id="admin-access-badge"
                className="w-[110px] h-[21px] inline-flex items-center justify-center text-center bg-emerald-100 text-emerald-800 text-xs font-bold rounded-full"
              >
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
        {/* Navigation Tabs (Sidebar on Desktop, Smooth Horizontal Scrollable Pills on Mobile) */}
        <div className="lg:col-span-3 space-y-2">
          {/* Mobile Section Counter */}
          <div className="flex lg:hidden items-center justify-between px-1 text-xs">
            <span className="font-bold text-slate-700 flex items-center gap-1.5">
              <SlidersHorizontal className="w-3.5 h-3.5 text-emerald-600" />
              <span>بخش‌های تنظیمات ({toPersianDigits(sections.length)} بخش)</span>
            </span>
            <span className="text-[11px] text-slate-500 font-medium">
              دسترسی سریع
            </span>
          </div>

          <div className="relative">
            {/* Non-scrollable Tabs List: Clean adaptive grid on mobile, vertical stack on desktop */}
            <div
              className="bg-white rounded-2xl p-2 border border-slate-200 shadow-xs grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-1 gap-1.5 w-full"
            >
              {sections.map((sec) => {
                const Icon = sec.icon;
                const isActive = activeSection === sec.id;
                return (
                  <button
                    key={sec.id}
                    type="button"
                    id={`admin-nav-${sec.id}`}
                    onClick={() => setActiveSection(sec.id as any)}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer text-right w-full ${
                      isActive
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 bg-slate-50/70 lg:bg-transparent border border-slate-100 lg:border-transparent'
                    }`}
                  >
                    <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                    <span className="truncate">{sec.label}</span>
                  </button>
                );
              })}
            </div>
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
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3.5">
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
                  <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2 text-xs">
                    <button
                      type="button"
                      onClick={() => onNavigateToTab('invoices')}
                      className="text-emerald-700 font-bold hover:underline text-right flex items-center gap-1 cursor-pointer"
                    >
                      <span>مشاهده فاکتورها</span>
                      <span>←</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveSection('invoices')}
                      className="text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1 rounded-lg font-bold flex items-center gap-1 cursor-pointer transition-colors"
                      title="لیست فاکتورها و خروجی CSV حسابداری در پنل مدیریت"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                      <span>خروجی CSV</span>
                    </button>
                  </div>
                </div>

                {/* Inventory & Warehouses Component */}
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
                  <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2 text-xs">
                    <button
                      type="button"
                      onClick={() => onNavigateToTab('inventory')}
                      className="text-blue-700 font-bold hover:underline text-right flex items-center gap-1 cursor-pointer"
                    >
                      <span>کاردکس کالا</span>
                      <span>←</span>
                    </button>
                    <button
                      type="button"
                      id="admin-overview-warehouses-btn"
                      onClick={() => setActiveSection('warehouses')}
                      className="text-amber-800 bg-amber-50 hover:bg-amber-100 px-2 py-1 rounded-lg font-bold flex items-center gap-1 cursor-pointer transition-colors"
                      title="تنظیمات و تعریف انبارها در پنل مدیریت"
                    >
                      <Warehouse className="w-3.5 h-3.5 text-amber-600" />
                      <span>تعریف انبارها</span>
                    </button>
                  </div>
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

                {/* Activity Logs Component */}
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-slate-100 text-slate-700 rounded-xl">
                        <History className="w-5 h-5" />
                      </div>
                      <span className="text-xs font-bold text-slate-800">لاگ فعالیت سیستم</span>
                    </div>
                    <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 shadow-xs"></span>
                  </div>
                  <div>
                    <div className="text-xl font-black text-slate-900">
                      {toPersianDigits(StorageService.getActivityLogs().length)} رویداد
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1 truncate">
                      ردگیری آنی کلیه اقدامات کاربران
                    </div>
                  </div>
                  <button
                    type="button"
                    id="admin-overview-logs-btn"
                    onClick={() => setActiveSection('logs')}
                    className="mt-3 text-xs text-indigo-700 font-bold hover:underline text-right flex items-center gap-1 cursor-pointer"
                  >
                    <span>مشاهده جزئیات لاگ‌ها</span>
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

          {/* 1.5. INVOICES & ACCOUNTING CSV EXPORT (لیست فاکتورها و خروجی حسابداری) */}
          {activeSection === 'invoices' && (
            <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 shadow-xs space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                    <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                    لیست فاکتورها و خروجی نرم‌افزارهای حسابداری (CSV)
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    مشاهده، فیلترگذاری و صدور خروجی جامع با انکودینگ استاندارد UTF-8 BOM جهت ورود به سیستم‌های مالی (هلو، سپیدار، راه‌کاران، پارسیان و اکسل)
                  </p>
                </div>

                <button
                  type="button"
                  id="admin-export-filtered-csv-btn"
                  onClick={() => {
                    const filterLabel =
                      adminInvoiceStatus === 'all'
                        ? 'همه'
                        : adminInvoiceStatus === 'paid'
                        ? 'تسویه_شده'
                        : adminInvoiceStatus === 'partial'
                        ? 'اقساطی'
                        : 'نسیه';
                    exportInvoicesToCsv(
                      filteredAdminInvoices,
                      formData,
                      `خروجی_حسابداری_فاکتورها_${filterLabel}_${filteredAdminInvoices.length}_فقره`
                    );
                  }}
                  disabled={filteredAdminInvoices.length === 0}
                  className="flex items-center justify-center gap-2 bg-emerald-700 hover:bg-emerald-800 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer shrink-0"
                  title="دانلود فایل CSV سازگار با نرم‌افزارهای حسابداری و اکسل"
                >
                  <Download className="w-4 h-4" />
                  <span>دانلود خروجی CSV ({toPersianDigits(filteredAdminInvoices.length)} فاکتور فیلترشده)</span>
                </button>
              </div>

              {/* KPI Summary for filtered invoices */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
                  <span className="text-[11px] text-slate-500 block">فاکتورهای فیلترشده</span>
                  <span className="text-base font-black text-slate-900 mt-0.5 block">
                    {toPersianDigits(filteredAdminInvoices.length)} فاکتور
                  </span>
                </div>
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
                  <span className="text-[11px] text-slate-500 block">مجموع مبلغ کل فاکتورها</span>
                  <span className="text-base font-black text-slate-900 mt-0.5 block">
                    {formatPrice(filteredAdminInvoices.reduce((s, i) => s + i.finalTotal, 0), formData.currency)}
                  </span>
                </div>
                <div className="bg-emerald-50/60 p-3.5 rounded-xl border border-emerald-200">
                  <span className="text-[11px] text-emerald-800 block">مجموع دریافتی وصول شده</span>
                  <span className="text-base font-black text-emerald-700 mt-0.5 block">
                    {formatPrice(
                      filteredAdminInvoices.reduce((s, i) => {
                        if (i.paymentStatus === 'paid') return s + i.finalTotal;
                        if (i.paymentStatus === 'partial') return s + (i.paidAmount || 0);
                        return s;
                      }, 0),
                      formData.currency
                    )}
                  </span>
                </div>
                <div className="bg-amber-50/60 p-3.5 rounded-xl border border-amber-200">
                  <span className="text-[11px] text-amber-800 block">مانده مطالبات و نسیه</span>
                  <span className="text-base font-black text-amber-700 mt-0.5 block">
                    {formatPrice(
                      Math.max(
                        0,
                        filteredAdminInvoices.reduce((s, i) => s + i.finalTotal, 0) -
                          filteredAdminInvoices.reduce((s, i) => {
                            if (i.paymentStatus === 'paid') return s + i.finalTotal;
                            if (i.paymentStatus === 'partial') return s + (i.paidAmount || 0);
                            return s;
                          }, 0)
                      ),
                      formData.currency
                    )}
                  </span>
                </div>
              </div>

              {/* Filter bar */}
              <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-200/90">
                <div className="relative flex-1 max-w-md">
                  <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    id="admin-invoice-search-input"
                    placeholder="جستجو بر اساس شماره فاکتور، نام خریدار یا تلفن..."
                    value={adminInvoiceSearch}
                    onChange={(e) => setAdminInvoiceSearch(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl pr-9 pl-4 py-2 text-xs text-slate-800 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
                  />
                </div>

                <div className="flex bg-white border border-slate-200 rounded-xl p-1 text-xs self-start sm:self-auto">
                  <button
                    type="button"
                    onClick={() => setAdminInvoiceStatus('all')}
                    className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                      adminInvoiceStatus === 'all'
                        ? 'bg-slate-900 text-white font-medium'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    همه ({toPersianDigits(invoices.length)})
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdminInvoiceStatus('paid')}
                    className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                      adminInvoiceStatus === 'paid'
                        ? 'bg-emerald-600 text-white font-medium'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    تسویه شده
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdminInvoiceStatus('partial')}
                    className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                      adminInvoiceStatus === 'partial'
                        ? 'bg-amber-600 text-white font-medium'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    اقساطی / بیعانه
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdminInvoiceStatus('unpaid')}
                    className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                      adminInvoiceStatus === 'unpaid'
                        ? 'bg-rose-600 text-white font-medium'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    نسیه
                  </button>
                </div>
              </div>

              {/* Table of Invoices */}
              <div className="border border-slate-200 rounded-xl overflow-hidden overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-100/80 text-slate-700 font-bold border-b border-slate-200">
                    <tr>
                      <th className="p-3 w-12 text-center">#</th>
                      <th className="p-3">شماره فاکتور</th>
                      <th className="p-3">تاریخ و ساعت</th>
                      <th className="p-3">خریدار / مشتری</th>
                      <th className="p-3">تعداد اقلام</th>
                      <th className="p-3">مبلغ کل</th>
                      <th className="p-3">وضعیت تسویه</th>
                      <th className="p-3">روش پرداخت</th>
                      <th className="p-3 text-center">عملیات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredAdminInvoices.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="p-8 text-center text-slate-400">
                          هیچ فاکتوری با معیارهای جستجو یافت نشد.
                        </td>
                      </tr>
                    ) : (
                      filteredAdminInvoices.map((inv, idx) => (
                        <tr
                          key={inv.id}
                          className={`${
                            idx % 2 === 1 ? 'bg-slate-50/85' : 'bg-white'
                          } hover:bg-slate-100/80 transition-colors`}
                        >
                          <td className="p-3 text-center text-slate-400 font-mono">{toPersianDigits(idx + 1)}</td>
                          <td className="p-3 font-mono font-bold text-slate-900">#{toPersianDigits(inv.invoiceNumber)}</td>
                          <td className="p-3 text-slate-500 font-mono text-[11px]">
                            {inv.date}
                          </td>
                          <td className="p-3">
                            <div className="font-bold text-slate-800">{inv.customerName || 'مشتری گذری'}</div>
                            {inv.customerPhone && <div className="text-[10px] text-slate-400 font-mono">{inv.customerPhone}</div>}
                          </td>
                          <td className="p-3 text-slate-600">{toPersianDigits(inv.items?.length || 0)} قلم</td>
                          <td className="p-3 font-black text-slate-900">{formatPrice(inv.finalTotal, formData.currency)}</td>
                          <td className="p-3">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                inv.paymentStatus === 'paid'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : inv.paymentStatus === 'partial'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-rose-100 text-rose-800'
                              }`}
                            >
                              {inv.paymentStatus === 'paid'
                                ? 'تسویه کامل'
                                : inv.paymentStatus === 'partial'
                                ? 'اقساط / بیعانه'
                                : 'نسیه'}
                            </span>
                          </td>
                          <td className="p-3 text-slate-500 text-[11px]">
                            {inv.paymentMethod === 'pos'
                              ? 'کارتخوان'
                              : inv.paymentMethod === 'cash'
                              ? 'نقدی'
                              : inv.paymentMethod === 'transfer'
                              ? 'واریز/شبا'
                              : inv.paymentMethod === 'cheque'
                              ? 'چک'
                              : inv.paymentMethod === 'credit'
                              ? 'نسیه'
                              : 'سایر'}
                          </td>
                          <td className="p-3 text-center">
                            <button
                              type="button"
                              onClick={() => onNavigateToTab('invoices')}
                              className="p-1.5 text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                              title="مشاهده فاکتور در صفحه فاکتورها"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ACTIVITY LOGS (لاگ فعالیت و رویدادها) */}
          {activeSection === 'logs' && (
            <ActivityLogsViewer currentUser={currentUser} users={users} />
          )}

          {/* WAREHOUSE SETTINGS & DEFINITIONS SECTION (تنظیمات و تعریف انبارها) */}
          {activeSection === 'warehouses' && (
            <WarehouseSettingsManager
              settings={formData}
              products={products}
              movements={movements}
              onSaveSettings={(newSettings) => {
                setFormData(newSettings);
                onSaveSettings(newSettings);
                StorageService.saveSettings(newSettings);
                setSaveSuccess(true);
                setTimeout(() => setSaveSuccess(false), 2500);
              }}
              onNavigateToTab={onNavigateToTab}
            />
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
                    <div className="pt-1">
                      <button
                        type="button"
                        id="modules-goto-warehouses-btn"
                        onClick={() => setActiveSection('warehouses')}
                        className="inline-flex items-center gap-1.5 text-[11px] text-amber-700 bg-amber-50 hover:bg-amber-100 font-bold px-2.5 py-1 rounded-lg border border-amber-200 transition-colors cursor-pointer"
                      >
                        <Warehouse className="w-3.5 h-3.5 text-amber-600" />
                        <span>پیکربندی انبارها و انبار مبدأ حواله خروج</span>
                        <span>←</span>
                      </button>
                    </div>
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

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
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

                  {/* Template 2: Simple & Clean */}
                  <div className={`p-4 rounded-xl border-2 transition-all flex flex-col justify-between ${
                    formData.enableSimpleTemplate !== false ? 'border-emerald-500 bg-emerald-50/20' : 'border-slate-200 opacity-60'
                  }`}>
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <FileSpreadsheet className="w-5 h-5 text-indigo-600" />
                        <button
                          type="button"
                          onClick={() => handleToggle('enableSimpleTemplate')}
                          className={`text-xs font-bold px-2 py-0.5 rounded cursor-pointer ${
                            formData.enableSimpleTemplate !== false ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-700'
                          }`}
                        >
                          {formData.enableSimpleTemplate !== false ? 'فعال' : 'غیرفعال'}
                        </button>
                      </div>
                      <h4 className="font-bold text-xs text-slate-800">قالب ساده و خوانا (جدول منظم)</h4>
                      <p className="text-[11px] text-slate-500 mt-1">
                        چیدمان منظم با جدول ساده و وضوح و خوانایی بسیار بالا برای PDF و پرینت.
                      </p>
                    </div>
                  </div>

                  {/* Template 3: Official */}
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

                  {/* Template 4: Thermal */}
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
                    <option value="simple">فاکتور ساده و خوانا (جدول منظم و مقادیر شفاف)</option>
                    <option value="official">فاکتور رسمی دارایی</option>
                    <option value="thermal">رسید حرارتی ۸۰ میلی‌متری</option>
                  </select>
                </div>

                {/* Exit Slip Template Choice */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <span className="text-xs font-bold text-slate-700 block">قالب پیش‌فرض حواله خروج کالا از انبار:</span>
                    <span className="text-[11px] text-slate-500">طرح‌بندی پیش‌فرض هنگام مشاهده، چاپ و صدور PDF حواله خروج</span>
                  </div>
                  <select
                    name="defaultExitSlipTemplate"
                    value={formData.defaultExitSlipTemplate || 'standard'}
                    onChange={handleInputChange}
                    className="bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-emerald-500"
                  >
                    <option value="standard">حواله استاندارد انبارداری</option>
                    <option value="simple">حواله ساده و خوانا (جدول منظم و خوانایی بالا)</option>
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

              {/* Part C: PDF Quality Settings for Invoices & Exit Slips */}
              <div className="space-y-6 pt-6 border-t border-slate-100">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                      <FileDown className="w-5 h-5 text-indigo-600" />
                      تنظیمات کیفیت فایل خروجی PDF (فاکتورها و حواله خروج انبار)
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">
                      میزان کیفیت تصویر، وضوح چاپ متون و حجم نهایی فایل‌های PDF را با توجه به سرعت اینترنت و نوع استفاده خود تنظیم نمایید.
                    </p>
                  </div>

                  {/* Sync Toggle */}
                  <label className="flex items-center gap-2 text-xs font-bold text-slate-700 bg-slate-50 hover:bg-slate-100 px-3 py-2 rounded-xl border border-slate-200 cursor-pointer select-none transition-colors shrink-0">
                    <input
                      type="checkbox"
                      checked={!!formData.pdfSyncQuality}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setFormData((prev) => ({
                          ...prev,
                          pdfSyncQuality: checked,
                          ...(checked && prev.pdfInvoiceQuality
                            ? { pdfExitSlipQuality: prev.pdfInvoiceQuality }
                            : {}),
                        }));
                      }}
                      className="w-4 h-4 text-emerald-600 rounded"
                    />
                    <span>اعمال کیفیت یکسان برای هر دو بخش</span>
                  </label>
                </div>

                {/* Sub-section 1: Invoice PDF Quality */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-emerald-600" />
                      <span className="text-xs font-black text-slate-800">
                        کیفیت خروجی PDF فاکتورهای فروش و پیش‌فاکتور
                      </span>
                    </div>
                    <span className="text-[11px] font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg">
                      کیفیت فعلی: {PDF_QUALITY_PRESETS[formData.pdfInvoiceQuality || 'standard']?.label}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {(Object.keys(PDF_QUALITY_PRESETS) as PdfQualityPreset[]).map((key) => {
                      const preset = PDF_QUALITY_PRESETS[key];
                      const isSelected = (formData.pdfInvoiceQuality || 'standard') === key;
                      return (
                        <div
                          key={key}
                          onClick={() => {
                            setFormData((prev) => ({
                              ...prev,
                              pdfInvoiceQuality: key,
                              ...(prev.pdfSyncQuality ? { pdfExitSlipQuality: key } : {}),
                            }));
                          }}
                          className={`p-3.5 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between relative select-none active:scale-[0.99] ${
                            isSelected
                              ? 'border-emerald-600 bg-emerald-50/40 ring-2 ring-emerald-500/20 shadow-xs'
                              : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/60'
                          }`}
                        >
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span
                                className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                                  key === 'economy'
                                    ? 'bg-amber-100 text-amber-800'
                                    : key === 'standard'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : key === 'high'
                                    ? 'bg-blue-100 text-blue-800'
                                    : 'bg-purple-100 text-purple-800'
                                }`}
                              >
                                {preset.badge}
                              </span>
                              <div
                                className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                                  isSelected
                                    ? 'border-emerald-600 bg-emerald-600 text-white'
                                    : 'border-slate-300'
                                }`}
                              >
                                {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                              </div>
                            </div>
                            <h4 className="font-bold text-xs text-slate-900 leading-snug">
                              {preset.label}
                            </h4>
                            <p className="text-[11px] text-slate-500 leading-relaxed">
                              {preset.description}
                            </p>
                          </div>

                          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px]">
                            <span className="text-slate-400">حجم تقریبی:</span>
                            <span className="font-bold font-mono text-slate-700 dir-ltr">
                              {preset.approxSize}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Sub-section 2: Exit Slip PDF Quality */}
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Warehouse className="w-4 h-4 text-amber-600" />
                      <span className="text-xs font-black text-slate-800">
                        کیفیت خروجی PDF حواله خروج انبار و بارگیری
                      </span>
                    </div>
                    <span className="text-[11px] font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg">
                      کیفیت فعلی: {PDF_QUALITY_PRESETS[formData.pdfExitSlipQuality || 'high']?.label}
                    </span>
                  </div>

                  {formData.pdfSyncQuality ? (
                    <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-3.5 flex items-center justify-between text-xs text-slate-600">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>
                          کیفیت حواله خروج انبار بر اساس گزینه «اعمال کیفیت یکسان»، با فاکتور فروش هماهنگ است ({PDF_QUALITY_PRESETS[formData.pdfInvoiceQuality || 'standard']?.label}).
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setFormData((prev) => ({ ...prev, pdfSyncQuality: false }))}
                        className="text-[11px] text-indigo-600 font-bold hover:underline cursor-pointer"
                      >
                        تنظیم مستقل
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                      {(Object.keys(PDF_QUALITY_PRESETS) as PdfQualityPreset[]).map((key) => {
                        const preset = PDF_QUALITY_PRESETS[key];
                        const isSelected = (formData.pdfExitSlipQuality || 'high') === key;
                        return (
                          <div
                            key={key}
                            onClick={() => {
                              setFormData((prev) => ({
                                ...prev,
                                pdfExitSlipQuality: key,
                              }));
                            }}
                            className={`p-3.5 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between relative select-none active:scale-[0.99] ${
                              isSelected
                                ? 'border-amber-600 bg-amber-50/40 ring-2 ring-amber-500/20 shadow-xs'
                                : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/60'
                            }`}
                          >
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <span
                                  className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                                    key === 'economy'
                                      ? 'bg-amber-100 text-amber-800'
                                      : key === 'standard'
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : key === 'high'
                                      ? 'bg-blue-100 text-blue-800'
                                      : 'bg-purple-100 text-purple-800'
                                  }`}
                                >
                                  {preset.badge}
                                </span>
                                <div
                                  className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                                    isSelected
                                      ? 'border-amber-600 bg-amber-600 text-white'
                                      : 'border-slate-300'
                                  }`}
                                >
                                  {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                                </div>
                              </div>
                              <h4 className="font-bold text-xs text-slate-900 leading-snug">
                                {preset.label}
                              </h4>
                              <p className="text-[11px] text-slate-500 leading-relaxed">
                                {preset.description}
                              </p>
                            </div>

                            <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px]">
                              <span className="text-slate-400">حجم تقریبی:</span>
                              <span className="font-bold font-mono text-slate-700 dir-ltr">
                                {preset.approxSize}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Practical Advice Banner */}
                <div className="bg-indigo-50/50 border border-indigo-100 rounded-2xl p-4 flex items-start gap-3 text-xs text-indigo-950">
                  <Sparkles className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <span className="font-bold block">راهنمای بهینه‌سازی حجم و کیفیت:</span>
                    <p className="text-[11px] text-indigo-800/90 leading-relaxed">
                      • اگر فاکتورها را به مشتریان از طریق پیام‌رسان‌ها مانند ایتا، بله یا واتساپ ارسال می‌کنید، گزینه <strong>«اقتصادی»</strong> یا <strong>«استاندارد»</strong> بیشترین سرعت دانلود و کمترین مصرف اینترنت را فراهم می‌کند.
                      <br />
                      • اگر فاکتورها یا حواله‌های خروج انبار را مستقیماً برای بایگانی سازمانی و پرینت با چاپگرهای لیزری نیاز دارید، گزینه <strong>«کیفیت بالا»</strong> یا <strong>«Ultra HD»</strong> شفاف‌ترین خطوط و بارکدها را ایجاد می‌کند.
                    </p>
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

          {/* TELEGRAM BOT SETTINGS (ارسال مستقیم فایل PDF به تلگرام) */}
          {activeSection === 'telegram' && (
            <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 shadow-xs space-y-6">
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-[#229ED9] text-white flex items-center justify-center shadow-md shadow-blue-500/20 shrink-0">
                    <Send className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                      <span>تنظیمات ربات تلگرام و ارسال مستقیم فایل PDF</span>
                      <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                        formData.telegramBotEnabled
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                          : 'bg-slate-100 text-slate-600 border border-slate-200'
                      }`}>
                        {formData.telegramBotEnabled ? 'سرویس فعال است' : 'سرویس غیرفعال'}
                      </span>
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">
                      ارسال بی‌واسطه و بدون فیلتر فایل‌های PDF فاکتورهای فروش و حواله‌های خروج انبار به چت، کانال یا گروه تلگرام
                    </p>
                  </div>
                </div>

                {/* Save button shortcut */}
                <button
                  type="button"
                  onClick={() => handleSave()}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer self-start sm:self-auto"
                >
                  <Save className="w-4 h-4" />
                  <span>ذخیره تنظیمات</span>
                </button>
              </div>

              {/* 1. Main Enable/Disable Toggle Card */}
              <div className={`p-4 rounded-xl border transition-all ${
                formData.telegramBotEnabled
                  ? 'bg-blue-50/60 border-blue-200'
                  : 'bg-slate-50 border-slate-200'
              }`}>
                <label className="flex items-center justify-between gap-3 cursor-pointer">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                      formData.telegramBotEnabled ? 'bg-[#229ED9] text-white' : 'bg-slate-200 text-slate-500'
                    }`}>
                      <Bot className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="font-bold text-slate-800 text-xs sm:text-sm block">
                        فعال‌سازی سرویس ارسال مستقیم به تلگرام
                      </span>
                      <span className="text-[11px] text-slate-500">
                        با فعال‌بودن این گزینه، دکمه «ارسال مستقیم PDF به تلگرام» در پنجره‌های فاکتور و حواله خروج فعال می‌شود.
                      </span>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    name="telegramBotEnabled"
                    checked={!!formData.telegramBotEnabled}
                    onChange={(e) => setFormData(prev => ({ ...prev, telegramBotEnabled: e.target.checked }))}
                    className="w-5 h-5 rounded text-[#229ED9] focus:ring-[#229ED9] border-slate-300 cursor-pointer"
                  />
                </label>
              </div>

              {/* 2. Bot Token Card */}
              <div className="p-4 sm:p-5 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    توکن اختصاصی ربات تلگرام (Bot Token) <span className="text-rose-500">*</span>
                  </label>
                  <p className="text-[11px] text-slate-500 mb-2 leading-relaxed">
                    توکن محرمانه‌ای که پس از ساخت ربات از BotFather تلگرام دریافت کرده‌اید.
                  </p>

                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <input
                        type={showBotToken ? 'text' : 'password'}
                        name="telegramBotToken"
                        dir="ltr"
                        placeholder="123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ"
                        value={formData.telegramBotToken || ''}
                        onChange={(e) => {
                          setFormData(prev => ({ ...prev, telegramBotToken: e.target.value }));
                          if (botTestResult) setBotTestResult(null);
                        }}
                        className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs font-mono text-left text-slate-800 outline-none focus:border-blue-500 pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowBotToken(!showBotToken)}
                        className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                        title={showBotToken ? 'مخفی کردن توکن' : 'نمایش توکن'}
                      >
                        {showBotToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={handleTestBotConnection}
                      disabled={isTestingBot || !formData.telegramBotToken?.trim()}
                      className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs transition-all shadow-xs cursor-pointer shrink-0"
                    >
                      {isTestingBot ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>در حال بررسی...</span>
                        </>
                      ) : (
                        <>
                          <Zap className="w-4 h-4 text-amber-300" />
                          <span>تست اتصال به ربات</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Bot Test Feedback Banner */}
                {botTestResult && (
                  <div className={`p-3 rounded-xl border text-xs flex items-center justify-between gap-2 animate-fadeIn ${
                    botTestResult.success
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      : 'bg-rose-50 border-rose-200 text-rose-800'
                  }`}>
                    <div className="flex items-center gap-2">
                      {botTestResult.success ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                      )}
                      <span>{botTestResult.message}</span>
                    </div>
                    {botTestResult.botInfo && (
                      <span className="font-mono text-[11px] bg-emerald-100 text-emerald-900 px-2 py-0.5 rounded font-bold shrink-0">
                        @{botTestResult.botInfo.username}
                      </span>
                    )}
                  </div>
                )}

                {/* BotFather Guide Accordion */}
                <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl text-xs space-y-1.5 text-blue-900">
                  <div className="font-bold flex items-center gap-1.5 text-blue-950">
                    <HelpCircle className="w-4 h-4 text-blue-600" />
                    <span>راهنمای ۱ دقیقه‌ای دریافت توکن از تلگرام:</span>
                  </div>
                  <ol className="list-decimal list-inside space-y-1 text-[11px] text-blue-800 pr-1 leading-relaxed">
                    <li>در تلگرام وارد ربات رسمی <strong>@BotFather</strong> شوید.</li>
                    <li>دستور <code>/newbot</code> را ارسال کرده و نام و سپس نام کاربری (که به bot ختم شود) تعیین نمایید.</li>
                    <li>کد توکنی که BotFather به شما می‌دهد (شبیه <code>123456789:ABCdef...</code>) را کپی کرده و در کادر بالا وارد کنید.</li>
                  </ol>
                </div>
              </div>

              {/* 3. Default Chat / Channel / Group ID Card */}
              <div className="p-4 sm:p-5 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    شناسه پیش‌فرض چت، کانال یا گروه مقصد (Chat ID) <span className="text-rose-500">*</span>
                  </label>
                  <p className="text-[11px] text-slate-500 mb-2 leading-relaxed">
                    فایل‌های PDF ارسالی به صورت پیش‌فرض به این چت یا کانال فرستاده خواهند شد.
                  </p>

                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      name="telegramChatId"
                      dir="ltr"
                      placeholder="مثال: 123456789 یا @MyStoreChannel یا -1001234567890"
                      value={formData.telegramChatId || ''}
                      onChange={(e) => {
                        setFormData(prev => ({ ...prev, telegramChatId: e.target.value }));
                        if (msgTestResult) setMsgTestResult(null);
                      }}
                      className="flex-1 bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs font-mono text-left text-slate-800 outline-none focus:border-blue-500"
                    />

                    <button
                      type="button"
                      onClick={handleTestTelegramMessage}
                      disabled={isTestingMsg || !formData.telegramBotToken?.trim() || !formData.telegramChatId?.trim()}
                      className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-900 disabled:opacity-50 text-white font-bold text-xs transition-all shadow-xs cursor-pointer shrink-0"
                    >
                      {isTestingMsg ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>در حال ارسال پیام...</span>
                        </>
                      ) : (
                        <>
                          <MessageSquare className="w-4 h-4 text-emerald-400" />
                          <span>ارسال پیام آزمایشی</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Message Test Feedback Banner */}
                {msgTestResult && (
                  <div className={`p-3 rounded-xl border text-xs flex items-center gap-2 animate-fadeIn ${
                    msgTestResult.success
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      : 'bg-rose-50 border-rose-200 text-rose-800'
                  }`}>
                    {msgTestResult.success ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    )}
                    <span>{msgTestResult.message}</span>
                  </div>
                )}

                {/* Chat ID Guide Box */}
                <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl text-xs space-y-1.5 text-amber-900">
                  <div className="font-bold flex items-center gap-1.5 text-amber-950">
                    <HelpCircle className="w-4 h-4 text-amber-600" />
                    <span>نحوه پیدا کردن Chat ID یا اتصال به کانال/گروه:</span>
                  </div>
                  <ul className="list-disc list-inside space-y-1 text-[11px] text-amber-800 pr-1 leading-relaxed">
                    <li>
                      <strong>ارسال به پی‌وی تلگرام خودتان:</strong> در تلگرام وارد ربات <code>@userinfobot</code> شوید تا عدد Chat ID شما را نمایش دهد. همچنین حتماً قبل از اولین ارسال، یکبار به ربات ساخته‌شده خودتان پیام <code>/start</code> بفرستید.
                    </li>
                    <li>
                      <strong>ارسال به کانال یا گروه:</strong> ربات خود را به کانال یا گروه فروشگاه اضافه کرده و آن را <strong>ادمین (مدیر) با دسترسی ارسال پیام</strong> قرار دهید؛ سپس آیدی عمومی کانال (مانند <code>@MyStoreChannel</code>) یا آیدی عددی گروه را اینجا وارد کنید.
                    </li>
                  </ul>
                </div>
              </div>

              {/* 4. Automated Dispatch Settings (تنظیمات ارسال خودکار و اتوماسیون) */}
              <div className="p-4 sm:p-5 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <h4 className="font-bold text-slate-800 text-xs sm:text-sm flex items-center gap-2">
                    <SlidersHorizontal className="w-4 h-4 text-[#229ED9]" />
                    <span>تنظیمات ارسال خودکار و اتوماسیون (اختیاری)</span>
                  </h4>
                  <span className="text-[11px] bg-blue-100/70 text-blue-900 font-bold px-2.5 py-0.5 rounded-full">
                    ارسال آنی پس از تأیید در تلگرام
                  </span>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  با فعال‌سازی هریک از گزینه‌های زیر، سیستم به محض تایید نهایی سند، فایل رسمی PDF یا خلاصه تراکنش را به صورت خودکار و بدون نیاز به اقدام دستی به چت یا کانال تلگرام ارسال می‌نماید:
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  {/* 1. Auto-send Confirmed Invoices */}
                  <label className="p-3.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50/80 flex items-start justify-between gap-3 cursor-pointer transition-all shadow-xs">
                    <div className="space-y-1">
                      <span className="font-bold text-slate-800 text-xs block">
                        ارسال خودکار PDF فاکتورهای تایید شده
                      </span>
                      <span className="text-[11px] text-slate-500 leading-relaxed block">
                        بلافاصله پس از ثبت نهایی فاکتور فروش در سیستم
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      name="telegramAutoSendInvoice"
                      checked={!!formData.telegramAutoSendInvoice}
                      onChange={(e) => setFormData(prev => ({ ...prev, telegramAutoSendInvoice: e.target.checked }))}
                      className="w-4 h-4 mt-0.5 rounded text-[#229ED9] focus:ring-[#229ED9] border-slate-300 cursor-pointer shrink-0"
                    />
                  </label>

                  {/* 2. Auto-send On Proforma Conversion (بعد از تایید) */}
                  <label className="p-3.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50/80 flex items-start justify-between gap-3 cursor-pointer transition-all shadow-xs">
                    <div className="space-y-1">
                      <span className="font-bold text-slate-800 text-xs block text-indigo-950">
                        ارسال خودکار بعد از تایید و تبدیل پیش‌فاکتور
                      </span>
                      <span className="text-[11px] text-slate-500 leading-relaxed block">
                        به محض تایید مشتری و تبدیل پیش‌فاکتور به فاکتور رسمی
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      name="telegramAutoSendOnProformaConvert"
                      checked={formData.telegramAutoSendOnProformaConvert !== false}
                      onChange={(e) => setFormData(prev => ({ ...prev, telegramAutoSendOnProformaConvert: e.target.checked }))}
                      className="w-4 h-4 mt-0.5 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 cursor-pointer shrink-0"
                    />
                  </label>

                  {/* 3. Send ONLY after confirmation (Don't send draft proformas) */}
                  <label className="p-3.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50/80 flex items-start justify-between gap-3 cursor-pointer transition-all shadow-xs">
                    <div className="space-y-1">
                      <span className="font-bold text-slate-800 text-xs block">
                        ارسال خودکار فقط بعد از تایید نهایی
                      </span>
                      <span className="text-[11px] text-slate-500 leading-relaxed block">
                        پیش‌فاکتورهای اولیه ارسال نشوند و فقط پس از تایید ارسال انجام شود
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      name="telegramAutoSendOnlyConfirmed"
                      checked={formData.telegramAutoSendOnlyConfirmed !== false}
                      onChange={(e) => setFormData(prev => ({ ...prev, telegramAutoSendOnlyConfirmed: e.target.checked }))}
                      className="w-4 h-4 mt-0.5 rounded text-[#229ED9] focus:ring-[#229ED9] border-slate-300 cursor-pointer shrink-0"
                    />
                  </label>

                  {/* 4. Auto-send Exit Slip after delivery confirmation */}
                  <label className="p-3.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50/80 flex items-start justify-between gap-3 cursor-pointer transition-all shadow-xs">
                    <div className="space-y-1">
                      <span className="font-bold text-slate-800 text-xs block">
                        ارسال خودکار PDF حواله خروج پس از تایید تحویل
                      </span>
                      <span className="text-[11px] text-slate-500 leading-relaxed block">
                        بلافاصله پس از تایید تحویل بار و ثبت مشخصات راننده
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      name="telegramAutoSendExitSlip"
                      checked={!!formData.telegramAutoSendExitSlip}
                      onChange={(e) => setFormData(prev => ({ ...prev, telegramAutoSendExitSlip: e.target.checked }))}
                      className="w-4 h-4 mt-0.5 rounded text-[#229ED9] focus:ring-[#229ED9] border-slate-300 cursor-pointer shrink-0"
                    />
                  </label>

                  {/* 5. Auto-send Inbound Receipt after warehouse keeper verification */}
                  <label className="p-3.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50/80 flex items-start justify-between gap-3 cursor-pointer transition-all shadow-xs">
                    <div className="space-y-1">
                      <span className="font-bold text-slate-800 text-xs block">
                        ارسال خودکار رسید ورود انبار پس از شمارش و تایید
                      </span>
                      <span className="text-[11px] text-slate-500 leading-relaxed block">
                        به محض تایید ورود اقلام و کنترل فیزیکی کالاها توسط انباردار
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      name="telegramAutoSendInboundReceipt"
                      checked={!!formData.telegramAutoSendInboundReceipt}
                      onChange={(e) => setFormData(prev => ({ ...prev, telegramAutoSendInboundReceipt: e.target.checked }))}
                      className="w-4 h-4 mt-0.5 rounded text-[#229ED9] focus:ring-[#229ED9] border-slate-300 cursor-pointer shrink-0"
                    />
                  </label>

                  {/* 6. Prioritize Customer Direct Chat */}
                  <label className="p-3.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50/80 flex items-start justify-between gap-3 cursor-pointer transition-all shadow-xs">
                    <div className="space-y-1">
                      <span className="font-bold text-slate-800 text-xs block">
                        ارسال مستقیم به تلگرام اختصاصی مشتری
                      </span>
                      <span className="text-[11px] text-slate-500 leading-relaxed block">
                        در صورت ثبت Chat ID برای مشتری، فاکتور مستقیماً به تلگرام او فرستاده شود
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      name="telegramAutoSendCustomerDirect"
                      checked={formData.telegramAutoSendCustomerDirect !== false}
                      onChange={(e) => setFormData(prev => ({ ...prev, telegramAutoSendCustomerDirect: e.target.checked }))}
                      className="w-4 h-4 mt-0.5 rounded text-[#229ED9] focus:ring-[#229ED9] border-slate-300 cursor-pointer shrink-0"
                    />
                  </label>
                </div>

                {/* 4.1 Telegram PDF Paper Size & Orientation Controls */}
                <div className="pt-3 border-t border-slate-200/80 space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <h5 className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                      <FileText className="w-4 h-4 text-indigo-600" />
                      <span>تنظیمات سایز و حالت کاغذ (افقی / عمودی) برای ارسال خودکار به تلگرام</span>
                    </h5>
                    <span className="text-[11px] text-slate-500">
                      انتخاب قطع کاغذ و جهت صفحه خروجی PDF ارسالی به ربات
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                    {/* Invoice Paper Config */}
                    <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs space-y-3">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                        <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                          <Receipt className="w-3.5 h-3.5 text-[#229ED9]" />
                          <span>فاکتور فروش ارسالی به تلگرام</span>
                        </span>
                        <span className="text-[10px] font-mono font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                          {(formData.telegramInvoicePageSize || 'a4').toUpperCase()} - {formData.telegramInvoiceOrientation === 'landscape' ? 'افقی' : 'عمودی'} - {(formData.telegramInvoiceTemplate || 'standard') === 'simple' ? 'قالب ساده' : 'قالب استاندارد'}
                        </span>
                      </div>

                      {/* Size Selector */}
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-medium text-slate-600 block">
                          قطع و سایز کاغذ:
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => setFormData(prev => ({ ...prev, telegramInvoicePageSize: 'a4' }))}
                            className={`p-2 rounded-lg text-xs font-bold border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                              (formData.telegramInvoicePageSize || 'a4') === 'a4'
                                ? 'border-[#229ED9] bg-[#229ED9]/10 text-[#006699] ring-1 ring-[#229ED9]/30'
                                : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                            }`}
                          >
                            <FileText className="w-3.5 h-3.5" />
                            <span>A4 (قطع استاندارد)</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setFormData(prev => ({ ...prev, telegramInvoicePageSize: 'a5' }))}
                            className={`p-2 rounded-lg text-xs font-bold border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                              formData.telegramInvoicePageSize === 'a5'
                                ? 'border-[#229ED9] bg-[#229ED9]/10 text-[#006699] ring-1 ring-[#229ED9]/30'
                                : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                            }`}
                          >
                            <FileText className="w-3.5 h-3.5" />
                            <span>A5 (قطع نیم‌برگ)</span>
                          </button>
                        </div>
                      </div>

                      {/* Orientation Selector */}
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-medium text-slate-600 block">
                          جهت قرارگیری صفحه (عمودی / افقی):
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => setFormData(prev => ({ ...prev, telegramInvoiceOrientation: 'portrait' }))}
                            className={`p-2 rounded-lg text-xs font-bold border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                              (formData.telegramInvoiceOrientation || 'portrait') === 'portrait'
                                ? 'border-emerald-600 bg-emerald-50 text-emerald-800 ring-1 ring-emerald-500/30'
                                : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                            }`}
                          >
                            <div className="w-2.5 h-3.5 border-2 border-current rounded-2xs shrink-0" />
                            <span>عمودی (Portrait)</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setFormData(prev => ({ ...prev, telegramInvoiceOrientation: 'landscape' }))}
                            className={`p-2 rounded-lg text-xs font-bold border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                              formData.telegramInvoiceOrientation === 'landscape'
                                ? 'border-emerald-600 bg-emerald-50 text-emerald-800 ring-1 ring-emerald-500/30'
                                : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                            }`}
                          >
                            <div className="w-3.5 h-2.5 border-2 border-current rounded-2xs shrink-0" />
                            <span>افقی (Landscape)</span>
                          </button>
                        </div>
                      </div>

                      {/* Theme / Style Selector (ساده یا استاندارد) */}
                      <div className="space-y-1.5 pt-2 border-t border-slate-100">
                        <label className="text-[11px] font-medium text-slate-600 flex items-center justify-between">
                          <span>تم و استایل قالب فاکتور:</span>
                          <span className="text-[10px] text-indigo-600 font-bold">
                            {(formData.telegramInvoiceTemplate || 'standard') === 'simple' ? 'استایل ساده و مینیمال' : 'استایل رسمی و استاندارد'}
                          </span>
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => setFormData(prev => ({ ...prev, telegramInvoiceTemplate: 'standard' }))}
                            className={`p-2 rounded-lg text-xs font-bold border transition-all cursor-pointer flex flex-col items-center justify-center gap-1 ${
                              (formData.telegramInvoiceTemplate || 'standard') === 'standard'
                                ? 'border-indigo-600 bg-indigo-50/70 text-indigo-900 ring-1 ring-indigo-500/30'
                                : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                            }`}
                          >
                            <div className="flex items-center gap-1.5">
                              <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                              <span>استایل استاندارد</span>
                            </div>
                            <span className="text-[9.5px] font-normal text-slate-500 text-center">
                              سربرگ کادربندی رسمی، اطلاعات کامل
                            </span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setFormData(prev => ({ ...prev, telegramInvoiceTemplate: 'simple' }))}
                            className={`p-2 rounded-lg text-xs font-bold border transition-all cursor-pointer flex flex-col items-center justify-center gap-1 ${
                              formData.telegramInvoiceTemplate === 'simple'
                                ? 'border-indigo-600 bg-indigo-50/70 text-indigo-900 ring-1 ring-indigo-500/30'
                                : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                            }`}
                          >
                            <div className="flex items-center gap-1.5">
                              <FileText className="w-3.5 h-3.5 text-indigo-600" />
                              <span>استایل ساده</span>
                            </div>
                            <span className="text-[9.5px] font-normal text-slate-500 text-center">
                              جدول فلت مقادیر، تمیز و خوانا
                            </span>
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Exit Slip Paper Config */}
                    <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs space-y-3">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                        <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                          <Warehouse className="w-3.5 h-3.5 text-amber-600" />
                          <span>حواله خروج انبار در تلگرام</span>
                        </span>
                        <span className="text-[10px] font-mono font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                          {(formData.telegramExitSlipPageSize || 'a4').toUpperCase()} - {formData.telegramExitSlipOrientation === 'landscape' ? 'افقی' : 'عمودی'} - {(formData.telegramExitSlipTemplate || 'standard') === 'simple' ? 'قالب ساده' : 'قالب استاندارد'}
                        </span>
                      </div>

                      {/* Size Selector */}
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-medium text-slate-600 block">
                          قطع و سایز کاغذ:
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => setFormData(prev => ({ ...prev, telegramExitSlipPageSize: 'a4' }))}
                            className={`p-2 rounded-lg text-xs font-bold border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                              (formData.telegramExitSlipPageSize || 'a4') === 'a4'
                                ? 'border-amber-600 bg-amber-50 text-amber-900 ring-1 ring-amber-500/30'
                                : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                            }`}
                          >
                            <FileText className="w-3.5 h-3.5" />
                            <span>A4 (قطع استاندارد)</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setFormData(prev => ({ ...prev, telegramExitSlipPageSize: 'a5' }))}
                            className={`p-2 rounded-lg text-xs font-bold border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                              formData.telegramExitSlipPageSize === 'a5'
                                ? 'border-amber-600 bg-amber-50 text-amber-900 ring-1 ring-amber-500/30'
                                : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                            }`}
                          >
                            <FileText className="w-3.5 h-3.5" />
                            <span>A5 (قطع نیم‌برگ)</span>
                          </button>
                        </div>
                      </div>

                      {/* Orientation Selector */}
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-medium text-slate-600 block">
                          جهت قرارگیری صفحه (عمودی / افقی):
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => setFormData(prev => ({ ...prev, telegramExitSlipOrientation: 'portrait' }))}
                            className={`p-2 rounded-lg text-xs font-bold border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                              (formData.telegramExitSlipOrientation || 'portrait') === 'portrait'
                                ? 'border-emerald-600 bg-emerald-50 text-emerald-800 ring-1 ring-emerald-500/30'
                                : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                            }`}
                          >
                            <div className="w-2.5 h-3.5 border-2 border-current rounded-2xs shrink-0" />
                            <span>عمودی (Portrait)</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setFormData(prev => ({ ...prev, telegramExitSlipOrientation: 'landscape' }))}
                            className={`p-2 rounded-lg text-xs font-bold border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                              formData.telegramExitSlipOrientation === 'landscape'
                                ? 'border-emerald-600 bg-emerald-50 text-emerald-800 ring-1 ring-emerald-500/30'
                                : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                            }`}
                          >
                            <div className="w-3.5 h-2.5 border-2 border-current rounded-2xs shrink-0" />
                            <span>افقی (Landscape)</span>
                          </button>
                        </div>
                      </div>

                      {/* Theme / Style Selector (ساده یا استاندارد) */}
                      <div className="space-y-1.5 pt-2 border-t border-slate-100">
                        <label className="text-[11px] font-medium text-slate-600 flex items-center justify-between">
                          <span>تم و استایل حواله خروج:</span>
                          <span className="text-[10px] text-amber-700 font-bold">
                            {(formData.telegramExitSlipTemplate || 'standard') === 'simple' ? 'استایل ساده و بهینه' : 'استایل رسمی و استاندارد'}
                          </span>
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => setFormData(prev => ({ ...prev, telegramExitSlipTemplate: 'standard' }))}
                            className={`p-2 rounded-lg text-xs font-bold border transition-all cursor-pointer flex flex-col items-center justify-center gap-1 ${
                              (formData.telegramExitSlipTemplate || 'standard') === 'standard'
                                ? 'border-amber-600 bg-amber-50/70 text-amber-900 ring-1 ring-amber-500/30'
                                : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                            }`}
                          >
                            <div className="flex items-center gap-1.5">
                              <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                              <span>استایل استاندارد</span>
                            </div>
                            <span className="text-[9.5px] font-normal text-slate-500 text-center">
                              کادربندی بارگیری، پلاک و امضا
                            </span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setFormData(prev => ({ ...prev, telegramExitSlipTemplate: 'simple' }))}
                            className={`p-2 rounded-lg text-xs font-bold border transition-all cursor-pointer flex flex-col items-center justify-center gap-1 ${
                              formData.telegramExitSlipTemplate === 'simple'
                                ? 'border-amber-600 bg-amber-50/70 text-amber-900 ring-1 ring-amber-500/30'
                                : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                            }`}
                          >
                            <div className="flex items-center gap-1.5">
                              <FileText className="w-3.5 h-3.5 text-amber-600" />
                              <span>استایل ساده</span>
                            </div>
                            <span className="text-[9.5px] font-normal text-slate-500 text-center">
                              اقلام و مقادیر متمرکز، خوانا و سریع
                            </span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Helpful Note */}
                <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200 text-emerald-900 text-[11px] flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    <strong>سیستم هوشمند اتوماسیون:</strong> اسناد بلافاصله پس از تایید رسمی کارشناس یا انباردار تولید شده و به همراه کپشن اطلاعات مالی و مشخصات سند به ربات تلگرام تحویل داده می‌شوند.
                  </span>
                </div>
              </div>

              {/* Bottom Action Footer */}
              <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-100">
                <span className="text-xs text-slate-500">
                  برای اعمال و فعال‌شدن تغییرات در تمامی بخش‌ها، کلید ذخیره را بفشارید.
                </span>
                <button
                  type="button"
                  onClick={() => handleSave()}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-emerald-600/20 cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>ذخیره نهایی تنظیمات ربات تلگرام</span>
                </button>
              </div>
            </div>
          )}

          {/* 6. DATA CENTER & BACKUP (مرکز داده و پشتیبان‌گیری) */}
          {activeSection === 'data' && (
            <div className="space-y-6">
              {/* Automated Backup & Database Hardening Manager */}
              <BackupManager currentUser={currentUser} onDataRestored={onReloadData} />

              {/* Data Center Operations (CSV Export & Sensitivity Tools) */}
              <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 shadow-xs space-y-6">
                {/* Accounting CSV Export Card */}
                <div className="p-4 rounded-xl border border-emerald-300/80 bg-emerald-50/40 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-emerald-800">
                      <FileSpreadsheet className="w-5 h-5 text-emerald-600 shrink-0" />
                      <h4 className="font-bold text-xs text-slate-800">خروجی اکسل و CSV فاکتورها (ویژه نرم‌افزارهای حسابداری)</h4>
                    </div>
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-bold self-start sm:self-auto">
                      سازگار با هلو، سپیدار، راه‌کاران، پارسیان و اکسل
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    استخراج جامع کلیه فاکتورهای فروش ثبت‌شده به همراه مشخصات خریدار، شماره تماس، کد پیگیری، اقلام فاکتور، مبالغ مالیات و تخفیفات، وضعیت تسویه و روش پرداخت با انکودینگ استاندارد UTF-8 BOM جهت گزارش‌گیری و ثبت اسناد حسابداری.
                  </p>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <button
                      type="button"
                      id="admin-datacenter-export-csv-btn"
                      onClick={() => exportInvoicesToCsv(invoices, formData, 'خروجی_حسابداری_کل_فاکتورها')}
                      disabled={invoices.length === 0}
                      className="py-2.5 px-4 bg-emerald-700 hover:bg-emerald-800 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Download className="w-4 h-4" />
                      <span>دانلود CSV همه فاکتورها ({toPersianDigits(invoices.length)} فاکتور)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveSection('invoices')}
                      className="py-2.5 px-4 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Filter className="w-4 h-4 text-slate-500" />
                      <span>مشاهده و فیلترگذاری قبل از خروجی</span>
                    </button>
                  </div>
                </div>

                {/* Maintenance & Reset Operations */}
                <div className="pt-2 border-t border-slate-100 space-y-4">
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
