const rolePermissions = {
  'Super Admin': ['*'],
  Admin: ['admin:read', 'content:write', 'templates:write', 'themes:write', 'settings:write', 'activity:read'],
  Editor: ['content:write', 'templates:write', 'themes:write'],
  Viewer: [],
};

let portalUser = null;

export function setPortalAuthSession(session) {
  if (!session || typeof session.subject !== 'string') {
    portalUser = null;
    return;
  }
  const role = session.is_admin
    ? 'Super Admin'
    : session.is_editor
      ? 'Editor'
      : 'Viewer';
  portalUser = { id: session.subject, name: session.subject, role, source: 'oidc-session' };
}

export function getPortalAdminUser() {
  if (portalUser) return portalUser;
  if (import.meta.env.DEV) {
    return { id: 'local-development', name: 'Local developer', role: 'Super Admin', source: 'loopback' };
  }
  return portalUser;
}

export function canAdmin(user, permission) {
  const permissions = rolePermissions[user?.role] || [];
  return permissions.includes('*') || permissions.includes(permission);
}

export function getAdminRolePermissions() {
  return rolePermissions;
}
