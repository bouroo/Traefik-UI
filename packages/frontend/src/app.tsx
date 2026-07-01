import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AppShell } from '@/components/app-shell';
import { ErrorBoundary } from '@/components/error-boundary';

const LoginPage = lazy(() =>
  import('@/routes/login').then((m) => ({ default: m.LoginPage })),
);
const DashboardPage = lazy(() =>
  import('@/routes/dashboard').then((m) => ({ default: m.DashboardPage })),
);
const RoutersPage = lazy(() =>
  import('@/routes/routers').then((m) => ({ default: m.RoutersPage })),
);
const ServicesPage = lazy(() =>
  import('@/routes/services').then((m) => ({ default: m.ServicesPage })),
);
const MiddlewaresPage = lazy(() =>
  import('@/routes/middlewares').then((m) => ({ default: m.MiddlewaresPage })),
);
const TlsPage = lazy(() =>
  import('@/routes/tls').then((m) => ({ default: m.TlsPage })),
);
const EntrypointsPage = lazy(() =>
  import('@/routes/entrypoints').then((m) => ({ default: m.EntrypointsPage })),
);
const LogsPage = lazy(() =>
  import('@/routes/logs').then((m) => ({ default: m.LogsPage })),
);
const SystemPage = lazy(() =>
  import('@/routes/system').then((m) => ({ default: m.SystemPage })),
);
const ConfigfilePage = lazy(() =>
  import('@/routes/configfile').then((m) => ({ default: m.ConfigfilePage })),
);
const NotFoundPage = lazy(() =>
  import('@/routes/placeholder-pages').then((m) => ({ default: m.NotFoundPage })),
);
const UsersPage = lazy(() => import('@/routes/admin/users'));
const GroupsPage = lazy(() => import('@/routes/admin/groups'));
const RolesPage = lazy(() => import('@/routes/admin/roles'));
const IdpPage = lazy(() => import('@/routes/admin/idp'));

function PageFallback() {
  return <div className="p-8 text-center text-muted-foreground">Loading...</div>;
}

export function App() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<PageFallback />}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/*"
            element={
              <AppShell>
                <ErrorBoundary>
                  <Routes>
                    <Route path="/" element={<DashboardPage />} />
                    <Route path="/routers" element={<RoutersPage />} />
                    <Route path="/services" element={<ServicesPage />} />
                    <Route path="/middlewares" element={<MiddlewaresPage />} />
                    <Route path="/tls" element={<TlsPage />} />
                    <Route path="/entrypoints" element={<EntrypointsPage />} />
                    <Route path="/logs" element={<LogsPage />} />
                    <Route path="/system" element={<SystemPage />} />
                    <Route path="/configfile" element={<ConfigfilePage />} />
                    <Route path="/admin/users" element={<UsersPage />} />
                    <Route path="/admin/groups" element={<GroupsPage />} />
                    <Route path="/admin/roles" element={<RolesPage />} />
                    <Route path="/admin/idp" element={<IdpPage />} />
                    <Route path="*" element={<NotFoundPage />} />
                  </Routes>
                </ErrorBoundary>
              </AppShell>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}
