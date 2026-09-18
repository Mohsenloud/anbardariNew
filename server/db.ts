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
    return {
      success: false,
      connected: false,
      database: currentDb,
      host: currentHost,
      user: currentUser,
      latencyMs,
      message: `خطای عدم امکان اتصال به PostgreSQL (${err.code || err.message})`,
      guide: 'در محیط لوکال یا سرور، اطمینان حاصل کنید دستور docker compose up -d اجرا شده و کانتینر mana_postgres_db در حال اجراست.',
    };
  } finally {
    if (client) {
      client.release();
    }
  }
}
