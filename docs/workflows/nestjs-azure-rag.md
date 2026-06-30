# 🏗️ NestJS + Azure RAG Workflow (Detailed)

**Best for:** Production BCP-style apps on Microsoft Azure  
**Stack:** NestJS + Blob + AI Search + Azure OpenAI + PostgreSQL/Cosmos

---

## Full NestJS Module Structure

```
apps/backend/src/
├── app.module.ts
├── config/
│   └── azure.config.ts              ← connection strings, keys
│
├── auth/
│   ├── auth.module.ts
│   ├── auth.controller.ts           ← login, JWT
│   └── guards/roles.guard.ts
│
├── documents/
│   ├── documents.module.ts
│   ├── documents.controller.ts      ← POST /upload, GET /list
│   ├── documents.service.ts
│   └── dto/upload-document.dto.ts
│
├── azure/
│   ├── azure.module.ts
│   ├── blob.service.ts              ← @azure/storage-blob
│   ├── document-intelligence.service.ts
│   ├── search.service.ts            ← @azure/search-documents
│   └── openai.service.ts            ← @azure/openai
│
├── ingestion/
│   ├── ingestion.module.ts
│   ├── ingestion.service.ts         ← chunk + index pipeline
│   ├── chunker.service.ts           ← split articles/sections
│   └── ingestion.processor.ts       ← BullMQ worker
│
├── analysis/
│   ├── analysis.module.ts
│   ├── analysis.controller.ts       ← POST /compare, GET /:id
│   ├── analysis.service.ts
│   ├── rag.service.ts               ← R + A + G orchestration
│   └── analysis.processor.ts
│
├── compliance/
│   ├── compliance.controller.ts     ← update action plan, dates
│   └── compliance.service.ts
│
├── reports/
│   ├── reports.controller.ts        ← GET /excel/:sessionId
│   └── excel.service.ts             ← ExcelJS
│
├── alerts/
│   └── deadline.cron.ts
│
└── prisma/ or typeorm/              ← Azure PostgreSQL metadata
```

---

## Packages Used

| Package | Purpose |
|---------|---------|
| `@azure/storage-blob` | Upload/download files |
| `@azure/ai-form-recognizer` | Document Intelligence (extract/OCR) |
| `@azure/search-documents` | AI Search index + vector query |
| `@azure/openai` | Embeddings + chat completions |
| `@nestjs/bullmq` + `bullmq` | Background jobs |
| `ioredis` | Azure Redis connection |
| `@prisma/client` | PostgreSQL ORM |
| `exceljs` | Excel reports |

---

## Azure Services Connection Diagram

```
                    ┌─────────────────┐
                    │  React Web App  │
                    └────────┬────────┘
                             │ HTTPS
                             ▼
                    ┌─────────────────┐
                    │  NestJS API     │
                    │  App Service    │
                    └───┬───┬───┬─────┘
                        │   │   │
         ┌──────────────┘   │   └──────────────┐
         ▼                  ▼                  ▼
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│ Blob        │    │ PostgreSQL  │    │ Redis       │
│ Storage     │    │ (metadata)  │    │ (BullMQ)    │
└──────┬──────┘    └─────────────┘    └──────┬──────┘
       │                                       │
       ▼                                       ▼
┌─────────────┐                         ┌─────────────┐
│ Document    │◄── worker ──────────────│ BullMQ      │
│ Intelligence│                         │ Processor   │
└──────┬──────┘                         └──────┬──────┘
       │                                       │
       ▼                                       ▼
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│ OpenAI      │───►│ AI Search   │◄───│ RAG Service │
│ Embeddings  │    │ Index       │    │ + GPT       │
└─────────────┘    └─────────────┘    └─────────────┘
```

**Optional metadata store:** Azure Cosmos DB instead of PostgreSQL for global distribution.

---

## 📤 Upload Workflow

```
POST /documents/upload
        │
        ▼
DocumentsService → BlobService.upload(file)
        │
        ▼
Prisma.documents.create({ blobUrl, type, status: 'uploaded' })
        │
        ▼
IngestionQueue.add('ingest', { documentId })
        │
        ▼
[Worker]
  BlobService.downloadUrl
  → DocumentIntelligenceService.analyze()
  → ChunkerService.split()
  → OpenAIService.embedBatch(chunks)
  → SearchService.uploadDocuments(chunks + vectors)
  → Prisma.documents.update({ status: 'ready', extractedText })
```

---

## 🔍 Search Workflow

```
POST /analysis/compare { requirementDocId, internalDocIds }
        │
        ▼
AnalysisQueue.add('analyze', { sessionId })
        │
        ▼
[Worker — for each Article point P]
  RagService.retrieve(P)
    → OpenAIService.embed(P)
    → SearchService.vectorSearch(filter: internal doc ids)
  RagService.augment(P, topChunk)
    → build system + user messages
  RagService.generate(prompt)
    → OpenAIService.chatCompletion()
  ComplianceService.saveItem(result)
        │
        ▼
Session status = completed → Web polls GET /analysis/:id
```

---

## Metadata: PostgreSQL vs Cosmos DB

```
┌────────────────────┬────────────────────────────────────────┐
│  Azure PostgreSQL  │  Default — SQL, Prisma, pgvector optional│
│  Azure Cosmos DB   │  Global scale, JSON docs, multi-region   │
└────────────────────┴────────────────────────────────────────┘

Vectors always in AI Search — NOT in Cosmos.
Cosmos/SQL only stores: users, sessions, compliance_items, audit.
```

---

## When to Use This Approach

```
✅ USE WHEN:
  • Building BCP production on Azure
  • Need modular NestJS codebase with tests
  • Enterprise auth, RBAC, audit logs
  • Team prefers TypeScript
  • Azure Document Intelligence for scanned UAE regulations

❌ USE .NET INSTEAD WHEN:
  • Bank IT mandates C# / .NET only
  • Existing .NET team and libraries
```

---

## Summary

```
┌─────────────────────────────────────────────────────────────┐
│  NestJS + Azure RAG (Detailed)                               │
├─────────────────────────────────────────────────────────────┤
│  Backend:  NestJS modules (documents, azure, rag, reports) │
│  Files:    Azure Blob + Document Intelligence                │
│  Vectors:  Azure AI Search                                   │
│  AI:       Azure OpenAI                                      │
│  Meta:     PostgreSQL or Cosmos DB                           │
│  Jobs:     BullMQ + Azure Redis                              │
│  Best for: Production compliance apps on Azure               │
└─────────────────────────────────────────────────────────────┘
```
