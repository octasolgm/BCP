# 03 — Developer Setup Guide (Landing AI)

How to sign up, obtain credentials, and connect Landing AI ADE to BCP.

---

## 1. Create a Landing AI account

1. Go to **[https://va.landing.ai](https://va.landing.ai)** (Vision Agent / ADE playground).
2. Sign up (email or SSO).
3. You land in the **Playground** — upload a sample PDF to verify parsing works before coding.

**Optional:** Join [Landing AI Discord](https://discord.com/invite/RVcW3j9RgR) for API questions.

---

## 2. Get your API key

1. In the Landing AI console, open **Settings → API Keys** (or **API Key** in docs).
2. Create a new key. It typically starts with `vz_` or similar prefix.
3. Copy it once — treat it like a password.

**Do not commit the key to git.** Store only in `apps/api/.env`.

---

## 3. What to give BCP (env vars)

Add to `apps/api/.env` and root `.env`:

```env
# Landing AI — Agentic Document Extraction
VISION_AGENT_API_KEY=vz_your_key_here
LANDING_AI_API_BASE=https://api.va.landing.ai
LANDING_AI_PARSE_MODEL=dpt-2-latest
LANDING_AI_EXTRACT_MODEL=extract-latest
```

| Variable | Required | Description |
|----------|----------|-------------|
| `VISION_AGENT_API_KEY` | **Yes** | Bearer token for all ADE calls |
| `LANDING_AI_API_BASE` | No | Default `https://api.va.landing.ai` (EU: check docs) |
| `LANDING_AI_PARSE_MODEL` | No | Document parsing model |
| `LANDING_AI_EXTRACT_MODEL` | No | Field extraction model |

Restart API after changes: `npm run dev:api`

---

## 4. Verify from BCP

### Web UI

1. Start API + web: `npm run dev:api` and `npm run dev:web`
2. Open **[http://localhost:3000/landing-ai-setup](http://localhost:3000/landing-ai-setup)**
3. Check **Configuration status** — should show API key configured
4. Click **Test connection** — calls `GET /landing-ai/status`
5. Upload a small PDF → **Test parse** — calls `POST /landing-ai/parse`

### cURL (direct Landing AI)

```bash
curl -X POST "https://api.va.landing.ai/v1/ade/parse" \
  -H "Authorization: Bearer $VISION_AGENT_API_KEY" \
  -F "document=@./sample.pdf" \
  -F "model=dpt-2-latest"
```

### cURL (via BCP API)

```bash
curl -X POST "http://localhost:4000/landing-ai/parse" \
  -F "file=@./sample.pdf"
```

---

## 5. ADE APIs used by BCP

| ADE endpoint | BCP wrapper | Purpose |
|--------------|-------------|---------|
| `POST /v1/ade/parse` | `POST /landing-ai/parse` | PDF/HTML/image → markdown |
| `POST /v1/ade/extract` | `POST /landing-ai/extract-gov-points` | Gov numbered points |
| `POST /v1/ade/extract` | `POST /landing-ai/extract-internal-points` | Internal policy points |

---

## 6. Extraction schemas

JSON schemas live in:

```
apps/api/src/modules/landing-ai/schemas/
  gov-requirement-points.schema.json
  internal-policy-points.schema.json
```

Edit schemas when your gov PDF format changes (e.g. CBUAE vs TFS numbering).

---

## 7. Credits & billing

- Each **Parse** and **Extract** call returns `metadata.credit_usage` in the response.
- BCP logs this to Supabase `landing_ai_jobs` for cost tracking.
- **Cache:** Re-parsing the same file hash skips ADE Parse (see [Supabase docs](../supabase/02-landing-ai-schema.md)).

Monitor usage in the Landing AI dashboard.

---

## 8. Production checklist

- [ ] API key in secrets manager (not `.env` in repo)
- [ ] Run Supabase migration `001_landing_ai_cache.sql`
- [ ] Set file size limits (20 MB default in BCP)
- [ ] Pin models in production (`dpt-2-latest` → specific version when stable)
- [ ] Enable async parse jobs for bulk (Step 2) — ADE `parse/jobs` API

---

## 9. Troubleshooting

| Issue | Fix |
|-------|-----|
| `401 Unauthorized` | Check `VISION_AGENT_API_KEY` in `apps/api/.env` |
| `Missing VISION_AGENT_API_KEY` | Key not loaded — restart API, check env path |
| Empty extract | Improve schema descriptions; ensure parse markdown has text |
| High credit usage | Enable Supabase cache; avoid re-parsing unchanged files |
| Scanned PDF no text | ADE handles OCR; fallback to Azure Document Intelligence |

---

## 10. Official Landing AI docs

- Quickstart: https://docs.landing.ai/ade/ade-quickstart
- Parse API: https://docs.landing.ai/ade/ade-parse
- Extract API: https://docs.landing.ai/ade/ade-extract
- TypeScript SDK: `npm install landingai-ade` (optional; BCP uses REST via fetch)
