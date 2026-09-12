import React, { useState, useMemo, useEffect } from 'react';
import { ActivityLog, ActivityActionCategory, AppUser } from '../types';
import { StorageService } from '../utils/storage';
import { toPersianDigits, getCurrentJalaliDate } from '../utils/jalali';
import {
  History,
  Search,
  Filter,
  Download,
  Trash2,
  RotateCcw,
  User,
  Clock,
  Laptop,
  Smartphone,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
  ReceiptText,
  Boxes,
  ShoppingBag,
  Users,
  Settings,
  Shield,
  Layers,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  Eye,
  X,
  Copy,
  Check,
  FileText
} from 'lucide-react';

interface ActivityLogsViewerProps {
  currentUser?: AppUser | null;
  users?: AppUser[];
}

const CATEGORY_CONFIG: Record<ActivityActionCategory, { label: string; bg: string; text: string; border: string; icon: React.FC<{ className?: string }> }> = {
  auth: {
    label: 'ورود و دسترسی',
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    border: 'border-blue-200',
    icon: Shield,
  },
  sales: {
    label: 'فاکتور فروش',
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-200',
    icon: ReceiptText,
  },
  purchase: {
    label: 'خرید کالا',
    bg: 'bg-amber-50',
    text: 'text-amber-750 text-amber-800',
    border: 'border-amber-200',
    icon: ShoppingBag,
  },
  warehouse: {
    label: 'انبار و حواله',
    bg: 'bg-purple-50',
    text: 'text-purple-700',
    border: 'border-purple-200',
    icon: Boxes,
  },
  customer: {
    label: 'طرف‌حساب و مشتری',
    bg: 'bg-cyan-50',
    text: 'text-cyan-700',
    border: 'border-cyan-200',
    icon: Users,
  },
  users: {
    label: 'مدیریت کاربران',
    bg: 'bg-rose-50',
    text: 'text-rose-700',
    border: 'border-rose-200',
    icon: User,
  },
  settings: {
    label: 'تنظیمات سامانه',
    bg: 'bg-slate-100',
    text: 'text-slate-700',
    border: 'border-slate-300',
    icon: Settings,
  },
  system: {
    label: 'سیستم و پایگاه‌داده',
    bg: 'bg-zinc-100',
    text: 'text-zinc-700',
    border: 'border-zinc-300',
    icon: Layers,
  },
};

export const ActivityLogsViewer: React.FC<ActivityLogsViewerProps> = ({ currentUser, users = [] }) => {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedDateRange, setSelectedDateRange] = useState<'all' | 'today' | 'recent'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedLogForDetails, setSelectedLogForDetails] = useState<ActivityLog | null>(null);
  const [copiedDetails, setCopiedDetails] = useState(false);
  const pageSize = 15;

  const handleCopyDetails = () => {
    if (!selectedLogForDetails) return;
    const catLabel = CATEGORY_CONFIG[selectedLogForDetails.category]?.label || selectedLogForDetails.category;
    const content = `شناسه رویداد: ${selectedLogForDetails.id}
عنوان عملیات: ${selectedLogForDetails.actionTitle}
دسته‌بندی: ${catLabel}
کاربر مجری: ${selectedLogForDetails.userName} (${selectedLogForDetails.userRoleTitle || selectedLogForDetails.userRole})
زمان ثبت: ${selectedLogForDetails.timestamp}
دستگاه / بستر: ${selectedLogForDetails.deviceInfo || 'نامشخص'}

شرح دقیق عملیات:
${selectedLogForDetails.details}`;

    navigator.clipboard.writeText(content).then(() => {
      setCopiedDetails(true);
      setTimeout(() => setCopiedDetails(false), 2000);
    }).catch(() => {});
  };

  const loadLogs = () => {
    setIsRefreshing(true);
    const loaded = StorageService.getActivityLogs();
    setLogs(loaded);
    setTimeout(() => setIsRefreshing(false), 300);
  };

  useEffect(() => {
    loadLogs();

    // Subscribe to storage changes
    const unsubscribe = StorageService.subscribe(() => {
      setLogs(StorageService.getActivityLogs());
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Filtered logs
  const filteredLogs = useMemo(() => {
    const today = getCurrentJalaliDate();

    return logs.filter((log) => {
      // 1. Search Query
      if (searchQuery.trim()) {
        const query = searchQuery.trim().toLowerCase();
        const matchesQuery = 
          log.userName.toLowerCase().includes(query) ||
          log.actionTitle.toLowerCase().includes(query) ||
          log.details.toLowerCase().includes(query) ||
          log.timestamp.includes(query) ||
          (log.deviceInfo && log.deviceInfo.toLowerCase().includes(query)) ||
          (log.userRoleTitle && log.userRoleTitle.toLowerCase().includes(query));

        if (!matchesQuery) return false;
      }

      // 2. User Filter
      if (selectedUser !== 'all') {
        if (log.userId !== selectedUser && log.userName !== selectedUser) {
          return false;
        }
      }

      // 3. Category Filter
      if (selectedCategory !== 'all') {
        if (log.category !== selectedCategory) {
          return false;
        }
      }

      // 4. Date Range Filter
      if (selectedDateRange === 'today') {
        if (log.dateOnly !== today && !log.timestamp.startsWith(today)) {
          return false;
        }
      }

      return true;
    });
  }, [logs, searchQuery, selectedUser, selectedCategory, selectedDateRange]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / pageSize));
  const paginatedLogs = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredLogs.slice(start, start + pageSize);
  }, [filteredLogs, currentPage, pageSize]);

  // Metrics
  const todayDate = getCurrentJalaliDate();
  const todayCount = useMemo(() => {
    return logs.filter((l) => l.dateOnly === todayDate || l.timestamp.startsWith(todayDate)).length;
  }, [logs, todayDate]);

  const sensitiveActionsCount = useMemo(() => {
    return logs.filter((l) => 
      l.actionType.includes('delete') || 
      l.actionType.includes('reset') || 
      l.actionType.includes('clear') ||
      l.category === 'settings'
    ).length;
  }, [logs]);

  const topUser = useMemo(() => {
    if (logs.length === 0) return null;
    const counts: Record<string, { count: number; name: string; role: string }> = {};
    logs.forEach((l) => {
      if (!counts[l.userName]) {
        counts[l.userName] = { count: 0, name: l.userName, role: l.userRoleTitle || l.userRole };
      }
      counts[l.userName].count += 1;
    });
    const sorted = Object.values(counts).sort((a, b) => b.count - a.count);
    return sorted[0] || null;
  }, [logs]);

  // Export to CSV
  const handleExportCSV = () => {
    if (filteredLogs.length === 0) {
      alert('موردی برای خروجی اکسل یافت نشد.');
      return;
    }

    const headers = ['ردیف', 'شناسه', 'کاربر انجام‌دهنده', 'سمت / نقش', 'دسته‌بندی', 'عنوان عملیات', 'جزئیات رویداد', 'تاریخ و زمان', 'محیط / دستگاه'];
    
    const rows = filteredLogs.map((l, index) => [
      index + 1,
      l.id,
      `"${l.userName.replace(/"/g, '""')}"`,
      `"${(l.userRoleTitle || l.userRole).replace(/"/g, '""')}"`,
      `"${CATEGORY_CONFIG[l.category]?.label || l.category}"`,
      `"${l.actionTitle.replace(/"/g, '""')}"`,
      `"${l.details.replace(/"/g, '""')}"`,
      `"${l.timestamp}"`,
      `"${(l.deviceInfo || '-').replace(/"/g, '""')}"`,
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `activity-logs-${todayDate.replace(/\//g, '-')}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Clear Logs
  const handleClearLogs = () => {
    if (window.confirm('آیا از پاکسازی تاریخچه رویدادها و لاگ‌های کاربران اطمینان دارید؟ این عملیات غیرقابل بازگشت است.')) {
      StorageService.clearActivityLogs();
      StorageService.logActivity({
        category: 'system',
        actionType: 'clear_logs',
        actionTitle: 'پاکسازی تاریخچه لاگ‌ها',
        details: `تاریخچه کلیه لاگ‌های پیشین توسط ${currentUser?.fullName || 'مدیر سیستم'} پاکسازی گردید.`,
      });
      loadLogs();
      setCurrentPage(1);
    }
  };

  // Unique users from logs for filter dropdown
  const uniqueLogUsers = useMemo(() => {
    const map = new Map<string, string>();
    users.forEach((u) => map.set(u.id, u.fullName));
    logs.forEach((l) => {
      if (l.userId && !map.has(l.userId)) {
        map.set(l.userId, l.userName);
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [users, logs]);

  return (
    <div id="activity-logs-viewer-container" className="space-y-6">
      
      {/* Header Banner */}
      <div className="bg-gradient-to-l from-slate-900 via-slate-800 to-indigo-950 text-white rounded-3xl p-5 sm:p-7 shadow-xl border border-slate-700/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300 shadow-inner">
            <History className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg sm:text-xl font-black tracking-tight text-white">
                لاگ رویدادها و ردگیری فعالیت کاربران
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                ثبت آنی و مرکزی
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-300 mt-1">
              مشاهده شفاف و دقیق اینکه هر کاربر در چه تاریخی و چه ساعتی چه عملیاتی را در سامانه انجام داده است
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 self-end md:self-auto flex-wrap">
          <button
            type="button"
            id="refresh-logs-btn"
            onClick={loadLogs}
            disabled={isRefreshing}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold backdrop-blur-sm transition-all border border-white/10 cursor-pointer disabled:opacity-50"
            title="به‌روزرسانی و واکشی آخرین رویدادها"
          >
            <RotateCcw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>بروزرسانی</span>
          </button>

          <button
            type="button"
            id="export-logs-csv-btn"
            onClick={handleExportCSV}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-950/40 transition-all cursor-pointer"
            title="دریافت فایل اکسل لاگ‌ها با انکودینگ فارسی UTF-8"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>خروجی اکسل (CSV)</span>
          </button>

          {currentUser?.permissions.canAccessAdmin && (
            <button
              type="button"
              id="clear-logs-btn"
              onClick={handleClearLogs}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 hover:text-white text-xs font-semibold border border-rose-500/30 transition-all cursor-pointer"
              title="پاک کردن تاریخچه لاگ‌ها"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>پاکسازی تاریخچه</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
            <History className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs text-slate-500 font-medium">کل رویدادهای ثبت‌شده</div>
            <div className="text-lg sm:text-xl font-black text-slate-800 mt-0.5">
              {toPersianDigits(logs.length)} <span className="text-xs font-normal text-slate-400">عملیات</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <Clock className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs text-slate-500 font-medium">فعالیت‌های امروز ({todayDate})</div>
            <div className="text-lg sm:text-xl font-black text-emerald-600 mt-0.5">
              {toPersianDigits(todayCount)} <span className="text-xs font-normal text-slate-400">رویداد</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <User className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs text-slate-500 font-medium">فعال‌ترین کاربر سیستم</div>
            <div className="text-sm font-bold text-slate-800 truncate mt-0.5">
              {topUser ? topUser.name : '—'}
            </div>
            {topUser && (
              <div className="text-[11px] text-slate-400">
                {toPersianDigits(topUser.count)} عملیات ثبت شده
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs text-slate-500 font-medium">عملیات حساس و تنظیماتی</div>
            <div className="text-lg sm:text-xl font-black text-amber-700 mt-0.5">
              {toPersianDigits(sensitiveActionsCount)} <span className="text-xs font-normal text-slate-400">مورد</span>
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Search Panel */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-xs space-y-3.5">
        <div className="flex flex-col md:flex-row gap-3">
          {/* Search box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              id="log-search-input"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="جستجو در نام کاربر، شرح عملیات، شماره فاکتور، کالا یا جزئیات..."
              className="w-full pl-3 pr-10 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 placeholder-slate-400 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
            />
          </div>

          {/* User filter */}
          <div className="w-full md:w-56">
            <select
              id="log-user-filter"
              value={selectedUser}
              onChange={(e) => {
                setSelectedUser(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer"
            >
              <option value="all">همه کاربران سیستم ({toPersianDigits(uniqueLogUsers.length)})</option>
              {uniqueLogUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>

          {/* Category filter */}
          <div className="w-full md:w-52">
            <select
              id="log-category-filter"
              value={selectedCategory}
              onChange={(e) => {
                setSelectedCategory(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer"
            >
              <option value="all">همه دسته‌بندی‌ها</option>
              <option value="auth">ورود و احراز هویت</option>
              <option value="sales">فاکتورهای فروش</option>
              <option value="purchase">فاکتورهای خرید</option>
              <option value="warehouse">انبار و ورود کالا</option>
              <option value="customer">مشتریان و طرف‌حساب‌ها</option>
              <option value="users">کاربران و دسترسی‌ها</option>
              <option value="settings">تنظیمات سامانه</option>
              <option value="system">پشتیبان و سیستم</option>
            </select>
          </div>

          {/* Date range filter */}
          <div className="w-full md:w-44">
            <select
              id="log-date-filter"
              value={selectedDateRange}
              onChange={(e) => {
                setSelectedDateRange(e.target.value as any);
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer"
            >
              <option value="all">همه زمان‌ها</option>
              <option value="today">فقط امروز</option>
            </select>
          </div>
        </div>

        {/* Filter stats & active indicator */}
        <div className="flex items-center justify-between text-xs text-slate-500 pt-1 border-t border-slate-100">
          <div>
            نمایش <strong>{toPersianDigits(filteredLogs.length)}</strong> مورد از مجموع{' '}
            <strong>{toPersianDigits(logs.length)}</strong> لاگ ثبت‌شده
          </div>
          {(searchQuery || selectedUser !== 'all' || selectedCategory !== 'all' || selectedDateRange !== 'all') && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setSelectedUser('all');
                setSelectedCategory('all');
                setSelectedDateRange('all');
                setCurrentPage(1);
              }}
              className="text-indigo-600 hover:text-indigo-800 font-semibold cursor-pointer"
            >
              حذف همه فیلترها
            </button>
          )}
        </div>
      </div>

      {/* Logs Table / Timeline List */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        {paginatedLogs.length === 0 ? (
          <div className="text-center py-16 px-4">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
              <History className="w-8 h-8" />
            </div>
            <h3 className="text-base font-bold text-slate-800">هیچ رویدادی با شرایط انتخابی یافت نشد</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              می‌توانید فیلترها را تغییر دهید یا عبارت جستجو را پاک کنید تا کلیه وقایع ثبت‌شده نمایش داده شوند.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200/80 text-slate-600 text-xs font-bold">
                  <th className="py-3.5 px-4 w-12 text-center">#</th>
                  <th className="py-3.5 px-4 w-52">کاربر و نقش</th>
                  <th className="py-3.5 px-4 w-36">دسته‌بندی</th>
                  <th className="py-3.5 px-4 w-44">عنوان عملیات</th>
                  <th className="py-3.5 px-4 w-44 text-center">شرح و جزئیات رویداد</th>
                  <th className="py-3.5 px-4 w-48">تاریخ و زمان</th>
                  <th className="py-3.5 px-4 w-36 text-center">دستگاه</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs sm:text-sm">
                {paginatedLogs.map((log, index) => {
                  const globalIndex = (currentPage - 1) * pageSize + index + 1;
                  const catConfig = CATEGORY_CONFIG[log.category] || CATEGORY_CONFIG.system;
                  const IconComp = catConfig.icon;
                  const isMobileDevice = log.deviceInfo?.includes('موبایل') || log.deviceInfo?.includes('همراه');

                  return (
                    <tr 
                      key={log.id} 
                      className="hover:bg-slate-50/80 transition-colors group"
                    >
                      {/* Row Index */}
                      <td className="py-3.5 px-4 text-center font-mono text-xs text-slate-400">
                        {toPersianDigits(globalIndex)}
                      </td>

                      {/* User Info */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-slate-100 to-indigo-100 text-indigo-700 font-bold flex items-center justify-center text-xs shrink-0 border border-indigo-200/60 shadow-2xs">
                            {log.userName.slice(0, 1)}
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-slate-900 truncate">
                              {log.userName}
                            </div>
                            <div className="text-[11px] text-slate-500 truncate">
                              {log.userRoleTitle || log.userRole}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Category Badge */}
                      <td className="py-3.5 px-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border ${catConfig.bg} ${catConfig.text} ${catConfig.border}`}>
                          <IconComp className="w-3.5 h-3.5" />
                          <span>{catConfig.label}</span>
                        </span>
                      </td>

                      {/* Action Title */}
                      <td className="py-3.5 px-4">
                        <span className="font-bold text-slate-800">
                          {log.actionTitle}
                        </span>
                      </td>

                      {/* Detailed description button */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <button
                          type="button"
                          id={`view-log-details-${log.id}`}
                          onClick={() => {
                            setSelectedLogForDetails(log);
                            setCopiedDetails(false);
                          }}
                          className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50/90 hover:bg-indigo-600 text-indigo-700 hover:text-white text-xs font-bold border border-indigo-200/80 hover:border-indigo-600 transition-all cursor-pointer shadow-2xs hover:shadow-xs active:scale-95 group/btn"
                          title="مشاهده شرح کامل و مشخصات این رویداد در پنجره مجزا"
                        >
                          <Eye className="w-3.5 h-3.5 text-indigo-600 group-hover/btn:text-white transition-colors" />
                          <span>مشاهده جزئیات</span>
                        </button>
                      </td>

                      {/* Timestamp */}
                      <td className="py-3.5 px-4 text-slate-500 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 font-mono text-xs text-slate-600 bg-slate-50 px-2 py-1 rounded-md border border-slate-200/60 w-fit">
                          <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                          <span>{toPersianDigits(log.timestamp)}</span>
                        </div>
                      </td>

                      {/* Device / Client */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <div className="inline-flex items-center gap-1 text-[11px] text-slate-500 bg-slate-100/70 px-2 py-0.5 rounded-md">
                          {isMobileDevice ? (
                            <Smartphone className="w-3 h-3 text-emerald-600" />
                          ) : (
                            <Laptop className="w-3 h-3 text-blue-600" />
                          )}
                          <span className="truncate max-w-[90px]">{log.deviceInfo || 'وب'}</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        {totalPages > 1 && (
          <div className="p-4 bg-slate-50/80 border-t border-slate-200/80 flex items-center justify-between text-xs text-slate-600">
            <div>
              صفحه <strong>{toPersianDigits(currentPage)}</strong> از <strong>{toPersianDigits(totalPages)}</strong>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
                title="صفحه قبل"
              >
                <ChevronRight className="w-4 h-4" />
              </button>

              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                .map((p, idx, arr) => {
                  const prev = arr[idx - 1];
                  const showEllipsis = prev && p - prev > 1;
                  return (
                    <React.Fragment key={p}>
                      {showEllipsis && <span className="px-1 text-slate-400">...</span>}
                      <button
                        type="button"
                        onClick={() => setCurrentPage(p)}
                        className={`w-7 h-7 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          currentPage === p
                            ? 'bg-indigo-600 text-white shadow-xs'
                            : 'bg-white hover:bg-slate-100 border border-slate-200 text-slate-700'
                        }`}
                      >
                        {toPersianDigits(p)}
                      </button>
                    </React.Fragment>
                  );
                })}

              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
                title="صفحه بعد"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Details Modal Dialog */}
      {selectedLogForDetails && (
        <div 
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
          onClick={() => setSelectedLogForDetails(null)}
        >
          <div 
            className="bg-white rounded-3xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col my-8 animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-5 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-white/10 text-white backdrop-blur-xs border border-white/10">
                  <FileText className="w-5 h-5 text-indigo-300" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">
                    جزئیات کامل و مشخصات رویداد
                  </h3>
                  <p className="text-xs text-slate-300 mt-0.5 font-mono">
                    شناسه ثبت: {selectedLogForDetails.id}
                  </p>
                </div>
              </div>
              <button
                type="button"
                id="close-log-modal-btn"
                onClick={() => setSelectedLogForDetails(null)}
                className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                title="بستن پنجره"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-5 max-h-[calc(85vh-160px)] overflow-y-auto">
              {/* Category & Action Title Banner */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80">
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border ${CATEGORY_CONFIG[selectedLogForDetails.category]?.bg || 'bg-slate-100'} ${CATEGORY_CONFIG[selectedLogForDetails.category]?.text || 'text-slate-700'} ${CATEGORY_CONFIG[selectedLogForDetails.category]?.border || 'border-slate-300'}`}>
                    <span>{CATEGORY_CONFIG[selectedLogForDetails.category]?.label || selectedLogForDetails.category}</span>
                  </span>
                  <span className="font-black text-slate-900 text-sm">
                    {selectedLogForDetails.actionTitle}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-slate-600 font-mono bg-white px-2.5 py-1 rounded-lg border border-slate-200 shadow-2xs">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  <span>{toPersianDigits(selectedLogForDetails.timestamp)}</span>
                </div>
              </div>

              {/* Full Details Box */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-indigo-600" />
                    شرح دقیق عملیات انجام‌شده:
                  </span>
                  <button
                    type="button"
                    id="copy-log-text-btn"
                    onClick={handleCopyDetails}
                    className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-semibold cursor-pointer"
                  >
                    {copiedDetails ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="text-emerald-600">کپی شد</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>کپی متن</span>
                      </>
                    )}
                  </button>
                </div>
                <div className="p-4 rounded-2xl bg-indigo-50/50 border border-indigo-100/90 text-slate-800 text-sm leading-relaxed whitespace-pre-wrap font-medium select-text">
                  {selectedLogForDetails.details}
                </div>
              </div>

              {/* Specifications Meta Grid */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-700">مشخصات فنی و سیستمی رویداد:</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
                    <div className="text-slate-400 text-[11px]">کاربر اقدام‌کننده</div>
                    <div className="font-bold text-slate-800 flex items-center gap-1.5 truncate">
                      <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>{selectedLogForDetails.userName}</span>
                      <span className="text-slate-500 font-normal">({selectedLogForDetails.userRoleTitle || selectedLogForDetails.userRole})</span>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
                    <div className="text-slate-400 text-[11px]">دستگاه و بستر ارتباطی</div>
                    <div className="font-bold text-slate-800 flex items-center gap-1.5">
                      {selectedLogForDetails.deviceInfo?.includes('موبایل') ? (
                        <Smartphone className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      ) : (
                        <Laptop className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                      )}
                      <span>{selectedLogForDetails.deviceInfo || 'سامانه تحت وب'}</span>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
                    <div className="text-slate-400 text-[11px]">شناسه کاربری (User ID)</div>
                    <div className="font-mono text-slate-700 font-semibold truncate">
                      {selectedLogForDetails.userId}
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
                    <div className="text-slate-400 text-[11px]">کد نوع عملیات (Action Type)</div>
                    <div className="font-mono text-slate-700 font-semibold truncate">
                      {selectedLogForDetails.actionType}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              <button
                type="button"
                id="copy-full-log-btn"
                onClick={handleCopyDetails}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-bold transition-all cursor-pointer shadow-2xs"
              >
                {copiedDetails ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                <span>{copiedDetails ? 'کپی شد!' : 'کپی کل گزارش'}</span>
              </button>

              <button
                type="button"
                id="close-modal-bottom-btn"
                onClick={() => setSelectedLogForDetails(null)}
                className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all cursor-pointer shadow-xs"
              >
                بستن پنجره
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
