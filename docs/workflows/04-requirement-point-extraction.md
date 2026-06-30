# 🎯 04 — Requirement Point Extraction

How regulation PDFs become **individual Excel rows** (one point = one comparison).

---

## Workflow Box Diagram

```
┌─────────────────────────┐
│  Requirement PDF        │
│  (Cabinet Decision 74)  │
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│  Extract full text      │
│  (pdf-parse or Azure DI)│
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│  GPT-4o-mini            │
│  "Extract each clause   │
│   as separate point"    │
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│  Save each point to DB  │
│  requirements table     │
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│  Embed each point       │
│  text-embedding-3-small │
└────────────┬────────────┘
             │
             ▼
      Ready for comparison (05)
```

---

## Example Output

```
Point 1:  "Article 1 — Definitions of designated persons..."
Point 2:  "Article 2 — Asset freeze within 24 hours..."
Point 3:  "Article 3 — Reporting obligations to FIU..."
...
Point 40: "Article 40 — Record retention 5 years..."
```

Each becomes **one row** in Excel Column A and **one loop** in comparison engine.

---

## GPT Extraction Prompt (Concept)

```
You are a regulatory document parser.
Extract each distinct requirement, article, or clause as a separate item.
Return JSON array:
[{ "point_number": 1, "point_text": "..." }, ...]
Do not merge unrelated clauses. Preserve legal wording.
```

Full prompt: [14-comparison-prompt-templates.md](./14-comparison-prompt-templates.md)

---

## requirements Table Schema

```
┌──────────────┬────────────────────────────────────────┐
│  Column      │  Type / Notes                          │
├──────────────┼────────────────────────────────────────┤
│  id          │  UUID primary key                      │
│  document_id │  FK → documents (requirement type)     │
│  point_number│  Integer (1, 2, 3...)                  │
│  point_text  │  Full clause text                      │
│  embedding   │  vector(1536)                          │
│  created_at  │  Timestamp                             │
└──────────────┴────────────────────────────────────────┘
```

---

## Human Review (Recommended)

```
GPT extracts points
        │
        ▼
UI shows list — officer can merge/split/edit
        │
        ▼
Re-embed edited points
        │
        ▼
Start analysis
```

Prevents bad splits on complex Cabinet Decision structure.

---

## When to Use

```
✅ Every requirement document before comparison
✅ When regulation has numbered articles/clauses
⚠️  Very long docs — batch GPT calls by section
```

---

## Summary

Requirement point extraction turns one PDF into **N comparable units**. Without this step, you cannot produce one Excel row per obligation.
