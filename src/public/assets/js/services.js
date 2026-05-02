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
            <tr class="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800" onclick="viewServiceDetail('${protocol}', '${s.name}')">
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

async function viewServiceDetail(protocol, name) {
  const content = document.getElementById('page-content');

  try {
    const data = await API.getService(protocol, name);
    const service = data.service || data;

    content.innerHTML = `
      <button onclick="renderServices()" class="mb-4 text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400">
        ← Back to Services
      </button>
      <div class="stat-card">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-xl font-semibold">${escapeHtml(service.name)}</h2>
          ${renderStatusBadge(service.status)}
        </div>
        <div class="space-y-2 text-sm">
          <div class="flex justify-between">
            <span class="text-gray-400">Type</span>
            <span>${escapeHtml(service.type || '-')}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-gray-400">Provider</span>
            <span>${escapeHtml(service.provider || '-')}</span>
          </div>
        </div>
        ${service.loadBalancer?.servers ? `
          <div class="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
            <h3 class="text-sm font-medium mb-2">Servers</h3>
            <ul class="space-y-1">
              ${service.loadBalancer.servers.map((srv) => `
                <li class="font-mono text-xs bg-gray-50 dark:bg-gray-800 px-3 py-2 rounded">${escapeHtml(srv.url)}</li>
              `).join('')}
            </ul>
          </div>
        ` : ''}
      </div>
    `;
  } catch (err) {
    content.innerHTML = renderError('service detail', err.message);
  }
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

// Register services page
registerPage('services', renderServices);
