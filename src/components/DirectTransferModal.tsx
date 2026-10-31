import React, { useState, useEffect, useMemo } from 'react';
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
  Check,
  AlertCircle,
  Truck,
  BookmarkPlus,
  ChevronDown,
  ChevronUp,
  Search,
  CheckCircle2,
  Package,
  Boxes,
  Users,
  Edit3,
  Coins
} from 'lucide-react';
import {
  Product,
  DirectTransfer,
  DirectTransferType,
  DirectTransferItem,
  StoreSettings,
  SavedVehicle,
  Customer
} from '../types';
import {
  getCurrentJalaliDate,
  getCurrentJalaliTime,
  stepJalaliDate,
  toPersianDigits
} from '../utils/jalali';
import { StorageService } from '../utils/storage';
import { IranPlatePicker, parseVehicleInfo } from './IranPlatePicker';
import { VehicleFleetModal } from './VehicleFleetModal';
import { NumericInput } from './NumericInput';
import { JalaliDatePicker } from './JalaliDatePicker';

interface DirectTransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  settings: StoreSettings;
  defaultWarehouseName?: string;
  defaultWarehouseId?: string;
  currentUserName?: string;
  editingTransfer?: DirectTransfer | null;
  onSave: (transferData: Omit<DirectTransfer, 'id' | 'createdAt'>) => void;
  onUpdate?: (transferId: string, updates: Partial<DirectTransfer>) => void;
}

const COMMON_UNITS = ['دستگاه', 'عدد', 'ست', 'بسته', 'شاخه', 'متر', 'کیلوگرم', 'جفت', 'حلقه'];

export const DirectTransferModal: React.FC<DirectTransferModalProps> = ({
  isOpen,
  onClose,
  products,
  settings,
  defaultWarehouseName,
  defaultWarehouseId,
  currentUserName,
  editingTransfer,
  onSave,
  onUpdate,
}) => {
  const isEditMode = Boolean(editingTransfer);

  // Header and Type State
  const [transferNumber, setTransferNumber] = useState<string>(() =>
    editingTransfer?.transferNumber || StorageService.getNextTransferNumber()
  );
  const [title, setTitle] = useState<string>(editingTransfer?.title || '');
  const [type, setType] = useState<DirectTransferType>(editingTransfer?.type || 'repair');
  const [isReturnable, setIsReturnable] = useState<boolean>(
    editingTransfer ? editingTransfer.isReturnable : true
  );
  const [expectedReturnDate, setExpectedReturnDate] = useState<string>(
    editingTransfer?.expectedReturnDate || ''
  );
  const [estimatedCost, setEstimatedCost] = useState<number>(
    editingTransfer?.estimatedCost || 0
  );

  // Dispatch / Vehicle Information
  const [dispatchedAtDate, setDispatchedAtDate] = useState<string>(() => {
    if (editingTransfer?.dispatchedAt) {
      return editingTransfer.dispatchedAt.split(' - ')[0] || getCurrentJalaliDate();
    }
    return getCurrentJalaliDate();
  });
  const [dispatchedAtTime, setDispatchedAtTime] = useState<string>(() => {
    if (editingTransfer?.dispatchedAt && editingTransfer.dispatchedAt.includes(' - ')) {
      return editingTransfer.dispatchedAt.split(' - ')[1] || getCurrentJalaliTime();
    }
    return getCurrentJalaliTime();
  });
  const [dispatchedBy, setDispatchedBy] = useState<string>(
    editingTransfer?.dispatchedBy || currentUserName || settings.sellerName || 'انباردار مرکزی'
  );
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(
    editingTransfer?.customerId || ''
  );
  const [receiverName, setReceiverName] = useState<string>(editingTransfer?.receiverName || '');
  const [receiverPhone, setReceiverPhone] = useState<string>(editingTransfer?.receiverPhone || '');
  const [dispatchVehicleInfo, setDispatchVehicleInfo] = useState<string>(
    editingTransfer?.dispatchVehicleInfo || ''
  );
  const [destination, setDestination] = useState<string>(editingTransfer?.destination || '');
  const [dispatchNotes, setDispatchNotes] = useState<string>(editingTransfer?.dispatchNotes || '');

  // Customers for quick receiver selection
  const [customers] = useState<Customer[]>(() => StorageService.getCustomers());
  const [showCustomerDropdown, setShowCustomerDropdown] = useState<boolean>(false);
  const [customerSearch, setCustomerSearch] = useState<string>('');

  // Saved Fleet Vehicles
  const [savedVehicles, setSavedVehicles] = useState<Array<SavedVehicle & { sourceLabel?: string }>>(() =>
    StorageService.getExitSlipVehicles()
  );
  const [showSavedFleet, setShowSavedFleet] = useState<boolean>(false);
  const [isFleetModalOpen, setIsFleetModalOpen] = useState<boolean>(false);
  const [fleetSearchQuery, setFleetSearchQuery] = useState<string>('');
  const [vehicleFeedback, setVehicleFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [autoSaveToFleet, setAutoSaveToFleet] = useState<boolean>(true);

  useEffect(() => {
    const unsub = StorageService.subscribe(() => {
      setSavedVehicles(StorageService.getExitSlipVehicles());
    });
    return () => unsub();
  }, []);

  // Items State
  const [items, setItems] = useState<DirectTransferItem[]>(editingTransfer?.items || []);

  // Item Selector Mode: 'inventory' (از کالاهای انبار) | 'custom' (دستگاه / تجهیز کارگاهی خارج از لیست فروش)
  const [itemSourceMode, setItemSourceMode] = useState<'inventory' | 'custom'>('inventory');
  const [productSearchQuery, setProductSearchQuery] = useState<string>('');
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [selectedVariantId, setSelectedVariantId] = useState<string>('');

  // Custom Asset fields
  const [customAssetName, setCustomAssetName] = useState<string>('');
  const [customAssetCode, setCustomAssetCode] = useState<string>('');
  const [customAssetUnit, setCustomAssetUnit] = useState<string>('دستگاه');

  const [itemQuantity, setItemQuantity] = useState<number>(1);
  const [itemSerialNumber, setItemSerialNumber] = useState<string>('');
  const [itemNotes, setItemNotes] = useState<string>('');

  const [formError, setFormError] = useState<string>('');

  const selectedProduct = useMemo(
    () => products.find((p) => p.id === selectedProductId),
    [products, selectedProductId]
  );

  const filteredProducts = useMemo(() => {
    if (!productSearchQuery.trim()) return products;
    const q = productSearchQuery.toLowerCase().trim();
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.code && p.code.toLowerCase().includes(q)) ||
        (p.barcode && p.barcode.toLowerCase().includes(q)) ||
        (p.category && p.category.toLowerCase().includes(q))
    );
  }, [products, productSearchQuery]);

  const filteredCustomers = useMemo(() => {
    if (!customerSearch.trim()) return customers.slice(0, 12);
    const q = customerSearch.toLowerCase().trim();
    return customers
      .filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          (c.phone && c.phone.includes(q)) ||
          (c.address && c.address.toLowerCase().includes(q))
      )
      .slice(0, 12);
  }, [customers, customerSearch]);

  const getProductAvailableStock = (prod: Product, variantId?: string): number => {
    if (variantId && prod.hasVariants && prod.variants) {
      const v = prod.variants.find((vr) => vr.id === variantId);
      return v ? v.stock : 0;
    }
    return prod.stock;
  };

  const handleAddItem = () => {
    setFormError('');

    if (itemQuantity <= 0) {
      setFormError('تعداد خروجی باید بزرگ‌تر از صفر باشد.');
      return;
    }

    let newItem: DirectTransferItem;

    if (itemSourceMode === 'custom') {
      if (!customAssetName.trim()) {
        setFormError('لطفاً نام دستگاه یا تجهیز کارگاهی را وارد نمایید.');
        return;
      }
      newItem = {
        id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        productId: `custom-${Date.now()}`,
        productName: customAssetName.trim(),
        productCode: customAssetCode.trim() || 'ASSET',
        unit: customAssetUnit.trim() || 'دستگاه',
        quantity: Number(itemQuantity),
        returnedQuantity: 0,
        serialNumber: itemSerialNumber.trim() || undefined,
        notes: itemNotes.trim() || undefined,
        isCustomAsset: true,
      };
    } else {
      if (!selectedProduct) {
        setFormError('لطفاً ابتدا کالا یا دستگاه مورد نظر را از لیست انبار انتخاب نمایید.');
        return;
      }

      // Calculate how much of this product/variant is already in the current items list
      const alreadyAddedQty = items
        .filter(
          (it) =>
            !it.isCustomAsset &&
            it.productId === selectedProduct.id &&
            (it.variantId || '') === (selectedVariantId || '')
        )
        .reduce((s, it) => s + it.quantity, 0);

      const maxStock = getProductAvailableStock(selectedProduct, selectedVariantId);
      if (!settings.allowNegativeStock && itemQuantity + alreadyAddedQty > maxStock) {
        setFormError(
          `موجودی قابل خروج در انبار (${toPersianDigits(maxStock)} ${selectedProduct.unit}) کمتر از مجموع تعداد انتخابی است.`
        );
        return;
      }

      let variantName: string | undefined;
      if (selectedVariantId && selectedProduct.hasVariants && selectedProduct.variants) {
        const v = selectedProduct.variants.find((vr) => vr.id === selectedVariantId);
        variantName = v?.name;
      }

      newItem = {
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
        isCustomAsset: false,
      };
    }

    setItems([...items, newItem]);
    setSelectedProductId('');
    setSelectedVariantId('');
    setCustomAssetName('');
    setCustomAssetCode('');
    setItemQuantity(1);
    setItemSerialNumber('');
    setItemNotes('');

    if (!title.trim()) {
      const typeLabel =
        type === 'repair'
          ? 'اعزام به تعمیرگاه'
          : type === 'temporary_loan'
          ? 'خروج امانی'
          : type === 'internal_use'
          ? 'مصرف کارگاه'
          : type === 'sample'
          ? 'نمونه کالا'
          : 'خروج از انبار';
      setTitle(`${typeLabel}: ${newItem.productName}`);
    }
  };

  const handleRemoveItem = (id: string) => {
    setItems(items.filter((i) => i.id !== id));
  };

  const handleUpdateItemField = (id: string, field: 'serialNumber' | 'notes', value: string) => {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, [field]: value || undefined } : it))
    );
  };

  const handleSelectCustomer = (cust: Customer) => {
    setSelectedCustomerId(cust.id);
    setReceiverName(cust.name);
    if (cust.phone) setReceiverPhone(cust.phone);
    if (cust.address && !destination.trim()) setDestination(cust.address);
    setShowCustomerDropdown(false);
  };

  const handleSelectSavedVehicle = (veh: SavedVehicle & { sourceLabel?: string }) => {
    setDispatchVehicleInfo(veh.vehicleInfo);
    if (veh.driverName && !receiverName.trim()) {
      setReceiverName(veh.driverName);
    }
    if (veh.driverPhone && !receiverPhone.trim()) {
      setReceiverPhone(veh.driverPhone);
    }
    setShowSavedFleet(false);
    setVehicleFeedback({
      type: 'success',
      message: `مشخصات خودرو «${veh.vehicleType}${veh.driverName ? ` (راننده: ${veh.driverName})` : ''}» جایگذاری شد.`,
    });
    setTimeout(() => setVehicleFeedback(null), 3500);
  };

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
    const plateNumber =
      !parsed?.isFreeText && parsed?.part1 && parsed?.part2
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
      message: `مشخصات ماشین «${saved.vehicleType}${saved.driverName ? ` - ${saved.driverName}` : ''}» در ناوگان ذخیره شد.`,
    });
    setTimeout(() => setVehicleFeedback(null), 3500);
  };

  const handleDeleteSavedVehicle = (id: string, vehicleInfo?: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (window.confirm('آیا از حذف این خودرو از فهرست ذخیره‌شده‌ها اطمینان دارید؟')) {
      StorageService.deleteSavedVehicle(id, vehicleInfo);
      setSavedVehicles(StorageService.getExitSlipVehicles());
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
      (v.plateNumber || '').includes(q)
    );
  });

  const handleQuickDueDate = (daysToAdd: number) => {
    const baseDate = dispatchedAtDate || getCurrentJalaliDate();
    setExpectedReturnDate(stepJalaliDate(baseDate, daysToAdd));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (items.length === 0) {
      setFormError('لطفاً حداقل یک دستگاه یا کالا به برگه اضافه نمایید.');
      return;
    }

    if (!receiverName.trim()) {
      setFormError('لطفاً نام تحویل‌گیرنده، تعمیرگاه یا راننده خروج را وارد فرمایید.');
      return;
    }

    if (autoSaveToFleet && dispatchVehicleInfo.trim()) {
      StorageService.addOrUpdateSavedVehicle({
        vehicleInfo: dispatchVehicleInfo.trim(),
        driverName: receiverName.trim(),
        driverPhone: receiverPhone.trim(),
      });
    }

    const finalTitle =
      title.trim() || `خروج بدون فاکتور ${transferNumber} - ${items[0]?.productName}`;
    const dispatchedAt = `${dispatchedAtDate} - ${dispatchedAtTime}`;

    if (isEditMode && editingTransfer && onUpdate) {
      onUpdate(editingTransfer.id, {
        transferNumber: transferNumber.trim(),
        title: finalTitle,
        type,
        isReturnable,
        expectedReturnDate: isReturnable ? expectedReturnDate.trim() || undefined : undefined,
        items,
        dispatchedAt,
        dispatchedBy: dispatchedBy.trim() || 'انباردار',
        customerId: selectedCustomerId || undefined,
        receiverName: receiverName.trim(),
        receiverPhone: receiverPhone.trim() || undefined,
        dispatchVehicleInfo: dispatchVehicleInfo.trim() || undefined,
        destination: destination.trim() || undefined,
        dispatchNotes: dispatchNotes.trim() || undefined,
        estimatedCost: estimatedCost > 0 ? estimatedCost : undefined,
      });
      onClose();
      return;
    }

    onSave({
      transferNumber: transferNumber.trim(),
      title: finalTitle,
      type,
      status: isReturnable ? 'dispatched' : 'completed_no_return',
      isReturnable,
      expectedReturnDate: isReturnable ? expectedReturnDate.trim() || undefined : undefined,
      items,
      warehouseId: defaultWarehouseId,
      warehouseName: defaultWarehouseName || 'انبار مرکزی',
      dispatchedAt,
      dispatchedBy: dispatchedBy.trim() || 'انباردار',
      customerId: selectedCustomerId || undefined,
      receiverName: receiverName.trim(),
      receiverPhone: receiverPhone.trim() || undefined,
      dispatchVehicleInfo: dispatchVehicleInfo.trim() || undefined,
      destination: destination.trim() || undefined,
      dispatchNotes: dispatchNotes.trim() || undefined,
      estimatedCost: estimatedCost > 0 ? estimatedCost : undefined,
      returnRecords: [],
    });

    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/70 backdrop-blur-xs overflow-y-auto">
      <div
        id="direct-transfer-modal"
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[94vh] flex flex-col overflow-hidden my-auto"
      >
        {/* Modal Header */}
        <div className="bg-slate-900 text-white px-4 sm:px-6 py-4 flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30 shrink-0">
              {isEditMode ? <Edit3 className="w-5 h-5" /> : <ArrowUpRight className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-black">
                {isEditMode
                  ? `ویرایش برگه امانی و تعمیرات (${toPersianDigits(transferNumber)})`
                  : 'ثبت خروج مستقیم کالا و تجهیزات (امانی / تعمیرات)'}
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                ثبت اعزام دستگاه به تعمیرگاه، کالای امانی نزد مشتری یا مصرف داخلی کارگاه به همراه کنترل بازگشت
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 text-slate-800">
          {formError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-bold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          {/* Section 1: Type Selector & Basic Info */}
          <div className="bg-slate-50/80 p-4 rounded-2xl border border-slate-200/90 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200/80 pb-2.5 flex-wrap gap-2">
              <div className="flex items-center gap-2 text-xs sm:text-sm font-black text-slate-800">
                <FileText className="w-4 h-4 text-amber-600" />
                <span>۱. نوع برگه و مشخصات پایه</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-slate-600 font-mono">
                <span>شماره حواله:</span>
                <input
                  type="text"
                  value={transferNumber}
                  onChange={(e) => setTransferNumber(e.target.value)}
                  className="bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-900 w-28 text-center focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500"
                />
              </div>
            </div>

            {/* Visual Type Selector */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                {
                  id: 'repair' as DirectTransferType,
                  label: 'تعمیرات و سرویس',
                  sub: 'ارسال به تعمیرگاه',
                  returnable: true,
                },
                {
                  id: 'temporary_loan' as DirectTransferType,
                  label: 'امانی و تست',
                  sub: 'نزد مشتری یا همکار',
                  returnable: true,
                },
                {
                  id: 'internal_use' as DirectTransferType,
                  label: 'مصرف داخلی کارگاه',
                  sub: 'بدون نیاز به بازگشت',
                  returnable: false,
                },
                {
                  id: 'sample' as DirectTransferType,
                  label: 'نمونه و دمو',
                  sub: 'آزمایشگاهی / نمایشی',
                  returnable: true,
                },
              ].map((opt) => {
                const active = type === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      setType(opt.id);
                      setIsReturnable(opt.returnable);
                    }}
                    className={`p-2.5 rounded-xl border text-right transition-all cursor-pointer ${
                      active
                        ? 'bg-amber-50/90 border-amber-500 ring-2 ring-amber-500/20 text-slate-900'
                        : 'bg-white border-slate-200 hover:border-slate-300 text-slate-600'
                    }`}
                  >
                    <div className="text-xs font-black flex items-center justify-between">
                      <span>{opt.label}</span>
                      {active && <Check className="w-3.5 h-3.5 text-amber-600 shrink-0" />}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">{opt.sub}</div>
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
              <div className="sm:col-span-6">
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  عنوان یا موضوع برگه:
                </label>
                <input
                  type="text"
                  placeholder="مثلاً: ارسال پمپ باد به تعمیرگاه یا تحویل امانی به مهندس رضایی"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs sm:text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div className="sm:col-span-3">
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  برآورد هزینه / ودیعه ({settings.currency}):
                </label>
                <div className="relative">
                  <NumericInput
                    min={0}
                    value={estimatedCost}
                    onChange={(val) => setEstimatedCost(val)}
                    placeholder="۰ (اختیاری)"
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs sm:text-sm font-mono focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="sm:col-span-3">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700 bg-white px-3 py-2.5 border border-slate-300 rounded-xl justify-center hover:bg-slate-50 transition-colors">
                  <input
                    type="checkbox"
                    checked={isReturnable}
                    onChange={(e) => setIsReturnable(e.target.checked)}
                    className="w-4 h-4 text-amber-600 rounded focus:ring-amber-500"
                  />
                  <span>قابل بازگشت به انبار</span>
                </label>
              </div>
            </div>

            {isReturnable && (
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 pt-1 items-end">
                <div className="sm:col-span-6 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-700">
                      موعد بازگشت به انبار:
                    </label>
                    <div className="flex items-center gap-1">
                      {[
                        { label: 'فردا', days: 1 },
                        { label: '۳ روز', days: 3 },
                        { label: '۱ هفته', days: 7 },
                        { label: '۲ هفته', days: 14 },
                      ].map((preset) => (
                        <button
                          key={preset.days}
                          type="button"
                          onClick={() => handleQuickDueDate(preset.days)}
                          className="px-2 py-0.5 bg-white hover:bg-amber-50 text-slate-600 hover:text-amber-800 border border-slate-200 hover:border-amber-300 rounded-md text-[10px] font-bold transition-colors cursor-pointer"
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <JalaliDatePicker
                    value={expectedReturnDate}
                    onChange={setExpectedReturnDate}
                    placeholder="انتخاب تاریخ بازگشت"
                  />
                </div>

                <div className="sm:col-span-6">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    مقصد، نشانی تعمیرگاه یا محل استقرار کالا:
                  </label>
                  <input
                    type="text"
                    placeholder="مثلاً: تعمیرگاه مرکزی شادآباد یا پروژه ساختمانی نیاوران"
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs sm:text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Section 2: Items & Equipment Selection */}
          <div className="bg-slate-50/80 p-4 rounded-2xl border border-slate-200/90 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-200/80 pb-2.5 gap-2">
              <div className="flex items-center gap-2 text-xs sm:text-sm font-black text-slate-800">
                <Wrench className="w-4 h-4 text-amber-600" />
                <span>۲. اقلام، کالاها یا دستگاه‌های خروجی</span>
              </div>

              {!isEditMode && (
                <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-xl text-xs">
                  <button
                    type="button"
                    onClick={() => setItemSourceMode('inventory')}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                      itemSourceMode === 'inventory'
                        ? 'bg-white text-slate-900 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Boxes className="w-3.5 h-3.5 text-amber-600" />
                    <span>انتخاب از کالاهای انبار</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setItemSourceMode('custom')}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                      itemSourceMode === 'custom'
                        ? 'bg-white text-slate-900 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Wrench className="w-3.5 h-3.5 text-indigo-600" />
                    <span>ثبت دستی دستگاه / اموال کارگاهی</span>
                  </button>
                </div>
              )}
            </div>

            {/* Item Entry Box (Only shown when creating a new transfer) */}
            {!isEditMode && (
              <div className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-3">
                {itemSourceMode === 'inventory' ? (
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
                    <div className="sm:col-span-4">
                      <label className="block text-xs font-bold text-slate-600 mb-1">
                        جستجوی سریع نام یا کد کالا:
                      </label>
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-2.5" />
                        <input
                          type="text"
                          placeholder="جستجو در کالاهای انبار..."
                          value={productSearchQuery}
                          onChange={(e) => setProductSearchQuery(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-300 rounded-xl pr-8 pl-2.5 py-2 text-xs focus:bg-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className={selectedProduct?.hasVariants ? 'sm:col-span-5' : 'sm:col-span-8'}>
                      <label className="block text-xs font-bold text-slate-600 mb-1">
                        انتخاب کالا از انبار ({toPersianDigits(filteredProducts.length)} مورد):
                      </label>
                      <select
                        value={selectedProductId}
                        onChange={(e) => {
                          setSelectedProductId(e.target.value);
                          setSelectedVariantId('');
                        }}
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 focus:outline-none"
                      >
                        <option value="">-- انتخاب کالا از موجودی انبار --</option>
                        {filteredProducts.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} — موجودی: {toPersianDigits(p.stock)} {p.unit} (کد: {p.code})
                          </option>
                        ))}
                      </select>
                    </div>

                    {selectedProduct?.hasVariants && (
                      <div className="sm:col-span-3">
                        <label className="block text-xs font-bold text-slate-600 mb-1">
                          تنوع / رنگ / مدل:
                        </label>
                        <select
                          value={selectedVariantId}
                          onChange={(e) => setSelectedVariantId(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-300 rounded-xl px-2.5 py-2 text-xs font-bold focus:bg-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 focus:outline-none"
                        >
                          <option value="">-- بدون تنوع --</option>
                          {selectedProduct.variants?.map((v) => (
                            <option key={v.id} value={v.id}>
                              {v.name} (موجودی: {toPersianDigits(v.stock)})
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
                    <div className="sm:col-span-6">
                      <label className="block text-xs font-bold text-slate-600 mb-1">
                        نام دستگاه / ابزار یا تجهیز کارگاهی: <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="مثلاً: دستگاه جوش آرگون، پمپ باد ۲۵۰ لیتری، دستگاه ارسالی مشتری..."
                        value={customAssetName}
                        onChange={(e) => setCustomAssetName(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold focus:bg-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 focus:outline-none"
                      />
                    </div>
                    <div className="sm:col-span-3">
                      <label className="block text-xs font-bold text-slate-600 mb-1">
                        کد اموال / پلاک (اختیاری):
                      </label>
                      <input
                        type="text"
                        placeholder="مثلاً: AST-104"
                        value={customAssetCode}
                        onChange={(e) => setCustomAssetCode(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono focus:bg-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 focus:outline-none"
                      />
                    </div>
                    <div className="sm:col-span-3">
                      <label className="block text-xs font-bold text-slate-600 mb-1">
                        واحد سنجش:
                      </label>
                      <input
                        type="text"
                        list="direct-transfer-unit-list"
                        value={customAssetUnit}
                        onChange={(e) => setCustomAssetUnit(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold focus:bg-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 focus:outline-none"
                      />
                      <datalist id="direct-transfer-unit-list">
                        {COMMON_UNITS.map((u) => (
                          <option key={u} value={u} />
                        ))}
                      </datalist>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end pt-1 border-t border-slate-100">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-slate-600 mb-1">
                      تعداد ({itemSourceMode === 'custom' ? customAssetUnit || 'دستگاه' : selectedProduct?.unit || 'عدد'}):
                    </label>
                    <NumericInput
                      min={1}
                      value={itemQuantity}
                      onChange={(num) => setItemQuantity(Math.max(1, num || 1))}
                      textAlign="center"
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-center focus:bg-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 focus:outline-none"
                    />
                  </div>

                  <div className="sm:col-span-3">
                    <label className="block text-xs font-bold text-slate-600 mb-1">
                      شماره سریال / کد فنی:
                    </label>
                    <input
                      type="text"
                      placeholder="مثلاً: SN-4921"
                      value={itemSerialNumber}
                      onChange={(e) => setItemSerialNumber(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddItem();
                        }
                      }}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono focus:bg-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 focus:outline-none"
                    />
                  </div>

                  <div className="sm:col-span-4">
                    <label className="block text-xs font-bold text-slate-600 mb-1">
                      شرح ایراد فنی یا توضیحات ردیف:
                    </label>
                    <input
                      type="text"
                      placeholder="مثلاً: سرویس دوره‌ای یا تست ۷۲ ساعته"
                      value={itemNotes}
                      onChange={(e) => setItemNotes(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddItem();
                        }
                      }}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs focus:bg-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 focus:outline-none"
                    />
                  </div>

                  <div className="sm:col-span-3">
                    <button
                      type="button"
                      onClick={handleAddItem}
                      className="w-full flex items-center justify-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-colors shadow-xs cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      <span>افزودن به لیست خروج</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* List of Added Items */}
            {items.length > 0 ? (
              <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-100 text-slate-700 border-b border-slate-200 font-bold">
                    <tr>
                      <th className="p-2.5 w-10 text-center">#</th>
                      <th className="p-2.5">نام کالا / دستگاه</th>
                      <th className="p-2.5 text-center">تعداد</th>
                      <th className="p-2.5">شماره سریال / پلاک فنی</th>
                      <th className="p-2.5">شرح عیب / توضیحات</th>
                      {!isEditMode && <th className="p-2.5 text-center w-12">حذف</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {items.map((item, idx) => (
                      <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="p-2.5 text-center font-mono font-bold text-slate-400">
                          {toPersianDigits(idx + 1)}
                        </td>
                        <td className="p-2.5">
                          <div className="font-bold text-slate-900">{item.productName}</div>
                          <div className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-2">
                            <span className="font-mono">کد: {item.productCode}</span>
                            {item.variantName && <span>· مدل: {item.variantName}</span>}
                            <span>
                              · {item.isCustomAsset ? 'اموال/تجهیز کارگاهی (بدون کسر موجودی کالا)' : 'کالای انبار'}
                            </span>
                          </div>
                        </td>
                        <td className="p-2.5 text-center font-mono font-bold text-slate-900">
                          {toPersianDigits(item.quantity)} {item.unit}
                        </td>
                        <td className="p-2.5">
                          <input
                            type="text"
                            value={item.serialNumber || ''}
                            onChange={(e) => handleUpdateItemField(item.id, 'serialNumber', e.target.value)}
                            placeholder="ثبت سریال..."
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs font-mono focus:bg-white focus:border-amber-500 focus:outline-none"
                          />
                        </td>
                        <td className="p-2.5">
                          <input
                            type="text"
                            value={item.notes || ''}
                            onChange={(e) => handleUpdateItemField(item.id, 'notes', e.target.value)}
                            placeholder="توضیحات..."
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs focus:bg-white focus:border-amber-500 focus:outline-none"
                          />
                        </td>
                        {!isEditMode && (
                          <td className="p-2.5 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(item.id)}
                              className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-5 bg-white border border-dashed border-slate-300 rounded-xl text-center text-xs text-slate-400">
                هنوز هیچ کالا یا دستگاهی به این برگه اضافه نشده است.
              </div>
            )}
          </div>

          {/* Section 3: Receiver, Customer Picker & Vehicle Details */}
          <div className="bg-slate-50/80 p-4 rounded-2xl border border-slate-200/90 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200/80 pb-2.5 flex-wrap gap-2">
              <div className="flex items-center gap-2 text-xs sm:text-sm font-black text-slate-800">
                <Car className="w-4 h-4 text-amber-600" />
                <span>۳. مشخصات تحویل‌گیرنده و خودروی حمل</span>
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                {customers.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowCustomerDropdown(!showCustomerDropdown);
                      setShowSavedFleet(false);
                    }}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer border ${
                      showCustomerDropdown
                        ? 'bg-slate-800 text-white border-slate-800'
                        : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300'
                    }`}
                  >
                    <Users className="w-3.5 h-3.5 text-amber-600" />
                    <span>انتخاب از مشتریان ({toPersianDigits(customers.length)})</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleRegisterVehicle}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white transition-all cursor-pointer"
                >
                  <BookmarkPlus className="w-3.5 h-3.5" />
                  <span>ذخیره در ناوگان</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsFleetModalOpen(true)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 transition-all cursor-pointer"
                >
                  <Truck className="w-3.5 h-3.5 text-slate-500" />
                  <span>مدیریت ناوگان</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowSavedFleet(!showSavedFleet);
                    setShowCustomerDropdown(false);
                  }}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer border ${
                    showSavedFleet
                      ? 'bg-amber-600 text-white border-amber-600'
                      : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300'
                  }`}
                >
                  <span>خودروهای اخیر ({toPersianDigits(savedVehicles.length)})</span>
                  {showSavedFleet ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>
              </div>
            </div>

            {/* Customer Quick Picker Panel */}
            {showCustomerDropdown && (
              <div className="bg-white rounded-xl border border-slate-300 p-3 shadow-xs space-y-2.5">
                <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2">
                  <span className="text-xs font-bold text-slate-800">
                    انتخاب تحویل‌گیرنده از لیست طرف‌حساب‌ها و مشتریان:
                  </span>
                  <div className="relative w-56">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-2" />
                    <input
                      type="text"
                      placeholder="جستجوی نام یا موبایل..."
                      value={customerSearch}
                      onChange={(e) => setCustomerSearch(e.target.value)}
                      className="w-full pr-8 pl-2.5 py-1 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 max-h-40 overflow-y-auto">
                  {filteredCustomers.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => handleSelectCustomer(c)}
                      className="p-2 rounded-xl border border-slate-200 hover:border-amber-400 hover:bg-amber-50/50 text-right transition-all cursor-pointer flex items-center justify-between gap-2 text-xs"
                    >
                      <div className="truncate">
                        <div className="font-bold text-slate-800 truncate">{c.name}</div>
                        {c.phone && <div className="text-[10px] text-slate-500 font-mono">{toPersianDigits(c.phone)}</div>}
                      </div>
                      <Check className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {vehicleFeedback && (
              <div
                className={`p-2.5 rounded-xl text-xs flex items-center justify-between ${
                  vehicleFeedback.type === 'success'
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-rose-50 text-rose-800 border border-rose-200'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
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

            {/* Saved Fleet Expandable Panel */}
            {showSavedFleet && (
              <div className="bg-white rounded-xl border border-amber-300 p-3 shadow-xs space-y-2.5">
                <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2">
                  <span className="text-xs font-bold text-slate-800">
                    انتخاب از خودروها و رانندگان ثبت‌شده:
                  </span>
                  <div className="relative w-56">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-2" />
                    <input
                      type="text"
                      placeholder="جستجوی پلاک، مدل یا راننده..."
                      value={fleetSearchQuery}
                      onChange={(e) => setFleetSearchQuery(e.target.value)}
                      className="w-full pr-8 pl-2.5 py-1 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none"
                    />
                  </div>
                </div>

                {filteredSavedVehicles.length === 0 ? (
                  <div className="text-center py-3 text-xs text-slate-400">خودرویی یافت نشد.</div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-44 overflow-y-auto">
                    {filteredSavedVehicles.map((veh) => (
                      <div
                        key={veh.id}
                        onClick={() => handleSelectSavedVehicle(veh)}
                        className="p-2 rounded-xl border border-slate-200 hover:border-amber-400 hover:bg-amber-50/40 transition-all cursor-pointer flex items-center justify-between gap-2 text-xs"
                      >
                        <div className="truncate flex-1">
                          <div className="font-bold text-slate-800 truncate">{veh.vehicleType}</div>
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            {veh.driverName && <span>راننده: {veh.driverName} </span>}
                            {veh.plateNumber && (
                              <span className="font-mono text-amber-800 font-bold">
                                ({toPersianDigits(veh.plateNumber)})
                              </span>
                            )}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => handleDeleteSavedVehicle(veh.id, veh.vehicleInfo, e)}
                          className="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  نام تحویل‌گیرنده / تعمیرگاه / مشتری: <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
                  <input
                    type="text"
                    required
                    placeholder="نام شخص، شرکت یا تعمیرگاه"
                    value={receiverName}
                    onChange={(e) => setReceiverName(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl pr-9 pl-3 py-2 text-xs sm:text-sm font-bold focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
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
                    className="w-full bg-white border border-slate-300 rounded-xl pr-9 pl-3 py-2 text-xs sm:text-sm font-mono text-right focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  انباردار صادرکننده برگه:
                </label>
                <input
                  type="text"
                  value={dispatchedBy}
                  onChange={(e) => setDispatchedBy(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs sm:text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Vehicle & Plate Selection */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                مشخصات خودرو و پلاک خارج‌کننده:
              </label>
              <IranPlatePicker
                value={dispatchVehicleInfo}
                onChange={setDispatchVehicleInfo}
                placeholder="نوع خودرو (مثلاً وانت نیسان، پراید بار) و پلاک"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 pt-1 items-end">
              <div className="sm:col-span-4">
                <JalaliDatePicker
                  label="تاریخ خروج:"
                  value={dispatchedAtDate}
                  onChange={setDispatchedAtDate}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  ساعت خروج:
                </label>
                <div className="relative">
                  <Clock className="w-4 h-4 text-slate-400 absolute right-2.5 top-2.5" />
                  <input
                    type="text"
                    value={dispatchedAtTime}
                    onChange={(e) => setDispatchedAtTime(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl pr-8 pl-2 py-2 text-xs font-mono text-center focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>
              <div className="sm:col-span-6">
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  توضیحات تکمیلی و شروط تحویل / نگهبانی:
                </label>
                <input
                  type="text"
                  placeholder="مثلاً: متعلقات همراه دستگاه تحویل شد / مجوز خروج مدیریت"
                  value={dispatchNotes}
                  onChange={(e) => setDispatchNotes(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="border-t border-slate-200 pt-4 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-xs text-slate-500 flex items-center gap-1.5">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                {isEditMode
                  ? 'تغییرات برگه ذخیره و در سوابق انبار بروزرسانی می‌شود.'
                  : 'کالاهای انتخابی از انبار به صورت خودکار کسر شده و در کاردکس ثبت می‌شوند.'}
              </span>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 font-bold text-xs transition-colors flex-1 sm:flex-none cursor-pointer"
              >
                انصراف
              </button>
              <button
                type="submit"
                className="px-6 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-sm transition-all flex items-center justify-center gap-1.5 flex-1 sm:flex-none cursor-pointer"
              >
                {isEditMode ? <Check className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
                <span>{isEditMode ? 'ذخیره تغییرات برگه' : 'ثبت و صدور برگه خروج'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>

      <VehicleFleetModal
        isOpen={isFleetModalOpen}
        onClose={() => setIsFleetModalOpen(false)}
        onSelectVehicle={(veh) => handleSelectSavedVehicle(veh)}
      />
    </div>
  );
};
