'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import {
  AI_MODELS,
  API_BASE,
  DEFAULT_PDF_NAME,
  REFERENCE_MAP_PROMPT,
} from '../../lib/ai-lab/constants';
import {
  ReferenceCopyButton,
  ReferenceFormattedMessage,
} from '../../lib/ai-lab/reference-compliance-view';
import { DownloadMapperPdfButton } from '../../lib/ai-lab/reference-mapper-export';
import { assignFileInput, loadDefaultPdfFile } from '../../lib/ai-lab/pdf';

type ApiResponse = Record<string, unknown>;

export default function AiLabReferencePage() {
  const [prompt, setPrompt] = useState(REFERENCE_MAP_PROMPT);
  const [aiModel, setAiModel] = useState('gemini-3.5-flash');
  const [files, setFiles] = useState<FileList | null>(null);
  const [fileLabel, setFileLabel] = useState<string | null>(null);
  const [fileError, setFileError] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [cancelled, setCancelled] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const promptRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const el = promptRef.current;
    if (!el) return;
    el.focus();
    const end = el.value.length;
    el.setSelectionRange(end, end);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadDefaultPdf() {
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

    loadDefaultPdf();
    return () => {
      cancelled = true;
    };
  }, []);

  function cancelRun() {
    abortRef.current?.abort();
    abortRef.current = null;
    setLoading(false);
    setCancelled(true);
  }

  async function runAnalyze() {
    if (!prompt.trim()) {
      setError('Prompt is required');
      return;
    }
    if (!files?.length) {
      setError('Attach at least one reference PDF');
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError('');
    setCancelled(false);
    setMessage(null);

    try {
      const form = new FormData();
      form.append('prompt', prompt);
      form.append('aiModel', aiModel);
      Array.from(files).forEach((f, i) => {
        form.append(i === 0 ? 'file' : 'files', f);
      });

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

      const msg = data.message;
      setMessage(typeof msg === 'string' ? msg : JSON.stringify(msg, null, 2));
      setPrompt(REFERENCE_MAP_PROMPT);
      requestAnimationFrame(() => {
        const el = promptRef.current;
        if (el) {
          const end = el.value.length;
          el.focus();
          el.setSelectionRange(end, end);
        }
      });
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') {
        setCancelled(true);
      } else {
        setError(e instanceof Error ? e.message : 'Request failed');
      }
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      setLoading(false);
    }
  }

  const attachedNames = files
    ? Array.from(files)
        .map((f) => f.name)
        .join(', ')
    : '';

  return (
    <main className="mx-auto max-w-7xl p-6">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">
            Reference Mapper
          </h1>
          <p className="mt-1 max-w-2xl text-slate-600">
            Attach your internal policy PDF(s), paste a requirement point, and
            get highlighted evidence — page, section, quote, and which clauses
            are fulfilled.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/ai-lab-reference-batch"
            className="rounded-lg border border-indigo-300 bg-indigo-50 px-4 py-2 text-sm font-medium text-indigo-900 hover:bg-indigo-100"
          >
            Batch mode
          </Link>
          <Link
            href="/ai-lab"
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50"
          >
            AI Lab
          </Link>
        </div>
      </div>

      <div className="mb-4 rounded-lg border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-900">
        <strong>AI (Gemini)</strong> reads attached PDFs and maps each requirement to
        page/section citations. <strong>Mapper PDF</strong> = full original copy with
        status labels on mapped pages only.
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Reference PDF file(s) — internal policy documents
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,application/pdf"
              multiple
              disabled={loading}
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
              disabled={loading}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:opacity-50"
            >
              {AI_MODELS.filter((m) => m.startsWith('gemini')).map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Prompt — requirement point at the end
            </label>
            <textarea
              ref={promptRef}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              disabled={loading}
              rows={14}
              className="min-h-[260px] w-full resize-y rounded-lg border border-slate-300 px-3 py-3 font-mono text-xs leading-relaxed disabled:opacity-50"
            />
            <p className="mt-1 text-xs text-slate-500">
              Type your point after &quot;REQUIREMENT POINT TO CHECK:&quot; —
              e.g. 2.8.6 Statutory Retention Period + full text.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={runAnalyze}
              disabled={loading}
              className="rounded-lg bg-indigo-600 px-6 py-2 font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {loading ? 'Mapping…' : 'Map to reference PDF'}
            </button>
            {loading && (
              <button
                type="button"
                onClick={cancelRun}
                className="rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-sm text-red-700"
              >
                Cancel
              </button>
            )}
          </div>

          {error && (
            <pre className="overflow-auto rounded-lg bg-red-50 p-3 text-xs text-red-800">
              {error}
            </pre>
          )}
          {cancelled && !loading && (
            <p className="text-sm text-amber-800">Request cancelled.</p>
          )}
        </div>

        <div>
          {message ? (
            <>
              <div className="mb-2 flex flex-wrap items-center justify-end gap-2">
                <h2 className="mr-auto text-sm font-semibold uppercase tracking-wide text-slate-500">
                  Reference mapping result
                </h2>
                <ReferenceCopyButton message={message} />
                <DownloadMapperPdfButton
                  message={message}
                  referenceFileNames={
                    attachedNames
                      ? attachedNames.split(',').map((s) => s.trim())
                      : []
                  }
                  sourceFiles={files}
                />
              </div>
              {attachedNames && (
                <p className="mb-3 text-xs text-slate-500">
                  Searched in: {attachedNames}
                </p>
              )}
              <div className="max-h-[42rem] overflow-auto rounded-xl border border-slate-200 bg-slate-50 p-4">
                <ReferenceFormattedMessage message={message} />
              </div>
            </>
          ) : (
            <div className="flex h-full min-h-[320px] items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500">
              Results appear here with highlighted PDF page, section, quote,
              and fulfilled clauses.
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
