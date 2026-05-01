// ============================================================
// Traefik-UI Main Application
// ============================================================

// Theme management
function initTheme() {
  const theme = localStorage.getItem('traefik_ui_theme') || 'light';
  document.documentElement.classList.toggle('dark', theme === 'dark');

  const toggleBtn = document.getElementById('theme-toggle');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      const isDark = document.documentElement.classList.toggle('dark');
      localStorage.setItem('traefik_ui_theme', isDark ? 'dark' : 'light');
    });
  }
}

// Sidebar navigation
const NAV_ITEMS = [
  { id: 'dashboard', icon: 'ri-dashboard-line', label: 'Dashboard', hash: '#/dashboard' },
  { id: 'routers', icon: 'ri-share-forward-line', label: 'Routers', hash: '#/routers' },
  { id: 'services', icon: 'ri-server-line', label: 'Services', hash: '#/services' },
  { id: 'middlewares', icon: 'ri-stack-line', label: 'Middlewares', hash: '#/middlewares' },
  { id: 'tls', icon: 'ri-shield-keyhole-line', label: 'TLS Certificates', hash: '#/tls' },
  { id: 'entrypoints', icon: 'ri-plug-line', label: 'EntryPoints', hash: '#/entrypoints' },
  { id: 'logs', icon: 'ri-file-list-3-line', label: 'Logs', hash: '#/logs' },
  { id: 'system', icon: 'ri-cpu-line', label: 'System', hash: '#/system' },
  { id: 'settings', icon: 'ri-settings-3-line', label: 'Settings', hash: '#/settings' },
];

function renderSidebar() {
  const nav = document.getElementById('sidebar-nav');
  if (!nav) return;

  nav.innerHTML = NAV_ITEMS.map(
    (item) => `
    <a href="${item.hash}" 
       class="nav-item" 
       data-nav="${item.id}"
       onclick="setActiveNav('${item.id}')">
      <i class="${item.icon} text-lg"></i>
      <span>${item.label}</span>
    </a>
  `
  ).join('');
}

function setActiveNav(id) {
  document.querySelectorAll('.nav-item').forEach((el) => el.classList.remove('active'));
  const activeLink = document.querySelector(`[data-nav="${id}"]`);
  if (activeLink) activeLink.classList.add('active');
}

// Page title management
const PAGE_TITLES = {
  dashboard: { title: 'Dashboard', subtitle: 'Overview of your Traefik proxy' },
  routers: { title: 'Routers', subtitle: 'Manage HTTP, TCP, and UDP routers' },
  services: { title: 'Services', subtitle: 'Backend service configurations' },
  middlewares: { title: 'Middlewares', subtitle: 'HTTP and TCP middleware chains' },
  tls: { title: 'TLS Certificates', subtitle: 'SSL/TLS certificate management' },
  entrypoints: { title: 'EntryPoints', subtitle: 'Network entry points' },
  logs: { title: 'Logs', subtitle: 'Traefik access and error logs' },
  system: { title: 'System', subtitle: 'Server resource utilization' },
  settings: { title: 'Settings', subtitle: 'Application configuration' },
};

function setPageTitle(page) {
  const info = PAGE_TITLES[page] || { title: page, subtitle: '' };
  document.getElementById('page-title').textContent = info.title;
  document.getElementById('page-subtitle').textContent = info.subtitle;
}

// Connection status indicator
async function updateConnectionStatus() {
  const statusEl = document.getElementById('connection-status');
  if (!statusEl) return;

  try {
    const health = await API.getHealth();
    const dot = statusEl.querySelector('.w-2');
    const label = statusEl.querySelector('span:last-child');

    if (health.traefikConnected) {
      dot.className = 'w-2 h-2 rounded-full bg-green-500';
      label.textContent = 'Connected';
    } else {
      dot.className = 'w-2 h-2 rounded-full bg-yellow-500';
      label.textContent = 'Traefik Offline';
    }
  } catch {
    const dot = statusEl.querySelector('.w-2');
    const label = statusEl.querySelector('span:last-child');
    dot.className = 'w-2 h-2 rounded-full bg-red-500';
    label.textContent = 'Disconnected';
  }
}

// Toast notifications
function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// Loading state for page content
function showLoading() {
  const content = document.getElementById('page-content');
  if (content) {
    content.innerHTML = `
      <div class="flex items-center justify-center py-20">
        <div class="text-center">
          <div class="spinner mx-auto mb-4"></div>
          <p class="text-gray-500 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    `;
  }
}

// Logout handler
function initLogout() {
  const btn = document.getElementById('logout-btn');
  if (btn) {
    btn.addEventListener('click', () => {
      Auth.logout();
      showLogin();
      window.location.hash = '#/login';
    });
  }
}

// User info display
function updateUserInfo() {
  if (Auth.user) {
    const nameEl = document.getElementById('user-name');
    const initialEl = document.getElementById('user-initial');
    if (nameEl) nameEl.textContent = Auth.user.username;
    if (initialEl) initialEl.textContent = Auth.user.username.charAt(0).toUpperCase();
  }
}

// Format utility functions (used globally)
function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatUptime(seconds) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const parts = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}m`);
  return parts.join(' ') || '< 1m';
}

function formatDate(dateStr) {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleString();
}

// Expose global functions for use in page modules
window.showToast = showToast;
window.showLoading = showLoading;
window.setPageTitle = setPageTitle;
window.setActiveNav = setActiveNav;
window.formatBytes = formatBytes;
window.formatUptime = formatUptime;
window.formatDate = formatDate;
window.API = API;
window.Auth = Auth;

// Handle routing
function handleRoute() {
  const hash = window.location.hash.replace('#/', '') || 'dashboard';
  setActiveNav(hash);
  setPageTitle(hash);
}

// Initialize everything on DOM ready
document.addEventListener('DOMContentLoaded', async () => {
  initTheme();
  renderSidebar();
  initLogout();
  initLoginForm();
  updateUserInfo();

  // Handle hash changes
  window.addEventListener('hashchange', handleRoute);

  // Check auth state
  const hash = window.location.hash;
  if (!hash || hash === '#/login') {
    showLogin();
  } else {
    await initAuth();
  }

  // Start connection status polling
  updateConnectionStatus();
  setInterval(updateConnectionStatus, 30000);

  // Handle initial hash
  if (window.location.hash && window.location.hash !== '#/login') {
    handleRoute();
  }
});
