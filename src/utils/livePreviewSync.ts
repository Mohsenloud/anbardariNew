import { PrintLayoutSettings, StoreSettings, DEFAULT_PRINT_LAYOUT } from '../types';

export interface LiveInvoiceDraft {
  invoiceNumber: string;
  date: string;
  dueDate?: string;
  isProforma?: boolean;
  type?: 'standard' | 'official' | 'thermal' | 'simple';
  customerName: string;
  customerPhone?: string;
  customerAddress?: string;
  customerNationalId?: string;
  items: Array<{
    id?: string;
    code?: string;
    productId?: string;
    productName: string;
    quantity: number;
    unit?: string;
    unitPrice: number;
    discount?: number;
    tax?: number;
    total: number;
    description?: string;
  }>;
  subtotal: number;
  totalDiscount: number;
  totalTax: number;
  finalTotal: number;
  notes?: string;
  paymentMethod?: string;
}

export interface LivePreviewSyncData {
  mode?: 'layout_config' | 'invoice_draft';
  config: PrintLayoutSettings;
  settings: StoreSettings;
  previewPageSize: 'a4' | 'a5';
  previewOrientation: 'portrait' | 'landscape';
  sampleNotes?: string;
  draftInvoice?: LiveInvoiceDraft;
  updatedAt: number;
}

const CHANNEL_NAME = 'sepehr_live_preview_channel';
const STORAGE_KEY = 'sepehr_live_preview_data';

let channel: BroadcastChannel | null = null;
try {
  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    channel = new BroadcastChannel(CHANNEL_NAME);
  }
} catch {
  channel = null;
}

/**
 * Broadcasts live preview data in real time to any listening windows/tabs
 */
export function broadcastLivePreview(data: LivePreviewSyncData): void {
  try {
    const payload = { ...data, updatedAt: Date.now() };
    if (channel) {
      channel.postMessage(payload);
    }
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    }
  } catch (err) {
    console.warn('Failed to broadcast live preview data:', err);
  }
}

/**
 * Retrieves the latest cached preview data
 */
export function getLatestLivePreviewData(): LivePreviewSyncData | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    }
  } catch {}
  return null;
}

/**
 * Subscribes to real-time live preview updates from any window
 */
export function subscribeLivePreview(onData: (data: LivePreviewSyncData) => void): () => void {
  const handleMessage = (e: MessageEvent) => {
    if (e.data && e.data.config) {
      onData(e.data);
    }
  };

  const handleStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY && e.newValue) {
      try {
        const parsed = JSON.parse(e.newValue);
        if (parsed && parsed.config) {
          onData(parsed);
        }
      } catch {}
    }
  };

  if (channel) {
    channel.addEventListener('message', handleMessage);
  }
  if (typeof window !== 'undefined') {
    window.addEventListener('storage', handleStorage);
  }

  // Immediately fire with current latest data if available
  const latest = getLatestLivePreviewData();
  if (latest) {
    onData(latest);
  }

  return () => {
    if (channel) {
      channel.removeEventListener('message', handleMessage);
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('storage', handleStorage);
    }
  };
}
