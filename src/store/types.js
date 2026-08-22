/**
 * Presentation State & Action Types
 */

export const INITIAL_GENERATION_STATUS = {
  status: 'idle', // 'idle' | 'connecting' | 'generating' | 'generating_slide' | 'rendering' | 'completed' | 'error'
  progress: 0, // 0 to 100
  message: '',
  currentSlide: 0,
  taskId: null,
};

export const INITIAL_PREVIEW_STATUS = {
  isLive: true,
  viewMode: 'split', // 'split' | 'editor' | 'preview' | 'present'
  isServerRendered: false,
  zoom: 1.0,
  syncScroll: true,
};

export const PRESENTATION_ACTIONS = {
  SET_PRESENTATION: 'SET_PRESENTATION',
  UPDATE_MARKDOWN: 'UPDATE_MARKDOWN',
  SET_ACTIVE_SLIDE: 'SET_ACTIVE_SLIDE',
  SET_TITLE: 'SET_TITLE',
  SET_THEME: 'SET_THEME',
  SET_GENERATION_STATUS: 'SET_GENERATION_STATUS',
  SET_PREVIEW_STATUS: 'SET_PREVIEW_STATUS',
  SET_LOADING: 'SET_LOADING',
  SET_SAVING: 'SET_SAVING',
  SET_ERROR: 'SET_ERROR',
  ADD_SLIDE: 'ADD_SLIDE',
  DELETE_SLIDE: 'DELETE_SLIDE',
  DUPLICATE_SLIDE: 'DUPLICATE_SLIDE',
};
