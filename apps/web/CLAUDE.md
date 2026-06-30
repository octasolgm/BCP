# CLAUDE.md - BCP Web Application

## App Purpose
React web dashboard for compliance officers and managers to:
- Upload regulatory and internal documents
- View AI-generated compliance analysis
- Manage action plans for non-compliant items
- View MIS dashboard with compliance metrics
- Export reports as Excel files
- Manage users and settings (admin only)

## Tech Stack
- React 18 + TypeScript (strict mode)
- Vite (build tool)
- TailwindCSS (styling)
- React Router DOM v6 (routing)
- TanStack Table v8 (data grids for compliance items)
- Recharts (dashboard charts)
- React Dropzone (file upload)
- Zustand (state management)
- Axios via @bcp/api-client package (HTTP client)
- React Hook Form + Zod (form validation)
- React Hot Toast (notifications)
- Lucide React (icons)

## Setup Dependencies
When initializing this app, install:
- Core: react, react-dom, react-router-dom, typescript, vite
- UI: tailwindcss, @tailwindcss/vite, lucide-react, react-hot-toast
- Data: @tanstack/react-table, recharts, react-dropzone
- State: zustand
- HTTP: axios (via @bcp/api-client)
- Forms: react-hook-form, @hookform/resolvers, zod
- Testing: vitest, @testing-library/react, @testing-library/jest-dom, @testing-library/user-event, jsdom, @playwright/test, msw

## Folder Structure
src/
- components/
  - common/ (Button, Input, Modal, Badge, Card, Skeleton)
  - layout/ (Header, Sidebar, Footer, PageLayout, ProtectedRoute)
  - dashboard/ (ComplianceChart, MetricCard, AlertBanner, RecentActivity)
  - upload/ (FileUploader, FileList, UploadProgress, FormatBadges)
  - compliance/ (ComplianceGrid, StatusBadge, ActionForm, ItemDetails)
  - reports/ (ExcelExportButton, ReportSummary, FilterPanel)
- pages/
  - LoginPage.tsx
  - DashboardPage.tsx
  - UploadAnalysisPage.tsx
  - ComplianceReportPage.tsx
  - ActionTrackerPage.tsx
  - BulkUploadPage.tsx
  - AlertsPage.tsx
  - AuditLogPage.tsx
  - SettingsPage.tsx
  - NotFoundPage.tsx
- hooks/
  - useAuth.ts
  - useDocuments.ts
  - useAnalysis.ts
  - useComplianceItems.ts
  - useDashboard.ts
  - useAlerts.ts
- services/
  - authService.ts
  - documentService.ts
  - analysisService.ts
  - complianceService.ts
  - reportService.ts
  - alertService.ts
- store/
  - authStore.ts
  - documentStore.ts
  - uiStore.ts
- types/ (only for web-specific types; cross-app types go in shared-types)
- utils/
  - formatters.ts
  - validators.ts
  - constants.ts
- __tests__/ (mirror src structure)
- App.tsx
- Router.tsx
- main.tsx
- index.css

## Page Descriptions

### DashboardPage (MIS)
- Pie chart: Compliant vs Partial vs Non-Compliant percentages
- Bar chart: Compliance by regulation/document
- Metric cards: Total items, compliance %, overdue actions
- Recent alerts list (top 5)
- Quick action buttons

### UploadAnalysisPage
- Two file upload zones: "Requirement Document" and "Internal Documents"
- Supported format badges (PDF, DOCX, XLSX, HTML, JPEG, PNG)
- "Compare & Analyze" button
- Processing progress indicator (polling backend status)
- Results redirect to ComplianceReportPage

### ComplianceReportPage
- Full data grid (TanStack Table) showing all compliance items
- Columns: Requirement Text, Internal Match, Status (color badge), Target Date, Action Plan, Responsibility
- Filter by status (All/Compliant/Partial/Non-Compliant)
- Search across requirement text
- "Export to Excel" button
- Click row to expand details and assign actions

### ActionTrackerPage
- List of Partial/Non-Compliant items with assigned actions
- Filter by: My Actions, All Actions, Overdue, Upcoming
- Upload remediation document button per item
- Status timeline showing progression

### BulkUploadPage (Step 2 of project scope)
- Multi-file upload zone
- Processing queue with status per file
- Combined results dashboard

## Component Rules
- Every component MUST have a corresponding .test.tsx file
- Use React.memo for expensive render components (grids, charts)
- Use Suspense + lazy loading for page-level code splitting
- All forms use React Hook Form + Zod schema validation
- Error boundaries wrap each major section
- Loading states use skeleton loaders, not spinners
- All interactive elements must be keyboard accessible (ARIA labels)
- Use TailwindCSS classes only (no inline styles, no CSS modules)

## State Management (Zustand)
- authStore: user, accessToken, refreshToken, login(), logout(), refreshAuth()
- documentStore: documents[], uploadDocument(), deleteDocument(), refetch()
- uiStore: sidebarOpen, theme, globalLoading

## Testing Strategy
- Unit tests: All hooks, utils, store functions (Vitest)
- Component tests: All components with React Testing Library
- Integration tests: Page-level tests with MSW (Mock Service Worker)
- E2E tests: Playwright for critical flows
- Test file location: alongside source file (ComplianceGrid.test.tsx next to ComplianceGrid.tsx)
- Minimum coverage: 75% for components, 85% for hooks/utils

## E2E Test Scenarios (Critical Flows)
1. Login → Upload requirement PDF → Upload internal doc → Analyze → View report → Export Excel
2. Login as manager → Open non-compliant item → Assign person → Set target date → Save
3. Login → Open task → Upload remediation document → Verify status changes
4. Login → Verify dashboard shows correct metrics

## Environment Variables
VITE_API_URL=http://localhost:4000/api/v1
VITE_APP_NAME=BCP - Bank Compliance Platform
VITE_APP_VERSION=1.0.0

## NPM Scripts to Configure
- dev: vite (port 5173)
- build: tsc + vite build
- preview: vite preview
- test: vitest
- test:coverage: vitest run --coverage
- test:e2e: playwright test
- lint: eslint src --ext ts,tsx
- format: prettier --write src

## Banking-Specific Rules
- Never store JWT tokens in localStorage (use httpOnly cookies or memory)
- Auto-logout after 15 minutes of inactivity
- Mask sensitive data in UI (account numbers, etc.)
- All API calls go through @bcp/api-client (never direct axios)
- Audit log every user action via backend API
