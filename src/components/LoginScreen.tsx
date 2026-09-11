import React, { useState, useEffect } from 'react';
import { StoreSettings, AppUser } from '../types';
import { getCurrentJalaliDate, getCurrentJalaliTime } from '../utils/jalali';
import {
  Lock,
  User,
  KeyRound,
  Eye,
  EyeOff,
  LogIn,
  AlertCircle,
  ShieldCheck,
  Building2,
  CheckCircle2,
  Sparkles,
  Store,
  Clock,
  Calendar
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
  const [isLoading, setIsLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(getCurrentJalaliTime());
  const currentDate = getCurrentJalaliDate();

  // Update clock every 10 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(getCurrentJalaliTime());
    }, 10000);
    return () => clearInterval(timer);
  }, []);

  const handleLogin = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMessage('');

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

    setTimeout(() => {
      const foundUser = users.find(
        (u) => u.username.trim().toLowerCase() === cleanUsername
      );

      if (!foundUser) {
        setErrorMessage('نام کاربری یا رمز عبور اشتباه است.');
        setIsLoading(false);
        return;
      }

      if (!foundUser.isActive) {
        setErrorMessage('این حساب کاربری غیرفعال شده است. لطفاً با مدیر سیستم تماس بگیرید.');
        setIsLoading(false);
        return;
      }

      const expectedPass = (foundUser.password || foundUser.pin || '1234').trim();
      if (cleanPassword !== expectedPass) {
        setErrorMessage('رمز عبور وارد شده نادرست است.');
        setIsLoading(false);
        return;
      }

      // Success
      setIsLoading(false);
      onLoginSuccess(foundUser);
    }, 250);
  };

  const handleQuickFill = (targetUser: AppUser) => {
    setUsername(targetUser.username);
    setPassword(targetUser.password || targetUser.pin || '1234');
    setErrorMessage('');
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
                  disabled={isLoading}
                  className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white py-3 px-4 rounded-xl text-xs sm:text-sm font-bold shadow-lg shadow-emerald-600/20 transition-all cursor-pointer disabled:opacity-50"
                >
                  <LogIn className="w-4 h-4" />
                  <span>{isLoading ? 'در حال بررسی اطلاعات...' : 'ورود به برنامه'}</span>
                </button>
              </div>
            </form>

            {/* Quick Demo Helper Section */}
            {users && users.length > 0 && (
              <div className="pt-4 border-t border-slate-100">
                <div className="flex items-center justify-between mb-2 text-[11px] font-bold text-slate-500">
                  <span>حساب‌های پیش‌فرض جهت ورود آزمایشی:</span>
                  <span className="text-[10px] text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-md">
                    کلیک برای پر کردن فرم
                  </span>
                </div>
                <div className="space-y-1.5 max-h-52 overflow-y-auto pr-0.5">
                  {users.slice(0, 4).map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => handleQuickFill(u)}
                      className="w-full flex items-center justify-between p-2 rounded-xl text-xs border border-slate-100 bg-slate-50/80 hover:bg-emerald-50 hover:border-emerald-200 transition-colors text-right cursor-pointer group"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div
                          className={`w-6 h-6 rounded-md ${
                            u.role === 'admin'
                              ? 'bg-emerald-600'
                              : u.role === 'cashier'
                              ? 'bg-blue-600'
                              : u.role === 'warehouse'
                              ? 'bg-amber-600'
                              : 'bg-purple-600'
                          } text-white flex items-center justify-center font-bold text-[10px] shrink-0`}
                        >
                          {u.fullName.slice(0, 1)}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-slate-800 text-[11px] group-hover:text-emerald-800">
                              {u.fullName}
                            </span>
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-200/80 text-slate-700 font-medium">
                              {u.roleTitle}
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-400 font-mono block" dir="ltr">
                            user: <b className="text-slate-600">{u.username}</b> | pass: <b className="text-slate-600">{u.password || u.pin || '1234'}</b>
                          </span>
                        </div>
                      </div>
                      <span className="text-[10px] text-emerald-600 font-medium group-hover:underline shrink-0 mr-2">
                        انتخاب
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
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
    </div>
  );
};
