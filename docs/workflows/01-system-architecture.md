# 🏗️ 01 — System Architecture (Compliance Comparison)

**Stack:** NestJS + Supabase + pgvector + OpenAI + ExcelJS

---

## Full System Box Diagram

```
┌──────────────────────────────────────────────────────────────────────────┐
│                           USER LAYER                                      │
│  Compliance Officer uploads docs → views grid → downloads Excel          │
│  Manager assigns dates / CAP → views MIS dashboard                         │
└───────────────────────────────┬──────────────────────────────────────────┘
                                │
                                ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                        NESTJS API (App Service / VPS)                     │
├──────────────────────────────────────────────────────────────────────────┤
│  🔐 Authentication          📤 Document Upload (multi-format)             │
│  📄 Text Extraction         🧩 Requirement Point Extractor                  │
│  🔢 Embedding Service       ⚖️  Comparison Engine (RAG)                  │
│  📊 Compliance Scoring      📑 Excel Generator (ExcelJS)                  │
│  📈 Dashboard / MIS         🔔 Alert / Notification Engine                │
│  🔄 Re-evaluation Module    📦 Bulk Processor (Phase 2)                   │
└───────┬──────────────────────────────┬───────────────────────────────────┘
        │                              │
        ▼                              ▼
┌───────────────┐              ┌───────────────────┐
│ Supabase      │              │ OpenAI API        │
│ Storage       │              │ embeddings + chat │
│ Postgres      │              └───────────────────┘
│ pgvector      │
└───────────────┘
```

---

## Data Flow: Upload → Excel

```
📤 Upload requirement PDF + internal docs
        │
        ▼
📄 Extract text (PDF/Word/OCR/HTML/Excel/Email)
        │
        ▼
🎯 Split requirement PDF into POINTS (Article 1, 2, 3...)
        │
        ▼
🧩 Chunk internal docs → embed → pgvector
        │
        ▼
⚖️  For EACH point: RAG search → GPT compare → Compliant/Partial/Non
        │
        ▼
💾 Save compliance_items (with CAP, dates, owner if gaps)
        │
        ▼
📑 ExcelJS → download .xlsx (client sample format)
        │
        ▼
📈 Dashboard metrics + 🔔 alerts on overdue items
```

---

## Module List

| Module | Purpose |
|--------|---------|
| **Authentication** | JWT login, roles (officer, manager, viewer) |
| **Document Upload** | Multi-format upload to Supabase Storage |
| **Text Extraction** | pdf-parse, mammoth, tesseract, cheerio, etc. |
| **Embedding & Vector Storage** | OpenAI embed → pgvector |
| **Requirement Point Extractor** | Split regulation into Excel rows |
| **Comparison Engine** | RAG + GPT → 3 compliance levels |
| **Compliance Scoring** | Rules + confidence thresholds |
| **Excel Generator** | ExcelJS formatted export |
| **Dashboard / MIS** | % compliant, charts, overdue |
| **Alert Engine** | Cron + email for deadlines |
| **Re-evaluation** | Re-run compare after fix upload |
| **Bulk Processor** | Queue many files (Phase 2) |

---

## What Base RAG Does vs What BCP Adds

```
┌─────────────────────┬────────────────────────────────────────┐
│  Standard RAG       │  BCP Compliance Adds                   │
├─────────────────────┼────────────────────────────────────────┤
│  Upload + embed     │  Requirement POINT extraction        │
│  Search + answer    │  Compare 2 doc TYPES (reg vs bank)   │
│                     │  3-level scoring (not just yes/no)     │
│                     │  Excel matching client template        │
│                     │  CAP, target date, responsibility     │
│                     │  Re-evaluation on re-upload            │
│                     │  MIS dashboard + alerts              │
└─────────────────────┴────────────────────────────────────────┘
```

---

## When to Use This Stack

```
✅ MVP / pilot with Supabase + OpenAI
✅ Fast development, TypeScript monorepo
✅ Cost ~$25–150/month for small bank pilot

⚠️  Production banking may need Azure path — see comparison.md
```

---

## Summary

BCP = **RAG foundation** + **comparison engine** + **Excel** + **tracking** + **dashboard** + **alerts**. NestJS orchestrates; Supabase stores; OpenAI compares.
