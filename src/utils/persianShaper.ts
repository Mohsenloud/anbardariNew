import { jsPDF } from 'jspdf';
import { shape, render } from 'bidi-shaper';
import { installJsPdfShaper } from 'bidi-shaper/jspdf';

// 1. Initialize Arabic & Persian shaping plugin hook onto jsPDF API
try {
  if (jsPDF && (jsPDF as any).API) {
    installJsPdfShaper((jsPDF as any).API);
  }
} catch (err) {
  console.warn('Failed to register jsPDF Arabic/Persian shaper hook:', err);
}

// Regex to detect Persian/Arabic characters
const PERSIAN_ARABIC_REGEX = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;

/**
 * Shapes a Persian/Arabic string using contextual Arabic shaping (initial, medial, final, isolated forms).
 * This ensures that letters stay connected and cursive even when rendered across wrapped lines or canvas glyph passes.
 */
export function shapePersianText(text?: string | null): string {
  if (!text || typeof text !== 'string') return '';
  if (!PERSIAN_ARABIC_REGEX.test(text)) return text;
  try {
    return shape(text, { ligatures: true, tashkeel: 'keep' });
  } catch (err) {
    // Fallback to jsPDF.API.processArabic if available
    try {
      if ((jsPDF as any).API && typeof (jsPDF as any).API.processArabic === 'function') {
        return (jsPDF as any).API.processArabic(text);
      }
    } catch {}
    return text;
  }
}

/**
 * Fully renders bidirectional text into visual order with shaping (for direct canvas/PDF drawing).
 */
export function renderBidiPersianText(text?: string | null): string {
  if (!text || typeof text !== 'string') return '';
  if (!PERSIAN_ARABIC_REGEX.test(text)) return text;
  try {
    return render(text, {
      direction: 'rtl',
      shape: true,
      ligatures: true,
      mirror: true,
      paragraphs: 'split',
    });
  } catch {
    return shapePersianText(text);
  }
}

/**
 * Traverses an HTML DOM tree (such as the cloned element inside html2canvas capture)
 * and applies Arabic contextual shaping to all text nodes containing Persian/Arabic script.
 *
 * This permanently resolves the issue where html2canvas splits wrapping multi-line text
 * (like product descriptions) into single glyphs or disconnected letter tokens.
 */
export function shapeClonedElementText(root: Element): void {
  try {
    const ownerDoc = root.ownerDocument;
    if (!ownerDoc) return;

    // Fast-path: especially target item descriptions and notes
    const itemDescElements = root.querySelectorAll(
      '.item-description, [data-item-description="true"], .invoice-notes, .invoice-footer-terms, .exit-slip-terms'
    );
    itemDescElements.forEach((el) => {
      (el as HTMLElement).style.setProperty('letter-spacing', 'normal', 'important');
      (el as HTMLElement).style.setProperty('word-spacing', 'normal', 'important');
      (el as HTMLElement).style.setProperty('font-feature-settings', "'liga' 1, 'calt' 1", 'important');
      (el as HTMLElement).style.setProperty('text-rendering', 'optimizeLegibility', 'important');
      (el as HTMLElement).style.setProperty('direction', 'rtl', 'important');
      (el as HTMLElement).style.setProperty('text-align', 'right', 'important');
    });

    const walker = ownerDoc.createTreeWalker(
      root,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: (node: Node) => {
          const parent = node.parentElement;
          if (!parent) return NodeFilter.FILTER_REJECT;
          const tagName = parent.tagName.toUpperCase();
          if (tagName === 'SCRIPT' || tagName === 'STYLE' || tagName === 'NOSCRIPT') {
            return NodeFilter.FILTER_REJECT;
          }
          if (parent.classList.contains('no-print') || parent.classList.contains('no-pdf')) {
            return NodeFilter.FILTER_REJECT;
          }
          const val = node.nodeValue;
          if (!val || !val.trim() || !PERSIAN_ARABIC_REGEX.test(val)) {
            return NodeFilter.FILTER_SKIP;
          }
          return NodeFilter.FILTER_ACCEPT;
        },
      }
    );

    const nodesToShape: Text[] = [];
    let current = walker.nextNode();
    while (current) {
      nodesToShape.push(current as Text);
      current = walker.nextNode();
    }

    nodesToShape.forEach((textNode) => {
      if (textNode.nodeValue) {
        textNode.nodeValue = shapePersianText(textNode.nodeValue);
      }
    });
  } catch (err) {
    console.warn('Error applying Persian shaping to cloned element:', err);
  }
}
