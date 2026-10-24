import axios from 'axios'
import { signOut } from 'firebase/auth'
import { auth } from './firebase'

/**
 * Axios instance that auto-attaches the Firebase ID token to every request.
 * Use this for all authenticated API calls.
 */
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  timeout: 30000, // Render free tier can take a while to wake up after a deploy
})

api.interceptors.request.use(async (config) => {
  try {
    const user = auth.currentUser
    if (user) {
      const token = await user.getIdToken()
      config.headers.Authorization = `Bearer ${token}`
    }
  } catch (err) {
    console.error('Failed to get auth token:', err)
  }
  return config
})

/**
 * Bug #62: a 401 used to fail silently on every screen.
 *
 * 1. First 401 on a request: refresh the ID token and retry that request once.
 *    This covers a token that expired while the screen was open.
 * 2. Still 401: the session is gone (revoked, or the account was deactivated).
 *    Sign out and return to the role chooser instead of leaving a stale screen up.
 */
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error?.config
    if (error?.response?.status !== 401 || !config) {
      return Promise.reject(error)
    }

    if (!config._retriedAfterRefresh && auth.currentUser) {
      try {
        await auth.currentUser.getIdToken(true)
        config._retriedAfterRefresh = true
        return api(config)
      } catch {
        // Refresh failed. Fall through to sign-out below.
      }
    }

    try {
      await signOut(auth)
    } catch {
      // Already signed out is fine.
    }
    if (typeof window !== 'undefined' && window.location.pathname !== '/') {
      window.location.assign('/')
    }
    return Promise.reject(error)
  }
)

export default api
