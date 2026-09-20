import React, { useState, useEffect } from 'react';
import { StorageService } from '../utils/storage';
import { ServerBackupInfo, AppUser } from '../types';
import { toPersianDigits } from '../utils/jalali';
import {
  ShieldCheck,
  Database,
  Download,
  Upload,
  RotateCcw,
  Trash2,
  Clock,
  CheckCircle2,
  AlertTriangle,
  FileCheck,
  RefreshCw,
  Lock,
  Archive,
  Layers,
  HardDrive,
  Terminal,
  Copy,
  Check,
  Server,
  Activity,
  Sparkles,
  Cpu,
  ExternalLink,
  FileCode,
  Code2,
} from 'lucide-react';

interface BackupManagerProps {
  currentUser?: AppUser;
  onDataRestored?: () => void;
}

export const BackupManager: React.FC<BackupManagerProps> = ({
  currentUser,
  onDataRestored,
}) => {
  const [backups, setBackups] = useState<ServerBackupInfo[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [autoBackupInterval, setAutoBackupInterval] = useState<number>(4);
  const [newLabel, setNewLabel] = useState<string>('');
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [confirmRestoreFile, setConfirmRestoreFile] = useState<ServerBackupInfo | null>(null);

  // PostgreSQL & Database Diagnostics State
  const [dbDiag, setDbDiag] = useState<any>(null);
  const [testingDb, setTestingDb] = useState<boolean>(false);
  const [syncingDb, setSyncingDb] = useState<boolean>(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [showTerminalGuide, setShowTerminalGuide] = useState<boolean>(false);

  // PostgreSQL SQL Backup & Restore States
  const [downloadingSql, setDownloadingSql] = useState<boolean>(false);
  const [importingSql, setImportingSql] = useState<boolean>(false);
  const [sqlFileContent, setSqlFileContent] = useState<string>('');
  const [sqlFileName, setSqlFileName] = useState<string>('');
  const [showSqlModal, setShowSqlModal] = useState<boolean>(false);
  const [snapshotLabel, setSnapshotLabel] = useState<string>('');
  const [creatingSnapshot, setCreatingSnapshot] = useState<boolean>(false);

  // Load backups on mount
  const fetchBackups = async () => {
    setLoading(true);
    try {
      const res = await StorageService.getServerBackups();
      if (res.success) {
        setBackups(res.backups || []);
        if (res.autoBackupIntervalHours) {
          setAutoBackupInterval(res.autoBackupIntervalHours);
        }
      }
    } catch {
      // Offline fallback
    } finally {
      setLoading(false);
    }
  };

  // Fetch PostgreSQL & database diagnostics
  const fetchDbDiag = async () => {
    try {
      const res = await StorageService.getDatabaseStatus();
      if (res && res.success) {
        setDbDiag(res);
      }
    } catch {
      // Ignore
    }
  };

  useEffect(() => {
    fetchBackups();
    fetchDbDiag();
  }, []);

  const showNotification = (type: 'success' | 'error', text: string) => {
    setStatusMessage({ type, text });
    setTimeout(() => setStatusMessage(null), 5000);
  };

  // Copy command to clipboard with visual feedback
  const handleCopyCommand = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  // Live Test Database Connection
  const handleTestDatabaseConnection = async () => {
    setTestingDb(true);
    try {
      const res = await StorageService.testDatabaseConnection();
      if (res && res.connected) {
        showNotification('success', res.message || 'اتصال به دیتابیس PostgreSQL (mana_db) با موفقیت تأیید شد.');
      } else {
        showNotification('error', (res && res.message) || 'عدم دسترسی به سرور پایگاه داده PostgreSQL.');
      }
      await fetchDbDiag();
    } catch {
      showNotification('error', 'خطا در برقراری ارتباط با سرور.');
    } finally {
      setTestingDb(false);
    }
  };

  // Force sync local state into PostgreSQL
  const handleForceSyncDatabase = async () => {
    setSyncingDb(true);
    try {
      const res = await StorageService.forceSyncToPostgres();
      if (res && res.success) {
        showNotification('success', res.message || 'کلیه اطلاعات با موفقیت در دیتابیس PostgreSQL همگام‌سازی شد.');
        await fetchDbDiag();
        await fetchBackups();
      } else {
        showNotification('error', (res && res.message) || 'خطا در ثبت اطلاعات در دیتابیس PostgreSQL.');
      }
    } catch {
      showNotification('error', 'خطا در ارتباط با سرور.');
    } finally {
      setSyncingDb(false);
    }
  };

  // Download complete PostgreSQL .sql script
  const handleDownloadSqlDump = async () => {
    setDownloadingSql(true);
    try {
      const ok = await StorageService.downloadPostgresSqlDump();
      if (ok) {
        showNotification('success', 'فایل اسکریپت SQL دیتابیس (mana_db.sql) با موفقیت دانلود شد.');
      } else {
        showNotification('error', 'خطا در دانلود فایل SQL از سرور.');
      }
    } catch {
      showNotification('error', 'خطا در دانلود فایل.');
    } finally {
      setDownloadingSql(false);
    }
  };

  // Handle SQL file selection for restore
  const handleSqlFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.sql') && !file.name.endsWith('.txt')) {
      showNotification('error', 'لطفاً یک فایل اسکریپت با فرمت .sql انتخاب کنید.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content && content.trim().length > 0) {
        setSqlFileContent(content);
        setSqlFileName(file.name);
        setShowSqlModal(true);
      } else {
        showNotification('error', 'فایل انتخابی خالی است.');
      }
    };
    reader.readAsText(file, 'UTF-8');
    e.target.value = '';
  };

  // Execute SQL restore into PostgreSQL
  const handleExecuteSqlImport = async () => {
    if (!sqlFileContent) return;
    setImportingSql(true);
    try {
      const res = await StorageService.importPostgresSqlFile(sqlFileContent);
      if (res && res.success) {
        showNotification('success', res.message || 'فایل SQL با موفقیت در دیتابیس PostgreSQL بازیابی شد.');
        setShowSqlModal(false);
        setSqlFileContent('');
        setSqlFileName('');
        await fetchDbDiag();
        await fetchBackups();
        if (onDataRestored) onDataRestored();
      } else {
        showNotification('error', (res && res.message) || 'خطا در اجرای اسکریپت SQL.');
      }
    } catch {
      showNotification('error', 'خطا در ارتباط با سرور.');
    } finally {
      setImportingSql(false);
    }
  };

  // Create PostgreSQL internal snapshot
  const handleCreatePostgresSnapshot = async () => {
    setCreatingSnapshot(true);
    try {
      const res = await StorageService.createPostgresSnapshot(snapshotLabel.trim() || undefined);
      if (res && res.success) {
        showNotification('success', res.message || 'اسنپ‌شات در جدول پشتیبان‌های دیتابیس PostgreSQL ثبت شد.');
        setSnapshotLabel('');
        await fetchDbDiag();
      } else {
        showNotification('error', (res && res.message) || 'خطا در ثبت اسنپ‌شات دیتابیس.');
      }
    } catch {
      showNotification('error', 'خطا در ارتباط با سرور.');
    } finally {
      setCreatingSnapshot(false);
    }
  };

  // Handle manual backup creation
  const handleCreateBackup = async () => {
    setActionLoading(true);
    try {
      const res = await StorageService.createServerBackup(newLabel.trim() || undefined);
      if (res.success) {
        showNotification('success', res.message || 'نسخه پشتیبان با موفقیت ثبت شد.');
        setNewLabel('');
        setShowCreateModal(false);
        if (res.backups) {
          setBackups(res.backups);
        } else {
          fetchBackups();
        }
      } else {
        showNotification('error', res.message || 'خطا در ایجاد نسخه پشتیبان.');
      }
    } catch {
      showNotification('error', 'خطا در ارتباط با سرور.');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle restore
  const handleExecuteRestore = async () => {
    if (!confirmRestoreFile) return;
    setActionLoading(true);
    try {
      const res = await StorageService.restoreServerBackup(confirmRestoreFile.filename);
      if (res.success) {
        showNotification('success', res.message || 'اطلاعات با موفقیت به نسخه انتخاب‌شده بازگردانی شد.');
        setConfirmRestoreFile(null);
        await fetchBackups();
        if (onDataRestored) {
          onDataRestored();
        }
      } else {
        showNotification('error', res.message || 'خطا در بازیابی اطلاعات.');
      }
    } catch {
      showNotification('error', 'خطا در اجرای بازیابی سرور.');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle delete
  const handleDeleteBackup = async (filename: string, label: string) => {
    if (!window.confirm(`آیا از حذف این نسخه پشتیبان (${label}) اطمینان دارید؟`)) {
      return;
    }
    setActionLoading(true);
    try {
      const res = await StorageService.deleteServerBackup(filename);
      if (res.success) {
        showNotification('success', 'فایل پشتیبان با موفقیت حذف شد.');
        if (res.backups) {
          setBackups(res.backups);
        } else {
          fetchBackups();
        }
      } else {
        showNotification('error', res.message || 'خطا در حذف فایل.');
      }
    } catch {
      showNotification('error', 'خطا در ارتباط با سرور.');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle file upload
  const handleUploadFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const content = event.target?.result as string;
      if (!content) return;

      const shouldRestoreNow = window.confirm(
        'فایل پشتیبان انتخاب شد. آیا می‌خواهید اطلاعات بلافاصله بازگردانی و اعمال شود؟\n\n(در صورت انتخاب انصراف، فایل فقط در لیست نسخه‌های پشتیبان سرور ذخیره می‌گردد.)'
      );

      setActionLoading(true);
      try {
        const res = await StorageService.uploadServerBackup(
          content,
          shouldRestoreNow,
          `فایل بارگذاری‌شده (${file.name})`
        );
        if (res.success) {
          showNotification('success', res.message || 'فایل پشتیبان با موفقیت پردازش شد.');
          if (res.backups) {
            setBackups(res.backups);
          } else {
            fetchBackups();
          }
          if (shouldRestoreNow && onDataRestored) {
            onDataRestored();
          }
        } else {
          showNotification('error', res.message || 'فایل پشتیبان نامعتبر است.');
        }
      } catch {
        showNotification('error', 'خطا در ارسال فایل به سرور.');
      } finally {
        setActionLoading(false);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const formatFileSize = (bytes: number): string => {
    if (!bytes || bytes === 0) return '۰ کیلوبایت';
    if (bytes < 1024) return `${toPersianDigits(bytes)} بایت`;
    const kb = Math.round(bytes / 1024);
    if (kb < 1024) return `${toPersianDigits(kb)} کیلوبایت`;
    const mb = (bytes / (1024 * 1024)).toFixed(1);
    return `${toPersianDigits(mb)} مگابایت`;
  };

  const getTriggerBadge = (trigger: string) => {
    switch (trigger) {
      case 'auto':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
            <Clock className="w-3 h-3 text-emerald-600" />
            خودکار
          </span>
        );
      case 'pre-restore':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
            <ShieldCheck className="w-3 h-3 text-amber-600" />
            اضطراری قبل بازیابی
          </span>
        );
      case 'startup':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
            <Layers className="w-3 h-3 text-blue-600" />
            راه‌اندازی سیستم
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
            <CheckCircle2 className="w-3 h-3 text-purple-600" />
            دستی
          </span>
        );
    }
  };

  const formatIsoToPersianTime = (isoString: string): string => {
    try {
      const date = new Date(isoString);
      return new Intl.DateTimeFormat('fa-IR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(date);
    } catch {
      return isoString;
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {statusMessage && (
        <div
          className={`p-3.5 rounded-xl text-xs font-bold flex items-center justify-between gap-3 shadow-xs animate-in fade-in transition-all ${
            statusMessage.type === 'success'
              ? 'bg-emerald-500 text-white'
              : 'bg-rose-500 text-white'
          }`}
        >
          <div className="flex items-center gap-2">
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 shrink-0" />
            )}
            <span>{statusMessage.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setStatusMessage(null)}
            className="text-white/80 hover:text-white text-xs cursor-pointer font-bold px-1"
          >
            ✕
          </button>
        </div>
      )}

      {/* 0. POSTGRESQL (mana_db) ACCESS & LIVE DIAGNOSTICS CARD */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 sm:p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div className="flex items-start sm:items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 border border-blue-200 flex items-center justify-center shrink-0">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-slate-900">
                  وضعیت و پیکربندی پایگاه‌داده مرکزی (PostgreSQL - mana_db)
                </h3>
                {dbDiag?.postgres?.connected ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    متصل به mana_db
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                    ذخیره‌سازی محلی (فایل پیش‌فرض)
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                مدیریت نحوه اتصال، پارامترهای کانکشن‌پول، همگام‌سازی خودکار و دستورات مدیریتی پایگاه‌داده در سرور
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
            <button
              type="button"
              onClick={handleTestDatabaseConnection}
              disabled={testingDb}
              className="py-2 px-3 bg-blue-50 hover:bg-blue-100 active:scale-95 text-blue-800 border border-blue-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Activity className={`w-3.5 h-3.5 ${testingDb ? 'animate-spin' : ''}`} />
              <span>{testingDb ? 'در حال تست...' : 'تست زنده اتصال'}</span>
            </button>

            <button
              type="button"
              onClick={handleForceSyncDatabase}
              disabled={syncingDb}
              className="py-2 px-3 bg-emerald-50 hover:bg-emerald-100 active:scale-95 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              title="همگام‌سازی آنی تمام رکوردها با دیتابیس PostgreSQL"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncingDb ? 'animate-spin' : ''}`} />
              <span>{syncingDb ? 'در حال ذخیره‌سازی...' : 'همگام‌سازی فوری'}</span>
            </button>

            <button
              type="button"
              onClick={() => setShowTerminalGuide(!showTerminalGuide)}
              className="py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Terminal className="w-3.5 h-3.5 text-slate-600" />
              <span>{showTerminalGuide ? 'بستن دستورات ترمینال' : 'دستورات داکر و شل'}</span>
            </button>
          </div>
        </div>

        {/* Database Metric Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl">
            <span className="text-[10px] text-slate-500 font-bold block mb-1">نام پایگاه‌داده (Database)</span>
            <span className="font-mono text-xs font-bold text-slate-800">
              {dbDiag?.postgres?.database || 'mana_db'}
            </span>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl">
            <span className="text-[10px] text-slate-500 font-bold block mb-1">کاربر دیتابیس (User)</span>
            <span className="font-mono text-xs font-bold text-slate-800">
              {dbDiag?.postgres?.user || 'mana_user'}
            </span>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl">
            <span className="text-[10px] text-slate-500 font-bold block mb-1">میزبان و پورت (Host : Port)</span>
            <span className="font-mono text-xs font-bold text-slate-800">
              {dbDiag?.postgres?.host || 'postgres'}:5432
            </span>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl">
            <span className="text-[10px] text-slate-500 font-bold block mb-1">زمان پاسخ و پینگ (Latency)</span>
            <span className="font-mono text-xs font-bold text-slate-800">
              {dbDiag?.postgres?.latencyMs !== undefined
                ? `${toPersianDigits(dbDiag.postgres.latencyMs)} میلی‌ثانیه`
                : 'آفلاین'}
            </span>
          </div>
        </div>

        {/* Diagnostic message or status details */}
        {dbDiag?.postgres?.message && (
          <div className={`p-3 rounded-xl text-xs flex items-center justify-between gap-2 ${
            dbDiag.postgres.connected
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-slate-100 text-slate-700 border border-slate-200'
          }`}>
            <div className="flex items-center gap-2">
              {dbDiag.postgres.connected ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <HardDrive className="w-4 h-4 text-slate-500 shrink-0" />
              )}
              <span>{dbDiag.postgres.message}</span>
            </div>
            {dbDiag.postgres.connected && dbDiag.postgres.tablesCount !== undefined && (
              <span className="font-bold text-[11px] bg-emerald-100 px-2 py-0.5 rounded-full text-emerald-900 shrink-0">
                {toPersianDigits(dbDiag.postgres.tablesCount)} جدول فعال
              </span>
            )}
          </div>
        )}

        {/* Collapsible Terminal & Docker Commands Guide */}
        {showTerminalGuide && (
          <div className="p-4 bg-slate-900 rounded-xl text-slate-100 space-y-4 border border-slate-800 text-xs animate-in fade-in">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2 text-emerald-400 font-bold">
                <Terminal className="w-4 h-4" />
                <span>دستورات کاربردی ترمینال سرور برای پایگاه‌داده PostgreSQL (محیط داکر)</span>
              </div>
              <span className="text-[10px] text-slate-400">کلیک روی دکمه برای کپی</span>
            </div>

            <div className="space-y-3">
              {/* Command 1: Interactive psql */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-slate-300 font-bold text-[11px]">
                  <span>۱. ورود مستقیم به خط فرمان PostgreSQL (psql) داخل کانتینر:</span>
                  <button
                    type="button"
                    onClick={() =>
                      handleCopyCommand(
                        'docker exec -it mana_postgres_db psql -U mana_user -d mana_db',
                        'cmd1'
                      )
                    }
                    className="p-1 px-2 rounded bg-slate-800 hover:bg-slate-700 text-[10px] text-emerald-400 flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    {copiedKey === 'cmd1' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedKey === 'cmd1' ? 'کپی شد' : 'کپی دستور'}</span>
                  </button>
                </div>
                <div className="p-2.5 bg-black/70 rounded-lg font-mono text-[11px] text-emerald-300 text-left overflow-x-auto" dir="ltr">
                  docker exec -it mana_postgres_db psql -U mana_user -d mana_db
                </div>
              </div>

              {/* Command 2: pg_dump backup */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-slate-300 font-bold text-[11px]">
                  <span>۲. پشتیبان‌گیری کامل و خروجی SQL از mana_db:</span>
                  <button
                    type="button"
                    onClick={() =>
                      handleCopyCommand(
                        'docker exec -t mana_postgres_db pg_dump -U mana_user mana_db > /var/backups/mana_db_$(date +%Y%m%d).sql',
                        'cmd2'
                      )
                    }
                    className="p-1 px-2 rounded bg-slate-800 hover:bg-slate-700 text-[10px] text-emerald-400 flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    {copiedKey === 'cmd2' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedKey === 'cmd2' ? 'کپی شد' : 'کپی دستور'}</span>
                  </button>
                </div>
                <div className="p-2.5 bg-black/70 rounded-lg font-mono text-[11px] text-emerald-300 text-left overflow-x-auto" dir="ltr">
                  docker exec -t mana_postgres_db pg_dump -U mana_user mana_db &gt; /var/backups/mana_db_$(date +%Y%m%d).sql
                </div>
              </div>

              {/* Command 3: restore sql */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-slate-300 font-bold text-[11px]">
                  <span>۳. بازیابی (Restore) فایل بکاپ SQL در دیتابیس mana_db:</span>
                  <button
                    type="button"
                    onClick={() =>
                      handleCopyCommand(
                        'cat /var/backups/your_backup.sql | docker exec -i mana_postgres_db psql -U mana_user -d mana_db',
                        'cmd3'
                      )
                    }
                    className="p-1 px-2 rounded bg-slate-800 hover:bg-slate-700 text-[10px] text-emerald-400 flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    {copiedKey === 'cmd3' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedKey === 'cmd3' ? 'کپی شد' : 'کپی دستور'}</span>
                  </button>
                </div>
                <div className="p-2.5 bg-black/70 rounded-lg font-mono text-[11px] text-emerald-300 text-left overflow-x-auto" dir="ltr">
                  cat /var/backups/your_backup.sql | docker exec -i mana_postgres_db psql -U mana_user -d mana_db
                </div>
              </div>

              {/* Command 4: logs */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-slate-300 font-bold text-[11px]">
                  <span>۴. مشاهده زنده لاگ‌های کانتینر PostgreSQL:</span>
                  <button
                    type="button"
                    onClick={() =>
                      handleCopyCommand('docker compose logs -f postgres', 'cmd4')
                    }
                    className="p-1 px-2 rounded bg-slate-800 hover:bg-slate-700 text-[10px] text-emerald-400 flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    {copiedKey === 'cmd4' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedKey === 'cmd4' ? 'کپی شد' : 'کپی دستور'}</span>
                  </button>
                </div>
                <div className="p-2.5 bg-black/70 rounded-lg font-mono text-[11px] text-emerald-300 text-left overflow-x-auto" dir="ltr">
                  docker compose logs -f postgres
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 0.1 POSTGRESQL (mana_db) DEDICATED SQL FILE BACKUP & RESTORE SECTION */}
      <div className="bg-gradient-to-r from-blue-900 to-indigo-950 rounded-2xl p-5 sm:p-6 text-white shadow-sm border border-blue-800/40 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />

        <div className="relative z-10 space-y-5">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-blue-500/20 border border-blue-400/30 text-blue-300">
                <FileCode className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-black text-white">پشتیبان‌گیری و بازیابی اختصاصی فایل دیتابیس (PostgreSQL - mana_db)</h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-400/20 text-blue-200 border border-blue-400/30">
                    فرمت استاندارد .sql
                  </span>
                </div>
                <p className="text-xs text-blue-200/80 mt-0.5">
                  استخراج اسکریپت ساختار و داده‌های جداول دیتابیس mana_db، اجرای مستقیم کوئری‌ها و ذخیره اسنپ‌شات در سرور
                </p>
              </div>
            </div>

            {/* Quick Export SQL Button */}
            <button
              type="button"
              onClick={handleDownloadSqlDump}
              disabled={downloadingSql}
              className="px-4 py-2.5 bg-blue-500 hover:bg-blue-400 active:scale-95 text-slate-950 font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 self-start md:self-auto shrink-0"
            >
              <Download className={`w-4 h-4 ${downloadingSql ? 'animate-bounce' : ''}`} />
              <span>{downloadingSql ? 'در حال ایجاد فایل...' : 'دانلود فایل دیتابیس (mana_db.sql)'}</span>
            </button>
          </div>

          {/* Sub-cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
            {/* Card 1: SQL Dump Export Info */}
            <div className="p-4 rounded-xl bg-slate-900/80 border border-blue-500/20 space-y-2">
              <div className="flex items-center gap-2 text-blue-300 font-bold text-xs">
                <Database className="w-4 h-4" />
                <span>۱. خروجی اسکریپت کامل SQL</span>
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                تولید اسکریپت جامع DDL/DML شامل جداول system_state، کالاها، مشتریان، فاکتورها و انبارها سازگار با تمام نسخه‌های PostgreSQL و ابزارهای DBeaver و pgAdmin.
              </p>
              <button
                type="button"
                onClick={handleDownloadSqlDump}
                disabled={downloadingSql}
                className="w-full py-2 bg-blue-600/30 hover:bg-blue-600/50 text-blue-200 border border-blue-400/30 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer mt-2"
              >
                <Download className="w-3.5 h-3.5" />
                <span>استخراج و دریافت فایل .sql</span>
              </button>
            </div>

            {/* Card 2: SQL Import / Restore */}
            <div className="p-4 rounded-xl bg-slate-900/80 border border-blue-500/20 space-y-2">
              <div className="flex items-center gap-2 text-amber-300 font-bold text-xs">
                <Upload className="w-4 h-4" />
                <span>۲. بازیابی و اجرای فایل SQL</span>
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                انتخاب فایل اسکریپت .sql برای بازگردانی ساختار و اطلاعات به پایگاه‌داده PostgreSQL با تراکنش امن و جلوگیری از بروز خطا.
              </p>
              <label className="w-full py-2 bg-amber-600/20 hover:bg-amber-600/30 text-amber-200 border border-amber-400/30 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer mt-2">
                <Upload className="w-3.5 h-3.5" />
                <span>انتخاب و بارگذاری فایل .sql</span>
                <input
                  type="file"
                  accept=".sql,.txt"
                  className="hidden"
                  onChange={handleSqlFileSelect}
                />
              </label>
            </div>

            {/* Card 3: Internal Snapshot in db_backups */}
            <div className="p-4 rounded-xl bg-slate-900/80 border border-blue-500/20 space-y-2">
              <div className="flex items-center gap-2 text-emerald-300 font-bold text-xs">
                <Archive className="w-4 h-4" />
                <span>۳. ثبت نسخه در جدول db_backups</span>
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                ایجاد یک اسنپ‌شات دائمی در جدول پشتیبان‌های خود دیتابیس PostgreSQL بدون نیاز به نگهداری فایل در دیسک خارجی.
              </p>
              <div className="flex gap-1.5 mt-2">
                <input
                  type="text"
                  placeholder="عنوان یا برچسب نسخه..."
                  value={snapshotLabel}
                  onChange={(e) => setSnapshotLabel(e.target.value)}
                  className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-[11px] text-white outline-none focus:border-emerald-400"
                />
                <button
                  type="button"
                  onClick={handleCreatePostgresSnapshot}
                  disabled={creatingSnapshot}
                  className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50 shrink-0"
                >
                  <Sparkles className={`w-3 h-3 ${creatingSnapshot ? 'animate-spin' : ''}`} />
                  <span>ثبت</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 1. Automated Health & Hardening Banner */}
      <div className="bg-gradient-to-br from-emerald-900 to-slate-900 rounded-2xl p-5 sm:p-6 text-white shadow-sm border border-emerald-800/40 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl -ml-20 -mt-20 pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-emerald-500/20 border border-emerald-400/30 text-emerald-400">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-black text-white">سامانه هوشمند پشتیبان‌گیری خودکار و ایمنی دیتابیس</h3>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-400/20 text-emerald-300 border border-emerald-400/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    محافظت پیوسته فعال
                  </span>
                </div>
                <p className="text-xs text-slate-300 mt-0.5">
                  پایگاه‌داده به صورت خودکار هر {toPersianDigits(autoBackupInterval)} ساعت یک‌بار و قبل از هرگونه تغییر عمده نسخه پشتیبان ثبت می‌کند.
                </p>
              </div>
            </div>

            {/* Hardening Badges */}
            <div className="flex flex-wrap gap-2 pt-2">
              <span className="inline-flex items-center gap-1.5 bg-slate-800/80 border border-slate-700/60 px-2.5 py-1 rounded-lg text-[11px] text-slate-300">
                <Lock className="w-3.5 h-3.5 text-emerald-400" />
                تراکنش‌های اتمیک (Atomic File Writes)
              </span>
              <span className="inline-flex items-center gap-1.5 bg-slate-800/80 border border-slate-700/60 px-2.5 py-1 rounded-lg text-[11px] text-slate-300">
                <FileCheck className="w-3.5 h-3.5 text-blue-400" />
                کنترل یکپارچگی SHA-256
              </span>
              <span className="inline-flex items-center gap-1.5 bg-slate-800/80 border border-slate-700/60 px-2.5 py-1 rounded-lg text-[11px] text-slate-300">
                <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                بازیابی خودکار در صورت آسیب به فایل دیتابیس
              </span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              disabled={actionLoading}
              className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-emerald-950 font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Archive className="w-4 h-4" />
              <span>+ ایجاد پشتیبان فوری با برچسب</span>
            </button>
            <button
              type="button"
              onClick={fetchBackups}
              disabled={loading || actionLoading}
              className="px-3 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl border border-slate-700 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              title="بروزرسانی لیست"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              <span className="sm:hidden">بروزرسانی</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Quick Actions Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Upload and import external backup */}
        <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs space-y-3">
          <div className="flex items-center gap-2 text-blue-700">
            <Upload className="w-5 h-5" />
            <h4 className="font-bold text-xs text-slate-900">بارگذاری و بازیابی از فایل خارجی</h4>
          </div>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            فایل JSON پشتیبان قبلی خود را انتخاب کنید. سیستم صحت ساختار را بررسی کرده و می‌توانید آن را در سرور ذخیره یا فوراً بازیابی کنید.
          </p>
          <label className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer text-center">
            <Upload className="w-4 h-4" />
            <span>انتخاب و بارگذاری فایل پشتیبان</span>
            <input
              type="file"
              accept=".json"
              onChange={handleUploadFile}
              disabled={actionLoading}
              className="hidden"
            />
          </label>
        </div>

        {/* Live snapshot download */}
        <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs space-y-3">
          <div className="flex items-center gap-2 text-emerald-700">
            <Download className="w-5 h-5" />
            <h4 className="font-bold text-xs text-slate-900">دریافت نسخه پشتیبان لحظه‌ای (Off-site)</h4>
          </div>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            جهت حفظ حداکثر امنیت، می‌توانید آخرین وضعیت کل دیتابیس را به عنوان فایل استاندارد JSON دانلود و روی فلش مموری یا هارد دیسک خود ذخیره کنید.
          </p>
          <a
            href="/api/backup"
            download={`factor-backup-${new Date().toISOString().slice(0, 10)}.json`}
            className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-800 border border-slate-300 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer text-center"
          >
            <Download className="w-4 h-4 text-slate-600" />
            <span>دانلود فوری دیتابیس فعال</span>
          </a>
        </div>
      </div>

      {/* 3. Server Backups List & Timeline */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
          <div>
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-emerald-600" />
              <h4 className="font-black text-sm text-slate-900">آرشیو نسخه‌های پشتیبان ثبت‌شده در سرور</h4>
              <span className="text-[11px] bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full font-bold">
                {toPersianDigits(backups.length)} نسخه
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              سیستم حداکثر ۳۰ نسخه اخیر را با سیاست نگهداری هوشمند حفظ می‌کند و نسخه‌های قدیمی‌تر را به صورت خودکار پاکسازی می‌نماید.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-400 space-y-3">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto text-emerald-600" />
            <p className="text-xs font-bold">در حال فراخوانی لیست نسخه‌های پشتیبان از سرور...</p>
          </div>
        ) : backups.length === 0 ? (
          <div className="p-12 text-center text-slate-400 space-y-3">
            <HardDrive className="w-10 h-10 mx-auto text-slate-300" />
            <p className="text-xs font-bold text-slate-600">هنوز هیچ نسخه پشتیبانی در سرور ثبت نشده است.</p>
            <button
              type="button"
              onClick={() => handleCreateBackup()}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold cursor-pointer"
            >
              ایجاد اولین نسخه پشتیبان
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-100/75 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">عنوان و برچسب نسخه</th>
                  <th className="py-3 px-4">نوع ثبت</th>
                  <th className="py-3 px-4">تاریخ و زمان</th>
                  <th className="py-3 px-4">اقلام ذخیره‌شده</th>
                  <th className="py-3 px-4">حجم فایل</th>
                  <th className="py-3 px-4 text-center">عملیات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {backups.map((bk, index) => (
                  <tr key={bk.filename} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center font-bold text-[10px] shrink-0">
                          {toPersianDigits(index + 1)}
                        </span>
                        <div>
                          <p className="font-bold text-slate-900 text-xs">{bk.label}</p>
                          <p className="text-[10px] font-mono text-slate-400 mt-0.5">{bk.filename}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4">{getTriggerBadge(bk.trigger)}</td>
                    <td className="py-3 px-4 font-medium text-slate-600">
                      {formatIsoToPersianTime(bk.createdAt)}
                    </td>
                    <td className="py-3 px-4 text-slate-500">
                      <div className="flex flex-wrap gap-1.5 text-[10px]">
                        <span className="bg-slate-100 px-1.5 py-0.5 rounded font-medium text-slate-700">
                          {toPersianDigits(bk.stats?.productsCount ?? 0)} کالا
                        </span>
                        <span className="bg-slate-100 px-1.5 py-0.5 rounded font-medium text-slate-700">
                          {toPersianDigits(bk.stats?.invoicesCount ?? 0)} فاکتور
                        </span>
                        <span className="bg-slate-100 px-1.5 py-0.5 rounded font-medium text-slate-700">
                          {toPersianDigits(bk.stats?.customersCount ?? 0)} مشتری
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-600 font-mono text-[11px]">
                      {formatFileSize(bk.sizeBytes)}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-center gap-1.5">
                        {/* Download link */}
                        <a
                          href={`/api/backups/download/${encodeURIComponent(bk.filename)}`}
                          download={bk.filename}
                          className="p-1.5 text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                          title="دانلود فایل JSON"
                        >
                          <Download className="w-4 h-4" />
                        </a>

                        {/* Restore button */}
                        <button
                          type="button"
                          onClick={() => setConfirmRestoreFile(bk)}
                          disabled={actionLoading}
                          className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                          title="بازیابی پایگاه‌داده به این نسخه"
                        >
                          <RotateCcw className="w-3.5 h-3.5 text-amber-600" />
                          <span>بازیابی</span>
                        </button>

                        {/* Delete button */}
                        <button
                          type="button"
                          onClick={() => handleDeleteBackup(bk.filename, bk.label)}
                          disabled={actionLoading}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          title="حذف نسخه"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: Create Backup with Label */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-emerald-700">
                <Archive className="w-5 h-5" />
                <h3 className="font-black text-sm text-slate-900">ایجاد نسخه پشتیبان جدید در سرور</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              یک نسخه کامل و ایمن از تمامی اطلاعات فعلی سیستم (کالاها، فاکتورها، کاردکس و کاربران) در پوشه پشتیبان‌های سرور ذخیره می‌شود.
            </p>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                برچسب یا یادداشت این نسخه (اختیاری):
              </label>
              <input
                type="text"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="مثال: قبل از انبارگردانی پاییز، قبل از تسویه فاکتورها..."
                className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-300 focus:outline-hidden focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                dir="rtl"
                autoFocus
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={handleCreateBackup}
                disabled={actionLoading}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer transition-all flex items-center justify-center gap-1.5"
              >
                {actionLoading ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}
                <span>ذخیره نسخه پشتیبان</span>
              </button>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
              >
                انصراف
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Confirm Restore */}
      {confirmRestoreFile && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-amber-200 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3 text-amber-600 border-b border-slate-100 pb-3">
              <div className="p-2 rounded-xl bg-amber-50 border border-amber-200">
                <AlertTriangle className="w-6 h-6 text-amber-600" />
              </div>
              <div>
                <h3 className="font-black text-sm text-slate-900">تأییدیه بازیابی پایگاه‌داده</h3>
                <p className="text-[11px] text-slate-500 mt-0.5">بازگردانی به نسخه تاریخ‌دار</p>
              </div>
            </div>

            <div className="bg-amber-50/60 border border-amber-200/80 rounded-xl p-3.5 space-y-2 text-xs text-amber-900 leading-relaxed">
              <p className="font-bold">
                آیا از بازگردانی اطلاعات به نسخه زیر اطمینان دارید؟
              </p>
              <div className="bg-white p-2.5 rounded-lg border border-amber-200 text-[11px] space-y-1">
                <p><strong>عنوان:</strong> {confirmRestoreFile.label}</p>
                <p><strong>تاریخ ثبت:</strong> {formatIsoToPersianTime(confirmRestoreFile.createdAt)}</p>
                <p><strong>تعداد فاکتورها:</strong> {toPersianDigits(confirmRestoreFile.stats?.invoicesCount ?? 0)}</p>
                <p><strong>تعداد کالاها:</strong> {toPersianDigits(confirmRestoreFile.stats?.productsCount ?? 0)}</p>
              </div>
              <p className="text-[11px] text-emerald-800 font-medium">
                🛡️ <strong>سیستم محافظتی:</strong> قبل از اعمال بازیابی، یک نسخه ایمنی خودکار از وضعیت فعلی سیستم گرفته می‌شود تا هیچ داده‌ای از بین نرود.
              </p>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={handleExecuteRestore}
                disabled={actionLoading}
                className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-700 active:scale-95 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer transition-all flex items-center justify-center gap-1.5"
              >
                {actionLoading ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <RotateCcw className="w-4 h-4" />
                )}
                <span>تأیید و اجرای بازیابی</span>
              </button>
              <button
                type="button"
                onClick={() => setConfirmRestoreFile(null)}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
              >
                انصراف
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SQL Script Import & Restore Modal */}
      {showSqlModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-5 sm:p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3 text-blue-700">
              <div className="p-2.5 bg-blue-100 rounded-xl">
                <FileCode className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h4 className="font-black text-slate-800 text-base">بازیابی و اجرای فایل اسکریپت SQL</h4>
                <p className="text-xs text-slate-500 font-mono" dir="ltr">{sqlFileName}</p>
              </div>
            </div>

            <div className="bg-blue-50/60 border border-blue-200/80 rounded-xl p-3.5 space-y-2 text-xs text-blue-900 leading-relaxed">
              <p className="font-bold">
                آیا از اجرای این اسکریپت بر روی پایگاه‌داده PostgreSQL (mana_db) اطمینان دارید؟
              </p>
              <div className="bg-white p-2.5 rounded-lg border border-blue-200 text-[11px] space-y-1">
                <p><strong>نام فایل:</strong> {sqlFileName}</p>
                <p><strong>حجم اسکریپت:</strong> {toPersianDigits(Math.round(sqlFileContent.length / 1024))} کیلوبایت</p>
                <p><strong>تعداد سطرهای اسکریپت:</strong> {toPersianDigits(sqlFileContent.split('\n').length)} سطر</p>
              </div>
              <div className="p-2 bg-slate-900 text-emerald-400 font-mono text-[10px] rounded-lg max-h-24 overflow-y-auto" dir="ltr">
                {sqlFileContent.slice(0, 350)}...
              </div>
              <p className="text-[11px] text-amber-800 font-medium">
                ⚠️ <strong>هشدار:</strong> اجرای این فایل دستورات SQL را مستقیماً بر روی دیتابیس اعمال خواهد کرد. در صورت بازگشت خطا، تغییرات لغو (Rollback) می‌گردد.
              </p>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={handleExecuteSqlImport}
                disabled={importingSql}
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer transition-all flex items-center justify-center gap-1.5"
              >
                {importingSql ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}
                <span>تأیید و اجرای اسکریپت در دیتابیس</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowSqlModal(false);
                  setSqlFileContent('');
                  setSqlFileName('');
                }}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
              >
                انصراف
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
