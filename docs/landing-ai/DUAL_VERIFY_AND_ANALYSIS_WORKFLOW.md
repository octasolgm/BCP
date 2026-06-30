# BCP Analysis Workflow — Team Lead Summary

**For:** Team leads · **Branch:** `feature/dual-verify-pipeline`  
**Stack:** Landing AI Phase 1 (semantic gap analysis) + Gemini/GPT Phase 2 (verification)

---

## Which doc to read?

| Document | Use for |
|----------|---------|
| **This file** | Quick box diagrams, URLs, models, prompts — team lead handout |
| [COMPLIANCE_GAP_ANALYSIS_ARCHITECTURE.md](./COMPLIANCE_GAP_ANALYSIS_ARCHITECTURE.md) | Full technical architecture: CAP layers, payloads, API sequence, semantic compare |
| [COMPLIANCE_ANALYSIS_QUALITY_FRAMEWORK.md](./COMPLIANCE_ANALYSIS_QUALITY_FRAMEWORK.md) | Auditor workflow, sign-off gates, professional output standard |
| [doc.md](./doc.md) | Landing AI ADE API reference |

---

## Pages at a glance

| Page | URL | What it does |
|------|-----|--------------|
| Phase 1 — section | `/landing-ai` | Landing AI **semantic gap analysis** per **section** (2.1, 2.2 …) |
| Phase 1 — leaf | `/landing-ai/detail` | Gap analysis per **sub-point** (2.1.1, 2.1.2 …) |
| Dual verify — section | `/landing-ai/dual-verify` | Phase 1 → Phase 2 verify → agreement |
| Dual verify — leaf | `/landing-ai/dual-verify/detail` | Same pipeline, per sub-point (**recommended for final packs**) |
| Semantic matrix | Workbench top panel | LLM gap compare: granular matrix vs executive checklist |

**Section** = rolled-up blocks. **Leaf** = individual nested obligations (highest precision).

**Gov points:** upload TFS PDF → **Extract live**, or **Load from Supabase** (free).

**Analysis history:** saved to Supabase after each point. Reload prior runs without credits. Keys: `section` / `leaf` / `dual-section` / `dual-leaf`.

**Phase 1 compare method:** whole-point **semantic / intent** match (regulatory obligation ↔ internal control by operational effect) — **not keyword matching**. Different IMPTFS wording can still be Compliant if intent is satisfied.

---

## 1. Phase 1 only — per-point semantic gap analysis (Landing AI)

Not a single document compare. **One API call per gov point.**

```
┌─────────────┐     ┌─────────────┐
│ Load gov    │ OR  │ Extract gov │  Live PDF → Landing AI (credits)
│ from DB     │     │ live        │  OR Supabase (free)
└──────┬──────┘     └──────┬──────┘
       └──────────┬────────┘
                  ▼
┌─────────────┐
│ IMPTFS doc  │  Parsed markdown in Supabase (parse PDF once)
└──────┬──────┘
       ▼
┌─────────────────────────────────────────────────────────┐
│ FOR EACH gov point (section or leaf)                     │
│   Phase 1 — Landing AI compare-point                     │
│   • Semantic intent compare (whole point, not keywords)  │
│   • Evidence quote · fulfilled clauses (intent map)    │
│   • GAP(s) in CAP · status · confidence · responsibility│
└──────┬──────────────────────────────────────────────────┘
       ▼
┌─────────────┐     ┌─────────────────────┐
│ Gap results │     │ Save to Supabase    │  Auto after each point
│ Web · PDF   │     │ Load previous runs  │  Reload free
└─────────────┘     └─────────────────────┘
```

**CAP (Corrective Action Plan):** only when Partial / Non-Compliant — numbered `Gap(s): (1) Missing: [sub-intent] … Fix: …`. Compliant → CAP = N/A. Detail: [architecture §4](./COMPLIANCE_GAP_ANALYSIS_ARCHITECTURE.md#4-phase-1-cap--how-it-is-built).

---

## 2. Dual verify — Phase 1 + Phase 2 (recommended for sign-off)

Phase 2 **does not replace** Phase 1. It **re-reads IMPTFS PDF** and checks whether Phase 1 gap analysis is correct — catching false Compliant, missed gaps, weak quotes, incomplete CAPs.

```
┌─────────────┐     ┌─────────────┐
│ Load gov    │ OR  │ Extract gov │
│ from DB     │     │ live        │
└──────┬──────┘     └──────┬──────┘
       └──────────┬────────┘
                  ▼
┌─────────────┐
│ Attach      │  IMPTFS PDF (Phase 2 reads PDF directly)
│ IMPTFS PDF  │
└──────┬──────┘
       ▼
┌─────────────┐
│ Choose AI   │  Gemini or GPT — Phase 2 only
│ model       │
└──────┬──────┘
       ▼
┌──────────────────────────────────────────────────────────┐
│ FOR EACH selected point                                   │
│                                                           │
│  ┌─────────────────────┐                                 │
│  │ PHASE 1             │  Landing AI semantic gap analysis│
│  │ Landing AI          │  IMPTFS = parsed markdown        │
│  │ extract-latest      │  (per point — same as §1)        │
│  └──────────┬──────────┘                                 │
│             ▼                                             │
│  ┌─────────────────────┐                                 │
│  │ PHASE 2             │  Independent re-read of PDF      │
│  │ Gemini / GPT        │  Validates / challenges Phase 1  │
│  │                     │  Fills or corrects gap findings  │
│  └──────────┬──────────┘                                 │
│             ▼                                             │
│  ┌─────────────────────┐                                 │
│  │ Agreement check     │  Aligned · confidence gap ·      │
│  │                     │  mismatch → human review         │
│  └─────────────────────┘                                 │
└──────────────────────────────────────────────────────────┘
       ▼
┌─────────────┐     ┌─────────────────────┐
│ Side-by-side│     │ Save to Supabase    │  Pass 1 + Pass 2 + agreement
│ gap records │     │ Load previous runs  │  dual-section / dual-leaf
└─────────────┘     └─────────────────────┘
```

**Phase 1 vs Phase 2 input (key difference):**

| | Phase 1 | Phase 2 |
|---|---------|---------|
| Internal doc | Parsed **markdown** (Supabase) | **PDF file** (Gemini) |
| Compare type | Semantic intent via ADE Extract | Independent PDF re-read + chat prompt |
| Model | `extract-latest` | User-selected Gemini/GPT |

**Phase 2 prevents (when flagged):** false Compliant · missed sub-intents · wrong evidence · vague CAP · over-confidence · parse blind spots.

**Status mismatch = blocking** until a compliance reviewer resolves (see [Quality Framework](./COMPLIANCE_ANALYSIS_QUALITY_FRAMEWORK.md)).

---

## 3. Semantic matrix compare (two files)

```
┌──────────────────┐     ┌──────────────────┐
│ Granular matrix  │     │ Executive        │
│ (.xlsx / .csv)   │     │ checklist (.xlsx)│
└────────┬─────────┘     └────────┬─────────┘
         └──────────┬─────────────┘
                    ▼
         ┌──────────────────────┐
         │ LLM semantic compare │
         │ → gaps · remediation │
         └──────────┬───────────┘
                    ▼
         ┌──────────────────────┐
         │ Excel report download│
         └──────────────────────┘
```

---

## Models & what each phase receives

| Phase | Model | Output type | What is sent |
|-------|--------|-------------|--------------|
| **Phase 1** | **`extract-latest`** (Landing AI) | **JSON** → formatted text in UI | `POST /v1/ade/extract`: `model` + `schema` (v2) + `markdown` blob = prompt + **full IMPTFS markdown** + **one gov point** |
| **Phase 2** | **`gemini-2.5-flash-lite`** default (or user pick) | **Plain text** (no JSON) | `POST /ai/bcpanalyze`: `prompt` (REFERENCE_MAP + dual-verify rules + Phase 1 text + gov point) + **IMPTFS PDF** |

| Prep step | Model | Sent to Landing AI |
|-----------|--------|-------------------|
| Parse IMPTFS | `dpt-2-latest` | PDF binary → markdown cache |
| Extract gov | `extract-latest` | Gov PDF → points JSON |

**Full prompts, JSON schema, example responses:** [architecture §5](./COMPLIANCE_GAP_ANALYSIS_ARCHITECTURE.md#5-models-prompts-payloads-and-output-formats)

**Phase 2 AI options:** `gemini-2.5-flash-lite`, `gemini-2.5-flash`, `gemini-3.5-flash`, `gemini-3.1-pro-preview`, `gpt-4o`, `gpt-4o-mini`, `gpt-3.5-turbo`, `gpt-5` (GPT = no PDF attach)

**Env:** `VISION_AGENT_API_KEY`, `GEMINI_API_KEY`, Azure keys for GPT

---

## Prompts (source files + output)

### Phase 1 — Landing AI (`compliance-compare-prompts.ts` v2)

- **Prompt:** CBUAE/TFS semantic auditor — whole-point intent compare, 7 evaluation laws, gap/CAP rules
- **Schema:** `compliance-comparison-v2.schema.json` — 8 required JSON fields
- **Sent as:** ADE Extract `markdown` field (prompt + IMPTFS markdown + gov point) + `schema` field
- **Model returns JSON:**

```json
{
  "uae_response_compliance_level": "Page X, Section Y: 'quote'",
  "comply_status": "Partial Compliant",
  "compliance_confidence_percentage": 62,
  "fulfilled_clauses": "• … — semantically satisfied by …",
  "corrective_action_plan": "Gap(s): (1) Missing: … Fix: …",
  "suggested_responsibility": "Compliance Team"
}
```

- **UI shows:** formatted text (Reference PDF, Output/Response, Fulfilled clauses, Status, Confidence %, CAP, Responsibility)

### Phase 2 — Gemini/GPT (`dual-verify-prompt.ts` + `REFERENCE_MAP_PROMPT`)

- **Part A:** Reference mapper — map gov point to PDF evidence, strict gap analysis
- **Part B:** Dual verify — re-read PDF independently, do not copy Pass 1; include Phase 1 message as reference
- **Sent as:** `prompt` string + PDF file (Gemini)
- **Model returns:** plain text with same field labels ( **not JSON** )

```
Reference PDF :
Output/Response :
Fulfilled clauses :
Comply Yes/No (Status) :
Compliance Confidence % :
Corrective Action Plan :
Responsibility :
```

**Full prompt text:** [architecture §5.3 & §5.5](./COMPLIANCE_GAP_ANALYSIS_ARCHITECTURE.md#53-phase-1--full-prompt-compare_prompt_v2)

### Semantic matrix

- **Prompt:** `semantic-matrix-compare-prompt.ts` → gaps + remediation JSON via comparison API

---

## Output (every point)

**Reference PDF · Evidence quote · Fulfilled clauses (intent map) · Gap(s) in CAP · Status · Confidence % · Responsibility**

Status: **Compliant · Partial Compliant · Non-Compliant**

---

## Code & UI (where process runs)

| Layer | Path |
|-------|------|
| Phase 1 UI | `apps/web/src/app/landing-ai/compliance-workbench.tsx` |
| Dual verify UI | `apps/web/src/app/landing-ai/dual-verify-workbench.tsx` |
| Phase 1 API | `POST /landing-ai/compare-point` → `landing-ai.service.ts` |
| Phase 2 API | `POST /ai/bcpanalyze` → `bcp-analyze.service.ts` |
| Sessions DB | `POST/GET /landing-ai/compliance-sessions` |

---

## Local run

```bash
npm run dev:api   # :4000
npm run dev:web   # :3000
```

---

*Team lead summary. **Architecture:** [COMPLIANCE_GAP_ANALYSIS_ARCHITECTURE.md](./COMPLIANCE_GAP_ANALYSIS_ARCHITECTURE.md). **Quality gates:** [COMPLIANCE_ANALYSIS_QUALITY_FRAMEWORK.md](./COMPLIANCE_ANALYSIS_QUALITY_FRAMEWORK.md). **API:** [doc.md](./doc.md).*
