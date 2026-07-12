/// <reference types="vite/client" />

// Theo's memory graph as the bridge serves it (see local_storage.py /brain/*).
interface BrainGraph {
  nodes: { id: string; t: string; y: string; s: number; d: number }[]
  edges: { a: string; b: string; w: number }[]
}
interface BrainEvent {
  id: number
  seeds: string[]
  act: Record<string, number>
  hop: Record<string, number>
  spark: string | null
}
interface BrainActivity {
  events: BrainEvent[]
  latest: number
}

// The bridge surface exposed by the preload script (window.theo).
interface TheoApi {
  getVersion: () => Promise<string>
  getSettings: () => Promise<Record<string, unknown>>
  setSettings: (data: Record<string, unknown>) => Promise<Record<string, unknown>>
  getBackendStatus: () => Promise<string>
  onBackendStatus: (cb: (status: string) => void) => () => void
  uploadImage: (bytes: Uint8Array, contentType: string) => Promise<string>
  getBrainGraph: () => Promise<BrainGraph>
  getBrainActivity: (since: number) => Promise<BrainActivity>
}

interface Window {
  theo: TheoApi
}
