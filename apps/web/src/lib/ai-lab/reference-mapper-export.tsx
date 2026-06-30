'use client';

import { useState } from 'react';
import { downloadReferenceMapperPdf } from './export-reference-mapper-pdf';

export function DownloadMapperPdfButton({
  message,
  referenceFileNames,
  sourceFiles,
  label = 'Download annotated PDF',
}: {
  message: string;
  referenceFileNames: string[];
  sourceFiles?: FileList | File[] | null;
  label?: string;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function download() {
    if (!message?.trim()) return;
    setLoading(true);
    setError('');
    try {
      const files = sourceFiles
        ? Array.from(sourceFiles as FileList | File[])
        : [];
      await downloadReferenceMapperPdf({
        message,
        referenceFileNames,
        sourceFiles: files,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'PDF export failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="inline-flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={download}
        disabled={loading || !message?.trim()}
        className="rounded-md border border-indigo-400 bg-indigo-600 px-3 py-1 text-xs font-medium text-white shadow-sm hover:bg-indigo-700 disabled:opacity-40"
      >
        {loading ? 'Building PDF…' : label}
      </button>
      {error && (
        <span className="max-w-sm text-right text-[10px] leading-snug text-red-600">
          {error}
        </span>
      )}
    </div>
  );
}
