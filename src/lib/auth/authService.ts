/**
 * BREAKOUT MUSIC — Custom JWT Authentication Service
 *
 * Handles login/register with custom JWT (Neon database)
 * No external auth provider dependency
 */

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: string;
  artistId?: string;
}

function normalizeArtistId(value: unknown): string | undefined {
  return typeof value === 'string' && /^\d{14}$/.test(value) ? value : undefined;
}

export interface AuthResponse {
  success: boolean;
  token?: string;
  user?: AuthUser;
  error?: string;
}

function normalizeAuthResponse(value: any): AuthResponse {
  if (
    value?.success !== true ||
    typeof value.token !== 'string' ||
    !value.token.trim() ||
    !value.user ||
    typeof value.user.id !== 'string' ||
    typeof value.user.email !== 'string'
  ) {
    return {
      success: false,
      error: typeof value?.error === 'string' ? value.error : 'Server returned an invalid authentication response',
    };
  }

  return {
    success: true,
    token: value.token,
    user: {
      id: value.user.id,
      email: value.user.email,
      fullName: typeof value.user.fullName === 'string' && value.user.fullName.trim()
        ? value.user.fullName
        : value.user.email.split('@')[0],
      role: typeof value.user.role === 'string' && value.user.role.trim()
        ? value.user.role.toLowerCase().trim()
        : 'user',
      artistId: normalizeArtistId(value.user.artistId),
    },
  };
}

function persistAuthResponse(auth: AuthResponse): void {
  if (!auth.success || !auth.token || !auth.user) return;
  localStorage.setItem('authToken', auth.token);
  localStorage.setItem('authUser', JSON.stringify(auth.user));
}

export interface VerifiedSessionUser {
  id: string;
  email: string;
  role: string;
  artistId?: string;
}

import { getApiBaseUrl } from '@config/apiConfig';

const API_BASE_URL = getApiBaseUrl();

/**
 * Helper to check if a role has admin privileges
 */
export function isAdminRole(role?: string | null): boolean {
  if (!role) return false;
  const normalized = role.toLowerCase().trim();
  return ['admin', 'super_admin', 'superadmin'].includes(normalized);
}

/**
 * Register new user
 */
export async function register(
  email: string,
  password: string,
  fullName: string
): Promise<AuthResponse> {
  if (!API_BASE_URL) {
    return { success: false, error: 'API Worker belum dikonfigurasi. Registrasi sementara belum tersedia.' };
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        password,
        fullName,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => null);
      return {
        success: false,
        error: error?.error || 'Registration failed',
      };
    }

    const data = normalizeAuthResponse(await response.json());
    persistAuthResponse(data);
    return data;
  } catch (error) {
    console.error('Register error:', error);
    return {
      success: false,
      error: 'Failed to connect to server',
    };
  }
}

/**
 * Login with email and password
 */
export async function login(email: string, password: string): Promise<AuthResponse> {
  if (!API_BASE_URL) {
    return { success: false, error: 'API Worker belum dikonfigurasi. Login sementara belum tersedia.' };
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        password,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => null);
      return {
        success: false,
        error: error?.error || 'Login failed',
      };
    }

    const data = normalizeAuthResponse(await response.json());
    persistAuthResponse(data);
    return data;
  } catch (error) {
    console.error('Login error:', error);
    return {
      success: false,
      error: 'Failed to connect to server',
    };
  }
}

/** Verify a stored custom JWT against the Worker's signed-session endpoint. */
export async function validateSession(token: string): Promise<VerifiedSessionUser | null> {
  if (!API_BASE_URL) {
    throw new Error('API Worker belum dikonfigurasi untuk memeriksa sesi.');
  }

  const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (response.status === 401) return null;
  if (!response.ok) {
    throw new Error(`Session validation failed with status ${response.status}`);
  }

  const payload = await response.json();
  const user = payload?.data?.user;
  if (
    payload?.success !== true ||
    typeof user?.id !== 'string' ||
    typeof user?.email !== 'string' ||
    typeof user?.role !== 'string'
  ) {
    throw new Error('Worker returned an invalid session response');
  }

  return {
    id: user.id,
    email: user.email,
    role: user.role.toLowerCase().trim(),
    artistId: normalizeArtistId(user.artistId),
  };
}

/**
 * Logout and clear token
 */
export async function logout(): Promise<void> {
  const token = getAuthToken();
  try {
    if (token && API_BASE_URL) {
      await fetch(`${API_BASE_URL}/api/auth/logout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
    }
  } finally {
    clearAuthSession();
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('auth-state-changed'));
  }
}

/** Change the authenticated account password through the Neon-backed Worker. */
export async function changePassword(currentPassword: string, newPassword: string): Promise<{ error: Error | null }> {
  const token = getAuthToken();
  if (!token) return { error: new Error('Sesi login tidak ditemukan. Silakan masuk kembali.') };
  if (!API_BASE_URL) return { error: new Error('API Worker belum dikonfigurasi.') };

  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok || payload?.success !== true) {
      return { error: new Error(typeof payload?.error === 'string' ? payload.error : 'Password update failed') };
    }
    return { error: null };
  } catch {
    return { error: new Error('Tidak dapat menghubungi Worker untuk memperbarui kata sandi.') };
  }
}

/** Clear only authentication state when a token is rejected or unavailable. */
export function clearAuthSession(): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.removeItem('authToken');
  localStorage.removeItem('authUser');
}

/**
 * Get current user from localStorage
 */
export function getCurrentUser(): AuthUser | null {
  if (typeof localStorage === 'undefined') return null;
  const user = localStorage.getItem('authUser');
  if (user) {
    try {
      const parsed = JSON.parse(user);
      if (parsed && parsed.role) {
        parsed.role = parsed.role.toLowerCase().trim();
      }
      return parsed;
    } catch (error) {
      console.error('Failed to parse user:', error);
    }
  }
  return null;
}

/**
 * Get auth token
 */
export function getAuthToken(): string | null {
  return typeof localStorage === 'undefined' ? null : localStorage.getItem('authToken');
}

/**
 * Check if user is authenticated
 */
export function isAuthenticated(): boolean {
  return !!getAuthToken();
}

/**
 * Decode JWT payload safely (supports Base64URL and standard Base64, UTF-8 strings)
 */
export function decodeToken(token: string): any {
  try {
    if (!token || typeof token !== 'string') return null;
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }
    // Convert Base64URL to standard Base64
    let base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const pad = base64.length % 4;
    if (pad) {
      base64 += '='.repeat(4 - pad);
    }
    const binaryStr = atob(base64);
    const bytes = Uint8Array.from(binaryStr, (c) => c.charCodeAt(0));
    const decodedText = new TextDecoder().decode(bytes);
    return JSON.parse(decodedText);
  } catch (error) {
    console.error('Failed to decode token:', error);
    return null;
  }
}

/**
 * Check if token is expired with 5-minute clock-skew tolerance.
 * Does not prematurely expire valid sessions if client clock is slightly fast.
 */
export function isTokenExpired(token: string | null = getAuthToken()): boolean {
  if (!token) return true;

  const payload = decodeToken(token);
  // If token cannot be decoded by client or has no exp, rely on backend 401 verification
  if (!payload || !payload.exp) return false;

  const now = Math.floor(Date.now() / 1000);
  // Allow 300 seconds (5 minutes) leeway for clock skew between client and server
  return payload.exp < (now - 300);
}
