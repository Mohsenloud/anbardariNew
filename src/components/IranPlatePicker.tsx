import React, { useState, useEffect, useRef } from 'react';
import { Truck, Sparkles, Edit3, Car, Palette, MapPin, X, RotateCcw } from 'lucide-react';
import { toPersianDigits, toEnglishDigits } from '../utils/jalali';

export interface IranPlateData {
  vehicleType: string;
  part1: string;      // 2 digits, e.g. "24"
  letter: string;     // e.g. "ع"
  part2: string;      // 3 digits, e.g. "567"
  iranCode: string;   // 2 digits, e.g. "68"
  colorDesc?: string; // e.g. "آبی"
}

interface IranPlatePickerProps {
  value: string;
  onChange: (formattedVehicleInfo: string) => void;
  customerName?: string;
  placeholder?: string;
}

export const COMMON_LETTERS = [
  { char: 'ع', label: 'ع (عمومی / باری)', isCargo: true },
  { char: 'ب', label: 'ب (شخصی)', isCargo: false },
  { char: 'ج', label: 'ج (شخصی)', isCargo: false },
  { char: 'د', label: 'د (شخصی)', isCargo: false },
  { char: 'س', label: 'س (شخصی)', isCargo: false },
  { char: 'ص', label: 'ص (شخصی)', isCargo: false },
  { char: 'ط', label: 'ط (شخصی)', isCargo: false },
  { char: 'ق', label: 'ق (شخصی)', isCargo: false },
  { char: 'ل', label: 'ل (شخصی)', isCargo: false },
  { char: 'م', label: 'م (شخصی)', isCargo: false },
  { char: 'ن', label: 'ن (شخصی)', isCargo: false },
  { char: 'و', label: 'و (شخصی)', isCargo: false },
  { char: 'هـ', label: 'هـ (شخصی)', isCargo: false },
  { char: 'ی', label: 'ی (شخصی)', isCargo: false },
  { char: 'ت', label: 'ت (تاکسی)', isCargo: false },
  { char: 'الف', label: 'الف (دولتی)', isCargo: false },
];

export const POPULAR_IRAN_CODES = [
  { code: '68', label: 'البرز (کرج) ۶۸' },
  { code: '21', label: 'البرز ۲۱' },
  { code: '11', label: 'تهران ۱۱' },
  { code: '22', label: 'تهران ۲۲' },
  { code: '33', label: 'تهران ۳۳' },
  { code: '13', label: 'اصفهان ۱۳' },
  { code: '12', label: 'مشهد ۱۲' },
  { code: '63', label: 'فارس ۶۳' },
  { code: '14', label: 'خوزستان ۱۴' },
  { code: '15', label: 'تبریز ۱۵' },
  { code: '62', label: 'مازندران ۶۲' },
  { code: '46', label: 'گیلان ۴۶' },
  { code: '16', label: 'قم ۱۶' },
];

export const ALL_IRAN_CODES = [
  { code: '68', label: 'البرز ۶۸ (کرج)' },
  { code: '21', label: 'البرز ۲۱ (کرج/ساوجبلاغ)' },
  { code: '38', label: 'البرز ۳۸ (فردیس/اشتهارد)' },
  { code: '11', label: 'تهران ۱۱ (مرکزی)' },
  { code: '22', label: 'تهران ۲۲ (شرق/غرب)' },
  { code: '33', label: 'تهران ۳۳ (جنوب)' },
  { code: '44', label: 'تهران ۴۴' },
  { code: '55', label: 'تهران ۵۵' },
  { code: '66', label: 'تهران ۶۶' },
  { code: '77', label: 'تهران ۷۷' },
  { code: '88', label: 'تهران ۸۸' },
  { code: '99', label: 'تهران ۹۹' },
  { code: '13', label: 'اصفهان ۱۳' },
  { code: '23', label: 'اصفهان ۲۳' },
  { code: '43', label: 'اصفهان ۴۳' },
  { code: '53', label: 'اصفهان ۵۳' },
  { code: '12', label: 'خراسان رضوی ۱۲ (مشهد)' },
  { code: '32', label: 'خراسان ۳۲ (نیشابور)' },
  { code: '42', label: 'خراسان ۴۲ (سبزوار)' },
  { code: '63', label: 'فارس ۶۳ (شیراز)' },
  { code: '73', label: 'فارس ۷۳ (مرودشت)' },
  { code: '83', label: 'فارس ۸۳ (کازرون)' },
  { code: '14', label: 'خوزستان ۱۴ (اهواز)' },
  { code: '24', label: 'خوزستان ۲۴' },
  { code: '15', label: 'آذربایجان شرقی ۱۵ (تبریز)' },
  { code: '25', label: 'آذربایجان شرقی ۲۵' },
  { code: '17', label: 'آذربایجان غربی ۱۷ (ارومیه)' },
  { code: '27', label: 'آذربایجان غربی ۲۷' },
  { code: '62', label: 'مازندران ۶۲ (ساری)' },
  { code: '72', label: 'مازندران ۷۲ (بابل)' },
  { code: '82', label: 'مازندران ۸۲ (تنکابن)' },
  { code: '46', label: 'گیلان ۴۶ (رشت)' },
  { code: '56', label: 'گیلان ۵۶' },
  { code: '16', label: 'قم ۱۶' },
  { code: '18', label: 'همدان ۱۸' },
  { code: '19', label: 'کرمانشاه ۱۹' },
  { code: '45', label: 'کرمان ۴۵' },
  { code: '54', label: 'یزد ۵۴' },
  { code: '47', label: 'مرکزی ۴۷ (اراک)' },
  { code: '59', label: 'گلستان ۵۹ (گرگان)' },
  { code: '79', label: 'قزوین ۷۹' },
  { code: '86', label: 'سمنان ۸۶' },
  { code: '84', label: 'هرمزگان ۸۴ (بندرعباس)' },
  { code: '85', label: 'سیستان و بلوچستان ۸۵ (زاهدان)' },
  { code: '98', label: 'ایلام ۹۸' },
  { code: '31', label: 'لرستان ۳۱ (خرم‌آباد)' },
  { code: '51', label: 'کردستان ۵۱ (سنندج)' },
  { code: '91', label: 'اردبیل ۹۱' },
  { code: '87', label: 'زنجان ۸۷' },
  { code: '71', label: 'چهارمحال و بختیاری ۷۱' },
  { code: '49', label: 'کهگیلویه و بویراحمد ۴۹' },
  { code: '58', label: 'بوشهر ۵۸' },
  { code: '26', label: 'خراسان شمالی ۲۶' },
  { code: '52', label: 'خراسان جنوبی ۵۲' },
];

export const VEHICLE_TYPES = [
  'وانت نیسان',
  'خاور / ایسوزو',
  'وانت پراید',
  'وانت آریسان',
  'وانت مزدا / پیکان',
  'کامیون ۶ چرخ (تک)',
  'کامیون ۱۰ چرخ (جفت)',
  'تریلی / کفی',
  'سواری شخصی مشتری',
  'پیک موتوری',
  'سایر / دستی',
];

export const COLOR_PRESETS = ['آبی', 'سفید', 'مشکی', 'نقره‌ای', 'کرم', 'زرد', 'قرمز', 'اتاق‌دار', 'کفی'];

// Parse an existing vehicle info string into plate segments
export function parseVehicleInfo(text: string): {
  vehicleType: string;
  part1: string;
  letter: string;
  part2: string;
  iranCode: string;
  colorDesc: string;
  isFreeText: boolean;
} {
  if (!text || !text.trim()) {
    return {
      vehicleType: 'وانت نیسان',
      part1: '',
      letter: 'ع',
      part2: '',
      iranCode: '68',
      colorDesc: '',
      isFreeText: false,
    };
  }

  const enText = toEnglishDigits(text);

  // Attempt pattern 1: 24 ع 567 ایران 68 (or 24 - ع - 567)
  const pattern1 = enText.match(/(\d{2})\s*([آ-یa-zA-Zء-ي]{1,3})\s*(\d{3})\s*(?:ایران|iran|-)?\s*(\d{2})/i);
  // Attempt pattern 2: ایران 68 - 567 ع 24
  const pattern2 = enText.match(/(?:ایران|iran|-)?\s*(\d{2})\s*[-–\s]*(\d{3})\s*([آ-یa-zA-Zء-ي]{1,3})\s*(\d{2})/i);

  let vehicleType = 'وانت نیسان';
  for (const vt of VEHICLE_TYPES) {
    if (vt !== 'سایر / دستی' && text.includes(vt)) {
      vehicleType = vt;
      break;
    }
  }

  let colorDesc = '';
  for (const c of COLOR_PRESETS) {
    if (text.includes(c)) {
      colorDesc = c;
      break;
    }
  }

  if (pattern1) {
    return {
      vehicleType,
      part1: pattern1[1],
      letter: pattern1[2].trim(),
      part2: pattern1[3],
      iranCode: pattern1[4],
      colorDesc,
      isFreeText: false,
    };
  }

  if (pattern2) {
    return {
      vehicleType,
      part1: pattern2[4],
      letter: pattern2[3].trim(),
      part2: pattern2[2],
      iranCode: pattern2[1],
      colorDesc,
      isFreeText: false,
    };
  }

  return {
    vehicleType: 'سایر / دستی',
    part1: '',
    letter: 'ع',
    part2: '',
    iranCode: '68',
    colorDesc,
    isFreeText: true,
  };
}

export const IranPlatePicker: React.FC<IranPlatePickerProps> = ({ 
  value, 
  onChange, 
  placeholder 
}) => {
  const parsed = parseVehicleInfo(value);

  const [isFreeText, setIsFreeText] = useState<boolean>(parsed.isFreeText);
  const [vehicleType, setVehicleType] = useState<string>(parsed.vehicleType);
  const [customVehicleType, setCustomVehicleType] = useState<string>('');
  const [part1, setPart1] = useState<string>(parsed.part1);
  const [letter, setLetter] = useState<string>(parsed.letter || 'ع');
  const [part2, setPart2] = useState<string>(parsed.part2);
  const [iranCode, setIranCode] = useState<string>(parsed.iranCode || '68');
  const [colorDesc, setColorDesc] = useState<string>(parsed.colorDesc);
  const [freeTextValue, setFreeTextValue] = useState<string>(value);

  const [showCityPicker, setShowCityPicker] = useState<boolean>(false);

  const part1Ref = useRef<HTMLInputElement>(null);
  const part2Ref = useRef<HTMLInputElement>(null);
  const iranCodeRef = useRef<HTMLInputElement>(null);
  const lastEmittedValueRef = useRef<string>(value);

  // Sync internal states when external `value` changes
  useEffect(() => {
    if (value === lastEmittedValueRef.current) {
      return;
    }
    lastEmittedValueRef.current = value;
    const p = parseVehicleInfo(value);
    if (!value || value.trim() === '') {
      return;
    }
    if (p.isFreeText) {
      setFreeTextValue(value);
      setIsFreeText(true);
    } else {
      setIsFreeText(false);
      setVehicleType(p.vehicleType);
      setPart1(p.part1);
      setLetter(p.letter);
      setPart2(p.part2);
      setIranCode(p.iranCode);
      setColorDesc(p.colorDesc);
    }
  }, [value]);

  // Construct formatted vehicle string
  const emitFormattedValue = (
    vType: string,
    p1: string,
    lettr: string,
    p2: string,
    iCode: string,
    col: string,
    customType?: string
  ) => {
    const cleanP1 = toEnglishDigits(p1).trim();
    const cleanP2 = toEnglishDigits(p2).trim();
    const cleanICode = toEnglishDigits(iCode).trim();

    let plateStr = '';
    if (cleanP1 || cleanP2 || cleanICode) {
      const displayP1 = cleanP1 ? toPersianDigits(cleanP1) : '••';
      const displayP2 = cleanP2 ? toPersianDigits(cleanP2) : '•••';
      const displayICode = cleanICode ? toPersianDigits(cleanICode) : '••';
      plateStr = `پلاک: ${displayP1} ${lettr} ${displayP2} ایران ${displayICode}`;
    }

    const typeDesc = (vType === 'سایر / دستی' && customType) ? customType : (vType === 'سایر / دستی' ? '' : vType);
    const parts = [
      typeDesc,
      col ? `(${col})` : '',
      plateStr
    ].filter(Boolean);

    const result = parts.join(' - ');
    lastEmittedValueRef.current = result;
    onChange(result);
  };

  const handlePart1Change = (val: string) => {
    const en = toEnglishDigits(val).replace(/\D/g, '').slice(0, 2);
    setPart1(en);
    emitFormattedValue(vehicleType, en, letter, part2, iranCode, colorDesc, customVehicleType);
    if (en.length === 2) {
      part2Ref.current?.focus();
    }
  };

  const handleLetterChange = (newLetter: string) => {
    setLetter(newLetter);
    emitFormattedValue(vehicleType, part1, newLetter, part2, iranCode, colorDesc, customVehicleType);
  };

  const handlePart2Change = (val: string) => {
    const en = toEnglishDigits(val).replace(/\D/g, '').slice(0, 3);
    setPart2(en);
    emitFormattedValue(vehicleType, part1, letter, en, iranCode, colorDesc, customVehicleType);
    if (en.length === 3) {
      iranCodeRef.current?.focus();
    }
  };

  const handleIranCodeChange = (val: string) => {
    const en = toEnglishDigits(val).replace(/\D/g, '').slice(0, 2);
    setIranCode(en);
    emitFormattedValue(vehicleType, part1, letter, part2, en, colorDesc, customVehicleType);
  };

  const handleVehicleTypeSelect = (vt: string) => {
    setVehicleType(vt);
    emitFormattedValue(vt, part1, letter, part2, iranCode, colorDesc, customVehicleType);
  };

  const handleColorToggle = (col: string) => {
    const nextCol = colorDesc === col ? '' : col;
    setColorDesc(nextCol);
    emitFormattedValue(vehicleType, part1, letter, part2, iranCode, nextCol, customVehicleType);
  };

  const handleReset = () => {
    setPart1('');
    setPart2('');
    setLetter('ع');
    setIranCode('68');
    setColorDesc('');
    setVehicleType('وانت نیسان');
    setCustomVehicleType('');
    emitFormattedValue('وانت نیسان', '', 'ع', '', '68', '', '');
  };

  const isYellowPlate = letter === 'ع' || letter === 'ت';

  return (
    <div className="bg-slate-50/70 border border-slate-200/80 rounded-xl p-2 sm:p-2.5 space-y-2 transition-all">
      {/* 1. TOP COMPACT BAR: Vehicle Type + Color + Mode Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-1.5 pb-1.5 border-b border-slate-200/60">
        <div className="flex flex-wrap items-center gap-1.5 flex-1 min-w-[200px]">
          {/* Vehicle Type Dropdown */}
          <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg px-2 py-0.5 shadow-2xs">
            <Truck className="w-3.5 h-3.5 text-blue-600 shrink-0" />
            <select
              value={vehicleType}
              onChange={(e) => handleVehicleTypeSelect(e.target.value)}
              className="text-xs font-bold text-slate-800 bg-transparent border-0 focus:outline-hidden cursor-pointer pr-0.5"
            >
              {VEHICLE_TYPES.map((vt) => (
                <option key={vt} value={vt}>{vt}</option>
              ))}
            </select>
          </div>

          {/* If "سایر / دستی" is chosen, show a small custom text box */}
          {vehicleType === 'سایر / دستی' && (
            <input
              type="text"
              placeholder="مدل خودرو (مثلاً بنز ده تن)..."
              value={customVehicleType}
              onChange={(e) => {
                setCustomVehicleType(e.target.value);
                emitFormattedValue(vehicleType, part1, letter, part2, iranCode, colorDesc, e.target.value);
              }}
              className="text-xs font-semibold bg-white border border-slate-200 rounded-lg px-2 py-0.5 text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-blue-500 w-32"
            />
          )}

          {/* Color Selector Dropdown */}
          <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg px-2 py-0.5 shadow-2xs">
            <Palette className="w-3 h-3 text-slate-400 shrink-0" />
            <select
              value={colorDesc}
              onChange={(e) => handleColorToggle(e.target.value)}
              className="text-xs text-slate-700 bg-transparent border-0 focus:outline-hidden cursor-pointer pr-0.5"
            >
              <option value="">رنگ...</option>
              {COLOR_PRESETS.map((col) => (
                <option key={col} value={col}>{col}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Action Toggle: Structured Plate vs Free text */}
        <button
          type="button"
          onClick={() => {
            if (!isFreeText) {
              setFreeTextValue(value);
              setIsFreeText(true);
            } else {
              setIsFreeText(false);
              emitFormattedValue(vehicleType, part1, letter, part2, iranCode, colorDesc, customVehicleType);
            }
          }}
          className="text-[11px] text-slate-600 hover:text-blue-700 font-medium flex items-center gap-1 cursor-pointer bg-white px-2 py-0.5 rounded-lg border border-slate-200 hover:border-blue-300 transition-all shadow-2xs shrink-0"
        >
          {isFreeText ? (
            <>
              <Sparkles className="w-3 h-3 text-blue-600" />
              <span>پلاک‌ساز گرافیکی</span>
            </>
          ) : (
            <>
              <Edit3 className="w-3 h-3 text-slate-400" />
              <span>تایپ دستی</span>
            </>
          )}
        </button>
      </div>

      {isFreeText ? (
        /* Manual Free Text Mode (Compact & Clean) */
        <div>
          <input
            type="text"
            value={freeTextValue}
            onChange={(e) => {
              setFreeTextValue(e.target.value);
              onChange(e.target.value);
            }}
            placeholder={placeholder || "مثال: وانت نیسان آبی - پلاک ۲۴ ع ۵۶۷ ایران ۶۸"}
            className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-blue-500 text-xs font-medium text-slate-900 shadow-2xs"
          />
        </div>
      ) : (
        /* 2. COMPACT & HIGH-LEGIBILITY REALISTIC IRANIAN PLATE */
        <div className="space-y-1.5">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
            {/* The Authentic Iranian Plate Box */}
            <div 
              className={`w-full max-w-[320px] sm:max-w-[340px] h-[44px] rounded-lg border-2 border-slate-900 shadow-2xs flex items-stretch select-none transition-all ${
                isYellowPlate 
                  ? 'bg-amber-400 text-slate-950 ring-1 ring-amber-500/40' 
                  : 'bg-white text-slate-900'
              }`}
              dir="ltr"
            >
              {/* Left Blue Flag Strip (IRAN Standard) */}
              <div className="bg-blue-900 text-white w-7 sm:w-8 rounded-l-[6px] flex flex-col items-center justify-between py-1 px-0.5 shrink-0 select-none">
                {/* Miniature Iranian Flag */}
                <div className="w-4 h-2.5 rounded-[1px] overflow-hidden flex flex-col border border-white/50 shadow-2xs">
                  <div className="bg-emerald-600 h-1/3 w-full" />
                  <div className="bg-white h-1/3 w-full flex items-center justify-center">
                    <div className="w-0.5 h-0.5 bg-red-600 rounded-full" />
                  </div>
                  <div className="bg-rose-600 h-1/3 w-full" />
                </div>

                <div className="text-[6px] font-black tracking-tighter text-center leading-none text-white/95">
                  <div>I.R.</div>
                  <div>IRAN</div>
                </div>
              </div>

              {/* Central Plate Characters (2 Digits - Letter - 3 Digits) */}
              <div className="flex-1 flex items-center justify-around px-1 gap-1">
                {/* 2 digits (Left) */}
                <input
                  ref={part1Ref}
                  type="text"
                  inputMode="numeric"
                  maxLength={2}
                  placeholder="۲۴"
                  value={toPersianDigits(part1)}
                  onChange={(e) => handlePart1Change(e.target.value)}
                  className={`w-8 sm:w-9 h-7 rounded text-center font-['Vazirmatn'] font-black text-base sm:text-lg border focus:outline-hidden focus:ring-1 focus:ring-blue-600 shadow-inner ${
                    isYellowPlate 
                      ? 'bg-amber-300/80 border-amber-600/80 text-slate-950 placeholder:text-amber-700/40' 
                      : 'bg-slate-50 border-slate-300 text-slate-900 placeholder:text-slate-300'
                  }`}
                  title="دو رقم اول پلاک"
                />

                {/* Letter Dropdown Button Inside Plate */}
                <div className="relative">
                  <select
                    value={letter}
                    onChange={(e) => handleLetterChange(e.target.value)}
                    className={`h-7 px-1.5 rounded text-center font-['Vazirmatn'] font-black text-sm sm:text-base border focus:outline-hidden focus:ring-1 focus:ring-blue-600 shadow-inner cursor-pointer appearance-none ${
                      isYellowPlate 
                        ? 'bg-amber-300/90 border-amber-600/90 text-slate-950' 
                        : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                    dir="rtl"
                    title="حرف الفبای پلاک (ع برای باربری و عمومی)"
                  >
                    {COMMON_LETTERS.map((l) => (
                      <option key={l.char} value={l.char}>
                        {l.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 3 digits (Middle) */}
                <input
                  ref={part2Ref}
                  type="text"
                  inputMode="numeric"
                  maxLength={3}
                  placeholder="۵۶۷"
                  value={toPersianDigits(part2)}
                  onChange={(e) => handlePart2Change(e.target.value)}
                  className={`w-11 sm:w-12 h-7 rounded text-center font-['Vazirmatn'] font-black text-base sm:text-lg border focus:outline-hidden focus:ring-1 focus:ring-blue-600 shadow-inner ${
                    isYellowPlate 
                      ? 'bg-amber-300/80 border-amber-600/80 text-slate-950 placeholder:text-amber-700/40' 
                      : 'bg-slate-50 border-slate-300 text-slate-900 placeholder:text-slate-300'
                  }`}
                  title="سه رقم وسط پلاک"
                />
              </div>

              {/* Vertical Plate Divider */}
              <div className="w-[1.5px] bg-slate-500 self-stretch my-1 shrink-0" />

              {/* Right Side: IRAN Code Section */}
              <div className="w-11 sm:w-12 rounded-r-[6px] flex flex-col items-center justify-center py-0.5 px-0.5 shrink-0 select-none" dir="rtl">
                <span className="text-[8px] font-black text-slate-800 leading-none mb-0.5">
                  ایران
                </span>
                <input
                  ref={iranCodeRef}
                  type="text"
                  inputMode="numeric"
                  maxLength={2}
                  placeholder="۶۸"
                  value={toPersianDigits(iranCode)}
                  onChange={(e) => handleIranCodeChange(e.target.value)}
                  className={`w-8 sm:w-9 h-6 rounded text-center font-['Vazirmatn'] font-black text-xs sm:text-sm border focus:outline-hidden focus:ring-1 focus:ring-blue-600 shadow-inner ${
                    isYellowPlate 
                      ? 'bg-amber-300/80 border-amber-600/80 text-slate-950 placeholder:text-amber-700/40' 
                      : 'bg-slate-50 border-slate-300 text-slate-900 placeholder:text-slate-300'
                  }`}
                  title="کد ۲ رقمی استان (مثلاً ۶۸ برای البرز، ۱۱ برای تهران)"
                />
              </div>
            </div>

            {/* Quick helper controls next to plate */}
            <div className="flex items-center gap-1 sm:gap-1.5 justify-end w-full sm:w-auto">
              {/* Common Cargo Letter Shortcut */}
              <button
                type="button"
                onClick={() => handleLetterChange('ع')}
                className={`text-[10px] px-2 py-1 rounded-lg border font-bold transition-all cursor-pointer ${
                  letter === 'ع' 
                    ? 'bg-amber-400 text-slate-950 border-amber-500 font-black' 
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
                title="پلاک باری و عمومی"
              >
                باری (ع)
              </button>

              {/* City Quick Picker Button & Dropdown */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowCityPicker(!showCityPicker)}
                  className={`text-[10px] px-2 py-1 rounded-lg border font-semibold transition-all cursor-pointer flex items-center gap-0.5 ${
                    showCityPicker
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <MapPin className="w-2.5 h-2.5 text-blue-500" />
                  <span>استان {toPersianDigits(iranCode)}</span>
                </button>

                {/* Popover of Quick Cities */}
                {showCityPicker && (
                  <div className="absolute left-0 sm:right-0 sm:left-auto top-full mt-1 w-60 bg-white border border-slate-300 rounded-xl shadow-xl z-30 p-2 space-y-1.5 animate-fadeIn">
                    <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                      <span className="text-[10px] font-bold text-slate-700">کدهای پرکاربرد:</span>
                      <button
                        type="button"
                        onClick={() => setShowCityPicker(false)}
                        className="text-slate-400 hover:text-slate-700 p-0.5 cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-1 max-h-44 overflow-y-auto pr-0.5">
                      {POPULAR_IRAN_CODES.map((pic) => (
                        <button
                          key={pic.code}
                          type="button"
                          onClick={() => {
                            handleIranCodeChange(pic.code);
                            setShowCityPicker(false);
                          }}
                          className={`text-right px-1.5 py-0.5 rounded text-[10px] font-medium transition-all cursor-pointer ${
                            iranCode === pic.code
                              ? 'bg-blue-600 text-white font-bold'
                              : 'hover:bg-slate-100 text-slate-700'
                          }`}
                        >
                          {pic.label}
                        </button>
                      ))}
                    </div>
                    <div className="pt-1 border-t border-slate-100">
                      <select
                        value={iranCode}
                        onChange={(e) => {
                          handleIranCodeChange(e.target.value);
                          setShowCityPicker(false);
                        }}
                        className="w-full text-[10px] font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded p-1"
                      >
                        <option value="">سایر شهرها...</option>
                        {ALL_IRAN_CODES.map((c) => (
                          <option key={c.code} value={c.code}>{c.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {/* Reset/Clear Button */}
              {(part1 || part2 || colorDesc || vehicleType !== 'وانت نیسان') && (
                <button
                  type="button"
                  onClick={handleReset}
                  className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors cursor-pointer"
                  title="تنظیم مجدد"
                >
                  <RotateCcw className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
