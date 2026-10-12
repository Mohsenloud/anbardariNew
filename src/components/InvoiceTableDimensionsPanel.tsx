import React, { useState } from 'react';
import { 
  SlidersHorizontal, 
  X, 
  RotateCcw, 
  Save, 
  Check, 
  MoveVertical, 
  Columns, 
  Type,
  Sparkles,
  ChevronDown
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
  const [activeTab, setActiveTab] = useState<'height' | 'fontSize' | 'width'>('height');
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

  // Row height & spacing presets
  const applyHeightPreset = (preset: 'ultra-compact' | 'compact' | 'standard' | 'relaxed' | 'spacious') => {
    if (preset === 'ultra-compact') {
      handleUpdate({
        tableRowMinHeight: 22,
        tableRowPaddingY: 1,
        tableCellPaddingX: 5,
        tableBodySize: Math.min(layout.tableBodySize || 11, 10),
      });
    } else if (preset === 'compact') {
      handleUpdate({
        tableRowMinHeight: 28,
        tableRowPaddingY: 3,
        tableCellPaddingX: 6,
        tableBodySize: Math.min(layout.tableBodySize || 11, 10),
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
        tableRowMinHeight: 48,
        tableRowPaddingY: 11,
        tableCellPaddingX: 10,
        tableBodySize: 12,
      });
    } else if (preset === 'spacious') {
      handleUpdate({
        tableRowMinHeight: 60,
        tableRowPaddingY: 16,
        tableCellPaddingX: 12,
        tableBodySize: 13,
      });
    }
  };

  // Font size presets
  const applyFontPreset = (preset: 'small' | 'standard' | 'large' | 'xlarge') => {
    if (preset === 'small') {
      handleUpdate({
        tableBodySize: 9,
        tableHeaderSize: 9,
        baseFontSize: 10,
        totalsSize: 11,
        headerMetaSize: 9,
        headerTitleSize: 15,
      });
    } else if (preset === 'standard') {
      handleUpdate({
        tableBodySize: 11,
        tableHeaderSize: 11,
        baseFontSize: 12,
        totalsSize: 13,
        headerMetaSize: 11,
        headerTitleSize: 18,
      });
    } else if (preset === 'large') {
      handleUpdate({
        tableBodySize: 13,
        tableHeaderSize: 13,
        baseFontSize: 14,
        totalsSize: 15,
        headerMetaSize: 12,
        headerTitleSize: 20,
      });
    } else if (preset === 'xlarge') {
      handleUpdate({
        tableBodySize: 15,
        tableHeaderSize: 15,
        baseFontSize: 16,
        totalsSize: 17,
        headerMetaSize: 13,
        headerTitleSize: 22,
      });
    }
  };

  const currentMinHeight = layout.tableRowMinHeight || 34;
  const currentPaddingY = layout.tableRowPaddingY ?? 6;
  const currentPaddingX = layout.tableCellPaddingX ?? 8;

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
                تنظیم اندازه، ارتفاع و فونت فاکتور
                <span className="text-[10px] text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded-full border border-emerald-500/30 font-normal">
                  پیش‌نمایش زنده و آنی
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
                onClick={() => setActiveTab('fontSize')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-md transition-all cursor-pointer text-xs font-bold ${
                  activeTab === 'fontSize'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Type className="w-3.5 h-3.5" />
                <span>سایز فونت و قلم</span>
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
              title="بازنشانی اندازه تمام ستون‌ها، ردیف‌ها و فونت‌ها به حالت کارخانه"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">بازنشانی</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              title="بستن پنل تنظیمات"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ========================================================= */}
        {/* TAB 1: ROW HEIGHT & CELL PADDING CONTROLS                */}
        {/* ========================================================= */}
        {activeTab === 'height' && (
          <div className="space-y-4">
            {/* Quick Height Presets */}
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
              <span className="text-[11px] text-slate-400 font-bold ml-1">ارتفاع پیشنهادی:</span>
              <button
                type="button"
                onClick={() => applyHeightPreset('ultra-compact')}
                className="px-2.5 py-1 text-xs bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-slate-200 transition-colors cursor-pointer"
              >
                ⚡ فوق‌فشرده (۲۲px)
              </button>
              <button
                type="button"
                onClick={() => applyHeightPreset('compact')}
                className="px-2.5 py-1 text-xs bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-slate-200 transition-colors cursor-pointer"
              >
                ⚡ فشرده (۲۸px)
              </button>
              <button
                type="button"
                onClick={() => applyHeightPreset('standard')}
                className="px-2.5 py-1 text-xs bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-slate-200 transition-colors cursor-pointer"
              >
                ⚖️ استاندارد (۳۶px)
              </button>
              <button
                type="button"
                onClick={() => applyHeightPreset('relaxed')}
                className="px-2.5 py-1 text-xs bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-slate-200 transition-colors cursor-pointer"
              >
                🪟 جادار (۴۸px)
              </button>
              <button
                type="button"
                onClick={() => applyHeightPreset('spacious')}
                className="px-2.5 py-1 text-xs bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-slate-200 transition-colors cursor-pointer"
              >
                🌟 خیلی باز (۶۰px)
              </button>
            </div>

            {/* Master Slider & Controls Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 bg-slate-950/70 p-3.5 rounded-xl border border-slate-800">
              {/* 1. Combined Master Height Slider */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-slate-200">ارتفاع هر ردیف جدول:</span>
                  <span className="font-mono font-bold text-emerald-400 text-sm">
                    {toPersianDigits(currentMinHeight)} px
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const nextH = Math.max(18, currentMinHeight - 2);
                      const nextPy = Math.max(0, Math.min(22, Math.round((nextH - 18) * 0.35)));
                      handleUpdate({ tableRowMinHeight: nextH, tableRowPaddingY: nextPy });
                    }}
                    className="w-7 h-7 flex items-center justify-center bg-slate-800 hover:bg-slate-700 rounded text-slate-300 font-bold cursor-pointer"
                  >
                    -
                  </button>
                  <input
                    type="range"
                    min={18}
                    max={85}
                    step={1}
                    value={currentMinHeight}
                    onChange={(e) => {
                      const nextH = Number(e.target.value);
                      const nextPy = Math.max(0, Math.min(22, Math.round((nextH - 18) * 0.35)));
                      handleUpdate({ tableRowMinHeight: nextH, tableRowPaddingY: nextPy });
                    }}
                    className="flex-1 accent-emerald-500 cursor-pointer h-1.5 bg-slate-700 rounded-lg"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const nextH = Math.min(85, currentMinHeight + 2);
                      const nextPy = Math.max(0, Math.min(22, Math.round((nextH - 18) * 0.35)));
                      handleUpdate({ tableRowMinHeight: nextH, tableRowPaddingY: nextPy });
                    }}
                    className="w-7 h-7 flex items-center justify-center bg-slate-800 hover:bg-slate-700 rounded text-slate-300 font-bold cursor-pointer"
                  >
                    +
                  </button>
                </div>
                <p className="text-[10px] text-slate-400 leading-tight">
                  تغییر مستقیم ارتفاع سطرها با هماهنگی خودکار پدینگ عمودی.
                </p>
              </div>

              {/* 2. Table Font Size Slider (سایز فونت جدول) */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-slate-200">سایز فونت جدول:</span>
                  <span className="font-mono font-bold text-emerald-400 text-sm">
                    {toPersianDigits(layout.tableBodySize || 11)} px
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const nextS = Math.max(8, (layout.tableBodySize || 11) - 1);
                      handleUpdate({ tableBodySize: nextS, tableHeaderSize: nextS, baseFontSize: nextS + 1 });
                    }}
                    className="w-7 h-7 flex items-center justify-center bg-slate-800 hover:bg-slate-700 rounded text-slate-300 font-bold cursor-pointer"
                  >
                    -
                  </button>
                  <input
                    type="range"
                    min={8}
                    max={18}
                    step={1}
                    value={layout.tableBodySize || 11}
                    onChange={(e) => {
                      const nextS = Number(e.target.value);
                      handleUpdate({ tableBodySize: nextS, tableHeaderSize: nextS, baseFontSize: nextS + 1 });
                    }}
                    className="flex-1 accent-emerald-500 cursor-pointer h-1.5 bg-slate-700 rounded-lg"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const nextS = Math.min(18, (layout.tableBodySize || 11) + 1);
                      handleUpdate({ tableBodySize: nextS, tableHeaderSize: nextS, baseFontSize: nextS + 1 });
                    }}
                    className="w-7 h-7 flex items-center justify-center bg-slate-800 hover:bg-slate-700 rounded text-slate-300 font-bold cursor-pointer"
                  >
                    +
                  </button>
                </div>
                <p className="text-[10px] text-slate-400 leading-tight">
                  تنظیم اندازه قلم متون، نام کالاها و ارقام جدول.
                </p>
              </div>

              {/* 3. Vertical Padding (Row Padding Y) */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-slate-200">فاصله عمودی بالا و پایین (پدینگ):</span>
                  <span className="font-mono font-bold text-emerald-400 text-sm">
                    {toPersianDigits(currentPaddingY)} px
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleUpdate({ tableRowPaddingY: Math.max(0, currentPaddingY - 1) })}
                    className="w-7 h-7 flex items-center justify-center bg-slate-800 hover:bg-slate-700 rounded text-slate-300 font-bold cursor-pointer"
                  >
                    -
                  </button>
                  <input
                    type="range"
                    min={0}
                    max={26}
                    step={1}
                    value={currentPaddingY}
                    onChange={(e) => handleUpdate({ tableRowPaddingY: Number(e.target.value) })}
                    className="flex-1 accent-emerald-500 cursor-pointer h-1.5 bg-slate-700 rounded-lg"
                  />
                  <button
                    type="button"
                    onClick={() => handleUpdate({ tableRowPaddingY: Math.min(26, currentPaddingY + 1) })}
                    className="w-7 h-7 flex items-center justify-center bg-slate-800 hover:bg-slate-700 rounded text-slate-300 font-bold cursor-pointer"
                  >
                    +
                  </button>
                </div>
                <p className="text-[10px] text-slate-400 leading-tight">
                  تنظیم فاصله خالی بالا و پایین متن درون سلول‌ها.
                </p>
              </div>

              {/* 4. Horizontal Padding (Cell Padding X) */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-slate-200">فاصله افقی چپ و راست سلول‌ها:</span>
                  <span className="font-mono font-bold text-emerald-400 text-sm">
                    {toPersianDigits(currentPaddingX)} px
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleUpdate({ tableCellPaddingX: Math.max(1, currentPaddingX - 1) })}
                    className="w-7 h-7 flex items-center justify-center bg-slate-800 hover:bg-slate-700 rounded text-slate-300 font-bold cursor-pointer"
                  >
                    -
                  </button>
                  <input
                    type="range"
                    min={1}
                    max={24}
                    step={1}
                    value={currentPaddingX}
                    onChange={(e) => handleUpdate({ tableCellPaddingX: Number(e.target.value) })}
                    className="flex-1 accent-emerald-500 cursor-pointer h-1.5 bg-slate-700 rounded-lg"
                  />
                  <button
                    type="button"
                    onClick={() => handleUpdate({ tableCellPaddingX: Math.min(24, currentPaddingX + 1) })}
                    className="w-7 h-7 flex items-center justify-center bg-slate-800 hover:bg-slate-700 rounded text-slate-300 font-bold cursor-pointer"
                  >
                    +
                  </button>
                </div>
                <p className="text-[10px] text-slate-400 leading-tight">
                  تنظیم حاشیه چپ و راست اعداد و متون در هر ستون.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 2: FONT SIZE & TYPOGRAPHY CONTROLS                    */}
        {/* ========================================================= */}
        {activeTab === 'fontSize' && (
          <div className="space-y-4">
            {/* Quick Font Presets */}
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
              <span className="text-[11px] text-slate-400 font-bold ml-1">اندازه قلم پیشنهادی:</span>
              <button
                type="button"
                onClick={() => applyFontPreset('small')}
                className="px-2.5 py-1 text-xs bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-slate-200 transition-colors cursor-pointer"
              >
                🔤 فونت ریز (۹px)
              </button>
              <button
                type="button"
                onClick={() => applyFontPreset('standard')}
                className="px-2.5 py-1 text-xs bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-slate-200 transition-colors cursor-pointer"
              >
                🔤 فونت استاندارد (۱۱px)
              </button>
              <button
                type="button"
                onClick={() => applyFontPreset('large')}
                className="px-2.5 py-1 text-xs bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-slate-200 transition-colors cursor-pointer"
              >
                🔤 فونت درشت (۱۳px)
              </button>
              <button
                type="button"
                onClick={() => applyFontPreset('xlarge')}
                className="px-2.5 py-1 text-xs bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-slate-200 transition-colors cursor-pointer"
              >
                🔤 خیلی درشت (۱۵px)
              </button>
            </div>

            {/* Font Sliders Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 bg-slate-950/70 p-3.5 rounded-xl border border-slate-800">
              {/* 1. Table Body Font Size (Items, names, prices) */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-slate-200">سایز متن اقلام جدول (کالا و قیمت):</span>
                  <span className="font-mono font-bold text-emerald-400 text-sm">
                    {toPersianDigits(layout.tableBodySize || 11)} px
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleUpdate({ tableBodySize: Math.max(8, (layout.tableBodySize || 11) - 1) })}
                    className="w-7 h-7 flex items-center justify-center bg-slate-800 hover:bg-slate-700 rounded text-slate-300 font-bold cursor-pointer"
                  >
                    -
                  </button>
                  <input
                    type="range"
                    min={8}
                    max={18}
                    step={1}
                    value={layout.tableBodySize || 11}
                    onChange={(e) => handleUpdate({ tableBodySize: Number(e.target.value) })}
                    className="flex-1 accent-emerald-500 cursor-pointer h-1.5 bg-slate-700 rounded-lg"
                  />
                  <button
                    type="button"
                    onClick={() => handleUpdate({ tableBodySize: Math.min(18, (layout.tableBodySize || 11) + 1) })}
                    className="w-7 h-7 flex items-center justify-center bg-slate-800 hover:bg-slate-700 rounded text-slate-300 font-bold cursor-pointer"
                  >
                    +
                  </button>
                </div>
                <p className="text-[10px] text-slate-400 leading-tight">
                  اندازه متن شرح کالا، تعداد، واحد و قیمت‌ها در جدول.
                </p>
              </div>

              {/* 2. Table Header Font Size */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-slate-200">سایز عناوین سرستون‌های جدول:</span>
                  <span className="font-mono font-bold text-emerald-400 text-sm">
                    {toPersianDigits(layout.tableHeaderSize || 11)} px
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleUpdate({ tableHeaderSize: Math.max(8, (layout.tableHeaderSize || 11) - 1) })}
                    className="w-7 h-7 flex items-center justify-center bg-slate-800 hover:bg-slate-700 rounded text-slate-300 font-bold cursor-pointer"
                  >
                    -
                  </button>
                  <input
                    type="range"
                    min={8}
                    max={18}
                    step={1}
                    value={layout.tableHeaderSize || 11}
                    onChange={(e) => handleUpdate({ tableHeaderSize: Number(e.target.value) })}
                    className="flex-1 accent-emerald-500 cursor-pointer h-1.5 bg-slate-700 rounded-lg"
                  />
                  <button
                    type="button"
                    onClick={() => handleUpdate({ tableHeaderSize: Math.min(18, (layout.tableHeaderSize || 11) + 1) })}
                    className="w-7 h-7 flex items-center justify-center bg-slate-800 hover:bg-slate-700 rounded text-slate-300 font-bold cursor-pointer"
                  >
                    +
                  </button>
                </div>
                <p className="text-[10px] text-slate-400 leading-tight">
                  اندازه تیترهای بالای جدول (ردیف، شرح، تعداد، مبلغ).
                </p>
              </div>

              {/* 3. Base / Overall Font Size */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-slate-200">سایز فونت کلی فاکتور:</span>
                  <span className="font-mono font-bold text-emerald-400 text-sm">
                    {toPersianDigits(layout.baseFontSize || 12)} px
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleUpdate({ baseFontSize: Math.max(8, (layout.baseFontSize || 12) - 1) })}
                    className="w-7 h-7 flex items-center justify-center bg-slate-800 hover:bg-slate-700 rounded text-slate-300 font-bold cursor-pointer"
                  >
                    -
                  </button>
                  <input
                    type="range"
                    min={8}
                    max={18}
                    step={1}
                    value={layout.baseFontSize || 12}
                    onChange={(e) => handleUpdate({ baseFontSize: Number(e.target.value) })}
                    className="flex-1 accent-emerald-500 cursor-pointer h-1.5 bg-slate-700 rounded-lg"
                  />
                  <button
                    type="button"
                    onClick={() => handleUpdate({ baseFontSize: Math.min(18, (layout.baseFontSize || 12) + 1) })}
                    className="w-7 h-7 flex items-center justify-center bg-slate-800 hover:bg-slate-700 rounded text-slate-300 font-bold cursor-pointer"
                  >
                    +
                  </button>
                </div>
                <p className="text-[10px] text-slate-400 leading-tight">
                  مقیاس کلی متون در کل برگه فاکتور.
                </p>
              </div>

              {/* 4. Header Title Size */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-slate-200">سایز نام فروشگاه و عنوان فاکتور:</span>
                  <span className="font-mono font-bold text-emerald-400 text-sm">
                    {toPersianDigits(layout.headerTitleSize || 18)} px
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleUpdate({ headerTitleSize: Math.max(12, (layout.headerTitleSize || 18) - 1) })}
                    className="w-7 h-7 flex items-center justify-center bg-slate-800 hover:bg-slate-700 rounded text-slate-300 font-bold cursor-pointer"
                  >
                    -
                  </button>
                  <input
                    type="range"
                    min={12}
                    max={28}
                    step={1}
                    value={layout.headerTitleSize || 18}
                    onChange={(e) => handleUpdate({ headerTitleSize: Number(e.target.value) })}
                    className="flex-1 accent-emerald-500 cursor-pointer h-1.5 bg-slate-700 rounded-lg"
                  />
                  <button
                    type="button"
                    onClick={() => handleUpdate({ headerTitleSize: Math.min(28, (layout.headerTitleSize || 18) + 1) })}
                    className="w-7 h-7 flex items-center justify-center bg-slate-800 hover:bg-slate-700 rounded text-slate-300 font-bold cursor-pointer"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* 5. Header Meta (Customer, Date, Invoice No) */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-slate-200">سایز مشخصات خریدار و شماره/تاریخ:</span>
                  <span className="font-mono font-bold text-emerald-400 text-sm">
                    {toPersianDigits(layout.headerMetaSize || 11)} px
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleUpdate({ headerMetaSize: Math.max(8, (layout.headerMetaSize || 11) - 1) })}
                    className="w-7 h-7 flex items-center justify-center bg-slate-800 hover:bg-slate-700 rounded text-slate-300 font-bold cursor-pointer"
                  >
                    -
                  </button>
                  <input
                    type="range"
                    min={8}
                    max={16}
                    step={1}
                    value={layout.headerMetaSize || 11}
                    onChange={(e) => handleUpdate({ headerMetaSize: Number(e.target.value) })}
                    className="flex-1 accent-emerald-500 cursor-pointer h-1.5 bg-slate-700 rounded-lg"
                  />
                  <button
                    type="button"
                    onClick={() => handleUpdate({ headerMetaSize: Math.min(16, (layout.headerMetaSize || 11) + 1) })}
                    className="w-7 h-7 flex items-center justify-center bg-slate-800 hover:bg-slate-700 rounded text-slate-300 font-bold cursor-pointer"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* 6. Totals Box Font Size */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-slate-200">سایز مبالغ جمع کل و مانده حساب:</span>
                  <span className="font-mono font-bold text-emerald-400 text-sm">
                    {toPersianDigits(layout.totalsSize || 13)} px
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleUpdate({ totalsSize: Math.max(10, (layout.totalsSize || 13) - 1) })}
                    className="w-7 h-7 flex items-center justify-center bg-slate-800 hover:bg-slate-700 rounded text-slate-300 font-bold cursor-pointer"
                  >
                    -
                  </button>
                  <input
                    type="range"
                    min={10}
                    max={22}
                    step={1}
                    value={layout.totalsSize || 13}
                    onChange={(e) => handleUpdate({ totalsSize: Number(e.target.value) })}
                    className="flex-1 accent-emerald-500 cursor-pointer h-1.5 bg-slate-700 rounded-lg"
                  />
                  <button
                    type="button"
                    onClick={() => handleUpdate({ totalsSize: Math.min(22, (layout.totalsSize || 13) + 1) })}
                    className="w-7 h-7 flex items-center justify-center bg-slate-800 hover:bg-slate-700 rounded text-slate-300 font-bold cursor-pointer"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 3: COLUMN WIDTHS CONTROLS                             */}
        {/* ========================================================= */}
        {activeTab === 'width' && (
          <div className="space-y-3">
            <p className="text-[11px] text-slate-400">
              با کشیدن اسلایدرهای زیر می‌توانید عرض هر ستون را به دقت میلی‌متری تنظیم کنید. ستون «شرح کالا» خودکار فضای باقیمانده را پر می‌کند.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Column 1: Index */}
              <div className="space-y-1.5 bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-slate-200">ستون ردیف:</span>
                  <span className="font-mono font-bold text-emerald-400">{toPersianDigits(layout.colWidthIndex)} px</span>
                </div>
                <input
                  type="range"
                  min={25}
                  max={70}
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
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
