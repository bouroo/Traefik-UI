// System page — shows server stats and app configuration
async function renderSystem() {
  const content = document.getElementById('page-content');

  try {
    const stats = await API.getSystemStats();

    content.innerHTML = `
      <!-- System Stats -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div class="stat-card">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm text-gray-500 dark:text-gray-400">CPU Usage</p>
              <p class="text-2xl font-bold mt-1">${stats.cpu.usagePercent.toFixed(1)}%</p>
            </div>
            <div class="w-10 h-10 rounded-lg bg-red-100 dark:bg-red-900/50 flex items-center justify-center">
              <i class="ri-cpu-line text-red-600 dark:text-red-400 text-xl"></i>
            </div>
          </div>
          <p class="text-xs text-gray-400 mt-2">${stats.cpu.cores} cores · ${stats.cpu.model || ''}</p>
        </div>

        <div class="stat-card">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm text-gray-500 dark:text-gray-400">Memory</p>
              <p class="text-2xl font-bold mt-1">${stats.memory.usedPercent.toFixed(1)}%</p>
            </div>
            <div class="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center">
              <i class="ri-database-2-line text-blue-600 dark:text-blue-400 text-xl"></i>
            </div>
          </div>
          <p class="text-xs text-gray-400 mt-2">${formatBytes(stats.memory.usedMB * 1024 * 1024)} / ${formatBytes(stats.memory.totalMB * 1024 * 1024)}</p>
        </div>

        <div class="stat-card">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm text-gray-500 dark:text-gray-400">Uptime</p>
              <p class="text-2xl font-bold mt-1">${formatUptime(stats.uptime)}</p>
            </div>
            <div class="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900/50 flex items-center justify-center">
              <i class="ri-timer-line text-green-600 dark:text-green-400 text-xl"></i>
            </div>
          </div>
        </div>

        <div class="stat-card">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm text-gray-500 dark:text-gray-400">Bun Runtime</p>
              <p class="text-2xl font-bold mt-1">${stats.bunVersion}</p>
            </div>
            <div class="w-10 h-10 rounded-lg bg-yellow-100 dark:bg-yellow-900/50 flex items-center justify-center">
              <i class="ri-bug-line text-yellow-600 dark:text-yellow-400 text-xl"></i>
            </div>
          </div>
          <p class="text-xs text-gray-400 mt-2">${stats.platform} · ${stats.arch}</p>
        </div>
      </div>

      <!-- Memory Bar -->
      <div class="stat-card mb-6">
        <h3 class="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">Memory Usage</h3>
        <div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4">
          <div class="bg-blue-600 h-4 rounded-full transition-all duration-500" style="width: ${stats.memory.usedPercent.toFixed(1)}%"></div>
        </div>
        <div class="flex justify-between mt-2 text-xs text-gray-500">
          <span>Used: ${formatBytes(stats.memory.usedMB * 1024 * 1024)}</span>
          <span>Free: ${formatBytes(stats.memory.freeMB * 1024 * 1024)}</span>
          <span>Total: ${formatBytes(stats.memory.totalMB * 1024 * 1024)}</span>
        </div>
      </div>

      <!-- System Info -->
      <div class="stat-card">
        <h3 class="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">System Information</h3>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p class="text-xs text-gray-400 mb-1">Platform</p>
            <p class="font-medium">${stats.platform}</p>
          </div>
          <div>
            <p class="text-xs text-gray-400 mb-1">Architecture</p>
            <p class="font-medium">${stats.arch}</p>
          </div>
          <div>
            <p class="text-xs text-gray-400 mb-1">Bun Version</p>
            <p class="font-medium">${stats.bunVersion}</p>
          </div>
          <div>
            <p class="text-xs text-gray-400 mb-1">Uptime</p>
            <p class="font-medium">${formatUptime(stats.uptime)}</p>
          </div>
        </div>
      </div>
    `;
  } catch (err) {
    content.innerHTML = `
      <div class="text-center py-20">
        <i class="ri-error-warning-line text-4xl text-red-500 mb-4 block"></i>
        <p class="text-red-500">Failed to load system stats</p>
        <p class="text-gray-400 text-sm mt-1">${err.message}</p>
      </div>
    `;
  }
}

// Settings page
async function renderSettings() {
  const content = document.getElementById('page-content');

  content.innerHTML = `
    <div class="max-w-2xl">
      <div class="stat-card mb-6">
        <h3 class="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">Change Password</h3>
        <form id="change-password-form" class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Current Password</label>
            <input type="password" id="current-password" required
              class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none">
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">New Password</label>
            <input type="password" id="new-password" required minlength="6"
              class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none">
          </div>
          <div id="password-error" class="text-red-500 text-sm hidden"></div>
          <div id="password-success" class="text-green-500 text-sm hidden"></div>
          <button type="submit"
            class="py-2 px-4 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg transition-colors">
            Update Password
          </button>
        </form>
      </div>

      <div class="stat-card">
        <h3 class="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">About Traefik-UI</h3>
        <div class="space-y-2 text-sm">
          <div class="flex justify-between">
            <span class="text-gray-500">Version</span>
            <span>1.0.0</span>
          </div>
          <div class="flex justify-between">
            <span class="text-gray-500">Runtime</span>
            <span>Bun + Hono.js</span>
          </div>
          <div class="flex justify-between">
            <span class="text-gray-500">License</span>
            <span>MIT</span>
          </div>
        </div>
      </div>
    </div>
  `;

  // Password change handler
  document.getElementById('change-password-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const currentPw = document.getElementById('current-password').value;
    const newPw = document.getElementById('new-password').value;
    const errEl = document.getElementById('password-error');
    const successEl = document.getElementById('password-success');

    try {
      const res = await Auth.fetch('/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw }),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Failed to change password');

      successEl.textContent = 'Password updated successfully';
      successEl.classList.remove('hidden');
      errEl.classList.add('hidden');
      document.getElementById('change-password-form').reset();
    } catch (err) {
      errEl.textContent = err.message;
      errEl.classList.remove('hidden');
      successEl.classList.add('hidden');
    }
  });
}

// Register system and settings pages
registerPage('system', renderSystem);
registerPage('settings', renderSettings);
