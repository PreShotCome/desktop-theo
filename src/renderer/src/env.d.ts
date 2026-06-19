/// <reference types="vite/client" />

// The bridge surface exposed by the preload script (window.theo).
interface TheoApi {
  getVersion: () => Promise<string>
  getSettings: () => Promise<Record<string, unknown>>
  setSettings: (data: Record<string, unknown>) => Promise<Record<string, unknown>>
}

interface Window {
  theo: TheoApi
}
