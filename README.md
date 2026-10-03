# سامانه جامع و یکپارچه صدور فاکتور رسمی، انبارداری و حسابداری

> **نرم‌افزار جامع مدیریت فاکتور، حواله خروج کالا، انبارداری چندگانه و حسابداری با پشتیبانی کامل از پایگاه داده PostgreSQL (`mana_db`)، داکر (Docker Compose)، PWA و اجرای آفلاین.**

---

## 📋 فهرست مطالب
- [معرفی و ویژگی‌های کلیدی](#-ویژگیهای-کلیدی)
- [معماری و پشته فنی (Tech Stack)](#-پشته-فنی-tech-stack)
- [قالب‌ها و قابلیت‌های چاپ و خروجی](#-قالبها-و-قابلیتهای-چاپ-و-خروجی)
- [روش‌های راه‌اندازی و استقرار](#-روشهای-راهاندازی-و-استقرار)
  - [روش ۱: استقرار سریع با Docker Compose (پیشنهادی)](#-روش-۱-استقرار-سریع-با-docker-compose-پیشنهادی)
  - [روش ۲: اجرای مستقیم روی سرور اوبونتو (بدون داکر)](#-روش-۲-اجرای-مستقیم-روی-سرور-اوبونتو-با-pm2)
  - [روش ۳: اجرای محیط توسعه (Development)](#-روش-۳-اجرای-محیط-توسعه-local-development)
- [تنظیم متغیرهای محیطی (.env)](#-تنظیم-متغیرهای-محیطی-env)
- [پشتیبان‌گیری و بازیابی اطلاعات](#-پشتیبانگیری-و-بازیابی-اطلاعات)
- [امنیت، دسترسی‌ها و مدیریت کاربران](#-امنیت-دسترسیها-و-مدیریت-کاربران)

---

## ✨ ویژگی‌های کلیدی

### ۱. صدور و مدیریت فاکتور و پیش‌فاکتور
- صدور انواع فاکتور فروش رسمی (مورد تایید دارایی)، فاکتورهای استاندارد تجاری، فاکتورهای ساده و فیش‌های حرارتی ۸ سانتی‌متری.
- پشتیبانی کامل از پیش‌فاکتور (بدون کسر از موجودی انبار) با قابلیت تبدیل سریع به فاکتور نهایی با یک کلیک.
- محاسبه خودکار مالیات بر ارزش افزوده (VAT ۱۰٪)، تخفیفات سطری و کلی، هزینه‌های حمل‌ونقل و بسته‌بندی.
- روش‌های پرداخت متنوع: نقد، پوز، کارت‌به‌کارت، چک و نسیه (بدهکاری مشتری) با ثبت شماره پیگیری و تاریخ سررسید چک.
- امکان جستجوی بارکد، ثبت تخفیف‌های درصدی و مبلغی، و تنظیمات هوشمند فونت و ارقام فارسی (وزیرمتن).

### ۲. حواله خروج کالا و بارگیری (Exit Slip)
- صدور حواله تحویل و خروج رسمی کالا با ثبت مشخصات راننده، شماره پلاک خودرو، بارگیر و انبار مبدأ.
- سیستم ثبت خودکار لاگ تاریخچه دفعات چاپ و دانلود PDF جهت جلوگیری از صدور و بارگیری تکراری.
- خروجی PDF برداری بسیار سبک و استاندارد جهت بایگانی و چاپ اداری.
- اشتراک‌گذاری سریع حواله و لینک مشاهده آنلاین در شبکه‌های اجتماعی (ایتا، بله، روبیکا، تلگرام و واتساپ).

### ۳. سیستم جامع انبارداری چندگانه و کاردکس کالا
- مدیریت چندین انبار مجزا (انبار مرکزی، انبار توزیع، ضایعات و غیره).
- سند انتقال مستقیم بین انبارها (Direct Transfer) به همراه ثبت سوابق و چاپ حواله انتقال.
- کاردکس دقیق کالا با ثبت کلیه ورودی‌ها، خروجی‌ها، فاکتورهای مرجع و مانده لحظه‌ای.
- هشدار خودکار نقطه سفارش کالا و جلوگیری از ثبت موجودی منفی بر اساس تنظیمات سیستم.

### ۴. مدیریت مشتریان و دفتر حساب
- ثبت پرونده اشخاص و شرکت‌ها (نام شرکت، شناسه ملی، کد اقتصادی، شماره ثبت، تلفن، کدپستی و نشانی).
- ثبت تراکنش‌های مالی، بدهکاری، بستانکاری، تسویه‌ها و گزارش گردش حساب مشتری.
- امکان دریافت خروجی اکسل/CSV و ورودی گروهی مشتریان.

### ۵. پایگاه‌داده قدرتمند PostgreSQL و پایداری اطلاعات
- ذخیره‌سازی ابری/سروری کلیه جداول در دیتابیس اختصاصی `mana_db`.
- مکانیزم فال‌بک خودکار به فایل‌های محلی JSON در صورت قطعی موقت ارتباط دیتابیس.
- ساختار استاندارد جداول: `invoices`, `products`, `customers`, `warehouses`, `movements`, `users`, `settings`, `db_backups`.

### ۶. قابلیت Progressive Web App (PWA) و کارکرد آفلاین
- قابل نصب به عنوان نرم‌افزار مستقل در ویندوز، لینوکس، مک، اندروید و iOS بدون نیاز به مرورگر.
- بهره‌مندی از Service Worker هوشمند و امکان ادامه کار با نرم‌افزار در زمان قطعی اتصال اینترنت.

---

## 🛠 پشته فنی (Tech Stack)

| لایه | تکنولوژی‌های مورد استفاده |
| :--- | :--- |
| **Frontend** | React 19, TypeScript, Tailwind CSS, Lucide Icons, Vite |
| **Backend API** | Node.js, Express, TypeScript (`tsx` / `esbuild`) |
| **Database** | PostgreSQL 16 (`mana_db`) با کتابخانه `pg` + ذخیره‌ساز فال‌بک محلی |
| **PDF & Print Engine** | موتور اختصاصی HTML-to-Canvas / jsPDF با فونت فارسی توکار Vazirmatn |
| **Containerization** | Docker, Docker Compose, Nginx Reverse Proxy |
| **Process Manager** | PM2 (جهت استقرار در سرورهای اوبونتو بدون داکر) |

---

## 🖨 قالب‌ها و قابلیت‌های چاپ و خروجی

سامانه دارای ۴ قالب چاپ استاندارد و قابلیت شخصی‌سازی ریزبینانه ابعاد است:
1. **قالب رسمی دارایی (Official):** دارای جدول استاندارد، کدهای اقتصادی، نشانی کامل خریدار و فروشنده، مالیات و عوارض تفکیک‌شده و محل مهروامضا.
2. **قالب استاندارد (Standard A4 / A5):** مناسب برای تمامی شرکت‌های بازرگانی و فروشگاه‌ها با امکان تغییر جهت به افقی (Landscape) یا عمودی (Portrait).
3. **قالب ساده و باخوانایی بالا (Simple):** مناسب خریداران خانگی و فروشگاه‌های خرد.
4. **فیش حرارتی ۸ سانتی‌متری (Thermal 80mm):** بهینه‌سازی‌شده برای پرینترهای حرارتی فروشگاهی و صدور سریع فیش صندوق.

> **شخصی‌سازی ابعاد در پنل ادمین:** قابلیت تغییر اندازه عنوان، متون، حاشیه‌های برگه (Margins)، ارتفاع ردیف‌های جدول، رنگ تم سازمانی و آپلود لوگوی فروشگاه به همراه پیش‌نمایش در پنجره شناور.

---

## 🚀 روش‌های راه‌اندازی و استقرار

### ⚡ روش ۱: استقرار سریع با Docker Compose (پیشنهادی)

برای راه‌اندازی سرور جدید از صفر تا استقرار کامل پروژه و پایگاه‌داده PostgreSQL، دستورات زیر را به ترتیب روی سرور اجرا کنید:

#### ۱. نصب داکر و ابزارهای پیش‌نیاز سرور:
```bash
# بروزرسانی مخازن
apt update && apt upgrade -y

# نصب بستههای مورد نیاز
apt install -y curl apt-transport-https ca-certificates gnupg lsb-release

# نصب سریع و رسمی Docker با اسکریپت رسمی
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# نصب پلاگین docker compose (نسخه ۲)
apt install -y docker-compose-plugin

# نصب گیت
apt update && apt install -y git
```

#### ۲. دریافت و کلون سورس پروژه:
```bash
mkdir -p /var/www/app
cd /var/www/app
git clone https://github.com/Mohsenloud/anbardariNew.git .
```

#### ۳. راه‌اندازی، بیلد و اجرای کانتینرها (یک‌خطی):
```bash
docker compose down && git pull origin main && docker compose up -d --build
```

یا اجرای مرحله‌به‌مرحله دستورات (جهت به‌روزرسانی‌های بعدی):
```bash
docker compose down
git pull origin main
docker compose up -d --build
```

#### امکانات پیکربندی داکر:
- کانتینر پایگاه داده `mana_postgres_db` با انکودینگ UTF8 به صورت خودکار ساخته شده و آماده پذیرش دیتا می‌شود.
- والیوم داکر `postgres_data` پایداری دائمی ۱۰۰٪ اطلاعات دیتابیس را تضمین می‌کند.
- برای بررسی وضعیت اجرا و لاگ‌ها:
```bash
docker compose logs -f
```

---

### 🖥 روش ۲: اجرای مستقیم روی سرور اوبونتو (با PM2)

#### پیش‌نیازها:
- سیستم‌عامل Ubuntu 22.04 یا 24.04 LTS
- Node.js نسخه 20 به بالا
- سرور PostgreSQL
- وب‌سرور Nginx

#### مراحل نصب:

۱. **نصب Node.js و PM2:**
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt update && sudo apt install -y nodejs postgresql postgresql-contrib nginx git
sudo npm install -g pm2
```

۲. **ایجاد دیتابیس `mana_db` در PostgreSQL:**
```bash
sudo -u postgres psql
```
دستورات SQL زیر را وارد نمایید:
```sql
CREATE USER mana_user WITH ENCRYPTED PASSWORD 'ManaSecurePass_2026!';
CREATE DATABASE mana_db OWNER mana_user ENCODING 'UTF8';
GRANT ALL PRIVILEGES ON DATABASE mana_db TO mana_user;
\c mana_db
GRANT ALL ON SCHEMA public TO mana_user;
ALTER SCHEMA public OWNER TO mana_user;
\q
```

۳. **کلون سورس و نصب پکیج‌ها:**
```bash
cd /var/www
git clone https://github.com/YOUR_REPO/factor-app.git
cd factor-app
npm install
cp .env.example .env
```

۴. **کامپایل نهایی و اجرا:**
```bash
npm run build
pm2 start dist/server.cjs --name "mana-factor"
pm2 save
pm2 startup
```

۵. **تنظیم Nginx Reverse Proxy:**
یک فایل در مسیر `/etc/nginx/sites-available/factor.conf` ایجاد کرده:
```nginx
server {
    listen 80;
    server_name your-domain.com; # یا IP سرور شما

    client_max_body_size 50M;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```
سپس فعال‌سازی و راه‌اندازی مجدد:
```bash
sudo ln -s /etc/nginx/sites-available/factor.conf /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl restart nginx
```

---

### 💻 روش ۳: اجرای محیط توسعه (Local Development)

جهت تست و توسعه روی رایانه شخصی:
```bash
# کلون و نصب
git clone https://github.com/YOUR_REPO/factor-app.git
cd factor-app
npm install

# اجرای همزمان سرور Express و سرور توسعه Vite
npm run dev
```
برنامه در آدرس `http://localhost:3000` در دسترس خواهد بود.

---

## ⚙ تنظیم متغیرهای محیطی (.env)

فایل `.env` در ریشه پروژه قرار دارد:

```env
# پورت اجرای وب‌سرور
PORT=3000

# حالت محیطی
NODE_ENV=production

# آدرس اتصال به پایگاه‌داده PostgreSQL
DATABASE_URL=postgresql://mana_user:ManaSecurePass_2026!@localhost:5432/mana_db

# توکن احراز هویت پشتیبان و ربات‌ها (اختیاری)
BACKUP_ACCESS_TOKEN=your_secure_random_token_here
```

---

## 💾 پشتیبان‌گیری و بازیابی اطلاعات

۱. **پشتیبان‌گیری خودکار در دیتابیس:** سیستم در هر ساعت یا به ازای تغییرات مهم، یک نسخه JSON فشرده از اطلاعات را در جدول `db_backups` ثبت می‌کند.
۲. **دانلود مستقیم بکاپ:** در پنل «مدیریت و تنظیمات > پشتیبان‌گیری»، با یک کلیک فایل کامل پشتیبان را دریافت کنید.
۳. **پشتیبان‌گیری استاندارد دیتابیس PostgreSQL:**
```bash
pg_dump -U mana_user -h localhost mana_db > /var/backups/mana_db_$(date +%Y%m%d).sql
```
۴. **بازیابی دیتابیس PostgreSQL:**
```bash
psql -U mana_user -h localhost mana_db < /var/backups/mana_db_20261003.sql
```

---

## 🔒 امنیت، دسترسی‌ها و مدیریت کاربران

- **نقش‌های کاربری:** مدیر کل (Admin)، حسابدار، انباردار و صندوق‌دار.
- **سطوح دسترسی:** محدودسازی قابلیت صدور یا ویرایش فاکتور، مشاهده قیمت‌های خرید و سود، دسترسی به تنظیمات انبار و مدیریت حساب کاربران.
- **حفاظت از حمله Brute-Force:** قفل موقت حساب کاربری پس از ۵ مرتبه ورود ناموفق متوالی.
- **ایمن‌سازی داده‌ها:** استفاده از متغیرهای ایمن در کوئری‌های SQL برای جلوگیری کامل از تزریق کد (SQL Injection).

---

## 📄 لایسنس
توسعه‌یافته برای مدیریت حسابداری و صدور فاکتورهای رسمی و فروشگاهی.
کلیه حقوق برای توسعه‌دهندگان محفوظ است.
