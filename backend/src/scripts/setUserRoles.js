/**
 * Create Firebase Auth users and set custom claims (roles)
 * Run once: node src/scripts/setUserRoles.js
 */
require('dotenv').config()
const { auth } = require('../services/firebaseAdmin')

const USERS = [
  { email: 'admin@tadkajunction.com', password: 'Admin@123', role: 'admin', restaurantId: 'rest_001' },
  { email: 'chef@tadkajunction.com', password: 'Chef@123', role: 'chef', restaurantId: 'rest_001' },
  { email: 'receptionist@tadkajunction.com', password: 'Recep@123', role: 'receptionist', restaurantId: 'rest_001' },
]

async function setupUsers() {
  console.log('🔐 Setting up Firebase Auth users...\n')

  for (const userData of USERS) {
    try {
      // Try to get existing user first
      let user
      try {
        user = await auth.getUserByEmail(userData.email)
        console.log(`  ✅ User exists: ${userData.email} (uid: ${user.uid})`)
      } catch (err) {
        // User doesn't exist, create new
        user = await auth.createUser({
          email: userData.email,
          password: userData.password,
          displayName: userData.role.charAt(0).toUpperCase() + userData.role.slice(1),
        })
        console.log(`  ✅ Created user: ${userData.email} (uid: ${user.uid})`)
      }

      // Set custom claims (role + restaurantId)
      await auth.setCustomUserClaims(user.uid, {
        role: userData.role,
        restaurantId: userData.restaurantId,
      })
      console.log(`     → Role set: ${userData.role}, Restaurant: ${userData.restaurantId}`)

    } catch (error) {
      console.error(`  ❌ Error with ${userData.email}:`, error.message)
    }
  }

  console.log('\n🎉 Done! Users are ready.\n')
  console.log('Login credentials:')
  console.log('─────────────────────────────────────────')
  USERS.forEach(u => {
    console.log(`  ${u.role.padEnd(14)} → ${u.email} / ${u.password}`)
  })
  console.log('─────────────────────────────────────────')
  process.exit(0)
}

setupUsers()
