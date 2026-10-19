import { initializeApp } from 'firebase/app'
import { getAuth, setPersistence, browserSessionPersistence } from 'firebase/auth'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)

// Testing only: VITE_AUTH_PERSISTENCE=session makes every browser tab keep its OWN login,
// so you can be Chef in one tab and Receptionist in another.
// Leave it unset in production — staff stay logged in across tabs and browser restarts.
if (import.meta.env.VITE_AUTH_PERSISTENCE === 'session') {
  setPersistence(auth, browserSessionPersistence).catch((err) =>
    console.warn('Could not enable per-tab login:', err)
  )
}
