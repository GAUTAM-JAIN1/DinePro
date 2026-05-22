import axios from 'axios'
import { auth } from '../firebase'

/**
 * Axios instance that auto-attaches Firebase token to every request
 * Use this instead of raw axios for all authenticated API calls
 */
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
})

// Attach Firebase token before every request
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

export default api
