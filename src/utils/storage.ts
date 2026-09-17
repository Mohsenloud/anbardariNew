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
  ActivityLog,
  ActivityActionCategory,
  ServerBackupInfo
} from '../types';
import { getCurrentJalaliDate, getCurrentJalaliTime } from './jalali';
import {
  ensureProductCodesAndBarcodes,
  generateNextProductCode,
  generateProductBarcode,
  generateVariantCode,
  generateVariantBarcode,
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

const initialPurchaseInvoices: PurchaseInvoice[] = [
  {
    id: 'pur-1',
    invoiceNumber: 'PUR-1001',
    supplierName: 'شرکت بازرگانی آوا تجارت پیشرو',
    supplierPhone: '۰۲۱-۶۶۷۷۸۸۹۹',
    supplierAddress: 'تهران، خیابان جمهوری، تقاطع حافظ، مجتمع تجاری امجد',
    date: getCurrentJalaliDate(),
    items: [
      {
        id: 'pur-item-1',
        productId: 'prod-6',
        productName: 'فلش مموری سن‌دیسک Ultra Flair 64GB',
        productCode: '1006',
        unit: 'عدد',
        quantity: 15,
        buyPrice: 310000,
        discount: 0,
        total: 4650000,
      },
      {
        id: 'pur-item-2',
        productId: 'prod-3',
        productName: 'کیبورد مکانیکی گیمینگ تسکو GK 8128',
        productCode: '1003',
        unit: 'عدد',
        quantity: 5,
        buyPrice: 1350000,
        discount: 150000,
        total: 6600000,
      },
    ],
    subtotal: 11400000,
    totalDiscount: 150000,
    taxRate: 0,
    taxAmount: 0,
    shippingCost: 80000,
    finalTotal: 11330000,
    paymentStatus: 'paid',
    paymentMethod: 'transfer',
    paidAmount: 11330000,
    transferDescription: 'واریز از حساب بانک ملت شماره پیگیری ۷۸۴۵۱۲',
    notes: 'تحویل باربری مرکزی با هماهنگی انباردار',
    status: 'pending_receipt',
    inboundReceiptId: 'rec-1',
    createdAt: new Date().toISOString(),
  },
];

const initialInboundReceipts: InboundReceipt[] = [
  {
    id: 'rec-1',
    receiptNumber: 'REC-1001',
    purchaseInvoiceId: 'pur-1',
    purchaseInvoiceNumber: 'PUR-1001',
    supplierName: 'شرکت بازرگانی آوا تجارت پیشرو',
    date: getCurrentJalaliDate(),
    status: 'pending_verification',
    items: [
      {
        id: 'rec-item-1',
        productId: 'prod-6',
        productName: 'فلش مموری سن‌دیسک Ultra Flair 64GB',
        productCode: '1006',
        unit: 'عدد',
        expectedQuantity: 15,
        receivedQuantity: 0,
        discrepancy: -15,
        buyPrice: 310000,
      },
      {
        id: 'rec-item-2',
        productId: 'prod-3',
        productName: 'کیبورد مکانیکی گیمینگ تسکو GK 8128',
        productCode: '1003',
        unit: 'عدد',
        expectedQuantity: 5,
        receivedQuantity: 0,
        discrepancy: -5,
        buyPrice: 1350000,
      },
    ],
    totalExpectedQuantity: 20,
    totalReceivedQuantity: 0,
    totalDiscrepancy: -20,
    notes: 'حواله ورود صادر شده از فاکتور خرید PUR-1001 — در انتظار شمارش و تایید اقلام توسط انباردار',
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
  warehouses: [
    { id: 'wh-1', name: 'انبار مرکزی', isDefault: true },
    { id: 'wh-2', name: 'انبار شعبه ۱', isDefault: false },
    { id: 'wh-3', name: 'انبار ضایعات و رزرو', isDefault: false },
  ],
  defaultWarehouseId: 'wh-1',
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

export const StorageService = {
  _listeners: [] as Array<() => void>,

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

  // Asynchronously sync local changes to centralized server database
  async pushToServer(customPayload?: any) {
    try {
      const payload = customPayload || {
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
      };
      await fetch('/api/db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch {
      // Local copy is safe in localStorage when offline or server unreachable
    }
  },

  // Fetch updated records from server and sync into local storage
  async syncFromServer(): Promise<boolean> {
    try {
      const res = await fetch('/api/db');
      if (!res.ok) return false;
      const json = await res.json();
      if (json && json.success && json.data) {
        const d = json.data;
        if (Array.isArray(d.products)) localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(d.products));
        if (Array.isArray(d.customers)) localStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify(d.customers));
        if (Array.isArray(d.invoices)) localStorage.setItem(STORAGE_KEYS.INVOICES, JSON.stringify(d.invoices));
        if (Array.isArray(d.purchaseInvoices)) localStorage.setItem(STORAGE_KEYS.PURCHASE_INVOICES, JSON.stringify(d.purchaseInvoices));
        if (Array.isArray(d.inboundReceipts)) localStorage.setItem(STORAGE_KEYS.INBOUND_RECEIPTS, JSON.stringify(d.inboundReceipts));
        if (Array.isArray(d.movements)) localStorage.setItem(STORAGE_KEYS.MOVEMENTS, JSON.stringify(d.movements));
        if (d.settings && typeof d.settings === 'object') localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(d.settings));
        if (Array.isArray(d.users)) localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(d.users));
        if (d.exitSlipLogs && typeof d.exitSlipLogs === 'object' && !Array.isArray(d.exitSlipLogs)) {
          const localLogs = this.getExitSlipLogs();
          const remoteLogs = (d.exitSlipLogs || {}) as Record<string, ExitSlipData>;
          const merged: Record<string, ExitSlipData> = { ...remoteLogs };
          for (const invId of Object.keys(localLogs)) {
            const localSlip: ExitSlipData = localLogs[invId];
            const existingRemote = merged[invId];
            if (!existingRemote) {
              merged[invId] = localSlip;
            } else {
              merged[invId] = {
                ...existingRemote,
                receiverName: existingRemote.receiverName || localSlip.receiverName,
                receiverPhone: existingRemote.receiverPhone || localSlip.receiverPhone,
                vehicleInfo: existingRemote.vehicleInfo || localSlip.vehicleInfo,
                deliveryNotes: existingRemote.deliveryNotes || localSlip.deliveryNotes,
                isDelivered: existingRemote.isDelivered !== undefined ? existingRemote.isDelivered : localSlip.isDelivered,
                deliveredAt: existingRemote.deliveredAt || localSlip.deliveredAt,
                deliveredBy: existingRemote.deliveredBy || localSlip.deliveredBy,
              };
            }
          }
          localStorage.setItem(STORAGE_KEYS.EXIT_SLIP_LOGS, JSON.stringify(merged));
        }
        if (Array.isArray(d.activityLogs)) localStorage.setItem(STORAGE_KEYS.ACTIVITY_LOGS, JSON.stringify(d.activityLogs));
        return true;
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

  getProducts(): Product[] {
    const data = localStorage.getItem(STORAGE_KEYS.PRODUCTS);
    let list: Product[] = [];
    if (!data) {
      list = initialProducts;
    } else {
      try {
        const parsed: Product[] = JSON.parse(data);
        // Ensure the hardener variant example product is present so user has an immediate live example
        if (!parsed.some((p) => p.hasVariants || p.id === 'prod-hardener-1')) {
          list = [initialProducts[0], ...parsed];
        } else {
          list = parsed;
        }
      } catch {
        list = initialProducts;
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
    // پیش از ذخیره‌سازی، اطمینان از تکمیل بودن کد و بارکد تمام اقلام توسط سیستم
    const { products: ensuredProducts } = ensureProductCodesAndBarcodes(products);
    localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(ensuredProducts));
    this.pushToServer({ products: ensuredProducts });
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
    this.pushToServer({ customers });
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
    this.pushToServer({ invoices });
  },

  getPurchaseInvoices(): PurchaseInvoice[] {
    const data = localStorage.getItem(STORAGE_KEYS.PURCHASE_INVOICES);
    if (!data) {
      localStorage.setItem(STORAGE_KEYS.PURCHASE_INVOICES, JSON.stringify(initialPurchaseInvoices));
      return initialPurchaseInvoices;
    }
    try {
      return JSON.parse(data);
    } catch {
      return initialPurchaseInvoices;
    }
  },

  savePurchaseInvoices(purchaseInvoices: PurchaseInvoice[]) {
    localStorage.setItem(STORAGE_KEYS.PURCHASE_INVOICES, JSON.stringify(purchaseInvoices));
    this.pushToServer({ purchaseInvoices });
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
    const invoices = this.getPurchaseInvoices().filter((i) => i.id !== invoiceId);
    this.savePurchaseInvoices(invoices);
  },

  getInboundReceipts(): InboundReceipt[] {
    const data = localStorage.getItem(STORAGE_KEYS.INBOUND_RECEIPTS);
    if (!data) {
      localStorage.setItem(STORAGE_KEYS.INBOUND_RECEIPTS, JSON.stringify(initialInboundReceipts));
      return initialInboundReceipts;
    }
    try {
      return JSON.parse(data);
    } catch {
      return initialInboundReceipts;
    }
  },

  saveInboundReceipts(inboundReceipts: InboundReceipt[]) {
    localStorage.setItem(STORAGE_KEYS.INBOUND_RECEIPTS, JSON.stringify(inboundReceipts));
    this.pushToServer({ inboundReceipts });
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
    const receipts = this.getInboundReceipts().filter((r) => r.id !== receiptId);
    this.saveInboundReceipts(receipts);
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
    this.pushToServer({ movements });
  },

  getSettings(): StoreSettings {
    const data = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    const defaultWhs = [
      { id: 'wh-1', name: 'انبار مرکزی', isDefault: true },
      { id: 'wh-2', name: 'انبار شعبه ۱', isDefault: false },
      { id: 'wh-3', name: 'انبار ضایعات و رزرو', isDefault: false },
    ];
    if (!data) {
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(initialSettings));
      return initialSettings;
    }
    try {
      const parsed = JSON.parse(data);
      const merged = { ...initialSettings, ...parsed };
      if (!merged.warehouses || merged.warehouses.length === 0) {
        merged.warehouses = defaultWhs;
        merged.defaultWarehouseId = 'wh-1';
      }
      return merged;
    } catch {
      return initialSettings;
    }
  },

  saveSettings(settings: StoreSettings) {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
    this.pushToServer({ settings });
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
      if (needsSave) {
        this.saveUsers(sanitized);
      }
      return sanitized;
    } catch {
      return initialUsers;
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
      const parsed = JSON.parse(data);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return {};
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

  getExitSlipLog(invoiceId: string): ExitSlipData {
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
    }
  ): ExitSlipData {
    const logs = this.getExitSlipLogs();
    const current = logs[invoiceId] || {
      invoiceId,
      printCount: 0,
      history: [],
    };
    const updated: ExitSlipData = {
      ...current,
      ...deliveryData,
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
    localStorage.setItem(STORAGE_KEYS.CURRENT_USER_ID, initialUsers[0].id);
  }
};
