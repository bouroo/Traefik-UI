import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

describe('api', () => {
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch = vi.fn();
    global.fetch = mockFetch as unknown as typeof fetch;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('login', () => {
    it('calls fetch with correct endpoint and body', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ token: 'new-token', user: { id: 1, username: 'test' } }),
      });

      const { login } = await import('../api');
      await login('testuser', 'password123');

      expect(mockFetch).toHaveBeenCalledWith('/api/auth/login', expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ username: 'testuser', password: 'password123' }),
      }));
    });

    it('returns token and user on success', async () => {
      const mockResponse = { token: 'test-token', user: { id: 1, username: 'testuser' } };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const { login } = await import('../api');
      const result = await login('testuser', 'password');

      expect(result).toEqual(mockResponse);
    });
  });
});