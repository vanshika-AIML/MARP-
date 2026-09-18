import { THEME_REGISTRY } from './themeRegistry';
export const CUSTOM_TEMPLATES_KEY = 'marp-custom-templates-v1';
export function readCustomTemplates() {
  try {
    const data = JSON.parse(window.localStorage.getItem(CUSTOM_TEMPLATES_KEY) || '[]');
    return Array.isArray(data) ? data.filter((item) => item && typeof item.id === 'string' && typeof item.markdown === 'string' && typeof item.title === 'string') : [];
  } catch { return []; }
}
export function themeTemplate(theme) {
  return {
    id: `theme-${theme.id}`, title: theme.name, theme: theme.id, category: theme.category, description: theme.description,
    markdown: `---\nmarp: true\ntheme: ${theme.id}\npaginate: true\n---\n\n# Ideas into impact\n\nA new perspective, beautifully presented.\n\n---\n\n## The next chapter\n\n- Start with a meaningful question\n- Make room for a fresh perspective\n- Turn insight into action\n\n---\n\n## A clearer picture\n\n| Focus | Today | Tomorrow |\n| --- | --- | --- |\n| Clarity | A question | A shared vision |\n| Action | An idea | A first step |\n\n---\n\n> The best stories make the next step feel possible.`,
  };
}
export const THEME_TEMPLATES = THEME_REGISTRY.map(themeTemplate);
