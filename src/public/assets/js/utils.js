/**
 * Shared utility functions for Traefik-UI
 * All page modules use these functions via window.* global exposure
 */

// XSS prevention - escape HTML special characters
function escapeHtml(str) {
  if (str === undefined || str === null) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// Color-coded status badge based on status value
function renderStatusBadge(status) {
  if (!status) return '<span class="badge badge-warning">Unknown</span>';
  const s = String(status).toLowerCase();
  if (s === 'enabled' || s === 'ok' || s === 'up' || s === 'success' || s.startsWith('2'))
    return '<span class="badge badge-success">' + escapeHtml(status) + '</span>';
  if (s === 'disabled' || s === 'warning' || s.startsWith('4'))
    return '<span class="badge badge-warning">' + escapeHtml(status) + '</span>';
  if (s === 'error' || s.startsWith('5'))
    return '<span class="badge badge-danger">' + escapeHtml(status) + '</span>';
  return '<span class="badge badge-info">' + escapeHtml(status) + '</span>';
}

// Error state UI with retry button
function renderError(page, message) {
  return `
    <div class="text-center py-20">
      <i class="ri-error-warning-line text-4xl text-red-500 mb-4 block"></i>
      <p class="text-red-500 dark:text-red-400">Failed to load ${escapeHtml(page)}</p>
      <p class="text-gray-400 text-sm mt-1">${escapeHtml(message)}</p>
      <button onclick="handleRoute()" class="mt-4 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm">Retry</button>
    </div>
  `;
}

// Loading spinner placeholder
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

// Format bytes to human-readable string
function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// Format uptime seconds to human-readable string
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

// Format date string to locale string
function formatDate(dateStr) {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleString();
}

// Expose all utilities globally for backward compatibility
window.escapeHtml = escapeHtml;
window.renderStatusBadge = renderStatusBadge;
window.renderError = renderError;
window.showLoading = showLoading;
window.showToast = showToast;
window.formatBytes = formatBytes;
window.formatUptime = formatUptime;
window.formatDate = formatDate;
