/**
 * Presentation Service
 * Encapsulates all REST operations for presentation documents:
 * CRUD, preview rendering, and multi-format exports.
 */
import api from './api';
import { mockService } from './mockService';

const USE_MOCK = import.meta.env.VITE_USE_MOCK_FALLBACK === 'true';

export const presentationService = {
  /**
   * Fetch list of presentations
   */
  async listPresentations() {
    try {
      return await api.get('/presentations');
    } catch (err) {
      if (USE_MOCK) {
        console.info('[presentationService] Backend unavailable; using mock service for listPresentations');
        return await mockService.listPresentations();
      }
      throw err;
    }
  },

  /**
   * Get single presentation by ID
   */
  async getPresentation(id) {
    if (!id) throw new Error('Presentation ID is required');
    try {
      return await api.get(`/presentations/${id}`);
    } catch (err) {
      if (USE_MOCK) {
        console.info(`[presentationService] Backend unavailable; using mock service for getPresentation(${id})`);
        return await mockService.getPresentation(id);
      }
      throw err;
    }
  },

  /**
   * Create a new presentation
   */
  async createPresentation(payload) {
    try {
      return await api.post('/presentations', payload);
    } catch (err) {
      if (USE_MOCK) {
        console.info('[presentationService] Backend unavailable; using mock service for createPresentation');
        return await mockService.createPresentation(payload);
      }
      throw err;
    }
  },

  /**
   * Update existing presentation
   */
  async updatePresentation(id, data) {
    if (!id) throw new Error('Presentation ID is required');
    try {
      return await api.put(`/presentations/${id}`, data);
    } catch (err) {
      if (USE_MOCK) {
        console.info(`[presentationService] Backend unavailable; using mock service for updatePresentation(${id})`);
        return await mockService.updatePresentation(id, data);
      }
      throw err;
    }
  },

  /**
   * Delete a presentation
   */
  async deletePresentation(id) {
    if (!id) throw new Error('Presentation ID is required');
    try {
      return await api.delete(`/presentations/${id}`);
    } catch (err) {
      if (USE_MOCK) {
        console.info(`[presentationService] Backend unavailable; using mock service for deletePresentation(${id})`);
        return await mockService.deletePresentation(id);
      }
      throw err;
    }
  },

  /**
   * Request backend to render MARP preview (HTML / SVG)
   */
  async renderPreview(markdown, options = {}) {
    try {
      return await api.post('/render/preview', { markdown, ...options });
    } catch (err) {
      if (USE_MOCK) {
        return await mockService.renderPreview(markdown, options);
      }
      throw err;
    }
  },

  /**
   * Export presentation to pdf, html, pptx, or png
   */
  async exportPresentation(id, format = 'html', options = {}) {
    try {
      return await api.post(`/presentations/${id}/export`, { format, ...options });
    } catch (err) {
      if (USE_MOCK) {
        return await mockService.exportPresentation(id, format);
      }
      throw err;
    }
  },
};

export default presentationService;
