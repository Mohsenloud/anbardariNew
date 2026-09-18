import express from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createServer as createViteServer } from 'vite';
import {
  testAndInitPostgres,
  loadStateFromPostgres,
  saveStateToPostgres,
  getPostgresStatus,
  testPostgresConnectionDetails,
} from './server/db';

const app = express();
const PORT = 3000;

// Tell Express to trust the reverse proxy (nginx / Cloud Run) for accurate client IP resolution
app.set('trust proxy', 1);

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
  exitSlipLogs: {},
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
    originWarehouseName: 'انبار مرکزی سپهر',
    originWarehouseCode: 'WH-01',
    originWarehouseAddress: 'تهران، جاده مخصوص، کیلومتر ۱۲، خیابان بهار، سوله شماره ۴',
    originWarehousePhone: '۰۲۱-۵۵۴۴۳۳۲۲',
    originWarehouseManager: 'مرتضی اکبری (انباردار مرکزی)',
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
  ];
  for (const key of arrayKeys) {
    if (data[key] !== undefined && !Array.isArray(data[key])) {
      return { valid: false, error: `بخش ${key} باید به صورت آرایه باشد.` };
    }
  }
  if (data.settings !== undefined && (typeof data.settings !== 'object' || Array.isArray(data.settings))) {
    return { valid: false, error: 'بخش تنظیمات سیستم نامعتبر است.' };
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
  };
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
  label: string = 'پشتیبان سیستم'
): { success: boolean; filename?: string; error?: string } {
  try {
    if (!fs.existsSync(BACKUPS_DIR)) {
      fs.mkdirSync(BACKUPS_DIR, { recursive: true });
    }

    const currentData = readDatabaseRaw();
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
      stats: {
        productsCount: Array.isArray(currentData.products) ? currentData.products.length : 0,
        invoicesCount: Array.isArray(currentData.invoices) ? currentData.invoices.length : 0,
        customersCount: Array.isArray(currentData.customers) ? currentData.customers.length : 0,
        purchaseInvoicesCount: Array.isArray(currentData.purchaseInvoices) ? currentData.purchaseInvoices.length : 0,
        inboundReceiptsCount: Array.isArray(currentData.inboundReceipts) ? currentData.inboundReceipts.length : 0,
      },
      data: currentData,
    };

    const tempFile = `${targetPath}.tmp.${Date.now()}`;
    fs.writeFileSync(tempFile, JSON.stringify(backupEnvelope, null, 2), 'utf-8');
    fs.renameSync(tempFile, targetPath);

    lastAutoBackupTime = Date.now();
    pruneOldBackups(30);

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
        const stats =
          isEnvelope && parsed.stats
            ? parsed.stats
            : {
                productsCount: Array.isArray(parsed.products) ? parsed.products.length : 0,
                invoicesCount: Array.isArray(parsed.invoices) ? parsed.invoices.length : 0,
                customersCount: Array.isArray(parsed.customers) ? parsed.customers.length : 0,
                purchaseInvoicesCount: Array.isArray(parsed.purchaseInvoices) ? parsed.purchaseInvoices.length : 0,
                inboundReceiptsCount: Array.isArray(parsed.inboundReceipts) ? parsed.inboundReceipts.length : 0,
              };

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

function writeDatabase(data: any, allowAutoSnapshot = true): boolean {
  try {
    const currentRev = typeof data.revision === 'number' ? data.revision : 1;
    const nowIso = new Date().toISOString();
    const payload = {
      ...data,
      revision: currentRev + 1,
      updatedAt: nowIso,
    };

    // Calculate integrity checksum
    const rawContent = JSON.stringify(payload, null, 2);
    payload.checksum = crypto.createHash('sha256').update(rawContent).digest('hex');

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
// REST API ENDPOINTS
// -------------------------------------------------------------

// 1. Health check & status with backup metrics & PostgreSQL status
app.get('/api/health', (req, res) => {
  const exists = fs.existsSync(DB_FILE);
  let dbStats = { exists, sizeBytes: 0, revision: 1, checksum: '' };
  if (exists) {
    try {
      const stat = fs.statSync(DB_FILE);
      dbStats.sizeBytes = stat.size;
      const current = readDatabaseRaw();
      dbStats.revision = current.revision || 1;
      dbStats.checksum = current.checksum || '';
    } catch {}
  }

  const backups = getBackupsList();
  const pgStatus = getPostgresStatus();

  res.json({
    status: 'ok',
    mode: process.env.NODE_ENV || 'development',
    serverTime: new Date().toISOString(),
    dataDir: DATA_DIR,
    database: dbStats,
    postgres: pgStatus,
    backups: {
      total: backups.length,
      autoBackupIntervalHours: 4,
      lastBackup: backups[0] || null,
    },
  });
});

// 1.1 Detailed Database Diagnostic & Status
app.get('/api/database/status', async (req, res) => {
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
app.post('/api/database/test', async (req, res) => {
  try {
    const result = await testPostgresConnectionDetails();
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 1.3 Force Synchronization from Local to PostgreSQL or vice versa
app.post('/api/database/force-sync', async (req, res) => {
  try {
    const localData = readDatabase();
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

    const saved = await saveStateToPostgres(localData);
    if (saved) {
      return res.json({
        success: true,
        message: 'کلیه اطلاعات سیستم با موفقیت در جداول پایگاه‌داده PostgreSQL (mana_db) همگام‌سازی و ذخیره شد.',
      });
    } else {
      return res.status(500).json({
        success: false,
        message: 'خطا در ثبت اطلاعات در دیتابیس PostgreSQL.',
      });
    }
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 2. Fetch all shared data (Central synchronization with PostgreSQL support)
app.get('/api/db', async (req, res) => {
  try {
    // 1. First attempt to fetch persistent data from PostgreSQL (mana_db)
    const pgData = await loadStateFromPostgres();
    if (pgData && typeof pgData === 'object' && Array.isArray(pgData.products)) {
      return res.json({
        success: true,
        data: pgData,
        source: 'postgresql',
        database: 'mana_db',
        serverTime: new Date().toISOString(),
      });
    }

    // 2. Fallback to local hardened JSON file
    const data = readDatabase();

    // If PostgreSQL is connected but table was just created empty, seed initial data to mana_db
    if (getPostgresStatus().connected) {
      saveStateToPostgres(data).catch((e) => {
        console.warn('[PostgreSQL Initial Sync Warning]:', e.message);
      });
    }

    res.json({
      success: true,
      data,
      source: 'local-file',
      serverTime: new Date().toISOString(),
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 3. Save or update database (Dual persistence: PostgreSQL mana_db + Local Snapshot)
app.post('/api/db', dbWriteLimiter, async (req, res) => {
  try {
    const incomingData = req.body;
    
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

    const currentDb = (await loadStateFromPostgres()) || readDatabase();
    const currentRev = typeof currentDb.revision === 'number' ? currentDb.revision : 1;
    const nowIso = new Date().toISOString();
    
    const updatedDb = {
      ...currentDb,
      ...incomingData,
      revision: currentRev + 1,
      updatedAt: nowIso,
    };

    // Calculate checksum
    const rawContent = JSON.stringify(updatedDb, null, 2);
    updatedDb.checksum = crypto.createHash('sha256').update(rawContent).digest('hex');

    // Dual-write: write to local file snapshot
    const successLocal = writeDatabase(updatedDb, true);

    // Write to PostgreSQL mana_db
    let pgSaved = false;
    if (getPostgresStatus().connected) {
      pgSaved = await saveStateToPostgres(updatedDb);
    }

    if (!successLocal && !pgSaved) {
      return res.status(500).json({ success: false, message: 'خطا در ذخیره‌سازی داده‌ها در سرور' });
    }

    res.json({
      success: true,
      revision: updatedDb.revision,
      checksum: updatedDb.checksum,
      updatedAt: updatedDb.updatedAt,
      storage: {
        local: successLocal,
        postgresql: pgSaved,
        database: 'mana_db',
      },
      message: 'داده‌ها با موفقیت در پایگاه‌داده ذخیره شدند.',
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 4. Security & Backup Engine Status check
app.get('/api/security/status', (req, res) => {
  const backups = getBackupsList();
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
app.get('/api/backups', (req, res) => {
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
app.post('/api/backups/create', (req, res) => {
  try {
    const label = req.body?.label?.trim() || 'پشتیبان دستی کاربر';
    const result = createBackup('manual', label);
    if (!result.success) {
      return res.status(500).json({ success: false, message: result.error });
    }
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

// 7. Backups API: Restore a specific backup
app.post('/api/backups/restore', (req, res) => {
  try {
    const rawFilename = req.body?.filename;
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

    // Safety step: Create a pre-restore backup of the current database before overwriting!
    createBackup('pre-restore', `پشتیبان خودکار اضطراری قبل از بازیابی نسخه ${safeFilename}`);

    // Overwrite database with target backup
    const ok = writeDatabase(targetData, false);
    if (!ok) {
      return res.status(500).json({ success: false, message: 'خطا در اعمال اطلاعات نسخه پشتیبان بر روی پایگاه‌داده.' });
    }

    console.log(`[Backup Engine] Successfully restored database from backup: ${safeFilename}`);
    res.json({
      success: true,
      message: 'پایگاه‌داده با موفقیت به نسخه انتخاب‌شده بازگردانی شد.',
      restoredFrom: safeFilename,
      data: targetData,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 8. Backups API: Download a specific backup file
app.get('/api/backups/download/:filename', (req, res) => {
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
app.delete('/api/backups/:filename', (req, res) => {
  try {
    const safeFilename = path.basename(req.params.filename);
    const backupFilePath = path.join(BACKUPS_DIR, safeFilename);

    if (!fs.existsSync(backupFilePath)) {
      return res.status(404).json({ success: false, message: 'فایل پشتیبان یافت نشد.' });
    }

    fs.unlinkSync(backupFilePath);
    console.log(`[Backup Engine] Deleted backup file: ${safeFilename}`);
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

// 10. Backups API: Upload & Import external backup file
app.post('/api/backups/upload', (req, res) => {
  try {
    const { backupContent, restoreNow, label } = req.body;
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
      stats: {
        productsCount: Array.isArray(actualData.products) ? actualData.products.length : 0,
        invoicesCount: Array.isArray(actualData.invoices) ? actualData.invoices.length : 0,
        customersCount: Array.isArray(actualData.customers) ? actualData.customers.length : 0,
        purchaseInvoicesCount: Array.isArray(actualData.purchaseInvoices) ? actualData.purchaseInvoices.length : 0,
        inboundReceiptsCount: Array.isArray(actualData.inboundReceipts) ? actualData.inboundReceipts.length : 0,
      },
      data: actualData,
    };

    fs.writeFileSync(targetPath, JSON.stringify(backupEnvelope, null, 2), 'utf-8');

    // If restoreNow was requested
    if (restoreNow) {
      createBackup('pre-restore', 'پشتیبان خودکار قبل از اعمال فایل بارگذاری‌شده');
      writeDatabase(actualData, false);
    }

    const backups = getBackupsList();
    res.json({
      success: true,
      message: restoreNow ? 'فایل پشتیبان بارگذاری و اطلاعات با موفقیت بازیابی شد.' : 'فایل پشتیبان در سرور ذخیره شد.',
      filename,
      restored: !!restoreNow,
      backups,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 11. Legacy download central backup JSON (for backwards compatibility)
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
  // Test and initialize PostgreSQL if configured
  try {
    await testAndInitPostgres();
  } catch (err: any) {
    console.warn('[PostgreSQL Bootstrap Warning]:', err.message);
  }

  const server = http.createServer(app);

  if (process.env.NODE_ENV !== 'production') {
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
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[Factor Server] Centralized multi-user server running on http://0.0.0.0:${PORT}`);
    console.log(`[Factor Server] Persistent storage mounted at: ${DATA_DIR}`);

    // Initial check: if no backup exists, create startup baseline
    try {
      const existingBackups = getBackupsList();
      if (existingBackups.length === 0) {
        createBackup('startup', 'نسخه اولیه راه‌اندازی سیستم و دیتابیس');
      }
    } catch (e) {
      console.error('[Backup Engine] Failed initial startup backup:', e);
    }

    // Schedule automated periodic backup check (every 4 hours)
    setInterval(() => {
      try {
        createBackup('auto', 'پشتیبان‌گیری خودکار دوره‌ای سیستم');
      } catch (err) {
        console.error('[Backup Engine] Scheduled auto-backup error:', err);
      }
    }, 4 * 60 * 60 * 1000);
  });
}

startServer();
