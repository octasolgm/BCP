import { downloadExcelRows } from './excel-write';
import { MATRIX_COLUMN_HEADERS } from './export-matrix-excel';

const MATRIX_COL_WIDTHS = [10, 28, 55, 45, 45, 16, 12, 45];

/** Parse RFC-style quoted CSV into rows of fields. */
export function parseCsvText(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];

    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
      continue;
    }

    if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\r') {
      if (text[i + 1] === '\n') i++;
      row.push(field);
      if (row.some((cell) => cell.trim())) rows.push(row);
      row = [];
      field = '';
    } else if (c === '\n') {
      row.push(field);
      if (row.some((cell) => cell.trim())) rows.push(row);
      row = [];
      field = '';
    } else {
      field += c;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    if (row.some((cell) => cell.trim())) rows.push(row);
  }

  return rows;
}

export async function downloadCsvAsExcel(
  csvText: string,
  filename: string,
  sheetName = 'TFS Section 2 Matrix',
): Promise<{ rowCount: number }> {
  const parsed = parseCsvText(csvText.trim());
  if (parsed.length === 0) {
    throw new Error('CSV file is empty or could not be parsed.');
  }

  const [headers, ...dataRows] = parsed;
  if (!headers?.length) {
    throw new Error('CSV must include a header row.');
  }

  await downloadExcelRows(
    filename,
    sheetName,
    headers,
    dataRows,
    headers.map((_, i) => MATRIX_COL_WIDTHS[i] ?? 30),
  );

  return { rowCount: dataRows.length };
}

export function matrixCsvFilename(): string {
  const stamp = new Date().toISOString().slice(0, 10);
  return `TFS_Section2_Compliance_Matrix-${stamp}.xlsx`;
}

/** True if first header cell looks like the TFS matrix template. */
export function looksLikeMatrixCsv(headers: string[]): boolean {
  const h = headers.join(' ').toLowerCase();
  return h.includes('ref') && h.includes('requirement area');
}

export { MATRIX_COLUMN_HEADERS };
