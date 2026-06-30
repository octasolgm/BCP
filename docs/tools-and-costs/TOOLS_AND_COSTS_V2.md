# 💰 BCP - Tools & Costs V2 (Practical Server Buying Guide)

**Version:** 2.1  
**Date:** 2026-06-22  
**For:** People who do NOT own a physical server and need to **rent** server space online

> **Note:** Prices below are from provider websites as of **June 2026**. Prices change. Always confirm on the provider site before you pay.

---

## Who This Doc Is For

You don't own a physical server. You need to **RENT server space online** (pay monthly or yearly). This guide tells you:

1. **What** to buy  
2. **Where** to buy it (real company names + links)  
3. **Which plan** to pick  
4. **How much** it costs per month  
5. **What to install** after the server is ready  

You do **not** need to be a DevOps expert. Think of it like renting an apartment for your app — you pay rent, you get a key (SSH login), you move your software in.

---

## The Big Picture (Simple Diagram)

```
YOU (Compliance Officer / Developer)
        │
        │  Opens browser or mobile app
        ▼
┌───────────────────────────────────────────────────────────┐
│  YOUR RENTED SERVER (in a data center somewhere)          │
│                                                           │
│   ┌─────────────┐    ┌─────────────┐    ┌─────────────┐  │
│   │  Web App    │    │  Backend    │    │  AI Engine  │  │
│   │  (React)    │───▶│  (Node.js)  │───▶│  (Python)   │  │
│   │  Port 443   │    │  Port 4000  │    │  Port 8000  │  │
│   └─────────────┘    └──────┬──────┘    └──────┬──────┘  │
│                             │                   │         │
│                      ┌──────┴──────┐     ┌──────┴──────┐  │
│                      │ PostgreSQL  │     │   Ollama    │  │
│                      │ + pgvector  │     │  (Llama 3)  │  │
│                      │ Port 5432   │     │  NEEDS GPU  │  │
│                      └─────────────┘     └─────────────┘  │
│                             │                             │
│                      ┌──────┴──────┐                      │
│                      │    Redis    │                      │
│                      │  Port 6379  │                      │
│                      └─────────────┘                      │
└───────────────────────────────────────────────────────────┘
        │
        │  You pay the hosting company every month
        ▼
   Hetzner / Contabo / DigitalOcean / RunPod  (examples)
```

**One sentence summary:** You rent a powerful computer in the cloud. BCP runs on that computer. Bank documents stay on that computer (not sent to ChatGPT).

---

## The Golden Rule

```
You pay ONE bill: Server rental
Everything else: FREE software you install
```

| You pay for | You do NOT pay for |
|-------------|-------------------|
| Server rental (monthly) | PostgreSQL, Redis, Node.js, Python |
| Domain name (~$12/year) | Ollama, Llama 3, Tesseract OCR |
| Optional backups (~$5–20/mo) | Docker, Nginx, React, FastAPI |
| One-time GPU setup fee (some providers) | Firebase push notifications (free tier) |

All BCP software is **open-source**. You install it yourself (or your developer does) on the rented server.

---

## Two Critical Questions Before Buying

### Question 1: Do I need GPU?

GPU (graphics card) makes AI fast. Without GPU, AI works but is slow.

| Without GPU (CPU only) | With GPU |
|------------------------|----------|
| AI takes **60–90 seconds** per request | AI takes **5–10 seconds** per request |
| Server cost: **$20–50/month** | Server cost: **$200–500/month** |
| Good for: Testing, demo, small pilot | Good for: Production, many users |

**Recommendation:**
- **Start without GPU** for development and demo  
- **Upgrade to GPU** when going to production  

### Question 2: How big is the bank?

| Bank Size | Documents/Day | Server Size |
|-----------|---------------|-------------|
| Small (testing) | 1–10 | **~$9–20/month** |
| Medium | 50–200 | **~$80–150/month** |
| Large (production) | 500+ | **~$300–500/month** |

---

## RECOMMENDED PROVIDERS (Where to Buy)

### Tier 1: BEST VALUE — Hetzner (Germany) ⭐⭐⭐⭐⭐

**Website:** https://www.hetzner.com

**Why best:**
- Cheapest quality servers in the market  
- Excellent reliability (German engineering)  
- European data centers (often acceptable for UAE/EU compliance POCs)  
- Used by serious developers worldwide  

**Plans we recommend:**

| Plan Name | RAM | CPU | Storage | Price/Month | Use Case |
|-----------|-----|-----|---------|-------------|----------|
| CX22 / CX23 | 4 GB | 2 vCPU | 40 GB | **~€5–6** (~$6) | Development/Testing |
| CX32 / CX33 | 8 GB | 4 vCPU | 80 GB | **~€8–9** (~$9) | Small bank pilot |
| CX42 / CX43 | 16 GB | 8 vCPU | 160 GB | **~€16–18** (~$19) | Medium bank |
| CCX23 (Dedicated CPU) | 16 GB | 4 vCPU | 160 GB | **~€31–86** (~$33–95) | Production small |
| CCX33 (Dedicated CPU) | 32 GB | 8 vCPU | 240 GB | **~€60–139** (~$65–155) | Production medium |
| **GPU Server GEX44** | 64 GB | 16 vCPU + **RTX 4000 Ada** | 1.9 TB | **~€184–253** (~$200–275) | Production with fast AI |

> Plan names changed in June 2026. Check hetzner.com/cloud for current CX/CPX/CCX names.

**How to buy:**
1. Go to **hetzner.com** → Sign up (credit card required)  
2. Click **Cloud** → **Add Server**  
3. Location: **Nuremberg** or **Falkenstein** (Germany)  
4. Image: **Ubuntu 24.04**  
5. Plan: Start with **CX33** (~$9/month) for testing  
6. Click **Create & Buy**  
7. Server IP + root password in **~30 seconds**  

For GPU: go to **Dedicated Server → GPU → GEX44** (takes 1–48 hours to provision).

---

### Tier 2: GREAT VALUE — Contabo (Germany) ⭐⭐⭐⭐

**Website:** https://contabo.com

**Why good:**
- Very cheap  
- Big RAM and storage included  
- Good for AI workloads (more RAM per dollar)  

**Plans we recommend:**

| Plan | RAM | CPU | Storage | Price/Month | Use Case |
|------|-----|-----|---------|-------------|----------|
| VPS 10 (S) | 8 GB | 4 vCPU | 75–150 GB | **~$5–7** | Testing |
| VPS 20 (M) | 12 GB | 6 vCPU | 100–200 GB | **~$7–9** | Pilot |
| VPS 30 (L) | 24 GB | 8 vCPU | 200–400 GB | **~$14–17** | Production small |
| VPS 40 (XL) | 48 GB | 12 vCPU | 250–500 GB | **~$24–30** | Production medium |
| Cloud GPU | 64 GB | 12 vCPU + NVIDIA GPU | 200 GB | **~$199** | Production with AI |

**How to buy:**
1. Go to **contabo.com** → Sign up  
2. Choose **Cloud VPS** plan  
3. Select **Ubuntu 22.04 or 24.04 LTS**  
4. Pay with card/PayPal  
5. Server ready within **~1 hour**  

---

### Tier 3: PREMIUM (Easy to use) — DigitalOcean ⭐⭐⭐

**Website:** https://www.digitalocean.com

**Why use:**
- Easiest interface for beginners  
- Great documentation  
- US/Asia data centers  
- **3–4× more expensive** than Hetzner  

**Plans we recommend:**

| Plan | RAM | CPU | Storage | Price/Month | Use Case |
|------|-----|-----|---------|-------------|----------|
| Basic Droplet | 4 GB | 2 vCPU | 80 GB | **$24** | Development |
| Basic Droplet | 8 GB | 4 vCPU | 160 GB | **$48** | Pilot |
| CPU-Optimized | 16 GB | 8 vCPU | 200 GB | **$168** | Production |
| GPU Droplet (RTX 4000) | — | — | — | **$0.76/hr** (~**$555/mo** 24/7) | AI production |
| GPU Droplet (H100) | 240 GB | 20 vCPU + GPU | 720 GB | **$3.39/hr** (~**$2,450/mo**) | Heavy enterprise AI |

**Note:** DigitalOcean is easier but costs much more than Hetzner/Contabo for the same specs.

---

### Tier 4: GPU SPECIALIST — RunPod ⭐⭐⭐⭐⭐ (For AI Only)

**Website:** https://runpod.io

**Why use for AI:**
- Specialist GPU provider  
- **Pay per hour** (stop when not using = save money)  
- Cheapest flexible GPU rentals  
- Perfect for running **Ollama + Llama 3**  

**GPU Plans:**

| GPU | VRAM | Price/Hour | Monthly (24/7) | Use Case |
|-----|------|-----------|----------------|----------|
| RTX 3090 | 24 GB | **$0.22/hr** | **~$158/mo** | Small AI |
| RTX 4090 | 24 GB | **$0.34/hr** | **~$245/mo** | Production AI |
| A40 | 48 GB | **$0.39/hr** | **~$281/mo** | Heavy AI |
| A100 80GB | 80 GB | **$1.19/hr** | **~$857/mo** | Enterprise AI |

**Smart trick — GPU only during business hours:**
- Business hours (8 AM – 8 PM) = 12 hours/day  
- RTX 4090: $0.34 × 12 × 30 = **~$122/month** (less than half of 24/7!)  
- Good if compliance officers only work daytime  

**Architecture with RunPod:** Rent a cheap VPS ($9/mo) for web + database, and RunPod GPU only for AI engine.

---

## COMPLETE COST SCENARIOS (What You'll Actually Pay)

### Scenario 1: DEVELOPMENT / DEMO (~$9/month) 💰

**Use case:** Building the app, showing to clients, no real users yet  

| Item | Provider | Plan | Cost |
|------|----------|------|------|
| Server | Hetzner Cloud | CX33 (8 GB RAM) | **~$9/mo** |
| Domain | Cloudflare | Optional for dev | **$0** (use IP address) |
| SSL | Let's Encrypt | Free | **$0** |
| AI | Ollama on CPU | Slow but works | **$0** |
| Software | All open-source | Docker stack | **$0** |

**Total: ~$9/month**

**What you get:** Full BCP stack running. One document analysis takes 2–5 minutes (CPU). Fine for demos.

---

### Scenario 2: SMALL BANK PILOT (~$19–35/month) 💰💰

**Use case:** 1–10 documents/day, 5–20 compliance officers testing  

| Item | Provider | Plan | Cost |
|------|----------|------|------|
| Server | Hetzner CX43 OR Contabo VPS 30 | 16–24 GB RAM | **~$15–19/mo** |
| Domain | Cloudflare | `.com` domain | **~$1/mo** ($12/year) |
| SSL | Let's Encrypt | Free | **$0** |
| Backups | Hetzner snapshot | Weekly | **~$5/mo** |
| AI | Ollama CPU | Acceptable for low volume | **$0** |

**Total: ~$20–35/month**

---

### Scenario 3: MEDIUM BANK PRODUCTION (~$65–150/month) 💰💰💰

**Use case:** 50–200 documents/day, dedicated CPU, no GPU yet  

| Item | Provider | Plan | Cost |
|------|----------|------|------|
| Server | Hetzner CCX33 OR Contabo VPS 40 | 32–48 GB RAM | **~$65–90/mo** |
| Domain + DNS | Cloudflare | Production domain | **~$1/mo** |
| SSL | Let's Encrypt | Free | **$0** |
| Backups | Automated `pg_dump` + storage | Daily | **~$10–15/mo** |
| Firebase FCM | Push notifications | Free tier | **$0** |
| AI | Ollama CPU | 60–90 sec per analysis | **$0** |

**Total: ~$75–105/month**

**Upgrade path:** Add RunPod RTX 4090 business-hours (~$122/mo) when AI speed becomes painful.

---

### Scenario 4: PRODUCTION WITH FAST AI (~$275–400/month) 💰💰💰💰 ⭐ RECOMMENDED

**Use case:** Real bank production, fast AI, all-in-one server  

| Item | Provider | Plan | Cost |
|------|----------|------|------|
| GPU Server | **Hetzner GEX44** | 64 GB RAM + RTX 4000 Ada | **~$200–275/mo** |
| Setup fee (one-time) | Hetzner | First order only | **~$615 once** |
| Domain | Cloudflare | Bank subdomain | **~$1/mo** |
| SSL | Let's Encrypt | Free | **$0** |
| Backups | Snapshots + off-site | Daily | **~$15–20/mo** |
| All software | Docker + Ollama + BCP | Free | **$0** |

**Total ongoing: ~$220–300/month** (after setup fee)

**What you get:** Everything on one machine. AI analysis in **5–10 seconds**. Documents never leave server.

**Alternative (split architecture):**

| Item | Cost |
|------|------|
| Hetzner CX43 (app + DB) | ~$19/mo |
| RunPod RTX 4090 (12 hrs/day) | ~$122/mo |
| **Total** | **~$141/mo** |

---

### Scenario 5: UAE ENTERPRISE BANK (~$800–2,000/month) 💰💰💰💰💰

**Use case:** Data must stay in UAE/GCC, enterprise SLA, bank IT approval  

| Item | Provider | Plan | Cost |
|------|----------|------|------|
| App VM | Azure UAE North | Standard_D4s_v5 | **~$140–170/mo** |
| GPU VM | Azure NC-series | NVIDIA GPU | **~$500–1,500/mo** |
| Managed PostgreSQL | Azure Database | 2 vCore + backups | **~$120–200/mo** |
| Redis | Azure Cache | Basic | **~$40/mo** |
| Penetration test | Third party | One-time before launch | **$3,000–10,000 once** |

**Total: ~$800–2,000/month** (+ one-time security audit)

- Azure UAE: https://azure.microsoft.com/en-us/explore/global-infrastructure/geographies/  
- AWS Bahrain: https://aws.amazon.com/about-aws/global-infrastructure/regions/  

---

## Step-by-Step Shopping List

### Phase 1 — Before You Buy (30 minutes)

- [ ] Answer **Question 1** (GPU?) and **Question 2** (bank size?)  
- [ ] Pick a **scenario** (1–5 above)  
- [ ] Get credit card or company purchase order  
- [ ] Ask bank IT: **"Can we use EU cloud (Hetzner) or must data stay in UAE?"**  

### Phase 2 — Buy the Server (30 min – 48 hours)

**Cheap start (Scenario 1):**
1. Hetzner Cloud → CX33 → Ubuntu 24.04 → Create  
2. Save IP address and root password  

**Production GPU (Scenario 4):**
1. Hetzner → Dedicated → GEX44 → Ubuntu 24.04  
2. Add SSH key  
3. Wait for provisioning email  

### Phase 3 — Domain + SSL (15 minutes)

1. Buy domain on Cloudflare (~$12/year) — skip for dev  
2. Point **A record** to server IP  
3. Install free SSL with Certbot (see install steps below)  

### Phase 4 — Install BCP Software (2–4 hours)

```bash
# 1. Update system
sudo apt update && sudo apt upgrade -y

# 2. Install Docker
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER

# 3. Install Docker Compose
sudo apt install docker-compose-plugin -y

# 4. GPU only: NVIDIA drivers + CUDA
# https://docs.nvidia.com/cuda/cuda-installation-guide-linux/

# 5. Install Ollama (local AI — FREE)
curl -fsSL https://ollama.com/install.sh | sh
ollama pull llama3

# 6. Deploy BCP
git clone <your-repo-url> /opt/bcp
cd /opt/bcp
docker compose -f config/docker/docker-compose.yml up -d

# 7. Free HTTPS
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d bcp.yourbank.com
```

### Phase 5 — Monthly Checklist

- [ ] Pay hosting invoice  
- [ ] Check disk space (uploads grow over time)  
- [ ] Verify database backups ran  
- [ ] Review CPU/RAM usage in provider dashboard  

---

## Monthly Cost Summary (At a Glance)

| Scenario | Monthly | AI Speed | Best For |
|----------|---------|----------|----------|
| 1 — Dev/Demo | **~$9** | Slow (CPU) | Building & demos |
| 2 — Small pilot | **~$20–35** | Slow (CPU) | 1–10 docs/day |
| 3 — Medium production | **~$75–105** | Slow (CPU) | 50–200 docs/day |
| 4 — Production + GPU | **~$220–300** | **Fast (5–10 sec)** | Real bank production ⭐ |
| 4b — Split (VPS + RunPod) | **~$141** | Fast (business hours) | Budget production |
| 5 — UAE enterprise | **~$800–2,000** | Fast | UAE data residency |

---

## What NOT to Buy (Save Your Money)

| Don't buy | Why | Use instead |
|-----------|-----|-------------|
| OpenAI API | Bank documents leave your control | Ollama on your server (free) |
| Pinecone | $25+/mo extra | pgvector on PostgreSQL (free) |
| AWS Textract | $1.50 per 1,000 pages | Tesseract (free) |
| SendGrid | $20+/mo after free tier | Bank SMTP (free) |
| Managed Kubernetes | Overkill | Docker Compose (free) |
| Windows Server | BCP runs on Linux | Ubuntu 24.04 (free) |

---

## UAE Banking Note (Important)

Before production with **real bank documents**:

1. **Data residency** — UAE only? → Azure UAE North or AWS Bahrain  
2. **Vendor approval** — Is Hetzner approved? Many banks say no for production  
3. **VPN access** — Users should access BCP inside bank VPN only  
4. **Penetration test** — Budget **$3,000–10,000** one-time before go-live  

For **POC with test data only**, Hetzner Scenario 1 or 2 is usually fine if IT approves.

---

## Quick Decision Guide

```
Do you own a server at the bank already?
├── YES → Install BCP there. Software cost: $0/month.
└── NO → Must data stay in UAE?
    ├── YES → Scenario 5 (Azure/AWS UAE) ~$800+/mo
    └── NO → Is this production with real documents?
        ├── YES → Scenario 4 (Hetzner GEX44 GPU) ~$275/mo ⭐
        └── NO (dev/demo) → Scenario 1 (Hetzner CX33) ~$9/mo
```

---

## Useful Links

| What | Link |
|------|------|
| Hetzner Cloud | https://www.hetzner.com/cloud |
| Hetzner GPU (GEX44) | https://www.hetzner.com/dedicated-rootserver/matrix-gpu |
| Contabo VPS | https://contabo.com/en/vps/ |
| DigitalOcean | https://www.digitalocean.com/pricing/droplets |
| RunPod GPU | https://www.runpod.io/pricing |
| Azure UAE | https://azure.microsoft.com/en-us/explore/global-infrastructure/geographies/ |
| Cloudflare domains | https://www.cloudflare.com/products/registrar/ |
| Ollama (free local AI) | https://ollama.com |
| BCP deployment | [DEPLOYMENT.md](../deployment/DEPLOYMENT.md) |
| BCP developer setup | [DEVELOPER_GUIDE.md](../developer-guide/DEVELOPER_GUIDE.md) |
| Technical stack (V1) | [TOOLS_AND_COSTS.md](./TOOLS_AND_COSTS.md) |

---

*Last updated: 2026-06-22. Verify all prices on provider websites before purchasing.*
