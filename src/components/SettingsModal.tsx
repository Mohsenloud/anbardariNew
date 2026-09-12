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
  Activity
} from 'lucide-react';

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
