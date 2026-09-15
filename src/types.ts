export interface ProductVariant {
  id: string;
  name: string; // نام یا ویژگی تنوع (مانند: طوسی، قرمز، سایز، بسته‌بندی، مدل و...)
  code?: string; // کد یا بارکد اختصاصی این تنوع
  sku?: string;
  buyPrice?: number; // قیمت خرید اختصاصی تنوع (در صورت تفاوت با کالای پایه)
  sellPrice?: number; // قیمت فروش اختصاصی تنوع (در صورت تفاوت با کالای پایه)
  stock: number; // موجودی این تنوع در انبار
  minStockAlert?: number; // حداقل موجودی برای هشدار
}

export interface Product {
  id: string;
  code: string; // کد کالا یا بارکد
  name: string; // نام کالا
  category: string; // دسته‌بندی
  unit: string; // واحد سنجش (عدد، بسته، کیلوگرم، متر، کیسه و...)
  buyPrice: number; // قیمت خرید (به تومان یا ریال)
  sellPrice: number; // قیمت فروش (به تومان یا ریال)
  stock: number; // موجودی فعلی در انبار (مجموع تنوع‌ها در صورت داشتن تنوع)
  minStockAlert: number; // حداقل موجودی برای هشدار
  description?: string;
  updatedAt: string;
  barcode?: string;
  // پشتیبانی از تنوع کالا (رنگ، سایز، مدل و...)
  hasVariants?: boolean;
  variants?: ProductVariant[];
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  nationalId?: string; // کد ملی یا شناسه اقتصادی
  address?: string;
  notes?: string;
  createdAt: string;
}

export interface InvoiceItem {
  id: string;
  productId: string;
  productName: string;
  productCode: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  buyPrice: number; // قیمت خرید در لحظه فروش برای محاسبه سود
  discount: number; // مبلغ تخفیف برای این ردیف
  total: number; // (quantity * unitPrice) - discount
  // پشتیبانی از تنوع کالا در فاکتور
  variantId?: string;
  variantName?: string; // مثلاً: طوسی یا قرمز
}

export type PaymentStatus = 'paid' | 'unpaid' | 'partial';
export type PaymentMethod = 'cheque' | 'cash' | 'transfer' | 'pos' | 'credit';

export interface Invoice {
  id: string;
  invoiceNumber: string;
  type: 'standard' | 'official' | 'thermal'; // استاندارد، رسمی، فیش پرینتر
  customerId: string;
  customerName: string;
  customerPhone?: string;
  customerAddress?: string;
  customerNationalId?: string;
  date: string; // تاریخ شمسی
  dueDate?: string; // سررسید برای نسیه
  items: InvoiceItem[];
  subtotal: number; // جمع اقلام قبل از تخفیف
  totalDiscount: number; // تخفیف کل فاکتور
  taxRate: number; // درصد مالیات (مثلا 10)
  taxAmount: number; // مبلغ مالیات
  finalTotal: number; // مبلغ قابل پرداخت نهایی
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod;
  paidAmount: number;
  // مشخصات ثبت چک (شماره چک، تاریخ سررسید و نام چک/صاحب حساب یا بانک)
  chequeNumber?: string;
  chequeDueDate?: string;
  chequeName?: string;
  // مشخصات ثبت واریز به حساب (توضیحات واریز، شماره پیگیری/ارجاع، نام بانک و ...)
  transferDescription?: string;
  notes?: string;
  isProforma?: boolean; // آیا پیش‌فاکتور است؟
  convertedAt?: string; // تاریخ تبدیل به فاکتور اصلی فروش
  convertedFromProforma?: string; // شماره پیش‌فاکتور اولیه قبل از تبدیل به فاکتور رسمی
  createdAt: string;
  updatedAt?: string; // تاریخ آخرین ویرایش فاکتور
}

export type StockMovementType = 'sale' | 'purchase' | 'adjustment' | 'return';

export interface StockMovement {
  id: string;
  productId: string;
  productName: string;
  variantId?: string;
  variantName?: string;
  type: StockMovementType;
  quantity: number; // مثبت برای ورود، منفی برای خروج
  remainingStock: number;
  invoiceId?: string;
  invoiceNumber?: string;
  date: string;
  note: string;
}

export interface WarehouseInfo {
  id: string;
  name: string;
  isDefault?: boolean;
}

export interface StoreSettings {
  // مشخصات برنامه و هویت برند
  appName?: string; // نام برنامه یا عنوان اصلی در سربرگ
  showStoreEditionBadge?: boolean; // نمایش یا عدم نمایش عبارت «نسخه فروشگاهی»
  storeName: string;
  tagline: string;
  sellerName: string;
  phone: string;
  mobile: string;
  economicCode: string;
  nationalCode: string;
  address: string;
  postalCode: string;
  invoiceFooterText: string;
  currency: 'تومان' | 'ریال';

  // کنترل اجزا و ماژول‌های اصلی برنامه
  enableInventory: boolean; // ماژول انبارداری و کاردکس
  enableCustomers: boolean; // ماژول مدیریت مشتریان
  enableReports: boolean; // ماژول گزارشات و سود و زیان
  showLowStockAlerts: boolean; // نمایش هشدارهای کمبود موجودی در بالای صفحه
  showHeaderClock: boolean; // نمایش ساعت و تقویم در سربرگ

  // کنترل اجزا و رفتار فاکتورساز
  autoDeductStock: boolean; // کسر خودکار از انبار هنگام صدور فاکتور
  allowNegativeStock: boolean; // امکان فروش کالا حتی در صورت کمبود یا عدم موجودی
  enableItemDiscount: boolean; // فیلد تخفیف برای هر ردیف کالا
  enableInvoiceDiscount: boolean; // فیلد تخفیف کلی فاکتور
  taxEnabled: boolean; // فعال بودن مالیات بر ارزش افزوده
  taxPercent: number; // درصد مالیات
  enableDueDate: boolean; // فیلد تاریخ سررسید/چک در فاکتور
  enableInvoiceNotes: boolean; // فیلد یادداشت‌ها و شروط فاکتور
  autoPrintAfterSave: boolean; // باز شدن خودکار پنجره چاپ بلافاصله بعد از ثبت فاکتور

  // قالب‌های مجاز چاپ و صدور فاکتور
  enableStandardTemplate: boolean; // قالب استاندارد A4/A5
  enableOfficialTemplate: boolean; // قالب رسمی دارایی
  enableThermalTemplate: boolean; // قالب فیش پرینتر حرارتی ۸۰ میلی‌متری
  defaultTemplate: 'standard' | 'official' | 'thermal'; // قالب پیش‌فرض

  // روش‌های مجاز دریافت وجه
  enableChequePayment?: boolean; // چک (با ثبت شماره چک، تاریخ سررسید و نام چک)
  enableCashPayment: boolean; // نقدی
  enableTransferPayment: boolean; // واریز به حساب (با ثبت توضیحات و شماره پیگیری)
  enablePosPayment?: boolean; // دستگاه کارتخوان
  enableCreditPayment?: boolean; // نسیه / حسابی

  // شبکه اجتماعی و پیام‌رسان‌ها جهت ارسال حواله‌ها و فاکتورها (تعیین شده توسط مدیر)
  socialShareUrl?: string; // آدرس یا لینک اختصاصی تعیین شده توسط مدیر (کانال، گروه، چت یا وب‌سایت)
  socialChannelTitle?: string; // عنوان شبکه اجتماعی یا کانال (مثلاً: کانال تلگرام انبار مرکزی)
  telegramUsername?: string; // آیدی یا لینک تلگرام
  whatsappNumber?: string; // شماره یا لینک واتساپ اختصاصی
  eitaaChannel?: string; // شناسه یا کانال ایتا
  baleChannel?: string; // شناسه یا کانال بله
  warehouses?: WarehouseInfo[]; // مشخصات انبارها
  defaultWarehouseId?: string; // شناسه انبار پیش‌فرض
}

export type UserRole = 'admin' | 'cashier' | 'warehouse' | 'accountant' | 'custom';

export interface UserPermissions {
  canCreateInvoice: boolean; // صدور فاکتور جدید
  canViewInvoices: boolean; // مشاهده و جستجوی فاکتورها
  canDeleteInvoice: boolean; // حذف و مرجوعی فاکتور
  canManageInventory: boolean; // مدیریت کالاها و انبارداری
  canManageCustomers: boolean; // مدیریت مشتریان
  canViewReports: boolean; // مشاهده گزارشات مالی و سود
  canAccessAdmin: boolean; // دسترسی به پنل مدیریت
  canManageUsers: boolean; // تعریف و مدیریت کاربران
}

export interface AppUser {
  id: string;
  username: string;
  fullName: string;
  role: UserRole;
  roleTitle: string;
  permissions: UserPermissions;
  isActive: boolean;
  phone?: string;
  pin?: string;
  password?: string;
  avatarColor?: string;
  createdAt: string;
  lastLogin?: string;
}

export interface ExitSlipPrintRecord {
  printedAt: string; // تاریخ و زمان شمسی چاپ، مثلاً ۱۴۰۳/۰۶/۲۰ - ۱۴:۳۵
  printedBy: string; // نام کاربری یا انباردار چاپ‌کننده
}

export interface ExitSlipData {
  invoiceId: string;
  printCount: number; // تعداد دفعات چاپ
  lastPrintedAt?: string; // تاریخ و زمان آخرین چاپ
  lastPrintedBy?: string; // نام انباردار یا کاربر آخرین چاپ
  history: ExitSlipPrintRecord[]; // تاریخچه کامل دفعات چاپ با زمان و تاریخ
}

// ----------------------------------------------------
// فاکتور خرید (Purchase Invoices) و حواله ورود به انبار (Inbound Warehouse Receipts)
// ----------------------------------------------------

export interface PurchaseInvoiceItem {
  id: string;
  productId: string;
  productName: string;
  productCode: string;
  unit: string;
  quantity: number; // تعداد خریداری شده طبق فاکتور
  buyPrice: number; // قیمت خرید واحد (فی)
  discount: number; // تخفیف ردیف
  total: number; // (quantity * buyPrice) - discount
}

export type PurchaseStatus = 'pending_receipt' | 'has_discrepancy' | 'completed' | 'cancelled';

export interface PurchaseInvoice {
  id: string;
  invoiceNumber: string; // شماره فاکتور خرید
  supplierName: string; // نام تامین‌کننده / فروشنده
  supplierPhone?: string;
  supplierAddress?: string;
  supplierEconomicCode?: string;
  date: string; // تاریخ فاکتور خرید (شمسی)
  dueDate?: string; // تاریخ سررسید (در صورت خرید نسیه/چکی)
  items: PurchaseInvoiceItem[];
  subtotal: number;
  totalDiscount: number;
  taxRate: number;
  taxAmount: number;
  shippingCost?: number; // هزینه حمل یا باربری
  finalTotal: number;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod;
  paidAmount: number;
  chequeNumber?: string;
  chequeDueDate?: string;
  chequeName?: string;
  transferDescription?: string;
  notes?: string;
  status: PurchaseStatus; // وضعیت تحویل و ورود به انبار
  inboundReceiptId?: string; // شناسه حواله ورود کالا متناظر
  createdAt: string;
  updatedAt?: string;
}

export interface InboundReceiptItem {
  id: string;
  productId: string;
  productName: string;
  productCode: string;
  unit: string;
  expectedQuantity: number; // تعداد درج شده در فاکتور خرید
  receivedQuantity: number; // تعداد شمارش شده واقعی تحویل گرفته شده در انبار
  discrepancy: number; // receivedQuantity - expectedQuantity (منفی: کسری، مثبت: مازاد)
  discrepancyReason?: string; // علت مغایرت (کسری باربری، شکستگی، عدم تامین و ...)
  buyPrice: number;
}

export type InboundReceiptStatus = 'pending_verification' | 'confirmed' | 'has_discrepancy' | 'rejected';

export interface InboundReceipt {
  id: string;
  receiptNumber: string; // شماره حواله ورود به انبار مثلاً REC-1001
  purchaseInvoiceId: string;
  purchaseInvoiceNumber: string;
  supplierName: string;
  date: string; // تاریخ صدور حواله
  verifiedDate?: string; // تاریخ شمارش و تایید انباردار
  verifiedBy?: string; // نام انباردار یا کاربر تاییدکننده
  status: InboundReceiptStatus;
  items: InboundReceiptItem[];
  totalExpectedQuantity: number;
  totalReceivedQuantity: number;
  totalDiscrepancy: number;
  notes?: string;
  warehouseNotes?: string; // یادداشت و گزارش انباردار
  createdAt: string;
}

export type ActivityActionCategory = 
  | 'auth' 
  | 'sales' 
  | 'purchase' 
  | 'warehouse' 
  | 'customer' 
  | 'users' 
  | 'settings' 
  | 'system';

export interface ActivityLog {
  id: string;
  userId: string;
  userName: string;
  userRole: UserRole | string;
  userRoleTitle?: string;
  category: ActivityActionCategory;
  actionType: string;
  actionTitle: string; // عنوان مختصر عملیات
  details: string; // توضیحات تکمیلی و مشخصات رکورد
  timestamp: string; // تاریخ و ساعت فارسی
  dateOnly: string; // تاریخ شمسی جهت فیلتر سریع
  deviceInfo?: string; // مشخصات مرورگر یا دستگاه
}

export interface ServerBackupInfo {
  filename: string;
  createdAt: string;
  trigger: 'auto' | 'manual' | 'startup' | 'pre-restore';
  label: string;
  sizeBytes: number;
  checksum: string;
  stats: {
    productsCount: number;
    invoicesCount: number;
    customersCount: number;
    purchaseInvoicesCount: number;
    inboundReceiptsCount: number;
  };
}


