import { useEffect, useState } from 'react'

interface SettingsShape {
  techSupportDir: string
  bridgeUrl: string
  bridgeToken: string
  backend: 'auto' | 'ollama' | 'claude'
  webSandbox: 'off' | 'stub' | 'record' | 'replay'
}

const DEFAULTS: SettingsShape = {
  techSupportDir: '',
  bridgeUrl: '',
  bridgeToken: '',
  backend: 'auto',
  webSandbox: 'off'
}

function SettingsSection(): JSX.Element {
  const [form, setForm] = useState<SettingsShape>(DEFAULTS)
  const [version, setVersion] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    void window.theo.getVersion().then(setVersion)
    void window.theo.getSettings().then((stored) => {
      setForm({ ...DEFAULTS, ...(stored as Partial<SettingsShape>) })
    })
  }, [])

  function update<K extends keyof SettingsShape>(key: K, value: SettingsShape[K]): void {
    setForm((prev) => ({ ...prev, [key]: value }))
    setSaved(false)
  }

  async function save(): Promise<void> {
    await window.theo.setSettings({ ...form })
    setSaved(true)
  }

  return (
    <div className="section">
      <div className="placeholder">
        <h2>Settings</h2>
        <p>
          Where the desktop app finds Theo. The app auto-launches the backend
          (Ollama + bridge) from the Tech-Support folder on startup — no manual
          bridge.ps1. Changing the folder takes effect on the next launch.
        </p>
      </div>

      <div className="field">
        <label>Tech-Support folder</label>
        <input
          type="text"
          placeholder="C:\src\Tech-Support"
          value={form.techSupportDir}
          onChange={(e) => update('techSupportDir', e.target.value)}
        />
      </div>

      <div className="field">
        <label>Bridge URL</label>
        <input
          type="text"
          placeholder="http://100.111.152.27:8765"
          value={form.bridgeUrl}
          onChange={(e) => update('bridgeUrl', e.target.value)}
        />
      </div>

      <div className="field">
        <label>Bridge Token</label>
        <input
          type="password"
          placeholder="shared bridge token"
          value={form.bridgeToken}
          onChange={(e) => update('bridgeToken', e.target.value)}
        />
      </div>

      <div className="field">
        <label>LLM Backend</label>
        <select value={form.backend} onChange={(e) => update('backend', e.target.value as SettingsShape['backend'])}>
          <option value="auto">auto (local-first)</option>
          <option value="ollama">ollama</option>
          <option value="claude">claude (opt-in)</option>
        </select>
      </div>

      <div className="field">
        <label>Web sandbox (offline internet)</label>
        <select
          value={form.webSandbox}
          onChange={(e) => update('webSandbox', e.target.value as SettingsShape['webSandbox'])}
        >
          <option value="off">off — live internet</option>
          <option value="replay">replay — offline, serve the captured crawl</option>
          <option value="record">record — live, capture a snapshot</option>
          <option value="stub">stub — offline, log lookups only</option>
        </select>
        <p style={{ color: 'var(--text-dim)', fontSize: 12, marginTop: 6 }}>
          Routes Theo&rsquo;s web tools through an offline snapshot. He can&rsquo;t tell.
          Applies on next launch. Capture a crawl first with{' '}
          <code>python -m agent.tools.web_crawl</code>.
        </p>
      </div>

      <div>
        <button className="btn" onClick={save}>
          Save
        </button>
        {saved && <span className="saved-note">Saved ✓</span>}
      </div>

      <p style={{ marginTop: 28, color: 'var(--text-dim)', fontSize: 12 }}>
        Theo Desktop v{version}
      </p>
    </div>
  )
}

export default SettingsSection
