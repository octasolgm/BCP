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
import { parseReferenceComplianceBlock } from '../../lib/ai-lab/parse-reference-response';
import {
  filterComparableGovPoints,
  filterComparableGovLeafPoints,
  formatGovRequirementForDisplay,
  groupGovPointsByChapter,
  type GovPoint as FilterGovPoint,
} from '../../lib/landing-ai/gov-point-filter';
import {
  agreementBadgeClass,
  compareDualVerifyResults,
  type AgreementStatus,
  type DualVerifyAgreement,
} from '../../lib/landing-ai/dual-verify-merge';
import { buildDualVerifyPrompt } from '../../lib/landing-ai/dual-verify-prompt';

type CompareGranularity = 'section' | 'leaf';

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
      'Pipeline: Pass 1 Landing AI ADE compare → Pass 2 Gemini/GPT independent verification. Rolled-up gov sections.',
    otherHref: '/landing-ai/dual-verify/detail',
    otherLabel: 'Switch to leaf dual verify (2.1.1, 2.1.2…)',
    filter: filterComparableGovPoints,
  },
  leaf: {
    title: 'Dual Verify — Leaf (2.1.1, 2.1.2…)',
    subtitle:
      'Pipeline: Pass 1 Landing AI → Pass 2 Gemini/GPT double-check per sub-point. No section rollup.',
    otherHref: '/landing-ai/dual-verify',
    otherLabel: 'Switch to section dual verify (2.1, 2.2…)',
    filter: filterComparableGovLeafPoints,
  },
};

const INTERNAL_FILE_HASH =
  '6a0a0bd13c7a32ea10c43c9a8391347a7e0caceaa0b17dd6443e9ee622111717';

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

export function DualVerifyWorkbench({
  granularity,
}: {
  granularity: CompareGranularity;
}) {
  const cfg = CONFIG[granularity];
  const [govPoints, setGovPoints] = useState<GovPoint[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [internalFiles, setInternalFiles] = useState<FileList | null>(null);
  const [internalLabel, setInternalLabel] = useState<string | null>(null);
  const [aiModel, setAiModel] = useState('gemini-2.5-flash-lite');
  const [items, setItems] = useState<DualVerifyItem[]>([]);
  const [running, setRunning] = useState(false);
  const [loadingGov, setLoadingGov] = useState(false);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const abortRef = useRef<AbortController | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
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
  }, []);

  const govByChapter = useMemo(
    () => groupGovPointsByChapter(govPoints),
    [govPoints],
  );

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
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || JSON.stringify(data));
      const all = (data.points ?? []) as GovPoint[];
      const { comparable, skipped } = cfg.filter(all);
      setGovPoints(comparable);
      setSelectedIds(new Set(comparable.map((p) => p.point_id)));
      setNote(
        `Loaded ${comparable.length} points (${skipped.length} skipped) from Supabase · 0 credits`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoadingGov(false);
    }
  }

  async function landingPass(
    point: GovPoint,
    signal: AbortSignal,
  ): Promise<string> {
    const form = new FormData();
    form.append('point', JSON.stringify(point));
    form.append('internalFileName', internalLabel ?? DEFAULT_PDF_NAME);
    form.append('internalFileHash', INTERNAL_FILE_HASH);
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
    const form = new FormData();
    form.append('prompt', buildDualVerifyPrompt(point, landingMessage));
    form.append('aiModel', aiModel);
    if (internalFiles?.length) {
      Array.from(internalFiles).forEach((f, i) => {
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

        setItems((prev) =>
          prev.map((item, idx) =>
            idx === i
              ? {
                  ...item,
                  phase: 'done',
                  landingMessage,
                  llmMessage,
                  agreement,
                }
              : item,
          ),
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
  }

  function togglePoint(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <main className="mx-auto max-w-6xl space-y-6 p-4 pb-16 md:p-6">
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Link href="/" className="text-violet-700 hover:underline">
            Home
          </Link>
          <span className="text-slate-400">/</span>
          <Link href="/landing-ai" className="text-violet-700 hover:underline">
            Workbench
          </Link>
          <span className="text-slate-400">/</span>
          <span className="text-slate-600">Dual verify</span>
        </div>
        <h1 className="text-2xl font-bold text-slate-900">{cfg.title}</h1>
        <p className="text-sm text-slate-600">{cfg.subtitle}</p>
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

      <section className="rounded-xl border border-indigo-200 bg-indigo-50/80 p-4">
        <h2 className="text-sm font-semibold text-indigo-950">
          Verification pipeline
        </h2>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-xs text-indigo-900">
          <li>
            <strong>Pass 1 — Landing AI</strong> (`dpt-2-latest` parse + `extract-latest` compare via ADE)
          </li>
          <li>
            <strong>Pass 2 — Gemini / GPT</strong> independent re-read of IMPTFS PDF with first-pass context
          </li>
          <li>
            <strong>Agreement check</strong> — status match, confidence gap, mismatch flags
          </li>
        </ol>
        <p className="mt-2 text-[11px] text-indigo-800">
          Note: Claude is not wired in this repo yet — Pass 2 uses Gemini or Azure GPT from the dropdown.
        </p>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">1. Gov points</h2>
          <button
            type="button"
            onClick={loadGovFromDb}
            disabled={loadingGov}
            className="mt-2 rounded-md bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
          >
            {loadingGov ? 'Loading…' : 'Load gov points from Supabase'}
          </button>
          {note && <p className="mt-2 text-xs text-teal-800">{note}</p>}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">
            2. Internal PDF (Pass 2)
          </h2>
          <input
            ref={fileRef}
            type="file"
            accept=".pdf"
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
        </div>
      </section>

      {govPoints.length > 0 && (
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
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
          <ul className="mt-3 max-h-48 space-y-1 overflow-y-auto text-xs">
            {govByChapter.map(({ chapter, points }) => (
              <li key={chapter}>
                <p className="font-semibold text-slate-700">§{chapter}</p>
                <ul className="ml-2">
                  {points.map((p) => (
                    <li key={p.point_id} className="flex items-start gap-2 py-0.5">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(p.point_id)}
                        onChange={() => togglePoint(p.point_id)}
                        className="mt-0.5"
                      />
                      <span className="text-slate-800">
                        {formatGovRequirementForDisplay(p)}
                      </span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={runDualVerify}
            disabled={running || !govPoints.length}
            className="rounded-md bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {running
              ? 'Running pipeline…'
              : `Run dual verify (${selectedIds.size} points)`}
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
        </div>
        {items.length > 0 && (
          <p className="mt-2 text-xs text-slate-600">
            Done: {doneCount}/{items.length}
            {mismatchCount > 0 && (
              <span className="ml-2 text-amber-800">
                · {mismatchCount} need review
              </span>
            )}
          </p>
        )}
      </section>

      {error && (
        <p className="rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-900">
          {error}
        </p>
      )}

      {items.some((i) => i.phase === 'done' || i.phase === 'error') && (
        <section className="space-y-6">
          <h2 className="text-lg font-bold text-slate-900">Results</h2>
          {items.map((item) => (
            <DualVerifyResultCard key={item.point.point_id} item={item} />
          ))}
        </section>
      )}
    </main>
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
