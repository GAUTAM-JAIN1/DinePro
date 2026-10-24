# API Documentation

## Base URL
```
https://api.restaurant-saas.com/api
```

## Authentication
All requests require Firebase JWT token in header:
```
Authorization: Bearer <firebase-token>
```

---

## Orders API

### POST /orders
Place a new order

**Request:**
```json
{
  "restaurantId": "rest-123",
  "tableId": "table-5",
  "items": [
    { "id": "item-1", "name": "Butter Chicken", "price": 250, "quantity": 2 }
  ],
  "specialInstructions": "Less spicy"
}
```

**Response:**
```json
{
  "id": "order-123",
  "status": "NEW",
  "total": 500,
  "createdAt": "2024-01-15T10:30:00Z"
}
```

### GET /orders/:restaurantId
Get all active orders

**Response:**
```json
{
  "orders": [
    {
      "id": "order-123",
      "tableId": "table-5",
      "status": "PREPARING",
      "items": [...],
      "total": 500
    }
  ]
}
```

---

## Menu API

### GET /menu/:restaurantId
Get all menu items

**Response:**
```json
{
  "items": [
    {
      "id": "item-1",
      "name": "Butter Chicken",
      "price": 250,
      "category": "Mains",
      "image": "url",
      "available": true
    }
  ]
}
```

### POST /menu
Add new menu item

**Request:**
```json
{
  "restaurantId": "rest-123",
  "name": "Biryani",
  "price": 300,
  "category": "Mains",
  "description": "Authentic basmati biryani",
  "image": "url"
}
```

### PUT /menu/:itemId
Update menu item

### DELETE /menu/:itemId
Remove menu item

---

## Restaurants API

### GET /restaurants/:restaurantId
Public restaurant details (no owner email or subscription data).

**Response:**
```json
{
  "success": true,
  "restaurant": { "id": "rest-123", "name": "Taj Restaurant", "address": "123 Main St", "logoUrl": "https://res.cloudinary.com/...", "brandColor": "#B88746" }
}
```

### POST /restaurants (Super Admin only)
Create a restaurant. If `ownerEmail` is given, an admin account is created for the owner in the same step.

**Request:** `{ "name": "Taj", "ownerEmail": "owner@taj.com", "address": "...", "phone": "...", "brandColor": "#B88746" }`

**Response:**
```json
{
  "success": true,
  "restaurant": { "id": "rest_1730000000000", "name": "Taj" },
  "owner": { "uid": "...", "email": "owner@taj.com", "role": "admin", "setupLink": "https://..." },
  "ownerError": null
}
```
If the owner account can't be created, the restaurant still exists, `owner` is `null`, and `ownerError` says why.

### PUT /restaurants/:restaurantId
Update settings (restaurant admin). Subscription fields are refused. Returns 402 when the subscription is inactive.

### POST /restaurants/:restaurantId/staff (Super Admin only)
Add a staff member. **Request:** `{ "email": "chef@taj.com", "name": "Asha", "role": "chef" }`. `role` is `admin`, `chef` or `receptionist`. A `password` field is ignored.

**Response (201):** `{ "success": true, "staff": { ..., "setupLink": "https://..." } }`

---

## Staff API

Staff accounts never get a password from us. The account is created without one, and the person opens the `setupLink` once to choose their own. The link is shown only in the response, so copy it at that point.

### POST /staff/:restaurantId
Add a staff member. Restaurant admin only. Subscription must be active.

**Request:** `{ "email": "chef@taj.com", "name": "Asha", "role": "chef" }`. Any `password` field is ignored.

**Response (201):**
```json
{
  "success": true,
  "staff": { "uid": "...", "email": "chef@taj.com", "name": "Asha", "role": "chef", "isActive": true, "setupLink": "https://...", "setupLinkError": null }
}
```
If the link could not be created, `setupLink` is `null` and `setupLinkError` explains. Use the setup-link endpoint to retry.

### GET /staff/:restaurantId
List staff for the restaurant. Restaurant admin only.

### POST /staff/:restaurantId/:uid/setup-link
Issue a fresh setup link for an existing staff member of this restaurant. Restaurant admin only.

**Response:** `{ "success": true, "email": "chef@taj.com", "setupLink": "https://..." }`

### PATCH /staff/:restaurantId/:uid/toggle
Activate or deactivate. Deactivating disables the login, revokes existing sessions and removes restaurant access. You can't deactivate your own account (400, `SELF_DEACTIVATE`).

---

## Reports, setup and tables (Phase 3)

### Day boundaries
All "today" numbers use the restaurant's calendar day in its own timezone (`timezone` on the restaurant, default `Asia/Kolkata`). Summing the server's clock is no longer used.

### GET /orders/:restaurantId/stats (restaurant admin, receptionist)
Dashboard counters for the current restaurant day. Revenue is the settled amount of bills closed that day. `completedOrdersToday` counts those same closed bills.

**Response:** `{ "success": true, "stats": { "date": "2026-10-25", "dailyRevenue": 1250, "completedOrdersToday": 6, "statsResetAt": null } }`

`POST /orders/:restaurantId/stats/reset` restarts the dashboard counter only. The daily report is never reset.

### GET /orders/:restaurantId/daily-report (restaurant admin, receptionist)
Full day for the report. Same revenue definition as `/stats`. Cancelled orders never count. Item and hourly breakdowns use the orders placed that day.

**Response:** `{ "success": true, "report": { "date", "timeZone", "totalOrders", "totalRevenue", "averageOrderValue", "paymentModeBreakdown", "topItems", "hourlyBreakdown" } }`. Money is in rupees with paise.

### GET /restaurants/:restaurantId/subscription (restaurant admin)
Subscription status for the admin dashboard. Dates and status only.

**Response:** `{ "success": true, "subscription": { "effectiveStatus", "isServiceEnabled", "daysRemaining", "trialEndsAt", "currentPeriodEnd", "planAmount" } }`

### GET /restaurants/:restaurantId (public)
Only these fields are returned: `id, name, address, phone, logoUrl, brandColor, timezone, defaultGstPercent, defaultServiceCharge, onboardingCompleted`. Billing, owner and audit fields are never public.

### DELETE /restaurants/:restaurantId (Super Admin)
Default: **archive**. The restaurant is suspended (customers and staff get 402). Orders, bills, payments and audit history are kept.

**Response:** `{ "success": true, "restaurant": { ..., "archivedAt": "..." }, "message": "Restaurant archived" }`

Permanent delete: `DELETE /restaurants/:restaurantId?permanent=true` with body `{ "confirm": "<restaurantId>" }`. Only allowed after archiving (409 `NOT_ARCHIVED`), and it removes every sub-collection.

### GET /restaurants (Super Admin)
Archived restaurants are left out. Add `?includeArchived=true` to see them.

### POST /menu/:restaurantId/bulk (restaurant admin)
Adds dishes that aren't on the menu yet, matched by name and category. Safe to repeat. Up to 50 items.

**Request:** `{ "items": [{ "name": "Dal", "price": 180, "category": "Mains" }] }`

**Response:** `{ "success": true, "created": [...], "skipped": [{ "index", "name", "reason" }], "errors": [{ "index", "name", "reason" }] }`. Invalid rows are reported per row. The rest are still saved.

### PUT /menu/:restaurantId/:itemId (restaurant admin)
Partial update. Only the fields you send change. `subcategory`, `isBestseller` and `sortOrder` are kept when you don't send them.

### GET /tables/:restaurantId (public)
Returns `{ id, tableNumber, label, capacity, isActive }`, sorted by table number (10 after 9).

### POST /tables/:restaurantId/bulk (restaurant admin)
Creates tables 1..count that don't exist yet. **Request:** `{ "count": 10 }` (1 to 100). **Response:** `{ "success": true, "created": [...], "skipped": ["1", "2"] }`

### DELETE /tables/:restaurantId/:tableId (restaurant admin)
Returns 409 `TABLE_HAS_OPEN_ORDER` with `openOrderCount` while the table has an open bill.

---

## Real-Time Events (Socket.io)

Connect to the backend URL. Staff send their Firebase ID token as `auth: { token }`. Customers connect anonymously.

### Customers (anonymous)
- emit `join_table` `{ restaurantId, tableId }`: joins that table's room only. Nothing restaurant-wide is sent.
- emit `call_waiter` `{ restaurantId, tableId, tableNumber? }`: throttled per socket and per table.
- receive for their own table: `status_changed`, `chef_message_received`, `bill_closed`.

### Staff
- emit `join_restaurant` `"<restaurantId>"`: joins the staff room. `stats_update` follows immediately.
- emit `order_preparing` / `order_ready` `{ restaurantId, id }`.
- emit `item_status` `{ restaurantId, orderId, itemKey, status }`: `status` is `preparing`, `ready` or `served`.
- emit `chef_message` `{ restaurantId, orderId?, tableId?, tableNumber?, message }`: message is 1 to 240 characters.
- emit `cancel_order` `{ restaurantId, orderId, reason? }`: receptionist and admin.
- emit `close_bill` `{ restaurantId, orderIds, settlement: { paymentMode, discountAmount, paymentReference, notes, expectedPayableAmount } }`: receptionist and admin.
- receive: `order_received`, `order_updated`, `bill_update`, `status_changed`, `stats_update`, `order_cancelled`, `waiter_called`, `bill_closed`, `chef_message_received`.

### Acknowledgements (Phase 3)
Every staff event can take an acknowledgement callback as its last argument. The server replies with `{ ok: true }` or `{ ok: false, error, statusCode, ...extra }`. Use it to confirm an optimistic change, and roll back when `ok` is false:

```javascript
socket.emit('item_status', { restaurantId, orderId, itemKey, status: 'ready' }, (reply) => {
  if (!reply.ok) rollback(reply.error)
})
```

### Errors and limits
- `<event>_error` `{ error, statusCode, ...extra }`: a staff event failed. For example, `close_bill_error` can include `code`, `actualPayableAmount` or `extraOrderIds`.
- `unauthorized` `{ event, restaurantId }`: the role or restaurant isn't allowed for this event.
- `rate_limited` `{ event }`: too many events. Slow down.
- `subscription_blocked` `{ restaurantId }`: the subscription is inactive.
- `session_ended` `{ reason }`: the staff account was disabled or removed. The server then disconnects the socket. A reconnect without a valid token connects as a customer.

---

## Error Responses

```json
{ "success": false, "error": "Message", "details": ["field: reason"], "code": "OPTIONAL_CODE" }
```

- **4xx:** `error` says what to fix. Validation failures list `details`. Some errors include a `code`, for example `TOTAL_MISMATCH`, `SOLD_OUT`, `DISCOUNT_NEEDS_APPROVAL`, `PAYMENT_REQUIRED` or `SELF_DEACTIVATE`.
- **401:** `Session expired. Please sign in again.` The web app signs the user out.
- **402:** subscription inactive.
- **5xx:** `error` is always `Something went wrong. Please try again.`. The real cause is logged on the server.
