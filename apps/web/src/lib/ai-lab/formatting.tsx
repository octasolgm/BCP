'use client';

import { useState } from 'react';
import { COMPLIANCE_FIELD_REGEX } from './constants';

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
  const blocks = chunks
    .map(parseComplianceBlock)
    .filter((b) => b.title || b.body || b.fields.length > 0);
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
  const bodyField = bodyKeys.find(
    (k) => item[k] != null && String(item[k]).trim(),
  );
  const otherEntries = Object.entries(item).filter(
    ([k, v]) => !headingKeys.has(k) && v != null && String(v).trim() !== '',
  );

  const plainParts = [heading];
  const htmlParts = [`<div><h2><strong>${escapeHtml(heading)}</strong></h2>`];

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

export function messageToFormattedClipboard(message: unknown): {
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

export async function copyFormattedToClipboard(message: unknown): Promise<boolean> {
  const { plain, html } = messageToFormattedClipboard(message);
  if (!plain) return false;
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
    return true;
  } catch {
    try {
      await navigator.clipboard.writeText(plain);
      return true;
    } catch {
      return false;
    }
  }
}

export function CopyButton({
  message,
  label = 'Copy formatted',
  onCopySuccess,
}: {
  message: unknown;
  label?: string;
  onCopySuccess?: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const { plain } = messageToFormattedClipboard(message);

  async function copy() {
    const ok = await copyFormattedToClipboard(message);
    if (!ok) return;
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    onCopySuccess?.();
  }

  return (
    <button
      type="button"
      onClick={copy}
      disabled={!plain}
      className="rounded-md border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-40"
    >
      {copied ? 'Copied' : label}
    </button>
  );
}

export function ComplianceTextView({ text }: { text: string }) {
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

export function FormattedMessage({ message }: { message: unknown }) {
  if (message === null || message === undefined) {
    return (
      <p className="text-sm italic text-slate-500">No message in response.</p>
    );
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
          <div key={i}>
            {typeof item === 'string' ? (
              <ComplianceTextView text={item} />
            ) : (
              <pre className="text-xs">{JSON.stringify(item, null, 2)}</pre>
            )}
          </div>
        ))}
      </div>
    );
  }

  return (
    <pre className="text-xs">{JSON.stringify(message, null, 2)}</pre>
  );
}
