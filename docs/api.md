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
Get restaurant details

**Response:**
```json
{
  "id": "rest-123",
  "name": "Taj Restaurant",
  "address": "123 Main St",
  "logo": "url",
  "themeColor": "#FF6B6B"
}
```

### POST /restaurants
Create new restaurant (Super Admin only)

### PUT /restaurants/:restaurantId
Update restaurant settings

---

## Real-Time Events (Socket.io)

### Subscribe to Kitchen Orders
```javascript
socket.emit('subscribe_kitchen', { restaurantId: 'rest-123' })

// Listen for new orders
socket.on('new_order', (order) => { ... })

// Listen for status updates
socket.on('order_status_update', (order) => { ... })
```

### Update Order Status
```javascript
socket.emit('order_status_update', {
  restaurantId: 'rest-123',
  orderId: 'order-123',
  status: 'READY'
})
```

---

## Error Responses

```json
{
  "error": "Error message",
  "code": "ERROR_CODE"
}
```

Common error codes:
- `UNAUTHORIZED` - Invalid/missing token
- `NOT_FOUND` - Resource not found
- `INVALID_INPUT` - Validation failed
- `INTERNAL_ERROR` - Server error
