import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { UploadedPdfFile } from '../../ai/types/ai-response.types';
import { DatabaseMigrationService } from '../../../common/database/database-migration.service';
import { BUILTIN_EXTRACT_DOCS } from '../builtin-docs';
import { filterComparableGovLeafPoints, filterComparableGovPoints } from '../utils/gov-point-filter';
import { docxBufferToMarkdown, isDocxFileName } from '../utils/document-text.util';
import { mergeSessionResults } from '../utils/session-results-merge';
import { LandingAiCacheService } from './landing-ai-cache.service';
import { LandingAiClientService } from './landing-ai-client.service';
import type {
  CompareSessionGranularity,
  ComplianceComparisonResult,
  ComplianceSessionLoadResponse,
  ComplianceSessionSummary,
  ComplianceSessionsListResponse,
  ExtractSchemaKey,
  GovRequirementPoint,
  LandingAiCompareResponse,
  LandingAiExtractResponse,
  LandingAiParseResponse,
  LandingAiStatusResponse,
} from '../types/landing-ai.types';

@Injectable()
export class LandingAiService {
  private readonly logger = new Logger(LandingAiService.name);

  constructor(
    private readonly client: LandingAiClientService,
    private readonly cache: LandingAiCacheService,
    private readonly databaseMigration: DatabaseMigrationService,
  ) {}

  async getStatus(): Promise<LandingAiStatusResponse> {
    const configured = this.client.isConfigured();
    const supabaseCache = await this.cache.isCacheEnabled();
    return {
      configured,
      apiBase: this.client.getApiBase(),
      parseModel: this.client.getParseModel(),
      extractModel: this.client.getExtractModel(),
      supabaseCache,
      message: configured
        ? 'Landing AI ADE ready'
        : 'Set VISION_AGENT_API_KEY in apps/api/.env',
    };
  }

  async parseFile(
    buffer: Buffer,
    fileName: string,
  ): Promise<LandingAiParseResponse> {
    if (!buffer?.length) {
      throw new BadRequestException('File is empty');
    }

    const fileHash = LandingAiCacheService.hashBuffer(buffer);
    const cached = await this.cache.getParseCache(fileHash);
    if (cached?.markdown) {
      await this.cache.logJob({
        operation: 'parse',
        fileName,
        fileHash,
        fileSizeBytes: buffer.length,
        status: 'success',
        creditUsage: 0,
        model: isDocxFileName(fileName) ? 'mammoth-docx' : this.client.getParseModel(),
        errorMessage: 'cache_hit',
      });
      return {
        success: true,
        cached: true,
        fileName: cached.file_name || fileName,
        fileHash,
        markdown: cached.markdown,
        creditUsage: 0,
      };
    }

    if (isDocxFileName(fileName)) {
      const started = Date.now();
      try {
        const markdown = await docxBufferToMarkdown(buffer);
        const durationMs = Date.now() - started;
        await this.cache.saveParseCache({
          fileHash,
          fileName,
          markdown,
          parseModel: 'mammoth-docx',
          creditUsage: 0,
        });
        await this.cache.logJob({
          operation: 'parse',
          fileName,
          fileHash,
          fileSizeBytes: buffer.length,
          status: 'success',
          creditUsage: 0,
          durationMs,
          model: 'mammoth-docx',
          responseJson: { markdownLength: markdown.length },
        });
        return {
          success: true,
          cached: false,
          fileName,
          fileHash,
          markdown,
          creditUsage: 0,
          durationMs,
        };
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'DOCX parse failed';
        await this.cache.logJob({
          operation: 'parse',
          fileName,
          fileHash,
          fileSizeBytes: buffer.length,
          status: 'error',
          errorMessage: message,
          model: 'mammoth-docx',
        });
        throw new BadRequestException(message);
      }
    }

    if (!this.client.isConfigured()) {
      throw new ServiceUnavailableException(
        'Landing AI not configured. Set VISION_AGENT_API_KEY.',
      );
    }

    const started = Date.now();
    try {
      const result = await this.client.parseDocument(buffer, fileName);
      const markdown = result.markdown ?? '';
      const creditUsage = result.metadata?.credit_usage;
      const durationMs =
        result.metadata?.duration_ms ?? Date.now() - started;

      await this.cache.saveParseCache({
        fileHash,
        fileName,
        markdown,
        parseModel: this.client.getParseModel(),
        creditUsage,
        chunksJson: result.chunks,
      });

      await this.cache.logJob({
        operation: 'parse',
        fileName,
        fileHash,
        fileSizeBytes: buffer.length,
        status: 'success',
        creditUsage,
        durationMs,
        landingJobId: result.metadata?.job_id,
        model: this.client.getParseModel(),
        responseJson: { markdownLength: markdown.length },
      });

      return {
        success: true,
        cached: false,
        fileName,
        fileHash,
        markdown,
        creditUsage,
        jobId: result.metadata?.job_id,
        durationMs,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Parse failed';
      await this.cache.logJob({
        operation: 'parse',
        fileName,
        fileHash,
        fileSizeBytes: buffer.length,
        status: 'error',
        model: this.client.getParseModel(),
        errorMessage: message,
      });
      throw new BadRequestException(message);
    }
  }

  async extractPoints(
    buffer: Buffer | null,
    fileName: string,
    schemaKey: ExtractSchemaKey,
    markdownOverride?: string,
  ): Promise<LandingAiExtractResponse> {
    if (!this.client.isConfigured()) {
      throw new ServiceUnavailableException(
        'Landing AI not configured. Set VISION_AGENT_API_KEY.',
      );
    }

    const operation =
      schemaKey === 'gov_requirement_points'
        ? 'extract_gov'
        : 'extract_internal';

    let fileHash = 'markdown-only';
    let markdown = markdownOverride?.trim() ?? '';

    if (buffer?.length) {
      fileHash = LandingAiCacheService.hashBuffer(buffer);
    }

    if (!markdown && buffer?.length) {
      const parsed = await this.parseFile(buffer, fileName);
      markdown = parsed.markdown;
    }

    if (!markdown) {
      throw new BadRequestException(
        'Provide a file or markdown for extraction',
      );
    }

    const cached = await this.cache.getExtractCache(fileHash, schemaKey);
    if (cached?.points_json) {
      const points = this.client.normalizePoints(cached.points_json);
      return {
        success: true,
        cached: true,
        fileName,
        fileHash,
        schemaKey,
        pointCount: points.length,
        points,
        creditUsage: 0,
      };
    }

    const started = Date.now();
    try {
      const result = await this.client.extractPoints(markdown, schemaKey);
      const points = this.client.normalizePoints(result.extraction);
      const creditUsage = result.metadata?.credit_usage;
      const durationMs =
        result.metadata?.duration_ms ?? Date.now() - started;

      await this.cache.saveExtractCache({
        fileHash,
        schemaKey,
        pointsJson: { points },
        extractModel: this.client.getExtractModel(),
        creditUsage,
      });

      await this.cache.logJob({
        operation,
        fileName,
        fileHash,
        fileSizeBytes: buffer?.length ?? 0,
        status: 'success',
        creditUsage,
        durationMs,
        landingJobId: result.metadata?.job_id,
        model: this.client.getExtractModel(),
        responseJson: { pointCount: points.length },
      });

      return {
        success: true,
        cached: false,
        fileName,
        fileHash,
        schemaKey,
        pointCount: points.length,
        points,
        creditUsage,
        jobId: result.metadata?.job_id,
        durationMs,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Extract failed';
      await this.cache.logJob({
        operation,
        fileName,
        fileHash,
        fileSizeBytes: buffer?.length ?? 0,
        status: 'error',
        model: this.client.getExtractModel(),
        errorMessage: message,
      });
      throw new BadRequestException(message);
    }
  }

  listJobs(limit?: number) {
    return this.cache.listJobs(limit);
  }

  async getCacheStatus() {
    const hashes = BUILTIN_EXTRACT_DOCS.map((d) => d.fileHash);
    const status = await this.cache.getCacheStatus(hashes);
    return {
      supabaseCache: await this.cache.isCacheEnabled(),
      documents: BUILTIN_EXTRACT_DOCS.map((d) => ({
        id: d.id,
        fileName: d.fileName,
        fileHash: d.fileHash,
        parseCached: Boolean(status.parse[d.fileHash]),
        extractCached: Boolean(status.extract[d.fileHash]),
      })),
      jobsCount: status.jobsCount,
      sessionsCount: status.sessionsCount,
    };
  }

  async saveComplianceSession(params: {
    govFileHash: string;
    internalFileHash: string;
    govFileName: string;
    internalFileName: string;
    totalGovPoints: number;
    comparedPoints: number;
    skippedPoints: number;
    skippedJson: unknown;
    resultsJson: unknown;
    summaryJson?: unknown;
    compareGranularity?: CompareSessionGranularity;
  }) {
    if (!(await this.cache.isCacheEnabled())) {
      throw new ServiceUnavailableException(
        'Supabase is not configured — set SUPABASE_URL and SUPABASE_SERVICE_KEY in apps/api/.env',
      );
    }

    const granularity = params.compareGranularity ?? 'section';
    const sessionKey = LandingAiCacheService.sessionKey(
      params.govFileHash,
      params.internalFileHash,
      granularity,
    );

    const incoming = this.normalizeSessionResults(params.resultsJson);
    const existingTableRow = await this.cache.getComplianceSessionByKey(sessionKey);
    const existingCacheRow =
      await this.cache.getComplianceSessionFromExtractCacheByKey(sessionKey);
    const existing = existingTableRow
      ? this.normalizeSessionResults(existingTableRow.results_json)
      : existingCacheRow
        ? this.normalizeSessionResults(existingCacheRow.results_json)
        : [];
    const merged = mergeSessionResults(existing, incoming);

    const summaryJson = {
      ...(typeof params.summaryJson === 'object' && params.summaryJson !== null
        ? (params.summaryJson as Record<string, unknown>)
        : {}),
      compareGranularity: granularity,
    };

    let tableReady = await this.cache.isComplianceSessionsTableReady();
    if (!tableReady) {
      try {
        const applied = await this.databaseMigration.runPendingMigrations();
        if (applied.length > 0) {
          this.logger.log(
            `Applied migrations before session save: ${applied.join(', ')}`,
          );
        }
        tableReady = await this.cache.isComplianceSessionsTableReady();
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Migration failed';
        this.logger.warn(
          `Could not auto-migrate compliance_sessions (${message}) — using extract_cache fallback`,
        );
      }
    }

    if (tableReady) {
      const saved = await this.cache.saveComplianceSession({
        sessionKey,
        govFileHash: params.govFileHash,
        internalFileHash: params.internalFileHash,
        govFileName: params.govFileName,
        internalFileName: params.internalFileName,
        totalGovPoints: params.totalGovPoints,
        comparedPoints: merged.length,
        skippedPoints: params.skippedPoints,
        skippedJson: params.skippedJson,
        resultsJson: merged,
        summaryJson,
      });

      return {
        success: true,
        source: 'session' as const,
        sessionKey,
        compareGranularity: granularity,
        comparedPoints: saved.comparedPoints,
        merged: merged.length > incoming.length,
      };
    }

    const saved = await this.cache.saveComplianceSessionToExtractCache({
      sessionKey,
      govFileHash: params.govFileHash,
      internalFileHash: params.internalFileHash,
      govFileName: params.govFileName,
      internalFileName: params.internalFileName,
      totalGovPoints: params.totalGovPoints,
      comparedPoints: merged.length,
      skippedPoints: params.skippedPoints,
      skippedJson: params.skippedJson,
      resultsJson: merged,
      summaryJson,
      existingId: existingCacheRow?.id,
    });

    return {
      success: true,
      source: 'extract_cache' as const,
      sessionKey,
      sessionId: saved.id,
      compareGranularity: granularity,
      comparedPoints: saved.comparedPoints,
      merged: merged.length > incoming.length,
      message:
        'Saved to Supabase extract cache (compliance_sessions table missing). Results reload for $0. Apply migration 002 when DATABASE_URL is fixed.',
    };
  }

  async syncSessionFromCompareCache(
    compareGranularity: 'section' | 'leaf' = 'section',
  ) {
    const govDoc = BUILTIN_EXTRACT_DOCS.find(
      (d) => d.schemaKey === 'gov_requirement_points',
    );
    const internalDoc = BUILTIN_EXTRACT_DOCS.find(
      (d) => d.schemaKey === 'internal_policy_points',
    );
    if (!govDoc || !internalDoc) {
      throw new BadRequestException('Built-in document profiles not found');
    }

    const loaded = await this.loadAnalysisFromCompareCache(
      govDoc.fileHash,
      internalDoc.fileHash,
      internalDoc.fileName,
      compareGranularity,
    );
    if (!loaded.results.length) {
      throw new BadRequestException(
        'No per-point compare cache found. Run Compare first, or ensure internal PDF parse is in Supabase.',
      );
    }

    return this.saveComplianceSession({
      govFileHash: govDoc.fileHash,
      internalFileHash: internalDoc.fileHash,
      govFileName: govDoc.fileName,
      internalFileName: internalDoc.fileName,
      totalGovPoints: loaded.totalGovPoints,
      comparedPoints: loaded.comparedPoints,
      skippedPoints: loaded.skippedPoints,
      skippedJson: [],
      resultsJson: loaded.results,
      compareGranularity,
    });
  }

  async listComplianceSessions(
    limit?: number,
    compareGranularity?: CompareSessionGranularity,
  ): Promise<ComplianceSessionsListResponse> {
    const sessionsTableReady = await this.cache.isComplianceSessionsTableReady();
    const compareCacheCount = await this.cache.countCompareCacheRows();
    const internalDoc = BUILTIN_EXTRACT_DOCS.find(
      (d) => d.schemaKey === 'internal_policy_points',
    );
    const internalParseCached = internalDoc
      ? Boolean(await this.cache.getParseCache(internalDoc.fileHash))
      : false;

    const tableRows = sessionsTableReady
      ? await this.cache.listComplianceSessions(limit ?? 30)
      : [];
    const cacheRows = await this.cache.listComplianceSessionsFromExtractCache(
      limit ?? 30,
    );

    const seenKeys = new Set<string>();
    const sessions: ComplianceSessionSummary[] = [];

    const pushRow = (
      row: (typeof tableRows)[number],
      source: 'session' | 'extract_cache',
    ) => {
      if (seenKeys.has(row.session_key)) return;
      seenKeys.add(row.session_key);
      const summary = row.summary_json as { compareGranularity?: string } | null;
      const gran = (summary?.compareGranularity ??
        'section') as CompareSessionGranularity;
      const granLabel = gran.startsWith('dual-')
        ? gran.replace('dual-', 'dual ')
        : gran;
      sessions.push({
        id: row.id,
        source,
        sessionKey: row.session_key,
        govFileName: row.gov_file_name,
        internalFileName: row.internal_file_name,
        comparedPoints: row.compared_points,
        totalGovPoints: row.total_gov_points,
        skippedPoints: row.skipped_points,
        createdAt: row.created_at,
        compareGranularity: gran,
        label: `${row.gov_file_name} vs ${row.internal_file_name} · ${granLabel} · ${row.compared_points}/${row.total_gov_points} pts · ${new Date(row.created_at).toLocaleString()}${source === 'extract_cache' ? ' · Supabase cache' : ''}`,
      });
    };

    for (const row of tableRows) pushRow(row, 'session');
    for (const row of cacheRows) pushRow(row, 'extract_cache');

    const filtered = sessions.filter((s) => {
      if (!compareGranularity) return true;
      return s.compareGranularity === compareGranularity;
    });

    const govDoc = BUILTIN_EXTRACT_DOCS.find((d) => d.schemaKey === 'gov_requirement_points');
    if (
      govDoc &&
      internalDoc &&
      compareCacheCount > 0 &&
      compareGranularity &&
      !compareGranularity.startsWith('dual-')
    ) {
      const gran = compareGranularity ?? 'section';
      const hasSessionForGran = filtered.some(
        (s) =>
          (s.source === 'session' || s.source === 'extract_cache') &&
          s.comparedPoints > 0,
      );
      if (!hasSessionForGran) {
        filtered.unshift({
          id: `compare-cache:${gran}`,
          source: 'compare_cache',
          govFileName: govDoc.fileName,
          internalFileName: internalDoc.fileName,
          comparedPoints: compareCacheCount,
          totalGovPoints: 0,
          skippedPoints: 0,
          compareGranularity: gran,
          loadable: internalParseCached,
          label: internalParseCached
            ? `Per-point compare cache · rebuild ${gran} analysis (free · ${compareCacheCount} cached rows)`
            : `Per-point compare cache · ${compareCacheCount} rows (parse internal PDF first)`,
        });
      }
    }

    const hints: string[] = [];
    if (!sessionsTableReady) {
      if (cacheRows.length > 0) {
        hints.push(
          'Dual-verify sessions are saved in Supabase extract cache (free reload). Optional: run migration 002 for the dedicated sessions table.',
        );
      } else {
        hints.push(
          'Compliance sessions table missing — saves use Supabase extract cache automatically. Optional: run docs/supabase/migrations/002_compliance_sessions.sql when DATABASE_URL is configured.',
        );
      }
    }
    if (compareCacheCount > 0 && !internalParseCached) {
      hints.push(
        `${compareCacheCount} per-point compare result(s) exist, but internal PDF parse is not in Supabase. Click “Parse internal PDF → Supabase” once, then refresh this list.`,
      );
    }
    if (filtered.length === 0 && compareCacheCount === 0 && sessionsTableReady) {
      hints.push('Run Compare once — results are stored automatically when the run finishes.');
    }

    return {
      success: true,
      sessions: filtered,
      diagnostics: {
        sessionsTableReady,
        compareCacheCount,
        internalParseCached,
        hint: hints.length ? hints.join(' ') : undefined,
      },
    };
  }

  async getComplianceSession(
    id: string,
    granularity: CompareSessionGranularity = 'section',
  ): Promise<ComplianceSessionLoadResponse> {
    if (id === 'compare-cache' || id.startsWith('compare-cache:')) {
      if (granularity.startsWith('dual-')) {
        throw new BadRequestException(
          'Compare cache reload is for single-pass section/leaf only',
        );
      }
      const gran = id.includes(':leaf') ? 'leaf' : granularity === 'leaf' ? 'leaf' : 'section';
      const govDoc = BUILTIN_EXTRACT_DOCS.find((d) => d.schemaKey === 'gov_requirement_points');
      const internalDoc = BUILTIN_EXTRACT_DOCS.find((d) => d.schemaKey === 'internal_policy_points');
      if (!govDoc || !internalDoc) {
        throw new BadRequestException('Built-in document profiles not found');
      }
      const loaded = await this.loadAnalysisFromCompareCache(
        govDoc.fileHash,
        internalDoc.fileHash,
        internalDoc.fileName,
        gran,
      );
      if (!loaded.results.length) {
        throw new BadRequestException(
          'No compare cache rows found for this granularity. Run Compare first.',
        );
      }
      return loaded;
    }

    const row = await this.cache.getComplianceSessionById(id);
    const cacheRow = row
      ? null
      : await this.cache.getComplianceSessionFromExtractCacheById(id);

    if (!row && !cacheRow) {
      throw new BadRequestException('Compliance session not found');
    }

    const results = this.normalizeSessionResults(
      row ? row.results_json : cacheRow!.results_json,
    );
    return {
      success: true,
      source: row ? 'session' : 'extract_cache',
      id: row?.id ?? cacheRow!.id,
      govFileName: row?.gov_file_name ?? cacheRow!.gov_file_name,
      internalFileName: row?.internal_file_name ?? cacheRow!.internal_file_name,
      comparedPoints: row?.compared_points ?? cacheRow!.compared_points,
      totalGovPoints: row?.total_gov_points ?? cacheRow!.total_gov_points,
      skippedPoints: row?.skipped_points ?? cacheRow!.skipped_points,
      results,
      summaryJson: row?.summary_json ?? cacheRow!.summary_json ?? undefined,
    };
  }

  async loadAnalysisFromCompareCache(
    govFileHash: string,
    internalFileHash: string,
    internalFileName: string,
    granularity: 'section' | 'leaf' = 'section',
  ): Promise<ComplianceSessionLoadResponse> {
    const govCached = await this.cache.getExtractCache(
      govFileHash,
      'gov_requirement_points',
    );
    const obj = govCached?.points_json as { points?: GovRequirementPoint[] } | undefined;
    const allPoints = Array.isArray(obj?.points) ? obj.points : [];
    const { comparable, skipped } =
      granularity === 'leaf'
        ? filterComparableGovLeafPoints(allPoints)
        : filterComparableGovPoints(allPoints);

    const govDoc = BUILTIN_EXTRACT_DOCS.find((d) => d.fileHash === govFileHash);
    const results: ComplianceSessionLoadResponse['results'] = [];

    const hashBases = [internalFileHash];
    const parsed = await this.cache.getParseCache(internalFileHash);
    if (parsed?.markdown) {
      const markdownHash = LandingAiCacheService.hashBuffer(
        Buffer.from(parsed.markdown),
      );
      if (!hashBases.includes(markdownHash)) hashBases.push(markdownHash);
    }

    for (const point of comparable) {
      let cached: { points_json: unknown } | null = null;
      for (const base of hashBases) {
        for (const version of ['v2', 'v1'] as const) {
          const compareKey = LandingAiCacheService.compareCacheKey(
            base,
            point.point_id,
            version,
          );
          cached = await this.cache.getCompareCache(compareKey);
          if (cached?.points_json) break;
        }
        if (cached?.points_json) break;
      }
      if (!cached?.points_json) continue;

      const comparison = this.client.reapplyComparisonRules(
        cached.points_json as ComplianceComparisonResult,
        point.text,
      );
      results.push({
        point_id: point.point_id,
        title: point.title,
        text: point.text,
        message: this.client.formatComparisonMessage(
          point,
          internalFileName,
          comparison,
        ),
      });
    }

    return {
      success: true,
      source: 'compare_cache',
      govFileName: govDoc?.fileName ?? 'TFS Guidelines.pdf',
      internalFileName,
      comparedPoints: results.length,
      totalGovPoints: allPoints.length,
      skippedPoints: skipped.length,
      results,
    };
  }

  private normalizeSessionResults(
    resultsJson: unknown,
  ): ComplianceSessionLoadResponse['results'] {
    if (!Array.isArray(resultsJson)) return [];
    return resultsJson
      .map((item) => {
        if (!item || typeof item !== 'object') return null;
        const row = item as Record<string, unknown>;
        const landingMessage =
          typeof row.landingMessage === 'string' ? row.landingMessage : '';
        const llmMessage =
          typeof row.llmMessage === 'string' ? row.llmMessage : '';
        const message =
          typeof row.message === 'string' && row.message.trim()
            ? row.message
            : landingMessage || llmMessage;
        if (!message.trim() && !(landingMessage.trim() && llmMessage.trim())) {
          return null;
        }
        const agreementJson =
          row.agreementJson &&
          typeof row.agreementJson === 'object' &&
          !Array.isArray(row.agreementJson)
            ? (row.agreementJson as Record<string, unknown>)
            : undefined;
        return {
          point_id: String(row.point_id ?? ''),
          title: typeof row.title === 'string' ? row.title : undefined,
          text: typeof row.text === 'string' ? row.text : undefined,
          message: message.trim() || landingMessage,
          ...(landingMessage.trim() ? { landingMessage } : {}),
          ...(llmMessage.trim() ? { llmMessage } : {}),
          ...(agreementJson ? { agreementJson } : {}),
        };
      })
      .filter((r): r is NonNullable<typeof r> => Boolean(r?.point_id && r.message));
  }

  async getStoredParse(fileHash: string): Promise<{
    success: boolean;
    cached: boolean;
    fileName: string;
    fileHash: string;
    markdown: string;
  } | null> {
    const cached = await this.cache.getParseCache(fileHash);
    if (!cached?.markdown) return null;
    return {
      success: true,
      cached: true,
      fileName: cached.file_name,
      fileHash,
      markdown: cached.markdown,
    };
  }

  /**
   * Compare one gov point against internal policy using Landing AI only:
   * 1. Parse internal PDF(s) via ADE Parse (Supabase cache)
   * 2. Extract compliance fields via ADE Extract + compliance_comparison schema
   */
  async comparePoint(
    point: GovRequirementPoint,
    internalFiles: UploadedPdfFile[],
    internalFileName: string,
    internalMarkdownOverride?: string,
    internalFileHashHint?: string,
    forceCompare = false,
  ): Promise<LandingAiCompareResponse> {
    if (!this.client.isConfigured()) {
      throw new ServiceUnavailableException(
        'Landing AI not configured. Set VISION_AGENT_API_KEY.',
      );
    }
    if (!point?.point_id || !point?.text?.trim()) {
      throw new BadRequestException('Valid government requirement point is required');
    }

    const resolved = await this.resolveInternalMarkdown(
      internalFiles,
      internalFileName,
      internalMarkdownOverride,
      internalFileHashHint,
    );

    const promptVersion = this.client.getComparePromptVersion();
    const compareKey = LandingAiCacheService.compareCacheKey(
      resolved.fileHash,
      point.point_id,
      promptVersion,
    );

    const cached = !forceCompare
      ? await this.cache.getCompareCache(compareKey)
      : null;
    if (cached?.points_json) {
      const comparison = this.client.reapplyComparisonRules(
        cached.points_json as ComplianceComparisonResult,
        point.text,
      );
      const message = this.client.formatComparisonMessage(
        point,
        resolved.fileName,
        comparison,
      );
      await this.cache.logJob({
        operation: 'compare',
        fileName: resolved.fileName,
        fileHash: compareKey,
        fileSizeBytes: resolved.totalBytes,
        status: 'success',
        creditUsage: 0,
        model: this.client.getExtractModel(),
        errorMessage: 'cache_hit',
      });
      return {
        success: true,
        cached: true,
        pointId: point.point_id,
        message,
        comparison,
        creditUsage: 0,
      };
    }

    const started = Date.now();
    try {
      const result = await this.client.compareRequirement(
        point,
        resolved.markdown,
        resolved.fileName,
      );
      const durationMs = result.durationMs ?? Date.now() - started;

      await this.cache.saveCompareCache({
        compareKey,
        comparisonJson: result.comparison,
        extractModel: this.client.getExtractModel(),
        creditUsage: result.creditUsage,
      });

      await this.cache.logJob({
        operation: 'compare',
        fileName: `${point.point_id} vs ${resolved.fileName}`,
        fileHash: compareKey,
        fileSizeBytes: resolved.totalBytes,
        status: 'success',
        creditUsage: result.creditUsage,
        durationMs,
        landingJobId: result.jobId,
        model: this.client.getExtractModel(),
        responseJson: { pointId: point.point_id, status: result.comparison.status },
      });

      const message = this.client.formatComparisonMessage(
        point,
        resolved.fileName,
        result.comparison,
      );

      return {
        success: true,
        cached: false,
        pointId: point.point_id,
        message,
        comparison: result.comparison,
        creditUsage: result.creditUsage,
        jobId: result.jobId,
        durationMs,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Compare failed';
      await this.cache.logJob({
        operation: 'compare',
        fileName: `${point.point_id} vs ${resolved.fileName}`,
        fileHash: compareKey,
        fileSizeBytes: resolved.totalBytes,
        status: 'error',
        model: this.client.getExtractModel(),
        errorMessage: message,
      });
      throw new BadRequestException(message);
    }
  }

  private async resolveInternalMarkdown(
    internalFiles: UploadedPdfFile[],
    internalFileName: string,
    internalMarkdownOverride?: string,
    internalFileHashHint?: string,
  ): Promise<{
    markdown: string;
    fileName: string;
    fileHash: string;
    totalBytes: number;
  }> {
    if (internalFiles.length > 0) {
      const sections: string[] = [];
      const hashParts: Buffer[] = [];
      let totalBytes = 0;

      for (const file of internalFiles) {
        const parsed = await this.parseFile(file.buffer, file.originalname);
        hashParts.push(Buffer.from(parsed.fileHash, 'hex'));
        totalBytes += file.size;
        sections.push(
          `# INTERNAL DOCUMENT: ${file.originalname}\n\n${parsed.markdown}`,
        );
      }

      const fileName =
        internalFiles.length === 1
          ? internalFiles[0].originalname
          : internalFileName;

      return {
        markdown: sections.join('\n\n---\n\n'),
        fileName,
        fileHash: LandingAiCacheService.hashBuffer(Buffer.concat(hashParts)),
        totalBytes,
      };
    }

    const hashHint = internalFileHashHint?.trim();
    if (hashHint) {
      const parseCached = await this.cache.getParseCache(hashHint);
      if (parseCached?.markdown?.trim()) {
        return {
          markdown: parseCached.markdown.trim(),
          fileName:
            internalFileName?.trim() ||
            parseCached.file_name ||
            'internal-policy.pdf',
          fileHash: hashHint,
          totalBytes: Buffer.byteLength(parseCached.markdown, 'utf8'),
        };
      }

      const fromExtract = await this.assembleInternalMarkdownFromExtract(hashHint);
      if (fromExtract) {
        return {
          markdown: fromExtract.markdown,
          fileName: fromExtract.fileName || internalFileName || 'internal-policy.pdf',
          fileHash: hashHint,
          totalBytes: Buffer.byteLength(fromExtract.markdown, 'utf8'),
        };
      }
    }

    const markdown = internalMarkdownOverride?.trim() ?? '';
    if (!markdown) {
      throw new BadRequestException(
        'Attach internal process PDF(s), seed parse cache in Supabase, or pass Landing AI parsed markdown from POST /landing-ai/parse.',
      );
    }

    let fileHash = hashHint;
    if (!fileHash) {
      const builtin = BUILTIN_EXTRACT_DOCS.find(
        (d) =>
          d.schemaKey === 'internal_policy_points' &&
          (d.fileName === internalFileName ||
            internalFileName.includes(d.fileName.replace('.pdf', ''))),
      );
      fileHash = builtin?.fileHash;
    }
    if (!fileHash) {
      fileHash = LandingAiCacheService.hashBuffer(Buffer.from(markdown));
    }

    return {
      markdown,
      fileName: internalFileName,
      fileHash,
      totalBytes: Buffer.byteLength(markdown, 'utf8'),
    };
  }

  /** Fallback when parse cache is missing but internal extract points are seeded. */
  private async assembleInternalMarkdownFromExtract(
    fileHash: string,
  ): Promise<{ markdown: string; fileName: string } | null> {
    const cached = await this.cache.getExtractCache(
      fileHash,
      'internal_policy_points',
    );
    if (!cached?.points_json) return null;
    const points = this.client.normalizePoints(cached.points_json);
    if (!points.length) return null;

    const doc = BUILTIN_EXTRACT_DOCS.find(
      (d) =>
        d.fileHash === fileHash && d.schemaKey === 'internal_policy_points',
    );
    const markdown = points
      .map((p) => {
        const head = [p.point_id, p.title].filter(Boolean).join(' — ');
        return `### ${head}\n\n${p.text.trim()}`;
      })
      .join('\n\n');

    return {
      markdown: `# INTERNAL POLICY (assembled from extract points)\n\n${markdown}`,
      fileName: doc?.fileName ?? 'internal-policy.pdf',
    };
  }
}
