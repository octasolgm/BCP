'use client';

import { useState } from 'react';
import {
  hasDisplayableFulfilledClauses,
  parseBulletLines,
  parseCapGaps,
  parseReferenceCitation,
  parseReferenceComplianceText,
  referenceBlockBadgeLabel,
  referenceBlockToPlainText,
  referenceBlockToTier,
  requirementDisplayLines,
  TIER_UI,
  type ReferenceComplianceBlock,
} from './parse-reference-response';

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function FulfilledClausesList({
  text,
  tier,
}: {
  text: string;
  tier: keyof typeof TIER_UI;
}) {
  const lines = parseBulletLines(text);

  if (lines.length === 0) {
    return <p className="text-sm italic text-slate-500">None</p>;
  }

  const boxClass =
    tier === 'green'
      ? 'border-emerald-200 bg-emerald-50/80 text-emerald-950'
      : tier === 'yellow'
        ? 'border-amber-200 bg-amber-50/80 text-amber-950'
        : tier === 'red'
          ? 'border-red-200 bg-red-50/80 text-red-950'
          : 'border-slate-200 bg-slate-50 text-slate-900';

  const markClass =
    tier === 'green'
      ? 'text-emerald-700'
      : tier === 'yellow'
        ? 'text-amber-700'
        : tier === 'red'
          ? 'text-red-700'
          : 'text-slate-600';

  return (
    <ol className="space-y-2">
      {lines.map((line, i) => (
        <li
          key={i}
          className={`rounded-md border px-3 py-2.5 text-sm leading-relaxed ${boxClass}`}
        >
          <span className={`mr-2 font-bold ${markClass}`}>
            {i + 1}.
          </span>
          <span className={`mr-1 font-bold ${markClass}`}>✓</span>
          {line}
        </li>
      ))}
    </ol>
  );
}

function CorrectiveActionPlan({ cap }: { cap: string }) {
  const gaps = parseCapGaps(cap);
  if (gaps.length === 0) {
    return (
      <p className="whitespace-pre-wrap text-sm leading-relaxed text-amber-950">
        {cap}
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {gaps.map((gap) => (
        <div
          key={gap.index}
          className="rounded-lg border border-amber-300 bg-amber-50/90 px-3 py-2.5"
        >
          <p className="text-xs font-bold uppercase tracking-wide text-amber-800">
            Gap {gap.index} — Missing
          </p>
          <p className="mt-1 text-sm leading-relaxed text-amber-950">
            {gap.missing}
          </p>
          {gap.fix && (
            <>
              <p className="mt-2 text-xs font-bold text-amber-900">Fix:</p>
              <p className="text-sm leading-relaxed text-amber-950">{gap.fix}</p>
            </>
          )}
        </div>
      ))}
    </div>
  );
}

export function ReferenceComplianceCard({
  block,
}: {
  block: ReferenceComplianceBlock;
}) {
  const tier = referenceBlockToTier(block);
  const ui = TIER_UI[tier];
  const citation = parseReferenceCitation(block.outputResponse);
  const isMissing = /no corresponding procedure found/i.test(
    block.outputResponse,
  );
  const reqLines = requirementDisplayLines(block.body);
  const quoteBorderClass =
    tier === 'green'
      ? 'border-emerald-500'
      : tier === 'yellow'
        ? 'border-amber-500'
        : tier === 'red'
          ? 'border-red-400'
          : 'border-slate-400';
  const statBoxClass =
    tier === 'green'
      ? 'border-emerald-300 bg-emerald-50/60'
      : tier === 'yellow'
        ? 'border-amber-300 bg-amber-50/60'
        : tier === 'red'
          ? 'border-red-300 bg-red-50/60'
          : 'border-slate-200 bg-slate-50';

  return (
    <article className={`rounded-xl p-5 ${ui.card}`}>
      <span
        className={`mb-3 inline-block rounded px-2.5 py-1 text-[11px] font-bold uppercase ${ui.badge}`}
      >
        {referenceBlockBadgeLabel(block)}
      </span>

      {block.title && (
        <h2 className={`mb-2 text-xl font-bold leading-snug ${ui.title}`}>
          {block.title}
        </h2>
      )}
      {block.body && (
        <div className="mb-4 rounded-lg border border-slate-200 bg-white/70 p-3">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Requirement
          </p>
          {reqLines.length > 1 ? (
            <ol className="list-decimal space-y-2 pl-5 text-sm leading-relaxed text-slate-800">
              {reqLines.map((line, i) => (
                <li key={i} className="pl-1">
                  {line.replace(/^\d+[.)]\s*/, '')}
                </li>
              ))}
            </ol>
          ) : (
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-800">
              {block.body}
            </p>
          )}
        </div>
      )}

      {block.referencePdf && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wide text-slate-600">
            Reference PDF
          </span>
          {block.referencePdf.split(';').map((name) => (
            <span
              key={name.trim()}
              className="rounded-md border border-indigo-300 bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-900"
            >
              📄 {name.trim()}
            </span>
          ))}
        </div>
      )}

      <div
        className={`mb-4 rounded-lg border-2 p-4 ${
          isMissing
            ? 'border-red-300 bg-red-50'
            : tier === 'green'
              ? 'border-emerald-400 bg-emerald-50'
              : tier === 'yellow'
                ? 'border-amber-400 bg-amber-50'
                : 'border-red-300 bg-red-50'
        }`}
      >
        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-700">
          Compliance evidence (Output/Response)
        </p>

        {!isMissing && (citation.page || citation.section) && (
          <div className="mb-2 flex flex-wrap gap-2">
            {citation.page && (
              <span className="rounded bg-white px-2 py-0.5 text-xs font-bold text-slate-800 shadow-sm">
                Page {citation.page}
              </span>
            )}
            {citation.section && (
              <span className="rounded bg-white px-2 py-0.5 text-xs font-bold text-slate-800 shadow-sm">
                Section {citation.section}
              </span>
            )}
          </div>
        )}

        {citation.quote ? (
          <blockquote
            className={`border-l-4 ${quoteBorderClass} bg-white/80 py-2 pl-4 pr-2 text-sm font-medium italic leading-relaxed text-slate-800`}
          >
            &ldquo;{citation.quote}&rdquo;
          </blockquote>
        ) : (
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-800">
            {block.outputResponse || '—'}
          </p>
        )}

        {citation.quote && block.outputResponse !== citation.quote && (
          <p className="mt-2 text-xs text-slate-500">{block.outputResponse}</p>
        )}
      </div>

      {hasDisplayableFulfilledClauses(block.fulfilledClauses) && (
        <div className="mb-4">
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-700">
            What this reference fulfills
          </p>
          <FulfilledClausesList text={block.fulfilledClauses} tier={tier} />
        </div>
      )}

      <div className="border-t border-slate-200/80 pt-3">
        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-600">
          Status &amp; confidence
        </p>
        <dl className="grid gap-3 sm:grid-cols-2">
          <div className={`rounded-lg border-2 p-3 ${statBoxClass}`}>
            <dt className="text-xs font-bold uppercase tracking-wide text-slate-600">
              Status :
            </dt>
            <dd className={`mt-1 text-sm ${ui.status}`}>{block.status || '—'}</dd>
          </div>
          <div className={`rounded-lg border-2 p-3 ${statBoxClass}`}>
            <dt className="text-xs font-bold uppercase tracking-wide text-slate-600">
              Compliance Confidence % :
            </dt>
            <dd className={`mt-1 text-sm ${ui.confidence}`}>
              {block.confidence || '—'}
            </dd>
          </div>
        </dl>
      </div>

      <dl className="mt-3 grid gap-3">
        {block.correctiveAction && block.correctiveAction !== 'N/A' && (
          <div className="sm:col-span-2">
            <dt className="text-sm font-bold text-slate-900">
              Corrective Action Plan :
            </dt>
            <dd className="mt-1">
              <CorrectiveActionPlan cap={block.correctiveAction} />
            </dd>
          </div>
        )}
        {block.responsibility && block.responsibility !== 'N/A' && (
          <div className="sm:col-span-2">
            <dt className="text-sm font-bold text-slate-900">Responsibility :</dt>
            <dd className="mt-0.5 text-sm text-slate-700">
              {block.responsibility}
            </dd>
          </div>
        )}
      </dl>
    </article>
  );
}

export function ReferenceFormattedMessage({ message }: { message: unknown }) {
  if (message === null || message === undefined) {
    return (
      <p className="text-sm italic text-slate-500">No message in response.</p>
    );
  }

  const text = typeof message === 'string' ? message : String(message);
  const blocks = parseReferenceComplianceText(text);

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
        <ReferenceComplianceCard key={i} block={block} />
      ))}
    </div>
  );
}

export function referenceMessageToClipboard(message: unknown): {
  plain: string;
  html: string;
} {
  if (message === null || message === undefined) {
    return { plain: '', html: '' };
  }

  const text = typeof message === 'string' ? message : String(message);
  const blocks = parseReferenceComplianceText(text);

  if (blocks.length === 0) {
    return {
      plain: text,
      html: `<p>${escapeHtml(text).replace(/\n/g, '<br>')}</p>`,
    };
  }

  const plain = blocks.map(referenceBlockToPlainText).join('\n\n---\n\n');
  const html = blocks
    .map((block) => {
      const tier = referenceBlockToTier(block);
      const border =
        tier === 'green' ? '#34d399' : tier === 'yellow' ? '#fbbf24' : '#f87171';
      const citation = parseReferenceCitation(block.outputResponse);
      const quoteHtml = citation.quote
        ? `<blockquote style="border-left:4px solid ${border};padding:8px 12px;margin:8px 0;background:#f8fafc;font-style:italic;">&ldquo;${escapeHtml(citation.quote)}&rdquo;</blockquote>`
        : `<p>${escapeHtml(block.outputResponse).replace(/\n/g, '<br>')}</p>`;

      return `<div style="border:2px solid ${border};border-radius:10px;padding:16px;margin-bottom:20px;">
        <h2 style="font-size:18px;font-weight:bold;margin:0 0 8px;">${escapeHtml(block.title)}</h2>
        ${block.body ? `<p style="font-size:14px;line-height:1.6;">${escapeHtml(block.body).replace(/\n/g, '<br>')}</p>` : ''}
        ${block.referencePdf ? `<p style="font-size:12px;font-weight:bold;color:#4338ca;">Reference PDF: ${escapeHtml(block.referencePdf)}</p>` : ''}
        <p style="font-size:12px;font-weight:bold;margin-top:12px;">Compliance evidence:</p>
        ${quoteHtml}
        ${block.fulfilledClauses ? `<p style="font-size:12px;font-weight:bold;margin-top:12px;">Fulfilled clauses:</p><p style="font-size:14px;">${escapeHtml(block.fulfilledClauses).replace(/\n/g, '<br>')}</p>` : ''}
        <p style="font-size:14px;margin-top:8px;"><strong>Status:</strong> ${escapeHtml(block.status)} · <strong>Confidence:</strong> ${escapeHtml(block.confidence)}</p>
        ${block.correctiveAction ? `<p style="font-size:12px;font-weight:bold;margin-top:12px;color:#b45309;">Corrective Action Plan:</p><p style="font-size:14px;">${escapeHtml(block.correctiveAction).replace(/\n/g, '<br>')}</p>` : ''}
        ${block.responsibility ? `<p style="font-size:12px;font-weight:bold;margin-top:8px;">Responsibility:</p><p style="font-size:14px;">${escapeHtml(block.responsibility)}</p>` : ''}
      </div>`;
    })
    .join('');

  return { plain, html };
}

export function ReferenceCopyButton({
  message,
  label = 'Copy formatted',
  onCopySuccess,
}: {
  message: unknown;
  label?: string;
  onCopySuccess?: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const { plain, html } = referenceMessageToClipboard(message);

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
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      onCopySuccess?.();
    } catch {
      await navigator.clipboard.writeText(plain);
    }
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