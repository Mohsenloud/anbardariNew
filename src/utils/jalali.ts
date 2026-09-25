// Conversion between Gregorian and Jalali (Shamsi) calendar
// Algorithm by Kazimierz M. Borkowski

export function gregorianToJalali(gy: number, gm: number, gd: number): [number, number, number] {
  const g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  let jy = (gy <= 1600) ? 0 : 979;
  gy -= (gy <= 1600) ? 621 : 1600;
  const gy2 = (gm > 2) ? (gy + 1) : gy;
  let days = (365 * gy) + Math.floor((gy2 + 3) / 4) - Math.floor((gy2 + 99) / 100) +
    Math.floor((gy2 + 399) / 400) - 80 + gd + g_d_m[gm - 1];
  jy += 33 * Math.floor(days / 12053);
  days %= 12053;
  jy += 4 * Math.floor(days / 1461);
  days %= 1461;
  jy += Math.floor((days - 1) / 365);
  if (days > 0) {
    days = (days - 1) % 365;
  }
  let jm: number;
  let jd: number;
  if (days < 186) {
    jm = 1 + Math.floor(days / 31);
    jd = 1 + (days % 31);
  } else {
    jm = 7 + Math.floor((days - 186) / 30);
    jd = 1 + ((days - 186) % 30);
  }
  return [jy, jm, jd];
}

export function getCurrentJalaliDate(): string {
  const now = new Date();
  const [jy, jm, jd] = gregorianToJalali(now.getFullYear(), now.getMonth() + 1, now.getDate());
  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  return `${jy}/${pad(jm)}/${pad(jd)}`;
}

export function addDaysToJalali(days: number): string {
  const target = new Date();
  target.setDate(target.getDate() + days);
  const [jy, jm, jd] = gregorianToJalali(target.getFullYear(), target.getMonth() + 1, target.getDate());
  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  return `${jy}/${pad(jm)}/${pad(jd)}`;
}

export function getCurrentJalaliTime(): string {
  const now = new Date();
  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  return `${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

export const JALALI_MONTH_NAMES = [
  'فروردین',
  'اردیبهشت',
  'خرداد',
  'تیر',
  'مرداد',
  'شهریور',
  'مهر',
  'آبان',
  'آذر',
  'دی',
  'بهمن',
  'اسفند',
];

export const JALALI_WEEKDAY_NAMES = [
  'یکشنبه',
  'دوشنبه',
  'سه‌شنبه',
  'چهارشنبه',
  'پنج‌شنبه',
  'جمعه',
  'شنبه',
];

export function isJalaliLeapYear(jy: number): boolean {
  const r = (jy - 474) % 128;
  const mod = (r < 0 ? r + 128 : r) % 33;
  return [1, 5, 9, 13, 17, 22, 26, 30].includes(mod);
}

export function getJalaliMonthDays(jy: number, jm: number): number {
  if (jm <= 6) return 31;
  if (jm <= 11) return 30;
  return isJalaliLeapYear(jy) ? 30 : 29;
}

export function stepJalaliDate(jalaliDateStr: string, deltaDays: number): string {
  const clean = toEnglishDigits(jalaliDateStr).replace(/[^\d/]/g, '').trim();
  const parts = clean.split('/').map(Number);
  if (parts.length < 3 || isNaN(parts[0]) || isNaN(parts[1]) || isNaN(parts[2])) {
    return getCurrentJalaliDate();
  }
  let [y, m, d] = parts;
  if (deltaDays > 0) {
    for (let i = 0; i < deltaDays; i++) {
      d++;
      if (d > getJalaliMonthDays(y, m)) {
        d = 1;
        m++;
        if (m > 12) {
          m = 1;
          y++;
        }
      }
    }
  } else if (deltaDays < 0) {
    for (let i = 0; i < Math.abs(deltaDays); i++) {
      d--;
      if (d < 1) {
        m--;
        if (m < 1) {
          m = 12;
          y--;
        }
        d = getJalaliMonthDays(y, m);
      }
    }
  }
  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  return `${y}/${pad(m)}/${pad(d)}`;
}

export function stepTimeMinutes(timeStr: string, deltaMinutes: number): string {
  const clean = toEnglishDigits(timeStr).replace(/[^\d:]/g, '').trim();
  const parts = clean.split(':').map(Number);
  let h = isNaN(parts[0]) ? 12 : parts[0];
  let m = isNaN(parts[1]) ? 0 : parts[1];
  let total = (h * 60 + m + deltaMinutes) % 1440;
  if (total < 0) total += 1440;
  const newH = Math.floor(total / 60);
  const newM = total % 60;
  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  return `${pad(newH)}:${pad(newM)}`;
}

export function parseDeliveryDateTime(rawStr: string | null | undefined): {
  date: string;
  time: string;
  isToday: boolean;
  isYesterday: boolean;
  isTomorrow: boolean;
  relativeLabel: string;
  formattedPersian: string;
} {
  const today = getCurrentJalaliDate();
  const currentTime = getCurrentJalaliTime();

  if (!rawStr || !rawStr.trim()) {
    return {
      date: today,
      time: currentTime,
      isToday: true,
      isYesterday: false,
      isTomorrow: false,
      relativeLabel: 'امروز',
      formattedPersian: `${today} - ساعت ${currentTime}`,
    };
  }

  const clean = toEnglishDigits(rawStr).trim();
  const dateMatch = clean.match(/(\d{4})\/(\d{1,2})\/(\d{1,2})/);
  const timeMatch = clean.match(/(\d{1,2}):(\d{2})/);

  const pad = (n: string | number) => {
    const s = String(n);
    return s.length === 1 ? `0${s}` : s;
  };

  const date = dateMatch
    ? `${dateMatch[1]}/${pad(dateMatch[2])}/${pad(dateMatch[3])}`
    : today;
  const time = timeMatch ? `${pad(timeMatch[1])}:${pad(timeMatch[2])}` : currentTime;

  const yesterday = addDaysToJalali(-1);
  const tomorrow = addDaysToJalali(1);
  const dayBeforeYesterday = addDaysToJalali(-2);

  let relativeLabel = '';
  const isToday = date === today;
  const isYesterday = date === yesterday;
  const isTomorrow = date === tomorrow;

  if (isToday) relativeLabel = 'امروز';
  else if (isYesterday) relativeLabel = 'دیروز';
  else if (date === dayBeforeYesterday) relativeLabel = 'پریروز';
  else if (isTomorrow) relativeLabel = 'فردا';

  const dateParts = date.split('/').map(Number);
  const mIndex = (dateParts[1] || 1) - 1;
  const monthName = JALALI_MONTH_NAMES[mIndex] || '';
  const formattedPersian = `${toPersianDigits(dateParts[2])} ${monthName} ${toPersianDigits(dateParts[0])} - ساعت ${toPersianDigits(time)}${relativeLabel ? ` (${relativeLabel})` : ''}`;

  return {
    date,
    time,
    isToday,
    isYesterday,
    isTomorrow,
    relativeLabel,
    formattedPersian,
  };
}

export function formatDeliveryDateTime(date: string, time: string): string {
  const cleanDate = toEnglishDigits(date).trim();
  const cleanTime = toEnglishDigits(time).trim();
  return `${cleanDate} - ساعت ${cleanTime}`;
}

const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];

export function toPersianDigits(n: number | string | null | undefined): string {
  if (n === null || n === undefined || n === '') return '';
  return String(n).replace(/\d/g, (d) => persianDigits[parseInt(d, 10)] || d);
}

export function toEnglishDigits(str: number | string | null | undefined): string {
  if (str === null || str === undefined || str === '') return '';
  return String(str)
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 1776))
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 1632));
}

export function formatPrice(amount: number | null | undefined, currency = 'تومان', usePersianDigits = true): string {
  const safeAmount = Number(amount) || 0;
  const formatted = Math.round(safeAmount).toLocaleString('en-US');
  const result = `${formatted} ${currency}`;
  return usePersianDigits ? toPersianDigits(result) : result;
}

export function formatNumber(num: number | null | undefined, usePersianDigits = true): string {
  const safeNum = Number(num) || 0;
  const formatted = safeNum.toLocaleString('en-US');
  return usePersianDigits ? toPersianDigits(formatted) : formatted;
}

export function formatThousands(val: number | string | null | undefined, usePersianDigits = true): string {
  if (val === null || val === undefined || val === '') return '';
  const eng = toEnglishDigits(String(val)).replace(/,/g, '').trim();
  const num = Number(eng);
  if (isNaN(num)) return usePersianDigits ? toPersianDigits(String(val)) : String(val);
  const parts = eng.split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const res = parts.join('.');
  return usePersianDigits ? toPersianDigits(res) : res;
}

export function parseThousands(val: string | number | null | undefined): number {
  if (val === null || val === undefined || val === '') return 0;
  const eng = toEnglishDigits(String(val)).replace(/,/g, '').replace(/[^\d.-]/g, '').trim();
  const num = parseFloat(eng);
  return isNaN(num) ? 0 : num;
}

export function numberToPersianWords(num: number | null | undefined): string {
  const safeNum = Number(num);
  if (num === null || num === undefined || isNaN(safeNum)) return '';
  if (safeNum === 0) return 'صفر';

  const isNegative = safeNum < 0;
  let n = Math.abs(Math.floor(safeNum));

  const yekan = ['', 'یک', 'دو', 'سه', 'چهار', 'پنج', 'شش', 'هفت', 'هشت', 'نه'];
  const dahha = ['', 'ده', 'بیست', 'سی', 'چهل', 'پنجاه', 'شصت', 'هفتاد', 'هشتاد', 'نود'];
  const dahhaKhas = ['ده', 'یازده', 'دوازده', 'سیزده', 'چهارده', 'پانزده', 'شانزده', 'هفده', 'هجده', 'نوزده'];
  const sadha = ['', 'یکصد', 'دویست', 'سیصد', 'چهارصد', 'پانصد', 'ششصد', 'هفتصد', 'هشتصد', 'نهصد'];
  const scales = ['', 'هزار', 'میلیون', 'میلیارد', 'تریلیون'];

  function threeDigitsToWords(val: number): string {
    const parts: string[] = [];
    const s = Math.floor(val / 100);
    const d = Math.floor((val % 100) / 10);
    const y = val % 10;

    if (s > 0) parts.push(sadha[s]);

    if (d === 1) {
      parts.push(dahhaKhas[y]);
    } else {
      if (d > 1) parts.push(dahha[d]);
      if (y > 0) parts.push(yekan[y]);
    }

    return parts.join(' و ');
  }

  const parts: string[] = [];
  let scaleIndex = 0;

  while (n > 0) {
    const chunk = n % 1000;
    if (chunk > 0) {
      const chunkText = threeDigitsToWords(chunk);
      const scaleText = scales[scaleIndex];
      parts.unshift(scaleText ? `${chunkText} ${scaleText}` : chunkText);
    }
    n = Math.floor(n / 1000);
    scaleIndex++;
  }

  const result = parts.join(' و ');
  return isNegative ? `منفی ${result}` : result;
}
