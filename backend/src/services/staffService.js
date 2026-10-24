const { db, auth } = require('./firebaseAdmin')
const { HttpError } = require('./billing')

/**
 * One creation path for every staff account (Bug #26). The restaurant admin
 * route and the platform admin route both call createStaff, so the rules are
 * the same: new accounts only, role-checked, isActive set, claims set, and an
 * audit-friendly staff document.
 *
 * No password is generated or returned (Bug #25). The account is created
 * without one and the person sets their own through a setup link.
 */

const STAFF_ROLES = ['admin', 'chef', 'receptionist']

const staffCol = (restaurantId) =>
  db.collection('restaurants').doc(restaurantId).collection('staff')

async function generateSetupLink(email) {
  try {
    return { setupLink: await auth.generatePasswordResetLink(email), setupLinkError: null }
  } catch (err) {
    console.error('setup link generation failed:', err.code || err.message)
    return { setupLink: null, setupLinkError: 'Setup link could not be created. Use "Send setup link" to try again.' }
  }
}

async function createStaff(restaurantId, { email, name, role }, { restaurantName = '' } = {}) {
  if (!email || !role) {
    throw new HttpError(400, 'email and role are required', { code: 'STAFF_INVALID' })
  }
  if (!STAFF_ROLES.includes(role)) {
    throw new HttpError(400, `role must be one of: ${STAFF_ROLES.join(', ')}`, { code: 'STAFF_INVALID' })
  }

  // Bug #4: an existing Firebase account (another restaurant's staff, or a
  // platform admin) must never be reused or have its claims overwritten.
  let existing = null
  try {
    existing = await auth.getUserByEmail(email)
  } catch (err) {
    if (err.code !== 'auth/user-not-found') throw err
  }
  if (existing) {
    throw new HttpError(409, 'A user with this email already exists', { code: 'EMAIL_IN_USE' })
  }

  const displayName = (name || '').trim() || `${role} - ${restaurantName || restaurantId}`
  const userRecord = await auth.createUser({ email, displayName })
  const uid = userRecord.uid

  try {
    await auth.setCustomUserClaims(uid, { role, restaurantId })

    const staffData = {
      uid,
      email,
      name: displayName,
      role,
      restaurantId,
      isActive: true,
      createdAt: new Date().toISOString(),
    }
    await staffCol(restaurantId).doc(uid).set(staffData)

    const link = await generateSetupLink(email)
    return { ...staffData, ...link }
  } catch (err) {
    // Don't leave a half-built account behind that nobody can sign in to.
    await auth.deleteUser(uid).catch(() => {})
    throw err
  }
}

/** Fresh setup link for an existing staff member of this restaurant. */
async function createSetupLink(restaurantId, uid) {
  const doc = await staffCol(restaurantId).doc(uid).get()
  if (!doc.exists) throw new HttpError(404, 'Staff member not found', { code: 'STAFF_NOT_FOUND' })
  const { email } = doc.data()
  const link = await generateSetupLink(email)
  if (!link.setupLink) throw new HttpError(502, link.setupLinkError, { code: 'SETUP_LINK_FAILED' })
  return { email, setupLink: link.setupLink }
}

async function listStaff(restaurantId) {
  const snap = await staffCol(restaurantId).orderBy('createdAt', 'desc').get()
  return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
}

async function getStaff(restaurantId, uid) {
  const doc = await staffCol(restaurantId).doc(uid).get()
  if (!doc.exists) throw new HttpError(404, 'Staff member not found', { code: 'STAFF_NOT_FOUND' })
  return { id: doc.id, ...doc.data() }
}

/**
 * Bug #12: deactivating must actually cut access. The Firebase account is
 * disabled, refresh tokens are revoked (so existing ID tokens stop passing
 * verifyIdToken(token, true) and sockets re-check on their next event), and
 * the restaurant claim is removed. Reactivating reverses all three.
 */
async function toggleStaff(restaurantId, uid, { actorUid = null } = {}) {
  const ref = staffCol(restaurantId).doc(uid)
  const doc = await ref.get()
  if (!doc.exists) throw new HttpError(404, 'Staff member not found', { code: 'STAFF_NOT_FOUND' })

  const current = doc.data()
  // Legacy staff docs (created before isActive existed) count as active.
  const currentlyActive = current.isActive !== false
  const nextActive = !currentlyActive

  if (!nextActive && actorUid && actorUid === uid) {
    throw new HttpError(400, 'You cannot deactivate your own account', { code: 'SELF_DEACTIVATE' })
  }

  await auth.updateUser(uid, { disabled: !nextActive })
  if (!nextActive) {
    await auth.revokeRefreshTokens(uid)
  }
  await auth.setCustomUserClaims(uid, {
    role: current.role,
    restaurantId: nextActive ? restaurantId : null,
  })
  await ref.update({ isActive: nextActive })

  return { ...current, isActive: nextActive }
}

module.exports = { createStaff, createSetupLink, listStaff, getStaff, toggleStaff, STAFF_ROLES }
