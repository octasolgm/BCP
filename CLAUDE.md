# CLAUDE.md - BCP Root Project Instructions

## Project Overview
BCP (Bank Compliance Platform) is an AI-powered regulatory compliance gap analysis tool for banking institutions. It compares regulatory requirement documents against internal bank process documents and generates compliance reports.

## Architecture
Monorepo with npm workspaces:
- apps/web - React + Vite + TypeScript web dashboard
- apps/mobile - React Native + Expo mobile app
- apps/backend - Node.js + Express + TypeScript + Prisma API server
- apps/ai-engine - Python + FastAPI AI/ML processing engine
- packages/shared-types - Shared TypeScript types
- packages/shared-utils - Shared utility functions
- packages/shared-ui - Shared UI components
- packages/shared-constants - Shared constants
- packages/api-client - Typed API client SDK

## Core Business Logic
1. User uploads regulatory PDF (e.g., UAE Cabinet Decision No. 74)
2. User uploads internal bank process documents (Word/PDF/Excel)
3. AI extracts requirement points from regulatory file
4. AI compares each point against internal documents using semantic search + LLM
5. Each requirement gets classified: Compliant / Partial Compliant / Non-Compliant
6. Non-compliant items get action plans with target dates and responsibilities
7. System generates Excel report matching client template format
8. Dashboard shows overall compliance metrics
9. Alerts sent for missed deadlines
10. When corrective docs uploaded, system re-evaluates and updates status

## Tech Stack
- Frontend Web: React 18 + Vite + TypeScript + TailwindCSS + Recharts + TanStack Table
- Frontend Mobile: React Native + Expo + React Navigation
- Backend: Node.js 18+ + Express + TypeScript + Prisma ORM + BullMQ + ExcelJS
- AI Engine: Python 3.10+ + FastAPI + LangChain + Ollama (Llama 3) + pdfplumber + Tesseract OCR
- Database: PostgreSQL 15+ with pgvector extension
- Cache/Queue: Redis 7+
- Auth: JWT with refresh tokens + RBAC
- Notifications: Firebase FCM + Nodemailer

## Coding Standards

### General Rules (MUST FOLLOW)
- ALWAYS write tests alongside code (unit + integration + e2e where applicable)
- ALWAYS update CHANGELOG.md when adding/changing functionality
- ALWAYS update relevant documentation when changing functionality
- ALWAYS use TypeScript strict mode (no any types)
- ALWAYS use shared-types package for cross-app type definitions
- ALWAYS handle errors with proper error types and messages
- ALWAYS log actions for audit trail (this is a banking app)
- NEVER hardcode secrets or credentials
- NEVER expose internal error details to client
- NEVER skip input validation
- NEVER commit sensitive files (verify .gitignore first)

### TypeScript Standards
- Functional components with hooks (React)
- Named exports only (no default exports)
- Use Zod for runtime validation
- Error boundaries in React
- Prefer const over let, never var
- JSDoc comments on all public functions
- Standardized API response format

### Python Standards
- Type hints on all functions
- Pydantic models for validation
- async/await for I/O operations
- PEP 8 naming conventions
- Docstrings on all functions

### File Naming
- React components: PascalCase (ComplianceGrid.tsx)
- Hooks: camelCase with use prefix (useComplianceData.ts)
- Utils/services: camelCase (authService.ts)
- Types/interfaces: PascalCase (ComplianceItem.ts)
- Test files: same name + .test.ts or .spec.ts
- Python files: snake_case (pdf_extractor.py)

### Testing Requirements (MANDATORY)
- Unit tests: Every utility function, service, and component
- Integration tests: Every API endpoint
- E2E tests: Critical user flows
- Minimum coverage: 80% overall, 95% for shared packages
- JS/TS framework: Vitest + React Testing Library + Supertest
- Python framework: pytest + httpx
- E2E framework: Playwright

### Git Commit Format
type(scope): description
Types: feat, fix, docs, test, chore, refactor, perf
Scopes: web, mobile, backend, ai-engine, shared, config

### Documentation Rules
- Update CHANGELOG.md on every feature/fix
- Update API.md when adding/changing endpoints
- Add JSDoc/docstrings to all public functions
- Keep README files current

## Security Rules (CRITICAL - Banking App)
- All data encrypted at rest (AES-256) and in transit (TLS 1.3)
- JWT access tokens expire in 15 minutes
- All file uploads validated (MIME type + magic bytes)
- No sensitive data in logs or error messages
- RBAC enforced on every endpoint
- Audit trail for every user action
- NO external cloud API calls with bank document content (use self-hosted AI only)
- SQL injection prevention via Prisma ORM
- XSS prevention via React + Helmet.js
- CORS restricted to known origins
- Rate limiting: 100 req/min per user

## How to Work on This Project
1. Read this CLAUDE.md file first
2. Read the specific app/package CLAUDE.md file (e.g., apps/web/CLAUDE.md)
3. Read relevant docs in docs/ folder
4. Write code following all standards above
5. Write tests for everything you create
6. Update CHANGELOG.md
7. Update any affected documentation

## Environment
- Development: Windows 11, Cursor IDE
- Node.js >= 18, Python >= 3.10
- PostgreSQL 15+ with pgvector, Redis 7+
