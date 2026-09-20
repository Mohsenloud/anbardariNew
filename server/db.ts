import pg from 'pg';
const { Pool } = pg;

// PostgreSQL Connection Pool
let pool: pg.Pool | null = null;
let isConnected = false;
let dbInitialized = false;

export function getPostgresPool(): pg.Pool | null {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString && !process.env.PGDATABASE) {
    return null;
  }

  if (!pool) {
    try {
      pool = new Pool({
        connectionString: connectionString || undefined,
        host: process.env.PGHOST || 'localhost',
        port: Number(process.env.PGPORT) || 5432,
        user: process.env.PGUSER || 'mana_user',
        password: process.env.PGPASSWORD || '',
        database: process.env.PGDATABASE || 'mana_db',
        max: 10,
        idleTimeoutMillis: 10000,
        connectionTimeoutMillis: 1500,
      });

      pool.on('error', (err) => {
        isConnected = false;
        // Suppress repetitive log flooding when postgres server is not running locally
      });
    } catch (err: any) {
      pool = null;
    }
  }

  return pool;
}

// Check connection and initialize schema if needed
export async function testAndInitPostgres(): Promise<boolean> {
  const currentPool = getPostgresPool();
  if (!currentPool) {
    return false;
  }

  try {
    const client = await currentPool.connect();
    try {
      const res = await client.query('SELECT current_database(), current_user, version();');
      const row = res.rows[0];
      console.log(`[PostgreSQL Connected] Database: "${row.current_database}", User: "${row.current_user}"`);
      isConnected = true;

      // Auto-migrate tables for mana_db
      if (!dbInitialized) {
        await initSchema(client);
        dbInitialized = true;
      }
      return true;
    } finally {
      client.release();
    }
  } catch (err: any) {
    isConnected = false;
    if (pool) {
      try {
        pool.end().catch(() => {});
      } catch (_) {}
      pool = null;
    }
    console.log(`[PostgreSQL Status] Standalone database is offline or not running locally (${err.code || err.message}). App is using local file storage.`);
    return false;
  }
}

// Automatically create tables in mana_db if they don't exist
async function initSchema(client: pg.PoolClient) {
  console.log('[PostgreSQL Schema] Initializing mana_db schema...');
  
  await client.query(`
    -- Primary application state table for high performance and zero loss
    CREATE TABLE IF NOT EXISTS system_state (
      id VARCHAR(50) PRIMARY KEY,
      data JSONB NOT NULL,
      revision INT DEFAULT 1,
      checksum VARCHAR(100),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    -- Standalone relational tables for direct querying, reporting and indexing
    CREATE TABLE IF NOT EXISTS warehouses (
      id VARCHAR(100) PRIMARY KEY,
      name VARCHAR(250) NOT NULL,
      code VARCHAR(100),
      phone VARCHAR(50),
      manager_name VARCHAR(150),
      address TEXT,
      is_default BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS products (
      id VARCHAR(100) PRIMARY KEY,
      name VARCHAR(300) NOT NULL,
      barcode VARCHAR(100),
      category VARCHAR(150),
      unit VARCHAR(50) DEFAULT 'عدد',
      stock NUMERIC(12, 2) DEFAULT 0,
      min_stock_alert NUMERIC(12, 2) DEFAULT 5,
      purchase_price NUMERIC(15, 2) DEFAULT 0,
      sell_price NUMERIC(15, 2) DEFAULT 0,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS customers (
      id VARCHAR(100) PRIMARY KEY,
      name VARCHAR(250) NOT NULL,
      phone VARCHAR(50),
      address TEXT,
      national_id VARCHAR(50),
      economic_code VARCHAR(50),
      postal_code VARCHAR(50),
      balance NUMERIC(15, 2) DEFAULT 0,
      total_invoices INT DEFAULT 0,
      total_spent NUMERIC(15, 2) DEFAULT 0,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS invoices (
      id VARCHAR(100) PRIMARY KEY,
      invoice_number VARCHAR(100) NOT NULL UNIQUE,
      date VARCHAR(50) NOT NULL,
      customer_id VARCHAR(100),
      customer_name VARCHAR(250) NOT NULL,
      customer_phone VARCHAR(50),
      items JSONB NOT NULL,
      total_amount NUMERIC(15, 2) NOT NULL,
      discount NUMERIC(15, 2) DEFAULT 0,
      tax NUMERIC(15, 2) DEFAULT 0,
      final_amount NUMERIC(15, 2) NOT NULL,
      status VARCHAR(50) DEFAULT 'completed',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS db_backups (
      id SERIAL PRIMARY KEY,
      filename VARCHAR(255) NOT NULL,
      trigger_type VARCHAR(50) NOT NULL,
      label VARCHAR(255),
      size_bytes INT DEFAULT 0,
      checksum VARCHAR(100),
      data JSONB NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `);

  console.log('[PostgreSQL Schema] mana_db tables verified successfully.');
}

// Load full state from PostgreSQL
export async function loadStateFromPostgres(): Promise<any | null> {
  if (!isConnected) {
    return null;
  }
  const currentPool = getPostgresPool();
  if (!currentPool) return null;

  try {
    const res = await currentPool.query('SELECT data, revision, checksum FROM system_state WHERE id = $1', ['main_store_data']);
    if (res.rows.length > 0) {
      return res.rows[0].data;
    }
  } catch (err: any) {
    // If connection dropped, mark as disconnected
    isConnected = false;
    console.warn('[PostgreSQL Load Notice]:', err.message);
  }
  return null;
}

// Save full state into PostgreSQL with ACID transaction
export async function saveStateToPostgres(data: any): Promise<boolean> {
  if (!isConnected) {
    return false;
  }
  const currentPool = getPostgresPool();
  if (!currentPool) return false;

  let client: pg.PoolClient | null = null;
  try {
    client = await currentPool.connect();
    await client.query('BEGIN');

    // 1. Update JSONB system_state
    const rev = typeof data.revision === 'number' ? data.revision : 1;
    await client.query(
      `INSERT INTO system_state (id, data, revision, checksum, updated_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (id) DO UPDATE 
       SET data = $2, revision = $3, checksum = $4, updated_at = NOW()`,
      ['main_store_data', JSON.stringify(data), rev, data.checksum || '']
    );

    // 2. Sync to relational tables in background if arrays exist
    if (Array.isArray(data.warehouses) && data.warehouses.length > 0) {
      for (const w of data.warehouses) {
        await client.query(
          `INSERT INTO warehouses (id, name, code, phone, manager_name, address, is_default, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
           ON CONFLICT (id) DO UPDATE
           SET name = $2, code = $3, phone = $4, manager_name = $5, address = $6, is_default = $7, updated_at = NOW()`,
          [w.id, w.name, w.code || '', w.phone || '', w.managerName || '', w.address || '', !!w.isDefault]
        );
      }
    }

    if (Array.isArray(data.products) && data.products.length > 0) {
      for (const p of data.products) {
        await client.query(
          `INSERT INTO products (id, name, barcode, category, unit, stock, min_stock_alert, purchase_price, sell_price, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
           ON CONFLICT (id) DO UPDATE
           SET name = $2, barcode = $3, category = $4, unit = $5, stock = $6, min_stock_alert = $7, purchase_price = $8, sell_price = $9, updated_at = NOW()`,
          [p.id, p.name, p.barcode || '', p.category || '', p.unit || 'عدد', p.stock || 0, p.minStockAlert || 5, p.purchasePrice || 0, p.sellPrice || 0]
        );
      }
    }

    await client.query('COMMIT');
    return true;
  } catch (err: any) {
    if (client) {
      try {
        await client.query('ROLLBACK');
      } catch (_) {}
    }
    isConnected = false;
    console.warn('[PostgreSQL Save Notice]:', err.message);
    return false;
  } finally {
    if (client) {
      client.release();
    }
  }
}

// Check database status
export function getPostgresStatus() {
  return {
    configured: Boolean(process.env.DATABASE_URL || process.env.PGDATABASE),
    database: process.env.PGDATABASE || 'mana_db',
    host: process.env.PGHOST || 'localhost',
    connected: isConnected,
  };
}

// Live diagnostics and connection test for Admin Panel
export async function testPostgresConnectionDetails(): Promise<{
  success: boolean;
  connected: boolean;
  database: string;
  host: string;
  user: string;
  serverTime?: string;
  version?: string;
  dbSizeBytes?: number;
  tablesCount?: number;
  latencyMs?: number;
  message: string;
  guide?: string;
}> {
  const currentDb = process.env.PGDATABASE || 'mana_db';
  const currentHost = process.env.PGHOST || 'postgres';
  const currentUser = process.env.PGUSER || 'mana_user';

  const startTime = Date.now();
  const currentPool = getPostgresPool();
  if (!currentPool) {
    return {
      success: false,
      connected: false,
      database: currentDb,
      host: currentHost,
      user: currentUser,
      message: 'تنظیمات کانکشن‌پول در دسترس نیست یا مقداردهی اولیه انجام نشده است.',
      guide: 'بررسی کنید آیا متغیرهای محیطی یا کانتینر postgres در docker-compose فعال است یا خیر.',
    };
  }

  let client: pg.PoolClient | null = null;
  try {
    client = await currentPool.connect();
    const latencyMs = Date.now() - startTime;
    isConnected = true;

    // Run diagnostics queries
    const timeRes = await client.query('SELECT NOW() as now_time, version() as pg_version, current_database() as db_name');
    
    // Count tables in mana_db
    let tablesCount = 0;
    try {
      const tablesRes = await client.query(
        "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public'"
      );
      tablesCount = parseInt(tablesRes.rows[0]?.count || '0', 10);
    } catch {}

    // Get size if permitted
    let dbSizeBytes = 0;
    try {
      const sizeRes = await client.query(`SELECT pg_database_size(current_database()) as size`);
      dbSizeBytes = parseInt(sizeRes.rows[0]?.size || '0', 10);
    } catch {}

    return {
      success: true,
      connected: true,
      database: timeRes.rows[0]?.db_name || currentDb,
      host: currentHost,
      user: currentUser,
      serverTime: timeRes.rows[0]?.now_time,
      version: timeRes.rows[0]?.pg_version?.split(' ')?.[0] + ' ' + (timeRes.rows[0]?.pg_version?.split(' ')?.[1] || ''),
      dbSizeBytes,
      tablesCount,
      latencyMs,
      message: `ارتباط با دیتابیس PostgreSQL (${currentDb}) با موفقیت برقرار است و پینگ سرور ${latencyMs} میلی‌ثانیه است.`,
    };
  } catch (err: any) {
    isConnected = false;
    const latencyMs = Date.now() - startTime;
    const isLocalRefused = err.code === 'ECONNREFUSED';
    return {
      success: false,
      connected: false,
      database: currentDb,
      host: currentHost,
      user: currentUser,
      latencyMs,
      message: isLocalRefused
        ? 'پایگاه‌داده PostgreSQL در محیط پیش‌نمایش ابری فعال نیست (سیستم در حالت ذخیره‌سازی محلی کار می‌کند). این قابلیت پس از استقرار روی سرور VPS با داکر فعال خواهد بود.'
        : `عدم امکان اتصال به دیتابیس PostgreSQL (${err.code || err.message})`,
      guide: 'روی سرور VPS شخصی، کانتینر mana_postgres_db از طریق docker compose up -d به صورت خودکار اجرا می‌شود.',
    };
  } finally {
    if (client) {
      client.release();
    }
  }
}

function escapeSqlString(val: any): string {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'number') return isNaN(val) ? '0' : String(val);
  if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
  if (typeof val === 'object') return `'${JSON.stringify(val).replace(/'/g, "''")}'::jsonb`;
  return `'${String(val).replace(/'/g, "''")}'`;
}

// Generate complete SQL script for PostgreSQL mana_db
export function generatePostgresSqlDump(data: any): string {
  const now = new Date().toISOString();
  const dbName = process.env.PGDATABASE || 'mana_db';
  const products = Array.isArray(data?.products) ? data.products : [];
  const customers = Array.isArray(data?.customers) ? data.customers : [];
  const invoices = Array.isArray(data?.invoices) ? data.invoices : [];
  const warehouses = Array.isArray(data?.settings?.warehouses) ? data.settings.warehouses : [];

  const lines: string[] = [];
  lines.push(`-- =========================================================`);
  lines.push(`-- PostgreSQL mana_db Complete Database Export & Dump`);
  lines.push(`-- Generated At: ${now}`);
  lines.push(`-- Target Database: ${dbName}`);
  lines.push(`-- Encoding: UTF-8`);
  lines.push(`-- Compatible with: PostgreSQL 14 / 15 / 16 / 17`);
  lines.push(`-- =========================================================\n`);

  lines.push(`BEGIN;`);
  lines.push(`SET client_encoding = 'UTF8';\n`);

  // Schema creation
  lines.push(`-- 1. Tables Creation`);
  lines.push(`CREATE TABLE IF NOT EXISTS system_state (
  id VARCHAR(50) PRIMARY KEY,
  data JSONB NOT NULL,
  revision INT DEFAULT 1,
  checksum VARCHAR(100),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS warehouses (
  id VARCHAR(100) PRIMARY KEY,
  name VARCHAR(250) NOT NULL,
  code VARCHAR(100),
  phone VARCHAR(50),
  manager_name VARCHAR(150),
  address TEXT,
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS products (
  id VARCHAR(100) PRIMARY KEY,
  name VARCHAR(300) NOT NULL,
  barcode VARCHAR(100),
  category VARCHAR(150),
  unit VARCHAR(50) DEFAULT 'عدد',
  stock NUMERIC(12, 2) DEFAULT 0,
  min_stock_alert NUMERIC(12, 2) DEFAULT 5,
  purchase_price NUMERIC(15, 2) DEFAULT 0,
  sell_price NUMERIC(15, 2) DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS customers (
  id VARCHAR(100) PRIMARY KEY,
  name VARCHAR(250) NOT NULL,
  phone VARCHAR(50),
  address TEXT,
  national_id VARCHAR(50),
  economic_code VARCHAR(50),
  postal_code VARCHAR(50),
  balance NUMERIC(15, 2) DEFAULT 0,
  total_invoices INT DEFAULT 0,
  total_spent NUMERIC(15, 2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS invoices (
  id VARCHAR(100) PRIMARY KEY,
  invoice_number VARCHAR(100) NOT NULL UNIQUE,
  date VARCHAR(50) NOT NULL,
  customer_id VARCHAR(100),
  customer_name VARCHAR(250) NOT NULL,
  customer_phone VARCHAR(50),
  items JSONB NOT NULL,
  total_amount NUMERIC(15, 2) NOT NULL,
  discount NUMERIC(15, 2) DEFAULT 0,
  tax NUMERIC(15, 2) DEFAULT 0,
  final_amount NUMERIC(15, 2) NOT NULL,
  status VARCHAR(50) DEFAULT 'completed',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS db_backups (
  id SERIAL PRIMARY KEY,
  filename VARCHAR(255) NOT NULL,
  trigger_type VARCHAR(50) NOT NULL,
  label VARCHAR(255),
  size_bytes INT DEFAULT 0,
  checksum VARCHAR(100),
  data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);\n`);

  // Insert system_state
  lines.push(`-- 2. System State (Primary Json Data)`);
  lines.push(`INSERT INTO system_state (id, data, revision, updated_at)
VALUES ('main_store_data', ${escapeSqlString(data)}, 1, CURRENT_TIMESTAMP)
ON CONFLICT (id) DO UPDATE SET
  data = EXCLUDED.data,
  revision = system_state.revision + 1,
  updated_at = CURRENT_TIMESTAMP;\n`);

  // Insert warehouses
  if (warehouses.length > 0) {
    lines.push(`-- 3. Warehouses (${warehouses.length} records)`);
    for (const w of warehouses) {
      lines.push(`INSERT INTO warehouses (id, name, code, phone, manager_name, address, is_default, updated_at)
VALUES (${escapeSqlString(w.id)}, ${escapeSqlString(w.name)}, ${escapeSqlString(w.code)}, ${escapeSqlString(w.phone)}, ${escapeSqlString(w.managerName)}, ${escapeSqlString(w.address)}, ${w.isDefault ? 'TRUE' : 'FALSE'}, CURRENT_TIMESTAMP)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  code = EXCLUDED.code,
  phone = EXCLUDED.phone,
  manager_name = EXCLUDED.manager_name,
  address = EXCLUDED.address,
  is_default = EXCLUDED.is_default,
  updated_at = CURRENT_TIMESTAMP;`);
    }
    lines.push('');
  }

  // Insert products
  if (products.length > 0) {
    lines.push(`-- 4. Products (${products.length} records)`);
    for (const p of products) {
      lines.push(`INSERT INTO products (id, name, barcode, category, unit, stock, min_stock_alert, purchase_price, sell_price, updated_at)
VALUES (${escapeSqlString(p.id)}, ${escapeSqlString(p.name)}, ${escapeSqlString(p.barcode)}, ${escapeSqlString(p.category)}, ${escapeSqlString(p.unit || 'عدد')}, ${Number(p.stock) || 0}, ${Number(p.minStockAlert) || 5}, ${Number(p.buyPrice) || 0}, ${Number(p.sellPrice) || 0}, CURRENT_TIMESTAMP)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  barcode = EXCLUDED.barcode,
  category = EXCLUDED.category,
  unit = EXCLUDED.unit,
  stock = EXCLUDED.stock,
  min_stock_alert = EXCLUDED.min_stock_alert,
  purchase_price = EXCLUDED.purchase_price,
  sell_price = EXCLUDED.sell_price,
  updated_at = CURRENT_TIMESTAMP;`);
    }
    lines.push('');
  }

  // Insert customers
  if (customers.length > 0) {
    lines.push(`-- 5. Customers (${customers.length} records)`);
    for (const c of customers) {
      lines.push(`INSERT INTO customers (id, name, phone, address, national_id, economic_code, postal_code, balance, total_invoices, total_spent)
VALUES (${escapeSqlString(c.id)}, ${escapeSqlString(c.name)}, ${escapeSqlString(c.phone)}, ${escapeSqlString(c.address)}, ${escapeSqlString(c.nationalId)}, ${escapeSqlString(c.economicCode)}, ${escapeSqlString(c.postalCode)}, ${Number(c.balance) || 0}, ${Number(c.totalInvoices) || 0}, ${Number(c.totalSpent) || 0})
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  phone = EXCLUDED.phone,
  address = EXCLUDED.address,
  national_id = EXCLUDED.national_id,
  economic_code = EXCLUDED.economic_code,
  postal_code = EXCLUDED.postal_code,
  balance = EXCLUDED.balance,
  total_invoices = EXCLUDED.total_invoices,
  total_spent = EXCLUDED.total_spent;`);
    }
    lines.push('');
  }

  // Insert invoices
  if (invoices.length > 0) {
    lines.push(`-- 6. Invoices (${invoices.length} records)`);
    for (const inv of invoices) {
      lines.push(`INSERT INTO invoices (id, invoice_number, date, customer_id, customer_name, customer_phone, items, total_amount, discount, tax, final_amount, status)
VALUES (${escapeSqlString(inv.id)}, ${escapeSqlString(inv.invoiceNumber)}, ${escapeSqlString(inv.date)}, ${escapeSqlString(inv.customerId)}, ${escapeSqlString(inv.customerName)}, ${escapeSqlString(inv.customerPhone)}, ${escapeSqlString(inv.items || [])}, ${Number(inv.totalAmount) || 0}, ${Number(inv.discount) || 0}, ${Number(inv.tax) || 0}, ${Number(inv.finalAmount) || 0}, ${escapeSqlString(inv.status || 'completed')})
ON CONFLICT (id) DO UPDATE SET
  invoice_number = EXCLUDED.invoice_number,
  date = EXCLUDED.date,
  customer_id = EXCLUDED.customer_id,
  customer_name = EXCLUDED.customer_name,
  customer_phone = EXCLUDED.customer_phone,
  items = EXCLUDED.items,
  total_amount = EXCLUDED.total_amount,
  discount = EXCLUDED.discount,
  tax = EXCLUDED.tax,
  final_amount = EXCLUDED.final_amount,
  status = EXCLUDED.status;`);
    }
    lines.push('');
  }

  lines.push(`COMMIT;`);
  lines.push(`-- Export Completed Successfully.`);
  return lines.join('\n');
}

// Execute Raw SQL statements or import into PostgreSQL
export async function executeRawSql(sqlContent: string): Promise<{ success: boolean; message: string; rowsAffected?: number }> {
  const currentPool = getPostgresPool();
  if (!currentPool) {
    return { success: false, message: 'پایگاه داده PostgreSQL در دسترس نیست.' };
  }
  let client: pg.PoolClient | null = null;
  try {
    client = await currentPool.connect();
    await client.query('BEGIN');
    await client.query(sqlContent);
    await client.query('COMMIT');
    return { success: true, message: 'اسکریپت پایگاه داده با موفقیت بر روی mana_db اجرا شد.' };
  } catch (err: any) {
    if (client) {
      try {
        await client.query('ROLLBACK');
      } catch (_) {}
    }
    return { success: false, message: `خطا در اجرای اسکریپت SQL: ${err.message}` };
  } finally {
    if (client) {
      client.release();
    }
  }
}

// Create a direct snapshot record inside PostgreSQL db_backups table
export async function createPostgresDbBackupRecord(label: string, data: any): Promise<{ success: boolean; message: string; id?: number }> {
  const currentPool = getPostgresPool();
  if (!currentPool) {
    return { success: false, message: 'دیتابیس PostgreSQL متصل نیست.' };
  }
  try {
    const filename = `pg_backup_${Date.now()}.json`;
    const dataStr = JSON.stringify(data);
    const sizeBytes = Buffer.byteLength(dataStr, 'utf8');
    const res = await currentPool.query(
      `INSERT INTO db_backups (filename, trigger_type, label, size_bytes, data, created_at)
       VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
       RETURNING id, created_at`,
      [filename, 'manual_admin', label || 'پشتیبان دستی PostgreSQL', sizeBytes, data]
    );
    return {
      success: true,
      message: 'نسخه پشتیبان مستقیم در جدول db_backups پایگاه‌داده mana_db ذخیره شد.',
      id: res.rows[0]?.id,
    };
  } catch (err: any) {
    return { success: false, message: `خطا در ثبت رکورد در db_backups: ${err.message}` };
  }
}
