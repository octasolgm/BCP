# 📖 BCP — Complete Workflow Explained (Azure Services Edition)

**Version:** 2.1 — Azure + Gemini  
**Date:** 2026-06-22  

> **Stack:** NestJS → **Azure** (Blob, Document Intelligence, AI Search, Embeddings) → **Gemini API** (compare). No Python.  
> **Confused about requirement_doc_id, BullMQ, or file reading?** → [POST_UPLOAD_FLOW_BOXES.md](./POST_UPLOAD_FLOW_BOXES.md) top section.

---

## 0. Azure Services Used — Quick Reference

```
┌─────────────────────────────────────────────────────────────────────────┐
│  AZURE SERVICE                    │  WHAT IT DOES IN BCP                │
├───────────────────────────────────┼─────────────────────────────────────┤
│  Azure Static Web Apps            │  Host React web dashboard           │
│  Azure App Service                │  Run NestJS backend API             │
│  Azure Blob Storage               │  Store uploaded PDF/Word files      │
│  Azure Database for PostgreSQL    │  Users, documents, compliance rows  │
│  Azure Cache for Redis            │  Background job queue (BullMQ)      │
│  Azure Document Intelligence      │  Read PDF + OCR scanned docs        │
│  Azure OpenAI — Embeddings        │  Convert text → vectors             │
│  Azure AI Search                  │  Vector search (RAG Retrieve step)│
│  Gemini API                       │  Compare & classify (RAG Generate)  │
│  Azure Functions (optional)       │  Run long analysis jobs             │
│  Azure Communication Services     │  Send email alerts                  │
│  Firebase FCM (or Azure NH)       │  Mobile push notifications          │
└───────────────────────────────────┴─────────────────────────────────────┘

Backend code: NestJS (TypeScript) — orchestrates all Azure APIs.
No separate Python server.
```

> **Region:** Use **UAE North** (or bank-approved EU region) for data residency.  
> **Bank approval required** before sending policy text to Gemini API.

---

## 1. The Big Picture (30-Second Summary)

```
USER uploads 2 types of files:
  ① REGULATION file  (what the law says)
  ② BANK POLICY file (what the bank does)

AZURE + NESTJS:
  Blob stores files → Document Intelligence reads text
  → AI Search finds matches → Gemini judges compliance
  → PostgreSQL saves results → Excel + dashboard

THAT'S IT.
```

---

## 2. The Two File Types

```
┌─────────────────────────────────────────────────────────────────┐
│  TYPE 1: REQUIREMENT / REGULATION FILE                          │
├─────────────────────────────────────────────────────────────────┤
│  Examples from client bundle:                                   │
│  • TFS Cabinet Resolution.pdf  (Cabinet Decision 74)            │
│  • CBUAE AML Guidelines.pdf                                     │
│  • TFS Guidelines.pdf                                           │
│                                                                  │
│  Formats allowed: PDF, HTML, JPEG, PNG, DOCX, TXT               │
│  Contains: Articles, sections, rules the bank MUST follow       │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  TYPE 2: INTERNAL BANK POLICY FILE                              │
├─────────────────────────────────────────────────────────────────┤
│  Examples from client bundle:                                   │
│  • I M P T F S.pdf.pdf         (TFS Implementation Manual)      │
│  • A N C TI O N E.pdf.pdf      (Sanctions Compliance Policy)    │
│                                                                  │
│  Formats allowed: PDF, DOCX, XLSX, TXT, email text              │
│  Contains: Bank's own procedures, policies, controls            │
└─────────────────────────────────────────────────────────────────┘
```

**Goal:** For every rule in Type 1, find if Type 2 covers it → mark Compliant / Partial / Non-Compliant.

---

## 3. Complete End-to-End Workflow (Azure)

```
┌──────────┐
│  STEP 1 │  USER (Compliance Officer)
│  UPLOAD │  Opens React app → uploads regulation PDF + bank policy PDFs
└────┬─────┘
     │
     ▼
┌──────────┐
│  STEP 2 │  REACT WEB (Azure Static Web Apps)
│  SEND    │  Sends files to NestJS API via @bcp/api-client
└────┬─────┘
     │
     ▼
┌──────────┐
│  STEP 3 │  NESTJS BACKEND (Azure App Service)
│  RECEIVE │  • Validates file type & size (max 50 MB)
│          │  • Checks JWT login & role (RBAC)
│          │  • Saves file to Azure Blob Storage
│          │  • Creates record in Azure PostgreSQL
│          │  • Adds job to Azure Redis queue (BullMQ)
│          │  • Returns immediately: "Processing..."
└────┬─────┘
     │
     ▼
┌──────────┐
│  STEP 4 │  AZURE DOCUMENT INTELLIGENCE
│  EXTRACT │  Reads text + OCR from all uploaded files
│          │  See Section 4 below
└────┬─────┘
     │
     ▼
┌──────────┐
│  STEP 5 │  NESTJS WORKER + AZURE AI SERVICES — RAG pipeline
│  COMPARE │  Split → Embed → AI Search → Gemini classify
│          │  See Sections 5, 6, 7 below
└────┬─────┘
     │
     ▼
┌──────────┐
│  STEP 6 │  NESTJS BACKEND
│  SAVE    │  • Stores each compliance item in Azure PostgreSQL
│          │  • Writes audit log entry
│          │  • Notifies frontend: "Done!"
└────┬─────┘
     │
     ▼
┌──────────┐
│  STEP 7 │  USER sees results
│  OUTPUT  │  • Grid table (like Excel on screen)
│          │  • MIS dashboard (charts, %)
│          │  • Download Excel report (ExcelJS in NestJS)
└──────────┘
```

**Typical time:** 2–5 minutes per analysis session (user sees "Processing..." — job runs in background via Redis).

---

## 4. File Extraction — Azure Document Intelligence

### What is Azure Document Intelligence?

```
┌─────────────────────────────────────────────────────────────────┐
│  AZURE DOCUMENT INTELLIGENCE (formerly Form Recognizer)         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  A Microsoft cloud API that:                                    │
│  • Reads text from PDF, Word, Excel, HTML, images               │
│  • Runs OCR on scanned documents automatically                  │
│  • Returns structured text (pages, paragraphs, tables)          │
│                                                                  │
│  Replaces: pdfplumber, Tesseract, python-docx, openpyxl         │
│  Called by: NestJS backend using @azure/ai-form-recognizer SDK  │
│                                                                  │
│  Perfect for client's 4 SCANNED TFS PDFs (Cabinet Resolution,   │
│  TFS Guidelines, EOCN, Typologies) — no separate OCR setup.     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 4.1 Where Files Are Saved

```
┌─────────────────────────────────────────────────────────────────┐
│  AZURE BLOB STORAGE — original uploaded files                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Container: bcp-uploads                                         │
│    └── 2026/06/                                                 │
│          ├── abc123-requirement.pdf    ← Cabinet Decision 74    │
│          ├── def456-tfs-manual.pdf     ← TFS Manual             │
│          └── ghi789-sanctions-policy.pdf                        │
│                                                                  │
│  Rules:                                                          │
│  • UUID blob name (never user's original filename on storage)   │
│  • Private container (no public URL)                            │
│  • Access only via NestJS with connection string / managed ID │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  AZURE POSTGRESQL — metadata + results (NOT the file bytes)     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  documents table:                                                │
│  ┌────────┬──────────────────┬────────────┬──────────────────┐   │
│  │ id     │ filename         │ type       │ blob_url         │   │
│  ├────────┼──────────────────┼────────────┼──────────────────┤   │
│  │ uuid-1 │ Cabinet74.pdf    │ requirement│ bcp-uploads/abc  │   │
│  │ uuid-2 │ TFS-Manual.pdf   │ internal   │ bcp-uploads/def  │   │
│  └────────┴──────────────────┴────────────┴──────────────────┘   │
│                                                                  │
│  Also stores: extracted_text (full text after Document Intel.)  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Why separate?** Blob Storage is built for large files. PostgreSQL holds searchable metadata and results.

---

### 4.2 Extraction by File Type (All via One Azure Service)

```
┌─────────────────────────────────────────────────────────────────┐
│  FILE TYPE              AZURE SERVICE           WHAT HAPPENS     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  PDF (text-based)       Document Intelligence   Reads text pages │
│                                                                  │
│  PDF (scanned image)    Document Intelligence   OCR built-in     │
│                         (prebuilt-read model)   (4 client TFS!)  │
│                                                                  │
│  Word .docx             Document Intelligence   Reads paragraphs │
│                                                                  │
│  Excel .xlsx            Document Intelligence   Reads cells      │
│                                                                  │
│  HTML                   Document Intelligence   Reads page text   │
│                                                                  │
│  JPEG / PNG             Document Intelligence   Image → text   │
│                                                                  │
│  Plain text / email     NestJS direct read      Already text     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 4.3 Extraction Flow (Box)

```
  bank_policy.pdf  (stored in Blob Storage)
        │
        ▼
  ┌─────────────────────────────────────┐
  │  NestJS AnalysisService             │
  │  sends blob URL to Azure            │
  └──────────────────┬──────────────────┘
                     │
                     ▼
  ┌─────────────────────────────────────┐
  │  Azure Document Intelligence        │
  │  API: beginAnalyzeDocument()        │
  │  Model: prebuilt-read               │
  │  (handles text PDF AND scans)       │
  └──────────────────┬──────────────────┘
                     │
                     ▼
  Returns JSON:
  "Article 1 - Definitions...
   Article 2 - Mandate of the Council...
   Section 3.2 - Customer Screening..."
                     │
                     ▼
  NestJS saves → PostgreSQL documents.extracted_text
```

**NestJS does NOT read PDF bytes itself** — it passes the Blob URL to Azure and gets text back.

---

## 5. Processing — Splitting Into Points (NestJS)

After Azure returns text, raw content is **too long** for GPT at once. NestJS splits it into **points**.

```
RAW TEXT from Document Intelligence (50 pages):
"Article 1 - Definitions... Article 2 - Mandate..."

        │
        ▼  REQUIREMENT PARSER (NestJS service — TypeScript code)

SPLIT INTO POINTS:
┌────┬────────────────────────────────────────────────────────┐
│ #  │ Requirement Point                                      │
├────┼────────────────────────────────────────────────────────┤
│ 1  │ Article 1 - Definitions (State, Council, Ministry...)  │
│ 2  │ Article 2 - Mandate of the Council...                  │
│ 3  │ Article 3 - Proposing Listing on Local Lists           │
│ 4  │ Article 15 - Freezing Funds...                         │
│ ...│ ... (one row per article in Excel output)              │
└────┴────────────────────────────────────────────────────────┘

BANK POLICY — split into CHUNKS (paragraphs/sections):
┌────┬────────────────────────────────────────────────────────┐
│ C1 │ Section 1: Customer Definitions...                     │
│ C2 │ Section 2: KYC Procedures...                           │
│ C3 │ Section 9: Freezing procedures without delay...        │
│ C4 │ Section 12: Sanctions screening operations...          │
└────┴────────────────────────────────────────────────────────┘
```

**Parser looks for patterns like:** `Article 1`, `Section 3.2`, numbered CBUAE clauses.

**Who runs this:** NestJS `RequirementParserService` (regex + rules). No Python needed.

---

## 6. What Is RAG? (Simple Explanation)

### 6.1 The Problem RAG Solves

```
WITHOUT RAG:
  Send entire 50-page bank manual + 20-page regulation to Azure OpenAI
  → Too long, expensive, inaccurate

WITH RAG:
  For EACH regulation point, Azure AI Search finds ONLY relevant bank text
  → Send small focused prompt to GPT
  → Faster, cheaper, more accurate, shows evidence
```

**RAG = Retrieval-Augmented Generation**

```
┌─────────────────────────────────────────────────────────────────┐
│  RAG = 3 steps (all Azure in BCP)                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  R = RETRIEVE     Azure AI Search finds best bank policy chunk  │
│                   (vector similarity search)                     │
│                                                                  │
│  A = AUGMENT      NestJS builds GPT prompt with both texts      │
│                                                                  │
│  G = GENERATE     Gemini API returns Compliant/Partial/Non         │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 6.2 RAG vs Just Asking ChatGPT

```
┌──────────────────────┬──────────────────────────────────────────┐
│  Just ChatGPT        │  RAG (what BCP uses)                     │
├──────────────────────┼──────────────────────────────────────────┤
│  No access to your   │  Reads YOUR bank documents via           │
│  bank files          │  Azure Document Intelligence             │
│                      │                                          │
│  Might guess         │  Shows evidence: "Section 9 of TFS       │
│                      │  Manual covers this"                     │
│                      │                                          │
│  Can't search 200    │  Azure AI Search finds best match        │
│  pages accurately    │  from 200 chunks in milliseconds         │
└──────────────────────┴──────────────────────────────────────────┘
```

---

## 7. Vectors — Azure OpenAI Embeddings + Azure AI Search

Vectors are **numbers that represent meaning**. Used in the **Retrieve (R)** step of RAG.

### 7.1 What is Azure AI Search?

```
┌─────────────────────────────────────────────────────────────────┐
│  AZURE AI SEARCH (formerly Cognitive Search)                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  A search engine that stores:                                   │
│  • Bank policy text chunks                                      │
│  • Their vector embeddings (numbers)                            │
│                                                                  │
│  When you ask "find text similar to Article 15":                │
│  → returns the closest bank policy sections by MEANING          │
│                                                                  │
│  Replaces: pgvector in PostgreSQL                               │
│  Called by: NestJS using @azure/search-documents SDK            │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 7.2 Why Not Keyword Search?

```
REGULATION says:  "Banks must verify customer identity"

KEYWORD SEARCH:
  Search: "verify", "customer", "identity"
  Bank doc says: "We perform KYC procedures"
  Result: NO MATCH ❌  → Wrong: Non-Compliant

VECTOR SEARCH (Azure AI Search):
  Regulation → embedding: [0.2, 0.8, 0.5, ...]
  Bank chunk → embedding:  [0.21, 0.79, 0.51, ...]
  Similarity: 94% ✅
  Result: Found "Section 2: KYC Procedures"
```

### 7.3 Vector Pipeline (Azure Boxes)

```
STEP A — When bank doc is uploaded (one time per doc):

  Bank chunk: "Section 9: Freezing procedures..."
            │
            ▼
  ┌─────────────────────────────┐
  │  Azure OpenAI Embeddings API  │
  │  Model: text-embedding-3-small│
  │  text → vector (1536 numbers)│
  └──────────────┬──────────────┘
                 │
                 ▼
  [0.5, 0.2, 0.7, 0.1, ...]
                 │
                 ▼
  ┌─────────────────────────────┐
  │  Azure AI Search Index      │
  │  stores: chunk text + vector│
  │  + document_id + section    │
  └─────────────────────────────┘


STEP B — When comparing (per regulation point):

  Regulation point: "Article 15: Freeze funds without delay"
            │
            ▼
  ┌─────────────────────────────┐
  │  Azure OpenAI Embeddings    │  convert P15 → vector
  └──────────────┬──────────────┘
                 │
                 ▼
  ┌─────────────────────────────┐
  │  Azure AI Search              │
  │  vector query: top 3 matches  │
  └──────────────┬──────────────┘
                 │
                 ▼
  Top matches:
    C3 — Section 9: Freezing...     98% ← best
    C7 — Section 14: Notifications 41%
    C1 — Section 1: Definitions    12%
                 │
                 ▼
  Send TOP match (C3) to Gemini API
```

---

## 8. Comparison — Gemini API Decides Compliance

### What is Gemini API?

```
┌─────────────────────────────────────────────────────────────────┐
│  GEMINI API (Google Generative AI)                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Google's AI model (like ChatGPT) via API key                   │
│  • Used ONLY for compare step (RAG Generate)                    │
│  • Does NOT read PDFs — only compares text NestJS sends         │
│  • Called by: NestJS using @google/generative-ai SDK            │
│                                                                  │
│  Azure reads files. Gemini judges compliance.                   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 8.1 The Gemini Prompt (Conceptual)

```
┌─────────────────────────────────────────────────────────────────┐
│  SENT TO GEMINI API (by NestJS):                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  System: You are a UAE banking compliance expert.               │
│                                                                  │
│  REGULATORY REQUIREMENT:                                        │
│  "Article 15: Any person shall freeze Funds as per the          │
│   Sanctions List without delay..."                              │
│                                                                  │
│  BANK POLICY EXCERPT (from Azure AI Search):                    │
│  "Section 9: Freezing Procedures — freeze within 24 hours..."    │
│                                                                  │
│  Classify: COMPLIANT | PARTIAL_COMPLIANT | NON_COMPLIANT        │
│  Return JSON: level, confidence (0-1), reasoning, evidence.     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 8.2 Gemini Response → Saved in PostgreSQL

```
┌─────────────────────────────────────────────────────────────────┐
│  GEMINI RETURNS:                                                │
├─────────────────────────────────────────────────────────────────┤
│  level:       "compliant"                                       │
│  confidence:  0.91                                              │
│  reasoning:   "Section 9 requires freeze within 24h"           │
│  evidence:    "TFS Manual — Section 9"                          │
└─────────────────────────────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────────────┐
│  AZURE POSTGRESQL → compliance_items:                           │
├─────────────────────────────────────────────────────────────────┤
│  requirement_text:     "Article 15: Freeze funds..."            │
│  internal_match_text:  "Section 9: Freezing procedures..."      │
│  internal_doc_reference: "TFS Manual — Section 9"               │
│  compliance_level:     compliant                                │
│  confidence_score:     0.91                                     │
│  target_date / action_plan: null (only for partial/non)         │
└─────────────────────────────────────────────────────────────────┘
```

### 8.3 All Three Outcomes

```
┌─────────────────┬──────────────────────────────────────────────┐
│  COMPLIANT ✅   │ Bank policy fully covers the requirement     │
│                 │ Excel: "Yes" | No action needed              │
├─────────────────┼──────────────────────────────────────────────┤
│  PARTIAL ⚠️     │ Bank covers some but not all aspects         │
│                 │ Excel: "Partial" | Needs action plan + date  │
├─────────────────┼──────────────────────────────────────────────┤
│  NON-COMPLIANT ❌│ No match in AI Search OR Gemini says missing  │
│                 │ Excel: "No" | Needs action plan + date       │
└─────────────────┴──────────────────────────────────────────────┘

If confidence < 0.7 → flag for HUMAN REVIEW
```

---

## 9. Full RAG Workflow — One Article (Azure Micro View)

```
Article 15: "Freeze funds without delay"
│
├─── R — RETRIEVE
│         │
│         ▼
     Azure OpenAI Embeddings → Azure AI Search → "Section 9: Freezing" (98% match)
│
├─── A — AUGMENT
│         │
│         ▼
│    NestJS builds prompt = Article 15 + Section 9 + rules
│
└─── G — GENERATE
          │
          ▼
     Gemini API → COMPLIANT, 91% confidence
          │
          ▼
     Save to Azure PostgreSQL → grid row → Excel row
```

**This loop runs for EVERY article** (e.g. 40 times for Cabinet Decision 74).  
**Orchestrated by:** NestJS BullMQ worker calling Azure APIs in sequence.

---

## 10. Background Jobs — Azure Redis + BullMQ

```
┌─────────────────────────────────────────────────────────────────┐
│  WHY A QUEUE?                                                   │
├─────────────────────────────────────────────────────────────────┤
│  Full analysis = 40 articles × (embed + search + GPT)           │
│  Takes 2–5 minutes — user cannot wait on HTTP request           │
│                                                                  │
│  Flow:                                                          │
│  1. NestJS receives POST /analysis/compare                        │
│  2. Creates session in PostgreSQL                               │
│  3. Pushes job to Azure Cache for Redis (BullMQ)                │
│  4. Returns { status: "processing" } immediately                │
│  5. BullMQ worker runs extract → RAG loop                       │
│  6. Web polls GET /analysis/:id until complete                │
└─────────────────────────────────────────────────────────────────┘
```

---

## 11. Excel Output — NestJS + ExcelJS

```
┌─────────────────────────────────────────────────────────────────┐
│  MATCHES CLIENT SAMPLE FORMAT:                                  │
├─────────────────────────────────────────────────────────────────┤
│  Col A: Regulatory Requirement     (requirement point text)    │
│  Col B: UAE Response / Reference   (bank doc + section)         │
│  Col C: Comply Yes/No              (Yes / Partial / No)         │
│  Col D–F: Target Date, Action Plan, Responsibility (if gaps)  │
│                                                                  │
│  Built by: ExcelJS in NestJS ReportsService                     │
│  Data from: Azure PostgreSQL compliance_items                     │
│  Triggered: User clicks "Download Excel" on React app           │
└─────────────────────────────────────────────────────────────────┘
```

---

## 12. Dashboard (MIS)

```
compliance_items from Azure PostgreSQL
        │
        ▼
NestJS DashboardService calculates:
  • Total: 40 | Compliant: 32 (80%) | Partial: 5 | Non: 3
        │
        ▼
React Web (Recharts):
  • Pie chart green/yellow/red
  • KPI cards, bar chart by regulation
```

---

## 13. Remediation Loop

```
Non-Compliant item found
        │
        ▼
Manager sets target date + assigns owner (NestJS → PostgreSQL)
        │
        ▼
Officer uploads remediation doc → Azure Blob Storage
        │
        ▼
NestJS re-runs RAG for THIS item only:
  Document Intelligence → AI Search → Gemini API
        │
        ▼
Status updates to COMPLIANT if fixed
```

---

## 14. Alerts — Azure Communication Services

```
NestJS CRON job (daily):
  Check compliance_items.target_date in PostgreSQL
        │
        ▼
  3 days away  → "Deadline Approaching"
  Passed       → "Deadline Missed"
        │
        ▼
  Azure Communication Services → email
  Firebase FCM                 → mobile push
```

---

## 15. Who Does What — Complete Azure Service Map

```
┌──────────────────────────┬──────────────────────────────────────────┐
│  COMPONENT               │  JOB                                     │
├──────────────────────────┼──────────────────────────────────────────┤
│  React Web               │  UI — upload, grid, dashboard, Excel btn │
│  Azure Static Web Apps   │  Host React frontend                     │
│  NestJS Backend          │  API, auth, orchestrate ALL Azure calls  │
│  Azure App Service       │  Host NestJS                             │
│  Azure Blob Storage      │  Store original PDF/Word files           │
│  Azure PostgreSQL        │  Users, docs, compliance items, audit    │
│  Azure Cache for Redis   │  BullMQ background job queue             │
│  Azure Document          │  Extract text + OCR all file types       │
│  Intelligence            │                                          │
│  Azure OpenAI Embeddings │  Text → vectors for search               │
│  Azure AI Search         │  Store chunks + vector search (RAG-R)    │
│  Gemini API              │  Compare & classify (RAG-G)              │
│  ExcelJS (NestJS)        │  Generate Excel download                 │
│  Azure Communication     │  Email deadline alerts                   │
│  Services                │                                          │
│  Firebase FCM            │  Mobile push notifications               │
└──────────────────────────┴──────────────────────────────────────────┘

NO Python server. NestJS calls Azure REST APIs via official SDKs.
```

---

## 16. Data Storage Summary (Azure)

```
┌─────────────────────────────────────────────────────────────────┐
│  WHAT                    WHERE                    WHY           │
├─────────────────────────────────────────────────────────────────┤
│  Original PDF files      Azure Blob Storage       Large files   │
│  File metadata           Azure PostgreSQL         Who uploaded  │
│  Extracted full text     Azure PostgreSQL         Re-use later  │
│  Text chunks + vectors   Azure AI Search index    Fast RAG      │
│  Compliance results      Azure PostgreSQL         Report data   │
│  Users & roles           Azure PostgreSQL         Auth/RBAC     │
│  Audit trail             Azure PostgreSQL         Banking req   │
│  Job queue               Azure Redis              Async work    │
│  Excel download          Stream to browser        Not stored    │
└─────────────────────────────────────────────────────────────────┘
```

---

## 17. Client Files — Azure Processing Path

```
REGULATION SIDE                    BANK SIDE
─────────────────                  ─────────
TFS Cabinet Resolution.pdf    →    I M P T F S.pdf.pdf
  → Blob Storage                     → Blob Storage
  → Document Intelligence (OCR)        → Document Intelligence
                                     +
CBUAE AML Guidelines.pdf      →    A N C TI O N E.pdf.pdf
  → Document Intelligence            → Document Intelligence

TFS Guidelines.pdf (scanned)  →    (same bank docs)
  → Document Intelligence OCR

        │                                │
        └────────────┬───────────────────┘
                     ▼
           NestJS splits into points/chunks
                     ▼
           Azure OpenAI Embeddings → AI Search index
                     ▼
           RAG loop × 40 → Gemini API
                     ▼
           Azure PostgreSQL → Excel (client sample format)
```

---

## 18. Step 1 vs Step 2

```
STEP 1 (build first):
  • 1 regulation + 1+ bank docs
  • Full point-by-point RAG analysis
  • Excel + dashboard per session

STEP 2 (build later):
  • Bulk upload 50+ regulations to Blob Storage
  • Azure Redis queue processes all
  • Organization-wide MIS dashboard
```

---

## 19. Glossary (Azure Edition)

| Term | Simple meaning |
|------|----------------|
| **NestJS** | TypeScript backend — orchestrates all services |
| **Azure Blob Storage** | Cloud file storage for uploaded PDFs |
| **Document Intelligence** | Azure API that reads PDF/Word/Excel + OCR |
| **Azure OpenAI Embeddings** | Converts text to vectors (numbers) |
| **Azure AI Search** | Vector database — finds similar bank policy text |
| **Gemini API** | AI that compares regulation vs bank policy |
| **RAG** | AI Search find (R) + prompt (A) + Gemini answer (G) |
| **BullMQ + Redis** | Background job queue — don't block user |
| **Blob** | One stored file in Azure Storage |
| **Index** | Search collection in Azure AI Search |
| **Confidence score** | How sure GPT is (below 0.7 = human review) |
| **Compliance item** | One Excel row = one regulation point result |
| **Session** | One analysis run = one regulation vs bank docs |

---

## 20. One-Page Cheat Sheet (Azure)

```
┌─────────────────────────────────────────────────────────────────┐
│              BCP AZURE WORKFLOW CHEAT SHEET                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  UPLOAD regulation + bank docs (React → NestJS)                  │
│       ↓                                                          │
│  SAVE files → Azure Blob Storage                                 │
│  SAVE metadata → Azure PostgreSQL                                │
│       ↓                                                          │
│  EXTRACT text → Azure Document Intelligence (incl. OCR)          │
│       ↓                                                          │
│  SPLIT → Articles (P1..P40) + bank chunks (C1..C200) [NestJS]   │
│       ↓                                                          │
│  EMBED chunks → Azure OpenAI Embeddings → Azure AI Search       │
│       ↓                                                          │
│  FOR EACH regulation point:                                      │
│    R: Azure AI Search → best bank chunk                           │
│    A: NestJS builds GPT prompt                                   │
│    G: Gemini API → Compliant/Partial/Non                       │
│       ↓                                                          │
│  SAVE rows → Azure PostgreSQL                                    │
│       ↓                                                          │
│  SHOW grid + dashboard + ExcelJS download                        │
│                                                                  │
│  FIX gaps → re-upload → re-run RAG → Azure Communication email  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 21. NestJS Modules That Call Azure

```
┌─────────────────────┬────────────────────────────────────────────┐
│  NestJS Module      │  Azure Service Called                      │
├─────────────────────┼────────────────────────────────────────────┤
│  DocumentsModule    │  Blob Storage (upload/download)          │
│  DocumentsModule    │  Document Intelligence (extract on upload) │
│  AnalysisModule     │  OpenAI Embeddings + AI Search (index)   │
│  AnalysisProcessor  │  AI Search + Gemini API (RAG loop)         │
│  ReportsModule      │  PostgreSQL read → ExcelJS                 │
│  AlertsModule       │  PostgreSQL read → Communication Services  │
│  AuthModule         │  PostgreSQL only                           │
└─────────────────────┴────────────────────────────────────────────┘
```

---

*End of guide. For post-upload step-by-step boxes see [POST_UPLOAD_FLOW_BOXES.md](./POST_UPLOAD_FLOW_BOXES.md). For Azure costs see [CLARIFICATIONS_AND_REAL_COSTS.md](../tools-and-costs/CLARIFICATIONS_AND_REAL_COSTS.md).*
