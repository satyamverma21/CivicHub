# Setup Guide (Express + SQLite, No Firebase)

## 1. Prerequisites
- Node.js 20+
- npm
- Android emulator or physical device with Expo Go

## 2. Install dependencies
From project root:

```powershell
cd D:\dikki
npm install
```

Backend deps:

```powershell
cd backend
npm install
cd ..
```

## 3. Environment
Create `D:\dikki\.env`:

```env
EXPO_PUBLIC_API_URL=http://localhost:4000
```

If Android emulator cannot reach localhost, use:

```env
EXPO_PUBLIC_API_URL=http://10.0.2.2:4000
```

## 4. Start backend

```powershell
npm run start:backend
```

Backend runs on `http://localhost:4000`.

## 5. Start app
In another terminal:

```powershell
npm start
```

## 6. First login (SuperAdmin)
Auto-seeded in SQLite:
- Email: `superadmin@communityapp.com`
- Password: `Admin1234`

## 7. Data locations
- SQLite DB: `backend/data.sqlite`
- Uploaded files: `backend/uploads`

## 8. Reset data
Stop backend, then delete:
- `backend/data.sqlite`
- `backend/uploads/*`

Restart backend to seed fresh SuperAdmin.
