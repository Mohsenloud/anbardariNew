import React, { useState, useEffect } from 'react';
import { StoreSettings, AppUser } from '../types';
import { getCurrentJalaliDate, getCurrentJalaliTime, toPersianDigits } from '../utils/jalali';
import {
  loginWithServer,
  fetchAuthBootstrap,
  requestAdminTelegramRecovery,
  confirmAdminTelegramRecovery,
} from '../utils/authClient';
import {
  Lock,
  User,
  KeyRound,
  Eye,
  EyeOff,
  LogIn,
  AlertCircle,
  ShieldCheck,
  CheckCircle2,
  Sparkles,
  Store,
  Clock,
  Calendar,
  Send,
  Terminal,
  X,
  Copy,
  Check,
  RefreshCw,
} from 'lucide-react';

interface LoginScreenProps {
  settings: StoreSettings;
  users: AppUser[];
  onLoginSuccess: (user: AppUser) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({
  settings,
  users,
  onLoginSuccess,
}) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(getCurrentJalaliTime());
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutSeconds, setLockoutSeconds] = useState(0);
  const currentDate = getCurrentJalaliDate();

  // Admin Password Recovery Modal State
  const [isRecoveryOpen, setIsRecoveryOpen] = useState(false);
  const [telegramRecoveryEnabled, setTelegramRecoveryEnabled] = useState<boolean>(false);
  const [recoveryTab, setRecoveryTab] = useState<'telegram' | 'vps'>('telegram');
  const [recoveryUsername, setRecoveryUsername] = useState('admin');
  const [recoveryStep, setRecoveryStep] = useState<'request' | 'confirm'>('request');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [recoveryNewPass, setRecoveryNewPass] = useState('');
  const [recoveryConfirmPass, setRecoveryConfirmPass] = useState('');
  const [showRecoveryPass, setShowRecoveryPass] = useState(false);
  const [recoveryLoading, setRecoveryLoading] = useState(false);
  const [recoveryError, setRecoveryError] = useState('');
  const [recoveryInfo, setRecoveryInfo] = useState('');
  const [copiedCmd, setCopiedCmd] = useState(false);

  // Check recovery availability from server bootstrap
  useEffect(() => {
    let active = true;
    fetchAuthBootstrap().then((boot) => {
      if (!active || !boot) return;
      const enabled = Boolean(boot.telegramRecoveryEnabled);
      setTelegramRecoveryEnabled(enabled);
      if (!enabled) {
        setRecoveryTab('vps');
      }
    });
    return () => {
      active = false;
    };
  }, []);

  // Update clock every 10 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(getCurrentJalaliTime());
    }, 10000);
    return () => clearInterval(timer);
  }, []);

  // Lockout countdown timer
  useEffect(() => {
    if (lockoutSeconds <= 0) return;
    const timer = setInterval(() => {
      setLockoutSeconds((prev) => {
        if (prev <= 1) {
          setFailedAttempts(0);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [lockoutSeconds]);

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (lockoutSeconds > 0 || isLoading) return;
    setErrorMessage('');
    setSuccessMessage('');

    const cleanUsername = username.trim().toLowerCase();
    const cleanPassword = password.trim();

    if (!cleanUsername) {
      setErrorMessage('لطفاً نام کاربری را وارد نمایید.');
      return;
    }

    if (!cleanPassword) {
      setErrorMessage('لطفاً رمز عبور را وارد نمایید.');
      return;
    }

    setIsLoading(true);

    const serverRes = await loginWithServer(cleanUsername, cleanPassword);

    if (serverRes.success && serverRes.user) {
      setFailedAttempts(0);
      setLockoutSeconds(0);
      setIsLoading(false);
      onLoginSuccess(serverRes.user);
      return;
    }

    // Server explicitly responded with auth error / lockout
    if (!serverRes.networkError) {
      if (typeof serverRes.retryAfterSeconds === 'number' && serverRes.retryAfterSeconds > 0) {
        setLockoutSeconds(serverRes.retryAfterSeconds);
      }
      setErrorMessage(serverRes.message || 'نام کاربری یا رمز عبور اشتباه است.');
      setIsLoading(false);
      return;
    }

    // Offline fallback ONLY when server is genuinely unreachable
    const foundUser = users.find(
      (u) => u.username.trim().toLowerCase() === cleanUsername
    );

    if (!foundUser || !foundUser.isActive) {
      const nextAttempts = failedAttempts + 1;
      setFailedAttempts(nextAttempts);
      if (nextAttempts >= 5) {
        setLockoutSeconds(60);
        setErrorMessage('به دلیل ۵ تلاش ناموفق پیاپی، دسترسی ورود موقتاً به مدت ۶۰ ثانیه مسدود گردید.');
      } else {
        setErrorMessage('ارتباط با سرور برقرار نیست. لطفاً اتصال شبکه را بررسی کنید.');
      }
      setIsLoading(false);
      return;
    }

    const expectedPass = (foundUser.password || foundUser.pin || '').trim();
    if (!expectedPass || cleanPassword !== expectedPass) {
      const nextAttempts = failedAttempts + 1;
      setFailedAttempts(nextAttempts);
      if (nextAttempts >= 5) {
        setLockoutSeconds(60);
        setErrorMessage('به دلیل ۵ تلاش ناموفق پیاپی، دسترسی ورود موقتاً به مدت ۶۰ ثانیه مسدود گردید.');
      } else {
        setErrorMessage(`رمز عبور وارد شده نادرست است. (${toPersianDigits(5 - nextAttempts)} تلاش باقی‌مانده)`);
      }
      setIsLoading(false);
      return;
    }

    setFailedAttempts(0);
    setIsLoading(false);
    onLoginSuccess(foundUser);
  };

  const openRecoveryModal = () => {
    setRecoveryUsername(username.trim() || 'admin');
    setRecoveryStep('request');
    setRecoveryCode('');
    setRecoveryNewPass('');
    setRecoveryConfirmPass('');
    setRecoveryError('');
    setRecoveryInfo('');
    setRecoveryTab(telegramRecoveryEnabled ? 'telegram' : 'vps');
    setIsRecoveryOpen(true);
  };

  const handleRequestTelegramOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (recoveryLoading) return;
    setRecoveryError('');
    setRecoveryInfo('');
    setRecoveryLoading(true);
    const res = await requestAdminTelegramRecovery(recoveryUsername);
    setRecoveryLoading(false);
    if (res.success) {
      setRecoveryInfo(res.message);
      setRecoveryStep('confirm');
    } else {
      setRecoveryError(res.message);
    }
  };

  const handleConfirmTelegramRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (recoveryLoading) return;
    setRecoveryError('');
    setRecoveryInfo('');

    if (!recoveryCode.trim()) {
      setRecoveryError('لطفاً کد تأیید ۶ رقمی ارسال‌شده در تلگرام را وارد نمایید.');
      return;
    }
    if (recoveryNewPass.trim().length < 4) {
      setRecoveryError('رمز عبور جدید باید حداقل ۴ کاراکتر باشد.');
      return;
    }
    if (recoveryNewPass.trim() !== recoveryConfirmPass.trim()) {
      setRecoveryError('رمز عبور جدید و تکرار آن یکسان نیستند.');
      return;
    }

    setRecoveryLoading(true);
    const res = await confirmAdminTelegramRecovery(
      recoveryUsername,
      recoveryCode,
      recoveryNewPass
    );
    setRecoveryLoading(false);

    if (res.success) {
      setUsername(recoveryUsername.trim() || 'admin');
      setPassword('');
      setErrorMessage('');
      setLockoutSeconds(0);
      setFailedAttempts(0);
      setSuccessMessage(res.message);
      setIsRecoveryOpen(false);
    } else {
      setRecoveryError(res.message);
    }
  };

  const vpsResetCommand = 'cd /var/www/app && ./reset-admin.sh';
  const handleCopyVpsCmd = () => {
    navigator.clipboard?.writeText(vpsResetCommand).then(() => {
      setCopiedCmd(true);
      setTimeout(() => setCopiedCmd(false), 2500);
    });
  };

  const displayStoreName = settings?.appName || settings?.storeName || 'سامانه صدور فاکتور و مدیریت فروشگاه';

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-slate-900 via-slate-800 to-teal-950 flex flex-col justify-between items-center p-4 sm:p-6 text-right selection:bg-emerald-500 selection:text-white relative overflow-hidden">
      {/* Decorative background lights */}
      <div className="absolute -top-40 -right-40 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top Bar: Date & Clock */}
      <header className="w-full max-w-5xl flex items-center justify-between text-slate-400 text-xs py-2 px-1 z-10">
        <div className="flex items-center gap-2">
          <Store className="w-4 h-4 text-emerald-400" />
          <span className="font-semibold text-slate-300 truncate max-w-[200px] sm:max-w-xs">
            {displayStoreName}
          </span>
        </div>
        <div className="flex items-center gap-4 text-[11px] sm:text-xs">
          <div className="flex items-center gap-1.5 bg-slate-800/80 border border-slate-700/60 px-2.5 py-1 rounded-lg text-slate-300">
            <Calendar className="w-3.5 h-3.5 text-emerald-400" />
            <span>{currentDate}</span>
          </div>
          <div className="flex items-center gap-1.5 bg-slate-800/80 border border-slate-700/60 px-2.5 py-1 rounded-lg text-slate-300">
            <Clock className="w-3.5 h-3.5 text-teal-400" />
            <span dir="ltr">{currentTime}</span>
          </div>
        </div>
      </header>

      {/* Main Login Card */}
      <main className="w-full max-w-md my-auto z-10">
        <div className="bg-white rounded-3xl shadow-2xl border border-slate-200/80 overflow-hidden">
          {/* Card Header */}
          <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-slate-800 p-6 sm:p-8 text-white relative">
            <div className="flex items-center gap-3.5 mb-2">
              <div className="w-12 h-12 rounded-2xl bg-white/15 backdrop-blur-md flex items-center justify-center shadow-inner border border-white/20">
                <ShieldCheck className="w-6 h-6 text-emerald-200" />
              </div>
              <div>
                <h1 className="text-lg sm:text-xl font-black tracking-tight">ورود به سیستم فروش</h1>
                <p className="text-emerald-100 text-xs mt-0.5">
                  جهت دسترسی، نام کاربری و رمز عبور خود را وارد کنید
                </p>
              </div>
            </div>

            {settings?.showStoreEditionBadge !== false && (
              <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-white/15 text-emerald-100 border border-white/20 mt-1">
                <Sparkles className="w-3 h-3 text-amber-300" />
                <span>نسخه امن فروشگاهی و انبارداری</span>
              </div>
            )}
          </div>

          {/* Form Content */}
          <div className="p-6 sm:p-8 space-y-5">
            {successMessage && (
              <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs font-bold text-emerald-700 flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{successMessage}</span>
              </div>
            )}

            {errorMessage && (
              <div
                id="login-error-alert"
                className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-xs font-bold text-rose-700 flex items-center gap-2.5 animate-in fade-in"
              >
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              {/* Username Input */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5" htmlFor="login-username">
                  نام کاربری (لاتین)
                </label>
                <div className="relative">
                  <input
                    type="text"
                    id="login-username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="مثال: admin یا cashier1"
                    autoFocus
                    autoComplete="username"
                    dir="ltr"
                    className="w-full pl-3 pr-10 py-3 rounded-xl text-xs bg-slate-50 border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 focus:bg-white transition-all font-mono text-slate-800"
                  />
                  <User className="w-4 h-4 text-slate-400 absolute right-3.5 top-3.5 pointer-events-none" />
                </div>
              </div>

              {/* Password Input */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5" htmlFor="login-password">
                  رمز عبور
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    id="login-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="رمز ورود خود را وارد نمایید"
                    autoComplete="current-password"
                    dir="ltr"
                    className="w-full pl-10 pr-10 py-3 rounded-xl text-xs bg-slate-50 border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 focus:bg-white transition-all font-mono text-slate-800"
                  />
                  <KeyRound className="w-4 h-4 text-slate-400 absolute right-3.5 top-3.5 pointer-events-none" />
                  <button
                    type="button"
                    id="login-toggle-show-password"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute left-3 top-3 text-slate-400 hover:text-slate-600 cursor-pointer p-1 rounded-md"
                    title={showPassword ? 'مخفی کردن رمز' : 'نمایش رمز'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  id="login-submit-button"
                  disabled={isLoading || lockoutSeconds > 0}
                  className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white py-3 px-4 rounded-xl text-xs sm:text-sm font-bold shadow-lg shadow-emerald-600/20 transition-all cursor-pointer disabled:opacity-50 disabled:bg-slate-500 disabled:cursor-not-allowed"
                >
                  <LogIn className="w-4 h-4" />
                  <span>
                    {lockoutSeconds > 0
                      ? `لطفاً ${toPersianDigits(lockoutSeconds)} ثانیه دیگر صبر کنید...`
                      : isLoading
                      ? 'در حال بررسی اطلاعات...'
                      : 'ورود به برنامه'}
                  </span>
                </button>
              </div>
            </form>

            {/* Admin Password Recovery Trigger */}
            <div className="pt-2 border-t border-slate-100 text-center">
              <button
                type="button"
                onClick={openRecoveryModal}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-emerald-600 transition-colors cursor-pointer py-1"
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>فراموشی رمز عبور ادمین؟ بازیابی رمز</span>
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full max-w-md text-center py-2 text-slate-400 text-[11px] z-10 space-y-1">
        <p className="flex items-center justify-center gap-1.5">
          <Lock className="w-3.5 h-3.5 text-emerald-400" />
          <span>امنیت دسترسی و کنترل دسترسی چندسطحی فعال است.</span>
        </p>
        <p className="text-slate-500 text-[10px]">
          تمامی حقوق محفوظ است © سامانه فروش و انبارداری
        </p>
      </footer>

      {/* Admin Password Recovery Modal */}
      {isRecoveryOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/75 backdrop-blur-xs"
          onClick={() => !recoveryLoading && setIsRecoveryOpen(false)}
        >
          <div
            className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="bg-slate-900 px-5 py-4 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center">
                  <KeyRound className="w-4 h-4 text-emerald-300" />
                </div>
                <div>
                  <h2 className="text-sm font-black">بازیابی رمز عبور مدیر سیستم</h2>
                  <p className="text-[11px] text-slate-300">بازنشانی امن از طریق تلگرام یا ترمینال سرور</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsRecoveryOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Method Tabs */}
            <div className="px-5 pt-4">
              <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 rounded-xl text-xs font-bold">
                <button
                  type="button"
                  onClick={() => {
                    setRecoveryTab('telegram');
                    setRecoveryError('');
                  }}
                  className={`py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    recoveryTab === 'telegram'
                      ? 'bg-white text-emerald-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-800'
                  }`}
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>کد تأیید تلگرام</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setRecoveryTab('vps');
                    setRecoveryError('');
                  }}
                  className={`py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    recoveryTab === 'vps'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-800'
                  }`}
                >
                  <Terminal className="w-3.5 h-3.5" />
                  <span>ترمینال VPS</span>
                </button>
              </div>
            </div>

            <div className="p-5 space-y-4">
              {recoveryTab === 'telegram' ? (
                <>
                  {!telegramRecoveryEnabled && (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 leading-relaxed">
                      ربات تلگرام یا شناسه چت مدیر در این سرور پیکربندی نشده است. در صورت عدم اتصال تلگرام، از تب <b>«ترمینال VPS»</b> استفاده کنید.
                    </div>
                  )}

                  {recoveryError && (
                    <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-bold text-rose-700 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{recoveryError}</span>
                    </div>
                  )}

                  {recoveryInfo && (
                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-bold text-emerald-700 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      <span>{recoveryInfo}</span>
                    </div>
                  )}

                  {recoveryStep === 'request' ? (
                    <form onSubmit={handleRequestTelegramOtp} className="space-y-3.5">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1.5">
                          نام کاربری ادمین
                        </label>
                        <input
                          type="text"
                          value={recoveryUsername}
                          onChange={(e) => setRecoveryUsername(e.target.value)}
                          placeholder="admin"
                          dir="ltr"
                          className="w-full px-3.5 py-2.5 rounded-xl text-xs font-mono bg-slate-50 border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                        />
                        <p className="text-[11px] text-slate-500 mt-1.5 leading-relaxed">
                          یک کد تأیید ۶ رقمی (با اعتبار ۵ دقیقه) فقط به چت تلگرام مدیر ثبت‌شده در تنظیمات ارسال می‌شود.
                        </p>
                      </div>

                      <button
                        type="submit"
                        disabled={recoveryLoading}
                        className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>{recoveryLoading ? 'در حال ارسال به تلگرام...' : 'ارسال کد بازیابی به تلگرام مدیر'}</span>
                      </button>
                    </form>
                  ) : (
                    <form onSubmit={handleConfirmTelegramRecovery} className="space-y-3">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          کد تأیید ۶ رقمی تلگرام
                        </label>
                        <input
                          type="text"
                          value={recoveryCode}
                          onChange={(e) => setRecoveryCode(e.target.value)}
                          placeholder="123456"
                          maxLength={6}
                          dir="ltr"
                          className="w-full px-3.5 py-2.5 rounded-xl text-sm font-mono text-center tracking-[0.35em] bg-slate-50 border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          رمز عبور جدید (حداقل ۴ کاراکتر)
                        </label>
                        <div className="relative">
                          <input
                            type={showRecoveryPass ? 'text' : 'password'}
                            value={recoveryNewPass}
                            onChange={(e) => setRecoveryNewPass(e.target.value)}
                            placeholder="رمز جدید ادمین"
                            dir="ltr"
                            className="w-full pl-9 pr-3 py-2.5 rounded-xl text-xs font-mono bg-slate-50 border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                          />
                          <button
                            type="button"
                            onClick={() => setShowRecoveryPass(!showRecoveryPass)}
                            className="absolute left-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                          >
                            {showRecoveryPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          تکرار رمز عبور جدید
                        </label>
                        <input
                          type={showRecoveryPass ? 'text' : 'password'}
                          value={recoveryConfirmPass}
                          onChange={(e) => setRecoveryConfirmPass(e.target.value)}
                          placeholder="تکرار رمز جدید"
                          dir="ltr"
                          className="w-full px-3 py-2.5 rounded-xl text-xs font-mono bg-slate-50 border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>

                      <div className="flex items-center gap-2 pt-1">
                        <button
                          type="submit"
                          disabled={recoveryLoading}
                          className="flex-1 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>{recoveryLoading ? 'در حال ثبت...' : 'تأیید و تغییر رمز ادمین'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setRecoveryStep('request');
                            setRecoveryError('');
                            setRecoveryInfo('');
                          }}
                          className="py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer"
                          title="درخواست مجدد کد"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </form>
                  )}
                </>
              ) : (
                <div className="space-y-3 text-xs text-slate-600 leading-relaxed">
                  <p>
                    اگر به تلگرام دسترسی ندارید، به سرور VPS خود با SSH متصل شوید و دستور زیر را اجرا کنید تا رمز عبور ادمین در هر دو پایگاه‌داده (<b>JSON</b> و <b>PostgreSQL</b>) به‌صورت امن بازنشانی شود:
                  </p>

                  <div className="bg-slate-900 text-emerald-300 rounded-xl p-3 font-mono text-[11px] flex items-center justify-between gap-2" dir="ltr">
                    <code className="overflow-x-auto whitespace-nowrap">{vpsResetCommand}</code>
                    <button
                      type="button"
                      onClick={handleCopyVpsCmd}
                      className="shrink-0 p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
                      title="کپی دستور"
                    >
                      {copiedCmd ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>

                  <p className="text-[11px] text-slate-500">
                    این اسکریپت رمز جدید را از شما دریافت کرده، با الگوریتم امن <code>scrypt</code> رمزنگاری می‌کند و قفل ورود را نیز پاکسازی می‌نماید.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
