# 🗄️ 11 — Database Schema

Complete PostgreSQL schema for BCP compliance comparison (Supabase).

---

## Entity Relationship (ASCII)

```
┌─────────┐       ┌─────────────┐       ┌──────────────────┐
│  users  │───┬──►│  documents  │───┬──►│ document_chunks  │
└─────────┘   │   └─────────────┘   │   └──────────────────┘
              │          │          │
              │          │          └──►┌──────────────────┐
              │          │              │  requirements    │
              │          │              └────────┬─────────┘
              │          │                       │
              │          ▼                       │
              │   ┌──────────────────┐           │
              └──►│ analysis_sessions│◄──────────┘
                  └────────┬─────────┘
                           │
                           ▼
                  ┌──────────────────┐
                  │ compliance_items │
                  └────────┬─────────┘
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
      ┌─────────────┐ ┌──────────┐ ┌───────────┐
      │notifications│ │ audit_log│ │ (export)  │
      └─────────────┘ └──────────┘ └───────────┘
```

---

## users

```
┌──────────────┬─────────────────────────────────────┐
│  id          │  UUID PK                            │
│  email       │  VARCHAR UNIQUE                     │
│  password_hash│ VARCHAR                            │
│  name        │  VARCHAR                            │
│  role        │  officer | manager | viewer         │
│  created_at  │  TIMESTAMPTZ                        │
└──────────────┴─────────────────────────────────────┘
```

---

## documents

```
┌──────────────┬─────────────────────────────────────┐
│  id          │  UUID PK                            │
│  user_id     │  FK → users                         │
│  filename    │  VARCHAR                            │
│  type        │  MIME / extension                   │
│  storage_path│  Supabase Storage path              │
│  doc_type    │  'requirement' | 'internal'         │
│  extracted_text│ TEXT (full doc, optional cache)   │
│  status      │  uploading | processing | ready     │
│  created_at  │  TIMESTAMPTZ                        │
└──────────────┴─────────────────────────────────────┘
```

---

## document_chunks

```
┌──────────────┬─────────────────────────────────────┐
│  id          │  UUID PK                            │
│  document_id │  FK → documents                     │
│  chunk_index │  INTEGER                            │
│  content     │  TEXT                               │
│  embedding   │  vector(1536)                       │
│  created_at  │  TIMESTAMPTZ                        │
└──────────────┴─────────────────────────────────────┘
```

---

## requirements

```
┌──────────────┬─────────────────────────────────────┐
│  id          │  UUID PK                            │
│  document_id │  FK → documents (requirement only)  │
│  point_number│  INTEGER                            │
│  point_text  │  TEXT                               │
│  embedding   │  vector(1536)                       │
│  created_at  │  TIMESTAMPTZ                        │
└──────────────┴─────────────────────────────────────┘
```

---

## analysis_sessions

```
┌──────────────────┬──────────────────────────────────┐
│  id              │  UUID PK                         │
│  user_id         │  FK → users                      │
│  requirement_doc_id│ FK → documents                 │
│  internal_doc_id │  FK → documents (or JSON array)  │
│  status          │  pending | running | completed   │
│  started_at      │  TIMESTAMPTZ                     │
│  completed_at    │  TIMESTAMPTZ nullable            │
└──────────────────┴──────────────────────────────────┘
```

---

## compliance_items

```
┌──────────────────────────┬──────────────────────────────┐
│  id                      │  UUID PK                     │
│  analysis_session_id     │  FK → analysis_sessions      │
│  requirement_id          │  FK → requirements           │
│  requirement_text        │  TEXT                        │
│  matched_internal_text   │  TEXT nullable               │
│  compliance_level        │  compliant|partial|non       │
│  reasoning               │  TEXT                        │
│  gaps                    │  TEXT nullable               │
│  target_date             │  DATE nullable               │
│  corrective_action_plan  │  TEXT nullable               │
│  responsibility          │  VARCHAR nullable            │
│  status                  │  open|in-progress|closed     │
│  created_at              │  TIMESTAMPTZ                 │
│  updated_at              │  TIMESTAMPTZ                 │
└──────────────────────────┴──────────────────────────────┘
```

---

## notifications

```
┌──────────────┬─────────────────────────────────────┐
│  id          │  UUID PK                            │
│  user_id     │  FK → users                         │
│  item_id     │  FK → compliance_items              │
│  type        │  overdue | due_soon | new_gap | ... │
│  channel     │  email | in_app                     │
│  sent_at     │  TIMESTAMPTZ                        │
│  read_at     │  TIMESTAMPTZ nullable               │
└──────────────┴─────────────────────────────────────┘
```

---

## audit_log

```
┌──────────────┬─────────────────────────────────────┐
│  id          │  UUID PK                            │
│  user_id     │  FK → users                         │
│  action      │  VARCHAR (e.g. re_evaluate)         │
│  entity_type │  compliance_item | document         │
│  entity_id   │  UUID                               │
│  metadata    │  JSONB (old/new values)             │
│  timestamp   │  TIMESTAMPTZ                        │
└──────────────┴─────────────────────────────────────┘
```

---

## Indexes (Important)

```
document_chunks(embedding)     — ivfflat for pgvector
requirements(embedding)        — ivfflat
compliance_items(session_id)   — btree
compliance_items(target_date)  — btree (alerts)
compliance_items(status)       — btree
```

---

## Summary

Eight tables cover the full compliance lifecycle: upload → points → compare → track → notify → audit. `compliance_items` is the central table for Excel and dashboard.
