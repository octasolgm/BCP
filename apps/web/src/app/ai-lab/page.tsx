'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
const DEFAULT_PDF_URL = '/default-docs/imptfs.pdf';
const DEFAULT_PDF_NAME = 'I M P T F S.pdf';

const DEFAULT_PROMPT = `You are an expert automated regulatory compliance auditor specializing in CBUAE and TFS frameworks. Your task is to evaluate the provided requirement point against the attached Internal Process Document PDF file, perform a strict gap analysis, and output the results in a highly specific text format.

CRITICAL EVALUATION LAWS:
1. DEEP SEMANTIC MATCHING: Perform a strict semantic analysis comparing the provided text under "REQUIREMENT POINT TO CHECK" against the contents of the attached internal PDF. Look for literal matching concepts, operational frameworks, or direct procedural overlaps.
2. EXACT SOURCE CITATION: In the "Output/Response" field, you MUST locate where the evidence is found in the attached document. Format it precisely as: "Page [X], Section [Y]: '[Exact verbatim quote of the matching sentence or procedure]'". If the requirement is Non-Compliant, output exactly: "No corresponding procedure found."
3. COMPLIANCE STATUS MATRIX: Assign status based on the following rules:
   - "Compliant": The internal PDF fully covers all operational mandates stated in the requirement text.
   - "Partial Compliant": The internal PDF covers some aspects, but leaves out critical conditions, sub-bullets, or specific requirements.
   - "Non-Compliant": There is no procedural mention or matching evidence in the internal document.
4. STRICT CONFIDENCE SCORING: You must be extremely strict with the \`Compliance Confidence %\`. DO NOT default to 100%. Analyze every small sub-point and condition in the requirement. If the internal document misses even a single minor condition, uses vague language, or only partially covers a bullet point, you must deduct points. 100% is reserved ONLY for absolute, flawless, comprehensive coverage.
5. GAP ANALYSIS & ACTIONABILITY: If an item is Partial Compliant or Non-Compliant, you must provide a clear "Corrective Action Plan" to fulfill the missing requirements, alongside a "Responsibility" assignment (e.g., Compliance Team, IT Security).

ABSOLUTE SYSTEM OUTPUT MATRIX (ZERO EXCEPTION):
- Do NOT output JSON.
- You must generate the output EXACTLY matching the text structure below.
- Do not include any conversational filler before or after the output block.

[Paste Requirement ID] [Paste Requirement Title]
[Paste Full Requirement Text]

Output/Response :
[Page Number, Section: 'Exact Quote']

Comply Yes/No (Status) : [Compliant / Partial Compliant / Non-Compliant]
Compliance Confidence % : [0-100]%
Corrective Action Plan : [Outline the clear operational step the institution must execute to fix the gap. If Compliant, output 'N/A']
Responsibility : [Identify the department responsible for executing the corrective action. If Compliant, output 'N/A']

---
INPUT DATA:

REQUIREMENT POINT TO CHECK:

`;

const AI_MODELS = [
  'gemini-3.5-flash',
  'gpt-3.5-turbo',
  'gpt-4o-mini',
  'gpt-4o',
  'gpt-5',
  'gemini-3.1-pro-preview',
  'gemini-2.5-flash-lite',
  'gemini-2.5-flash',
];

const COMPLIANCE_FIELD_REGEX =
  /^(Output\/Response|Comply Yes\/No \(Status\)|Compliance Confidence %|Corrective Action Plan|Responsibility)\s*:\s*(.*)$/;

type Tab = 'analyze' | 'extract';

type ApiResponse = Record<string, unknown>;

type ComplianceBlock = {
  title: string;
  body: string;
  fields: { label: string; value: string }[];
};

function parseComplianceBlock(block: string): ComplianceBlock {
  const lines = block.split('\n');
  const fields: { label: string; value: string }[] = [];
  const headerLines: string[] = [];
  let currentField: { label: string; valueLines: string[] } | null = null;

  for (const line of lines) {
    const match = line.match(COMPLIANCE_FIELD_REGEX);
    if (match) {
      if (currentField) {
        fields.push({
          label: currentField.label,
          value: currentField.valueLines.join('\n').trim(),
        });
      }
      currentField = {
        label: match[1],
        valueLines: match[2] ? [match[2]] : [],
      };
    } else if (currentField) {
      currentField.valueLines.push(line);
    } else {
      headerLines.push(line);
    }
  }

  if (currentField) {
    fields.push({
      label: currentField.label,
      value: currentField.valueLines.join('\n').trim(),
    });
  }

  const nonEmptyHeader = headerLines.filter((l) => l.trim());
  return {
    title: nonEmptyHeader[0]?.trim() ?? '',
    body: nonEmptyHeader.slice(1).join('\n').trim(),
    fields,
  };
}

function looksLikeComplianceText(text: string): boolean {
  return text.split('\n').some((line) => COMPLIANCE_FIELD_REGEX.test(line));
}

function parseComplianceText(text: string): ComplianceBlock[] {
  const chunks = text.split(/\n---\n/).map((s) => s.trim()).filter(Boolean);
  const blocks = chunks.map(parseComplianceBlock).filter(
    (b) => b.title || b.body || b.fields.length > 0,
  );
  if (blocks.some((b) => b.fields.length > 0)) {
    return blocks;
  }
  const single = parseComplianceBlock(text.trim());
  return single.fields.length > 0 ? [single] : [];
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function complianceBlockToPlainText(block: ComplianceBlock): string {
  const parts: string[] = [];
  if (block.title) parts.push(block.title);
  if (block.body) parts.push(block.body);
  for (const field of block.fields) {
    parts.push(`${field.label} :`);
    parts.push(field.value || '—');
  }
  return parts.join('\n\n');
}

function complianceBlockToHtml(block: ComplianceBlock): string {
  const parts: string[] = ['<div>'];
  if (block.title) {
    parts.push(`<h2><strong>${escapeHtml(block.title)}</strong></h2>`);
  }
  if (block.body) {
    parts.push(`<p>${escapeHtml(block.body).replace(/\n/g, '<br>')}</p>`);
  }
  for (const field of block.fields) {
    parts.push(
      `<p><strong>${escapeHtml(field.label)} :</strong><br>${escapeHtml(field.value || '—').replace(/\n/g, '<br>')}</p>`,
    );
  }
  parts.push('</div>');
  return parts.join('');
}

function complianceTextToPlainText(text: string): string {
  const blocks = parseComplianceText(text);
  if (blocks.length === 0) return text;
  return blocks.map(complianceBlockToPlainText).join('\n\n---\n\n');
}

function complianceTextToHtml(text: string): string {
  const blocks = parseComplianceText(text);
  if (blocks.length === 0) {
    return `<p>${escapeHtml(text).replace(/\n/g, '<br>')}</p>`;
  }
  return blocks.map(complianceBlockToHtml).join('<hr>');
}

function objectItemToClipboard(
  item: Record<string, unknown>,
  index: number,
): { plain: string; html: string } {
  const heading = getHeading(item, index);
  const bodyKeys = ['content', 'text', 'description', 'body', 'point_text'];
  const headingKeys = new Set([
    'number',
    'point_number',
    'article',
    'id',
    'title',
    'name',
    ...bodyKeys,
  ]);
  const bodyField = bodyKeys.find((k) => item[k] != null && String(item[k]).trim());
  const otherEntries = Object.entries(item).filter(
    ([k, v]) => !headingKeys.has(k) && v != null && String(v).trim() !== '',
  );

  const plainParts = [heading];
  const htmlParts = [
    `<div><h2><strong>${escapeHtml(heading)}</strong></h2>`,
  ];

  if (bodyField) {
    const body = String(item[bodyField]);
    plainParts.push(body);
    htmlParts.push(`<p>${escapeHtml(body).replace(/\n/g, '<br>')}</p>`);
  }

  for (const [key, value] of otherEntries) {
    const label = labelKey(key);
    const text =
      typeof value === 'object' ? JSON.stringify(value) : String(value);
    plainParts.push(`${label}:`);
    plainParts.push(text);
    htmlParts.push(
      `<p><strong>${escapeHtml(label)}:</strong><br>${escapeHtml(text).replace(/\n/g, '<br>')}</p>`,
    );
  }

  if (!bodyField && otherEntries.length === 0) {
    for (const [key, value] of Object.entries(item).filter(
      ([, v]) => v != null && String(v).trim() !== '',
    )) {
      const label = labelKey(key);
      const text = String(value);
      plainParts.push(`${label}:`);
      plainParts.push(text);
      htmlParts.push(
        `<p><strong>${escapeHtml(label)}:</strong> ${escapeHtml(text)}</p>`,
      );
    }
  }

  htmlParts.push('</div>');
  return { plain: plainParts.join('\n\n'), html: htmlParts.join('') };
}

function formatItemForClipboard(
  item: unknown,
  index: number,
): { plain: string; html: string } {
  if (typeof item === 'string') {
    if (looksLikeComplianceText(item)) {
      return {
        plain: complianceTextToPlainText(item),
        html: complianceTextToHtml(item),
      };
    }
    return {
      plain: item,
      html: `<p>${escapeHtml(item).replace(/\n/g, '<br>')}</p>`,
    };
  }

  if (typeof item === 'object' && item !== null) {
    return objectItemToClipboard(item as Record<string, unknown>, index);
  }

  const text = String(item);
  return { plain: text, html: `<p>${escapeHtml(text)}</p>` };
}

function messageToFormattedClipboard(message: unknown): {
  plain: string;
  html: string;
} {
  if (message === null || message === undefined) {
    return { plain: '', html: '' };
  }

  if (typeof message === 'string') {
    if (looksLikeComplianceText(message)) {
      return {
        plain: complianceTextToPlainText(message),
        html: complianceTextToHtml(message),
      };
    }
    return {
      plain: message,
      html: `<p>${escapeHtml(message).replace(/\n/g, '<br>')}</p>`,
    };
  }

  if (Array.isArray(message)) {
    const parts = message.map((item, i) => formatItemForClipboard(item, i));
    return {
      plain: parts.map((p) => p.plain).join('\n\n---\n\n'),
      html: parts.map((p) => p.html).join('<hr>'),
    };
  }

  if (typeof message === 'object') {
    return formatItemForClipboard(message, 0);
  }

  const text = String(message);
  return { plain: text, html: `<p>${escapeHtml(text)}</p>` };
}

function CopyButton({
  message,
  onCopySuccess,
}: {
  message: unknown;
  onCopySuccess?: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const { plain, html } = messageToFormattedClipboard(message);

  function notifyCopied() {
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    onCopySuccess?.();
  }

  async function copy() {
    if (!plain) return;
    try {
      if (typeof ClipboardItem !== 'undefined') {
        await navigator.clipboard.write([
          new ClipboardItem({
            'text/plain': new Blob([plain], { type: 'text/plain' }),
            'text/html': new Blob([html], { type: 'text/html' }),
          }),
        ]);
      } else {
        await navigator.clipboard.writeText(plain);
      }
      notifyCopied();
    } catch {
      try {
        await navigator.clipboard.writeText(plain);
        notifyCopied();
      } catch {
        /* clipboard unavailable */
      }
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      disabled={!plain}
      className="rounded-md border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-40"
    >
      {copied ? 'Copied' : 'Copy formatted'}
    </button>
  );
}

function ComplianceTextView({ text }: { text: string }) {
  const blocks = parseComplianceText(text);

  if (blocks.length === 0) {
    return (
      <div className="whitespace-pre-wrap text-sm leading-relaxed text-slate-800">
        {text}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {blocks.map((block, i) => (
        <article
          key={i}
          className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
        >
          {block.title && (
            <h2 className="mb-2 text-lg font-bold text-violet-900">
              {block.title}
            </h2>
          )}
          {block.body && (
            <p className="mb-4 whitespace-pre-wrap text-sm leading-relaxed text-slate-800">
              {block.body}
            </p>
          )}
          {block.fields.length > 0 && (
            <dl className="space-y-3 border-t border-slate-100 pt-3">
              {block.fields.map((field) => (
                <div key={field.label}>
                  <dt className="text-sm font-bold text-slate-900">
                    {field.label} :
                  </dt>
                  <dd className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                    {field.value || '—'}
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </article>
      ))}
    </div>
  );
}

function labelKey(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function getHeading(obj: Record<string, unknown>, index: number): string {
  const number = obj.number ?? obj.point_number ?? obj.article ?? obj.id;
  const title = obj.title ?? obj.name;
  if (number && title) return `${number} — ${title}`;
  if (number) return String(number);
  if (title) return String(title);
  return `Item ${index + 1}`;
}

function MessageBlock({
  item,
  index,
}: {
  item: unknown;
  index: number;
}) {
  if (typeof item === 'string') {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <p className="text-sm leading-relaxed text-slate-800">{item}</p>
      </div>
    );
  }

  if (typeof item !== 'object' || item === null) {
    return <p className="text-sm text-slate-700">{String(item)}</p>;
  }

  const obj = item as Record<string, unknown>;
  const heading = getHeading(obj, index);
  const bodyKeys = ['content', 'text', 'description', 'body', 'point_text'];
  const headingKeys = new Set([
    'number',
    'point_number',
    'article',
    'id',
    'title',
    'name',
    ...bodyKeys,
  ]);

  const bodyField = bodyKeys.find((k) => obj[k] != null && String(obj[k]).trim());
  const otherEntries = Object.entries(obj).filter(
    ([k, v]) => !headingKeys.has(k) && v != null && String(v).trim() !== '',
  );

  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="mb-3 border-b border-slate-100 pb-2 text-lg font-semibold text-violet-800">
        {heading}
      </h2>
      {bodyField && (
        <p className="mb-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-800">
          {String(obj[bodyField])}
        </p>
      )}
      {otherEntries.length > 0 && (
        <ul className="mt-2 space-y-1 border-t border-slate-100 pt-3 text-sm text-slate-700">
          {otherEntries.map(([key, value]) => (
            <li key={key}>
              <span className="font-medium text-slate-900">{labelKey(key)}:</span>{' '}
              {typeof value === 'object'
                ? JSON.stringify(value)
                : String(value)}
            </li>
          ))}
        </ul>
      )}
      {!bodyField && otherEntries.length === 0 && (
        <ul className="space-y-1 text-sm text-slate-700">
          {Object.entries(obj)
            .filter(([, v]) => v != null && String(v).trim() !== '')
            .map(([key, value]) => (
              <li key={key}>
                <span className="font-medium text-slate-900">{labelKey(key)}:</span>{' '}
                {String(value)}
              </li>
            ))}
        </ul>
      )}
    </article>
  );
}

function FormattedMessage({ message }: { message: unknown }) {
  if (message === null || message === undefined) {
    return <p className="text-sm italic text-slate-500">No message in response.</p>;
  }

  if (typeof message === 'string') {
    if (looksLikeComplianceText(message)) {
      return <ComplianceTextView text={message} />;
    }
    return (
      <div className="whitespace-pre-wrap text-sm leading-relaxed text-slate-800">
        {message}
      </div>
    );
  }

  if (Array.isArray(message)) {
    return (
      <div className="space-y-4">
        {message.map((item, i) => (
          <MessageBlock key={i} item={item} index={i} />
        ))}
      </div>
    );
  }

  if (typeof message === 'object') {
    return <MessageBlock item={message} index={0} />;
  }

  return <p className="text-sm text-slate-800">{String(message)}</p>;
}

function assignFileInput(input: HTMLInputElement, fileList: FileList) {
  const dt = new DataTransfer();
  Array.from(fileList).forEach((file) => dt.items.add(file));
  input.files = dt.files;
}

function getFormattedContent(
  tab: Tab,
  data: ApiResponse,
): unknown {
  if (tab === 'analyze') {
    return data.message;
  }
  return data.combinedText ?? data.message;
}

export default function AiLabPage() {
  const [tab, setTab] = useState<Tab>('analyze');
  const [prompt, setPrompt] = useState(DEFAULT_PROMPT);
  const [aiModel, setAiModel] = useState('gemini-3.5-flash');
  const [files, setFiles] = useState<FileList | null>(null);
  const [defaultFileLabel, setDefaultFileLabel] = useState<string | null>(null);
  const [defaultFileError, setDefaultFileError] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [apiResponse, setApiResponse] = useState<ApiResponse | null>(null);
  const [error, setError] = useState<string>('');
  const [cancelled, setCancelled] = useState(false);
  const [focusPromptEnd, setFocusPromptEnd] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const promptRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const el = promptRef.current;
    if (!el) return;
    el.focus();
    const end = el.value.length;
    el.setSelectionRange(end, end);
  }, []);

  useEffect(() => {
    if (!focusPromptEnd) return;
    const el = promptRef.current;
    if (!el) return;
    const end = el.value.length;
    el.focus();
    el.setSelectionRange(end, end);
    setFocusPromptEnd(false);
  }, [focusPromptEnd, prompt]);

  useEffect(() => {
    let cancelled = false;

    async function loadDefaultPdf() {
      try {
        const res = await fetch(DEFAULT_PDF_URL);
        if (!res.ok) {
          if (!cancelled) {
            setDefaultFileError('Default PDF not found (public/default-docs/imptfs.pdf)');
          }
          return;
        }

        const blob = await res.blob();
        const file = new File([blob], DEFAULT_PDF_NAME, {
          type: 'application/pdf',
        });
        const dt = new DataTransfer();
        dt.items.add(file);

        if (cancelled) return;

        setFiles(dt.files);
        setDefaultFileLabel(DEFAULT_PDF_NAME);
        setDefaultFileError('');

        requestAnimationFrame(() => {
          if (fileInputRef.current) {
            assignFileInput(fileInputRef.current, dt.files);
          }
        });
      } catch {
        if (!cancelled) {
          setDefaultFileError('Could not load default PDF');
        }
      }
    }

    loadDefaultPdf();
    return () => {
      cancelled = true;
    };
  }, []);

  function cancelRun() {
    abortRef.current?.abort();
    abortRef.current = null;
    setLoading(false);
    setCancelled(true);
    setError('');
  }

  function resetPromptToDefault() {
    setPrompt(DEFAULT_PROMPT);
    setFocusPromptEnd(true);
  }

  async function runAnalyze() {
    if (!prompt.trim()) {
      setError('Prompt is required');
      return;
    }
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError('');
    setCancelled(false);
    setApiResponse(null);
    try {
      const form = new FormData();
      form.append('prompt', prompt);
      form.append('aiModel', aiModel);
      if (files) {
        Array.from(files).forEach((f, i) => {
          form.append(i === 0 ? 'file' : 'files', f);
        });
      }
      const res = await fetch(`${API_BASE}/ai/bcpanalyze`, {
        method: 'POST',
        body: form,
        signal: controller.signal,
      });
      const data = (await res.json()) as ApiResponse;
      if (!res.ok) {
        setError(JSON.stringify(data, null, 2));
      } else {
        setApiResponse(data);
        resetPromptToDefault();
      }
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') {
        setCancelled(true);
      } else {
        setError(e instanceof Error ? e.message : 'Request failed');
      }
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
      }
      setLoading(false);
    }
  }

  async function runExtract() {
    if (!files?.length) {
      setError('Select at least one PDF');
      return;
    }
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError('');
    setCancelled(false);
    setApiResponse(null);
    try {
      const form = new FormData();
      Array.from(files).forEach((f, i) => {
        form.append(i === 0 ? 'file' : 'files', f);
      });
      const res = await fetch(`${API_BASE}/ai/extractpdf`, {
        method: 'POST',
        body: form,
        signal: controller.signal,
      });
      const data = (await res.json()) as ApiResponse;
      if (!res.ok) {
        setError(JSON.stringify(data, null, 2));
      } else {
        setApiResponse(data);
      }
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') {
        setCancelled(true);
      } else {
        setError(e instanceof Error ? e.message : 'Request failed');
      }
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
      }
      setLoading(false);
    }
  }

  const formattedContent = apiResponse
    ? getFormattedContent(tab, apiResponse)
    : null;

  return (
    <main className="mx-auto max-w-7xl p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-slate-900">AI Lab</h1>
        <p className="text-slate-600">
          Test analyze &amp; extract APIs —{' '}
          <Link href="/ai-lab-batch" className="text-indigo-600 underline">
            Batch mode
          </Link>
          {' · '}
          <Link href="/ai-lab-extract" className="text-emerald-700 underline">
            Extract points
          </Link>
          {' · '}
          <Link href="/ai-lab-reference" className="text-sky-700 underline">
            Reference mapper
          </Link>
          {' · '}
          <Link href="/ai-lab-report" className="text-amber-700 underline">
            Report
          </Link>
          {' · '}
          <a
            href={`${API_BASE}/ai/swagger`}
            target="_blank"
            rel="noreferrer"
            className="text-blue-600 underline"
          >
            Open API Swagger
          </a>
        </p>
      </div>

      <div className="mb-4 flex gap-2">
        <button
          type="button"
          onClick={() => {
            cancelRun();
            setTab('analyze');
            setApiResponse(null);
            setError('');
            setCancelled(false);
          }}
          className={`rounded-lg px-4 py-2 text-sm font-medium ${
            tab === 'analyze'
              ? 'bg-blue-600 text-white'
              : 'bg-slate-200 text-slate-700'
          }`}
        >
          Analyze (bcpanalyze)
        </button>
        <button
          type="button"
          onClick={() => {
            cancelRun();
            setTab('extract');
            setApiResponse(null);
            setError('');
            setCancelled(false);
          }}
          className={`rounded-lg px-4 py-2 text-sm font-medium ${
            tab === 'extract'
              ? 'bg-blue-600 text-white'
              : 'bg-slate-200 text-slate-700'
          }`}
        >
          Extract PDF
        </button>
      </div>

      <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            PDF file(s)
          </label>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,application/pdf"
            multiple
            onChange={(e) => {
              setFiles(e.target.files);
              setDefaultFileLabel(
                e.target.files?.length === 1
                  ? e.target.files[0].name
                  : e.target.files?.length
                    ? `${e.target.files.length} files selected`
                    : null,
              );
              setDefaultFileError('');
            }}
            className="block w-full text-sm"
          />
          {defaultFileLabel && (
            <p className="mt-1 text-xs font-medium text-emerald-700">
              Attached: {defaultFileLabel}
            </p>
          )}
          {defaultFileError && (
            <p className="mt-1 text-xs text-amber-700">{defaultFileError}</p>
          )}
          <p className="mt-1 text-xs text-slate-500">
            Gemini: attach PDFs. Azure GPT: prompt only (no files).
          </p>
        </div>

        {tab === 'analyze' && (
          <>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                AI model
              </label>
              <select
                value={aiModel}
                onChange={(e) => setAiModel(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
              >
                {AI_MODELS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Prompt
              </label>
              <textarea
                ref={promptRef}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={16}
                placeholder="Paste your extraction or compliance prompt here…"
                className="min-h-[280px] w-full resize-y rounded-lg border border-slate-300 px-3 py-3 font-mono text-sm leading-relaxed"
              />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={runAnalyze}
                disabled={loading}
                className="rounded-lg bg-blue-600 px-6 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'Running…' : 'Run Analyze'}
              </button>
              {loading && (
                <button
                  type="button"
                  onClick={cancelRun}
                  className="rounded-lg border border-red-300 bg-red-50 px-6 py-2 font-medium text-red-700 hover:bg-red-100"
                >
                  Cancel
                </button>
              )}
            </div>
          </>
        )}

        {tab === 'extract' && (
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={runExtract}
              disabled={loading}
              className="rounded-lg bg-emerald-600 px-6 py-2 font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {loading ? 'Extracting…' : 'Run Extract PDF'}
            </button>
            {loading && (
              <button
                type="button"
                onClick={cancelRun}
                className="rounded-lg border border-red-300 bg-red-50 px-6 py-2 font-medium text-red-700 hover:bg-red-100"
              >
                Cancel
              </button>
            )}
          </div>
        )}
      </div>

      {loading && (
        <p className="mt-3 text-sm text-amber-700">
          Request in progress… Click <strong>Cancel</strong> to stop waiting.
          (The API may still finish on the server.)
        </p>
      )}

      {cancelled && !loading && (
        <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Request cancelled. You can edit inputs and run again.
        </p>
      )}

      {error && (
        <pre className="mt-4 overflow-auto rounded-lg bg-red-50 p-4 text-sm text-red-800">
          {error}
        </pre>
      )}

      {apiResponse && (
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <div className="flex flex-col">
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
              API response (raw JSON)
            </h2>
            <pre className="max-h-[36rem] flex-1 overflow-auto rounded-lg bg-slate-900 p-4 text-xs leading-relaxed text-green-300">
              {JSON.stringify(apiResponse, null, 2)}
            </pre>
          </div>
          <div className="flex flex-col">
            <div className="mb-2 flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                {tab === 'analyze' ? 'Formatted message' : 'Formatted text'}
              </h2>
              <CopyButton
                message={formattedContent}
                onCopySuccess={() => setFocusPromptEnd(true)}
              />
            </div>
            <div className="max-h-[36rem] flex-1 overflow-auto rounded-lg border border-slate-200 bg-slate-50 p-4">
              <FormattedMessage message={formattedContent} />
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
