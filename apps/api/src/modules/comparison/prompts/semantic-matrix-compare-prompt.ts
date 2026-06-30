export function buildSemanticMatrixComparePrompt(params: {
  granularFileName: string;
  executiveFileName: string;
  granularTable: string;
  executiveTable: string;
  granularRowCount: number;
  executiveRowCount: number;
}): string {
  const {
    granularFileName,
    executiveFileName,
    granularTable,
    executiveTable,
    granularRowCount,
    executiveRowCount,
  } = params;

  return `You are an expert regulatory compliance auditor specializing in CBUAE (Central Bank of the UAE) frameworks, Cabinet Decision No. 74, and Target Financial Sanctions (TFS).

You are given TWO structured compliance spreadsheets (not PDFs). Conduct a rigorous SEMANTIC legal comparison — not a simple text diff. Read meaning, compliance status, evidence, and gaps.

FILE 1 — GRANULAR INSPECTION MATRIX (${granularRowCount} data rows):
Filename: "${granularFileName}"
Typical columns: Ref, Requirement Area, Granular Sub-Requirement, Evidence in IMPTFS Manual, Evidence in SCP Policy, Compliance Status (Met / Partially Met / Not Met), Confidence %, Gap / Remediation Note.

${granularTable}

---

FILE 2 — EXECUTIVE / LEAF CHECKLIST (${executiveRowCount} data rows):
Filename: "${executiveFileName}"
Typical columns: requirement text, UAE Response / Compliance Level, Comply Yes/No (Yes / Partial / No), Action Plan, Confidence %, What Fulfills.

${executiveTable}

---

STRUCTURAL MAPPING RULES (apply before comparing):
1. Map executive leaf points (e.g. 2.1.1, 2.5.3) to granular matrix Refs (e.g. 2.1-1, 2.5-3).
2. One executive section row (e.g. 2.1 Senior Management) may cover multiple granular Ref rows under the same Requirement Area.
3. Compare SEMANTICALLY: "Yes" / "Compliant" / "Met" vs "Partial" / "Partially Met" / active gap notes are contradictions even if wording differs slightly.
4. Flag every case where File 2 claims full compliance ("Yes", "Compliant", "Met") but File 1 shows "Partially Met", "Not Met", partial confidence, or an active gap/remediation note.
5. Identify IMPTFS Manual vs SCP Policy contradictions inside File 1 (conflicting review cycles, ownership, procedures).

OUTPUT FORMAT — use EXACTLY these markdown section headers (### level):

### 1. Executive Semantic Alignment Summary
- Overall semantic overlap assessment (percentage estimate and narrative).
- Explain how high-level blocks in the executive file map to atomic sub-requirements in the granular matrix.
- Count how many mapped pairs align vs conflict.

### 2. Comprehensive Discrepancy & Gap Analysis
List EVERY mismatch where the executive file implies full compliance but the granular matrix flags partial/non-compliance or documents a gap.

For EACH mismatch use this sub-block (repeat for all):

#### Ref [ID] — [Requirement Area]
- **Point Reference / ID:** (e.g. Ref 2.1-2, executive point 2.1.2)
- **Requirement Area:** (e.g. Senior Management Commitment)
- **Executive claim:** (what File 2 says — status, confidence, key quote)
- **Granular finding:** (what File 1 says — status, confidence, gap note)
- **The Core Conflict:** (exact missing or mismatched process/requirement)
- **Document Contradiction:** (IMPTFS vs SCP conflict if applicable, else "None identified")

If no mismatches exist, state that explicitly with evidence.

### 3. Immediate Remediation Roadmap
Numbered, actionable SCP Policy / documentation updates to satisfy both files and pass a strict CBUAE/TFS audit. Be specific — cite Ref IDs and exact policy clauses to add or change.

---

After section 3, append a JSON block for machine parsing (no extra commentary):

\`\`\`json
{
  "alignmentScorePercent": 0,
  "mappedPairs": 0,
  "alignedPairs": 0,
  "mismatchCount": 0,
  "mismatches": [
    {
      "ref": "2.1-2",
      "executivePoint": "2.1.2",
      "requirementArea": "",
      "executiveClaim": "",
      "granularFinding": "",
      "coreConflict": "",
      "documentContradiction": ""
    }
  ],
  "remediationItems": [
    { "priority": 1, "ref": "2.1-2", "action": "" }
  ]
}
\`\`\`

Be precise. Omit generic compliance definitions. Focus on literal text gaps and structural variations between these two files.`;
}

export function formatMatrixAsTable(
  headers: string[],
  rows: string[][],
  maxCellLen = 1200,
): string {
  const clip = (s: string) => {
    const t = (s ?? '').replace(/\s+/g, ' ').trim();
    if (t.length <= maxCellLen) return t;
    return `${t.slice(0, maxCellLen)}… [truncated]`;
  };

  const head = headers.map((h) => clip(h)).join(' | ');
  const lines = [head, headers.map(() => '---').join(' | ')];

  for (const row of rows) {
    const cells = headers.map((_, i) => clip(row[i] ?? ''));
    lines.push(cells.join(' | '));
  }

  return lines.join('\n');
}
