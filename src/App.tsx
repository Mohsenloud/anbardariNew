/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Product, Customer, Invoice, StockMovement, StoreSettings, AppUser, PurchaseInvoice, InboundReceipt, InboundReceiptItem, InboundReceiptStatus } from './types';
import { StorageService } from './utils/storage';
import { getCurrentJalaliDate } from './utils/jalali';
import { isTabPermitted, getDefaultTabForUser, getRoleBadgeConfig } from './utils/permissions';
import { Header } from './components/Header';
import { InvoiceBuilder } from './components/InvoiceBuilder';
import { InvoicesList } from './components/InvoicesList';
import { InventoryManager } from './components/InventoryManager';
import { QuickDashboard } from './components/QuickDashboard';
import { PurchaseInvoiceManager } from './components/PurchaseInvoiceManager';
import { CustomersManager } from './components/CustomersManager';
import { ReportsDashboard } from './components/ReportsDashboard';
import { InvoiceViewModal } from './components/InvoiceViewModal';
import { SettingsModal } from './components/SettingsModal';
import { AdminPanel } from './components/AdminPanel';
import { MobileBottomNav } from './components/MobileBottomNav';
import { UserLoginModal } from './components/UserLoginModal';
import { LoginScreen } from './components/LoginScreen';
import { OfflineIndicator } from './components/OfflineIndicator';
import { MobileFloatingPWAInstall } from './components/MobileFloatingPWAInstall';
import { CheckCircle2, ShieldAlert } from 'lucide-react';

export default function App() {
  // Application Data States
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
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
  const [selectedInboundReceiptId, setSelectedInboundReceiptId] = useState<string | null>(null);
  const [viewingInvoice, setViewingInvoice] = useState<Invoice | null>(null);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState<boolean>(false);
  const [loginTargetUser, setLoginTargetUser] = useState<AppUser | null>(null);
  const [toastMessage, setToastMessage] = useState<string>('');

  // Load initial data - preserves authenticated user session across page reloads
  const loadData = (preserveCurrentUser = true) => {
    setProducts(StorageService.getProducts());
    setCustomers(StorageService.getCustomers());
    setInvoices(StorageService.getInvoices());
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
    // Initial app opening: restore authenticated user session if present
    loadData(true);

    // Initial server sync
    StorageService.syncFromServer().then((updated) => {
      if (updated) loadData(true);
    });

    // Periodic background synchronization every 12 seconds for multi-user collaboration across devices
    const syncInterval = setInterval(() => {
      StorageService.syncFromServer().then((updated) => {
        if (updated) loadData(true);
      });
    }, 12000);

    const onFocus = () => {
      StorageService.syncFromServer().then((updated) => {
        if (updated) loadData(true);
      });
    };
    window.addEventListener('focus', onFocus);

    return () => {
      clearInterval(syncInterval);
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  // Enforce tab access permissions whenever user, activeTab, or settings change
  useEffect(() => {
    if (currentUser) {
      if (!isTabPermitted(activeTab, currentUser, settings)) {
        const safeLanding = getDefaultTabForUser(currentUser, settings);
        setActiveTab(safeLanding);
      }
    }
  }, [currentUser, settings, activeTab]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage('');
    }, 3500);
  };

  // 1. INVOICE SAVE WITH AUTOMATIC STOCK DEDUCTION (پیش‌فاکتورها کسر از انبار ندارند)
  const handleSaveInvoice = (newInvoice: Invoice, shouldPrint: boolean) => {
    // 1. Update Invoices list
    const updatedInvoices = [newInvoice, ...invoices];
    setInvoices(updatedInvoices);
    StorageService.saveInvoices(updatedInvoices);

    // 2. If auto-deduct is enabled and NOT a proforma, decrement inventory stock and record movements
    if (settings.autoDeductStock && !newInvoice.isProforma) {
      let currentProducts = [...products];
      const newMovements: StockMovement[] = [];
      const today = getCurrentJalaliDate();

      newInvoice.items.forEach((item) => {
        const prodIndex = currentProducts.findIndex((p) => p.id === item.productId);
        if (prodIndex !== -1) {
          const prod = currentProducts[prodIndex];
          let updatedVariants = prod.variants ? [...prod.variants] : undefined;
          let variantLabel = '';

          if (prod.hasVariants && updatedVariants && item.variantId) {
            updatedVariants = updatedVariants.map((v) => {
              if (v.id === item.variantId) {
                variantLabel = ` (${v.name})`;
                return { ...v, stock: Math.max(0, v.stock - item.quantity) };
              }
              return v;
            });
          }

          const newStock = updatedVariants
            ? updatedVariants.reduce((s, v) => s + (v.stock || 0), 0)
            : Math.max(0, prod.stock - item.quantity);

          currentProducts[prodIndex] = {
            ...prod,
            variants: updatedVariants,
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
      StorageService.saveProducts(currentProducts);

      const updatedMovements = [...newMovements, ...movements];
      setMovements(updatedMovements);
      StorageService.saveMovements(updatedMovements);
    }

    if (newInvoice.isProforma) {
      showToast(`پیش‌فاکتور شماره ${newInvoice.invoiceNumber} با موفقیت ثبت شد (بدون کسر از موجودی انبار).`);
    } else {
      showToast(`فاکتور شماره ${newInvoice.invoiceNumber} با موفقیت ثبت و از انبار کسر شد.`);
    }

    // Log user activity
    StorageService.logActivity({
      category: 'sales',
      actionType: newInvoice.isProforma ? 'create_proforma' : 'create_invoice',
      actionTitle: newInvoice.isProforma ? 'صدور پیش‌فاکتور' : 'صدور فاکتور فروش',
      details: `${newInvoice.isProforma ? 'پیش‌فاکتور' : 'فاکتور'} شماره ${newInvoice.invoiceNumber} به مبلغ ${newInvoice.finalTotal.toLocaleString('fa-IR')} ${settings.currency} برای مشتری «${newInvoice.customerName}»`,
    });

    if (shouldPrint) {
      setViewingInvoice(newInvoice);
    }

    setActiveTab('invoices');
  };

  // 1.0 EDIT INVOICE & PROFORMA (ویرایش فاکتور و پیش‌فاکتور)
  const handleStartEditInvoice = (invoice: Invoice) => {
    setEditingInvoice(invoice);
    setActiveTab('new-invoice');
  };

  const handleUpdateInvoice = (originalInvoice: Invoice, updatedInvoice: Invoice, shouldPrint: boolean) => {
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

      if (newMovements.length > 0) {
        setProducts(currentProducts);
        StorageService.saveProducts(currentProducts);
        const updatedMovements = [...newMovements, ...movements];
        setMovements(updatedMovements);
        StorageService.saveMovements(updatedMovements);
      }
    }

    const updatedInvoices = invoices.map((inv) => (inv.id === updatedInvoice.id ? updatedInvoice : inv));
    setInvoices(updatedInvoices);
    StorageService.saveInvoices(updatedInvoices);

    setEditingInvoice(null);

    // Log user activity
    StorageService.logActivity({
      category: 'sales',
      actionType: updatedInvoice.isProforma ? 'edit_proforma' : 'edit_invoice',
      actionTitle: updatedInvoice.isProforma ? 'ویرایش پیش‌فاکتور' : 'ویرایش فاکتور فروش',
      details: `ویرایش ${updatedInvoice.isProforma ? 'پیش‌فاکتور' : 'فاکتور'} شماره ${updatedInvoice.invoiceNumber} (مبلغ جدید: ${updatedInvoice.finalTotal.toLocaleString('fa-IR')} ${settings.currency})`,
    });

    if (shouldPrint) {
      setViewingInvoice(updatedInvoice);
    }

    showToast(`تغییرات ${updatedInvoice.isProforma ? 'پیش‌فاکتور' : 'فاکتور'} شماره ${updatedInvoice.invoiceNumber} با موفقیت ثبت شد.`);
    setActiveTab('invoices');
  };

  // 1.1 CONVERT PROFORMA TO OFFICIAL INVOICE (تبدیل پیش‌فاکتور به فاکتور قطعی و کسر از انبار)
  const handleConvertProforma = (proformaInvoice: Invoice, customInvoiceNumber?: string) => {
    const today = getCurrentJalaliDate();
    const finalNumber = customInvoiceNumber?.trim() || 
      (proformaInvoice.invoiceNumber.startsWith('PF-') 
        ? proformaInvoice.invoiceNumber.replace('PF-', 'INV-') 
        : `INV-${Math.floor(1000 + Math.random() * 9000)}`);

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

      setProducts(currentProducts);
      StorageService.saveProducts(currentProducts);

      if (newMovements.length > 0) {
        const updatedMovements = [...newMovements, ...movements];
        setMovements(updatedMovements);
        StorageService.saveMovements(updatedMovements);
      }
    }

    // Update invoice record: change isProforma to false, new number, convertedAt, convertedFromProforma
    const convertedInvoice: Invoice = {
      ...proformaInvoice,
      isProforma: false,
      invoiceNumber: finalNumber,
      date: today,
      convertedAt: today,
      convertedFromProforma: proformaInvoice.invoiceNumber,
      notes: proformaInvoice.notes 
        ? `${proformaInvoice.notes} (تبدیل‌شده از پیش‌فاکتور ${proformaInvoice.invoiceNumber} در تاریخ ${today})` 
        : `تبدیل‌شده از پیش‌فاکتور ${proformaInvoice.invoiceNumber} در تاریخ ${today}`,
    };

    const updatedInvoices = invoices.map((inv) => inv.id === proformaInvoice.id ? convertedInvoice : inv);
    setInvoices(updatedInvoices);
    StorageService.saveInvoices(updatedInvoices);

    // If modal was open viewing this invoice, update it
    if (viewingInvoice && viewingInvoice.id === proformaInvoice.id) {
      setViewingInvoice(convertedInvoice);
    }

    // Log user activity
    StorageService.logActivity({
      category: 'sales',
      actionType: 'convert_proforma',
      actionTitle: 'تبدیل پیش‌فاکتور به فاکتور قطعی',
      details: `تبدیل پیش‌فاکتور ${proformaInvoice.invoiceNumber} به فاکتور قطعی ${finalNumber} و کسر از موجودی انبار`,
    });

    showToast(`پیش‌فاکتور ${proformaInvoice.invoiceNumber} با موفقیت به فاکتور رسمی ${finalNumber} تبدیل و اقلام از انبار کسر شد.`);
    return true;
  };

  // 2. RETURN INVOICE TO INVENTORY (مرجوعی به انبار)
  const handleReturnInvoiceToStock = (invoice: Invoice) => {
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

    setProducts(currentProducts);
    StorageService.saveProducts(currentProducts);

    const updatedMovements = [...returnMovements, ...movements];
    setMovements(updatedMovements);
    StorageService.saveMovements(updatedMovements);

    // Remove or cancel invoice
    const updatedInvoices = invoices.filter((i) => i.id !== invoice.id);
    setInvoices(updatedInvoices);
    StorageService.saveInvoices(updatedInvoices);

    StorageService.logActivity({
      category: 'warehouse',
      actionType: 'return_stock',
      actionTitle: 'مرجوع اقلام فاکتور به انبار',
      details: `ابطال فاکتور شماره ${invoice.invoiceNumber} و بازگرداندن کلیه اقلام به موجودی انبار`,
    });

    showToast(`کالاهای فاکتور ${invoice.invoiceNumber} به انبار بازگردانده شدند.`);
  };

  // 3. DELETE INVOICE (بدون بازگردانی کالا)
  const handleDeleteInvoice = (invoiceId: string) => {
    const inv = invoices.find((i) => i.id === invoiceId);
    const updatedInvoices = invoices.filter((i) => i.id !== invoiceId);
    setInvoices(updatedInvoices);
    StorageService.saveInvoices(updatedInvoices);

    StorageService.logActivity({
      category: 'sales',
      actionType: 'delete_invoice',
      actionTitle: 'حذف فاکتور فروش',
      details: `حذف فاکتور شماره ${inv?.invoiceNumber || invoiceId} متعلق به «${inv?.customerName || '-'}»`,
    });

    showToast('فاکتور مورد نظر حذف شد.');
  };

  // 4. UPDATE PAYMENT STATUS
  const handleUpdatePaymentStatus = (
    invoiceId: string,
    status: 'paid' | 'unpaid' | 'partial',
    paidAmount?: number
  ) => {
    const updated = invoices.map((inv) => {
      if (inv.id === invoiceId) {
        return {
          ...inv,
          paymentStatus: status,
          paidAmount: status === 'paid' ? inv.finalTotal : paidAmount !== undefined ? paidAmount : inv.paidAmount,
        };
      }
      return inv;
    });
    setInvoices(updated);
    StorageService.saveInvoices(updated);

    const inv = invoices.find((i) => i.id === invoiceId);
    const statusLabels: Record<string, string> = { paid: 'تسویه کامل', partial: 'پرداخت قسطی/بیعانه', unpaid: 'نسیه/پرداخت‌نشده' };
    StorageService.logActivity({
      category: 'sales',
      actionType: 'update_payment',
      actionTitle: 'تغییر وضعیت تسویه فاکتور',
      details: `تغییر وضعیت پرداخت فاکتور ${inv?.invoiceNumber || invoiceId} به «${statusLabels[status] || status}»`,
    });

    showToast('وضعیت تسویه فاکتور بروزرسانی شد.');
  };

  // 5. INVENTORY PRODUCT MANAGEMENT
  const handleSaveProduct = (product: Product) => {
    let updatedProducts: Product[];
    const exists = products.some((p) => p.id === product.id);

    if (exists) {
      updatedProducts = products.map((p) => (p.id === product.id ? product : p));
      showToast(`مشخصات کالای "${product.name}" بروزرسانی شد.`);
    } else {
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

    StorageService.logActivity({
      category: 'warehouse',
      actionType: exists ? 'edit_product' : 'create_product',
      actionTitle: exists ? 'ویرایش مشخصات کالا' : 'تعریف کالای جدید',
      details: `${exists ? 'ویرایش مشخصات کالا' : 'تعریف کالای جدید'}: «${product.name}» (موجودی: ${product.stock} ${product.unit})`,
    });
  };

  const handleDeleteProduct = (productId: string) => {
    const prod = products.find((p) => p.id === productId);
    const updated = products.filter((p) => p.id !== productId);
    setProducts(updated);
    StorageService.saveProducts(updated);

    StorageService.logActivity({
      category: 'warehouse',
      actionType: 'delete_product',
      actionTitle: 'حذف کالا از انبار',
      details: `حذف کالای «${prod?.name || productId}» از انبار کالاها`,
    });

    showToast('کالای مورد نظر از انبار حذف شد.');
  };

  // 6. MANUAL STOCK ADJUSTMENT / INTAKE (با پشتیبانی از تنوع کالا)
  const handleAdjustStock = (
    productId: string,
    type: 'purchase' | 'adjustment' | 'return',
    quantity: number,
    note: string,
    variantId?: string
  ) => {
    const prodIndex = products.findIndex((p) => p.id === productId);
    if (prodIndex === -1) return;

    const prod = products[prodIndex];
    const isAdding = type === 'purchase' || type === 'return';
    const delta = isAdding ? quantity : -quantity;

    let updatedVariants = prod.variants ? [...prod.variants] : undefined;
    let variantLabel = '';

    if (prod.hasVariants && updatedVariants && variantId) {
      updatedVariants = updatedVariants.map((v) => {
        if (v.id === variantId) {
          variantLabel = ` (${v.name})`;
          const vDelta = isAdding ? quantity : -quantity;
          return { ...v, stock: Math.max(0, v.stock + vDelta) };
        }
        return v;
      });
    }

    const newStock = updatedVariants
      ? updatedVariants.reduce((s, v) => s + (v.stock || 0), 0)
      : Math.max(0, prod.stock + delta);

    const updatedProd = {
      ...prod,
      variants: updatedVariants,
      stock: newStock,
      updatedAt: getCurrentJalaliDate(),
    };

    const updatedProducts = [...products];
    updatedProducts[prodIndex] = updatedProd;
    setProducts(updatedProducts);
    StorageService.saveProducts(updatedProducts);

    const newMov: StockMovement = {
      id: `mov-${Date.now()}`,
      productId: prod.id,
      productName: `${prod.name}${variantLabel}`,
      type,
      quantity: delta,
      remainingStock: newStock,
      date: getCurrentJalaliDate(),
      note: note ? `${note}${variantLabel ? ` [تنوع: ${variantLabel.replace(/[()]/g, '')}]` : ''}` : (isAdding ? 'ورود به انبار' : 'خروج از انبار'),
    };

    const updatedMovements = [newMov, ...movements];
    setMovements(updatedMovements);
    StorageService.saveMovements(updatedMovements);

    StorageService.logActivity({
      category: 'warehouse',
      actionType: 'adjust_stock',
      actionTitle: type === 'purchase' ? 'ورود دستی به انبار' : type === 'return' ? 'مرجوعی به انبار' : 'تعدیل دستی موجودی',
      details: `تغییر موجودی «${prod.name}${variantLabel}» به میزان ${delta > 0 ? `+${delta}` : delta} ${prod.unit} (موجودی جدید: ${newStock})`,
    });

    showToast(`موجودی انبار "${prod.name}${variantLabel}" به ${newStock} ${prod.unit} تغییر یافت.`);
  };

  // 6.1 IMPORT PRODUCTS FROM EXCEL
  const handleImportProducts = (importedProducts: Product[], mode: 'merge' | 'replace') => {
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
      actionType: 'create_product',
      actionTitle: 'ایمپورت اکسل کالاها',
      details: `ورود ${importedProducts.length} کالا از فایل اکسل به شیوه ${mode === 'replace' ? 'جایگزینی کل' : 'ترکیب و بروزرسانی'}`,
    });

    showToast(`تعداد ${importedProducts.length.toLocaleString('fa-IR')} کالا با موفقیت از فایل اکسل وارد انبار شد.`);
  };

  // 6.2 IMPORT CUSTOMERS FROM EXCEL
  const handleImportCustomers = (importedCustomers: Customer[], mode: 'merge' | 'replace') => {
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
      actionType: 'create_customer',
      actionTitle: 'ایمپورت اکسل مشتریان',
      details: `ورود ${importedCustomers.length} طرف‌حساب از فایل اکسل به شیوه ${mode === 'replace' ? 'جایگزینی کل' : 'ترکیب و بروزرسانی'}`,
    });

    showToast(`تعداد ${importedCustomers.length.toLocaleString('fa-IR')} مشتری با موفقیت از فایل اکسل وارد سامانه شد.`);
  };

  // 7. CUSTOMERS MANAGEMENT
  const handleSaveCustomer = (customer: Customer) => {
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
      details: `ذخیره اطلاعات مشتری «${customer.name}» (${customer.phone || 'بدون تماس'})`,
    });

    showToast(`اطلاعات مشتری "${customer.name}" ذخیره شد.`);
  };

  const handleAddNewCustomerQuick = (customerData: Omit<Customer, 'id' | 'createdAt'>): Customer => {
    const newCust: Customer = {
      ...customerData,
      id: `cust-${Date.now()}`,
      createdAt: getCurrentJalaliDate(),
    };
    const updated = [newCust, ...customers];
    setCustomers(updated);
    StorageService.saveCustomers(updated);
    showToast(`مشتری "${newCust.name}" در دفترچه مشتریان ذخیره شد.`);
    return newCust;
  };

  const handleDeleteCustomer = (customerId: string) => {
    const cust = customers.find((c) => c.id === customerId);
    const updated = customers.filter((c) => c.id !== customerId);
    setCustomers(updated);
    StorageService.saveCustomers(updated);

    StorageService.logActivity({
      category: 'customer',
      actionType: 'delete_customer',
      actionTitle: 'حذف طرف‌حساب/مشتری',
      details: `حذف مشتری «${cust?.name || customerId}» از دفترچه طرف‌حساب‌ها`,
    });

    showToast('مشتری حذف شد.');
  };

  const handleSelectCustomerForInvoice = (customer: Customer) => {
    setActiveTab('new-invoice');
  };

  // 7.5 PURCHASE INVOICES & WAREHOUSE INBOUND RECEIPTS
  const handleSavePurchaseInvoice = (
    newPurchaseInvoice: PurchaseInvoice,
    newInboundReceipt: InboundReceipt,
    newProductsCreated: Product[]
  ) => {
    if (newProductsCreated && newProductsCreated.length > 0) {
      newProductsCreated.forEach((p) => StorageService.saveProduct(p));
    }

    StorageService.savePurchaseInvoice(newPurchaseInvoice);
    StorageService.saveInboundReceipt(newInboundReceipt);
    loadData(true);

    StorageService.logActivity({
      category: 'purchase',
      actionType: 'create_purchase_invoice',
      actionTitle: 'ثبت فاکتور خرید و صدور حواله ورود',
      details: `ثبت فاکتور خرید ${newPurchaseInvoice.invoiceNumber} از «${newPurchaseInvoice.supplierName}» به مبلغ ${newPurchaseInvoice.finalTotal.toLocaleString('fa-IR')} ${settings.currency} و صدور حواله ورود ${newInboundReceipt.receiptNumber}`,
    });

    showToast(
      `فاکتور خرید شماره ${newPurchaseInvoice.invoiceNumber} ثبت شد و حواله ورود ${newInboundReceipt.receiptNumber} به انبار ارسال گردید.`
    );
  };

  const handleDeletePurchaseInvoice = (invoiceId: string) => {
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
      details: `حذف فاکتور خرید شماره ${inv?.invoiceNumber || invoiceId} تامین‌کننده «${inv?.supplierName || '-'}»`,
    });

    showToast('فاکتور خرید حذف گردید.');
  };

  const handleConfirmInboundReceipt = (
    receiptId: string,
    verifiedItems: InboundReceiptItem[],
    warehouseNotes: string,
    verifiedBy: string
  ) => {
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

    StorageService.logActivity({
      category: 'warehouse',
      actionType: hasDiscrepancy ? 'verify_inbound_discrepancy' : 'verify_inbound_success',
      actionTitle: hasDiscrepancy ? 'تایید حواله ورود با مغایرت' : 'تایید حواله ورود به انبار',
      details: `تایید حواله ورود ${receipt.receiptNumber} مربوط به فاکتور خرید ${receipt.purchaseInvoiceNumber} توسط ${verifiedBy}${hasDiscrepancy ? ' (همراه با ثبت مغایرت)' : ''}`,
    });

    showToast(
      hasDiscrepancy
        ? `حواله ورود ${receipt.receiptNumber} با ثبت مغایرت تایید شد و موجودی انبار به‌روزرسانی گردید.`
        : `حواله ورود ${receipt.receiptNumber} به طور کامل تایید شد و موجودی انبار افزایش یافت.`
    );
  };

  // 8. USERS & ACCESS MANAGEMENT
  const handleAddUser = (userData: Omit<AppUser, 'id' | 'createdAt'>) => {
    const newUser = StorageService.addUser(userData);
    const updatedUsers = StorageService.getUsers();
    setUsers(updatedUsers);

    StorageService.logActivity({
      category: 'users',
      actionType: 'create_user',
      actionTitle: 'تعریف کاربر جدید',
      details: `تعریف حساب کاربری جدید برای «${newUser.fullName}» (${newUser.username}) با نقش ${newUser.roleTitle || newUser.role}`,
    });

    showToast(`کاربر جدید «${newUser.fullName}» با موفقیت ثبت شد.`);
  };

  const handleUpdateUser = (user: AppUser) => {
    StorageService.updateUser(user);
    const updatedUsers = StorageService.getUsers();
    setUsers(updatedUsers);

    if (currentUser?.id === user.id) {
      setCurrentUser(user);
      StorageService.setCurrentUser(user);
    }

    StorageService.logActivity({
      category: 'users',
      actionType: 'edit_user',
      actionTitle: 'ویرایش اطلاعات کاربر',
      details: `به‌روزرسانی اطلاعات و دسترسی‌های کاربر «${user.fullName}» (${user.username})`,
    });

    showToast(`اطلاعات کاربر «${user.fullName}» به‌روزرسانی شد.`);
  };

  const handleDeleteUser = (userId: string): { success: boolean; message?: string } => {
    if (currentUser?.id === userId) {
      showToast('امکان حذف کاربر فعال فعلی وجود ندارد.');
      return { success: false, message: 'امکان حذف کاربر فعال فعلی وجود ندارد.' };
    }
    const targetUser = users.find((u) => u.id === userId);
    const result = StorageService.deleteUser(userId);
    if (result.success) {
      const updatedUsers = StorageService.getUsers();
      setUsers(updatedUsers);
      const active = StorageService.getCurrentUser();
      setCurrentUser(active);

      StorageService.logActivity({
        category: 'users',
        actionType: 'delete_user',
        actionTitle: 'حذف حساب کاربری',
        details: `حذف حساب کاربری «${targetUser?.fullName || userId}» (${targetUser?.username || ''})`,
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

    // Intelligently route user to the primary view matching their granted permissions
    const landingTab = getDefaultTabForUser(user, settings);
    setActiveTab(landingTab);

    StorageService.logActivity({
      userId: user.id,
      userName: user.fullName,
      userRole: user.role,
      userRoleTitle: user.roleTitle,
      category: 'auth',
      actionType: 'login',
      actionTitle: 'ورود موفق به سامانه',
      details: `ورود کاربر «${user.fullName}» با نقش سازمانی ${user.roleTitle || user.role}`,
    });

    showToast(`ورود موفقیت‌آمیز بود. خوش آمدید «${user.fullName}» (${user.roleTitle || user.role}).`);
  };

  const handleLogout = () => {
    if (currentUser) {
      StorageService.logActivity({
        userId: currentUser.id,
        userName: currentUser.fullName,
        userRole: currentUser.role,
        userRoleTitle: currentUser.roleTitle,
        category: 'auth',
        actionType: 'logout',
        actionTitle: 'خروج از حساب کاربری',
        details: `خروج کاربر «${currentUser.fullName}» از سامانه`,
      });
    }

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
    setSettings(newSettings);
    StorageService.saveSettings(newSettings);

    StorageService.logActivity({
      category: 'settings',
      actionType: 'update_settings',
      actionTitle: 'به‌روزرسانی تنظیمات سامانه',
      details: `ذخیره پیکربندی، قوانین فاکتور و اطلاعات فروشگاه توسط مدیر`,
    });

    showToast('تنظیمات فروشگاه با موفقیت ذخیره شد.');
  };

  // Low stock count for alert badge
  const lowStockCount = products.filter((p) => p.stock <= p.minStockAlert).length;

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
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100/70 text-slate-800 flex flex-col selection:bg-emerald-500 selection:text-white">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="no-print fixed bottom-20 sm:bottom-6 right-4 sm:right-6 z-50 flex items-center gap-2.5 bg-slate-900 text-white text-xs font-semibold px-4 py-3 rounded-xl shadow-xl border border-slate-700 animate-bounce max-w-[90vw]">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

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
        onOpenSettings={() => setIsSettingsOpen(true)}
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
              if (isTabPermitted(tab, currentUser, settings)) {
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
            onOpenSettings={() => setIsSettingsOpen(true)}
            onUpdateSettings={handleSaveSettings}
            onLogout={handleLogout}
            onRequestLogin={handleRequestLogin}
          />
        )}

        {activeTab === 'new-invoice' && isTabPermitted('new-invoice', currentUser, settings) && (
          <InvoiceBuilder
            key={editingInvoice ? `edit-${editingInvoice.id}` : 'new-invoice'}
            products={products}
            customers={customers}
            settings={settings}
            editingInvoice={editingInvoice}
            onSaveInvoice={handleSaveInvoice}
            onUpdateInvoice={handleUpdateInvoice}
            onAddNewCustomer={handleAddNewCustomerQuick}
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
            onEditInvoice={handleStartEditInvoice}
            onDeleteInvoice={handleDeleteInvoice}
            onReturnInvoiceToStock={handleReturnInvoiceToStock}
            onUpdatePaymentStatus={handleUpdatePaymentStatus}
            onNewInvoice={() => {
              if (currentUser?.permissions.canCreateInvoice) {
                setEditingInvoice(null);
                setActiveTab('new-invoice');
              }
            }}
            onConvertProforma={handleConvertProforma}
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
            onUpdateSettings={handleSaveSettings}
          />
        )}

        {activeTab === 'customers' && isTabPermitted('customers', currentUser, settings) && (
          <CustomersManager
            customers={customers}
            invoices={invoices}
            settings={settings}
            currentUser={currentUser || undefined}
            onSaveCustomer={handleSaveCustomer}
            onDeleteCustomer={handleDeleteCustomer}
            onSelectCustomerForInvoice={handleSelectCustomerForInvoice}
            onImportCustomers={handleImportCustomers}
          />
        )}

        {activeTab === 'reports' && isTabPermitted('reports', currentUser, settings) && (
          <ReportsDashboard
            products={products}
            invoices={invoices}
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
          onEditInvoice={handleStartEditInvoice}
          onConvertProforma={(inv) => {
            const success = handleConvertProforma(inv);
            if (success !== false) {
              setViewingInvoice(null);
            }
          }}
        />
      )}

      {/* Settings & Backup Modal */}
      {isSettingsOpen && (
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
          currentUserId={currentUser?.id}
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
      />
    </div>
  );
}
