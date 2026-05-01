// Dashboard page
async function renderDashboard() {
  const content = document.getElementById('page-content');

  try {
    const data = await API.getDashboard();

    const overview = data.overview || {};
    const version = data.version || {};
    const entrypoints = data.entrypoints || [];

    // Calculate totals
    let httpRouters = 0,
      httpServices = 0,
      httpMiddlewares = 0;
    let tcpRouters = 0,
      tcpServices = 0,
      tcpMiddlewares = 0;
    let udpRouters = 0,
      udpServices = 0;

    if (overview.http) {
      Object.values(overview.http).forEach((v) => {
        httpRouters += v.routers || 0;
        httpServices += v.services || 0;
        httpMiddlewares += v.middlewares || 0;
      });
    }
    if (overview.tcp) {
      Object.values(overview.tcp).forEach((v) => {
        tcpRouters += v.routers || 0;
        tcpServices += v.services || 0;
        tcpMiddlewares += v.middlewares || 0;
      });
    }
    if (overview.udp) {
      Object.values(overview.udp).forEach((v) => {
        udpRouters += v.routers || 0;
        udpServices += v.services || 0;
      });
    }

    const totalRouters = httpRouters + tcpRouters + udpRouters;
    const totalServices = httpServices + tcpServices + udpServices;
    const totalMiddlewares = httpMiddlewares + tcpMiddlewares;

    content.innerHTML = `
      <!-- Connection Status Banner -->
      ${
        data.connectionStatus !== 'connected'
          ? `
        <div class="mb-6 p-4 bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-700 rounded-lg">
          <div class="flex items-center gap-2">
            <i class="ri-alert-line text-yellow-600 dark:text-yellow-400"></i>
            <span class="text-yellow-700 dark:text-yellow-300">Traefik API is not reachable. Some features may be unavailable.</span>
          </div>
        </div>
      `
          : ''
      }

      <!-- Stats Cards -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div class="stat-card">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm text-gray-500 dark:text-gray-400">Total Routers</p>
              <p class="text-2xl font-bold mt-1">${totalRouters}</p>
            </div>
            <div class="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center">
              <i class="ri-share-forward-line text-blue-600 dark:text-blue-400 text-xl"></i>
            </div>
          </div>
          <div class="mt-3 flex gap-3 text-xs text-gray-500">
            <span>HTTP: ${httpRouters}</span>
            <span>TCP: ${tcpRouters}</span>
            <span>UDP: ${udpRouters}</span>
          </div>
        </div>

        <div class="stat-card">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm text-gray-500 dark:text-gray-400">Services</p>
              <p class="text-2xl font-bold mt-1">${totalServices}</p>
            </div>
            <div class="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900/50 flex items-center justify-center">
              <i class="ri-server-line text-green-600 dark:text-green-400 text-xl"></i>
            </div>
          </div>
          <div class="mt-3 flex gap-3 text-xs text-gray-500">
            <span>HTTP: ${httpServices}</span>
            <span>TCP: ${tcpServices}</span>
            <span>UDP: ${udpServices}</span>
          </div>
        </div>

        <div class="stat-card">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm text-gray-500 dark:text-gray-400">Middlewares</p>
              <p class="text-2xl font-bold mt-1">${totalMiddlewares}</p>
            </div>
            <div class="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/50 flex items-center justify-center">
              <i class="ri-stack-line text-purple-600 dark:text-purple-400 text-xl"></i>
            </div>
          </div>
          <div class="mt-3 flex gap-3 text-xs text-gray-500">
            <span>HTTP: ${httpMiddlewares}</span>
            <span>TCP: ${tcpMiddlewares}</span>
          </div>
        </div>

        <div class="stat-card">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm text-gray-500 dark:text-gray-400">EntryPoints</p>
              <p class="text-2xl font-bold mt-1">${entrypoints.length}</p>
            </div>
            <div class="w-10 h-10 rounded-lg bg-orange-100 dark:bg-orange-900/50 flex items-center justify-center">
              <i class="ri-plug-line text-orange-600 dark:text-orange-400 text-xl"></i>
            </div>
          </div>
        </div>
      </div>

      <!-- Traefik Info & EntryPoints -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <!-- Traefik Version Info -->
        <div class="stat-card">
          <h3 class="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">Traefik Info</h3>
          <div class="space-y-2">
            <div class="flex justify-between">
              <span class="text-sm text-gray-500">Version</span>
              <span class="text-sm font-mono">${version.version || 'N/A'}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-sm text-gray-500">Codename</span>
              <span class="text-sm">${version.codename || 'N/A'}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-sm text-gray-500">Uptime</span>
              <span class="text-sm">${version.uptime || 'N/A'}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-sm text-gray-500">Started</span>
              <span class="text-sm">${version.startDate ? formatDate(version.startDate) : 'N/A'}</span>
            </div>
          </div>
          ${
            overview.providers
              ? `
            <div class="mt-4">
              <h4 class="text-xs font-semibold text-gray-400 uppercase mb-2">Providers</h4>
              <div class="flex flex-wrap gap-1">
                ${overview.providers.map((p) => `<span class="badge badge-info">${p}</span>`).join('')}
              </div>
            </div>
          `
              : ''
          }
          ${
            overview.features
              ? `
            <div class="mt-3">
              <h4 class="text-xs font-semibold text-gray-400 uppercase mb-2">Features</h4>
              <div class="flex flex-wrap gap-1">
                ${Object.entries(overview.features)
                  .map(
                    ([k, v]) => `
                  <span class="badge ${v ? 'badge-success' : 'badge-warning'}">${k}: ${v ? 'enabled' : 'disabled'}</span>
                `
                  )
                  .join('')}
              </div>
            </div>
          `
              : ''
          }
        </div>

        <!-- EntryPoints -->
        <div class="stat-card">
          <h3 class="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">EntryPoints</h3>
          ${
            entrypoints.length === 0
              ? '<p class="text-gray-400 text-sm">No entrypoints configured</p>'
              : `
            <div class="space-y-2">
              ${entrypoints
                .map(
                  (ep) => `
                <div class="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                  <div>
                    <span class="font-medium text-sm">${ep.name}</span>
                    <span class="text-xs text-gray-400 ml-2 font-mono">${ep.address || ''}</span>
                  </div>
                  <span class="badge badge-success text-xs">Active</span>
                </div>
              `
                )
                .join('')}
            </div>
          `
          }
        </div>
      </div>

      <!-- Provider Stats -->
      ${renderProviderStats(overview)}
    `;
  } catch (err) {
    content.innerHTML = `
      <div class="text-center py-20">
        <i class="ri-error-warning-line text-4xl text-red-500 mb-4 block"></i>
        <p class="text-red-500 dark:text-red-400">Failed to load dashboard</p>
        <p class="text-gray-400 text-sm mt-1">${err.message}</p>
      </div>
    `;
  }
}

// Helper to render per-provider breakdown
function renderProviderStats(overview) {
  if (!overview) return '';

  const sections = [];
  ['http', 'tcp', 'udp'].forEach((protocol) => {
    const data = overview[protocol];
    if (!data || Object.keys(data).length === 0) return;

    sections.push(`
      <div class="stat-card">
        <h3 class="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">${protocol.toUpperCase()} by Provider</h3>
        <table class="data-table">
          <thead>
            <tr>
              <th>Provider</th>
              <th>Routers</th>
              <th>Services</th>
              ${protocol !== 'udp' ? '<th>Middlewares</th>' : ''}
            </tr>
          </thead>
          <tbody>
            ${Object.entries(data)
              .map(
                ([provider, stats]) => `
              <tr>
                <td class="font-medium">${provider}</td>
                <td>${stats.routers || 0}</td>
                <td>${stats.services || 0}</td>
                ${protocol !== 'udp' ? `<td>${stats.middlewares || 0}</td>` : ''}
              </tr>
            `
              )
              .join('')}
          </tbody>
        </table>
      </div>
    `);
  });

  return sections.length > 0
    ? `<div class="grid grid-cols-1 gap-6 mt-6">${sections.join('')}</div>`
    : '';
}

// Register dashboard page
registerPage('dashboard', renderDashboard);
