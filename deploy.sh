#!/usr/bin/env bash
set -euo pipefail

echo "====================================================="
echo "🚀 شروع فرآیند نصب / بروزرسانی ایمن سامانه فاکتور و انبارداری..."
echo "====================================================="

# ۰. بررسی پیش‌نیازهای Docker و Docker Compose
if ! command -v docker >/dev/null 2>&1; then
  echo "❌ خطا: Docker روی این سرور نصب نیست. ابتدا Docker را نصب کنید."
  exit 1
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "❌ خطا: پلاگین docker compose نصب نیست (apt install -y docker-compose-plugin)."
  exit 1
fi

# ۱. اطمینان از وجود پوشه دیتابیس و بکاپ روی هاست
mkdir -p ./data/backups

# ۲. راه‌اندازی هوشمند فایل .env فقط در نصب کاملاً جدید (بدون شکستن دیتابیس‌های قبلی)
if [ ! -f ".env" ] && [ -f ".env.example" ]; then
  EXISTING_PG=$(docker ps -a --format '{{.Names}}' | grep -x 'mana_postgres_db' || true)
  EXISTING_VOL=$(docker volume ls --format '{{.Name}}' | grep 'postgres_data$' || true)

  if [ -z "$EXISTING_PG" ] && [ -z "$EXISTING_VOL" ]; then
    echo "🔐 نصب اولیه شناسایی شد: ساخت خودکار فایل .env با رمزهای تصادفی امن..."
    cp .env.example .env

    if command -v openssl >/dev/null 2>&1; then
      RAND_DB_PASS=$(openssl rand -hex 20)
      RAND_SESSION_SECRET=$(openssl rand -hex 32)
    else
      RAND_DB_PASS=$(tr -dc 'A-Za-z0-9' </dev/urandom | head -c 28 || echo "ChangeMe_$(date +%s)")
      RAND_SESSION_SECRET=$(tr -dc 'A-Za-z0-9' </dev/urandom | head -c 48 || echo "Session_$(date +%s)")
    fi

    sed -i "s|CHANGE_ME_STRONG_DB_PASSWORD|${RAND_DB_PASS}|g" .env
    sed -i "s|^SESSION_SECRET=\"\"|SESSION_SECRET=\"${RAND_SESSION_SECRET}\"|g" .env
    chmod 600 .env
    echo "✅ فایل .env امن ساخته شد (مجوز 600). در صورت نیاز APP_URL و BIND_IP را در .env ویرایش کنید."
  else
    echo "⚠️ توجه: دیتابیس PostgreSQL قبلی بدون فایل .env شناسایی شد؛ برای جلوگیری از خطای رمز، .env به‌صورت خودکار تغییر داده نشد."
  fi
fi

# بارگذاری متغیرهای .env برای بررسی پورت و نام دیتابیس در این اسکریپت
APP_PORT_VAL="3000"
PG_USER_VAL="mana_user"
PG_DB_VAL="mana_db"
if [ -f ".env" ]; then
  APP_PORT_VAL=$(grep -E '^APP_PORT=' .env | tail -n1 | cut -d'=' -f2- | tr -d '"' | tr -d "'" || echo "3000")
  PG_USER_VAL=$(grep -E '^POSTGRES_USER=' .env | tail -n1 | cut -d'=' -f2- | tr -d '"' | tr -d "'" || echo "mana_user")
  PG_DB_VAL=$(grep -E '^POSTGRES_DB=' .env | tail -n1 | cut -d'=' -f2- | tr -d '"' | tr -d "'" || echo "mana_db")
  APP_PORT_VAL="${APP_PORT_VAL:-3000}"
  PG_USER_VAL="${PG_USER_VAL:-mana_user}"
  PG_DB_VAL="${PG_DB_VAL:-mana_db}"
fi

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

# ۳. ایجاد کپی پشتیبان اضطراری قبل از آپدیت (JSON + PostgreSQL SQL Dump)
if [ -f "./data/database.json" ]; then
  cp ./data/database.json "./data/backups/pre_deploy_${TIMESTAMP}.json"
  echo "✅ پشتیبان اضطراری فایل JSON ساخته شد: pre_deploy_${TIMESTAMP}.json"
fi

if docker ps --format '{{.Names}}' | grep -qx 'mana_postgres_db'; then
  if docker exec mana_postgres_db pg_dump -U "${PG_USER_VAL}" -d "${PG_DB_VAL}" 2>/dev/null | gzip > "./data/backups/pre_deploy_pg_${TIMESTAMP}.sql.gz"; then
    echo "✅ پشتیبان اضطراری PostgreSQL ساخته شد: pre_deploy_pg_${TIMESTAMP}.sql.gz"
  else
    rm -f "./data/backups/pre_deploy_pg_${TIMESTAMP}.sql.gz"
    echo "⚠️ امکان گرفتن pg_dump قبل از آپدیت نبود (فایل JSON محفوظ است)."
  fi
fi

# نگهداری حداکثر ۱۰ بکاپ اضطراری اخیر جهت جلوگیری از پر شدن دیسک
ls -1t ./data/backups/pre_deploy_*.json 2>/dev/null | tail -n +11 | xargs -r rm -f || true
ls -1t ./data/backups/pre_deploy_pg_*.sql.gz 2>/dev/null | tail -n +11 | xargs -r rm -f || true

# ۴. دریافت آخرین تغییرات کد از گیت (در صورت وجود مخزن Git)
if [ -d ".git" ]; then
  git config core.filemode false || true
  CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD || echo "main")
  echo "📥 دریافت آخرین تغییرات از مخزن Git (شاخه: ${CURRENT_BRANCH})..."
  git pull origin "${CURRENT_BRANCH}"
  chmod +x deploy.sh reset-admin.sh 2>/dev/null || true
fi

# ۵. بیلد سریع و بروزرسانی کانتینرها بدون خاموش کردن دیتابیس
echo "⚡ در حال ساخت نسخه جدید و راه‌اندازی کانتینرها..."
docker compose up -d --build --remove-orphans

# ۶. بارگذاری مجدد تنظیمات Nginx
docker exec mana_nginx_proxy nginx -s reload 2>/dev/null || true

# ۷. بررسی سلامت سرویس پس از راه‌اندازی (حداکثر ۳۰ ثانیه)
echo "🩺 در حال بررسی سلامت سرویس روی پورت ${APP_PORT_VAL}..."
HEALTH_OK=0
for i in $(seq 1 15); do
  if curl -fsS "http://127.0.0.1:${APP_PORT_VAL}/api/health" >/dev/null 2>&1; then
    HEALTH_OK=1
    break
  fi
  sleep 2
done

# ۸. پاکسازی ایمیج‌های بلااستفاده قدیمی جهت آزادسازی فضای دیسک VPS
docker image prune -f >/dev/null 2>&1 || true

echo "====================================================="
if [ "$HEALTH_OK" -eq 1 ]; then
  echo "✅ نصب / بروزرسانی با موفقیت انجام شد و سرور کاملاً سالم است!"
  echo "🌐 آدرس محلی: http://127.0.0.1:${APP_PORT_VAL}"
else
  echo "⚠️ کانتینرها اجرا شدند اما پاسخ سلامت روی پورت ${APP_PORT_VAL} هنوز آماده نیست."
  echo "🔎 برای بررسی لاگ‌ها اجرا کنید: docker compose logs -f --tail=100 app"
fi
echo "====================================================="
