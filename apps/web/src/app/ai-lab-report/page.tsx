'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import {
  AI_MODELS,
  API_BASE,
} from '../../lib/ai-lab/constants';
import {
  AttentionSummaryList,
  ColorCodeLegend,
  ComplianceResultsList,
  MarkdownSummary,
  ReportStatsSummary,
} from '../../lib/ai-lab/compliance-report-view';
import { CopyButton } from '../../lib/ai-lab/formatting';
import {
  ExportReportButtons,
  ExportResultsButtons,
} from '../../lib/ai-lab/export-buttons';
import {
  AI_SUMMARY_PROMPT_PREFIX,
  buildReportStats,
  cleanDisplayTitle,
  parseComplianceReport,
} from '../../lib/ai-lab/parse-compliance-results';

type ApiResponse = Record<string, unknown>;

function buildProgrammaticSummary(
  stats: ReturnType<typeof buildReportStats>,
): string {
  const lines: string[] = [
    '## Executive summary',
    '',
    `Analyzed **${stats.total}** requirement point(s).`,
    '',
    `- **${stats.atFullConfidence}** at 100% confidence`,
    `- **${stats.belowFullConfidence}** below 100% confidence`,
    `- **${stats.attentionItems.length}** need attention`,
    '',
  ];

  if (stats.attentionItems.length === 0) {
    lines.push(
      'All points are fully compliant at 100% confidence. No corrective priority items.',
    );
  } else {
    lines.push('## Need focus', '');
    for (const item of stats.attentionItems) {
      const title = cleanDisplayTitle(item.title || `Point ${item.index + 1}`);
      const conf = item.confidence !== null ? `${item.confidence}%` : 'n/a';
      lines.push(`- ${title} — ${item.status}, confidence ${conf}`);
    }
  }

  return lines.join('\n');
}

export default function AiLabReportPage() {
  const [rawText, setRawText] = useState('');
  const [aiModel, setAiModel] = useState('gemini-3.5-flash');
  const [aiSummary, setAiSummary] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');

  const results = useMemo(
    () => parseComplianceReport(rawText),
    [rawText],
  );
  const stats = useMemo(() => buildReportStats(results), [results]);
  const programmaticSummary = useMemo(
    () => buildProgrammaticSummary(stats),
    [stats],
  );

  const displaySummary = aiSummary || programmaticSummary;

  async function generateAiSummary() {
    if (!rawText.trim()) {
      setAiError('Paste batch results first');
      return;
    }
    setAiLoading(true);
    setAiError('');
    setAiSummary('');
    try {
      const form = new FormData();
      form.append('prompt', AI_SUMMARY_PROMPT_PREFIX + rawText);
      form.append('aiModel', aiModel);
      const res = await fetch(`${API_BASE}/ai/bcpanalyze`, {
        method: 'POST',
        body: form,
      });
      const data = (await res.json()) as ApiResponse;
      if (!res.ok) {
        setAiError(
          typeof data.message === 'string'
            ? data.message
            : JSON.stringify(data, null, 2),
        );
        return;
      }
      const msg = data.message;
      setAiSummary(typeof msg === 'string' ? msg : JSON.stringify(msg, null, 2));
    } catch (e) {
      setAiError(e instanceof Error ? e.message : 'AI summary failed');
    } finally {
      setAiLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-7xl p-6">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">
            Compliance Report
          </h1>
          <p className="mt-1 text-slate-600">
            Paste batch analyze output — get formatted results, instant summary,
            and highlights for points below 100% confidence.
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
            href="/ai-lab-extract"
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50"
          >
            Extract points
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
        <label className="mb-1 block text-sm font-medium text-slate-700">
          Paste all batch responses
        </label>
        <textarea
          value={rawText}
          onChange={(e) => {
            setRawText(e.target.value);
            setAiSummary('');
            setAiError('');
          }}
          rows={12}
          placeholder="Paste output from AI Lab Batch (Copy all formatted) or multiple analyze results separated by ---"
          className="min-h-[240px] w-full resize-y rounded-lg border border-slate-300 px-3 py-3 font-mono text-xs leading-relaxed"
        />
        <p className="mt-2 text-xs text-slate-500">
          {results.length} point{results.length === 1 ? '' : 's'} detected ·
          Instant summary updates as you paste · Points &lt; 100% confidence are
          highlighted in amber
        </p>
      </div>

      {results.length > 0 && (
        <>
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-violet-200 bg-violet-50 px-4 py-3">
            <p className="text-sm font-medium text-violet-900">
              Export full report — summary, color legend, attention list, and all
              formatted results (.pdf · .html · .txt)
            </p>
            <ExportReportButtons
              report={{ summary: displaySummary, results, stats }}
            />
          </div>

          <section className="mb-8">
            <ColorCodeLegend results={results} />
          </section>

          <section className="mb-8">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                Statistics
              </h2>
            </div>
            <ReportStatsSummary stats={stats} />
          </section>

          <section className="mb-8 grid gap-6 lg:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                  Summary
                </h2>
                <CopyButton message={displaySummary} label="Copy summary" />
              </div>

              <div className="mb-4 flex flex-wrap items-end gap-3">
                <div className="min-w-[200px] flex-1">
                  <label className="mb-1 block text-xs font-medium text-slate-600">
                    AI model (optional enhanced summary)
                  </label>
                  <select
                    value={aiModel}
                    onChange={(e) => setAiModel(e.target.value)}
                    disabled={aiLoading}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:opacity-50"
                  >
                    {AI_MODELS.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  onClick={generateAiSummary}
                  disabled={aiLoading || !rawText.trim()}
                  className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50"
                >
                  {aiLoading ? 'Generating…' : 'AI enhance summary'}
                </button>
              </div>

              {aiError && (
                <pre className="mb-3 overflow-auto rounded-lg bg-red-50 p-3 text-xs text-red-800">
                  {aiError}
                </pre>
              )}

              <div className="max-h-80 overflow-auto rounded-lg border border-slate-100 bg-slate-50 p-4">
                <MarkdownSummary text={displaySummary} />
              </div>
              {!aiSummary && (
                <p className="mt-2 text-xs text-slate-500">
                  Showing instant summary. Click <strong>AI enhance summary</strong>{' '}
                  for a deeper executive report ({aiModel}).
                </p>
              )}
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
                Attention focus (&lt; 100% confidence)
              </h2>
              <AttentionSummaryList items={stats.attentionItems} />
            </div>
          </section>

          <section>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                Full formatted results ({results.length})
              </h2>
              <ExportResultsButtons results={results} />
            </div>
            <div className="max-h-[48rem] overflow-auto rounded-xl border border-slate-200 bg-slate-50 p-4">
              <ComplianceResultsList results={results} />
            </div>
          </section>
        </>
      )}
    </main>
  );
}
