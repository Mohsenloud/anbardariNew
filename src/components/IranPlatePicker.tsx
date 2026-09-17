import React, { useState, useEffect, useRef } from 'react';
import { Truck, Check, Sparkles, Edit3, Car, ChevronDown, RefreshCw } from 'lucide-react';
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
}

export const COMMON_LETTERS = [
  { char: 'ع', label: 'ع (عمومی / باری)', isCargo: true },
  { char: 'ب', label: 'ب', isCargo: false },
  { char: 'ج', label: 'ج', isCargo: false },
  { char: 'د', label: 'د', isCargo: false },
  { char: 'س', label: 'س', isCargo: false },
  { char: 'ص', label: 'ص', isCargo: false },
  { char: 'ط', label: 'ط', isCargo: false },
  { char: 'ق', label: 'ق', isCargo: false },
  { char: 'ل', label: 'ل', isCargo: false },
  { char: 'م', label: 'م', isCargo: false },
  { char: 'ن', label: 'ن', isCargo: false },
  { char: 'و', label: 'و', isCargo: false },
  { char: 'هـ', label: 'هـ', isCargo: false },
  { char: 'ی', label: 'ی', isCargo: false },
  { char: 'ت', label: 'ت (تاکسی)', isCargo: false },
  { char: 'الف', label: 'الف (دولتی)', isCargo: false },
];

export const POPULAR_IRAN_CODES = [
  { code: '11', label: 'تهران ۱۱' },
  { code: '22', label: 'تهران ۲۲' },
  { code: '33', label: 'تهران ۳۳' },
  { code: '68', label: 'البرز (کرج) ۶۸' },
  { code: '21', label: 'البرز ۲۱' },
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
  { code: '11', label: 'تهران ۱۱ (مرکزی)' },
  { code: '22', label: 'تهران ۲۲ (شرق/غرب)' },
  { code: '33', label: 'تهران ۳۳ (جنوب)' },
  { code: '44', label: 'تهران ۴۴' },
  { code: '55', label: 'تهران ۵۵' },
  { code: '66', label: 'تهران ۶۶' },
  { code: '77', label: 'تهران ۷۷' },
  { code: '88', label: 'تهران ۸۸' },
  { code: '99', label: 'تهران ۹۹' },
  { code: '68', label: 'البرز ۶۸ (کرج)' },
  { code: '21', label: 'البرز ۲۱ (کرج/ساوجبلاغ)' },
  { code: '38', label: 'البرز ۳۸ (فردیس/اشتهارد)' },
  { code: '13', label: 'اصفهان ۱۳' },
  { code: '23', label: 'اصفهان ۲۳ (نجف‌آباد)' },
  { code: '43', label: 'اصفهان ۴۳ (کاشان)' },
  { code: '53', label: 'اصفهان ۵۳ (شهرضا)' },
  { code: '12', label: 'خراسان رضوی ۱۲ (مشهد)' },
  { code: '32', label: 'خراسان ۳۲ (نیشابور)' },
  { code: '42', label: 'خراسان ۴۲ (سبزوار)' },
  { code: '63', label: 'فارس ۶۳ (شیراز)' },
  { code: '73', label: 'فارس ۷۳ (مرودشت)' },
  { code: '83', label: 'فارس ۸۳ (کازرون)' },
  { code: '14', label: 'خوزستان ۱۴ (اهواز)' },
  { code: '24', label: 'خوزستان ۲۴ (آبادان/دزفول)' },
  { code: '15', label: 'آذربایجان شرقی ۱۵ (تبریز)' },
  { code: '25', label: 'آذربایجان شرقی ۲۵ (مراغه)' },
  { code: '17', label: 'آذربایجان غربی ۱۷ (ارومیه)' },
  { code: '27', label: 'آذربایجان غربی ۲۷ (خوی/مهاباد)' },
  { code: '62', label: 'مازندران ۶۲ (ساری)' },
  { code: '72', label: 'مازندران ۷۲ (بابل/آمل)' },
  { code: '82', label: 'مازندران ۸۲ (تنکابن/نوشهر)' },
  { code: '46', label: 'گیلان ۴۶ (رشت)' },
  { code: '56', label: 'گیلان ۵۶ (لاهیجان/انزلی)' },
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
  { code: '49', label: 'کهگیلویه و بویراحمد ۴۹ (یاسوج)' },
  { code: '58', label: 'بوشهر ۵۸' },
  { code: '26', label: 'خراسان شمالی ۲۶ (بجنورد)' },
  { code: '52', label: 'خراسان جنوبی ۵۲ (بیرجند)' },
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
    if (text.includes(vt)) {
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

  // If text does not match standard Iran plate, start in free text mode or prefilled
  return {
    vehicleType,
    part1: '',
    letter: 'ع',
    part2: '',
    iranCode: '68',
    colorDesc,
    isFreeText: true,
  };
}

export const IranPlatePicker: React.FC<IranPlatePickerProps> = ({ value, onChange }) => {
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

  const part1Ref = useRef<HTMLInputElement>(null);
  const part2Ref = useRef<HTMLInputElement>(null);
  const iranCodeRef = useRef<HTMLInputElement>(null);

  // Sync internal states when external `value` changes significantly
  useEffect(() => {
    const p = parseVehicleInfo(value);
    if (!value || value.trim() === '') {
      // Keep defaults
      return;
    }
    if (p.isFreeText) {
      setFreeTextValue(value);
    } else {
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
    col: string
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

    const typeDesc = vType === 'سایر' && customVehicleType ? customVehicleType : vType;
    const parts = [
      typeDesc,
      col ? `(${col})` : '',
      plateStr
    ].filter(Boolean);

    const result = parts.join(' - ');
    onChange(result);
  };

  const handlePart1Change = (val: string) => {
    const en = toEnglishDigits(val).replace(/\D/g, '').slice(0, 2);
    setPart1(en);
    emitFormattedValue(vehicleType, en, letter, part2, iranCode, colorDesc);
    if (en.length === 2) {
      part2Ref.current?.focus();
    }
  };

  const handleLetterChange = (newLetter: string) => {
    setLetter(newLetter);
    emitFormattedValue(vehicleType, part1, newLetter, part2, iranCode, colorDesc);
  };

  const handlePart2Change = (val: string) => {
    const en = toEnglishDigits(val).replace(/\D/g, '').slice(0, 3);
    setPart2(en);
    emitFormattedValue(vehicleType, part1, letter, en, iranCode, colorDesc);
    if (en.length === 3) {
      iranCodeRef.current?.focus();
    }
  };

  const handleIranCodeChange = (val: string) => {
    const en = toEnglishDigits(val).replace(/\D/g, '').slice(0, 2);
    setIranCode(en);
    emitFormattedValue(vehicleType, part1, letter, part2, en, colorDesc);
  };

  const handleVehicleTypeSelect = (vt: string) => {
    setVehicleType(vt);
    emitFormattedValue(vt, part1, letter, part2, iranCode, colorDesc);
  };

  const handleColorToggle = (col: string) => {
    const nextCol = colorDesc === col ? '' : col;
    setColorDesc(nextCol);
    emitFormattedValue(vehicleType, part1, letter, part2, iranCode, nextCol);
  };

  const isYellowPlate = letter === 'ع' || letter === 'ت';

  return (
    <div className="bg-slate-50/90 border border-slate-200 rounded-2xl p-3 sm:p-4 space-y-3.5">
      {/* Header & Mode Switcher */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-200/80">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
            <Truck className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs sm:text-sm font-bold text-slate-900">
              ثبت مشخصات خودرو و پلاک ملی (انتخابی سریع)
            </h4>
            <p className="text-[11px] text-slate-500">
              برای ثبت سریع، شماره‌ها و کد استان را انتخاب یا وارد فرمایید
            </p>
          </div>
        </div>

        {/* Toggle between structured plate vs manual free text */}
        <button
          type="button"
          onClick={() => {
            if (!isFreeText) {
              setFreeTextValue(value);
              setIsFreeText(true);
            } else {
              setIsFreeText(false);
              emitFormattedValue(vehicleType, part1, letter, part2, iranCode, colorDesc);
            }
          }}
          className="text-xs text-blue-600 hover:text-blue-800 font-bold flex items-center gap-1 cursor-pointer bg-white px-2.5 py-1.5 rounded-xl border border-slate-200 hover:border-blue-300 transition-all shadow-2xs"
        >
          {isFreeText ? (
            <>
              <Sparkles className="w-3.5 h-3.5 text-blue-500" />
              <span>پلاک‌ساز انتخابی</span>
            </>
          ) : (
            <>
              <Edit3 className="w-3.5 h-3.5 text-slate-500" />
              <span>تایپ آزاد / دستی</span>
            </>
          )}
        </button>
      </div>

      {isFreeText ? (
        /* Manual Free Text Mode */
        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-700 block">
            متن آزاد مشخصات خودرو و پلاک:
          </label>
          <input
            type="text"
            value={freeTextValue}
            onChange={(e) => {
              setFreeTextValue(e.target.value);
              onChange(e.target.value);
            }}
            placeholder="مثال: وانت نیسان آبی - پلاک ۲۴ ع ۵۶۷ ایران ۶۸ یا کامیون ده چرخ"
            className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm font-medium text-slate-900"
          />
          <p className="text-[11px] text-slate-500">
            می‌توانید هر نوع توضیحات خودرو، رنگ، مدل یا پلاک‌های غیر استاندارد را به صورت متن آزاد بنویسید.
          </p>
        </div>
      ) : (
        /* Structured Plate & Vehicle Picker */
        <div className="space-y-3.5">
          {/* 1. Quick Vehicle Type Selector */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold text-slate-700 flex items-center gap-1">
                <Car className="w-3.5 h-3.5 text-slate-500" />
                <span>نوع وسیله نقلیه:</span>
              </span>
              <span className="text-[11px] text-slate-500 font-bold text-blue-700">
                {vehicleType}
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {VEHICLE_TYPES.map((vt) => {
                const isSelected = vehicleType === vt;
                return (
                  <button
                    key={vt}
                    type="button"
                    onClick={() => handleVehicleTypeSelect(vt)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-blue-600 text-white shadow-xs font-bold'
                        : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                    }`}
                  >
                    {vt}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. THE VISUAL IRANIAN LICENSE PLATE WIDGET */}
          <div className="pt-1">
            <span className="text-xs font-bold text-slate-700 mb-1.5 block">
              تنظیم شماره‌های پلاک ملی خودرو:
            </span>

            {/* Plate Box Representation */}
            <div className="flex items-center justify-center">
              <div 
                className={`w-full max-w-md rounded-xl border-2 border-slate-900 shadow-md p-1.5 sm:p-2 flex items-stretch select-none transition-colors ${
                  isYellowPlate 
                    ? 'bg-amber-400 text-slate-950' 
                    : 'bg-white text-slate-900'
                }`}
                dir="ltr"
              >
                {/* Left Blue Flag Strip (IRAN Standard) */}
                <div className="bg-blue-800 text-white w-9 sm:w-10 rounded-lg flex flex-col items-center justify-between py-1 px-0.5 shrink-0 select-none">
                  {/* Miniature Iranian Flag */}
                  <div className="w-6 h-3.5 rounded-xs overflow-hidden flex flex-col border border-white/40 shadow-2xs">
                    <div className="bg-emerald-600 h-1/3 w-full" />
                    <div className="bg-white h-1/3 w-full flex items-center justify-center">
                      <div className="w-1 h-1 bg-red-600 rounded-full" />
                    </div>
                    <div className="bg-rose-600 h-1/3 w-full" />
                  </div>

                  <div className="text-[7px] sm:text-[8px] font-black tracking-tighter text-center leading-none text-white/90">
                    <div>I.R.</div>
                    <div>IRAN</div>
                  </div>
                </div>

                {/* Central Numbers and Letter Section */}
                <div className="flex-1 flex items-center justify-evenly px-1 sm:px-2 gap-1 sm:gap-2">
                  {/* First 2 digits (۲ رقم سمت چپ) */}
                  <div className="flex flex-col items-center">
                    <span className="text-[9px] text-slate-600 font-bold mb-0.5">۲ رقم</span>
                    <input
                      ref={part1Ref}
                      type="text"
                      inputMode="numeric"
                      maxLength={2}
                      placeholder="۲۴"
                      value={toPersianDigits(part1)}
                      onChange={(e) => handlePart1Change(e.target.value)}
                      className={`w-11 sm:w-13 h-10 sm:h-11 rounded-lg text-center font-['Vazirmatn'] font-black text-lg sm:text-xl border focus:outline-hidden focus:ring-2 focus:ring-blue-600 shadow-inner ${
                        isYellowPlate 
                          ? 'bg-amber-300 border-amber-600 text-slate-950 placeholder:text-amber-700/50' 
                          : 'bg-slate-50 border-slate-300 text-slate-900 placeholder:text-slate-300'
                      }`}
                    />
                  </div>

                  {/* Middle Letter (حرف الفبا) */}
                  <div className="flex flex-col items-center">
                    <span className="text-[9px] text-slate-600 font-bold mb-0.5">حرف</span>
                    <div className="relative">
                      <select
                        value={letter}
                        onChange={(e) => handleLetterChange(e.target.value)}
                        className={`h-10 sm:h-11 px-2.5 sm:px-3.5 rounded-lg text-center font-['Vazirmatn'] font-black text-base sm:text-lg border focus:outline-hidden focus:ring-2 focus:ring-blue-600 shadow-inner appearance-none cursor-pointer pr-6 sm:pr-7 ${
                          isYellowPlate 
                            ? 'bg-amber-300 border-amber-600 text-slate-950 font-black' 
                            : 'bg-slate-50 border-slate-300 text-slate-900'
                        }`}
                        dir="rtl"
                      >
                        {COMMON_LETTERS.map((l) => (
                          <option key={l.char} value={l.char}>
                            {l.label}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="w-3.5 h-3.5 text-slate-700 absolute right-1.5 top-3.5 pointer-events-none" />
                    </div>
                  </div>

                  {/* Middle 3 digits (۳ رقم وسط) */}
                  <div className="flex flex-col items-center">
                    <span className="text-[9px] text-slate-600 font-bold mb-0.5">۳ رقم</span>
                    <input
                      ref={part2Ref}
                      type="text"
                      inputMode="numeric"
                      maxLength={3}
                      placeholder="۵۶۷"
                      value={toPersianDigits(part2)}
                      onChange={(e) => handlePart2Change(e.target.value)}
                      className={`w-14 sm:w-16 h-10 sm:h-11 rounded-lg text-center font-['Vazirmatn'] font-black text-lg sm:text-xl border focus:outline-hidden focus:ring-2 focus:ring-blue-600 shadow-inner ${
                        isYellowPlate 
                          ? 'bg-amber-300 border-amber-600 text-slate-950 placeholder:text-amber-700/50' 
                          : 'bg-slate-50 border-slate-300 text-slate-900 placeholder:text-slate-300'
                      }`}
                    />
                  </div>
                </div>

                {/* Vertical Divider */}
                <div className="w-[1.5px] bg-slate-400 self-stretch my-1 shrink-0" />

                {/* Right Iran City Code Box (کد ایران) */}
                <div className="w-14 sm:w-16 flex flex-col items-center justify-between py-0.5 px-1 shrink-0 select-none" dir="rtl">
                  <span className="text-[10px] sm:text-xs font-black text-slate-800">
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
                    className={`w-11 sm:w-12 h-8 sm:h-9 rounded-lg text-center font-['Vazirmatn'] font-black text-base sm:text-lg border focus:outline-hidden focus:ring-2 focus:ring-blue-600 shadow-inner ${
                      isYellowPlate 
                        ? 'bg-amber-300 border-amber-600 text-slate-950 placeholder:text-amber-700/50' 
                        : 'bg-slate-50 border-slate-300 text-slate-900 placeholder:text-slate-300'
                    }`}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Quick Letter Chips (انتخاب سریع حرف الفبای پلاک) */}
          <div className="space-y-1.5 pt-0.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-600">
                انتخاب سریع حرف پلاک:
              </span>
              <span className="text-[11px] text-amber-700 font-medium">
                حرف «ع» برای وانت، خاور و باربری (پلاک زرد)
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-1">
              {COMMON_LETTERS.map((l) => {
                const isSelected = letter === l.char;
                return (
                  <button
                    key={l.char}
                    type="button"
                    onClick={() => handleLetterChange(l.char)}
                    className={`min-w-[32px] h-7 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      isSelected
                        ? l.isCargo
                          ? 'bg-amber-500 text-slate-950 shadow-xs ring-2 ring-amber-600 font-black'
                          : 'bg-blue-600 text-white shadow-xs ring-2 ring-blue-500 font-black'
                        : l.isCargo
                        ? 'bg-amber-100 text-amber-900 hover:bg-amber-200 border border-amber-300 font-bold'
                        : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                    }`}
                    title={l.label}
                  >
                    {l.char}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Quick Iran City Code Selector (انتخاب سریع کد استان و شهر) */}
          <div className="space-y-1.5 pt-0.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-600">
                انتخاب سریع کد ایران (استان / شهر):
              </span>
              <div className="relative">
                <select
                  value={iranCode}
                  onChange={(e) => handleIranCodeChange(e.target.value)}
                  className="text-[11px] font-bold text-blue-700 bg-white border border-slate-200 rounded-lg px-2 py-0.5 cursor-pointer focus:outline-hidden"
                >
                  <option value="">سایر استان‌ها...</option>
                  {ALL_IRAN_CODES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex flex-wrap gap-1">
              {POPULAR_IRAN_CODES.map((pic) => {
                const isSelected = iranCode === pic.code;
                return (
                  <button
                    key={pic.code}
                    type="button"
                    onClick={() => handleIranCodeChange(pic.code)}
                    className={`px-2 py-1 rounded-lg text-[11px] transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-600 text-white font-bold shadow-xs'
                        : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                    }`}
                  >
                    {pic.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Optional: Vehicle Color / Details Chips */}
          <div className="pt-0.5">
            <span className="text-[11px] font-bold text-slate-600 mb-1 block">
              رنگ یا ویژگی خودرو (اختیاری):
            </span>
            <div className="flex flex-wrap gap-1">
              {COLOR_PRESETS.map((col) => {
                const isSelected = colorDesc === col;
                return (
                  <button
                    key={col}
                    type="button"
                    onClick={() => handleColorToggle(col)}
                    className={`px-2 py-0.5 rounded-md text-[11px] font-medium transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-slate-800 text-white font-bold'
                        : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                    }`}
                  >
                    {col}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Formatted Output Preview Bar */}
          <div className="mt-2 p-2.5 rounded-xl bg-white border border-slate-200 shadow-2xs flex items-center justify-between gap-2">
            <div className="text-xs">
              <span className="text-slate-500 font-medium">پیش‌نمایش خروجی: </span>
              <span className="font-bold text-blue-900 font-['Vazirmatn']">
                {value || 'در حال ثبت...'}
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                setPart1('');
                setPart2('');
                setLetter('ع');
                setIranCode('68');
                setColorDesc('');
                emitFormattedValue(vehicleType, '', 'ع', '', '68', '');
              }}
              className="text-[10px] text-slate-400 hover:text-rose-600 flex items-center gap-1 cursor-pointer"
              title="پاک کردن پلاک"
            >
              <RefreshCw className="w-3 h-3" />
              <span>پاکسازی</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
