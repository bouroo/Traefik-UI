// ── Service CRUD helpers ──

function getServiceDefaults(protocol) {
  const defaults = {
    http: { defaultUrl: 'http://localhost:8080', placeholder: 'http://host:port' },
    tcp: { defaultUrl: '192.168.0.1:8080', placeholder: 'host:port' },
    udp: { defaultUrl: '192.168.0.1:8080', placeholder: 'host:port' },
  };
  return defaults[protocol] || defaults.http;
}

// Show modal for adding/editing a service
function showServiceModal(protocol, existingName, existingData) {
  existingName = existingName ? stripProviderSuffix(existingName) : existingName;
  const isEdit = !!existingName;
  const content = document.getElementById('page-content');
  
  window._currentServiceModalProtocol = protocol;
  
  const serviceDefaults = getServiceDefaults(protocol);
  
  // Build server list from existing data or empty
  let servers = [{ url: serviceDefaults.defaultUrl }];
  if (existingData?.loadBalancer?.servers?.length) {
    servers = existingData.loadBalancer.servers.map((s) => ({ url: s.url }));
  }
  
  const modalHtml = `
    <div id="service-modal-overlay" class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onclick="if(event.target===this) closeServiceModal()">
      <div class="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onclick="event.stopPropagation()">
        <div class="p-6">
          <h3 class="text-lg font-semibold mb-4">
            ${isEdit ? 'Edit Service' : 'Add Service'} 
            <span class="text-sm text-gray-400 font-normal">(${protocol.toUpperCase()})</span>
          </h3>
          
          <div id="service-modal-error" class="hidden mb-3 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-lg text-red-700 dark:text-red-300 text-sm"></div>
          
          <form id="service-form" onsubmit="saveServiceForm(event, '${protocol}', '${escapeHtml(existingName || '')}')">
            <div class="space-y-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Service Name</label>
                <input type="text" id="svc-name" value="${escapeHtml(existingName || '')}" ${isEdit ? 'readonly class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-500"' : 'class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"'} required>
              </div>
              
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Servers</label>
                <div id="svc-servers" class="space-y-2">
                  ${servers.map((s, i) => `
                    <div class="flex gap-2 items-center">
                      <input type="text" value="${escapeHtml(s.url)}" data-server-idx="${i}" class="svc-server-url flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm font-mono focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none" placeholder="${serviceDefaults.placeholder}">
                      <button type="button" onclick="removeServerRow(this)" class="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg" title="Remove server">
                        <i class="ri-delete-bin-line"></i>
                      </button>
                    </div>
                  `).join('')}
                </div>
                <button type="button" onclick="addServerRow()" class="mt-2 text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1">
                  <i class="ri-add-line"></i> Add Server
                </button>
              </div>
            </div>
            
            <div class="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
              <button type="button" onclick="closeServiceModal()" class="py-2 px-4 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 text-sm font-medium rounded-lg transition-colors">
                Cancel
              </button>
              <button type="submit" class="py-2 px-4 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-lg transition-colors">
                ${isEdit ? 'Update' : 'Create'} Service
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `;
  
  // Append modal to body
  const existing = document.getElementById('service-modal-overlay');
  if (existing) existing.remove();
  document.body.insertAdjacentHTML('beforeend', modalHtml);
}

function closeServiceModal() {
  const overlay = document.getElementById('service-modal-overlay');
  if (overlay) overlay.remove();
}

function addServerRow() {
  const container = document.getElementById('svc-servers');
  const idx = container.children.length;
  const protocol = window._currentServiceModalProtocol || 'http';
  const serviceDefaults = getServiceDefaults(protocol);
  const row = document.createElement('div');
  row.className = 'flex gap-2 items-center';
  row.innerHTML = `
    <input type="text" data-server-idx="${idx}" class="svc-server-url flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm font-mono focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none" placeholder="${serviceDefaults.placeholder}">
    <button type="button" onclick="removeServerRow(this)" class="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg" title="Remove server">
      <i class="ri-delete-bin-line"></i>
    </button>
  `;
  container.appendChild(row);
}

function removeServerRow(btn) {
  const row = btn.parentElement;
  if (document.querySelectorAll('#svc-servers > div').length <= 1) return;
  row.remove();
}

async function saveServiceForm(event, protocol, existingName) {
  event.preventDefault();
  const errorEl = document.getElementById('service-modal-error');
  errorEl.classList.add('hidden');
  
  const nameEl = document.getElementById('svc-name');
  const name = nameEl.value.trim();
  if (!name) {
    errorEl.textContent = 'Service name is required';
    errorEl.classList.remove('hidden');
    return;
  }
  
  const serverUrls = [];
  document.querySelectorAll('.svc-server-url').forEach((input) => {
    const url = input.value.trim();
    if (url) serverUrls.push({ url });
  });
  
  if (serverUrls.length === 0) {
    errorEl.textContent = 'At least one server URL is required';
    errorEl.classList.remove('hidden');
    return;
  }
  
  const serviceData = {
    loadBalancer: {
      servers: serverUrls,
    },
  };
  
  try {
    const result = await API.saveConfigResource('services', protocol, name, serviceData);
    if (!result.success) throw new Error(result.error || 'Failed to save service');
    
    closeServiceModal();
    showToast(result.message || 'Service saved', 'success');
    // Reload the page to show updated data
    setTimeout(() => renderServices(), 1500);
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.classList.remove('hidden');
  }
}

// Delete a service
async function deleteService(protocol, name) {
  name = stripProviderSuffix(name);
  if (!confirm(`Delete service '${name}'? This cannot be undone.`)) return;
  
  try {
    const result = await API.deleteConfigResource('services', protocol, name);
    if (!result.success) throw new Error(result.error || 'Failed to delete service');
    
    showToast(result.message || 'Service deleted', 'success');
    setTimeout(() => renderServices(), 1500);
  } catch (err) {
    showToast('Error: ' + err.message, 'error');
  }
}

async function renderServices() {
  const content = document.getElementById('page-content');

  try {
    const data = await API.getServices();
    const { http = [], tcp = [], udp = [] } = data;

    content.innerHTML = `
      <div class="flex items-center justify-between mb-4">
        <div class="flex gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg w-fit">
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
        <div class="flex gap-2">
          <button onclick="showServiceModal('http')" class="py-2 px-3 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-1">
            <i class="ri-add-line"></i> Add HTTP
          </button>
        </div>
      </div>
      
      <div id="service-list">
        ${renderServiceTable(http, 'http')}
      </div>
    `;

    window._serviceData = { http, tcp, udp };
    window._currentServiceTab = 'http';
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
        <button onclick="showServiceModal('${protocol}')" class="mt-4 py-2 px-4 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-lg transition-colors inline-flex items-center gap-1">
          <i class="ri-add-line"></i> Add ${protocol.toUpperCase()} Service
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
            <th>Type</th>
            <th>Servers</th>
            <th>Provider</th>
            <th>Status</th>
            <th class="w-24">Actions</th>
          </tr>
        </thead>
        <tbody>
          ${services
            .map(
              (s) => `
            <tr class="hover:bg-gray-50 dark:hover:bg-gray-800">
              <td class="font-medium cursor-pointer" onclick="viewServiceDetail('${protocol}', '${escapeHtml(s.name)}')">${escapeHtml(s.name)}</td>
              <td>${escapeHtml(s.type || '-')}</td>
              <td>${(s.loadBalancer?.servers || []).map((srv) => `<span class="font-mono text-xs">${escapeHtml(srv.url)}</span>`).join('<br>') || '-'}</td>
              <td><span class="badge badge-info">${escapeHtml(s.provider || '-')}</span></td>
              <td>${renderStatusBadge(s.status)}</td>
              <td>
                <div class="flex gap-1">
                  ${s.provider === 'file' ? `
                    <button onclick="event.stopPropagation(); showServiceModal('${protocol}', '${escapeHtml(s.name)}', ${JSON.stringify(s).replace(/"/g, '&quot;')})" class="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded" title="Edit">
                      <i class="ri-edit-line text-sm"></i>
                    </button>
                    <button onclick="event.stopPropagation(); deleteService('${protocol}', '${escapeHtml(s.name)}')" class="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded" title="Delete">
                      <i class="ri-delete-bin-line text-sm"></i>
                    </button>
                  ` : '<span class="text-xs text-gray-400">managed</span>'}
                </div>
              </td>
            </tr>
          `
            )
            .join('')}
        </tbody>
      </table>
      <div class="px-4 py-3 border-t border-gray-100 dark:border-gray-700 text-sm text-gray-500 flex justify-between items-center">
        <span>${services.length} service${services.length !== 1 ? 's' : ''}</span>
        <button onclick="showServiceModal('${protocol}')" class="text-primary-600 hover:text-primary-700 text-sm flex items-center gap-1">
          <i class="ri-add-line"></i> Add
        </button>
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
      <div class="flex items-center justify-between mb-4">
        <button onclick="renderServices()" class="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400">
          ← Back to Services
        </button>
        <div class="flex gap-2">
          ${service.provider === 'file' ? `
            <button onclick="showServiceModal('${protocol}', '${escapeHtml(service.name)}', ${JSON.stringify(service).replace(/"/g, '&quot;')})" class="py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-1">
              <i class="ri-edit-line"></i> Edit
            </button>
            <button onclick="deleteService('${protocol}', '${escapeHtml(service.name)}')" class="py-2 px-3 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-1">
              <i class="ri-delete-bin-line"></i> Delete
            </button>
          ` : ''}
        </div>
      </div>
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

  // Update Add button for current protocol
  const addBtn = document.querySelector('#page-content .flex.items-center.justify-between .flex.gap-2 button');
  if (addBtn) {
    addBtn.setAttribute('onclick', `showServiceModal('${protocol}')`);
    addBtn.innerHTML = `<i class="ri-add-line"></i> Add ${protocol.toUpperCase()}`;
    // Re-bind click event
    addBtn.onclick = () => showServiceModal(protocol);
  }

  const data = window._serviceData || {};
  const services = data[protocol] || [];
  document.getElementById('service-list').innerHTML = renderServiceTable(services, protocol);
}

// Register services page
registerPage('services', renderServices);
