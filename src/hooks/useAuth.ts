import { useAuth as useCentralAuth } from '@contexts/AuthContext';

export interface AuthUser {
  id: string;
  email?: string;
  full_name?: string;
}

export interface AuthState {
  user: AuthUser | null;
  profile: any | null;
  role: string | null;
  loading: boolean;
}

export function useAuth(): AuthState {
  const { user, userRole, isLoading } = useCentralAuth();

  return {
    user: user
      ? {
          id: user.id,
          email: user.email,
          full_name: user.fullName,
        }
      : null,
    profile: null,
    role: userRole,
    loading: isLoading,
  };
}
