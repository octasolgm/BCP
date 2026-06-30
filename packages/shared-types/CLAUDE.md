# CLAUDE.md - BCP Shared Types Package

## Purpose
Central TypeScript type definitions shared across web, mobile, and backend apps.
Single source of truth for all interfaces, enums, and type unions.
Eliminates type duplication and ensures consistency across the monorepo.

## Tech Stack
- TypeScript 5+ (strict mode)
- No runtime dependencies (types only)
- Optionally: Zod for runtime validation schemas

## Setup Dependencies
- typescript
- zod (for shared validation schemas)
- @types/node (dev)

## Rules

### Must Follow
- Every type used in more than one app MUST be defined here
- Use strict TypeScript (no any, no unknown without narrowing)
- Export everything from index.ts barrel file
- Group by domain (auth, document, compliance, alert, dashboard)
- Include JSDoc comments on every exported type
- When updating types here, check all consuming apps for breakage
- Use named exports only (no default exports)
- Use enums for fixed value sets
- Use type unions for variant types
- Use interfaces for object shapes
- Use Zod schemas alongside types for runtime validation

### Must NOT Do
- NO runtime code (only types and Zod schemas)
- NO React-specific types (those go in web app)
- NO React Native specific types (those go in mobile)
- NO Node.js specific types (those go in backend)
- NO third-party type re-exports unless necessary

## Folder Structure
src/
- index.ts (Barrel export - exports everything)
- auth.ts (User, LoginRequest, LoginResponse, UserRole, JwtPayload, AuthTokens)
- document.ts (Document, DocumentType, DocumentFormat, UploadRequest, DocumentMetadata)
- compliance.ts (ComplianceItem, ComplianceLevel, AnalysisSession, ComplianceStatus)
- alert.ts (Alert, AlertType, NotificationPayload, AlertPriority)
- dashboard.ts (DashboardMetrics, ChartData, ComplianceSummary, OverdueItem)
- api.ts (ApiResponse, PaginatedResponse, ErrorResponse, ApiError)
- common.ts (Timestamp, UUID, Pagination, SortOrder, DateRange)
- audit.ts (AuditLog, AuditAction, AuditEntityType)
- report.ts (ReportRequest, ExcelReportData, ReportFilters)
- schemas/
  - authSchemas.ts (Zod schemas for auth)
  - documentSchemas.ts (Zod schemas for documents)
  - complianceSchemas.ts (Zod schemas for compliance)
- __tests__/
  - typeGuards.test.ts (Test type guard functions)
  - schemas.test.ts (Test Zod validation schemas)

## Key Enums (Define These Exactly)

export enum ComplianceLevel {
  COMPLIANT = 'compliant',
  PARTIAL_COMPLIANT = 'partial_compliant',
  NON_COMPLIANT = 'non_compliant'
}

export enum UserRole {
  ADMIN = 'admin',
  COMPLIANCE_OFFICER = 'compliance_officer',
  MANAGER = 'manager',
  VIEWER = 'viewer'
}

export enum DocumentType {
  REQUIREMENT = 'requirement',
  INTERNAL = 'internal',
  REMEDIATION = 'remediation'
}

export enum DocumentFormat {
  PDF = 'pdf',
  DOCX = 'docx',
  XLSX = 'xlsx',
  HTML = 'html',
  JPEG = 'jpeg',
  PNG = 'png',
  TXT = 'txt'
}

export enum AlertType {
  DEADLINE_APPROACHING = 'deadline_approaching',
  DEADLINE_MISSED = 'deadline_missed',
  ACTION_ASSIGNED = 'action_assigned',
  STATUS_CHANGED = 'status_changed'
}

export enum AnalysisStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed'
}

export enum AuditAction {
  USER_LOGIN = 'user_login',
  USER_LOGOUT = 'user_logout',
  DOCUMENT_UPLOAD = 'document_upload',
  DOCUMENT_DELETE = 'document_delete',
  ANALYSIS_START = 'analysis_start',
  ANALYSIS_COMPLETE = 'analysis_complete',
  COMPLIANCE_ITEM_UPDATE = 'compliance_item_update',
  REPORT_DOWNLOAD = 'report_download',
  USER_CREATE = 'user_create',
  USER_DELETE = 'user_delete',
  USER_ROLE_CHANGE = 'user_role_change'
}

## Key Interfaces (Examples)

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  department: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ComplianceItem {
  id: string;
  sessionId: string;
  requirementText: string;
  requirementArticle: string | null;
  internalMatchText: string | null;
  internalDocReference: string | null;
  complianceLevel: ComplianceLevel;
  aiJustification: string | null;
  confidenceScore: number | null;
  targetDate: string | null;
  actionPlan: string | null;
  responsiblePersonId: string | null;
  responsiblePerson: User | null;
  remediationDocId: string | null;
  remediationStatus: AnalysisStatus | null;
  createdAt: string;
  updatedAt: string;
}

export interface Document {
  id: string;
  userId: string;
  type: DocumentType;
  format: DocumentFormat;
  filename: string;
  originalName: string;
  filePath: string;
  fileSize: number;
  extractedText: string | null;
  status: AnalysisStatus;
  createdAt: string;
  updatedAt: string;
}

export interface AnalysisSession {
  id: string;
  userId: string;
  requirementDocId: string;
  internalDocIds: string[];
  status: AnalysisStatus;
  totalItems: number | null;
  compliantCount: number | null;
  partialCount: number | null;
  nonCompliantCount: number | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Alert {
  id: string;
  userId: string;
  complianceItemId: string | null;
  alertType: AlertType;
  title: string;
  message: string;
  isRead: boolean;
  sentViaEmail: boolean;
  sentViaPush: boolean;
  sentAt: string | null;
  createdAt: string;
}

export interface DashboardMetrics {
  totalItems: number;
  compliantCount: number;
  partialCount: number;
  nonCompliantCount: number;
  compliancePercentage: number;
  overdueActionsCount: number;
  upcomingDeadlinesCount: number;
  recentAlerts: Alert[];
  byRegulation: ComplianceByRegulation[];
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  meta?: PaginationMeta;
}

export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginatedResponse<T> {
  success: true;
  data: T[];
  meta: PaginationMeta;
}

## Zod Schemas (For Runtime Validation)

Provide Zod schemas alongside types for shared validation logic.

Example in schemas/authSchemas.ts:

import { z } from 'zod';
import { UserRole } from '../auth';

export const loginRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(100)
});

export const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2).max(100),
  password: z.string().min(8).max(100),
  role: z.nativeEnum(UserRole),
  department: z.string().optional()
});

export type LoginRequest = z.infer<typeof loginRequestSchema>;
export type CreateUserRequest = z.infer<typeof createUserSchema>;

## Type Guards (Helper Functions)

Provide type guards for safe type narrowing:

export function isCompliant(item: ComplianceItem): boolean {
  return item.complianceLevel === ComplianceLevel.COMPLIANT;
}

export function isOverdue(item: ComplianceItem): boolean {
  if (!item.targetDate) return false;
  return new Date(item.targetDate) < new Date();
}

export function isApiError(response: unknown): response is ErrorResponse {
  return (
    typeof response === 'object' &&
    response !== null &&
    'success' in response &&
    response.success === false
  );
}

export function isPaginatedResponse<T>(
  response: ApiResponse<T> | PaginatedResponse<T>
): response is PaginatedResponse<T> {
  return Array.isArray(response.data) && 'meta' in response;
}

## Build Configuration

tsconfig.json must use:
- target: ES2022
- module: ESNext
- moduleResolution: bundler or node
- declaration: true (generate .d.ts files)
- strict: true
- esModuleInterop: true
- skipLibCheck: true

package.json must export:
{
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  }
}

## Testing Strategy

- Test all type guard functions
- Test all Zod schemas (valid and invalid inputs)
- Use Vitest framework
- Minimum coverage: 100% (it's just types, easy to test)
- Run tests with: npm test

Example test:
import { describe, it, expect } from 'vitest';
import { isOverdue, ComplianceLevel } from '../src';

describe('isOverdue', () => {
  it('returns true for past target date', () => {
    const item = { targetDate: '2020-01-01', complianceLevel: ComplianceLevel.PARTIAL_COMPLIANT };
    expect(isOverdue(item as any)).toBe(true);
  });
  
  it('returns false for future target date', () => {
    const item = { targetDate: '2030-01-01', complianceLevel: ComplianceLevel.PARTIAL_COMPLIANT };
    expect(isOverdue(item as any)).toBe(false);
  });
});

## NPM Scripts to Configure

- build: tsc
- watch: tsc --watch
- test: vitest
- test:coverage: vitest run --coverage
- lint: eslint src --ext ts
- clean: rm -rf dist

## How to Use This Package

In other apps (apps/web, apps/mobile, apps/backend), install:
package.json:
{
  "dependencies": {
    "@bcp/shared-types": "*"
  }
}

Import:
import { ComplianceItem, ComplianceLevel, isOverdue } from '@bcp/shared-types';
import { loginRequestSchema } from '@bcp/shared-types/schemas';

## Banking-Critical Rules
- NEVER include sensitive default values in types (e.g., no hardcoded passwords)
- ALWAYS use string for IDs (UUID), never number
- ALWAYS use ISO 8601 strings for dates in API contracts
- ALWAYS make sensitive fields optional or nullable when serializing
- NEVER include password fields in User type (only in CreateUserRequest)
