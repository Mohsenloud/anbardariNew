/**
 * ابزار کمکی بروزرسانی نسخه برنامه و پاکسازی کش مرورگر
 * App Update & Browser Cache Buster Utility
 */

export interface UpdateAppProgress {
  step: 'init' | 'service_worker' | 'caches' | 'session' | 'complete' | 'error';
  message: string;
}

/**
 * پاکسازی کامل کش‌های مرورگر (CacheStorage و ServiceWorker) و بارگذاری مجدد آخرین نسخه
 * بدون دستکاری یا حذف اطلاعات فاکتورها و انبار در localStorage
 */
export async function clearAppCacheAndReload(
  onProgress?: (progress: UpdateAppProgress) => void
): Promise<void> {
  try {
    onProgress?.({
      step: 'init',
      message: 'شروع فرآیند بروزرسانی و پاکسازی حافظه موقت...',
    });

    // ۱. ارسال پیام پاکسازی به Service Worker و لغو ثبت آن در صورت نیاز
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      onProgress?.({
        step: 'service_worker',
        message: 'در حال بررسی و نوسازی Service Worker...',
      });

      try {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const registration of registrations) {
          // ارسال پیام پاکسازی کش به سرویس ورکر فعال
          if (registration.active) {
            registration.active.postMessage({ type: 'CLEAR_CACHE' });
            registration.active.postMessage({ type: 'SKIP_WAITING' });
          }
          if (registration.waiting) {
            registration.waiting.postMessage({ type: 'SKIP_WAITING' });
          }
          // بررسی نسخه جدید یا لغو ثبت برای دریافت آخرین بیلد
          await registration.update().catch(() => {});
          await registration.unregister().catch(() => {});
        }
      } catch (swErr) {
        console.warn('Service worker cleanup error:', swErr);
      }
    }

    // ۲. حذف کامل کش‌های CacheStorage مرورگر
    if (typeof window !== 'undefined' && 'caches' in window) {
      onProgress?.({
        step: 'caches',
        message: 'در حال حذف فایل‌های کش شده نسخه قبلی از مرورگر...',
      });

      try {
        const cacheKeys = await window.caches.keys();
        await Promise.all(
          cacheKeys.map(async (key) => {
            await window.caches.delete(key);
          })
        );
      } catch (cacheErr) {
        console.warn('CacheStorage deletion error:', cacheErr);
      }
    }

    // ۳. پاکسازی داده‌های موقت نشست (بدون دست زدن به localStorage فاکتورها)
    onProgress?.({
      step: 'session',
      message: 'نوسازی حافظه نشست مرورگر...',
    });

    try {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        window.sessionStorage.clear();
      }
    } catch {}

    // ذخیره زمان آخرین بروزرسانی جهت نمایش در داشبورد
    try {
      localStorage.setItem('app_last_cache_update', Date.now().toString());
    } catch {}

    onProgress?.({
      step: 'complete',
      message: 'دریافت آخرین نسخه با موفقیت انجام شد. در حال بارگذاری مجدد...',
    });

    // ۴. بارگذاری مجدد صفحه با Cache Buster جهت اجبار مرورگر به دریافت کدهای جدید
    setTimeout(() => {
      try {
        const currentUrl = new URL(window.location.href);
        currentUrl.searchParams.set('_v', Date.now().toString());
        window.location.href = currentUrl.toString();
      } catch {
        window.location.reload();
      }
    }, 800);
  } catch (error: any) {
    console.error('Failed to update app and clear cache:', error);
    onProgress?.({
      step: 'error',
      message: 'خطایی رخ داد، صفحه مجدداً بازنشانی می‌شود.',
    });
    setTimeout(() => {
      window.location.reload();
    }, 1000);
  }
}

/**
 * دریافت تاریخ/زمان آخرین پاکسازی کش به فرمت شمسی یا ساعت
 */
export function getLastCacheUpdatedTime(): string | null {
  try {
    const raw = localStorage.getItem('app_last_cache_update');
    if (!raw) return null;
    const date = new Date(parseInt(raw, 10));
    return date.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return null;
  }
}
