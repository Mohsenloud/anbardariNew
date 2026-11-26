import express from 'express';
import http from 'http';
import https from 'https';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import dns from 'dns';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { GoogleGenAI } from '@google/genai';
import {
  testAndInitPostgres,
  loadStateFromPostgres,
  saveStateToPostgres,
  getPostgresStatus,
  testPostgresConnectionDetails,
  generatePostgresSqlDump,
  executeRawSql,
  createPostgresDbBackupRecord,
  getLastPostgresSaveError,
  exportLiveDatabaseDump,
} from './server/db';

// Enforce IPv4-first DNS resolution to prevent undici / fetch hanging on Telegram IPv6 addresses
try {
  dns.setDefaultResultOrder('ipv4first');
} catch (e) {
  // ignore
}

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// Tell Express to trust the reverse proxy chain (Cloudflare -> Nginx -> Express) for accurate client IP resolution
app.set('trust proxy', true);

// Hardening: Disable Express fingerprinting header
app.disable('x-powered-by');

// Hardening: HTTP Security Headers via Helmet
// Allows client-side PDF blobs, SVG canvas export, iframe preview, and Vite client without breaking preview
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    frameguard: false,
  })
);

// Enable JSON body parsing with reasonable limit for invoice graphics and logs
app.use(express.json({ limit: '30mb' }));
app.use(express.urlencoded({ extended: true, limit: '30mb' }));

// Hardened CORS policy: same-origin by default, optional explicit ALLOWED_ORIGINS allowlist
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use((req, res, next) => {
  const origin = req.headers.origin;
  const host = req.headers.host;
  const forwardedHost = typeof req.headers['x-forwarded-host'] === 'string'
    ? req.headers['x-forwarded-host'].split(',')[0].trim()
    : '';
  const isSameOrigin = Boolean(
    origin &&
      (
        (host && (origin === `https://${host}` || origin === `http://${host}`)) ||
        (forwardedHost && (origin === `https://${forwardedHost}` || origin === `http://${forwardedHost}`))
      )
  );
  const isAllowedExternal = Boolean(origin && ALLOWED_ORIGINS.includes(origin));

  if (origin && (isSameOrigin || isAllowedExternal)) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Vary', 'Origin');
    res.header('Access-Control-Allow-Credentials', 'true');
  }
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

// Hardening: Rate Limiting
// 1. General API rate limiter (protects against DoS / scraping)
const apiGeneralLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 300, // max 300 requests per minute per IP
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  message: {
    success: false,
    message: 'تعداد درخواست‌ها بیش از حد مجاز است. لطفاً کمی صبر کرده و مجدداً تلاش نمایید.',
  },
});
app.use('/api/', apiGeneralLimiter);

// 2. Strict limiter for database writes & mutations (protects against flood attacks)
const dbWriteLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 300, // max 300 writes per minute per IP to prevent throttling legitimate multi-register actions
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  message: {
    success: false,
    message: 'نرخ ذخیره‌سازی اطلاعات فراتر از حد مجاز است. لطفاً چند لحظه صبر نمایید.',
  },
});

// 3. Dedicated rate limiter for authentication endpoints
const authLoginLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 25,
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  message: {
    success: false,
    message: 'تعداد تلاش‌های ورود بیش از حد مجاز است. لطفاً یک دقیقه صبر نمایید.',
  },
});

// Configure persistent data directory
const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'database.json');
const BACKUPS_DIR = path.join(DATA_DIR, 'backups');

// Ensure data and backup directories exist
if (!fs.existsSync(DATA_DIR)) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    console.log(`[Database] Created persistent data directory at: ${DATA_DIR}`);
  } catch (err) {
    console.error(`[Database] Failed to create data directory ${DATA_DIR}:`, err);
  }
}
if (!fs.existsSync(BACKUPS_DIR)) {
  try {
    fs.mkdirSync(BACKUPS_DIR, { recursive: true });
    console.log(`[Database] Created persistent backups directory at: ${BACKUPS_DIR}`);
  } catch (err) {
    console.error(`[Database] Failed to create backups directory ${BACKUPS_DIR}:`, err);
  }
}

// Initial default database structure
const DEFAULT_INITIAL_DATA = {
  version: 1,
  updatedAt: new Date().toISOString(),
  products: [
    {
      id: 'prod-1',
      code: '101',
      name: 'روغن موتور اسپیدی ۴ لیتری',
      barcode: '6260123456789',
      category: 'روغن و روانکار',
      buyPrice: 420000,
      purchasePrice: 420000,
      sellPrice: 580000,
      stock: 35,
      minStockAlert: 10,
      unit: 'گالن',
      updatedAt: '۱۴۰۳/۰۶/۰۱',
      hasVariants: false,
      variants: [],
    },
    {
      id: 'prod-2',
      code: '102',
      name: 'فیلتر هوای پژو ۲۰۶ و ۲۰۷ سرکان',
      barcode: '6260987654321',
      category: 'فیلترجات',
      buyPrice: 95000,
      purchasePrice: 95000,
      sellPrice: 145000,
      stock: 8,
      minStockAlert: 15,
      unit: 'عدد',
      updatedAt: '۱۴۰۳/۰۶/۰۲',
      hasVariants: false,
      variants: [],
    },
    {
      id: 'prod-3',
      code: '103',
      name: 'لنت ترمز جلو پراید پارس لنت',
      barcode: '6260555666777',
      category: 'سیستم ترمز',
      buyPrice: 210000,
      purchasePrice: 210000,
      sellPrice: 290000,
      stock: 22,
      minStockAlert: 10,
      unit: 'دست',
      updatedAt: '۱۴۰۳/۰۶/۰۳',
      hasVariants: false,
      variants: [],
    },
    {
      id: 'prod-4',
      code: '104',
      name: 'شمع پایه کوتاه بوش اصل (آلمان)',
      barcode: '4047024123456',
      category: 'برقی و انژکتور',
      buyPrice: 160000,
      purchasePrice: 160000,
      sellPrice: 240000,
      stock: 4,
      minStockAlert: 12,
      unit: 'عدد',
      updatedAt: '۱۴۰۳/۰۶/۰۴',
      hasVariants: false,
      variants: [],
    },
  ],
  customers: [
    {
      id: 'cust-1',
      name: 'رضا کمالی',
      phone: '۰۹۱۲۳۴۵۶۷۸۹',
      address: 'تهران، میدان شوش، خیابان فداییان اسلام',
      economicCode: '',
      nationalId: '',
      postalCode: '',
      totalInvoices: 3,
      totalSpent: 4850000,
      balance: -450000,
      createdAt: '۱۴۰۳/۰۵/۱۵',
    },
    {
      id: 'cust-2',
      name: 'تعمیرگاه تخصصی کارو (حسینی)',
      phone: '۰۹۳۵۹۸۷۶۵۴۳',
      address: 'کرج، عظیمیه، بلوار کاج، نبش خیابان وصال',
      economicCode: '',
      nationalId: '',
      postalCode: '',
      totalInvoices: 5,
      totalSpent: 12400000,
      balance: 0,
      createdAt: '۱۴۰۳/۰۵/۲۰',
    },
  ],
  invoices: [],
  movements: [],
  exitSlipLogs: {},
  deletedInvoiceIds: [],
  tombstones: {
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
  },
  categories: [
    'روغن و روانکار',
    'فیلترجات',
    'سیستم ترمز',
    'برقی و انژکتور',
    'لوازم موتوری',
    'جلوبندی و تعلیق',
    'بدنه و تزیینات',
    'رنگ و پوشش‌های صنعتی',
    'هاردنر و خشک‌کن',
    'تینر و حلال‌ها',
    'چسب و درزگیر',
    'کابل و رابط',
  ],
  settings: {
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

    // کنترل اجزا و ماژول‌ها
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

    // قالب‌های مجاز چاپ
    enableStandardTemplate: true,
    enableOfficialTemplate: true,
    enableThermalTemplate: true,
    enableSimpleTemplate: true,
    defaultTemplate: 'standard',
    enableSimpleExitSlipTemplate: true,
    defaultExitSlipTemplate: 'standard',

    // روش‌های مجاز پرداخت
    enableChequePayment: true,
    enableCashPayment: true,
    enableTransferPayment: true,
    enablePosPayment: true,
    enableCreditPayment: true,

    // شبکه اجتماعی و پیام‌رسان‌ها
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
    telegramBotEnabled: false,
    telegramBotToken: '',
    telegramChatId: '',
    telegramAutoSendInvoice: false,
    telegramAutoSendExitSlip: false,
    telegramCaptionTemplate: '',
    aiProvider: 'gemini',
    aiApiKey: '',
    aiModel: 'gemini-2.5-flash',
    aiBaseUrl: '',
    aiVoiceInboundEnabled: true,
    aiVoiceAutoMatchProducts: true,
    aiVoiceRequireAdminApproval: true,
    aiCustomPrompt: '',
  },
  users: [
    {
      id: 'user-1',
      username: 'admin',
      fullName: 'مدیر ارشد سیستم',
      role: 'admin',
      roleTitle: 'مدیر کل و راهبر سیستم',
      permissions: {
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
      isActive: true,
      avatarColor: 'emerald',
      phone: '۰۹۱۲۰۰۰۰۰۰۰',
      pin: '1234',
      password: '1234',
      createdAt: '۱۴۰۳/۰۱/۰۱',
    },
    {
      id: 'user-5',
      username: 'supervisor1',
      fullName: 'رضا کرمی',
      role: 'supervisor',
      roleTitle: 'سرپرست فروش و عملیات',
      permissions: {
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
      isActive: true,
      avatarColor: 'teal',
      phone: '۰۹۱۲۳۳۳۴۴۵۵',
      pin: '1234',
      password: '1234',
      createdAt: '۱۴۰۳/۰۱/۰۱',
    },
    {
      id: 'user-2',
      username: 'cashier1',
      fullName: 'علی مرادی',
      role: 'cashier',
      roleTitle: 'صندوق‌دار و فروشنده',
      permissions: {
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
      isActive: true,
      avatarColor: 'blue',
      phone: '۰۹۱۲۱۱۱۲۲۳۳',
      pin: '1234',
      password: '1234',
      createdAt: '۱۴۰۳/۰۱/۰۱',
    },
    {
      id: 'user-3',
      username: 'warehouse1',
      fullName: 'حسین اکبری',
      role: 'warehouse',
      roleTitle: 'مسئول انبار و موجودی',
      permissions: {
        canCreateInvoice: false,
        canViewInvoices: true,
        canCreatePurchaseInvoice: true,
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
      isActive: true,
      avatarColor: 'amber',
      phone: '۰۹۱۲۵۵۵۶۶۷۷',
      pin: '1234',
      password: '1234',
      createdAt: '۱۴۰۳/۰۱/۰۱',
    },
    {
      id: 'user-4',
      username: 'accountant1',
      fullName: 'مریم احمدی',
      role: 'accountant',
      roleTitle: 'حسابدار (فقط مشاهده)',
      permissions: {
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
      isActive: true,
      avatarColor: 'purple',
      phone: '۰۹۱۲۸۸۸۹۹۰۰',
      pin: '1234',
      password: '1234',
      createdAt: '۱۴۰۳/۰۱/۰۱',
    },
  ],
  purchaseInvoices: [],
  inboundReceipts: [],
  activityLogs: [],
  savedVehicles: [],
  customerTransactions: [],
};

// -------------------------------------------------------------
// DATABASE HARDENING & AUTOMATED BACKUP ENGINE
// -------------------------------------------------------------

function computeChecksum(obj: any): string {
  try {
    const jsonStr = typeof obj === 'string' ? obj : JSON.stringify(obj);
    return crypto.createHash('sha256').update(jsonStr).digest('hex');
  } catch {
    return '';
  }
}

function validateDatabaseSchema(data: any): { valid: boolean; error?: string } {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return { valid: false, error: 'قالب اطلاعات ارسالی نامعتبر است. ساختار باید یک شیء JSON استاندارد باشد.' };
  }
  const arrayKeys = [
    'products',
    'customers',
    'invoices',
    'movements',
    'users',
    'purchaseInvoices',
    'inboundReceipts',
    'activityLogs',
    'directTransfers',
    'savedVehicles',
    'customerTransactions',
    'categories',
    'deletedInvoiceIds',
  ];
  for (const key of arrayKeys) {
    if (data[key] !== undefined && !Array.isArray(data[key])) {
      return { valid: false, error: `بخش ${key} باید به صورت آرایه باشد.` };
    }
  }
  if (data.settings !== undefined && (typeof data.settings !== 'object' || Array.isArray(data.settings))) {
    return { valid: false, error: 'بخش تنظیمات سیستم نامعتبر است.' };
  }
  if (data.tombstones !== undefined && (typeof data.tombstones !== 'object' || Array.isArray(data.tombstones))) {
    return { valid: false, error: 'بخش رهگیری حذفیات (tombstones) باید یک شیء معتبر باشد.' };
  }
  if (data.exitSlipLogs !== undefined && (typeof data.exitSlipLogs !== 'object' || Array.isArray(data.exitSlipLogs))) {
    return { valid: false, error: 'بخش رهگیری برگه‌های خروج (exitSlipLogs) باید یک شیء معتبر باشد.' };
  }
  return { valid: true };
}

let lastAutoBackupTime = 0;

interface BackupRecord {
  filename: string;
  createdAt: string;
  trigger: 'auto' | 'manual' | 'startup' | 'pre-restore';
  label: string;
  sizeBytes: number;
  checksum: string;
  stats: {
    productsCount: number;
    invoicesCount: number;
    customersCount: number;
    purchaseInvoicesCount: number;
    inboundReceiptsCount: number;
    movementsCount: number;
    customerTransactionsCount: number;
    directTransfersCount: number;
    usersCount: number;
  };
}

function computeBackupStats(d: any) {
  const src = d?.data && typeof d.data === 'object' ? d.data : d || {};
  return {
    productsCount: Array.isArray(src.products) ? src.products.length : 0,
    invoicesCount: Array.isArray(src.invoices) ? src.invoices.length : 0,
    customersCount: Array.isArray(src.customers) ? src.customers.length : 0,
    purchaseInvoicesCount: Array.isArray(src.purchaseInvoices) ? src.purchaseInvoices.length : 0,
    inboundReceiptsCount: Array.isArray(src.inboundReceipts) ? src.inboundReceipts.length : 0,
    movementsCount: Array.isArray(src.movements) ? src.movements.length : 0,
    customerTransactionsCount: Array.isArray(src.customerTransactions) ? src.customerTransactions.length : 0,
    directTransfersCount: Array.isArray(src.directTransfers) ? src.directTransfers.length : 0,
    usersCount: Array.isArray(src.users) ? src.users.length : 0,
  };
}

function prepareRestoredDatabaseState(currentDb: any, targetData: any, selectedModules?: string[]): any {
  const isSelective = Array.isArray(selectedModules) && selectedModules.length > 0;
  const modSet = new Set(selectedModules || []);

  const base = isSelective ? { ...currentDb } : { ...DEFAULT_INITIAL_DATA, ...targetData };

  if (isSelective) {
    if (modSet.has('products')) {
      base.products = Array.isArray(targetData.products) ? targetData.products : [];
      if (Array.isArray(targetData.categories)) base.categories = targetData.categories;
    }
    if (modSet.has('invoices')) {
      base.invoices = Array.isArray(targetData.invoices) ? targetData.invoices : [];
      if (targetData.exitSlipLogs && typeof targetData.exitSlipLogs === 'object') {
        base.exitSlipLogs = targetData.exitSlipLogs;
      }
    }
    if (modSet.has('purchaseInvoices')) {
      base.purchaseInvoices = Array.isArray(targetData.purchaseInvoices) ? targetData.purchaseInvoices : [];
      base.inboundReceipts = Array.isArray(targetData.inboundReceipts) ? targetData.inboundReceipts : [];
    }
    if (modSet.has('customers')) {
      base.customers = Array.isArray(targetData.customers) ? targetData.customers : [];
      base.customerTransactions = Array.isArray(targetData.customerTransactions) ? targetData.customerTransactions : [];
    }
    if (modSet.has('movements')) {
      base.movements = Array.isArray(targetData.movements) ? targetData.movements : [];
      base.directTransfers = Array.isArray(targetData.directTransfers) ? targetData.directTransfers : [];
      base.savedVehicles = Array.isArray(targetData.savedVehicles) ? targetData.savedVehicles : [];
    }
    if (modSet.has('users') && Array.isArray(targetData.users) && targetData.users.length > 0) {
      base.users = targetData.users;
    }
    if (modSet.has('settings') && targetData.settings && typeof targetData.settings === 'object') {
      base.settings = {
        ...DEFAULT_INITIAL_DATA.settings,
        ...(currentDb?.settings || {}),
        ...targetData.settings,
        updatedAt: new Date().toISOString(),
      };
    }
  } else {
    if (targetData.settings && typeof targetData.settings === 'object') {
      base.settings = {
        ...DEFAULT_INITIAL_DATA.settings,
        ...targetData.settings,
        updatedAt: new Date().toISOString(),
      };
    }
  }

  // Purify tombstones: any ID present in the restored collections MUST be removed from tombstones
  // so restored items are never filtered out or re-deleted by client sync!
  const activeProductIds = new Set<string>((base.products || []).map((x: any) => String(x?.id || '')).filter(Boolean));
  const activeInvoiceIds = new Set<string>((base.invoices || []).map((x: any) => String(x?.id || '')).filter(Boolean));
  const activeCustomerIds = new Set<string>((base.customers || []).map((x: any) => String(x?.id || '')).filter(Boolean));
  const activePurchaseIds = new Set<string>((base.purchaseInvoices || []).map((x: any) => String(x?.id || '')).filter(Boolean));
  const activeInboundIds = new Set<string>((base.inboundReceipts || []).map((x: any) => String(x?.id || '')).filter(Boolean));
  const activeTransferIds = new Set<string>((base.directTransfers || []).map((x: any) => String(x?.id || '')).filter(Boolean));
  const activeVehicleIds = new Set<string>((base.savedVehicles || []).map((x: any) => String(x?.id || '')).filter(Boolean));
  const activeTxnIds = new Set<string>((base.customerTransactions || []).map((x: any) => String(x?.id || '')).filter(Boolean));
  const activeUserIds = new Set<string>((base.users || []).map((x: any) => String(x?.id || '')).filter(Boolean));
  const normCatKey = (c: any) =>
    String(c || '')
      .replace(/[\u200B\uFEFF]/g, '')
      .replace(/[يیى]/g, 'ی')
      .replace(/[كک]/g, 'ک')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  const activeCats = new Set<string>((base.categories || []).map((c: string) => normCatKey(c)).filter(Boolean));

  const rawTombstones = isSelective ? (currentDb?.tombstones || {}) : (targetData?.tombstones || {});
  const filterTomb = (arr: any, activeSet: Set<string>) =>
    Array.isArray(arr) ? arr.filter((id: string) => typeof id === 'string' && !activeSet.has(id.trim())) : [];

  const cleanTombstones = {
    invoices: filterTomb(rawTombstones.invoices, activeInvoiceIds),
    products: filterTomb(rawTombstones.products, activeProductIds),
    customers: filterTomb(rawTombstones.customers, activeCustomerIds),
    purchaseInvoices: filterTomb(rawTombstones.purchaseInvoices, activePurchaseIds),
    inboundReceipts: filterTomb(rawTombstones.inboundReceipts, activeInboundIds),
    directTransfers: filterTomb(rawTombstones.directTransfers, activeTransferIds),
    savedVehicles: filterTomb(rawTombstones.savedVehicles, activeVehicleIds),
    customerTransactions: filterTomb(rawTombstones.customerTransactions, activeTxnIds),
    users: filterTomb(rawTombstones.users, activeUserIds),
    categories: Array.isArray(rawTombstones.categories)
      ? rawTombstones.categories.filter((c: string) => {
          const k = normCatKey(c);
          return Boolean(k) && k !== 'عمومی' && !activeCats.has(k);
        })
      : [],
  };

  base.tombstones = cleanTombstones;
  base.deletedInvoiceIds = cleanTombstones.invoices;

  const currentRev = typeof currentDb?.revision === 'number' ? currentDb.revision : 1;
  const targetRev = typeof targetData?.revision === 'number' ? targetData.revision : 1;
  base.revision = Math.max(currentRev, targetRev) + 5;
  base.updatedAt = new Date().toISOString();

  return base;
}

function pruneOldBackups(maxKeep = 30) {
  try {
    if (!fs.existsSync(BACKUPS_DIR)) return;
    const files = fs
      .readdirSync(BACKUPS_DIR)
      .filter((f) => f.endsWith('.json'))
      .sort((a, b) => b.localeCompare(a));

    if (files.length > maxKeep) {
      const toDelete = files.slice(maxKeep);
      for (const f of toDelete) {
        try {
          fs.unlinkSync(path.join(BACKUPS_DIR, f));
          console.log(`[Backup Retention] Pruned old backup: ${f}`);
        } catch {}
      }
    }
  } catch (err) {
    console.error('[Backup Retention] Error pruning old backups:', err);
  }
}

function createBackup(
  trigger: 'auto' | 'manual' | 'startup' | 'pre-restore' = 'auto',
  label: string = 'پشتیبان سیستم',
  dataToSave?: any
): { success: boolean; filename?: string; error?: string } {
  try {
    if (!fs.existsSync(BACKUPS_DIR)) {
      fs.mkdirSync(BACKUPS_DIR, { recursive: true });
    }

    const currentData =
      dataToSave && typeof dataToSave === 'object' && Array.isArray(dataToSave.products)
        ? dataToSave
        : readDatabaseRaw();
    const timestamp = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    const timeStr = `${timestamp.getFullYear()}-${pad(timestamp.getMonth() + 1)}-${pad(timestamp.getDate())}_${pad(timestamp.getHours())}-${pad(timestamp.getMinutes())}-${pad(timestamp.getSeconds())}`;
    const filename = `backup_${timeStr}_${trigger}.json`;
    const targetPath = path.join(BACKUPS_DIR, filename);

    const dataChecksum = computeChecksum(currentData);
    const backupEnvelope = {
      backupVersion: 1,
      createdAt: timestamp.toISOString(),
      trigger,
      label,
      checksum: dataChecksum,
      stats: computeBackupStats(currentData),
      data: currentData,
    };

    const tempFile = `${targetPath}.tmp.${Date.now()}`;
    fs.writeFileSync(tempFile, JSON.stringify(backupEnvelope, null, 2), 'utf-8');
    fs.renameSync(tempFile, targetPath);

    lastAutoBackupTime = Date.now();
    pruneOldBackups(30);

    // Also persist snapshot record in PostgreSQL db_backups table if connected
    if (getPostgresStatus().connected) {
      createPostgresDbBackupRecord(label, currentData).catch(() => {});
    }

    console.log(`[Backup Engine] Successfully created ${trigger} backup: ${filename} (${label})`);
    return { success: true, filename };
  } catch (err: any) {
    console.error('[Backup Engine] Failed to create backup:', err);
    return { success: false, error: err.message };
  }
}

function getBackupsList(): BackupRecord[] {
  try {
    if (!fs.existsSync(BACKUPS_DIR)) return [];
    const files = fs
      .readdirSync(BACKUPS_DIR)
      .filter((f) => f.endsWith('.json'))
      .sort((a, b) => b.localeCompare(a));

    const list: BackupRecord[] = [];
    for (const f of files) {
      try {
        const fullPath = path.join(BACKUPS_DIR, f);
        const stat = fs.statSync(fullPath);
        const content = fs.readFileSync(fullPath, 'utf-8');
        const parsed = JSON.parse(content);

        const isEnvelope = parsed.backupVersion && parsed.data;
        const trigger = isEnvelope ? parsed.trigger : 'manual';
        const label = isEnvelope ? parsed.label : 'نسخه پشتیبان سرور';
        const createdAt = isEnvelope ? parsed.createdAt : stat.mtime.toISOString();
        const checksum = isEnvelope ? parsed.checksum : computeChecksum(content);
        const computedStats = computeBackupStats(parsed);
        const stats =
          isEnvelope && parsed.stats
            ? { ...computedStats, ...parsed.stats }
            : computedStats;

        list.push({
          filename: f,
          createdAt,
          trigger,
          label,
          sizeBytes: stat.size,
          checksum,
          stats,
        });
      } catch (err) {
        console.warn(`[Backup Engine] Skipped invalid backup file ${f}:`, err);
      }
    }
    return list;
  } catch (err) {
    console.error('[Backup Engine] Error listing backups:', err);
    return [];
  }
}

function restoreFromLatestBackup(): any | null {
  try {
    if (!fs.existsSync(BACKUPS_DIR)) return null;
    const files = fs
      .readdirSync(BACKUPS_DIR)
      .filter((f) => f.endsWith('.json'))
      .sort((a, b) => b.localeCompare(a));

    for (const file of files) {
      try {
        const filePath = path.join(BACKUPS_DIR, file);
        const content = fs.readFileSync(filePath, 'utf-8');
        const parsed = JSON.parse(content);
        const actualData = parsed.data || parsed;
        if (actualData && Array.isArray(actualData.products)) {
          console.log(`[Database Auto-Recovery] Restoring healthy snapshot from: ${file}`);
          writeDatabase(actualData, false);
          return actualData;
        }
      } catch (e) {
        console.warn(`[Database Auto-Recovery] Candidate ${file} unreadable, trying next:`, e);
      }
    }
  } catch (err) {
    console.error('[Database Auto-Recovery] Error during backup search:', err);
  }
  return null;
}

// Internal raw read without triggering recovery loops
function readDatabaseRaw(): any {
  if (fs.existsSync(DB_FILE)) {
    try {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      if (raw && raw.trim().length > 0) {
        const parsed = JSON.parse(raw);
        return {
          ...DEFAULT_INITIAL_DATA,
          ...parsed,
          settings: {
            ...DEFAULT_INITIAL_DATA.settings,
            ...(parsed.settings || {}),
            warehouses: Array.isArray(parsed.settings?.warehouses) && parsed.settings.warehouses.length > 0
              ? parsed.settings.warehouses
              : DEFAULT_INITIAL_DATA.settings.warehouses,
          },
        };
      }
    } catch {}
  }
  return DEFAULT_INITIAL_DATA;
}

// Thread-safe atomic file persistence with auto-recovery
function readDatabase() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      if (raw && raw.trim().length > 0) {
        const parsed = JSON.parse(raw);
        return {
          ...DEFAULT_INITIAL_DATA,
          ...parsed,
          settings: {
            ...DEFAULT_INITIAL_DATA.settings,
            ...(parsed.settings || {}),
            warehouses: Array.isArray(parsed.settings?.warehouses) && parsed.settings.warehouses.length > 0
              ? parsed.settings.warehouses
              : DEFAULT_INITIAL_DATA.settings.warehouses,
          },
        };
      }
    }
  } catch (err) {
    console.error('[Database Integrity ALERT] Corrupted database.json detected! Initiating automatic recovery...', err);
    try {
      const corruptArchive = path.join(DATA_DIR, `database.corrupt.${Date.now()}.json`);
      fs.copyFileSync(DB_FILE, corruptArchive);
      console.log(`[Database Integrity] Corrupted file preserved at: ${corruptArchive}`);
    } catch {}

    const recovered = restoreFromLatestBackup();
    if (recovered) {
      return recovered;
    }
  }

  // Initialize DB if not present
  writeDatabase(DEFAULT_INITIAL_DATA, false);
  return DEFAULT_INITIAL_DATA;
}

function writeDatabase(data: any, allowAutoSnapshot = true, autoIncrementRev = false): boolean {
  try {
    const currentRev = typeof data.revision === 'number' ? data.revision : 1;
    const nowIso = new Date().toISOString();
    const payload = {
      ...data,
      revision: autoIncrementRev ? currentRev + 1 : currentRev,
      updatedAt: data.updatedAt || nowIso,
    };

    // Calculate integrity checksum
    const rawContent = JSON.stringify(payload, null, 2);
    payload.checksum = crypto.createHash('sha256').update(rawContent).digest('hex');
    data.checksum = payload.checksum;
    data.revision = payload.revision;

    const finalJson = JSON.stringify(payload, null, 2);
    const tempFile = `${DB_FILE}.tmp.${Date.now()}.${Math.random().toString(36).substring(2, 7)}`;
    fs.writeFileSync(tempFile, finalJson, 'utf-8');
    fs.renameSync(tempFile, DB_FILE);

    // Auto-snapshot if more than 4 hours elapsed since last auto-backup
    if (allowAutoSnapshot && (Date.now() - lastAutoBackupTime > 4 * 60 * 60 * 1000 || lastAutoBackupTime === 0)) {
      createBackup('auto', 'پشتیبان‌گیری خودکار دوره‌ای سیستم');
    }

    return true;
  } catch (err) {
    console.error('[Database] Failed to write database file:', err);
    return false;
  }
}

// -------------------------------------------------------------
// AUTHENTICATION, PASSWORD HASHING (SCRYPT), SESSION & RBAC
// -------------------------------------------------------------

const SESSION_COOKIE_NAME = 'mana_session';
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const SESSION_SECRET_FILE = path.join(DATA_DIR, '.session_secret');

function loadOrCreateSessionSecret(): string {
  const envSecret = (process.env.SESSION_SECRET || '').trim();
  if (envSecret.length >= 16) return envSecret;
  try {
    if (fs.existsSync(SESSION_SECRET_FILE)) {
      const existing = fs.readFileSync(SESSION_SECRET_FILE, 'utf-8').trim();
      if (existing.length >= 32) return existing;
    }
    const generated = crypto.randomBytes(32).toString('hex');
    fs.writeFileSync(SESSION_SECRET_FILE, generated, { encoding: 'utf-8', mode: 0o600 });
    return generated;
  } catch {
    return crypto.randomBytes(32).toString('hex');
  }
}

const SESSION_SECRET = loadOrCreateSessionSecret();

function isHashedSecret(val?: string): boolean {
  return typeof val === 'string' && val.startsWith('scrypt$') && val.split('$').length === 3;
}

function hashSecret(plain: string): string {
  const clean = String(plain || '').trim();
  if (!clean) return '';
  if (isHashedSecret(clean)) return clean;
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(clean, salt, 64).toString('hex');
  return `scrypt$${salt}$${derived}`;
}

function verifySecret(plain: string, stored?: string): boolean {
  const candidate = String(plain || '').trim();
  const target = String(stored || '').trim();
  if (!candidate || !target) return false;

  if (isHashedSecret(target)) {
    const parts = target.split('$');
    const salt = parts[1];
    const hashHex = parts[2];
    if (!salt || !hashHex) return false;
    try {
      const derived = crypto.scryptSync(candidate, salt, 64);
      const storedBuf = Buffer.from(hashHex, 'hex');
      if (derived.length !== storedBuf.length) return false;
      return crypto.timingSafeEqual(derived, storedBuf);
    } catch {
      return false;
    }
  }

  // Backward-compatible verification for legacy plaintext passwords (upgraded on login/startup)
  const candBuf = Buffer.from(candidate, 'utf-8');
  const targetBuf = Buffer.from(target, 'utf-8');
  if (candBuf.length !== targetBuf.length) return false;
  return crypto.timingSafeEqual(candBuf, targetBuf);
}

function normalizePersianDigitsServer(input: string): string {
  return String(input || '')
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660));
}

function ensureUsersPasswordsHashed(users: any[]): { users: any[]; changed: boolean } {
  if (!Array.isArray(users)) return { users: [], changed: false };
  let changed = false;
  const updated = users.map((u) => {
    if (!u || typeof u !== 'object') return u;
    const clone = { ...u };
    const rawPass = typeof clone.password === 'string' ? clone.password.trim() : '';
    const rawPin = typeof clone.pin === 'string' ? clone.pin.trim() : '';

    if (rawPass && !isHashedSecret(rawPass)) {
      clone.password = hashSecret(rawPass);
      changed = true;
    } else if (!rawPass && rawPin) {
      clone.password = isHashedSecret(rawPin) ? rawPin : hashSecret(rawPin);
      changed = true;
    }

    if (rawPin && !isHashedSecret(rawPin)) {
      clone.pin = rawPin === rawPass && clone.password ? clone.password : hashSecret(rawPin);
      changed = true;
    }
    return clone;
  });
  return { users: updated, changed };
}

const DEFAULT_ROLE_PERMISSIONS_SERVER: Record<string, Record<string, boolean>> = {
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

function normalizeUserPermissionsServer(role: string, perms?: Record<string, any> | null): Record<string, boolean> {
  const safeRole = String(role || 'custom');
  const defaults = DEFAULT_ROLE_PERMISSIONS_SERVER[safeRole] || DEFAULT_ROLE_PERMISSIONS_SERVER.custom;
  if (safeRole === 'admin') {
    return { ...DEFAULT_ROLE_PERMISSIONS_SERVER.admin };
  }
  const p = perms && typeof perms === 'object' ? perms : {};
  const isStrictAccountant = safeRole === 'accountant';
  const isRestrictedFromBuyPrices = safeRole === 'cashier' || safeRole === 'warehouse';

  return {
    canCreateInvoice: isStrictAccountant ? false : Boolean(p.canCreateInvoice ?? defaults.canCreateInvoice),
    canViewInvoices: Boolean(p.canViewInvoices ?? defaults.canViewInvoices),
    canCreatePurchaseInvoice: isStrictAccountant ? false : Boolean(p.canCreatePurchaseInvoice ?? defaults.canCreatePurchaseInvoice),
    canViewPurchaseInvoices: Boolean(
      p.canViewPurchaseInvoices ?? defaults.canViewPurchaseInvoices ?? (p.canViewInvoices || p.canManageInventory)
    ),
    canSettleInvoices: isStrictAccountant
      ? false
      : Boolean(p.canSettleInvoices ?? defaults.canSettleInvoices ?? (p.canCreateInvoice || p.canViewReports)),
    canDeleteInvoice: isStrictAccountant ? false : Boolean(p.canDeleteInvoice ?? defaults.canDeleteInvoice),
    canManageInventory: isStrictAccountant ? false : Boolean(p.canManageInventory ?? defaults.canManageInventory),
    canManageCustomers: Boolean(p.canManageCustomers ?? defaults.canManageCustomers),
    canViewReports: Boolean(p.canViewReports ?? defaults.canViewReports),
    canViewBuyPrices: isRestrictedFromBuyPrices
      ? false
      : isStrictAccountant
        ? true
        : Boolean(p.canViewBuyPrices ?? defaults.canViewBuyPrices),
    canAccessAdmin: isStrictAccountant ? false : Boolean(p.canAccessAdmin ?? defaults.canAccessAdmin),
    canManageUsers: isStrictAccountant ? false : Boolean(p.canManageUsers ?? defaults.canManageUsers),
  };
}

function verifyUserPasswordServer(user: any, rawPassword: string): boolean {
  const raw = String(rawPassword || '').trim();
  if (!user || !raw) return false;
  const normalized = normalizePersianDigitsServer(raw);
  const storedPass = user.password || user.pin || '1234';
  if (verifySecret(raw, storedPass) || (normalized !== raw && verifySecret(normalized, storedPass))) {
    return true;
  }
  if (user.pin && user.pin !== storedPass) {
    if (verifySecret(raw, user.pin) || (normalized !== raw && verifySecret(normalized, user.pin))) {
      return true;
    }
  }
  return false;
}

function computeSessionFingerprint(user: any): string {
  const material = `${String(user?.password || '')}::${String(user?.pin || '')}`;
  return crypto.createHmac('sha256', SESSION_SECRET).update(material).digest('hex').slice(0, 16);
}

function sanitizeUserForClient(u: any): any {
  if (!u || typeof u !== 'object') return u;
  const { password, pin, ...safe } = u;
  const normalizedPerms = normalizeUserPermissionsServer(safe.role, safe.permissions);
  return {
    ...safe,
    permissions: normalizedPerms,
    hasPassword: Boolean(password || pin),
  };
}

interface AuthSessionPayload {
  userId: string;
  username: string;
  role: string;
  permissions: Record<string, boolean>;
  pwSig?: string;
  exp: number;
}

interface AuthenticatedRequest extends express.Request {
  authUser?: AuthSessionPayload;
}

function isAdminUser(user?: { role?: string; permissions?: Record<string, boolean> } | null): boolean {
  return Boolean(user && (user.role === 'admin' || user.permissions?.canAccessAdmin === true));
}

function isReadOnlyAccountant(user?: { role?: string } | null): boolean {
  return Boolean(user && user.role === 'accountant');
}

function sanitizeDbForClient(data: any, authUser?: AuthSessionPayload): any {
  if (!data || typeof data !== 'object') return data;
  const isAdmin = isAdminUser(authUser);
  const canManageUsers = isAdmin || Boolean(authUser?.permissions?.canManageUsers);
  const canViewLogs = isAdmin || canManageUsers;
  const allUsers = Array.isArray(data.users) ? data.users : [];
  const safeUsers = canManageUsers
    ? allUsers.map(sanitizeUserForClient)
    : allUsers.filter((u: any) => u?.id === authUser?.userId).map(sanitizeUserForClient);
  let safeSettings = data.settings;
  if (safeSettings && typeof safeSettings === 'object' && !isAdmin) {
    safeSettings = {
      ...safeSettings,
      telegramBotToken: '',
      aiApiKey: '',
    };
  }
  return {
    ...data,
    users: safeUsers,
    activityLogs: canViewLogs ? mergeActivityLogs(data.activityLogs, []) : [],
    ...(safeSettings ? { settings: safeSettings } : {}),
  };
}

function signSessionToken(user: any): string {
  const payload: AuthSessionPayload = {
    userId: String(user.id || ''),
    username: String(user.username || ''),
    role: String(user.role || 'cashier'),
    permissions: normalizeUserPermissionsServer(String(user.role || 'cashier'), user.permissions),
    pwSig: computeSessionFingerprint(user),
    exp: Date.now() + SESSION_TTL_MS,
  };
  const encoded = Buffer.from(JSON.stringify(payload), 'utf-8').toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(encoded).digest('base64url');
  return `${encoded}.${sig}`;
}

function verifySessionToken(token?: string | null): AuthSessionPayload | null {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encoded, sig] = parts;
  if (!encoded || !sig) return null;
  const expectedSig = crypto.createHmac('sha256', SESSION_SECRET).update(encoded).digest('base64url');
  const sigBuf = Buffer.from(sig, 'utf-8');
  const expBuf = Buffer.from(expectedSig, 'utf-8');
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }
  try {
    const parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf-8')) as AuthSessionPayload;
    if (!parsed || !parsed.userId || !parsed.exp || Date.now() > parsed.exp) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function parseCookies(cookieHeader?: string): Record<string, string> {
  const result: Record<string, string> = {};
  if (!cookieHeader) return result;
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    if (key) {
      try {
        result[key] = decodeURIComponent(val);
      } catch {
        result[key] = val;
      }
    }
  }
  return result;
}

function extractAuthToken(req: express.Request): string | null {
  const authHeader = req.headers.authorization;
  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    if (token) return token;
  }
  const cookies = parseCookies(req.headers.cookie);
  if (cookies[SESSION_COOKIE_NAME]) {
    return cookies[SESSION_COOKIE_NAME];
  }
  return null;
}

function setSessionCookie(req: express.Request, res: express.Response, token: string) {
  const isSecure = req.secure || req.headers['x-forwarded-proto'] === 'https';
  const attrs = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`,
  ];
  if (isSecure) attrs.push('Secure');
  res.setHeader('Set-Cookie', attrs.join('; '));
}

function clearSessionCookie(res: express.Response) {
  res.setHeader(
    'Set-Cookie',
    `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`
  );
}

// Server-side brute-force lockout tracker (5 consecutive failures -> 60s lockout)
interface LoginAttemptState {
  count: number;
  lockedUntil: number;
}
const loginAttemptsMap = new Map<string, LoginAttemptState>();
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 60 * 1000;

function getLoginAttemptKey(req: express.Request, username: string): string {
  const ip = req.ip || req.socket?.remoteAddress || 'unknown';
  return `${ip}:${username.trim().toLowerCase()}`;
}

function checkLoginLockout(key: string): number {
  const rec = loginAttemptsMap.get(key);
  if (!rec) return 0;
  if (rec.lockedUntil > Date.now()) {
    return Math.ceil((rec.lockedUntil - Date.now()) / 1000);
  }
  if (rec.lockedUntil > 0 && rec.lockedUntil <= Date.now()) {
    loginAttemptsMap.delete(key);
  }
  return 0;
}

function recordFailedLoginAttempt(key: string): { attemptsLeft: number; lockedSeconds: number } {
  const rec = loginAttemptsMap.get(key) || { count: 0, lockedUntil: 0 };
  rec.count += 1;
  if (rec.count >= MAX_LOGIN_ATTEMPTS) {
    rec.lockedUntil = Date.now() + LOCKOUT_DURATION_MS;
    loginAttemptsMap.set(key, rec);
    return { attemptsLeft: 0, lockedSeconds: Math.ceil(LOCKOUT_DURATION_MS / 1000) };
  }
  loginAttemptsMap.set(key, rec);
  return { attemptsLeft: MAX_LOGIN_ATTEMPTS - rec.count, lockedSeconds: 0 };
}

function clearLoginAttempts(key: string) {
  loginAttemptsMap.delete(key);
}

// Safe HTML escaping for Telegram Bot HTML parse_mode messages
function escapeTelegramHtml(val: any): string {
  return String(val ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Merge helper for stale-revision concurrent POST /api/db requests
function mergeCollectionById(currentArr: any[], incomingArr: any[], delSet: Set<string>): any[] {
  const map = new Map<string, any>();
  for (const item of Array.isArray(currentArr) ? currentArr : []) {
    if (item && item.id && !delSet.has(item.id)) {
      map.set(item.id, item);
    }
  }
  for (const item of Array.isArray(incomingArr) ? incomingArr : []) {
    if (item && item.id && !delSet.has(item.id)) {
      map.set(item.id, item);
    }
  }
  return Array.from(map.values());
}

// -------------------------------------------------------------
// ACCURATE & TAMPER-RESISTANT ACTIVITY AUDIT LOGGING HELPERS
// -------------------------------------------------------------
const MAX_ACTIVITY_LOGS = 2000;

function gregorianToJalaliServer(gy: number, gm: number, gd: number): [number, number, number] {
  const g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  let jy = gy <= 1600 ? 0 : 979;
  let adjGy = gy - (gy <= 1600 ? 621 : 1600);
  const gy2 = gm > 2 ? adjGy + 1 : adjGy;
  let days =
    365 * adjGy +
    Math.floor((gy2 + 3) / 4) -
    Math.floor((gy2 + 99) / 100) +
    Math.floor((gy2 + 399) / 400) -
    80 +
    gd +
    g_d_m[gm - 1];
  jy += 33 * Math.floor(days / 12053);
  days %= 12053;
  jy += 4 * Math.floor(days / 1461);
  days %= 1461;
  jy += Math.floor((days - 1) / 365);
  if (days > 0) {
    days = (days - 1) % 365;
  }
  let jm: number;
  let jd: number;
  if (days < 186) {
    jm = 1 + Math.floor(days / 31);
    jd = 1 + (days % 31);
  } else {
    jm = 7 + Math.floor((days - 186) / 30);
    jd = 1 + ((days - 186) % 30);
  }
  return [jy, jm, jd];
}

function getTehranJalaliDateTime(date: Date = new Date()): { dateOnly: string; time: string; timestamp: string; createdAtMs: number } {
  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Tehran',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).formatToParts(date);
    const getPart = (t: string) => Number(parts.find((p) => p.type === t)?.value || 0);
    const gy = getPart('year') || date.getFullYear();
    const gm = getPart('month') || date.getMonth() + 1;
    const gd = getPart('day') || date.getDate();
    const hh = getPart('hour') % 24;
    const mm = getPart('minute');
    const ss = getPart('second');
    const [jy, jm, jd] = gregorianToJalaliServer(gy, gm, gd);
    const dateOnly = `${jy}/${pad(jm)}/${pad(jd)}`;
    const time = `${pad(hh)}:${pad(mm)}:${pad(ss)}`;
    return { dateOnly, time, timestamp: `${dateOnly} - ${time}`, createdAtMs: date.getTime() };
  } catch {
    const [jy, jm, jd] = gregorianToJalaliServer(date.getFullYear(), date.getMonth() + 1, date.getDate());
    const dateOnly = `${jy}/${pad(jm)}/${pad(jd)}`;
    const time = `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
    return { dateOnly, time, timestamp: `${dateOnly} - ${time}`, createdAtMs: date.getTime() };
  }
}

function getRequestClientIp(req?: express.Request): string {
  if (!req) return 'system';
  const fwd = req.headers['x-forwarded-for'];
  let ip = '';
  if (typeof fwd === 'string' && fwd.trim()) {
    ip = fwd.split(',')[0].trim();
  } else if (Array.isArray(fwd) && fwd.length > 0) {
    ip = String(fwd[0]).trim();
  } else {
    ip = String(req.ip || req.socket?.remoteAddress || '').trim();
  }
  if (ip.startsWith('::ffff:')) ip = ip.slice(7);
  if (ip === '::1') ip = '127.0.0.1';
  return ip || 'نامشخص';
}

function parseUserAgentSummary(req?: express.Request): string {
  if (!req) return 'هسته سرور';
  const ua = String(req.headers['user-agent'] || '');
  if (!ua) return 'مرورگر وب';
  if (/curl|wget|node-fetch|undici|python/i.test(ua)) return 'درخواست API / اسکریپت';

  let os = 'نامشخص';
  let form = 'رایانه';
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

function inferActivitySeverityServer(actionType?: string, category?: string): 'info' | 'warning' | 'critical' {
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

function isLegacyDemoSeedLog(log: any): boolean {
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

function normalizeLogMetadata(rawMeta: any): Record<string, string | number | boolean | null> | undefined {
  if (!rawMeta || typeof rawMeta !== 'object' || Array.isArray(rawMeta)) return undefined;
  const cleaned: Record<string, string | number | boolean | null> = {};
  let count = 0;
  for (const [k, v] of Object.entries(rawMeta)) {
    if (count >= 16) break;
    const key = String(k || '').trim().slice(0, 60);
    if (!key) continue;
    if (v === null) {
      cleaned[key] = null;
      count++;
    } else if (typeof v === 'string') {
      cleaned[key] = v.slice(0, 300);
      count++;
    } else if (typeof v === 'number' || typeof v === 'boolean') {
      cleaned[key] = v;
      count++;
    }
  }
  return count > 0 ? cleaned : undefined;
}

function computeLogSortMs(log: any): number {
  if (typeof log?.createdAtMs === 'number' && Number.isFinite(log.createdAtMs) && log.createdAtMs > 0) {
    return log.createdAtMs;
  }
  const idMatch = String(log?.id || '').match(/^log-(\d{12,15})(?:-|$)/);
  if (idMatch) {
    return Number(idMatch[1]);
  }
  const ts = normalizePersianDigitsServer(String(log?.timestamp || log?.dateOnly || ''));
  const match = ts.match(/(\d{4})\/(\d{1,2})\/(\d{1,2})(?:\D+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
  if (match) {
    const [gy, gm, gd] = jalaliToGregorianServer(Number(match[1]), Number(match[2]), Number(match[3]));
    const hh = Number(match[4] || 0);
    const mm = Number(match[5] || 0);
    const ss = Number(match[6] || 0);
    // Tehran wall clock is UTC+03:30
    return Date.UTC(gy, gm - 1, gd, hh, mm, ss) - 3.5 * 3600 * 1000;
  }
  return 0;
}

function mergeActivityLogs(existingArr: any, incomingArr: any, maxItems: number = MAX_ACTIVITY_LOGS): any[] {
  const map = new Map<string, any>();
  const addItems = (arr: any) => {
    if (!Array.isArray(arr)) return;
    for (const raw of arr) {
      if (!raw || typeof raw !== 'object' || !raw.id || isLegacyDemoSeedLog(raw)) continue;
      const id = String(raw.id);
      const prev = map.get(id);
      const normalized = {
        ...raw,
        id,
        severity: raw.severity || inferActivitySeverityServer(raw.actionType, raw.category),
        ...(typeof raw.createdAtMs === 'number' && Number.isFinite(raw.createdAtMs) ? { createdAtMs: raw.createdAtMs } : {}),
      };
      if (!prev) {
        map.set(id, normalized);
      } else {
        // Keep richer entry (server-stamped fields win)
        map.set(id, {
          ...prev,
          ...normalized,
          ipAddress: prev.ipAddress || normalized.ipAddress,
          source: prev.source === 'server' || normalized.source === 'server' ? 'server' : (normalized.source || prev.source),
          createdAtMs: normalized.createdAtMs || prev.createdAtMs,
        });
      }
    }
  };

  addItems(existingArr);
  addItems(incomingArr);

  return Array.from(map.values())
    .sort((a, b) => computeLogSortMs(b) - computeLogSortMs(a))
    .slice(0, maxItems);
}

function buildServerLogEntry(
  req: express.Request | undefined,
  params: {
    userId?: string;
    userName?: string;
    userRole?: string;
    userRoleTitle?: string;
    category: string;
    actionType: string;
    actionTitle: string;
    details: string;
    severity?: 'info' | 'warning' | 'critical';
    source?: 'client' | 'server';
    entityType?: string;
    entityId?: string;
    entityLabel?: string;
    metadata?: Record<string, string | number | boolean | null>;
    deviceInfo?: string;
  }
) {
  const dt = getTehranJalaliDateTime();
  return {
    id: `log-${dt.createdAtMs}-${crypto.randomBytes(3).toString('hex')}`,
    userId: params.userId || 'system',
    userName: params.userName || 'سیستم',
    userRole: params.userRole || 'system',
    userRoleTitle: params.userRoleTitle,
    category: params.category,
    actionType: params.actionType,
    actionTitle: String(params.actionTitle || '').slice(0, 140),
    details: String(params.details || '').slice(0, 800),
    timestamp: dt.timestamp,
    dateOnly: dt.dateOnly,
    createdAtMs: dt.createdAtMs,
    severity: params.severity || inferActivitySeverityServer(params.actionType, params.category),
    source: params.source || 'server',
    ipAddress: getRequestClientIp(req),
    deviceInfo: params.deviceInfo || parseUserAgentSummary(req),
    ...(params.entityType ? { entityType: params.entityType } : {}),
    ...(params.entityId ? { entityId: params.entityId } : {}),
    ...(params.entityLabel ? { entityLabel: params.entityLabel } : {}),
    ...(params.metadata ? { metadata: normalizeLogMetadata(params.metadata) } : {}),
  };
}

function appendLogToDbObject(
  dbObj: any,
  req: express.Request | undefined,
  params: Parameters<typeof buildServerLogEntry>[1]
) {
  const entry = buildServerLogEntry(req, params);
  dbObj.activityLogs = mergeActivityLogs([entry], dbObj.activityLogs);
  return entry;
}

async function recordServerActivityLog(
  req: express.Request | undefined,
  params: Parameters<typeof buildServerLogEntry>[1]
) {
  try {
    return await enqueueDbWrite(async () => {
      const { data: currentDb } = await getLatestConvergedDatabase();
      const updatedDb = { ...currentDb };
      const entry = appendLogToDbObject(updatedDb, req, params);
      updatedDb.revision = (typeof currentDb.revision === 'number' ? currentDb.revision : 1) + 1;
      updatedDb.updatedAt = new Date().toISOString();
      updatedDb.checksum = crypto.createHash('sha256').update(JSON.stringify(updatedDb, null, 2)).digest('hex');

      writeDatabase(updatedDb, true, false);
      if (getPostgresStatus().connected) {
        try {
          await saveStateToPostgres(updatedDb);
        } catch (pgErr: any) {
          console.warn('[Postgres Audit Log Sync Notice]:', pgErr?.message);
        }
      }
      return entry;
    });
  } catch (err: any) {
    console.warn('[Audit Log Record Error]:', err?.message);
    return null;
  }
}

// -------------------------------------------------------------
// REST API ENDPOINTS
// -------------------------------------------------------------

// 1. Unified fast healthcheck & status endpoint for Docker, Nginx & monitoring
app.get('/api/health', (_req, res) => {
  const exists = fs.existsSync(DB_FILE);
  let dbStats = { exists, sizeBytes: 0 };
  if (exists) {
    try {
      const stat = fs.statSync(DB_FILE);
      dbStats.sizeBytes = stat.size;
    } catch {}
  }

  let backupsTotal = 0;
  try {
    if (fs.existsSync(BACKUPS_DIR)) {
      backupsTotal = fs.readdirSync(BACKUPS_DIR).filter((f) => f.endsWith('.json')).length;
    }
  } catch {}

  const pgStatus = getPostgresStatus();

  res.status(200).json({
    ok: true,
    status: 'ok',
    mode: process.env.NODE_ENV || 'development',
    timestamp: Date.now(),
    serverTime: new Date().toISOString(),
    database: dbStats,
    postgres: pgStatus,
    backups: {
      total: backupsTotal,
      autoBackupIntervalHours: 4,
    },
  });
});

// 1.0 Public Auth Bootstrap (non-sensitive login screen branding & recovery availability only)
app.get('/api/auth/bootstrap', async (_req, res) => {
  try {
    setNoCacheHeaders(res);
    const { data } = await getLatestConvergedDatabase();
    const s = data?.settings || {};
    const tgToken = sanitizeTelegramBotToken(s.telegramBotToken || process.env.TELEGRAM_BOT_TOKEN);
    const tgChatId = String(s.telegramChatId || process.env.TELEGRAM_CHAT_ID || '').trim();
    res.json({
      success: true,
      requiresAuth: true,
      branding: {
        appName: s.appName || DEFAULT_INITIAL_DATA.settings.appName,
        storeName: s.storeName || DEFAULT_INITIAL_DATA.settings.storeName,
        tagline: s.tagline || DEFAULT_INITIAL_DATA.settings.tagline,
        showStoreEditionBadge: s.showStoreEditionBadge !== false,
      },
      recovery: {
        telegramEnabled: Boolean(tgToken && tgChatId),
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Admin Telegram OTP recovery state (in-memory, short-lived, single-use)
const adminRecoveryCodesMap = new Map<
  string,
  { codeHash: string; expiresAt: number; attempts: number; lastSentAt: number }
>();
const ADMIN_RECOVERY_TTL_MS = 5 * 60 * 1000; // 5 minutes
const ADMIN_RECOVERY_COOLDOWN_MS = 60 * 1000; // 60 seconds between sends
const ADMIN_RECOVERY_MAX_ATTEMPTS = 5;

// 1.0.0a Public Admin Recovery Step 1: Send 6-digit OTP to configured Admin Telegram Chat
app.post('/api/auth/recovery/request-telegram', authLoginLimiter, async (req, res) => {
  try {
    setNoCacheHeaders(res);
    const rawUsername = String(req.body?.username || 'admin').trim().toLowerCase();
    if (!rawUsername) {
      return res.status(400).json({ success: false, message: 'لطفاً نام کاربری ادمین را وارد نمایید.' });
    }

    const { data: dbData } = await getLatestConvergedDatabase();
    const usersList = Array.isArray(dbData?.users) && dbData.users.length > 0
      ? dbData.users
      : DEFAULT_INITIAL_DATA.users;

    const targetAdmin = usersList.find(
      (u: any) => String(u?.username || '').trim().toLowerCase() === rawUsername && isAdminUser(u)
    );

    if (!targetAdmin) {
      return res.status(404).json({
        success: false,
        message: 'حساب مدیر (Admin) با این نام کاربری یافت نشد.',
      });
    }

    const serverSettings = dbData?.settings || {};
    const botToken = sanitizeTelegramBotToken(
      serverSettings?.telegramBotToken || process.env.TELEGRAM_BOT_TOKEN
    );
    const adminChatId = String(
      serverSettings?.telegramChatId || process.env.TELEGRAM_CHAT_ID || ''
    ).trim();

    if (!botToken || !adminChatId) {
      return res.status(400).json({
        success: false,
        message: 'ربات تلگرام یا شناسه چت مدیر در سیستم پیکربندی نشده است. لطفاً از طریق ترمینال سرور (./reset-admin.sh) اقدام کنید.',
      });
    }

    const existing = adminRecoveryCodesMap.get(rawUsername);
    const now = Date.now();
    if (existing && now - existing.lastSentAt < ADMIN_RECOVERY_COOLDOWN_MS) {
      const waitSec = Math.ceil((ADMIN_RECOVERY_COOLDOWN_MS - (now - existing.lastSentAt)) / 1000);
      return res.status(429).json({
        success: false,
        retryAfterSeconds: waitSec,
        message: `لطفاً ${toPersianDigitsServer(waitSec)} ثانیه دیگر برای ارسال مجدد کد صبر کنید.`,
      });
    }

    const otpCode = String(crypto.randomInt(100000, 1000000));
    const storeName = escapeTelegramHtml(serverSettings?.storeName || serverSettings?.appName || 'سامانه فاکتور و انبارداری');
    const safeUser = escapeTelegramHtml(targetAdmin.username || rawUsername);
    const tgMessage = [
      `🔐 <b>کد بازیابی رمز عبور مدیر سیستم</b>`,
      `🏪 سامانه: <b>${storeName}</b>`,
      `👤 نام کاربری: <code>${safeUser}</code>`,
      ``,
      `🔑 کد تأیید ۶ رقمی شما:`,
      `<code>${otpCode}</code>`,
      ``,
      `⏱ اعتبار این کد <b>۵ دقیقه</b> است و فقط یک بار قابل استفاده می‌باشد.`,
      `⚠️ اگر این درخواست توسط شما انجام نشده، این پیام را نادیده بگیرید.`,
    ].join('\n');

    const tgResult = await callTelegramApi('sendMessage', {
      token: botToken,
      body: {
        chat_id: adminChatId,
        text: tgMessage,
        parse_mode: 'HTML',
      },
    });

    if (!tgResult.ok || tgResult.data?.ok === false) {
      return res.status(502).json({
        success: false,
        message: 'ارسال پیام به تلگرام با خطا مواجه شد. لطفاً اتصال ربات تلگرام را بررسی کرده یا از دستور ./reset-admin.sh در ترمینال VPS استفاده کنید.',
      });
    }

    adminRecoveryCodesMap.set(rawUsername, {
      codeHash: hashSecret(otpCode),
      expiresAt: now + ADMIN_RECOVERY_TTL_MS,
      attempts: 0,
      lastSentAt: now,
    });

    await recordServerActivityLog(req, {
      userId: targetAdmin.id,
      userName: targetAdmin.fullName || targetAdmin.username,
      userRole: targetAdmin.role,
      userRoleTitle: targetAdmin.roleTitle || 'مدیر سیستم',
      category: 'auth',
      actionType: 'password_recovery_request',
      actionTitle: 'درخواست کد بازیابی رمز مدیر',
      details: `ارسال کد تأیید ۶ رقمی بازیابی رمز عبور برای نام کاربری «${rawUsername}» به تلگرام`,
      severity: 'warning',
      entityType: 'user',
      entityId: targetAdmin.id,
      entityLabel: targetAdmin.username,
    });

    return res.json({
      success: true,
      expiresInSeconds: Math.floor(ADMIN_RECOVERY_TTL_MS / 1000),
      message: 'کد تأیید ۶ رقمی با موفقیت به تلگرام مدیر سیستم ارسال شد.',
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: err?.message || 'خطا در ارسال کد بازیابی به تلگرام.',
    });
  }
});

// 1.0.0b Public Admin Recovery Step 2: Verify OTP and set new scrypt-hashed admin password
app.post('/api/auth/recovery/confirm-telegram', authLoginLimiter, async (req, res) => {
  try {
    setNoCacheHeaders(res);
    const rawUsername = String(req.body?.username || 'admin').trim().toLowerCase();
    const rawCode = normalizePersianDigitsServer(String(req.body?.code || '')).replace(/\s+/g, '');
    const rawNewPassword = String(req.body?.newPassword || '').trim();

    if (!rawUsername || !rawCode || !rawNewPassword) {
      return res.status(400).json({
        success: false,
        message: 'لطفاً نام کاربری، کد تأیید ۶ رقمی و رمز عبور جدید را کامل وارد نمایید.',
      });
    }

    if (rawNewPassword.length < 4) {
      return res.status(400).json({
        success: false,
        message: 'رمز عبور جدید باید حداقل ۴ کاراکتر باشد.',
      });
    }

    const record = adminRecoveryCodesMap.get(rawUsername);
    if (!record || Date.now() > record.expiresAt) {
      adminRecoveryCodesMap.delete(rawUsername);
      return res.status(400).json({
        success: false,
        message: 'کد تأیید منقضی شده یا نامعتبر است. لطفاً مجدداً درخواست ارسال کد دهید.',
      });
    }

    if (!verifySecret(rawCode, record.codeHash)) {
      record.attempts += 1;
      if (record.attempts >= ADMIN_RECOVERY_MAX_ATTEMPTS) {
        adminRecoveryCodesMap.delete(rawUsername);
        return res.status(429).json({
          success: false,
          message: 'تعداد تلاش‌های اشتباه بیش از حد مجاز شد. کد قبلی باطل گردید؛ لطفاً کد جدید دریافت کنید.',
        });
      }
      adminRecoveryCodesMap.set(rawUsername, record);
      return res.status(401).json({
        success: false,
        message: `کد تأیید اشتباه است. (${toPersianDigitsServer(ADMIN_RECOVERY_MAX_ATTEMPTS - record.attempts)} تلاش باقی‌مانده)`,
      });
    }

    // Consume OTP immediately (single-use)
    adminRecoveryCodesMap.delete(rawUsername);

    const newHash = hashSecret(rawNewPassword);
    let updatedAdminName = rawUsername;

    await enqueueDbWrite(async () => {
      const { data: currentDb } = await getLatestConvergedDatabase();
      const users = Array.isArray(currentDb.users) && currentDb.users.length > 0
        ? [...currentDb.users]
        : [...DEFAULT_INITIAL_DATA.users];

      const idx = users.findIndex(
        (u: any) => String(u?.username || '').trim().toLowerCase() === rawUsername && isAdminUser(u)
      );
      if (idx === -1) {
        throw new Error('حساب مدیر با این نام کاربری یافت نشد.');
      }

      updatedAdminName = users[idx].fullName || users[idx].username;
      users[idx] = {
        ...users[idx],
        password: newHash,
        pin: newHash,
        isActive: true,
      };

      const nextRev = (typeof currentDb.revision === 'number' ? currentDb.revision : 1) + 1;
      const nowIso = new Date().toISOString();
      const nextDb: any = {
        ...currentDb,
        users,
        revision: nextRev,
        updatedAt: nowIso,
        lastUpdated: Date.now(),
      };
      appendLogToDbObject(nextDb, req, {
        userId: users[idx].id,
        userName: updatedAdminName,
        userRole: users[idx].role,
        userRoleTitle: users[idx].roleTitle || 'مدیر سیستم',
        category: 'auth',
        actionType: 'password_recovery_reset',
        actionTitle: 'بازنشانی رمز مدیر از طریق تلگرام',
        details: `تغییر و بازنشانی رمز عبور حساب مدیر «${updatedAdminName}» (${rawUsername}) با تأیید کد تلگرام`,
        severity: 'critical',
        entityType: 'user',
        entityId: users[idx].id,
        entityLabel: rawUsername,
      });
      nextDb.checksum = crypto.createHash('sha256').update(JSON.stringify(nextDb, null, 2)).digest('hex');

      writeDatabase(nextDb, false, false);
      if (getPostgresStatus().connected) {
        await saveStateToPostgres(nextDb);
      }
    });

    // Clear any brute-force lockout entries for this username across all IPs
    for (const key of Array.from(loginAttemptsMap.keys())) {
      if (key.endsWith(`:${rawUsername}`)) {
        loginAttemptsMap.delete(key);
      }
    }

    console.log(`[Security Recovery] Admin password reset via Telegram OTP for user: ${rawUsername} (${updatedAdminName})`);
    return res.json({
      success: true,
      message: 'رمز عبور مدیر با موفقیت بازنشانی شد. اکنون می‌توانید با رمز جدید وارد شوید.',
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: err?.message || 'خطا در ثبت رمز عبور جدید.',
    });
  }
});

// 1.0.1 Public Login Endpoint with server-side scrypt verification & brute-force lockout
app.post('/api/auth/login', authLoginLimiter, async (req, res) => {
  try {
    setNoCacheHeaders(res);
    const rawUsername = String(req.body?.username || '').trim().toLowerCase();
    const rawPassword = String(req.body?.password || '').trim();

    if (!rawUsername || !rawPassword) {
      return res.status(400).json({
        success: false,
        message: 'لطفاً نام کاربری و رمز عبور را وارد نمایید.',
      });
    }

    const attemptKey = getLoginAttemptKey(req, rawUsername);
    const lockedSeconds = checkLoginLockout(attemptKey);
    if (lockedSeconds > 0) {
      return res.status(429).json({
        success: false,
        retryAfterSeconds: lockedSeconds,
        message: `به دلیل ۵ تلاش ناموفق پیاپی، دسترسی ورود به مدت ${toPersianDigitsServer(lockedSeconds)} ثانیه مسدود است.`,
      });
    }

    const { data: dbData } = await getLatestConvergedDatabase();
    const usersList = Array.isArray(dbData?.users) && dbData.users.length > 0
      ? dbData.users
      : DEFAULT_INITIAL_DATA.users;

    const matchedUser = usersList.find(
      (u: any) => String(u?.username || '').trim().toLowerCase() === rawUsername
    );

    if (!matchedUser) {
      const fail = recordFailedLoginAttempt(attemptKey);
      await recordServerActivityLog(req, {
        userId: 'unknown',
        userName: `کاربر ناشناس (${rawUsername})`,
        userRole: 'unknown',
        category: 'auth',
        actionType: fail.lockedSeconds > 0 ? 'failed_login_lockout' : 'failed_login',
        actionTitle: fail.lockedSeconds > 0 ? 'مسدودسازی موقت ورود به سامانه' : 'تلاش ناموفق برای ورود',
        details: fail.lockedSeconds > 0
          ? `مسدودسازی ۶۰ ثانیه‌ای به دلیل ۵ تلاش ناموفق با نام کاربری نامعتبر «${rawUsername}»`
          : `تلاش ناموفق ورود با نام کاربری یافت‌نشده «${rawUsername}» (${toPersianDigitsServer(fail.attemptsLeft)} تلاش باقی‌مانده)`,
        severity: fail.lockedSeconds > 0 ? 'critical' : 'warning',
      });
      return res.status(fail.lockedSeconds > 0 ? 429 : 401).json({
        success: false,
        attemptsLeft: fail.attemptsLeft,
        retryAfterSeconds: fail.lockedSeconds,
        message:
          fail.lockedSeconds > 0
            ? 'به دلیل ۵ تلاش ناموفق پیاپی، دسترسی ورود موقتاً به مدت ۶۰ ثانیه مسدود گردید.'
            : `نام کاربری یا رمز عبور اشتباه است. (${toPersianDigitsServer(fail.attemptsLeft)} تلاش باقی‌مانده)`,
      });
    }

    if (matchedUser.isActive === false) {
      await recordServerActivityLog(req, {
        userId: matchedUser.id,
        userName: matchedUser.fullName || matchedUser.username,
        userRole: matchedUser.role,
        userRoleTitle: matchedUser.roleTitle,
        category: 'auth',
        actionType: 'failed_login',
        actionTitle: 'تلاش ورود به حساب غیرفعال',
        details: `جلوگیری از ورود حساب کاربری غیرفعال «${matchedUser.fullName || matchedUser.username}» (${matchedUser.username})`,
        severity: 'warning',
      });
      return res.status(403).json({
        success: false,
        message: 'این حساب کاربری غیرفعال شده است. لطفاً با مدیر سیستم تماس بگیرید.',
      });
    }

    const isPasswordMatch = verifyUserPasswordServer(matchedUser, rawPassword);

    if (!isPasswordMatch) {
      const fail = recordFailedLoginAttempt(attemptKey);
      await recordServerActivityLog(req, {
        userId: matchedUser.id,
        userName: matchedUser.fullName || matchedUser.username,
        userRole: matchedUser.role,
        userRoleTitle: matchedUser.roleTitle,
        category: 'auth',
        actionType: fail.lockedSeconds > 0 ? 'failed_login_lockout' : 'failed_login',
        actionTitle: fail.lockedSeconds > 0 ? 'قفل شدن ورود به دلیل رمز اشتباه' : 'ورود ناموفق (رمز عبور نادرست)',
        details: fail.lockedSeconds > 0
          ? `مسدودسازی موقت ورود حساب «${matchedUser.fullName || matchedUser.username}» (${matchedUser.username}) پس از ۵ بار رمز اشتباه`
          : `وارد کردن رمز عبور اشتباه برای «${matchedUser.fullName || matchedUser.username}» (${toPersianDigitsServer(fail.attemptsLeft)} تلاش باقی‌مانده)`,
        severity: fail.lockedSeconds > 0 ? 'critical' : 'warning',
      });
      return res.status(fail.lockedSeconds > 0 ? 429 : 401).json({
        success: false,
        attemptsLeft: fail.attemptsLeft,
        retryAfterSeconds: fail.lockedSeconds,
        message:
          fail.lockedSeconds > 0
            ? 'به دلیل ۵ تلاش ناموفق پیاپی، دسترسی ورود موقتاً به مدت ۶۰ ثانیه مسدود گردید.'
            : `نام کاربری یا رمز عبور اشتباه است. (${toPersianDigitsServer(fail.attemptsLeft)} تلاش باقی‌مانده)`,
      });
    }

    clearLoginAttempts(attemptKey);

    // Upgrade legacy plaintext password (if needed) and record server-verified login log atomically
    await enqueueDbWrite(async () => {
      const { data: latestDb } = await getLatestConvergedDatabase();
      const hashedResult = !isHashedSecret(matchedUser.password)
        ? ensureUsersPasswordsHashed(latestDb.users || [])
        : { changed: false, users: latestDb.users };
      if (hashedResult.changed) {
        latestDb.users = hashedResult.users;
      }
      appendLogToDbObject(latestDb, req, {
        userId: matchedUser.id,
        userName: matchedUser.fullName || matchedUser.username,
        userRole: matchedUser.role,
        userRoleTitle: matchedUser.roleTitle,
        category: 'auth',
        actionType: 'login',
        actionTitle: 'ورود موفق به سامانه',
        details: `ورود موفق کاربر «${matchedUser.fullName || matchedUser.username}» (${matchedUser.username}) با نقش ${matchedUser.roleTitle || matchedUser.role}`,
        severity: 'info',
        entityType: 'user',
        entityId: matchedUser.id,
        entityLabel: matchedUser.username,
      });
      latestDb.revision = (typeof latestDb.revision === 'number' ? latestDb.revision : 1) + 1;
      latestDb.updatedAt = new Date().toISOString();
      latestDb.checksum = crypto.createHash('sha256').update(JSON.stringify(latestDb, null, 2)).digest('hex');
      writeDatabase(latestDb, true, false);
      if (getPostgresStatus().connected) {
        saveStateToPostgres(latestDb).catch(() => {});
      }
    }).catch(() => {});

    const token = signSessionToken(matchedUser);
    setSessionCookie(req, res, token);

    return res.json({
      success: true,
      token,
      user: sanitizeUserForClient(matchedUser),
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// 1.0.2 Public Logout Endpoint (logs authenticated user logout cleanly before clearing cookie)
app.post('/api/auth/logout', async (req, res) => {
  try {
    const token = extractAuthToken(req);
    const payload = verifySessionToken(token);
    if (payload) {
      const { data: dbData } = await getLatestConvergedDatabase();
      const liveUser = (dbData?.users || []).find((u: any) => u.id === payload.userId);
      await recordServerActivityLog(req, {
        userId: payload.userId,
        userName: liveUser?.fullName || payload.username,
        userRole: liveUser?.role || payload.role,
        userRoleTitle: liveUser?.roleTitle,
        category: 'auth',
        actionType: 'logout',
        actionTitle: 'خروج از حساب کاربری',
        details: `خروج کاربر «${liveUser?.fullName || payload.username}» (${payload.username}) از سامانه`,
        severity: 'info',
        entityType: 'user',
        entityId: payload.userId,
        entityLabel: payload.username,
      });
    }
  } catch {
    // Do not block logout if logging fails
  }
  clearSessionCookie(res);
  res.json({ success: true });
});

// 1.0.3 Central Authentication Middleware for all protected /api/* routes (hydrates live DB role, active state & password fingerprint)
const authGuardMiddleware: express.RequestHandler = async (req, res, next) => {
  try {
    if (req.method === 'OPTIONS') return next();
    const p = req.path;
    if (
      p === '/health' ||
      p === '/auth/bootstrap' ||
      p === '/auth/login' ||
      p === '/auth/logout' ||
      p === '/auth/recovery/request-telegram' ||
      p === '/auth/recovery/confirm-telegram' ||
      p === '/telegram/webhook' ||
      p.startsWith('/public/invoice/')
    ) {
      return next();
    }

    const token = extractAuthToken(req);
    const payload = verifySessionToken(token);
    if (!payload) {
      return res.status(401).json({
        success: false,
        code: 'UNAUTHORIZED',
        message: 'نشست کاربری معتبر نیست یا منقضی شده است. لطفاً مجدداً وارد سیستم شوید.',
      });
    }

    const { data: dbData } = await getLatestConvergedDatabase();
    const usersList = Array.isArray(dbData?.users) && dbData.users.length > 0
      ? dbData.users
      : DEFAULT_INITIAL_DATA.users;
    const liveUser = usersList.find((u: any) => u?.id === payload.userId);

    if (!liveUser || liveUser.isActive === false) {
      clearSessionCookie(res);
      return res.status(401).json({
        success: false,
        code: 'UNAUTHORIZED',
        message: 'حساب کاربری غیرفعال یا حذف شده است. لطفاً مجدداً وارد سیستم شوید.',
      });
    }

    // Revoke session immediately when the user's password/PIN was changed
    if (payload.pwSig && payload.pwSig !== computeSessionFingerprint(liveUser)) {
      clearSessionCookie(res);
      return res.status(401).json({
        success: false,
        code: 'SESSION_REVOKED',
        message: 'رمز عبور تغییر کرده است و نشست قبلی منقضی شد. لطفاً مجدداً وارد شوید.',
      });
    }

    (req as AuthenticatedRequest).authUser = {
      ...payload,
      username: String(liveUser.username || payload.username),
      role: String(liveUser.role || payload.role),
      permissions: normalizeUserPermissionsServer(liveUser.role, liveUser.permissions),
    };
    next();
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

app.use('/api', authGuardMiddleware);

// Strict read-only guard for 'accountant' role on all mutating /api/* endpoints (verifying live DB role)
const readOnlyAccountantGuard: express.RequestHandler = async (req, res, next) => {
  try {
    const method = req.method.toUpperCase();
    if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
      return next();
    }
    const p = req.path;
    if (
      p === '/auth/login' ||
      p === '/auth/logout' ||
      p === '/auth/switch-user' ||
      p === '/auth/recovery/request-telegram' ||
      p === '/auth/recovery/confirm-telegram' ||
      p === '/telegram/webhook' ||
      p.startsWith('/public/invoice/')
    ) {
      return next();
    }

    const authUser = (req as AuthenticatedRequest).authUser;
    if (!authUser) return next();

    if (isReadOnlyAccountant(authUser)) {
      return res.status(403).json({
        success: false,
        code: 'READ_ONLY_ACCOUNTANT',
        message: 'حساب کاربری با سطح دسترسی حسابدار فقط مجاز به مشاهده اطلاعات است و امکان ثبت، ویرایش یا حذف ندارد.',
      });
    }

    return next();
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

app.use('/api', readOnlyAccountantGuard);

// Admin RBAC middleware verifying live DB role & active state
const requireAdmin: express.RequestHandler = async (req, res, next) => {
  try {
    const authUser = (req as AuthenticatedRequest).authUser;
    if (!authUser) {
      return res.status(401).json({ success: false, message: 'احراز هویت الزامی است.' });
    }
    if (!isAdminUser(authUser)) {
      return res.status(403).json({
        success: false,
        message: 'این عملیات منحصراً برای مدیر سیستم مجاز است.',
      });
    }
    next();
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

const requireAdminOrInventory: express.RequestHandler = async (req, res, next) => {
  try {
    const authUser = (req as AuthenticatedRequest).authUser;
    if (!authUser) {
      return res.status(401).json({ success: false, message: 'احراز هویت الزامی است.' });
    }
    if (!isAdminUser(authUser) && !authUser.permissions?.canManageInventory) {
      return res.status(403).json({
        success: false,
        message: 'این عملیات فقط برای مدیر سیستم یا مسئول انبار مجاز است.',
      });
    }
    next();
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// 1.0.4 Authenticated Session Verification Endpoint
app.get('/api/auth/me', async (req, res) => {
  try {
    setNoCacheHeaders(res);
    const authUser = (req as AuthenticatedRequest).authUser!;
    const { data: dbData } = await getLatestConvergedDatabase();
    const liveUser = (dbData?.users || []).find((u: any) => u.id === authUser.userId);
    if (!liveUser || liveUser.isActive === false) {
      clearSessionCookie(res);
      return res.status(401).json({
        success: false,
        code: 'UNAUTHORIZED',
        message: 'حساب کاربری غیرفعال یا حذف شده است.',
      });
    }
    // Issue refreshed token if role/permissions changed
    const refreshedToken = signSessionToken(liveUser);
    setSessionCookie(req, res, refreshedToken);
    return res.json({
      success: true,
      token: refreshedToken,
      user: sanitizeUserForClient(liveUser),
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// 1.0.5 Authenticated Switch-User Endpoint
app.post('/api/auth/switch-user', authLoginLimiter, async (req, res) => {
  try {
    setNoCacheHeaders(res);
    const authUser = (req as AuthenticatedRequest).authUser!;
    const { targetUserId, username, password, directAdminSwitch } = req.body || {};

    const { data: dbData } = await getLatestConvergedDatabase();
    const usersList = Array.isArray(dbData?.users) ? dbData.users : DEFAULT_INITIAL_DATA.users;
    const callerUser = usersList.find((u: any) => u.id === authUser.userId);
    const callerIsAdmin = Boolean(callerUser && callerUser.isActive !== false && callerUser.role === 'admin');

    let targetUser: any = null;
    if (targetUserId) {
      targetUser = usersList.find((u: any) => u.id === targetUserId);
    } else if (username) {
      const cleanU = String(username).trim().toLowerCase();
      targetUser = usersList.find((u: any) => String(u?.username || '').trim().toLowerCase() === cleanU);
    }

    if (!targetUser) {
      return res.status(401).json({ success: false, message: 'نام کاربری یا رمز عبور اشتباه است.' });
    }
    if (targetUser.isActive === false) {
      return res.status(403).json({ success: false, message: 'این حساب کاربری غیرفعال است.' });
    }

    // Admin switching directly from UsersManager without re-typing password
    if (directAdminSwitch === true) {
      if (!callerIsAdmin) {
        return res.status(403).json({ success: false, message: 'فقط مدیر کل مجاز به تغییر مستقیم نشست است.' });
      }
    } else {
      const rawPass = String(password || '').trim();
      const attemptKey = getLoginAttemptKey(req, targetUser.username || String(targetUserId || 'switch'));
      const lockedSeconds = checkLoginLockout(attemptKey);
      if (lockedSeconds > 0) {
        return res.status(429).json({
          success: false,
          retryAfterSeconds: lockedSeconds,
          message: `به دلیل تلاش‌های ناموفق پیاپی، ورود به مدت ${toPersianDigitsServer(lockedSeconds)} ثانیه قفل است.`,
        });
      }

      const matchesTarget = verifyUserPasswordServer(targetUser, rawPass);
      const matchesCallerAdmin =
        callerIsAdmin && callerUser
          ? verifyUserPasswordServer(callerUser, rawPass)
          : false;

      if (!matchesTarget && !matchesCallerAdmin) {
        const fail = recordFailedLoginAttempt(attemptKey);
        await recordServerActivityLog(req, {
          userId: targetUser.id,
          userName: targetUser.fullName || targetUser.username,
          userRole: targetUser.role,
          userRoleTitle: targetUser.roleTitle,
          category: 'auth',
          actionType: fail.lockedSeconds > 0 ? 'failed_login_lockout' : 'failed_login',
          actionTitle: fail.lockedSeconds > 0 ? 'قفل موقت تعویض کاربر' : 'تلاش ناموفق برای تعویض کاربر',
          details: `رمز عبور اشتباه هنگام تعویض نشست به کاربر «${targetUser.fullName || targetUser.username}» توسط «${callerUser?.fullName || authUser.username}»`,
          severity: fail.lockedSeconds > 0 ? 'critical' : 'warning',
        });
        return res.status(fail.lockedSeconds > 0 ? 429 : 401).json({
          success: false,
          attemptsLeft: fail.attemptsLeft,
          retryAfterSeconds: fail.lockedSeconds,
          message:
            fail.lockedSeconds > 0
              ? 'به دلیل ۵ تلاش ناموفق پیاپی، ورود به مدت ۶۰ ثانیه قفل گردید.'
              : `رمز عبور وارد شده نادرست است. (${toPersianDigitsServer(fail.attemptsLeft)} تلاش باقی‌مانده)`,
        });
      }
      clearLoginAttempts(attemptKey);
    }

    await recordServerActivityLog(req, {
      userId: targetUser.id,
      userName: targetUser.fullName || targetUser.username,
      userRole: targetUser.role,
      userRoleTitle: targetUser.roleTitle,
      category: 'auth',
      actionType: 'switch_user',
      actionTitle: directAdminSwitch ? 'تغییر مستقیم نشست کاربر توسط مدیر' : 'ورود / تعویض نشست کاربری',
      details: `تغییر کاربر فعال از «${callerUser?.fullName || authUser.username}» به «${targetUser.fullName || targetUser.username}» (${targetUser.roleTitle || targetUser.role})`,
      severity: directAdminSwitch ? 'warning' : 'info',
      entityType: 'user',
      entityId: targetUser.id,
      entityLabel: targetUser.username,
    });

    const token = signSessionToken(targetUser);
    setSessionCookie(req, res, token);
    return res.json({
      success: true,
      token,
      user: sanitizeUserForClient(targetUser),
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// 1.1 Detailed Database Diagnostic & Status
app.get('/api/database/status', requireAdmin, async (req, res) => {
  try {
    const diag = await testPostgresConnectionDetails();
    const exists = fs.existsSync(DB_FILE);
    let localFileStats = { exists, sizeBytes: 0, path: DB_FILE };
    if (exists) {
      try {
        const s = fs.statSync(DB_FILE);
        localFileStats.sizeBytes = s.size;
      } catch {}
    }

    const backups = getBackupsList();

    res.json({
      success: true,
      postgres: diag,
      localFile: localFileStats,
      backupsCount: backups.length,
      serverTime: new Date().toISOString(),
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 1.2 Test PostgreSQL Connection manually on demand
app.post('/api/database/test', requireAdmin, async (req, res) => {
  try {
    const result = await testPostgresConnectionDetails();
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 1.3 Force Synchronization from Local to PostgreSQL or vice versa
app.post('/api/database/force-sync', requireAdmin, async (req, res) => {
  try {
    const { data: dbData } = await getLatestConvergedDatabase();
    const dataToSync = dbData || await loadStateFromPostgres() || readDatabase();
    const pgStatus = getPostgresStatus();
    
    if (!pgStatus.connected) {
      // Try testing connection
      const test = await testPostgresConnectionDetails();
      if (!test.connected) {
        return res.status(503).json({
          success: false,
          message: 'امکان اتصال به پایگاه داده PostgreSQL وجود ندارد. لطفاً از روشن بودن کانتینر دیتابیس اطمینان حاصل کنید.',
          details: test,
        });
      }
    }

    const saved = await saveStateToPostgres(dataToSync);
    if (saved) {
      return res.json({
        success: true,
        message: 'کلیه اطلاعات سیستم با موفقیت در جداول پایگاه‌داده PostgreSQL (mana_db) همگام‌سازی و ذخیره شد.',
      });
    } else {
      const errDetail = getLastPostgresSaveError();
      return res.status(500).json({
        success: false,
        message: errDetail
          ? `خطا در ثبت اطلاعات در دیتابیس PostgreSQL: ${errDetail}`
          : 'خطا در ثبت اطلاعات در دیتابیس PostgreSQL. لطفاً از اتصال کانتینر اطمینان حاصل فرمایید.',
      });
    }
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 1.4 Secure Non-Blocking Database Dump Endpoint (100% Read-Only, Isolated ACID Snapshot, Zero Table Wipe)
const handleSecureDatabaseDump = async (req: express.Request, res: express.Response) => {
  try {
    setNoCacheHeaders(res);
    const dump = await exportLiveDatabaseDump(async () => {
      const { data } = await getLatestConvergedDatabase();
      return data || readDatabase();
    });

    res.setHeader('Content-Type', 'application/sql; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${dump.filename}"`);
    res.send(dump.sql);
  } catch (err: any) {
    console.error('[Database Dump Error]:', err);
    res.status(500).json({ success: false, message: `خطا در تهیه خروجی پشتیبان دیتابیس: ${err.message}` });
  }
};

app.get('/api/database/dump-sql', requireAdmin, handleSecureDatabaseDump);
app.all('/api/database/export-sql', requireAdmin, handleSecureDatabaseDump);

// 1.5 Import SQL Script or Raw Data directly into PostgreSQL mana_db
app.post('/api/database/import-sql', requireAdmin, express.text({ type: ['application/sql', 'text/plain'], limit: '50mb' }), async (req, res) => {
  try {
    const rawSql = typeof req.body === 'string' ? req.body : req.body?.sql;
    if (!rawSql || typeof rawSql !== 'string' || rawSql.trim().length === 0) {
      return res.status(400).json({ success: false, message: 'محتوای فایل SQL ارسال نشده است.' });
    }

    const pgStatus = getPostgresStatus();
    if (!pgStatus.connected) {
      // If postgres is not reachable, check if it contains valid JSON or state to sync locally
      return res.status(503).json({
        success: false,
        message: 'پایگاه‌داده PostgreSQL متصل نیست. برای اجرای دستورات SQL دیتابیس باید فعال باشد.',
      });
    }

    const execResult = await executeRawSql(rawSql);
    if (!execResult.success) {
      return res.status(500).json(execResult);
    }

    // Reload system_state from PostgreSQL if updated
    const freshData = await loadStateFromPostgres();
    if (freshData) {
      writeDatabase(freshData, true);
    }

    const authUser = (req as AuthenticatedRequest).authUser;
    const liveUsers = freshData?.users || [];
    const actor = liveUsers.find((u: any) => u.id === authUser?.userId);
    await recordServerActivityLog(req, {
      userId: authUser?.userId || 'admin',
      userName: actor?.fullName || authUser?.username || 'مدیر سیستم',
      userRole: actor?.role || authUser?.role || 'admin',
      userRoleTitle: actor?.roleTitle,
      category: 'system',
      actionType: 'import_sql',
      actionTitle: 'اجرای اسکریپت بازیابی SQL',
      details: `اجرای مستقیم فایل SQL روی پایگاه‌داده PostgreSQL توسط مدیر سیستم (${actor?.fullName || authUser?.username || 'admin'})`,
      severity: 'critical',
    });

    res.json({
      success: true,
      message: 'فایل اسکریپت SQL پایگاه داده با موفقیت در دیتابیس mana_db اجرا و بازیابی شد.',
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 1.6 Create direct snapshot record in PostgreSQL db_backups table
app.post('/api/database/snapshot', requireAdmin, async (req, res) => {
  try {
    const label = req.body?.label || 'نسخه پشتیبان مستقیم دیتابیس';
    let data = await loadStateFromPostgres();
    if (!data) {
      data = readDatabase();
    }

    const snapResult = await createPostgresDbBackupRecord(label, data);
    res.json(snapResult);
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// -------------------------------------------------------------
// DUAL PERSISTENCE CONVERGENCE & WRITE SERIALIZATION (ZERO LOSS ENGINE)
// -------------------------------------------------------------

// Sequential promise chain to serialize all database writes and eliminate race conditions
let dbWriteQueue: Promise<any> = Promise.resolve();

function enqueueDbWrite<T>(task: () => Promise<T>): Promise<T> {
  const next = dbWriteQueue.then(() => task(), () => task());
  dbWriteQueue = next.catch(() => {});
  return next;
}

// Bi-directional state convergence: resolve to authoritative data without mutating on read
async function getLatestConvergedDatabase(): Promise<{ data: any; source: 'postgresql' | 'local-file' }> {
  const localData = readDatabase();
  const localRev = typeof localData?.revision === 'number' ? localData.revision : 1;
  const localUpdated = localData?.updatedAt ? new Date(localData.updatedAt).getTime() : 0;

  let pgData: any = null;
  if (getPostgresStatus().connected) {
    try {
      pgData = await loadStateFromPostgres();
    } catch (e: any) {
      console.warn('[Postgres Read Warning]:', e.message);
    }
  }

  // If Postgres has populated data, PostgreSQL is the authoritative source of truth
  if (pgData && typeof pgData === 'object' && Array.isArray(pgData.products) && pgData.products.length > 0) {
    const pgRev = typeof pgData.revision === 'number' ? pgData.revision : 1;
    const pgUpdated = pgData.updatedAt ? new Date(pgData.updatedAt).getTime() : 0;

    // Only prefer local if local has both higher revision AND contains actual products
    if (
      (localRev > pgRev || (localRev === pgRev && localUpdated > pgUpdated)) &&
      Array.isArray(localData?.products) &&
      localData.products.length > 0
    ) {
      return { data: localData, source: 'local-file' };
    }

    return { data: pgData, source: 'postgresql' };
  }

  // If PostgreSQL returned valid state even if products array is empty
  if (pgData && typeof pgData === 'object' && (Array.isArray(pgData.invoices) || Array.isArray(pgData.customers))) {
    return { data: pgData, source: 'postgresql' };
  }

  return { data: localData, source: 'local-file' };
}

// Helper to set aggressive no-cache headers on real-time sync endpoints
function setNoCacheHeaders(res: express.Response) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
}

// 2. Fetch all shared data (Central synchronization with dual persistence & auto-convergence)
app.get('/api/db', async (req, res) => {
  try {
    setNoCacheHeaders(res);
    const { data, source } = await getLatestConvergedDatabase();
    const authUser = (req as AuthenticatedRequest).authUser;
    res.json({
      success: true,
      data: sanitizeDbForClient(data, authUser),
      source,
      database: 'mana_db',
      serverTime: new Date().toISOString(),
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 3. Save or update database (Dual persistence: PostgreSQL mana_db + Local Snapshot with Serialized Queue & Zero Data Loss)
app.post('/api/db', dbWriteLimiter, async (req, res) => {
  try {
    setNoCacheHeaders(res);
    const incomingData = req.body;
    const authUser = (req as AuthenticatedRequest).authUser;
    if (isReadOnlyAccountant(authUser)) {
      return res.status(403).json({
        success: false,
        code: 'READ_ONLY_ACCOUNTANT',
        message: 'کاربر حسابدار فقط مجاز به مشاهده اطلاعات است و امکان تغییر داده‌ها را ندارد.',
      });
    }
    const callerIsAdmin = isAdminUser(authUser);
    const callerCanManageUsers = callerIsAdmin || Boolean(authUser?.permissions?.canManageUsers);
    
    // Schema and structure validation
    const validation = validateDatabaseSchema(incomingData);
    if (!validation.valid) {
      return res.status(400).json({ success: false, message: validation.error });
    }

    // Anti-prototype pollution check
    const dangerousKeys = ['__proto__', 'constructor', 'prototype'];
    for (const key of Object.keys(incomingData)) {
      if (dangerousKeys.includes(key)) {
        console.warn(`[Security Alert] Blocked suspicious key: ${key}`);
        return res.status(403).json({ success: false, message: 'درخواست غیرمجاز شناسایی و مسدود شد.' });
      }
    }

    // Execute save operation inside the serialized write queue to prevent concurrent race conditions
    const result = await enqueueDbWrite(async () => {
      const { data: currentDb } = await getLatestConvergedDatabase();
      const currentRev = typeof currentDb.revision === 'number' ? currentDb.revision : 1;
      const nowIso = new Date().toISOString();
      const isStaleRevision =
        typeof incomingData.baseRevision === 'number' &&
        incomingData.baseRevision > 0 &&
        incomingData.baseRevision < currentRev;
      
      // Protect settings: only full admins may modify global settings; inventory managers may adjust safe warehouse/exit-slip fields only
      let mergedSettings = currentDb.settings;
      if (incomingData.settings && typeof incomingData.settings === 'object') {
        if (callerIsAdmin) {
          mergedSettings = {
            ...(currentDb.settings || {}),
            ...incomingData.settings,
            updatedAt: incomingData.settings.updatedAt || nowIso,
          };
          if (Array.isArray(incomingData.settings.warehouses)) {
            mergedSettings.warehouses = incomingData.settings.warehouses;
          }
        } else if (authUser?.permissions?.canManageInventory) {
          const whPatch: Record<string, any> = {};
          const safeWarehouseKeys = [
            'warehouses',
            'defaultWarehouseId',
            'originWarehouseName',
            'originWarehouseCode',
            'originWarehouseAddress',
            'originWarehousePhone',
            'originWarehouseManager',
            'exitSlipPrintLayout',
          ];
          for (const k of safeWarehouseKeys) {
            if (Object.prototype.hasOwnProperty.call(incomingData.settings, k)) {
              whPatch[k] = incomingData.settings[k];
            }
          }
          if (Object.keys(whPatch).length > 0) {
            mergedSettings = {
              ...(currentDb.settings || {}),
              ...whPatch,
              updatedAt: nowIso,
            };
          }
        }
      }

      // Comprehensive multi-entity tombstones to prevent zombie resurrections across all devices
      const prevTombstones = currentDb.tombstones || {};
      const incomingTombstones = incomingData.tombstones || {};

      const mergeTombstoneList = (entityKey: string, extraIds: string[] = []): string[] => {
        const set = new Set<string>();
        const existing = Array.isArray(prevTombstones[entityKey]) ? prevTombstones[entityKey] : [];
        const incoming = Array.isArray(incomingTombstones[entityKey]) ? incomingTombstones[entityKey] : [];
        existing.forEach((id: string) => { if (typeof id === 'string' && id.trim()) set.add(id.trim()); });
        incoming.forEach((id: string) => { if (typeof id === 'string' && id.trim()) set.add(id.trim()); });
        extraIds.forEach((id: string) => { if (typeof id === 'string' && id.trim()) set.add(id.trim()); });
        return Array.from(set).slice(-2000);
      };

      const extraDeletedInvoiceIds = Array.isArray(incomingData.deletedInvoiceIds) ? incomingData.deletedInvoiceIds : [];
      const currentLegacyDeleted = Array.isArray(currentDb.deletedInvoiceIds) ? currentDb.deletedInvoiceIds : [];

      const findAddedIds = (entityKey: string, extraIds: string[] = []): string[] => {
        const prevSet = new Set(
          (Array.isArray(prevTombstones[entityKey]) ? prevTombstones[entityKey] : []).map((x: any) => String(x || '').trim())
        );
        const incoming = Array.isArray(incomingTombstones[entityKey]) ? incomingTombstones[entityKey] : [];
        const added: string[] = [];
        for (const rawId of [...incoming, ...extraIds]) {
          const clean = String(rawId || '').trim();
          if (clean && !prevSet.has(clean)) added.push(clean);
        }
        return added;
      };

      const canDeleteInv = callerIsAdmin || Boolean(authUser?.permissions?.canDeleteInvoice);
      const canManageInv = callerIsAdmin || Boolean(authUser?.permissions?.canManageInventory);
      const canCreatePurch = callerIsAdmin || Boolean(authUser?.permissions?.canCreatePurchaseInvoice);
      const canManageCust = callerIsAdmin || Boolean(authUser?.permissions?.canManageCustomers);
      const canSettleInv = callerIsAdmin || Boolean(authUser?.permissions?.canSettleInvoices);

      if (!canDeleteInv && findAddedIds('invoices', extraDeletedInvoiceIds).length > 0) {
        const err: any = new Error('شما مجوز حذف یا ابطال فاکتورهای فروش را ندارید.');
        err.statusCode = 403;
        throw err;
      }
      if (!canManageInv && (
        findAddedIds('products').length > 0 ||
        findAddedIds('inboundReceipts').length > 0 ||
        findAddedIds('directTransfers').length > 0 ||
        findAddedIds('categories').length > 0
      )) {
        const err: any = new Error('شما مجوز حذف اقلام انبار، دسته‌بندی‌ها یا حواله‌ها را ندارید.');
        err.statusCode = 403;
        throw err;
      }
      if (!canDeleteInv && !canCreatePurch && findAddedIds('purchaseInvoices').length > 0) {
        const err: any = new Error('شما مجوز حذف فاکتور خرید را ندارید.');
        err.statusCode = 403;
        throw err;
      }
      if (!canManageCust && findAddedIds('customers').length > 0) {
        const err: any = new Error('شما مجوز حذف مشتریان را ندارید.');
        err.statusCode = 403;
        throw err;
      }
      if (!canManageCust && !canSettleInv && findAddedIds('customerTransactions').length > 0) {
        const err: any = new Error('شما مجوز حذف تراکنش‌های مالی مشتری را ندارید.');
        err.statusCode = 403;
        throw err;
      }
      if (!callerCanManageUsers && findAddedIds('users').length > 0) {
        const err: any = new Error('شما مجوز حذف کاربران را ندارید.');
        err.statusCode = 403;
        throw err;
      }

      const normalizeServerCategory = (val: any) =>
        String(val || '')
          .replace(/[\u200B\uFEFF]/g, '')
          .replace(/[يیى]/g, 'ی')
          .replace(/[كک]/g, 'ک')
          .replace(/\s+/g, ' ')
          .trim();
      const normalizeServerCategoryKey = (val: any) => normalizeServerCategory(val).toLowerCase();

      const revivedCatSet = new Set<string>(
        canManageInv && Array.isArray(incomingData.reviveCategories)
          ? incomingData.reviveCategories.map((c: string) => normalizeServerCategoryKey(c)).filter(Boolean)
          : []
      );

      const combinedTombstones = {
        invoices: mergeTombstoneList('invoices', [...extraDeletedInvoiceIds, ...currentLegacyDeleted]),
        products: mergeTombstoneList('products'),
        customers: mergeTombstoneList('customers'),
        purchaseInvoices: mergeTombstoneList('purchaseInvoices'),
        inboundReceipts: mergeTombstoneList('inboundReceipts'),
        directTransfers: mergeTombstoneList('directTransfers'),
        savedVehicles: mergeTombstoneList('savedVehicles'),
        customerTransactions: mergeTombstoneList('customerTransactions'),
        users: callerCanManageUsers ? mergeTombstoneList('users') : (Array.isArray(prevTombstones.users) ? prevTombstones.users.map(String) : []),
        categories: canManageInv
          ? mergeTombstoneList('categories').filter((c: string) => {
              const k = normalizeServerCategoryKey(c);
              return Boolean(k) && k !== 'عمومی' && !revivedCatSet.has(k);
            })
          : (Array.isArray(prevTombstones.categories) ? prevTombstones.categories.map(String) : []),
      };

      const invoiceDelSet = new Set<string>(combinedTombstones.invoices);
      const productDelSet = new Set<string>(combinedTombstones.products);
      const customerDelSet = new Set<string>(combinedTombstones.customers);
      const purchaseDelSet = new Set<string>(combinedTombstones.purchaseInvoices);
      const inboundDelSet = new Set<string>(combinedTombstones.inboundReceipts);
      const transferDelSet = new Set<string>(combinedTombstones.directTransfers);
      const vehicleDelSet = new Set<string>(combinedTombstones.savedVehicles);
      const transactionDelSet = new Set<string>(combinedTombstones.customerTransactions || []);
      const userDelSet = new Set<string>(combinedTombstones.users);
      const categoryDelSet = new Set<string>(
        combinedTombstones.categories.map((c: string) => normalizeServerCategoryKey(c)).filter((k: string) => Boolean(k) && k !== 'عمومی')
      );

      const resolveCollection = (currentArr: any[], incomingArr: any, delSet: Set<string>): any[] => {
        if (!Array.isArray(incomingArr)) {
          return (Array.isArray(currentArr) ? currentArr : []).filter((item: any) => !delSet.has(item?.id));
        }
        if (isStaleRevision) {
          return mergeCollectionById(currentArr, incomingArr, delSet);
        }
        return incomingArr.filter((item: any) => !delSet.has(item?.id));
      };

      const preserveReminderMarkers = (prevArr: any[], resolvedArr: any[]) => {
        const prevMap = new Map<string, any>();
        (Array.isArray(prevArr) ? prevArr : []).forEach((item: any) => {
          if (item?.id) prevMap.set(item.id, item);
        });
        return resolvedArr.map((item: any) => {
          const prev = item?.id ? prevMap.get(item.id) : null;
          if (!prev) return item;
          const next = { ...item };
          if (!next.proformaReminderSentAt && prev.proformaReminderSentAt) {
            next.proformaReminderSentAt = prev.proformaReminderSentAt;
          }
          const prevDueNorm = normalizeJalaliDateServer(prev.chequeDueDate);
          const nextDueNorm = normalizeJalaliDateServer(next.chequeDueDate);
          if (
            prev.chequeReminderSentForDate &&
            prevDueNorm &&
            nextDueNorm === prevDueNorm &&
            !next.chequeReminderSentForDate
          ) {
            next.chequeReminderSentForDate = prev.chequeReminderSentForDate;
            if (prev.chequeReminderSentAt) {
              next.chequeReminderSentAt = prev.chequeReminderSentAt;
            }
          }
          return next;
        });
      };

      const canWriteSalesInvoices =
        callerIsAdmin ||
        Boolean(authUser?.permissions?.canCreateInvoice) ||
        Boolean(authUser?.permissions?.canSettleInvoices) ||
        Boolean(authUser?.permissions?.canDeleteInvoice);
      const canWriteProducts =
        callerIsAdmin ||
        Boolean(authUser?.permissions?.canManageInventory) ||
        Boolean(authUser?.permissions?.canCreateInvoice) ||
        Boolean(authUser?.permissions?.canCreatePurchaseInvoice);
      const canWriteCustomers =
        callerIsAdmin ||
        Boolean(authUser?.permissions?.canManageCustomers) ||
        Boolean(authUser?.permissions?.canCreateInvoice) ||
        Boolean(authUser?.permissions?.canSettleInvoices);
      const canWritePurchases =
        callerIsAdmin ||
        Boolean(authUser?.permissions?.canCreatePurchaseInvoice) ||
        Boolean(authUser?.permissions?.canManageInventory) ||
        Boolean(authUser?.permissions?.canSettleInvoices) ||
        Boolean(authUser?.permissions?.canDeleteInvoice);
      const canWriteWarehouseDocs =
        callerIsAdmin ||
        Boolean(authUser?.permissions?.canManageInventory) ||
        Boolean(authUser?.permissions?.canCreatePurchaseInvoice) ||
        Boolean(authUser?.permissions?.canCreateInvoice);

      // Safe collections handling: enforce per-collection RBAC + tombstones + concurrent merge
      const finalInvoices = canWriteSalesInvoices
        ? preserveReminderMarkers(
            currentDb.invoices,
            resolveCollection(currentDb.invoices, incomingData.invoices, invoiceDelSet)
          )
        : (Array.isArray(currentDb.invoices) ? currentDb.invoices : []);
      const finalProducts = canWriteProducts
        ? resolveCollection(currentDb.products, incomingData.products, productDelSet)
        : (Array.isArray(currentDb.products) ? currentDb.products : []);
      const finalCustomers = canWriteCustomers
        ? resolveCollection(currentDb.customers, incomingData.customers, customerDelSet)
        : (Array.isArray(currentDb.customers) ? currentDb.customers : []);
      const finalPurchases = canWritePurchases
        ? preserveReminderMarkers(
            currentDb.purchaseInvoices,
            resolveCollection(currentDb.purchaseInvoices, incomingData.purchaseInvoices, purchaseDelSet)
          )
        : (Array.isArray(currentDb.purchaseInvoices) ? currentDb.purchaseInvoices : []);
      const finalInbound = canWriteWarehouseDocs
        ? resolveCollection(currentDb.inboundReceipts, incomingData.inboundReceipts, inboundDelSet)
        : (Array.isArray(currentDb.inboundReceipts) ? currentDb.inboundReceipts : []);
      const finalTransfers = canManageInv
        ? resolveCollection(currentDb.directTransfers, incomingData.directTransfers, transferDelSet)
        : (Array.isArray(currentDb.directTransfers) ? currentDb.directTransfers : []);
      const finalVehicles = canWriteWarehouseDocs
        ? resolveCollection(currentDb.savedVehicles, incomingData.savedVehicles, vehicleDelSet)
        : (Array.isArray(currentDb.savedVehicles) ? currentDb.savedVehicles : []);
      const finalTransactions = (callerIsAdmin || canManageCust || canSettleInv)
        ? preserveReminderMarkers(
            currentDb.customerTransactions,
            resolveCollection(currentDb.customerTransactions, incomingData.customerTransactions, transactionDelSet)
          )
        : (Array.isArray(currentDb.customerTransactions) ? currentDb.customerTransactions : []);

      // Protect users array: only admin / canManageUsers may alter users; always preserve & scrypt-hash passwords
      const existingUsersById = new Map<string, any>();
      (Array.isArray(currentDb.users) ? currentDb.users : []).forEach((u: any) => {
        if (u?.id) existingUsersById.set(u.id, u);
      });

      let finalUsers: any[];
      if (!callerCanManageUsers || !Array.isArray(incomingData.users)) {
        finalUsers = Array.isArray(currentDb.users) ? currentDb.users : [];
      } else {
        // Guard: verify caller didn't add tombstone for protected user, self, or last admin
        for (const delUid of userDelSet) {
          const prevTarget = existingUsersById.get(delUid);
          if (delUid === authUser?.userId) {
            const err: any = new Error('امکان حذف حساب کاربری جاری خودتان وجود ندارد.');
            err.statusCode = 403;
            throw err;
          }
          if (!callerIsAdmin && prevTarget && isAdminUser(prevTarget)) {
            const err: any = new Error('شما مجوز حذف حساب‌های مدیر سیستم را ندارید.');
            err.statusCode = 403;
            throw err;
          }
        }

        const candidateUsers = isStaleRevision
          ? mergeCollectionById(currentDb.users, incomingData.users, userDelSet)
          : incomingData.users.filter((u: any) => !userDelSet.has(u?.id));

        // Enforce privilege escalation & self-lockout protections
        for (const u of candidateUsers) {
          const prev = u?.id ? existingUsersById.get(u.id) : null;
          const nextNormPerms = normalizeUserPermissionsServer(String(u?.role || 'cashier'), u?.permissions);
          const nextIsPrivileged = u?.role === 'admin' || nextNormPerms.canAccessAdmin === true;

          if (!callerIsAdmin) {
            // Non-admin manager cannot create/promote admin or grant canAccessAdmin
            if (!prev && nextIsPrivileged) {
              const err: any = new Error('فقط مدیر کل سیستم مجاز به تعریف کاربر مدیر یا اعطای دسترسی پنل مدیریت است.');
              err.statusCode = 403;
              throw err;
            }
            if (prev && isAdminUser(prev)) {
              const incomingPass = typeof u.password === 'string' && u.password.trim() ? u.password.trim() : '';
              const incomingPin = typeof u.pin === 'string' && u.pin.trim() ? u.pin.trim() : '';
              const prevPermsJson = JSON.stringify(normalizeUserPermissionsServer(prev.role, prev.permissions));
              const nextPermsJson = JSON.stringify(nextNormPerms);
              if (
                incomingPass ||
                incomingPin ||
                u.role !== prev.role ||
                Boolean(u.isActive) !== Boolean(prev.isActive) ||
                String(u.username || '').trim().toLowerCase() !== String(prev.username || '').trim().toLowerCase() ||
                String(u.fullName || '').trim() !== String(prev.fullName || '').trim() ||
                prevPermsJson !== nextPermsJson
              ) {
                const err: any = new Error('شما مجوز تغییر اطلاعات یا رمز حساب‌های مدیر سیستم را ندارید.');
                err.statusCode = 403;
                throw err;
              }
            }
            if (prev && !isAdminUser(prev) && nextIsPrivileged) {
              const err: any = new Error('شما مجوز ارتقای کاربر به مدیر کل یا اعطای دسترسی پنل مدیریت را ندارید.');
              err.statusCode = 403;
              throw err;
            }
          }

          if (prev && prev.id === authUser?.userId) {
            if (u.isActive === false) {
              const err: any = new Error('امکان غیرفعال‌سازی حساب کاربری فعال خودتان وجود ندارد.');
              err.statusCode = 400;
              throw err;
            }
            if (callerIsAdmin && (!nextNormPerms.canAccessAdmin || u.role !== 'admin')) {
              const err: any = new Error('امکان سلب دسترسی مدیر کل از حساب کاربری فعلی خودتان وجود ندارد.');
              err.statusCode = 400;
              throw err;
            }
          }
        }

        // Preserve any admin users omitted accidentally by a non-admin manager
        if (!callerIsAdmin) {
          for (const [id, prev] of existingUsersById.entries()) {
            if (isAdminUser(prev) && !candidateUsers.some((cu: any) => cu?.id === id)) {
              candidateUsers.push(prev);
            }
          }
        }

        finalUsers = candidateUsers.map((u: any) => {
          const prev = existingUsersById.get(u.id);
          const incomingPass = typeof u.password === 'string' && u.password.trim() ? u.password.trim() : '';
          const incomingPin = typeof u.pin === 'string' && u.pin.trim() ? u.pin.trim() : '';
          if ((incomingPass || incomingPin) && u.username) {
            const targetUserLower = String(u.username).trim().toLowerCase();
            for (const key of Array.from(loginAttemptsMap.keys())) {
              if (key.endsWith(`:${targetUserLower}`)) {
                loginAttemptsMap.delete(key);
              }
            }
          }
          const nextPassword = incomingPass
            ? hashSecret(incomingPass)
            : incomingPin
            ? hashSecret(incomingPin)
            : prev?.password
            ? (isHashedSecret(prev.password) ? prev.password : hashSecret(prev.password))
            : hashSecret('1234');
          const nextPin = incomingPin
            ? hashSecret(incomingPin)
            : incomingPass
            ? nextPassword
            : prev?.pin
            ? (isHashedSecret(prev.pin) ? prev.pin : hashSecret(prev.pin))
            : nextPassword;
          const { hasPassword: _hp, ...cleanUser } = u;
          const normalizedPerms = normalizeUserPermissionsServer(String(cleanUser.role || 'cashier'), cleanUser.permissions);
          return {
            ...cleanUser,
            permissions: normalizedPerms,
            password: nextPassword,
            pin: nextPin,
          };
        });

        const activeAdminCount = finalUsers.filter((u: any) => u?.role === 'admin' && u?.isActive !== false).length;
        if (activeAdminCount < 1) {
          const err: any = new Error('حداقل یک حساب مدیر کل فعال باید در سامانه باقی بماند.');
          err.statusCode = 400;
          throw err;
        }
      }

      const rawCategories = canManageInv && Array.isArray(incomingData.categories)
        ? incomingData.categories
        : (currentDb.categories || []);
      const seenCatKeys = new Set<string>();
      const finalCategories: string[] = [];
      for (const rawCat of rawCategories) {
        const clean = normalizeServerCategory(rawCat);
        if (!clean) continue;
        const key = clean.toLowerCase();
        if (key !== 'عمومی' && categoryDelSet.has(key)) continue;
        if (seenCatKeys.has(key)) continue;
        seenCatKeys.add(key);
        finalCategories.push(key === 'عمومی' ? 'عمومی' : clean);
      }
      if (!seenCatKeys.has('عمومی')) {
        finalCategories.unshift('عمومی');
      }

      // Also clean up exitSlipLogs so deleted invoices never leave ghost slips
      const currentExitLogs = canWriteWarehouseDocs
        ? { ...(currentDb.exitSlipLogs || {}), ...(incomingData.exitSlipLogs || {}) }
        : { ...(currentDb.exitSlipLogs || {}) };
      invoiceDelSet.forEach((delId) => {
        delete currentExitLogs[delId];
      });

      // Append-only ID-based union merge for activityLogs: concurrent devices never wipe peer logs & POST /api/db cannot erase audit history
      const finalActivityLogs = Array.isArray(incomingData.activityLogs)
        ? mergeActivityLogs(currentDb.activityLogs, incomingData.activityLogs)
        : mergeActivityLogs(currentDb.activityLogs, []);

      const updatedDb: any = {
        ...currentDb,
        invoices: finalInvoices,
        products: finalProducts,
        customers: finalCustomers,
        purchaseInvoices: finalPurchases,
        inboundReceipts: finalInbound,
        directTransfers: finalTransfers,
        savedVehicles: finalVehicles,
        customerTransactions: finalTransactions,
        users: finalUsers,
        categories: finalCategories,
        activityLogs: finalActivityLogs,
        exitSlipLogs: currentExitLogs,
        deletedInvoiceIds: combinedTombstones.invoices,
        tombstones: combinedTombstones,
        ...(mergedSettings ? { settings: mergedSettings } : {}),
        revision: currentRev + 1,
        updatedAt: nowIso,
      };
      delete updatedDb.reviveCategories;
      delete updatedDb.baseRevision;

      // Calculate checksum
      const rawContent = JSON.stringify(updatedDb, null, 2);
      updatedDb.checksum = crypto.createHash('sha256').update(rawContent).digest('hex');

      // Dual-write: write to local file snapshot first
      const successLocal = writeDatabase(updatedDb, true, false);

      // Write to PostgreSQL mana_db
      let pgSaved = false;
      if (getPostgresStatus().connected) {
        try {
          pgSaved = await saveStateToPostgres(updatedDb);
        } catch (err: any) {
          console.warn('[Postgres Save In Queue Warning]:', err.message);
        }
      }

      if (!successLocal && !pgSaved) {
        throw new Error('خطا در ذخیره‌سازی داده‌ها در سرور (هارد دیسک و دیتابیس در دسترس نیستند)');
      }

      return {
        success: true,
        revision: updatedDb.revision,
        checksum: updatedDb.checksum,
        updatedAt: updatedDb.updatedAt,
        mergedConcurrentWrite: isStaleRevision,
        storage: {
          local: successLocal,
          postgresql: pgSaved,
          database: 'mana_db',
        },
        message: 'داده‌ها با موفقیت در پایگاه‌داده ذخیره شدند.',
      };
    });

    res.json(result);
    scheduleServerChequeReminderCheck();
  } catch (error: any) {
    const status = typeof error?.statusCode === 'number' ? error.statusCode : 500;
    res.status(status).json({ success: false, message: error.message });
  }
});

// -------------------------------------------------------------
// DEDICATED ACTIVITY LOGS AUDIT ENDPOINTS
// -------------------------------------------------------------
app.get('/api/activity-logs', async (req, res) => {
  try {
    setNoCacheHeaders(res);
    const authUser = (req as AuthenticatedRequest).authUser;
    if (!authUser) {
      return res.status(401).json({ success: false, message: 'احراز هویت الزامی است.' });
    }
    const { data: dbData } = await getLatestConvergedDatabase();
    const liveUser = (dbData?.users || []).find((u: any) => u.id === authUser.userId);
    const canViewLogs =
      liveUser &&
      liveUser.isActive !== false &&
      (isAdminUser(liveUser) || Boolean(liveUser.permissions?.canManageUsers));
    if (!canViewLogs) {
      return res.status(403).json({
        success: false,
        message: 'فقط مدیر سیستم یا مسئول مدیریت کاربران مجاز به مشاهده لاگ‌های ممیزی است.',
      });
    }

    const logs = mergeActivityLogs(dbData?.activityLogs, []);
    res.json({
      success: true,
      logs,
      total: logs.length,
      serverTime: new Date().toISOString(),
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/activity-logs', dbWriteLimiter, async (req, res) => {
  try {
    setNoCacheHeaders(res);
    const authUser = (req as AuthenticatedRequest).authUser;
    if (!authUser) {
      return res.status(401).json({ success: false, message: 'احراز هویت الزامی است.' });
    }
    const body = req.body || {};
    const category = String(body.category || '').trim();
    const actionType = String(body.actionType || '').trim();
    const actionTitle = String(body.actionTitle || '').trim();
    const details = String(body.details || '').trim();

    if (!category || !actionType || !actionTitle) {
      return res.status(400).json({ success: false, message: 'اطلاعات رویداد ناقص است.' });
    }

    const savedLog = await enqueueDbWrite(async () => {
      const { data: currentDb } = await getLatestConvergedDatabase();
      const liveUser = (currentDb?.users || []).find((u: any) => u.id === authUser.userId);
      if (!liveUser || liveUser.isActive === false) {
        throw new Error('حساب کاربری معتبر نیست.');
      }

      const dt = getTehranJalaliDateTime();
      const clientId = typeof body.id === 'string' && body.id.trim() ? body.id.trim().slice(0, 80) : '';
      const validSeverity =
        body.severity === 'critical' || body.severity === 'warning' || body.severity === 'info'
          ? body.severity
          : inferActivitySeverityServer(actionType, category);

      const entry: any = {
        id: clientId || `log-${dt.createdAtMs}-${crypto.randomBytes(3).toString('hex')}`,
        // Always derive actor identity authoritatively from the authenticated user
        userId: liveUser.id,
        userName: liveUser.fullName || liveUser.username,
        userRole: liveUser.role,
        userRoleTitle: liveUser.roleTitle,
        category: category.slice(0, 40),
        actionType: actionType.slice(0, 80),
        actionTitle: actionTitle.slice(0, 140),
        details: details.slice(0, 1000),
        timestamp: typeof body.timestamp === 'string' && body.timestamp.trim() ? body.timestamp.trim().slice(0, 60) : dt.timestamp,
        dateOnly: typeof body.dateOnly === 'string' && body.dateOnly.trim() ? body.dateOnly.trim().slice(0, 20) : dt.dateOnly,
        createdAtMs: dt.createdAtMs,
        severity: validSeverity,
        source: 'client',
        ipAddress: getRequestClientIp(req),
        deviceInfo:
          typeof body.deviceInfo === 'string' && body.deviceInfo.trim()
            ? body.deviceInfo.trim().slice(0, 120)
            : parseUserAgentSummary(req),
        ...(typeof body.entityType === 'string' && body.entityType.trim() ? { entityType: body.entityType.trim().slice(0, 40) } : {}),
        ...(typeof body.entityId === 'string' && body.entityId.trim() ? { entityId: body.entityId.trim().slice(0, 80) } : {}),
        ...(typeof body.entityLabel === 'string' && body.entityLabel.trim() ? { entityLabel: body.entityLabel.trim().slice(0, 120) } : {}),
        ...(normalizeLogMetadata(body.metadata) ? { metadata: normalizeLogMetadata(body.metadata) } : {}),
      };

      const updatedDb = { ...currentDb };
      updatedDb.activityLogs = mergeActivityLogs([entry], currentDb.activityLogs);
      updatedDb.revision = (typeof currentDb.revision === 'number' ? currentDb.revision : 1) + 1;
      updatedDb.updatedAt = new Date().toISOString();
      updatedDb.checksum = crypto.createHash('sha256').update(JSON.stringify(updatedDb, null, 2)).digest('hex');

      writeDatabase(updatedDb, true, false);
      if (getPostgresStatus().connected) {
        try {
          await saveStateToPostgres(updatedDb);
        } catch (pgErr: any) {
          console.warn('[Postgres Activity Log Sync Notice]:', pgErr?.message);
        }
      }
      return entry;
    });

    res.json({ success: true, log: savedLog });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.delete('/api/activity-logs', requireAdmin, async (req, res) => {
  try {
    setNoCacheHeaders(res);
    const authUser = (req as AuthenticatedRequest).authUser!;
    const result = await enqueueDbWrite(async () => {
      const { data: currentDb } = await getLatestConvergedDatabase();
      const prevCount = Array.isArray(currentDb.activityLogs) ? currentDb.activityLogs.length : 0;
      const liveUser = (currentDb?.users || []).find((u: any) => u.id === authUser.userId);
      const updatedDb = { ...currentDb, activityLogs: [] as any[] };
      const clearEntry = appendLogToDbObject(updatedDb, req, {
        userId: authUser.userId,
        userName: liveUser?.fullName || authUser.username,
        userRole: liveUser?.role || authUser.role,
        userRoleTitle: liveUser?.roleTitle,
        category: 'system',
        actionType: 'clear_logs',
        actionTitle: 'پاکسازی آرشیو لاگ‌های فعالیت',
        details: `پاکسازی کامل ${toPersianDigitsServer(prevCount)} رکورد لاگ سیستم توسط مدیر «${liveUser?.fullName || authUser.username}»`,
        severity: 'critical',
        metadata: { clearedCount: prevCount },
      });
      updatedDb.revision = (typeof currentDb.revision === 'number' ? currentDb.revision : 1) + 1;
      updatedDb.updatedAt = new Date().toISOString();
      updatedDb.checksum = crypto.createHash('sha256').update(JSON.stringify(updatedDb, null, 2)).digest('hex');

      writeDatabase(updatedDb, true, false);
      if (getPostgresStatus().connected) {
        try {
          await saveStateToPostgres(updatedDb);
        } catch (pgErr: any) {
          console.warn('[Postgres Clear Logs Notice]:', pgErr?.message);
        }
      }
      return { logs: updatedDb.activityLogs, auditEntry: clearEntry };
    });

    res.json({
      success: true,
      logs: result.logs,
      message: 'آرشیو لاگ‌های قبلی با ثبت رکورد ممیزی جدید پاکسازی شد.',
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 3.5 Dedicated atomic endpoint for item deletion across all devices
app.post('/api/db/delete-item', dbWriteLimiter, async (req, res) => {
  try {
    setNoCacheHeaders(res);
    const authUser = (req as AuthenticatedRequest).authUser;
    if (isReadOnlyAccountant(authUser)) {
      return res.status(403).json({
        success: false,
        code: 'READ_ONLY_ACCOUNTANT',
        message: 'کاربر حسابدار فقط مجاز به مشاهده اطلاعات است و امکان حذف آیتم‌ها را ندارد.',
      });
    }
    const { type, id } = req.body;
    if (!type || !id || typeof id !== 'string') {
      return res.status(400).json({ success: false, message: 'نوع موجودیت و شناسه برای حذف الزامی است.' });
    }
    const callerIsAdmin = isAdminUser(authUser);
    const callerCanManageUsers = callerIsAdmin || Boolean(authUser?.permissions?.canManageUsers);
    const callerCanDeleteInvoice = callerIsAdmin || Boolean(authUser?.permissions?.canDeleteInvoice);
    const callerCanManageInventory = callerIsAdmin || Boolean(authUser?.permissions?.canManageInventory);
    const callerCanManageCustomers = callerIsAdmin || Boolean(authUser?.permissions?.canManageCustomers);
    const callerCanSettle = callerIsAdmin || Boolean(authUser?.permissions?.canSettleInvoices);
    const callerCanCreatePurchase = callerIsAdmin || Boolean(authUser?.permissions?.canCreatePurchaseInvoice);

    if (type === 'user' && !callerCanManageUsers) {
      return res.status(403).json({ success: false, message: 'شما مجوز حذف کاربران را ندارید.' });
    }
    if (type === 'invoice' && !callerCanDeleteInvoice) {
      return res.status(403).json({ success: false, message: 'شما مجوز حذف فاکتور را ندارید.' });
    }
    if ((type === 'product' || type === 'inboundReceipt' || type === 'directTransfer' || type === 'category') && !callerCanManageInventory) {
      return res.status(403).json({ success: false, message: 'شما مجوز حذف اقلام انبار یا دسته‌بندی را ندارید.' });
    }
    if (type === 'purchaseInvoice' && !callerCanDeleteInvoice && !callerCanCreatePurchase) {
      return res.status(403).json({ success: false, message: 'شما مجوز حذف فاکتور خرید را ندارید.' });
    }
    if (type === 'customer' && !callerCanManageCustomers) {
      return res.status(403).json({ success: false, message: 'شما مجوز حذف مشتریان را ندارید.' });
    }
    if (type === 'customerTransaction' && !callerCanManageCustomers && !callerCanSettle) {
      return res.status(403).json({ success: false, message: 'شما مجوز حذف اسناد مالی مشتری را ندارید.' });
    }
    if (type === 'savedVehicle' && !callerCanManageInventory && !authUser?.permissions?.canCreateInvoice) {
      return res.status(403).json({ success: false, message: 'شما مجوز حذف خودروی ثبت‌شده را ندارید.' });
    }

    const allowedTypes = new Set([
      'customerTransaction', 'invoice', 'product', 'customer',
      'purchaseInvoice', 'inboundReceipt', 'directTransfer',
      'savedVehicle', 'user', 'category'
    ]);
    if (!allowedTypes.has(type)) {
      return res.status(400).json({ success: false, message: 'نوع موجودیت نامعتبر است.' });
    }

    const cleanId = id.trim();
    const result = await enqueueDbWrite(async () => {
      const { data: currentDb } = await getLatestConvergedDatabase();
      if (type === 'user') {
        if (cleanId === authUser?.userId) {
          const err: any = new Error('امکان حذف حساب کاربری فعال خودتان وجود ندارد.');
          err.statusCode = 400;
          throw err;
        }
        const currentUsers = Array.isArray(currentDb.users) ? currentDb.users : [];
        const targetUser = currentUsers.find((u: any) => u?.id === cleanId);
        if (targetUser && !callerIsAdmin && isAdminUser(targetUser)) {
          const err: any = new Error('فقط مدیر کل مجاز به حذف حساب‌های مدیر است.');
          err.statusCode = 403;
          throw err;
        }
        if (targetUser && targetUser.role === 'admin' && targetUser.isActive !== false) {
          const remainingActiveAdmins = currentUsers.filter(
            (u: any) => u?.id !== cleanId && u?.role === 'admin' && u?.isActive !== false
          );
          if (remainingActiveAdmins.length < 1) {
            const err: any = new Error('حداقل یک کاربر مدیر کل فعال باید در سامانه باقی بماند.');
            err.statusCode = 400;
            throw err;
          }
        }
      }
      const currentRev = typeof currentDb.revision === 'number' ? currentDb.revision : 1;
      const nowIso = new Date().toISOString();

      const tombstones = {
        invoices: [...(currentDb.tombstones?.invoices || currentDb.deletedInvoiceIds || [])],
        products: [...(currentDb.tombstones?.products || [])],
        customers: [...(currentDb.tombstones?.customers || [])],
        purchaseInvoices: [...(currentDb.tombstones?.purchaseInvoices || [])],
        inboundReceipts: [...(currentDb.tombstones?.inboundReceipts || [])],
        directTransfers: [...(currentDb.tombstones?.directTransfers || [])],
        savedVehicles: [...(currentDb.tombstones?.savedVehicles || [])],
        customerTransactions: [...(currentDb.tombstones?.customerTransactions || [])],
        users: [...(currentDb.tombstones?.users || [])],
        categories: [...(currentDb.tombstones?.categories || [])],
      };

      const updatedDb = { ...currentDb };

      switch (type) {
        case 'customerTransaction':
          if (!tombstones.customerTransactions.includes(cleanId)) tombstones.customerTransactions.push(cleanId);
          updatedDb.customerTransactions = (currentDb.customerTransactions || []).filter((t: any) => t.id !== cleanId);
          break;
        case 'invoice':
          if (!tombstones.invoices.includes(cleanId)) tombstones.invoices.push(cleanId);
          updatedDb.invoices = (currentDb.invoices || []).filter((i: any) => i.id !== cleanId);
          if (updatedDb.exitSlipLogs && updatedDb.exitSlipLogs[cleanId]) {
            const logs = { ...updatedDb.exitSlipLogs };
            delete logs[cleanId];
            updatedDb.exitSlipLogs = logs;
          }
          break;
        case 'product':
          if (!tombstones.products.includes(cleanId)) tombstones.products.push(cleanId);
          updatedDb.products = (currentDb.products || []).filter((p: any) => p.id !== cleanId);
          break;
        case 'customer':
          if (!tombstones.customers.includes(cleanId)) tombstones.customers.push(cleanId);
          updatedDb.customers = (currentDb.customers || []).filter((c: any) => c.id !== cleanId);
          break;
        case 'purchaseInvoice':
          if (!tombstones.purchaseInvoices.includes(cleanId)) tombstones.purchaseInvoices.push(cleanId);
          updatedDb.purchaseInvoices = (currentDb.purchaseInvoices || []).filter((p: any) => p.id !== cleanId);
          break;
        case 'inboundReceipt':
          if (!tombstones.inboundReceipts.includes(cleanId)) tombstones.inboundReceipts.push(cleanId);
          updatedDb.inboundReceipts = (currentDb.inboundReceipts || []).filter((r: any) => r.id !== cleanId);
          break;
        case 'directTransfer':
          if (!tombstones.directTransfers.includes(cleanId)) tombstones.directTransfers.push(cleanId);
          updatedDb.directTransfers = (currentDb.directTransfers || []).filter((t: any) => t.id !== cleanId);
          break;
        case 'savedVehicle':
          if (!tombstones.savedVehicles.includes(cleanId)) tombstones.savedVehicles.push(cleanId);
          updatedDb.savedVehicles = (currentDb.savedVehicles || []).filter((v: any) => v.id !== cleanId);
          break;
        case 'user':
          if (!tombstones.users.includes(cleanId)) tombstones.users.push(cleanId);
          updatedDb.users = (currentDb.users || []).filter((u: any) => u.id !== cleanId);
          break;
        case 'category': {
          const cleanCat = cleanId
            .replace(/[\u200B\uFEFF]/g, '')
            .replace(/[يیى]/g, 'ی')
            .replace(/[كک]/g, 'ک')
            .replace(/\s+/g, ' ')
            .trim();
          const cleanCatKey = cleanCat.toLowerCase();
          if (cleanCatKey && cleanCatKey !== 'عمومی') {
            if (!tombstones.categories.some((c: string) => c.trim().toLowerCase() === cleanCatKey)) {
              tombstones.categories.push(cleanCat);
            }
            updatedDb.categories = (currentDb.categories || []).filter(
              (c: string) =>
                String(c || '')
                  .replace(/[\u200B\uFEFF]/g, '')
                  .replace(/[يیى]/g, 'ی')
                  .replace(/[كک]/g, 'ک')
                  .replace(/\s+/g, ' ')
                  .trim()
                  .toLowerCase() !== cleanCatKey
            );
          }
          break;
        }
      }

      updatedDb.tombstones = tombstones;
      updatedDb.deletedInvoiceIds = tombstones.invoices;
      updatedDb.revision = currentRev + 1;
      updatedDb.updatedAt = nowIso;

      const rawContent = JSON.stringify(updatedDb, null, 2);
      updatedDb.checksum = crypto.createHash('sha256').update(rawContent).digest('hex');

      const successLocal = writeDatabase(updatedDb, true, false);
      let pgSaved = false;
      if (getPostgresStatus().connected) {
        try {
          pgSaved = await saveStateToPostgres(updatedDb);
        } catch (err: any) {
          console.warn('[Postgres Delete Item Warning]:', err.message);
        }
      }

      return {
        success: true,
        revision: updatedDb.revision,
        checksum: updatedDb.checksum,
        type,
        deletedId: cleanId,
        storage: { local: successLocal, postgresql: pgSaved },
        message: `مورد مورد نظر با شناسه ${cleanId} با موفقیت در پایگاه‌داده سراسری حذف شد.`,
      };
    });

    res.json(result);
  } catch (error: any) {
    const status = typeof error?.statusCode === 'number' ? error.statusCode : 500;
    res.status(status).json({ success: false, message: error.message });
  }
});

// 4. Security & Backup Engine Status check
app.get('/api/security/status', requireAdmin, (req, res) => {
  const backups = getBackupsList();
  res.json({
    success: true,
    security: {
      helmet: true,
      hidePoweredBy: true,
      serverAuthentication: 'HMAC-SHA256 Session + HttpOnly Cookie',
      passwordHashing: 'scrypt (per-user salt + timingSafeEqual)',
      corsPolicy: ALLOWED_ORIGINS.length > 0 ? 'Explicit Origin Allowlist' : 'Same-Origin Only',
      rateLimiting: {
        generalApi: '300 req/min',
        databaseWrite: '300 req/min',
        authLogin: '25 req/min',
      },
      prototypePollutionGuard: true,
      bruteForceProtection: 'Server-Side Active (5 attempts -> 60s lockout)',
      databaseHardening: {
        atomicWrites: true,
        schemaValidation: true,
        sha256Checksums: true,
        autoRecoveryOnCorruption: true,
      },
      automatedBackups: {
        enabled: true,
        intervalHours: 4,
        maxRetainedSnapshots: 30,
        totalBackupsStored: backups.length,
        latestBackup: backups[0] || null,
      },
    },
    serverTime: new Date().toISOString(),
  });
});

// 5. Backups API: List all backups
app.get('/api/backups', requireAdmin, (req, res) => {
  try {
    const backups = getBackupsList();
    res.json({
      success: true,
      total: backups.length,
      autoBackupIntervalHours: 4,
      backups,
      serverTime: new Date().toISOString(),
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 6. Backups API: Create manual backup on-demand
app.post('/api/backups/create', requireAdmin, async (req, res) => {
  try {
    const label = req.body?.label?.trim() || 'پشتیبان دستی کاربر';
    const { data: currentData } = await getLatestConvergedDatabase();
    const result = createBackup('manual', label, currentData);
    if (!result.success) {
      return res.status(500).json({ success: false, message: result.error });
    }
    const authUser = (req as AuthenticatedRequest).authUser;
    const actor = (currentData?.users || []).find((u: any) => u.id === authUser?.userId);
    await recordServerActivityLog(req, {
      userId: authUser?.userId || 'admin',
      userName: actor?.fullName || authUser?.username || 'کاربر',
      userRole: actor?.role || authUser?.role || 'admin',
      userRoleTitle: actor?.roleTitle,
      category: 'system',
      actionType: 'create_backup',
      actionTitle: 'ایجاد نسخه پشتیبان دستی در سرور',
      details: `ایجاد فایل پشتیبان «${result.filename}» با برچسب «${label}»`,
      severity: 'info',
      entityType: 'backup',
      entityId: result.filename,
      entityLabel: label,
    });
    const backups = getBackupsList();
    res.json({
      success: true,
      message: 'نسخه پشتیبان با موفقیت بر روی سرور ایجاد شد.',
      filename: result.filename,
      backups,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 6.5. Backups API: Inspect & verify a specific backup file before restore
app.get('/api/backups/inspect/:filename', requireAdmin, (req, res) => {
  try {
    const safeFilename = path.basename(req.params.filename);
    const backupFilePath = path.join(BACKUPS_DIR, safeFilename);

    if (!fs.existsSync(backupFilePath)) {
      return res.status(404).json({ success: false, message: 'فایل پشتیبان یافت نشد.' });
    }

    const stat = fs.statSync(backupFilePath);
    const content = fs.readFileSync(backupFilePath, 'utf-8');
    const parsed = JSON.parse(content);
    const isEnvelope = Boolean(parsed.backupVersion && parsed.data);
    const actualData = isEnvelope ? parsed.data : parsed;
    const computedHash = computeChecksum(actualData);
    const recordedHash = isEnvelope && parsed.checksum ? parsed.checksum : computedHash;
    const checksumValid = !isEnvelope || !parsed.checksum || computedHash === recordedHash;
    const stats = computeBackupStats(actualData);

    res.json({
      success: true,
      filename: safeFilename,
      label: isEnvelope ? parsed.label : 'نسخه پشتیبان سرور',
      trigger: isEnvelope ? parsed.trigger : 'manual',
      createdAt: isEnvelope ? parsed.createdAt : stat.mtime.toISOString(),
      sizeBytes: stat.size,
      checksum: recordedHash,
      checksumValid,
      stats,
      storeName: actualData?.settings?.storeName || '',
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 6.6. Backups API: Prune old auto backups while keeping manual/important ones
app.post('/api/backups/prune', requireAdmin, (req, res) => {
  try {
    const keepAutoCount = typeof req.body?.keepAutoCount === 'number' ? Math.max(1, req.body.keepAutoCount) : 5;
    if (!fs.existsSync(BACKUPS_DIR)) {
      return res.json({ success: true, deletedCount: 0, backups: [] });
    }

    const allBackups = getBackupsList();
    const autoBackups = allBackups.filter((b) => b.trigger === 'auto');
    let deletedCount = 0;

    if (autoBackups.length > keepAutoCount) {
      const toRemove = autoBackups.slice(keepAutoCount);
      for (const b of toRemove) {
        try {
          const fp = path.join(BACKUPS_DIR, path.basename(b.filename));
          if (fs.existsSync(fp)) {
            fs.unlinkSync(fp);
            deletedCount++;
          }
        } catch {}
      }
    }

    const updatedBackups = getBackupsList();
    res.json({
      success: true,
      deletedCount,
      message:
        deletedCount > 0
          ? `${deletedCount} نسخه پشتیبان خودکار قدیمی پاکسازی شد.`
          : 'نسخه خودکار قدیمی مازاد برای پاکسازی وجود نداشت.',
      backups: updatedBackups,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 7. Backups API: Restore a specific backup (Full or Selective Modules)
app.post('/api/backups/restore', requireAdmin, async (req, res) => {
  try {
    const rawFilename = req.body?.filename;
    const selectedModules: string[] | undefined = Array.isArray(req.body?.modules) ? req.body.modules : undefined;

    if (!rawFilename || typeof rawFilename !== 'string') {
      return res.status(400).json({ success: false, message: 'نام فایل پشتیبان نامعتبر است.' });
    }

    // Prevent directory traversal attacks
    const safeFilename = path.basename(rawFilename);
    const backupFilePath = path.join(BACKUPS_DIR, safeFilename);

    if (!fs.existsSync(backupFilePath)) {
      return res.status(404).json({ success: false, message: 'فایل پشتیبان مورد نظر یافت نشد.' });
    }

    const content = fs.readFileSync(backupFilePath, 'utf-8');
    const parsed = JSON.parse(content);
    const targetData = parsed.data || parsed;

    const validation = validateDatabaseSchema(targetData);
    if (!validation.valid) {
      return res.status(400).json({ success: false, message: `محتوای فایل پشتیبان معتبر نیست: ${validation.error}` });
    }

    const restoreResult = await enqueueDbWrite(async () => {
      const { data: currentDb } = await getLatestConvergedDatabase();

      // Safety step: Create a pre-restore backup of the current database before overwriting!
      createBackup('pre-restore', `پشتیبان خودکار اضطراری قبل از بازیابی نسخه ${safeFilename}`, currentDb);

      const finalState = prepareRestoredDatabaseState(currentDb, targetData, selectedModules);
      if (Array.isArray(finalState.users)) {
        const hashed = ensureUsersPasswordsHashed(finalState.users);
        finalState.users = hashed.users;
      }

      const authUser = (req as AuthenticatedRequest).authUser;
      const actor = (finalState?.users || currentDb?.users || []).find((u: any) => u.id === authUser?.userId);
      appendLogToDbObject(finalState, req, {
        userId: authUser?.userId || 'admin',
        userName: actor?.fullName || authUser?.username || 'مدیر سیستم',
        userRole: actor?.role || authUser?.role || 'admin',
        userRoleTitle: actor?.roleTitle,
        category: 'system',
        actionType: 'restore_backup',
        actionTitle: selectedModules && selectedModules.length > 0 ? 'بازیابی انتخابی از نسخه پشتیبان' : 'بازیابی کامل پایگاه‌داده از پشتیبان',
        details: `بازیابی از فایل «${safeFilename}»${selectedModules && selectedModules.length > 0 ? ` (بخش‌ها: ${selectedModules.join('، ')})` : ' (کامل)'}`,
        severity: 'critical',
        entityType: 'backup',
        entityId: safeFilename,
      });

      // Overwrite database with target backup
      const ok = writeDatabase(finalState, false);
      if (!ok) {
        throw new Error('خطا در اعمال اطلاعات نسخه پشتیبان بر روی پایگاه‌داده.');
      }

      // Sync to PostgreSQL if connected
      if (getPostgresStatus().connected) {
        try {
          await saveStateToPostgres(finalState);
        } catch (pgErr: any) {
          console.warn('[PostgreSQL Restore Sync Notice]:', pgErr.message);
        }
      }

      return finalState;
    });

    const backups = getBackupsList();
    console.log(`[Backup Engine] Successfully restored database from backup: ${safeFilename}`);
    res.json({
      success: true,
      message:
        selectedModules && selectedModules.length > 0
          ? 'بخش‌های انتخاب‌شده با موفقیت از نسخه پشتیبان بازیابی شدند.'
          : 'پایگاه‌داده با موفقیت به نسخه انتخاب‌شده بازگردانی شد.',
      restoredFrom: safeFilename,
      data: sanitizeDbForClient(restoreResult, (req as AuthenticatedRequest).authUser),
      backups,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 8. Backups API: Download a specific backup file
app.get('/api/backups/download/:filename', requireAdmin, (req, res) => {
  try {
    const safeFilename = path.basename(req.params.filename);
    const backupFilePath = path.join(BACKUPS_DIR, safeFilename);

    if (!fs.existsSync(backupFilePath)) {
      return res.status(404).json({ success: false, message: 'فایل پشتیبان یافت نشد.' });
    }

    res.setHeader('Content-disposition', `attachment; filename=${safeFilename}`);
    res.setHeader('Content-type', 'application/json');
    const content = fs.readFileSync(backupFilePath, 'utf-8');
    res.send(content);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 9. Backups API: Delete a backup file
app.delete('/api/backups/:filename', requireAdmin, async (req, res) => {
  try {
    const safeFilename = path.basename(req.params.filename);
    const backupFilePath = path.join(BACKUPS_DIR, safeFilename);

    if (!fs.existsSync(backupFilePath)) {
      return res.status(404).json({ success: false, message: 'فایل پشتیبان یافت نشد.' });
    }

    fs.unlinkSync(backupFilePath);
    console.log(`[Backup Engine] Deleted backup file: ${safeFilename}`);
    const authUser = (req as AuthenticatedRequest).authUser;
    await recordServerActivityLog(req, {
      userId: authUser?.userId || 'admin',
      userName: authUser?.username || 'مدیر سیستم',
      userRole: authUser?.role || 'admin',
      category: 'system',
      actionType: 'delete_backup',
      actionTitle: 'حذف فایل نسخه پشتیبان از سرور',
      details: `حذف فایل پشتیبان «${safeFilename}» از آرشیو سرور`,
      severity: 'critical',
      entityType: 'backup',
      entityId: safeFilename,
    });
    const backups = getBackupsList();
    res.json({
      success: true,
      message: 'فایل پشتیبان با موفقیت حذف شد.',
      backups,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 10. Backups API: Upload & Import external backup file (with optional selective module restore)
app.post('/api/backups/upload', requireAdmin, async (req, res) => {
  try {
    const { backupContent, restoreNow, label, modules } = req.body;
    const selectedModules: string[] | undefined = Array.isArray(modules) ? modules : undefined;

    if (!backupContent || typeof backupContent !== 'string') {
      return res.status(400).json({ success: false, message: 'محتوای فایل پشتیبان ارسال نشده است.' });
    }

    let parsed: any;
    try {
      parsed = JSON.parse(backupContent);
    } catch {
      return res.status(400).json({ success: false, message: 'قالب فایل پشتیبان JSON معتبر نیست.' });
    }

    const actualData = parsed.data || parsed;
    const validation = validateDatabaseSchema(actualData);
    if (!validation.valid) {
      return res.status(400).json({ success: false, message: `فایل نامعتبر است: ${validation.error}` });
    }

    // Save as imported backup file
    const timestamp = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    const timeStr = `${timestamp.getFullYear()}-${pad(timestamp.getMonth() + 1)}-${pad(timestamp.getDate())}_${pad(timestamp.getHours())}-${pad(timestamp.getMinutes())}-${pad(timestamp.getSeconds())}`;
    const filename = `backup_${timeStr}_manual_imported.json`;
    const targetPath = path.join(BACKUPS_DIR, filename);

    const backupEnvelope = {
      backupVersion: 1,
      createdAt: timestamp.toISOString(),
      trigger: 'manual',
      label: label?.trim() || 'فایل پشتیبان بارگذاری‌شده از دستگاه',
      checksum: computeChecksum(actualData),
      stats: computeBackupStats(actualData),
      data: actualData,
    };

    fs.writeFileSync(targetPath, JSON.stringify(backupEnvelope, null, 2), 'utf-8');

    // If restoreNow was requested
    if (restoreNow) {
      await enqueueDbWrite(async () => {
        const { data: currentDb } = await getLatestConvergedDatabase();
        createBackup('pre-restore', 'پشتیبان خودکار قبل از اعمال فایل بارگذاری‌شده', currentDb);

        const finalState = prepareRestoredDatabaseState(currentDb, actualData, selectedModules);
        if (Array.isArray(finalState.users)) {
          const hashed = ensureUsersPasswordsHashed(finalState.users);
          finalState.users = hashed.users;
        }
        const authUser = (req as AuthenticatedRequest).authUser;
        const actor = (finalState?.users || currentDb?.users || []).find((u: any) => u.id === authUser?.userId);
        appendLogToDbObject(finalState, req, {
          userId: authUser?.userId || 'admin',
          userName: actor?.fullName || authUser?.username || 'مدیر سیستم',
          userRole: actor?.role || authUser?.role || 'admin',
          userRoleTitle: actor?.roleTitle,
          category: 'system',
          actionType: 'upload_restore_backup',
          actionTitle: 'بارگذاری و بازیابی فایل پشتیبان خارجی',
          details: `بارگذاری فایل «${filename}» و بازیابی${selectedModules && selectedModules.length > 0 ? ` بخش‌های (${selectedModules.join('، ')})` : ' کامل سیستم'}`,
          severity: 'critical',
          entityType: 'backup',
          entityId: filename,
        });
        writeDatabase(finalState, false);
        if (getPostgresStatus().connected) {
          try {
            await saveStateToPostgres(finalState);
          } catch (pgErr: any) {
            console.warn('[PostgreSQL Upload-Restore Sync Notice]:', pgErr.message);
          }
        }
      });
    } else {
      const authUser = (req as AuthenticatedRequest).authUser;
      await recordServerActivityLog(req, {
        userId: authUser?.userId || 'admin',
        userName: authUser?.username || 'مدیر سیستم',
        userRole: authUser?.role || 'admin',
        category: 'system',
        actionType: 'upload_backup',
        actionTitle: 'بارگذاری فایل پشتیبان در آرشیو سرور',
        details: `ذخیره فایل پشتیبان «${filename}» در آرشیو بدون بازیابی فوری`,
        severity: 'warning',
        entityType: 'backup',
        entityId: filename,
      });
    }

    const backups = getBackupsList();
    res.json({
      success: true,
      message: restoreNow
        ? selectedModules && selectedModules.length > 0
          ? 'فایل پشتیبان بارگذاری شد و بخش‌های انتخاب‌شده با موفقیت بازیابی گردید.'
          : 'فایل پشتیبان بارگذاری و کلیه اطلاعات با موفقیت بازیابی شد.'
        : 'فایل پشتیبان با موفقیت در آرشیو سرور ذخیره شد.',
      filename,
      restored: !!restoreNow,
      backups,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 11. Download live converged backup JSON with full envelope & checksum
app.get('/api/backup', requireAdmin, async (req, res) => {
  try {
    setNoCacheHeaders(res);
    const { data } = await getLatestConvergedDatabase();
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);
    const filename = `mana_backup_${dateStr}.json`;
    const envelope = {
      backupVersion: 1,
      createdAt: now.toISOString(),
      trigger: 'manual',
      label: `نسخه پشتیبان کامل سامانه (${dateStr})`,
      checksum: computeChecksum(data),
      stats: computeBackupStats(data),
      data,
    };
    res.setHeader('Content-disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-type', 'application/json; charset=utf-8');
    res.send(JSON.stringify(envelope, null, 2));
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// -------------------------------------------------------------
// TELEGRAM BOT API PROXY ENDPOINTS (DIRECT PDF & MESSAGE DISPATCH)
// -------------------------------------------------------------

export function sanitizeTelegramBotToken(rawToken?: string): string {
  if (!rawToken) return '';
  let token = String(rawToken).trim();
  // Strip zero-width spaces, BOM, invisible control chars
  token = token.replace(/[\u200B-\u200D\uFEFF\u0000-\u001F]/g, '').trim();
  // Convert Persian and Arabic numbers to English digits
  const persianDigits = '۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩';
  token = token.replace(/[۰-۹٠-٩]/g, (ch) => {
    const idx = persianDigits.indexOf(ch);
    return idx !== -1 ? String(idx % 10) : ch;
  });
  // Strip surrounding quotes
  token = token.replace(/^["'`]+|["'`]+$/g, '').trim();
  // Strip full URL if user pasted something like https://api.telegram.org/bot<TOKEN>
  token = token.replace(/^https?:\/\/[^/]+\/bot/i, '');
  // Strip trailing slashes or path parts like /getMe
  token = token.replace(/\/.*$/, '').trim();
  // If user pasted 'bot123456:ABC...', strip the leading 'bot'
  if (/^bot\d+:/i.test(token)) {
    token = token.replace(/^bot/i, '');
  }
  return token.trim();
}

async function getTelegramDispatcher(proxyUrl?: string) {
  const proxy = (
    proxyUrl ||
    process.env.HTTPS_PROXY ||
    process.env.HTTP_PROXY ||
    process.env.ALL_PROXY ||
    process.env.TELEGRAM_PROXY_URL ||
    ''
  ).trim();
  if (!proxy) return undefined;
  try {
    const undiciMod = await import('undici');
    const ProxyAgentClass = undiciMod.ProxyAgent || (undiciMod as any).default?.ProxyAgent;
    if (ProxyAgentClass) {
      return new ProxyAgentClass(proxy);
    }
    return undefined;
  } catch (err) {
    console.warn('[Telegram API] Failed to initialize ProxyAgent for proxy:', proxy, err);
    return undefined;
  }
}

interface TelegramCallOptions {
  token?: string;
  apiUrl?: string;
  proxyUrl?: string;
  method?: 'GET' | 'POST';
  body?: any;
  formData?: any;
  timeoutMs?: number;
}

/**
 * Fallback HTTPS request using Node's native `https` module with strict IPv4 (`family: 4`)
 * and optional direct Telegram IPv4 (`149.154.167.220`) to bypass Docker Alpine `undici` IPv6 bugs and DNS poisoning.
 */
function httpsTelegramFallback(
  urlStr: string,
  options: { method: string; body?: any; timeoutMs: number; directIp?: string }
): Promise<{ ok: boolean; status: number; data: any }> {
  return new Promise((resolve, reject) => {
    try {
      const parsed = new URL(urlStr);
      const payloadStr = options.body ? JSON.stringify(options.body) : undefined;
      const headers: Record<string, string> = {
        Host: parsed.host,
        Accept: 'application/json',
        Connection: 'close',
      };
      if (payloadStr) {
        headers['Content-Type'] = 'application/json';
        headers['Content-Length'] = String(Buffer.byteLength(payloadStr));
      }

      const reqOptions: https.RequestOptions = {
        protocol: parsed.protocol,
        hostname: options.directIp || parsed.hostname,
        port: parsed.port || 443,
        path: parsed.pathname + parsed.search,
        method: options.method,
        headers,
        family: 4, // Force IPv4 socket (avoids Docker IPv6 blackhole)
        servername: parsed.hostname, // Preserve TLS SNI even when connecting via direct IP
        timeout: options.timeoutMs,
      };

      const req = https.request(reqOptions, (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
        res.on('end', () => {
          try {
            const rawText = Buffer.concat(chunks).toString('utf-8');
            const data = JSON.parse(rawText);
            const status = res.statusCode || 500;
            resolve({ ok: status >= 200 && status < 300, status, data });
          } catch (parseErr) {
            reject(parseErr);
          }
        });
      });

      req.on('timeout', () => {
        req.destroy(new Error('Telegram HTTPS fallback timeout'));
      });
      req.on('error', (err) => {
        reject(err);
      });

      if (payloadStr) {
        req.write(payloadStr);
      }
      req.end();
    } catch (err) {
      reject(err);
    }
  });
}

async function callTelegramApi(endpoint: string, options: TelegramCallOptions = {}) {
  const dbData = readDatabase();
  const serverSettings = dbData?.settings || {};

  const cleanToken = sanitizeTelegramBotToken(
    options.token || serverSettings?.telegramBotToken || process.env.TELEGRAM_BOT_TOKEN
  );
  if (!cleanToken) {
    throw new Error('توکن ربات تلگرام وارد نشده است.');
  }

  // Base API URL (supports custom reverse proxies like Cloudflare Worker)
  let baseUrl = (
    options.apiUrl ||
    serverSettings?.telegramApiUrl ||
    process.env.TELEGRAM_API_URL ||
    'https://api.telegram.org'
  ).trim().replace(/\/+$/, '');

  const proxyUrl = (options.proxyUrl || serverSettings?.telegramProxyUrl || '').trim();
  const dispatcher = await getTelegramDispatcher(proxyUrl);
  const timeoutMs = options.timeoutMs || 15000;
  const httpMethod = options.method || (options.body || options.formData ? 'POST' : 'GET');

  const url = `${baseUrl}/bot${cleanToken}/${endpoint.replace(/^\/+/, '')}`;
  const buildFetchOptions = (customDispatcher?: any) => {
    const opts: any = {
      method: httpMethod,
      signal: AbortSignal.timeout(timeoutMs),
    };
    if (customDispatcher) {
      opts.dispatcher = customDispatcher;
    }
    if (options.formData) {
      opts.body = options.formData;
    } else if (options.body) {
      opts.headers = { 'Content-Type': 'application/json' };
      opts.body = JSON.stringify(options.body);
    }
    return opts;
  };

  try {
    const response = await fetch(url, buildFetchOptions(dispatcher));
    const data = await response.json();
    return { ok: response.ok, status: response.status, data };
  } catch (err: any) {
    // 1. If running inside Docker and proxy points to 127.0.0.1 / localhost, automatically retry via host.docker.internal
    if (proxyUrl && /(127\.0\.0\.1|localhost)/i.test(proxyUrl)) {
      try {
        const dockerHostProxy = proxyUrl.replace(/(127\.0\.0\.1|localhost)/i, 'host.docker.internal');
        const dockerDispatcher = await getTelegramDispatcher(dockerHostProxy);
        if (dockerDispatcher) {
          const retryRes = await fetch(url, buildFetchOptions(dockerDispatcher));
          const retryData = await retryRes.json();
          return { ok: retryRes.ok, status: retryRes.status, data: retryData };
        }
      } catch {
        // Continue to next fallback
      }
    }

    // 2. For non-multipart requests, try Node native `https` with strict IPv4 (`family: 4`)
    // This resolves the Alpine Linux Docker `undici` IPv6 Happy-Eyeballs `fetch failed` error
    if (!options.formData && !proxyUrl && baseUrl.startsWith('https://')) {
      try {
        return await httpsTelegramFallback(url, {
          method: httpMethod,
          body: options.body,
          timeoutMs: 10000,
        });
      } catch {
        // 3. Try direct official Telegram Bot API IPv4 (149.154.167.220) to bypass poisoned DNS on VPS
        if (baseUrl.includes('api.telegram.org')) {
          try {
            return await httpsTelegramFallback(url, {
              method: httpMethod,
              body: options.body,
              timeoutMs: 10000,
              directIp: '149.154.167.220',
            });
          } catch {
            // Continue
          }
        }
      }
    }

    const causeCode = err?.cause?.code || err?.cause?.message || '';
    const isNetworkError =
      err?.name === 'TimeoutError' ||
      err?.message?.includes('timeout') ||
      err?.message?.includes('fetch failed') ||
      causeCode === 'ETIMEDOUT' ||
      causeCode === 'ECONNREFUSED' ||
      causeCode === 'ENOTFOUND' ||
      causeCode === 'UND_ERR_CONNECT_TIMEOUT';

    if (isNetworkError) {
      const detailedMsg = [
        'عدم برقراری ارتباط با سرور تلگرام (fetch failed).',
        'دسترسی مستقیم سرور به دامنه api.telegram.org به دلیل فیلترینگ دیتاسنتر مسدود است.',
        'راهکار پیشنهادی: در بخش «تنظیمات > تلگرام»، از «ریورس پروکسی» (مانند Cloudflare Worker) یا «پروکسی محلی سیستم» استفاده فرمایید.',
      ].join(' ');
      throw new Error(detailedMsg);
    }
    throw err;
  }
}

// 12.1 Test Bot Connection (getMe)
app.post('/api/telegram/test-connection', requireAdmin, async (req, res) => {
  try {
    const rawBotToken = req.body?.botToken || process.env.TELEGRAM_BOT_TOKEN || '';
    const botToken = sanitizeTelegramBotToken(rawBotToken);
    if (!botToken) {
      return res.status(400).json({ success: false, error: 'توکن ربات تلگرام وارد نشده است.' });
    }

    const apiUrl = req.body?.apiUrl;
    const proxyUrl = req.body?.proxyUrl;

    const { ok, status, data } = await callTelegramApi('getMe', {
      token: botToken,
      apiUrl,
      proxyUrl,
    });

    if (!ok || !data.ok) {
      let desc = data.description || '';
      if (status === 401 || desc.toLowerCase().includes('unauthorized')) {
        desc = 'توکن ربات نامعتبر است (کد ۴۰۱). لطفاً توکن دریافتی از @BotFather را مجدداً بررسی فرمایید.';
      } else if (status === 404 || desc.toLowerCase().includes('not found')) {
        desc = 'آدرس یا ربات در تلگرام یافت نشد (کد ۴۰۴). لطفاً توکن را به شکل صحیح بدون کلمات اضافه وارد فرمایید.';
      }
      return res.status(400).json({
        success: false,
        error: desc || 'توکن ربات نامعتبر است. لطفاً توکن دریافتی از BotFather را بررسی نمایید.',
      });
    }

    return res.json({
      success: true,
      bot: data.result,
      message: `اتصال به ربات «${data.result.first_name}» (@${data.result.username}) با موفقیت برقرار شد.`,
    });
  } catch (err: any) {
    console.error('[Telegram API] test-connection error:', err);
    return res.status(500).json({
      success: false,
      error: err?.message || 'خطا در ارتباط با سرور تلگرام',
    });
  }
});

// 12.2 Test Message to Chat/Channel/Group (sendMessage)
app.post('/api/telegram/test-message', requireAdmin, async (req, res) => {
  try {
    const rawBotToken = req.body?.botToken || process.env.TELEGRAM_BOT_TOKEN || '';
    const botToken = sanitizeTelegramBotToken(rawBotToken);
    const chatId = (req.body?.chatId || process.env.TELEGRAM_CHAT_ID || '').trim();
    const customText = req.body?.text;
    const apiUrl = req.body?.apiUrl;
    const proxyUrl = req.body?.proxyUrl;

    if (!botToken) {
      return res.status(400).json({ success: false, error: 'توکن ربات وارد نشده است.' });
    }
    if (!chatId) {
      return res.status(400).json({ success: false, error: 'شناسه چت / گروه / کانال مقصد وارد نشده است.' });
    }

    const text = customText || [
      '🔔 <b>پیام تستی اتصال سامانه حسابداری به تلگرام</b>',
      '',
      '✅ اتصال به این چت با موفقیت تایید شد.',
      '📄 قابلیت ارسال مستقیم فایل‌های PDF فاکتور و حواله خروج انبار فعال است.',
      '',
      `🕒 زمان تست: ${new Date().toLocaleTimeString('fa-IR')}`,
    ].join('\n');

    const { ok, data } = await callTelegramApi('sendMessage', {
      token: botToken,
      apiUrl,
      proxyUrl,
      body: {
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
      },
    });

    if (!ok || !data.ok) {
      return res.status(400).json({
        success: false,
        error: data.description || 'ارسال پیام با خطا مواجه شد. اطمینان حاصل فرمایید ربات در چت/کانال عضو و ادمین باشد یا دکمه Start را زده باشید.',
      });
    }

    return res.json({
      success: true,
      message: 'پیام آزمایشی با موفقیت به تلگرام ارسال گردید.',
      result: data.result,
    });
  } catch (err: any) {
    console.error('[Telegram API] test-message error:', err);
    return res.status(500).json({
      success: false,
      error: err?.message || 'خطا در ارسال پیام به تلگرام',
    });
  }
});

// 12.2.1 Send Text Report / Message to Chat/Channel/Group (Direct & Unfiltered)
app.post('/api/telegram/send-message', async (req, res) => {
  try {
    const authUser = (req as AuthenticatedRequest).authUser;
    const callerIsAdmin = isAdminUser(authUser);
    const dbData = readDatabase();
    const serverSettings = dbData?.settings || {};

    const botToken = sanitizeTelegramBotToken(
      (callerIsAdmin ? req.body?.botToken : '') ||
      serverSettings?.telegramBotToken ||
      process.env.TELEGRAM_BOT_TOKEN
    );

    const chatId = (
      (callerIsAdmin ? req.body?.chatId : '') ||
      serverSettings?.telegramChatId ||
      process.env.TELEGRAM_CHAT_ID ||
      ''
    ).trim();

    const text = (req.body?.text || '').trim();
    const parseMode = req.body?.parse_mode || 'HTML';
    const apiUrl = callerIsAdmin ? req.body?.apiUrl : undefined;
    const proxyUrl = callerIsAdmin ? req.body?.proxyUrl : undefined;

    if (!botToken) {
      return res.status(400).json({ success: false, error: 'توکن ربات تلگرام مشخص نشده است.' });
    }
    if (!chatId) {
      return res.status(400).json({ success: false, error: 'شناسه چت یا کانال مقصد مشخص نشده است.' });
    }
    if (!text) {
      return res.status(400).json({ success: false, error: 'متن پیام خالی است.' });
    }

    const { ok, data } = await callTelegramApi('sendMessage', {
      token: botToken,
      apiUrl,
      proxyUrl,
      body: {
        chat_id: chatId,
        text,
        parse_mode: parseMode,
      },
    });

    if (!ok || !data.ok) {
      return res.status(400).json({
        success: false,
        error: data.description || 'ارسال پیام متنی به تلگرام ناموفق بود.',
      });
    }

    return res.json({
      success: true,
      message: 'گزارش متنی با موفقیت به تلگرام ارسال گردید.',
      result: data.result,
    });
  } catch (err: any) {
    console.error('[Telegram API] send-message error:', err);
    return res.status(500).json({
      success: false,
      error: err?.message || 'خطا در ارسال پیام متنی به تلگرام',
    });
  }
});

// 12.2.2 Helper functions and endpoints for Proforma 7-day Follow-up Reminders
function toPersianDigitsServer(n: any): string {
  if (n === null || n === undefined) return '';
  const fa = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  return String(n).replace(/\d/g, (w) => fa[Number(w)]);
}

function formatPriceServer(price: number | string): string {
  const num = Number(price) || 0;
  return num.toLocaleString('en-US');
}

function toEnglishDigitsServer(str: string): string {
  if (!str) return '';
  const fa = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  const ar = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  let res = String(str);
  for (let i = 0; i < 10; i++) {
    res = res.replace(new RegExp(fa[i], 'g'), String(i)).replace(new RegExp(ar[i], 'g'), String(i));
  }
  return res;
}

function jalaliToGregorianServer(jy: number, jm: number, jd: number): [number, number, number] {
  let gy: number, gm: number, gd: number, days: number;
  jy += 1595;
  days = -355668 + (365 * jy) + (Math.floor(jy / 33) * 8) + Math.floor(((jy % 33) + 3) / 4) + jd + ((jm < 7) ? (jm - 1) * 31 : ((jm - 7) * 30) + 186);
  gy = 400 * Math.floor(days / 146097);
  days %= 146097;
  if (days > 36524) {
    gy += 100 * Math.floor(--days / 36524);
    days %= 36524;
    if (days >= 365) days++;
  }
  gy += 4 * Math.floor(days / 1461);
  days %= 1461;
  if (days > 365) {
    gy += Math.floor((days - 1) / 365);
    days = (days - 1) % 365;
  }
  gd = days + 1;
  const sal_a = [0, 31, ((gy % 4 === 0 && gy % 100 !== 0) || (gy % 400 === 0)) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  for (gm = 0; gm < 13 && gd > sal_a[gm]; gm++) gd -= sal_a[gm];
  return [gy, gm, gd];
}

function calculateInvoiceDaysAgeServer(inv: any): number {
  const now = new Date();
  if (inv.date) {
    try {
      const clean = toEnglishDigitsServer(inv.date).replace(/[^\d/]/g, '').trim();
      const parts = clean.split('/').map(Number);
      if (parts.length === 3 && parts[0] && parts[1] && parts[2]) {
        let jy = parts[0];
        if (jy < 100) jy += 1400; // پشتیبانی از سال‌های دورقمی شمسی مانند ۰۳ یا ۰۴
        const [gy, gm, gd] = jalaliToGregorianServer(jy, parts[1], parts[2]);
        const d = new Date(gy, gm - 1, gd);
        const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        const invMidnight = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
        const diffDays = Math.round((todayMidnight - invMidnight) / (1000 * 60 * 60 * 24));
        if (diffDays >= 0) return diffDays;
      }
    } catch {}
  }
  if (inv.createdAt) {
    const c = new Date(inv.createdAt);
    if (!isNaN(c.getTime())) {
      const diffMs = now.getTime() - c.getTime();
      return Math.max(0, Math.round(diffMs / (1000 * 60 * 60 * 24)));
    }
  }
  return 0;
}

async function checkAndSendServerProformaReminders(overrides?: {
  botToken?: string;
  chatId?: string;
}): Promise<{
  checkedCount: number;
  dueCount: number;
  sentCount: number;
  sentInvoiceNumbers: string[];
  errors: string[];
}> {
  try {
    const dbData = readDatabase();
    const serverSettings = dbData?.settings || {};
    const invoices = Array.isArray(dbData?.invoices) ? dbData.invoices : [];

    const isManualTest = Boolean(overrides?.botToken && overrides?.chatId);
    const isEnabled = isManualTest || (Boolean(serverSettings?.telegramBotEnabled) && serverSettings?.telegramAutoSendProformaReminder !== false);
    const botToken = (overrides?.botToken || serverSettings?.telegramBotToken || process.env.TELEGRAM_BOT_TOKEN || '').trim();
    const defaultChatId = (overrides?.chatId || serverSettings?.telegramChatId || process.env.TELEGRAM_CHAT_ID || '').trim();

    if (!isEnabled || !botToken || !defaultChatId) {
      return {
        checkedCount: 0,
        dueCount: 0,
        sentCount: 0,
        sentInvoiceNumbers: [],
        errors: [!isEnabled ? 'قابلیت ارسال خودکار هشدار تلگرام غیرفعال است' : 'تنظیمات ربات تلگرام ناقص است (توکن یا شناسه چت وارد نشده است)'],
      };
    }

    const activeProformas = invoices.filter(
      (inv: any) =>
        (inv.isProforma === true || inv.isProforma === 'true') &&
        !inv.convertedAt &&
        !inv.isDeleted &&
        inv.deleted !== true
    );
    const sentInvoiceNumbers: string[] = [];
    const errors: string[] = [];
    let dueCount = 0;
    let modified = false;

    for (const inv of activeProformas) {
      const days = calculateInvoiceDaysAgeServer(inv);
      if (days >= 7) {
        dueCount++;
        // اگر هنوز هشداری برای این پیش‌فاکتور ارسال نشده باشد (یا در حالت تست دستی توسط کاربر باشد)
        if (!inv.proformaReminderSentAt || isManualTest) {
          // پیام هشدار پیگیری مستقیماً به کانال یا حساب تلگرام مدیریت/فروشگاه ارسال می‌شود
          const targetChatId = defaultChatId;

          const store = serverSettings.storeName || 'سامانه حسابداری و بازرگانی';
          const currency = serverSettings.currency || 'تومان';

          const itemsSummary: string[] = [];
          if (Array.isArray(inv.items) && inv.items.length > 0) {
            itemsSummary.push(`📦 <b>اقلام پیش‌فاکتور (${toPersianDigitsServer(inv.items.length)} قلم):</b>`);
            inv.items.slice(0, 10).forEach((item: any, idx: number) => {
              const num = toPersianDigitsServer(idx + 1);
              const name = escapeTelegramHtml(item.productName || item.name || 'کالای بدون عنوان');
              const qty = toPersianDigitsServer(item.quantity);
              const unit = item.unit ? ` ${escapeTelegramHtml(item.unit)}` : '';
              itemsSummary.push(`  ▫️ ${num}. ${name}: ${qty}${unit}`);
            });
            if (inv.items.length > 10) {
              itemsSummary.push(`  ▫️ <i>... و ${toPersianDigitsServer(inv.items.length - 10)} قلم دیگر</i>`);
            }
          }

          const messageLines = [
            `⚠️ <b>هشدار پیگیری پیش‌فاکتور (گذشت ${toPersianDigitsServer(days)} روز)</b>`,
            `━━━━━━━━━━━━━━━━━━━━`,
            `📋 <b>پیش‌فاکتور شماره:</b> <code>#${escapeTelegramHtml(toPersianDigitsServer(inv.invoiceNumber))}</code>`,
            `👤 <b>مشتری / طرف حساب:</b> <b>${escapeTelegramHtml(inv.customerName)}</b>`,
            inv.customerPhone ? `📞 <b>شماره تماس:</b> <code>${escapeTelegramHtml(toPersianDigitsServer(inv.customerPhone))}</code>` : '',
            `📅 <b>تاریخ صدور:</b> ${escapeTelegramHtml(toPersianDigitsServer(inv.date))} (<b>${toPersianDigitsServer(days)} روز گذشته</b>)`,
            `💰 <b>مبلغ کل:</b> <b>${toPersianDigitsServer(formatPriceServer(inv.finalTotal))} ${escapeTelegramHtml(currency)}</b>`,
            ...(itemsSummary.length > 0 ? itemsSummary : [`📦 تعداد اقلام: ${toPersianDigitsServer(inv.items?.length || 0)} قلم`]),
            `━━━━━━━━━━━━━━━━━━━━`,
            `🔔 <b>اقدام لازم:</b>`,
            `بیش از ۷ روز از صدور این پیش‌فاکتور سپری شده است. لطفاً جهت پیگیری سفارش با خریدار تماس حاصل نموده تا در صورت تایید نهایی، به <b>فاکتور فروش</b> تبدیل شود.`,
            store ? `🏪 <i>${escapeTelegramHtml(store)}</i>` : '',
          ].filter(Boolean);

          const messageText = messageLines.join('\n');

          try {
            const { ok, data } = await callTelegramApi('sendMessage', {
              token: botToken,
              body: {
                chat_id: targetChatId,
                text: messageText,
                parse_mode: 'HTML',
              },
            });
            if (ok && data.ok) {
              inv.proformaReminderSentAt = new Date().toISOString();
              sentInvoiceNumbers.push(inv.invoiceNumber);
              modified = true;
              console.log(`[Proforma Reminder] Sent 7-day follow-up alert for proforma #${inv.invoiceNumber} (${days} days) to Telegram (${targetChatId}).`);
            } else {
              errors.push(`پیش‌فاکتور #${inv.invoiceNumber}: ${data.description || 'خطا در ارسال'}`);
            }
          } catch (err: any) {
            errors.push(`پیش‌فاکتور #${inv.invoiceNumber}: ${err?.message || 'خطا در ارتباط با تلگرام'}`);
          }
        }
      }
    }

    if (modified) {
      writeDatabase(dbData, true, true);
    }

    return {
      checkedCount: activeProformas.length,
      dueCount,
      sentCount: sentInvoiceNumbers.length,
      sentInvoiceNumbers,
      errors,
    };
  } catch (err: any) {
    console.error('[Proforma Reminder] Error running check:', err);
    return {
      checkedCount: 0,
      dueCount: 0,
      sentCount: 0,
      sentInvoiceNumbers: [],
      errors: [err?.message || 'خطای سرور'],
    };
  }
}

// Check proforma reminders endpoint
app.post('/api/telegram/check-proforma-reminders', requireAdmin, async (req, res) => {
  try {
    const customBotToken = req.body?.botToken;
    const customChatId = req.body?.chatId;
    const result = await checkAndSendServerProformaReminders({
      botToken: customBotToken,
      chatId: customChatId,
    });
    if (result.errors.length > 0 && result.sentCount === 0) {
      return res.json({
        success: false,
        result,
        error: result.errors.join(' | '),
      });
    }
    return res.json({
      success: true,
      result,
      message: result.sentCount > 0
        ? `پیام هشدار برای ${toPersianDigitsServer(result.sentCount)} پیش‌فاکتور نیازمند پیگیری با موفقیت به تلگرام ارسال شد.`
        : result.dueCount > 0
        ? `تمام پیش‌فاکتورهای نیازمند پیگیری قبلاً هشدار تلگرام دریافت کرده‌اند.`
        : `بررسی انجام شد (${toPersianDigitsServer(result.checkedCount)} پیش‌فاکتور فعال): هیچ پیش‌فاکتوری با بیش از ۷ روز تاخیر یافت نشد.`,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || 'خطای سرور' });
  }
});

// Proforma reminders status endpoint
app.get('/api/telegram/proforma-reminders-status', requireAdmin, (req, res) => {
  try {
    const dbData = readDatabase();
    const invoices = Array.isArray(dbData?.invoices) ? dbData.invoices : [];
    const activeProformas = invoices.filter((inv: any) => inv.isProforma && !inv.convertedAt);

    const dueList = activeProformas
      .map((inv: any) => ({
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        customerName: inv.customerName,
        customerPhone: inv.customerPhone,
        date: inv.date,
        finalTotal: inv.finalTotal,
        daysPassed: calculateInvoiceDaysAgeServer(inv),
        reminderSentAt: inv.proformaReminderSentAt,
      }))
      .filter((item: any) => item.daysPassed >= 7);

    return res.json({
      success: true,
      totalActiveProformas: activeProformas.length,
      dueCount: dueList.length,
      dueList,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || 'خطای سرور' });
  }
});

// Run background proforma reminder check periodically (every 30 mins) & 10 seconds after startup
setTimeout(() => {
  checkAndSendServerProformaReminders().catch((e) => console.warn('[Proforma Reminder] Initial check error:', e));
}, 10000);
setInterval(() => {
  checkAndSendServerProformaReminders().catch((e) => console.warn('[Proforma Reminder] Interval check error:', e));
}, 30 * 60 * 1000);

// 12.2.3 Customer Negotiation Notes & Next Call Reminder (یادآوری تماس با مشتری در تلگرام در زمان فرا رسیدن موعد)
function normalizeJalaliDateServer(raw?: string | null): string {
  if (!raw) return '';
  const clean = toEnglishDigitsServer(String(raw)).replace(/[^\d/]/g, '').trim();
  const parts = clean.split('/').map(Number);
  if (parts.length === 3 && parts[0] && parts[1] && parts[2]) {
    let jy = parts[0];
    if (jy < 100) jy += 1400;
    const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
    return `${jy}/${pad(parts[1])}/${pad(parts[2])}`;
  }
  return clean;
}

async function checkAndSendCustomerFollowUpReminders(overrides?: {
  botToken?: string;
  chatId?: string;
  customerId?: string;
  noteId?: string;
  forceSend?: boolean;
}): Promise<{
  checkedCount: number;
  dueCount: number;
  sentCount: number;
  sentCustomerNames: string[];
  errors: string[];
}> {
  try {
    const { data: dbData } = await getLatestConvergedDatabase();
    const serverSettings = dbData?.settings || {};
    const customers = Array.isArray(dbData?.customers) ? dbData.customers : [];

    const isManualForce = Boolean(overrides?.forceSend);
    const isEnabled = isManualForce || Boolean(serverSettings?.telegramBotEnabled);
    const botToken = (overrides?.botToken || serverSettings?.telegramBotToken || process.env.TELEGRAM_BOT_TOKEN || '').trim();
    const targetChatId = (overrides?.chatId || serverSettings?.telegramChatId || process.env.TELEGRAM_CHAT_ID || '').trim();

    if (!isEnabled || !botToken || !targetChatId) {
      return {
        checkedCount: 0,
        dueCount: 0,
        sentCount: 0,
        sentCustomerNames: [],
        errors: [
          !isEnabled
            ? 'ربات تلگرام در تنظیمات سیستم غیرفعال است.'
            : 'تنظیمات ربات تلگرام ناقص است (توکن ربات یا شناسه چت در تنظیمات وارد نشده است).',
        ],
      };
    }

    const todayJalali = getJalaliDateStr(new Date());
    const sentCustomerNames: string[] = [];
    const errors: string[] = [];
    let dueCount = 0;
    let modified = false;

    const targetCustomers = overrides?.customerId
      ? customers.filter((c: any) => c.id === overrides.customerId)
      : customers;

    for (const cust of targetCustomers) {
      const followUps = Array.isArray(cust.followUps) ? cust.followUps : [];

      // Find the relevant follow-up note
      let targetNote = overrides?.noteId
        ? followUps.find((fn: any) => fn.id === overrides.noteId)
        : followUps.find(
            (fn: any) =>
              !fn.isCompleted &&
              fn.nextFollowUpDate &&
              normalizeJalaliDateServer(fn.nextFollowUpDate) <= todayJalali
          );

      const custDueDate = normalizeJalaliDateServer(
        targetNote?.nextFollowUpDate || cust.nextFollowUpDate
      );

      if (!custDueDate && !isManualForce) {
        continue;
      }

      const isDue = isManualForce || (Boolean(custDueDate) && custDueDate <= todayJalali);
      if (!isDue) {
        continue;
      }

      dueCount++;

      // Check if already notified for this due date unless forceSend is requested
      const alreadySentForNote = Boolean(targetNote?.telegramReminderSentAt);
      const alreadySentForCustomerDate =
        Boolean(custDueDate) &&
        normalizeJalaliDateServer(cust.lastTelegramReminderForDate) === custDueDate;

      if (!isManualForce && (alreadySentForNote || alreadySentForCustomerDate)) {
        continue;
      }

      if (!targetNote && followUps.length > 0) {
        targetNote = followUps[0];
      }

      const store = serverSettings.storeName || 'سامانه حسابداری و بازرگانی';
      const noteText = targetNote?.note || cust.notes || 'یادآوری تماس و پیگیری وضعیت سفارش مشتری';
      const noteDate = targetNote?.date || cust.createdAt || todayJalali;
      const createdBy = targetNote?.createdBy || 'مدیریت';
      const dueLabel = custDueDate || todayJalali;
      const isTodayDue = dueLabel === todayJalali;

      const messageLines = [
        `🔔 <b>یادآوری تماس با مشتری (موعد پیگیری مذاکره)</b>`,
        `━━━━━━━━━━━━━━━━━━━━`,
        `👤 <b>نام مشتری / طرف‌حساب:</b> <b>${escapeTelegramHtml(cust.name)}</b>${cust.customerType === 'colleague' ? ' (همکار / عمده)' : ''}`,
        cust.phone ? `📞 <b>شماره تماس:</b> <code>${escapeTelegramHtml(toPersianDigitsServer(cust.phone))}</code>` : '',
        `📅 <b>تاریخ یادآور تماس:</b> <b>${escapeTelegramHtml(toPersianDigitsServer(dueLabel))}</b>${isTodayDue ? ' (موعد امروز)' : ''}`,
        `📝 <b>متن یادداشت مذاکره:</b>`,
        `<i>«${escapeTelegramHtml(noteText)}»</i>`,
        `🗓️ <b>تاریخ ثبت مذاکره:</b> ${escapeTelegramHtml(toPersianDigitsServer(noteDate))}`,
        createdBy ? `👨‍💼 <b>ثبت‌کننده:</b> ${escapeTelegramHtml(createdBy)}` : '',
        `━━━━━━━━━━━━━━━━━━━━`,
        `📌 <b>اقدام لازم:</b> زمان یادآوری تماس با <b>${escapeTelegramHtml(cust.name)}</b> فرا رسیده است. لطفاً جهت پیگیری مذاکرات و هماهنگی سفارش با مشتری تماس حاصل فرمایید.`,
        store ? `🏪 <i>${escapeTelegramHtml(store)}</i>` : '',
      ].filter(Boolean);

      const messageText = messageLines.join('\n');

      try {
        const { ok, data } = await callTelegramApi('sendMessage', {
          token: botToken,
          body: {
            chat_id: targetChatId,
            text: messageText,
            parse_mode: 'HTML',
          },
        });
        if (ok && data.ok) {
          const nowIso = new Date().toISOString();
          if (targetNote) {
            targetNote.telegramReminderSentAt = nowIso;
          }
          if (custDueDate) {
            cust.lastTelegramReminderForDate = custDueDate;
          }
          sentCustomerNames.push(cust.name);
          modified = true;
          console.log(`[Follow-Up Reminder] Sent Telegram call reminder for customer "${cust.name}" (due: ${dueLabel}).`);
        } else {
          errors.push(`مشتری «${cust.name}»: ${data.description || 'خطا در ارسال به تلگرام'}`);
        }
      } catch (err: any) {
        errors.push(`مشتری «${cust.name}»: ${err?.message || 'خطا در ارتباط با تلگرام'}`);
      }
    }

    if (modified) {
      writeDatabase(dbData, true, true);
      if (getPostgresStatus().connected) {
        saveStateToPostgres(dbData).catch(() => {});
      }
    }

    return {
      checkedCount: targetCustomers.length,
      dueCount,
      sentCount: sentCustomerNames.length,
      sentCustomerNames,
      errors,
    };
  } catch (err: any) {
    console.error('[Follow-Up Reminder] Error running check:', err);
    return {
      checkedCount: 0,
      dueCount: 0,
      sentCount: 0,
      sentCustomerNames: [],
      errors: [err?.message || 'خطای سرور در بررسی یادآورهای تماس'],
    };
  }
}

app.post('/api/telegram/check-followup-reminders', async (req, res) => {
  try {
    const authUser = (req as AuthenticatedRequest).authUser;
    const callerIsAdmin = isAdminUser(authUser);
    if (!callerIsAdmin && !authUser?.permissions?.canManageCustomers) {
      return res.status(403).json({
        success: false,
        error: 'فقط مدیر سیستم یا مسئول بخش مشتریان مجاز به ارسال یادآور پیگیری مشتری است.',
      });
    }
    const result = await checkAndSendCustomerFollowUpReminders({
      botToken: callerIsAdmin ? req.body?.botToken : undefined,
      chatId: callerIsAdmin ? req.body?.chatId : undefined,
      customerId: req.body?.customerId,
      noteId: req.body?.noteId,
      forceSend: Boolean(req.body?.forceSend),
    });

    if (result.errors.length > 0 && result.sentCount === 0) {
      return res.json({
        success: false,
        result,
        error: result.errors.join(' | '),
      });
    }

    return res.json({
      success: true,
      result,
      message:
        result.sentCount > 0
          ? `پیام یادآوری تماس برای ${toPersianDigitsServer(result.sentCount)} مشتری (${result.sentCustomerNames.join('، ')}) با موفقیت به تلگرام ارسال شد.`
          : result.dueCount > 0
          ? 'پیام یادآوری تماس برای موعدهای امروز قبلاً به تلگرام ارسال شده است.'
          : 'هیچ یادآور تماسی که موعد آن فرا رسیده باشد یافت نشد.',
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || 'خطای سرور' });
  }
});

// Run background customer follow-up reminder check periodically (every 15 mins) & 12 seconds after startup
setTimeout(() => {
  checkAndSendCustomerFollowUpReminders().catch((e) => console.warn('[Follow-Up Reminder] Initial check error:', e));
}, 12000);
setInterval(() => {
  checkAndSendCustomerFollowUpReminders().catch((e) => console.warn('[Follow-Up Reminder] Interval check error:', e));
}, 15 * 60 * 1000);

// 12.2.4 Receivable & Payable Cheque 7-Day Advance Telegram Reminders (یادآوری یک هفته قبل از سررسید چک‌ها)
let chequeReminderDebounceTimer: ReturnType<typeof setTimeout> | null = null;
let isChequeReminderCheckRunning = false;

function scheduleServerChequeReminderCheck() {
  if (chequeReminderDebounceTimer) {
    clearTimeout(chequeReminderDebounceTimer);
  }
  chequeReminderDebounceTimer = setTimeout(() => {
    chequeReminderDebounceTimer = null;
    checkAndSendServerChequeReminders().catch((e) =>
      console.warn('[Cheque Reminder] Debounced check error:', e)
    );
  }, 2500);
}

function calculateDaysUntilJalaliDueServer(dueDateRaw?: string | null, todayJalaliOverride?: string): number | null {
  const normDue = normalizeJalaliDateServer(dueDateRaw);
  if (!normDue) return null;
  const dueParts = normDue.split('/').map(Number);
  if (dueParts.length !== 3 || !dueParts[0] || !dueParts[1] || !dueParts[2]) return null;

  const todayStr = todayJalaliOverride || getTehranJalaliDateTime().dateOnly;
  const todayParts = normalizeJalaliDateServer(todayStr).split('/').map(Number);
  if (todayParts.length !== 3 || !todayParts[0] || !todayParts[1] || !todayParts[2]) return null;

  try {
    const [dgy, dgm, dgd] = jalaliToGregorianServer(dueParts[0], dueParts[1], dueParts[2]);
    const [tgy, tgm, tgd] = jalaliToGregorianServer(todayParts[0], todayParts[1], todayParts[2]);
    const dueUtc = Date.UTC(dgy, dgm - 1, dgd);
    const todayUtc = Date.UTC(tgy, tgm - 1, tgd);
    if (!Number.isFinite(dueUtc) || !Number.isFinite(todayUtc)) return null;
    return Math.round((dueUtc - todayUtc) / (1000 * 60 * 60 * 24));
  } catch {
    return null;
  }
}

interface ChequeReminderCandidate {
  kind: 'invoice' | 'purchase' | 'transaction';
  direction: 'receivable' | 'payable';
  record: any;
  chequeNumber: string;
  dueDate: string;
  daysRemaining: number;
  amount: number;
  counterpartyName: string;
  counterpartyPhone?: string;
  accountHolder?: string;
  sourceLabel: string;
  notes?: string;
}

function collectActiveChequesForReminder(
  dbData: any,
  todayJalali: string
): ChequeReminderCandidate[] {
  const candidates: ChequeReminderCandidate[] = [];
  const invoices = Array.isArray(dbData?.invoices) ? dbData.invoices : [];
  const purchases = Array.isArray(dbData?.purchaseInvoices) ? dbData.purchaseInvoices : [];
  const transactions = Array.isArray(dbData?.customerTransactions) ? dbData.customerTransactions : [];
  const customers = Array.isArray(dbData?.customers) ? dbData.customers : [];

  const customerMap = new Map<string, any>();
  customers.forEach((c: any) => {
    if (c?.id) customerMap.set(c.id, c);
  });

  const invoiceChequeKeys = new Set<string>();

  // 1. Sales Invoices -> Receivable Cheques (چک‌های دریافتی بابت فاکتور فروش)
  for (const inv of invoices) {
    if (!inv || inv.isProforma === true || inv.isProforma === 'true') continue;
    if (inv.isDeleted || inv.deleted === true) continue;
    if (inv.paymentStatus === 'unpaid') continue;
    if (inv.paymentMethod !== 'cheque' && !inv.chequeNumber) continue;

    const dueDate = normalizeJalaliDateServer(inv.chequeDueDate);
    const daysRemaining = calculateDaysUntilJalaliDueServer(dueDate, todayJalali);
    if (!dueDate || daysRemaining === null) continue;

    const chequeNumber = String(inv.chequeNumber || '').trim();
    const cust = inv.customerId ? customerMap.get(inv.customerId) : null;
    if (inv.id) {
      invoiceChequeKeys.add(`${inv.id}::${dueDate}::${toEnglishDigitsServer(chequeNumber)}`);
    }

    candidates.push({
      kind: 'invoice',
      direction: 'receivable',
      record: inv,
      chequeNumber,
      dueDate,
      daysRemaining,
      amount: Number(inv.paidAmount) > 0 ? Number(inv.paidAmount) : Number(inv.finalTotal) || 0,
      counterpartyName: inv.customerName || cust?.name || 'مشتری',
      counterpartyPhone: inv.customerPhone || cust?.phone || '',
      accountHolder: inv.chequeName || '',
      sourceLabel: `فاکتور فروش #${inv.invoiceNumber || inv.id}`,
      notes: inv.notes || '',
    });
  }

  // 2. Purchase Invoices -> Payable Cheques (چک‌های پرداختی بابت فاکتور خرید)
  for (const pur of purchases) {
    if (!pur || pur.isDeleted || pur.deleted === true) continue;
    if (pur.paymentStatus === 'unpaid') continue;
    if (pur.paymentMethod !== 'cheque' && !pur.chequeNumber) continue;

    const dueDate = normalizeJalaliDateServer(pur.chequeDueDate);
    const daysRemaining = calculateDaysUntilJalaliDueServer(dueDate, todayJalali);
    if (!dueDate || daysRemaining === null) continue;

    candidates.push({
      kind: 'purchase',
      direction: 'payable',
      record: pur,
      chequeNumber: String(pur.chequeNumber || '').trim(),
      dueDate,
      daysRemaining,
      amount: Number(pur.paidAmount) > 0 ? Number(pur.paidAmount) : Number(pur.finalTotal) || 0,
      counterpartyName: pur.supplierName || 'تامین‌کننده',
      counterpartyPhone: pur.supplierPhone || '',
      accountHolder: pur.chequeName || '',
      sourceLabel: `فاکتور خرید #${pur.invoiceNumber || pur.id}`,
      notes: pur.notes || '',
    });
  }

  // 3. Customer Ledger Transactions -> Deposit (Receivable) or Debt/Payable (چک دریافتی یا پرداختی دفتر طرف‌حساب)
  for (const tx of transactions) {
    if (!tx || tx.isDeleted || tx.deleted === true) continue;
    if (tx.paymentMethod !== 'cheque' && !tx.chequeDueDate) continue;

    const dueDate = normalizeJalaliDateServer(tx.chequeDueDate);
    const daysRemaining = calculateDaysUntilJalaliDueServer(dueDate, todayJalali);
    if (!dueDate || daysRemaining === null) continue;

    const chequeNumber = String(tx.trackingNumber || tx.chequeNumber || '').trim();
    if (
      tx.invoiceId &&
      invoiceChequeKeys.has(`${tx.invoiceId}::${dueDate}::${toEnglishDigitsServer(chequeNumber)}`)
    ) {
      continue;
    }

    const cust = tx.customerId ? customerMap.get(tx.customerId) : null;
    const isPayable = tx.type === 'debt';

    candidates.push({
      kind: 'transaction',
      direction: isPayable ? 'payable' : 'receivable',
      record: tx,
      chequeNumber,
      dueDate,
      daysRemaining,
      amount: Number(tx.amount) || 0,
      counterpartyName: tx.customerName || cust?.name || 'طرف حساب',
      counterpartyPhone: cust?.phone || '',
      accountHolder: tx.bankName || '',
      sourceLabel: tx.title || (isPayable ? 'چک پرداختی دفتر حساب' : 'چک دریافتی دفتر حساب'),
      notes: tx.notes || '',
    });
  }

  return candidates;
}

async function checkAndSendServerChequeReminders(overrides?: {
  botToken?: string;
  chatId?: string;
  forceSend?: boolean;
}): Promise<{
  checkedCount: number;
  upcomingCount: number;
  receivableDueCount: number;
  payableDueCount: number;
  sentCount: number;
  sentCheques: Array<{ direction: 'receivable' | 'payable'; chequeNumber: string; dueDate: string; counterparty: string }>;
  errors: string[];
}> {
  if (isChequeReminderCheckRunning) {
    return {
      checkedCount: 0,
      upcomingCount: 0,
      receivableDueCount: 0,
      payableDueCount: 0,
      sentCount: 0,
      sentCheques: [],
      errors: [],
    };
  }

  isChequeReminderCheckRunning = true;
  try {
    const { data: dbData } = await getLatestConvergedDatabase();
    const serverSettings = dbData?.settings || {};

    const isManualForce = Boolean(overrides?.forceSend);
    const isManualCheck = Boolean(overrides?.botToken && overrides?.chatId) || isManualForce;
    const isEnabled =
      isManualCheck ||
      (Boolean(serverSettings?.telegramBotEnabled) && serverSettings?.telegramAutoSendChequeReminder !== false);
    const botToken = sanitizeTelegramBotToken(
      overrides?.botToken || serverSettings?.telegramBotToken || process.env.TELEGRAM_BOT_TOKEN || ''
    );
    const targetChatId = String(
      overrides?.chatId || serverSettings?.telegramChatId || process.env.TELEGRAM_CHAT_ID || ''
    ).trim();

    if (!isEnabled || !botToken || !targetChatId) {
      return {
        checkedCount: 0,
        upcomingCount: 0,
        receivableDueCount: 0,
        payableDueCount: 0,
        sentCount: 0,
        sentCheques: [],
        errors: [
          !isEnabled
            ? 'یادآوری خودکار چک در تنظیمات تلگرام غیرفعال است.'
            : 'تنظیمات ربات تلگرام ناقص است (توکن ربات یا شناسه چت وارد نشده است).',
        ],
      };
    }

    const todayJalali = getTehranJalaliDateTime().dateOnly;
    const allCheques = collectActiveChequesForReminder(dbData, todayJalali);
    const upcomingCheques = allCheques.filter((c) => c.daysRemaining >= 0 && c.daysRemaining <= 7);

    const receivableDueCount = upcomingCheques.filter((c) => c.direction === 'receivable').length;
    const payableDueCount = upcomingCheques.filter((c) => c.direction === 'payable').length;

    const sentCheques: Array<{
      direction: 'receivable' | 'payable';
      chequeNumber: string;
      dueDate: string;
      counterparty: string;
    }> = [];
    const errors: string[] = [];
    let modified = false;

    const store = serverSettings.storeName || 'سامانه حسابداری و انبارداری';
    const currency = serverSettings.currency || 'تومان';

    for (const item of upcomingCheques) {
      const alreadySentForDate = normalizeJalaliDateServer(item.record?.chequeReminderSentForDate);
      if (!isManualForce && alreadySentForDate === item.dueDate) {
        continue;
      }

      const isPayable = item.direction === 'payable';
      const directionBadge = isPayable ? '📤 چک پرداختی (تعهد مالی)' : '📥 چک دریافتی (وصولی)';
      const headerLine = isPayable
        ? `🔴 <b>یادآوری سررسید چک پرداختی</b>`
        : `🟢 <b>یادآوری سررسید چک دریافتی</b>`;

      const countdownLabel =
        item.daysRemaining === 0
          ? 'موعد سررسید امروز است!'
          : item.daysRemaining === 7
          ? 'دقیقاً ۷ روز (یک هفته) تا سررسید'
          : `${toPersianDigitsServer(item.daysRemaining)} روز مانده تا سررسید`;

      const actionHint = isPayable
        ? 'لطفاً جهت تامین موجودی حساب بانکی و جلوگیری از برگشت چک اقدام فرمایید.'
        : 'لطفاً جهت یادآوری به صادرکننده و پیگیری وصول چک در موعد مقرر اقدام فرمایید.';

      const messageLines = [
        headerLine,
        `━━━━━━━━━━━━━━━━━━━━`,
        `🏷️ <b>نوع چک:</b> ${directionBadge}`,
        `⏳ <b>وضعیت موعد:</b> <b>${countdownLabel}</b>`,
        `📅 <b>تاریخ سررسید:</b> <code>${escapeTelegramHtml(toPersianDigitsServer(item.dueDate))}</code>`,
        item.chequeNumber
          ? `🧾 <b>شماره چک / صیاد:</b> <code>${escapeTelegramHtml(toPersianDigitsServer(item.chequeNumber))}</code>`
          : '',
        `💰 <b>مبلغ چک:</b> <b>${toPersianDigitsServer(formatPriceServer(item.amount))} ${escapeTelegramHtml(currency)}</b>`,
        `👤 <b>${isPayable ? 'در وجه / تامین‌کننده' : 'صادرکننده / مشتری'}:</b> <b>${escapeTelegramHtml(item.counterpartyName)}</b>`,
        item.counterpartyPhone
          ? `📞 <b>تلفن:</b> <code>${escapeTelegramHtml(toPersianDigitsServer(item.counterpartyPhone))}</code>`
          : '',
        item.accountHolder
          ? `🏦 <b>بانک / صاحب حساب:</b> ${escapeTelegramHtml(item.accountHolder)}`
          : '',
        `📄 <b>مستند ثبت:</b> ${escapeTelegramHtml(item.sourceLabel)}`,
        item.notes ? `📝 <b>توضیحات:</b> <i>${escapeTelegramHtml(item.notes)}</i>` : '',
        `━━━━━━━━━━━━━━━━━━━━`,
        `🔔 <b>توصیه:</b> ${actionHint}`,
        store ? `🏪 <i>${escapeTelegramHtml(store)}</i>` : '',
      ].filter(Boolean);

      try {
        const { ok, data } = await callTelegramApi('sendMessage', {
          token: botToken,
          body: {
            chat_id: targetChatId,
            text: messageLines.join('\n'),
            parse_mode: 'HTML',
          },
        });

        if (ok && data.ok) {
          const nowIso = new Date().toISOString();
          item.record.chequeReminderSentAt = nowIso;
          item.record.chequeReminderSentForDate = item.dueDate;
          modified = true;

          sentCheques.push({
            direction: item.direction,
            chequeNumber: item.chequeNumber || 'بدون شماره',
            dueDate: item.dueDate,
            counterparty: item.counterpartyName,
          });
          console.log(
            `[Cheque Reminder] Sent 7-day alert for ${item.direction} cheque (${item.chequeNumber || item.sourceLabel}, due ${item.dueDate}) to Telegram.`
          );
        } else {
          errors.push(
            `چک ${item.chequeNumber || item.counterpartyName}: ${data.description || 'خطا در ارسال به تلگرام'}`
          );
        }
      } catch (err: any) {
        errors.push(
          `چک ${item.chequeNumber || item.counterpartyName}: ${err?.message || 'خطا در ارتباط با تلگرام'}`
        );
      }
    }

    if (modified) {
      recordServerActivityLog(dbData, {
        actionType: 'cheque_telegram_reminder_sent',
        actionTitle: 'ارسال خودکار یادآوری سررسید چک به تلگرام',
        details: `یادآوری یک هفته قبل برای ${toPersianDigitsServer(sentCheques.length)} فقره چک (${sentCheques
          .map((c) => `${c.direction === 'payable' ? 'پرداختی' : 'دریافتی'} ${c.counterparty} - سررسید ${c.dueDate}`)
          .join('، ')}) به تلگرام ارسال شد.`,
        category: 'system',
        severity: 'info',
        entityType: 'cheque',
        entityLabel: `${toPersianDigitsServer(sentCheques.length)} چک`,
        metadata: {
          sentCount: sentCheques.length,
          receivableDueCount,
          payableDueCount,
        },
      });
      writeDatabase(dbData, true, true);
      if (getPostgresStatus().connected) {
        saveStateToPostgres(dbData).catch(() => {});
      }
    }

    return {
      checkedCount: allCheques.length,
      upcomingCount: upcomingCheques.length,
      receivableDueCount,
      payableDueCount,
      sentCount: sentCheques.length,
      sentCheques,
      errors,
    };
  } catch (err: any) {
    console.error('[Cheque Reminder] Error running check:', err);
    return {
      checkedCount: 0,
      upcomingCount: 0,
      receivableDueCount: 0,
      payableDueCount: 0,
      sentCount: 0,
      sentCheques: [],
      errors: [err?.message || 'خطای سرور در بررسی سررسید چک‌ها'],
    };
  } finally {
    isChequeReminderCheckRunning = false;
  }
}

app.post('/api/telegram/check-cheque-reminders', requireAdmin, async (req, res) => {
  try {
    const result = await checkAndSendServerChequeReminders({
      botToken: req.body?.botToken,
      chatId: req.body?.chatId,
      forceSend: Boolean(req.body?.forceSend),
    });

    if (result.errors.length > 0 && result.sentCount === 0) {
      return res.json({
        success: false,
        result,
        error: result.errors.join(' | '),
      });
    }

    return res.json({
      success: true,
      result,
      message:
        result.sentCount > 0
          ? `یادآوری یک هفته قبل برای ${toPersianDigitsServer(result.sentCount)} فقره چک (دریافتی و پرداختی) با موفقیت به تلگرام ارسال شد.`
          : result.upcomingCount > 0
          ? `تمام ${toPersianDigitsServer(result.upcomingCount)} چک در بازه ۷ روز آینده قبلاً یادآوری تلگرام دریافت کرده‌اند.`
          : `بررسی انجام شد (${toPersianDigitsServer(result.checkedCount)} چک ثبت‌شده): هیچ چکی با سررسید در ۷ روز آینده یافت نشد.`,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || 'خطای سرور' });
  }
});

app.get('/api/telegram/cheque-reminders-status', requireAdmin, (_req, res) => {
  try {
    const dbData = readDatabase();
    const todayJalali = getTehranJalaliDateTime().dateOnly;
    const allCheques = collectActiveChequesForReminder(dbData, todayJalali);
    const upcomingList = allCheques
      .filter((c) => c.daysRemaining >= 0 && c.daysRemaining <= 7)
      .map((c) => ({
        kind: c.kind,
        direction: c.direction,
        chequeNumber: c.chequeNumber,
        dueDate: c.dueDate,
        daysRemaining: c.daysRemaining,
        amount: c.amount,
        counterpartyName: c.counterpartyName,
        sourceLabel: c.sourceLabel,
        reminderSentAt: c.record?.chequeReminderSentAt || null,
        reminderSentForDate: c.record?.chequeReminderSentForDate || null,
      }));

    return res.json({
      success: true,
      todayJalali,
      totalActiveCheques: allCheques.length,
      upcomingCount: upcomingList.length,
      upcomingList,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || 'خطای سرور' });
  }
});

// Run background 7-day cheque reminder check periodically (every 30 mins) & 15 seconds after startup
setTimeout(() => {
  checkAndSendServerChequeReminders().catch((e) => console.warn('[Cheque Reminder] Initial check error:', e));
}, 15000);
setInterval(() => {
  checkAndSendServerChequeReminders().catch((e) => console.warn('[Cheque Reminder] Interval check error:', e));
}, 30 * 60 * 1000);

// 12.3 Send PDF Document to Chat/Channel/Group (sendDocument)
app.post('/api/telegram/send-pdf', async (req, res) => {
  try {
    const authUser = (req as AuthenticatedRequest).authUser;
    const callerIsAdmin = isAdminUser(authUser);
    const dbData = readDatabase();
    const serverSettings = dbData?.settings || {};

    const botToken = (
      (callerIsAdmin ? req.body?.botToken : '') ||
      serverSettings?.telegramBotToken ||
      process.env.TELEGRAM_BOT_TOKEN ||
      ''
    ).trim();

    const chatId = (
      (callerIsAdmin ? req.body?.chatId : '') ||
      serverSettings?.telegramChatId ||
      process.env.TELEGRAM_CHAT_ID ||
      ''
    ).trim();

    const { pdfBase64, filename, caption } = req.body;

    if (!botToken) {
      return res.status(400).json({ success: false, error: 'توکن ربات تلگرام در تنظیمات ثبت نشده است.' });
    }
    if (!chatId) {
      return res.status(400).json({ success: false, error: 'شناسه چت یا کانال مقصد مشخص نشده است.' });
    }
    if (!pdfBase64) {
      return res.status(400).json({ success: false, error: 'محتوای فایل PDF یافت نشد.' });
    }

    const safeFilename = (filename || 'invoice.pdf').endsWith('.pdf') ? filename : `${filename}.pdf`;
    const cleanBase64 = String(pdfBase64).replace(/^data:[^;]+;base64,/, '').trim();
    const pdfBuffer = Buffer.from(cleanBase64, 'base64');
    const fileBlob = new Blob([pdfBuffer], { type: 'application/pdf' });

    const formData = new FormData();
    formData.append('chat_id', chatId);
    formData.append('document', fileBlob, safeFilename);
    if (caption) {
      formData.append('caption', caption);
      formData.append('parse_mode', 'HTML');
    }

    let { ok, data } = await callTelegramApi('sendDocument', {
      token: botToken,
      formData,
    });

    // Fallback: If Telegram rejected due to HTML parse entity syntax, retry without parse_mode
    if (!ok && data?.description && data.description.includes('can\'t parse entities')) {
      console.warn('[Telegram API] HTML entity parse error, retrying without parse_mode...');
      const fallbackFd = new FormData();
      fallbackFd.append('chat_id', chatId);
      fallbackFd.append('document', fileBlob, safeFilename);
      if (caption) {
        fallbackFd.append('caption', caption.replace(/<[^>]+>/g, ''));
      }
      const retryRes = await callTelegramApi('sendDocument', {
        token: botToken,
        formData: fallbackFd,
      });
      ok = retryRes.ok;
      data = retryRes.data;
    }

    if (!ok || !data.ok) {
      console.error('[Telegram API] sendDocument failed:', data);
      return res.status(400).json({
        success: false,
        error: data.description || 'ارسال فایل PDF به تلگرام با خطا مواجه شد. لطفاً دسترسی ربات به این چت را بررسی فرمایید.',
      });
    }

    return res.json({
      success: true,
      message: `فایل PDF «${safeFilename}» با موفقیت به تلگرام ارسال شد.`,
      result: data.result,
    });
  } catch (err: any) {
    console.error('[Telegram API] send-pdf exception:', err);
    return res.status(500).json({
      success: false,
      error: 'خطای سرور در ارسال فایل به تلگرام: ' + (err?.message || ''),
    });
  }
});

// 12.3.5 Send Database Backup JSON to Chat/Channel/Group via Telegram
app.post('/api/telegram/send-backup', requireAdmin, async (req, res) => {
  try {
    const { data: dbData } = await getLatestConvergedDatabase();
    const serverSettings = dbData?.settings || {};

    const botToken = (
      req.body?.botToken ||
      serverSettings?.telegramBotToken ||
      process.env.TELEGRAM_BOT_TOKEN ||
      ''
    ).trim();

    const chatId = (
      req.body?.chatId ||
      serverSettings?.telegramChatId ||
      process.env.TELEGRAM_CHAT_ID ||
      ''
    ).trim();

    const specificFilename = req.body?.filename ? path.basename(req.body.filename) : null;

    if (!botToken) {
      return res.status(400).json({
        success: false,
        error: 'توکن ربات تلگرام در تنظیمات سیستم ثبت نشده است. لطفاً ابتدا در بخش «تنظیمات > تلگرام»، توکن ربات را وارد و ذخیره فرمایید.',
      });
    }
    if (!chatId) {
      return res.status(400).json({
        success: false,
        error: 'شناسه چت یا کانال تلگرام (Chat ID) در سیستم ثبت نشده است. لطفاً ابتدا در «تنظیمات > تلگرام»، چت‌آیدی را ثبت فرمایید.',
      });
    }

    // 1. Get authoritative data from specific backup file, or converged database / PostgreSQL
    let dbPayload: any = null;

    if (specificFilename) {
      const specificPath = path.join(BACKUPS_DIR, specificFilename);
      if (fs.existsSync(specificPath)) {
        try {
          const raw = fs.readFileSync(specificPath, 'utf-8');
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === 'object') {
            dbPayload = parsed;
          }
        } catch (e) {
          console.warn('[Telegram Backup] Failed reading archive file:', e);
        }
      }
    }

    let sqlScript = '';
    if (!specificFilename) {
      try {
        const liveDump = await exportLiveDatabaseDump();
        if (liveDump?.sql) {
          sqlScript = liveDump.sql;
        }
      } catch (_) {}
    }

    if (!dbPayload) {
      const { data: converged } = await getLatestConvergedDatabase();
      dbPayload = converged || await loadStateFromPostgres() || dbData || readDatabase();
    }

    if (!sqlScript) {
      sqlScript = generatePostgresSqlDump(dbPayload);
    }

    const now = new Date();
    const jalaliStr = getJalaliDateStr(now).replace(/\//g, '-');
    const timeStr = `${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}`;
    const safeFilename = `mana_db_backup_${jalaliStr}_${timeStr}.sql`;

    const fileBuffer = Buffer.from(sqlScript, 'utf-8');
    const fileBlob = new Blob([fileBuffer], { type: 'application/sql' });

    const jalaliDate = getJalaliDateStr(now);
    const jalaliTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const productsCount = Array.isArray(dbPayload?.products) ? dbPayload.products.length : 0;
    const invoicesCount = Array.isArray(dbPayload?.invoices) ? dbPayload.invoices.length : 0;
    const customersCount = Array.isArray(dbPayload?.customers) ? dbPayload.customers.length : 0;
    const sizeKb = Math.round(fileBuffer.length / 1024);

    const caption = [
      '🗄 <b>نسخه اسکریپت SQL پایگاه‌داده (PostgreSQL - mana_db)</b>',
      `📅 <b>تاریخ:</b> ${jalaliDate} ساعت ${jalaliTime}`,
      `📊 <b>آمار اطلاعات:</b> ${productsCount} کالا | ${invoicesCount} فاکتور | ${customersCount} طرف‌حساب`,
      `💾 <b>حجم فایل:</b> ${sizeKb} کیلوبایت (فرمت استاندارد .sql)`,
      '⚡ <i>این فایل شامل اسکریپت کامل ساختار DDL و داده‌های DML دیتابیس PostgreSQL است و مستقیماً در دیتابیس یا ابزارهای مدیریت پایگاه‌داده (DBeaver / pgAdmin / psql) قابل اجرا و بازیابی می‌باشد.</i>',
    ].join('\n');

    const formData = new FormData();
    formData.append('chat_id', chatId);
    formData.append('document', fileBlob, safeFilename);
    formData.append('caption', caption);
    formData.append('parse_mode', 'HTML');

    let { ok, data: teleData } = await callTelegramApi('sendDocument', {
      token: botToken,
      formData,
    });

    if (!ok && teleData?.description && teleData.description.includes("can't parse entities")) {
      const fallbackFd = new FormData();
      fallbackFd.append('chat_id', chatId);
      fallbackFd.append('document', fileBlob, safeFilename);
      fallbackFd.append('caption', caption.replace(/<[^>]+>/g, ''));
      const retryRes = await callTelegramApi('sendDocument', {
        token: botToken,
        formData: fallbackFd,
      });
      ok = retryRes.ok;
      teleData = retryRes.data;
    }

    if (!ok || !teleData?.ok) {
      console.error('[Telegram API] send-backup SQL failed:', teleData);
      return res.status(400).json({
        success: false,
        error: teleData?.description || 'ارسال فایل SQL به تلگرام با خطا مواجه شد. لطفاً دسترسی ربات به این چت را بررسی فرمایید.',
      });
    }

    // 3. Also generate and send JSON backup file (علاوه بر فایل sql، فایل json را نیز قرار بده)
    const jsonStr = JSON.stringify(dbPayload, null, 2);
    const jsonSafeFilename = `mana_db_backup_${jalaliStr}_${timeStr}.json`;
    const jsonBuffer = Buffer.from(jsonStr, 'utf-8');
    const jsonBlob = new Blob([jsonBuffer], { type: 'application/json' });
    const jsonSizeKb = Math.round(jsonBuffer.length / 1024);

    const jsonCaption = [
      '📦 <b>نسخه کامل داده‌های سامانه (فرمت استاندارد JSON)</b>',
      `📅 <b>تاریخ:</b> ${jalaliDate} ساعت ${jalaliTime}`,
      `📊 <b>آمار اطلاعات:</b> ${productsCount} کالا | ${invoicesCount} فاکتور | ${customersCount} طرف‌حساب`,
      `💾 <b>حجم فایل:</b> ${jsonSizeKb} کیلوبایت (فرمت استاندارد .json)`,
      '🔄 <i>این فایل حاوی کل داده‌های سیستم بوده و مستقیماً از بخش «مدیریت پشتیبان‌ها > بازیابی فایل JSON» قابل بازیابی و بارگذاری مجدد در برنامه می‌باشد.</i>',
    ].join('\n');

    const jsonFormData = new FormData();
    jsonFormData.append('chat_id', chatId);
    jsonFormData.append('document', jsonBlob, jsonSafeFilename);
    jsonFormData.append('caption', jsonCaption);
    jsonFormData.append('parse_mode', 'HTML');

    let { ok: jsonOk, data: jsonTeleData } = await callTelegramApi('sendDocument', {
      token: botToken,
      formData: jsonFormData,
    });

    if (!jsonOk && jsonTeleData?.description && jsonTeleData.description.includes("can't parse entities")) {
      const fallbackJsonFd = new FormData();
      fallbackJsonFd.append('chat_id', chatId);
      fallbackJsonFd.append('document', jsonBlob, jsonSafeFilename);
      fallbackJsonFd.append('caption', jsonCaption.replace(/<[^>]+>/g, ''));
      const jsonRetryRes = await callTelegramApi('sendDocument', {
        token: botToken,
        formData: fallbackJsonFd,
      });
      jsonOk = jsonRetryRes.ok;
      jsonTeleData = jsonRetryRes.data;
    }

    if (!jsonOk || !jsonTeleData?.ok) {
      console.warn('[Telegram API] send-backup JSON failed:', jsonTeleData);
    }

    return res.json({
      success: true,
      message: `نسخه‌های پشتیبان پایگاه‌داده (شامل هر دو فایل SQL و JSON) با موفقیت به تلگرام ثبت‌شده در سیستم ارسال گردیدند.`,
      result: teleData.result,
      jsonResult: jsonTeleData?.result,
    });
  } catch (err: any) {
    console.error('[Telegram API] send-backup exception:', err);
    return res.status(500).json({
      success: false,
      error: 'خطای سرور در ارسال نسخه پشتیبان به تلگرام: ' + (err?.message || ''),
    });
  }
});

// -------------------------------------------------------------
// 12.4 AI ENGINE & TELEGRAM VOICE INBOUND ASSISTANT ENDPOINTS
// -------------------------------------------------------------

// Helper to convert Gregorian date to Jalali YYYY/MM/DD string
function getJalaliDateStr(date: Date = new Date()): string {
  const gy = date.getFullYear();
  const gm = date.getMonth() + 1;
  const gd = date.getDate();
  const g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  let jy = (gy <= 1600) ? 0 : 979;
  let rgy = gy - ((gy <= 1600) ? 621 : 1600);
  const gy2 = (gm > 2) ? (rgy + 1) : rgy;
  let days = (365 * rgy) + Math.floor((gy2 + 3) / 4) - Math.floor((gy2 + 99) / 100) +
    Math.floor((gy2 + 399) / 400) - 80 + gd + g_d_m[gm - 1];
  jy += 33 * Math.floor(days / 12053);
  days %= 12053;
  jy += 4 * Math.floor(days / 1461);
  days %= 1461;
  jy += Math.floor((days - 1) / 365);
  if (days > 0) {
    days = (days - 1) % 365;
  }
  let jm: number;
  let jd: number;
  if (days < 186) {
    jm = 1 + Math.floor(days / 31);
    jd = 1 + (days % 31);
  } else {
    jm = 7 + Math.floor((days - 186) / 30);
    jd = 1 + ((days - 186) % 30);
  }
  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  return `${jy}/${pad(jm)}/${pad(jd)}`;
}

// 12.4.1 Test AI Connection & API Key
app.post('/api/ai/test-connection', requireAdmin, async (req, res) => {
  try {
    const { data: dbData } = await getLatestConvergedDatabase();
    const settings = dbData?.settings || {};

    const provider = req.body?.provider || settings?.aiProvider || 'gemini';
    const apiKey = (req.body?.apiKey || settings?.aiApiKey || (provider === 'gemini' ? process.env.GEMINI_API_KEY : '') || '').trim();
    const model = (req.body?.model || settings?.aiModel || (provider === 'gemini' ? 'gemini-2.5-flash' : 'whisper-1')).trim();
    const baseUrl = (req.body?.baseUrl || settings?.aiBaseUrl || '').trim();

    if (!apiKey && provider !== 'custom') {
      return res.status(400).json({
        success: false,
        error: 'کلید API هوش مصنوعی وارد نشده است. لطفاً در پنل مدیریت یا تنظیمات کلید را ثبت کنید.',
      });
    }

    if (provider === 'gemini') {
      const aiClient = new GoogleGenAI({ apiKey });
      const testModel = model || 'gemini-2.5-flash';
      const prompt = 'پاسخ بسیار کوتاه یک کلمه‌ای فقط به صورت JSON: {"status": "ok", "provider": "gemini"}';
      const response = await aiClient.models.generateContent({
        model: testModel,
        contents: prompt,
      });

      const responseText = response.text || '';
      return res.json({
        success: true,
        provider: 'gemini',
        model: testModel,
        message: `اتصال به هوش مصنوعی Gemini (${testModel}) با موفقیت برقرار شد.`,
        rawResponse: responseText.trim(),
      });
    } else if (provider === 'openai' || provider === 'custom') {
      const targetUrl = baseUrl ? `${baseUrl.replace(/\/$/, '')}/chat/completions` : 'https://api.openai.com/v1/chat/completions';
      const response = await fetch(targetUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: model || (provider === 'openai' ? 'gpt-4o-mini' : 'custom-model'),
          messages: [{ role: 'user', content: 'Say {"status":"ok"} in JSON only' }],
          max_tokens: 30,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        return res.status(400).json({
          success: false,
          error: data?.error?.message || `خطا در برقراری ارتباط با ${provider} (کد ${response.status})`,
        });
      }

      return res.json({
        success: true,
        provider,
        model: model || 'gpt-4o-mini',
        message: `اتصال به سرویس هوش مصنوعی (${provider}) با موفقیت برقرار شد.`,
        data: data.choices?.[0]?.message?.content,
      });
    }

    return res.status(400).json({ success: false, error: 'ارائه‌دهنده هوش مصنوعی نامعتبر است.' });
  } catch (err: any) {
    console.error('[AI Test Connection] Error:', err);
    return res.status(500).json({
      success: false,
      error: 'خطا در ارتباط با سرور هوش مصنوعی: ' + (err?.message || ''),
    });
  }
});

// Helper function to extract structured inbound items from audio using configured AI
async function processVoiceWithAI(audioBuffer: Buffer, mimeType: string, settings: any, existingProducts: any[]): Promise<{
  transcript: string;
  items: Array<{
    productName: string;
    quantity: number;
    unit?: string;
    notes?: string;
    matchedProductId?: string;
  }>;
  supplierName?: string;
  rawJson?: any;
}> {
  const provider = settings?.aiProvider || 'gemini';
  const apiKey = (settings?.aiApiKey || (provider === 'gemini' ? process.env.GEMINI_API_KEY : '') || '').trim();
  const model = (settings?.aiModel || (provider === 'gemini' ? 'gemini-2.5-flash' : 'whisper-1')).trim();
  const baseUrl = (settings?.aiBaseUrl || '').trim();

  // Create list of known products for AI fuzzy matching
  const productReferenceList = (existingProducts || []).slice(0, 80).map((p: any) => ({
    id: p.id,
    name: p.name,
    code: p.code,
    unit: p.unit || 'عدد',
  }));

  const systemPrompt = `تو دستیار هوشمند انبارداری و ثبت ورود کالا به کارگاه و انبار هستی.
یک فایل صوتی (ویس کارگاهی) توسط انباردار یا مسئول کارگاه ارسال شده است که در آن ورود یک یا چند قلم کالا را گزارش می‌دهد.
وظیفه تو:
۱. متن دقیق گفته‌شده به فارسی را پیاده‌سازی کن (transcript).
۲. اقلام ورودی، تعداد (عددی)، واحد شمارش (مثلا پاکت، کیسه، عدد، شاخه، تن، متر، کیلو و غیره) و در صورت ذکر شدن نام تامین‌کننده/راننده/کارگاه را استخراج کن.
۳. در صورت امکان، نام کالا را با لیست کالاهای موجود در انبار تطبیق بده.

لیست کالاهای مرجع انبار:
${JSON.stringify(productReferenceList)}

${settings?.aiCustomPrompt ? `دستورالعمل اختصاصی کاربر: ${settings.aiCustomPrompt}` : ''}

حتماً و فقط خروجی را به صورت ساختار معتبر JSON خالص بدون هیچ متن اضافی یا علامت نقل‌قول کد بازگردان:
{
  "transcript": "متن دقیق شنیده شده به فارسی",
  "supplierName": "نام تامین‌کننده یا راننده در صورت ذکر شدن یا خالی",
  "items": [
    {
      "productName": "نام کالا (مثلا: سیمان تیپ ۲)",
      "quantity": 10,
      "unit": "پاکت",
      "matchedProductId": "شناسه کالای تطبیق داده شده از لیست مرجع در صورت تطبیق یا خالی",
      "notes": "توضیحات تکمیلی در صورت وجود"
    }
  ]
}`;

  if (provider === 'gemini') {
    if (!apiKey) {
      throw new Error('کلید Gemini API در تنظیمات یا متغیرهای محیطی یافت نشد.');
    }
    const aiClient = new GoogleGenAI({ apiKey });
    const targetModel = model || 'gemini-2.5-flash';

    const base64Audio = audioBuffer.toString('base64');
    const audioPart = {
      inlineData: {
        data: base64Audio,
        mimeType: mimeType || 'audio/ogg',
      },
    };

    const response = await aiClient.models.generateContent({
      model: targetModel,
      contents: [
        { role: 'user', parts: [audioPart, { text: systemPrompt }] },
      ],
      config: {
        responseMimeType: 'application/json',
      },
    });

    const text = response.text || '{}';
    let parsed: any;
    try {
      parsed = JSON.parse(text);
    } catch {
      const match = text.match(/\{[\s\S]*\}/);
      if (match) {
        parsed = JSON.parse(match[0]);
      } else {
        throw new Error('عدم دریافت ساختار JSON معتبر از هوش مصنوعی');
      }
    }

    return {
      transcript: parsed.transcript || 'بدون متن',
      supplierName: parsed.supplierName || 'ورودی صوتی تلگرام',
      items: Array.isArray(parsed.items) ? parsed.items : [],
      rawJson: parsed,
    };
  } else if (provider === 'openai' || provider === 'custom') {
    // 1. Transcribe via Whisper
    const whisperUrl = baseUrl ? `${baseUrl.replace(/\/$/, '')}/audio/transcriptions` : 'https://api.openai.com/v1/audio/transcriptions';
    const form = new FormData();
    const audioBlob = new Blob([audioBuffer], { type: mimeType || 'audio/ogg' });
    form.append('file', audioBlob, 'voice.ogg');
    form.append('model', 'whisper-1');
    form.append('language', 'fa');

    const whisperRes = await fetch(whisperUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: form,
    });

    const whisperData = await whisperRes.json();
    if (!whisperRes.ok) {
      throw new Error(`خطا در Whisper API: ${whisperData?.error?.message || whisperRes.statusText}`);
    }

    const transcript = whisperData.text || '';

    // 2. Parse items using Chat Completion
    const chatUrl = baseUrl ? `${baseUrl.replace(/\/$/, '')}/chat/completions` : 'https://api.openai.com/v1/chat/completions';
    const chatRes = await fetch(chatUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model && !model.includes('whisper') ? model : 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `متن ویس پیاده‌سازی شده: "${transcript}"` },
        ],
        response_format: { type: 'json_object' },
      }),
    });

    const chatData = await chatRes.json();
    if (!chatRes.ok) {
      throw new Error(`خطا در استخراج اقلام: ${chatData?.error?.message || chatRes.statusText}`);
    }

    const parsed = JSON.parse(chatData.choices?.[0]?.message?.content || '{}');
    return {
      transcript: transcript || parsed.transcript,
      supplierName: parsed.supplierName || 'ورودی صوتی تلگرام',
      items: Array.isArray(parsed.items) ? parsed.items : [],
      rawJson: parsed,
    };
  }

  throw new Error(`ارائه‌دهنده هوش مصنوعی «${provider}» پشتیبانی نمی‌شود.`);
}

// 12.4.2 Direct Voice Audio Analysis (for testing from UI or direct upload)
app.post('/api/ai/process-voice', requireAdminOrInventory, async (req, res) => {
  try {
    const { audioBase64, mimeType } = req.body;
    if (!audioBase64) {
      return res.status(400).json({ success: false, error: 'فایل صوتی یافت نشد.' });
    }

    const { data: dbData } = await getLatestConvergedDatabase();
    const settings = dbData?.settings || {};
    const products = dbData?.products || [];

    const cleanBase64 = String(audioBase64).replace(/^data:[^;]+;base64,/, '').trim();
    const audioBuffer = Buffer.from(cleanBase64, 'base64');

    const result = await processVoiceWithAI(audioBuffer, mimeType || 'audio/ogg', settings, products);
    return res.json({ success: true, ...result });
  } catch (err: any) {
    console.error('[AI Process Voice] Error:', err);
    return res.status(500).json({ success: false, error: 'خطا در پردازش ویس: ' + (err?.message || '') });
  }
});

// 12.4.3 Telegram Webhook Handler (receives voice messages, downloads audio, calls AI, creates pending InboundReceipt)
app.post('/api/telegram/webhook', async (req, res) => {
  // Always respond 200 quickly to Telegram
  res.status(200).json({ ok: true });

  try {
    const update = req.body;
    if (!update) return;

    const message = update.message || update.edited_message;
    if (!message) return;

    const { data: dbData } = await getLatestConvergedDatabase();
    const settings = dbData?.settings || {};

    const botToken = (settings?.telegramBotToken || process.env.TELEGRAM_BOT_TOKEN || '').trim();
    if (!botToken || !settings.telegramBotEnabled) {
      console.log('[Telegram Webhook] Bot is not enabled or token is missing.');
      return;
    }

    const chatId = message.chat?.id;
    const sender = message.from || {};
    const isVoice = !!message.voice;
    const isAudio = !!message.audio;
    const isDocumentAudio = message.document && (message.document.mime_type || '').startsWith('audio/');

    // Handle /start or greeting command
    if (message.text && message.text.startsWith('/start')) {
      const welcomeText = [
        '👋 <b>سلام به دستیار هوشمند انبارداری و حسابداری</b>',
        '',
        '🎙️ <b>قابلیت دریافت پیام صوتی (Voice):</b>',
        'شما می‌توانید یک ویس تلگرامی در مورد ورود کالای جدید به کارگاه یا انبار ارسال کنید.',
        '<i>مثال صوتی: «سلام، امروز ۱۰ پاکت سیمان تیپ ۲ و ۵ شاخه لوله پلیکا وارد کارگاه شد.»</i>',
        '',
        '⚙️ سیستم با هوش مصنوعی صدا را تبدیل کرده و یک <b>حواله ورود به انبار در انتظار تایید مدیریت</b> ثبت می‌کند.',
      ].join('\n');

      await callTelegramApi('sendMessage', {
        token: botToken,
        body: { chat_id: chatId, text: welcomeText, parse_mode: 'HTML' },
      });
      return;
    }

    // Check if voice inbound is enabled
    if (!settings.aiVoiceInboundEnabled) {
      console.log('[Telegram Webhook] Voice inbound is disabled in settings.');
      return;
    }

    if (!isVoice && !isAudio && !isDocumentAudio) {
      return;
    }

    const fileId = message.voice?.file_id || message.audio?.file_id || message.document?.file_id;
    const mimeType = message.voice?.mime_type || message.audio?.mime_type || message.document?.mime_type || 'audio/ogg';

    if (!fileId) return;

    // Send acknowledgement to user
    await callTelegramApi('sendMessage', {
      token: botToken,
      body: {
        chat_id: chatId,
        reply_to_message_id: message.message_id,
        text: '🎙️ <b>ویس شما دریافت شد.</b>\nدر حال پردازش هوشمند و استخراج اقلام ورودی به انبار با هوش مصنوعی...',
        parse_mode: 'HTML',
      },
    });

    // 1. Get file path from Telegram
    const { ok: fileOk, data: fileInfo } = await callTelegramApi(`getFile?file_id=${fileId}`, {
      token: botToken,
    });
    if (!fileOk || !fileInfo?.result?.file_path) {
      throw new Error('عدم امکان دریافت مشخصات فایل صوتی از سرور تلگرام');
    }

    // 2. Download the voice file
    const baseUrl = (settings.telegramApiUrl || process.env.TELEGRAM_API_URL || 'https://api.telegram.org').trim().replace(/\/+$/, '');
    const downloadUrl = `${baseUrl}/file/bot${sanitizeTelegramBotToken(botToken)}/${fileInfo.result.file_path}`;
    const proxyUrl = settings.telegramProxyUrl;
    const dispatcher = await getTelegramDispatcher(proxyUrl);
    const audioRes = await fetch(downloadUrl, dispatcher ? { dispatcher } as any : undefined);
    const audioBuffer = Buffer.from(await audioRes.arrayBuffer());

    // 3. Process voice using configured AI
    const aiResult = await processVoiceWithAI(audioBuffer, mimeType, settings, dbData?.products || []);

    if (!aiResult.items || aiResult.items.length === 0) {
      await callTelegramApi('sendMessage', {
        token: botToken,
        body: {
          chat_id: chatId,
          reply_to_message_id: message.message_id,
          text: `⚠️ <b>متن پیاده‌سازی شده:</b>\n<i>«${escapeTelegramHtml(aiResult.transcript)}»</i>\n\nهیچ قلم کالایی در این پیام صوتی تشخیص داده نشد. لطفاً مجدداً با ذکر دقیق نام و تعداد کالا پیام صوتی بفرستید.`,
          parse_mode: 'HTML',
        },
      });
      return;
    }

    // 4. Create Inbound Receipt in status 'pending_verification'
    const nowJalali = getJalaliDateStr();
    const receiptCode = `REC-VOICE-${Date.now().toString().slice(-4)}`;

    const inboundItems = aiResult.items.map((it, idx) => {
      // Find matching product if any
      let matched = (dbData?.products || []).find((p: any) => p.id === it.matchedProductId);
      if (!matched && it.productName) {
        const cleanName = it.productName.trim().toLowerCase();
        matched = (dbData?.products || []).find((p: any) => p.name.trim().toLowerCase().includes(cleanName) || cleanName.includes(p.name.trim().toLowerCase()));
      }

      return {
        id: `item-${Date.now()}-${idx}`,
        productId: matched ? matched.id : `voice-prod-${Date.now()}-${idx}`,
        productName: matched ? matched.name : it.productName,
        productCode: matched ? matched.code : `VC-${idx + 1}`,
        unit: it.unit || matched?.unit || 'عدد',
        expectedQuantity: Number(it.quantity) || 1,
        receivedQuantity: Number(it.quantity) || 1,
        discrepancy: 0,
        discrepancyReason: '',
        buyPrice: matched ? (matched.buyPrice || matched.purchasePrice || 0) : 0,
      };
    });

    const newReceipt: any = {
      id: `inb-voice-${Date.now()}`,
      receiptNumber: receiptCode,
      purchaseInvoiceId: '',
      purchaseInvoiceNumber: `صوتی-تلگرام`,
      supplierName: aiResult.supplierName || (sender.first_name ? `${sender.first_name} (تلگرام)` : 'ورودی صوتی تلگرام'),
      date: nowJalali,
      status: 'pending_verification',
      items: inboundItems,
      totalExpectedQuantity: inboundItems.reduce((sum, i) => sum + i.expectedQuantity, 0),
      totalReceivedQuantity: inboundItems.reduce((sum, i) => sum + i.receivedQuantity, 0),
      totalDiscrepancy: 0,
      source: 'telegram_voice',
      voiceTranscription: aiResult.transcript,
      voiceSender: {
        userId: sender.id,
        username: sender.username,
        firstName: sender.first_name,
        chatId: chatId,
      },
      notes: `ثبت خودکار از پیام صوتی تلگرام. متن صوت: «${aiResult.transcript}»`,
      warehouseNotes: 'در انتظار تایید فیزیکی و شمارش نهایی مدیر',
      createdAt: nowJalali,
    };

    // Save into database atomically
    await enqueueDbWrite(async () => {
      const { data: currentDb } = await getLatestConvergedDatabase();
      const currentReceipts = Array.isArray(currentDb.inboundReceipts) ? [...currentDb.inboundReceipts] : [];
      currentReceipts.unshift(newReceipt);
      currentDb.inboundReceipts = currentReceipts;
      await writeDatabase(currentDb);
      if (getPostgresStatus().connected) {
        await saveStateToPostgres(currentDb);
      }
    });

    // 5. Send success confirmation message back to Telegram
    const itemsSummary = inboundItems
      .map((it, idx) => `  ${idx + 1}. <b>${escapeTelegramHtml(it.productName)}</b>: ${it.expectedQuantity} ${escapeTelegramHtml(it.unit)}`)
      .join('\n');

    const replyText = [
      `✅ <b>رسید ورود کالا با موفقیت ثبت شد (شماره: ${escapeTelegramHtml(receiptCode)})</b>`,
      '',
      `🎙️ <b>متن پیاده‌سازی شده صوت:</b>`,
      `<i>«${escapeTelegramHtml(aiResult.transcript)}»</i>`,
      '',
      `📦 <b>اقلام استخراج‌شده:</b>`,
      itemsSummary,
      '',
      `⏳ <b>وضعیت:</b> در انتظار بررسی و تایید نهایی مدیر در پنل کارگاه`,
      `🏢 جهت نهایی‌سازی و افزایش موجودی انبار، مدیر می‌تواند این حواله را در بخش «انبارداری > حواله‌های ورود» تایید فرماید.`,
    ].join('\n');

    await callTelegramApi('sendMessage', {
      token: botToken,
      body: {
        chat_id: chatId,
        reply_to_message_id: message.message_id,
        text: replyText,
        parse_mode: 'HTML',
      },
    });

  } catch (webhookErr: any) {
    console.error('[Telegram Webhook Voice Processing] Error:', webhookErr);
  }
});

// 12.4.4 Set Webhook or Polling helper endpoint
app.post('/api/telegram/set-webhook', requireAdmin, async (req, res) => {
  try {
    const { data: dbData } = await getLatestConvergedDatabase();
    const settings = dbData?.settings || {};
    const botToken = sanitizeTelegramBotToken(req.body?.botToken || settings?.telegramBotToken || process.env.TELEGRAM_BOT_TOKEN);
    const webhookUrl = (req.body?.webhookUrl || '').trim();

    if (!botToken) {
      return res.status(400).json({ success: false, error: 'توکن ربات تلگرام مشخص نیست.' });
    }
    if (!webhookUrl) {
      return res.status(400).json({ success: false, error: 'آدرس وبهوک (URL) وارد نشده است.' });
    }

    const { data } = await callTelegramApi('setWebhook', {
      token: botToken,
      body: {
        url: webhookUrl,
        allowed_updates: ['message', 'edited_message'],
        drop_pending_updates: true,
      },
    });

    return res.json(data);
  } catch (err: any) {
    console.error('[Telegram Set Webhook] Error:', err);
    return res.status(500).json({ success: false, error: err?.message || 'خطا در ثبت وبهوک تلگرام' });
  }
});

// 12.4.5 Get Webhook Info
app.get('/api/telegram/webhook-info', requireAdmin, async (req, res) => {
  try {
    const { data: dbData } = await getLatestConvergedDatabase();
    const settings = dbData?.settings || {};
    const botToken = sanitizeTelegramBotToken((req.query?.botToken as string) || settings?.telegramBotToken || process.env.TELEGRAM_BOT_TOKEN);

    if (!botToken) {
      return res.status(400).json({ success: false, error: 'توکن ربات تلگرام مشخص نیست.' });
    }

    const { data } = await callTelegramApi('getWebhookInfo', {
      token: botToken,
    });
    return res.json(data);
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message });
  }
});

// -------------------------------------------------------------
// SECURE PUBLIC WEB INVOICE API ENDPOINTS (FOR CUSTOMERS)
// -------------------------------------------------------------

function generateShareToken(): string {
  return `inv_${crypto.randomBytes(10).toString('hex')}`;
}

// 13.1 Public endpoint to fetch customer invoice via secure token (Zero login required for customers)
app.get('/api/public/invoice/:token', async (req, res) => {
  try {
    setNoCacheHeaders(res);
    const token = (req.params.token || '').trim();
    if (!token) {
      return res.status(400).json({ success: false, code: 'INVALID_TOKEN', message: 'شناسه لینک فاکتور مشخص نشده است.' });
    }

    const { data: dbData } = await getLatestConvergedDatabase();
    const invoices = Array.isArray(dbData?.invoices) ? dbData.invoices : [];
    const customers = Array.isArray(dbData?.customers) ? dbData.customers : [];
    const invoiceIndex = invoices.findIndex((inv: any) => inv?.shareLink?.token === token);
    const customerIndex = invoiceIndex === -1 ? customers.findIndex((c: any) => c?.shareLink?.token === token) : -1;

    if (invoiceIndex === -1 && customerIndex === -1) {
      return res.status(404).json({
        success: false,
        code: 'NOT_FOUND',
        message: 'فاکتور یا صورتحساب مورد نظر یافت نشد یا دسترسی به این پیوند توسط فروشگاه باطل گردیده است.',
      });
    }

    const matchedCustomer = customerIndex !== -1 ? customers[customerIndex] : null;
    const invoice = invoiceIndex !== -1
      ? invoices[invoiceIndex]
      : {
          id: `cust-portal-${matchedCustomer.id}`,
          invoiceNumber: 'صورتحساب',
          type: 'standard',
          customerId: matchedCustomer.id,
          customerName: matchedCustomer.name,
          customerPhone: matchedCustomer.phone || '',
          customerAddress: matchedCustomer.address || '',
          customerNationalId: matchedCustomer.nationalId || '',
          date: matchedCustomer.createdAt || '',
          items: [],
          subtotal: 0,
          totalDiscount: 0,
          taxRate: 0,
          taxAmount: 0,
          finalTotal: 0,
          paidAmount: 0,
          paymentStatus: 'paid',
          paymentMethod: 'cash',
          notes: matchedCustomer.notes || '',
          createdAt: matchedCustomer.createdAt || new Date().toISOString(),
          shareLink: matchedCustomer.shareLink,
        };
    const shareLink = invoice.shareLink;

    // Check if link is enabled
    if (!shareLink || shareLink.enabled === false) {
      return res.status(403).json({
        success: false,
        code: 'LINK_DISABLED',
        message: 'مشاهده آنلاین این فاکتور در حال حاضر توسط مدیریت فروشگاه غیرفعال شده است.',
      });
    }

    // Check expiration
    if (shareLink.expiresAt) {
      const expTime = new Date(shareLink.expiresAt).getTime();
      if (!isNaN(expTime) && expTime < Date.now()) {
        return res.status(410).json({
          success: false,
          code: 'LINK_EXPIRED',
          message: 'مهلت زمانی مشاهده این فاکتور به پایان رسیده است. جهت دریافت مجدد با فروشگاه تماس بگیرید.',
        });
      }
    }

    // Check one-time link usage (if one-time and already viewed at least once)
    const currentViewCount = Number(shareLink.viewCount) || 0;
    if (shareLink.isOneTime && currentViewCount >= 1) {
      return res.status(410).json({
        success: false,
        code: 'ONE_TIME_EXHAUSTED',
        message: 'این فاکتور دارای پیوند یکبارمصرف امن بوده و پیش‌تر مشاهده شده است.',
      });
    }

    // Check max views
    if (shareLink.maxViews && shareLink.maxViews > 0 && currentViewCount >= shareLink.maxViews) {
      return res.status(410).json({
        success: false,
        code: 'MAX_VIEWS_EXCEEDED',
        message: 'سقف تعداد دفعات مجاز برای مشاهده این لینک تکمیل شده است.',
      });
    }

    const storeSettings = dbData?.settings || {};

    // Check PIN protection
    if (shareLink.pinRequired && shareLink.pinCode && shareLink.pinCode.trim().length > 0) {
      const clientPin = (req.query.pin || req.headers['x-invoice-pin'] || '').toString().trim();
      const requiredPin = shareLink.pinCode.trim();

      if (!clientPin || clientPin !== requiredPin) {
        return res.json({
          success: false,
          code: 'PIN_REQUIRED',
          pinRequired: true,
          message: 'مشاهده این فاکتور مستلزم ورود رمز عبور (پین‌کد) می‌باشد.',
          storeName: storeSettings.storeName || 'سامانه حسابداری سپهر',
          storeLogo: storeSettings.logo || storeSettings.storeLogo || '',
          invoiceNumber: invoice.invoiceNumber,
          customerName: invoice.customerName,
        });
      }
    }

    // Update view statistics in background
    const newViewCount = currentViewCount + 1;
    const nowIso = new Date().toISOString();
    invoice.shareLink = {
      ...shareLink,
      viewCount: newViewCount,
      lastViewedAt: nowIso,
      // If one-time, disable for subsequent loads
      enabled: shareLink.isOneTime ? false : shareLink.enabled,
    };

    if (invoiceIndex !== -1) {
      invoices[invoiceIndex] = invoice;
    } else if (customerIndex !== -1) {
      customers[customerIndex].shareLink = invoice.shareLink;
    }

    // Asynchronous non-blocking write to avoid delaying response
    enqueueDbWrite(async () => {
      const current = readDatabase();
      if (invoiceIndex !== -1 && Array.isArray(current.invoices)) {
        const idx = current.invoices.findIndex((i: any) => i.id === invoice.id);
        if (idx !== -1) {
          current.invoices[idx] = invoice;
          writeDatabase(current, false);
          if (getPostgresStatus().connected) {
            saveStateToPostgres(current).catch(() => {});
          }
        }
      } else if (customerIndex !== -1 && Array.isArray(current.customers)) {
        const cIdx = current.customers.findIndex((c: any) => c.id === matchedCustomer.id);
        if (cIdx !== -1) {
          current.customers[cIdx].shareLink = invoice.shareLink;
          writeDatabase(current, false);
          if (getPostgresStatus().connected) {
            saveStateToPostgres(current).catch(() => {});
          }
        }
      }
    }).catch(() => {});

    // Sanitize invoice: remove buyPrice, profit margins or internal notes
    const sanitizedItems = (invoice.items || []).map((item: any) => ({
      id: item.id,
      productId: item.productId,
      productName: item.productName || item.name || '',
      productCode: item.productCode || item.code || '',
      barcode: item.barcode || '',
      unit: item.unit || 'عدد',
      quantity: Number(item.quantity) || 0,
      unitPrice: Number(item.unitPrice || item.price) || 0,
      discount: Number(item.discount) || 0,
      total: Number(item.total) || 0,
      variantName: item.variantName || '',
    }));

    const sanitizedInvoice = {
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      type: invoice.type || 'standard',
      customerId: invoice.customerId,
      customerName: invoice.customerName,
      customerPhone: invoice.customerPhone || '',
      customerAddress: invoice.customerAddress || '',
      customerNationalId: invoice.customerNationalId || '',
      date: invoice.date,
      dueDate: invoice.dueDate || '',
      items: sanitizedItems,
      subtotal: Number(invoice.subtotal) || 0,
      totalDiscount: Number(invoice.totalDiscount) || 0,
      taxRate: Number(invoice.taxRate) || 0,
      taxAmount: Number(invoice.taxAmount) || 0,
      finalTotal: Number(invoice.finalTotal) || 0,
      paymentStatus: invoice.paymentStatus || 'unpaid',
      paymentMethod: invoice.paymentMethod || 'cash',
      paidAmount: Number(invoice.paidAmount) || 0,
      chequeNumber: invoice.chequeNumber || '',
      chequeDueDate: invoice.chequeDueDate || '',
      chequeName: invoice.chequeName || '',
      transferDescription: invoice.transferDescription || '',
      notes: invoice.notes || '',
      isProforma: !!invoice.isProforma,
      convertedAt: invoice.convertedAt || '',
      convertedFromProforma: invoice.convertedFromProforma || '',
      createdAt: invoice.createdAt,
    };

    // Gather complete customer portfolio: All Invoices, All Deposits, All Remittances & Ledger
    const customerId = invoice.customerId;
    const customerNameNorm = (invoice.customerName || '').trim().toLowerCase();
    const customerPhoneNorm = (invoice.customerPhone || '').replace(/[^0-9]/g, '');

    const isMatchCustomer = (cId?: string, cName?: string, cPhone?: string) => {
      if (customerId && cId && cId === customerId) return true;
      if (customerNameNorm && cName && cName.trim().toLowerCase() === customerNameNorm) return true;
      if (customerPhoneNorm && cPhone) {
        const pClean = cPhone.replace(/[^0-9]/g, '');
        if (pClean && pClean === customerPhoneNorm) return true;
      }
      return false;
    };

    // 1. All Invoices for this customer (fully sanitized for privacy and customer viewing)
    const customerInvoices = invoices
      .filter((inv: any) => isMatchCustomer(inv.customerId, inv.customerName, inv.customerPhone))
      .map((inv: any) => ({
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        type: inv.type || 'standard',
        customerId: inv.customerId,
        customerName: inv.customerName,
        customerPhone: inv.customerPhone || '',
        customerAddress: inv.customerAddress || '',
        customerNationalId: inv.customerNationalId || '',
        date: inv.date,
        dueDate: inv.dueDate || '',
        items: (inv.items || []).map((item: any) => ({
          id: item.id,
          productId: item.productId,
          productName: item.productName || item.name || '',
          productCode: item.productCode || item.code || '',
          barcode: item.barcode || '',
          unit: item.unit || 'عدد',
          quantity: Number(item.quantity) || 0,
          unitPrice: Number(item.unitPrice || item.price) || 0,
          discount: Number(item.discount) || 0,
          total: Number(item.total) || 0,
          variantName: item.variantName || '',
        })),
        subtotal: Number(inv.subtotal) || 0,
        totalDiscount: Number(inv.totalDiscount) || 0,
        taxRate: Number(inv.taxRate) || 0,
        taxAmount: Number(inv.taxAmount) || 0,
        finalTotal: Number(inv.finalTotal) || 0,
        paidAmount: Number(inv.paidAmount) || 0,
        paymentStatus: inv.paymentStatus || 'unpaid',
        paymentMethod: inv.paymentMethod || 'cash',
        chequeNumber: inv.chequeNumber || '',
        chequeDueDate: inv.chequeDueDate || '',
        chequeName: inv.chequeName || '',
        transferDescription: inv.transferDescription || '',
        notes: inv.notes || '',
        isProforma: !!inv.isProforma,
        convertedAt: inv.convertedAt || '',
        convertedFromProforma: inv.convertedFromProforma || '',
        createdAt: inv.createdAt,
        exitSlip: inv.exitSlip || undefined,
        token: inv.shareLink?.token || (inv.id === invoice.id ? shareLink.token : undefined),
      }))
      .sort((a: any, b: any) => (b.date || '').localeCompare(a.date || ''));

    // 2. All Customer Deposits & Payments
    const allCustomerTxns = Array.isArray(dbData?.customerTransactions) ? dbData.customerTransactions : [];
    const directDeposits = allCustomerTxns
      .filter((tx: any) => isMatchCustomer(tx.customerId, tx.customerName))
      .map((tx: any) => ({
        id: tx.id,
        type: tx.type || 'deposit',
        amount: Number(tx.amount) || 0,
        date: tx.date,
        title: tx.title || (tx.type === 'deposit' ? 'واریز وجه به حساب' : 'ثبت بدهی دستی'),
        paymentMethod: tx.paymentMethod || 'transfer',
        trackingNumber: tx.trackingNumber || '',
        bankName: tx.bankName || '',
        chequeDueDate: tx.chequeDueDate || '',
        invoiceNumber: tx.invoiceNumber || '',
        notes: tx.notes || '',
      }));

    // Invoices with direct payment at issuance
    const invoicePayments = invoices
      .filter((inv: any) => isMatchCustomer(inv.customerId, inv.customerName, inv.customerPhone) && Number(inv.paidAmount) > 0)
      .map((inv: any) => ({
        id: `inv-pay-${inv.id}`,
        type: 'deposit' as const,
        amount: Number(inv.paidAmount) || 0,
        date: inv.date,
        title: `پرداخت وجه فاکتور ${inv.invoiceNumber}`,
        paymentMethod: inv.paymentMethod || 'cash',
        trackingNumber: inv.chequeNumber || '',
        bankName: inv.transferDescription ? 'حساب بانکی' : '',
        chequeDueDate: inv.chequeDueDate || '',
        invoiceNumber: inv.invoiceNumber,
        notes: inv.transferDescription || inv.notes || '',
      }));

    // Combine and deduplicate / sort payments
    const allDeposits = [...directDeposits, ...invoicePayments].sort((a: any, b: any) => (b.date || '').localeCompare(a.date || ''));

    // 3. Remittances & Delivery Slips (حواله‌های خروج و بارگیری)
    // a) From customer invoices' exit slips
    const exitSlipRemittances = invoices
      .filter((inv: any) => isMatchCustomer(inv.customerId, inv.customerName, inv.customerPhone) && inv.exitSlip && (inv.exitSlip.slipNumber || inv.exitSlip.isDelivered || inv.exitSlip.deliveredAt || inv.exitSlip.receiverName))
      .map((inv: any) => {
        const es = inv.exitSlip;
        return {
          id: `es-${inv.id}`,
          remittanceNumber: es.slipNumber || `حواله-${inv.invoiceNumber}`,
          sourceType: 'invoice_exit_slip' as const,
          invoiceNumber: inv.invoiceNumber,
          invoiceId: inv.id,
          date: es.deliveredAt || inv.date,
          receiverName: es.receiverName || inv.customerName,
          receiverPhone: es.receiverPhone || inv.customerPhone || '',
          vehicleInfo: es.vehicleInfo || '',
          deliveredBy: es.deliveredBy || '',
          deliveryNotes: es.deliveryNotes || '',
          status: es.isDelivered ? ('delivered' as const) : ('dispatched' as const),
          statusTitle: es.isDelivered ? 'تحویل داده شده به مشتری' : 'صادر شده / در حال ارسال',
          items: (inv.items || []).map((it: any) => ({
            productName: it.productName || it.name || '',
            quantity: Number(it.quantity) || 0,
            unit: it.unit || 'عدد',
          })),
        };
      });

    // b) From direct transfers if receiver matches customer
    const allDirectTransfers = Array.isArray(dbData?.directTransfers) ? dbData.directTransfers : [];
    const directTransferRemittances = allDirectTransfers
      .filter((trf: any) => isMatchCustomer(undefined, trf.receiverName, trf.receiverPhone))
      .map((trf: any) => ({
        id: `trf-${trf.id}`,
        remittanceNumber: trf.transferNumber || trf.id,
        sourceType: 'direct_transfer' as const,
        invoiceNumber: '',
        invoiceId: '',
        date: trf.dispatchedAt || trf.createdAt,
        receiverName: trf.receiverName,
        receiverPhone: trf.receiverPhone || '',
        vehicleInfo: trf.dispatchVehicleInfo || '',
        deliveredBy: trf.dispatchedBy || '',
        deliveryNotes: trf.dispatchNotes || trf.title || '',
        status: trf.status === 'returned' ? ('returned' as const) : ('dispatched' as const),
        statusTitle: trf.status === 'returned' ? 'عودت داده شده' : 'ارسال شده به مشتری/پروژه',
        items: (trf.items || []).map((it: any) => ({
          productName: it.productName || '',
          quantity: Number(it.quantity) || 0,
          unit: it.unit || 'عدد',
        })),
      }));

    const allRemittances = [...exitSlipRemittances, ...directTransferRemittances].sort((a: any, b: any) =>
      (b.date || '').localeCompare(a.date || '')
    );

    // 4. Customer Financial Ledger Summary & Complete Chronological Statement Entries
    const paymentMethodLabels: Record<string, string> = {
      cash: 'نقدی',
      transfer: 'واریز به حساب / کارت به کارت',
      pos: 'کارتخوان (POS)',
      cheque: 'چک بانکی',
      card: 'کارت به کارت',
      credit: 'نسیه / اعتباری',
      other: 'سایر',
    };

    const nonProformas = customerInvoices.filter((inv: any) => !inv.isProforma);
    let unpaidInvoicesCount = 0;
    const rawLedgerEntries: any[] = [];

    nonProformas.forEach((inv: any) => {
      const rem = Math.max(0, (Number(inv.finalTotal) || 0) - (Number(inv.paidAmount) || 0));
      if (rem > 0) unpaidInvoicesCount++;

      const itemsList = Array.isArray(inv.items) ? inv.items : [];
      const isItemSrv = (it: any) =>
        Boolean(
          it.isService ||
          it.itemType === 'service' ||
          String(it.id || '').startsWith('service-') ||
          String(it.productCode || it.code || '').toUpperCase().startsWith('SRV-') ||
          !it.productId
        );
      const srvItems = itemsList.filter(isItemSrv);
      const prodItems = itemsList.filter((it: any) => !isItemSrv(it));
      const hasServices = srvItems.length > 0;
      const isOnlyServices = hasServices && prodItems.length === 0;
      const itemsSummary = itemsList
        .map((it: any) => `${it.productName || it.name || ''} (${it.quantity || 1} ${it.unit || 'عدد'})`)
        .filter(Boolean)
        .join(' ، ');

      let docLabel = inv.type === 'official' ? 'فاکتور رسمی فروش' : 'فاکتور فروش';
      let invDesc = `خرید کالا طبق فاکتور شماره ${inv.invoiceNumber} (${itemsList.length} ردیف)${itemsSummary ? `: ${itemsSummary}` : ''}${inv.notes ? ` - ${inv.notes}` : ''}`;

      if (isOnlyServices) {
        docLabel = inv.type === 'official' ? 'فاکتور رسمی خدماتی' : 'فاکتور خدماتی';
        invDesc = `فاکتور خدماتی شماره ${inv.invoiceNumber} (${srvItems.length} مورد خدمات)${itemsSummary ? `: ${itemsSummary}` : ''}${inv.notes ? ` - ${inv.notes}` : ''}`;
      } else if (hasServices) {
        docLabel = inv.type === 'official' ? 'فاکتور رسمی فروش و خدمات' : 'فاکتور فروش و خدمات';
        invDesc = `فاکتور فروش و خدمات شماره ${inv.invoiceNumber} (${prodItems.length} قلم کالا و ${srvItems.length} خدمت)${itemsSummary ? `: ${itemsSummary}` : ''}${inv.notes ? ` - ${inv.notes}` : ''}`;
      }

      rawLedgerEntries.push({
        id: `inv-deb-${inv.id}`,
        date: inv.date || '',
        documentNumber: String(inv.invoiceNumber || ''),
        documentType: 'invoice',
        documentTypeLabel: docLabel,
        description: invDesc,
        debit: Number(inv.finalTotal) || 0,
        credit: 0,
        paymentMethod: inv.paymentMethod ? paymentMethodLabels[inv.paymentMethod] || inv.paymentMethod : undefined,
        paymentMethodKey: inv.paymentMethod || undefined,
        notes: inv.notes || '',
        invoiceId: inv.id,
        itemsSummary,
        hasService: hasServices,
        isOnlyService: isOnlyServices,
      });

      if (Number(inv.paidAmount) > 0) {
        const payMethodTxt = inv.paymentMethod ? paymentMethodLabels[inv.paymentMethod] || inv.paymentMethod : 'نقدی';
        rawLedgerEntries.push({
          id: `inv-pay-${inv.id}`,
          date: inv.date || '',
          documentNumber: String(inv.invoiceNumber || ''),
          documentType: 'invoice_payment',
          documentTypeLabel: 'واریز همزمان با فاکتور',
          description: `پرداخت وجه همزمان با صدور فاکتور شماره ${inv.invoiceNumber} [${payMethodTxt}]${inv.transferDescription ? ` (${inv.transferDescription})` : ''}`,
          debit: 0,
          credit: Number(inv.paidAmount) || 0,
          paymentMethod: payMethodTxt,
          paymentMethodKey: inv.paymentMethod || 'cash',
          trackingNumber: inv.chequeNumber || '',
          chequeDueDate: inv.chequeDueDate || '',
          bankName: inv.chequeName || '',
          notes: inv.transferDescription || inv.notes || '',
          invoiceId: inv.id,
        });
      }
    });

    // Standalone customer transactions (deposits & debts)
    directDeposits.forEach((tx: any) => {
      const payMethodTxt = tx.paymentMethod ? paymentMethodLabels[tx.paymentMethod] || tx.paymentMethod : 'واریز به حساب';
      if (tx.type === 'deposit') {
        rawLedgerEntries.push({
          id: `txn-${tx.id}`,
          date: tx.date || '',
          documentNumber: String(tx.trackingNumber || String(tx.id || '').substring(0, 8)),
          documentType: 'deposit',
          documentTypeLabel: 'واریز',
          description: `${tx.title || 'واریز وجه مشتری'}${tx.bankName ? ` - بانک ${tx.bankName}` : ''}${tx.invoiceNumber ? ` (بابت فاکتور ${tx.invoiceNumber})` : ''}${tx.notes ? ` - ${tx.notes}` : ''}`,
          debit: 0,
          credit: Number(tx.amount) || 0,
          paymentMethod: payMethodTxt,
          paymentMethodKey: tx.paymentMethod || 'transfer',
          trackingNumber: tx.trackingNumber || '',
          bankName: tx.bankName || '',
          chequeDueDate: tx.chequeDueDate || '',
          notes: tx.notes || '',
        });
      } else {
        rawLedgerEntries.push({
          id: `txn-${tx.id}`,
          date: tx.date || '',
          documentNumber: String(tx.trackingNumber || String(tx.id || '').substring(0, 8)),
          documentType: 'debt',
          documentTypeLabel: 'ثبت بدهی دستی / مانده',
          description: `${tx.title || 'سند افزایش بدهی'}${tx.notes ? ` - ${tx.notes}` : ''}`,
          debit: Number(tx.amount) || 0,
          credit: 0,
          trackingNumber: tx.trackingNumber || '',
          notes: tx.notes || '',
        });
      }
    });

    // Purchase invoices where this customer/party is also a supplier
    const allPurchases = Array.isArray(dbData?.purchaseInvoices) ? dbData.purchaseInvoices : [];
    const customerPurchases = allPurchases.filter((pur: any) =>
      isMatchCustomer(undefined, pur.supplierName, pur.supplierPhone)
    );
    customerPurchases.forEach((pur: any) => {
      const remPur = Math.max(0, (Number(pur.finalTotal) || 0) - (Number(pur.paidAmount) || 0));
      if (remPur > 0) unpaidInvoicesCount++;
      const purItems = Array.isArray(pur.items) ? pur.items : [];
      const itemsSummary = purItems
        .map((it: any) => `${it.productName || ''} (${it.quantity || 1} ${it.unit || 'عدد'})`)
        .filter(Boolean)
        .join(' ، ');

      rawLedgerEntries.push({
        id: `pur-cred-${pur.id}`,
        date: pur.date || '',
        documentNumber: String(pur.invoiceNumber || ''),
        documentType: 'purchase_invoice',
        documentTypeLabel: pur.isServiceOnly ? 'فاکتور خرید خدمات' : 'فاکتور خرید کالا',
        description: `خرید از طرف‌حساب طبق فاکتور شماره ${pur.invoiceNumber} (${purItems.length} ردیف)${itemsSummary ? `: ${itemsSummary}` : ''}${pur.notes ? ` - ${pur.notes}` : ''}`,
        debit: 0,
        credit: Number(pur.finalTotal) || 0,
        paymentMethod: pur.paymentMethod ? paymentMethodLabels[pur.paymentMethod] || pur.paymentMethod : undefined,
        paymentMethodKey: pur.paymentMethod || undefined,
        notes: pur.notes || '',
        itemsSummary,
      });

      if (Number(pur.paidAmount) > 0) {
        const payMethodTxt = pur.paymentMethod ? paymentMethodLabels[pur.paymentMethod] || pur.paymentMethod : 'نقدی';
        rawLedgerEntries.push({
          id: `pur-pay-${pur.id}`,
          date: pur.date || '',
          documentNumber: String(pur.invoiceNumber || ''),
          documentType: 'purchase_payment',
          documentTypeLabel: 'پرداخت وجه خرید',
          description: `پرداخت وجه بابت فاکتور خرید شماره ${pur.invoiceNumber} [${payMethodTxt}]${pur.transferDescription ? ` (${pur.transferDescription})` : ''}`,
          debit: Number(pur.paidAmount) || 0,
          credit: 0,
          paymentMethod: payMethodTxt,
          paymentMethodKey: pur.paymentMethod || undefined,
          trackingNumber: pur.chequeNumber || '',
          notes: pur.transferDescription || pur.notes || '',
        });
      }
    });

    // Chronological sort (oldest to newest for running balance)
    rawLedgerEntries.sort((a, b) => {
      const cmp = String(a.date || '').localeCompare(String(b.date || ''));
      if (cmp !== 0) return cmp;
      const isBaseA = a.documentType === 'invoice' || a.documentType === 'purchase_invoice';
      const isBaseB = b.documentType === 'invoice' || b.documentType === 'purchase_invoice';
      if (isBaseA && !isBaseB) return -1;
      if (!isBaseA && isBaseB) return 1;
      if (a.debit > 0 && b.credit > 0) return -1;
      if (a.credit > 0 && b.debit > 0) return 1;
      return 0;
    });

    let runningBalance = 0;
    let totalDebit = 0;
    let totalCredit = 0;

    const ledgerEntries = rawLedgerEntries.map((entry) => {
      totalDebit += entry.debit;
      totalCredit += entry.credit;
      runningBalance += entry.debit - entry.credit;
      const balanceStatus = runningBalance > 0 ? 'debtor' : runningBalance < 0 ? 'creditor' : 'settled';
      return {
        ...entry,
        balance: runningBalance,
        balanceStatus,
      };
    });

    const totalPurchases = nonProformas.reduce((sum: number, inv: any) => sum + (inv.finalTotal || 0), 0);
    const netBalance = totalDebit - totalCredit;

    const customerLedger = {
      customerName: invoice.customerName,
      customerPhone: invoice.customerPhone || '',
      customerAddress: invoice.customerAddress || '',
      customerNationalId: invoice.customerNationalId || '',
      totalInvoicesCount: customerInvoices.length,
      unpaidInvoicesCount,
      totalPurchases,
      totalDebit,
      totalPaid: totalCredit,
      totalCredit,
      balance: netBalance,
      balanceStatus: netBalance > 0 ? 'debtor' : netBalance < 0 ? 'creditor' : 'settled',
      entries: shareLink.includeCustomerStatement !== false ? ledgerEntries : [],
    };

    const publicSettings = {
      storeName: storeSettings.storeName || 'بازرگانی سپهر',
      tagline: storeSettings.tagline || storeSettings.storeTagline || '',
      logo: storeSettings.logo || storeSettings.storeLogo || '',
      sellerName: storeSettings.sellerName || '',
      phone: storeSettings.phone || storeSettings.storePhone || '',
      mobile: storeSettings.mobile || '',
      address: storeSettings.address || storeSettings.storeAddress || '',
      postalCode: storeSettings.postalCode || storeSettings.storePostalCode || '',
      economicCode: storeSettings.economicCode || '',
      nationalCode: storeSettings.nationalCode || storeSettings.storeNationalId || '',
      currency: storeSettings.currency || 'تومان',
      invoiceFooterText: storeSettings.invoiceFooterText || storeSettings.invoiceFooterNote || '',
      taxEnabled: !!storeSettings.taxEnabled || !!storeSettings.enableTax,
      taxPercent: Number(storeSettings.taxPercent) || 0,
    };

    const publicShareMeta = {
      token: shareLink.token,
      allowPdfDownload: shareLink.allowPdfDownload !== false,
      includeCustomerStatement: shareLink.includeCustomerStatement !== false,
      isOneTime: !!shareLink.isOneTime,
      expiresAt: shareLink.expiresAt || null,
      viewCount: newViewCount,
    };

    return res.json({
      success: true,
      invoice: sanitizedInvoice,
      settings: publicSettings,
      shareLink: publicShareMeta,
      customerInvoices,
      deposits: allDeposits,
      remittances: allRemittances,
      customerLedger,
    });
  } catch (err: any) {
    console.error('[Public Invoice API] error:', err);
    return res.status(500).json({
      success: false,
      code: 'SERVER_ERROR',
      message: 'خطای سیستمی در بارگذاری فاکتور آنلاین.',
    });
  }
});

// 13.2 Generate or Update Share Link for an Invoice (Store manager / cashier action)
app.post('/api/invoices/:id/share-link', async (req, res) => {
  try {
    const authUser = (req as AuthenticatedRequest).authUser;
    if (
      !isAdminUser(authUser) &&
      !authUser?.permissions?.canCreateInvoice &&
      !authUser?.permissions?.canViewInvoices &&
      !authUser?.permissions?.canManageCustomers
    ) {
      return res.status(403).json({
        success: false,
        message: 'شما مجوز صدور یا مدیریت پیوند تحت وب را ندارید.',
      });
    }
    const invoiceId = req.params.id;
    const {
      enabled = true,
      expiresAt = null,
      isOneTime = false,
      maxViews,
      pinRequired = false,
      pinCode = '',
      allowPdfDownload = true,
      includeCustomerStatement = true,
      regenerateToken = false,
    } = req.body || {};

    const { data: dbData } = await getLatestConvergedDatabase();
    const invoices = Array.isArray(dbData?.invoices) ? dbData.invoices : [];
    const customers = Array.isArray(dbData?.customers) ? dbData.customers : [];
    const isCustomerPortalId = invoiceId.startsWith('cust-portal-');
    const rawCustomerId = isCustomerPortalId ? invoiceId.replace('cust-portal-', '') : invoiceId;

    const invoiceIndex = invoices.findIndex((inv: any) => inv?.id === invoiceId);
    const customerIndex = invoiceIndex === -1 ? customers.findIndex((c: any) => c?.id === rawCustomerId) : -1;

    if (invoiceIndex === -1 && customerIndex === -1) {
      return res.status(404).json({ success: false, message: 'فاکتور یا مشتری مورد نظر یافت نشد.' });
    }

    const existingShareLink = invoiceIndex !== -1
      ? invoices[invoiceIndex].shareLink
      : customers[customerIndex].shareLink;

    let token = existingShareLink?.token;
    if (!token || regenerateToken) {
      token = generateShareToken();
    }

    const updatedShareLink = {
      token,
      enabled: enabled !== false,
      createdAt: existingShareLink?.createdAt || new Date().toISOString(),
      expiresAt: expiresAt || null,
      isOneTime: !!isOneTime,
      maxViews: isOneTime ? 1 : (maxViews ? Number(maxViews) : undefined),
      viewCount: regenerateToken ? 0 : (Number(existingShareLink?.viewCount) || 0),
      lastViewedAt: regenerateToken ? undefined : existingShareLink?.lastViewedAt,
      pinRequired: !!pinRequired,
      pinCode: pinCode ? String(pinCode).trim() : undefined,
      allowPdfDownload: allowPdfDownload !== false,
      includeCustomerStatement: includeCustomerStatement !== false,
    };

    if (invoiceIndex !== -1) {
      const currentInvoice = invoices[invoiceIndex];
      currentInvoice.shareLink = updatedShareLink;
      invoices[invoiceIndex] = currentInvoice;
    } else if (customerIndex !== -1) {
      customers[customerIndex].shareLink = updatedShareLink;
    }

    await enqueueDbWrite(async () => {
      const current = readDatabase();
      const authUser = (req as AuthenticatedRequest).authUser;
      const actor = (current?.users || []).find((u: any) => u.id === authUser?.userId);
      const targetLabel =
        invoiceIndex !== -1
          ? `فاکتور #${invoices[invoiceIndex]?.invoiceNumber || invoiceId}`
          : `پورتال مشتری «${customers[customerIndex]?.name || rawCustomerId}»`;

      if (invoiceIndex !== -1 && Array.isArray(current.invoices)) {
        const idx = current.invoices.findIndex((i: any) => i.id === invoiceId);
        if (idx !== -1) {
          current.invoices[idx].shareLink = updatedShareLink;
          appendLogToDbObject(current, req, {
            userId: authUser?.userId || 'sys',
            userName: actor?.fullName || authUser?.username || 'کاربر',
            userRole: actor?.role || authUser?.role || 'cashier',
            userRoleTitle: actor?.roleTitle,
            category: 'sales',
            actionType: updatedShareLink.enabled ? 'share_link_update' : 'share_link_revoke',
            actionTitle: updatedShareLink.enabled ? 'صدور یا تنظیم لینک اشتراک تحت وب' : 'غیرفعال‌سازی لینک اشتراک فاکتور',
            details: `${updatedShareLink.enabled ? 'تنظیم لینک تحت وب برای' : 'ابطال لینک تحت وب'} ${targetLabel}`,
            severity: 'warning',
            entityType: 'invoice',
            entityId: invoiceId,
            entityLabel: targetLabel,
          });
          writeDatabase(current, false);
          if (getPostgresStatus().connected) {
            saveStateToPostgres(current).catch(() => {});
          }
        }
      } else if (customerIndex !== -1 && Array.isArray(current.customers)) {
        const cIdx = current.customers.findIndex((c: any) => c.id === rawCustomerId);
        if (cIdx !== -1) {
          current.customers[cIdx].shareLink = updatedShareLink;
          appendLogToDbObject(current, req, {
            userId: authUser?.userId || 'sys',
            userName: actor?.fullName || authUser?.username || 'کاربر',
            userRole: actor?.role || authUser?.role || 'cashier',
            userRoleTitle: actor?.roleTitle,
            category: 'customer',
            actionType: updatedShareLink.enabled ? 'share_link_update' : 'share_link_revoke',
            actionTitle: updatedShareLink.enabled ? 'صدور لینک پورتال حساب مشتری' : 'لغو لینک پورتال حساب مشتری',
            details: `${updatedShareLink.enabled ? 'تنظیم لینک اشتراک برای' : 'لغو لینک اشتراک'} ${targetLabel}`,
            severity: 'warning',
            entityType: 'customer',
            entityId: rawCustomerId,
            entityLabel: targetLabel,
          });
          writeDatabase(current, false);
          if (getPostgresStatus().connected) {
            saveStateToPostgres(current).catch(() => {});
          }
        }
      }
    });

    const host = req.get('host') || 'localhost:3000';
    const protocol = req.protocol || 'http';
    const fullUrl = `${protocol}://${host}/v/${token}`;

    return res.json({
      success: true,
      message: 'پیوند نسخه تحت وب فاکتور با موفقیت صادر و تنظیم شد.',
      shareLink: updatedShareLink,
      fullUrl,
    });
  } catch (err: any) {
    console.error('[Share Link API] create/update error:', err);
    return res.status(500).json({ success: false, message: err.message || 'خطا در صدور لینک آنلاین فاکتور' });
  }
});

// 13.3 Revoke or Disable Share Link for an Invoice
app.delete('/api/invoices/:id/share-link', async (req, res) => {
  try {
    const authUser = (req as AuthenticatedRequest).authUser;
    if (
      !isAdminUser(authUser) &&
      !authUser?.permissions?.canCreateInvoice &&
      !authUser?.permissions?.canViewInvoices &&
      !authUser?.permissions?.canManageCustomers
    ) {
      return res.status(403).json({
        success: false,
        message: 'شما مجوز لغو پیوند تحت وب را ندارید.',
      });
    }
    const invoiceId = req.params.id;
    const { data: dbData } = await getLatestConvergedDatabase();
    const invoices = Array.isArray(dbData?.invoices) ? dbData.invoices : [];
    const invoiceIndex = invoices.findIndex((inv: any) => inv?.id === invoiceId);

    if (invoiceIndex === -1) {
      return res.status(404).json({ success: false, message: 'فاکتور مورد نظر یافت نشد.' });
    }

    const currentInvoice = invoices[invoiceIndex];
    if (currentInvoice.shareLink) {
      currentInvoice.shareLink.enabled = false;
      invoices[invoiceIndex] = currentInvoice;

      await enqueueDbWrite(async () => {
        const current = readDatabase();
        if (Array.isArray(current.invoices)) {
          const idx = current.invoices.findIndex((i: any) => i.id === invoiceId);
          if (idx !== -1) {
            current.invoices[idx] = currentInvoice;
            writeDatabase(current, false);
            if (getPostgresStatus().connected) {
              saveStateToPostgres(current).catch(() => {});
            }
          }
        }
      });
    }

    return res.json({
      success: true,
      message: 'دسترسی به لینک آنلاین این فاکتور با موفقیت لغو و مسدود شد.',
    });
  } catch (err: any) {
    console.error('[Share Link API] delete error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// -------------------------------------------------------------
// VITE OR STATIC CLIENT SERVING
// -------------------------------------------------------------
async function startServer() {
  const server = http.createServer(app);
  // Keep-Alive timeout must be higher than Nginx keepalive_timeout (60s) to prevent race-condition 502 errors
  server.keepAliveTimeout = 65000;
  server.headersTimeout = 66000;

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    // Security: never expose compiled server bundle or source maps over HTTP
    app.use((req, res, next) => {
      const reqPath = (req.path || '').toLowerCase();
      if (reqPath === '/server.cjs' || reqPath.endsWith('.cjs') || reqPath.endsWith('.map')) {
        return res.status(404).end();
      }
      next();
    });
    app.use(
      express.static(distPath, {
        setHeaders: (res, filePath) => {
          const base = path.basename(filePath);
          if (
            base === 'index.html' ||
            base === 'sw.js' ||
            base === 'registerSW.js' ||
            base === 'manifest.webmanifest' ||
            base.startsWith('workbox-')
          ) {
            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
          }
        },
      })
    );
    app.get('*', (req, res) => {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Listen immediately so Nginx / Docker healthchecks succeed in <200ms
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[Factor Server] Centralized multi-user server running on http://0.0.0.0:${PORT}`);
    console.log(`[Factor Server] Persistent storage mounted at: ${DATA_DIR}`);

    // Initialize PostgreSQL asynchronously right after port binding
    testAndInitPostgres().catch((err: any) => {
      console.warn('[PostgreSQL Bootstrap Warning]:', err.message);
    });

    // One-time transparent password hashing migration on startup (no plaintext left at rest)
    setTimeout(async () => {
      try {
        const { data: current } = await getLatestConvergedDatabase();
        const migrated = ensureUsersPasswordsHashed(current.users || []);
        if (migrated.changed) {
          current.users = migrated.users;
          writeDatabase(current, false, false);
          if (getPostgresStatus().connected) {
            await saveStateToPostgres(current).catch(() => {});
          }
          console.log('[Security] Migrated legacy plaintext user passwords to scrypt hashes.');
        }
        const existingBackups = getBackupsList();
        if (existingBackups.length === 0) {
          createBackup('startup', 'نسخه اولیه راه‌اندازی سیستم و دیتابیس');
        }
      } catch (e) {
        console.error('[Backup Engine] Failed initial startup tasks:', e);
      }
    }, 1500);

    // Schedule automated periodic backup check (every 4 hours)
    setInterval(() => {
      try {
        createBackup('auto', 'پشتیبان‌گیری خودکار دوره‌ای سیستم');
      } catch (err) {
        console.error('[Backup Engine] Scheduled auto-backup error:', err);
      }
    }, 4 * 60 * 60 * 1000);
  });

  // Clean shutdown when running as PID 1 in Docker (waits briefly for in-flight DB writes)
  let isShuttingDown = false;
  const handleShutdown = (signal: string) => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    console.log(`[Factor Server] Received ${signal}, draining in-flight writes and shutting down...`);
    const forceExitTimer = setTimeout(() => process.exit(0), 3000);
    forceExitTimer.unref();

    server.close(() => {
      dbWriteQueue
        .catch(() => {})
        .finally(() => {
          clearTimeout(forceExitTimer);
          process.exit(0);
        });
    });
  };

  process.on('SIGTERM', () => handleShutdown('SIGTERM'));
  process.on('SIGINT', () => handleShutdown('SIGINT'));
}

startServer();

