/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { getDefaultMarpConfig, mergeConfig, setRuntimeMarpConfig } from '../config/marpConfig';
import { configService } from '../services/configService';

const MarpConfigContext = createContext(null);
const clone = (value) => JSON.parse(JSON.stringify(value));

export function MarpConfigProvider({ children }) {
  const defaults = getDefaultMarpConfig();
  const [config, setConfig] = useState(defaults);
  const [draft, setDraftState] = useState(defaults);
  const [isDirty, setDirty] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const reload = useCallback(async ({ throwOnError = false } = {}) => {
    setLoading(true); setError('');
    try {
      const remote = await configService.load();
      const base = mergeConfig(getDefaultMarpConfig(), remote.published);
      const published = { ...base, templates: remote.templates, themes: remote.themes, featureFlags: { ...base.featureFlags, ...remote.featureFlags }, visuals: remote.visuals };
      const nextDraft = remote.draft ? mergeConfig(published, remote.draft) : published;
      setRuntimeMarpConfig(published);
      setConfig(published); setDraftState(nextDraft);
      setDirty(JSON.stringify(published) !== JSON.stringify(nextDraft));
    } catch (reason) { setError(reason.message || 'Could not load application configuration.'); if (throwOnError) throw reason; }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { reload(); }, [reload]);
  useEffect(() => {
    const reduced = !config.featureFlags.animations || !config.animation.enabled || config.animation.reducedMotionDefault || config.animation.preset === 'Minimal';
    document.documentElement.dataset.reducedMotion = String(reduced);
    document.documentElement.dataset.ambientIntensity = config.animation.ambientIntensity;
    return () => { delete document.documentElement.dataset.reducedMotion; delete document.documentElement.dataset.ambientIntensity; };
  }, [config.animation, config.featureFlags.animations]);
  const updateDraft = (updater) => { setDraftState((current) => typeof updater === 'function' ? updater(current) : updater); setDirty(true); };
  const resetDraft = () => { setDraftState(clone(config)); setDirty(false); };
  const saveDraft = async () => { await configService.saveDraft(draft); };
  const publish = async () => { await configService.publish(draft, config); await reload({ throwOnError: true }); return draft; };
  const resetAll = () => { setDraftState(getDefaultMarpConfig()); setDirty(true); };

  return <MarpConfigContext.Provider value={{ config, draft, isDirty, loading, error, reload, updateDraft, resetDraft, saveDraft, publish, resetAll }}>{children}</MarpConfigContext.Provider>;
}

export function useMarpConfig() {
  const context = useContext(MarpConfigContext);
  if (!context) {
    const fallback = getDefaultMarpConfig();
    return { config: fallback, draft: fallback, isDirty: false, loading: false, error: '', updateDraft: () => {}, resetDraft: () => {}, saveDraft: async () => {}, publish: async () => fallback, resetAll: () => {} };
  }
  return context;
}
export default MarpConfigContext;
