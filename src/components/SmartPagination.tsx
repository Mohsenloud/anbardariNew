import React from 'react';
import { ChevronRight, ChevronLeft, ChevronsRight, ChevronsLeft, Layers } from 'lucide-react';
import { toPersianDigits } from '../utils/jalali';

interface SmartPaginationProps {
  currentPage: number;
  totalItems: number;
  pageSize: number; // 0 means "all"
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  itemLabel?: string;
  pageSizeOptions?: number[];
  className?: string;
}

export const SmartPagination: React.FC<SmartPaginationProps> = ({
  currentPage,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
  itemLabel = 'مورد',
  pageSizeOptions = [25, 50, 100],
  className = '',
}) => {
  if (totalItems <= 0) return null;

  const effectivePageSize = pageSize === 0 ? totalItems : pageSize;
  const totalPages = Math.max(1, Math.ceil(totalItems / effectivePageSize));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);

  const startIndex = pageSize === 0 ? 1 : (safePage - 1) * pageSize + 1;
  const endIndex = pageSize === 0 ? totalItems : Math.min(safePage * pageSize, totalItems);

  const getVisiblePages = () => {
    const pages: (number | 'ellipsis')[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (safePage > 3) pages.push('ellipsis');
      const start = Math.max(2, safePage - 1);
      const end = Math.min(totalPages - 1, safePage + 1);
      for (let i = start; i <= end; i++) pages.push(i);
      if (safePage < totalPages - 2) pages.push('ellipsis');
      pages.push(totalPages);
    }
    return pages;
  };

  return (
    <div
      className={`flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-xs text-xs transition-all print:hidden ${className}`}
      dir="rtl"
    >
      {/* Info & Page Size Selector */}
      <div className="flex flex-wrap items-center justify-between sm:justify-start w-full sm:w-auto gap-3 text-slate-600 dark:text-slate-400">
        <div className="flex items-center gap-1.5 font-medium">
          <span className="w-2 h-2 rounded-full bg-indigo-500 inline-block" />
          <span>نمایش</span>
          <span className="font-black text-slate-900 dark:text-white px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800">
            {toPersianDigits(startIndex.toLocaleString())} تا {toPersianDigits(endIndex.toLocaleString())}
          </span>
          <span>از</span>
          <span className="font-black text-indigo-600 dark:text-indigo-400 px-1.5 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/60">
            {toPersianDigits(totalItems.toLocaleString())}
          </span>
          <span>{itemLabel}</span>
        </div>

        <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800/70 px-2.5 py-1 rounded-xl border border-slate-200/70 dark:border-slate-700/70">
          <Layers className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">تعداد در صفحه:</span>
          <select
            value={pageSize}
            onChange={(e) => {
              const newSize = Number(e.target.value);
              onPageSizeChange(newSize);
              onPageChange(1);
            }}
            className="bg-transparent font-black text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer pr-1"
          >
            {pageSizeOptions.map((opt) => (
              <option key={opt} value={opt} className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200">
                {toPersianDigits(opt)} {itemLabel}
              </option>
            ))}
            <option value={0} className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200">
              نمایش همه ({toPersianDigits(totalItems.toLocaleString())})
            </option>
          </select>
        </div>
      </div>

      {/* Pagination Controls */}
      {pageSize !== 0 && totalPages > 1 && (
        <div className="flex items-center gap-1 self-center sm:self-auto">
          <button
            type="button"
            onClick={() => onPageChange(1)}
            disabled={safePage === 1}
            title="صفحه اول"
            className="p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-35 disabled:pointer-events-none transition-colors"
          >
            <ChevronsRight className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => onPageChange(safePage - 1)}
            disabled={safePage === 1}
            title="صفحه قبل"
            className="p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-35 disabled:pointer-events-none transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-1 mx-1">
            {getVisiblePages().map((p, idx) =>
              p === 'ellipsis' ? (
                <span key={`el-${idx}`} className="px-1.5 text-slate-400 font-bold select-none">
                  ...
                </span>
              ) : (
                <button
                  key={p}
                  type="button"
                  onClick={() => onPageChange(p)}
                  className={`min-w-[30px] h-[30px] px-2 rounded-xl font-black text-xs transition-all ${
                    p === safePage
                      ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/30 scale-105'
                      : 'bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60'
                  }`}
                >
                  {toPersianDigits(p)}
                </button>
              )
            )}
          </div>

          <button
            type="button"
            onClick={() => onPageChange(safePage + 1)}
            disabled={safePage === totalPages}
            title="صفحه بعد"
            className="p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-35 disabled:pointer-events-none transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => onPageChange(totalPages)}
            disabled={safePage === totalPages}
            title="صفحه آخر"
            className="p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-35 disabled:pointer-events-none transition-colors"
          >
            <ChevronsLeft className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};

export function paginateArray<T>(items: T[], currentPage: number, pageSize: number): T[] {
  if (!pageSize || pageSize <= 0) return items;
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);
  const start = (safePage - 1) * pageSize;
  return items.slice(start, start + pageSize);
}
