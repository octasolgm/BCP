# 📋 BCP — Compliance Comparison System Documentation

**Project:** Bank Compliance Platform (BCP)  
**Goal:** Automate comparison of **Requirement PDFs** vs **Internal Process Documents** and produce Excel reports with compliance levels.

---

## 🎯 Project Goal

Banks must prove their internal policies match regulatory requirements (UAE Cabinet Decisions, CBUAE guidelines, UN SC resolutions). Today this is done manually in Excel. BCP automates:

```
Requirement PDF  +  Internal Policy Docs  →  AI Comparison  →  Excel + Dashboard
```

---

## 📌 Step 1 Requirements (Must Have)

| # | Requirement |
|---|-------------|
| 1 | Upload requirement files (PDF, HTML, JPEG, PNG) |
| 2 | Upload internal process docs (Word, PDF, Excel, email text) |
| 3 | Extract individual requirement points/clauses |
| 4 | Extract internal document points |
| 5 | Compare each requirement against internal docs |
| 6 | 3-level status: **Compliant / Partial Compliant / Non-Compliant** |
| 7 | Evidence mapping (which doc + section covers requirement) |
| 8 | Target Date, Corrective Action Plan, Responsibility for gaps |
| 9 | Excel export matching client sample format |
| 10 | MIS dashboard (compliance %, charts) |
| 11 | Re-upload remediation → re-evaluate → update status |
| 12 | Alerts for missed / approaching target dates |

---

## 📌 Step 2 Requirements (Phase 2)

| # | Requirement |
|---|-------------|
| 1 | Bulk upload multiple requirement files |
| 2 | Bulk analysis with progress tracking |
| 3 | Organization-wide MIS dashboard |
| 4 | Department breakdown (optional) |

---

## 🏗️ High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         BCP COMPLIANCE SYSTEM                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────┐   ┌──────────────┐   ┌──────────────┐   ┌────────────┐ │
│  │ React    │   │ NestJS API   │   │ Supabase     │   │ OpenAI     │ │
│  │ Web App  │──►│ Backend      │──►│ Storage +    │──►│ Embed +    │ │
│  │          │   │              │   │ pgvector     │   │ GPT-4o-mini│ │
│  └──────────┘   └──────┬───────┘   └──────────────┘   └────────────┘ │
│                        │                                                 │
│         ┌──────────────┼──────────────┬──────────────┬──────────────┐    │
│         ▼              ▼              ▼              ▼              ▼    │
│    📤 Upload    📄 Extract    🎯 Compare    📊 Excel    🔔 Alerts      │
│    Multi-format  Points+RAG   Engine       Dashboard   Cron+Email     │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 🛠️ Technology Stack Summary

| Layer | Technology |
|-------|------------|
| Frontend | React + Vite + Recharts |
| Backend | NestJS (TypeScript) |
| Database | Supabase PostgreSQL + pgvector |
| File storage | Supabase Storage |
| AI embeddings | OpenAI `text-embedding-3-small` |
| AI compare | OpenAI `gpt-4o-mini` |
| Excel | ExcelJS |
| Jobs | BullMQ + Redis |
| Email alerts | Resend / SendGrid |

**Alternative stacks:** See [workflows/comparison.md](./workflows/comparison.md) for Azure, n8n, .NET.

---

## 📚 Documentation Index

### Landing AI + Supabase cache (new)

| Document | Topic |
|----------|-------|
| [landingai/README.md](./landingai/README.md) | ADE integration overview |
| [landingai/01-end-to-end-workflow.md](./landingai/01-end-to-end-workflow.md) | Step 1 & 2 full process |
| [landingai/03-developer-setup-guide.md](./landingai/03-developer-setup-guide.md) | Signup, API key, env |
| [supabase/migrations/001_landing_ai_cache.sql](./supabase/migrations/001_landing_ai_cache.sql) | Cache tables SQL |

### Core compliance workflows (read in order)

| # | Document | Topic |
|---|----------|-------|
| 01 | [system-architecture](./workflows/01-system-architecture.md) | All modules overview |
| 02 | [supabase-pgvector-rag](./workflows/02-supabase-pgvector-rag.md) | Base RAG setup |
| 03 | [document-extraction](./workflows/03-document-extraction-strategies.md) | PDF, Word, OCR, HTML |
| 04 | [requirement-points](./workflows/04-requirement-point-extraction.md) | Split regulation into rows |
| 05 | [comparison-engine](./workflows/05-comparison-engine.md) | ⭐ **Core compare logic** |
| 06 | [excel-output](./workflows/06-excel-output-generation.md) | ExcelJS report |
| 07 | [dashboard-mis](./workflows/07-dashboard-mis.md) | Charts & metrics |
| 08 | [re-evaluation](./workflows/08-re-evaluation-workflow.md) | Re-upload fixes |
| 09 | [alerts](./workflows/09-alerts-notifications.md) | Deadlines & email |
| 10 | [bulk-processing](./workflows/10-bulk-processing.md) | Phase 2 bulk |
| 11 | [database-schema](./workflows/11-database-schema.md) | All tables |
| 12 | [api-endpoints](./workflows/12-api-endpoints.md) | REST API |
| 13 | [nestjs-structure](./workflows/13-nestjs-structure.md) | Folder layout |
| 14 | [prompt-templates](./workflows/14-comparison-prompt-templates.md) | AI prompts |

### BCP-specific guides (Azure + Gemini path)

- [COMPLETE_WORKFLOW_EXPLAINED.md](./developer-guide/COMPLETE_WORKFLOW_EXPLAINED.md)
- [POST_UPLOAD_FLOW_BOXES.md](./developer-guide/POST_UPLOAD_FLOW_BOXES.md)

### Strategy comparison (other stacks)

- [workflows/comparison.md](./workflows/comparison.md)

---

## 🚀 Quick Start — What to Read

```
Building MVP with Supabase?
  → 01 → 02 → 04 → 05 → 06 → 11 → 13

Confused how compare works?
  → 05-comparison-engine.md

How to read PDFs?
  → 03-document-extraction-strategies.md

What API to build?
  → 12-api-endpoints.md
```
