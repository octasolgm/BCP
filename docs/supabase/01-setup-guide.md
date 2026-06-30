# 01 — Supabase Setup Guide

---

## 1. Project (already configured)

BCP uses a Supabase project. Credentials go in env files only — **never in docs or git**.

**Files:**

| File | Keys |
|------|------|
| `apps/api/.env` | `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_KEY`, `DATABASE_URL` |
| `.env` (root) | Same + `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` for web |

---

## 2. Run database migrations (automatic)

From the **repo root**:

```bash
npm run db:migrate
```

Or from `apps/api`:

```bash
npm run db:migrate
```

This applies all SQL files in `docs/supabase/migrations/` and records them in `schema_migrations`. Migrations are **idempotent** (`CREATE IF NOT EXISTS`).

**On API startup**, pending migrations also run automatically when `AUTO_DB_MIGRATE=true` (default in development).

Set `DATABASE_URL` in `.env`, or `SUPABASE_URL` + `SUPABASE_DB_PASSWORD` (password from Supabase → **Settings → Database**).

Verify tables: `landing_ai_jobs`, `landing_ai_parse_cache`, `landing_ai_extract_cache`, `schema_migrations`

---

## 3. Storage buckets (optional, for Step 1 upload flow)

Create buckets in **Storage**:

| Bucket | Purpose |
|--------|---------|
| `requirement-docs` | Gov law PDFs |
| `internal-docs` | Internal policies |
| `exports` | Generated Excel / PDF |

RLS policies: service role from API; authenticated users read own org (when auth added).

---

## 4. Verify API connection

```bash
curl http://localhost:4000/health
```

Expect `"supabase": "ok"` when keys are valid.

---

## 5. Web client

`apps/web/src/lib/supabase-browser.ts` uses:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Add anon key to root `.env.example` if missing locally.

---

## 6. Local vs production

| Environment | Supabase tier | Notes |
|-------------|---------------|-------|
| Dev | Free / Pro | Use same project or separate dev project |
| Prod | Pro recommended | Enable backups, restrict service key to API only |

---

## 7. Next steps

- Read [02-landing-ai-schema.md](./02-landing-ai-schema.md) for table details
- Configure Landing AI: [../landingai/03-developer-setup-guide.md](../landingai/03-developer-setup-guide.md)
