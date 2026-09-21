import html2canvas from 'html2canvas-pro';
import jsPDF from 'jspdf';

export interface PdfExportOptions {
  pageSize?: 'a4' | 'a5';
  orientation?: 'portrait' | 'landscape';
}

/**
 * Exports a DOM element to an ultra-compact, high-speed, minimal-filesize PDF.
 * Supports configurable page format (A4 or A5) and orientation (portrait or landscape).
 * Uses JPEG compression at 0.80 and internal stream compression to keep file size under ~120KB.
 */
export const exportElementToPdf = async (
  elementId: string,
  filename: string,
  options?: PdfExportOptions
): Promise<{ success: boolean; error?: string }> => {
  const element = document.getElementById(elementId);
  if (!element) {
    return { success: false, error: 'عنصر مورد نظر جهت تولید PDF یافت نشد.' };
  }

  const paperSize = options?.pageSize || 'a4';
  const orientation = options?.orientation || 'portrait';
  const targetWidthPx = 
    paperSize === 'a5'
      ? (orientation === 'landscape' ? 780 : 560)
      : (orientation === 'landscape' ? 1080 : 820);

  try {
    // 1. Capture element with unclipped height and properly aligned coordinates
    const canvas = await html2canvas(element, {
      scale: 2.0,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      windowWidth: Math.max(1280, targetWidthPx + 200),
      windowHeight: 4000,
      onclone: (clonedDoc, clonedElement) => {
        // Reset scroll in cloned window
        if (clonedDoc.defaultView) {
          clonedDoc.defaultView.scrollTo(0, 0);
        }

        // Force cloned element itself to have auto height, full specified width, and zero clipping
        clonedElement.style.setProperty('height', 'auto', 'important');
        clonedElement.style.setProperty('max-height', 'none', 'important');
        clonedElement.style.setProperty('min-height', 'auto', 'important');
        clonedElement.style.setProperty('overflow', 'visible', 'important');
        clonedElement.style.setProperty('width', `${targetWidthPx}px`, 'important');
        clonedElement.style.setProperty('max-width', `${targetWidthPx}px`, 'important');
        clonedElement.style.setProperty('min-width', `${targetWidthPx}px`, 'important');
        clonedElement.style.setProperty('box-sizing', 'border-box', 'important');
        clonedElement.style.setProperty('margin', '0 auto', 'important');
        clonedElement.style.setProperty('box-shadow', 'none', 'important');
        clonedElement.style.setProperty('direction', 'rtl', 'important');

        // Unconstrain all ancestors up to body/html to prevent modal scroll container clipping
        let cur: HTMLElement | null = clonedElement.parentElement;
        while (cur && cur !== clonedDoc.body) {
          cur.style.setProperty('overflow', 'visible', 'important');
          cur.style.setProperty('max-height', 'none', 'important');
          cur.style.setProperty('height', 'auto', 'important');
          cur.style.setProperty('position', 'static', 'important');
          cur.style.setProperty('transform', 'none', 'important');
          cur = cur.parentElement;
        }

        if (clonedDoc.body) {
          clonedDoc.body.style.setProperty('overflow', 'visible', 'important');
          clonedDoc.body.style.setProperty('max-height', 'none', 'important');
          clonedDoc.body.style.setProperty('height', 'auto', 'important');
          clonedDoc.body.style.setProperty('position', 'static', 'important');
          clonedDoc.body.style.setProperty('margin', '0', 'important');
          clonedDoc.body.style.setProperty('padding', '0', 'important');
        }
        if (clonedDoc.documentElement) {
          clonedDoc.documentElement.style.setProperty('overflow', 'visible', 'important');
          clonedDoc.documentElement.style.setProperty('max-height', 'none', 'important');
          clonedDoc.documentElement.style.setProperty('height', 'auto', 'important');
        }

        // Un-clip any horizontal or vertical scroll/overflow wrappers inside
        const scrollContainers = clonedElement.querySelectorAll('.overflow-x-auto, .overflow-y-auto, [class*="overflow"]');
        scrollContainers.forEach((el) => {
          (el as HTMLElement).style.setProperty('overflow', 'visible', 'important');
          (el as HTMLElement).style.setProperty('max-height', 'none', 'important');
          (el as HTMLElement).style.setProperty('height', 'auto', 'important');
        });

        // Ensure all tables occupy full width without truncation
        const tables = clonedElement.querySelectorAll('table');
        tables.forEach((tbl) => {
          (tbl as HTMLElement).style.setProperty('width', '100%', 'important');
          (tbl as HTMLElement).style.setProperty('min-width', '100%', 'important');
          (tbl as HTMLElement).style.setProperty('table-layout', 'auto', 'important');
        });

        // Ensure 3-column signature boxes render side-by-side
        const sigs = clonedElement.querySelector('.exit-slip-signatures');
        if (sigs) {
          (sigs as HTMLElement).style.setProperty('display', 'grid', 'important');
          (sigs as HTMLElement).style.setProperty('grid-template-columns', 'repeat(3, minmax(0, 1fr))', 'important');
          (sigs as HTMLElement).style.setProperty('gap', '10px', 'important');
        }

        // Ensure 2-column info cards render side-by-side
        const infoDeck = clonedElement.querySelector('.exit-slip-info-deck');
        if (infoDeck) {
          (infoDeck as HTMLElement).style.setProperty('display', 'grid', 'important');
          (infoDeck as HTMLElement).style.setProperty('grid-template-columns', 'repeat(2, minmax(0, 1fr))', 'important');
          (infoDeck as HTMLElement).style.setProperty('gap', '10px', 'important');
        }

        // Ensure terms render 2 columns
        const termsGrid = clonedElement.querySelector('.exit-slip-terms-grid');
        if (termsGrid) {
          (termsGrid as HTMLElement).style.setProperty('display', 'grid', 'important');
          (termsGrid as HTMLElement).style.setProperty('grid-template-columns', 'repeat(2, minmax(0, 1fr))', 'important');
        }
      },
    });

    // 2. High-quality JPEG dataURL
    const imgData = canvas.toDataURL('image/jpeg', 0.95);
    
    // 3. Create PDF with Deflate compression enabled and user-chosen format/orientation (default A4 portrait)
    const pdf = new jsPDF({
      orientation: orientation,
      unit: 'mm',
      format: paperSize,
      compress: true,
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = paperSize === 'a5' ? 4 : 7; // Clean margins: 4mm for A5, 7mm for A4
    const usableWidth = pageWidth - margin * 2;
    const usableHeight = pageHeight - margin * 2;
    const contentWidth = usableWidth;
    const contentHeight = (canvas.height * contentWidth) / canvas.width;

    if (contentHeight <= usableHeight) {
      // Content fits naturally on a single page
      pdf.addImage(imgData, 'JPEG', margin, margin, contentWidth, contentHeight, undefined, 'FAST');
    } else if (paperSize === 'a5' || contentHeight <= usableHeight * 1.95) {
      // Auto-fit to single page: scale proportionally so ALL data (header, items, terms, signatures) fits on one single sheet
      const scale = usableHeight / contentHeight;
      const fittedWidth = contentWidth * scale;
      const fittedHeight = usableHeight;
      const offsetX = margin + (usableWidth - fittedWidth) / 2;
      pdf.addImage(imgData, 'JPEG', offsetX, margin, fittedWidth, fittedHeight, undefined, 'FAST');
    } else {
      // True multi-page canvas slicing (prevents any data clipping or jsPDF drawing bugs)
      const pxPerMm = canvas.width / contentWidth;
      const sliceHeightPx = Math.floor(usableHeight * pxPerMm);
      let yOffsetPx = 0;
      let isFirstPage = true;

      while (yOffsetPx < canvas.height) {
        if (!isFirstPage) {
          pdf.addPage();
        }
        const currentSliceHeightPx = Math.min(sliceHeightPx, canvas.height - yOffsetPx);
        const sliceCanvas = document.createElement('canvas');
        sliceCanvas.width = canvas.width;
        sliceCanvas.height = currentSliceHeightPx;
        const sliceCtx = sliceCanvas.getContext('2d');
        if (sliceCtx) {
          sliceCtx.fillStyle = '#ffffff';
          sliceCtx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
          sliceCtx.drawImage(
            canvas,
            0,
            yOffsetPx,
            canvas.width,
            currentSliceHeightPx,
            0,
            0,
            canvas.width,
            currentSliceHeightPx
          );
          const sliceImgData = sliceCanvas.toDataURL('image/jpeg', 0.95);
          const sliceHeightMm = (currentSliceHeightPx * contentWidth) / canvas.width;
          pdf.addImage(sliceImgData, 'JPEG', margin, margin, contentWidth, sliceHeightMm, undefined, 'FAST');
        }
        yOffsetPx += sliceHeightPx;
        isFirstPage = false;
      }
    }

    const safeFilename = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;
    pdf.save(safeFilename);
    return { success: true };
  } catch (err: any) {
    console.error('PDF export error:', err);
    return { success: false, error: err?.message || 'خطا در تبدیل و دانلود PDF' };
  }
};

/**
 * Generates an ultra-compact PDF Blob and File without forcing immediate save,
 * making it possible to share the file directly via Web Share API or attach to messengers.
 */
export const generatePdfBlob = async (
  elementId: string,
  filename: string,
  options?: PdfExportOptions
): Promise<{ success: boolean; blob?: Blob; file?: File; error?: string }> => {
  const element = document.getElementById(elementId);
  if (!element) {
    return { success: false, error: 'عنصر مورد نظر جهت تولید PDF یافت نشد.' };
  }

  const paperSize = options?.pageSize || 'a4';
  const orientation = options?.orientation || 'portrait';
  const targetWidthPx = 
    paperSize === 'a5'
      ? (orientation === 'landscape' ? 780 : 560)
      : (orientation === 'landscape' ? 1080 : 820);

  try {
    const canvas = await html2canvas(element, {
      scale: 2.0,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      windowWidth: Math.max(1280, targetWidthPx + 200),
      windowHeight: 4000,
      onclone: (clonedDoc, clonedElement) => {
        if (clonedDoc.defaultView) {
          clonedDoc.defaultView.scrollTo(0, 0);
        }

        clonedElement.style.setProperty('height', 'auto', 'important');
        clonedElement.style.setProperty('max-height', 'none', 'important');
        clonedElement.style.setProperty('min-height', 'auto', 'important');
        clonedElement.style.setProperty('overflow', 'visible', 'important');
        clonedElement.style.setProperty('width', `${targetWidthPx}px`, 'important');
        clonedElement.style.setProperty('max-width', `${targetWidthPx}px`, 'important');
        clonedElement.style.setProperty('min-width', `${targetWidthPx}px`, 'important');
        clonedElement.style.setProperty('box-sizing', 'border-box', 'important');
        clonedElement.style.setProperty('margin', '0 auto', 'important');
        clonedElement.style.boxShadow = 'none';
        clonedElement.style.setProperty('direction', 'rtl', 'important');

        let cur: HTMLElement | null = clonedElement.parentElement;
        while (cur && cur !== clonedDoc.body) {
          cur.style.setProperty('overflow', 'visible', 'important');
          cur.style.setProperty('max-height', 'none', 'important');
          cur.style.setProperty('height', 'auto', 'important');
          cur.style.setProperty('position', 'static', 'important');
          cur.style.setProperty('transform', 'none', 'important');
          cur = cur.parentElement;
        }

        if (clonedDoc.body) {
          clonedDoc.body.style.setProperty('overflow', 'visible', 'important');
          clonedDoc.body.style.setProperty('max-height', 'none', 'important');
          clonedDoc.body.style.setProperty('height', 'auto', 'important');
          clonedDoc.body.style.setProperty('position', 'static', 'important');
          clonedDoc.body.style.setProperty('margin', '0', 'important');
          clonedDoc.body.style.setProperty('padding', '0', 'important');
        }
        if (clonedDoc.documentElement) {
          clonedDoc.documentElement.style.setProperty('overflow', 'visible', 'important');
          clonedDoc.documentElement.style.setProperty('max-height', 'none', 'important');
          clonedDoc.documentElement.style.setProperty('height', 'auto', 'important');
        }

        const scrollContainers = clonedElement.querySelectorAll('.overflow-x-auto, .overflow-y-auto, [class*="overflow"]');
        scrollContainers.forEach((el) => {
          (el as HTMLElement).style.setProperty('overflow', 'visible', 'important');
          (el as HTMLElement).style.setProperty('max-height', 'none', 'important');
          (el as HTMLElement).style.setProperty('height', 'auto', 'important');
        });

        const tables = clonedElement.querySelectorAll('table');
        tables.forEach((tbl) => {
          (tbl as HTMLElement).style.setProperty('width', '100%', 'important');
          (tbl as HTMLElement).style.setProperty('min-width', '100%', 'important');
          (tbl as HTMLElement).style.setProperty('table-layout', 'auto', 'important');
        });

        const sigs = clonedElement.querySelector('.exit-slip-signatures');
        if (sigs) {
          (sigs as HTMLElement).style.setProperty('display', 'grid', 'important');
          (sigs as HTMLElement).style.setProperty('grid-template-columns', 'repeat(3, minmax(0, 1fr))', 'important');
          (sigs as HTMLElement).style.setProperty('gap', '10px', 'important');
        }

        const infoDeck = clonedElement.querySelector('.exit-slip-info-deck');
        if (infoDeck) {
          (infoDeck as HTMLElement).style.setProperty('display', 'grid', 'important');
          (infoDeck as HTMLElement).style.setProperty('grid-template-columns', 'repeat(2, minmax(0, 1fr))', 'important');
          (infoDeck as HTMLElement).style.setProperty('gap', '10px', 'important');
        }

        const termsGrid = clonedElement.querySelector('.exit-slip-terms-grid');
        if (termsGrid) {
          (termsGrid as HTMLElement).style.setProperty('display', 'grid', 'important');
          (termsGrid as HTMLElement).style.setProperty('grid-template-columns', 'repeat(2, minmax(0, 1fr))', 'important');
        }
      },
    });

    const imgData = canvas.toDataURL('image/jpeg', 0.95);
    const pdf = new jsPDF({
      orientation: orientation,
      unit: 'mm',
      format: paperSize,
      compress: true,
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = paperSize === 'a5' ? 4 : 7;
    const usableWidth = pageWidth - margin * 2;
    const usableHeight = pageHeight - margin * 2;
    const contentWidth = usableWidth;
    const contentHeight = (canvas.height * contentWidth) / canvas.width;

    if (contentHeight <= usableHeight) {
      pdf.addImage(imgData, 'JPEG', margin, margin, contentWidth, contentHeight, undefined, 'FAST');
    } else if (paperSize === 'a5' || contentHeight <= usableHeight * 1.95) {
      const scale = usableHeight / contentHeight;
      const fittedWidth = contentWidth * scale;
      const fittedHeight = usableHeight;
      const offsetX = margin + (usableWidth - fittedWidth) / 2;
      pdf.addImage(imgData, 'JPEG', offsetX, margin, fittedWidth, fittedHeight, undefined, 'FAST');
    } else {
      const pxPerMm = canvas.width / contentWidth;
      const sliceHeightPx = Math.floor(usableHeight * pxPerMm);
      let yOffsetPx = 0;
      let isFirstPage = true;

      while (yOffsetPx < canvas.height) {
        if (!isFirstPage) {
          pdf.addPage();
        }
        const currentSliceHeightPx = Math.min(sliceHeightPx, canvas.height - yOffsetPx);
        const sliceCanvas = document.createElement('canvas');
        sliceCanvas.width = canvas.width;
        sliceCanvas.height = currentSliceHeightPx;
        const sliceCtx = sliceCanvas.getContext('2d');
        if (sliceCtx) {
          sliceCtx.fillStyle = '#ffffff';
          sliceCtx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
          sliceCtx.drawImage(
            canvas,
            0,
            yOffsetPx,
            canvas.width,
            currentSliceHeightPx,
            0,
            0,
            canvas.width,
            currentSliceHeightPx
          );
          const sliceImgData = sliceCanvas.toDataURL('image/jpeg', 0.95);
          const sliceHeightMm = (currentSliceHeightPx * contentWidth) / canvas.width;
          pdf.addImage(sliceImgData, 'JPEG', margin, margin, contentWidth, sliceHeightMm, undefined, 'FAST');
        }
        yOffsetPx += sliceHeightPx;
        isFirstPage = false;
      }
    }

    const safeFilename = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;
    const blob = pdf.output('blob');
    let file: File | undefined;
    try {
      file = new File([blob], safeFilename, { type: 'application/pdf' });
    } catch {
      // In environments where File constructor is restricted
    }
    return { success: true, blob, file };
  } catch (err: any) {
    console.error('PDF generation error:', err);
    return { success: false, error: err?.message || 'خطا در ایجاد فایل PDF' };
  }
};

/**
 * Triggers direct browser printing synchronously within user gesture.
 * Applies temporary clean CSS scoping so only the target sheet prints.
 */
export const printElementDirectly = (
  elementId: string,
  options?: PdfExportOptions
): boolean => {
  const paperSize = options?.pageSize || 'a4';
  const orientation = options?.orientation || 'portrait';
  const marginMm = paperSize === 'a5' ? 5 : 8;

  const element = document.getElementById(elementId);
  if (!element) {
    try {
      window.print();
      return true;
    } catch {
      return false;
    }
  }

  try {
    const existingStyle = document.getElementById('dynamic-direct-print-page-style');
    if (existingStyle) existingStyle.remove();

    const styleEl = document.createElement('style');
    styleEl.id = 'dynamic-direct-print-page-style';
    styleEl.innerHTML = `
      @media print {
        @page {
          size: ${paperSize.toUpperCase()} ${orientation} !important;
          margin: ${marginMm}mm !important;
        }
      }
    `;
    document.head.appendChild(styleEl);

    // Apply printing-active-element class to isolate the element on paper
    document.body.classList.add('printing-active-element');

    // Call window.print() synchronously inside user gesture
    window.print();

    // Clean up
    setTimeout(() => {
      styleEl.remove();
      document.body.classList.remove('printing-active-element');
    }, 1500);

    return true;
  } catch (err) {
    console.warn('Direct print error:', err);
    document.body.classList.remove('printing-active-element');
    return false;
  }
};

/**
 * Opens a dedicated top-level print window and immediately displays the browser's printer dialog.
 * This completely bypasses any iframe sandbox restrictions (e.g., missing allow-modals in preview containers).
 */
export const printElementInNewWindow = (
  elementId: string,
  title: string,
  options?: PdfExportOptions
): boolean => {
  const element = document.getElementById(elementId);
  if (!element) return false;

  const paperSize = options?.pageSize || 'a4';
  const orientation = options?.orientation || 'portrait';
  const marginMm = paperSize === 'a5' ? 5 : 8;
  const targetWidthPx = 
    paperSize === 'a5'
      ? (orientation === 'landscape' ? 760 : 540)
      : (orientation === 'landscape' ? 1060 : 800);

  try {
    // Open a new standalone window
    const windowWidth = orientation === 'landscape' ? 1160 : 920;
    const printWindow = window.open('', '_blank', `width=${windowWidth},height=800`);
    if (!printWindow) {
      // If popup blocked, fallback to direct print
      return printElementDirectly(elementId, options);
    }

    // Collect all stylesheets from main document
    const styles = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
      .map((s) => s.outerHTML)
      .join('\n');

    printWindow.document.open();
    printWindow.document.write(`
      <!DOCTYPE html>
      <html dir="rtl" lang="fa">
      <head>
        <meta charset="utf-8" />
        <title>${title}</title>
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Vazirmatn:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
        ${styles}
        <style>
          * {
            box-sizing: border-box;
            font-family: 'Vazirmatn', -apple-system, BlinkMacSystemFont, sans-serif !important;
          }
          body {
            margin: 0;
            padding: ${paperSize === 'a5' ? '12px' : '24px'};
            background: #f8fafc;
            direction: rtl;
            color: #0f172a;
          }
          .print-wrapper {
            max-width: ${targetWidthPx}px;
            margin: 0 auto;
            background: #ffffff;
            border: 1px solid #cbd5e1;
            border-radius: 12px;
            padding: ${paperSize === 'a5' ? '14px' : '24px'};
            box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
          }
          .top-print-toolbar {
            max-width: ${targetWidthPx}px;
            margin: 0 auto 16px auto;
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 10px 16px;
            background: #0f172a;
            color: #ffffff;
            border-radius: 8px;
          }
          .top-print-btn {
            background: #10b981;
            color: #ffffff;
            border: none;
            padding: 8px 16px;
            border-radius: 6px;
            font-size: 14px;
            font-weight: bold;
            cursor: pointer;
          }
          @page {
            size: ${paperSize.toUpperCase()} ${orientation};
            margin: ${marginMm}mm;
          }
          @media print {
            body {
              background: #ffffff !important;
              padding: 0 !important;
              margin: 0 !important;
            }
            .no-print, .top-print-toolbar {
              display: none !important;
            }
            .print-wrapper {
              border: none !important;
              border-radius: 0 !important;
              padding: 0 !important;
              max-width: 100% !important;
              box-shadow: none !important;
            }
            @page {
              size: ${paperSize.toUpperCase()} ${orientation};
              margin: ${marginMm}mm;
            }
          }
        </style>
      </head>
      <body>
        <div class="top-print-toolbar no-print">
          <span style="font-size: 13px; font-weight: 500;">آماده‌سازی پیش‌نمایش چاپ برگه خروج (${paperSize.toUpperCase()} ${orientation === 'portrait' ? 'عمودی' : 'افقی'})</span>
          <button class="top-print-btn" onclick="window.print()">باز کردن پرینتر (Print)</button>
        </div>
        <div class="print-wrapper">
          ${element.innerHTML}
        </div>
        <script>
          // Automatically trigger the printer dialog once loaded
          window.addEventListener('load', function() {
            setTimeout(function() {
              window.focus();
              window.print();
            }, 300);
          });
        </script>
      </body>
      </html>
    `);
    printWindow.document.close();
    return true;
  } catch (err) {
    console.warn('Print in new window error, falling back to direct print:', err);
    return printElementDirectly(elementId, options);
  }
};
