import { downloadComplianceDetailPdf } from '../ai-lab/export-pdf';
import { downloadComplianceFormattedExcel } from '../ai-lab/export-excel';
import { comparePointOrder, downloadExcelRows } from '../ai-lab/excel-write';
import {
  buildReportStats,
  type ParsedComplianceResult,
  type ReportStats,
} from '../ai-lab/parse-compliance-results';
import {
  parseReferenceComplianceBlock,
  type ReferenceComplianceBlock,
} from '../ai-lab/parse-reference-response';
import {
  blockFromMessage,
  type AgreementStatus,
  type DualVerifyAgreement,
} from './dual-verify-merge';

export type DualVerifyExportPass = 'pass1' | 'pass2' | 'both';

export type DualVerifyExportItem = {
  point: { point_id: string; title?: string; text: string };
  landingMessage: string;
  llmMessage: string;
  agreement: DualVerifyAgreement;
};

export type DualVerifyAgreementCounts = {
  total: number;
  aligned: number;
  confidence_gap: number;
  status_mismatch: number;
  both_non_compliant: number;
};

export type DualVerifySummaryStats = {
  total: number;
  agreement: DualVerifyAgreementCounts;
  pass1: ReportStats;
  pass2: ReportStats;
};

const AGREEMENT_LABELS: Record<AgreementStatus, string> = {
  aligned: 'Aligned',
  confidence_gap: 'Confidence gap',
  status_mismatch: 'Status mismatch',
  both_non_compliant: 'Both non-compliant',
  landing_error: 'Pass 1 error',
  llm_error: 'Pass 2 error',
};

function parseConfidence(block: ReferenceComplianceBlock): number | null {
  const m = block.confidence.match(/(\d+)/);
  return m ? Number(m[1]) : null;
}

function blockToParsedResult(
  block: ReferenceComplianceBlock,
  index: number,
): ParsedComplianceResult {
  const confidence = parseConfidence(block);
  const status = block.status.trim() || 'Unknown';
  return {
    index,
    title: block.title,
    body: block.body,
    fields: [],
    status,
    confidence,
    needsAttention:
      status !== 'Compliant' || (confidence !== null && confidence < 100),
  };
}

/** Build parsed results and stats for a single pass. */
export function buildPassReport(
  items: DualVerifyExportItem[],
  pass: 'pass1' | 'pass2',
): { blocks: ReferenceComplianceBlock[]; results: ParsedComplianceResult[]; stats: ReportStats } {
  const blocks = items
    .map((item) =>
      pass === 'pass1'
        ? blockFromMessage(item.landingMessage)
        : blockFromMessage(item.llmMessage),
    )
    .sort(comparePointOrder);
  const results = blocks.map(blockToParsedResult);
  return { blocks, results, stats: buildReportStats(results) };
}

/** Aggregate agreement and per-pass statistics for dual-verify runs. */
export function buildDualVerifySummaryStats(
  items: DualVerifyExportItem[],
): DualVerifySummaryStats {
  const agreement: DualVerifyAgreementCounts = {
    total: items.length,
    aligned: 0,
    confidence_gap: 0,
    status_mismatch: 0,
    both_non_compliant: 0,
  };

  for (const item of items) {
    switch (item.agreement.status) {
      case 'aligned':
        agreement.aligned += 1;
        break;
      case 'confidence_gap':
        agreement.confidence_gap += 1;
        break;
      case 'status_mismatch':
        agreement.status_mismatch += 1;
        break;
      case 'both_non_compliant':
        agreement.both_non_compliant += 1;
        break;
      default:
        break;
    }
  }

  return {
    total: items.length,
    agreement,
    pass1: buildPassReport(items, 'pass1').stats,
    pass2: buildPassReport(items, 'pass2').stats,
  };
}

/** Markdown executive summary for the dual-verify report panel and PDF. */
export function buildDualVerifyExecutiveSummary(
  stats: DualVerifySummaryStats,
  pass: DualVerifyExportPass,
): string {
  if (!stats.total) return '';

  const lines: string[] = [
    `Dual-verify analysis of **${stats.total}** government requirement point(s).`,
    '',
    '**Cross-pass agreement**',
    `- Aligned: ${stats.agreement.aligned}`,
    `- Confidence gap (status match, >15% delta): ${stats.agreement.confidence_gap}`,
    `- Status mismatch: ${stats.agreement.status_mismatch}`,
    `- Both flag gaps: ${stats.agreement.both_non_compliant}`,
    '',
  ];

  if (pass === 'pass1' || pass === 'both') {
    lines.push(
      '**Pass 1 — Landing AI**',
      `- Compliant: ${stats.pass1.compliant} · Partial: ${stats.pass1.partial} · Non-Compliant: ${stats.pass1.nonCompliant}`,
      `- Below 100% confidence: ${stats.pass1.belowFullConfidence}`,
      '',
    );
  }

  if (pass === 'pass2' || pass === 'both') {
    lines.push(
      '**Pass 2 — LLM verify**',
      `- Compliant: ${stats.pass2.compliant} · Partial: ${stats.pass2.partial} · Non-Compliant: ${stats.pass2.nonCompliant}`,
      `- Below 100% confidence: ${stats.pass2.belowFullConfidence}`,
    );
  }

  return lines.join('\n').trim();
}

function passLabel(pass: DualVerifyExportPass): string {
  if (pass === 'pass1') return 'Pass 1 (Landing AI)';
  if (pass === 'pass2') return 'Pass 2 (LLM verify)';
  return 'Both passes';
}

function exportFilename(
  base: string,
  pass: DualVerifyExportPass,
  ext: 'pdf' | 'xlsx',
): string {
  const stamp = new Date().toISOString().slice(0, 10);
  const passTag =
    pass === 'pass1' ? 'pass1' : pass === 'pass2' ? 'pass2' : 'both';
  return `bcp-dual-verify-${base}-${passTag}-${stamp}.${ext}`;
}

function requirementText(item: DualVerifyExportItem): string {
  const title = item.point.title?.trim() || item.point.point_id;
  const body = item.point.text.trim();
  if (title && body) return `${title}\n\n${body}`;
  return title || body;
}

const DUAL_EXCEL_HEADERS = [
  'Point ID',
  'Requirement',
  'Agreement',
  'Agreement summary',
  'Pass 1 status',
  'Pass 1 confidence %',
  'Pass 1 response',
  'Pass 1 action plan',
  'Pass 2 status',
  'Pass 2 confidence %',
  'Pass 2 response',
  'Pass 2 action plan',
] as const;

const DUAL_EXCEL_WIDTHS = [12, 48, 16, 36, 14, 12, 48, 36, 14, 12, 48, 36];

async function downloadDualVerifyBothExcel(
  items: DualVerifyExportItem[],
  filename: string,
): Promise<void> {
  const sorted = [...items].sort((a, b) =>
    comparePointOrder(
      blockFromMessage(a.landingMessage),
      blockFromMessage(b.landingMessage),
    ),
  );

  const rows = sorted.map((item) => {
    const p1 = parseReferenceComplianceBlock(item.landingMessage);
    const p2 = parseReferenceComplianceBlock(item.llmMessage);
    return [
      item.point.point_id,
      requirementText(item),
      item.agreement.label,
      item.agreement.summary,
      p1.status,
      p1.confidence,
      p1.outputResponse?.trim() || '',
      p1.correctiveAction?.trim() || '',
      p2.status,
      p2.confidence,
      p2.outputResponse?.trim() || '',
      p2.correctiveAction?.trim() || '',
    ];
  });

  await downloadExcelRows(
    filename,
    'Dual Verify',
    [...DUAL_EXCEL_HEADERS],
    rows,
    DUAL_EXCEL_WIDTHS,
  );
}

/** Download dual-verify report as PDF for the selected pass scope. */
export async function downloadDualVerifyPdf(
  items: DualVerifyExportItem[],
  pass: DualVerifyExportPass,
  reportTitle: string,
  filenameBase: string,
): Promise<void> {
  if (items.length === 0) return;

  const stats = buildDualVerifySummaryStats(items);
  const summary = buildDualVerifyExecutiveSummary(stats, pass);
  const filename = exportFilename(filenameBase, pass, 'pdf');

  if (pass === 'pass1') {
    const { blocks, stats: passStats } = buildPassReport(items, 'pass1');
    await downloadComplianceDetailPdf(
      blocks,
      passStats,
      filename,
      `${reportTitle} — Pass 1 (Landing AI)`,
      summary,
    );
    return;
  }

  if (pass === 'pass2') {
    const { blocks, stats: passStats } = buildPassReport(items, 'pass2');
    await downloadComplianceDetailPdf(
      blocks,
      passStats,
      filename,
      `${reportTitle} — Pass 2 (LLM verify)`,
      summary,
    );
    return;
  }

  const { downloadDualVerifyComparisonPdf } = await import('../ai-lab/export-pdf');
  const pass1 = buildPassReport(items, 'pass1');
  const pass2 = buildPassReport(items, 'pass2');

  await downloadDualVerifyComparisonPdf({
    title: `${reportTitle} — Both passes`,
    filename,
    summary,
    pass1Stats: pass1.stats,
    pass2Stats: pass2.stats,
    agreementCounts: stats.agreement,
    items: items
      .sort((a, b) =>
        comparePointOrder(
          blockFromMessage(a.landingMessage),
          blockFromMessage(b.landingMessage),
        ),
      )
      .map((item) => ({
        pointId: item.point.point_id,
        agreementLabel: item.agreement.label,
        agreementSummary: item.agreement.summary,
        pass1Block: blockFromMessage(item.landingMessage),
        pass2Block: blockFromMessage(item.llmMessage),
      })),
  });
}

/** Download dual-verify report as Excel for the selected pass scope. */
export async function downloadDualVerifyExcel(
  items: DualVerifyExportItem[],
  pass: DualVerifyExportPass,
  filenameBase: string,
  requirementColumnHeader?: string,
): Promise<void> {
  if (items.length === 0) return;

  const filename = exportFilename(filenameBase, pass, 'xlsx');

  if (pass === 'pass1') {
    const { blocks } = buildPassReport(items, 'pass1');
    await downloadComplianceFormattedExcel(
      blocks,
      filename,
      requirementColumnHeader,
    );
    return;
  }

  if (pass === 'pass2') {
    const { blocks } = buildPassReport(items, 'pass2');
    await downloadComplianceFormattedExcel(
      blocks,
      filename,
      requirementColumnHeader,
    );
    return;
  }

  await downloadDualVerifyBothExcel(items, filename);
}

export { AGREEMENT_LABELS, passLabel };
