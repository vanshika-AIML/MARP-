/** Central transport. Components use services, never fetch directly. */
const DEFAULT_BASE = import.meta.env.VITE_API_BASE_URL || window.location.origin;

function readCookie(name) {
  const prefix = `${encodeURIComponent(name)}=`;
  const cookie = document.cookie.split(';').map((part) => part.trim()).find((part) => part.startsWith(prefix));
  return cookie ? decodeURIComponent(cookie.slice(prefix.length)) : '';
}

export class ApiError extends Error {
  constructor(message, { status = 0, code = 'network_error', details = null } = {}) {
    super(message); this.name = 'ApiError'; this.status = status; this.code = code; this.details = details;
    this.isTimeout = code === 'timeout'; this.isNetworkError = code === 'network_error';
  }
}
export class ApiClient {
  constructor(baseUrl = DEFAULT_BASE) { this.setBaseUrl(baseUrl); this.timeoutMs = 15000; }
  setBaseUrl(baseUrl) { this.baseUrl = new URL(baseUrl || '/', window.location.origin).href.replace(/\/+$/, '').replace(/\/api\/v1$/, ''); this.apiUrl = `${this.baseUrl}/api/v1`; }
  wsUrl(path) {
    const configured = import.meta.env.VITE_WS_BASE_URL?.replace(/\/+$/, '').replace(/\/api\/v1$/, '');
    if (configured) return `${configured}/api/v1${path}`;
    const url = new URL(`${this.apiUrl}${path}`); url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'; return url.toString();
  }
  mediaUrl(path) { return /^\/api\/v1\/media\/[a-f0-9-]+\/file$/i.test(path || '') ? `${this.baseUrl}${path}` : null; }
  async request(endpoint, options = {}) {
    const { timeoutMs = this.timeoutMs, signal, responseType = 'json', ...init } = options;
    const controller = new AbortController(); let timedOut = false; const abort = () => controller.abort();
    if (signal?.aborted) abort(); else signal?.addEventListener('abort', abort, { once: true });
    const timer = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);
    const headers = new Headers(init.headers); headers.set('Accept', 'application/json');
    if (init.body != null && !(init.body instanceof FormData)) headers.set('Content-Type', 'application/json');
    if (!['GET', 'HEAD', 'OPTIONS'].includes((init.method || 'GET').toUpperCase())) {
      const csrfToken = readCookie('marp_csrf');
      if (csrfToken) headers.set('X-CSRF-Token', csrfToken);
    }
    try {
      const response = await fetch(`${this.apiUrl}/${endpoint.replace(/^\//, '')}`, {
        ...init,
        headers,
        credentials: init.credentials || 'same-origin',
        signal: controller.signal,
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null); const error = payload?.error; const detail = payload?.detail;
        throw new ApiError(error?.message || (typeof detail === 'string' ? detail : `Request failed (HTTP ${response.status}).`), { status: response.status, code: error?.code || 'http_error', details: error?.details || (Array.isArray(detail) ? detail : null) });
      }
      if (response.status === 204) return undefined;
      if (responseType === 'blob') return await response.blob();
      if (responseType === 'text') return await response.text();
      try { return await response.json(); }
      catch { throw new ApiError('The server did not return valid API data. Check that the backend is running and /api/v1 is routed to it.', { code: 'invalid_response' }); }
    } catch (error) {
      if (timedOut) throw new ApiError(`Request timed out after ${timeoutMs / 1000} seconds. Please retry.`, { code: 'timeout' });
      if (signal?.aborted || error.name === 'AbortError') throw new DOMException('Request cancelled.', 'AbortError');
      if (error instanceof TypeError) throw new ApiError('Cannot reach MARP Studio API. Check the backend connection.');
      throw error;
    } finally { clearTimeout(timer); signal?.removeEventListener('abort', abort); }
  }
  get(path, options = {}) { return this.request(path, { ...options, method: 'GET' }); }
  post(path, data, options = {}) { return this.request(path, { ...options, method: 'POST', body: data instanceof FormData ? data : JSON.stringify(data) }); }
  patch(path, data, options = {}) { return this.request(path, { ...options, method: 'PATCH', body: JSON.stringify(data) }); }
  put(path, data, options = {}) { return this.request(path, { ...options, method: 'PUT', body: JSON.stringify(data) }); }
  delete(path, options = {}) { return this.request(path, { ...options, method: 'DELETE' }); }
  async list(path, options = {}) {
    const result = [];
    for (let offset = 0; ; offset += 100) {
      const page = await this.get(`${path}${path.includes('?') ? '&' : '?'}limit=100&offset=${offset}`, options);
      if (!Array.isArray(page)) throw new ApiError('The API returned an invalid list.', { code: 'invalid_response' });
      result.push(...page); if (page.length < 100) return result;
    }
  }
}
export const api = new ApiClient();
export default api;
