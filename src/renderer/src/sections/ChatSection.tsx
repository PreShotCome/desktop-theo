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

// Same markdown-image syntax the bridge and Flutter client use.
const IMAGE_MD = /!\[[^\]]*\]\((https?:\/\/[^\s)]+|data:[^\s)]+)\)/g

// Render a message: inline any `![alt](url)` as an <img>, keep the rest as text.
function renderContent(content: string): JSX.Element {
  const parts: JSX.Element[] = []
  let last = 0
  let i = 0
  let m: RegExpExecArray | null
  const re = new RegExp(IMAGE_MD.source, 'g')
  while ((m = re.exec(content)) !== null) {
    const pre = content.slice(last, m.index)
    if (pre.trim()) parts.push(<span key={`t${i}`}>{pre}</span>)
    parts.push(<img key={`i${i}`} className="msg-img" src={m[1]} alt="attached" />)
    last = m.index + m[0].length
    i++
  }
  const tail = content.slice(last)
  if (tail.trim()) parts.push(<span key={`t${i}`}>{tail}</span>)
  return parts.length ? <>{parts}</> : <>{content}</>
}

function ChatSection(): JSX.Element {
  const [status, setStatus] = useState<'connecting' | 'ready' | 'error'>('connecting')
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [convId, setConvId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [attachments, setAttachments] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const logRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

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

  // Upload image files to the bridge (via the main process) and attach the URLs.
  async function uploadFiles(files: FileList | File[]): Promise<void> {
    const imgs = Array.from(files).filter((f) => f.type.startsWith('image/'))
    if (imgs.length === 0) return
    setUploading(true)
    try {
      for (const f of imgs) {
        const bytes = new Uint8Array(await f.arrayBuffer())
        const url = await window.theo.uploadImage(bytes, f.type)
        setAttachments((a) => [...a, url])
      }
    } catch (e) {
      console.error('image upload failed', e)
    } finally {
      setUploading(false)
    }
  }

  function onPaste(e: React.ClipboardEvent): void {
    const files = Array.from(e.clipboardData.items)
      .filter((it) => it.kind === 'file' && it.type.startsWith('image/'))
      .map((it) => it.getAsFile())
      .filter((f): f is File => f !== null)
    if (files.length) {
      e.preventDefault()
      void uploadFiles(files)
    }
  }

  function onDrop(e: React.DragEvent): void {
    e.preventDefault()
    setDragActive(false)
    if (e.dataTransfer.files?.length) void uploadFiles(e.dataTransfer.files)
  }

  async function send(): Promise<void> {
    const text = draft.trim()
    if ((!text && attachments.length === 0) || sending || uploading || status !== 'ready') return
    const imgMd = attachments.map((u) => `![image](${u})`).join('\n')
    const content = [text, imgMd].filter(Boolean).join('\n')
    setDraft('')
    setAttachments([])
    setSending(true)
    try {
      let id = convId
      if (!id) {
        id = await createConversation()
        setConvId(id)
      }
      await sendMessage(id, content, messages.length === 0)
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

      <div
        className={`chat${dragActive ? ' drag-active' : ''}`}
        onDragOver={(e) => {
          if (Array.from(e.dataTransfer.types).includes('Files')) {
            e.preventDefault()
            setDragActive(true)
          }
        }}
        onDragLeave={(e) => {
          if (e.currentTarget === e.target) setDragActive(false)
        }}
        onDrop={onDrop}
      >
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
              {renderContent(m.content)}
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

        {dragActive && <div className="chat-drop-hint">Drop image to attach</div>}

        {(attachments.length > 0 || uploading) && (
          <div className="chat-attachments">
            {attachments.map((url, idx) => (
              <div className="chat-attachment" key={url}>
                <img src={url} alt="attachment" />
                <button
                  className="chat-attachment-rm"
                  title="Remove"
                  onClick={() => setAttachments((a) => a.filter((_, i) => i !== idx))}
                >
                  ×
                </button>
              </div>
            ))}
            {uploading && <div className="chat-attachment uploading">…</div>}
          </div>
        )}

        <div className="chat-input">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(e) => {
              if (e.target.files) void uploadFiles(e.target.files)
              e.target.value = ''
            }}
          />
          <button
            className="chat-attach-btn"
            title="Attach image"
            disabled={status !== 'ready'}
            onClick={() => fileRef.current?.click()}
          >
            📎
          </button>
          <input
            type="text"
            placeholder={status === 'ready' ? 'Message Theo…  (paste or drop an image)' : 'Connecting…'}
            value={draft}
            disabled={status !== 'ready'}
            onChange={(e) => setDraft(e.target.value)}
            onPaste={onPaste}
            onKeyDown={(e) => {
              if (e.key === 'Enter') send()
            }}
          />
          <button
            className="btn"
            onClick={send}
            disabled={status !== 'ready' || sending || uploading}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  )
}

export default ChatSection
