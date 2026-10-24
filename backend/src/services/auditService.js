// Audit trail for money and configuration changes (Bug #77).
//
// Every entry lives in restaurants/{id}/auditLogs and records who did it
// (uid, email, role), what they did, and the before/after values. The
// collection is written only through the Admin SDK; Firestore rules deny
// all client access to it.
//
// Retention: not set yet (open decision in the bug list). Entries are kept
// until a TTL policy is configured on auditLogs.at.

const { db } = require('./firebaseAdmin')

const auditCol = (restaurantId) =>
  db.collection('restaurants').doc(restaurantId).collection('auditLogs')

/** Builds the actor block from a verified Firebase token (REST req.user or socket.data.user). */
function actorFromUser(user) {
  if (!user) return { uid: null, email: null, role: 'anonymous' }
  const isPlatformAdmin = user.role === 'superadmin' || user.platformAdmin === true || user.superAdmin === true
  return {
    uid: user.uid || null,
    email: user.email || null,
    role: isPlatformAdmin ? 'superadmin' : user.role || 'unknown',
  }
}

function buildAuditEntry({ actor, action, before = null, after = null, meta = {} }) {
  return {
    actor: actor || { uid: null, email: null, role: 'system' },
    action,
    before,
    after,
    meta,
    at: new Date().toISOString(),
  }
}

/** Use inside a Firestore transaction so the audit row commits with the change. */
function writeAuditInTransaction(tx, restaurantId, entry) {
  tx.set(auditCol(restaurantId).doc(), buildAuditEntry(entry))
}

/** Use after a non-transactional write. Logs and continues if the audit write fails. */
async function writeAudit(restaurantId, entry) {
  try {
    await auditCol(restaurantId).add(buildAuditEntry(entry))
  } catch (err) {
    console.error('audit write failed:', entry.action, err.message)
  }
}

module.exports = { actorFromUser, buildAuditEntry, writeAuditInTransaction, writeAudit, auditCol }
