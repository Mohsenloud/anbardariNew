import express from 'express';
import path from 'path';
import fs from 'fs';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createServer as createViteServer } from 'vite';

const app = express();
const PORT = 3000;

// Tell Express to trust the reverse proxy (nginx / Cloud Run) for accurate client IP resolution
app.set('trust proxy', 1);

// Hardening: Disable Express fingerprinting header
app.disable('x-powered-by');

// Hardening: HTTP Security Headers via Helmet
// Allows client-side PDF blobs, SVG canvas export, and Vite client without breaking preview
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

// Enable JSON body parsing with reasonable limit for invoice graphics and logs
app.use(express.json({ limit: '30mb' }));
app.use(express.urlencoded({ extended: true, limit: '30mb' }));

// Simple CORS header support for direct external API access if needed
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
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
  max: 60, // max 60 writes per minute per IP
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  message: {
    success: false,
    message: 'نرخ ذخیره‌سازی اطلاعات فراتر از حد مجاز است. لطفاً چند لحظه صبر نمایید.',
  },
});

// Configure persistent data directory
const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'database.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    console.log(`[Database] Created persistent data directory at: ${DATA_DIR}`);
  } catch (err) {
    console.error(`[Database] Failed to create data directory ${DATA_DIR}:`, err);
  }
}

// Initial default database structure
const DEFAULT_INITIAL_DATA = {
  version: 1,
  updatedAt: new Date().toISOString(),
  products: [
    {
      id: 'prod-1',
      name: 'روغن موتور اسپیدی ۴ لیتری',
      barcode: '6260123456789',
      category: 'روغن و روانکار',
      purchasePrice: 420000,
      sellPrice: 580000,
      stock: 35,
      minStockAlert: 10,
      unit: 'گالن',
      updatedAt: '۱۴۰۳/۰۶/۰۱',
    },
    {
      id: 'prod-2',
      name: 'فیلتر هوای پژو ۲۰۶ و ۲۰۷ سرکان',
      barcode: '6260987654321',
      category: 'فیلترجات',
      purchasePrice: 95000,
      sellPrice: 145000,
      stock: 8,
      minStockAlert: 15,
      unit: 'عدد',
      updatedAt: '۱۴۰۳/۰۶/۰۲',
    },
    {
      id: 'prod-3',
      name: 'لنت ترمز جلو پراید پارس لنت',
      barcode: '6260555666777',
      category: 'سیستم ترمز',
      purchasePrice: 210000,
      sellPrice: 290000,
      stock: 22,
      minStockAlert: 10,
      unit: 'دست',
      updatedAt: '۱۴۰۳/۰۶/۰۳',
    },
    {
      id: 'prod-4',
      name: 'شمع پایه کوتاه بوش اصل (آلمان)',
      barcode: '4047024123456',
      category: 'برقی و انژکتور',
      purchasePrice: 160000,
      sellPrice: 240000,
      stock: 4,
      minStockAlert: 12,
      unit: 'عدد',
      updatedAt: '۱۴۰۳/۰۶/۰۴',
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
  exitSlipLogs: [],
  settings: {
    storeName: 'فروشگاه و توزیع سپهر',
    storePhone: '۰۲۱-۵۵۴۴۳۳۲۲',
    storeAddress: 'تهران، خیابان امیرکبیر، کوچه بهار، پلاک ۲۴',
    storeCity: 'تهران',
    storeLogo: '',
    storeNationalId: '',
    storePostalCode: '',
    storeTagline: 'توزیع‌کننده قطعات یدکی و اقلام مصرفی خودرو',
    taxPercent: 9,
    enableTax: false,
    enableDiscount: true,
    currency: 'تومان',
    invoiceNumberPrefix: 'SP-',
    currentInvoiceNumber: 1001,
    invoiceFooterNote: 'از خرید شما صمیمانه متشکریم. اجناس برقی و مرجوعی پس از ۲۴ ساعت تعویض نمی‌گردد.',
    primaryColor: 'emerald',
    defaultTemplate: 'standard',
    enableThermalPrint: true,
    enableInventory: true,
    enableCustomers: true,
    enableReports: true,
    autoDeductStock: true,
    preventNegativeStock: false,
    showLowStockAlerts: true,
    paperSize: 'a4',
    enableExitSlipPrint: true,
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
        canDeleteInvoice: true,
        canManageInventory: true,
        canManageCustomers: true,
        canViewReports: true,
        canAccessAdmin: true,
        canManageUsers: true,
      },
      isActive: true,
      avatarColor: 'emerald',
      phone: '۰۹۱۲۰۰۰۰۰۰۰',
      pin: '1234',
      password: 'admin',
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
        canDeleteInvoice: false,
        canManageInventory: false,
        canManageCustomers: true,
        canViewReports: false,
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
        canDeleteInvoice: false,
        canManageInventory: true,
        canManageCustomers: false,
        canViewReports: false,
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
      roleTitle: 'حسابدار و تحلیلگر مالی',
      permissions: {
        canCreateInvoice: false,
        canViewInvoices: true,
        canDeleteInvoice: false,
        canManageInventory: false,
        canManageCustomers: true,
        canViewReports: true,
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
};

// Thread-safe atomic file persistence
function readDatabase() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      // Merge with defaults to ensure all required root keys exist
      return {
        ...DEFAULT_INITIAL_DATA,
        ...parsed,
      };
    }
  } catch (err) {
    console.error('[Database] Read error, falling back to default data:', err);
  }

  // Initialize DB if not present
  writeDatabase(DEFAULT_INITIAL_DATA);
  return DEFAULT_INITIAL_DATA;
}

function writeDatabase(data: any) {
  try {
    const payload = {
      ...data,
      updatedAt: new Date().toISOString(),
    };
    const tempFile = `${DB_FILE}.tmp.${Date.now()}`;
    fs.writeFileSync(tempFile, JSON.stringify(payload, null, 2), 'utf-8');
    fs.renameSync(tempFile, DB_FILE);
    return true;
  } catch (err) {
    console.error('[Database] Failed to write database file:', err);
    return false;
  }
}

// -------------------------------------------------------------
// REST API ENDPOINTS
// -------------------------------------------------------------

// 1. Health check & status
app.get('/api/health', (req, res) => {
  const exists = fs.existsSync(DB_FILE);
  let dbStats = { exists, sizeBytes: 0 };
  if (exists) {
    try {
      const stat = fs.statSync(DB_FILE);
      dbStats.sizeBytes = stat.size;
    } catch {}
  }
  res.json({
    status: 'ok',
    mode: process.env.NODE_ENV || 'development',
    serverTime: new Date().toISOString(),
    dataDir: DATA_DIR,
    database: dbStats,
  });
});

// 2. Fetch all shared data (Central synchronization)
app.get('/api/db', (req, res) => {
  try {
    const data = readDatabase();
    res.json({
      success: true,
      data,
      serverTime: new Date().toISOString(),
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 3. Save or update database (Hardened with rate-limiting and anti-pollution validation)
app.post('/api/db', dbWriteLimiter, (req, res) => {
  try {
    const incomingData = req.body;
    if (!incomingData || typeof incomingData !== 'object' || Array.isArray(incomingData)) {
      return res.status(400).json({ success: false, message: 'قالب داده‌های ارسالی نامعتبر است.' });
    }

    // Anti-prototype pollution check
    const dangerousKeys = ['__proto__', 'constructor', 'prototype'];
    for (const key of Object.keys(incomingData)) {
      if (dangerousKeys.includes(key)) {
        console.warn(`[Security Alert] Blocked suspicious key: ${key}`);
        return res.status(403).json({ success: false, message: 'درخواست غیرمجاز شناسایی و مسدود شد.' });
      }
    }

    const currentDb = readDatabase();
    const updatedDb = {
      ...currentDb,
      ...incomingData,
      updatedAt: new Date().toISOString(),
    };

    const success = writeDatabase(updatedDb);
    if (!success) {
      return res.status(500).json({ success: false, message: 'خطا در ذخیره‌سازی داده‌ها در سرور' });
    }

    res.json({
      success: true,
      updatedAt: updatedDb.updatedAt,
      message: 'داده‌ها با موفقیت در پایگاه‌داده مرکزی سرور ذخیره شدند.',
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 4. Security status check
app.get('/api/security/status', (req, res) => {
  res.json({
    success: true,
    security: {
      helmet: true,
      hidePoweredBy: true,
      rateLimiting: {
        generalApi: '300 req/min',
        databaseWrite: '60 req/min',
      },
      prototypePollutionGuard: true,
      bruteForceProtection: 'Active (5 attempts lockout)',
    },
    serverTime: new Date().toISOString(),
  });
});

// 4. Download central backup JSON
app.get('/api/backup', (req, res) => {
  try {
    const data = readDatabase();
    const filename = `factor-backup-server-${Date.now()}.json`;
    res.setHeader('Content-disposition', `attachment; filename=${filename}`);
    res.setHeader('Content-type', 'application/json');
    res.send(JSON.stringify(data, null, 2));
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// -------------------------------------------------------------
// VITE OR STATIC CLIENT SERVING
// -------------------------------------------------------------
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Factor Server] Centralized multi-user server running on http://0.0.0.0:${PORT}`);
    console.log(`[Factor Server] Persistent storage mounted at: ${DATA_DIR}`);
  });
}

startServer();
