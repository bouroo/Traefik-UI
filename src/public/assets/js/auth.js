// ============================================================
// Traefik-UI Authentication Module
// ============================================================

// Auth state
const Auth = {
  token: localStorage.getItem('traefik_ui_token'),
  user: JSON.parse(localStorage.getItem('traefik_ui_user') || 'null'),

  // Check if user is authenticated
  isAuthenticated() {
    return !!this.token;
  },

  // Login — POST /api/auth/login
  async login(username, password) {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login failed');

      this.token = data.token;
      this.user = data.user;
      localStorage.setItem('traefik_ui_token', data.token);
      localStorage.setItem('traefik_ui_user', JSON.stringify(data.user));
      return true;
    } catch (err) {
      console.error('Login error:', err);
      throw err;
    }
  },

  // Logout
  logout() {
    this.token = null;
    this.user = null;
    localStorage.removeItem('traefik_ui_token');
    localStorage.removeItem('traefik_ui_user');
  },

  // Verify token is still valid — GET /api/auth/me
  async verify() {
    if (!this.token) return false;
    try {
      const res = await this.fetch('/api/auth/me');
      return res.ok;
    } catch {
      return false;
    }
  },

  // Authenticated fetch wrapper with automatic token injection
  async fetch(url, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
      ...options.headers,
    };
    const res = await fetch(url, { ...options, headers });

    // If 401, auto-logout
    if (res.status === 401) {
      this.logout();
      window.location.hash = '#/login';
    }
    return res;
  },

  // Convenience method: GET JSON
  async get(url) {
    const res = await this.fetch(url);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || `Request failed: ${res.status}`);
    }
    return res.json();
  },
};

// API helper — shorthand for common operations
const API = {
  getDashboard: () => Auth.get('/api/dashboard'),
  getHealth: () => Auth.get('/api/dashboard/health'),
  getRouters: () => Auth.get('/api/routers'),
  getHttpRouters: () => Auth.get('/api/routers/http'),
  getTcpRouters: () => Auth.get('/api/routers/tcp'),
  getUdpRouters: () => Auth.get('/api/routers/udp'),
  getRouter: (protocol, name) => Auth.get(`/api/routers/${protocol}/${encodeURIComponent(name)}`),
  getServices: () => Auth.get('/api/services'),
  getHttpServices: () => Auth.get('/api/services/http'),
  getTcpServices: () => Auth.get('/api/services/tcp'),
  getUdpServices: () => Auth.get('/api/services/udp'),
  getMiddlewares: () => Auth.get('/api/middlewares'),
  getHttpMiddlewares: () => Auth.get('/api/middlewares/http'),
  getTcpMiddlewares: () => Auth.get('/api/middlewares/tcp'),
  getCertificates: () => Auth.get('/api/tls/certificates'),
  getAccessLogs: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return Auth.get(`/api/logs/access?${qs}`);
  },
  getEntrypoints: () => Auth.get('/api/entrypoints'),
  getSystemStats: () => Auth.get('/api/system/stats'),
  getOverview: () => Auth.get('/api/overview'),
  getVersion: () => Auth.get('/api/overview/version'),
};

// Login form handler
function initLoginForm() {
  const form = document.getElementById('login-form');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('login-username').value;
    const password = document.getElementById('login-password').value;
    const errorEl = document.getElementById('login-error');
    const submitBtn = form.querySelector('button[type="submit"]');

    try {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Signing in...';
      errorEl.classList.add('hidden');

      await Auth.login(username, password);
      // Success — redirect to dashboard
      window.location.hash = '#/dashboard';
      showApp();
    } catch (err) {
      errorEl.textContent = err.message;
      errorEl.classList.remove('hidden');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Sign In';
    }
  });
}

// Show/hide appropriate screens
function showLogin() {
  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('app-screen').classList.add('hidden');
}

function showApp() {
  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('app-screen').classList.remove('hidden');
}

// Initialize auth on page load
async function initAuth() {
  const verified = await Auth.verify();
  if (verified) {
    showApp();
  } else {
    Auth.logout();
    showLogin();
  }
}
