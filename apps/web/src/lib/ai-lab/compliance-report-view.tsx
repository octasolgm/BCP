'use client';

import {
  buildTierCounts,
  COLOR_LEGEND,
  getComplianceColorTier,
  TIER_UI,
  type ColorTier,
} from './color-tier';
import {
  cleanDisplayTitle,
  type ParsedComplianceResult,
  type ReportStats,
} from './parse-compliance-results';

function statusBadgeClass(status: string): string {
  if (status === 'Compliant') return 'bg-emerald-100 text-emerald-800';
  if (status === 'Partial Compliant') return 'bg-amber-100 text-amber-900';
  if (status === 'Non-Compliant') return 'bg-red-100 text-red-800';
  return 'bg-slate-100 text-slate-700';
}

export function ColorCodeLegend({
  results,
}: {
  results: ParsedComplianceResult[];
}) {
  const counts = buildTierCounts(results);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
        Color code legend
      </h2>
      <div className="grid gap-3 md:grid-cols-3">
        {COLOR_LEGEND.map((entry) => {
          const ui = TIER_UI[entry.tier];
          const count =
            entry.tier === 'green'
              ? counts.green
              : entry.tier === 'yellow'
                ? counts.yellow
                : counts.red;
          return (
            <div
              key={entry.tier}
              className={`rounded-lg border p-3 ${ui.card}`}
            >
              <div className="mb-2 flex items-center gap-2">
                <span
                  className={`inline-block h-4 w-4 shrink-0 rounded-full ${ui.swatch}`}
                  aria-hidden
                />
                <span className={`text-sm font-bold ${ui.title}`}>
                  {entry.label}
                </span>
                <span
                  className={`ml-auto rounded-full px-2 py-0.5 text-xs font-bold ${ui.badge}`}
                >
                  {count}
                </span>
              </div>
              <p className="text-xs leading-relaxed text-slate-700">
                {entry.description}
              </p>
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-xs text-slate-500">
        Each result card is colored by compliance status and confidence %: green
        = 100% Compliant · yellow = Partial or 70–99% · red = Non-Compliant or
        &lt;70%
      </p>
    </div>
  );
}

export function ReportStatsSummary({ stats }: { stats: ReportStats }) {
  if (stats.total === 0) return null;

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard label="Total points" value={stats.total} />
      <StatCard label="100% confidence" value={stats.atFullConfidence} tone="ok" />
      <StatCard
        label="Below 100%"
        value={stats.belowFullConfidence}
        tone={stats.belowFullConfidence > 0 ? 'warn' : 'ok'}
      />
      <StatCard
        label="Need attention"
        value={stats.attentionItems.length}
        tone={stats.attentionItems.length > 0 ? 'warn' : 'ok'}
      />
      <StatCard label="Compliant" value={stats.compliant} tone="ok" />
      <StatCard label="Partial" value={stats.partial} tone="warn" />
      <StatCard label="Non-Compliant" value={stats.nonCompliant} tone="danger" />
    </div>
  );
}

function StatCard({
  label,
  value,
  tone = 'neutral',
}: {
  label: string;
  value: number;
  tone?: 'ok' | 'warn' | 'danger' | 'neutral';
}) {
  const tones = {
    ok: 'border-emerald-200 bg-emerald-50',
    warn: 'border-amber-200 bg-amber-50',
    danger: 'border-red-200 bg-red-50',
    neutral: 'border-slate-200 bg-white',
  };
  return (
    <div className={`rounded-lg border p-3 ${tones[tone]}`}>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
    </div>
  );
}

export function StatusTierBoxes({ stats }: { stats: ReportStats }) {
  if (stats.total === 0) return null;

  const items = [
    { label: 'Compliant', value: stats.compliant, tier: 'green' as const },
    { label: 'Partial', value: stats.partial, tier: 'yellow' as const },
    { label: 'Non-Compliant', value: stats.nonCompliant, tier: 'red' as const },
  ];

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {items.map((item) => {
        const ui = TIER_UI[item.tier];
        return (
          <div
            key={item.label}
            className={`rounded-xl border-2 px-4 py-4 text-center ${ui.card}`}
          >
            <p className={`text-xs font-bold uppercase tracking-wide ${ui.title}`}>
              {item.label}
            </p>
            <p className={`mt-1 text-3xl font-bold ${ui.title}`}>{item.value}</p>
          </div>
        );
      })}
    </div>
  );
}

export function AttentionFocusCompact({
  items,
}: {
  items: ParsedComplianceResult[];
}) {
  if (items.length === 0) {
    return (
      <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
        All points at 100% confidence and Compliant (green).
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {items.map((item) => {
        const tier = getComplianceColorTier(item);
        const ui = TIER_UI[tier];
        const title = cleanDisplayTitle(item.title || `Point ${item.index + 1}`);
        const conf = item.confidence !== null ? `${item.confidence}%` : 'n/a';
        return (
          <li
            key={item.index}
            className={`rounded-lg border px-4 py-2.5 text-sm ${ui.card}`}
          >
            <span className={`font-bold leading-snug ${ui.title}`}>
              {title} — {item.status}, confidence {conf}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export function AttentionSummaryList({
  items,
}: {
  items: ParsedComplianceResult[];
}) {
  if (items.length === 0) {
    return (
      <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
        All points are at 100% confidence with Compliant status (green).
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {items.map((item) => {
        const tier = getComplianceColorTier(item);
        const ui = TIER_UI[tier];
        return (
          <li
            key={item.index}
            className={`rounded-lg border px-4 py-3 text-sm ${ui.card}`}
          >
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`inline-block h-3 w-3 shrink-0 rounded-full ${ui.swatch}`}
                aria-hidden
              />
              <span className={`font-bold ${ui.title}`}>
                {cleanDisplayTitle(item.title || `Point ${item.index + 1}`)}
              </span>
              <span
                className={`rounded px-2 py-0.5 text-xs font-medium ${statusBadgeClass(item.status)}`}
              >
                {item.status}
              </span>
              {item.confidence !== null && (
                <span className={`text-xs ${ui.confidence}`}>
                  {item.confidence}% confidence
                </span>
              )}
            </div>
            {item.body && (
              <p className="mt-1 line-clamp-2 text-xs text-slate-700">
                {item.body}
              </p>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function tierConfidenceClass(tier: ColorTier): string {
  return TIER_UI[tier].confidence;
}

export function ComplianceResultsList({
  results,
}: {
  results: ParsedComplianceResult[];
}) {
  if (results.length === 0) {
    return (
      <p className="text-sm italic text-slate-500">
        Paste batch analyze output above to see formatted results.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {results.map((item) => {
        const tier = getComplianceColorTier(item);
        const ui = TIER_UI[tier];
        return (
          <article
            key={item.index}
            className={`rounded-xl p-5 ${ui.card}`}
          >
            <span
              className={`mb-3 inline-block rounded px-2.5 py-1 text-[11px] font-bold uppercase ${ui.badge}`}
            >
              {ui.badgeLabel}
            </span>
            {item.title && (
              <h2 className={`mb-3 text-xl font-bold leading-snug ${ui.title}`}>
                {cleanDisplayTitle(item.title)}
              </h2>
            )}
            {item.body && (
              <p className="mb-5 whitespace-pre-wrap text-sm leading-relaxed text-slate-800">
                {item.body}
              </p>
            )}
            {item.fields.length > 0 && (
              <dl className="space-y-3">
                {item.fields.map((field) => {
                  const isConfidence = field.label.includes('Confidence');
                  const isStatus = field.label.includes('Status');
                  return (
                    <div key={field.label}>
                      <dt className="text-sm font-bold text-slate-900">
                        {field.label} :
                      </dt>
                      <dd
                        className={`mt-0.5 whitespace-pre-wrap text-sm leading-relaxed ${
                          isConfidence
                            ? tierConfidenceClass(tier)
                            : isStatus
                              ? ui.status
                              : 'text-slate-700'
                        }`}
                      >
                        {field.value || '—'}
                      </dd>
                    </div>
                  );
                })}
              </dl>
            )}
          </article>
        );
      })}
    </div>
  );
}

export function MarkdownSummary({ text }: { text: string }) {
  const lines = text.split('\n');
  return (
    <div className="prose prose-sm max-w-none text-slate-800">
      {lines.map((line, i) => {
        if (line.startsWith('## ')) {
          return (
            <h2 key={i} className="mb-2 mt-4 text-base font-bold text-violet-900">
              {line.slice(3)}
            </h2>
          );
        }
        if (line.startsWith('### ')) {
          return (
            <h3 key={i} className="mb-1 mt-3 text-sm font-bold text-slate-900">
              {line.slice(4)}
            </h3>
          );
        }
        if (line.startsWith('- ') || line.startsWith('* ')) {
          return (
            <p key={i} className="ml-4 text-sm leading-relaxed">
              • {line.slice(2)}
            </p>
          );
        }
        if (!line.trim()) return <br key={i} />;
        return (
          <p key={i} className="text-sm leading-relaxed">
            {line}
          </p>
        );
      })}
    </div>
  );
}
