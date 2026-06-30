# 🔌 12 — API Endpoints (NestJS REST)

All HTTP endpoints for BCP compliance comparison.

---

## Auth

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/auth/register` | Create account |
| POST | `/auth/login` | JWT token |

---

## Documents

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/documents/upload` | Upload file (`doc_type`: requirement \| internal) |
| GET | `/documents` | List user's documents |
| GET | `/documents/:id` | Single doc + status |
| DELETE | `/documents/:id` | Remove doc + chunks |

**Upload body (multipart):** `file`, `doc_type`

---

## Analysis

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/analysis/start` | Start compare session |
| GET | `/analysis/:sessionId` | Session status + summary |
| GET | `/analysis/:sessionId/items` | All compliance rows |
| PATCH | `/analysis/items/:itemId` | Update date, CAP, owner |
| POST | `/analysis/:sessionId/re-evaluate` | Re-run after new upload |

**POST /analysis/start body:**
```
{
  "requirement_doc_id": "uuid",
  "internal_doc_ids": ["uuid", "uuid"]
}
```

---

## Export

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/export/excel/:sessionId` | Download .xlsx |

Response: `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`

---

## Dashboard

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/dashboard/metrics` | Summary stats |
| GET | `/dashboard/overdue` | Overdue items list |
| GET | `/dashboard/trends` | Compliance % over time |

---

## Notifications

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/notifications` | User's alerts |
| POST | `/notifications/mark-read` | Mark as read |

---

## Phase 2 — Bulk

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/analysis/bulk/start` | Multi-file analysis |
| GET | `/analysis/bulk/:jobId/status` | Progress % |

---

## Typical Flow (Sequence)

```
1. POST /documents/upload  (requirement PDF)
2. POST /documents/upload  (internal doc x2)
3. POST /analysis/start
4. Poll GET /analysis/:id until status=completed
5. GET /analysis/:id/items  → review grid
6. PATCH /analysis/items/:id  → set CAP, dates
7. GET /export/excel/:id  → download
8. GET /dashboard/metrics
```

---

## Auth Header

```
Authorization: Bearer <jwt_token>
```

All routes except `/auth/*` require JWT.

---

## Summary

REST API mirrors the compliance workflow: upload → analyze → edit gaps → export → monitor. NestJS controllers map 1:1 to modules in [13-nestjs-structure.md](./13-nestjs-structure.md).
