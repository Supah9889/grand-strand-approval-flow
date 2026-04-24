/**
 * usePermissions — resolves effective permissions for the current session.
 *
 * Pulls the RolePermission record for the current role from the DB,
 * then merges in any employee-level overrides if the user logged in via employee code.
 *
 * Returns { permissions, hasPermission, loading }
 */
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { getInternalRole, getSessionEmployee } from '@/lib/adminAuth';
import { resolvePermissions, getRoleDefaults } from '@/lib/permissions';

export function usePermissions() {
  const role = getInternalRole();
  const sessionEmployee = getSessionEmployee();

  const { data: rolePermRecords = [], isLoading } = useQuery({
    queryKey: ['role-permissions', role],
    queryFn: () => base44.entities.RolePermission.filter({ role }),
    enabled: !!role && role !== 'owner',
    staleTime: 60_000,
  });

  // Owner always gets everything, no DB needed
  if (role === 'owner') {
    const permissions = resolvePermissions({ role: 'owner' });
    return {
      permissions,
      hasPermission: () => true,
      loading: false,
    };
  }

  if (isLoading) {
    return { permissions: {}, hasPermission: () => false, loading: true };
  }

  const storedRolePerms = rolePermRecords[0]
    ? (() => { try { return JSON.parse(rolePermRecords[0].permissions || '{}'); } catch { return {}; } })()
    : null;

  const employeeOverrides = sessionEmployee?.permission_overrides
    ? (() => { try { return JSON.parse(sessionEmployee.permission_overrides); } catch { return null; } })()
    : null;

  const permissions = resolvePermissions({ role, storedRolePerms, employeeOverrides });

  return {
    permissions,
    hasPermission: (key) => !!permissions[key],
    loading: false,
  };
}