const rolePermissions = {
  'Super Admin': ['*'],
  Admin: ['content:write', 'templates:write', 'themes:write', 'settings:write', 'activity:read'],
  Editor: ['content:write', 'templates:write', 'themes:write'],
  Viewer: ['admin:read'],
};

export function getPortalAdminUser() {
  // Replace this adapter with the IEEE portal session provider at integration time.
  const role = import.meta.env.VITE_MARP_ADMIN_ROLE || (import.meta.env.DEV ? 'Super Admin' : 'Viewer');
  return { id: 'portal-adapter', name: 'Portal Admin', role, source: 'portal-adapter' };
}

export function canAdmin(user, permission) {
  const permissions = rolePermissions[user?.role] || [];
  return permissions.includes('*') || permissions.includes(permission) || permission === 'admin:read' && permissions.length > 0;
}

export function getAdminRolePermissions() {
  return rolePermissions;
}
