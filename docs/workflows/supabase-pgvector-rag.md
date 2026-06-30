# 🟢 Supabase + pgvector + NestJS + OpenAI RAG Workflow

**Best for:** MVP, startups, small teams, fast setup, low cost  
**Backend:** NestJS (TypeScript)  
**Stack:** Supabase Storage + Supabase Postgres (pgvector) + OpenAI

---

## What This Approach Does

Store documents in Supabase, save vectors in PostgreSQL with pgvector extension, use OpenAI for embeddings and chat. NestJS orchestrates everything.

```
Simple, affordable, all-in-one database + storage from Supabase.
Good for demos and pilots before moving to Azure enterprise.
```

---

## Tools & Packages

| Tool | Role |
|------|------|
| **Supabase Storage** | Store uploaded PDF/Word files |
| **Supabase Postgres + pgvector** | Store chunks + vector embeddings |
| **OpenAI API** | Embeddings (`text-embedding-3-small`) + Chat (`gpt-4o`) |
| **NestJS** | API, auth, upload, RAG orchestration |
| **pdf-parse** | Extract text from normal PDFs |
| **mammoth** | Extract text from Word .docx |
| **multer** | Handle file uploads in NestJS |
| **@supabase/supabase-js** | Talk to Supabase from NestJS |
| **openai** | OpenAI SDK for embed + chat |

---

## Supabase Table Structure

```
┌─────────────────────────────────────────────────────────────────┐
│  documents                                                       │
├─────────────────────────────────────────────────────────────────┤
│  id, user_id, filename, storage_path, type, extracted_text,     │
│  status, created_at                                              │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  document_chunks                                                 │
├─────────────────────────────────────────────────────────────────┤
│  id, document_id, chunk_index, content, embedding (vector 1536) │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  analysis_sessions / compliance_items (BCP-specific)            │
└─────────────────────────────────────────────────────────────────┘

Enable in Supabase SQL:
  CREATE EXTENSION IF NOT EXISTS vector;
```

---

## NestJS Folder Structure

```
apps/backend/src/
├── auth/
├── documents/
│   ├── documents.controller.ts    ← POST upload
│   ├── documents.service.ts       ← save to Supabase Storage
│   └── documents.module.ts
├── ingestion/
│   ├── ingestion.service.ts       ← pdf-parse, chunk, embed
│   └── ingestion.processor.ts     ← BullMQ background job
├── search/
│   ├── search.service.ts          ← pgvector similarity query
│   └── rag.service.ts             ← build prompt + OpenAI chat
├── supabase/
│   └── supabase.client.ts         ← supabase-js client
└── main.ts
```

---

## 📤 Upload Workflow

```
┌──────────────┐
│  USER        │  Uploads PDF via React web app
└──────┬───────┘
       │
       ▼
┌──────────────┐
│  NestJS API  │  POST /documents/upload (multer)
└──────┬───────┘
       │
       ▼
┌──────────────────────┐
│  Supabase Storage    │  Save file: uploads/{uuid}.pdf
└──────┬───────────────┘
       │
       ▼
┌──────────────────────┐
│  Supabase Postgres   │  Insert row in documents table
└──────┬───────────────┘
       │
       ▼
┌──────────────────────┐
│  BullMQ Job          │  "ingest document {id}"
└──────┬───────────────┘
       │
       ▼
┌──────────────────────┐
│  pdf-parse           │  PDF bytes → plain text
└──────┬───────────────┘
       │
       ▼
┌──────────────────────┐
│  Chunker             │  Split into ~500 word pieces
└──────┬───────────────┘
       │
       ▼
┌──────────────────────┐
│  OpenAI Embeddings   │  Each chunk → vector [1536 nums]
└──────┬───────────────┘
       │
       ▼
┌──────────────────────┐
│  pgvector INSERT     │  document_chunks table
└──────┬───────────────┘
       │
       ▼
┌──────────────┐
│  DONE        │  status = "ready"
└──────────────┘
```

---

## 🔍 Search / Question Workflow

```
┌──────────────┐
│  USER        │  "Does Article 15 match our freezing policy?"
└──────┬───────┘
       │
       ▼
┌──────────────┐
│  NestJS API  │  POST /analysis/compare
└──────┬───────┘
       │
       ▼
┌──────────────────────┐
│  OpenAI Embeddings   │  Question → vector
└──────┬───────────────┘
       │
       ▼
┌──────────────────────┐
│  pgvector SEARCH     │  SELECT ... ORDER BY embedding <=> query
│                      │  LIMIT 5 (top similar chunks)
└──────┬───────────────┘
       │
       ▼
┌──────────────────────┐
│  RAG Prompt Build    │  Question + top chunks + instructions
└──────┬───────────────┘
       │
       ▼
┌──────────────────────┐
│  OpenAI Chat GPT     │  Compliant / Partial / Non-Compliant
└──────┬───────────────┘
       │
       ▼
┌──────────────┐
│  SAVE + SHOW │  compliance_items → grid → Excel
└──────────────┘
```

---

## When to Use This Approach

```
✅ USE WHEN:
  • Building MVP or demo in weeks not months
  • Team knows TypeScript / NestJS
  • Budget is limited ($25–100/month Supabase Pro + OpenAI usage)
  • Document volume is small–medium (< 10k chunks)
  • Bank allows OpenAI for document text (check compliance!)

❌ AVOID WHEN:
  • Strict data residency (UAE-only, no US cloud)
  • Need enterprise SLA and Azure compliance certs
  • Very large scale (millions of chunks) — use Azure AI Search
  • Scanned PDFs are poor quality — may need Azure Document Intelligence
```

---

## Summary

```
┌─────────────────────────────────────────────────────────────┐
│  Supabase + pgvector + NestJS + OpenAI                      │
├─────────────────────────────────────────────────────────────┤
│  Storage:  Supabase Storage                                   │
│  Vectors:  Supabase Postgres pgvector                         │
│  AI:       OpenAI embeddings + GPT                            │
│  Backend:  NestJS                                             │
│  PDF:      pdf-parse (+ tesseract for scans)                  │
│  Best for: Fast MVP, startups, low cost                       │
└─────────────────────────────────────────────────────────────┘
```
