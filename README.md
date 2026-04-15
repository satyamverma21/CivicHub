# Community Issue App (Prompts 1-6)

## Setup

1. Install app dependencies:
   - `npm install`
2. Install Cloud Functions dependencies:
   - `cd firebase/functions && npm install && cd ../..`
3. Add `.env` (see `.env.example`):
   - `EXPO_PUBLIC_FIREBASE_API_KEY`
   - `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN`
   - `EXPO_PUBLIC_FIREBASE_PROJECT_ID`
   - `EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET`
   - `EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
   - `EXPO_PUBLIC_FIREBASE_APP_ID`
   - `EXPO_PUBLIC_FIREBASE_FUNCTIONS_REGION` (default `us-central1`)
4. Configure backend env vars for functions:
   - `ANTHROPIC_API_KEY`
   - `CLAUDE_MODEL` (optional)
5. Enable Google Speech-to-Text API in Google Cloud.
6. Deploy Firebase assets:
   - `firebase deploy --only firestore:rules,storage:rules,functions`
7. Start app:
   - `npm start`

## Implemented Final Features

- Voice issue recording, transcription, AI refinement, summary generation, keyword extraction, authority suggestions.
- AI metadata on issues (`audioUrl`, `isAIRefined`, `aiSummary`, `refinedBy`, `keywords`, `isVoiceReport`).
- Offline support with local cache + queue for issue create/comment/like; background sync on reconnect.
- Push notification registration and notification-tap deep link handling.
- Notification trigger function for Firestore `notifications` documents (FCM token and Expo push token support).
- Enhanced feed search/filter/saved filters + additional sorting options.
- Dark mode system with persisted setting (System/Light/Dark).
- Settings screen (privacy, notification toggles, theme, language placeholder, logout, delete account).
- Profile screen (editable profile + stats + own issues/comments list).
- Rate limiting: issue creation (5/day) and comments (20/day).
- Retry + timeout utility for uploads/network operations.
- Image optimization before upload (resize/compress).
- Accessibility additions (image labels, better press targets on key actions).

## Final Deployment Checklist

- [ ] All screens navigable
- [ ] All buttons functional
- [ ] No console errors/warnings
- [ ] Offline mode works
- [ ] Notifications work
- [ ] Images upload/load correctly
- [ ] Voice-to-text works with short audio
- [ ] Dark mode applies correctly
- [ ] Search and filters work
- [ ] Role-based access enforced
- [ ] Firebase rules deployed
- [ ] Error messages user-friendly
- [ ] Loading states visible
- [ ] Performance acceptable on real device
- [ ] Build release APK via EAS

## Android Release Build

1. Login to Expo/EAS:
   - `eas login`
2. Build Android release:
   - `eas build --platform android --profile production`
3. Download APK/AAB from EAS dashboard and test on real Android device.
