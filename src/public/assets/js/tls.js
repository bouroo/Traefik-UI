async function renderTls() {
  const content = document.getElementById('page-content');

  try {
    const data = await API.getCertificates();
    const certs = data.certificates || [];

    content.innerHTML = `
      ${
        certs.length === 0
          ? `
        <div class="stat-card text-center py-12">
          <i class="ri-shield-keyhole-line text-4xl text-gray-300 dark:text-gray-600 mb-3 block"></i>
          <p class="text-gray-500 dark:text-gray-400">No TLS certificates found</p>
          <p class="text-gray-400 text-sm mt-1">Configure ACME in Traefik static config and mount acme.json</p>
        </div>
      `
          : `
        <div class="stat-card overflow-hidden">
          <table class="data-table">
            <thead>
              <tr>
                <th>Domain</th>
                <th>SANs</th>
                <th>Not Before</th>
                <th>Not After</th>
                <th>Issuer</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${certs
                .map(
                  (cert) => `
                <tr>
                  <td class="font-medium">${escapeHtml(cert.domain || '-')}</td>
                  <td class="text-xs">${(cert.sans || []).map((s) => escapeHtml(s)).join(', ') || '-'}</td>
                  <td class="text-xs">${cert.notBefore ? formatDate(cert.notBefore) : '-'}</td>
                  <td class="text-xs">${cert.notAfter ? formatDate(cert.notAfter) : '-'}</td>
                  <td class="text-xs">${escapeHtml(cert.issuer || '-')}</td>
                  <td>${
                    cert.isExpired
                      ? '<span class="badge badge-danger">Expired</span>'
                      : '<span class="badge badge-success">Valid</span>'
                  }</td>
                </tr>
              `
                )
                .join('')}
            </tbody>
          </table>
          <div class="px-4 py-3 border-t border-gray-100 dark:border-gray-700 text-sm text-gray-500">
            ${certs.length} certificate${certs.length !== 1 ? 's' : ''}
          </div>
        </div>
      `
      }
    `;
  } catch (err) {
    content.innerHTML = renderError('TLS certificates', err.message);
  }
}

// Entrypoints page
async function renderEntrypoints() {
  const content = document.getElementById('page-content');

  try {
    const data = await API.getEntrypoints();
    const entrypoints = data.entrypoints || [];

    content.innerHTML = `
      ${
        entrypoints.length === 0
          ? `
        <div class="stat-card text-center py-12">
          <i class="ri-plug-line text-4xl text-gray-300 dark:text-gray-600 mb-3 block"></i>
          <p class="text-gray-500 dark:text-gray-400">No entrypoints configured</p>
        </div>
      `
          : `
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          ${entrypoints
            .map(
              (ep) => `
            <div class="stat-card">
              <div class="flex items-center justify-between mb-3">
                <h4 class="font-semibold">${escapeHtml(ep.name)}</h4>
                <span class="badge badge-success">Active</span>
              </div>
              <div class="space-y-2 text-sm">
                <div class="flex justify-between">
                  <span class="text-gray-400">Address</span>
                  <span class="font-mono text-xs">${escapeHtml(ep.address || '-')}</span>
                </div>
                ${
                  ep.proxyProtocol
                    ? `
                  <div class="flex justify-between">
                    <span class="text-gray-400">Proxy Protocol</span>
                    <span>${ep.proxyProtocol.insecure ? 'Insecure' : 'Secure'}</span>
                  </div>
                `
                    : ''
                }
                ${
                  ep.forwardedHeaders
                    ? `
                  <div class="flex justify-between">
                    <span class="text-gray-400">Forwarded Headers</span>
                    <span>${ep.forwardedHeaders.insecure ? 'Insecure' : 'Trusted'}</span>
                  </div>
                `
                    : ''
                }
                ${
                  ep.http3
                    ? `
                  <div class="flex justify-between">
                    <span class="text-gray-400">HTTP/3</span>
                    <span class="badge badge-info">Port ${ep.http3.advertisedPort || 'N/A'}</span>
                  </div>
                `
                    : ''
                }
                ${
                  ep.transport?.respondingTimeouts
                    ? `
                  <div class="flex justify-between">
                    <span class="text-gray-400">Read Timeout</span>
                    <span>${ep.transport.respondingTimeouts.readTimeout || '-'}</span>
                  </div>
                `
                    : ''
                }
              </div>
            </div>
          `
            )
            .join('')}
        </div>
      `
      }
    `;
  } catch (err) {
    content.innerHTML = renderError('entrypoints', err.message);
  }
}

// Logs page
async function renderLogs() {
  const content = document.getElementById('page-content');

  try {
    const data = await API.getAccessLogs({ lines: 50 });
    const lines = data.lines || [];

    content.innerHTML = `
      <div class="mb-4 flex justify-between items-center">
        <div>
          <span class="text-sm text-gray-500">Showing ${lines.length} log entries</span>
        </div>
        <button onclick="renderLogs()" class="px-3 py-1.5 text-sm bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors flex items-center gap-1">
          <i class="ri-refresh-line"></i> Refresh
        </button>
      </div>
      
      ${
        lines.length === 0
          ? `
        <div class="stat-card text-center py-12">
          <i class="ri-file-list-3-line text-4xl text-gray-300 dark:text-gray-600 mb-3 block"></i>
          <p class="text-gray-500 dark:text-gray-400">No log entries found</p>
          <p class="text-gray-400 text-sm mt-1">Configure access log path in Traefik-UI settings</p>
        </div>
      `
          : `
        <div class="stat-card overflow-hidden">
          <table class="data-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Method</th>
                <th>Path</th>
                <th>Status</th>
                <th>Duration</th>
                <th>Client IP</th>
              </tr>
            </thead>
            <tbody>
              ${lines
                .map(
                  (line) => `
                <tr>
                  <td class="text-xs whitespace-nowrap">${escapeHtml(line.timestamp || '-')}</td>
                  <td><span class="badge badge-info">${escapeHtml(line.method || '-')}</span></td>
                  <td class="font-mono text-xs max-w-xs truncate block">${escapeHtml(line.path || '-')}</td>
                  <td>${renderStatusBadge(String(line.status || ''))}</td>
                  <td class="text-xs">${line.duration ? line.duration + 'ms' : '-'}</td>
                  <td class="text-xs font-mono">${escapeHtml(line.clientIp || '-')}</td>
                </tr>
              `
                )
                .join('')}
            </tbody>
          </table>
        </div>
      `
      }
    `;
  } catch (err) {
    content.innerHTML = renderError('logs', err.message);
  }
}

// Register TLS pages
registerPage('tls', renderTls);
registerPage('entrypoints', renderEntrypoints);
registerPage('logs', renderLogs);
