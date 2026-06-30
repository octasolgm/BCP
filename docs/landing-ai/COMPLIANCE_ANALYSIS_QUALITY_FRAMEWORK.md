# Compliance Analysis Quality Framework

**Audience:** Compliance officers, team leads, external auditors  
**Objective:** Produce **defensible, point-level gap analysis** with the lowest practicable rate of incorrect findings  
**Standard:** CBUAE / Cabinet Decision TFS obligations mapped to internal IMPTFS procedures

---

## 1. Correct mental model

### What this system is

A **two-stage regulatory gap analysis engine**:

| Stage | Engine | Input | Output |
|-------|--------|-------|--------|
| **Phase 1** | Landing AI (`extract-latest`) | Gov point + parsed internal markdown | Primary gap record per obligation |
| **Phase 2** | Gemini / GPT (user-selected) | Gov point + IMPTFS PDF + Phase 1 record | Independent verification gap record |

Each **gov point** (section or leaf) receives its **own** analysis. There is no single-pass “whole document compliant” verdict.

### What Phase 2 does (and does not do)

**Phase 2 does:**

- Re-read the internal PDF independently.
- Re-evaluate status, evidence quote, fulfilled clauses, and gaps.
- Challenge Phase 1 if evidence is weak, missing, or status is overstated.
- Surface disagreements for human review before reporting.

**Phase 2 does not:**

- Replace legal judgment or firm sign-off.
- Automatically merge two conflicting records without reviewer action.
- Guarantee zero errors — it **detects** disagreement; humans **resolve** it.

---

## 1b. Phase 1 CAP (Corrective Action Plan) — plain language

For each gov point, Phase 1 produces a **CAP only when there is a gap** (Partial or Non-Compliant).

| Status | CAP |
|--------|-----|
| **Compliant** | `N/A` — no remediation needed |
| **Partial Compliant** | `Gap(s):` + numbered list of **missing sub-conditions** from the gov text + recommended policy fix |
| **Non-Compliant** | Same — every missing obligation named; evidence = “No corresponding procedure found.” |

**How the system builds CAP:**

1. **Prompt** tells Landing AI to split the obligation into sub-parts and list each missing part as `(1) Missing: … Fix: …`
2. **JSON schema** requires `corrective_action_plan` when status is not Compliant
3. **API code** rejects vague CAP (“review controls”) and auto-builds numbered gaps from the requirement text if needed

Phase 2 produces its **own CAP** in the same format. If Phase 2 lists more gaps or a stricter status, that is a signal Phase 1 CAP was incomplete — **review required**.

Full technical detail: [COMPLIANCE_GAP_ANALYSIS_ARCHITECTURE.md §4–§5](./COMPLIANCE_GAP_ANALYSIS_ARCHITECTURE.md#4-phase-1-cap--how-it-is-built).

---

## 1c. Models and what each phase receives (quick reference)

| | Phase 1 | Phase 2 |
|---|---------|---------|
| **Engine** | Landing AI ADE | Gemini (default) or Azure GPT |
| **Model** | `extract-latest` | `gemini-2.5-flash-lite` (or user pick) |
| **Gov point** | One point in markdown instructions | One point in text prompt |
| **Internal doc** | **Full parsed markdown** from Supabase | **PDF file** attached (Gemini only) |
| **Phase 1 output** | — | Included as “reference only” block |
| **Prompt file** | `compliance-compare-prompts.ts` (v2) | `dual-verify-prompt.ts` + `REFERENCE_MAP_PROMPT` |
| **Output shape** | JSON schema → formatted gap record | Same field layout (text) |

**Phase 1 prompt content (summary):** Whole-point **semantic / intent** comparison — map regulatory obligation to internal control by operational effect (not keywords). Verbatim Page/Section evidence quote + fulfilled-clauses intent mapping + numbered CAP for missing sub-intents. Confidence = semantic completeness.

**Phase 2 prompt content (summary):** Reference mapper format + “independently re-read PDF, do not copy Pass 1” + full Phase 1 message + same gov point.

GPT models **cannot** receive the PDF in Phase 2 — use Gemini for dual verify with document evidence.

---

## 2. Target quality bar

| Metric | Phase 1 only | Phase 1 + Phase 2 (dual verify) |
|--------|--------------|----------------------------------|
| False Compliant risk | Medium — single model, markdown-only | Lower — PDF re-read + disagreement flags |
| Evidence citation accuracy | Good with v2 prompt | Improved when Gemini reads PDF natively |
| Gap completeness (CAP) | Schema-enforced numbered gaps | Cross-checked; mismatches force review |
| Audit defensibility | Suitable for draft workpapers | Suitable for management reporting after review gate |
| Cost | Landing AI credits only | Landing AI + LLM credits per point |

**Practical target:** Treat **Aligned** dual-verify results as **report-ready candidates**. Treat **Status mismatch** as **blocking** until a qualified reviewer resolves.

---

## 3. Complete operational flow

### Step 0 — Scope the engagement

1. Confirm gov source: **TFS Guidelines** (Cabinet Decision 74 / CBUAE framework).
2. Confirm internal source: current **IMPTFS** version (file name + effective date).
3. Choose granularity:
   - **Leaf (2.1.1, 2.1.2 …)** — full compliance file, minimum missed obligations.
   - **Section (2.1, 2.2 …)** — management summary; may hide sub-point gaps.

### Step 1 — Prepare documents

```
┌─────────────────────────────────────────────────────────────┐
│ GOVERNMENT REQUIREMENTS                                      │
│  Option A: Upload gov PDF → Extract live (Landing AI)       │
│  Option B: Load from Supabase (seeded points, free)         │
│  → Filter: mandatory points only; skip informational intro  │
└─────────────────────────────────────────────────────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ INTERNAL POLICY (IMPTFS)                                     │
│  Attach PDF → Parse to Supabase (once per policy version)    │
│  → Full markdown required for Phase 1                        │
└─────────────────────────────────────────────────────────────┘
```

**Quality rule:** Never compare against an unparsed or outdated internal PDF.

### Step 2 — Phase 1: Per-point gap analysis (Landing AI)

For **each** selected gov point:

```
Requirement point (one obligation)
        │
        ▼
Search entire IMPTFS markdown
        │
        ▼
Sub-condition decomposition
  • What parts of the obligation exist?
  • Which are evidenced in IMPTFS?
  • Which are missing?
        │
        ▼
Gap record produced:
  ┌──────────────────────────────────────────┐
  │ Reference PDF / Output-Response (quote)  │
  │ Fulfilled clauses (what IS covered)      │
  │ Status: Compliant | Partial | Non        │
  │ Confidence %                             │
  │ CAP: Gap(s) numbered + operational fix   │
  │ Responsibility                           │
  └──────────────────────────────────────────┘
        │
        ▼
Auto-save to Supabase (merge by point_id)
```

**Phase 1 output is gap analysis**, not a simple yes/no. Even **Compliant** records must show *which* sub-conditions are fulfilled.

### Step 3 — Phase 2: Verification pass (recommended for final packs)

Run **Dual Verify** (`/landing-ai/dual-verify` or `/dual-verify/detail`):

```
For each point:
  Phase 1 gap record (reference)
        │
        ▼
  Phase 2: LLM re-reads IMPTFS PDF independently
        │
        ▼
  Second gap record (same field structure)
        │
        ▼
  Automated agreement check
```

### Step 4 — Agreement gate (mandatory review rules)

```
                    ┌─────────────┐
                    │  Aligned    │──► Include in report pack
                    └─────────────┘
                    ┌─────────────┐
                    │ Confidence  │──► Review quotes; reconcile %
                    │ gap         │
                    └─────────────┘
                    ┌─────────────┐
                    │ Both non-   │──► Merge CAPs; use stricter status
                    │ compliant   │
                    └─────────────┘
                    ┌─────────────┐
                    │ Status      │──► BLOCKING: human must pick correct
                    │ mismatch    │     record or re-run with fixed inputs
                    └─────────────┘
```

**Status mismatch examples requiring review:**

- Phase 1: Compliant · Phase 2: Partial Compliant → likely **false Compliant** in Phase 1.
- Phase 1: Non-Compliant · Phase 2: Compliant → likely **missed evidence** in Phase 1 or over-read in Phase 2.
- Large confidence delta with same status → evidence depth disagreement.

### Step 5 — Human resolution (when automated gate fails)

Reviewer checklist:

1. Open both side-by-side cards (Landing AI vs Phase 2).
2. Verify **Page / Section / verbatim quote** against source PDF manually.
3. Walk each **sub-condition** of the gov obligation — tick covered / not covered.
4. Select authoritative status; edit CAP to list **every** remaining gap by number.
5. Assign **Responsibility** to a named function (Compliance, Operations, IT, etc.).
6. Document reviewer name + date in workpapers (outside system or export annotation).

### Step 6 — Publish professional output

Export paths:

| Format | Use |
|--------|-----|
| **Web cards** | Working review |
| **PDF report** | Management / audit committee pack |
| **Formatted Excel** | Remediation tracking |
| **Matrix Excel** | Section 2 compliance matrix layout |

Reload from Supabase for **0-credit** re-export of signed-off sessions.

---

## 4. Professional gap record standard (law-compliance style)

Every published point must read like an **audit workpaper entry**, not AI prose.

### Required structure

```
[Clause ID — Title]
[Full regulatory obligation text]

Reference PDF : [exact filename]
Output/Response : Page [n], Section [code]: '[verbatim procedure quote]'
                  OR "No corresponding procedure found."

Fulfilled clauses :
• [Sub-condition A] — evidenced by [section reference]
• [Sub-condition B] — evidenced by …

Comply Yes/No (Status) : [Compliant | Partial Compliant | Non-Compliant]
Compliance Confidence % : [0–100]%

Corrective Action Plan :
  Compliant → N/A (empty)
  Partial / Non → Gap(s):
    (1) Missing: [exact obligation fragment]. Fix: [specific procedure change].
    (2) Missing: …

Responsibility : [Department / role] or N/A if Compliant
```

### Language rules (enforce in review)

| Rule | Rationale |
|------|-----------|
| Evidence must be **verbatim** from IMPTFS | Audit traceability |
| CAP must **name each gap**, not “review controls” | Actionable remediation |
| No Compliant if **any** sub-condition missing | Regulatory strict construction |
| Confidence 100% **only** when fully Compliant | Prevents overstatement |
| Partial vs Non distinction must reflect **degree** of coverage | Correct prioritization |

---

## 5. What prevents incorrect analysis (control matrix)

| Control | Layer | Prevents |
|---------|-------|----------|
| Sub-condition decomposition | Phase 1 prompt v2 | Silent partial compliance |
| Numbered Gap(s) in CAP | Phase 1 schema | Vague remediation |
| Verbatim quote requirement | Phase 1 + Phase 2 prompts | Fabricated or paraphrased evidence |
| Full-document markdown search | Phase 1 | Point-only tunnel vision |
| Independent PDF re-read | Phase 2 | Parse-cache blind spots |
| Agreement engine | Dual verify | Unchallenged single-model errors |
| Human mismatch gate | Operations | False Compliant entering final report |
| Supabase session history | Persistence | Re-analysis drift; supports reproducibility |
| Leaf granularity | Configuration | Section rollup hiding sub-gaps |
| Force compare / re-parse | API flags | Stale policy version |

---

## 6. Recommended paths by use case

| Use case | Path | Granularity |
|----------|------|-------------|
| Draft gap identification | Workbench Phase 1 only | Leaf |
| Management sign-off pack | Dual verify | Leaf |
| Executive summary | Dual verify or Phase 1 | Section |
| Matrix vs checklist consistency | Semantic matrix compare | N/A (Excel) |
| Re-export prior signed analysis | Load session from DB | Match original granularity |

---

## 7. Flow diagram — path to defensible 0-incorrect reporting

```
                    START
                      │
         ┌────────────┴────────────┐
         │ Load / extract gov pts  │
         │ Parse IMPTFS → Supabase │
         └────────────┬────────────┘
                      ▼
         ┌────────────────────────┐
         │ PHASE 1 (each point)   │
         │ Landing AI gap analysis│
         └────────────┬───────────┘
                      ▼
              Need final pack?
                 /        \
               No          Yes
               │            │
               ▼            ▼
         Export draft   PHASE 2 verify
         + manual QA    (each point)
                           │
                           ▼
                    Agreement check
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
          Aligned    Confidence gap   Mismatch
              │            │            │
              ▼            ▼            ▼
         Report-ready   Quick review  Human resolution
              │            │            │
              └────────────┴────────────┘
                           ▼
                    Export PDF / Excel
                    Save session → DB
                           ▼
                    Auditor sign-off
                           ▼
                         END
```

**“0% incorrect” in practice** means: **no unreviewed Status mismatch** in the published pack, **every Partial/Non record has numbered gaps**, and **every Compliant record has verifiable quotes** — not that AI is infallible.

---

## 8. Roles & accountability

| Role | Responsibility |
|------|----------------|
| **Operator** | Runs extract, parse, Phase 1/2, exports |
| **Compliance reviewer** | Resolves mismatches; approves CAP text |
| **Process owner** | Implements remediation per Responsibility field |
| **Engagement lead** | Signs final gap analysis report |

AI outputs are **decision support**. Regulatory accountability remains with the licensed institution and its compliance function.

---

## Related documents

- [COMPLIANCE_GAP_ANALYSIS_ARCHITECTURE.md](./COMPLIANCE_GAP_ANALYSIS_ARCHITECTURE.md) — technical architecture  
- [DUAL_VERIFY_AND_ANALYSIS_WORKFLOW.md](./DUAL_VERIFY_AND_ANALYSIS_WORKFLOW.md) — short team lead diagrams  
- [doc.md](./doc.md) — API reference  
