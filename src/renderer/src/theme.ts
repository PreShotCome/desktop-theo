// Theo desktop palette — continues the "TerminalTron" aesthetic from the
// existing Flutter chat app (the `TS` palette: dark terminal, cyan accent).
// Kept in one place so the look stays consistent as sections are added.
export const TS = {
  bg: '#0a0e0f',
  panel: '#0f1517',
  panelAlt: '#121a1d',
  border: '#1d2a2e',
  text: '#d6e7e5',
  textDim: '#7d9794',
  accent: '#36e0c8',
  accentDim: '#1c8678',
  danger: '#ff5d6c',
  warn: '#ffcc66'
} as const

export type Section = 'chat' | 'code' | 'brain' | 'settings'
