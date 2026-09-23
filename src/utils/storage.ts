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
  ServerBackupInfo,
  DirectTransfer,
  DirectTransferItem,
  DirectTransferReturnRecord,
  SavedVehicle
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
  SAVED_VEHICLES: 'factor_app_saved_vehicles_v1',
  CATEGORIES: 'factor_app_categories_v1',
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

const initialDirectTransfers: DirectTransfer[] = [
  {
    id: 'trf-sample-1',
    transferNumber: 'TRF-1001',
    title: 'اعزام دستگاه جوشکاری اینورتر صنعتی به تعمیرگاه نوین',
    type: 'repair',
    status: 'dispatched',
    isReturnable: true,
    expectedReturnDate: '۱۴۰۳/۰۶/۲۸',
    items: [
      {
        id: 'item-1',
        productId: 'prod-hardener-1',
        productName: 'رزین و هاردنر اپوکسی شفاف صنعتی',
        productCode: '1001',
        unit: 'کیلوگرم',
        quantity: 1,
        returnedQuantity: 0,
        serialNumber: 'SN-98234-A',
        notes: 'جهت عیب‌یابی برد تغذیه و سرویس دوره‌ای',
      },
    ],
    warehouseId: 'wh-1',
    warehouseName: 'انبار مرکزی سپهر',
    dispatchedAt: '۱۴۰۳/۰۶/۲۰ - ۱۰:۳۰',
    dispatchedBy: 'مرتضی اکبری',
    receiverName: 'مهندس حسینی (تعمیرگاه نوین صنعت)',
    receiverPhone: '۰۹۱۲۳۴۵۶۷۸۹',
    dispatchVehicleInfo: 'وانت پیکان سفید - پلاک ۳۴ ب ۶۵۴ ایران ۴۴',
    destination: 'تهران، شادآباد، بازار آهن، بلوک ۵',
    dispatchNotes: 'دستگاه دچار نوسان ولتاژ شده است. همراه با کابل اتصال تحویل شد.',
    returnRecords: [],
    createdAt: '۱۴۰۳/۰۶/۲۰',
  },
];

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

  // Track deleted invoices to prevent zombie rebirth during sync
  getDeletedInvoiceIds(): Set<string> {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.DELETED_INVOICES);
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) return new Set(arr);
      }
    } catch {}
    return new Set<string>();
  },

  markInvoiceDeleted(invoiceIds: string | string[]) {
    try {
      const ids = Array.isArray(invoiceIds) ? invoiceIds : [invoiceIds];
      const current = this.getDeletedInvoiceIds();
      ids.forEach((id) => current.add(id));
      const arr = Array.from(current).slice(-1000);
      localStorage.setItem(STORAGE_KEYS.DELETED_INVOICES, JSON.stringify(arr));
      this.pushToServer({ deletedInvoiceIds: arr });
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
      const deletedArr = Array.from(this.getDeletedInvoiceIds());
      const payload = customPayload
        ? { deletedInvoiceIds: deletedArr, ...customPayload }
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
            deletedInvoiceIds: deletedArr,
          };
      const res = await fetch('/api/db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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

  // Fetch updated records from server and sync into local storage with Zero-Loss Protection
  async syncFromServer(): Promise<boolean> {
    try {
      const res = await fetch('/api/db');
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

        if (Array.isArray(d.products)) {
          localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(d.products));
          hasAnyUpdate = true;
        }
        if (Array.isArray(d.customers)) {
          localStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify(d.customers));
          hasAnyUpdate = true;
        }
        
        // Zero-Loss Invoice Synchronization
        if (Array.isArray(d.invoices)) {
          const localInvoices = this.getInvoices();
          const deletedSet = this.getDeletedInvoiceIds();
          const serverInvoiceMap = new Map(d.invoices.map((inv: Invoice) => [inv.id, inv]));

          // Find local invoices not on server and NOT intentionally deleted by user
          const unsyncedLocals = localInvoices.filter(
            (inv) => !serverInvoiceMap.has(inv.id) && !deletedSet.has(inv.id)
          );

          let finalInvoices: Invoice[];
          if (unsyncedLocals.length > 0) {
            console.warn(
              `[Data Safety] Preserving ${unsyncedLocals.length} local invoices not yet reflected on server:`,
              unsyncedLocals.map((i) => i.invoiceNumber)
            );
            // Merge server invoices with local ones, placing unsynced ones first
            finalInvoices = [...unsyncedLocals, ...d.invoices.filter((inv: Invoice) => !deletedSet.has(inv.id))];
            // Immediately sync back to server so server records them!
            this.pushToServer({ invoices: finalInvoices });
          } else {
            finalInvoices = d.invoices.filter((inv: Invoice) => !deletedSet.has(inv.id));
          }

          localStorage.setItem(STORAGE_KEYS.INVOICES, JSON.stringify(finalInvoices));
          hasAnyUpdate = true;
        }

        if (Array.isArray(d.purchaseInvoices)) {
          localStorage.setItem(STORAGE_KEYS.PURCHASE_INVOICES, JSON.stringify(d.purchaseInvoices));
          hasAnyUpdate = true;
        }
        if (Array.isArray(d.inboundReceipts)) {
          localStorage.setItem(STORAGE_KEYS.INBOUND_RECEIPTS, JSON.stringify(d.inboundReceipts));
          hasAnyUpdate = true;
        }
        if (Array.isArray(d.movements)) {
          localStorage.setItem(STORAGE_KEYS.MOVEMENTS, JSON.stringify(d.movements));
          hasAnyUpdate = true;
        }
        if (Array.isArray(d.users)) {
          localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(d.users));
          hasAnyUpdate = true;
        }
        if (Array.isArray(d.directTransfers)) {
          localStorage.setItem(STORAGE_KEYS.DIRECT_TRANSFERS, JSON.stringify(d.directTransfers));
          hasAnyUpdate = true;
        }
        if (Array.isArray(d.savedVehicles)) {
          localStorage.setItem(STORAGE_KEYS.SAVED_VEHICLES, JSON.stringify(d.savedVehicles));
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
          hasAnyUpdate = true;
        }

        if (Array.isArray(d.activityLogs)) {
          localStorage.setItem(STORAGE_KEYS.ACTIVITY_LOGS, JSON.stringify(d.activityLogs));
          hasAnyUpdate = true;
        }

        if (Array.isArray(d.categories)) {
          localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(d.categories));
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
    this.queuePushToServer({ products: ensuredProducts });
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
      const products = this.getProducts();
      const productCategories: string[] = products
        .map((p) => p.category?.trim())
        .filter((c): c is string => Boolean(c));
      const raw = localStorage.getItem(STORAGE_KEYS.CATEGORIES);

      if (!raw) {
        const merged: string[] = Array.from(new Set<string>([...defaultCategories, ...productCategories]));
        localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(merged));
        return merged;
      }

      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const parsedClean: string[] = parsed.map((c) => String(c).trim()).filter(Boolean);
        const merged: string[] = Array.from(new Set<string>([...parsedClean, ...productCategories]));
        if (merged.length !== parsed.length) {
          localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(merged));
        }
        return merged;
      }
      return Array.from(new Set<string>([...defaultCategories, ...productCategories]));
    } catch {
      return defaultCategories;
    }
  },

  saveCategories(categories: string[]) {
    const clean = Array.from(new Set(categories.map((c) => c.trim()).filter(Boolean)));
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
    return true;
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
    this.queuePushToServer({ customers });
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
    this.queuePushToServer({ invoices });
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
    this.queuePushToServer({ purchaseInvoices });
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
    this.queuePushToServer({ inboundReceipts });
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
    return updated;
  },

  // ----------------------------------------------------
  // مدیریت ماشین‌های ثبت‌شده و ناوگان تحویل گیرنده کالا
  // ----------------------------------------------------
  getSavedVehicles(): SavedVehicle[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.SAVED_VEHICLES);
      if (!raw) {
        localStorage.setItem(STORAGE_KEYS.SAVED_VEHICLES, JSON.stringify(initialSavedVehicles));
        return initialSavedVehicles;
      }
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : initialSavedVehicles;
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
    const cleanInfo = data.vehicleInfo.trim();
    const cleanDriver = (data.driverName || '').trim();
    const cleanPhone = (data.driverPhone || '').trim();

    // جستجوی خودروی مشابه بر اساس آی‌دی یا متن مشخصات ماشین
    const existingIdx = data.id
      ? list.findIndex((v) => v.id === data.id)
      : list.findIndex((v) => v.vehicleInfo.trim() === cleanInfo && (!cleanDriver || v.driverName === cleanDriver));

    let savedVehicle: SavedVehicle;

    if (existingIdx !== -1) {
      savedVehicle = {
        ...list[existingIdx],
        vehicleType: data.vehicleType || list[existingIdx].vehicleType || 'وانت باربری',
        vehicleInfo: cleanInfo || list[existingIdx].vehicleInfo,
        driverName: cleanDriver || list[existingIdx].driverName || '',
        driverPhone: cleanPhone || list[existingIdx].driverPhone || '',
        plateNumber: data.plateNumber?.trim() || list[existingIdx].plateNumber || '',
        colorDesc: data.colorDesc?.trim() || list[existingIdx].colorDesc || '',
        notes: data.notes?.trim() || list[existingIdx].notes || '',
      };
      list[existingIdx] = savedVehicle;
    } else {
      savedVehicle = {
        id: data.id || `veh-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        vehicleType: data.vehicleType || 'وانت باربری',
        vehicleInfo: cleanInfo,
        driverName: cleanDriver,
        driverPhone: cleanPhone,
        plateNumber: data.plateNumber?.trim() || '',
        colorDesc: data.colorDesc?.trim() || '',
        notes: data.notes?.trim() || '',
        createdAt: getCurrentJalaliDate(),
      };
      list.unshift(savedVehicle);
    }

    this.saveSavedVehicles(list);
    return savedVehicle;
  },

  deleteSavedVehicle(id: string): void {
    const list = this.getSavedVehicles();
    const updated = list.filter((v) => v.id !== id);
    this.saveSavedVehicles(updated);
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
    if (!data) {
      localStorage.setItem(STORAGE_KEYS.DIRECT_TRANSFERS, JSON.stringify(initialDirectTransfers));
      return initialDirectTransfers;
    }
    try {
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) return parsed;
      return initialDirectTransfers;
    } catch {
      return initialDirectTransfers;
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

    const filtered = transfers.filter((t) => t.id !== transferId);
    this.saveDirectTransfers(filtered);

    this.logActivity({
      category: 'warehouse',
      actionType: 'delete_direct_transfer',
      actionTitle: `حذف حواله خروج مستقیم ${target.transferNumber}`,
      details: `حواله ${target.title} از سیستم حذف شد. ${returnStockToWarehouse ? 'موجودی کالاهای باقیمانده به انبار برگشت داده شد.' : ''}`,
    });

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
