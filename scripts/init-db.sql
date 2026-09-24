-- Initial PostgreSQL schema for mana_db in Docker
CREATE TABLE IF NOT EXISTS system_state (
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
  payment_status VARCHAR(50) DEFAULT 'unpaid',
  paid_amount NUMERIC(15, 2) DEFAULT 0,
  is_proforma BOOLEAN DEFAULT FALSE,
  tax_percent NUMERIC(5, 2) DEFAULT 0,
  discount_amount NUMERIC(15, 2) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS activity_logs (
  id VARCHAR(100) PRIMARY KEY,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  jalali_date VARCHAR(50),
  jalali_time VARCHAR(50),
  user_name VARCHAR(150),
  user_role VARCHAR(50),
  category VARCHAR(100),
  action_type VARCHAR(100),
  action_title VARCHAR(250),
  details TEXT,
  metadata JSONB
);

CREATE TABLE IF NOT EXISTS deleted_tombstones (
  entity_type VARCHAR(50) NOT NULL,
  entity_id VARCHAR(150) NOT NULL,
  deleted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (entity_type, entity_id)
);
