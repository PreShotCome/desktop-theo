import { useState } from 'react'
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
