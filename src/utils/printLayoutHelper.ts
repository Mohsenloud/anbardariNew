import React from 'react';
import { PrintLayoutSettings, DEFAULT_PRINT_LAYOUT } from '../types';

/**
 * Returns CSS custom properties (variables) to apply onto printable container
 * (#printable-invoice, #printable-exit-slip, or live preview box).
 */
export function getPrintLayoutCssVariables(
  layout?: Partial<PrintLayoutSettings>,
  pageSize: 'a4' | 'a5' = 'a4',
  orientation: 'portrait' | 'landscape' = 'portrait'
): React.CSSProperties {
  const cfg: PrintLayoutSettings = { ...DEFAULT_PRINT_LAYOUT, ...(layout || {}) };
  const isA5 = pageSize === 'a5';
  const isLandscape = orientation === 'landscape';
  
  // A5 sheets scale down proportionally for crisp, comfortable spacing
  const scaleRatio = isA5 ? (isLandscape ? 0.88 : 0.85) : (isLandscape ? 0.96 : 1.0);

  const baseFont = Math.max(8, Math.round(cfg.baseFontSize * scaleRatio));
  const headerTitle = Math.max(11, Math.round(cfg.headerTitleSize * scaleRatio));
  const headerMeta = Math.max(8, Math.round(cfg.headerMetaSize * scaleRatio));
  const tableHeader = Math.max(8, Math.round(cfg.tableHeaderSize * scaleRatio));
  const tableBody = Math.max(8, Math.round(cfg.tableBodySize * scaleRatio));
  const totals = Math.max(9, Math.round(cfg.totalsSize * scaleRatio));
  const notes = Math.max(7, Math.round(cfg.notesFontSize * scaleRatio));

  const py = Math.max(1, Math.round(cfg.tableRowPaddingY * scaleRatio));
  const px = Math.max(2, Math.round(cfg.tableCellPaddingX * scaleRatio));
  const sigH = Math.max(30, Math.round(cfg.signatureBoxHeight * scaleRatio));
  const marginMm = cfg.pageMarginMm || (isA5 ? 4 : 6);

  return {
    ['--print-base-font-size' as any]: `${baseFont}px`,
    ['--print-header-title-size' as any]: `${headerTitle}px`,
    ['--print-header-meta-size' as any]: `${headerMeta}px`,
    ['--print-table-header-size' as any]: `${tableHeader}px`,
    ['--print-table-body-size' as any]: `${tableBody}px`,
    ['--print-totals-size' as any]: `${totals}px`,
    ['--print-notes-size' as any]: `${notes}px`,
    ['--print-table-row-py' as any]: `${py}px`,
    ['--print-table-cell-px' as any]: `${px}px`,
    ['--print-theme-color' as any]: cfg.themeColor || '#0f172a',
    ['--print-border-color' as any]: cfg.tableBorderColor || '#cbd5e1',
    ['--print-sig-height' as any]: `${sigH}px`,
    ['--print-page-margin' as any]: `${marginMm}mm`,
    ['--print-col-index' as any]: `${Math.round(cfg.colWidthIndex * scaleRatio)}px`,
    ['--print-col-code' as any]: `${Math.round(cfg.colWidthCode * scaleRatio)}px`,
    ['--print-col-qty' as any]: `${Math.round(cfg.colWidthQty * scaleRatio)}px`,
    ['--print-col-unit' as any]: `${Math.round(cfg.colWidthUnit * scaleRatio)}px`,
    ['--print-col-price' as any]: `${Math.round(cfg.colWidthPrice * scaleRatio)}px`,
    ['--print-col-discount' as any]: `${Math.round(cfg.colWidthDiscount * scaleRatio)}px`,
    ['--print-col-total' as any]: `${Math.round(cfg.colWidthTotal * scaleRatio)}px`,
  };
}

/**
 * Returns scoped CSS rules that apply the variables to elements inside print containers
 */
export function getPrintLayoutCssRules(containerSelector = '#printable-invoice, #printable-exit-slip, .print-container'): string {
  return `
    ${containerSelector} {
      font-size: var(--print-base-font-size, 12px) !important;
      line-height: 1.35 !important;
    }
    ${containerSelector} .invoice-header h1,
    ${containerSelector} .invoice-header h2,
    ${containerSelector} .exit-slip-header h1,
    ${containerSelector} .exit-slip-header h2 {
      font-size: var(--print-header-title-size, 18px) !important;
      color: var(--print-theme-color, #0f172a) !important;
    }
    ${containerSelector} .invoice-header,
    ${containerSelector} .exit-slip-header {
      border-color: var(--print-theme-color, #0f172a) !important;
    }
    ${containerSelector} .invoice-meta,
    ${containerSelector} .invoice-customer-card,
    ${containerSelector} .exit-slip-meta-grid {
      font-size: var(--print-header-meta-size, 11px) !important;
    }
    ${containerSelector} table th {
      font-size: var(--print-table-header-size, 11px) !important;
      padding-top: var(--print-table-row-py, 6px) !important;
      padding-bottom: var(--print-table-row-py, 6px) !important;
      padding-left: var(--print-table-cell-px, 8px) !important;
      padding-right: var(--print-table-cell-px, 8px) !important;
      border-color: var(--print-border-color, #cbd5e1) !important;
    }
    ${containerSelector} table td {
      font-size: var(--print-table-body-size, 11px) !important;
      padding-top: var(--print-table-row-py, 6px) !important;
      padding-bottom: var(--print-table-row-py, 6px) !important;
      padding-left: var(--print-table-cell-px, 8px) !important;
      padding-right: var(--print-table-cell-px, 8px) !important;
      border-color: var(--print-border-color, #cbd5e1) !important;
    }
    ${containerSelector} .invoice-totals-box,
    ${containerSelector} .invoice-totals-box * {
      font-size: var(--print-totals-size, 13px) !important;
    }
    ${containerSelector} .invoice-notes,
    ${containerSelector} .invoice-footer-terms {
      font-size: var(--print-notes-size, 10px) !important;
    }
    ${containerSelector} .invoice-signatures,
    ${containerSelector} .exit-slip-signatures {
      min-height: var(--print-sig-height, 65px) !important;
    }
  `;
}
