/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { Product, Customer, Invoice, StockMovement, StoreSettings, AppUser, PurchaseInvoice, InboundReceipt, InboundReceiptItem, InboundReceiptStatus, CustomerTransaction, PaymentMethod } from './types';
import { StorageService } from './utils/storage';
import {
  AUTH_EXPIRED_EVENT,
  fetchAuthBootstrap,
  hasAuthToken,
  logoutFromServer,
  verifySessionWithServer,
} from './utils/authClient';
import { getCurrentJalaliDate } from './utils/jalali';
import {
  isTabPermitted,
  getDefaultTabForUser,
  getRoleBadgeConfig,
  isReadOnlyUser,
  canUserCreateSalesInvoice,
  canUserDeleteInvoice,
  canUserSettleInvoice,
  canUserModifyCustomers,
} from './utils/permissions';
import { ConfirmDialogHost } from './components/ConfirmDialogHost';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { InvoiceBuilder } from './components/InvoiceBuilder';
import { InvoicesList } from './components/InvoicesList';
import { InventoryManager } from './components/InventoryManager';
import { QuickDashboard } from './components/QuickDashboard';
import { PurchaseInvoiceManager } from './components/PurchaseInvoiceManager';
import { CustomersManager } from './components/CustomersManager';
import { CustomerPaymentsLedger } from './components/CustomerPaymentsLedger';
import { ReportsDashboard } from './components/ReportsDashboard';
import { InvoiceViewModal } from './components/InvoiceViewModal';
import { SettingsModal } from './components/SettingsModal';
import { AdminPanel } from './components/AdminPanel';
import { MobileBottomNav } from './components/MobileBottomNav';
import { UserLoginModal } from './components/UserLoginModal';
import { LoginScreen } from './components/LoginScreen';
import { OfflineIndicator } from './components/OfflineIndicator';
import { MobileFloatingPWAInstall } from './components/MobileFloatingPWAInstall';
import { ErrorBoundary } from './components/ErrorBoundary';
import { 
  autoSendInvoiceReportToTelegram, 
  autoSendInvoicePdfToTelegram,
  autoSendInboundReceiptReportToTelegram, 
  autoSendExitSlipReportToTelegram,
  autoSendPurchaseInvoiceReportToTelegram,
  autoSendCustomerPaymentReportToTelegram,
  autoSendSupplierPaymentReportToTelegram
} from './utils/telegramService';
import { PublicWebInvoiceView } from './components/PublicWebInvoiceView';
import { StandaloneLivePreviewView } from './components/StandaloneLivePreviewView';
import { InvoiceShareLinkModal } from './components/InvoiceShareLinkModal';
import { CheckCircle2, ShieldAlert } from 'lucide-react';
import { isPureServiceInvoice, hasPhysicalGoods } from './utils/serviceHelper';

export default function App() {
  // Detection for Public Customer Web Invoice view (/v/:token or ?v=:token or #/v/:token)
  const detectPublicToken = (): string | null => {
    if (typeof window === 'undefined') return null;
    const pathname = window.location.pathname;
    const matchPath = pathname.match(/^\/(?:v|invoice)\/([a-zA-Z0-9_-]+)/);
    if (matchPath && matchPath[1]) return matchPath[1];

    const urlParams = new URLSearchParams(window.location.search);
    const paramToken = urlParams.get('v') || urlParams.get('inv') || urlParams.get('token');
    if (paramToken) return paramToken.trim();

    const matchHash = window.location.hash.match(/^#\/(?:v|invoice)\/([a-zA-Z0-9_-]+)/);
    if (matchHash && matchHash[1]) return matchHash[1];

    return null;
  };

  // Detection for Standalone Live Preview in separate window / tab (?live-preview=1 or #live-preview)
  const detectLivePreview = (): boolean => {
    if (typeof window === 'undefined') return false;
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('live-preview') || urlParams.get('preview-window')) return true;
    if (window.location.hash.includes('live-preview')) return true;
    if (window.location.pathname.includes('/live-preview')) return true;
    return false;
  };

  const [publicInvoiceToken, setPublicInvoiceToken] = useState<string | null>(detectPublicToken);
  const [isStandalonePreview, setIsStandalonePreview] = useState<boolean>(detectLivePreview);
  const [appShareLinkInvoice, setAppShareLinkInvoice] = useState<Invoice | null>(null);

  useEffect(() => {
    const handlePopState = () => {
      setPublicInvoiceToken(detectPublicToken());
      setIsStandalonePreview(detectLivePreview());
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);
  // Application Data States
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [customerTransactions, setCustomerTransactions] = useState<CustomerTransaction[]>([]);
  const [purchaseInvoices, setPurchaseInvoices] = useState<PurchaseInvoice[]>([]);
  const [inboundReceipts, setInboundReceipts] = useState<InboundReceipt[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [settings, setSettings] = useState<StoreSettings>(StorageService.getSettings());
  const [users, setUsers] = useState<AppUser[]>([]);
  const [currentUser, setCurrentUser] = useState<AppUser | null>(() => StorageService.getLoggedInUser());

  // UI State
  const [activeTab, setActiveTab] = useState<string>(() => {
    const saved = localStorage.getItem('sepehr_last_tab');
    return saved || 'dashboard';
  });
  const [inventorySubTab, setInventorySubTab] = useState<'items' | 'inbound-receipts' | 'exit-slips' | 'direct-transfers' | 'movements'>(() => {
    const saved = localStorage.getItem('sepehr_inventory_subtab');
    return (saved as any) || 'items';
  });
  const [selectedInboundReceiptId, setSelectedInboundReceiptId] = useState<string | null>(null);
  const [viewingInvoice, setViewingInvoice] = useState<Invoice | null>(null);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(() => {
    try {
      const savedId = localStorage.getItem('sepehr_editing_invoice_id');
      if (savedId) {
        const allInvs = StorageService.getInvoices();
        const found = allInvs.find((i) => i.id === savedId);
        if (found) return found;
      }
    } catch {}
    return null;
  });
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState<boolean>(false);
  const [loginTargetUser, setLoginTargetUser] = useState<AppUser | null>(null);
  const [toastMessage, setToastMessage] = useState<string>('');
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState<boolean>(false);
  const [isDesktopSidebarCollapsed, setIsDesktopSidebarCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('sepehr_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  const handleToggleSidebar = () => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setIsMobileSidebarOpen((prev) => !prev);
    } else {
      setIsDesktopSidebarCollapsed((prev) => {
        const next = !prev;
        try {
          localStorage.setItem('sepehr_sidebar_collapsed', String(next));
        } catch {}
        return next;
      });
    }
  };

  const handleToggleDesktopSidebarCollapse = () => {
    setIsDesktopSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('sepehr_sidebar_collapsed', String(next));
      } catch {}
      return next;
    });
  };

  // Load initial data - preserves authenticated user session across page reloads
  const loadData = (preserveCurrentUser = true) => {
    setProducts(StorageService.getProducts());
    setCustomers(StorageService.getCustomers());
    setInvoices(StorageService.getInvoices());
    setCustomerTransactions(StorageService.getCustomerTransactions());
    setPurchaseInvoices(StorageService.getPurchaseInvoices());
    setInboundReceipts(StorageService.getInboundReceipts());
    setMovements(StorageService.getMovements());
    setSettings(StorageService.getSettings());
    const loadedUsers = StorageService.getUsers();
    setUsers(loadedUsers);

    if (preserveCurrentUser) {
      setCurrentUser((prev) => {
        const target = prev || StorageService.getLoggedInUser();
        if (!target) return null;
        return loadedUsers.find((u) => u.id === target.id && u.isActive) || null;
      });
    }
  };

  // Sync active tab to localStorage for seamless refresh restoration
  useEffect(() => {
    if (activeTab) {
      localStorage.setItem('sepehr_last_tab', activeTab);
    }
  }, [activeTab]);

  useEffect(() => {
    if (inventorySubTab) {
      localStorage.setItem('sepehr_inventory_subtab', inventorySubTab);
    }
  }, [inventorySubTab]);

  useEffect(() => {
    if (editingInvoice) {
      localStorage.setItem('sepehr_editing_invoice_id', editingInvoice.id);
    } else {
      localStorage.removeItem('sepehr_editing_invoice_id');
    }
  }, [editingInvoice]);

  useEffect(() => {
    // Initial app opening: load cached data & verify server auth session
    loadData(true);

    // Subscribe to all local/sync changes
    const unsubStorage = StorageService.subscribe(() => {
      loadData(true);
    });

    const triggerSync = () => {
      if (!hasAuthToken()) return;
      StorageService.syncFromServer().then((updated) => {
        if (updated) loadData(true);
      });
    };

    // Listen for server 401 session expiration events
    const onAuthExpired = () => {
      StorageService.logout();
      setCurrentUser(null);
      setIsLoginModalOpen(false);
      setLoginTargetUser(null);
      showToast('نشست کاربری شما منقضی شده است. لطفاً مجدداً وارد شوید.');
    };
    window.addEventListener(AUTH_EXPIRED_EVENT, onAuthExpired);

    // Verify existing session with server (or load public branding for login screen)
    const cachedUser = StorageService.getLoggedInUser();
    if (cachedUser) {
      verifySessionWithServer().then((res) => {
        if (res.valid && res.user) {
          setCurrentUser(res.user);
          StorageService.setCurrentUser(res.user);
          StorageService.syncFromServer(true).then(() => loadData(true));
        } else if (!res.networkError) {
          // Stale or pre-hardening localStorage session without valid server token
          StorageService.logout();
          setCurrentUser(null);
          fetchAuthBootstrap().then((branding) => {
            if (branding) {
              setSettings((prev) => ({ ...prev, ...branding }));
            }
          });
        }
      });
    } else {
      fetchAuthBootstrap().then((branding) => {
        if (branding) {
          setSettings((prev) => ({ ...prev, ...branding }));
        }
      });
    }

    // Fast background synchronization every 4 seconds for instant multi-device collaboration
    const syncInterval = setInterval(triggerSync, 4000);

    const onFocus = () => triggerSync();
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        triggerSync();
      }
    };
    const onOnline = () => triggerSync();

    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('online', onOnline);

    return () => {
      unsubStorage();
      clearInterval(syncInterval);
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }
      window.removeEventListener(AUTH_EXPIRED_EVENT, onAuthExpired);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('online', onOnline);
    };
  }, []);

  // Enforce tab access permissions whenever user, activeTab, or settings change
  useEffect(() => {
    if (currentUser) {
      if (!isTabPermitted(activeTab, currentUser, settings)) {
        const safeLanding = getDefaultTabForUser(currentUser, settings);
        if (safeLanding && safeLanding !== activeTab) {
          setActiveTab(safeLanding);
        }
      }
    }
  }, [currentUser, settings, activeTab]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = setTimeout(() => {
      setToastMessage('');
      toastTimerRef.current = null;
    }, 3500);
  };

  // 1. INVOICE SAVE WITH AUTOMATIC STOCK DEDUCTION (پیش‌فاکتورها کسر از انبار ندارند)
  const handleSaveInvoice = (newInvoice: Invoice, shouldPrint: boolean) => {
    if (currentUser && !canUserCreateSalesInvoice(currentUser)) {
      showToast('دسترسی غیرمجاز: سمت کاربری شما مجوز صدور فاکتور فروش را ندارد.');
      return;
    }
    // 1. Update Invoices list
    const updatedInvoices = [newInvoice, ...invoices];
    setInvoices(updatedInvoices);

    let currentProducts = [...products];
    let updatedMovements = [...movements];
    const newMovements: StockMovement[] = [];
    const today = getCurrentJalaliDate();

    // 2. If auto-deduct is enabled and NOT a proforma, decrement inventory stock and record movements
    if (settings.autoDeductStock && !newInvoice.isProforma) {
      newInvoice.items.forEach((item) => {
        const prodIndex = currentProducts.findIndex((p) => p.id === item.productId);
        if (prodIndex !== -1) {
          const prod = currentProducts[prodIndex];
          const hasVariants = !!prod.hasVariants && Array.isArray(prod.variants) && prod.variants.length > 0;
          let updatedVariants = hasVariants ? [...(prod.variants || [])] : undefined;
          let variantLabel = '';

          if (hasVariants && updatedVariants && item.variantId) {
            updatedVariants = updatedVariants.map((v) => {
              if (v.id === item.variantId) {
                variantLabel = ` (${v.name})`;
                return { ...v, stock: Math.max(0, (Number(v.stock) || 0) - item.quantity) };
              }
              return v;
            });
          }

          const newStock = hasVariants && updatedVariants && updatedVariants.length > 0
            ? updatedVariants.reduce((s, v) => s + (Number(v.stock) || 0), 0)
            : Math.max(0, (Number(prod.stock) || 0) - item.quantity);

          currentProducts[prodIndex] = {
            ...prod,
            variants: hasVariants ? updatedVariants : undefined,
            stock: newStock,
            updatedAt: today,
          };

          // Record kardex / stock movement
          newMovements.push({
            id: `mov-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
            productId: prod.id,
            productName: `${prod.name}${variantLabel}`,
            type: 'sale',
            quantity: -item.quantity,
            remainingStock: newStock,
            invoiceId: newInvoice.id,
            invoiceNumber: newInvoice.invoiceNumber,
            date: today,
            note: `کسر بابت فاکتور فروش شماره ${newInvoice.invoiceNumber}${variantLabel ? ` [تنوع: ${item.variantName || variantLabel.replace(/[()]/g, '')}]` : ''}`,
          });
        }
      });

      setProducts(currentProducts);
      updatedMovements = [...newMovements, ...movements];
      setMovements(updatedMovements);
    }

    // Atomic transaction save (invoices + products + movements in ONE unified payload)
    StorageService.saveInvoiceTransaction({
      invoices: updatedInvoices,
      products: settings.autoDeductStock && !newInvoice.isProforma ? currentProducts : undefined,
      movements: settings.autoDeductStock && !newInvoice.isProforma && newMovements.length > 0 ? updatedMovements : undefined,
    });

    // ایجاد حواله خروج انبار صرفاً و منحصراً برای فاکتورهای رسمی/قطعی دارای کالای فیزیکی (پیش‌فاکتور و ثبت خدمات به هیچ عنوان حواله ایجاد نمی‌کند)
    const hasGoods = hasPhysicalGoods(newInvoice, currentProducts);
    if (!newInvoice.isProforma && hasGoods) {
      StorageService.getOrAssignExitSlipNumber(newInvoice.id, newInvoice.invoiceNumber);
    } else {
      StorageService.deleteExitSlipLog(newInvoice.id);
    }

    if (newInvoice.isProforma) {
      showToast(`پیش‌فاکتور شماره ${newInvoice.invoiceNumber} با موفقیت ثبت شد (بدون کسر از موجودی انبار).`);
    } else if (!hasGoods) {
      showToast(`فاکتور خدمات شماره ${newInvoice.invoiceNumber} با موفقیت ثبت شد (بدون نیاز به حواله خروج انبار).`);
    } else {
      showToast(`فاکتور شماره ${newInvoice.invoiceNumber} با موفقیت ثبت و از انبار کسر شد.`);
    }

    // ارسال خودکار گزارش متنی یا فایل فاکتور / حواله خروج به تلگرام
    const liveSettings = StorageService.getSettings() || settings;
    if (liveSettings.telegramBotEnabled) {
      const isBothMode = liveSettings.telegramSendMode === 'both';
      const isFileMode = liveSettings.telegramSendMode === 'pdf_with_caption' || (liveSettings.telegramSendMode as string) === 'file';
      const modeLabel = isBothMode ? 'فایل PDF و متن' : isFileMode ? 'فایل PDF' : 'گزارش متنی';

      if (newInvoice.isProforma) {
        if (liveSettings.telegramAutoSendProforma || liveSettings.telegramAutoSendOnlyConfirmed === false) {
          autoSendInvoiceReportToTelegram(newInvoice, liveSettings, {
            onStart: () => showToast(`در حال ارسال ${modeLabel} پیش‌فاکتور به تلگرام...`),
            onSuccess: (msg) => showToast(msg || `✈️ ${modeLabel} پیش‌فاکتور به تلگرام ارسال گردید.`),
            onError: (err) => showToast('⚠️ خطا در ارسال پیش‌فاکتور به تلگرام: ' + err),
          });
        }
      } else {
        if (liveSettings.telegramAutoSendInvoice) {
          autoSendInvoiceReportToTelegram(newInvoice, liveSettings, {
            onStart: () => showToast(`در حال ارسال ${modeLabel} فاکتور فروش به تلگرام...`),
            onSuccess: (msg) => showToast(msg || `✈️ ${modeLabel} فاکتور فروش به تلگرام ارسال گردید.`),
            onError: (err) => showToast('⚠️ خطا در ارسال فاکتور به تلگرام: ' + err),
          });
        }
        if (hasGoods && (liveSettings.telegramAutoSendExitSlip || liveSettings.telegramAutoSendExitSlipIssue)) {
          autoSendExitSlipReportToTelegram(newInvoice, null, false, liveSettings, currentUser || undefined, {
            onStart: () => showToast('در حال ارسال گزارش صدور حواله خروج به تلگرام...'),
            onSuccess: (msg) => showToast(msg || '✈️ گزارش صدور حواله خروج به تلگرام ارسال شد.'),
            onError: (err) => showToast('⚠️ خطا در ارسال حواله خروج به تلگرام: ' + err),
          });
        }
      }
    }

    // Log user activity
    StorageService.logActivity({
      category: 'sales',
      actionType: newInvoice.isProforma ? 'create_proforma' : 'create_invoice',
      actionTitle: newInvoice.isProforma ? 'صدور پیش‌فاکتور' : 'صدور فاکتور فروش',
      details: `${newInvoice.isProforma ? 'پیش‌فاکتور' : 'فاکتور'} شماره ${newInvoice.invoiceNumber} (${newInvoice.items.length} قلم) به مبلغ ${newInvoice.finalTotal.toLocaleString('fa-IR')} ${settings.currency} برای مشتری «${newInvoice.customerName}»`,
      severity: 'info',
      entityType: 'invoice',
      entityId: newInvoice.id,
      entityLabel: `#${newInvoice.invoiceNumber} (${newInvoice.customerName})`,
      metadata: {
        invoiceNumber: newInvoice.invoiceNumber,
        customerName: newInvoice.customerName,
        itemsCount: newInvoice.items.length,
        subtotal: newInvoice.subtotal,
        discount: newInvoice.totalDiscount,
        taxAmount: newInvoice.taxAmount,
        finalTotal: newInvoice.finalTotal,
        paidAmount: newInvoice.paidAmount,
        paymentStatus: newInvoice.paymentStatus,
        paymentMethod: newInvoice.paymentMethod,
        isProforma: Boolean(newInvoice.isProforma),
      },
    });

    if (shouldPrint) {
      setViewingInvoice(newInvoice);
    }

    setActiveTab('invoices');
  };

  // 1.0 EDIT INVOICE & PROFORMA (ویرایش فاکتور و پیش‌فاکتور)
  const handleStartEditInvoice = (invoice: Invoice) => {
    if (currentUser && currentUser.role !== 'admin' && !currentUser.permissions.canCreateInvoice) {
      showToast('دسترسی غیرمجاز: سمت کاربری شما مجوز ویرایش فاکتور فروش را ندارد.');
      return;
    }
    setEditingInvoice(invoice);
    setActiveTab('new-invoice');
  };

  const handleUpdateInvoice = (originalInvoice: Invoice, updatedInvoice: Invoice, shouldPrint: boolean) => {
    if (currentUser && !canUserCreateSalesInvoice(currentUser)) {
      showToast('دسترسی غیرمجاز: سمت کاربری شما مجوز ویرایش فاکتور فروش را ندارد.');
      return;
    }
    const today = getCurrentJalaliDate();

    // If auto-deduct stock is enabled, adjust inventory stock based on quantity changes
    if (settings.autoDeductStock) {
      let currentProducts = [...products];
      const newMovements: StockMovement[] = [];

      if (!originalInvoice.isProforma && !updatedInvoice.isProforma) {
        // Both are regular invoices: compute stock differences
        const allProductIds = Array.from(
          new Set([
            ...originalInvoice.items.map((it) => it.productId),
            ...updatedInvoice.items.map((it) => it.productId),
          ])
        ).filter(Boolean);

        allProductIds.forEach((prodId) => {
          const oldQty = originalInvoice.items
            .filter((it) => it.productId === prodId)
            .reduce((s, it) => s + it.quantity, 0);
          const newQty = updatedInvoice.items
            .filter((it) => it.productId === prodId)
            .reduce((s, it) => s + it.quantity, 0);
          const diff = newQty - oldQty; // positive: customer bought more (deduct); negative: bought less (return)

          if (diff !== 0) {
            const prodIndex = currentProducts.findIndex((p) => p.id === prodId);
            if (prodIndex !== -1) {
              const prod = currentProducts[prodIndex];
              const newStock = Math.max(0, prod.stock - diff);
              currentProducts[prodIndex] = {
                ...prod,
                stock: newStock,
                updatedAt: today,
              };

              newMovements.push({
                id: `mov-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
                productId: prod.id,
                productName: prod.name,
                type: diff > 0 ? 'sale' : 'return',
                quantity: -diff,
                remainingStock: newStock,
                invoiceId: updatedInvoice.id,
                invoiceNumber: updatedInvoice.invoiceNumber,
                date: today,
                note:
                  diff > 0
                    ? `کسر بابت ویرایش فاکتور ${updatedInvoice.invoiceNumber} (افزایش ${diff} ${prod.unit})`
                    : `برگشت به انبار بابت ویرایش فاکتور ${updatedInvoice.invoiceNumber} (کاهش ${Math.abs(diff)} ${prod.unit})`,
              });
            }
          }
        });
      } else if (originalInvoice.isProforma && !updatedInvoice.isProforma) {
        // Changed to official invoice during edit: deduct all items
        updatedInvoice.items.forEach((item) => {
          const prodIndex = currentProducts.findIndex((p) => p.id === item.productId);
          if (prodIndex !== -1) {
            const prod = currentProducts[prodIndex];
            const newStock = Math.max(0, prod.stock - item.quantity);
            currentProducts[prodIndex] = {
              ...prod,
              stock: newStock,
              updatedAt: today,
            };

            newMovements.push({
              id: `mov-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
              productId: prod.id,
              productName: prod.name,
              type: 'sale',
              quantity: -item.quantity,
              remainingStock: newStock,
              invoiceId: updatedInvoice.id,
              invoiceNumber: updatedInvoice.invoiceNumber,
              date: today,
              note: `کسر بابت تبدیل و ثبت فاکتور رسمی در ویرایش سند (${updatedInvoice.invoiceNumber})`,
            });
          }
        });
      } else if (!originalInvoice.isProforma && updatedInvoice.isProforma) {
        // Changed to proforma: restore all old items to stock
        originalInvoice.items.forEach((item) => {
          const prodIndex = currentProducts.findIndex((p) => p.id === item.productId);
          if (prodIndex !== -1) {
            const prod = currentProducts[prodIndex];
            const newStock = prod.stock + item.quantity;
            currentProducts[prodIndex] = {
              ...prod,
              stock: newStock,
              updatedAt: today,
            };

            newMovements.push({
              id: `mov-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
              productId: prod.id,
              productName: prod.name,
              type: 'return',
              quantity: item.quantity,
              remainingStock: newStock,
              invoiceId: updatedInvoice.id,
              invoiceNumber: updatedInvoice.invoiceNumber,
              date: today,
              note: `برگشت به انبار بابت تبدیل فاکتور به پیش‌فاکتور در ویرایش`,
            });
          }
        });
      }

      let updatedMovements = [...movements];
      if (newMovements.length > 0) {
        setProducts(currentProducts);
        updatedMovements = [...newMovements, ...movements];
        setMovements(updatedMovements);
      }

      const updatedInvoices = invoices.map((inv) => (inv.id === updatedInvoice.id ? updatedInvoice : inv));
      setInvoices(updatedInvoices);

      StorageService.saveInvoiceTransaction({
        invoices: updatedInvoices,
        products: newMovements.length > 0 ? currentProducts : undefined,
        movements: newMovements.length > 0 ? updatedMovements : undefined,
      });
    } else {
      const updatedInvoices = invoices.map((inv) => (inv.id === updatedInvoice.id ? updatedInvoice : inv));
      setInvoices(updatedInvoices);
      StorageService.saveInvoiceTransaction({
        invoices: updatedInvoices,
      });
    }

    // بررسی و اعمال وضعیت حواله خروج بر اساس قطعی بودن سند و داشتن کالای فیزیکی (خدمات نیازی به حواله خروج ندارد)
    const hasGoods = hasPhysicalGoods(updatedInvoice, products);
    if (updatedInvoice.isProforma || !hasGoods) {
      StorageService.deleteExitSlipLog(updatedInvoice.id);
    } else if (originalInvoice.isProforma && !updatedInvoice.isProforma && hasGoods) {
      StorageService.getOrAssignExitSlipNumber(updatedInvoice.id, updatedInvoice.invoiceNumber);
    }

    setEditingInvoice(null);

    // ارسال خودکار فایل PDF فاکتور ویرایش‌شده به تلگرام در صورت فعال بودن
    const liveSettings = StorageService.getSettings() || settings;
    if (liveSettings.telegramBotEnabled && liveSettings.telegramAutoSendInvoice) {
      autoSendInvoicePdfToTelegram(updatedInvoice, liveSettings, {
        onStart: () => showToast('در حال ایجاد و ارسال فایل PDF فاکتور به تلگرام...'),
        onSuccess: (msg) => showToast(msg || '✈️ فایل PDF فاکتور ویرایش‌شده با موفقیت به تلگرام ارسال شد.'),
        onError: (err) => showToast('⚠️ خطا در ارسال خودکار فاکتور به تلگرام: ' + err),
      });
    }

    // Log user activity
    StorageService.logActivity({
      category: 'sales',
      actionType: updatedInvoice.isProforma ? 'edit_proforma' : 'edit_invoice',
      actionTitle: updatedInvoice.isProforma ? 'ویرایش پیش‌فاکتور' : 'ویرایش فاکتور فروش',
      details: `ویرایش ${updatedInvoice.isProforma ? 'پیش‌فاکتور' : 'فاکتور'} شماره ${updatedInvoice.invoiceNumber} — مشتری: «${updatedInvoice.customerName}» | مبلغ قبلی: ${originalInvoice.finalTotal.toLocaleString('fa-IR')} ← جدید: ${updatedInvoice.finalTotal.toLocaleString('fa-IR')} ${settings.currency}`,
      severity: 'warning',
      entityType: 'invoice',
      entityId: updatedInvoice.id,
      entityLabel: `#${updatedInvoice.invoiceNumber} (${updatedInvoice.customerName})`,
      metadata: {
        invoiceNumber: updatedInvoice.invoiceNumber,
        customerName: updatedInvoice.customerName,
        previousTotal: originalInvoice.finalTotal,
        newTotal: updatedInvoice.finalTotal,
        previousItemsCount: originalInvoice.items.length,
        newItemsCount: updatedInvoice.items.length,
        paymentStatus: updatedInvoice.paymentStatus,
      },
    });

    if (shouldPrint) {
      setViewingInvoice(updatedInvoice);
    }

    showToast(`تغییرات ${updatedInvoice.isProforma ? 'پیش‌فاکتور' : 'فاکتور'} شماره ${updatedInvoice.invoiceNumber} با موفقیت ثبت شد.`);
    setActiveTab('invoices');
  };

  // 1.1 CONVERT PROFORMA TO OFFICIAL INVOICE (تبدیل پیش‌فاکتور به فاکتور قطعی و کسر از انبار)
  const handleConvertProforma = (proformaInvoice: Invoice, customInvoiceNumber?: string) => {
    if (currentUser && currentUser.role !== 'admin' && !currentUser.permissions.canCreateInvoice) {
      showToast('دسترسی غیرمجاز: سمت کاربری شما مجوز تبدیل پیش‌فاکتور به فاکتور فروش را ندارد.');
      return false;
    }
    const today = getCurrentJalaliDate();
    let convertedInvoice: Invoice;
    const finalNumber = customInvoiceNumber?.trim() || 
      (proformaInvoice.invoiceNumber.startsWith('PF-') 
        ? proformaInvoice.invoiceNumber.replace('PF-', 'INV-') 
        : StorageService.getNextInvoiceNumber(false));

    // Check stock warning if negative stock not allowed
    if (settings.autoDeductStock && settings.allowNegativeStock === false) {
      const shortages: string[] = [];
      proformaInvoice.items.forEach((item) => {
        const prod = products.find((p) => p.id === item.productId);
        const currentStock = prod ? prod.stock : 0;
        if (currentStock < item.quantity) {
          shortages.push(`کالای "${item.productName}": موجودی فعلی ${currentStock} ${item.unit}، تعداد فاکتور ${item.quantity} ${item.unit}`);
        }
      });

      if (shortages.length > 0) {
        showToast(`خطای تبدیل: موجودی انبار کافی نیست و ثبت موجودی منفی در تنظیمات غیرفعال است.`);
        return false;
      }
    }

    // Deduct stock and record movements
    let currentProducts = [...products];
    const newMovements: StockMovement[] = [];

    if (settings.autoDeductStock) {
      proformaInvoice.items.forEach((item) => {
        const prodIndex = currentProducts.findIndex((p) => p.id === item.productId);
        if (prodIndex !== -1) {
          const prod = currentProducts[prodIndex];
          const newStock = Math.max(0, prod.stock - item.quantity);

          currentProducts[prodIndex] = {
            ...prod,
            stock: newStock,
            updatedAt: today,
          };

          newMovements.push({
            id: `mov-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
            productId: prod.id,
            productName: prod.name,
            type: 'sale',
            quantity: -item.quantity,
            remainingStock: newStock,
            invoiceId: proformaInvoice.id,
            invoiceNumber: finalNumber,
            date: today,
            note: `کسر بابت تبدیل پیش‌فاکتور ${proformaInvoice.invoiceNumber} به فاکتور رسمی ${finalNumber}`,
          });
        }
      });

      let updatedMovements = [...movements];
      if (newMovements.length > 0) {
        setProducts(currentProducts);
        updatedMovements = [...newMovements, ...movements];
        setMovements(updatedMovements);
      }

      // Update invoice record: change isProforma to false, new number, convertedAt, convertedFromProforma
      const loggedUser = StorageService.getLoggedInUser();
      const currentUserName = currentUser?.fullName || currentUser?.username || loggedUser?.fullName || loggedUser?.username || 'مدیر سیستم';
      const currentUserId = currentUser?.id || loggedUser?.id;

      convertedInvoice = {
        ...proformaInvoice,
        isProforma: false,
        invoiceNumber: finalNumber,
        date: today,
        convertedAt: today,
        convertedFromProforma: proformaInvoice.invoiceNumber,
        createdById: proformaInvoice.createdById || currentUserId,
        createdByName: proformaInvoice.createdByName || currentUserName,
        createdByRole: proformaInvoice.createdByRole || currentUser?.roleTitle,
        convertedById: currentUserId,
        convertedByName: currentUserName,
        notes: proformaInvoice.notes ? proformaInvoice.notes.trim() : undefined,
      };

      const updatedInvoices = invoices.map((inv) => inv.id === proformaInvoice.id ? convertedInvoice : inv);
      setInvoices(updatedInvoices);

      StorageService.saveInvoiceTransaction({
        invoices: updatedInvoices,
        products: currentProducts,
        movements: newMovements.length > 0 ? updatedMovements : undefined,
      });

      // If modal was open viewing this invoice, update it
      if (viewingInvoice && viewingInvoice.id === proformaInvoice.id) {
        setViewingInvoice(convertedInvoice);
      }
    } else {
      const loggedUser = StorageService.getLoggedInUser();
      const currentUserName = currentUser?.fullName || currentUser?.username || loggedUser?.fullName || loggedUser?.username || 'مدیر سیستم';
      const currentUserId = currentUser?.id || loggedUser?.id;

      convertedInvoice = {
        ...proformaInvoice,
        isProforma: false,
        invoiceNumber: finalNumber,
        date: today,
        convertedAt: today,
        convertedFromProforma: proformaInvoice.invoiceNumber,
        createdById: proformaInvoice.createdById || currentUserId,
        createdByName: proformaInvoice.createdByName || currentUserName,
        createdByRole: proformaInvoice.createdByRole || currentUser?.roleTitle,
        convertedById: currentUserId,
        convertedByName: currentUserName,
        notes: proformaInvoice.notes ? proformaInvoice.notes.trim() : undefined,
      };

      const updatedInvoices = invoices.map((inv) => inv.id === proformaInvoice.id ? convertedInvoice : inv);
      setInvoices(updatedInvoices);

      StorageService.saveInvoiceTransaction({
        invoices: updatedInvoices,
      });

      if (viewingInvoice && viewingInvoice.id === proformaInvoice.id) {
        setViewingInvoice(convertedInvoice);
      }
    }

    // Log user activity
    StorageService.logActivity({
      category: 'sales',
      actionType: 'convert_proforma',
      actionTitle: 'تبدیل پیش‌فاکتور به فاکتور قطعی',
      details: `تبدیل پیش‌فاکتور ${proformaInvoice.invoiceNumber} به فاکتور قطعی ${finalNumber} برای «${proformaInvoice.customerName}» به مبلغ ${proformaInvoice.finalTotal.toLocaleString('fa-IR')} ${settings.currency}`,
      severity: 'warning',
      entityType: 'invoice',
      entityId: proformaInvoice.id,
      entityLabel: `${proformaInvoice.invoiceNumber} -> ${finalNumber}`,
      metadata: {
        fromProforma: proformaInvoice.invoiceNumber,
        toInvoiceNumber: finalNumber,
        customerName: proformaInvoice.customerName,
        finalTotal: proformaInvoice.finalTotal,
        itemsCount: proformaInvoice.items.length,
      },
    });

    // هنگام تبدیل پیش‌فاکتور به فاکتور رسمی، فقط در صورت داشتن کالای فیزیکی حواله خروج کالا صادر می‌گردد (ثبت خدمات حواله خروج ندارد)
    const hasGoods = hasPhysicalGoods(convertedInvoice, products);
    if (hasGoods) {
      StorageService.getOrAssignExitSlipNumber(proformaInvoice.id, finalNumber);
    } else {
      StorageService.deleteExitSlipLog(proformaInvoice.id);
    }

    // ارسال خودکار گزارش یا فایل PDF فاکتور رسمی تایید شده به تلگرام پس از تبدیل
    const liveSettings = StorageService.getSettings() || settings;
    if (liveSettings.telegramBotEnabled && (liveSettings.telegramAutoSendInvoice || liveSettings.telegramAutoSendOnProformaConvert)) {
      const isBothMode = liveSettings.telegramSendMode === 'both';
      const isFileMode = liveSettings.telegramSendMode === 'pdf_with_caption' || (liveSettings.telegramSendMode as string) === 'file';
      const modeLabel = isBothMode ? 'فایل PDF و متن' : isFileMode ? 'فایل PDF' : 'گزارش متنی';

      autoSendInvoiceReportToTelegram(convertedInvoice, liveSettings, {
        onStart: () => showToast(`در حال ارسال خودکار ${modeLabel} فاکتور تایید شده به تلگرام...`),
        onSuccess: (msg) => showToast(msg || `✈️ ${modeLabel} فاکتور تایید شده با موفقیت به تلگرام ارسال شد.`),
        onError: (err) => showToast('⚠️ خطا در ارسال خودکار فاکتور به تلگرام: ' + err),
      });
    }

    showToast(`پیش‌فاکتور ${proformaInvoice.invoiceNumber} با موفقیت به فاکتور رسمی ${finalNumber} تبدیل و اقلام از انبار کسر شد.`);
    return true;
  };

  // 2. RETURN INVOICE TO INVENTORY (مرجوعی به انبار)
  const handleReturnInvoiceToStock = (invoice: Invoice) => {
    if (currentUser && (isReadOnlyUser(currentUser) || !canUserDeleteInvoice(currentUser))) {
      showToast('دسترسی غیرمجاز: سمت کاربری شما مجوز مرجوعی یا ابطال فاکتور را ندارد.');
      return;
    }
    const today = getCurrentJalaliDate();
    let currentProducts = [...products];
    const returnMovements: StockMovement[] = [];

    invoice.items.forEach((item) => {
      const prodIndex = currentProducts.findIndex((p) => p.id === item.productId);
      if (prodIndex !== -1) {
        const prod = currentProducts[prodIndex];
        const newStock = prod.stock + item.quantity;

        currentProducts[prodIndex] = {
          ...prod,
          stock: newStock,
          updatedAt: today,
        };

        returnMovements.push({
          id: `mov-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
          productId: prod.id,
          productName: prod.name,
          type: 'return',
          quantity: item.quantity,
          remainingStock: newStock,
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          date: today,
          note: `برگشت به انبار بابت مرجوعی فاکتور ${invoice.invoiceNumber}`,
        });
      }
    });

    // Mark invoice as deleted so background sync never resurrects it
    StorageService.markInvoiceDeleted(invoice.id);

    setProducts(currentProducts);
    const updatedMovements = [...returnMovements, ...movements];
    setMovements(updatedMovements);

    // Remove invoice
    const updatedInvoices = invoices.filter((i) => i.id !== invoice.id);
    setInvoices(updatedInvoices);

    StorageService.saveInvoiceTransaction({
      invoices: updatedInvoices,
      products: currentProducts,
      movements: updatedMovements,
    });

    StorageService.logActivity({
      category: 'warehouse',
      actionType: 'return_stock',
      actionTitle: 'مرجوع اقلام فاکتور به انبار',
      details: `ابطال فاکتور شماره ${invoice.invoiceNumber} («${invoice.customerName}»، ${invoice.items.length} قلم، مبلغ ${invoice.finalTotal.toLocaleString('fa-IR')} ${settings.currency}) و بازگرداندن اقلام به انبار`,
      severity: 'critical',
      entityType: 'invoice',
      entityId: invoice.id,
      entityLabel: `#${invoice.invoiceNumber} (${invoice.customerName})`,
      metadata: {
        invoiceNumber: invoice.invoiceNumber,
        customerName: invoice.customerName,
        itemsCount: invoice.items.length,
        finalTotal: invoice.finalTotal,
      },
    });

    showToast(`کالاهای فاکتور ${invoice.invoiceNumber} به انبار بازگردانده شدند.`);
  };

  // 3. DELETE INVOICE (بدون بازگردانی کالا)
  const handleDeleteInvoice = (invoiceId: string) => {
    if (currentUser && (isReadOnlyUser(currentUser) || !canUserDeleteInvoice(currentUser))) {
      showToast('دسترسی غیرمجاز: سمت کاربری شما مجوز حذف فاکتور را ندارد.');
      return;
    }
    const inv = invoices.find((i) => i.id === invoiceId);
    StorageService.markInvoiceDeleted(invoiceId);
    StorageService.deleteExitSlipLog(invoiceId);

    const updatedInvoices = invoices.filter((i) => i.id !== invoiceId);
    setInvoices(updatedInvoices);
    StorageService.saveInvoices(updatedInvoices);

    StorageService.logActivity({
      category: 'sales',
      actionType: 'delete_invoice',
      actionTitle: 'حذف فاکتور فروش',
      details: `حذف فاکتور شماره ${inv?.invoiceNumber || invoiceId} متعلق به «${inv?.customerName || '-'}» به مبلغ ${(inv?.finalTotal || 0).toLocaleString('fa-IR')} ${settings.currency}`,
      severity: 'critical',
      entityType: 'invoice',
      entityId: invoiceId,
      entityLabel: inv ? `#${inv.invoiceNumber} (${inv.customerName})` : invoiceId,
      metadata: {
        invoiceNumber: inv?.invoiceNumber || null,
        customerName: inv?.customerName || null,
        finalTotal: inv?.finalTotal ?? null,
      },
    });

    showToast('فاکتور مورد نظر حذف شد.');
  };

  // 4. UPDATE PAYMENT STATUS
  const handleUpdatePaymentStatus = (
    invoiceId: string,
    status: 'paid' | 'unpaid' | 'partial',
    paidAmount?: number,
    paymentDetails?: {
      paymentMethod?: PaymentMethod;
      chequeNumber?: string;
      chequeDueDate?: string;
      chequeName?: string;
    }
  ) => {
    if (currentUser && (isReadOnlyUser(currentUser) || !canUserSettleInvoice(currentUser))) {
      showToast('دسترسی غیرمجاز: سمت کاربری شما مجوز ثبت دریافت و تسویه فاکتور را ندارد.');
      return;
    }
    const prevInv = invoices.find((i) => i.id === invoiceId);
    const updated = invoices.map((inv) => {
      if (inv.id === invoiceId) {
        const nextMethod: PaymentMethod =
          paymentDetails?.paymentMethod ??
          (status === 'unpaid' ? 'credit' : inv.paymentMethod);

        const isChequeMethod = nextMethod === 'cheque';
        const nextChequeNumber = isChequeMethod
          ? (paymentDetails?.chequeNumber !== undefined ? paymentDetails.chequeNumber.trim() || undefined : inv.chequeNumber)
          : (paymentDetails?.paymentMethod ? undefined : inv.chequeNumber);
        const nextChequeDueDate = isChequeMethod
          ? (paymentDetails?.chequeDueDate !== undefined ? paymentDetails.chequeDueDate.trim() || undefined : inv.chequeDueDate)
          : (paymentDetails?.paymentMethod ? undefined : inv.chequeDueDate);
        const nextChequeName = isChequeMethod
          ? (paymentDetails?.chequeName !== undefined ? paymentDetails.chequeName.trim() || undefined : inv.chequeName)
          : (paymentDetails?.paymentMethod ? undefined : inv.chequeName);

        const dueDateChanged = isChequeMethod && nextChequeDueDate !== inv.chequeDueDate;

        return {
          ...inv,
          paymentStatus: status,
          paymentMethod: nextMethod,
          paidAmount: status === 'paid' ? inv.finalTotal : paidAmount !== undefined ? paidAmount : inv.paidAmount,
          chequeNumber: nextChequeNumber,
          chequeDueDate: nextChequeDueDate,
          chequeName: nextChequeName,
          ...(dueDateChanged
            ? { chequeReminderSentAt: undefined, chequeReminderSentForDate: undefined }
            : {}),
        };
      }
      return inv;
    });
    setInvoices(updated);
    StorageService.saveInvoices(updated);

    const updatedInv = updated.find((i) => i.id === invoiceId);
    const inv = updatedInv || prevInv;
    const nextPaid = status === 'paid' ? (inv?.finalTotal || 0) : (paidAmount !== undefined ? paidAmount : (inv?.paidAmount || 0));
    const statusLabels: Record<string, string> = { paid: 'تسویه کامل', partial: 'پرداخت قسطی/بیعانه', unpaid: 'نسیه/پرداخت‌نشده' };
    const isChequeUpdate = inv?.paymentMethod === 'cheque';
    const chequeInfoText = isChequeUpdate
      ? ` [دریافت چک${inv?.chequeNumber ? ` ش: ${inv.chequeNumber}` : ''}${inv?.chequeDueDate ? ` - سررسید: ${inv.chequeDueDate}` : ''}${inv?.chequeName ? ` - ${inv.chequeName}` : ''}]`
      : '';

    StorageService.logActivity({
      category: 'sales',
      actionType: isChequeUpdate ? 'update_payment_cheque' : 'update_payment',
      actionTitle: isChequeUpdate ? 'ثبت دریافت چک و تسویه فاکتور' : 'تغییر وضعیت تسویه فاکتور',
      details: `تغییر وضعیت پرداخت فاکتور ${inv?.invoiceNumber || invoiceId} («${inv?.customerName || '-'}») به «${statusLabels[status] || status}»${chequeInfoText} — مبلغ پرداختی: ${nextPaid.toLocaleString('fa-IR')} ${settings.currency}`,
      severity: 'warning',
      entityType: 'invoice',
      entityId: invoiceId,
      entityLabel: inv ? `#${inv.invoiceNumber} (${inv.customerName})` : invoiceId,
      metadata: {
        invoiceNumber: inv?.invoiceNumber || null,
        previousStatus: prevInv?.paymentStatus || null,
        newStatus: status,
        paymentMethod: inv?.paymentMethod || null,
        chequeNumber: inv?.chequeNumber || null,
        chequeDueDate: inv?.chequeDueDate || null,
        chequeName: inv?.chequeName || null,
        previousPaidAmount: prevInv?.paidAmount ?? null,
        newPaidAmount: nextPaid,
        finalTotal: inv?.finalTotal ?? null,
      },
    });

    showToast(
      isChequeUpdate
        ? 'دریافت چک و وضعیت تسویه فاکتور با موفقیت ثبت شد.'
        : 'وضعیت تسویه فاکتور بروزرسانی شد.'
    );

    // ارسال خودکار رسید دریافت مبلغ از مشتری به تلگرام
    const liveSettings = StorageService.getSettings() || settings;
    if (liveSettings.telegramBotEnabled && liveSettings.telegramAutoSendCustomerPayment !== false && inv && (status === 'paid' || status === 'partial')) {
      const paymentVal = status === 'paid' ? inv.finalTotal : (paidAmount || inv.paidAmount || 0);
      if (paymentVal > 0) {
        const cust = customers.find((c) => c.id === inv.customerId);
        let balanceAfter: number | undefined = undefined;
        if (cust) {
          const ledger = StorageService.buildCustomerLedger(cust, updated, customerTransactions);
          balanceAfter = ledger.netBalance;
        }
        const extraChequeNotes = isChequeUpdate
          ? [
              inv.chequeNumber ? `شماره چک: ${inv.chequeNumber}` : '',
              inv.chequeDueDate ? `سررسید چک: ${inv.chequeDueDate}` : '',
              inv.chequeName ? `صاحب حساب/بانک: ${inv.chequeName}` : '',
            ]
              .filter(Boolean)
              .join(' | ')
          : '';
        autoSendCustomerPaymentReportToTelegram(
          {
            id: `ctxn-${Date.now()}`,
            customerId: inv.customerId,
            customerName: inv.customerName,
            type: 'deposit',
            amount: paymentVal,
            date: getCurrentJalaliDate(),
            title: isChequeUpdate
              ? `دریافت چک بابت فاکتور فروش شماره ${inv.invoiceNumber}`
              : `تسویه/دریافت وجه فاکتور فروش شماره ${inv.invoiceNumber}`,
            paymentMethod: (inv.paymentMethod as any) || 'transfer',
            trackingNumber: inv.chequeNumber || undefined,
            chequeDueDate: inv.chequeDueDate || undefined,
            invoiceNumber: inv.invoiceNumber,
            notes: [extraChequeNotes, inv.notes].filter(Boolean).join('\n') || undefined,
            recordedBy: currentUser?.fullName || currentUser?.username || 'مدیر سیستم',
            createdAt: getCurrentJalaliDate(),
          },
          cust,
          liveSettings,
          balanceAfter,
          {
            onSuccess: (msg) => showToast(msg || '✈️ رسید دریافت وجه فاکتور به تلگرام ارسال گردید.'),
          }
        ).catch((err) => console.warn('[Telegram Auto-Send] Invoice payment receipt error:', err));
      }
    }
  };

  // 4.1 BATCH UPDATE PAYMENT STATUS (Lump-sum payment across multiple customer invoices)
  const handleBatchUpdatePaymentStatus = (
    updates: { invoiceId: string; status: 'paid' | 'unpaid' | 'partial'; paidAmount: number }[],
    details?: string
  ) => {
    if (currentUser && (isReadOnlyUser(currentUser) || !canUserSettleInvoice(currentUser))) {
      showToast('دسترسی غیرمجاز: سمت کاربری شما مجوز تسویه تجمیعی فاکتورها را ندارد.');
      return;
    }
    const updateMap = new Map(updates.map((u) => [u.invoiceId, u]));
    const updated = invoices.map((inv) => {
      const up = updateMap.get(inv.id);
      if (up) {
        return {
          ...inv,
          paymentStatus: up.status,
          paidAmount: up.paidAmount,
        };
      }
      return inv;
    });

    setInvoices(updated);
    StorageService.saveInvoices(updated);

    StorageService.logActivity({
      category: 'sales',
      actionType: 'batch_update_payment',
      actionTitle: 'ثبت واریزی و تسویه تجمیعی فاکتورها',
      details: details || `تسویه تجمیعی ${updates.length} فاکتور`,
      severity: 'warning',
      entityType: 'invoice',
      metadata: {
        updatedInvoicesCount: updates.length,
        totalPaidAmount: updates.reduce((s, u) => s + (u.paidAmount || 0), 0),
      },
    });

    showToast(`${updates.length} فاکتور با موفقیت تسویه و در حساب مشتری ثبت گردید.`);

    // ارسال خودکار رسید تسویه تجمیعی فاکتورهای مشتری به تلگرام
    const liveSettings = StorageService.getSettings() || settings;
    if (liveSettings.telegramBotEnabled && liveSettings.telegramAutoSendCustomerPayment !== false && updates.length > 0) {
      const sampleInv = invoices.find((i) => i.id === updates[0].invoiceId);
      if (sampleInv) {
        const cust = customers.find((c) => c.id === sampleInv.customerId);
        const totalPaidInBatch = updates.reduce((sum, u) => sum + (u.paidAmount || 0), 0);
        let balanceAfter: number | undefined = undefined;
        if (cust) {
          const ledger = StorageService.buildCustomerLedger(cust, updated, customerTransactions);
          balanceAfter = ledger.netBalance;
        }
        autoSendCustomerPaymentReportToTelegram(
          {
            id: `ctxn-${Date.now()}`,
            customerId: sampleInv.customerId,
            customerName: sampleInv.customerName,
            type: 'deposit',
            amount: totalPaidInBatch,
            date: getCurrentJalaliDate(),
            title: `تسویه تجمیعی ${updates.length} فاکتور فروش`,
            notes: details,
            recordedBy: currentUser?.fullName || currentUser?.username || 'مدیر سیستم',
            createdAt: getCurrentJalaliDate(),
          },
          cust,
          liveSettings,
          balanceAfter,
          {
            onSuccess: (msg) => showToast(msg || '✈️ رسید تسویه تجمیعی به تلگرام ارسال شد.'),
          }
        ).catch((err) => console.warn('[Telegram Auto-Send] Batch payment receipt error:', err));
      }
    }
  };

  // 5. INVENTORY PRODUCT MANAGEMENT
  const canCurrentUserManageInventory = (): boolean => {
    if (!currentUser) return true;
    if (isReadOnlyUser(currentUser)) return false;
    return (
      currentUser.role === 'admin' ||
      Boolean(currentUser.permissions?.canAccessAdmin || currentUser.permissions?.canManageInventory)
    );
  };

  const handleSaveProduct = (rawProduct: Product) => {
    if (!canCurrentUserManageInventory()) {
      showToast('دسترسی غیرمجاز: سمت کاربری شما مجوز تعریف یا ویرایش کالاها را ندارد.');
      return;
    }
    let product = { ...rawProduct };
    let updatedProducts: Product[];
    const exists = products.some((p) => p.id === product.id);

    if (exists) {
      const oldProd = products.find((p) => p.id === product.id);

      // ثبت خودکار تاریخچه تغییر قیمت خرید در طول زمان
      const history = Array.isArray(product.priceHistory)
        ? [...product.priceHistory]
        : Array.isArray(oldProd?.priceHistory)
        ? [...oldProd.priceHistory]
        : [];
      if (oldProd && Number(oldProd.buyPrice) !== Number(product.buyPrice) && Number(product.buyPrice) > 0) {
        if (history.length === 0 && Number(oldProd.buyPrice) > 0) {
          history.push({
            id: `ph-prev-${Date.now()}`,
            date: oldProd.updatedAt || getCurrentJalaliDate(),
            buyPrice: Number(oldProd.buyPrice),
            sellPrice: oldProd.sellPrice,
            wholesalePrice: oldProd.wholesalePrice,
            note: 'قیمت خرید قبلی',
          });
        }
        history.push({
          id: `ph-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          date: getCurrentJalaliDate(),
          buyPrice: Number(product.buyPrice),
          sellPrice: product.sellPrice,
          wholesalePrice: product.wholesalePrice,
          note: 'ویرایش و بروزرسانی قیمت خرید کالا',
        });
      }
      product.priceHistory = history;

      updatedProducts = products.map((p) => (p.id === product.id ? product : p));

      // If user modified stock directly in the edit product modal, log Kardex movement
      if (oldProd && Number(oldProd.stock) !== Number(product.stock)) {
        const diff = Number(product.stock) - Number(oldProd.stock);
        const adjustMov: StockMovement = {
          id: `mov-${Date.now()}`,
          productId: product.id,
          productName: product.name,
          type: 'adjustment',
          quantity: diff,
          remainingStock: product.stock,
          date: getCurrentJalaliDate(),
          note: `اصلاح و تغییر موجودی از بخش ویرایش مشخصات کالا (قبلی: ${oldProd.stock}، جدید: ${product.stock})`,
        };
        const updatedMovements = [adjustMov, ...movements];
        setMovements(updatedMovements);
        StorageService.saveMovements(updatedMovements);
      }

      showToast(`مشخصات کالای "${product.name}" بروزرسانی شد.`);
    } else {
      if (Number(product.buyPrice) > 0 && (!product.priceHistory || product.priceHistory.length === 0)) {
        product.priceHistory = [
          {
            id: `ph-${Date.now()}`,
            date: product.updatedAt || getCurrentJalaliDate(),
            buyPrice: Number(product.buyPrice),
            sellPrice: product.sellPrice,
            wholesalePrice: product.wholesalePrice,
            note: 'ثبت اولیه قیمت خرید هنگام تعریف کالا',
          },
        ];
      }
      updatedProducts = [product, ...products];
      // If product has initial stock > 0, log an initial stock intake
      if (product.stock > 0) {
        const initialMov: StockMovement = {
          id: `mov-${Date.now()}`,
          productId: product.id,
          productName: product.name,
          type: 'purchase',
          quantity: product.stock,
          remainingStock: product.stock,
          date: getCurrentJalaliDate(),
          note: 'موجودی اولیه هنگام تعریف کالا',
        };
        const updatedMovements = [initialMov, ...movements];
        setMovements(updatedMovements);
        StorageService.saveMovements(updatedMovements);
      }
      showToast(`کالای "${product.name}" با موفقیت در انبار ثبت شد.`);
    }

    setProducts(updatedProducts);
    StorageService.saveProducts(updatedProducts);

    const oldProdForLog = exists ? products.find((p) => p.id === product.id) : undefined;
    StorageService.logActivity({
      category: 'warehouse',
      actionType: exists ? 'edit_product' : 'create_product',
      actionTitle: exists ? 'ویرایش مشخصات کالا' : 'تعریف کالای جدید',
      details: `${exists ? 'ویرایش مشخصات کالا' : 'تعریف کالای جدید'}: «${product.name}» (${product.code || '-'} • دسته: ${product.category || 'عمومی'} • موجودی: ${product.stock} ${product.unit} • فروش: ${Number(product.sellPrice || 0).toLocaleString('fa-IR')} ${settings.currency})`,
      severity: exists ? 'warning' : 'info',
      entityType: 'product',
      entityId: product.id,
      entityLabel: `${product.name} (${product.code || ''})`,
      metadata: {
        code: product.code || null,
        category: product.category || 'عمومی',
        previousStock: oldProdForLog ? oldProdForLog.stock : null,
        newStock: product.stock,
        previousBuyPrice: oldProdForLog ? oldProdForLog.buyPrice : null,
        newBuyPrice: product.buyPrice,
        previousSellPrice: oldProdForLog ? oldProdForLog.sellPrice : null,
        newSellPrice: product.sellPrice,
      },
    });
  };

  const handleDeleteProduct = (productId: string) => {
    if (!canCurrentUserManageInventory()) {
      showToast('دسترسی غیرمجاز: سمت کاربری شما مجوز حذف کالا از انبار را ندارد.');
      return;
    }
    const prod = products.find((p) => p.id === productId);
    StorageService.deleteProduct(productId);
    const updated = StorageService.getProducts();
    setProducts(updated);

    StorageService.logActivity({
      category: 'warehouse',
      actionType: 'delete_product',
      actionTitle: 'حذف کالا از انبار',
      details: `حذف کالای «${prod?.name || productId}» (کد: ${prod?.code || '-'} • آخرین موجودی: ${prod?.stock ?? 0} ${prod?.unit || ''})`,
      severity: 'critical',
      entityType: 'product',
      entityId: productId,
      entityLabel: prod?.name || productId,
      metadata: {
        code: prod?.code || null,
        lastStock: prod?.stock ?? null,
        category: prod?.category || null,
      },
    });

    showToast('کالای مورد نظر از انبار حذف شد.');
  };

  // 6. MANUAL STOCK ADJUSTMENT / INTAKE (با پشتیبانی از تنوع کالا و انبارگردانی شمارش فیزیکی)
  const handleAdjustStock = (
    productId: string,
    type: 'purchase' | 'adjustment' | 'return' | 'set_stock',
    quantity: number,
    note: string,
    variantId?: string,
    exactStock?: number
  ) => {
    if (!canCurrentUserManageInventory()) {
      showToast('دسترسی غیرمجاز: سمت کاربری شما مجوز تعدیل موجودی انبار را ندارد.');
      return;
    }
    const prodIndex = products.findIndex((p) => p.id === productId);
    if (prodIndex === -1) return;

    const prod = products[prodIndex];
    const currentStock = Number(prod.stock) || 0;
    const hasVariants = !!prod.hasVariants && Array.isArray(prod.variants) && prod.variants.length > 0;

    let updatedVariants = hasVariants ? [...(prod.variants || [])] : undefined;
    let variantLabel = '';
    let delta = 0;
    let newStock = 0;

    if (type === 'set_stock' && exactStock !== undefined) {
      // انبارگردانی شمارش دقیق
      const targetExact = Math.max(0, Number(exactStock) || 0);
      if (hasVariants && updatedVariants && variantId) {
        updatedVariants = updatedVariants.map((v) => {
          if (v.id === variantId) {
            variantLabel = ` (${v.name})`;
            const oldVStock = Number(v.stock) || 0;
            delta = targetExact - oldVStock;
            return { ...v, stock: targetExact };
          }
          return v;
        });
        newStock = updatedVariants.reduce((s, v) => s + (Number(v.stock) || 0), 0);
      } else {
        delta = targetExact - currentStock;
        newStock = targetExact;
      }
    } else {
      // افزایش یا کاهش بر اساس تعداد
      const isAdding = type === 'purchase' || type === 'return';
      const cleanQty = Math.max(0, Number(quantity) || 0);
      delta = isAdding ? cleanQty : -cleanQty;

      if (hasVariants && updatedVariants && variantId) {
        updatedVariants = updatedVariants.map((v) => {
          if (v.id === variantId) {
            variantLabel = ` (${v.name})`;
            const curVStock = Number(v.stock) || 0;
            const updatedVStock = Math.max(0, curVStock + delta);
            return { ...v, stock: updatedVStock };
          }
          return v;
        });
        newStock = updatedVariants.reduce((s, v) => s + (Number(v.stock) || 0), 0);
      } else {
        newStock = Math.max(0, currentStock + delta);
      }
    }

    const updatedProd: Product = {
      ...prod,
      variants: hasVariants ? updatedVariants : undefined,
      stock: newStock,
      updatedAt: getCurrentJalaliDate(),
    };

    const updatedProducts = [...products];
    updatedProducts[prodIndex] = updatedProd;
    setProducts(updatedProducts);
    StorageService.saveProducts(updatedProducts);

    const movementType: 'purchase' | 'adjustment' | 'sale' | 'return' = 
      type === 'purchase' ? 'purchase' : type === 'return' ? 'return' : 'adjustment';

    const newMov: StockMovement = {
      id: `mov-${Date.now()}`,
      productId: prod.id,
      productName: `${prod.name}${variantLabel}`,
      type: movementType,
      quantity: delta,
      remainingStock: newStock,
      date: getCurrentJalaliDate(),
      note: note ? `${note}${variantLabel ? ` [تنوع: ${variantLabel.replace(/[()]/g, '')}]` : ''}` : (delta >= 0 ? 'ورود به انبار' : 'کاهش موجودی انبار'),
    };

    const updatedMovements = [newMov, ...movements];
    setMovements(updatedMovements);
    StorageService.saveMovements(updatedMovements);

    StorageService.logActivity({
      category: 'warehouse',
      actionType: 'adjust_stock',
      actionTitle: type === 'purchase' ? 'ورود دستی به انبار' : type === 'set_stock' ? 'ثبت انبارگردانی واقعی' : type === 'return' ? 'مرجوعی به انبار' : 'تعدیل دستی موجودی',
      details: `تغییر موجودی «${prod.name}${variantLabel}» از ${currentStock} به ${newStock} ${prod.unit} (تغییر: ${delta >= 0 ? `+${delta}` : delta})${note ? ` — شرح: ${note}` : ''}`,
      severity: 'warning',
      entityType: 'product',
      entityId: prod.id,
      entityLabel: `${prod.name}${variantLabel}`,
      metadata: {
        adjustType: type,
        previousStock: currentStock,
        delta,
        newStock,
        unit: prod.unit,
        note: note || null,
      },
    });

    showToast(`موجودی انبار "${prod.name}${variantLabel}" به ${newStock} ${prod.unit} تغییر یافت.`);
  };

  // 6.1 IMPORT PRODUCTS FROM EXCEL
  const handleImportProducts = (importedProducts: Product[], mode: 'merge' | 'replace') => {
    if (!canCurrentUserManageInventory()) {
      showToast('دسترسی غیرمجاز: سمت کاربری شما مجوز ایمپورت دسته‌جمعی کالاها را ندارد.');
      return;
    }
    let updated: Product[];
    if (mode === 'replace') {
      updated = importedProducts;
    } else {
      const map = new Map<string, Product>(products.map((p) => [p.code, p]));
      importedProducts.forEach((p) => map.set(p.code, p));
      updated = Array.from(map.values()) as Product[];
    }
    setProducts(updated);
    StorageService.saveProducts(updated);

    StorageService.logActivity({
      category: 'warehouse',
      actionType: 'import_products_excel',
      actionTitle: 'ایمپورت اکسل کالاها',
      details: `ورود ${importedProducts.length} کالا از فایل اکسل به شیوه ${mode === 'replace' ? 'جایگزینی کل' : 'ترکیب و بروزرسانی'}`,
      severity: mode === 'replace' ? 'critical' : 'warning',
      entityType: 'product',
      metadata: {
        importedCount: importedProducts.length,
        mode,
        totalAfterImport: updated.length,
      },
    });

    showToast(`تعداد ${importedProducts.length.toLocaleString('fa-IR')} کالا با موفقیت از فایل اکسل وارد انبار شد.`);
  };

  // 6.2 IMPORT CUSTOMERS FROM EXCEL
  const handleImportCustomers = (importedCustomers: Customer[], mode: 'merge' | 'replace') => {
    if (currentUser && !canUserModifyCustomers(currentUser)) {
      showToast('دسترسی غیرمجاز: سمت کاربری شما مجوز ایمپورت مشتریان را ندارد.');
      return;
    }
    let updated: Customer[];
    if (mode === 'replace') {
      updated = importedCustomers;
    } else {
      const map = new Map<string, Customer>(customers.map((c) => [c.name.trim().toLowerCase(), c]));
      importedCustomers.forEach((c) => map.set(c.name.trim().toLowerCase(), c));
      updated = Array.from(map.values()) as Customer[];
    }
    setCustomers(updated);
    StorageService.saveCustomers(updated);

    StorageService.logActivity({
      category: 'customer',
      actionType: 'import_customers_excel',
      actionTitle: 'ایمپورت اکسل مشتریان',
      details: `ورود ${importedCustomers.length} طرف‌حساب از فایل اکسل به شیوه ${mode === 'replace' ? 'جایگزینی کل' : 'ترکیب و بروزرسانی'}`,
      severity: mode === 'replace' ? 'critical' : 'warning',
      entityType: 'customer',
      metadata: {
        importedCount: importedCustomers.length,
        mode,
        totalAfterImport: updated.length,
      },
    });

    showToast(`تعداد ${importedCustomers.length.toLocaleString('fa-IR')} مشتری با موفقیت از فایل اکسل وارد سامانه شد.`);
  };

  // 7. CUSTOMERS MANAGEMENT
  const handleSaveCustomer = (customer: Customer) => {
    if (currentUser && !canUserModifyCustomers(currentUser)) {
      showToast('دسترسی غیرمجاز: سمت کاربری شما مجوز ثبت یا ویرایش مشتریان را ندارد.');
      return;
    }
    let updated: Customer[];
    const exists = customers.some((c) => c.id === customer.id);
    if (exists) {
      updated = customers.map((c) => (c.id === customer.id ? customer : c));
    } else {
      updated = [customer, ...customers];
    }
    setCustomers(updated);
    StorageService.saveCustomers(updated);

    StorageService.logActivity({
      category: 'customer',
      actionType: exists ? 'edit_customer' : 'create_customer',
      actionTitle: exists ? 'ویرایش طرف‌حساب' : 'تعریف مشتری جدید',
      details: `ذخیره اطلاعات مشتری «${customer.name}» (${customer.phone || 'بدون تماس'}${customer.address ? ` • ${customer.address}` : ''})`,
      severity: exists ? 'warning' : 'info',
      entityType: 'customer',
      entityId: customer.id,
      entityLabel: customer.name,
      metadata: {
        phone: customer.phone || null,
        nationalId: customer.nationalId || null,
        customerType: customer.customerType || 'regular',
      },
    });

    showToast(`اطلاعات مشتری "${customer.name}" ذخیره شد.`);
  };

  const handleAddNewCustomerQuick = (customerData: Omit<Customer, 'id' | 'createdAt'>): Customer => {
    const newCust: Customer = {
      ...customerData,
      id: `cust-${Date.now()}`,
      createdAt: getCurrentJalaliDate(),
    };
    if (
      currentUser &&
      !canUserModifyCustomers(currentUser) &&
      !canUserCreateSalesInvoice(currentUser)
    ) {
      return newCust;
    }
    const updated = [newCust, ...customers];
    setCustomers(updated);
    StorageService.saveCustomers(updated);
    StorageService.logActivity({
      category: 'customer',
      actionType: 'create_customer',
      actionTitle: 'ثبت سریع مشتری جدید (حین صدور فاکتور)',
      details: `تعریف سریع مشتری «${newCust.name}» (${newCust.phone || 'بدون تماس'})`,
      severity: 'info',
      entityType: 'customer',
      entityId: newCust.id,
      entityLabel: newCust.name,
      metadata: {
        phone: newCust.phone || null,
        quickAdd: true,
      },
    });
    showToast(`مشتری "${newCust.name}" در دفترچه مشتریان ذخیره شد.`);
    return newCust;
  };

  const handleDeleteCustomer = (customerId: string) => {
    if (currentUser && !canUserModifyCustomers(currentUser)) {
      showToast('دسترسی غیرمجاز: سمت کاربری شما مجوز حذف مشتریان را ندارد.');
      return;
    }
    const cust = customers.find((c) => c.id === customerId);
    StorageService.deleteCustomer(customerId);
    const updated = StorageService.getCustomers();
    setCustomers(updated);

    StorageService.logActivity({
      category: 'customer',
      actionType: 'delete_customer',
      actionTitle: 'حذف طرف‌حساب/مشتری',
      details: `حذف مشتری «${cust?.name || customerId}» (${cust?.phone || 'بدون تماس'}) از دفترچه طرف‌حساب‌ها`,
      severity: 'critical',
      entityType: 'customer',
      entityId: customerId,
      entityLabel: cust?.name || customerId,
      metadata: {
        phone: cust?.phone || null,
      },
    });

    showToast('مشتری حذف شد.');
  };

  const handleSelectCustomerForInvoice = (customer: Customer) => {
    if (currentUser && !canUserCreateSalesInvoice(currentUser)) {
      showToast('دسترسی غیرمجاز: سمت کاربری شما مجوز صدور فاکتور فروش را ندارد.');
      return;
    }
    setActiveTab('new-invoice');
  };

  // 7.1 CUSTOMER TRANSACTIONS (صورتحساب، ثبت واریزی و بدهی مشتری)
  const handleSaveCustomerTransaction = (txn: CustomerTransaction) => {
    if (
      currentUser &&
      (isReadOnlyUser(currentUser) ||
        (!canUserModifyCustomers(currentUser) && !canUserSettleInvoice(currentUser)))
    ) {
      showToast('دسترسی غیرمجاز: سمت کاربری شما مجوز ثبت تراکنش مالی را ندارد.');
      return;
    }
    StorageService.addCustomerTransaction(txn);
    const updatedTxns = StorageService.getCustomerTransactions();
    setCustomerTransactions(updatedTxns);

    StorageService.logActivity({
      category: 'customer',
      actionType: txn.type === 'deposit' ? 'customer_deposit' : 'customer_debt',
      actionTitle: txn.type === 'deposit' ? 'ثبت واریزی طرف‌حساب' : 'ثبت سند بدهی مشتری',
      details: `${txn.type === 'deposit' ? 'واریز' : 'بدهی'} به مبلغ ${txn.amount.toLocaleString('fa-IR')} ${settings.currency} برای «${txn.customerName}» (${txn.title || 'سند مالی'})`,
      severity: 'info',
      entityType: 'transaction',
      entityId: txn.id,
      entityLabel: `${txn.customerName} (${txn.amount.toLocaleString('fa-IR')})`,
      metadata: {
        type: txn.type,
        amount: txn.amount,
        paymentMethod: txn.paymentMethod || null,
        customerName: txn.customerName,
        title: txn.title || null,
      },
    });

    showToast(
      txn.type === 'deposit'
        ? `واریزی به مبلغ ${txn.amount.toLocaleString('fa-IR')} ${settings.currency} در حساب «${txn.customerName}» ثبت شد.`
        : `سند بدهی به مبلغ ${txn.amount.toLocaleString('fa-IR')} ${settings.currency} برای «${txn.customerName}» ثبت شد.`
    );
  };

  const handleDeleteCustomerTransaction = (txnId: string) => {
    if (
      currentUser &&
      (isReadOnlyUser(currentUser) ||
        (!canUserModifyCustomers(currentUser) && !canUserSettleInvoice(currentUser)))
    ) {
      showToast('دسترسی غیرمجاز: سمت کاربری شما مجوز حذف تراکنش مالی را ندارد.');
      return;
    }
    const txn = customerTransactions.find((t) => t.id === txnId);
    StorageService.deleteCustomerTransaction(txnId);
    const updated = StorageService.getCustomerTransactions();
    setCustomerTransactions(updated);

    StorageService.logActivity({
      category: 'customer',
      actionType: 'delete_customer_transaction',
      actionTitle: 'حذف تراکنش مالی مشتری',
      details: `حذف سند مالی به مبلغ ${txn?.amount.toLocaleString('fa-IR') || '-'} ${settings.currency} از پرونده «${txn?.customerName || '-'}»`,
      severity: 'critical',
      entityType: 'transaction',
      entityId: txnId,
      entityLabel: txn?.customerName || txnId,
      metadata: {
        type: txn?.type || null,
        amount: txn?.amount ?? null,
        customerName: txn?.customerName || null,
      },
    });

    showToast('سند مالی مورد نظر حذف شد.');
  };

  // 7.5 PURCHASE INVOICES & WAREHOUSE INBOUND RECEIPTS
  const handleSavePurchaseInvoice = (
    newPurchaseInvoice: PurchaseInvoice,
    newInboundReceipt: InboundReceipt | null,
    newProductsCreated: Product[]
  ) => {
    const existingPurchase = purchaseInvoices.find((p) => p.id === newPurchaseInvoice.id);
    const isEdit = Boolean(existingPurchase);

    // بررسی سطح دسترسی: ثبت فاکتور خرید جدید نیازمند canCreatePurchaseInvoice است.
    // اگر صرفاً تغییر وضعیت تسویه فاکتور موجود باشد، دسترسی canSettleInvoices نیز مجاز است.
    if (currentUser && currentUser.role !== 'admin') {
      const canCreatePurchase =
        currentUser.role !== 'accountant' &&
        Boolean(currentUser.permissions.canCreatePurchaseInvoice);
      const canSettle = Boolean(
        currentUser.permissions.canSettleInvoices ??
          (currentUser.permissions.canCreateInvoice || currentUser.permissions.canViewReports)
      );

      const isOnlySettlementUpdate =
        isEdit &&
        existingPurchase &&
        existingPurchase.finalTotal === newPurchaseInvoice.finalTotal &&
        existingPurchase.items.length === newPurchaseInvoice.items.length &&
        newProductsCreated.length === 0;

      if (!canCreatePurchase && !(isOnlySettlementUpdate && canSettle)) {
        showToast('دسترسی غیرمجاز: سمت کاربری شما مجوز ثبت یا ویرایش فاکتور خرید کالا و خدمات را ندارد.');
        return;
      }
    }

    if (newProductsCreated && newProductsCreated.length > 0) {
      newProductsCreated.forEach((p) => StorageService.saveProduct(p));
    }

    // If edited to service-only and previously had an inbound receipt, remove old receipt
    if (isEdit && existingPurchase?.inboundReceiptId && !newInboundReceipt) {
      StorageService.deleteInboundReceipt(existingPurchase.inboundReceiptId);
    }

    const activeUser = currentUser || StorageService.getLoggedInUser();
    const activeUserName = activeUser ? (activeUser.fullName || activeUser.name || activeUser.username) : 'مدیر سیستم';
    const activeUserRole = activeUser ? (activeUser.roleTitle || activeUser.role) : 'مدیر کل سیستم';

    const enrichedPurchaseInvoice: PurchaseInvoice = {
      ...newPurchaseInvoice,
      createdById: isEdit
        ? existingPurchase?.createdById || newPurchaseInvoice.createdById || activeUser?.id
        : newPurchaseInvoice.createdById || activeUser?.id,
      createdByName: isEdit
        ? existingPurchase?.createdByName || newPurchaseInvoice.createdByName || activeUserName
        : newPurchaseInvoice.createdByName || activeUserName,
      createdByRole: isEdit
        ? existingPurchase?.createdByRole || newPurchaseInvoice.createdByRole || activeUserRole
        : newPurchaseInvoice.createdByRole || activeUserRole,
      updatedById: isEdit ? activeUser?.id : newPurchaseInvoice.updatedById,
      updatedByName: isEdit ? activeUserName : newPurchaseInvoice.updatedByName,
    };

    StorageService.savePurchaseInvoice(enrichedPurchaseInvoice);
    if (newInboundReceipt) {
      StorageService.saveInboundReceipt(newInboundReceipt);
    }
    loadData(true);

    const isServiceOnly = Boolean(newPurchaseInvoice.isServiceOnly || !newInboundReceipt);

    StorageService.logActivity({
      category: 'purchase',
      actionType: isEdit ? 'edit_purchase_invoice' : 'create_purchase_invoice',
      actionTitle: isEdit
        ? 'ویرایش فاکتور خرید'
        : isServiceOnly
        ? 'ثبت فاکتور خرید خدمات و هزینه'
        : 'ثبت فاکتور خرید و صدور حواله ورود',
      details: isEdit
        ? `ویرایش فاکتور خرید ${newPurchaseInvoice.invoiceNumber} از «${newPurchaseInvoice.supplierName}» به مبلغ ${newPurchaseInvoice.finalTotal.toLocaleString('fa-IR')} ${settings.currency}`
        : isServiceOnly
        ? `ثبت فاکتور خرید خدمات ${newPurchaseInvoice.invoiceNumber} از «${newPurchaseInvoice.supplierName}» به مبلغ ${newPurchaseInvoice.finalTotal.toLocaleString('fa-IR')} ${settings.currency}`
        : `ثبت فاکتور خرید ${newPurchaseInvoice.invoiceNumber} از «${newPurchaseInvoice.supplierName}» به مبلغ ${newPurchaseInvoice.finalTotal.toLocaleString('fa-IR')} ${settings.currency} و صدور حواله ورود ${newInboundReceipt?.receiptNumber || ''}`,
      severity: isEdit ? 'warning' : 'info',
      entityType: 'purchase',
      entityId: newPurchaseInvoice.id,
      entityLabel: `#${newPurchaseInvoice.invoiceNumber} (${newPurchaseInvoice.supplierName})`,
      metadata: {
        invoiceNumber: newPurchaseInvoice.invoiceNumber,
        supplierName: newPurchaseInvoice.supplierName,
        itemsCount: newPurchaseInvoice.items.length,
        finalTotal: newPurchaseInvoice.finalTotal,
        paidAmount: newPurchaseInvoice.paidAmount,
        isServiceOnly,
        inboundReceiptNumber: newInboundReceipt?.receiptNumber || null,
      },
    });

    showToast(
      isEdit
        ? `تغییرات فاکتور خرید شماره ${newPurchaseInvoice.invoiceNumber} با موفقیت ذخیره شد.`
        : isServiceOnly
        ? `فاکتور خرید خدمات شماره ${newPurchaseInvoice.invoiceNumber} و وضعیت پرداخت هزینه با موفقیت ثبت گردید.`
        : `فاکتور خرید شماره ${newPurchaseInvoice.invoiceNumber} ثبت شد و حواله ورود ${newInboundReceipt?.receiptNumber || ''} به انبار ارسال گردید.`
    );

    // ارسال خودکار گزارش فاکتور خرید و حواله ورود کالا به تلگرام
    if (!isEdit) {
      const liveSettings = StorageService.getSettings() || settings;
      if (liveSettings.telegramBotEnabled) {
        if (liveSettings.telegramAutoSendPurchaseInvoice || liveSettings.telegramAutoSendInvoice) {
          autoSendPurchaseInvoiceReportToTelegram(newPurchaseInvoice, liveSettings, {
            onStart: () => showToast('در حال ارسال گزارش فاکتور خرید به تلگرام...'),
            onSuccess: (msg) => showToast(msg || '✈️ گزارش فاکتور خرید به تلگرام ارسال گردید.'),
            onError: (err) => showToast('⚠️ خطا در ارسال فاکتور خرید به تلگرام: ' + err),
          });
        }
        if (newInboundReceipt && (liveSettings.telegramAutoSendInboundReceipt || liveSettings.telegramAutoSendInboundReceiptIssue)) {
          autoSendInboundReceiptReportToTelegram(newInboundReceipt, false, liveSettings, {
            onStart: () => showToast('در حال ارسال خودکار گزارش حواله ورود به تلگرام...'),
            onSuccess: (msg) => showToast(msg || '✈️ گزارش حواله ورود به تلگرام ارسال گردید.'),
            onError: (err) => showToast('⚠️ خطا در ارسال گزارش به تلگرام: ' + err),
          });
        }
        if (newPurchaseInvoice.paidAmount > 0 && liveSettings.telegramAutoSendSupplierPayment !== false) {
          autoSendSupplierPaymentReportToTelegram(
            {
              supplierName: newPurchaseInvoice.supplierName,
              supplierPhone: newPurchaseInvoice.supplierPhone,
              amount: newPurchaseInvoice.paidAmount,
              paymentMethod: newPurchaseInvoice.paymentMethod,
              trackingNumber: newPurchaseInvoice.transferDescription,
              bankName: undefined,
              chequeDueDate: newPurchaseInvoice.chequeDueDate,
              invoiceNumber: newPurchaseInvoice.invoiceNumber,
              date: newPurchaseInvoice.date,
              title: `پرداخت وجه فاکتور خرید ${newPurchaseInvoice.invoiceNumber}`,
              notes: newPurchaseInvoice.notes,
              recordedBy: currentUser?.fullName || currentUser?.username || 'مدیر سیستم',
            },
            liveSettings,
            {
              onSuccess: (msg) => showToast(msg || '✈️ رسید پرداخت به تامین‌کننده به تلگرام ارسال گردید.'),
            }
          ).catch((err) => console.warn('[Telegram Auto-Send] Purchase invoice payment report error:', err));
        }
      }
    }
  };

  const handleDeletePurchaseInvoice = (invoiceId: string) => {
    if (currentUser && currentUser.role !== 'admin' && !currentUser.permissions.canDeleteInvoice) {
      showToast('دسترسی غیرمجاز: سمت کاربری شما مجوز حذف فاکتور خرید را ندارد.');
      return;
    }
    const inv = purchaseInvoices.find((p) => p.id === invoiceId);
    if (inv?.inboundReceiptId) {
      StorageService.deleteInboundReceipt(inv.inboundReceiptId);
    }
    StorageService.deletePurchaseInvoice(invoiceId);
    loadData(true);

    StorageService.logActivity({
      category: 'purchase',
      actionType: 'delete_purchase_invoice',
      actionTitle: 'حذف فاکتور خرید',
      details: `حذف فاکتور خرید شماره ${inv?.invoiceNumber || invoiceId} تامین‌کننده «${inv?.supplierName || '-'}» به مبلغ ${(inv?.finalTotal || 0).toLocaleString('fa-IR')} ${settings.currency}`,
      severity: 'critical',
      entityType: 'purchase',
      entityId: invoiceId,
      entityLabel: inv ? `#${inv.invoiceNumber} (${inv.supplierName})` : invoiceId,
      metadata: {
        invoiceNumber: inv?.invoiceNumber || null,
        supplierName: inv?.supplierName || null,
        finalTotal: inv?.finalTotal ?? null,
      },
    });

    showToast('فاکتور خرید حذف گردید.');
  };

  const handleConfirmInboundReceipt = (
    receiptId: string,
    verifiedItems: InboundReceiptItem[],
    warehouseNotes: string,
    verifiedBy: string
  ) => {
    if (!canCurrentUserManageInventory()) {
      showToast('دسترسی غیرمجاز: سمت کاربری شما مجوز تایید حواله ورود به انبار را ندارد.');
      return;
    }
    const receipt = inboundReceipts.find((r) => r.id === receiptId);
    if (!receipt) return;

    const hasDiscrepancy = verifiedItems.some((i) => i.discrepancy !== 0);
    const newStatus: InboundReceiptStatus = hasDiscrepancy ? 'has_discrepancy' : 'confirmed';

    // 1. Update Inbound Receipt
    const updatedReceipt: InboundReceipt = {
      ...receipt,
      items: verifiedItems,
      totalReceivedQuantity: verifiedItems.reduce((sum, i) => sum + i.receivedQuantity, 0),
      totalDiscrepancy: verifiedItems.reduce((sum, i) => sum + i.discrepancy, 0),
      status: newStatus,
      warehouseNotes,
      verifiedBy,
      verifiedDate: getCurrentJalaliDate(),
    };
    StorageService.saveInboundReceipt(updatedReceipt);

    // 2. Increase inventory stock for each product by receivedQuantity and record movements
    verifiedItems.forEach((item) => {
      if (item.receivedQuantity > 0) {
        StorageService.adjustStock(
          item.productId,
          'purchase',
          item.receivedQuantity,
          `ورود به انبار طی حواله ${receipt.receiptNumber} (فاکتور خرید ${receipt.purchaseInvoiceNumber})${
            item.discrepancy !== 0
              ? ` [مغایرت: ${item.discrepancy > 0 ? '+' : ''}${item.discrepancy} ${item.discrepancyReason || ''}]`
              : ''
          }`,
          receipt.purchaseInvoiceNumber
        );
      }
    });

    // 3. Update corresponding Purchase Invoice status
    const purchaseInv = purchaseInvoices.find((p) => p.id === receipt.purchaseInvoiceId);
    if (purchaseInv) {
      const updatedPurchaseInv: PurchaseInvoice = {
        ...purchaseInv,
        status: hasDiscrepancy ? 'has_discrepancy' : 'completed',
      };
      StorageService.savePurchaseInvoice(updatedPurchaseInv);
    }

    loadData(true);

    // ارسال خودکار گزارش تایید رسید ورود انبار به تلگرام
    const liveSettings = StorageService.getSettings() || settings;
    if (liveSettings.telegramBotEnabled && (liveSettings.telegramAutoSendInboundReceipt || liveSettings.telegramAutoSendInboundReceiptConfirm)) {
      autoSendInboundReceiptReportToTelegram(updatedReceipt, true, liveSettings, {
        onStart: () => showToast('در حال ارسال خودکار گزارش تایید ورود به تلگرام...'),
        onSuccess: (msg) => showToast(msg || '✈️ گزارش تایید ورود کالا با موفقیت به تلگرام ارسال شد.'),
        onError: (err) => showToast('⚠️ خطا در ارسال گزارش تایید ورود به تلگرام: ' + err),
      });
    }

    StorageService.logActivity({
      category: 'warehouse',
      actionType: hasDiscrepancy ? 'verify_inbound_discrepancy' : 'verify_inbound_success',
      actionTitle: hasDiscrepancy ? 'تایید حواله ورود با مغایرت' : 'تایید حواله ورود به انبار',
      details: `تایید حواله ورود ${receipt.receiptNumber} مربوط به فاکتور خرید ${receipt.purchaseInvoiceNumber} توسط ${verifiedBy}${hasDiscrepancy ? ' (همراه با ثبت مغایرت)' : ''}`,
      severity: hasDiscrepancy ? 'warning' : 'info',
      entityType: 'inbound_receipt',
      entityId: receipt.id,
      entityLabel: receipt.receiptNumber,
      metadata: {
        receiptNumber: receipt.receiptNumber,
        purchaseInvoiceNumber: receipt.purchaseInvoiceNumber,
        verifiedBy,
        totalReceivedQuantity: updatedReceipt.totalReceivedQuantity,
        totalDiscrepancy: updatedReceipt.totalDiscrepancy,
        hasDiscrepancy,
      },
    });

    showToast(
      hasDiscrepancy
        ? `حواله ورود ${receipt.receiptNumber} با ثبت مغایرت تایید شد و موجودی انبار به‌روزرسانی گردید.`
        : `حواله ورود ${receipt.receiptNumber} به طور کامل تایید شد و موجودی انبار افزایش یافت.`
    );
  };

  // 8. USERS & ACCESS MANAGEMENT
  const handleAddUser = (userData: Omit<AppUser, 'id' | 'createdAt'>): { success: boolean; message?: string } => {
    const callerIsFullAdmin = !currentUser || currentUser.role === 'admin' || Boolean(currentUser.permissions?.canAccessAdmin);
    const callerCanManage = !currentUser || callerIsFullAdmin || Boolean(currentUser.permissions?.canManageUsers);
    if (!callerCanManage || isReadOnlyUser(currentUser)) {
      const msg = 'دسترسی غیرمجاز: شما مجوز تعریف کاربر جدید را ندارید.';
      showToast(msg);
      return { success: false, message: msg };
    }
    if (!callerIsFullAdmin && (userData.role === 'admin' || userData.permissions?.canAccessAdmin)) {
      const msg = 'تعریف کاربر مدیر کل فقط توسط مدیر سیستم مجاز است.';
      showToast(msg);
      return { success: false, message: msg };
    }

    const sanitizedInput = callerIsFullAdmin
      ? userData
      : {
          ...userData,
          permissions: { ...userData.permissions, canAccessAdmin: false },
        };

    const newUser = StorageService.addUser(sanitizedInput);
    const updatedUsers = StorageService.getUsers();
    setUsers(updatedUsers);

    StorageService.logActivity({
      category: 'users',
      actionType: 'create_user',
      actionTitle: 'تعریف کاربر جدید',
      details: `تعریف حساب کاربری جدید برای «${newUser.fullName}» (${newUser.username}) با نقش ${newUser.roleTitle || newUser.role}`,
      severity: 'warning',
      entityType: 'user',
      entityId: newUser.id,
      entityLabel: `${newUser.fullName} (${newUser.username})`,
      metadata: {
        role: newUser.role,
        roleTitle: newUser.roleTitle || newUser.role,
        isActive: newUser.isActive !== false,
      },
    });

    showToast(`کاربر جدید «${newUser.fullName}» با موفقیت ثبت شد.`);
    return { success: true };
  };

  const handleUpdateUser = (user: AppUser): { success: boolean; message?: string } => {
    const callerIsFullAdmin = !currentUser || currentUser.role === 'admin' || Boolean(currentUser.permissions?.canAccessAdmin);
    const callerCanManage = !currentUser || callerIsFullAdmin || Boolean(currentUser.permissions?.canManageUsers);
    if (!callerCanManage || isReadOnlyUser(currentUser)) {
      const msg = 'دسترسی غیرمجاز: شما مجوز ویرایش کاربران را ندارید.';
      showToast(msg);
      return { success: false, message: msg };
    }

    const prevUser = users.find((u) => u.id === user.id);
    if (!callerIsFullAdmin) {
      if (prevUser && (prevUser.role === 'admin' || prevUser.permissions?.canAccessAdmin)) {
        const msg = 'تغییر یا مدیریت حساب‌های مدیر کل فقط برای مدیر سیستم مجاز است.';
        showToast(msg);
        return { success: false, message: msg };
      }
      if (user.role === 'admin' || user.permissions?.canAccessAdmin) {
        const msg = 'ارتقاء سطح دسترسی به مدیر کل فقط برای مدیر سیستم مجاز است.';
        showToast(msg);
        return { success: false, message: msg };
      }
    }

    if (currentUser?.id === user.id && !user.isActive) {
      const msg = 'امکان غیرفعال‌سازی حساب کاربری فعال فعلی وجود ندارد.';
      showToast(msg);
      return { success: false, message: msg };
    }

    const activeAdminsBefore = users.filter((u) => (u.role === 'admin' || u.permissions?.canAccessAdmin) && u.isActive);
    const prevWasAdmin = Boolean(prevUser && (prevUser.role === 'admin' || prevUser.permissions?.canAccessAdmin) && prevUser.isActive);
    const nextIsAdmin = Boolean((user.role === 'admin' || user.permissions?.canAccessAdmin) && user.isActive);
    if (prevWasAdmin && !nextIsAdmin && activeAdminsBefore.length <= 1) {
      const msg = 'حداقل یک کاربر مدیر کل فعال باید در سیستم باقی بماند.';
      showToast(msg);
      return { success: false, message: msg };
    }

    const sanitizedUser: AppUser = callerIsFullAdmin
      ? user
      : {
          ...user,
          permissions: { ...user.permissions, canAccessAdmin: false },
        };

    StorageService.updateUser(sanitizedUser);
    const updatedUsers = StorageService.getUsers();
    setUsers(updatedUsers);

    if (currentUser?.id === sanitizedUser.id) {
      const refreshedSelf = updatedUsers.find((u) => u.id === sanitizedUser.id) || sanitizedUser;
      setCurrentUser(refreshedSelf);
      StorageService.setCurrentUser(refreshedSelf);
    }

    const changeNotes: string[] = [];
    if (prevUser && prevUser.role !== sanitizedUser.role) {
      changeNotes.push(`تغییر نقش از «${prevUser.roleTitle || prevUser.role}» به «${sanitizedUser.roleTitle || sanitizedUser.role}»`);
    }
    if (prevUser && prevUser.isActive !== sanitizedUser.isActive) {
      changeNotes.push(sanitizedUser.isActive ? 'فعال‌سازی حساب' : 'غیرفعال‌سازی حساب');
    }
    if (sanitizedUser.password && sanitizedUser.password.trim()) {
      changeNotes.push('تغییر رمز عبور');
    }

    StorageService.logActivity({
      category: 'users',
      actionType: 'edit_user',
      actionTitle: 'ویرایش اطلاعات و دسترسی کاربر',
      details: `به‌روزرسانی اطلاعات و دسترسی‌های کاربر «${sanitizedUser.fullName}» (${sanitizedUser.username})${changeNotes.length > 0 ? ` — ${changeNotes.join('، ')}` : ''}`,
      severity: sanitizedUser.password || (prevUser && prevUser.role !== sanitizedUser.role) ? 'critical' : 'warning',
      entityType: 'user',
      entityId: sanitizedUser.id,
      entityLabel: `${sanitizedUser.fullName} (${sanitizedUser.username})`,
      metadata: {
        role: sanitizedUser.role,
        isActive: sanitizedUser.isActive !== false,
        passwordChanged: Boolean(sanitizedUser.password && sanitizedUser.password.trim()),
      },
    });

    showToast(`اطلاعات کاربر «${sanitizedUser.fullName}» به‌روزرسانی شد.`);
    return { success: true };
  };

  const handleDeleteUser = (userId: string): { success: boolean; message?: string } => {
    const callerIsFullAdmin = !currentUser || currentUser.role === 'admin' || Boolean(currentUser.permissions?.canAccessAdmin);
    const callerCanManage = !currentUser || callerIsFullAdmin || Boolean(currentUser.permissions?.canManageUsers);
    if (!callerCanManage || isReadOnlyUser(currentUser)) {
      const msg = 'دسترسی غیرمجاز: شما مجوز حذف کاربران را ندارید.';
      showToast(msg);
      return { success: false, message: msg };
    }
    if (currentUser?.id === userId) {
      showToast('امکان حذف کاربر فعال فعلی وجود ندارد.');
      return { success: false, message: 'امکان حذف کاربر فعال فعلی وجود ندارد.' };
    }
    const targetUser = users.find((u) => u.id === userId);
    if (!callerIsFullAdmin && targetUser && (targetUser.role === 'admin' || targetUser.permissions?.canAccessAdmin)) {
      const msg = 'حذف حساب‌های مدیر کل فقط برای مدیر سیستم مجاز است.';
      showToast(msg);
      return { success: false, message: msg };
    }
    const result = StorageService.deleteUser(userId);
    if (result.success) {
      const updatedUsers = StorageService.getUsers();
      setUsers(updatedUsers);
      const active = StorageService.getLoggedInUser() || StorageService.getCurrentUser();
      setCurrentUser(active);

      StorageService.logActivity({
        category: 'users',
        actionType: 'delete_user',
        actionTitle: 'حذف حساب کاربری',
        details: `حذف حساب کاربری «${targetUser?.fullName || userId}» (${targetUser?.username || ''})`,
        severity: 'critical',
        entityType: 'user',
        entityId: userId,
        entityLabel: targetUser ? `${targetUser.fullName} (${targetUser.username})` : userId,
      });

      showToast('کاربر با موفقیت حذف شد.');
    }
    return result;
  };

  const handleRequestLogin = (targetUser?: AppUser | null) => {
    setLoginTargetUser(targetUser || null);
    setIsLoginModalOpen(true);
  };

  const handleLoginSuccess = (user: AppUser) => {
    setCurrentUser(user);
    StorageService.setCurrentUser(user);
    setIsLoginModalOpen(false);
    setLoginTargetUser(null);

    // Pull authoritative server state (including server-recorded login audit entry) right after login
    StorageService.syncFromServer(true).then(() => {
      loadData(true);
    });

    // Intelligently route user to the primary view matching their granted permissions
    const landingTab = getDefaultTabForUser(user, settings);
    setActiveTab(landingTab);

    showToast(`ورود موفقیت‌آمیز بود. خوش آمدید «${user.fullName}» (${user.roleTitle || user.role}).`);
  };

  const handleLogout = () => {
    logoutFromServer();
    StorageService.logout();
    setCurrentUser(null);
    setLoginTargetUser(null);
    setIsLoginModalOpen(false);
    showToast('شما با موفقیت از حساب کاربری خارج شدید.');
  };

  const handleSwitchUser = (user: AppUser) => {
    handleRequestLogin(user);
  };

  // 9. SETTINGS
  const handleSaveSettings = (newSettings: StoreSettings) => {
    if (isReadOnlyUser(currentUser)) {
      showToast('دسترسی غیرمجاز: حساب کاربری حسابدار فقط امکان مشاهده دارد.');
      return;
    }

    const callerIsFullAdmin = !currentUser || currentUser.role === 'admin' || Boolean(currentUser.permissions?.canAccessAdmin);
    let effectiveSettings = newSettings;

    if (!callerIsFullAdmin) {
      if (!currentUser?.permissions?.canManageInventory) {
        showToast('دسترسی غیرمجاز: سمت کاربری شما مجوز تغییر تنظیمات سامانه را ندارد.');
        return;
      }
      // Inventory managers may only save warehouse definitions, origin warehouse info, and exit slip layout
      effectiveSettings = {
        ...settings,
        warehouses: newSettings.warehouses,
        defaultWarehouseId: newSettings.defaultWarehouseId,
        originWarehouseName: newSettings.originWarehouseName,
        originWarehouseCode: newSettings.originWarehouseCode,
        originWarehouseAddress: newSettings.originWarehouseAddress,
        originWarehousePhone: newSettings.originWarehousePhone,
        originWarehouseManager: newSettings.originWarehouseManager,
        updatedAt: newSettings.updatedAt || new Date().toISOString(),
      };
    }

    const changedSections: string[] = [];
    if (settings.storeName !== effectiveSettings.storeName) changedSections.push('نام فروشگاه');
    if (settings.autoDeductStock !== effectiveSettings.autoDeductStock) changedSections.push(`کسر خودکار انبار (${effectiveSettings.autoDeductStock ? 'فعال' : 'غیرفعال'})`);
    if (settings.taxPercent !== effectiveSettings.taxPercent || settings.taxEnabled !== effectiveSettings.taxEnabled) {
      changedSections.push(`تنظیمات مالیات (${effectiveSettings.taxEnabled ? `${effectiveSettings.taxPercent}٪` : 'غیرفعال'})`);
    }
    if (settings.telegramBotToken !== effectiveSettings.telegramBotToken || settings.telegramChatId !== effectiveSettings.telegramChatId) {
      changedSections.push('تنظیمات ربات تلگرام');
    }
    if ((settings.warehouses?.length || 0) !== (effectiveSettings.warehouses?.length || 0)) {
      changedSections.push('ساختار انبارها');
    }

    setSettings(effectiveSettings);
    StorageService.saveSettings(effectiveSettings);

    StorageService.logActivity({
      category: 'settings',
      actionType: 'update_settings',
      actionTitle: callerIsFullAdmin ? 'به‌روزرسانی تنظیمات سامانه' : 'به‌روزرسانی تنظیمات انبار و حواله',
      details: `ذخیره پیکربندی سامانه${changedSections.length > 0 ? `: ${changedSections.join('، ')}` : ' (قوانین فاکتور و اطلاعات فروشگاه)'}`,
      severity: 'warning',
      entityType: 'settings',
      entityLabel: effectiveSettings.storeName || 'تنظیمات کلی',
      metadata: {
        autoDeductStock: Boolean(effectiveSettings.autoDeductStock),
        taxEnabled: Boolean(effectiveSettings.taxEnabled),
        taxPercent: Number(effectiveSettings.taxPercent || 0),
        warehousesCount: Array.isArray(effectiveSettings.warehouses) ? effectiveSettings.warehouses.length : 0,
      },
    });

    showToast('تنظیمات فروشگاه با موفقیت ذخیره شد.');
  };

  // Low stock count for alert badge
  const lowStockCount = products.filter((p) => p.stock <= p.minStockAlert).length;
  const pendingInboundCount = inboundReceipts.filter((r) => r.status === 'pending_verification').length;

  // 0. Dedicated Customer Public Web Invoice view (Zero login required for customers)
  if (publicInvoiceToken) {
    return (
      <PublicWebInvoiceView
        token={publicInvoiceToken}
        onBackToApp={() => {
          window.history.pushState({}, '', '/');
          setPublicInvoiceToken(null);
        }}
      />
    );
  }

  // 0.1 Dedicated Standalone Live Preview in separate window / browser tab
  if (isStandalonePreview) {
    return (
      <StandaloneLivePreviewView
        onBackToApp={() => {
          window.history.pushState({}, '', '/');
          setIsStandalonePreview(false);
        }}
      />
    );
  }

  // MANDATORY AUTHENTICATION: Prompt for username and password when opening the application
  if (!currentUser) {
    return (
      <div className="relative">
        {toastMessage && (
          <div className="no-print fixed bottom-6 right-6 z-50 flex items-center gap-2.5 bg-slate-900 text-white text-xs font-semibold px-4 py-3 rounded-xl shadow-xl border border-slate-700 animate-bounce max-w-[90vw]">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{toastMessage}</span>
          </div>
        )}
        <LoginScreen
          settings={settings}
          users={users}
          onLoginSuccess={handleLoginSuccess}
        />
        <ConfirmDialogHost />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100/70 text-slate-800 flex flex-row selection:bg-emerald-500 selection:text-white">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="no-print fixed bottom-20 sm:bottom-6 right-4 sm:right-6 z-50 flex items-center gap-2.5 bg-slate-900 text-white text-xs font-semibold px-4 py-3 rounded-xl shadow-xl border border-slate-700 animate-bounce max-w-[90vw]">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Main App Navigation Sidebar (Desktop sticky & Mobile Drawer) */}
      <Sidebar
        settings={settings}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        inventorySubTab={inventorySubTab}
        onSelectInventorySubTab={(sub) => setInventorySubTab(sub)}
        lowStockCount={lowStockCount}
        pendingInboundCount={pendingInboundCount}
        currentUser={currentUser}
        users={users}
        onSwitchUser={handleSwitchUser}
        onRequestLogin={handleRequestLogin}
        onLogout={handleLogout}
        onOpenNewInvoice={() => {
          setEditingInvoice(null);
          setActiveTab('new-invoice');
        }}
        onOpenSettings={() => {
          if (currentUser.role === 'admin' || currentUser.permissions?.canAccessAdmin) {
            setIsSettingsOpen(true);
          }
        }}
        isOpenMobile={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
        isCollapsedDesktop={isDesktopSidebarCollapsed}
        onToggleCollapseDesktop={handleToggleDesktopSidebarCollapse}
      />

      {/* Main Application Area (Header + Content Views + Modals) */}
      <div className="flex-1 flex flex-col min-w-0 overflow-x-hidden">
        {/* Main App Header */}
        <Header
          settings={settings}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          lowStockCount={lowStockCount}
          currentUser={currentUser || undefined}
          users={users}
          onSwitchUser={handleSwitchUser}
          onRequestLogin={handleRequestLogin}
          onLogout={handleLogout}
          onOpenNewInvoice={() => {
            setEditingInvoice(null);
            setActiveTab('new-invoice');
          }}
          onOpenSettings={() => {
            if (currentUser.role === 'admin' || currentUser.permissions?.canAccessAdmin) {
              setIsSettingsOpen(true);
            }
          }}
          onToggleSidebar={handleToggleSidebar}
        />

      {/* Main Body Content View - Consistent Layout & Padding Across All Tabs */}
      <main className={`flex-1 max-w-7xl w-full mx-auto ${
        activeTab === 'new-invoice'
          ? 'pb-16 sm:pb-12 px-2 sm:px-6 lg:px-8 pt-2 sm:pt-6 flex flex-col'
          : 'pb-24 sm:pb-12 px-3 sm:px-6 lg:px-8 pt-3 sm:pt-6'
      }`}>
        <OfflineIndicator />

        {activeTab === 'dashboard' && isTabPermitted('dashboard', currentUser, settings) && (
          <QuickDashboard
            products={products}
            invoices={invoices}
            customers={customers}
            purchaseInvoices={purchaseInvoices}
            inboundReceipts={inboundReceipts}
            settings={settings}
            currentUser={currentUser}
            onNavigate={(tab) => {
              if (tab === 'direct-transfers') {
                if (isTabPermitted('inventory', currentUser, settings)) {
                  setInventorySubTab('direct-transfers');
                  setActiveTab('inventory');
                }
              } else if (isTabPermitted(tab, currentUser, settings)) {
                if (tab === 'inventory') {
                  setInventorySubTab('items');
                }
                setActiveTab(tab);
              }
            }}
            onNewInvoice={() => {
              if (currentUser?.permissions.canCreateInvoice) {
                setEditingInvoice(null);
                setActiveTab('new-invoice');
              }
            }}
            onViewInvoice={(inv) => setViewingInvoice(inv)}
            onOpenSettings={() => {
              if (currentUser.role === 'admin' || currentUser.permissions?.canAccessAdmin) {
                setIsSettingsOpen(true);
              }
            }}
            onUpdateSettings={handleSaveSettings}
            onLogout={handleLogout}
            onRequestLogin={handleRequestLogin}
            onSaveTransaction={handleSaveCustomerTransaction}
          />
        )}

        {activeTab === 'new-invoice' && isTabPermitted('new-invoice', currentUser, settings) && (
          <InvoiceBuilder
            key={editingInvoice ? `edit-${editingInvoice.id}` : 'new-invoice'}
            products={products}
            customers={customers}
            settings={settings}
            editingInvoice={editingInvoice}
            currentUser={currentUser || undefined}
            onToggleSidebar={handleToggleSidebar}
            onSaveInvoice={handleSaveInvoice}
            onUpdateInvoice={handleUpdateInvoice}
            onAddNewCustomer={handleAddNewCustomerQuick}
            onSaveProduct={handleSaveProduct}
            onCancel={() => {
              setEditingInvoice(null);
              setActiveTab(getDefaultTabForUser(currentUser, settings));
            }}
          />
        )}

        {activeTab === 'invoices' && isTabPermitted('invoices', currentUser, settings) && (
          <InvoicesList
            invoices={invoices}
            products={products}
            settings={settings}
            currentUser={currentUser || undefined}
            onViewInvoice={(inv) => setViewingInvoice(inv)}
            onEditInvoice={isReadOnlyUser(currentUser) ? undefined : handleStartEditInvoice}
            onDeleteInvoice={handleDeleteInvoice}
            onReturnInvoiceToStock={handleReturnInvoiceToStock}
            onUpdatePaymentStatus={handleUpdatePaymentStatus}
            onNewInvoice={() => {
              if (!isReadOnlyUser(currentUser) && currentUser?.permissions.canCreateInvoice) {
                setEditingInvoice(null);
                setActiveTab('new-invoice');
              }
            }}
            onConvertProforma={handleConvertProforma}
            onOpenShareLinkModal={isReadOnlyUser(currentUser) ? undefined : (inv) => setAppShareLinkInvoice(inv)}
            onBatchUpdatePaymentStatus={handleBatchUpdatePaymentStatus}
          />
        )}

        {activeTab === 'purchases' && isTabPermitted('purchases', currentUser, settings) && (
          <PurchaseInvoiceManager
            purchaseInvoices={purchaseInvoices}
            inboundReceipts={inboundReceipts}
            products={products}
            settings={settings}
            currentUser={currentUser || undefined}
            onSavePurchaseInvoice={handleSavePurchaseInvoice}
            onDeletePurchaseInvoice={handleDeletePurchaseInvoice}
            onNavigateToWarehouseReceipt={(receiptId) => {
              setSelectedInboundReceiptId(receiptId);
              setActiveTab('inventory');
            }}
          />
        )}

        {activeTab === 'inventory' && isTabPermitted('inventory', currentUser, settings) && (
          <ErrorBoundary fallbackTitle="خطا در بخش انبارداری و حواله‌ها">
            <InventoryManager
              products={products}
              movements={movements}
              invoices={invoices}
              inboundReceipts={inboundReceipts}
              settings={settings}
              currentUser={currentUser || undefined}
              onSaveProduct={handleSaveProduct}
              onDeleteProduct={handleDeleteProduct}
              onAdjustStock={handleAdjustStock}
              onImportProducts={handleImportProducts}
              onConfirmInboundReceipt={handleConfirmInboundReceipt}
              selectedInboundReceiptId={selectedInboundReceiptId}
              initialSubTab={inventorySubTab}
              onSubTabChange={setInventorySubTab}
              onUpdateSettings={handleSaveSettings}
              onToast={showToast}
            />
          </ErrorBoundary>
        )}

        {activeTab === 'customers' && isTabPermitted('customers', currentUser, settings) && (
          <CustomersManager
            customers={customers}
            invoices={invoices}
            purchaseInvoices={purchaseInvoices}
            transactions={customerTransactions}
            settings={settings}
            currentUser={currentUser || undefined}
            onSaveCustomer={handleSaveCustomer}
            onDeleteCustomer={handleDeleteCustomer}
            onSelectCustomerForInvoice={handleSelectCustomerForInvoice}
            onImportCustomers={handleImportCustomers}
            onBatchUpdatePaymentStatus={handleBatchUpdatePaymentStatus}
            onSaveTransaction={handleSaveCustomerTransaction}
            onDeleteTransaction={handleDeleteCustomerTransaction}
            onViewInvoice={(inv) => setViewingInvoice(inv)}
            onEditInvoice={isReadOnlyUser(currentUser) ? undefined : handleStartEditInvoice}
            onDeleteInvoice={handleDeleteInvoice}
            onUpdatePaymentStatus={handleUpdatePaymentStatus}
            onUpdatePurchaseInvoice={(updatedPi) => {
              if (isReadOnlyUser(currentUser)) return;
              StorageService.savePurchaseInvoice(updatedPi);
              setPurchaseInvoices(StorageService.getPurchaseInvoices());
              showToast(`وضعیت پرداخت فاکتور خرید «${updatedPi.invoiceNumber}» بروزرسانی شد.`);
            }}
          />
        )}

        {activeTab === 'payments' && isTabPermitted('payments', currentUser, settings) && (
          <ErrorBoundary fallbackTitle="خطا در بخش دریافت و پرداخت مشتریان">
            <CustomerPaymentsLedger
              customers={customers}
              invoices={invoices}
              purchaseInvoices={purchaseInvoices}
              transactions={customerTransactions}
              settings={settings}
              currentUser={currentUser || undefined}
              onSaveTransaction={handleSaveCustomerTransaction}
              onDeleteTransaction={handleDeleteCustomerTransaction}
              onViewInvoice={(inv) => setViewingInvoice(inv)}
            />
          </ErrorBoundary>
        )}

        {activeTab === 'reports' && isTabPermitted('reports', currentUser, settings) && (
          <ReportsDashboard
            products={products}
            invoices={invoices}
            purchaseInvoices={purchaseInvoices}
            customers={customers}
            transactions={customerTransactions}
            settings={settings}
            currentUser={currentUser || undefined}
            onOpenNewInvoice={() => {
              if (currentUser?.permissions.canCreateInvoice) {
                setActiveTab('new-invoice');
              }
            }}
            onOpenInventory={() => {
              if (currentUser?.permissions.canManageInventory) {
                setActiveTab('inventory');
              }
            }}
            onViewInvoice={(inv) => setViewingInvoice(inv)}
          />
        )}

        {activeTab === 'admin' && isTabPermitted('admin', currentUser, settings) && (
          <AdminPanel
            settings={settings}
            products={products}
            customers={customers}
            invoices={invoices}
            movements={movements}
            users={users}
            currentUser={currentUser || undefined}
            onAddUser={handleAddUser}
            onUpdateUser={handleUpdateUser}
            onDeleteUser={handleDeleteUser}
            onSwitchUser={handleSwitchUser}
            onSaveSettings={handleSaveSettings}
            onReloadData={() => loadData(true)}
            onNavigateToTab={(tab) => {
              if (isTabPermitted(tab, currentUser, settings)) {
                setActiveTab(tab);
              }
            }}
          />
        )}

        {/* Fallback unauthorized notice if a tab is not permitted for this user */}
        {!isTabPermitted(activeTab, currentUser, settings) && (
          <div className="bg-white rounded-2xl p-8 border border-amber-200/90 shadow-sm text-center max-w-lg mx-auto my-12">
            <div className="w-14 h-14 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto mb-4">
              <ShieldAlert className="w-8 h-8" />
            </div>
            <h2 className="text-base font-bold text-slate-900 mb-1.5">
              عدم دسترسی به این بخش از سیستم
            </h2>
            <p className="text-xs text-slate-500 leading-relaxed mb-6">
              سمت شما در سیستم «<b className="text-slate-800">{currentUser.roleTitle || currentUser.role}</b>» است و دسترسی لازم برای این صفحه تعریف نشده است.
            </p>
            <button
              type="button"
              id="restricted-tab-redirect-btn"
              onClick={() => setActiveTab(getDefaultTabForUser(currentUser, settings))}
              className="bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white text-xs font-bold px-5 py-2.5 rounded-xl cursor-pointer shadow-sm transition-all"
            >
              انتقال به بخش پیش‌فرض و مجاز
            </button>
          </div>
        )}
      </main>

      {/* Printable Invoice Modal */}
      {viewingInvoice && (
        <InvoiceViewModal
          invoice={viewingInvoice}
          settings={settings}
          onClose={() => setViewingInvoice(null)}
          onEditInvoice={
            currentUser?.role === 'admin' || currentUser?.permissions.canCreateInvoice
              ? handleStartEditInvoice
              : undefined
          }
          onConvertProforma={
            currentUser?.role === 'admin' || currentUser?.permissions.canCreateInvoice
              ? (inv) => {
                  const success = handleConvertProforma(inv);
                  if (success !== false) {
                    setViewingInvoice(null);
                  }
                }
              : undefined
          }
        />
      )}

      {/* Settings & Backup Modal */}
      {isSettingsOpen && (currentUser.role === 'admin' || currentUser.permissions?.canAccessAdmin) && (
        <SettingsModal
          settings={settings}
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          onSaveSettings={handleSaveSettings}
          onReloadData={() => loadData(true)}
        />
      )}

      {/* Password Authentication Modal */}
      {isLoginModalOpen && (
        <UserLoginModal
          isOpen={isLoginModalOpen}
          onClose={() => {
            setIsLoginModalOpen(false);
            setLoginTargetUser(null);
          }}
          onLoginSuccess={handleLoginSuccess}
          users={users}
          targetUser={loginTargetUser}
          currentUser={currentUser || undefined}
        />
      )}

      {/* Invoice Public Web Share Link Modal */}
      {appShareLinkInvoice && (
        <InvoiceShareLinkModal
          isOpen={!!appShareLinkInvoice}
          invoice={appShareLinkInvoice}
          settings={settings}
          onClose={() => setAppShareLinkInvoice(null)}
          onUpdateInvoice={(updated) => {
            setAppShareLinkInvoice(updated);
            setInvoices((prev) => prev.map((inv) => (inv.id === updated.id ? updated : inv)));
          }}
        />
      )}

      {/* Mobile Floating PWA Install Widget (Shown only on mobile for 7 seconds) */}
      <MobileFloatingPWAInstall />

      {/* Mobile Bottom Navigation Bar */}
      <MobileBottomNav
        settings={settings}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        lowStockCount={lowStockCount}
        currentUser={currentUser || undefined}
        onNewInvoice={() => {
          setEditingInvoice(null);
          setActiveTab('new-invoice');
        }}
        onLogout={handleLogout}
        onOpenSidebar={() => setIsMobileSidebarOpen(true)}
        onOpenSettings={() => {
          if (currentUser.role === 'admin' || currentUser.permissions?.canAccessAdmin) {
            setIsSettingsOpen(true);
          }
        }}
        onOpenDirectTransfers={() => {
          if (isTabPermitted('inventory', currentUser, settings)) {
            setInventorySubTab('direct-transfers');
            setActiveTab('inventory');
          }
        }}
      />
      </div>
      <ConfirmDialogHost />
    </div>
  );
}
