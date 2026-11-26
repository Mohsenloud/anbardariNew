import { 
  Product, 
  Customer, 
  Invoice, 
  InvoiceItem,
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
  ActivityLogSeverity,
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
  PublicCustomerLedger,
  DEFAULT_PRINT_LAYOUT,
  PrintLayoutSettings
} from '../types';
import { getCurrentJalaliDate, getCurrentJalaliTime, jalaliToGregorian, toEnglishDigits } from './jalali';
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
import { apiFetch, hasAuthToken } from './authClient';

function safeLocalStorageSet(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (err: any) {
    // Handle QuotaExceededError by trimming old activity logs and retrying once
    if (
      err &&
      (err.name === 'QuotaExceededError' ||
        err.code === 22 ||
        err.code === 1014 ||
        err.name === 'NS_ERROR_DOM_QUOTA_REACHED')
    ) {
      try {
        const logsRaw = localStorage.getItem('factor_app_activity_logs_v1');
        if (logsRaw) {
          const parsed = JSON.parse(logsRaw);
          if (Array.isArray(parsed) && parsed.length > 80) {
            localStorage.setItem('factor_app_activity_logs_v1', JSON.stringify(parsed.slice(0, 80)));
          }
        }
        localStorage.setItem(key, value);
        return true;
      } catch {
        console.warn(`[Storage] Quota exceeded while writing key "${key}". Data will still sync to server.`);
      }
    }
    return false;
  }
}
import { isPureServiceInvoice } from './serviceHelper';

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cheque: 'چک (شماره، تاریخ و نام چک)',
  cash: 'نقدی',
  transfer: 'واریز به حساب',
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
  INVOICE_PRINT_PREFERENCES: 'factor_app_invoice_print_prefs_v1',
  EXIT_SLIP_PRINT_PREFERENCES: 'factor_app_exit_slip_print_prefs_v1',
  EXPORT_MODAL_PREFERENCES: 'factor_app_export_modal_prefs_v1',
};

export interface InvoicePrintPreferences {
  template: 'standard' | 'official' | 'thermal' | 'simple';
  pageSize: 'a4' | 'a5';
  orientation: 'portrait' | 'landscape';
}

export interface ExitSlipPrintPreferences {
  template: 'standard' | 'simple';
  pageSize: 'a4' | 'a5';
  orientation: 'portrait' | 'landscape';
  printLayout?: PrintLayoutSettings;
}

export interface ExportModalPreferences {
  pdfOrientation: 'landscape' | 'portrait';
  activePreviewTab: 'items' | 'invoices' | 'slips';
  docTypeFilter: 'all' | 'regular' | 'proforma';
  deliveryFilter: 'all' | 'delivered' | 'pending';
  reportType?: 'exit_slips' | 'invoices';
  itemTypeFilter?: 'all' | 'products' | 'services';
  selectedItemFilter?: string;
}

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
    canCreatePurchaseInvoice: true,
    canViewPurchaseInvoices: true,
    canSettleInvoices: true,
    canDeleteInvoice: true,
    canManageInventory: true,
    canManageCustomers: true,
    canViewReports: true,
    canViewBuyPrices: true,
    canAccessAdmin: true,
    canManageUsers: true,
  },
  supervisor: {
    canCreateInvoice: true,
    canViewInvoices: true,
    canCreatePurchaseInvoice: true,
    canViewPurchaseInvoices: true,
    canSettleInvoices: true,
    canDeleteInvoice: true,
    canManageInventory: true,
    canManageCustomers: true,
    canViewReports: true,
    canViewBuyPrices: false,
    canAccessAdmin: false,
    canManageUsers: false,
  },
  cashier: {
    canCreateInvoice: true,
    canViewInvoices: true,
    canCreatePurchaseInvoice: false,
    canViewPurchaseInvoices: false,
    canSettleInvoices: true,
    canDeleteInvoice: false,
    canManageInventory: false,
    canManageCustomers: true,
    canViewReports: false,
    canViewBuyPrices: false,
    canAccessAdmin: false,
    canManageUsers: false,
  },
  warehouse: {
    canCreateInvoice: false,
    canViewInvoices: true,
    canCreatePurchaseInvoice: false,
    canViewPurchaseInvoices: true,
    canSettleInvoices: false,
    canDeleteInvoice: false,
    canManageInventory: true,
    canManageCustomers: false,
    canViewReports: false,
    canViewBuyPrices: false,
    canAccessAdmin: false,
    canManageUsers: false,
  },
  accountant: {
    canCreateInvoice: false,
    canViewInvoices: true,
    canCreatePurchaseInvoice: false,
    canViewPurchaseInvoices: true,
    canSettleInvoices: false,
    canDeleteInvoice: false,
    canManageInventory: false,
    canManageCustomers: true,
    canViewReports: true,
    canViewBuyPrices: true,
    canAccessAdmin: false,
    canManageUsers: false,
  },
  custom: {
    canCreateInvoice: true,
    canViewInvoices: true,
    canCreatePurchaseInvoice: false,
    canViewPurchaseInvoices: true,
    canSettleInvoices: true,
    canDeleteInvoice: false,
    canManageInventory: false,
    canManageCustomers: false,
    canViewReports: false,
    canViewBuyPrices: false,
    canAccessAdmin: false,
    canManageUsers: false,
  },
};

export function normalizeUserPermissions(
  role: UserRole,
  perms?: Partial<UserPermissions>
): UserPermissions {
  const roleDefaults = DEFAULT_ROLE_PERMISSIONS[role] || DEFAULT_ROLE_PERMISSIONS.custom;
  if (!perms) {
    return { ...roleDefaults };
  }

  // در صورتی که نقش کاربر «حسابدار» (accountant) باشد، دسترسی صرفاً مشاهده و گزارش‌گیری است (بدون ثبت، ویرایش، تسویه یا حذف)
  const isStrictAccountant = role === 'accountant';
  const isAdmin = role === 'admin';
  const isRestrictedFromBuyPrices = role === 'cashier' || role === 'warehouse';

  if (isAdmin) {
    return { ...DEFAULT_ROLE_PERMISSIONS.admin };
  }

  return {
    canCreateInvoice: isStrictAccountant ? false : Boolean(perms.canCreateInvoice ?? roleDefaults.canCreateInvoice),
    canViewInvoices: Boolean(perms.canViewInvoices ?? roleDefaults.canViewInvoices),
    canCreatePurchaseInvoice: isStrictAccountant
      ? false
      : Boolean(perms.canCreatePurchaseInvoice ?? roleDefaults.canCreatePurchaseInvoice),
    canViewPurchaseInvoices: Boolean(
      perms.canViewPurchaseInvoices ??
        roleDefaults.canViewPurchaseInvoices ??
        (perms.canViewInvoices || perms.canManageInventory)
    ),
    canSettleInvoices: isStrictAccountant
      ? false
      : Boolean(
          perms.canSettleInvoices ??
            roleDefaults.canSettleInvoices ??
            (perms.canCreateInvoice || perms.canViewReports)
        ),
    canDeleteInvoice: isStrictAccountant ? false : Boolean(perms.canDeleteInvoice ?? roleDefaults.canDeleteInvoice),
    canManageInventory: isStrictAccountant ? false : Boolean(perms.canManageInventory ?? roleDefaults.canManageInventory),
    canManageCustomers: Boolean(perms.canManageCustomers ?? roleDefaults.canManageCustomers),
    canViewReports: Boolean(perms.canViewReports ?? roleDefaults.canViewReports),
    canViewBuyPrices: isRestrictedFromBuyPrices
      ? false
      : isStrictAccountant
        ? true
        : Boolean(perms.canViewBuyPrices ?? roleDefaults.canViewBuyPrices),
    canAccessAdmin: isStrictAccountant ? false : Boolean(perms.canAccessAdmin ?? roleDefaults.canAccessAdmin),
    canManageUsers: isStrictAccountant ? false : Boolean(perms.canManageUsers ?? roleDefaults.canManageUsers),
  };
}

export function canUserViewBuyPrices(user?: AppUser | null): boolean {
  if (!user) return false;
  if (user.role === 'admin' || user.role === 'accountant') return true;
  if (user.role === 'cashier' || user.role === 'warehouse') return false;
  return Boolean(user.permissions?.canViewBuyPrices);
}

/**
 * Normalizes Persian/Arabic characters (ي/ى -> ی, ك -> ک) and collapses whitespace
 * so category names never splinter into visual duplicates.
 */
export function normalizeCategoryName(raw?: string | null): string {
  return String(raw || '')
    .replace(/[\u200B\uFEFF]/g, '')
    .replace(/[يیى]/g, 'ی')
    .replace(/[كک]/g, 'ک')
    .replace(/\s+/g, ' ')
    .trim();
}

export function categoryKey(raw?: string | null): string {
  return normalizeCategoryName(raw).toLowerCase();
}

export const COMMON_PRODUCT_UNITS: string[] = [
  'عدد',
  'بسته',
  'کارتن',
  'کیلوگرم',
  'متر',
  'شاخه',
  'کیسه',
  'دستگاه',
  'ست',
  'لیتر',
  'حلقه',
  'جفت',
  'قوطی',
  'تن',
];

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'مدیر کل (دسترسی نامحدود)',
  supervisor: 'سرپرست (همه فعالیت‌ها بجز پنل و مدیریت کاربران)',
  cashier: 'صندوق‌دار و فروشنده',
  warehouse: 'مسئول انبار و موجودی',
  accountant: 'حسابدار و تحلیلگر مالی (فقط مشاهده و گزارش‌گیری)',
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
  {
    id: 'user-5',
    username: 'supervisor1',
    fullName: 'کامران امینی',
    role: 'supervisor',
    roleTitle: 'سرپرست فروش و عملیات',
    permissions: { ...DEFAULT_ROLE_PERMISSIONS.supervisor },
    isActive: true,
    avatarColor: 'teal',
    phone: '۰۹۱۲۰۱۱۴۴۵۵',
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
    wholesalePrice: 3250000,
    stock: 155,
    minStockAlert: 20,
    description: 'پودر سخت کننده ضدسایش پایه سیمانی و سیلیسی ویژه کفسازی بتنی',
    updatedAt: getCurrentJalaliDate(),
    priceHistory: [
      {
        id: 'ph-init-1',
        date: '1403/09/10',
        buyPrice: 2550000,
        sellPrice: 3200000,
        wholesalePrice: 2980000,
        supplierName: 'کارخانه شیمی‌بتن البرز',
        invoiceNumber: 'P-101',
        note: 'خرید پارت اول پاییز',
      },
      {
        id: 'ph-init-2',
        date: getCurrentJalaliDate(),
        buyPrice: 2800000,
        sellPrice: 3500000,
        wholesalePrice: 3250000,
        supplierName: 'کارخانه شیمی‌بتن البرز',
        invoiceNumber: 'P-104',
        note: 'بروزرسانی نرخ خرید کارخانه',
      },
    ],
    hasVariants: true,
    variants: [
      {
        id: 'var-hardener-grey',
        name: 'طوسی',
        code: '1000-GR',
        barcode: '2110000100011',
        buyPrice: 2800000,
        sellPrice: 3500000,
        wholesalePrice: 3250000,
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
        wholesalePrice: 3480000,
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
        wholesalePrice: 3800000,
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
    wholesalePrice: 31500000,
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
    wholesalePrice: 525000,
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
    notes: 'مشتری حقوقی معتبر - طرف قرارداد پشتیبانی و خرید عمده',
    customerType: 'colleague',
    createdAt: getCurrentJalaliDate(),
  },
  {
    id: 'cust-2',
    name: 'مهندس آرش رستمی',
    phone: '۰۹۱۲۱۱۱۴۴۵۵',
    nationalId: '۰۰۱۴۸۷۲۲۳۱',
    address: 'تهران، سعادت‌آباد، میدان کاج، خ سرو غربی',
    notes: 'مشتری دائمی تجهیزات اداری',
    customerType: 'regular',
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
  registrationNumber: '۵۴۳۲۱۰',
  address: 'تهران، خیابان ولیعصر، تقاطع طالقانی، مجتمع نور، واحد ۲۰۴',
  postalCode: '۱۴۱۵۸۳۳۶۵۴',
  invoiceFooterText: 'از خرید و حسن اعتماد شما صمیمانه سپاسگزاریم.',
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
  officialTaxPercent: 10,
  autoApplyOfficialTax: true,
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
  telegramApiUrl: 'https://api.telegram.org',
  telegramProxyUrl: '',
  telegramSendMode: 'text_only',
  telegramAutoSendInvoice: false,
  telegramAutoSendProforma: false,
  telegramAutoSendPurchaseInvoice: false,
  telegramAutoSendCustomerPayment: false,
  telegramAutoSendSupplierPayment: false,
  telegramAutoSendOnlyConfirmed: true,
  telegramAutoSendOnProformaConvert: true,
  telegramAutoSendExitSlip: false,
  telegramAutoSendExitSlipIssue: false,
  telegramAutoSendExitSlipConfirm: false,
  telegramAutoSendInboundReceipt: false,
  telegramAutoSendInboundReceiptIssue: false,
  telegramAutoSendInboundReceiptConfirm: false,
  telegramAutoSendCustomerDirect: true,
  telegramInvoicePageSize: 'a4',
  telegramInvoiceOrientation: 'portrait',
  telegramInvoiceTemplate: 'standard',
  telegramExitSlipPageSize: 'a4',
  telegramExitSlipOrientation: 'portrait',
  telegramExitSlipTemplate: 'standard',
  telegramCaptionTemplate: '',

  // تنظیمات هوش مصنوعی و ویس تلگرام
  aiProvider: 'gemini',
  aiApiKey: '',
  aiModel: 'gemini-4-hydrogen',
  aiBaseUrl: '',
  aiVoiceInboundEnabled: true,
  aiVoiceAutoMatchProducts: true,
  aiVoiceRequireAdminApproval: true,
  aiCustomPrompt: '',
  aiVoiceAllowedChatIds: '',
  telegramWebhookSecret: '',

  // تنظیمات ابعاد، فونت‌ها و جدول چاپ و خروجی PDF
  printLayout: DEFAULT_PRINT_LAYOUT,
};

const initialActivityLogs: ActivityLog[] = [];

function detectClientDeviceInfo(): string {
  if (typeof navigator === 'undefined') return 'مرورگر وب';
  const ua = navigator.userAgent || '';
  if (!ua) return 'مرورگر وب';

  let os = 'نامشخص';
  let form = typeof window !== 'undefined' && window.innerWidth < 768 ? 'موبایل' : 'رایانه';
  if (/Android/i.test(ua)) {
    os = 'Android';
    form = 'موبایل';
  } else if (/iPhone|iPad|iPod/i.test(ua)) {
    os = 'iOS';
    form = /iPad/i.test(ua) ? 'تبلت' : 'موبایل';
  } else if (/Windows/i.test(ua)) {
    os = 'Windows';
  } else if (/Mac OS X|Macintosh/i.test(ua)) {
    os = 'macOS';
  } else if (/Linux/i.test(ua)) {
    os = 'Linux';
  }

  let browser = 'مرورگر';
  if (/Edg\//i.test(ua)) browser = 'Edge';
  else if (/OPR\/|Opera/i.test(ua)) browser = 'Opera';
  else if (/Chrome\//i.test(ua) && !/Chromium/i.test(ua)) browser = 'Chrome';
  else if (/Firefox\//i.test(ua)) browser = 'Firefox';
  else if (/Safari\//i.test(ua) && !/Chrome\//i.test(ua)) browser = 'Safari';

  return `${browser} • ${os} (${form})`;
}

export function inferClientLogSeverity(actionType?: string, category?: string): ActivityLogSeverity {
  const act = String(actionType || '').toLowerCase();
  const cat = String(category || '').toLowerCase();
  if (
    act.includes('delete') ||
    act.includes('restore') ||
    act.includes('clear_logs') ||
    act.includes('import_sql') ||
    act.includes('lockout') ||
    act.includes('recovery_reset') ||
    act.includes('return')
  ) {
    return 'critical';
  }
  if (
    act.includes('failed_login') ||
    act.includes('edit') ||
    act.includes('update') ||
    act.includes('adjust') ||
    act.includes('recovery_request') ||
    act.includes('share_link') ||
    act.includes('prune') ||
    cat === 'settings' ||
    cat === 'users'
  ) {
    return 'warning';
  }
  return 'info';
}

function isLegacyDemoSeedLogClient(log: any): boolean {
  if (!log || typeof log !== 'object') return false;
  const id = String(log.id || '');
  if (!['log-1', 'log-2', 'log-3', 'log-4'].includes(id)) return false;
  const details = String(log.details || '');
  return (
    details.includes('شماره INV-1001 برای مشتری شرکت فناوران') ||
    details.includes('REC-1001 مربوط به فاکتور خرید PUR-1001') ||
    details.includes('احراز هویت مدیر ارشد') ||
    details.includes('کسر خودکار موجودی انبار هنگام صدور فاکتور')
  );
}

function computeLogSortMsClient(log: Partial<ActivityLog>): number {
  if (typeof log.createdAtMs === 'number' && Number.isFinite(log.createdAtMs) && log.createdAtMs > 0) {
    return log.createdAtMs;
  }
  const idMatch = String(log.id || '').match(/^log-(\d{12,15})(?:-|$)/);
  if (idMatch) {
    return Number(idMatch[1]);
  }
  const ts = toEnglishDigits(String(log.timestamp || log.dateOnly || ''));
  const m = ts.match(/(\d{4})\/(\d{1,2})\/(\d{1,2})(?:\D+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
  if (m) {
    const [gy, gm, gd] = jalaliToGregorian(Number(m[1]), Number(m[2]), Number(m[3]));
    return (
      Date.UTC(gy, gm - 1, gd, Number(m[4] || 0), Number(m[5] || 0), Number(m[6] || 0)) -
      3.5 * 3600 * 1000
    );
  }
  return 0;
}

function mergeActivityLogsClient(existing: ActivityLog[], incoming: ActivityLog[], maxItems = 2000): ActivityLog[] {
  const map = new Map<string, ActivityLog>();
  const add = (list: ActivityLog[]) => {
    for (const raw of Array.isArray(list) ? list : []) {
      if (!raw || typeof raw !== 'object' || !raw.id || isLegacyDemoSeedLogClient(raw)) continue;
      const prev = map.get(raw.id);
      const normalized: ActivityLog = {
        ...raw,
        severity: raw.severity || inferClientLogSeverity(raw.actionType, raw.category),
      };
      if (!prev) {
        map.set(raw.id, normalized);
      } else {
        map.set(raw.id, {
          ...prev,
          ...normalized,
          ipAddress: normalized.ipAddress || prev.ipAddress,
          source: prev.source === 'server' || normalized.source === 'server' ? 'server' : (normalized.source || prev.source),
          createdAtMs: normalized.createdAtMs || prev.createdAtMs,
        });
      }
    }
  };
  add(existing);
  add(incoming);
  return Array.from(map.values())
    .sort((a, b) => computeLogSortMsClient(b) - computeLogSortMsClient(a))
    .slice(0, maxItems);
}

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

      if (this.getCurrentUser()?.role === 'accountant') {
        return;
      }

      ids.forEach((itemId) => {
        apiFetch('/api/db/delete-item', {
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
    if (!hasAuthToken()) {
      return false;
    }
    // Read-only accountant role must never push mutations to the server
    if (this.getCurrentUser()?.role === 'accountant') {
      return false;
    }
    try {
      const tombstones = this.getDeletedTombstones();
      const baseRevision = this._lastServerRevision > 0 ? this._lastServerRevision : undefined;
      const payload = customPayload
        ? { deletedInvoiceIds: tombstones.invoices, tombstones, ...(baseRevision ? { baseRevision } : {}), ...customPayload }
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
            ...(baseRevision ? { baseRevision } : {}),
          };
      const res = await apiFetch('/api/db', {
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
  async syncFromServer(force: boolean = false, isRestore: boolean = false): Promise<boolean> {
    if (!hasAuthToken()) {
      return false;
    }
    try {
      const res = await apiFetch(`/api/db?_t=${Date.now()}`, {
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

        // If server data hasn't changed since last sync or local push, skip overwrite (unless forced on restore)
        if (
          !force &&
          !isRestore &&
          this._lastServerRevision > 0 &&
          serverRevision > 0 &&
          serverRevision === this._lastServerRevision &&
          serverChecksum === this._lastServerChecksum
        ) {
          return false;
        }

        // Protect local settings if recently saved (e.g. within last 10 seconds), unless forced or restoring
        const isRecentSave = !force && !isRestore && Date.now() - this._lastLocalSettingsSaveTime < 10000;

        let hasAnyUpdate = false;

        // 1. Synchronize server-wide tombstones across all entities
        // On restore (isRestore = true), replace local tombstones with server tombstones and strip any active IDs in restored data
        const localTombstones: AppTombstones = isRestore
          ? {
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
            }
          : this.getDeletedTombstones();
        let tombstonesUpdated = isRestore;

        const activeIdsInServer = {
          invoices: new Set(Array.isArray(d.invoices) ? d.invoices.map((x: any) => x?.id).filter(Boolean) : []),
          products: new Set(Array.isArray(d.products) ? d.products.map((x: any) => x?.id).filter(Boolean) : []),
          customers: new Set(Array.isArray(d.customers) ? d.customers.map((x: any) => x?.id).filter(Boolean) : []),
          purchaseInvoices: new Set(Array.isArray(d.purchaseInvoices) ? d.purchaseInvoices.map((x: any) => x?.id).filter(Boolean) : []),
          inboundReceipts: new Set(Array.isArray(d.inboundReceipts) ? d.inboundReceipts.map((x: any) => x?.id).filter(Boolean) : []),
          directTransfers: new Set(Array.isArray(d.directTransfers) ? d.directTransfers.map((x: any) => x?.id).filter(Boolean) : []),
          savedVehicles: new Set(Array.isArray(d.savedVehicles) ? d.savedVehicles.map((x: any) => x?.id).filter(Boolean) : []),
          customerTransactions: new Set(Array.isArray(d.customerTransactions) ? d.customerTransactions.map((x: any) => x?.id).filter(Boolean) : []),
          users: new Set(Array.isArray(d.users) ? d.users.map((x: any) => x?.id).filter(Boolean) : []),
          categories: new Set(Array.isArray(d.categories) ? d.categories.map((c: string) => String(c).trim().toLowerCase()) : []),
        };

        const mergeList = (key: keyof AppTombstones, serverList: any) => {
          const activeSet = activeIdsInServer[key];
          const set = new Set(
            (localTombstones[key] || []).filter((id) =>
              key === 'categories' ? !activeSet.has(id.trim().toLowerCase()) : !activeSet.has(id.trim())
            )
          );
          if (Array.isArray(serverList)) {
            serverList.forEach((id: string) => {
              if (typeof id === 'string' && id.trim()) {
                const cleanId = id.trim();
                const isAlive = key === 'categories' ? activeSet.has(cleanId.toLowerCase()) : activeSet.has(cleanId);
                if (!isAlive && !set.has(cleanId)) {
                  set.add(cleanId);
                  tombstonesUpdated = true;
                }
              }
            });
          }
          const finalArr = Array.from(set).slice(-2000);
          if (finalArr.length !== (localTombstones[key] || []).length) {
            tombstonesUpdated = true;
          }
          localTombstones[key] = finalArr;
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
        } else {
          // Still purify against active server entities
          (Object.keys(activeIdsInServer) as Array<keyof AppTombstones>).forEach((k) => mergeList(k, []));
        }

        if (Array.isArray(d.deletedInvoiceIds)) {
          mergeList('invoices', d.deletedInvoiceIds);
        }

        if (tombstonesUpdated) {
          safeLocalStorageSet(STORAGE_KEYS.TOMBSTONES, JSON.stringify(localTombstones));
          safeLocalStorageSet(STORAGE_KEYS.DELETED_INVOICES, JSON.stringify(localTombstones.invoices));
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
          safeLocalStorageSet(STORAGE_KEYS.PRODUCTS, JSON.stringify(cleanProducts));
          hasAnyUpdate = true;
        }

        if (Array.isArray(d.customers)) {
          const cleanCustomers = d.customers.filter((c: Customer) => !custDelSet.has(c.id));
          safeLocalStorageSet(STORAGE_KEYS.CUSTOMERS, JSON.stringify(cleanCustomers));
          hasAnyUpdate = true;
        }

        if (Array.isArray(d.invoices)) {
          const finalInvoices = d.invoices.filter((inv: Invoice) => !invDelSet.has(inv.id));
          safeLocalStorageSet(STORAGE_KEYS.INVOICES, JSON.stringify(finalInvoices));
          hasAnyUpdate = true;
        }

        if (Array.isArray(d.purchaseInvoices)) {
          const cleanPurchases = d.purchaseInvoices.filter((p: PurchaseInvoice) => !purchDelSet.has(p.id));
          safeLocalStorageSet(STORAGE_KEYS.PURCHASE_INVOICES, JSON.stringify(cleanPurchases));
          hasAnyUpdate = true;
        }

        if (Array.isArray(d.inboundReceipts)) {
          const cleanInbound = d.inboundReceipts.filter((r: InboundReceipt) => !inbDelSet.has(r.id));
          safeLocalStorageSet(STORAGE_KEYS.INBOUND_RECEIPTS, JSON.stringify(cleanInbound));
          hasAnyUpdate = true;
        }

        if (Array.isArray(d.movements)) {
          safeLocalStorageSet(STORAGE_KEYS.MOVEMENTS, JSON.stringify(d.movements));
          hasAnyUpdate = true;
        }

        if (Array.isArray(d.users)) {
          const cleanUsers = d.users.filter((u: AppUser) => !usrDelSet.has(u.id));
          safeLocalStorageSet(STORAGE_KEYS.USERS, JSON.stringify(cleanUsers));
          hasAnyUpdate = true;
        }

        if (Array.isArray(d.directTransfers)) {
          const cleanTransfers = d.directTransfers.filter((t: DirectTransfer) => !transDelSet.has(t.id));
          safeLocalStorageSet(STORAGE_KEYS.DIRECT_TRANSFERS, JSON.stringify(cleanTransfers));
          hasAnyUpdate = true;
        }

        if (Array.isArray(d.savedVehicles)) {
          const cleanVehicles = d.savedVehicles.filter((v: any) => !vehDelSet.has(v.id));
          safeLocalStorageSet(STORAGE_KEYS.SAVED_VEHICLES, JSON.stringify(cleanVehicles));
          hasAnyUpdate = true;
        }

        if (Array.isArray(d.customerTransactions)) {
          const cleanTransactions = d.customerTransactions.filter((t: CustomerTransaction) => !txnDelSet.has(t.id));
          safeLocalStorageSet(STORAGE_KEYS.CUSTOMER_TRANSACTIONS, JSON.stringify(cleanTransactions));
          hasAnyUpdate = true;
        }

        if (d.settings && typeof d.settings === 'object') {
          const currentLocal = this.getSettings();
          const localUpdated = currentLocal.updatedAt ? new Date(currentLocal.updatedAt).getTime() : 0;
          const remoteUpdated = d.settings.updatedAt ? new Date(d.settings.updatedAt).getTime() : 0;

          // Never revert local user modifications back to older/empty server defaults (unless explicitly restoring a backup)
          if (!isRestore && (isRecentSave || (localUpdated >= remoteUpdated && localUpdated > 0))) {
            const preservedSettings: StoreSettings = {
              ...initialSettings,
              ...d.settings,
              ...currentLocal,
            };
            if (Array.isArray(currentLocal.warehouses) && currentLocal.warehouses.length > 0) {
              preservedSettings.warehouses = currentLocal.warehouses;
            }
            safeLocalStorageSet(STORAGE_KEYS.SETTINGS, JSON.stringify(preservedSettings));
            const logged = this.getLoggedInUser();
            const canPushGlobalSettings = Boolean(
              logged && (logged.role === 'admin' || logged.permissions?.canAccessAdmin)
            );
            if (!isRecentSave && canPushGlobalSettings) {
              this.pushToServer({ settings: preservedSettings });
            }
          } else {
            const mergedSettings: StoreSettings = {
              ...initialSettings,
              ...currentLocal,
              ...d.settings,
            };
            if (Array.isArray(d.settings.warehouses) && d.settings.warehouses.length > 0) {
              mergedSettings.warehouses = d.settings.warehouses;
            } else if (Array.isArray(currentLocal.warehouses) && currentLocal.warehouses.length > 0) {
              mergedSettings.warehouses = currentLocal.warehouses;
            }
            safeLocalStorageSet(STORAGE_KEYS.SETTINGS, JSON.stringify(mergedSettings));
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
          safeLocalStorageSet(STORAGE_KEYS.EXIT_SLIP_LOGS, JSON.stringify(cleaned));
          hasAnyUpdate = true;
        }

        if (Array.isArray(d.activityLogs)) {
          const active = this.getLoggedInUser();
          const canViewServerLogs = active && (active.role === 'admin' || active.permissions?.canAccessAdmin || active.permissions?.canManageUsers);
          if (canViewServerLogs) {
            const cleaned = mergeActivityLogsClient([], d.activityLogs);
            safeLocalStorageSet(STORAGE_KEYS.ACTIVITY_LOGS, JSON.stringify(cleaned));
            hasAnyUpdate = true;
          }
        }

        if (Array.isArray(d.categories)) {
          const cleanCats = d.categories.filter((c: string) => !catDelSet.has(String(c).trim().toLowerCase()));
          safeLocalStorageSet(STORAGE_KEYS.CATEGORIES, JSON.stringify(cleanCats));
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
      const res = await apiFetch('/api/backups', { cache: 'no-store' });
      if (!res.ok) return { success: false, total: 0, autoBackupIntervalHours: 4, backups: [] };
      return await res.json();
    } catch {
      return { success: false, total: 0, autoBackupIntervalHours: 4, backups: [] };
    }
  },

  async inspectServerBackup(filename: string): Promise<{
    success: boolean;
    filename?: string;
    label?: string;
    trigger?: string;
    createdAt?: string;
    sizeBytes?: number;
    checksum?: string;
    checksumValid?: boolean;
    stats?: ServerBackupInfo['stats'];
    storeName?: string;
    message?: string;
  }> {
    try {
      const res = await apiFetch(`/api/backups/inspect/${encodeURIComponent(filename)}`, { cache: 'no-store' });
      return await res.json();
    } catch (e: any) {
      return { success: false, message: e.message || 'خطا در بررسی مشخصات نسخه پشتیبان' };
    }
  },

  async pruneServerBackups(keepAutoCount = 5): Promise<{
    success: boolean;
    deletedCount?: number;
    message?: string;
    backups?: ServerBackupInfo[];
  }> {
    try {
      const res = await apiFetch('/api/backups/prune', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keepAutoCount }),
      });
      return await res.json();
    } catch (e: any) {
      return { success: false, message: e.message || 'خطا در پاکسازی نسخه‌های قدیمی' };
    }
  },

  async createServerBackup(label?: string): Promise<{ success: boolean; message?: string; filename?: string; backups?: ServerBackupInfo[] }> {
    try {
      // First push latest client state so the server backup has 100% up-to-date data
      try {
        await this.pushToServer();
      } catch {}

      const res = await apiFetch('/api/backups/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label }),
      });
      return await res.json();
    } catch (e: any) {
      return { success: false, message: e.message || 'خطا در برقراری ارتباط با سرور' };
    }
  },

  async restoreServerBackup(filename: string, modules?: string[]): Promise<{ success: boolean; message?: string; backups?: ServerBackupInfo[] }> {
    try {
      const res = await apiFetch('/api/backups/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename, modules }),
      });
      const data = await res.json();
      if (data.success) {
        await this.syncFromServer(true, true);
      }
      return data;
    } catch (e: any) {
      return { success: false, message: e.message || 'خطا در بازیابی نسخه پشتیبان' };
    }
  },

  async deleteServerBackup(filename: string): Promise<{ success: boolean; message?: string; backups?: ServerBackupInfo[] }> {
    try {
      const res = await apiFetch(`/api/backups/${encodeURIComponent(filename)}`, {
        method: 'DELETE',
      });
      return await res.json();
    } catch (e: any) {
      return { success: false, message: e.message || 'خطا در حذف نسخه پشتیبان' };
    }
  },

  async uploadServerBackup(
    fileContent: string,
    restoreNow: boolean,
    label?: string,
    modules?: string[]
  ): Promise<{ success: boolean; message?: string; backups?: ServerBackupInfo[] }> {
    try {
      const res = await apiFetch('/api/backups/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ backupContent: fileContent, restoreNow, label, modules }),
      });
      const data = await res.json();
      if (data.success && restoreNow) {
        await this.syncFromServer(true, true);
      }
      return data;
    } catch (e: any) {
      return { success: false, message: e.message || 'خطا در بارگذاری فایل پشتیبان' };
    }
  },

  async sendDatabaseBackupToTelegram(optionsOrFilename?: string | {
    filename?: string;
    botToken?: string;
    chatId?: string;
  }): Promise<{
    success: boolean;
    message?: string;
    error?: string;
  }> {
    try {
      // 1. اول اطلاعات کلاینت را در سرور ذخیره و همگام می‌کنیم تا دیتابیس سرور حتماً شامل تمام کالاهای جدید باشد
      try {
        await this.pushToServer();
      } catch (pushErr) {
        console.warn('[Sync Before Telegram Backup]:', pushErr);
      }

      // 2. اسنپ‌شات کامل کلاینت (شامل تمام ۱۷ کالا، فاکتورها، مشتریان و تنظیمات) را استخراج می‌کنیم
      const clientSnapshot = this.exportAllDataAsObject();

      let payload: any = {
        clientData: clientSnapshot,
        products: clientSnapshot.products,
        customers: clientSnapshot.customers,
        invoices: clientSnapshot.invoices,
      };

      if (typeof optionsOrFilename === 'string') {
        payload.filename = optionsOrFilename;
      } else if (optionsOrFilename && typeof optionsOrFilename === 'object') {
        payload = { ...payload, ...optionsOrFilename };
      }

      const res = await apiFetch('/api/telegram/send-backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data?.success) {
        return data;
      }

      // در صورتی که سرور VPS داخل ایران باشد و دسترسی سرور به تلگرام مسدود باشد، فایل بکاپ را مستقیماً از مرورگر ارسال کن
      const errMsg = String(data?.error || data?.message || '');
      if (errMsg.includes('fetch failed') || errMsg.includes('عدم برقراری ارتباط') || res.status >= 500) {
        const settings = this.getSettings();
        const rawToken = payload.botToken || settings?.telegramBotToken || '';
        const cleanToken = String(rawToken).trim().replace(/^bot/i, '');
        const cleanChatId = String(payload.chatId || settings?.telegramChatId || '').trim();
        const baseUrl = (settings?.telegramApiUrl || 'https://api.telegram.org').trim().replace(/\/+$/, '');

        if (cleanToken && cleanChatId) {
          const jsonBlob = new Blob([JSON.stringify(clientSnapshot, null, 2)], { type: 'application/json' });
          const dateStr = new Date().toISOString().slice(0, 10);
          const form = new FormData();
          form.append('chat_id', cleanChatId);
          form.append('document', jsonBlob, `mana_backup_${dateStr}.json`);
          form.append(
            'caption',
            `🛡️ <b>نسخه پشتیبان کامل پایگاه‌داده</b>\n📦 تعداد کالاها: ${clientSnapshot.products?.length || 0}\n🧾 تعداد فاکتورها: ${clientSnapshot.invoices?.length || 0}\n👥 تعداد مشتریان: ${clientSnapshot.customers?.length || 0}`
          );
          form.append('parse_mode', 'HTML');

          const directRes = await fetch(`${baseUrl}/bot${cleanToken}/sendDocument`, {
            method: 'POST',
            body: form,
          });
          const directJson = await directRes.json();
          if (directRes.ok && directJson?.ok) {
            return {
              success: true,
              message: 'نسخه پشتیبان پایگاه‌داده با موفقیت به تلگرام ارسال گردید.',
            };
          }
        }
      }

      return data;
    } catch (e: any) {
      return {
        success: false,
        error: 'خطا در ارتباط با سرور: ' + (e?.message || ''),
      };
    }
  },

  // -------------------------------------------------------------
  // POSTGRESQL & DATABASE STATUS / TEST APIS
  // -------------------------------------------------------------
  async getDatabaseStatus(): Promise<any> {
    try {
      const res = await apiFetch('/api/database/status');
      if (!res.ok) return { success: false, message: 'عدم پاسخگویی سرور' };
      return await res.json();
    } catch (e: any) {
      return { success: false, message: e.message || 'خطا در برقراری ارتباط با سرور' };
    }
  },

  async testDatabaseConnection(): Promise<any> {
    try {
      const res = await apiFetch('/api/database/test', { method: 'POST' });
      return await res.json();
    } catch (e: any) {
      return { success: false, message: e.message || 'خطا در تست اتصال دیتابیس' };
    }
  },

  async forceSyncToPostgres(): Promise<{ success: boolean; message: string }> {
    try {
      const res = await apiFetch('/api/database/force-sync', { method: 'POST' });
      return await res.json();
    } catch (e: any) {
      return { success: false, message: e.message || 'خطا در اجرای همگام‌سازی با PostgreSQL' };
    }
  },

  async downloadPostgresSqlDump(): Promise<{ success: boolean; message?: string }> {
    try {
      // Use the dedicated non-blocking dump endpoint with fallback to export-sql
      let res = await apiFetch('/api/database/dump-sql', {
        method: 'GET',
        headers: { 'Cache-Control': 'no-cache' },
      });
      if (!res.ok) {
        res = await apiFetch('/api/database/export-sql', {
          method: 'GET',
          headers: { 'Cache-Control': 'no-cache' },
        });
      }
      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        throw new Error(errorData?.message || 'خطا در دریافت فایل خروجی پشتیبان SQL از سرور');
      }

      // Extract filename from header or fallback
      let filename = `mana_db_${new Date().toISOString().slice(0, 10)}.sql`;
      const disposition = res.headers.get('content-disposition');
      if (disposition && disposition.includes('filename=')) {
        const match = disposition.match(/filename="?([^"]+)"?/);
        if (match?.[1]) filename = match[1];
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      return { success: true, message: 'فایل پشتیبان کامل SQL دیتابیس با موفقیت دانلود شد.' };
    } catch (e: any) {
      console.error('[StorageService] downloadPostgresSqlDump error:', e);
      return { success: false, message: e.message || 'خطا در دانلود فایل دیتابیس' };
    }
  },

  async importPostgresSqlFile(sqlContent: string): Promise<{ success: boolean; message: string }> {
    try {
      if (!sqlContent || typeof sqlContent !== 'string' || sqlContent.trim().length === 0) {
        return { success: false, message: 'فایل اسکریپت SQL خالی است.' };
      }

      // Safety guard against accidental drop database commands
      if (/DROP\s+DATABASE/i.test(sqlContent)) {
        return { success: false, message: 'عملیات نامعتبر: فایل حاوی دستور حذف کل دیتابیس (DROP DATABASE) است و به دلایل امنیتی مسدود گردید.' };
      }

      const res = await apiFetch('/api/database/import-sql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/sql' },
        body: sqlContent,
      });
      const data = await res.json();
      if (data.success) {
        // Sync local client storage with authoritative server state (forced)
        await this.syncFromServer(true);
      }
      return data;
    } catch (e: any) {
      return { success: false, message: e.message || 'خطا در بارگذاری و اجرای اسکریپت SQL' };
    }
  },

  async createPostgresSnapshot(label?: string): Promise<{ success: boolean; message: string }> {
    try {
      const res = await apiFetch('/api/database/snapshot', {
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
    const defaultKey = categoryKey('عمومی');

    const dedupeNormalized = (list: string[], delSet: Set<string>): string[] => {
      const seen = new Set<string>();
      const out: string[] = [];
      for (const rawItem of list) {
        const clean = normalizeCategoryName(rawItem);
        if (!clean) continue;
        const key = clean.toLowerCase();
        if (key !== defaultKey && delSet.has(key)) continue;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(key === defaultKey ? 'عمومی' : clean);
      }
      if (!seen.has(defaultKey)) {
        out.unshift('عمومی');
      }
      return out;
    };

    try {
      const tombstones = this.getDeletedTombstones();
      const catDelSet = new Set<string>(
        (tombstones.categories || [])
          .map((c: string) => categoryKey(c))
          .filter((k: string) => Boolean(k) && k !== defaultKey)
      );

      const products = this.getProducts();
      const productCategories: string[] = products
        .map((p) => normalizeCategoryName(p.category))
        .filter((c): c is string => Boolean(c) && !catDelSet.has(c.toLowerCase()));
      const raw = localStorage.getItem(STORAGE_KEYS.CATEGORIES);

      if (!raw) {
        const merged = dedupeNormalized([...defaultCategories, ...productCategories], catDelSet);
        localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(merged));
        return merged;
      }

      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const merged = dedupeNormalized(
          [...parsed.map((c) => String(c || '')), ...productCategories],
          catDelSet
        );
        const changed =
          merged.length !== parsed.length ||
          merged.some((item, idx) => item !== parsed[idx]);
        if (changed) {
          localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(merged));
        }
        return merged;
      }
      return dedupeNormalized([...defaultCategories, ...productCategories], catDelSet);
    } catch {
      return defaultCategories;
    }
  },

  unrecordCategoryTombstone(categoryNames: string | string[]) {
    try {
      const names = (Array.isArray(categoryNames) ? categoryNames : [categoryNames])
        .map((c) => normalizeCategoryName(c))
        .filter(Boolean);
      if (names.length === 0) return;

      const keySet = new Set(names.map((n) => n.toLowerCase()));
      const current = this.getDeletedTombstones();
      const before = current.categories || [];
      const after = before.filter((c) => !keySet.has(categoryKey(c)));
      if (after.length !== before.length) {
        current.categories = after;
        localStorage.setItem(STORAGE_KEYS.TOMBSTONES, JSON.stringify(current));
      }
      this.queuePushToServer({ reviveCategories: names, tombstones: current });
    } catch (e) {
      console.error('Failed to unrecord category tombstone:', e);
    }
  },

  saveCategories(categories: string[], revivedNames?: string[]) {
    const normalizedRevived = (revivedNames || []).map((n) => normalizeCategoryName(n)).filter(Boolean);
    if (normalizedRevived.length > 0) {
      this.unrecordCategoryTombstone(normalizedRevived);
    }
    const defaultKey = categoryKey('عمومی');
    const tombstones = this.getDeletedTombstones();
    const catDelSet = new Set(
      (tombstones.categories || [])
        .map((c) => categoryKey(c))
        .filter((k) => Boolean(k) && k !== defaultKey)
    );
    const seenLower = new Set<string>();
    const clean: string[] = [];
    for (const rawCat of categories) {
      const trimmed = normalizeCategoryName(rawCat);
      if (!trimmed) continue;
      const lower = trimmed.toLowerCase();
      if (lower !== defaultKey && catDelSet.has(lower)) continue;
      if (seenLower.has(lower)) continue;
      seenLower.add(lower);
      clean.push(lower === defaultKey ? 'عمومی' : trimmed);
    }
    if (!seenLower.has(defaultKey)) {
      clean.unshift('عمومی');
    }
    localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(clean));
    this.queuePushToServer({
      categories: clean,
      ...(normalizedRevived.length > 0 ? { reviveCategories: normalizedRevived } : {}),
    });
    this.notifyChange();
  },

  reorderCategories(newOrderedCategories: string[]): void {
    this.saveCategories(newOrderedCategories);
  },

  batchAssignCategory(productIds: string[], targetCategory: string): number {
    const cleanCategory = normalizeCategoryName(targetCategory) || 'عمومی';
    const targetKey = cleanCategory.toLowerCase();
    this.unrecordCategoryTombstone(cleanCategory);
    const currentCats = this.getCategories();
    const canonicalCategory =
      currentCats.find((c) => categoryKey(c) === targetKey) || cleanCategory;
    if (!currentCats.some((c) => categoryKey(c) === targetKey)) {
      this.saveCategories([...currentCats, canonicalCategory], [canonicalCategory]);
    }

    const products = this.getProducts();
    const idSet = new Set(productIds);
    let updatedCount = 0;
    const nowShamsi = new Intl.DateTimeFormat('fa-IR-u-nu-latn', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());

    const updatedProducts = products.map((p) => {
      if (idSet.has(p.id) && categoryKey(p.category || 'عمومی') !== targetKey) {
        updatedCount++;
        return { ...p, category: canonicalCategory, updatedAt: nowShamsi };
      }
      return p;
    });

    if (updatedCount > 0) {
      this.saveProducts(updatedProducts);
      this.logActivity({
        category: 'warehouse',
        actionType: 'edit_product',
        actionTitle: 'تغییر گروهی دسته‌بندی کالاها',
        details: `انتقال ${updatedCount} قلم کالا به دسته‌بندی «${canonicalCategory}»`,
        severity: 'info',
        entityType: 'category',
        entityId: canonicalCategory,
        entityLabel: canonicalCategory,
        metadata: { targetCategory: canonicalCategory, updatedCount },
      });
      this.notifyChange();
    }
    return updatedCount;
  },

  batchUpdateProductsAttributes(
    productIds: string[],
    updates: { category?: string; unit?: string; minStockAlert?: number }
  ): number {
    const idSet = new Set(productIds);
    if (idSet.size === 0) return 0;

    let canonicalCat: string | undefined;
    if (updates.category !== undefined) {
      const cleanCat = normalizeCategoryName(updates.category) || 'عمومی';
      this.unrecordCategoryTombstone(cleanCat);
      const currentCats = this.getCategories();
      canonicalCat = currentCats.find((c) => categoryKey(c) === cleanCat.toLowerCase()) || cleanCat;
      if (!currentCats.some((c) => categoryKey(c) === cleanCat.toLowerCase())) {
        this.saveCategories([...currentCats, canonicalCat], [canonicalCat]);
      }
    }

    const products = this.getProducts();
    let updatedCount = 0;
    const nowShamsi = new Intl.DateTimeFormat('fa-IR-u-nu-latn', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());

    const cleanUnit = updates.unit !== undefined ? normalizeCategoryName(updates.unit) : undefined;
    const cleanMinStock =
      updates.minStockAlert !== undefined && !isNaN(updates.minStockAlert)
        ? Math.max(0, Number(updates.minStockAlert))
        : undefined;

    const updatedProducts = products.map((p) => {
      if (!idSet.has(p.id)) return p;
      updatedCount++;
      return {
        ...p,
        ...(canonicalCat !== undefined ? { category: canonicalCat } : {}),
        ...(cleanUnit ? { unit: cleanUnit } : {}),
        ...(cleanMinStock !== undefined ? { minStockAlert: cleanMinStock } : {}),
        updatedAt: nowShamsi,
      };
    });

    if (updatedCount > 0) {
      this.saveProducts(updatedProducts);
      const changedParts: string[] = [];
      if (canonicalCat !== undefined) changedParts.push(`دسته: ${canonicalCat}`);
      if (cleanUnit) changedParts.push(`واحد: ${cleanUnit}`);
      if (cleanMinStock !== undefined) changedParts.push(`حد هشدار: ${cleanMinStock}`);
      this.logActivity({
        category: 'warehouse',
        actionType: 'edit_product',
        actionTitle: 'ویرایش گروهی مشخصات کالاها',
        details: `بروزرسانی ${updatedCount} قلم کالا (${changedParts.join(' • ')})`,
        severity: 'info',
        entityType: 'product',
        entityId: 'batch_update',
        entityLabel: `${updatedCount} کالا`,
        metadata: { updatedCount, category: canonicalCat, unit: cleanUnit, minStockAlert: cleanMinStock },
      });
      this.notifyChange();
    }
    return updatedCount;
  },

  quickSaveProduct(productData: Partial<Product> & { name: string }): Product {
    const cleanName = productData.name.replace(/\s+/g, ' ').trim();
    const cleanCatRaw = normalizeCategoryName(productData.category) || 'عمومی';
    this.unrecordCategoryTombstone(cleanCatRaw);
    const currentCats = this.getCategories();
    const cleanCat =
      currentCats.find((c) => categoryKey(c) === cleanCatRaw.toLowerCase()) || cleanCatRaw;
    if (!currentCats.some((c) => categoryKey(c) === cleanCatRaw.toLowerCase())) {
      this.saveCategories([...currentCats, cleanCat], [cleanCat]);
    }

    const products = this.getProducts();
    const nowShamsi = new Intl.DateTimeFormat('fa-IR-u-nu-latn', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());

    let savedProduct: Product;
    if (productData.id) {
      const idx = products.findIndex((p) => p.id === productData.id);
      if (idx !== -1) {
        const existing = products[idx];
        const hasVars = Boolean(existing.hasVariants && existing.variants && existing.variants.length > 0);
        const oldBuy = Number(existing.buyPrice ?? existing.purchasePrice) || 0;
        const oldSell = Number(existing.sellPrice) || 0;
        const oldWholesale = Number(existing.wholesalePrice) || 0;

        const newBuy =
          productData.buyPrice !== undefined ? Math.max(0, Number(productData.buyPrice) || 0) : oldBuy;
        const newSell =
          productData.sellPrice !== undefined ? Math.max(0, Number(productData.sellPrice) || 0) : oldSell;
        const newWholesale =
          productData.wholesalePrice !== undefined
            ? Math.max(0, Number(productData.wholesalePrice) || 0) || undefined
            : existing.wholesalePrice;

        // Protect variant stock integrity: variant-based products derive stock from their variants
        const newStock = hasVars
          ? (existing.variants || []).reduce((sum, v) => sum + (Number(v.stock) || 0), 0)
          : Math.max(0, Number(productData.stock ?? existing.stock) || 0);

        const prevHistory = Array.isArray(existing.priceHistory) ? [...existing.priceHistory] : [];
        const priceChanged =
          newBuy !== oldBuy || newSell !== oldSell || (newWholesale || 0) !== oldWholesale;
        if (priceChanged && (newBuy > 0 || newSell > 0)) {
          prevHistory.unshift({
            id: `ph_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            date: nowShamsi,
            buyPrice: newBuy,
            sellPrice: newSell,
            wholesalePrice: newWholesale,
            note: 'ویرایش سریع در مرکز مدیریت کالا و دسته‌بندی',
          });
        }

        savedProduct = {
          ...existing,
          ...productData,
          code: (productData.code !== undefined ? productData.code : existing.code || '').trim(),
          name: cleanName,
          category: cleanCat,
          unit: normalizeCategoryName(productData.unit || existing.unit || 'عدد') || 'عدد',
          buyPrice: newBuy,
          purchasePrice: newBuy,
          sellPrice: newSell,
          wholesalePrice: newWholesale,
          stock: newStock,
          minStockAlert: Math.max(0, Number(productData.minStockAlert ?? existing.minStockAlert) || 0),
          priceHistory: prevHistory.slice(0, 30),
          updatedAt: nowShamsi,
        };

        const updatedList = [...products];
        updatedList[idx] = savedProduct;
        this.saveProducts(updatedList);

        // Log kardex stock movement if stock changed for non-variant product
        if (!hasVars && Number(existing.stock) !== newStock) {
          const diff = newStock - (Number(existing.stock) || 0);
          const movements = this.getMovements();
          const adjustMov: StockMovement = {
            id: `mov_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            productId: savedProduct.id,
            productName: savedProduct.name,
            type: 'adjustment',
            quantity: diff,
            remainingStock: newStock,
            date: nowShamsi,
            note: `اصلاح سریع موجودی (قبلی: ${existing.stock}، جدید: ${newStock})`,
          };
          this.saveMovements([adjustMov, ...movements]);
        }

        this.logActivity({
          category: 'warehouse',
          actionType: 'edit_product',
          actionTitle: 'ویرایش سریع مشخصات کالا',
          details: `ویرایش کالای «${savedProduct.name}» (دسته: ${savedProduct.category} • موجودی: ${savedProduct.stock} ${savedProduct.unit} • فروش: ${savedProduct.sellPrice.toLocaleString('fa-IR')})`,
          severity: 'warning',
          entityType: 'product',
          entityId: savedProduct.id,
          entityLabel: `${savedProduct.name} (${savedProduct.code || ''})`,
        });

        this.notifyChange();
        return this.getProducts().find((p) => p.id === savedProduct.id) || savedProduct;
      }
    }

    const initBuy = Math.max(0, Number(productData.buyPrice) || 0);
    const initSell = Math.max(0, Number(productData.sellPrice) || 0);
    const initWholesale = productData.wholesalePrice ? Math.max(0, Number(productData.wholesalePrice)) : undefined;
    const initStock = Math.max(0, Number(productData.stock) || 0);

    savedProduct = {
      id: productData.id || `prod_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      code: (productData.code || '').trim(),
      name: cleanName,
      category: cleanCat,
      unit: normalizeCategoryName(productData.unit || 'عدد') || 'عدد',
      buyPrice: initBuy,
      purchasePrice: initBuy,
      sellPrice: initSell,
      wholesalePrice: initWholesale,
      stock: initStock,
      minStockAlert: Math.max(0, Number(productData.minStockAlert ?? 5) || 0),
      description: productData.description || '',
      priceHistory:
        initBuy > 0 || initSell > 0
          ? [
              {
                id: `ph_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                date: nowShamsi,
                buyPrice: initBuy,
                sellPrice: initSell,
                wholesalePrice: initWholesale,
                note: 'ثبت اولیه در تعریف سریع کالا',
              },
            ]
          : [],
      updatedAt: nowShamsi,
    };

    const updatedList = [savedProduct, ...products];
    this.saveProducts(updatedList);

    if (initStock > 0) {
      const movements = this.getMovements();
      const initialMov: StockMovement = {
        id: `mov_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        productId: savedProduct.id,
        productName: savedProduct.name,
        type: 'purchase',
        quantity: initStock,
        remainingStock: initStock,
        date: nowShamsi,
        note: 'موجودی اولیه هنگام تعریف سریع کالا',
      };
      this.saveMovements([initialMov, ...movements]);
    }

    const finalSaved = this.getProducts().find((p) => p.id === savedProduct.id) || savedProduct;
    this.logActivity({
      category: 'warehouse',
      actionType: 'create_product',
      actionTitle: 'تعریف سریع کالای جدید',
      details: `ثبت کالای جدید «${finalSaved.name}» (کد: ${finalSaved.code || '-'} • دسته: ${finalSaved.category} • موجودی: ${finalSaved.stock} ${finalSaved.unit})`,
      severity: 'info',
      entityType: 'product',
      entityId: finalSaved.id,
      entityLabel: `${finalSaved.name} (${finalSaved.code || ''})`,
    });

    this.notifyChange();
    return finalSaved;
  },

  addCategory(name: string): boolean {
    const clean = normalizeCategoryName(name);
    if (!clean) return false;
    const key = clean.toLowerCase();
    this.unrecordCategoryTombstone(clean);
    const current = this.getCategories();
    if (current.some((c) => categoryKey(c) === key)) return false;
    this.saveCategories([...current, clean], [clean]);
    this.logActivity({
      category: 'warehouse',
      actionType: 'create_category',
      actionTitle: 'تعریف دسته‌بندی کالای جدید',
      details: `ایجاد دسته‌بندی «${clean}» در فهرست دسته‌بندی‌های کالا`,
      severity: 'info',
      entityType: 'category',
      entityId: clean,
      entityLabel: clean,
    });
    return true;
  },

  renameCategory(oldName: string, newName: string, updateProducts = true): boolean {
    const cleanOld = normalizeCategoryName(oldName);
    const cleanNew = normalizeCategoryName(newName);
    const oldKey = cleanOld.toLowerCase();
    const newKey = cleanNew.toLowerCase();
    const defaultKey = categoryKey('عمومی');
    if (!cleanOld || !cleanNew || oldKey === defaultKey || cleanOld === cleanNew) return false;

    // Unrecord newName from tombstones in case it was deleted in the past
    this.unrecordCategoryTombstone(cleanNew);

    const current = this.getCategories();
    const updatedCategories = current.map((c) => (categoryKey(c) === oldKey ? cleanNew : c));
    if (oldKey !== newKey) {
      this.recordTombstone('categories', cleanOld);
    }
    this.saveCategories(updatedCategories, [cleanNew]);

    let updatedCount = 0;
    if (updateProducts) {
      const products = this.getProducts();
      let changed = false;
      const nowShamsi = new Intl.DateTimeFormat('fa-IR-u-nu-latn', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date());
      const updatedProducts = products.map((p) => {
        if (categoryKey(p.category) === oldKey) {
          changed = true;
          updatedCount++;
          return { ...p, category: cleanNew, updatedAt: nowShamsi };
        }
        return p;
      });
      if (changed) {
        this.saveProducts(updatedProducts);
      }
    }
    this.logActivity({
      category: 'warehouse',
      actionType: 'edit_category',
      actionTitle: 'تغییر نام دسته‌بندی کالا',
      details: `تغییر نام دسته‌بندی از «${cleanOld}» به «${cleanNew}»${updateProducts ? ` (${updatedCount} کالا بروزرسانی شد)` : ''}`,
      severity: 'warning',
      entityType: 'category',
      entityId: cleanNew,
      entityLabel: `${cleanOld} -> ${cleanNew}`,
      metadata: {
        oldName: cleanOld,
        newName: cleanNew,
        updatedProductsCount: updatedCount,
      },
    });
    this.notifyChange();
    return true;
  },

  deleteCategory(categoryName: string, reassignTo = 'عمومی'): boolean {
    const clean = normalizeCategoryName(categoryName);
    const cleanKey = clean.toLowerCase();
    const defaultKey = categoryKey('عمومی');
    if (!clean || cleanKey === defaultKey) return false;

    const cleanTargetRaw = normalizeCategoryName(reassignTo) || 'عمومی';
    const targetKey = cleanTargetRaw.toLowerCase();
    if (targetKey === cleanKey) return false;

    this.unrecordCategoryTombstone(cleanTargetRaw);
    this.recordTombstone('categories', clean);

    const current = this.getCategories();
    const canonicalTarget =
      current.find((c) => categoryKey(c) === targetKey) ||
      (targetKey === defaultKey ? 'عمومی' : cleanTargetRaw);
    const filtered = current.filter((c) => categoryKey(c) !== cleanKey);
    if (!filtered.some((c) => categoryKey(c) === targetKey)) {
      filtered.push(canonicalTarget);
    }
    this.saveCategories(filtered, [canonicalTarget]);

    const products = this.getProducts();
    let changed = false;
    let movedProductsCount = 0;
    const nowShamsi = new Intl.DateTimeFormat('fa-IR-u-nu-latn', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
    const updatedProducts = products.map((p) => {
      if (categoryKey(p.category) === cleanKey) {
        changed = true;
        movedProductsCount++;
        return { ...p, category: canonicalTarget, updatedAt: nowShamsi };
      }
      return p;
    });
    if (changed) {
      this.saveProducts(updatedProducts);
    }
    this.logActivity({
      category: 'warehouse',
      actionType: 'delete_category',
      actionTitle: 'حذف دسته‌بندی کالا',
      details: `حذف دسته‌بندی «${clean}» و انتقال ${movedProductsCount} کالا به دسته «${canonicalTarget}»`,
      severity: 'critical',
      entityType: 'category',
      entityId: clean,
      entityLabel: clean,
      metadata: {
        deletedCategory: clean,
        reassignedTo: canonicalTarget,
        movedProductsCount,
      },
    });
    this.notifyChange();
    return true;
  },

  cleanupEmptyCategories(): { removedCount: number; removedCategories: string[] } {
    const defaultKey = categoryKey('عمومی');
    const products = this.getProducts();
    const usedCatKeys = new Set(
      products.map((p) => categoryKey(p.category || 'عمومی')).filter(Boolean)
    );
    usedCatKeys.add(defaultKey);

    const current = this.getCategories();
    const removedCategories: string[] = [];
    const remaining: string[] = [];

    current.forEach((cat) => {
      const trimmed = normalizeCategoryName(cat);
      if (!trimmed) return;
      if (usedCatKeys.has(trimmed.toLowerCase())) {
        remaining.push(trimmed);
      } else {
        removedCategories.push(trimmed);
      }
    });

    if (removedCategories.length > 0) {
      this.recordTombstone('categories', removedCategories);
      this.saveCategories(remaining);
      this.logActivity({
        category: 'warehouse',
        actionType: 'delete_category',
        actionTitle: 'پاکسازی دسته‌بندی‌های خالی',
        details: `حذف ${removedCategories.length} دسته‌بندی بدون کالا: ${removedCategories.join('، ')}`,
        severity: 'warning',
        entityType: 'category',
        entityId: 'cleanup_empty',
        entityLabel: `${removedCategories.length} دسته‌بندی خالی`,
        metadata: { removedCategories },
      });
      this.notifyChange();
    }
    return { removedCount: removedCategories.length, removedCategories };
  },

  normalizeAndDeduplicateCategories(): { fixedProductsCount: number; mergedCategoriesCount: number } {
    const defaultKey = categoryKey('عمومی');
    const products = this.getProducts();
    const rawStored = (() => {
      try {
        const parsed = JSON.parse(localStorage.getItem(STORAGE_KEYS.CATEGORIES) || '[]');
        return Array.isArray(parsed) ? parsed.map((x) => String(x || '')) : this.getCategories();
      } catch {
        return this.getCategories();
      }
    })();

    const canonicalMap = new Map<string, string>();
    let mergedCategoriesCount = 0;
    const cleanCats: string[] = [];
    const removedRawNames: string[] = [];

    rawStored.forEach((raw) => {
      const norm = normalizeCategoryName(raw);
      if (!norm) return;
      const key = norm.toLowerCase();
      const canonicalVal = key === defaultKey ? 'عمومی' : norm;
      if (!canonicalMap.has(key)) {
        canonicalMap.set(key, canonicalVal);
        cleanCats.push(canonicalVal);
        if (raw !== canonicalVal) {
          mergedCategoriesCount++;
          removedRawNames.push(raw);
        }
      } else {
        mergedCategoriesCount++;
        if (raw !== canonicalMap.get(key)) {
          removedRawNames.push(raw);
        }
      }
    });

    if (!canonicalMap.has(defaultKey)) {
      canonicalMap.set(defaultKey, 'عمومی');
      cleanCats.unshift('عمومی');
    }

    let fixedProductsCount = 0;
    const updatedProducts = products.map((p) => {
      const norm = normalizeCategoryName(p.category) || 'عمومی';
      const key = norm.toLowerCase();
      let canonical = canonicalMap.get(key);
      if (!canonical) {
        canonical = key === defaultKey ? 'عمومی' : norm;
        canonicalMap.set(key, canonical);
        cleanCats.push(canonical);
      }
      if (p.category !== canonical) {
        fixedProductsCount++;
        return { ...p, category: canonical };
      }
      return p;
    });

    if (fixedProductsCount > 0) {
      this.saveProducts(updatedProducts);
    }
    if (removedRawNames.length > 0) {
      const staleToTombstone = removedRawNames.filter(
        (r) => !canonicalMap.has(r.trim().toLowerCase()) && categoryKey(r) !== defaultKey
      );
      if (staleToTombstone.length > 0) {
        this.recordTombstone('categories', staleToTombstone);
      }
    }
    this.saveCategories(cleanCats, cleanCats);

    if (fixedProductsCount > 0 || mergedCategoriesCount > 0) {
      this.logActivity({
        category: 'warehouse',
        actionType: 'edit_category',
        actionTitle: 'یکپارچه‌سازی و استانداردسازی دسته‌بندی‌ها',
        details: `استانداردسازی ${fixedProductsCount} کالا و ادغام ${mergedCategoriesCount} عنوان دسته‌بندی تکراری یا غیراستاندارد`,
        severity: 'info',
        entityType: 'category',
        entityId: 'normalize_categories',
        entityLabel: 'یکپارچه‌سازی دسته‌بندی‌ها',
        metadata: { fixedProductsCount, mergedCategoriesCount },
      });
    }

    this.notifyChange();
    return { fixedProductsCount, mergedCategoriesCount };
  },

  /**
   * Batch update prices for products in a category (or all categories via '__ALL__')
   * Supports percentage change, fixed amount change, or setting sellPrice by margin % over buyPrice
   */
  batchRepriceCategory(
    categoryName: string,
    targetPrice: 'sellPrice' | 'buyPrice' | 'wholesalePrice' | 'both',
    valueChange: number,
    roundTo: number = 1000,
    mode: 'percent' | 'fixed_amount' | 'margin_from_buy' = 'percent',
    includeVariants: boolean = true
  ): { count: number; changedCount: number } {
    const products = this.getProducts();
    const isAll = categoryName === '__ALL__';
    const targetCatKey = categoryKey(categoryName);
    const factor = 1 + valueChange / 100;
    let changedCount = 0;
    let categoryProductCount = 0;

    const round = (val: number, step: number) => {
      if (step <= 1) return Math.round(val);
      return Math.round(val / step) * step;
    };

    const nowShamsi = new Intl.DateTimeFormat('fa-IR-u-nu-latn', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());

    const updated = products.map((p) => {
      const pCatKey = categoryKey(p.category || 'عمومی');
      if (isAll || pCatKey === targetCatKey) {
        categoryProductCount++;
        const oldSell = Number(p.sellPrice) || 0;
        const oldBuy = Number(p.buyPrice ?? p.purchasePrice) || 0;
        const oldWholesale = Number(p.wholesalePrice) || 0;

        let newSell = oldSell;
        let newBuy = oldBuy;
        let newWholesale = oldWholesale;

        if (mode === 'margin_from_buy') {
          if (oldBuy > 0) {
            newSell = Math.max(0, round(oldBuy * (1 + valueChange / 100), roundTo));
          }
        } else if (mode === 'fixed_amount') {
          if (targetPrice === 'sellPrice' || targetPrice === 'both') {
            if (oldSell > 0 || valueChange > 0) {
              newSell = Math.max(0, round(oldSell + valueChange, roundTo));
            }
          }
          if (targetPrice === 'buyPrice' || targetPrice === 'both') {
            if (oldBuy > 0 || valueChange > 0) {
              newBuy = Math.max(0, round(oldBuy + valueChange, roundTo));
            }
          }
          if (targetPrice === 'wholesalePrice') {
            if (oldWholesale > 0 || valueChange > 0) {
              newWholesale = Math.max(0, round(oldWholesale + valueChange, roundTo));
            }
          }
        } else {
          // mode === 'percent'
          if (targetPrice === 'sellPrice' || targetPrice === 'both') {
            if (oldSell > 0) {
              newSell = Math.max(0, round(oldSell * factor, roundTo));
            }
          }
          if (targetPrice === 'buyPrice' || targetPrice === 'both') {
            if (oldBuy > 0) {
              newBuy = Math.max(0, round(oldBuy * factor, roundTo));
            }
          }
          if (targetPrice === 'wholesalePrice') {
            if (oldWholesale > 0) {
              newWholesale = Math.max(0, round(oldWholesale * factor, roundTo));
            }
          }
        }

        // Also update variant custom prices if enabled and present
        let variantsChanged = false;
        let nextVariants = p.variants;
        if (includeVariants && p.hasVariants && Array.isArray(p.variants) && p.variants.length > 0 && mode !== 'margin_from_buy') {
          nextVariants = p.variants.map((v) => {
            let vSell = v.sellPrice;
            let vWhole = v.wholesalePrice;
            if ((targetPrice === 'sellPrice' || targetPrice === 'both') && typeof v.sellPrice === 'number' && v.sellPrice > 0) {
              const computed = mode === 'fixed_amount'
                ? Math.max(0, round(v.sellPrice + valueChange, roundTo))
                : Math.max(0, round(v.sellPrice * factor, roundTo));
              if (computed !== v.sellPrice) {
                vSell = computed;
                variantsChanged = true;
              }
            }
            if (targetPrice === 'wholesalePrice' && typeof v.wholesalePrice === 'number' && v.wholesalePrice > 0) {
              const computed = mode === 'fixed_amount'
                ? Math.max(0, round(v.wholesalePrice + valueChange, roundTo))
                : Math.max(0, round(v.wholesalePrice * factor, roundTo));
              if (computed !== v.wholesalePrice) {
                vWhole = computed;
                variantsChanged = true;
              }
            }
            return { ...v, sellPrice: vSell, wholesalePrice: vWhole };
          });
        }

        if (newSell !== oldSell || newBuy !== oldBuy || newWholesale !== oldWholesale || variantsChanged) {
          changedCount++;
          const historyEntry = {
            id: `ph_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            date: nowShamsi,
            buyPrice: newBuy,
            sellPrice: newSell,
            wholesalePrice: newWholesale > 0 ? newWholesale : undefined,
            note:
              mode === 'margin_from_buy'
                ? `تنظیم حاشیه سود (${valueChange}% روی خرید)`
                : mode === 'fixed_amount'
                ? `تعدیل گروهی مبلغ ثابت (${valueChange > 0 ? '+' : ''}${valueChange})`
                : `تعدیل گروهی درصدی (${valueChange > 0 ? '+' : ''}${valueChange}%)`,
          };
          const prevHistory = Array.isArray(p.priceHistory) ? p.priceHistory : [];

          return {
            ...p,
            sellPrice: newSell,
            buyPrice: newBuy,
            purchasePrice: newBuy,
            ...(newWholesale > 0 || p.wholesalePrice !== undefined ? { wholesalePrice: newWholesale } : {}),
            ...(variantsChanged ? { variants: nextVariants } : {}),
            updatedAt: nowShamsi,
            priceHistory: [historyEntry, ...prevHistory].slice(0, 30),
          };
        }
      }
      return p;
    });

    if (changedCount > 0) {
      this.saveProducts(updated);
      const catLabel = isAll ? 'همه دسته‌بندی‌ها' : `دسته «${normalizeCategoryName(categoryName)}»`;
      const targetLabel =
        mode === 'margin_from_buy'
          ? `فروش بر اساس ${valueChange}٪ سود روی خرید`
          : targetPrice === 'sellPrice'
          ? 'قیمت فروش'
          : targetPrice === 'buyPrice'
          ? 'قیمت خرید'
          : targetPrice === 'wholesalePrice'
          ? 'قیمت همکار'
          : 'قیمت خرید و فروش';
      this.logActivity({
        category: 'warehouse',
        actionType: 'edit_product',
        actionTitle: 'تعدیل گروهی قیمت کالاها',
        details: `تعدیل ${targetLabel} برای ${changedCount} از ${categoryProductCount} کالا در ${catLabel} (${mode === 'fixed_amount' ? `${valueChange > 0 ? '+' : ''}${valueChange}` : `${valueChange > 0 ? '+' : ''}${valueChange}%`})`,
        severity: 'warning',
        entityType: 'category',
        entityId: isAll ? '__ALL__' : normalizeCategoryName(categoryName),
        entityLabel: catLabel,
        metadata: { categoryName, targetPrice, valueChange, roundTo, mode, changedCount, count: categoryProductCount },
      });
      this.notifyChange();
    }
    return { count: categoryProductCount, changedCount };
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
    transactions: CustomerTransaction[],
    purchaseInvoices?: PurchaseInvoice[]
  ): {
    entries: CustomerLedgerEntry[];
    totalDebit: number;
    totalCredit: number;
    netBalance: number;
    balanceStatus: 'debtor' | 'settled' | 'creditor';
    unpaidInvoicesCount: number;
  } {
    const rawEntries: Omit<CustomerLedgerEntry, 'balance' | 'balanceStatus'>[] = [];

    // 0. Map product IDs to their recorded inbound/purchase suppliers
    const productSuppliersMap = new Map<string, Set<string>>();
    try {
      const inbounds = StorageService.getInboundReceipts();
      inbounds.forEach((rec) => {
        if (rec.supplierName && rec.supplierName.trim()) {
          rec.items.forEach((it) => {
            if (it.productId) {
              if (!productSuppliersMap.has(it.productId)) {
                productSuppliersMap.set(it.productId, new Set());
              }
              productSuppliersMap.get(it.productId)!.add(rec.supplierName.trim());
            }
          });
        }
      });
      const purchases = StorageService.getPurchaseInvoices();
      purchases.forEach((pur) => {
        if (pur.supplierName && pur.supplierName.trim()) {
          pur.items.forEach((it) => {
            if (it.productId) {
              if (!productSuppliersMap.has(it.productId)) {
                productSuppliersMap.set(it.productId, new Set());
              }
              productSuppliersMap.get(it.productId)!.add(pur.supplierName.trim());
            }
          });
        }
      });
    } catch {
      // Ignore if storage retrieval fails in isolated tests
    }

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

      // Collect suppliers for items in this invoice
      const suppliersSet = new Set<string>();
      inv.items.forEach((it) => {
        if ((it as any).supplierName && (it as any).supplierName.trim()) {
          suppliersSet.add((it as any).supplierName.trim());
        }
        if (it.productId && productSuppliersMap.has(it.productId)) {
          productSuppliersMap.get(it.productId)!.forEach((s) => suppliersSet.add(s));
        }
      });
      const supplierNames = Array.from(suppliersSet);

      // Detect service items vs product items
      const isItemService = (it: InvoiceItem) =>
        Boolean(
          it.isService ||
          it.itemType === 'service' ||
          it.id?.startsWith('service-') ||
          (it.productCode || it.code || '').toUpperCase().startsWith('SRV-') ||
          !it.productId
        );

      const serviceItems = inv.items.filter(isItemService);
      const productItems = inv.items.filter((it) => !isItemService(it));
      const hasServices = serviceItems.length > 0;
      const isOnlyServices = hasServices && productItems.length === 0;
      const serviceTitles = serviceItems
        .map((s) => (s.productName || s.name || '').trim())
        .filter(Boolean)
        .join('، ');

      let docLabel = inv.type === 'official' ? 'فاکتور رسمی فروش' : 'فاکتور فروش';
      let invDescription = `خرید کالا طبق فاکتور شماره ${inv.invoiceNumber} (${inv.items.length} قلم)${inv.notes ? ` - ${inv.notes}` : ''}`;

      if (isOnlyServices) {
        docLabel = inv.type === 'official' ? 'فاکتور رسمی خدماتی' : 'فاکتور خدماتی';
        invDescription = `فاکتور خدماتی شماره ${inv.invoiceNumber} (${serviceItems.length} مورد خدمات${serviceTitles ? `: ${serviceTitles}` : ''})${inv.notes ? ` - ${inv.notes}` : ''}`;
      } else if (hasServices) {
        docLabel = inv.type === 'official' ? 'فاکتور رسمی فروش و خدمات' : 'فاکتور فروش و خدمات';
        invDescription = `فاکتور فروش و خدمات شماره ${inv.invoiceNumber} (${productItems.length} قلم کالا و ${serviceItems.length} مورد خدمات${serviceTitles ? `: ${serviceTitles}` : ''})${inv.notes ? ` - ${inv.notes}` : ''}`;
      }

      // 1.1 Debit entry for the full invoice amount
      rawEntries.push({
        id: `inv-deb-${inv.id}`,
        date: inv.date,
        documentNumber: inv.invoiceNumber,
        documentType: 'invoice',
        documentTypeLabel: docLabel,
        description: invDescription,
        debit: inv.finalTotal,
        credit: 0,
        paymentMethod: inv.paymentMethod ? PAYMENT_METHOD_LABELS[inv.paymentMethod] || inv.paymentMethod : undefined,
        notes: inv.notes,
        rawInvoice: inv,
        supplierNames: supplierNames.length > 0 ? supplierNames : undefined,
      });

      // 1.2 Credit entry if payment occurred at invoice issuance
      if (inv.paidAmount && inv.paidAmount > 0) {
        const payDocTarget = isOnlyServices
          ? `فاکتور خدماتی شماره ${inv.invoiceNumber}`
          : hasServices
          ? `فاکتور فروش و خدمات شماره ${inv.invoiceNumber}`
          : `فاکتور شماره ${inv.invoiceNumber}`;
        rawEntries.push({
          id: `inv-pay-${inv.id}`,
          date: inv.date,
          documentNumber: inv.invoiceNumber,
          documentType: 'invoice_payment',
          documentTypeLabel: 'واریز همزمان با فاکتور',
          description: `پرداخت وجه همزمان با صدور ${payDocTarget}${inv.paymentMethod ? ` [${PAYMENT_METHOD_LABELS[inv.paymentMethod] || inv.paymentMethod}]` : ''}${inv.transferDescription ? ` (${inv.transferDescription})` : ''}`,
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
          documentTypeLabel: 'واریز',
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

    // 2.5. Process all purchase invoices where this customer/party is the supplier/vendor
    const allPurchases = purchaseInvoices || StorageService.getPurchaseInvoices();
    const customerPurchases = allPurchases.filter((pur) => {
      return (
        pur.supplierName &&
        pur.supplierName.trim().toLowerCase() === customer.name.trim().toLowerCase()
      );
    });

    customerPurchases.forEach((pur) => {
      const remainingOnPur = Math.max(0, pur.finalTotal - (pur.paidAmount || 0));
      if (remainingOnPur > 0) {
        unpaidInvoicesCount++;
      }

      const isPurItemService = (it: any) =>
        Boolean(
          it.isService ||
          it.itemType === 'service' ||
          it.id?.startsWith('service-') ||
          it.id?.startsWith('pur-srv-') ||
          (it.productCode || '').toUpperCase().startsWith('SRV-') ||
          !it.productId ||
          it.productId.startsWith('service-')
        );

      const purServiceItems = (pur.items || []).filter(isPurItemService);
      const purProductItems = (pur.items || []).filter((it) => !isPurItemService(it));
      const hasPurServices = purServiceItems.length > 0 || Boolean(pur.isServiceOnly);
      const isOnlyPurServices = Boolean(pur.isServiceOnly) || (hasPurServices && purProductItems.length === 0);
      const purServiceTitles = purServiceItems
        .map((s) => (s.productName || '').trim())
        .filter(Boolean)
        .join('، ');

      let purDocLabel = 'فاکتور خرید کالا';
      let purDescription = `خرید کالا از طرف‌حساب طبق فاکتور خرید شماره ${pur.invoiceNumber} (${pur.items.length} قلم کالا)${pur.notes ? ` - ${pur.notes}` : ''}`;

      if (isOnlyPurServices) {
        purDocLabel = 'فاکتور خرید خدمات';
        purDescription = `خرید خدمات / هزینه خدمات طبق فاکتور شماره ${pur.invoiceNumber} (${purServiceItems.length} مورد خدمات${purServiceTitles ? `: ${purServiceTitles}` : ''})${pur.notes ? ` - ${pur.notes}` : ''}`;
      } else if (hasPurServices) {
        purDocLabel = 'فاکتور خرید کالا و خدمات';
        purDescription = `خرید کالا و خدمات طبق فاکتور شماره ${pur.invoiceNumber} (${purProductItems.length} قلم کالا و ${purServiceItems.length} مورد خدمات${purServiceTitles ? `: ${purServiceTitles}` : ''})${pur.notes ? ` - ${pur.notes}` : ''}`;
      }

      // 2.5.1 Credit entry for the full purchase invoice amount (طرف‌حساب/تامین‌کننده بستانکار و طلبکار از ما می‌شود)
      rawEntries.push({
        id: `pur-cred-${pur.id}`,
        date: pur.date,
        documentNumber: pur.invoiceNumber,
        documentType: 'purchase_invoice',
        documentTypeLabel: purDocLabel,
        description: purDescription,
        debit: 0,
        credit: pur.finalTotal, // تامین‌کننده بستانکار (طلبکار از ما) می‌شود
        paymentMethod: pur.paymentMethod ? PAYMENT_METHOD_LABELS[pur.paymentMethod] || pur.paymentMethod : undefined,
        notes: pur.notes,
        rawPurchaseInvoice: pur,
      });

      // 2.5.2 Debit entry if payment occurred at invoice issuance (پرداخت وجه به تامین‌کننده که طلب ایشان را کاهش می‌دهد)
      if (pur.paidAmount && pur.paidAmount > 0) {
        const payDocLabel = isOnlyPurServices
          ? 'پرداخت هزینه خدمات'
          : hasPurServices
          ? 'پرداخت وجه خرید و خدمات'
          : 'پرداخت وجه فاکتور خرید';
        const payDescPrefix = isOnlyPurServices
          ? `پرداخت هزینه خدمات بابت فاکتور شماره ${pur.invoiceNumber}${purServiceTitles ? ` (${purServiceTitles})` : ''}`
          : `پرداخت وجه بابت فاکتور خرید شماره ${pur.invoiceNumber}`;

        rawEntries.push({
          id: `pur-pay-${pur.id}`,
          date: pur.date,
          documentNumber: pur.invoiceNumber,
          documentType: 'purchase_payment',
          documentTypeLabel: payDocLabel,
          description: `${payDescPrefix}${pur.paymentMethod ? ` [${PAYMENT_METHOD_LABELS[pur.paymentMethod] || pur.paymentMethod}]` : ''}${pur.transferDescription ? ` (${pur.transferDescription})` : ''}`,
          debit: pur.paidAmount, // بدهکار کردن حساب طرف‌حساب (کاهش طلب ایشان)
          credit: 0,
          paymentMethod: pur.paymentMethod ? PAYMENT_METHOD_LABELS[pur.paymentMethod] || pur.paymentMethod : undefined,
          trackingNumber: pur.chequeNumber || undefined,
          notes: pur.transferDescription || pur.notes,
          rawPurchaseInvoice: pur,
        });
      }
    });

    // 3. Chronological sorting
    rawEntries.sort((a, b) => {
      const cmp = a.date.localeCompare(b.date);
      if (cmp !== 0) return cmp;
      
      // On the same date, invoice/purchase_invoice should appear before payment
      const isBaseDocA = a.documentType === 'invoice' || a.documentType === 'purchase_invoice';
      const isBaseDocB = b.documentType === 'invoice' || b.documentType === 'purchase_invoice';
      if (isBaseDocA && !isBaseDocB) return -1;
      if (!isBaseDocA && isBaseDocB) return 1;

      // Otherwise if one is debit and one credit
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

  updateInvoice(updatedInvoice: Invoice) {
    const invoices = this.getInvoices();
    const index = invoices.findIndex((inv) => inv.id === updatedInvoice.id);
    let next: Invoice[];
    if (index >= 0) {
      next = [...invoices];
      next[index] = updatedInvoice;
    } else {
      next = [updatedInvoice, ...invoices];
    }
    this.saveInvoices(next);
    this.notifyChange();
  },

  deleteInvoice(invoiceId: string) {
    this.markInvoiceDeleted(invoiceId);
    this.deleteExitSlipLog(invoiceId);
    const invoices = this.getInvoices();
    const filtered = invoices.filter((inv) => inv.id !== invoiceId);
    this.saveInvoices(filtered);
    this.notifyChange();
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
      includeCustomerStatement?: boolean;
      regenerateToken?: boolean;
    }
  ): Promise<{ success: boolean; invoice?: Invoice; shareLink?: InvoiceShareLink; fullUrl?: string; message?: string }> {
    const invoices = this.getInvoices();
    const customers = this.getCustomers();
    const isCustomerPortalId = invoiceId.startsWith('cust-portal-');
    const rawCustomerId = isCustomerPortalId ? invoiceId.replace('cust-portal-', '') : invoiceId;

    const targetIdx = invoices.findIndex((i) => i.id === invoiceId);
    const custIdx = targetIdx === -1 ? customers.findIndex((c) => c.id === rawCustomerId) : -1;

    if (targetIdx === -1 && custIdx === -1) {
      return { success: false, message: 'فاکتور یا مشتری مورد نظر یافت نشد.' };
    }

    const prevLink = targetIdx !== -1 ? invoices[targetIdx].shareLink : customers[custIdx].shareLink;
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
      includeCustomerStatement: options?.includeCustomerStatement !== undefined ? options.includeCustomerStatement : (prevLink?.includeCustomerStatement !== false),
    };

    let updatedInvoice: Invoice;
    if (targetIdx !== -1) {
      const currentInvoice = invoices[targetIdx];
      updatedInvoice = {
        ...currentInvoice,
        shareLink,
        updatedAt: getCurrentJalaliDate(),
      };
      invoices[targetIdx] = updatedInvoice;
      this.saveInvoices(invoices);
    } else {
      const cust = customers[custIdx];
      const updatedCustomer: Customer = {
        ...cust,
        shareLink,
      };
      customers[custIdx] = updatedCustomer;
      this.saveCustomers(customers);
      updatedInvoice = {
        id: `cust-portal-${cust.id}`,
        invoiceNumber: 'صورتحساب',
        type: 'standard',
        customerId: cust.id,
        customerName: cust.name,
        customerPhone: cust.phone || '',
        customerAddress: cust.address || '',
        customerNationalId: cust.nationalId || '',
        date: cust.createdAt || getCurrentJalaliDate(),
        items: [],
        subtotal: 0,
        totalDiscount: 0,
        taxRate: 0,
        taxAmount: 0,
        finalTotal: 0,
        paidAmount: 0,
        paymentStatus: 'paid',
        paymentMethod: 'cash',
        notes: cust.notes || '',
        createdAt: cust.createdAt || getCurrentJalaliDate(),
        shareLink,
      };
    }
    this.notifyChange();

    // Call server API for centralized backend sync
    try {
      const res = await apiFetch(`/api/invoices/${encodeURIComponent(invoiceId)}/share-link`, {
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
          if (targetIdx !== -1) {
            invoices[targetIdx] = updatedInvoice;
            this.saveInvoices(invoices);
          } else if (custIdx !== -1) {
            customers[custIdx] = { ...customers[custIdx], shareLink: json.shareLink };
            this.saveCustomers(customers);
          }
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
      await apiFetch(`/api/invoices/${encodeURIComponent(invoiceId)}/share-link`, {
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
      const res = await apiFetch(`/api/public/invoice/${encodeURIComponent(token.trim())}${pinParam}`);
      const data = await res.json();
      return data;
    } catch (err: any) {
      // Local fallback if running completely offline/client-only
      const localInvoices = this.getInvoices();
      const localCustomers = this.getCustomers();
      const foundInv = localInvoices.find((i) => i?.shareLink?.token === token);
      const foundCust = !foundInv ? localCustomers.find((c) => c?.shareLink?.token === token) : undefined;
      const match: Invoice | undefined = foundInv || (foundCust ? {
        id: `cust-portal-${foundCust.id}`,
        invoiceNumber: 'صورتحساب',
        type: 'standard',
        customerId: foundCust.id,
        customerName: foundCust.name,
        customerPhone: foundCust.phone || '',
        customerAddress: foundCust.address || '',
        customerNationalId: foundCust.nationalId || '',
        date: foundCust.createdAt || getCurrentJalaliDate(),
        items: [],
        subtotal: 0,
        totalDiscount: 0,
        taxRate: 0,
        taxAmount: 0,
        finalTotal: 0,
        paidAmount: 0,
        paymentStatus: 'paid',
        paymentMethod: 'cash',
        notes: foundCust.notes || '',
        createdAt: foundCust.createdAt || getCurrentJalaliDate(),
        shareLink: foundCust.shareLink,
      } : undefined);
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

        const builtLedger = this.buildCustomerLedger(
          {
            id: match.customerId || 'cust-public',
            name: match.customerName,
            phone: match.customerPhone || '',
            address: match.customerAddress || '',
            nationalId: match.customerNationalId || '',
            createdAt: match.date,
          },
          localInvoices,
          localTxns,
          this.getPurchaseInvoices()
        );

        const nonProformas = customerInvoices.filter((inv) => !inv.isProforma);
        const totalPurchases = nonProformas.reduce((sum, inv) => sum + (inv.finalTotal || 0), 0);

        const customerLedger: PublicCustomerLedger = {
          customerName: match.customerName,
          customerPhone: match.customerPhone,
          customerAddress: match.customerAddress,
          customerNationalId: match.customerNationalId,
          totalInvoicesCount: customerInvoices.length,
          unpaidInvoicesCount: builtLedger.unpaidInvoicesCount,
          totalPurchases,
          totalDebit: builtLedger.totalDebit,
          totalPaid: builtLedger.totalCredit,
          totalCredit: builtLedger.totalCredit,
          balance: builtLedger.netBalance,
          balanceStatus: builtLedger.balanceStatus,
          entries: match.shareLink.includeCustomerStatement !== false
            ? builtLedger.entries.map((e) => ({
                id: e.id,
                date: e.date,
                documentNumber: e.documentNumber,
                documentType: e.documentType,
                documentTypeLabel: e.documentTypeLabel,
                description: e.description,
                debit: e.debit,
                credit: e.credit,
                balance: e.balance,
                balanceStatus: e.balanceStatus,
                paymentMethod: e.paymentMethod,
                trackingNumber: e.trackingNumber,
                notes: e.notes,
                invoiceId: e.rawInvoice?.id,
              }))
            : [],
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
    const existingProduct = idx >= 0 ? products[idx] : undefined;

    // ثبت خودکار تاریخچه تغییر قیمت خرید در طول زمان
    const existingHistory = Array.isArray(toSave.priceHistory)
      ? [...toSave.priceHistory]
      : Array.isArray(existingProduct?.priceHistory)
      ? [...existingProduct.priceHistory]
      : [];

    if (toSave.buyPrice > 0) {
      if (!existingProduct) {
        if (existingHistory.length === 0) {
          existingHistory.push({
            id: `ph-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            date: toSave.updatedAt || getCurrentJalaliDate(),
            buyPrice: toSave.buyPrice,
            sellPrice: toSave.sellPrice,
            wholesalePrice: toSave.wholesalePrice,
            note: 'ثبت اولیه قیمت خرید کالا',
          });
        }
      } else if (existingProduct.buyPrice !== toSave.buyPrice) {
        // اگر تاریخچه قبلی خالی بود، قیمت قبلی را هم به عنوان نقطه شروع ثبت کن
        if (existingHistory.length === 0 && existingProduct.buyPrice > 0) {
          existingHistory.push({
            id: `ph-prev-${Date.now()}`,
            date: existingProduct.updatedAt || getCurrentJalaliDate(),
            buyPrice: existingProduct.buyPrice,
            sellPrice: existingProduct.sellPrice,
            wholesalePrice: existingProduct.wholesalePrice,
            note: 'قیمت خرید قبلی',
          });
        }
        existingHistory.push({
          id: `ph-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          date: getCurrentJalaliDate(),
          buyPrice: toSave.buyPrice,
          sellPrice: toSave.sellPrice,
          wholesalePrice: toSave.wholesalePrice,
          note: 'ویرایش و بروزرسانی قیمت خرید کالا',
        });
      }
    }
    toSave.priceHistory = existingHistory;

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
      if (merged.officialTaxPercent === undefined) {
        merged.officialTaxPercent = merged.taxPercent !== undefined ? merged.taxPercent : 10;
      }
      if (merged.autoApplyOfficialTax === undefined) {
        merged.autoApplyOfficialTax = true;
      }
      if (!merged.telegramApiUrl) {
        merged.telegramApiUrl = 'https://api.telegram.org';
      }
      merged.printLayout = {
        ...DEFAULT_PRINT_LAYOUT,
        ...(merged.printLayout || {}),
      };
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
      updatedAt: new Date().toISOString(),
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

  // -------------------------------------------------------------
  // PRINT & PDF EXPORT PREFERENCES PERSISTENCE
  // ماندگاری آخرین وضعیت تنظیمات چاپ و خروجی PDF در فاکتورها و حواله‌های خروج
  // -------------------------------------------------------------
  getInvoicePrintPreferences(): InvoicePrintPreferences {
    const settings = this.getSettings();
    let template: 'standard' | 'official' | 'thermal' | 'simple' = settings.defaultTemplate || 'standard';
    let pageSize: 'a4' | 'a5' = 'a4';
    let orientation: 'portrait' | 'landscape' = 'portrait';

    try {
      const raw = localStorage.getItem(STORAGE_KEYS.INVOICE_PRINT_PREFERENCES);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          if (parsed.template) template = parsed.template;
          if (parsed.pageSize) pageSize = parsed.pageSize;
          if (parsed.orientation) orientation = parsed.orientation;
        }
      } else {
        const legTpl = localStorage.getItem('sepehr_last_view_template');
        if (legTpl === 'standard' || legTpl === 'official' || legTpl === 'thermal' || legTpl === 'simple') {
          template = legTpl;
        }
        const legSize = localStorage.getItem('invoice_paper_size');
        if (legSize === 'a4' || legSize === 'a5') pageSize = legSize;
        const legOrient = localStorage.getItem('invoice_orientation');
        if (legOrient === 'portrait' || legOrient === 'landscape') orientation = legOrient;
      }
    } catch {}

    return { template, pageSize, orientation };
  },

  saveInvoicePrintPreferences(prefs: Partial<InvoicePrintPreferences>): void {
    try {
      const current = this.getInvoicePrintPreferences();
      const updated: InvoicePrintPreferences = { ...current, ...prefs };
      localStorage.setItem(STORAGE_KEYS.INVOICE_PRINT_PREFERENCES, JSON.stringify(updated));
      if (prefs.template) localStorage.setItem('sepehr_last_view_template', prefs.template);
      if (prefs.pageSize) localStorage.setItem('invoice_paper_size', prefs.pageSize);
      if (prefs.orientation) localStorage.setItem('invoice_orientation', prefs.orientation);
    } catch (e) {
      console.warn('Failed to save invoice print preferences:', e);
    }
  },

  getExitSlipPrintPreferences(): ExitSlipPrintPreferences {
    const settings = this.getSettings();
    let template: 'standard' | 'simple' = settings.defaultExitSlipTemplate || 'standard';
    let pageSize: 'a4' | 'a5' = 'a4';
    let orientation: 'portrait' | 'landscape' = 'portrait';
    let printLayout: PrintLayoutSettings = settings.printLayout || DEFAULT_PRINT_LAYOUT;

    try {
      const raw = localStorage.getItem(STORAGE_KEYS.EXIT_SLIP_PRINT_PREFERENCES);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          if (parsed.template) template = parsed.template;
          if (parsed.pageSize) pageSize = parsed.pageSize;
          if (parsed.orientation) orientation = parsed.orientation;
          if (parsed.printLayout) printLayout = { ...DEFAULT_PRINT_LAYOUT, ...parsed.printLayout };
        }
      } else {
        const legTpl = localStorage.getItem('exit_slip_template');
        if (legTpl === 'standard' || legTpl === 'simple') template = legTpl;
        const legSize = localStorage.getItem('exit_slip_paper_size');
        if (legSize === 'a4' || legSize === 'a5') pageSize = legSize;
        const legOrient = localStorage.getItem('exit_slip_orientation');
        if (legOrient === 'portrait' || legOrient === 'landscape') orientation = legOrient;
        const legLayout = localStorage.getItem('exit_slip_print_layout');
        if (legLayout) {
          try {
            printLayout = { ...DEFAULT_PRINT_LAYOUT, ...JSON.parse(legLayout) };
          } catch {}
        }
      }
    } catch {}

    return { template, pageSize, orientation, printLayout };
  },

  saveExitSlipPrintPreferences(prefs: Partial<ExitSlipPrintPreferences>): void {
    try {
      const current = this.getExitSlipPrintPreferences();
      const updated: ExitSlipPrintPreferences = { ...current, ...prefs };
      localStorage.setItem(STORAGE_KEYS.EXIT_SLIP_PRINT_PREFERENCES, JSON.stringify(updated));
      if (prefs.template) localStorage.setItem('exit_slip_template', prefs.template);
      if (prefs.pageSize) localStorage.setItem('exit_slip_paper_size', prefs.pageSize);
      if (prefs.orientation) localStorage.setItem('exit_slip_orientation', prefs.orientation);
      if (prefs.printLayout) localStorage.setItem('exit_slip_print_layout', JSON.stringify(prefs.printLayout));
    } catch (e) {
      console.warn('Failed to save exit slip print preferences:', e);
    }
  },

  getExportModalPreferences(): ExportModalPreferences {
    let pdfOrientation: 'landscape' | 'portrait' = 'landscape';
    let activePreviewTab: 'items' | 'invoices' | 'slips' = 'items';
    let docTypeFilter: 'all' | 'regular' | 'proforma' = 'all';
    let deliveryFilter: 'all' | 'delivered' | 'pending' = 'all';
    let reportType: 'exit_slips' | 'invoices' = 'exit_slips';
    let itemTypeFilter: 'all' | 'products' | 'services' = 'all';
    let selectedItemFilter: string = 'all';

    try {
      const raw = localStorage.getItem(STORAGE_KEYS.EXPORT_MODAL_PREFERENCES);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          if (parsed.pdfOrientation) pdfOrientation = parsed.pdfOrientation;
          if (parsed.activePreviewTab) activePreviewTab = parsed.activePreviewTab;
          if (parsed.docTypeFilter) docTypeFilter = parsed.docTypeFilter;
          if (parsed.deliveryFilter) deliveryFilter = parsed.deliveryFilter;
          if (parsed.reportType) reportType = parsed.reportType;
          if (parsed.itemTypeFilter) itemTypeFilter = parsed.itemTypeFilter;
          if (parsed.selectedItemFilter) selectedItemFilter = parsed.selectedItemFilter;
        }
      }
    } catch {}

    return { pdfOrientation, activePreviewTab, docTypeFilter, deliveryFilter, reportType, itemTypeFilter, selectedItemFilter };
  },

  saveExportModalPreferences(prefs: Partial<ExportModalPreferences>): void {
    try {
      const current = this.getExportModalPreferences();
      const updated: ExportModalPreferences = { ...current, ...prefs };
      localStorage.setItem(STORAGE_KEYS.EXPORT_MODAL_PREFERENCES, JSON.stringify(updated));
    } catch (e) {
      console.warn('Failed to save export modal preferences:', e);
    }
  },

  getUsers(): AppUser[] {
    const data = localStorage.getItem(STORAGE_KEYS.USERS);
    const tombstones = this.getDeletedTombstones();
    const userDelSet = new Set(tombstones.users || []);

    const sanitizeInitial = () =>
      initialUsers
        .filter((u) => !userDelSet.has(u.id))
        .map(({ password: _p, pin: _pin, ...u }) => ({ ...u, hasPassword: true }));

    if (!data) {
      const clean = sanitizeInitial();
      safeLocalStorageSet(STORAGE_KEYS.USERS, JSON.stringify(clean));
      return clean;
    }
    try {
      const users: AppUser[] = JSON.parse(data);
      if (!Array.isArray(users) || users.length === 0) {
        const clean = sanitizeInitial();
        safeLocalStorageSet(STORAGE_KEYS.USERS, JSON.stringify(clean));
        return clean;
      }
      // Ensure all users have valid unique IDs and exclude deleted users
      // IMPORTANT: Never fabricate default passwords or push to server from a read getter!
      const seenIds = new Set<string>();
      let needsLocalRepair = false;
      const sanitized: AppUser[] = users
        .filter((u) => !userDelSet.has(u.id))
        .map((u, idx): AppUser => {
        let validId = u.id && u.id.trim() ? u.id.trim() : `user-migrated-${idx}-${Date.now()}`;
        if (seenIds.has(validId)) {
          validId = `${validId}-${idx}`;
          needsLocalRepair = true;
        }
        if (!u.id) {
          needsLocalRepair = true;
        }
        seenIds.add(validId);
        const normalizedPerms = normalizeUserPermissions(u.role, u.permissions);
        if (
          !u.permissions ||
          u.permissions.canCreatePurchaseInvoice === undefined ||
          u.permissions.canViewPurchaseInvoices === undefined ||
          u.permissions.canSettleInvoices === undefined ||
          (u.role === 'accountant' && (u.permissions.canCreatePurchaseInvoice || u.permissions.canCreateInvoice))
        ) {
          needsLocalRepair = true;
        }
        const { password: _rawPass, pin: _rawPin, ...restUser } = u;
        if (_rawPass || _rawPin) {
          needsLocalRepair = true;
        }
        return {
          ...restUser,
          id: validId,
          fullName: u.fullName || u.name || u.username,
          name: u.fullName || u.name || u.username,
          hasPassword: Boolean(u.hasPassword || _rawPass || _rawPin),
          permissions: normalizedPerms,
        };
      });

      if (needsLocalRepair) {
        safeLocalStorageSet(STORAGE_KEYS.USERS, JSON.stringify(sanitized));
      }
      return sanitized;
    } catch {
      return initialUsers.filter((u) => !userDelSet.has(u.id)).map(({ password: _p, pin: _pin, ...u }) => ({
        ...u,
        hasPassword: true,
      }));
    }
  },

  saveUsers(users: AppUser[]) {
    // Store sanitized users (no plaintext password/pin) locally so secrets never linger or get re-pushed
    const sanitizedLocal: AppUser[] = users.map((u) => {
      const { password, pin, ...safe } = u;
      return {
        ...safe,
        hasPassword: Boolean(u.hasPassword || password || pin),
      };
    });
    safeLocalStorageSet(STORAGE_KEYS.USERS, JSON.stringify(sanitizedLocal));
    // Push payload containing ONLY the explicitly edited password/pin (if any) to the server for scrypt hashing
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
      name: userData.fullName || userData.name,
      permissions: normalizeUserPermissions(userData.role, userData.permissions),
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
      users[idx] = {
        ...updated,
        name: updated.fullName || updated.name,
        permissions: normalizeUserPermissions(updated.role, updated.permissions),
      };
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
    const products = this.getProducts();
    const invoices = this.getInvoices().filter((i) => !i.isProforma && !isPureServiceInvoice(i, products));
    return generateNextExitSlipNumber(logs, invoices);
  },

  getOrAssignExitSlipNumber(invoiceId: string, invoiceNumber?: string): string {
    const invoices = this.getInvoices();
    const targetInv = invoices.find((i) => i.id === invoiceId);
    const products = this.getProducts();

    // برای پیش‌فاکتورها و همچنین ثبت خدمات (فاکتورهای صرفاً خدماتی فاقد کالای فیزیکی)، به هیچ عنوان حواله خروج تولید نمی‌شود
    if (!targetInv || targetInv.isProforma || isPureServiceInvoice(targetInv, products)) {
      const logs = this.getExitSlipLogs();
      if (logs[invoiceId]) {
        this.deleteExitSlipLog(invoiceId);
      }
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

    this.logActivity({
      category: 'warehouse',
      actionType: deliveryData.isDelivered ? 'exit_slip_delivered' : 'exit_slip_updated',
      actionTitle: deliveryData.isDelivered ? 'تایید خروج و تحویل حواله انبار' : 'بروزرسانی اطلاعات حواله خروج',
      details: `${deliveryData.isDelivered ? 'تایید تحویل' : 'ثبت وضعیت'} حواله خروج ${updated.slipNumber || '-'} مربوط به فاکتور ${targetInv?.invoiceNumber || invoiceId} (${targetInv?.customerName || 'مشتری'}) — تحویل‌گیرنده: ${deliveryData.receiverName || 'نامشخص'}${deliveryData.vehicleInfo ? ` | خودرو: ${deliveryData.vehicleInfo}` : ''}`,
      severity: deliveryData.isDelivered ? 'info' : 'warning',
      entityType: 'invoice',
      entityId: invoiceId,
      entityLabel: updated.slipNumber || targetInv?.invoiceNumber || invoiceId,
      metadata: {
        slipNumber: updated.slipNumber || null,
        invoiceNumber: targetInv?.invoiceNumber || null,
        isDelivered: Boolean(deliveryData.isDelivered),
        receiverName: deliveryData.receiverName || null,
        receiverPhone: deliveryData.receiverPhone || null,
        vehicleInfo: deliveryData.vehicleInfo || null,
        deliveredBy: deliveryData.deliveredBy || null,
        deliveredAt: deliveryData.deliveredAt || null,
      },
    });

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
    this.logActivity({
      category: 'warehouse',
      actionType: existingIdx !== -1 ? 'edit_vehicle' : 'create_vehicle',
      actionTitle: existingIdx !== -1 ? 'ویرایش مشخصات خودرو ناوگان' : 'ثبت خودرو جدید در ناوگان',
      details: `${existingIdx !== -1 ? 'ویرایش' : 'ثبت'} خودرو «${savedVehicle.vehicleInfo}»${savedVehicle.driverName ? ` — راننده: ${savedVehicle.driverName}` : ''}${savedVehicle.plateNumber ? ` — پلاک: ${savedVehicle.plateNumber}` : ''}`,
      severity: existingIdx !== -1 ? 'warning' : 'info',
      entityType: 'vehicle',
      entityId: savedVehicle.id,
      entityLabel: savedVehicle.vehicleInfo || savedVehicle.plateNumber || savedVehicle.id,
      metadata: {
        vehicleType: savedVehicle.vehicleType || null,
        driverName: savedVehicle.driverName || null,
        driverPhone: savedVehicle.driverPhone || null,
        plateNumber: savedVehicle.plateNumber || null,
      },
    });
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
    const removed = list.find((v) => v && ((cleanId && v.id === cleanId) || (targetInfo && String(v.vehicleInfo || '').trim().toLowerCase() === targetInfo)));
    const updated = list.filter((v) => {
      if (!v) return false;
      if (cleanId && v.id === cleanId) return false;
      const vInfo = String(v.vehicleInfo || '').trim().toLowerCase();
      if (targetInfo && vInfo === targetInfo) return false;
      return true;
    });

    this.saveSavedVehicles(updated);
    this.logActivity({
      category: 'warehouse',
      actionType: 'delete_vehicle',
      actionTitle: 'حذف خودرو از ناوگان',
      details: `حذف خودرو «${removed?.vehicleInfo || vehicleInfo || cleanId}» از فهرست ناوگان تحویل`,
      severity: 'critical',
      entityType: 'vehicle',
      entityId: cleanId || targetInfo,
      entityLabel: removed?.vehicleInfo || vehicleInfo || cleanId,
    });
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
    this.logActivity({
      category: 'warehouse',
      actionType: 'clear_vehicles',
      actionTitle: 'پاکسازی کامل فهرست ناوگان',
      details: `حذف دسته‌جمعی ${current.length} خودرو از فهرست ناوگان تحویل`,
      severity: 'critical',
      entityType: 'vehicle',
      metadata: { clearedCount: current.length },
    });
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
    const caller = this.getLoggedInUser();
    if (caller && (caller.role === 'accountant' || (caller.role !== 'admin' && !caller.permissions?.canAccessAdmin))) {
      return;
    }
    const currentInvoices = this.getInvoices();
    const tombstones = this.getDeletedTombstones();
    const invSet = new Set(tombstones.invoices || []);
    currentInvoices.forEach((inv) => {
      if (inv?.id) invSet.add(inv.id);
    });
    tombstones.invoices = Array.from(invSet).slice(-2000);
    localStorage.setItem(STORAGE_KEYS.TOMBSTONES, JSON.stringify(tombstones));
    localStorage.setItem(STORAGE_KEYS.DELETED_INVOICES, JSON.stringify(tombstones.invoices));
    localStorage.setItem(STORAGE_KEYS.INVOICES, JSON.stringify([]));
    localStorage.setItem(STORAGE_KEYS.EXIT_SLIP_LOGS, JSON.stringify({}));
    this.pushToServer({
      invoices: [],
      exitSlipLogs: {},
      deletedInvoiceIds: tombstones.invoices,
      tombstones,
    });
    this.logActivity({
      category: 'sales',
      actionType: 'clear_all_invoices',
      actionTitle: 'حذف کلیه فاکتورهای فروش',
      details: `پاکسازی دسته‌جمعی ${currentInvoices.length} فاکتور از سامانه`,
      severity: 'critical',
      entityType: 'invoice',
      metadata: { clearedInvoicesCount: currentInvoices.length },
    });
    this.notifyChange();
  },

  clearAllData() {
    const caller = this.getLoggedInUser();
    if (caller && (caller.role === 'accountant' || (caller.role !== 'admin' && !caller.permissions?.canAccessAdmin))) {
      return;
    }
    const counts = {
      products: this.getProducts().length,
      customers: this.getCustomers().length,
      invoices: this.getInvoices().length,
      purchases: this.getPurchaseInvoices().length,
    };
    const tombstones: AppTombstones = {
      invoices: this.getInvoices().map((x) => x.id),
      products: this.getProducts().map((x) => x.id),
      customers: this.getCustomers().map((x) => x.id),
      purchaseInvoices: this.getPurchaseInvoices().map((x) => x.id),
      inboundReceipts: this.getInboundReceipts().map((x) => x.id),
      directTransfers: this.getDirectTransfers().map((x) => x.id),
      savedVehicles: this.getSavedVehicles().map((x) => x.id),
      customerTransactions: this.getCustomerTransactions().map((x) => x.id),
      users: [],
      categories: [],
    };
    localStorage.setItem(STORAGE_KEYS.TOMBSTONES, JSON.stringify(tombstones));
    localStorage.setItem(STORAGE_KEYS.DELETED_INVOICES, JSON.stringify(tombstones.invoices));
    localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify([]));
    localStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify([]));
    localStorage.setItem(STORAGE_KEYS.INVOICES, JSON.stringify([]));
    localStorage.setItem(STORAGE_KEYS.PURCHASE_INVOICES, JSON.stringify([]));
    localStorage.setItem(STORAGE_KEYS.INBOUND_RECEIPTS, JSON.stringify([]));
    localStorage.setItem(STORAGE_KEYS.MOVEMENTS, JSON.stringify([]));
    localStorage.setItem(STORAGE_KEYS.DIRECT_TRANSFERS, JSON.stringify([]));
    localStorage.setItem(STORAGE_KEYS.CUSTOMER_TRANSACTIONS, JSON.stringify([]));
    localStorage.setItem(STORAGE_KEYS.EXIT_SLIP_LOGS, JSON.stringify({}));
    this.pushToServer({
      products: [],
      customers: [],
      invoices: [],
      purchaseInvoices: [],
      inboundReceipts: [],
      movements: [],
      directTransfers: [],
      customerTransactions: [],
      exitSlipLogs: {},
      deletedInvoiceIds: tombstones.invoices,
      tombstones,
    });
    this.logActivity({
      category: 'system',
      actionType: 'clear_all_data',
      actionTitle: 'پاکسازی کامل داده‌های عملیاتی سامانه',
      details: `حذف کامل داده‌ها (${counts.invoices} فاکتور، ${counts.products} کالا، ${counts.customers} مشتری، ${counts.purchases} فاکتور خرید)`,
      severity: 'critical',
      entityType: 'system',
      metadata: counts,
    });
    this.notifyChange();
  },

  resetSettingsToDefault(): StoreSettings {
    const caller = this.getLoggedInUser();
    if (caller && (caller.role === 'accountant' || (caller.role !== 'admin' && !caller.permissions?.canAccessAdmin))) {
      return this.getSettings();
    }
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(initialSettings));
    this.pushToServer({ settings: initialSettings });
    this.logActivity({
      category: 'settings',
      actionType: 'reset_settings',
      actionTitle: 'بازنشانی تنظیمات سامانه به پیش‌فرض',
      details: 'بازگرداندن کلیه تنظیمات فروشگاه، چاپ و قوانین انبار به حالت کارخانه',
      severity: 'critical',
      entityType: 'settings',
    });
    return initialSettings;
  },

  // ACTIVITY LOGS (ثبت وقایع و ردگیری فعالیت کاربران)
  getActivityLogs(): ActivityLog[] {
    const data = localStorage.getItem(STORAGE_KEYS.ACTIVITY_LOGS);
    if (!data) {
      safeLocalStorageSet(STORAGE_KEYS.ACTIVITY_LOGS, JSON.stringify(initialActivityLogs));
      return [];
    }
    try {
      const parsed = JSON.parse(data);
      return mergeActivityLogsClient([], Array.isArray(parsed) ? parsed : []);
    } catch {
      return [];
    }
  },

  saveActivityLogs(logs: ActivityLog[]) {
    const normalized = mergeActivityLogsClient([], Array.isArray(logs) ? logs : []);
    safeLocalStorageSet(STORAGE_KEYS.ACTIVITY_LOGS, JSON.stringify(normalized));
  },

  async fetchActivityLogsFromServer(): Promise<{ success: boolean; logs: ActivityLog[]; message?: string }> {
    if (!hasAuthToken()) {
      return { success: false, logs: this.getActivityLogs(), message: 'نشست کاربری فعال نیست.' };
    }
    try {
      const res = await apiFetch(`/api/activity-logs?_t=${Date.now()}`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' },
      });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.success && Array.isArray(json.logs)) {
        const cleaned = mergeActivityLogsClient([], json.logs);
        safeLocalStorageSet(STORAGE_KEYS.ACTIVITY_LOGS, JSON.stringify(cleaned));
        this.notifyChange();
        return { success: true, logs: cleaned };
      }
      return {
        success: false,
        logs: this.getActivityLogs(),
        message: json?.message || 'خطا در دریافت لاگ‌های فعالیت از سرور.',
      };
    } catch {
      return {
        success: false,
        logs: this.getActivityLogs(),
        message: 'ارتباط با سرور برای بروزرسانی لاگ‌ها برقرار نشد.',
      };
    }
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
    severity?: ActivityLogSeverity;
    entityType?: string;
    entityId?: string;
    entityLabel?: string;
    metadata?: Record<string, string | number | boolean | null>;
    deviceInfo?: string;
  }): ActivityLog {
    const now = new Date();
    const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
    const dateOnly = getCurrentJalaliDate();
    const timeWithSec = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
    const createdAtMs = now.getTime();

    try {
      const activeUser = this.getActiveUser();
      const userId = params.userId || activeUser?.id || 'sys';
      const userName = params.userName || activeUser?.fullName || 'کاربر سیستم';
      const userRole = params.userRole || activeUser?.role || 'admin';
      const userRoleTitle = params.userRoleTitle || activeUser?.roleTitle || ROLE_LABELS[activeUser?.role as UserRole] || 'کاربر';

      const newLog: ActivityLog = {
        id: `log-${createdAtMs}-${Math.random().toString(36).slice(2, 7)}`,
        userId,
        userName,
        userRole,
        userRoleTitle,
        category: params.category,
        actionType: params.actionType,
        actionTitle: params.actionTitle,
        details: params.details,
        timestamp: `${dateOnly} - ${timeWithSec || getCurrentJalaliTime()}`,
        dateOnly,
        createdAtMs,
        severity: params.severity || inferClientLogSeverity(params.actionType, params.category),
        source: 'client',
        deviceInfo: params.deviceInfo || detectClientDeviceInfo(),
        ...(params.entityType ? { entityType: params.entityType } : {}),
        ...(params.entityId ? { entityId: params.entityId } : {}),
        ...(params.entityLabel ? { entityLabel: params.entityLabel } : {}),
        ...(params.metadata ? { metadata: params.metadata } : {}),
      };

      // Strictly respect read-only accountant rule
      if (activeUser?.role === 'accountant') {
        return newLog;
      }

      const currentLogs = this.getActivityLogs();
      const updatedLogs = mergeActivityLogsClient(currentLogs, [newLog], 2000);
      safeLocalStorageSet(STORAGE_KEYS.ACTIVITY_LOGS, JSON.stringify(updatedLogs));
      this.notifyChange();

      // Send ONLY the new log atomically via POST /api/activity-logs instead of pushing the entire DB array
      if (hasAuthToken()) {
        apiFetch('/api/activity-logs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' },
          body: JSON.stringify(newLog),
        })
          .then(async (res) => {
            if (!res.ok) return;
            const json = await res.json().catch(() => null);
            if (json?.success && json.log?.id) {
              const latestLocal = this.getActivityLogs();
              const merged = mergeActivityLogsClient(latestLocal, [json.log], 2000);
              safeLocalStorageSet(STORAGE_KEYS.ACTIVITY_LOGS, JSON.stringify(merged));
              this.notifyChange();
            }
          })
          .catch(() => {
            // Retain local copy if temporarily offline
          });
      }

      return newLog;
    } catch (err) {
      console.error('Failed to record activity log:', err);
      return {
        id: `log-${createdAtMs}`,
        userId: 'err',
        userName: 'سیستم',
        userRole: 'admin',
        category: params.category,
        actionType: params.actionType,
        actionTitle: params.actionTitle,
        details: params.details,
        timestamp: `${dateOnly} - ${timeWithSec}`,
        dateOnly,
        createdAtMs,
        severity: params.severity || 'warning',
        source: 'client',
      };
    }
  },

  async clearActivityLogs(): Promise<{ success: boolean; logs: ActivityLog[]; message?: string }> {
    if (!hasAuthToken()) {
      return { success: false, logs: this.getActivityLogs(), message: 'نشست کاربری معتبر نیست.' };
    }
    try {
      const res = await apiFetch('/api/activity-logs', {
        method: 'DELETE',
        headers: { 'Cache-Control': 'no-cache' },
      });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.success) {
        const nextLogs = mergeActivityLogsClient([], Array.isArray(json.logs) ? json.logs : []);
        safeLocalStorageSet(STORAGE_KEYS.ACTIVITY_LOGS, JSON.stringify(nextLogs));
        this.notifyChange();
        return {
          success: true,
          logs: nextLogs,
          message: json.message || 'آرشیو لاگ‌های فعالیت با موفقیت پاکسازی شد.',
        };
      }
      return {
        success: false,
        logs: this.getActivityLogs(),
        message: json?.message || 'شما مجوز پاکسازی لاگ‌های فعالیت را ندارید.',
      };
    } catch {
      return {
        success: false,
        logs: this.getActivityLogs(),
        message: 'ارتباط با سرور برای پاکسازی لاگ‌ها برقرار نشد.',
      };
    }
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
   * موجودی کالاهای انباری کسر شده و رکوردهای کاردکس ثبت می‌شوند
   */
  createDirectTransferDispatch(transferData: Omit<DirectTransfer, 'id' | 'createdAt'>): DirectTransfer {
    const id = `trf-${Date.now()}`;
    const newTransfer: DirectTransfer = {
      ...transferData,
      id,
      createdAt: getCurrentJalaliDate(),
    };

    // 1. کسر موجودی کالاها و تنوع‌ها (فقط برای کالاهای انباری، نه اموال/تجهیزات کارگاهی خارج از لیست فروش)
    const currentProducts = this.getProducts();
    const currentMovements = this.getMovements();
    const updatedProducts = [...currentProducts];
    const newMovements: StockMovement[] = [];

    const typeLabel =
      newTransfer.type === 'repair' ? 'تعمیرات و سرویس' :
      newTransfer.type === 'temporary_loan' ? 'امانی و تست' :
      newTransfer.type === 'internal_use' ? 'مصرف داخلی' :
      newTransfer.type === 'sample' ? 'نمونه کالا' : 'خروج مستقیم';

    for (const item of newTransfer.items) {
      if (item.isCustomAsset) continue;
      const pIdx = updatedProducts.findIndex((p) => p.id === item.productId);
      if (pIdx !== -1) {
        const prod = { ...updatedProducts[pIdx] };

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

        prod.updatedAt = getCurrentJalaliDate();
        updatedProducts[pIdx] = prod;

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
      severity: 'info',
      entityType: 'direct_transfer',
      entityId: newTransfer.id,
      entityLabel: newTransfer.transferNumber,
      metadata: {
        transferType: typeLabel,
        receiverName: newTransfer.receiverName || null,
        vehicleInfo: newTransfer.dispatchVehicleInfo || null,
        itemsCount: newTransfer.items.length,
        isReturnable: Boolean(newTransfer.isReturnable),
      },
    });

    this.notifyChange();
    return newTransfer;
  },

  /**
   * ویرایش مشخصات برگه خروج مستقیم (عنوان، موعد بازگشت، گیرنده، خودرو، مقصد، هزینه و یادداشت‌ها)
   */
  updateDirectTransfer(
    transferId: string,
    updates: Partial<DirectTransfer>
  ): { success: boolean; message?: string; transfer?: DirectTransfer } {
    const transfers = this.getDirectTransfers();
    const tIdx = transfers.findIndex((t) => t.id === transferId);
    if (tIdx === -1) {
      return { success: false, message: 'حواله مورد نظر یافت نشد.' };
    }

    const current = transfers[tIdx];
    const updated: DirectTransfer = {
      ...current,
      ...updates,
      id: current.id,
      createdAt: current.createdAt,
      updatedAt: getCurrentJalaliDate(),
    };

    transfers[tIdx] = updated;
    this.saveDirectTransfers(transfers);

    this.logActivity({
      category: 'warehouse',
      actionType: 'direct_transfer_update',
      actionTitle: `ویرایش حواله امانی/تعمیرات: ${updated.transferNumber}`,
      details: `عنوان: ${updated.title} | تحویل‌گیرنده: ${updated.receiverName} | موعد بازگشت: ${updated.expectedReturnDate || 'تعیین‌نشده'}`,
      severity: 'warning',
      entityType: 'direct_transfer',
      entityId: updated.id,
      entityLabel: updated.transferNumber,
      metadata: {
        receiverName: updated.receiverName || null,
        expectedReturnDate: updated.expectedReturnDate || null,
        status: updated.status || null,
      },
    });

    this.notifyChange();
    return { success: true, transfer: updated };
  },

  /**
   * مختومه کردن برگه در جریان بدون نیاز به بازگشت کالا (مصرف‌شده، تبدیل به فروش، یا اسقاط دستگاه)
   */
  completeDirectTransferWithoutReturn(
    transferId: string,
    reasonNote?: string
  ): { success: boolean; message?: string; transfer?: DirectTransfer } {
    const transfers = this.getDirectTransfers();
    const tIdx = transfers.findIndex((t) => t.id === transferId);
    if (tIdx === -1) {
      return { success: false, message: 'حواله مورد نظر یافت نشد.' };
    }

    const target = { ...transfers[tIdx] };
    target.status = 'completed_no_return';
    target.isReturnable = false;
    target.updatedAt = getCurrentJalaliDate();
    if (reasonNote && reasonNote.trim()) {
      target.dispatchNotes = target.dispatchNotes
        ? `${target.dispatchNotes} | مختومه: ${reasonNote.trim()}`
        : `مختومه: ${reasonNote.trim()}`;
    }

    transfers[tIdx] = target;
    this.saveDirectTransfers(transfers);

    this.logActivity({
      category: 'warehouse',
      actionType: 'direct_transfer_complete',
      actionTitle: `مختومه‌سازی حواله ${target.transferNumber}`,
      details: `حواله «${target.title}» به وضعیت مختومه (بدون بازگشت) تغییر یافت.${reasonNote ? ` علت: ${reasonNote}` : ''}`,
      severity: 'warning',
      entityType: 'direct_transfer',
      entityId: target.id,
      entityLabel: target.transferNumber,
      metadata: {
        reason: reasonNote || null,
        receiverName: target.receiverName || null,
      },
    });

    this.notifyChange();
    return { success: true, transfer: target };
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

    // 1. برگرداندن موجودی کالاها به انبار (مگر اینکه قلم، تجهیز کارگاهی سفارشی یا اسقاط‌شده باشد)
    const currentProducts = this.getProducts();
    const currentMovements = this.getMovements();
    const updatedProducts = [...currentProducts];
    const newMovements: StockMovement[] = [];
    const isScrapped = returnData.healthStatus === 'scrapped';

    const updatedItems = targetTransfer.items.map((item) => {
      const returnedItem = returnData.itemsReturned.find((r) => r.itemId === item.id || r.productId === item.productId);
      if (returnedItem && returnedItem.quantity > 0) {
        const newReturnedQty = (item.returnedQuantity || 0) + returnedItem.quantity;

        if (!item.isCustomAsset && !isScrapped) {
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
            prod.updatedAt = getCurrentJalaliDate();
            updatedProducts[pIdx] = prod;

            const vehicleTxt = returnData.returnVehicleInfo ? ` (با خودرو: ${returnData.returnVehicleInfo})` : '';
            const returnerTxt = returnData.returnerName ? ` توسط ${returnData.returnerName}` : '';
            const healthTxt =
              returnData.healthStatus === 'repaired' ? ' [تعمیر شده و سالم]' :
              returnData.healthStatus === 'healthy' ? ' [سالم و بدون عیب]' :
              returnData.healthStatus === 'unrepaired' ? ' [تعمیر نشده]' :
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
      targetTransfer.status = isScrapped ? 'completed_no_return' : 'returned';
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
      severity: 'info',
      entityType: 'direct_transfer',
      entityId: targetTransfer.id,
      entityLabel: targetTransfer.transferNumber,
      metadata: {
        returnerName: returnData.returnerName || null,
        vehicleInfo: returnData.returnVehicleInfo || null,
        receivedBy: returnData.receivedByWarehouseUser || null,
        healthStatus: returnData.healthStatus || null,
        returnedItemsCount: returnData.itemsReturned.length,
        finalStatus: targetTransfer.status,
      },
    });

    this.notifyChange();
    return { success: true, transfer: targetTransfer };
  },

  deleteDirectTransfer(transferId: string, returnStockToWarehouse = false): { success: boolean; message?: string } {
    const transfers = this.getDirectTransfers();
    const target = transfers.find((t) => t.id === transferId);
    if (!target) {
      return { success: false, message: 'حواله مورد نظر یافت نشد.' };
    }

    // اگر حواله در وضعیت خارج شده یا بخشی بازگشته بود و کاربر خواسته موجودی باقیمانده برگردد:
    if (
      returnStockToWarehouse &&
      (target.status === 'dispatched' || target.status === 'partially_returned')
    ) {
      const currentProducts = this.getProducts();
      const currentMovements = this.getMovements();
      const updatedProducts = [...currentProducts];
      const newMovements: StockMovement[] = [];

      for (const item of target.items) {
        if (item.isCustomAsset) continue;
        const remainingToRevert = Math.max(0, item.quantity - (item.returnedQuantity || 0));
        if (remainingToRevert > 0) {
          const pIdx = updatedProducts.findIndex((p) => p.id === item.productId);
          if (pIdx !== -1) {
            const p = { ...updatedProducts[pIdx] };
            if (item.variantId && p.hasVariants && Array.isArray(p.variants)) {
              p.variants = p.variants.map((v) =>
                v.id === item.variantId ? { ...v, stock: v.stock + remainingToRevert } : v
              );
              p.stock = p.variants.reduce((sum, v) => sum + (v.stock || 0), 0);
            } else {
              p.stock += remainingToRevert;
            }
            p.updatedAt = getCurrentJalaliDate();
            updatedProducts[pIdx] = p;

            newMovements.push({
              id: `mov-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              productId: p.id,
              productName: p.name,
              variantId: item.variantId,
              variantName: item.variantName,
              type: 'direct_in',
              quantity: remainingToRevert,
              remainingStock: p.stock,
              invoiceNumber: target.transferNumber,
              date: getCurrentJalaliDate(),
              note: `برگشت موجودی به انبار بابت حذف برگه خروج مستقیم (${target.transferNumber})`,
            });
          }
        }
      }
      this.saveProducts(updatedProducts);
      if (newMovements.length > 0) {
        this.saveMovements([...newMovements, ...currentMovements]);
      }
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
      severity: 'critical',
      entityType: 'direct_transfer',
      entityId: cleanId,
      entityLabel: target.transferNumber,
      metadata: {
        title: target.title || null,
        receiverName: target.receiverName || null,
        stockReturned: returnStockToWarehouse,
      },
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

  exportAllDataAsObject(): Record<string, any> {
    return {
      version: '1.3',
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
      exitSlipLogs: this.getExitSlipLogs(),
      activityLogs: this.getActivityLogs(),
      directTransfers: this.getDirectTransfers(),
      savedVehicles: this.getSavedVehicles(),
      customerTransactions: this.getCustomerTransactions(),
      categories: this.getCategories(),
      currentUserId: this.getActiveUser().id,
      tombstones: this.getDeletedTombstones(),
      deletedInvoiceIds: Array.from(this.getDeletedInvoiceIds()),
    };
  },

  exportAllData(): string {
    return JSON.stringify(this.exportAllDataAsObject(), null, 2);
  },

  importAllData(jsonString: string, selectedModules?: string[]): boolean {
    const caller = this.getLoggedInUser();
    if (caller && (caller.role === 'accountant' || (caller.role !== 'admin' && !caller.permissions?.canAccessAdmin))) {
      return false;
    }
    try {
      const parsed = JSON.parse(jsonString);
      const actualData = parsed.data || parsed;
      const isSelective = Array.isArray(selectedModules) && selectedModules.length > 0;
      const modSet = new Set(selectedModules || []);
      const shouldImport = (key: string) => !isSelective || modSet.has(key);

      // Clear local tombstones for any entities being restored so they aren't filtered out
      const currentTombstones = this.getDeletedTombstones();
      const stripRestoredIds = (tombKey: keyof AppTombstones, arr: any[]) => {
        if (!Array.isArray(arr)) return;
        const activeIds = new Set(arr.map((x: any) => x?.id).filter(Boolean));
        currentTombstones[tombKey] = (currentTombstones[tombKey] || []).filter((id) => !activeIds.has(id));
      };

      if (shouldImport('products') && Array.isArray(actualData.products)) {
        stripRestoredIds('products', actualData.products);
      }
      if (shouldImport('customers') && Array.isArray(actualData.customers)) {
        stripRestoredIds('customers', actualData.customers);
        if (Array.isArray(actualData.customerTransactions)) {
          stripRestoredIds('customerTransactions', actualData.customerTransactions);
        }
      }
      if (shouldImport('invoices') && Array.isArray(actualData.invoices)) {
        stripRestoredIds('invoices', actualData.invoices);
      }
      if (shouldImport('purchaseInvoices') && Array.isArray(actualData.purchaseInvoices)) {
        stripRestoredIds('purchaseInvoices', actualData.purchaseInvoices);
        if (Array.isArray(actualData.inboundReceipts)) {
          stripRestoredIds('inboundReceipts', actualData.inboundReceipts);
        }
      }
      if (shouldImport('movements') && Array.isArray(actualData.directTransfers)) {
        stripRestoredIds('directTransfers', actualData.directTransfers);
      }
      if (shouldImport('users') && Array.isArray(actualData.users)) {
        stripRestoredIds('users', actualData.users);
      }

      localStorage.setItem(STORAGE_KEYS.TOMBSTONES, JSON.stringify(currentTombstones));
      localStorage.setItem(STORAGE_KEYS.DELETED_INVOICES, JSON.stringify(currentTombstones.invoices));

      if (shouldImport('products') && Array.isArray(actualData.products)) {
        const { products: ensured } = ensureProductCodesAndBarcodes(actualData.products);
        localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(ensured));
        if (Array.isArray(actualData.categories)) {
          localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(actualData.categories));
        }
      }
      if (shouldImport('customers')) {
        if (Array.isArray(actualData.customers)) {
          localStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify(actualData.customers));
        }
        if (Array.isArray(actualData.customerTransactions)) {
          localStorage.setItem(STORAGE_KEYS.CUSTOMER_TRANSACTIONS, JSON.stringify(actualData.customerTransactions));
        }
      }
      if (shouldImport('invoices')) {
        if (Array.isArray(actualData.invoices)) {
          localStorage.setItem(STORAGE_KEYS.INVOICES, JSON.stringify(actualData.invoices));
        }
        if (actualData.exitSlipLogs && typeof actualData.exitSlipLogs === 'object') {
          localStorage.setItem(STORAGE_KEYS.EXIT_SLIP_LOGS, JSON.stringify(actualData.exitSlipLogs));
        }
      }
      if (shouldImport('purchaseInvoices')) {
        if (Array.isArray(actualData.purchaseInvoices)) {
          localStorage.setItem(STORAGE_KEYS.PURCHASE_INVOICES, JSON.stringify(actualData.purchaseInvoices));
        }
        if (Array.isArray(actualData.inboundReceipts)) {
          localStorage.setItem(STORAGE_KEYS.INBOUND_RECEIPTS, JSON.stringify(actualData.inboundReceipts));
        }
      }
      if (shouldImport('movements')) {
        if (Array.isArray(actualData.movements)) {
          localStorage.setItem(STORAGE_KEYS.MOVEMENTS, JSON.stringify(actualData.movements));
        }
        if (Array.isArray(actualData.directTransfers)) {
          localStorage.setItem(STORAGE_KEYS.DIRECT_TRANSFERS, JSON.stringify(actualData.directTransfers));
        }
        if (Array.isArray(actualData.savedVehicles)) {
          localStorage.setItem(STORAGE_KEYS.SAVED_VEHICLES, JSON.stringify(actualData.savedVehicles));
        }
      }
      if (shouldImport('settings') && actualData.settings && typeof actualData.settings === 'object') {
        this.saveSettings(actualData.settings);
      }
      if (shouldImport('users') && Array.isArray(actualData.users) && actualData.users.length > 0) {
        localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(actualData.users));
      }
      if (!isSelective && Array.isArray(actualData.activityLogs)) {
        localStorage.setItem(STORAGE_KEYS.ACTIVITY_LOGS, JSON.stringify(actualData.activityLogs));
      }

      this.notifyChange();
      this.pushToServer();
      return true;
    } catch (e) {
      console.error('Failed to import backup:', e);
      return false;
    }
  },

  async optimizeDatabase(): Promise<{
    success: boolean;
    cleanedOrphanSlips: number;
    cleanedTombstones: number;
    trimmedLogs: number;
    ensuredBarcodes: number;
    sizeBeforeKB: string;
    sizeAfterKB: string;
    message: string;
  }> {
    const sizeBeforeKB = this.getStorageStats().sizeKB;

    // 1. Clean orphan exitSlipLogs (belonging to deleted or proforma invoices)
    const invoices = this.getInvoices();
    const validInvoiceIds = new Set(invoices.filter((i) => !i.isProforma).map((i) => i.id));
    const rawLogs: Record<string, ExitSlipData> = this.getExitSlipLogs();
    const cleanedLogs: Record<string, ExitSlipData> = {};
    let cleanedOrphanSlips = 0;
    for (const [invId, slip] of Object.entries(rawLogs)) {
      if (validInvoiceIds.has(invId)) {
        cleanedLogs[invId] = slip;
      } else {
        cleanedOrphanSlips++;
      }
    }
    localStorage.setItem(STORAGE_KEYS.EXIT_SLIP_LOGS, JSON.stringify(cleanedLogs));

    // 2. Ensure product codes & barcodes
    const products = this.getProducts();
    const { products: ensuredProducts, changed } = ensureProductCodesAndBarcodes(products);
    if (changed) {
      localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(ensuredProducts));
    }

    // 3. Purify tombstones (remove duplicates & any IDs that are currently active, cap at 500 per entity)
    const tombstones = this.getDeletedTombstones();
    const activeSets: Record<keyof AppTombstones, Set<string>> = {
      invoices: new Set(invoices.map((x) => x.id)),
      products: new Set(ensuredProducts.map((x) => x.id)),
      customers: new Set(this.getCustomers().map((x) => x.id)),
      purchaseInvoices: new Set(this.getPurchaseInvoices().map((x) => x.id)),
      inboundReceipts: new Set(this.getInboundReceipts().map((x) => x.id)),
      directTransfers: new Set(this.getDirectTransfers().map((x) => x.id)),
      savedVehicles: new Set(this.getSavedVehicles().map((x) => x.id)),
      customerTransactions: new Set(this.getCustomerTransactions().map((x) => x.id)),
      users: new Set(this.getUsers().map((x) => x.id)),
      categories: new Set(this.getCategories().map((c) => c.toLowerCase())),
    };

    let cleanedTombstones = 0;
    (Object.keys(activeSets) as Array<keyof AppTombstones>).forEach((k) => {
      const orig: string[] = tombstones[k] || [];
      const uniq: string[] = Array.from(new Set<string>(orig.map((s) => String(s).trim()).filter(Boolean)));
      const filtered = uniq
        .filter((id: string) => (k === 'categories' ? !activeSets[k].has(id.toLowerCase()) : !activeSets[k].has(id)))
        .slice(-500);
      cleanedTombstones += Math.max(0, orig.length - filtered.length);
      tombstones[k] = filtered;
    });
    localStorage.setItem(STORAGE_KEYS.TOMBSTONES, JSON.stringify(tombstones));
    localStorage.setItem(STORAGE_KEYS.DELETED_INVOICES, JSON.stringify(tombstones.invoices));

    // 4. Trim activity logs to max 500 recent items
    const logs = this.getActivityLogs();
    let trimmedLogs = 0;
    if (logs.length > 500) {
      trimmedLogs = logs.length - 500;
      localStorage.setItem(STORAGE_KEYS.ACTIVITY_LOGS, JSON.stringify(logs.slice(0, 500)));
    }

    await this.pushToServer();
    this.notifyChange();
    const sizeAfterKB = this.getStorageStats().sizeKB;

    return {
      success: true,
      cleanedOrphanSlips,
      cleanedTombstones,
      trimmedLogs,
      ensuredBarcodes: changed ? ensuredProducts.length : 0,
      sizeBeforeKB,
      sizeAfterKB,
      message: `بهینه‌سازی و یکپارچه‌سازی پایگاه‌داده با موفقیت انجام شد (حجم حافظه: ${sizeAfterKB} کیلوبایت).`,
    };
  },

  resetToDefaults() {
    const caller = this.getLoggedInUser();
    if (caller && (caller.role === 'accountant' || (caller.role !== 'admin' && !caller.permissions?.canAccessAdmin))) {
      return;
    }
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
    localStorage.setItem(STORAGE_KEYS.TOMBSTONES, JSON.stringify(emptyTombstones));
    localStorage.setItem(STORAGE_KEYS.DELETED_INVOICES, JSON.stringify([]));
    localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(initialProducts));
    localStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify(initialCustomers));
    localStorage.setItem(STORAGE_KEYS.INVOICES, JSON.stringify(initialInvoices));
    localStorage.setItem(STORAGE_KEYS.PURCHASE_INVOICES, JSON.stringify(initialPurchaseInvoices));
    localStorage.setItem(STORAGE_KEYS.INBOUND_RECEIPTS, JSON.stringify(initialInboundReceipts));
    localStorage.setItem(STORAGE_KEYS.MOVEMENTS, JSON.stringify(initialMovements));
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(initialSettings));
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(initialUsers));
    localStorage.setItem(STORAGE_KEYS.DIRECT_TRANSFERS, JSON.stringify(initialDirectTransfers));
    localStorage.setItem(STORAGE_KEYS.CUSTOMER_TRANSACTIONS, JSON.stringify([]));
    localStorage.setItem(STORAGE_KEYS.EXIT_SLIP_LOGS, JSON.stringify({}));
    localStorage.setItem(STORAGE_KEYS.CURRENT_USER_ID, initialUsers[0].id);
    this.pushToServer();
    this.notifyChange();
  }
};
