# 📦 BCP — After Web Sends Files (Complete Box Guide)

**Version:** 2.0 — Azure + Gemini  
**Date:** 2026-06-22  

> **Stack:** NestJS backend → Azure (storage, extract, search) → **Gemini API** (compare). No Python.  
> **Pair with:** [COMPLETE_WORKFLOW_EXPLAINED.md](./COMPLETE_WORKFLOW_EXPLAINED.md) (only these 2 workflow docs).

---

## CONFUSED? — 3 Answers First

### ① Why `requirement_doc_id`?

You upload **many files**. The system must know **which one is the regulation** vs **which are bank policies**.

```
Upload returns IDs from database:
  doc-1 = Cabinet74.pdf          → type: REQUIREMENT  ← this is requirement_doc_id
  doc-2 = TFS-Manual.pdf         → type: INTERNAL
  doc-3 = Sanctions-Policy.pdf   → type: INTERNAL

When you click Analyze, web sends:
  requirementDocId: "doc-1"           ← THE LAW (one file)
  internalDocIds: ["doc-2", "doc-3"]  ← BANK POLICIES (one or more)

analysis_sessions table stores requirement_doc_id so later you know:
  "Session sess-1 compared doc-1 against doc-2 + doc-3"
```

**Simple:** `requirement_doc_id` = pointer to the **regulation PDF**. Not the bank files.

---

### ② What is BullMQ?

Analysis takes **2–5 minutes**. User cannot stare at a loading screen that long.

```
WITHOUT BullMQ:
  User clicks Analyze → browser waits 5 min → timeout error ❌

WITH BullMQ:
  User clicks Analyze → backend says "processing" in 1 second ✅
  → hard work runs in BACKGROUND
  → web refreshes status every few seconds until done
```

```
┌─────────────────────────────────────────────────────────────┐
│  BullMQ = to-do list for slow jobs                          │
│  Redis  = where that to-do list lives (in memory)           │
│                                                             │
│  1. NestJS adds job: "analyze sess-1"                       │
│  2. BullMQ Worker (same NestJS app) picks it up             │
│  3. Worker calls Azure + Gemini                             │
│  4. Worker saves results                                    │
└─────────────────────────────────────────────────────────────┘
```

**Simple:** BullMQ = **"do this heavy work later, tell user to wait."**

---

### ③ How are files read? (Section 5 simplified)

**NestJS does NOT open the PDF itself.** It sends the file to Azure.

```
PDF in Azure Blob Storage
        │
        ▼
NestJS sends blob URL to Azure Document Intelligence
        │
        ▼
Azure returns plain text:
  "Article 1 - Definitions...
   Article 2 - Mandate..."
        │
        ▼
NestJS saves text in PostgreSQL (documents.extracted_text)
```

Works for **text PDFs AND scanned images** (OCR built into Azure).  
**Gemini is NOT used here** — Gemini only compares text later.

---

## START HERE — The Whole Journey in One Box

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                          │
│   WEB sends files  →  BACKEND saves  →  WORKER processes  →  RAG loop   │
│   →  DATABASE stores rows  →  WEB shows grid + Excel                    │
│                                                                          │
│   Time: 2–5 minutes (user sees "Processing..." then results)            │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## PART 1 — Web Sends Files to Backend

```
┌──────────────┐
│  USER        │
│  clicks      │
│  "Analyze"   │
└──────┬───────┘
       │
       │  Files in browser memory:
       │  • Cabinet74.pdf        (requirement)
       │  • TFS-Manual.pdf       (bank policy)
       │  • Sanctions-Policy.pdf (bank policy)
       ▼
┌──────────────────────────────────────────────────────────────────┐
│  REACT WEB APP                                                    │
│  • Builds FormData (multipart upload)                            │
│  • Adds JWT token in header: Authorization: Bearer xxx           │
│  • Calls: POST /api/v1/documents/upload  (each file)             │
│  • Then calls: POST /api/v1/analysis/compare                     │
│         body: { requirementDocId, internalDocIds: [...] }        │
└──────────────────────────────┬───────────────────────────────────┘
                               │
                               │  HTTPS
                               ▼
┌──────────────────────────────────────────────────────────────────┐
│  NESTJS / NODE BACKEND  (your API server — port 4000)            │
│  Receives the request FIRST                                      │
└──────────────────────────────────────────────────────────────────┘
```

**Services needed so far:**

| Service | Role |
|---------|------|
| React Web | UI |
| `@bcp/api-client` | Typed HTTP calls |
| NestJS/Node Backend | API server |

---

## PART 2 — Backend Receives Upload (First 2 Seconds)

```
POST /documents/upload arrives at Backend
                │
                ▼
┌──────────────────────────────────────────────────────────────────┐
│  STEP 2A — AUTH CHECK                                             │
├──────────────────────────────────────────────────────────────────┤
│  • Read JWT token from header                                     │
│  • Is user logged in? Role = compliance_officer?                  │
│  • NO  → return 401 Unauthorized                                  │
│  • YES → continue                                                 │
└──────────────────────────────┬───────────────────────────────────┘
                               ▼
┌──────────────────────────────────────────────────────────────────┐
│  STEP 2B — FILE VALIDATION                                        │
├──────────────────────────────────────────────────────────────────┤
│  • File extension: .pdf .docx .xlsx allowed?                      │
│  • File size < 50 MB?                                             │
│  • MIME type matches? (not fake .exe renamed .pdf)                │
│  • FAIL → return 400 "Invalid file"                               │
└──────────────────────────────┬───────────────────────────────────┘
                               ▼
┌──────────────────────────────────────────────────────────────────┐
│  STEP 2C — SAVE FILE TO AZURE BLOB STORAGE                        │
├──────────────────────────────────────────────────────────────────┤
│  Container: bcp-uploads/2026/06/uuid-abc.pdf                      │
│  Original filename kept in DB only                                │
└──────────────────────────────┬───────────────────────────────────┘
                               ▼
┌──────────────────────────────────────────────────────────────────┐
│  STEP 2D — SAVE METADATA IN DATABASE                              │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  PostgreSQL → documents table:                                    │
│  ┌────────┬─────────────────┬─────────────┬──────────────────┐  │
│  │ id     │ filename        │ type        │ file_path        │  │
│  ├────────┼─────────────────┼─────────────┼──────────────────┤  │
│  │ doc-1  │ Cabinet74.pdf   │ requirement │ blob://abc...    │  │
│  │ doc-2  │ TFS-Manual.pdf  │ internal    │ blob://def...    │  │
│  └────────┴─────────────────┴─────────────┴──────────────────┘  │
│                                                                   │
│  status = "uploaded" (not analyzed yet)                           │
│                                                                   │
└──────────────────────────────┬───────────────────────────────────┘
                               ▼
┌──────────────────────────────────────────────────────────────────┐
│  STEP 2E — RETURN TO WEB                                          │
├──────────────────────────────────────────────────────────────────┤
│  Response: { documentId: "doc-1", status: "uploaded" }            │
│  Web now has IDs to start analysis                                │
└──────────────────────────────────────────────────────────────────┘
```

**Services needed:**

| Service | Role |
|---------|------|
| PostgreSQL | Store file metadata |
| Azure Blob Storage | Store actual PDF bytes |
| Multer (NestJS) | Handle multipart upload |

---

## PART 3 — User Clicks "Start Analysis"

```
POST /analysis/compare
body: {
  requirementDocId: "doc-1",
  internalDocIds: ["doc-2", "doc-3"]
}
                │
                ▼
┌──────────────────────────────────────────────────────────────────┐
│  STEP 3A — CREATE ANALYSIS SESSION IN DATABASE                    │
├──────────────────────────────────────────────────────────────────┤
│  analysis_sessions table:                                         │
│  ┌────────┬──────────────┬────────────────────┬────────────┐     │
│  │ id     │ user_id      │ requirement_doc_id │ status     │     │
│  ├────────┼──────────────┼────────────────────┼────────────┤     │
│  │ sess-1 │ officer-ali  │ doc-1              │ processing │     │
│  └────────┴──────────────┴────────────────────┴────────────┘     │
└──────────────────────────────┬───────────────────────────────────┘
                               ▼
┌──────────────────────────────────────────────────────────────────┐
│  STEP 3B — ADD JOB TO QUEUE (don't make user wait!)               │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Redis + BullMQ queue:                                            │
│  ┌─────────────────────────────────────────┐                     │
│  │ JOB: { sessionId: "sess-1",              │                     │
│  │        requirementDocId: "doc-1",        │                     │
│  │        internalDocIds: ["doc-2","doc-3"]}│                     │
│  └─────────────────────────────────────────┘                     │
│                                                                   │
│  Backend immediately returns to web:                              │
│  { sessionId: "sess-1", status: "processing" }                  │
│                                                                   │
│  Web shows: "Analysis in progress... 0%"                          │
│  Web polls: GET /analysis/sess-1 every few seconds                │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

**Services needed:**

| Service | Role |
|---------|------|
| Redis | Job queue |
| BullMQ | Background worker in NestJS |

---

## PART 4 — BullMQ Worker Starts (NestJS + Azure + Gemini)

```
Azure Redis → BullMQ worker picks up job
                │
                ▼
┌──────────────────────────────────────────────────────────────────┐
│  NESTJS WORKER (BullMQ processor inside same App Service)        │
│  Calls Azure APIs + Gemini API in order:                          │
│    1. Document Intelligence (read files)                          │
│    2. Split articles (NestJS code)                                │
│    3. Azure OpenAI embeddings + AI Search (find matches)        │
│    4. Gemini API (compare each article)                         │
└──────────────────────────────────────────────────────────────────┘
```

---

## PART 5 — READ FILES (Azure Document Intelligence)

```
Worker reads blob_url from database (doc-1 = Cabinet Decision 74)
                │
                ▼
┌──────────────────────────────────────────────────────────────────┐
│  STEP 5A — REQUIREMENT FILE (doc-1)                               │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  NestJS → Azure Document Intelligence (prebuilt-read model)       │
│                                                                   │
│  Azure handles BOTH:                                              │
│  • Normal PDF with selectable text                                │
│  • Scanned PDF (OCR automatic) — your 4 TFS scan files            │
│                                                                   │
│  Returns text:                                                    │
│  "Article 1 - Definitions...                                      │
│   Article 2 - Mandate of the Council...                           │
│   Article 15 - Freezing Funds..."                                 │
│                                                                   │
│  NestJS saves → PostgreSQL documents.extracted_text               │
│                                                                   │
└──────────────────────────────┬───────────────────────────────────┘
                               ▼
┌──────────────────────────────────────────────────────────────────┐
│  STEP 5B — BANK POLICY FILES (doc-2, doc-3)                      │
├──────────────────────────────────────────────────────────────────┤
│  Same: Blob URL → Document Intelligence → extracted_text          │
└──────────────────────────────────────────────────────────────────┘
```

**One Azure service reads ALL file types:** PDF, Word, Excel, HTML, images.

**Where extracted text is saved:**

```
┌─────────────────────────────────────────────────────────────────┐
│  PostgreSQL → documents.extracted_text  (full text as string)   │
│  Original file still on disk/Blob — not deleted                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## PART 6 — SPLIT INTO POINTS (Before RAG)

```
Extracted text is too long to send to AI at once
                │
                ▼
┌──────────────────────────────────────────────────────────────────┐
│  STEP 6A — SPLIT REQUIREMENT INTO POINTS                          │
├──────────────────────────────────────────────────────────────────┤
│  Parser finds patterns: "Article 1", "Article 2", "Section 3.2" │
│                                                                   │
│  OUTPUT — list of requirement points:                             │
│  ┌────┬────────────────────────────────────────────────────────┐  │
│  │ P1 │ Article 1 - Definitions (State, Council, Ministry...)  │  │
│  │ P2 │ Article 2 - Mandate of the Council...                │  │
│  │ P3 │ Article 3 - Proposing Listing...                     │  │
│  │ .. │ ...                                                    │  │
│  │ P40│ Article 21 - Obligations of FIs...                   │  │
│  └────┴────────────────────────────────────────────────────────┘  │
│                                                                   │
│  = 40 rows in final Excel (one per point)                         │
└──────────────────────────────┬───────────────────────────────────┘
                               ▼
┌──────────────────────────────────────────────────────────────────┐
│  STEP 6B — SPLIT BANK DOCS INTO CHUNKS                            │
├──────────────────────────────────────────────────────────────────┤
│  Split by paragraph / section (~500 words each)                   │
│                                                                   │
│  OUTPUT — chunks from all bank docs:                              │
│  ┌────┬────────────────────────────────────────────────────────┐  │
│  │ C1 │ TFS Manual — Section 1: Definitions...                 │  │
│  │ C2 │ TFS Manual — Section 2: KYC...                         │  │
│  │ C3 │ TFS Manual — Section 9: Freezing procedures...       │  │
│  │ C4 │ Sanctions Policy — Screening operations...             │  │
│  │ .. │ ... (maybe 200 chunks total)                           │  │
│  └────┴────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

**Who does this:** NestJS `RequirementParserService` (TypeScript regex/rules).

---

## PART 7 — VECTORS (Prepare for RAG "Retrieve")

```
Before comparing, bank chunks must be searchable by MEANING
                │
                ▼
┌──────────────────────────────────────────────────────────────────┐
│  STEP 7 — CONVERT EACH CHUNK TO NUMBERS (embeddings)              │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Chunk C3: "Section 9: Freezing procedures within 24h..."        │
│         │                                                         │
│         ▼                                                         │
│  ┌─────────────────────┐                                          │
│  │ Azure OpenAI         │  text-embedding-3-small                 │
│  │ Embeddings API       │  text → vector (numbers)                │
│  └──────────┬──────────┘                                          │
│             ▼                                                     │
│  Vector: [0.52, 0.19, 0.71, ...]                                  │
│             │                                                     │
│             ▼                                                     │
│  ┌─────────────────────┐                                          │
│  │ Azure AI Search      │  index stores chunk + vector            │
│  └─────────────────────┘                                          │
│                                                                   │
│  Do this for ALL bank chunks (C1, C2, C3 ... C200)               │
│  One-time per document upload (reuse on next analysis)            │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

**Services:**

| Service | Role |
|---------|------|
| Azure OpenAI Embeddings | Text → vectors |
| Azure AI Search | Store & search vectors (RAG Retrieve) |

---

## PART 8 — RAG (The Compare Loop) — MOST IMPORTANT

### What RAG means here

```
┌─────────────────────────────────────────────────────────────────┐
│  R = RETRIEVE    Find best bank chunk for this regulation point │
│  A = AUGMENT     Put regulation + bank chunk into LLM prompt    │
│  G = GENERATE    LLM outputs: Compliant / Partial / Non         │
└─────────────────────────────────────────────────────────────────┘
```

### The loop runs ONCE PER REQUIREMENT POINT

```
┌─────────────────────────────────────────────────────────────────┐
│  FOR EACH POINT: P1, P2, P3 ... P40  (40 times for Cabinet 74)   │
└─────────────────────────────────────────────────────────────────┘

Example: Processing P15 = "Article 15 - Freezing Funds without delay"
```

```
POINT P15
    │
    ▼
┌──────────────────────────────────────────────────────────────────┐
│  R — RETRIEVE (vector search)                                     │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  1. Convert P15 text to vector (same embedding model)             │
│                                                                   │
│  2. Search Azure AI Search:                                       │
│     "Which bank chunk is closest in MEANING to P15?"              │
│                                                                   │
│  3. Results:                                                      │
│     C3  Section 9: Freezing...     98% match  ← WINNER           │
│     C7  Notifications...           41% match                      │
│     C1  Definitions...             10% match                      │
│                                                                   │
│  4. Take TOP 1 (or top 3) chunks → this is the EVIDENCE            │
│                                                                   │
└──────────────────────────────┬───────────────────────────────────┘
                               ▼
┌──────────────────────────────────────────────────────────────────┐
│  A — AUGMENT (build prompt)                                       │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Prompt sent to LLM:                                              │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ REGULATION: Article 15 - Freeze funds without delay...     │  │
│  │                                                            │  │
│  │ BANK POLICY: Section 9 - Freezing within 24 hours...       │  │
│  │                                                            │  │
│  │ Classify: COMPLIANT | PARTIAL | NON_COMPLIANT              │  │
│  │ Give confidence 0-1 and short reason.                      │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                   │
└──────────────────────────────┬───────────────────────────────────┘
                               ▼
┌──────────────────────────────────────────────────────────────────┐
│  G — GENERATE (LLM answers)                                       │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Call: Gemini API (Google Generative AI)                          │
│                                                                   │
│  Gemini returns:                                                  │
│  {                                                                │
│    level: "compliant",                                            │
│    confidence: 0.91,                                              │
│    reason: "Section 9 requires freeze within 24h",               │
│    evidence: "TFS Manual — Section 9"                             │
│  }                                                                │
│                                                                   │
└──────────────────────────────┬───────────────────────────────────┘
                               ▼
┌──────────────────────────────────────────────────────────────────┐
│  SAVE ONE ROW in compliance_items table                           │
├──────────────────────────────────────────────────────────────────┤
│  session_id: sess-1                                               │
│  requirement_text: "Article 15 - Freezing Funds..."               │
│  internal_match_text: "Section 9: Freezing within 24h..."         │
│  internal_doc_reference: "TFS Manual — Section 9"                 │
│  compliance_level: compliant                                      │
│  confidence_score: 0.91                                           │
│  target_date: null                                                │
│  action_plan: null                                                │
└──────────────────────────────────────────────────────────────────┘
                               │
                               │  repeat for P16, P17 ... P40
                               ▼
                    All 40 rows saved in PostgreSQL
```

### If NO good match found (Retrieve returns < 50% similarity)

```
┌──────────────────────────────────────────────────────────────────┐
│  RETRIEVE finds nothing good                                    │
│         │                                                         │
│         ▼                                                         │
│  LLM still called with: "Bank policy: NOT FOUND"                  │
│         │                                                         │
│         ▼                                                         │
│  Result: NON_COMPLIANT                                            │
│  Excel column: "No"                                               │
│  Needs: target_date + action_plan + responsible person            │
└──────────────────────────────────────────────────────────────────┘
```

---

## PART 9 — Worker Finishes, Backend Updates Session

```
All 40 points processed
                │
                ▼
┌──────────────────────────────────────────────────────────────────┐
│  STEP 9A — UPDATE SESSION STATUS                                  │
├──────────────────────────────────────────────────────────────────┤
│  analysis_sessions.status = "completed"                           │
│  analysis_sessions.completed_at = now                             │
└──────────────────────────────┬───────────────────────────────────┘
                               ▼
┌──────────────────────────────────────────────────────────────────┐
│  STEP 9B — WEB POLLING GETS RESULT                                │
├──────────────────────────────────────────────────────────────────┤
│  GET /analysis/sess-1                                             │
│  Returns: { session, items: [ 40 compliance_items ] }            │
│  Web grid fills with 40 rows                                      │
└──────────────────────────────────────────────────────────────────┘
```

---

## PART 10 — User Sees Results + Excel

```
┌──────────────────────────────────────────────────────────────────┐
│  WEB GRID (on screen)                                             │
├──────────────────────────────────────────────────────────────────┤
│  Requirement          │ Bank Response      │ Status │ Date │ Owner │
│  Article 1 Def...     │ UAE Impl. TFS      │ Yes    │  -   │  -    │
│  Article 15 Freeze... │ TFS Manual Sec 9   │ Yes    │  -   │  -    │
│  Article 21 FIs...    │ NOT FOUND          │ No     │ edit │ edit  │
└──────────────────────────────────────────────────────────────────┘
                               │
                    User clicks "Download Excel"
                               ▼
┌──────────────────────────────────────────────────────────────────┐
│  NESTJS ReportsService                                            │
│  • Reads compliance_items from PostgreSQL                         │
│  • ExcelJS builds .xlsx matching client sample format             │
│  • Returns file download to browser                               │
└──────────────────────────────────────────────────────────────────┘
```

---

## ALL SERVICES — ONE TABLE (Azure + Gemini)

| When | Service | What it does |
|------|---------|--------------|
| Always | React Web | Upload UI, grid, dashboard |
| Always | NestJS on Azure App Service | API, auth, calls all services |
| Always | Azure PostgreSQL | Users, docs, results |
| Always | Azure Redis + BullMQ | Background jobs (don't block user) |
| Upload | Azure Blob Storage | Store PDF files |
| Extract | Azure Document Intelligence | Read PDF/Word/Excel + OCR |
| Split | NestJS parser code | Article 1, 2, 3... |
| Embeddings | Azure OpenAI Embeddings | Text → vectors |
| RAG Retrieve | Azure AI Search | Find best bank chunk |
| RAG Generate | **Gemini API** | Compliant / Partial / Non |
| Excel | ExcelJS in NestJS | Download report |

---

## WHERE EVERYTHING IS SAVED

```
┌─────────────────────────────────────────────────────────────────┐
│  WHAT                    WHERE                                   │
├─────────────────────────────────────────────────────────────────┤
│  Original PDF file       Azure Blob Storage                      │
│  File info (name, type)  Azure PostgreSQL → documents            │
│  Full extracted text     Azure PostgreSQL → extracted_text         │
│  Bank chunk vectors      Azure AI Search index                   │
│                                                                  │
│  Each compare result     PostgreSQL → compliance_items           │
│                          (one row per Article)                   │
│                                                                  │
│  Analysis job record     PostgreSQL → analysis_sessions          │
│                                                                  │
│  Queue job               Redis (temporary, deleted when done)    │
│                                                                  │
│  Generated Excel         Memory/stream to browser (not stored    │
│                          permanently, or /generated/ temp)      │
└─────────────────────────────────────────────────────────────────┘
```

---

## FULL FLOW — ALL BOXES STACKED (copy this mentally)

```
[USER] upload + click Analyze
    ↓
[WEB] POST /documents/upload × N files
    ↓
[NESTJS] validate → Azure Blob → PostgreSQL documents table
    ↓
[WEB] POST /analysis/compare { requirementDocId, internalDocIds }
    ↓
[NESTJS] create session (requirement_doc_id = doc-1) → BullMQ job
    ↓
[BULLMQ WORKER] Azure Document Intelligence → extracted_text
    ↓
[SPLIT] NestJS → P1..P40 articles | C1..C200 bank chunks
    ↓
[EMBED] Azure OpenAI embeddings → Azure AI Search index
    ↓
[RAG LOOP × 40]
    │  R: AI Search → best bank chunk
    │  A: NestJS builds prompt
    │  G: Gemini API → Yes/Partial/No
    │  → save compliance_items row
    ↓
[NESTJS] session status = completed
    ↓
[WEB] GET /analysis/sess-1 → show grid
    ↓
[USER] download Excel / view dashboard
```

---

## Your Client Files — One Real Run

```
UPLOAD:
  requirement: TFS Cabinet Resolution.pdf  (needs OCR)
  internal:    I M P T F S.pdf + A N C TI O N E.pdf

EXTRACT (Azure Document Intelligence):
  Cabinet scan → 40 Articles of text
  TFS Manual + Sanctions Policy → 200 chunks

RAG × 40:
  Article 1  → AI Search → "UAE Implementation TFS" → Gemini → Yes
  Article 15 → AI Search → "Section 9 Freezing"     → Gemini → Yes
  Article 21 → AI Search → weak match              → Gemini → No

SAVE: 40 rows in compliance_items

EXCEL: 3 columns like client sample
  Col A: Article text
  Col B: "This is covered in UAE Implementation of TFS"
  Col C: Yes / No / Partial
```

---

*End of guide. Pair with [COMPLETE_WORKFLOW_EXPLAINED.md](./COMPLETE_WORKFLOW_EXPLAINED.md) for glossary and remediation flows.*
