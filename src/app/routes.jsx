/**
 * Application Route & View Identifiers
 */

export const APP_ROUTES = {
  LANDING: 'landing',
  DASHBOARD: 'dashboard',
  EDITOR: 'editor',
  PREVIEW: 'preview',
};

export function getRoute() {
  const path = window.location.pathname.replace(/\/+$/, '') || '/';
  if (path === '/') return { name: APP_ROUTES.LANDING };
  if (path === '/dashboard') return { name: APP_ROUTES.DASHBOARD };
  const match = path.match(/^\/(editor|preview)\/([^/]+)$/);
  return match ? { name: match[1], id: decodeURIComponent(match[2]) } : { name: APP_ROUTES.DASHBOARD };
}
export function navigateTo(name, id = null) {
  const path = name === APP_ROUTES.LANDING ? '/' : name === APP_ROUTES.DASHBOARD ? '/dashboard' : `/${name}/${encodeURIComponent(id)}`;
  window.history.pushState({}, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

