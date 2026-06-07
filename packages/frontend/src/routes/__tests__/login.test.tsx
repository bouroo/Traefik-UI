import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LoginPage } from '../login';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

describe('LoginPage', () => {
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigate.mockClear();

    mockFetch = vi.fn();
    global.fetch = mockFetch as unknown as typeof fetch;

    mockFetch.mockImplementation((url: string) => {
      if (url === '/api/auth/sso/providers') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([]),
        });
      }
      if (url === '/api/auth/login') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ token: 'test-token', user: { id: 1, username: 'testuser' } }),
        });
      }
      if (url === '/api/auth/me') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            user: { id: 1, username: 'testuser', source: 'local', email: null, is_active: true, is_admin: true },
            permissions: ['traefik.dashboard.read'],
          }),
        });
      }
      return Promise.reject(new Error('Unhandled fetch'));
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('form rendering', () => {
    it('renders username and password inputs', async () => {
      render(<LoginPage />);
      expect(screen.getByLabelText(/username/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    });

    it('renders sign in button', async () => {
      render(<LoginPage />);
      expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
    });
  });

  describe('form submission', () => {
    it('calls api.login and navigate on successful login', async () => {
      render(<LoginPage />);

      fireEvent.change(screen.getByLabelText(/username/i), { target: { value: 'testuser' } });
      fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'password123' } });
      fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/');
      }, { timeout: 2000 });
    });

    it('shows error message on failed login', async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url === '/api/auth/sso/providers') {
          return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
        }
        if (url === '/api/auth/login') {
          return Promise.resolve({
            ok: false,
            status: 401,
            json: () => Promise.resolve({ error: 'Invalid credentials' }),
          });
        }
        return Promise.reject(new Error('Unhandled fetch'));
      });

      render(<LoginPage />);

      fireEvent.change(screen.getByLabelText(/username/i), { target: { value: 'baduser' } });
      fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'wrongpass' } });
      fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

      await waitFor(() => {
        expect(screen.getByText(/invalid credentials/i)).toBeInTheDocument();
      }, { timeout: 2000 });
    });
  });
});