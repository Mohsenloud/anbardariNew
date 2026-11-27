import React from 'react';
import { PrintLayoutSettings, DEFAULT_PRINT_LAYOUT } from '../types';

/**
 * Computes effective layout CSS custom properties (--print-*) taking into account:
 * - Paper size & orientation scale ratio (A4 / A5, Portrait / Landscape)
 * - Compact mode & section spacing
 * - Table border style, width, zebra striping, and custom color palette
 */
export function getPrintLayoutCssVariables(
  layout?: Partial<PrintLayoutSettings>,
  pageSize: 'a4' | 'a5' = 'a4',
  orientation: 'portrait' | 'landscape' = 'portrait'
): React.CSSProperties {
  const cfg: PrintLayoutSettings = { ...DEFAULT_PRINT_LAYOUT, ...(layout || {}) };
  const isA5 = pageSize === 'a5';
  const isLandscape = orientation === 'landscape';

  const scaleRatio = isA5 ? (isLandscape ? 0.88 : 0.85) : (isLandscape ? 0.96 : 1.0);
  const compactFactor = cfg.compactMode ? 0.82 : 1.0;

  const baseFont = Math.max(8, Math.round(cfg.baseFontSize * scaleRatio));
  const headerTitle = Math.max(11, Math.round(cfg.headerTitleSize * scaleRatio));
  const headerMeta = Math.max(8, Math.round(cfg.headerMetaSize * scaleRatio));
  const tableHeader = Math.max(8, Math.round(cfg.tableHeaderSize * scaleRatio));
  const tableBody = Math.max(8, Math.round(cfg.tableBodySize * scaleRatio));
  const totals = Math.max(9, Math.round(cfg.totalsSize * scaleRatio));
  const notes = Math.max(7, Math.round(cfg.notesFontSize * scaleRatio));

  const py = Math.max(1, Math.round(cfg.tableRowPaddingY * scaleRatio * compactFactor));
  const px = Math.max(2, Math.round(cfg.tableCellPaddingX * scaleRatio));
  const sigH = Math.max(28, Math.round(cfg.signatureBoxHeight * scaleRatio * (cfg.compactMode ? 0.85 : 1)));
  const marginMm = cfg.pageMarginMm ?? (isA5 ? 4 : 6);

  const customMinH = cfg.tableRowMinHeight;
  const baseDefaultRowMin = isA5 ? (isLandscape ? 24 : 28) : (isLandscape ? 32 : 36);
  const rowMinHeight = customMinH
    ? Math.max(18, Math.round(customMinH * scaleRatio * compactFactor))
    : Math.max(20, Math.round(baseDefaultRowMin * scaleRatio * compactFactor));
  const headerHeight = Math.max(24, Math.round(rowMinHeight * 1.08));

  const bodyBg = cfg.tableBodyBg || '#ffffff';
  const zebraEnabled = cfg.tableZebraStriping !== false || cfg.tableBorderStyle === 'striped';
  const zebraBg = zebraEnabled ? (cfg.tableZebraBg || '#f8fafc') : bodyBg;

  const borderWidthPx = Math.max(0.5, Math.min(3, cfg.tableBorderWidth ?? 1));
  const sectionGapPx = cfg.compactMode
    ? 4
    : cfg.sectionSpacing === 'compact'
    ? 4
    : cfg.sectionSpacing === 'relaxed'
    ? 14
    : 8;

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
    ['--print-table-row-min-h' as any]: `${rowMinHeight}px`,
    ['--print-table-header-h' as any]: `${headerHeight}px`,
    ['--print-theme-color' as any]: cfg.themeColor || '#0f172a',
    ['--print-border-color' as any]: cfg.tableBorderColor || '#cbd5e1',
    ['--print-border-width' as any]: `${borderWidthPx}px`,
    ['--print-page-bg' as any]: cfg.pageBgColor || '#ffffff',
    ['--print-header-bg' as any]: cfg.tableHeaderBg || '#f1f5f9',
    ['--print-header-text' as any]: cfg.tableHeaderTextColor || '#0f172a',
    ['--print-body-bg' as any]: bodyBg,
    ['--print-zebra-bg' as any]: zebraBg,
    ['--print-sig-height' as any]: `${sigH}px`,
    ['--print-section-gap' as any]: `${sectionGapPx}px`,
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
 * Generates CSS rules for both live screen preview, direct vector print, and PDF cloning.
 * Respects border styles ('bordered' | 'striped' | 'minimal' | 'modern'), colors, spacing,
 * and avoids breaking borderless custom report tables (.no-pdf-border, #printable-customer-statement-pdf).
 */
export function getPrintLayoutCssRules(
  containerSelector = '#printable-invoice, #printable-invoice-offscreen, #printable-exit-slip, .print-container, .standard-invoice-layout, .simple-invoice-layout',
  layout?: Partial<PrintLayoutSettings>
): string {
  const cfg: PrintLayoutSettings = { ...DEFAULT_PRINT_LAYOUT, ...(layout || {}) };
  const borderStyle = cfg.tableBorderStyle || 'bordered';

  let tableFrameCss = `border: var(--print-border-width, 1px) solid var(--print-border-color, #cbd5e1) !important;`;
  let thBorderCss = `border: var(--print-border-width, 1px) solid var(--print-border-color, #cbd5e1) !important;`;
  let tdBorderCss = `border: var(--print-border-width, 1px) solid var(--print-border-color, #cbd5e1) !important;`;

  if (borderStyle === 'striped') {
    tableFrameCss = `
      border-top: var(--print-border-width, 1px) solid var(--print-border-color, #cbd5e1) !important;
      border-bottom: var(--print-border-width, 1px) solid var(--print-border-color, #cbd5e1) !important;
      border-left: none !important;
      border-right: none !important;
    `;
    thBorderCss = `
      border-left: none !important;
      border-right: none !important;
      border-top: var(--print-border-width, 1px) solid var(--print-border-color, #cbd5e1) !important;
      border-bottom: var(--print-border-width, 1px) solid var(--print-border-color, #cbd5e1) !important;
    `;
    tdBorderCss = `
      border: none !important;
      border-bottom: 1px solid color-mix(in srgb, var(--print-border-color, #cbd5e1) 45%, transparent) !important;
    `;
  } else if (borderStyle === 'minimal') {
    tableFrameCss = `border: none !important;`;
    thBorderCss = `
      border: none !important;
      border-bottom: 2px solid var(--print-theme-color, #0f172a) !important;
    `;
    tdBorderCss = `
      border: none !important;
      border-bottom: 1px solid color-mix(in srgb, var(--print-border-color, #cbd5e1) 55%, transparent) !important;
    `;
  } else if (borderStyle === 'modern') {
    tableFrameCss = `border: var(--print-border-width, 1px) solid var(--print-border-color, #cbd5e1) !important;`;
    thBorderCss = `
      border-left: none !important;
      border-right: none !important;
      border-top: var(--print-border-width, 1px) solid var(--print-border-color, #cbd5e1) !important;
      border-bottom: 2px solid var(--print-theme-color, #0f172a) !important;
    `;
    tdBorderCss = `
      border-left: none !important;
      border-right: none !important;
      border-bottom: var(--print-border-width, 1px) solid var(--print-border-color, #cbd5e1) !important;
    `;
  }

  return `
    ${containerSelector} {
      font-size: var(--print-base-font-size, 12px) !important;
      line-height: 1.38 !important;
      background-color: var(--print-page-bg, #ffffff) !important;
      background: var(--print-page-bg, #ffffff) !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
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
      margin-bottom: var(--print-section-gap, 8px) !important;
    }
    ${containerSelector} .invoice-meta,
    ${containerSelector} .invoice-customer-card,
    ${containerSelector} .exit-slip-meta-grid {
      font-size: var(--print-header-meta-size, 11px) !important;
    }
    ${containerSelector} table:not(.no-pdf-border):not([style*="border: none"]):not([style*="border:none"]):not([style*="border: 0"]) {
      width: 100% !important;
      border-collapse: collapse !important;
      table-layout: auto !important;
      ${tableFrameCss}
    }
    ${containerSelector} table:not(.no-pdf-border) thead tr:not(.pdf-doc-header-row) th:not(.no-pdf-border):not(.pdf-doc-header-cell),
    ${containerSelector} table:not(.no-pdf-border) th:not(.no-pdf-border):not(.pdf-doc-header-cell) {
      font-size: var(--print-table-header-size, 11px) !important;
      padding-top: var(--print-table-row-py, 6px) !important;
      padding-bottom: var(--print-table-row-py, 6px) !important;
      padding-left: var(--print-table-cell-px, 8px) !important;
      padding-right: var(--print-table-cell-px, 8px) !important;
      ${thBorderCss}
      background-color: var(--print-header-bg, #f1f5f9) !important;
      background: var(--print-header-bg, #f1f5f9) !important;
      color: var(--print-header-text, #0f172a) !important;
      font-weight: 700 !important;
      vertical-align: middle !important;
      height: var(--print-table-header-h, 36px) !important;
      box-sizing: border-box !important;
    }
    ${containerSelector} table:not(.no-pdf-border) tbody tr {
      height: var(--print-table-row-min-h, 34px) !important;
      page-break-inside: avoid !important;
      break-inside: avoid !important;
      background-color: var(--print-body-bg, #ffffff) !important;
      background: var(--print-body-bg, #ffffff) !important;
    }
    ${containerSelector} table:not(.no-pdf-border) tbody tr:nth-child(even) {
      background-color: var(--print-zebra-bg, #f8fafc) !important;
      background: var(--print-zebra-bg, #f8fafc) !important;
    }
    ${containerSelector} table:not(.no-pdf-border) tbody td:not(.no-pdf-border) {
      font-size: var(--print-table-body-size, 11px) !important;
      padding-top: var(--print-table-row-py, 6px) !important;
      padding-bottom: var(--print-table-row-py, 6px) !important;
      padding-left: var(--print-table-cell-px, 8px) !important;
      padding-right: var(--print-table-cell-px, 8px) !important;
      ${tdBorderCss}
      height: var(--print-table-row-min-h, 34px) !important;
      min-height: var(--print-table-row-min-h, 34px) !important;
      vertical-align: middle !important;
      box-sizing: border-box !important;
      line-height: 1.4 !important;
      word-break: break-word !important;
      overflow-wrap: break-word !important;
    }
    ${containerSelector} .invoice-totals-box,
    ${containerSelector} .invoice-totals-box * {
      font-size: var(--print-totals-size, 13px) !important;
    }
    ${containerSelector} .invoice-notes,
    ${containerSelector} .invoice-footer-terms {
      font-size: var(--print-notes-size, 10px) !important;
    }
    ${containerSelector} .item-description,
    ${containerSelector} [data-item-description="true"] {
      font-size: var(--print-notes-size, 9.5px) !important;
      letter-spacing: normal !important;
      word-spacing: normal !important;
      line-height: 1.3 !important;
      direction: rtl !important;
      text-align: right !important;
    }
    ${containerSelector} .invoice-signatures,
    ${containerSelector} .exit-slip-signatures {
      min-height: var(--print-sig-height, 65px) !important;
      margin-top: var(--print-section-gap, 8px) !important;
    }
  `;
}
