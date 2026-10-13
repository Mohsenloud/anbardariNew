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
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 6000,
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
      invoice_number VARCHAR(100) NOT NULL,
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

    CREATE TABLE IF NOT EXISTS deleted_tombstones (
      entity_type VARCHAR(100) NOT NULL,
      entity_id VARCHAR(150) NOT NULL,
      deleted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (entity_type, entity_id)
    );

    -- Ensure legacy unique constraint on invoice_number does not block multiple pre-invoices/drafts
    DO $$ BEGIN
      ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_invoice_number_key;
    EXCEPTION
      WHEN undefined_table THEN NULL;
      WHEN undefined_object THEN NULL;
    END $$;
  `);

  console.log('[PostgreSQL Schema] mana_db tables verified successfully.');
}

// Track last save error for actionable diagnostics
let lastPostgresSaveError: string | null = null;
export function getLastPostgresSaveError(): string | null {
  return lastPostgresSaveError;
}

// Load full state from PostgreSQL
export async function loadStateFromPostgres(): Promise<any | null> {
  const currentPool = getPostgresPool();
  if (!currentPool) return null;

  let client: pg.PoolClient | null = null;
  try {
    client = await currentPool.connect();
    isConnected = true;

    if (!dbInitialized) {
      await initSchema(client);
      dbInitialized = true;
    }

    const res = await client.query('SELECT data, revision, checksum FROM system_state WHERE id = $1', ['main_store_data']);
    if (res.rows.length > 0 && res.rows[0].data) {
      return res.rows[0].data;
    }

    // Fallback: If system_state table exists but row is missing, check if relational tables contain records
    try {
      const prodCountRes = await client.query('SELECT count(*) FROM products');
      const prodCount = parseInt(prodCountRes.rows[0]?.count || '0', 10);
      if (prodCount > 0) {
        const [pRes, cRes, iRes, wRes] = await Promise.all([
          client.query('SELECT * FROM products ORDER BY id'),
          client.query('SELECT * FROM customers ORDER BY id'),
          client.query('SELECT * FROM invoices ORDER BY id'),
          client.query('SELECT * FROM warehouses ORDER BY id'),
        ]);

        return {
          products: pRes.rows.map((p) => ({
            id: p.id,
            name: p.name,
            barcode: p.barcode,
            category: p.category,
            unit: p.unit,
            stock: Number(p.stock) || 0,
            minStockAlert: Number(p.min_stock_alert) || 5,
            buyPrice: Number(p.purchase_price) || 0,
            sellPrice: Number(p.sell_price) || 0,
            updatedAt: p.updated_at,
          })),
          customers: cRes.rows.map((c) => ({
            id: c.id,
            name: c.name,
            phone: c.phone,
            address: c.address,
            nationalId: c.national_id,
            economicCode: c.economic_code,
            postalCode: c.postal_code,
            balance: Number(c.balance) || 0,
            totalInvoices: Number(c.total_invoices) || 0,
            totalSpent: Number(c.total_spent) || 0,
          })),
          invoices: iRes.rows.map((inv) => ({
            id: inv.id,
            invoiceNumber: inv.invoice_number,
            date: inv.date,
            customerId: inv.customer_id,
            customerName: inv.customer_name,
            customerPhone: inv.customer_phone,
            items: typeof inv.items === 'string' ? JSON.parse(inv.items) : (inv.items || []),
            totalAmount: Number(inv.total_amount) || 0,
            subtotal: Number(inv.total_amount) || 0,
            discount: Number(inv.discount) || 0,
            tax: Number(inv.tax) || 0,
            finalAmount: Number(inv.final_amount) || 0,
            finalTotal: Number(inv.final_amount) || 0,
            status: inv.status,
          })),
          settings: {
            warehouses: wRes.rows.map((w) => ({
              id: w.id,
              name: w.name,
              code: w.code,
              phone: w.phone,
              managerName: w.manager_name,
              address: w.address,
              isDefault: w.is_default,
            })),
          },
          revision: 1,
          updatedAt: new Date().toISOString(),
        };
      }
    } catch (_) {}
  } catch (err: any) {
    isConnected = false;
    console.warn('[PostgreSQL Load Notice]:', err.message);
  } finally {
    if (client) {
      client.release();
    }
  }
  return null;
}

// Save full state into PostgreSQL with ACID transaction
export async function saveStateToPostgres(data: any): Promise<boolean> {
  const currentPool = getPostgresPool();
  if (!currentPool) {
    lastPostgresSaveError = 'استخر کانکشن‌های PostgreSQL آماده نیست.';
    return false;
  }

  let client: pg.PoolClient | null = null;
  try {
    client = await currentPool.connect();
    isConnected = true;

    // Guarantee all tables exist safely before any queries or transactions
    await initSchema(client);
    dbInitialized = true;

    await client.query('BEGIN');

    // 1. Update JSONB system_state (Core authoritative state)
    const rev = typeof data.revision === 'number' ? data.revision : 1;
    await client.query(
      `INSERT INTO system_state (id, data, revision, checksum, updated_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (id) DO UPDATE 
       SET data = $2, revision = $3, checksum = $4, updated_at = NOW()`,
      ['main_store_data', JSON.stringify(data), rev, data.checksum || '']
    );

    // 2. Persist tombstones to deleted_tombstones table if present
    if (data.tombstones && typeof data.tombstones === 'object') {
      for (const [entityType, ids] of Object.entries(data.tombstones)) {
        if (Array.isArray(ids)) {
          for (const entityId of ids) {
            if (typeof entityId === 'string' && entityId.trim()) {
              try {
                await client.query(
                  `INSERT INTO deleted_tombstones (entity_type, entity_id, deleted_at)
                   VALUES ($1, $2, NOW())
                   ON CONFLICT (entity_type, entity_id) DO NOTHING`,
                  [entityType, entityId.trim()]
                );
              } catch (_) {}
            }
          }
        }
      }
    }

    // 3. Remove deleted entities from relational tables
    if (Array.isArray(data.deletedInvoiceIds) && data.deletedInvoiceIds.length > 0) {
      await client.query(`DELETE FROM invoices WHERE id = ANY($1)`, [data.deletedInvoiceIds]);
    }
    if (data.tombstones?.invoices && Array.isArray(data.tombstones.invoices) && data.tombstones.invoices.length > 0) {
      await client.query(`DELETE FROM invoices WHERE id = ANY($1)`, [data.tombstones.invoices]);
    }
    if (data.tombstones?.products && Array.isArray(data.tombstones.products) && data.tombstones.products.length > 0) {
      await client.query(`DELETE FROM products WHERE id = ANY($1)`, [data.tombstones.products]);
    }
    if (data.tombstones?.customers && Array.isArray(data.tombstones.customers) && data.tombstones.customers.length > 0) {
      await client.query(`DELETE FROM customers WHERE id = ANY($1)`, [data.tombstones.customers]);
    }

    // 4. Sync active records to relational tables using savepoint to guarantee zero-crash on edge-case data
    try {
      await client.query('SAVEPOINT relational_sync');

      // Warehouses
      const warehouses = Array.isArray(data.settings?.warehouses)
        ? data.settings.warehouses
        : (Array.isArray(data.warehouses) ? data.warehouses : []);
      if (warehouses.length > 0) {
        for (const w of warehouses) {
          if (!w || !w.id) continue;
          await client.query(
            `INSERT INTO warehouses (id, name, code, phone, manager_name, address, is_default, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
             ON CONFLICT (id) DO UPDATE
             SET name = $2, code = $3, phone = $4, manager_name = $5, address = $6, is_default = $7, updated_at = NOW()`,
            [w.id, w.name || '', w.code || '', w.phone || '', w.managerName || '', w.address || '', !!w.isDefault]
          );
        }
      }

      // Products
      if (Array.isArray(data.products) && data.products.length > 0) {
        for (const p of data.products) {
          if (!p || !p.id) continue;
          await client.query(
            `INSERT INTO products (id, name, barcode, category, unit, stock, min_stock_alert, purchase_price, sell_price, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
             ON CONFLICT (id) DO UPDATE
             SET name = $2, barcode = $3, category = $4, unit = $5, stock = $6, min_stock_alert = $7, purchase_price = $8, sell_price = $9, updated_at = NOW()`,
            [
              p.id,
              p.name || 'کالای بدون نام',
              p.barcode || p.code || '',
              p.category || '',
              p.unit || 'عدد',
              Number(p.stock) || 0,
              Number(p.minStockAlert) || 5,
              Number(p.buyPrice || p.purchasePrice) || 0,
              Number(p.sellPrice) || 0,
            ]
          );
        }
      }

      // Customers
      if (Array.isArray(data.customers) && data.customers.length > 0) {
        for (const c of data.customers) {
          if (!c || !c.id) continue;
          await client.query(
            `INSERT INTO customers (id, name, phone, address, national_id, economic_code, postal_code, balance, total_invoices, total_spent)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
             ON CONFLICT (id) DO UPDATE
             SET name = $2, phone = $3, address = $4, national_id = $5, economic_code = $6, postal_code = $7, balance = $8, total_invoices = $9, total_spent = $10`,
            [
              c.id,
              c.name || 'مشتری',
              c.phone || '',
              c.address || '',
              c.nationalId || '',
              c.economicCode || '',
              c.postalCode || '',
              Number(c.balance) || 0,
              Number(c.totalInvoices) || 0,
              Number(c.totalSpent) || 0,
            ]
          );
        }
      }

      // Invoices
      if (Array.isArray(data.invoices) && data.invoices.length > 0) {
        for (const inv of data.invoices) {
          if (!inv || !inv.id) continue;
          await client.query(
            `INSERT INTO invoices (id, invoice_number, date, customer_id, customer_name, customer_phone, items, total_amount, discount, tax, final_amount, status)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
             ON CONFLICT (id) DO UPDATE
             SET invoice_number = $2, date = $3, customer_id = $4, customer_name = $5, customer_phone = $6, items = $7, total_amount = $8, discount = $9, tax = $10, final_amount = $11, status = $12`,
            [
              inv.id,
              inv.invoiceNumber || inv.id,
              inv.date || '',
              inv.customerId || '',
              inv.customerName || '',
              inv.customerPhone || '',
              JSON.stringify(inv.items || []),
              Number(inv.subtotal || inv.totalAmount || 0),
              Number(inv.totalDiscount || inv.discount || 0),
              Number(inv.taxAmount || inv.tax || 0),
              Number(inv.finalTotal || inv.finalAmount || 0),
              inv.paymentStatus || inv.status || 'completed',
            ]
          );
        }
      }

      await client.query('RELEASE SAVEPOINT relational_sync');
    } catch (relationalErr: any) {
      console.warn('[PostgreSQL Relational Tables Sync Warning - system_state is safe]:', relationalErr.message);
      try {
        await client.query('ROLLBACK TO SAVEPOINT relational_sync');
      } catch (_) {}
    }

    await client.query('COMMIT');
    isConnected = true;
    lastPostgresSaveError = null;
    return true;
  } catch (err: any) {
    if (client) {
      try {
        await client.query('ROLLBACK');
      } catch (_) {}
    }
    lastPostgresSaveError = err.message || 'خطای نامشخص در ثبت اطلاعات در دیتابیس PostgreSQL';
    console.error('[PostgreSQL Save Notice Error]:', err.message);
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
  if (typeof val === 'object') return `'${JSON.stringify(val).replace(/\0/g, '').replace(/'/g, "''")}'::jsonb`;
  return `'${String(val).replace(/\0/g, '').replace(/'/g, "''")}'`;
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
  invoice_number VARCHAR(100) NOT NULL,
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

CREATE TABLE IF NOT EXISTS deleted_tombstones (
  entity_type VARCHAR(100) NOT NULL,
  entity_id VARCHAR(150) NOT NULL,
  deleted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (entity_type, entity_id)
);

-- Ensure invoice_number unique constraint is removed to allow drafts/revisions without conflict
DO $$ BEGIN
  ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_invoice_number_key;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;\n`);

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
VALUES (${escapeSqlString(w.id)}, ${escapeSqlString(w.name)}, ${escapeSqlString(w.code)}, ${escapeSqlString(w.phone)}, ${escapeSqlString(w.managerName || w.manager_name)}, ${escapeSqlString(w.address)}, ${w.isDefault || w.is_default ? 'TRUE' : 'FALSE'}, CURRENT_TIMESTAMP)
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
VALUES (${escapeSqlString(p.id)}, ${escapeSqlString(p.name)}, ${escapeSqlString(p.barcode || p.code)}, ${escapeSqlString(p.category)}, ${escapeSqlString(p.unit || 'عدد')}, ${Number(p.stock) || 0}, ${Number(p.minStockAlert || p.min_stock_alert) || 5}, ${Number(p.buyPrice || p.purchase_price || p.purchasePrice) || 0}, ${Number(p.sellPrice || p.sell_price) || 0}, CURRENT_TIMESTAMP)
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
VALUES (${escapeSqlString(c.id)}, ${escapeSqlString(c.name)}, ${escapeSqlString(c.phone)}, ${escapeSqlString(c.address)}, ${escapeSqlString(c.nationalId || c.national_id)}, ${escapeSqlString(c.economicCode || c.economic_code)}, ${escapeSqlString(c.postalCode || c.postal_code)}, ${Number(c.balance) || 0}, ${Number(c.totalInvoices || c.total_invoices) || 0}, ${Number(c.totalSpent || c.total_spent) || 0})
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
VALUES (${escapeSqlString(inv.id)}, ${escapeSqlString(inv.invoiceNumber || inv.invoice_number || inv.id)}, ${escapeSqlString(inv.date)}, ${escapeSqlString(inv.customerId || inv.customer_id)}, ${escapeSqlString(inv.customerName || inv.customer_name)}, ${escapeSqlString(inv.customerPhone || inv.customer_phone)}, ${escapeSqlString(inv.items || [])}, ${Number(inv.subtotal || inv.totalAmount || inv.total_amount) || 0}, ${Number(inv.totalDiscount || inv.discount) || 0}, ${Number(inv.taxAmount || inv.tax) || 0}, ${Number(inv.finalTotal || inv.finalAmount || inv.final_amount) || 0}, ${escapeSqlString(inv.paymentStatus || inv.status || 'completed')})
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
  lines.push(`-- Safe PostgreSQL Export Completed Successfully.`);
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

// Safely dump current PostgreSQL or converged state without blocking active live transactions
// Uses REPEATABLE READ READ ONLY to take a point-in-time ACID snapshot without table lock escalation
export async function exportLiveDatabaseDump(fallbackDataGetter?: () => Promise<any>): Promise<{ sql: string; filename: string; timestamp: string }> {
  let liveData: any = null;
  let liveWarehouses: any[] = [];
  let liveProducts: any[] = [];
  let liveCustomers: any[] = [];
  let liveInvoices: any[] = [];
  const currentPool = getPostgresPool();

  if (currentPool) {
    let client: pg.PoolClient | null = null;
    try {
      client = await currentPool.connect();
      isConnected = true;

      // Guarantee all schema tables exist safely
      if (!dbInitialized) {
        await initSchema(client);
        dbInitialized = true;
      }

      // Use REPEATABLE READ READ ONLY: 100% read-only snapshot, zero write interference with live users
      await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');

      try {
        const res = await client.query('SELECT data FROM system_state WHERE id = $1', ['main_store_data']);
        if (res.rows.length > 0 && res.rows[0].data) {
          liveData = res.rows[0].data;
        }
      } catch (_) {}

      // Query live relational tables directly
      try {
        const [wRes, pRes, cRes, iRes] = await Promise.all([
          client.query('SELECT * FROM warehouses ORDER BY id'),
          client.query('SELECT * FROM products ORDER BY id'),
          client.query('SELECT * FROM customers ORDER BY id'),
          client.query('SELECT * FROM invoices ORDER BY id'),
        ]);
        liveWarehouses = wRes.rows;
        liveProducts = pRes.rows;
        liveCustomers = cRes.rows;
        liveInvoices = iRes.rows;
      } catch (_) {}

      await client.query('COMMIT');
    } catch (e: any) {
      if (client) {
        try {
          await client.query('ROLLBACK');
        } catch (_) {}
      }
      console.warn('[PostgreSQL Live Dump Read Warning]:', e.message);
    } finally {
      if (client) {
        client.release();
      }
    }
  }

  // If Postgres was offline or returned empty, fallback to reading server state (strictly READ-ONLY)
  if (!liveData && fallbackDataGetter) {
    try {
      liveData = await fallbackDataGetter();
    } catch {}
  }

  if (!liveData) {
    liveData = await loadStateFromPostgres();
  }

  if (!liveData || typeof liveData !== 'object') {
    liveData = {};
  }

  // If relational tables have records and liveData does not, augment liveData from relational tables
  if (liveWarehouses.length > 0 && (!Array.isArray(liveData.settings?.warehouses) || liveData.settings.warehouses.length === 0)) {
    if (!liveData.settings) liveData.settings = {};
    liveData.settings.warehouses = liveWarehouses.map((w) => ({
      id: w.id,
      name: w.name,
      code: w.code,
      phone: w.phone,
      managerName: w.manager_name,
      address: w.address,
      isDefault: w.is_default,
    }));
  }

  if (liveProducts.length > 0 && (!Array.isArray(liveData.products) || liveData.products.length === 0)) {
    liveData.products = liveProducts.map((p) => ({
      id: p.id,
      name: p.name,
      barcode: p.barcode,
      category: p.category,
      unit: p.unit,
      stock: Number(p.stock) || 0,
      minStockAlert: Number(p.min_stock_alert) || 5,
      buyPrice: Number(p.purchase_price) || 0,
      sellPrice: Number(p.sell_price) || 0,
      updatedAt: p.updated_at,
    }));
  }

  if (liveCustomers.length > 0 && (!Array.isArray(liveData.customers) || liveData.customers.length === 0)) {
    liveData.customers = liveCustomers.map((c) => ({
      id: c.id,
      name: c.name,
      phone: c.phone,
      address: c.address,
      nationalId: c.national_id,
      economicCode: c.economic_code,
      postalCode: c.postal_code,
      balance: Number(c.balance) || 0,
      totalInvoices: Number(c.total_invoices) || 0,
      totalSpent: Number(c.total_spent) || 0,
    }));
  }

  if (liveInvoices.length > 0 && (!Array.isArray(liveData.invoices) || liveData.invoices.length === 0)) {
    liveData.invoices = liveInvoices.map((inv) => ({
      id: inv.id,
      invoiceNumber: inv.invoice_number,
      date: inv.date,
      customerId: inv.customer_id,
      customerName: inv.customer_name,
      customerPhone: inv.customer_phone,
      items: typeof inv.items === 'string' ? JSON.parse(inv.items) : (inv.items || []),
      totalAmount: Number(inv.total_amount) || 0,
      subtotal: Number(inv.total_amount) || 0,
      discount: Number(inv.discount) || 0,
      tax: Number(inv.tax) || 0,
      finalAmount: Number(inv.final_amount) || 0,
      finalTotal: Number(inv.final_amount) || 0,
      status: inv.status,
    }));
  }

  const nowIso = new Date().toISOString();
  const sql = generatePostgresSqlDump(liveData);
  const filename = `mana_db_${nowIso.replace(/[:.]/g, '-')}.sql`;

  return { sql, filename, timestamp: nowIso };
}

