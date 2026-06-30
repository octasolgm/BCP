export type LandingAiOperation =
  | 'parse'
  | 'extract_gov'
  | 'extract_internal'
  | 'compare';

export type ExtractSchemaKey =
  | 'gov_requirement_points'
  | 'internal_policy_points'
  | 'compliance_comparison'
  | 'compliance_comparison_v2';

export interface LandingAiStatusResponse {
  configured: boolean;
  apiBase: string;
  parseModel: string;
  extractModel: string;
  supabaseCache: boolean;
  message?: string;
}

export interface LandingAiParseResponse {
  success: boolean;
  cached: boolean;
  fileName: string;
  fileHash: string;
  markdown: string;
  creditUsage?: number;
  jobId?: string;
  durationMs?: number;
  error?: string;
}

export interface GovRequirementPoint {
  point_id: string;
  title?: string;
  text: string;
  section?: string;
  page_hint?: number;
  /** mandatory = compare; informational = skip (introduction, purpose-only, definitions) */
  point_type?: 'mandatory' | 'informational' | 'definition';
}

export interface ComplianceComparisonResult {
  reference_pdf?: string;
  output_response: string;
  fulfilled_clauses?: string;
  status: string;
  confidence: number;
  corrective_action?: string;
  responsibility?: string;
}

export interface LandingAiExtractResponse {
  success: boolean;
  cached: boolean;
  fileName: string;
  fileHash: string;
  schemaKey: ExtractSchemaKey;
  pointCount: number;
  points: GovRequirementPoint[];
  creditUsage?: number;
  jobId?: string;
  durationMs?: number;
  error?: string;
}

export interface LandingAiCompareResponse {
  success: boolean;
  cached: boolean;
  pointId: string;
  message: string;
  comparison: ComplianceComparisonResult;
  creditUsage?: number;
  jobId?: string;
  durationMs?: number;
  error?: string;
}

export interface LandingAiJobRecord {
  id: string;
  operation: LandingAiOperation;
  file_name: string;
  file_hash: string;
  status: string;
  credit_usage: number | null;
  duration_ms: number | null;
  landing_job_id: string | null;
  model: string | null;
  error_message: string | null;
  created_at: string;
}

export interface ComplianceSessionSummary {
  id: string;
  source: 'session' | 'compare_cache';
  sessionKey?: string;
  govFileName: string;
  internalFileName: string;
  comparedPoints: number;
  totalGovPoints: number;
  skippedPoints: number;
  createdAt?: string;
  compareGranularity?: CompareSessionGranularity;
  label: string;
  loadable?: boolean;
}

export type CompareSessionGranularity =
  | 'section'
  | 'leaf'
  | 'dual-section'
  | 'dual-leaf'
  | 'amlcft-dual-section'
  | 'amlcft-dual-leaf';

export interface ComplianceSessionsDiagnostics {
  sessionsTableReady: boolean;
  compareCacheCount: number;
  internalParseCached: boolean;
  hint?: string;
}

export interface ComplianceSessionsListResponse {
  success: boolean;
  sessions: ComplianceSessionSummary[];
  diagnostics?: ComplianceSessionsDiagnostics;
}

export interface ComplianceSessionResultItem {
  point_id: string;
  title?: string;
  text?: string;
  message: string;
  /** Dual-verify: Landing AI pass output */
  landingMessage?: string;
  /** Dual-verify: Phase 2 LLM pass output */
  llmMessage?: string;
  /** Dual-verify: agreement check payload */
  agreementJson?: Record<string, unknown>;
}

export interface ComplianceSessionLoadResponse {
  success: boolean;
  source: 'session' | 'compare_cache';
  id?: string;
  govFileName: string;
  internalFileName: string;
  comparedPoints: number;
  totalGovPoints: number;
  skippedPoints: number;
  results: ComplianceSessionResultItem[];
  summaryJson?: unknown;
}

export interface AdeParseApiResponse {
  markdown?: string;
  chunks?: unknown;
  metadata?: {
    credit_usage?: number;
    job_id?: string;
    duration_ms?: number;
    filename?: string;
  };
}

export interface AdeExtractApiResponse {
  extraction?:
    | {
        points?: GovRequirementPoint[];
      }
    | ComplianceComparisonResult;
  extraction_metadata?: unknown;
  metadata?: {
    credit_usage?: number;
    job_id?: string;
    duration_ms?: number;
  };
}
