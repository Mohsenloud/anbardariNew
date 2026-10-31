import React, { useState, useMemo } from 'react';
import {
  ArrowLeftRight,
  Plus,
  Search,
  Printer,
  ArrowDownLeft,
  Wrench,
  User,
  Calendar,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Trash2,
  Package,
  FileDown,
  Eye,
  Edit3,
  Download,
  X,
  Check,
  Archive,
  Phone,
  MapPin,
  FileText
} from 'lucide-react';
import {
  DirectTransfer,
  DirectTransferType,
  DirectTransferStatus,
  Product,
  StoreSettings
} from '../types';
import {
  toPersianDigits,
  toEnglishDigits,
  getCurrentJalaliDate,
  formatPrice
} from '../utils/jalali';
import { exportDirectTransfersToExcel } from '../utils/excelHelper';
import { DirectTransferModal } from './DirectTransferModal';
import { DirectTransferReturnModal } from './DirectTransferReturnModal';
import { DirectTransferPrintModal } from './DirectTransferPrintModal';
import { MiniIranPlate } from './IranPlatePicker';

interface DirectTransfersListProps {
  transfers: DirectTransfer[];
  products: Product[];
  settings: StoreSettings;
  currentUserName?: string;
  onSaveDispatch: (data: Omit<DirectTransfer, 'id' | 'createdAt'>) => void;
  onUpdateTransfer?: (transferId: string, updates: Partial<DirectTransfer>) => void;
  onCompleteWithoutReturn?: (transferId: string, reasonNote?: string) => void;
  onSaveReturn: (transferId: string, returnData: any) => void;
  onDeleteTransfer: (transferId: string, returnStock: boolean) => void;
}

function normalizeJalaliForCompare(dateStr?: string): string {
  if (!dateStr) return '';
  const eng = toEnglishDigits(dateStr).trim().split(' ')[0];
  const parts = eng.split('/');
  if (parts.length !== 3) return '';
  return `${parts[0].padStart(4, '0')}/${parts[1].padStart(2, '0')}/${parts[2].padStart(2, '0')}`;
}

export const DirectTransfersList: React.FC<DirectTransfersListProps> = ({
  transfers,
  products,
  settings,
  currentUserName,
  onSaveDispatch,
  onUpdateTransfer,
  onCompleteWithoutReturn,
  onSaveReturn,
  onDeleteTransfer,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<
    'all' | 'active' | 'overdue' | 'partially_returned' | 'returned' | 'completed_no_return'
  >('all');
  const [typeFilter, setTypeFilter] = useState<'all' | DirectTransferType>('all');

  // Modals state
  const [isDispatchModalOpen, setIsDispatchModalOpen] = useState(false);
  const [editingTransfer, setEditingTransfer] = useState<DirectTransfer | null>(null);
  const [returnModalTransfer, setReturnModalTransfer] = useState<DirectTransfer | null>(null);
  const [detailModalTransfer, setDetailModalTransfer] = useState<DirectTransfer | null>(null);
  const [printModalTransfer, setPrintModalTransfer] = useState<DirectTransfer | null>(null);
  const [autoExportPdf, setAutoExportPdf] = useState(false);
  const [transferToDelete, setTransferToDelete] = useState<DirectTransfer | null>(null);
  const [revertStockOnDelete, setRevertStockOnDelete] = useState(true);
  const [transferToComplete, setTransferToComplete] = useState<DirectTransfer | null>(null);
  const [completeReasonNote, setCompleteReasonNote] = useState('');

  const todayNormalized = useMemo(() => normalizeJalaliForCompare(getCurrentJalaliDate()), []);

  const isTransferOverdue = (t: DirectTransfer): boolean => {
    if (t.status !== 'dispatched' && t.status !== 'partially_returned') return false;
    if (!t.isReturnable || !t.expectedReturnDate) return false;
    const dueNorm = normalizeJalaliForCompare(t.expectedReturnDate);
    if (!dueNorm || !todayNormalized) return false;
    return dueNorm < todayNormalized;
  };

  const isTransferDueToday = (t: DirectTransfer): boolean => {
    if (t.status !== 'dispatched' && t.status !== 'partially_returned') return false;
    if (!t.isReturnable || !t.expectedReturnDate) return false;
    const dueNorm = normalizeJalaliForCompare(t.expectedReturnDate);
    return Boolean(dueNorm && dueNorm === todayNormalized);
  };

  // Filtered list
  const filteredTransfers = useMemo(() => {
    return transfers.filter((t) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        t.transferNumber.toLowerCase().includes(q) ||
        t.title.toLowerCase().includes(q) ||
        t.receiverName.toLowerCase().includes(q) ||
        (t.receiverPhone && t.receiverPhone.includes(q)) ||
        (t.dispatchVehicleInfo && t.dispatchVehicleInfo.toLowerCase().includes(q)) ||
        (t.destination && t.destination.toLowerCase().includes(q)) ||
        t.items.some(
          (i) =>
            i.productName.toLowerCase().includes(q) ||
            (i.productCode && i.productCode.toLowerCase().includes(q)) ||
            (i.serialNumber && i.serialNumber.toLowerCase().includes(q))
        ) ||
        (t.returnRecords &&
          t.returnRecords.some(
            (r) =>
              r.returnerName.toLowerCase().includes(q) ||
              (r.returnVehicleInfo && r.returnVehicleInfo.toLowerCase().includes(q))
          ));

      let matchesStatus = true;
      if (statusFilter === 'active') {
        matchesStatus = t.status === 'dispatched' || t.status === 'partially_returned';
      } else if (statusFilter === 'overdue') {
        matchesStatus = isTransferOverdue(t);
      } else if (statusFilter !== 'all') {
        matchesStatus = t.status === statusFilter;
      }

      const matchesType = typeFilter === 'all' || t.type === typeFilter;

      return matchesSearch && matchesStatus && matchesType;
    });
  }, [transfers, searchQuery, statusFilter, typeFilter, todayNormalized]);

  // Calculate KPI stats
  const stats = useMemo(() => {
    const totalCount = transfers.length;
    const activeList = transfers.filter(
      (t) => t.status === 'dispatched' || t.status === 'partially_returned'
    );
    const activeDispatchedCount = activeList.length;
    const activeUnitsOut = activeList.reduce(
      (sum, t) =>
        sum +
        t.items.reduce((s, i) => s + Math.max(0, i.quantity - (i.returnedQuantity || 0)), 0),
      0
    );
    const overdueCount = transfers.filter((t) => isTransferOverdue(t)).length;
    const fullyReturnedCount = transfers.filter((t) => t.status === 'returned').length;
    const internalUseCount = transfers.filter(
      (t) => t.type === 'internal_use' || t.status === 'completed_no_return'
    ).length;

    return {
      totalCount,
      activeDispatchedCount,
      activeUnitsOut,
      overdueCount,
      fullyReturnedCount,
      internalUseCount,
    };
  }, [transfers, todayNormalized]);

  const getTypeInfo = (type: DirectTransferType) => {
    switch (type) {
      case 'repair':
        return { label: 'تعمیرات و سرویس', textClass: 'text-amber-700' };
      case 'temporary_loan':
        return { label: 'امانی و تست', textClass: 'text-blue-700' };
      case 'internal_use':
        return { label: 'مصرف کارگاه', textClass: 'text-slate-600' };
      case 'sample':
        return { label: 'نمونه و دمو', textClass: 'text-purple-700' };
      default:
        return { label: 'خروج مستقیم', textClass: 'text-slate-600' };
    }
  };

  const getStatusInfo = (status: DirectTransferStatus) => {
    switch (status) {
      case 'dispatched':
        return {
          label: 'بیرون از انبار',
          dotClass: 'bg-amber-500',
          textClass: 'text-amber-800 font-bold',
        };
      case 'partially_returned':
        return {
          label: 'بخشی بازگشته',
          dotClass: 'bg-indigo-500',
          textClass: 'text-indigo-800 font-bold',
        };
      case 'returned':
        return {
          label: 'بازگشته کامل',
          dotClass: 'bg-emerald-500',
          textClass: 'text-emerald-800 font-bold',
        };
      case 'completed_no_return':
        return {
          label: 'مختومه (بدون بازگشت)',
          dotClass: 'bg-slate-400',
          textClass: 'text-slate-600 font-medium',
        };
    }
  };

  const getHealthLabel = (h?: string) => {
    switch (h) {
      case 'repaired':
        return 'تعمیر شده و سالم';
      case 'healthy':
        return 'سالم و بدون نقص';
      case 'unrepaired':
        return 'تعمیر نشده';
      case 'damaged':
        return 'دارای آسیب / نقص';
      case 'scrapped':
        return 'اسقاط شده';
      default:
        return 'سالم';
    }
  };

  // Sync detailModalTransfer if transfers list updates
  const activeDetailTransfer = useMemo(() => {
    if (!detailModalTransfer) return null;
    return transfers.find((t) => t.id === detailModalTransfer.id) || detailModalTransfer;
  }, [transfers, detailModalTransfer]);

  return (
    <div className="space-y-4">
      {/* Interactive KPI Summary Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
        <button
          type="button"
          onClick={() => setStatusFilter('all')}
          className={`p-3.5 rounded-2xl border text-right transition-all cursor-pointer flex items-center gap-3 ${
            statusFilter === 'all'
              ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
              : 'bg-white text-slate-800 border-slate-200 hover:border-slate-300'
          }`}
        >
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
              statusFilter === 'all' ? 'bg-white/15 text-white' : 'bg-slate-100 text-slate-600'
            }`}
          >
            <ArrowLeftRight className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className={`text-[11px] font-medium ${statusFilter === 'all' ? 'text-slate-300' : 'text-slate-500'}`}>
              کل برگه‌ها
            </div>
            <div className="text-base font-black font-mono mt-0.5">
              {toPersianDigits(stats.totalCount)}
            </div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter(statusFilter === 'active' ? 'all' : 'active')}
          className={`p-3.5 rounded-2xl border text-right transition-all cursor-pointer flex items-center gap-3 ${
            statusFilter === 'active'
              ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
              : 'bg-white text-slate-800 border-slate-200 hover:border-amber-300'
          }`}
        >
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
              statusFilter === 'active' ? 'bg-white/20 text-white' : 'bg-amber-50 text-amber-600'
            }`}
          >
            <Clock className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className={`text-[11px] font-bold ${statusFilter === 'active' ? 'text-amber-100' : 'text-slate-600'}`}>
              بیرون انبار (در جریان)
            </div>
            <div className="text-base font-black font-mono mt-0.5 flex items-baseline gap-1.5">
              <span>{toPersianDigits(stats.activeDispatchedCount)}</span>
              <span className={`text-[10px] font-sans font-normal ${statusFilter === 'active' ? 'text-amber-100' : 'text-slate-400'}`}>
                ({toPersianDigits(stats.activeUnitsOut)} قلم)
              </span>
            </div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter(statusFilter === 'overdue' ? 'all' : 'overdue')}
          className={`p-3.5 rounded-2xl border text-right transition-all cursor-pointer flex items-center gap-3 ${
            statusFilter === 'overdue'
              ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
              : stats.overdueCount > 0
              ? 'bg-rose-50/60 text-rose-900 border-rose-200 hover:border-rose-300'
              : 'bg-white text-slate-800 border-slate-200 hover:border-slate-300'
          }`}
        >
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
              statusFilter === 'overdue'
                ? 'bg-white/20 text-white'
                : stats.overdueCount > 0
                ? 'bg-rose-100 text-rose-600'
                : 'bg-slate-100 text-slate-500'
            }`}
          >
            <AlertTriangle className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div
              className={`text-[11px] font-bold ${
                statusFilter === 'overdue'
                  ? 'text-rose-100'
                  : stats.overdueCount > 0
                  ? 'text-rose-700'
                  : 'text-slate-500'
              }`}
            >
              گذشته از موعد
            </div>
            <div className="text-base font-black font-mono mt-0.5">
              {toPersianDigits(stats.overdueCount)}
            </div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter(statusFilter === 'returned' ? 'all' : 'returned')}
          className={`p-3.5 rounded-2xl border text-right transition-all cursor-pointer flex items-center gap-3 ${
            statusFilter === 'returned'
              ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
              : 'bg-white text-slate-800 border-slate-200 hover:border-emerald-300'
          }`}
        >
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
              statusFilter === 'returned'
                ? 'bg-white/20 text-white'
                : 'bg-emerald-50 text-emerald-600'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className={`text-[11px] font-bold ${statusFilter === 'returned' ? 'text-emerald-100' : 'text-slate-600'}`}>
              بازگشته کامل
            </div>
            <div className="text-base font-black font-mono mt-0.5">
              {toPersianDigits(stats.fullyReturnedCount)}
            </div>
          </div>
        </button>

        <button
          type="button"
          onClick={() =>
            setStatusFilter(statusFilter === 'completed_no_return' ? 'all' : 'completed_no_return')
          }
          className={`col-span-2 sm:col-span-1 p-3.5 rounded-2xl border text-right transition-all cursor-pointer flex items-center gap-3 ${
            statusFilter === 'completed_no_return'
              ? 'bg-slate-700 text-white border-slate-700 shadow-xs'
              : 'bg-white text-slate-800 border-slate-200 hover:border-slate-300'
          }`}
        >
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
              statusFilter === 'completed_no_return'
                ? 'bg-white/15 text-white'
                : 'bg-slate-100 text-slate-600'
            }`}
          >
            <Package className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div
              className={`text-[11px] font-medium ${
                statusFilter === 'completed_no_return' ? 'text-slate-200' : 'text-slate-500'
              }`}
            >
              مصرف / مختومه
            </div>
            <div className="text-base font-black font-mono mt-0.5">
              {toPersianDigits(stats.internalUseCount)}
            </div>
          </div>
        </button>
      </div>

      {/* Main Container: Unified Toolbar + Table / Mobile Cards */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
        {/* Toolbar */}
        <div className="p-3 sm:p-4 border-b border-slate-200/80 bg-slate-50/50 space-y-3">
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-2.5">
            {/* Search & Type Filter */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 flex-1">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  placeholder="جستجو در شماره برگه، نام کالا، سریال، گیرنده، پلاک خودرو..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-white border border-slate-200/90 rounded-xl pr-9 pl-8 py-2 text-xs focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 focus:outline-none transition-all"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as any)}
                className="bg-white border border-slate-200/90 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:outline-none focus:border-amber-500 cursor-pointer"
              >
                <option value="all">همه انواع خروج</option>
                <option value="repair">تعمیرات و سرویس</option>
                <option value="temporary_loan">امانی و تست</option>
                <option value="internal_use">مصرف داخلی کارگاه</option>
                <option value="sample">نمونه و دمو</option>
              </select>
            </div>

            {/* Primary Actions */}
            <div className="flex items-center gap-2 shrink-0">
              {transfers.length > 0 && (
                <button
                  type="button"
                  onClick={() => exportDirectTransfersToExcel(filteredTransfers, settings.currency)}
                  className="flex items-center justify-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200/90 rounded-xl text-xs font-bold transition-all cursor-pointer"
                  title="دانلود فایل اکسل لیست امانی و تعمیرات"
                >
                  <Download className="w-3.5 h-3.5 text-emerald-600" />
                  <span>خروجی اکسل</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  setEditingTransfer(null);
                  setIsDispatchModalOpen(true);
                }}
                className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl text-xs shadow-xs transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>ثبت برگه جدید (امانی / تعمیرات)</span>
              </button>
            </div>
          </div>

          {/* Segmented Filter Tabs */}
          <div className="flex items-center gap-1 p-1 bg-slate-200/60 rounded-xl overflow-x-auto no-scrollbar text-xs">
            {[
              { id: 'all', label: `همه (${toPersianDigits(stats.totalCount)})` },
              { id: 'active', label: `بیرون انبار (${toPersianDigits(stats.activeDispatchedCount)})` },
              { id: 'overdue', label: `گذشته از موعد (${toPersianDigits(stats.overdueCount)})` },
              { id: 'partially_returned', label: 'بخشی بازگشته' },
              { id: 'returned', label: `بازگشته کامل (${toPersianDigits(stats.fullyReturnedCount)})` },
              { id: 'completed_no_return', label: 'مختومه / مصرفی' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id as any)}
                className={`px-3 py-1.5 rounded-lg font-bold whitespace-nowrap transition-all cursor-pointer ${
                  statusFilter === tab.id
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Empty State */}
        {filteredTransfers.length === 0 ? (
          <div className="p-12 text-center text-slate-400 space-y-3">
            <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-400 mx-auto flex items-center justify-center">
              <Wrench className="w-7 h-7 stroke-1.5" />
            </div>
            <div className="text-sm font-bold text-slate-700">
              هیچ برگه امانی یا تعمیراتی با این مشخصات یافت نشد
            </div>
            <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
              از این بخش می‌توانید خروج کالاها یا دستگاه‌های کارگاهی را برای تعمیر، سرویس، امانی نزد مشتری یا مصرف داخلی ثبت کرده و بازگشت آن‌ها به انبار را مرحله‌به‌مرحله کنترل نمایید.
            </p>
            <button
              type="button"
              onClick={() => {
                setEditingTransfer(null);
                setIsDispatchModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer mt-1"
            >
              <Plus className="w-4 h-4" />
              <span>ثبت اولین برگه امانی یا تعمیرات</span>
            </button>
          </div>
        ) : (
          <>
            {/* Mobile View: Clean Touch Cards */}
            <div className="block sm:hidden divide-y divide-slate-100">
              {filteredTransfers.map((transfer) => {
                const typeInfo = getTypeInfo(transfer.type);
                const statusInfo = getStatusInfo(transfer.status);
                const isPendingReturn =
                  transfer.status === 'dispatched' || transfer.status === 'partially_returned';
                const overdue = isTransferOverdue(transfer);
                const totalOut = transfer.items.reduce((s, i) => s + i.quantity, 0);
                const totalReturned = transfer.items.reduce(
                  (s, i) => s + (i.returnedQuantity || 0),
                  0
                );

                return (
                  <div
                    key={transfer.id}
                    onClick={() => setDetailModalTransfer(transfer)}
                    className="p-3.5 space-y-2.5 bg-white hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-xs">
                        <span className="font-mono font-black text-slate-900">
                          {toPersianDigits(transfer.transferNumber)}
                        </span>
                        <span aria-hidden="true" className="text-slate-300">·</span>
                        <span className={`font-bold ${typeInfo.textClass}`}>{typeInfo.label}</span>
                      </div>

                      <div className="flex items-center gap-1.5 text-xs">
                        <span className={`w-2 h-2 rounded-full ${statusInfo.dotClass}`} />
                        <span className={statusInfo.textClass}>{statusInfo.label}</span>
                      </div>
                    </div>

                    <div className="font-bold text-slate-900 text-xs">{transfer.title}</div>

                    <div className="flex items-center justify-between text-[11px] text-slate-500">
                      <span>تحویل‌گیرنده: <strong className="text-slate-800">{transfer.receiverName}</strong></span>
                      <span className="font-mono">
                        برگشتی: {toPersianDigits(totalReturned)} از {toPersianDigits(totalOut)}
                      </span>
                    </div>

                    {overdue && (
                      <div className="text-[11px] text-rose-600 font-bold flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>تاخیر در بازگشت (موعد: {toPersianDigits(transfer.expectedReturnDate || '')})</span>
                      </div>
                    )}

                    <div
                      className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center gap-1.5">
                        {isPendingReturn && transfer.isReturnable && (
                          <button
                            type="button"
                            onClick={() => setReturnModalTransfer(transfer)}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                          >
                            <ArrowDownLeft className="w-3.5 h-3.5" />
                            <span>ثبت بازگشت</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setDetailModalTransfer(transfer)}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>جزئیات</span>
                        </button>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingTransfer(transfer);
                            setIsDispatchModalOpen(true);
                          }}
                          className="p-1.5 text-slate-500 hover:text-amber-700 hover:bg-amber-50 rounded-lg cursor-pointer"
                          title="ویرایش"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setAutoExportPdf(false);
                            setPrintModalTransfer(transfer);
                          }}
                          className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg cursor-pointer"
                          title="چاپ و PDF"
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setTransferToDelete(transfer)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                          title="حذف"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop View: Scannable Table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-right text-xs border-collapse">
                <thead className="bg-slate-100/80 text-slate-700 border-b border-slate-200 font-bold">
                  <tr>
                    <th className="p-3">شماره و موضوع برگه</th>
                    <th className="p-3">اقلام و تجهیزات</th>
                    <th className="p-3">تحویل‌گیرنده و خودروی خروج</th>
                    <th className="p-3">پیشرفت بازگشت به انبار</th>
                    <th className="p-3 text-center">وضعیت و موعد</th>
                    <th className="p-3 text-center w-48">عملیات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredTransfers.map((transfer) => {
                    const typeInfo = getTypeInfo(transfer.type);
                    const statusInfo = getStatusInfo(transfer.status);
                    const isPendingReturn =
                      transfer.status === 'dispatched' || transfer.status === 'partially_returned';
                    const overdue = isTransferOverdue(transfer);
                    const dueToday = isTransferDueToday(transfer);

                    const totalOut = transfer.items.reduce((s, i) => s + i.quantity, 0);
                    const totalReturned = transfer.items.reduce(
                      (s, i) => s + (i.returnedQuantity || 0),
                      0
                    );
                    const returnPercent =
                      totalOut > 0 ? Math.min(100, Math.round((totalReturned / totalOut) * 100)) : 0;

                    const latestReturn =
                      transfer.returnRecords && transfer.returnRecords.length > 0
                        ? transfer.returnRecords[transfer.returnRecords.length - 1]
                        : null;

                    return (
                      <tr
                        key={transfer.id}
                        onClick={() => setDetailModalTransfer(transfer)}
                        className="hover:bg-slate-50/90 transition-colors cursor-pointer group"
                      >
                        {/* 1. Number, Type & Title */}
                        <td className="p-3 align-top">
                          <div className="flex items-center gap-1.5 text-xs">
                            <span className="font-mono font-black text-slate-900">
                              {toPersianDigits(transfer.transferNumber)}
                            </span>
                            <span aria-hidden="true" className="text-slate-300">·</span>
                            <span className={`font-bold ${typeInfo.textClass}`}>
                              {typeInfo.label}
                            </span>
                          </div>
                          <div className="font-bold text-slate-900 mt-1">{transfer.title}</div>
                          <div className="text-[11px] text-slate-400 mt-0.5 font-mono">
                            خروج: {toPersianDigits(transfer.dispatchedAt)}
                          </div>
                        </td>

                        {/* 2. Items */}
                        <td className="p-3 align-top">
                          <div className="space-y-1 max-w-xs">
                            {transfer.items.slice(0, 2).map((item) => {
                              const isItemReturned = (item.returnedQuantity || 0) >= item.quantity;
                              return (
                                <div key={item.id} className="text-xs">
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="font-bold text-slate-800 truncate">
                                      {item.productName}
                                    </span>
                                    <span
                                      className={`font-mono font-bold shrink-0 ${
                                        isItemReturned ? 'text-emerald-700' : 'text-slate-700'
                                      }`}
                                    >
                                      {toPersianDigits(item.quantity)} {item.unit}
                                    </span>
                                  </div>
                                  {(item.serialNumber || item.notes) && (
                                    <div className="text-[10px] text-slate-500 flex items-center gap-1.5 truncate">
                                      {item.serialNumber && (
                                        <span className="font-mono text-amber-700">
                                          سریال: {item.serialNumber}
                                        </span>
                                      )}
                                      {item.serialNumber && item.notes && (
                                        <span aria-hidden="true">·</span>
                                      )}
                                      {item.notes && <span className="truncate">{item.notes}</span>}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                            {transfer.items.length > 2 && (
                              <div className="text-[10px] text-slate-400 font-medium">
                                + {toPersianDigits(transfer.items.length - 2)} قلم دیگر
                              </div>
                            )}
                          </div>
                        </td>

                        {/* 3. Receiver & Vehicle */}
                        <td className="p-3 align-top">
                          <div className="space-y-1">
                            <div className="font-bold text-slate-900 flex items-center gap-1.5">
                              <span>{transfer.receiverName}</span>
                              {transfer.receiverPhone && (
                                <span className="text-[11px] text-slate-400 font-mono font-normal">
                                  ({toPersianDigits(transfer.receiverPhone)})
                                </span>
                              )}
                            </div>
                            {transfer.dispatchVehicleInfo && (
                              <div className="pt-0.5">
                                <MiniIranPlate plateInfo={transfer.dispatchVehicleInfo} />
                              </div>
                            )}
                            {transfer.destination && (
                              <div className="text-[11px] text-slate-500 truncate max-w-[200px]">
                                مقصد: {transfer.destination}
                              </div>
                            )}
                          </div>
                        </td>

                        {/* 4. Return Progress & Latest Return */}
                        <td className="p-3 align-top">
                          {transfer.isReturnable ? (
                            <div className="space-y-1.5 min-w-[150px]">
                              <div className="flex items-center justify-between text-[11px]">
                                <span className="text-slate-600 font-medium">
                                  بازگشته: <strong className="font-mono text-slate-900">{toPersianDigits(totalReturned)}</strong> از{' '}
                                  <strong className="font-mono text-slate-900">{toPersianDigits(totalOut)}</strong>
                                </span>
                                <span className="font-mono font-bold text-slate-700">
                                  {toPersianDigits(returnPercent)}٪
                                </span>
                              </div>
                              <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                <div
                                  className={`h-full transition-all ${
                                    returnPercent >= 100
                                      ? 'bg-emerald-500'
                                      : returnPercent > 0
                                      ? 'bg-indigo-500'
                                      : 'bg-amber-400'
                                  }`}
                                  style={{ width: `${Math.max(returnPercent, 6)}%` }}
                                />
                              </div>
                              {latestReturn ? (
                                <div className="text-[10px] text-slate-500">
                                  آخرین ورود: <span className="text-slate-700 font-bold">{latestReturn.returnerName}</span>{' '}
                                  <span className="font-mono">({toPersianDigits(latestReturn.returnedAt.split(' - ')[0])})</span>
                                </div>
                              ) : (
                                <div className="text-[10px] text-slate-400">
                                  هنوز موردی بازنگشته است
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="text-[11px] text-slate-400">
                              بدون نیاز به بازگشت
                            </div>
                          )}
                        </td>

                        {/* 5. Status & Due Date */}
                        <td className="p-3 align-top text-center">
                          <div className="inline-flex items-center gap-1.5 text-xs">
                            <span className={`w-2 h-2 rounded-full ${statusInfo.dotClass}`} />
                            <span className={statusInfo.textClass}>{statusInfo.label}</span>
                          </div>

                          {transfer.expectedReturnDate && isPendingReturn && (
                            <div
                              className={`text-[11px] font-mono mt-1 ${
                                overdue
                                  ? 'text-rose-600 font-black'
                                  : dueToday
                                  ? 'text-amber-600 font-bold'
                                  : 'text-slate-500'
                              }`}
                            >
                              {overdue ? 'گذشته از موعد: ' : dueToday ? 'موعد امروز: ' : 'موعد: '}
                              {toPersianDigits(transfer.expectedReturnDate)}
                            </div>
                          )}
                        </td>

                        {/* 6. Compact Actions */}
                        <td
                          className="p-3 align-top text-center"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex flex-col gap-1.5 items-stretch">
                            {isPendingReturn && transfer.isReturnable && (
                              <button
                                type="button"
                                onClick={() => setReturnModalTransfer(transfer)}
                                className="flex items-center justify-center gap-1 px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-[11px] shadow-2xs transition-all cursor-pointer"
                              >
                                <ArrowDownLeft className="w-3.5 h-3.5" />
                                <span>ثبت ورود به انبار</span>
                              </button>
                            )}

                            <div className="flex items-center justify-center gap-1">
                              <button
                                type="button"
                                onClick={() => setDetailModalTransfer(transfer)}
                                className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold text-[11px] transition-colors cursor-pointer"
                                title="مشاهده جزئیات کامل و تاریخچه بازگشت"
                              >
                                <Eye className="w-3.5 h-3.5 text-slate-600" />
                                <span>جزئیات</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setEditingTransfer(transfer);
                                  setIsDispatchModalOpen(true);
                                }}
                                className="p-1.5 text-slate-500 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"
                                title="ویرایش برگه"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setAutoExportPdf(false);
                                  setPrintModalTransfer(transfer);
                                }}
                                className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                                title="پیش‌نمایش چاپ و PDF"
                              >
                                <Printer className="w-3.5 h-3.5" />
                              </button>

                              <button
                                type="button"
                                onClick={() => setTransferToDelete(transfer)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                title="حذف برگه"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* DETAILS & RETURN HISTORY TIMELINE MODAL */}
      {activeDetailTransfer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/70 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden my-auto">
            {/* Header */}
            <div className="bg-slate-900 text-white px-4 sm:px-6 py-4 flex items-center justify-between border-b border-slate-800 shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30 shrink-0">
                  <FileText className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-xs text-slate-300 font-mono">
                    <span>حواله {toPersianDigits(activeDetailTransfer.transferNumber)}</span>
                    <span aria-hidden="true">·</span>
                    <span>{getTypeInfo(activeDetailTransfer.type).label}</span>
                  </div>
                  <h3 className="text-sm sm:text-base font-black truncate mt-0.5">
                    {activeDetailTransfer.title}
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDetailModalTransfer(null)}
                className="text-slate-400 hover:text-white p-1.5 rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 text-xs text-slate-800">
              {/* Dispatch Info Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200/90">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-slate-400 shrink-0" />
                    <span className="text-slate-500">تحویل‌گیرنده / تعمیرگاه:</span>
                    <strong className="text-slate-900">{activeDetailTransfer.receiverName}</strong>
                  </div>
                  {activeDetailTransfer.receiverPhone && (
                    <div className="flex items-center gap-2">
                      <Phone className="w-4 h-4 text-slate-400 shrink-0" />
                      <span className="text-slate-500">شماره تماس:</span>
                      <span className="font-mono font-bold">
                        {toPersianDigits(activeDetailTransfer.receiverPhone)}
                      </span>
                    </div>
                  )}
                  {activeDetailTransfer.destination && (
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
                      <span className="text-slate-500">مقصد:</span>
                      <span className="font-medium">{activeDetailTransfer.destination}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500">انباردار صادرکننده:</span>
                    <span className="font-medium">{activeDetailTransfer.dispatchedBy}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
                    <span className="text-slate-500">زمان خروج:</span>
                    <span className="font-mono font-bold">
                      {toPersianDigits(activeDetailTransfer.dispatchedAt)}
                    </span>
                  </div>
                  {activeDetailTransfer.expectedReturnDate && (
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-amber-500 shrink-0" />
                      <span className="text-slate-500">موعد بازگشت:</span>
                      <span className="font-mono font-bold text-amber-800">
                        {toPersianDigits(activeDetailTransfer.expectedReturnDate)}
                      </span>
                    </div>
                  )}
                  {activeDetailTransfer.estimatedCost && activeDetailTransfer.estimatedCost > 0 ? (
                    <div className="flex items-center gap-2">
                      <span className="text-slate-500">برآورد هزینه / ودیعه:</span>
                      <span className="font-mono font-bold text-slate-900">
                        {formatPrice(activeDetailTransfer.estimatedCost, settings.currency)}
                      </span>
                    </div>
                  ) : null}
                  {activeDetailTransfer.dispatchVehicleInfo && (
                    <div className="pt-1">
                      <MiniIranPlate plateInfo={activeDetailTransfer.dispatchVehicleInfo} />
                    </div>
                  )}
                </div>

                {activeDetailTransfer.dispatchNotes && (
                  <div className="sm:col-span-2 pt-2 border-t border-slate-200/80 text-slate-600">
                    <span className="font-bold text-slate-700">توضیحات خروج: </span>
                    {activeDetailTransfer.dispatchNotes}
                  </div>
                )}
              </div>

              {/* Items Table */}
              <div className="space-y-2">
                <h4 className="font-black text-slate-800 text-xs sm:text-sm">
                  اقلام و دستگاه‌های مندرج در برگه ({toPersianDigits(activeDetailTransfer.items.length)} ردیف)
                </h4>
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-100 text-slate-700 border-b border-slate-200 font-bold">
                      <tr>
                        <th className="p-2.5">#</th>
                        <th className="p-2.5">نام کالا / دستگاه</th>
                        <th className="p-2.5">سریال / پلاک فنی</th>
                        <th className="p-2.5 text-center">تعداد خروج</th>
                        <th className="p-2.5 text-center">بازگشته</th>
                        <th className="p-2.5 text-center">مانده</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {activeDetailTransfer.items.map((item, idx) => {
                        const rem = Math.max(0, item.quantity - (item.returnedQuantity || 0));
                        return (
                          <tr key={item.id}>
                            <td className="p-2.5 font-mono text-slate-400">
                              {toPersianDigits(idx + 1)}
                            </td>
                            <td className="p-2.5">
                              <div className="font-bold text-slate-900">{item.productName}</div>
                              {item.notes && (
                                <div className="text-[10px] text-slate-500 mt-0.5">
                                  شرح: {item.notes}
                                </div>
                              )}
                            </td>
                            <td className="p-2.5 font-mono text-slate-700">
                              {item.serialNumber || '—'}
                            </td>
                            <td className="p-2.5 text-center font-mono font-bold">
                              {toPersianDigits(item.quantity)} {item.unit}
                            </td>
                            <td className="p-2.5 text-center font-mono text-emerald-700 font-bold">
                              {toPersianDigits(item.returnedQuantity || 0)} {item.unit}
                            </td>
                            <td className="p-2.5 text-center font-mono font-bold text-amber-700">
                              {toPersianDigits(rem)} {item.unit}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Return Records Timeline */}
              <div className="space-y-2.5">
                <h4 className="font-black text-slate-800 text-xs sm:text-sm">
                  سوابق بازگشت و ورود به انبار (
                  {toPersianDigits((activeDetailTransfer.returnRecords || []).length)} نوبت)
                </h4>

                {!activeDetailTransfer.returnRecords ||
                activeDetailTransfer.returnRecords.length === 0 ? (
                  <div className="p-4 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-center text-slate-400">
                    هنوز هیچ سابقه بازگشتی برای این برگه ثبت نشده است.
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {activeDetailTransfer.returnRecords.map((rec, rIdx) => (
                      <div
                        key={rec.id || rIdx}
                        className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/40 space-y-2"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-emerald-200/60 pb-2">
                          <div className="flex items-center gap-2 font-bold text-emerald-950">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                            <span>نوبت {toPersianDigits(rIdx + 1)} — آورنده: {rec.returnerName}</span>
                            {rec.returnerPhone && (
                              <span className="font-mono text-slate-500 font-normal">
                                ({toPersianDigits(rec.returnerPhone)})
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] font-mono text-slate-600">
                            {toPersianDigits(rec.returnedAt)} · وضعیت: {getHealthLabel(rec.healthStatus)}
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-700">
                          <div>
                            اقلام تحویلی:{' '}
                            <strong>
                              {rec.itemsReturned
                                .map((ir) => `${ir.productName} (${toPersianDigits(ir.quantity)})`)
                                .join('، ')}
                            </strong>
                          </div>
                          {rec.repairCost && rec.repairCost > 0 ? (
                            <div className="font-mono font-bold text-slate-900">
                              هزینه تعمیر: {formatPrice(rec.repairCost, settings.currency)}
                            </div>
                          ) : null}
                        </div>

                        {rec.returnVehicleInfo && (
                          <div className="pt-0.5">
                            <MiniIranPlate plateInfo={rec.returnVehicleInfo} />
                          </div>
                        )}

                        {rec.notes && (
                          <div className="text-[11px] text-slate-600">
                            گزارش فنی: {rec.notes}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Footer Actions */}
            <div className="bg-slate-50 border-t border-slate-200 px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-2 flex-wrap">
                {(activeDetailTransfer.status === 'dispatched' ||
                  activeDetailTransfer.status === 'partially_returned') &&
                  activeDetailTransfer.isReturnable && (
                    <button
                      type="button"
                      onClick={() => {
                        setReturnModalTransfer(activeDetailTransfer);
                      }}
                      className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer"
                    >
                      <ArrowDownLeft className="w-4 h-4" />
                      <span>ثبت ورود / بازگشت به انبار</span>
                    </button>
                  )}

                {(activeDetailTransfer.status === 'dispatched' ||
                  activeDetailTransfer.status === 'partially_returned') &&
                  onCompleteWithoutReturn && (
                    <button
                      type="button"
                      onClick={() => {
                        setCompleteReasonNote('');
                        setTransferToComplete(activeDetailTransfer);
                      }}
                      className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold cursor-pointer"
                    >
                      <Archive className="w-3.5 h-3.5 text-slate-500" />
                      <span>مختومه‌سازی (بدون بازگشت)</span>
                    </button>
                  )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setEditingTransfer(activeDetailTransfer);
                    setDetailModalTransfer(null);
                    setIsDispatchModalOpen(true);
                  }}
                  className="flex items-center gap-1 px-3 py-2 bg-white hover:bg-amber-50 text-slate-700 hover:text-amber-800 border border-slate-300 rounded-xl text-xs font-bold cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>ویرایش</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setAutoExportPdf(false);
                    setPrintModalTransfer(activeDetailTransfer);
                  }}
                  className="flex items-center gap-1 px-3 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>چاپ و PDF</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Complete Without Return Confirmation Modal */}
      {transferToComplete && onCompleteWithoutReturn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl p-5 max-w-md w-full shadow-xl border border-slate-200 text-slate-800 space-y-4">
            <div className="flex items-center gap-3 text-slate-800">
              <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                <Archive className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-sm">مختومه‌سازی برگه بدون بازگشت به انبار</h4>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  شماره برگه: {toPersianDigits(transferToComplete.transferNumber)}
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              در صورتی که کالای امانی به فروش قطعی تبدیل شده، در پروژه مصرف شده یا دستگاه غیرقابل تعمیر/اسقاط است، می‌توانید این پرونده را مختومه نمایید.
            </p>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                علت مختومه‌سازی (اختیاری):
              </label>
              <input
                type="text"
                placeholder="مثلاً: تبدیل به فاکتور فروش یا اسقاط قطعه در تعمیرگاه"
                value={completeReasonNote}
                onChange={(e) => setCompleteReasonNote(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs focus:bg-white focus:border-amber-500 focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setTransferToComplete(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 text-xs font-bold cursor-pointer"
              >
                انصراف
              </button>
              <button
                type="button"
                onClick={() => {
                  onCompleteWithoutReturn(transferToComplete.id, completeReasonNote);
                  setTransferToComplete(null);
                  setDetailModalTransfer(null);
                }}
                className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-xs cursor-pointer"
              >
                تایید و مختومه‌سازی
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dispatch / Edit Modal */}
      {isDispatchModalOpen && (
        <DirectTransferModal
          isOpen={isDispatchModalOpen}
          onClose={() => {
            setIsDispatchModalOpen(false);
            setEditingTransfer(null);
          }}
          products={products}
          settings={settings}
          defaultWarehouseName={settings.originWarehouseName}
          defaultWarehouseId={settings.defaultWarehouseId}
          currentUserName={currentUserName}
          editingTransfer={editingTransfer}
          onSave={onSaveDispatch}
          onUpdate={onUpdateTransfer}
        />
      )}

      {/* Return Modal */}
      {returnModalTransfer && (
        <DirectTransferReturnModal
          isOpen={!!returnModalTransfer}
          onClose={() => setReturnModalTransfer(null)}
          transfer={returnModalTransfer}
          settings={settings}
          currentUserName={currentUserName}
          onSaveReturn={onSaveReturn}
        />
      )}

      {/* Print & PDF Modal */}
      {printModalTransfer && (
        <DirectTransferPrintModal
          isOpen={!!printModalTransfer}
          onClose={() => {
            setPrintModalTransfer(null);
            setAutoExportPdf(false);
          }}
          transfer={printModalTransfer}
          settings={settings}
          autoExportPdf={autoExportPdf}
        />
      )}

      {/* Delete Confirmation Modal */}
      {transferToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl p-5 max-w-md w-full shadow-xl border border-slate-200 text-slate-800 space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <h4 className="font-bold text-base">حذف برگه امانی / تعمیرات</h4>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              آیا از حذف برگه شماره{' '}
              <strong className="text-slate-900 font-mono">
                {toPersianDigits(transferToDelete.transferNumber)}
              </strong>{' '}
              با عنوان «{transferToDelete.title}» اطمینان دارید؟
            </p>

            {(transferToDelete.status === 'dispatched' ||
              transferToDelete.status === 'partially_returned') &&
              transferToDelete.items.some((i) => !i.isCustomAsset) && (
                <label className="flex items-center gap-2 text-xs bg-slate-50 p-3 rounded-xl border border-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={revertStockOnDelete}
                    onChange={(e) => setRevertStockOnDelete(e.target.checked)}
                    className="w-4 h-4 text-amber-600 rounded focus:ring-amber-500"
                  />
                  <span className="font-bold text-slate-700">
                    موجودی کالاهای بازنگشته مجدداً به انبار اضافه شود
                  </span>
                </label>
              )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setTransferToDelete(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 text-xs font-bold cursor-pointer"
              >
                انصراف
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteTransfer(transferToDelete.id, revertStockOnDelete);
                  setTransferToDelete(null);
                  if (detailModalTransfer?.id === transferToDelete.id) {
                    setDetailModalTransfer(null);
                  }
                }}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-xs cursor-pointer"
              >
                تایید و حذف
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
