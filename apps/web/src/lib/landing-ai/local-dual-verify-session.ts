/** Browser backup when Supabase compliance_sessions table is unavailable. */

export type LocalDualVerifyResult = {
  point_id: string;
  title?: string;
  text: string;
  message: string;
  landingMessage?: string;
  llmMessage?: string;
  agreementJson?: unknown;
};

export type LocalDualVerifySession = {
  id: string;
  sessionKey: string;
  granularity: string;
  govFileHash: string;
  internalFileHash: string;
  govFileName: string;
  internalFileName: string;
  totalGovPoints: number;
  comparedPoints: number;
  skippedPoints: number;
  skippedJson: unknown;
  resultsJson: LocalDualVerifyResult[];
  summaryJson: Record<string, unknown>;
  updatedAt: string;
};

const STORAGE_PREFIX = 'bcp-dual-verify-session:';

function storageKey(sessionKey: string): string {
  return `${STORAGE_PREFIX}${sessionKey}`;
}

export function saveLocalDualVerifySession(
  session: LocalDualVerifySession,
): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(storageKey(session.sessionKey), JSON.stringify(session));
  } catch {
    /* quota / private mode */
  }
}

export function loadLocalDualVerifySession(
  sessionKey: string,
): LocalDualVerifySession | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(storageKey(sessionKey));
    if (!raw) return null;
    return JSON.parse(raw) as LocalDualVerifySession;
  } catch {
    return null;
  }
}

export function listLocalDualVerifySessions(
  granularity?: string,
): LocalDualVerifySession[] {
  if (typeof window === 'undefined') return [];
  const out: LocalDualVerifySession[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key?.startsWith(STORAGE_PREFIX)) continue;
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const session = JSON.parse(raw) as LocalDualVerifySession;
      if (granularity && session.granularity !== granularity) continue;
      out.push(session);
    }
  } catch {
    return [];
  }
  return out.sort(
    (a, b) =>
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
}

export function loadLocalDualVerifySessionById(
  id: string,
): LocalDualVerifySession | null {
  return (
    listLocalDualVerifySessions().find((s) => s.id === id) ??
    listLocalDualVerifySessions().find((s) => `local:${s.sessionKey}` === id) ??
    null
  );
}
