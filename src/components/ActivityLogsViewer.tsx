import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  ActivityLog,
  ActivityActionCategory,
  ActivityLogSeverity,
  AppUser,
} from '../types';
import { StorageService, inferClientLogSeverity } from '../utils/storage';
import {
  addDaysToJalali,
  getCurrentJalaliDate,
  jalaliToGregorian,
  toEnglishDigits,
  toPersianDigits,
} from '../utils/jalali';
import { JalaliDatePicker } from './JalaliDatePicker';
import {
  History,
  Search,
  Filter,
  Download,
  Trash2,
  User as UserIcon,
  Calendar,
  Monitor,
  Smartphone,
  Tablet,
  ShieldCheck,
  ShoppingBag,
  PackageCheck,
  Users,
  Settings,
  Cpu,
  AlertTriangle,
  Eye,
  X,
  CheckCircle2,
  RefreshCw,
  Clock,
  FileText,
  ChevronRight,
  ChevronLeft,
  ShieldAlert,
  Globe,
  Server,
  Copy,
  Check,
  RotateCcw,
  BarChart3,
  ArrowUpDown,
  Layers,
} from 'lucide-react';

interface ActivityLogsViewerProps {
  currentUser: AppUser | null;
  users?: AppUser[];
}

const CATEGORY_CONFIG: Record<
  ActivityActionCategory,
  { label: string; colorClass: string; barClass: string; icon: React.ReactNode }
> = {
  auth: {
    label: 'ورود و امنیت',
    colorClass: 'bg-indigo-50 text-indigo-800 border-indigo-200',
    barClass: 'bg-indigo-600',
    icon: <ShieldCheck className="w-3.5 h-3.5" />,
  },
  sales: {
    label: 'فروش و فاکتور',
    colorClass: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    barClass: 'bg-emerald-600',
    icon: <ShoppingBag className="w-3.5 h-3.5" />,
  },
  purchase: {
    label: 'خرید و تامین',
    colorClass: 'bg-amber-50 text-amber-800 border-amber-200',
    barClass: 'bg-amber-500',
    icon: <FileText className="w-3.5 h-3.5" />,
  },
  warehouse: {
    label: 'انبار و موجودی',
    colorClass: 'bg-sky-50 text-sky-800 border-sky-200',
    barClass: 'bg-sky-600',
    icon: <PackageCheck className="w-3.5 h-3.5" />,
  },
  customer: {
    label: 'مشتریان و مالی',
    colorClass: 'bg-purple-50 text-purple-800 border-purple-200',
    barClass: 'bg-purple-600',
    icon: <Users className="w-3.5 h-3.5" />,
  },
  users: {
    label: 'کاربران و دسترسی',
    colorClass: 'bg-rose-50 text-rose-800 border-rose-200',
    barClass: 'bg-rose-600',
    icon: <UserIcon className="w-3.5 h-3.5" />,
  },
  settings: {
    label: 'تنظیمات سیستم',
    colorClass: 'bg-slate-100 text-slate-700 border-slate-300',
    barClass: 'bg-slate-600',
    icon: <Settings className="w-3.5 h-3.5" />,
  },
  system: {
    label: 'سیستم و پشتیبان',
    colorClass: 'bg-teal-50 text-teal-800 border-teal-200',
    barClass: 'bg-teal-600',
    icon: <Cpu className="w-3.5 h-3.5" />,
  },
};

const SEVERITY_CONFIG: Record<
  ActivityLogSeverity,
  { label: string; textClass: string; badgeClass: string; rowAccent: string }
> = {
  info: {
    label: 'عادی',
    textClass: 'text-slate-600',
    badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
    rowAccent: 'hover:bg-slate-50/90',
  },
  warning: {
    label: 'هشدار / تغییر',
    textClass: 'text-amber-800',
    badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
    rowAccent: 'border-r-2 border-r-amber-400 hover:bg-amber-50/40',
  },
  critical: {
    label: 'بحرانی',
    textClass: 'text-rose-700',
    badgeClass: 'bg-rose-50 text-rose-700 border-rose-200',
    rowAccent: 'border-r-2 border-r-rose-500 bg-rose-50/25 hover:bg-rose-50/55',
  },
};

const METADATA_LABELS: Record<string, string> = {
  invoiceNumber: 'شماره فاکتور',
  customerName: 'نام مشتری / طرف حساب',
  totalAmount: 'مبلغ کل',
  paidAmount: 'مبلغ پرداختی',
  remainingAmount: 'مانده حساب',
  itemCount: 'تعداد اقلام',
  status: 'وضعیت',
  previousStatus: 'وضعیت قبلی',
  newStatus: 'وضعیت جدید',
  paymentStatus: 'وضعیت تسویه',
  paymentMethod: 'روش پرداخت',
  stockBefore: 'موجودی قبلی',
  stockAfter: 'موجودی جدید',
  delta: 'میزان تغییر',
  quantity: 'تعداد / مقدار',
  warehouseName: 'نام انبار',
  categoryName: 'دسته‌بندی',
  previousName: 'نام قبلی',
  newName: 'نام جدید',
  previousPrice: 'قیمت قبلی',
  newPrice: 'قیمت جدید',
  price: 'قیمت',
  code: 'کد کالا / شناسه',
  reason: 'علت / توضیح',
  deliveryStatus: 'وضعیت تحویل',
  driverName: 'نام راننده',
  vehiclePlate: 'پلاک خودرو',
  count: 'تعداد رکورد',
  fileName: 'نام فایل',
  type: 'نوع عملیات',
  amount: 'مبلغ',
  username: 'نام کاربری',
  role: 'نقش کاربری',
  targetUser: 'کاربر هدف',
  changedSections: 'بخش‌های تغییر یافته',
};

type SeverityFilter = 'all' | 'sensitive' | ActivityLogSeverity;
type DateRangeFilter = 'all' | 'today' | 'yesterday' | '7days' | '30days' | 'custom';
type SortOrder = 'newest' | 'oldest';

function normalizeDateKey(val?: string): string {
  const clean = toEnglishDigits(String(val || '')).trim();
  const match = clean.match(/(\d{4})\/(\d{1,2})\/(\d{1,2})/);
  if (!match) return '';
  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  return `${match[1]}/${pad(Number(match[2]))}/${pad(Number(match[3]))}`;
}

function getLogSortScore(log: ActivityLog): number {
  if (typeof log.createdAtMs === 'number' && Number.isFinite(log.createdAtMs) && log.createdAtMs > 0) {
    return log.createdAtMs;
  }
  const idMatch = String(log.id || '').match(/^log-(\d{12,15})(?:-|$)/);
  if (idMatch) {
    return Number(idMatch[1]);
  }
  const clean = toEnglishDigits(String(log.timestamp || log.dateOnly || ''));
  const m = clean.match(/(\d{4})\/(\d{1,2})\/(\d{1,2})(?:\D+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
  if (!m) return 0;
  const [gy, gm, gd] = jalaliToGregorian(Number(m[1]), Number(m[2]), Number(m[3]));
  return (
    Date.UTC(gy, gm - 1, gd, Number(m[4] || 0), Number(m[5] || 0), Number(m[6] || 0)) -
    3.5 * 3600 * 1000
  );
}

function formatRelativeTime(createdAtMs?: number): string {
  if (!createdAtMs || !Number.isFinite(createdAtMs)) return '';
  const diffSec = Math.floor((Date.now() - createdAtMs) / 1000);
  if (diffSec < 0) return 'اکنون';
  if (diffSec < 45) return 'لحظاتی پیش';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${toPersianDigits(diffMin)} دقیقه پیش`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${toPersianDigits(diffHour)} ساعت پیش`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay === 1) return 'دیروز';
  if (diffDay <= 30) return `${toPersianDigits(diffDay)} روز پیش`;
  return '';
}

function formatMetadataValue(value: unknown): string {
  if (typeof value === 'boolean') return value ? 'بله' : 'خیر';
  if (typeof value === 'number') return toPersianDigits(value.toLocaleString('en-US'));
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

function escapeCsvCell(value: unknown): string {
  const raw = String(value ?? '');
  const trimmedStart = raw.replace(/^[\u0000-\u0020]+/, '');
  const safe = /^[=+\-@]/.test(trimmedStart) || /^[\t\r]/.test(raw) ? `'${raw}` : raw;
  return `"${safe.replace(/"/g, '""')}"`;
}

export const ActivityLogsViewer: React.FC<ActivityLogsViewerProps> = ({ currentUser, users = [] }) => {
  const [logs, setLogs] = useState<ActivityLog[]>(() => StorageService.getActivityLogs());
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedSeverity, setSelectedSeverity] = useState<SeverityFilter>('all');
  const [selectedDateRange, setSelectedDateRange] = useState<DateRangeFilter>('all');
  const [customStartDate, setCustomStartDate] = useState<string>(() => addDaysToJalali(-7));
  const [customEndDate, setCustomEndDate] = useState<string>(() => getCurrentJalaliDate());
  const [sortOrder, setSortOrder] = useState<SortOrder>('newest');
  const [showVisualView, setShowVisualView] = useState<boolean>(true);
  const [hoveredDayKey, setHoveredDayKey] = useState<string | null>(null);
  const [selectedLog, setSelectedLog] = useState<ActivityLog | null>(null);
  const [isConfirmClearOpen, setIsConfirmClearOpen] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncedTime, setLastSyncedTime] = useState<string>('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [banner, setBanner] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);

  const showBanner = useCallback((type: 'success' | 'error' | 'info', message: string) => {
    setBanner({ type, message });
  }, []);

  useEffect(() => {
    if (!banner) return;
    const t = setTimeout(() => setBanner(null), 4500);
    return () => clearTimeout(t);
  }, [banner]);

  const syncLogsFromServer = useCallback(
    async (manual = false) => {
      setIsSyncing(true);
      const res = await StorageService.fetchActivityLogsFromServer();
      setLogs(res.logs);
      const now = new Date();
      const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
      setLastSyncedTime(
        toPersianDigits(`${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`)
      );
      setIsSyncing(false);

      if (manual) {
        if (res.success) {
          showBanner('success', 'لاگ‌های فعالیت از سرور با موفقیت بروزرسانی شد.');
        } else {
          showBanner('error', res.message || 'خطا در همگام‌سازی لاگ‌ها با سرور.');
        }
      }
    },
    [showBanner]
  );

  useEffect(() => {
    setLogs(StorageService.getActivityLogs());
    syncLogsFromServer(false);
    const unsub = StorageService.subscribe(() => {
      setLogs(StorageService.getActivityLogs());
    });
    return unsub;
  }, [syncLogsFromServer]);

  const isAdmin =
    currentUser?.role === 'admin' || Boolean(currentUser?.permissions?.canAccessAdmin);
  const todayJalali = getCurrentJalaliDate();
  const yesterdayJalali = useMemo(() => addDaysToJalali(-1), []);
  const weekStartJalali = useMemo(() => addDaysToJalali(-6), []);
  const monthStartJalali = useMemo(() => addDaysToJalali(-29), []);

  const userLookupMap = useMemo(() => {
    const map = new Map<string, AppUser>();
    users.forEach((u) => {
      if (u?.id) map.set(u.id, u);
    });
    return map;
  }, [users]);

  const getLogSeverity = useCallback((log: ActivityLog): ActivityLogSeverity => {
    return log.severity || inferClientLogSeverity(log.actionType, log.category);
  }, []);

  const userFilterOptions = useMemo(() => {
    const map = new Map<string, { id: string; label: string }>();
    users.forEach((u) => {
      map.set(u.id, {
        id: u.id,
        label: `${u.fullName} (${u.roleTitle || u.role})`,
      });
    });
    logs.forEach((l) => {
      if (l.userId && !map.has(l.userId)) {
        map.set(l.userId, {
          id: l.userId,
          label: `${l.userName}${l.userRoleTitle ? ` (${l.userRoleTitle})` : ''}`,
        });
      }
    });
    return Array.from(map.values());
  }, [users, logs]);

  const stats = useMemo(() => {
    const total = logs.length;
    const todayCount = logs.filter((l) => normalizeDateKey(l.dateOnly || l.timestamp) === todayJalali).length;
    const sensitiveCount = logs.filter((l) => {
      const sev = getLogSeverity(l);
      return sev === 'critical' || sev === 'warning';
    }).length;
    const criticalCount = logs.filter((l) => getLogSeverity(l) === 'critical').length;

    const userCounts: Record<string, { id: string; name: string; count: number }> = {};
    logs.forEach((l) => {
      const uid = l.userId || l.userName;
      if (!userCounts[uid]) {
        userCounts[uid] = { id: uid, name: l.userName, count: 0 };
      }
      userCounts[uid].count++;
    });

    const sortedUsers = Object.values(userCounts).sort((a, b) => b.count - a.count);
    const mostActiveUser = sortedUsers[0] || { id: '', name: '—', count: 0 };

    return {
      total,
      todayCount,
      sensitiveCount,
      criticalCount,
      mostActiveUser,
    };
  }, [logs, todayJalali, getLogSeverity]);

  const hasActiveFilters = Boolean(
    searchQuery.trim() ||
      selectedUser !== 'all' ||
      selectedCategory !== 'all' ||
      selectedSeverity !== 'all' ||
      selectedDateRange !== 'all'
  );

  const resetFilters = () => {
    setSearchQuery('');
    setSelectedUser('all');
    setSelectedCategory('all');
    setSelectedSeverity('all');
    setSelectedDateRange('all');
    setCurrentPage(1);
  };

  const matchesSearchAndSeverity = useCallback(
    (log: ActivityLog, ignoreSeverity = false): boolean => {
      if (!ignoreSeverity) {
        const sev = getLogSeverity(log);
        if (selectedSeverity === 'sensitive') {
          if (sev !== 'critical' && sev !== 'warning') return false;
        } else if (selectedSeverity !== 'all' && sev !== selectedSeverity) {
          return false;
        }
      }

      const normalizedQuery = toEnglishDigits(searchQuery.trim().toLowerCase());
      if (normalizedQuery) {
        const matchedUsername = userLookupMap.get(log.userId)?.username || '';
        const metaValues = log.metadata ? Object.values(log.metadata).map(String) : [];
        const haystack = toEnglishDigits(
          [
            log.userName,
            matchedUsername,
            log.actionTitle,
            log.details,
            log.actionType,
            log.timestamp,
            log.dateOnly,
            log.ipAddress,
            log.deviceInfo,
            log.entityType,
            log.entityId,
            log.entityLabel,
            ...metaValues,
          ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase()
        );
        if (!haystack.includes(normalizedQuery)) return false;
      }

      return true;
    },
    [getLogSeverity, selectedSeverity, searchQuery, userLookupMap]
  );

  const matchesDateRange = useCallback(
    (log: ActivityLog): boolean => {
      const logDateKey = normalizeDateKey(log.dateOnly || log.timestamp);
      const normalizedCustomStart = normalizeDateKey(customStartDate);
      const normalizedCustomEnd = normalizeDateKey(customEndDate);

      if (selectedDateRange === 'today') {
        return logDateKey === todayJalali;
      }
      if (selectedDateRange === 'yesterday') {
        return logDateKey === yesterdayJalali;
      }
      if (selectedDateRange === '7days') {
        return Boolean(logDateKey && logDateKey >= weekStartJalali && logDateKey <= todayJalali);
      }
      if (selectedDateRange === '30days') {
        return Boolean(logDateKey && logDateKey >= monthStartJalali && logDateKey <= todayJalali);
      }
      if (selectedDateRange === 'custom') {
        if (!logDateKey) return false;
        if (normalizedCustomStart && logDateKey < normalizedCustomStart) return false;
        if (normalizedCustomEnd && logDateKey > normalizedCustomEnd) return false;
        return true;
      }
      return true;
    },
    [
      selectedDateRange,
      customStartDate,
      customEndDate,
      todayJalali,
      yesterdayJalali,
      weekStartJalali,
      monthStartJalali,
    ]
  );

  const filteredLogs = useMemo(() => {
    return logs
      .filter((log) => {
        if (selectedUser !== 'all' && log.userId !== selectedUser) return false;
        if (selectedCategory !== 'all' && log.category !== selectedCategory) return false;
        if (!matchesDateRange(log)) return false;
        if (!matchesSearchAndSeverity(log)) return false;
        return true;
      })
      .sort((a, b) =>
        sortOrder === 'newest'
          ? getLogSortScore(b) - getLogSortScore(a)
          : getLogSortScore(a) - getLogSortScore(b)
      );
  }, [logs, selectedUser, selectedCategory, matchesDateRange, matchesSearchAndSeverity, sortOrder]);

  // Visual Analytics Datasets (cross-filter friendly: each chart respects the OTHER active filters)
  const timelineChartData = useMemo(() => {
    const dayBuckets = new Map<
      string,
      { dateKey: string; total: number; info: number; warning: number; critical: number }
    >();

    logs.forEach((log) => {
      if (selectedUser !== 'all' && log.userId !== selectedUser) return;
      if (selectedCategory !== 'all' && log.category !== selectedCategory) return;
      if (!matchesSearchAndSeverity(log)) return;

      const dateKey = normalizeDateKey(log.dateOnly || log.timestamp);
      if (!dateKey) return;

      const entry = dayBuckets.get(dateKey) || {
        dateKey,
        total: 0,
        info: 0,
        warning: 0,
        critical: 0,
      };
      const sev = getLogSeverity(log);
      entry.total += 1;
      entry[sev] += 1;
      dayBuckets.set(dateKey, entry);
    });

    const sortedDays = Array.from(dayBuckets.values())
      .sort((a, b) => (a.dateKey > b.dateKey ? 1 : -1))
      .slice(-14);

    const maxCount = sortedDays.reduce((m, d) => Math.max(m, d.total), 0) || 1;
    const activeSingleDate =
      selectedDateRange === 'custom' &&
      normalizeDateKey(customStartDate) &&
      normalizeDateKey(customStartDate) === normalizeDateKey(customEndDate)
        ? normalizeDateKey(customStartDate)
        : selectedDateRange === 'today'
        ? todayJalali
        : selectedDateRange === 'yesterday'
        ? yesterdayJalali
        : '';

    return { days: sortedDays, maxCount, activeSingleDate };
  }, [
    logs,
    selectedUser,
    selectedCategory,
    matchesSearchAndSeverity,
    getLogSeverity,
    selectedDateRange,
    customStartDate,
    customEndDate,
    todayJalali,
    yesterdayJalali,
  ]);

  const categoryChartData = useMemo(() => {
    const counts = new Map<ActivityActionCategory, number>();
    (Object.keys(CATEGORY_CONFIG) as ActivityActionCategory[]).forEach((cat) => counts.set(cat, 0));

    let totalInScope = 0;
    logs.forEach((log) => {
      if (selectedUser !== 'all' && log.userId !== selectedUser) return;
      if (!matchesDateRange(log)) return;
      if (!matchesSearchAndSeverity(log)) return;
      const cat = CATEGORY_CONFIG[log.category] ? log.category : 'system';
      counts.set(cat, (counts.get(cat) || 0) + 1);
      totalInScope += 1;
    });

    const items = (Object.keys(CATEGORY_CONFIG) as ActivityActionCategory[])
      .map((category) => {
        const count = counts.get(category) || 0;
        const pct = totalInScope > 0 ? Math.round((count / totalInScope) * 100) : 0;
        return { category, count, pct, config: CATEGORY_CONFIG[category] };
      })
      .filter((item) => item.count > 0 || selectedCategory === item.category)
      .sort((a, b) => b.count - a.count);

    const maxCount = items.reduce((m, i) => Math.max(m, i.count), 0) || 1;
    return { items, totalInScope, maxCount };
  }, [logs, selectedUser, matchesDateRange, matchesSearchAndSeverity, selectedCategory]);

  const userChartData = useMemo(() => {
    const map = new Map<
      string,
      {
        userId: string;
        userName: string;
        roleTitle: string;
        total: number;
        info: number;
        warning: number;
        critical: number;
      }
    >();

    let totalInScope = 0;
    logs.forEach((log) => {
      if (selectedCategory !== 'all' && log.category !== selectedCategory) return;
      if (!matchesDateRange(log)) return;
      if (!matchesSearchAndSeverity(log)) return;

      const uid = log.userId || log.userName;
      const existing = map.get(uid) || {
        userId: log.userId || uid,
        userName: log.userName || 'کاربر سیستم',
        roleTitle: log.userRoleTitle || log.userRole || '',
        total: 0,
        info: 0,
        warning: 0,
        critical: 0,
      };
      const sev = getLogSeverity(log);
      existing.total += 1;
      existing[sev] += 1;
      map.set(uid, existing);
      totalInScope += 1;
    });

    const items = Array.from(map.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);
    const maxCount = items.reduce((m, i) => Math.max(m, i.total), 0) || 1;
    return { items, totalInScope, maxCount };
  }, [logs, selectedCategory, matchesDateRange, matchesSearchAndSeverity, getLogSeverity]);

  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / itemsPerPage));

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const paginatedLogs = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredLogs.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredLogs, currentPage, itemsPerPage]);

  const handleToggleDayBar = (dateKey: string) => {
    if (timelineChartData.activeSingleDate === dateKey) {
      setSelectedDateRange('all');
    } else {
      setSelectedDateRange('custom');
      setCustomStartDate(dateKey);
      setCustomEndDate(dateKey);
    }
    setCurrentPage(1);
  };

  const handleExportCSV = () => {
    if (filteredLogs.length === 0) {
      showBanner('info', 'هیچ رکوردی مطابق با فیلترهای فعلی برای خروجی اکسل یافت نشد.');
      return;
    }

    const headers = [
      'ردیف',
      'تاریخ و زمان',
      'کاربر',
      'نام کاربری',
      'نقش',
      'دسته‌بندی',
      'سطح حساسیت',
      'مبدا ثبت',
      'نشانی IP',
      'عنوان عملیات',
      'شرح دقیق',
      'موجودیت هدف',
      'مشخصات فنی (Metadata)',
      'مشخصات دستگاه',
    ];
    const rows = filteredLogs.map((log, idx) => {
      const sev = getLogSeverity(log);
      const username = userLookupMap.get(log.userId)?.username || '';
      const targetStr = [log.entityType, log.entityLabel, log.entityId].filter(Boolean).join(' / ');
      const metaStr = log.metadata
        ? Object.entries(log.metadata)
            .map(([k, v]) => `${METADATA_LABELS[k] || k}: ${formatMetadataValue(v)}`)
            .join(' | ')
        : '';
      return [
        idx + 1,
        log.timestamp,
        log.userName,
        username || '-',
        log.userRoleTitle || log.userRole,
        CATEGORY_CONFIG[log.category]?.label || log.category,
        SEVERITY_CONFIG[sev].label,
        log.source === 'server' ? 'سرور' : 'کلاینت',
        log.ipAddress || '-',
        log.actionTitle,
        log.details,
        targetStr || '-',
        metaStr || '-',
        log.deviceInfo || 'وب',
      ].map(escapeCsvCell);
    });

    const csvContent = '\uFEFF' + [headers.map(escapeCsvCell).join(','), ...rows.map((e) => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `activity-logs-${todayJalali.replace(/\//g, '-')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showBanner('success', `فایل خروجی شامل ${toPersianDigits(filteredLogs.length)} رکورد آماده دانلود شد.`);
  };

  const handleClearLogs = async () => {
    setIsClearing(true);
    const res = await StorageService.clearActivityLogs();
    setLogs(res.logs);
    setIsClearing(false);
    setIsConfirmClearOpen(false);
    setCurrentPage(1);
    if (res.success) {
      showBanner('success', res.message || 'آرشیو لاگ‌های فعالیت پاکسازی شد.');
    } else {
      showBanner('error', res.message || 'خطا در پاکسازی لاگ‌های فعالیت.');
    }
  };

  const handleCopyLogReport = async (log: ActivityLog) => {
    const sev = getLogSeverity(log);
    const metaLines = log.metadata
      ? Object.entries(log.metadata).map(
          ([k, v]) => `  - ${METADATA_LABELS[k] || k}: ${formatMetadataValue(v)}`
        )
      : [];

    const report = [
      `شناسه رویداد: ${log.id}`,
      `زمان: ${log.timestamp}`,
      `کاربر: ${log.userName} (${log.userRoleTitle || log.userRole})`,
      `دسته‌بندی: ${CATEGORY_CONFIG[log.category]?.label || log.category}`,
      `سطح حساسیت: ${SEVERITY_CONFIG[sev].label}`,
      `عنوان: ${log.actionTitle}`,
      `شرح: ${log.details}`,
      log.ipAddress ? `IP: ${log.ipAddress}` : '',
      log.deviceInfo ? `دستگاه: ${log.deviceInfo}` : '',
      log.entityLabel || log.entityId
        ? `موجودیت هدف: ${[log.entityType, log.entityLabel, log.entityId].filter(Boolean).join(' - ')}`
        : '',
      metaLines.length > 0 ? `جزئیات ثبت‌شده:\n${metaLines.join('\n')}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    try {
      await navigator.clipboard.writeText(report);
      setCopiedId(log.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      showBanner('error', 'دسترسی به کلیپ‌بورد در مرورگر مسدود است.');
    }
  };

  const renderDeviceIcon = (deviceInfo?: string) => {
    if (!deviceInfo) return <Monitor className="w-3.5 h-3.5 text-slate-400 shrink-0" />;
    if (deviceInfo.includes('تبلت')) return <Tablet className="w-3.5 h-3.5 text-indigo-500 shrink-0" />;
    if (deviceInfo.includes('موبایل') || deviceInfo.includes('Android') || deviceInfo.includes('iOS')) {
      return <Smartphone className="w-3.5 h-3.5 text-sky-500 shrink-0" />;
    }
    return <Monitor className="w-3.5 h-3.5 text-indigo-500 shrink-0" />;
  };

  const activeFilterSummary = useMemo(() => {
    const items: string[] = [];
    if (selectedUser !== 'all') {
      const found = userFilterOptions.find((u) => u.id === selectedUser);
      items.push(`کاربر: ${found?.label || selectedUser}`);
    }
    if (selectedCategory !== 'all') {
      const cat = CATEGORY_CONFIG[selectedCategory as ActivityActionCategory];
      items.push(`دسته: ${cat?.label || selectedCategory}`);
    }
    if (selectedSeverity !== 'all') {
      items.push(
        selectedSeverity === 'sensitive'
          ? 'سطح: حساس و هشدار'
          : `سطح: ${SEVERITY_CONFIG[selectedSeverity].label}`
      );
    }
    if (selectedDateRange !== 'all') {
      if (selectedDateRange === 'today') items.push('بازه: امروز');
      else if (selectedDateRange === 'yesterday') items.push('بازه: دیروز');
      else if (selectedDateRange === '7days') items.push('بازه: ۷ روز اخیر');
      else if (selectedDateRange === '30days') items.push('بازه: ۳۰ روز اخیر');
      else if (selectedDateRange === 'custom') {
        items.push(`بازه: ${toPersianDigits(customStartDate)} تا ${toPersianDigits(customEndDate)}`);
      }
    }
    if (searchQuery.trim()) {
      items.push(`جستجو: «${searchQuery.trim()}»`);
    }
    return items;
  }, [
    selectedUser,
    userFilterOptions,
    selectedCategory,
    selectedSeverity,
    selectedDateRange,
    customStartDate,
    customEndDate,
    searchQuery,
  ]);

  const hoveredDayInfo = hoveredDayKey
    ? timelineChartData.days.find((d) => d.dateKey === hoveredDayKey) || null
    : null;

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header Toolbar */}
      <div className="bg-slate-900 rounded-2xl p-5 text-white border border-slate-800 shadow-xs">
        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-3.5">
            <div className="p-2.5 bg-indigo-500/20 border border-indigo-400/30 rounded-xl shrink-0">
              <History className="w-6 h-6 text-indigo-300" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-base sm:text-lg font-black tracking-tight text-white">
                نمای ویژوال و جدول ممیزی لاگ فعالیت‌ها
              </h2>
              <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                پایش لحظه‌ای کلیه عملیات کاربران با جزئیات کامل تغییر مقادیر، شناسه رکورد، دستگاه و نشانی شبکه
              </p>
              <div className="text-[11px] text-slate-400 mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 tabular-nums">
                <span className="text-emerald-300 font-semibold">ممیزی سرور + کلاینت</span>
                <span>·</span>
                <span>کل رکوردها: {toPersianDigits(stats.total)}</span>
                {lastSyncedTime && (
                  <>
                    <span>·</span>
                    <span>همگام‌سازی: {lastSyncedTime}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-slate-800">
            <button
              type="button"
              id="toggle-activity-visual-view-btn"
              onClick={() => setShowVisualView((v) => !v)}
              className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition-colors cursor-pointer ${
                showVisualView
                  ? 'bg-indigo-600 text-white border-indigo-500 hover:bg-indigo-500'
                  : 'bg-white/10 text-slate-200 border-white/15 hover:bg-white/20'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              <span>{showVisualView ? 'بستن نمای ویژوال' : 'نمایش نمای ویژوال'}</span>
            </button>

            <button
              type="button"
              id="refresh-activity-logs-btn"
              onClick={() => syncLogsFromServer(true)}
              disabled={isSyncing}
              className="px-3 py-2 bg-white/10 hover:bg-white/20 disabled:opacity-60 text-white border border-white/15 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'در حال دریافت...' : 'بروزرسانی'}</span>
            </button>

            <button
              type="button"
              id="export-activity-logs-csv-btn"
              onClick={handleExportCSV}
              className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>خروجی CSV</span>
            </button>

            {isAdmin && (
              <button
                type="button"
                id="clear-activity-logs-btn"
                onClick={() => setIsConfirmClearOpen(true)}
                className="px-3 py-2 bg-rose-600/90 hover:bg-rose-600 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>پاکسازی</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Inline Feedback Banner */}
      {banner && (
        <div
          role="status"
          className={`flex items-center justify-between gap-3 px-4 py-3 rounded-xl border text-xs font-bold animate-fade-in ${
            banner.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : banner.type === 'error'
              ? 'bg-rose-50 text-rose-800 border-rose-200'
              : 'bg-sky-50 text-sky-800 border-sky-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {banner.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : banner.type === 'error' ? (
              <AlertTriangle className="w-4 h-4 shrink-0" />
            ) : (
              <History className="w-4 h-4 shrink-0" />
            )}
            <span>{banner.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setBanner(null)}
            className="p-1 hover:bg-black/5 rounded-lg cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Interactive KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <button
          type="button"
          onClick={resetFilters}
          className={`text-right bg-white p-4 rounded-xl border flex items-center gap-3.5 transition-colors cursor-pointer hover:border-indigo-300 ${
            !hasActiveFilters ? 'border-indigo-400 bg-indigo-50/20' : 'border-slate-200'
          }`}
        >
          <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl shrink-0">
            <History className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-semibold text-slate-500">کل رویدادهای ثبت‌شده</div>
            <div className="text-xl font-black text-slate-900 mt-0.5 tabular-nums">
              {toPersianDigits(stats.total)}{' '}
              <span className="text-xs font-medium text-slate-500">رکورد</span>
            </div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => {
            setSelectedDateRange((prev) => (prev === 'today' ? 'all' : 'today'));
            setCurrentPage(1);
          }}
          className={`text-right bg-white p-4 rounded-xl border flex items-center gap-3.5 transition-colors cursor-pointer hover:border-emerald-300 ${
            selectedDateRange === 'today' ? 'border-emerald-500 bg-emerald-50/25' : 'border-slate-200'
          }`}
        >
          <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl shrink-0">
            <Calendar className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-semibold text-slate-500">فعالیت‌های امروز</div>
            <div className="text-xl font-black text-emerald-700 mt-0.5 tabular-nums">
              {toPersianDigits(stats.todayCount)}{' '}
              <span className="text-xs font-medium text-emerald-700/75">رویداد</span>
            </div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => {
            if (!stats.mostActiveUser.id) return;
            setSelectedUser((prev) =>
              prev === stats.mostActiveUser.id ? 'all' : stats.mostActiveUser.id
            );
            setCurrentPage(1);
          }}
          className={`text-right bg-white p-4 rounded-xl border flex items-center gap-3.5 transition-colors cursor-pointer hover:border-amber-300 ${
            stats.mostActiveUser.id && selectedUser === stats.mostActiveUser.id
              ? 'border-amber-500 bg-amber-50/25'
              : 'border-slate-200'
          }`}
        >
          <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl shrink-0">
            <UserIcon className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-semibold text-slate-500">فعال‌ترین کاربر</div>
            <div className="text-sm font-black text-slate-900 mt-0.5 truncate">
              {stats.mostActiveUser.name}
            </div>
            <div className="text-[11px] text-amber-700 font-bold tabular-nums">
              {toPersianDigits(stats.mostActiveUser.count)} عملیات
            </div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => {
            setSelectedSeverity((prev) => (prev === 'sensitive' ? 'all' : 'sensitive'));
            setCurrentPage(1);
          }}
          className={`text-right bg-white p-4 rounded-xl border flex items-center gap-3.5 transition-colors cursor-pointer hover:border-rose-300 ${
            selectedSeverity === 'sensitive' || selectedSeverity === 'critical'
              ? 'border-rose-500 bg-rose-50/25'
              : 'border-slate-200'
          }`}
        >
          <div className="p-2.5 bg-rose-50 text-rose-600 rounded-xl shrink-0">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-semibold text-slate-500">رویدادهای حساس و هشدار</div>
            <div className="text-xl font-black text-rose-700 mt-0.5 tabular-nums">
              {toPersianDigits(stats.sensitiveCount)}{' '}
              <span className="text-xs font-medium text-rose-600/80">
                ({toPersianDigits(stats.criticalCount)} بحرانی)
              </span>
            </div>
          </div>
        </button>
      </div>

      {/* Visual Analytics Panel (Interactive Cross-Filter Charts) */}
      {showVisualView && (
        <div
          id="activity-visual-analytics-panel"
          className="grid grid-cols-1 xl:grid-cols-12 gap-4 animate-fade-in"
        >
          {/* Chart 1: Daily Activity Timeline (Last 14 Active Days) */}
          <div className="xl:col-span-5 bg-white rounded-2xl border border-slate-200 p-4 flex flex-col justify-between">
            <div className="flex items-start justify-between gap-2 mb-3">
              <div>
                <h3 className="text-xs sm:text-sm font-black text-slate-900 flex items-center gap-1.5">
                  <BarChart3 className="w-4 h-4 text-indigo-600" />
                  <span>روند فعالیت روزانه (۱۴ روز فعال اخیر)</span>
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  برای فیلتر جدول روی ستون هر روز کلیک کنید
                </p>
              </div>
              <div className="text-[11px] text-slate-500 flex items-center gap-2.5 shrink-0">
                <span className="inline-flex items-center gap-1">
                  <span className="w-2 h-2 rounded-xs bg-indigo-600" />
                  <span>عادی</span>
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="w-2 h-2 rounded-xs bg-amber-500" />
                  <span>هشدار</span>
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="w-2 h-2 rounded-xs bg-rose-600" />
                  <span>بحرانی</span>
                </span>
              </div>
            </div>

            {timelineChartData.days.length === 0 ? (
              <div className="h-44 flex items-center justify-center text-xs text-slate-400">
                داده‌ای برای نمایش نمودار روزانه وجود ندارد
              </div>
            ) : (
              <>
                <div className="h-44 flex items-end gap-1.5 pt-5 pb-1 px-1 border-b border-slate-200">
                  {timelineChartData.days.map((day) => {
                    const isSelected = timelineChartData.activeSingleDate === day.dateKey;
                    const heightPct = Math.max(8, Math.round((day.total / timelineChartData.maxCount) * 100));
                    const infoPct = day.total > 0 ? (day.info / day.total) * 100 : 0;
                    const warnPct = day.total > 0 ? (day.warning / day.total) * 100 : 0;
                    const critPct = day.total > 0 ? (day.critical / day.total) * 100 : 0;
                    const shortLabel = day.dateKey.slice(5); // MM/DD

                    return (
                      <button
                        key={day.dateKey}
                        type="button"
                        onMouseEnter={() => setHoveredDayKey(day.dateKey)}
                        onMouseLeave={() => setHoveredDayKey(null)}
                        onClick={() => handleToggleDayBar(day.dateKey)}
                        className={`flex-1 min-w-0 h-full flex flex-col items-center justify-end group cursor-pointer rounded-t-md transition-colors ${
                          isSelected ? 'bg-indigo-50/80' : 'hover:bg-slate-50'
                        }`}
                        title={`${toPersianDigits(day.dateKey)}: ${toPersianDigits(day.total)} رویداد`}
                      >
                        <span
                          className={`text-[10px] font-bold mb-1 tabular-nums ${
                            isSelected ? 'text-indigo-700' : 'text-slate-500 group-hover:text-slate-800'
                          }`}
                        >
                          {toPersianDigits(day.total)}
                        </span>
                        <div
                          style={{ height: `${heightPct}%` }}
                          className={`w-full max-w-[22px] rounded-t-md overflow-hidden flex flex-col justify-end transition-all ${
                            isSelected ? 'ring-2 ring-indigo-600 ring-offset-1' : ''
                          }`}
                        >
                          {critPct > 0 && (
                            <div style={{ height: `${critPct}%` }} className="w-full bg-rose-600" />
                          )}
                          {warnPct > 0 && (
                            <div style={{ height: `${warnPct}%` }} className="w-full bg-amber-500" />
                          )}
                          {infoPct > 0 && (
                            <div style={{ height: `${infoPct}%` }} className="w-full bg-indigo-600" />
                          )}
                        </div>
                        <span
                          className={`text-[9px] mt-1.5 tabular-nums truncate w-full text-center ${
                            isSelected ? 'text-indigo-700 font-black' : 'text-slate-500'
                          }`}
                        >
                          {toPersianDigits(shortLabel)}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div className="mt-2.5 min-h-[20px] flex items-center justify-between text-[11px] text-slate-600 tabular-nums">
                  {hoveredDayInfo ? (
                    <>
                      <span className="font-bold text-slate-800">
                        تاریخ {toPersianDigits(hoveredDayInfo.dateKey)}
                      </span>
                      <span>
                        کل: {toPersianDigits(hoveredDayInfo.total)} · عادی:{' '}
                        {toPersianDigits(hoveredDayInfo.info)} · هشدار:{' '}
                        {toPersianDigits(hoveredDayInfo.warning)} · بحرانی:{' '}
                        {toPersianDigits(hoveredDayInfo.critical)}
                      </span>
                    </>
                  ) : timelineChartData.activeSingleDate ? (
                    <>
                      <span className="font-bold text-indigo-700">
                        فیلتر فعال روی تاریخ {toPersianDigits(timelineChartData.activeSingleDate)}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedDateRange('all');
                          setCurrentPage(1);
                        }}
                        className="text-rose-600 hover:underline font-bold cursor-pointer"
                      >
                        لغو فیلتر تاریخ
                      </button>
                    </>
                  ) : (
                    <>
                      <span>تعداد روزهای فعال: {toPersianDigits(timelineChartData.days.length)}</span>
                      <span>بیشترین بار روزانه: {toPersianDigits(timelineChartData.maxCount)} رویداد</span>
                    </>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Chart 2: Category Distribution */}
          <div className="xl:col-span-3 bg-white rounded-2xl border border-slate-200 p-4 flex flex-col justify-between">
            <div className="flex items-start justify-between gap-2 mb-3">
              <div>
                <h3 className="text-xs sm:text-sm font-black text-slate-900 flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-emerald-600" />
                  <span>توزیع بر اساس دسته‌بندی</span>
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">کلیک برای فیلتر دسته‌بندی</p>
              </div>
              {selectedCategory !== 'all' && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCategory('all');
                    setCurrentPage(1);
                  }}
                  className="text-[11px] text-indigo-600 hover:underline font-bold cursor-pointer"
                >
                  همه
                </button>
              )}
            </div>

            {categoryChartData.items.length === 0 ? (
              <div className="h-44 flex items-center justify-center text-xs text-slate-400">
                رکوردی یافت نشد
              </div>
            ) : (
              <div className="space-y-2.5 my-auto">
                {categoryChartData.items.map(({ category, count, pct, config }) => {
                  const isActive = selectedCategory === category;
                  const widthPct = Math.max(4, Math.round((count / categoryChartData.maxCount) * 100));
                  return (
                    <button
                      key={category}
                      type="button"
                      onClick={() => {
                        setSelectedCategory((prev) => (prev === category ? 'all' : category));
                        setCurrentPage(1);
                      }}
                      className={`w-full text-right p-1.5 rounded-lg transition-colors cursor-pointer ${
                        isActive ? 'bg-indigo-50 ring-1 ring-indigo-300' : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 text-[11px] mb-1">
                        <span className="font-bold text-slate-800 flex items-center gap-1.5 truncate">
                          {config.icon}
                          <span className="truncate">{config.label}</span>
                        </span>
                        <span className="text-slate-600 font-bold tabular-nums shrink-0">
                          {toPersianDigits(count)}{' '}
                          <span className="text-slate-400 font-normal">({toPersianDigits(pct)}٪)</span>
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          style={{ width: `${widthPct}%` }}
                          className={`h-full rounded-full transition-all ${config.barClass}`}
                        />
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Chart 3: User Activity Breakdown */}
          <div className="xl:col-span-4 bg-white rounded-2xl border border-slate-200 p-4 flex flex-col justify-between">
            <div className="flex items-start justify-between gap-2 mb-3">
              <div>
                <h3 className="text-xs sm:text-sm font-black text-slate-900 flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-purple-600" />
                  <span>عملکرد کاربران</span>
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">کلیک روی هر کاربر برای نمایش لاگ‌های او</p>
              </div>
              {selectedUser !== 'all' && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedUser('all');
                    setCurrentPage(1);
                  }}
                  className="text-[11px] text-indigo-600 hover:underline font-bold cursor-pointer"
                >
                  همه کاربران
                </button>
              )}
            </div>

            {userChartData.items.length === 0 ? (
              <div className="h-44 flex items-center justify-center text-xs text-slate-400">
                کاربری در این بازه ثبت نشده است
              </div>
            ) : (
              <div className="space-y-2.5 my-auto">
                {userChartData.items.map((u) => {
                  const isActive = selectedUser === u.userId;
                  const barWidth = Math.max(6, Math.round((u.total / userChartData.maxCount) * 100));
                  const infoShare = u.total > 0 ? (u.info / u.total) * 100 : 0;
                  const warnShare = u.total > 0 ? (u.warning / u.total) * 100 : 0;
                  const critShare = u.total > 0 ? (u.critical / u.total) * 100 : 0;
                  const pctTotal =
                    userChartData.totalInScope > 0
                      ? Math.round((u.total / userChartData.totalInScope) * 100)
                      : 0;

                  return (
                    <button
                      key={u.userId}
                      type="button"
                      onClick={() => {
                        setSelectedUser((prev) => (prev === u.userId ? 'all' : u.userId));
                        setCurrentPage(1);
                      }}
                      className={`w-full text-right p-1.5 rounded-lg transition-colors cursor-pointer ${
                        isActive ? 'bg-indigo-50 ring-1 ring-indigo-300' : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 text-[11px] mb-1">
                        <div className="min-w-0 truncate">
                          <span className="font-bold text-slate-900">{u.userName}</span>
                          {u.roleTitle && (
                            <span className="text-slate-400 font-normal"> · {u.roleTitle}</span>
                          )}
                        </div>
                        <div className="font-bold text-slate-700 tabular-nums shrink-0">
                          {toPersianDigits(u.total)}{' '}
                          <span className="text-slate-400 font-normal">({toPersianDigits(pctTotal)}٪)</span>
                        </div>
                      </div>
                      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div style={{ width: `${barWidth}%` }} className="h-full flex rounded-full overflow-hidden">
                          {infoShare > 0 && (
                            <div style={{ width: `${infoShare}%` }} className="h-full bg-indigo-600" />
                          )}
                          {warnShare > 0 && (
                            <div style={{ width: `${warnShare}%` }} className="h-full bg-amber-500" />
                          )}
                          {critShare > 0 && (
                            <div style={{ width: `${critShare}%` }} className="h-full bg-rose-600" />
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Filter Toolbar */}
      <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200 space-y-3">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-2.5 items-center">
          {/* Search Input */}
          <div className="relative lg:col-span-5">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              id="activity-logs-search-input"
              placeholder="جستجو در کاربر، عملیات، شرح یا IP..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full h-9 pr-9 pl-8 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all font-medium"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setCurrentPage(1);
                }}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                title="پاک کردن متن جستجو"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Balanced 4-Column Filter Grid */}
          <div className="lg:col-span-7 grid grid-cols-2 sm:grid-cols-4 gap-2">
            {/* User Filter */}
            <div className="h-9 flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5">
              <UserIcon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <select
                aria-label="فیلتر کاربر"
                value={selectedUser}
                onChange={(e) => {
                  setSelectedUser(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full min-w-0 bg-transparent text-xs font-bold text-slate-700 outline-none cursor-pointer truncate"
              >
                <option value="all">همه کاربران</option>
                {userFilterOptions.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Category Filter */}
            <div className="h-9 flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5">
              <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <select
                aria-label="فیلتر دسته‌بندی"
                value={selectedCategory}
                onChange={(e) => {
                  setSelectedCategory(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full min-w-0 bg-transparent text-xs font-bold text-slate-700 outline-none cursor-pointer truncate"
              >
                <option value="all">همه دسته‌ها</option>
                {(Object.keys(CATEGORY_CONFIG) as ActivityActionCategory[]).map((cat) => (
                  <option key={cat} value={cat}>
                    {CATEGORY_CONFIG[cat].label}
                  </option>
                ))}
              </select>
            </div>

            {/* Severity Filter */}
            <div className="h-9 flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5">
              <ShieldAlert className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <select
                aria-label="فیلتر سطح حساسیت"
                value={selectedSeverity}
                onChange={(e) => {
                  setSelectedSeverity(e.target.value as SeverityFilter);
                  setCurrentPage(1);
                }}
                className="w-full min-w-0 bg-transparent text-xs font-bold text-slate-700 outline-none cursor-pointer truncate"
              >
                <option value="all">همه سطوح</option>
                <option value="sensitive">حساس و هشدار</option>
                <option value="critical">فقط بحرانی</option>
                <option value="warning">فقط هشدار</option>
                <option value="info">فقط عادی</option>
              </select>
            </div>

            {/* Date Range Filter */}
            <div className="h-9 flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5">
              <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <select
                aria-label="فیلتر بازه زمانی"
                value={selectedDateRange}
                onChange={(e) => {
                  setSelectedDateRange(e.target.value as DateRangeFilter);
                  setCurrentPage(1);
                }}
                className="w-full min-w-0 bg-transparent text-xs font-bold text-slate-700 outline-none cursor-pointer truncate"
              >
                <option value="all">همه زمان‌ها</option>
                <option value="today">امروز</option>
                <option value="yesterday">دیروز</option>
                <option value="7days">۷ روز اخیر</option>
                <option value="30days">۳۰ روز اخیر</option>
                <option value="custom">بازه دلخواه</option>
              </select>
            </div>
          </div>
        </div>

        {/* Custom Jalali Date Range Pickers */}
        {selectedDateRange === 'custom' && (
          <div className="pt-2.5 border-t border-slate-100 flex flex-wrap items-end gap-3">
            <div className="w-48">
              <JalaliDatePicker
                label="از تاریخ (شمسی)"
                value={customStartDate}
                onChange={(val) => {
                  setCustomStartDate(val);
                  setCurrentPage(1);
                }}
              />
            </div>
            <div className="w-48">
              <JalaliDatePicker
                label="تا تاریخ (شمسی)"
                value={customEndDate}
                onChange={(val) => {
                  setCustomEndDate(val);
                  setCurrentPage(1);
                }}
              />
            </div>
          </div>
        )}

        {/* Compact Status & Sort Bar */}
        <div className="pt-2.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-[11px] tabular-nums">
          <div className="text-slate-500 min-w-0 truncate">
            <span>نتیجه: </span>
            <strong className="text-slate-900">{toPersianDigits(filteredLogs.length)}</strong>
            <span> از </span>
            <strong>{toPersianDigits(logs.length)}</strong>
            <span> رویداد</span>
            {activeFilterSummary.length > 0 && (
              <span className="text-indigo-700 font-semibold">
                {' '}
                · {activeFilterSummary.join(' · ')}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setSortOrder((prev) => (prev === 'newest' ? 'oldest' : 'newest'))}
              className="px-2.5 py-1 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg font-bold text-slate-700 flex items-center gap-1 transition-colors cursor-pointer"
              title="تغییر ترتیب نمایش"
            >
              <ArrowUpDown className="w-3 h-3 text-slate-500" />
              <span>{sortOrder === 'newest' ? 'جدیدترین' : 'قدیمی‌ترین'}</span>
            </button>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetFilters}
                className="px-2.5 py-1 font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>حذف فیلترها</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Filterable Audit Log Table + Mobile Cards */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        {paginatedLogs.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <div className="flex flex-col items-center justify-center gap-3 text-slate-400">
              <div className="p-4 bg-slate-100 rounded-2xl">
                <History className="w-8 h-8 text-slate-400" />
              </div>
              <div className="text-sm font-bold text-slate-700">
                هیچ رویدادی مطابق با فیلترهای انتخاب‌شده یافت نشد
              </div>
              <p className="text-xs text-slate-500 max-w-md">
                {hasActiveFilters
                  ? 'برای مشاهده مجدد تمام رویدادهای ثبت‌شده، فیلترهای جستجو، کاربر، دسته‌بندی یا بازه زمانی را بازنشانی کنید.'
                  : 'با اولین ورود، صدور فاکتور، تغییر موجودی یا ویرایش تنظیمات، وقایع به‌صورت خودکار در این جدول ثبت می‌شوند.'}
              </p>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="mt-1 px-4 py-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-xl text-xs font-bold cursor-pointer"
                >
                  نمایش همه رویدادها
                </button>
              )}
            </div>
          </div>
        ) : (
          <>
            {/* Mobile Card Layout (Streamlined) */}
            <div className="md:hidden divide-y divide-slate-100">
              {paginatedLogs.map((log) => {
                const catInfo = CATEGORY_CONFIG[log.category] || CATEGORY_CONFIG.system;
                const sev = getLogSeverity(log);
                const sevInfo = SEVERITY_CONFIG[sev];
                return (
                  <button
                    key={log.id}
                    type="button"
                    onClick={() => setSelectedLog(log)}
                    className={`w-full text-right p-3.5 transition-colors space-y-1.5 cursor-pointer ${sevInfo.rowAccent}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-slate-900 text-xs truncate">
                        {log.actionTitle}
                      </span>
                      {sev !== 'info' && (
                        <span className={`text-[10px] font-bold shrink-0 ${sevInfo.textClass}`}>
                          {sevInfo.label}
                        </span>
                      )}
                    </div>

                    <p className="text-[11px] text-slate-500 line-clamp-1">{log.details}</p>

                    <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500 tabular-nums">
                      <span className="truncate font-medium text-slate-700">
                        {log.userName} · {catInfo.label}
                      </span>
                      <span className="dir-ltr shrink-0 text-slate-400">
                        {toPersianDigits(log.timestamp)}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Desktop Audit Table (Decluttered & Optimized) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 text-[11px] font-bold">
                    <th className="py-2.5 px-4 whitespace-nowrap w-36">زمان</th>
                    <th className="py-2.5 px-4 whitespace-nowrap w-40">کاربر</th>
                    <th className="py-2.5 px-4 whitespace-nowrap w-44">دسته‌بندی</th>
                    <th className="py-2.5 px-4">رویداد و شرح</th>
                    <th className="py-2.5 px-3 text-center whitespace-nowrap w-16">جزئیات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {paginatedLogs.map((log) => {
                    const catInfo = CATEGORY_CONFIG[log.category] || CATEGORY_CONFIG.system;
                    const sev = getLogSeverity(log);
                    const sevInfo = SEVERITY_CONFIG[sev];
                    const relTime = formatRelativeTime(log.createdAtMs);
                    const username = userLookupMap.get(log.userId)?.username;

                    return (
                      <tr
                        key={log.id}
                        onClick={() => setSelectedLog(log)}
                        className={`${sevInfo.rowAccent} transition-colors group cursor-pointer`}
                      >
                        <td
                          className="py-2.5 px-4 whitespace-nowrap align-middle tabular-nums"
                          title={relTime || toPersianDigits(log.timestamp)}
                        >
                          <div className="font-medium text-slate-700 dir-ltr text-right text-[11px]">
                            {toPersianDigits(log.timestamp)}
                          </div>
                        </td>

                        <td
                          className="py-2.5 px-4 whitespace-nowrap align-middle"
                          title={`${log.userRoleTitle || log.userRole}${username ? ` (@${username})` : ''}`}
                        >
                          <div className="font-bold text-slate-800 truncate max-w-[150px]">
                            {log.userName}
                          </div>
                        </td>

                        <td className="py-2.5 px-4 whitespace-nowrap align-middle">
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center gap-1.5 text-slate-600 font-medium text-[11px]">
                              {catInfo.icon}
                              <span>{catInfo.label}</span>
                            </span>
                            {sev !== 'info' && (
                              <span className={`text-[10px] font-bold ${sevInfo.textClass}`}>
                                · {sevInfo.label}
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="py-2.5 px-4 align-middle max-w-xl">
                          <div className="font-bold text-slate-900 truncate">{log.actionTitle}</div>
                          <div className="text-slate-500 text-[11px] truncate mt-0.5">
                            {log.details}
                          </div>
                        </td>

                        <td className="py-2.5 px-3 text-center whitespace-nowrap align-middle">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedLog(log);
                            }}
                            className="p-1.5 text-slate-400 group-hover:text-indigo-600 group-hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                            title="مشاهده جزئیات کامل رویداد"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* Pagination Footer */}
        {filteredLogs.length > 0 && (
          <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs tabular-nums">
            <div className="flex items-center gap-3 text-slate-600">
              <span>
                نمایش{' '}
                <strong className="text-slate-900">
                  {toPersianDigits((currentPage - 1) * itemsPerPage + 1)}
                </strong>{' '}
                تا{' '}
                <strong className="text-slate-900">
                  {toPersianDigits(Math.min(currentPage * itemsPerPage, filteredLogs.length))}
                </strong>{' '}
                از <strong className="text-slate-900">{toPersianDigits(filteredLogs.length)}</strong>{' '}
                رویداد
              </span>
              <select
                aria-label="تعداد ردیف در صفحه"
                value={itemsPerPage}
                onChange={(e) => {
                  setItemsPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold text-slate-700 outline-none cursor-pointer"
              >
                <option value={15}>۱۵ ردیف</option>
                <option value={20}>۲۰ ردیف</option>
                <option value={50}>۵۰ ردیف</option>
              </select>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
                <span className="px-3 py-1 bg-white border border-slate-200 rounded-lg font-bold text-slate-800">
                  صفحه {toPersianDigits(currentPage)} از {toPersianDigits(totalPages)}
                </span>
                <button
                  type="button"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Full Audit Details Modal */}
      {selectedLog && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setSelectedLog(null)}
        >
          <div
            className="bg-white rounded-3xl w-full max-w-xl shadow-2xl border border-slate-200 overflow-hidden max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-slate-900 px-6 py-4 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <History className="w-5 h-5 text-indigo-400" />
                <h3 className="font-bold text-base">جزئیات ممیزی و ردگیری رویداد</h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                className="p-1.5 hover:bg-slate-800 rounded-xl text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-slate-100">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border ${
                      CATEGORY_CONFIG[selectedLog.category]?.colorClass || CATEGORY_CONFIG.system.colorClass
                    }`}
                  >
                    {CATEGORY_CONFIG[selectedLog.category]?.icon}
                    <span>{CATEGORY_CONFIG[selectedLog.category]?.label || selectedLog.category}</span>
                  </span>
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border ${
                      SEVERITY_CONFIG[getLogSeverity(selectedLog)].badgeClass
                    }`}
                  >
                    <span>{SEVERITY_CONFIG[getLogSeverity(selectedLog)].label}</span>
                  </span>
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                    <Server className="w-3 h-3" />
                    <span>{selectedLog.source === 'server' ? 'ثبت مستقیم در سرور' : 'ارسال از کلاینت'}</span>
                  </span>
                </div>
                <span className="text-[11px] text-slate-400 font-mono">#{selectedLog.id}</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100 space-y-1">
                  <span className="text-[11px] text-slate-400 font-medium">کاربر انجام‌دهنده:</span>
                  <div className="font-bold text-slate-900">{selectedLog.userName}</div>
                  <div className="text-[11px] text-indigo-700 font-bold">
                    {selectedLog.userRoleTitle || selectedLog.userRole}
                    {userLookupMap.get(selectedLog.userId)?.username
                      ? ` (@${userLookupMap.get(selectedLog.userId)?.username})`
                      : ''}
                  </div>
                </div>

                <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100 space-y-1 tabular-nums">
                  <span className="text-[11px] text-slate-400 font-medium">تاریخ و زمان دقیق:</span>
                  <div className="font-bold text-slate-900 dir-ltr text-right">
                    {toPersianDigits(selectedLog.timestamp)}
                  </div>
                  {formatRelativeTime(selectedLog.createdAtMs) && (
                    <div className="text-[11px] text-indigo-600 font-bold">
                      {formatRelativeTime(selectedLog.createdAtMs)}
                    </div>
                  )}
                </div>

                <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100 space-y-1">
                  <span className="text-[11px] text-slate-400 font-medium">دستگاه و مرورگر:</span>
                  <div className="font-bold text-slate-800 flex items-center gap-1.5">
                    {renderDeviceIcon(selectedLog.deviceInfo)}
                    <span>{selectedLog.deviceInfo || 'مرورگر وب'}</span>
                  </div>
                </div>

                <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100 space-y-1">
                  <span className="text-[11px] text-slate-400 font-medium">نشانی شبکه (IP):</span>
                  <div className="font-bold text-slate-800 font-mono dir-ltr text-right flex items-center justify-end gap-1.5">
                    <span>{selectedLog.ipAddress || 'ثبت محلی (بدون IP)'}</span>
                    <Globe className="w-3.5 h-3.5 text-slate-400" />
                  </div>
                </div>
              </div>

              <div className="bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-black text-indigo-950 text-sm">{selectedLog.actionTitle}</div>
                  <span className="text-[10px] font-mono text-indigo-700 bg-indigo-100/80 px-2 py-0.5 rounded-md">
                    {selectedLog.actionType}
                  </span>
                </div>
                <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">
                  {selectedLog.details}
                </p>
              </div>

              {(selectedLog.entityType || selectedLog.entityId || selectedLog.entityLabel) && (
                <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80 text-xs flex flex-wrap items-center justify-between gap-2">
                  <span className="text-slate-500 font-bold">رکورد / موجودیت هدف:</span>
                  <span className="font-bold text-slate-900">
                    {[selectedLog.entityType, selectedLog.entityLabel, selectedLog.entityId]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </div>
              )}

              {selectedLog.metadata && Object.keys(selectedLog.metadata).length > 0 && (
                <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80 space-y-2">
                  <div className="text-[11px] font-bold text-slate-600">جزئیات فنی و مقادیر ثبت‌شده:</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] tabular-nums">
                    {Object.entries(selectedLog.metadata).map(([k, v]) => (
                      <div
                        key={k}
                        className="bg-white px-2.5 py-1.5 rounded-lg border border-slate-200/70 flex items-center justify-between gap-2"
                      >
                        <span className="text-slate-500 font-medium truncate">
                          {METADATA_LABELS[k] || k}
                        </span>
                        <span className="font-bold text-slate-800 truncate">
                          {formatMetadataValue(v)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="bg-slate-50 px-6 py-3.5 flex items-center justify-between border-t border-slate-200 shrink-0">
              <button
                type="button"
                onClick={() => handleCopyLogReport(selectedLog)}
                className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                {copiedId === selectedLog.id ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="text-emerald-700">کپی شد</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>کپی گزارش رویداد</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                بستن پنجره
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clear Confirmation Modal */}
      {isConfirmClearOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl border border-rose-100 overflow-hidden">
            <div className="p-6 text-center space-y-4">
              <div className="w-14 h-14 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto">
                <AlertTriangle className="w-7 h-7" />
              </div>
              <h3 className="text-base font-black text-slate-900">پاکسازی آرشیو لاگ‌های فعالیت؟</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                با تایید این عملیات، تمام لاگ‌های قبلی روی سرور و کلاینت حذف شده و یک رکورد ممیزی جدید شامل نام شما و IP جهت ثبت عمل پاکسازی باقی می‌ماند.
              </p>
              <div className="flex items-center justify-center gap-2 pt-2">
                <button
                  type="button"
                  disabled={isClearing}
                  onClick={() => setIsConfirmClearOpen(false)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="button"
                  disabled={isClearing}
                  onClick={handleClearLogs}
                  className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white rounded-xl text-xs font-bold transition-colors shadow-sm cursor-pointer"
                >
                  {isClearing ? 'در حال پاکسازی...' : 'بله، پاکسازی شود'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
