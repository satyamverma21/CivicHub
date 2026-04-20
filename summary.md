# PROJECT SUMMARY FOR MCA DISSERTATION

## 1. Project Title & Overview
**Project Title:** **Dikki – College Complaint Management System** (repository/app identity: **Community Issue App**)

Dikki is a full-stack, role-based complaint management platform for colleges/communities. It allows users (students/citizens) to submit complaints with category, location, and image evidence; authorities to handle assigned complaints and post progress; heads/super-admins to approve authority access, assign tags, manage channels/users/issues, and monitor analytics. The frontend is built with Expo React Native and the backend is an Express API with SQLite persistence and local file storage for uploaded images.

## 2. Problem Statement
Current complaint handling in many institutions is fragmented (manual forms, chats, calls), slow, and hard to audit. Users often cannot track progress, while admins cannot reliably monitor accountability and closure rates.

This project solves that by introducing a single workflow-driven system with status transitions, role-based governance, notifications, and dashboard-level visibility. It is worth solving because unresolved grievances directly affect student/community trust, service quality, and institutional transparency.

## 3. Why This Topic Was Chosen
### Present state of the art and limitations
Existing channels (email groups, generic form tools, informal messaging, ad-hoc spreadsheets) typically lack:
1. Structured role hierarchy (User/Authority/Head/SuperAdmin).
2. Complaint lifecycle controls (open → in_progress → resolved → closed).
3. Integrated assignment, progress updates, and status history.
4. Centralized analytics and moderation actions.

### Gap this project fills
Dikki fills this gap with one integrated system combining:
1. Complaint intake + media upload.
2. Authority assignment (manual + tag-based relevance).
3. Resolution workspace (status, notes, progress evidence, possible solutions including AI-generated suggestions).
4. Governance modules (channel/user/authority administration) and operational analytics.

## 4. Objectives & Scope
### Primary objectives
- Digitize complaint registration and tracking in a structured workflow.
- Provide role-based access control and approvals.
- Improve accountability with progress updates, history, and notifications.
- Support super-admin governance for channels, users, authorities, and issues.
- Add reliability features (offline queue/cache, retry/timeout, sanitization, rate limiting).

### In scope
- Mobile app screens: authentication, feed, create/view/edit complaint, comments, progress, role dashboards, settings/profile.
- REST backend APIs under `/api/*` for auth, issues, authority/head/superadmin operations, notifications, and error logging.
- SQLite schema and local uploads storage.
- AI-assisted solution generation (`/api/issues/:id/possible-solutions/generate`) via NVIDIA NIM compatible chat completion.

### Out of scope
- Cloud-hosted production deployment and horizontal scaling.
- Advanced analytics KPIs like real computed mean resolution time (currently placeholder fields are returned as `0` in some endpoints).
- SMS/email delivery channels.
- End-to-end automated test suite (not present in current repo scripts).

## 5. Tech Stack & Architecture
### Frontend
- **React Native + Expo** (`expo`, `react-native`, `react`)
- **Navigation:** `@react-navigation/native`, `@react-navigation/native-stack`
- **State/context:** custom contexts (`AuthContext`, `ThemeContext`, `ToastContext`)
- **Storage/offline:** `@react-native-async-storage/async-storage`, `@react-native-community/netinfo`
- **Media/UX:** `expo-image-picker`, `expo-image-manipulator`, `expo-file-system`, `expo-notifications`, `expo-clipboard`, `expo-av`
- **UI patterns:** custom reusable components (`IssueCard`, `ImageCarousel`, `StatusBadge`, `CategoryBadge`, etc.)

### Backend
- **Node.js + Express**
- **Auth/security:** `jsonwebtoken` (JWT), `bcryptjs` (password hashing), input sanitization, role middleware, daily rate-limiting table
- **File upload:** `multer` (image uploads, 5 files max, 5MB each, image MIME/extension checks)
- **Database:** `sqlite` + `sqlite3` (`backend\data.sqlite`, WAL mode)
- **AI integration:** `openai` SDK against NVIDIA NIM base URL/models (with fallback model sequence)

### Database
- SQLite relational tables with JSON-serialized fields for flexible arrays/objects.

### Architecture style
- 3-layer practical architecture:
1. **Presentation layer:** React Native screens/components.
2. **Service/API layer:** frontend `src/services/*` + backend route handlers.
3. **Persistence layer:** SQLite + filesystem uploads (`backend\uploads\images`).

## 6. Hardware & Software Requirements
### Hardware (development/runtime)
- 64-bit machine (Windows/Linux/macOS).
- Minimum 4 GB RAM (8 GB recommended for emulator + Metro + backend together).
- Stable internet for npm installs, Expo tooling, and optional external APIs (LocationIQ/NIM).
- Android device/emulator (or iOS simulator on macOS) for mobile runtime.

### Software
- Node.js **20+**
- npm
- Expo CLI runtime (`npm start` via package scripts)
- Backend dependencies from `backend\package.json`
- Environment variables:
  - Frontend: `EXPO_PUBLIC_API_URL`, optional `EXPO_PUBLIC_LOCATIONIQ_API_KEY`
  - Backend: `PORT`, `JWT_SECRET`, optional `NIM_API_KEY` / `NVIDIA_API_KEY`, `NIM_BASE_URL`, `NIM_MODEL`, `NIM_FALLBACK_MODELS`

## 7. Methodology & SDLC Approach
### SDLC model followed
An **iterative Agile-style approach** is reflected in the codebase: modular screen/service growth, role-wise feature increments, and incremental backend endpoint expansion. This is suitable because complaint systems evolve with stakeholder feedback (students, authorities, admins).

### Requirement phase summary
- Core actors identified: **User, Authority, Head, SuperAdmin**.
- Core workflows defined: signup/login, complaint reporting, assignment, status progression, moderation, analytics.
- Non-functional needs identified: offline support, notifications, sanitization, and basic abuse control (rate limit for comments).

### Design phase summary
- Frontend designed as role-driven navigation stacks (`AuthStack`, `AppStack`, `RootNavigator`).
- Backend designed as REST endpoints grouped by concern (`/auth`, `/issues`, `/head`, `/superadmin`, `/notifications`).
- Data model designed around `users`, `channels`, `issues`, and auxiliary audit/notification/request tables.

### Development phase summary
- Implemented authentication and token lifecycle (`auth_tokens` table).
- Implemented complaint CRUD + interactions (likes, comments, progress, status history, solutions).
- Implemented role dashboards and admin operations.
- Added offline cache/queue and push-notification token registration.

### Testing phase summary
- Current implementation is primarily structured for **manual functional testing** via emulator/device and API interactions.
- Defensive coding includes validation checks, role guards, upload constraints, and explicit HTTP error messages.
- No dedicated automated unit/integration test suite is configured in package scripts at present.

## 8. Key Features & Modules
1. **Authentication & Role Onboarding** (`LoginScreen`, `HeadSignupScreen`, `UserSignupScreen`, `/api/auth/*`): supports Head registration with auto channel creation, User/Authority signup with channel ID validation, and Authority pending-approval flow.
2. **Role-based Navigation & Access** (`RootNavigator`, `AppStack`, backend `role(...)` middleware): routes and actions are filtered by role (Authority/Head/SuperAdmin governance controls).
3. **Complaint Creation Module** (`CreateIssueScreen`, `createIssue`, `/api/issues`): accepts title, description, category, optional manual/auto-detected location, and up to 5 images with upload validation.
4. **Complaint Feed Module** (`FeedScreen`, `/api/issues/feed`): supports pagination, status/category/date/author filters, search, sort (recent/most-liked/most-commented), and cached offline fallback.
5. **Complaint Detail & Interaction Module** (`IssueDetailScreen`): like/unlike, comments, sharing, edit/delete controls, status timeline, and progress timeline with evidence images.
6. **Workflow Management Module** (`IssueManagementScreen`, `/api/issues/:id/status`, `/api/issues/:id/assign`): controlled status transitions and authority assignment by authorized roles.
7. **Possible Solutions Module** (`IssueSolutionsScreen`, `/possible-solutions*` endpoints): manual solution steps, “mark applied”, notes, plus AI-generated actionable suggestions via NIM.
8. **Authority Productivity Module** (`AuthorityDashboardScreen`, `AuthorityPersonalizedFeedScreen`): grouped issue views by status and personalized feed based on assignment + department tags.
9. **Authority Tag Governance Module** (`AuthorityTagManagerScreen`, `/api/authorities/:id/tags`): Head/SuperAdmin can map authorities to categories (Academic, Hostel, etc.) for smarter routing.
10. **Head Governance Module** (`HeadDashboardScreen`, `/api/head/*`): approve/reject authority join requests and monitor authority-level assignment/resolution stats.
11. **SuperAdmin Control Tower** (`SuperAdminDashboardScreen`, `/api/superadmin/*`): channel/user/authority/issue management, bulk operations, force status override, authority-request moderation, analytics.
12. **Profile & Settings Module** (`ProfileScreen`, `SettingsScreen`, `/api/users/me*`): user profile edits, privacy toggles, notification preferences, theme mode selection, account deletion/sign-out.
13. **Notification Module** (`/api/notifications*`, `notifications.js`): stores/read-marks in DB and registers Expo push tokens on supported devices.
14. **Offline & Reliability Module** (`offlineStore.js`, `syncOfflineActions`, `retry.js`, `sanitization.js`): caches feed/issues/comments, queues offline actions, retries network operations, sanitizes user text.

## 9. Database Design Summary
### Major entities/tables
- `users`
- `channels`
- `channel_requests`
- `issues`
- `comments`
- `progress_updates`
- `notifications`
- `logs`
- `suspended_users`
- `auth_tokens`
- `daily_limits`

### Key relationships
1. **channels (1) → users (many)** via `users.channel_id`
2. **users (1) → issues (many)** via `issues.author_id`
3. **channels (1) → issues (many)** via `issues.channel_id`
4. **issues (1) → comments (many)** via `comments.issue_id`
5. **issues (1) → progress_updates (many)** via `progress_updates.issue_id`
6. **users (1) → notifications (many)** via `notifications.user_id`
7. **users (1) → channel_requests (many)** via `channel_requests.user_id`

### Important fields/constraints
- `users.email` is `UNIQUE NOT NULL`.
- Primary keys are text IDs (`id`, token IDs, etc.).
- `issues.status` defaults to `open`; status history kept in `status_history_json`.
- `issues.assigned_authorities_json`, `likes_json`, `images_json`, `possible_solutions_json` are JSON text fields.
- `daily_limits` table enforces per-user/day count (used for comment throttling).
- `notifications.read` stores read/unread state (`0/1`).

## 10. Input & Output Design
### Main inputs
- Auth forms: email, password, role, channel ID, organization name.
- Complaint form: title, description, category, location (manual/auto), image uploads.
- Interaction inputs: comment text, progress text + images, status note, solution note/manual steps.
- Admin inputs: user role changes, suspend reasons, channel edits, authority approvals, bulk selections.
- API query inputs: status/category/search/page/pageSize/channel filters.

### Main outputs
- Mobile dashboards and list views (feed, role dashboards, profile stats).
- Structured API JSON responses (issue objects, grouped dashboard buckets, analytics aggregates).
- Notification items (unread/read tracking).
- Analytics outputs: `overview`, `issuesOverTime`, `issuesByCategory`, `issuesByStatus`, `issuesByChannel`, `authorityPerformance`.

## 11. Testing Approach
### Testing done/planned
- **Manual UI/system testing:** signup/login, complaint lifecycle, dashboard access by role, notifications, offline/online behavior.
- **API behavior testing:** endpoint-level validation through frontend integration and runtime checks.
- **Acceptance testing (planned/continuous):** role-specific user journeys for User/Authority/Head/SuperAdmin.

### Tools used / intended
- Expo runtime (device/emulator) for functional testing.
- Node/Express runtime logs and `/api/logs/error` collection for diagnosing failures.
- (Future) unit/integration setup can be added with Jest + supertest + React Native Testing Library.

## 12. Value Addition / Contribution
This project contributes a complete, practical complaint-governance system that combines citizen/student reporting, authority execution, and multi-level administration in one platform. Notable value additions are category-tag based authority routing, integrated progress evidence, role-segregated dashboards, and AI-assisted solution drafting inside the same workflow.

Beneficiaries include students/citizens (faster visibility and tracking), authorities (structured assignment and workflow), heads/admins (approval and oversight), and institutions (higher transparency and actionable analytics).

## 13. Limitations & Constraints
- Uses local SQLite and filesystem storage; not yet a distributed/cloud architecture.
- Several advanced analytics metrics (e.g., average resolution time) are currently placeholders in API output.
- No built-in automated test suite scripts in current repository.
- Location reverse geocoding and AI generation depend on external API keys/services.
- Push notifications depend on device permission and Expo token registration success.

## 14. Conclusion & Future Scope
### Conclusion
Dikki demonstrates an end-to-end, role-aware grievance management system with clear complaint lifecycle control, media-backed evidence, and governance workflows suitable for educational/public-service environments. Its architecture is modular enough for further scaling and productization.

### Future scope
1. Cloud migration (managed DB/object storage, containerized backend, secure secrets handling).
2. Automated testing pipeline (unit, integration, end-to-end).
3. SLA engine with escalation rules and real resolution-time metrics.
4. Rich communication features (threaded mentions, email/SMS notifications).
5. Multi-tenant hard isolation and audit exports for compliance.
6. Predictive prioritization and recommendation analytics on complaint trends.

## 15. Suggested References
1. React Native Documentation. *React Native*. https://reactnative.dev/docs/getting-started  
2. Expo Documentation. *Expo SDK*. https://docs.expo.dev/  
3. Express.js Documentation. *Express – Node.js Web Framework*. https://expressjs.com/  
4. SQLite Documentation. *SQLite Official Docs*. https://www.sqlite.org/docs.html  
5. JWT RFC 7519. *JSON Web Token (JWT)*. https://www.rfc-editor.org/rfc/rfc7519  
6. OWASP Foundation. *OWASP Top 10 Web Application Security Risks*. https://owasp.org/www-project-top-ten/  
7. OpenAI Node SDK Documentation (used with NIM-compatible endpoint pattern). https://github.com/openai/openai-node  
8. NVIDIA Docs. *NVIDIA NIM / AI Endpoints*. https://docs.api.nvidia.com/

