#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# اسکریپت بازیابی اضطراری رمز عبور ادمین روی سرور VPS
# نحوه استفاده:
#   ./reset-admin.sh
#   ./reset-admin.sh "NewStrongPassword"
#   ./reset-admin.sh "NewStrongPassword" "admin"
# ==============================================================================

NEW_PASS="${1:-}"
ADMIN_USER="${2:-admin}"

if [ -z "$NEW_PASS" ]; then
  read -rsp "🔑 رمز عبور جدید برای کاربر «${ADMIN_USER}» را وارد کنید (حداقل ۴ کاراکتر): " NEW_PASS
  echo ""
  read -rsp "🔁 تکرار رمز عبور جدید: " CONFIRM_PASS
  echo ""
  if [ "$NEW_PASS" != "$CONFIRM_PASS" ]; then
    echo "❌ رمز عبور و تکرار آن یکسان نیستند."
    exit 1
  fi
fi

if [ "${#NEW_PASS}" -lt 4 ]; then
  echo "❌ رمز عبور باید حداقل ۴ کاراکتر باشد."
  exit 1
fi

echo "🔐 در حال بازنشانی امن رمز عبور ادمین (با الگوریتم scrypt در فایل محلی و PostgreSQL)..."

if command -v docker >/dev/null 2>&1 && docker ps --format '{{.Names}}' | grep -qx 'mana_factor_app'; then
  # اجرای مستقیم داخل کانتینر فعال (دسترسی خودکار به PostgreSQL و /app/data)
  docker exec -i mana_factor_app node --input-type=module - --username "$ADMIN_USER" --password "$NEW_PASS" < ./scripts/reset-admin-password.mjs
  echo "🔄 در حال ریستارت سریع کانتینر اپلیکیشن برای پاکسازی قفل ورود و بارگذاری فوری..."
  docker compose restart app >/dev/null 2>&1 || docker restart mana_factor_app >/dev/null 2>&1 || true
else
  # اجرای مستقیم روی هاست در صورت نبود داکر
  if ! command -v node >/dev/null 2>&1; then
    echo "❌ نه کانتینر mana_factor_app در حال اجراست و نه Node.js روی هاست نصب است."
    exit 1
  fi
  node ./scripts/reset-admin-password.mjs --username "$ADMIN_USER" --password "$NEW_PASS"
fi

echo "====================================================="
echo "✅ بازنشانی رمز عبور با موفقیت انجام شد!"
echo "👤 نام کاربری: ${ADMIN_USER}"
echo "🌐 اکنون می‌توانید با رمز جدید وارد سامانه شوید."
echo "====================================================="
