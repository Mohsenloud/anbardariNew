import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Calendar,
  Clock,
  ChevronRight,
  ChevronLeft,
  SlidersHorizontal,
  RotateCcw,
  Check,
  X,
  Zap
} from 'lucide-react';
import {
  getCurrentJalaliDate,
  getCurrentJalaliTime,
  addDaysToJalali,
  toPersianDigits,
  toEnglishDigits,
  JALALI_MONTH_NAMES,
  getJalaliMonthDays,
  stepJalaliDate,
  stepTimeMinutes,
  parseDeliveryDateTime,
  formatDeliveryDateTime
} from '../utils/jalali';

interface DeliveryDateTimePickerProps {
  value: string;
  onChange: (newValue: string) => void;
  disabled?: boolean;
}

export const DeliveryDateTimePicker: React.FC<DeliveryDateTimePickerProps> = ({
  value,
  onChange,
  disabled = false,
}) => {
  const parsed = useMemo(() => parseDeliveryDateTime(value), [value]);

  const [currentDate, setCurrentDate] = useState<string>(parsed.date);
  const [currentTime, setCurrentTime] = useState<string>(parsed.time);
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [isDirectTyping, setIsDirectTyping] = useState<boolean>(false);
  const [rawInputText, setRawInputText] = useState<string>(value);

  // Sync internal state when external value changes
  useEffect(() => {
    const p = parseDeliveryDateTime(value);
    setCurrentDate(p.date);
    setCurrentTime(p.time);
    setRawInputText(value);
  }, [value]);

  // Extract year, month, day
  const [year, month, day] = useMemo(() => {
    const parts = toEnglishDigits(currentDate).split('/').map(Number);
    const y = parts[0] || 1403;
    const m = parts[1] || 1;
    const d = parts[2] || 1;
    return [y, m, d];
  }, [currentDate]);

  // Extract hour and minute
  const [hour, minute] = useMemo(() => {
    const parts = toEnglishDigits(currentTime).split(':').map(Number);
    const h = isNaN(parts[0]) ? 12 : parts[0];
    const m = isNaN(parts[1]) ? 0 : parts[1];
    return [h, m];
  }, [currentTime]);

  const daysInCurrentMonth = useMemo(() => getJalaliMonthDays(year, month), [year, month]);

  const updateDateTime = (newDate: string, newTime: string) => {
    setCurrentDate(newDate);
    setCurrentTime(newTime);
    const formatted = formatDeliveryDateTime(newDate, newTime);
    setRawInputText(formatted);
    onChange(formatted);
  };

  const handleSetDate = (newDate: string) => {
    updateDateTime(newDate, currentTime);
  };

  const handleSetTime = (newTime: string) => {
    updateDateTime(currentDate, newTime);
  };

  const handleResetToNow = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const today = getCurrentJalaliDate();
    const nowTime = getCurrentJalaliTime();
    updateDateTime(today, nowTime);
  };

  const handleStepDay = (delta: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const nextDate = stepJalaliDate(currentDate, delta);
    handleSetDate(nextDate);
  };

  const handleStepMinutes = (delta: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const nextTime = stepTimeMinutes(currentTime, delta);
    handleSetTime(nextTime);
  };

  const todayDate = getCurrentJalaliDate();
  const yesterdayDate = addDaysToJalali(-1);
  const tomorrowDate = addDaysToJalali(1);

  return (
    <div className="space-y-1.5 font-['Vazirmatn'] text-xs">
      {/* 1. Header with Label & Instant 1-Click Chips */}
      <div className="flex items-center justify-between mb-1 gap-1">
        <label className="font-bold text-slate-700 flex items-center gap-1 text-xs shrink-0">
          <Calendar className="w-3.5 h-3.5 text-blue-600" />
          <span>تاریخ و زمان تحویل</span>
        </label>

        {/* Quick action buttons in header - zero clutter */}
        <div className="flex items-center gap-1 flex-wrap">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleSetDate(todayDate);
            }}
            className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer ${
              currentDate === todayDate
                ? 'bg-blue-600 text-white shadow-2xs'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
            }`}
            title="تنظیم تاریخ به امروز"
          >
            امروز
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleSetDate(yesterdayDate);
            }}
            className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer ${
              currentDate === yesterdayDate
                ? 'bg-blue-600 text-white shadow-2xs'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
            }`}
            title="تنظیم تاریخ به دیروز"
          >
            دیروز
          </button>

          <button
            type="button"
            onClick={handleResetToNow}
            className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 flex items-center gap-0.5 transition-all cursor-pointer"
            title="تنظیم خودکار به تاریخ و ساعت اکنون"
          >
            <Zap className="w-2.5 h-2.5 text-amber-600 fill-amber-500" />
            <span>اکنون</span>
          </button>
        </div>
      </div>

      {/* 2. Main Sleek Input Bar (takes standard single-input height) */}
      <div className="flex items-center gap-1">
        {/* Date Stepper: Previous Day (◀) */}
        <button
          type="button"
          onClick={(e) => handleStepDay(-1, e)}
          disabled={disabled}
          className="p-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-blue-600 transition-all cursor-pointer shrink-0"
          title="یک روز قبل"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>

        {/* Display / Editable Field */}
        <div className="relative flex-1">
          {isDirectTyping ? (
            <input
              type="text"
              value={rawInputText}
              onChange={(e) => {
                setRawInputText(e.target.value);
                onChange(e.target.value);
              }}
              onBlur={() => setIsDirectTyping(false)}
              autoFocus
              className="w-full px-2.5 py-1.5 bg-white border border-blue-400 rounded-lg text-xs font-['Vazirmatn'] text-slate-800 focus:outline-hidden"
              placeholder="۱۴۰۳/۰۷/۰۴ - ساعت ۱۴:۳۰"
            />
          ) : (
            <div
              onClick={() => setIsExpanded(!isExpanded)}
              className="w-full px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100/90 border border-slate-200 rounded-lg transition-all cursor-pointer flex items-center justify-between gap-1 select-none"
              title="کلیک برای تنظیم دقیق‌تر تاریخ و ساعت"
            >
              <div className="flex items-center gap-1.5 truncate">
                <Clock className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                <span className="font-['Vazirmatn'] font-bold text-slate-800 text-xs truncate">
                  {toPersianDigits(currentDate)} - ساعت {toPersianDigits(currentTime)}
                </span>
                {parsed.relativeLabel && (
                  <span className="text-[10px] bg-blue-100 text-blue-800 font-bold px-1.5 py-0.2 rounded-md shrink-0">
                    {parsed.relativeLabel}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Date Stepper: Next Day (▶) */}
        <button
          type="button"
          onClick={(e) => handleStepDay(1, e)}
          disabled={disabled}
          className="p-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-blue-600 transition-all cursor-pointer shrink-0"
          title="یک روز بعد"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>

        {/* Settings / Expand Toggle Button */}
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className={`p-1.5 rounded-lg border transition-all cursor-pointer shrink-0 flex items-center gap-1 ${
            isExpanded
              ? 'bg-blue-600 text-white border-blue-600'
              : 'bg-white hover:bg-slate-100 text-slate-600 border-slate-200'
          }`}
          title={isExpanded ? 'بستن تنظیمات' : 'تنظیم روز، ماه یا ساعت'}
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* 3. Collapsible Compact Adjuster Panel (Opens only when user clicks icon) */}
      {isExpanded && (
        <div className="p-2.5 bg-white border border-blue-200 rounded-xl shadow-xs space-y-2 animate-fadeIn">
          {/* Header of Drawer */}
          <div className="flex items-center justify-between border-b border-slate-100 pb-1.5 text-[11px]">
            <span className="font-bold text-slate-800 flex items-center gap-1">
              <span>تنظیم دقیق تاریخ و ساعت تحویل</span>
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  setIsDirectTyping(true);
                  setIsExpanded(false);
                }}
                className="text-[10px] text-blue-600 hover:underline cursor-pointer"
              >
                تایپ دستی
              </button>
              <span>•</span>
              <button
                type="button"
                onClick={() => setIsExpanded(false)}
                className="p-0.5 text-slate-400 hover:text-slate-700 cursor-pointer"
                title="بستن"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* Row 1: Date Selectors (Day, Month, Year) */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-bold text-slate-500">تاریخ شمسی:</span>
              <div className="flex gap-1 text-[10px]">
                <button
                  type="button"
                  onClick={() => handleSetDate(tomorrowDate)}
                  className="text-slate-500 hover:text-blue-600 hover:underline cursor-pointer"
                >
                  فردا
                </button>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-1">
              <select
                value={day}
                onChange={(e) => {
                  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
                  handleSetDate(`${year}/${pad(month)}/${pad(Number(e.target.value))}`);
                }}
                className="px-1.5 py-1 bg-slate-50 border border-slate-200 rounded text-xs font-bold text-slate-800 cursor-pointer"
              >
                {Array.from({ length: daysInCurrentMonth }, (_, i) => i + 1).map((d) => (
                  <option key={d} value={d}>
                    روز {toPersianDigits(d)}
                  </option>
                ))}
              </select>

              <select
                value={month}
                onChange={(e) => {
                  const newM = Number(e.target.value);
                  const maxD = getJalaliMonthDays(year, newM);
                  const validD = Math.min(day, maxD);
                  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
                  handleSetDate(`${year}/${pad(newM)}/${pad(validD)}`);
                }}
                className="px-1.5 py-1 bg-slate-50 border border-slate-200 rounded text-xs font-bold text-slate-800 cursor-pointer"
              >
                {JALALI_MONTH_NAMES.map((name, idx) => (
                  <option key={idx + 1} value={idx + 1}>
                    {name}
                  </option>
                ))}
              </select>

              <select
                value={year}
                onChange={(e) => {
                  const newY = Number(e.target.value);
                  const maxD = getJalaliMonthDays(newY, month);
                  const validD = Math.min(day, maxD);
                  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
                  handleSetDate(`${newY}/${pad(month)}/${pad(validD)}`);
                }}
                className="px-1.5 py-1 bg-slate-50 border border-slate-200 rounded text-xs font-bold text-slate-800 cursor-pointer"
              >
                {[1402, 1403, 1404, 1405, 1406, 1407].map((y) => (
                  <option key={y} value={y}>
                    {toPersianDigits(y)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Row 2: Time Selectors (Hour, Minute) & Quick Stepper */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-bold text-slate-500">ساعت و دقیقه:</span>
              <div className="flex items-center gap-1 text-[10px]">
                <button
                  type="button"
                  onClick={(e) => handleStepMinutes(-15, e)}
                  className="px-1 py-0.2 bg-slate-100 hover:bg-slate-200 rounded text-slate-600"
                >
                  -۱۵ دقیقه
                </button>
                <button
                  type="button"
                  onClick={(e) => handleStepMinutes(15, e)}
                  className="px-1 py-0.2 bg-slate-100 hover:bg-slate-200 rounded text-slate-600"
                >
                  +۱۵ دقیقه
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-1.5 items-center">
              <select
                value={hour}
                onChange={(e) => {
                  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
                  handleSetTime(`${pad(Number(e.target.value))}:${pad(minute)}`);
                }}
                className="px-1.5 py-1 bg-slate-50 border border-slate-200 rounded text-xs font-bold text-slate-800 cursor-pointer"
              >
                {Array.from({ length: 24 }, (_, i) => i).map((h) => {
                  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
                  return (
                    <option key={h} value={h}>
                      ساعت {toPersianDigits(pad(h))}
                    </option>
                  );
                })}
              </select>

              <select
                value={minute}
                onChange={(e) => {
                  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
                  handleSetTime(`${pad(hour)}:${pad(Number(e.target.value))}`);
                }}
                className="px-1.5 py-1 bg-slate-50 border border-slate-200 rounded text-xs font-bold text-slate-800 cursor-pointer"
              >
                {Array.from({ length: 12 }, (_, i) => i * 5)
                  .concat(minute % 5 !== 0 ? [minute] : [])
                  .sort((a, b) => a - b)
                  .map((m) => {
                    const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
                    return (
                      <option key={m} value={m}>
                        دقیقه {toPersianDigits(pad(m))}
                      </option>
                    );
                  })}
              </select>
            </div>
          </div>

          {/* Quick Time Presets Strip */}
          <div className="flex flex-wrap gap-1 pt-1 border-t border-slate-100 items-center">
            <span className="text-[9.5px] text-slate-400">ساعات رایج:</span>
            {[
              { label: '۰۹:۰۰', t: '09:00' },
              { label: '۱۲:۰۰', t: '12:00' },
              { label: '۱۵:۰۰', t: '15:00' },
              { label: '۱۸:۰۰', t: '18:00' },
            ].map((preset) => (
              <button
                key={preset.t}
                type="button"
                onClick={() => handleSetTime(preset.t)}
                className={`px-1.5 py-0.2 rounded text-[10px] font-medium transition-all ${
                  currentTime === preset.t
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                }`}
              >
                {toPersianDigits(preset.label)}
              </button>
            ))}

            <button
              type="button"
              onClick={() => setIsExpanded(false)}
              className="mr-auto inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-600 text-white hover:bg-emerald-700 cursor-pointer"
            >
              <Check className="w-2.5 h-2.5" />
              <span>تایید</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
