export const MARP_CONFIG_KEY = 'marp-admin-config-v1';
export const MARP_DRAFT_KEY = 'marp-admin-draft-v1';

const defaultConfig = {
  site: { productName: 'MARP Studio', supportUrl: '/dashboard', footer: 'Ideas, structured.' },
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
  featureFlags: { createWithAI: true, uploadTemplate: true, exploreTemplates: true, learnWithVideo: true, aiAgent: true, customThemes: true, exports: true, animations: true },
  animation: { preset: 'Balanced', enabled: true, reducedMotionDefault: false, ambientIntensity: 'balanced' },
  ai: { defaultTheme: 'default', defaultInstructions: 'Create a clear, audience-aware MARP presentation with strong hierarchy.', modes: ['Single Slide', 'Full Slide Deck'], tones: ['Clear', 'Executive', 'Technical'] },
  visuals: { search_enabled: false, generation_enabled: false, preferred_strategy: 'auto', max_visuals_per_deck: 6, default_image_style: 'editorial', search_provider: 'none', generation_provider: 'none' },
  templates: [],
  themes: [],
};

const clone = (value) => JSON.parse(JSON.stringify(value));
let runtimeConfig = clone(defaultConfig);

export function getDefaultMarpConfig() { return clone(defaultConfig); }
export function readMarpConfig() { return clone(runtimeConfig); }
export function readMarpDraft() { return readMarpConfig(); }
export function setRuntimeMarpConfig(config) { runtimeConfig = mergeConfig(defaultConfig, config); }
export function saveMarpDraft(config) { return config; }
export function publishMarpConfig(config) { setRuntimeMarpConfig(config); return readMarpConfig(); }

export function mergeConfig(base, incoming = {}) {
  return {
    ...clone(base), ...incoming,
    site: { ...base.site, ...incoming.site },
    landing: { ...base.landing, ...incoming.landing },
    dashboard: { ...base.dashboard, ...incoming.dashboard, labels: { ...base.dashboard.labels, ...incoming.dashboard?.labels }, descriptions: { ...base.dashboard.descriptions, ...incoming.dashboard?.descriptions }, visibleSections: { ...base.dashboard.visibleSections, ...incoming.dashboard?.visibleSections } },
    featureFlags: { ...base.featureFlags, ...incoming.featureFlags },
    animation: { ...base.animation, ...incoming.animation },
    ai: { ...base.ai, ...incoming.ai },
    visuals: { ...base.visuals, ...incoming.visuals },
    templates: incoming.templates || base.templates,
    themes: incoming.themes || base.themes,
  };
}
