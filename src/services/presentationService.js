import api from './api';
import { parseMarpPresentation } from '../utils/marpParser';

export const normalizePresentation = (item) => ({
  ...item,
  createdAt: item.created_at,
  updatedAt: item.updated_at,
  theme: parseMarpPresentation(item.markdown || '').globalDirectives.theme || 'default',
});

function payload(data) {
  return Object.fromEntries(Object.entries(data).filter(([key]) => ['title', 'description', 'markdown', 'theme_id', 'status'].includes(key)));
}

export const presentationService = {
  async listPresentations(options = {}) {
    const items = await api.list('/presentations', options);
    const result = [];
    for (let index = 0; index < items.length; index += 6) {
      result.push(...await Promise.all(items.slice(index, index + 6).map((item) => this.getPresentation(item.id, options))));
    }
    return result;
  },
  async getPresentation(id, options = {}) {
    if (!id) throw new Error('Presentation ID is required');
    return normalizePresentation(await api.get(`/presentations/${encodeURIComponent(id)}`, options));
  },
  async createPresentation(data) { return normalizePresentation(await api.post('/presentations', payload(data))); },
  async createFromTemplate(id) { return normalizePresentation(await api.post(`/templates/${encodeURIComponent(id)}/create-presentation`, {})); },
  async updatePresentation(id, data) { return normalizePresentation(await api.patch(`/presentations/${encodeURIComponent(id)}`, payload(data))); },
  deletePresentation(id) { return api.delete(`/presentations/${encodeURIComponent(id)}`); },
  getSlides(id, options = {}) { return api.list(`/presentations/${encodeURIComponent(id)}/slides`, options); },
  addSlide(id, data) { return api.post(`/presentations/${encodeURIComponent(id)}/slides`, data); },
  updateSlide(id, data) { return api.patch(`/slides/${encodeURIComponent(id)}`, data); },
  deleteSlide(id) { return api.delete(`/slides/${encodeURIComponent(id)}`); },
  reorderSlides(id, slideIds) { return api.post(`/presentations/${encodeURIComponent(id)}/slides/reorder`, { slide_ids: slideIds }); },
  exportPresentation(id, format, data = {}) {
    if (format !== 'pptx') throw new Error('Unsupported export format.');
    return api.post(`/presentations/${encodeURIComponent(id)}/export/pptx`, data, { responseType: 'blob', timeoutMs: 60000 });
  },
};
export default presentationService;
