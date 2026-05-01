/**
 * Reusable UI components for Traefik-UI
 * Used across page modules via window.* global exposure
 */

/**
 * Render tab navigation bar
 * @param {Array<{id: string, label: string, count: number}>} tabs
 * @param {string} activeTab - currently selected tab id
 * @param {string} tabGroupClass - CSS class prefix for tab buttons (e.g., 'router-tab')
 * @param {string} onSwitchName - name of the global onSwitch function to call
 * @returns {string} HTML string
 */
function renderTabs(tabs, activeTab, tabGroupClass, onSwitchName) {
  return `
    <div class="flex gap-1 mb-6 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg w-fit">
      ${tabs
        .map(
          (tab) => `
        <button onclick="${onSwitchName}('${tab.id}')" class="${tabGroupClass} px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab.id === activeTab ? 'bg-white dark:bg-gray-700 shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}" data-tab="${tab.id}">
          ${tab.label} <span class="text-xs text-gray-400 ml-1">(${tab.count})</span>
        </button>
      `
        )
        .join('')}
    </div>
  `;
}

/**
 * Render empty state placeholder
 * @param {string} icon - remixicon class
 * @param {string} title
 * @param {string} subtitle (optional)
 * @returns {string} HTML string
 */
function renderEmptyState(icon, title, subtitle) {
  return `
    <div class="stat-card text-center py-12">
      <i class="${icon} text-4xl text-gray-300 dark:text-gray-600 mb-3 block"></i>
      <p class="text-gray-500 dark:text-gray-400">${title}</p>
      ${subtitle ? `<p class="text-gray-400 text-sm mt-1">${subtitle}</p>` : ''}
    </div>
  `;
}

/**
 * Render a data table with configurable columns
 * @param {Array<{key: string, label: string, render?: Function}>} columns
 * @param {Array<Object>} rows
 * @param {Object} options - { onRowClick, footerText }
 * @returns {string} HTML string
 */
function renderDataTable(columns, rows, options = {}) {
  if (!rows || rows.length === 0) {
    return '<div class="stat-card text-center py-8 text-gray-400">No data available</div>';
  }

  return `
    <div class="stat-card overflow-hidden">
      <table class="data-table">
        <thead>
          <tr>
            ${columns.map((col) => `<th>${col.label}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${rows
            .map(
              (row) => `
            <tr ${options.onRowClick ? `class="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800" onclick="${options.onRowClick}(${JSON.stringify(row).replace(/"/g, '&quot;')})"` : ''}>
              ${columns
                .map((col) => {
                  const value = col.render
                    ? col.render(row[col.key], row)
                    : escapeHtml(row[col.key] ?? '-');
                  return `<td>${value}</td>`;
                })
                .join('')}
            </tr>
          `
            )
            .join('')}
        </tbody>
      </table>
      ${
        options.footerText
          ? `
        <div class="px-4 py-3 border-t border-gray-100 dark:border-gray-700 text-sm text-gray-500">
          ${options.footerText}
        </div>
      `
          : ''
      }
    </div>
  `;
}

/**
 * Render a stats card
 * @param {string} title
 * @param {string|number} value
 * @param {string} icon - remixicon class
 * @param {string} iconBgColor - tailwind background class for icon container
 * @param {string} subtitle (optional) - smaller text below value
 * @returns {string} HTML string
 */
function renderStatCard(title, value, icon, iconBgColor, subtitle) {
  return `
    <div class="stat-card">
      <div class="flex items-center justify-between">
        <div>
          <p class="text-sm text-gray-500 dark:text-gray-400">${title}</p>
          <p class="text-2xl font-bold mt-1">${value}</p>
        </div>
        <div class="w-10 h-10 rounded-lg ${iconBgColor} flex items-center justify-center">
          <i class="${icon} text-xl"></i>
        </div>
      </div>
      ${subtitle ? `<p class="text-xs text-gray-400 mt-2">${subtitle}</p>` : ''}
    </div>
  `;
}

// Expose all components globally
window.renderTabs = renderTabs;
window.renderEmptyState = renderEmptyState;
window.renderDataTable = renderDataTable;
window.renderStatCard = renderStatCard;
