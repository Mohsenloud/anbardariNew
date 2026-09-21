import React from 'react';
import { AppUser, UserPermissions } from '../types';
import { hasPermission } from '../utils/permissions';

export interface PermissionGuardProps {
  /** The currently logged-in user */
  currentUser?: AppUser | null;
  /** Single permission key or array of keys */
  permission?: keyof UserPermissions | (keyof UserPermissions)[];
  /** If multiple permissions are passed, require all of them (default: false, meaning any) */
  requireAll?: boolean;
  /** Optional role restrictions (e.g. 'admin') */
  role?: string | string[];
  /** Fallback node when unauthorized. Defaults to null (completely hides from DOM) */
  fallback?: React.ReactNode;
  /** Content to render when authorized */
  children: React.ReactNode;
}

/**
 * PermissionGuard ensures that any restricted UI element (button, tab, card, or modal)
 * is completely hidden from the DOM if the current user lacks the required permission or role.
 */
export const PermissionGuard: React.FC<PermissionGuardProps> = ({
  currentUser,
  permission,
  requireAll = false,
  role,
  fallback = null,
  children,
}) => {
  if (!currentUser) {
    return <>{fallback}</>;
  }

  // System admin role always has master access to all components
  if (currentUser.role === 'admin') {
    return <>{children}</>;
  }

  // Check role requirement if specified
  if (role) {
    const roles = Array.isArray(role) ? role : [role];
    if (!roles.includes(currentUser.role)) {
      return <>{fallback}</>;
    }
  }

  // Check specific granular permissions
  if (permission) {
    const isAllowed = hasPermission(currentUser, permission, requireAll);
    if (!isAllowed) {
      return <>{fallback}</>;
    }
  }

  return <>{children}</>;
};

export default PermissionGuard;
