# 📈 07 — Dashboard / MIS

Management Information System — compliance %, charts, overdue alerts.

---

## User Flow Box Diagram

```
┌─────────────────────────┐
│  User opens Dashboard   │
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│  NestJS metrics queries │
│  (aggregation SQL)      │
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│  JSON metrics response  │
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│  React + Recharts       │
│  Donut, bar, trend line │
└─────────────────────────┘
```

---

## Metrics Displayed

| Metric | Calculation |
|--------|-------------|
| Overall compliance % | compliant / total × 100 |
| Compliant count | COUNT level = compliant |
| Partial count | COUNT level = partial |
| Non-compliant count | COUNT level = non |
| Documents analyzed | COUNT analysis_sessions completed |
| Pending action items | status IN (open, in-progress) |
| Overdue items | target_date < today AND not closed |
| Trend over time | compliance % by session date |
| By responsibility | GROUP BY responsibility |

---

## Key SQL Queries (Conceptual)

```
-- Compliance breakdown
SELECT compliance_level, COUNT(*)
FROM compliance_items
WHERE analysis_session_id = ?
GROUP BY compliance_level;

-- Overdue
SELECT * FROM compliance_items
WHERE target_date < NOW()
  AND status != 'closed';

-- Responsibility breakdown
SELECT responsibility, compliance_level, COUNT(*)
FROM compliance_items
GROUP BY responsibility, compliance_level;
```

---

## Chart Types

```
🍩 Donut chart     — Compliant vs Partial vs Non %
📊 Bar chart       — Count by level
📈 Line chart      — Compliance % over sessions
📋 Table           — Overdue items (red highlight)
👤 Pie by owner    — Open items per responsibility
```

---

## API Endpoints

```
GET /dashboard/metrics     — all summary stats
GET /dashboard/overdue     — overdue item list
GET /dashboard/trends      — time series data
```

---

## When to Use

```
✅ Compliance officer daily view
✅ Management monthly MIS pack
✅ Audit evidence of tracking gaps
```

---

## Summary

Dashboard reads the same `compliance_items` data as Excel but adds **aggregations, trends, and overdue visibility** for ongoing compliance management.
