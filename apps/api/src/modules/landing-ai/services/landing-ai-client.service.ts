import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  buildComparisonMarkdown,
  getCompareSchemaKey,
  type ComparePromptVersion,
} from '../prompts/compliance-compare-prompts';
import type {
  AdeExtractApiResponse,
  AdeParseApiResponse,
  ComplianceComparisonResult,
  ExtractSchemaKey,
  GovRequirementPoint,
} from '../types/landing-ai.types';

const DEFAULT_API_BASE = 'https://api.va.landing.ai';

@Injectable()
export class LandingAiClientService {
  private readonly logger = new Logger(LandingAiClientService.name);

  constructor(private readonly configService: ConfigService) {}

  isConfigured(): boolean {
    const key = this.configService.get<string>('VISION_AGENT_API_KEY');
    return Boolean(key?.trim());
  }

  getApiBase(): string {
    return (
      this.configService.get<string>('LANDING_AI_API_BASE')?.trim() ||
      DEFAULT_API_BASE
    );
  }

  getParseModel(): string {
    return (
      this.configService.get<string>('LANDING_AI_PARSE_MODEL')?.trim() ||
      'dpt-2-latest'
    );
  }

  getExtractModel(): string {
    return (
      this.configService.get<string>('LANDING_AI_EXTRACT_MODEL')?.trim() ||
      'extract-latest'
    );
  }

  /** Default v2 (CBUAE auditor). Set LANDING_AI_COMPARE_PROMPT_VERSION=v1 for legacy prompt. */
  getComparePromptVersion(): ComparePromptVersion {
    const raw = this.configService
      .get<string>('LANDING_AI_COMPARE_PROMPT_VERSION')
      ?.trim()
      .toLowerCase();
    return raw === 'v1' ? 'v1' : 'v2';
  }

  loadSchema(schemaKey: ExtractSchemaKey): string {
    const fileName =
      schemaKey === 'gov_requirement_points'
        ? 'gov-requirement-points.schema.json'
        : schemaKey === 'internal_policy_points'
          ? 'internal-policy-points.schema.json'
          : schemaKey === 'compliance_comparison_v2'
            ? 'compliance-comparison-v2.schema.json'
            : 'compliance-comparison.schema.json';
    const path = join(__dirname, '..', 'schemas', fileName);
    return readFileSync(path, 'utf-8');
  }

  formatComparisonMessage(
    point: GovRequirementPoint,
    internalFileName: string,
    comparison: ComplianceComparisonResult,
  ): string {
    const head = [point.point_id, point.title].filter(Boolean).join(' ');
    const status = comparison.status?.trim() || 'Non-Compliant';
    const confidence = Number.isFinite(comparison.confidence)
      ? comparison.confidence
      : 0;
    const corrective =
      comparison.corrective_action?.trim() ||
      (status === 'Compliant' ? 'N/A' : '—');
    const responsibility =
      comparison.responsibility?.trim() ||
      (status === 'Compliant' ? 'N/A' : '—');

    return [
      head,
      point.text,
      '',
      'Reference PDF :',
      comparison.reference_pdf?.trim() || internalFileName,
      '',
      'Output/Response :',
      comparison.output_response?.trim() || 'No corresponding procedure found.',
      '',
      'Fulfilled clauses :',
      comparison.fulfilled_clauses?.trim() || 'None',
      '',
      `Comply Yes/No (Status) : ${status}`,
      `Compliance Confidence % : ${confidence}%`,
      'Corrective Action Plan :',
      corrective,
      'Responsibility :',
      responsibility,
    ].join('\n');
  }

  async parseDocument(
    buffer: Buffer,
    fileName: string,
  ): Promise<AdeParseApiResponse> {
    const apiKey = this.getRequiredApiKey();
    const form = new FormData();
    form.append(
      'document',
      new Blob([buffer]),
      fileName || 'document.pdf',
    );
    form.append('model', this.getParseModel());

    const res = await fetch(`${this.getApiBase()}/v1/ade/parse`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    });

    const body = (await res.json()) as AdeParseApiResponse & {
      error?: string;
      message?: string;
    };

    if (!res.ok) {
      const msg =
        body.error || body.message || `Landing AI parse failed (${res.status})`;
      this.logger.error(msg);
      throw new Error(msg);
    }

    return body;
  }

  async extractWithSchema(
    markdown: string,
    schemaKey: ExtractSchemaKey,
  ): Promise<AdeExtractApiResponse> {
    const apiKey = this.getRequiredApiKey();
    const form = new FormData();
    form.append('schema', this.loadSchema(schemaKey));
    form.append(
      'markdown',
      new Blob([markdown], { type: 'text/markdown' }),
      'document.md',
    );
    form.append('model', this.getExtractModel());

    const res = await fetch(`${this.getApiBase()}/v1/ade/extract`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    });

    const body = (await res.json()) as AdeExtractApiResponse & {
      error?: string;
      message?: string;
    };

    if (!res.ok) {
      const msg =
        body.error ||
        body.message ||
        `Landing AI extract failed (${res.status})`;
      this.logger.error(msg);
      throw new Error(msg);
    }

    return body;
  }

  async extractPoints(
    markdown: string,
    schemaKey: ExtractSchemaKey,
  ): Promise<AdeExtractApiResponse> {
    return this.extractWithSchema(markdown, schemaKey);
  }

  async compareRequirement(
    point: GovRequirementPoint,
    internalMarkdown: string,
    internalFileName: string,
  ): Promise<{
    comparison: ComplianceComparisonResult;
    creditUsage?: number;
    jobId?: string;
    durationMs?: number;
    promptVersion: ComparePromptVersion;
    schemaKey: ExtractSchemaKey;
  }> {
    const promptVersion = this.getComparePromptVersion();
    const schemaKey = getCompareSchemaKey(promptVersion);
    const markdown = buildComparisonMarkdown(
      promptVersion,
      point,
      internalMarkdown,
      internalFileName,
    );
    const result = await this.extractWithSchema(markdown, schemaKey);
    const comparison = this.normalizeComparison(result.extraction, point.text);
    return {
      comparison,
      creditUsage: result.metadata?.credit_usage,
      jobId: result.metadata?.job_id,
      durationMs: result.metadata?.duration_ms,
      promptVersion,
      schemaKey,
    };
  }

  normalizeComparison(
    extraction: unknown,
    requirementText?: string,
  ): ComplianceComparisonResult {
    let raw: unknown = extraction;
    if (Array.isArray(raw) && raw.length > 0) {
      raw = raw[0];
    }
    if (raw && typeof raw === 'object') {
      const obj = raw as Record<string, unknown>;
      if (obj.comparison && typeof obj.comparison === 'object') {
        raw = obj.comparison;
      } else if (obj.result && typeof obj.result === 'object') {
        raw = obj.result;
      }
    }

    if (!raw || typeof raw !== 'object') {
      return {
        output_response: 'No corresponding procedure found.',
        status: 'Non-Compliant',
        confidence: 0,
        fulfilled_clauses: 'None',
        corrective_action: 'Re-run comparison or verify internal document.',
        responsibility: 'Compliance Team',
      };
    }

    const obj = raw as Record<string, unknown>;

    const statusRaw =
      (typeof obj.comply_status === 'string' && obj.comply_status) ||
      (typeof obj.status === 'string' && obj.status) ||
      'Non-Compliant';
    let status = statusRaw.trim() || 'Non-Compliant';

    const confidenceRaw =
      obj.compliance_confidence_percentage ?? obj.confidence;
    let confidence =
      typeof confidenceRaw === 'number'
        ? confidenceRaw
        : Number.parseInt(String(confidenceRaw ?? ''), 10);

    if (!Number.isFinite(confidence)) {
      confidence = 0;
    }
    confidence = Math.max(0, Math.min(100, Math.round(confidence)));

    const NO_EVIDENCE = 'No corresponding procedure found.';
    let outputResponse =
      (typeof obj.uae_response_compliance_level === 'string' &&
        obj.uae_response_compliance_level.trim()) ||
      (typeof obj.output_response === 'string' && obj.output_response.trim()) ||
      '';

    const lacksEvidence =
      !outputResponse ||
      outputResponse.toLowerCase().replace(/\.$/, '') ===
        NO_EVIDENCE.toLowerCase().replace(/\.$/, '');

    if (lacksEvidence) {
      outputResponse = NO_EVIDENCE;
      if (status === 'Compliant' || status === 'Partial Compliant') {
        status = 'Non-Compliant';
      }
      confidence = Math.min(confidence, 30);
    } else if (confidence === 0) {
      if (status === 'Compliant') confidence = 85;
      else if (status === 'Partial Compliant') confidence = 50;
    }

    if (status === 'Partial Compliant' && confidence > 85) {
      confidence = 85;
    }
    if (status === 'Non-Compliant' && confidence > 30) {
      confidence = 30;
    }

    const corrective =
      (typeof obj.corrective_action_plan === 'string' &&
        obj.corrective_action_plan.trim()) ||
      (typeof obj.corrective_action === 'string' &&
        obj.corrective_action.trim()) ||
      undefined;

    const responsibility =
      (typeof obj.suggested_responsibility === 'string' &&
        obj.suggested_responsibility.trim()) ||
      (typeof obj.responsibility === 'string' &&
        obj.responsibility.trim()) ||
      undefined;

    let fulfilledClauses =
      typeof obj.fulfilled_clauses === 'string'
        ? obj.fulfilled_clauses.trim()
        : undefined;

    const reqText =
      (typeof obj.requirement_text === 'string' && obj.requirement_text.trim()) ||
      requirementText?.trim() ||
      undefined;

    return this.reconcileComparisonResult({
      outputResponse,
      status,
      confidence,
      corrective,
      responsibility,
      fulfilledClauses,
      requirementText: reqText,
      referencePdf:
        typeof obj.reference_pdf === 'string' ? obj.reference_pdf : undefined,
    });
  }

  /** Re-apply status/CAP rules to a stored comparison (e.g. cache hit after logic updates). */
  reapplyComparisonRules(
    comparison: ComplianceComparisonResult,
    requirementText?: string,
  ): ComplianceComparisonResult {
    return this.reconcileComparisonResult({
      outputResponse: comparison.output_response,
      status: comparison.status,
      confidence: comparison.confidence,
      corrective: comparison.corrective_action,
      responsibility: comparison.responsibility,
      fulfilledClauses: comparison.fulfilled_clauses,
      requirementText,
      referencePdf: comparison.reference_pdf,
    });
  }

  /** Enforce consistent status, confidence, CAP, and evidence fields. */
  private reconcileComparisonResult(input: {
    outputResponse: string;
    status: string;
    confidence: number;
    corrective?: string;
    responsibility?: string;
    fulfilledClauses?: string;
    requirementText?: string;
    referencePdf?: string;
  }): ComplianceComparisonResult {
    const NO_EVIDENCE = 'No corresponding procedure found.';
    let outputResponse = input.outputResponse.trim();
    let status = this.normalizeComplyStatus(input.status);
    let confidence = input.confidence;
    let corrective = input.corrective?.trim();
    let responsibility = input.responsibility?.trim();
    let fulfilledClauses = input.fulfilledClauses?.trim();

    const statusPrefix = outputResponse.match(
      /^(Compliant|Partial Compliant|Non-Compliant)\s*:\s*/i,
    );
    if (statusPrefix) {
      status = this.normalizeComplyStatus(statusPrefix[1]);
      outputResponse = outputResponse.slice(statusPrefix[0].length).trim();
    }

    const lacksEvidence =
      !outputResponse ||
      outputResponse.toLowerCase().replace(/\.$/, '') ===
        NO_EVIDENCE.toLowerCase().replace(/\.$/, '');

    if (lacksEvidence) {
      outputResponse = NO_EVIDENCE;
      status = 'Non-Compliant';
      confidence = Math.min(confidence, 30);
    }

    const hasCap =
      Boolean(corrective) &&
      corrective !== 'N/A' &&
      corrective !== '—' &&
      corrective !== '-';

    const requirementText = input.requirementText?.trim();
    const missingSubConditions = requirementText
      ? this.findMissingSubConditions(
          requirementText,
          fulfilledClauses,
          outputResponse,
        )
      : [];

    if (status === 'Compliant' && hasCap) {
      status = 'Partial Compliant';
    }

    if (status === 'Compliant' && confidence === 100 && hasCap) {
      status = 'Partial Compliant';
    }

    if (status === 'Compliant' && missingSubConditions.length > 0) {
      status = 'Partial Compliant';
    }

    if (
      status === 'Partial Compliant' &&
      missingSubConditions.length === 0 &&
      !lacksEvidence &&
      (!hasCap || this.isGenericCorrectiveAction(corrective ?? ''))
    ) {
      status = 'Compliant';
      corrective = undefined;
      responsibility = undefined;
    }

    if (status === 'Partial Compliant' && confidence >= 100) {
      confidence = 85;
    }
    if (status === 'Partial Compliant' && confidence > 85) {
      confidence = 85;
    }
    if (status === 'Non-Compliant' && confidence > 30) {
      confidence = 30;
    }
    if (status === 'Compliant' && confidence < 86 && !lacksEvidence) {
      confidence = Math.max(confidence, 86);
    }

    if (status === 'Compliant') {
      corrective = undefined;
      responsibility = undefined;
      if (confidence > 100) confidence = 100;
    } else if (status === 'Partial Compliant') {
      if (
        !hasCap ||
        this.isGenericCorrectiveAction(corrective ?? '')
      ) {
        corrective = this.buildSpecificCorrectiveAction(
          requirementText,
          missingSubConditions,
        );
      }
      if (!responsibility) {
        responsibility = 'Compliance Team';
      }
      if (!fulfilledClauses || fulfilledClauses.toLowerCase() === 'none') {
        fulfilledClauses =
          '• Some aspects covered (see Output/Response quote) — refer to Gap(s) in Corrective Action Plan for missing items';
      }
    } else {
      if (
        !hasCap ||
        this.isGenericCorrectiveAction(corrective ?? '')
      ) {
        corrective = requirementText
          ? this.buildSpecificCorrectiveAction(requirementText, missingSubConditions.length > 0
              ? missingSubConditions
              : this.splitRequirementSubConditions(requirementText))
          : 'Gap(s): (1) Missing: No adequate internal procedure found for this requirement. Fix: Develop and document controls that satisfy all sub-conditions in the gov requirement text.';
      }
      if (!responsibility) {
        responsibility = 'Compliance Team';
      }
      if (!fulfilledClauses) {
        fulfilledClauses = 'None';
      }
    }

    return {
      reference_pdf: input.referencePdf,
      output_response: outputResponse || NO_EVIDENCE,
      fulfilled_clauses: fulfilledClauses,
      status,
      confidence,
      corrective_action: corrective,
      responsibility,
    };
  }

  private isGenericCorrectiveAction(cap: string): boolean {
    const normalized = cap.trim();
    if (!normalized) return true;
    const genericPatterns = [
      /^Gap\(s\):\s*One or more sub-conditions/i,
      /review the requirement against internal procedures/i,
      /not fully documented in the internal policy evidence cited above/i,
      /document the missing controls, then update policy to address each gap/i,
      /^Gap\(s\):\s*Re-verify requirement sub-conditions/i,
    ];
    return genericPatterns.some((p) => p.test(normalized));
  }

  private splitRequirementSubConditions(text: string): string[] {
    let body = text.trim();
    body = body.replace(/^LFIs should\s+/i, '').replace(/^The LFI should\s+/i, '');

    const verbSplit = body.split(
      /\s+and\s+(?=(?:ensure|establish|document|implement|maintain|identify|remediate|provide|conduct|perform|take\s+immediate|include\s+all|reduce|upon\s+learning))/i,
    );
    if (verbSplit.length > 1) {
      return verbSplit.map((s) => s.trim()).filter(Boolean);
    }

    if (body.includes(';')) {
      return body.split(';').map((s) => s.trim()).filter(Boolean);
    }

    return [body];
  }

  private subConditionAppearsCovered(
    subCondition: string,
    coveredText: string,
  ): boolean {
    const tokens = subCondition
      .toLowerCase()
      .replace(/[^\w\s-]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length >= 5)
      .filter(
        (w) =>
          !['should', 'their', 'which', 'where', 'those', 'these', 'other'].includes(
            w,
          ),
      );

    if (tokens.length === 0) return false;

    const hits = tokens.filter((t) => coveredText.includes(t)).length;
    return hits / tokens.length >= 0.45;
  }

  private findMissingSubConditions(
    requirementText: string,
    fulfilledClauses?: string,
    outputResponse?: string,
  ): string[] {
    const covered = `${fulfilledClauses ?? ''} ${outputResponse ?? ''}`.toLowerCase();
    return this.splitRequirementSubConditions(requirementText).filter(
      (part) => !this.subConditionAppearsCovered(part, covered),
    );
  }

  private buildSpecificCorrectiveAction(
    requirementText: string | undefined,
    missingParts: string[],
  ): string {
    if (!requirementText?.trim()) {
      return 'Gap(s): (1) Missing: Requirement sub-conditions could not be parsed — manually compare gov requirement text against internal policy and document each gap with Fix and owner.';
    }

    const gaps =
      missingParts.length > 0
        ? missingParts
        : this.splitRequirementSubConditions(requirementText);

    if (gaps.length === 0) {
      return 'Gap(s): (1) Missing: Unspecified sub-condition — manually compare gov requirement text against internal policy evidence.';
    }

    const numbered = gaps
      .map(
        (gap, i) =>
          `(${i + 1}) Missing: ${gap.trim().replace(/\.$/, '')}`,
      )
      .join('\n');

    return `Gap(s):\n${numbered}\n\nRecommended action: Update internal policy to document and operationalize each missing control above, with clear page/section reference and assigned owner.`;
  }

  private normalizeComplyStatus(raw: string): string {
    const v = raw.trim();
    if (/non-?compliant/i.test(v)) return 'Non-Compliant';
    if (/partial/i.test(v)) return 'Partial Compliant';
    if (/compliant/i.test(v)) return 'Compliant';
    return v || 'Non-Compliant';
  }

  normalizePoints(extraction: unknown): GovRequirementPoint[] {
    if (!extraction || typeof extraction !== 'object') return [];
    const obj = extraction as { points?: GovRequirementPoint[] };
    if (!Array.isArray(obj.points)) return [];
    return obj.points.filter((p) => p?.point_id && p?.text);
  }

  private getRequiredApiKey(): string {
    const key = this.configService.get<string>('VISION_AGENT_API_KEY')?.trim();
    if (!key) {
      throw new Error(
        'VISION_AGENT_API_KEY is not set. See docs/landingai/03-developer-setup-guide.md',
      );
    }
    return key;
  }
}
