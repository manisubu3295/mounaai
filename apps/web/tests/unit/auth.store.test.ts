import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act } from '@testing-library/react';

// Mock the api-client module before importing the store
vi.mock('@/lib/api-client', () => ({
  setAccessToken: vi.fn(),
  clearAccessToken: vi.fn(),
}));

import { useAuthStore } from '@/stores/auth.store';
import { setAccessToken, clearAccessToken } from '@/lib/api-client';

const mockUser = {
  id: 'user-1',
  tenant_id: 'tenant-1',
  email: 'test@example.com',
  full_name: 'Test User',
  role: 'ANALYST' as const,
};

describe('useAuthStore', () => {
  beforeEach(() => {
    // Reset store to initial state between tests
    act(() => useAuthStore.setState({ user: null, isAuthenticated: false, isLoading: true }));
    vi.clearAllMocks();
  });

  describe('setAuth', () => {
    it('sets user and marks authenticated', () => {
      act(() => useAuthStore.getState().setAuth(mockUser, 'my-token'));

      const state = useAuthStore.getState();
      expect(state.user).toEqual(mockUser);
      expect(state.isAuthenticated).toBe(true);
      expect(state.isLoading).toBe(false);
    });

    it('calls setAccessToken with the provided token', () => {
      act(() => useAuthStore.getState().setAuth(mockUser, 'my-token'));
      expect(setAccessToken).toHaveBeenCalledWith('my-token');
    });
  });

  describe('clearAuth', () => {
    it('clears user and marks unauthenticated', () => {
      // First authenticate
      act(() => useAuthStore.getState().setAuth(mockUser, 'my-token'));
      // Then clear
      act(() => useAuthStore.getState().clearAuth());

      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.isAuthenticated).toBe(false);
      expect(state.isLoading).toBe(false);
    });

    it('calls clearAccessToken', () => {
      act(() => useAuthStore.getState().clearAuth());
      expect(clearAccessToken).toHaveBeenCalled();
    });
  });

  describe('setLoading', () => {
    it('sets isLoading to false', () => {
      act(() => useAuthStore.getState().setLoading(false));
      expect(useAuthStore.getState().isLoading).toBe(false);
    });

    it('sets isLoading to true', () => {
      act(() => useAuthStore.setState({ isLoading: false }));
      act(() => useAuthStore.getState().setLoading(true));
      expect(useAuthStore.getState().isLoading).toBe(true);
    });
  });
});
