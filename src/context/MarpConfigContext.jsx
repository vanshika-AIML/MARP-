import React, { createContext, useContext, useEffect, useState } from 'react';
import { getDefaultMarpConfig, publishMarpConfig, readMarpConfig, readMarpDraft, saveMarpDraft } from '../config/marpConfig';

const MarpConfigContext = createContext(null);

export function MarpConfigProvider({ children }) {
  const [config, setConfig] = useState(readMarpConfig);
  const [draft, setDraftState] = useState(readMarpDraft);
  const [isDirty, setDirty] = useState(() => JSON.stringify(readMarpDraft()) !== JSON.stringify(readMarpConfig()));

  useEffect(() => {
    const sync = (event) => {
      const next = event.detail || readMarpConfig();
      setConfig(next);
      setDraftState(next);
      setDirty(false);
    };
    window.addEventListener('marp-config-published', sync);
    return () => window.removeEventListener('marp-config-published', sync);
  }, []);

  const updateDraft = (updater) => {
    setDraftState((current) => {
      const next = typeof updater === 'function' ? updater(current) : updater;
      saveMarpDraft(next);
      setDirty(true);
      return next;
    });
  };
  const resetDraft = () => { const next = clone(config); setDraftState(next); saveMarpDraft(next); setDirty(false); };
  const publish = (changedBy) => { const next = publishMarpConfig(draft, changedBy); setConfig(next); setDraftState(next); setDirty(false); return next; };
  const resetAll = () => { const next = getDefaultMarpConfig(); publishMarpConfig(next, 'System'); setConfig(next); setDraftState(next); setDirty(false); };

  return <MarpConfigContext.Provider value={{ config, draft, isDirty, updateDraft, resetDraft, publish, resetAll }}>{children}</MarpConfigContext.Provider>;
}

function clone(value) { return JSON.parse(JSON.stringify(value)); }

export function useMarpConfig() {
  const context = useContext(MarpConfigContext);
  if (!context) {
    const fallback = getDefaultMarpConfig();
    return { config: fallback, draft: fallback, isDirty: false, updateDraft: () => {}, resetDraft: () => {}, publish: () => fallback, resetAll: () => {} };
  }
  return context;
}

export default MarpConfigContext;
