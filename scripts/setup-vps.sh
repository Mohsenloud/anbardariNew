#!/usr/bin/env bash
# ==============================================================================
# اسکریپت نصب و راه‌اندازی خودکار سامانه روی اوبونتو / سرور مجازی VPS
# Auto-Installation & Setup Script for Ubuntu 22.04 / 24.04 LTS
# Database: PostgreSQL (mana_db)
# ==============================================================================

set -e

echo "--------------------------------------------------------"
echo "  شروع راه‌اندازی خودکار سامانه مدیریت فاکتور و انبار (mana_db)"
echo "--------------------------------------------------------"

# ۱. به‌روزرسانی مخازن لینوکس
echo "[1/6] به‌روزرسانی مخازن لینوکس..."
sudo apt-get update -y
sudo apt-get install -y curl git build-essential nginx postgresql postgresql-contrib

# ۲. نصب Node.js نسخه 20 LTS (در صورت عدم وجود)
if ! command -v node &> /dev/null; then
    echo "[2/6] نصب Node.js v20..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
else
    echo "[2/6] Node.js نسخه $(node -v) قبلاً نصب شده است."
fi

# ۳. نصب ابزار مدیریت پروسه PM2
echo "[3/6] بررسی و نصب PM2..."
sudo npm install -g pm2

# ۴. راه‌اندازی و ایجاد دیتابیس mana_db و کاربر mana_user در PostgreSQL
echo "[4/6] ساخت دیتابیس mana_db در PostgreSQL..."
sudo -u postgres psql <<EOF
DO \$\$
BEGIN
   IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'mana_user') THEN
      CREATE USER mana_user WITH ENCRYPTED PASSWORD 'ManaSecurePass_2026!';
   END IF;
END
\$\$;

SELECT 'CREATE DATABASE mana_db OWNER mana_user'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'mana_db')\gexec

GRANT ALL PRIVILEGES ON DATABASE mana_db TO mana_user;
\c mana_db
GRANT ALL ON SCHEMA public TO mana_user;
ALTER SCHEMA public OWNER TO mana_user;
EOF

echo "دیتابیس mana_db با موفقیت آماده شد."

# ۵. نصب وابستگی‌های برنامه و بیلد
echo "[5/6] نصب وابستگی‌های پروژه..."
npm install
npm run build

# ۶. راه‌اندازی با PM2
echo "[6/6] استارت پروژه با PM2..."
pm2 delete mana-app 2>/dev/null || true
DATABASE_URL="postgresql://mana_user:ManaSecurePass_2026!@localhost:5432/mana_db" \
PORT=3000 \
pm2 start dist/server.cjs --name "mana-app"

pm2 save
pm2 startup | tail -n 1 | bash 2>/dev/null || true

echo "--------------------------------------------------------"
echo "  نصب با موفقیت انجام شد!"
echo "  برنامه روی پورت 3000 و متصل به دیتابیس mana_db در حال اجراست."
echo "  وضعیت پروسه: pm2 status"
echo "--------------------------------------------------------"
