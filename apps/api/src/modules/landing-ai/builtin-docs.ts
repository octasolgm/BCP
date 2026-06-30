import type { ExtractSchemaKey } from './types/landing-ai.types';

export type BuiltinExtractDoc = {
  id: string;
  label: string;
  fileName: string;
  fileHash: string;
  schemaKey: ExtractSchemaKey;
  seedFile: string;
  pointCount: number;
};

export const BUILTIN_EXTRACT_DOCS: BuiltinExtractDoc[] = [
  {
    id: 'gov-tfs-guidelines',
    label: 'TFS Guidelines.pdf (gov)',
    fileName: 'TFS Guidelines.pdf',
    fileHash:
      'c84713f9aacd18415680356aeae47bcacff9c17458b5595b575400b12fe8f2ff',
    schemaKey: 'gov_requirement_points',
    seedFile: 'gov-tfs-guidelines.extract.json',
    pointCount: 96,
  },
  {
    id: 'internal-imptfs',
    label: 'I M P T F S.pdf (internal)',
    fileName: 'I M P T F S.pdf',
    fileHash:
      '6a0a0bd13c7a32ea10c43c9a8391347a7e0caceaa0b17dd6443e9ee622111717',
    schemaKey: 'internal_policy_points',
    seedFile: 'internal-imptfs.extract.json',
    pointCount: 70,
  },
];

export function findBuiltinDoc(
  idOrHash: string,
  schemaKey?: ExtractSchemaKey,
): BuiltinExtractDoc | undefined {
  return BUILTIN_EXTRACT_DOCS.find(
    (d) =>
      d.id === idOrHash ||
      d.fileHash === idOrHash ||
      (schemaKey != null && d.schemaKey === schemaKey && d.id === idOrHash),
  );
}
