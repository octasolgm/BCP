# 05 — BCP API Endpoints (Landing AI)

Base URL: `http://localhost:4000` (dev)

Swagger: `http://localhost:4000/ai/swagger` (tag: **Landing AI**)

---

## GET /landing-ai/status

Check configuration and connectivity.

**Response:**

```json
{
  "configured": true,
  "apiBase": "https://api.va.landing.ai",
  "parseModel": "dpt-2-latest",
  "extractModel": "extract-latest",
  "supabaseCache": true
}
```

---

## POST /landing-ai/parse

Parse a document to Markdown (with Supabase cache).

**Body:** `multipart/form-data`

| Field | Type | Required |
|-------|------|----------|
| `file` | PDF / image / HTML | Yes |

**Response:**

```json
{
  "success": true,
  "cached": false,
  "fileName": "cabinet-decision-74.pdf",
  "fileHash": "sha256:...",
  "markdown": "# Article 1...",
  "creditUsage": 1.52,
  "jobId": "abc123",
  "durationMs": 4200
}
```

---

## POST /landing-ai/extract-gov-points

Extract numbered government requirement points from a parsed document.

**Body:** `multipart/form-data`

| Field | Type | Required |
|-------|------|----------|
| `file` | Document | Yes (or provide `markdown`) |
| `markdown` | string | Optional if file sent |

**Response:**

```json
{
  "success": true,
  "cached": false,
  "fileName": "cabinet-decision-74.pdf",
  "pointCount": 42,
  "points": [
    {
      "point_id": "2.6.5",
      "title": "Corrective Training and Actions",
      "text": "Include measures to take immediate and effective action...",
      "section": "Article 2.6",
      "page_hint": 12
    }
  ],
  "creditUsage": 0.8,
  "rawExtraction": {}
}
```

---

## POST /landing-ai/extract-internal-points

Same as gov extract but uses internal policy schema (section numbers like 7.4 Training).

---

## GET /landing-ai/jobs

List recent ADE jobs (credit audit).

**Query:** `?limit=20`

---

## GET /landing-ai/jobs/:id

Single job detail including full parse/extract JSON (from Supabase).

---

## Integration with comparison

After extraction:

1. Save points → `requirements` + `document_chunks`
2. Run `POST /comparison/analyze` (or AI Lab batch) per gov point
3. Export via existing Excel / PDF routes

See [01-end-to-end-workflow.md](./01-end-to-end-workflow.md).
