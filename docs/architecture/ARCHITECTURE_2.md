# 🏗️ BCP Architecture 2 — Complete Workflow

**Version:** 2.0  
**Stack:** Next.js 14 (`apps/web`) + NestJS (`apps/api`) + Supabase (Storage + Postgres + pgvector) + **Gemini only**  
**Embeddings:** `text-embedding-004` (768 dimensions)  
**Chat / classify:** `gemini-2.0-flash`

This document maps **each stage** to: what happens, which NestJS module does it, which external service is called, and where data lives.

---

## 📊 System Overview (One Diagram)

```
┌──────────────┐     HTTPS      ┌──────────────┐     SDK/API    ┌─────────────────────┐
│  Next.js 14  │──────────────►│  NestJS API  │──────────────►│  Supabase           │
│  apps/web    │               │  apps/api    │               │  Storage + Postgres │
│  :3000       │◄──────────────│  :4000       │◄──────────────│  + pgvector         │
└──────────────┘     JSON       └──────┬───────┘               └─────────────────────┘
                                       │
                                       │ HTTPS (embed + generate only)
                                       ▼
                               ┌─────────────────────┐
                               │  Google Gemini API    │
                               │  text-embedding-004 │
                               │  gemini-2.0-flash     │
                               └─────────────────────┘
```

---

## 🧠 Mental Model (One Sentence)

> **Requirement docs → split into points (Excel rows). Internal docs → chunk + embed (searchable knowledge). For each point, RAG-search the knowledge, ask Gemini "are we covered?", save verdict, render to Excel.**

---

## STAGE 1 — Upload

```
╔══════════════════════════════════════════════════════════════════════════════╗
║                           STAGE 1: UPLOAD                                     ║
╚══════════════════════════════════════════════════════════════════════════════╝

  👤 User opens Next.js app (apps/web)
       │
       │ uploads 2 types of files:
       │   📕 Requirement docs (gov regulations) — PDF / HTML / JPEG
       │   📘 Internal process docs (bank policies) — Word / PDF / Excel / Email
       │
       ▼
  ┌─────────────────────────────────────┐
  │  Next.js Upload Page                 │
  │  src/app/upload/page.tsx             │
  │  - Drag & drop                       │
  │  - Tags file as "requirement" or     │
  │    "internal"                        │
  └─────────────────┬───────────────────┘
                    │ HTTP POST multipart/form-data
                    ▼
  ┌─────────────────────────────────────┐
  │  NestJS API (apps/api)               │
  │  POST /documents/upload              │
  │  modules/documents/                  │
  │    documents.controller.ts           │
  └─────────────────┬───────────────────┘
                    │
                    ▼
  ┌─────────────────────────────────────┐      ┌─────────────────────────┐
  │  documents.service.ts                │─────►│  📦 Supabase Storage    │
  │  1. Uploads file binary              │      │  bucket: "documents"     │
  │  2. Gets back public/signed URL      │      │  stores: PDF/Word/etc.   │
  └─────────────────┬───────────────────┘      └─────────────────────────┘
                    │
                    ▼
  ┌─────────────────────────────────────┐      ┌─────────────────────────┐
  │  Insert metadata row                 │─────►│  🗄️ Postgres            │
  │                                      │      │  table: documents        │
  │                                      │      │  - id                    │
  │                                      │      │  - name                  │
  │                                      │      │  - type (requirement|    │
  │                                      │      │          internal)       │
  │                                      │      │  - file_url              │
  │                                      │      │  - mime_type             │
  └─────────────────────────────────────┘      └─────────────────────────┘

  ✅ Result: File binary in Supabase Storage. DB holds pointer (URL) + metadata.
```

| Item | Detail |
|------|--------|
| **Who** | User via `apps/web` |
| **API** | `POST /documents/upload` |
| **Module** | `apps/api/src/modules/documents/` |
| **Storage** | Supabase Storage bucket `documents` |
| **DB** | `documents` table |

---

## STAGE 2 — Text Extraction

```
╔══════════════════════════════════════════════════════════════════════════════╗
║                       STAGE 2: TEXT EXTRACTION                                ║
╚══════════════════════════════════════════════════════════════════════════════╝

  After upload, the API triggers extraction.

  ┌─────────────────────────────────────┐
  │  extraction.service.ts               │
  │  modules/extraction/                 │
  │                                      │
  │  Downloads file from Supabase        │
  │  Storage → into memory (Buffer)      │
  │                                      │
  │  Detects MIME type and routes:       │
  │   .pdf  → pdf-parse                  │
  │   .docx → mammoth                    │
  │   .xlsx → xlsx (SheetJS)             │
  │   .html → cheerio                    │
  │   .jpg  → tesseract.js (OCR)         │
  │   .txt/email → plain read            │
  │                                      │
  │  Returns: one big string of text     │
  └─────────────────┬───────────────────┘
                    │
                    ▼
        📄 Plain text in memory
        (e.g. "Article 1 - Definitions.
         In implementation of the provisions...")

  ⚙️  Where does extraction happen?
     LOCALLY inside the NestJS process on your server.
     No external AI call. All libraries run in Node.js.
     Fast, free, private.
```

| Item | Detail |
|------|--------|
| **Module** | `apps/api/src/modules/extraction/` |
| **Runs** | Inside NestJS (Node.js) — not Gemini |
| **Output** | Single plain-text string in memory |
| **Next** | Fork by `doc_type` → Stage 3 |

---

## STAGE 3 — Fork by Document Type

```
╔══════════════════════════════════════════════════════════════════════════════╗
║          STAGE 3: SPLIT BY DOCUMENT TYPE (the fork in the road)               ║
╚══════════════════════════════════════════════════════════════════════════════╝

                      ┌────────────────────┐
                      │  What type of doc? │
                      │  documents.type    │
                      └────────┬───────────┘
                               │
              ┌────────────────┴────────────────┐
              │                                 │
              ▼                                 ▼
   📕 REQUIREMENT DOC                  📘 INTERNAL POLICY DOC
   (gov regulation)                    (bank's own policy)
              │                                 │
              ▼                                 ▼
        STAGE 4A                          STAGE 4B
   (point splitter)                    (chunk + embed)
```

| Path | Why different |
|------|----------------|
| **Requirement** | Each article = one Excel row → split into **points**, not chunks |
| **Internal** | Long policy → split into **chunks** → embed for similarity search |

---

## STAGE 4A — Requirement Point Splitter

```
╔══════════════════════════════════════════════════════════════════════════════╗
║   STAGE 4A: REQUIREMENT POINT SPLITTER  (only for requirement docs)           ║
╚══════════════════════════════════════════════════════════════════════════════╝

  ┌─────────────────────────────────────┐
  │  requirements.service.ts             │
  │  modules/requirements/               │
  │                                      │
  │  Splits regulation text into points: │
  │    Option A: Regex (e.g. /^Article \d+/)
  │    Option B: Gemini ("split into      │
  │              numbered sections")     │
  │                                      │
  │  Result: array of points             │
  │  [                                   │
  │   { number: "Article 1",             │
  │     title: "Definitions",            │
  │     content: "In implementation..." },│
  │   { number: "Article 2", ...},       │
  │   ...                                │
  │  ]                                   │
  └─────────────────┬───────────────────┘
                    │
                    ▼
            🗄️ Postgres — table: requirements
            ├─ id
            ├─ document_id (→ documents.id)
            ├─ point_number   ("Article 1")
            ├─ title          ("Definitions")
            └─ content        (full text of that article)

  ✅ List of "things we must comply with" — one row per obligation.
```

| Item | Detail |
|------|--------|
| **Module** | `apps/api/src/modules/requirements/` |
| **DB** | `requirements` |
| **Gemini?** | Optional for split (Option B); regex possible for structured regs |
| **Not chunked** | Whole articles kept as logical units |

---

## STAGE 4B — Chunk + Embed Internal Docs

```
╔══════════════════════════════════════════════════════════════════════════════╗
║      STAGE 4B: CHUNK + EMBED INTERNAL DOCS  (only for internal docs)         ║
╚══════════════════════════════════════════════════════════════════════════════╝

  Internal docs are LONG. Cannot send whole doc to Gemini per comparison.
  Solution: small chunks → vectors → pgvector → search by meaning later.

  ┌─────────────────────────────────────┐
  │  rag/chunking.service.ts             │
  │  ~500-token chunks, ~50 overlap      │
  │  50-page policy → ~150 chunks        │
  └─────────────────┬───────────────────┘
                    │
                    ▼
  ┌─────────────────────────────────────┐      ┌─────────────────────────┐
  │  rag/embedding.service.ts            │─────►│  🤖 Gemini API           │
  │  gemini.embed(chunk) per chunk       │      │  text-embedding-004      │
  │  → 768-dim vector per chunk          │◄─────│  [0.12, -0.45, ...]      │
  └─────────────────┬───────────────────┘      └─────────────────────────┘
                    │
                    ▼
  ┌─────────────────────────────────────┐      ┌─────────────────────────┐
  │  rag/vector-store.service.ts         │─────►│  🗄️ Postgres + pgvector  │
  │  INSERT chunk + embedding            │      │  table: document_chunks  │
  │                                      │      │  ├─ id                   │
  │                                      │      │  ├─ document_id          │
  │                                      │      │  ├─ chunk_index          │
  │                                      │      │  ├─ content (text)       │
  │                                      │      │  └─ embedding vector(768)│
  └─────────────────────────────────────┘      └─────────────────────────┘

  ✅ Bank policies indexed — searchable by meaning, not keywords.
```

| Item | Detail |
|------|--------|
| **Module** | `apps/api/src/modules/rag/` |
| **Services** | `chunking`, `embedding`, `vector-store`, `retrieval` |
| **Gemini** | `text-embedding-004` only here (and in Stage 5 retrieve query) |
| **DB** | `document_chunks` with `vector(768)` |

---

## STAGE 5 — Comparison Engine (RAG)

```
╔══════════════════════════════════════════════════════════════════════════════╗
║              STAGE 5: COMPARISON ENGINE  (the brain — RAG happens here)      ║
╚══════════════════════════════════════════════════════════════════════════════╝

  User clicks "Run Compliance Analysis"
  API: POST /comparison/run

  ┌─────────────────────────────────────┐
  │  comparison.service.ts               │
  │  modules/comparison/                 │
  │  FOR EACH row in requirements:       │
  └─────────────────┬───────────────────┘
                    │
   ┌────────────────▼───────────────────────────────────────────────┐
   │  Step 1: EMBED requirement text                               │
   │  common/gemini → embed() → 768-dim vector                     │
   └────────────────┬───────────────────────────────────────────────┘
                    │
   ┌────────────────▼───────────────────────────────────────────────┐
   │  Step 2: RAG RETRIEVE                                         │
   │  rag/retrieval.service.ts                                     │
   │                                                               │
   │  SELECT content, document_id, chunk_index                     │
   │  FROM document_chunks                                         │
   │  WHERE document_id IN (internal docs only)                    │
   │  ORDER BY embedding <=> query_vector                            │
   │  LIMIT 5;                                                     │
   │                                                               │
   │  <=> = cosine distance (pgvector)                             │
   └────────────────┬───────────────────────────────────────────────┘
                    │
   ┌────────────────▼───────────────────────────────────────────────┐
   │  Step 3: AUGMENT + GENERATE                                   │
   │  prompts/compare-prompt.ts + gemini.generate()                │
   │  gemini-2.0-flash → JSON verdict                              │
   │  { level, reasoning, evidence }                               │
   └────────────────┬───────────────────────────────────────────────┘
                    │
   ┌────────────────▼───────────────────────────────────────────────┐
   │  Step 4: SAVE                                                 │
   │  table: compliance_items                                      │
   │  ├─ requirement_id                                            │
   │  ├─ compliance_level (compliant|partial|non_compliant)        │
   │  ├─ uae_response / matched_internal_text                        │
   │  ├─ evidence_chunks                                           │
   │  ├─ confidence                                                │
   │  ├─ cap, target_date, responsibility (NULL until user fills)  │
   │  └─ status: open                                              │
   └───────────────────────────────────────────────────────────────┘

  💡 RAG = Retrieve (pgvector) + Augment (prompt) + Generate (Gemini)
```

| Item | Detail |
|------|--------|
| **Module** | `apps/api/src/modules/comparison/` |
| **RAG retrieve** | `apps/api/src/modules/rag/retrieval.service.ts` |
| **Prompts** | `apps/api/src/modules/comparison/prompts/compare-prompt.ts` |
| **Gemini** | `embed()` + `generate()` — **no OpenAI** |
| **DB** | `compliance_items` (one row per requirement) |

---

## STAGE 6 — Excel Output

```
╔══════════════════════════════════════════════════════════════════════════════╗
║                       STAGE 6: GENERATE EXCEL OUTPUT                          ║
╚══════════════════════════════════════════════════════════════════════════════╝

  User clicks "Download Excel"
  API: GET /excel/download/:sessionId

  ┌─────────────────────────────────────┐
  │  excel.service.ts                    │
  │  modules/excel/                      │
  │                                      │
  │  JOIN requirements + compliance_items│
  │  Build workbook with ExcelJS:        │
  │                                      │
  │  Col A: requirement.content          │
  │  Col B: compliance_item.uae_response │
  │  Col C: Yes / No / Partial           │
  │  Col D: Compliance level (color)     │
  │  Col E: CAP                          │
  │  Col F: Target Date                  │
  │  Col G: Responsibility               │
  │  Col H: Status                       │
  │                                      │
  │  Returns .xlsx download              │
  └─────────────────────────────────────┘
```

| Item | Detail |
|------|--------|
| **Module** | `apps/api/src/modules/excel/` |
| **Library** | ExcelJS (in NestJS) |
| **UI** | `apps/web` compliance page → download button |

---

## STAGE 7 — Tracking, Re-Evaluation, Alerts

```
╔══════════════════════════════════════════════════════════════════════════════╗
║                  STAGE 7: TRACKING + RE-EVALUATION + ALERTS                   ║
╚══════════════════════════════════════════════════════════════════════════════╝

  User fills gaps (Partial / Non-Compliant):
    PATCH /compliance-items/:id
    { cap, target_date, responsibility }
  → modules/compliance-items/

  User uploads updated policy:
    → Stage 1, 2, 4B again
    → POST re-evaluate
    → Stage 5 for open items
    → status → closed if now compliant

  Daily cron (@nestjs/schedule):
    modules/alerts/alerts.service.ts
    → target_date < TODAY AND status != closed
    → notifications / email
```

| Item | Detail |
|------|--------|
| **CAP / dates** | `modules/compliance-items/` |
| **Re-eval** | `comparison.service` re-run |
| **Alerts** | `modules/alerts/` + cron |

---

## STAGE 8 — Dashboard / MIS

```
╔══════════════════════════════════════════════════════════════════════════════╗
║                      STAGE 8: DASHBOARD / MIS                                 ║
╚══════════════════════════════════════════════════════════════════════════════╝

  Next.js src/app/dashboard/page.tsx
       │
       │ GET /dashboard/stats
       ▼
  dashboard.service.ts (modules/dashboard/)
       │
       ├─ % Compliant / Partial / Non-compliant
       ├─ Overdue CAPs
       ├─ By regulation, department, date
       └─ JSON → charts (Recharts / Chart.js)
```

---

## 🔑 FAQ — Quick Answers

| Question | Answer |
|----------|--------|
| User uploads gov + internal docs? | ✅ Yes. One UI; tag each file `requirement` or `internal`. |
| Upload to Supabase Storage? | ✅ Binary in bucket; DB stores URL. |
| Extract text locally? | ✅ NestJS + pdf-parse, mammoth, tesseract, etc. No AI cost. |
| Chunks for everything? | ❌ Chunks **internal** only. Requirements → **points** (articles). |
| Embeddings? | ✅ Gemini `text-embedding-004`, 768 dims → `document_chunks`. |
| How does RAG search work? | Embed requirement → pgvector top-5 → prompt → `gemini-2.0-flash` JSON. |
| Excel output? | ✅ ExcelJS reads `requirements` + `compliance_items`. |

---

## 📁 Module Map (apps/api)

| Stage | NestJS path |
|-------|-------------|
| 1 Upload | `modules/documents/` |
| 2 Extract | `modules/extraction/` |
| 4A Points | `modules/requirements/` |
| 4B RAG index | `modules/rag/` (chunking, embedding, vector-store, retrieval) |
| 5 Compare | `modules/comparison/` |
| 6 Excel | `modules/excel/` |
| 7 Items + alerts | `modules/compliance-items/`, `modules/alerts/` |
| 8 Dashboard | `modules/dashboard/` |
| Shared | `common/supabase/`, `common/gemini/` |
| Health | `modules/health/` → `GET /health` |

---

## 🗄️ Core Tables

```
documents          — file metadata + storage URL + type (requirement|internal)
requirements       — one row per regulation article/point
document_chunks    — internal doc chunks + vector(768)
compliance_items   — compare result per requirement (+ CAP, dates, status)
analysis_sessions  — links requirement doc + internal doc(s) for a run
notifications      — alert log (optional, Stage 7)
```

Full SQL: see `docs/workflows/11-database-schema.md`.

---

## ⏭️ Build Order (After Scaffold)

1. Database migrations (`apps/api/db/migrations/`)
2. Test `GET /health` (Supabase + Gemini)
3. Stage 1 — upload flow
4. Stage 2 — extraction
5. Stage 4A / 4B — points vs chunks
6. Stage 5 — comparison engine
7. Stage 6 — Excel
8. Stages 7–8 — tracking + dashboard

---

## Summary

Architecture 2 is the **Gemini + Supabase + NestJS monorepo** path: local extraction, vector index on internal policies, RAG loop per regulation point, Excel + dashboard for compliance officers. Replaces Architecture 1 (Express + Python AI Engine + Ollama).
