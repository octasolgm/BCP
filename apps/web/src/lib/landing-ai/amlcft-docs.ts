/** Hammad AML/CFT gap analysis — default document bundle (public/default-docs/amlcft/). */

export type AmlcftGovDoc = {
  url: string;
  fileName: string;
  pointPrefix: string;
  label: string;
};

export type AmlcftInternalDoc = {
  url: string;
  fileName: string;
  kind: 'pdf' | 'docx';
};

export const AMLCFT_GOV_DOCS: AmlcftGovDoc[] = [
  {
    url: '/default-docs/amlcft/amlcft-cb-uae-decision.pdf',
    fileName: 'amlcft cb uae decision.pdf',
    pointPrefix: 'CD',
    label: 'Cabinet Decision 10/2019',
  },
  {
    url: '/default-docs/amlcft/amlcft-law.pdf',
    fileName: 'AMLCFT LAW.pdf',
    pointPrefix: 'LAW',
    label: 'Federal Decree-Law 10/2025',
  },
];

export const AMLCFT_INTERNAL_DOCS: AmlcftInternalDoc[] = [
  {
    url: '/default-docs/amlcft/internal-aml-manual.pdf',
    fileName: 'Internal AML Manual 290626.pdf',
    kind: 'pdf',
  },
  {
    url: '/default-docs/amlcft/internal-aml-implementation.docx',
    fileName: 'internal -Implementation of AML CFTPF Manual.docx',
    kind: 'docx',
  },
];

export async function fetchDefaultFile(url: string, fileName: string): Promise<File> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load ${fileName}`);
  const blob = await res.blob();
  return new File([blob], fileName, { type: blob.type || undefined });
}

export async function loadAmlcftDefaultGovFiles(): Promise<File[]> {
  return Promise.all(
    AMLCFT_GOV_DOCS.map((d) => fetchDefaultFile(d.url, d.fileName)),
  );
}

export async function loadAmlcftDefaultInternalFiles(): Promise<File[]> {
  return Promise.all(
    AMLCFT_INTERNAL_DOCS.map((d) => fetchDefaultFile(d.url, d.fileName)),
  );
}

export function prefixGovPoints<T extends { point_id: string; title?: string; text: string; section?: string }>(
  points: T[],
  prefix: string,
  sourceLabel: string,
): T[] {
  return points.map((p) => ({
    ...p,
    point_id: `${prefix}:${p.point_id}`,
    title: p.title ? `${sourceLabel} — ${p.title}` : sourceLabel,
    section: p.section ? `${sourceLabel} · ${p.section}` : sourceLabel,
  }));
}

export async function hashFileList(files: File[]): Promise<string> {
  const parts = files.map((f) => `${f.name}:${f.size}`);
  const data = new TextEncoder().encode(parts.sort().join('|'));
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
