import React, { useState } from 'react';
import { 
  ArrowLeftRight, 
  Plus, 
  Search, 
  Filter, 
  Printer, 
  ArrowDownLeft, 
  ArrowUpRight, 
  Wrench, 
  Car, 
  User, 
  Calendar, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  Trash2,
  Share2,
  Package,
  Layers,
  ChevronDown
} from 'lucide-react';
import { DirectTransfer, DirectTransferType, DirectTransferStatus, Product, StoreSettings } from '../types';
import { DirectTransferModal } from './DirectTransferModal';
import { DirectTransferReturnModal } from './DirectTransferReturnModal';
import { DirectTransferPrintModal } from './DirectTransferPrintModal';

interface DirectTransfersListProps {
  transfers: DirectTransfer[];
  products: Product[];
  settings: StoreSettings;
  currentUserName?: string;
  onSaveDispatch: (data: Omit<DirectTransfer, 'id' | 'createdAt'>) => void;
  onSaveReturn: (transferId: string, returnData: any) => void;
  onDeleteTransfer: (transferId: string, returnStock: boolean) => void;
}

export const DirectTransfersList: React.FC<DirectTransfersListProps> = ({
  transfers,
  products,
  settings,
  currentUserName,
  onSaveDispatch,
  onSaveReturn,
  onDeleteTransfer,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'dispatched' | 'partially_returned' | 'returned' | 'completed_no_return'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | DirectTransferType>('all');

  // Modals state
  const [isDispatchModalOpen, setIsDispatchModalOpen] = useState(false);
  const [returnModalTransfer, setReturnModalTransfer] = useState<DirectTransfer | null>(null);
  const [printModalTransfer, setPrintModalTransfer] = useState<DirectTransfer | null>(null);
  const [transferToDelete, setTransferToDelete] = useState<DirectTransfer | null>(null);
  const [revertStockOnDelete, setRevertStockOnDelete] = useState(true);

  // Filter transfers
  const filteredTransfers = transfers.filter((t) => {
    const matchesSearch = 
      t.transferNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.receiverName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.dispatchVehicleInfo && t.dispatchVehicleInfo.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (t.destination && t.destination.toLowerCase().includes(searchQuery.toLowerCase())) ||
      t.items.some((i) => 
        i.productName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (i.serialNumber && i.serialNumber.toLowerCase().includes(searchQuery.toLowerCase()))
      ) ||
      (t.returnRecords && t.returnRecords.some((r) => 
        r.returnerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (r.returnVehicleInfo && r.returnVehicleInfo.toLowerCase().includes(searchQuery.toLowerCase()))
      ));

    const matchesStatus = statusFilter === 'all' || t.status === statusFilter;
    const matchesType = typeFilter === 'all' || t.type === typeFilter;

    return matchesSearch && matchesStatus && matchesType;
  });

  // Calculate stats
  const totalCount = transfers.length;
  const activeDispatchedCount = transfers.filter((t) => t.status === 'dispatched' || t.status === 'partially_returned').length;
  const fullyReturnedCount = transfers.filter((t) => t.status === 'returned').length;
  const internalUseCount = transfers.filter((t) => t.type === 'internal_use' || t.status === 'completed_no_return').length;

  const getTypeBadge = (type: DirectTransferType) => {
    switch (type) {
      case 'repair':
        return { label: 'تعمیرات و سرویس', color: 'bg-amber-100 text-amber-800 border-amber-200' };
      case 'temporary_loan':
        return { label: 'امانی و تست', color: 'bg-blue-100 text-blue-800 border-blue-200' };
      case 'internal_use':
        return { label: 'مصرف کارگاه', color: 'bg-slate-100 text-slate-700 border-slate-200' };
      case 'sample':
        return { label: 'نمونه آزمایشگاهی', color: 'bg-purple-100 text-purple-800 border-purple-200' };
      default:
        return { label: 'خروج مستقیم', color: 'bg-slate-100 text-slate-700 border-slate-200' };
    }
  };

  const getStatusBadge = (status: DirectTransferStatus) => {
    switch (status) {
      case 'dispatched':
        return { label: 'دست تعمیرکار / امانت', color: 'bg-amber-50 text-amber-700 border-amber-300 font-bold' };
      case 'partially_returned':
        return { label: 'بخشی بازگشته', color: 'bg-indigo-50 text-indigo-700 border-indigo-300 font-bold' };
      case 'returned':
        return { label: 'کامل بازگشته به انبار', color: 'bg-emerald-50 text-emerald-700 border-emerald-300 font-bold' };
      case 'completed_no_return':
        return { label: 'مختومه (بدون بازگشت)', color: 'bg-slate-50 text-slate-600 border-slate-200 font-medium' };
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Banner & Quick Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0">
            <ArrowLeftRight className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-slate-500 font-medium">کل حواله‌ها</div>
            <div className="text-lg font-bold text-slate-800 mt-0.5 font-mono">{totalCount}</div>
          </div>
        </div>

        <div className="bg-amber-50/70 p-3.5 rounded-2xl border border-amber-200 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-600 text-white flex items-center justify-center shrink-0 shadow-sm">
            <Clock className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="text-xs text-amber-900 font-bold">بیرون انبار (تعمیر / امانی)</div>
            <div className="text-lg font-black text-amber-800 mt-0.5 font-mono">
              {activeDispatchedCount} <span className="text-xs font-normal font-sans">دستگاه / حواله</span>
            </div>
          </div>
        </div>

        <div className="bg-emerald-50/70 p-3.5 rounded-2xl border border-emerald-200 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-emerald-900 font-bold">بازگشته کامل به انبار</div>
            <div className="text-lg font-black text-emerald-800 mt-0.5 font-mono">{fullyReturnedCount}</div>
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
            <Package className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-slate-500 font-medium">مصرف کارگاه / مختومه</div>
            <div className="text-lg font-bold text-slate-800 mt-0.5 font-mono">{internalUseCount}</div>
          </div>
        </div>
      </div>

      {/* Action Bar & Filters */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setIsDispatchModalOpen(true)}
              className="flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white font-bold rounded-xl text-xs sm:text-sm shadow-md hover:shadow-lg transition-all w-full sm:w-auto"
            >
              <Plus className="w-4 h-4" />
              <span>ثبت خروج جدید بدون فاکتور (تعمیرات / امانی)</span>
            </button>
          </div>

          {/* Search Box */}
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
            <input
              type="text"
              placeholder="جستجو در شماره حواله، دستگاه، راننده، ماشین..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-9 pl-3 py-2 text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none focus:bg-white transition-all"
            />
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 text-xs">
          <span className="text-slate-500 font-medium flex items-center gap-1">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <span>وضعیت:</span>
          </span>

          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1 rounded-lg transition-all ${
              statusFilter === 'all'
                ? 'bg-slate-800 text-white font-bold'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            همه
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('dispatched')}
            className={`px-3 py-1 rounded-lg transition-all ${
              statusFilter === 'dispatched'
                ? 'bg-amber-600 text-white font-bold'
                : 'bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200'
            }`}
          >
            بیرون انبار (در جریان)
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('partially_returned')}
            className={`px-3 py-1 rounded-lg transition-all ${
              statusFilter === 'partially_returned'
                ? 'bg-indigo-600 text-white font-bold'
                : 'bg-indigo-50 text-indigo-800 hover:bg-indigo-100 border border-indigo-200'
            }`}
          >
            بخشی بازگشته
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('returned')}
            className={`px-3 py-1 rounded-lg transition-all ${
              statusFilter === 'returned'
                ? 'bg-emerald-600 text-white font-bold'
                : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200'
            }`}
          >
            کامل بازگشته به انبار
          </button>

          <div className="mr-auto flex items-center gap-1.5">
            <span className="text-slate-500">نوع:</span>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as any)}
              className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500"
            >
              <option value="all">همه انواع</option>
              <option value="repair">تعمیرات و سرویس</option>
              <option value="temporary_loan">امانی و تست</option>
              <option value="internal_use">مصرف کارگاه</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Table List */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {filteredTransfers.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-100/80 text-slate-700 border-b border-slate-200 font-bold">
                <tr>
                  <th className="p-3">شماره و عنوان برگه</th>
                  <th className="p-3">اقلام و دستگاه‌های خروجی</th>
                  <th className="p-3">مشخصات خروج (چه کسی با چه ماشینی برده)</th>
                  <th className="p-3">مشخصات ورود (چه کسی با چه ماشینی آورده)</th>
                  <th className="p-3 text-center">وضعیت</th>
                  <th className="p-3 text-center">عملیات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredTransfers.map((transfer) => {
                  const typeBadge = getTypeBadge(transfer.type);
                  const statusBadge = getStatusBadge(transfer.status);
                  const isPendingReturn = transfer.status === 'dispatched' || transfer.status === 'partially_returned';
                  const latestReturn = transfer.returnRecords && transfer.returnRecords.length > 0 
                    ? transfer.returnRecords[transfer.returnRecords.length - 1] 
                    : null;

                  return (
                    <tr key={transfer.id} className="hover:bg-amber-50/30 transition-colors">
                      {/* 1. Number & Title */}
                      <td className="p-3 align-top">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                            {transfer.transferNumber}
                          </span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${typeBadge.color}`}>
                            {typeBadge.label}
                          </span>
                        </div>
                        <div className="font-bold text-slate-900 mt-1">{transfer.title}</div>
                        <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          <span>خروج: {transfer.dispatchedAt}</span>
                        </div>
                      </td>

                      {/* 2. Items & Devices */}
                      <td className="p-3 align-top">
                        <div className="space-y-1">
                          {transfer.items.map((item) => {
                            const isReturned = (item.returnedQuantity || 0) >= item.quantity;
                            return (
                              <div key={item.id} className="bg-slate-50 p-1.5 rounded-lg border border-slate-200/80">
                                <div className="flex items-center justify-between font-bold text-slate-800">
                                  <span>{item.productName}</span>
                                  <span className={isReturned ? "text-emerald-700 font-mono" : "text-amber-800 font-mono"}>
                                    {item.quantity} {item.unit}
                                    {item.returnedQuantity > 0 && (
                                      <span className="text-[10px] text-emerald-600 mr-1">
                                        (برگشته: {item.returnedQuantity})
                                      </span>
                                    )}
                                  </span>
                                </div>
                                {item.serialNumber && (
                                  <div className="text-[10px] text-amber-700 font-mono mt-0.5">
                                    سریال: {item.serialNumber}
                                  </div>
                                )}
                                {item.notes && (
                                  <div className="text-[10px] text-slate-500 mt-0.5">
                                    عیب/شرح: {item.notes}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </td>

                      {/* 3. Dispatch Vehicle & Receiver */}
                      <td className="p-3 align-top text-xs">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1 text-slate-800">
                            <User className="w-3.5 h-3.5 text-slate-400" />
                            <span className="font-bold">{transfer.receiverName}</span>
                            {transfer.receiverPhone && (
                              <span className="text-[11px] text-slate-500 font-mono">({transfer.receiverPhone})</span>
                            )}
                          </div>
                          {transfer.dispatchVehicleInfo && (
                            <div className="flex items-center gap-1 text-amber-900 bg-amber-50/70 px-2 py-0.5 rounded border border-amber-200">
                              <Car className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                              <span className="font-medium">{transfer.dispatchVehicleInfo}</span>
                            </div>
                          )}
                          {transfer.destination && (
                            <div className="text-[11px] text-slate-500">
                              مقصد: {transfer.destination}
                            </div>
                          )}
                          <div className="text-[10px] text-slate-400">
                            انباردار: {transfer.dispatchedBy}
                          </div>
                        </div>
                      </td>

                      {/* 4. Return Vehicle & Returner */}
                      <td className="p-3 align-top text-xs">
                        {latestReturn ? (
                          <div className="space-y-1 bg-emerald-50/50 p-2 rounded-lg border border-emerald-200">
                            <div className="flex items-center gap-1 text-emerald-900 font-bold">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              <span>آورنده: {latestReturn.returnerName}</span>
                            </div>
                            {latestReturn.returnVehicleInfo && (
                              <div className="flex items-center gap-1 text-[11px] text-emerald-800">
                                <Car className="w-3 h-3 text-emerald-600 shrink-0" />
                                <span>{latestReturn.returnVehicleInfo}</span>
                              </div>
                            )}
                            <div className="text-[10px] text-slate-500 font-mono">
                              تاریخ ورود: {latestReturn.returnedAt}
                            </div>
                            {latestReturn.notes && (
                              <div className="text-[10px] text-slate-600">
                                گزارش: {latestReturn.notes}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="p-2 text-center text-slate-400 text-[11px] bg-slate-50 rounded-lg border border-dashed border-slate-200">
                            {transfer.isReturnable ? 'هنوز دستگاه بازنگشته است' : 'عدم نیاز به بازگشت'}
                          </div>
                        )}
                      </td>

                      {/* 5. Status */}
                      <td className="p-3 text-center align-top">
                        <span className={`inline-block px-2.5 py-1 rounded-full text-xs border ${statusBadge.color}`}>
                          {statusBadge.label}
                        </span>
                        {transfer.expectedReturnDate && isPendingReturn && (
                          <div className="text-[10px] text-amber-700 font-mono mt-1 font-bold">
                            موعد: {transfer.expectedReturnDate}
                          </div>
                        )}
                      </td>

                      {/* 6. Action Buttons */}
                      <td className="p-3 text-center align-top">
                        <div className="flex flex-col gap-1.5 items-center justify-center">
                          {/* Return Button if pending */}
                          {isPendingReturn && transfer.isReturnable && (
                            <button
                              type="button"
                              onClick={() => setReturnModalTransfer(transfer)}
                              className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-[11px] shadow-sm transition-all w-full justify-center"
                            >
                              <ArrowDownLeft className="w-3.5 h-3.5" />
                              <span>ثبت ورود دستگاه</span>
                            </button>
                          )}

                          {/* Print Slip Button */}
                          <button
                            type="button"
                            onClick={() => setPrintModalTransfer(transfer)}
                            className="flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium text-[11px] transition-colors w-full justify-center"
                          >
                            <Printer className="w-3.5 h-3.5" />
                            <span>چاپ برگه حواله</span>
                          </button>

                          {/* Delete Button */}
                          <button
                            type="button"
                            onClick={() => setTransferToDelete(transfer)}
                            className="text-slate-400 hover:text-rose-600 p-1 rounded hover:bg-rose-50 transition-colors"
                            title="حذف حواله"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-12 text-center text-slate-400 space-y-3">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 text-slate-400 mx-auto flex items-center justify-center">
              <ArrowLeftRight className="w-8 h-8" />
            </div>
            <div className="text-sm font-bold text-slate-600">هیچ برگه خروج یا ورودی یافت نشد</div>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              برای ثبت خروج دستگاه جهت اعزام به تعمیرگاه، امانی نزد همکار/مشتری یا مصرف کارگاهی بدون نیاز به صدور فاکتور، روی دکمه ثبت خروج جدید کلیک فرمایید.
            </p>
            <button
              type="button"
              onClick={() => setIsDispatchModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm mt-2"
            >
              <Plus className="w-4 h-4" />
              <span>ثبت اولین برگه خروج مستقیم</span>
            </button>
          </div>
        )}
      </div>

      {/* Dispatch Modal */}
      {isDispatchModalOpen && (
        <DirectTransferModal
          isOpen={isDispatchModalOpen}
          onClose={() => setIsDispatchModalOpen(false)}
          products={products}
          settings={settings}
          defaultWarehouseName={settings.originWarehouseName}
          defaultWarehouseId={settings.defaultWarehouseId}
          currentUserName={currentUserName}
          onSave={onSaveDispatch}
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

      {/* Print Modal */}
      {printModalTransfer && (
        <DirectTransferPrintModal
          isOpen={!!printModalTransfer}
          onClose={() => setPrintModalTransfer(null)}
          transfer={printModalTransfer}
          settings={settings}
        />
      )}

      {/* Delete Confirmation Modal */}
      {transferToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-5 max-w-md w-full shadow-xl border border-slate-200 text-slate-800 space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <h4 className="font-bold text-base">حذف حواله خروج مستقیم</h4>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              آیا از حذف حواله خروج شماره <strong className="text-slate-900 font-mono">{transferToDelete.transferNumber}</strong> با عنوان «{transferToDelete.title}» اطمینان دارید؟
            </p>

            {transferToDelete.status === 'dispatched' && (
              <label className="flex items-center gap-2 text-xs bg-slate-50 p-2.5 rounded-xl border border-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={revertStockOnDelete}
                  onChange={(e) => setRevertStockOnDelete(e.target.checked)}
                  className="w-4 h-4 text-amber-600 rounded focus:ring-amber-500"
                />
                <span className="font-medium text-slate-700">
                  موجودی دستگاه‌های خارج شده مجدداً به انبار برگشت داده شود
                </span>
              </label>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setTransferToDelete(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 text-xs font-medium"
              >
                انصراف
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteTransfer(transferToDelete.id, revertStockOnDelete);
                  setTransferToDelete(null);
                }}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-sm"
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
