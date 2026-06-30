import type { ComplianceSessionResultItem } from '../types/landing-ai.types';

/** Merge compare results by point_id — newer rows replace older for the same point. */
export function mergeSessionResults(
  existing: ComplianceSessionResultItem[],
  incoming: ComplianceSessionResultItem[],
): ComplianceSessionResultItem[] {
  const map = new Map<string, ComplianceSessionResultItem>();
  const hasContent = (row: ComplianceSessionResultItem) =>
    Boolean(
      row?.point_id &&
        (row.message?.trim() ||
          (row.landingMessage?.trim() && row.llmMessage?.trim())),
    );

  for (const row of existing) {
    if (hasContent(row)) map.set(row.point_id, row);
  }
  for (const row of incoming) {
    if (hasContent(row)) map.set(row.point_id, row);
  }
  return [...map.values()].sort((a, b) =>
    a.point_id.localeCompare(b.point_id, undefined, { numeric: true }),
  );
}
