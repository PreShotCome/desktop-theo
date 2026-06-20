// Chat transport — Firestore, the same store the bridge already watches.
//
// The desktop writes user messages to the top-level `messages/` collection
// ({role:"user", content, processed:false}). The bridge on Ian's PC listens
// via collection_group("messages"), runs the shared Theo agent, and writes a
// {role:"assistant", content} doc back into the same collection. We just
// subscribe and render.
import {
  addDoc,
  collection,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore'
import { db, ensureAuth } from './firebase'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: number | null
}

const messagesCol = collection(db, 'messages')

export function subscribeMessages(cb: (msgs: ChatMessage[]) => void): () => void {
  const q = query(messagesCol, orderBy('created_at', 'asc'))
  return onSnapshot(q, (snap) => {
    const out = snap.docs.map((d) => {
      // 'estimate' gives pending local writes a timestamp so they show + sort
      // immediately instead of popping in once the server resolves.
      const data = d.data({ serverTimestamps: 'estimate' })
      const ts = data.created_at as Timestamp | null
      return {
        id: d.id,
        role: data.role === 'assistant' ? 'assistant' : 'user',
        content: (data.content as string) || '',
        createdAt: ts ? ts.toMillis() : null
      } as ChatMessage
    })
    cb(out)
  })
}

export async function sendMessage(text: string): Promise<void> {
  const trimmed = text.trim()
  if (!trimmed) return
  await ensureAuth()
  await addDoc(messagesCol, {
    role: 'user',
    content: trimmed,
    created_at: serverTimestamp(),
    processed: false
  })
}
