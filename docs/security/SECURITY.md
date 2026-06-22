# 🔒 BCP - Security Guide
**Version:** 1.0
**Date:** 2026-06-22
**Classification:** CONFIDENTIAL

---

## 1. Security Overview
This application handles sensitive banking regulatory documents and compliance data.
Security is NOT optional — it is a core requirement.

---

## 2. Authentication & Authorization

### 2.1 Authentication
- **Method:** JWT (JSON Web Tokens)
- **Access Token Expiry:** 15 minutes
- **Refresh Token Expiry:** 7 days
- **Password Hashing:** bcrypt with salt rounds = 12
- **MFA:** Two-Factor Authentication (TOTP) recommended for production

### 2.2 Role-Based Access Control (RBAC)

| Role | Upload Docs | View Reports | Assign Actions | Admin Settings | View Audit |
|------|:-----------:|:------------:|:--------------:|:--------------:|:----------:|
| Admin | ✅ | ✅ | ✅ | ✅ | ✅ |
| Compliance Officer | ✅ | ✅ | ✅ | ❌ | ✅ |
| Manager | ❌ | ✅ | ✅ | ❌ | ✅ |
| Viewer/Auditor | ❌ | ✅ | ❌ | ❌ | ✅ |

---

## 3. Data Security

### 3.1 Encryption
| Data State | Method | Standard |
|-----------|--------|----------|
| At Rest (Database) | AES-256 encryption | NIST approved |
| At Rest (Files) | AES-256 encrypted filesystem | NIST approved |
| In Transit | TLS 1.3 (HTTPS) | Industry standard |
| Passwords | bcrypt hash (irreversible) | OWASP recommended |

### 3.2 File Security
- All uploaded files stored outside web root
- File type validation (MIME type + magic bytes, not just extension)
- Maximum file size: 50 MB
- Virus scanning on upload (ClamAV recommended)
- No direct file URL access — all files served through authenticated API

### 3.3 Database Security
- Parameterized queries only (Prisma ORM prevents SQL injection)
- Database user has minimum required privileges
- Connection via SSL
- Regular automated backups (encrypted)

---

## 4. API Security
- CORS restricted to known frontend origins
- Rate limiting: 100 requests/minute per user
- Request size limit: 50 MB
- Helmet.js security headers enabled
- Input validation on all endpoints (Zod/Joi)
- No sensitive data in URL query parameters
- API versioning (/api/v1/)

---

## 5. Audit Trail
Every action is logged:
```json
{
  "timestamp": "2025-01-15T10:30:00Z",
  "userId": "user-123",
  "action": "UPLOAD_DOCUMENT",
  "entityType": "document",
  "entityId": "doc-456",
  "ipAddress": "10.0.1.50",
  "details": {
    "filename": "Cabinet_Decision_74.pdf",
    "fileSize": "2.4MB"
  }
}
```

---

## 6. AI/LLM Security
- **CRITICAL:** No bank documents should be sent to external cloud AI APIs
- Use self-hosted Ollama + Llama 3 for on-premise AI processing
- If cloud AI is approved by bank, use Azure OpenAI (data stays in Azure tenant)
- AI model inputs/outputs are logged for audit purposes
- AI results include confidence scores — human review required for low-confidence items

---

## 7. Infrastructure Security
- Application runs in bank's private VLAN
- No public internet access to backend services
- Web app served via reverse proxy (Nginx) with WAF
- Docker containers run as non-root users
- Regular security patches and dependency updates
- Penetration testing before production deployment

---

## 8. Compliance Checklist
- [ ] All data encrypted at rest and in transit
- [ ] RBAC implemented and tested
- [ ] Audit trail active for all operations
- [ ] No external API calls with sensitive data
- [ ] File upload validation and scanning
- [ ] JWT tokens with short expiry
- [ ] Rate limiting enabled
- [ ] CORS configured correctly
- [ ] SQL injection protection verified
- [ ] XSS protection headers set
- [ ] Regular backup procedure documented
- [ ] Incident response plan documented
