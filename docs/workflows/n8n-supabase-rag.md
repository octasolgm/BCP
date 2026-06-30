# 🔄 n8n + Supabase RAG Workflow

**Best for:** No-code automation, fast MVP, non-developers building pipelines  
**Stack:** n8n + Supabase Storage + pgvector + OpenAI  
**Backend:** n8n workflows (not NestJS)

---

## Important Limitation

```
┌─────────────────────────────────────────────────────────────────┐
│  ⚠️  n8n CANNOT run inside Supabase                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  n8n is a SEPARATE app (self-hosted or n8n.cloud)               │
│  It CONNECTS to Supabase via API keys and webhooks              │
│                                                                  │
│  Supabase = database + storage                                  │
│  n8n      = automation brain that calls Supabase + OpenAI       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## How n8n Connects to Supabase

```
┌──────────────┐         HTTPS API          ┌──────────────┐
│  n8n         │ ◄────────────────────────► │  Supabase    │
│  (workflows) │   supabase-js / REST       │  Storage +   │
│              │                            │  Postgres    │
└──────┬───────┘                            └──────────────┘
       │
       │  HTTPS API
       ▼
┌──────────────┐
│  OpenAI API  │  Embeddings + Chat
└──────────────┘
```

**Connection setup:**
- Supabase URL + service role key in n8n credentials
- OpenAI API key in n8n credentials
- Webhook trigger when file uploaded OR manual run

---

## n8n Node Flow — Upload Automation

```
┌─────────────────┐
│  Webhook /      │  Trigger: file uploaded to Supabase Storage
│  Manual Trigger │
└────────┬────────┘
         ▼
┌─────────────────┐
│  Supabase       │  Download file from Storage bucket
│  (Get File)     │
└────────┬────────┘
         ▼
┌─────────────────┐
│  Extract PDF    │  Code node or HTTP to extract service
│  Text           │  (n8n has limited native PDF — often need
└────────┬────────┘   external step or pre-extracted text)
         ▼
┌─────────────────┐
│  Split Text     │  Split In Batches / Code node → chunks
└────────┬────────┘
         ▼
┌─────────────────┐
│  OpenAI         │  Embeddings node per chunk
│  Embeddings     │
└────────┬────────┘
         ▼
┌─────────────────┐
│  Supabase       │  INSERT into document_chunks (pgvector)
│  Postgres       │
└────────┬────────┘
         ▼
┌─────────────────┐
│  Update status  │  documents.status = ready
└─────────────────┘
```

---

## 📤 Upload Workflow (Box)

```
User drops file in Supabase Storage (or web form → Storage)
                │
                ▼
┌───────────────────────────┐
│  Supabase Storage         │  File saved
└─────────────┬─────────────┘
              │  webhook / poll
              ▼
┌───────────────────────────┐
│  n8n Workflow STARTS      │
└─────────────┬─────────────┘
              ▼
        [Extract → Chunk → Embed → Store]
              ▼
┌───────────────────────────┐
│  pgvector ready           │
└───────────────────────────┘
```

---

## 🔍 Search / Question Workflow (Box)

```
User sends question via webhook (or form)
                │
                ▼
┌───────────────────────────┐
│  n8n Webhook Trigger      │
└─────────────┬─────────────┘
              ▼
┌───────────────────────────┐
│  OpenAI Embeddings        │  Question → vector
└─────────────┬─────────────┘
              ▼
┌───────────────────────────┐
│  Supabase RPC / SQL       │  match_documents(query_embedding)
│  pgvector search          │
└─────────────┬─────────────┘
              ▼
┌───────────────────────────┐
│  OpenAI Chat              │  RAG prompt + answer
└─────────────┬─────────────┘
              ▼
┌───────────────────────────┐
│  Return JSON to caller    │
└───────────────────────────┘
```

---

## n8n Node Flow Diagram (Search)

```
Webhook → OpenAI (Embed) → Supabase (Vector Query) → OpenAI (Chat) → Respond
```

---

## When to Use This Approach

```
✅ USE WHEN:
  • Non-developers want to build RAG without NestJS
  • Need quick automation prototypes (days not weeks)
  • Connecting many services (email, Slack, Supabase, OpenAI)
  • Internal tools / ops workflows
  • Team already uses n8n

❌ AVOID WHEN:
  • Building production banking app (use NestJS + proper auth/RBAC)
  • Complex compliance logic (Excel export, audit logs, roles)
  • Heavy PDF OCR on scanned regulations (weak in pure n8n)
  • Need fine-grained error handling and testing
  • BCP full product — n8n is supplement, not main backend
```

---

## Limitations

| Limitation | Detail |
|------------|--------|
| Not inside Supabase | Separate n8n server to host and secure |
| PDF extraction | Often needs external service or pre-processing |
| Auth / RBAC | Harder than NestJS for multi-user banking app |
| Version control | Workflows are JSON — different from code repos |
| Scale | Fine for hundreds of docs; thousands need code backend |

---

## Summary

```
┌─────────────────────────────────────────────────────────────┐
│  n8n + Supabase RAG                                          │
├─────────────────────────────────────────────────────────────┤
│  Automation: n8n (self-hosted or cloud)                      │
│  Storage:    Supabase Storage                                │
│  Vectors:    Supabase pgvector                               │
│  AI:         OpenAI                                          │
│  Best for:   No-code MVP, automation, internal tools         │
│  Not for:    Full BCP production backend                     │
└─────────────────────────────────────────────────────────────┘
```
