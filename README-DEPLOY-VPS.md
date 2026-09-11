# راهنمای کامل راه‌اندازی و توسعه برنامه روی سرور لینوکس (VPS) از طریق GitHub

این راهنما گام‌به‌گام نحوه انتقال، راه‌اندازی با **Docker**، تنظیم **دامنه و SSL رایگان**، استراتژی **حفظ دائمی اطلاعات** و روش **به‌روزرسانی با یک دستور** را شرح می‌دهد.

---

## فهرست مطالب
1. [پیش‌نیازها](#۱-پیشنیازها)
2. [مرحله ۱: انتقال پروژه به GitHub](#مرحله-۱-انتقال-پروژه-به-github)
3. [مرحله ۲: آماده‌سازی سرور VPS (نصب داکر و گیت)](#مرحله-۲-آمادهسازی-سرور-vps)
4. [مرحله ۳: کلون و اجرای برنامه با Docker Compose](#مرحله-۳-کلون-و-اجرای-برنامه-با-docker-compose)
5. [مرحله ۴: تنظیم دامنه و SSL رایگان (Let's Encrypt)](#مرحله-۴-تنظیم-دامنه-و-ssl-رایگان)
6. [مرحله ۵: استراتژی حفظ اطلاعات و عدم از دست رفتن داده‌ها](#مرحله-۵-استراتژی-حفظ-اطلاعات-و-عدم-از-دست-رفتن-دادهها)
7. [مرحله ۶: نحوه توسعه و آپدیت‌های بعدی بدون قطعی](#مرحله-۶-نحوه-توسعه-و-آپدیتهای-بعدی)

---

## ۱. پیش‌نیازها
- یک سرور مجازی (VPS) با سیستم‌عامل **Ubuntu 22.04 LTS** یا **Ubuntu 24.04 LTS**
- دسترسی SSH به سرور (با کاربر `root` یا کاربری با دسترسی `sudo`)
- حساب کاربری در [GitHub](https://github.com)
- یک دامنه یا ساب‌دامنه متصل به IP سرور (مثال: `factor.yourdomain.com`)

---

## مرحله ۱: انتقال پروژه به GitHub

اگر فایل‌های این پروژه را در سیستم خود دارید یا از خروجی گیت‌هاب استفاده می‌کنید:

1. در سایت گیت‌هاب یک مخزن جدید (New Repository) با نام دلخواه (مثلاً `sepehr-invoice`) ایجاد کنید.
2. در ترمینال سیستم خود داخل پوشه پروژه دستورات زیر را وارد کنید:

```bash
git init
git add .
git commit -m "Initial commit for VPS deployment"
git branch -M main
git remote add origin https://github.com/USERNAME/sepehr-invoice.git
git push -u origin main
```
*(به جای `USERNAME/sepehr-invoice` آدرس مخزن خود را قرار دهید)*

---

## مرحله ۲: آماده‌سازی سرور VPS

با دستور SSH به سرور متصل شوید:
```bash
ssh root@YOUR_SERVER_IP
```

دستورات زیر را برای به‌روزرسانی و نصب **Git** و **Docker** و **Docker Compose** اجرا کنید:

```bash
# بروزرسانی مخازن
sudo apt update && sudo apt upgrade -y

# نصب ابزارهای پایه
sudo apt install -y git curl ufw

# نصب داکر و داکر کامپوز
sudo apt install -y docker.io docker-compose-plugin
sudo systemctl enable --now docker
```

---

## مرحله ۳: کلون و اجرای برنامه با Docker Compose

1. یک پوشه کاری بسازید و پروژه را از گیت‌هاب دانلود کنید:
```bash
sudo mkdir -p /var/www
cd /var/www
git clone https://github.com/USERNAME/sepehr-invoice.git app
cd app
```

2. مجوز اجرایی به فایل آپدیت بدهید:
```bash
chmod +x deploy.sh
```

3. کانتینر را بسازید و روشن کنید:
```bash
docker compose up -d --build
```

اکنون برنامه شما بیلد شده و داخل یک کانتینر سبک Nginx روی پورت ۳۰۰۰ در حال کار است.
برای بررسی وضعیت:
```bash
docker compose ps
```

---

## مرحله ۴: تنظیم دامنه و SSL رایگان

برای اینکه کاربران بدون وارد کردن پورت ۳۰۰۰ و با آدرس امن `https://factor.yourdomain.com` به برنامه دسترسی داشته باشند:

### ۱. نصب Nginx روی سرور میزبان:
```bash
sudo apt install -y nginx certbot python3-certbot-nginx
```

### ۲. تنظیم Reverse Proxy:
فایل پیکربندی ایجاد کنید:
```bash
sudo nano /etc/nginx/sites-available/factor.conf
```
محتوای زیر را داخل آن قرار دهید (دامنه خود را جایگزین کنید):

```nginx
server {
    listen 80;
    server_name factor.yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    client_max_body_size 50M;
}
```

### ۳. فعال‌سازی و راه‌اندازی Nginx:
```bash
sudo ln -s /etc/nginx/sites-available/factor.conf /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### ۴. دریافت گواهی‌نامه رایگان SSL با Let's Encrypt:
```bash
sudo certbot --nginx -d factor.yourdomain.com
```
*ایمیل خود را وارد کرده و شرایط را تایید کنید. Certbot به طور خودکار HTTPS را فعال و تمدید خودکار آن را تنظیم می‌کند.*

---

## مرحله ۵: استراتژی پایگاه‌داده متمرکز و حفظ دائمی اطلاعات (Multi-User & Multi-Device)

با توجه به اینکه چندین کاربر (صندوق‌دار، انباردار، حسابدار و مدیر) از کامپیوترها و گوشی‌های مختلف به این سامانه متصل می‌شوند:

1. **پایگاه‌داده متمرکز سرور (Docker Volume):**
   - تمامی داده‌ها (فاکتورها، انبار، کاردکس، مشتریان و کاربران) به صورت متمرکز در پوشه `/var/www/app/data/database.json` روی هارد سرور ذخیره می‌شوند.
   - این پوشه در فایل `docker-compose.yml` به صورت **Volume** نگاشت شده است (`./data:/app/data`). بنابراین حتی با حذف، آپدیت یا ریستارت کانتینر، اطلاعات به هیچ عنوان پاک نمی‌شوند.

2. **همگام‌سازی زنده بین تمام دستگاه‌ها:**
   - به محض اینکه صندوق‌دار فاکتور صادر کند، کسری انبار بلافاصله برای انباردار و گزارش سود برای مدیر و حسابدار همگام می‌شود.
   - نیازی به نصب پایگاه داده خارجی (MySQL یا PostgreSQL) ندارید؛ سامانه به صورت خودکار، سبک و پایدار این کار را انجام می‌دهد.

3. **پشتیبان‌گیری منظم:**
   - در منوی **پنل مدیریت ⬅ مرکز داده و پشتیبان‌گیری**، دکمه **«دانلود نسخه پشتیبان (JSON)»** وجود دارد.
   - همچنین می‌توانید مستقیماً از فایل `/var/www/app/data/database.json` سرور بکاپ تهیه کنید.

---

## مرحله ۶: نحوه توسعه و آپدیت‌های بعدی

هر زمان که فیچر جدیدی در برنامه توسعه دادید و آن را به گیت‌هاب Push کردید:

```bash
git add .
git commit -m "اضافه شدن امکانات جدید"
git push origin main
```

کافی است به سرور خود SSH بزنید و اسکریپت آماده را اجرا کنید:

```bash
cd /var/www/app
./deploy.sh
```

**این اسکریپت به صورت خودکار:**
1. آخرین تغییرات را از گیت‌هاب دریافت می‌کند (`git fetch & reset`).
2. برنامه را با جدیدترین کدها بازسازی می‌کند (`docker compose build`).
3. کانتینر جدید را بدون اختلال جایگزین قبلی می‌کند (`docker compose up -d`).
4. ایمیج‌های موقت قدیمی را پاک می‌کند تا حافظه سرور تمیز بماند.
