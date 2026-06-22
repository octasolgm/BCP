# 📅 BCP - Project Management & Roadmap
**Version:** 1.0
**Date:** 2026-06-22

---

## 1. Project Timeline (12 Weeks)

### Phase 1: Foundation & Setup (Weeks 1-2)
| Task | Owner | Status |
|------|-------|--------|
| Monorepo setup & documentation | Dev Lead | ✅ Done |
| PostgreSQL + pgvector database setup | Backend Dev | ⬜ Pending |
| Node.js backend skeleton (Express + Prisma) | Backend Dev | ⬜ Pending |
| Python AI engine skeleton (FastAPI) | AI Dev | ⬜ Pending |
| React web app skeleton (Vite + Router) | Frontend Dev | ⬜ Pending |
| Authentication (JWT + RBAC) | Backend Dev | ⬜ Pending |
| Docker Compose for local dev | DevOps | ⬜ Pending |
| Ollama + Llama 3 local setup | AI Dev | ⬜ Pending |

### Phase 2: Core Features - File Processing (Weeks 3-5)
| Task | Owner | Status |
|------|-------|--------|
| File upload API (multer + validation) | Backend Dev | ⬜ Pending |
| PDF text extraction (pdfplumber) | AI Dev | ⬜ Pending |
| Word/DOCX text extraction | AI Dev | ⬜ Pending |
| Excel text extraction | AI Dev | ⬜ Pending |
| OCR for images (Tesseract) | AI Dev | ⬜ Pending |
| HTML parsing | AI Dev | ⬜ Pending |
| Requirement point extraction (AI) | AI Dev | ⬜ Pending |
| Embedding generation + pgvector storage | AI Dev | ⬜ Pending |
| React file upload UI (drag & drop) | Frontend Dev | ⬜ Pending |

### Phase 3: Comparison Engine & Reports (Weeks 6-8)
| Task | Owner | Status |
|------|-------|--------|
| Semantic search (requirement vs internal) | AI Dev | ⬜ Pending |
| LLM compliance evaluation (3 levels) | AI Dev | ⬜ Pending |
| Compliance results API | Backend Dev | ⬜ Pending |
| Compliance grid UI (TanStack Table) | Frontend Dev | ⬜ Pending |
| Action plan assignment (forms) | Frontend Dev | ⬜ Pending |
| Excel report generation (ExcelJS) | Backend Dev | ⬜ Pending |
| Dashboard charts (Recharts) | Frontend Dev | ⬜ Pending |
| Async job queue (BullMQ + Redis) | Backend Dev | ⬜ Pending |

### Phase 4: Alerts & Mobile App (Weeks 9-10)
| Task | Owner | Status |
|------|-------|--------|
| Email alerts (Nodemailer) | Backend Dev | ⬜ Pending |
| Push notifications (Firebase FCM) | Backend Dev | ⬜ Pending |
| Deadline checker CRON job | Backend Dev | ⬜ Pending |
| React Native app setup (Expo) | Mobile Dev | ⬜ Pending |
| Mobile dashboard screen | Mobile Dev | ⬜ Pending |
| Mobile task list & detail screens | Mobile Dev | ⬜ Pending |
| Mobile document upload (camera/picker) | Mobile Dev | ⬜ Pending |
| Remediation upload + re-analysis flow | Full Stack | ⬜ Pending |

### Phase 5: Bulk Processing & Polish (Weeks 11-12)
| Task | Owner | Status |
|------|-------|--------|
| Bulk file upload UI | Frontend Dev | ⬜ Pending |
| Bulk processing pipeline | AI Dev | ⬜ Pending |
| Organization-wide MIS dashboard | Frontend Dev | ⬜ Pending |
| Security hardening & audit | All | ⬜ Pending |
| Performance testing | QA | ⬜ Pending |
| User acceptance testing (UAT) | QA + Client | ⬜ Pending |
| Documentation finalization | Dev Lead | ⬜ Pending |
| Production deployment | DevOps | ⬜ Pending |

---

## 2. Team Structure

| Role | Count | Responsibilities |
|------|-------|-----------------|
| Project Lead / Dev Lead | 1 | Architecture, code review, client communication |
| Backend Developer | 1 | Node.js API, database, auth, Excel generation |
| AI/ML Developer | 1 | Python engine, LLM integration, document parsing |
| Frontend Developer | 1 | React web dashboard, shared UI components |
| Mobile Developer | 1 | React Native app (can be same as Frontend dev) |
| QA / Tester | 1 | Testing, UAT coordination |

**Minimum Team:** 3 developers (1 Full-stack, 1 Backend+AI, 1 Frontend+Mobile)

---

## 3. Risk Register

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| AI accuracy below 85% | HIGH | MEDIUM | Use GPT-4o level model, add human review step |
| Bank blocks cloud AI calls | HIGH | HIGH | Default to Ollama (self-hosted) from Day 1 |
| Complex PDF table extraction fails | MEDIUM | MEDIUM | Fallback to AWS Textract for complex docs |
| File size too large for processing | LOW | LOW | Implement chunking and streaming |
| Team member unavailable | MEDIUM | LOW | Document everything, code reviews, shared knowledge |
