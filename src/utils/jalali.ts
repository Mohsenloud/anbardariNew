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
