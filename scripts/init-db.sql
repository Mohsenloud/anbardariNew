-- ==============================================================================
-- پایگاه‌داده اختصاصی سامانه مدیریت فاکتور، انبارداری و حسابداری (mana_db)
-- PostgreSQL Database Initialization Script for mana_db
-- ==============================================================================

-- ۱. ساخت جدول وضعیت و پایگاه‌داده متمرکز سیستم (System State & Snapshot)
CREATE TABLE IF NOT EXISTS system_state (
    id VARCHAR(50) PRIMARY KEY,
    data JSONB NOT NULL,
    revision INT DEFAULT 1,
    checksum VARCHAR(100),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ۲. جدول انبارهای سازمانی و شعب (Warehouses)
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

-- ۳. جدول محصولات، انبار و موجودی (Products & Inventory)
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

-- ۴. جدول مشتریان و طرف‌های حساب (Customers)
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

-- ۵. جدول فاکتورهای فروش و خروج کالا (Invoices)
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
    payment_method VARCHAR(50) DEFAULT 'cash',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ۶. جدول گردش کالا و حواله‌های ورود/خروج (Stock Movements)
CREATE TABLE IF NOT EXISTS stock_movements (
    id VARCHAR(100) PRIMARY KEY,
    product_id VARCHAR(100),
    product_name VARCHAR(300) NOT NULL,
    warehouse_id VARCHAR(100),
    movement_type VARCHAR(50) NOT NULL, -- in / out / transfer / adjust
    quantity NUMERIC(12, 2) NOT NULL,
    reference_id VARCHAR(100),
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ۷. جدول پشتیبان‌های خودکار و دوره‌ای سیستم (System Backups)
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

-- ایندکس‌ها برای سرعت جستجو و کارایی بالا
CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_invoices_number ON invoices(invoice_number);
CREATE INDEX IF NOT EXISTS idx_invoices_date ON invoices(date);
