# 🚀 BCP - Deployment Guide
**Version:** 1.0
**Date:** 2026-06-22

---

## 1. Deployment Architecture

```
                    [Bank's Private Network / VLAN]
                              │
                    ┌─────────┴─────────┐
                    │   Nginx Reverse   │
                    │   Proxy (HTTPS)   │
                    │   Port 443        │
                    └─────────┬─────────┘
                              │
              ┌───────────────┼───────────────┐
              │               │               │
         [React Web]    [Node.js API]   [Python AI]
         Static Files    Port 4000      Port 8000
         (CDN/Nginx)          │               │
                              │               │
                    ┌─────────┴─────────┐     │
                    │   PostgreSQL      │     │
                    │   Port 5432       │     │
                    │   + pgvector      │─────┘
                    └───────────────────┘
                              │
                    ┌─────────┴─────────┐
                    │   Redis           │
                    │   Port 6379       │
                    └───────────────────┘
```

---

## 2. Docker Compose (Development)

File: `config/docker/docker-compose.yml`

```yaml
version: '3.8'
services:
  postgres:
    image: pgvector/pgvector:pg16
    environment:
      POSTGRES_DB: bcp_db
      POSTGRES_USER: bcp_user
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  backend:
    build: ../../apps/backend
    ports:
      - "4000:4000"
    depends_on:
      - postgres
      - redis
    environment:
      DATABASE_URL: postgresql://bcp_user:${DB_PASSWORD}@postgres:5432/bcp_db
      REDIS_URL: redis://redis:6379
      AI_ENGINE_URL: http://ai-engine:8000

  ai-engine:
    build: ../../apps/ai-engine
    ports:
      - "8000:8000"
    depends_on:
      - postgres
    volumes:
      - ../../apps/backend/uploads:/app/uploads

  web:
    build: ../../apps/web
    ports:
      - "3000:80"

  ollama:
    image: ollama/ollama
    ports:
      - "11434:11434"
    volumes:
      - ollama_data:/root/.ollama
    deploy:
      resources:
        reservations:
          devices:
            - capabilities: [gpu]

volumes:
  pgdata:
  ollama_data:
```

---

## 3. Production Checklist
- [ ] All environment variables set (no defaults)
- [ ] HTTPS certificates installed (TLS 1.3)
- [ ] Database backups scheduled (daily)
- [ ] Redis persistence configured
- [ ] File upload directory permissions set (non-public)
- [ ] Rate limiting configured
- [ ] Logging to centralized log system
- [ ] Health check endpoints verified
- [ ] Ollama model pre-downloaded (llama3)
- [ ] Firewall rules: Only ports 443 (HTTPS) exposed
- [ ] Docker containers running as non-root
- [ ] Security scan completed (npm audit, pip audit)
