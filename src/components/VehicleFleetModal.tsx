import React, { useState, useEffect } from 'react';
import {
  X,
  Truck,
  Trash2,
  Search,
  Plus,
  User,
  Phone,
  AlertTriangle,
  CheckCircle2,
  BookmarkPlus,
  Car,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { SavedVehicle } from '../types';
import { StorageService } from '../utils/storage';
import { toPersianDigits } from '../utils/jalali';
import { IranPlatePicker, MiniIranPlate, parseVehicleInfo } from './IranPlatePicker';

interface VehicleFleetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectVehicle?: (vehicle: SavedVehicle & { sourceLabel?: string }) => void;
}

export const VehicleFleetModal: React.FC<VehicleFleetModalProps> = ({
  isOpen,
  onClose,
  onSelectVehicle,
}) => {
  const [vehicles, setVehicles] = useState<Array<SavedVehicle & { sourceLabel?: string }>>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [vehicleToDelete, setVehicleToDelete] = useState<(SavedVehicle & { sourceLabel?: string }) | null>(null);
  const [isDeletingAll, setIsDeletingAll] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // New vehicle form toggle & states
  const [showAddForm, setShowAddForm] = useState(false);
  const [newVehicleType, setNewVehicleType] = useState('وانت باربری');
  const [newVehicleInfo, setNewVehicleInfo] = useState('');
  const [newDriverName, setNewDriverName] = useState('');
  const [newDriverPhone, setNewDriverPhone] = useState('');

  const refreshList = () => {
    setVehicles(StorageService.getExitSlipVehicles());
  };

  useEffect(() => {
    if (isOpen) {
      refreshList();
    }
  }, [isOpen]);

  useEffect(() => {
    const unsub = StorageService.subscribe(() => {
      refreshList();
    });
    return () => unsub();
  }, []);

  if (!isOpen) return null;

  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    setFeedback({ type, message });
    setTimeout(() => {
      setFeedback(null);
    }, 4000);
  };

  // Delete single vehicle
  const handleConfirmDelete = () => {
    if (!vehicleToDelete) return;
    const name = vehicleToDelete.vehicleType || vehicleToDelete.vehicleInfo;
    StorageService.deleteSavedVehicle(vehicleToDelete.id, vehicleToDelete.vehicleInfo);
    setVehicleToDelete(null);
    refreshList();
    showNotification(`خودروی «${name}» با موفقیت از ناوگان حذف گردید.`);
  };

  // Clear all vehicles
  const handleConfirmClearAll = () => {
    StorageService.clearAllSavedVehicles();
    setIsDeletingAll(false);
    refreshList();
    showNotification('تمام خودروهای ثبت‌شده در ناوگان با موفقیت حذف و پاکسازی شدند.');
  };

  // Add new vehicle
  const handleAddNewVehicle = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVehicleInfo.trim()) {
      showNotification('لطفاً مشخصات یا پلاک خودرو را وارد نمایید.', 'error');
      return;
    }

    const parsed = parseVehicleInfo(newVehicleInfo);
    const plateNumber = (!parsed?.isFreeText && parsed?.part1 && parsed?.part2)
      ? `${parsed.part1} ${parsed.letter} ${parsed.part2} ایران ${parsed.iranCode}`
      : '';

    StorageService.addOrUpdateSavedVehicle({
      vehicleType: newVehicleType.trim() || parsed?.vehicleType || 'وانت باربری',
      vehicleInfo: newVehicleInfo.trim(),
      driverName: newDriverName.trim(),
      driverPhone: newDriverPhone.trim(),
      plateNumber,
      colorDesc: parsed?.colorDesc || '',
    });

    setNewVehicleInfo('');
    setNewDriverName('');
    setNewDriverPhone('');
    setShowAddForm(false);
    refreshList();
    showNotification('خودروی جدید با موفقیت به ناوگان اضافه گردید.');
  };

  const filteredVehicles = vehicles.filter((v) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (v.vehicleInfo || '').toLowerCase().includes(q) ||
      (v.vehicleType || '').toLowerCase().includes(q) ||
      (v.driverName || '').toLowerCase().includes(q) ||
      (v.driverPhone || '').includes(q) ||
      (v.plateNumber || '').includes(q) ||
      (v.sourceLabel || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/65 backdrop-blur-xs">
      <div 
        id="vehicle-fleet-modal"
        className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden border border-slate-200 animate-scaleUp flex flex-col max-h-[92vh]"
      >
        {/* Modal Header */}
        <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between shrink-0 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center text-amber-400 shrink-0">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base">
                مدیریت و حذف خودروهای ثبت‌شده در ناوگان
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                مشاهده، افزودن، حذف تکی یا پاکسازی کلیه ماشین‌های حواله خروج و امانی
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Feedback Message */}
        {feedback && (
          <div
            className={`px-5 py-2.5 text-xs flex items-center justify-between border-b ${
              feedback.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-rose-50 text-rose-800 border-rose-200'
            }`}
          >
            <div className="flex items-center gap-2">
              {feedback.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <span className="font-medium">{feedback.message}</span>
            </div>
            <button
              type="button"
              onClick={() => setFeedback(null)}
              className="text-slate-400 hover:text-slate-700 p-0.5 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Action & Search Bar */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
            <input
              type="text"
              id="fleet-search-input"
              placeholder="جستجوی پلاک، مدل، راننده یا شماره تماس..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pr-9 pl-3 py-1.5 text-xs bg-white border border-slate-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-amber-500 focus:border-amber-500 shadow-2xs"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              id="toggle-add-vehicle-btn"
              onClick={() => setShowAddForm(!showAddForm)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>افزودن خودرو جدید</span>
              {showAddForm ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>

            {vehicles.length > 0 && (
              <button
                type="button"
                id="clear-all-fleet-btn"
                onClick={() => setIsDeletingAll(true)}
                className="inline-flex items-center gap-1 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                title="پاکسازی کلیه خودروهای ثبت‌شده"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>حذف همه ({toPersianDigits(vehicles.length)})</span>
              </button>
            )}
          </div>
        </div>

        {/* Collapsible Add Vehicle Form */}
        {showAddForm && (
          <form
            onSubmit={handleAddNewVehicle}
            className="p-4 bg-amber-50/50 border-b border-amber-200 space-y-3 shrink-0 animate-fadeIn"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                <BookmarkPlus className="w-4 h-4 text-amber-600" />
                <span>مشخصات خودروی جدید جهت ثبت در ناوگان:</span>
              </span>
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="text-xs text-slate-400 hover:text-slate-600"
              >
                بستن فرم
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  نوع خودرو:
                </label>
                <input
                  type="text"
                  value={newVehicleType}
                  onChange={(e) => setNewVehicleType(e.target.value)}
                  placeholder="وانت بار، نیسان، خاور..."
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  نام راننده:
                </label>
                <input
                  type="text"
                  value={newDriverName}
                  onChange={(e) => setNewDriverName(e.target.value)}
                  placeholder="نام و نام خانوادگی راننده"
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  شماره تماس راننده:
                </label>
                <input
                  type="text"
                  dir="ltr"
                  value={newDriverPhone}
                  onChange={(e) => setNewDriverPhone(e.target.value)}
                  placeholder="۰۹۱۲۳۴۵۶۷۸۹"
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                مشخصات و پلاک خودرو (ایران): <span className="text-rose-500">*</span>
              </label>
              <IranPlatePicker
                value={newVehicleInfo}
                onChange={setNewVehicleInfo}
                initialVehicleType={newVehicleType}
              />
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="submit"
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
              >
                ثبت خودرو در ناوگان
              </button>
            </div>
          </form>
        )}

        {/* Vehicles List Container */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
          {filteredVehicles.length === 0 ? (
            <div className="text-center py-16 text-slate-400 space-y-3 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200 p-8">
              <Car className="w-12 h-12 mx-auto text-slate-300" />
              <div className="text-sm font-bold text-slate-700">
                {searchQuery ? 'هیچ خودرویی با این مشخصات یافت نشد' : 'هنوز هیچ خودرویی در ناوگان ثبت نشده است'}
              </div>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                {searchQuery
                  ? 'می‌توانید عبارت جستجو را تغییر دهید یا فیلتر را پاک نمایید.'
                  : 'با ثبت خودرو در فرم‌های حواله خروج یا با کلیک روی «افزودن خودرو جدید» بالا، ناوگان خود را تعریف کنید.'}
              </p>
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="px-3 py-1.5 bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
                >
                  پاک کردن جستجو
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {filteredVehicles.map((veh) => (
                <div
                  key={veh.id}
                  id={`fleet-card-${veh.id}`}
                  className="bg-white p-3.5 rounded-2xl border border-slate-200 hover:border-amber-400 hover:shadow-md transition-all flex flex-col justify-between gap-3 group relative"
                >
                  {/* Vehicle Header info */}
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-slate-900 text-xs sm:text-sm">
                          {veh.vehicleType}
                        </span>
                        {veh.sourceLabel && (
                          <span className="text-[9px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-md border border-slate-200 font-medium">
                            {veh.sourceLabel}
                          </span>
                        )}
                      </div>

                      {/* Delete button directly visible */}
                      <button
                        type="button"
                        id={`delete-veh-${veh.id}`}
                        onClick={() => setVehicleToDelete(veh)}
                        className="p-1.5 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                        title="حذف این ماشین از ناوگان"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Graphic Plate */}
                    <div className="mt-2">
                      <MiniIranPlate plateInfo={veh.vehicleInfo} />
                    </div>

                    {/* Driver & Phone details */}
                    <div className="mt-2.5 space-y-1 text-xs text-slate-600">
                      {veh.driverName && (
                        <div className="flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-slate-400" />
                          <span className="font-medium text-slate-800">{veh.driverName}</span>
                        </div>
                      )}
                      {veh.driverPhone && (
                        <div className="flex items-center gap-1.5 font-mono text-[11px]">
                          <Phone className="w-3.5 h-3.5 text-slate-400" />
                          <span dir="ltr">{toPersianDigits(veh.driverPhone)}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Card Footer */}
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2 text-[11px]">
                    <span className="text-slate-400 text-[10px]">
                      ثبت: {veh.createdAt ? toPersianDigits(veh.createdAt) : 'نامشخص'}
                    </span>

                    <div className="flex items-center gap-1.5">
                      {onSelectVehicle && (
                        <button
                          type="button"
                          onClick={() => {
                            onSelectVehicle(veh);
                            onClose();
                          }}
                          className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-bold text-[11px] shadow-2xs transition-colors cursor-pointer"
                        >
                          انتخاب در حواله
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => setVehicleToDelete(veh)}
                        className="px-2 py-1 text-rose-600 hover:bg-rose-50 rounded-lg font-medium text-[11px] transition-colors cursor-pointer"
                      >
                        حذف
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="bg-slate-100 px-5 py-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600 shrink-0">
          <div className="flex items-center gap-1.5">
            <Truck className="w-4 h-4 text-slate-500" />
            <span>تعداد کل خودروهای ثبت‌شده:</span>
            <strong className="text-slate-900 font-mono font-bold text-sm">
              {toPersianDigits(vehicles.length)}
            </strong>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold cursor-pointer transition-colors"
          >
            بستن پنجره
          </button>
        </div>
      </div>

      {/* Confirmation Modal for Deleting Single Vehicle */}
      {vehicleToDelete && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="bg-white rounded-2xl p-5 max-w-sm w-full shadow-2xl border border-slate-200 space-y-4 animate-scaleUp">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <h4 className="font-bold text-base text-slate-900">تایید حذف خودرو</h4>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              آیا از حذف خودروی{' '}
              <strong className="text-slate-900">
                «{vehicleToDelete.vehicleType || vehicleToDelete.vehicleInfo}»
                {vehicleToDelete.driverName ? ` (راننده: ${vehicleToDelete.driverName})` : ''}
              </strong>{' '}
              از فهرست ناوگان اطمینان دارید؟
            </p>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setVehicleToDelete(null)}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
              >
                انصراف
              </button>
              <button
                type="button"
                id="confirm-delete-vehicle-btn"
                onClick={handleConfirmDelete}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold cursor-pointer shadow-xs"
              >
                بله، حذف شود
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Clearing All Vehicles */}
      {isDeletingAll && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="bg-white rounded-2xl p-5 max-w-sm w-full shadow-2xl border border-rose-300 space-y-4 animate-scaleUp">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <h4 className="font-bold text-base text-slate-900">پاکسازی کل ناوگان</h4>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              آیا مطمئن هستید که می‌خواهید{' '}
              <strong className="text-rose-700">تمام {toPersianDigits(vehicles.length)} خودروی</strong> ثبت‌شده در ناوگان را حذف نمایید؟
            </p>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsDeletingAll(false)}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
              >
                انصراف
              </button>
              <button
                type="button"
                id="confirm-clear-all-fleet-btn"
                onClick={handleConfirmClearAll}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold cursor-pointer shadow-xs"
              >
                بله، همه حذف شوند
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
