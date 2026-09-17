import React, { useState, useRef } from 'react';
import { Product, Customer } from '../types';
import { 
  parseProductsExcel, 
  parseCustomersExcel, 
  generateProductExcelTemplate, 
  generateCustomerExcelTemplate,
  ProductImportResult,
  CustomerImportResult
} from '../utils/excelHelper';
import { toPersianDigits, formatPrice } from '../utils/jalali';
import { 
  FileSpreadsheet, 
  Upload, 
  Download, 
  CheckCircle2, 
  AlertTriangle, 
  X, 
  ArrowRight, 
  Layers, 
  FileText,
  HelpCircle,
  Sparkles,
  RefreshCw,
  Info
} from 'lucide-react';

interface ExcelImportModalProps {
  type?: 'products' | 'customers';
  mode?: 'products' | 'customers';
  isOpen: boolean;
  currency?: string;
  onClose: () => void;
  existingProducts?: Product[];
  existingCustomers?: Customer[];
  onImportProducts?: (products: Product[], mode: 'merge' | 'replace') => void;
  onImportCustomers?: (customers: Customer[], mode: 'merge' | 'replace') => void;
}

export const ExcelImportModal: React.FC<ExcelImportModalProps> = ({
  type,
  mode: propMode,
  isOpen,
  currency = 'ریال',
  onClose,
  existingProducts,
  existingCustomers,
  onImportProducts,
  onImportCustomers,
}) => {
  // Normalize target type: seamlessly support either `type` or `mode` prop
  const targetType: 'products' | 'customers' =
    type || (propMode === 'customers' ? 'customers' : 'products');

  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge');

  // Parsed results
  const [productResult, setProductResult] = useState<ProductImportResult | null>(null);
  const [customerResult, setCustomerResult] = useState<CustomerImportResult | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleDownloadTemplate = () => {
    if (targetType === 'products') {
      generateProductExcelTemplate();
    } else {
      generateCustomerExcelTemplate();
    }
  };

  const handleFileSelect = async (selectedFile: File) => {
    if (!selectedFile) return;

    // Check extension
    const validExts = ['.xlsx', '.xls', '.csv'];
    const lowerName = selectedFile.name.toLowerCase();
    const isValid = validExts.some((ext) => lowerName.endsWith(ext));

    if (!isValid) {
      setError('فرمت فایل نامعتبر است. لطفاً فقط فایل با فرمت .xlsx، .xls یا .csv انتخاب نمایید.');
      return;
    }

    setFile(selectedFile);
    setError(null);
    setIsLoading(true);

    try {
      if (targetType === 'products') {
        const res = await parseProductsExcel(selectedFile);
        if (res.products.length === 0) {
          setError('هیچ کالای معتبری در فایل اکسل یافت نشد. لطفاً ساختار ستون‌های فایل را بررسی فرمایید.');
        } else {
          setProductResult(res);
        }
      } else {
        const res = await parseCustomersExcel(selectedFile);
        if (!res.customers || res.customers.length === 0) {
          setError('هیچ مشتری معتبری در فایل اکسل یافت نشد. لطفاً از وجود ستون نام مشتری یا خریدار و ردیف‌های دارای اطلاعات اطمینان حاصل فرمایید.');
        } else {
          setCustomerResult(res);
        }
      }
    } catch (err: any) {
      setError(err?.message || 'خطا در خواندن و تحلیل فایل اکسل.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleConfirmImport = () => {
    if (targetType === 'products' && productResult && productResult.products.length > 0 && onImportProducts) {
      onImportProducts(productResult.products, importMode);
      onClose();
    } else if (targetType === 'customers' && customerResult && customerResult.customers.length > 0 && onImportCustomers) {
      onImportCustomers(customerResult.customers, importMode);
      onClose();
    }
  };

  const handleReset = () => {
    setFile(null);
    setProductResult(null);
    setCustomerResult(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const hasData = Boolean(
    (targetType === 'products' && productResult && productResult.products.length > 0) ||
    (targetType === 'customers' && customerResult && customerResult.customers.length > 0)
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/65 backdrop-blur-xs">
      <div className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200 w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="bg-slate-900 text-white px-5 sm:px-6 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base">
                {targetType === 'products' ? 'ورود محصولات و کالاها از اکسل (با پشتیبانی تنوع)' : 'ورود مشتریان از فایل اکسل'}
              </h3>
              <p className="text-[11px] text-slate-300 mt-0.5">
                {targetType === 'products' 
                  ? 'ثبت دسته‌جمعی اقلام انبار، قیمت‌ها، موجودی و تنوع رنگ/مدل از طریق فایل اکسل' 
                  : 'بارگذاری سریع فهرست مشتریان، شماره‌ها و آدرس‌ها'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 text-xs">
          {/* Template Download Banner */}
          <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-2xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <Sparkles className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <strong className="text-emerald-900 text-xs block">
                  قالب آماده و استاندارد اکسل را دانلود کنید:
                </strong>
                <span className="text-[11px] text-emerald-800 leading-relaxed block mt-0.5">
                  {targetType === 'products'
                    ? 'فایل نمونه شامل ستون‌های نام کالا، کد، رنگ/تنوع (مانند طوسی یا قرمز برای پودر خشک پاش)، موجودی و قیمت‌ها است.'
                    : 'فایل نمونه شامل نام مشتری یا شرکت، تلفن، کد ملی، آدرس و توضیحات است.'}
                </span>
              </div>
            </div>
            <button
              type="button"
              id="download-excel-template-btn"
              onClick={handleDownloadTemplate}
              className="flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-xs shadow-xs transition-all cursor-pointer shrink-0"
            >
              <Download className="w-4 h-4" />
              <span>دانلود نمونه اکسل</span>
            </button>
          </div>

          {/* Upload Area */}
          {!hasData ? (
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-8 sm:p-10 text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-3 ${
                isDragging
                  ? 'border-emerald-500 bg-emerald-50/50 scale-[0.99]'
                  : 'border-slate-300 hover:border-emerald-400 bg-slate-50/50 hover:bg-emerald-50/20'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx, .xls, .csv"
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    handleFileSelect(e.target.files[0]);
                  }
                }}
                className="hidden"
              />

              <div className="w-14 h-14 rounded-2xl bg-emerald-100/70 text-emerald-700 flex items-center justify-center shadow-xs">
                {isLoading ? (
                  <RefreshCw className="w-7 h-7 animate-spin text-emerald-600" />
                ) : (
                  <Upload className="w-7 h-7" />
                )}
              </div>

              <div>
                <div className="font-bold text-slate-800 text-sm">
                  {isLoading ? 'در حال خواندن و آنالیز فایل اکسل...' : 'فایل اکسل خود را اینجا رها کنید، یا کلیک نمایید'}
                </div>
                <div className="text-slate-500 text-[11px] mt-1">
                  پشتیبانی از فرمت‌های XLSX, XLS و CSV
                </div>
              </div>

              {targetType === 'products' && (
                <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-[11px] font-medium border border-blue-100">
                  <Info className="w-3.5 h-3.5 text-blue-500" />
                  <span>
                    قابلیت هوشمند تجمیع تنوع‌ها: سطرهای با نام یکسان و رنگ‌های مختلف خودکار به یک محصول با چند تنوع تبدیل می‌شوند.
                  </span>
                </div>
              )}
            </div>
          ) : null}

          {/* Error Message */}
          {error && (
            <div className="bg-rose-50 border border-rose-200 text-rose-800 p-3 rounded-xl flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <strong className="block font-bold">خطا در بارگذاری:</strong>
                <span className="text-[11px]">{error}</span>
              </div>
            </div>
          )}

          {/* Preview Section */}
          {hasData && (
            <div className="space-y-4">
              {/* Stats & Controls Bar */}
              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2 sm:gap-4">
                  <div className="flex items-center gap-1.5 font-bold text-slate-800">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>فایل «{file?.name}» تحلیل شد</span>
                  </div>
                  {targetType === 'products' && productResult && (
                    <div className="flex items-center gap-2">
                      <span className="bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-lg text-[11px]">
                        {toPersianDigits(productResult.products.length)} کالا
                      </span>
                      {productResult.totalVariantsCount > 0 && (
                        <span className="bg-purple-100 text-purple-800 font-bold px-2 py-0.5 rounded-lg text-[11px] flex items-center gap-1">
                          <Layers className="w-3 h-3" />
                          <span>{toPersianDigits(productResult.totalVariantsCount)} تنوع رنگ/مدل</span>
                        </span>
                      )}
                    </div>
                  )}
                  {targetType === 'customers' && customerResult && (
                    <span className="bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-lg text-[11px]">
                      {toPersianDigits(customerResult.customers.length)} مشتری آماده ورود
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleReset}
                  className="text-slate-500 hover:text-slate-800 text-[11px] flex items-center gap-1 underline self-end sm:self-auto cursor-pointer"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>انتخاب فایل دیگر</span>
                </button>
              </div>

              {/* Import Mode Radio */}
              <div className="bg-slate-50/80 p-3 rounded-xl border border-slate-200">
                <div className="font-bold text-slate-800 mb-1.5">نحوه اعمال اطلاعات بر روی سامانه:</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <label
                    className={`flex items-center gap-2 p-2.5 rounded-xl border cursor-pointer transition-all ${
                      importMode === 'merge'
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-950 font-bold'
                        : 'bg-white border-slate-200 text-slate-700'
                    }`}
                  >
                    <input
                      type="radio"
                      name="importMode"
                      value="merge"
                      checked={importMode === 'merge'}
                      onChange={() => setImportMode('merge')}
                      className="text-emerald-600 focus:ring-emerald-500"
                    />
                    <div>
                      <div>افزودن به موارد قبلی (ترکیب / Merge)</div>
                      <div className="text-[10px] text-slate-500 font-normal">
                        اقلام قبلی حفظ شده و موارد جدید به انبار اضافه می‌شوند.
                      </div>
                    </div>
                  </label>

                  <label
                    className={`flex items-center gap-2 p-2.5 rounded-xl border cursor-pointer transition-all ${
                      importMode === 'replace'
                        ? 'bg-amber-50 border-amber-500 text-amber-950 font-bold'
                        : 'bg-white border-slate-200 text-slate-700'
                    }`}
                  >
                    <input
                      type="radio"
                      name="importMode"
                      value="replace"
                      checked={importMode === 'replace'}
                      onChange={() => setImportMode('replace')}
                      className="text-amber-600 focus:ring-amber-500"
                    />
                    <div>
                      <div>جایگزینی کامل (Replace)</div>
                      <div className="text-[10px] text-slate-500 font-normal">
                        فهرست قبلی پاک شده و فقط ردیف‌های این فایل قرار می‌گیرند.
                      </div>
                    </div>
                  </label>
                </div>
              </div>

              {/* Products Preview Table */}
              {targetType === 'products' && productResult && (
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <div className="bg-slate-100 px-3 py-2 font-bold text-slate-700 flex justify-between items-center text-[11px]">
                    <span>پیش‌نمایش ۵ قلم اول آماده ورود:</span>
                    <span>مجموع: {toPersianDigits(productResult.products.length)} کالا</span>
                  </div>
                  <div className="max-h-56 overflow-y-auto">
                    <table className="w-full text-right text-[11px]">
                      <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 sticky top-0">
                        <tr>
                          <th className="p-2">نام کالا</th>
                          <th className="p-2">کد</th>
                          <th className="p-2">تنوع‌ها (رنگ / مدل)</th>
                          <th className="p-2">واحد</th>
                          <th className="p-2">موجودی کل</th>
                          <th className="p-2">قیمت فروش</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {productResult.products.slice(0, 8).map((p, idx) => (
                          <tr key={p.id || idx} className="hover:bg-slate-50/70">
                            <td className="p-2 font-bold text-slate-800">{p.name}</td>
                            <td className="p-2 font-mono text-slate-500">{toPersianDigits(p.code)}</td>
                            <td className="p-2">
                              {p.hasVariants && p.variants && p.variants.length > 0 ? (
                                <div className="flex flex-wrap gap-1">
                                  {p.variants.map((v) => (
                                    <span
                                      key={v.id}
                                      className="bg-purple-50 text-purple-700 border border-purple-200 px-1.5 py-0.5 rounded text-[10px] font-medium"
                                    >
                                      {v.name} ({toPersianDigits(v.stock)})
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-slate-400">تک‌محصول (بدون تنوع)</span>
                              )}
                            </td>
                            <td className="p-2 text-slate-600">{p.unit}</td>
                            <td className="p-2 font-bold text-emerald-700">{toPersianDigits(p.stock)}</td>
                            <td className="p-2 text-slate-700">{formatPrice(p.sellPrice, currency)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Customers Preview Table */}
              {targetType === 'customers' && customerResult && (
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <div className="bg-slate-100 px-3 py-2 font-bold text-slate-700 flex justify-between items-center text-[11px]">
                    <span>پیش‌نمایش مشتریان آماده ورود:</span>
                    <span>مجموع: {toPersianDigits(customerResult.customers.length)} مشتری</span>
                  </div>
                  <div className="max-h-56 overflow-y-auto">
                    <table className="w-full text-right text-[11px]">
                      <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 sticky top-0">
                        <tr>
                          <th className="p-2">نام مشتری / شرکت</th>
                          <th className="p-2">شماره تماس</th>
                          <th className="p-2">کد ملی / شناسه</th>
                          <th className="p-2">آدرس</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {customerResult.customers.slice(0, 8).map((c, idx) => (
                          <tr key={c.id || idx} className="hover:bg-slate-50/70">
                            <td className="p-2 font-bold text-slate-800">{c.name}</td>
                            <td className="p-2 font-mono text-slate-600">{toPersianDigits(c.phone)}</td>
                            <td className="p-2 font-mono text-slate-500">{toPersianDigits(c.nationalId || '-')}</td>
                            <td className="p-2 text-slate-600 truncate max-w-[150px]">{c.address || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="bg-slate-50 px-5 sm:px-6 py-3.5 border-t border-slate-200 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 cursor-pointer"
          >
            انصراف
          </button>

          <button
            type="button"
            id="confirm-import-excel-btn"
            disabled={!hasData || isLoading}
            onClick={handleConfirmImport}
            className={`flex items-center gap-1.5 px-5 py-2.5 text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer ${
              hasData && !isLoading
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white active:scale-95'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>
              {targetType === 'products'
                ? `تایید و ورود ${productResult ? toPersianDigits(productResult.products.length) : ''} کالا به انبار`
                : `تایید و ورود ${customerResult ? toPersianDigits(customerResult.customers.length) : ''} مشتری`}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
