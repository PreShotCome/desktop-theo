// Theo desktop palette — "Modern Glass": dark gradient backdrop, frosted
// translucent panels, a teal->violet accent gradient. Mirrors the CSS custom
// properties in styles.css; kept here for any inline/JS use as sections grow.
export const TS = {
  bg: '#0b0d12',
  glass: 'rgba(20, 24, 33, 0.55)',
  glassStrong: 'rgba(24, 29, 40, 0.72)',
  border: 'rgba(255, 255, 255, 0.08)',
  text: '#e6ebf2',
  textDim: '#8b95a7',
  accent: '#36e0c8',
  accent2: '#8b5cf6',
  accentGrad: 'linear-gradient(135deg, #36e0c8 0%, #8b5cf6 100%)',
  danger: '#ff6b78',
  warn: '#ffcc66'
} as const

export type Section = 'chat' | 'code' | 'brain' | 'settings'
