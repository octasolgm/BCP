# 👨‍💻 BCP - Developer Guide
**Version:** 1.0
**Date:** 2026-06-22

---

## 1. Prerequisites

### Required Software
| Software | Version | Purpose | Download |
|----------|---------|---------|----------|
| Node.js | >= 18.x | Backend + Frontend runtime | https://nodejs.org |
| npm | >= 9.x | Package manager | Comes with Node.js |
| Python | >= 3.10 | AI Engine | https://python.org |
| PostgreSQL | >= 15 | Primary database | https://postgresql.org |
| Redis | >= 7.x | Job queue & caching | https://redis.io |
| Git | >= 2.x | Version control | https://git-scm.com |
| Cursor IDE | Latest | Development IDE | https://cursor.sh |

### Optional Software
| Software | Purpose |
|----------|---------|
| Docker Desktop | Containerized deployment |
| Ollama | Local LLM runner (for on-premise AI) |
| Postman | API testing |

---

## 2. First Time Setup

### 2.1 Clone & Install
```bash
cd C:\Users\Hp\Documents\GitHub
git clone <repo-url> bcp
cd bcp
npm install
```

### 2.2 Environment Variables
Create `.env` files in each app:

**apps/backend/.env**
```env
NODE_ENV=development
PORT=4000
DATABASE_URL=postgresql://user:password@localhost:5432/bcp_db
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-super-secret-key-change-in-production
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
AI_ENGINE_URL=http://localhost:8000
UPLOAD_DIR=./uploads
GENERATED_DIR=./generated
MAX_FILE_SIZE_MB=50
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=alerts@bank.com
SMTP_PASS=xxx
FCM_SERVER_KEY=your-firebase-key
```

**apps/ai-engine/.env**
```env
ENVIRONMENT=development
DATABASE_URL=postgresql://user:password@localhost:5432/bcp_db
LLM_PROVIDER=ollama
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3
# OR for cloud (NOT recommended for banking)
# LLM_PROVIDER=openai
# OPENAI_API_KEY=sk-xxx
EMBEDDING_MODEL=all-MiniLM-L6-v2
TESSERACT_PATH=C:/Program Files/Tesseract-OCR/tesseract.exe
```

**apps/web/.env**
```env
VITE_API_URL=http://localhost:4000/api
VITE_APP_NAME=BCP - Bank Compliance Platform
```

### 2.3 Database Setup
```bash
# Create database
psql -U postgres -c "CREATE DATABASE bcp_db;"

# Enable pgvector extension (for AI embeddings)
psql -U postgres -d bcp_db -c "CREATE EXTENSION IF NOT EXISTS vector;"

# Run migrations (after setting up backend)
cd apps/backend
npx prisma migrate dev
```

### 2.4 Python AI Engine Setup
```bash
cd apps/ai-engine
python -m venv venv
# Windows
.\venv\Scripts\activate
# Install dependencies
pip install -r requirements.txt
# Download OCR language data
# Download embedding model (first run will auto-download)
```

### 2.5 Running the Apps
```bash
# Terminal 1: Backend API
npm run dev:backend

# Terminal 2: AI Engine
cd apps/ai-engine && .\venv\Scripts\activate && uvicorn src.main:app --reload --port 8000

# Terminal 3: Web Dashboard
npm run dev:web

# Terminal 4: Mobile (requires Expo)
npm run dev:mobile
```

---

## 3. Code Standards

### 3.1 TypeScript
- Strict mode enabled
- No `any` types (use shared-types package)
- Functional components with hooks (React)
- Named exports preferred

### 3.2 Git Workflow
```
main          ← Production-ready code only
├── develop   ← Integration branch
│   ├── feature/FR-001-file-upload
│   ├── feature/FR-005-comparison-engine
│   └── fix/login-token-expiry
```

### 3.3 Commit Message Format
```
feat(web): add file upload drag-and-drop component
fix(backend): resolve JWT refresh token race condition
docs: update API documentation for /analyze endpoint
chore: upgrade React Native to 0.73
```

---

## 4. Project Architecture Quick Reference

| Layer | Tech | Port | Purpose |
|-------|------|------|---------|
| Web Frontend | React + Vite + TypeScript | 5173 | Admin dashboard, uploads, reports |
| Mobile App | React Native + Expo | 8081 | Alerts, task tracking, quick dashboard |
| Backend API | Node.js + Express + TypeScript | 4000 | REST API, auth, file management |
| AI Engine | Python + FastAPI | 8000 | Document parsing, AI comparison |
| Database | PostgreSQL + pgvector | 5432 | Data storage + vector embeddings |
| Cache/Queue | Redis + BullMQ | 6379 | Job queue for async processing |

---

## 5. Key Libraries by App

### apps/web (React)
- `react` + `react-dom` - UI framework
- `react-router-dom` - Routing
- `@tanstack/react-table` or `ag-grid-react` - Data grids
- `recharts` - Dashboard charts
- `react-dropzone` - File upload
- `zustand` or `@reduxjs/toolkit` - State management
- `axios` - HTTP client
- `tailwindcss` - Styling

### apps/mobile (React Native)
- `react-native` + `expo` - Mobile framework
- `@react-navigation/native` - Navigation
- `react-native-document-picker` - File selection
- `react-native-chart-kit` - Charts
- `expo-notifications` - Push notifications
- `zustand` - State management

### apps/backend (Node.js)
- `express` - HTTP server
- `prisma` - Database ORM
- `bullmq` - Job queue
- `jsonwebtoken` - JWT auth
- `multer` - File upload handling
- `exceljs` - Excel generation
- `nodemailer` - Email alerts
- `firebase-admin` - Push notifications
- `helmet` + `cors` - Security

### apps/ai-engine (Python)
- `fastapi` + `uvicorn` - API server
- `pdfplumber` - PDF text extraction
- `python-docx` - Word document parsing
- `openpyxl` - Excel reading
- `pytesseract` + `Pillow` - OCR for images
- `beautifulsoup4` - HTML parsing
- `sentence-transformers` - Text embeddings
- `langchain` - LLM orchestration
- `psycopg2` - PostgreSQL connection
- `ollama` - Local LLM client
