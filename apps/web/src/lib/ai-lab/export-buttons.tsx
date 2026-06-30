'use client';

import { useState } from 'react';
import {
  buildFormattedResultsPlain,
  buildFullReportHtml,
  buildFullReportPlain,
  buildResultsOnlyHtml,
  downloadTextFile,
  reportFilename,
  type FullReportExport,
} from './export-report';
import { downloadReportPdf, downloadResultsPdf } from './export-pdf';
import { copyFormattedToClipboard } from './formatting';
import type { ParsedComplianceResult } from './parse-compliance-results';

function ExportActions({
  plain,
  html,
  copyLabel,
  pdfLabel = 'Export PDF',
  onExportPdf,
  pdfDisabled,
}: {
  plain: string;
  html: string;
  copyLabel: string;
  pdfLabel?: string;
  onExportPdf: () => Promise<void>;
  pdfDisabled?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState('');

  async function copyFormatted() {
    const ok = await copyFormattedToClipboard(plain);
    if (!ok && plain) await navigator.clipboard.writeText(plain);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function exportPdf() {
    setPdfLoading(true);
    setPdfError('');
    try {
      await onExportPdf();
    } catch (e) {
      setPdfError(e instanceof Error ? e.message : 'PDF export failed');
    } finally {
      setPdfLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex flex-wrap justify-end gap-2">
        <button
          type="button"
          onClick={copyFormatted}
          disabled={!plain}
          className="rounded-md border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-40"
        >
          {copied ? 'Copied' : copyLabel}
        </button>
        <button
          type="button"
          onClick={() => downloadTextFile(plain, reportFilename('txt'))}
          disabled={!plain}
          className="rounded-md border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-40"
        >
          Export .txt
        </button>
        <button
          type="button"
          onClick={() =>
            downloadTextFile(html, reportFilename('html'), 'text/html;charset=utf-8')
          }
          disabled={!html}
          className="rounded-md border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-40"
        >
          Export .html
        </button>
        <button
          type="button"
          onClick={exportPdf}
          disabled={pdfDisabled || pdfLoading}
          className="rounded-md bg-red-600 px-3 py-1 text-xs font-medium text-white shadow-sm hover:bg-red-700 disabled:opacity-40"
        >
          {pdfLoading ? 'Building PDF…' : pdfLabel}
        </button>
      </div>
      {pdfError && <p className="text-xs text-red-600">{pdfError}</p>}
    </div>
  );
}

export function ExportReportButtons({ report }: { report: FullReportExport }) {
  const plain = buildFullReportPlain(report);
  const html = buildFullReportHtml(report);
  return (
    <ExportActions
      plain={plain}
      html={html}
      copyLabel="Copy full report"
      pdfLabel="Export PDF"
      pdfDisabled={report.results.length === 0}
      onExportPdf={() => downloadReportPdf(report, reportFilename('pdf'))}
    />
  );
}

export function ExportResultsButtons({
  results,
}: {
  results: ParsedComplianceResult[];
}) {
  const plain = buildFormattedResultsPlain(results);
  const html = buildResultsOnlyHtml(results);
  return (
    <ExportActions
      plain={plain}
      html={html}
      copyLabel="Copy formatted"
      pdfLabel="Export PDF"
      pdfDisabled={results.length === 0}
      onExportPdf={() => downloadResultsPdf(results, reportFilename('pdf'))}
    />
  );
}
