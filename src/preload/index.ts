import { contextBridge, ipcRenderer } from 'electron'

// Theo's memory, as the bridge serves it. `s` is salience (0..1), `y` the note
// type, `d` the degree; edges are undirected with weight `w`.
export type BrainGraph = {
  nodes: { id: string; t: string; y: string; s: number; d: number }[]
  edges: { a: string; b: string; w: number }[]
}
// One real recall: the notes the message named, the charge that reached each
// node, the hop count, and the spontaneous connection he drew (if any).
export type BrainEvent = {
  id: number
  seeds: string[]
  act: Record<string, number>
  hop: Record<string, number>
  spark: string | null
}
export type BrainActivity = { events: BrainEvent[]; latest: number }

// The single, audited surface the renderer can touch. Everything the UI is
// allowed to ask the main process to do goes through here — no nodeIntegration,
// no raw ipcRenderer in the renderer.
const api = {
  getVersion: (): Promise<string> => ipcRenderer.invoke('app:getVersion'),
  getSettings: (): Promise<Record<string, unknown>> => ipcRenderer.invoke('settings:get'),
  setSettings: (data: Record<string, unknown>): Promise<Record<string, unknown>> =>
    ipcRenderer.invoke('settings:set', data),
  getBackendStatus: (): Promise<string> => ipcRenderer.invoke('backend:getStatus'),
  uploadImage: (bytes: Uint8Array, contentType: string): Promise<string> =>
    ipcRenderer.invoke('image:upload', { bytes, contentType }),
  getBrainGraph: (): Promise<BrainGraph> => ipcRenderer.invoke('brain:graph'),
  getBrainActivity: (since: number): Promise<BrainActivity> =>
    ipcRenderer.invoke('brain:activity', since),
  onBackendStatus: (cb: (status: string) => void): (() => void) => {
    const listener = (_e: unknown, status: string): void => cb(status)
    ipcRenderer.on('backend:status', listener)
    return () => ipcRenderer.removeListener('backend:status', listener)
  }
}

export type TheoApi = typeof api

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('theo', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // Fallback for the (unused) non-isolated case.
  // @ts-ignore — define on window when context isolation is off
  window.theo = api
}
