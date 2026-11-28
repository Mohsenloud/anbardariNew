import { AppUser, Invoice, UserRole } from '../types';
import { ROLE_LABELS, StorageService } from './storage';

export interface ResolvedInvoiceCreator {
  id?: string;
  name: string;
  role: string;
  phone: string;
  username: string;
  convertedByName?: string;
  hasCreator: boolean;
}

export interface InvoiceCreatorFields {
  createdById?: string;
  createdByName?: string;
  createdByRole?: string;
  createdByPhone?: string;
  createdByUsername?: string;
}

/**
 * Extracts consistent creator attribution fields from a specific AppUser instance.
 */
export function getCreatorFieldsFromUser(user?: AppUser | null): InvoiceCreatorFields {
  if (!user) return {};
  const name = (user.fullName || user.name || user.username || '').trim();
  const role = (user.roleTitle || (user.role ? ROLE_LABELS[user.role as UserRole] : '') || '').trim();
  const phone = (user.phone || '').trim();
  const username = (user.username || '').trim();

  return {
    createdById: user.id || undefined,
    createdByName: name || undefined,
    createdByRole: role || undefined,
    createdByPhone: phone || undefined,
    createdByUsername: username || undefined,
  };
}

/**
 * Resolves the registering/issuing user's information strictly from the invoice's
 * own creator fields and matching user record (never falling back to the main/default admin
 * or store settings.sellerName when a creator exists).
 */
export function resolveInvoiceCreatorInfo(
  invoice?: Partial<Invoice> | null,
  usersList?: AppUser[]
): ResolvedInvoiceCreator {
  if (!invoice) {
    return { name: '', role: '', phone: '', username: '', hasCreator: false };
  }

  let users: AppUser[] = usersList || [];
  if (!usersList) {
    try {
      users = StorageService.getUsers();
    } catch {
      users = [];
    }
  }

  let matchedUser: AppUser | undefined;
  if (users.length > 0) {
    if (invoice.createdById) {
      matchedUser = users.find((u) => u.id === invoice.createdById);
    }
    if (!matchedUser && invoice.createdByUsername) {
      const uname = invoice.createdByUsername.trim().toLowerCase();
      matchedUser = users.find((u) => (u.username || '').trim().toLowerCase() === uname);
    }
    if (!matchedUser && invoice.createdByName) {
      const cname = invoice.createdByName.trim().toLowerCase();
      if (cname && cname !== 'مدیر سیستم') {
        matchedUser = users.find(
          (u) =>
            (u.fullName || '').trim().toLowerCase() === cname ||
            (u.name || '').trim().toLowerCase() === cname ||
            (u.username || '').trim().toLowerCase() === cname
        );
      }
    }
  }

  const name = (
    (invoice.createdByName || '').trim() ||
    (matchedUser?.fullName || matchedUser?.name || matchedUser?.username || '').trim()
  );

  const role = (
    (invoice.createdByRole || '').trim() ||
    (matchedUser?.roleTitle || (matchedUser?.role ? ROLE_LABELS[matchedUser.role as UserRole] : '') || '').trim()
  );

  const phone = (
    (invoice.createdByPhone || '').trim() ||
    (matchedUser?.phone || '').trim()
  );

  const username = (
    (invoice.createdByUsername || '').trim() ||
    (matchedUser?.username || '').trim()
  );

  return {
    id: invoice.createdById || matchedUser?.id,
    name,
    role,
    phone,
    username,
    convertedByName: invoice.convertedByName?.trim() || undefined,
    hasCreator: Boolean(name),
  };
}
