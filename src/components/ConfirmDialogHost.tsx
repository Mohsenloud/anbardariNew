import React, { useEffect, useState } from 'react';
import { AlertTriangle, HelpCircle, ShieldAlert, X } from 'lucide-react';
import {
  PendingConfirmRequest,
  resolveCurrentConfirm,
  subscribeConfirmDialog,
} from '../utils/confirmDialog';

export const ConfirmDialogHost: React.FC = () => {
  const [request, setRequest] = useState<PendingConfirmRequest | null>(null);

  useEffect(() => {
    return subscribeConfirmDialog(setRequest);
  }, []);

  useEffect(() => {
    if (!request) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        resolveCurrentConfirm(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [request]);

  if (!request) return null;

  const variant = request.options.variant || 'danger';
  const title =
    request.options.title ||
    (variant === 'danger'
      ? 'تأیید عملیات حساس'
      : variant === 'warning'
      ? 'هشدار و تأیید'
      : 'تأیید درخواست');
  const confirmLabel = request.options.confirmLabel || 'تأیید و ادامه';
  const cancelLabel = request.options.cancelLabel || 'انصراف';

  const headerStyle =
    variant === 'danger'
      ? 'bg-rose-50 border-rose-200 text-rose-800'
      : variant === 'warning'
      ? 'bg-amber-50 border-amber-200 text-amber-800'
      : 'bg-emerald-50 border-emerald-200 text-emerald-800';

  const confirmBtnStyle =
    variant === 'danger'
      ? 'bg-rose-600 hover:bg-rose-700 text-white'
      : variant === 'warning'
      ? 'bg-amber-600 hover:bg-amber-700 text-white'
      : 'bg-emerald-600 hover:bg-emerald-700 text-white';

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={() => resolveCurrentConfirm(false)}
    >
      <div
        className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden text-right"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`px-5 py-4 border-b flex items-center justify-between ${headerStyle}`}>
          <div className="flex items-center gap-2.5">
            {variant === 'danger' ? (
              <ShieldAlert className="w-5 h-5 shrink-0" />
            ) : variant === 'warning' ? (
              <AlertTriangle className="w-5 h-5 shrink-0" />
            ) : (
              <HelpCircle className="w-5 h-5 shrink-0" />
            )}
            <h3 className="font-extrabold text-sm">{title}</h3>
          </div>
          <button
            type="button"
            onClick={() => resolveCurrentConfirm(false)}
            className="p-1 rounded-lg hover:bg-black/5 transition-colors cursor-pointer"
            aria-label="بستن"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5">
          <p className="text-xs sm:text-sm text-slate-700 leading-relaxed whitespace-pre-line">
            {request.message}
          </p>
        </div>

        <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={() => resolveCurrentConfirm(false)}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={() => resolveCurrentConfirm(true)}
            className={`px-4 py-2 rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer ${confirmBtnStyle}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
