/**
 * Firebase users ko list / create / reset karne ka helper.
 * backend folder se chalao (backend/.env me Firebase credentials hone chahiye):
 *
 *   node manageUsers.js list
 *   node manageUsers.js password <email> <newPassword>
 *   node manageUsers.js claims   <email> <role> [restaurantId] [--platform]
 *   node manageUsers.js create   <email> <password> <role> [restaurantId] [--platform]
 *
 * role = chef | receptionist | admin
 * --platform = Super Admin (platformAdmin: true)
 */
require('dotenv').config()
const { auth } = require('./src/services/firebaseAdmin')

const [, , cmd, ...rest] = process.argv
const args = rest.filter((a) => !a.startsWith('--'))
const platform = rest.includes('--platform')
const VALID_ROLES = ['chef', 'receptionist', 'admin']

function claimsFor(role, restaurantId) {
  if (!VALID_ROLES.includes(role)) throw new Error(`role must be one of: ${VALID_ROLES.join(', ')}`)
  const claims = { role }
  if (restaurantId) claims.restaurantId = restaurantId
  if (platform) claims.platformAdmin = true
  return claims
}

async function list() {
  let token
  const rows = []
  do {
    const page = await auth.listUsers(1000, token)
    page.users.forEach((u) => {
      const c = u.customClaims || {}
      rows.push({
        email: u.email,
        role: c.role || '-',
        restaurantId: c.restaurantId || '-',
        superAdmin: c.platformAdmin ? 'YES' : '',
        disabled: u.disabled ? 'yes' : '',
        uid: u.uid,
      })
    })
    token = page.pageToken
  } while (token)
  if (!rows.length) return console.log('Firebase me koi user nahi mila.')
  console.table(rows)
}

async function main() {
  if (cmd === 'list') return list()

  if (cmd === 'password') {
    const [email, password] = args
    if (!email || !password) throw new Error('usage: password <email> <newPassword>')
    if (password.length < 6) throw new Error('password kam se kam 6 characters ka ho')
    const u = await auth.getUserByEmail(email)
    await auth.updateUser(u.uid, { password })
    return console.log(`✅ Password badal gaya: ${email}`)
  }

  if (cmd === 'claims') {
    const [email, role, restaurantId] = args
    if (!email || !role) throw new Error('usage: claims <email> <role> [restaurantId] [--platform]')
    const u = await auth.getUserByEmail(email)
    await auth.setCustomUserClaims(u.uid, claimsFor(role, restaurantId))
    return console.log(`✅ Claims set: ${email} ->`, claimsFor(role, restaurantId), '\nAb us account se logout karke dobara login karo.')
  }

  if (cmd === 'create') {
    const [email, password, role, restaurantId] = args
    if (!email || !password || !role) throw new Error('usage: create <email> <password> <role> [restaurantId] [--platform]')
    const u = await auth.createUser({ email, password, emailVerified: true })
    await auth.setCustomUserClaims(u.uid, claimsFor(role, restaurantId))
    return console.log(`✅ User ban gaya: ${email} (${role}${platform ? ', SUPER ADMIN' : ''})`)
  }

  console.log('Commands: list | password | claims | create  (file ke upar usage dekho)')
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌', err.message)
    process.exit(1)
  })
