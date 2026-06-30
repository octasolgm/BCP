import type { GovRequirementPoint } from '../types/landing-ai.types';
import { cleanLegacyPromptFromRequirementText } from '../utils/gov-point-filter';

export type ComparePromptVersion = 'v1' | 'v2';

/** Clean gov extract text only — inserted under REQUIREMENT POINT TO CHECK (never shown as prompt on web). */
export function formatGovRequirementForPrompt(point: GovRequirementPoint): string {
  const head = [point.point_id, point.title].filter(Boolean).join(' ');
  const body = cleanLegacyPromptFromRequirementText(point.text);
  return head ? `${head}\n\n${body}` : body;
}

/**
 * v2 — CBUAE/TFS auditor prompt (default).
 * Based on the user-provided auditor template, adapted for BCP:
 * - Internal policy arrives as parsed markdown (ADE Parse / Supabase), not a PDF binary.
 * - Gov requirement text is injected under REQUIREMENT POINT TO CHECK (from DB extract).
 * - Landing AI ADE Extract applies compliance-comparison-v2.schema.json to the response.
 */
const COMPARE_PROMPT_V2 = `You are an expert automated regulatory compliance auditor specializing in CBUAE and TFS frameworks. Your task is to evaluate the provided single requirement point against the attached Internal Process Document to determine its compliance status, verify the exact proof location, and calculate a confidence metric.

NOTE FOR THIS SYSTEM: The Internal Process Document is provided below as full parsed markdown text (Landing AI ADE Parse output of the internal policy PDF). There is no separate PDF attachment — search the entire markdown section titled "ATTACHED INTERNAL PROCESS DOCUMENT".

CRITICAL EVALUATION LAWS:
1. DEEP SEMANTIC MATCHING: Perform a semantic analysis comparing the provided text under "REQUIREMENT POINT TO CHECK" against the contents of the attached internal document below. Look for literal matching concepts, operational frameworks, or direct procedural overlaps.
2. EXACT SOURCE CITATION: In the "uae_response_compliance_level" field, you MUST locate where the evidence is found in the attached document. Format it precisely as: "Page [X], Section [Y]: '[Exact verbatim quote of the matching sentence or procedure]'". If the requirement is Non-Compliant, output exactly: "No corresponding procedure found." Compliant or Partial Compliant is FORBIDDEN unless this field contains a real Page/Section quote from the internal document — never leave it empty.
3. COMPLIANCE STATUS MATRIX: Assign status based on the following rules:
   - "Compliant": The internal document fully covers ALL operational mandates and sub-conditions in the requirement text — every "and", sub-bullet, and qualifying phrase must be explicitly addressed. Use only when nothing is missing.
   - "Partial Compliant": The internal document covers some aspects, but leaves out one or more critical conditions, sub-bullets, or specific requirements. NEVER use Compliant if anything is missing.
   - "Non-Compliant": There is no procedural mention or matching evidence in the internal document.
4. CONFIDENCE METRIC: Calculate a precise compliance confidence percentage (0 to 100). 100% is FORBIDDEN unless status is Compliant and every sub-condition is explicitly covered. Partial Compliant: 31–85%. Non-Compliant: 0–30%.
5. GAP ANALYSIS (Partial / Non-Compliant only): Split the requirement into distinct sub-conditions (each "and" clause, sub-bullet, or qualifying phrase is a separate sub-condition). In "fulfilled_clauses", use bullet lines starting with • for each sub-condition that IS covered (or "None" if Non-Compliant). In "corrective_action_plan", start with "Gap(s):" and list EVERY missing sub-condition by number — quote or paraphrase the exact obligation text, then state the operational fix. Example: "Gap(s): (1) Missing: ensure transparency of any system limitations or risk-based decisions that screening controls are not designed to detect. Fix: Add §7.2 subsection documenting known screening exclusions and risk acceptance." FORBIDDEN: vague phrases like "one or more sub-conditions", "review the requirement", or "document the missing controls" without naming each specific gap.
6. CORRECTIVE ACTION RULES: If status is Compliant, "corrective_action_plan" and "suggested_responsibility" MUST be empty strings. If status is Partial Compliant or Non-Compliant, both fields MUST be populated with specific, actionable content — never leave them empty and never use generic gap wording.
7. EVIDENCE FIELD ONLY: "uae_response_compliance_level" must contain ONLY the Page/Section quote — never prefix with "Partial Compliant:", "Compliant:", or status words.

Use page numbers and section headings from the internal document markdown (page markers from the original PDF parse). Do not guess page numbers.

ABSOLUTE SYSTEM OUTPUT MATRIX (ZERO EXCEPTION):
- Populate every required JSON schema field with structured values only.
- Output exactly one evaluation object matching the schema (fields below). If returning an array wrapper, it must contain exactly one object.
- Do NOT wrap output in markdown code blocks (do NOT use \`\`\`json or \`\`\`).
- Do NOT include any leading, trailing, or accompanying conversational text sentences.

Follow this exact JSON structural schema:
[
  {
    "requirement_id": "The exact clause number and header title being evaluated (e.g., '2.4. Internal Controls')",
    "requirement_text": "The explicit rule or obligation text provided under REQUIREMENT POINT TO CHECK",
    "uae_response_compliance_level": "Page [Number], Section [Header Code]: '[Exact matching quote from the attached internal document]'",
    "comply_status": "Compliant",
    "compliance_confidence_percentage": 100,
    "fulfilled_clauses": "• Sub-condition covered (one bullet per covered item) or None",
    "corrective_action_plan": "If Partial/Non-Compliant: Gap(s): [list missing sub-conditions], then operational fix. Empty string if Compliant.",
    "suggested_responsibility": "Department or role for the fix. Empty string if Compliant."
  }
]

comply_status must be strictly one of: "Compliant" | "Partial Compliant" | "Non-Compliant".`;

/** v1 — original BCP compare prompt (kept for reference / LANDING_AI_COMPARE_PROMPT_VERSION=v1). */
export function buildComparisonMarkdownV1(
  point: GovRequirementPoint,
  internalMarkdown: string,
  internalFileName: string,
): string {
  const requirement = formatGovRequirementForPrompt(point);
  return `# COMPLIANCE COMPARISON TASK

You are comparing a government regulatory requirement against an internal policy document.
The internal document below is Landing AI ADE parse output — preserve page markers, section headings, and verbatim wording when citing evidence.

## Rules
1. Search the ENTIRE internal policy markdown for evidence that satisfies the requirement.
2. output_response MUST use format: Page [X], Section [Y] [Title]: 'verbatim quote from internal markdown'
3. Use page numbers from parse markdown page markers (not guessed page numbers).
4. fulfilled_clauses: bullet lines starting with • for each sub-condition covered.
5. status: Compliant | Partial Compliant | Non-Compliant (strict gap analysis).
6. confidence: 0-100 integer aligned with status (Compliant with full coverage ≥ 85).

---

## GOVERNMENT REQUIREMENT POINT

${requirement}

---

## INTERNAL POLICY DOCUMENT: ${internalFileName}

${internalMarkdown}
`;
}

/** v2 — CBUAE/TFS auditor prompt (default for compare). */
export function buildComparisonMarkdownV2(
  point: GovRequirementPoint,
  internalMarkdown: string,
  internalFileName: string,
): string {
  const requirement = formatGovRequirementForPrompt(point);
  return `${COMPARE_PROMPT_V2}

---
INPUT DATA:

ATTACHED INTERNAL PROCESS DOCUMENT (${internalFileName} — parsed markdown from internal policy PDF; search this entire section):

${internalMarkdown}

REQUIREMENT POINT TO CHECK:

${requirement}
`;
}

export function buildComparisonMarkdown(
  version: ComparePromptVersion,
  point: GovRequirementPoint,
  internalMarkdown: string,
  internalFileName: string,
): string {
  return version === 'v2'
    ? buildComparisonMarkdownV2(point, internalMarkdown, internalFileName)
    : buildComparisonMarkdownV1(point, internalMarkdown, internalFileName);
}

export function getCompareSchemaKey(
  version: ComparePromptVersion,
): 'compliance_comparison' | 'compliance_comparison_v2' {
  return version === 'v2' ? 'compliance_comparison_v2' : 'compliance_comparison';
}
