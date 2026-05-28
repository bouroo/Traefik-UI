// Simple hash-based router
// Routes: #/dashboard, #/routers, #/services, #/middlewares, #/tls, #/entrypoints, #/logs, #/system, #/settings

// Page registry for data-driven routing
const pageRegistry = {};

function registerPage(name, handler) {
  pageRegistry[name] = handler;
}

function getRoute() {
  const hash = window.location.hash.slice(1); // remove #
  const path = hash.split('/')[1] || 'dashboard';
  return path;
}

async function handleRoute() {
  if (!Auth.isAuthenticated()) {
    window.location.hash = '#/login';
    return;
  }

  const route = getRoute();
  const handler = pageRegistry[route];

  setPageTitle(route);
  setActiveNav(route);
  showLoading();

  if (handler) {
    try {
      await handler();
    } catch (err) {
      console.error('Error rendering %s:', route, err);
      document.getElementById('page-content').innerHTML = `
        <div class="text-center py-20">
          <i class="ri-error-warning-line text-4xl text-red-500 mb-4 block"></i>
          <p class="text-red-500">Failed to load page: ${err.message}</p>
          <button onclick="handleRoute()" class="mt-4 px-4 py-2 bg-primary-600 text-white rounded-lg">Retry</button>
        </div>
      `;
    }
  } else {
    // 404 — redirect to dashboard
    window.location.hash = '#/dashboard';
    handleRoute();
  }
}

// Listen for hash changes
window.addEventListener('hashchange', handleRoute);

// Initial route handling
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    if (Auth.isAuthenticated() && window.location.hash) {
      handleRoute();
    }
  });
}
