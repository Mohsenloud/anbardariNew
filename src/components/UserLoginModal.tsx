import React, { useState } from 'react';
import { AppUser } from '../types';
import {
  Lock,
  User,
  Eye,
  EyeOff,
  X,
  LogIn,
  AlertCircle,
  KeyRound,
  ShieldCheck
} from 'lucide-react';

interface UserLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  users: AppUser[];
  currentUser?: AppUser;
  // If targetUser is provided, we only ask for targetUser's password
  targetUser?: AppUser | null;
  onLoginSuccess: (user: AppUser) => void;
}

export const UserLoginModal: React.FC<UserLoginModalProps> = ({
  isOpen,
  onClose,
  users,
  currentUser,
  targetUser,
  onLoginSuccess,
}) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const isTargetMode = !!targetUser && currentUser?.role === 'admin';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setIsLoading(true);

    setTimeout(() => {
      if (isTargetMode && targetUser) {
        // Admin switching to specific target user
        const targetPass = (targetUser.password || targetUser.pin || '1234').trim();
        const currentAdminPass = (currentUser?.password || currentUser?.pin || '1234').trim();
        const entered = password.trim();

        if (entered === targetPass || entered === currentAdminPass) {
          onLoginSuccess(targetUser);
          setPassword('');
          setUsername('');
          onClose();
        } else {
          setErrorMessage('رمز عبور وارد شده نادرست است.');
        }
      } else {
        // General credential login (Username + Password)
        const cleanUsername = username.trim().toLowerCase();
        const cleanPassword = password.trim();

        if (!cleanUsername) {
          setErrorMessage('لطفاً نام کاربری را وارد کنید.');
          setIsLoading(false);
          return;
        }

        if (!cleanPassword) {
          setErrorMessage('لطفاً رمز عبور را وارد کنید.');
          setIsLoading(false);
          return;
        }

        const foundUser = users.find(
          (u) => u.username.trim().toLowerCase() === cleanUsername
        );

        if (!foundUser) {
          setErrorMessage('نام کاربری یا رمز عبور اشتباه است.');
          setIsLoading(false);
          return;
        }

        if (!foundUser.isActive) {
          setErrorMessage('این حساب کاربری غیرفعال شده است. لطفاً با مدیر تماس بگیرید.');
          setIsLoading(false);
          return;
        }

        const userPass = (foundUser.password || foundUser.pin || '1234').trim();
        if (cleanPassword !== userPass) {
          setErrorMessage('نام کاربری یا رمز عبور اشتباه است.');
          setIsLoading(false);
          return;
        }

        onLoginSuccess(foundUser);
        setUsername('');
        setPassword('');
        onClose();
      }

      setIsLoading(false);
    }, 200);
  };

  return (
    <div
      id="user-login-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div
        id="user-login-modal-box"
        className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden text-right animate-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-600 to-teal-700 px-6 py-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center shadow-inner">
              <Lock className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-extrabold text-base sm:text-lg">
                {isTargetMode ? `تأیید رمز برای ورود` : `ورود به حساب کاربری`}
              </h3>
              <p className="text-emerald-100 text-xs">
                {isTargetMode
                  ? `ورود به حساب «${targetUser?.fullName}»`
                  : `جهت حفظ امنیت، نام کاربری و رمز خود را وارد نمایید`}
              </p>
            </div>
          </div>
          <button
            type="button"
            id="login-modal-close-btn"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4 text-white" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-semibold text-rose-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
              <span>{errorMessage}</span>
            </div>
          )}

          {isTargetMode && targetUser ? (
            <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-2xl flex items-center gap-3">
              <div
                className={`w-9 h-9 rounded-xl ${
                  targetUser.role === 'admin'
                    ? 'bg-emerald-600'
                    : targetUser.role === 'cashier'
                    ? 'bg-blue-600'
                    : 'bg-amber-600'
                } text-white flex items-center justify-center font-bold text-sm shrink-0`}
              >
                {targetUser.fullName.slice(0, 1)}
              </div>
              <div className="min-w-0">
                <div className="font-bold text-slate-900 text-xs">{targetUser.fullName}</div>
                <div className="text-[11px] text-slate-500">
                  {targetUser.roleTitle} (@{targetUser.username})
                </div>
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                نام کاربری (لاتین)
              </label>
              <div className="relative">
                <input
                  type="text"
                  id="login-username-input"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="مثال: admin یا cashier1"
                  autoFocus
                  dir="ltr"
                  className="w-full pl-3 pr-9 py-2.5 rounded-xl text-xs bg-slate-50 border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 font-mono text-slate-800"
                />
                <User className="w-4 h-4 text-slate-400 absolute right-3 top-3 pointer-events-none" />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              رمز عبور
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                id="login-password-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="رمز ورود خود را وارد نمایید"
                autoFocus={isTargetMode}
                dir="ltr"
                className="w-full pl-10 pr-9 py-2.5 rounded-xl text-xs bg-slate-50 border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 font-mono text-slate-800"
              />
              <KeyRound className="w-4 h-4 text-slate-400 absolute right-3 top-3 pointer-events-none" />
              <button
                type="button"
                id="login-toggle-password-btn"
                onClick={() => setShowPassword((p) => !p)}
                className="absolute left-3 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer p-0.5"
                title={showPassword ? 'مخفی‌سازی رمز' : 'نمایش رمز'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              id="login-submit-btn"
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white py-2.5 px-4 rounded-xl text-xs font-bold shadow-md shadow-emerald-200 transition-all cursor-pointer disabled:opacity-50"
            >
              <LogIn className="w-4 h-4" />
              <span>{isLoading ? 'در حال بررسی...' : 'ورود به حساب کاربری'}</span>
            </button>
          </div>

          <div className="text-center pt-2">
            <p className="text-[11px] text-slate-400 flex items-center justify-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 inline" />
              <span>رمز ورود به سیستم توسط مدیر تعیین و مدیریت می‌گردد.</span>
            </p>
          </div>
        </form>
      </div>
    </div>
  );
};
