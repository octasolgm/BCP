# 📦 10 — Bulk Processing (Phase 2)

Multiple requirement files + multiple internal docs → matrix analysis + master Excel.

---

## Workflow Box Diagram

```
┌─────────────────────────┐
│  Bulk upload zone       │
│  5 requirements +       │
│  10 internal docs       │
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│  BullMQ queue           │
│  One job per file pair  │
│  or per requirement     │
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│  Extract + embed all    │
│  (parallel workers)     │
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│  Comparison matrix      │
│  Req A vs all internal  │
│  Req B vs all internal  │
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│  Aggregated report      │
│  Master Excel (sheets)  │
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│  Org-wide MIS dashboard │
│  Dept breakdown         │
└─────────────────────────┘
```

---

## Comparison Matrix

```
              Internal Doc 1   Internal Doc 2   Combined
Req PDF A         85%              72%           90%
Req PDF B         60%              88%           92%
```

**Combined internal:** search across all bank policy chunks (union of document_ids).

---

## Progress UI

```
Bulk job #42
  ████████░░  80%  (32/40 articles compared)
  ETA: 4 minutes
```

WebSocket or polling `GET /analysis/bulk/:jobId/status`

---

## Master Excel Structure

```
Sheet 1: Summary (all regulations, overall %)
Sheet 2: Cabinet Decision 74 — detail rows
Sheet 3: CBUAE AML Guidelines — detail rows
Sheet 4: Overdue items (all sessions)
```

---

## When to Use

```
✅ Phase 2 — after single-pair MVP proven
✅ Large banks with many regulations
❌ MVP — start with 1 requirement + 1–3 internal docs
```

---

## Summary

Bulk processing scales BCP from **one comparison at a time** to **organization-wide compliance coverage** via queues and aggregated reporting.
