async function renderRouters() {
  const content = document.getElementById('page-content');

  try {
    const data = await API.getRouters();
    const { http = [], tcp = [], udp = [] } = data;

    content.innerHTML = `
      <!-- Tab Navigation -->
      <div class="flex gap-1 mb-6 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg w-fit">
        <button onclick="switchRouterTab('http')" class="router-tab px-4 py-2 rounded-md text-sm font-medium transition-colors bg-white dark:bg-gray-700 shadow-sm" data-tab="http">
          HTTP <span class="text-xs text-gray-400 ml-1">(${http.length})</span>
        </button>
        <button onclick="switchRouterTab('tcp')" class="router-tab px-4 py-2 rounded-md text-sm font-medium transition-colors text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200" data-tab="tcp">
          TCP <span class="text-xs text-gray-400 ml-1">(${tcp.length})</span>
        </button>
        <button onclick="switchRouterTab('udp')" class="router-tab px-4 py-2 rounded-md text-sm font-medium transition-colors text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200" data-tab="udp">
          UDP <span class="text-xs text-gray-400 ml-1">(${udp.length})</span>
        </button>
      </div>
      
      <!-- Router List Container -->
      <div id="router-list">
        ${renderRouterTable(http, 'http')}
      </div>
    `;

    // Store data for tab switching
    window._routerData = { http, tcp, udp };
  } catch (err) {
    content.innerHTML = renderError('routers', err.message);
  }
}

function renderRouterTable(routers, protocol) {
  if (!routers || routers.length === 0) {
    return `
      <div class="stat-card text-center py-12">
        <i class="ri-share-forward-line text-4xl text-gray-300 dark:text-gray-600 mb-3 block"></i>
        <p class="text-gray-500 dark:text-gray-400">No ${protocol.toUpperCase()} routers configured</p>
        <p class="text-gray-400 text-sm mt-1">Routers are created via Traefik configuration providers</p>
      </div>
    `;
  }

  return `
    <div class="stat-card overflow-hidden">
      <table class="data-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Rule</th>
            <th>Service</th>
            <th>EntryPoints</th>
            <th>Provider</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${routers
            .map(
              (r) => `
            <tr class="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800" onclick="viewRouterDetail('${protocol}', '${encodeURIComponent(r.name)}')">
              <td>
                <span class="font-medium">${escapeHtml(r.name)}</span>
                ${r.tls ? '<span class="badge badge-info text-xs ml-2">TLS</span>' : ''}
              </td>
              <td class="font-mono text-xs max-w-xs truncate block">${escapeHtml(r.rule || '-')}</td>
              <td>${escapeHtml(r.service || '-')}</td>
              <td>${(r.entryPoints || []).map((ep) => `<span class="badge badge-info text-xs mr-1">${escapeHtml(ep)}</span>`).join('') || '-'}</td>
              <td><span class="badge badge-info">${escapeHtml(r.provider || '-')}</span></td>
              <td>${renderStatusBadge(r.status)}</td>
            </tr>
          `
            )
            .join('')}
        </tbody>
      </table>
      <div class="px-4 py-3 border-t border-gray-100 dark:border-gray-700 text-sm text-gray-500">
        ${routers.length} router${routers.length !== 1 ? 's' : ''}
      </div>
    </div>
  `;
}

function switchRouterTab(protocol) {
  // Update active tab styles
  document.querySelectorAll('.router-tab').forEach((btn) => {
    const isActive = btn.dataset.tab === protocol;
    btn.className = isActive
      ? 'router-tab px-4 py-2 rounded-md text-sm font-medium transition-colors bg-white dark:bg-gray-700 shadow-sm'
      : 'router-tab px-4 py-2 rounded-md text-sm font-medium transition-colors text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200';
  });

  // Render appropriate table
  const data = window._routerData || {};
  const routers = data[protocol] || [];
  document.getElementById('router-list').innerHTML = renderRouterTable(routers, protocol);
}

async function viewRouterDetail(protocol, name) {
  const content = document.getElementById('page-content');
  showLoading();

  try {
    const data = await API.getRouter(protocol, name);
    const router = data.router;
    const service = data.service;
    const middlewares = data.middlewares || [];

    content.innerHTML = `
      <div class="mb-4">
        <button onclick="renderRouters()" class="text-primary-600 hover:text-primary-700 flex items-center gap-1 text-sm">
          <i class="ri-arrow-left-line"></i> Back to Routers
        </button>
      </div>
      
      <div class="stat-card mb-6">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-semibold">${escapeHtml(router.name)}</h3>
          ${renderStatusBadge(router.status)}
        </div>
        
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p class="text-xs text-gray-400 mb-1">Rule</p>
            <p class="font-mono text-sm">${escapeHtml(router.rule || '-')}</p>
          </div>
          <div>
            <p class="text-xs text-gray-400 mb-1">Service</p>
            <p class="text-sm">${escapeHtml(router.service || '-')}</p>
          </div>
          <div>
            <p class="text-xs text-gray-400 mb-1">EntryPoints</p>
            <div>${(router.entryPoints || []).map((ep) => `<span class="badge badge-info text-xs mr-1">${escapeHtml(ep)}</span>`).join('') || '-'}</div>
          </div>
          <div>
            <p class="text-xs text-gray-400 mb-1">Priority</p>
            <p class="text-sm">${router.priority || 0}</p>
          </div>
          <div>
            <p class="text-xs text-gray-400 mb-1">Provider</p>
            <p class="text-sm">${escapeHtml(router.provider || '-')}</p>
          </div>
          <div>
            <p class="text-xs text-gray-400 mb-1">TLS</p>
            <p class="text-sm">${router.tls ? 'Enabled' : 'Disabled'}</p>
          </div>
        </div>
        
        ${
          middlewares.length > 0
            ? `
          <div class="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
            <p class="text-xs text-gray-400 mb-2">Middlewares</p>
            <div class="flex flex-wrap gap-1">
              ${middlewares.map((m) => `<span class="badge badge-info">${escapeHtml(m.name)}</span>`).join('')}
            </div>
          </div>
        `
            : ''
        }
      </div>
      
      ${
        service
          ? `
        <div class="stat-card">
          <h4 class="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">Associated Service: ${escapeHtml(service.name)}</h4>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p class="text-xs text-gray-400 mb-1">Type</p>
              <p class="text-sm">${escapeHtml(service.type || '-')}</p>
            </div>
            <div>
              <p class="text-xs text-gray-400 mb-1">Status</p>
              ${renderStatusBadge(service.status)}
            </div>
            ${
              service.loadBalancer?.servers
                ? `
              <div class="md:col-span-2">
                <p class="text-xs text-gray-400 mb-2">Servers</p>
                <div class="space-y-1">
                  ${service.loadBalancer.servers
                    .map(
                      (s) => `
                    <div class="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded text-sm">
                      <span class="font-mono text-xs">${escapeHtml(s.url)}</span>
                      ${service.serverStatus?.[s.url] ? renderStatusBadge(service.serverStatus[s.url]) : ''}
                    </div>
                  `
                    )
                    .join('')}
                </div>
              </div>
            `
                : ''
            }
          </div>
        </div>
      `
          : ''
      }
    `;
  } catch (err) {
    content.innerHTML = `
      <button onclick="renderRouters()" class="mb-4 text-primary-600 hover:text-primary-700 flex items-center gap-1 text-sm">
        <i class="ri-arrow-left-line"></i> Back to Routers
      </button>
      ${renderError('router detail', err.message)}
    `;
  }
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
