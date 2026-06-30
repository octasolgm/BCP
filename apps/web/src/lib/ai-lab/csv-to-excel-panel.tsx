'use client';

import { useRef, useState } from 'react';
import {
  downloadCsvAsExcel,
  looksLikeMatrixCsv,
  matrixCsvFilename,
  parseCsvText,
} from './csv-to-excel';

export function CsvToExcelPanel() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState('');
  const [rowCount, setRowCount] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setError('');
    setRowCount(null);
    const file = e.target.files?.[0];
    if (!file) {
      setFileName('');
      return;
    }
    setFileName(file.name);
    try {
      const text = await file.text();
      const rows = parseCsvText(text);
      if (rows.length > 1) {
        setRowCount(rows.length - 1);
        if (!looksLikeMatrixCsv(rows[0])) {
          setError(
            'This CSV does not look like the TFS matrix template — export will still use your exact columns and rows.',
          );
        }
      }
    } catch {
      setError('Could not read the CSV file.');
    }
  }

  async function convertToExcel() {
    const file = inputRef.current?.files?.[0];
    if (!file) {
      setError('Choose a .csv file first (e.g. TFS_Section2_Compliance_Matrix.csv).');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const text = await file.text();
      const outName = file.name.replace(/\.csv$/i, '') + '.xlsx';
      const { rowCount: n } = await downloadCsvAsExcel(text, outName);
      setRowCount(n);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Conversion failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-xl border border-sky-300 bg-sky-50/90 p-4 shadow-sm">
      <h2 className="text-sm font-semibold text-sky-950">
        CSV → Excel (exact file)
      </h2>
      <p className="mt-1 text-xs leading-relaxed text-sky-900/90">
        <strong>Yes — exact records.</strong> Every column and every row from
        your CSV is copied into the .xlsx file unchanged (Ref, Requirement
        Area, evidence, status, confidence, gap notes). Only the file format
        changes from .csv to .xlsx; no compare and no data edits.
      </p>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <div className="min-w-[220px] flex-1">
          <label className="mb-1 block text-xs font-medium text-sky-900">
            Choose CSV file
          </label>
          <input
            ref={inputRef}
            type="file"
            accept=".csv,text/csv"
            onChange={onFileChange}
            className="block w-full text-xs text-slate-700 file:mr-2 file:rounded file:border-0 file:bg-sky-600 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-white hover:file:bg-sky-700"
          />
        </div>
        <button
          type="button"
          onClick={convertToExcel}
          disabled={busy}
          className="rounded-md border border-sky-600 bg-sky-600 px-4 py-2 text-xs font-semibold text-white hover:bg-sky-700 disabled:opacity-50"
        >
          {busy ? 'Converting…' : 'Convert CSV to Excel'}
        </button>
      </div>
      {fileName && rowCount !== null && !error.startsWith('Could not') && (
        <p className="mt-2 text-xs text-sky-800">
          {fileName}: {rowCount} data row{rowCount === 1 ? '' : 's'} ready to
          export as .xlsx
        </p>
      )}
      {error && (
        <p className="mt-2 text-xs text-amber-900">{error}</p>
      )}
      <p className="mt-2 text-[11px] text-sky-800/80">
        Expected columns: Ref · Requirement Area · Granular Sub-Requirement ·
        Evidence IMPTFS · Evidence SCP · Compliance Status · Confidence % · Gap
        Note
      </p>
    </section>
  );
}

export { matrixCsvFilename };
