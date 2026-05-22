# Restaurant SaaS - QR Code Menu & Order Management System

A modern, full-stack SaaS platform for restaurants to manage orders through QR code menu scanning, kitchen operations, and billing.

## 📋 Project Structure

```
restaurant-saas/
├── apps/
│   ├── customer-app/           # Customer menu & ordering
│   ├── chef-panel/             # Kitchen display system
│   ├── receptionist-panel/     # Billing & tables
│   └── admin-panel/            # Admin settings & menu management
├── backend/                    # Node.js + Express API server
├── shared/                     # Shared utilities & constants
├── firebase/                   # Firestore security rules
└── docs/                       # Documentation
```

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Firebase project
- npm or yarn

### Installation

1. **Clone and setup:**
```bash
cd DIGITAL_MENU
```

2. **Backend setup:**
```bash
cd backend
npm install
cp .env.example .env
# Edit .env with your Firebase credentials
npm run dev
```

3. **Frontend apps (customer, chef-panel, receptionist-panel, admin-panel):**
```bash
cd apps/customer-app
npm install
npm run dev
```

Repeat for other apps.

## 📱 Apps Overview

### Customer App
- Scan QR code at table
- Browse menu by category
- Add items to cart
- Place order
- Real-time order status updates

### Chef Panel
- Live kitchen display system
- View incoming orders
- Update order status (Preparing → Ready)
- Prioritize orders

### Receptionist Panel
- View all active tables & bills
- Generate itemized bills
- Print receipts
- Track revenue

### Admin Panel
- Menu item management (add/edit/delete/upload images)
- Table management (create/setup QR codes)
- Restaurant settings (logo, address, theme)
- Dashboard with analytics
- Super admin: manage multiple restaurants

## 🏗️ Architecture

### Multi-Tenant System
Each restaurant is a separate tenant with isolated:
- Firestore data (`/restaurants/{restaurantId}`)
- Socket.io rooms for real-time updates
- User access controls

### Real-Time Features
- Socket.io for instant order updates
- Live kitchen display
- Auto-updated billing
- Customer order status notifications

### Authentication
- Firebase Auth (email/password)
- JWT tokens for API requests
- Role-based access (Chef, Receptionist, Admin, SuperAdmin)

## 📊 Database Schema

```
restaurants/
  └── {restaurantId}/
      ├── menu/
      │   └── {itemId}: { name, price, category, image, available }
      ├── orders/
      │   └── {orderId}: { tableId, items, status, total, createdAt }
      └── tables/
          └── {tableId}: { number, qrCode, capacity }
```

## 🔐 Security

- Multi-tenant isolation via Firestore rules
- JWT token verification on backend
- Firebase security rules enforce access control
- No cross-tenant data access

## 📡 API Endpoints

### Core Routes
- `POST /api/orders` - Place order
- `GET /api/orders/:restaurantId` - Get orders
- `GET /api/menu/:restaurantId` - Get menu
- `POST /api/menu` - Add menu item
- `GET/PUT /api/restaurants/:restaurantId` - Restaurant CRUD

### Real-Time (Socket.io)
- `subscribe_kitchen` - Listen to kitchen orders
- `subscribe_billing` - Listen to billing updates
- `order_status_update` - Update order status

See `docs/api.md` for detailed API docs.

## 🔧 Development

### Tech Stack
- **Frontend**: React 18, Vite, Socket.io-client
- **Backend**: Express, Socket.io, Firebase Admin SDK
- **Database**: Firestore
- **Auth**: Firebase Authentication
- **Deployment**: Firebase Hosting (frontend), Cloud Run (backend)

### Environment Setup
1. Create Firebase project
2. Generate service account key
3. Set environment variables in `backend/.env`
4. Deploy Firestore security rules

## 📚 Documentation

- [Architecture Overview](docs/architecture.md) - System design & data flow
- [Onboarding Guide](docs/onboarding.md) - How to add restaurants
- [API Reference](docs/api.md) - Complete API documentation

## 🚢 Deployment

### Frontend (Firebase Hosting)
```bash
npm run build
firebase deploy
```

### Backend (Cloud Run)
```bash
gcloud run deploy restaurant-saas-api --source .
```

## 🤝 Contributing

This is a SaaS template. Customize for your use case:
- Add payment integration (Stripe, Razorpay)
- Implement inventory management
- Add analytics & reporting
- Email/SMS notifications

## 📄 License

MIT

---

**Quick Links:**
- [API Docs](docs/api.md)
- [Architecture](docs/architecture.md)
- [Setup Guide](docs/onboarding.md)
