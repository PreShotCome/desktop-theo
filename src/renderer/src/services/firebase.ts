// Firebase client for the desktop app. Same project as the Flutter chat app
// (data-55089) so the desktop joins the *same* shared Theo. The web config
// below is public client config (identical to the Flutter firebase_options),
// safe to ship — Firestore security rules are what gate access.
import { initializeApp } from 'firebase/app'
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: 'AIzaSyBlD7IycQc2Koxtga7tCnVZLWU8zYgSZEM',
  authDomain: 'data-55089.firebaseapp.com',
  projectId: 'data-55089',
  storageBucket: 'data-55089.firebasestorage.app',
  messagingSenderId: '174078660867',
  appId: '1:174078660867:web:7dab877b804d4a61069936'
}

const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db = getFirestore(app)

let authPromise: Promise<void> | null = null

// Anonymous auth — Ian is the only user; the rules allow any signed-in client.
// The session persists locally, so the same anonymous uid is reused on relaunch.
export function ensureAuth(): Promise<void> {
  if (auth.currentUser) return Promise.resolve()
  if (!authPromise) {
    authPromise = new Promise<void>((resolve, reject) => {
      const unsub = onAuthStateChanged(auth, (user) => {
        if (user) {
          unsub()
          resolve()
        }
      })
      signInAnonymously(auth).catch((e) => {
        unsub()
        reject(e)
      })
    })
  }
  return authPromise
}
