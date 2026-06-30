# 01 — End-to-End Workflow (Landing AI + BCP)

How government requirement documents are compared against internal process documents using Landing AI extraction and BCP comparison.

---

## Document types

| Type | Examples | Role |
|------|----------|------|
| **Requirement (gov law)** | CBUAE circulars, Cabinet Decision PDFs, HTML, JPEG scans | Source of truth — each numbered point must be checked |
| **Internal process** | IMPTFS manual, Word policies, Excel procedures, email text | Evidence — may partially or fully satisfy gov points |

---

## STEP 1 — Single / multi-file comparison

### Phase A — Upload & register

```
┌─────────────────────┐     ┌─────────────────────┐
│  Gov requirement    │     │  Internal process   │
│  PDF(s) / HTML /    │     │  PDF / Word / Excel │
│  JPEG (1..n files)  │     │  / email (1..n)     │
└──────────┬──────────┘     └──────────┬──────────┘
           │                           │
           └───────────┬───────────────┘
                       ▼
            ┌──────────────────────┐
            │  Supabase Storage    │
            │  + documents table   │
            └──────────────────────┘
```

### Phase B — Landing AI extraction (gov law)

Landing AI **Parse** converts each file to structured Markdown + layout JSON.  
Landing AI **Extract** pulls numbered requirement points using a JSON schema.

```
Gov PDF
   │
   ▼
┌─────────────────────────────────────────┐
│  POST /landing-ai/parse                 │
│  model: dpt-2-latest                    │
│  → markdown + chunks + credit_usage     │
└─────────────────┬───────────────────────┘
                  ▼
┌─────────────────────────────────────────┐
│  POST /landing-ai/extract-gov-points     │
│  schema: gov_requirement_points         │
│  → [{ point_id, title, text, section }] │
└─────────────────┬───────────────────────┘
                  ▼
┌─────────────────────────────────────────┐
│  Supabase: landing_ai_jobs +            │
│  requirements table (one row per point) │
└─────────────────────────────────────────┘
```

**Why Landing AI here:** Gov PDFs have complex layout (articles, sub-clauses, tables). ADE preserves hierarchy better than plain `pdf-parse` + regex.

**Credit saving:** Before calling ADE, BCP checks `landing_ai_parse_cache` by file SHA-256 hash. Re-upload of the same file reuses stored markdown (no new parse credits).

### Phase C — Landing AI extraction (internal docs)

Same Parse + Extract flow with schema `internal_policy_points`:

```
Internal PDF
   │
   ▼
Parse → Extract → internal_points[]
   │
   ▼
Embed chunks → pgvector (optional RAG boost)
```

Each internal point gets: `point_id`, `section`, `text`, `page_hint`, `source_file`.

### Phase D — Comparative analysis (per gov point)

For **each** gov requirement point:

```
┌──────────────────────────────────────────────────────────────┐
│  1. Semantic search internal chunks (pgvector)               │
│  2. Gemini / GPT gap analysis (strict prompt)                │
│  3. Status: Compliant | Partial Compliant | Non-Compliant    │
│  4. Confidence %, evidence quote, page/section citation      │
└──────────────────────────────────────────────────────────────┘
```

Stored in `compliance_items`:

| Column | Partial / Non-Compliant |
|--------|-------------------------|
| status | Compliant / Partial / Non-Compliant |
| confidence | 0–100% |
| evidence_text | Quote from internal doc |
| evidence_page | Page number |
| evidence_section | e.g. 7.4 Training |
| corrective_action | Required if gap |
| responsibility | Department |
| target_date | Due date for remediation |

### Phase E — Dual PDF outputs

**Output 1 — Compliance report PDF** (like `bcp-compliance2-report-2026-06-25.pdf`):

- Summary: overall % compliant, need-focus list
- One card per gov point with status badge, confidence, evidence, CAP
- Generated via existing AI Lab report flow + `export-pdf.ts`

**Output 2 — Annotated internal PDF**:

- Full original internal document copy
- Green / yellow / red highlights at the **exact section** where each gov point is satisfied
- Callout label: `2.6.5 | COMPLIANT | 100%` next to evidence text
- Generated via `export-reference-mapper-pdf.ts` (pdf-parse positions + pdf-lib draw)

### Phase F — Excel export

ExcelJS workbook matching client sample template:

| Col | Content |
|-----|---------|
| A | Gov point ID + text |
| B | Status (3 levels) |
| C | Confidence % |
| D | Internal evidence reference |
| E | Corrective action plan |
| F | Responsibility |
| G | Target date |

See [06-excel-output-generation.md](../workflows/06-excel-output-generation.md).

### Phase G — MIS dashboard & alerts

- Dashboard: overall compliance %, by document, by department
- Alerts (cron): overdue `target_date`, missing CAP, re-upload pending review
- Re-evaluation: when corrected files uploaded → re-run comparison → status → Compliant

---

## STEP 2 — Bulk processing

```
┌─────────────────────────────────────────┐
│  Bulk upload: many gov + many internal   │
│  files (folder / zip)                    │
└─────────────────┬───────────────────────┘
                  ▼
┌─────────────────────────────────────────┐
│  Queue: landing_ai_jobs (async)          │
│  Batch comparison sessions               │
└─────────────────┬───────────────────────┘
                  ▼
┌─────────────────────────────────────────┐
│  Portfolio MIS:                          │
│  - Compliance by regulation            │
│  - Compliance by business unit           │
│  - Trend over time (Supabase history)    │
└─────────────────────────────────────────┘
```

---

## Requirement checklist mapping

| # | Requirement | BCP component |
|---|-------------|---------------|
| 1 | Multi PDF gov vs internal | Upload + comparison session |
| 2 | Multiple points in each file | Landing AI Extract schemas |
| 3 | Comparative analysis | Comparison module + Gemini |
| 4 | 3 compliance levels | `compliance_items.status` |
| 5 | CAP / dates / responsibility | Excel + DB columns |
| 6 | MIS dashboard | Dashboard module |
| 7 | Re-upload → compliant | Re-evaluation workflow |
| 8 | Alerts on missed dates | Alerts module + cron |
| 9 | Excel output | ExcelJS module |
| 10 | Gov formats PDF/HTML/JPEG | Landing AI Parse (multi-format) |
| 11 | Internal Word/PDF/Excel/email | Extraction module + ADE |

---

## Who does what

| Task | Tool |
|------|------|
| Deep parse gov/internal layout | **Landing AI ADE** |
| Extract numbered points | **Landing AI Extract** + JSON schema |
| Compare gov point → internal | **Gemini** (existing `/ai/bcpanalyze`) |
| Cache ADE results | **Supabase** |
| Report PDF | **jspdf** (AI Lab export) |
| Annotated internal PDF | **pdf-lib** + API text positions |
| Excel | **ExcelJS** |
| Dashboard | **Next.js** + API aggregates |
