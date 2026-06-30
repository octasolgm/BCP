'use client';

import Link from 'next/link';
import { useMemo, useRef, useState } from 'react';
import {
  AI_MODELS,
  API_BASE,
  POINT_EXTRACTION_AI_PROMPT,
} from '../../lib/ai-lab/constants';
import {
  countRawMarkers,
  extractRegulationPoints,
  pointsToBatchInput,
  pointsToPlainText,
  type ExtractedRegulationPoint,
} from '../../lib/ai-lab/extract-regulation-points';
import { CopyButton } from '../../lib/ai-lab/formatting';

type ApiResponse = Record<string, unknown>;
type ExtractMode = 'rules' | 'ai';

function depthLabel(depth: number): string {
  if (depth === 1) return 'Section';
  if (depth === 2) return 'Sub-section';
  return 'Sub-point';
}

function parseAiExtractionOutput(message: string): ExtractedRegulationPoint[] {
  const fromRules = extractRegulationPoints(message);
  if (fromRules.length > 0) return fromRules;

  const blocks = message
    .split(/\n---\n/)
    .map((b) => b.trim())
    .filter(Boolean);

  return blocks.map((full, index) => {
    const match = full.match(/^(\d+(?:\.\d+)*)\.\s*([\s\S]*)$/);
    if (match) {
      return {
        number: match[1],
        text: match[2].trim(),
        full: full.trim(),
        depth: match[1].split('.').length,
      };
    }
    return {
      number: String(index + 1),
      text: full,
      full,
      depth: 1,
    };
  });
}

export default function AiLabExtractPage() {
  const [files, setFiles] = useState<FileList | null>(null);
  const [sectionPrefix, setSectionPrefix] = useState('');
  const [mode, setMode] = useState<ExtractMode>('rules');
  const [aiModel, setAiModel] = useState('gemini-3.5-flash');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [rawText, setRawText] = useState('');
  const [points, setPoints] = useState<ExtractedRegulationPoint[]>([]);
  const [usedAi, setUsedAi] = useState(false);
  const [pageCount, setPageCount] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const filteredPoints = useMemo(() => {
    if (!sectionPrefix.trim()) return points;
    const p = sectionPrefix.trim().replace(/\.$/, '');
    return points.filter(
      (pt) => pt.number === p || pt.number.startsWith(`${p}.`),
    );
  }, [points, sectionPrefix]);

  const plainOutput = useMemo(
    () => pointsToPlainText(filteredPoints),
    [filteredPoints],
  );

  function cancelRun() {
    abortRef.current?.abort();
    abortRef.current = null;
    setLoading(false);
  }

  async function runExtract() {
    if (!files?.length) {
      setError('Select a PDF file');
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError('');
    setPoints([]);
    setRawText('');
    setUsedAi(false);
    setPageCount(null);

    try {
      if (mode === 'rules') {
        const form = new FormData();
        Array.from(files).forEach((f, i) => {
          form.append(i === 0 ? 'file' : 'files', f);
        });

        const res = await fetch(`${API_BASE}/ai/extractpdf`, {
          method: 'POST',
          body: form,
          signal: controller.signal,
        });
        const data = (await res.json()) as ApiResponse;

        if (!res.ok) {
          setError(JSON.stringify(data, null, 2));
          return;
        }

        const combined =
          typeof data.combinedText === 'string' ? data.combinedText : '';
        const pages = data.files as { pageCount?: number }[] | undefined;
        setPageCount(
          pages?.reduce((sum, f) => sum + (f.pageCount ?? 0), 0) ?? null,
        );
        setRawText(combined);

        if (!combined.trim()) {
          setError(
            'No readable text in PDF. The file may be scanned — try AI-assisted extraction.',
          );
          return;
        }

        const extracted = extractRegulationPoints(combined, {
          sectionPrefix: sectionPrefix.trim() || undefined,
        });

        if (extracted.length === 0) {
          const totalMarkers = countRawMarkers(combined);
          if (sectionPrefix.trim() && totalMarkers > 0) {
            setError(
              `Found ${totalMarkers} numbered marker(s) in the PDF, but none under section "${sectionPrefix.trim()}". Clear the section filter or try a different prefix (e.g. 2.8 or 7).`,
            );
          } else if (totalMarkers === 0) {
            setError(
              'No numbered points found. This PDF may use a different format (no 2.8.6 / 3.2.1 style numbering), or text may not be readable. Try AI-assisted extraction.',
            );
          } else {
            setError(
              `Found ${totalMarkers} marker(s) but all were filtered as noise. Try AI-assisted extraction.`,
            );
          }
          return;
        }

        setPoints(extracted);
      } else {
        const form = new FormData();
        Array.from(files).forEach((f, i) => {
          form.append(i === 0 ? 'file' : 'files', f);
        });
        form.append('prompt', POINT_EXTRACTION_AI_PROMPT);
        form.append('aiModel', aiModel);

        const res = await fetch(`${API_BASE}/ai/bcpanalyze`, {
          method: 'POST',
          body: form,
          signal: controller.signal,
        });
        const data = (await res.json()) as ApiResponse;

        if (!res.ok) {
          setError(
            typeof data.message === 'string'
              ? data.message
              : JSON.stringify(data, null, 2),
          );
          return;
        }

        const message =
          typeof data.message === 'string'
            ? data.message
            : JSON.stringify(data.message, null, 2);

        setRawText(message);
        setUsedAi(true);

        let extracted = parseAiExtractionOutput(message);
        if (sectionPrefix.trim()) {
          const p = sectionPrefix.trim().replace(/\.$/, '');
          extracted = extracted.filter(
            (pt) => pt.number === p || pt.number.startsWith(`${p}.`),
          );
        }

        if (extracted.length === 0) {
          setError('AI returned no extractable points. Try rule-based mode.');
          return;
        }

        setPoints(extracted);
      }
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') return;
      setError(e instanceof Error ? e.message : 'Extraction failed');
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
      }
      setLoading(false);
    }
  }

  function sendToBatch() {
    const text = pointsToBatchInput(filteredPoints);
    sessionStorage.setItem('bcp-batch-points', text);
    window.location.href = '/ai-lab-batch';
  }

  return (
    <main className="mx-auto max-w-7xl p-6">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">
            Extract Requirement Points
          </h1>
          <p className="mt-1 max-w-2xl text-slate-600">
            Upload a regulatory PDF and extract numbered points (3, 3.1, 3.2.1,
            …) with original wording preserved — like a professional legal
            extractor.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/ai-lab-batch"
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50"
          >
            Batch analyze
          </Link>
          <Link
            href="/ai-lab"
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50"
          >
            AI Lab
          </Link>
        </div>
      </div>

      <div className="mb-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex flex-wrap gap-2">
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
            Rule-based: pdf-parse + numbering (no AI)
          </span>
          <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-medium text-violet-800">
            AI-assisted: Gemini reads PDF (uses AI)
          </span>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Regulatory PDF
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,application/pdf"
              multiple
              disabled={loading}
              onChange={(e) => setFiles(e.target.files)}
              className="w-full text-sm"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Section filter (optional)
            </label>
            <input
              type="text"
              value={sectionPrefix}
              onChange={(e) => setSectionPrefix(e.target.value)}
              placeholder="e.g. 3 — only 3, 3.1, 3.2.1…"
              disabled={loading}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Extraction mode
            </label>
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value as ExtractMode)}
              disabled={loading}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="rules">
                Rule-based (recommended) — no AI, verbatim split
              </option>
              <option value="ai">
                AI-assisted — Gemini extracts points from PDF
              </option>
            </select>
          </div>

          {mode === 'ai' && (
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                AI model
              </label>
              <select
                value={aiModel}
                onChange={(e) => setAiModel(e.target.value)}
                disabled={loading}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                {AI_MODELS.filter((m) => m.startsWith('gemini')).map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={runExtract}
            disabled={loading || !files?.length}
            className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {loading ? 'Extracting…' : 'Extract points'}
          </button>
          {loading && (
            <button
              type="button"
              onClick={cancelRun}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50"
            >
              Cancel
            </button>
          )}
        </div>

        {error && (
          <pre className="mt-4 overflow-auto rounded-lg bg-red-50 p-3 text-xs text-red-800">
            {error}
          </pre>
        )}
      </div>

      {filteredPoints.length > 0 && (
        <>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
            <div className="text-sm text-emerald-900">
              <strong>{filteredPoints.length}</strong> point
              {filteredPoints.length === 1 ? '' : 's'} extracted
              {pageCount !== null && !usedAi && (
                <span className="text-emerald-700">
                  {' '}
                  · {pageCount} PDF page{pageCount === 1 ? '' : 's'}
                </span>
              )}
              {usedAi && (
                <span className="text-violet-700"> · AI-assisted (Gemini)</span>
              )}
              {!usedAi && (
                <span className="text-slate-600">
                  {' '}
                  · Rule-based (no AI)
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <CopyButton message={plainOutput} label="Copy all points" />
              <button
                type="button"
                onClick={sendToBatch}
                className="rounded-lg border border-indigo-300 bg-white px-3 py-1.5 text-sm font-medium text-indigo-700 hover:bg-indigo-50"
              >
                Send to batch analyze
              </button>
            </div>
          </div>

          <section className="space-y-4">
            {filteredPoints.map((point) => (
              <article
                key={`${point.number}-${point.full.slice(0, 40)}`}
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="rounded bg-indigo-100 px-2 py-0.5 font-mono text-sm font-bold text-indigo-900">
                    {point.number}
                  </span>
                  <span className="text-xs uppercase tracking-wide text-slate-500">
                    {depthLabel(point.depth)}
                  </span>
                  <CopyButton message={point.full} label="Copy" />
                </div>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-800">
                  {point.full}
                </p>
              </article>
            ))}
          </section>

          {rawText && (
            <details className="mt-8 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <summary className="cursor-pointer text-sm font-medium text-slate-600">
                Raw extracted text (debug)
              </summary>
              <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap text-xs text-slate-700">
                {rawText.slice(0, 20000)}
                {rawText.length > 20000 ? '\n…[truncated]' : ''}
              </pre>
            </details>
          )}
        </>
      )}

      <div className="mt-8 rounded-xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-700">
        <h2 className="mb-2 font-semibold text-slate-900">Is AI used?</h2>
        <ul className="list-inside list-disc space-y-1">
          <li>
            <strong>Rule-based (default):</strong> No AI. PDF text is extracted
            with pdf-parse, then points are split by numbering (3.1, 3.2.1, …)
            without changing any words.
          </li>
          <li>
            <strong>AI-assisted:</strong> Yes — Gemini reads the PDF and
            extracts points. Use for scanned PDFs or unusual layouts. Wording
            should stay verbatim per prompt, but rule-based is safer for exact
            text.
          </li>
        </ul>
      </div>
    </main>
  );
}
