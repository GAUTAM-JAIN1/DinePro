# DinePro — Phase 1 (Money integrity) — Fix Notes

Applied: 24 Oct 2026 · Source: Master Bug List (Fix Order), Phase 1

Phase 1 is about making the server the only authority on money: what an item
costs, what a bill totals, what gets settled, and what a subscription payment
buys. Each item below lists what changed, where, and how it was checked.

Verification key: **V** = covered by an automated test here · **C** = code
review only · **U** = needs a real Firestore / browser check (see the end).

---

## 1. #1 — Client price trust (V)
- `middleware/validators`: the order schema no longer has `price`, `name`,
  `isVeg` or `tableNumber`. Zod strips them. The client sends only menu item
  id, variant, quantity and note.
- `services/billing.js` `resolveOrderLines()`: name, price, variant price and
  availability are read from the menu doc inside the transaction.
- Tests: `test/billing.test.js` (client price ignored, variant price from menu).

## 2. #11 — Sold-out items and ghost tables (V)
- `services/orderService.js` `upsertOrder()`: the table doc is read in the same
  transaction. A missing or inactive table gets 404/403. A sold-out item gets
  409 `SOLD_OUT`, and nothing is written.
- Tests: `test/orderService.test.js` scenarios 4 and 5.

## 3. #53 — tableNumber from the CartPage fallback (V for the server, C for the UI)
- `CartPage.jsx` no longer sends `tableNumber`. The server takes it from the
  table doc. The UI still shows the URL value, for display only.
- `orderService.upsertOrder()` stores the **canonical table doc id** as
  `tableId`, even when the QR carried the table number.
- `orderSocket.js` `join_table` now joins the canonical room too, so
  customers hear events for orders placed via either link form.

## 4. #6 — Two open bills for one table (V)
- `upsertOrder()` is a single Firestore transaction. It reads the table doc,
  the table's open orders and the menu, then writes. Every order write also
  updates the table doc, so two simultaneous orders for the same table
  conflict and one retries. The retry sees the first bill and merges into it.
- Tests: scenario 2 covers the merge. The real concurrent race needs an
  emulator (see U).

## 5. #7 — Lost update on add-ons (V for the merge, C for the kitchen paths)
- The merge reads and writes inside the same transaction. The kitchen status
  paths (`updateOrder`, `updateOrderItemStatus`) are transactional too, so a
  status change can't overwrite items added at the same moment.

## 6. #8 — Cancelled orders revived, billed, settled (V)
- The open-bill lookup and the merge only consider `new` / `preparing`.
  Cancelled orders never merge, never get listed, and can't be settled
  (`closeBill` returns 409 `ORDER_CANCELLED`). Closed ids return
  409 `ALREADY_SETTLED`.
- `getRestaurantOrders()` filters out cancelled orders.
- Tests: scenario 6, plus the 409 checks in scenario 9.

## 7. #9 — Settlement controlled by the client (V)
- GST and service charge come from restaurant settings
  (`defaultGstPercent`, `defaultServiceCharge`). The client's values are
  dropped by the schema.
- Discount cap: receptionists can discount up to **10%** of the subtotal
  (`RECEPTIONIST_MAX_DISCOUNT_PERCENT`, env-configurable). A larger discount
  returns 403 `DISCOUNT_NEEDS_APPROVAL` unless the actor is an admin or
  platform admin. A discount above the subtotal is refused for everyone.
- The UI shows GST and service charge as read-only, plus the cap.
- Tests: `billing.test.js` (cap, approval), scenario 10.

## 8. #40 — Settled amount differs from the confirmed amount (V)
- The settle event must include `expectedPayableAmount`. If the server's
  computed payable differs, it returns 409 `TOTAL_MISMATCH` with
  `actualPayableAmount`, and nothing is written.
- The UI sends the preview payable, which uses the same math as the server
  (`apps/web/src/panels/reception/billingMath.js`).
- Tests: `billing.test.js` (match / mismatch), scenario 9.

## 9. #41 — Cancel modal cancels the whole table (C, server path V)
- `cancelOrder()` cancels one order only. The table's other orders stay as
  they are.
- An order with served items needs a reason of at least 3 characters
  (`REASON_REQUIRED`). The modal disables the button until the reason is
  given.
- The modal lists the table's orders and cancels the selected one.
- Tests: scenarios 7 and 8.

## 10. #42 + #45 — Cancelled items in bill and pending revenue (V)
- Cancelled orders are excluded from `getRestaurantOrders()`,
  `getDailyReport()` (item counts, hourly and totals) and the reception
  `tableGroups` in `useBilling.js`.
- Tests: scenario 11 (daily report).

## 11. #43 — Bill number client-side, non-unique, non-sequential (V)
- `closeBill()` assigns the invoice number from a per-restaurant counter
  (`restaurants/{id}/counters/invoices`), inside the same transaction as the
  settlement. Format: `INV-YYYY-NNNNNN`. The year uses Asia/Kolkata.
- One settlement gets one invoice number, shared by all of its orders.
- `PrintBill.jsx` shows `PREVIEW — NOT A FINAL BILL` until settlement. The
  history list has a **Reprint** button that reuses the stored invoice number.
- Tests: scenario 9 (sequential numbers 000001, 000002).

## 12. #44 — Order arrives after settlement on the same table (V, decision taken)
Decision (see Open decisions below): **hybrid**.
- An order that arrives while a bill is open blocks that settlement with
  409 `ORDERS_CHANGED`. The cashier refreshes, and the new order is included
  in the bill. Nothing is settled unseen and nothing stays open silently.
- An order placed after settlement opens a **new bill** on the same table.
- Tests: scenario 9.

## 13. #28 — Float money math (V)
- Backend: `services/billing.js` computes everything in integer paise.
  Rupee values come back out only when stored.
- Frontend: `apps/web/src/lib/money.js` (`lineTotal`, `sumRupees`) is used by
  the cart, the bill summary, the table totals and the print view.
- Parity: `apps/web/src/panels/reception/billingMath.js` matches the backend
  exactly. Checked with a script on four sample cases (GST, discount and
  service charge combinations, including fractional GST).
- Tests: `billing.test.js` ("paise math avoids float drift").

## 14. #27 — +15 Trial downgrades a paid restaurant (V)
- `subscriptionService.buildSubscriptionUpdate('extendTrial')`: if the
  restaurant is paid and active, the days are added to `currentPeriodEnd`
  and the status stays `active`. The status is never rewritten.
- Otherwise (trial, expired, suspended) the old behaviour holds: a trial of
  `days` from now.
- **Interpretation to confirm:** "+15 Trial" on a paid restaurant now gives
  15 extra paid days. It does not reset the status.
- Tests: `subscription.test.js` (paid stays paid, expired still gets trial).

## 15. #67 — Early renewal throws away remaining days (V)
- `markPaid` and `reactivate` build on the current period end when it is
  still in the future: new end = old end + days. The period start is kept.
- Tests: `subscription.test.js` ("early renewal stacks").

## 16. #69 — No payment ledger (C: validation and ledger write not in tests yet)
- `markPaid` and `reactivate` need a `payment` object: amount, method
  (cash / upi / card / bank_transfer / other) and reference (required for
  non-cash). Missing or invalid input returns 400 `PAYMENT_REQUIRED` or
  `PAYMENT_INVALID`.
- Each payment is written to `restaurants/{id}/payments/{paymentId}` in the
  same transaction as the subscription update, with the period covered and
  the actor. The response returns `paymentId`.
- SuperAdmin UI: Mark Paid and Reactivate open a payment form.
  "+15 Trial" is now labelled "+15 Days".

## 17. #77 — No audit log (C: code review only, no test asserts the audit rows yet)
- New `services/auditService.js`. Entries go to `restaurants/{id}/auditLogs`
  with `actor` (uid, email, role), `action`, `before`, `after`, `meta`, `at`.
- Written: `bill.settle` (in the settle transaction), `order.cancel` (in the
  cancel transaction), `subscription.<action>` (in the subscription
  transaction), `stats.reset`, `restaurant.settings` (before and after for the
  changed keys), `staff.create`, `staff.delete`, `staff.toggle`.
- Retention: not set (see Open decisions).

## 18. #51 + #38 — Duplicate guard blocks legitimate repeats (V)
- The 5-second content-match is removed from the server
  (`assertNotDuplicateOrder`) and from the client (`sessionStorage`).
- Each submission carries `idempotencyKey` (8–64 characters). The server
  stores `restaurants/{id}/orderKeys/{key}` in the order transaction. A retry
  with the same key returns the existing order with `replayed: true`, and it
  is not broadcast again.
- Client: `CartPage` makes one key per cart state. It reuses the key while
  the cart is unchanged and makes a new one when the cart changes. Nothing is
  locked on failure, so a failed attempt can simply be retried.
- Tests: scenario 3 (retry returns the same order and doesn't double-add).

---

## Socket error contract (new)
Staff events now report failures as `<event>_error` with `{ error,
statusCode, ...extra }`, for example `close_bill_error` with `code`,
`actualPayableAmount` or `extraOrderIds`. The billing screen shows these in a
banner and re-syncs. `cancel_order_error` keeps its old name.

`close_bill` sends the full settlement to staff only. Customers at the table
get `bill_closed` with `{ restaurantId, tableId, tableNumber, orderIds,
closedAt }`, which is all `OrderConfirmed` needs.

## REST contract changes
- `POST /api/orders`: requires `idempotencyKey`. The body's `price`, `name`
  and `tableNumber` are ignored. Response adds `replayed`.
- `PATCH /api/restaurants/:id/subscription`: validated. `markPaid` and
  `reactivate` require `payment`. Response adds `paymentId`.

---

## Before you deploy
1. `cd backend && npm install` (no new packages in Phase 1; `helmet` from
   Phase 0 is already there).
2. `npm test` in `backend/`. Expect 31 passing.
3. No new Firestore indexes are needed. The queries reuse the Phase 0 set
   (`orders` tableId+status, status+createdAt).
4. Recommended: add a Firestore TTL policy on the `orderKeys` collection
   group, field `expiresAt`. Without it, the idempotency docs accumulate. They
   are harmless but not free.
5. Test the reception flow end to end on staging: settle with a discount
   above 10% as a receptionist (should be refused), settle as admin
   (should pass), cancel a served order without a reason (should be refused),
   and reprint an old bill.
6. In SuperAdmin, record a payment on a test restaurant and check that a
   row appears under its `payments` subcollection.

## Open decisions (taken; change if you disagree)
- **#44:** hybrid behaviour described above.
- **#51/#38:** idempotency key (your suggestion).
- **#77 retention:** no TTL set. Choose a period and add a TTL policy on
  `auditLogs.at`.
- **Discount cap:** 10%, configurable with `RECEPTIONIST_MAX_DISCOUNT_PERCENT`.
  The frontend constant in `billingMath.js` is hard-coded to match, so change
  both if you change it.
- **+15 Trial on a paid restaurant:** extends the paid period (item 14).

## Still unverified (flagged U)
- Real concurrency on Firestore: two simultaneous orders for the same table,
  and a settle racing an order. The logic is covered by the in-memory tests.
  The real conflict-and-retry behaviour needs the Firebase emulator.
- Firestore rules for the new `payments`, `auditLogs`, `counters` and
  `orderKeys` subcollections. The rules deny client access by default, which is
  what we want, but this hasn't been run against the emulator.
- Browser behaviour of the new cancel dialog, settlement form, reprint and
  SuperAdmin payment form. They compile (`vite build`) and pass lint for
  undefined identifiers, but haven't been clicked through.

## Files touched
Backend:
- `src/services/billing.js` (new, pure money and pricing rules)
- `src/services/auditService.js` (new)
- `src/services/orderService.js` (rewritten write paths)
- `src/services/subscriptionService.js`
- `src/services/restaurantService.js`
- `src/middleware/validators/index.js`
- `src/socket/orderSocket.js`
- `src/routes/orders.js`, `src/routes/restaurants.js`, `src/routes/staff.js`
- `test/billing.test.js`, `test/subscription.test.js`,
  `test/orderService.test.js`, `test/support/fakeFirestore.js` (new)
- `package.json` (`npm test` script)

Frontend (apps/web):
- `src/lib/money.js` (new)
- `src/panels/reception/billingMath.js` (new)
- `src/panels/reception/hooks/useBilling.js`
- `src/panels/reception/components/TableCard.jsx`
- `src/panels/reception/components/BillSummary.jsx`
- `src/panels/reception/components/PrintBill.jsx`
- `src/panels/reception/pages/BillingDashboard.jsx`
- `src/panels/customer/pages/CartPage.jsx`
- `src/panels/customer/hooks/useOrder.js`
- `src/panels/customer/context/CartContext.jsx`
- `src/panels/admin/pages/SuperAdmin.jsx`

## Next up
**Phase 2 — Auth lifecycle and abuse**: #18 tenant check fail-open, #12
deactivated staff keeps access, #26 two staff-creation paths, #25 temp password,
#54 owner login, #80 socket flood, #22 rate limit on shared IP, #61 image URL,
#20 item status enum, #24 error leaks, #72 login hints, #62 401 handling, #37
subscription check on every mutation. #19 and #60 are partly covered already
(order item quantity, item count and note length limits are in the Phase 1
schema). Phase 2 still needs the price and text bounds on menu and cancel
reason inputs.
