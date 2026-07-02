'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  API_BASE,
  BATCH_MESSAGE_SEP,
  DEFAULT_PDF_NAME,
} from '../../lib/ai-lab/constants';
import { assignFileInput, loadDefaultPdfFile } from '../../lib/ai-lab/pdf';
import {
  ReferenceComplianceCard,
  ReferenceCopyButton,
} from '../../lib/ai-lab/reference-compliance-view';
import { DownloadMapperPdfButton } from '../../lib/ai-lab/reference-mapper-export';
import {
  parseReferenceComplianceText,
  type ReferenceComplianceBlock,
} from '../../lib/ai-lab/parse-reference-response';
import { downloadComplianceDetailPdf } from '../../lib/ai-lab/export-pdf';
import {
  DEFAULT_EXCEL_REQUIREMENT_HEADER,
  downloadComplianceFormattedExcel,
} from '../../lib/ai-lab/export-excel';
import { downloadComplianceMatrixExcel } from '../../lib/ai-lab/export-matrix-excel';
import { CsvToExcelPanel } from '../../lib/ai-lab/csv-to-excel-panel';
import { ExcelComparePanel } from '../../lib/ai-lab/excel-compare-panel';
import { SemanticMatrixComparePanel } from '../../lib/ai-lab/semantic-matrix-compare-panel';
import {
  AttentionFocusCompact,
  ColorCodeLegend,
  MarkdownSummary,
  StatusTierBoxes,
} from '../../lib/ai-lab/compliance-report-view';
import {
  buildReportStats,
  type ParsedComplianceResult,
} from '../../lib/ai-lab/parse-compliance-results';
import {
  filterComparableGovPoints,
  filterComparableGovLeafPoints,
  formatGovPointDisplayId,
  formatChapterLabel,
  formatGovRequirementForDisplay,
  formatSectionGroupLabel,
  groupGovPointsByChapter,
  pointMatchesPrefix,
  type GovPoint as FilterGovPoint,
} from '../../lib/landing-ai/gov-point-filter';

type CompareGranularity = 'section' | 'leaf';

const WORKBENCH_CONFIG: Record<
  CompareGranularity,
  {
    title: string;
    subtitle: string;
    stepCompare: string;
    otherPageHref: string;
    otherPageLabel: string;
    reportTitle: string;
    reportFilename: (ext: string) => string;
    matrixReportFilename: (ext: string) => string;
    excelRequirementHeader: string;
    filterGovPoints: (points: FilterGovPoint[]) => {
      comparable: FilterGovPoint[];
      skipped: Array<{ point: FilterGovPoint; reason: string }>;
    };
  }
> = {
  section: {
    title: 'Compliance Workbench — Section compare',
    subtitle:
      'Compare rolled-up gov sections (2.1, 2.2, 2.3, …). Sub-points like 2.1.1–2.1.6 are merged into one compare unit per section.',
    stepCompare: '3. Compare sections (Landing AI)',
    otherPageHref: '/landing-ai/detail',
    otherPageLabel: 'Switch to leaf compare (2.1.1, 2.1.2, …)',
    reportTitle: 'BCP Compliance Gap Analysis Report (Sections)',
    reportFilename: (ext) => {
      const stamp = new Date().toISOString().slice(0, 10);
      return `bcp-compliance-section-report-${stamp}.${ext}`;
    },
    matrixReportFilename: (ext) => {
      const stamp = new Date().toISOString().slice(0, 10);
      return `TFS_Section2_Compliance_Matrix-${stamp}.${ext}`;
    },
    excelRequirementHeader: DEFAULT_EXCEL_REQUIREMENT_HEADER,
    filterGovPoints: filterComparableGovPoints,
  },
  leaf: {
    title: 'Compliance Workbench — Leaf compare',
    subtitle:
      'Compare individual gov sub-points (2.1.1, 2.1.2, 2.2.1, …). One Landing AI compare call per leaf obligation — no section rollup.',
    stepCompare: '3. Compare leaf points (Landing AI)',
    otherPageHref: '/landing-ai',
    otherPageLabel: 'Switch to section compare (2.1, 2.2, …)',
    reportTitle: 'BCP Compliance Gap Analysis Report (Leaf Points)',
    reportFilename: (ext) => {
      const stamp = new Date().toISOString().slice(0, 10);
      return `bcp-compliance-leaf-report-${stamp}.${ext}`;
    },
    matrixReportFilename: (ext) => {
      const stamp = new Date().toISOString().slice(0, 10);
      return `TFS_Section2_Compliance_Matrix-${stamp}.${ext}`;
    },
    excelRequirementHeader: DEFAULT_EXCEL_REQUIREMENT_HEADER,
    filterGovPoints: filterComparableGovLeafPoints,
  },
};

type ComplianceWorkbenchProps = {
  granularity: CompareGranularity;
};

const GOV_FILE_HASH =
  'c84713f9aacd18415680356aeae47bcacff9c17458b5595b575400b12fe8f2ff';
const INTERNAL_FILE_HASH =
  '6a0a0bd13c7a32ea10c43c9a8391347a7e0caceaa0b17dd6443e9ee622111717';

type GovPoint = {
  point_id: string;
  title?: string;
  text: string;
  section?: string;
  page_hint?: number;
};

type CompareStatus = 'pending' | 'running' | 'done' | 'error' | 'cancelled';

type CompareItem = {
  index: number;
  point: GovPoint;
  status: CompareStatus;
  message?: string;
  error?: string;
};

type SavedAnalysisOption = {
  id: string;
  source: 'session' | 'compare_cache';
  label: string;
  comparedPoints: number;
  totalGovPoints: number;
  loadable?: boolean;
};

type ApiResponse = Record<string, unknown>;

function extractMessage(data: ApiResponse): string {
  const msg = data.message;
  if (typeof msg === 'string') return msg;
  if (msg != null) return JSON.stringify(msg, null, 2);
  return JSON.stringify(data, null, 2);
}

function apiConnectionError(error: unknown): string {
  const msg = error instanceof Error ? error.message : String(error);
  if (
    /failed to fetch|networkerror|connection refused|connection reset|load failed/i.test(
      msg,
    )
  ) {
    return `Cannot reach API at ${API_BASE}. Keep npm run dev:api running.`;
  }
  return msg;
}

function referenceToParsed(
  block: ReferenceComplianceBlock,
  index: number,
): ParsedComplianceResult {
  const confMatch = block.confidence.match(/(\d+)/);
  const confidence = confMatch ? Number(confMatch[1]) : null;
  const status =
    block.status.trim() ||
    block.fields.find((f) => /status/i.test(f.label))?.value.trim() ||
    '';

  const fieldValue = (label: string) =>
    block.fields.find((f) => f.label === label)?.value?.trim() ?? '';

  const cap =
    block.correctiveAction?.trim() ||
    fieldValue('Corrective Action Plan');
  const resp =
    block.responsibility?.trim() || fieldValue('Responsibility');

  const orderedFields: { label: string; value: string }[] = [];
  const pushField = (label: string, value: string, allowEmpty = false) => {
    const v = value.trim();
    if (!allowEmpty && (!v || v === 'N/A')) return;
    if (orderedFields.some((f) => f.label === label)) return;
    orderedFields.push({ label, value: v || '—' });
  };

  // Evidence first, then verdict + CAP (CAP/Responsibility always included for export).
  pushField(
    'Reference PDF',
    block.referencePdf || fieldValue('Reference PDF'),
  );
  pushField(
    'Output/Response',
    block.outputResponse || fieldValue('Output/Response'),
  );
  pushField(
    'Fulfilled clauses',
    block.fulfilledClauses || fieldValue('Fulfilled clauses'),
  );
  pushField('Comply Yes/No (Status)', status, true);
  pushField(
    'Compliance Confidence %',
    block.confidence.trim() || fieldValue('Compliance Confidence %'),
    true,
  );
  pushField('Corrective Action Plan', cap || 'N/A', true);
  pushField('Responsibility', resp || 'N/A', true);

  return {
    index,
    title: block.title,
    body: block.body,
    fields: orderedFields,
    status,
    confidence,
    needsAttention:
      status !== 'Compliant' ||
      (confidence !== null && confidence < 100),
  };
}

export function ComplianceWorkbench({ granularity }: ComplianceWorkbenchProps) {
  const config = WORKBENCH_CONFIG[granularity];
  const filterGovPoints = config.filterGovPoints;
  const [govFile, setGovFile] = useState<File | null>(null);
  const [internalFiles, setInternalFiles] = useState<FileList | null>(null);
  const [internalLabel, setInternalLabel] = useState<string | null>(null);
  const [internalMarkdown, setInternalMarkdown] = useState('');

  const [govPoints, setGovPoints] = useState<GovPoint[]>([]);
  const [selectedGovIds, setSelectedGovIds] = useState<Set<string>>(new Set());
  const [internalPoints, setInternalPoints] = useState<GovPoint[]>([]);
  const [extractingGov, setExtractingGov] = useState(false);
  const [extractingInternal, setExtractingInternal] = useState(false);
  const [extractCredits, setExtractCredits] = useState('');
  const [seedingDb, setSeedingDb] = useState(false);
  const [loadingGovDb, setLoadingGovDb] = useState(false);
  const [loadingInternalDb, setLoadingInternalDb] = useState(false);
  const [dbNote, setDbNote] = useState('');
  const [cacheStatusNote, setCacheStatusNote] = useState('');
  const [skippedGovNote, setSkippedGovNote] = useState('');
  const [skippedGovCount, setSkippedGovCount] = useState(0);
  const [parsingInternal, setParsingInternal] = useState(false);
  const [internalParseCached, setInternalParseCached] = useState(false);
  const [savedAnalyses, setSavedAnalyses] = useState<SavedAnalysisOption[]>([]);
  const [savedAnalysisHint, setSavedAnalysisHint] = useState('');
  const [selectedAnalysisId, setSelectedAnalysisId] = useState('');
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [supabaseCache, setSupabaseCache] = useState<boolean | null>(null);
  const [apiOnline, setApiOnline] = useState<boolean | null>(null);

  const [compareItems, setCompareItems] = useState<CompareItem[]>([]);
  const [comparing, setComparing] = useState(false);
  const [comparePrep, setComparePrep] = useState('');
  const [error, setError] = useState('');
  const [phase, setPhase] = useState<1 | 2 | 3 | 4>(1);

  const abortRef = useRef<AbortController | null>(null);
  const internalInputRef = useRef<HTMLInputElement>(null);

  const doneCount = compareItems.filter((i) => i.status === 'done').length;
  const totalCompare = compareItems.length;
  const progressPct =
    totalCompare > 0 ? Math.round((doneCount / totalCompare) * 100) : 0;

  const selectedGovPoints = useMemo(
    () => govPoints.filter((p) => selectedGovIds.has(p.point_id)),
    [govPoints, selectedGovIds],
  );

  function applyGovPoints(comparable: GovPoint[]) {
    setGovPoints(comparable);
    setSelectedGovIds(new Set());
  }

  function toggleGovPoint(pointId: string) {
    setSelectedGovIds((prev) => {
      const next = new Set(prev);
      if (next.has(pointId)) next.delete(pointId);
      else next.add(pointId);
      return next;
    });
  }

  function selectAllGovPoints() {
    setSelectedGovIds(new Set(govPoints.map((p) => p.point_id)));
  }

  function clearGovSelection() {
    setSelectedGovIds(new Set());
  }

  function toggleGovPointsByPrefix(prefix: string) {
    const inGroup = govPoints.filter((p) =>
      pointMatchesPrefix(p.point_id, prefix, p.section),
    );
    const allSelected =
      inGroup.length > 0 &&
      inGroup.every((p) => selectedGovIds.has(p.point_id));
    setSelectedGovIds((prev) => {
      const next = new Set(prev);
      for (const p of inGroup) {
        if (allSelected) next.delete(p.point_id);
        else next.add(p.point_id);
      }
      return next;
    });
  }

  const govPointsByChapter = useMemo(
    () => groupGovPointsByChapter(govPoints),
    [govPoints],
  );

  function renderGovPointRow(p: GovPoint) {
    const checked = selectedGovIds.has(p.point_id);
    return (
      <li
        key={p.point_id}
        className={`rounded-lg border px-3 py-2 transition-colors ${
          checked
            ? 'border-violet-400 bg-violet-100/60'
            : 'border-violet-100 bg-violet-50/50'
        }`}
      >
        <label className="flex cursor-pointer items-start gap-2">
          <input
            type="checkbox"
            checked={checked}
            onChange={() => toggleGovPoint(p.point_id)}
            className="mt-1 h-4 w-4 shrink-0 rounded border-violet-300 text-violet-600 focus:ring-violet-500"
          />
          <span className="min-w-0 flex-1">
            <span className="font-semibold text-violet-900">{formatGovPointDisplayId(p)}</span>
            {p.title && (
              <span className="text-violet-800"> — {p.title}</span>
            )}
            <p className="mt-1 line-clamp-2 text-xs text-slate-600">
              {formatGovRequirementForDisplay(p)}
            </p>
          </span>
        </label>
      </li>
    );
  }

  const combinedMessage = useMemo(
    () =>
      compareItems
        .filter((i) => i.status === 'done' && i.message)
        .map((i) => i.message as string)
        .join(`\n\n${BATCH_MESSAGE_SEP}\n\n`),
    [compareItems],
  );

  const resultBlocks = useMemo(
    () => parseReferenceComplianceText(combinedMessage),
    [combinedMessage],
  );

  const parsedResults = useMemo(
    () => resultBlocks.map((block, index) => referenceToParsed(block, index)),
    [resultBlocks],
  );

  const reportStats = useMemo(
    () => buildReportStats(parsedResults),
    [parsedResults],
  );

  const reportSummary = useMemo(() => {
    if (!reportStats.total) return '';
    return [
      `Analyzed **${reportStats.total}** government requirement point(s) against internal policy documents.`,
      '',
      'See the status summary and attention focus sections below for Compliant, Partial, and Non-Compliant breakdown.',
    ].join('\n');
  }, [reportStats.total]);

  const referenceFileNames = useMemo(
    () =>
      internalFiles
        ? Array.from(internalFiles).map((f) => f.name)
        : internalLabel
          ? [internalLabel]
          : [],
    [internalFiles, internalLabel],
  );

  useEffect(() => {
    let cancelled = false;
    async function checkStatus() {
      try {
        const res = await fetch(`${API_BASE}/landing-ai/status`);
        const data = await res.json();
        if (!cancelled) {
          setApiOnline(res.ok);
          setSupabaseCache(Boolean(data.supabaseCache));
        }
        const cacheRes = await fetch(`${API_BASE}/landing-ai/cache-status`);
        if (cacheRes.ok && !cancelled) {
          const cache = await cacheRes.json();
          const docs = (cache.documents ?? []) as {
            id: string;
            fileName: string;
            parseCached: boolean;
            extractCached: boolean;
          }[];
          const internal = docs.find((d) => d.id === 'internal-imptfs');
          setInternalParseCached(Boolean(internal?.parseCached));
          setCacheStatusNote(
            docs
              .map(
                (d) =>
                  `${d.fileName}: parse ${d.parseCached ? '✓' : '—'} · extract ${d.extractCached ? '✓' : '—'}`,
              )
              .join(' · '),
          );
        }
      } catch {
        if (!cancelled) {
          setApiOnline(false);
          setSupabaseCache(null);
        }
      }
    }
    checkStatus();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadDefault() {
      try {
        const file = await loadDefaultPdfFile();
        if (!file || cancelled) return;
        const dt = new DataTransfer();
        dt.items.add(file);
        setInternalFiles(dt.files);
        setInternalLabel(DEFAULT_PDF_NAME);
        requestAnimationFrame(() => {
          if (internalInputRef.current) {
            assignFileInput(internalInputRef.current, dt.files);
          }
        });
      } catch {
        /* optional default */
      }
    }
    loadDefault();
    return () => {
      cancelled = true;
    };
  }, []);

  async function fetchSavedAnalyses() {
    try {
      const res = await fetch(
        `${API_BASE}/landing-ai/compliance-sessions?limit=30&granularity=${granularity}`,
      );
      if (!res.ok) return;
      const data = await res.json();
      const sessions = (data.sessions ?? []) as SavedAnalysisOption[];
      setSavedAnalyses(sessions);
      setSavedAnalysisHint(
        typeof data.diagnostics?.hint === 'string' ? data.diagnostics.hint : '',
      );
      const preferred =
        sessions.find((s) => s.source === 'session') ?? sessions[0];
      if (preferred) {
        setSelectedAnalysisId(preferred.id);
      }
    } catch {
      /* optional */
    }
  }

  async function persistAnalysisToDb(
    doneItems: CompareItem[],
    options?: { quiet?: boolean },
  ): Promise<{ ok: boolean; comparedPoints?: number; message?: string }> {
    if (!doneItems.length) return { ok: false, message: 'No results to save' };

    const sessionText = doneItems
      .map((i) => i.message as string)
      .join(`\n\n${BATCH_MESSAGE_SEP}\n\n`);
    const sessionBlocks = parseReferenceComplianceText(sessionText);

    try {
      const saveRes = await fetch(`${API_BASE}/landing-ai/compliance-sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          govFileHash: GOV_FILE_HASH,
          internalFileHash: INTERNAL_FILE_HASH,
          govFileName: 'TFS Guidelines.pdf',
          internalFileName:
            internalLabel?.split(',')[0]?.trim() ||
            internalFiles?.[0]?.name ||
            'I M P T F S.pdf',
          totalGovPoints: govPoints.length + skippedGovCount,
          comparedPoints: doneItems.length,
          skippedPoints: skippedGovCount,
          skippedJson: skippedGovNote,
          compareGranularity: granularity,
          resultsJson: doneItems.map((i) => ({
            point_id: i.point.point_id,
            title: i.point.title,
            text: i.point.text,
            message: i.message,
          })),
          summaryJson: buildReportStats(
            sessionBlocks.map((b, idx) => referenceToParsed(b, idx)),
          ),
        }),
      });
      const saveData = (await saveRes.json().catch(() => ({}))) as {
        message?: string;
        comparedPoints?: number;
      };
      if (!saveRes.ok) {
        const msg =
          typeof saveData.message === 'string'
            ? saveData.message
            : 'Session save failed';
        if (!options?.quiet) {
          setDbNote(
            `Compare progress saved locally but DB save failed: ${msg}`,
          );
        }
        return { ok: false, message: msg };
      }
      if (!options?.quiet) {
        setDbNote(
          `Analysis saved to Supabase (${granularity} · ${saveData.comparedPoints ?? doneItems.length} points merged) — reload anytime without credits`,
        );
      }
      await fetchSavedAnalyses();
      return {
        ok: true,
        comparedPoints: saveData.comparedPoints ?? doneItems.length,
      };
    } catch (e) {
      const msg = apiConnectionError(e);
      if (!options?.quiet) setDbNote(`Could not save analysis to DB: ${msg}`);
      return { ok: false, message: msg };
    }
  }

  async function syncAnalysisFromCache() {
    setLoadingAnalysis(true);
    setError('');
    try {
      const res = await fetch(
        `${API_BASE}/landing-ai/compliance-sessions/sync-from-cache?granularity=${granularity}`,
        { method: 'POST' },
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || JSON.stringify(data));
      }
      setDbNote(
        `Synced ${data.comparedPoints ?? '?'} points from compare cache → saved session (${granularity}) · 0 credits`,
      );
      await fetchSavedAnalyses();
    } catch (e) {
      setError(apiConnectionError(e));
    } finally {
      setLoadingAnalysis(false);
    }
  }

  useEffect(() => {
    if (apiOnline) fetchSavedAnalyses();
  }, [apiOnline, granularity]);

  async function loadSelectedAnalysis() {
    if (!selectedAnalysisId) {
      setError('Select a saved analysis from the list');
      return;
    }
    const selected = savedAnalyses.find((s) => s.id === selectedAnalysisId);
    if (selected?.loadable === false) {
      setError(
        'Compare results are in Supabase but cannot be reloaded yet. Parse internal PDF → Supabase first (see hint above), then try again.',
      );
      return;
    }
    setLoadingAnalysis(true);
    setError('');
    try {
      if (!govPoints.length) {
        await loadGovFromDb();
      }
      const res = await fetch(
        `${API_BASE}/landing-ai/compliance-sessions/${encodeURIComponent(selectedAnalysisId)}?granularity=${granularity}`,
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || JSON.stringify(data));

      const results = (data.results ?? []) as Array<{
        point_id: string;
        title?: string;
        text?: string;
        message: string;
      }>;
      if (!results.length) {
        throw new Error('No compare results in this saved analysis');
      }

      const items: CompareItem[] = results.map((r, index) => ({
        index,
        point: {
          point_id: r.point_id,
          title: r.title,
          text: r.text ?? '',
        },
        status: 'done' as const,
        message: r.message,
      }));
      setCompareItems(items);
      setPhase(4);
      setDbNote(
        `Loaded analysis: ${data.comparedPoints} points (${data.source === 'compare_cache' ? 'compare cache' : 'saved session'}) · 0 credits`,
      );
    } catch (e) {
      setError(apiConnectionError(e));
    } finally {
      setLoadingAnalysis(false);
    }
  }

  async function extractGovPoints() {
    if (!govFile) {
      setError('Upload a government requirement document first');
      return;
    }
    setExtractingGov(true);
    setError('');
    try {
      const form = new FormData();
      form.append('file', govFile);
      const res = await fetch(`${API_BASE}/landing-ai/extract-gov-points`, {
        method: 'POST',
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || JSON.stringify(data));
      const points = (data.points ?? []) as GovPoint[];
      if (!points.length) throw new Error('No requirement points found in document');
      const { comparable, skipped } = filterGovPoints(points);
      applyGovPoints(comparable);
      setSkippedGovNote(
        skipped.length
          ? `Skipped ${skipped.length} informational/intro points (not compared)`
          : '',
      );
      setExtractCredits(
        `Gov extract: ${comparable.length} compare · ${skipped.length} skipped · credits ${data.creditUsage ?? '?'}${data.cached ? ' (cached)' : ''}`,
      );
      setPhase(2);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gov extraction failed');
    } finally {
      setExtractingGov(false);
    }
  }

  async function extractInternalPoints() {
    const file = internalFiles?.[0];
    if (!file) {
      setError('Attach internal process document(s)');
      return;
    }
    setExtractingInternal(true);
    setError('');
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch(`${API_BASE}/landing-ai/extract-internal-points`, {
        method: 'POST',
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || JSON.stringify(data));
      const points = (data.points ?? []) as GovPoint[];
      setInternalPoints(points);
      setExtractCredits((prev) =>
        `${prev ? prev + ' · ' : ''}Internal: ${points.length} points · credits ${data.creditUsage ?? '?'}`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Internal extraction failed');
    } finally {
      setExtractingInternal(false);
    }
  }

  async function seedDbToSupabase() {
    setSeedingDb(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/landing-ai/seed/builtin`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || JSON.stringify(data));
      const seeded = (data.seeded ?? []) as { pointCount: number; fileName: string }[];
      setDbNote(
        `DB seeded: ${seeded.map((s) => `${s.fileName} (${s.pointCount} pts)`).join(' · ')}`,
      );
      setSupabaseCache(true);
    } catch (e) {
      setError(apiConnectionError(e));
    } finally {
      setSeedingDb(false);
    }
  }

  async function loadGovFromDb() {
    setLoadingGovDb(true);
    setError('');
    try {
      const res = await fetch(
        `${API_BASE}/landing-ai/stored-points?docId=gov-tfs-guidelines`,
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || JSON.stringify(data));
      const allPoints = (data.points ?? []) as GovPoint[];
      if (!allPoints.length) throw new Error('No gov points in DB');
      const { comparable, skipped } = filterGovPoints(allPoints);
      const skippedCount = skipped.length;
      applyGovPoints(comparable);
      setSkippedGovCount(skippedCount);
      setSkippedGovNote(
        skippedCount
          ? `Skipped ${skippedCount} informational/intro points (not compared)`
          : '',
      );
      setExtractCredits(
        `Gov from DB: ${comparable.length} compare · ${skippedCount} skipped · 0 credits`,
      );
      setDbNote(
        `Loaded gov: ${data.fileName} (${comparable.length} mandatory points)`,
      );
      setPhase(2);
    } catch (e) {
      setError(apiConnectionError(e));
    } finally {
      setLoadingGovDb(false);
    }
  }

  async function parseInternalToDb() {
    const file = internalFiles?.[0];
    if (!file) {
      setError('Attach internal process PDF first');
      return;
    }
    setParsingInternal(true);
    setError('');
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch(`${API_BASE}/landing-ai/parse`, {
        method: 'POST',
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || JSON.stringify(data));
      const markdown = String(data.markdown ?? '');
      if (!markdown) throw new Error('Parse returned empty markdown');
      setInternalMarkdown(markdown);
      setInternalParseCached(true);
      setDbNote(
        `Internal parsed → Supabase (${data.cached ? 'cache hit' : 'saved'}) · ${Math.round(markdown.length / 1024)} KB markdown`,
      );
      setCacheStatusNote((prev) =>
        `${prev ? `${prev} · ` : ''}Internal parse cached`,
      );
      await fetchSavedAnalyses();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (/credit quota exceeded|insufficient credit|429/i.test(msg)) {
        setError(
          `Landing AI credits exhausted: ${msg}. Upgrade your Landing AI plan or wait for quota reset, then retry Parse. Your DB extract cache is still valid — no need to re-extract.`,
        );
      } else {
        setError(apiConnectionError(e));
      }
    } finally {
      setParsingInternal(false);
    }
  }

  async function loadInternalFromDb() {
    setLoadingInternalDb(true);
    setError('');
    try {
      const res = await fetch(
        `${API_BASE}/landing-ai/stored-points?docId=internal-imptfs`,
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || JSON.stringify(data));
      const points = (data.points ?? []) as GovPoint[];
      if (!points.length) throw new Error('No internal points in DB');
      setInternalPoints(points);
      setInternalLabel(data.fileName ?? 'I M P T F S.pdf');
      setExtractCredits((prev) =>
        `${prev ? `${prev} · ` : ''}Internal from DB: ${points.length} pts · 0 credits`,
      );
      setDbNote(`Loaded internal: ${data.fileName} (${points.length} points)`);
    } catch (e) {
      setError(apiConnectionError(e));
    } finally {
      setLoadingInternalDb(false);
    }
  }

  async function ensureInternalMarkdown(): Promise<{
    markdown: string;
    fileName: string;
  }> {
    const file = internalFiles?.[0];
    const fileName =
      internalLabel?.split(',')[0]?.trim() ||
      file?.name ||
      'I M P T F S.pdf';

    if (internalMarkdown) {
      return { markdown: internalMarkdown, fileName };
    }

    // Compare loads internal doc on the API from Supabase by internalFileHash.
    if (internalPoints.length > 0 || internalLabel) {
      return { markdown: '', fileName };
    }

    setComparePrep('Checking Landing AI parse cache…');
    try {
      const cached = await fetch(
        `${API_BASE}/landing-ai/stored-parse?docId=internal-imptfs`,
      );
      if (cached.ok) {
        const data = await cached.json();
        const markdown = String(data.markdown ?? '');
        if (markdown) {
          setInternalMarkdown(markdown);
          setComparePrep('');
          return {
            markdown,
            fileName: String(data.fileName ?? fileName),
          };
        }
      }
    } catch {
      /* fall through to PDF parse */
    }

    if (!file) {
      throw new Error(
        'Attach internal process PDF for Landing AI parse, or seed parse cache in Supabase (POST /landing-ai/parse once).',
      );
    }

    setComparePrep(
      'Parsing internal PDF via Landing AI ADE (1–3 min, uses credits)…',
    );
    const form = new FormData();
    form.append('file', file);
    let res: Response;
    try {
      res = await fetch(`${API_BASE}/landing-ai/parse`, {
        method: 'POST',
        body: form,
      });
    } catch (e) {
      setComparePrep('');
      throw new Error(apiConnectionError(e));
    }
    const data = await res.json();
    setComparePrep('');
    if (!res.ok) {
      throw new Error(data.message || JSON.stringify(data));
    }
    const markdown = String(data.markdown ?? '');
    if (!markdown) {
      throw new Error('Internal document parse returned empty markdown');
    }
    setInternalMarkdown(markdown);
    return { markdown, fileName };
  }

  async function analyzePoint(
    point: GovPoint,
    parsedInternal: { markdown: string; fileName: string },
    signal: AbortSignal,
  ): Promise<string> {
    const form = new FormData();
    form.append('point', JSON.stringify(point));
    form.append('internalFileName', parsedInternal.fileName);
    form.append('internalFileHash', INTERNAL_FILE_HASH);
    form.append('forceCompare', 'true');
    // Server loads full internal doc from Supabase parse/extract cache by hash.

    const res = await fetch(`${API_BASE}/landing-ai/compare-point`, {
      method: 'POST',
      body: form,
      signal,
    });
    const data = (await res.json()) as ApiResponse & { message?: string };
    if (!res.ok) {
      throw new Error(
        typeof data.message === 'string'
          ? data.message
          : JSON.stringify(data, null, 2),
      );
    }
    if (typeof data.message === 'string' && data.message.trim()) {
      return data.message;
    }
    return extractMessage(data);
  }

  function cancelCompare() {
    abortRef.current?.abort();
    abortRef.current = null;
    setComparing(false);
    setCompareItems((prev) =>
      prev.map((item) =>
        item.status === 'running' || item.status === 'pending'
          ? { ...item, status: 'cancelled' as const }
          : item,
      ),
    );
  }

  async function runComparison(targetPoints?: GovPoint[]) {
    const pointsToCompare = targetPoints ?? govPoints;
    if (!pointsToCompare.length) {
      setError(
        targetPoints
          ? 'Select at least one gov requirement point to compare'
          : 'Extract or load government requirement points first',
      );
      return;
    }
    if (!internalFiles?.length && !internalMarkdown && internalPoints.length === 0) {
      setError(
        'Load internal process from DB, attach internal PDF(s), or parse internal PDF before Compare.',
      );
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const initial: CompareItem[] = pointsToCompare.map((point, index) => ({
      index,
      point,
      status: 'pending',
    }));
    setCompareItems(initial);
    setComparing(true);
    setError('');
    setPhase(3);

    let parsedInternal: { markdown: string; fileName: string };
    try {
      parsedInternal = await ensureInternalMarkdown();
    } catch (e) {
      setComparing(false);
      setComparePrep('');
      setError(apiConnectionError(e));
      return;
    }

    const completedResults: CompareItem[] = [];

    for (let i = 0; i < pointsToCompare.length; i++) {
      if (controller.signal.aborted) break;

      setCompareItems((prev) =>
        prev.map((item, idx) =>
          idx === i ? { ...item, status: 'running' } : item,
        ),
      );

      try {
        const msg = await analyzePoint(
          pointsToCompare[i],
          parsedInternal,
          controller.signal,
        );
        const doneItem: CompareItem = {
          index: i,
          point: pointsToCompare[i],
          status: 'done',
          message: msg,
        };
        completedResults.push(doneItem);
        setCompareItems((prev) =>
          prev.map((item, idx) => (idx === i ? doneItem : item)),
        );
        await persistAnalysisToDb(completedResults, { quiet: true });
      } catch (e) {
        if (e instanceof Error && e.name === 'AbortError') break;
        const errMsg = e instanceof Error ? e.message : 'Compare failed';
        setCompareItems((prev) =>
          prev.map((item, idx) =>
            idx === i ? { ...item, status: 'error', error: errMsg } : item,
          ),
        );
      }
    }

    if (abortRef.current === controller) abortRef.current = null;
    setComparing(false);
    setPhase(4);

    const doneItems = completedResults.filter((i) => i.message);
    if (doneItems.length > 0) {
      await persistAnalysisToDb(doneItems);
    }
  }

  async function exportReportPdf() {
    if (!resultBlocks.length) return;
    await downloadComplianceDetailPdf(
      resultBlocks,
      reportStats,
      config.reportFilename('pdf'),
      config.reportTitle,
      reportSummary,
    );
  }

  async function exportFormattedExcel() {
    if (!resultBlocks.length) return;
    await downloadComplianceFormattedExcel(
      resultBlocks,
      config.reportFilename('xlsx'),
      config.excelRequirementHeader,
    );
  }

  async function exportMatrixExcel() {
    if (!resultBlocks.length) return;
    await downloadComplianceMatrixExcel(
      resultBlocks,
      config.matrixReportFilename('xlsx'),
    );
  }

  return (
    <main className="mx-auto max-w-7xl space-y-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">{config.title}</h1>
          <p className="mt-1 max-w-2xl text-slate-600">{config.subtitle}</p>
          <Link
            href={config.otherPageHref}
            className="mt-2 inline-block text-sm font-medium text-teal-700 hover:underline"
          >
            {config.otherPageLabel} →
          </Link>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={config.otherPageHref}
            className="rounded-lg border border-teal-600 px-4 py-2 text-sm font-medium text-teal-700 hover:bg-teal-50"
          >
            {granularity === 'section' ? 'Leaf compare' : 'Section compare'}
          </Link>
          <Link
            href={
              granularity === 'section'
                ? '/landing-ai/dual-verify'
                : '/landing-ai/dual-verify/detail'
            }
            className="rounded-lg border border-indigo-600 px-4 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-50"
          >
            Dual verify pipeline
          </Link>
          <Link
            href="/"
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50"
          >
            Home
          </Link>
        </div>
      </div>

      {/* Step indicator */}
      <div className="flex flex-wrap gap-2 text-xs font-medium">
        {[
          '1. Upload',
          '2. Extract (Landing AI)',
          config.stepCompare,
          '4. Results',
        ].map((label, i) => (
          <span
            key={label}
            className={`rounded-full px-3 py-1 ${
              phase >= i + 1
                ? 'bg-teal-600 text-white'
                : 'bg-slate-100 text-slate-500'
            }`}
          >
            {label}
          </span>
        ))}
      </div>

      <CsvToExcelPanel />
      <ExcelComparePanel />
      <SemanticMatrixComparePanel />

      {apiOnline === false && (
        <div className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900">
          <strong>API offline.</strong> The web app cannot reach{' '}
          <code className="rounded bg-red-100 px-1">{API_BASE}</code>. In a
          terminal run:{' '}
          <code className="rounded bg-red-100 px-1">npm run dev:api</code> from
          the repo root, then refresh this page.
        </div>
      )}

      <section className="rounded-xl border border-amber-200 bg-amber-50/80 p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-amber-950">
              Saved extracts (Supabase) — no Landing AI credits
            </h2>
            <p className="mt-1 text-xs text-amber-900/80">
              Your TFS Guidelines (96 gov) and I M P T F S (70 internal) responses
              are bundled. Seed once, then load from DB instead of re-extracting.
              {supabaseCache === false && (
                <span className="mt-1 block font-medium text-red-700">
                  Supabase tables missing — run migration SQL in Supabase, then
                  click Seed DB.
                </span>
              )}
              {supabaseCache === true && (
                <span className="mt-1 block text-emerald-800">
                  Supabase cache connected.
                </span>
              )}
            </p>
            {cacheStatusNote && (
              <p className="mt-2 text-xs text-amber-900/90">
                DB cache: {cacheStatusNote}
              </p>
            )}
            {dbNote && (
              <p className="mt-2 text-xs font-medium text-amber-950">{dbNote}</p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={seedDbToSupabase}
              disabled={seedingDb}
              className="rounded-lg border border-amber-400 bg-amber-100 px-3 py-1.5 text-xs font-medium text-amber-950 hover:bg-amber-200 disabled:opacity-40"
            >
              {seedingDb ? 'Seeding…' : '1. Seed DB (gov + internal)'}
            </button>
            <button
              type="button"
              onClick={loadGovFromDb}
              disabled={loadingGovDb}
              className="rounded-lg border border-violet-300 bg-violet-100 px-3 py-1.5 text-xs font-medium text-violet-900 hover:bg-violet-200 disabled:opacity-40"
            >
              {loadingGovDb ? 'Loading…' : '2. Load gov from DB'}
            </button>
            <button
              type="button"
              onClick={loadInternalFromDb}
              disabled={loadingInternalDb}
              className="rounded-lg border border-indigo-300 bg-indigo-100 px-3 py-1.5 text-xs font-medium text-indigo-900 hover:bg-indigo-200 disabled:opacity-40"
            >
              {loadingInternalDb ? 'Loading…' : '3. Load internal from DB'}
            </button>
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left: inputs */}
        <div className="space-y-4">
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold uppercase text-slate-500">
              Government requirement document
            </h2>
            <input
              type="file"
              accept=".pdf,.html,.htm,.png,.jpg,.jpeg"
              onChange={(e) => setGovFile(e.target.files?.[0] ?? null)}
              className="block w-full text-sm"
            />
            <p className="mt-1 text-xs text-slate-500">
              CBUAE / Cabinet Decision / regulatory PDF (PDF, HTML, image)
            </p>
            <button
              type="button"
              onClick={extractGovPoints}
              disabled={!govFile || extractingGov}
              className="mt-3 w-full rounded-lg bg-violet-600 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-40"
            >
              {extractingGov
                ? 'Extracting gov points…'
                : 'Extract gov points (Landing AI — uses credits)'}
            </button>
            <button
              type="button"
              onClick={loadGovFromDb}
              disabled={loadingGovDb}
              className="mt-2 w-full rounded-lg border border-violet-300 bg-violet-50 py-2 text-sm font-medium text-violet-900 hover:bg-violet-100 disabled:opacity-40"
            >
              {loadingGovDb ? 'Loading from DB…' : 'Load gov points from DB (free)'}
            </button>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold uppercase text-slate-500">
              Internal process document(s)
            </h2>
            <input
              ref={internalInputRef}
              type="file"
              accept=".pdf,.doc,.docx,.xlsx,.xls,application/pdf"
              multiple
              onChange={(e) => {
                setInternalFiles(e.target.files);
                setInternalMarkdown('');
                setInternalLabel(
                  e.target.files?.length
                    ? Array.from(e.target.files)
                        .map((f) => f.name)
                        .join(', ')
                    : null,
                );
              }}
              className="block w-full text-sm"
            />
            {internalLabel && (
              <p className="mt-1 text-xs font-medium text-emerald-700">
                Attached: {internalLabel}
              </p>
            )}
            <button
              type="button"
              onClick={parseInternalToDb}
              disabled={!internalFiles?.length || parsingInternal}
              className="mt-3 w-full rounded-lg border border-teal-400 bg-teal-50 py-2 text-sm font-medium text-teal-900 hover:bg-teal-100 disabled:opacity-40"
            >
              {parsingInternal
                ? 'Parsing internal PDF to Supabase…'
                : internalParseCached
                  ? 'Parse internal PDF → Supabase (cached ✓)'
                  : 'Parse internal PDF → Supabase (required before compare)'}
            </button>
            <button
              type="button"
              onClick={extractInternalPoints}
              disabled={!internalFiles?.length || extractingInternal}
              className="mt-3 w-full rounded-lg border border-indigo-300 bg-indigo-50 py-2 text-sm font-medium text-indigo-900 hover:bg-indigo-100 disabled:opacity-40"
            >
              {extractingInternal
                ? 'Extracting internal points…'
                : 'Extract internal points (Landing AI — uses credits)'}
            </button>
            <button
              type="button"
              onClick={loadInternalFromDb}
              disabled={loadingInternalDb}
              className="mt-2 w-full rounded-lg border border-indigo-200 bg-white py-2 text-sm font-medium text-indigo-800 hover:bg-indigo-50 disabled:opacity-40"
            >
              {loadingInternalDb
                ? 'Loading from DB…'
                : 'Load internal points from DB (free)'}
            </button>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-2 text-sm font-semibold uppercase text-slate-500">
              Saved analysis (from DB)
            </h2>
            <p className="mb-3 text-xs text-slate-600">
              Every compare run is saved to Supabase automatically (merged by
              point). Reload here without using Landing AI credits. Section and
              leaf analyses are stored separately.
            </p>
            {savedAnalyses.length === 0 ? (
              <p className="text-xs text-slate-500">
                {savedAnalysisHint ||
                  'No saved sessions yet. Run Compare — results save after each point.'}
              </p>
            ) : (
              <>
                {savedAnalysisHint && (
                  <p className="mb-2 text-xs font-medium text-amber-800">
                    {savedAnalysisHint}
                  </p>
                )}
                <select
                  value={selectedAnalysisId}
                  onChange={(e) => setSelectedAnalysisId(e.target.value)}
                  className="mb-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  {savedAnalyses.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </>
            )}
            <button
              type="button"
              onClick={loadSelectedAnalysis}
              disabled={
                !selectedAnalysisId ||
                loadingAnalysis ||
                savedAnalyses.find((s) => s.id === selectedAnalysisId)?.loadable ===
                  false
              }
              className="w-full rounded-lg border border-emerald-400 bg-emerald-50 py-2 text-sm font-medium text-emerald-900 hover:bg-emerald-100 disabled:opacity-40"
            >
              {loadingAnalysis
                ? 'Loading analysis…'
                : 'Load selected analysis (free)'}
            </button>
            <button
              type="button"
              onClick={syncAnalysisFromCache}
              disabled={loadingAnalysis}
              className="mt-2 w-full rounded-lg border border-sky-400 bg-sky-50 py-2 text-xs font-medium text-sky-900 hover:bg-sky-100 disabled:opacity-40"
            >
              Save all cached compare results → DB (free · no credits)
            </button>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            {skippedGovNote && (
              <p className="mb-2 text-xs font-medium text-amber-800">
                {skippedGovNote}
              </p>
            )}
            <p className="mb-3 text-sm text-slate-600">
              <strong>Extract</strong> uses Landing AI ADE (gov + internal point
              lists, cached in DB). <strong>Compare</strong> uses Landing AI only:
              Parse internal PDF once → ADE Extract with compliance schema per gov
              point. DB internal points are preview only — compare reads the full
              parsed PDF markdown, not the point list.
            </p>
            <button
              type="button"
              onClick={() => runComparison()}
              disabled={
                comparing ||
                govPoints.length === 0 ||
                (!internalFiles?.length &&
                  !internalMarkdown &&
                  internalPoints.length === 0)
              }
              className="w-full rounded-lg bg-teal-600 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-40"
            >
              {comparePrep
                ? comparePrep
                : comparing
                  ? `Comparing ${doneCount + 1} / ${totalCompare || govPoints.length}…`
                  : granularity === 'leaf'
                    ? `Compare all ${govPoints.length || '?'} leaf points (Landing AI)`
                    : `Compare all ${govPoints.length || '?'} sections (Landing AI)`}
            </button>
            <button
              type="button"
              onClick={() => runComparison(selectedGovPoints)}
              disabled={
                comparing ||
                selectedGovPoints.length === 0 ||
                (!internalFiles?.length &&
                  !internalMarkdown &&
                  internalPoints.length === 0)
              }
              className="mt-2 w-full rounded-lg border border-teal-600 py-2.5 text-sm font-semibold text-teal-700 hover:bg-teal-50 disabled:opacity-40"
            >
              {comparing && selectedGovPoints.length > 0
                ? `Comparing selected ${doneCount + 1} / ${totalCompare || selectedGovPoints.length}…`
                : `Compare selected (${selectedGovPoints.length})`}
            </button>
            {comparing && (
              <button
                type="button"
                onClick={cancelCompare}
                className="mt-2 w-full rounded-lg border border-red-300 py-2 text-sm text-red-700"
              >
                Cancel
              </button>
            )}
            {extractCredits && (
              <p className="mt-2 text-xs text-slate-500">{extractCredits}</p>
            )}
          </section>

          {error && (
            <pre className="overflow-auto rounded-lg bg-red-50 p-3 text-xs text-red-800">
              {error}
            </pre>
          )}
        </div>

        {/* Right: extracted points */}
        <div className="space-y-4">
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold uppercase text-slate-500">
                {granularity === 'leaf'
                  ? `Gov leaf points (${govPoints.length})`
                  : `Gov section points (${govPoints.length})`}
              </h2>
              {govPoints.length > 0 && (
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-slate-500">
                    {selectedGovIds.size} selected
                  </span>
                  <button
                    type="button"
                    onClick={selectAllGovPoints}
                    className="text-violet-700 hover:underline"
                  >
                    Select all
                  </button>
                  <span className="text-slate-300">|</span>
                  <button
                    type="button"
                    onClick={clearGovSelection}
                    className="text-violet-700 hover:underline"
                  >
                    Clear
                  </button>
                </div>
              )}
            </div>
            {govPoints.length === 0 ? (
              <p className="text-sm text-slate-500">
                Upload a gov document and click Extract gov points.
              </p>
            ) : (
              <ul className="max-h-[32rem] space-y-3 overflow-auto text-sm">
                {govPointsByChapter.map(({ chapter, points: chapterPoints, sections }) => {
                  const chapterSelected = chapterPoints.filter((p) =>
                    selectedGovIds.has(p.point_id),
                  ).length;
                  const chapterAllSelected =
                    chapterPoints.length > 0 &&
                    chapterSelected === chapterPoints.length;

                  return (
                    <li
                      key={`chapter-${chapter}`}
                      className="rounded-lg border border-slate-200 bg-slate-50/80"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-3 py-2">
                        <span className="text-xs font-bold uppercase tracking-wide text-slate-600">
                          {formatChapterLabel(chapter)} · {chapterPoints.length} point
                          {chapterPoints.length === 1 ? '' : 's'}
                          {chapterSelected > 0 && (
                            <span className="ml-1 font-normal normal-case text-violet-700">
                              ({chapterSelected} selected)
                            </span>
                          )}
                        </span>
                        <button
                          type="button"
                          onClick={() => toggleGovPointsByPrefix(chapter)}
                          className="text-xs font-medium text-violet-700 hover:underline"
                        >
                          {chapterAllSelected
                            ? `Deselect all ${formatChapterLabel(chapter)}`
                            : `Select all ${formatChapterLabel(chapter)}`}
                        </button>
                      </div>
                      <ul className="space-y-2 p-2">
                        {sections.map(({ key, points: sectionPoints }) => {
                          const showSectionBar =
                            sections.length > 1 || key !== chapter;
                          const sectionSelected = sectionPoints.filter((p) =>
                            selectedGovIds.has(p.point_id),
                          ).length;
                          const sectionAllSelected =
                            sectionPoints.length > 0 &&
                            sectionSelected === sectionPoints.length;

                          return (
                            <li key={`section-${key}`}>
                              {showSectionBar && (
                                <div className="mb-1 flex flex-wrap items-center justify-between gap-2 px-1">
                                  <span className="text-[11px] font-semibold text-slate-500">
                                    {formatSectionGroupLabel(key)}
                                    {sectionSelected > 0 && (
                                      <span className="ml-1 font-normal text-violet-600">
                                        ({sectionSelected}/{sectionPoints.length})
                                      </span>
                                    )}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => toggleGovPointsByPrefix(key)}
                                    className="text-[11px] text-violet-700 hover:underline"
                                  >
                                    {sectionAllSelected
                                      ? `Deselect ${formatSectionGroupLabel(key)}`
                                      : `Select ${formatSectionGroupLabel(key)}`}
                                  </button>
                                </div>
                              )}
                              <ul className="space-y-2">
                                {sectionPoints.map((p) => renderGovPointRow(p))}
                              </ul>
                            </li>
                          );
                        })}
                      </ul>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {internalPoints.length > 0 && (
            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="mb-2 text-sm font-semibold uppercase text-slate-500">
                Internal policy points ({internalPoints.length})
              </h2>
              <ul className="max-h-40 space-y-1 overflow-auto text-xs text-slate-600">
                {internalPoints.slice(0, 20).map((p) => (
                  <li key={p.point_id}>
                    <strong>{p.point_id}</strong> {p.title ?? p.text.slice(0, 60)}
                  </li>
                ))}
                {internalPoints.length > 20 && (
                  <li className="text-slate-400">
                    +{internalPoints.length - 20} more…
                  </li>
                )}
              </ul>
            </section>
          )}

          {comparing && totalCompare > 0 && (
            <div className="h-2 overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full bg-teal-600 transition-all"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          )}
        </div>
      </div>

      {/* Results */}
      {doneCount > 0 && (
        <section className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-teal-200 bg-teal-50 px-4 py-3">
            <p className="text-sm font-medium text-teal-900">
              {doneCount} point{doneCount === 1 ? '' : 's'} mapped · export
              compare results (run Compare first if empty)
            </p>
            <div className="flex flex-wrap gap-2">
              <ReferenceCopyButton message={combinedMessage} label="Copy all" />
              <button
                type="button"
                onClick={exportMatrixExcel}
                className="rounded-md border border-sky-500 bg-sky-600 px-3 py-1 text-xs font-medium text-white hover:bg-sky-700"
                title="Export compare results using TFS matrix column layout"
              >
                Matrix Excel (from compare)
              </button>
              <button
                type="button"
                onClick={exportFormattedExcel}
                className="rounded-md border border-emerald-500 bg-emerald-600 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-700"
                title="Export compare results in BCP formatted layout"
              >
                Formatted Excel (from compare)
              </button>
              <button
                type="button"
                onClick={exportReportPdf}
                className="rounded-md border border-amber-400 bg-amber-500 px-3 py-1 text-xs font-medium text-white hover:bg-amber-600"
              >
                Compliance report PDF
              </button>
              <DownloadMapperPdfButton
                message={combinedMessage}
                referenceFileNames={referenceFileNames}
                sourceFiles={internalFiles}
                label="Annotated internal PDF"
              />
            </div>
          </div>

          <div className="space-y-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                {config.reportTitle}
              </h2>
              <p className="text-xs text-slate-500">
                Generated {new Date().toLocaleString()}
              </p>
            </div>

            <ColorCodeLegend results={parsedResults} />

            <section>
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-violet-800">
                Statistics
              </h3>
              <p className="mb-3 text-sm text-slate-600">
                {reportStats.total} point{reportStats.total === 1 ? '' : 's'}{' '}
                analyzed
              </p>
              <StatusTierBoxes stats={reportStats} />
            </section>

            {reportSummary && (
              <section>
                <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-violet-800">
                  Executive summary
                </h3>
                <div className="rounded-lg border border-slate-100 bg-slate-50 p-4">
                  <MarkdownSummary text={reportSummary} />
                </div>
              </section>
            )}

            <section>
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-amber-800">
                Attention focus (&lt; 100% or Partial / Non-Compliant)
              </h3>
              <AttentionFocusCompact items={reportStats.attentionItems} />
            </section>
          </div>

          <section>
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-violet-800">
              Detailed results ({resultBlocks.length})
            </h2>
            <div className="space-y-6">
              {resultBlocks.map((block, i) => (
                <ReferenceComplianceCard
                  key={`${block.title}-${i}`}
                  block={block}
                />
              ))}
            </div>
          </section>
        </section>
      )}
    </main>
  );
}
