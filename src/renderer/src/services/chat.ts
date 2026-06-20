// Chat transport — Firestore conversation threads, the SAME store the Flutter
// app and bridge use (conversations/{id}/messages/). Mirrors chat_service.dart
// so the desktop shows the same threads as the phone and the bridge answers in
// the same place. Theo is one shared mind; threads are just organization.
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp
} from 'firebase/firestore'
import { db, ensureAuth } from './firebase'

export interface Conversation {
  id: string
  title: string
  lastMessage: string
  updatedAt: number | null
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: number | null
}

const conversationsCol = collection(db, 'conversations')
function messagesOf(convId: string): ReturnType<typeof collection> {
  return collection(db, 'conversations', convId, 'messages')
}

export function subscribeConversations(cb: (c: Conversation[]) => void): () => void {
  const q = query(conversationsCol, orderBy('updated_at', 'desc'))
  return onSnapshot(q, (snap) => {
    cb(
      snap.docs.map((d) => {
        const data = d.data({ serverTimestamps: 'estimate' })
        const ts = data.updated_at as Timestamp | null
        return {
          id: d.id,
          title: (data.title as string) || 'New chat',
          lastMessage: (data.last_message as string) || '',
          updatedAt: ts ? ts.toMillis() : null
        }
      })
    )
  })
}

export function subscribeMessages(convId: string, cb: (m: ChatMessage[]) => void): () => void {
  const q = query(messagesOf(convId), orderBy('created_at', 'asc'))
  return onSnapshot(q, (snap) => {
    cb(
      snap.docs.map((d) => {
        const data = d.data({ serverTimestamps: 'estimate' })
        const ts = data.created_at as Timestamp | null
        return {
          id: d.id,
          role: data.role === 'assistant' ? 'assistant' : 'user',
          content: (data.content as string) || '',
          createdAt: ts ? ts.toMillis() : null
        }
      })
    )
  })
}

export async function createConversation(): Promise<string> {
  await ensureAuth()
  const ref = await addDoc(conversationsCol, {
    title: 'New chat',
    created_at: serverTimestamp(),
    updated_at: serverTimestamp()
  })
  return ref.id
}

export async function sendMessage(convId: string, text: string, isFirst: boolean): Promise<void> {
  const trimmed = text.trim()
  if (!trimmed) return
  await ensureAuth()
  await addDoc(messagesOf(convId), {
    role: 'user',
    content: trimmed,
    created_at: serverTimestamp(),
    processed: false
  })
  const preview = trimmed.length > 80 ? `${trimmed.slice(0, 80)}…` : trimmed
  const update: Record<string, unknown> = {
    updated_at: serverTimestamp(),
    last_message: preview
  }
  if (isFirst) update.title = titleFrom(trimmed)
  await setDoc(doc(conversationsCol, convId), update, { merge: true })
}

export async function deleteConversation(convId: string): Promise<void> {
  const msgs = await getDocs(messagesOf(convId))
  await Promise.all(msgs.docs.map((d) => deleteDoc(d.ref)))
  await deleteDoc(doc(conversationsCol, convId))
}

function titleFrom(text: string): string {
  const first = text.split('\n')[0].trim()
  if (!first) return 'New chat'
  return first.length > 40 ? `${first.slice(0, 40)}…` : first
}
