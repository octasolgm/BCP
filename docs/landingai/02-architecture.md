# 02 — Architecture (Landing AI in BCP)

---

## High-level box diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              WEB (Next.js)                                   │
│  /upload  /compliance  /dashboard  /landing-ai-setup  /ai-lab-*             │
└───────────────────────────────────┬─────────────────────────────────────────┘
                                    │ REST
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           NESTJS API (port 4000)                             │
├─────────────────────────────────────────────────────────────────────────────┤
│  landing-ai/          documents/       comparison/       excel/              │
│  ├─ parse             ├─ upload        ├─ compare point  ├─ export xlsx      │
│  ├─ extract-gov       └─ storage ref   └─ batch          dashboard/          │
│  ├─ extract-internal                    compliance-items/  alerts/           │
│  └─ cache lookup                         ai/ (Gemini analyze)                  │
└───────┬─────────────────────────────┬───────────────────────┬───────────────┘
        │                             │                       │
        ▼                             ▼                       ▼
┌───────────────┐            ┌─────────────────┐     ┌─────────────────┐
│ Landing AI    │            │ Supabase        │     │ Google Gemini   │
│ ADE Cloud     │            │ Postgres        │     │ (comparison)    │
│               │            │ Storage         │     └─────────────────┘
│ Parse API     │            │ pgvector        │
│ Extract API   │            └─────────────────┘
└───────────────┘
```

---

## Landing AI module internals

```
landing-ai.controller.ts
        │
        ├── LandingAiClientService     → HTTPS → api.va.landing.ai
        │       POST /v1/ade/parse
        │       POST /v1/ade/extract
        │
        ├── LandingAiCacheService      → Supabase
        │       getByFileHash()
        │       saveParseResult()
        │       saveExtractResult()
        │       logCreditUsage()
        │
        └── LandingAiOrchestrator      (future)
                parseAndExtractGov()
                parseAndExtractInternal()
```

---

## Data flow: one gov point end-to-end

```
                    ┌─────────────────┐
                    │ Gov PDF 2.6.5   │
                    └────────┬────────┘
                             │ Landing AI Extract
                             ▼
                    ┌─────────────────┐
                    │ requirements    │
                    │ point_id=2.6.5  │
                    └────────┬────────┘
                             │
         Internal PDF ◄──────┼──────► comparison engine
              │              │
              │              ▼
              │     ┌─────────────────┐
              │     │ compliance_items│
              │     │ status=Compliant│
              │     │ evidence=7.4... │
              │     └────────┬────────┘
              │              │
              ▼              ▼
     ┌─────────────┐  ┌─────────────┐
     │ Annotated   │  │ Report PDF  │
     │ internal PDF│  │ + Excel row │
     └─────────────┘  └─────────────┘
```

---

## Dual output architecture

| Output | Generator | Input |
|--------|-----------|-------|
| **Compliance report PDF** | `apps/web/src/lib/ai-lab/export-pdf.ts` | Batch Gemini comparison text |
| **Annotated internal PDF** | `apps/web/src/lib/ai-lab/export-reference-mapper-pdf.ts` | Citations + original internal PDF |
| **Excel** | `apps/api/src/modules/excel/` | `compliance_items` rows |

Both PDFs are produced from the **same** `compliance_items` / comparison results — one is a summary report, one marks evidence inside the source document.

---

## Credit & cache strategy

```
Upload file
    │
    ▼
SHA-256 hash
    │
    ├── Cache HIT (landing_ai_parse_cache) ──► return markdown (0 credits)
    │
    └── Cache MISS ──► Landing AI Parse ──► save markdown + credit_usage to DB
                              │
                              ▼
                         Extract (uses cached markdown when possible)
```

Extract results are also cached per `(file_hash, schema_version)`.

---

## Phase alignment

| Phase | Landing AI | Gemini | Supabase |
|-------|------------|--------|----------|
| Step 1 single session | Parse + Extract both doc types | Per-point compare | Full persistence |
| Step 2 bulk | Async jobs queue | Batch compare | Portfolio aggregates |

---

## Environment variables

| Variable | Used by |
|----------|---------|
| `VISION_AGENT_API_KEY` | Landing AI ADE |
| `LANDING_AI_API_BASE` | Optional override (default US cloud) |
| `LANDING_AI_PARSE_MODEL` | Default `dpt-2-latest` |
| `LANDING_AI_EXTRACT_MODEL` | Default `extract-latest` |
| `SUPABASE_*` | Cache + compliance data |
| `GEMINI_API_KEY` | Comparison after extraction |

See [03-developer-setup-guide.md](./03-developer-setup-guide.md).
