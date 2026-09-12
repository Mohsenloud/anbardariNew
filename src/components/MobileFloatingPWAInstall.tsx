import React, { useState, useEffect, useRef } from 'react';
import { usePWAInstall } from '../utils/usePWAInstall';
import { 
  Download, 
  Smartphone, 
  Share2, 
  PlusSquare, 
  X, 
  CheckCircle, 
  Zap, 
  Timer
} from 'lucide-react';
import { toPersianDigits } from '../utils/jalali';

export const MobileFloatingPWAInstall: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [isVisible, setIsVisible] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(7);
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Check if screen is mobile (< 768px)
  useEffect(() => {
    const checkMobile = () => {
      const isMobileWidth = window.innerWidth < 768;
      setIsMobile(isMobileWidth);
      return isMobileWidth;
    };

    const initialMobile = checkMobile();
    window.addEventListener('resize', checkMobile);

    // Only show if on mobile and not already installed as standalone
    if (initialMobile && !isInstalled) {
      // Small delay for smooth entrance animation
      const entranceTimeout = setTimeout(() => {
        setIsVisible(true);
      }, 500);

      return () => {
        clearTimeout(entranceTimeout);
        window.removeEventListener('resize', checkMobile);
      };
    }

    return () => {
      window.removeEventListener('resize', checkMobile);
    };
  }, [isInstalled]);

  // Handle 7-second countdown timer
  useEffect(() => {
    if (!isVisible || showGuideModal) {
      // Pause or stop timer if guide modal is open or not visible
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      return;
    }

    timerRef.current = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          setIsVisible(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isVisible, showGuideModal]);

  // Don't render if not mobile or already installed or dismissed
  if (!isMobile || isInstalled || (!isVisible && !showGuideModal)) {
    return null;
  }

  const handleInstallClick = async () => {
    if (isInstallable) {
      setIsInstalling(true);
      try {
        const success = await install();
        if (success) {
          setIsVisible(false);
        }
      } finally {
        setIsInstalling(false);
      }
    } else {
      // For iOS or browsers without native deferred prompt, show guided instructions
      setShowGuideModal(true);
    }
  };

  const handleDismiss = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setIsVisible(false);
  };

  return (
    <>
      {/* Floating Mobile Widget */}
      {isVisible && (
        <div 
          id="mobile-floating-pwa-install-banner"
          className="fixed bottom-20 left-3 right-3 sm:left-6 sm:right-6 max-w-md mx-auto z-40 md:hidden animate-in fade-in slide-in-from-bottom-5 duration-300 transition-all"
        >
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950 text-white shadow-2xl border border-emerald-500/30 p-3 sm:p-3.5 backdrop-blur-lg">
            
            {/* Countdown progress bar at the very top */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-white/10">
              <div 
                className="h-full bg-emerald-400 transition-all duration-1000 ease-linear"
                style={{ width: `${(remainingSeconds / 7) * 100}%` }}
              />
            </div>

            <div className="flex items-center justify-between gap-2.5 pt-1">
              {/* Icon & Title */}
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <div className="relative shrink-0">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center text-white shadow-md shadow-emerald-900/50">
                    <Smartphone className="w-5 h-5" />
                  </div>
                  <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                  </span>
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-xs sm:text-sm text-white truncate">
                      نصب نسخه موبایل (PWA)
                    </span>
                    <span className="inline-flex items-center gap-0.5 text-[10px] text-emerald-300 bg-emerald-900/60 px-1.5 py-0.5 rounded-full font-mono shrink-0">
                      <Timer className="w-2.5 h-2.5" />
                      <span>{toPersianDigits(remainingSeconds)} ثانیه</span>
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300 truncate mt-0.5">
                    دسترسی سریع و تمام‌صفحه بدون نیاز به دانلود از بازار
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  id="floating-pwa-install-action-btn"
                  onClick={handleInstallClick}
                  disabled={isInstalling}
                  className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white font-bold text-xs shadow-md shadow-emerald-950/40 transition-all flex items-center gap-1 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>{isInstalling ? 'در حال...' : 'نصب اپ'}</span>
                </button>

                <button
                  type="button"
                  id="floating-pwa-dismiss-btn"
                  onClick={handleDismiss}
                  title="بستن"
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Guided Install Modal for iOS & General Browsers */}
      {showGuideModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-slate-100 text-slate-800 relative">
            <button
              type="button"
              id="close-pwa-guide-modal-btn"
              onClick={() => setShowGuideModal(false)}
              className="absolute top-4 left-4 p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-600 flex items-center justify-center text-white shadow-md shadow-emerald-200 shrink-0">
                <Smartphone className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-bold text-slate-900">
                  راهنمای نصب برنامه روی گوشی
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  استفاده تمام‌صفحه و سریع مانند اپلیکیشن‌های بومی
                </p>
              </div>
            </div>

            {isIOS ? (
              <div className="space-y-4 my-5 bg-slate-50 p-4 rounded-2xl border border-slate-200 text-sm">
                <div className="text-xs font-semibold text-emerald-800 bg-emerald-100 px-2.5 py-1 rounded-md inline-block">
                  مخصوص مرورگر Safari در گوشی‌های آیفون (iOS):
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-slate-200 text-slate-700 font-bold flex items-center justify-center shrink-0 text-xs">
                    ۱
                  </div>
                  <div>
                    در نوار پایین مرورگر سافاری روی آیکون <strong>اشتراک‌گذاری (Share)</strong>{' '}
                    <Share2 className="w-4 h-4 inline text-blue-600 mx-1" /> ضربه بزنید.
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-slate-200 text-slate-700 font-bold flex items-center justify-center shrink-0 text-xs">
                    ۲
                  </div>
                  <div>
                    صفحه را کمی به پایین اسکرول کرده و گزینه{' '}
                    <strong>افزودن به صفحه اصلی (Add to Home Screen)</strong>{' '}
                    <PlusSquare className="w-4 h-4 inline text-slate-700 mx-1" /> را لمس کنید.
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-slate-200 text-slate-700 font-bold flex items-center justify-center shrink-0 text-xs">
                    ۳
                  </div>
                  <div>
                    در گوشه بالا روی <strong>Add</strong> بزنید. آیکون برنامه مستقیماً به صفحه گوشی شما اضافه خواهد شد.
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4 my-5 bg-slate-50 p-4 rounded-2xl border border-slate-200 text-sm">
                <div className="text-xs font-semibold text-emerald-800 bg-emerald-100 px-2.5 py-1 rounded-md inline-block">
                  مخصوص مرورگرهای کروم و سامسونگ در گوشی‌های اندروید:
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-slate-200 text-slate-700 font-bold flex items-center justify-center shrink-0 text-xs">
                    ۱
                  </div>
                  <div>
                    روی دکمه منوی ۳ نقطه در بالای مرورگر کروم ضربه بزنید.
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-slate-200 text-slate-700 font-bold flex items-center justify-center shrink-0 text-xs">
                    ۲
                  </div>
                  <div>
                    گزینه <strong>نصب برنامه (Install App)</strong> یا <strong>افزودن به صفحه اصلی (Add to Home screen)</strong> را انتخاب کنید.
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-slate-200 text-slate-700 font-bold flex items-center justify-center shrink-0 text-xs">
                    ۳
                  </div>
                  <div>
                    تأیید را بزنید تا برنامه همانند یک اپلیکیشن بومی بدون کادر مرورگر اجرا شود.
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 my-4 text-xs text-slate-600">
              <div className="flex items-center gap-1.5 p-2 rounded-xl bg-slate-50">
                <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>اجرای سریع و تمام‌صفحه</span>
              </div>
              <div className="flex items-center gap-1.5 p-2 rounded-xl bg-slate-50">
                <Zap className="w-4 h-4 text-amber-500 shrink-0" />
                <span>کارکرد آفلاین و بدون قطعی</span>
              </div>
            </div>

            <button
              type="button"
              id="confirm-pwa-guide-btn"
              onClick={() => setShowGuideModal(false)}
              className="w-full py-2.5 rounded-xl bg-slate-900 text-white font-bold text-sm hover:bg-slate-800 transition-colors cursor-pointer"
            >
              متوجه شدم
            </button>
          </div>
        </div>
      )}
    </>
  );
};
