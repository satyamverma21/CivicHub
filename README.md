# Community Issue App (Express + SQLite)

## Architecture

- Frontend: Expo React Native (`src/`)
- Backend: Express + SQLite (`backend/`)
- File storage: local filesystem (`backend/uploads`)
- Auth: JWT

## Run from scratch

1. Install frontend deps
```bash
npm install
```

2. Install backend deps
```bash
cd backend
npm install
cd ..
```

3. Create `.env` in project root
```env
EXPO_PUBLIC_API_URL=http://localhost:4000
EXPO_PUBLIC_LOCATIONIQ_API_KEY=your_locationiq_key
```

4. Start backend (terminal 1)
```bash
npm run start:backend
```

5. Start app (terminal 2)
```bash
npm start
```

## Default SuperAdmin

Created automatically in SQLite DB:
- Email: `superadmin@communityapp.com`
- Password: `Admin1234`

Change this immediately for production.

## Notes

- SQLite DB file: `backend/data.sqlite`
- Uploaded images/audio: `backend/uploads`
- Delete both to reset backend data.
- For Android emulator, if `localhost` fails, set:
  `EXPO_PUBLIC_API_URL=http://10.0.2.2:4000`
