import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AppShell } from '@/components/app-shell';
import { LoginPage } from '@/routes/login';
import { DashboardPage } from '@/routes/dashboard';
import { RoutersPage } from '@/routes/routers';
import { ServicesPage } from '@/routes/services';
import { MiddlewaresPage } from '@/routes/middlewares';
import { TlsPage } from '@/routes/tls';
import { EntrypointsPage } from '@/routes/entrypoints';
import { LogsPage } from '@/routes/logs';
import { SystemPage } from '@/routes/system';
import { ConfigfilePage } from '@/routes/configfile';
import { NotFoundPage } from '@/routes/placeholder-pages';

const UsersPage = lazy(() => import('@/routes/admin/users'));
const GroupsPage = lazy(() => import('@/routes/admin/groups'));
const RolesPage = lazy(() => import('@/routes/admin/roles'));
const IdpPage = lazy(() => import('@/routes/admin/idp'));

function AdminSuspense({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="p-8 text-center text-muted-foreground">Loading...</div>}>
      {children}
    </Suspense>
  );
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/*"
        element={
          <AppShell>
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
              <Route
                path="/admin/users"
                element={
                  <AdminSuspense>
                    <UsersPage />
                  </AdminSuspense>
                }
              />
              <Route
                path="/admin/groups"
                element={
                  <AdminSuspense>
                    <GroupsPage />
                  </AdminSuspense>
                }
              />
              <Route
                path="/admin/roles"
                element={
                  <AdminSuspense>
                    <RolesPage />
                  </AdminSuspense>
                }
              />
              <Route
                path="/admin/idp"
                element={
                  <AdminSuspense>
                    <IdpPage />
                  </AdminSuspense>
                }
              />
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </AppShell>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
