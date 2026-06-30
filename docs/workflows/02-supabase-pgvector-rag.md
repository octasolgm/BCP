# 🔍 02 — Supabase + pgvector RAG (Base Layer)

**Stack:** NestJS + Supabase Storage + PostgreSQL/pgvector + OpenAI

This is the **foundation** for BCP. Compliance comparison builds on top (see 04, 05).

---

## Architecture Box Diagram

```
┌─────────────┐     ┌─────────────┐     ┌─────────────────────┐
│  React Web  │────►│  NestJS API │────►│  Supabase Storage   │
│  Upload UI  │     │  + Multer   │     │  (PDF, Word files)  │
└─────────────┘     └──────┬──────┘     └─────────────────────┘
                           │
                           ▼
                    ┌─────────────┐
                    │  Extract    │
                    │  pdf-parse  │
                    │  mammoth    │
                    └──────┬──────┘
                           │
                           ▼
                    ┌─────────────┐
                    │  Chunker    │
                    │  ~500 tokens│
                    └──────┬──────┘
                           │
                           ▼
                    ┌─────────────┐     ┌─────────────────────┐
                    │  OpenAI     │────►│  Supabase Postgres  │
                    │  embed      │     │  pgvector column    │
                    └─────────────┘     └─────────────────────┘
```

---

## Upload Workflow

```
📤 User uploads file
        │
        ▼
NestJS receives (multer) → saves to Supabase Storage
        │
        ▼
Extract text → clean → chunk
        │
        ▼
For each chunk: OpenAI text-embedding-3-small → 1536-dim vector
        │
        ▼
INSERT document_chunks (content, embedding, document_id)
```

---

## Search Workflow (RAG Retrieve)

```
🔍 User query OR requirement point text
        │
        ▼
Embed query with same model
        │
        ▼
SQL: SELECT * FROM document_chunks
     ORDER BY embedding <=> query_vector
     LIMIT 5
        │
        ▼
Top 5 chunks → pass to GPT (Augment + Generate)
```

---

## Packages

| Package | Purpose |
|---------|---------|
| `@supabase/supabase-js` | Storage + DB client |
| `openai` | Embeddings + chat |
| `pdf-parse` | PDF text |
| `mammoth` | Word .docx |
| `multer` | File upload in NestJS |
| `pg` / Prisma | DB access |

---

## Database (RAG tables)

```
documents          — file metadata, doc_type (requirement|internal)
document_chunks    — chunk_index, content, embedding vector(1536)
```

Full schema: [11-database-schema.md](./11-database-schema.md)

---

## pgvector Setup (Supabase)

```
1. Enable vector extension in Supabase SQL editor
2. CREATE TABLE document_chunks (embedding vector(1536))
3. CREATE INDEX ON document_chunks USING ivfflat (embedding vector_cosine_ops)
4. match_documents(query_embedding, match_count) RPC function
```

---

## When to Use This Approach

```
✅ MVP — fast, cheap (~$25–50/month Supabase + OpenAI)
✅ Small team knows TypeScript + NestJS
✅ Pilot with 1–2 regulations, < 20 internal docs

❌ Strict UAE banking data residency → use Azure path
❌ 1000+ docs at scale → Azure AI Search
```

---

## How BCP Extends This

```
Standard RAG:     upload → embed → search → answer question

BCP adds:
  → requirements table (split regulation points)
  → comparison loop per point (05-comparison-engine.md)
  → compliance_items + Excel + dashboard
```

---

## Summary

Supabase + pgvector gives you **cheap vector storage and search**. BCP uses it to find relevant bank policy chunks for each regulation article, then GPT classifies compliance.
