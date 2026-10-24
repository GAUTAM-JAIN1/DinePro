# DinePro — Phase 2 (Auth lifecycle and abuse) — Fix Notes

Source: Master Bug List (Fix Order), Phase 2. Phase 0 and Phase 1 are assumed applied (this drop is built on the Phase 1 zip).

Phase 2 is about making sure access ends when it should, that a request can only touch its own restaurant, that accounts are created in one safe way, and that inputs and errors can't be used to probe or flood the system.

Verification key: **V** = covered by an automated test here · **C** = code review only · **U** = needs a real Firebase / Render / browser check (see the end).

---

## 1. #18 — Tenant check failed open (V)
- `middleware/restaurantAccess.js`: a request with no restaurantId anywhere now gets 403. Params, body and query must agree if more than one is present (403 on mismatch). Platform admins may act on any restaurant but must still name one.
- Tests: `test/phase2.test.js` (missing id, mismatch, cross-tenant, own restaurant, platform admin).

## 2. #12 — Deactivated staff keep access (V for the Firebase calls, C for live behaviour)
- `middleware/auth.js`: `verifyIdToken(token, true)` so disabled accounts and revoked sessions fail on every request. The 401 message is now "Session expired. Please sign in again."
- `services/staffService.js` `toggleStaff`: deactivating disables the Firebase account, revokes refresh tokens, and sets the restaurant claim to null. Reactivating reverses all three. Legacy staff docs with no `isActive` count as active.
- `socket/orderSocket.js`: a staff socket's identity is re-read from Firebase at most every 10 s when an event arrives, and by a background sweep every 60 s. A disabled account gets `session_ended` and the socket is disconnected.
- Tests: deactivate / reactivate sequence and the Firebase call order (fake Auth). Real revocation and socket behaviour need a live project (U).

## 3. #26 — Two staff-creation paths (V)
- `restaurantService.createStaffAccount` is removed. The restaurant admin route and the Super Admin route both call `staffService.createStaff`, so the rules are the same: new accounts only, role-checked, `isActive: true`, `name` saved, claims set.
- If the staff document write fails, the new Firebase account is deleted so no half-built account is left behind.
- Tests: an existing email is rejected and its claims are not touched (cross-tenant takeover check).

## 4. #25 — Weak temp password shown in a toast (V for the server, C for the UI)
- `Math.random` password (`Digital@NNNN`) is gone. The account is created without a password, and the person sets their own through a setup link from Firebase.
- Responses carry `setupLink` (or `setupLinkError` if Firebase could not create one). The admin sees the link once, in `SetupLinkDialog`, which has a copy button. It is never put in a toast.
- New endpoint `POST /api/staff/:restaurantId/:uid/setup-link` to issue a fresh link. The staff list has a "Setup link" button.
- Tests: no password is generated or stored, and the response carries a link.

## 5. #54 — Restaurant owner has no login (C)
- `POST /api/restaurants` with `ownerEmail` now also creates an `admin` account for the owner and returns `owner` with a setup link. If that step fails the restaurant is still created and the reason comes back in `ownerError`, so nothing is lost.
- The Super Admin staff form has an "Admin (owner)" role option.
- Not run through HTTP in tests (U).

## 6. #80 — Socket event flood (V for the limiter, C for wiring)
- `utils/windowLimiter.js`: sliding-window counter. Each staff/join event has a per-socket limit and a per-IP limit (four times looser, because staff tablets and customer phones often share one NAT address).
- Over the limit: `rate_limited { event }`.
- `join_restaurant` reads the restaurant document through a 15 s cache (`isServiceEnabled`), so a burst of events doesn't read Firestore every time.
- Tests: window behaviour, and that the per-socket limit blocks while the per-IP limit still allows other sockets.

## 7. #22 — Customer order limit shared by NAT IP (V for the key, C for the integration)
- `middleware/rateLimit.js`: the 10-per-minute order limit is keyed by restaurant + table. The IP is only the fallback.
- A separate 60-per-minute per-IP ceiling (`orderIpRateLimit`) still stops one client from flooding many tables.
- `server.js` already sets `trust proxy`, so the IP fallback reads the client address on Render.

## 8. #37 — Subscription checked on some mutations only (C)
- `requireActiveSubscription` now also guards: menu toggle, menu reorder, staff create / toggle / setup-link, restaurant settings update (`PUT /api/restaurants/:id`), and the socket `cancel_order` event.
- Already guarded before: menu create/update/delete, tables, orders, close_bill and the other kitchen events.
- **Decision to confirm:** an expired restaurant can no longer save settings. Super Admin routes are not gated, so an owner can still be fixed.
- **Not gated yet:** `POST /api/images/upload`. It takes restaurantId from the token, not from the request, so the existing middleware doesn't fit. Small follow-up.

## 9. #19 — Input bounds (V)
- Prices must be finite and at most 100 000 (`Infinity` strings are rejected). Variant prices use the same cap.
- Order item quantity: whole number from 1 to 50.
- Menu list sizes: at most 20 variants per item, 500 items in a reorder.
- `sortOrder` capped at 100 000.

## 10. #60 — Text lengths (V for chef message and menu / staff fields, C for the rest)
- Order note 240 and cancel reason 200 (Phase 1 already had these; the socket path uses the same limits).
- Chef message 1–240 characters, required.
- Menu name 120, descriptions 1000, categories 60. Restaurant name 120, address 300, phone 30. Staff name 100, email 254.

## 11. #61 — Image URLs (V)
- `imageUrl` (menu) and `logoUrl` (restaurant) must be `https://` links on an allowed host. The default allowed host is `res.cloudinary.com`, where uploads land.
- Extra hosts can be added with the optional env var `ALLOWED_IMAGE_HOSTS` (comma separated).
- Empty string (no image) is still allowed.
- URLs with credentials, `javascript:` and `http:` are rejected.

## 12. #20 — Item status accepted any string (V)
- `item_status` payload is validated: `status` must be `preparing`, `ready` or `served`. `itemKey` and `orderId` are required and length-limited.
- `order_preparing` and `order_ready` validate `restaurantId` and `id`.

## 13. #24 — Internal errors leaked to clients (V for the helper, C for the sweep)
- `utils/httpErrors.js` `sendError`: 4xx keep their message (and any `extra` fields such as `code`). 5xx are logged in full on the server and answered with `Something went wrong. Please try again.`
- All 38 response sites in routes and the global error handler now use it. Malformed JSON bodies still get a 400 with the parser message.
- Plain service errors that users can hit (menu item not found, restaurant not found, staff not found) are now `HttpError` with the right status.
- Zod validation details now show real messages. Before, they fell back to "Validation failed" because zod v4 uses `issues`, not `errors`.
- Tests: a 500 never shows its internal text, a 4xx does, and a duplicate auth email maps to 409.

## 14. #72 — Login error hints in production (C)
- `pages/Login.jsx`: setup hints (which `.env` to check, Firebase Console pages) only appear in development. Production shows "Sign-in is unavailable right now" for configuration errors and "Sign-in failed" otherwise.

## 15. #62 — No 401 handling in the API client (C)
- `lib/api.js` response interceptor: the first 401 refreshes the ID token and retries that request once. If it still fails, the user is signed out and sent to `/`.

---

## REST contract changes
- `POST /api/staff/:restaurantId`: body is `{ email, name, role }`. Response `staff` has `setupLink` (or `setupLinkError`) instead of `tempPassword`.
- `POST /api/staff/:restaurantId/:uid/setup-link` (new): `{ email, setupLink }`.
- `PATCH /api/staff/:restaurantId/:uid/toggle`: returns 400 `SELF_DEACTIVATE` when you try to deactivate yourself.
- `POST /api/restaurants`: response adds `owner` and `ownerError`.
- `POST /api/restaurants/:restaurantId/staff` (Super Admin): body is `{ email, name?, role }`. `password` is ignored. `role` may be `admin`.
- `PUT /api/restaurants/:restaurantId`: returns 402 when the subscription is inactive.
- Menu toggle and reorder return 402 when the subscription is inactive.
- Any 5xx now has the generic message. Code that showed the server message for 500s will show the generic line.
- Order placement: 10 per minute per table, 60 per minute per IP.

## Socket contract changes
- New server events: `rate_limited { event }`, `session_ended { reason }`, `unauthorized { event, restaurantId }`.
- `item_status` rejects any status other than `preparing`, `ready`, `served`.
- `cancel_order` returns `subscription_blocked` when the subscription is inactive.
- Staff sockets are disconnected when their account is disabled or removed. They can reconnect, but only as anonymous customers unless they have a valid token.

---

## Before you deploy
1. `cd backend && npm install`. No new packages in Phase 2 (only the `test` script changed).
2. `cd backend && npm test`. Expect 57 passing (31 from Phase 1, 26 new).
3. `cd apps/web && npm install && npm run build`. The build passes in this drop.
4. Deploy the backend to Render first, then the web app to Vercel. The web app's staff screens expect the new response shapes (`setupLink`, `owner`).
5. Staging check, in this order:
   - Restaurant admin adds a chef. The dialog shows a link. Open it in a private window, set a password, sign in as the chef.
   - Admin deactivates the chef. The chef's next action fails and their kitchen screen stops receiving events within about a minute. Reactivate; sign-in works again.
   - Admin tries to deactivate themselves: refused.
   - Super Admin adds a restaurant with an owner email. The owner dialog appears. The owner can sign in as admin.
   - An expired restaurant can't save settings, menu toggles or staff changes.
   - A menu image with `http://` or a non-Cloudinary host is refused.
6. If you use other image hosts, set `ALLOWED_IMAGE_HOSTS` on Render.

## Still unverified (flagged U)
- Live Firebase: `disabled` and `revokeRefreshTokens` take effect for an open session; the cost of `verifyIdToken(token, true)` on every request on Render.
- Setup link: the email/landing page, and how long the link stays valid. Firebase sets the expiry, not this code. Re-issuing a link is always possible from the staff list.
- Socket: `session_ended` and the 60-second sweep against a real deactivated account. The staff screens don't show a message when this happens yet.
- Rate limits behind Render's proxy: confirm that `req.ip` is the customer's address and that two customers at one table share one budget.
- Browser behaviour: the setup dialog, copy button, 401 retry and sign-out redirect.
- Firestore rules and indexes from Phase 0 are unchanged here. The emulator test is still open.

## Open decisions (taken; change if you disagree)
- **Settings and subscription:** expired restaurants can't save settings (item 8).
- **Socket suspension delay:** up to 15 s for a suspended restaurant to stop accepting staff events (item 6).
- **Setup link landing:** the link opens Firebase's hosted password page. If you want the person sent back to the DinePro panel afterwards, pass `ActionCodeSettings` with a `continueUrl` in `generatePasswordResetLink`. Not done here.
- **Customer order limit:** 10 per minute per table, 60 per minute per IP (item 7).

## Files touched
Backend:
- `src/middleware/auth.js`, `restaurantAccess.js`, `subscription.js`, `rateLimit.js`, `validators/index.js`
- `src/services/staffService.js` (rewritten), `restaurantService.js` (duplicate path removed), `menuService.js` (HttpError)
- `src/routes/staff.js` (rewritten), `restaurants.js` (rewritten), `menu.js`, `tables.js`, `orders.js`, `images.js`
- `src/socket/orderSocket.js` (rewritten)
- `src/server.js` (global error handler)
- `src/utils/httpErrors.js` (new), `utils/windowLimiter.js` (new), `utils/imageUrl.js` (new)
- `test/phase2.test.js` (new), `test/support/fakeFirestore.js` (doc-level set / update / delete)
- `package.json` (test script)

Frontend (apps/web):
- `src/lib/api.js` (401 handling)
- `src/components/SetupLinkDialog.jsx` (new)
- `src/pages/Login.jsx` (dev-only hints)
- `src/panels/admin/pages/StaffManagement.jsx` (setup link, admin role, resend)
- `src/panels/admin/pages/SuperAdmin.jsx` (no password, owner invite, admin role)

Docs: `docs/api.md` (staff, restaurant and socket sections), `PHASE_2_NOTES.md` (this file).

## Next up
**Phase 3 — Data correctness and UX** (23 bugs): #66 kitchen alert sound after restore, #49 ready items going back to preparing, #50 hidden items marked ready, #23 optimistic UI without ack, #52 Firestore IDs shown to customers, #13 menu edit wipes fields, #14 timezone day key, #48 report date and paise, #15 two revenue definitions, #46 reset revenue, #17 full-scan daily stats, #78 report loads every order, #47 dashboard shows zero on error, #64 subscription banner unknown, #65 table count capped at 10, #70 starter menu sent live, #55 setup wizard not idempotent, #56 setup wizard hides errors, #57 table delete orphans open orders, #58 restaurant delete loses history, #34 table string sort, #33 colour field mismatch, #76 empty number becomes 0.
