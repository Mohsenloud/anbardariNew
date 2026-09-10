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
  onAddUser: (userData: Omit<AppUser, 'id' | 'createdAt'>) => void;
  onUpdateUser: (user: AppUser) => void;
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
    title: 'صدور فاکتور جدید',
    description: 'دسترسی به فرم صدور فاکتور فروش، محاسبه مالیات و تخفیف',
  },
  {
    key: 'canViewInvoices',
    title: 'مشاهده و چاپ فاکتورها',
    description: 'مشاهده لیست، جستجو، چاپ قالب‌ها و دانلود فاکتورها',
  },
  {
    key: 'canDeleteInvoice',
    title: 'حذف و مرجوعی فاکتورها',
    description: 'امکان حذف کامل فاکتور یا مرجوع کردن اقلام به انبار',
  },
  {
    key: 'canManageInventory',
    title: 'انبارداری و مدیریت کالا',
    description: 'تعریف کالای جدید، ویرایش قیمت‌ها، اصلاح دستی موجودی و کاردکس',
  },
  {
    key: 'canManageCustomers',
    title: 'مدیریت دفتر مشتریان',
    description: 'تعریف، ویرایش و ثبت اطلاعات هویتی و مالی مشتریان',
  },
  {
    key: 'canViewReports',
    title: 'گزارش‌های مالی و سود',
    description: 'دسترسی به نمودارهای تحلیلی، سود ناخالص و کالاهای پرفروش',
  },
  {
    key: 'canAccessAdmin',
    title: 'دسترسی به پنل مدیریت',
    description: 'پیکربندی هویت فروشگاه، قوانین فاکتورساز و پشتیبان‌گیری',
  },
  {
    key: 'canManageUsers',
    title: 'مدیریت کاربران و دسترسی‌ها',
    description: 'تعریف کاربر جدید، ویرایش نقش‌ها و تغییر سطوح دسترسی',
  },
];

const AVATAR_COLORS = [
  { id: 'emerald', label: 'سبز زمردی', bg: 'bg-emerald-600', lightBg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
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
  const [showCardPasswords, setShowCardPasswords] = useState<{ [userId: string]: boolean }>({});

  const toggleCardPassword = (id: string) => {
    setShowCardPasswords((prev) => ({ ...prev, [id]: !prev[id] }));
  };

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
    setEditingUser(user);
    setShowFormPassword(false);
    setFormData({
      fullName: user.fullName,
      username: user.username,
      role: user.role,
      roleTitle: user.roleTitle || ROLE_LABELS[user.role] || '',
      phone: user.phone || '',
      pin: user.password || user.pin || '1234',
      isActive: user.isActive,
      avatarColor: user.avatarColor || 'emerald',
      permissions: { ...user.permissions },
    });
    setFormErrors({});
    setIsModalOpen(true);
  };

  // Handle Preset Role Selection in Form
  const handleRolePresetSelect = (role: UserRole) => {
    setFormData((prev) => ({
      ...prev,
      role,
      roleTitle: prev.roleTitle || ROLE_LABELS[role],
      permissions: { ...DEFAULT_ROLE_PERMISSIONS[role] },
      avatarColor:
        role === 'admin' ? 'emerald' : role === 'cashier' ? 'blue' : role === 'warehouse' ? 'amber' : 'purple',
    }));
  };

  // Toggle specific permission
  const handleTogglePermission = (key: keyof UserPermissions) => {
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

    if (!formData.username.trim()) {
      errors.username = 'لطفاً نام کاربری را وارد کنید.';
    } else {
      // Check unique username
      const normalizedUsername = formData.username.trim().toLowerCase();
      const existing = users.find(
        (u) => u.username.toLowerCase() === normalizedUsername && (!editingUser || u.id !== editingUser.id)
      );
      if (existing) {
        errors.username = 'این نام کاربری قبلاً در سیستم ثبت شده است.';
      }
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    const rawPass = formData.pin.trim() || '1234';

    if (editingUser) {
      const updatedUser: AppUser = {
        ...editingUser,
        fullName: formData.fullName.trim(),
        username: formData.username.trim(),
        role: formData.role,
        roleTitle: formData.roleTitle.trim() || ROLE_LABELS[formData.role],
        phone: formData.phone.trim() || undefined,
        pin: rawPass,
        password: rawPass,
        isActive: formData.isActive,
        avatarColor: formData.avatarColor,
        permissions: formData.permissions,
      };
      onUpdateUser(updatedUser);
      showSuccess(`اطلاعات، رمز ورود و دسترسی‌های کاربر «${updatedUser.fullName}» به‌روزرسانی شد.`);
    } else {
      onAddUser({
        fullName: formData.fullName.trim(),
        username: formData.username.trim(),
        role: formData.role,
        roleTitle: formData.roleTitle.trim() || ROLE_LABELS[formData.role],
        phone: formData.phone.trim() || undefined,
        pin: rawPass,
        password: rawPass,
        isActive: formData.isActive,
        avatarColor: formData.avatarColor,
        permissions: formData.permissions,
      });
      showSuccess(`کاربر جدید «${formData.fullName}» با رمز «${rawPass}» با موفقیت تعریف شد.`);
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

  const activeCount = users.filter((u) => u.isActive).length;
  const adminCount = users.filter((u) => u.role === 'admin' && u.isActive).length;

  if (currentUser.role !== 'admin') {
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
            const grantedCount = Object.values(user.permissions).filter(Boolean).length;
            const cardKey = user.id ? `user-card-${user.id}` : `user-card-${userIndex}-${user.username}`;

            return (
              <div
                key={cardKey}
                id={`user-card-${user.id || userIndex}`}
                className={`bg-white rounded-2xl border transition-all p-5 flex flex-col justify-between relative shadow-xs ${
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

                    {/* Active/Inactive Badge */}
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 flex items-center gap-1 ${
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
                    </span>
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
                      <span className="font-bold text-slate-700">{grantedCount} از ۸ دسترسی</span>
                    </div>

                    <div className="flex flex-wrap gap-1">
                      {PERMISSION_CONFIG.filter((p) => user.permissions[p.key]).map((p) => {
                        let colorClasses = 'bg-slate-100 text-slate-700 border-slate-200';
                        if (p.key === 'canCreateInvoice') colorClasses = 'bg-emerald-50 text-emerald-700 border-emerald-200/60';
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

                  {/* User Password Info for Admin */}
                  <div className="bg-slate-50 rounded-xl p-2.5 mb-3 border border-slate-100 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Lock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="text-[11px] text-slate-500 font-medium">رمز ورود:</span>
                      <span className="font-mono font-bold text-slate-800 bg-white px-2 py-0.5 rounded-md border border-slate-200 text-xs">
                        {showCardPasswords[user.id] ? (user.password || user.pin || '1234') : '••••'}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleCardPassword(user.id)}
                      className="text-[11px] text-emerald-700 hover:text-emerald-800 font-semibold cursor-pointer shrink-0"
                    >
                      {showCardPasswords[user.id] ? 'مخفی' : 'مشاهده رمز'}
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
                      showSuccess(`نشست فعال به کاربر «${user.fullName}» تغییر یافت.`);
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
                      onClick={() => handleOpenEdit(user)}
                      title="ویرایش مشخصات و دسترسی‌ها"
                      className="p-1.5 text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-xl transition-colors cursor-pointer"
                    >
                      <Edit className="w-4 h-4" />
                    </button>

                    {/* Delete Button */}
                    <button
                      type="button"
                      id={`delete-user-btn-${user.id}`}
                      onClick={() => setUserToDelete(user)}
                      title="حذف کاربر"
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
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
                        placeholder="رمز عبور کاربر (پیش‌فرض: 1234)"
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
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      وضعیت حساب کاربری
                    </label>
                    <div className="flex items-center gap-3 pt-1.5">
                      <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-700">
                        <input
                          type="checkbox"
                          id="user-active-checkbox"
                          checked={formData.isActive}
                          onChange={(e) =>
                            setFormData((p) => ({ ...p, isActive: e.target.checked }))
                          }
                          className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300"
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

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
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
                    <div className="text-[10px] text-slate-500 mt-0.5">گزارشات و فاکتورها</div>
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
                          role: 'admin',
                          permissions: { ...DEFAULT_ROLE_PERMISSIONS.admin },
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
                            canDeleteInvoice: false,
                            canManageInventory: false,
                            canManageCustomers: false,
                            canViewReports: false,
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

                    return (
                      <label
                        key={perm.key}
                        id={`perm-toggle-${perm.key}`}
                        className={`p-3 rounded-xl border flex items-start gap-3 cursor-pointer transition-all ${
                          isChecked
                            ? 'bg-emerald-50/60 border-emerald-300 shadow-xs'
                            : 'bg-slate-50/70 border-slate-200 hover:bg-slate-100/60'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleTogglePermission(perm.key)}
                          className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300 mt-0.5 shrink-0"
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
