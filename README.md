# DinePro — Restaurant SaaS (QR Menu, Kitchen Display & Billing)

Multi-tenant restaurant platform: customers scan a table QR code, order from their phone, the kitchen and billing
desk update in real time.

## Project structure

```
DinePro/
├── apps/
│   └── web/              # ONE React + Vite app: customer, chef, receptionist, admin, super admin
├── backend/              # Node.js + Express + Socket.io API
├── shared/               # Shared constants / helpers
├── firebase/             # Firestore + Storage security rules
├── docs/                 # architecture, API, onboarding, deployment
└── render.yaml           # optional Render blueprint for the backend
```

## One app, role-based entry

Open the site → **"Who are you?"**

| Card         | Goes to                | Needs                                   |
| ------------ | ---------------------- | --------------------------------------- |
| Customer     | `/r/<restaurant>/table/<n>` (normally via QR) | nothing — no login |
| Chef         | `/chef`                | account with role `chef` (or `admin`)   |
| Receptionist | `/reception`           | account with role `receptionist` (or `admin`) |
| Admin        | `/admin`               | account with role `admin`               |
| Super Admin  | `/admin/super-admin`   | account with `platformAdmin` claim      |

Roles are Firebase custom claims. The backend and Socket.io verify them on every protected request — choosing a
card never grants access.

## Tech stack

- **Frontend:** React 19, Vite, React Router 7, Tailwind CSS, Framer Motion, Socket.io client
- **Backend:** Node.js, Express, Socket.io, Firebase Admin SDK, Zod, Cloudinary
- **Database / Auth:** Firebase Firestore + Firebase Authentication
- **Hosting:** Vercel (frontend) + Render (backend, kept awake with UptimeRobot)

## Quick start

```bash
# 1. backend
cd backend
cp .env.example .env        # fill in Firebase credentials
npm install
npm run dev                 # http://localhost:5000

# 2. frontend
cd apps/web
cp .env.example .env
npm install
npm run dev                 # http://localhost:5173
```

## Real-time events (Socket.io)

- Staff sockets send their Firebase ID token in the handshake; staff-only events (`order_preparing`, `order_ready`,
  `item_status`, `chef_message`, `cancel_order`, `close_bill`) are rejected unless the token's role and
  `restaurantId` match.
- New orders are broadcast **by the server** right after `POST /api/orders` saves them.
- Customers connect anonymously (they can only `join_restaurant` and `call_waiter`).

## Documentation

- [Deployment (Vercel + Render + UptimeRobot)](docs/deployment.md)
- [Architecture](docs/architecture.md)
- [Onboarding a restaurant](docs/onboarding.md)
- [API reference](docs/api.md)

## License

MIT
