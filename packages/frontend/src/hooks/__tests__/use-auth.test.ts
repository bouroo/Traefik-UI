import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useAuth } from '../use-auth';
import { useAuthStore } from '@/stores/auth-store';

describe('useAuth', () => {
  beforeEach(() => {
    useAuthStore.setState({ token: null, user: null, permissions: [], isLoading: false });
  });

  describe('hasPermission', () => {
    it('returns true when permission is present', () => {
      useAuthStore.setState({ permissions: ['traefik.dashboard.read', 'traefik.routers.read'] });
      const { result } = renderHook(() => useAuth());
      expect(result.current.hasPermission('traefik.dashboard.read')).toBe(true);
    });

    it('returns false when permission is absent', () => {
      useAuthStore.setState({ permissions: ['traefik.dashboard.read'] });
      const { result } = renderHook(() => useAuth());
      expect(result.current.hasPermission('traefik.admin')).toBe(false);
    });

    it('returns false for empty permissions array', () => {
      useAuthStore.setState({ permissions: [] });
      const { result } = renderHook(() => useAuth());
      expect(result.current.hasPermission('traefik.dashboard.read')).toBe(false);
    });
  });

  describe('isAdmin', () => {
    it('returns true when user is admin', () => {
      useAuthStore.setState({
        user: {
          id: 1,
          username: 'admin',
          source: 'local',
          email: null,
          is_active: true,
          isAdmin: true,
        },
      });
      const { result } = renderHook(() => useAuth());
      expect(result.current.isAdmin).toBe(true);
    });

    it('returns false when user is not admin', () => {
      useAuthStore.setState({
        user: {
          id: 2,
          username: 'user',
          source: 'local',
          email: null,
          is_active: true,
          isAdmin: false,
        },
      });
      const { result } = renderHook(() => useAuth());
      expect(result.current.isAdmin).toBe(false);
    });

    it('returns false when user is null', () => {
      useAuthStore.setState({ user: null });
      const { result } = renderHook(() => useAuth());
      expect(result.current.isAdmin).toBe(false);
    });
  });

  describe('isAuthenticated', () => {
    it('returns true when token exists', () => {
      useAuthStore.setState({ token: 'valid-jwt-token' });
      const { result } = renderHook(() => useAuth());
      expect(result.current.isAuthenticated).toBe(true);
    });

    it('returns false when token is null', () => {
      useAuthStore.setState({ token: null });
      const { result } = renderHook(() => useAuth());
      expect(result.current.isAuthenticated).toBe(false);
    });

    it('returns false when token is empty string', () => {
      useAuthStore.setState({ token: '' });
      const { result } = renderHook(() => useAuth());
      expect(result.current.isAuthenticated).toBe(false);
    });
  });
});
