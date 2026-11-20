export interface ConfirmDialogOptions {
  title?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'info';
}

export interface PendingConfirmRequest {
  message: string;
  options: ConfirmDialogOptions;
  resolve: (confirmed: boolean) => void;
}

type ConfirmListener = (req: PendingConfirmRequest | null) => void;

let activeListener: ConfirmListener | null = null;
const queue: PendingConfirmRequest[] = [];
let currentRequest: PendingConfirmRequest | null = null;

function flushNext() {
  if (currentRequest || queue.length === 0) return;
  currentRequest = queue.shift() || null;
  if (activeListener) {
    activeListener(currentRequest);
  }
}

export function subscribeConfirmDialog(listener: ConfirmListener): () => void {
  activeListener = listener;
  if (currentRequest) {
    listener(currentRequest);
  } else {
    flushNext();
  }
  return () => {
    if (activeListener === listener) {
      activeListener = null;
    }
  };
}

export function resolveCurrentConfirm(confirmed: boolean) {
  const req = currentRequest;
  currentRequest = null;
  if (activeListener) {
    activeListener(null);
  }
  if (req) {
    req.resolve(confirmed);
  }
  flushNext();
}

/**
 * In-app asynchronous confirmation dialog replacing native window.confirm()
 * (works reliably inside iframes and mobile PWAs).
 */
export function confirmAction(message: string, options: ConfirmDialogOptions = {}): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    queue.push({ message, options, resolve });
    flushNext();
  });
}
