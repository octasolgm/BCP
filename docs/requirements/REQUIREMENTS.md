# 📋 BCP - Requirements Document
**Version:** 1.0
**Date:** 2026-06-22
**Client:** Banking Institution (UAE)
**Project:** Bank Compliance Platform

---

## 1. Project Overview

### 1.1 Business Problem
Banks are required to comply with multiple regulatory frameworks (e.g., UAE Cabinet Decisions, UN Security Council Resolutions, AML/CFT regulations). Currently, compliance officers manually read through hundreds of pages of regulatory requirements and compare them against internal bank policies. This is:
- **Time-consuming** (weeks of manual work)
- **Error-prone** (human mistakes in matching)
- **Hard to track** (no systematic follow-up on gaps)

### 1.2 Solution
An AI-powered platform that:
- Automatically extracts requirements from regulatory documents
- Compares them against bank's internal process documents
- Identifies gaps and compliance levels
- Tracks remediation actions
- Provides real-time dashboards

---

## 2. Functional Requirements

### 2.1 STEP 1 - Single File Analysis

| ID | Requirement | Priority | Description |
|----|-------------|----------|-------------|
| FR-001 | Multi-format file upload (Requirements) | HIGH | System must accept requirement files in PDF, HTML, JPEG, PNG formats |
| FR-002 | Multi-format file upload (Internal Docs) | HIGH | System must accept internal documents in Word (.docx), PDF, Excel (.xlsx), and plain text/email format |
| FR-003 | Point extraction from requirements | HIGH | AI must parse and extract individual requirement points/clauses from uploaded requirement files |
| FR-004 | Point extraction from internal docs | HIGH | AI must parse and extract individual process points from internal documents |
| FR-005 | Comparative analysis | HIGH | System must compare each requirement point against all internal document points to find matches |
| FR-006 | 3-level compliance status | HIGH | Each requirement must be classified as: Compliant, Partial Compliant, or Non-Compliant |
| FR-007 | Evidence mapping | HIGH | For Compliant/Partial items, system must show which internal document and section covers the requirement |
| FR-008 | Action plan columns | HIGH | For Partial/Non-Compliant items: Target Date, Corrective Action Plan, Responsibility columns |
| FR-009 | Excel export | HIGH | Full report downloadable as formatted Excel sheet matching client's template |
| FR-010 | MIS Dashboard | HIGH | Visual dashboard showing overall compliance percentages, charts, breakdowns |
| FR-011 | Status auto-update | MEDIUM | When corrective documents are uploaded, system re-evaluates and updates status |
| FR-012 | Alert system | MEDIUM | Push notifications and emails for missed target dates and pending actions |
| FR-013 | OCR capability | HIGH | Extract text from image-based documents (JPEG/PNG scans) |

### 2.2 STEP 2 - Bulk File Analysis

| ID | Requirement | Priority | Description |
|----|-------------|----------|-------------|
| FR-014 | Bulk upload | MEDIUM | Upload multiple requirement files simultaneously |
| FR-015 | Bulk analysis | MEDIUM | Process multiple files in background with progress tracking |
| FR-016 | Broader MIS | MEDIUM | Organization-wide dashboard showing compliance across all regulations |
| FR-017 | Department breakdown | LOW | Compliance view broken down by department/division |

---

## 3. Non-Functional Requirements

| ID | Requirement | Description |
|----|-------------|-------------|
| NFR-001 | Security | All data must be encrypted at rest and in transit. Bank-grade security (AES-256) |
| NFR-002 | Data Privacy | No document data should leave the bank's private network/cloud |
| NFR-003 | Performance | Single file analysis should complete within 2-5 minutes |
| NFR-004 | Scalability | Support bulk processing of 100+ files |
| NFR-005 | Availability | 99.9% uptime for web dashboard |
| NFR-006 | Audit Trail | Complete logging of all user actions and system decisions |
| NFR-007 | Role-based Access | Admin, Compliance Officer, Manager, Auditor roles |
| NFR-008 | Mobile Support | Core features accessible via mobile app |

---

## 4. Sample Data Format (Based on Client Sample)

### Input: Requirement File (Cabinet Decision No. 74)
```
Article 1 - Definitions
In the implementation of the provisions of this Decision...
The State: The United Arab Emirates
The Council: The Supreme Council for National Security
The Ministry: The Ministry of Foreign Affairs & International Cooperation
The Competent Court: The Court that has jurisdiction over State Security Offences
```

### Input: Internal Process Document
```
UAE Implementation of TFS - Bank Policy Document
Section 1: Definitions and Scope
[Bank's own definitions and how they map to regulations]
```

### Expected Output (Excel Format)
| Regulatory Requirement | UAE Response / Internal Document Reference | Compliance Level | Target Date | Action Plan | Responsibility |
|----------------------|-------------------------------------------|-----------------|-------------|-------------|----------------|
| Article 1 - Definitions... The State, The Council... | This is covered in UAE Implementation of TFS | Yes (Compliant) | - | - | - |
| Article 2 - Sanctions List... | NOT FOUND | No (Non-Compliant) | 30-Jun-2026 | Update policy Section 3 | Ahmed Khan |

---

## 5. User Stories

1. **As a Compliance Officer**, I want to upload a regulatory PDF and my bank's policy document, so the system tells me which rules we follow and which we don't.
2. **As a Compliance Officer**, I want to download the gap analysis as an Excel sheet, so I can share it with management.
3. **As a Manager**, I want to see a dashboard showing our overall compliance percentage, so I can make informed decisions.
4. **As a Manager**, I want to assign responsible persons and target dates for non-compliant items.
5. **As an Auditor**, I want to verify compliance evidence by clicking on a compliant item and seeing the source document.
6. **As a Compliance Officer**, I want to receive mobile alerts when target dates are approaching or missed.
7. **As an Admin**, I want to upload 50+ regulatory files at once and get a combined compliance report.

---

## 6. Acceptance Criteria
- [ ] System correctly identifies 90%+ of requirement points from PDF files
- [ ] Compliance classification accuracy is 85%+ compared to manual review
- [ ] Excel output matches the client's provided template format
- [ ] Dashboard loads within 3 seconds
- [ ] Alerts are sent within 1 hour of a missed deadline
- [ ] All data remains within the bank's infrastructure
