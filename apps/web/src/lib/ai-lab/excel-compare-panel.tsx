'use client';

import { useRef, useState } from 'react';
import {
  compareMatrixFiles,
  compareReportFilename,
  downloadMatrixCompareExcel,
  parseUploadMatrixFile,
  type MatrixCompareResult,
} from './excel-compare';

export function ExcelComparePanel() {
  const baselineRef = useRef<HTMLInputElement>(null);
  const compareRef = useRef<HTMLInputElement>(null);
  const [baselineName, setBaselineName] = useState('');
  const [compareName, setCompareName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<MatrixCompareResult | null>(null);

  async function runCompare() {
    const baselineFile = baselineRef.current?.files?.[0];
    const compareFile = compareRef.current?.files?.[0];
    if (!baselineFile || !compareFile) {
      setError('Choose both files (.xlsx or .csv).');
      return;
    }

    setBusy(true);
    setError('');
    setPreview(null);
    try {
      const [matrixBaseline, matrixCompare] = await Promise.all([
        parseUploadMatrixFile(baselineFile),
        parseUploadMatrixFile(compareFile),
      ]);
      const result = compareMatrixFiles(matrixBaseline, matrixCompare);
      setPreview(result);
      await downloadMatrixCompareExcel(
        result,
        compareReportFilename(baselineFile.name, compareFile.name),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Compare failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-xl border border-violet-300 bg-violet-50/90 p-4 shadow-sm">
      <h2 className="text-sm font-semibold text-violet-950">
        Compare 2 Excel / CSV files
      </h2>
      <p className="mt-1 text-xs leading-relaxed text-violet-900/90">
        Upload two matrix files (matched by <strong>Ref</strong>). The Excel
        report uses your <strong>actual file names</strong> everywhere and
        includes: summary, side-by-side all columns, per-record changed detail,
        cell-level diffs, and full rows only in one file.
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-violet-900">
            Baseline file
          </label>
          <input
            ref={baselineRef}
            type="file"
            accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
            onChange={(e) =>
              setBaselineName(e.target.files?.[0]?.name ?? '')
            }
            className="block w-full text-xs text-slate-700 file:mr-2 file:rounded file:border-0 file:bg-violet-600 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-white"
          />
          {baselineName && (
            <p className="mt-1 truncate text-[11px] text-violet-800">
              {baselineName}
            </p>
          )}
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-violet-900">
            Compare file
          </label>
          <input
            ref={compareRef}
            type="file"
            accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
            onChange={(e) => setCompareName(e.target.files?.[0]?.name ?? '')}
            className="block w-full text-xs text-slate-700 file:mr-2 file:rounded file:border-0 file:bg-violet-600 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-white"
          />
          {compareName && (
            <p className="mt-1 truncate text-[11px] text-violet-800">
              {compareName}
            </p>
          )}
        </div>
      </div>
      <button
        type="button"
        onClick={runCompare}
        disabled={busy}
        className="mt-3 rounded-md border border-violet-600 bg-violet-600 px-4 py-2 text-xs font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
      >
        {busy ? 'Comparing…' : 'Compare & download Excel report'}
      </button>

      {preview && (
        <div className="mt-3 rounded-lg border border-violet-200 bg-white/80 p-3 text-xs text-violet-950">
          <p className="font-semibold">Last compare</p>
          <p className="mt-1 text-[11px] text-violet-800">
            <span className="font-medium">{preview.fileBaseline}</span>
            {' vs '}
            <span className="font-medium">{preview.fileCompare}</span>
          </p>
          <ul className="mt-2 space-y-0.5">
            <li>Same: {preview.same}</li>
            <li>Changed: {preview.changed}</li>
            <li>
              Only in &quot;{preview.fileBaseline}&quot;: {preview.onlyBaseline}
            </li>
            <li>
              Only in &quot;{preview.fileCompare}&quot;: {preview.onlyCompare}
            </li>
            <li>Cell-level changes: {preview.cellChanges.length}</li>
          </ul>
          <p className="mt-2 text-[11px] text-violet-700">
            Report sheets: Summary · Side by Side · Changed Detail · Cell
            Changes · Only in [each file name]
          </p>
        </div>
      )}

      {error && <p className="mt-2 text-xs text-red-800">{error}</p>}
    </section>
  );
}
