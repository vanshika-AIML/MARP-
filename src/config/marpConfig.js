import { STARTER_TEMPLATES } from '../utils/mockData';
import { THEME_REGISTRY } from '../utils/themeRegistry';

export const MARP_CONFIG_KEY = 'marp-admin-config-v1';
export const MARP_DRAFT_KEY = 'marp-admin-draft-v1';

const defaultConfig = {
  site: {
    productName: 'MARP Studio',
    supportUrl: '/dashboard',
    footer: 'Ideas, structured.',
  },
  landing: {
    visible: true,
    eyebrow: 'Presentation intelligence for clear thinking',
    title: 'MARP Studio',
    tagline: 'Turn ideas into structured presentations.',
    description: 'AI direction, precise visual systems, and the freedom of Markdown. One focused workspace from first thought to final slide.',
    ctaLabel: 'Create Presentation',
    ctaLink: '/dashboard',
    featureTourVisible: true,
    aiSectionVisible: true,
    footerVisible: true,
    steps: [
      { title: 'Idea', description: 'Start with a topic, a point of view, or a set of rough notes.' },
      { title: 'Structure', description: 'Shape the narrative into a clear sequence your audience can follow.' },
      { title: 'Design', description: 'Apply a considered visual system, then refine every detail in Markdown.' },
      { title: 'Present', description: 'Preview the finished deck, enter presentation mode, and share it with confidence.' },
    ],
  },
  dashboard: {
    defaultSection: 'home',
    sectionOrder: ['home', 'templates', 'ai', 'upload'],
    labels: { home: 'Home', templates: 'Explore Templates', ai: 'Create with AI', upload: 'Upload Custom Template' },
    descriptions: { home: 'Your next great story starts here.', templates: 'A different personality for every presentation.', ai: 'Start with an idea. Leave with a first draft.', upload: 'Your own Markdown. Your own point of view.' },
    visibleSections: { home: true, templates: true, ai: true, upload: true },
  },
  featureFlags: {
    createWithAI: true, uploadTemplate: true, exploreTemplates: true, learnWithVideo: true,
    aiAgent: true, customThemes: true, exports: true, animations: true,
  },
  animation: { preset: 'Balanced', enabled: true, reducedMotionDefault: false, ambientIntensity: 'balanced' },
  ai: { defaultTheme: 'default', defaultInstructions: 'Create a clear, audience-aware MARP presentation with strong hierarchy.', modes: ['Single Slide', 'Full Slide Deck'], tones: ['Clear', 'Executive', 'Technical'] },
  templates: STARTER_TEMPLATES.map((template, index) => ({
    id: template.id, name: template.title, description: template.description, category: 'Starter', theme: template.theme,
    markdown: template.markdown, active: true, featured: index === 0, order: index,
  })),
  themes: THEME_REGISTRY.map((theme, index) => ({ ...theme, active: true, isDefault: index === 0, order: index })),
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function getDefaultMarpConfig() {
  return clone(defaultConfig);
}

export function readMarpConfig() {
  try {
    const stored = JSON.parse(window.localStorage.getItem(MARP_CONFIG_KEY) || 'null');
    return stored ? mergeConfig(defaultConfig, stored) : getDefaultMarpConfig();
  } catch {
    return getDefaultMarpConfig();
  }
}

export function readMarpDraft() {
  try {
    const stored = JSON.parse(window.localStorage.getItem(MARP_DRAFT_KEY) || 'null');
    return stored ? mergeConfig(readMarpConfig(), stored) : readMarpConfig();
  } catch {
    return readMarpConfig();
  }
}

export function saveMarpDraft(config) {
  window.localStorage.setItem(MARP_DRAFT_KEY, JSON.stringify(config));
}

export function publishMarpConfig(config, changedBy = 'Portal Admin') {
  const published = { ...config, meta: { publishedAt: new Date().toISOString(), changedBy } };
  window.localStorage.setItem(MARP_CONFIG_KEY, JSON.stringify(published));
  window.localStorage.removeItem(MARP_DRAFT_KEY);
  window.dispatchEvent(new CustomEvent('marp-config-published', { detail: published }));
  return published;
}

function mergeConfig(base, incoming) {
  return {
    ...clone(base), ...incoming,
    site: { ...base.site, ...incoming.site },
    landing: { ...base.landing, ...incoming.landing },
    dashboard: { ...base.dashboard, ...incoming.dashboard, labels: { ...base.dashboard.labels, ...incoming.dashboard?.labels }, descriptions: { ...base.dashboard.descriptions, ...incoming.dashboard?.descriptions }, visibleSections: { ...base.dashboard.visibleSections, ...incoming.dashboard?.visibleSections } },
    featureFlags: { ...base.featureFlags, ...incoming.featureFlags },
    animation: { ...base.animation, ...incoming.animation },
    ai: { ...base.ai, ...incoming.ai },
  };
}
