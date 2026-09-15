import React, { useState } from 'react';
import { Customer, Invoice, StoreSettings, AppUser } from '../types';
import { formatPrice, toPersianDigits, getCurrentJalaliDate } from '../utils/jalali';
import { StorageService } from '../utils/storage';
import { exportCustomersToExcel } from '../utils/excelHelper';
import { ExcelImportModal } from './ExcelImportModal';
import { 
  Users, 
  Search, 
  UserPlus, 
  Phone, 
  MapPin, 
  ReceiptText, 
  Edit3, 
  Trash2, 
  Plus,
  X,
  CheckCircle2,
  FileSpreadsheet,
  Download,
  Upload
} from 'lucide-react';

interface CustomersManagerProps {
  customers: Customer[];
  invoices: Invoice[];
  settings: StoreSettings;
  currentUser?: AppUser;
  onSaveCustomer: (customer: Customer) => void;
  onDeleteCustomer: (customerId: string) => void;
  onSelectCustomerForInvoice: (customer: Customer) => void;
  onImportCustomers?: (customers: Customer[], mode: 'merge' | 'replace') => void;
}

export const CustomersManager: React.FC<CustomersManagerProps> = ({
  customers,
  invoices,
  settings,
  currentUser,
  onSaveCustomer,
  onDeleteCustomer,
  onSelectCustomerForInvoice,
  onImportCustomers,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null);

  // Filter customers
  const filteredCustomers = customers.filter((c) => {
    return (
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.phone && c.phone.includes(searchQuery)) ||
      (c.nationalId && c.nationalId.includes(searchQuery)) ||
      (c.address && c.address.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  });

  const handleOpenNew = () => {
    setEditingCustomer({
      id: '',
      name: '',
      phone: '',
      nationalId: '',
      address: '',
      notes: '',
      createdAt: getCurrentJalaliDate(),
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (cust: Customer) => {
    setEditingCustomer({ ...cust });
    setIsModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCustomer || !editingCustomer.name.trim()) return;

    const saved: Customer = {
      ...editingCustomer,
      id: editingCustomer.id || `cust-${Date.now()}`,
      name: editingCustomer.name.trim(),
      phone: editingCustomer.phone?.trim() || '',
      nationalId: editingCustomer.nationalId?.trim() || '',
      address: editingCustomer.address?.trim() || '',
      notes: editingCustomer.notes?.trim() || '',
      createdAt: editingCustomer.createdAt || getCurrentJalaliDate(),
    };

    onSaveCustomer(saved);
    setIsModalOpen(false);
    setEditingCustomer(null);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-purple-50 text-purple-700">
              <Users className="w-5 h-5" />
            </span>
            <h2 className="text-xl font-bold text-slate-800">مدیریت مشتریان و خریداران</h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            دفترچه مشتریان، تاریخچه خریدها و ثبت سریع فاکتور برای مشتری
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
          <button
            type="button"
            id="export-customers-excel-btn"
            onClick={() => exportCustomersToExcel(customers)}
            title="خروجی فایل اکسل مشتریان"
            className="flex items-center gap-1.5 bg-white hover:bg-slate-50 active:scale-95 text-slate-700 border border-slate-300 px-3 py-2 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span className="hidden sm:inline">خروجی اکسل</span>
          </button>

          <button
            type="button"
            id="import-customers-excel-btn"
            onClick={() => setIsImportModalOpen(true)}
            title="ورود مشتریان از فایل اکسل"
            className="flex items-center gap-1.5 bg-emerald-50 hover:bg-emerald-100 active:scale-95 text-emerald-800 border border-emerald-300 px-3 py-2 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span>ورود از اکسل</span>
          </button>

          <button
            id="add-customer-btn"
            onClick={handleOpenNew}
            className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-sm shadow-emerald-200 cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>مشتری جدید</span>
          </button>
        </div>
      </div>

      {/* Customer List Card */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        {/* Search */}
        <div className="p-4 border-b border-slate-200/80 bg-slate-50/60 flex items-center justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              id="customer-search-input"
              placeholder="جستجو در نام، شماره تلفن، کد ملی یا آدرس..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-xl pr-9 pl-4 py-2 text-xs text-slate-800 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
            />
          </div>
          <span className="text-xs text-slate-500">
            تعداد: <strong>{toPersianDigits(filteredCustomers.length)}</strong> مشتری
          </span>
        </div>

        {/* Customer Cards Grid */}
        <div className="p-4 sm:p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCustomers.length === 0 ? (
            <div className="col-span-full text-center py-12 text-slate-400">
              هیچ مشتری با این مشخصات یافت نشد.
            </div>
          ) : (
            filteredCustomers.map((cust, index) => {
              // Invoices for this customer
              const customerInvoices = invoices.filter((i) => i.customerId === cust.id || i.customerName === cust.name);
              const totalSpent = customerInvoices.reduce((sum, i) => sum + i.finalTotal, 0);

              return (
                <div
                  key={cust.id}
                  className={`${
                    index % 2 === 1 ? 'bg-slate-100/75' : 'bg-white'
                  } border border-slate-200 rounded-2xl p-4 hover:border-slate-300 hover:shadow-xs transition-all flex flex-col justify-between space-y-3`}
                >
                  <div>
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-bold text-slate-900 text-sm">{cust.name}</h3>
                        {cust.nationalId && (
                          <span className="text-[10px] text-slate-400 font-mono">
                            کد ملی: {toPersianDigits(cust.nationalId)}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleOpenEdit(cust)}
                          title="ویرایش اطلاعات"
                          className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-lg cursor-pointer transition-colors"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        {(!currentUser || currentUser.role === 'admin' || currentUser.permissions.canManageCustomers) && (
                          <button
                            id={`delete-customer-btn-${cust.id}`}
                            type="button"
                            onClick={() => setCustomerToDelete(cust)}
                            title="حذف مشتری"
                            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="mt-3 space-y-1.5 text-xs text-slate-600">
                      {cust.phone && (
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Phone className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            <a
                              href={`tel:${cust.phone}`}
                              className="font-mono text-slate-700 hover:text-emerald-700 hover:underline text-xs font-semibold"
                            >
                              {toPersianDigits(cust.phone)}
                            </a>
                          </div>
                          <a
                            href={`tel:${cust.phone}`}
                            className="text-[10px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-md font-medium hover:bg-emerald-100"
                          >
                            تماس
                          </a>
                        </div>
                      )}
                      {cust.address && (
                        <div className="flex items-start gap-2 text-[11px] text-slate-500">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                          <span className="line-clamp-2">{cust.address}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Summary & Quick Invoice Button */}
                  <div className="pt-3 border-t border-slate-200/80 flex items-center justify-between">
                    <div>
                      <div className="text-[10px] text-slate-400">سفارشات:</div>
                      <div className="text-xs font-bold text-slate-800">
                        {toPersianDigits(customerInvoices.length)} فاکتور ({formatPrice(totalSpent, settings.currency)})
                      </div>
                    </div>

                    {(!currentUser || currentUser.permissions.canCreateInvoice) && (
                      <button
                        onClick={() => onSelectCustomerForInvoice(cust)}
                        className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>فاکتور جدید</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* MODAL: ADD / EDIT CUSTOMER */}
      {isModalOpen && editingCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden">
            <div className="bg-slate-900 text-white px-5 py-3.5 flex items-center justify-between">
              <h3 className="font-bold text-sm">
                {editingCustomer.id ? 'ویرایش مشخصات مشتری' : 'ثبت مشتری جدید'}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">نام کامل مشتری یا شرکت *</label>
                <input
                  type="text"
                  required
                  id="customer-modal-name"
                  value={editingCustomer.name}
                  onChange={(e) => setEditingCustomer({ ...editingCustomer, name: e.target.value })}
                  placeholder="مثال: مهندس حسینی"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">شماره تماس / همراه</label>
                <input
                  type="text"
                  id="customer-modal-phone"
                  value={editingCustomer.phone}
                  onChange={(e) => setEditingCustomer({ ...editingCustomer, phone: e.target.value })}
                  placeholder="۰۹۱۲۳۴۵۶۷۸۹"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">کد ملی یا شناسه اقتصادی (برای فاکتور رسمی)</label>
                <input
                  type="text"
                  id="customer-modal-nid"
                  value={editingCustomer.nationalId || ''}
                  onChange={(e) => setEditingCustomer({ ...editingCustomer, nationalId: e.target.value })}
                  placeholder="شناسه ملی"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">نشانی و آدرس خریدار</label>
                <input
                  type="text"
                  id="customer-modal-address"
                  value={editingCustomer.address || ''}
                  onChange={(e) => setEditingCustomer({ ...editingCustomer, address: e.target.value })}
                  placeholder="شهر، خیابان، پلاک، طبقه..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">یادداشت‌های داخلی</label>
                <textarea
                  rows={2}
                  id="customer-modal-notes"
                  value={editingCustomer.notes || ''}
                  onChange={(e) => setEditingCustomer({ ...editingCustomer, notes: e.target.value })}
                  placeholder="توضیحات مربوط به اعتبار یا شرایط پرداخت..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs text-slate-600 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  id="save-customer-modal-btn"
                  className="flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>ذخیره مشتری</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Customer Confirmation Modal */}
      {customerToDelete && (
        <div 
          id="delete-customer-confirm-modal"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 text-right">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mb-4 mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900 text-center mb-2">
              حذف مشتری
            </h3>
            <p className="text-sm text-slate-600 text-center mb-6 leading-relaxed">
              آیا از حذف پرونده مشتری <span className="font-bold text-slate-800">«{customerToDelete.name}»</span> اطمینان دارید؟
            </p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                id="cancel-delete-customer-btn"
                onClick={() => setCustomerToDelete(null)}
                className="flex-1 py-2.5 px-4 rounded-xl text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
              >
                انصراف
              </button>
              <button
                type="button"
                id="confirm-delete-customer-btn"
                onClick={() => {
                  onDeleteCustomer(customerToDelete.id);
                  setCustomerToDelete(null);
                }}
                className="flex-1 py-2.5 px-4 rounded-xl text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 shadow-sm shadow-rose-200 transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" />
                <span>بله، حذف شود</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EXCEL IMPORT MODAL */}
      {isImportModalOpen && (
        <ExcelImportModal
          isOpen={isImportModalOpen}
          onClose={() => setIsImportModalOpen(false)}
          mode="customers"
          existingCustomers={customers}
          onImportCustomers={(imported, importMode) => {
            if (onImportCustomers) {
              onImportCustomers(imported, importMode);
            } else {
              let updated: Customer[];
              if (importMode === 'replace') {
                updated = imported;
              } else {
                const map = new Map<string, Customer>(customers.map((c) => [c.name.trim().toLowerCase(), c]));
                imported.forEach((c) => map.set(c.name.trim().toLowerCase(), c));
                updated = Array.from(map.values()) as Customer[];
              }
              StorageService.saveCustomers(updated);
            }
            setIsImportModalOpen(false);
          }}
        />
      )}
    </div>
  );
};
