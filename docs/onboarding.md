# Restaurant Onboarding Guide

## How to Add a New Restaurant

### Step 1: Create Restaurant Account
1. Super Admin logs in
2. Navigate to "Add Restaurant"
3. Fill in details:
   - Restaurant Name
   - Address
   - Logo (upload image)
   - Theme Color (hex code)

### Step 2: Setup Tables
1. Go to Table Manager
2. Enter number of tables (e.g., 15)
3. System auto-generates unique table IDs
4. Download QR codes for each table

### Step 3: Create Menu
1. Go to Menu Manager
2. Add menu items:
   - Name
   - Price
   - Category (Starters, Mains, Desserts, Drinks)
   - Description
   - Image
3. Publish menu

### Step 4: Assign Staff
1. Go to Staff Management
2. Create accounts for:
   - Chef (Kitchen Display access)
   - Receptionist (Billing access)
   - Admin (Full restaurant settings)

### Step 5: Deploy
1. Print/place QR codes on tables
2. Staff logins created
3. System ready for orders

## System Configuration

### Environment Variables
```
FIREBASE_SERVICE_ACCOUNT=<service-account-json>
FIREBASE_DATABASE_URL=<firebase-url>
CLIENT_URL=<frontend-url>
PORT=3000
```

### Firebase Setup
1. Create Firestore database
2. Deploy security rules from `firebase/firestore.rules`
3. Setup authentication (Email/Password)
4. Create Storage bucket for images

## Testing Restaurant Setup
1. Scan QR code from test device
2. Add items to cart
3. Place order
4. Verify appears in kitchen panel
5. Update status to READY
6. Check billing dashboard
