import raw from './brain.json'
import { emotionsCategory } from './emotions'

// Shape of the snapshot exported from Theo's identity (brain.json). Bundled as
// a static snapshot for now; later the Brain section can pull a live copy
// through the bridge.
export interface BrainNode {
  id: string
  label: string
  body: string
  schema?: string
  path?: string
  color?: string
}

export interface BrainCategory {
  id: string
  label: string
  nodes: BrainNode[]
}

export interface BrainData {
  generated_at: string
  identity_version: string
  name: string
  voice?: string
  voice_character?: string
  categories: BrainCategory[]
  stats?: Record<string, unknown>
}

const base = raw as unknown as BrainData

// brain.json is an identity-v3.4 snapshot (pre-emotions). Append the v3.5
// emotional registers as their own category so they appear in the Brain.
export const brain: BrainData = {
  ...base,
  categories: [...base.categories, emotionsCategory]
}

