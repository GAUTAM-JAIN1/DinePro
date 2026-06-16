const admin = require('firebase-admin')
const serviceAccount = require('./serviceAccountKey.json')

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
})

const UID = 'rEa8z15MTvVQSTfxNAerAFiWpIH3'

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