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
    case 'new-invoice':
      return Boolean(user.permissions.canCreateInvoice);

    case 'invoices':
      return Boolean(user.permissions.canViewInvoices);

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
  if (!user) return 'invoices';

  // Role-specific targeted landing tabs
  if (
    user.role === 'warehouse' &&
    isTabPermitted('inventory', user, settings)
  ) {
    return 'inventory';
  }

  if (
    user.role === 'accountant' &&
    isTabPermitted('reports', user, settings)
  ) {
    return 'reports';
  }

  if (
    user.role === 'cashier' &&
    isTabPermitted('new-invoice', user, settings)
  ) {
    return 'new-invoice';
  }

  // Ordered priority evaluation
  if (isTabPermitted('new-invoice', user, settings)) return 'new-invoice';
  if (isTabPermitted('inventory', user, settings)) return 'inventory';
  if (isTabPermitted('invoices', user, settings)) return 'invoices';
  if (isTabPermitted('reports', user, settings)) return 'reports';
  if (isTabPermitted('customers', user, settings)) return 'customers';
  if (isTabPermitted('admin', user, settings)) return 'admin';

  return 'invoices';
}

/**
 * Returns list of all tab IDs currently allowed for the given user
 */
export function getAllowedTabsForUser(
  user?: AppUser | null,
  settings?: StoreSettings
): string[] {
  if (!user) return [];
  const allTabs = ['new-invoice', 'invoices', 'inventory', 'customers', 'reports', 'admin'];
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
