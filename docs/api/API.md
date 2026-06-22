# 🔌 BCP - API Documentation
**Version:** 1.0
**Base URL:** `http://localhost:4000/api/v1`

---

## 1. Authentication

### POST /auth/login
Login and receive JWT tokens.
```json
// Request
{
  "email": "officer@bank.com",
  "password": "secure-password"
}

// Response 200
{
  "accessToken": "eyJhbGciOi...",
  "refreshToken": "eyJhbGciOi...",
  "user": {
    "id": "user-123",
    "name": "Ahmed Khan",
    "role": "compliance_officer"
  }
}
```

### POST /auth/refresh
Refresh expired access token.

### POST /auth/logout
Invalidate refresh token.

---

## 2. Documents

### POST /documents/upload
Upload a requirement or internal document.
```
Headers: Authorization: Bearer <token>
Content-Type: multipart/form-data

Body:
- file: <binary file>
- type: "requirement" | "internal"
- name: "Cabinet Decision No. 74"
- description: "UAE regulatory framework"
```

### GET /documents
List all uploaded documents.
```
Query params: ?type=requirement&page=1&limit=20
```

### GET /documents/:id
Get document details and extracted text.

### DELETE /documents/:id
Delete a document (Admin only).

---

## 3. Analysis

### POST /analysis/compare
Start a new compliance comparison.
```json
// Request
{
  "requirementDocId": "doc-001",
  "internalDocIds": ["doc-002", "doc-003"],
  "outputFormat": "detailed"
}

// Response 202 (Accepted - processing async)
{
  "sessionId": "session-789",
  "status": "processing",
  "estimatedTime": "120 seconds",
  "message": "Analysis started. Check status via GET /analysis/session-789"
}
```

### GET /analysis/:sessionId
Get analysis results.
```json
// Response 200
{
  "sessionId": "session-789",
  "status": "completed",
  "summary": {
    "totalItems": 25,
    "compliant": 18,
    "partialCompliant": 4,
    "nonCompliant": 3,
    "compliancePercentage": 72
  },
  "items": [
    {
      "id": "item-001",
      "requirementText": "Article 1 - Definitions...",
      "requirementArticle": "Article 1",
      "internalMatchText": "This is covered in UAE Implementation of TFS",
      "internalDocReference": "UAE Implementation of TFS, Section 1",
      "complianceLevel": "compliant",
      "aiJustification": "Internal document Section 1 contains all definitions...",
      "confidenceScore": 0.95,
      "targetDate": null,
      "actionPlan": null,
      "responsiblePerson": null
    },
    {
      "id": "item-002",
      "requirementText": "Article 5 - Sanctions Screening...",
      "requirementArticle": "Article 5",
      "internalMatchText": null,
      "internalDocReference": null,
      "complianceLevel": "non_compliant",
      "aiJustification": "No matching policy found for sanctions screening...",
      "confidenceScore": 0.88,
      "targetDate": null,
      "actionPlan": null,
      "responsiblePerson": null
    }
  ]
}
```

### POST /analysis/bulk
Upload and analyze multiple requirement files. (Step 2)

---

## 4. Compliance Items

### PATCH /compliance-items/:id
Update action plan for a compliance item.
```json
// Request
{
  "targetDate": "2026-06-30",
  "actionPlan": "Update policy Section 3 to include sanctions screening procedure",
  "responsiblePersonId": "user-456"
}
```

### POST /compliance-items/:id/remediation
Upload remediation document to mark item as compliant.
```
Content-Type: multipart/form-data
Body:
- file: <updated policy document>
- notes: "Added sanctions screening in Section 3"
```

---

## 5. Reports

### GET /reports/excel/:sessionId
Download compliance report as Excel file.

### GET /reports/dashboard
Get dashboard/MIS aggregate data.
```json
// Response 200
{
  "overall": {
    "compliant": 156,
    "partialCompliant": 32,
    "nonCompliant": 12,
    "totalItems": 200,
    "compliancePercentage": 78
  },
  "byRegulation": [
    {
      "name": "Cabinet Decision No. 74",
      "compliant": 18, "partial": 4, "nonCompliant": 3
    }
  ],
  "overdueActions": 5,
  "upcomingDeadlines": [
    { "itemId": "item-002", "dueDate": "2026-06-30", "daysLeft": 180 }
  ]
}
```

---

## 6. Alerts

### GET /alerts
Get user's alerts/notifications.

### PATCH /alerts/:id/read
Mark alert as read.

---

## 7. AI Engine Internal API
(Called by Node.js backend, not exposed to frontend)

**Base URL:** `http://localhost:8000`

### POST /extract
Extract text from uploaded file.

### POST /analyze
Compare requirement points against internal document embeddings.

### POST /embeddings/generate
Generate and store embeddings for a document.
