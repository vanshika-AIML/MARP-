/**
 * Presentation Centralized State Provider
 * Maintains presentation document model, active slide, generation status, and preview status.
 */
import React, { createContext, useContext, useReducer, useEffect, useCallback, useRef } from 'react';
import { parseMarpPresentation } from '../utils/marpParser';
import { STARTER_TEMPLATES, BLANK_DECK_MARKDOWN } from '../utils/mockData';
import { presentationService } from '../services/presentationService';
import {
  PRESENTATION_ACTIONS,
  INITIAL_GENERATION_STATUS,
  INITIAL_PREVIEW_STATUS,
} from './types';

const PresentationContext = createContext(null);

const initialPresentation = STARTER_TEMPLATES[0];
const parsedInitial = parseMarpPresentation(initialPresentation.markdown);

const initialState = {
  id: initialPresentation.id,
  title: initialPresentation.title,
  theme: parsedInitial.globalDirectives.theme || initialPresentation.theme || 'default',
  markdown: initialPresentation.markdown,
  slides: parsedInitial.slides,
  activeSlide: 0,
  generationStatus: { ...INITIAL_GENERATION_STATUS },
  previewStatus: { ...INITIAL_PREVIEW_STATUS },
  isLoading: false,
  isSaving: false,
  error: null,
  lastSavedAt: new Date().toISOString(),
};

function presentationReducer(state, action) {
  switch (action.type) {
    case PRESENTATION_ACTIONS.SET_PRESENTATION: {
      const { presentation } = action.payload;
      const parsed = parseMarpPresentation(presentation.markdown);
      return {
        ...state,
        id: presentation.id,
        title: presentation.title || 'Untitled Presentation',
        theme: parsed.globalDirectives.theme || presentation.theme || 'default',
        markdown: presentation.markdown,
        slides: parsed.slides,
        activeSlide: 0,
        isLoading: false,
        error: null,
        lastSavedAt: presentation.updatedAt || new Date().toISOString(),
      };
    }

    case PRESENTATION_ACTIONS.UPDATE_MARKDOWN: {
      const { markdown } = action.payload;
      const parsed = parseMarpPresentation(markdown);
      const activeSlide = Math.min(state.activeSlide, Math.max(0, parsed.slides.length - 1));
      return {
        ...state,
        markdown,
        slides: parsed.slides,
        theme: parsed.globalDirectives.theme || state.theme,
        activeSlide,
      };
    }

    case PRESENTATION_ACTIONS.SET_ACTIVE_SLIDE: {
      const { index } = action.payload;
      const safeIndex = Math.max(0, Math.min(index, state.slides.length - 1));
      return {
        ...state,
        activeSlide: safeIndex,
      };
    }

    case PRESENTATION_ACTIONS.SET_TITLE: {
      return {
        ...state,
        title: action.payload.title,
      };
    }

    case PRESENTATION_ACTIONS.SET_THEME: {
      const { theme } = action.payload;
      // Update theme inside markdown frontmatter if exists, or prepend
      let updatedMarkdown = state.markdown;
      if (updatedMarkdown.includes('theme:')) {
        updatedMarkdown = updatedMarkdown.replace(/theme:\s*[a-zA-Z0-9_-]+/g, `theme: ${theme}`);
      } else {
        updatedMarkdown = `---\nmarp: true\ntheme: ${theme}\npaginate: true\n---\n\n${updatedMarkdown}`;
      }
      const parsed = parseMarpPresentation(updatedMarkdown);
      return {
        ...state,
        theme,
        markdown: updatedMarkdown,
        slides: parsed.slides,
      };
    }

    case PRESENTATION_ACTIONS.SET_GENERATION_STATUS: {
      return {
        ...state,
        generationStatus: {
          ...state.generationStatus,
          ...action.payload,
        },
      };
    }

    case PRESENTATION_ACTIONS.SET_PREVIEW_STATUS: {
      return {
        ...state,
        previewStatus: {
          ...state.previewStatus,
          ...action.payload,
        },
      };
    }

    case PRESENTATION_ACTIONS.SET_LOADING: {
      return { ...state, isLoading: action.payload };
    }

    case PRESENTATION_ACTIONS.SET_SAVING: {
      return {
        ...state,
        isSaving: action.payload.isSaving,
        lastSavedAt: action.payload.lastSavedAt || state.lastSavedAt,
      };
    }

    case PRESENTATION_ACTIONS.SET_ERROR: {
      return { ...state, error: action.payload, isLoading: false };
    }

    default:
      return state;
  }
}

export function PresentationProvider({ children, initialData = null }) {
  const [state, dispatch] = useReducer(presentationReducer, initialData ? {
    ...initialState,
    ...initialData,
    slides: parseMarpPresentation(initialData.markdown || '').slides,
  } : initialState);

  const saveTimeoutRef = useRef(null);

  // Auto-save debounce effect (saves locally / through service after 1.2s of inactivity)
  useEffect(() => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

    saveTimeoutRef.current = setTimeout(async () => {
      if (state.id) {
        dispatch({ type: PRESENTATION_ACTIONS.SET_SAVING, payload: { isSaving: true } });
        try {
          await presentationService.updatePresentation(state.id, {
            title: state.title,
            theme: state.theme,
            markdown: state.markdown,
          });
          dispatch({
            type: PRESENTATION_ACTIONS.SET_SAVING,
            payload: { isSaving: false, lastSavedAt: new Date().toISOString() },
          });
        } catch (err) {
          console.warn('Auto-save warning:', err);
          dispatch({ type: PRESENTATION_ACTIONS.SET_SAVING, payload: { isSaving: false } });
        }
      }
    }, 1200);

    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [state.markdown, state.title, state.theme, state.id]);

  const updateMarkdown = useCallback((markdown) => {
    dispatch({ type: PRESENTATION_ACTIONS.UPDATE_MARKDOWN, payload: { markdown } });
  }, []);

  const setActiveSlide = useCallback((index) => {
    dispatch({ type: PRESENTATION_ACTIONS.SET_ACTIVE_SLIDE, payload: { index } });
  }, []);

  const setTitle = useCallback((title) => {
    dispatch({ type: PRESENTATION_ACTIONS.SET_TITLE, payload: { title } });
  }, []);

  const setTheme = useCallback((theme) => {
    dispatch({ type: PRESENTATION_ACTIONS.SET_THEME, payload: { theme } });
  }, []);

  const setGenerationStatus = useCallback((status) => {
    dispatch({ type: PRESENTATION_ACTIONS.SET_GENERATION_STATUS, payload: status });
  }, []);

  const setPreviewStatus = useCallback((preview) => {
    dispatch({ type: PRESENTATION_ACTIONS.SET_PREVIEW_STATUS, payload: preview });
  }, []);

  const loadPresentation = useCallback(async (id) => {
    dispatch({ type: PRESENTATION_ACTIONS.SET_LOADING, payload: true });
    try {
      const presentation = await presentationService.getPresentation(id);
      dispatch({ type: PRESENTATION_ACTIONS.SET_PRESENTATION, payload: { presentation } });
    } catch (err) {
      dispatch({ type: PRESENTATION_ACTIONS.SET_ERROR, payload: err.message });
    }
  }, []);

  const createNewPresentation = useCallback(async (template = null) => {
    dispatch({ type: PRESENTATION_ACTIONS.SET_LOADING, payload: true });
    try {
      const payload = template || {
        title: 'New Presentation',
        theme: 'default',
        markdown: BLANK_DECK_MARKDOWN,
      };
      const created = await presentationService.createPresentation(payload);
      dispatch({ type: PRESENTATION_ACTIONS.SET_PRESENTATION, payload: { presentation: created } });
      return created;
    } catch (err) {
      dispatch({ type: PRESENTATION_ACTIONS.SET_ERROR, payload: err.message });
      return null;
    }
  }, []);

  const addSlide = useCallback((customContent = '') => {
    const defaultNewSlide = `\n\n---\n\n## Slide Title\n\n- Bullet point 1\n- Bullet point 2\n`;
    const newMarkdown = `${state.markdown.trimEnd()}${customContent || defaultNewSlide}`;
    updateMarkdown(newMarkdown);
    const parsed = parseMarpPresentation(newMarkdown);
    setActiveSlide(parsed.slides.length - 1);
  }, [state.markdown, updateMarkdown, setActiveSlide]);

  const deleteSlide = useCallback((slideIndex) => {
    if (state.slides.length <= 1) return;
    const remainingSlides = state.slides.filter((_, idx) => idx !== slideIndex);
    // Reconstruct markdown
    const fmHeader = state.markdown.startsWith('---')
      ? state.markdown.slice(0, state.markdown.indexOf('---', 3) + 3)
      : '';
    const slidesBody = remainingSlides.map((s) => s.raw.trim()).join('\n\n---\n\n');
    const reconstructed = fmHeader ? `${fmHeader}\n\n${slidesBody}` : slidesBody;
    updateMarkdown(reconstructed);
    setActiveSlide(Math.max(0, slideIndex - 1));
  }, [state.slides, state.markdown, updateMarkdown, setActiveSlide]);

  const duplicateSlide = useCallback((slideIndex) => {
    const slideToDup = state.slides[slideIndex];
    if (!slideToDup) return;
    const duplicatedRaw = `\n\n---\n\n${slideToDup.raw.trim()}`;
    const newMarkdown = `${state.markdown.trimEnd()}${duplicatedRaw}`;
    updateMarkdown(newMarkdown);
    setActiveSlide(slideIndex + 1);
  }, [state.slides, state.markdown, updateMarkdown, setActiveSlide]);

  const value = {
    ...state,
    updateMarkdown,
    setActiveSlide,
    setTitle,
    setTheme,
    setGenerationStatus,
    setPreviewStatus,
    loadPresentation,
    createNewPresentation,
    addSlide,
    deleteSlide,
    duplicateSlide,
  };

  return (
    <PresentationContext.Provider value={value}>
      {children}
    </PresentationContext.Provider>
  );
}

export function usePresentationContext() {
  const context = useContext(PresentationContext);
  if (!context) {
    throw new Error('usePresentationContext must be used within a PresentationProvider');
  }
  return context;
}

export default PresentationContext;
