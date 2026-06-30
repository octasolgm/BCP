import type { MatrixCompareResult } from './excel-compare';
import type { ParsedSemanticReport } from './parse-semantic-matrix-report';

function applyWrap(row: import('exceljs').Row): void {
  row.eachCell((cell) => {
    cell.alignment = { wrapText: true, vertical: 'top' };
  });
}

function boldRow(row: import('exceljs').Row): void {
  row.eachCell((cell) => {
    cell.font = { ...(cell.font ?? {}), bold: true };
  });
}

function textLines(text: string): string[] {
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
}

export function semanticCompareExcelFilename(
  granularName?: string,
  executiveName?: string,
): string {
  const stamp = new Date().toISOString().slice(0, 10);
  if (granularName && executiveName) {
    const a = granularName.replace(/\.[^.]+$/, '').slice(0, 18);
    const b = executiveName.replace(/\.[^.]+$/, '').slice(0, 18);
    return `Semantic_Compare_${a}_vs_${b}_${stamp}.xlsx`;
  }
  return `semantic-matrix-compare-${stamp}.xlsx`;
}

export async function downloadSemanticMatrixCompareExcel(params: {
  parsed: ParsedSemanticReport;
  granularFileName: string;
  executiveFileName: string;
  modelUsed?: string;
  modelRequested?: string;
  structuralCompare?: MatrixCompareResult | null;
}): Promise<void> {
  const {
    parsed,
    granularFileName,
    executiveFileName,
    modelUsed,
    modelRequested,
    structuralCompare,
  } = params;
  const meta = parsed.meta;
  const gaps = parsed.gaps;
  const changes = [...parsed.changes];
  const stamp = new Date().toLocaleString();

  if (structuralCompare) {
    for (const ch of structuralCompare.cellChanges) {
      changes.push({
        ref: ch.ref,
        requirementArea: '',
        changeType: 'File diff (same Ref)',
        columnOrAspect: ch.column,
        executiveValue: ch.valueCompare,
        granularValue: ch.valueBaseline,
        gapOrConflict: `${granularFileName} vs ${executiveFileName}`,
        imptfsVsScp: '',
      });
    }
  }

  const ExcelJS = (await import('exceljs')).default;
  const workbook = new ExcelJS.Workbook();

  // --- Summary ---
  const summary = workbook.addWorksheet('Summary');
  summary.columns = [{ width: 32 }, { width: 72 }];

  const gapCount =
    gaps.length ||
    meta?.mismatchCount ||
    meta?.mismatches.length ||
    0;
  const changeCount = changes.length;

  const summaryRows: string[][] = [
    ['SEMANTIC MATRIX COMPARE REPORT'],
    ['Generated', stamp],
    ['Granular matrix (File 1)', granularFileName],
    ['Executive checklist (File 2)', executiveFileName],
  ];
  if (modelUsed) summaryRows.push(['Model used', modelUsed]);
  if (modelRequested && modelRequested !== modelUsed) {
    summaryRows.push(['Model requested', modelRequested]);
  }
  summaryRows.push(
    [],
    ['Metric', 'Value'],
    [
      'Semantic alignment %',
      meta?.alignmentScorePercent != null
        ? `${meta.alignmentScorePercent}%`
        : '—',
    ],
    ['Mapped pairs', meta?.mappedPairs != null ? String(meta.mappedPairs) : '—'],
    ['Aligned pairs', meta?.alignedPairs != null ? String(meta.alignedPairs) : '—'],
    ['Gaps identified', String(gapCount)],
    ['Changes recorded', String(changeCount)],
  );

  if (structuralCompare) {
    summaryRows.push(
      ['Same rows (by Ref)', String(structuralCompare.same)],
      ['Changed rows (by Ref)', String(structuralCompare.changed)],
      [
        `Only in "${structuralCompare.fileBaseline}"`,
        String(structuralCompare.onlyBaseline),
      ],
      [
        `Only in "${structuralCompare.fileCompare}"`,
        String(structuralCompare.onlyCompare),
      ],
    );
  }

  summaryRows.push([], ['EXECUTIVE SEMANTIC ALIGNMENT SUMMARY']);

  for (const line of summaryRows) {
    const row = summary.addRow(line);
    if (
      line[0]?.startsWith('SEMANTIC') ||
      line[0]?.startsWith('EXECUTIVE') ||
      line[0] === 'Metric'
    ) {
      boldRow(row);
    }
    applyWrap(row);
  }

  for (const line of textLines(parsed.summarySection)) {
    applyWrap(summary.addRow([line]));
  }

  // --- Gaps (always structured columns) ---
  const gapsSheet = workbook.addWorksheet('Gaps');
  gapsSheet.columns = [
    { width: 12 },
    { width: 14 },
    { width: 28 },
    { width: 42 },
    { width: 42 },
    { width: 48 },
    { width: 42 },
  ];

  const gapHead = gapsSheet.addRow([
    'Ref',
    'Executive point',
    'Requirement area',
    'Executive claim (File 2)',
    'Granular finding (File 1)',
    'Core conflict / gap',
    'IMPTFS vs SCP contradiction',
  ]);
  applyWrap(gapHead);
  boldRow(gapHead);

  if (gaps.length > 0) {
    for (const g of gaps) {
      applyWrap(
        gapsSheet.addRow([
          g.ref,
          g.executivePoint,
          g.requirementArea,
          g.executiveClaim,
          g.granularFinding,
          g.coreConflict,
          g.documentContradiction,
        ]),
      );
    }
  } else {
    applyWrap(
      gapsSheet.addRow([
        '—',
        '',
        '',
        '',
        '',
        'No gaps parsed — see Full Report sheet.',
        '',
      ]),
    );
  }

  // --- Changes ---
  const changesSheet = workbook.addWorksheet('Changes');
  changesSheet.columns = [
    { width: 12 },
    { width: 26 },
    { width: 22 },
    { width: 28 },
    { width: 40 },
    { width: 40 },
    { width: 48 },
    { width: 36 },
  ];

  const changeHead = changesSheet.addRow([
    'Ref',
    'Requirement area',
    'Change type',
    'Column / aspect',
    `Granular — ${granularFileName}`,
    `Executive — ${executiveFileName}`,
    'Gap / conflict detail',
    'IMPTFS vs SCP',
  ]);
  applyWrap(changeHead);
  boldRow(changeHead);

  if (changes.length > 0) {
    for (const c of changes) {
      applyWrap(
        changesSheet.addRow([
          c.ref,
          c.requirementArea,
          c.changeType,
          c.columnOrAspect,
          c.granularValue,
          c.executiveValue,
          c.gapOrConflict,
          c.imptfsVsScp,
        ]),
      );
    }
  } else {
    applyWrap(
      changesSheet.addRow([
        '—',
        '',
        '',
        '',
        '',
        '',
        'No changes parsed.',
        '',
      ]),
    );
  }

  // --- Structural side-by-side (when Ref matches) ---
  if (structuralCompare && structuralCompare.rowSummaries.length > 0) {
    const side = workbook.addWorksheet('Side by Side');
    const fb = structuralCompare.fileBaseline;
    const fc = structuralCompare.fileCompare;
    const headers = structuralCompare.headers;
    const headRow = [
      'Ref',
      'Status',
      'Changed columns',
      ...headers.flatMap((h) => [`${h} — ${fb}`, `${h} — ${fc}`]),
    ];
    side.columns = headRow.map((_, i) => ({
      width: i < 3 ? 20 : 38,
    }));
    const sideHead = side.addRow(headRow);
    applyWrap(sideHead);
    boldRow(sideHead);

    for (const row of structuralCompare.rowSummaries) {
      if (row.status === 'Same') continue;
      const base = row.rowBaseline ?? [];
      const cmp = row.rowCompare ?? [];
      const pairs = headers.flatMap((_, i) => [base[i] ?? '', cmp[i] ?? '']);
      applyWrap(
        side.addRow([
          row.ref,
          row.statusLabel,
          row.changedColumns.join('; '),
          ...pairs,
        ]),
      );
    }
  }

  // --- Remediation ---
  const remediation = workbook.addWorksheet('Remediation');
  remediation.columns = [{ width: 10 }, { width: 14 }, { width: 82 }];
  const remHead = remediation.addRow(['Priority', 'Ref', 'Action required']);
  applyWrap(remHead);
  boldRow(remHead);

  const items = parsed.remediation;
  if (items.length > 0) {
    for (const item of items) {
      applyWrap(
        remediation.addRow([String(item.priority), item.ref, item.action]),
      );
    }
  } else if (parsed.remediationSection.trim()) {
    for (const line of textLines(parsed.remediationSection)) {
      applyWrap(remediation.addRow(['', '', line]));
    }
  } else {
    applyWrap(remediation.addRow(['', '', 'No remediation items.']));
  }

  // --- Full report ---
  const full = workbook.addWorksheet('Full Report');
  full.columns = [{ width: 110 }];
  for (const line of parsed.fullText.split('\n')) {
    applyWrap(full.addRow([line]));
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = semanticCompareExcelFilename(
    granularFileName,
    executiveFileName,
  );
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
