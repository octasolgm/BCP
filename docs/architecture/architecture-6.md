# 🏗️ BCP Architecture 6 — Complete Workflow

**Version:** 6.0  
**Stack:** Next.js 14 (`apps/web`) + NestJS (`apps/api`) + Supabase (Storage + Postgres + pgvector) + **Gemini only**  
**Embeddings:** `text-embedding-004` (768 dimensions)  
**Chat / classify:** `gemini-2.0-flash`

This document maps **each stage** to: what happens, which NestJS module does it, which external service is called, and where data lives. It is the **authoritative design bible** for BCP implementation.

**How to use:** Tell any Cursor session: *"Read `docs/architecture/architecture-6.md` first."*

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
                               │  (768 dimensions)   │
                               │  gemini-2.0-flash   │
                               └─────────────────────┘
```

| Layer | Port | Responsibility |
|-------|------|----------------|
| `apps/web` | 3000 | Upload UI, compliance grid, Excel download, dashboard |
| `apps/api` | 4000 | REST API, extraction, RAG, comparison, Excel generation |
| Supabase Storage | — | Binary files (PDF, Word, Excel, images) |
| Supabase Postgres | — | Metadata, requirements, chunks, compliance results |
| Gemini API | — | Embeddings + classification only |

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
  │                                      │      │  - extraction_status     │
  └─────────────────────────────────────┘      └─────────────────────────┘

  ✅ Result: File binary in Supabase Storage. DB holds pointer (URL) + metadata.
```

| Item | Detail |
|------|--------|
| **Who** | Compliance officer via `apps/web` |
| **API** | `POST /documents/upload` |
| **Module** | `apps/api/src/modules/documents/` |
| **Storage** | Supabase Storage bucket `documents` |
| **DB** | `documents` table |
| **External AI** | None at upload |

### Why

Files must live somewhere persistent and cheap (Supabase Storage), while the DB keeps lightweight metadata for queries, filtering, and orchestration of downstream stages.

### Edge cases

- File > 50 MB → reject in controller with HTTP 413
- Unknown MIME → store anyway, mark `extraction_status = 'unsupported'`
- Duplicate upload (same name + size + user) → return existing row, don't re-store
- Upload interrupted mid-transfer → client retries; server uses idempotent key if provided
- Empty file (0 bytes) → reject with HTTP 400 before Storage write
- Wrong `doc_type` tag (user mistake) → allow edit via PATCH before analysis starts

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
| **Output** | Single plain-text string; optionally cached in `documents.extracted_text` |
| **Next** | Fork by `documents.type` → Stage 3 |

### Why

Cheap, fast, private — runs in Node.js. AI is only used where it adds value (embeddings + classification), not for plain text extraction from digital documents.

### Extraction routing table

| Format | Library | Notes |
|--------|---------|-------|
| PDF (text layer) | `pdf-parse` | Fast; fails on scanned pages |
| PDF (scanned) | `tesseract.js` | OCR fallback after pdf-parse returns < 50 chars/page |
| Word `.docx` | `mammoth` | Plain text; tables may flatten |
| Excel `.xlsx` | `xlsx` | Cell values concatenated |
| HTML | `cheerio` | Body text; scripts stripped |
| JPEG / PNG | `tesseract.js` | OCR |
| Email `.eml` / `.txt` | plain read | Body only |

### Edge cases

- Scanned PDF with no text layer → fallback to `tesseract.js` OCR
- Empty extraction (< 50 chars) → mark `extraction_status = 'empty'`, skip downstream
- Password-protected PDF → catch error, mark `extraction_status = 'locked'`
- Encoding issues in `.docx` / email → strip non-printable chars
- Very large PDF (200+ pages) → extract in background job; set `extraction_status = 'processing'`
- Corrupt file → mark `extraction_status = 'failed'`, surface error in UI
- Arabic + English mixed text → preserve both; store detected `language` on document row

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

| Path | Processing | Output table |
|------|------------|--------------|
| **Requirement** | Split into articles/points — **never chunk** | `requirements` |
| **Internal** | Chunk + embed for vector search | `document_chunks` |

### Why

Requirements and internal docs serve opposite roles:

- **Requirements** are the **QUESTIONS** we iterate through (one per Excel row).
- **Internal docs** are the **ANSWER BANK** we search for evidence.

This is the single most important design decision in the system. Mixing them (e.g. chunking regulations) breaks the one-row-per-obligation Excel model.

### Edge cases

- User tagged wrong type → allow re-tag before analysis; re-run 4A or 4B
- Same file uploaded as both types (two rows) → allowed; user picks at analysis time
- Requirement doc with no detectable articles → force Gemini splitter (Stage 4A Option B)
- Internal doc that's very short (1 page) → still goes to 4B as single chunk

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
  │    Step 1: Regex splitter            │
  │    Step 2: Gemini fallback if < 3    │
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
            ├─ content        (full text of that article)
            └─ language       (optional)

  ✅ List of "things we must comply with" — one row per obligation.
```

| Item | Detail |
|------|--------|
| **Module** | `apps/api/src/modules/requirements/` |
| **DB** | `requirements` |
| **Gemini?** | Fallback only when regex finds < 3 points |
| **Not chunked** | Whole articles kept as logical units |

### Why

Each regulatory point (Article 1, Article 2, …) becomes one Excel row, so we must **split — never chunk** the regulation.

### Splitter strategy (hybrid)

1. **Try regex first:** `/^(Article|Section|Clause)\s+\d+/im` — free, instant, deterministic.
2. **If fewer than 3 points found**, fall back to Gemini with the prompt below.
3. **Persist** `point_number`, `title`, `content` per row; optional `language` column.

### Gemini fallback prompt template

```
SYSTEM: You parse legal/regulatory documents into discrete numbered
obligations. Output strict JSON only. Do not invent text not present
in the document.

USER: Split the document below into an array of points. For each point
return { "number": "Article 1", "title": "Definitions", "content": "..." }.
Preserve original wording in `content`. Do not summarise.

DOCUMENT:
{{full_extracted_text}}
```

### Expected splitter response shape

```json
[
  {
    "number": "Article 5",
    "title": "Sanctions Screening",
    "content": "Article 5 — Sanctions Screening. Licensed financial institutions shall screen all customers and transactions against the consolidated United Nations Security Council sanctions list prior to onboarding and on a daily basis thereafter. Enhanced due diligence shall apply to politically exposed persons as defined in Article 1."
  }
]
```

### Edge cases

- Annexes / schedules → treat as separate points if they contain obligations
- Sub-clauses (1.1, 1.2) → keep nested inside parent `content` for v1 (split later if accuracy demands)
- Multi-language regulations → detect language, store `language` column
- Duplicate article numbers in OCR output → merge or flag for human review
- Preamble / definitions-only articles → still stored; comparison may return `compliant` trivially
- Cabinet Decision scanned PDF → regex may fail → Gemini fallback essential

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
  │                                      │      │  ├─ content_hash         │
  │                                      │      │  ├─ embedding_status     │
  │                                      │      │  └─ embedding vector(768)│
  └─────────────────────────────────────┘      └─────────────────────────┘

  ✅ Bank policies indexed — searchable by meaning, not keywords.
```

| Item | Detail |
|------|--------|
| **Module** | `apps/api/src/modules/rag/` |
| **Services** | `chunking`, `embedding`, `vector-store`, `retrieval` |
| **Gemini** | `text-embedding-004` — **768 dimensions** |
| **DB** | `document_chunks` with `vector(768)` |

### Why

Internal policies are long and unstructured. We can't send all of them to Gemini for every requirement (cost + context window). Chunking + embedding turns them into a vector index searchable by meaning.

### Chunking config (v1)

| Setting | Value |
|---------|-------|
| Target size | ~500 tokens per chunk |
| Overlap | ~50 tokens |
| Boundary preference | Paragraph breaks > sentence breaks |
| Min chunk size | 100 tokens (merge smaller tail) |

### pgvector setup (Supabase SQL reference)

```sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE document_chunks (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id   uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  chunk_index   integer NOT NULL,
  content       text NOT NULL,
  content_hash  text,
  embedding     vector(768),
  embedding_status text DEFAULT 'pending',
  created_at    timestamptz DEFAULT now()
);

CREATE INDEX ON document_chunks
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);
```

### Edge cases

- Very short docs (< 1 chunk) → still embed as a single chunk
- Identical chunks across re-uploads → dedupe by `content_hash` before embedding
- Gemini rate limits → batch + retry with exponential backoff
- Embedding failure for a chunk → mark `embedding_status = 'failed'`, exclude from retrieval
- Re-upload replaces old chunks → delete by `document_id` then re-insert
- Table-heavy Excel policy → chunk by sheet or row groups

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
   │  Step 2: RAG RETRIEVE (pgvector cosine distance)              │
   │  rag/retrieval.service.ts → top 5 chunks                      │
   └────────────────┬───────────────────────────────────────────────┘
                    │
   ┌────────────────▼───────────────────────────────────────────────┐
   │  Step 3: AUGMENT + GENERATE                                   │
   │  prompts/compare-prompt.ts + gemini-2.0-flash                   │
   │  → strict JSON verdict                                          │
   └────────────────┬───────────────────────────────────────────────┘
                    │
   ┌────────────────▼───────────────────────────────────────────────┐
   │  Step 4: SAVE → compliance_items                               │
   └────────────────────────────────────────────────────────────────┘

  💡 RAG = Retrieve (pgvector) + Augment (prompt) + Generate (Gemini)
```

| Item | Detail |
|------|--------|
| **Module** | `apps/api/src/modules/comparison/` |
| **RAG retrieve** | `apps/api/src/modules/rag/retrieval.service.ts` |
| **Prompts** | `apps/api/src/modules/comparison/prompts/compare-prompt.ts` |
| **Gemini chat** | `gemini-2.0-flash` |
| **Gemini embed** | `text-embedding-004` (768 dims) |
| **DB** | `compliance_items` (one row per requirement per session) |

### Why

This is the entire product's value. RAG (Retrieve + Augment + Generate) grounds Gemini's verdict in the bank's actual policies, preventing hallucinated compliance.

### Real retrieval SQL (pgvector)

```sql
-- $1 = query embedding (768-dim vector from requirement text)
-- $2 = array of internal document UUIDs for this analysis session

SELECT
  c.id,
  c.document_id,
  c.chunk_index,
  c.content,
  1 - (c.embedding <=> $1::vector) AS similarity
FROM document_chunks c
WHERE c.document_id = ANY($2::uuid[])
  AND c.embedding_status = 'ok'
  AND c.embedding IS NOT NULL
ORDER BY c.embedding <=> $1::vector
LIMIT 5;
```

**Operator note:** `<=>` is cosine **distance** in pgvector (lower = more similar). `similarity` column converts to 0–1 scale for UI thresholds.

### Optional similarity threshold

| similarity | Action |
|------------|--------|
| ≥ 0.75 | Include in prompt |
| 0.50 – 0.74 | Include with caveat in prompt |
| < 0.50 | May still pass top-5 but flag low-confidence retrieval |

### Real Gemini comparison prompt template

```
SYSTEM: You are a senior banking compliance analyst. Given a regulatory
requirement and excerpts from the bank's internal policies, decide whether
the bank fulfils the requirement.

Return STRICT JSON only — no markdown, no prose outside JSON:
{
  "level": "compliant" | "partial" | "non_compliant",
  "reasoning": "1-3 sentences citing which excerpts support your verdict",
  "evidence_chunk_ids": ["<uuid>", ...],
  "confidence": 0.0-1.0,
  "uae_response": "Short summary for Excel column B — how the bank addresses this"
}

Rules:
- "compliant"     = all material elements of the requirement are covered
- "partial"       = some elements covered, others missing or vague
- "non_compliant" = no meaningful evidence found
- Base verdict ONLY on provided excerpts. Do not assume unstated policies.

USER:
REQUIREMENT:
{{requirement_number}} — {{requirement_title}}
{{requirement_content}}

EVIDENCE (top {{k}} excerpts, ranked by similarity):
[<id1>] (sim={{sim1}}) {{chunk_1_content}}
[<id2>] (sim={{sim2}}) {{chunk_2_content}}
...
```

### Expected response shape

```json
{
  "level": "partial",
  "reasoning": "Excerpts a3f2... and 9c11... cover daily UN-list screening at onboarding, but no excerpt addresses PEP enhanced due diligence required by the second sentence of Article 5.",
  "evidence_chunk_ids": [
    "a3f2b1c0-0000-4000-8000-000000000047",
    "9c11d4e2-0000-4000-8000-000000000012"
  ],
  "confidence": 0.82,
  "uae_response": "UAE Implementation of TFS — daily UN sanctions screening is documented in AML Policy Section 4.2; PEP procedures not found in provided excerpts."
}
```

### Mapping Gemini JSON → `compliance_items` row

| JSON field | DB column |
|------------|-----------|
| `level` | `compliance_level` |
| `reasoning` | `reasoning` |
| `uae_response` | `uae_response` |
| `evidence_chunk_ids` | `evidence_chunks` (jsonb array) |
| `confidence` | `confidence` |

### Worked end-to-end example (Article 5 — Sanctions Screening)

#### 4A — Requirement point saved

After regex/Gemini split of Cabinet Decision PDF:

| column | value |
|--------|-------|
| `point_number` | Article 5 |
| `title` | Sanctions Screening |
| `content` | *"Article 5 — Sanctions Screening. Licensed financial institutions shall screen all customers and transactions against the consolidated United Nations Security Council sanctions list prior to onboarding and on a daily basis thereafter. Enhanced due diligence shall apply to politically exposed persons as defined in Article 1."* |

#### 4B — Sample internal chunks indexed (TFS Manual)

| chunk id | chunk_index | content (abbreviated) |
|----------|-------------|------------------------|
| `a3f2...047` | 47 | *"Section 4.2 — Sanctions Filtering. All new customers are screened against the UN consolidated list using the bank's core screening system before account activation. Ongoing screening runs daily at 02:00 GST."* |
| `9c11...012` | 12 | *"Section 2.1 — Onboarding. Customer due diligence includes identity verification and sanctions screening per CBUAE requirements."* |
| `b7e4...089` | 89 | *"Section 8.4 — Record Retention. Screening logs are retained for five years."* |

*(Embeddings: 768-dim vectors stored in `document_chunks.embedding`)*

#### 5 — Retrieval for Article 5

1. `embed(Article 5 full content)` → query vector `q`
2. SQL returns top 5; highest similarity:

| rank | chunk_id | similarity | snippet |
|------|----------|------------|---------|
| 1 | `a3f2...047` | 0.91 | daily UN screening |
| 2 | `9c11...012` | 0.84 | onboarding sanctions screening |
| 3 | `b7e4...089` | 0.62 | record retention (weak match) |

#### 5 — Gemini verdict

```json
{
  "level": "partial",
  "reasoning": "Chunk 047 and 012 demonstrate UN list screening at onboarding and daily cycles. No chunk describes PEP enhanced due diligence.",
  "evidence_chunk_ids": ["a3f2b1c0-0000-4000-8000-000000000047", "9c11d4e2-0000-4000-8000-000000000012"],
  "confidence": 0.82,
  "uae_response": "Partially addressed — UN sanctions screening covered in TFS Manual §4.2; PEP EDD not evidenced."
}
```

#### 5 — INSERT `compliance_items`

| column | value |
|--------|-------|
| `requirement_id` | (FK to Article 5 row) |
| `compliance_level` | `partial` |
| `uae_response` | *Partially addressed — UN sanctions screening covered…* |
| `reasoning` | *(from Gemini)* |
| `evidence_chunks` | `["a3f2...047","9c11...012"]` |
| `confidence` | `0.82` |
| `cap` | `NULL` |
| `target_date` | `NULL` |
| `responsibility` | `NULL` |
| `status` | `open` |

#### 6 — Excel row produced

| Col | Value |
|-----|-------|
| A | Full Article 5 text |
| B | *Partially addressed — UN sanctions screening covered in TFS Manual §4.2…* |
| C | Partial |
| D | partial (amber fill) |
| E | *(empty — user fills CAP in Stage 7)* |
| F | *(empty)* |
| G | *(empty)* |
| H | open |

### Edge cases

- Zero chunks retrieved (no internal docs) → automatic `non_compliant`, confidence `1.0`, reasoning *"No evidence found"*
- Gemini returns invalid JSON → retry once with stricter instruction; on second failure mark `comparison_status = 'failed'`, surface in UI
- Very long requirement content → truncate at ~3000 tokens for prompt; keep full text in DB
- Conflicting evidence → Gemini explains in `reasoning`; user can override in UI (Stage 7)
- All top-5 similarity < 0.40 → still call Gemini but prepend *"LOW RETRIEVAL CONFIDENCE"*
- Session with multiple internal docs → `$2::uuid[]` includes all selected internal `document_id`s

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
| **UI** | `apps/web/src/app/compliance/page.tsx` → download button |

### Why

Compliance officers live in Excel. The output must match the client's sample template exactly (green header row, Articles in column A, etc.) so it slots into their existing workflow.

### Column mapping

| Col | Header (client style) | Source |
|-----|----------------------|--------|
| A | Requirement | `requirements.content` |
| B | UAE Response | `compliance_items.uae_response` |
| C | Comply (Yes/No/Partial) | derived from `compliance_level` |
| D | Compliance Level | `compliance_level` + conditional fill (green / amber / red) |
| E | Corrective Action Plan | `compliance_items.cap` |
| F | Target Date | `compliance_items.target_date` |
| G | Responsibility | `compliance_items.responsibility` |
| H | Status | `compliance_items.status` |

### Comply column derivation

| `compliance_level` | Col C |
|--------------------|-------|
| `compliant` | Yes |
| `partial` | Partial |
| `non_compliant` | No |

### Formatting rules

- Header row: bold white text, dark green background, freeze pane row 1
- Wrap text columns A and B; auto row height
- Date column F: `DD-MMM-YYYY`
- Borders: thin on all data cells

### Edge cases

- Long article text → wrap text + set row height auto
- Missing CAP / date on partial/non rows → flag yellow border, do not block download
- Multiple regulations in one session → one sheet per regulation + index sheet
- Failed comparison rows → include with status `comparison_status = 'failed'`, Col C = "Review"
- Zero requirements in session → return empty sheet with headers only

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
    → POST /comparison/re-evaluate
    → Stage 5 for open items
    → status → closed if now compliant

  Daily cron (@nestjs/schedule):
    modules/alerts/alerts.service.ts
    → target_date < TODAY AND status != closed
    → notifications table + email
```

| Item | Detail |
|------|--------|
| **CAP / dates** | `modules/compliance-items/` |
| **Re-eval** | `comparison.service` re-run |
| **Alerts** | `modules/alerts/` + `@nestjs/schedule` cron |

### Why

A verdict alone doesn't fix a gap. The system must track remediation (CAP + owner + date) and prove the gap closed after a new policy upload.

### Re-evaluation trigger

When a new internal doc is uploaded **or** an existing one re-uploaded:

1. Re-run Stage 4B (chunk + embed) for that doc.
2. For every `compliance_items` row where `status != 'closed'`, re-run Stage 5 retrieval + Gemini.
3. If new verdict = `compliant` → set `status = 'closed'`, log transition in `audit_log`.

### Alerts (cron)

- **Schedule:** daily 08:00 via `@nestjs/schedule`
- **Query:** items with `target_date < today` AND `status != 'closed'`
- **Action:** INSERT into `notifications`; email `responsibility` owner + compliance head
- **Module:** `apps/api/src/modules/alerts/alerts.service.ts`

### Edge cases

- User clears CAP / date → keep status as `open`, no alert
- Target date in the past at creation → immediate alert on next cron tick
- Owner unassigned → escalate to compliance head distribution list
- Re-eval improves partial → compliant → auto-close; user notified
- Re-eval worsens compliant → partial → reopen row, alert compliance head

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
       ├─ Trend over time (30 / 90 days)
       ├─ Overdue CAPs count
       ├─ Breakdown by regulation, department, owner
       └─ JSON → charts (Recharts)
```

| Item | Detail |
|------|--------|
| **UI** | `apps/web/src/app/dashboard/page.tsx` |
| **API** | `GET /dashboard/stats`, `GET /dashboard/overdue` |
| **Module** | `apps/api/src/modules/dashboard/` |

### Why

Leadership wants a single screen showing portfolio-wide compliance health without opening Excel.

### Metrics surfaced

| Metric | SQL concept |
|--------|-------------|
| Overall compliance % | `COUNT(compliant) / COUNT(*)` per session or portfolio |
| Partial / non counts | `GROUP BY compliance_level` |
| Overdue CAPs | `target_date < now() AND status != 'closed'` |
| Trend 30/90 days | `compliance_items` joined to `analysis_sessions.completed_at` |
| By regulation | `GROUP BY documents.name` via `requirements.document_id` |
| By owner | `GROUP BY responsibility` |
| Drill-down | Link to `/compliance?sessionId=&level=partial` |

### Edge cases

- No completed sessions → show empty state, not 0% misleading chart
- Stale data after re-eval → dashboard caches 60s max; invalidate on session complete webhook
- Large portfolio → paginate breakdown tables

---

## 🔑 FAQ — Quick Answers

| Question | Answer |
|----------|--------|
| User uploads gov + internal docs? | ✅ Yes. One UI; tag each file `requirement` or `internal`. |
| Upload to Supabase Storage? | ✅ Binary in bucket `documents`; DB stores URL. |
| Extract text locally? | ✅ NestJS + pdf-parse, mammoth, tesseract, etc. No Gemini cost. |
| Chunks for everything? | ❌ Chunks **internal** only. Requirements → **points** (articles). |
| Embeddings? | ✅ Gemini `text-embedding-004`, **768 dims** → `document_chunks`. |
| How does RAG search work? | Embed requirement → pgvector top-5 → prompt → `gemini-2.0-flash` JSON. |
| Excel output? | ✅ ExcelJS reads `requirements` + `compliance_items`. |
| Where does comparison run? | NestJS `apps/api` — not in the browser. |
| Can user override AI verdict? | ✅ Stage 7 — manual status / notes; audit logged. |
| Re-upload fixed policy? | ✅ Re-run 4B + Stage 5 for open items. |

---

## 📁 Module Map (apps/api)

| Stage | NestJS path | Key files |
|-------|-------------|-----------|
| Bootstrap | `src/main.ts`, `src/app.module.ts` | CORS, ValidationPipe, ConfigModule |
| 1 Upload | `modules/documents/` | `documents.controller.ts`, `documents.service.ts` |
| 2 Extract | `modules/extraction/` | `extraction.service.ts` (no controller) |
| 3 Fork | orchestrated in documents/ingestion pipeline | branches on `documents.type` |
| 4A Points | `modules/requirements/` | `requirements.controller.ts`, `requirements.service.ts` |
| 4B RAG index | `modules/rag/` | `chunking`, `embedding`, `vector-store`, `retrieval` services |
| 5 Compare | `modules/comparison/` | `comparison.service.ts`, `prompts/compare-prompt.ts` |
| 6 Excel | `modules/excel/` | `excel.service.ts`, `excel.controller.ts` |
| 7 Items | `modules/compliance-items/` | PATCH CAP, dates, owner |
| 7 Alerts | `modules/alerts/` | cron + notifications |
| 8 Dashboard | `modules/dashboard/` | aggregation queries |
| Shared Supabase | `common/supabase/` | `supabase.service.ts` |
| Shared Gemini | `common/gemini/` | `gemini.service.ts` — embed + generate |
| Health | `modules/health/` | `GET /health` |

---

## 🗄️ Core Tables

### Entity relationship (ASCII)

```
documents ──┬──► requirements (requirement docs only)
            └──► document_chunks (internal docs only)

analysis_sessions ──► links requirement_doc_id + internal_doc_ids[]

requirements ──► compliance_items ◄── analysis_sessions
                      │
                      └──► notifications
```

### `documents`

| column | type |
|--------|------|
| id | uuid PK |
| name | text NOT NULL |
| type | text CHECK IN ('requirement','internal') |
| file_url | text NOT NULL |
| mime_type | text |
| storage_path | text |
| extracted_text | text |
| extraction_status | text DEFAULT 'pending' |
| uploaded_by | uuid FK → users |
| language | text |
| created_at | timestamptz DEFAULT now() |
| updated_at | timestamptz |

### `requirements`

| column | type |
|--------|------|
| id | uuid PK |
| document_id | uuid FK → documents NOT NULL |
| point_number | text NOT NULL |
| title | text |
| content | text NOT NULL |
| language | text |
| sort_order | integer |
| created_at | timestamptz DEFAULT now() |

### `document_chunks`

| column | type |
|--------|------|
| id | uuid PK |
| document_id | uuid FK → documents NOT NULL |
| chunk_index | integer NOT NULL |
| content | text NOT NULL |
| content_hash | text |
| embedding | vector(768) |
| embedding_status | text DEFAULT 'pending' |
| created_at | timestamptz DEFAULT now() |

### `analysis_sessions`

| column | type |
|--------|------|
| id | uuid PK |
| user_id | uuid FK → users |
| requirement_document_id | uuid FK → documents |
| internal_document_ids | uuid[] |
| status | text CHECK IN ('pending','running','completed','failed') |
| started_at | timestamptz |
| completed_at | timestamptz |
| created_at | timestamptz DEFAULT now() |

### `compliance_items`

| column | type |
|--------|------|
| id | uuid PK |
| session_id | uuid FK → analysis_sessions |
| requirement_id | uuid FK → requirements |
| compliance_level | text CHECK IN ('compliant','partial','non_compliant') |
| uae_response | text |
| reasoning | text |
| evidence_chunks | jsonb |
| confidence | numeric(4,3) |
| cap | text |
| target_date | date |
| responsibility | text |
| status | text DEFAULT 'open' |
| comparison_status | text DEFAULT 'ok' |
| created_at | timestamptz DEFAULT now() |
| updated_at | timestamptz |

### `notifications`

| column | type |
|--------|------|
| id | uuid PK |
| user_id | uuid FK → users |
| compliance_item_id | uuid FK → compliance_items |
| type | text |
| channel | text |
| sent_at | timestamptz |
| read_at | timestamptz |

DDL migrations live in `apps/api/db/migrations/`. Extended reference: `docs/workflows/11-database-schema.md`.

---

## ⏭️ Build Order (After Scaffold)

1. **Database migrations** — create tables above + `vector` extension + ivfflat index
2. **`GET /health`** — verify Supabase client + Gemini embed ping
3. **Stage 1** — `POST /documents/upload` → Storage + `documents` row
4. **Stage 2** — extraction pipeline + `extraction_status` updates
5. **Stage 4A** — regex splitter + Gemini fallback → `requirements`
6. **Stage 4B** — chunk + embed → `document_chunks`
7. **Stage 5** — comparison loop → `compliance_items`
8. **Stage 6** — Excel download
9. **Stage 7** — PATCH items, re-eval, alerts cron
10. **Stage 8** — dashboard stats + Next.js charts

---

## Summary

Architecture 6 is the **definitive Gemini + Supabase + NestJS monorepo design** for BCP: local Node.js extraction, requirement points (not chunks) for regulations, vector-indexed internal policies at **768 dimensions** via `text-embedding-004`, RAG-grounded classification via `gemini-2.0-flash`, Excel output matching the client template, and lifecycle tracking through CAPs, re-evaluation, and MIS dashboard. Every future implementation decision should trace back to a stage in this document.
