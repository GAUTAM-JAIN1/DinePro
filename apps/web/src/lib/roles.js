/**
 * Single source of truth for the four staff entry points shown on the
 * "Who are you?" screen. `allows(claims)` is checked against the Firebase
 * custom claims (role / platformAdmin), so picking a card never grants access —
 * the account itself must carry the matching claim.
 */
export const PANELS = {
  chef: {
    id: 'chef',
    label: 'Chef',
    tagline: 'Live kitchen display',
    icon: '🍳',
    path: '/chef',
    accent: '#D4A15A',
    allows: (c) => c.role === 'chef' || c.role === 'admin',
    // Needs a restaurant: a super admin (no restaurant) gets a clear message instead of a dead end
    canLogin: (c) => (c.role === 'chef' || c.role === 'admin') && Boolean(c.restaurantId),
  },
  reception: {
    id: 'reception',
    label: 'Receptionist',
    tagline: 'Billing & table management',
    icon: '🧾',
    path: '/reception',
    accent: '#B88746',
    allows: (c) => c.role === 'receptionist' || c.role === 'admin',
    canLogin: (c) => (c.role === 'receptionist' || c.role === 'admin') && Boolean(c.restaurantId),
  },
  admin: {
    id: 'admin',
    label: 'Admin',
    tagline: 'Menu, tables, staff & settings',
    icon: '🛠️',
    path: '/admin',
    accent: '#F97316',
    // Route guard: restaurant admins AND super admins (who open a restaurant via "Manage")
    allows: (c) => c.role === 'admin' || c.platformAdmin,
    // Admin card: only accounts that belong to a restaurant. Super admins use their own card.
    canLogin: (c) => c.role === 'admin' && Boolean(c.restaurantId) && !c.platformAdmin,
  },
  superadmin: {
    id: 'superadmin',
    label: 'Super Admin',
    tagline: 'Manage all restaurants',
    icon: '👑',
    path: '/admin/super-admin',
    accent: '#EAB308',
    allows: (c) => Boolean(c.platformAdmin),
  },
}

export const PANEL_ORDER = ['chef', 'reception', 'admin', 'superadmin']

/** The panel an account should land on by default, based only on its claims. */
export function defaultPanelFor(claims) {
  if (!claims) return null
  if (claims.platformAdmin) return PANELS.superadmin
  if (claims.role === 'admin') return PANELS.admin
  if (claims.role === 'chef') return PANELS.chef
  if (claims.role === 'receptionist') return PANELS.reception
  return null
}
