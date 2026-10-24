# DinePro — Phase 3 (Data correctness and UX) — Fix Notes

Source: Master Bug List (Fix Order), Phase 3. Built on the Phase 2 drop.

Phase 3 is about numbers and screens that tell the truth: "today" follows the restaurant's clock, the dashboard and the report agree, a failed request is shown as failed, optimistic changes roll back when the server refuses them, and the setup wizard can be repeated safely.

Verification key: **V** = covered by an automated test · **C** = code review only · **U** = needs a real Firestore / Render / browser check (see the end).

---

## Backend

### 1. #14 — Timezone bug (V)
- New `services/dayKey.js`: day keys, hour of day and day bounds in the restaurant's timezone (default `Asia/Kolkata`). Handles DST days (a 23-hour day is tested).
- Restaurants now store `timezone` (validated as an IANA zone in `restaurantUpdate`). Older documents read as `Asia/Kolkata`.
- Tests: `test/phase3.test.js` (instant 20:00 UTC is the next day in Kolkata; New York DST day is 23 hours; the dashboard and the report use the restaurant's day).

### 2. #15 — Dashboard and report used different revenue definitions (V)
- One definition in `orderService.js`: a day's revenue is the settled amount of bills **closed** that day.
- `/stats` (dashboard) and `/daily-report` (report) both use it. Test: `report.totalRevenue === stats.dailyRevenue`.
- **Meaning change:** `completedOrdersToday` now counts bills closed today. It used to count closed bills whose kitchen-ready time was today.

### 3. #17 and #78 — Full scans on every event and on the report (C)
- Both reads are range queries on one timestamp (`closedAt` or `createdAt`). Cost follows the day's volume, not the restaurant's history.
- No new Firestore composite index is needed (single-field ranges). The Phase 0 index file is unchanged.

### 4. #46 — "Reset Revenue" misleading (V for the rule, C for the UI)
- Reset restarts the **live dashboard counter only**. The daily report is never reset. The reset dialog and button now say so.
- **Decision to confirm:** if you'd rather the report also honour a reset, that's a one-line change in `getDailyReport`.

### 5. #49 — Mark preparing moved ready items back to preparing (V)
- `updateOrder` only moves items that are behind the target: preparing moves new items; ready moves new and preparing; served moves everything not yet served.
- The order's status is now derived from its items, so it can't say "preparing" while every item is ready.
- Tests: `phase3.test.js` (ready item stays ready); end-to-end socket check.

### 6. #23 — Optimistic UI without server acknowledgement (V for the server ack, C for the screens)
- Every staff socket event takes an ack callback and replies `{ ok: true }` or `{ ok: false, error, statusCode, ... }`. Refusals (validation, another restaurant, suspended subscription, rate limit) are all acknowledged.
- `lib/socket.js` `emitAcked`: waits up to 8 s, and fails fast when the socket is down.
- Kitchen (`useKitchenOrders`): the change shows at once; only the items the server refused roll back; a toast gives the reason.
- Billing (`useBilling`): close bill, cancel order and mark served roll back; a failed settlement or cancel re-reads the open orders from the server.

### 7. #52 — Doc id shown to customers and waiters (V for the waiter payload, C for the customer screen)
- Waiter calls take the table number from the table document. The client's value is ignored, so the billing banner also shows the number.
- Customer confirmation screen loads the table through the public table endpoint and shows the number, not the id in the URL.

### 8. #13 — Menu edit wiped fields (V)
- The update schema has no defaults. A field the client doesn't send is left alone.
- The admin form now keeps `subcategory`, `subcategoryHindi` and `isBestseller` through an edit.
- Tests: schema test, and an end-to-end edit that keeps subcategory and bestseller.

### 9. #64 — Admin subscription banner always UNKNOWN (V)
- The public restaurant document never had subscription data. The dashboard now reads `GET /api/restaurants/:id/subscription` (restaurant admin, tenant-checked). Status and days left come from there.
- **Choice:** the summary is on an authenticated endpoint, not the public one, so public visitors don't learn billing status.

### 10. #33 — brandColor vs themeColor, phone not stored (V)
- One colour field: `brandColor`. Older documents with `themeColor` read through as `brandColor`.
- `createRestaurant` now stores `phone` and `brandColor`.
- The setup wizard used to send `themeColor`, which the strict update schema rejected with a 400. It now sends `brandColor`.

### 11. #57 — Table delete orphaned an open bill (V)
- `DELETE /tables/:id` returns 409 `TABLE_HAS_OPEN_ORDER` (with `openOrderCount`) while the table has an open order.

### 12. #58 — Restaurant delete lost history permanently (V)
- Default `DELETE /restaurants/:id` **archives**: the restaurant is suspended, nothing is removed. Archived restaurants leave the default list.
- Permanent delete needs `?permanent=true`, an archived restaurant (409 `NOT_ARCHIVED` otherwise), and the restaurant id repeated in the body as `confirm`. It removes every sub-collection, including the payments and audit trail the old delete missed.
- No UI for permanent delete (intentional). No UI to restore an archived restaurant yet (follow-up).

### 13. #34 — Tables sorted as text; public list too large (V)
- Numeric sort (10 after 9).
- The public list returns `{ id, tableNumber, label, capacity, isActive }` only. The full document (timestamps, QR fields) is no longer public.

### 14. #55 and #56 — Setup wizard not idempotent; errors hidden (V)
- `POST /menu/:id/bulk` and `POST /tables/:id/bulk` are idempotent (dishes matched by name and category, tables by number). Running Finish again after a failure resumes safely.
- Dish rows are reported per row (`created`, `skipped`, `errors`). The wizard tells the owner which rows were not saved and why.
- Tests: bulk tables and bulk menu run twice; invalid rows reported per row.

### 15. #70 — Starter menu saved live (C)
- Sample dishes are an explicit "Add sample dishes" button. Nothing is saved until Finish, and only dishes the owner kept are sent.

### 16. #47 and #65 — Dashboard zero on failure; "Active Tables" wrong (C)
- Each dashboard section loads separately. A failed section shows "—" and a Retry banner instead of zero.
- "Active Tables" counts distinct tables with open orders over all open orders (the list used to be capped at 10). The list below still shows the latest ten.

### 17. #48 — Daily report date and paise (C)
- The date is the restaurant's day, from the server. Money shows two decimals in Indian grouping.

### 18. #76 — Empty numeric input saved as 0 (C)
- Settings keep the text as typed. A blank GST or service charge is refused with a message. Range checked (GST 0 to 100).

### 19. #66 — Kitchen alert sound silent after session restore (C)
- The audio module tracks whether the browser has blocked sound. A banner ("Sound on karo") appears on the kitchen and reception panels, and one tap resumes audio. Restored sessions have no click, so this is the path that matters.

### 20. #50 — Mark ready touched hidden items (C)
- With a filter active, "Mark ready" and "Mark preparing" only act on the items on screen. The button label says "Mark shown ready" when a filter hides items. The kitchen no longer sends order-level ready events; it sends item-level changes, and the order status follows.

---

## Other changes made along the way
- **Public restaurant response is now a whitelist.** It used to expose `subscriptionStatus`, `currentPeriodEnd`, `createdAt` and `updatedAt` to anyone with the id (found while testing #64). The customer app doesn't read those fields.
- `validate()` error details now carry real messages (zod v4 `issues`); this came up in Phase 2 and is kept.
- Restaurant hard delete now removes `menu` (the old code looked for `menuItems`, which doesn't exist).

## REST and socket contract changes
- `GET /api/orders/:id/stats`: adds `date` and `statsResetAt`; `completedOrdersToday` now counts bills closed that day.
- `GET /api/orders/:id/daily-report`: adds `timeZone`; revenue is closed bills that day; cancelled orders excluded.
- `GET /api/restaurants/:id`: whitelisted fields only (see above).
- `GET /api/restaurants/:id/subscription` (new).
- `DELETE /api/restaurants/:id`: archives by default; `?permanent=true` plus `confirm` for permanent delete.
- `GET /api/restaurants` (Super Admin): archived hidden unless `?includeArchived=true`.
- `POST /api/menu/:id/bulk` (new), `POST /api/tables/:id/bulk` (new).
- `GET /api/tables/:id` (public): slim fields, numeric order.
- `DELETE /api/tables/:id/:tableId`: 409 `TABLE_HAS_OPEN_ORDER`.
- Staff socket events: all take an ack callback; `waiter_called.tableNumber` comes from the table document.

---

## Before you deploy
1. `cd backend && npm install`. No new packages.
2. `cd backend && npm test`. Expect 70 passing (31 from Phase 1, 26 from Phase 2, 13 new).
3. `cd apps/web && npm install && npm run build`. Passes in this drop.
4. Deploy the backend to Render first, then the web app to Vercel. The new dashboard reads the subscription endpoint, and the setup wizard calls the bulk endpoints.
5. Staging check:
   - Kitchen: filter to one category, press "Mark shown ready". Hidden items stay as they were.
   - Kitchen: mark an order preparing with one item already ready. The ready item stays ready.
   - Billing: settle a bill with a payable amount that changed underneath. The table comes back and the reason shows.
   - Dashboard: the subscription line shows the real status. Block the network for the stats call; it shows "—" and Retry.
   - Settings: clear the GST box and save. You get a message and nothing is saved.
   - Report: the date matches the restaurant's day; totals show paise.
   - Setup wizard: run it, fail it halfway (for example, stop the network during the tables step), then press Finish again. No duplicate dishes or tables.
   - Archive a test restaurant. Its customers get 402 and its staff can't change anything. Its orders are still there in Firestore.
   - Restore the restaurant's audio after a reload on the kitchen screen: the banner appears; "Sound on karo" makes the next order chime.
6. Only restaurants outside India need `timezone` set (Super Admin API: `PUT /api/restaurants/:id` with `timezone`). The default is `Asia/Kolkata`.

## Still unverified (flagged U)
- **Timestamps in old data.** The new day queries compare ISO strings in `createdAt` and `closedAt`. If any old orders stored Firestore Timestamps instead, they won't appear in the day queries. Check a few documents in the console before relying on the dashboard.
- **Browser behaviour.** Audio banner after reload (Chrome and Safari), ack rollback timing on a slow connection, the dashboard Retry, the setup wizard's sample button and summary toast, the reset dialog text.
- **Concurrent bulk calls.** The idempotency check reads the menu and then writes. Two identical requests fired at the same instant could both create the same dish. A single Finish click doesn't do this. A Firestore transaction would close the gap; not done here.
- **Archived restaurant with staff logins.** Archiving suspends the restaurant (customers and staff get 402). Staff logins are not disabled. Say if you want that as well.

## Open decisions (taken; change if you disagree)
- **Revenue definition** is bills closed that day (item 2). `completedOrdersToday` changed meaning.
- **Reset** affects only the live counter (item 4).
- **Subscription summary** is on an authenticated endpoint, not the public one (item 9).
- **Archive first, then permanent delete**, and permanent delete is API-only (item 12).
- **Sample dishes** are opt-in; the wizard still needs at least one dish to continue.

## Files touched
Backend:
- `src/services/dayKey.js` (new)
- `src/services/orderService.js` (daily stats and report rewritten; `updateOrder` status rule)
- `src/services/restaurantService.js` (brandColor and timezone, archive, permanent delete, subscription summary, public list filter)
- `src/services/tableService.js` (rewritten: numeric sort, open-bill delete guard, public shape, bulk)
- `src/services/menuService.js` (idempotent bulk add)
- `src/socket/orderSocket.js` (acks, subscription acks, waiter table number)
- `src/routes/restaurants.js` (public whitelist, archive and permanent delete, subscription route, list filter)
- `src/routes/tables.js` (public shape, bulk route)
- `src/routes/menu.js` (bulk route)
- `src/middleware/validators/index.js` (menu update schema without defaults, brandColor default, timezone)
- `test/phase3.test.js` (new, 13 tests); `test/support/fakeFirestore.js` (range and `in` operators)
- `package.json` (test script)

Frontend (apps/web):
- `src/lib/socket.js` (`emitAcked`), `src/lib/kitchenAlertSound.js` (blocked state)
- `src/components/AudioUnlockBanner.jsx` (new); used by `panels/chef/ChefPanel.jsx` and `panels/reception/ReceptionPanel.jsx`
- `src/panels/chef/hooks/useKitchenOrders.js`, `panels/chef/components/OrderTicket.jsx`
- `src/panels/reception/hooks/useBilling.js`, `panels/reception/pages/BillingDashboard.jsx` (reset wording), `panels/reception/components/dailyreport.jsx`
- `src/panels/admin/pages/Dashboard.jsx`, `MenuManager.jsx`, `RestaurantSettings.jsx`, `SetupWizard.jsx`, `TableManager.jsx`, `SuperAdmin.jsx`
- `src/panels/admin/components/sidebar.jsx` (brandColor)
- `src/panels/customer/pages/OrderConfirmed.jsx` (table number, no id)

Docs: `docs/api.md` (Phase 3 section, acknowledgement contract), `PHASE_3_NOTES.md` (this file).

## Next up
**Phase 4 — Cleanup and ops** (13 items): #59 `socket.off` removes every listener, #63 duplicate menu code in MenuManager and SuperAdmin, #30 dead backend code (`tenantResolver.js`, `orderStore.js`, duplicate `POST /api/menu`), #31 legacy `apps/` folders, #32 `.env.example` in the wrong place, #73 dead hooks and components, #74 timers not cleaned on unmount, #71 Super Admin staff delete without confirmation, #36 storage rules, #35 dead subscription check in `useTable`, #81 seed script guard, #82 Render ops (SIGTERM drain, cold start, rate limit memory), #39 is settled in Phase 4 (docs and render.yaml both say Render).
