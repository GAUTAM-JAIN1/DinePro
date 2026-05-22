const { auth } = require('../services/firebaseAdmin')

/**
 * Verify Firebase JWT token from Authorization header
 */
async function verifyToken(req, res, next) {
  try {
    const token = req.headers.authorization?.split('Bearer ')[1]

    if (!token) {
      return res.status(401).json({ error: 'No token provided' })
    }

    const decodedToken = await auth.verifyIdToken(token)
    req.user = decodedToken
    next()
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' })
  }
}

/**
 * Check if user has one of the required roles (use AFTER verifyToken)
 * Usage: requireRole('admin') or requireRole('admin', 'chef')
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' })
    }
    next()
  }
}

function requirePlatformAdmin(req, res, next) {
  const isPlatformAdmin =
    req.user?.platformAdmin === true ||
    req.user?.superAdmin === true ||
    req.user?.role === 'superadmin'

  if (!isPlatformAdmin) {
    return res.status(403).json({ error: 'Platform admin access required' })
  }

  next()
}

module.exports = { verifyToken, requireRole, requirePlatformAdmin }
