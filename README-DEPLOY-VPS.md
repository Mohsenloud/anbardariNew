# راهنمای کامل نصب، امن‌سازی و نگهداری روی سرور لینوکس (VPS)

این راهنما نحوه استقرار امن سامانه با معماری **۳ کانتینر Docker** (`PostgreSQL 16` + `Express/React App` + `Nginx Proxy`)، تنظیم **دامنه و SSL رایگان**، **فایروال سرور**، **پشتیبان‌گیری خودکار** و **بروزرسانی با یک دستور** را شرح می‌دهد.

---

## ۱. پیش‌نیازها
- سرور مجازی (VPS) با **Ubuntu 22.04 LTS** یا **Ubuntu 24.04 LTS** (حداقل ۱ گیگابایت رم و ۱۰ گیگابایت فضای دیسک)
- دسترسی SSH با `root` یا کاربر دارای `sudo`
- دامنه یا ساب‌دامنه متصل به IP سرور (مثال: `factor.yourdomain.com`)

---

## ۲. آماده‌سازی سرور VPS (نصب Docker، Git و فایروال)

```bash
ssh root@YOUR_SERVER_IP

# بروزرسانی بسته‌ها و نصب ابزارهای پایه
apt update && apt upgrade -y
apt install -y curl git openssl ufw

# نصب رسمی Docker و پلاگین Docker Compose v2
curl -fsSL https://get.docker.com | sh
apt install -y docker-compose-plugin

# بررسی نصب صحیح
docker --version
docker compose version
```

### فعال‌سازی فایروال UFW (توصیه‌شده)
```bash
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
# اگر قصد استفاده از Nginx روی هاست + SSL دارید، پورت 3000 را روی اینترنت باز نکنید.
# (فقط در صورتی که مستقیم بدون SSL روی پورت 3000 دسترسی می‌خواهید: ufw allow 3000/tcp)
ufw --force enable
ufw status
```

---

## ۳. کلون پروژه و پیکربندی امن `.env`

```bash
mkdir -p /var/www/app
cd /var/www/app
git clone https://github.com/YOUR_USERNAME/YOUR_REPO.git .
chmod +x deploy.sh
```

### ساخت فایل `.env`
شما دو روش دارید:
- **روش خودکار (پیشنهادی برای نصب اول):** کافیست `./deploy.sh` را اجرا کنید تا فایل `.env` به‌صورت خودکار از روی `.env.example` با رمزهای تصادفی امن (`POSTGRES_PASSWORD` و `SESSION_SECRET`) ساخته شود.
- **روش دستی:**
```bash
cp .env.example .env
nano .env
```
مقادیر کلیدی در `.env`:
```env
APP_URL="https://factor.yourdomain.com"
POSTGRES_PASSWORD="یک_رمز_طولانی_و_تصادفی"
SESSION_SECRET="خروجی_openssl_rand_-hex_32"
# اگر از Nginx روی هاست + SSL استفاده می‌کنید، پورت داکر را به لوکال‌هاست محدود کنید:
BIND_IP="127.0.0.1"
APP_PORT="3000"
```

---

## ۴. اجرا و بررسی سلامت سرویس‌ها

```bash
cd /var/www/app
./deploy.sh
```

بررسی وضعیت کانتینرها و سلامت سرور:
```bash
docker compose ps
curl -s http://127.0.0.1:3000/api/health
```

در حالت سالم، هر ۳ کانتینر زیر باید `healthy` باشند:
1. `mana_postgres_db` (پایگاه‌داده PostgreSQL 16، ایزوله در شبکه داخلی داکر)
2. `mana_factor_app` (بک‌اند Node.js + فرانت‌اند بیلدشده، با زمان تهران `Asia/Tehran`)
3. `mana_nginx_proxy` (Reverse Proxy داخلی با فشرده‌سازی Gzip و مدیریت کش PWA)

---

## ۵. تنظیم دامنه و SSL رایگان (Nginx هاست + Let's Encrypt)

برای دسترسی امن با `https://factor.yourdomain.com` و فعال‌سازی وبهوک تلگرام:

```bash
apt install -y nginx certbot python3-certbot-nginx

# کپی نمونه کانفیگ آماده و جایگزینی نام دامنه
cp /var/www/app/nginx-vps-host.conf.example /etc/nginx/sites-available/factor.conf
sed -i 's/factor.yourdomain.com/YOUR_DOMAIN_HERE/g' /etc/nginx/sites-available/factor.conf

ln -sf /etc/nginx/sites-available/factor.conf /etc/nginx/sites-enabled/factor.conf
rm -f /etc/nginx/sites-enabled/default

nginx -t && systemctl reload nginx

# صدور و تنظیم خودکار گواهی SSL رایگان
certbot --nginx -d YOUR_DOMAIN_HERE
```

> **نکته امنیتی:** پس از فعال شدن HTTPS، مقدار `BIND_IP="127.0.0.1"` و `APP_URL="https://YOUR_DOMAIN_HERE"` را در `.env` قرار داده و مجدداً `docker compose up -d` بزنید تا ترافیک فقط از مسیر رمزنگاری‌شده HTTPS عبور کند.

---

## ۶. نگهداری اطلاعات، پایگاه‌داده و پشتیبان‌گیری

داده‌های سامانه به‌صورت همزمان و امن در دو لایه نگهداری می‌شوند:
1. **پایگاه‌داده PostgreSQL 16:** در Volume دائمی `postgres_data` داکر ذخیره می‌شود و با آپدیت یا ریستارت کانتینرها از بین نمی‌رود.
2. **فایل پشتیبان و اسنپ‌شات محلی:** در مسیر `/var/www/app/data/` (`database.json`، پوشه `backups/` و کلید نشست `.session_secret`) ذخیره می‌شود.

### گرفتن بکاپ دستی از PostgreSQL در ترمینال VPS:
```bash
docker exec mana_postgres_db pg_dump -U mana_user -d mana_db | gzip > /var/www/app/data/backups/manual_$(date +%Y%m%d_%H%M%S).sql.gz
```

---

## ۷. بروزرسانی نسخه‌های بعدی (بدون قطعی و همراه با بکاپ خودکار)

پس از پوش کردن تغییرات جدید به گیت‌هاب، روی سرور فقط اجرا کنید:

```bash
cd /var/www/app
./deploy.sh
```

اسکریپت `deploy.sh` به‌صورت خودکار:
1. از فایل `data/database.json` و پایگاه‌داده PostgreSQL (`pg_dump`) پشتیبان اضطراری می‌گیرد (و ۱۰ نسخه آخر را نگه می‌دارد).
2. آخرین کدها را از شاخه فعلی Git دریافت می‌کند (`git pull`).
3. کانتینر اپلیکیشن را بیلد و بدون خاموش کردن دیتابیس جایگزین می‌کند.
4. تنظیمات Nginx را ریلود کرده، سلامت `/api/health` را بررسی و ایمیج‌های قدیمی بلااستفاده را پاکسازی می‌کند.

---

## ۸. بازیابی رمز عبور ادمین (در صورت فراموشی)

دو روش امن برای بازیابی رمز مدیر سیستم در نظر گرفته شده است:

1. **از صفحه ورود (تلگرام مدیر):** در صورت فعال بودن ربات تلگرام در تنظیمات، روی گزینه **«فراموشی رمز عبور ادمین؟ بازیابی رمز»** کلیک کنید تا کد تأیید ۶ رقمی به تلگرام مدیر ارسال شود.
2. **از طریق ترمینال VPS (همیشه در دسترس):**
```bash
cd /var/www/app
chmod +x reset-admin.sh
./reset-admin.sh
# یا به‌صورت مستقیم با تعیین رمز جدید:
# ./reset-admin.sh "NewStrongPass2026"
```
این اسکریپت رمز جدید را با الگوریتم `scrypt` رمزنگاری کرده و همزمان در فایل `database.json` و پایگاه‌داده `PostgreSQL` ذخیره می‌کند.

---

## ۹. دستورات عیب‌یابی سریع

```bash
# مشاهده لاگ زنده اپلیکیشن
docker compose logs -f --tail=100 app

# مشاهده لاگ Nginx و PostgreSQL
docker compose logs -f --tail=100 nginx postgres

# ریستارت سریع فقط اپلیکیشن
docker compose restart app
```
