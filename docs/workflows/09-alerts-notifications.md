# 🔔 09 — Alerts & Notifications

Target date reminders, new gap alerts, resolution notifications.

---

## Alert Triggers

| Trigger | When |
|---------|------|
| Missed target date | `target_date < today` AND status ≠ closed |
| Approaching deadline | 3 days before target_date |
| New non-compliant item | After analysis completes |
| Item reassigned | responsibility field changes |
| Item resolved | Re-evaluation → Compliant |

---

## Architecture Box Diagram

```
┌─────────────────────────┐
│  NestJS Cron (daily)    │
│  @Cron('0 8 * * *')     │
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│  Query overdue +      │
│  due-soon items         │
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│  BullMQ job queue       │
│  (send emails async)    │
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│  Resend / SendGrid API  │
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│  INSERT notifications   │
│  + in-app bell icon     │
└─────────────────────────┘
```

---

## Alert Channels

```
📧 Email        — Resend or SendGrid (primary)
🔔 In-app       — notifications table + UI badge
📱 SMS/WhatsApp — Phase 2 optional
```

---

## notifications Table

```
id, user_id, item_id, type, channel, sent_at, read_at
```

Types: `overdue`, `due_soon`, `new_gap`, `resolved`, `reassigned`

---

## Email Content (Concept)

```
Subject: [BCP] Overdue: Article 12 — Asset Freeze

Body:
  Requirement: {requirement_text}
  Status: Non-Compliant
  Target Date: {target_date} (OVERDUE)
  Owner: {responsibility}
  Action: {corrective_action_plan}
  Link: {app_url}/analysis/{sessionId}
```

---

## Tech Stack

| Tool | Role |
|------|------|
| `@nestjs/schedule` | Cron jobs |
| BullMQ + Redis | Async email queue |
| Resend | Transactional email |

---

## When to Use

```
✅ Production — compliance deadlines are legally binding
✅ After CAP fields populated on partial/non items
```

---

## Summary

Alerts turn static Excel gaps into **active tracking**. Cron finds overdue items; email + in-app notify owners before audits fail.
