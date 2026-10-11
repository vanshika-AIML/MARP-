import api from './api';

export const uploadService = {
  upload(file, options = {}) {
    const form = new FormData();
    form.append('file', file);
    return api.post('/uploads', form, { timeoutMs: 120000, ...options });
  },
  get(id, options = {}) { return api.get(`/uploads/${encodeURIComponent(id)}`, options); },
  delete(id) { return api.delete(`/uploads/${encodeURIComponent(id)}`); },
};
