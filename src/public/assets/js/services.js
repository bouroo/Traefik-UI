async function renderServices() {
  const content = document.getElementById('page-content');

  try {
    const data = await API.getServices();
    const { http = [], tcp = [], udp = [] } = data;

    content.innerHTML = `
      <div class="flex gap-1 mb-6 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg w-fit">
        <button onclick="switchServiceTab('http')" class="service-tab px-4 py-2 rounded-md text-sm font-medium transition-colors bg-white dark:bg-gray-700 shadow-sm" data-tab="http">
          HTTP <span class="text-xs text-gray-400 ml-1">(${http.length})</span>
        </button>
        <button onclick="switchServiceTab('tcp')" class="service-tab px-4 py-2 rounded-md text-sm font-medium transition-colors text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200" data-tab="tcp">
          TCP <span class="text-xs text-gray-400 ml-1">(${tcp.length})</span>
        </button>
        <button onclick="switchServiceTab('udp')" class="service-tab px-4 py-2 rounded-md text-sm font-medium transition-colors text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200" data-tab="udp">
          UDP <span class="text-xs text-gray-400 ml-1">(${udp.length})</span>
        </button>
      </div>
      
      <div id="service-list">
        ${renderServiceTable(http, 'http')}
      </div>
    `;

    window._serviceData = { http, tcp, udp };
  } catch (err) {
    content.innerHTML = renderError('services', err.message);
  }
}

function renderServiceTable(services, protocol) {
  if (!services || services.length === 0) {
    return `
      <div class="stat-card text-center py-12">
        <i class="ri-server-line text-4xl text-gray-300 dark:text-gray-600 mb-3 block"></i>
        <p class="text-gray-500 dark:text-gray-400">No ${protocol.toUpperCase()} services configured</p>
      </div>
    `;
  }

  return `
    <div class="stat-card overflow-hidden">
      <table class="data-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Type</th>
            <th>Servers</th>
            <th>Provider</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${services
            .map(
              (s) => `
            <tr>
              <td class="font-medium">${escapeHtml(s.name)}</td>
              <td>${escapeHtml(s.type || '-')}</td>
              <td>${(s.loadBalancer?.servers || []).map((srv) => `<span class="font-mono text-xs">${escapeHtml(srv.url)}</span>`).join('<br>') || '-'}</td>
              <td><span class="badge badge-info">${escapeHtml(s.provider || '-')}</span></td>
              <td>${renderStatusBadge(s.status)}</td>
            </tr>
          `
            )
            .join('')}
        </tbody>
      </table>
      <div class="px-4 py-3 border-t border-gray-100 dark:border-gray-700 text-sm text-gray-500">
        ${services.length} service${services.length !== 1 ? 's' : ''}
      </div>
    </div>
  `;
}

function switchServiceTab(protocol) {
  document.querySelectorAll('.service-tab').forEach((btn) => {
    const isActive = btn.dataset.tab === protocol;
    btn.className = isActive
      ? 'service-tab px-4 py-2 rounded-md text-sm font-medium transition-colors bg-white dark:bg-gray-700 shadow-sm'
      : 'service-tab px-4 py-2 rounded-md text-sm font-medium transition-colors text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200';
  });

  const data = window._serviceData || {};
  const services = data[protocol] || [];
  document.getElementById('service-list').innerHTML = renderServiceTable(services, protocol);
}

// ============================================================
// Shared Utility Functions (used across modules)
// ============================================================

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

function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function renderError(page, message) {
  return `
    <div class="text-center py-20">
      <i class="ri-error-warning-line text-4xl text-red-500 mb-4 block"></i>
      <p class="text-red-500 dark:text-red-400">Failed to load ${page}</p>
      <p class="text-gray-400 text-sm mt-1">${message}</p>
      <button onclick="handleRoute()" class="mt-4 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm">Retry</button>
    </div>
  `;
}
