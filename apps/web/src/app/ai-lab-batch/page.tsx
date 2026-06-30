'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AI_MODELS,
  API_BASE,
  DEFAULT_PDF_NAME,
  DEFAULT_PROMPT,
} from '../../lib/ai-lab/constants';
import { ExportResultsButtons } from '../../lib/ai-lab/export-buttons';
import {
  CopyButton,
  FormattedMessage,
  messageToFormattedClipboard,
} from '../../lib/ai-lab/formatting';
import { parseComplianceReport } from '../../lib/ai-lab/parse-compliance-results';
import { parseRequirementPoints } from '../../lib/ai-lab/parse-points';
import { assignFileInput, loadDefaultPdfFile } from '../../lib/ai-lab/pdf';

type BatchStatus = 'pending' | 'running' | 'done' | 'error' | 'cancelled';

type BatchItem = {
  index: number;
  point: string;
  status: BatchStatus;
  message?: string;
  error?: string;
};

type ApiResponse = Record<string, unknown>;

function extractMessage(data: ApiResponse): string {
  const msg = data.message;
  if (typeof msg === 'string') return msg;
  if (msg != null) return JSON.stringify(msg, null, 2);
  return JSON.stringify(data, null, 2);
}

function buildCombinedMessages(items: BatchItem[]): string {
  return items
    .filter((item) => item.status === 'done' && item.message)
    .map((item) => item.message as string)
    .join('\n\n---\n\n');
}

export default function AiLabBatchPage() {
  const [pointsText, setPointsText] = useState('');
  const [aiModel, setAiModel] = useState('gemini-3.5-flash');
  const [files, setFiles] = useState<FileList | null>(null);
  const [defaultFileLabel, setDefaultFileLabel] = useState<string | null>(null);
  const [defaultFileError, setDefaultFileError] = useState('');
  const [running, setRunning] = useState(false);
  const [items, setItems] = useState<BatchItem[]>([]);
  const [parsedCount, setParsedCount] = useState(0);
  const [error, setError] = useState('');
  const [cancelled, setCancelled] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pointsRef = useRef<HTMLTextAreaElement>(null);

  const combinedMessage = buildCombinedMessages(items);
  const parsedCombined = useMemo(
    () => parseComplianceReport(combinedMessage),
    [combinedMessage],
  );
  const doneCount = items.filter((i) => i.status === 'done').length;
  const errorCount = items.filter((i) => i.status === 'error').length;
  const totalCount = items.length;
  const progressPct =
    totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

  useEffect(() => {
    const imported = sessionStorage.getItem('bcp-batch-points');
    if (imported) {
      setPointsText(imported);
      sessionStorage.removeItem('bcp-batch-points');
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function attachDefaultPdf() {
      try {
        const file = await loadDefaultPdfFile();
        if (!file || cancelled) return;
        const dt = new DataTransfer();
        dt.items.add(file);
        setFiles(dt.files);
        setDefaultFileLabel(DEFAULT_PDF_NAME);
        requestAnimationFrame(() => {
          if (fileInputRef.current) {
            assignFileInput(fileInputRef.current, dt.files);
          }
        });
      } catch {
        if (!cancelled) {
          setDefaultFileError('Could not load default PDF');
        }
      }
    }

    attachDefaultPdf();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setParsedCount(parseRequirementPoints(pointsText).length);
  }, [pointsText]);

  function cancelBatch() {
    abortRef.current?.abort();
    abortRef.current = null;
    setRunning(false);
    setCancelled(true);
    setItems((prev) =>
      prev.map((item) =>
        item.status === 'running' || item.status === 'pending'
          ? { ...item, status: 'cancelled' as const }
          : item,
      ),
    );
  }

  async function analyzePoint(
    point: string,
    signal: AbortSignal,
  ): Promise<string> {
    const form = new FormData();
    form.append('prompt', DEFAULT_PROMPT + point);
    form.append('aiModel', aiModel);
    if (files) {
      Array.from(files).forEach((f, i) => {
        form.append(i === 0 ? 'file' : 'files', f);
      });
    }

    const res = await fetch(`${API_BASE}/ai/bcpanalyze`, {
      method: 'POST',
      body: form,
      signal,
    });
    const data = (await res.json()) as ApiResponse;
    if (!res.ok) {
      throw new Error(
        typeof data.message === 'string'
          ? data.message
          : JSON.stringify(data, null, 2),
      );
    }
    return extractMessage(data);
  }

  async function runBatch() {
    const points = parseRequirementPoints(pointsText);
    if (!points.length) {
      setError('Paste at least one requirement point');
      return;
    }
    if (!files?.length) {
      setError('Default PDF not attached — wait or pick a file');
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const initial: BatchItem[] = points.map((point, index) => ({
      index,
      point,
      status: 'pending',
    }));

    setItems(initial);
    setRunning(true);
    setError('');
    setCancelled(false);

    for (let i = 0; i < points.length; i++) {
      if (controller.signal.aborted) break;

      setItems((prev) =>
        prev.map((item, idx) =>
          idx === i ? { ...item, status: 'running' } : item,
        ),
      );

      try {
        const message = await analyzePoint(points[i], controller.signal);
        setItems((prev) =>
          prev.map((item, idx) =>
            idx === i ? { ...item, status: 'done', message } : item,
          ),
        );
      } catch (e) {
        if (e instanceof Error && e.name === 'AbortError') {
          break;
        }
        const errMsg = e instanceof Error ? e.message : 'Request failed';
        setItems((prev) =>
          prev.map((item, idx) =>
            idx === i ? { ...item, status: 'error', error: errMsg } : item,
          ),
        );
      }
    }

    if (abortRef.current === controller) {
      abortRef.current = null;
    }
    setRunning(false);
    pointsRef.current?.focus();
  }

  const { plain: combinedPlain } = messageToFormattedClipboard(combinedMessage);

  return (
    <main className="mx-auto max-w-7xl p-6">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">AI Lab — Batch</h1>
          <p className="mt-1 text-slate-600">
            Paste all requirement points — each is analyzed in sequence. Combined
            formatted results appear at the end.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/ai-lab"
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Single point mode
          </Link>
          <Link
            href="/ai-lab-extract"
            className="rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-900 hover:bg-emerald-100"
          >
            Extract points
          </Link>
          <Link
            href="/ai-lab-report"
            className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-900 hover:bg-amber-100"
          >
            Compliance Report
          </Link>
          <a
            href={`${API_BASE}/ai/swagger`}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-blue-600 hover:bg-slate-50"
          >
            API Swagger
          </a>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              PDF file(s)
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,application/pdf"
              multiple
              onChange={(e) => {
                setFiles(e.target.files);
                setDefaultFileLabel(
                  e.target.files?.length === 1
                    ? e.target.files[0].name
                    : e.target.files?.length
                      ? `${e.target.files.length} files`
                      : null,
                );
                setDefaultFileError('');
              }}
              className="block w-full text-sm"
            />
            {defaultFileLabel && (
              <p className="mt-1 text-xs font-medium text-emerald-700">
                Attached: {defaultFileLabel}
              </p>
            )}
            {defaultFileError && (
              <p className="mt-1 text-xs text-amber-700">{defaultFileError}</p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              AI model
            </label>
            <select
              value={aiModel}
              onChange={(e) => setAiModel(e.target.value)}
              disabled={running}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 disabled:opacity-50"
            >
              {AI_MODELS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="text-sm font-medium text-slate-700">
                All requirement points
              </label>
              <span className="text-xs text-slate-500">
                {parsedCount} point{parsedCount === 1 ? '' : 's'} detected
              </span>
            </div>
            <textarea
              ref={pointsRef}
              value={pointsText}
              onChange={(e) => setPointsText(e.target.value)}
              disabled={running}
              rows={18}
              placeholder={`Paste all points here — one per line, or blank line between multi-line points.\n\nExample:\n2.0.1 Sanctions Compliance Program (SCP)\nLFIs should take appropriate steps...\n\n2.0.2 Risk Assessment\nThe institution shall...`}
              className="min-h-[320px] w-full resize-y rounded-lg border border-slate-300 px-3 py-3 font-mono text-sm leading-relaxed disabled:opacity-50"
            />
            <p className="mt-1 text-xs text-slate-500">
              Smart split: blank lines, numbered lines (2.0.1 …), or one line per
              point. Same default prompt + PDF as single AI Lab.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={runBatch}
              disabled={running || parsedCount === 0}
              className="rounded-lg bg-violet-600 px-6 py-2 font-medium text-white hover:bg-violet-700 disabled:opacity-50"
            >
              {running
                ? `Running ${doneCount + errorCount + 1} / ${totalCount || parsedCount}…`
                : `Run batch (${parsedCount} points)`}
            </button>
            {running && (
              <button
                type="button"
                onClick={cancelBatch}
                className="rounded-lg border border-red-300 bg-red-50 px-6 py-2 font-medium text-red-700 hover:bg-red-100"
              >
                Cancel
              </button>
            )}
          </div>

          {running && totalCount > 0 && (
            <div>
              <div className="mb-1 flex justify-between text-xs text-slate-600">
                <span>Progress</span>
                <span>
                  {doneCount} done · {errorCount} failed · {totalCount} total
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full bg-violet-600 transition-all duration-300"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>
          )}
        </div>

        <div className="space-y-4">
          {error && (
            <pre className="overflow-auto rounded-lg bg-red-50 p-4 text-sm text-red-800">
              {error}
            </pre>
          )}

          {cancelled && !running && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Batch cancelled. Completed results are kept below.
            </p>
          )}

          {items.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
                Run status
              </h2>
              <ul className="max-h-48 space-y-2 overflow-auto text-sm">
                {items.map((item) => (
                  <li
                    key={item.index}
                    className="flex items-start gap-2 border-b border-slate-100 pb-2 last:border-0"
                  >
                    <span
                      className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-xs font-medium ${
                        item.status === 'done'
                          ? 'bg-emerald-100 text-emerald-800'
                          : item.status === 'running'
                            ? 'bg-violet-100 text-violet-800'
                            : item.status === 'error'
                              ? 'bg-red-100 text-red-800'
                              : item.status === 'cancelled'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {item.status}
                    </span>
                    <span className="line-clamp-2 text-slate-700">
                      {item.point.split('\n')[0]}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {combinedPlain && (
        <div className="mt-8">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Combined formatted results ({doneCount})
            </h2>
            <div className="flex flex-wrap items-center gap-2">
              <CopyButton
                message={combinedMessage}
                label="Copy all formatted"
              />
              {parsedCombined.length > 0 && (
                <ExportResultsButtons results={parsedCombined} />
              )}
            </div>
          </div>
          <div className="max-h-[40rem] overflow-auto rounded-xl border border-slate-200 bg-slate-50 p-4">
            <FormattedMessage message={combinedMessage} />
          </div>
        </div>
      )}

      {!running && items.some((i) => i.status === 'error') && (
        <div className="mt-6">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Errors
          </h2>
          <div className="space-y-2">
            {items
              .filter((i) => i.status === 'error')
              .map((item) => (
                <pre
                  key={item.index}
                  className="overflow-auto rounded-lg bg-red-50 p-3 text-xs text-red-800"
                >
                  Point {item.index + 1}: {item.point.split('\n')[0]}
                  {'\n'}
                  {item.error}
                </pre>
              ))}
          </div>
        </div>
      )}
    </main>
  );
}
