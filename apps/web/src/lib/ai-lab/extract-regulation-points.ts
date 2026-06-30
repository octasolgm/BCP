/**
 * Split regulatory PDF text into numbered points (3, 3.1, 3.2.1, 2.8.6, …)
 * without paraphrasing — verbatim extraction only.
 */

export type ExtractedRegulationPoint = {
  number: string;
  text: string;
  /** Original marker + body exactly as found in source */
  full: string;
  depth: number;
};

/**
 * Matches e.g. 3.2.1. LFIs… OR 2.8.6 Statutory… OR 2.0.1 Sanctions…
 * (period after number is optional when followed by space + capital letter)
 */
const POINT_MARKER_RE =
  /(?<![\d./])(\d+(?:\.\d+)+)(?:\.(?!\d)|(?=\s+(?=[A-Z"'(])))/g;

/** TFS-REQ-03 Screening Operations */
const TFS_REQ_RE = /(?<![A-Z0-9-])(TFS-REQ-\d+)\s+(?=[A-Za-z])/gi;

export type ExtractPointsOptions = {
  /** Only points under this section, e.g. "3" → 3, 3.1, 3.2.1 */
  sectionPrefix?: string;
  /** Minimum depth (1 = "3", 2 = "3.1", 3 = "3.1.1") */
  minDepth?: number;
};

function normalizeExtractedText(rawText: string): string {
  return rawText
    .replace(/\r\n/g, '\n')
    .replace(/\u00A0/g, ' ')
    .replace(/(\d)\s+\.\s+(\d)/g, '$1.$2')
    .replace(/(\d)\s+(\d)(?=\s*[.\d])/g, '$1.$2');
}

function matchesSection(number: string, prefix: string): boolean {
  const p = prefix.trim().replace(/\.$/, '');
  if (!p) return true;
  return number === p || number.startsWith(`${p}.`);
}

function markerEndIndex(text: string, index: number, rawMatch: string): number {
  if (rawMatch.endsWith('.')) {
    return index + rawMatch.length;
  }
  const tail = text.slice(index);
  const numMatch = tail.match(/^(\d+(?:\.\d+)+)/);
  return index + (numMatch?.[0].length ?? rawMatch.length);
}

function isFalsePositive(number: string, body: string): boolean {
  const parts = number.split('.').map(Number);
  if (parts.some((n) => Number.isNaN(n))) return true;

  // Likely page cross-refs or version noise (e.g. 44.11)
  if (parts.length === 2 && parts[0] > 30 && parts[1] > 9) return true;

  // Empty or tiny bodies (TOC dots / page leaders)
  const trimmed = body.replace(/\s+/g, ' ').trim();
  if (trimmed.length < 3) return true;
  if (/^\.{2,}$/.test(trimmed)) return true;

  return false;
}

function collectNumericMarkers(text: string) {
  const markers: { number: string; index: number; endIndex: number }[] = [];
  const re = new RegExp(POINT_MARKER_RE.source, 'g');
  let match: RegExpExecArray | null;

  while ((match = re.exec(text)) !== null) {
    const number = match[1];
    const index = match.index;
    const endIndex = markerEndIndex(text, index, match[0]);
    markers.push({ number, index, endIndex });
  }

  return markers;
}

function collectTfsMarkers(text: string) {
  const markers: { number: string; index: number; endIndex: number }[] = [];
  const re = new RegExp(TFS_REQ_RE.source, 'gi');
  let match: RegExpExecArray | null;

  while ((match = re.exec(text)) !== null) {
    markers.push({
      number: match[1].toUpperCase(),
      index: match.index,
      endIndex: match.index + match[0].length,
    });
  }

  return markers;
}

function dedupeMarkers(
  markers: { number: string; index: number; endIndex: number }[],
) {
  const byIndex = new Map<number, { number: string; index: number; endIndex: number }>();
  for (const m of markers) {
    const existing = byIndex.get(m.index);
    if (!existing || m.number.length > existing.number.length) {
      byIndex.set(m.index, m);
    }
  }
  return [...byIndex.values()].sort((a, b) => a.index - b.index);
}

export function extractRegulationPoints(
  rawText: string,
  options: ExtractPointsOptions = {},
): ExtractedRegulationPoint[] {
  const text = normalizeExtractedText(rawText).trim();
  if (!text) return [];

  const markers = dedupeMarkers([
    ...collectNumericMarkers(text),
    ...collectTfsMarkers(text),
  ]);

  if (markers.length === 0) return [];

  const points: ExtractedRegulationPoint[] = [];

  for (let i = 0; i < markers.length; i++) {
    const { number, index, endIndex } = markers[i];
    const nextIndex = i + 1 < markers.length ? markers[i + 1].index : text.length;
    const body = text.slice(endIndex, nextIndex).trim();
    const depth = number.includes('.') ? number.split('.').length : 1;
    const full = text.slice(index, nextIndex).trim();

    if (isFalsePositive(number, body)) continue;

    if (options.sectionPrefix && !matchesSection(number, options.sectionPrefix)) {
      continue;
    }
    if (options.minDepth && depth < options.minDepth) {
      continue;
    }

    if (!body && i < markers.length - 1) continue;

    points.push({ number, text: body, depth, full });
  }

  return points;
}

export function countRawMarkers(rawText: string): number {
  const text = normalizeExtractedText(rawText).trim();
  if (!text) return 0;
  return dedupeMarkers([
    ...collectNumericMarkers(text),
    ...collectTfsMarkers(text),
  ]).length;
}

export function pointsToPlainText(points: ExtractedRegulationPoint[]): string {
  return points.map((p) => p.full).join('\n\n---\n\n');
}

export function pointsToBatchInput(points: ExtractedRegulationPoint[]): string {
  return points.map((p) => p.full).join('\n\n');
}
