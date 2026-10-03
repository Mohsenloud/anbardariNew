import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Calendar as CalendarIcon, 
  ChevronRight, 
  ChevronLeft, 
  RotateCcw, 
  Check, 
  X, 
  CalendarDays
} from 'lucide-react';
import { 
  getCurrentJalaliDate, 
  addDaysToJalali, 
  toPersianDigits, 
  toEnglishDigits, 
  JALALI_MONTH_NAMES, 
  getJalaliMonthDays, 
  getJalaliMonthStartWeekday 
} from '../utils/jalali';

interface JalaliDatePickerProps {
  value: string;
  onChange: (newValue: string) => void;
  label?: string;
  placeholder?: string;
  required?: boolean;
  className?: string;
  buttonClassName?: string;
}

export const JalaliDatePicker: React.FC<JalaliDatePickerProps> = ({
  value,
  onChange,
  label,
  placeholder = '۱۴۰۳/۰۷/۱۲',
  required = false,
  className = '',
  buttonClassName = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Parse current value
  const parsedDate = useMemo(() => {
    const clean = toEnglishDigits(value || '').trim();
    const parts = clean.split('/').map(Number);
    const today = getCurrentJalaliDate().split('/').map(Number);
    
    const y = parts[0] && parts[0] >= 1350 && parts[0] <= 1450 ? parts[0] : today[0];
    const m = parts[1] && parts[1] >= 1 && parts[1] <= 12 ? parts[1] : today[1];
    const d = parts[2] && parts[2] >= 1 && parts[2] <= 31 ? parts[2] : today[2];

    return { year: y, month: m, day: d };
  }, [value]);

  // View state for browsing months/years in the calendar
  const [viewYear, setViewYear] = useState<number>(parsedDate.year);
  const [viewMonth, setViewMonth] = useState<number>(parsedDate.month);

  // Sync view when opened or when value changes
  useEffect(() => {
    if (isOpen) {
      setViewYear(parsedDate.year);
      setViewMonth(parsedDate.month);
    }
  }, [isOpen, parsedDate.year, parsedDate.month]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Today's Jalali date
  const todayStr = useMemo(() => getCurrentJalaliDate(), []);
  const todayParts = useMemo(() => todayStr.split('/').map(Number), [todayStr]);

  // Number of days in current view month
  const daysInMonth = useMemo(() => getJalaliMonthDays(viewYear, viewMonth), [viewYear, viewMonth]);

  // Day offset for the 1st day of the month (0 = شنبه, ..., 6 = جمعه)
  const startWeekday = useMemo(() => getJalaliMonthStartWeekday(viewYear, viewMonth), [viewYear, viewMonth]);

  // Set specific date
  const handleSelectDate = (y: number, m: number, d: number) => {
    const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
    const formatted = `${y}/${pad(m)}/${pad(d)}`;
    onChange(formatted);
    setIsOpen(false);
  };

  // Quick preset selections
  const handleSelectToday = () => {
    onChange(todayStr);
    setIsOpen(false);
  };

  const handleSelectYesterday = () => {
    onChange(addDaysToJalali(-1));
    setIsOpen(false);
  };

  const handleSelectDaysAgo = (days: number) => {
    onChange(addDaysToJalali(-days));
    setIsOpen(false);
  };

  // Month navigation
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

  // Generate array of years for selector
  const availableYears = useMemo(() => {
    const currentY = todayParts[0] || 1403;
    const years: number[] = [];
    for (let y = currentY - 5; y <= currentY + 3; y++) {
      years.push(y);
    }
    return years;
  }, [todayParts]);

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {label && (
        <div className="h-5 flex items-center justify-between mb-1.5">
          <label className="text-xs font-black text-slate-800 flex items-center gap-1">
            <CalendarIcon className="w-3.5 h-3.5 text-slate-400" />
            <span>{label}</span>
            {required && <span className="text-rose-600">*</span>}
          </label>
        </div>
      )}

      {/* Input Trigger */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={`w-full h-10 bg-white border border-slate-300 rounded-xl px-3 text-xs sm:text-sm font-mono font-bold text-slate-800 text-left focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all flex items-center justify-between cursor-pointer shadow-2xs hover:border-slate-400 ${buttonClassName} ${
            isOpen ? 'ring-2 ring-emerald-500/20 border-emerald-500' : ''
          }`}
        >
          <span className="font-mono text-slate-900 tracking-wider">
            {value ? toPersianDigits(value) : placeholder}
          </span>
          <CalendarDays className="w-4 h-4 text-emerald-600 shrink-0" />
        </button>
      </div>

      {/* Popover Calendar */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-1.5 w-72 sm:w-80 bg-white rounded-2xl shadow-2xl border border-slate-200 z-50 p-3 text-xs animate-in fade-in zoom-in-95 duration-100 select-none">
          {/* Quick Presets Bar */}
          <div className="flex items-center gap-1 pb-2.5 mb-2 border-b border-slate-100 overflow-x-auto">
            <button
              type="button"
              onClick={handleSelectToday}
              className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all cursor-pointer whitespace-nowrap ${
                value === todayStr
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
              }`}
            >
              امروز
            </button>
            <button
              type="button"
              onClick={handleSelectYesterday}
              className="px-2.5 py-1 rounded-lg font-bold text-[11px] bg-slate-100 text-slate-700 hover:bg-slate-200 transition-all cursor-pointer whitespace-nowrap"
            >
              دیروز
            </button>
            <button
              type="button"
              onClick={() => handleSelectDaysAgo(2)}
              className="px-2 py-1 rounded-lg font-medium text-[11px] bg-slate-50 text-slate-600 hover:bg-slate-100 transition-all cursor-pointer whitespace-nowrap"
            >
              ۲ روز قبل
            </button>
            <button
              type="button"
              onClick={() => handleSelectDaysAgo(7)}
              className="px-2 py-1 rounded-lg font-medium text-[11px] bg-slate-50 text-slate-600 hover:bg-slate-100 transition-all cursor-pointer whitespace-nowrap"
            >
              یک هفته قبل
            </button>
          </div>

          {/* Month & Year Navigation Header */}
          <div className="flex items-center justify-between mb-3 px-1">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
              title="ماه قبل"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-1.5 font-bold">
              {/* Month Selector */}
              <select
                value={viewMonth}
                onChange={(e) => setViewMonth(Number(e.target.value))}
                className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold text-slate-800 cursor-pointer focus:outline-none focus:ring-1 focus:ring-emerald-500"
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
                className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold font-mono text-slate-800 cursor-pointer focus:outline-none focus:ring-1 focus:ring-emerald-500"
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
              className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
              title="ماه بعد"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>

          {/* Weekday Names Header (شنبه تا جمعه) */}
          <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-slate-400 mb-1 border-b border-slate-100 pb-1">
            <span>ش</span>
            <span>ی</span>
            <span>د</span>
            <span>س</span>
            <span>چ</span>
            <span>پ</span>
            <span className="text-rose-500">ج</span>
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-1 text-center">
            {/* Empty offset spaces before 1st of month */}
            {Array.from({ length: startWeekday }).map((_, i) => (
              <div key={`empty-${i}`} className="w-7 h-7 sm:w-8 sm:h-8" />
            ))}

            {/* Days of current month */}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const dayNum = i + 1;
              const isSelected =
                parsedDate.year === viewYear &&
                parsedDate.month === viewMonth &&
                parsedDate.day === dayNum;
              const isToday =
                todayParts[0] === viewYear &&
                todayParts[1] === viewMonth &&
                todayParts[2] === dayNum;
              const dayOfWeek = (startWeekday + i) % 7;
              const isFriday = dayOfWeek === 6;

              return (
                <button
                  key={dayNum}
                  type="button"
                  onClick={() => handleSelectDate(viewYear, viewMonth, dayNum)}
                  className={`w-7 h-7 sm:w-8 sm:h-8 rounded-xl font-mono text-xs font-bold transition-all flex items-center justify-center cursor-pointer ${
                    isSelected
                      ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30 font-black scale-105'
                      : isToday
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-400 font-black'
                      : isFriday
                      ? 'text-rose-600 hover:bg-rose-50'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {toPersianDigits(dayNum)}
                </button>
              );
            })}
          </div>

          {/* Direct Manual Entry Footer */}
          <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
            <span className="text-slate-400">تاریخ انتخابی:</span>
            <span className="font-mono font-black text-emerald-800">
              {toPersianDigits(value)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
