import { useEffect, useRef, useState } from 'react'
import { ensureAuth } from '../services/firebase'
import {
  subscribeConversations,
  subscribeMessages,
  sendMessage,
  createConversation,
  deleteConversation,
  type Conversation,
  type ChatMessage
} from '../services/chat'

function ChatSection(): JSX.Element {
  const [status, setStatus] = useState<'connecting' | 'ready' | 'error'>('connecting')
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [convId, setConvId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const logRef = useRef<HTMLDivElement>(null)

  // auth, then subscribe to the conversation list
  useEffect(() => {
    let unsub = (): void => {}
    ensureAuth()
      .then(() => {
        setStatus('ready')
        unsub = subscribeConversations(setConversations)
      })
      .catch((e) => {
        console.error('Theo chat auth failed', e)
        setStatus('error')
      })
    return () => unsub()
  }, [])

  // auto-open the most-recently-updated thread (matches the phone's top thread)
  useEffect(() => {
    if (convId === null && conversations.length > 0) setConvId(conversations[0].id)
  }, [conversations, convId])

  // messages for the selected thread
  useEffect(() => {
    if (!convId) {
      setMessages([])
      return
    }
    const unsub = subscribeMessages(convId, setMessages)
    return () => unsub()
  }, [convId])

  useEffect(() => {
    const el = logRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, convId])

  const thinking =
    status === 'ready' && messages.length > 0 && messages[messages.length - 1].role === 'user'

  async function send(): Promise<void> {
    const text = draft.trim()
    if (!text || sending || status !== 'ready') return
    setDraft('')
    setSending(true)
    try {
      let id = convId
      if (!id) {
        id = await createConversation()
        setConvId(id)
      }
      await sendMessage(id, text, messages.length === 0)
    } catch (e) {
      console.error('send failed', e)
    } finally {
      setSending(false)
    }
  }

  async function newChat(): Promise<void> {
    if (status !== 'ready') return
    const id = await createConversation()
    setConvId(id)
  }

  async function removeConv(id: string, e: React.MouseEvent): Promise<void> {
    e.stopPropagation()
    await deleteConversation(id)
    if (id === convId) setConvId(null)
  }

  return (
    <div className="chat-wrap">
      <aside className="chat-threads">
        <button className="chat-new" onClick={newChat} disabled={status !== 'ready'}>
          ＋ New chat
        </button>
        <div className="chat-thread-list">
          {conversations.map((c) => (
            <button
              key={c.id}
              className={`chat-thread${c.id === convId ? ' active' : ''}`}
              onClick={() => setConvId(c.id)}
            >
              <span className="chat-thread-text">
                <span className="chat-thread-title">{c.title || 'New chat'}</span>
                <span className="chat-thread-sub">{c.lastMessage || '—'}</span>
              </span>
              <span className="chat-thread-del" title="Delete" onClick={(e) => removeConv(c.id, e)}>
                ×
              </span>
            </button>
          ))}
          {status === 'ready' && conversations.length === 0 && (
            <div className="chat-threads-empty">No conversations yet.</div>
          )}
        </div>
      </aside>

      <div className="chat">
        <div className="chat-log" ref={logRef}>
          {status === 'connecting' && <div className="chat-note">Connecting to Theo…</div>}
          {status === 'error' && (
            <div className="chat-note error">
              Couldn’t reach Firebase. Check your connection and restart the app.
            </div>
          )}
          {status === 'ready' && convId && messages.length === 0 && (
            <div className="chat-empty">
              <div className="chat-empty-title">New thread</div>
              <div className="chat-empty-sub">
                Send a message to start. Make sure <code>bridge.ps1</code> is running on your PC.
              </div>
            </div>
          )}
          {status === 'ready' && !convId && conversations.length === 0 && (
            <div className="chat-empty">
              <div className="chat-empty-title">Talk to Theo</div>
              <div className="chat-empty-sub">
                Your existing conversations appear on the left. Send a message to start a new one —
                keep <code>bridge.ps1</code> running so Theo can answer.
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
    </div>
  )
}

export default ChatSection
