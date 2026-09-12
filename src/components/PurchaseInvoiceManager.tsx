import React, { useState } from 'react';
import { 
  PurchaseInvoice, 
  Product, 
  InboundReceipt, 
  StoreSettings, 
  AppUser 
} from '../types';
import { toPersianDigits, formatPrice } from '../utils/jalali';
import { PAYMENT_METHOD_LABELS } from '../utils/storage';
import { NewPurchaseInvoiceModal } from './NewPurchaseInvoiceModal';
import { PurchaseInvoiceViewModal } from './PurchaseInvoiceViewModal';
import { 
  Plus, 
  Search, 
  ShoppingBag, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  Building2, 
  Printer, 
  Eye, 
  Trash2, 
  Calendar, 
  CreditCard,
  PackageCheck,
  ArrowRight,
  Filter,
  Check
} from 'lucide-react';

interface PurchaseInvoiceManagerProps {
  purchaseInvoices: PurchaseInvoice[];
  products: Product[];
  inboundReceipts: InboundReceipt[];
  settings: StoreSettings;
  currentUser?: AppUser;
  onSavePurchaseInvoice: (
    invoice: PurchaseInvoice,
    receipt: InboundReceipt,
    newProducts: Product[]
  ) => void;
  onDeletePurchaseInvoice: (invoiceId: string) => void;
  onNavigateToWarehouseReceipt?: (receiptId: string) => void;
}

export const PurchaseInvoiceManager: React.FC<PurchaseInvoiceManagerProps> = ({
  purchaseInvoices,
  products,
  inboundReceipts,
  settings,
  currentUser,
  onSavePurchaseInvoice,
  onDeletePurchaseInvoice,
  onNavigateToWarehouseReceipt,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending_receipt' | 'completed' | 'has_discrepancy' | 'unpaid'>('all');

  // Modals
  const [isNewPurchaseModalOpen, setIsNewPurchaseModalOpen] = useState(false);
  const [viewingPurchaseInvoice, setViewingPurchaseInvoice] = useState<PurchaseInvoice | null>(null);
  const [invoiceToDelete, setInvoiceToDelete] = useState<PurchaseInvoice | null>(null);

  // Extract unique previous suppliers for auto-suggest
  const previousSuppliers = Array.from(
    new Set(purchaseInvoices.map((inv) => inv.supplierName).filter(Boolean))
  );

  // Filtered invoices
  const filteredInvoices = purchaseInvoices.filter((inv) => {
    const matchesSearch =
      inv.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inv.supplierName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (inv.notes && inv.notes.toLowerCase().includes(searchQuery.toLowerCase())) ||
      inv.items.some((i) => i.productName.toLowerCase().includes(searchQuery.toLowerCase()));

    let matchesStatus = true;
    if (statusFilter === 'pending_receipt') {
      matchesStatus = inv.status === 'pending_receipt';
    } else if (statusFilter === 'completed') {
      matchesStatus = inv.status === 'completed';
    } else if (statusFilter === 'has_discrepancy') {
      matchesStatus = inv.status === 'has_discrepancy';
    } else if (statusFilter === 'unpaid') {
      matchesStatus = inv.paymentStatus === 'unpaid' || inv.paymentStatus === 'partial';
    }

    return matchesSearch && matchesStatus;
  });

  // Calculate statistics
  const totalPurchasesAmount = purchaseInvoices.reduce((sum, inv) => sum + inv.finalTotal, 0);
  const pendingReceiptCount = purchaseInvoices.filter((inv) => inv.status === 'pending_receipt').length;
  const discrepancyCount = purchaseInvoices.filter((inv) => inv.status === 'has_discrepancy').length;
  const unpaidCount = purchaseInvoices.filter((inv) => inv.paymentStatus !== 'paid').length;

  const handleConfirmDelete = () => {
    if (invoiceToDelete) {
      onDeletePurchaseInvoice(invoiceToDelete.id);
      setInvoiceToDelete(null);
    }
  };

  return (
    <div className="space-y-5">
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 sm:p-6 rounded-3xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-black text-slate-900">
                مدیریت فاکتورهای خرید کالا
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                ثبت فاکتورهای خرید، تامین‌کنندگان و پیگیری صدور حواله‌های ورود به انبار
              </p>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsNewPurchaseModalOpen(true)}
          className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm shadow-md active:scale-95 transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>ثبت فاکتور خرید جدید</span>
        </button>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="text-xs text-slate-500 mb-1">کل مبالغ خرید:</div>
          <div className="text-sm sm:text-base font-black text-slate-900 font-mono">
            {toPersianDigits(formatPrice(totalPurchasesAmount))}{' '}
            <span className="text-[11px] font-normal text-slate-500">تومان</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            {toPersianDigits(purchaseInvoices.length)} فقره فاکتور خرید
          </div>
        </div>

        <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-blue-200/80 shadow-xs">
          <div className="text-xs text-blue-700 mb-1 flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            <span>در انتظار ورود به انبار:</span>
          </div>
          <div className="text-sm sm:text-base font-black text-blue-900 font-mono">
            {toPersianDigits(pendingReceiptCount)}{' '}
            <span className="text-[11px] font-normal text-slate-500">حواله</span>
          </div>
          <div className="text-[11px] text-blue-600 mt-1">
            نیازمند شمارش انباردار
          </div>
        </div>

        <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-amber-200/80 shadow-xs">
          <div className="text-xs text-amber-700 mb-1 flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>دارای مغایرت اقلام:</span>
          </div>
          <div className="text-sm sm:text-base font-black text-amber-900 font-mono">
            {toPersianDigits(discrepancyCount)}{' '}
            <span className="text-[11px] font-normal text-slate-500">مورد</span>
          </div>
          <div className="text-[11px] text-amber-600 mt-1">
            کسری یا مازاد کالای ارسالی
          </div>
        </div>

        <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-rose-200/80 shadow-xs">
          <div className="text-xs text-rose-700 mb-1 flex items-center gap-1">
            <CreditCard className="w-3.5 h-3.5" />
            <span>تسویه نشده / نسیه:</span>
          </div>
          <div className="text-sm sm:text-base font-black text-rose-900 font-mono">
            {toPersianDigits(unpaidCount)}{' '}
            <span className="text-[11px] font-normal text-slate-500">فاکتور</span>
          </div>
          <div className="text-[11px] text-rose-600 mt-1">
            بدهی باز به تامین‌کنندگان
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-3 sm:p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Search */}
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="جستجو بر اساس شماره، تامین‌کننده، کالا..."
            className="w-full pl-3 pr-9 py-2 text-xs rounded-xl border border-slate-300 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        {/* Status Filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0 text-xs">
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all cursor-pointer ${
              statusFilter === 'all'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            همه فاکتورها
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('pending_receipt')}
            className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all cursor-pointer ${
              statusFilter === 'pending_receipt'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
            }`}
          >
            در انتظار ورود انبار ({toPersianDigits(pendingReceiptCount)})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('completed')}
            className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all cursor-pointer ${
              statusFilter === 'completed'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
            }`}
          >
            تایید شده انبار
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('has_discrepancy')}
            className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all cursor-pointer ${
              statusFilter === 'has_discrepancy'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
            }`}
          >
            دارای مغایرت ({toPersianDigits(discrepancyCount)})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('unpaid')}
            className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all cursor-pointer ${
              statusFilter === 'unpaid'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
            }`}
          >
            نسیه / بدهکار
          </button>
        </div>
      </div>

      {/* Invoices List */}
      {filteredInvoices.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-slate-200/80 shadow-xs">
          <div className="w-16 h-16 rounded-3xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
            <ShoppingBag className="w-8 h-8" />
          </div>
          <h3 className="font-bold text-slate-800 text-sm sm:text-base">
            فاکتور خریدی یافت نشد
          </h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            {searchQuery
              ? 'موردی با مشخصات جستجو شده پیدا نشد. لطفاً عبارت دیگری را امتحان کنید.'
              : 'شما هنوز فاکتور خریدی ثبت نکرده‌اید. برای ثبت اولین خرید دکمه زیر را لمس کنید.'}
          </p>
          <button
            type="button"
            onClick={() => setIsNewPurchaseModalOpen(true)}
            className="mt-4 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition-all"
          >
            ثبت اولین فاکتور خرید
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredInvoices.map((inv) => {
            const hasDiscrepancy = inv.status === 'has_discrepancy';
            const isPending = inv.status === 'pending_receipt';
            const isCompleted = inv.status === 'completed';

            return (
              <div
                key={inv.id}
                className="bg-white rounded-2xl border border-slate-200 hover:border-slate-300 shadow-2xs hover:shadow-sm p-4 transition-all"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  {/* Left Column: Info & Supplier */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono font-black text-sm text-slate-900 bg-slate-100 px-2.5 py-0.5 rounded-lg">
                        {toPersianDigits(inv.invoiceNumber)}
                      </span>
                      <span className="font-bold text-slate-900 text-sm truncate">
                        {inv.supplierName}
                      </span>
                      <span className="text-xs text-slate-400 font-mono">
                        {toPersianDigits(inv.date)}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-2 text-xs text-slate-600">
                      <div>
                        اقلام: <strong className="text-slate-800">{toPersianDigits(inv.items.length)} قلم کالا</strong>
                      </div>
                      <div>
                        مبلغ کل:{' '}
                        <strong className="text-slate-900 font-mono">
                          {toPersianDigits(formatPrice(inv.finalTotal))} تومان
                        </strong>
                      </div>
                      <div>
                        پرداخت:{' '}
                        <span className={inv.paymentStatus === 'paid' ? 'text-emerald-700 font-medium' : 'text-rose-700 font-bold'}>
                          {inv.paymentStatus === 'paid' ? 'تسویه کامل' : 'نسیه / بدهکار'}
                        </span>
                      </div>
                      {inv.notes && (
                        <div className="text-slate-400 truncate max-w-xs">
                          «{inv.notes}»
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Center/Right Column: Warehouse Inbound Status Badge */}
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {isPending ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold bg-blue-50 text-blue-800 border border-blue-200">
                        <Clock className="w-3.5 h-3.5 text-blue-600" />
                        در انتظار ورود به انبار
                      </span>
                    ) : hasDiscrepancy ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold bg-amber-50 text-amber-800 border border-amber-300">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                        دارای مغایرت کسری/مازاد
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        تایید شده و موجود در انبار
                      </span>
                    )}

                    {/* Quick Link to Warehouse Receipt */}
                    {inv.inboundReceiptId && onNavigateToWarehouseReceipt && (
                      <button
                        type="button"
                        onClick={() => onNavigateToWarehouseReceipt(inv.inboundReceiptId!)}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
                        title="مشاهده حواله ورود کالا در انبار"
                      >
                        <PackageCheck className="w-3.5 h-3.5 text-emerald-600" />
                        <span>حواله ورود</span>
                      </button>
                    )}

                    {/* View/Print Invoice */}
                    <button
                      type="button"
                      onClick={() => setViewingPurchaseInvoice(inv)}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-colors cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>مشاهده و چاپ</span>
                    </button>

                    {/* Delete Invoice */}
                    <button
                      type="button"
                      onClick={() => setInvoiceToDelete(inv)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 rounded-xl hover:bg-rose-50 transition-colors cursor-pointer"
                      title="حذف فاکتور خرید"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* New Purchase Invoice Modal */}
      {isNewPurchaseModalOpen && (
        <NewPurchaseInvoiceModal
          products={products}
          settings={settings}
          currentUser={currentUser}
          previousSuppliers={previousSuppliers}
          onClose={() => setIsNewPurchaseModalOpen(false)}
          onSavePurchase={(newInv, newRec, newProds) => {
            onSavePurchaseInvoice(newInv, newRec, newProds);
            setIsNewPurchaseModalOpen(false);
          }}
        />
      )}

      {/* Viewing & Printing Modal */}
      {viewingPurchaseInvoice && (
        <PurchaseInvoiceViewModal
          invoice={viewingPurchaseInvoice}
          settings={settings}
          currentUser={currentUser}
          onClose={() => setViewingPurchaseInvoice(null)}
          onOpenReceipt={(receiptId) => {
            if (onNavigateToWarehouseReceipt) {
              onNavigateToWarehouseReceipt(receiptId);
            }
          }}
        />
      )}

      {/* Delete Confirmation Modal */}
      {invoiceToDelete && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-slate-200">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-3">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-center text-slate-900 text-sm">
              حذف فاکتور خرید {toPersianDigits(invoiceToDelete.invoiceNumber)}
            </h3>
            <p className="text-xs text-center text-slate-500 mt-1">
              آیا از حذف این فاکتور خرید اطمینان دارید؟ توجه فرمایید در صورتی که ورود کالا تایید شده باشد، حواله مربوطه نیز لغو خواهد شد.
            </p>
            <div className="flex items-center gap-2 mt-5">
              <button
                type="button"
                onClick={() => setInvoiceToDelete(null)}
                className="flex-1 py-2 rounded-xl border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-50"
              >
                انصراف
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="flex-1 py-2 rounded-xl bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 shadow-xs"
              >
                بله، حذف شود
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
