require('dotenv').config()
const express = require('express')
const http = require('http')
const { Server } = require('socket.io')
const cors = require('cors')

// Import Routes
const menuRoutes = require('./routes/menu')
const orderRoutes = require('./routes/orders')
const restaurantRoutes = require('./routes/restaurants')
const tableRoutes = require('./routes/tables')
const authRoutes = require('./routes/auth')
const staffRoutes = require('./routes/staff')
const imageRoutes = require('./routes/images')

// Import Socket Handler
const { initOrderSocket } = require('./socket/orderSocket')

// Import Middleware
const { generalRateLimit } = require('./middleware/rateLimit')

const app = express()
const server = http.createServer(app)

// Render (and most hosts) put a reverse proxy in front of the app. Without this,
// every visitor appears to have the proxy's IP, so the per-IP rate limits would be
// shared by ALL customers (10 orders/min for the whole restaurant!).
app.set('trust proxy', 1)

// ---------------------------------------------------------------------------
// CORS — one frontend now. Set CLIENT_ORIGINS on Render, e.g.
//   CLIENT_ORIGINS=https://dinepro.vercel.app
// (comma separated; whitespace and trailing slashes are ignored)
// ---------------------------------------------------------------------------
const allowedOrigins = (
  process.env.CLIENT_ORIGINS || 'http://localhost:5173,http://localhost:4173'
)
  .split(',')
  .map((o) => o.trim().replace(/\/+$/, ''))
  .filter(Boolean)

// Optional: also allow Vercel preview deployments of this project
// (ALLOW_VERCEL_PREVIEWS=true, VERCEL_PREVIEW_PREFIX=dinepro-)
const allowPreviews = process.env.ALLOW_VERCEL_PREVIEWS === 'true'
const previewPrefix = process.env.VERCEL_PREVIEW_PREFIX || ''

function isAllowedOrigin(origin) {
  if (!origin) return true // curl, health checks, server-to-server
  const clean = origin.replace(/\/+$/, '')
  if (allowedOrigins.includes(clean)) return true
  if (allowPreviews) {
    try {
      const { hostname, protocol } = new URL(clean)
      return protocol === 'https:' && hostname.endsWith('.vercel.app') && hostname.startsWith(previewPrefix)
    } catch {
      return false
    }
  }
  return false
}

const corsOptions = {
  origin: (origin, cb) => cb(null, isAllowedOrigin(origin)),
  credentials: true,
}

const io = new Server(server, {
  cors: { ...corsOptions, methods: ['GET', 'POST'] },
  // Keep connections alive through Render's proxy and detect dead clients quickly
  pingInterval: 25000,
  pingTimeout: 30000,
})
app.set('io', io)

app.use(cors(corsOptions))

// Middleware
app.use(express.json({ limit: '1mb' }))

// Health check — very cheap, no database access. Point UptimeRobot at /health.
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', uptime: Math.round(process.uptime()) })
})
app.head('/health', (req, res) => res.sendStatus(200))

app.get('/', (req, res) => {
  res.json({ message: 'Restaurant SaaS Backend is Running! 🍽️' })
})

app.use(generalRateLimit)

// Routes
app.use('/api/auth', authRoutes)
app.use('/api/menu', menuRoutes)
app.use('/api/orders', orderRoutes)
app.use('/api/restaurants', restaurantRoutes)
app.use('/api/tables', tableRoutes)
app.use('/api/staff', staffRoutes)
app.use('/api/images', imageRoutes)

// Initialize socket
initOrderSocket(io)

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err)
  res.status(500).json({ success: false, error: 'Internal server error' })
})

// A stray rejected promise must never take the whole server down
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason)
})

// Start server
const PORT = process.env.PORT || 5000
server.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server running on port ${PORT}`)
  console.log(`   Allowed origins: ${allowedOrigins.join(', ')}`)
})

// Render sends SIGTERM on every deploy/restart — finish in-flight work first
function shutdown(signal) {
  console.log(`${signal} received, shutting down…`)
  io.close(() => {
    server.close(() => process.exit(0))
  })
  setTimeout(() => process.exit(0), 10000).unref()
}
process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))
