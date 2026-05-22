# Restaurant SaaS Architecture

This is a comprehensive multi-tenant SaaS system for restaurant management with QR-based menu ordering.

## System Overview

### Key Components

1. **Customer App** - QR code scanning → browse menu → place order
2. **Chef Panel** - Kitchen display system with real-time orders
3. **Receptionist Panel** - Billing and table management
4. **Admin Panel** - Restaurant settings, menu management, table setup
5. **Backend** - Express + Socket.io server with real-time updates

### Tech Stack

- **Frontend**: React + Vite
- **Backend**: Node.js + Express + Socket.io
- **Database**: Firebase Firestore
- **Authentication**: Firebase Auth
- **Hosting**: Firebase (Frontend) + Cloud Run (Backend)

## Data Flow

```
Customer QR Scan → Menu Load → Add Items to Cart → 
Place Order → Backend Socket Update → 
Kitchen Display Updates → Order Preparation → 
Ready Status → Receptionist Bill Generation → Payment
```

## Multi-Tenancy Model

Each restaurant is a separate tenant with isolated data:
- Firestore document structure: `/restaurants/{restaurantId}/...`
- Socket rooms per restaurant: `kitchen-{restaurantId}`, `billing-{restaurantId}`
- Security rules enforce tenant isolation

## Real-Time Features

- Orders appear instantly in kitchen panel
- Billing updates reflect status changes
- Customer notified when order is ready
