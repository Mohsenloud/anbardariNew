import React, { useState, useEffect, useMemo } from 'react';
import { 
  Calendar as CalendarIcon, 
  ChevronRight, 
  ChevronLeft, 
  Check, 
  X, 
  Clock, 
  RotateCcw,
  Sparkles
} from 'lucide-react';
import { 
  getCurrentJalaliDate, 
  addDaysToJalali, 
  toPersianDigits, 
  toEnglishDigits, 
  JALALI_MONTH_NAMES, 
  getJalaliMonthDays, 
  getJalaliMonthStartWeekday,
  jalaliToGregorian
} from '../utils/jalali';

interface InvoiceDateModalProps {
  isOpen: boolean;
  currentDate: string;
  invoiceNumber?: string;
  isProforma?: boolean;
  onSave: (newDate: string) => void;
  onClose: () => void;
}

const WEEKDAYS = [
  { short: 'ش', name: 'شنبه' },
  { short: 'ی', name: 'یکشنبه' },
  { short: 'د', name: 'دوشنبه' },
  { short: 'س', name: 'سه‌شنبه' },
  { short: 'چ', name: 'چهارشنبه' },
  { short: 'پ', name: 'پنج‌شنبه' },
  { short: 'ج', name: 'جمعه', isWeekend: true },
];

export const InvoiceDateModal: React.FC<InvoiceDateModalProps> = ({
  isOpen,
  currentDate,
  invoiceNumber,
  isProforma = false,
  onSave,
  onClose,
}) => {
  const [selectedDate, setSelectedDate] = useState<string>(() => currentDate || getCurrentJalaliDate());
  const [inputVal, setInputVal] = useState<string>(() => currentDate || getCurrentJalaliDate());

  // Parse selected date
  const parsed = useMemo(() => {
    const clean = toEnglishDigits(selectedDate || '').trim();
    const parts = clean.split('/').map(Number);
    const today = getCurrentJalaliDate().split('/').map(Number);

    const y = parts[0] && parts[0] >= 1350 && parts[0] <= 1450 ? parts[0] : today[0];
    const m = parts[1] && parts[1] >= 1 && parts[1] <= 12 ? parts[1] : today[1];
    const d = parts[2] && parts[2] >= 1 && parts[2] <= 31 ? parts[2] : today[2];

    return { year: y, month: m, day: d };
  }, [selectedDate]);

  const [viewYear, setViewYear] = useState<number>(parsed.year);
  const [viewMonth, setViewMonth] = useState<number>(parsed.month);

  useEffect(() => {
    if (isOpen) {
      const initial = currentDate || getCurrentJalaliDate();
      setSelectedDate(initial);
      setInputVal(initial);

      const clean = toEnglishDigits(initial).trim();
      const parts = clean.split('/').map(Number);
      const today = getCurrentJalaliDate().split('/').map(Number);
      setViewYear(parts[0] && parts[0] >= 1350 && parts[0] <= 1450 ? parts[0] : today[0]);
      setViewMonth(parts[1] && parts[1] >= 1 && parts[1] <= 12 ? parts[1] : today[1]);
    }
  }, [isOpen, currentDate]);

  const todayStr = useMemo(() => getCurrentJalaliDate(), []);
  const todayParts = useMemo(() => todayStr.split('/').map(Number), [todayStr]);

  const daysInMonth = useMemo(() => getJalaliMonthDays(viewYear, viewMonth), [viewYear, viewMonth]);
  const startWeekday = useMemo(() => getJalaliMonthStartWeekday(viewYear, viewMonth), [viewYear, viewMonth]);

  // Year options for dropdown
  const availableYears = useMemo(() => {
    const currentY = todayParts[0] || 1403;
    const years: number[] = [];
    for (let y = currentY - 5; y <= currentY + 3; y++) {
      years.push(y);
    }
    return years;
  }, [todayParts]);

  // Format date helper
  const formatDateStr = (y: number, m: number, d: number) => {
    const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
    return `${y}/${pad(m)}/${pad(d)}`;
  };

  const handleDayClick = (day: number) => {
    const formatted = formatDateStr(viewYear, viewMonth, day);
    setSelectedDate(formatted);
    setInputVal(formatted);
  };

  const handleQuickPreset = (presetDate: string) => {
    setSelectedDate(presetDate);
    setInputVal(presetDate);
    const parts = toEnglishDigits(presetDate).split('/').map(Number);
    if (parts[0] && parts[1]) {
      setViewYear(parts[0]);
      setViewMonth(parts[1]);
    }
  };

  const handlePrevMonth = () => {
    if (viewMonth === 1) {
      setViewMonth(12);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 12) {
      setViewMonth(1);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const handleInputChange = (val: string) => {
    setInputVal(val);
    const clean = toEnglishDigits(val).replace(/[^\d/]/g, '').trim();
    const parts = clean.split('/').map(Number);
    if (parts.length === 3 && parts[0] >= 1350 && parts[0] <= 1450 && parts[1] >= 1 && parts[1] <= 12 && parts[2] >= 1 && parts[2] <= 31) {
      const formatted = formatDateStr(parts[0], parts[1], parts[2]);
      setSelectedDate(formatted);
      setViewYear(parts[0]);
      setViewMonth(parts[1]);
    }
  };

  // Get weekday name and full Persian representation of selected date
  const selectedDatePersianDetails = useMemo(() => {
    try {
      const clean = toEnglishDigits(selectedDate || '').trim();
      const parts = clean.split('/').map(Number);
      if (parts.length === 3 && parts[0] && parts[1] && parts[2]) {
        const [gy, gm, gd] = jalaliToGregorian(parts[0], parts[1], parts[2]);
        const jsDay = new Date(gy, gm - 1, gd).getDay();
        const weekdayIdx = (jsDay + 1) % 7;
        const weekdayName = WEEKDAYS[weekdayIdx]?.name || 'نامشخص';
        const monthName = JALALI_MONTH_NAMES[parts[1] - 1] || '';
        return `${weekdayName}، ${toPersianDigits(parts[2])} ${monthName} ${toPersianDigits(parts[0])}`;
      }
    } catch {}
    return toPersianDigits(selectedDate);
  }, [selectedDate]);

  const handleConfirm = () => {
    const finalDate = selectedDate || currentDate || getCurrentJalaliDate();
    onSave(finalDate);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div 
        className="bg-white rounded-3xl shadow-2xl border border-slate-200/90 w-full max-w-md overflow-hidden text-right select-none animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
        dir="rtl"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white p-4 sm:p-5 relative">
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 left-4 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 text-white flex items-center justify-center transition-all cursor-pointer"
            title="بستن"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-white/20 backdrop-blur-xs flex items-center justify-center shadow-inner shrink-0">
              <CalendarIcon className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-white tracking-tight flex items-center gap-1.5">
                <span>تغییر تاریخ صدور {isProforma ? 'پیش‌فاکتور' : 'فاکتور'}</span>
              </h2>
              <div className="text-xs text-emerald-100 font-medium flex items-center gap-2 mt-0.5">
                {invoiceNumber && (
                  <span>شماره سند: <b className="font-mono text-white">{toPersianDigits(invoiceNumber)}</b></span>
                )}
                {invoiceNumber && <span>•</span>}
                <span>تاریخ قبلی: <b className="font-mono text-white">{toPersianDigits(currentDate)}</b></span>
              </div>
            </div>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-5 space-y-4">
          {/* Quick Preset Buttons */}
          <div>
            <div className="text-[11px] font-bold text-slate-500 mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>دسترسی سریع به تاریخ‌های متداول:</span>
              </span>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() => handleQuickPreset(todayStr)}
                className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                  selectedDate === todayStr
                    ? 'bg-emerald-600 text-white shadow-xs font-black'
                    : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200/60'
                }`}
              >
                امروز
              </button>
              <button
                type="button"
                onClick={() => handleQuickPreset(addDaysToJalali(-1))}
                className={`px-2.5 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                  selectedDate === addDaysToJalali(-1)
                    ? 'bg-emerald-600 text-white shadow-xs font-black'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
                }`}
              >
                دیروز
              </button>
              <button
                type="button"
                onClick={() => handleQuickPreset(addDaysToJalali(-2))}
                className={`px-2.5 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                  selectedDate === addDaysToJalali(-2)
                    ? 'bg-emerald-600 text-white shadow-xs font-black'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
                }`}
              >
                ۲ روز قبل
              </button>
              <button
                type="button"
                onClick={() => handleQuickPreset(addDaysToJalali(-3))}
                className={`px-2.5 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                  selectedDate === addDaysToJalali(-3)
                    ? 'bg-emerald-600 text-white shadow-xs font-black'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
                }`}
              >
                ۳ روز قبل
              </button>
              <button
                type="button"
                onClick={() => handleQuickPreset(addDaysToJalali(-7))}
                className={`px-2.5 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                  selectedDate === addDaysToJalali(-7)
                    ? 'bg-emerald-600 text-white shadow-xs font-black'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
                }`}
              >
                یک هفته قبل
              </button>
              <button
                type="button"
                onClick={() => {
                  const m1 = formatDateStr(viewYear, viewMonth, 1);
                  handleQuickPreset(m1);
                }}
                className="px-2.5 py-1.5 rounded-xl font-bold text-xs bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200 transition-all cursor-pointer"
              >
                اول این ماه
              </button>
            </div>
          </div>

          {/* Interactive Jalali Calendar Card */}
          <div className="bg-slate-50/80 rounded-2xl p-3 border border-slate-200">
            {/* Calendar Month & Year Bar */}
            <div className="flex items-center justify-between mb-3 px-1">
              <button
                type="button"
                onClick={handlePrevMonth}
                className="w-8 h-8 rounded-xl bg-white hover:bg-slate-100 active:scale-95 text-slate-700 flex items-center justify-center transition-all border border-slate-200 cursor-pointer shadow-2xs"
                title="ماه قبل"
              >
                <ChevronRight className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-2 font-bold">
                {/* Month Selector */}
                <select
                  value={viewMonth}
                  onChange={(e) => setViewMonth(Number(e.target.value))}
                  className="bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-2xs"
                >
                  {JALALI_MONTH_NAMES.map((name, idx) => (
                    <option key={idx} value={idx + 1}>
                      {name}
                    </option>
                  ))}
                </select>

                {/* Year Selector */}
                <select
                  value={viewYear}
                  onChange={(e) => setViewYear(Number(e.target.value))}
                  className="bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-bold font-mono text-slate-800 cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-2xs"
                >
                  {availableYears.map((y) => (
                    <option key={y} value={y}>
                      {toPersianDigits(y)}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                onClick={handleNextMonth}
                className="w-8 h-8 rounded-xl bg-white hover:bg-slate-100 active:scale-95 text-slate-700 flex items-center justify-center transition-all border border-slate-200 cursor-pointer shadow-2xs"
                title="ماه بعد"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>

            {/* Weekdays Header */}
            <div className="grid grid-cols-7 gap-1 text-center font-bold text-xs mb-1.5 text-slate-500">
              {WEEKDAYS.map((wd, idx) => (
                <div 
                  key={idx} 
                  className={`py-1 text-[11px] ${wd.isWeekend ? 'text-rose-600 font-black' : ''}`}
                  title={wd.name}
                >
                  {wd.short}
                </div>
              ))}
            </div>

            {/* Days Grid */}
            <div className="grid grid-cols-7 gap-1">
              {/* Offset slots */}
              {Array.from({ length: startWeekday }).map((_, idx) => (
                <div key={`offset-${idx}`} className="h-8" />
              ))}

              {/* Day numbers */}
              {Array.from({ length: daysInMonth }).map((_, idx) => {
                const day = idx + 1;
                const formatted = formatDateStr(viewYear, viewMonth, day);
                const isSelected = selectedDate === formatted;
                const isToday = todayStr === formatted;
                const weekdayIndex = (startWeekday + idx) % 7;
                const isFriday = weekdayIndex === 6;

                return (
                  <button
                    key={`day-${day}`}
                    type="button"
                    onClick={() => handleDayClick(day)}
                    className={`h-8 rounded-xl text-xs font-bold font-mono transition-all flex items-center justify-center cursor-pointer relative ${
                      isSelected
                        ? 'bg-emerald-600 text-white font-black shadow-md scale-105 z-10'
                        : isToday
                        ? 'bg-emerald-100 text-emerald-900 border border-emerald-400 font-black hover:bg-emerald-200'
                        : isFriday
                        ? 'bg-white text-rose-600 hover:bg-rose-50 border border-slate-100'
                        : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-100'
                    }`}
                  >
                    {toPersianDigits(day)}
                    {isToday && !isSelected && (
                      <span className="w-1 h-1 rounded-full bg-emerald-600 absolute bottom-1" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Selected Date Summary & Manual Input */}
          <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-3 flex flex-col sm:flex-row items-center justify-between gap-2.5">
            <div className="text-right w-full sm:w-auto">
              <span className="text-[10px] font-bold text-emerald-800 block">تاریخ انتخابی برای ثبت سند:</span>
              <span className="text-xs sm:text-sm font-black text-emerald-950 flex items-center gap-1.5 mt-0.5">
                <Clock className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>{selectedDatePersianDetails}</span>
              </span>
            </div>

            <div className="w-full sm:w-36 shrink-0">
              <label className="text-[10px] text-slate-500 font-bold block mb-0.5 sm:text-left">
                ورود دستی:
              </label>
              <input
                type="text"
                value={inputVal}
                onChange={(e) => handleInputChange(e.target.value)}
                placeholder="۱۴۰۳/۰۷/۲۱"
                dir="ltr"
                className="w-full h-8 px-2.5 rounded-xl border border-slate-300 bg-white font-mono font-bold text-center text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="bg-slate-50 p-4 border-t border-slate-200 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 active:scale-95 text-slate-700 font-bold text-xs transition-all cursor-pointer"
          >
            انصراف
          </button>

          <button
            type="button"
            onClick={handleConfirm}
            className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-black text-xs transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
          >
            <Check className="w-4 h-4 stroke-[2.5]" />
            <span>تأیید و اعمال تاریخ</span>
          </button>
        </div>
      </div>
    </div>
  );
};
