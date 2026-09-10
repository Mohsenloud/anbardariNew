import html2canvas from 'html2canvas-pro';
import jsPDF from 'jspdf';

/**
 * Exports a DOM element to an ultra-compact, high-speed, minimal-filesize A4 PDF.
 * Uses JPEG compression at 0.80 and internal stream compression to keep file size under ~120KB.
 */
export const exportElementToPdf = async (
  elementId: string,
  filename: string
): Promise<{ success: boolean; error?: string }> => {
  const element = document.getElementById(elementId);
  if (!element) {
    return { success: false, error: 'عنصر مورد نظر جهت تولید PDF یافت نشد.' };
  }

  try {
    // 1. Capture element with optimized scale (1.5x gives ~150 DPI which is crystal clear for text & borders without ballooning megabytes)
    const canvas = await html2canvas(element, {
      scale: 1.5,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      windowWidth: Math.max(element.scrollWidth, 800),
      onclone: (clonedDoc, clonedElement) => {
        clonedElement.style.overflow = 'visible';
        clonedElement.style.maxWidth = 'none';
        clonedElement.style.width = '780px';
        clonedElement.style.margin = '0 auto';
        clonedElement.style.boxShadow = 'none';
      },
    });

    // 2. Ultra-compressed JPEG dataURL (cuts 95%+ of the file size compared to raw PNG)
    const imgData = canvas.toDataURL('image/jpeg', 0.80);
    
    // 3. Create A4 PDF with Deflate compression enabled
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      compress: true,
    });

    const pageWidth = 210;
    const pageHeight = 297;
    const margin = 8; // 8mm margin
    const contentWidth = pageWidth - margin * 2;
    const contentHeight = (canvas.height * contentWidth) / canvas.width;

    if (contentHeight <= pageHeight - margin * 2) {
      // Single page
      pdf.addImage(imgData, 'JPEG', margin, margin, contentWidth, contentHeight, undefined, 'FAST');
    } else {
      // Multi-page handling
      let heightLeft = contentHeight;
      let position = margin;
      const usableHeight = pageHeight - margin * 2;

      pdf.addImage(imgData, 'JPEG', margin, position, contentWidth, contentHeight, undefined, 'FAST');
      heightLeft -= usableHeight;

      while (heightLeft > 0) {
        position = heightLeft - contentHeight + margin;
        pdf.addPage();
        pdf.addImage(imgData, 'JPEG', margin, position, contentWidth, contentHeight, undefined, 'FAST');
        heightLeft -= usableHeight;
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
 * Triggers direct browser printing synchronously within user gesture.
 * Applies temporary clean CSS scoping so only the target sheet prints.
 */
export const printElementDirectly = (elementId: string): boolean => {
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
    // Apply printing-active-element class to isolate the element on paper
    document.body.classList.add('printing-active-element');

    // Call window.print() synchronously inside user gesture
    window.print();

    // Clean up
    setTimeout(() => {
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
export const printElementInNewWindow = (elementId: string, title: string): boolean => {
  const element = document.getElementById(elementId);
  if (!element) return false;

  try {
    // Open a new standalone window
    const printWindow = window.open('', '_blank', 'width=920,height=800');
    if (!printWindow) {
      // If popup blocked, fallback to direct print
      return printElementDirectly(elementId);
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
            padding: 24px;
            background: #f8fafc;
            direction: rtl;
            color: #0f172a;
          }
          .print-wrapper {
            max-width: 800px;
            margin: 0 auto;
            background: #ffffff;
            border: 1px solid #cbd5e1;
            border-radius: 12px;
            padding: 28px;
            box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
          }
          .top-print-toolbar {
            max-width: 800px;
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
              size: A4 portrait;
              margin: 8mm;
            }
          }
        </style>
      </head>
      <body>
        <div class="top-print-toolbar no-print">
          <span style="font-size: 13px; font-weight: 500;">آماده‌سازی پیش‌نمایش چاپ برگه خروج انبار</span>
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
    return printElementDirectly(elementId);
  }
};
