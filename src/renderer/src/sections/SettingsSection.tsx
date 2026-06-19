import { useEffect, useState } from 'react'

interface SettingsShape {
  bridgeUrl: string
  bridgeToken: string
  backend: 'auto' | 'ollama' | 'claude'
}

const DEFAULTS: SettingsShape = {
  bridgeUrl: '',
  bridgeToken: '',
  backend: 'auto'
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
          Where the desktop app finds Theo. These persist to disk and will feed
          the bridge client once chat is connected.
        </p>
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
