import { describe, it, expect, beforeEach, afterAll } from 'bun:test';
import {
  app,
  setupTestUser,
  getTestToken,
  createRequest,
  authRequest,
  cleanupTestEnv,
} from './helpers';
import jwt from 'jsonwebtoken';
import { config } from '../src/config';

describe('POST /api/auth/login', () => {
  beforeEach(async () => {
    await setupTestUser();
  });

  it('should login with valid credentials', async () => {
    const req = createRequest('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: 'testuser', password: 'testpass123' }),
    });
    const res = await app.request(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.token).toBeTruthy();
    expect(typeof body.token).toBe('string');
    expect(body.user).toBeTruthy();
    expect(body.user.id).toBeTruthy();
    expect(body.user.username).toBe('testuser');
  });

  it('should return 401 for invalid password', async () => {
    const req = createRequest('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: 'testuser', password: 'wrongpassword' }),
    });
    const res = await app.request(req);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toEqual({ error: 'Invalid credentials' });
  });

  it('should return 401 for non-existent user', async () => {
    const req = createRequest('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: 'nonexistent', password: 'testpass123' }),
    });
    const res = await app.request(req);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toEqual({ error: 'Invalid credentials' });
  });

  it('should return 400 for missing fields', async () => {
    const req = createRequest('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({}),
    });
    const res = await app.request(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeTruthy();
  });

  it('should return 400 for invalid JSON body', async () => {
    const req = new Request('http://localhost/api/auth/login', {
      method: 'POST',
      body: 'not valid json',
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await app.request(req);
    expect(res.status).toBe(400);
  });
});

describe('GET /api/auth/me', () => {
  beforeEach(async () => {
    await setupTestUser();
  });

  it('should return user info with valid token', async () => {
    const token = getTestToken();
    const req = authRequest('/api/auth/me', token);
    const res = await app.request(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.user).toBeTruthy();
    expect(body.user.id).toBeTruthy();
    expect(body.user.username).toBe('testuser');
  });

  it('should return 401 without token', async () => {
    const req = createRequest('/api/auth/me');
    const res = await app.request(req);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toEqual({ error: 'Unauthorized' });
  });

  it('should return 401 with invalid token', async () => {
    const req = authRequest('/api/auth/me', 'invalidtoken');
    const res = await app.request(req);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toEqual({ error: 'Unauthorized' });
  });

  it('should return 401 with expired token', async () => {
    const expiredToken = jwt.sign({ sub: 1, username: 'testuser' }, config.auth.jwtSecret, {
      expiresIn: '0s',
    });
    const req = authRequest('/api/auth/me', expiredToken);
    const res = await app.request(req);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toEqual({ error: 'Unauthorized' });
  });
});

describe('POST /api/auth/change-password', () => {
  beforeEach(async () => {
    await setupTestUser();
  });

  it('should change password successfully', async () => {
    const req = authRequest('/api/auth/change-password', getTestToken(), {
      method: 'POST',
      body: JSON.stringify({ currentPassword: 'testpass123', newPassword: 'newpass456' }),
    });
    const res = await app.request(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ success: true });

    // Verify login works with new password
    const loginReq = createRequest('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: 'testuser', password: 'newpass456' }),
    });
    const loginRes = await app.request(loginReq);
    expect(loginRes.status).toBe(200);
    const loginBody = await loginRes.json();
    expect(loginBody.token).toBeTruthy();

    // Verify old password fails
    const oldLoginReq = createRequest('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: 'testuser', password: 'testpass123' }),
    });
    const oldLoginRes = await app.request(oldLoginReq);
    expect(oldLoginRes.status).toBe(401);
  });

  it('should return 401 with wrong current password', async () => {
    const req = authRequest('/api/auth/change-password', getTestToken(), {
      method: 'POST',
      body: JSON.stringify({ currentPassword: 'wrongpassword', newPassword: 'newpass456' }),
    });
    const res = await app.request(req);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toEqual({ error: 'Current password is incorrect' });
  });

  it('should return 400 for short new password', async () => {
    const req = authRequest('/api/auth/change-password', getTestToken(), {
      method: 'POST',
      body: JSON.stringify({ currentPassword: 'testpass123', newPassword: 'short' }),
    });
    const res = await app.request(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toEqual({ error: 'New password must be at least 6 characters' });
  });

  it('should return 400 for missing fields', async () => {
    const req = authRequest('/api/auth/change-password', getTestToken(), {
      method: 'POST',
      body: JSON.stringify({}),
    });
    const res = await app.request(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeTruthy();
  });

  it('should return 401 without auth token', async () => {
    const req = createRequest('/api/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword: 'testpass123', newPassword: 'newpass456' }),
    });
    const res = await app.request(req);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toEqual({ error: 'Unauthorized' });
  });
});

describe('POST /api/auth/logout', () => {
  it('should return success', async () => {
    const req = createRequest('/api/auth/logout', { method: 'POST' });
    const res = await app.request(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ success: true });
  });
});

describe('POST /api/auth/refresh', () => {
  beforeEach(async () => {
    await setupTestUser();
  });

  it('should return new token', async () => {
    const originalToken = getTestToken();
    const req = authRequest('/api/auth/refresh', originalToken, { method: 'POST' });
    const res = await app.request(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.token).toBeTruthy();
    expect(typeof body.token).toBe('string');
    // Token should be a valid JWT that can be decoded
    const decoded = jwt.decode(body.token) as { sub: number; username: string };
    expect(decoded.sub).toBeTruthy();
    expect(decoded.username).toBe('testuser');
  });

  it('should return 401 without token', async () => {
    const req = createRequest('/api/auth/refresh', { method: 'POST' });
    const res = await app.request(req);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toEqual({ error: 'Unauthorized' });
  });
});

afterAll(() => {
  cleanupTestEnv();
});
