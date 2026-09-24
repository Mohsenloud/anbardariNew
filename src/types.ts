export interface ProductVariant {
  id: string;
  name: string; // نام یا ویژگی تنوع (مانند: طوسی، قرمز، سایز، بسته‌بندی، مدل و...)
  code?: string; // کد اختصاصی این تنوع
  barcode?: string; // بارکد اختصاصی این تنوع (تعیین‌شده توسط سیستم)
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
  purchasePrice?: number; // آلیاس buyPrice برای سازگاری
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

// ----------------------------------------------------
// صورتحساب و تراکنش‌های مالی طرف‌حساب (Customer Transactions & Ledger)
// ----------------------------------------------------
export type CustomerTransactionType = 'debt' | 'deposit'; // بدهی یا واریزی
export type CustomerPaymentMethod = 'cash' | 'transfer' | 'pos' | 'cheque' | 'card' | 'credit' | 'other';

export interface CustomerTransaction {
  id: string;
  customerId: string;
  customerName: string;
  type: CustomerTransactionType; // 'debt' = بدهی جدید یا مانده قبلی (بدهکار), 'deposit' = واریز، پرداختی یا چک وصولی (بستانکار)
  amount: number; // مبلغ به واحد پول فعال (تومان یا ریال)
  date: string; // تاریخ شمسی (مثلاً ۱۴۰۳/۰۶/۲۴)
  title: string; // عنوان سند (مثلاً: واریز به حساب، کارت به کارت، مانده طلب سال قبل، چک دریافتی، تسویه فاکتور...)
  paymentMethod?: CustomerPaymentMethod; // روش پرداخت
  trackingNumber?: string; // شماره پیگیری / شماره ارجاع / فیش بانکی / شماره چک
  bankName?: string; // نام بانک یا شماره حساب مقصد
  chequeDueDate?: string; // تاریخ سررسید چک (در صورت دریافت چک)
  invoiceId?: string; // شناسه فاکتور فروش در صورت ارتباط مستقیم با فاکتور
  invoiceNumber?: string; // شماره فاکتور فروش مرتبط
  notes?: string; // توضیحات و بابت سند
  recordedBy?: string; // نام کاربر یا صندوق‌دار ثبت‌کننده
  createdAt: string; // زمان ثبت سیستمی
  updatedAt?: string;
}

export interface CustomerLedgerEntry {
  id: string;
  date: string;
  documentNumber: string;
  documentType: 'invoice' | 'deposit' | 'debt' | 'invoice_payment';
  documentTypeLabel: string;
  description: string;
  debit: number; // بدهکار (مبلغ افزایش بدهی مشتری: فاکتور فروش یا ثبت بدهی)
  credit: number; // بستانکار (مبلغ پرداخت یا واریز مشتری)
  balance: number; // مانده حساب پس از این ردیف (مثبت: بدهکار، صفر: تسویه، منفی: بستانکار/طلبکار)
  balanceStatus: 'debtor' | 'settled' | 'creditor';
  paymentMethod?: string;
  trackingNumber?: string;
  notes?: string;
  rawTransaction?: CustomerTransaction;
  rawInvoice?: Invoice;
}

export interface InvoiceItem {
  id: string;
  productId: string;
  productName: string;
  name?: string; // آلیاس productName
  productCode: string;
  code?: string; // آلیاس productCode
  barcode?: string; // بارکد محصول یا خدمت
  unit: string;
  quantity: number;
  unitPrice: number;
  price?: number; // آلیاس unitPrice
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
  type: 'standard' | 'official' | 'thermal' | 'simple'; // استاندارد، رسمی، فیش پرینتر، ساده و خوانا
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

export type StockMovementType = 'sale' | 'purchase' | 'adjustment' | 'return' | 'direct_out' | 'direct_in';

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
  code?: string;
  address?: string;
  phone?: string;
  managerName?: string;
  isDefault?: boolean;
}

export interface StoreSettings {
  // مشخصات برنامه و هویت برند
  appName?: string; // نام برنامه یا عنوان اصلی در سربرگ
  showStoreEditionBadge?: boolean; // نمایش یا عدم نمایش عبارت «نسخه فروشگاهی»
  storeName: string;
  tagline: string;
  logo?: string; // لوگو یا تصویر سربرگ
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
  enableSimpleTemplate?: boolean; // قالب ساده با جدول مقادیر و چیدمان منظم خوانا
  defaultTemplate: 'standard' | 'official' | 'thermal' | 'simple'; // قالب پیش‌فرض
  enableSimpleExitSlipTemplate?: boolean; // فعال‌بودن قالب ساده و خوانا برای حواله خروج
  defaultExitSlipTemplate?: 'standard' | 'simple'; // قالب پیش‌فرض حواله خروج انبار

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

  // تنظیمات و مشخصات انبار مبدأ (جهت ثبت در حواله خروج، بارگیری و تحویل فیزیکی)
  originWarehouseName?: string; // نام انبار مبدأ
  originWarehouseCode?: string; // کد یا شناسه انبار مبدأ
  originWarehouseAddress?: string; // نشانی و آدرس دقیق انبار مبدأ
  originWarehousePhone?: string; // شماره تلفن / داخلی انبار مبدأ
  originWarehouseManager?: string; // نام مدیر، سرپرست یا انباردار انبار مبدأ

  // کیفیت و وضوح فایل‌های خروجی PDF (فاکتور و حواله خروج انبار)
  pdfInvoiceQuality?: 'economy' | 'standard' | 'high' | 'ultra'; // کیفیت فایل PDF فاکتور
  pdfExitSlipQuality?: 'economy' | 'standard' | 'high' | 'ultra'; // کیفیت فایل PDF حواله خروج انبار
  pdfSyncQuality?: boolean; // اعمال کیفیت یکسان برای هر دو بخش
  pdfCustomScale?: number; // مقیاس رندر سفارشی (اختیاری)
  pdfCustomCompression?: number; // کیفیت فشرده‌سازی تصویر سفارشی (اختیاری)
}

export type PdfQualityPreset = 'economy' | 'standard' | 'high' | 'ultra';

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
  name?: string; // آلیاس fullName
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
  slipNumber?: string; // شماره ترتیبی و اختصاصی حواله خروج انبار مثلاً EXT-1001
  printCount: number; // تعداد دفعات چاپ
  lastPrintedAt?: string; // تاریخ و زمان آخرین چاپ
  lastPrintedBy?: string; // نام انباردار یا کاربر آخرین چاپ
  history: ExitSlipPrintRecord[]; // تاریخچه کامل دفعات چاپ با زمان و تاریخ
  
  // تایید تحویل بار و مشخصات تحویل‌گیرنده و خودرو
  isDelivered?: boolean; // آیا بار توسط انباردار تحویل داده شده است؟
  deliveredAt?: string; // تاریخ و زمان تایید تحویل بار
  deliveredBy?: string; // نام انباردار تاییدکننده تحویل
  receiverName?: string; // نام و نام‌خانوادگی تحویل‌گیرنده یا راننده
  receiverPhone?: string; // شماره تماس تحویل‌گیرنده یا راننده
  vehicleInfo?: string; // مشخصات ماشین (نوع خودرو، مدل و پلاک)
  deliveryNotes?: string; // شماره بارنامه یا یادداشت خروج
}

// ----------------------------------------------------
// خودروهای ثبت‌شده / ناوگان حمل بار (Saved Delivery Vehicles)
// ----------------------------------------------------
export interface SavedVehicle {
  id: string;
  vehicleType: string; // نوع خودرو مثلاً وانت نیسان، خاور، وانت پراید
  vehicleInfo: string; // متن مشخصات کامل خودرو و پلاک
  driverName?: string; // نام راننده یا تحویل‌گیرنده پیش‌فرض
  driverPhone?: string; // شماره تماس راننده
  plateNumber?: string; // پلاک تفکیک‌شده
  colorDesc?: string; // رنگ خودرو
  notes?: string; // توضیحات تکمیلی
  createdAt: string; // تاریخ ثبت شمسی
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

// ----------------------------------------------------
// ورود و خروج مستقیم انبار بدون فاکتور (امانی، تعمیرات، سرویس، مصرف داخلی)
// ----------------------------------------------------

export type DirectTransferType = 
  | 'repair' // اعزام به تعمیرگاه و سرویس
  | 'temporary_loan' // امانی یا تست نزد مشتری/همکار
  | 'internal_use' // مصرف داخلی در کارگاه یا شرکت
  | 'sample' // نمونه کالا
  | 'other_out'; // سایر خروج‌های مستقیم بدون فاکتور

export type DirectTransferStatus = 
  | 'dispatched' // خارج شده از انبار (دست تعمیرکار یا امانت‌گیرنده)
  | 'partially_returned' // بخشی از اقلام بازگشته است
  | 'returned' // به طور کامل به انبار بازگشت
  | 'completed_no_return'; // مختومه (مصرف شد یا نیاز به برگشت ندارد)

export interface DirectTransferItem {
  id: string;
  productId: string;
  productName: string;
  productCode: string;
  variantId?: string;
  variantName?: string;
  unit: string;
  quantity: number; // تعداد خارج شده
  returnedQuantity: number; // تعداد تا کنون بازگشته
  serialNumber?: string; // شماره سریال، کد پلاک دستگاه، مدل
  notes?: string; // توضیحات یا عیب ظاهری دستگاه
}

export interface DirectTransferReturnRecord {
  id: string;
  returnedAt: string; // تاریخ و زمان بازگشت به انبار (مثلاً ۱۴۰۳/۰۶/۲۵ - ساعت ۱۶:۲۰)
  receivedByWarehouseUser: string; // انباردار تحویل‌گیرنده در انبار
  returnerName: string; // نام آورنده یا راننده دستگاه
  returnerPhone?: string; // شماره تماس آورنده
  returnVehicleInfo?: string; // مشخصات ماشین و پلاک آورنده (مثلاً وانت مزدا نقره‌ای - پلاک ...)
  itemsReturned: {
    itemId: string;
    productId: string;
    productName: string;
    quantity: number;
  }[];
  healthStatus?: 'healthy' | 'repaired' | 'damaged' | 'unrepaired' | 'scrapped'; // وضعیت سلامت پس از بازگشت
  notes?: string; // گزارش فنی یا توضیحات بازگشت
}

export interface DirectTransfer {
  id: string;
  transferNumber: string; // شماره حواله مانند TRF-1001 یا خروج ۶۰۰۱
  title: string; // عنوان حواله (مثلاً: اعزام دستگاه پمپ بتن به تعمیرگاه تهران‌صنعت)
  type: DirectTransferType;
  status: DirectTransferStatus;
  isReturnable: boolean; // آیا دستگاه باید برگردد؟ (برای تعمیرات و امانی پیش‌فرض بله است)
  expectedReturnDate?: string; // تاریخ مورد انتظار بازگشت (شمسی)

  // اقلام حواله
  items: DirectTransferItem[];

  // مشخصات انبار مبدأ
  warehouseId?: string;
  warehouseName?: string;

  // ۱. اطلاعات خروج از انبار (Dispatch)
  dispatchedAt: string; // تاریخ و ساعت خروج
  dispatchedBy: string; // نام انباردار یا کاربر صادرکننده
  receiverName: string; // نام شخص، تعمیرگاه، راننده یا تحویل‌گیرنده
  receiverPhone?: string; // شماره تماس
  dispatchVehicleInfo?: string; // مشخصات ماشین و پلاک خارج‌کننده (مثلاً وانت نیسان آبی - پلاک ۲۴ ع ۵۶۷ ایران ۶۸)
  destination?: string; // مقصد / نشانی تعمیرگاه یا مشتری
  dispatchNotes?: string; // توضیحات، علت خروج یا شرح خرابی اولیه

  // ۲. سوابق بازگشت و ورود مجدد به انبار (Returns)
  returnRecords: DirectTransferReturnRecord[];

  createdAt: string;
  updatedAt?: string;
}



