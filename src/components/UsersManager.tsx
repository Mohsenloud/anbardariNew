import React, { useState } from 'react';
import { AppUser, UserRole, UserPermissions } from '../types';
import { DEFAULT_ROLE_PERMISSIONS, ROLE_LABELS } from '../utils/storage';
import {
  Users,
  UserPlus,
  ShieldCheck,
  ShieldAlert,
  Edit,
  Trash2,
  Check,
  X,
  Search,
  KeyRound,
  Phone,
  UserCheck,
  UserX,
  ArrowRightLeft,
  Info,
  CheckCircle2,
  Eye,
  EyeOff,
  Lock
} from 'lucide-react';

interface UsersManagerProps {
  users: AppUser[];
  currentUser: AppUser;
  onAddUser: (userData: Omit<AppUser, 'id' | 'createdAt'>) => { success: boolean; message?: string } | void;
  onUpdateUser: (user: AppUser) => { success: boolean; message?: string } | void;
  onDeleteUser: (userId: string) => { success: boolean; message?: string };
  onSwitchUser: (user: AppUser) => void;
}

const PERMISSION_CONFIG: {
  key: keyof UserPermissions;
  title: string;
  description: string;
}[] = [
  {
    key: 'canCreateInvoice',
    title: 'صدور و ویرایش فاکتور فروش',
    description: 'دسترسی به فرم صدور فاکتور فروش، پیش‌فاکتور، محاسبه مالیات و تخفیف',
  },
  {
    key: 'canViewInvoices',
    title: 'مشاهده و چاپ فاکتورهای فروش',
    description: 'مشاهده لیست، جستجو، چاپ قالب‌ها و دانلود فاکتورهای فروش',
  },
  {
    key: 'canCreatePurchaseInvoice',
    title: 'ثبت فاکتور خرید کالا و خدمات/هزینه',
    description: 'امکان ثبت و ویرایش فاکتور خرید کالا از تامین‌کننده و فاکتور خدمات/هزینه‌ها',
  },
  {
    key: 'canViewPurchaseInvoices',
    title: 'مشاهده فاکتورهای خرید و هزینه‌ها',
    description: 'مشاهده لیست فاکتورهای خرید کالا، خدمات، آمار خرید و سوابق تامین‌کنندگان',
  },
  {
    key: 'canSettleInvoices',
    title: 'ثبت دریافت، پرداخت و تسویه حساب',
    description: 'ثبت دریافت وجه از مشتری، ثبت پرداخت فاکتورهای خرید/هزینه و تسویه تجمیعی',
  },
  {
    key: 'canDeleteInvoice',
    title: 'حذف و مرجوعی فاکتورها',
    description: 'امکان حذف کامل فاکتور فروش/خرید یا مرجوع کردن اقلام به انبار',
  },
  {
    key: 'canManageInventory',
    title: 'انبارداری و مدیریت کالا',
    description: 'تعریف کالای جدید، ویرایش قیمت‌ها، حواله‌ها، امانی/تعمیرات و کاردکس',
  },
  {
    key: 'canManageCustomers',
    title: 'مدیریت دفتر مشتریان و طرف‌حساب‌ها',
    description: 'تعریف، ویرایش و ثبت اطلاعات هویتی، صورتحساب و اسناد مالی مشتریان',
  },
  {
    key: 'canViewReports',
    title: 'گزارش‌های مالی و سود',
    description: 'دسترسی به نمودارهای تحلیلی، سود خالص و ناخالص و گزارش‌های جامع مالی',
  },
  {
    key: 'canViewBuyPrices',
    title: 'مشاهده قیمت خرید و حاشیه سود',
    description: 'دسترسی به قیمت خرید کالاها، بهای تمام‌شده، ارزش خرید انبار و حاشیه سود (مخصوص مدیر و حسابدار)',
  },
  {
    key: 'canAccessAdmin',
    title: 'دسترسی به پنل مدیریت و تنظیمات',
    description: 'پیکربندی هویت فروشگاه، قوانین فاکتورساز، تلگرام و پشتیبان‌گیری',
  },
  {
    key: 'canManageUsers',
    title: 'مدیریت کاربران و دسترسی‌ها',
    description: 'تعریف کاربر جدید، ویرایش نقش‌ها و تغییر سطوح دسترسی پرسنل',
  },
];

const AVATAR_COLORS = [
  { id: 'emerald', label: 'سبز زمردی', bg: 'bg-emerald-600', lightBg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  { id: 'teal', label: 'فیروزه‌ای', bg: 'bg-teal-600', lightBg: 'bg-teal-50', text: 'text-teal-700', border: 'border-teal-200' },
  { id: 'blue', label: 'آبی اقیانوسی', bg: 'bg-blue-600', lightBg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  { id: 'amber', label: 'کهربایی', bg: 'bg-amber-600', lightBg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  { id: 'purple', label: 'بنفش', bg: 'bg-purple-600', lightBg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
  { id: 'rose', label: 'سرخ گلی', bg: 'bg-rose-600', lightBg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200' },
  { id: 'slate', label: 'خاکستری تیره', bg: 'bg-slate-700', lightBg: 'bg-slate-100', text: 'text-slate-800', border: 'border-slate-300' },
];

export const UsersManager: React.FC<UsersManagerProps> = ({
  users,
  currentUser,
  onAddUser,
  onUpdateUser,
  onDeleteUser,
  onSwitchUser,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);
  const [userToDelete, setUserToDelete] = useState<AppUser | null>(null);
  const [actionError, setActionError] = useState<string>('');
  const [actionSuccess, setActionSuccess] = useState<string>('');
  const [showFormPassword, setShowFormPassword] = useState(false);

  // Form State for Add / Edit
  const [formData, setFormData] = useState<{
    fullName: string;
    username: string;
    role: UserRole;
    roleTitle: string;
    phone: string;
    pin: string;
    isActive: boolean;
    avatarColor: string;
    permissions: UserPermissions;
  }>({
    fullName: '',
    username: '',
    role: 'cashier',
    roleTitle: 'صندوق‌دار و فروشنده',
    phone: '',
    pin: '1234',
    isActive: true,
    avatarColor: 'blue',
    permissions: { ...DEFAULT_ROLE_PERMISSIONS.cashier },
  });

  const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});

  const showSuccess = (msg: string) => {
    setActionSuccess(msg);
    setTimeout(() => setActionSuccess(''), 3000);
  };

  const showError = (msg: string) => {
    setActionError(msg);
    setTimeout(() => setActionError(''), 4000);
  };

  const callerIsFullAdmin = currentUser.role === 'admin' || Boolean(currentUser.permissions?.canAccessAdmin);
  const activeCount = users.filter((u) => u.isActive).length;
  const adminCount = users.filter((u) => (u.role === 'admin' || Boolean(u.permissions?.canAccessAdmin)) && u.isActive).length;

  const isTargetProtectedAdmin = (u?: AppUser | null): boolean =>
    Boolean(u && (u.role === 'admin' || u.permissions?.canAccessAdmin));

  const isLastActiveAdminTarget = (u?: AppUser | null): boolean =>
    Boolean(u && isTargetProtectedAdmin(u) && u.isActive && adminCount <= 1);

  // Open Modal for Add
  const handleOpenAdd = () => {
    setEditingUser(null);
    setShowFormPassword(false);
    setFormData({
      fullName: '',
      username: '',
      role: 'cashier',
      roleTitle: 'صندوق‌دار و فروشنده',
      phone: '',
      pin: '1234',
      isActive: true,
      avatarColor: 'blue',
      permissions: { ...DEFAULT_ROLE_PERMISSIONS.cashier },
    });
    setFormErrors({});
    setIsModalOpen(true);
  };

  // Open Modal for Edit
  const handleOpenEdit = (user: AppUser) => {
    if (!callerIsFullAdmin && isTargetProtectedAdmin(user)) {
      showError('تغییر یا مدیریت حساب‌های مدیر کل فقط برای مدیر سیستم مجاز است.');
      return;
    }
    setEditingUser(user);
    setShowFormPassword(false);
    setFormData({
      fullName: user.fullName,
      username: user.username,
      role: user.role,
      roleTitle: user.roleTitle || ROLE_LABELS[user.role] || '',
      phone: user.phone || '',
      pin: '',
      isActive: user.isActive,
      avatarColor: user.avatarColor || 'emerald',
      permissions: { ...user.permissions },
    });
    setFormErrors({});
    setIsModalOpen(true);
  };

  // Handle Preset Role Selection in Form
  const handleRolePresetSelect = (role: UserRole) => {
    if (!callerIsFullAdmin && role === 'admin') {
      showError('ارتقاء یا تعریف کاربر با نقش مدیر کل فقط برای مدیر سیستم مجاز است.');
      return;
    }
    if (editingUser?.id === currentUser.id && callerIsFullAdmin && role !== 'admin') {
      showError('امکان تغییر نقش حساب مدیر فعلی خودتان وجود ندارد.');
      return;
    }
    setFormData((prev) => {
      const isDefaultTitle =
        !prev.roleTitle.trim() ||
        Object.values(ROLE_LABELS).includes(prev.roleTitle.trim()) ||
        [
          'مدیر کل سیستم',
          'سرپرست فروش و عملیات',
          'صندوق‌دار و فروشنده',
          'مسئول انبار و موجودی',
          'حسابدار و تحلیلگر مالی',
        ].includes(prev.roleTitle.trim());

      return {
        ...prev,
        role,
        roleTitle: isDefaultTitle ? ROLE_LABELS[role] : prev.roleTitle,
        permissions: { ...DEFAULT_ROLE_PERMISSIONS[role] },
        avatarColor:
          role === 'admin'
            ? 'emerald'
            : role === 'supervisor'
            ? 'teal'
            : role === 'cashier'
            ? 'blue'
            : role === 'warehouse'
            ? 'amber'
            : 'purple',
      };
    });
  };

  // Toggle specific permission
  const handleTogglePermission = (key: keyof UserPermissions) => {
    if (!callerIsFullAdmin && key === 'canAccessAdmin') {
      showError('اعطای دسترسی پنل مدیریت کل فقط توسط مدیر سیستم مجاز است.');
      return;
    }
    if (
      editingUser?.id === currentUser.id &&
      (key === 'canManageUsers' || (callerIsFullAdmin && key === 'canAccessAdmin')) &&
      formData.permissions[key]
    ) {
      showError('امکان سلب دسترسی مدیریت یا پنل از حساب فعلی خودتان وجود ندارد.');
      return;
    }
    setFormData((prev) => {
      const updatedPermissions = {
        ...prev.permissions,
        [key]: !prev.permissions[key],
      };
      return {
        ...prev,
        role: 'custom',
        permissions: updatedPermissions,
      };
    });
  };

  // Save User (Add or Edit)
  const handleSubmitForm = (e: React.FormEvent) => {
    e.preventDefault();
    const errors: { [key: string]: string } = {};

    if (!formData.fullName.trim()) {
      errors.fullName = 'لطفاً نام و نام خانوادگی کاربر را وارد کنید.';
    }

    const normalizedUsername = formData.username.trim().toLowerCase();
    if (!normalizedUsername) {
      errors.username = 'لطفاً نام کاربری را وارد کنید.';
    } else if (normalizedUsername.length < 3 || !/^[a-z0-9._-]+$/i.test(normalizedUsername)) {
      errors.username = 'نام کاربری باید حداقل ۳ کاراکتر لاتین (حروف، اعداد، نقطه، خط تیره یا زیرخط) باشد.';
    } else {
      // Check unique username
      const existing = users.find(
        (u) => u.username.toLowerCase() === normalizedUsername && (!editingUser || u.id !== editingUser.id)
      );
      if (existing) {
        errors.username = 'این نام کاربری قبلاً در سیستم ثبت شده است.';
      }
    }

    const enteredPass = formData.pin.trim();
    if (enteredPass && enteredPass.length < 4) {
      errors.pin = 'رمز عبور باید حداقل ۴ کاراکتر باشد.';
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    if (!callerIsFullAdmin && (formData.role === 'admin' || formData.permissions.canAccessAdmin)) {
      showError('تعریف یا ارتقای دسترسی مدیر کل فقط توسط مدیر سیستم مجاز است.');
      return;
    }

    if (editingUser) {
      const isEditingSelf = editingUser.id === currentUser.id;
      if (isEditingSelf && !formData.isActive) {
        showError('امکان غیرفعال‌سازی حساب کاربری فعال خودتان وجود ندارد.');
        return;
      }
      if (isLastActiveAdminTarget(editingUser) && (!formData.isActive || (formData.role !== 'admin' && !formData.permissions.canAccessAdmin))) {
        showError('حداقل یک کاربر مدیر کل فعال باید در سیستم باقی بماند.');
        return;
      }

      const updatedUser: AppUser = {
        ...editingUser,
        fullName: formData.fullName.trim(),
        username: normalizedUsername,
        role: formData.role,
        roleTitle: formData.roleTitle.trim() || ROLE_LABELS[formData.role],
        phone: formData.phone.trim() || undefined,
        ...(enteredPass ? { pin: enteredPass, password: enteredPass } : {}),
        isActive: formData.isActive,
        avatarColor: formData.avatarColor,
        permissions: callerIsFullAdmin ? formData.permissions : { ...formData.permissions, canAccessAdmin: false },
      };
      const res = onUpdateUser(updatedUser);
      if (res && res.success === false) {
        showError(res.message || 'خطا در به‌روزرسانی کاربر.');
        return;
      }
      showSuccess(
        enteredPass
          ? `اطلاعات، رمز ورود جدید و دسترسی‌های کاربر «${updatedUser.fullName}» به‌روزرسانی شد.`
          : `اطلاعات و دسترسی‌های کاربر «${updatedUser.fullName}» به‌روزرسانی شد (رمز عبور قبلی حفظ گردید).`
      );
    } else {
      const initialPass = enteredPass || '1234';
      const res = onAddUser({
        fullName: formData.fullName.trim(),
        username: normalizedUsername,
        role: formData.role,
        roleTitle: formData.roleTitle.trim() || ROLE_LABELS[formData.role],
        phone: formData.phone.trim() || undefined,
        pin: initialPass,
        password: initialPass,
        isActive: formData.isActive,
        avatarColor: formData.avatarColor,
        permissions: callerIsFullAdmin ? formData.permissions : { ...formData.permissions, canAccessAdmin: false },
      });
      if (res && res.success === false) {
        showError(res.message || 'خطا در تعریف کاربر جدید.');
        return;
      }
      showSuccess(`کاربر جدید «${formData.fullName.trim()}» با موفقیت تعریف و رمزنگاری شد.`);
    }

    setIsModalOpen(false);
  };

  // Filtered users list
  const filteredUsers = users.filter((u) => {
    const q = searchQuery.trim().toLowerCase();
    const matchesSearch =
      !q ||
      u.fullName.toLowerCase().includes(q) ||
      u.username.toLowerCase().includes(q) ||
      (u.phone && u.phone.includes(q)) ||
      (u.roleTitle && u.roleTitle.toLowerCase().includes(q));

    const matchesRole = roleFilter === 'all' || u.role === roleFilter;

    return matchesSearch && matchesRole;
  });

  const getAvatarStyle = (color?: string) => {
    const found = AVATAR_COLORS.find((c) => c.id === color) || AVATAR_COLORS[0];
    return found;
  };

  if (currentUser.role !== 'admin' && !currentUser.permissions?.canManageUsers) {
    return (
      <div className="bg-white rounded-3xl p-8 border border-slate-200 text-center max-w-md mx-auto my-12 shadow-sm">
        <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-4 border border-rose-100">
          <ShieldAlert className="w-7 h-7" />
        </div>
        <h3 className="font-extrabold text-base text-slate-800 mb-2">عدم دسترسی به بخش کاربران</h3>
        <p className="text-xs text-slate-500 leading-relaxed">
          مشاهده اسامی، نقش‌ها و رمز عبور کاربران منحصراً در اختیار مدیر کل سامانه است و سایر کاربران امکان دیدن نام همدیگر را ندارند.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Privacy Notice for Admin */}
      <div className="p-3.5 bg-indigo-50/70 border border-indigo-200/80 rounded-2xl flex items-center gap-3 text-xs text-indigo-900">
        <ShieldCheck className="w-5 h-5 text-indigo-600 shrink-0" />
        <div className="leading-relaxed">
          <span className="font-bold">حفظ امنیت و محرمانگی:</span>
          <span> به جز شما به عنوان مدیر، هیچ‌یک از کاربران نمی‌توانند نام همدیگر را در برنامه ببینند. هر کاربر با نام کاربری و رمز ورود اختصاصی خود وارد سیستم می‌شود.</span>
        </div>
      </div>

      {/* Notifications */}
      {actionSuccess && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold rounded-xl flex items-center gap-2 animate-in fade-in duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {actionError && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold rounded-xl flex items-center gap-2 animate-in fade-in duration-200">
          <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {/* Top Banner / Stats Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0 border border-emerald-100">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs text-slate-500 font-medium block">کل کاربران سیستم</span>
            <span className="text-lg font-black text-slate-800">{users.length} نفر</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center shrink-0 border border-blue-100">
            <UserCheck className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs text-slate-500 font-medium block">کاربران فعال و مجاز</span>
            <span className="text-lg font-black text-slate-800">{activeCount} نفر</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center shrink-0 border border-amber-100">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs text-slate-500 font-medium block">تعداد مدیران ارشد</span>
            <span className="text-lg font-black text-slate-800">{adminCount} مدیر</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center shrink-0 border border-purple-100">
            <KeyRound className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <span className="text-xs text-slate-500 font-medium block">کاربر جاری جلسه</span>
            <span className="text-sm font-black text-purple-950 truncate block">
              {currentUser.fullName}
            </span>
            <span className="text-[10px] text-purple-700 font-semibold">
              ({currentUser.roleTitle || ROLE_LABELS[currentUser.role]})
            </span>
          </div>
        </div>
      </div>

      {/* Action Bar & Filters */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              id="users-search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="جستجو بر اساس نام، نام کاربری یا شماره تماس..."
              className="w-full pl-3 pr-9 py-2 rounded-xl text-xs bg-slate-50 border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 focus:bg-white text-slate-800 placeholder-slate-400 transition-all"
            />
          </div>

          {/* Role Filter */}
          <div className="flex items-center gap-1.5 shrink-0">
            <select
              id="users-role-filter"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="py-2 px-3 rounded-xl text-xs bg-slate-50 border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 text-slate-800 font-medium cursor-pointer"
            >
              <option value="all">تمام نقش‌ها ({users.length})</option>
              <option value="admin">مدیران کل</option>
              <option value="supervisor">سرپرستان</option>
              <option value="cashier">صندوق‌داران</option>
              <option value="warehouse">مسئولین انبار</option>
              <option value="accountant">حسابداران</option>
              <option value="custom">سطح دسترسی سفارشی</option>
            </select>
          </div>
        </div>

        {/* Add User Button */}
        <button
          type="button"
          id="add-new-user-btn"
          onClick={handleOpenAdd}
          className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm shadow-emerald-200 cursor-pointer shrink-0"
        >
          <UserPlus className="w-4 h-4" />
          <span>تعریف کاربر جدید با سطح دسترسی</span>
        </button>
      </div>

      {/* Users List Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredUsers.length === 0 ? (
          <div className="col-span-full bg-white rounded-2xl p-8 text-center border border-slate-200">
            <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-sm font-bold text-slate-700">هیچ کاربری با این مشخصات یافت نشد</p>
            <p className="text-xs text-slate-400 mt-1">
              لطفاً فیلترهای جستجو را بازبینی کنید یا کاربر جدید تعریف نمایید.
            </p>
          </div>
        ) : (
          filteredUsers.map((user, userIndex) => {
            const avatarStyle = getAvatarStyle(user.avatarColor);
            const isSelf = user.id === currentUser.id;
            const isProtectedAdmin = !callerIsFullAdmin && isTargetProtectedAdmin(user);
            const isOnlyActiveAdmin = isLastActiveAdminTarget(user);
            const cannotToggleActive = isSelf || isProtectedAdmin || isOnlyActiveAdmin;
            const cannotDeleteUser = isSelf || isProtectedAdmin || isOnlyActiveAdmin;
            const grantedCount = PERMISSION_CONFIG.filter((p) => Boolean(user.permissions[p.key])).length;
            const cardKey = user.id ? `user-card-${user.id}` : `user-card-${userIndex}-${user.username}`;

            return (
              <div
                key={cardKey}
                id={`user-card-${user.id || userIndex}`}
                className={`${
                  userIndex % 2 === 1 ? 'bg-slate-50/90' : 'bg-white'
                } rounded-2xl border transition-all p-5 flex flex-col justify-between relative shadow-xs ${
                  isSelf
                    ? 'border-emerald-500/80 ring-2 ring-emerald-500/10'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div>
                  {/* Card Header: Avatar, Name & Status */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-12 h-12 rounded-2xl ${avatarStyle.bg} text-white flex items-center justify-center text-sm font-black shadow-sm shrink-0`}
                      >
                        {user.fullName.slice(0, 2)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h4 className="text-sm font-black text-slate-900 truncate">
                            {user.fullName}
                          </h4>
                          {isSelf && (
                            <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-1.5 py-0.2 rounded-md shrink-0">
                              کاربر جاری
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-slate-500 block truncate">
                          @{user.username}
                        </span>
                      </div>
                    </div>

                    {/* Active/Inactive Badge with quick toggle */}
                    <button
                      type="button"
                      disabled={cannotToggleActive}
                      onClick={() => {
                        if (cannotToggleActive) return;
                        const updated = { ...user, isActive: !user.isActive };
                        const res = onUpdateUser(updated);
                        if (res && res.success === false) {
                          showError(res.message || 'خطا در تغییر وضعیت کاربر.');
                          return;
                        }
                        showSuccess(`وضعیت حساب کاربری «${user.fullName}» به ${updated.isActive ? 'فعال' : 'غیرفعال'} تغییر یافت.`);
                      }}
                      title={
                        isSelf
                          ? 'امکان غیرفعال‌سازی کاربر جاری وجود ندارد'
                          : isProtectedAdmin
                          ? 'تغییر وضعیت حساب مدیر کل فقط برای مدیر سیستم مجاز است'
                          : isOnlyActiveAdmin
                          ? 'حداقل یک کاربر مدیر فعال باید در سیستم باقی بماند'
                          : 'کلیک کنید تا وضعیت فعال/غیرفعال تغییر یابد'
                      }
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 flex items-center gap-1 transition-all ${
                        cannotToggleActive ? 'cursor-default opacity-80' : 'cursor-pointer hover:opacity-80'
                      } ${
                        user.isActive
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-rose-50 text-rose-700 border border-rose-200'
                      }`}
                    >
                      {user.isActive ? (
                        <>
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                          <span>فعال</span>
                        </>
                      ) : (
                        <>
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                          <span>غیرفعال</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Role Title & Phone info */}
                  <div className="bg-slate-50/80 rounded-xl p-2.5 mb-3 border border-slate-100 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
                      <span className="font-bold text-slate-700">
                        {user.roleTitle || ROLE_LABELS[user.role]}
                      </span>
                    </div>
                    {user.phone && (
                      <div className="flex items-center gap-1 text-slate-500 font-mono text-[11px]">
                        <Phone className="w-3 h-3 text-slate-400" />
                        <span>{user.phone}</span>
                      </div>
                    )}
                  </div>

                  {/* Permissions Summary Badges */}
                  <div className="space-y-2 mb-4">
                    <div className="flex items-center justify-between text-[11px] text-slate-500">
                      <span>سطوح دسترسی مجاز:</span>
                      <span className="font-bold text-slate-700">{grantedCount} از {PERMISSION_CONFIG.length} دسترسی</span>
                    </div>

                    <div className="flex flex-wrap gap-1">
                      {PERMISSION_CONFIG.filter((p) => Boolean(user.permissions[p.key])).map((p) => {
                        let colorClasses = 'bg-slate-100 text-slate-700 border-slate-200';
                        if (p.key === 'canCreateInvoice') colorClasses = 'bg-emerald-50 text-emerald-700 border-emerald-200/60';
                        else if (p.key === 'canCreatePurchaseInvoice') colorClasses = 'bg-orange-50 text-orange-800 border-orange-200/70';
                        else if (p.key === 'canViewPurchaseInvoices') colorClasses = 'bg-amber-50/70 text-amber-800 border-amber-200/60';
                        else if (p.key === 'canSettleInvoices') colorClasses = 'bg-teal-50 text-teal-800 border-teal-200/70';
                        else if (p.key === 'canDeleteInvoice') colorClasses = 'bg-rose-50 text-rose-700 border-rose-200/60';
                        else if (p.key === 'canManageInventory') colorClasses = 'bg-amber-50 text-amber-800 border-amber-200/60';
                        else if (p.key === 'canManageCustomers') colorClasses = 'bg-blue-50 text-blue-700 border-blue-200/60';
                        else if (p.key === 'canViewReports') colorClasses = 'bg-purple-50 text-purple-700 border-purple-200/60';
                        else if (p.key === 'canAccessAdmin') colorClasses = 'bg-emerald-100 text-emerald-800 border-emerald-300 font-bold';
                        else if (p.key === 'canManageUsers') colorClasses = 'bg-indigo-100 text-indigo-800 border-indigo-300 font-bold';

                        return (
                          <span
                            key={`badge-${user.id || userIndex}-${p.key}`}
                            className={`text-[10px] px-2 py-0.5 rounded-md font-medium border ${colorClasses}`}
                          >
                            {p.title}
                          </span>
                        );
                      })}
                      {grantedCount === 0 && (
                        <span key={`badge-${user.id || userIndex}-none`} className="text-[10px] text-slate-400 italic">
                          بدون دسترسی مشخص
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                  {/* User Password Security Status for Admin */}
                  <div className="bg-slate-50 rounded-xl p-2.5 mb-3 border border-slate-100 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Lock className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span className="text-[11px] text-slate-500 font-medium">رمز ورود:</span>
                      <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 text-[10px]">
                        رمزنگاری‌شده (امن)
                      </span>
                    </div>
                    <button
                      type="button"
                      disabled={isProtectedAdmin}
                      onClick={() => handleOpenEdit(user)}
                      title={isProtectedAdmin ? 'تغییر رمز مدیر کل فقط توسط مدیر سیستم مجاز است' : 'تغییر رمز عبور'}
                      className={`text-[11px] font-semibold shrink-0 ${
                        isProtectedAdmin
                          ? 'text-slate-300 cursor-not-allowed'
                          : 'text-emerald-700 hover:text-emerald-800 cursor-pointer'
                      }`}
                    >
                      تغییر رمز
                    </button>
                  </div>

                {/* Footer Action Buttons */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  {/* Switch User Button */}
                  <button
                    type="button"
                    id={`switch-user-btn-${user.id}`}
                    disabled={isSelf || !user.isActive}
                    onClick={() => {
                      onSwitchUser(user);
                    }}
                    title={
                      isSelf
                        ? 'در حال حاضر با این کاربر وارد سیستم شده‌اید'
                        : !user.isActive
                        ? 'این حساب کاربری غیرفعال است'
                        : 'ورود به سیستم به عنوان این کاربر'
                    }
                    className={`flex-1 py-1.5 px-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                      isSelf
                        ? 'bg-emerald-50 text-emerald-700 cursor-default border border-emerald-200'
                        : !user.isActive
                        ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                        : 'bg-slate-100 hover:bg-emerald-600 hover:text-white text-slate-700 cursor-pointer'
                    }`}
                  >
                    <ArrowRightLeft className="w-3.5 h-3.5" />
                    <span>{isSelf ? 'کاربر فعال جاری' : 'ورود با این کاربر'}</span>
                  </button>

                  <div className="flex items-center gap-1">
                    {/* Edit Button */}
                    <button
                      type="button"
                      id={`edit-user-btn-${user.id}`}
                      disabled={isProtectedAdmin}
                      onClick={() => handleOpenEdit(user)}
                      title={
                        isProtectedAdmin
                          ? 'ویرایش حساب‌های مدیر کل فقط برای مدیر سیستم مجاز است'
                          : 'ویرایش مشخصات و دسترسی‌ها'
                      }
                      className={`p-1.5 rounded-xl transition-colors ${
                        isProtectedAdmin
                          ? 'text-slate-300 cursor-not-allowed opacity-40'
                          : 'text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 cursor-pointer'
                      }`}
                    >
                      <Edit className="w-4 h-4" />
                    </button>

                    {/* Delete Button */}
                    <button
                      type="button"
                      id={`delete-user-btn-${user.id}`}
                      disabled={cannotDeleteUser}
                      onClick={() => setUserToDelete(user)}
                      title={
                        isSelf
                          ? 'حساب کاربری فعال جاری قابل حذف نیست'
                          : isProtectedAdmin
                          ? 'حذف حساب‌های مدیر کل فقط برای مدیر سیستم مجاز است'
                          : isOnlyActiveAdmin
                          ? 'حداقل یک کاربر مدیر فعال باید در سامانه باقی بماند'
                          : 'حذف کاربر'
                      }
                      className={`p-1.5 rounded-xl transition-colors ${
                        cannotDeleteUser
                          ? 'text-slate-300 cursor-not-allowed opacity-40'
                          : 'text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer'
                      }`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Add / Edit User Modal */}
      {isModalOpen && (
        <div
          id="user-form-modal"
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150 overflow-y-auto"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-2xl max-w-2xl w-full p-5 sm:p-6 shadow-2xl border border-slate-200 text-right my-auto max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {editingUser
                      ? `ویرایش کاربر: ${editingUser.fullName}`
                      : 'تعریف کاربر جدید با سطوح دسترسی اختصاصی'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    مشخصات کاربری، نقش اولیه و تیک‌های تفکیک‌شده اختیارات سیستم
                  </p>
                </div>
              </div>
              <button
                type="button"
                id="close-user-modal-btn"
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitForm} className="space-y-5">
              {/* Section 1: Basic Information */}
              <div>
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5 text-emerald-600" />
                  <span>۱. اطلاعات هویتی و ورود به سیستم</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      نام و نام خانوادگی <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      id="user-fullname-input"
                      value={formData.fullName}
                      onChange={(e) =>
                        setFormData((p) => ({ ...p, fullName: e.target.value }))
                      }
                      placeholder="مثال: سارا محمدی"
                      className={`w-full px-3 py-2 rounded-xl text-xs bg-slate-50 border ${
                        formErrors.fullName ? 'border-rose-400 bg-rose-50/50' : 'border-slate-200'
                      } focus:outline-hidden focus:ring-2 focus:ring-emerald-500`}
                    />
                    {formErrors.fullName && (
                      <p className="text-[11px] text-rose-500 mt-1">{formErrors.fullName}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      نام کاربری (لاتین) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      id="user-username-input"
                      value={formData.username}
                      onChange={(e) =>
                        setFormData((p) => ({ ...p, username: e.target.value }))
                      }
                      placeholder="مثال: sara_pos"
                      className={`w-full px-3 py-2 rounded-xl text-xs bg-slate-50 border font-mono ${
                        formErrors.username ? 'border-rose-400 bg-rose-50/50' : 'border-slate-200'
                      } focus:outline-hidden focus:ring-2 focus:ring-emerald-500`}
                    />
                    {formErrors.username && (
                      <p className="text-[11px] text-rose-500 mt-1">{formErrors.username}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      سمت / عنوان سازمانی (اختیاری)
                    </label>
                    <input
                      type="text"
                      id="user-roletitle-input"
                      value={formData.roleTitle}
                      onChange={(e) =>
                        setFormData((p) => ({ ...p, roleTitle: e.target.value }))
                      }
                      placeholder="مثال: مسئول صندوق شیفت صبح"
                      className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      شماره موبایل / تماس (اختیاری)
                    </label>
                    <input
                      type="tel"
                      id="user-phone-input"
                      value={formData.phone}
                      onChange={(e) =>
                        setFormData((p) => ({ ...p, phone: e.target.value }))
                      }
                      placeholder="۰۹۱۲۳۴۵۶۷۸۹"
                      className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 border border-slate-200 font-mono focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-bold text-slate-700">
                        رمز ورود به سیستم (کلمه عبور) <span className="text-rose-500">*</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => setFormData((p) => ({ ...p, pin: '1234' }))}
                        className="text-[10px] text-emerald-700 hover:text-emerald-800 font-bold cursor-pointer"
                      >
                        تنظیم سریع «1234»
                      </button>
                    </div>
                    <div className="relative">
                      <input
                        type={showFormPassword ? 'text' : 'password'}
                        id="user-pin-input"
                        value={formData.pin}
                        onChange={(e) =>
                          setFormData((p) => ({ ...p, pin: e.target.value }))
                        }
                        placeholder={editingUser ? 'برای حفظ رمز فعلی خالی بگذارید' : 'رمز عبور کاربر (پیش‌فرض: 1234)'}
                        dir="ltr"
                        className="w-full pl-10 pr-3 py-2 rounded-xl text-xs bg-slate-50 border border-slate-200 font-mono focus:outline-hidden focus:ring-2 focus:ring-emerald-500 text-slate-800"
                      />
                      <button
                        type="button"
                        onClick={() => setShowFormPassword((p) => !p)}
                        className="absolute left-3 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                        title={showFormPassword ? 'مخفی‌سازی رمز' : 'نمایش رمز'}
                      >
                        {showFormPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1 leading-normal">
                      کاربر با وارد کردن نام کاربری و این رمز وارد می‌شود. جهت امنیت، نام سایر کاربران به یکدیگر نمایش داده نمی‌شود.
                    </p>
                    {formErrors.pin && (
                      <p className="text-[11px] text-rose-500 mt-1">{formErrors.pin}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      وضعیت حساب کاربری
                    </label>
                    <div className="flex items-center gap-3 pt-1.5">
                      <label className={`flex items-center gap-2 text-xs font-medium ${
                        editingUser && (editingUser.id === currentUser.id || isLastActiveAdminTarget(editingUser))
                          ? 'text-slate-400 cursor-not-allowed'
                          : 'text-slate-700 cursor-pointer'
                      }`}>
                        <input
                          type="checkbox"
                          id="user-active-checkbox"
                          disabled={Boolean(editingUser && (editingUser.id === currentUser.id || isLastActiveAdminTarget(editingUser)))}
                          checked={formData.isActive}
                          onChange={(e) =>
                            setFormData((p) => ({ ...p, isActive: e.target.checked }))
                          }
                          className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300 disabled:opacity-50"
                        />
                        <span>حساب کاربری فعال و مجاز به ورود است</span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              {/* Section 2: Role Presets */}
              <div className="pt-3 border-t border-slate-100">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span>۲. الگوی نقش پیش‌فرض (تکمیل خودکار دسترسی‌ها)</span>
                  </h4>
                  <span className="text-[11px] text-slate-400">
                    انتخاب نقش پیش‌فرض تیک‌های زیر را متناسب با وظیفه تنظیم می‌کند
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                  {callerIsFullAdmin && (
                    <button
                      type="button"
                      onClick={() => handleRolePresetSelect('admin')}
                      className={`p-2.5 rounded-xl border text-right transition-all cursor-pointer ${
                        formData.role === 'admin'
                          ? 'bg-emerald-50 border-emerald-500 ring-2 ring-emerald-200'
                          : 'bg-slate-50 hover:bg-slate-100 border-slate-200'
                      }`}
                    >
                      <div className="text-xs font-bold text-slate-800">مدیر کل</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">تمام اختیارات سیستم</div>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => handleRolePresetSelect('supervisor')}
                    className={`p-2.5 rounded-xl border text-right transition-all cursor-pointer ${
                      formData.role === 'supervisor'
                        ? 'bg-teal-50 border-teal-500 ring-2 ring-teal-200'
                        : 'bg-slate-50 hover:bg-slate-100 border-slate-200'
                    }`}
                  >
                    <div className="text-xs font-bold text-slate-800">سرپرست</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">همه بجز پنل و کاربر</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleRolePresetSelect('cashier')}
                    className={`p-2.5 rounded-xl border text-right transition-all cursor-pointer ${
                      formData.role === 'cashier'
                        ? 'bg-blue-50 border-blue-500 ring-2 ring-blue-200'
                        : 'bg-slate-50 hover:bg-slate-100 border-slate-200'
                    }`}
                  >
                    <div className="text-xs font-bold text-slate-800">صندوق‌دار</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">صدور فاکتور و مشتریان</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleRolePresetSelect('warehouse')}
                    className={`p-2.5 rounded-xl border text-right transition-all cursor-pointer ${
                      formData.role === 'warehouse'
                        ? 'bg-amber-50 border-amber-500 ring-2 ring-amber-200'
                        : 'bg-slate-50 hover:bg-slate-100 border-slate-200'
                    }`}
                  >
                    <div className="text-xs font-bold text-slate-800">انباردار</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">مدیریت موجودی و کالا</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleRolePresetSelect('accountant')}
                    className={`p-2.5 rounded-xl border text-right transition-all cursor-pointer ${
                      formData.role === 'accountant'
                        ? 'bg-purple-50 border-purple-500 ring-2 ring-purple-200'
                        : 'bg-slate-50 hover:bg-slate-100 border-slate-200'
                    }`}
                  >
                    <div className="text-xs font-bold text-slate-800">حسابدار</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">فقط مشاهده و گزارش‌گیری (بدون ثبت/تغییر/حذف)</div>
                  </button>
                </div>
              </div>

              {/* Section 3: Granular Permissions Checklist */}
              <div className="pt-3 border-t border-slate-100">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <KeyRound className="w-3.5 h-3.5 text-emerald-600" />
                    <span>۳. تنظیم دقیق دسترسی‌های مجاز (چک‌باکس‌ها)</span>
                  </h4>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setFormData((p) => ({
                          ...p,
                          role: callerIsFullAdmin ? 'admin' : 'custom',
                          permissions: callerIsFullAdmin
                            ? { ...DEFAULT_ROLE_PERMISSIONS.admin }
                            : { ...DEFAULT_ROLE_PERMISSIONS.admin, canAccessAdmin: false },
                        }))
                      }
                      className="text-[11px] text-emerald-700 font-bold hover:underline cursor-pointer"
                    >
                      انتخاب همه
                    </button>
                    <span className="text-slate-300">|</span>
                    <button
                      type="button"
                      onClick={() =>
                        setFormData((p) => ({
                          ...p,
                          role: 'custom',
                          permissions: {
                            canCreateInvoice: false,
                            canViewInvoices: false,
                            canCreatePurchaseInvoice: false,
                            canViewPurchaseInvoices: false,
                            canSettleInvoices: false,
                            canDeleteInvoice: false,
                            canManageInventory: false,
                            canManageCustomers: false,
                            canViewReports: false,
                            canViewBuyPrices: false,
                            canAccessAdmin: false,
                            canManageUsers: false,
                          },
                        }))
                      }
                      className="text-[11px] text-rose-600 font-bold hover:underline cursor-pointer"
                    >
                      لغو همه
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {PERMISSION_CONFIG.map((perm) => {
                    const isChecked = formData.permissions[perm.key];
                    const isLockedPerm =
                      (!callerIsFullAdmin && perm.key === 'canAccessAdmin') ||
                      Boolean(
                        editingUser?.id === currentUser.id &&
                        (perm.key === 'canManageUsers' || (callerIsFullAdmin && perm.key === 'canAccessAdmin')) &&
                        isChecked
                      );

                    return (
                      <label
                        key={perm.key}
                        id={`perm-toggle-${perm.key}`}
                        className={`p-3 rounded-xl border flex items-start gap-3 transition-all ${
                          isLockedPerm
                            ? 'bg-slate-100/80 border-slate-200 cursor-not-allowed opacity-70'
                            : isChecked
                            ? 'bg-emerald-50/60 border-emerald-300 shadow-xs cursor-pointer'
                            : 'bg-slate-50/70 border-slate-200 hover:bg-slate-100/60 cursor-pointer'
                        }`}
                      >
                        <input
                          type="checkbox"
                          disabled={isLockedPerm}
                          checked={isChecked}
                          onChange={() => handleTogglePermission(perm.key)}
                          className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300 mt-0.5 shrink-0 disabled:opacity-50"
                        />
                        <div className="min-w-0">
                          <span
                            className={`text-xs font-bold block ${
                              isChecked ? 'text-emerald-950' : 'text-slate-800'
                            }`}
                          >
                            {perm.title}
                          </span>
                          <span className="text-[10px] text-slate-500 leading-normal block mt-0.5">
                            {perm.description}
                          </span>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Modal Actions */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  id="cancel-user-modal-btn"
                  onClick={() => setIsModalOpen(false)}
                  className="py-2 px-4 rounded-xl text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  id="save-user-submit-btn"
                  className="py-2 px-5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm shadow-emerald-200 transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>{editingUser ? 'بروزرسانی اطلاعات کاربر' : 'ثبت و تعریف کاربر جدید'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {userToDelete && (
        <div
          id="delete-user-confirm-modal"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 text-right">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mb-4 mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900 text-center mb-2">
              حذف حساب کاربری
            </h3>
            <p className="text-sm text-slate-600 text-center mb-6 leading-relaxed">
              آیا از حذف حساب کاربری <span className="font-bold text-slate-800">«{userToDelete.fullName}»</span> (نام کاربری: @{userToDelete.username}) اطمینان دارید؟
            </p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                id="cancel-delete-user-btn"
                onClick={() => setUserToDelete(null)}
                className="flex-1 py-2.5 px-4 rounded-xl text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
              >
                انصراف
              </button>
              <button
                type="button"
                id="confirm-delete-user-btn"
                onClick={() => {
                  const result = onDeleteUser(userToDelete.id);
                  if (result.success) {
                    showSuccess(`کاربر «${userToDelete.fullName}» با موفقیت حذف شد.`);
                  } else {
                    showError(result.message || 'خطا در حذف کاربر.');
                  }
                  setUserToDelete(null);
                }}
                className="flex-1 py-2.5 px-4 rounded-xl text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 shadow-sm shadow-rose-200 transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" />
                <span>بله، حذف شود</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
