# ⚖️ 05 — Comparison Engine (CORE LOGIC)

**⭐ Most important document.** This is how Requirement PDF vs Internal Process Document comparison works.

---

## The Core Idea

```
For EACH requirement point (row in Excel):
  1. Find best matching text in bank policy (vector search)
  2. Ask GPT: "Does bank policy satisfy this requirement?"
  3. Save: Compliant / Partial / Non-Compliant + evidence
```

---

## Full Workflow Box Diagram

```
┌─────────────────────────────────────────┐
│  INPUT: Requirement point P15           │
│  "Freeze assets within 24 hours"        │
└────────────────┬────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────┐
│  STEP 1: Embed requirement point        │
│  OpenAI text-embedding-3-small          │
└────────────────┬────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────┐
│  STEP 2: Search pgvector                │
│  Filter: internal doc chunks only       │
│  Return: TOP 5 similar chunks           │
└────────────────┬────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────┐
│  STEP 3: Build RAG prompt               │
│  REQUIREMENT + top 5 internal excerpts  │
│  + JSON output instructions             │
└────────────────┬────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────┐
│  STEP 4: GPT-4o-mini                    │
│  Returns compliance_level + reasoning   │
└────────────────┬────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────┐
│  STEP 5: Save compliance_items row      │
└─────────────────────────────────────────┘
                 │
                 │  Repeat for P1..P40
                 ▼
           Session complete
```

---

## RAG Prompt Structure (Conceptual)

```
REQUIREMENT:
{requirement_text}

INTERNAL DOC EXCERPTS (top 5 from pgvector):
{chunk_1}
{chunk_2}
...

Analyze if internal document fulfills this requirement.
Respond JSON only:
{
  compliance_level: "Compliant" | "Partial Compliant" | "Non-Compliant",
  matched_text: "quote from internal doc",
  reasoning: "why this level",
  gaps: "what is missing"
}
```

See [14-comparison-prompt-templates.md](./14-comparison-prompt-templates.md) for full prompts.

---

## Compliance Level Criteria

```
┌─────────────────────┬──────────────────────────────────────────────┐
│  ✅ Compliant       │ Internal doc FULLY covers requirement        │
│                     │ Excel: "Yes"                                   │
├─────────────────────┼──────────────────────────────────────────────┤
│  ⚠️ Partial         │ Covers SOME aspects, gaps remain             │
│  Compliant          │ Excel: "Partial" — needs CAP + date          │
├─────────────────────┼──────────────────────────────────────────────┤
│  ❌ Non-Compliant   │ Not addressed OR clearly missing               │
│                     │ Excel: "No" — needs CAP + date + owner         │
└─────────────────────┴──────────────────────────────────────────────┘
```

**If vector search finds nothing good (< 50% similarity):** still call GPT with "NO MATCH FOUND" → usually Non-Compliant.

**If GPT confidence low:** flag for human review before finalizing.

---

## compliance_items Table

```
┌──────────────────────────┬─────────────────────────────────────┐
│  Column                  │  Purpose                            │
├──────────────────────────┼─────────────────────────────────────┤
│  id                      │  Primary key                        │
│  analysis_session_id     │  Which analysis run                 │
│  requirement_id          │  Link to requirement point          │
│  requirement_text        │  Full regulation text (Col A)       │
│  matched_internal_text   │  Bank policy excerpt (Col B)        │
│  compliance_level        │  compliant / partial / non          │
│  reasoning               │  AI explanation                     │
│  gaps                    │  What's missing                     │
│  target_date             │  Nullable — for partial/non       │
│  corrective_action_plan  │  Nullable — CAP text                │
│  responsibility          │  Nullable — assigned person         │
│  status                  │  open / in-progress / closed        │
│  created_at / updated_at │  Timestamps                         │
└──────────────────────────┴─────────────────────────────────────┘
```

---

## Compare 2 Files — Simple Mental Model

```
FILE A (Requirement)     FILE B (Internal)
Cabinet Decision 74  vs  TFS Manual + Sanctions Policy
     │                         │
     ▼                         ▼
 40 Articles              200 chunks in pgvector
     │                         │
     └───────────┬─────────────┘
                 ▼
        For each Article:
          search FILE B chunks
          GPT judges match
                 ▼
        40 rows in compliance_items
                 ▼
        Excel download
```

---

## Tools Used

| Tool | Role |
|------|------|
| pgvector | Similarity search (Retrieve) |
| OpenAI embeddings | Convert text to vectors |
| GPT-4o-mini | Compare + classify (Generate) |
| NestJS ComparisonEngineService | Orchestrates loop |
| BullMQ | Run 40 comparisons in background |

---

## Summary

The comparison engine is **not** generic Q&A RAG. It runs a **fixed loop per requirement point**, stores structured compliance rows, and feeds Excel + dashboard. This is the heart of BCP.
