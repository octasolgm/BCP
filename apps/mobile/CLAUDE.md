# CLAUDE.md - BCP Mobile Application

## App Purpose
React Native mobile app for compliance officers to:
- View simplified compliance dashboard on-the-go
- Receive push notifications for alerts (missed deadlines, new assignments)
- View and manage assigned action items
- Upload remediation documents (camera or file picker)
- Quick compliance status overview

## Tech Stack
- React Native 0.73+ with Expo SDK 50+
- TypeScript (strict mode)
- Expo Router (file-based navigation)
- React Native Paper (UI component library)
- React Native Chart Kit (dashboard charts)
- React Native Document Picker (file selection)
- Expo Image Picker (camera for document capture)
- Expo Notifications (push notifications)
- Expo SecureStore (encrypted token storage)
- Zustand (state management - shared logic with web)
- Axios via @bcp/api-client (HTTP client)
- React Hook Form + Zod (form validation)

## Setup Dependencies
When initializing this app, install:
- Core: expo, react, react-native, typescript
- Navigation: expo-router, react-native-screens, react-native-safe-area-context
- UI: react-native-paper, react-native-chart-kit, react-native-svg
- Files: react-native-document-picker, expo-image-picker, expo-file-system
- Storage: expo-secure-store
- Notifications: expo-notifications, expo-device
- State: zustand
- HTTP: axios (via @bcp/api-client)
- Forms: react-hook-form, @hookform/resolvers, zod
- Testing: jest, jest-expo, @testing-library/react-native, @testing-library/jest-native

## Folder Structure
src/
- components/
  - common/ (Button, Card, Badge, Input, Modal, Loader)
  - dashboard/ (MiniChart, MetricCard, ComplianceRing)
  - tasks/ (TaskCard, TaskList, ActionForm, RemediationUpload)
  - alerts/ (AlertItem, AlertBadge, AlertList)
- screens/
  - LoginScreen.tsx
  - DashboardScreen.tsx
  - TaskListScreen.tsx
  - TaskDetailScreen.tsx
  - AlertsScreen.tsx
  - ProfileScreen.tsx
  - SettingsScreen.tsx
- hooks/
  - useAuth.ts
  - useTasks.ts
  - useDashboard.ts
  - useAlerts.ts
  - useNotifications.ts
  - usePermissions.ts
- services/ (use @bcp/api-client where possible)
- store/ (Zustand stores - share with web where possible)
- navigation/
  - AppNavigator.tsx
- utils/
  - storage.ts (Expo SecureStore wrapper)
  - permissions.ts (Camera, notification permissions)
  - formatters.ts
- __tests__/ (mirror src structure)

app/ (Expo Router directory)
- _layout.tsx
- index.tsx
- login.tsx
- (tabs)/
  - _layout.tsx
  - dashboard.tsx
  - tasks.tsx
  - alerts.tsx
  - profile.tsx
- task/
  - [id].tsx

## Screen Descriptions

### DashboardScreen
- Compliance percentage ring/donut chart
- 3 metric cards (Compliant, Partial, Non-Compliant counts)
- Recent alerts preview (top 5)
- Pull-to-refresh
- Tap metric card to navigate to filtered task list

### TaskListScreen
- List of assigned action items
- Tabs: "My Tasks" | "Overdue" | "Completed"
- Each card shows: requirement text (truncated), status badge, due date, days remaining
- Tap card to navigate to TaskDetailScreen
- Pull-to-refresh
- Empty state for each tab

### TaskDetailScreen
- Full requirement text
- Current compliance status (with color badge)
- Action plan details
- Target date and days remaining
- "Upload Corrective Document" button (opens camera or file picker)
- Status update history timeline
- Notes section

### AlertsScreen
- Chronological list of all notifications
- Types: deadline_approaching, deadline_missed, action_assigned, status_changed
- Tap to navigate to related task
- Mark as read (auto on tap)
- Unread badge count

### LoginScreen
- Email + password fields
- Form validation with React Hook Form + Zod
- "Login" button with loading state
- Error display
- Biometric login option (future enhancement)

### ProfileScreen
- User name, email, role, department
- Logout button
- App version
- Help/Support link

## Push Notification Setup
- Use Expo Notifications for token registration
- Register token with backend on login
- Backend sends notifications via Firebase Cloud Messaging (FCM)
- Notification types:
  - DEADLINE_APPROACHING (3 days before due date)
  - DEADLINE_MISSED (day after due date)
  - ACTION_ASSIGNED (when manager assigns task)
  - STATUS_CHANGED (when compliance status updates)
- Handle notification tap: navigate to relevant screen
- Show in-app notification banner when app is open

## Component Rules
- Every component MUST have a corresponding .test.tsx file
- Use React Native Paper components as base (consistency)
- All forms use React Hook Form + Zod
- Loading states use ActivityIndicator or Skeleton
- All screens handle empty, loading, error, and success states
- Use SafeAreaView wrapper on all screens
- Optimize lists with FlatList (never .map() large arrays)

## Testing Strategy
- Unit tests: All hooks, utils, store functions (Jest)
- Component tests: React Native Testing Library
- Snapshot tests: For stable UI components
- Test file location: alongside source file
- Minimum coverage: 75% for components, 85% for hooks/utils
- No automated E2E in initial phase (manual testing on real devices)

## Security (Mobile Specific - Banking Critical)
- Store JWT tokens in Expo SecureStore ONLY (never AsyncStorage)
- Never log sensitive data
- Certificate pinning for production API calls (configure in app.json)
- Biometric authentication option (Face ID, Touch ID, Fingerprint)
- Auto-logout after 15 minutes of inactivity
- Detect rooted/jailbroken devices and warn user
- Disable screenshots in sensitive screens (Android FLAG_SECURE)
- Clear sensitive data from memory on app background

## Environment Variables
EXPO_PUBLIC_API_URL=http://localhost:4000/api/v1
EXPO_PUBLIC_APP_NAME=BCP Mobile
EXPO_PUBLIC_APP_VERSION=1.0.0

## NPM Scripts to Configure
- start: expo start
- android: expo start --android
- ios: expo start --ios
- web: expo start --web
- test: jest
- test:coverage: jest --coverage
- lint: eslint . --ext ts,tsx
- format: prettier --write .
- build:android: eas build --platform android
- build:ios: eas build --platform ios

## Permissions Required
- Camera (for document capture)
- Media Library (for selecting documents)
- Notifications (for push alerts)
- Biometric (Face ID / Touch ID - optional)
