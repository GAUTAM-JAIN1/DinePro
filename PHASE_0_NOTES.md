# DinePro — Phase 0 (Containment) — Fix Notes

Audit date: 22 Oct 2026 · Applied: 23 Oct 2026

All 10 Phase 0 bugs from the Master Bug List are fixed in this drop. Order
below matches the audit's fix order.

## 1. #83 — Missing Firestore composite indexes
- Added `firebase/firestore.indexes.json` (orders: tableId+status,
  status+createdAt, status+closedAt, tableNumber+status; menu:
  isAvailable+sortOrder).
- Added `firebase.json` at repo root so `firebase deploy --only firestore`
  picks up both the rules and the indexes file.
- **Action needed from you:** run this deploy against your Firestore
  project *before* pointing the app at it. Index builds take a few minutes
  on a fresh project; until they finish, the queries that need them 500.

## 2. #2 — Anonymous room join leaked live restaurant data
- `orderSocket.js`: split the single `restaurantId` Socket.IO room into a
  staff room (`staff:{restaurantId}`) and per-table customer rooms
  (`table:{restaurantId}:{tableId}`).
- `join_restaurant` now requires a verified staff token scoped to that
  restaurant (or platform admin) — anonymous sockets are refused.
- New `join_table` event for customers: validates the table exists and is
  active, then joins only that table's room. Customers never receive
  `order_received`, `order_updated`, `bill_update` or `stats_update`
  anymore (those stay staff-only); they still get `status_changed`,
  `chef_message_received` and `bill_closed` for their own order.
- Updated `OrderConfirmed.jsx` (apps/web) to emit `join_table` instead of
  `join_restaurant`.
- `closeBill` (orderService) now returns `tableIds` so the socket layer can
  notify the right customer room directly instead of guessing.

## 3. #3 — Subscription self-grant via `.passthrough()`
- `restaurantUpdate` validator is now a closed whitelist (`.strict()`
  instead of `.passthrough()`). Subscription fields were never in the
  whitelist, so this was the actual fix — passthrough just let unlisted
  fields ride along silently.

## 4. #4 — `createStaff` could hijack an existing account
- `staffService.createStaff` now rejects if the email already belongs to
  any Firebase Auth user (previously it silently reused the account and
  overwrote its custom claims — including a platform admin's, or another
  restaurant's staff). Only brand-new accounts can be created here.

## 5. #10 — `PUT /api/orders/:id` accepted a raw body
- New `orderStatusUpdate` validator: `{ status: 'preparing'|'ready'|'served' }`
  only. totalAmount/items/settledAmount/closedAt etc. can no longer be set
  through this endpoint — settlement and cancellation already have their
  own dedicated, server-authoritative paths.

## 6. #5 — Firestore rules allowed full-document writes
- `restaurants/{id}`: update is now field-whitelisted (name, address, phone,
  brandColor, logoUrl, defaultGstPercent, defaultServiceCharge,
  onboardingCompleted/At, statsResetAt) — subscription fields are excluded,
  closing the same hole as #3 at the database layer. Create is denied
  (backend-only via Admin SDK).
- `orders/{id}`: create/update denied for direct client writes — the
  backend's Admin SDK always bypasses rules, and nothing in the frontend
  writes Firestore directly (only Firebase Auth is used client-side), so
  this is pure defense-in-depth against a stolen staff token being used
  directly against the Firestore REST API.
- **Known limitation, flagged in the file:** Firestore rules can't filter
  *which fields* come back on a document read — `restaurants/{id}` is still
  fully public-readable, so anyone with a restaurantId can see raw
  subscription status/dates via direct Firestore access (not via the app,
  which already strips this — see routes/restaurants.js). Closing this
  fully means moving subscription data to a private subcollection, which
  touches subscriptionService and every reader of it. Deferred to avoid
  colliding with Phase 1's subscription fixes (#27, #67, #69) — flag if you
  want it done now instead.
- Unverified against a real Firebase emulator (matches the audit's "U"
  status) — please test before relying on these rules alone.

## 7. #16 — Image upload: tenant trust + no rate limit + spoofable mimetype
- `restaurantId` now comes from the verified token for everyone except
  platform admins (who may legitimately pass it explicitly).
- `uploadRateLimit` (20/hour/IP) is now actually applied to the route.
- Added a real magic-bytes check (JPEG/PNG/GIF/WEBP signatures) instead of
  trusting the client's `Content-Type`.
- SVG is rejected outright (can carry `<script>`, served back from our own
  Cloudinary domain).

## 8. #21 — Waiter-call spoofing / unthrottled
- `call_waiter` now validates the table exists and is active (via
  `tableService.getTableByIdentifier`) before broadcasting.
- Added a per-IP+restaurant+table cooldown (10s) alongside the existing
  per-socket cooldown — the per-socket one alone resets on every reconnect,
  so it didn't actually stop a determined spammer.

## 9. #29 — Destructive scripts, no confirmation
- `clearOrders.js`: requires explicit restaurant id(s) or `--all`, and
  `--confirm` to actually delete anything (dry-run / count-only otherwise).
- `setPlatformAdmin.js`: UID is now a required CLI argument (was
  hardcoded), plus `--confirm`.
  New usage: `node setPlatformAdmin.js <uid> --confirm`

## 10. #79 — Missing security headers
- Added `helmet` (CSP locked to `default-src 'none'` — this is a JSON-only
  API, nothing is rendered — plus HSTS, X-Content-Type-Options,
  X-Frame-Options, X-Powered-By removal). CORS was already fine and is
  unchanged.

---

### Files touched
- `backend/src/socket/orderSocket.js`
- `backend/src/services/orderService.js` (closeBill → tableIds)
- `backend/src/services/staffService.js`
- `backend/src/routes/orders.js`
- `backend/src/routes/staff.js`
- `backend/src/routes/images.js`
- `backend/src/middleware/validators/index.js`
- `backend/src/server.js`
- `backend/package.json` / `package-lock.json` (added `helmet`)
- `backend/clearOrders.js`
- `backend/setPlatformAdmin.js`
- `firebase/firestore.rules`
- `firebase/firestore.indexes.json` (new)
- `firebase.json` (new)
- `docs/deployment.md`
- `apps/web/src/panels/customer/pages/OrderConfirmed.jsx`

### Before you deploy
1. `cd backend && npm install` (picks up `helmet`).
2. `firebase deploy --only firestore,storage` — rules **and** indexes,
   before pointing at a fresh Firestore project.
3. Re-test the customer order-tracking screen (OrderConfirmed) end to end —
   the socket room it joins changed from `join_restaurant` to `join_table`.
4. `setPlatformAdmin.js` and `clearOrders.js` now need an extra `--confirm`
   flag — update any saved runbooks/aliases.

Next up: **Phase 1 — Money integrity** (13 bugs: client price trust,
transactions/race conditions, settlement authority, subscription billing).
