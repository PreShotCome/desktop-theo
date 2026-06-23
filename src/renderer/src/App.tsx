import { useEffect, useState } from 'react'
import type { Section } from './theme'
import Sidebar from './components/Sidebar'
import ChatSection from './sections/ChatSection'
import CodeSection from './sections/CodeSection'
import BrainSection from './sections/BrainSection'
import SettingsSection from './sections/SettingsSection'

const TITLES: Record<Section, string> = {
  chat: 'Chat',
  code: 'Code',
  brain: 'Brain',
  settings: 'Settings'
}

const BACKEND_LABEL: Record<string, string> = {
  starting: 'starting…',
  online: 'online',
  stopped: 'offline',
  error: 'error',
  unsupported: 'n/a'
}

// Live status of the Theo backend the main process spawns, fed by
// theo-backend.ps1's stdout.
function BackendPill(): JSX.Element {
  const [status, setStatus] = useState('stopped')
  useEffect(() => {
    void window.theo.getBackendStatus().then(setStatus)
    return window.theo.onBackendStatus(setStatus)
  }, [])
  return (
    <span className={`backend-pill ${status}`} title={`Theo backend: ${status}`}>
      <span className="backend-dot" />
      Theo {BACKEND_LABEL[status] ?? status}
    </span>
  )
}

function App(): JSX.Element {
  const [section, setSection] = useState<Section>('chat')
  const [navCollapsed, setNavCollapsed] = useState(false)

  return (
    <div className="app">
      {!navCollapsed && <Sidebar active={section} onSelect={setSection} />}
      <div className="content">
        <div className="topbar">
          <button
            className="topbar-toggle"
            onClick={() => setNavCollapsed((c) => !c)}
            title="Toggle menu"
            aria-label="Toggle menu"
          >
            ☰
          </button>
          <h1>{TITLES[section]}</h1>
          <BackendPill />
        </div>
        {section === 'chat' && <ChatSection />}
        {section === 'code' && <CodeSection />}
        {section === 'brain' && <BrainSection />}
        {section === 'settings' && <SettingsSection />}
      </div>
    </div>
  )
}

export default App
