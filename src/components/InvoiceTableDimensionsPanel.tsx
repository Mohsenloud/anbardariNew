import React, { useState } from 'react';
import { 
  SlidersHorizontal, 
  X, 
  RotateCcw, 
  Save, 
  Check, 
  MoveVertical, 
  Columns, 
  Maximize2,
  ChevronDown,
  Sparkles,
  Info
} from 'lucide-react';
import { PrintLayoutSettings, DEFAULT_PRINT_LAYOUT } from '../types';
import { toPersianDigits } from '../utils/jalali';

interface InvoiceTableDimensionsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  layout: PrintLayoutSettings;
  onChangeLayout: (newLayout: PrintLayoutSettings) => void;
  onSaveAsDefault: () => void;
  onResetToDefault: () => void;
  pageSize?: 'a4' | 'a5';
  orientation?: 'portrait' | 'landscape';
}

export const InvoiceTableDimensionsPanel: React.FC<InvoiceTableDimensionsPanelProps> = ({
  isOpen,
  onClose,
  layout,
  onChangeLayout,
  onSaveAsDefault,
  onResetToDefault,
  pageSize = 'a4',
  orientation = 'portrait',
}) => {
  const [activeTab, setActiveTab] = useState<'height' | 'width'>('height');
  const [saveSuccess, setSaveSuccess] = useState(false);

  if (!isOpen) return null;

  const handleUpdate = (updates: Partial<PrintLayoutSettings>) => {
    onChangeLayout({
      ...layout,
      ...updates,
    });
  };

  const handleSave = () => {
    onSaveAsDefault();
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2500);
  };

  // Preset row height styles
  const applyPreset = (preset: 'compact' | 'standard' | 'relaxed') => {
    if (preset === 'compact') {
      handleUpdate({
        tableRowMinHeight: 28,
        tableRowPaddingY: 3,
        tableCellPaddingX: 5,
        tableBodySize: Math.min(layout.tableBodySize, 10),
      });
    } else if (preset === 'standard') {
      handleUpdate({
        tableRowMinHeight: 36,
        tableRowPaddingY: 6,
        tableCellPaddingX: 8,
        tableBodySize: 11,
      });
    } else if (preset === 'relaxed') {
      handleUpdate({
        tableRowMinHeight: 46,
        tableRowPaddingY: 10,
        tableCellPaddingX: 10,
        tableBodySize: 12,
      });
    }
  };

  const currentMinHeight = layout.tableRowMinHeight || 34;

  return (
    <div 
      className="no-print bg-slate-900/95 border-b border-slate-700/80 text-white px-3 sm:px-6 py-3.5 shadow-xl animate-in slide-in-from-top-2 duration-150 relative z-30"
      dir="rtl"
    >
      <div className="max-w-4xl mx-auto space-y-3.5">
        {/* Top Header & Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 pb-2.5 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <SlidersHorizontal className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs sm:text-sm font-bold text-white flex items-center gap-2">
                تنظیم سریع ابعاد سلول‌های جدول فاکتور
                <span className="text-[10px] text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded-full border border-emerald-500/30 font-normal">
                  پیش‌نمایش زنده آنی
                </span>
              </h4>
            </div>
          </div>

          {/* Tab Selector & Actions */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="inline-flex bg-slate-950 p-0.5 rounded-lg border border-slate-800 text-xs">
              <button
                type="button"
                onClick={() => setActiveTab('height')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-md transition-all cursor-pointer text-xs font-bold ${
                  activeTab === 'height'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <MoveVertical className="w-3.5 h-3.5" />
                <span>ارتفاع ردیف‌ها و سلول‌ها</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('width')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-md transition-all cursor-pointer text-xs font-bold ${
                  activeTab === 'width'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Columns className="w-3.5 h-3.5" />
                <span>عرض ستون‌ها</span>
              </button>
            </div>

            <button
              type="button"
              onClick={handleSave}
              className={`flex items-center gap-1 text-xs font-bold px-2.5 py-1.5 rounded-lg border transition-all cursor-pointer ${
                saveSuccess
                  ? 'bg-emerald-700 border-emerald-500 text-white'
                  : 'bg-emerald-600/25 border-emerald-500/40 text-emerald-300 hover:bg-emerald-600 hover:text-white'
              }`}
              title="ذخیره این ابعاد به عنوان اندازه پیش‌فرض برای تمام فاکتورها"
            >
              {saveSuccess ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
              <span>{saveSuccess ? 'ذخیره شد' : 'ذخیره پیش‌فرض'}</span>
            </button>

            <button
              type="button"
              onClick={onResetToDefault}
              className="flex items-center gap-1 text-xs text-slate-400 hover:text-white px-2 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors cursor-pointer border border-slate-700"
              title="بازنشانی اندازه تمام ستون‌ها و ردیف‌ها به حالت استاندارد کارخانه"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">بازنشانی</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              title="بستن پنل تنظیمات ابعاد"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tab 1: Row Height & Cell Padding Controls */}
        {activeTab === 'height' && (
          <div className="space-y-4">
            {/* Quick Presets */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] text-slate-400 font-bold ml-1">اندازه‌های پیشنهادی سریع:</span>
              <button
                type="button"
                onClick={() => applyPreset('compact')}
                className="px-2.5 py-1 text-xs bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-slate-200 transition-colors cursor-pointer"
              >
                ⚡ فشرده (۲۸px - جاگیری اقلام بیشتر)
              </button>
              <button
                type="button"
                onClick={() => applyPreset('standard')}
                className="px-2.5 py-1 text-xs bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-slate-200 transition-colors cursor-pointer"
              >
                ⚖️ استاندارد (۳۶px - متناسب)
              </button>
              <button
                type="button"
                onClick={() => applyPreset('relaxed')}
                className="px-2.5 py-1 text-xs bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-slate-200 transition-colors cursor-pointer"
              >
                🪟 جادار و باز (۴۶px)
              </button>
            </div>

            {/* Sliders Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-950/70 p-3.5 rounded-xl border border-slate-800">
              {/* 1. Min Row Height */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-slate-200">ارتفاع هر ردیف (حداقل):</span>
                  <span className="font-mono font-bold text-emerald-400 text-sm">
                    {toPersianDigits(currentMinHeight)} px
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleUpdate({ tableRowMinHeight: Math.max(18, currentMinHeight - 2) })}
                    className="w-7 h-7 flex items-center justify-center bg-slate-800 hover:bg-slate-700 rounded text-slate-300 font-bold cursor-pointer"
                  >
                    -
                  </button>
                  <input
                    type="range"
                    min={18}
                    max={75}
                    step={1}
                    value={currentMinHeight}
                    onChange={(e) => handleUpdate({ tableRowMinHeight: Number(e.target.value) })}
                    className="flex-1 accent-emerald-500 cursor-pointer h-1.5 bg-slate-700 rounded-lg"
                  />
                  <button
                    type="button"
                    onClick={() => handleUpdate({ tableRowMinHeight: Math.min(75, currentMinHeight + 2) })}
                    className="w-7 h-7 flex items-center justify-center bg-slate-800 hover:bg-slate-700 rounded text-slate-300 font-bold cursor-pointer"
                  >
                    +
                  </button>
                </div>
                <p className="text-[10px] text-slate-400">
                  اگر متن قلم طولانی باشد، ردیف خودکار باز می‌شود و متن هرگز بریده نمی‌شود.
                </p>
              </div>

              {/* 2. Vertical Padding (Row Padding Y) */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-slate-200">فاصله عمودی بالا و پایین (پدینگ):</span>
                  <span className="font-mono font-bold text-emerald-400 text-sm">
                    {toPersianDigits(layout.tableRowPaddingY)} px
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleUpdate({ tableRowPaddingY: Math.max(0, layout.tableRowPaddingY - 1) })}
                    className="w-7 h-7 flex items-center justify-center bg-slate-800 hover:bg-slate-700 rounded text-slate-300 font-bold cursor-pointer"
                  >
                    -
                  </button>
                  <input
                    type="range"
                    min={0}
                    max={22}
                    step={1}
                    value={layout.tableRowPaddingY}
                    onChange={(e) => handleUpdate({ tableRowPaddingY: Number(e.target.value) })}
                    className="flex-1 accent-emerald-500 cursor-pointer h-1.5 bg-slate-700 rounded-lg"
                  />
                  <button
                    type="button"
                    onClick={() => handleUpdate({ tableRowPaddingY: Math.min(22, layout.tableRowPaddingY + 1) })}
                    className="w-7 h-7 flex items-center justify-center bg-slate-800 hover:bg-slate-700 rounded text-slate-300 font-bold cursor-pointer"
                  >
                    +
                  </button>
                </div>
                <p className="text-[10px] text-slate-400">
                  تنظیم فضای تنفس متن در سلول‌های سرستون و بدنه جدول.
                </p>
              </div>

              {/* 3. Horizontal Padding (Cell Padding X) */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-slate-200">فاصله افقی چپ و راست سلول‌ها:</span>
                  <span className="font-mono font-bold text-emerald-400 text-sm">
                    {toPersianDigits(layout.tableCellPaddingX)} px
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleUpdate({ tableCellPaddingX: Math.max(1, layout.tableCellPaddingX - 1) })}
                    className="w-7 h-7 flex items-center justify-center bg-slate-800 hover:bg-slate-700 rounded text-slate-300 font-bold cursor-pointer"
                  >
                    -
                  </button>
                  <input
                    type="range"
                    min={1}
                    max={22}
                    step={1}
                    value={layout.tableCellPaddingX}
                    onChange={(e) => handleUpdate({ tableCellPaddingX: Number(e.target.value) })}
                    className="flex-1 accent-emerald-500 cursor-pointer h-1.5 bg-slate-700 rounded-lg"
                  />
                  <button
                    type="button"
                    onClick={() => handleUpdate({ tableCellPaddingX: Math.min(22, layout.tableCellPaddingX + 1) })}
                    className="w-7 h-7 flex items-center justify-center bg-slate-800 hover:bg-slate-700 rounded text-slate-300 font-bold cursor-pointer"
                  >
                    +
                  </button>
                </div>
                <p className="text-[10px] text-slate-400">
                  فاصله بین متن و خطوط کادر عمودی ستون‌ها.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Column Width Controls */}
        {activeTab === 'width' && (
          <div className="space-y-3">
            <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800 text-[11px] text-slate-400 flex items-center gap-2">
              <Info className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>
                عرض ستون «شرح کالا یا خدمات» به صورت هوشمند مابقی عرض صفحه را پر می‌کند. با تنظیم عرض بقیه ستون‌ها، جدول به دلخواه شما گسترش یا جمع می‌شود.
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 bg-slate-950/70 p-3.5 rounded-xl border border-slate-800">
              {/* Column 1: Index (#) */}
              <div className="space-y-1.5 bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-slate-200">ستون ردیف (#):</span>
                  <span className="font-mono font-bold text-emerald-400">{toPersianDigits(layout.colWidthIndex)} px</span>
                </div>
                <input
                  type="range"
                  min={20}
                  max={80}
                  step={2}
                  value={layout.colWidthIndex}
                  onChange={(e) => handleUpdate({ colWidthIndex: Number(e.target.value) })}
                  className="w-full accent-emerald-500 cursor-pointer h-1.5 bg-slate-700 rounded-lg"
                />
              </div>

              {/* Column 2: Product Code */}
              <div className="space-y-1.5 bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-slate-200">ستون کد کالا:</span>
                  <span className="font-mono font-bold text-emerald-400">{toPersianDigits(layout.colWidthCode)} px</span>
                </div>
                <input
                  type="range"
                  min={40}
                  max={140}
                  step={5}
                  value={layout.colWidthCode}
                  onChange={(e) => handleUpdate({ colWidthCode: Number(e.target.value) })}
                  className="w-full accent-emerald-500 cursor-pointer h-1.5 bg-slate-700 rounded-lg"
                />
              </div>

              {/* Column 3: Quantity */}
              <div className="space-y-1.5 bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-slate-200">ستون تعداد:</span>
                  <span className="font-mono font-bold text-emerald-400">{toPersianDigits(layout.colWidthQty)} px</span>
                </div>
                <input
                  type="range"
                  min={35}
                  max={120}
                  step={5}
                  value={layout.colWidthQty}
                  onChange={(e) => handleUpdate({ colWidthQty: Number(e.target.value) })}
                  className="w-full accent-emerald-500 cursor-pointer h-1.5 bg-slate-700 rounded-lg"
                />
              </div>

              {/* Column 4: Unit */}
              <div className="space-y-1.5 bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-slate-200">ستون واحد سنجش:</span>
                  <span className="font-mono font-bold text-emerald-400">{toPersianDigits(layout.colWidthUnit)} px</span>
                </div>
                <input
                  type="range"
                  min={35}
                  max={100}
                  step={5}
                  value={layout.colWidthUnit}
                  onChange={(e) => handleUpdate({ colWidthUnit: Number(e.target.value) })}
                  className="w-full accent-emerald-500 cursor-pointer h-1.5 bg-slate-700 rounded-lg"
                />
              </div>

              {/* Column 5: Unit Price */}
              <div className="space-y-1.5 bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-slate-200">ستون قیمت واحد:</span>
                  <span className="font-mono font-bold text-emerald-400">{toPersianDigits(layout.colWidthPrice)} px</span>
                </div>
                <input
                  type="range"
                  min={60}
                  max={200}
                  step={5}
                  value={layout.colWidthPrice}
                  onChange={(e) => handleUpdate({ colWidthPrice: Number(e.target.value) })}
                  className="w-full accent-emerald-500 cursor-pointer h-1.5 bg-slate-700 rounded-lg"
                />
              </div>

              {/* Column 6: Discount */}
              <div className="space-y-1.5 bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-slate-200">ستون تخفیف:</span>
                  <span className="font-mono font-bold text-emerald-400">{toPersianDigits(layout.colWidthDiscount)} px</span>
                </div>
                <input
                  type="range"
                  min={40}
                  max={150}
                  step={5}
                  value={layout.colWidthDiscount}
                  onChange={(e) => handleUpdate({ colWidthDiscount: Number(e.target.value) })}
                  className="w-full accent-emerald-500 cursor-pointer h-1.5 bg-slate-700 rounded-lg"
                />
              </div>

              {/* Column 7: Total Price */}
              <div className="space-y-1.5 bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-slate-200">ستون مبلغ کل سطر:</span>
                  <span className="font-mono font-bold text-emerald-400">{toPersianDigits(layout.colWidthTotal)} px</span>
                </div>
                <input
                  type="range"
                  min={90}
                  max={260}
                  step={5}
                  value={layout.colWidthTotal}
                  onChange={(e) => handleUpdate({ colWidthTotal: Number(e.target.value) })}
                  className="w-full accent-emerald-500 cursor-pointer h-1.5 bg-slate-700 rounded-lg"
                />
              </div>

              {/* Table Font Scale */}
              <div className="space-y-1.5 bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-slate-200">اندازه فونت جدول:</span>
                  <span className="font-mono font-bold text-emerald-400">{toPersianDigits(layout.tableBodySize)} px</span>
                </div>
                <input
                  type="range"
                  min={9}
                  max={15}
                  step={1}
                  value={layout.tableBodySize}
                  onChange={(e) => handleUpdate({ 
                    tableBodySize: Number(e.target.value),
                    tableHeaderSize: Number(e.target.value)
                  })}
                  className="w-full accent-emerald-500 cursor-pointer h-1.5 bg-slate-700 rounded-lg"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
