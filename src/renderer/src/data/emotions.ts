// Theo's emotional registers (affect tuning, IDENTITY v3.5). Snapshot of
// finetune/emotions/manifest.json — 8 registers, each with its own color.
// Surfaced in the Brain as their own region so the emotional branches show up
// alongside tools/skills/etc.
import manifest from './emotions.json'
import type { BrainCategory } from './brain'

interface Emotion {
  id: string
  label: string
  color: string
  register: string
  shows_when?: string
  names_it_like?: string[]
}

const data = manifest as unknown as { emotions: Emotion[] }

export const emotionsCategory: BrainCategory = {
  id: 'emotions',
  label: 'Emotions (registers)',
  nodes: data.emotions.map((e) => ({
    id: `emotion:${e.id}`,
    label: e.label,
    body: [e.register, e.shows_when, (e.names_it_like || []).join(' · ')]
      .filter(Boolean)
      .join('\n\n'),
    color: e.color
  }))
}
