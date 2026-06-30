# BCP Compliance Pipeline

Gov requirements (TFS) vs internal policy (IMPTFS).

- **Phase 1** = **Landing AI** gap analysis (one call per gov point)
- **Phase 2** = **LLM** checks Phase 1 — default **Gemini 3.5 Flash** (dual verify only)

---

## Process steps

**1. Parse IMPTFS PDF (once)**

- **Model:** `dpt-2-latest`
- **API:** `POST /landing-ai/parse`
- **YOU SEND:** IMPTFS PDF file
- **YOU GET BACK:** Markdown text → saved Supabase

---

**2. Gov points — extract OR load from DB**

Option A — extract from gov PDF:

- **Model:** `extract-latest`
- **API:** `POST /landing-ai/extract-gov-points`
- **YOU SEND:** Gov PDF file + schema `gov-requirement-points.schema.json`
- **YOU GET BACK:** JSON list of points (`point_id`, `title`, `text`)

Option B — load free (no AI):

- **API:** `GET /landing-ai/stored-points?docId=gov-tfs-guidelines`
- **YOU GET BACK:** Same JSON point list from Supabase

---

**3. Phase 1 — compare (Landing AI · one call per gov point, loop)**

- **Service:** Landing AI
- **Model:** `extract-latest`
- **API:** `POST /landing-ai/compare-point` → Landing AI `POST /v1/ade/extract`
- **YOU SEND:**
  - Prompt → [`COMPARE_PROMPT_V2`](#prompt-phase-1)
  - Full IMPTFS **markdown** (from step 1)
  - One gov **point text** (from step 2)
  - Schema → [`compliance-comparison-v2`](#schema-phase-1)
- **YOU GET BACK:** JSON (one point) → shown as gap record on screen

---

**4. Phase 2 — dual verify (LLM · one call per gov point, loop)**

- **Service:** LLM — **Gemini** (default) or GPT (UI dropdown)
- **Default model:** `gemini-3.5-flash`
- **API:** `POST /ai/bcpanalyze`
- **YOU SEND:**
  - Prompt Part A → [`REFERENCE_MAP_PROMPT`](#prompt-phase-2a)
  - Prompt Part B → [`DUAL VERIFY addendum`](#prompt-phase-2b)
  - Phase 1 result **for this same point only** (not all points)
  - One gov point text
  - IMPTFS **PDF file**
- **YOU GET BACK:** Plain text gap record (this point)

---

**5. Save / load analysis**

- **API:** `POST /landing-ai/compliance-sessions` · `GET /landing-ai/compliance-sessions`
- **YOU SEND / GET BACK:** JSON session (all point results)

---

## Flow

```
Prepare: gov points (step 2) + IMPTFS markdown (step 1)
    ↓
Phase 1 loop (step 3) — Landing AI · one point at a time
    ↓
Phase 2 loop (step 4) — LLM (default Gemini 3.5 Flash) · one point at a time
    ↓
Compare Phase 1 vs Phase 2 → save (step 5)
```

50 points selected = 50 Phase 1 calls + 50 Phase 2 calls.

---

# Full prompts & schema

<a id="prompt-phase-1"></a>

## COMPARE_PROMPT_V2 (Phase 1)

File: `apps/api/src/modules/landing-ai/prompts/compliance-compare-prompts.ts`

```
You are an expert automated regulatory compliance auditor specializing in CBUAE and TFS frameworks. Your task is to evaluate the ENTIRE requirement point (full regulatory intent and all sub-obligations) against the attached Internal Process Document — using deep semantic and intent-based analysis, NOT keyword or surface-word matching.

NOTE FOR THIS SYSTEM: The Internal Process Document is provided below as full parsed markdown text (Landing AI ADE Parse output of the internal policy PDF). There is no separate PDF attachment — search the entire markdown section titled "ATTACHED INTERNAL PROCESS DOCUMENT".

CRITICAL EVALUATION LAWS:

1. WHOLE-POINT SEMANTIC COMPARISON (MANDATORY — NOT KEYWORD MATCHING):
   - Evaluate the COMPLETE requirement point as one regulatory obligation before assigning status.
   - Compare by MEANING, REGULATORY INTENT, and OPERATIONAL EFFECT — not by shared words or phrases.
   - Internal policy may use different terminology — treat as COVERED if the procedure achieves the same control outcome.
   - FORBIDDEN: Non-Compliant because gov wording absent; Compliant from keyword overlap only.

2. INTENT & EVIDENCE CONFIDENCE:
   - Confidence = semantic completeness of intent coverage (not word overlap).
   - High 86–100 / Medium 31–85 / Low 0–30. 100% forbidden unless fully Compliant.

3. EXACT SOURCE CITATION:
   - uae_response_compliance_level: Page [X], Section [Y]: 'verbatim internal quote'
   - Non-Compliant → exactly: "No corresponding procedure found."

4. COMPLIANCE STATUS MATRIX:
   - Compliant | Partial Compliant | Non-Compliant

5. GAP ANALYSIS (Partial / Non-Compliant):
   - fulfilled_clauses: "• [sub-intent] — semantically satisfied by [procedure + section]"
   - corrective_action_plan: "Gap(s):" + numbered missing sub-intents + Fix

6. CORRECTIVE ACTION RULES: Empty CAP when Compliant.

7. EVIDENCE FIELD ONLY: No status prefix in uae_response_compliance_level.

Output: one JSON object matching schema. No markdown fences. No conversational text.

---
INPUT DATA:

ATTACHED INTERNAL PROCESS DOCUMENT ({filename} — parsed markdown):
{full IMPTFS markdown}

REQUIREMENT POINT TO CHECK:
{point_id} {title}
{gov obligation text}
```

<a id="schema-phase-1"></a>

## compliance-comparison-v2.schema.json (Phase 1 output)

File: `apps/api/src/modules/landing-ai/schemas/compliance-comparison-v2.schema.json`

Returns JSON fields: `requirement_id` · `requirement_text` · `uae_response_compliance_level` · `comply_status` · `compliance_confidence_percentage` · `fulfilled_clauses` · `corrective_action_plan` · `suggested_responsibility`

<a id="prompt-phase-2a"></a>

## REFERENCE_MAP_PROMPT (Phase 2 Part A — answer format)

File: `apps/web/src/lib/ai-lab/constants.ts`

```
You are an expert compliance reference mapper for CBUAE and TFS frameworks. Your task is to map each requirement point to exact evidence in the attached reference PDF file(s) and show what compliance is fulfilled.

CRITICAL RULES:
1. SEARCH ALL ATTACHED PDFs — evidence may be in any attached file.
2. REFERENCE PDF — output exact filename (e.g. "I M P T F S.pdf").
3. OUTPUT/RESPONSE — Page [X], Section [Y]: 'verbatim quote'. Non-Compliant → "No corresponding procedure found."
4. FULFILLED CLAUSES — bullet lines "• " for each covered sub-part. Non-Compliant → "None".
5. COMPLIANCE STATUS — Compliant / Partial Compliant / Non-Compliant
6. CONFIDENCE — 0–100%

Output format (plain text, NOT JSON):

Reference PDF :
Output/Response :
Fulfilled clauses :
Comply Yes/No (Status) :
Compliance Confidence % :
Corrective Action Plan :
Responsibility :

---
INPUT DATA:

REQUIREMENT POINT TO CHECK:
```

<a id="prompt-phase-2b"></a>

## DUAL VERIFY addendum (Phase 2 Part B)

File: `apps/web/src/lib/landing-ai/dual-verify-prompt.ts`

```
DUAL VERIFICATION PIPELINE — PASS 2 (INDEPENDENT)
You are the second verifier. Landing AI (Pass 1) already analyzed this requirement. Re-read the attached internal PDF(s) yourself and produce your own assessment.

Rules:
1. Do NOT copy Pass 1 blindly — independently find evidence and assign status/confidence.
2. Use the same output format as Pass 1.
3. If you disagree with Pass 1, explain in Output/Response or CAP.

LANDING AI PASS 1 (reference only):
---
{Phase 1 gap record for this point}
---

REQUIREMENT POINT TO CHECK:
{point_id} {title}
{gov text}
```
