import raw from './brain.json'

// Shape of the snapshot exported from Theo's identity (brain.json). Bundled as
// a static snapshot for now; later the Brain section can pull a live copy
// through the bridge.
export interface BrainNode {
  id: string
  label: string
  body: string
  schema?: string
  path?: string
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

export const brain = raw as unknown as BrainData
