/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Product, Customer, Invoice, StockMovement, StoreSettings, AppUser } from './types';
import { StorageService } from './utils/storage';
import { getCurrentJalaliDate } from './utils/jalali';
import { isTabPermitted, getDefaultTabForUser, getRoleBadgeConfig } from './utils/permissions';
import { Header } from './components/Header';
import { InvoiceBuilder } from './components/InvoiceBuilder';
import { InvoicesList } from './components/InvoicesList';
import { InventoryManager } from './components/InventoryManager';
import { CustomersManager } from './components/CustomersManager';
import { ReportsDashboard } from './components/ReportsDashboard';
import { InvoiceViewModal } from './components/InvoiceViewModal';
import { SettingsModal } from './components/SettingsModal';
import { AdminPanel } from './components/AdminPanel';
import { MobileBottomNav } from './components/MobileBottomNav';
import { UserLoginModal } from './components/UserLoginModal';
import { LoginScreen } from './components/LoginScreen';
import { CheckCircle2, ShieldAlert } from 'lucide-react';

export default function App() {
  // Application Data States
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [settings, setSettings] = useState<StoreSettings>(StorageService.getSettings());
  const [users, setUsers] = useState<AppUser[]>([]);
  const [currentUser, setCurrentUser] = useState<AppUser | null>(() => StorageService.getLoggedInUser());

  // UI State
  const [activeTab, setActiveTab] = useState<string>(() => {
    const saved = localStorage.getItem('sepehr_last_tab');
    return saved || 'new-invoice';
  });
  const [viewingInvoice, setViewingInvoice] = useState<Invoice | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState<boolean>(false);
  const [loginTargetUser, setLoginTargetUser] = useState<AppUser | null>(null);
  const [toastMessage, setToastMessage] = useState<string>('');

  // Load initial data - preserves authenticated user session across page reloads
  const loadData = (preserveCurrentUser = true) => {
    setProducts(StorageService.getProducts());
    setCustomers(StorageService.getCustomers());
    setInvoices(StorageService.getInvoices());
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
          const newStock = Math.max(0, prod.stock - item.quantity);

          currentProducts[prodIndex] = {
            ...prod,
            stock: newStock,
            updatedAt: today,
          };

          // Record kardex / stock movement
          newMovements.push({
            id: `mov-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
            productId: prod.id,
            productName: prod.name,
            type: 'sale',
            quantity: -item.quantity,
            remainingStock: newStock,
            invoiceId: newInvoice.id,
            invoiceNumber: newInvoice.invoiceNumber,
            date: today,
            note: `کسر بابت فاکتور فروش شماره ${newInvoice.invoiceNumber}`,
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

    if (shouldPrint) {
      setViewingInvoice(newInvoice);
    }

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

    showToast(`کالاهای فاکتور ${invoice.invoiceNumber} به انبار بازگردانده شدند.`);
  };

  // 3. DELETE INVOICE (بدون بازگردانی کالا)
  const handleDeleteInvoice = (invoiceId: string) => {
    const updatedInvoices = invoices.filter((i) => i.id !== invoiceId);
    setInvoices(updatedInvoices);
    StorageService.saveInvoices(updatedInvoices);
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
  };

  const handleDeleteProduct = (productId: string) => {
    const updated = products.filter((p) => p.id !== productId);
    setProducts(updated);
    StorageService.saveProducts(updated);
    showToast('کالای مورد نظر از انبار حذف شد.');
  };

  // 6. MANUAL STOCK ADJUSTMENT / INTAKE
  const handleAdjustStock = (
    productId: string,
    type: 'purchase' | 'adjustment' | 'return',
    quantity: number,
    note: string
  ) => {
    const prodIndex = products.findIndex((p) => p.id === productId);
    if (prodIndex === -1) return;

    const prod = products[prodIndex];
    const isAdding = type === 'purchase' || type === 'return';
    const delta = isAdding ? quantity : -quantity;
    const newStock = Math.max(0, prod.stock + delta);

    const updatedProd = {
      ...prod,
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
      productName: prod.name,
      type,
      quantity: delta,
      remainingStock: newStock,
      date: getCurrentJalaliDate(),
      note: note || (isAdding ? 'ورود به انبار' : 'خروج از انبار'),
    };

    const updatedMovements = [newMov, ...movements];
    setMovements(updatedMovements);
    StorageService.saveMovements(updatedMovements);

    showToast(`موجودی انبار "${prod.name}" به ${newStock} ${prod.unit} تغییر یافت.`);
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
    const updated = customers.filter((c) => c.id !== customerId);
    setCustomers(updated);
    StorageService.saveCustomers(updated);
    showToast('مشتری حذف شد.');
  };

  const handleSelectCustomerForInvoice = (customer: Customer) => {
    setActiveTab('new-invoice');
  };

  // 8. USERS & ACCESS MANAGEMENT
  const handleAddUser = (userData: Omit<AppUser, 'id' | 'createdAt'>) => {
    const newUser = StorageService.addUser(userData);
    const updatedUsers = StorageService.getUsers();
    setUsers(updatedUsers);
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
    showToast(`اطلاعات کاربر «${user.fullName}» به‌روزرسانی شد.`);
  };

  const handleDeleteUser = (userId: string): { success: boolean; message?: string } => {
    if (currentUser?.id === userId) {
      showToast('امکان حذف کاربر فعال فعلی وجود ندارد.');
      return { success: false, message: 'امکان حذف کاربر فعال فعلی وجود ندارد.' };
    }
    const result = StorageService.deleteUser(userId);
    if (result.success) {
      const updatedUsers = StorageService.getUsers();
      setUsers(updatedUsers);
      const active = StorageService.getCurrentUser();
      setCurrentUser(active);
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

    showToast(`ورود موفقیت‌آمیز بود. خوش آمدید «${user.fullName}» (${user.roleTitle || user.role}).`);
  };

  const handleLogout = () => {
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
        onOpenNewInvoice={() => setActiveTab('new-invoice')}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      {/* Main Body Content View */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 pt-3 sm:pt-6 pb-24 sm:pb-12">
        {activeTab === 'new-invoice' && isTabPermitted('new-invoice', currentUser, settings) && (
          <InvoiceBuilder
            products={products}
            customers={customers}
            settings={settings}
            onSaveInvoice={handleSaveInvoice}
            onAddNewCustomer={handleAddNewCustomerQuick}
            onCancel={() => setActiveTab(getDefaultTabForUser(currentUser, settings))}
          />
        )}

        {activeTab === 'invoices' && isTabPermitted('invoices', currentUser, settings) && (
          <InvoicesList
            invoices={invoices}
            products={products}
            settings={settings}
            currentUser={currentUser || undefined}
            onViewInvoice={(inv) => setViewingInvoice(inv)}
            onDeleteInvoice={handleDeleteInvoice}
            onReturnInvoiceToStock={handleReturnInvoiceToStock}
            onUpdatePaymentStatus={handleUpdatePaymentStatus}
            onNewInvoice={() => {
              if (currentUser?.permissions.canCreateInvoice) {
                setActiveTab('new-invoice');
              }
            }}
            onConvertProforma={handleConvertProforma}
          />
        )}

        {activeTab === 'inventory' && isTabPermitted('inventory', currentUser, settings) && (
          <InventoryManager
            products={products}
            movements={movements}
            invoices={invoices}
            settings={settings}
            currentUser={currentUser || undefined}
            onSaveProduct={handleSaveProduct}
            onDeleteProduct={handleDeleteProduct}
            onAdjustStock={handleAdjustStock}
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

      {/* Mobile Bottom Navigation Bar */}
      <MobileBottomNav
        settings={settings}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        lowStockCount={lowStockCount}
        currentUser={currentUser || undefined}
      />
    </div>
  );
}
