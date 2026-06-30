import { getComplianceColorTier, type ColorTier } from './color-tier';
import { API_BASE } from './constants';
import {
  parseReferenceCitation,
  parseReferenceComplianceText,
  type ParsedReferenceCitation,
  type ReferenceComplianceBlock,
} from './parse-reference-response';

const TIER_PDF: Record<
  ColorTier,
  {
    fill: [number, number, number];
    border: [number, number, number];
    text: [number, number, number];
    badge: string;
  }
> = {
  green: {
    fill: [236, 253, 245],
    border: [52, 211, 153],
    text: [6, 95, 70],
    badge: 'COMPLIANT',
  },
  yellow: {
    fill: [255, 251, 235],
    border: [251, 191, 36],
    text: [146, 64, 14],
    badge: 'PARTIAL',
  },
  red: {
    fill: [254, 242, 242],
    border: [248, 113, 113],
    text: [185, 28, 28],
    badge: 'NON-COMPLIANT',
  },
  neutral: {
    fill: [248, 250, 252],
    border: [203, 213, 225],
    text: [71, 85, 105],
    badge: 'UNRATED',
  },
};

type PageMapping = {
  block: ReferenceComplianceBlock;
  tier: ColorTier;
  citation: ParsedReferenceCitation;
};

type TextSpan = {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

type TextRegion = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type OccupiedRect = TextRegion;

function tierForBlock(block: ReferenceComplianceBlock): ColorTier {
  const confMatch = block.confidence.match(/(\d+)/);
  const confidence = confMatch ? Number(confMatch[1]) : null;
  return getComplianceColorTier({
    index: 0,
    title: block.title,
    body: block.body,
    fields: block.fields,
    status: block.status,
    confidence,
    needsAttention:
      block.status !== 'Compliant' ||
      (confidence !== null && confidence < 100),
  });
}

function parsePageNumber(pageStr: string | null): number | null {
  if (!pageStr) return null;
  const m = pageStr.match(/(\d+)/);
  return m ? Number(m[1]) : null;
}

function sanitizePdfText(text: string): string {
  return text
    .replace(/[^\x20-\x7E\n]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractPointNumber(block: ReferenceComplianceBlock): string {
  const fromTitle = block.title.match(/^(\d+(?:\.\d+)+|TFS-REQ-\d+)/i);
  if (fromTitle) return fromTitle[1];
  const fromBody = block.body.match(/^(\d+(?:\.\d+)+)/);
  if (fromBody) return fromBody[1];
  const bullet = block.body.match(/\*\*\s*(\d+(?:\.\d+)+)\s*\*\*/);
  if (bullet) return bullet[1];
  return block.title.slice(0, 24) || 'Requirement';
}

function requirementText(block: ReferenceComplianceBlock): string {
  const body = block.body.trim();
  const title = block.title.trim();
  if (body) {
    return body.replace(/^\*\*\s*\d+(?:\.\d+)*\s*\*\*\s*/, '').trim() || body;
  }
  return title;
}

function wrapLines(text: string, maxChars: number, maxLines: number): string[] {
  const words = sanitizePdfText(text).split(' ').filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > maxChars) {
      if (line) lines.push(line);
      line = word;
    } else {
      line = next;
    }
    if (lines.length >= maxLines) break;
  }
  if (line && lines.length < maxLines) lines.push(line);
  return lines;
}

type PdfPageLayout = {
  pageNumber: number;
  text: string;
  spans: TextSpan[];
};

class PdfTextIndex {
  private spanCache = new Map<number, TextSpan[]>();

  private constructor(private readonly pages: PdfPageLayout[]) {}

  static async fromFile(file: File): Promise<PdfTextIndex> {
    const form = new FormData();
    form.append('file', file);
    const res = await fetch(`${API_BASE}/ai/extractpdf-pages`, {
      method: 'POST',
      body: form,
    });
    const data = (await res.json()) as {
      success?: boolean;
      error?: string;
      pages?: PdfPageLayout[];
    };
    if (!res.ok || !data.success) {
      throw new Error(
        data.error ??
          'Could not read PDF text. Start the API server (npm run dev:api).',
      );
    }
    const pages = data.pages ?? [];
    if (!pages.length) {
      throw new Error('No readable text found in PDF');
    }
    return new PdfTextIndex(pages);
  }

  get numPages(): number {
    return this.pages.length;
  }

  async getSpans(pageNumber: number): Promise<TextSpan[]> {
    if (this.spanCache.has(pageNumber)) {
      return this.spanCache.get(pageNumber)!;
    }
    const page = this.pages.find((p) => p.pageNumber === pageNumber);
    const spans = (page?.spans ?? []).map(normalizeSpan);
    this.spanCache.set(pageNumber, spans);
    return spans;
  }
}

const LINE_HEIGHT = 14;

function normalizeSpan(span: TextSpan): TextSpan {
  let height = span.height;
  if (height > 24 || height < 4) height = 11;

  let width = span.width;
  if (width <= 0 || width > 600) {
    width = Math.max(span.text.length * height * 0.48, height);
  }

  return { ...span, width, height };
}

function clampRegion(region: TextRegion): TextRegion {
  const height = Math.min(Math.max(region.height, 10), LINE_HEIGHT);
  return {
    x: region.x,
    y: region.y + region.height - height,
    width: region.width,
    height,
  };
}

function finalizeRegion(region: TextRegion): TextRegion {
  if (region.height > LINE_HEIGHT * 1.6) {
    return region;
  }
  return clampRegion(region);
}

function linesTopToBottom(spans: TextSpan[]) {
  return [...groupByLine(spans)].sort((a, b) => b.y - a.y);
}

function expandParagraphFromLine(
  sorted: { y: number; spans: TextSpan[] }[],
  startIdx: number,
): TextSpan[] {
  const collected = [...sorted[startIdx].spans];

  for (let i = startIdx + 1; i < sorted.length && i <= startIdx + 5; i++) {
    const gap = sorted[i - 1].y - sorted[i].y;
    if (gap < 6 || gap > 26) break;

    const text = sorted[i].spans
      .map((s) => s.text)
      .join(' ')
      .trim();
    if (!text || text === '•') continue;
    if (/^\d+(?:\.\d+)+\s+\S/.test(text)) break;

    collected.push(...sorted[i].spans);
  }

  return collected;
}

function findRegionForNeedle(
  spans: TextSpan[],
  needle: string,
): TextRegion | null {
  const n = needle.toLowerCase().trim();
  if (!n || n.length < 2) return null;
  const sorted = linesTopToBottom(spans);

  if (n.length >= 20) {
    for (let li = 0; li < sorted.length; li++) {
      const paragraphSpans = expandParagraphFromLine(sorted, li);
      const paragraphText = paragraphSpans
        .map((s) => s.text)
        .join(' ')
        .toLowerCase()
        .replace(/\s+/g, ' ');
      const normalized = n.replace(/\s+/g, ' ');
      if (
        paragraphText.includes(normalized) ||
        paragraphText.includes(normalized.slice(0, Math.min(60, normalized.length)))
      ) {
        return mergeSpans(paragraphSpans);
      }
    }
  }

  for (let li = 0; li < sorted.length; li++) {
    const line = sorted[li];
    const lineText = line.spans.map((s) => s.text).join('');
    const idx = lineText.toLowerCase().indexOf(n);
    if (idx < 0) continue;

    if (n.length >= 12) {
      return mergeSpans(expandParagraphFromLine(sorted, li));
    }

    let charCount = 0;
    const matched: TextSpan[] = [];
    for (const span of line.spans) {
      const start = charCount;
      const end = charCount + span.text.length;
      charCount = end;
      if (end > idx && start < idx + n.length) matched.push(span);
    }
    if (matched.length > 0) return mergeSpans(matched);
    return mergeSpans(line.spans);
  }

  const short = n.slice(0, Math.min(24, n.length));
  if (short.length >= 4) {
    for (let li = 0; li < sorted.length; li++) {
      const lineText = sorted[li].spans
        .map((s) => s.text)
        .join(' ')
        .toLowerCase();
      if (lineText.includes(short)) {
        return mergeSpans(expandParagraphFromLine(sorted, li));
      }
    }
  }

  for (const span of spans) {
    if (span.text.toLowerCase().includes(n)) {
      const sortedLines = linesTopToBottom(spans);
      const li = sortedLines.findIndex((l) => l.spans.includes(span));
      if (li >= 0 && n.length < 12) {
        return mergeSpans(expandParagraphFromLine(sortedLines, li));
      }
      return {
        x: span.x,
        y: span.y - span.height,
        width: span.width,
        height: span.height,
      };
    }
  }

  return null;
}

function buildSearchNeedles(
  mapping: PageMapping,
): string[] {
  const { block, citation } = mapping;
  const sectionRaw = citation.section?.replace(/^Section\s+/i, '').trim() ?? '';
  const quote = citation.quote ? sanitizePdfText(citation.quote) : '';
  const req = sanitizePdfText(requirementText(block));
  const needles = [
    quote,
    quote.length >= 30 ? quote.slice(0, 120) : '',
    req.length >= 30 ? req.slice(0, 120) : '',
    'negative risk assessment result or audit finding',
    'deficiency pertaining to the spc',
    'corrective training or other corrective actions',
    'immediate and effective action',
    sectionRaw,
    sectionRaw.split(/\s+/).slice(0, 2).join(' '),
  ].filter((n) => n && n.length >= 3);
  return [...new Set(needles)];
}

function findEvidenceRegion(
  spans: TextSpan[],
  mapping: PageMapping,
): TextRegion | null {
  for (const needle of buildSearchNeedles(mapping)) {
    const found = findRegionForNeedle(spans, needle);
    if (found) return finalizeRegion(found);
  }
  return null;
}

function groupByLine(spans: TextSpan[], tolerance = 4) {
  const lines: { y: number; spans: TextSpan[] }[] = [];
  for (const span of spans) {
    const line = lines.find((l) => Math.abs(l.y - span.y) <= tolerance);
    if (line) line.spans.push(span);
    else lines.push({ y: span.y, spans: [span] });
  }
  for (const line of lines) {
    line.spans.sort((a, b) => a.x - b.x);
  }
  return lines;
}

function mergeSpans(spans: TextSpan[]): TextRegion {
  const minX = Math.min(...spans.map((s) => s.x));
  const maxX = Math.max(...spans.map((s) => s.x + s.width));
  const minY = Math.min(...spans.map((s) => s.y - s.height));
  const maxY = Math.max(...spans.map((s) => s.y));
  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

async function findPagesForBlock(
  index: PdfTextIndex,
  block: ReferenceComplianceBlock,
  citation: ParsedReferenceCitation,
): Promise<number[]> {
  const hintPage = parsePageNumber(citation.page);
  const mapping: PageMapping = {
    block,
    tier: tierForBlock(block),
    citation,
  };

  const scored: { page: number; score: number }[] = [];

  for (let i = 1; i <= index.numPages; i++) {
    const spans = await index.getSpans(i);
    const region = findEvidenceRegion(spans, mapping);
    let score = region ? 5 : 0;
    if (hintPage === i) score += 2;
    if (score > 0) scored.push({ page: i, score });
  }

  scored.sort((a, b) => b.score - a.score);
  if (scored.length > 0) return [scored[0].page];

  if (hintPage && hintPage >= 1 && hintPage <= index.numPages) {
    return [hintPage];
  }

  return [];
}

async function groupBlocksByPage(
  blocks: ReferenceComplianceBlock[],
  index: PdfTextIndex,
): Promise<Map<number, PageMapping[]>> {
  const byPage = new Map<number, PageMapping[]>();

  for (const block of blocks) {
    const citation = parseReferenceCitation(block.outputResponse);
    const pageNums = await findPagesForBlock(index, block, citation);

    for (const pageNum of pageNums) {
      const pageIndex = pageNum - 1;
      if (!byPage.has(pageIndex)) byPage.set(pageIndex, []);
      byPage.get(pageIndex)!.push({
        block,
        tier: tierForBlock(block),
        citation,
      });
    }
  }

  return byPage;
}

type PdfFont = Awaited<
  ReturnType<
    Awaited<typeof import('pdf-lib')>['PDFDocument']['prototype']['embedFont']
  >
>;

function rectsOverlap(a: OccupiedRect, b: OccupiedRect, gap = 6): boolean {
  return !(
    a.x + a.width + gap < b.x ||
    b.x + b.width + gap < a.x ||
    a.y + a.height + gap < b.y ||
    b.y + b.height + gap < a.y
  );
}

function placeCallout(
  pageW: number,
  pageH: number,
  highlight: TextRegion,
  calloutW: number,
  calloutH: number,
  occupied: OccupiedRect[],
): { x: number; y: number } {
  const anchorY = highlight.y + highlight.height - 8;
  const candidates = [
    { x: highlight.x + highlight.width + 6, y: anchorY },
    { x: Math.max(6, highlight.x - calloutW - 6), y: anchorY },
    { x: highlight.x, y: highlight.y - calloutH - 6 },
    { x: highlight.x, y: highlight.y + highlight.height + 6 },
  ];

  for (const candidate of candidates) {
    const rect: OccupiedRect = {
      x: Math.max(6, Math.min(candidate.x, pageW - calloutW - 6)),
      y: Math.max(6, Math.min(candidate.y, pageH - calloutH - 6)),
      width: calloutW,
      height: calloutH,
    };
    if (!occupied.some((o) => rectsOverlap(rect, o))) {
      return { x: rect.x, y: rect.y };
    }
  }

  let stackY = highlight.y - calloutH - 6;
  for (const o of occupied) {
    stackY = Math.min(stackY, o.y - calloutH - 8);
  }
  return {
    x: Math.max(6, Math.min(highlight.x, pageW - calloutW - 6)),
    y: Math.max(6, stackY),
  };
}

function fullRequirementLines(block: ReferenceComplianceBlock): string[] {
  const point = extractPointNumber(block);
  let text = block.body.trim() || block.title.trim();
  text = text.replace(/^\*\*\s*[\d.]+\s*\*\*\s*/, '').trim();
  if (text && !text.toLowerCase().startsWith(point.toLowerCase())) {
    text = `${point} ${text}`;
  }
  return wrapLines(sanitizePdfText(text), 52, 8);
}

function drawMappingAtRegion(
  page: import('pdf-lib').PDFPage,
  mapping: PageMapping,
  region: TextRegion,
  font: PdfFont,
  fontBold: PdfFont,
  rgb: (r: number, g: number, b: number) => import('pdf-lib').RGB,
  occupied: OccupiedRect[],
): OccupiedRect {
  const { width: pageW, height: pageH } = page.getSize();
  const { block, tier, citation } = mapping;
  const colors = TIER_PDF[tier];
  const fill = rgb(
    colors.fill[0] / 255,
    colors.fill[1] / 255,
    colors.fill[2] / 255,
  );
  const border = rgb(
    colors.border[0] / 255,
    colors.border[1] / 255,
    colors.border[2] / 255,
  );
  const textColor = rgb(
    colors.text[0] / 255,
    colors.text[1] / 255,
    colors.text[2] / 255,
  );

  const pointNum = extractPointNumber(block);
  const status = block.status || 'Unknown';
  const confidence = block.confidence || '—';
  const reqLines = fullRequirementLines(block);

  const pad = 4;
  const highlightX = Math.max(4, region.x - pad);
  const highlightY = Math.max(4, region.y - pad);
  const highlightW = Math.min(region.width + pad * 2, pageW - highlightX - 4);
  const highlightH = Math.min(
    Math.max(region.height + pad * 2, LINE_HEIGHT),
    pageH - highlightY - 4,
  );

  page.drawRectangle({
    x: highlightX,
    y: highlightY,
    width: highlightW,
    height: highlightH,
    color: border,
    opacity: 0.22,
    borderColor: border,
    borderWidth: 2,
  });

  const calloutW = 215;
  const calloutH = 36 + reqLines.length * 7.5;
  const placed = placeCallout(
    pageW,
    pageH,
    {
      x: highlightX,
      y: highlightY,
      width: highlightW,
      height: highlightH,
    },
    calloutW,
    calloutH,
    occupied,
  );
  const calloutX = placed.x;
  const calloutY = placed.y;

  page.drawRectangle({
    x: calloutX,
    y: calloutY,
    width: calloutW,
    height: calloutH,
    color: fill,
    borderColor: border,
    borderWidth: 1.5,
    opacity: 0.96,
  });

  let ty = calloutY + calloutH - 10;
  page.drawText(`${pointNum}  |  ${colors.badge}  |  ${confidence}`, {
    x: calloutX + 5,
    y: ty,
    size: 8,
    font: fontBold,
    color: textColor,
  });
  ty -= 9;

  page.drawText(status.slice(0, 40), {
    x: calloutX + 5,
    y: ty,
    size: 7,
    font: fontBold,
    color: textColor,
  });
  ty -= 8;

  if (citation.section) {
    page.drawText(`Evidence: Section ${citation.section}`.slice(0, 52), {
      x: calloutX + 5,
      y: ty,
      size: 6.5,
      font,
      color: textColor,
    });
    ty -= 8;
  }

  page.drawText('Requirement:', {
    x: calloutX + 5,
    y: ty,
    size: 6.5,
    font: fontBold,
    color: rgb(0.12, 0.16, 0.22),
  });
  ty -= 7.5;

  for (const line of reqLines) {
    page.drawText(line, {
      x: calloutX + 5,
      y: ty,
      size: 6.5,
      font,
      color: rgb(0.12, 0.16, 0.22),
    });
    ty -= 7.5;
  }

  const calloutRect: OccupiedRect = {
    x: calloutX,
    y: calloutY,
    width: calloutW,
    height: calloutH,
  };
  occupied.push(calloutRect);
  occupied.push({
    x: highlightX,
    y: highlightY,
    width: highlightW,
    height: highlightH,
  });
  return calloutRect;
}

async function annotateOriginalPdf(
  file: File,
  blocks: ReferenceComplianceBlock[],
): Promise<Uint8Array> {
  const index = await PdfTextIndex.fromFile(file);
  const byPage = await groupBlocksByPage(blocks, index);

  if (byPage.size === 0) {
    throw new Error(
      'Could not locate mapped pages in PDF. Check Output/Response has Page and Section.',
    );
  }

  const raw = await file.arrayBuffer();
  const pdfLibBytes = raw.slice(0);
  const { PDFDocument, rgb, StandardFonts } = await import('pdf-lib');
  const doc = await PDFDocument.load(pdfLibBytes, { ignoreEncryption: true });
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const pages = doc.getPages();

  let annotatedCount = 0;

  for (const [pageIndex, mappings] of byPage) {
    if (pageIndex < 0 || pageIndex >= pages.length) continue;
    const page = pages[pageIndex];
    const pageNum = pageIndex + 1;
    const occupied: OccupiedRect[] = [];
    const spans = await index.getSpans(pageNum);

    for (const mapping of mappings) {
      const region = findEvidenceRegion(spans, mapping);
      if (!region) continue;
      drawMappingAtRegion(page, mapping, region, font, fontBold, rgb, occupied);
      annotatedCount += 1;
    }
  }

  if (annotatedCount === 0) {
    throw new Error(
      'Could not place highlights on PDF pages. Check Output/Response has Page, Section, and quote text.',
    );
  }

  return doc.save();
}

export type ReferenceMapperPdfInput = {
  message: string;
  referenceFileNames: string[];
  sourceFiles?: File[];
};

export async function downloadReferenceMapperPdf({
  message,
  sourceFiles = [],
}: ReferenceMapperPdfInput): Promise<void> {
  const blocks = parseReferenceComplianceText(message);
  if (blocks.length === 0) {
    throw new Error('No mapping results to export');
  }
  if (!sourceFiles.length) {
    throw new Error('Attach the reference PDF used for mapping');
  }

  const file = sourceFiles[0];
  const finalBytes = await annotateOriginalPdf(file, blocks);

  const blob = new Blob([finalBytes as BlobPart], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const stamp = new Date().toISOString().slice(0, 10);
  const batchSuffix = blocks.length > 1 ? '-batch' : '';
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `bcp-reference-mapper${batchSuffix}-${stamp}.pdf`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

export function mapperPdfFilename(batch = false): string {
  const stamp = new Date().toISOString().slice(0, 10);
  return `bcp-reference-mapper${batch ? '-batch' : ''}-${stamp}.pdf`;
}
