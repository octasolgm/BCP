'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AI_MODELS,
  API_BASE,
  BATCH_MESSAGE_SEP,
  DEFAULT_PDF_NAME,
  REFERENCE_MAP_PROMPT,
} from '../../lib/ai-lab/constants';
import { parseRequirementPoints } from '../../lib/ai-lab/parse-points';
import { assignFileInput, loadDefaultPdfFile } from '../../lib/ai-lab/pdf';
import {
  ReferenceCopyButton,
  ReferenceFormattedMessage,
} from '../../lib/ai-lab/reference-compliance-view';
import { DownloadMapperPdfButton } from '../../lib/ai-lab/reference-mapper-export';

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
    .join(`\n\n${BATCH_MESSAGE_SEP}\n\n`);
}

export default function AiLabReferenceBatchPage() {
  const [pointsText, setPointsText] = useState('');
  const [aiModel, setAiModel] = useState('gemini-3.5-flash');
  const [files, setFiles] = useState<FileList | null>(null);
  const [fileLabel, setFileLabel] = useState<string | null>(null);
  const [fileError, setFileError] = useState('');
  const [running, setRunning] = useState(false);
  const [items, setItems] = useState<BatchItem[]>([]);
  const [parsedCount, setParsedCount] = useState(0);
  const [error, setError] = useState('');
  const [cancelled, setCancelled] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pointsRef = useRef<HTMLTextAreaElement>(null);

  const combinedMessage = buildCombinedMessages(items);
  const doneCount = items.filter((i) => i.status === 'done').length;
  const errorCount = items.filter((i) => i.status === 'error').length;
  const totalCount = items.length;
  const progressPct =
    totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

  const attachedNames = useMemo(
    () => (files ? Array.from(files).map((f) => f.name).join(', ') : ''),
    [files],
  );

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
        setFileLabel(DEFAULT_PDF_NAME);
        requestAnimationFrame(() => {
          if (fileInputRef.current) {
            assignFileInput(fileInputRef.current, dt.files);
          }
        });
      } catch {
        if (!cancelled) setFileError('Could not load default PDF');
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
    form.append('prompt', REFERENCE_MAP_PROMPT + point);
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
      setError('Attach reference PDF(s) first');
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
        const msg = await analyzePoint(points[i], controller.signal);
        setItems((prev) =>
          prev.map((item, idx) =>
            idx === i ? { ...item, status: 'done', message: msg } : item,
          ),
        );
      } catch (e) {
        if (e instanceof Error && e.name === 'AbortError') break;
        const errMsg = e instanceof Error ? e.message : 'Request failed';
        setItems((prev) =>
          prev.map((item, idx) =>
            idx === i ? { ...item, status: 'error', error: errMsg } : item,
          ),
        );
      }
    }

    if (abortRef.current === controller) abortRef.current = null;
    setRunning(false);
    pointsRef.current?.focus();
  }

  const referenceFileNames = useMemo(
    () =>
      fileLabel
        ? fileLabel.split(',').map((s) => s.trim()).filter(Boolean)
        : attachedNames
          ? attachedNames.split(',').map((s) => s.trim()).filter(Boolean)
          : [],
    [fileLabel, attachedNames],
  );

  const doneItems = items.filter((i) => i.status === 'done' && i.message);

  return (
    <main className="mx-auto max-w-7xl p-6">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">
            Reference Mapper — Batch
          </h1>
          <p className="mt-1 text-slate-600">
            Map many requirement points to attached reference PDFs. Each result
            highlights page, section, quote, and fulfilled clauses.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/ai-lab-reference"
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50"
          >
            Single point
          </Link>
          <Link
            href="/ai-lab-extract"
            className="rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm text-emerald-900"
          >
            Extract points
          </Link>
        </div>
      </div>

      <div className="mb-4 rounded-lg border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-900">
        <strong>AI required</strong> — Gemini maps each point to your PDF.
        <strong> Mapper PDF</strong> keeps the full original document and adds
        point highlights on each cited section (batch export maps all points in
        one download).
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Reference PDF file(s)
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,application/pdf"
              multiple
              disabled={running}
              onChange={(e) => {
                setFiles(e.target.files);
                setFileLabel(
                  e.target.files?.length
                    ? Array.from(e.target.files)
                        .map((f) => f.name)
                        .join(', ')
                    : null,
                );
                setFileError('');
              }}
              className="block w-full text-sm"
            />
            {fileLabel && (
              <p className="mt-1 text-xs font-medium text-emerald-700">
                Attached: {fileLabel}
              </p>
            )}
            {fileError && (
              <p className="mt-1 text-xs text-amber-700">{fileError}</p>
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
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              {AI_MODELS.filter((m) => m.startsWith('gemini')).map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="mb-1 flex justify-between">
              <label className="text-sm font-medium text-slate-700">
                Requirement points
              </label>
              <span className="text-xs text-slate-500">
                {parsedCount} detected
              </span>
            </div>
            <textarea
              ref={pointsRef}
              value={pointsText}
              onChange={(e) => setPointsText(e.target.value)}
              disabled={running}
              rows={16}
              placeholder="2.8.6 Statutory Retention Period&#10;The statutory retention period for all records is at least five (5) years...&#10;&#10;3.2.1. LFIs should rely on the official website..."
              className="min-h-[280px] w-full resize-y rounded-lg border border-slate-300 px-3 py-3 font-mono text-sm leading-relaxed disabled:opacity-50"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={runBatch}
              disabled={running || parsedCount === 0}
              className="rounded-lg bg-indigo-600 px-6 py-2 font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {running
                ? `Mapping ${doneCount + errorCount + 1} / ${totalCount || parsedCount}…`
                : `Map batch (${parsedCount} points)`}
            </button>
            {running && (
              <button
                type="button"
                onClick={cancelBatch}
                className="rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-sm text-red-700"
              >
                Cancel
              </button>
            )}
          </div>

          {running && totalCount > 0 && (
            <div className="h-2 overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full bg-indigo-600 transition-all"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          )}

          {error && (
            <pre className="overflow-auto rounded-lg bg-red-50 p-3 text-xs text-red-800">
              {error}
            </pre>
          )}
        </div>

        <div className="space-y-4">
          {items.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="mb-2 text-sm font-semibold uppercase text-slate-500">
                Run status
              </h2>
              <ul className="max-h-48 space-y-1 overflow-auto text-sm">
                {items.map((item) => (
                  <li
                    key={item.index}
                    className="flex flex-wrap items-center gap-2 border-b border-slate-50 pb-1 last:border-0"
                  >
                    <span
                      className={`shrink-0 rounded px-1.5 text-xs font-medium ${
                        item.status === 'done'
                          ? 'bg-emerald-100 text-emerald-800'
                          : item.status === 'error'
                            ? 'bg-red-100 text-red-800'
                            : item.status === 'running'
                              ? 'bg-violet-100 text-violet-800'
                              : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {item.status}
                    </span>
                    <span className="min-w-0 flex-1 line-clamp-1 text-slate-700">
                      {item.point.split('\n')[0]}
                    </span>
                    {item.status === 'done' && item.message && (
                      <DownloadMapperPdfButton
                        message={item.message}
                        referenceFileNames={referenceFileNames}
                        sourceFiles={files}
                        label="PDF"
                      />
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {doneCount > 0 && (
        <div className="mt-8">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3">
            <p className="text-sm font-medium text-indigo-900">
              Batch mapper — {doneCount} point{doneCount === 1 ? '' : 's'} ·
              download full annotated reference PDF(s)
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <ReferenceCopyButton
                message={combinedMessage}
                label="Copy all"
              />
              <DownloadMapperPdfButton
                message={combinedMessage}
                referenceFileNames={referenceFileNames}
                sourceFiles={files}
                label="Download annotated PDF (all)"
              />
            </div>
          </div>

          <div className="space-y-8">
            {doneItems.map((item) => (
              <section
                key={item.index}
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Point {item.index + 1}
                    </p>
                    <p className="line-clamp-2 text-sm font-medium text-slate-800">
                      {item.point.split('\n')[0]}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <ReferenceCopyButton
                      message={item.message}
                      label="Copy"
                    />
                    <DownloadMapperPdfButton
                      message={item.message!}
                      referenceFileNames={referenceFileNames}
                      sourceFiles={files}
                      label="Annotated PDF"
                    />
                  </div>
                </div>
                <ReferenceFormattedMessage message={item.message} />
              </section>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
