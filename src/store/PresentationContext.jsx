/**
 * Presentation Centralized State Provider
 * Maintains presentation document model, active slide, generation status, and preview status.
 */
/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useReducer, useEffect, useCallback, useRef } from 'react';
import { parseMarpPresentation, rebuildPresentationMarkdown, splitFrontmatter } from '../utils/marpParser';
import { BLANK_DECK_MARKDOWN } from '../utils/mockData';
import { presentationService } from '../services/presentationService';
import { readMarpConfig } from '../config/marpConfig';
import {
  PRESENTATION_ACTIONS,
  INITIAL_GENERATION_STATUS,
  INITIAL_PREVIEW_STATUS,
} from './types';

const PresentationContext = createContext(null);

const initialState = {
  id: null,
  title: 'Untitled Presentation',
  theme: 'default',
  markdown: BLANK_DECK_MARKDOWN,
  slides: parseMarpPresentation(BLANK_DECK_MARKDOWN).slides,
  activeSlide: 0,
  generationStatus: { ...INITIAL_GENERATION_STATUS },
  previewStatus: { ...INITIAL_PREVIEW_STATUS },
  isLoading: false,
  isSaving: false,
  saveError: null,
  error: null,
  lastSavedAt: new Date().toISOString(),
  editRevision: 0,
  savedRevision: 0,
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
        isSaving: false,
        saveError: null,
        error: null,
        lastSavedAt: presentation.updatedAt || presentation.updated_at || new Date().toISOString(),
        editRevision: 0,
        savedRevision: 0,
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
        editRevision: state.editRevision + 1,
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
        editRevision: state.editRevision + 1,
      };
    }

    case PRESENTATION_ACTIONS.SET_THEME: {
      const { theme } = action.payload;
      // Update theme inside markdown frontmatter if exists, or prepend
      const { frontmatter, body } = splitFrontmatter(state.markdown);
      const updatedFrontmatter = frontmatter
        ? (/^theme\s*:/m.test(frontmatter)
          ? frontmatter.replace(/^theme\s*:.*$/m, `theme: ${theme}`)
          : frontmatter.replace(/\r?\n---\s*$/, `\ntheme: ${theme}\n---`))
        : `---\nmarp: true\ntheme: ${theme}\npaginate: true\n---`;
      const updatedMarkdown = `${updatedFrontmatter}\n${body}`;
      const parsed = parseMarpPresentation(updatedMarkdown);
      return {
        ...state,
        theme,
        markdown: updatedMarkdown,
        slides: parsed.slides,
        editRevision: state.editRevision + 1,
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
      if (
        action.payload.id
        && (action.payload.id !== state.id || action.payload.revision !== state.editRevision)
      ) return state;
      return {
        ...state,
        isSaving: action.payload.isSaving,
        saveError: action.payload.error || null,
        lastSavedAt: action.payload.lastSavedAt || state.lastSavedAt,
      };
    }

    case PRESENTATION_ACTIONS.MARK_SAVED: {
      if (action.payload.id !== state.id || action.payload.revision !== state.editRevision) {
        return state;
      }
      return {
        ...state,
        isSaving: false,
        saveError: null,
        savedRevision: action.payload.revision,
        lastSavedAt: action.payload.lastSavedAt,
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
  const saveQueueRef = useRef(Promise.resolve());
  const stateRef = useRef(state);
  stateRef.current = state;
  const loadRequestRef = useRef(0);

  const persist = useCallback((snapshot) => {
    const { id, editRevision: revision, title, markdown } = snapshot;
    dispatch({ type: PRESENTATION_ACTIONS.SET_SAVING, payload: { isSaving: true, id, revision } });
    const task = saveQueueRef.current.catch(() => undefined).then(async () => {
      try {
        await presentationService.updatePresentation(id, { title, markdown });
        dispatch({ type: PRESENTATION_ACTIONS.MARK_SAVED, payload: { id, revision, lastSavedAt: new Date().toISOString() } });
      } catch (err) {
        dispatch({ type: PRESENTATION_ACTIONS.SET_SAVING, payload: { isSaving: false, id, revision, error: err.message } });
        throw err;
      }
    });
    saveQueueRef.current = task;
    return task;
  }, []);

  const savePresentation = useCallback(async () => {
    clearTimeout(saveTimeoutRef.current);
    const snapshot = stateRef.current;
    if (!snapshot.id) return;
    if (snapshot.editRevision !== snapshot.savedRevision) await persist(snapshot);
    else await saveQueueRef.current;
  }, [persist]);

  // Auto-save only revisions caused by user edits.
  useEffect(() => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    if (!state.id || state.editRevision === state.savedRevision) return undefined;

    saveTimeoutRef.current = setTimeout(() => { persist(stateRef.current).catch(() => {}); }, 1200);

    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [state.markdown, state.title, state.theme, state.id, state.editRevision, state.savedRevision, persist]);

  useEffect(() => {
    const warnIfUnsaved = (event) => {
      if (stateRef.current.editRevision === stateRef.current.savedRevision) return;
      event.preventDefault(); event.returnValue = '';
    };
    window.addEventListener('beforeunload', warnIfUnsaved);
    return () => window.removeEventListener('beforeunload', warnIfUnsaved);
  }, []);

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
    const request = ++loadRequestRef.current;
    dispatch({ type: PRESENTATION_ACTIONS.SET_LOADING, payload: true });
    try {
      const presentation = await presentationService.getPresentation(id);
      if (request !== loadRequestRef.current) return;
      dispatch({ type: PRESENTATION_ACTIONS.SET_PRESENTATION, payload: { presentation } });
    } catch (err) {
      if (request !== loadRequestRef.current) return;
      dispatch({ type: PRESENTATION_ACTIONS.SET_ERROR, payload: err.message });
    }
  }, []);

  const createNewPresentation = useCallback(async (template = null) => {
    dispatch({ type: PRESENTATION_ACTIONS.SET_LOADING, payload: true });
    try {
      const defaultTheme = readMarpConfig().ai.defaultTheme || 'default';
      if (template?.backendId) {
        const created = await presentationService.createFromTemplate(template.backendId);
        dispatch({ type: PRESENTATION_ACTIONS.SET_PRESENTATION, payload: { presentation: created } });
        return created;
      }
      const payload = template ? {
        title: template.title || template.name,
        markdown: template.markdown || template.starter_markdown,
      } : {
        title: 'New Presentation',
        markdown: BLANK_DECK_MARKDOWN.replace(/theme: default/, `theme: ${defaultTheme}`),
      };
      const created = await presentationService.createPresentation(payload);
      dispatch({ type: PRESENTATION_ACTIONS.SET_PRESENTATION, payload: { presentation: created } });
      return created;
    } catch (err) {
      dispatch({ type: PRESENTATION_ACTIONS.SET_LOADING, payload: false });
      throw err;
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
    const { frontmatter } = splitFrontmatter(state.markdown);
    const reconstructed = rebuildPresentationMarkdown(frontmatter, remainingSlides);
    updateMarkdown(reconstructed);
    setActiveSlide(Math.max(0, slideIndex - 1));
  }, [state.slides, state.markdown, updateMarkdown, setActiveSlide]);

  const duplicateSlide = useCallback((slideIndex) => {
    const slideToDup = state.slides[slideIndex];
    if (!slideToDup) return;
    const { frontmatter } = splitFrontmatter(state.markdown);
    const nextSlides = [...state.slides];
    nextSlides.splice(slideIndex + 1, 0, { ...slideToDup, raw: slideToDup.raw });
    const newMarkdown = rebuildPresentationMarkdown(frontmatter, nextSlides);
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
    savePresentation,
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
