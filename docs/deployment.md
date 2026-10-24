# Deployment Guide (Vercel + Render)

DinePro is now **one frontend** (`apps/web`) + **one backend** (`backend`).

| Part     | Host   | Notes                                                    |
| -------- | ------ | -------------------------------------------------------- |
| Frontend | Vercel | ONE project, root directory `apps/web`                   |
| Backend  | Render | Free web service, kept awake by UptimeRobot (`/health`)  |
| Auth/DB  | Firebase | Email/password auth, Firestore, custom claims for roles |

## URLs inside the single app

| URL                                   | Who                    |
| ------------------------------------- | ---------------------- |
| `/`                                   | Role chooser ("Who are you?") |
| `/login/chef`, `/login/reception`, `/login/admin`, `/login/superadmin` | Staff login |
| `/chef`                               | Chef (kitchen display) |
| `/reception`                          | Receptionist (billing) |
| `/admin/...`                          | Admin / Super Admin    |
| `/r/<restaurantId>/table/<number>`    | Customer (from the table QR, no login) |

Access is decided by the Firebase **custom claims** on the account (`role`, `restaurantId`, `platformAdmin`),
never by which card was clicked.

## 1. Backend on Render

1. Render → your existing web service → **Settings**
   - Root Directory: `backend`
   - Build Command: `npm ci`
   - Start Command: `npm start`
   - Health Check Path: `/health`
2. **Environment** variables:

| Variable                  | Value                                                        |
| ------------------------- | ------------------------------------------------------------ |
| `CLIENT_ORIGINS`          | `https://<your-app>.vercel.app` (comma separate to add more; no trailing slash) |
| `FIREBASE_PROJECT_ID`     | your Firebase project id                                     |
| `FIREBASE_SERVICE_ACCOUNT`| the whole service-account JSON on ONE line                   |
| `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` | image uploads |
| `ALLOW_VERCEL_PREVIEWS` / `VERCEL_PREVIEW_PREFIX` | optional, only if you want Vercel preview URLs to work |

3. Deploy, then open `https://<service>.onrender.com/health` — you should see `{"status":"ok",...}`.

### Keeping the free instance awake (UptimeRobot)

- Monitor type: **HTTP(s)**, URL: `https://<service>.onrender.com/health`, interval: **5 minutes**.
- Render free instances sleep after 15 minutes without traffic; a 5-minute ping prevents that.
- `/health` does no database work, so the pings cost almost nothing.
- Free plan = 750 instance hours per month per workspace. One always-on service uses ~744 h, so keep this the
  **only** free web service in that Render workspace or it will be suspended at the end of the month.
- A redeploy still restarts the service for ~1 minute; the app reconnects its sockets automatically.

## 2. Frontend on Vercel (single project)

1. Vercel → **Add New → Project** → import `GAUTAM-JAIN1/DinePro`.
2. **Root Directory:** `apps/web` · Framework: **Vite** (auto-detected).
3. **Environment variables** (copy from `apps/web/.env.example`):

```
VITE_API_URL=https://<service>.onrender.com
VITE_SOCKET_URL=https://<service>.onrender.com
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

4. Deploy. Then copy the final production URL into Render's `CLIENT_ORIGINS` and redeploy the backend.
5. Once everything works, delete the old Vercel projects (customer / chef / receptionist / admin).

> **QR codes:** the admin panel builds QR links from the domain it is opened on. Generate / print QR codes
> from the **production** URL (not `localhost` or a preview URL), or set `VITE_CUSTOMER_APP_URL`.

## 3. Firebase checklist

- Authentication → Sign-in method: **Email/Password** enabled.
- Authentication → Settings → **Authorized domains**: add your Vercel domain (needed if you ever add Google sign-in; harmless otherwise).
- Deploy `firebase/firestore.rules`, `firebase/firestore.indexes.json` and `firebase/storage.rules`:
  `firebase deploy --only firestore,storage` (uses `firebase.json` at the repo root).
  **Do this before pointing the app at a fresh Firestore project** — the composite indexes
  (orders by status/createdAt/closedAt/tableId, menu by isAvailable+sortOrder) don't exist by
  default, and the queries that need them fail outright on a brand new project until the
  indexes finish building (can take a few minutes).
- Create the first Super Admin with `node backend/setPlatformAdmin.js <uid> --confirm` (get the UID from Firebase Auth → Users after the owner signs up once), then log out and back in.

## 4. Local development

```bash
# backend
cd backend && cp .env.example .env && npm install && npm run dev      # http://localhost:5000

# frontend
cd apps/web && cp .env.example .env && npm install && npm run dev     # http://localhost:5173
```
