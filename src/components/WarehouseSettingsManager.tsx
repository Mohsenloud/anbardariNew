import React, { useState, useMemo } from 'react';
import { StoreSettings, WarehouseInfo, Product, StockMovement } from '../types';
import { toPersianDigits } from '../utils/jalali';
import { StorageService } from '../utils/storage';
import {
  Warehouse,
  Plus,
  Edit2,
  Trash2,
  Check,
  CheckCircle2,
  AlertTriangle,
  MapPin,
  Phone,
  User,
  Tag,
  Boxes,
  SlidersHorizontal,
  ExternalLink,
  Info,
  Building2,
  Save,
  RotateCcw,
  Sparkles,
} from 'lucide-react';

interface WarehouseSettingsManagerProps {
  settings: StoreSettings;
  products: Product[];
  movements?: StockMovement[];
  onSaveSettings: (newSettings: StoreSettings) => void;
  onNavigateToTab?: (tab: string) => void;
}

export const WarehouseSettingsManager: React.FC<WarehouseSettingsManagerProps> = ({
  settings,
  products,
  movements = [],
  onSaveSettings,
  onNavigateToTab,
}) => {
  // Ensure we have a valid warehouses array
  const initialWarehouses: WarehouseInfo[] = useMemo(() => {
    if (settings.warehouses && settings.warehouses.length > 0) {
      return settings.warehouses;
    }
    return [
      {
        id: 'wh-1',
        name: 'انبار مرکزی',
        code: 'WH-01',
        address: 'تهران، جاده مخصوص، کیلومتر ۱۲، سوله شماره ۴',
        phone: '۰۲۱-۵۵۴۴۳۳۲۲',
        managerName: 'مرتضی اکبری',
        isDefault: true,
      },
      {
        id: 'wh-2',
        name: 'انبار شعبه ۱',
        code: 'WH-02',
        address: 'تهران، خیابان امیرکبیر، کوچه بهار، پلاک ۲۴',
        phone: '۰۲۱-۳۳۴۴۵۵۶۶',
        managerName: 'علی رضایی',
        isDefault: false,
      },
      {
        id: 'wh-3',
        name: 'انبار ضایعات و رزرو',
        code: 'WH-03',
        address: 'تهران، انتهای جاده قدیم، پلاک ۸',
        phone: '۰۲۱-۲۲۳۳۴۴۵۵',
        managerName: 'حسن مرادی',
        isDefault: false,
      },
    ];
  }, [settings.warehouses]);

  const [warehouseList, setWarehouseList] = useState<WarehouseInfo[]>(initialWarehouses);
  const [defaultWarehouseId, setDefaultWarehouseId] = useState<string>(
    settings.defaultWarehouseId || initialWarehouses.find((w) => w.isDefault)?.id || 'wh-1'
  );

  // Origin Warehouse form state
  const [originWarehouseFormData, setOriginWarehouseFormData] = useState({
    originWarehouseName: settings.originWarehouseName || 'انبار مرکزی سپهر',
    originWarehouseCode: settings.originWarehouseCode || 'WH-01',
    originWarehouseAddress: settings.originWarehouseAddress || '',
    originWarehousePhone: settings.originWarehousePhone || '',
    originWarehouseManager: settings.originWarehouseManager || '',
  });

  // Operational inventory rules state
  const [inventoryRules, setInventoryRules] = useState({
    enableInventory: settings.enableInventory ?? true,
    autoDeductStock: settings.autoDeductStock ?? true,
    allowNegativeStock: settings.allowNegativeStock ?? false,
    showLowStockAlerts: settings.showLowStockAlerts ?? true,
  });

  // Modal State for Add / Edit Warehouse
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingWarehouseId, setEditingWarehouseId] = useState<string | null>(null);
  const [modalFormData, setModalFormData] = useState<Omit<WarehouseInfo, 'id'>>({
    name: '',
    code: '',
    address: '',
    phone: '',
    managerName: '',
    isDefault: false,
  });

  // Modal State for Delete Confirmation
  const [warehouseToDelete, setWarehouseToDelete] = useState<WarehouseInfo | null>(null);

  // Form dirty flag to prevent background sync from wiping in-progress changes
  const isFormDirty = React.useRef(false);
  const [isSaving, setIsSaving] = useState(false);

  // Notification / Feedback message
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const showNotification = (text: string, type: 'success' | 'error' = 'success') => {
    setNotification({ type, text });
    setTimeout(() => {
      setNotification(null);
    }, 3000);
  };

  // Helper to update origin warehouse form with dirty flag
  const updateOriginField = (field: keyof typeof originWarehouseFormData, val: string) => {
    isFormDirty.current = true;
    setOriginWarehouseFormData((prev) => ({
      ...prev,
      [field]: val,
    }));
  };

  // Helper to toggle inventory rules with dirty flag
  const toggleRule = (field: keyof typeof inventoryRules) => {
    isFormDirty.current = true;
    setInventoryRules((prev) => ({
      ...prev,
      [field]: !prev[field],
    }));
  };

  // Keep state synchronized if settings prop changes externally, unless user is currently editing
  React.useEffect(() => {
    if (isFormDirty.current || isModalOpen) {
      return;
    }
    if (settings.warehouses && settings.warehouses.length > 0) {
      setWarehouseList(settings.warehouses);
    }
    if (settings.defaultWarehouseId) {
      setDefaultWarehouseId(settings.defaultWarehouseId);
    }
    setOriginWarehouseFormData({
      originWarehouseName: settings.originWarehouseName || 'انبار مرکزی سپهر',
      originWarehouseCode: settings.originWarehouseCode || 'WH-01',
      originWarehouseAddress: settings.originWarehouseAddress || '',
      originWarehousePhone: settings.originWarehousePhone || '',
      originWarehouseManager: settings.originWarehouseManager || '',
    });
    setInventoryRules({
      enableInventory: settings.enableInventory ?? true,
      autoDeductStock: settings.autoDeductStock ?? true,
      allowNegativeStock: settings.allowNegativeStock ?? false,
      showLowStockAlerts: settings.showLowStockAlerts ?? true,
    });
  }, [settings, isModalOpen]);

  // Handle Set Default Warehouse
  const handleSetDefault = (id: string) => {
    setDefaultWarehouseId(id);
    const updated = warehouseList.map((w) => ({
      ...w,
      isDefault: w.id === id,
    }));
    setWarehouseList(updated);

    const targetWh = updated.find((w) => w.id === id);
    if (targetWh) {
      showNotification(`انبار «${targetWh.name}» به عنوان انبار پیش‌فرض سامانه تعیین شد.`);
    }

    // Persist default warehouse immediately
    const updatedSettings: StoreSettings = {
      ...settings,
      warehouses: updated,
      defaultWarehouseId: id,
    };
    onSaveSettings(updatedSettings);
    StorageService.saveSettings(updatedSettings);
  };

  // Open modal to add new warehouse
  const handleOpenAddModal = () => {
    setEditingWarehouseId(null);
    setModalFormData({
      name: '',
      code: `WH-0${warehouseList.length + 1}`,
      address: '',
      phone: '',
      managerName: '',
      isDefault: warehouseList.length === 0,
    });
    setIsModalOpen(true);
  };

  // Open modal to edit existing warehouse
  const handleOpenEditModal = (wh: WarehouseInfo) => {
    setEditingWarehouseId(wh.id);
    setModalFormData({
      name: wh.name,
      code: wh.code || '',
      address: wh.address || '',
      phone: wh.phone || '',
      managerName: wh.managerName || '',
      isDefault: wh.id === defaultWarehouseId,
    });
    setIsModalOpen(true);
  };

  // Save warehouse (Add or Edit)
  const handleSaveModal = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = modalFormData.name.trim();
    if (!trimmedName) {
      showNotification('لطفاً نام انبار را وارد نمایید.', 'error');
      return;
    }

    let updatedList: WarehouseInfo[];
    let targetDefaultId = defaultWarehouseId;

    if (editingWarehouseId) {
      // Edit existing
      updatedList = warehouseList.map((item) => {
        if (item.id === editingWarehouseId) {
          return {
            ...item,
            name: trimmedName,
            code: modalFormData.code?.trim() || '',
            address: modalFormData.address?.trim() || '',
            phone: modalFormData.phone?.trim() || '',
            managerName: modalFormData.managerName?.trim() || '',
          };
        }
        return item;
      });

      if (modalFormData.isDefault) {
        targetDefaultId = editingWarehouseId;
        setDefaultWarehouseId(editingWarehouseId);
      }
      showNotification(`مشخصات انبار «${trimmedName}» با موفقیت ویرایش شد.`);
    } else {
      // Add new
      const newId = `wh-${Date.now()}`;
      const shouldBeDefault = modalFormData.isDefault || warehouseList.length === 0;

      const newWh: WarehouseInfo = {
        id: newId,
        name: trimmedName,
        code: modalFormData.code?.trim() || `WH-0${warehouseList.length + 1}`,
        address: modalFormData.address?.trim() || '',
        phone: modalFormData.phone?.trim() || '',
        managerName: modalFormData.managerName?.trim() || '',
        isDefault: shouldBeDefault,
      };

      if (shouldBeDefault) {
        targetDefaultId = newId;
        setDefaultWarehouseId(newId);
        updatedList = warehouseList.map((w) => ({ ...w, isDefault: false }));
        updatedList.push(newWh);
      } else {
        updatedList = [...warehouseList, newWh];
      }
      showNotification(`انبار جدید «${trimmedName}» با موفقیت ایجاد گردید.`);
    }

    const finalWarehouses = updatedList.map((w) => ({
      ...w,
      isDefault: w.id === targetDefaultId,
    }));

    setWarehouseList(finalWarehouses);
    setIsModalOpen(false);

    // Persist immediately
    const updatedSettings: StoreSettings = {
      ...settings,
      warehouses: finalWarehouses,
      defaultWarehouseId: targetDefaultId,
    };
    onSaveSettings(updatedSettings);
    StorageService.saveSettings(updatedSettings);
  };

  // Trigger Delete Warehouse (opens in-app confirmation modal)
  const handlePromptDelete = (wh: WarehouseInfo) => {
    if (warehouseList.length <= 1) {
      showNotification('حداقل یک انبار باید در سامانه فعال باقی بماند و امکان حذف آن وجود ندارد.', 'error');
      return;
    }
    setWarehouseToDelete(wh);
  };

  // Confirm Delete Warehouse
  const handleConfirmDelete = () => {
    if (!warehouseToDelete) return;
    const id = warehouseToDelete.id;
    const name = warehouseToDelete.name;

    if (warehouseList.length <= 1) {
      showNotification('حداقل یک انبار باید در سامانه فعال باقی بماند و امکان حذف آن وجود ندارد.', 'error');
      setWarehouseToDelete(null);
      return;
    }

    const updated = warehouseList.filter((w) => w.id !== id);
    let newDefault = defaultWarehouseId;
    if (defaultWarehouseId === id) {
      newDefault = updated[0].id;
      setDefaultWarehouseId(newDefault);
    }

    const finalWarehouses = updated.map((w) => ({
      ...w,
      isDefault: w.id === newDefault,
    }));

    setWarehouseList(finalWarehouses);
    setWarehouseToDelete(null);

    // Persist changes immediately to settings
    const newSettings: StoreSettings = {
      ...settings,
      warehouses: finalWarehouses,
      defaultWarehouseId: newDefault,
      originWarehouseName: originWarehouseFormData.originWarehouseName.trim() || 'انبار مرکزی سپهر',
      originWarehouseCode: originWarehouseFormData.originWarehouseCode.trim(),
      originWarehouseAddress: originWarehouseFormData.originWarehouseAddress.trim(),
      originWarehousePhone: originWarehouseFormData.originWarehousePhone.trim(),
      originWarehouseManager: originWarehouseFormData.originWarehouseManager.trim(),
      enableInventory: inventoryRules.enableInventory,
      autoDeductStock: inventoryRules.autoDeductStock,
      allowNegativeStock: inventoryRules.allowNegativeStock,
      showLowStockAlerts: inventoryRules.showLowStockAlerts,
    };
    onSaveSettings(newSettings);
    StorageService.saveSettings(newSettings);

    showNotification(`انبار «${name}» با موفقیت از سامانه حذف گردید.`);
  };

  // Quick Copy from a warehouse into Origin Warehouse Settings
  const handleCopyWarehouseToOrigin = (wh: WarehouseInfo) => {
    isFormDirty.current = true;
    setOriginWarehouseFormData({
      originWarehouseName: wh.name,
      originWarehouseCode: wh.code || 'WH-01',
      originWarehouseAddress: wh.address || '',
      originWarehousePhone: wh.phone || '',
      originWarehouseManager: wh.managerName || '',
    });
    showNotification(`مشخصات انبار «${wh.name}» در تنظیمات انبار مبدأ درج گردید.`);
  };

  // Master Save Function (Saves everything into StoreSettings)
  const handleMasterSave = () => {
    setIsSaving(true);
    const updatedWarehouses = warehouseList.map((w) => ({
      ...w,
      isDefault: w.id === defaultWarehouseId,
    }));

    const newSettings: StoreSettings = {
      ...settings,
      warehouses: updatedWarehouses,
      defaultWarehouseId: defaultWarehouseId,
      originWarehouseName: originWarehouseFormData.originWarehouseName.trim() || 'انبار مرکزی سپهر',
      originWarehouseCode: originWarehouseFormData.originWarehouseCode.trim(),
      originWarehouseAddress: originWarehouseFormData.originWarehouseAddress.trim(),
      originWarehousePhone: originWarehouseFormData.originWarehousePhone.trim(),
      originWarehouseManager: originWarehouseFormData.originWarehouseManager.trim(),
      enableInventory: inventoryRules.enableInventory,
      autoDeductStock: inventoryRules.autoDeductStock,
      allowNegativeStock: inventoryRules.allowNegativeStock,
      showLowStockAlerts: inventoryRules.showLowStockAlerts,
    };

    isFormDirty.current = false;
    onSaveSettings(newSettings);
    StorageService.saveSettings(newSettings);
    showNotification('کلیه تنظیمات و پیکربندی انبارها با موفقیت در سیستم و سرور ذخیره شد.');
    setTimeout(() => {
      setIsSaving(false);
    }, 500);
  };

  const defaultWh = warehouseList.find((w) => w.id === defaultWarehouseId) || warehouseList[0];
  const lowStockCount = products.filter((p) => p.stock <= p.minStockAlert).length;
  const totalStockUnits = products.reduce((sum, p) => sum + (p.stock || 0), 0);

  return (
    <div id="warehouse-settings-manager" className="space-y-6">
      {/* Toast Notification */}
      {notification && (
        <div
          id="warehouse-settings-toast"
          className={`fixed top-5 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2.5 rounded-xl shadow-xl text-xs font-bold transition-all animate-bounce ${
            notification.type === 'success'
              ? 'bg-emerald-800 text-white border border-emerald-600'
              : 'bg-rose-800 text-white border border-rose-600'
          }`}
        >
          {notification.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-300 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-rose-300 shrink-0" />
          )}
          <span>{notification.text}</span>
        </div>
      )}

      {/* Top Banner / Metrics Card */}
      <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-amber-600 text-white flex items-center justify-center shadow-md shadow-amber-600/20 shrink-0">
            <Warehouse className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base sm:text-lg font-black text-slate-900">
                تنظیمات و تعریف انبارهای سامانه
              </h3>
              <span className="bg-amber-100 text-amber-800 text-[11px] font-bold px-2.5 py-0.5 rounded-full">
                {toPersianDigits(warehouseList.length)} انبار فعال
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              پیکربندی هویت انبارها، انبار مبدأ بارگیری حواله‌های خروج کالا و قوانین گردش موجودی
            </p>
          </div>
        </div>

        {/* Master Save Button */}
        <div className="flex items-center gap-2 shrink-0">
          {onNavigateToTab && (
            <button
              type="button"
              id="goto-inventory-tab-btn"
              onClick={() => onNavigateToTab('inventory')}
              className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              <Boxes className="w-4 h-4 text-blue-600" />
              <span>ورود به کاردکس کالا</span>
              <ExternalLink className="w-3.5 h-3.5 opacity-60" />
            </button>
          )}

          <button
            type="button"
            id="warehouse-master-save-btn"
            onClick={handleMasterSave}
            disabled={isSaving}
            className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 disabled:opacity-50 text-white px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm shadow-emerald-200 cursor-pointer"
          >
            <Save className={`w-4 h-4 ${isSaving ? 'animate-spin' : ''}`} />
            <span>{isSaving ? 'در حال ذخیره‌سازی...' : 'ذخیره تنظیمات انبار'}</span>
          </button>
        </div>
      </div>

      {/* Mini Stats Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-slate-400 text-[11px] block">انبار پیش‌فرض فعال:</span>
            <span className="text-sm font-black text-slate-800 mt-0.5 block truncate max-w-[170px]">
              {defaultWh?.name || 'تعریف نشده'}
            </span>
            <span className="text-[10px] text-slate-500 font-mono">
              کد: {defaultWh?.code ? toPersianDigits(defaultWh.code) : 'WH-01'}
            </span>
          </div>
          <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl">
            <Warehouse className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-slate-400 text-[11px] block">تنوع اقلام در سیستم:</span>
            <span className="text-sm font-black text-slate-800 mt-0.5 block">
              {toPersianDigits(products.length)} کالا
            </span>
            <span className="text-[10px] text-slate-500">
              موجودی فیزیکی: {toPersianDigits(totalStockUnits)} واحد
            </span>
          </div>
          <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
            <Boxes className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-slate-400 text-[11px] block">کالاهای نیازمند شارژ:</span>
            <span
              className={`text-sm font-black mt-0.5 block ${
                lowStockCount > 0 ? 'text-amber-600' : 'text-emerald-600'
              }`}
            >
              {lowStockCount > 0 ? `${toPersianDigits(lowStockCount)} کالا کمبود` : 'موجودی ایده‌آل'}
            </span>
            <span className="text-[10px] text-slate-500">بر اساس حداقل نقطه سفارش</span>
          </div>
          <div
            className={`p-2.5 rounded-xl ${
              lowStockCount > 0 ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'
            }`}
          >
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-slate-400 text-[11px] block">کسر خودکار موجودی:</span>
            <span
              className={`text-sm font-black mt-0.5 block ${
                inventoryRules.autoDeductStock ? 'text-emerald-600' : 'text-rose-600'
              }`}
            >
              {inventoryRules.autoDeductStock ? 'فعال (با صدور فاکتور)' : 'غیرفعال (دستی)'}
            </span>
            <span className="text-[10px] text-slate-500">همگام با ثبت سفارش</span>
          </div>
          <div
            className={`p-2.5 rounded-xl ${
              inventoryRules.autoDeductStock
                ? 'bg-emerald-50 text-emerald-600'
                : 'bg-rose-50 text-rose-600'
            }`}
          >
            <SlidersHorizontal className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* SECTION 1: WAREHOUSE DEFINITIONS (تعریف و مدیریت انبارها) */}
      <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <h4 className="text-base font-black text-slate-900 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-amber-600" />
              <span>لیست و تعریف انبارهای سازمانی</span>
            </h4>
            <p className="text-xs text-slate-500 mt-0.5">
              در این بخش می‌توانید انبارهای اصلی، شعب، سوله‌ها و انبارهای پشتیبان را تعریف و مدیریت نمایید.
            </p>
          </div>

          <button
            type="button"
            id="add-warehouse-btn"
            onClick={handleOpenAddModal}
            className="flex items-center justify-center gap-1.5 bg-amber-600 hover:bg-amber-700 active:scale-95 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>تعریف انبار جدید</span>
          </button>
        </div>

        {/* Warehouses Grid List */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
          {warehouseList.map((wh) => {
            const isDef = wh.id === defaultWarehouseId;
            return (
              <div
                key={wh.id}
                className={`rounded-2xl p-4 border-2 transition-all flex flex-col justify-between ${
                  isDef
                    ? 'border-amber-500 bg-amber-50/20 shadow-xs'
                    : 'border-slate-200 bg-slate-50/40 hover:border-slate-300'
                }`}
              >
                <div>
                  {/* Top Header of Card */}
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs ${
                          isDef ? 'bg-amber-600 text-white' : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        <Warehouse className="w-4 h-4" />
                      </div>
                      <div>
                        <h5 className="font-bold text-sm text-slate-900">{wh.name}</h5>
                        {wh.code && (
                          <span className="text-[10px] text-slate-500 font-mono">
                            کد: {toPersianDigits(wh.code)}
                          </span>
                        )}
                      </div>
                    </div>

                    {isDef ? (
                      <span className="bg-amber-100 text-amber-800 border border-amber-300 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                        <Check className="w-3 h-3 text-amber-600" />
                        <span>انبار پیش‌فرض</span>
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleSetDefault(wh.id)}
                        className="text-[10px] font-bold text-slate-500 hover:text-amber-700 hover:bg-amber-50 px-2 py-0.5 rounded-lg border border-slate-200 transition-colors cursor-pointer"
                        title="تنظیم به عنوان انبار پیش‌فرض سیستم"
                      >
                        انتخاب پیش‌فرض
                      </button>
                    )}
                  </div>

                  {/* Warehouse Meta Details */}
                  <div className="space-y-1.5 text-xs text-slate-600 my-3">
                    {wh.managerName ? (
                      <div className="flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="text-slate-400 text-[11px]">مسئول انبار:</span>
                        <span className="font-semibold text-slate-800">{wh.managerName}</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 text-slate-400 text-[11px]">
                        <User className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                        <span>مسئول انبار: تعیین نشده</span>
                      </div>
                    )}

                    {wh.phone ? (
                      <div className="flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="text-slate-400 text-[11px]">شماره تماس:</span>
                        <span className="font-mono font-medium text-slate-800">
                          {toPersianDigits(wh.phone)}
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 text-slate-400 text-[11px]">
                        <Phone className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                        <span>تلفن تماس: تعیین نشده</span>
                      </div>
                    )}

                    {wh.address && (
                      <div className="flex items-start gap-1.5 pt-1 text-[11px]">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                        <span className="text-slate-700 line-clamp-2 leading-relaxed">
                          {wh.address}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Actions Footer */}
                <div className="pt-3 border-t border-slate-200/70 flex items-center justify-between gap-1 text-xs">
                  <button
                    type="button"
                    onClick={() => handleCopyWarehouseToOrigin(wh)}
                    className="text-[11px] text-amber-700 hover:text-amber-900 hover:bg-amber-50 font-bold px-2 py-1 rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
                    title="کپی کردن مشخصات این انبار در فیلدهای حواله خروج کالا"
                  >
                    <Sparkles className="w-3 h-3 text-amber-500" />
                    <span>تنظیم به عنوان انبار مبدأ</span>
                  </button>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleOpenEditModal(wh)}
                      className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                      title="ویرایش مشخصات انبار"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      id={`delete-warehouse-${wh.id}`}
                      disabled={warehouseList.length <= 1}
                      onClick={() => handlePromptDelete(wh)}
                      className={`p-1.5 rounded-lg transition-colors ${
                        warehouseList.length <= 1
                          ? 'text-slate-300 cursor-not-allowed'
                          : 'text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer'
                      }`}
                      title={
                        warehouseList.length <= 1
                          ? 'امکان حذف تنها انبار باقی‌مانده وجود ندارد'
                          : `حذف انبار «${wh.name}»`
                      }
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* SECTION 2: ORIGIN WAREHOUSE SETTINGS (مشخصات انبار مبدأ جهت حواله خروج و بارگیری) */}
      <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <h4 className="text-base font-black text-slate-900 flex items-center gap-2">
              <Warehouse className="w-5 h-5 text-emerald-600" />
              <span>مشخصات انبار مبدأ بارگیری (مندرج در حواله خروج و تحویل کالا)</span>
            </h4>
            <p className="text-xs text-slate-500 mt-0.5">
              اطلاعاتی که در برگه خروج رسمی، حواله تحویل فیزیکی، رسید انباردار و متن اشتراک‌گذاری رانندگان درج می‌گردد.
            </p>
          </div>

          {/* Quick Sync Selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-600 whitespace-nowrap hidden sm:inline">
              جایگذاری سریع از:
            </span>
            <select
              onChange={(e) => {
                const targetId = e.target.value;
                const wh = warehouseList.find((w) => w.id === targetId);
                if (wh) {
                  handleCopyWarehouseToOrigin(wh);
                }
              }}
              className="bg-slate-50 hover:bg-slate-100 border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-800 outline-none focus:border-amber-500 cursor-pointer"
            >
              <option value="">-- انتخاب انبار تعریف‌شده --</option>
              {warehouseList.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name} {w.id === defaultWarehouseId ? '(پیش‌فرض)' : ''}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Origin Warehouse Form Fields */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
          <div>
            <label className="block text-slate-700 font-bold mb-1.5">
              نام انبار مبدأ بارگیری <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={originWarehouseFormData.originWarehouseName}
              onChange={(e) => updateOriginField('originWarehouseName', e.target.value)}
              placeholder="مثال: انبار مرکزی سپهر"
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-slate-800 font-bold outline-none focus:bg-white focus:border-emerald-500"
            />
            <p className="text-[10px] text-slate-400 mt-1">عنوان چاپ شده در سربرگ حواله خروج کالا</p>
          </div>

          <div>
            <label className="block text-slate-700 font-bold mb-1.5">کد یا شناسه انبار مبدأ</label>
            <input
              type="text"
              value={originWarehouseFormData.originWarehouseCode}
              onChange={(e) => updateOriginField('originWarehouseCode', e.target.value)}
              placeholder="مثال: WH-01"
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-slate-800 font-mono outline-none focus:bg-white focus:border-emerald-500 text-left"
              dir="ltr"
            />
            <p className="text-[10px] text-slate-400 mt-1">شناسه یکتای سوله یا انبار</p>
          </div>

          <div>
            <label className="block text-slate-700 font-bold mb-1.5">نام متصدی / سرپرست انبار</label>
            <input
              type="text"
              value={originWarehouseFormData.originWarehouseManager}
              onChange={(e) => updateOriginField('originWarehouseManager', e.target.value)}
              placeholder="مثال: مرتضی اکبری"
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-slate-800 font-semibold outline-none focus:bg-white focus:border-emerald-500"
            />
            <p className="text-[10px] text-slate-400 mt-1">در بخش امضا و تایید خروج بار درج می‌شود</p>
          </div>

          <div>
            <label className="block text-slate-700 font-bold mb-1.5">
              شماره تلفن مستقیم / داخلی انبار
            </label>
            <input
              type="text"
              value={originWarehouseFormData.originWarehousePhone}
              onChange={(e) => updateOriginField('originWarehousePhone', e.target.value)}
              placeholder="مثال: ۰۲۱-۵۵۴۴۳۳۲۲"
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-slate-800 font-mono outline-none focus:bg-white focus:border-emerald-500 text-left"
              dir="ltr"
            />
            <p className="text-[10px] text-slate-400 mt-1">جهت تماس راننده و هماهنگی بارگیری</p>
          </div>

          <div className="sm:col-span-2">
            <label className="block text-slate-700 font-bold mb-1.5">
              نشانی دقیق محل بارگیری کالا و راهنمای راننده
            </label>
            <input
              type="text"
              value={originWarehouseFormData.originWarehouseAddress}
              onChange={(e) => updateOriginField('originWarehouseAddress', e.target.value)}
              placeholder="تهران، جاده مخصوص، کیلومتر ۱۲، خیابان بهار، سوله شماره ۴"
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-slate-800 font-medium outline-none focus:bg-white focus:border-emerald-500"
            />
            <p className="text-[10px] text-slate-400 mt-1">آدرس فیزیکی چاپ شده در پایین مشخصات حواله</p>
          </div>
        </div>

        {/* Live Preview Box of Origin Warehouse on Exit Slip */}
        <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 mt-2 text-xs">
          <div className="flex items-center gap-1.5 text-slate-600 font-bold mb-2">
            <Info className="w-4 h-4 text-blue-600" />
            <span>پیش‌نمایش کادر مشخصات انبار مبدأ در برگه چاپی حواله خروج کالا:</span>
          </div>

          <div className="bg-white p-3.5 rounded-lg border border-slate-300 text-slate-800">
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="font-black text-slate-900">
                  {originWarehouseFormData.originWarehouseName || 'انبار مرکزی سپهر'}
                </span>
                {originWarehouseFormData.originWarehouseCode && (
                  <span className="bg-slate-100 text-slate-700 text-[10px] font-mono px-1.5 py-0.5 rounded">
                    کد: {toPersianDigits(originWarehouseFormData.originWarehouseCode)}
                  </span>
                )}
              </div>
              <span className="text-[11px] text-slate-500">
                مسئول انبار:{' '}
                <strong>{originWarehouseFormData.originWarehouseManager || 'مرتضی اکبری'}</strong>
              </span>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-slate-600">
              <div className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>
                  نشانی:{' '}
                  {originWarehouseFormData.originWarehouseAddress ||
                    'تهران، جاده مخصوص، کیلومتر ۱۲، خیابان بهار، سوله شماره ۴'}
                </span>
              </div>
              <div className="flex items-center gap-1 font-mono shrink-0">
                <Phone className="w-3.5 h-3.5 text-slate-400" />
                <span>
                  تلفن:{' '}
                  {originWarehouseFormData.originWarehousePhone
                    ? toPersianDigits(originWarehouseFormData.originWarehousePhone)
                    : '۰۲۱-۵۵۴۴۳۳۲۲'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 3: INVENTORY OPERATIONAL RULES (قوانین و رفتار انبارداری در فاکتورساز) */}
      <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 shadow-xs space-y-5">
        <div>
          <h4 className="text-base font-black text-slate-900 flex items-center gap-2">
            <SlidersHorizontal className="w-5 h-5 text-emerald-600" />
            <span>قوانین و رفتارهای عملیاتی انبارداری در سیستم</span>
          </h4>
          <p className="text-xs text-slate-500 mt-0.5">
            تعیین سازوکار کسر موجودی، اجازه فروش منفی و هشدارهای کمبود انبار در زمان صدور فاکتور
          </p>
        </div>

        <div className="divide-y divide-slate-100 space-y-4 pt-1">
          {/* Rule 1: Enable Inventory Module */}
          <div className="pt-3 flex items-center justify-between gap-4">
            <div className="space-y-1">
              <span className="font-bold text-xs sm:text-sm text-slate-800">
                فعال‌سازی ماژول مدیریت انبارداری و کاردکس کالا
              </span>
              <p className="text-[11px] text-slate-500">
                در صورت خاموش بودن، تب انبارداری در منوی اصلی مخفی شده و محاسبه موجودی متوقف می‌شود.
              </p>
            </div>
            <button
              type="button"
              onClick={() => toggleRule('enableInventory')}
              className={`w-12 h-6.5 flex items-center rounded-full p-1 transition-colors cursor-pointer shrink-0 ${
                inventoryRules.enableInventory ? 'bg-emerald-600' : 'bg-slate-300'
              }`}
            >
              <div
                className={`bg-white w-4.5 h-4.5 rounded-full shadow-md transform transition-transform ${
                  inventoryRules.enableInventory ? '-translate-x-5.5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Rule 2: Auto Deduct Stock */}
          <div className="pt-4 flex items-center justify-between gap-4">
            <div className="space-y-1">
              <span className="font-bold text-xs sm:text-sm text-slate-800">
                کسر خودکار موجودی از انبار همزمان با ثبت فاکتور فروش
              </span>
              <p className="text-[11px] text-slate-500">
                با صدور و ذخیره فاکتور، به تعداد اقلام از موجودی کالا در انبار کسر و گردش در کاردکس ثبت می‌گردد.
              </p>
            </div>
            <button
              type="button"
              onClick={() => toggleRule('autoDeductStock')}
              className={`w-12 h-6.5 flex items-center rounded-full p-1 transition-colors cursor-pointer shrink-0 ${
                inventoryRules.autoDeductStock ? 'bg-emerald-600' : 'bg-slate-300'
              }`}
            >
              <div
                className={`bg-white w-4.5 h-4.5 rounded-full shadow-md transform transition-transform ${
                  inventoryRules.autoDeductStock ? '-translate-x-5.5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Rule 3: Allow Negative Stock */}
          <div className="pt-4 flex items-center justify-between gap-4">
            <div className="space-y-1">
              <span className="font-bold text-xs sm:text-sm text-slate-800">
                مجوز فروش کالا در صورت عدم موجودی کافی (موجودی منفی)
              </span>
              <p className="text-[11px] text-slate-500">
                در صورت فعال بودن، حتی اگر موجودی کالا در انبار صفر یا منفی باشد، صدور فاکتور متوقف نخواهد شد.
              </p>
            </div>
            <button
              type="button"
              onClick={() => toggleRule('allowNegativeStock')}
              className={`w-12 h-6.5 flex items-center rounded-full p-1 transition-colors cursor-pointer shrink-0 ${
                inventoryRules.allowNegativeStock ? 'bg-amber-500' : 'bg-slate-300'
              }`}
            >
              <div
                className={`bg-white w-4.5 h-4.5 rounded-full shadow-md transform transition-transform ${
                  inventoryRules.allowNegativeStock ? '-translate-x-5.5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Rule 4: Show Low Stock Alerts */}
          <div className="pt-4 flex items-center justify-between gap-4">
            <div className="space-y-1">
              <span className="font-bold text-xs sm:text-sm text-slate-800">
                نمایش نشانگر هشدار کمبود موجودی در نوار بالای سامانه
              </span>
              <p className="text-[11px] text-slate-500">
                به محض رسیدن موجودی هر کالا به حد هشدار، علامت هشدار کمبود کالا در هدر سیستم نمایان خواهد شد.
              </p>
            </div>
            <button
              type="button"
              onClick={() => toggleRule('showLowStockAlerts')}
              className={`w-12 h-6.5 flex items-center rounded-full p-1 transition-colors cursor-pointer shrink-0 ${
                inventoryRules.showLowStockAlerts ? 'bg-emerald-600' : 'bg-slate-300'
              }`}
            >
              <div
                className={`bg-white w-4.5 h-4.5 rounded-full shadow-md transform transition-transform ${
                  inventoryRules.showLowStockAlerts ? '-translate-x-5.5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Save Action Bar */}
      <div className="bg-slate-900 text-white rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
            <Warehouse className="w-5 h-5" />
          </div>
          <div>
            <span className="font-bold text-sm block">تثبیت و ذخیره‌سازی پیکربندی انبارها</span>
            <span className="text-slate-400 text-xs">
              تغییرات شما در پایگاه‌داده محلی و کلیه حواله‌ها، فاکتورها و کاردکس‌ها اعمال می‌شود.
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={handleMasterSave}
          disabled={isSaving}
          className="flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 active:scale-95 disabled:opacity-50 text-slate-950 px-6 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer shadow-md"
        >
          <Check className={`w-4 h-4 ${isSaving ? 'animate-spin' : ''}`} />
          <span>{isSaving ? 'در حال ذخیره‌سازی...' : 'ذخیره نهایی تنظیمات انبار'}</span>
        </button>
      </div>

      {/* MODAL: ADD / EDIT WAREHOUSE */}
      {isModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs font-['Vazirmatn']">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden border border-slate-200 animate-scaleUp">
            <div className="bg-slate-900 text-white px-5 py-3.5 flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Warehouse className="w-5 h-5 text-amber-400" />
                <h4 className="font-bold text-sm text-white">
                  {editingWarehouseId ? 'ویرایش مشخصات انبار' : 'تعریف انبار جدید'}
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveModal} className="p-4 sm:p-5 space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  نام انبار <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={modalFormData.name}
                  onChange={(e) => setModalFormData({ ...modalFormData, name: e.target.value })}
                  placeholder="مثال: انبار مرکزی، سوله شماره ۳، انبار فروشگاه"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:bg-white focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">کد یا شناسه انبار</label>
                  <input
                    type="text"
                    value={modalFormData.code}
                    onChange={(e) => setModalFormData({ ...modalFormData, code: e.target.value })}
                    placeholder="WH-01"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono text-left outline-none focus:bg-white focus:border-amber-500"
                    dir="ltr"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">شماره تماس انبار</label>
                  <input
                    type="text"
                    value={modalFormData.phone}
                    onChange={(e) => setModalFormData({ ...modalFormData, phone: e.target.value })}
                    placeholder="۰۲۱-۵۵۴۴۳۳۲۲"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono text-left outline-none focus:bg-white focus:border-amber-500"
                    dir="ltr"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">نام مسئول / انباردار</label>
                <input
                  type="text"
                  value={modalFormData.managerName}
                  onChange={(e) =>
                    setModalFormData({ ...modalFormData, managerName: e.target.value })
                  }
                  placeholder="مثال: مرتضی اکبری"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs outline-none focus:bg-white focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">نشانی دقیق فیزیکی</label>
                <textarea
                  rows={2}
                  value={modalFormData.address}
                  onChange={(e) => setModalFormData({ ...modalFormData, address: e.target.value })}
                  placeholder="نشانی، سوله، کوچه و پلاک انبار..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs outline-none focus:bg-white focus:border-amber-500 resize-none"
                />
              </div>

              <div className="pt-2">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={modalFormData.isDefault}
                    onChange={(e) =>
                      setModalFormData({ ...modalFormData, isDefault: e.target.checked })
                    }
                    className="w-4 h-4 text-amber-600 rounded"
                  />
                  <span className="font-bold text-slate-700">
                    تعیین به عنوان انبار پیش‌فرض سامانه
                  </span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold bg-amber-600 hover:bg-amber-700 active:scale-95 text-white rounded-xl shadow-md cursor-pointer transition-all"
                >
                  {editingWarehouseId ? 'ذخیره تغییرات انبار' : 'افزودن انبار'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: DELETE WAREHOUSE CONFIRMATION */}
      {warehouseToDelete && (
        <div
          id="delete-warehouse-modal"
          className="fixed inset-0 z-70 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs font-['Vazirmatn']"
        >
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden border border-slate-200">
            <div className="bg-rose-600 text-white px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                  <Trash2 className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h4 className="font-black text-sm text-white">حذف انبار سازمانی</h4>
                  <span className="text-[11px] text-rose-100 block">تایید حذف انبار از سامانه</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setWarehouseToDelete(null)}
                className="text-white/80 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="bg-rose-50 border border-rose-200 rounded-xl p-3.5 text-rose-900 leading-relaxed">
                <p className="font-bold text-sm text-rose-950 mb-1">
                  آیا از حذف انبار «{warehouseToDelete.name}» اطمینان دارید؟
                </p>
                {warehouseToDelete.code && (
                  <p className="text-slate-600 font-mono text-[11px] mt-1">
                    کد انبار: {toPersianDigits(warehouseToDelete.code)}
                  </p>
                )}
                {warehouseToDelete.managerName && (
                  <p className="text-slate-600 text-[11px] mt-0.5">
                    مسئول: {warehouseToDelete.managerName}
                  </p>
                )}
              </div>

              {warehouseToDelete.id === defaultWarehouseId && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-amber-900 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-[11px] leading-relaxed">
                    <strong>هشدار:</strong> این انبار، انبار پیش‌فرض سامانه است. پس از حذف، انبار فعال دیگری به عنوان انبار پیش‌فرض جدید جایگزین خواهد شد.
                  </p>
                </div>
              )}

              <p className="text-slate-500 text-[11px]">
                توجه: اطلاعات فاکتورها و کاردکس‌های قبلی حفظ خواهد شد، اما این انبار از لیست انبارهای انتخابی حذف خواهد شد.
              </p>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  id="cancel-delete-warehouse-btn"
                  onClick={() => setWarehouseToDelete(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer transition-colors"
                >
                  انصراف
                </button>
                <button
                  type="button"
                  id="confirm-delete-warehouse-btn"
                  onClick={handleConfirmDelete}
                  className="flex items-center gap-1.5 px-5 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-700 active:scale-95 text-white rounded-xl shadow-md shadow-rose-200 cursor-pointer transition-all"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>بله، حذف قطعی انبار</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
