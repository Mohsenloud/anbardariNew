import { 
  Product, 
  Customer, 
  Invoice, 
  StockMovement, 
  StockMovementType,
  StoreSettings, 
  AppUser, 
  UserRole, 
  UserPermissions, 
  ExitSlipData, 
  ExitSlipPrintRecord, 
  PaymentMethod,
  PurchaseInvoice,
  InboundReceipt,
  InvoiceShareLink,
  ActivityLog,
  ActivityActionCategory,
  ServerBackupInfo,
  DirectTransfer,
  DirectTransferItem,
  DirectTransferReturnRecord,
  SavedVehicle,
  CustomerTransaction,
  CustomerLedgerEntry,
  PublicCustomerRemittance,
  PublicCustomerDeposit,
  PublicCustomerLedger
} from '../types';
import { getCurrentJalaliDate, getCurrentJalaliTime } from './jalali';
import {
  ensureProductCodesAndBarcodes,
  generateNextProductCode,
  generateProductBarcode,
  generateVariantCode,
  generateVariantBarcode,
  generateNextInvoiceNumber,
  generateNextExitSlipNumber,
  generateNextInboundReceiptNumber,
  generateNextPurchaseInvoiceNumber,
  generateNextTransferNumber,
} from './codeGenerator';

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
  PURCHASE_INVOICES: 'factor_app_purchase_invoices_v1',
  INBOUND_RECEIPTS: 'factor_app_inbound_receipts_v1',
  MOVEMENTS: 'factor_app_movements_v1',
  SETTINGS: 'factor_app_settings_v1',
  USERS: 'factor_app_users_v1',
  CURRENT_USER_ID: 'factor_app_current_user_id_v1',
  EXIT_SLIP_LOGS: 'factor_app_exit_slip_logs_v1',
  ACTIVITY_LOGS: 'factor_app_activity_logs_v1',
  DIRECT_TRANSFERS: 'factor_app_direct_transfers_v1',
  DELETED_INVOICES: 'factor_app_deleted_invoices_v1',
  TOMBSTONES: 'factor_app_tombstones_v1',
  SAVED_VEHICLES: 'factor_app_saved_vehicles_v1',
  CUSTOMER_TRANSACTIONS: 'factor_app_customer_transactions_v1',
  CATEGORIES: 'factor_app_categories_v1',
};

export interface AppTombstones {
  invoices: string[];
  products: string[];
  customers: string[];
  purchaseInvoices: string[];
  inboundReceipts: string[];
  directTransfers: string[];
  savedVehicles: string[];
  customerTransactions: string[];
  users: string[];
  categories: string[];
}

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
    id: 'prod-hardener-1',
    code: '1000',
    barcode: '2100000010009',
    name: 'پودر سخت کننده خشک پاش صنعتی',
    category: 'مصالح بتن و کفسازی',
    unit: 'کیسه ۲۵ کیلویی',
    buyPrice: 2800000,
    sellPrice: 3500000,
    stock: 155,
    minStockAlert: 20,
    description: 'پودر سخت کننده ضدسایش پایه سیمانی و سیلیسی ویژه کفسازی بتنی',
    updatedAt: getCurrentJalaliDate(),
    hasVariants: true,
    variants: [
      {
        id: 'var-hardener-grey',
        name: 'طوسی',
        code: '1000-GR',
        barcode: '2110000100011',
        buyPrice: 2800000,
        sellPrice: 3500000,
        stock: 80,
        minStockAlert: 15,
      },
      {
        id: 'var-hardener-red',
        name: 'قرمز',
        code: '1000-RD',
        barcode: '2110000100028',
        buyPrice: 2950000,
        sellPrice: 3750000,
        stock: 45,
        minStockAlert: 10,
      },
      {
        id: 'var-hardener-green',
        name: 'سبز',
        code: '1000-GN',
        barcode: '2110000100035',
        buyPrice: 3200000,
        sellPrice: 4100000,
        stock: 30,
        minStockAlert: 10,
      },
    ],
  },
  {
    id: 'prod-1',
    code: '1001',
    barcode: '2100000010016',
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
    barcode: '2100000010023',
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
    barcode: '2100000010030',
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
    barcode: '2100000010047',
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
    barcode: '2100000010054',
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
    barcode: '2100000010061',
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
    barcode: '2100000010078',
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

const initialInvoices: Invoice[] = [];

const initialPurchaseInvoices: PurchaseInvoice[] = [];

const initialInboundReceipts: InboundReceipt[] = [];

const initialMovements: StockMovement[] = [];

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
  enableSimpleTemplate: true,
  defaultTemplate: 'standard',
  enableSimpleExitSlipTemplate: true,
  defaultExitSlipTemplate: 'standard',

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
  warehouses: [
    { id: 'wh-1', name: 'انبار مرکزی', code: 'WH-01', address: 'تهران، جاده مخصوص، کیلومتر ۱۲، سوله شماره ۴', phone: '۰۲۱-۵۵۴۴۳۳۲۲', managerName: 'مرتضی اکبری', isDefault: true },
    { id: 'wh-2', name: 'انبار شعبه ۱', code: 'WH-02', address: 'تهران، خیابان امیرکبیر، کوچه بهار، پلاک ۲۴', phone: '۰۲۱-۳۳۴۴۵۵۶۶', managerName: 'علی رضایی', isDefault: false },
    { id: 'wh-3', name: 'انبار ضایعات و رزرو', code: 'WH-03', address: 'تهران، انتهای جاده قدیم، پلاک ۸', phone: '۰۲۱-۲۲۳۳۴۴۵۵', managerName: 'حسن مرادی', isDefault: false },
  ],
  defaultWarehouseId: 'wh-1',
  originWarehouseName: 'انبار مرکزی سپهر',
  originWarehouseCode: 'WH-01',
  originWarehouseAddress: 'تهران، جاده مخصوص، کیلومتر ۱۲، خیابان بهار، سوله شماره ۴',
  originWarehousePhone: '۰۲۱-۵۵۴۴۳۳۲۲',
  originWarehouseManager: 'مرتضی اکبری (انباردار مرکزی)',

  // کیفیت و وضوح فایل‌های خروجی PDF (فاکتور و حواله خروج انبار)
  pdfInvoiceQuality: 'standard',
  pdfExitSlipQuality: 'high',
  pdfSyncQuality: false,

  // تنظیمات ربات تلگرام
  telegramBotEnabled: false,
  telegramBotToken: '',
  telegramChatId: '',
  telegramAutoSendInvoice: false,
  telegramAutoSendOnlyConfirmed: true,
  telegramAutoSendOnProformaConvert: true,
  telegramAutoSendExitSlip: false,
  telegramAutoSendInboundReceipt: false,
  telegramAutoSendCustomerDirect: true,
  telegramInvoicePageSize: 'a4',
  telegramInvoiceOrientation: 'portrait',
  telegramInvoiceTemplate: 'standard',
  telegramExitSlipPageSize: 'a4',
  telegramExitSlipOrientation: 'portrait',
  telegramExitSlipTemplate: 'standard',
  telegramCaptionTemplate: '',
};

const initialActivityLogs: ActivityLog[] = [
  {
    id: 'log-1',
    userId: 'user-1',
    userName: 'حمیدرضا سپهری',
    userRole: 'admin',
    userRoleTitle: 'مدیر کل سیستم',
    category: 'auth',
    actionType: 'login',
    actionTitle: 'ورود به سیستم',
    details: 'ورود موفق به سامانه و احراز هویت مدیر ارشد',
    timestamp: `${getCurrentJalaliDate()} - ۰۸:۳۰:۱۵`,
    dateOnly: getCurrentJalaliDate(),
    deviceInfo: 'مرورگر وب (رایانه)',
  },
  {
    id: 'log-2',
    userId: 'user-2',
    userName: 'سارا محمدی',
    userRole: 'cashier',
    userRoleTitle: 'صندوق‌دار شیفت صبح',
    category: 'sales',
    actionType: 'create_invoice',
    actionTitle: 'صدور فاکتور فروش',
    details: 'صدور فاکتور شماره INV-1001 برای مشتری شرکت فناوران داده‌پرداز پایتخت به مبلغ ۲,۴۶۳,۲۰۰ تومان',
    timestamp: `${getCurrentJalaliDate()} - ۰۹:۱۵:۴۰`,
    dateOnly: getCurrentJalaliDate(),
    deviceInfo: 'صندوق فروشگاه (POS)',
  },
  {
    id: 'log-3',
    userId: 'user-3',
    userName: 'حسین اکبری',
    userRole: 'warehouse',
    userRoleTitle: 'مسئول انبار و موجودی',
    category: 'warehouse',
    actionType: 'verify_receipt',
    actionTitle: 'ثبت مغایرت و تایید حواله ورود',
    details: 'شمارش و تایید حواله ورود REC-1001 مربوط به فاکتور خرید PUR-1001 با مغایرت ۱۵- عدد فلش مموری',
    timestamp: `${getCurrentJalaliDate()} - ۱۰:۴۵:۱۲`,
    dateOnly: getCurrentJalaliDate(),
    deviceInfo: 'مرورگر همراه (موبایل)',
  },
  {
    id: 'log-4',
    userId: 'user-1',
    userName: 'حمیدرضا سپهری',
    userRole: 'admin',
    userRoleTitle: 'مدیر کل سیستم',
    category: 'settings',
    actionType: 'update_settings',
    actionTitle: 'به‌روزرسانی پیکربندی فروشگاه',
    details: 'بروزرسانی مشخصات سربرگ و فعال‌سازی کسر خودکار موجودی انبار هنگام صدور فاکتور',
    timestamp: `${getCurrentJalaliDate()} - ۱۱:۲۰:۰۰`,
    dateOnly: getCurrentJalaliDate(),
    deviceInfo: 'مرورگر وب (رایانه)',
  },
];

const initialDirectTransfers: DirectTransfer[] = [];

export const initialSavedVehicles: SavedVehicle[] = [
  {
    id: 'veh-1',
    vehicleType: 'وانت نیسان',
    vehicleInfo: 'وانت نیسان - (آبی) - پلاک: ۲۴ ع ۵۶۷ ایران ۶۸',
    driverName: 'علی رضایی',
    driverPhone: '۰۹۱۲۳۴۵۶۷۸۹',
    plateNumber: '۲۴ ع ۵۶۷ ایران ۶۸',
    colorDesc: 'آبی',
    notes: 'باربری اختصاصی انبار مرکزی',
    createdAt: '۱۴۰۳/۰۶/۰۱',
  },
  {
    id: 'veh-2',
    vehicleType: 'خاور / ایسوزو',
    vehicleInfo: 'خاور / ایسوزو - (سفید) - پلاک: ۸۸ ع ۲۱۴ ایران ۱۱',
    driverName: 'محمد کاظمی',
    driverPhone: '۰۹۳۵۱۱۱۲۲۳۳',
    plateNumber: '۸۸ ع ۲۱۴ ایران ۱۱',
    colorDesc: 'سفید',
    notes: 'حمل بارهای سنگین و حجیم',
    createdAt: '۱۴۰۳/۰۶/۰۵',
  },
  {
    id: 'veh-3',
    vehicleType: 'وانت پراید',
    vehicleInfo: 'وانت پراید - (سفید) - پلاک: ۶۳ ب ۹۱۵ ایران ۲۱',
    driverName: 'رضا کریمی',
    driverPhone: '۰۹۱۲۹۸۷۶۵۴۳',
    plateNumber: '۶۳ ب ۹۱۵ ایران ۲۱',
    colorDesc: 'سفید',
    notes: 'ارسال سریع درون‌شهری',
    createdAt: '۱۴۰۳/۰۶/۱۰',
  },
];

export const StorageService = {
  _listeners: [] as Array<() => void>,
  _lastServerRevision: 0,
  _lastServerChecksum: '',
  _lastLocalSettingsSaveTime: 0,
  _pendingPushPayload: {} as Record<string, any>,
  _pushTimer: null as any,

  subscribe(fn: () => void) {
    this._listeners.push(fn);
    return () => {
      this._listeners = this._listeners.filter((l) => l !== fn);
    };
  },

  notifyChange() {
    this._listeners.forEach((fn) => {
      try {
        fn();
      } catch (err) {
        console.error('Listener notify error:', err);
      }
    });
  },

  // Track deleted items across all entities to prevent zombie rebirth during sync
  getDeletedTombstones(): AppTombstones {
    const emptyTombstones: AppTombstones = {
      invoices: [],
      products: [],
      customers: [],
      purchaseInvoices: [],
      inboundReceipts: [],
      directTransfers: [],
      savedVehicles: [],
      customerTransactions: [],
      users: [],
      categories: [],
    };

    try {
      const raw = localStorage.getItem(STORAGE_KEYS.TOMBSTONES);
      let tombstones: AppTombstones = emptyTombstones;
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          tombstones = { ...emptyTombstones, ...parsed };
        }
      }

      // Backward compatibility with DELETED_INVOICES key
      const legacyInvoices = localStorage.getItem(STORAGE_KEYS.DELETED_INVOICES);
      if (legacyInvoices) {
        const arr = JSON.parse(legacyInvoices);
        if (Array.isArray(arr)) {
          const set = new Set([...(tombstones.invoices || []), ...arr]);
          tombstones.invoices = Array.from(set);
        }
      }

      return tombstones;
    } catch {
      return emptyTombstones;
    }
  },

  getDeletedInvoiceIds(): Set<string> {
    const tombstones = this.getDeletedTombstones();
    return new Set<string>(tombstones.invoices || []);
  },

  recordTombstone(entityType: keyof AppTombstones, id: string | string[]) {
    try {
      const ids = (Array.isArray(id) ? id : [id]).filter(Boolean).map((i) => String(i).trim());
      if (ids.length === 0) return;

      const current = this.getDeletedTombstones();
      const list = new Set(current[entityType] || []);
      ids.forEach((item) => list.add(item));
      current[entityType] = Array.from(list).slice(-2000);

      localStorage.setItem(STORAGE_KEYS.TOMBSTONES, JSON.stringify(current));

      if (entityType === 'invoices') {
        localStorage.setItem(STORAGE_KEYS.DELETED_INVOICES, JSON.stringify(current.invoices));
      }

      // Fire dedicated instant delete API to central server
      const apiTypeMap: Record<keyof AppTombstones, string> = {
        invoices: 'invoice',
        products: 'product',
        customers: 'customer',
        purchaseInvoices: 'purchaseInvoice',
        inboundReceipts: 'inboundReceipt',
        directTransfers: 'directTransfer',
        savedVehicles: 'savedVehicle',
        customerTransactions: 'customerTransaction',
        users: 'user',
        categories: 'category',
      };

      ids.forEach((itemId) => {
        fetch('/api/db/delete-item', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' },
          body: JSON.stringify({ type: apiTypeMap[entityType] || entityType, id: itemId }),
        })
          .then((res) => res.json())
          .then((json) => {
            if (json?.revision && typeof json.revision === 'number') {
              this._lastServerRevision = json.revision;
            }
            if (json?.checksum) {
              this._lastServerChecksum = json.checksum;
            }
          })
          .catch(() => {});
      });
    } catch (e) {
      console.error('Failed to record tombstone:', e);
    }
  },

  markInvoiceDeleted(invoiceIds: string | string[]) {
    try {
      const ids = (Array.isArray(invoiceIds) ? invoiceIds : [invoiceIds]).filter(Boolean).map((i) => String(i).trim());
      this.recordTombstone('invoices', ids);

      const delSet = this.getDeletedInvoiceIds();
      const remaining = this.getInvoices().filter((inv) => !delSet.has(inv.id));
      localStorage.setItem(STORAGE_KEYS.INVOICES, JSON.stringify(remaining));

      // Also clean up local exit slips
      const logs = this.getExitSlipLogs();
      let logsChanged = false;
      ids.forEach((id) => {
        if (logs[id]) {
          delete logs[id];
          logsChanged = true;
        }
      });
      if (logsChanged) {
        localStorage.setItem(STORAGE_KEYS.EXIT_SLIP_LOGS, JSON.stringify(logs));
      }

      this.pushToServer({
        deletedInvoiceIds: Array.from(delSet),
        tombstones: this.getDeletedTombstones(),
        invoices: remaining,
        ...(logsChanged ? { exitSlipLogs: logs } : {}),
      });
      this.notifyChange();
    } catch {}
  },

  // Coalesced / debounced push to server for rapid sequential updates
  queuePushToServer(partialPayload?: Record<string, any>) {
    if (partialPayload) {
      this._pendingPushPayload = {
        ...this._pendingPushPayload,
        ...partialPayload,
      };
    }
    if (this._pushTimer) {
      clearTimeout(this._pushTimer);
    }
    this._pushTimer = setTimeout(() => {
      this._pushTimer = null;
      const toSend = { ...this._pendingPushPayload };
      this._pendingPushPayload = {};
      this.pushToServer(toSend);
    }, 60);
  },

  // Atomic multi-entity save for invoice workflows (Invoice + Stock deduction + Kardex movements + Logs)
  saveInvoiceTransaction(params: {
    invoices: Invoice[];
    products?: Product[];
    movements?: StockMovement[];
    customers?: Customer[];
    activityLogs?: ActivityLog[];
  }) {
    if (params.invoices) {
      localStorage.setItem(STORAGE_KEYS.INVOICES, JSON.stringify(params.invoices));
    }
    if (params.products) {
      const { products: ensuredProducts } = ensureProductCodesAndBarcodes(params.products);
      localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(ensuredProducts));
      params.products = ensuredProducts;
    }
    if (params.movements) {
      localStorage.setItem(STORAGE_KEYS.MOVEMENTS, JSON.stringify(params.movements));
    }
    if (params.customers) {
      localStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify(params.customers));
    }
    if (params.activityLogs) {
      localStorage.setItem(STORAGE_KEYS.ACTIVITY_LOGS, JSON.stringify(params.activityLogs));
    }

    // Cancel any debounced partial pushes and perform one consolidated atomic push
    if (this._pushTimer) {
      clearTimeout(this._pushTimer);
      this._pushTimer = null;
    }
    const deletedArr = Array.from(this.getDeletedInvoiceIds());
    const payload: Record<string, any> = {
      invoices: params.invoices,
      deletedInvoiceIds: deletedArr,
      ...this._pendingPushPayload,
    };
    if (params.products) payload.products = params.products;
    if (params.movements) payload.movements = params.movements;
    if (params.customers) payload.customers = params.customers;
    if (params.activityLogs) payload.activityLogs = params.activityLogs;
    this._pendingPushPayload = {};

    this.pushToServer(payload);
    this.notifyChange();
  },

  // Asynchronously sync local changes to centralized server database
  async pushToServer(customPayload?: any): Promise<boolean> {
    try {
      const tombstones = this.getDeletedTombstones();
      const payload = customPayload
        ? { deletedInvoiceIds: tombstones.invoices, tombstones, ...customPayload }
        : {
            products: this.getProducts(),
            customers: this.getCustomers(),
            invoices: this.getInvoices(),
            purchaseInvoices: this.getPurchaseInvoices(),
            inboundReceipts: this.getInboundReceipts(),
            movements: this.getMovements(),
            settings: this.getSettings(),
            users: this.getUsers(),
            exitSlipLogs: this.getExitSlipLogs(),
            activityLogs: this.getActivityLogs(),
            directTransfers: this.getDirectTransfers(),
            savedVehicles: this.getSavedVehicles(),
            customerTransactions: this.getCustomerTransactions(),
            categories: this.getCategories(),
            deletedInvoiceIds: tombstones.invoices,
            tombstones,
          };
      const res = await fetch('/api/db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const json = await res.json();
        if (json && json.success) {
          if (typeof json.revision === 'number') this._lastServerRevision = json.revision;
          if (json.checksum) this._lastServerChecksum = json.checksum;
          return true;
        }
      }
      return false;
    } catch {
      // Local copy is safe in localStorage when offline or server unreachable
      return false;
    }
  },

  // Fetch updated records from server and sync into local storage with Zero-Loss Protection & Cache Busting
  async syncFromServer(): Promise<boolean> {
    try {
      const res = await fetch(`/api/db?_t=${Date.now()}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
        },
      });
      if (!res.ok) return false;
      const json = await res.json();
      if (json && json.success && json.data) {
        const d = json.data;
        const serverRevision = typeof d.revision === 'number' ? d.revision : 0;
        const serverChecksum = d.checksum || '';

        // If server data hasn't changed since last sync or local push, skip overwrite
        if (
          this._lastServerRevision > 0 &&
          serverRevision > 0 &&
          serverRevision === this._lastServerRevision &&
          serverChecksum === this._lastServerChecksum
        ) {
          return false;
        }

        // Protect local settings if recently saved (e.g. within last 10 seconds)
        const isRecentSave = Date.now() - this._lastLocalSettingsSaveTime < 10000;

        let hasAnyUpdate = false;

        // 1. Synchronize server-wide tombstones across all entities
        const localTombstones = this.getDeletedTombstones();
        let tombstonesUpdated = false;

        const mergeList = (key: keyof AppTombstones, serverList: any) => {
          if (Array.isArray(serverList)) {
            const set = new Set(localTombstones[key] || []);
            serverList.forEach((id: string) => {
              if (typeof id === 'string' && id.trim() && !set.has(id.trim())) {
                set.add(id.trim());
                tombstonesUpdated = true;
              }
            });
            localTombstones[key] = Array.from(set).slice(-2000);
          }
        };

        if (d.tombstones && typeof d.tombstones === 'object') {
          mergeList('invoices', d.tombstones.invoices);
          mergeList('products', d.tombstones.products);
          mergeList('customers', d.tombstones.customers);
          mergeList('purchaseInvoices', d.tombstones.purchaseInvoices);
          mergeList('inboundReceipts', d.tombstones.inboundReceipts);
          mergeList('directTransfers', d.tombstones.directTransfers);
          mergeList('savedVehicles', d.tombstones.savedVehicles);
          mergeList('customerTransactions', d.tombstones.customerTransactions);
          mergeList('users', d.tombstones.users);
          mergeList('categories', d.tombstones.categories);
        }

        if (Array.isArray(d.deletedInvoiceIds)) {
          mergeList('invoices', d.deletedInvoiceIds);
        }

        if (tombstonesUpdated) {
          localStorage.setItem(STORAGE_KEYS.TOMBSTONES, JSON.stringify(localTombstones));
          localStorage.setItem(STORAGE_KEYS.DELETED_INVOICES, JSON.stringify(localTombstones.invoices));
        }

        const invDelSet = new Set(localTombstones.invoices);
        const prodDelSet = new Set(localTombstones.products);
        const custDelSet = new Set(localTombstones.customers);
        const purchDelSet = new Set(localTombstones.purchaseInvoices);
        const inbDelSet = new Set(localTombstones.inboundReceipts);
        const transDelSet = new Set(localTombstones.directTransfers);
        const vehDelSet = new Set(localTombstones.savedVehicles);
        const txnDelSet = new Set(localTombstones.customerTransactions || []);
        const usrDelSet = new Set(localTombstones.users);
        const catDelSet = new Set(localTombstones.categories.map((c) => c.toLowerCase()));

        // 2. Authoritative Data Synchronization with Tombstone Filtering
        if (Array.isArray(d.products)) {
          const cleanProducts = d.products.filter((p: Product) => !prodDelSet.has(p.id));
          localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(cleanProducts));
          hasAnyUpdate = true;
        }

        if (Array.isArray(d.customers)) {
          const cleanCustomers = d.customers.filter((c: Customer) => !custDelSet.has(c.id));
          localStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify(cleanCustomers));
          hasAnyUpdate = true;
        }

        if (Array.isArray(d.invoices)) {
          const finalInvoices = d.invoices.filter((inv: Invoice) => !invDelSet.has(inv.id));
          localStorage.setItem(STORAGE_KEYS.INVOICES, JSON.stringify(finalInvoices));
          hasAnyUpdate = true;
        }

        if (Array.isArray(d.purchaseInvoices)) {
          const cleanPurchases = d.purchaseInvoices.filter((p: PurchaseInvoice) => !purchDelSet.has(p.id));
          localStorage.setItem(STORAGE_KEYS.PURCHASE_INVOICES, JSON.stringify(cleanPurchases));
          hasAnyUpdate = true;
        }

        if (Array.isArray(d.inboundReceipts)) {
          const cleanInbound = d.inboundReceipts.filter((r: InboundReceipt) => !inbDelSet.has(r.id));
          localStorage.setItem(STORAGE_KEYS.INBOUND_RECEIPTS, JSON.stringify(cleanInbound));
          hasAnyUpdate = true;
        }

        if (Array.isArray(d.movements)) {
          localStorage.setItem(STORAGE_KEYS.MOVEMENTS, JSON.stringify(d.movements));
          hasAnyUpdate = true;
        }

        if (Array.isArray(d.users)) {
          const cleanUsers = d.users.filter((u: AppUser) => !usrDelSet.has(u.id));
          localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(cleanUsers));
          hasAnyUpdate = true;
        }

        if (Array.isArray(d.directTransfers)) {
          const cleanTransfers = d.directTransfers.filter((t: DirectTransfer) => !transDelSet.has(t.id));
          localStorage.setItem(STORAGE_KEYS.DIRECT_TRANSFERS, JSON.stringify(cleanTransfers));
          hasAnyUpdate = true;
        }

        if (Array.isArray(d.savedVehicles)) {
          const cleanVehicles = d.savedVehicles.filter((v: any) => !vehDelSet.has(v.id));
          localStorage.setItem(STORAGE_KEYS.SAVED_VEHICLES, JSON.stringify(cleanVehicles));
          hasAnyUpdate = true;
        }

        if (Array.isArray(d.customerTransactions)) {
          const cleanTransactions = d.customerTransactions.filter((t: CustomerTransaction) => !txnDelSet.has(t.id));
          localStorage.setItem(STORAGE_KEYS.CUSTOMER_TRANSACTIONS, JSON.stringify(cleanTransactions));
          hasAnyUpdate = true;
        }

        if (d.settings && typeof d.settings === 'object') {
          if (!isRecentSave) {
            const currentLocal = this.getSettings();
            const mergedSettings = {
              ...initialSettings,
              ...currentLocal,
              ...d.settings,
            };
            if (Array.isArray(d.settings.warehouses) && d.settings.warehouses.length > 0) {
              mergedSettings.warehouses = d.settings.warehouses;
            } else if (Array.isArray(currentLocal.warehouses) && currentLocal.warehouses.length > 0) {
              mergedSettings.warehouses = currentLocal.warehouses;
            }
            localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(mergedSettings));
            hasAnyUpdate = true;
          }
        }

        if (d.exitSlipLogs && typeof d.exitSlipLogs === 'object' && !Array.isArray(d.exitSlipLogs)) {
          const remoteLogs = (d.exitSlipLogs || {}) as Record<string, ExitSlipData>;
          const cleaned: Record<string, ExitSlipData> = {};
          // Only keep exit slips that belong to non-deleted invoices
          for (const [invId, slip] of Object.entries(remoteLogs)) {
            if (!invDelSet.has(invId)) {
              cleaned[invId] = slip;
            }
          }
          localStorage.setItem(STORAGE_KEYS.EXIT_SLIP_LOGS, JSON.stringify(cleaned));
          hasAnyUpdate = true;
        }

        if (Array.isArray(d.activityLogs)) {
          localStorage.setItem(STORAGE_KEYS.ACTIVITY_LOGS, JSON.stringify(d.activityLogs));
          hasAnyUpdate = true;
        }

        if (Array.isArray(d.categories)) {
          const cleanCats = d.categories.filter((c: string) => !catDelSet.has(String(c).trim().toLowerCase()));
          localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(cleanCats));
          hasAnyUpdate = true;
        }

        this._lastServerRevision = serverRevision;
        this._lastServerChecksum = serverChecksum;
        if (hasAnyUpdate) {
          this.notifyChange();
        }
        return hasAnyUpdate;
      }
      return false;
    } catch {
      return false;
    }
  },

  // -------------------------------------------------------------
  // SERVER AUTOMATED & MANUAL BACKUP METHODS
  // -------------------------------------------------------------
  async getServerBackups(): Promise<{
    success: boolean;
    total: number;
    autoBackupIntervalHours: number;
    backups: ServerBackupInfo[];
  }> {
    try {
      const res = await fetch('/api/backups');
      if (!res.ok) return { success: false, total: 0, autoBackupIntervalHours: 4, backups: [] };
      return await res.json();
    } catch {
      return { success: false, total: 0, autoBackupIntervalHours: 4, backups: [] };
    }
  },

  async createServerBackup(label?: string): Promise<{ success: boolean; message?: string; filename?: string; backups?: ServerBackupInfo[] }> {
    try {
      const res = await fetch('/api/backups/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label }),
      });
      return await res.json();
    } catch (e: any) {
      return { success: false, message: e.message || 'خطا در برقراری ارتباط با سرور' };
    }
  },

  async restoreServerBackup(filename: string): Promise<{ success: boolean; message?: string }> {
    try {
      const res = await fetch('/api/backups/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename }),
      });
      const data = await res.json();
      if (data.success) {
        await this.syncFromServer();
      }
      return data;
    } catch (e: any) {
      return { success: false, message: e.message || 'خطا در بازیابی نسخه پشتیبان' };
    }
  },

  async deleteServerBackup(filename: string): Promise<{ success: boolean; message?: string; backups?: ServerBackupInfo[] }> {
    try {
      const res = await fetch(`/api/backups/${encodeURIComponent(filename)}`, {
        method: 'DELETE',
      });
      return await res.json();
    } catch (e: any) {
      return { success: false, message: e.message || 'خطا در حذف نسخه پشتیبان' };
    }
  },

  async uploadServerBackup(fileContent: string, restoreNow: boolean, label?: string): Promise<{ success: boolean; message?: string; backups?: ServerBackupInfo[] }> {
    try {
      const res = await fetch('/api/backups/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ backupContent: fileContent, restoreNow, label }),
      });
      const data = await res.json();
      if (data.success && restoreNow) {
        await this.syncFromServer();
      }
      return data;
    } catch (e: any) {
      return { success: false, message: e.message || 'خطا در بارگذاری فایل پشتیبان' };
    }
  },

  // -------------------------------------------------------------
  // POSTGRESQL & DATABASE STATUS / TEST APIS
  // -------------------------------------------------------------
  async getDatabaseStatus(): Promise<any> {
    try {
      const res = await fetch('/api/database/status');
      if (!res.ok) return { success: false, message: 'عدم پاسخگویی سرور' };
      return await res.json();
    } catch (e: any) {
      return { success: false, message: e.message || 'خطا در برقراری ارتباط با سرور' };
    }
  },

  async testDatabaseConnection(): Promise<any> {
    try {
      const res = await fetch('/api/database/test', { method: 'POST' });
      return await res.json();
    } catch (e: any) {
      return { success: false, message: e.message || 'خطا در تست اتصال دیتابیس' };
    }
  },

  async forceSyncToPostgres(): Promise<{ success: boolean; message: string }> {
    try {
      const res = await fetch('/api/database/force-sync', { method: 'POST' });
      return await res.json();
    } catch (e: any) {
      return { success: false, message: e.message || 'خطا در اجرای همگام‌سازی با PostgreSQL' };
    }
  },

  async downloadPostgresSqlDump(): Promise<boolean> {
    try {
      const res = await fetch('/api/database/export-sql');
      if (!res.ok) throw new Error('خطا در دریافت فایل SQL از سرور');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `mana_db_dump_${new Date().toISOString().slice(0, 10)}.sql`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      return true;
    } catch (e) {
      console.error(e);
      return false;
    }
  },

  async importPostgresSqlFile(sqlContent: string): Promise<{ success: boolean; message: string }> {
    try {
      const res = await fetch('/api/database/import-sql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/sql' },
        body: sqlContent,
      });
      const data = await res.json();
      if (data.success) {
        await this.syncFromServer();
      }
      return data;
    } catch (e: any) {
      return { success: false, message: e.message || 'خطا در بارگذاری و اجرای اسکریپت SQL' };
    }
  },

  async createPostgresSnapshot(label?: string): Promise<{ success: boolean; message: string }> {
    try {
      const res = await fetch('/api/database/snapshot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: label || 'نسخه پشتیبان دستی دیتابیس PostgreSQL' }),
      });
      return await res.json();
    } catch (e: any) {
      return { success: false, message: e.message || 'خطا در ثبت اسنپ‌شات در دیتابیس' };
    }
  },

  getProducts(): Product[] {
    const data = localStorage.getItem(STORAGE_KEYS.PRODUCTS);
    const tombstones = this.getDeletedTombstones();
    const prodDelSet = new Set(tombstones.products || []);

    let list: Product[] = [];
    if (!data) {
      list = initialProducts.filter((p) => !prodDelSet.has(p.id));
    } else {
      try {
        const parsed: Product[] = JSON.parse(data);
        list = Array.isArray(parsed) ? parsed.filter((p) => !prodDelSet.has(p.id)) : [];
      } catch {
        list = initialProducts.filter((p) => !prodDelSet.has(p.id));
      }
    }

    // تضمین خودکار کد و بارکد کالاها و تنوع‌ها توسط سیستم
    const { products: ensuredProducts, changed } = ensureProductCodesAndBarcodes(list);
    if (changed || !data) {
      localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(ensuredProducts));
    }
    return ensuredProducts;
  },

  saveProducts(products: Product[]) {
    const tombstones = this.getDeletedTombstones();
    const prodDelSet = new Set(tombstones.products || []);
    const clean = products.filter((p) => !prodDelSet.has(p.id));

    // پیش از ذخیره‌سازی، اطمینان از تکمیل بودن کد و بارکد تمام اقلام توسط سیستم
    const { products: ensuredProducts } = ensureProductCodesAndBarcodes(clean);
    localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(ensuredProducts));
    this.queuePushToServer({ products: ensuredProducts });
  },

  deleteProduct(productId: string) {
    const cleanId = String(productId).trim();
    this.recordTombstone('products', cleanId);

    const remaining = this.getProducts().filter((p) => p.id !== cleanId);
    localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(remaining));
    this.queuePushToServer({ products: remaining });
    this.notifyChange();
  },

  // -------------------------------------------------------------
  // CATEGORIES MANAGEMENT (دسته‌بندی‌های محصولات)
  // -------------------------------------------------------------
  getCategories(): string[] {
    const defaultCategories = [
      'عمومی',
      'قطعات',
      'لوازم جانبی',
      'مواد اولیه',
      'ابزارآلات',
      'ملزومات اداری',
      'ذخیره‌سازی',
      'کابل و رابط',
    ];

    try {
      const tombstones = this.getDeletedTombstones();
      const catDelSet = new Set((tombstones.categories || []).map((c) => c.toLowerCase()));

      const products = this.getProducts();
      const productCategories: string[] = products
        .map((p) => p.category?.trim())
        .filter((c): c is string => Boolean(c) && !catDelSet.has(c.toLowerCase()));
      const raw = localStorage.getItem(STORAGE_KEYS.CATEGORIES);

      if (!raw) {
        const merged: string[] = Array.from(new Set<string>([...defaultCategories, ...productCategories]))
          .filter((c) => !catDelSet.has(c.toLowerCase()));
        localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(merged));
        return merged;
      }

      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const parsedClean: string[] = parsed
          .map((c) => String(c).trim())
          .filter((c) => Boolean(c) && !catDelSet.has(c.toLowerCase()));
        const merged: string[] = Array.from(new Set<string>([...parsedClean, ...productCategories]));
        if (merged.length !== parsed.length) {
          localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(merged));
        }
        return merged;
      }
      return Array.from(new Set<string>([...defaultCategories, ...productCategories]))
        .filter((c) => !catDelSet.has(c.toLowerCase()));
    } catch {
      return defaultCategories;
    }
  },

  saveCategories(categories: string[]) {
    const tombstones = this.getDeletedTombstones();
    const catDelSet = new Set((tombstones.categories || []).map((c) => c.toLowerCase()));
    const clean = Array.from(new Set(categories.map((c) => c.trim()).filter((c) => Boolean(c) && !catDelSet.has(c.toLowerCase()))));
    localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(clean));
    this.queuePushToServer({ categories: clean });
    this.notifyChange();
  },

  addCategory(name: string): boolean {
    const clean = name.trim();
    if (!clean) return false;
    const current = this.getCategories();
    if (current.some((c) => c.toLowerCase() === clean.toLowerCase())) return false;
    this.saveCategories([...current, clean]);
    return true;
  },

  renameCategory(oldName: string, newName: string, updateProducts = true): boolean {
    const cleanOld = oldName.trim();
    const cleanNew = newName.trim();
    if (!cleanNew || cleanOld === cleanNew) return false;

    const current = this.getCategories();
    const updatedCategories = current.map((c) => (c === cleanOld ? cleanNew : c));
    this.saveCategories(updatedCategories);

    if (updateProducts) {
      const products = this.getProducts();
      let changed = false;
      const updatedProducts = products.map((p) => {
        if (p.category === cleanOld) {
          changed = true;
          return { ...p, category: cleanNew };
        }
        return p;
      });
      if (changed) {
        this.saveProducts(updatedProducts);
      }
    }
    return true;
  },

  deleteCategory(categoryName: string, reassignTo = 'عمومی'): boolean {
    const clean = categoryName.trim();
    this.recordTombstone('categories', clean);

    const current = this.getCategories();
    const updated = current.filter((c) => c !== clean);
    this.saveCategories(updated);

    const products = this.getProducts();
    let changed = false;
    const updatedProducts = products.map((p) => {
      if (p.category === clean) {
        changed = true;
        return { ...p, category: reassignTo };
      }
      return p;
    });
    if (changed) {
      this.saveProducts(updatedProducts);
    }
    this.notifyChange();
    return true;
  },

  getCustomers(): Customer[] {
    const data = localStorage.getItem(STORAGE_KEYS.CUSTOMERS);
    const tombstones = this.getDeletedTombstones();
    const custDelSet = new Set(tombstones.customers || []);

    if (!data) {
      const clean = initialCustomers.filter((c) => !custDelSet.has(c.id));
      localStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify(clean));
      return clean;
    }
    try {
      const parsed = JSON.parse(data);
      return Array.isArray(parsed) ? parsed.filter((c: Customer) => !custDelSet.has(c.id)) : [];
    } catch {
      return initialCustomers.filter((c) => !custDelSet.has(c.id));
    }
  },

  saveCustomers(customers: Customer[]) {
    const tombstones = this.getDeletedTombstones();
    const custDelSet = new Set(tombstones.customers || []);
    const clean = customers.filter((c) => !custDelSet.has(c.id));
    localStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify(clean));
    this.queuePushToServer({ customers: clean });
  },

  deleteCustomer(customerId: string) {
    const cleanId = String(customerId).trim();
    this.recordTombstone('customers', cleanId);

    const remaining = this.getCustomers().filter((c) => c.id !== cleanId);
    localStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify(remaining));
    this.queuePushToServer({ customers: remaining });
    this.notifyChange();
  },

  // -------------------------------------------------------------
  // CUSTOMER TRANSACTIONS & FINANCIAL LEDGER (صورتحساب و گردش حساب مشتری)
  // -------------------------------------------------------------
  getCustomerTransactions(): CustomerTransaction[] {
    const data = localStorage.getItem(STORAGE_KEYS.CUSTOMER_TRANSACTIONS);
    const tombstones = this.getDeletedTombstones();
    const txnDelSet = new Set(tombstones.customerTransactions || []);

    if (!data) return [];
    try {
      const parsed = JSON.parse(data);
      return Array.isArray(parsed) ? parsed.filter((t: CustomerTransaction) => !txnDelSet.has(t.id)) : [];
    } catch {
      return [];
    }
  },

  saveCustomerTransactions(transactions: CustomerTransaction[]) {
    const tombstones = this.getDeletedTombstones();
    const txnDelSet = new Set(tombstones.customerTransactions || []);
    const clean = transactions.filter((t) => !txnDelSet.has(t.id));
    localStorage.setItem(STORAGE_KEYS.CUSTOMER_TRANSACTIONS, JSON.stringify(clean));
    this.queuePushToServer({ customerTransactions: clean });
    this.notifyChange();
  },

  addCustomerTransaction(transaction: CustomerTransaction): CustomerTransaction {
    const list = this.getCustomerTransactions();
    const existsIndex = list.findIndex((t) => t.id === transaction.id);
    let updated: CustomerTransaction[];
    if (existsIndex >= 0) {
      updated = list.map((t) => (t.id === transaction.id ? transaction : t));
    } else {
      updated = [transaction, ...list];
    }
    this.saveCustomerTransactions(updated);
    return transaction;
  },

  deleteCustomerTransaction(id: string) {
    const cleanId = String(id).trim();
    this.recordTombstone('customerTransactions', cleanId);
    const remaining = this.getCustomerTransactions().filter((t) => t.id !== cleanId);
    localStorage.setItem(STORAGE_KEYS.CUSTOMER_TRANSACTIONS, JSON.stringify(remaining));
    this.queuePushToServer({ customerTransactions: remaining });
    this.notifyChange();
  },

  getCustomerTransactionsByCustomerId(customerId: string): CustomerTransaction[] {
    const all = this.getCustomerTransactions();
    return all.filter((t) => t.customerId === customerId);
  },

  buildCustomerLedger(
    customer: Customer,
    invoices: Invoice[],
    transactions: CustomerTransaction[]
  ): {
    entries: CustomerLedgerEntry[];
    totalDebit: number;
    totalCredit: number;
    netBalance: number;
    balanceStatus: 'debtor' | 'settled' | 'creditor';
    unpaidInvoicesCount: number;
  } {
    const rawEntries: Omit<CustomerLedgerEntry, 'balance' | 'balanceStatus'>[] = [];

    // 1. Process all sales invoices (excluding proformas)
    const customerInvoices = invoices.filter((inv) => {
      if (inv.isProforma) return false;
      return (
        (inv.customerId && inv.customerId === customer.id) ||
        (inv.customerName && inv.customerName.trim().toLowerCase() === customer.name.trim().toLowerCase())
      );
    });

    let unpaidInvoicesCount = 0;

    customerInvoices.forEach((inv) => {
      const remainingOnInv = Math.max(0, inv.finalTotal - (inv.paidAmount || 0));
      if (remainingOnInv > 0) {
        unpaidInvoicesCount++;
      }

      // 1.1 Debit entry for the full invoice amount
      rawEntries.push({
        id: `inv-deb-${inv.id}`,
        date: inv.date,
        documentNumber: inv.invoiceNumber,
        documentType: 'invoice',
        documentTypeLabel: inv.type === 'official' ? 'فاکتور رسمی فروش' : 'فاکتور فروش',
        description: `خرید کالا طبق فاکتور شماره ${inv.invoiceNumber} (${inv.items.length} قلم)${inv.notes ? ` - ${inv.notes}` : ''}`,
        debit: inv.finalTotal,
        credit: 0,
        paymentMethod: inv.paymentMethod ? PAYMENT_METHOD_LABELS[inv.paymentMethod] || inv.paymentMethod : undefined,
        notes: inv.notes,
        rawInvoice: inv,
      });

      // 1.2 Credit entry if payment occurred at invoice issuance
      if (inv.paidAmount && inv.paidAmount > 0) {
        rawEntries.push({
          id: `inv-pay-${inv.id}`,
          date: inv.date,
          documentNumber: inv.invoiceNumber,
          documentType: 'invoice_payment',
          documentTypeLabel: 'واریز همزمان با فاکتور',
          description: `پرداخت وجه همزمان با صدور فاکتور شماره ${inv.invoiceNumber}${inv.paymentMethod ? ` [${PAYMENT_METHOD_LABELS[inv.paymentMethod] || inv.paymentMethod}]` : ''}${inv.transferDescription ? ` (${inv.transferDescription})` : ''}`,
          debit: 0,
          credit: inv.paidAmount,
          paymentMethod: inv.paymentMethod ? PAYMENT_METHOD_LABELS[inv.paymentMethod] || inv.paymentMethod : undefined,
          trackingNumber: inv.chequeNumber || undefined,
          notes: inv.transferDescription || inv.notes,
          rawInvoice: inv,
        });
      }
    });

    // 2. Process all standalone transactions for this customer
    const customerTxns = transactions.filter((t) => {
      return (
        (t.customerId && t.customerId === customer.id) ||
        (t.customerName && t.customerName.trim().toLowerCase() === customer.name.trim().toLowerCase())
      );
    });

    customerTxns.forEach((txn) => {
      if (txn.type === 'deposit') {
        const payMethodLabel = txn.paymentMethod ? (PAYMENT_METHOD_LABELS[txn.paymentMethod as PaymentMethod] || txn.paymentMethod) : 'واریز به حساب';
        rawEntries.push({
          id: `txn-${txn.id}`,
          date: txn.date,
          documentNumber: txn.trackingNumber || txn.id.substring(0, 8),
          documentType: 'deposit',
          documentTypeLabel: `واریزی / ${payMethodLabel}`,
          description: `${txn.title || 'واریز وجه مشتری'}${txn.bankName ? ` - بانک ${txn.bankName}` : ''}${txn.invoiceNumber ? ` (بابت فاکتور ${txn.invoiceNumber})` : ''}${txn.notes ? ` - ${txn.notes}` : ''}`,
          debit: 0,
          credit: txn.amount,
          paymentMethod: payMethodLabel,
          trackingNumber: txn.trackingNumber,
          notes: txn.notes,
          rawTransaction: txn,
        });
      } else {
        rawEntries.push({
          id: `txn-${txn.id}`,
          date: txn.date,
          documentNumber: txn.trackingNumber || txn.id.substring(0, 8),
          documentType: 'debt',
          documentTypeLabel: 'ثبت بدهی دستی / مانده',
          description: `${txn.title || 'سند افزایش بدهی'}${txn.notes ? ` - ${txn.notes}` : ''}`,
          debit: txn.amount,
          credit: 0,
          trackingNumber: txn.trackingNumber,
          notes: txn.notes,
          rawTransaction: txn,
        });
      }
    });

    // 3. Chronological sorting
    rawEntries.sort((a, b) => {
      const cmp = a.date.localeCompare(b.date);
      if (cmp !== 0) return cmp;
      // If same date, debit comes before credit
      if (a.debit > 0 && b.credit > 0) return -1;
      if (a.credit > 0 && b.debit > 0) return 1;
      return 0;
    });

    // 4. Compute running balance
    let runningBalance = 0;
    let totalDebit = 0;
    let totalCredit = 0;

    const entries: CustomerLedgerEntry[] = rawEntries.map((e) => {
      totalDebit += e.debit;
      totalCredit += e.credit;
      runningBalance += (e.debit - e.credit);

      const balanceStatus: 'debtor' | 'settled' | 'creditor' = 
        runningBalance > 0 ? 'debtor' : runningBalance < 0 ? 'creditor' : 'settled';

      return {
        ...e,
        balance: runningBalance,
        balanceStatus,
      };
    });

    const netBalance = totalDebit - totalCredit;
    const balanceStatus: 'debtor' | 'settled' | 'creditor' = 
      netBalance > 0 ? 'debtor' : netBalance < 0 ? 'creditor' : 'settled';

    return {
      entries,
      totalDebit,
      totalCredit,
      netBalance,
      balanceStatus,
      unpaidInvoicesCount,
    };
  },

  getInvoices(): Invoice[] {
    const data = localStorage.getItem(STORAGE_KEYS.INVOICES);
    const deletedSet = this.getDeletedInvoiceIds();
    if (!data) {
      return [];
    }
    try {
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) {
        return parsed.filter((inv: Invoice) => !deletedSet.has(inv.id));
      }
      return [];
    } catch {
      return [];
    }
  },

  saveInvoices(invoices: Invoice[]) {
    const deletedSet = this.getDeletedInvoiceIds();
    const clean = invoices.filter((inv) => !deletedSet.has(inv.id));
    localStorage.setItem(STORAGE_KEYS.INVOICES, JSON.stringify(clean));
    this.queuePushToServer({ invoices: clean, deletedInvoiceIds: Array.from(deletedSet) });
  },

  // -------------------------------------------------------------
  // SECURE PUBLIC WEB INVOICE SHARING (لینک نسخه تحت وب برای مشتری)
  // -------------------------------------------------------------
  buildInvoicePublicUrl(token: string, customDomain?: string): string {
    const cleanToken = encodeURIComponent(token.trim());
    if (customDomain && customDomain.trim()) {
      let base = customDomain.trim();
      if (!base.startsWith('http://') && !base.startsWith('https://')) {
        base = `https://${base}`;
      }
      base = base.replace(/\/+$/, '');
      return `${base}/v/${cleanToken}`;
    }

    if (typeof window !== 'undefined') {
      const origin = window.location.origin;
      return `${origin}/v/${cleanToken}`;
    }
    return `/v/${cleanToken}`;
  },

  async generateOrUpdateShareLink(
    invoiceId: string,
    options?: {
      enabled?: boolean;
      expiresAt?: string | null;
      isOneTime?: boolean;
      maxViews?: number;
      pinRequired?: boolean;
      pinCode?: string;
      allowPdfDownload?: boolean;
      regenerateToken?: boolean;
    }
  ): Promise<{ success: boolean; invoice?: Invoice; shareLink?: InvoiceShareLink; fullUrl?: string; message?: string }> {
    const invoices = this.getInvoices();
    const targetIdx = invoices.findIndex((i) => i.id === invoiceId);
    if (targetIdx === -1) {
      return { success: false, message: 'فاکتور مورد نظر یافت نشد.' };
    }

    const currentInvoice = invoices[targetIdx];
    const prevLink = currentInvoice.shareLink;
    let token = prevLink?.token;

    if (!token || options?.regenerateToken) {
      token = `inv_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 9)}`;
    }

    const shareLink: InvoiceShareLink = {
      token,
      enabled: options?.enabled !== undefined ? options.enabled : true,
      createdAt: prevLink?.createdAt || new Date().toISOString(),
      expiresAt: options?.expiresAt !== undefined ? options.expiresAt : (prevLink?.expiresAt || null),
      isOneTime: options?.isOneTime !== undefined ? options.isOneTime : (prevLink?.isOneTime || false),
      maxViews: options?.isOneTime ? 1 : (options?.maxViews !== undefined ? options.maxViews : prevLink?.maxViews),
      viewCount: options?.regenerateToken ? 0 : (prevLink?.viewCount || 0),
      lastViewedAt: options?.regenerateToken ? undefined : prevLink?.lastViewedAt,
      pinRequired: options?.pinRequired !== undefined ? options.pinRequired : (prevLink?.pinRequired || false),
      pinCode: options?.pinCode !== undefined ? (options.pinCode ? options.pinCode.trim() : undefined) : prevLink?.pinCode,
      allowPdfDownload: options?.allowPdfDownload !== undefined ? options.allowPdfDownload : (prevLink?.allowPdfDownload !== false),
    };

    const updatedInvoice: Invoice = {
      ...currentInvoice,
      shareLink,
      updatedAt: getCurrentJalaliDate(),
    };

    invoices[targetIdx] = updatedInvoice;
    this.saveInvoices(invoices);
    this.notifyChange();

    // Call server API for centralized backend sync
    try {
      const res = await fetch(`/api/invoices/${encodeURIComponent(invoiceId)}/share-link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...options,
          token: shareLink.token,
        }),
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.shareLink) {
          updatedInvoice.shareLink = json.shareLink;
          invoices[targetIdx] = updatedInvoice;
          this.saveInvoices(invoices);
        }
      }
    } catch {
      // Offline fallback: already saved locally and queued for server sync
    }

    const settings = this.getSettings();
    const fullUrl = this.buildInvoicePublicUrl(shareLink.token, settings.webInvoiceCustomDomain);

    return {
      success: true,
      invoice: updatedInvoice,
      shareLink: updatedInvoice.shareLink || shareLink,
      fullUrl,
      message: 'پیوند مشاهده آنلاین فاکتور با موفقیت ایجاد و تنظیم گردید.',
    };
  },

  async revokeShareLink(invoiceId: string): Promise<{ success: boolean; message?: string }> {
    const invoices = this.getInvoices();
    const targetIdx = invoices.findIndex((i) => i.id === invoiceId);
    if (targetIdx === -1) {
      return { success: false, message: 'فاکتور مورد نظر یافت نشد.' };
    }

    const currentInvoice = invoices[targetIdx];
    if (currentInvoice.shareLink) {
      currentInvoice.shareLink.enabled = false;
      invoices[targetIdx] = currentInvoice;
      this.saveInvoices(invoices);
      this.notifyChange();
    }

    try {
      await fetch(`/api/invoices/${encodeURIComponent(invoiceId)}/share-link`, {
        method: 'DELETE',
      });
    } catch {}

    return { success: true, message: 'دسترسی به لینک آنلاین با موفقیت لغو و مسدود شد.' };
  },

  async fetchPublicInvoice(
    token: string,
    pin?: string
  ): Promise<{
    success: boolean;
    invoice?: Invoice;
    settings?: StoreSettings;
    shareLink?: InvoiceShareLink;
    pinRequired?: boolean;
    code?: string;
    message?: string;
    storeName?: string;
    storeLogo?: string;
    invoiceNumber?: string;
    customerInvoices?: Invoice[];
    deposits?: PublicCustomerDeposit[];
    remittances?: PublicCustomerRemittance[];
    customerLedger?: PublicCustomerLedger;
  }> {
    try {
      const pinParam = pin ? `?pin=${encodeURIComponent(pin.trim())}` : '';
      const res = await fetch(`/api/public/invoice/${encodeURIComponent(token.trim())}${pinParam}`);
      const data = await res.json();
      return data;
    } catch (err: any) {
      // Local fallback if running completely offline/client-only
      const localInvoices = this.getInvoices();
      const match = localInvoices.find((i) => i?.shareLink?.token === token);
      if (match && match.shareLink && match.shareLink.enabled) {
        if (match.shareLink.pinRequired && match.shareLink.pinCode) {
          if (!pin || pin.trim() !== match.shareLink.pinCode.trim()) {
            return {
              success: false,
              code: 'PIN_REQUIRED',
              pinRequired: true,
              message: 'مشاهده این فاکتور مستلزم ورود رمز عبور است.',
              storeName: this.getSettings().storeName,
              invoiceNumber: match.invoiceNumber,
            };
          }
        }

        const customerId = match.customerId;
        const customerNameNorm = (match.customerName || '').trim().toLowerCase();
        const customerPhoneNorm = (match.customerPhone || '').replace(/[^0-9]/g, '');

        const isMatchCustomer = (cId?: string, cName?: string, cPhone?: string) => {
          if (customerId && cId && cId === customerId) return true;
          if (customerNameNorm && cName && cName.trim().toLowerCase() === customerNameNorm) return true;
          if (customerPhoneNorm && cPhone) {
            const pClean = cPhone.replace(/[^0-9]/g, '');
            if (pClean && pClean === customerPhoneNorm) return true;
          }
          return false;
        };

        const customerInvoices = localInvoices
          .filter((inv) => isMatchCustomer(inv.customerId, inv.customerName, inv.customerPhone))
          .sort((a, b) => (b.date || '').localeCompare(a.date || ''));

        const localTxns = this.getCustomerTransactions();
        const directDeposits: PublicCustomerDeposit[] = localTxns
          .filter((tx) => isMatchCustomer(tx.customerId, tx.customerName))
          .map((tx) => ({
            id: tx.id,
            type: tx.type,
            amount: tx.amount,
            date: tx.date,
            title: tx.title || (tx.type === 'deposit' ? 'واریز وجه به حساب' : 'ثبت بدهی دستی'),
            paymentMethod: tx.paymentMethod,
            trackingNumber: tx.trackingNumber,
            bankName: tx.bankName,
            chequeDueDate: tx.chequeDueDate,
            invoiceNumber: tx.invoiceNumber,
            notes: tx.notes,
          }));

        const invoicePayments: PublicCustomerDeposit[] = localInvoices
          .filter((inv) => isMatchCustomer(inv.customerId, inv.customerName, inv.customerPhone) && Number(inv.paidAmount) > 0)
          .map((inv) => ({
            id: `inv-pay-${inv.id}`,
            type: 'deposit' as const,
            amount: Number(inv.paidAmount) || 0,
            date: inv.date,
            title: `پرداخت وجه فاکتور ${inv.invoiceNumber}`,
            paymentMethod: inv.paymentMethod,
            trackingNumber: inv.chequeNumber,
            bankName: inv.transferDescription ? 'حساب بانکی' : '',
            chequeDueDate: inv.chequeDueDate,
            invoiceNumber: inv.invoiceNumber,
            notes: inv.transferDescription || inv.notes,
          }));

        const allDeposits = [...directDeposits, ...invoicePayments].sort((a, b) => (b.date || '').localeCompare(a.date || ''));

        const exitSlipRemittances: PublicCustomerRemittance[] = localInvoices
          .filter((inv) => isMatchCustomer(inv.customerId, inv.customerName, inv.customerPhone) && inv.exitSlip && (inv.exitSlip.slipNumber || inv.exitSlip.isDelivered || inv.exitSlip.deliveredAt))
          .map((inv) => {
            const es = inv.exitSlip!;
            return {
              id: `es-${inv.id}`,
              remittanceNumber: es.slipNumber || `حواله-${inv.invoiceNumber}`,
              sourceType: 'invoice_exit_slip' as const,
              invoiceNumber: inv.invoiceNumber,
              invoiceId: inv.id,
              date: es.deliveredAt || inv.date,
              receiverName: es.receiverName || inv.customerName,
              receiverPhone: es.receiverPhone || inv.customerPhone,
              vehicleInfo: es.vehicleInfo,
              deliveredBy: es.deliveredBy,
              deliveryNotes: es.deliveryNotes,
              status: es.isDelivered ? ('delivered' as const) : ('dispatched' as const),
              statusTitle: es.isDelivered ? 'تحویل داده شده به مشتری' : 'صادر شده / در حال ارسال',
              items: (inv.items || []).map((it) => ({
                productName: it.productName || it.name || '',
                quantity: it.quantity,
                unit: it.unit || 'عدد',
              })),
            };
          });

        const localTransfers = this.getDirectTransfers();
        const directTransferRemittances: PublicCustomerRemittance[] = localTransfers
          .filter((trf) => isMatchCustomer(undefined, trf.receiverName, trf.receiverPhone))
          .map((trf) => ({
            id: `trf-${trf.id}`,
            remittanceNumber: trf.transferNumber || trf.id,
            sourceType: 'direct_transfer' as const,
            invoiceNumber: '',
            invoiceId: '',
            date: trf.dispatchedAt || trf.createdAt,
            receiverName: trf.receiverName,
            receiverPhone: trf.receiverPhone,
            vehicleInfo: trf.dispatchVehicleInfo,
            deliveredBy: trf.dispatchedBy,
            deliveryNotes: trf.dispatchNotes || trf.title,
            status: trf.status === 'returned' ? ('returned' as const) : ('dispatched' as const),
            statusTitle: trf.status === 'returned' ? 'عودت داده شده' : 'ارسال شده به مشتری/پروژه',
            items: (trf.items || []).map((it) => ({
              productName: it.productName || '',
              quantity: it.quantity,
              unit: it.unit || 'عدد',
            })),
          }));

        const allRemittances = [...exitSlipRemittances, ...directTransferRemittances].sort((a, b) => (b.date || '').localeCompare(a.date || ''));

        const nonProformas = customerInvoices.filter((inv) => !inv.isProforma);
        const totalPurchases = nonProformas.reduce((sum, inv) => sum + (inv.finalTotal || 0), 0);
        const totalPaidOnInvoices = nonProformas.reduce((sum, inv) => sum + (inv.paidAmount || 0), 0);
        const standaloneDepositsSum = directDeposits.filter((t) => t.type === 'deposit').reduce((sum, t) => sum + (t.amount || 0), 0);
        const standaloneDebtsSum = directDeposits.filter((t) => t.type === 'debt').reduce((sum, t) => sum + (t.amount || 0), 0);

        const totalDebit = totalPurchases + standaloneDebtsSum;
        const totalCredit = totalPaidOnInvoices + standaloneDepositsSum;
        const netBalance = totalDebit - totalCredit;

        const customerLedger: PublicCustomerLedger = {
          customerName: match.customerName,
          customerPhone: match.customerPhone,
          customerAddress: match.customerAddress,
          totalInvoicesCount: customerInvoices.length,
          totalPurchases,
          totalPaid: totalCredit,
          balance: netBalance,
          balanceStatus: netBalance > 0 ? 'debtor' : netBalance < 0 ? 'creditor' : 'settled',
        };

        return {
          success: true,
          invoice: match,
          settings: this.getSettings(),
          shareLink: match.shareLink,
          customerInvoices,
          deposits: allDeposits,
          remittances: allRemittances,
          customerLedger,
        };
      }
      return {
        success: false,
        code: 'NETWORK_ERROR',
        message: 'عدم امکان اتصال به سرور جهت دریافت فاکتور.',
      };
    }
  },

  getPurchaseInvoices(): PurchaseInvoice[] {
    const data = localStorage.getItem(STORAGE_KEYS.PURCHASE_INVOICES);
    const tombstones = this.getDeletedTombstones();
    const purchDelSet = new Set(tombstones.purchaseInvoices || []);

    if (!data) {
      const clean = initialPurchaseInvoices.filter((p) => !purchDelSet.has(p.id));
      localStorage.setItem(STORAGE_KEYS.PURCHASE_INVOICES, JSON.stringify(clean));
      return clean;
    }
    try {
      const parsed = JSON.parse(data);
      return Array.isArray(parsed) ? parsed.filter((p: PurchaseInvoice) => !purchDelSet.has(p.id)) : [];
    } catch {
      return initialPurchaseInvoices.filter((p) => !purchDelSet.has(p.id));
    }
  },

  savePurchaseInvoices(purchaseInvoices: PurchaseInvoice[]) {
    const tombstones = this.getDeletedTombstones();
    const purchDelSet = new Set(tombstones.purchaseInvoices || []);
    const clean = purchaseInvoices.filter((p) => !purchDelSet.has(p.id));
    localStorage.setItem(STORAGE_KEYS.PURCHASE_INVOICES, JSON.stringify(clean));
    this.queuePushToServer({ purchaseInvoices: clean });
  },

  savePurchaseInvoice(invoice: PurchaseInvoice) {
    const invoices = this.getPurchaseInvoices();
    const idx = invoices.findIndex((i) => i.id === invoice.id);
    if (idx >= 0) {
      invoices[idx] = invoice;
    } else {
      invoices.unshift(invoice);
    }
    this.savePurchaseInvoices(invoices);
  },

  deletePurchaseInvoice(invoiceId: string) {
    const cleanId = String(invoiceId).trim();
    this.recordTombstone('purchaseInvoices', cleanId);

    const invoices = this.getPurchaseInvoices().filter((i) => i.id !== cleanId);
    this.savePurchaseInvoices(invoices);
    this.notifyChange();
  },

  getInboundReceipts(): InboundReceipt[] {
    const data = localStorage.getItem(STORAGE_KEYS.INBOUND_RECEIPTS);
    const tombstones = this.getDeletedTombstones();
    const inbDelSet = new Set(tombstones.inboundReceipts || []);

    if (!data) {
      const clean = initialInboundReceipts.filter((r) => !inbDelSet.has(r.id));
      localStorage.setItem(STORAGE_KEYS.INBOUND_RECEIPTS, JSON.stringify(clean));
      return clean;
    }
    try {
      const parsed = JSON.parse(data);
      return Array.isArray(parsed) ? parsed.filter((r: InboundReceipt) => !inbDelSet.has(r.id)) : [];
    } catch {
      return initialInboundReceipts.filter((r) => !inbDelSet.has(r.id));
    }
  },

  saveInboundReceipts(inboundReceipts: InboundReceipt[]) {
    const tombstones = this.getDeletedTombstones();
    const inbDelSet = new Set(tombstones.inboundReceipts || []);
    const clean = inboundReceipts.filter((r) => !inbDelSet.has(r.id));
    localStorage.setItem(STORAGE_KEYS.INBOUND_RECEIPTS, JSON.stringify(clean));
    this.queuePushToServer({ inboundReceipts: clean });
  },

  saveInboundReceipt(receipt: InboundReceipt) {
    const receipts = this.getInboundReceipts();
    const idx = receipts.findIndex((r) => r.id === receipt.id);
    if (idx >= 0) {
      receipts[idx] = receipt;
    } else {
      receipts.unshift(receipt);
    }
    this.saveInboundReceipts(receipts);
  },

  deleteInboundReceipt(receiptId: string) {
    const cleanId = String(receiptId).trim();
    this.recordTombstone('inboundReceipts', cleanId);

    const receipts = this.getInboundReceipts().filter((r) => r.id !== cleanId);
    this.saveInboundReceipts(receipts);
    this.notifyChange();
  },

  saveProduct(product: Product) {
    const products = this.getProducts();
    const otherProducts = products.filter((p) => p.id !== product.id);
    let toSave: Product = { ...product };

    // تعیین خودکار کد کالا در صورت خالی بودن
    if (!toSave.code || !toSave.code.trim()) {
      toSave.code = generateNextProductCode(otherProducts);
    }

    // تعیین خودکار بارکد کالا در صورت خالی بودن
    if (!toSave.barcode || !toSave.barcode.trim()) {
      toSave.barcode = generateProductBarcode(toSave.code, otherProducts);
    }

    // تعیین خودکار کد و بارکد برای تنوع‌ها در صورت وجود
    if (toSave.hasVariants && toSave.variants && toSave.variants.length > 0) {
      toSave.variants = toSave.variants.map((v, vIdx) => {
        const vCode = v.code && v.code.trim() ? v.code.trim() : generateVariantCode(toSave.code, vIdx + 1, v.name);
        const vBarcode = v.barcode && v.barcode.trim() ? v.barcode.trim() : generateVariantBarcode(toSave.code, vIdx + 1, otherProducts);
        return {
          ...v,
          code: vCode,
          barcode: vBarcode,
        };
      });
    }

    const idx = products.findIndex((p) => p.id === toSave.id);
    if (idx >= 0) {
      products[idx] = toSave;
    } else {
      products.push(toSave);
    }
    this.saveProducts(products);
  },

  adjustStock(
    productId: string,
    type: StockMovementType,
    quantity: number,
    note?: string,
    referenceInvoice?: string
  ) {
    const products = this.getProducts();
    const prod = products.find((p) => p.id === productId);
    if (!prod) return;

    const isAdding = type === 'purchase' || type === 'return' || (type === 'adjustment' && quantity > 0);
    const absQuantity = Math.abs(quantity);
    const newStock = isAdding ? prod.stock + absQuantity : Math.max(0, prod.stock - absQuantity);
    prod.stock = newStock;
    prod.updatedAt = getCurrentJalaliDate();
    this.saveProducts(products);

    const movements = this.getMovements();
    const newMovement: StockMovement = {
      id: `mov-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      productId: prod.id,
      productName: prod.name,
      type,
      quantity: isAdding ? absQuantity : -absQuantity,
      remainingStock: newStock,
      date: getCurrentJalaliDate(),
      note: note || (isAdding ? 'ورود به انبار' : 'خروج از انبار'),
      invoiceId: referenceInvoice,
    };
    this.saveMovements([newMovement, ...movements]);
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
    this.queuePushToServer({ movements });
  },

  getSettings(): StoreSettings {
    const data = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    if (!data) {
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(initialSettings));
      return initialSettings;
    }
    try {
      const parsed = JSON.parse(data);
      const merged = { ...initialSettings, ...parsed };
      if (!Array.isArray(merged.warehouses) || merged.warehouses.length === 0) {
        merged.warehouses = initialSettings.warehouses;
        merged.defaultWarehouseId = initialSettings.defaultWarehouseId || 'wh-1';
      }
      if (!merged.originWarehouseName) {
        merged.originWarehouseName = initialSettings.originWarehouseName || 'انبار مرکزی سپهر';
      }
      if (!merged.originWarehouseCode) {
        merged.originWarehouseCode = initialSettings.originWarehouseCode || 'WH-01';
      }
      if (!merged.originWarehouseAddress) {
        merged.originWarehouseAddress = initialSettings.originWarehouseAddress || 'تهران، جاده مخصوص، کیلومتر ۱۲، خیابان بهار، سوله شماره ۴';
      }
      if (!merged.originWarehousePhone) {
        merged.originWarehousePhone = initialSettings.originWarehousePhone || '۰۲۱-۵۵۴۴۳۳۲۲';
      }
      if (!merged.originWarehouseManager) {
        merged.originWarehouseManager = initialSettings.originWarehouseManager || 'مرتضی اکبری (انباردار مرکزی)';
      }
      if (!merged.pdfInvoiceQuality) {
        merged.pdfInvoiceQuality = 'standard';
      }
      if (!merged.pdfExitSlipQuality) {
        merged.pdfExitSlipQuality = 'high';
      }
      if (merged.enableSimpleExitSlipTemplate === undefined) {
        merged.enableSimpleExitSlipTemplate = true;
      }
      if (!merged.defaultExitSlipTemplate) {
        merged.defaultExitSlipTemplate = 'standard';
      }
      return merged;
    } catch {
      return initialSettings;
    }
  },

  saveSettings(settings: StoreSettings) {
    this._lastLocalSettingsSaveTime = Date.now();
    const existing = this.getSettings();
    const merged: StoreSettings = {
      ...existing,
      ...settings,
    };
    if (merged.pdfSyncQuality && merged.pdfInvoiceQuality) {
      merged.pdfExitSlipQuality = merged.pdfInvoiceQuality;
    }
    if (Array.isArray(settings.warehouses)) {
      merged.warehouses = settings.warehouses;
    }
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(merged));
    this.notifyChange();
    this.pushToServer({ settings: merged });
  },

  getUsers(): AppUser[] {
    const data = localStorage.getItem(STORAGE_KEYS.USERS);
    const tombstones = this.getDeletedTombstones();
    const userDelSet = new Set(tombstones.users || []);

    if (!data) {
      const clean = initialUsers.filter((u) => !userDelSet.has(u.id));
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(clean));
      return clean;
    }
    try {
      const users: AppUser[] = JSON.parse(data);
      if (!Array.isArray(users) || users.length === 0) {
        const clean = initialUsers.filter((u) => !userDelSet.has(u.id));
        localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(clean));
        return clean;
      }
      // Ensure all users have valid unique IDs and exclude deleted users
      const seenIds = new Set<string>();
      let needsSave = false;
      const sanitized: AppUser[] = users
        .filter((u) => !userDelSet.has(u.id))
        .map((u, idx): AppUser => {
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
      if (needsSave) {
        this.saveUsers(sanitized);
      }
      return sanitized;
    } catch {
      return initialUsers.filter((u) => !userDelSet.has(u.id));
    }
  },

  saveUsers(users: AppUser[]) {
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
    this.pushToServer({ users });
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

    const cleanId = String(userId).trim();
    this.recordTombstone('users', cleanId);

    const filtered = users.filter((u) => u.id !== cleanId);
    this.saveUsers(filtered);

    // If current active user was deleted, reset to another user
    const currentActiveId = localStorage.getItem(STORAGE_KEYS.CURRENT_USER_ID);
    if (currentActiveId === cleanId) {
      const nextUser = filtered.find((u) => u.isActive) || filtered[0];
      if (nextUser) {
        localStorage.setItem(STORAGE_KEYS.CURRENT_USER_ID, nextUser.id);
      }
    }
    this.notifyChange();
    return { success: true };
  },

  // EXIT SLIP (حواله خروج از انبار) METHODS
  // توجه بسیار مهم: پیش‌فاکتورها به هیچ عنوان حواله خروج انبار ندارند!
  getExitSlipLogs(): Record<string, ExitSlipData> {
    const data = localStorage.getItem(STORAGE_KEYS.EXIT_SLIP_LOGS);
    if (!data) return {};
    try {
      const parsed = JSON.parse(data);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return {};
      }
      // پاکسازی خودکار: پیش‌فاکتورها نباید در لیست یا لاگ حواله خروج باشند
      const invoices = this.getInvoices();
      const proformaIds = new Set(invoices.filter((i) => i.isProforma).map((i) => i.id));
      if (proformaIds.size > 0) {
        let hasProforma = false;
        const cleaned: Record<string, ExitSlipData> = {};
        for (const [key, val] of Object.entries(parsed)) {
          if (proformaIds.has(key)) {
            hasProforma = true;
          } else {
            cleaned[key] = val as ExitSlipData;
          }
        }
        if (hasProforma) {
          localStorage.setItem(STORAGE_KEYS.EXIT_SLIP_LOGS, JSON.stringify(cleaned));
        }
        return cleaned;
      }
      return parsed;
    } catch {
      return {};
    }
  },

  saveExitSlipLogs(logs: Record<string, ExitSlipData>) {
    const safeLogs = (logs && typeof logs === 'object' && !Array.isArray(logs)) ? logs : {};
    localStorage.setItem(STORAGE_KEYS.EXIT_SLIP_LOGS, JSON.stringify(safeLogs));
    this.pushToServer({ exitSlipLogs: safeLogs });
    this.notifyChange();
  },

  // ----------------------------------------------------
  // شماره‌گذاری ترتیبی و منظم اسناد و حواله‌ها (بدون رندوم)
  // ----------------------------------------------------

  getNextInvoiceNumber(isProforma = false): string {
    const invoices = this.getInvoices();
    return generateNextInvoiceNumber(invoices, isProforma);
  },

  getNextExitSlipNumber(): string {
    const logs = this.getExitSlipLogs();
    const invoices = this.getInvoices().filter((i) => !i.isProforma);
    return generateNextExitSlipNumber(logs, invoices);
  },

  getOrAssignExitSlipNumber(invoiceId: string, invoiceNumber?: string): string {
    const invoices = this.getInvoices();
    const targetInv = invoices.find((i) => i.id === invoiceId);
    // برای پیش‌فاکتورها به هیچ عنوان حواله خروج تخصیص نمی‌یابد
    if (targetInv?.isProforma) {
      return '';
    }

    const logs = this.getExitSlipLogs();
    const current = logs[invoiceId];
    if (current?.slipNumber) {
      return current.slipNumber;
    }
    const nextSlipNum = this.getNextExitSlipNumber();
    const updated: ExitSlipData = {
      ...(current || {
        invoiceId,
        printCount: 0,
        history: [],
      }),
      invoiceId,
      slipNumber: nextSlipNum,
    };
    logs[invoiceId] = updated;
    this.saveExitSlipLogs(logs);
    return nextSlipNum;
  },

  deleteExitSlipLog(invoiceId: string) {
    const logs = this.getExitSlipLogs();
    if (logs[invoiceId]) {
      delete logs[invoiceId];
      this.saveExitSlipLogs(logs);
    }
  },

  getNextInboundReceiptNumber(): string {
    const receipts = this.getInboundReceipts();
    return generateNextInboundReceiptNumber(receipts);
  },

  getNextPurchaseInvoiceNumber(): string {
    const purchases = this.getPurchaseInvoices();
    return generateNextPurchaseInvoiceNumber(purchases);
  },

  getNextTransferNumber(): string {
    const transfers = this.getDirectTransfers();
    return generateNextTransferNumber(transfers);
  },

  getExitSlipLog(invoiceId: string): ExitSlipData {
    const invoices = this.getInvoices();
    const targetInv = invoices.find((i) => i.id === invoiceId);
    if (targetInv?.isProforma) {
      return {
        invoiceId,
        printCount: 0,
        history: [],
      };
    }
    const logs = this.getExitSlipLogs();
    return logs[invoiceId] || {
      invoiceId,
      printCount: 0,
      history: [],
    };
  },

  recordExitSlipPrint(
    invoiceId: string, 
    printedBy: string, 
    printedAt?: string,
    fallbackData?: Partial<ExitSlipData>
  ): ExitSlipData {
    const invoices = this.getInvoices();
    const targetInv = invoices.find((i) => i.id === invoiceId);
    if (targetInv?.isProforma) {
      return (fallbackData as ExitSlipData) || { invoiceId, printCount: 0, history: [] };
    }

    const logs = this.getExitSlipLogs();
    const current = logs[invoiceId] || fallbackData || {
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
      ...fallbackData,
      ...current,
      invoiceId,
      slipNumber: current.slipNumber || fallbackData?.slipNumber || this.getNextExitSlipNumber(),
      printCount: (current.printCount || fallbackData?.printCount || 0) + 1,
      lastPrintedAt: timestamp,
      lastPrintedBy: printedBy || 'انباردار',
      history: [newRecord, ...(current.history || fallbackData?.history || [])],
    };

    // Explicitly guarantee delivery details are never wiped
    if (fallbackData?.receiverName && !updated.receiverName) updated.receiverName = fallbackData.receiverName;
    if (fallbackData?.receiverPhone && !updated.receiverPhone) updated.receiverPhone = fallbackData.receiverPhone;
    if (fallbackData?.vehicleInfo && !updated.vehicleInfo) updated.vehicleInfo = fallbackData.vehicleInfo;
    if (fallbackData?.deliveryNotes && !updated.deliveryNotes) updated.deliveryNotes = fallbackData.deliveryNotes;
    if (fallbackData?.isDelivered !== undefined && updated.isDelivered === undefined) updated.isDelivered = fallbackData.isDelivered;
    if (fallbackData?.deliveredAt && !updated.deliveredAt) updated.deliveredAt = fallbackData.deliveredAt;
    if (fallbackData?.deliveredBy && !updated.deliveredBy) updated.deliveredBy = fallbackData.deliveredBy;

    logs[invoiceId] = updated;
    this.saveExitSlipLogs(logs);
    return updated;
  },

  updateExitSlipDelivery(
    invoiceId: string,
    deliveryData: {
      isDelivered: boolean;
      deliveredAt?: string;
      deliveredBy?: string;
      receiverName?: string;
      receiverPhone?: string;
      vehicleInfo?: string;
      deliveryNotes?: string;
      slipNumber?: string;
    }
  ): ExitSlipData {
    const invoices = this.getInvoices();
    const targetInv = invoices.find((i) => i.id === invoiceId);
    if (targetInv?.isProforma) {
      return { invoiceId, printCount: 0, history: [] };
    }

    const logs = this.getExitSlipLogs();
    const current = logs[invoiceId] || {
      invoiceId,
      printCount: 0,
      history: [],
    };
    const updated: ExitSlipData = {
      ...current,
      ...deliveryData,
      slipNumber: deliveryData.slipNumber || current.slipNumber || this.getNextExitSlipNumber(),
    };
    logs[invoiceId] = updated;
    this.saveExitSlipLogs(logs);

    if (targetInv) {
      targetInv.exitSlip = updated;
      this.saveInvoices(invoices);
    }

    return updated;
  },

  // ----------------------------------------------------
  // مدیریت ماشین‌های ثبت‌شده و ناوگان تحویل گیرنده کالا
  // ----------------------------------------------------
  getSavedVehicles(): SavedVehicle[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.SAVED_VEHICLES);
      const tombstones = this.getDeletedTombstones();
      const vehDelSet = new Set(tombstones.savedVehicles || []);

      if (!raw) {
        const clean = initialSavedVehicles.filter((v) => !vehDelSet.has(v.id));
        localStorage.setItem(STORAGE_KEYS.SAVED_VEHICLES, JSON.stringify(clean));
        return clean;
      }
      const parsed = JSON.parse(raw);
      const list = Array.isArray(parsed) ? parsed : initialSavedVehicles;
      return list.filter((v: SavedVehicle) => !vehDelSet.has(v.id));
    } catch {
      return initialSavedVehicles;
    }
  },

  saveSavedVehicles(vehicles: SavedVehicle[]): void {
    try {
      const safe = Array.isArray(vehicles) ? vehicles : [];
      localStorage.setItem(STORAGE_KEYS.SAVED_VEHICLES, JSON.stringify(safe));
      this.notifyChange();
      this.pushToServer({ savedVehicles: safe });
    } catch (e) {
      console.error('Failed to save vehicles:', e);
    }
  },

  addOrUpdateSavedVehicle(data: {
    id?: string;
    vehicleType?: string;
    vehicleInfo: string;
    driverName?: string;
    driverPhone?: string;
    plateNumber?: string;
    colorDesc?: string;
    notes?: string;
  }): SavedVehicle {
    const list = this.getSavedVehicles();
    const cleanInfo = String(data?.vehicleInfo || '').trim();
    const cleanDriver = String(data?.driverName || '').trim();
    const cleanPhone = String(data?.driverPhone || '').trim();

    // جستجوی خودروی مشابه بر اساس آی‌دی یا متن مشخصات ماشین
    const existingIdx = data?.id
      ? list.findIndex((v) => v.id === data.id)
      : list.findIndex((v) => String(v?.vehicleInfo || '').trim() === cleanInfo && (!cleanDriver || String(v?.driverName || '') === cleanDriver));

    let savedVehicle: SavedVehicle;

    if (existingIdx !== -1) {
      savedVehicle = {
        ...list[existingIdx],
        vehicleType: data?.vehicleType || list[existingIdx].vehicleType || 'وانت باربری',
        vehicleInfo: cleanInfo || list[existingIdx].vehicleInfo || '',
        driverName: cleanDriver || list[existingIdx].driverName || '',
        driverPhone: cleanPhone || list[existingIdx].driverPhone || '',
        plateNumber: data?.plateNumber?.trim() || list[existingIdx].plateNumber || '',
        colorDesc: data?.colorDesc?.trim() || list[existingIdx].colorDesc || '',
        notes: data?.notes?.trim() || list[existingIdx].notes || '',
      };
      list[existingIdx] = savedVehicle;
    } else {
      savedVehicle = {
        id: data?.id || `veh-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        vehicleType: data?.vehicleType || 'وانت باربری',
        vehicleInfo: cleanInfo,
        driverName: cleanDriver,
        driverPhone: cleanPhone,
        plateNumber: data?.plateNumber?.trim() || '',
        colorDesc: data?.colorDesc?.trim() || '',
        notes: data?.notes?.trim() || '',
        createdAt: getCurrentJalaliDate(),
      };
      list.unshift(savedVehicle);
    }

    this.saveSavedVehicles(list);
    return savedVehicle;
  },

  deleteSavedVehicle(id: string, vehicleInfo?: string): void {
    const cleanId = String(id || '').trim();
    if (cleanId) {
      this.recordTombstone('savedVehicles', cleanId);
    }

    const targetInfo = String(vehicleInfo || '').trim().toLowerCase();
    if (targetInfo) {
      this.recordTombstone('savedVehicles', `info::${targetInfo}`);
    }

    const list = this.getSavedVehicles();
    const updated = list.filter((v) => {
      if (!v) return false;
      if (cleanId && v.id === cleanId) return false;
      const vInfo = String(v.vehicleInfo || '').trim().toLowerCase();
      if (targetInfo && vInfo === targetInfo) return false;
      return true;
    });

    this.saveSavedVehicles(updated);
    this.notifyChange();
  },

  clearAllSavedVehicles(): void {
    const current = this.getExitSlipVehicles();
    current.forEach((v) => {
      if (v?.id) {
        this.recordTombstone('savedVehicles', v.id);
      }
      if (v?.vehicleInfo) {
        this.recordTombstone('savedVehicles', `info::${String(v.vehicleInfo).trim().toLowerCase()}`);
      }
    });
    this.saveSavedVehicles([]);
    this.notifyChange();
  },

  getTombstones(): AppTombstones {
    return this.getDeletedTombstones();
  },

  // دریافت تمام خودروهای ثبت‌شده در حواله‌های خروج (هم ناوگان ذخیره‌شده و هم سوابق تحویل فاکتورها، به استثنای موارد حذف‌شده)
  getExitSlipVehicles(): Array<SavedVehicle & { sourceLabel?: string }> {
    try {
      const tombstones = this.getDeletedTombstones();
      const vehDelSet = new Set(tombstones?.savedVehicles || []);

      const fleet = (this.getSavedVehicles() || []).filter((v) => {
        if (!v || !v.id) return false;
        if (vehDelSet.has(v.id)) return false;
        const vInfo = String(v.vehicleInfo || '').trim().toLowerCase();
        if (!vInfo) return true;
        const infoKey = `info::${vInfo}`;
        if (vehDelSet.has(infoKey) || vehDelSet.has(vInfo)) return false;
        return true;
      });

      const result: Array<SavedVehicle & { sourceLabel?: string }> = fleet.map((v) => ({
        ...v,
        vehicleInfo: String(v.vehicleInfo || ''),
        sourceLabel: 'ناوگان ثبت‌شده',
      }));

      // همچنین بررسی تمام حواله‌های خروج ثبت‌شده در فاکتورهای فروش
      const invoices = this.getInvoices() || [];
      const seenInfo = new Set(fleet.map((v) => String(v.vehicleInfo || '').trim().toLowerCase()));

      invoices.forEach((inv) => {
        const exitSlip = inv.exitSlip;
        if (exitSlip && exitSlip.vehicleInfo && String(exitSlip.vehicleInfo).trim()) {
          const key = String(exitSlip.vehicleInfo).trim().toLowerCase();
          const customId = `inv-veh-${inv.id}`;
          const infoKey = `info::${key}`;

          // اگر توسط کاربر حذف شده باشد، نمایش داده نشود
          if (vehDelSet.has(customId) || vehDelSet.has(infoKey) || vehDelSet.has(key)) {
            return;
          }

          if (!seenInfo.has(key)) {
            seenInfo.add(key);
            result.push({
              id: customId,
              vehicleType: 'وانت / خودرو تحویل',
              vehicleInfo: String(exitSlip.vehicleInfo).trim(),
              driverName: exitSlip.receiverName || inv.customerName || '',
              driverPhone: exitSlip.receiverPhone || inv.customerPhone || '',
              createdAt: exitSlip.deliveredAt || inv.date,
              sourceLabel: `حواله خروج فاکتور ${inv.invoiceNumber}`,
            });
          }
        }
      });

      return result;
    } catch (err) {
      console.error('Error in getExitSlipVehicles:', err);
      return [];
    }
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

  // ACTIVITY LOGS (ثبت وقایع و ردگیری فعالیت کاربران)
  getActivityLogs(): ActivityLog[] {
    const data = localStorage.getItem(STORAGE_KEYS.ACTIVITY_LOGS);
    if (!data) {
      localStorage.setItem(STORAGE_KEYS.ACTIVITY_LOGS, JSON.stringify(initialActivityLogs));
      return initialActivityLogs;
    }
    try {
      return JSON.parse(data);
    } catch {
      return initialActivityLogs;
    }
  },

  saveActivityLogs(logs: ActivityLog[]) {
    localStorage.setItem(STORAGE_KEYS.ACTIVITY_LOGS, JSON.stringify(logs));
    this.pushToServer({ activityLogs: logs });
  },

  logActivity(params: {
    userId?: string;
    userName?: string;
    userRole?: string;
    userRoleTitle?: string;
    category: ActivityActionCategory;
    actionType: string;
    actionTitle: string;
    details: string;
    deviceInfo?: string;
  }): ActivityLog {
    try {
      const activeUser = this.getActiveUser();
      const userId = params.userId || activeUser?.id || 'sys';
      const userName = params.userName || activeUser?.fullName || 'کاربر سیستم';
      const userRole = params.userRole || activeUser?.role || 'admin';
      const userRoleTitle = params.userRoleTitle || activeUser?.roleTitle || ROLE_LABELS[activeUser?.role as UserRole] || 'مدیر';

      const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
      const defaultDevice = isMobile ? 'مرورگر همراه (موبایل)' : 'مرورگر وب (رایانه)';

      const newLog: ActivityLog = {
        id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        userId,
        userName,
        userRole,
        userRoleTitle,
        category: params.category,
        actionType: params.actionType,
        actionTitle: params.actionTitle,
        details: params.details,
        timestamp: `${getCurrentJalaliDate()} - ${getCurrentJalaliTime()}`,
        dateOnly: getCurrentJalaliDate(),
        deviceInfo: params.deviceInfo || defaultDevice,
      };

      const currentLogs = this.getActivityLogs();
      const updatedLogs = [newLog, ...currentLogs].slice(0, 1000);
      this.saveActivityLogs(updatedLogs);
      this.notifyChange();
      return newLog;
    } catch (err) {
      console.error('Failed to record activity log:', err);
      return {
        id: `log-${Date.now()}`,
        userId: 'err',
        userName: 'سیستم',
        userRole: 'admin',
        category: params.category,
        actionType: params.actionType,
        actionTitle: params.actionTitle,
        details: params.details,
        timestamp: `${getCurrentJalaliDate()} - ${getCurrentJalaliTime()}`,
        dateOnly: getCurrentJalaliDate(),
      };
    }
  },

  clearActivityLogs() {
    localStorage.setItem(STORAGE_KEYS.ACTIVITY_LOGS, JSON.stringify([]));
    this.pushToServer({ activityLogs: [] });
    this.notifyChange();
  },

  // -------------------------------------------------------------
  // خروج و ورود مستقیم انبار بدون فاکتور (امانی، تعمیرات، مصرف کارگاه)
  // -------------------------------------------------------------
  getDirectTransfers(): DirectTransfer[] {
    const data = localStorage.getItem(STORAGE_KEYS.DIRECT_TRANSFERS);
    const tombstones = this.getDeletedTombstones();
    const transDelSet = new Set(tombstones.directTransfers || []);

    if (!data) {
      const clean = initialDirectTransfers.filter((t) => !transDelSet.has(t.id));
      localStorage.setItem(STORAGE_KEYS.DIRECT_TRANSFERS, JSON.stringify(clean));
      return clean;
    }
    try {
      const parsed = JSON.parse(data);
      const list = Array.isArray(parsed) ? parsed : initialDirectTransfers;
      return list.filter((t: DirectTransfer) => !transDelSet.has(t.id));
    } catch {
      return initialDirectTransfers.filter((t) => !transDelSet.has(t.id));
    }
  },

  saveDirectTransfers(transfers: DirectTransfer[]) {
    localStorage.setItem(STORAGE_KEYS.DIRECT_TRANSFERS, JSON.stringify(transfers));
    this.pushToServer({ directTransfers: transfers });
    this.notifyChange();
  },

  /**
   * ثبت خروج مستقیم از انبار بدون فاکتور (امانی/تعمیرات/مصرف)
   * موجودی کالاها کسر شده و رکوردهای کاردکس ثبت می‌شوند
   */
  createDirectTransferDispatch(transferData: Omit<DirectTransfer, 'id' | 'createdAt'>): DirectTransfer {
    const id = `trf-${Date.now()}`;
    const newTransfer: DirectTransfer = {
      ...transferData,
      id,
      createdAt: getCurrentJalaliDate(),
    };

    // 1. کسر موجودی کالاها و تنوع‌ها
    const currentProducts = this.getProducts();
    const currentMovements = this.getMovements();
    const updatedProducts = [...currentProducts];
    const newMovements: StockMovement[] = [];

    const typeLabel = 
      newTransfer.type === 'repair' ? 'تعمیرات و سرویس' :
      newTransfer.type === 'temporary_loan' ? 'امانی و تست' :
      newTransfer.type === 'internal_use' ? 'مصرف داخلی' : 'خروج مستقیم';

    for (const item of newTransfer.items) {
      const pIdx = updatedProducts.findIndex((p) => p.id === item.productId);
      if (pIdx !== -1) {
        const prod = { ...updatedProducts[pIdx] };
        
        // اگر تنوع انتخاب شده بود
        if (item.variantId && prod.hasVariants && Array.isArray(prod.variants)) {
          prod.variants = prod.variants.map((v) => {
            if (v.id === item.variantId) {
              return { ...v, stock: Math.max(0, v.stock - item.quantity) };
            }
            return v;
          });
          prod.stock = prod.variants.reduce((sum, v) => sum + (v.stock || 0), 0);
        } else {
          prod.stock = Math.max(0, prod.stock - item.quantity);
        }

        updatedProducts[pIdx] = prod;

        // ثبت کاردکس خروج مستقیم
        const vehicleTxt = newTransfer.dispatchVehicleInfo ? ` (خودرو: ${newTransfer.dispatchVehicleInfo})` : '';
        const receiverTxt = newTransfer.receiverName ? ` به ${newTransfer.receiverName}` : '';
        const serialTxt = item.serialNumber ? ` [سریال: ${item.serialNumber}]` : '';

        newMovements.push({
          id: `mov-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          productId: prod.id,
          productName: prod.name,
          variantId: item.variantId,
          variantName: item.variantName,
          type: 'direct_out',
          quantity: -item.quantity,
          remainingStock: prod.stock,
          invoiceNumber: newTransfer.transferNumber,
          date: getCurrentJalaliDate(),
          note: `خروج بدون فاکتور (${typeLabel} - برگه ${newTransfer.transferNumber})${receiverTxt}${vehicleTxt}${serialTxt}`,
        });
      }
    }

    // 2. ذخیره محصولات، کاردکس و لیست حواله‌ها
    this.saveProducts(updatedProducts);
    if (newMovements.length > 0) {
      this.saveMovements([...newMovements, ...currentMovements]);
    }

    const currentTransfers = this.getDirectTransfers();
    const updatedTransfers = [newTransfer, ...currentTransfers];
    this.saveDirectTransfers(updatedTransfers);

    // 3. ثبت در لاگ فعالیت سیستم
    this.logActivity({
      category: 'warehouse',
      actionType: 'direct_transfer_dispatch',
      actionTitle: `ثبت خروج مستقیم انبار: ${newTransfer.transferNumber}`,
      details: `${typeLabel} - تحویل به: ${newTransfer.receiverName} | خودرو: ${newTransfer.dispatchVehicleInfo || 'نامشخص'} | اقلام: ${newTransfer.items.map((i) => `${i.productName} (${i.quantity} ${i.unit})`).join('، ')}`,
    });

    return newTransfer;
  },

  /**
   * ثبت ورود و بازگشت دستگاه به انبار (پایان تعمیرات یا امانی)
   * اقلام بازگشتی به موجودی انبار برگردانده شده و در کاردکس ثبت می‌شوند
   */
  recordDirectTransferReturn(
    transferId: string, 
    returnData: Omit<DirectTransferReturnRecord, 'id'>
  ): { success: boolean; message?: string; transfer?: DirectTransfer } {
    const transfers = this.getDirectTransfers();
    const tIdx = transfers.findIndex((t) => t.id === transferId);
    if (tIdx === -1) {
      return { success: false, message: 'حواله خروج مورد نظر یافت نشد.' };
    }

    const targetTransfer = { ...transfers[tIdx] };
    const returnRecordId = `ret-${Date.now()}`;
    const returnRecord: DirectTransferReturnRecord = {
      ...returnData,
      id: returnRecordId,
    };

    // 1. برگرداندن موجودی کالاها به انبار
    const currentProducts = this.getProducts();
    const currentMovements = this.getMovements();
    const updatedProducts = [...currentProducts];
    const newMovements: StockMovement[] = [];

    // به‌روزرسانی تعداد بازگشته در اقلام حواله
    const updatedItems = targetTransfer.items.map((item) => {
      const returnedItem = returnData.itemsReturned.find((r) => r.itemId === item.id || r.productId === item.productId);
      if (returnedItem && returnedItem.quantity > 0) {
        const newReturnedQty = (item.returnedQuantity || 0) + returnedItem.quantity;

        // افزایش موجودی کالای مربوطه
        const pIdx = updatedProducts.findIndex((p) => p.id === item.productId);
        if (pIdx !== -1) {
          const prod = { ...updatedProducts[pIdx] };
          if (item.variantId && prod.hasVariants && Array.isArray(prod.variants)) {
            prod.variants = prod.variants.map((v) => {
              if (v.id === item.variantId) {
                return { ...v, stock: v.stock + returnedItem.quantity };
              }
              return v;
            });
            prod.stock = prod.variants.reduce((sum, v) => sum + (v.stock || 0), 0);
          } else {
            prod.stock = prod.stock + returnedItem.quantity;
          }
          updatedProducts[pIdx] = prod;

          // ثبت کاردکس ورود/بازگشت
          const vehicleTxt = returnData.returnVehicleInfo ? ` (با خودرو: ${returnData.returnVehicleInfo})` : '';
          const returnerTxt = returnData.returnerName ? ` توسط ${returnData.returnerName}` : '';
          const healthTxt = returnData.healthStatus === 'repaired' ? ' [تعمیر شده و سالم]' :
                            returnData.healthStatus === 'healthy' ? ' [سالم و بدون عیب]' :
                            returnData.healthStatus === 'damaged' ? ' [دارای عیب یا نقص]' : '';

          newMovements.push({
            id: `mov-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            productId: prod.id,
            productName: prod.name,
            variantId: item.variantId,
            variantName: item.variantName,
            type: 'direct_in',
            quantity: returnedItem.quantity,
            remainingStock: prod.stock,
            invoiceNumber: targetTransfer.transferNumber,
            date: getCurrentJalaliDate(),
            note: `ورود/بازگشت به انبار (برگه ${targetTransfer.transferNumber})${returnerTxt}${vehicleTxt}${healthTxt}`,
          });
        }

        return { ...item, returnedQuantity: newReturnedQty };
      }
      return item;
    });

    targetTransfer.items = updatedItems;

    // 2. تعیین وضعیت جدید حواله (کاملاً بازگشته یا بخشی بازگشته)
    const allReturned = updatedItems.every((i) => (i.returnedQuantity || 0) >= i.quantity);
    const anyReturned = updatedItems.some((i) => (i.returnedQuantity || 0) > 0);

    if (allReturned) {
      targetTransfer.status = 'returned';
    } else if (anyReturned) {
      targetTransfer.status = 'partially_returned';
    }

    targetTransfer.returnRecords = [...(targetTransfer.returnRecords || []), returnRecord];
    targetTransfer.updatedAt = getCurrentJalaliDate();

    // 3. ذخیره‌سازی
    this.saveProducts(updatedProducts);
    if (newMovements.length > 0) {
      this.saveMovements([...newMovements, ...currentMovements]);
    }
    transfers[tIdx] = targetTransfer;
    this.saveDirectTransfers(transfers);

    // 4. ثبت در لاگ فعالیت
    this.logActivity({
      category: 'warehouse',
      actionType: 'direct_transfer_return',
      actionTitle: `ثبت ورود/بازگشت به انبار: ${targetTransfer.transferNumber}`,
      details: `آورنده: ${returnData.returnerName} | خودرو: ${returnData.returnVehicleInfo || 'نامشخص'} | تحویل‌گیرنده در انبار: ${returnData.receivedByWarehouseUser} | وضعیت: ${targetTransfer.status === 'returned' ? 'تکمیل کامل برگشت' : 'بخشی از اقلام برگشت داده شد'}`,
    });

    return { success: true, transfer: targetTransfer };
  },

  deleteDirectTransfer(transferId: string, returnStockToWarehouse = false): { success: boolean; message?: string } {
    const transfers = this.getDirectTransfers();
    const target = transfers.find((t) => t.id === transferId);
    if (!target) {
      return { success: false, message: 'حواله مورد نظر یافت نشد.' };
    }

    // اگر حواله در وضعیت خارج شده بود و کاربر خواسته موجودی برگردد:
    if (returnStockToWarehouse && target.status === 'dispatched') {
      const currentProducts = this.getProducts();
      const updatedProducts = [...currentProducts];
      for (const item of target.items) {
        const remainingToRevert = item.quantity - (item.returnedQuantity || 0);
        if (remainingToRevert > 0) {
          const pIdx = updatedProducts.findIndex((p) => p.id === item.productId);
          if (pIdx !== -1) {
            const p = { ...updatedProducts[pIdx] };
            p.stock += remainingToRevert;
            updatedProducts[pIdx] = p;
          }
        }
      }
      this.saveProducts(updatedProducts);
    }

    const cleanId = String(transferId).trim();
    this.recordTombstone('directTransfers', cleanId);

    const filtered = transfers.filter((t) => t.id !== cleanId);
    this.saveDirectTransfers(filtered);

    this.logActivity({
      category: 'warehouse',
      actionType: 'delete_direct_transfer',
      actionTitle: `حذف حواله خروج مستقیم ${target.transferNumber}`,
      details: `حواله ${target.title} از سیستم حذف شد. ${returnStockToWarehouse ? 'موجودی کالاهای باقیمانده به انبار برگشت داده شد.' : ''}`,
    });

    this.notifyChange();
    return { success: true };
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
      version: '1.2',
      exportDate: getCurrentJalaliDate(),
      timestamp: new Date().toISOString(),
      products: this.getProducts(),
      customers: this.getCustomers(),
      invoices: this.getInvoices(),
      purchaseInvoices: this.getPurchaseInvoices(),
      inboundReceipts: this.getInboundReceipts(),
      movements: this.getMovements(),
      settings: this.getSettings(),
      users: this.getUsers(),
      activityLogs: this.getActivityLogs(),
      directTransfers: this.getDirectTransfers(),
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
      if (parsed.purchaseInvoices && Array.isArray(parsed.purchaseInvoices)) {
        this.savePurchaseInvoices(parsed.purchaseInvoices);
      }
      if (parsed.inboundReceipts && Array.isArray(parsed.inboundReceipts)) {
        this.saveInboundReceipts(parsed.inboundReceipts);
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
      if (parsed.activityLogs && Array.isArray(parsed.activityLogs)) {
        this.saveActivityLogs(parsed.activityLogs);
      }
      if (parsed.directTransfers && Array.isArray(parsed.directTransfers)) {
        this.saveDirectTransfers(parsed.directTransfers);
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
    localStorage.setItem(STORAGE_KEYS.PURCHASE_INVOICES, JSON.stringify(initialPurchaseInvoices));
    localStorage.setItem(STORAGE_KEYS.INBOUND_RECEIPTS, JSON.stringify(initialInboundReceipts));
    localStorage.setItem(STORAGE_KEYS.MOVEMENTS, JSON.stringify(initialMovements));
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(initialSettings));
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(initialUsers));
    localStorage.setItem(STORAGE_KEYS.DIRECT_TRANSFERS, JSON.stringify(initialDirectTransfers));
    localStorage.setItem(STORAGE_KEYS.CURRENT_USER_ID, initialUsers[0].id);
  }
};
