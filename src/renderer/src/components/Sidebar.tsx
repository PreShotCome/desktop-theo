import type { Section } from '../theme'

const ITEMS: { id: Section; label: string; glyph: string }[] = [
  { id: 'chat', label: 'Chat', glyph: '◈' },
  { id: 'code', label: 'Code', glyph: '⌘' },
  { id: 'brain', label: 'Brain', glyph: '✦' },
  { id: 'settings', label: 'Settings', glyph: '⚙' }
]

interface Props {
  active: Section
  onSelect: (s: Section) => void
}

function Sidebar({ active, onSelect }: Props): JSX.Element {
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-name">THEO</div>
        <div className="brand-sub">Desktop</div>
      </div>
      <nav className="nav">
        {ITEMS.map((item) => (
          <button
            key={item.id}
            className={`nav-item${active === item.id ? ' active' : ''}`}
            onClick={() => onSelect(item.id)}
          >
            <span className="nav-glyph">{item.glyph}</span>
            <span className="nav-label">{item.label}</span>
          </button>
        ))}
      </nav>
      <div className="sidebar-foot">Local-first · bridge optional</div>
    </aside>
  )
}

export default Sidebar
