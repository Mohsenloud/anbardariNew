import React, { useState, useEffect } from 'react';
import { 
  X, 
  ArrowUpRight, 
  Plus, 
  Trash2, 
  Car, 
  User, 
  Phone, 
  Calendar, 
  Clock, 
  FileText, 
  Wrench, 
  Layers, 
  Check, 
  AlertCircle,
  Hash,
  Truck,
  BookmarkPlus,
  ChevronDown,
  ChevronUp,
  Search,
  CheckCircle2,
  Sparkles
} from 'lucide-react';
import { Product, DirectTransfer, DirectTransferType, DirectTransferItem, StoreSettings, SavedVehicle } from '../types';
import { getCurrentJalaliDate, getCurrentJalaliTime, toPersianDigits } from '../utils/jalali';
import { StorageService } from '../utils/storage';
import { IranPlatePicker, parseVehicleInfo } from './IranPlatePicker';
import { VehicleFleetModal } from './VehicleFleetModal';

interface DirectTransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  settings: StoreSettings;
  defaultWarehouseName?: string;
  defaultWarehouseId?: string;
  currentUserName?: string;
  onSave: (transferData: Omit<DirectTransfer, 'id' | 'createdAt'>) => void;
}

export const DirectTransferModal: React.FC<DirectTransferModalProps> = ({
  isOpen,
  onClose,
  products,
  settings,
  defaultWarehouseName,
  defaultWarehouseId,
  currentUserName,
  onSave,
}) => {
  if (!isOpen) return null;

  // Header and Type State (شماره‌گذاری ترتیبی و منظم حواله انتقال و خروج بدون رندوم)
  const [transferNumber, setTransferNumber] = useState<string>(() => StorageService.getNextTransferNumber());
  const [title, setTitle] = useState<string>('');
  const [type, setType] = useState<DirectTransferType>('repair');
  const [isReturnable, setIsReturnable] = useState<boolean>(true);
  const [expectedReturnDate, setExpectedReturnDate] = useState<string>('');

  // Dispatch / Vehicle Information
  const [dispatchedAtDate, setDispatchedAtDate] = useState<string>(() => getCurrentJalaliDate());
  const [dispatchedAtTime, setDispatchedAtTime] = useState<string>(() => getCurrentJalaliTime());
  const [dispatchedBy, setDispatchedBy] = useState<string>(() => currentUserName || settings.sellerName || 'انباردار مرکزی');
  const [receiverName, setReceiverName] = useState<string>('');
  const [receiverPhone, setReceiverPhone] = useState<string>('');
  const [dispatchVehicleInfo, setDispatchVehicleInfo] = useState<string>('');
  const [destination, setDestination] = useState<string>('');
  const [dispatchNotes, setDispatchNotes] = useState<string>('');

  // خودروهای ثبت‌شده در حواله‌های خروج و ناوگان جهت انتقال سریع مشخصات
  const [savedVehicles, setSavedVehicles] = useState<Array<SavedVehicle & { sourceLabel?: string }>>(() => StorageService.getExitSlipVehicles());
  const [showSavedFleet, setShowSavedFleet] = useState<boolean>(false);
  const [isFleetModalOpen, setIsFleetModalOpen] = useState<boolean>(false);
  const [fleetSearchQuery, setFleetSearchQuery] = useState<string>('');
  const [vehicleFeedback, setVehicleFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [autoSaveToFleet, setAutoSaveToFleet] = useState<boolean>(true);

  // همگام‌سازی لحظه‌ای با تغییرات ناوگان و حواله‌ها
  useEffect(() => {
    const unsub = StorageService.subscribe(() => {
      setSavedVehicles(StorageService.getExitSlipVehicles());
    });
    return () => unsub();
  }, []);

  // Items State
  const [items, setItems] = useState<DirectTransferItem[]>([]);

  // Item Selector Row state
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [selectedVariantId, setSelectedVariantId] = useState<string>('');
  const [itemQuantity, setItemQuantity] = useState<number>(1);
  const [itemSerialNumber, setItemSerialNumber] = useState<string>('');
  const [itemNotes, setItemNotes] = useState<string>('');

  const [formError, setFormError] = useState<string>('');

  const selectedProduct = products.find((p) => p.id === selectedProductId);

  // Available stock calculation
  const getProductAvailableStock = (prod: Product, variantId?: string): number => {
    if (variantId && prod.hasVariants && prod.variants) {
      const v = prod.variants.find((vr) => vr.id === variantId);
      return v ? v.stock : 0;
    }
    return prod.stock;
  };

  const handleAddItem = () => {
    if (!selectedProduct) {
      setFormError('لطفاً ابتدا کالا یا دستگاه مورد نظر را انتخاب نمایید.');
      return;
    }

    if (itemQuantity <= 0) {
      setFormError('تعداد خروجی باید بزرگ‌تر از صفر باشد.');
      return;
    }

    const maxStock = getProductAvailableStock(selectedProduct, selectedVariantId);
    if (!settings.allowNegativeStock && itemQuantity > maxStock) {
      setFormError(`موجودی فعلی در انبار (${maxStock} ${selectedProduct.unit}) کمتر از تعداد درخواستی است.`);
      return;
    }

    let variantName: string | undefined;
    if (selectedVariantId && selectedProduct.hasVariants && selectedProduct.variants) {
      const v = selectedProduct.variants.find((vr) => vr.id === selectedVariantId);
      variantName = v?.name;
    }

    const newItem: DirectTransferItem = {
      id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      productId: selectedProduct.id,
      productName: selectedProduct.name,
      productCode: selectedProduct.code,
      variantId: selectedVariantId || undefined,
      variantName,
      unit: selectedProduct.unit,
      quantity: Number(itemQuantity),
      returnedQuantity: 0,
      serialNumber: itemSerialNumber.trim() || undefined,
      notes: itemNotes.trim() || undefined,
    };

    setItems([...items, newItem]);
    setSelectedProductId('');
    setSelectedVariantId('');
    setItemQuantity(1);
    setItemSerialNumber('');
    setItemNotes('');
    setFormError('');

    // If title is empty, generate smart default title
    if (!title.trim()) {
      const typeLabel = 
        type === 'repair' ? 'اعزام به تعمیرگاه' :
        type === 'temporary_loan' ? 'خروج امانی' :
        type === 'internal_use' ? 'مصرف کارگاه' : 'خروج از انبار';
      setTitle(`${typeLabel}: ${newItem.productName}`);
    }
  };

  const handleRemoveItem = (id: string) => {
    setItems(items.filter((i) => i.id !== id));
  };

  // انتخاب یک خودرو از سوابق حواله‌های خروج یا ناوگان و پرکردن خودکار مشخصات
  const handleSelectSavedVehicle = (veh: SavedVehicle & { sourceLabel?: string }) => {
    setDispatchVehicleInfo(veh.vehicleInfo);
    if (veh.driverName) {
      setReceiverName(veh.driverName);
    }
    if (veh.driverPhone) {
      setReceiverPhone(veh.driverPhone);
    }
    setShowSavedFleet(false);
    setVehicleFeedback({
      type: 'success',
      message: `مشخصات «${veh.vehicleType}${veh.driverName ? ` (راننده: ${veh.driverName})` : ''}» از حواله خروج انتقال یافت.`,
    });
    setTimeout(() => setVehicleFeedback(null), 4000);
  };

  // ثبت دستی خودروی جاری در فهرست ناوگان
  const handleRegisterVehicle = () => {
    if (!dispatchVehicleInfo.trim() && !receiverName.trim()) {
      setVehicleFeedback({
        type: 'error',
        message: 'لطفاً ابتدا مشخصات یا پلاک ماشین را وارد فرمایید.',
      });
      return;
    }

    const parsed = parseVehicleInfo(dispatchVehicleInfo);
    const vehicleType = parsed?.vehicleType || 'وانت باربری';
    const plateNumber = (!parsed?.isFreeText && parsed?.part1 && parsed?.part2)
      ? `${parsed.part1} ${parsed.letter} ${parsed.part2} ایران ${parsed.iranCode}`
      : '';

    const saved = StorageService.addOrUpdateSavedVehicle({
      vehicleType,
      vehicleInfo: dispatchVehicleInfo.trim() || 'خودرو خارج‌کننده بار',
      driverName: receiverName.trim(),
      driverPhone: receiverPhone.trim(),
      plateNumber,
      colorDesc: parsed?.colorDesc || '',
    });

    setSavedVehicles(StorageService.getExitSlipVehicles());
    setVehicleFeedback({
      type: 'success',
      message: `مشخصات ماشین «${saved.vehicleType}${saved.driverName ? ` - ${saved.driverName}` : ''}» در ناوگان ثبت شد و در دفعات بعد در دسترس است.`,
    });
    setTimeout(() => setVehicleFeedback(null), 4000);
  };

  // حذف ماشین از ناوگان
  const handleDeleteSavedVehicle = (id: string, vehicleInfo?: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (window.confirm('آیا از حذف این خودرو از فهرست ذخیره‌شده‌ها اطمینان دارید؟')) {
      StorageService.deleteSavedVehicle(id, vehicleInfo);
      setSavedVehicles(StorageService.getExitSlipVehicles());
      setVehicleFeedback({
        type: 'success',
        message: 'خودروی مورد نظر با موفقیت از ناوگان حذف شد.',
      });
      setTimeout(() => setVehicleFeedback(null), 3500);
    }
  };

  const filteredSavedVehicles = savedVehicles.filter((v) => {
    if (!fleetSearchQuery.trim()) return true;
    const q = fleetSearchQuery.toLowerCase();
    return (
      (v.vehicleInfo || '').toLowerCase().includes(q) ||
      (v.vehicleType || '').toLowerCase().includes(q) ||
      (v.driverName || '').toLowerCase().includes(q) ||
      (v.driverPhone || '').includes(q) ||
      (v.plateNumber || '').includes(q) ||
      (v.sourceLabel || '').toLowerCase().includes(q)
    );
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (items.length === 0) {
      setFormError('لطفاً حداقل یک دستگاه یا کالا به برگه خروج اضافه نمایید.');
      return;
    }

    if (!receiverName.trim()) {
      setFormError('لطفاً نام شخص تحویل‌گیرنده یا راننده خروج را وارد فرمایید.');
      return;
    }

    // ذخیره خودکار در ناوگان مشترک در صورت فعال بودن تیک
    if (autoSaveToFleet && dispatchVehicleInfo.trim()) {
      StorageService.addOrUpdateSavedVehicle({
        vehicleInfo: dispatchVehicleInfo.trim(),
        driverName: receiverName.trim(),
        driverPhone: receiverPhone.trim(),
      });
    }

    const finalTitle = title.trim() || `خروج بدون فاکتور ${transferNumber} - ${items[0]?.productName}`;
    const dispatchedAt = `${dispatchedAtDate} - ${dispatchedAtTime}`;

    onSave({
      transferNumber: transferNumber.trim(),
      title: finalTitle,
      type,
      status: 'dispatched',
      isReturnable,
      expectedReturnDate: expectedReturnDate.trim() || undefined,
      items,
      warehouseId: defaultWarehouseId,
      warehouseName: defaultWarehouseName || 'انبار مرکزی',
      dispatchedAt,
      dispatchedBy: dispatchedBy.trim() || 'انباردار',
      receiverName: receiverName.trim(),
      receiverPhone: receiverPhone.trim() || undefined,
      dispatchVehicleInfo: dispatchVehicleInfo.trim() || undefined,
      destination: destination.trim() || undefined,
      dispatchNotes: dispatchNotes.trim() || undefined,
      returnRecords: [],
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/70 backdrop-blur-sm overflow-y-auto">
      <div 
        id="direct-transfer-modal"
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200"
      >
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-amber-600 to-amber-700 text-white p-4 sm:p-5 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center border border-white/20">
              <ArrowUpRight className="w-6 h-6 text-amber-100" />
            </div>
            <div>
              <h3 className="text-lg font-bold">ثبت خروج مستقیم از انبار (بدون فاکتور)</h3>
              <p className="text-xs text-amber-100 mt-0.5">
                ویژه اعزام دستگاه به تعمیرگاه، امانی نزد مشتری، مصرف داخلی یا انتقال موقت بدون نیاز به صدور فاکتور مالی
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-white/80 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 text-slate-800">
          {formError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-sm flex items-center gap-2">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          {/* Section 1: Transfer Specifications & Type */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-700">
                <FileText className="w-4 h-4 text-amber-600" />
                <span>مشخصات و علت خروج از انبار</span>
              </div>
              <div className="flex items-center gap-1 text-xs text-slate-500 font-mono">
                <span>شماره برگه:</span>
                <input
                  type="text"
                  value={transferNumber}
                  onChange={(e) => setTransferNumber(e.target.value)}
                  className="bg-white border border-slate-300 rounded px-2 py-0.5 text-xs font-bold text-amber-700 w-24 text-center focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  علت / نوع خروج:
                </label>
                <select
                  value={type}
                  onChange={(e) => {
                    const val = e.target.value as DirectTransferType;
                    setType(val);
                    if (val === 'internal_use') {
                      setIsReturnable(false);
                    } else {
                      setIsReturnable(true);
                    }
                  }}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-amber-500 focus:outline-none"
                >
                  <option value="repair">🔧 اعزام به تعمیرگاه و سرویس فنی</option>
                  <option value="temporary_loan">🤝 خروج امانی / دمو به مشتری یا همکار</option>
                  <option value="internal_use">🏗️ مصرف داخلی در کارگاه یا پروژه</option>
                  <option value="sample">📦 نمونه‌گیری و آزمایشگاهی</option>
                  <option value="other_out">🚚 سایر خروج‌های مستقیم</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  عنوان یا شرح خروج:
                </label>
                <input
                  type="text"
                  placeholder="مثلاً: تعمیر دستگاه سنگ‌فرز یا امانی مهندس کریمی"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  وضعیت بازگشت به انبار:
                </label>
                <div className="flex items-center gap-2 mt-1">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-700 bg-white px-3 py-2 border border-slate-300 rounded-xl flex-1 justify-center">
                    <input
                      type="checkbox"
                      checked={isReturnable}
                      onChange={(e) => setIsReturnable(e.target.checked)}
                      className="w-4 h-4 text-amber-600 rounded focus:ring-amber-500"
                    />
                    <span>دستگاه بازگردانده خواهد شد</span>
                  </label>
                </div>
              </div>
            </div>

            {isReturnable && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    تاریخ احتمالی و موعد بازگشت به انبار:
                  </label>
                  <div className="relative">
                    <Calendar className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
                    <input
                      type="text"
                      placeholder="مثلاً: ۱۴۰۳/۰۶/۲۸"
                      value={expectedReturnDate}
                      onChange={(e) => setExpectedReturnDate(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl pr-9 pl-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    مقصد، کارگاه یا تعمیرگاه تحویل‌گیرنده:
                  </label>
                  <input
                    type="text"
                    placeholder="مثلاً: تعمیرگاه نوین صنعت - شادآباد"
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Section 2: Product & Equipment Selection */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-700">
                <Wrench className="w-4 h-4 text-amber-600" />
                <span>انتخاب دستگاه‌ها یا کالاهای خروجی از انبار</span>
              </div>
              <span className="text-xs text-slate-500">
                (تعداد از موجودی انبار کسر خواهد شد)
              </span>
            </div>

            {/* Row to add item */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end bg-white p-3 rounded-xl border border-slate-200">
              <div className="sm:col-span-4">
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  دستگاه / کالا از انبار:
                </label>
                <select
                  value={selectedProductId}
                  onChange={(e) => {
                    setSelectedProductId(e.target.value);
                    setSelectedVariantId('');
                  }}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs sm:text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none"
                >
                  <option value="">-- انتخاب کالا یا دستگاه --</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} (موجودی: {p.stock} {p.unit})
                    </option>
                  ))}
                </select>
              </div>

              {selectedProduct?.hasVariants && (
                <div className="sm:col-span-3">
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    تنوع / مدل:
                  </label>
                  <select
                    value={selectedVariantId}
                    onChange={(e) => setSelectedVariantId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-2 py-2 text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  >
                    <option value="">-- کلی / بدون تنوع --</option>
                    {selectedProduct.variants?.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name} (موجودی: {v.stock})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className={selectedProduct?.hasVariants ? "sm:col-span-2" : "sm:col-span-2"}>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  تعداد ({selectedProduct?.unit || 'عدد'}):
                </label>
                <input
                  type="number"
                  min="1"
                  value={itemQuantity}
                  onChange={(e) => setItemQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm text-center font-bold focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              <div className={selectedProduct?.hasVariants ? "sm:col-span-3" : "sm:col-span-3"}>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  شماره سریال / پلاک دستگاه:
                </label>
                <input
                  type="text"
                  placeholder="مثلاً: SN-4921 یا مدل X2"
                  value={itemSerialNumber}
                  onChange={(e) => setItemSerialNumber(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-2 py-2 text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none font-mono"
                />
              </div>

              <div className="sm:col-span-3">
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  شرح نقص یا یادداشت قلم:
                </label>
                <input
                  type="text"
                  placeholder="مثلاً: جهت تعویض بلبرینگ"
                  value={itemNotes}
                  onChange={(e) => setItemNotes(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-2 py-2 text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              <div className="sm:col-span-12 flex justify-end pt-1">
                <button
                  type="button"
                  onClick={handleAddItem}
                  className="flex items-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-colors shadow-sm"
                >
                  <Plus className="w-4 h-4" />
                  <span>افزودن این قلم به برگه خروج</span>
                </button>
              </div>
            </div>

            {/* List of Added Items */}
            {items.length > 0 ? (
              <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-100 text-slate-600 border-b border-slate-200">
                    <tr>
                      <th className="p-2.5">ردیف</th>
                      <th className="p-2.5">نام دستگاه / کالا</th>
                      <th className="p-2.5">تنوع / مدل</th>
                      <th className="p-2.5 text-center">تعداد خروج</th>
                      <th className="p-2.5">شماره سریال / کد پلاک</th>
                      <th className="p-2.5">توضیحات نقص</th>
                      <th className="p-2.5 text-center">حذف</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {items.map((item, idx) => (
                      <tr key={item.id} className="hover:bg-amber-50/40 transition-colors">
                        <td className="p-2.5 font-bold text-slate-500">{idx + 1}</td>
                        <td className="p-2.5 font-bold text-slate-800">
                          {item.productName}
                          <span className="text-[10px] text-slate-400 block font-mono">کد: {item.productCode}</span>
                        </td>
                        <td className="p-2.5 text-slate-600">{item.variantName || '-'}</td>
                        <td className="p-2.5 text-center font-bold text-amber-700">
                          {item.quantity} {item.unit}
                        </td>
                        <td className="p-2.5 font-mono text-slate-700">{item.serialNumber || '-'}</td>
                        <td className="p-2.5 text-slate-500">{item.notes || '-'}</td>
                        <td className="p-2.5 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(item.id)}
                            className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-4 bg-white border border-dashed border-slate-300 rounded-xl text-center text-xs text-slate-400">
                هنوز هیچ کالا یا دستگاهی به این برگه خروج اضافه نشده است.
              </div>
            )}
          </div>

          {/* Section 3: Driver, Receiver & Vehicle Details (مشخصات تعمیر گیرنده و خارج‌کننده بار) */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2 flex-wrap gap-2">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-700">
                <Car className="w-4 h-4 text-amber-600" />
                <span>مشخصات تحویل‌گیرنده / راننده و خودروی خارج‌کننده</span>
              </div>

              {/* دکمه‌های ناوبری سریع ناوگان و انتقال از حواله‌های خروج */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  id="direct-transfer-register-veh-btn"
                  onClick={handleRegisterVehicle}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white shadow-2xs transition-all cursor-pointer"
                  title="ذخیره مشخصات این خودرو در ناوگان برای استفاده در حواله‌های خروج و امانی"
                >
                  <BookmarkPlus className="w-3.5 h-3.5" />
                  <span>ثبت در ناوگان</span>
                </button>

                <button
                  type="button"
                  id="direct-transfer-manage-fleet-btn"
                  onClick={() => setIsFleetModalOpen(true)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-white hover:bg-rose-50 text-slate-700 hover:text-rose-700 border border-slate-300 hover:border-rose-300 shadow-2xs transition-all cursor-pointer"
                  title="مدیریت جامع، مشاهده و حذف خودروهای ثبت‌شده در ناوگان"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                  <span>مدیریت و حذف خودروها</span>
                </button>

                <button
                  type="button"
                  id="direct-transfer-fleet-toggle-btn"
                  onClick={() => setShowSavedFleet(!showSavedFleet)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer border ${
                    showSavedFleet
                      ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                      : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300'
                  }`}
                  title="مشاهده و انتخاب از خودروهای ثبت‌شده در حواله‌های خروج"
                >
                  <Truck className="w-3.5 h-3.5 text-amber-600 group-hover:text-white" />
                  <span>خودروها ({toPersianDigits(savedVehicles.length)})</span>
                  {showSavedFleet ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>
              </div>
            </div>

            {/* پیام بازخورد عملیات ثبت یا انتقال ماشین */}
            {vehicleFeedback && (
              <div
                className={`p-2.5 rounded-xl text-xs flex items-center justify-between animate-fadeIn ${
                  vehicleFeedback.type === 'success'
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-rose-50 text-rose-800 border border-rose-200'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  {vehicleFeedback.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  )}
                  <span className="font-medium">{vehicleFeedback.message}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setVehicleFeedback(null)}
                  className="text-slate-400 hover:text-slate-700 p-0.5 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* انتخاب سریع از خودروهای ثبت‌شده در حواله‌های خروج (چیپ‌های یک کلیکی فشرده) */}
            {!showSavedFleet && savedVehicles.length > 0 && (
              <div className="bg-amber-50/60 p-2.5 rounded-xl border border-amber-200/70 space-y-1.5">
                <div className="flex items-center justify-between text-[11px] text-amber-900 font-bold">
                  <div className="flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                    <span>انتقال سریع مشخصات خودرو از حواله‌های خروج:</span>
                  </div>
                  <span className="text-[10px] text-slate-500 font-normal">با یک کلیک راننده، شماره و پلاک پر می‌شود</span>
                </div>
                <div className="flex flex-wrap gap-1.5 items-center">
                  {savedVehicles.slice(0, 5).map((veh) => (
                    <button
                      key={veh.id}
                      type="button"
                      onClick={() => handleSelectSavedVehicle(veh)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white hover:bg-amber-100/70 text-slate-800 hover:text-amber-900 border border-amber-200 hover:border-amber-400 rounded-lg text-xs font-medium transition-all shadow-2xs cursor-pointer group"
                    >
                      <Truck className="w-3 h-3 text-amber-600 group-hover:scale-110 transition-transform" />
                      <span className="font-bold">{veh.vehicleType}</span>
                      {veh.plateNumber && (
                        <span className="font-mono text-[10px] text-slate-600 bg-slate-100 px-1 py-0.2 rounded border border-slate-200">
                          {toPersianDigits(veh.plateNumber.split(' ').slice(0, 3).join(' '))}
                        </span>
                      )}
                      {veh.driverName && (
                        <span className="text-[11px] text-slate-500">({veh.driverName})</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* پنل بازشونده مدیریت و جستجوی ناوگان خودروهای حواله خروج */}
            {showSavedFleet && (
              <div className="bg-white rounded-xl border border-amber-300 p-3 shadow-sm space-y-2.5 animate-fadeIn">
                <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2">
                  <div className="flex items-center gap-1.5">
                    <Truck className="w-4 h-4 text-amber-600" />
                    <span className="text-xs font-bold text-slate-800">
                      خودروها و رانندگان ثبت‌شده در حواله‌های خروج انبار:
                    </span>
                  </div>
                  <div className="relative w-48 sm:w-60">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-2" />
                    <input
                      type="text"
                      placeholder="جستجوی پلاک، مدل یا راننده..."
                      value={fleetSearchQuery}
                      onChange={(e) => setFleetSearchQuery(e.target.value)}
                      className="w-full pr-8 pl-2.5 py-1 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-amber-500"
                    />
                  </div>
                </div>

                {filteredSavedVehicles.length === 0 ? (
                  <div className="text-center py-4 text-xs text-slate-400">
                    {fleetSearchQuery ? 'هیچ خودرویی با این مشخصات یافت نشد.' : 'هنوز هیچ خودرویی در حواله‌های خروج ثبت نشده است.'}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-0.5">
                    {filteredSavedVehicles.map((veh) => (
                      <div
                        key={veh.id}
                        onClick={() => handleSelectSavedVehicle(veh)}
                        className="p-2 rounded-xl border border-slate-200 hover:border-amber-400 hover:bg-amber-50/50 transition-all cursor-pointer flex items-center justify-between gap-2 text-xs group"
                      >
                        <div className="truncate flex-1">
                          <div className="flex items-center gap-1.5 truncate">
                            <span className="font-bold text-slate-800 group-hover:text-amber-900 truncate">
                              {veh.vehicleType}
                            </span>
                            {veh.sourceLabel && (
                              <span className="text-[9.5px] bg-slate-100 text-slate-500 px-1 py-0.2 rounded border border-slate-200">
                                {veh.sourceLabel}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-500">
                            {veh.driverName && (
                              <span className="font-medium text-slate-700">راننده: {veh.driverName}</span>
                            )}
                            {veh.driverPhone && (
                              <span className="font-mono">({toPersianDigits(veh.driverPhone)})</span>
                            )}
                          </div>
                          {veh.plateNumber && (
                            <div className="font-mono text-[10px] text-amber-800 mt-0.5 font-bold truncate">
                              {toPersianDigits(veh.plateNumber)}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <span className="text-[10px] font-bold text-amber-700 bg-amber-100 group-hover:bg-amber-600 group-hover:text-white px-2 py-1 rounded-md transition-colors">
                            انتخاب
                          </span>
                          <button
                            type="button"
                            onClick={(e) => handleDeleteSavedVehicle(veh.id, veh.vehicleInfo, e)}
                            className="text-slate-400 hover:text-rose-600 hover:bg-rose-50 p-1.5 rounded-lg transition-colors cursor-pointer"
                            title="حذف این ماشین از ناوگان"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  نام تحویل‌گیرنده / خارج‌کننده: <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
                  <input
                    type="text"
                    required
                    placeholder="نام تعمیرکار، سرویس‌کار یا راننده خارج‌کننده"
                    value={receiverName}
                    onChange={(e) => setReceiverName(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl pr-9 pl-3 py-2 text-sm font-medium focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  شماره تماس تحویل‌گیرنده / راننده:
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
                  <input
                    type="tel"
                    dir="ltr"
                    placeholder="0912..."
                    value={receiverPhone}
                    onChange={(e) => setReceiverPhone(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl pr-9 pl-3 py-2 text-sm font-mono text-right focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  انباردار صادرکننده حواله:
                </label>
                <input
                  type="text"
                  value={dispatchedBy}
                  onChange={(e) => setDispatchedBy(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Vehicle & Plate Selection */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                مشخصات ماشین و پلاک کسی که خارج کرده:
              </label>
              <IranPlatePicker
                value={dispatchVehicleInfo}
                onChange={setDispatchVehicleInfo}
                placeholder="نوع خودرو (مثلاً وانت نیسان، پراید بار) و پلاک"
              />
            </div>

            {/* چک‌باکس ذخیره خودکار در ناوگان مشترک */}
            <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-slate-600 hover:text-slate-800">
              <input
                type="checkbox"
                checked={autoSaveToFleet}
                onChange={(e) => setAutoSaveToFleet(e.target.checked)}
                className="w-4 h-4 text-amber-600 rounded border-slate-300 focus:ring-amber-500"
              />
              <span>ذخیره خودکار این خودرو در فهرست ناوگان انبار (قابل استفاده مجدد در حواله‌های خروج و امانی)</span>
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    تاریخ خروج:
                  </label>
                  <div className="relative">
                    <Calendar className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
                    <input
                      type="text"
                      value={dispatchedAtDate}
                      onChange={(e) => setDispatchedAtDate(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl pr-9 pl-3 py-2 text-xs font-mono focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    />
                  </div>
                </div>
                <div className="w-28">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    ساعت:
                  </label>
                  <div className="relative">
                    <Clock className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
                    <input
                      type="text"
                      value={dispatchedAtTime}
                      onChange={(e) => setDispatchedAtTime(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl pr-8 pl-2 py-2 text-xs font-mono text-center focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  یادداشت و دستور خروج / شروط نگهبانی:
                </label>
                <input
                  type="text"
                  placeholder="مثلاً: مجوز خروج اموال توسط مدیریت تایید شد."
                  value={dispatchNotes}
                  onChange={(e) => setDispatchNotes(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="border-t border-slate-200 pt-4 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-xs text-slate-500 flex items-center gap-1.5">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>با تایید، موجودی انبار فوراً کسر شده و گردش کاردکس بدون نیاز به فاکتور ثبت می‌شود.</span>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-600 hover:bg-slate-100 font-medium text-xs transition-colors flex-1 sm:flex-none"
              >
                انصراف
              </button>
              <button
                type="submit"
                className="px-6 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-1.5 flex-1 sm:flex-none"
              >
                <ArrowUpRight className="w-4 h-4" />
                <span>ثبت و صدور خروج از انبار</span>
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* مودال جامع مدیریت و حذف خودروهای ثبت‌شده در ناوگان */}
      <VehicleFleetModal
        isOpen={isFleetModalOpen}
        onClose={() => setIsFleetModalOpen(false)}
        onSelectVehicle={(veh) => {
          handleSelectSavedVehicle(veh);
        }}
      />
    </div>
  );
};
