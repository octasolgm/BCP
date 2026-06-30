# 02 — Landing AI Schema (Supabase)

Tables for caching ADE parse/extract results and tracking credit usage.

---

## Entity diagram

```
documents (existing)
      │
      ▼
landing_ai_jobs ◄─────── audit log (every ADE call)
      │
      ├── landing_ai_parse_cache   (file_hash → markdown)
      │
      └── landing_ai_extract_cache (file_hash + schema → points JSON)
```

---

## landing_ai_jobs

Every Parse or Extract call — success or failure.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID PK | |
| operation | TEXT | `parse` \| `extract_gov` \| `extract_internal` |
| file_name | TEXT | Original filename |
| file_hash | TEXT | SHA-256 hex |
| file_size_bytes | BIGINT | |
| document_id | UUID FK | Optional link to `documents` |
| status | TEXT | `pending` \| `success` \| `error` |
| credit_usage | NUMERIC | From ADE metadata |
| duration_ms | INTEGER | |
| landing_job_id | TEXT | ADE job_id |
| model | TEXT | e.g. dpt-2-latest |
| error_message | TEXT | |
| response_json | JSONB | Full ADE response (optional) |
| created_at | TIMESTAMPTZ | |

---

## landing_ai_parse_cache

Avoid re-parsing identical files.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID PK | |
| file_hash | TEXT UNIQUE | SHA-256 |
| file_name | TEXT | Last known name |
| markdown | TEXT | Parsed markdown |
| chunks_json | JSONB | Optional layout chunks |
| parse_model | TEXT | |
| credit_usage | NUMERIC | Original parse cost |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

**Lookup:** `SELECT * FROM landing_ai_parse_cache WHERE file_hash = $1`

---

## landing_ai_extract_cache

Avoid re-extracting with same schema.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID PK | |
| file_hash | TEXT | |
| schema_key | TEXT | `gov_requirement_points` \| `internal_policy_points` |
| points_json | JSONB | Extracted points array |
| extract_model | TEXT | |
| credit_usage | NUMERIC | |
| created_at | TIMESTAMPTZ | |

**Unique:** `(file_hash, schema_key)`

---

## Credit savings example

```
Day 1: Upload IMPTFS.pdf → Parse (1.5 credits) → cached
Day 2: Same file re-uploaded → Cache HIT → 0 credits
Day 3: Extract gov points → Extract (0.8 credits) → cached
Day 4: Re-run comparison only → 0 ADE credits (Gemini only)
```

---

## Indexes

- `landing_ai_jobs (created_at DESC)`
- `landing_ai_jobs (file_hash)`
- `landing_ai_parse_cache (file_hash)`
- `landing_ai_extract_cache (file_hash, schema_key)`

---

## RLS (recommended for production)

- Service role: full access (API uses `SUPABASE_SERVICE_KEY`)
- Authenticated users: read own org's jobs (when multi-tenant)

Migration includes basic RLS stubs — enable when auth is wired.
