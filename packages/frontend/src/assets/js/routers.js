// ── Router CRUD helpers ──

function getRouterDefaults(protocol) {
  const ruleDefaults = {
    http: 'PathPrefix(`/`)',
    tcp: 'HostSNI(`*`)',
    udp: '',
  };
  const rulePlaceholders = {
    http: 'PathPrefix(`/api`)',
    tcp: 'HostSNI(`example.com`)',
    udp: 'HostSNI(`example.com`)',
  };
  return {
    ruleDefault: ruleDefaults[protocol] || ruleDefaults.http,
    rulePlaceholder: rulePlaceholders[protocol] || rulePlaceholders.http,
  };
}

function showRouterModal(protocol, existingName, existingData) {
  existingName = existingName ? stripProviderSuffix(existingName) : existingName;
  const isEdit = !!existingName;

  const { ruleDefault, rulePlaceholder } = getRouterDefaults(protocol);

  const defaults = {
    rule: existingData?.rule || ruleDefault,
    service: existingData?.service || '',
    entryPoints: existingData?.entryPoints || ['web'],
    priority: existingData?.priority || 0,
    tls: existingData?.tls || false,
  };

  const modalHtml = `
    <div id="router-modal-overlay" class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onclick="if(event.target===this) closeRouterModal()">
      <div class="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onclick="event.stopPropagation()">
        <div class="p-6">
          <h3 class="text-lg font-semibold mb-4">
            ${isEdit ? 'Edit Router' : 'Add Router'} 
            <span class="text-sm text-gray-400 font-normal">(${protocol.toUpperCase()})</span>
          </h3>
          
          <div id="router-modal-error" class="hidden mb-3 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-lg text-red-700 dark:text-red-300 text-sm"></div>
          
          <form id="router-form" onsubmit="saveRouterForm(event, '${protocol}', '${escapeHtml(existingName || '')}')">
            <div class="space-y-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Router Name</label>
                <input type="text" id="rt-name" value="${escapeHtml(existingName || '')}" ${isEdit ? 'readonly class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-500"' : 'class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"'} required>
              </div>
              
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Rule</label>
                <input type="text" id="rt-rule" value="${escapeHtml(defaults.rule)}" class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm font-mono focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none" placeholder="${rulePlaceholder}">
              </div>
              
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Service</label>
                <input type="text" id="rt-service" value="${escapeHtml(defaults.service)}" class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none" placeholder="my-service">
              </div>
              
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">EntryPoints</label>
                <input type="text" id="rt-entrypoints" value="${escapeHtml((defaults.entryPoints || []).join(', '))}" class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none" placeholder="web, websecure">
                <p class="text-xs text-gray-400 mt-1">Comma-separated</p>
              </div>
              
              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Priority</label>
                  <input type="number" id="rt-priority" value="${defaults.priority}" class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none">
                </div>
                <div class="flex items-end pb-2">
                  <label class="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" id="rt-tls" ${defaults.tls ? 'checked' : ''} class="w-4 h-4 text-primary-600 rounded border-gray-300 focus:ring-primary-500">
                    <span class="text-sm font-medium text-gray-700 dark:text-gray-300">TLS</span>
                  </label>
                </div>
              </div>
            </div>
            
            <div class="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
              <button type="button" onclick="closeRouterModal()" class="py-2 px-4 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 text-sm font-medium rounded-lg transition-colors">
                Cancel
              </button>
              <button type="submit" class="py-2 px-4 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-lg transition-colors">
                ${isEdit ? 'Update' : 'Create'} Router
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `;

  const existing = document.getElementById('router-modal-overlay');
  if (existing) existing.remove();
  document.body.insertAdjacentHTML('beforeend', modalHtml);
}

function closeRouterModal() {
  document.getElementById('router-modal-overlay')?.remove();
}

async function saveRouterForm(event, protocol, existingName) {
  event.preventDefault();
  const errorEl = document.getElementById('router-modal-error');
  errorEl.classList.add('hidden');

  const name = document.getElementById('rt-name').value.trim();
  if (!name) {
    errorEl.textContent = 'Router name is required';
    errorEl.classList.remove('hidden');
    return;
  }

  const rule = document.getElementById('rt-rule').value.trim();
  const service = document.getElementById('rt-service').value.trim();
  const entryPointsRaw = document.getElementById('rt-entrypoints').value.trim();
  const entryPoints = entryPointsRaw
    ? entryPointsRaw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : [];
  const priority = parseInt(document.getElementById('rt-priority').value) || 0;
  const tls = document.getElementById('rt-tls').checked;

  const { ruleDefault } = getRouterDefaults(protocol);

  const routerData = {
    rule: rule || ruleDefault,
    service: service || undefined,
    entryPoints: entryPoints.length > 0 ? entryPoints : ['web'],
    priority,
    tls: tls || undefined,
  };

  // Remove undefined keys
  Object.keys(routerData).forEach((k) => {
    if (routerData[k] === undefined) delete routerData[k];
  });

  try {
    const result = await API.saveConfigResource('routers', protocol, name, routerData);
    if (!result.success) throw new Error(result.error || 'Failed to save router');

    closeRouterModal();
    showToast(result.message || 'Router saved', 'success');
    setTimeout(() => renderRouters(), 1500);
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.classList.remove('hidden');
  }
}

async function deleteRouter(protocol, name) {
  name = stripProviderSuffix(name);
  if (!confirm(`Delete router '${name}'? This cannot be undone.`)) return;

  try {
    const result = await API.deleteConfigResource('routers', protocol, name);
    if (!result.success) throw new Error(result.error || 'Failed to delete router');

    showToast(result.message || 'Router deleted', 'success');
    setTimeout(() => renderRouters(), 1500);
  } catch (err) {
    showToast('Error: ' + err.message, 'error');
  }
}

async function renderRouters() {
  const content = document.getElementById('page-content');

  try {
    const data = await API.getRouters();
    const { http = [], tcp = [], udp = [] } = data;

    content.innerHTML = `
      <div class="flex items-center justify-between mb-4">
        <div class="flex gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg w-fit">
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
        <div class="flex gap-2">
          <button onclick="showRouterModal('http')" class="py-2 px-3 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-1">
            <i class="ri-add-line"></i> Add HTTP
          </button>
        </div>
      </div>
      
      <div id="router-list">
        ${renderRouterTable(http, 'http')}
      </div>
    `;

    window._routerData = { http, tcp, udp };
    window._currentRouterTab = 'http';
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
        <button onclick="showRouterModal('${protocol}')" class="mt-4 py-2 px-4 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-lg transition-colors inline-flex items-center gap-1">
          <i class="ri-add-line"></i> Add ${protocol.toUpperCase()} Router
        </button>
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
            <th class="w-24">Actions</th>
          </tr>
        </thead>
        <tbody>
          ${routers
            .map(
              (r) => `
            <tr class="hover:bg-gray-50 dark:hover:bg-gray-800">
              <td class="cursor-pointer" onclick="viewRouterDetail('${protocol}', '${escapeHtml(r.name)}')">
                <span class="font-medium">${escapeHtml(r.name)}</span>
                ${r.tls ? '<span class="badge badge-info text-xs ml-2">TLS</span>' : ''}
              </td>
              <td class="font-mono text-xs max-w-xs truncate block">${escapeHtml(r.rule || '-')}</td>
              <td>${escapeHtml(r.service || '-')}</td>
              <td>${(r.entryPoints || []).map((ep) => `<span class="badge badge-info text-xs mr-1">${escapeHtml(ep)}</span>`).join('') || '-'}</td>
              <td><span class="badge badge-info">${escapeHtml(r.provider || '-')}</span></td>
              <td>${renderStatusBadge(r.status)}</td>
              <td>
                <div class="flex gap-1">
                  ${
                    r.provider === 'file'
                      ? `
                    <button onclick="event.stopPropagation(); showRouterModal('${protocol}', '${escapeHtml(r.name)}', ${JSON.stringify(r).replace(/"/g, '&quot;')})" class="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded" title="Edit">
                      <i class="ri-edit-line text-sm"></i>
                    </button>
                    <button onclick="event.stopPropagation(); deleteRouter('${protocol}', '${escapeHtml(r.name)}')" class="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded" title="Delete">
                      <i class="ri-delete-bin-line text-sm"></i>
                    </button>
                  `
                      : '<span class="text-xs text-gray-400">managed</span>'
                  }
                </div>
              </td>
            </tr>
          `
            )
            .join('')}
        </tbody>
      </table>
      <div class="px-4 py-3 border-t border-gray-100 dark:border-gray-700 text-sm text-gray-500 flex justify-between items-center">
        <span>${routers.length} router${routers.length !== 1 ? 's' : ''}</span>
        <button onclick="showRouterModal('${protocol}')" class="text-primary-600 hover:text-primary-700 text-sm flex items-center gap-1">
          <i class="ri-add-line"></i> Add
        </button>
      </div>
    </div>
  `;
}

function switchRouterTab(protocol) {
  document.querySelectorAll('.router-tab').forEach((btn) => {
    const isActive = btn.dataset.tab === protocol;
    btn.className = isActive
      ? 'router-tab px-4 py-2 rounded-md text-sm font-medium transition-colors bg-white dark:bg-gray-700 shadow-sm'
      : 'router-tab px-4 py-2 rounded-md text-sm font-medium transition-colors text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200';
  });

  // Update Add button
  const addBtn = document.querySelector(
    '#page-content .flex.items-center.justify-between .flex.gap-2 button'
  );
  if (addBtn) {
    addBtn.onclick = () => showRouterModal(protocol);
    addBtn.innerHTML = `<i class="ri-add-line"></i> Add ${protocol.toUpperCase()}`;
  }

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
      <div class="mb-4 flex items-center justify-between">
        <button onclick="renderRouters()" class="text-primary-600 hover:text-primary-700 flex items-center gap-1 text-sm">
          <i class="ri-arrow-left-line"></i> Back to Routers
        </button>
        <div class="flex gap-2">
          ${
            router.provider === 'file'
              ? `
            <button onclick="showRouterModal('${protocol}', '${escapeHtml(router.name)}', ${JSON.stringify(router).replace(/"/g, '&quot;')})" class="py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-1">
              <i class="ri-edit-line"></i> Edit
            </button>
            <button onclick="deleteRouter('${protocol}', '${escapeHtml(router.name)}')" class="py-2 px-3 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-1">
              <i class="ri-delete-bin-line"></i> Delete
            </button>
          `
              : ''
          }
        </div>
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

// Register router page
registerPage('routers', renderRouters);
