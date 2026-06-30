import { parseCsvText } from './csv-to-excel';
import { normalizeMultiline } from './excel-write';

export type ParsedMatrix = {
  headers: string[];
  rows: string[][];
  byRef: Map<string, string[]>;
  fileLabel: string;
};

export type RowCompareStatus = 'Same' | 'Changed' | 'Only in baseline' | 'Only in compare';

export type RowCompareSummary = {
  ref: string;
  status: RowCompareStatus;
  statusLabel: string;
  changedColumns: string[];
  rowBaseline: string[] | null;
  rowCompare: string[] | null;
};

export type CellChange = {
  ref: string;
  column: string;
  valueBaseline: string;
  valueCompare: string;
};

export type MatrixCompareResult = {
  fileBaseline: string;
  fileCompare: string;
  headers: string[];
  totalBaseline: number;
  totalCompare: number;
  same: number;
  changed: number;
  onlyBaseline: number;
  onlyCompare: number;
  rowSummaries: RowCompareSummary[];
  cellChanges: CellChange[];
  columnChangeCounts: { column: string; count: number }[];
};

function cellToString(value: unknown): string {
  if (value == null || value === '') return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'object') {
    const o = value as {
      richText?: { text: string }[];
      result?: unknown;
      text?: string;
    };
    if (o.richText) return o.richText.map((r) => r.text).join('');
    if ('result' in o && o.result != null) return cellToString(o.result);
    if (o.text) return String(o.text).trim();
  }
  return String(value).trim();
}

function refKey(headers: string[], row: string[]): string {
  const idx = headers.findIndex((h) => h.trim().toLowerCase() === 'ref');
  const col = idx >= 0 ? idx : 0;
  return (row[col] ?? '').trim();
}

function matrixFromRows(
  headers: string[],
  dataRows: string[][],
  fileLabel: string,
): ParsedMatrix {
  const byRef = new Map<string, string[]>();
  for (const row of dataRows) {
    const key = refKey(headers, row);
    if (!key) continue;
    byRef.set(key, row);
  }
  return { headers, rows: dataRows, byRef, fileLabel };
}

export async function parseUploadMatrixFile(file: File): Promise<ParsedMatrix> {
  const name = file.name;
  if (name.toLowerCase().endsWith('.csv')) {
    const text = await file.text();
    const parsed = parseCsvText(text);
    if (parsed.length < 2) {
      throw new Error(`${name}: CSV has no data rows.`);
    }
    const [headers, ...dataRows] = parsed;
    return matrixFromRows(headers, dataRows, name);
  }

  const ExcelJS = (await import('exceljs')).default;
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await file.arrayBuffer());
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new Error(`${name}: workbook has no sheets.`);

  const allRows: string[][] = [];
  sheet.eachRow((row) => {
    const values = row.values as unknown[];
    const cells = values.slice(1).map((v) => cellToString(v));
    if (cells.some((c) => c)) allRows.push(cells);
  });

  if (allRows.length < 2) {
    throw new Error(`${name}: Excel file has no data rows.`);
  }

  const [headers, ...dataRows] = allRows;
  return matrixFromRows(headers, dataRows, name);
}

function normCell(value: string): string {
  return normalizeMultiline(value);
}

function refSort(a: string, b: string): number {
  const pa = a.split(/[.-]/).map((x) => Number(x) || 0);
  const pb = b.split(/[.-]/).map((x) => Number(x) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d) return d;
  }
  return a.localeCompare(b);
}

function onlyInLabel(fileName: string): string {
  return `Only in ${fileName}`;
}

export function compareMatrixFiles(
  baseline: ParsedMatrix,
  compare: ParsedMatrix,
): MatrixCompareResult {
  const headers =
    baseline.headers.length >= compare.headers.length
      ? baseline.headers
      : compare.headers;
  const allRefs = new Set([...baseline.byRef.keys(), ...compare.byRef.keys()]);
  const sortedRefs = [...allRefs].sort(refSort);

  let same = 0;
  let changed = 0;
  let onlyBaseline = 0;
  let onlyCompare = 0;
  const rowSummaries: RowCompareSummary[] = [];
  const cellChanges: CellChange[] = [];
  const colCounts = new Map<string, number>();

  for (const ref of sortedRefs) {
    const rowBaseline = baseline.byRef.get(ref) ?? null;
    const rowCompare = compare.byRef.get(ref) ?? null;

    if (!rowBaseline) {
      onlyCompare++;
      rowSummaries.push({
        ref,
        status: 'Only in compare',
        statusLabel: onlyInLabel(compare.fileLabel),
        changedColumns: [],
        rowBaseline: null,
        rowCompare,
      });
      continue;
    }
    if (!rowCompare) {
      onlyBaseline++;
      rowSummaries.push({
        ref,
        status: 'Only in baseline',
        statusLabel: onlyInLabel(baseline.fileLabel),
        changedColumns: [],
        rowBaseline,
        rowCompare: null,
      });
      continue;
    }

    const changedCols: string[] = [];
    const colCount = Math.max(headers.length, rowBaseline.length, rowCompare.length);

    for (let i = 0; i < colCount; i++) {
      const colName = headers[i] ?? `Column ${i + 1}`;
      const va = normCell(rowBaseline[i] ?? '');
      const vb = normCell(rowCompare[i] ?? '');
      if (va !== vb) {
        changedCols.push(colName);
        colCounts.set(colName, (colCounts.get(colName) ?? 0) + 1);
        cellChanges.push({
          ref,
          column: colName,
          valueBaseline: va,
          valueCompare: vb,
        });
      }
    }

    if (changedCols.length > 0) {
      changed++;
      rowSummaries.push({
        ref,
        status: 'Changed',
        statusLabel: 'Changed',
        changedColumns: changedCols,
        rowBaseline,
        rowCompare,
      });
    } else {
      same++;
      rowSummaries.push({
        ref,
        status: 'Same',
        statusLabel: 'Same',
        changedColumns: [],
        rowBaseline,
        rowCompare,
      });
    }
  }

  const columnChangeCounts = [...colCounts.entries()]
    .map(([column, count]) => ({ column, count }))
    .sort((a, b) => b.count - a.count || a.column.localeCompare(b.column));

  return {
    fileBaseline: baseline.fileLabel,
    fileCompare: compare.fileLabel,
    headers,
    totalBaseline: baseline.byRef.size,
    totalCompare: compare.byRef.size,
    same,
    changed,
    onlyBaseline,
    onlyCompare,
    rowSummaries,
    cellChanges,
    columnChangeCounts,
  };
}

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

function sheetName(label: string, prefix: string): string {
  const base = label.replace(/\.[^.]+$/, '').slice(0, 20);
  const name = `${prefix} ${base}`.slice(0, 31);
  return name.replace(/[\\/*?:[\]]/g, '-');
}

function padRow(row: string[], len: number): string[] {
  const out = [...row];
  while (out.length < len) out.push('');
  return out.slice(0, len);
}

function buildSummarySheet(
  sheet: import('exceljs').Worksheet,
  result: MatrixCompareResult,
): void {
  const { fileBaseline: fb, fileCompare: fc } = result;
  const matched = result.same + result.changed;
  const totalUnique = result.rowSummaries.length;
  const matchPct =
    totalUnique > 0 ? ((result.same / totalUnique) * 100).toFixed(1) : '0.0';

  sheet.columns = [
    { width: 42 },
    { width: 18 },
    { width: 55 },
    { width: 55 },
  ];

  const stamp = new Date().toLocaleString();
  const lines: string[][] = [
    ['COMPARISON SUMMARY'],
    ['Generated', stamp],
    ['Baseline file', fb],
    ['Compare file', fc],
    [],
    ['Metric', 'Count', 'Notes'],
    [`Total records in "${fb}"`, String(result.totalBaseline), 'Rows with Ref'],
    [`Total records in "${fc}"`, String(result.totalCompare), 'Rows with Ref'],
    ['Refs in both files', String(matched), 'Matched by Ref column'],
    ['Same (all columns match)', String(result.same), `${matchPct}% of all refs`],
    [
      'Changed (one or more columns differ)',
      String(result.changed),
      `${result.cellChanges.length} cell-level differences`,
    ],
    [`Only in "${fb}"`, String(result.onlyBaseline), 'Ref missing in compare file'],
    [`Only in "${fc}"`, String(result.onlyCompare), 'Ref missing in baseline file'],
    [],
    ['CHANGES BY COLUMN'],
    ['Column', 'Records changed', ''],
  ];

  for (const line of lines) {
    const row = sheet.addRow(line);
    if (line[0]?.startsWith('COMPARISON') || line[0]?.startsWith('CHANGES')) {
      boldRow(row);
    }
    applyWrap(row);
  }

  if (result.columnChangeCounts.length === 0) {
    applyWrap(sheet.addRow(['(no column changes)', '0', '']));
  } else {
    for (const { column, count } of result.columnChangeCounts) {
      applyWrap(sheet.addRow([column, String(count), '']));
    }
  }
}

function buildSideBySideSheet(
  sheet: import('exceljs').Worksheet,
  result: MatrixCompareResult,
): void {
  const { fileBaseline: fb, fileCompare: fc, headers } = result;
  const headRow = [
    'Ref',
    'Status',
    '# Cols changed',
    'Changed columns',
    ...headers.flatMap((h) => [`${h} — ${fb}`, `${h} — ${fc}`]),
  ];
  sheet.columns = headRow.map((_, i) => ({
    width: i === 0 ? 14 : i < 4 ? 22 : 40,
  }));
  const sideHead = sheet.addRow(headRow);
  applyWrap(sideHead);
  boldRow(sideHead);

  for (const row of result.rowSummaries) {
    const base = padRow(row.rowBaseline ?? [], headers.length);
    const cmp = padRow(row.rowCompare ?? [], headers.length);
    const sideBySide = headers.flatMap((_, i) => [base[i] ?? '', cmp[i] ?? '']);
    applyWrap(
      sheet.addRow([
        row.ref,
        row.statusLabel,
        String(row.changedColumns.length),
        row.changedColumns.join('; ') || '—',
        ...sideBySide,
      ]),
    );
  }
}

function buildChangedDetailSheet(
  sheet: import('exceljs').Worksheet,
  result: MatrixCompareResult,
): void {
  const { fileBaseline: fb, fileCompare: fc, headers } = result;
  sheet.columns = [
    { width: 14 },
    { width: 28 },
    { width: 45 },
    { width: 45 },
    { width: 12 },
  ];

  const changedRows = result.rowSummaries.filter((r) => r.status === 'Changed');

  for (const record of changedRows) {
    const refHead = sheet.addRow([`Ref ${record.ref}`, record.statusLabel]);
    applyWrap(refHead);
    boldRow(refHead);
    const colHead = sheet.addRow(['Column', fb, fc, 'Result']);
    applyWrap(colHead);
    boldRow(colHead);

    const base = padRow(record.rowBaseline ?? [], headers.length);
    const cmp = padRow(record.rowCompare ?? [], headers.length);

    for (let i = 0; i < headers.length; i++) {
      const col = headers[i];
      const va = base[i] ?? '';
      const vb = cmp[i] ?? '';
      const same = normCell(va) === normCell(vb);
      applyWrap(
        sheet.addRow([col, va, vb, same ? 'Same' : 'CHANGED']),
      );
    }
    applyWrap(sheet.addRow([]));
  }

  if (changedRows.length === 0) {
    applyWrap(sheet.addRow(['No changed records — all matched refs are identical.']));
  }
}

function buildCellChangesSheet(
  sheet: import('exceljs').Worksheet,
  result: MatrixCompareResult,
): void {
  const { fileBaseline: fb, fileCompare: fc } = result;
  sheet.columns = [
    { width: 14 },
    { width: 28 },
    { width: 45 },
    { width: 45 },
  ];
  const cellHead = sheet.addRow(['Ref', 'Column', fb, fc]);
  applyWrap(cellHead);
  boldRow(cellHead);

  for (const ch of result.cellChanges) {
    applyWrap(
      sheet.addRow([ch.ref, ch.column, ch.valueBaseline, ch.valueCompare]),
    );
  }

  if (result.cellChanges.length === 0) {
    applyWrap(sheet.addRow(['(no cell differences)', '', '', '']));
  }
}

function buildOnlyInSheet(
  sheet: import('exceljs').Worksheet,
  result: MatrixCompareResult,
  which: 'baseline' | 'compare',
): void {
  const fileName =
    which === 'baseline' ? result.fileBaseline : result.fileCompare;
  const rows = result.rowSummaries.filter((r) =>
    which === 'baseline'
      ? r.status === 'Only in baseline'
      : r.status === 'Only in compare',
  );

  const head = ['Ref', ...result.headers.filter((h) => h.trim().toLowerCase() !== 'ref')];
  sheet.columns = head.map((_, i) => ({ width: i === 0 ? 14 : 40 }));
  const onlyHead = sheet.addRow(head);
  applyWrap(onlyHead);
  boldRow(onlyHead);

  for (const record of rows) {
    const raw = which === 'baseline' ? record.rowBaseline : record.rowCompare;
    const data = padRow(raw ?? [], result.headers.length);
    const refIdx = result.headers.findIndex(
      (h) => h.trim().toLowerCase() === 'ref',
    );
    const values = result.headers
      .map((_, i) => data[i] ?? '')
      .filter((_, i) => i !== refIdx);
    applyWrap(sheet.addRow([record.ref, ...values]));
  }

  if (rows.length === 0) {
    applyWrap(
      sheet.addRow([`No records found only in "${fileName}".`]),
    );
  }
}

export async function downloadMatrixCompareExcel(
  result: MatrixCompareResult,
  filename: string,
): Promise<void> {
  const ExcelJS = (await import('exceljs')).default;
  const workbook = new ExcelJS.Workbook();

  buildSummarySheet(workbook.addWorksheet('Summary'), result);
  buildSideBySideSheet(workbook.addWorksheet('Side by Side'), result);
  buildChangedDetailSheet(workbook.addWorksheet('Changed Detail'), result);
  buildCellChangesSheet(workbook.addWorksheet('Cell Changes'), result);
  buildOnlyInSheet(
    workbook.addWorksheet(sheetName(result.fileBaseline, 'Only in')),
    result,
    'baseline',
  );
  buildOnlyInSheet(
    workbook.addWorksheet(sheetName(result.fileCompare, 'Only in')),
    result,
    'compare',
  );

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

export function compareReportFilename(
  baselineName?: string,
  compareName?: string,
): string {
  const stamp = new Date().toISOString().slice(0, 10);
  if (baselineName && compareName) {
    const a = baselineName.replace(/\.[^.]+$/, '').slice(0, 20);
    const b = compareName.replace(/\.[^.]+$/, '').slice(0, 20);
    return `Compare_${a}_vs_${b}_${stamp}.xlsx`;
  }
  return `TFS_Matrix_Compare_Report-${stamp}.xlsx`;
}
