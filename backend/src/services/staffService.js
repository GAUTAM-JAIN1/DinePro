const { db, auth } = require('./firebaseAdmin')

const staffCol = (restaurantId) =>
  db.collection('restaurants').doc(restaurantId).collection('staff')

async function createStaff(restaurantId, { email, name, role }) {
  if (!email || !name || !role) {
    throw new Error('email, name, and role are required')
  }

  const validRoles = ['admin', 'chef', 'receptionist']
  if (!validRoles.includes(role)) {
    throw new Error(`role must be one of: ${validRoles.join(', ')}`)
  }

  // Generate a temp password
  const tempPassword = `Digital@${Math.floor(1000 + Math.random() * 9000)}`

  let userRecord
  try {
    // Check if user already exists
    userRecord = await auth.getUserByEmail(email)
  } catch (err) {
    if (err.code === 'auth/user-not-found') {
      // Create new Firebase Auth user
      userRecord = await auth.createUser({
        email,
        password: tempPassword,
        displayName: name,
      })
    } else {
      throw err
    }
  }

  // Set custom claims
  await auth.setCustomUserClaims(userRecord.uid, {
    role,
    restaurantId,
  })

  // Save to Firestore
  const now = new Date().toISOString()
  const staffData = {
    uid: userRecord.uid,
    email,
    name,
    role,
    restaurantId,
    isActive: true,
    createdAt: now,
  }

  await staffCol(restaurantId).doc(userRecord.uid).set(staffData)

  return { ...staffData, tempPassword }
}

async function listStaff(restaurantId) {
  const snap = await staffCol(restaurantId).orderBy('createdAt', 'desc').get()
  return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
}

async function getStaff(restaurantId, uid) {
  const doc = await staffCol(restaurantId).doc(uid).get()
  if (!doc.exists) throw new Error('Staff member not found')
  return { id: doc.id, ...doc.data() }
}

async function toggleStaff(restaurantId, uid) {
  const ref = staffCol(restaurantId).doc(uid)
  const doc = await ref.get()

  if (!doc.exists) throw new Error('Staff member not found')

  const current = doc.data()
  const newStatus = !current.isActive

  await ref.update({ isActive: newStatus })

  // Update custom claims — if deactivating, remove restaurantId claim
  if (!newStatus) {
    await auth.setCustomUserClaims(uid, {
      role: current.role,
      restaurantId: null,
      disabled: true,
    })
  } else {
    await auth.setCustomUserClaims(uid, {
      role: current.role,
      restaurantId,
    })
  }

  return { ...current, isActive: newStatus }
}

module.exports = { createStaff, listStaff, getStaff, toggleStaff }
