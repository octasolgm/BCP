import {
  parseBulletLines,
  parseCapGaps,
  parseReferenceCitation,
  requirementDisplayLines,
  type ReferenceComplianceBlock,
} from './parse-reference-response';
import {
  comparePointOrder,
  downloadExcelRows,
  normalizeMultiline,
} from './excel-write';

/** TFS Section 2 compliance matrix — same columns as TFS_Section2_Compliance_Matrix.csv */
export const MATRIX_COLUMN_HEADERS = [
  'Ref',
  'Requirement Area',
  'Granular Sub-Requirement (from CBUAE TFS Guidance Section 2)',
  'Evidence in IMPTFS Manual',
  'Evidence in SCP Policy (Mar 2025)',
  'Compliance Status',
  'Confidence %',
  'Gap / Remediation Note',
] as const;

const MATRIX_COL_WIDTHS = [10, 28, 55, 45, 45, 16, 12, 45];

const REQUIREMENT_AREAS: Record<string, string> = {
  '2.0': 'SCP (Manual Statement)',
  '2.1': 'Senior Management Commitment',
  '2.2': 'Risk Assessment',
  '2.3': 'Sanctions Risk Appetite',
  '2.4': 'Internal Controls',
  '2.5': 'Policies and Procedures',
  '2.6': 'Training',
  '2.7': 'Independent Audit and Testing',
  '2.8': 'Record Keeping',
};

function matrixRefFromTitle(title: string): string {
  const leaf = title.match(/^(\d+)\.(\d+)\.(\d+)/);
  if (leaf) return `${leaf[1]}.${leaf[2]}-${leaf[3]}`;
  const section = title.match(/^(\d+)\.(\d+)\b/);
  if (section) return `${section[1]}.${section[2]}`;
  return title.split(/\s+/)[0] ?? '';
}

function sectionKey(title: string): string {
  const leaf = title.match(/^(\d+\.\d+)\.\d+/);
  if (leaf) return leaf[1];
  const section = title.match(/^(\d+\.\d+)/);
  return section?.[1] ?? '';
}

function requirementArea(title: string): string {
  return REQUIREMENT_AREAS[sectionKey(title)] ?? '';
}

function granularRequirement(block: ReferenceComplianceBlock): string {
  const body = block.body.trim();
  if (body) {
    const lines = requirementDisplayLines(body);
    if (lines.length > 1) {
      return normalizeMultiline(
        lines.map((l) => l.replace(/^\d+[.)]\s*/, '')).join('\n'),
      );
    }
    return normalizeMultiline(body);
  }
  return normalizeMultiline(
    block.title.replace(/^[\d.]+\s*/, '').trim() || block.title,
  );
}

function matrixComplianceStatus(status: string): string {
  const s = status.trim();
  if (s === 'Compliant') return 'Met';
  if (s === 'Partial Compliant') return 'Partially Met';
  if (s === 'Non-Compliant') return 'Not Met';
  return s;
}

function confidenceNumber(confidence: string): string {
  const m = confidence.match(/(\d+)/);
  return m?.[1] ?? confidence.replace(/%/g, '').trim();
}

function evidenceImptfs(block: ReferenceComplianceBlock): string {
  const text = block.outputResponse?.trim();
  if (!text || /no corresponding procedure found/i.test(text)) return '';
  const citation = parseReferenceCitation(text);
  if (citation.page || citation.section) {
    const parts = [
      citation.page ? `Page ${citation.page}` : '',
      citation.section ? `Section ${citation.section}` : '',
    ].filter(Boolean);
    const head = parts.join(', ');
    if (citation.quote) {
      return normalizeMultiline(`${head}: ${citation.quote}`);
    }
    return normalizeMultiline(head ? `${head}: ${text}` : text);
  }
  return normalizeMultiline(text);
}

function formatGapNote(block: ReferenceComplianceBlock): string {
  const cap = block.correctiveAction?.trim();
  if (cap && cap !== 'N/A' && cap !== '—') {
    const gaps = parseCapGaps(cap);
    if (gaps.length > 0) {
      return normalizeMultiline(
        gaps
          .map((g) => {
            const parts = [`Gap ${g.index}: ${g.missing}`];
            if (g.fix) parts.push(g.fix);
            return parts.join(' ');
          })
          .join('\n'),
      );
    }
    return normalizeMultiline(cap);
  }
  const fulfilled = parseBulletLines(block.fulfilledClauses ?? '');
  if (fulfilled.length > 0) {
    return fulfilled[0];
  }
  return '';
}

function blockToMatrixRow(block: ReferenceComplianceBlock): string[] {
  return [
    matrixRefFromTitle(block.title),
    requirementArea(block.title),
    granularRequirement(block),
    evidenceImptfs(block),
    '',
    matrixComplianceStatus(block.status),
    confidenceNumber(block.confidence),
    formatGapNote(block),
  ];
}

export async function downloadComplianceMatrixExcel(
  blocks: ReferenceComplianceBlock[],
  filename: string,
): Promise<void> {
  if (blocks.length === 0) return;

  const rows = [...blocks]
    .sort(comparePointOrder)
    .map((block) => blockToMatrixRow(block));

  await downloadExcelRows(
    filename,
    'TFS Section 2 Matrix',
    [...MATRIX_COLUMN_HEADERS],
    rows,
    MATRIX_COL_WIDTHS,
  );
}
