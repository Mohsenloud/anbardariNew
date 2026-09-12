import React, { useState } from 'react';
import { usePWAInstall } from '../utils/usePWAInstall';
import { Download, Smartphone, Share2, PlusSquare, X, CheckCircle, ExternalLink, ShieldCheck, Zap } from 'lucide-react';

interface PWAInstallButtonProps {
  className?: string;
  variant?: 'button' | 'badge' | 'banner';
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  className = '',
  variant = 'button',
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);

  // If already running inside standalone PWA, hide install triggers
  if (isInstalled) {
    return null;
  }

  const handleInstallClick = async () => {
    if (isInstallable) {
      setIsInstalling(true);
      try {
        await install();
      } finally {
        setIsInstalling(false);
      }
    } else {
      // If iOS or browser doesn't have native beforeinstallprompt ready yet, show guide modal
      setShowGuideModal(true);
    }
  };

  return (
    <>
      {variant === 'banner' ? (
        <div className={`bg-gradient-to-r from-emerald-700 via-teal-700 to-emerald-800 text-white p-3.5 rounded-2xl shadow-md flex items-center justify-between gap-3 ${className}`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center shrink-0">
              <Smartphone className="w-5 h-5 text-emerald-100" />
            </div>
            <div>
              <div className="font-bold text-sm">نصب نسخه وب‌اپلیکیشن (PWA)</div>
              <div className="text-xs text-emerald-100 mt-0.5">
                دسترسی سریع و تمام‌صفحه روی صفحه اصلی گوشی بدون نیاز به نصب از بازار
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={handleInstallClick}
            disabled={isInstalling}
            className="shrink-0 px-4 py-2 bg-white text-emerald-800 font-bold text-xs rounded-xl shadow-xs hover:bg-emerald-50 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-4 h-4" />
            {isInstalling ? 'در حال آماده‌سازی...' : 'نصب روی گوشی'}
          </button>
        </div>
      ) : variant === 'badge' ? (
        <button
          type="button"
          onClick={handleInstallClick}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 transition-colors cursor-pointer ${className}`}
          title="نصب اپلیکیشن روی گوشی"
        >
          <Smartphone className="w-3.5 h-3.5" />
          <span>نصب وب‌اپ</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={handleInstallClick}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs sm:text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-95 shadow-xs transition-all cursor-pointer ${className}`}
          title="نصب نسخه موبایل اپلیکیشن (PWA)"
        >
          <Download className="w-4 h-4" />
          <span>نصب برنامه روی گوشی</span>
        </button>
      )}

      {/* Guided Install Modal for iOS & General Browsers */}
      {showGuideModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-slate-100 text-slate-800 relative">
            <button
              onClick={() => setShowGuideModal(false)}
              className="absolute top-4 left-4 p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors"
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
                  استفاده تمام‌صفحه مانند اپلیکیشن‌های اندروید و آیفون
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
