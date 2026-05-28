// ── Middleware CRUD helpers ──

const MIDDLEWARE_TYPES = [
  { value: 'addPrefix', label: 'Add Prefix' },
  { value: 'basicAuth', label: 'Basic Auth' },
  { value: 'compress', label: 'Compress' },
  { value: 'headers', label: 'Headers' },
  { value: 'ipWhiteList', label: 'IP White List' },
  { value: 'rateLimit', label: 'Rate Limit' },
  { value: 'redirectRegex', label: 'Redirect Regex' },
  { value: 'redirectScheme', label: 'Redirect Scheme' },
  { value: 'replacePath', label: 'Replace Path' },
  { value: 'replacePathRegex', label: 'Replace Path Regex' },
  { value: 'retry', label: 'Retry' },
  { value: 'stripPrefix', label: 'Strip Prefix' },
  { value: 'stripPrefixRegex', label: 'Strip Prefix Regex' },
];

function showMiddlewareModal(protocol, existingName, existingData) {
  existingName = existingName ? stripProviderSuffix(existingName) : existingName;
  const isEdit = !!existingName;

  const middlewareType = existingData?.type || 'stripPrefix';

  const modalHtml = `
    <div id="middleware-modal-overlay" class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onclick="if(event.target===this) closeMiddlewareModal()">
      <div class="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onclick="event.stopPropagation()">
        <div class="p-6">
          <h3 class="text-lg font-semibold mb-4">
            ${isEdit ? 'Edit Middleware' : 'Add Middleware'} 
            <span class="text-sm text-gray-400 font-normal">(${protocol.toUpperCase()})</span>
          </h3>
          
          <div id="middleware-modal-error" class="hidden mb-3 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-lg text-red-700 dark:text-red-300 text-sm"></div>
          
          <form id="middleware-form" onsubmit="saveMiddlewareForm(event, '${protocol}', '${escapeHtml(existingName || '')}')">
            <div class="space-y-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Middleware Name</label>
                <input type="text" id="mw-name" value="${escapeHtml(existingName || '')}" ${isEdit ? 'readonly class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-500"' : 'class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"'} required>
              </div>
              
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Type</label>
                <select id="mw-type" class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none">
                  ${MIDDLEWARE_TYPES.map(
                    (t) => `
                    <option value="${t.value}" ${t.value === middlewareType ? 'selected' : ''}>${t.label}</option>
                  `
                  ).join('')}
                </select>
              </div>
              
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Configuration (JSON)</label>
                <textarea id="mw-config" rows="4" class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm font-mono focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none" placeholder='{"prefixes": ["/api"]}'>${isEdit ? escapeHtml(JSON.stringify(existingData || {}, null, 2)) : '{}'}</textarea>
                <p class="text-xs text-gray-400 mt-1">Enter valid JSON for the middleware configuration</p>
              </div>
            </div>
            
            <div class="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
              <button type="button" onclick="closeMiddlewareModal()" class="py-2 px-4 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 text-sm font-medium rounded-lg transition-colors">
                Cancel
              </button>
              <button type="submit" class="py-2 px-4 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-lg transition-colors">
                ${isEdit ? 'Update' : 'Create'} Middleware
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `;

  const existing = document.getElementById('middleware-modal-overlay');
  if (existing) existing.remove();
  document.body.insertAdjacentHTML('beforeend', modalHtml);
}

function closeMiddlewareModal() {
  document.getElementById('middleware-modal-overlay')?.remove();
}

async function saveMiddlewareForm(event, protocol, existingName) {
  event.preventDefault();
  const errorEl = document.getElementById('middleware-modal-error');
  errorEl.classList.add('hidden');

  const name = document.getElementById('mw-name').value.trim();
  if (!name) {
    errorEl.textContent = 'Middleware name is required';
    errorEl.classList.remove('hidden');
    return;
  }

  const type = document.getElementById('mw-type').value;
  const configRaw = document.getElementById('mw-config').value.trim();

  let configObj = {};
  if (configRaw && configRaw !== '{}') {
    try {
      configObj = JSON.parse(configRaw);
    } catch (e) {
      errorEl.textContent = 'Invalid JSON configuration: ' + e.message;
      errorEl.classList.remove('hidden');
      return;
    }
  }

  // Build middleware data: { type: { ...config } }
  const middlewareData = {
    [type]: configObj && Object.keys(configObj).length > 0 ? configObj : {},
  };

  try {
    const result = await API.saveConfigResource('middlewares', protocol, name, middlewareData);
    if (!result.success) throw new Error(result.error || 'Failed to save middleware');

    closeMiddlewareModal();
    showToast(result.message || 'Middleware saved', 'success');
    setTimeout(() => renderMiddlewares(), 1500);
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.classList.remove('hidden');
  }
}

async function deleteMiddleware(protocol, name) {
  name = stripProviderSuffix(name);
  if (!confirm(`Delete middleware '${name}'? This cannot be undone.`)) return;

  try {
    const result = await API.deleteConfigResource('middlewares', protocol, name);
    if (!result.success) throw new Error(result.error || 'Failed to delete middleware');

    showToast(result.message || 'Middleware deleted', 'success');
    setTimeout(() => renderMiddlewares(), 1500);
  } catch (err) {
    showToast('Error: ' + err.message, 'error');
  }
}

async function renderMiddlewares() {
  const content = document.getElementById('page-content');

  try {
    const data = await API.getMiddlewares();
    const { http = [], tcp = [] } = data;

    content.innerHTML = `
      <div class="flex items-center justify-between mb-4">
        <div class="flex gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg w-fit">
          <button onclick="switchMiddlewareTab('http')" class="middleware-tab px-4 py-2 rounded-md text-sm font-medium transition-colors bg-white dark:bg-gray-700 shadow-sm" data-tab="http">
            HTTP <span class="text-xs text-gray-400 ml-1">(${http.length})</span>
          </button>
          <button onclick="switchMiddlewareTab('tcp')" class="middleware-tab px-4 py-2 rounded-md text-sm font-medium transition-colors text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200" data-tab="tcp">
            TCP <span class="text-xs text-gray-400 ml-1">(${tcp.length})</span>
          </button>
        </div>
        <div class="flex gap-2">
          <button onclick="showMiddlewareModal('http')" class="py-2 px-3 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-1">
            <i class="ri-add-line"></i> Add HTTP
          </button>
        </div>
      </div>
      
      <div id="middleware-list">
        ${renderMiddlewareTable(http, 'http')}
      </div>
    `;

    window._middlewareData = { http, tcp };
    window._currentMiddlewareTab = 'http';
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
        <button onclick="showMiddlewareModal('${protocol}')" class="mt-4 py-2 px-4 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-lg transition-colors inline-flex items-center gap-1">
          <i class="ri-add-line"></i> Add ${protocol.toUpperCase()} Middleware
        </button>
      </div>
    `;
  }

  return `
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      ${middlewares
        .map(
          (m) => `
        <div class="stat-card hover:bg-gray-50 dark:hover:bg-gray-800">
          <div class="flex items-center justify-between mb-3">
            <h4 class="font-medium truncate cursor-pointer" onclick="viewMiddlewareDetail('${protocol}', '${escapeHtml(m.name)}')">${escapeHtml(m.name)}</h4>
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
          ${
            m.provider === 'file'
              ? `
            <div class="flex justify-end gap-1 mt-3 pt-2 border-t border-gray-100 dark:border-gray-700">
              <button onclick="event.stopPropagation(); showMiddlewareModal('${protocol}', '${escapeHtml(m.name)}', ${JSON.stringify(m).replace(/"/g, '&quot;')})" class="py-1 px-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded text-xs flex items-center gap-1" title="Edit">
                <i class="ri-edit-line"></i> Edit
              </button>
              <button onclick="event.stopPropagation(); deleteMiddleware('${protocol}', '${escapeHtml(m.name)}')" class="py-1 px-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded text-xs flex items-center gap-1" title="Delete">
                <i class="ri-delete-bin-line"></i> Delete
              </button>
            </div>
          `
              : ''
          }
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
      <div class="flex items-center justify-between mb-4">
        <button onclick="renderMiddlewares()" class="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400">
          ← Back to Middlewares
        </button>
        <div class="flex gap-2">
          ${
            middleware.provider === 'file'
              ? `
            <button onclick="showMiddlewareModal('${protocol}', '${escapeHtml(middleware.name)}', ${JSON.stringify(middleware).replace(/"/g, '&quot;')})" class="py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-1">
              <i class="ri-edit-line"></i> Edit
            </button>
            <button onclick="deleteMiddleware('${protocol}', '${escapeHtml(middleware.name)}')" class="py-2 px-3 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-1">
              <i class="ri-delete-bin-line"></i> Delete
            </button>
          `
              : ''
          }
        </div>
      </div>
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
        ${
          configEntries.length > 0
            ? `
          <div class="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
            <h3 class="text-sm font-medium mb-2">Configuration</h3>
            <dl class="space-y-1">
              ${configEntries
                .map(
                  ([key, value]) => `
                <div class="flex justify-between">
                  <dt class="text-gray-400">${escapeHtml(key)}</dt>
                  <dd class="font-mono text-xs">${escapeHtml(JSON.stringify(value))}</dd>
                </div>
              `
                )
                .join('')}
            </dl>
          </div>
        `
            : ''
        }
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

  // Update Add button
  const addBtn = document.querySelector(
    '#page-content .flex.items-center.justify-between .flex.gap-2 button'
  );
  if (addBtn) {
    addBtn.onclick = () => showMiddlewareModal(protocol);
    addBtn.innerHTML = `<i class="ri-add-line"></i> Add ${protocol.toUpperCase()}`;
  }

  const data = window._middlewareData || {};
  const middlewares = data[protocol] || [];
  document.getElementById('middleware-list').innerHTML = renderMiddlewareTable(
    middlewares,
    protocol
  );
}

// Register middlewares page
registerPage('middlewares', renderMiddlewares);
