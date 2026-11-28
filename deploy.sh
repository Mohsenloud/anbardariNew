#!/usr/bin/env bash
set -euo pipefail

SKIP_PULL=0
NO_CACHE_FLAG=""
FORWARD_ARGS=()

for arg in "$@"; do
  case "$arg" in
    --skip-pull)
      SKIP_PULL=1
      ;;
    --no-cache|--fresh)
      NO_CACHE_FLAG="--no-cache"
      FORWARD_ARGS+=("$arg")
      ;;
    *)
      FORWARD_ARGS+=("$arg")
      ;;
  esac
done

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

# ۱. دریافت آخرین تغییرات کد از گیت قبل از ساخت کانتینر (با پشتیبانی از آپدیت خودکار اسکریپت deploy.sh)
if [ "$SKIP_PULL" -eq 0 ] && [ -d ".git" ]; then
  git config core.filemode false || true
  CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "main")
  BEFORE_DEPLOY_HASH=$(sha256sum deploy.sh 2>/dev/null | awk '{print $1}' || true)

  echo "📥 دریافت آخرین تغییرات از مخزن Git (شاخه: ${CURRENT_BRANCH})..."
  if ! git pull --ff-only origin "${CURRENT_BRANCH}"; then
    echo "❌ خطا در دریافت تغییرات از گیت (ممکن است فایل‌های لوکال تغییر کرده باشند)."
    echo "🔎 وضعیت فعلی گیت:"
    git status -s || true
    exit 1
  fi

  chmod +x deploy.sh reset-admin.sh 2>/dev/null || true
  AFTER_DEPLOY_HASH=$(sha256sum deploy.sh 2>/dev/null | awk '{print $1}' || true)

  if [ -n "$BEFORE_DEPLOY_HASH" ] && [ -n "$AFTER_DEPLOY_HASH" ] && [ "$BEFORE_DEPLOY_HASH" != "$AFTER_DEPLOY_HASH" ]; then
    echo "🔄 اسکریپت deploy.sh در مخزن بروزرسانی شد؛ در حال اجرای نسخه جدید اسکریپت..."
    exec "$0" --skip-pull "${FORWARD_ARGS[@]}"
  fi
fi

# ۲. اطمینان از وجود پوشه دیتابیس و بکاپ روی هاست
mkdir -p ./data/backups

# ۳. راه‌اندازی هوشمند فایل .env فقط در نصب کاملاً جدید (بدون شکستن دیتابیس‌های قبلی)
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

# ۴. بارگذاری ایمن متغیرهای .env برای بررسی پورت، آدرس و نام دیتابیس
read_env_var() {
  local key="$1"
  local fallback="$2"
  if [ -f ".env" ]; then
    local val
    val=$(grep -E "^${key}=" .env | tail -n1 | cut -d'=' -f2- | sed 's/[[:space:]]*#.*$//' | tr -d '\r"' | tr -d "'" | xargs || true)
    if [ -n "$val" ]; then
      echo "$val"
      return
    fi
  fi
  echo "$fallback"
}

APP_PORT_VAL=$(read_env_var "APP_PORT" "3000")
BIND_IP_VAL=$(read_env_var "BIND_IP" "0.0.0.0")
PG_USER_VAL=$(read_env_var "POSTGRES_USER" "mana_user")
PG_DB_VAL=$(read_env_var "POSTGRES_DB" "mana_db")

CHECK_HOST="127.0.0.1"
if [ "$BIND_IP_VAL" != "0.0.0.0" ] && [ "$BIND_IP_VAL" != "::" ] && [ -n "$BIND_IP_VAL" ]; then
  CHECK_HOST="$BIND_IP_VAL"
fi

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

# ۵. ایجاد کپی پشتیبان اضطراری قبل از آپدیت (JSON + PostgreSQL SQL Dump)
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

# ۶. اطمینان از آماده بودن PostgreSQL و ساخت نسخه جدید اپلیکیشن
echo "🐘 بررسی و راه‌اندازی پایگاه‌داده PostgreSQL..."
docker compose up -d postgres

echo "🔨 در حال بیلد نسخه جدید سامانه (فرانت‌اند + سرور)..."
if [ -n "$NO_CACHE_FLAG" ]; then
  docker compose build --no-cache app
else
  docker compose build app
fi

echo "⚡ در حال جایگزینی و اجرای کانتینر جدید اپلیکیشن..."
docker compose up -d --force-recreate --no-deps app

# ۷. انتظار تا آماده شدن کانتینر app و سپس بروزرسانی Nginx + پاکسازی کش استاتیک
echo "⏳ در حال انتظار برای آماده شدن سرویس اپلیکیشن..."
APP_READY=0
for i in $(seq 1 30); do
  APP_HEALTH=$(docker inspect --format='{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' mana_factor_app 2>/dev/null || echo "starting")
  if [ "$APP_HEALTH" = "healthy" ]; then
    APP_READY=1
    break
  fi
  sleep 2
done

echo "🌐 در حال بروزرسانی Nginx و پاکسازی کش استاتیک..."
docker compose up -d --force-recreate --remove-orphans nginx
docker exec mana_nginx_proxy sh -c "rm -rf /tmp/nginx_static_cache/* && nginx -s reload" 2>/dev/null || true

# ۸. بررسی سلامت نهایی سرویس از طریق Nginx روی پورت هاست (حداکثر ۳۰ ثانیه)
echo "🩺 در حال بررسی سلامت سرویس روی http://${CHECK_HOST}:${APP_PORT_VAL}..."
HEALTH_OK=0
for i in $(seq 1 15); do
  if command -v curl >/dev/null 2>&1; then
    if curl -fsS "http://${CHECK_HOST}:${APP_PORT_VAL}/api/health" >/dev/null 2>&1; then
      HEALTH_OK=1
      break
    fi
  elif command -v wget >/dev/null 2>&1; then
    if wget -qO- "http://${CHECK_HOST}:${APP_PORT_VAL}/api/health" >/dev/null 2>&1; then
      HEALTH_OK=1
      break
    fi
  elif [ "$APP_READY" -eq 1 ]; then
    HEALTH_OK=1
    break
  fi
  sleep 2
done

# ۹. پاکسازی ایمیج‌های بلااستفاده قدیمی جهت آزادسازی فضای دیسک VPS
docker image prune -f >/dev/null 2>&1 || true

echo "====================================================="
if [ "$HEALTH_OK" -eq 1 ]; then
  echo "✅ نصب / بروزرسانی با موفقیت انجام شد و سرور کاملاً سالم است!"
  echo "🌐 آدرس محلی: http://${CHECK_HOST}:${APP_PORT_VAL}"
  echo "💡 نکته: در صورت نصب PWA روی مرورگر، یک بار صفحه را رفرش (Ctrl+F5) کنید تا آخرین تغییرات فوراً بارگذاری شود."
else
  echo "⚠️ کانتینرها اجرا شدند اما پاسخ سلامت روی پورت ${APP_PORT_VAL} هنوز آماده نیست."
  echo "🔎 برای بررسی لاگ‌ها اجرا کنید: docker compose logs -f --tail=100 app nginx"
fi
echo "====================================================="

