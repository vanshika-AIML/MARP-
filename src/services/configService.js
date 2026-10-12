import api from './api';
import { THEME_REGISTRY } from '../utils/themeRegistry';

const camelToSnake = (value) => value.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
const snakeToCamel = (value) => value.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
const baseTheme = (slug) => THEME_REGISTRY.find((theme) => theme.id === slug) || THEME_REGISTRY[0];

function mapTheme(theme) {
  const base = baseTheme(theme.slug);
  const configured = theme.config || {};
  return {
    ...base, backendId: theme.id, id: theme.slug, name: theme.name,
    description: theme.description || base.description,
    colors: { ...base.colors, background: configured.background || base.colors.background, text: configured.foreground || base.colors.text, primary: configured.accent || base.colors.primary, accent: configured.accent || base.colors.accent, ...configured.colors },
    config: configured, css: theme.css, active: theme.is_active, isDefault: theme.is_default, order: theme.sort_order,
  };
}

function mapTemplate(template, themes) {
  const theme = themes.find((item) => item.backendId === template.theme_id);
  return { backendId: template.id, id: template.id, name: template.name, title: template.name, description: template.description, category: template.category, theme: theme?.id || 'default', theme_id: template.theme_id, markdown: template.starter_markdown, tags: template.tags, active: template.is_active, featured: template.is_featured, order: template.sort_order };
}

export const configService = {
  async load() {
    const [rawThemes, rawTemplates, records, flags, visuals] = await Promise.all([api.list('/themes?all=true'), api.list('/templates?all=true'), api.list('/admin/config'), api.list('/feature-flags'), api.get('/admin/visuals')]);
    const themes = rawThemes.map(mapTheme);
    const templates = rawTemplates.map((item) => mapTemplate(item, themes));
    return {
      published: records.find((item) => item.namespace === 'ui' && item.key === 'published')?.value || {},
      draft: records.find((item) => item.namespace === 'ui' && item.key === 'draft')?.value || null,
      themes, templates,
      featureFlags: Object.fromEntries(flags.map((flag) => [snakeToCamel(flag.key), flag.enabled])),
      visuals,
    };
  },
  saveDraft(config) { return api.put('/admin/config/ui/draft', { value: config, description: 'Unpublished admin draft' }); },
  async publish(config, previous) {
    const publicConfig = { site: config.site, landing: config.landing, dashboard: config.dashboard, animation: config.animation, ai: config.ai };
    // Create themes first so new templates can reference their persisted IDs.
    const themeIds = new Map();
    const oldThemes = new Map(previous.themes.filter((item) => item.backendId).map((item) => [item.backendId, item]));
    for (const theme of config.themes.filter((item) => item.active !== false)) {
      const data = { name: theme.name, slug: theme.id, description: theme.description || null, config: { ...(theme.config || {}), colors: theme.colors, background: theme.colors.background, foreground: theme.colors.text, accent: theme.colors.accent }, css: theme.css || null, is_active: true, sort_order: theme.order || 0 };
      const saved = theme.backendId ? await api.patch(`/themes/${theme.backendId}`, data) : await api.post('/themes', data);
      themeIds.set(theme.id, saved.id);
      oldThemes.delete(saved.id);
    }
    const defaultTheme = config.themes.find((theme) => theme.isDefault && theme.active !== false);
    if (defaultTheme) await api.post(`/themes/${themeIds.get(defaultTheme.id)}/set-default`, {});
    // Deactivate the old default only after its replacement is selected.
    for (const id of oldThemes.keys()) await api.patch(`/themes/${id}`, { is_active: false });
    const oldTemplates = new Map(previous.templates.filter((item) => item.backendId).map((item) => [item.backendId, item]));
    for (const template of config.templates) {
      const data = { name: template.name, description: template.description || '', category: String(template.category || 'general').toLowerCase().replace(/\s+/g, '-'), theme_id: themeIds.get(template.theme) || template.theme_id || null, starter_markdown: template.markdown || '', tags: template.tags || [], is_active: template.active !== false, is_featured: Boolean(template.featured), sort_order: template.order || 0 };
      if (template.backendId) { await api.patch(`/templates/${template.backendId}`, data); oldTemplates.delete(template.backendId); } else await api.post('/templates', data);
    }
    await Promise.all([...oldTemplates.keys()].map((id) => api.patch(`/templates/${id}`, { is_active: false })));
    await Promise.all(Object.entries(config.featureFlags).map(([key, enabled]) => api.put(`/admin/feature-flags/${camelToSnake(key)}`, { enabled })));
    await api.put('/admin/visuals', config.visuals);
    await api.put('/admin/config/ai/prompt_suffix', { value: config.ai.defaultInstructions || '', description: 'Default generation instructions' });
    await api.put('/admin/config/ui/published', { value: publicConfig, description: 'Published frontend configuration' });
    await api.put('/admin/config/ui/draft', { value: null, description: 'No unpublished changes' });
  },
  createTemplate(data) { return api.post('/templates', data); },
};
