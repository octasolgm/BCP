# 📁 13 — NestJS Folder Structure

Recommended module layout for BCP backend.

---

## Full Tree

```
apps/backend/src/
├── auth/
│   ├── auth.controller.ts
│   ├── auth.service.ts
│   ├── auth.module.ts
│   └── jwt.strategy.ts
│
├── documents/
│   ├── documents.controller.ts      ← POST upload, GET list
│   ├── documents.service.ts
│   └── documents.module.ts
│
├── extraction/
│   ├── pdf-extractor.service.ts
│   ├── word-extractor.service.ts
│   ├── excel-extractor.service.ts
│   ├── html-extractor.service.ts
│   ├── ocr-extractor.service.ts
│   ├── email-extractor.service.ts
│   └── extraction.module.ts
│
├── ingestion/
│   ├── chunker.service.ts
│   ├── embedding.service.ts
│   ├── ingestion.processor.ts       ← BullMQ worker
│   └── ingestion.module.ts
│
├── requirements/
│   ├── point-extractor.service.ts   ← GPT split clauses
│   ├── requirements.service.ts
│   └── requirements.module.ts
│
├── comparison/
│   ├── comparison-engine.service.ts ← ⭐ core loop
│   ├── rag-prompt.builder.ts
│   ├── compliance-scorer.service.ts
│   └── comparison.module.ts
│
├── analysis/
│   ├── analysis.controller.ts
│   ├── analysis.service.ts
│   ├── re-evaluation.service.ts
│   └── analysis.module.ts
│
├── export/
│   ├── excel-generator.service.ts
│   ├── export.controller.ts
│   └── export.module.ts
│
├── dashboard/
│   ├── dashboard.controller.ts
│   ├── metrics.service.ts
│   └── dashboard.module.ts
│
├── notifications/
│   ├── notifications.service.ts
│   ├── alert-cron.service.ts
│   ├── email.service.ts
│   └── notifications.module.ts
│
├── supabase/
│   ├── supabase.client.ts
│   └── supabase.module.ts
│
├── common/
│   ├── guards/
│   └── filters/
│
└── main.ts
```

---

## Module Responsibilities

```
┌─────────────────┬────────────────────────────────────────┐
│  Module         │  Does                                  │
├─────────────────┼────────────────────────────────────────┤
│  documents      │  Upload, storage, metadata             │
│  extraction     │  Format → plain text                   │
│  ingestion      │  Chunk + embed → pgvector              │
│  requirements   │  Split regulation → points               │
│  comparison     │  RAG + GPT per point                   │
│  analysis       │  Sessions, re-evaluate                 │
│  export         │  ExcelJS                               │
│  dashboard      │  Aggregations                          │
│  notifications  │  Cron + email                          │
└─────────────────┴────────────────────────────────────────┘
```

---

## Dependency Flow

```
documents → extraction → ingestion
documents → requirements → comparison
comparison → analysis → export
analysis → dashboard, notifications
```

---

## Key Service: comparison-engine.service.ts

```
for (const req of requirements) {
  chunks = await vectorSearch(req.embedding, internalDocIds)
  prompt = ragPromptBuilder.build(req, chunks)
  result = await openai.chat(prompt)
  await saveComplianceItem(result)
}
```

---

## BullMQ Processors

```
ingestion.processor.ts     — after upload: extract, chunk, embed
comparison.processor.ts    — after analysis/start: run engine
notification.processor.ts  — send emails async
```

---

## Summary

NestJS modules mirror BCP workflows. **`comparison/`** is the core; everything else feeds data in or presents results out.
