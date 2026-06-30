# 📑 06 — Excel Output Generation

**Package:** ExcelJS  
**Goal:** Match client sample — Requirement | UAE Response | Comply Yes/No + CAP columns

---

## Workflow Box Diagram

```
┌─────────────────────────┐
│  compliance_items DB    │
│  (all rows for session) │
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│  Query by session_id    │
│  ORDER BY point_number  │
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│  ExcelJS Workbook       │
│  Create sheet + headers │
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│  Color coding per row   │
│  Green / Yellow / Red   │
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│  Return .xlsx buffer    │
│  GET /export/excel/:id  │
└─────────────────────────┘
```

---

## Column Structure (Client Sample)

| Col | Header | Source |
|-----|--------|--------|
| A | Requirement | `requirement_text` |
| B | UAE Response / Compliance Level | `matched_internal_text` + level |
| C | Comply (Yes/No/Partial) | `compliance_level` mapped |
| D | Target Date | `target_date` (if partial/non) |
| E | Corrective Action Plan | `corrective_action_plan` |
| F | Responsibility | `responsibility` |
| G | Status | `status` (open/in-progress/closed) |

**Phase 2 (Book 6 format):** Add risk rating, audit trail, evidence links — optional extra sheet.

---

## Color Coding Rules

```
┌─────────────────────┬──────────────┬─────────────────┐
│  Compliance Level   │  Row Color   │  Col C Value    │
├─────────────────────┼──────────────┼─────────────────┤
│  Compliant          │  🟢 Green    │  Yes            │
│  Partial Compliant  │  🟡 Yellow   │  Partial        │
│  Non-Compliant      │  🔴 Red      │  No             │
└─────────────────────┴──────────────┴─────────────────┘
```

---

## Formatting Rules

```
Header row:
  - Bold white text on dark blue background
  - Freeze top row
  - Auto-filter enabled

Columns:
  - Auto-width (min 15, max 60 chars)
  - Wrap text on A and B
  - Date format on D: DD-MMM-YYYY

Borders:
  - Thin border all cells in data range
```

---

## NestJS Module

```
export/
├── excel-generator.service.ts   ← build workbook
└── export.controller.ts         ← GET /export/excel/:sessionId
```

---

## When to Use

```
✅ After analysis session completes
✅ Before management review meetings
✅ Re-generate anytime DB rows update (re-evaluation)
```

---

## Summary

ExcelJS turns `compliance_items` rows into the **client-deliverable spreadsheet** with visual compliance status. Same data powers the dashboard.
