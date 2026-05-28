import { useAuth } from '@/hooks/use-auth';

interface RequirePermissionProps {
  permission: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function RequirePermission({ permission, children, fallback }: RequirePermissionProps) {
  const { hasPermission } = useAuth();
  if (!hasPermission(permission)) return fallback ?? null;
  return <>{children}</>;
}

interface RequireAdminProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function RequireAdmin({ children, fallback }: RequireAdminProps) {
  const { isAdmin } = useAuth();
  if (!isAdmin) return fallback ?? null;
  return <>{children}</>;
}