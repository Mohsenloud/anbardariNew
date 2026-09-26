import React, { useState } from 'react';
import { StoreSettings } from '../types';
import { StorageService } from '../utils/storage';
import { 
  Settings as SettingsIcon, 
  X, 
  Save, 
  Download, 
  Upload, 
  RotateCcw, 
  CheckCircle2, 
  Building2, 
  Percent, 
  Database,
  FileCheck,
  CreditCard,
  Banknote,
  Landmark,
  ShieldCheck,
  Lock,
  Activity,
  Warehouse,
  MapPin,
  Phone,
  UserCheck,
  Hash,
  FileDown,
  Sparkles,
  Check,
  FileText,
  Receipt,
  Send,
  SlidersHorizontal,
  Zap,
  Loader2,
  AlertTriangle,
  Eye,
  EyeOff,
  MessageSquare,
  Globe
} from 'lucide-react';
import { PdfQualityPreset } from '../types';
import { PDF_QUALITY_PRESETS } from '../utils/pdfHelper';
import { testTelegramBotConnection, testTelegramMessage } from '../utils/telegramService';

interface SettingsModalProps {
  settings: StoreSettings;
  isOpen: boolean;
  onClose: () => void;
  onSaveSettings: (newSettings: StoreSettings) => void;
  onReloadData: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  settings,
  isOpen,
  onClose,
  onSaveSettings,
  onReloadData,
}) => {
  const [formData, setFormData] = useState<StoreSettings>({ ...settings });
  const [importStatus, setImportStatus] = useState<string>('');

  // Telegram Bot testing states
  const [isTestingBot, setIsTestingBot] = useState(false);
  const [botTestResult, setBotTestResult] = useState<{
    success: boolean;
    message: string;
    botInfo?: { id: number; first_name: string; username: string };
  } | null>(null);
  const [isTestingMsg, setIsTestingMsg] = useState(false);
  const [msgTestResult, setMsgTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [showBotToken, setShowBotToken] = useState(false);

  const handleTestBotConnection = async () => {
    if (!formData.telegramBotToken?.trim()) {
      setBotTestResult({ success: false, message: 'لطفاً ابتدا توکن ربات تلگرام را وارد فرمایید.' });
      return;
    }
    setIsTestingBot(true);
    setBotTestResult(null);
    try {
      const res = await testTelegramBotConnection(formData.telegramBotToken);
      if (res.success && res.bot) {
        setBotTestResult({
          success: true,
          message: `ارتباط با ربات «${res.bot.first_name}» (@${res.bot.username}) با موفقیت برقرار شد.`,
          botInfo: res.bot,
        });
      } else {
        setBotTestResult({
          success: false,
          message: res.error || 'عدم موفقیت در برقراری اتصال به ربات تلگرام.',
        });
      }
    } catch (e: any) {
      setBotTestResult({ success: false, message: 'خطا در ارتباط با سرور: ' + (e?.message || '') });
    } finally {
      setIsTestingBot(false);
    }
  };

  const handleTestTelegramMessage = async () => {
    if (!formData.telegramBotToken?.trim()) {
      setMsgTestResult({ success: false, message: 'لطفاً توکن ربات را وارد نمایید.' });
      return;
    }
    if (!formData.telegramChatId?.trim()) {
      setMsgTestResult({ success: false, message: 'لطفاً شناسه چت / گروه یا کانال مقصد را وارد کنید.' });
      return;
    }
    setIsTestingMsg(true);
    setMsgTestResult(null);
    try {
      const res = await testTelegramMessage(formData.telegramBotToken, formData.telegramChatId);
      if (res.success) {
        setMsgTestResult({ success: true, message: res.message || 'پیام آزمایشی به تلگرام ارسال گردید.' });
      } else {
        setMsgTestResult({ success: false, message: res.error || 'ارسال پیام با خطا مواجه شد.' });
      }
    } catch (e: any) {
      setMsgTestResult({ success: false, message: 'خطا در برقراری ارتباط: ' + (e?.message || '') });
    } finally {
      setIsTestingMsg(false);
    }
  };

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveSettings(formData);
    onClose();
  };

  // Export JSON backup file
  const handleExportBackup = () => {
    const jsonStr = StorageService.exportAllData();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `factor-backup-${new Date().toISOString().slice(0, 10)}.json`;
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
          setImportStatus('اطلاعات با موفقیت بازیابی شد.');
          onReloadData();
          setTimeout(() => {
            setImportStatus('');
            onClose();
          }, 1200);
        } else {
          setImportStatus('خطا: قالب فایل پشتیبان نامعتبر است.');
        }
      } catch (err) {
        setImportStatus('خطا در خواندن فایل پشتیبان.');
      }
    };
    reader.readAsText(file);
  };

  // Reset to default sample data
  const handleResetDefaults = () => {
    if (
      window.confirm(
        'آیا مطمئنید؟ تمامی داده‌ها با اطلاعات نمونه اولیه فروشگاه جایگزین خواهد شد.'
      )
    ) {
      StorageService.resetToDefaults();
      onReloadData();
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <SettingsIcon className="w-5 h-5 text-emerald-400" />
            <h3 className="font-bold text-sm">تنظیمات فروشگاه و پیکربندی فاکتور</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form */}
        <div className="overflow-y-auto p-6 space-y-6 flex-1 text-xs">
          <form id="settings-form" onSubmit={handleSubmit} className="space-y-6">
            {/* Section 1: Store Details */}
            <div className="space-y-4">
              <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2 pb-2 border-b border-slate-100">
                <Building2 className="w-4 h-4 text-emerald-600" />
                <span>مشخصات و سربرگ فروشگاه</span>
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">نام برنامه در سربرگ</label>
                  <input
                    type="text"
                    id="settings-app-name"
                    value={formData.appName || ''}
                    placeholder="سیستم فاکتور و انبارداری"
                    onChange={(e) => setFormData({ ...formData, appName: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>

                <div className="flex flex-col justify-center">
                  <label className="flex items-center gap-2 cursor-pointer pt-4 text-xs font-semibold text-slate-700">
                    <input
                      type="checkbox"
                      id="settings-show-store-edition"
                      checked={formData.showStoreEditionBadge !== false}
                      onChange={(e) => setFormData({ ...formData, showStoreEditionBadge: e.target.checked })}
                      className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300"
                    />
                    <span>نمایش عبارت «نسخه فروشگاهی» در سربرگ</span>
                  </label>
                </div>

                <div>
                  <label className="block font-medium text-slate-700 mb-1">نام فروشگاه / کسب‌وکار *</label>
                  <input
                    type="text"
                    required
                    id="settings-store-name"
                    value={formData.storeName}
                    onChange={(e) => setFormData({ ...formData, storeName: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-700 mb-1">نام متصدی / فروشنده</label>
                  <input
                    type="text"
                    id="settings-seller-name"
                    value={formData.sellerName}
                    onChange={(e) => setFormData({ ...formData, sellerName: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-medium text-slate-700 mb-1">شعار یا زمینه فعالیت (زیر عنوان سربرگ)</label>
                  <input
                    type="text"
                    id="settings-tagline"
                    value={formData.tagline}
                    onChange={(e) => setFormData({ ...formData, tagline: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-700 mb-1">تلفن ثابت</label>
                  <input
                    type="text"
                    id="settings-phone"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-700 mb-1">تلفن همراه / پشتیبانی</label>
                  <input
                    type="text"
                    id="settings-mobile"
                    value={formData.mobile}
                    onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-700 mb-1">کد اقتصادی (فاکتور رسمی)</label>
                  <input
                    type="text"
                    id="settings-economic-code"
                    value={formData.economicCode}
                    onChange={(e) => setFormData({ ...formData, economicCode: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-700 mb-1">شناسه ملی / کد ملی</label>
                  <input
                    type="text"
                    id="settings-national-code"
                    value={formData.nationalCode}
                    onChange={(e) => setFormData({ ...formData, nationalCode: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-medium text-slate-700 mb-1">نشانی کامل فروشگاه / شرکت</label>
                  <input
                    type="text"
                    id="settings-address"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-medium text-slate-700 mb-1">متن پانویس و شرایط گارانتی فاکتور</label>
                  <textarea
                    rows={2}
                    id="settings-footer-text"
                    value={formData.invoiceFooterText}
                    onChange={(e) => setFormData({ ...formData, invoiceFooterText: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>
              </div>
            </div>

            {/* Section: Origin Warehouse Settings (تنظیمات و مشخصات انبار مبدأ) */}
            <div className="space-y-4 pt-4 border-t border-slate-200">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                  <Warehouse className="w-4 h-4 text-emerald-600" />
                  <span>نام و مشخصات انبار مبدأ (حواله خروج کالا و بارگیری)</span>
                </h4>
                <span className="text-[10px] bg-emerald-50 text-emerald-700 px-2.5 py-0.5 rounded-full font-bold border border-emerald-200/60">
                  قابل تنظیم توسط مدیریت
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                مشخصات انبار مبدأ در سربرگ و بدنه برگه‌های خروج کالا، حواله‌های تحویل فیزیکی و متون ارسالی به رانندگان و انبارداران درج می‌شود.
              </p>

              {/* Warehouse Selection Helper (if warehouses exist) */}
              {formData.warehouses && formData.warehouses.length > 0 && (
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
                  <div className="text-xs">
                    <span className="font-bold text-slate-700 block">انتخاب سریع از انبارهای تعریف‌شده:</span>
                    <span className="text-[11px] text-slate-400">با انتخاب انبار، اطلاعات به فرم منتقل می‌شود</span>
                  </div>
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <select
                      id="settings-select-origin-warehouse"
                      value={formData.defaultWarehouseId || ''}
                      onChange={(e) => {
                        const selectedId = e.target.value;
                        const wh = formData.warehouses?.find(w => w.id === selectedId);
                        if (wh) {
                          setFormData({
                            ...formData,
                            defaultWarehouseId: selectedId,
                            originWarehouseName: wh.name,
                            originWarehouseCode: wh.code || formData.originWarehouseCode || '',
                            originWarehouseAddress: wh.address || formData.originWarehouseAddress || '',
                            originWarehousePhone: wh.phone || formData.originWarehousePhone || '',
                            originWarehouseManager: wh.managerName || formData.originWarehouseManager || '',
                          });
                        }
                      }}
                      className="w-full sm:w-56 bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                    >
                      {formData.warehouses.map((wh) => (
                        <option key={wh.id} value={wh.id}>
                          {wh.name} {wh.isDefault ? '(پیش‌فرض)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-medium text-slate-700 mb-1 text-xs">
                    نام انبار مبدأ <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="settings-origin-warehouse-name"
                    placeholder="مثال: انبار مرکزی سپهر"
                    value={formData.originWarehouseName || ''}
                    onChange={(e) => setFormData({ ...formData, originWarehouseName: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-bold text-slate-800"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-700 mb-1 text-xs">
                    کد یا شناسه انبار مبدأ
                  </label>
                  <input
                    type="text"
                    id="settings-origin-warehouse-code"
                    placeholder="مثال: WH-01 یا کد انبار"
                    value={formData.originWarehouseCode || ''}
                    onChange={(e) => setFormData({ ...formData, originWarehouseCode: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-mono text-left"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-700 mb-1 text-xs">
                    شماره تماس / داخلی انبار مبدأ
                  </label>
                  <input
                    type="text"
                    id="settings-origin-warehouse-phone"
                    placeholder="مثال: ۰۲۱-۵۵۴۴۳۳۲۲ یا شماره همراه انباردار"
                    value={formData.originWarehousePhone || ''}
                    onChange={(e) => setFormData({ ...formData, originWarehousePhone: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 dir-ltr text-right"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-700 mb-1 text-xs">
                    نام مسئول / متصدی انبار مبدأ
                  </label>
                  <input
                    type="text"
                    id="settings-origin-warehouse-manager"
                    placeholder="مثال: مرتضی اکبری (سرپرست انبار)"
                    value={formData.originWarehouseManager || ''}
                    onChange={(e) => setFormData({ ...formData, originWarehouseManager: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-medium text-slate-700 mb-1 text-xs">
                    نشانی و آدرس دقیق محل بارگیری انبار مبدأ
                  </label>
                  <textarea
                    id="settings-origin-warehouse-address"
                    rows={2}
                    placeholder="نشانی فیزیکی، سوله، کوچه یا پلاک انبار مبدأ جهت درج در حواله بارگیری و راهنمای رانندگان"
                    value={formData.originWarehouseAddress || ''}
                    onChange={(e) => setFormData({ ...formData, originWarehouseAddress: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 resize-none"
                  />
                </div>
              </div>
            </div>

            {/* Section 2: Financial & Warehouse Options */}
            <div className="space-y-4 pt-4 border-t border-slate-200">
              <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2 pb-2 border-b border-slate-100">
                <Percent className="w-4 h-4 text-emerald-600" />
                <span>پیکربندی مالی و انبارداری خودکار</span>
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      id="settings-auto-deduct"
                      checked={formData.autoDeductStock}
                      onChange={(e) => setFormData({ ...formData, autoDeductStock: e.target.checked })}
                      className="rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                    />
                    <span className="font-medium text-slate-800">
                      کسر خودکار موجودی انبار با صدور فاکتور
                    </span>
                  </label>
                  <p className="text-[11px] text-slate-500 pr-5">
                    در صورت فعال بودن، با ثبت هر فاکتور فروش، به میزان کالاهای فروخته شده از انبار کسر می‌شود.
                  </p>
                </div>

                <div className="space-y-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      id="settings-tax-enabled"
                      checked={formData.taxEnabled}
                      onChange={(e) => setFormData({ ...formData, taxEnabled: e.target.checked })}
                      className="rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                    />
                    <span className="font-medium text-slate-800">
                      محاسبه پیش‌فرض ارزش افزوده در فاکتورها
                    </span>
                  </label>
                  {formData.taxEnabled && (
                    <div className="flex items-center gap-2 pr-5">
                      <span className="text-slate-600">نرخ ارزش افزوده:</span>
                      <input
                        type="number"
                        id="settings-tax-rate"
                        value={formData.taxPercent}
                        onChange={(e) => setFormData({ ...formData, taxPercent: parseFloat(e.target.value) || 0 })}
                        className="w-16 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-center font-bold"
                      />
                      <span>درصد</span>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block font-medium text-slate-700 mb-1">واحد پول پیش‌فرض</label>
                  <select
                    id="settings-currency"
                    value={formData.currency}
                    onChange={(e) => setFormData({ ...formData, currency: e.target.value as any })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs outline-none focus:bg-white cursor-pointer"
                  >
                    <option value="تومان">تومان</option>
                    <option value="ریال">ریال</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Section 2.3: Allowed Payment Methods */}
            <div className="space-y-4 pt-4 border-t border-slate-200">
              <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2 pb-2 border-b border-slate-100">
                <Banknote className="w-4 h-4 text-emerald-600" />
                <span>روش‌های مجاز دریافت وجه در فاکتور</span>
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* چک */}
                <label className="flex items-start gap-2.5 p-3 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 cursor-pointer transition-colors">
                  <input
                    type="checkbox"
                    id="settings-enable-cheque"
                    checked={formData.enableChequePayment !== false}
                    onChange={(e) => setFormData({ ...formData, enableChequePayment: e.target.checked })}
                    className="w-4 h-4 text-emerald-600 rounded mt-0.5"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-800 block">چک بانکی</span>
                    <span className="text-[11px] text-slate-500 block mt-0.5">
                      امکان ثبت شماره چک/صیادی، تاریخ سررسید و نام چک
                    </span>
                  </div>
                </label>

                {/* نقدی */}
                <label className="flex items-start gap-2.5 p-3 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 cursor-pointer transition-colors">
                  <input
                    type="checkbox"
                    id="settings-enable-cash"
                    checked={formData.enableCashPayment !== false}
                    onChange={(e) => setFormData({ ...formData, enableCashPayment: e.target.checked })}
                    className="w-4 h-4 text-emerald-600 rounded mt-0.5"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-800 block">پرداخت نقدی</span>
                    <span className="text-[11px] text-slate-500 block mt-0.5">
                      دریافت نقد در صندوق فروشگاه
                    </span>
                  </div>
                </label>

                {/* واریز به حساب */}
                <label className="flex items-start gap-2.5 p-3 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 cursor-pointer transition-colors">
                  <input
                    type="checkbox"
                    id="settings-enable-transfer"
                    checked={formData.enableTransferPayment !== false}
                    onChange={(e) => setFormData({ ...formData, enableTransferPayment: e.target.checked })}
                    className="w-4 h-4 text-emerald-600 rounded mt-0.5"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-800 block">واریز به حساب / کارت به کارت</span>
                    <span className="text-[11px] text-slate-500 block mt-0.5">
                      امکان ثبت شماره پیگیری و توضیحات بانکی
                    </span>
                  </div>
                </label>

                {/* کارتخوان */}
                <label className="flex items-start gap-2.5 p-3 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 cursor-pointer transition-colors">
                  <input
                    type="checkbox"
                    id="settings-enable-pos"
                    checked={formData.enablePosPayment !== false}
                    onChange={(e) => setFormData({ ...formData, enablePosPayment: e.target.checked })}
                    className="w-4 h-4 text-emerald-600 rounded mt-0.5"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-800 block">دستگاه کارتخوان (POS)</span>
                    <span className="text-[11px] text-slate-500 block mt-0.5">
                      پرداخت از طریق پایانه فروشگاهی
                    </span>
                  </div>
                </label>

                {/* نسیه / دفتری */}
                <label className="flex items-start gap-2.5 p-3 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 cursor-pointer transition-colors sm:col-span-2">
                  <input
                    type="checkbox"
                    id="settings-enable-credit"
                    checked={formData.enableCreditPayment !== false}
                    onChange={(e) => setFormData({ ...formData, enableCreditPayment: e.target.checked })}
                    className="w-4 h-4 text-emerald-600 rounded mt-0.5"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-800 block">حساب دفتری / نسیه</span>
                    <span className="text-[11px] text-slate-500 block mt-0.5">
                      ثبت در حساب بدهکاری مشتری و تسویه آتی
                    </span>
                  </div>
                </label>
              </div>
            </div>

            {/* Section 2.5: WhatsApp Coordination */}
            <div className="space-y-4 pt-4 border-t border-slate-200">
              <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2 pb-2 border-b border-slate-100">
                <FileCheck className="w-4 h-4 text-emerald-600" />
                <span>هماهنگی ارسال و پیام‌رسان</span>
              </h4>

              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  شماره واتساپ اختصاصی هماهنگی انبار
                </label>
                <input
                  type="text"
                  id="settings-whatsapp-number"
                  placeholder="مثال: ۰۹۱۲۳۴۵۶۷۸۹"
                  value={formData.whatsappNumber || ''}
                  onChange={(e) => setFormData({ ...formData, whatsappNumber: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 dir-ltr text-right"
                />
              </div>
            </div>

            {/* Section 2.8: PDF Quality Settings */}
            <div className="space-y-4 pt-4 border-t border-slate-200">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                  <FileDown className="w-4 h-4 text-indigo-600" />
                  <span>کیفیت فایل خروجی PDF فاکتور و حواله خروج</span>
                </h4>
                <label className="flex items-center gap-2 text-[11px] font-bold text-slate-700 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200 cursor-pointer">
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
                    className="w-3.5 h-3.5 text-emerald-600 rounded"
                  />
                  <span>یکسان‌سازی کیفیت هر دو</span>
                </label>
              </div>

              {/* Invoice Quality */}
              <div className="space-y-2">
                <label className="block font-medium text-slate-700 text-xs">
                  کیفیت PDF فاکتور فروش:
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {(Object.keys(PDF_QUALITY_PRESETS) as PdfQualityPreset[]).map((key) => {
                    const preset = PDF_QUALITY_PRESETS[key];
                    const isSelected = (formData.pdfInvoiceQuality || 'standard') === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => {
                          setFormData((prev) => ({
                            ...prev,
                            pdfInvoiceQuality: key,
                            ...(prev.pdfSyncQuality ? { pdfExitSlipQuality: key } : {}),
                          }));
                        }}
                        className={`p-2.5 rounded-xl border text-right transition-all cursor-pointer ${
                          isSelected
                            ? 'border-emerald-600 bg-emerald-50/50 ring-1 ring-emerald-500 font-bold'
                            : 'border-slate-200 bg-white hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center justify-between text-[11px] mb-1">
                          <span className="font-bold text-slate-900">{preset.badge}</span>
                          {isSelected && <Check className="w-3 h-3 text-emerald-600" />}
                        </div>
                        <div className="text-[10px] text-slate-500 truncate">{preset.approxSize}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Exit Slip Quality */}
              {!formData.pdfSyncQuality && (
                <div className="space-y-2 pt-2">
                  <label className="block font-medium text-slate-700 text-xs">
                    کیفیت PDF حواله خروج انبار:
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {(Object.keys(PDF_QUALITY_PRESETS) as PdfQualityPreset[]).map((key) => {
                      const preset = PDF_QUALITY_PRESETS[key];
                      const isSelected = (formData.pdfExitSlipQuality || 'high') === key;
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => {
                            setFormData((prev) => ({
                              ...prev,
                              pdfExitSlipQuality: key,
                            }));
                          }}
                          className={`p-2.5 rounded-xl border text-right transition-all cursor-pointer ${
                            isSelected
                              ? 'border-amber-600 bg-amber-50/50 ring-1 ring-amber-500 font-bold'
                              : 'border-slate-200 bg-white hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center justify-between text-[11px] mb-1">
                            <span className="font-bold text-slate-900">{preset.badge}</span>
                            {isSelected && <Check className="w-3 h-3 text-amber-600" />}
                          </div>
                          <div className="text-[10px] text-slate-500 truncate">{preset.approxSize}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Section 2.9: Telegram Bot & Automation Settings (تنظیمات ارسال خودکار و اتوماسیون) */}
            <div className="space-y-4 pt-4 border-t border-slate-200">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-[#229ED9]/10 text-[#229ED9] flex items-center justify-center">
                    <Send className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-800 text-sm">
                      اتصال به ربات تلگرام و تنظیمات ارسال خودکار و اتوماسیون (اختیاری)
                    </h4>
                    <span className="text-[11px] text-slate-500">
                      ارسال مستقیم فایل رسمی PDF فاکتورها، حواله‌های خروج و رسیدهای ورود
                    </span>
                  </div>
                </div>

                <label className="flex items-center gap-2 cursor-pointer bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-100 transition-colors">
                  <span className="text-xs font-bold text-slate-700">فعال‌سازی ربات تلگرام</span>
                  <input
                    type="checkbox"
                    checked={!!formData.telegramBotEnabled}
                    onChange={(e) => setFormData(prev => ({ ...prev, telegramBotEnabled: e.target.checked }))}
                    className="w-4 h-4 rounded text-[#229ED9] focus:ring-[#229ED9] border-slate-300 cursor-pointer"
                  />
                </label>
              </div>

              {formData.telegramBotEnabled && (
                <div className="space-y-4 animate-fadeIn">
                  {/* Bot Token */}
                  <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                    <label className="block text-xs font-bold text-slate-700">
                      توکن اختصاصی ربات تلگرام (Bot Token):
                    </label>
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <input
                          type={showBotToken ? 'text' : 'password'}
                          dir="ltr"
                          placeholder="مثال: 123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ"
                          value={formData.telegramBotToken || ''}
                          onChange={(e) => {
                            setFormData(prev => ({ ...prev, telegramBotToken: e.target.value }));
                            if (botTestResult) setBotTestResult(null);
                          }}
                          className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono text-left text-slate-800 pr-9"
                        />
                        <button
                          type="button"
                          onClick={() => setShowBotToken(!showBotToken)}
                          className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 cursor-pointer"
                        >
                          {showBotToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={handleTestBotConnection}
                        disabled={isTestingBot || !formData.telegramBotToken?.trim()}
                        className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1.5 transition-all disabled:opacity-50 shrink-0 cursor-pointer"
                      >
                        {isTestingBot ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5 text-amber-300" />}
                        <span>تست اتصال</span>
                      </button>
                    </div>

                    {botTestResult && (
                      <div className={`p-2.5 rounded-lg border text-xs flex items-center gap-2 ${
                        botTestResult.success ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'
                      }`}>
                        {botTestResult.success ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> : <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />}
                        <span>{botTestResult.message}</span>
                      </div>
                    )}
                  </div>

                  {/* Chat ID */}
                  <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                    <label className="block text-xs font-bold text-slate-700">
                      شناسه پیش‌فرض چت، کانال یا گروه مقصد (Chat ID):
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        dir="ltr"
                        placeholder="مثلاً: 123456789 یا @MyChannelName یا -1001234567890"
                        value={formData.telegramChatId || ''}
                        onChange={(e) => {
                          setFormData(prev => ({ ...prev, telegramChatId: e.target.value }));
                          if (msgTestResult) setMsgTestResult(null);
                        }}
                        className="flex-1 bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono text-left text-slate-800"
                      />
                      <button
                        type="button"
                        onClick={handleTestTelegramMessage}
                        disabled={isTestingMsg || !formData.telegramBotToken?.trim() || !formData.telegramChatId?.trim()}
                        className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs flex items-center gap-1.5 transition-all disabled:opacity-50 shrink-0 cursor-pointer"
                      >
                        {isTestingMsg ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />}
                        <span>ارسال پیام تستی</span>
                      </button>
                    </div>

                    {msgTestResult && (
                      <div className={`p-2.5 rounded-lg border text-xs flex items-center gap-2 ${
                        msgTestResult.success ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'
                      }`}>
                        {msgTestResult.success ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> : <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />}
                        <span>{msgTestResult.message}</span>
                      </div>
                    )}
                  </div>

                  {/* Automation & After-Approval Dispatch */}
                  <div className="p-4 bg-sky-50/60 rounded-2xl border border-sky-200/80 space-y-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <h5 className="font-bold text-slate-800 text-xs flex items-center gap-2">
                        <SlidersHorizontal className="w-4 h-4 text-[#229ED9]" />
                        <span>تنظیمات ارسال خودکار و اتوماسیون (اختیاری)</span>
                      </h5>
                      <span className="text-[10px] font-bold text-[#006699] bg-[#229ED9]/15 px-2 py-0.5 rounded-md">
                        بعد از تایید ارسال خودکار در تلگرام انجام شود
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <label className="p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 flex items-start justify-between gap-2 cursor-pointer">
                        <div>
                          <span className="font-bold text-slate-800 text-xs block">ارسال خودکار فاکتورهای فروش تایید شده</span>
                          <span className="text-[10px] text-slate-500">بلافاصله پس از ثبت نهایی فاکتور فروش</span>
                        </div>
                        <input
                          type="checkbox"
                          checked={!!formData.telegramAutoSendInvoice}
                          onChange={(e) => setFormData(prev => ({ ...prev, telegramAutoSendInvoice: e.target.checked }))}
                          className="w-4 h-4 mt-0.5 rounded text-[#229ED9] cursor-pointer"
                        />
                      </label>

                      <label className="p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 flex items-start justify-between gap-2 cursor-pointer">
                        <div>
                          <span className="font-bold text-slate-800 text-xs block">ارسال خودکار بعد از تایید پیش‌فاکتور</span>
                          <span className="text-[10px] text-slate-500">به محض تایید مشتری و تبدیل به فاکتور رسمی</span>
                        </div>
                        <input
                          type="checkbox"
                          checked={formData.telegramAutoSendOnProformaConvert !== false}
                          onChange={(e) => setFormData(prev => ({ ...prev, telegramAutoSendOnProformaConvert: e.target.checked }))}
                          className="w-4 h-4 mt-0.5 rounded text-indigo-600 cursor-pointer"
                        />
                      </label>

                      <label className="p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 flex items-start justify-between gap-2 cursor-pointer">
                        <div>
                          <span className="font-bold text-slate-800 text-xs block">ارسال خودکار فقط بعد از تایید نهایی</span>
                          <span className="text-[10px] text-slate-500">پیش‌فاکتورهای اولیه ارسال نشوند تا تایید شوند</span>
                        </div>
                        <input
                          type="checkbox"
                          checked={formData.telegramAutoSendOnlyConfirmed !== false}
                          onChange={(e) => setFormData(prev => ({ ...prev, telegramAutoSendOnlyConfirmed: e.target.checked }))}
                          className="w-4 h-4 mt-0.5 rounded text-[#229ED9] cursor-pointer"
                        />
                      </label>

                      <label className="p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 flex items-start justify-between gap-2 cursor-pointer">
                        <div>
                          <span className="font-bold text-slate-800 text-xs block">ارسال خودکار حواله خروج پس از تایید تحویل</span>
                          <span className="text-[10px] text-slate-500">پس از تایید تحویل بار و ثبت مشخصات راننده</span>
                        </div>
                        <input
                          type="checkbox"
                          checked={!!formData.telegramAutoSendExitSlip}
                          onChange={(e) => setFormData(prev => ({ ...prev, telegramAutoSendExitSlip: e.target.checked }))}
                          className="w-4 h-4 mt-0.5 rounded text-[#229ED9] cursor-pointer"
                        />
                      </label>

                      <label className="p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 flex items-start justify-between gap-2 cursor-pointer sm:col-span-2">
                        <div>
                          <span className="font-bold text-slate-800 text-xs block">ارسال خودکار رسید ورود انبار پس از تایید و شمارش انباردار</span>
                          <span className="text-[10px] text-slate-500">به محض تایید ورود کالاها و کنترل فیزیکی اقلام توسط انباردار</span>
                        </div>
                        <input
                          type="checkbox"
                          checked={!!formData.telegramAutoSendInboundReceipt}
                          onChange={(e) => setFormData(prev => ({ ...prev, telegramAutoSendInboundReceipt: e.target.checked }))}
                          className="w-4 h-4 mt-0.5 rounded text-[#229ED9] cursor-pointer"
                        />
                      </label>
                    </div>

                    {/* Telegram PDF Paper Size & Orientation Controls */}
                    <div className="pt-3 border-t border-sky-200/80 space-y-3">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <h6 className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                          <FileText className="w-4 h-4 text-indigo-600" />
                          <span>سایز و حالت کاغذ (افقی / عمودی) برای ارسال خودکار تلگرام</span>
                        </h6>
                        <span className="text-[10px] text-slate-500">
                          تنظیم ابعاد و جهت صفحه خروجی PDF
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {/* Invoice Paper Config */}
                        <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-2.5">
                          <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                            <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                              <Receipt className="w-3.5 h-3.5 text-[#229ED9]" />
                              <span>فاکتور فروش در تلگرام</span>
                            </span>
                            <span className="text-[10px] font-mono font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                              {(formData.telegramInvoicePageSize || 'a4').toUpperCase()} - {formData.telegramInvoiceOrientation === 'landscape' ? 'افقی' : 'عمودی'} - {(formData.telegramInvoiceTemplate || 'standard') === 'simple' ? 'ساده' : 'استاندارد'}
                            </span>
                          </div>

                          {/* Size */}
                          <div className="space-y-1">
                            <label className="text-[11px] font-medium text-slate-600 block">سایز کاغذ:</label>
                            <div className="grid grid-cols-2 gap-1.5">
                              <button
                                type="button"
                                onClick={() => setFormData(prev => ({ ...prev, telegramInvoicePageSize: 'a4' }))}
                                className={`py-1.5 px-2 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                                  (formData.telegramInvoicePageSize || 'a4') === 'a4'
                                    ? 'border-[#229ED9] bg-[#229ED9]/10 text-[#006699]'
                                    : 'border-slate-200 bg-slate-50 text-slate-700'
                                }`}
                              >
                                A4 (استاندارد)
                              </button>
                              <button
                                type="button"
                                onClick={() => setFormData(prev => ({ ...prev, telegramInvoicePageSize: 'a5' }))}
                                className={`py-1.5 px-2 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                                  formData.telegramInvoicePageSize === 'a5'
                                    ? 'border-[#229ED9] bg-[#229ED9]/10 text-[#006699]'
                                    : 'border-slate-200 bg-slate-50 text-slate-700'
                                }`}
                              >
                                A5 (نیم‌برگ)
                              </button>
                            </div>
                          </div>

                          {/* Orientation */}
                          <div className="space-y-1">
                            <label className="text-[11px] font-medium text-slate-600 block">جهت صفحه:</label>
                            <div className="grid grid-cols-2 gap-1.5">
                              <button
                                type="button"
                                onClick={() => setFormData(prev => ({ ...prev, telegramInvoiceOrientation: 'portrait' }))}
                                className={`py-1.5 px-2 rounded-lg text-xs font-bold border transition-all cursor-pointer flex items-center justify-center gap-1 ${
                                  (formData.telegramInvoiceOrientation || 'portrait') === 'portrait'
                                    ? 'border-emerald-600 bg-emerald-50 text-emerald-800'
                                    : 'border-slate-200 bg-slate-50 text-slate-700'
                                }`}
                              >
                                <div className="w-2.5 h-3.5 border-2 border-current rounded-2xs" />
                                <span>عمودی</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setFormData(prev => ({ ...prev, telegramInvoiceOrientation: 'landscape' }))}
                                className={`py-1.5 px-2 rounded-lg text-xs font-bold border transition-all cursor-pointer flex items-center justify-center gap-1 ${
                                  formData.telegramInvoiceOrientation === 'landscape'
                                    ? 'border-emerald-600 bg-emerald-50 text-emerald-800'
                                    : 'border-slate-200 bg-slate-50 text-slate-700'
                                }`}
                              >
                                <div className="w-3.5 h-2.5 border-2 border-current rounded-2xs" />
                                <span>افقی</span>
                              </button>
                            </div>
                          </div>

                          {/* Template / Style (ساده یا استاندارد) */}
                          <div className="space-y-1 pt-1 border-t border-slate-100">
                            <label className="text-[11px] font-medium text-slate-600 block">استایل و قالب فاکتور:</label>
                            <div className="grid grid-cols-2 gap-1.5">
                              <button
                                type="button"
                                onClick={() => setFormData(prev => ({ ...prev, telegramInvoiceTemplate: 'standard' }))}
                                className={`py-1.5 px-2 rounded-lg text-xs font-bold border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                                  (formData.telegramInvoiceTemplate || 'standard') === 'standard'
                                    ? 'border-indigo-600 bg-indigo-50 text-indigo-900 ring-1 ring-indigo-500/20'
                                    : 'border-slate-200 bg-slate-50 text-slate-700'
                                }`}
                              >
                                <Sparkles className="w-3 h-3 text-indigo-600" />
                                <span>استاندارد</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setFormData(prev => ({ ...prev, telegramInvoiceTemplate: 'simple' }))}
                                className={`py-1.5 px-2 rounded-lg text-xs font-bold border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                                  formData.telegramInvoiceTemplate === 'simple'
                                    ? 'border-indigo-600 bg-indigo-50 text-indigo-900 ring-1 ring-indigo-500/20'
                                    : 'border-slate-200 bg-slate-50 text-slate-700'
                                }`}
                              >
                                <FileText className="w-3 h-3 text-indigo-600" />
                                <span>ساده</span>
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Exit Slip Paper Config */}
                        <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-2.5">
                          <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                            <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                              <Warehouse className="w-3.5 h-3.5 text-amber-600" />
                              <span>حواله خروج در تلگرام</span>
                            </span>
                            <span className="text-[10px] font-mono font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                              {(formData.telegramExitSlipPageSize || 'a4').toUpperCase()} - {formData.telegramExitSlipOrientation === 'landscape' ? 'افقی' : 'عمودی'} - {(formData.telegramExitSlipTemplate || 'standard') === 'simple' ? 'ساده' : 'استاندارد'}
                            </span>
                          </div>

                          {/* Size */}
                          <div className="space-y-1">
                            <label className="text-[11px] font-medium text-slate-600 block">سایز کاغذ:</label>
                            <div className="grid grid-cols-2 gap-1.5">
                              <button
                                type="button"
                                onClick={() => setFormData(prev => ({ ...prev, telegramExitSlipPageSize: 'a4' }))}
                                className={`py-1.5 px-2 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                                  (formData.telegramExitSlipPageSize || 'a4') === 'a4'
                                    ? 'border-amber-600 bg-amber-50 text-amber-900'
                                    : 'border-slate-200 bg-slate-50 text-slate-700'
                                }`}
                              >
                                A4 (استاندارد)
                              </button>
                              <button
                                type="button"
                                onClick={() => setFormData(prev => ({ ...prev, telegramExitSlipPageSize: 'a5' }))}
                                className={`py-1.5 px-2 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                                  formData.telegramExitSlipPageSize === 'a5'
                                    ? 'border-amber-600 bg-amber-50 text-amber-900'
                                    : 'border-slate-200 bg-slate-50 text-slate-700'
                                }`}
                              >
                                A5 (نیم‌برگ)
                              </button>
                            </div>
                          </div>

                          {/* Orientation */}
                          <div className="space-y-1">
                            <label className="text-[11px] font-medium text-slate-600 block">جهت صفحه:</label>
                            <div className="grid grid-cols-2 gap-1.5">
                              <button
                                type="button"
                                onClick={() => setFormData(prev => ({ ...prev, telegramExitSlipOrientation: 'portrait' }))}
                                className={`py-1.5 px-2 rounded-lg text-xs font-bold border transition-all cursor-pointer flex items-center justify-center gap-1 ${
                                  (formData.telegramExitSlipOrientation || 'portrait') === 'portrait'
                                    ? 'border-emerald-600 bg-emerald-50 text-emerald-800'
                                    : 'border-slate-200 bg-slate-50 text-slate-700'
                                }`}
                              >
                                <div className="w-2.5 h-3.5 border-2 border-current rounded-2xs" />
                                <span>عمودی</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setFormData(prev => ({ ...prev, telegramExitSlipOrientation: 'landscape' }))}
                                className={`py-1.5 px-2 rounded-lg text-xs font-bold border transition-all cursor-pointer flex items-center justify-center gap-1 ${
                                  formData.telegramExitSlipOrientation === 'landscape'
                                    ? 'border-emerald-600 bg-emerald-50 text-emerald-800'
                                    : 'border-slate-200 bg-slate-50 text-slate-700'
                                }`}
                              >
                                <div className="w-3.5 h-2.5 border-2 border-current rounded-2xs" />
                                <span>افقی</span>
                              </button>
                            </div>
                          </div>

                          {/* Template / Style (ساده یا استاندارد) */}
                          <div className="space-y-1 pt-1 border-t border-slate-100">
                            <label className="text-[11px] font-medium text-slate-600 block">استایل و قالب حواله:</label>
                            <div className="grid grid-cols-2 gap-1.5">
                              <button
                                type="button"
                                onClick={() => setFormData(prev => ({ ...prev, telegramExitSlipTemplate: 'standard' }))}
                                className={`py-1.5 px-2 rounded-lg text-xs font-bold border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                                  (formData.telegramExitSlipTemplate || 'standard') === 'standard'
                                    ? 'border-amber-600 bg-amber-50 text-amber-900 ring-1 ring-amber-500/20'
                                    : 'border-slate-200 bg-slate-50 text-slate-700'
                                }`}
                              >
                                <Sparkles className="w-3 h-3 text-amber-600" />
                                <span>استاندارد</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setFormData(prev => ({ ...prev, telegramExitSlipTemplate: 'simple' }))}
                                className={`py-1.5 px-2 rounded-lg text-xs font-bold border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                                  formData.telegramExitSlipTemplate === 'simple'
                                    ? 'border-amber-600 bg-amber-50 text-amber-900 ring-1 ring-amber-500/20'
                                    : 'border-slate-200 bg-slate-50 text-slate-700'
                                }`}
                              >
                                <FileText className="w-3 h-3 text-amber-600" />
                                <span>ساده</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Section 2.10: Public Web Invoice Settings (تنظیمات نسخه آنلاین و تحت وب فاکتور برای مشتری) */}
            <div className="space-y-4 pt-4 border-t border-slate-200">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-sky-500/10 text-sky-600 flex items-center justify-center">
                    <Globe className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-800 text-sm">
                      تنظیمات نسخه تحت وب فاکتور برای مشتریان (مشاهده آنلاین بدون نیاز به دانلود PDF)
                    </h4>
                    <span className="text-[11px] text-slate-500">
                      ایجاد پیوندهای امن، یکبارمصرف یا زمان‌دار جهت مشاهده سریع فاکتور در گوشی و کامپیوتر مشتری
                    </span>
                  </div>
                </div>

                <label className="flex items-center gap-2 cursor-pointer bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-100 transition-colors">
                  <span className="text-xs font-bold text-slate-700">فعال بودن لینک تحت وب</span>
                  <input
                    type="checkbox"
                    checked={formData.webInvoiceEnabled !== false}
                    onChange={(e) => setFormData(prev => ({ ...prev, webInvoiceEnabled: e.target.checked }))}
                    className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500 border-slate-300 cursor-pointer"
                  />
                </label>
              </div>

              {formData.webInvoiceEnabled !== false && (
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Default Expiration */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-700 block">
                        مدت زمان پیش‌فرض اعتبار پیوندها:
                      </label>
                      <select
                        value={formData.webInvoiceDefaultExpiryHours ?? 0}
                        onChange={(e) => setFormData(prev => ({ ...prev, webInvoiceDefaultExpiryHours: Number(e.target.value) }))}
                        className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-sky-500/20 cursor-pointer"
                      >
                        <option value={0}>همیشه معتبر (بدون انقضای خودکار)</option>
                        <option value={24}>۲۴ ساعت (۱ روز)</option>
                        <option value={72}>۳ روز (۷۲ ساعت)</option>
                        <option value={168}>۷ روز (۱ هفته)</option>
                        <option value={720}>۳۰ روز (۱ ماه)</option>
                      </select>
                    </div>

                    {/* Custom Domain */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-700 block">
                        دامنه اختصاصی لینک (اختیاری):
                      </label>
                      <input
                        type="text"
                        dir="ltr"
                        placeholder="مثال: https://factor.mycompany.ir"
                        value={formData.webInvoiceCustomDomain || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, webInvoiceCustomDomain: e.target.value }))}
                        className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono text-left text-slate-800 outline-none focus:ring-2 focus:ring-sky-500/20"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-200/60">
                    <label className="flex items-center justify-between p-2.5 bg-white rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-50">
                      <div>
                        <span className="text-xs font-bold text-slate-800 block">اجازه دانلود فایل PDF و چاپ توسط مشتری</span>
                        <span className="text-[11px] text-slate-400">نمایش دکمه دانلود PDF و چاپ در صفحه وب مشتری</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={formData.webInvoiceAllowPdfDownload !== false}
                        onChange={(e) => setFormData(prev => ({ ...prev, webInvoiceAllowPdfDownload: e.target.checked }))}
                        className="w-4 h-4 text-sky-600 rounded cursor-pointer"
                      />
                    </label>

                    <label className="flex items-center justify-between p-2.5 bg-white rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-50">
                      <div>
                        <span className="text-xs font-bold text-slate-800 block">الزام پیش‌فرض پین‌کد برای فاکتورهای جدید</span>
                        <span className="text-[11px] text-slate-400">فعال‌سازی رمز ۴ رقمی به صورت پیش‌فرض در صدور فاکتور</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={!!formData.webInvoiceRequirePinDefault}
                        onChange={(e) => setFormData(prev => ({ ...prev, webInvoiceRequirePinDefault: e.target.checked }))}
                        className="w-4 h-4 text-indigo-600 rounded cursor-pointer"
                      />
                    </label>
                  </div>
                </div>
              )}
            </div>
          </form>

          {/* Section 3: Backup & Restore */}
          <div className="space-y-4 pt-4 border-t border-slate-200">
            <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2 pb-2 border-b border-slate-100">
              <Database className="w-4 h-4 text-emerald-600" />
              <span>پشتیبان‌گیری، بازیابی و بازنشانی داده‌ها</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Backup */}
              <button
                type="button"
                id="export-backup-btn"
                onClick={handleExportBackup}
                className="flex items-center justify-center gap-2 p-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-slate-700 font-semibold transition-colors cursor-pointer"
              >
                <Download className="w-4 h-4 text-emerald-600" />
                <span>دانلود فایل پشتیبان (JSON)</span>
              </button>

              {/* Restore */}
              <label className="flex items-center justify-center gap-2 p-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-slate-700 font-semibold transition-colors cursor-pointer">
                <Upload className="w-4 h-4 text-blue-600" />
                <span>بازیابی از فایل پشتیبان</span>
                <input
                  type="file"
                  id="import-backup-file"
                  accept=".json"
                  onChange={handleImportBackup}
                  className="hidden"
                />
              </label>

              {/* Reset to Samples */}
              <button
                type="button"
                id="reset-sample-data-btn"
                onClick={handleResetDefaults}
                className="flex items-center justify-center gap-2 p-3 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl text-rose-700 font-semibold transition-colors cursor-pointer"
              >
                <RotateCcw className="w-4 h-4 text-rose-600" />
                <span>بازنشانی به داده‌های نمونه</span>
              </button>
            </div>

            {importStatus && (
              <div className="p-3 bg-emerald-50 text-emerald-800 rounded-xl border border-emerald-200 flex items-center gap-2">
                <FileCheck className="w-4 h-4 text-emerald-600" />
                <span>{importStatus}</span>
              </div>
            )}
          </div>

          {/* Section 4: Security Shields & Status */}
          <div className="space-y-3 pt-4 border-t border-slate-200">
            <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2 pb-2 border-b border-slate-100">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>وضعیت سپرهای امنیتی و ضد نفوذ سرور</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
              <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-emerald-950">سپرهای هدر امنیتی (Helmet Security)</div>
                  <div className="text-[11px] text-emerald-800 mt-0.5">
                    محافظت در برابر XSS، Clickjacking و مخفی‌سازی کامل هویت سرور (No X-Powered-By) فعال است.
                  </div>
                </div>
              </div>

              <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl flex items-start gap-2.5">
                <Activity className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-emerald-950">محدودکننده نرخ درخواست (Rate Limiting)</div>
                  <div className="text-[11px] text-emerald-800 mt-0.5">
                    جلوگیری از حملات منع سرویس (DoS) و درخواست‌های مکرر غیرمجاز روی API و پایگاه‌داده.
                  </div>
                </div>
              </div>

              <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl flex items-start gap-2.5">
                <Lock className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-emerald-950">ضد حملات Brute-Force ورود</div>
                  <div className="text-[11px] text-emerald-800 mt-0.5">
                    در صورت ۵ بار ورود اشتباه پیاپی، دسترسی ورود برای کاربر موقتاً مسدود و زمان‌دار می‌گردد.
                  </div>
                </div>
              </div>

              <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl flex items-start gap-2.5">
                <Database className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-emerald-950">اعتبارسنجی ورودی و ضد تزریق مخرب</div>
                  <div className="text-[11px] text-emerald-800 mt-0.5">
                    بررسی ساختار JSON و مسدودسازی خودکار کدهای مخرب و Prototype Pollution در سرور.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="bg-slate-50 border-t border-slate-200 px-6 py-3 flex items-center justify-end gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs text-slate-600 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 cursor-pointer"
          >
            بستن
          </button>
          <button
            type="submit"
            form="settings-form"
            id="save-settings-submit-btn"
            className="flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>ذخیره تنظیمات</span>
          </button>
        </div>
      </div>
    </div>
  );
};
