import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RequirePermission, RequireAdmin } from '../permission-guard';
import { useAuthStore } from '@/stores/auth-store';

describe('RequirePermission', () => {
  beforeEach(() => {
    useAuthStore.setState({ permissions: ['traefik.dashboard.read'], user: null, token: null });
  });

  it('renders children when permission is present', () => {
    render(<RequirePermission permission="traefik.dashboard.read">Content Here</RequirePermission>);
    expect(screen.getByText('Content Here')).toBeInTheDocument();
  });

  it('renders fallback when permission is absent', () => {
    render(<RequirePermission permission="traefik.admin" fallback={<span>Fallback</span>}>Children</RequirePermission>);
    expect(screen.getByText('Fallback')).toBeInTheDocument();
    expect(screen.queryByText('Children')).not.toBeInTheDocument();
  });

  it('renders null fallback when permission is absent and no fallback provided', () => {
    const { container } = render(<RequirePermission permission="traefik.admin">Children</RequirePermission>);
    expect(container.firstChild).toBeNull();
  });
});

describe('RequireAdmin', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: null, token: null, permissions: [] });
  });

  it('renders children for admin user', () => {
    useAuthStore.setState({ user: { id: 1, username: 'admin', source: 'local', email: null, is_active: true, isAdmin: true } });
    render(<RequireAdmin>Admin Content</RequireAdmin>);
    expect(screen.getByText('Admin Content')).toBeInTheDocument();
  });

  it('renders fallback for non-admin user', () => {
    useAuthStore.setState({ user: { id: 2, username: 'user', source: 'local', email: null, is_active: true, isAdmin: false } });
    render(<RequireAdmin fallback={<span>Not Admin</span>}>Admin Content</RequireAdmin>);
    expect(screen.getByText('Not Admin')).toBeInTheDocument();
    expect(screen.queryByText('Admin Content')).not.toBeInTheDocument();
  });

  it('renders fallback when user is null', () => {
    render(<RequireAdmin fallback={<span>Not Admin</span>}>Admin Content</RequireAdmin>);
    expect(screen.getByText('Not Admin')).toBeInTheDocument();
  });
});