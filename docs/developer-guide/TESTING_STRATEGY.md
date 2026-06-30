# 🧪 BCP - Testing Strategy

**Version:** 1.0  
**Date:** 2026-06-22  

> **Related docs:** [DEVELOPER_GUIDE.md](./DEVELOPER_GUIDE.md) · [ARCHITECTURE.md](../architecture/ARCHITECTURE.md) · [SECURITY.md](../security/SECURITY.md)

This document defines the complete testing approach for all apps and packages in the BCP monorepo.

---

## Testing Philosophy

For a banking app, testing is NOT optional. Every line of code that could affect compliance results, security, or data integrity MUST be tested.

**Core principles:**

- **Correctness over speed** — A wrong compliance classification is worse than a slow one
- **Test behavior, not implementation** — Tests should survive refactors
- **Deterministic AI tests** — Mock LLM responses; never rely on live model output in CI
- **No production data in tests** — Use factories, fixtures, and synthetic documents only
- **Fail fast in CI** — Unit tests run first; E2E runs last
- **Write tests with code** — A PR without tests for new logic is incomplete

---

## Testing Pyramid

```
                    ┌─────────────┐
                    │   E2E (5%)  │  Playwright — critical user flows only
                    │  Slow, few  │
                ┌───┴─────────────┴───┐
                │  Integration (25%)  │  API endpoints, page-level, pipelines
                │   Medium speed      │
            ┌───┴─────────────────────┴───┐
            │       Unit Tests (70%)        │  Functions, services, components
            │         Fast, many          │
            └─────────────────────────────┘
```

| Layer | What It Tests | Speed | Count | Framework |
|-------|---------------|-------|-------|-----------|
| **Unit** | Single function, service, hook, component in isolation | Fast (ms) | Many | Vitest / Jest / pytest |
| **Integration** | Multiple modules together (API + DB, page + MSW) | Medium (sec) | Moderate | Vitest + Supertest / MSW / httpx |
| **E2E** | Full app through real browser/device | Slow (min) | Few | Playwright (web only, Phase 2+) |

**Rule of thumb:** If you can test it with a unit test, do that. Reach for integration only when modules must interact. Use E2E only for flows that prove the product works end-to-end.

---

## Coverage Requirements

| Area | Minimum Coverage | Notes |
|------|------------------|-------|
| **Shared packages** (`shared-types`, `shared-utils`, `shared-constants`, `api-client`, `shared-ui`) | **95%** | Used everywhere — bugs propagate fast |
| **Backend services** | **85%** | Auth, compliance, file handling |
| **Backend controllers/routes** | **80%** | Every endpoint has integration test |
| **AI engine extractors** | **90%** | Document parsing is critical path |
| **AI engine analyzers** | **80%** | Mock LLM for determinism |
| **Web hooks/utils** | **85%** | Business logic in hooks |
| **Web components** | **75%** | Focus on behavior, not CSS |
| **Mobile hooks/utils** | **85%** | Same as web |
| **Mobile components** | **75%** | Snapshot only for stable UI |
| **Monorepo overall** | **80%** | Enforced in CI |

---

## Test File Naming & Location

```
# TypeScript / React — colocated with source
ComplianceGrid.tsx
ComplianceGrid.test.tsx

authService.ts
authService.test.ts

# Backend integration — separate folder
src/__tests__/
  unit/
    authService.test.ts
  integration/
    auth.routes.test.ts

# Python — mirror module structure
src/extractors/pdf_extractor.py
src/__tests__/test_pdf_extractor.py
```

**Naming:** `*.test.ts`, `*.test.tsx`, or `*.spec.ts` (TypeScript); `test_*.py` (Python).

---

## Frameworks by App/Package

| App / Package | Unit | Integration | E2E | Mocking |
|---------------|------|-------------|-----|---------|
| `apps/web` | Vitest + RTL | Vitest + MSW | Playwright | MSW |
| `apps/mobile` | Jest + RNTL | Jest + MSW | Manual (Phase 1) | MSW |
| `apps/backend` | Vitest | Vitest + Supertest | — | vi.mock, test DB |
| `apps/ai-engine` | pytest | pytest + httpx | — | pytest fixtures, mock LLM |
| `packages/shared-types` | Vitest | — | — | — |
| `packages/shared-utils` | Vitest | — | — | — |
| `packages/shared-constants` | Vitest | — | — | — |
| `packages/api-client` | Vitest | Vitest + MSW | — | MSW |
| `packages/shared-ui` | Vitest + RTL/RNTL | — | — | — |

**RTL** = React Testing Library · **RNTL** = React Native Testing Library

---

## What MUST Be Tested (Banking Critical)

These areas require tests before any PR merge:

```
┌────────────────────────────────────────────────────────────┐
│  SECURITY & AUTH                                            │
├────────────────────────────────────────────────────────────┤
│  ✅ Login / logout / token refresh                          │
│  ✅ RBAC — each role blocked from unauthorized actions      │
│  ✅ JWT expiry and invalid token handling                   │
│  ✅ Password validation rules                               │
│  ✅ Rate limiting behavior                                  │
└────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────┐
│  FILE UPLOAD & PROCESSING                                   │
├────────────────────────────────────────────────────────────┤
│  ✅ Reject invalid file types (MIME + extension)          │
│  ✅ Reject files over MAX_FILE_SIZE_MB                      │
│  ✅ UUID filename generation (no user-provided paths)       │
│  ✅ Each extractor handles corrupt/empty files gracefully │
└────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────┐
│  COMPLIANCE LOGIC                                           │
├────────────────────────────────────────────────────────────┤
│  ✅ Compliance level classification mapping                 │
│  ✅ Confidence threshold → human review flag                │
│  ✅ Excel report column format matches client template      │
│  ✅ Overdue / deadline calculation                          │
│  ✅ Enum maps cover all values (shared-constants)           │
└────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────┐
│  DATA INTEGRITY                                             │
├────────────────────────────────────────────────────────────┤
│  ✅ Audit log created on every mutating action              │
│  ✅ Soft delete vs hard delete behavior                     │
│  ✅ Pagination limits enforced                              │
│  ✅ No sensitive data in error responses                    │
└────────────────────────────────────────────────────────────┘
```

---

## Per-App Testing Guide

### apps/web (React Dashboard)

**Tools:** Vitest, @testing-library/react, @testing-library/user-event, jsdom, MSW, Playwright

```
src/
  components/
    ComplianceGrid.tsx
    ComplianceGrid.test.tsx      ← component test
  hooks/
    useComplianceData.ts
    useComplianceData.test.ts    ← hook test
  pages/
    AnalysisPage.tsx
    AnalysisPage.test.tsx        ← page test with MSW
e2e/
  compliance-flow.spec.ts        ← Playwright E2E
```

**Component test example:**

```typescript
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ComplianceBadge } from './ComplianceBadge';
import { ComplianceLevel } from '@bcp/shared-types';

describe('ComplianceBadge', () => {
  it('shows correct label for non-compliant', () => {
    render(<ComplianceBadge level={ComplianceLevel.NON_COMPLIANT} />);
    expect(screen.getByText(/non-compliant/i)).toBeInTheDocument();
  });
});
```

**Scripts:**
```bash
npm run test              # Vitest watch mode
npm run test:coverage     # Coverage report
npm run test:e2e          # Playwright
```

---

### apps/mobile (React Native / Expo)

**Tools:** Jest, jest-expo, @testing-library/react-native, MSW

- Unit test all hooks, utils, Zustand stores
- Component tests with React Native Testing Library
- Snapshot tests only for stable, low-change UI (badges, icons)
- **Phase 1:** Manual device testing for push notifications, camera upload
- **Phase 2:** Detox or Maestro for automated mobile E2E

**Scripts:**
```bash
npm run test
npm run test:coverage
```

---

### apps/backend (Node.js API)

**Tools:** Vitest, Supertest, Prisma test DB, @faker-js/faker

**Test database:** Separate `bcp_test_db` — never run tests against development data.

```env
TEST_DATABASE_URL=postgresql://user:password@localhost:5432/bcp_test_db
```

**Integration test pattern:**

```typescript
import request from 'supertest';
import { app } from '../app';
import { createTestUser, getAuthToken } from '../__tests__/helpers';

describe('POST /api/v1/documents/upload', () => {
  it('rejects unauthenticated upload', async () => {
    const res = await request(app)
      .post('/api/v1/documents/upload')
      .attach('file', './__tests__/fixtures/sample.pdf');
    expect(res.status).toBe(401);
  });

  it('rejects invalid file type', async () => {
    const token = await getAuthToken('compliance_officer');
    const res = await request(app)
      .post('/api/v1/documents/upload')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', './__tests__/fixtures/malware.exe');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_FILE_TYPE');
  });
});
```

**Mock external services:**
- AI engine → `vi.mock` or nock HTTP stub
- Nodemailer → mock transporter
- Firebase FCM → mock admin SDK
- Redis/BullMQ → use in-memory or test Redis instance

**Scripts:**
```bash
npm run test                    # All tests
npm run test:int                # Integration only
npm run test:coverage
```

---

### apps/ai-engine (Python FastAPI)

**Tools:** pytest, pytest-asyncio, pytest-cov, httpx

**Fixtures directory:** `src/__tests__/fixtures/`
- `sample.pdf`, `sample.docx`, `sample.xlsx`, `scan.jpeg`, `empty.pdf`, `corrupt.pdf`

**Mock LLM responses** — never call Ollama/Groq in CI:

```python
@pytest.fixture
def mock_llm_compliant(mocker):
    mocker.patch(
        'src.services.compliance_analyzer.call_llm',
        return_value={
            'level': 'compliant',
            'confidence': 0.92,
            'reasoning': 'Bank policy covers KYC requirements'
        }
    )
```

**Pipeline integration test:**

```python
async def test_full_pipeline(mock_llm_compliant, test_db):
    # 1. Extract text from PDF
    text = await extract_pdf('fixtures/sample.pdf')
    assert len(text) > 0

    # 2. Chunk and embed
    chunks = chunk_text(text)
    embeddings = await embed_chunks(chunks)
    assert len(embeddings) == len(chunks)

    # 3. Analyze compliance
    result = await analyze_compliance(
        requirement="Banks must perform KYC",
        matched_chunk=chunks[0]
    )
    assert result['level'] == 'compliant'
    assert result['confidence'] >= 0.7
```

**Scripts:**
```bash
pytest src/__tests__/ -v
pytest src/__tests__/ -v --cov=src --cov-report=html
```

---

## Shared Packages Testing

### packages/shared-types
- Test all Zod schemas (valid + invalid inputs)
- Test type guard functions (`isOverdue`, `isCompliant`, etc.)
- **Target: 100% coverage** — small surface area, high impact

### packages/shared-utils
- Pure function tests — date formatting, validation, compliance calculations
- No mocks needed for most tests
- Test edge cases: empty strings, null dates, boundary values

### packages/shared-constants
- Verify every enum value has a label/color/icon mapping
- Verify regex patterns match expected inputs
- Example: `Object.values(ComplianceLevel).forEach(level => expect(LABELS[level]).toBeDefined())`

### packages/api-client
- MSW handlers for all endpoints
- Test token refresh interceptor (401 → refresh → retry)
- Test error parsing (`parseApiError`)
- Test upload progress callbacks

### packages/shared-ui
- Web components: Vitest + @testing-library/react
- Mobile components: Vitest + @testing-library/react-native
- Shared hooks: renderHook tests
- Test accessibility (ARIA labels, keyboard nav on web)

---

## E2E Test Scenarios (Web — Playwright)

Run these before every release:

| # | Flow | Steps |
|---|------|-------|
| 1 | **Full analysis** | Login → Upload requirement PDF → Upload internal doc → Start analysis → View results → Export Excel |
| 2 | **Action assignment** | Login as manager → Open non-compliant item → Assign person → Set target date → Save |
| 3 | **Remediation** | Login → Open task → Upload remediation doc → Verify status update |
| 4 | **Dashboard** | Login → Verify MIS metrics match seeded test data |
| 5 | **RBAC** | Login as viewer → Attempt upload → Verify 403 forbidden |
| 6 | **Session expiry** | Login → Wait for token expiry → Verify redirect to login |

**E2E config:**
```typescript
// playwright.config.ts
export default defineConfig({
  testDir: './e2e',
  baseURL: 'http://localhost:5173',
  webServer: [
    { command: 'npm run dev:backend', port: 4000 },
    { command: 'npm run dev:web', port: 5173 }
  ],
  use: { screenshot: 'only-on-failure', video: 'retain-on-failure' }
});
```

---

## Test Data & Fixtures

### Rules
- **Never** use real bank documents, customer data, or production DB dumps
- Use **faker.js** / **factory functions** for users, compliance items
- Store sample files in `__tests__/fixtures/` (small, synthetic PDFs)
- Seed script for integration tests: `apps/backend/prisma/seed.test.ts`
- Reset DB between integration test suites (`beforeEach` truncate or transaction rollback)

### Factory example (backend)

```typescript
import { faker } from '@faker-js/faker';
import { UserRole, ComplianceLevel } from '@bcp/shared-types';

export function createTestUser(overrides = {}) {
  return {
    email: faker.internet.email(),
    name: faker.person.fullName(),
    password: 'TestPass123!',
    role: UserRole.COMPLIANCE_OFFICER,
    ...overrides
  };
}

export function createTestComplianceItem(overrides = {}) {
  return {
    requirementText: 'Article 1: Banks must screen customers',
    complianceLevel: ComplianceLevel.PARTIAL_COMPLIANT,
    confidenceScore: 0.75,
    ...overrides
  };
}
```

---

## Mocking Strategy

```
┌──────────────────────────────────────────────────────────┐
│  WHAT TO MOCK                    WHAT NOT TO MOCK         │
├──────────────────────────────────────────────────────────┤
│  ✅ LLM / Ollama / Groq          ❌ Your own business     │
│  ✅ Email (Nodemailer)               logic functions     │
│  ✅ Push notifications (FCM)     ❌ Prisma queries in    │
│  ✅ External HTTP (AI engine)          integration tests │
│  ✅ File system (virus scan)     ❌ Zod validation       │
│  ✅ Date/time (for deadline          schemas             │
│     tests — use vi.setSystemTime)  ❌ shared-utils pure  │
│  ✅ API client in frontend           functions           │
│     component tests                                      │
└──────────────────────────────────────────────────────────┘
```

---

## Running All Tests (Monorepo)

From repository root:

```bash
# Run all package/app tests (when workspaces configured)
npm test

# Per app
npm run test --workspace=apps/backend
npm run test --workspace=apps/web
npm run test --workspace=packages/shared-utils

# AI engine (separate Python env)
cd apps/ai-engine
pytest src/__tests__/ -v --cov=src

# Coverage report (all TS packages)
npm run test:coverage
```

### Recommended local workflow

```bash
# 1. Start test dependencies
docker compose -f config/docker/docker-compose.test.yml up -d   # postgres + redis

# 2. Run fast tests first (unit)
npm run test -- --run

# 3. Run integration (needs DB)
npm run test:int --workspace=apps/backend

# 4. Run E2E last (needs full stack)
npm run test:e2e --workspace=apps/web
```

---

## CI Pipeline (GitHub Actions)

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Lint      │ →  │  Unit Tests │ →  │ Integration │ →  │    E2E      │
│  (all apps) │    │  (parallel) │    │  (backend,  │    │  (web only, │
│             │    │             │    │  ai-engine) │    │  main only) │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
```

**CI rules:**
- PR blocked if coverage drops below threshold
- PR blocked if any banking-critical test fails
- E2E runs on `main` branch and release tags only (slow)
- AI engine tests use mocked LLM — no GPU required in CI
- Integration tests spin up PostgreSQL + Redis as GitHub Actions services

---

## Banking-Specific Test Rules

1. **No real credentials in tests** — use `test-secret-min-32-chars-for-jwt` style values
2. **No logging assertions on sensitive fields** — verify passwords/tokens never appear in logs
3. **Test RBAC matrix** — every endpoint × every role combination that matters
4. **Test file upload attacks** — double extension, MIME spoofing, oversized files
5. **Test audit trail** — every mutation creates an audit log entry
6. **Test error sanitization** — 500 responses never leak stack traces to client
7. **Test session timeout** — 15-minute inactivity logout
8. **Regression tests for Excel template** — column order, headers, compliance colors match client spec

---

## When to Write Which Test

| You changed... | Write... |
|----------------|----------|
| Utility function | Unit test |
| React component | Component test (RTL) |
| API endpoint | Integration test (Supertest) |
| Prisma schema | Migration test + update factories |
| Zod schema / shared type | Schema validation test |
| Constant mapping | Enum coverage test |
| User-facing flow | E2E test (if critical) |
| AI prompt / analyzer | Unit test with mocked LLM |
| Document extractor | Unit test with fixture file |

---

## Test Checklist (PR Template)

Before merging, confirm:

- [ ] New code has corresponding tests
- [ ] All existing tests pass locally
- [ ] Coverage meets minimum for affected package
- [ ] No `test.skip` or `it.only` left in code
- [ ] Integration tests use test DB, not dev DB
- [ ] No real bank data in fixtures
- [ ] LLM calls mocked in CI-safe tests
- [ ] RBAC tested if endpoint permissions changed
- [ ] CHANGELOG.md updated

---

## Summary

```
┌────────────────────────────────────────────────────────┐
│  BCP TESTING IN ONE SENTENCE                            │
├────────────────────────────────────────────────────────┤
│                                                          │
│  70% fast unit tests, 25% integration tests,           │
│  5% E2E for critical flows — with mocked AI,           │
│  isolated test DB, synthetic fixtures, and               │
│  mandatory coverage on anything touching compliance,     │
│  security, or data integrity.                            │
│                                                          │
└────────────────────────────────────────────────────────┘
```

| Phase | Focus |
|-------|-------|
| **Phase 1 (MVP)** | Unit + integration for backend, shared packages, AI extractors |
| **Phase 2 (Pilot)** | Web component tests + Playwright E2E for 4 critical flows |
| **Phase 3 (Production)** | Full coverage enforcement in CI, mobile E2E, load testing |
