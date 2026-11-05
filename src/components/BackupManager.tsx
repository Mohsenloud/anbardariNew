import React, { useState, useEffect, useMemo } from 'react';
import { StorageService } from '../utils/storage';
import { ServerBackupInfo, AppUser, RestoreModuleKey } from '../types';
import { toPersianDigits } from '../utils/jalali';
import { exportInvoicesToCsv } from '../utils/csvExport';
import { SmartPagination, paginateArray } from './SmartPagination';
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
  Activity,
  Sparkles,
  FileCode,
  Send,
  Search,
  Filter,
  SlidersHorizontal,
  Boxes,
  ReceiptText,
  Users,
  FileSpreadsheet,
  Wrench,
  Eye,
  X,
  ArrowLeftRight,
  ShoppingBag,
} from 'lucide-react';

interface BackupManagerProps {
  currentUser?: AppUser;
  onDataRestored?: () => void;
  onNavigateToInvoicesCsv?: () => void;
}

type BackupSubTab = 'backups' | 'postgres' | 'maintenance';
type TriggerFilter = 'all' | 'manual' | 'auto' | 'pre-restore' | 'startup';

interface RestoreModuleOption {
  key: RestoreModuleKey;
  title: string;
  description: string;
  currentCount: number;
  backupCount: number;
  unitLabel: string;
}

const ALL_RESTORE_MODULES: RestoreModuleKey[] = [
  'products',
  'invoices',
  'purchaseInvoices',
  'customers',
  'movements',
  'users',
  'settings',
];

export const BackupManager: React.FC<BackupManagerProps> = ({
  onDataRestored,
  onNavigateToInvoicesCsv,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<BackupSubTab>('backups');
  const [backups, setBackups] = useState<ServerBackupInfo[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [sendingTelegram, setSendingTelegram] = useState<boolean>(false);
  const [sendingTelegramFile, setSendingTelegramFile] = useState<string | null>(null);
  const [autoBackupInterval, setAutoBackupInterval] = useState<number>(4);
  const [newLabel, setNewLabel] = useState<string>('');
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Filter, Sort & Pagination for Server Backups List
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [triggerFilter, setTriggerFilter] = useState<TriggerFilter>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'largest' | 'smallest'>('newest');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(15);
  const [selectedBackupModal, setSelectedBackupModal] = useState<ServerBackupInfo | null>(null);
  const [selectedBackupFiles, setSelectedBackupFiles] = useState<string[]>([]);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState<boolean>(false);

  // Interactive Restore / Upload Preview Modal State
  const [restoreTarget, setRestoreTarget] = useState<{
    mode: 'server_backup' | 'uploaded_json';
    filename: string;
    label: string;
    createdAt: string;
    trigger: string;
    sizeBytes: number;
    checksum?: string;
    checksumValid?: boolean;
    stats: ServerBackupInfo['stats'];
    rawJsonContent?: string;
  } | null>(null);
  const [restoreScope, setRestoreScope] = useState<'full' | 'selective'>('full');
  const [selectedModules, setSelectedModules] = useState<RestoreModuleKey[]>(ALL_RESTORE_MODULES);
  const [uploadActionType, setUploadActionType] = useState<'restore_now' | 'save_only'>('restore_now');

  // Delete Confirmation Modal State
  const [deleteTarget, setDeleteTarget] = useState<{ filename: string; label: string } | null>(null);

  // Maintenance & Reset Confirmation Modal State
  const [maintenanceAction, setMaintenanceAction] = useState<
    'clear_invoices' | 'reset_demo' | 'factory_reset' | null
  >(null);
  const [optimizing, setOptimizing] = useState<boolean>(false);
  const [optimizeReport, setOptimizeReport] = useState<{
    cleanedOrphanSlips: number;
    cleanedTombstones: number;
    trimmedLogs: number;
    ensuredBarcodes: number;
    sizeBeforeKB: string;
    sizeAfterKB: string;
  } | null>(null);

  // PostgreSQL & Database Diagnostics State
  const [dbDiag, setDbDiag] = useState<any>(null);
  const [testingDb, setTestingDb] = useState<boolean>(false);
  const [syncingDb, setSyncingDb] = useState<boolean>(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [showTerminalGuide, setShowTerminalGuide] = useState<boolean>(false);

  // PostgreSQL SQL Backup & Restore States
  const [downloadingSql, setDownloadingSql] = useState<boolean>(false);
  const [downloadingJson, setDownloadingJson] = useState<boolean>(false);
  const [importingSql, setImportingSql] = useState<boolean>(false);
  const [sqlFileContent, setSqlFileContent] = useState<string>('');
  const [sqlFileName, setSqlFileName] = useState<string>('');
  const [showSqlModal, setShowSqlModal] = useState<boolean>(false);
  const [snapshotLabel, setSnapshotLabel] = useState<string>('');
  const [creatingSnapshot, setCreatingSnapshot] = useState<boolean>(false);

  // Live Local System Counts (refreshed whenever backups or data change)
  const [liveVersion, setLiveVersion] = useState<number>(0);
  const liveStats = useMemo(() => {
    const products = StorageService.getProducts();
    const invoices = StorageService.getInvoices();
    const purchaseInvoices = StorageService.getPurchaseInvoices();
    const inboundReceipts = StorageService.getInboundReceipts();
    const customers = StorageService.getCustomers();
    const movements = StorageService.getMovements();
    const customerTransactions = StorageService.getCustomerTransactions();
    const directTransfers = StorageService.getDirectTransfers();
    const users = StorageService.getUsers();
    const settings = StorageService.getSettings();
    const storageStats = StorageService.getStorageStats();

    return {
      productsCount: products.length,
      invoicesCount: invoices.length,
      purchaseInvoicesCount: purchaseInvoices.length,
      inboundReceiptsCount: inboundReceipts.length,
      customersCount: customers.length,
      movementsCount: movements.length,
      customerTransactionsCount: customerTransactions.length,
      directTransfersCount: directTransfers.length,
      usersCount: users.length,
      warehousesCount: settings.warehouses?.length || 1,
      sizeKB: storageStats.sizeKB,
      settings,
      invoices,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveVersion, backups.length]);

  const showNotification = (type: 'success' | 'error', text: string) => {
    setStatusMessage({ type, text });
    setTimeout(() => setStatusMessage(null), 5500);
  };

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

  // Reset pagination when filter or search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, triggerFilter, sortBy]);

  const triggerCounts = useMemo(() => {
    const counts: Record<TriggerFilter, number> = {
      all: backups.length,
      manual: 0,
      auto: 0,
      'pre-restore': 0,
      startup: 0,
    };
    backups.forEach((b) => {
      if (b.trigger === 'auto') counts.auto++;
      else if (b.trigger === 'pre-restore') counts['pre-restore']++;
      else if (b.trigger === 'startup') counts.startup++;
      else counts.manual++;
    });
    return counts;
  }, [backups]);

  const filteredBackups = useMemo(() => {
    const list = backups.filter((bk) => {
      if (triggerFilter !== 'all' && bk.trigger !== triggerFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const matchLabel = (bk.label || '').toLowerCase().includes(q);
        const matchFile = (bk.filename || '').toLowerCase().includes(q);
        const matchDate = formatIsoToPersianTime(bk.createdAt).toLowerCase().includes(q);
        return matchLabel || matchFile || matchDate;
      }
      return true;
    });

    return [...list].sort((a, b) => {
      if (sortBy === 'oldest') {
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      }
      if (sortBy === 'largest') {
        return (b.sizeBytes || 0) - (a.sizeBytes || 0);
      }
      if (sortBy === 'smallest') {
        return (a.sizeBytes || 0) - (b.sizeBytes || 0);
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [backups, triggerFilter, searchQuery, sortBy]);

  const paginatedBackups = useMemo(
    () => paginateArray(filteredBackups, currentPage, pageSize),
    [filteredBackups, currentPage, pageSize]
  );

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

  // Force sync local state into PostgreSQL & Server
  const handleForceSyncDatabase = async () => {
    setSyncingDb(true);
    try {
      await StorageService.pushToServer();
      const res = await StorageService.forceSyncToPostgres();
      if (res && res.success) {
        showNotification('success', res.message || 'کلیه اطلاعات با موفقیت در دیتابیس PostgreSQL همگام‌سازی شد.');
        await fetchDbDiag();
        await fetchBackups();
        setLiveVersion((v) => v + 1);
      } else {
        showNotification('success', 'اطلاعات کلاینت با سرور مرکزی همگام‌سازی شد.');
        await fetchDbDiag();
        await fetchBackups();
      }
    } catch {
      showNotification('error', 'خطا در ارتباط با سرور.');
    } finally {
      setSyncingDb(false);
    }
  };

  // Download Instant JSON Backup (Syncs first, then downloads complete JSON)
  const handleDownloadJsonBackup = async () => {
    setDownloadingJson(true);
    try {
      await StorageService.pushToServer();
      const jsonStr = StorageService.exportAllData();
      const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const dateStr = new Date().toISOString().slice(0, 10);
      link.href = url;
      link.download = `mana_backup_${dateStr}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      showNotification('success', `فایل پشتیبان کامل JSON (mana_backup_${dateStr}.json) با موفقیت دانلود شد.`);
    } catch {
      showNotification('error', 'خطا در آماده‌سازی فایل پشتیبان JSON.');
    } finally {
      setDownloadingJson(false);
    }
  };

  // Download complete PostgreSQL .sql script (Safe Dump)
  const handleDownloadSqlDump = async () => {
    setDownloadingSql(true);
    try {
      await StorageService.pushToServer();
      const res = await StorageService.downloadPostgresSqlDump();
      if (res && res.success) {
        showNotification('success', res.message || 'فایل خروجی پشتیبان SQL دیتابیس (mana_db.sql) با موفقیت دانلود شد.');
      } else {
        showNotification('error', (res && res.message) || 'خطا در دانلود فایل SQL از سرور.');
      }
    } catch (err: any) {
      showNotification('error', err?.message || 'خطا در دانلود فایل پشتیبان دیتابیس.');
    } finally {
      setDownloadingSql(false);
    }
  };

  // Unified File Selector (.json or .sql)
  const handleUnifiedFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const lowerName = file.name.toLowerCase();
    const reader = new FileReader();

    if (lowerName.endsWith('.sql')) {
      reader.onload = (event) => {
        const content = event.target?.result as string;
        if (content && content.trim().length > 0) {
          setSqlFileContent(content);
          setSqlFileName(file.name);
          setShowSqlModal(true);
        } else {
          showNotification('error', 'فایل اسکریپت SQL انتخابی خالی است.');
        }
      };
      reader.readAsText(file, 'UTF-8');
      e.target.value = '';
      return;
    }

    // Otherwise parse as JSON backup
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (!content || !content.trim()) {
        showNotification('error', 'فایل انتخابی خالی است.');
        return;
      }
      try {
        const parsed = JSON.parse(content);
        const isEnvelope = Boolean(parsed.backupVersion && parsed.data);
        const actualData = isEnvelope ? parsed.data : parsed;

        if (!actualData || typeof actualData !== 'object' || Array.isArray(actualData)) {
          showNotification('error', 'ساختار فایل JSON معتبر نیست.');
          return;
        }

        const stats: ServerBackupInfo['stats'] = {
          productsCount: Array.isArray(actualData.products) ? actualData.products.length : 0,
          invoicesCount: Array.isArray(actualData.invoices) ? actualData.invoices.length : 0,
          customersCount: Array.isArray(actualData.customers) ? actualData.customers.length : 0,
          purchaseInvoicesCount: Array.isArray(actualData.purchaseInvoices) ? actualData.purchaseInvoices.length : 0,
          inboundReceiptsCount: Array.isArray(actualData.inboundReceipts) ? actualData.inboundReceipts.length : 0,
          movementsCount: Array.isArray(actualData.movements) ? actualData.movements.length : 0,
          customerTransactionsCount: Array.isArray(actualData.customerTransactions) ? actualData.customerTransactions.length : 0,
          directTransfersCount: Array.isArray(actualData.directTransfers) ? actualData.directTransfers.length : 0,
          usersCount: Array.isArray(actualData.users) ? actualData.users.length : 0,
        };

        setRestoreScope('full');
        setSelectedModules(ALL_RESTORE_MODULES);
        setUploadActionType('restore_now');
        setRestoreTarget({
          mode: 'uploaded_json',
          filename: file.name,
          label: isEnvelope && parsed.label ? parsed.label : `فایل بارگذاری‌شده (${file.name})`,
          createdAt: (isEnvelope && parsed.createdAt) || actualData.timestamp || new Date().toISOString(),
          trigger: 'manual',
          sizeBytes: file.size,
          checksum: isEnvelope ? parsed.checksum : undefined,
          checksumValid: true,
          stats,
          rawJsonContent: content,
        });
      } catch {
        showNotification('error', 'قالب فایل انتخاب‌شده معتبر نیست. لطفاً یک فایل پشتیبان استاندارد .json یا .sql انتخاب کنید.');
      }
    };
    reader.readAsText(file, 'UTF-8');
    e.target.value = '';
  };

  // Open Restore Preview Modal for a Server Backup
  const handleOpenServerBackupRestore = async (bk: ServerBackupInfo) => {
    setRestoreScope('full');
    setSelectedModules(ALL_RESTORE_MODULES);
    setRestoreTarget({
      mode: 'server_backup',
      filename: bk.filename,
      label: bk.label,
      createdAt: bk.createdAt,
      trigger: bk.trigger,
      sizeBytes: bk.sizeBytes,
      checksum: bk.checksum,
      checksumValid: true,
      stats: bk.stats,
    });

    // Fetch live inspection details from server (verifies SHA-256 checksum & full stats)
    try {
      const inspected = await StorageService.inspectServerBackup(bk.filename);
      if (inspected && inspected.success) {
        setRestoreTarget((prev) =>
          prev && prev.filename === bk.filename
            ? {
                ...prev,
                checksumValid: inspected.checksumValid ?? true,
                stats: inspected.stats || prev.stats,
              }
            : prev
        );
      }
    } catch {
      // Keep local row stats
    }
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
        setLiveVersion((v) => v + 1);
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
          await fetchBackups();
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

  // Handle pruning old automatic backups
  const handlePruneOldAutoBackups = async () => {
    setActionLoading(true);
    try {
      const res = await StorageService.pruneServerBackups(5);
      if (res.success) {
        showNotification('success', res.message || 'نسخه‌های پشتیبان خودکار قدیمی پاکسازی شدند.');
        if (res.backups) {
          setBackups(res.backups);
        } else {
          await fetchBackups();
        }
      } else {
        showNotification('error', res.message || 'خطا در پاکسازی نسخه‌های قدیمی.');
      }
    } catch {
      showNotification('error', 'خطا در ارتباط با سرور.');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle send backup to Telegram
  const handleSendBackupToTelegram = async (filename?: string) => {
    if (filename) {
      setSendingTelegramFile(filename);
    } else {
      setSendingTelegram(true);
    }
    try {
      const res = await StorageService.sendDatabaseBackupToTelegram(filename);
      if (res.success) {
        showNotification(
          'success',
          res.message || 'نسخه پشتیبان پایگاه‌داده با موفقیت به تلگرام ثبت‌شده در سیستم ارسال شد.'
        );
      } else {
        showNotification('error', res.error || res.message || 'خطا در ارسال فایل پشتیبان به تلگرام.');
      }
    } catch {
      showNotification('error', 'خطا در برقراری ارتباط با سرور برنامه.');
    } finally {
      if (filename) {
        setSendingTelegramFile(null);
      } else {
        setSendingTelegram(false);
      }
    }
  };

  // Execute Restore (Server Backup or Uploaded JSON, Full or Selective)
  const handleConfirmAndExecuteRestore = async () => {
    if (!restoreTarget) return;

    const modulesToPass = restoreScope === 'selective' ? selectedModules : undefined;
    if (restoreScope === 'selective' && selectedModules.length === 0) {
      showNotification('error', 'لطفاً حداقل یک بخش را برای بازیابی انتخاب نمایید.');
      return;
    }

    setActionLoading(true);
    try {
      if (restoreTarget.mode === 'server_backup') {
        const res = await StorageService.restoreServerBackup(restoreTarget.filename, modulesToPass);
        if (res.success) {
          showNotification('success', res.message || 'اطلاعات با موفقیت به نسخه انتخاب‌شده بازگردانی شد.');
          setRestoreTarget(null);
          if (res.backups) {
            setBackups(res.backups);
          } else {
            await fetchBackups();
          }
          setLiveVersion((v) => v + 1);
          if (onDataRestored) onDataRestored();
        } else {
          showNotification('error', res.message || 'خطا در بازیابی اطلاعات.');
        }
      } else if (restoreTarget.mode === 'uploaded_json' && restoreTarget.rawJsonContent) {
        const shouldRestoreNow = uploadActionType === 'restore_now';
        const res = await StorageService.uploadServerBackup(
          restoreTarget.rawJsonContent,
          shouldRestoreNow,
          restoreTarget.label,
          modulesToPass
        );
        if (res.success) {
          showNotification('success', res.message || 'فایل پشتیبان با موفقیت پردازش شد.');
          setRestoreTarget(null);
          if (res.backups) {
            setBackups(res.backups);
          } else {
            await fetchBackups();
          }
          setLiveVersion((v) => v + 1);
          if (shouldRestoreNow && onDataRestored) {
            onDataRestored();
          }
        } else {
          // Offline fallback if server upload fails
          if (shouldRestoreNow) {
            const imported = StorageService.importAllData(restoreTarget.rawJsonContent, modulesToPass);
            if (imported) {
              showNotification('success', 'فایل پشتیبان با موفقیت در حافظه سیستم بازیابی شد.');
              setRestoreTarget(null);
              setLiveVersion((v) => v + 1);
              if (onDataRestored) onDataRestored();
              return;
            }
          }
          showNotification('error', res.message || 'فایل پشتیبان نامعتبر است.');
        }
      }
    } catch {
      showNotification('error', 'خطا در اجرای عملیات بازیابی سرور.');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle delete backup (via custom modal)
  const handleConfirmDeleteBackup = async () => {
    if (!deleteTarget) return;
    setActionLoading(true);
    try {
      const res = await StorageService.deleteServerBackup(deleteTarget.filename);
      if (res.success) {
        showNotification('success', 'فایل پشتیبان با موفقیت حذف شد.');
        setSelectedBackupFiles((prev) => prev.filter((f) => f !== deleteTarget.filename));
        setDeleteTarget(null);
        if (res.backups) {
          setBackups(res.backups);
        } else {
          await fetchBackups();
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

  // Handle bulk delete of selected backups
  const handleConfirmBulkDeleteBackups = async () => {
    if (selectedBackupFiles.length === 0) return;
    setActionLoading(true);
    let deletedCount = 0;
    try {
      for (const filename of selectedBackupFiles) {
        const res = await StorageService.deleteServerBackup(filename);
        if (res.success) {
          deletedCount++;
        }
      }
      setSelectedBackupFiles([]);
      setShowBulkDeleteModal(false);
      await fetchBackups();
      showNotification('success', `${toPersianDigits(deletedCount)} نسخه پشتیبان انتخاب‌شده با موفقیت حذف شدند.`);
    } catch {
      showNotification('error', 'خطا در حذف گروهی نسخه‌های پشتیبان.');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Database Optimization
  const handleOptimizeDatabase = async () => {
    setOptimizing(true);
    try {
      const res = await StorageService.optimizeDatabase();
      setOptimizeReport({
        cleanedOrphanSlips: res.cleanedOrphanSlips,
        cleanedTombstones: res.cleanedTombstones,
        trimmedLogs: res.trimmedLogs,
        ensuredBarcodes: res.ensuredBarcodes,
        sizeBeforeKB: res.sizeBeforeKB,
        sizeAfterKB: res.sizeAfterKB,
      });
      setLiveVersion((v) => v + 1);
      showNotification('success', res.message);
      if (onDataRestored) onDataRestored();
    } catch {
      showNotification('error', 'خطا در بهینه‌سازی پایگاه‌داده.');
    } finally {
      setOptimizing(false);
    }
  };

  // Handle Maintenance Reset Actions (Automatically creates pre-reset backup first!)
  const handleExecuteMaintenanceAction = async () => {
    if (!maintenanceAction) return;
    setActionLoading(true);
    try {
      const actionLabels: Record<typeof maintenanceAction, string> = {
        clear_invoices: 'پشتیبان خودکار قبل از پاکسازی فاکتورهای آزمایشی',
        reset_demo: 'پشتیبان خودکار قبل از بارگذاری داده‌های نمونه',
        factory_reset: 'پشتیبان خودکار اضطراری قبل از بازنشانی کارخانه',
      };

      // 1. Always create a safety backup on the server before destructive action
      await StorageService.createServerBackup(actionLabels[maintenanceAction]);

      // 2. Perform requested reset
      if (maintenanceAction === 'clear_invoices') {
        StorageService.clearInvoices();
        showNotification(
          'success',
          'فاکتورهای آزمایشی پاکسازی شدند (نسخه پشتیبان ایمنی قبلی در آرشیو سرور ذخیره شد).'
        );
      } else if (maintenanceAction === 'reset_demo') {
        StorageService.resetToDefaults();
        showNotification(
          'success',
          'داده‌های نمونه اولیه بارگذاری شدند (نسخه پشتیبان قبلی در آرشیو سرور محفوظ است).'
        );
      } else if (maintenanceAction === 'factory_reset') {
        StorageService.clearAllData();
        StorageService.resetSettingsToDefault();
        showNotification(
          'success',
          'بازنشانی به تنظیمات کارخانه انجام شد (نسخه پشتیبان قبلی در آرشیو سرور محفوظ است).'
        );
      }

      setMaintenanceAction(null);
      await fetchBackups();
      setLiveVersion((v) => v + 1);
      if (onDataRestored) onDataRestored();
    } catch {
      showNotification('error', 'خطا در اجرای عملیات بازنشانی.');
    } finally {
      setActionLoading(false);
    }
  };

  const toggleModuleSelection = (key: RestoreModuleKey) => {
    setSelectedModules((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const formatFileSize = (bytes: number): string => {
    if (!bytes || bytes === 0) return '0 KB';
    if (bytes < 1024) return `${toPersianDigits(bytes)} B`;
    const kb = Math.round(bytes / 1024);
    if (kb < 1024) return `${toPersianDigits(kb)} KB`;
    const mb = (bytes / (1024 * 1024)).toFixed(1);
    return `${toPersianDigits(mb)} MB`;
  };

  const getTriggerBadge = (trigger: string, compact = false) => {
    switch (trigger) {
      case 'auto':
        return (
          <span
            title="پشتیبان‌گیری خودکار زمان‌بندی‌شده سرور"
            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200/80 shrink-0"
          >
            <Clock className="w-3 h-3 text-emerald-600 shrink-0" />
            <span>خودکار</span>
          </span>
        );
      case 'pre-restore':
        return (
          <span
            title="پشتیبان ایمنی خودکار ثبت‌شده قبل از بازیابی"
            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200/80 shrink-0"
          >
            <ShieldCheck className="w-3 h-3 text-amber-600 shrink-0" />
            <span>{compact ? 'ایمنی' : 'ایمنی قبل بازیابی'}</span>
          </span>
        );
      case 'startup':
        return (
          <span
            title="پشتیبان اولیه هنگام راه‌اندازی سرور"
            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 text-blue-800 border border-blue-200/80 shrink-0"
          >
            <Layers className="w-3 h-3 text-blue-600 shrink-0" />
            <span>{compact ? 'سیستمی' : 'راه‌اندازی'}</span>
          </span>
        );
      default:
        return (
          <span
            title="پشتیبان ثبت‌شده توسط مدیر سیستم"
            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-indigo-50 text-indigo-800 border border-indigo-200/80 shrink-0"
          >
            <CheckCircle2 className="w-3 h-3 text-indigo-600 shrink-0" />
            <span>دستی</span>
          </span>
        );
    }
  };

  function formatIsoToPersianTime(isoString: string): string {
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
  }

  function formatCompactPersianDateTime(isoString: string): { date: string; time: string; relative: string } {
    try {
      const d = new Date(isoString);
      const date = new Intl.DateTimeFormat('fa-IR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(d);
      const time = new Intl.DateTimeFormat('fa-IR', {
        hour: '2-digit',
        minute: '2-digit',
      }).format(d);

      const diffSec = Math.max(0, Math.floor((Date.now() - d.getTime()) / 1000));
      let relative = 'لحظاتی پیش';
      if (diffSec >= 86400) {
        const days = Math.floor(diffSec / 86400);
        relative = `${toPersianDigits(days)} روز پیش`;
      } else if (diffSec >= 3600) {
        const hours = Math.floor(diffSec / 3600);
        relative = `${toPersianDigits(hours)} ساعت پیش`;
      } else if (diffSec >= 60) {
        const mins = Math.floor(diffSec / 60);
        relative = `${toPersianDigits(mins)} دقیقه پیش`;
      }
      return { date, time, relative };
    } catch {
      return { date: isoString, time: '', relative: '' };
    }
  }

  // Build comparison modules for the Restore Preview Modal
  const restoreComparisonModules: RestoreModuleOption[] = useMemo(() => {
    if (!restoreTarget) return [];
    const st = restoreTarget.stats;
    return [
      {
        key: 'products',
        title: 'کالاها، موجودی انبار و دسته‌بندی‌ها',
        description: 'لیست محصولات، قیمت‌های خرید و فروش، تنوع‌ها و موجودی انبارها',
        currentCount: liveStats.productsCount,
        backupCount: st.productsCount ?? 0,
        unitLabel: 'قلم کالا',
      },
      {
        key: 'invoices',
        title: 'فاکتورهای فروش، پیش‌فاکتورها و حواله‌های خروج',
        description: 'تمامی فاکتورهای فروش ثبت‌شده، وضعیت تسویه و برگه‌های خروج انبار',
        currentCount: liveStats.invoicesCount,
        backupCount: st.invoicesCount ?? 0,
        unitLabel: 'فاکتور فروش',
      },
      {
        key: 'purchaseInvoices',
        title: 'فاکتورهای خرید، خدمات و رسیدهای ورود انبار',
        description: 'فاکتورهای خرید کالا و خدمات و حواله‌های ورود به انبار',
        currentCount: liveStats.purchaseInvoicesCount,
        backupCount: st.purchaseInvoicesCount ?? 0,
        unitLabel: 'فاکتور خرید',
      },
      {
        key: 'customers',
        title: 'مشتریان، طرف‌حساب‌ها و تراکنش‌های مالی',
        description: 'دفتر اشخاص، مانده حساب‌ها و اسناد دریافت و پرداخت مشتریان',
        currentCount: liveStats.customersCount,
        backupCount: st.customersCount ?? 0,
        unitLabel: 'شخص / مشتری',
      },
      {
        key: 'movements',
        title: 'کاردکس گردش انبار، حواله‌های امانی و ناوگان',
        description: 'سوابق ورود و خروج کالا، حواله‌های تعمیرات/امانی و خودروهای ثبت‌شده',
        currentCount: liveStats.movementsCount,
        backupCount: st.movementsCount ?? 0,
        unitLabel: 'ردیف گردش',
      },
      {
        key: 'users',
        title: 'کاربران سیستم و سطوح دسترسی',
        description: 'حساب‌های کاربری، رمزهای عبور و مجوزهای دسترسی نقش‌ها',
        currentCount: liveStats.usersCount,
        backupCount: st.usersCount ?? liveStats.usersCount,
        unitLabel: 'کاربر',
      },
      {
        key: 'settings',
        title: 'تنظیمات فروشگاه، انبارها و قالب‌های چاپ',
        description: 'مشخصات فروشگاه، تعریف انبارها، پیکربندی تلگرام و ابعاد چاپ',
        currentCount: liveStats.warehousesCount,
        backupCount: liveStats.warehousesCount,
        unitLabel: 'انبار فعال',
      },
    ];
  }, [restoreTarget, liveStats]);

  const autoBackupsCount = useMemo(
    () => backups.filter((b) => b.trigger === 'auto').length,
    [backups]
  );

  return (
    <div className="space-y-5">
      {/* Toast Notification */}
      {statusMessage && (
        <div
          className={`p-3.5 rounded-xl text-xs font-bold flex items-center justify-between gap-3 shadow-xs animate-in fade-in transition-all ${
            statusMessage.type === 'success'
              ? 'bg-emerald-600 text-white'
              : 'bg-rose-600 text-white'
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

      {/* 1. UNIFIED DATABASE HEALTH & QUICK ACTION HUB */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {/* Top Header Bar */}
        <div className="bg-gradient-to-l from-slate-900 via-slate-800 to-emerald-950 p-4 sm:p-5 text-white">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-start sm:items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 flex items-center justify-center shrink-0">
                <Database className="w-6 h-6" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm sm:text-base font-black text-white">
                    مرکز مدیریت پایگاه‌داده، پشتیبان‌گیری و بازیابی هوشمند
                  </h3>
                  {dbDiag?.postgres?.connected ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/20 text-emerald-200 border border-emerald-400/30">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      متصل به PostgreSQL (mana_db)
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[10px] font-bold bg-sky-500/20 text-sky-200 border border-sky-400/30">
                      <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse" />
                      ذخیره‌سازی دوگانه سرور و مرورگر فعال
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-white/10 text-slate-200 border border-white/15">
                    <Clock className="w-3 h-3 text-emerald-300" />
                    بکاپ خودکار: هر {toPersianDigits(autoBackupInterval)} ساعت
                  </span>
                </div>
                <p className="text-[11px] text-slate-300 mt-1">
                  پشتیبان‌گیری اتمیک با کنترل یکپارچگی SHA-256، پیش‌نمایش و مقایسه تفاوت‌ها قبل از بازیابی، و بازگردانی کامل یا انتخابی اطلاعات
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleForceSyncDatabase}
                disabled={syncingDb}
                className="px-3 py-2 bg-white/10 hover:bg-white/20 text-white border border-white/15 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                title="همگام‌سازی فوری اطلاعات مرورگر و سرور"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${syncingDb ? 'animate-spin text-emerald-300' : 'text-emerald-300'}`} />
                <span>{syncingDb ? 'در حال همگام‌سازی...' : 'همگام‌سازی فوری'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  fetchBackups();
                  fetchDbDiag();
                  setLiveVersion((v) => v + 1);
                }}
                disabled={loading}
                className="p-2 bg-white/10 hover:bg-white/20 text-slate-200 border border-white/15 rounded-xl transition-all cursor-pointer"
                title="بروزرسانی وضعیت"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* Primary Action Toolbar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5 mt-4 pt-4 border-t border-white/10">
            {/* 1. Create Server Backup */}
            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              disabled={actionLoading}
              className="py-2.5 px-3.5 bg-emerald-500 hover:bg-emerald-400 active:scale-98 text-slate-950 font-black text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Archive className="w-4 h-4 shrink-0" />
              <span>+ ثبت بکاپ جدید در سرور</span>
            </button>

            {/* 2. Download Complete JSON Backup */}
            <button
              type="button"
              onClick={handleDownloadJsonBackup}
              disabled={downloadingJson}
              className="py-2.5 px-3.5 bg-white/10 hover:bg-white/20 active:scale-98 text-white border border-white/15 font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Download className={`w-4 h-4 text-emerald-300 shrink-0 ${downloadingJson ? 'animate-bounce' : ''}`} />
              <span>{downloadingJson ? 'در حال آماده‌سازی...' : 'دانلود بکاپ کامل (JSON)'}</span>
            </button>

            {/* 3. Download PostgreSQL SQL Dump */}
            <button
              type="button"
              onClick={handleDownloadSqlDump}
              disabled={downloadingSql}
              className="py-2.5 px-3.5 bg-blue-500/25 hover:bg-blue-500/35 active:scale-98 text-blue-100 border border-blue-400/30 font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <FileCode className={`w-4 h-4 text-blue-300 shrink-0 ${downloadingSql ? 'animate-bounce' : ''}`} />
              <span>{downloadingSql ? 'در حال استخراج...' : 'دانلود اسکریپت دیتابیس (.SQL)'}</span>
            </button>

            {/* 4. Upload & Restore from File (.json or .sql) */}
            <label className="py-2.5 px-3.5 bg-amber-500/20 hover:bg-amber-500/30 active:scale-98 text-amber-100 border border-amber-400/30 font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer text-center">
              <Upload className="w-4 h-4 text-amber-300 shrink-0" />
              <span>بارگذاری و بازیابی از فایل</span>
              <input
                type="file"
                accept=".json,.sql,.txt"
                onChange={handleUnifiedFileSelect}
                disabled={actionLoading}
                className="hidden"
              />
            </label>

            {/* 5. Send Backup to Telegram */}
            <button
              type="button"
              id="backup-header-send-telegram-btn"
              onClick={() => handleSendBackupToTelegram()}
              disabled={sendingTelegram || actionLoading}
              className="py-2.5 px-3.5 bg-sky-500 hover:bg-sky-400 active:scale-98 text-slate-950 font-black text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              title="ارسال مستقیم فایل‌های پشتیبان SQL و JSON به تلگرام ثبت‌شده در سیستم"
            >
              <Send className={`w-4 h-4 shrink-0 ${sendingTelegram ? 'animate-bounce' : ''}`} />
              <span className="truncate">
                {sendingTelegram ? 'در حال ارسال به تلگرام...' : 'ارسال بکاپ به تلگرام'}
              </span>
            </button>
          </div>
        </div>

        {/* Live Database Entities Summary Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 divide-y sm:divide-y-0 sm:divide-x sm:divide-x-reverse divide-slate-100 bg-slate-50/70">
          <div className="p-3 sm:p-3.5 flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-blue-50 text-blue-600 shrink-0">
              <Boxes className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] text-slate-500 font-bold block">کالاهای انبار</span>
              <span className="text-xs sm:text-sm font-black text-slate-900 tabular-nums">
                {toPersianDigits(liveStats.productsCount)} قلم
              </span>
            </div>
          </div>

          <div className="p-3 sm:p-3.5 flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600 shrink-0">
              <ReceiptText className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] text-slate-500 font-bold block">فاکتورهای فروش</span>
              <span className="text-xs sm:text-sm font-black text-slate-900 tabular-nums">
                {toPersianDigits(liveStats.invoicesCount)} سند
              </span>
            </div>
          </div>

          <div className="p-3 sm:p-3.5 flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600 shrink-0">
              <ShoppingBag className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] text-slate-500 font-bold block">فاکتورهای خرید و خدمات</span>
              <span className="text-xs sm:text-sm font-black text-slate-900 tabular-nums">
                {toPersianDigits(liveStats.purchaseInvoicesCount)} سند
              </span>
            </div>
          </div>

          <div className="p-3 sm:p-3.5 flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-purple-50 text-purple-600 shrink-0">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] text-slate-500 font-bold block">مشتریان و اشخاص</span>
              <span className="text-xs sm:text-sm font-black text-slate-900 tabular-nums">
                {toPersianDigits(liveStats.customersCount)} نفر
              </span>
            </div>
          </div>

          <div className="p-3 sm:p-3.5 flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-amber-50 text-amber-600 shrink-0">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] text-slate-500 font-bold block">کاردکس و تراکنش‌ها</span>
              <span className="text-xs sm:text-sm font-black text-slate-900 tabular-nums">
                {toPersianDigits(liveStats.movementsCount + liveStats.customerTransactionsCount)} مورد
              </span>
            </div>
          </div>

          <div className="p-3 sm:p-3.5 flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-slate-200/80 text-slate-700 shrink-0">
              <HardDrive className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] text-slate-500 font-bold block">آرشیو بکاپ / حجم</span>
              <span className="text-xs sm:text-sm font-black text-slate-900 tabular-nums">
                {toPersianDigits(backups.length)} نسخه ({toPersianDigits(liveStats.sizeKB)} KB)
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. ORGANIZED SUB-TABS NAVIGATION */}
      <div className="bg-white rounded-2xl p-1.5 border border-slate-200 shadow-xs flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => setActiveSubTab('backups')}
          className={`flex-1 min-w-[180px] py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeSubTab === 'backups'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
          }`}
        >
          <Archive className="w-4 h-4 shrink-0" />
          <span>آرشیو بکاپ‌ها و بازیابی هوشمند</span>
          <span
            className={`px-2 py-0.5 rounded-md text-[10px] font-black tabular-nums ${
              activeSubTab === 'backups' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-700'
            }`}
          >
            {toPersianDigits(backups.length)}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('postgres')}
          className={`flex-1 min-w-[180px] py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeSubTab === 'postgres'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
          }`}
        >
          <Database className="w-4 h-4 shrink-0" />
          <span>دیتابیس PostgreSQL و اسکریپت SQL</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('maintenance')}
          className={`flex-1 min-w-[180px] py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeSubTab === 'maintenance'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
          }`}
        >
          <Wrench className="w-4 h-4 shrink-0" />
          <span>بهینه‌سازی، خروجی حسابداری و نگهداری</span>
        </button>
      </div>

      {/* ===================================================================== */}
      {/* TAB 1: SERVER BACKUPS ARCHIVE & SMART RESTORE                         */}
      {/* ===================================================================== */}
      {activeSubTab === 'backups' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          {/* Compact Header, Search, Filter Pills & Sort Controls */}
          <div className="p-3.5 sm:p-4 border-b border-slate-200 space-y-3 bg-slate-50/60">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                  <Archive className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-black text-xs sm:text-sm text-slate-900">
                      آرشیو نسخه‌های پشتیبان ثبت‌شده در سرور
                    </h4>
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-bold tabular-nums">
                      {toPersianDigits(filteredBackups.length)} نسخه
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 hidden sm:block mt-0.5">
                    روی آیکون چشم جهت مشاهده جزئیات کامل یا دکمه بازیابی جهت پیش‌نمایش و مقایسه با وضعیت فعلی کلیک کنید
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                {selectedBackupFiles.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowBulkDeleteModal(true)}
                    disabled={actionLoading}
                    className="px-2.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-[11px] font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>حذف انتخابی ({toPersianDigits(selectedBackupFiles.length)})</span>
                  </button>
                )}

                {autoBackupsCount > 5 && (
                  <button
                    type="button"
                    onClick={handlePruneOldAutoBackups}
                    disabled={actionLoading}
                    className="px-2.5 py-1.5 bg-white hover:bg-amber-50 text-slate-700 hover:text-amber-800 border border-slate-200 hover:border-amber-300 rounded-xl text-[11px] font-bold transition-all flex items-center gap-1 cursor-pointer"
                    title="حفظ ۵ نسخه خودکار آخر و حذف بکاپ‌های خودکار قدیمی‌تر"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    <span className="hidden sm:inline">پاکسازی خودکارهای قدیمی</span>
                    <span className="sm:hidden">پاکسازی قدیمی‌ها</span>
                  </button>
                )}
              </div>
            </div>

            {/* Search + Trigger Filter Pills + Sort Selector */}
            <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-2.5">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 flex-1">
                <div className="relative flex-1 sm:max-w-xs">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="جستجوی عنوان، فایل یا تاریخ..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl pr-8 pl-7 py-1.5 text-xs text-slate-800 focus:border-emerald-500 outline-none"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Filter Pills with Counts */}
                <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 overflow-x-auto">
                  {(
                    [
                      { id: 'all', label: 'همه', count: triggerCounts.all },
                      { id: 'manual', label: 'دستی', count: triggerCounts.manual },
                      { id: 'auto', label: 'خودکار', count: triggerCounts.auto },
                      { id: 'pre-restore', label: 'ایمنی', count: triggerCounts['pre-restore'] },
                      { id: 'startup', label: 'سیستمی', count: triggerCounts.startup },
                    ] as { id: TriggerFilter; label: string; count: number }[]
                  ).map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setTriggerFilter(tab.id)}
                      className={`px-2 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1 ${
                        triggerFilter === tab.id
                          ? 'bg-slate-900 text-white shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                      }`}
                    >
                      <span>{tab.label}</span>
                      <span
                        className={`text-[9px] px-1 rounded tabular-nums ${
                          triggerFilter === tab.id ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {toPersianDigits(tab.count)}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Sort Selector & Legend */}
              <div className="flex items-center justify-between sm:justify-end gap-2">
                <div className="hidden xl:flex items-center gap-2 text-[10px] text-slate-500 bg-white px-2.5 py-1.5 rounded-xl border border-slate-200/80">
                  <span className="flex items-center gap-1" title="تعداد کالاها">
                    <Boxes className="w-3 h-3 text-blue-600" /> کالا
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1" title="فاکتورهای فروش">
                    <ReceiptText className="w-3 h-3 text-emerald-600" /> فروش
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1" title="فاکتورهای خرید">
                    <ShoppingBag className="w-3 h-3 text-indigo-600" /> خرید
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1" title="مشتریان و طرف‌حساب‌ها">
                    <Users className="w-3 h-3 text-purple-600" /> مشتری
                  </span>
                </div>

                <div className="flex items-center gap-1.5 text-[11px] text-slate-600 bg-white border border-slate-200 rounded-xl px-2.5 py-1.5">
                  <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400" />
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="bg-transparent font-bold text-slate-800 outline-none cursor-pointer text-[11px]"
                  >
                    <option value="newest">جدیدترین زمان ثبت</option>
                    <option value="oldest">قدیمی‌ترین زمان ثبت</option>
                    <option value="largest">بیشترین حجم فایل</option>
                    <option value="smallest">کمترین حجم فایل</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="p-12 text-center text-slate-400 space-y-3">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto text-emerald-600" />
              <p className="text-xs font-bold">در حال فراخوانی لیست نسخه‌های پشتیبان از سرور...</p>
            </div>
          ) : filteredBackups.length === 0 ? (
            <div className="p-12 text-center text-slate-400 space-y-3">
              <HardDrive className="w-10 h-10 mx-auto text-slate-300" />
              <p className="text-xs font-bold text-slate-600">
                {backups.length === 0
                  ? 'هنوز هیچ نسخه پشتیبانی در سرور ثبت نشده است.'
                  : 'هیچ نسخه پشتیبانی مطابق با فیلتر یا جستجوی شما یافت نشد.'}
              </p>
              {backups.length === 0 ? (
                <button
                  type="button"
                  onClick={() => handleCreateBackup()}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold cursor-pointer"
                >
                  ایجاد اولین نسخه پشتیبان
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setTriggerFilter('all');
                  }}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold cursor-pointer"
                >
                  نمایش همه نسخه‌ها
                </button>
              )}
            </div>
          ) : (
            <>
              {/* =============================================================== */}
              {/* DECLUTTERED DESKTOP TABLE VIEW (Click Row for Details & Actions) */}
              {/* =============================================================== */}
              <div className="hidden md:block">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-100/80 text-slate-600 font-bold border-b border-slate-200 text-[11px]">
                    <tr>
                      <th className="py-2.5 px-3 w-16 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <input
                            type="checkbox"
                            checked={
                              paginatedBackups.length > 0 &&
                              paginatedBackups.every((b) => selectedBackupFiles.includes(b.filename))
                            }
                            onChange={(e) => {
                              if (e.target.checked) {
                                const pageFiles = paginatedBackups.map((b) => b.filename);
                                setSelectedBackupFiles((prev) => Array.from(new Set([...prev, ...pageFiles])));
                              } else {
                                const pageSet = new Set(paginatedBackups.map((b) => b.filename));
                                setSelectedBackupFiles((prev) => prev.filter((f) => !pageSet.has(f)));
                              }
                            }}
                            className="w-3.5 h-3.5 rounded text-emerald-600 cursor-pointer"
                            title="انتخاب همه در این صفحه"
                          />
                          <span>#</span>
                        </div>
                      </th>
                      <th className="py-2.5 px-3">عنوان نسخه پشتیبان</th>
                      <th className="py-2.5 px-3 w-36 text-center">نوع ثبت</th>
                      <th className="py-2.5 px-3 w-48">تاریخ و زمان ثبت</th>
                      <th className="py-2.5 px-3 w-28 text-center">حجم فایل</th>
                      <th className="py-2.5 px-4 w-36 text-left">جزئیات و عملیات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {paginatedBackups.map((bk, index) => {
                      const rowNumber = (currentPage - 1) * (pageSize || filteredBackups.length) + index + 1;
                      const isLatest =
                        currentPage === 1 &&
                        index === 0 &&
                        sortBy === 'newest' &&
                        triggerFilter === 'all' &&
                        !searchQuery;
                      const isSelected = selectedBackupFiles.includes(bk.filename);
                      const dt = formatCompactPersianDateTime(bk.createdAt);

                      return (
                        <tr
                          key={bk.filename}
                          onClick={() => setSelectedBackupModal(bk)}
                          className={`group cursor-pointer transition-colors ${
                            isSelected
                              ? 'bg-emerald-50/60 hover:bg-emerald-50'
                              : 'hover:bg-slate-50/90'
                          }`}
                        >
                          {/* 1. Checkbox + Row Number */}
                          <td
                            className="py-3 px-3 text-center"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="flex items-center justify-center gap-1.5">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={(e) => {
                                  setSelectedBackupFiles((prev) =>
                                    e.target.checked
                                      ? [...prev, bk.filename]
                                      : prev.filter((f) => f !== bk.filename)
                                  );
                                }}
                                className="w-3.5 h-3.5 rounded text-emerald-600 cursor-pointer"
                              />
                              <span className="w-5 h-5 rounded-md bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-[10px] tabular-nums">
                                {toPersianDigits(rowNumber)}
                              </span>
                            </div>
                          </td>

                          {/* 2. Clean Backup Title */}
                          <td className="py-3 px-3 min-w-0">
                            <div className="flex items-center gap-2">
                              <span
                                className="font-bold text-slate-800 group-hover:text-emerald-700 transition-colors text-xs truncate max-w-[280px] lg:max-w-[420px]"
                                title={bk.label}
                              >
                                {bk.label}
                              </span>
                              {isLatest && (
                                <span className="text-[9px] font-black bg-emerald-600 text-white px-1.5 py-0.5 rounded shrink-0">
                                  آخرین نسخه
                                </span>
                              )}
                            </div>
                          </td>

                          {/* 3. Trigger Badge */}
                          <td className="py-3 px-3 text-center whitespace-nowrap">
                            {getTriggerBadge(bk.trigger, true)}
                          </td>

                          {/* 4. Compact Date & Time */}
                          <td className="py-3 px-3 whitespace-nowrap">
                            <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-700 tabular-nums">
                              <span>{dt.date}</span>
                              <span className="text-slate-300">•</span>
                              <span className="text-slate-500 font-mono">{dt.time}</span>
                              <span className="text-[10px] font-normal text-slate-400">
                                ({dt.relative})
                              </span>
                            </div>
                          </td>

                          {/* 5. File Size */}
                          <td className="py-3 px-3 text-center whitespace-nowrap">
                            <span
                              className="text-[11px] font-mono font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md"
                              dir="ltr"
                            >
                              {formatFileSize(bk.sizeBytes)}
                            </span>
                          </td>

                          {/* 6. Subtle Prompt to Open Modal */}
                          <td className="py-3 px-4 text-left whitespace-nowrap">
                            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-500 group-hover:text-emerald-700 bg-slate-100/80 group-hover:bg-emerald-50 border border-transparent group-hover:border-emerald-200 px-2.5 py-1 rounded-lg transition-all">
                              <Eye className="w-3.5 h-3.5" />
                              <span>مشاهده و عملیات</span>
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* =============================================================== */}
              {/* DECLUTTERED MOBILE LIST VIEW (Click Row for Details & Actions)  */}
              {/* =============================================================== */}
              <div className="md:hidden divide-y divide-slate-100">
                {paginatedBackups.map((bk, index) => {
                  const rowNumber = (currentPage - 1) * (pageSize || filteredBackups.length) + index + 1;
                  const isLatest =
                    currentPage === 1 &&
                    index === 0 &&
                    sortBy === 'newest' &&
                    triggerFilter === 'all' &&
                    !searchQuery;
                  const isSelected = selectedBackupFiles.includes(bk.filename);
                  const dt = formatCompactPersianDateTime(bk.createdAt);

                  return (
                    <div
                      key={bk.filename}
                      onClick={() => setSelectedBackupModal(bk)}
                      className={`p-3 flex items-center justify-between gap-2.5 cursor-pointer transition-colors active:bg-slate-100 ${
                        isSelected ? 'bg-emerald-50/60' : 'hover:bg-slate-50/80'
                      }`}
                    >
                      {/* Right Side: Checkbox + Number + Title + Compact Date */}
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <div
                          className="flex items-center gap-1.5 shrink-0"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              setSelectedBackupFiles((prev) =>
                                e.target.checked
                                  ? [...prev, bk.filename]
                                  : prev.filter((f) => f !== bk.filename)
                              );
                            }}
                            className="w-3.5 h-3.5 rounded text-emerald-600 cursor-pointer"
                          />
                          <span className="w-5 h-5 rounded-md bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-[10px] tabular-nums">
                            {toPersianDigits(rowNumber)}
                          </span>
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <p className="font-bold text-slate-900 text-xs truncate">{bk.label}</p>
                            {isLatest && (
                              <span className="text-[9px] font-black bg-emerald-600 text-white px-1.5 py-0.2 rounded shrink-0">
                                آخرین
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 text-[10px] text-slate-500 mt-0.5 tabular-nums">
                            <span>
                              {dt.date} • {dt.time}
                            </span>
                            <span className="text-slate-300">|</span>
                            <span className="font-mono font-bold text-slate-600" dir="ltr">
                              {formatFileSize(bk.sizeBytes)}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Left Side: Trigger Badge + View Icon */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        {getTriggerBadge(bk.trigger, true)}
                        <span className="p-1.5 rounded-lg bg-slate-100 text-slate-500">
                          <Eye className="w-3.5 h-3.5" />
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="p-3 border-t border-slate-100 bg-slate-50/40">
                <SmartPagination
                  currentPage={currentPage}
                  totalItems={filteredBackups.length}
                  pageSize={pageSize}
                  onPageChange={setCurrentPage}
                  onPageSizeChange={setPageSize}
                  itemLabel="نسخه پشتیبان"
                />
              </div>
            </>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 2: POSTGRESQL DATABASE & SQL SCRIPTS                              */}
      {/* ===================================================================== */}
      {activeSubTab === 'postgres' && (
        <div className="space-y-5">
          {/* PostgreSQL Live Diagnostics Card */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 sm:p-6 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <div className="flex items-start sm:items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 border border-blue-200 flex items-center justify-center shrink-0">
                  <Database className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm sm:text-base font-black text-slate-900">
                      وضعیت و پیکربندی پایگاه‌داده مرکزی (PostgreSQL - mana_db)
                    </h3>
                    {dbDiag?.postgres?.connected ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        متصل به mana_db
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                        <span className="w-2 h-2 rounded-full bg-amber-500" />
                        ذخیره‌سازی محلی سرور (فایل JSON اتمیک)
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    مدیریت اتصال، استخراج اسکریپت استاندارد SQL، اجرای مستقیم کوئری‌ها و دستورات داکر
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
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${syncingDb ? 'animate-spin' : ''}`} />
                  <span>{syncingDb ? 'در حال ذخیره‌سازی...' : 'همگام‌سازی فوری با دیتابیس'}</span>
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
                    : 'محلی'}
                </span>
              </div>
            </div>

            {/* Diagnostic message */}
            {dbDiag?.postgres?.message && (
              <div
                className={`p-3 rounded-xl text-xs flex items-center justify-between gap-2 ${
                  dbDiag.postgres.connected
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-slate-100 text-slate-700 border border-slate-200'
                }`}
              >
                <div className="flex items-center gap-2">
                  {dbDiag.postgres.connected ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <HardDrive className="w-4 h-4 text-slate-500 shrink-0" />
                  )}
                  <span>{dbDiag.postgres.message}</span>
                </div>
                {dbDiag.postgres.connected && dbDiag.postgres.tablesCount !== undefined && (
                  <span className="font-bold text-[11px] bg-emerald-100 px-2 py-0.5 rounded-md text-emerald-900 shrink-0">
                    {toPersianDigits(dbDiag.postgres.tablesCount)} جدول فعال
                  </span>
                )}
              </div>
            )}

            {/* 3 SQL Operations Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              {/* Card 1: SQL Dump Export */}
              <div className="p-4 rounded-xl bg-blue-50/50 border border-blue-200/80 flex flex-col justify-between space-y-3">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-blue-800 font-bold text-xs">
                    <FileCode className="w-4 h-4 text-blue-600" />
                    <span>۱. خروجی اسکریپت کامل SQL</span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    تولید اسکریپت جامع DDL/DML شامل جداول `system_state`، کالاها، مشتریان، فاکتورها و انبارها سازگار با PostgreSQL، DBeaver و pgAdmin.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadSqlDump}
                  disabled={downloadingSql}
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>{downloadingSql ? 'در حال تولید فایل...' : 'دانلود فایل mana_db.sql'}</span>
                </button>
              </div>

              {/* Card 2: SQL Import / Restore */}
              <div className="p-4 rounded-xl bg-amber-50/50 border border-amber-200/80 flex flex-col justify-between space-y-3">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-amber-900 font-bold text-xs">
                    <Upload className="w-4 h-4 text-amber-600" />
                    <span>۲. بازیابی و اجرای اسکریپت SQL</span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    انتخاب فایل اسکریپت `.sql` برای بازگردانی ساختار و اطلاعات به پایگاه‌داده PostgreSQL با تراکنش امن (ACID Rollback).
                  </p>
                </div>
                <label className="w-full py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer text-center">
                  <Upload className="w-3.5 h-3.5" />
                  <span>انتخاب و بارگذاری فایل .sql</span>
                  <input
                    type="file"
                    accept=".sql,.txt"
                    className="hidden"
                    onChange={handleUnifiedFileSelect}
                  />
                </label>
              </div>

              {/* Card 3: Internal Snapshot in db_backups */}
              <div className="p-4 rounded-xl bg-emerald-50/50 border border-emerald-200/80 flex flex-col justify-between space-y-3">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-emerald-900 font-bold text-xs">
                    <Archive className="w-4 h-4 text-emerald-600" />
                    <span>۳. ثبت اسنپ‌شات در جدول db_backups</span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    ایجاد یک رکورد پشتیبان دائمی در جدول داخلی خود دیتابیس PostgreSQL بدون نیاز به نگهداری فایل خارجی.
                  </p>
                </div>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    placeholder="عنوان اسنپ‌شات..."
                    value={snapshotLabel}
                    onChange={(e) => setSnapshotLabel(e.target.value)}
                    className="flex-1 bg-white border border-emerald-300 rounded-xl px-2.5 py-2 text-xs text-slate-800 outline-none focus:border-emerald-600"
                  />
                  <button
                    type="button"
                    onClick={handleCreatePostgresSnapshot}
                    disabled={creatingSnapshot}
                    className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50 shrink-0"
                  >
                    <Sparkles className={`w-3.5 h-3.5 ${creatingSnapshot ? 'animate-spin' : ''}`} />
                    <span>ثبت</span>
                  </button>
                </div>
              </div>
            </div>

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
                  {[
                    {
                      id: 'cmd1',
                      title: '۱. ورود مستقیم به خط فرمان PostgreSQL (psql) داخل کانتینر:',
                      cmd: 'docker exec -it mana_postgres_db psql -U mana_user -d mana_db',
                    },
                    {
                      id: 'cmd2',
                      title: '۲. پشتیبان‌گیری کامل و خروجی SQL از mana_db:',
                      cmd: 'docker exec -t mana_postgres_db pg_dump -U mana_user mana_db > /var/backups/mana_db_$(date +%Y%m%d).sql',
                    },
                    {
                      id: 'cmd3',
                      title: '۳. بازیابی (Restore) فایل بکاپ SQL در دیتابیس mana_db:',
                      cmd: 'cat /var/backups/your_backup.sql | docker exec -i mana_postgres_db psql -U mana_user -d mana_db',
                    },
                    {
                      id: 'cmd4',
                      title: '۴. مشاهده زنده لاگ‌های کانتینر PostgreSQL:',
                      cmd: 'docker compose logs -f postgres',
                    },
                  ].map((item) => (
                    <div key={item.id} className="space-y-1">
                      <div className="flex items-center justify-between text-slate-300 font-bold text-[11px]">
                        <span>{item.title}</span>
                        <button
                          type="button"
                          onClick={() => handleCopyCommand(item.cmd, item.id)}
                          className="p-1 px-2 rounded bg-slate-800 hover:bg-slate-700 text-[10px] text-emerald-400 flex items-center gap-1 cursor-pointer transition-colors"
                        >
                          {copiedKey === item.id ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                          <span>{copiedKey === item.id ? 'کپی شد' : 'کپی دستور'}</span>
                        </button>
                      </div>
                      <div
                        className="p-2.5 bg-black/70 rounded-lg font-mono text-[11px] text-emerald-300 text-left overflow-x-auto"
                        dir="ltr"
                      >
                        {item.cmd}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 3: DATABASE OPTIMIZATION, ACCOUNTING EXPORT & MAINTENANCE         */}
      {/* ===================================================================== */}
      {activeSubTab === 'maintenance' && (
        <div className="space-y-5">
          {/* 1. Smart Database Optimizer & Integrity Check */}
          <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-200 flex items-center justify-center shrink-0">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-black text-sm text-slate-900">
                    بهینه‌سازی و یکپارچه‌سازی هوشمند پایگاه‌داده (Database Optimizer)
                  </h4>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    پاکسازی خودکار حواله‌های خروج یتیم، حذف شناسه‌های حذفی (Tombstones) تکراری یا منقضی، تکمیل خودکار کد و بارکد کالاها، و فشرده‌سازی حافظه محلی و سرور بدون حذف هیچ‌گونه سند یا فاکتور فعال.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleOptimizeDatabase}
                disabled={optimizing}
                className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer shrink-0 disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${optimizing ? 'animate-spin' : ''}`} />
                <span>{optimizing ? 'در حال بهینه‌سازی...' : 'اجرای بهینه‌سازی و یکپارچه‌سازی'}</span>
              </button>
            </div>

            {optimizeReport && (
              <div className="p-4 rounded-xl bg-indigo-50/60 border border-indigo-200 text-xs space-y-2 animate-in fade-in">
                <div className="font-bold text-indigo-950 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-indigo-600" />
                  <span>گزارش آخرین بهینه‌سازی انجام‌شده:</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
                  <div className="bg-white p-2.5 rounded-lg border border-indigo-100">
                    <span className="text-[10px] text-slate-500 block">حواله‌های یتیم پاک‌شده</span>
                    <span className="font-black text-slate-800">{toPersianDigits(optimizeReport.cleanedOrphanSlips)} مورد</span>
                  </div>
                  <div className="bg-white p-2.5 rounded-lg border border-indigo-100">
                    <span className="text-[10px] text-slate-500 block">رکوردهای حذفی بهینه‌شده</span>
                    <span className="font-black text-slate-800">{toPersianDigits(optimizeReport.cleanedTombstones)} مورد</span>
                  </div>
                  <div className="bg-white p-2.5 rounded-lg border border-indigo-100">
                    <span className="text-[10px] text-slate-500 block">لاگ‌های قدیمی فشرده‌شده</span>
                    <span className="font-black text-slate-800">{toPersianDigits(optimizeReport.trimmedLogs)} رویداد</span>
                  </div>
                  <div className="bg-white p-2.5 rounded-lg border border-indigo-100">
                    <span className="text-[10px] text-slate-500 block">حجم حافظه (قبل ← بعد)</span>
                    <span className="font-mono font-bold text-emerald-700">
                      {toPersianDigits(optimizeReport.sizeBeforeKB)} ← {toPersianDigits(optimizeReport.sizeAfterKB)} KB
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 2. Accounting CSV Export Card */}
          <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 shadow-xs space-y-4">
            <div className="p-4 rounded-xl border border-emerald-300/80 bg-emerald-50/40 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-emerald-800">
                  <FileSpreadsheet className="w-5 h-5 text-emerald-600 shrink-0" />
                  <h4 className="font-bold text-xs sm:text-sm text-slate-900">
                    خروجی اکسل و CSV فاکتورها (ویژه نرم‌افزارهای حسابداری)
                  </h4>
                </div>
                <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-md font-bold self-start sm:self-auto">
                  سازگار با هلو، سپیدار، راه‌کاران، پارسیان و اکسل
                </span>
              </div>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                استخراج جامع کلیه فاکتورهای فروش ثبت‌شده به همراه مشخصات خریدار، شماره تماس، کد پیگیری، اقلام فاکتور، مبالغ مالیات و تخفیفات، وضعیت تسویه و روش پرداخت با انکودینگ استاندارد UTF-8 BOM جهت گزارش‌گیری و ثبت اسناد حسابداری.
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="button"
                  id="admin-datacenter-export-csv-btn"
                  onClick={() =>
                    exportInvoicesToCsv(
                      liveStats.invoices,
                      liveStats.settings,
                      'خروجی_حسابداری_کل_فاکتورها'
                    )
                  }
                  disabled={liveStats.invoicesCount === 0}
                  className="py-2.5 px-4 bg-emerald-700 hover:bg-emerald-800 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>دانلود CSV همه فاکتورها ({toPersianDigits(liveStats.invoicesCount)} فاکتور)</span>
                </button>
                {onNavigateToInvoicesCsv && (
                  <button
                    type="button"
                    onClick={onNavigateToInvoicesCsv}
                    className="py-2.5 px-4 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Filter className="w-4 h-4 text-slate-500" />
                    <span>مشاهده و فیلترگذاری قبل از خروجی</span>
                  </button>
                )}
              </div>
            </div>

            {/* 3. Protected Sensitive Reset Operations */}
            <div className="pt-3 border-t border-slate-100 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h4 className="font-bold text-xs text-rose-700 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-rose-600" />
                  <span>عملیات حساس و بازنشانی داده‌ها (مجهز به پشتیبان‌گیری خودکار قبل از اجرا)</span>
                </h4>
                <span className="text-[10px] text-slate-500">
                  قبل از اجرای هر یک از گزینه‌های زیر، یک بکاپ ایمنی در سرور ذخیره می‌شود
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Clear Invoices Only */}
                <button
                  type="button"
                  onClick={() => setMaintenanceAction('clear_invoices')}
                  className="p-3.5 bg-amber-50/70 hover:bg-amber-100/80 text-amber-900 border border-amber-200 rounded-xl text-xs font-bold flex flex-col items-center justify-center gap-1.5 text-center cursor-pointer transition-colors"
                >
                  <Trash2 className="w-5 h-5 text-amber-600" />
                  <span>پاکسازی فاکتورهای آزمایشی</span>
                  <span className="text-[10px] text-amber-700 font-normal">
                    حذف فاکتورهای فروش (کالاها و مشتریان حفظ می‌شوند)
                  </span>
                </button>

                {/* Reset to Demo Defaults */}
                <button
                  type="button"
                  onClick={() => setMaintenanceAction('reset_demo')}
                  className="p-3.5 bg-slate-50 hover:bg-slate-100 text-slate-800 border border-slate-200 rounded-xl text-xs font-bold flex flex-col items-center justify-center gap-1.5 text-center cursor-pointer transition-colors"
                >
                  <RotateCcw className="w-5 h-5 text-slate-600" />
                  <span>بارگذاری داده‌های دمو و نمونه</span>
                  <span className="text-[10px] text-slate-500 font-normal">
                    جایگزینی با اطلاعات نمونه اولیه فروشگاه
                  </span>
                </button>

                {/* Factory Reset */}
                <button
                  type="button"
                  onClick={() => setMaintenanceAction('factory_reset')}
                  className="p-3.5 bg-rose-50/70 hover:bg-rose-100/80 text-rose-900 border border-rose-200 rounded-xl text-xs font-bold flex flex-col items-center justify-center gap-1.5 text-center cursor-pointer transition-colors"
                >
                  <AlertTriangle className="w-5 h-5 text-rose-600" />
                  <span>بازنشانی کامل به تنظیمات کارخانه</span>
                  <span className="text-[10px] text-rose-700 font-normal">
                    پاکسازی کامل کالاها، مشتریان و فاکتورها
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 1: CREATE BACKUP WITH LABEL                                     */}
      {/* ===================================================================== */}
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
              ابتدا آخرین تغییرات مرورگر با سرور همگام‌سازی شده و سپس یک نسخه کامل از تمامی اطلاعات (کالاها، فاکتورهای فروش و خرید، کاردکس، مشتریان و کاربران) با امضای دیجیتال SHA-256 ذخیره می‌شود.
            </p>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                برچسب یا یادداشت این نسخه (اختیاری):
              </label>
              <input
                type="text"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !actionLoading) handleCreateBackup();
                }}
                placeholder="مثال: قبل از انبارگردانی، پایان حسابداری ماه..."
                className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-300 focus:outline-hidden focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
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

      {/* ===================================================================== */}
      {/* MODAL 2: INTERACTIVE RESTORE PREVIEW, DIFF & SELECTIVE MODULE PICKER  */}
      {/* ===================================================================== */}
      {restoreTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/65 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-4 sm:p-6 shadow-2xl border border-slate-200 space-y-4 my-auto max-h-[92vh] flex flex-col animate-in fade-in zoom-in-95">
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3 shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-600 shrink-0">
                  <ArrowLeftRight className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-black text-sm sm:text-base text-slate-900">
                      {restoreTarget.mode === 'uploaded_json'
                        ? 'پیش‌نمایش و بررسی فایل پشتیبان بارگذاری‌شده'
                        : 'پیش‌نمایش، مقایسه و بازیابی نسخه پشتیبان'}
                    </h3>
                    {restoreTarget.checksumValid !== false && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <FileCheck className="w-3 h-3" />
                        ساختار و یکپارچگی معتبر
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {restoreTarget.label} • {formatIsoToPersianTime(restoreTarget.createdAt)} ({formatFileSize(restoreTarget.sizeBytes)})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setRestoreTarget(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="space-y-4 overflow-y-auto pr-0.5 flex-1">
              {/* If uploaded file: choose between Restore Now vs Save Only */}
              {restoreTarget.mode === 'uploaded_json' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setUploadActionType('restore_now')}
                    className={`p-2.5 rounded-lg text-xs font-bold text-right transition-all cursor-pointer border ${
                      uploadActionType === 'restore_now'
                        ? 'bg-amber-50 border-amber-300 text-amber-950 shadow-2xs'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <RotateCcw className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>ذخیره در سرور + بازیابی فوری اطلاعات</span>
                    </div>
                    <p className="text-[10px] font-normal text-slate-500 mt-1">
                      فایل در آرشیو سرور ذخیره شده و بخش‌های انتخابی بلافاصله جایگزین می‌شوند.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setUploadActionType('save_only')}
                    className={`p-2.5 rounded-lg text-xs font-bold text-right transition-all cursor-pointer border ${
                      uploadActionType === 'save_only'
                        ? 'bg-blue-50 border-blue-300 text-blue-950 shadow-2xs'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <Archive className="w-4 h-4 text-blue-600 shrink-0" />
                      <span>فقط ذخیره در آرشیو سرور (بدون بازیابی)</span>
                    </div>
                    <p className="text-[10px] font-normal text-slate-500 mt-1">
                      اطلاعات فعلی تغییر نمی‌کند و این فایل فقط به لیست بکاپ‌های سرور اضافه می‌شود.
                    </p>
                  </button>
                </div>
              )}

              {/* Restore Scope Selector (Full vs Selective) */}
              {(restoreTarget.mode === 'server_backup' || uploadActionType === 'restore_now') && (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-100 p-2 rounded-xl">
                  <span className="text-xs font-bold text-slate-700 px-1">
                    نحوه بازگردانی اطلاعات:
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setRestoreScope('full');
                        setSelectedModules(ALL_RESTORE_MODULES);
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        restoreScope === 'full'
                          ? 'bg-slate-900 text-white shadow-2xs'
                          : 'bg-white text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      بازیابی کامل (همه بخش‌ها)
                    </button>
                    <button
                      type="button"
                      onClick={() => setRestoreScope('selective')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        restoreScope === 'selective'
                          ? 'bg-indigo-600 text-white shadow-2xs'
                          : 'bg-white text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      بازیابی انتخابی بخش‌ها ({toPersianDigits(selectedModules.length)} از {toPersianDigits(ALL_RESTORE_MODULES.length)})
                    </button>
                  </div>
                </div>
              )}

              {/* Comparison & Module Selection Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="bg-slate-50 px-3.5 py-2 border-b border-slate-200 flex items-center justify-between text-[11px] font-bold text-slate-600">
                  <span>بخش‌های اطلاعاتی</span>
                  <div className="flex items-center gap-4 sm:gap-6">
                    <span>وضعیت فعلی</span>
                    <span>در این بکاپ</span>
                    <span className="w-16 text-left">تغییر</span>
                  </div>
                </div>

                <div className="divide-y divide-slate-100">
                  {restoreComparisonModules.map((mod) => {
                    const isChecked = restoreScope === 'full' || selectedModules.includes(mod.key);
                    const diff = mod.backupCount - mod.currentCount;
                    return (
                      <label
                        key={mod.key}
                        onClick={(e) => {
                          if (restoreScope === 'selective') {
                            e.preventDefault();
                            toggleModuleSelection(mod.key);
                          }
                        }}
                        className={`p-3 flex items-center justify-between gap-3 text-xs transition-colors ${
                          restoreScope === 'selective' ? 'cursor-pointer hover:bg-slate-50' : ''
                        } ${!isChecked ? 'opacity-50 bg-slate-50/50' : 'bg-white'}`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          {restoreScope === 'selective' ? (
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {}}
                              className="w-4 h-4 text-indigo-600 rounded cursor-pointer shrink-0"
                            />
                          ) : (
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          )}
                          <div className="min-w-0">
                            <p className="font-bold text-slate-800 truncate">{mod.title}</p>
                            <p className="text-[10px] text-slate-400 truncate">{mod.description}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-4 sm:gap-6 shrink-0 tabular-nums text-xs">
                          <span className="text-slate-500 font-medium">
                            {toPersianDigits(mod.currentCount)}
                          </span>
                          <span className="font-black text-slate-900">
                            {toPersianDigits(mod.backupCount)}
                          </span>
                          <span className="w-16 text-left">
                            {diff === 0 ? (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 font-bold">
                                برابر
                              </span>
                            ) : diff > 0 ? (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold">
                                +{toPersianDigits(diff)}
                              </span>
                            ) : (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 font-bold">
                                {toPersianDigits(diff)}
                              </span>
                            )}
                          </span>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Automatic Safety Backup Guarantee Notice */}
              <div className="p-3 rounded-xl bg-emerald-50/80 border border-emerald-200 text-[11px] text-emerald-900 flex items-start gap-2 leading-relaxed">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <strong>محافظت دوگانه و بدون ریسک:</strong> پیش از اعمال بازیابی، یک نسخه پشتیبان خودکار اضطراری از وضعیت فعلی سیستم در سرور ثبت می‌شود؛ همچنین تمامی اقلام موجود در نسخه پشتیبان (حتی مواردی که قبلاً حذف شده بودند) به‌طور کامل احیا خواهند شد.
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center gap-2 pt-3 border-t border-slate-100 shrink-0">
              <button
                type="button"
                onClick={handleConfirmAndExecuteRestore}
                disabled={actionLoading || (restoreScope === 'selective' && selectedModules.length === 0)}
                className="flex-1 py-2.5 px-4 bg-amber-600 hover:bg-amber-700 active:scale-98 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer transition-all flex items-center justify-center gap-1.5"
              >
                {actionLoading ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <RotateCcw className="w-4 h-4" />
                )}
                <span>
                  {restoreTarget.mode === 'uploaded_json' && uploadActionType === 'save_only'
                    ? 'ذخیره فایل در آرشیو سرور'
                    : restoreScope === 'selective'
                    ? `تأیید و بازیابی بخش‌های انتخاب‌شده (${toPersianDigits(selectedModules.length)} بخش)`
                    : 'تأیید و اجرای بازیابی کامل'}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setRestoreTarget(null)}
                disabled={actionLoading}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
              >
                انصراف
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 2.5: BACKUP ROW DETAILS & OPERATIONS MODAL                      */}
      {/* ===================================================================== */}
      {selectedBackupModal && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setSelectedBackupModal(null)}
        >
          <div
            className="bg-white rounded-2xl max-w-lg w-full p-5 sm:p-6 shadow-2xl border border-slate-200 space-y-5 animate-in fade-in zoom-in-95"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3.5">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 shrink-0">
                  <Archive className="w-5 h-5 text-emerald-600" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-black text-sm sm:text-base text-slate-900 truncate">
                      {selectedBackupModal.label}
                    </h3>
                    {getTriggerBadge(selectedBackupModal.trigger, true)}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {formatIsoToPersianTime(selectedBackupModal.createdAt)} (
                    {formatCompactPersianDateTime(selectedBackupModal.createdAt).relative})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedBackupModal(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Metadata Box (Filename, Size, SHA-256) */}
            <div className="bg-slate-50 rounded-xl p-3 border border-slate-200/80 space-y-2 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-500 font-medium">نام فایل آرشیو:</span>
                <button
                  type="button"
                  onClick={() =>
                    handleCopyCommand(selectedBackupModal.filename, `modal_fn_${selectedBackupModal.filename}`)
                  }
                  className="flex items-center gap-1.5 font-mono text-[11px] text-slate-700 hover:text-emerald-700 bg-white px-2 py-1 rounded-md border border-slate-200 cursor-pointer truncate max-w-[260px]"
                  dir="ltr"
                  title="کپی نام فایل"
                >
                  {copiedKey === `modal_fn_${selectedBackupModal.filename}` ? (
                    <Check className="w-3 h-3 text-emerald-600 shrink-0" />
                  ) : (
                    <Copy className="w-3 h-3 text-slate-400 shrink-0" />
                  )}
                  <span className="truncate">{selectedBackupModal.filename}</span>
                </button>
              </div>

              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-500 font-medium">حجم فایل پشتیبان:</span>
                <span
                  className="font-mono font-bold text-slate-800 bg-white px-2 py-0.5 rounded-md border border-slate-200"
                  dir="ltr"
                >
                  {formatFileSize(selectedBackupModal.sizeBytes)}
                </span>
              </div>

              {selectedBackupModal.checksum && (
                <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-200/60">
                  <span className="text-slate-500 font-medium flex items-center gap-1">
                    <FileCheck className="w-3.5 h-3.5 text-emerald-600" />
                    امضای دیجیتال SHA-256:
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      handleCopyCommand(
                        selectedBackupModal.checksum,
                        `modal_hash_${selectedBackupModal.filename}`
                      )
                    }
                    className="flex items-center gap-1.5 font-mono text-[10px] text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-2 py-1 rounded-md border border-emerald-200 cursor-pointer"
                    dir="ltr"
                    title="کپی کد یکپارچگی SHA-256"
                  >
                    <span>{selectedBackupModal.checksum.slice(0, 18)}...</span>
                    {copiedKey === `modal_hash_${selectedBackupModal.filename}` ? (
                      <Check className="w-3 h-3 text-emerald-600" />
                    ) : (
                      <Copy className="w-3 h-3 text-emerald-600" />
                    )}
                  </button>
                </div>
              )}
            </div>

            {/* Content Statistics Grid */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-slate-500" />
                <span>آمار رکوردهای ذخیره‌شده در این نسخه:</span>
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center">
                <div className="p-2.5 rounded-xl bg-blue-50/60 border border-blue-200/70">
                  <Boxes className="w-4 h-4 text-blue-600 mx-auto mb-1" />
                  <span className="text-[10px] text-slate-500 block">کالاهای انبار</span>
                  <strong className="font-mono text-sm text-blue-900">
                    {toPersianDigits(selectedBackupModal.stats?.productsCount ?? 0)}
                  </strong>
                </div>

                <div className="p-2.5 rounded-xl bg-emerald-50/60 border border-emerald-200/70">
                  <ReceiptText className="w-4 h-4 text-emerald-600 mx-auto mb-1" />
                  <span className="text-[10px] text-slate-500 block">فاکتور فروش</span>
                  <strong className="font-mono text-sm text-emerald-900">
                    {toPersianDigits(selectedBackupModal.stats?.invoicesCount ?? 0)}
                  </strong>
                </div>

                <div className="p-2.5 rounded-xl bg-indigo-50/60 border border-indigo-200/70">
                  <ShoppingBag className="w-4 h-4 text-indigo-600 mx-auto mb-1" />
                  <span className="text-[10px] text-slate-500 block">خرید و خدمات</span>
                  <strong className="font-mono text-sm text-indigo-900">
                    {toPersianDigits(selectedBackupModal.stats?.purchaseInvoicesCount ?? 0)}
                  </strong>
                </div>

                <div className="p-2.5 rounded-xl bg-amber-50/60 border border-amber-200/70">
                  <HardDrive className="w-4 h-4 text-amber-600 mx-auto mb-1" />
                  <span className="text-[10px] text-slate-500 block">رسید انبار</span>
                  <strong className="font-mono text-sm text-amber-900">
                    {toPersianDigits(selectedBackupModal.stats?.inboundReceiptsCount ?? 0)}
                  </strong>
                </div>

                <div className="p-2.5 rounded-xl bg-purple-50/60 border border-purple-200/70 col-span-2 sm:col-span-1">
                  <Users className="w-4 h-4 text-purple-600 mx-auto mb-1" />
                  <span className="text-[10px] text-slate-500 block">مشتریان</span>
                  <strong className="font-mono text-sm text-purple-900">
                    {toPersianDigits(selectedBackupModal.stats?.customersCount ?? 0)}
                  </strong>
                </div>
              </div>
            </div>

            {/* Operations Section */}
            <div className="space-y-2.5 pt-2 border-t border-slate-100">
              <h4 className="text-xs font-bold text-slate-700">عملیات قابل انجام روی این نسخه:</h4>

              {/* Primary Action: Preview & Restore */}
              <button
                type="button"
                onClick={() => {
                  const target = selectedBackupModal;
                  setSelectedBackupModal(null);
                  handleOpenServerBackupRestore(target);
                }}
                disabled={actionLoading}
                className="w-full py-2.5 px-4 bg-amber-600 hover:bg-amber-700 active:scale-98 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer transition-all flex items-center justify-center gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                <span>پیش‌نمایش مقایسه با وضعیت فعلی و بازیابی هوشمند (کامل / انتخابی)</span>
              </button>

              {/* Secondary Actions Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <a
                  href={`/api/backups/download/${encodeURIComponent(selectedBackupModal.filename)}`}
                  download={selectedBackupModal.filename}
                  className="py-2.5 px-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Download className="w-4 h-4 text-emerald-600" />
                  <span>دانلود فایل JSON</span>
                </a>

                <button
                  type="button"
                  onClick={() => handleSendBackupToTelegram(selectedBackupModal.filename)}
                  disabled={sendingTelegramFile === selectedBackupModal.filename || actionLoading}
                  className="py-2.5 px-3 bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-200 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                >
                  <Send
                    className={`w-4 h-4 text-sky-600 ${
                      sendingTelegramFile === selectedBackupModal.filename ? 'animate-bounce' : ''
                    }`}
                  />
                  <span>
                    {sendingTelegramFile === selectedBackupModal.filename
                      ? 'در حال ارسال...'
                      : 'ارسال به تلگرام'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const target = selectedBackupModal;
                    setSelectedBackupModal(null);
                    setDeleteTarget({ filename: target.filename, label: target.label });
                  }}
                  disabled={actionLoading}
                  className="py-2.5 px-3 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-4 h-4 text-rose-600" />
                  <span>حذف از سرور</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 3: DELETE BACKUP CONFIRMATION MODAL (SINGLE OR BULK)            */}
      {/* ===================================================================== */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-rose-200 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3 text-rose-600 border-b border-slate-100 pb-3">
              <div className="p-2 rounded-xl bg-rose-50 border border-rose-200">
                <Trash2 className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h3 className="font-black text-sm text-slate-900">حذف فایل پشتیبان از سرور</h3>
                <p className="text-[11px] text-slate-500 mt-0.5">{deleteTarget.label}</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              آیا از حذف دائمی فایل پشتیبان <span className="font-mono font-bold text-slate-800">{deleteTarget.filename}</span> از آرشیو سرور اطمینان دارید؟
            </p>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={handleConfirmDeleteBackup}
                disabled={actionLoading}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold cursor-pointer flex items-center justify-center gap-1.5"
              >
                {actionLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                <span>تأیید و حذف فایل</span>
              </button>
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
              >
                انصراف
              </button>
            </div>
          </div>
        </div>
      )}

      {showBulkDeleteModal && selectedBackupFiles.length > 0 && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-rose-200 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3 text-rose-600 border-b border-slate-100 pb-3">
              <div className="p-2 rounded-xl bg-rose-50 border border-rose-200">
                <Trash2 className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h3 className="font-black text-sm text-slate-900">
                  حذف گروهی نسخه‌های پشتیبان ({toPersianDigits(selectedBackupFiles.length)} فایل)
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">پاکسازی آرشیو سرور</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              آیا از حذف دائمی <strong>{toPersianDigits(selectedBackupFiles.length)} نسخه پشتیبان انتخاب‌شده</strong> از آرشیو سرور اطمینان دارید؟
            </p>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={handleConfirmBulkDeleteBackups}
                disabled={actionLoading}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold cursor-pointer flex items-center justify-center gap-1.5"
              >
                {actionLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                <span>تأیید و حذف {toPersianDigits(selectedBackupFiles.length)} نسخه</span>
              </button>
              <button
                type="button"
                onClick={() => setShowBulkDeleteModal(false)}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
              >
                انصراف
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 4: MAINTENANCE & RESET CONFIRMATION MODAL                       */}
      {/* ===================================================================== */}
      {maintenanceAction && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-rose-200 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3 text-rose-600 border-b border-slate-100 pb-3">
              <div className="p-2 rounded-xl bg-rose-50 border border-rose-200">
                <AlertTriangle className="w-6 h-6 text-rose-600" />
              </div>
              <div>
                <h3 className="font-black text-sm text-slate-900">
                  {maintenanceAction === 'clear_invoices'
                    ? 'تأیید پاکسازی فاکتورهای آزمایشی'
                    : maintenanceAction === 'reset_demo'
                    ? 'تأیید بارگذاری داده‌های نمونه (دمو)'
                    : 'تأیید بازنشانی کامل به تنظیمات کارخانه'}
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">عملیات حساس مدیریتی</p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-rose-50/60 border border-rose-200 text-xs text-rose-950 space-y-2 leading-relaxed">
              {maintenanceAction === 'clear_invoices' && (
                <p>
                  تمامی <strong>{toPersianDigits(liveStats.invoicesCount)} فاکتور فروش</strong> ثبت‌شده پاک خواهند شد، اما لیست کالاها، موجودی انبار و مشتریان بدون تغییر حفظ می‌شوند.
                </p>
              )}
              {maintenanceAction === 'reset_demo' && (
                <p>
                  اطلاعات فعلی با داده‌های نمونه اولیه فروشگاه جایگزین خواهد شد.
                </p>
              )}
              {maintenanceAction === 'factory_reset' && (
                <p>
                  کلیه اطلاعات کالاها، مشتریان، فاکتورهای فروش و خرید و گردش انبار پاک شده و تنظیمات به حالت اولیه کارخانه بازمی‌گردد.
                </p>
              )}
              <p className="text-[11px] text-emerald-800 font-bold bg-white p-2 rounded-lg border border-emerald-200">
                🛡️ قبل از اجرای این عملیات، سیستم به‌طور خودکار یک نسخه پشتیبان کامل در آرشیو سرور ثبت می‌کند تا در صورت نیاز بتوانید اطلاعات فعلی را بازگردانی کنید.
              </p>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={handleExecuteMaintenanceAction}
                disabled={actionLoading}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold cursor-pointer flex items-center justify-center gap-1.5"
              >
                {actionLoading ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}
                <span>تأیید و اجرای عملیات</span>
              </button>
              <button
                type="button"
                onClick={() => setMaintenanceAction(null)}
                disabled={actionLoading}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
              >
                انصراف
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 5: SQL SCRIPT IMPORT & RESTORE MODAL                            */}
      {/* ===================================================================== */}
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
                ⚠️ <strong>تراکنش امن:</strong> اجرای این فایل دستورات SQL را در قالب یک تراکنش اتمیک بر روی دیتابیس اعمال می‌کند و در صورت بروز خطا، تغییرات به‌طور کامل لغو (Rollback) می‌گردد.
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
