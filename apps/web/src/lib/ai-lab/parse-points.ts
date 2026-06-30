const NEW_POINT_LINE =
  /^(?:\d+(?:\.\d+)*\s+\S|[-•*]\s+\S|[A-Z]{2,}-\d+)/;

/**
 * Split pasted requirement text into individual points for batch analyze.
 * 1. Blank-line blocks (multi-line points)
 * 2. Lines starting with numbering (2.0.1 …) or bullets
 * 3. Fallback: one non-empty line per point
 */
export function parseRequirementPoints(text: string): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  const blankBlocks = trimmed
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean);
  if (blankBlocks.length > 1) return blankBlocks;

  const lines = trimmed.split('\n');
  const merged: string[] = [];
  let current: string[] = [];

  for (const line of lines) {
    const t = line.trim();
    if (!t) continue;

    if (NEW_POINT_LINE.test(t) && current.length > 0) {
      merged.push(current.join('\n').trim());
      current = [line];
    } else {
      current.push(line);
    }
  }

  if (current.length > 0) {
    merged.push(current.join('\n').trim());
  }

  if (merged.length > 1) return merged.filter(Boolean);

  return trimmed
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
}
