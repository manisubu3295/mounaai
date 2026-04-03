import { create } from 'zustand';
import type { AuthUser } from '@pocketcomputer/shared-types';
import { setAccessToken, clearAccessToken } from '@/lib/api-client';

interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setAuth: (user: AuthUser, token: string) => void;
  clearAuth: () => void;
  setLoading: (v: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,

  setAuth: (user, token) => {
    setAccessToken(token);
    set({ user, isAuthenticated: true, isLoading: false });
  },

  clearAuth: () => {
    clearAccessToken();
    set({ user: null, isAuthenticated: false, isLoading: false });
  },

  setLoading: (v) => set({ isLoading: v }),
}));
