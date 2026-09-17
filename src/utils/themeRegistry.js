export const THEME_CATEGORIES = ['Professional', 'Technical', 'Academic', 'Minimal', 'Creative', 'Dark', 'Business', 'AI/Tech'];

const makeTheme = (id, name, category, colors, fonts = {}) => ({
  id,
  name,
  category,
  description: `${name} presentation system for ${category.toLowerCase()} storytelling.`,
  colors,
  fonts: { heading: fonts.heading || 'Inter', body: fonts.body || 'Inter', ...fonts },
  typography: { scale: 'clamp', headingWeight: 750, bodySize: '1em' },
  spacing: 'comfortable',
  radius: colors.radius || '14px',
  shadows: colors.shadow || '0 18px 45px rgba(15, 23, 42, .12)',
  cardStyle: 'soft-border',
  codeStyle: 'dark-panel',
  tableStyle: 'lined',
  layout: 'editorial',
});

export const THEME_REGISTRY = [
  makeTheme('default', 'Default', 'Professional', { background: '#ffffff', surface: '#f8fafc', primary: '#0369a1', secondary: '#475569', accent: '#0284c7', text: '#0f172a', muted: '#64748b' }),
  makeTheme('gaia', 'Gaia', 'Creative', { background: '#fffaf4', surface: '#ffffff', primary: '#9a3412', secondary: '#57534e', accent: '#ea580c', text: '#292524', muted: '#78716c' }),
  makeTheme('uncover', 'Uncover', 'Minimal', { background: '#ffffff', surface: '#ffffff', primary: '#111827', secondary: '#4b5563', accent: '#2563eb', text: '#111827', muted: '#6b7280' }),
  makeTheme('executive', 'Executive', 'Professional', { background: '#f7f8fa', surface: '#ffffff', primary: '#183b56', secondary: '#456b82', accent: '#d49a3a', text: '#102a43', muted: '#627d98' }),
  makeTheme('corporate', 'Corporate', 'Business', { background: '#f5f7fb', surface: '#ffffff', primary: '#1d4ed8', secondary: '#334155', accent: '#0ea5e9', text: '#172554', muted: '#64748b' }),
  makeTheme('consulting', 'Consulting', 'Professional', { background: '#fbfaf7', surface: '#ffffff', primary: '#16324f', secondary: '#64748b', accent: '#d97706', text: '#1e293b', muted: '#78716c' }),
  makeTheme('minimal', 'Minimal', 'Minimal', { background: '#ffffff', surface: '#fafafa', primary: '#111827', secondary: '#374151', accent: '#ef4444', text: '#111827', muted: '#6b7280' }),
  makeTheme('swiss', 'Swiss', 'Minimal', { background: '#f4f4f0', surface: '#ffffff', primary: '#dc2626', secondary: '#171717', accent: '#dc2626', text: '#171717', muted: '#737373' }, { heading: 'Helvetica Neue' }),
  makeTheme('editorial', 'Editorial', 'Creative', { background: '#f4efe8', surface: '#fffdf8', primary: '#703d57', secondary: '#9a6b78', accent: '#e58b55', text: '#33262d', muted: '#806f74' }, { heading: 'Georgia', body: 'Georgia' }),
  makeTheme('glass', 'Glass', 'Creative', { background: '#e8f1f5', surface: '#ffffffcc', primary: '#0f766e', secondary: '#155e75', accent: '#f59e0b', text: '#164e63', muted: '#5b7280' }),
  makeTheme('aurora', 'Aurora', 'Creative', { background: '#eefbf7', surface: '#ffffff', primary: '#047857', secondary: '#0f766e', accent: '#db2777', text: '#123c35', muted: '#5a7d77' }),
  makeTheme('developer', 'Developer', 'Technical', { background: '#eef2f7', surface: '#ffffff', primary: '#2563eb', secondary: '#475569', accent: '#16a34a', text: '#172033', muted: '#64748b' }, { heading: 'IBM Plex Sans', body: 'IBM Plex Sans' }),
  makeTheme('cyber', 'Cyber', 'AI/Tech', { background: '#0b1020', surface: '#111a2e', primary: '#67e8f9', secondary: '#a5b4fc', accent: '#facc15', text: '#ecfeff', muted: '#94a3b8', radius: '8px', shadow: '0 20px 50px rgba(8, 47, 73, .42)' }),
  makeTheme('cloud', 'Cloud', 'Technical', { background: '#edf7ff', surface: '#ffffff', primary: '#0369a1', secondary: '#0e7490', accent: '#f97316', text: '#12324a', muted: '#648399' }),
  makeTheme('ai-lab', 'AI Lab', 'AI/Tech', { background: '#f3f0ff', surface: '#ffffff', primary: '#4338ca', secondary: '#7c3aed', accent: '#0891b2', text: '#21184f', muted: '#716f91' }),
  makeTheme('data', 'Data', 'Technical', { background: '#f0fdfa', surface: '#ffffff', primary: '#0f766e', secondary: '#155e75', accent: '#ea580c', text: '#123b3b', muted: '#5f7c7d' }),
  makeTheme('research', 'Research', 'Academic', { background: '#f8fafc', surface: '#ffffff', primary: '#1e3a8a', secondary: '#475569', accent: '#b45309', text: '#172554', muted: '#64748b' }, { heading: 'Georgia', body: 'Inter' }),
  makeTheme('conference', 'Conference', 'Academic', { background: '#fff7ed', surface: '#ffffff', primary: '#9a3412', secondary: '#7c2d12', accent: '#2563eb', text: '#431407', muted: '#9a6a55' }),
  makeTheme('midnight', 'Midnight', 'Dark', { background: '#0f172a', surface: '#172033', primary: '#f8fafc', secondary: '#cbd5e1', accent: '#38bdf8', text: '#f8fafc', muted: '#94a3b8', radius: '10px', shadow: '0 18px 50px rgba(2, 6, 23, .5)' }),
  makeTheme('carbon', 'Carbon', 'Dark', { background: '#171717', surface: '#262626', primary: '#facc15', secondary: '#d4d4d4', accent: '#f97316', text: '#fafafa', muted: '#a3a3a3', radius: '6px' }),
  makeTheme('deep-space', 'Deep Space', 'AI/Tech', { background: '#111827', surface: '#1e293b', primary: '#c4b5fd', secondary: '#93c5fd', accent: '#f0abfc', text: '#f8fafc', muted: '#a5b4fc' }),
  makeTheme('terminal', 'Terminal', 'Technical', { background: '#07130d', surface: '#0b2115', primary: '#86efac', secondary: '#4ade80', accent: '#fef08a', text: '#dcfce7', muted: '#86a894', radius: '4px' }, { heading: 'IBM Plex Mono', body: 'IBM Plex Mono' }),
  makeTheme('bold', 'Bold', 'Business', { background: '#fff1f2', surface: '#ffffff', primary: '#be123c', secondary: '#7f1d1d', accent: '#f59e0b', text: '#4c0519', muted: '#9f5268' }),
  makeTheme('gradient', 'Gradient', 'Creative', { background: '#eff6ff', surface: '#ffffff', primary: '#4f46e5', secondary: '#0891b2', accent: '#db2777', text: '#172554', muted: '#64748b' }),
];

export const getTheme = (id) => THEME_REGISTRY.find((theme) => theme.id === id) || THEME_REGISTRY[0];
