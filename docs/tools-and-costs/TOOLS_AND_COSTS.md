# 💰 BCP - Tools, Technologies & Cost Analysis
**Version:** 1.0
**Date:** 2026-06-22

---

## 1. Complete Technology Stack with Cost Breakdown

### 🟢 FREE (Open Source / No Cost)

| Category | Tool/Technology | Purpose | License |
|----------|----------------|---------|---------|
| **Frontend Web** | React 18 | Web dashboard UI | MIT (Free) |
| **Frontend Web** | Vite | Build tool (fast) | MIT (Free) |
| **Frontend Web** | TypeScript | Type safety | Apache 2.0 (Free) |
| **Frontend Web** | TailwindCSS | Styling | MIT (Free) |
| **Frontend Web** | Recharts | Dashboard charts | MIT (Free) |
| **Frontend Web** | React Dropzone | File drag & drop upload | MIT (Free) |
| **Frontend Web** | TanStack Table | Data grid for compliance report | MIT (Free) |
| **Frontend Web** | Zustand | State management | MIT (Free) |
| **Mobile** | React Native | Mobile app framework | MIT (Free) |
| **Mobile** | Expo | React Native toolchain | MIT (Free) |
| **Mobile** | React Navigation | Mobile navigation | MIT (Free) |
| **Mobile** | React Native Document Picker | File selection on mobile | MIT (Free) |
| **Mobile** | React Native Chart Kit | Mobile dashboard charts | MIT (Free) |
| **Mobile** | Expo Notifications | Push notification client | MIT (Free) |
| **Backend** | Node.js 18+ | Server runtime | MIT (Free) |
| **Backend** | Express.js | HTTP framework | MIT (Free) |
| **Backend** | Prisma ORM | Database access layer | Apache 2.0 (Free) |
| **Backend** | BullMQ | Job queue (async processing) | MIT (Free) |
| **Backend** | ExcelJS | Excel report generation | MIT (Free) |
| **Backend** | Multer | File upload handling | MIT (Free) |
| **Backend** | JWT (jsonwebtoken) | Authentication tokens | MIT (Free) |
| **Backend** | Nodemailer | Email sending | MIT (Free) |
| **Backend** | Helmet + CORS | Security headers | MIT (Free) |
| **AI Engine** | Python 3.10+ | AI processing runtime | PSF (Free) |
| **AI Engine** | FastAPI | Python API server | MIT (Free) |
| **AI Engine** | pdfplumber | PDF text extraction | MIT (Free) |
| **AI Engine** | python-docx | Word doc extraction | MIT (Free) |
| **AI Engine** | openpyxl | Excel file reading | MIT (Free) |
| **AI Engine** | Tesseract OCR | Image text extraction (OCR) | Apache 2.0 (Free) |
| **AI Engine** | BeautifulSoup4 | HTML parsing | MIT (Free) |
| **AI Engine** | Sentence Transformers | Text embedding generation | Apache 2.0 (Free) |
| **AI Engine** | LangChain | LLM orchestration framework | MIT (Free) |
| **Database** | PostgreSQL 15+ | Primary relational database | PostgreSQL License (Free) |
| **Database** | pgvector extension | Vector storage for AI embeddings | PostgreSQL License (Free) |
| **Cache** | Redis 7+ | Caching & job queue backend | BSD (Free) |
| **DevOps** | Docker | Containerization | Apache 2.0 (Free) |
| **DevOps** | Git | Version control | GPL (Free) |
| **IDE** | Cursor | Development IDE | Free tier available |

### 🟡 FREE with PAID Optional Tiers

| Tool | Free Tier | Paid Tier | Our Recommendation |
|------|-----------|-----------|-------------------|
| **Firebase (FCM)** | Push notifications: FREE (unlimited) | Firestore, Auth: Pay-as-you-go | Use FREE tier for notifications only |
| **Expo** | Development & building: FREE | EAS Build: ~$99/mo for faster builds | Start with FREE, upgrade later |
| **AG Grid** | Community: FREE (basic grid) | Enterprise: ~$999/dev/year (advanced features) | Use TanStack Table (FREE) instead |

### 🔴 PAID Services (Use Only If Needed)

| Service | Provider | Cost | When To Use | Alternative (Free) |
|---------|----------|------|-------------|-------------------|
| **Cloud LLM** | OpenAI GPT-4o | ~$2.50 per 1M input tokens | If bank allows cloud AI | Ollama + Llama 3 (FREE, self-hosted) |
| **Cloud LLM** | Azure OpenAI | Same + Azure markup | Bank-approved cloud | Ollama + Llama 3 (FREE, self-hosted) |
| **Cloud LLM** | AWS Bedrock (Claude) | ~$3.00 per 1M tokens | AWS-hosted banks | Ollama + Llama 3 (FREE, self-hosted) |
| **Cloud OCR** | AWS Textract | ~$1.50 per 1000 pages | High accuracy OCR needed | Tesseract OCR (FREE) |
| **Cloud OCR** | Google Vision | ~$1.50 per 1000 pages | Very poor scan quality | Tesseract OCR (FREE) |
| **Vector DB** | Pinecone | Free tier: 1 index, then ~$25/mo | Cloud-managed vector search | pgvector (FREE extension) |
| **Email** | SendGrid | Free: 100/day, then ~$19.95/mo | If nodemailer is blocked | Nodemailer + bank SMTP (FREE) |
| **Hosting** | AWS / Azure | ~$200-500/mo (for bank-grade) | Production deployment | Bank's own servers (FREE) |

---

## 2. Cost Scenarios

### Scenario A: 100% Free (Self-Hosted On-Premise)
**Best for: Banks with strict data privacy requirements**

| Component | Solution | Cost |
|-----------|----------|------|
| AI/LLM | Ollama + Llama 3 (8B) | $0 (needs GPU server) |
| OCR | Tesseract | $0 |
| Vector DB | pgvector | $0 |
| Database | PostgreSQL | $0 |
| Email | Nodemailer + Bank SMTP | $0 |
| Push Notifications | Firebase FCM | $0 |
| **TOTAL SOFTWARE** | | **$0/month** |
| **HARDWARE** | GPU Server (RTX 4090) | **~$2,000 one-time** |

### Scenario B: Hybrid (Cloud AI, On-Premise Data)
**Best for: Banks with moderate flexibility**

| Component | Solution | Cost |
|-----------|----------|------|
| AI/LLM | Azure OpenAI (GPT-4o) | ~$50-200/month |
| OCR | AWS Textract | ~$15/month (10K pages) |
| Everything else | Self-hosted | $0 |
| **TOTAL** | | **~$65-215/month** |

### Scenario C: Full Cloud
**Best for: Quick deployment, less privacy concern**

| Component | Solution | Cost |
|-----------|----------|------|
| AI/LLM | OpenAI GPT-4o | ~$100-300/month |
| Hosting | AWS (EC2 + RDS) | ~$300-500/month |
| All services | Cloud | Pay-as-you-go |
| **TOTAL** | | **~$400-800/month** |

---

## 3. Recommended Stack for Banking (Our Choice)

> **We recommend Scenario A (100% Self-Hosted)** for banking because:
> - No sensitive bank documents leave the network
> - Zero recurring cloud costs
> - Full control over AI model behavior
> - Regulatory compliance is easier to prove

### Final Recommended Stack:
| Layer | Technology |
|-------|-----------|
| Frontend (Web) | React + Vite + TypeScript + TailwindCSS |
| Frontend (Mobile) | React Native + Expo |
| Backend API | Node.js + Express + TypeScript + Prisma |
| AI Engine | Python + FastAPI + LangChain + Ollama (Llama 3) |
| OCR | Tesseract + Pillow |
| Database | PostgreSQL + pgvector |
| Queue | Redis + BullMQ |
| Excel | ExcelJS (Node) |
| Notifications | Firebase FCM (free) + Nodemailer |
| Deployment | Docker + Docker Compose |

---

## 4. Hardware Requirements (For Self-Hosted AI)

### Development Machine
- CPU: Intel i7 / AMD Ryzen 7 or better
- RAM: 16 GB minimum (32 GB recommended)
- GPU: NVIDIA RTX 3060+ (for local Llama 3)
- Storage: 50 GB free SSD

### Production Server
- CPU: 8+ cores
- RAM: 32 GB minimum
- GPU: NVIDIA A100 / RTX 4090 (for fast AI inference)
- Storage: 500 GB SSD
- Network: Within bank's secure VLAN
