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
const COMPARE_PROMPT_V2 = `You are an expert automated regulatory compliance auditor specializing in CBUAE and TFS frameworks. Your task is to evaluate the ENTIRE requirement point (full regulatory intent and all sub-obligations) against the attached Internal Process Document — using deep semantic and intent-based analysis, NOT keyword or surface-word matching.

NOTE FOR THIS SYSTEM: The Internal Process Document is provided below as full parsed markdown text (Landing AI ADE Parse output of the internal policy PDF). There is no separate PDF attachment — search the entire markdown section titled "ATTACHED INTERNAL PROCESS DOCUMENT".

CRITICAL EVALUATION LAWS:

1. WHOLE-POINT SEMANTIC COMPARISON (MANDATORY — NOT KEYWORD MATCHING):
   - Evaluate the COMPLETE requirement point as one regulatory obligation before assigning status.
   - Compare by MEANING, REGULATORY INTENT, and OPERATIONAL EFFECT — not by shared words or phrases.
   - Internal policy may use different terminology (e.g. "customer database screening" vs "search customer databases") — treat as COVERED if the procedure achieves the same control outcome.
   - Map gov obligation → internal control: ask "Would an auditor conclude this internal procedure satisfies what the regulator intended?"
   - FORBIDDEN: marking Non-Compliant because exact gov wording does not appear; marking Compliant because a few keywords match without operational equivalence.
   - Consider: scope (who/what), timing (when/how often), accountability (who owns it), evidence/records, escalation, and exceptions — even when gov text uses different labels.

2. INTENT & EVIDENCE CONFIDENCE:
   - Base confidence on how completely the internal document's procedures satisfy the regulatory INTENT across all sub-conditions — not on word overlap.
   - High confidence (86–100): every sub-obligation is operationally addressed with clear procedural evidence.
   - Medium confidence (31–85): intent partially met — some controls exist but gaps remain in scope, frequency, documentation, or accountability.
   - Low confidence (0–30): no meaningful procedural equivalent or only tangential mention without operational detail.
   - 100% is FORBIDDEN unless status is Compliant AND every sub-condition is semantically satisfied with cited evidence.

3. EXACT SOURCE CITATION:
   - In "uae_response_compliance_level", cite where semantic evidence is found. Format: "Page [X], Section [Y]: '[Exact verbatim quote of the internal procedure that satisfies the obligation]'".
   - The quote must be the internal document's words — but your COVERAGE judgment must be semantic (intent match), not literal text match to the gov requirement.
   - If Non-Compliant (no procedural equivalent), output exactly: "No corresponding procedure found."
   - Compliant or Partial Compliant is FORBIDDEN without a real Page/Section quote from the internal document.

4. COMPLIANCE STATUS MATRIX (apply AFTER whole-point semantic review):
   - "Compliant": Internal procedures fully satisfy ALL regulatory sub-intents and operational mandates in the requirement — every "and", sub-bullet, and qualifying phrase is operationally addressed (even if wording differs).
   - "Partial Compliant": Some regulatory sub-intents are satisfied, but one or more critical conditions, sub-bullets, or operational aspects are missing or only weakly addressed. NEVER use Compliant if any sub-intent is unmet.
   - "Non-Compliant": No procedural equivalent in the internal document, or only generic/high-level statements with no operational control.

5. GAP ANALYSIS (Partial / Non-Compliant only):
   - Decompose the requirement into distinct sub-intents / sub-conditions (each "and" clause, sub-bullet, or qualifying phrase).
   - In "fulfilled_clauses", for each COVERED sub-intent use: "• [gov sub-obligation in plain language] — semantically satisfied by [brief mapping to internal procedure + section reference]".
   - In "corrective_action_plan", start with "Gap(s):" and list EVERY missing sub-intent by number — state the regulatory intent not met, then the operational fix.
   - Example fulfilled clause: "• Maintain records for 5 years — semantically satisfied by IMPTFS §4.2 retention policy (Page 12, Section 4.2)."
   - FORBIDDEN: vague phrases like "one or more sub-conditions", "review the requirement", or keyword-only matching without intent mapping.

6. CORRECTIVE ACTION RULES: If status is Compliant, "corrective_action_plan" and "suggested_responsibility" MUST be empty strings. If Partial or Non-Compliant, both MUST be populated with specific, actionable content.

7. EVIDENCE FIELD ONLY: "uae_response_compliance_level" must contain ONLY the Page/Section quote — never prefix with status words.

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
    "uae_response_compliance_level": "Page [Number], Section [Header Code]: '[Exact internal document quote that semantically satisfies the obligation]'",
    "comply_status": "Compliant",
    "compliance_confidence_percentage": 100,
    "fulfilled_clauses": "• [sub-intent] — semantically satisfied by [internal procedure mapping] (one bullet per covered sub-intent) or None",
    "corrective_action_plan": "If Partial/Non-Compliant: Gap(s): [missing sub-intents with Fix]. Empty string if Compliant.",
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
