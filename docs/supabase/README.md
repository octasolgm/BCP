# Supabase — BCP Database

Supabase Postgres + Storage backs all compliance data, including **Landing AI result caching** to avoid repeat ADE credits.

---

## Documents

| Doc | Purpose |
|-----|---------|
| [01-setup-guide.md](./01-setup-guide.md) | Project setup, env vars, run migrations |
| [02-landing-ai-schema.md](./02-landing-ai-schema.md) | Tables for ADE cache & credit logging |
| [migrations/001_landing_ai_cache.sql](./migrations/001_landing_ai_cache.sql) | SQL to run in Supabase SQL Editor |

---

## Why Supabase for Landing AI

| Problem | Supabase solution |
|---------|-------------------|
| Re-upload same gov PDF wastes ADE credits | `landing_ai_parse_cache` keyed by SHA-256 |
| Need audit trail of credit spend | `landing_ai_jobs.credit_usage` |
| Future re-analysis without re-extract | Store full parse markdown + extract JSON |
| Compliance history | Links to `documents`, `requirements`, `compliance_items` |

---

## Related workflow docs

- [Landing AI integration](../landingai/README.md)
- [Database schema (full)](../workflows/11-database-schema.md)
- [Supabase pgvector RAG](../workflows/02-supabase-pgvector-rag.md)
