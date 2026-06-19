import { contextBridge, ipcRenderer } from 'electron'

// The single, audited surface the renderer can touch. Everything the UI is
// allowed to ask the main process to do goes through here — no nodeIntegration,
// no raw ipcRenderer in the renderer.
const api = {
  getVersion: (): Promise<string> => ipcRenderer.invoke('app:getVersion'),
  getSettings: (): Promise<Record<string, unknown>> => ipcRenderer.invoke('settings:get'),
  setSettings: (data: Record<string, unknown>): Promise<Record<string, unknown>> =>
    ipcRenderer.invoke('settings:set', data)
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
