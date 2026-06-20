import { useEffect, useRef, useState } from 'react'
import { ensureAuth } from '../services/firebase'
import { subscribeMessages, sendMessage, type ChatMessage } from '../services/chat'

function ChatSection(): JSX.Element {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [draft, setDraft] = useState('')
  const [status, setStatus] = useState<'connecting' | 'ready' | 'error'>('connecting')
  const [sending, setSending] = useState(false)
  const logRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let unsub = (): void => {}
    ensureAuth()
      .then(() => {
        setStatus('ready')
        unsub = subscribeMessages(setMessages)
      })
      .catch((e) => {
        console.error('Theo chat auth failed', e)
        setStatus('error')
      })
    return () => unsub()
  }, [])

  useEffect(() => {
    const el = logRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, status])

  const thinking =
    status === 'ready' && messages.length > 0 && messages[messages.length - 1].role === 'user'

  async function send(): Promise<void> {
    const text = draft.trim()
    if (!text || sending || status !== 'ready') return
    setDraft('')
    setSending(true)
    try {
      await sendMessage(text)
    } catch (e) {
      console.error('send failed', e)
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="chat">
      <div className="chat-log" ref={logRef}>
        {status === 'connecting' && <div className="chat-note">Connecting to Theo…</div>}
        {status === 'error' && (
          <div className="chat-note error">
            Couldn’t reach Firebase. Check your connection and restart the app.
          </div>
        )}
        {status === 'ready' && messages.length === 0 && (
          <div className="chat-empty">
            <div className="chat-empty-title">Talk to Theo</div>
            <div className="chat-empty-sub">
              Messages sync through Firebase to the bridge on your PC. Make sure{' '}
              <code>bridge.ps1</code> is running so Theo can answer.
            </div>
          </div>
        )}
        {messages.map((m) => (
          <div key={m.id} className={`msg ${m.role === 'assistant' ? 'theo' : 'user'}`}>
            {m.content}
          </div>
        ))}
        {thinking && (
          <div className="msg theo thinking" aria-label="Theo is thinking">
            <span className="dot" />
            <span className="dot" />
            <span className="dot" />
          </div>
        )}
      </div>
      <div className="chat-input">
        <input
          type="text"
          placeholder={status === 'ready' ? 'Message Theo…' : 'Connecting…'}
          value={draft}
          disabled={status !== 'ready'}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') send()
          }}
        />
        <button className="btn" onClick={send} disabled={status !== 'ready' || sending}>
          Send
        </button>
      </div>
    </div>
  )
}

export default ChatSection
