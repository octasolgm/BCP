# 🏗️ BCP - Architecture Document
**Version:** 1.0
**Date:** 2026-06-22

---

## 1. High-Level Architecture Diagram (Text)

```
┌─────────────────────────────────────────────────────────────────────┐
│                        PRESENTATION LAYER                          │
│                                                                     │
│  ┌─────────────────────┐         ┌─────────────────────────┐       │
│  │   React Web App     │         │  React Native Mobile    │       │
│  │   (Dashboard,       │         │  (Alerts, Tasks,        │       │
│  │    Uploads,         │         │   Quick Dashboard)      │       │
│  │    Reports,         │         │                         │       │
│  │    Excel Export)    │         │                         │       │
│  └─────────┬───────────┘         └────────────┬────────────┘       │
│            │                                   │                    │
│            └───────────────┬───────────────────┘                    │
│                            │                                        │
│                   Shared Packages                                   │
│            (shared-types, shared-utils,                             │
│             shared-ui, api-client)                                  │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             │ HTTPS / REST API
                             │
┌────────────────────────────┼────────────────────────────────────────┐
│                        API GATEWAY LAYER                            │
│                            │                                        │
│  ┌─────────────────────────┴─────────────────────────────────┐     │
│  │              Node.js / Express Backend                     │     │
│  │                                                            │     │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐ │     │
│  │  │ Auth     │ │ File     │ │ Report   │ │ Alert        │ │     │
│  │  │ Module   │ │ Upload   │ │ Module   │ │ Module       │ │     │
│  │  │ (JWT)    │ │ Module   │ │ (Excel)  │ │ (FCM/Email)  │ │     │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────────┘ │     │
│  │                                                            │     │
│  │  ┌──────────┐ ┌──────────────┐ ┌────────────────────────┐│     │
│  │  │ RBAC     │ │ Compliance   │ │ Dashboard/MIS          ││     │
│  │  │ Module   │ │ Tracker      │ │ Aggregation            ││     │
│  │  └──────────┘ └──────────────┘ └────────────────────────┘│     │
│  └──────────────────────┬────────────────────────────────────┘     │
│                         │                                           │
└─────────────────────────┼───────────────────────────────────────────┘
                          │
              ┌───────────┼────────────┐
              │           │            │
              ▼           ▼            ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────────────────────────┐
│  PostgreSQL  │ │    Redis     │ │       AI ENGINE LAYER            │
│  Database    │ │  (Queue &    │ │                                  │
│              │ │   Cache)     │ │  ┌────────────────────────────┐  │
│ - Users      │ │              │ │  │   Python FastAPI Server    │  │
│ - Documents  │ │ - Job Queue  │ │  │                            │  │
│ - Compliance │ │ - Sessions   │ │  │  ┌──────────────────────┐  │  │
│   Items      │ │ - Rate Limit │ │  │  │ Document Extractors  │  │  │
│ - Actions    │ │              │ │  │  │ - PDF Parser         │  │  │
│ - Alerts     │ └──────────────┘ │  │  │ - DOCX Parser        │  │  │
│ - Audit Logs │                  │  │  │ - Excel Parser       │  │  │
│              │                  │  │  │ - OCR (Tesseract)    │  │  │
│ + pgvector   │                  │  │  │ - HTML Parser        │  │  │
│   extension  │                  │  │  └──────────────────────┘  │  │
│ (embeddings) │                  │  │                            │  │
└──────────────┘                  │  │  ┌──────────────────────┐  │  │
                                  │  │  │ AI Analysis Engine   │  │  │
                                  │  │  │ - Text Embeddings    │  │  │
                                  │  │  │ - Semantic Search    │  │  │
                                  │  │  │ - LLM Comparison     │  │  │
                                  │  │  │ - Compliance Scoring │  │  │
                                  │  │  └──────────────────────┘  │  │
                                  │  │                            │  │
                                  │  │  ┌──────────────────────┐  │  │
                                  │  │  │ LLM Provider         │  │  │
                                  │  │  │ (Ollama/Llama 3 or   │  │  │
                                  │  │  │  OpenAI via Azure)   │  │  │
                                  │  │  └──────────────────────┘  │  │
                                  │  └────────────────────────────┘  │
                                  └──────────────────────────────────┘
```

---

## 2. Data Flow

```
User uploads Requirement PDF + Internal Process Doc
         │
         ▼
    [Node.js Backend]
    - Validates files
    - Stores in secure storage
    - Creates DB record
    - Sends to Redis job queue
         │
         ▼
    [AI Engine (Python)]
    - Extracts text from files (PDF/DOCX/OCR)
    - Splits into requirement points
    - Generates embeddings (vectors)
    - Stores vectors in pgvector
    - For each requirement point:
      ├── Semantic search in internal docs
      ├── LLM evaluates match quality
      ├── Returns: Compliant / Partial / Non-Compliant
      └── Returns: Evidence text & justification
         │
         ▼
    [Node.js Backend]
    - Stores results in PostgreSQL
    - Generates Excel report
    - Updates dashboard data
    - Sends response to frontend
         │
         ▼
    [React Web / React Native]
    - Displays results in grid/table
    - Shows dashboard charts
    - Allows Excel download
    - Allows action assignment
```

---

## 3. Database Schema (Key Tables)

```sql
-- Users & Auth
users (id, email, name, role, department, created_at)

-- Uploaded Documents
documents (id, user_id, type[requirement|internal], 
           filename, format, file_path, extracted_text, 
           status[processing|ready|error], created_at)

-- Analysis Sessions
analysis_sessions (id, user_id, requirement_doc_id, 
                   internal_doc_ids[], status, created_at)

-- Individual Compliance Items
compliance_items (id, session_id, requirement_text, 
                  requirement_article, internal_match_text,
                  internal_doc_reference, compliance_level[compliant|partial|non_compliant],
                  ai_justification, confidence_score,
                  target_date, action_plan, responsible_person_id,
                  remediation_doc_id, remediation_status,
                  created_at, updated_at)

-- Alerts
alerts (id, compliance_item_id, user_id, alert_type[deadline|overdue|reminder],
        message, is_read, sent_at, created_at)

-- Audit Logs
audit_logs (id, user_id, action, entity_type, entity_id,
            details_json, ip_address, created_at)
```

---

## 4. Component Architecture

### 4.1 React Web App (apps/web)
```
src/
├── pages/
│   ├── Login.tsx
│   ├── Dashboard.tsx          # MIS Charts & Metrics
│   ├── UploadAnalysis.tsx     # Upload & Compare files
│   ├── ComplianceReport.tsx   # Grid view with status
│   ├── ActionTracker.tsx      # Track remediation actions
│   ├── BulkUpload.tsx         # Step 2: Bulk file processing
│   ├── Settings.tsx           # User, roles management
│   └── AuditLog.tsx           # Activity history
├── components/
│   ├── FileUploader.tsx       # Drag & drop zone
│   ├── ComplianceGrid.tsx     # AG Grid / TanStack Table
│   ├── ComplianceChart.tsx    # Pie/Bar charts
│   ├── AlertBanner.tsx        # Notification banners
│   ├── ExcelExportButton.tsx  # Download trigger
│   └── StatusBadge.tsx        # Compliant/Partial/Non badges
├── services/
│   ├── authService.ts
│   ├── documentService.ts
│   ├── analysisService.ts
│   └── alertService.ts
└── store/
    └── (Zustand or Redux Toolkit)
```

### 4.2 React Native App (apps/mobile)
```
src/
├── screens/
│   ├── LoginScreen.tsx
│   ├── DashboardScreen.tsx    # Simplified compliance overview
│   ├── TaskListScreen.tsx     # My pending actions
│   ├── TaskDetailScreen.tsx   # Upload remediation doc
│   ├── AlertsScreen.tsx       # All notifications
│   └── SettingsScreen.tsx
├── components/
│   ├── ComplianceCard.tsx
│   ├── MiniChart.tsx
│   ├── AlertItem.tsx
│   └── DocumentPicker.tsx
└── navigation/
    └── AppNavigator.tsx
```

---

## 5. Shared Packages Detail

### packages/shared-types
```typescript
// Compliance levels enum
export enum ComplianceLevel {
  COMPLIANT = 'compliant',
  PARTIAL = 'partial_compliant', 
  NON_COMPLIANT = 'non_compliant'
}

// Document types
export interface ComplianceItem {
  id: string;
  requirementText: string;
  internalMatchText: string | null;
  complianceLevel: ComplianceLevel;
  targetDate: Date | null;
  actionPlan: string | null;
  responsiblePerson: string | null;
  aiJustification: string;
  confidenceScore: number;
}
```

### packages/shared-utils
- Date formatting functions
- File validation helpers
- Compliance percentage calculators
- Excel column mappers

### packages/shared-ui
- StatusBadge (renders green/yellow/red based on compliance)
- ProgressBar
- CompliancePercentage display
- Common form inputs

---

## 6. Security Architecture
- JWT tokens with short expiry (15 min access, 7 day refresh)
- All API endpoints behind authentication middleware
- File uploads scanned for malware
- Database encrypted at rest (AES-256)
- HTTPS only (TLS 1.3)
- Role-Based Access Control (RBAC)
- Complete audit trail logging
- No sensitive data in client-side storage
- CORS restricted to known domains
