# سامانه جامع صدور فاکتور رسمی، انبارداری و حسابداری (با پشتیبانی از PostgreSQL mana_db)

این نرم‌افزار یک وب‌اپلیکیشن یکپارچه مبتنی بر **React + Vite + Express** و پایگاه‌داده قدرتمند **PostgreSQL (`mana_db`)** است که برای صدور فاکتورهای رسمی/عادی، صدور حواله خروج کالا و بارگیری، انبارداری چندگانه (Multi-Warehouse)، کاردکس کالا، مدیریت مشتریان، کاربران و سطوح دسترسی و پشتیبان‌گیری خودکار طراحی شده است.

---

## ⚡ روش اول و پیشنهادی: راه‌اندازی سریع با Docker Compose (دقیقاً با یک دستور)

در صورتی که روی سرورتان داکر نصب است، کلیه فرآیند ساخت کانتینر برنامه و کانتینر PostgreSQL (`mana_db`) به صورت خودکار با همان دستور همیشگی انجام می‌شود:

```bash
cd /var/www/app
docker compose down && git pull origin main && docker compose up -d --build
```

### مزایای اجرای داکری با این روش:
- **دیتابیس خودکار:** کانتینر `mana_postgres_db` به صورت مستقل بالا می‌آید و دیتابیس `mana_db` با انکودینگ UTF8 و جدول‌های اولیه را اتوماتیک می‌سازد.
- **ماندگاری ۱۰۰٪ اطلاعات (Persistence):** تمامی اطلاعات دیتابیس در والیوم `postgres_data` و فایل‌های پشتیبان در `./data` نگهداری می‌شوند؛ حتی با `docker compose down` یا ریبوت سرور هیچ داده‌ای از بین نمی‌رود.
- **هماهنگی زمان استارت:** کانتینر برنامه (`mana_factor_app`) فقط زمانی استارت می‌خورد که PostgreSQL کاملاً آماده دریافت کوئری باشد (`condition: service_healthy`).

برای مشاهده لاگ وضعیت برنامه و دیتابیس:
```bash
docker compose logs -f
```

---

## 🚀 روش دوم: استقرار مستقیم روی سرور اوبونتو (بدون داکر)

- **سیستم‌عامل پیشنهادی:** Ubuntu 22.04 LTS یا Ubuntu 24.04 LTS
- **حداقل سخت‌افزار:** ۱ تا ۲ هسته CPU، ۲ گیگابایت رم، ۲۰ گیگابایت فضای دیسک
- **بسته‌های نرم‌افزاری:** Node.js (نسخه 18 یا 20 به بالا)، PostgreSQL، Nginx، Git و PM2

---

## 🚀 راهنمای گام‌به‌گام استقرار (Deployment) بعد از پوش در گیت‌هاب

### گام ۱: پوش پروژه در مخزن گیت‌هاب (روی سیستم شخصی خودتان)
اگر تغییرات را اعمال کرده‌اید، با دستورات زیر پروژه را در گیت‌هاب پوش کنید:
```bash
git add .
git commit -m "feat: add postgresql mana_db support and deployment scripts"
git branch -M main
git push origin main
```

---

### گام ۲: اتصال به سرور مجازی (VPS) از طریق SSH
ترمینال را باز کرده و با مشخصات سرور خود وارد شوید:
```bash
ssh root@YOUR_SERVER_IP
```
*(به جای `YOUR_SERVER_IP`، آدرس آی‌پی سرور خود را وارد کنید)*

---

### گام ۳: به‌روزرسانی مخازن و نصب Node.js و ابزارهای پایه
دستورات زیر را به ترتیب روی سرور اجرا کنید:
```bash
# به‌روزرسانی بسته‌های سیستم
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git build-essential nginx

# نصب Node.js نسخه 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# بررسی نسخه‌ها
node -v
npm -v

# نصب ابزار مدیریت اجرای دائمی PM2
sudo npm install -g pm2
```

---

### گام ۴: نصب و پیکربندی پایگاه‌داده PostgreSQL و ایجاد `mana_db`

۱. نصب بسته PostgreSQL:
```bash
sudo apt install -y postgresql postgresql-contrib
sudo systemctl enable postgresql
sudo systemctl start postgresql
```

۲. ایجاد دیتابیس `mana_db` و کاربر اختصاصی:
```bash
sudo -u postgres psql
```

در خط فرمان PostgreSQL (`psql`) این دستورات را کپی و پیست کنید:
```sql
-- ایجاد کاربر با رمز عبور امن
CREATE USER mana_user WITH ENCRYPTED PASSWORD 'ManaSecurePass_2026!';

-- ساخت دیتابیس mana_db با انکودینگ UTF8 برای زبان فارسی
CREATE DATABASE mana_db OWNER mana_user ENCODING 'UTF8';

-- اعطای کلیه دسترسی‌ها
GRANT ALL PRIVILEGES ON DATABASE mana_db TO mana_user;

-- اتصال به mana_db و اعطای دسترسی اسکیما
\c mana_db
GRANT ALL ON SCHEMA public TO mana_user;
ALTER SCHEMA public OWNER TO mana_user;

-- خروج از محیط psql
\q
```

---

### گام ۵: کلون کردن سورس از گیت‌هاب روی سرور
پروژه را داخل پوشه استاندارد `/var/www/` یا دایرکتوری خانگی خود کلون کنید:
```bash
cd /var/www
# لینک ریپازیتوری خود در گیت‌هاب را جایگزین کنید:
git clone https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git factor-app
cd factor-app
```

---

### گام ۶: تنظیم فایل متغیرهای محیطی (`.env`)
فایل تنظیمات محیطی را ایجاد کنید:
```bash
cp .env.example .env
nano .env
```
اطمینان حاصل کنید متغیر `DATABASE_URL` به درستی تنظیم شده است:
```env
PORT=3000
NODE_ENV=production
DATABASE_URL=postgresql://mana_user:ManaSecurePass_2026!@localhost:5432/mana_db
```
*(برای ذخیره در ویرایشگر nano کلید `Ctrl + O` و سپس `Enter` و برای خروج `Ctrl + X` را بزنید)*

---

### گام ۷: نصب وابستگی‌ها و کامپایل بیلد نهایی
```bash
npm install
npm run build
```
*(این دستور فرانت‌اند React را داخل `dist/` و سرور بک‌اند را به صورت باندل بهینه‌سازی‌شده داخل `dist/server.cjs` کامپایل می‌کند)*

---

### گام ۸: اجرای خودکار و دائمی با PM2 (Keep-Alive)
برای اینکه برنامه همیشه فعال باشد و با ری‌استارت سرور قطع نشود:
```bash
# راه‌اندازی سرویس با PM2
pm2 start dist/server.cjs --name "mana-app"

# ذخیره تنظیمات برای بوت خودکار سرور
pm2 save
pm2 startup
```
*(دستوری که `pm2 startup` در خروجی به شما پیشنهاد می‌دهد را کپی و اجرا کنید)*

برای مشاهده لاگ‌ها و وضعیت برنامه:
```bash
pm2 status
pm2 logs mana-app
```

---

### گام ۹: تنظیم وب‌سرور Nginx (برای اتصال دامنه و پورت 80 / 443)
فایل کانفیگ Nginx را ایجاد کنید:
```bash
sudo nano /etc/nginx/sites-available/factor.conf
```
محتوای زیر را داخل آن قرار دهید (اگر دامنه دارید نام آن و در غیر این صورت آی‌پی سرور را بنویسید):
```nginx
server {
    listen 80;
    server_name your-domain.com; # یا آی‌پی سرور شما

    client_max_body_size 50M;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

فعال‌سازی کانفیگ و بارگذاری مجدد Nginx:
```bash
sudo ln -s /etc/nginx/sites-available/factor.conf /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

---

### گام ۱۰: فعال‌سازی SSL رایگان (اختیاری ولی اکیداً پیشنهادی)
اگر روی سرور خود دامنه ست کرده‌اید:
```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```
سرتیفیکیت SSL به صورت کاملاً خودکار روی دامنه شما فعال شده و سایت با `https://` باز خواهد شد.

---

## ⚡ به‌روزرسانی پروژه در آینده (Update Workflow)
هر زمان تغییراتی در پروژه ایجاد کرده و در گیت‌هاب پوش کردید، برای به‌روزرسانی روی سرور فقط این ۴ دستور را بزنید:
```bash
cd /var/www/factor-app
git pull origin main
npm install
npm run build
pm2 restart mana-app
```

---

## 🛡️ بکاپ‌گیری روزانه از دیتابیس `mana_db`
برای ایجاد پشتیبان منظم از دیتابیس پستگرس با دستور `pg_dump`:
```bash
# ایجاد بکاپ دستی
pg_dump -U mana_user -h localhost mana_db > /var/backups/mana_db_$(date +%Y%m%d).sql
```
سامانه همچنین دارای سیستم بکاپ خودکار در پنل ادمین (دانلود مستقیم فایل JSON و ذخیره در جدول `db_backups`) می‌باشد.
