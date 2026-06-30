# CLAUDE.md - BCP Backend API

## App Purpose
Node.js REST API server that handles:
- User authentication and authorization (JWT + RBAC)
- File upload and storage management
- Communication with Python AI engine for document analysis
- Compliance item CRUD and tracking
- Excel report generation (matching client template)
- Alert/notification management (email + push)
- Audit trail logging for every action
- Background job processing (BullMQ)
- CRON jobs for deadline checking

## Tech Stack
- Node.js 18+ + TypeScript (strict mode)
- Express.js (HTTP framework)
- Prisma ORM (PostgreSQL database access)
- BullMQ + ioredis (async job queue)
- ExcelJS (Excel file generation)
- Multer (file upload handling)
- jsonwebtoken (JWT authentication)
- bcryptjs (password hashing)
- Nodemailer (email sending)
- firebase-admin (push notifications)
- Helmet + CORS (security headers)
- express-rate-limit (rate limiting)
- Zod (request validation)
- Winston (structured logging)
- node-cron (scheduled tasks)
- uuid (ID generation)

## Setup Dependencies
When initializing this app, install:
- Core: express, typescript, tsx, ts-node
- DB: prisma, @prisma/client
- Queue: bullmq, ioredis
- Files: multer, exceljs
- Auth: jsonwebtoken, bcryptjs
- Notifications: nodemailer, firebase-admin
- Security: helmet, cors, express-rate-limit
- Validation: zod
- Logging: winston
- Utils: node-cron, uuid, dotenv
- Types: @types/express, @types/multer, @types/jsonwebtoken, @types/bcryptjs, @types/nodemailer, @types/cors, @types/uuid, @types/node-cron
- Testing: vitest, supertest, @types/supertest

## Folder Structure
src/
- config/
  - database.ts (Prisma client singleton)
  - redis.ts (Redis connection)
  - queue.ts (BullMQ queue setup)
  - firebase.ts (FCM setup)
  - email.ts (Nodemailer transporter)
  - logger.ts (Winston logger)
  - env.ts (Zod-validated environment variables)
- middleware/
  - auth.ts (JWT verification)
  - rbac.ts (Role-based access control)
  - validate.ts (Zod request validation)
  - upload.ts (Multer file upload config + validation)
  - rateLimiter.ts (Rate limiting per endpoint)
  - errorHandler.ts (Global error handler)
  - auditLog.ts (Audit trail middleware)
  - requestLogger.ts (Request logging)
- routes/
  - index.ts (Route aggregator)
  - authRoutes.ts
  - documentRoutes.ts
  - analysisRoutes.ts
  - complianceRoutes.ts
  - reportRoutes.ts
  - alertRoutes.ts
  - userRoutes.ts
  - dashboardRoutes.ts
- controllers/
  - authController.ts
  - documentController.ts
  - analysisController.ts
  - complianceController.ts
  - reportController.ts
  - alertController.ts
  - userController.ts
  - dashboardController.ts
- services/
  - authService.ts (Login, register, token management)
  - documentService.ts (File storage, metadata CRUD)
  - analysisService.ts (Communicate with AI engine)
  - complianceService.ts (Compliance item CRUD)
  - reportService.ts (Excel generation)
  - alertService.ts (Email + push notification)
  - userService.ts (User CRUD, role management)
  - dashboardService.ts (Aggregate metrics)
  - auditService.ts (Audit log operations)
- jobs/
  - analysisJob.ts (Background analysis processing)
  - alertJob.ts (Deadline checking CRON)
  - cleanupJob.ts (Temp file cleanup)
  - workers.ts (BullMQ worker registration)
- utils/
  - apiResponse.ts (Standardized response format)
  - appError.ts (Custom error class)
  - fileValidator.ts (MIME + magic byte validation)
  - excelTemplate.ts (Excel report template builder)
  - helpers.ts
- __tests__/
  - unit/ (Service and util tests)
  - integration/ (API endpoint tests with Supertest)
  - setup.ts (Test setup/teardown)
- app.ts (Express app setup)
- server.ts (HTTP server entry point)

prisma/
- schema.prisma
- migrations/
- seed.ts

## Prisma Schema (Critical - Use This Exact Schema)

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum UserRole {
  ADMIN
  COMPLIANCE_OFFICER
  MANAGER
  VIEWER
}

enum DocumentType {
  REQUIREMENT
  INTERNAL
  REMEDIATION
}

enum DocumentFormat {
  PDF
  DOCX
  XLSX
  HTML
  JPEG
  PNG
  TXT
}

enum ComplianceLevel {
  COMPLIANT
  PARTIAL_COMPLIANT
  NON_COMPLIANT
}

enum AnalysisStatus {
  PENDING
  PROCESSING
  COMPLETED
  FAILED
}

enum AlertType {
  DEADLINE_APPROACHING
  DEADLINE_MISSED
  ACTION_ASSIGNED
  STATUS_CHANGED
}

model User {
  id           String   @id @default(uuid())
  email        String   @unique
  passwordHash String
  name         String
  role         UserRole @default(VIEWER)
  department   String?
  isActive     Boolean  @default(true)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  documents        Document[]
  analysisSessions AnalysisSession[]
  assignedItems    ComplianceItem[]  @relation("AssignedTo")
  alerts           Alert[]
  auditLogs        AuditLog[]
}

model Document {
  id            String         @id @default(uuid())
  userId        String
  type          DocumentType
  format        DocumentFormat
  filename      String
  originalName  String
  filePath      String
  fileSize      Int
  extractedText String?        @db.Text
  status        AnalysisStatus @default(PENDING)
  createdAt     DateTime       @default(now())
  updatedAt     DateTime       @updatedAt
  user             User              @relation(fields: [userId], references: [id])
  requirementFor   AnalysisSession[] @relation("RequirementDoc")
  internalFor      AnalysisSession[] @relation("InternalDocs")
  remediationItems ComplianceItem[]  @relation("RemediationDoc")
}

model AnalysisSession {
  id                String         @id @default(uuid())
  userId            String
  requirementDocId  String
  status            AnalysisStatus @default(PENDING)
  totalItems        Int?
  compliantCount    Int?
  partialCount      Int?
  nonCompliantCount Int?
  completedAt       DateTime?
  createdAt         DateTime       @default(now())
  updatedAt         DateTime       @updatedAt
  user           User             @relation(fields: [userId], references: [id])
  requirementDoc Document         @relation("RequirementDoc", fields: [requirementDocId], references: [id])
  internalDocs   Document[]       @relation("InternalDocs")
  items          ComplianceItem[]
}

model ComplianceItem {
  id                   String          @id @default(uuid())
  sessionId            String
  requirementText      String          @db.Text
  requirementArticle   String?
  internalMatchText    String?         @db.Text
  internalDocReference String?
  complianceLevel      ComplianceLevel
  aiJustification      String?         @db.Text
  confidenceScore      Float?
  targetDate           DateTime?
  actionPlan           String?         @db.Text
  responsiblePersonId  String?
  remediationDocId     String?
  remediationStatus    AnalysisStatus?
  createdAt            DateTime        @default(now())
  updatedAt            DateTime        @updatedAt
  session         AnalysisSession @relation(fields: [sessionId], references: [id])
  responsibleUser User?           @relation("AssignedTo", fields: [responsiblePersonId], references: [id])
  remediationDoc  Document?       @relation("RemediationDoc", fields: [remediationDocId], references: [id])
  alerts          Alert[]
}

model Alert {
  id               String    @id @default(uuid())
  userId           String
  complianceItemId String?
  alertType        AlertType
  title            String
  message          String    @db.Text
  isRead           Boolean   @default(false)
  sentViaEmail     Boolean   @default(false)
  sentViaPush      Boolean   @default(false)
  sentAt           DateTime?
  createdAt        DateTime  @default(now())
  user           User            @relation(fields: [userId], references: [id])
  complianceItem ComplianceItem? @relation(fields: [complianceItemId], references: [id])
}

model AuditLog {
  id         String   @id @default(uuid())
  userId     String
  action     String
  entityType String
  entityId   String?
  details    Json?
  ipAddress  String?
  userAgent  String?
  createdAt  DateTime @default(now())
  user User @relation(fields: [userId], references: [id])
}

## Standardized API Response Format

Success Response:
{
  "success": true,
  "data": { },
  "message": "Operation successful",
  "meta": { "page": 1, "limit": 20, "total": 100 }
}

Error Response:
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "File type not supported",
    "details": []
  }
}

## Error Codes
- 400: VALIDATION_ERROR, INVALID_FILE_TYPE, FILE_TOO_LARGE
- 401: UNAUTHORIZED, TOKEN_EXPIRED, INVALID_CREDENTIALS
- 403: FORBIDDEN, INSUFFICIENT_ROLE
- 404: NOT_FOUND, DOCUMENT_NOT_FOUND, SESSION_NOT_FOUND
- 409: CONFLICT, DUPLICATE_EMAIL
- 429: RATE_LIMIT_EXCEEDED
- 500: INTERNAL_ERROR, AI_ENGINE_ERROR, DATABASE_ERROR

## Background Jobs (BullMQ Queues)
- analysis-queue: Process document analysis requests asynchronously
- alert-queue: Send email/push notifications
- cleanup-queue: Clean temp files older than 24 hours

## CRON Jobs (node-cron)
- Every day at 9:00 AM: Check for approaching deadlines (3 days before)
- Every day at 9:00 AM: Check for missed deadlines (mark as overdue)
- Every Sunday at 2:00 AM: Cleanup temporary files

## Security Checklist (Every Endpoint MUST Have)
1. Authentication middleware (JWT verification)
2. RBAC middleware (role check based on endpoint requirement)
3. Input validation (Zod schema)
4. Rate limiting (100 req/min default, stricter on auth endpoints)
5. Audit log entry (action, user, timestamp, IP)
6. Sanitized error response (never expose stack traces or internal details)

## File Upload Rules
- Max file size: 50 MB
- Allowed MIME types: application/pdf, application/vnd.openxmlformats-officedocument.wordprocessingml.document, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, text/html, image/jpeg, image/png, text/plain
- Validate BOTH MIME type AND magic bytes (file signature)
- Store outside web root in /uploads directory
- Generate UUID filename (never use user-provided name)
- Scan with virus scanner (ClamAV) before processing
- Files only accessible through authenticated API (no direct URL)

## Testing Strategy
- Unit tests (Vitest): All services, utils, middleware logic
- Integration tests (Vitest + Supertest): Every API endpoint
- Test database: Separate PostgreSQL database (bcp_test_db)
- Use factories/fixtures for test data (faker.js)
- Mock external services: AI engine, email (Nodemailer), FCM
- Minimum coverage: 85% services, 80% controllers
- Run tests in parallel where possible

## Environment Variables (.env)
NODE_ENV=development
PORT=4000
DATABASE_URL=postgresql://user:password@localhost:5432/bcp_db
TEST_DATABASE_URL=postgresql://user:password@localhost:5432/bcp_test_db
REDIS_URL=redis://localhost:6379
JWT_SECRET=change-in-production-min-32-chars
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
AI_ENGINE_URL=http://localhost:8000
UPLOAD_DIR=./uploads
GENERATED_DIR=./generated
MAX_FILE_SIZE_MB=50
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=alerts@bank.com
SMTP_PASS=xxx
SMTP_FROM=BCP Alerts <alerts@bank.com>
FCM_SERVER_KEY=your-firebase-key
LOG_LEVEL=info
CORS_ORIGIN=http://localhost:5173

## NPM Scripts to Configure
- dev: tsx watch src/server.ts
- build: tsc
- start: node dist/server.js
- test: vitest
- test:coverage: vitest run --coverage
- test:int: vitest run src/__tests__/integration
- migrate: prisma migrate dev
- migrate:deploy: prisma migrate deploy
- seed: tsx prisma/seed.ts
- generate: prisma generate
- studio: prisma studio
- lint: eslint src --ext ts
- format: prettier --write src

## Banking-Critical Rules
- NEVER log passwords, tokens, or full document content
- ALWAYS hash passwords with bcrypt (12 salt rounds)
- ALWAYS use Prisma parameterized queries (no raw SQL with user input)
- ALWAYS verify JWT signature and expiry on every request
- ALWAYS check user role before allowing actions
- ALWAYS create audit log entry for sensitive actions
- NEVER send bank document content to external cloud APIs
- ALWAYS sanitize file names before storage
- ALWAYS validate file content matches claimed type
