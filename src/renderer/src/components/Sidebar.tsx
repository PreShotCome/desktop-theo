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
  collapsed: boolean
}

function Sidebar({ active, onSelect, collapsed }: Props): JSX.Element {
  return (
    <aside className={`sidebar${collapsed ? ' collapsed' : ''}`}>
      <div className="brand">
        <div className="brand-name">{collapsed ? 'T' : 'THEO'}</div>
        {!collapsed && <div className="brand-sub">Desktop</div>}
      </div>
      <nav className="nav">
        {ITEMS.map((item) => (
          <button
            key={item.id}
            className={`nav-item${active === item.id ? ' active' : ''}`}
            onClick={() => onSelect(item.id)}
            title={collapsed ? item.label : undefined}
          >
            <span className="nav-glyph">{item.glyph}</span>
            {!collapsed && <span className="nav-label">{item.label}</span>}
          </button>
        ))}
      </nav>
      {!collapsed && <div className="sidebar-foot">Local-first · bridge optional</div>}
    </aside>
  )
}

export default Sidebar
