const admin = require('firebase-admin')
const serviceAccount = require('./serviceAccountKey.json')

// Bug #29: this used to have a hardcoded UID baked in, no arguments, no
// confirmation. Re-running it later (e.g. copy-pasted as a "how do I make
// someone an admin" reference) would silently re-grant platformAdmin to
// that same old UID instead of the one actually intended — or worse, if the
// hardcoded UID had since been reassigned/reused, hand platform-wide admin
// to the wrong account. UID is now required on the command line, and
// --confirm is required to actually apply the claim.
//
// Usage: node setPlatformAdmin.js <uid> --confirm

const args = process.argv.slice(2)
const confirmed = args.includes('--confirm')
const UID = args.find((a) => a !== '--confirm')

if (!UID) {
  console.error(
    'Usage: node setPlatformAdmin.js <uid> --confirm\n' +
    'Get the uid from Firebase Console → Authentication → Users.'
  )
  process.exit(1)
}

if (!confirmed) {
  console.error(`Dry run: would grant platformAdmin to UID "${UID}". Re-run with --confirm to apply.`)
  process.exit(1)
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
})

async function setPlatformAdmin() {
  try {
    await admin.auth().setCustomUserClaims(UID, {
      role: 'admin',
      platformAdmin: true,
    })
    console.log('✅ platformAdmin claim set successfully for UID:', UID)
    console.log('Now logout and login again in admin panel to refresh token.')
    process.exit(0)
  } catch (err) {
    console.error('❌ Error:', err.message)
    process.exit(1)
  }
}

setPlatformAdmin()
