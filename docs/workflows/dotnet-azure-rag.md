# 🟣 .NET + Azure RAG Workflow

**Best for:** Teams that use C# / .NET, Microsoft-centric banks, existing Azure .NET apps  
**Stack:** ASP.NET Core + Azure Blob + AI Search + Azure OpenAI

---

## .NET Project Structure

```
Bcp.Api/
├── Controllers/
│   ├── DocumentsController.cs       ← upload, list
│   ├── AnalysisController.cs      ← start analysis, get results
│   └── ReportsController.cs         ← Excel download
├── Services/
│   ├── IBlobStorageService.cs
│   ├── BlobStorageService.cs        ← Azure.Storage.Blobs
│   ├── IDocumentIntelligenceService.cs
│   ├── DocumentIntelligenceService.cs
│   ├── ISearchService.cs
│   ├── SearchService.cs             ← Azure.Search.Documents
│   ├── IOpenAIService.cs
│   ├── OpenAIService.cs             ← Azure.AI.OpenAI
│   ├── IChunkerService.cs
│   ├── IRagService.cs
│   └── RagService.cs
├── Workers/
│   └── AnalysisBackgroundService.cs ← HostedService or Hangfire
├── Data/
│   ├── AppDbContext.cs              ← EF Core → Azure SQL
│   └── Entities/
│       ├── Document.cs
│       ├── DocumentChunk.cs
│       └── ComplianceItem.cs
├── DTOs/
└── Program.cs
```

---

## NuGet Packages

| Package | Purpose |
|---------|---------|
| `Azure.Storage.Blobs` | File storage |
| `Azure.AI.FormRecognizer` | Document Intelligence |
| `Azure.Search.Documents` | AI Search |
| `Azure.AI.OpenAI` | Embeddings + chat |
| `Microsoft.EntityFrameworkCore.SqlServer` | Azure SQL metadata |
| `Hangfire` or `Azure.Messaging.ServiceBus` | Background jobs |
| `ClosedXML` or `EPPlus` | Excel export |

---

## Azure Services Connection Diagram

```
┌─────────────────┐
│  Blazor / React │  Frontend (any)
└────────┬────────┘
         ▼
┌─────────────────┐
│  ASP.NET Core   │  Azure App Service
│  Web API        │
└────────┬────────┘
         │
    ┌────┴────┬────────────┬────────────┐
    ▼         ▼            ▼            ▼
┌───────┐ ┌───────┐  ┌──────────┐  ┌──────────┐
│ Blob  │ │ SQL   │  │ AI Search│  │ Azure    │
│       │ │ Server│  │          │  │ OpenAI   │
└───────┘ └───────┘  └──────────┘  └──────────┘
```

Same Azure services as NestJS — only the backend language differs.

---

## 📤 Upload Workflow

```
POST /api/documents/upload
        │
        ▼
┌──────────────────────┐
│  DocumentsController │
└──────────┬───────────┘
           ▼
┌──────────────────────┐
│  BlobStorageService  │  Upload to container
└──────────┬───────────┘
           ▼
┌──────────────────────┐
│  EF Core Save        │  Document entity → Azure SQL
└──────────┬───────────┘
           ▼
┌──────────────────────┐
│  Queue job           │  Hangfire / Service Bus
└──────────┬───────────┘
           ▼
┌──────────────────────────────┐
│  DocumentIntelligenceService │
└──────────┬───────────────────┘
           ▼
┌──────────────────────┐
│  ChunkerService      │
└──────────┬───────────┘
           ▼
┌──────────────────────┐
│  OpenAIService       │  Embed chunks
└──────────┬───────────┘
           ▼
┌──────────────────────┐
│  SearchService       │  Index in AI Search
└──────────────────────┘
```

---

## 🔍 Search Workflow

```
POST /api/analysis/compare
        │
        ▼
Background worker loops each regulation point:
        │
        ├── SearchService.VectorSearchAsync(point)
        ├── RagService.BuildPrompt(point, chunks)
        ├── OpenAIService.GetCompletionAsync(prompt)
        └── Save ComplianceItem to SQL
        │
        ▼
GET /api/analysis/{sessionId} → return results
```

---

## NestJS vs .NET Comparison

```
┌──────────────────┬─────────────────────┬─────────────────────┐
│                  │  NestJS + Azure     │  .NET + Azure       │
├──────────────────┼─────────────────────┼─────────────────────┤
│  Language        │  TypeScript         │  C#                 │
│  Azure SDKs      │  @azure/* npm       │  Azure.* NuGet      │
│  ORM             │  Prisma             │  EF Core            │
│  Jobs            │  BullMQ + Redis     │  Hangfire / Bus     │
│  Excel           │  ExcelJS            │  ClosedXML          │
│  Same Azure?     │  YES — identical    │  YES — identical    │
│  RAG logic       │  Same steps         │  Same steps         │
│  Web frontend    │  React (shared)     │  React or Blazor    │
│  BCP monorepo    │  Fits npm workspace │  Separate solution  │
│  Hiring          │  JS full-stack      │  Enterprise .NET    │
└──────────────────┴─────────────────────┴─────────────────────┘
```

**Choose .NET if** the bank's IT department standardizes on C# and Azure App Service with .NET runtime.

**Choose NestJS if** you want one TypeScript monorepo with React web + shared packages (`@bcp/shared-types`).

---

## When to Use This Approach

```
✅ USE WHEN:
  • Team is strong in C# / ASP.NET Core
  • Bank mandates .NET for all new APIs
  • Integrating with existing .NET core banking systems
  • Prefer EF Core + Azure SQL over Prisma

❌ AVOID WHEN:
  • Monorepo is already TypeScript (BCP default)
  • Small team only knows JavaScript
  • Need fastest path with existing NestJS CLAUDE.md docs
```

---

## Summary

```
┌─────────────────────────────────────────────────────────────┐
│  .NET + Azure RAG                                            │
├─────────────────────────────────────────────────────────────┤
│  Backend:  ASP.NET Core Web API                              │
│  Files:    Azure Blob + Document Intelligence                │
│  Vectors:  Azure AI Search                                   │
│  AI:       Azure OpenAI                                      │
│  Meta:     Azure SQL or Cosmos DB                            │
│  Same Azure services as NestJS — different language only     │
│  Best for: .NET teams, enterprise Microsoft shops            │
└─────────────────────────────────────────────────────────────┘
```
