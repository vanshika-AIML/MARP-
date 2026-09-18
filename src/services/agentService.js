/**
 * Agent Service
 * Handles AI generation, slide elaboration, and status polling.
 */
import api from './api';
import { mockService } from './mockService';
import { shouldUseMockFallback } from './fallback';

const USE_MOCK = import.meta.env.VITE_USE_MOCK_FALLBACK === 'true';

export const agentService = {
  /**
   * Generate an individual slide based on user prompt & optional context
   */
  async generateSlide(prompt, options = {}) {
    try {
      return await api.post('/agent/generate-slide', { prompt, ...options });
    } catch (err) {
      if (USE_MOCK && shouldUseMockFallback(err)) {
        console.info('[agentService] Backend unavailable; using mock slide generator');
        return await mockService.generateSlide(prompt, options);
      }
      throw err;
    }
  },

  /**
   * Generate a full slide deck from a topic / prompt
   */
  async generateContent(prompt, context = '') {
    try {
      return await api.post('/agent/generate-content', { prompt, context });
    } catch (err) {
      if (USE_MOCK && shouldUseMockFallback(err)) {
        console.info('[agentService] Backend unavailable; using mock content generator');
        return await mockService.generateContent(prompt, context);
      }
      throw err;
    }
  },

  /**
   * Refine or rephrase a specific slide
   */
  async refineSlide(slideIndex, instruction, presentationId) {
    try {
      return await api.post('/agent/refine-slide', {
        slide_index: slideIndex,
        instruction,
        presentation_id: presentationId,
      });
    } catch (err) {
      if (USE_MOCK && shouldUseMockFallback(err)) {
        return {
          status: 'success',
          refinedMarkdown: `\n<!-- _class: lead -->\n## Refined Slide (${instruction})\n\n- Improved clarity\n- Enhanced visual structure\n`,
        };
      }
      throw err;
    }
  },

  /**
   * Query status of an asynchronous generation task
   */
  async getGenerationStatus(taskId) {
    try {
      return await api.get(`/agent/tasks/${taskId}`);
    } catch (err) {
      if (USE_MOCK && shouldUseMockFallback(err)) {
        return {
          task_id: taskId,
          status: 'completed',
          progress: 100,
        };
      }
      throw err;
    }
  },
};

export default agentService;
