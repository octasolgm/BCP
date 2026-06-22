# BCP - Bank Compliance Platform

## 🏦 Overview
Bank Compliance Platform (BCP) is an AI-powered regulatory compliance and gap analysis tool built for banking institutions. It automates the comparison of regulatory requirement documents against internal process documents to identify compliance gaps.

## 🎯 What Does This System Do?
1. **Upload** regulatory requirement files (PDF, HTML, JPEG, etc.)
2. **Upload** bank's internal process documents (Word, PDF, Excel, Email text)
3. **AI automatically compares** both sets of documents
4. **Generates** compliance report with 3 levels:
   - ✅ **Compliant** - Bank's process fully meets the requirement
   - ⚠️ **Partial Compliant** - Bank's process partially meets the requirement
   - ❌ **Non-Compliant** - Bank's process does not address the requirement
5. **Tracks** corrective actions with target dates and responsibilities
6. **Alerts** when deadlines are missed
7. **Dashboard** shows overall compliance health of the organization

## 🏗️ Project Structure (Monorepo)
```
bcp/
├── apps/
│   ├── web/              # React Web Dashboard (Admin Panel)
│   ├── mobile/           # React Native Mobile App (Alerts & Tasks)
│   ├── backend/          # Node.js/Express API Server
│   └── ai-engine/        # Python FastAPI (AI/ML Processing)
├── packages/
│   ├── shared-types/     # TypeScript types shared across apps
│   ├── shared-utils/     # Utility functions shared across apps
│   ├── shared-ui/        # Shared UI components (Web & Mobile)
│   ├── shared-constants/ # Constants, enums, config values
│   └── api-client/       # API client SDK for frontend apps
├── docs/                 # All documentation
├── config/               # Docker, Nginx, deployment configs
└── package.json          # Root monorepo config (npm workspaces)
```

## 🚀 Quick Start
```bash
# Install all dependencies
npm install

# Start web app
npm run dev:web

# Start mobile app
npm run dev:mobile

# Start backend
npm run dev:backend

# Start AI engine
cd apps/ai-engine && python -m uvicorn src.main:app --reload
```

## 📖 Documentation
- [Requirements Document](docs/requirements/REQUIREMENTS.md)
- [Architecture Document](docs/architecture/ARCHITECTURE.md)
- [Developer Guide](docs/developer-guide/DEVELOPER_GUIDE.md)
- [Security Guide](docs/security/SECURITY.md)
- [API Documentation](docs/api/API.md)
- [Tools & Costs](docs/tools-and-costs/TOOLS_AND_COSTS.md)
- [Deployment Guide](docs/deployment/DEPLOYMENT.md)
- [User Guide](docs/user-guide/USER_GUIDE.md)

## ⚖️ License
Proprietary - Confidential Banking Software
