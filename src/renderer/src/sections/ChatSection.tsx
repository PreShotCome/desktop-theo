import { useState } from 'react'

interface Msg {
  role: 'user' | 'theo'
  text: string
}

const GREETING: Msg = {
  role: 'theo',
  text: 'This is the Theo Desktop shell. The chat surface is wired up — it just isn’t connected to the bridge yet. Set the bridge URL/token under Settings, then this view will talk to Theo.'
}

function ChatSection(): JSX.Element {
  const [messages, setMessages] = useState<Msg[]>([GREETING])
  const [draft, setDraft] = useState('')

  function send(): void {
    const text = draft.trim()
    if (!text) return
    setMessages((prev) => [
      ...prev,
      { role: 'user', text },
      {
        role: 'theo',
        text: 'Not connected to the Theo bridge yet — this is a placeholder reply. Bridge wiring is the next step.'
      }
    ])
    setDraft('')
  }

  return (
    <div className="chat">
      <div className="chat-log">
        {messages.map((m, i) => (
          <div key={i} className={`msg ${m.role}`}>
            {m.text}
          </div>
        ))}
      </div>
      <div className="chat-input">
        <input
          type="text"
          placeholder="Message Theo…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') send()
          }}
        />
        <button className="btn" onClick={send}>
          Send
        </button>
      </div>
    </div>
  )
}

export default ChatSection
