'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AI_MODELS,
  API_BASE,
  DEFAULT_PDF_NAME,
} from '../../lib/ai-lab/constants';
import { assignFileInput, loadDefaultPdfFile } from '../../lib/ai-lab/pdf';
import {
  ReferenceComplianceCard,
} from '../../lib/ai-lab/reference-compliance-view';
import {
  AttentionFocusCompact,
  ColorCodeLegend,
  MarkdownSummary,
  StatusTierBoxes,
} from '../../lib/ai-lab/compliance-report-view';
import { parseReferenceComplianceBlock } from '../../lib/ai-lab/parse-reference-response';
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
import {
  agreementBadgeClass,
  compareDualVerifyResults,
  type AgreementStatus,
  type DualVerifyAgreement,
} from '../../lib/landing-ai/dual-verify-merge';
import {
  buildDualVerifyExecutiveSummary,
  buildDualVerifySummaryStats,
  buildPassReport,
  downloadDualVerifyExcel,
  downloadDualVerifyPdf,
  type DualVerifyExportPass,
} from '../../lib/landing-ai/dual-verify-export';
import { buildDualVerifyPrompt } from '../../lib/landing-ai/dual-verify-prompt';
import {
  listLocalDualVerifySessions,
  loadLocalDualVerifySession,
  loadLocalDualVerifySessionById,
  saveLocalDualVerifySession,
} from '../../lib/landing-ai/local-dual-verify-session';
import {
  AMLCFT_GOV_DOCS,
  hashFileList,
  loadAmlcftDefaultGovFiles,
  loadAmlcftDefaultInternalFiles,
  prefixGovPoints,
} from '../../lib/landing-ai/amlcft-docs';

type CompareGranularity = 'section' | 'leaf';
export type WorkbenchProfile = 'tfs' | 'amlcft';

const CONFIG: Record<
  CompareGranularity,
  {
    title: string;
    subtitle: string;
    otherHref: string;
    otherLabel: string;
    filter: (points: FilterGovPoint[]) => {
      comparable: FilterGovPoint[];
      skipped: Array<{ point: FilterGovPoint; reason: string }>;
    };
  }
> = {
  section: {
    title: 'Dual Verify — Section (2.1, 2.2…)',
    subtitle:
      'Section-level compare: one unit per §2.1, §2.2, §2.3… (sub-points 2.1.1–2.1.6 merged). Pass 1 Landing AI → Pass 2 LLM.',
    otherHref: '/landing-ai/dual-verify/detail',
    otherLabel: 'Switch to leaf dual verify (2.1.1, 2.1.2…)',
    filter: filterComparableGovPoints,
  },
  leaf: {
    title: 'Dual Verify — Leaf (2.1.1, 2.1.2…)',
    subtitle:
      'Leaf-level compare: each sub-point (2.1.1, 2.1.2…) under §2 → §2.1 headers. Pass 1 Landing AI → Pass 2 LLM.',
    otherHref: '/landing-ai/dual-verify',
    otherLabel: 'Switch to section dual verify (2.1, 2.2…)',
    filter: filterComparableGovLeafPoints,
  },
};

const GOV_FILE_HASH =
  'c84713f9aacd18415680356aeae47bcacff9c17458b5595b575400b12fe8f2ff';
const INTERNAL_FILE_HASH =
  '6a0a0bd13c7a32ea10c43c9a8391347a7e0caceaa0b17dd6443e9ee622111717';

type SessionGranularity =
  | 'dual-section'
  | 'dual-leaf'
  | 'amlcft-dual-section'
  | 'amlcft-dual-leaf';

type SavedAnalysisOption = {
  id: string;
  source: 'session' | 'compare_cache' | 'extract_cache';
  label: string;
  comparedPoints?: number;
  totalGovPoints?: number;
  loadable?: boolean;
};

type GovPoint = {
  point_id: string;
  title?: string;
  text: string;
};

type PipelinePhase =
  | 'pending'
  | 'landing'
  | 'llm'
  | 'done'
  | 'error'
  | 'cancelled';

type DualVerifyItem = {
  index: number;
  point: GovPoint;
  phase: PipelinePhase;
  landingMessage?: string;
  llmMessage?: string;
  agreement?: DualVerifyAgreement;
  error?: string;
};

function extractMessage(data: Record<string, unknown>): string {
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

function sessionGranularityFor(
  granularity: CompareGranularity,
  profile: WorkbenchProfile,
): SessionGranularity {
  if (profile === 'amlcft') {
    return granularity === 'section'
      ? 'amlcft-dual-section'
      : 'amlcft-dual-leaf';
  }
  return granularity === 'section' ? 'dual-section' : 'dual-leaf';
}

function profileBasePath(profile: WorkbenchProfile): string {
  return profile === 'amlcft' ? '/landing-ai/amlcft' : '/landing-ai/dual-verify';
}

export function DualVerifyWorkbench({
  granularity,
  profile = 'tfs',
}: {
  granularity: CompareGranularity;
  profile?: WorkbenchProfile;
}) {
  const basePath = profileBasePath(profile);
  const cfg = {
    ...CONFIG[granularity],
    ...(profile === 'amlcft'
      ? {
          title:
            granularity === 'section'
              ? 'AML/CFT Gap Analysis — Section'
              : 'AML/CFT Gap Analysis — Leaf',
          subtitle:
            'Hammad scope: Cabinet Decision + AML Law vs Internal AML Manual + Implementation manual. Pass 1 Landing AI → Pass 2 LLM.',
          otherHref:
            granularity === 'section'
              ? `${basePath}/detail`
              : basePath,
          otherLabel:
            granularity === 'section'
              ? 'Switch to leaf (sub-clauses)'
              : 'Switch to section compare',
        }
      : {}),
  };
  const sessionGranularity = sessionGranularityFor(granularity, profile);
  const [govFile, setGovFile] = useState<File | null>(null);
  const [govFiles, setGovFiles] = useState<File[]>([]);
  const [govPoints, setGovPoints] = useState<GovPoint[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [internalFiles, setInternalFiles] = useState<FileList | null>(null);
  const [internalLabel, setInternalLabel] = useState<string | null>(null);
  const [internalFileHash, setInternalFileHash] = useState<string | null>(null);
  const [govBundleHash, setGovBundleHash] = useState<string | null>(null);
  const [docxSupplementMarkdown, setDocxSupplementMarkdown] = useState('');
  const [aiModel, setAiModel] = useState('gemini-3.5-flash');
  const [items, setItems] = useState<DualVerifyItem[]>([]);
  const [running, setRunning] = useState(false);
  const [extractingGov, setExtractingGov] = useState(false);
  const [loadingGov, setLoadingGov] = useState(false);
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [skippedGovCount, setSkippedGovCount] = useState(0);
  const [skippedGovNote, setSkippedGovNote] = useState('');
  const [savedAnalyses, setSavedAnalyses] = useState<SavedAnalysisOption[]>([]);
  const [selectedAnalysisId, setSelectedAnalysisId] = useState('');
  const [savedAnalysisHint, setSavedAnalysisHint] = useState('');
  const [dbNote, setDbNote] = useState('');
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [parsePrep, setParsePrep] = useState('');
  const [exportPass, setExportPass] = useState<DualVerifyExportPass>('both');
  const [exporting, setExporting] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (profile === 'amlcft') {
          const [gov, internal] = await Promise.all([
            loadAmlcftDefaultGovFiles(),
            loadAmlcftDefaultInternalFiles(),
          ]);
          if (cancelled) return;
          setGovFiles(gov);
          setGovBundleHash(await hashFileList(gov));
          const dt = new DataTransfer();
          internal.forEach((f) => dt.items.add(f));
          setInternalFiles(dt.files);
          setInternalLabel(internal.map((f) => f.name).join(', '));
          if (fileRef.current) assignFileInput(fileRef.current, dt.files);
          setNote(
            'Loaded Hammad AML/CFT document set from default-docs/amlcft. Extract gov points to begin.',
          );
          return;
        }
        const file = await loadDefaultPdfFile();
        if (!file || cancelled) return;
        const dt = new DataTransfer();
        dt.items.add(file);
        setInternalFiles(dt.files);
        setInternalLabel(DEFAULT_PDF_NAME);
        if (fileRef.current) assignFileInput(fileRef.current, dt.files);
      } catch {
        /* optional default pdf */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [profile]);

  useEffect(() => {
    fetchSavedAnalyses();
  }, [sessionGranularity]);

  /** TFS: auto-load gov points from Supabase so §2.1 / 2.1.1 list appears without an extra click. */
  useEffect(() => {
    if (profile !== 'tfs' || govPoints.length > 0) return;
    let cancelled = false;
    (async () => {
      setLoadingGov(true);
      try {
        const res = await fetch(
          `${API_BASE}/landing-ai/stored-points?docId=gov-tfs-guidelines`,
        );
        const raw = await res.text();
        if (!res.ok || cancelled) return;
        const data = JSON.parse(raw) as { points?: GovPoint[] };
        const all = data.points ?? [];
        if (!all.length) return;
        const { comparable, skipped } = CONFIG[granularity].filter(all);
        if (!comparable.length || cancelled) return;
        applyGovPoints(comparable);
        setSkippedGovCount(skipped.length);
        setSkippedGovNote(
          skipped.length
            ? `Skipped ${skipped.length} informational/intro points (not compared)`
            : '',
        );
        setNote(
          `Loaded ${comparable.length} points (${skipped.length} skipped) from Supabase · 0 credits`,
        );
      } catch {
        /* user can click Load from Supabase manually */
      } finally {
        if (!cancelled) setLoadingGov(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [profile, granularity, govPoints.length]);

  async function fetchSavedAnalyses() {
    try {
      const res = await fetch(
        `${API_BASE}/landing-ai/compliance-sessions?limit=30&granularity=${sessionGranularity}`,
      );
      const body = res.ok
        ? ((await res.json()) as {
            sessions?: SavedAnalysisOption[];
            diagnostics?: { hint?: string };
          })
        : null;
      const remote = body?.sessions ?? [];
      const remoteIds = new Set(remote.map((s) => s.id));
      const local = listLocalDualVerifySessions(sessionGranularity)
        .filter((s) => !remoteIds.has(s.id))
        .map((s) => ({
          id: s.id,
          source: 'extract_cache' as const,
          label: `${s.govFileName} vs ${s.internalFileName} · ${sessionGranularity} · ${s.comparedPoints}/${s.totalGovPoints} pts · local backup`,
        }));
      const sessions = [...remote, ...local];
      setSavedAnalyses(sessions);
      setSavedAnalysisHint(
        typeof body?.diagnostics?.hint === 'string'
          ? body.diagnostics.hint
          : '',
      );
      const preferred =
        sessions.find(
          (s) => s.source === 'session' || s.source === 'extract_cache',
        ) ?? sessions[0];
      if (preferred) setSelectedAnalysisId(preferred.id);
    } catch {
      const local = listLocalDualVerifySessions(sessionGranularity).map((s) => ({
        id: s.id,
        source: 'extract_cache' as const,
        label: `${s.govFileName} vs ${s.internalFileName} · local backup`,
      }));
      setSavedAnalyses(local);
    }
  }

  function applyGovPoints(comparable: GovPoint[]) {
    setGovPoints(comparable);
    setSelectedIds(new Set());
  }

  async function extractGovPoints() {
    const sources =
      profile === 'amlcft'
        ? govFiles
        : govFile
          ? [govFile]
          : [];
    if (!sources.length) {
      setError(
        profile === 'amlcft'
          ? 'Load or attach both gov PDFs (Cabinet Decision + AML Law)'
          : 'Upload a government requirement document first',
      );
      return;
    }
    setExtractingGov(true);
    setError('');
    try {
      const merged: GovPoint[] = [];
      let totalCredits = 0;
      let anyCached = false;

      for (let i = 0; i < sources.length; i++) {
        const file = sources[i];
        const meta = profile === 'amlcft' ? AMLCFT_GOV_DOCS[i] : undefined;
        const form = new FormData();
        form.append('file', file);
        const res = await fetch(`${API_BASE}/landing-ai/extract-gov-points`, {
          method: 'POST',
          body: form,
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || JSON.stringify(data));
        const points = (data.points ?? []) as GovPoint[];
        if (!points.length) {
          throw new Error(`No requirement points found in ${file.name}`);
        }
        const tagged =
          profile === 'amlcft' && meta
            ? prefixGovPoints(points, meta.pointPrefix, meta.label)
            : points;
        merged.push(...tagged);
        totalCredits += Number(data.creditUsage ?? 0);
        if (data.cached) anyCached = true;
      }

      const { comparable, skipped } = cfg.filter(merged);
      applyGovPoints(comparable);
      setSkippedGovCount(skipped.length);
      setSkippedGovNote(
        skipped.length
          ? `Skipped ${skipped.length} informational/intro points (not compared)`
          : '',
      );
      if (profile === 'amlcft') {
        setGovBundleHash(await hashFileList(sources));
      }
      setNote(
        `Gov extract: ${comparable.length} compare · ${skipped.length} skipped · credits ${totalCredits}${anyCached ? ' (partial cache)' : ''}`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gov extraction failed');
    } finally {
      setExtractingGov(false);
    }
  }

  async function persistDualVerifyToDb(
    doneItems: DualVerifyItem[],
    options?: { quiet?: boolean },
  ) {
    if (!doneItems.length) return;

    const govHash = govBundleHash ?? GOV_FILE_HASH;
    const internalHash = internalFileHash ?? INTERNAL_FILE_HASH;
    const resultsJson = doneItems.map((i) => ({
      point_id: i.point.point_id,
      title: i.point.title,
      text: i.point.text,
      message: i.landingMessage ?? '',
      landingMessage: i.landingMessage,
      llmMessage: i.llmMessage,
      agreementJson: i.agreement,
    }));
    const summaryJson = {
      pipeline: profile === 'amlcft' ? 'amlcft-dual-verify' : 'dual-verify',
      aiModel,
      mismatchCount: doneItems.filter(
        (i) => i.agreement && i.agreement.status !== 'aligned',
      ).length,
    };
    const sessionKey = `${govHash}:${internalHash}:${sessionGranularity}`;
    const existingLocal = loadLocalDualVerifySession(sessionKey);

    saveLocalDualVerifySession({
      id: existingLocal?.id ?? crypto.randomUUID(),
      sessionKey,
      granularity: sessionGranularity,
      govFileHash: govHash,
      internalFileHash: internalHash,
      govFileName:
        profile === 'amlcft' ? 'AML/CFT gov bundle' : 'TFS Guidelines.pdf',
      internalFileName:
        internalLabel?.split(',')[0]?.trim() ||
        internalFiles?.[0]?.name ||
        'I M P T F S.pdf',
      totalGovPoints: govPoints.length + skippedGovCount,
      comparedPoints: doneItems.length,
      skippedPoints: skippedGovCount,
      skippedJson: skippedGovNote,
      resultsJson,
      summaryJson,
      updatedAt: new Date().toISOString(),
    });

    try {
      const saveRes = await fetch(`${API_BASE}/landing-ai/compliance-sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          govFileHash: govHash,
          internalFileHash: internalHash,
          govFileName:
            profile === 'amlcft'
              ? 'AML/CFT gov bundle'
              : 'TFS Guidelines.pdf',
          internalFileName:
            internalLabel?.split(',')[0]?.trim() ||
            internalFiles?.[0]?.name ||
            'I M P T F S.pdf',
          totalGovPoints: govPoints.length + skippedGovCount,
          comparedPoints: doneItems.length,
          skippedPoints: skippedGovCount,
          skippedJson: skippedGovNote,
          compareGranularity: sessionGranularity,
          resultsJson,
          summaryJson,
        }),
      });
      const saveData = (await saveRes.json().catch(() => ({}))) as {
        message?: string;
        comparedPoints?: number;
        source?: string;
      };
      if (!saveRes.ok) {
        const msg =
          typeof saveData.message === 'string'
            ? saveData.message
            : 'Session save failed';
        if (!options?.quiet) {
          setDbNote(
            `Supabase save failed (${msg}) — progress kept in browser local backup`,
          );
        }
        return;
      }
      if (!options?.quiet) {
        const via =
          saveData.source === 'extract_cache'
            ? 'Supabase extract cache'
            : 'Supabase';
        setDbNote(
          `Dual verify saved to ${via} (${sessionGranularity} · ${saveData.comparedPoints ?? doneItems.length} points) — reload anytime without credits`,
        );
      }
      await fetchSavedAnalyses();
    } catch (e) {
      if (!options?.quiet) {
        setDbNote(
          `API unreachable — progress saved in browser local backup only (${apiConnectionError(e)})`,
        );
      }
    }
  }

  async function loadSelectedAnalysis() {
    if (!selectedAnalysisId) {
      setError('Select a saved analysis from the list');
      return;
    }
    setLoadingAnalysis(true);
    setError('');
    try {
      if (!govPoints.length) {
        await loadGovFromDb();
      }

      const local = loadLocalDualVerifySessionById(selectedAnalysisId);
      const data = local
        ? {
            results: local.resultsJson,
            comparedPoints: local.comparedPoints,
          }
        : await (async () => {
            const res = await fetch(
              `${API_BASE}/landing-ai/compliance-sessions/${encodeURIComponent(selectedAnalysisId)}?granularity=${sessionGranularity}`,
            );
            const json = await res.json();
            if (!res.ok) throw new Error(json.message || JSON.stringify(json));
            return json;
          })();

      const results = (data.results ?? []) as Array<{
        point_id: string;
        title?: string;
        text?: string;
        message?: string;
        landingMessage?: string;
        llmMessage?: string;
        agreementJson?: DualVerifyAgreement;
      }>;
      if (!results.length) {
        throw new Error('No dual verify results in this saved analysis');
      }

      const loaded: DualVerifyItem[] = results.map((r, index) => {
        const landingMessage = r.landingMessage ?? r.message ?? '';
        const llmMessage = r.llmMessage ?? '';
        return {
          index,
          point: {
            point_id: r.point_id,
            title: r.title,
            text: r.text ?? '',
          },
          phase: 'done' as const,
          landingMessage,
          llmMessage,
          agreement:
            r.agreementJson ??
            (landingMessage && llmMessage
              ? compareDualVerifyResults(landingMessage, llmMessage)
              : undefined),
        };
      });
      setItems(loaded);
      setSelectedIds(new Set());
      setDbNote(
        `Loaded dual verify: ${data.comparedPoints} points · 0 credits${local ? ' (local backup)' : ''}`,
      );
    } catch (e) {
      setError(apiConnectionError(e));
    } finally {
      setLoadingAnalysis(false);
    }
  }

  const govByChapter = useMemo(
    () => groupGovPointsByChapter(govPoints),
    [govPoints],
  );

  const doneExportItems = useMemo(
    () =>
      items
        .filter(
          (i): i is DualVerifyItem & {
            landingMessage: string;
            llmMessage: string;
            agreement: DualVerifyAgreement;
          } =>
            i.phase === 'done' &&
            Boolean(i.landingMessage) &&
            Boolean(i.llmMessage) &&
            Boolean(i.agreement),
        )
        .map((i) => ({
          point: i.point,
          landingMessage: i.landingMessage,
          llmMessage: i.llmMessage,
          agreement: i.agreement,
        })),
    [items],
  );

  const summaryStats = useMemo(
    () => buildDualVerifySummaryStats(doneExportItems),
    [doneExportItems],
  );

  const executiveSummary = useMemo(
    () => buildDualVerifyExecutiveSummary(summaryStats, exportPass),
    [summaryStats, exportPass],
  );

  const pass1Report = useMemo(
    () => buildPassReport(doneExportItems, 'pass1'),
    [doneExportItems],
  );

  const pass2Report = useMemo(
    () => buildPassReport(doneExportItems, 'pass2'),
    [doneExportItems],
  );

  const legendResults = useMemo(() => {
    if (exportPass === 'pass1') return pass1Report.results;
    if (exportPass === 'pass2') return pass2Report.results;
    return [...pass1Report.results, ...pass2Report.results];
  }, [exportPass, pass1Report.results, pass2Report.results]);

  const attentionResults = useMemo(() => {
    if (exportPass === 'pass1') return pass1Report.stats.attentionItems;
    if (exportPass === 'pass2') return pass2Report.stats.attentionItems;
    return [
      ...pass1Report.stats.attentionItems.map((item) => ({
        ...item,
        title: `[Pass 1] ${item.title}`,
      })),
      ...pass2Report.stats.attentionItems.map((item) => ({
        ...item,
        title: `[Pass 2] ${item.title}`,
      })),
    ];
  }, [exportPass, pass1Report.stats.attentionItems, pass2Report.stats.attentionItems]);

  const reportTitle =
    profile === 'amlcft'
      ? `AML/CFT Dual Verify — ${granularity === 'section' ? 'Section' : 'Leaf'}`
      : `Dual Verify — ${granularity === 'section' ? 'Section' : 'Leaf'}`;

  const exportFilenameBase =
    profile === 'amlcft' ? `amlcft-${granularity}` : `dual-${granularity}`;

  async function exportDualVerifyPdf() {
    if (!doneExportItems.length) return;
    setExporting(true);
    try {
      await downloadDualVerifyPdf(
        doneExportItems,
        exportPass,
        reportTitle,
        exportFilenameBase,
      );
    } finally {
      setExporting(false);
    }
  }

  async function exportDualVerifyExcel() {
    if (!doneExportItems.length) return;
    setExporting(true);
    try {
      await downloadDualVerifyExcel(
        doneExportItems,
        exportPass,
        exportFilenameBase,
      );
    } finally {
      setExporting(false);
    }
  }

  const doneCount = items.filter((i) => i.phase === 'done').length;
  const mismatchCount = items.filter(
    (i) =>
      i.agreement &&
      i.agreement.status !== 'aligned',
  ).length;

  async function loadGovFromDb() {
    setLoadingGov(true);
    setError('');
    try {
      const res = await fetch(
        `${API_BASE}/landing-ai/stored-points?docId=gov-tfs-guidelines`,
      );
      const raw = await res.text();
      if (!res.ok) {
        if (raw.includes('Cannot GET')) {
          throw new Error(
            `API not reachable at ${API_BASE}. Run npm run dev:api (port 4000).`,
          );
        }
        throw new Error(raw.slice(0, 200) || `HTTP ${res.status}`);
      }
      const data = JSON.parse(raw) as { points?: GovPoint[]; message?: string };
      const all = (data.points ?? []) as GovPoint[];
      if (!all.length) {
        throw new Error(
          data.message ??
            'No gov points in Supabase. Run Extract live or POST /landing-ai/seed/builtin.',
        );
      }
      const { comparable, skipped } = cfg.filter(all);
      applyGovPoints(comparable);
      setSkippedGovCount(skipped.length);
      setSkippedGovNote(
        skipped.length
          ? `Skipped ${skipped.length} informational/intro points (not compared)`
          : '',
      );
      setNote(
        `Loaded ${comparable.length} points (${skipped.length} skipped) from Supabase · 0 credits`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoadingGov(false);
    }
  }

  async function ensureInternalParseReady(): Promise<void> {
    const files = internalFiles ? Array.from(internalFiles) : [];
    if (!files.length) {
      throw new Error('Attach internal policy documents (AML Manual + Implementation manual).');
    }

    if (profile === 'tfs') {
      setParsePrep('Checking IMPTFS parse cache (step 1)…');
      try {
        const cached = await fetch(
          `${API_BASE}/landing-ai/stored-parse?docId=internal-imptfs`,
        );
        if (cached.ok) {
          const data = await cached.json();
          if (String(data.markdown ?? '').trim()) {
            setInternalFileHash(String(data.fileHash ?? INTERNAL_FILE_HASH));
            setParsePrep('');
            return;
          }
        }
      } catch {
        /* fall through */
      }
    }

    setParsePrep(
      profile === 'amlcft'
        ? 'Parsing internal AML Manual (PDF) + Implementation manual (DOCX)…'
        : 'Parsing IMPTFS via Landing AI ADE (step 1 · 1–3 min)…',
    );

    const hashParts: string[] = [];
    const docxParts: string[] = [];

    for (const file of files) {
      const form = new FormData();
      form.append('file', file);
      let res: Response;
      try {
        res = await fetch(`${API_BASE}/landing-ai/parse`, {
          method: 'POST',
          body: form,
        });
      } catch (e) {
        setParsePrep('');
        throw new Error(apiConnectionError(e));
      }
      const data = await res.json();
      if (!res.ok) {
        setParsePrep('');
        throw new Error(data.message || JSON.stringify(data));
      }
      const markdown = String(data.markdown ?? '').trim();
      if (!markdown) {
        setParsePrep('');
        throw new Error(`Parse returned empty markdown for ${file.name}`);
      }
      if (file.name.toLowerCase().endsWith('.docx')) {
        docxParts.push(`# ${file.name}\n\n${markdown}`);
      }
      if (typeof data.fileHash === 'string') {
        hashParts.push(data.fileHash);
      }
    }

    setDocxSupplementMarkdown(docxParts.join('\n\n---\n\n'));
    if (hashParts.length) {
      const combined = await hashFileList(
        files.map((f, i) => new File([f], `${hashParts[i] ?? i}-${f.name}`)),
      );
      setInternalFileHash(combined);
    }
    setParsePrep('');
  }

  async function landingPass(
    point: GovPoint,
    signal: AbortSignal,
  ): Promise<string> {
    const form = new FormData();
    form.append('point', JSON.stringify(point));
    form.append(
      'internalFileName',
      internalLabel?.split(',')[0]?.trim() ?? DEFAULT_PDF_NAME,
    );
    if (profile === 'tfs') {
      form.append('internalFileHash', INTERNAL_FILE_HASH);
    } else if (internalFileHash) {
      form.append('internalFileHash', internalFileHash);
    }
    if (profile === 'amlcft' && internalFiles?.length) {
      Array.from(internalFiles).forEach((f, i) => {
        form.append(i === 0 ? 'file' : 'files', f);
      });
    }
    form.append('forceCompare', 'true');
    const res = await fetch(`${API_BASE}/landing-ai/compare-point`, {
      method: 'POST',
      body: form,
      signal,
    });
    const data = (await res.json()) as Record<string, unknown>;
    if (!res.ok) {
      throw new Error(
        typeof data.message === 'string'
          ? data.message
          : JSON.stringify(data),
      );
    }
    const msg = extractMessage(data);
    if (!msg.trim()) throw new Error('Landing AI returned empty message');
    return msg;
  }

  async function llmPass(
    point: GovPoint,
    landingMessage: string,
    signal: AbortSignal,
  ): Promise<string> {
    let prompt = buildDualVerifyPrompt(point, landingMessage);
    if (docxSupplementMarkdown.trim()) {
      prompt += `\n\nADDITIONAL INTERNAL DOCUMENT (Implementation Manual — search this for Pass 2 evidence):\n---\n${docxSupplementMarkdown.trim()}\n---\n`;
    }
    const form = new FormData();
    form.append('prompt', prompt);
    form.append('aiModel', aiModel);
    if (internalFiles?.length) {
      const pdfs = Array.from(internalFiles).filter((f) =>
        f.name.toLowerCase().endsWith('.pdf'),
      );
      pdfs.forEach((f, i) => {
        form.append(i === 0 ? 'file' : 'files', f);
      });
    }
    const res = await fetch(`${API_BASE}/ai/bcpanalyze`, {
      method: 'POST',
      body: form,
      signal,
    });
    const data = (await res.json()) as Record<string, unknown>;
    if (!res.ok || data.success === false) {
      throw new Error(
        typeof data.message === 'string'
          ? data.message
          : String(data.error ?? JSON.stringify(data)),
      );
    }
    const msg = extractMessage(data);
    if (!msg.trim()) throw new Error('LLM returned empty message');
    return msg;
  }

  function cancelPipeline() {
    abortRef.current?.abort();
    abortRef.current = null;
    setRunning(false);
    setItems((prev) =>
      prev.map((item) =>
        item.phase === 'pending' ||
        item.phase === 'landing' ||
        item.phase === 'llm'
          ? { ...item, phase: 'cancelled' as const }
          : item,
      ),
    );
  }

  async function runDualVerify() {
    const selected = govPoints.filter((p) => selectedIds.has(p.point_id));
    if (!selected.length) {
      setError('Load gov points and select at least one.');
      return;
    }
    if (!internalFiles?.length) {
      setError('Attach internal PDF for Pass 2 (Gemini/GPT).');
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const initial: DualVerifyItem[] = selected.map((point, index) => ({
      index,
      point,
      phase: 'pending',
    }));
    setItems(initial);
    setRunning(true);
    setError('');

    try {
      await ensureInternalParseReady();
    } catch (e) {
      setRunning(false);
      setError(apiConnectionError(e));
      return;
    }

    const completed: DualVerifyItem[] = [];

    for (let i = 0; i < selected.length; i++) {
      if (controller.signal.aborted) break;

      setItems((prev) =>
        prev.map((item, idx) =>
          idx === i ? { ...item, phase: 'landing' } : item,
        ),
      );

      try {
        const landingMessage = await landingPass(
          selected[i],
          controller.signal,
        );

        setItems((prev) =>
          prev.map((item, idx) =>
            idx === i
              ? { ...item, phase: 'llm', landingMessage }
              : item,
          ),
        );

        const llmMessage = await llmPass(
          selected[i],
          landingMessage,
          controller.signal,
        );

        const agreement = compareDualVerifyResults(
          landingMessage,
          llmMessage,
        );

        const doneItem: DualVerifyItem = {
          index: i,
          point: selected[i],
          phase: 'done',
          landingMessage,
          llmMessage,
          agreement,
        };
        completed.push(doneItem);

        setItems((prev) =>
          prev.map((item, idx) => (idx === i ? doneItem : item)),
        );
        await persistDualVerifyToDb(
          completed.filter((c) => c.phase === 'done'),
          { quiet: true },
        );
      } catch (e) {
        if (e instanceof Error && e.name === 'AbortError') break;
        const errMsg = e instanceof Error ? e.message : 'Pipeline failed';
        setItems((prev) =>
          prev.map((item, idx) =>
            idx === i ? { ...item, phase: 'error', error: errMsg } : item,
          ),
        );
      }
    }

    if (abortRef.current === controller) abortRef.current = null;
    setRunning(false);

    const doneItems = completed.filter(
      (i) => i.phase === 'done' && i.landingMessage && i.llmMessage,
    );
    if (doneItems.length > 0) {
      await persistDualVerifyToDb(doneItems);
    }
  }

  function togglePoint(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function togglePointsByPrefix(prefix: string) {
    const inGroup = govPoints.filter((p) =>
      pointMatchesPrefix(p.point_id, prefix),
    );
    const allSelected =
      inGroup.length > 0 && inGroup.every((p) => selectedIds.has(p.point_id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const p of inGroup) {
        if (allSelected) next.delete(p.point_id);
        else next.add(p.point_id);
      }
      return next;
    });
  }

  function renderGovPointRow(p: GovPoint) {
    const checked = selectedIds.has(p.point_id);
    return (
      <li
        key={p.point_id}
        className={`rounded-lg border px-3 py-2 transition-colors ${
          checked
            ? 'border-indigo-400 bg-indigo-100/60'
            : 'border-slate-200 bg-slate-50/50'
        }`}
      >
        <label className="flex cursor-pointer items-start gap-2">
          <input
            type="checkbox"
            checked={checked}
            onChange={() => togglePoint(p.point_id)}
            className="mt-1 h-4 w-4 shrink-0 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
          />
          <span className="min-w-0 flex-1">
            <span className="inline-block rounded bg-slate-200 px-1.5 py-0.5 font-mono text-xs font-bold text-slate-900">
              {formatGovPointDisplayId(p)}
            </span>
            {p.title && (
              <span className="ml-1 text-slate-700">— {p.title}</span>
            )}
            <p className="mt-1 line-clamp-2 text-[11px] text-slate-600">
              {formatGovRequirementForDisplay(p)}
            </p>
          </span>
        </label>
      </li>
    );
  }

  return (
    <main className="mx-auto max-w-6xl space-y-3 p-4 pb-10 md:p-5">
      <header className="space-y-1.5">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Link href="/" className="text-violet-700 hover:underline">
            Home
          </Link>
          <span className="text-slate-400">/</span>
          <Link href="/landing-ai" className="text-violet-700 hover:underline">
            Workbench
          </Link>
          <span className="text-slate-400">/</span>
          <span className="text-slate-600">
            {profile === 'amlcft' ? 'AML/CFT gap analysis' : 'Dual verify'}
          </span>
        </div>
        <h1 className="text-2xl font-bold text-slate-900">{cfg.title}</h1>
        <p className="text-sm text-slate-600">{cfg.subtitle}</p>
        {profile === 'amlcft' && (
          <p className="text-xs text-amber-900">
            Benchmark: compare AI output to Hammad&apos;s manual workbook{' '}
            <code className="rounded bg-amber-100 px-1">manul gap analysis document.xlsx</code>{' '}
            (manual check — Excel not imported yet).
          </p>
        )}
        <div className="flex flex-wrap gap-2 text-xs">
          <Link
            href={cfg.otherHref}
            className="rounded-md border border-violet-300 bg-violet-50 px-3 py-1.5 font-medium text-violet-900 hover:bg-violet-100"
          >
            {cfg.otherLabel}
          </Link>
          <Link
            href={granularity === 'section' ? '/landing-ai' : '/landing-ai/detail'}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-slate-700 hover:bg-slate-50"
          >
            Single-pass compare (Landing AI only)
          </Link>
        </div>
      </header>

      <section className="rounded-xl border border-indigo-200 bg-indigo-50/80 p-3">
        <h2 className="text-sm font-semibold text-indigo-950">
          Verification pipeline
        </h2>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-xs text-indigo-900">
          <li>
            <strong>Prepare</strong> —{' '}
            {profile === 'amlcft'
              ? 'extract gov points from Cabinet Decision + AML Law; parse Internal AML Manual + Implementation DOCX'
              : 'gov points (extract or Supabase) + IMPTFS markdown (parse once, cached)'}
          </li>
          <li>
            <strong>Pass 1 — Landing AI</strong> (`extract-latest` · COMPARE_PROMPT_V2 · one point per call)
          </li>
          <li>
            <strong>Pass 2 — LLM</strong> (
            {profile === 'amlcft'
              ? 'default `gemini-3.5-flash` · reads internal PDF + parsed DOCX text'
              : 'default `gemini-3.5-flash` · reads internal PDF (IMPTFS) + Pass 1 output'}
            )
          </li>
          <li>
            <strong>Agreement check</strong> — compares Pass 1 vs Pass 2 (status +
            confidence); results in{' '}
            {doneExportItems.length > 0 ? (
              <a href="#agreement-results" className="font-semibold underline">
                Agreement check results
              </a>
            ) : (
              <span className="font-semibold">Agreement check results</span>
            )}{' '}
            below · auto-saved to Supabase · PDF / Excel export
          </li>
        </ol>
        <p className="mt-2 text-[11px] text-indigo-800">
          {profile === 'amlcft' ? (
            <>
              <strong>DOCX text</strong> = the Implementation Manual (.docx) parsed
              to markdown and appended to the Pass 2 prompt so Gemini/GPT can search
              Word policy text alongside the PDF.
            </>
          ) : (
            <>
              TFS dual-verify uses the internal PDF only (no DOCX). DOCX supplement
              applies to AML/CFT when an Implementation Manual .docx is attached.
            </>
          )}{' '}
          Claude is not wired yet — Pass 2 uses Gemini or Azure GPT from the dropdown.
        </p>
      </section>

      <section className="grid gap-3 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">1. Gov points</h2>
          {profile === 'amlcft' ? (
            <>
              <p className="mt-1 text-[11px] text-slate-500">
                Cabinet Decision + AML Law (from default-docs/amlcft)
              </p>
              <ul className="mt-2 space-y-1 text-xs text-slate-700">
                {govFiles.map((f) => (
                  <li key={f.name}>✓ {f.name}</li>
                ))}
                {!govFiles.length && (
                  <li className="text-slate-500">No gov files loaded yet</li>
                )}
              </ul>
            </>
          ) : (
            <>
              <input
                type="file"
                accept=".pdf,.html,.htm,.png,.jpg,.jpeg"
                onChange={(e) => setGovFile(e.target.files?.[0] ?? null)}
                className="mt-2 block w-full text-xs"
              />
              <p className="mt-1 text-[11px] text-slate-500">
                CBUAE / Cabinet Decision PDF — or skip upload and load from Supabase
              </p>
            </>
          )}
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={extractGovPoints}
              disabled={
                (profile === 'amlcft' ? !govFiles.length : !govFile) ||
                extractingGov
              }
              className="rounded-md bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
            >
              {extractingGov ? 'Extracting…' : 'Extract live (Landing AI)'}
            </button>
            {profile === 'tfs' && (
              <button
                type="button"
                onClick={loadGovFromDb}
                disabled={loadingGov}
                className="rounded-md bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
              >
                {loadingGov ? 'Loading…' : 'Load from Supabase (free)'}
              </button>
            )}
          </div>
          {skippedGovNote && (
            <p className="mt-2 text-xs text-amber-800">{skippedGovNote}</p>
          )}
          {note && <p className="mt-2 text-xs text-teal-800">{note}</p>}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">
            2. Internal policy {profile === 'amlcft' ? '(AML Manual + Implementation DOCX)' : '(parse step 1 + Pass 2)'}
          </h2>
          <input
            ref={fileRef}
            type="file"
            accept={profile === 'amlcft' ? '.pdf,.docx' : '.pdf'}
            multiple
            onChange={(e) => {
              setInternalFiles(e.target.files);
              setInternalLabel(
                e.target.files?.length
                  ? Array.from(e.target.files)
                      .map((f) => f.name)
                      .join(', ')
                  : null,
              );
            }}
            className="mt-2 block w-full text-xs"
          />
          {internalLabel && (
            <p className="mt-1 text-xs text-slate-600">{internalLabel}</p>
          )}
          <label className="mt-3 block text-xs font-medium text-slate-700">
            Pass 2 model (Gemini / GPT)
          </label>
          <select
            value={aiModel}
            onChange={(e) => setAiModel(e.target.value)}
            className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-xs"
          >
            {AI_MODELS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          {parsePrep && (
            <p className="mt-2 text-xs font-medium text-violet-800">{parsePrep}</p>
          )}
          {docxSupplementMarkdown.trim() ? (
            <p className="mt-2 rounded-md border border-teal-200 bg-teal-50 px-2 py-1.5 text-[11px] text-teal-900">
              <strong>DOCX text loaded for Pass 2:</strong>{' '}
              {Math.round(docxSupplementMarkdown.length / 1000)}k characters from
              Word manual(s) — parsed to markdown and sent with the LLM prompt as
              extra internal policy context.
            </p>
          ) : profile === 'amlcft' ? (
            <p className="mt-2 text-[11px] text-slate-500">
              Attach Implementation Manual (.docx) to enable DOCX text for Pass 2.
            </p>
          ) : null}
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">
          Saved dual verify (from DB)
        </h2>
        <p className="mt-0.5 text-xs text-slate-600">
          Each run is saved to Supabase automatically (merged by point). Reload
          previous analyses here without using Landing AI or LLM credits.
        </p>
        {dbNote && (
          <p className="mt-1.5 text-xs font-medium text-emerald-900">{dbNote}</p>
        )}
        {savedAnalyses.length === 0 ? (
          <p className="mt-2 text-xs text-slate-500">
            {savedAnalysisHint ||
              'No saved dual verify sessions yet. Run the pipeline — results save after each point.'}
          </p>
        ) : (
          <>
            {savedAnalysisHint && (
              <p className="mt-2 text-xs font-medium text-amber-800">
                {savedAnalysisHint}
              </p>
            )}
            <select
              value={selectedAnalysisId}
              onChange={(e) => setSelectedAnalysisId(e.target.value)}
              className="mt-2 w-full rounded border border-slate-300 px-2 py-1.5 text-xs"
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
          disabled={!selectedAnalysisId || loadingAnalysis}
          className="mt-2 rounded-md border border-emerald-400 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-900 hover:bg-emerald-100 disabled:opacity-50"
        >
          {loadingAnalysis ? 'Loading…' : 'Load selected analysis (free)'}
        </button>
      </section>

      {govPoints.length === 0 && (
        <section className="rounded-xl border border-amber-200 bg-amber-50/80 p-3 text-xs text-amber-950">
          <p className="font-semibold">No gov points loaded yet</p>
          <p className="mt-1">
            Click <strong>Load from Supabase (free)</strong> or{' '}
            <strong>Extract live</strong> in step 1. Then you will see numbered
            points here —{' '}
            {granularity === 'leaf'
              ? 'leaf IDs like 2.1.1, 2.1.2 under §2 → §2.1'
              : 'section IDs like 2.1, 2.2, 2.3 under §2'}.
          </p>
          {loadingGov && (
            <p className="mt-2 font-medium">Loading gov points…</p>
          )}
        </section>
      )}

      {govPoints.length > 0 && (
        <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-slate-900">
              3. Select points ({selectedIds.size}/{govPoints.length})
            </h2>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() =>
                  setSelectedIds(new Set(govPoints.map((p) => p.point_id)))
                }
                className="text-xs text-violet-700 hover:underline"
              >
                Select all
              </button>
              <button
                type="button"
                onClick={() => setSelectedIds(new Set())}
                className="text-xs text-slate-600 hover:underline"
              >
                Clear
              </button>
            </div>
          </div>
          <ul className="mt-2 max-h-64 space-y-2 overflow-y-auto text-xs">
            {govByChapter.map(({ chapter, points: chapterPoints, sections }) => {
              const chapterSelected = chapterPoints.filter((p) =>
                selectedIds.has(p.point_id),
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
                        <span className="ml-1 font-normal normal-case text-indigo-700">
                          ({chapterSelected} selected)
                        </span>
                      )}
                    </span>
                    <button
                      type="button"
                      onClick={() => togglePointsByPrefix(chapter)}
                      className="text-xs font-medium text-indigo-700 hover:underline"
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
                        selectedIds.has(p.point_id),
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
                                  <span className="ml-1 font-normal text-indigo-600">
                                    ({sectionSelected}/{sectionPoints.length})
                                  </span>
                                )}
                              </span>
                              <button
                                type="button"
                                onClick={() => togglePointsByPrefix(key)}
                                className="text-[11px] text-indigo-700 hover:underline"
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
        </section>
      )}

      {govPoints.length > 0 && (
        <section className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-3 shadow-sm">
          <h2 className="text-sm font-semibold text-indigo-950">4. Run dual verify</h2>
          <p className="mt-1 text-xs text-indigo-900">
            Pass 1 (Landing AI) → Pass 2 (LLM) → agreement check per point. Session
            auto-saves after each point.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={runDualVerify}
              disabled={running || !govPoints.length || selectedIds.size === 0}
              className="rounded-md bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {running
                ? 'Running pipeline…'
                : `Run dual verify (${selectedIds.size} selected of ${govPoints.length})`}
            </button>
            {running && (
              <button
                type="button"
                onClick={cancelPipeline}
                className="rounded-md border border-red-300 px-4 py-2 text-xs font-semibold text-red-800"
              >
                Cancel
              </button>
            )}
            {items.length > 0 && (
              <p className="text-xs text-slate-700">
                Progress: {doneCount}/{items.length} done
                {mismatchCount > 0 && (
                  <span className="ml-2 font-medium text-amber-800">
                    · {mismatchCount} need agreement review
                  </span>
                )}
                {doneExportItems.length > 0 && (
                  <a
                    href="#agreement-results"
                    className="ml-2 font-medium text-indigo-700 underline"
                  >
                    View results ↓
                  </a>
                )}
              </p>
            )}
          </div>
        </section>
      )}

      {error && (
        <p className="rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-900">
          {error}
        </p>
      )}

      {items.some((i) => i.phase === 'done' || i.phase === 'error') && (
        <section id="agreement-results" className="scroll-mt-6 space-y-6">
          {doneExportItems.length > 0 ? (
            <>
              <DualVerifyExportBar
                doneCount={doneExportItems.length}
                exportPass={exportPass}
                exporting={exporting}
                onExportPassChange={setExportPass}
                onExportPdf={exportDualVerifyPdf}
                onExportExcel={exportDualVerifyExcel}
              />

              <div className="space-y-6 rounded-xl border-2 border-violet-200 bg-white p-6 shadow-sm">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                    Agreement check results
                  </h2>
                  <p className="text-xs text-slate-500">
                    {reportTitle} · {doneCount} point
                    {doneCount === 1 ? '' : 's'} · {mismatchCount} need cross-pass
                    review · auto-saved
                  </p>
                </div>

                <section>
                  <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-violet-800">
                    Cross-pass agreement
                  </h3>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <AgreementStat label="Aligned" value={summaryStats.agreement.aligned} tone="ok" />
                    <AgreementStat
                      label="Confidence gap"
                      value={summaryStats.agreement.confidence_gap}
                      tone="warn"
                    />
                    <AgreementStat
                      label="Status mismatch"
                      value={summaryStats.agreement.status_mismatch}
                      tone="danger"
                    />
                    <AgreementStat
                      label="Both non-compliant"
                      value={summaryStats.agreement.both_non_compliant}
                      tone="warn"
                    />
                  </div>
                </section>

                <AgreementCheckTable items={doneExportItems} />

                <ColorCodeLegend results={legendResults} />

                {(exportPass === 'pass1' || exportPass === 'both') && (
                  <section>
                    <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-teal-800">
                      Pass 1 — Landing AI statistics
                    </h3>
                    <p className="mb-3 text-sm text-slate-600">
                      {pass1Report.stats.total} point
                      {pass1Report.stats.total === 1 ? '' : 's'} analyzed
                    </p>
                    <StatusTierBoxes stats={pass1Report.stats} />
                  </section>
                )}

                {(exportPass === 'pass2' || exportPass === 'both') && (
                  <section>
                    <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-indigo-800">
                      Pass 2 — LLM verify statistics
                    </h3>
                    <p className="mb-3 text-sm text-slate-600">
                      {pass2Report.stats.total} point
                      {pass2Report.stats.total === 1 ? '' : 's'} analyzed
                    </p>
                    <StatusTierBoxes stats={pass2Report.stats} />
                  </section>
                )}

                {executiveSummary && (
                  <section>
                    <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-violet-800">
                      Executive summary
                    </h3>
                    <div className="rounded-lg border border-slate-100 bg-slate-50 p-4">
                      <MarkdownSummary text={executiveSummary} />
                    </div>
                  </section>
                )}

                <section>
                  <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-amber-800">
                    Attention focus (&lt; 100% or Partial / Non-Compliant)
                  </h3>
                  <AttentionFocusCompact items={attentionResults} />
                </section>

                <DualVerifyExportBar
                  doneCount={doneExportItems.length}
                  exportPass={exportPass}
                  exporting={exporting}
                  onExportPassChange={setExportPass}
                  onExportPdf={exportDualVerifyPdf}
                  onExportExcel={exportDualVerifyExcel}
                  compact
                />
              </div>
            </>
          ) : (
            <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">
              Pipeline finished with errors — no complete Pass 1 + Pass 2 pairs to
              show agreement. Fix errors in detailed results below and re-run failed
              points.
            </p>
          )}

          <div className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900">Detailed results</h2>
            {items.map((item) => (
              <DualVerifyResultCard key={item.point.point_id} item={item} />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}

function DualVerifyExportBar({
  doneCount,
  exportPass,
  exporting,
  onExportPassChange,
  onExportPdf,
  onExportExcel,
  compact = false,
}: {
  doneCount: number;
  exportPass: DualVerifyExportPass;
  exporting: boolean;
  onExportPassChange: (pass: DualVerifyExportPass) => void;
  onExportPdf: () => void;
  onExportExcel: () => void;
  compact?: boolean;
}) {
  return (
    <div
      className={`flex flex-wrap items-end justify-between gap-3 rounded-xl border border-slate-200 bg-white shadow-sm ${
        compact ? 'p-3' : 'p-4'
      }`}
    >
      <div>
        {!compact && (
          <h2 className="text-lg font-bold text-slate-900">Download report</h2>
        )}
        <p className={`${compact ? '' : 'mt-1'} text-xs text-slate-600`}>
          {doneCount} point{doneCount === 1 ? '' : 's'} · Pass 1 / Pass 2 / both ·
          PDF or Excel
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 text-xs text-slate-600">
          <span className="font-medium">Scope</span>
          <select
            value={exportPass}
            onChange={(e) =>
              onExportPassChange(e.target.value as DualVerifyExportPass)
            }
            className="rounded-md border border-slate-300 px-2 py-1.5 text-xs"
          >
            <option value="both">Both passes (agreement)</option>
            <option value="pass1">Pass 1 only (Landing AI)</option>
            <option value="pass2">Pass 2 only (LLM verify)</option>
        </select>
        </label>
        <button
          type="button"
          onClick={onExportPdf}
          disabled={exporting}
          className="rounded-md border border-amber-400 bg-amber-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-600 disabled:opacity-40"
        >
          PDF
        </button>
        <button
          type="button"
          onClick={onExportExcel}
          disabled={exporting}
          className="rounded-md border border-emerald-500 bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-40"
        >
          Excel
        </button>
      </div>
    </div>
  );
}

function AgreementCheckTable({
  items,
}: {
  items: Array<{
    point: { point_id: string };
    agreement: DualVerifyAgreement;
  }>;
}) {
  return (
    <section>
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-violet-800">
        Per-point agreement
      </h3>
      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="min-w-full text-left text-xs">
          <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2">Point</th>
              <th className="px-3 py-2">Pass 1 status</th>
              <th className="px-3 py-2">Pass 1 conf.</th>
              <th className="px-3 py-2">Pass 2 status</th>
              <th className="px-3 py-2">Pass 2 conf.</th>
              <th className="px-3 py-2">Agreement</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((item) => (
              <tr key={item.point.point_id} className="bg-white">
                <td className="px-3 py-2 font-semibold text-slate-900">
                  {item.point.point_id}
                </td>
                <td className="px-3 py-2">{item.agreement.landingStatus}</td>
                <td className="px-3 py-2">
                  {item.agreement.landingConfidence != null
                    ? `${item.agreement.landingConfidence}%`
                    : '—'}
                </td>
                <td className="px-3 py-2">{item.agreement.llmStatus}</td>
                <td className="px-3 py-2">
                  {item.agreement.llmConfidence != null
                    ? `${item.agreement.llmConfidence}%`
                    : '—'}
                </td>
                <td className="px-3 py-2">
                  <span
                    className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-semibold ${agreementBadgeClass(item.agreement.status as AgreementStatus)}`}
                  >
                    {item.agreement.label}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function AgreementStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'ok' | 'warn' | 'danger';
}) {
  const tones = {
    ok: 'border-emerald-200 bg-emerald-50 text-emerald-900',
    warn: 'border-amber-200 bg-amber-50 text-amber-900',
    danger: 'border-red-200 bg-red-50 text-red-900',
  };
  return (
    <div className={`rounded-lg border px-3 py-3 text-center ${tones[tone]}`}>
      <p className="text-[10px] font-bold uppercase tracking-wide opacity-80">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
    </div>
  );
}

function DualVerifyResultCard({ item }: { item: DualVerifyItem }) {
  const { point, phase, agreement, landingMessage, llmMessage, error } =
    item;

  if (phase === 'error') {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50/50 p-4">
        <p className="text-sm font-bold text-red-900">{point.point_id}</p>
        <p className="mt-1 text-xs text-red-800">{error}</p>
      </div>
    );
  }

  if (phase !== 'done' || !landingMessage || !llmMessage || !agreement) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600">
        {point.point_id} —{' '}
        {phase === 'landing'
          ? 'Pass 1 (Landing AI)…'
          : phase === 'llm'
            ? 'Pass 2 (LLM verify)…'
            : phase}
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-bold text-slate-900">{point.point_id}</h3>
        <span
          className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${agreementBadgeClass(agreement.status as AgreementStatus)}`}
        >
          {agreement.label}
        </span>
      </div>
      <p className="text-xs text-slate-700">{agreement.summary}</p>
      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-teal-800">
            Pass 1 — Landing AI
          </p>
          <ReferenceComplianceCard
            block={parseReferenceComplianceBlock(landingMessage)}
          />
        </div>
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-indigo-800">
            Pass 2 — LLM verify
          </p>
          <ReferenceComplianceCard
            block={parseReferenceComplianceBlock(llmMessage)}
          />
        </div>
      </div>
    </div>
  );
}
