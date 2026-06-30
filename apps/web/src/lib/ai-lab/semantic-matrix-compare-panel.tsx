'use client';

import { useMemo, useRef, useState } from 'react';
import { AI_MODELS, API_BASE } from './constants';
import { MarkdownSummary } from './compliance-report-view';
import { compareMatrixFiles, parseUploadMatrixFile, type MatrixCompareResult } from './excel-compare';
import {
  downloadSemanticReportMarkdown,
  parseSemanticMatrixReport,
  type ParsedSemanticReport,
} from './parse-semantic-matrix-report';
import { downloadSemanticMatrixCompareExcel } from './export-semantic-matrix-excel';

type TabId = 'summary' | 'gaps' | 'remediation' | 'full';

function apiErrorMessage(
  data: Record<string, unknown>,
  status: number,
): string {
  const msg = data.message;
  if (Array.isArray(msg)) return msg.join('; ');
  if (typeof msg === 'string' && msg) return msg;
  if (typeof data.error === 'string' && data.error) return data.error;
  return `Compare failed (${status})`;
}

export function SemanticMatrixComparePanel() {
  const granularRef = useRef<HTMLInputElement>(null);
  const executiveRef = useRef<HTMLInputElement>(null);
  const [aiModel, setAiModel] = useState('gemini-2.5-flash-lite');
  const [granularName, setGranularName] = useState('');
  const [executiveName, setExecutiveName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [modelUsed, setModelUsed] = useState('');
  const [modelRequested, setModelRequested] = useState('');
  const [rawReport, setRawReport] = useState('');
  const [structuralCompare, setStructuralCompare] =
    useState<MatrixCompareResult | null>(null);
  const [tab, setTab] = useState<TabId>('summary');

  const parsed: ParsedSemanticReport | null = useMemo(
    () => (rawReport ? parseSemanticMatrixReport(rawReport) : null),
    [rawReport],
  );

  async function runSemanticCompare() {
    const granularFile = granularRef.current?.files?.[0];
    const executiveFile = executiveRef.current?.files?.[0];
    if (!granularFile || !executiveFile) {
      setError(
        'Choose both files — granular matrix (e.g. TFS_Section2_Compliance_Matrix.xlsx) and executive checklist (e.g. bcp-compliance-leaf-report.xlsx).',
      );
      return;
    }

    setBusy(true);
    setError('');
    setRawReport('');
    setStructuralCompare(null);
    setModelUsed('');
    setModelRequested('');

    try {
      const [granular, executive] = await Promise.all([
        parseUploadMatrixFile(granularFile),
        parseUploadMatrixFile(executiveFile),
      ]);

      const structuralCompare = compareMatrixFiles(
        { ...granular, fileLabel: granularFile.name },
        { ...executive, fileLabel: executiveFile.name },
      );

      const res = await fetch(`${API_BASE}/comparison/semantic-matrix`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          aiModel,
          granularFileName: granularFile.name,
          executiveFileName: executiveFile.name,
          granular: { headers: granular.headers, rows: granular.rows },
          executive: { headers: executive.headers, rows: executive.rows },
        }),
      });

      const data = (await res.json()) as {
        success?: boolean;
        reportMarkdown?: string;
        model?: string;
        requestedModel?: string;
        error?: string;
        message?: string | string[];
      };

      if (!res.ok) {
        throw new Error(apiErrorMessage(data, res.status));
      }

      if (!data.success || !data.reportMarkdown) {
        throw new Error(
          data.error ||
            apiErrorMessage(data, res.status) ||
            'LLM returned no report.',
        );
      }

      setRawReport(data.reportMarkdown);
      setStructuralCompare(structuralCompare);
      setModelUsed(data.model ?? aiModel);
      setModelRequested(data.requestedModel ?? aiModel);
      setGranularName(granularFile.name);
      setExecutiveName(executiveFile.name);
      setTab('summary');

      const reportParsed = parseSemanticMatrixReport(data.reportMarkdown);
      await downloadSemanticMatrixCompareExcel({
        parsed: reportParsed,
        granularFileName: granularFile.name,
        executiveFileName: executiveFile.name,
        modelUsed: data.model ?? aiModel,
        modelRequested: data.requestedModel ?? aiModel,
        structuralCompare,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Semantic compare failed.');
    } finally {
      setBusy(false);
    }
  }

  const gapCount = parsed?.gaps.length ?? parsed?.meta?.mismatchCount ?? null;
  const changeCount =
    (parsed?.changes.length ?? 0) +
    (structuralCompare?.cellChanges.length ?? 0);

  const tabs: { id: TabId; label: string }[] = [
    { id: 'summary', label: 'Summary' },
    { id: 'gaps', label: `Gaps${gapCount != null ? ` (${gapCount})` : ''}` },
    { id: 'remediation', label: 'Remediation' },
    { id: 'full', label: 'Full report' },
  ];

  return (
    <section className="rounded-xl border border-emerald-400 bg-emerald-50/90 p-4 shadow-sm">
      <h2 className="text-sm font-semibold text-emerald-950">
        Semantic matrix compare (LLM)
      </h2>
      <p className="mt-1 text-xs leading-relaxed text-emerald-900/90">
        Cross-reference a <strong>granular TFS matrix</strong> (~66 rows) against
        a <strong>high-level BCP executive checklist</strong> (~26 rows) using
        deep semantic analysis — not exact text diff. Choose an LLM, upload both
        files, and get alignment summary, gap list, and remediation roadmap. If
        your chosen Gemini model is busy, the API automatically tries alternate
        Gemini models.
      </p>

      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="sm:col-span-2 lg:col-span-1">
          <label className="mb-1 block text-xs font-medium text-emerald-900">
            LLM model
          </label>
          <select
            value={aiModel}
            onChange={(e) => setAiModel(e.target.value)}
            className="w-full rounded-md border border-emerald-300 bg-white px-2 py-2 text-xs text-slate-800"
          >
            {AI_MODELS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-emerald-900">
            Granular matrix
          </label>
          <input
            ref={granularRef}
            type="file"
            accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
            onChange={(e) =>
              setGranularName(e.target.files?.[0]?.name ?? '')
            }
            className="block w-full text-xs text-slate-700 file:mr-2 file:rounded file:border-0 file:bg-emerald-600 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-white"
          />
          {granularName && (
            <p className="mt-1 truncate text-[11px] text-emerald-800">
              {granularName}
            </p>
          )}
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-emerald-900">
            Executive checklist
          </label>
          <input
            ref={executiveRef}
            type="file"
            accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
            onChange={(e) =>
              setExecutiveName(e.target.files?.[0]?.name ?? '')
            }
            className="block w-full text-xs text-slate-700 file:mr-2 file:rounded file:border-0 file:bg-emerald-600 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-white"
          />
          {executiveName && (
            <p className="mt-1 truncate text-[11px] text-emerald-800">
              {executiveName}
            </p>
          )}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={runSemanticCompare}
          disabled={busy}
          className="rounded-md border border-emerald-700 bg-emerald-700 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
        >
          {busy ? 'Analyzing with LLM…' : 'Run semantic compare'}
        </button>
        {rawReport && parsed && (
          <>
            <button
              type="button"
              onClick={() =>
                downloadSemanticMatrixCompareExcel({
                  parsed,
                  granularFileName: granularName,
                  executiveFileName: executiveName,
                  modelUsed,
                  modelRequested,
                  structuralCompare,
                })
              }
              className="rounded-md border border-emerald-600 bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
            >
              Download Excel report
            </button>
            <button
              type="button"
              onClick={() =>
                downloadSemanticReportMarkdown(
                  rawReport,
                  granularName,
                  executiveName,
                )
              }
              className="rounded-md border border-emerald-600 bg-white px-4 py-2 text-xs font-semibold text-emerald-900 hover:bg-emerald-100"
            >
              Download report (.md)
            </button>
          </>
        )}
      </div>

      {modelUsed && (
        <p className="mt-2 text-[11px] text-emerald-800">
          Model used: <span className="font-medium">{modelUsed}</span>
          {modelRequested &&
            modelRequested.toLowerCase() !== modelUsed.toLowerCase() && (
              <>
                {' '}
                (requested <span className="font-medium">{modelRequested}</span>
                , auto-fallback)
              </>
            )}
        </p>
      )}

      {busy && (
        <p className="mt-2 text-[11px] text-emerald-800">
          Analyzing both files — this usually takes 30–90 seconds. If Gemini is
          overloaded, alternate models are tried automatically.
        </p>
      )}

      {parsed && (
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          <StatCard
            label="Semantic alignment"
            value={
              parsed.meta?.alignmentScorePercent != null
                ? `${parsed.meta.alignmentScorePercent}%`
                : '—'
            }
          />
          <StatCard
            label="Gaps"
            value={String(parsed.gaps.length)}
            highlight={parsed.gaps.length > 0}
          />
          <StatCard
            label="Changes"
            value={String(changeCount)}
            highlight={changeCount > 0}
          />
          <StatCard
            label="Mapped pairs"
            value={
              parsed.meta?.mappedPairs != null
                ? String(parsed.meta.mappedPairs)
                : '—'
            }
          />
          <StatCard
            label="Aligned"
            value={
              parsed.meta?.alignedPairs != null
                ? String(parsed.meta.alignedPairs)
                : '—'
            }
          />
        </div>
      )}

      {parsed && (
        <div className="mt-4">
          <div className="flex flex-wrap gap-1 border-b border-emerald-200 pb-2">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium ${
                  tab === t.id
                    ? 'bg-emerald-700 text-white'
                    : 'bg-white text-emerald-900 hover:bg-emerald-100'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="mt-3 max-h-[520px] overflow-y-auto rounded-lg border border-emerald-200 bg-white p-4">
            {tab === 'summary' && (
              <MarkdownSummary
                text={
                  parsed.summarySection ||
                  'No summary section parsed — see Full report.'
                }
              />
            )}

            {tab === 'gaps' && (
              <div className="space-y-4">
                {parsed.gaps.length ? (
                  parsed.gaps.map((m, i) => (
                    <div
                      key={`${m.ref}-${i}`}
                      className="rounded-lg border border-amber-200 bg-amber-50/50 p-3"
                    >
                      <p className="text-sm font-bold text-amber-950">
                        Ref {m.ref || '—'}
                        {m.executivePoint
                          ? ` · Executive ${m.executivePoint}`
                          : ''}
                      </p>
                      {m.requirementArea && (
                        <p className="mt-1 text-xs text-amber-900">
                          {m.requirementArea}
                        </p>
                      )}
                      <dl className="mt-2 space-y-1.5 text-xs">
                        {m.executiveClaim && (
                          <>
                            <dt className="font-semibold text-slate-700">
                              Executive claim
                            </dt>
                            <dd className="text-slate-800">{m.executiveClaim}</dd>
                          </>
                        )}
                        {m.granularFinding && (
                          <>
                            <dt className="font-semibold text-slate-700">
                              Granular finding
                            </dt>
                            <dd className="text-slate-800">{m.granularFinding}</dd>
                          </>
                        )}
                        {m.coreConflict && (
                          <>
                            <dt className="font-semibold text-red-800">
                              Core conflict
                            </dt>
                            <dd className="text-red-900">{m.coreConflict}</dd>
                          </>
                        )}
                        {m.documentContradiction &&
                          m.documentContradiction.toLowerCase() !==
                            'none identified' && (
                            <>
                              <dt className="font-semibold text-violet-800">
                                IMPTFS vs SCP contradiction
                              </dt>
                              <dd className="text-violet-900">
                                {m.documentContradiction}
                              </dd>
                            </>
                          )}
                      </dl>
                    </div>
                  ))
                ) : (
                  <MarkdownSummary
                    text={
                      parsed.gapSection ||
                      'No gaps identified or gap section not parsed.'
                    }
                  />
                )}
              </div>
            )}

            {tab === 'remediation' && (
              <div className="space-y-3">
                {parsed.remediation.length ? (
                  <ol className="list-decimal space-y-2 pl-5 text-sm text-slate-800">
                    {parsed.remediation.map((item, i) => (
                      <li key={`${item.ref}-${i}`}>
                        {item.ref && (
                          <span className="font-semibold text-emerald-900">
                            [{item.ref}]{' '}
                          </span>
                        )}
                        {item.action}
                      </li>
                    ))}
                  </ol>
                ) : (
                  <MarkdownSummary
                    text={
                      parsed.remediationSection ||
                      'No remediation section parsed.'
                    }
                  />
                )}
              </div>
            )}

            {tab === 'full' && <MarkdownSummary text={parsed.fullText} />}
          </div>
        </div>
      )}

      {error && (
        <div className="mt-2 rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-900">
          <p className="font-semibold">Compare failed</p>
          <p className="mt-1">{error}</p>
          <p className="mt-2 text-[11px] text-red-800">
            Try <strong>gemini-2.5-flash-lite</strong> or an Azure model (
            gpt-4o-mini) if Gemini stays overloaded.
          </p>
        </div>
      )}
    </section>
  );
}

function StatCard({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border p-3 ${
        highlight
          ? 'border-amber-300 bg-amber-50'
          : 'border-emerald-200 bg-white'
      }`}
    >
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-lg font-bold text-slate-900">{value}</p>
    </div>
  );
}
