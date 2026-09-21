import { AppUser, StoreSettings, UserRole } from '../types';

/**
 * Checks whether a given application navigation tab is permitted for the active user
 * and compliant with overall system store settings.
 */
export function isTabPermitted(
  tab: string,
  user?: AppUser | null,
  settings?: StoreSettings
): boolean {
  if (!user) return false;

  switch (tab) {
    case 'dashboard':
      return true; // Dashboard is universally accessible for all authenticated users to see overview and quick actions

    case 'new-invoice':
      return Boolean(user.permissions.canCreateInvoice);

    case 'invoices':
      return Boolean(user.permissions.canViewInvoices);

    case 'purchases':
      return Boolean(
        user.permissions.canCreateInvoice ||
        user.permissions.canManageInventory ||
        user.permissions.canAccessAdmin ||
        user.permissions.canViewInvoices
      );

    case 'inventory':
      return (
        settings?.enableInventory !== false &&
        Boolean(user.permissions.canManageInventory)
      );

    case 'customers':
      return (
        settings?.enableCustomers !== false &&
        Boolean(user.permissions.canManageCustomers)
      );

    case 'reports':
      return (
        settings?.enableReports !== false &&
        Boolean(user.permissions.canViewReports)
      );

    case 'admin':
      return Boolean(
        user.permissions.canAccessAdmin || user.permissions.canManageUsers
      );

    default:
      return false;
  }
}

/**
 * Determines the optimal and most relevant landing tab for a user immediately upon login,
 * according to their role archetype and granted permissions.
 */
export function getDefaultTabForUser(
  user?: AppUser | null,
  settings?: StoreSettings
): string {
  if (!user) return 'dashboard';

  // Role-specific targeted landing tabs
  if (
    user.role === 'warehouse' &&
    isTabPermitted('inventory', user, settings)
  ) {
    return 'inventory';
  }

  // General dashboard provides immediate overview and 1-tap quick actions
  if (isTabPermitted('dashboard', user, settings)) return 'dashboard';

  // Ordered priority evaluation
  if (isTabPermitted('new-invoice', user, settings)) return 'new-invoice';
  if (isTabPermitted('inventory', user, settings)) return 'inventory';
  if (isTabPermitted('invoices', user, settings)) return 'invoices';
  if (isTabPermitted('reports', user, settings)) return 'reports';
  if (isTabPermitted('customers', user, settings)) return 'customers';
  if (isTabPermitted('admin', user, settings)) return 'admin';

  return 'dashboard';
}

/**
 * Returns list of all tab IDs currently allowed for the given user
 */
export function getAllowedTabsForUser(
  user?: AppUser | null,
  settings?: StoreSettings
): string[] {
  if (!user) return [];
  const allTabs = ['dashboard', 'new-invoice', 'invoices', 'purchases', 'inventory', 'customers', 'reports', 'admin'];
  return allTabs.filter((tab) => isTabPermitted(tab, user, settings));
}

/**
 * Visual styling and label for user role badge
 */
export function getRoleBadgeConfig(role: UserRole): {
  label: string;
  badgeBg: string;
  badgeText: string;
  borderColor: string;
} {
  switch (role) {
    case 'admin':
      return {
        label: 'مدیر کل سیستم',
        badgeBg: 'bg-emerald-100',
        badgeText: 'text-emerald-800',
        borderColor: 'border-emerald-200',
      };
    case 'cashier':
      return {
        label: 'صندوق‌دار و فروشنده',
        badgeBg: 'bg-blue-100',
        badgeText: 'text-blue-800',
        borderColor: 'border-blue-200',
      };
    case 'warehouse':
      return {
        label: 'مسئول انبار و موجودی',
        badgeBg: 'bg-amber-100',
        badgeText: 'text-amber-800',
        borderColor: 'border-amber-200',
      };
    case 'accountant':
      return {
        label: 'حسابدار و تحلیلگر مالی',
        badgeBg: 'bg-purple-100',
        badgeText: 'text-purple-800',
        borderColor: 'border-purple-200',
      };
    default:
      return {
        label: 'دسترسی سفارشی',
        badgeBg: 'bg-slate-100',
        badgeText: 'text-slate-800',
        borderColor: 'border-slate-200',
      };
  }
}

/**
 * Checks whether a user holds specific permission(s).
 * - If user is 'admin', returns true immediately.
 * - Supports single permission key or array of keys (either ANY or ALL based on requireAll).
 * - If user lacks permission, returns false so that UI elements can be completely hidden.
 */
export function hasPermission(
  user?: AppUser | null,
  permission?: keyof AppUser['permissions'] | (keyof AppUser['permissions'])[],
  requireAll: boolean = false
): boolean {
  if (!user) return false;
  if (user.role === 'admin') return true;
  if (!permission) return true;

  if (Array.isArray(permission)) {
    if (permission.length === 0) return true;
    return requireAll
      ? permission.every((p) => Boolean(user.permissions?.[p]))
      : permission.some((p) => Boolean(user.permissions?.[p]));
  }

  return Boolean(user.permissions?.[permission]);
}

