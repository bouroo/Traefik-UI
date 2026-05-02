async function renderMiddlewares() {
  const content = document.getElementById('page-content');

  try {
    const data = await API.getMiddlewares();
    const { http = [], tcp = [] } = data;

    content.innerHTML = `
      <div class="flex gap-1 mb-6 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg w-fit">
        <button onclick="switchMiddlewareTab('http')" class="middleware-tab px-4 py-2 rounded-md text-sm font-medium transition-colors bg-white dark:bg-gray-700 shadow-sm" data-tab="http">
          HTTP <span class="text-xs text-gray-400 ml-1">(${http.length})</span>
        </button>
        <button onclick="switchMiddlewareTab('tcp')" class="middleware-tab px-4 py-2 rounded-md text-sm font-medium transition-colors text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200" data-tab="tcp">
          TCP <span class="text-xs text-gray-400 ml-1">(${tcp.length})</span>
        </button>
      </div>
      
      <div id="middleware-list">
        ${renderMiddlewareTable(http, 'http')}
      </div>
    `;

    window._middlewareData = { http, tcp };
  } catch (err) {
    content.innerHTML = renderError('middlewares', err.message);
  }
}

function renderMiddlewareTable(middlewares, protocol) {
  if (!middlewares || middlewares.length === 0) {
    return `
      <div class="stat-card text-center py-12">
        <i class="ri-stack-line text-4xl text-gray-300 dark:text-gray-600 mb-3 block"></i>
        <p class="text-gray-500 dark:text-gray-400">No ${protocol.toUpperCase()} middlewares configured</p>
      </div>
    `;
  }

  return `
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      ${middlewares
        .map(
          (m) => `
        <div class="stat-card cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800" onclick="viewMiddlewareDetail('${protocol}', '${m.name}')">
          <div class="flex items-center justify-between mb-3">
            <h4 class="font-medium truncate">${escapeHtml(m.name)}</h4>
            ${renderStatusBadge(m.status)}
          </div>
          <div class="space-y-1 text-sm">
            <div class="flex justify-between">
              <span class="text-gray-400">Type</span>
              <span class="badge badge-info">${escapeHtml(m.type || 'Unknown')}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-400">Provider</span>
              <span>${escapeHtml(m.provider || '-')}</span>
            </div>
          </div>
        </div>
      `
        )
        .join('')}
    </div>
  `;
}

async function viewMiddlewareDetail(protocol, name) {
  const content = document.getElementById('page-content');

  try {
    const middleware = await API.getMiddleware(protocol, name);

    const { name: _, type: __, provider: ___, status: ____, ...config } = middleware;
    const configEntries = Object.entries(config);

    content.innerHTML = `
      <button onclick="renderMiddlewares()" class="mb-4 text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400">
        ← Back to Middlewares
      </button>
      <div class="stat-card">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-xl font-semibold">${escapeHtml(middleware.name)}</h2>
          ${renderStatusBadge(middleware.status)}
        </div>
        <div class="space-y-2 text-sm">
          <div class="flex justify-between">
            <span class="text-gray-400">Type</span>
            <span>${escapeHtml(middleware.type || '-')}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-gray-400">Provider</span>
            <span>${escapeHtml(middleware.provider || '-')}</span>
          </div>
        </div>
        ${configEntries.length > 0 ? `
          <div class="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
            <h3 class="text-sm font-medium mb-2">Configuration</h3>
            <dl class="space-y-1">
              ${configEntries.map(([key, value]) => `
                <div class="flex justify-between">
                  <dt class="text-gray-400">${escapeHtml(key)}</dt>
                  <dd class="font-mono text-xs">${escapeHtml(JSON.stringify(value))}</dd>
                </div>
              `).join('')}
            </dl>
          </div>
        ` : ''}
      </div>
    `;
  } catch (err) {
    content.innerHTML = renderError('middleware detail', err.message);
  }
}

function switchMiddlewareTab(protocol) {
  document.querySelectorAll('.middleware-tab').forEach((btn) => {
    const isActive = btn.dataset.tab === protocol;
    btn.className = isActive
      ? 'middleware-tab px-4 py-2 rounded-md text-sm font-medium transition-colors bg-white dark:bg-gray-700 shadow-sm'
      : 'middleware-tab px-4 py-2 rounded-md text-sm font-medium transition-colors text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200';
  });

  const data = window._middlewareData || {};
  const middlewares = data[protocol] || [];
  document.getElementById('middleware-list').innerHTML = renderMiddlewareTable(
    middlewares,
    protocol
  );
}

// Register middlewares page
registerPage('middlewares', renderMiddlewares);
