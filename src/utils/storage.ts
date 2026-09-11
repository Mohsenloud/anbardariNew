import { Product, Customer, Invoice, StockMovement, StoreSettings, AppUser, UserRole, UserPermissions, ExitSlipData, ExitSlipPrintRecord, PaymentMethod } from '../types';
import { getCurrentJalaliDate, getCurrentJalaliTime } from './jalali';

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cheque: 'چک (شماره، تاریخ و نام چک)',
  cash: 'نقدی',
  transfer: 'واریز به حساب (با ثبت توضیحات)',
  pos: 'کارتخوان فروشگاه (POS)',
  credit: 'حساب دفتری / نسیه',
};

const STORAGE_KEYS = {
  PRODUCTS: 'factor_app_products_v1',
  CUSTOMERS: 'factor_app_customers_v1',
  INVOICES: 'factor_app_invoices_v1',
  MOVEMENTS: 'factor_app_movements_v1',
  SETTINGS: 'factor_app_settings_v1',
  USERS: 'factor_app_users_v1',
  CURRENT_USER_ID: 'factor_app_current_user_id_v1',
  EXIT_SLIP_LOGS: 'factor_app_exit_slip_logs_v1',
};

export const DEFAULT_ROLE_PERMISSIONS: Record<UserRole, UserPermissions> = {
  admin: {
    canCreateInvoice: true,
    canViewInvoices: true,
    canDeleteInvoice: true,
    canManageInventory: true,
    canManageCustomers: true,
    canViewReports: true,
    canAccessAdmin: true,
    canManageUsers: true,
  },
  cashier: {
    canCreateInvoice: true,
    canViewInvoices: true,
    canDeleteInvoice: false,
    canManageInventory: false,
    canManageCustomers: true,
    canViewReports: false,
    canAccessAdmin: false,
    canManageUsers: false,
  },
  warehouse: {
    canCreateInvoice: false,
    canViewInvoices: true,
    canDeleteInvoice: false,
    canManageInventory: true,
    canManageCustomers: false,
    canViewReports: false,
    canAccessAdmin: false,
    canManageUsers: false,
  },
  accountant: {
    canCreateInvoice: false,
    canViewInvoices: true,
    canDeleteInvoice: false,
    canManageInventory: false,
    canManageCustomers: true,
    canViewReports: true,
    canAccessAdmin: false,
    canManageUsers: false,
  },
  custom: {
    canCreateInvoice: true,
    canViewInvoices: true,
    canDeleteInvoice: false,
    canManageInventory: false,
    canManageCustomers: false,
    canViewReports: false,
    canAccessAdmin: false,
    canManageUsers: false,
  },
};

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'مدیر کل (دسترسی نامحدود)',
  cashier: 'صندوق‌دار و فروشنده',
  warehouse: 'مسئول انبار و موجودی',
  accountant: 'حسابدار و تحلیلگر مالی',
  custom: 'سطح دسترسی سفارشی',
};

const initialUsers: AppUser[] = [
  {
    id: 'user-1',
    username: 'admin',
    fullName: 'حمیدرضا سپهری',
    role: 'admin',
    roleTitle: 'مدیر کل سیستم',
    permissions: { ...DEFAULT_ROLE_PERMISSIONS.admin },
    isActive: true,
    avatarColor: 'emerald',
    phone: '۰۹۱۲۳۴۵۶۷۸۹',
    pin: '1234',
    password: '1234',
    createdAt: getCurrentJalaliDate(),
  },
  {
    id: 'user-2',
    username: 'cashier1',
    fullName: 'سارا محمدی',
    role: 'cashier',
    roleTitle: 'صندوق‌دار شیفت صبح',
    permissions: { ...DEFAULT_ROLE_PERMISSIONS.cashier },
    isActive: true,
    avatarColor: 'blue',
    phone: '۰۹۳۵۱۱۱۲۲۳۳',
    pin: '1234',
    password: '1234',
    createdAt: getCurrentJalaliDate(),
  },
  {
    id: 'user-3',
    username: 'warehouse1',
    fullName: 'علی رضایی',
    role: 'warehouse',
    roleTitle: 'سرپرست انبار مرکزی',
    permissions: { ...DEFAULT_ROLE_PERMISSIONS.warehouse },
    isActive: true,
    avatarColor: 'amber',
    phone: '۰۹۱۹۷۷۷۸۸۹۹',
    pin: '1234',
    password: '1234',
    createdAt: getCurrentJalaliDate(),
  },
  {
    id: 'user-4',
    username: 'accountant1',
    fullName: 'مریم احمدی',
    role: 'accountant',
    roleTitle: 'حسابدار و تحلیلگر مالی',
    permissions: { ...DEFAULT_ROLE_PERMISSIONS.accountant },
    isActive: true,
    avatarColor: 'purple',
    phone: '۰۹۱۲۸۸۸۹۹۰۰',
    pin: '1234',
    password: '1234',
    createdAt: getCurrentJalaliDate(),
  },
];

const initialProducts: Product[] = [
  {
    id: 'prod-1',
    code: '1001',
    name: 'لپ‌تاپ ایسوس Vivobook 15 (Core i5/16GB/512SSD)',
    category: 'رایانه و لپ‌تاپ',
    unit: 'دستگاه',
    buyPrice: 28500000,
    sellPrice: 33200000,
    stock: 6,
    minStockAlert: 2,
    description: 'رنگ نقره‌ای، گارانتی ۲۴ ماهه سازگار',
    updatedAt: getCurrentJalaliDate(),
  },
  {
    id: 'prod-2',
    code: '1002',
    name: 'ماوس بی‌سیم لاجیتک مدل M185',
    category: 'لوازم جانبی',
    unit: 'عدد',
    buyPrice: 430000,
    sellPrice: 590000,
    stock: 18,
    minStockAlert: 5,
    description: 'اتصال دانگل USB نانو، رنگ مشکی/خاکستری',
    updatedAt: getCurrentJalaliDate(),
  },
  {
    id: 'prod-3',
    code: '1003',
    name: 'کیبورد مکانیکی گیمینگ تسکو GK 8128',
    category: 'لوازم جانبی',
    unit: 'عدد',
    buyPrice: 1350000,
    sellPrice: 1890000,
    stock: 2, // هشدار موجودی کم!
    minStockAlert: 4,
    description: 'سوئیچ آبی، نورپردازی RGB قابل تنظیم',
    updatedAt: getCurrentJalaliDate(),
  },
  {
    id: 'prod-4',
    code: '1004',
    name: 'هارد اکسترنال وسترن دیجیتال Elements ظرفیت 1TB',
    category: 'ذخیره‌سازی',
    unit: 'عدد',
    buyPrice: 2900000,
    sellPrice: 3650000,
    stock: 9,
    minStockAlert: 3,
    description: 'پورت USB 3.0، مقاوم در برابر شوک',
    updatedAt: getCurrentJalaliDate(),
  },
  {
    id: 'prod-5',
    code: '1005',
    name: 'بسته کاغذ A4 دابل ای Double A (۵۰۰ برگی ۸۰ گرم)',
    category: 'ملزومات اداری',
    unit: 'بسته',
    buyPrice: 195000,
    sellPrice: 245000,
    stock: 42,
    minStockAlert: 10,
    description: 'کاغذ درجه یک اداری مناسب پرینترهای لیزری',
    updatedAt: getCurrentJalaliDate(),
  },
  {
    id: 'prod-6',
    code: '1006',
    name: 'فلش مموری سن‌دیسک Ultra Flair 64GB',
    category: 'ذخیره‌سازی',
    unit: 'عدد',
    buyPrice: 310000,
    sellPrice: 420000,
    stock: 0, // ناموجود
    minStockAlert: 5,
    description: 'بدنه فلزی ضد خش سرعت خواندن 150MB/s',
    updatedAt: getCurrentJalaliDate(),
  },
  {
    id: 'prod-7',
    code: '1007',
    name: 'کابل تبدیل چندکاره Type-C به HDMI و USB3',
    category: 'کابل و رابط',
    unit: 'عدد',
    buyPrice: 250000,
    sellPrice: 390000,
    stock: 14,
    minStockAlert: 4,
    description: 'کیفیت 4K، مناسب اتصال موبایل و لپ‌تاپ به تلویزیون',
    updatedAt: getCurrentJalaliDate(),
  },
];

const initialCustomers: Customer[] = [
  {
    id: 'cust-1',
    name: 'شرکت فناوران داده‌پرداز پایتخت',
    phone: '۰۲۱-۸۸۹۹۰۰۱۱',
    nationalId: '۱۰۱۰۴۵۶۷۸۹۰',
    address: 'تهران، خیابان میرداماد، برج آرین، طبقه ۷ واحد ۱۴',
    notes: 'مشتری حقوقی معتبر - طرف قرارداد پشتیبانی',
    createdAt: getCurrentJalaliDate(),
  },
  {
    id: 'cust-2',
    name: 'مهندس آرش رستمی',
    phone: '۰۹۱۲۱۱۱۴۴۵۵',
    nationalId: '۰۰۱۴۸۷۲۲۳۱',
    address: 'تهران، سعادت‌آباد، میدان کاج، خ سرو غربی',
    notes: 'مشتری دائمی تجهیزات اداری',
    createdAt: getCurrentJalaliDate(),
  },
  {
    id: 'cust-3',
    name: 'دکتر نرگس حسینی',
    phone: '۰۹۳۵۴۵۶۷۸۹۰',
    nationalId: '۱۲۸۹۳۴۴۵۶۱',
    address: 'اصفهان، خیابان شیخ بهایی، مجتمع پزشکی سینا',
    notes: '',
    createdAt: getCurrentJalaliDate(),
  },
];

const initialInvoices: Invoice[] = [
  {
    id: 'inv-1',
    invoiceNumber: '۱۴۰۳-۱۰۰۱',
    type: 'standard',
    customerId: 'cust-1',
    customerName: 'شرکت فناوران داده‌پرداز پایتخت',
    customerPhone: '۰۲۱-۸۸۹۹۰۰۱۱',
    customerAddress: 'تهران، خیابان میرداماد، برج آرین، طبقه ۷ واحد ۱۴',
    customerNationalId: '۱۰۱۰۴۵۶۷۸۹۰',
    date: getCurrentJalaliDate(),
    items: [
      {
        id: 'item-1',
        productId: 'prod-1',
        productName: 'لپ‌تاپ ایسوس Vivobook 15 (Core i5/16GB/512SSD)',
        productCode: '1001',
        unit: 'دستگاه',
        quantity: 1,
        unitPrice: 33200000,
        buyPrice: 28500000,
        discount: 700000,
        total: 32500000,
      },
      {
        id: 'item-2',
        productId: 'prod-2',
        productName: 'ماوس بی‌سیم لاجیتک مدل M185',
        productCode: '1002',
        unit: 'عدد',
        quantity: 2,
        unitPrice: 590000,
        buyPrice: 430000,
        discount: 0,
        total: 1180000,
      },
    ],
    subtotal: 34380000,
    totalDiscount: 700000,
    taxRate: 0,
    taxAmount: 0,
    finalTotal: 33680000,
    paymentStatus: 'paid',
    paymentMethod: 'pos',
    paidAmount: 33680000,
    notes: 'تسویه کامل از طریق کارتخوان فروشگاه انجام شد.',
    createdAt: new Date().toISOString(),
  },
];

const initialMovements: StockMovement[] = [
  {
    id: 'mov-1',
    productId: 'prod-1',
    productName: 'لپ‌تاپ ایسوس Vivobook 15 (Core i5/16GB/512SSD)',
    type: 'purchase',
    quantity: 7,
    remainingStock: 7,
    date: getCurrentJalaliDate(),
    note: 'ورود اولیه کالا به انبار مرکزی',
  },
  {
    id: 'mov-2',
    productId: 'prod-1',
    productName: 'لپ‌تاپ ایسوس Vivobook 15 (Core i5/16GB/512SSD)',
    type: 'sale',
    quantity: -1,
    remainingStock: 6,
    invoiceId: 'inv-1',
    invoiceNumber: '۱۴۰۳-۱۰۰۱',
    date: getCurrentJalaliDate(),
    note: 'کسر موجودی بابت صدور فاکتور فروش',
  },
  {
    id: 'mov-3',
    productId: 'prod-2',
    productName: 'ماوس بی‌سیم لاجیتک مدل M185',
    type: 'sale',
    quantity: -2,
    remainingStock: 18,
    invoiceId: 'inv-1',
    invoiceNumber: '۱۴۰۳-۱۰۰۱',
    date: getCurrentJalaliDate(),
    note: 'کسر موجودی بابت صدور فاکتور فروش',
  },
];

const initialSettings: StoreSettings = {
  appName: 'سیستم فاکتور و انبارداری',
  showStoreEditionBadge: true,
  storeName: 'بازرگانی و سیستم‌های دیجیتال سپهر',
  tagline: 'توزیع‌کننده مستقیم کالای دیجیتال، تجهیزات اداری و شبکه',
  sellerName: 'حمیدرضا سپهری',
  phone: '۰۲۱-۸۸۲۲۳۳۴۴',
  mobile: '۰۹۱۲۳۴۵۶۷۸۹',
  economicCode: '۴۱۱۴۸۷۹۵۴۳۲۱',
  nationalCode: '۱۰۱۰۹۸۷۶۵۴۳',
  address: 'تهران، خیابان ولیعصر، تقاطع طالقانی، مجتمع نور، واحد ۲۰۴',
  postalCode: '۱۴۱۵۸۳۳۶۵۴',
  invoiceFooterText: 'از خرید و اعتماد شما صمیمانه سپاسگزاریم. کالاهای دارای گارانتی تا ۲۴ ساعت پس از تحویل دارای مهلت تست سلامت می‌باشند.',
  currency: 'تومان',

  // کنترل ماژول‌های سامانه
  enableInventory: true,
  enableCustomers: true,
  enableReports: true,
  showLowStockAlerts: true,
  showHeaderClock: true,

  // رفتار فاکتورساز
  autoDeductStock: true,
  allowNegativeStock: false,
  enableItemDiscount: true,
  enableInvoiceDiscount: true,
  taxEnabled: false,
  taxPercent: 10,
  enableDueDate: true,
  enableInvoiceNotes: true,
  autoPrintAfterSave: false,

  // قالب‌های چاپ
  enableStandardTemplate: true,
  enableOfficialTemplate: true,
  enableThermalTemplate: true,
  defaultTemplate: 'standard',

  // روش‌های پرداخت
  enableChequePayment: true,
  enableCashPayment: true,
  enableTransferPayment: true,
  enablePosPayment: true,
  enableCreditPayment: true,

  // شبکه اجتماعی و پیام‌رسان‌ها جهت ارسال حواله‌ها و فاکتورها (تعیین شده توسط مدیر)
  socialShareUrl: '',
  socialChannelTitle: 'کانال هماهنگی و انبارداری',
  telegramUsername: '',
  whatsappNumber: '',
  eitaaChannel: '',
  baleChannel: '',
};

export const StorageService = {
  getProducts(): Product[] {
    const data = localStorage.getItem(STORAGE_KEYS.PRODUCTS);
    if (!data) {
      localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(initialProducts));
      return initialProducts;
    }
    try {
      return JSON.parse(data);
    } catch {
      return initialProducts;
    }
  },

  saveProducts(products: Product[]) {
    localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(products));
  },

  getCustomers(): Customer[] {
    const data = localStorage.getItem(STORAGE_KEYS.CUSTOMERS);
    if (!data) {
      localStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify(initialCustomers));
      return initialCustomers;
    }
    try {
      return JSON.parse(data);
    } catch {
      return initialCustomers;
    }
  },

  saveCustomers(customers: Customer[]) {
    localStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify(customers));
  },

  getInvoices(): Invoice[] {
    const data = localStorage.getItem(STORAGE_KEYS.INVOICES);
    if (!data) {
      localStorage.setItem(STORAGE_KEYS.INVOICES, JSON.stringify(initialInvoices));
      return initialInvoices;
    }
    try {
      return JSON.parse(data);
    } catch {
      return initialInvoices;
    }
  },

  saveInvoices(invoices: Invoice[]) {
    localStorage.setItem(STORAGE_KEYS.INVOICES, JSON.stringify(invoices));
  },

  getMovements(): StockMovement[] {
    const data = localStorage.getItem(STORAGE_KEYS.MOVEMENTS);
    if (!data) {
      localStorage.setItem(STORAGE_KEYS.MOVEMENTS, JSON.stringify(initialMovements));
      return initialMovements;
    }
    try {
      return JSON.parse(data);
    } catch {
      return initialMovements;
    }
  },

  saveMovements(movements: StockMovement[]) {
    localStorage.setItem(STORAGE_KEYS.MOVEMENTS, JSON.stringify(movements));
  },

  getSettings(): StoreSettings {
    const data = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    if (!data) {
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(initialSettings));
      return initialSettings;
    }
    try {
      const parsed = JSON.parse(data);
      return { ...initialSettings, ...parsed };
    } catch {
      return initialSettings;
    }
  },

  saveSettings(settings: StoreSettings) {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
  },

  getUsers(): AppUser[] {
    const data = localStorage.getItem(STORAGE_KEYS.USERS);
    if (!data) {
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(initialUsers));
      return initialUsers;
    }
    try {
      const users: AppUser[] = JSON.parse(data);
      if (!Array.isArray(users) || users.length === 0) {
        localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(initialUsers));
        return initialUsers;
      }
      // Ensure all users have valid unique IDs
      const seenIds = new Set<string>();
      let needsSave = false;
      const sanitized: AppUser[] = users.map((u, idx): AppUser => {
        let validId = u.id && u.id.trim() ? u.id.trim() : `user-migrated-${idx}-${Date.now()}`;
        if (seenIds.has(validId)) {
          validId = `${validId}-${idx}`;
          needsSave = true;
        }
        if (!u.id) {
          needsSave = true;
        }
        seenIds.add(validId);
        const userPassword = u.password || u.pin || '1234';
        const userPin = u.pin || u.password || '1234';
        if (!u.password || !u.pin) {
          needsSave = true;
        }
        return {
          ...u,
          id: validId,
          password: userPassword,
          pin: userPin,
        };
      });
      if (needsSave || !sanitized.some((u) => u.username === 'accountant1')) {
        if (!sanitized.some((u) => u.username === 'accountant1')) {
          const accountant = initialUsers.find((u) => u.username === 'accountant1');
          if (accountant) sanitized.push(accountant);
        }
        this.saveUsers(sanitized);
      }
      return sanitized;
    } catch {
      return initialUsers;
    }
  },

  saveUsers(users: AppUser[]) {
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
  },

  getActiveUser(): AppUser {
    const users = this.getUsers();
    const activeUserId = localStorage.getItem(STORAGE_KEYS.CURRENT_USER_ID);
    if (activeUserId) {
      const found = users.find((u) => u.id === activeUserId && u.isActive);
      if (found) return found;
    }
    // Default to first active admin or first active user
    const admin = users.find((u) => u.role === 'admin' && u.isActive) || users.find((u) => u.isActive) || users[0];
    if (admin) {
      localStorage.setItem(STORAGE_KEYS.CURRENT_USER_ID, admin.id);
      return admin;
    }
    return initialUsers[0];
  },

  // Returns the currently logged in user if an explicit session exists, or null
  getLoggedInUser(): AppUser | null {
    const users = this.getUsers();
    const activeUserId = localStorage.getItem(STORAGE_KEYS.CURRENT_USER_ID);
    if (activeUserId) {
      const found = users.find((u) => u.id === activeUserId && u.isActive);
      if (found) return found;
    }
    return null;
  },

  logout(): void {
    localStorage.removeItem(STORAGE_KEYS.CURRENT_USER_ID);
  },

  setActiveUserId(userId: string): AppUser {
    const users = this.getUsers();
    const found = users.find((u) => u.id === userId && u.isActive);
    if (found) {
      localStorage.setItem(STORAGE_KEYS.CURRENT_USER_ID, found.id);
      return found;
    }
    return this.getActiveUser();
  },

  getCurrentUser(): AppUser {
    return this.getActiveUser();
  },

  setCurrentUser(userOrId: AppUser | string): AppUser {
    const id = typeof userOrId === 'string' ? userOrId : userOrId.id;
    return this.setActiveUserId(id);
  },

  addUser(userData: Omit<AppUser, 'id' | 'createdAt'>): AppUser {
    const users = this.getUsers();
    const newUser: AppUser = {
      ...userData,
      id: `user-${Date.now()}`,
      createdAt: getCurrentJalaliDate(),
    };
    users.push(newUser);
    this.saveUsers(users);
    return newUser;
  },

  updateUser(updated: AppUser): void {
    const users = this.getUsers();
    const idx = users.findIndex((u) => u.id === updated.id);
    if (idx !== -1) {
      users[idx] = updated;
      this.saveUsers(users);
    }
  },

  deleteUser(userId: string): { success: boolean; message?: string } {
    const users = this.getUsers();
    const target = users.find((u) => u.id === userId);
    if (!target) {
      return { success: false, message: 'کاربر مورد نظر یافت نشد.' };
    }
    // Prevent deleting the only admin
    const adminCount = users.filter((u) => u.role === 'admin' && u.isActive).length;
    if (target.role === 'admin' && adminCount <= 1) {
      return { success: false, message: 'حداقل یک کاربر مدیر فعال باید در سیستم باقی بماند.' };
    }

    const filtered = users.filter((u) => u.id !== userId);
    this.saveUsers(filtered);

    // If current active user was deleted, reset to another user
    const currentActiveId = localStorage.getItem(STORAGE_KEYS.CURRENT_USER_ID);
    if (currentActiveId === userId) {
      const nextUser = filtered.find((u) => u.isActive) || filtered[0];
      if (nextUser) {
        localStorage.setItem(STORAGE_KEYS.CURRENT_USER_ID, nextUser.id);
      }
    }
    return { success: true };
  },

  // EXIT SLIP (حواله خروج از انبار) METHODS
  getExitSlipLogs(): Record<string, ExitSlipData> {
    const data = localStorage.getItem(STORAGE_KEYS.EXIT_SLIP_LOGS);
    if (!data) return {};
    try {
      return JSON.parse(data);
    } catch {
      return {};
    }
  },

  saveExitSlipLogs(logs: Record<string, ExitSlipData>) {
    localStorage.setItem(STORAGE_KEYS.EXIT_SLIP_LOGS, JSON.stringify(logs));
  },

  getExitSlipLog(invoiceId: string): ExitSlipData {
    const logs = this.getExitSlipLogs();
    return logs[invoiceId] || {
      invoiceId,
      printCount: 0,
      history: [],
    };
  },

  recordExitSlipPrint(invoiceId: string, printedBy: string, printedAt?: string): ExitSlipData {
    const logs = this.getExitSlipLogs();
    const current = logs[invoiceId] || {
      invoiceId,
      printCount: 0,
      history: [],
    };
    const timestamp = printedAt || `${getCurrentJalaliDate()} - ساعت ${getCurrentJalaliTime()}`;
    const newRecord: ExitSlipPrintRecord = {
      printedAt: timestamp,
      printedBy: printedBy || 'انباردار',
    };
    const updated: ExitSlipData = {
      ...current,
      printCount: (current.printCount || 0) + 1,
      lastPrintedAt: timestamp,
      lastPrintedBy: printedBy || 'انباردار',
      history: [newRecord, ...(current.history || [])],
    };
    logs[invoiceId] = updated;
    this.saveExitSlipLogs(logs);
    return updated;
  },

  clearInvoices() {
    localStorage.setItem(STORAGE_KEYS.INVOICES, JSON.stringify([]));
  },

  clearAllData() {
    localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify([]));
    localStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify([]));
    localStorage.setItem(STORAGE_KEYS.INVOICES, JSON.stringify([]));
    localStorage.setItem(STORAGE_KEYS.MOVEMENTS, JSON.stringify([]));
  },

  resetSettingsToDefault(): StoreSettings {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(initialSettings));
    return initialSettings;
  },

  getStorageStats() {
    let totalBytes = 0;
    Object.values(STORAGE_KEYS).forEach((key) => {
      const val = localStorage.getItem(key);
      if (val) {
        totalBytes += val.length * 2; // approx 2 bytes per utf-16 char
      }
    });
    const sizeKB = (totalBytes / 1024).toFixed(1);
    return {
      totalBytes,
      sizeKB,
    };
  },

  exportAllData(): string {
    const backup = {
      version: '1.1',
      exportDate: getCurrentJalaliDate(),
      timestamp: new Date().toISOString(),
      products: this.getProducts(),
      customers: this.getCustomers(),
      invoices: this.getInvoices(),
      movements: this.getMovements(),
      settings: this.getSettings(),
      users: this.getUsers(),
      currentUserId: this.getActiveUser().id,
    };
    return JSON.stringify(backup, null, 2);
  },

  importAllData(jsonString: string): boolean {
    try {
      const parsed = JSON.parse(jsonString);
      if (parsed.products && Array.isArray(parsed.products)) {
        this.saveProducts(parsed.products);
      }
      if (parsed.customers && Array.isArray(parsed.customers)) {
        this.saveCustomers(parsed.customers);
      }
      if (parsed.invoices && Array.isArray(parsed.invoices)) {
        this.saveInvoices(parsed.invoices);
      }
      if (parsed.movements && Array.isArray(parsed.movements)) {
        this.saveMovements(parsed.movements);
      }
      if (parsed.settings && typeof parsed.settings === 'object') {
        this.saveSettings(parsed.settings);
      }
      if (parsed.users && Array.isArray(parsed.users)) {
        this.saveUsers(parsed.users);
      }
      return true;
    } catch (e) {
      console.error('Failed to import backup:', e);
      return false;
    }
  },

  resetToDefaults() {
    localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(initialProducts));
    localStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify(initialCustomers));
    localStorage.setItem(STORAGE_KEYS.INVOICES, JSON.stringify(initialInvoices));
    localStorage.setItem(STORAGE_KEYS.MOVEMENTS, JSON.stringify(initialMovements));
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(initialSettings));
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(initialUsers));
    localStorage.setItem(STORAGE_KEYS.CURRENT_USER_ID, initialUsers[0].id);
  }
};
