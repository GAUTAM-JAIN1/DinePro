const { auth } = require('../services/firebaseAdmin')

/**
 * Verify Firebase JWT token from Authorization header.
 *
 * Bug #12: `checkRevoked` makes Firebase reject tokens whose refresh tokens were
 * revoked and accounts that were disabled. Without it a deactivated staff member
 * kept working until their one-hour ID token expired.
 */
async function verifyToken(req, res, next) {
  const token = req.headers.authorization?.split('Bearer ')[1]

  if (!token) {
    return res.status(401).json({ success: false, error: 'No token provided' })
  }

  try {
    req.user = await auth.verifyIdToken(token, true)
    next()
  } catch (error) {
    res.status(401).json({ success: false, error: 'Session expired. Please sign in again.' })
  }
}

/**
 * Check if user has one of the required roles (use AFTER verifyToken)
 * Usage: requireRole('admin') or requireRole('admin', 'chef')
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ success: false, error: 'Insufficient permissions' })
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
    return res.status(403).json({ success: false, error: 'Platform admin access required' })
  }

  next()
}

module.exports = { verifyToken, requireRole, requirePlatformAdmin }
