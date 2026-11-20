import { AppUser } from '../types';

const AUTH_TOKEN_KEY = 'factor_app_auth_token_v1';
export const AUTH_EXPIRED_EVENT = 'factor-auth-expired';

export function getAuthToken(): string | null {
  try {
    return localStorage.getItem(AUTH_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setAuthToken(token: string | null) {
  try {
    if (token) {
      localStorage.setItem(AUTH_TOKEN_KEY, token);
    } else {
      localStorage.removeItem(AUTH_TOKEN_KEY);
    }
  } catch {
    // ignore storage quota errors
  }
}

export function hasAuthToken(): boolean {
  return Boolean(getAuthToken());
}

/**
 * Authenticated fetch wrapper for same-origin /api/* requests.
 * Does NOT mutate window.fetch (safe in sandboxed iframes where window.fetch is getter-only).
 * Automatically attaches Authorization: Bearer <token> + same-origin credentials,
 * and dispatches AUTH_EXPIRED_EVENT when a protected endpoint returns HTTP 401.
 */
export async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const urlStr =
    typeof input === 'string'
      ? input
      : input instanceof URL
      ? input.toString()
      : input.url;

  const isSameOriginApi =
    urlStr.startsWith('/api/') ||
    (typeof window !== 'undefined' && urlStr.startsWith(`${window.location.origin}/api/`));

  if (!isSameOriginApi) {
    return globalThis.fetch(input, init);
  }

  const token = getAuthToken();
  const headers = new Headers(init?.headers || (input instanceof Request ? input.headers : undefined));
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await globalThis.fetch(input, {
    ...init,
    credentials: init?.credentials ?? 'same-origin',
    headers,
  });

  if (response.status === 401) {
    const isPublicOrAuthEndpoint =
      urlStr.includes('/api/auth/login') ||
      urlStr.includes('/api/auth/bootstrap') ||
      urlStr.includes('/api/auth/logout') ||
      urlStr.includes('/api/auth/switch-user') ||
      urlStr.includes('/api/public/');

    if (!isPublicOrAuthEndpoint && getAuthToken()) {
      setAuthToken(null);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(AUTH_EXPIRED_EVENT));
      }
    }
  }

  return response;
}

/**
 * Downloads a protected server file using apiFetch (so Bearer auth works even inside cross-site iframes).
 */
export async function downloadAuthenticatedFile(url: string, filename: string): Promise<boolean> {
  try {
    const res = await apiFetch(url, { cache: 'no-store' });
    if (!res.ok) return false;
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    return true;
  } catch {
    return false;
  }
}

export interface AuthBootstrapBranding {
  appName?: string;
  storeName?: string;
  tagline?: string;
  showStoreEditionBadge?: boolean;
}

export async function fetchAuthBootstrap(): Promise<AuthBootstrapBranding | null> {
  try {
    const res = await apiFetch('/api/auth/bootstrap', { cache: 'no-store' });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.success && data?.branding ? data.branding : null;
  } catch {
    return null;
  }
}

export interface ServerAuthResult {
  success: boolean;
  user?: AppUser;
  token?: string;
  message?: string;
  attemptsLeft?: number;
  retryAfterSeconds?: number;
  networkError?: boolean;
}

export async function loginWithServer(username: string, password: string): Promise<ServerAuthResult> {
  try {
    const res = await apiFetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data?.success && data?.user) {
      if (data.token) {
        setAuthToken(data.token);
      }
      return {
        success: true,
        user: data.user,
        token: data.token,
      };
    }
    return {
      success: false,
      message: data?.message || 'نام کاربری یا رمز عبور اشتباه است.',
      attemptsLeft: data?.attemptsLeft,
      retryAfterSeconds: data?.retryAfterSeconds,
    };
  } catch {
    return {
      success: false,
      networkError: true,
      message: 'ارتباط با سرور برقرار نشد.',
    };
  }
}

export async function switchUserWithServer(payload: {
  targetUserId?: string;
  username?: string;
  password?: string;
  directAdminSwitch?: boolean;
}): Promise<ServerAuthResult> {
  try {
    const res = await apiFetch('/api/auth/switch-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data?.success && data?.user) {
      if (data.token) {
        setAuthToken(data.token);
      }
      return {
        success: true,
        user: data.user,
        token: data.token,
      };
    }
    return {
      success: false,
      message: data?.message || 'تغییر حساب کاربری با خطا مواجه شد.',
      attemptsLeft: data?.attemptsLeft,
      retryAfterSeconds: data?.retryAfterSeconds,
    };
  } catch {
    return {
      success: false,
      networkError: true,
      message: 'ارتباط با سرور برقرار نشد.',
    };
  }
}

export async function verifySessionWithServer(): Promise<{ valid: boolean; user?: AppUser; networkError?: boolean }> {
  try {
    const res = await apiFetch('/api/auth/me', { cache: 'no-store' });
    if (res.status === 401) {
      setAuthToken(null);
      return { valid: false };
    }
    if (!res.ok) {
      return { valid: false };
    }
    const data = await res.json();
    if (data?.success && data?.user) {
      if (data.token) {
        setAuthToken(data.token);
      }
      return { valid: true, user: data.user };
    }
    return { valid: false };
  } catch {
    return { valid: false, networkError: true };
  }
}

export async function logoutFromServer(): Promise<void> {
  try {
    await apiFetch('/api/auth/logout', { method: 'POST' });
  } catch {
    // ignore network failure on logout
  } finally {
    setAuthToken(null);
  }
}
