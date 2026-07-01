import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Route,
  Blend,
  Webhook,
  Shield,
  Globe,
  FileText,
  Server,
  FileCode,
  Menu,
  Sun,
  Moon,
  LogOut,
  X,
  ChevronDown,
  Users,
  UserCog,
  ShieldCheck,
  Key,
} from 'lucide-react';
import { useUiStore } from '@/stores/ui-store';
import { useAuth } from '@/hooks/use-auth';
import { RequirePermission } from '@/components/permission-guard';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, permission: 'traefik.dashboard.read' },
  { to: '/routers', label: 'Routers', icon: Route, permission: 'traefik.routers.read' },
  { to: '/services', label: 'Services', icon: Blend, permission: 'traefik.services.read' },
  { to: '/middlewares', label: 'Middlewares', icon: Webhook, permission: 'traefik.middlewares.read' },
  { to: '/tls', label: 'TLS', icon: Shield, permission: 'traefik.tls.read' },
  { to: '/entrypoints', label: 'Entrypoints', icon: Globe, permission: 'traefik.entrypoints.read' },
  { to: '/logs', label: 'Logs', icon: FileText, permission: 'traefik.logs.read' },
  { to: '/system', label: 'System', icon: Server, permission: 'traefik.system.read' },
  { to: '/configfile', label: 'Config File', icon: FileCode, permission: 'traefik.config.read' },
];

const adminItems = [
  { to: '/admin/users', label: 'Users', icon: Users, permission: 'system.users.read' },
  { to: '/admin/groups', label: 'Groups', icon: UserCog, permission: 'system.users.read' },
  { to: '/admin/roles', label: 'Roles', icon: ShieldCheck, permission: 'system.roles.read' },
  { to: '/admin/idp', label: 'Identity Provider', icon: Key, permission: 'system.idp.read' },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { sidebarOpen, theme, toggleSidebar, toggleTheme } = useUiStore();
  const { user, logout, isAdmin } = useAuth();
  const [adminOpen, setAdminOpen] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') root.classList.add('dark');
    else root.classList.remove('dark');
  }, [theme]);

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  return (
    <TooltipProvider>
      <div>
        <div className="min-h-screen bg-background text-foreground">
          <div className="fixed top-0 left-0 right-0 z-50 flex h-14 items-center gap-4 border-b bg-background px-4 lg:hidden">
            <Button variant="ghost" size="icon" onClick={toggleSidebar}>
              {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
            <span className="font-semibold">Traefik UI</span>
          </div>

          {sidebarOpen && (
            <div
              className="fixed inset-0 z-40 bg-black/50 lg:hidden"
              onClick={toggleSidebar}
            />
          )}

          <aside
            className={`fixed left-0 top-0 bottom-0 z-50 w-64 transform border-r bg-background transition-transform duration-200 lg:translate-x-0 ${
              sidebarOpen ? 'translate-x-0' : '-translate-x-full'
            }`}
          >
            <div className="flex h-14 items-center border-b px-4">
              <span className="font-semibold">Traefik UI</span>
            </div>
            <nav className="space-y-1 p-2">
              {navItems.map(({ to, label, icon: Icon, permission }) => (
                <RequirePermission key={to} permission={permission}>
                  <Link
                    to={to}
                    onClick={() => toggleSidebar()}
                    className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                      isActive(to)
                        ? 'bg-secondary text-secondary-foreground'
                        : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                  </Link>
                </RequirePermission>
              ))}

              {isAdmin && (
                <>
                  <button
                    onClick={() => setAdminOpen(!adminOpen)}
                    className="flex w-full items-center justify-between rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
                  >
                    <span className="flex items-center gap-3">
                      <Key className="h-4 w-4" />
                      Admin
                    </span>
                    <ChevronDown
                      className={`h-4 w-4 transition-transform ${adminOpen ? 'rotate-180' : ''}`}
                    />
                  </button>

                  {adminOpen && (
                    <div className="ml-4 space-y-1">
                      {adminItems.map(({ to, label, icon: Icon, permission }) => (
                        <RequirePermission key={to} permission={permission}>
                          <Link
                            to={to}
                            onClick={() => toggleSidebar()}
                            className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                              isActive(to)
                                ? 'bg-secondary text-secondary-foreground'
                                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                            }`}
                          >
                            <Icon className="h-4 w-4" />
                            {label}
                          </Link>
                        </RequirePermission>
                      ))}
                    </div>
                  )}
                </>
              )}
            </nav>
          </aside>

          <div className="lg:pl-64">
            <header className="hidden lg:flex h-14 items-center justify-between border-b bg-background px-6">
              <div />
              <div className="flex items-center gap-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" onClick={toggleTheme}>
                      {theme === 'dark' ? (
                        <Sun className="h-4 w-4" />
                      ) : (
                        <Moon className="h-4 w-4" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                  </TooltipContent>
                </Tooltip>
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-xs font-medium">
                  {user?.username?.charAt(0).toUpperCase() || '?'}
                </div>
                <Button variant="ghost" size="sm" onClick={logout}>
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>
            </header>

            <main className="p-4 pt-[4.5rem] lg:pt-4">{children}</main>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}