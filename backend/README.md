# Backend Server

Node.js + Express API server with Socket.io for real-time updates.

## Features

- REST API for orders, menu, and restaurant management
- Real-time Socket.io events for kitchen and billing panels
- Firebase Firestore integration
- Multi-tenant support
- JWT authentication

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create `.env` file:
```bash
cp .env.example .env
```

3. Update `.env` with your Firebase credentials

4. Start development server:
```bash
npm run dev
```

Server runs on `http://localhost:3000`

## Project Structure

```
src/
├── server.js              # Main entry point
├── routes/                # API endpoints
│   ├── orders.js
│   ├── menu.js
│   └── restaurants.js
├── socket/                # Socket.io handlers
│   └── orderSocket.js
├── services/              # Business logic
│   ├── firebaseAdmin.js
│   ├── orderService.js
│   └── menuService.js
└── middleware/            # Express middleware
    ├── auth.js
    └── tenantResolver.js
```

## API Endpoints

- `POST /api/orders` - Create order
- `GET /api/orders/:restaurantId` - List orders
- `GET /api/menu/:restaurantId` - Get menu
- `POST /api/menu` - Add menu item
- `GET/POST/PUT /api/restaurants` - Restaurant CRUD

See `docs/api.md` for full documentation.

## Environment Variables

```
PORT=3000
CLIENT_URL=http://localhost:5173
FIREBASE_SERVICE_ACCOUNT=<json>
FIREBASE_DATABASE_URL=<url>
NODE_ENV=development
```
