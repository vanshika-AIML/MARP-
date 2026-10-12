import { afterEach, describe, expect, it } from 'vitest';
import { canAdmin, getPortalAdminUser, setPortalAuthSession } from './adminAuthAdapter';

afterEach(() => setPortalAuthSession(null));

describe('server-backed admin role display', () => {
  it('does not grant administrator UI permissions to a viewer', () => {
    setPortalAuthSession({ subject: 'viewer-1', is_admin: false, is_editor: false });
    const user = getPortalAdminUser();
    expect(user.role).toBe('Viewer');
    expect(canAdmin(user, 'admin:read')).toBe(false);
  });

  it('maps the authenticated administrator role to admin UI permissions', () => {
    setPortalAuthSession({ subject: 'admin-1', is_admin: true, is_editor: true });
    const user = getPortalAdminUser();
    expect(user.role).toBe('Super Admin');
    expect(canAdmin(user, 'admin:read')).toBe(true);
  });
});
