import { io } from 'socket.io-client'

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || import.meta.env.VITE_API_URL

const liveSockets = new Set()

/**
 * Create a socket.io client with the shared reconnect settings.
 *
 * Staff panels pass `{ authenticated: true }` so the Firebase ID token is sent in
 * the handshake (the backend verifies it before allowing staff-only events).
 * Customers never log in, so the customer panel creates anonymous sockets and
 * Firebase is never loaded for them.
 */
export function createSocket({ authenticated = false } = {}) {
  const socket = io(SOCKET_URL, {
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10000,
    timeout: 20000,
    ...(authenticated && {
      // Called on every (re)connect, so an expired token is always refreshed.
      auth: async (cb) => {
        try {
          const { auth } = await import('./firebase')
          const user = auth.currentUser
          cb(user ? { token: await user.getIdToken() } : {})
        } catch {
          cb({})
        }
      },
    }),
  })
  liveSockets.add(socket)
  return socket
}

/** Re-open a socket that was closed by disconnectAllSockets() (e.g. after logout/login). */
export function ensureConnected(socket) {
  if (socket && !socket.active) socket.connect()
  return socket
}

/** Called on logout so the next user never reuses the previous user's handshake token. */
export function disconnectAllSockets() {
  liveSockets.forEach((socket) => socket.disconnect())
}

/**
 * Emit a staff event and wait for the server's acknowledgement (Bug #23).
 * Resolves with the server's { ok, ... } reply, or { ok: false, error } when the
 * socket is down or no reply arrives in time, so the caller can roll back.
 */
export function emitAcked(socket, event, payload, timeoutMs = 8000) {
  return new Promise((resolve) => {
    if (!socket || !socket.connected) {
      resolve({ ok: false, error: 'Not connected. Check the connection and try again.' })
      return
    }
    let done = false
    const timer = setTimeout(() => {
      if (done) return
      done = true
      resolve({ ok: false, error: 'No response from the server. Check the connection and try again.' })
    }, timeoutMs)
    socket.emit(event, payload, (response) => {
      if (done) return
      done = true
      clearTimeout(timer)
      resolve(response && typeof response === 'object' ? response : { ok: false, error: 'Unexpected response from the server.' })
    })
  })
}
