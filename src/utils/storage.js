/**
 * Local Storage Persistence Layer for Presentations
 */
import { STARTER_TEMPLATES } from './mockData';

const STORAGE_KEY = 'marp_presentations_store_v1';

export function getStoredPresentations() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      // Seed with starter templates
      localStorage.setItem(STORAGE_KEY, JSON.stringify(STARTER_TEMPLATES));
      return STARTER_TEMPLATES;
    }
    return JSON.parse(raw);
  } catch (err) {
    console.warn('Failed to parse stored presentations from localStorage:', err);
    return STARTER_TEMPLATES;
  }
}

export function saveStoredPresentation(presentation) {
  try {
    const current = getStoredPresentations();
    const index = current.findIndex((p) => p.id === presentation.id);
    let updated;
    const now = new Date().toISOString();

    if (index >= 0) {
      updated = [...current];
      updated[index] = { ...updated[index], ...presentation, updatedAt: now };
    } else {
      updated = [{ ...presentation, createdAt: now, updatedAt: now }, ...current];
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    return updated;
  } catch (err) {
    console.error('Failed to save presentation to localStorage:', err);
    return null;
  }
}

export function deleteStoredPresentation(id) {
  try {
    const current = getStoredPresentations();
    const updated = current.filter((p) => p.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    return updated;
  } catch (err) {
    console.error('Failed to delete presentation from localStorage:', err);
    return null;
  }
}
