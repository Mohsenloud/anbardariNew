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

export function toPersianDigits(n: number | string): string {
  return String(n).replace(/\d/g, (d) => persianDigits[parseInt(d, 10)] || d);
}

export function toEnglishDigits(str: number | string): string {
  return String(str)
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 1776))
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 1632));
}

export function formatPrice(amount: number, currency = 'تومان', usePersianDigits = true): string {
  const formatted = Math.round(amount).toLocaleString('en-US');
  const result = `${formatted} ${currency}`;
  return usePersianDigits ? toPersianDigits(result) : result;
}

export function formatNumber(num: number, usePersianDigits = true): string {
  const formatted = Number(num).toLocaleString('en-US');
  return usePersianDigits ? toPersianDigits(formatted) : formatted;
}
