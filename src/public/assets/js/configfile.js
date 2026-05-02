// ── Traefik Config Editor ──
// Uses CodeMirror 5 for YAML editing with syntax highlighting
// Supports both Dynamic and Static Traefik config with schema validation

let configEditor = null;
let currentConfigType = 'dynamic';

// Validate YAML content via the backend API
async function validateConfig(yamlText, type) {
  const res = await Auth.fetch('/api/configfile/validate', {
    method: 'POST',
    body: JSON.stringify({ yaml: yamlText, type }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Validation failed (${res.status})`);
  return data;
}

// Render the config page
async function renderConfigfile() {
  const content = document.getElementById('page-content');
  content.innerHTML =
    '<div class="flex items-center justify-center py-20"><div class="text-center"><div class="spinner mx-auto mb-4"></div><p class="text-gray-500">Loading config...</p></div></div>';

  try {
    const yamlContent = await loadRawConfig('dynamic');
    renderConfigEditor(yamlContent, 'dynamic');
  } catch (err) {
    content.innerHTML = renderError('config', err.message);
  }
}

// Load raw YAML config
async function loadRawConfig(type) {
  const endpoint =
    type === 'dynamic' ? '/api/configfile/dynamic?raw=true' : '/api/configfile/static?raw=true';
  const res = await Auth.fetch(endpoint);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Failed to load config (${res.status})`);
  }
  return res.text();
}

// Render the config editor with CodeMirror
function renderConfigEditor(yamlContent, type) {
  const content = document.getElementById('page-content');
  currentConfigType = type;

  content.innerHTML = `
    <div class="space-y-6 max-w-5xl">
      <!-- Info Card -->
      <div class="stat-card">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center flex-shrink-0">
            <i class="ri-file-code-line text-blue-600 dark:text-blue-400 text-xl"></i>
          </div>
          <div class="flex-1">
            <h3 class="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Traefik Configuration</h3>
            <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
              ${
                type === 'dynamic'
                  ? 'Dynamic configuration (routers, services, middlewares). Changes are picked up automatically by file watcher.'
                  : 'Static configuration (entryPoints, providers, certificates). May require Traefik restart to apply.'
              }
            </p>
          </div>
        </div>
      </div>

      <!-- Config Type Tabs -->
      <div class="flex gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg w-fit">
        <button onclick="switchConfigTab('dynamic')" id="tab-dynamic" class="config-tab px-4 py-2 rounded-md text-sm font-medium transition-colors ${type === 'dynamic' ? 'bg-white dark:bg-gray-700 shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}">
          <i class="ri-settings-3-line mr-1"></i> Dynamic
        </button>
        <button onclick="switchConfigTab('static')" id="tab-static" class="config-tab px-4 py-2 rounded-md text-sm font-medium transition-colors ${type === 'static' ? 'bg-white dark:bg-gray-700 shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}">
          <i class="ri-settings-2-line mr-1"></i> Static
        </button>
      </div>

      <!-- Editor Card -->
      <div class="stat-card">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            <i class="ri-terminal-box-line mr-1"></i> YAML Editor
          </h3>
          <div class="flex gap-2" id="config-actions">
            <button onclick="validateCurrentConfig()" id="validate-btn" class="py-2 px-3 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 text-sm font-medium rounded-lg transition-colors flex items-center gap-1">
              <i class="ri-check-double-line"></i> Validate
            </button>
            <button onclick="formatCurrentConfig()" id="format-btn" class="py-2 px-3 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 text-sm font-medium rounded-lg transition-colors flex items-center gap-1">
              <i class="ri-format-clear"></i> Format
            </button>
            <button onclick="saveCurrentConfig()" id="save-config-btn" class="py-2 px-4 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-1">
              <i class="ri-save-line"></i> Save
            </button>
          </div>
        </div>
        
        <!-- Validation messages -->
        <div id="config-message" class="hidden mb-3"></div>
        
        <!-- CodeMirror Container -->
        <div id="codemirror-container" class="border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden" style="height: 500px;">
          <textarea id="config-textarea">${escapeHtml(yamlContent)}</textarea>
        </div>
        
        <p class="text-xs text-gray-400 mt-2">
          <i class="ri-information-line mr-1"></i> 
          ${
            type === 'dynamic'
              ? 'Dynamic config is watched by Traefik and reloaded automatically.'
              : 'Static config changes require a Traefik restart to take effect.'
          }
        </p>
      </div>
    </div>
  `;

  // Initialize CodeMirror
  setTimeout(() => {
    const textarea = document.getElementById('config-textarea');
    if (!textarea) return;

    configEditor = CodeMirror.fromTextArea(textarea, {
      mode: 'yaml',
      theme: document.documentElement.classList.contains('dark') ? 'monokai' : 'default',
      lineNumbers: true,
      lineWrapping: true,
      tabSize: 2,
      indentUnit: 2,
      indentWithTabs: false,
      matchBrackets: true,
      autoCloseBrackets: true,
      gutters: ['CodeMirror-linenumbers'],
    });

    configEditor.setSize('100%', '500px');
  }, 50);
}

// Switch between dynamic and static config tabs
async function switchConfigTab(type) {
  if (type === currentConfigType && configEditor) return;

  // Update tab styles immediately
  document.querySelectorAll('.config-tab').forEach((btn) => {
    const isActive = btn.id === `tab-${type}`;
    btn.className = isActive
      ? 'config-tab px-4 py-2 rounded-md text-sm font-medium transition-colors bg-white dark:bg-gray-700 shadow-sm'
      : 'config-tab px-4 py-2 rounded-md text-sm font-medium transition-colors text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200';
  });

  try {
    const yamlContent = await loadRawConfig(type);
    currentConfigType = type;

    // Update info text
    const infoText = document.querySelector('.stat-card p.text-sm');
    if (infoText) {
      infoText.textContent =
        type === 'dynamic'
          ? 'Dynamic configuration (routers, services, middlewares). Changes are picked up automatically by file watcher.'
          : 'Static configuration (entryPoints, providers, certificates). May require Traefik restart to apply.';
    }

    // Update footer hint
    const footerHint = document.querySelector('p.mt-2 .text-xs, p.text-xs.text-gray-400.mt-2');
    if (footerHint) {
      footerHint.innerHTML = `<i class="ri-information-line mr-1"></i> ${type === 'dynamic' ? 'Dynamic config is watched by Traefik and reloaded automatically.' : 'Static config changes require a Traefik restart to take effect.'}`;
    }

    if (configEditor) {
      configEditor.setValue(yamlContent);
      configEditor.clearHistory();
      configEditor.setOption('readOnly', false);
    }
  } catch (err) {
    currentConfigType = type;
    // Show a helpful message in the editor area
    if (configEditor) {
      const message =
        err.message.includes('not configured') || err.message.includes('404')
          ? '# Static config is not configured.\n# Set STATIC_CONFIG_PATH environment variable to enable static config editing.\n# Traefik static configuration includes entryPoints, providers, certificates, etc.'
          : `# Error loading config: ${err.message}`;
      configEditor.setValue(message);
      configEditor.setOption('readOnly', true);
      configEditor.clearHistory();
    }
    showToast(
      type === 'static'
        ? 'Static config not configured. Set STATIC_CONFIG_PATH to enable.'
        : 'Error: ' + err.message,
      'warning'
    );
  }
}

// Validate current YAML content via backend
async function validateCurrentConfig() {
  if (!configEditor) return;

  const validateBtn = document.getElementById('validate-btn');
  const messageEl = document.getElementById('config-message');
  const yamlContent = configEditor.getValue();

  validateBtn.disabled = true;
  validateBtn.innerHTML = '<div class="spinner-sm mr-1"></div> Validating...';
  messageEl.classList.add('hidden');

  try {
    const result = await validateConfig(yamlContent, currentConfigType);

    if (result.valid) {
      messageEl.innerHTML =
        '<div class="p-3 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 rounded-lg flex items-center gap-2"><i class="ri-check-line text-green-600 dark:text-green-400"></i><span class="text-sm text-green-700 dark:text-green-300">Configuration is valid!</span></div>';
    } else {
      const errors = result.errors || [];
      if (errors.length === 0) {
        messageEl.innerHTML =
          '<div class="p-3 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 rounded-lg flex items-center gap-2"><i class="ri-check-line text-green-600 dark:text-green-400"></i><span class="text-sm text-green-700 dark:text-green-300">Configuration is valid!</span></div>';
      } else {
        // Check if just YAML is valid but schema is unavailable
        if (result.yamlValid && errors.some((e) => e.includes('schema') || e.includes('Schema'))) {
          messageEl.innerHTML = `<div class="p-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg"><div class="flex items-center gap-2 mb-1"><i class="ri-information-line text-gray-500"></i><span class="text-sm font-medium text-gray-600 dark:text-gray-300">YAML syntax OK — schema unavailable</span></div><p class="text-sm text-gray-500">${escapeHtml(errors[0])}</p></div>`;
        } else {
          messageEl.innerHTML = `<div class="p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-lg"><div class="flex items-center gap-2 mb-2"><i class="ri-error-warning-line text-red-600 dark:text-red-400"></i><span class="text-sm font-medium text-red-700 dark:text-red-300">${errors.length} validation issue${errors.length !== 1 ? 's' : ''} found</span></div><ul class="list-disc list-inside text-sm text-red-600 dark:text-red-400 space-y-1 max-h-48 overflow-y-auto">${errors.map((e) => `<li class="font-mono text-xs">${escapeHtml(e)}</li>`).join('')}</ul></div>`;
        }
      }
    }
    messageEl.classList.remove('hidden');
  } catch (err) {
    messageEl.innerHTML = `<div class="p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-lg flex items-center gap-2"><i class="ri-error-warning-line text-red-600 dark:text-red-400"></i><span class="text-sm text-red-700 dark:text-red-300">${escapeHtml(err.message)}</span></div>`;
    messageEl.classList.remove('hidden');
  } finally {
    validateBtn.disabled = false;
    validateBtn.innerHTML = '<i class="ri-check-double-line"></i> Validate';
  }
}

// Format the current YAML config
async function formatCurrentConfig() {
  if (!configEditor) return;

  const formatBtn = document.getElementById('format-btn');
  const messageEl = document.getElementById('config-message');
  const yamlContent = configEditor.getValue();

  formatBtn.disabled = true;
  formatBtn.innerHTML = '<div class="spinner-sm mr-1"></div> Formatting...';
  messageEl.classList.add('hidden');

  try {
    const result = await API.formatConfig(yamlContent);

    if (!result.success) throw new Error(result.error || 'Format failed');

    // Replace editor content with formatted YAML
    configEditor.setValue(result.formatted);
    configEditor.clearHistory();

    messageEl.innerHTML =
      '<div class="p-3 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 rounded-lg flex items-center gap-2"><i class="ri-check-line text-green-600 dark:text-green-400"></i><span class="text-sm text-green-700 dark:text-green-300">YAML formatted successfully.</span></div>';
    messageEl.classList.remove('hidden');
    showToast('YAML formatted', 'success');

    setTimeout(() => messageEl.classList.add('hidden'), 3000);
  } catch (err) {
    messageEl.innerHTML = `<div class="p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-lg flex items-center gap-2"><i class="ri-error-warning-line text-red-600 dark:text-red-400"></i><span class="text-sm text-red-700 dark:text-red-300">${escapeHtml(err.message)}</span></div>`;
    messageEl.classList.remove('hidden');
  } finally {
    formatBtn.disabled = false;
    formatBtn.innerHTML = '<i class="ri-format-clear"></i> Format';
  }
}

// Save the current config
async function saveCurrentConfig() {
  if (!configEditor) return;

  const saveBtn = document.getElementById('save-config-btn');
  const messageEl = document.getElementById('config-message');
  const yamlContent = configEditor.getValue();
  const type = currentConfigType;

  saveBtn.disabled = true;
  saveBtn.innerHTML = '<div class="spinner-sm mr-1"></div> Saving...';
  messageEl.classList.add('hidden');

  try {
    const saveFn = type === 'dynamic' ? API.saveDynamicConfig : API.saveStaticConfig;
    const result = await saveFn(yamlContent);

    if (!result.success) throw new Error(result.error || 'Save failed');

    configEditor.clearHistory();

    messageEl.innerHTML = `<div class="p-3 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 rounded-lg flex items-center gap-2"><i class="ri-check-line text-green-600 dark:text-green-400"></i><span class="text-sm text-green-700 dark:text-green-300">${escapeHtml(result.message || 'Config saved successfully.')}</span></div>`;
    messageEl.classList.remove('hidden');
    showToast('Config saved successfully', 'success');

    setTimeout(() => messageEl.classList.add('hidden'), 5000);
  } catch (err) {
    messageEl.innerHTML = `<div class="p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-lg flex items-center gap-2"><i class="ri-error-warning-line text-red-600 dark:text-red-400"></i><span class="text-sm text-red-700 dark:text-red-300">${escapeHtml(err.message)}</span></div>`;
    messageEl.classList.remove('hidden');
  } finally {
    saveBtn.disabled = false;
    saveBtn.innerHTML = '<i class="ri-save-line"></i> Save';
  }
}

// Register the configfile page
registerPage('configfile', renderConfigfile);
