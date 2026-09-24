import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RotateCcw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[220px] p-6 flex flex-col items-center justify-center text-center bg-rose-50/70 border border-rose-200 rounded-2xl m-3">
          <div className="w-12 h-12 rounded-2xl bg-rose-100 flex items-center justify-center text-rose-600 mb-3 shadow-xs">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h3 className="font-bold text-base text-slate-800 mb-1">
            {this.props.fallbackTitle || 'خطایی در نمایش این بخش رخ داد'}
          </h3>
          <p className="text-xs text-slate-600 max-w-md mb-4 leading-relaxed">
            سیستم برای جلوگیری از توقف برنامه این بخش را مدیریت کرد. می‌توانید با کلیک روی دکمه زیر دوباره تلاش نمایید یا پنجره را ببندید.
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={this.handleReset}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>تلاش مجدد</span>
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer"
            >
              <Home className="w-3.5 h-3.5" />
              <span>بارگذاری مجدد صفحه</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
