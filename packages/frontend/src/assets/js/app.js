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
  { id: 'configfile', icon: 'ri-file-code-line', label: 'Config', hash: '#/configfile' },
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
  configfile: { title: 'Dynamic Config', subtitle: 'Edit Traefik dynamic configuration' },
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

// Initialize everything on DOM ready
document.addEventListener('DOMContentLoaded', async () => {
  initTheme();
  renderSidebar();
  initLogout();
  initLoginForm();

  // Check auth state first, then route
  const verified = await Auth.verify();
  if (!verified) {
    Auth.logout();
    showLogin();
    if (window.location.hash && window.location.hash !== '#/login') {
      window.location.hash = '#/login';
    }
  } else {
    showApp();
    updateUserInfo();
    if (!window.location.hash || window.location.hash === '#/login') {
      window.location.hash = '#/dashboard';
    }
    handleRoute();
  }

  // Start connection status polling
  updateConnectionStatus();
  setInterval(updateConnectionStatus, 30000);
});
