import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import {
  login as apiLogin,
  register as apiRegister,
  logout as apiLogout,
  clearAuthSession,
  getCurrentUser,
  getAuthToken,
  isTokenExpired,
  validateSession,
  isAdminRole,
  type AuthUser,
  type AuthResponse
} from '@lib/auth/authService';

export interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  sessionVerificationError: string | null;
  userRole: string | null;
  isAdmin: boolean;
  login: (email: string, password: string) => Promise<AuthResponse>;
  register: (email: string, password: string, fullName: string) => Promise<AuthResponse>;
  logout: () => void;
  refreshAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [sessionVerificationError, setSessionVerificationError] = useState<string | null>(null);
  const validationRequestRef = useRef(0);

  const isAdmin = isAdminRole(userRole);

  const clearAuthState = useCallback(() => {
    setToken(null);
    setUser(null);
    setUserRole(null);
    setIsAuthenticated(false);
    setSessionVerificationError(null);
  }, []);

  // Restore persisted credentials only after the Worker verifies their signature.
  const refreshAuth = useCallback(async () => {
    const requestId = ++validationRequestRef.current;
    const isCurrentRequest = () => requestId === validationRequestRef.current;
    setIsLoading(true);
    setSessionVerificationError(null);

    try {
      const storedToken = getAuthToken();
      const storedUser = getCurrentUser();

      if (!storedToken || !storedUser) {
        clearAuthSession();
        clearAuthState();
        return;
      }

      if (isTokenExpired(storedToken)) {
        clearAuthSession();
        clearAuthState();
        return;
      }

      const verifiedUser = await validateSession(storedToken);
      if (!isCurrentRequest() || getAuthToken() !== storedToken) return;

      if (!verifiedUser) {
        clearAuthSession();
        clearAuthState();
        return;
      }

      const restoredUser: AuthUser = {
        ...storedUser,
        id: verifiedUser.id,
        email: verifiedUser.email,
        role: verifiedUser.role,
      };
      localStorage.setItem('authUser', JSON.stringify(restoredUser));
      setToken(storedToken);
      setUser(restoredUser);
      setUserRole(verifiedUser.role);
      setIsAuthenticated(true);
    } catch (err) {
      if (!isCurrentRequest()) return;

      // Preserve credentials for retry, but don't render protected routes without verification.
      const storedToken = getAuthToken();
      const storedUser = getCurrentUser();
      if (storedToken && storedUser && !isTokenExpired(storedToken)) {
        clearAuthState();
        setSessionVerificationError('Tidak dapat memverifikasi sesi ke Worker. Periksa koneksi lalu coba lagi.');
      } else {
        clearAuthSession();
        clearAuthState();
      }
      console.warn('Could not validate the saved session with the Worker:', err);
    } finally {
      if (isCurrentRequest()) setIsLoading(false);
    }
  }, [clearAuthState]);

  // Initialize on mount and attach cross-tab / 401 listeners
  useEffect(() => {
    void refreshAuth();

    // Cross-tab synchronization via storage event
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'authToken' || e.key === 'authUser' || e.key === null) {
        void refreshAuth();
      }
    };

    // Internal app events
    const handleAuthStateChanged = () => {
      void refreshAuth();
    };

    const handleAuthLogout = () => {
      validationRequestRef.current += 1;
      clearAuthSession();
      clearAuthState();
      setIsLoading(false);
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('auth-state-changed', handleAuthStateChanged);
    window.addEventListener('auth-logout', handleAuthLogout);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('auth-state-changed', handleAuthStateChanged);
      window.removeEventListener('auth-logout', handleAuthLogout);
    };
  }, [clearAuthState, refreshAuth]);

  // Login handler with synchronous state update
  const login = async (email: string, password: string): Promise<AuthResponse> => {
    try {
      const result = await apiLogin(email, password);

      if (result.success && result.token && result.user) {
        validationRequestRef.current += 1;
        setSessionVerificationError(null);
        const normalizedRole = (result.user.role || 'user').toLowerCase().trim();
        result.user.role = normalizedRole;

        // Update state synchronously in React
        setToken(result.token);
        setUser(result.user);
        setUserRole(normalizedRole);
        setIsAuthenticated(true);
        setIsLoading(false);

        return result;
      }

      return result;
    } catch (err: any) {
      console.error('Login error in AuthProvider:', err);
      return {
        success: false,
        error: err.message || 'Gagal masuk. Silakan periksa koneksi internet Anda.',
      };
    }
  };

  // Register handler with synchronous state update
  const register = async (email: string, password: string, fullName: string): Promise<AuthResponse> => {
    try {
      const result = await apiRegister(email, password, fullName);

      if (result.success && result.token && result.user) {
        validationRequestRef.current += 1;
        setSessionVerificationError(null);
        const normalizedRole = (result.user.role || 'user').toLowerCase().trim();
        result.user.role = normalizedRole;

        setToken(result.token);
        setUser(result.user);
        setUserRole(normalizedRole);
        setIsAuthenticated(true);
        setIsLoading(false);

      }

      return result;
    } catch (err: any) {
      console.error('Register error in AuthProvider:', err);
      return {
        success: false,
        error: err.message || 'Gagal mendaftar. Silakan coba lagi.',
      };
    }
  };

  // Logout handler with synchronous state update
  const logout = useCallback(() => {
    validationRequestRef.current += 1;
    apiLogout();
    clearAuthState();
    setIsLoading(false);
  }, [clearAuthState]);

  const value: AuthContextType = {
    user,
    token,
    isAuthenticated,
    isLoading,
    sessionVerificationError,
    userRole,
    isAdmin,
    login,
    register,
    logout,
    refreshAuth,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
