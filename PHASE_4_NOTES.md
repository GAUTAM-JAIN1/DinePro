# DinePro — Phase 4 (Cleanup and ops) — Fix Notes

Source: Master Bug List (Fix Order), Phase 4. Built on the Phase 3 drop.

Phase 4 removes code nothing uses, makes the remaining duplicates single-source, closes two listener and timer leaks, and makes deploys and the seed script safe. Nothing here changes what a user can do, except the staff-removal confirmation and the seed refusal.

Verification key: **V** = covered by an automated test · **C** = code review and build only · **U** = needs a browser or live Render check.

---

## 1. #30 — Dead and risky backend code (C)
- Removed `backend/src/middleware/tenantResolver.js`. It trusted a header for the tenant, and nothing imported it.
- Removed `backend/src/services/orderStore.js`. Nothing imported it.
- Removed the duplicate `POST /api/menu` route (no restaurant id in the path). The app uses `POST /api/menu/:restaurantId`, and the old route had its own inline 400 error.

## 2. #31 — Legacy app folders (C)
- Removed `apps/admin-panel`, `apps/chef-panel`, `apps/customer-app`, `apps/receptionist-panel`. `apps/web` is the live app, and nothing referenced the old folders.

## 3. #32 — Misplaced env example (C)
- Removed `backend/src/.env.example`, which was a copy of `package.json`. The real example is `backend/.env.example`.

## 4. #73 — Dead hooks and components (C)
- Removed `useMenuAdmin.js` (no auth, relative URLs, wrong routes), `useRestaurant.js`, `ImageUploader.jsx`, `CartDrawer.jsx`, `QuantityControl.jsx`. Each was imported only by its own file.

## 5. #63 — Menu code duplicated between MenuManager and Super Admin (C)
- Super Admin's `MenuPanel` (about 450 lines, a copy of `MenuManager`) is gone. Super Admin renders the shared `MenuManager` for a restaurant.
- Behaviour change: the copy had slightly different filters. Super Admin now gets the same menu tools as the restaurant admin, including variants and image upload.

## 6. #59 — `socket.off('disconnect')` removed every listener (C)
- The singleton socket is shared by the app. `useBilling` and `OrderConfirmed` used to call `socket.off(event)` with no handler, which removed every listener for that event.
- Now each effect records the handlers it registers (`listen(event, handler)`), and cleanup removes only those. The kitchen hook already did this.

## 7. #74 — Timers not cleaned up (C)
- `OrderTicket`: the "message sent" flash timer is cleared on unmount and on a new send.
- `useBilling`: the 30-second waiter-banner timers are cleared on unmount.
- `OrderConfirmed`: its timers were already cleared; no change needed.

## 8. #71 — Super Admin staff removal had no confirmation (C)
- Removing a staff account asks first. Deletion is permanent.

## 9. #36 — Storage rules allowed SVG and nothing used them (C)
- Uploads go through `/api/images` to Cloudinary. Firebase Storage was not used anywhere in `apps/web/src` (checked before removal).
- Removed `firebase/storage.rules` and the `storage` entry in `firebase.json`.

## 10. #35 — Dead subscription check in the customer hooks (C)
- `useTable` and `useMenu` checked `restaurant.subscription.isServiceEnabled`, but the public restaurant response never includes `subscription`. The check could never fire.
- Removed from both. The 402 response from the table and menu endpoints still shows "unavailable", and both hooks handle it.

## 11. #81 — Seed script can overwrite production (V for nothing, C for the guard)
- `scripts/seedDevData.js` refuses to run when `NODE_ENV=production` unless `ALLOW_SEED=yes` is set.
- Its restaurant document used the old `themeColor` field; it now writes `brandColor`.

## 12. #82 — Render operations (C, U for the live behaviour)
- Already in place before this phase: `/health`, `trust proxy`, SIGTERM and SIGINT handling that closes sockets and the HTTP server, with a 10-second force exit.
- Added: `/health` returns 503 while draining, so Render stops sending new traffic to the instance during a deploy. Idle keep-alive connections are closed on shutdown.
- **Not changed:** the HTTP rate limits are kept in memory per instance. That is fine on one instance. Scaling out needs a shared store (Redis, or Firestore counters). Free-tier cold starts can't be fixed in code; pinging `/health` every few minutes (UptimeRobot, already noted in `server.js`) keeps it warm.

## 13. #39 — Docs say Render or Railway (resolved)
- `render.yaml`, `docs/deployment.md`, `docs/onboarding.md` and `README.md` all say Render. Nothing in the repo mentions Railway.

---

## Before you deploy
1. `cd backend && npm install`. No new packages.
2. `cd backend && npm test`. Expect 70 passing.
3. `cd apps/web && npm install && npm run build`. Passes in this drop.
4. Check that nothing in your Vercel or Render settings points at the deleted `apps/*` folders or at Firebase Storage.
5. Deploy the backend to Render, then the web app to Vercel.
6. Staging check:
   - Super Admin → restaurant → Menu: add, edit and toggle a dish. It matches the restaurant admin's menu page.
   - Super Admin → staff: remove a test account. The confirmation appears, and cancelling keeps the account.
   - Billing screen: remove a waiter banner and wait 30 seconds. Nothing errors in the console after you leave the page.
   - Kitchen: send a chef message, then leave the screen within 3 seconds. No console warning.
   - Render: during a deploy, `/health` returns 503 for a moment before the new instance takes over.

## Still unverified (flagged U)
- The Render health behaviour during a real deploy, and whether the 503 window is long enough to matter.
- Listener cleanup in a browser under load (the code is checked; a leak would show up in DevTools as a growing listener count).
- The Super Admin menu after the swap to `MenuManager`: variants and image upload on a real restaurant.

## Open decisions
- **Rate limits** stay in memory. Revisit when you run more than one Render instance.
- **Seed guard:** `ALLOW_SEED=yes` is the only way to seed a production-flagged environment. Use a throwaway project for demos.

## Files touched
Backend:
- Removed: `src/middleware/tenantResolver.js`, `src/services/orderStore.js`, `src/.env.example`.
- Changed: `src/routes/menu.js` (duplicate route removed), `src/server.js` (draining health, idle connections), `src/scripts/seedDevData.js` (production guard, brandColor).

Frontend (apps/web):
- Removed: `src/panels/admin/hooks/useMenuAdmin.js`, `src/panels/admin/hooks/useRestaurant.js`, `src/panels/admin/components/ImageUploader.jsx`, `src/panels/customer/components/CartDrawer.jsx`, `src/panels/customer/components/QuantityControl.jsx`.
- Changed: `src/panels/reception/hooks/useBilling.js`, `src/panels/customer/pages/OrderConfirmed.jsx` (scoped listeners), `src/panels/chef/components/OrderTicket.jsx` (timer), `src/panels/customer/hooks/useTable.js` and `useMenu.js` (dead check), `src/panels/admin/pages/SuperAdmin.jsx` (shared MenuManager, staff removal confirm).

Firebase: removed `firebase/storage.rules`; `firebase.json` now lists Firestore only.

Removed folders: `apps/admin-panel`, `apps/chef-panel`, `apps/customer-app`, `apps/receptionist-panel`.

Docs: `PHASE_4_NOTES.md` (this file). `PHASE_3_NOTES.md` corrected on #39.

## Next up
The Master Bug List has no more phases. What's left is:
- The **U** items in Phases 0 to 4 (Firestore emulator for the rules, Render behaviour, browser checks listed above).
- The **open decisions** in Phase 2 and Phase 3 (settings lock for expired restaurants, reset scope, archive semantics).
- The follow-ups I noted along the way: a restore action for archived restaurants, a UI for permanent delete, a shared rate-limit store before you scale out, and a rewrite of the Orders and Menu sections in `docs/api.md`, which are still from the original template.
