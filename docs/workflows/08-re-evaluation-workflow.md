# 🔄 08 — Re-Evaluation Workflow

When bank fixes a gap and **re-uploads** internal docs, system re-runs comparison and closes resolved items.

---

## Scenario

```
Item P12 was Non-Compliant: "No 24h freeze procedure documented"
Bank uploads updated TFS Manual with new Section 4.2
System should mark P12 as Compliant → status Closed
```

---

## Workflow Box Diagram

```
┌─────────────────────────┐
│  User uploads updated   │
│  internal document      │
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│  Extract + chunk + embed│
│  (replace or version)   │
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│  POST /analysis/:id/    │
│  re-evaluate            │
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│  For each OPEN item     │
│  (partial + non only)   │
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│  Re-run comparison      │
│  engine (05)            │
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│  If now Compliant:      │
│  status → closed        │
│  clear target_date?     │
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│  Notify responsible     │
│  person + update dash   │
└─────────────────────────┘
```

---

## What Gets Re-Evaluated

```
✅ Re-run:  open + in-progress partial/non items
⏭️  Skip:   already compliant (unless user forces full re-run)
📝 Audit:   log old vs new level in audit_log
```

---

## Document Versioning

```
Option A: Replace chunks for same document_id (simpler MVP)
Option B: New document row + link session to latest version (audit-friendly)
```

---

## User Actions

```
1. Upload fixed policy PDF
2. Click "Re-evaluate session"
3. Review updated grid — P12 now green
4. Re-download Excel
```

---

## When to Use

```
✅ After remediation upload
✅ Periodic re-check (quarterly policy refresh)
✅ Before external audit
```

---

## Summary

Re-evaluation closes the **compliance loop**: gap found → CAP assigned → fix uploaded → auto re-compare → item closed. Core to requirement #11.
