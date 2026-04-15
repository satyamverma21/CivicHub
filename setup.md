# Setup Guide (From Scratch)

This guide sets up the project from zero on Windows/PowerShell.

## 1. Prerequisites

Install these first:
- Node.js 20+ (npm included)
- Git
- Firebase account + Firebase project
- Android Studio (for emulator) or a physical Android device with Expo Go

Optional but recommended:
- Java 17 (for Android native builds)
- EAS CLI (`npm i -g eas-cli`) for release builds

## 2. Clone and open project

```powershell
git clone <your-repo-url>
cd D:\dikki
```

## 3. Install app dependencies

```powershell
npm install
```

## 4. Install Cloud Functions dependencies

```powershell
cd firebase\functions
npm install
cd ..\..
```

## 5. Create environment file

Create `.env` in `D:\dikki` (copy from `.env.example`) and fill:

```env
EXPO_PUBLIC_FIREBASE_API_KEY=
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=
EXPO_PUBLIC_FIREBASE_PROJECT_ID=
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
EXPO_PUBLIC_FIREBASE_APP_ID=
EXPO_PUBLIC_FIREBASE_FUNCTIONS_REGION=us-central1
```

## 6. Firebase CLI setup

If Firebase CLI is not installed:

```powershell
npm install -g firebase-tools
```

Or use `npx firebase-tools` instead of global install.

Login:

```powershell
firebase login
```

## 7. Initialize Firebase in this repo (one-time)

Run from root (`D:\dikki`):

```powershell
firebase init
```

Select features:
- `Functions`
- `Firestore`
- `Storage`

Choose existing project:
- Select the same Firebase project used in your `.env`.

When prompted:
- Firestore rules file: `firebase/firestore.rules`
- Storage rules file: `firebase/storage.rules`
- Functions source directory: `firebase/functions`
- Language for functions: `JavaScript`
- Install dependencies now: `No` (already installed manually)

## 8. Enable required Google/Firebase services

In Google Cloud / Firebase Console:
- Enable **Cloud Firestore**
- Enable **Firebase Storage**
- Enable **Cloud Functions**
- Enable **Cloud Speech-to-Text API** (for voice transcription)
- Enable **Firebase Cloud Messaging** (push notifications)

## 9. Configure Cloud Functions secrets/env

Set Anthropic API key for functions:

```powershell
firebase functions:config:set anthropic.key="YOUR_ANTHROPIC_API_KEY"
```

If you use direct env vars in deployment pipeline, set:
- `ANTHROPIC_API_KEY`
- optional `CLAUDE_MODEL`

## 10. Deploy backend

From `D:\dikki`:

```powershell
firebase deploy --only firestore:rules,storage:rules,functions
```

## 11. Run the app

Start Expo dev server:

```powershell
npm start
```

Then:
- Press `a` to run Android emulator, or
- Scan QR in Expo Go on physical device.

## 12. Verify core flows

- Signup/login works
- Create issue (text + images)
- Voice issue recording and transcription works
- Feed loads, search/filter works
- Offline mode shows cached data
- Reconnect syncs queued actions
- Notifications are received and tap opens target screen
- Settings/Profile screens open and save data

## 13. Common errors and fixes

### A) `firebase : The term 'firebase' is not recognized`
Use:

```powershell
npx firebase-tools <command>
```

or install globally:

```powershell
npm install -g firebase-tools
```

### B) `Not in a Firebase app directory (could not locate firebase.json)`
Run `firebase init` from project root (`D:\dikki`).

### C) Firestore location prompt (`eur3/nam5/nam7/...`)
Pick the region where your Firebase Firestore is created. For US multi-region projects, use `nam5`.

### D) Expo bundle missing package errors
Install missing package and retry:

```powershell
npm install <package-name>
```

## 14. Build Android release (EAS)

Install and login:

```powershell
npm install -g eas-cli
eas login
```

Configure once:

```powershell
eas build:configure
```

Build:

```powershell
eas build --platform android --profile production
```

Download artifact from EAS dashboard and test on real device.

## 15. Project structure (important paths)

- App entry: `App.js`
- Screens: `src/screens`
- Services: `src/services`
- Contexts: `src/context`
- Navigation: `src/navigation`
- Firebase rules: `firebase/firestore.rules`, `firebase/storage.rules`
- Cloud Functions: `firebase/functions/index.js`

## 16. Final checklist before sharing

- `.env` is not committed
- Firebase project set correctly
- Rules + functions deployed
- App runs on Android device
- Voice + notifications validated
- No blocking red screens or runtime errors
