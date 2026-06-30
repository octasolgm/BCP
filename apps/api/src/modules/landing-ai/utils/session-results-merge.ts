import type { ComplianceSessionResultItem } from '../types/landing-ai.types';

/** Merge compare results by point_id — newer rows replace older for the same point. */
export function mergeSessionResults(
  existing: ComplianceSessionResultItem[],
  incoming: ComplianceSessionResultItem[],
): ComplianceSessionResultItem[] {
  const map = new Map<string, ComplianceSessionResultItem>();
  for (const row of existing) {
    if (row?.point_id && row.message?.trim()) {
      map.set(row.point_id, row);
    }
  }
  for (const row of incoming) {
    if (row?.point_id && row.message?.trim()) {
      map.set(row.point_id, row);
    }
  }
  return [...map.values()].sort((a, b) =>
    a.point_id.localeCompare(b.point_id, undefined, { numeric: true }),
  );
}
