# CLAUDE.md - BCP Shared Utils Package

## Purpose
Utility functions shared across web, mobile, and backend apps.
Must be platform-agnostic (no DOM, no Node.js-specific APIs, no React Native APIs).
Centralizes common logic for date formatting, validation, compliance calculations, etc.

## Tech Stack
- TypeScript 5+ (strict mode)
- Zero runtime dependencies preferred (pure JavaScript functions)
- If date library needed: date-fns (tree-shakeable, works everywhere)
- Vitest for testing

## Setup Dependencies
Runtime:
- date-fns (optional, for complex date operations)
- @bcp/shared-types (for type definitions)

Dev:
- typescript
- vitest
- @types/node

## Rules

### Must Follow
- Functions MUST work in browser, Node.js, AND React Native
- NO platform-specific imports (no window, no document, no fs, no process)
- Every function must have unit tests
- Every function must have JSDoc with @param, @returns, @example
- Pure functions preferred (no side effects)
- Use named exports only
- Use shared-types for type imports
- Keep functions small and single-purpose
- Use TypeScript generics where helpful

### Must NOT Do
- NO DOM access (window, document)
- NO Node.js APIs (fs, path, process.env directly)
- NO React Native APIs (Platform, Dimensions)
- NO third-party UI library imports
- NO global state mutations

## Folder Structure
src/
- index.ts (Barrel export)
- formatters/
  - dateFormatters.ts (Date, time, relative time)
  - numberFormatters.ts (Currency, percentage, decimals)
  - stringFormatters.ts (Truncate, capitalize, slugify)
  - fileFormatters.ts (File size, file extensions)
- validators/
  - emailValidator.ts
  - fileValidator.ts (File size, type validation)
  - dateValidator.ts (Date range validation)
  - stringValidator.ts (Length, pattern validation)
- compliance/
  - complianceCalculator.ts (Percentage, status helpers)
  - complianceColors.ts (Status color mapping)
  - complianceLabels.ts (Human-readable labels)
- date/
  - dateHelpers.ts (isDeadlineApproaching, daysUntil, etc.)
  - timeHelpers.ts (Duration calculations)
- text/
  - textHelpers.ts (Word count, sanitize)
  - searchHelpers.ts (Fuzzy match helper)
- array/
  - arrayHelpers.ts (groupBy, sortBy, unique)
- object/
  - objectHelpers.ts (deepMerge, omit, pick)
- error/
  - errorHelpers.ts (Custom error classes)
- __tests__/
  - formatters/
  - validators/
  - compliance/
  - date/
  - text/
  - array/
  - object/

## Key Functions to Implement

### Date Formatters

formatDate(date: Date | string, format?: string): string
formatDateTime(date: Date | string): string
formatRelativeTime(date: Date | string): string  // "2 hours ago"
formatDateRange(start: Date, end: Date): string

### Number Formatters

formatPercentage(value: number, decimals?: number): string
formatNumber(value: number, options?: Intl.NumberFormatOptions): string
formatCurrency(value: number, currency?: string): string

### String Formatters

truncateText(text: string, maxLength: number, suffix?: string): string
capitalize(text: string): string
slugify(text: string): string
sanitizeHtml(text: string): string

### File Formatters

formatFileSize(bytes: number): string  // "1.5 MB"
getFileExtension(filename: string): string
isAllowedFileType(filename: string, allowedTypes: string[]): boolean

### Validators

isValidEmail(email: string): boolean
isValidFileSize(size: number, maxMB: number): boolean
isValidFileType(filename: string, allowedExtensions: string[]): boolean
isValidDateRange(start: Date, end: Date): boolean
isValidPassword(password: string): { valid: boolean; errors: string[] }

### Compliance Helpers

calculateCompliancePercentage(
  compliant: number,
  partial: number,
  nonCompliant: number
): number

getComplianceLevelColor(level: ComplianceLevel): string
getComplianceLevelLabel(level: ComplianceLevel): string
getComplianceLevelIcon(level: ComplianceLevel): string  // emoji or icon name

getOverallStatus(items: ComplianceItem[]): {
  status: ComplianceLevel;
  percentage: number;
  breakdown: { compliant: number; partial: number; nonCompliant: number };
}

### Date Helpers

isDeadlineApproaching(targetDate: Date | string, daysThreshold?: number): boolean
isDeadlineOverdue(targetDate: Date | string): boolean
daysUntil(targetDate: Date | string): number
daysSince(date: Date | string): number
addBusinessDays(date: Date, days: number): Date

### Text Helpers

countWords(text: string): number
extractEmails(text: string): string[]
removeExtraWhitespace(text: string): string

### Array Helpers

groupBy<T, K extends string | number>(
  array: T[],
  keyFn: (item: T) => K
): Record<K, T[]>

sortBy<T>(array: T[], keyFn: (item: T) => string | number): T[]
unique<T>(array: T[]): T[]
chunk<T>(array: T[], size: number): T[][]

### Object Helpers

deepMerge<T>(target: T, source: Partial<T>): T
omit<T, K extends keyof T>(obj: T, keys: K[]): Omit<T, K>
pick<T, K extends keyof T>(obj: T, keys: K[]): Pick<T, K>

### Error Helpers

export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode?: number,
    public details?: unknown
  ) {
    super(message);
    this.name = 'AppError';
  }
}

isAppError(error: unknown): error is AppError
getErrorMessage(error: unknown): string

## Example Implementations

### Example 1: formatFileSize

/**
 * Formats bytes into human-readable string
 * @param bytes - Number of bytes
 * @returns Formatted string like "1.5 MB"
 * @example
 * formatFileSize(1536) // "1.5 KB"
 * formatFileSize(1048576) // "1 MB"
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const size = bytes / Math.pow(1024, i);
  return `${size.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

### Example 2: calculateCompliancePercentage

/**
 * Calculates overall compliance percentage
 * Compliant counts as 100%, Partial as 50%, Non-Compliant as 0%
 * @param compliant - Number of compliant items
 * @param partial - Number of partial compliant items
 * @param nonCompliant - Number of non-compliant items
 * @returns Percentage 0-100, rounded to integer
 * @example
 * calculateCompliancePercentage(8, 1, 1) // 85
 */
export function calculateCompliancePercentage(
  compliant: number,
  partial: number,
  nonCompliant: number
): number {
  const total = compliant + partial + nonCompliant;
  if (total === 0) return 0;
  const score = (compliant * 100 + partial * 50) / total;
  return Math.round(score);
}

### Example 3: isDeadlineApproaching

/**
 * Checks if a deadline is within N days from now
 * @param targetDate - The deadline date
 * @param daysThreshold - Days threshold (default: 3)
 * @returns true if deadline is within threshold and not passed
 * @example
 * isDeadlineApproaching('2025-01-15', 3) // true if today is Jan 12-15
 */
export function isDeadlineApproaching(
  targetDate: Date | string,
  daysThreshold: number = 3
): boolean {
  const target = typeof targetDate === 'string' ? new Date(targetDate) : targetDate;
  const now = new Date();
  const diffMs = target.getTime() - now.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  return diffDays > 0 && diffDays <= daysThreshold;
}

## Compliance Color Mapping

export const COMPLIANCE_COLORS = {
  [ComplianceLevel.COMPLIANT]: {
    bg: '#10B981',      // green-500
    bgLight: '#D1FAE5', // green-100
    text: '#065F46',    // green-800
    border: '#059669'   // green-600
  },
  [ComplianceLevel.PARTIAL_COMPLIANT]: {
    bg: '#F59E0B',      // amber-500
    bgLight: '#FEF3C7', // amber-100
    text: '#92400E',    // amber-800
    border: '#D97706'   // amber-600
  },
  [ComplianceLevel.NON_COMPLIANT]: {
    bg: '#EF4444',      // red-500
    bgLight: '#FEE2E2', // red-100
    text: '#991B1B',    // red-800
    border: '#DC2626'   // red-600
  }
} as const;

## Compliance Labels

export const COMPLIANCE_LABELS = {
  [ComplianceLevel.COMPLIANT]: 'Compliant',
  [ComplianceLevel.PARTIAL_COMPLIANT]: 'Partial Compliant',
  [ComplianceLevel.NON_COMPLIANT]: 'Non-Compliant'
} as const;

export const COMPLIANCE_ICONS = {
  [ComplianceLevel.COMPLIANT]: '✅',
  [ComplianceLevel.PARTIAL_COMPLIANT]: '⚠️',
  [ComplianceLevel.NON_COMPLIANT]: '❌'
} as const;

## Testing Strategy

- Test every function with edge cases
- Test with null, undefined, empty values
- Test with valid and invalid inputs
- Test boundary conditions (0, negative numbers, very large)
- Test with different locales for formatters
- Use Vitest framework
- Minimum coverage: 95%
- Run tests with: npm test

Example test file structure:

import { describe, it, expect } from 'vitest';
import { formatFileSize, calculateCompliancePercentage } from '../src';

describe('formatFileSize', () => {
  it('formats 0 bytes', () => {
    expect(formatFileSize(0)).toBe('0 B');
  });
  
  it('formats bytes to KB', () => {
    expect(formatFileSize(1536)).toBe('1.5 KB');
  });
  
  it('formats bytes to MB', () => {
    expect(formatFileSize(1048576)).toBe('1.0 MB');
  });
  
  it('formats bytes to GB', () => {
    expect(formatFileSize(1073741824)).toBe('1.0 GB');
  });
});

describe('calculateCompliancePercentage', () => {
  it('returns 0 for empty inputs', () => {
    expect(calculateCompliancePercentage(0, 0, 0)).toBe(0);
  });
  
  it('returns 100 for all compliant', () => {
    expect(calculateCompliancePercentage(10, 0, 0)).toBe(100);
  });
  
  it('returns 0 for all non-compliant', () => {
    expect(calculateCompliancePercentage(0, 0, 10)).toBe(0);
  });
  
  it('returns 50 for all partial', () => {
    expect(calculateCompliancePercentage(0, 10, 0)).toBe(50);
  });
  
  it('calculates mixed correctly', () => {
    expect(calculateCompliancePercentage(8, 1, 1)).toBe(85);
  });
});

## Build Configuration

tsconfig.json:
- target: ES2022
- module: ESNext
- declaration: true
- strict: true
- esModuleInterop: true

package.json:
{
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "sideEffects": false
}

## NPM Scripts to Configure

- build: tsc
- watch: tsc --watch
- test: vitest
- test:coverage: vitest run --coverage
- lint: eslint src --ext ts
- format: prettier --write src
- clean: rm -rf dist

## How to Use This Package

In other apps:

package.json:
{
  "dependencies": {
    "@bcp/shared-utils": "*"
  }
}

Import:
import {
  formatFileSize,
  isDeadlineApproaching,
  calculateCompliancePercentage,
  COMPLIANCE_COLORS,
  COMPLIANCE_LABELS
} from '@bcp/shared-utils';

## Banking-Critical Rules
- NEVER include logging that could leak sensitive data
- ALWAYS sanitize user input in text helpers
- ALWAYS validate dates are reasonable (not year 1900 or year 9999)
- NEVER expose internal calculations that could leak info
- ALWAYS handle locale safely (default to en-US for banking)
