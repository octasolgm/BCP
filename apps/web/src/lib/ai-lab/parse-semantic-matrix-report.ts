export type SemanticMismatch = {
  ref: string;
  executivePoint: string;
  requirementArea: string;
  executiveClaim: string;
  granularFinding: string;
  coreConflict: string;
  documentContradiction: string;
};

export type SemanticRemediationItem = {
  priority: number;
  ref: string;
  action: string;
};

export type SemanticChangeRow = {
  ref: string;
  requirementArea: string;
  changeType: string;
  columnOrAspect: string;
  executiveValue: string;
  granularValue: string;
  gapOrConflict: string;
  imptfsVsScp: string;
};

export type SemanticCompareMeta = {
  alignmentScorePercent: number | null;
  mappedPairs: number | null;
  alignedPairs: number | null;
  mismatchCount: number | null;
  mismatches: SemanticMismatch[];
  remediationItems: SemanticRemediationItem[];
};

export type ParsedSemanticReport = {
  fullText: string;
  summarySection: string;
  gapSection: string;
  remediationSection: string;
  meta: SemanticCompareMeta | null;
  gaps: SemanticMismatch[];
  changes: SemanticChangeRow[];
  remediation: SemanticRemediationItem[];
};

const FIELD_ALIASES: Record<keyof SemanticMismatch, RegExp[]> = {
  ref: [
    /^point reference\s*\/?\s*id/i,
    /^ref/i,
  ],
  executivePoint: [/^executive point/i, /^executive claim/i],
  requirementArea: [/^requirement area/i],
  executiveClaim: [/^executive claim/i, /^the executive/i],
  granularFinding: [/^granular finding/i, /^granular matrix/i],
  coreConflict: [/^the core conflict/i, /^core conflict/i],
  documentContradiction: [
    /^document contradiction/i,
    /^imptfs vs scp/i,
  ],
};

function extractJsonBlock(text: string): SemanticCompareMeta | null {
  const fenced = text.match(/```json\s*([\s\S]*?)```/i);
  const candidates = [fenced?.[1], text.match(/\{[\s\S]*"mismatches"[\s\S]*\}/)?.[0]];
  for (const raw of candidates) {
    if (!raw?.trim()) continue;
    try {
      const parsed = JSON.parse(raw.trim()) as Partial<SemanticCompareMeta>;
      return normalizeMeta(parsed);
    } catch {
      // try next
    }
  }
  return null;
}

function normalizeMeta(raw: Partial<SemanticCompareMeta>): SemanticCompareMeta {
  return {
    alignmentScorePercent:
      typeof raw.alignmentScorePercent === 'number'
        ? raw.alignmentScorePercent
        : null,
    mappedPairs: typeof raw.mappedPairs === 'number' ? raw.mappedPairs : null,
    alignedPairs:
      typeof raw.alignedPairs === 'number' ? raw.alignedPairs : null,
    mismatchCount:
      typeof raw.mismatchCount === 'number' ? raw.mismatchCount : null,
    mismatches: Array.isArray(raw.mismatches)
      ? raw.mismatches.map(normalizeMismatch)
      : [],
    remediationItems: Array.isArray(raw.remediationItems)
      ? raw.remediationItems.map(normalizeRemediation)
      : [],
  };
}

function normalizeMismatch(m: Partial<SemanticMismatch>): SemanticMismatch {
  return {
    ref: String(m.ref ?? ''),
    executivePoint: String(m.executivePoint ?? ''),
    requirementArea: String(m.requirementArea ?? ''),
    executiveClaim: String(m.executiveClaim ?? ''),
    granularFinding: String(m.granularFinding ?? ''),
    coreConflict: String(m.coreConflict ?? ''),
    documentContradiction: String(m.documentContradiction ?? ''),
  };
}

function normalizeRemediation(
  r: Partial<SemanticRemediationItem>,
  i: number,
): SemanticRemediationItem {
  return {
    priority:
      typeof r.priority === 'number' ? r.priority : i + 1,
    ref: String(r.ref ?? ''),
    action: String(r.action ?? ''),
  };
}

function extractSection(text: string, heading: RegExp): string {
  const withoutJson = text.replace(/```json[\s\S]*?```/gi, '').trim();
  const match = withoutJson.match(heading);
  if (match == null || match.index == null) return '';

  const start = match.index + match[0].length;
  const rest = withoutJson.slice(start);
  const next = rest.search(/\n#{2,3}\s*\d+\./);
  return (next >= 0 ? rest.slice(0, next) : rest).trim();
}

function parseBulletField(line: string): { key: string; value: string } | null {
  const m = line.match(/^[-*•]\s*\*{0,2}([^:*]+?)\*{0,2}\s*:\s*(.*)$/);
  if (!m) return null;
  return { key: m[1].trim(), value: m[2].trim() };
}

function assignField(
  gap: SemanticMismatch,
  key: string,
  value: string,
): void {
  for (const [field, patterns] of Object.entries(FIELD_ALIASES) as [
    keyof SemanticMismatch,
    RegExp[],
  ][]) {
    if (patterns.some((p) => p.test(key))) {
      if (!gap[field] || field === 'executiveClaim') {
        gap[field] = value;
      }
      return;
    }
  }
}

function refFromHeading(heading: string): string {
  const m = heading.match(
    /(?:ref\s*)?([0-9]+\.[0-9]+(?:[-.][0-9]+)?)/i,
  );
  return m?.[1] ?? '';
}

export function parseGapBlocksFromMarkdown(
  gapSection: string,
): SemanticMismatch[] {
  if (!gapSection.trim()) return [];

  const chunks = gapSection.split(/(?=\n#{3,4}\s+)/).filter(Boolean);
  const gaps: SemanticMismatch[] = [];

  for (const chunk of chunks) {
    const lines = chunk.split('\n');
    const heading = lines[0]?.replace(/^#{3,4}\s*/, '').trim() ?? '';
    if (!heading || /no mismatch|no gap|none identified/i.test(heading)) {
      continue;
    }

    const gap: SemanticMismatch = {
      ref: refFromHeading(heading),
      executivePoint: '',
      requirementArea: heading.includes('—')
        ? heading.split('—').slice(1).join('—').trim()
        : '',
      executiveClaim: '',
      granularFinding: '',
      coreConflict: '',
      documentContradiction: '',
    };

    for (const line of lines.slice(1)) {
      const bullet = parseBulletField(line.trim());
      if (bullet) assignField(gap, bullet.key, bullet.value);
    }

    if (
      gap.ref ||
      gap.coreConflict ||
      gap.executiveClaim ||
      gap.granularFinding
    ) {
      gaps.push(gap);
    }
  }

  return gaps;
}

export function parseRemediationFromMarkdown(
  section: string,
): SemanticRemediationItem[] {
  const items: SemanticRemediationItem[] = [];
  const lines = section.split('\n');
  let n = 0;
  for (const line of lines) {
    const numbered = line.match(/^\s*(\d+)[.)]\s+(.+)/);
    if (numbered) {
      n += 1;
      const body = numbered[2];
      const refMatch = body.match(/\[?(Ref\s*)?([0-9]+(?:[.-][0-9]+)+)\]?/i);
      items.push({
        priority: Number(numbered[1]) || n,
        ref: refMatch?.[2] ?? '',
        action: body.trim(),
      });
      continue;
    }
    const bullet = line.match(/^\s*[-*•]\s+(.+)/);
    if (bullet) {
      n += 1;
      const body = bullet[1];
      const refMatch = body.match(/\[?(Ref\s*)?([0-9]+(?:[.-][0-9]+)+)\]?/i);
      items.push({
        priority: n,
        ref: refMatch?.[2] ?? '',
        action: body.trim(),
      });
    }
  }
  return items;
}

export function getEffectiveGaps(
  meta: SemanticCompareMeta | null,
  gapSection: string,
): SemanticMismatch[] {
  const fromJson = meta?.mismatches.filter(
    (m) =>
      m.ref ||
      m.coreConflict ||
      m.executiveClaim ||
      m.granularFinding,
  ) ?? [];
  if (fromJson.length > 0) return fromJson;

  const fromMd = parseGapBlocksFromMarkdown(gapSection);
  if (fromMd.length > 0) return fromMd;

  if (gapSection.trim()) {
    return [
      {
        ref: '',
        executivePoint: '',
        requirementArea: '',
        executiveClaim: '',
        granularFinding: '',
        coreConflict: gapSection.trim(),
        documentContradiction: '',
      },
    ];
  }
  return [];
}

export function gapsToChangeRows(gaps: SemanticMismatch[]): SemanticChangeRow[] {
  return gaps.map((g) => ({
    ref: g.ref,
    requirementArea: g.requirementArea,
    changeType: 'Semantic gap / mismatch',
    columnOrAspect: 'Compliance status & evidence',
    executiveValue: g.executiveClaim,
    granularValue: g.granularFinding,
    gapOrConflict: g.coreConflict,
    imptfsVsScp: g.documentContradiction,
  }));
}

export function parseSemanticMatrixReport(text: string): ParsedSemanticReport {
  const fullText = text.replace(/```json[\s\S]*?```/gi, '').trim();
  const meta = extractJsonBlock(text);

  const summarySection = extractSection(
    text,
    /#{2,3}\s*1[.)]\s*Executive Semantic Alignment Summary/im,
  );
  const gapSection = extractSection(
    text,
    /#{2,3}\s*2[.)]\s*Comprehensive Discrepancy\s*(?:&|and)?\s*Gap Analysis/im,
  );
  const remediationSection = extractSection(
    text,
    /#{2,3}\s*3[.)]\s*Immediate Remediation Roadmap/im,
  );

  const gaps = getEffectiveGaps(meta, gapSection);
  const changes = gapsToChangeRows(gaps);

  const remediation =
    meta?.remediationItems.filter((r) => r.action)?.length
      ? meta.remediationItems
      : parseRemediationFromMarkdown(remediationSection);

  return {
    fullText,
    summarySection,
    gapSection,
    remediationSection,
    meta,
    gaps,
    changes,
    remediation,
  };
}

export function downloadSemanticReportMarkdown(
  report: string,
  granularName: string,
  executiveName: string,
): void {
  const stamp = new Date().toISOString().slice(0, 10);
  const body = `# Semantic Matrix Compare Report\n\nGenerated: ${new Date().toLocaleString()}\n\n- Granular: ${granularName}\n- Executive: ${executiveName}\n\n---\n\n${report}`;
  const blob = new Blob([body], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `semantic-matrix-compare-${stamp}.md`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
