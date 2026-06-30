# 🧩 BCP - How Everything Works (Visual Guide)

**Version:** 1.0  
**Date:** 2026-06-22  

## READ THIS FIRST

This document explains in **SIMPLE visual steps**:

1. What you need to **BUY**  
2. What you need to **INSTALL**  
3. How each **PART** works  
4. How data **FLOWS** through the system  
5. What happens when a **USER** uses the app  

> **Related docs:** [TOOLS_AND_COSTS_V2.md](./TOOLS_AND_COSTS_V2.md) (what to buy) · [ARCHITECTURE.md](../architecture/ARCHITECTURE.md) (technical architecture)

---

## PART 1: What Do You Actually Buy?

You buy exactly **3 things**. That's it.

```
┌──────────────────────────────────────────────┐
│           SHOPPING LIST (3 Items)             │
│                                               │
│  ┌─────────────────────────────────────────┐ │
│  │ 1. SERVER (Online Computer)              │ │
│  │    Where: Hetzner.com                    │ │
│  │    What: CX32 plan                       │ │
│  │    Cost: $9/month                        │ │
│  │    It's Like: Renting a computer that    │ │
│  │    stays ON 24/7 on the internet         │ │
│  └─────────────────────────────────────────┘ │
│                                               │
│  ┌─────────────────────────────────────────┐ │
│  │ 2. DOMAIN NAME (Website Address)         │ │
│  │    Where: Namecheap.com                  │ │
│  │    What: bcp-compliance.com              │ │
│  │    Cost: $12/year ($1/month)             │ │
│  │    It's Like: Buying your shop's name    │ │
│  │    plate so customers can find you       │ │
│  └─────────────────────────────────────────┘ │
│                                               │
│  ┌─────────────────────────────────────────┐ │
│  │ 3. GPU SERVER (Later, for fast AI)       │ │
│  │    Where: RunPod.io                      │ │
│  │    What: RTX 4090 pod                    │ │
│  │    Cost: $122/month (12 hrs/day)         │ │
│  │    When: Only when bank goes live        │ │
│  │    It's Like: Renting a powerful         │ │
│  │    computer with gaming graphics card    │ │
│  │    that helps AI think faster            │ │
│  └─────────────────────────────────────────┘ │
│                                               │
│  TOTAL to START: $10/month                    │
│  TOTAL for PRODUCTION: $192/month             │
└──────────────────────────────────────────────┘
```

---

## PART 2: What's Inside Your Rented Server?

When you buy a Hetzner server, you get a **BLANK Linux computer**. Like buying a new laptop with nothing installed. You need to install everything.

```
┌──────────────────────────────────────────────────────┐
│              YOUR HETZNER SERVER                      │
│              (Ubuntu Linux 24.04)                     │
│              IP: 88.99.xxx.xxx                        │
│                                                       │
│  You INSTALL these things (all FREE):                 │
│                                                       │
│  ┌──────────────────────────────────────────────────┐│
│  │ LAYER 1: Web Server (Nginx) - Traffic Director    ││
│  │ What: Receives all browser requests               ││
│  │ Like: Reception desk at a hotel                   ││
│  │ Cost: FREE                                        ││
│  └──────────────────┬───────────────────────────────┘│
│                     │ sends request to correct app    │
│  ┌──────────────────┴───────────────────────────────┐│
│  │ LAYER 2: Your Web App (React) - What Users See    ││
│  │ What: The website interface (buttons, forms)      ││
│  │ Like: The front counter of a bank                 ││
│  │ Cost: FREE                                        ││
│  └──────────────────┬───────────────────────────────┘│
│                     │ talks to backend                │
│  ┌──────────────────┴───────────────────────────────┐│
│  │ LAYER 3: Backend API (Node.js) - The Brain        ││
│  │ What: Handles login, files, reports, alerts       ││
│  │ Like: The bank manager who processes requests     ││
│  │ Cost: FREE                                        ││
│  └──────────────────┬───────────────────────────────┘│
│                     │ sends documents to AI           │
│  ┌──────────────────┴───────────────────────────────┐│
│  │ LAYER 4: AI Engine (Python) - The Analyzer        ││
│  │ What: Reads documents, compares, gives results    ││
│  │ Like: A compliance expert reading documents       ││
│  │ Cost: FREE                                        ││
│  └──────────────────┬───────────────────────────────┘│
│                     │ uses AI model                   │
│  ┌──────────────────┴───────────────────────────────┐│
│  │ LAYER 5: Ollama + Llama 3 (AI Model)              ││
│  │ What: The artificial intelligence brain           ││
│  │ Like: ChatGPT but running on YOUR server          ││
│  │ Cost: FREE                                        ││
│  └──────────────────────────────────────────────────┘│
│                                                       │
│  ┌──────────────────────────────────────────────────┐│
│  │ LAYER 6: Database (PostgreSQL) - Data Storage     ││
│  │ What: Stores users, documents, results            ││
│  │ Like: Filing cabinet that remembers everything    ││
│  │ Cost: FREE                                        ││
│  └──────────────────────────────────────────────────┘│
│                                                       │
│  ┌──────────────────────────────────────────────────┐│
│  │ LAYER 7: Redis - Speed Booster                    ││
│  │ What: Temporarily remembers frequent data         ││
│  │ Like: Post-it notes on manager's desk for         ││
│  │ things they need to remember quickly              ││
│  │ Cost: FREE                                        ││
│  └──────────────────────────────────────────────────┘│
│                                                       │
│  ┌──────────────────────────────────────────────────┐│
│  │ LAYER 8: File Storage (Uploads Folder)            ││
│  │ What: Stores uploaded PDFs, Word docs, images     ││
│  │ Like: A locked filing room for documents          ││
│  │ Cost: FREE (uses server disk space)               ││
│  └──────────────────────────────────────────────────┘│
│                                                       │
│  ALL of above = $0 software                           │
│  You only pay the $9/month server rent                │
└──────────────────────────────────────────────────────┘
```

---

## PART 3: How User Accesses The System

```
STEP 1: User opens browser and types bcp-compliance.com
        │
        ▼
STEP 2: Internet looks up domain → finds IP 88.99.xxx.xxx
        │
        ▼
STEP 3: Request reaches YOUR Hetzner server
        │
        ▼
STEP 4: Nginx receives request
        │
        ├── If requesting website → sends to React app (static files)
        ├── If requesting API data → sends to Node.js backend
        │
        ▼
STEP 5: User sees the BCP dashboard in their browser
        (Like opening gmail.com but it's YOUR compliance tool)
```

**Simple version:**

```
User's Browser ──→ Internet ──→ Your Server ──→ Your App ──→ Back to Browser

Just like: You type gmail.com → Google's server → Gmail loads in your browser
Same thing: You type bcp.com → YOUR server → BCP app loads in user's browser
```

---

## PART 4: What Happens When User Uploads a Document?

This is the **CORE flow**. Read each step carefully.

```
╔═══════════════════════════════════════════════════════╗
║  COMPLETE FLOW: Upload → Analysis → Report            ║
╚═══════════════════════════════════════════════════════╝

STEP 1: USER UPLOADS FILES
┌─────────────────────────────────────────────┐
│ User in browser:                             │
│ • Drags "Cabinet Decision 74.pdf" to box 1   │
│ • Drags "Bank TFS Policy.docx" to box 2      │
│ • Clicks "Compare & Analyze"                 │
└──────────────────────┬──────────────────────┘
                       │
                       ▼ Files sent over internet (HTTPS encrypted)
                       
STEP 2: BACKEND RECEIVES FILES
┌─────────────────────────────────────────────┐
│ Node.js Backend:                             │
│ • Checks user is logged in (JWT token)       │
│ • Checks file type is allowed (PDF, DOCX)    │
│ • Saves files to /uploads folder on server   │
│ • Creates database record for each file      │
│ • Creates "analysis session" in database     │
│ • Adds job to Redis queue (BullMQ)           │
│ • Returns to user: "Processing... please wait"│
└──────────────────────┬──────────────────────┘
                       │
                       ▼ Job picked up from queue
                       
STEP 3: AI ENGINE EXTRACTS TEXT
┌─────────────────────────────────────────────┐
│ Python AI Engine receives the job:           │
│                                              │
│ For "Cabinet Decision 74.pdf":               │
│ • Opens PDF file                             │
│ • Uses pdfplumber to read text               │
│ • Extracts: "Article 1 - Definitions...      │
│   The State: United Arab Emirates...         │
│   The Council: Supreme Council..."           │
│                                              │
│ For "Bank TFS Policy.docx":                  │
│ • Opens Word file                            │
│ • Uses python-docx to read text              │
│ • Extracts: "Section 1: Our bank defines     │
│   the following terms as per UAE law..."     │
│                                              │
│ If file was a JPEG image:                    │
│ • Uses Tesseract OCR to read text from image │
│                                              │
│ Result: Clean text from both documents       │
└──────────────────────┬──────────────────────┘
                       │
                       ▼
                       
STEP 4: AI SPLITS REQUIREMENTS INTO POINTS
┌─────────────────────────────────────────────┐
│ Requirement Parser:                          │
│                                              │
│ Takes: Full text of Cabinet Decision 74      │
│                                              │
│ Splits into individual requirement points:   │
│                                              │
│ Point 1: "Article 1 - Definitions            │
│   The State: The United Arab Emirates        │
│   The Council: Supreme Council for           │
│   National Security..."                      │
│                                              │
│ Point 2: "Article 2 - Sanctions Committee    │
│   The office designated to handle            │
│   sanctions screening..."                    │
│                                              │
│ Point 3: "Article 3 - Listed Persons         │
│   Banks must identify and report             │
│   listed persons..."                         │
│                                              │
│ (May have 20-50 points from one document)    │
└──────────────────────┬──────────────────────┘
                       │
                       ▼
                       
STEP 5: AI CREATES EMBEDDINGS (Vector Math)
┌─────────────────────────────────────────────┐
│ Embedding Service:                           │
│                                              │
│ What is an "embedding"?                      │
│ It's converting text into numbers so the     │
│ computer can measure how SIMILAR two texts   │
│ are. Like converting colors to RGB numbers.  │
│                                              │
│ Example:                                     │
│ "Bank must screen sanctions" →               │
│   [0.23, 0.87, 0.12, 0.95, ...]            │
│   (384 numbers representing meaning)        │
│                                              │
│ "We perform sanctions screening" →           │
│   [0.21, 0.85, 0.14, 0.93, ...]            │
│   (similar numbers = similar meaning!)       │
│                                              │
│ Tool: Sentence Transformers (FREE)           │
│ Model: all-MiniLM-L6-v2 (FREE, 90 MB)       │
│ Storage: pgvector in PostgreSQL (FREE)       │
│                                              │
│ Process:                                     │
│ 1. Split bank's internal doc into chunks     │
│ 2. Convert each chunk to numbers (embedding) │
│ 3. Store in database with pgvector           │
└──────────────────────┬──────────────────────┘
                       │
                       ▼
                       
STEP 6: AI FINDS MATCHING SECTIONS (Semantic Search)
┌─────────────────────────────────────────────┐
│ Semantic Search:                             │
│                                              │
│ For each requirement point:                  │
│                                              │
│ Query: "Article 1 - Definitions              │
│   The State: UAE, The Council: Supreme       │
│   Council for National Security"             │
│                                              │
│ Search: Find the 5 most similar chunks       │
│   from bank's internal document              │
│                                              │
│ Result:                                      │
│   Match 1 (95% similar): "Section 1 of      │
│     TFS Policy - Our bank recognizes the     │
│     definitions as per Cabinet Decision..."  │
│   Match 2 (60% similar): "Section 3..."      │
│   Match 3 (30% similar): "Section 7..."      │
│                                              │
│ Takes: Top 5 matches as "context"            │
└──────────────────────┬──────────────────────┘
                       │
                       ▼
                       
STEP 7: LLM EVALUATES COMPLIANCE (The AI Brain)
┌─────────────────────────────────────────────┐
│ Ollama + Llama 3 (running on your server):   │
│                                              │
│ Input to AI:                                 │
│ "You are a compliance expert.                │
│  Compare this REQUIREMENT:                   │
│  'Article 1 - Definitions...'               │
│  Against this BANK DOCUMENT:                 │
│  'Section 1 of TFS Policy...'               │
│  Is it Compliant, Partial, or Non-Compliant?"│
│                                              │
│ AI thinks... (5-10 seconds with GPU)         │
│            ... (60 seconds without GPU)      │
│                                              │
│ AI responds:                                 │
│ {                                            │
│   "compliance_level": "compliant",           │
│   "justification": "The bank's Section 1     │
│     fully addresses all definitions from     │
│     Article 1 including State, Council,      │
│     and Ministry references.",               │
│   "matched_sections": "TFS Policy Sec 1",    │
│   "gaps": "None identified",                │
│   "confidence": 0.95                         │
│ }                                            │
│                                              │
│ This repeats for EVERY requirement point     │
│ (20-50 points = 20-50 AI calls)              │
│                                              │
│ COST: $0 (Ollama is free, runs locally)      │
└──────────────────────┬──────────────────────┘
                       │
                       ▼
                       
STEP 8: RESULTS SAVED TO DATABASE
┌─────────────────────────────────────────────┐
│ Backend saves each result to PostgreSQL:     │
│                                              │
│ compliance_items table:                      │
│ ┌──────────────┬───────────────┬───────────┐│
│ │ Requirement  │ Match         │ Status    ││
│ ├──────────────┼───────────────┼───────────┤│
│ │ Article 1    │ TFS Sec 1     │ Compliant ││
│ │ Article 2    │ TFS Sec 3     │ Partial   ││
│ │ Article 3    │ Not Found     │ Non-Comp  ││
│ │ Article 4    │ TFS Sec 5     │ Compliant ││
│ │ ...          │ ...           │ ...       ││
│ └──────────────┴───────────────┴───────────┘│
│                                              │
│ Also calculates summary:                     │
│ • Total: 25 items                            │
│ • Compliant: 18 (72%)                        │
│ • Partial: 4 (16%)                           │
│ • Non-Compliant: 3 (12%)                     │
└──────────────────────┬──────────────────────┘
                       │
                       ▼
                       
STEP 9: USER SEES RESULTS
┌─────────────────────────────────────────────┐
│ React Web App displays:                      │
│                                              │
│ ┌─────────── COMPLIANCE REPORT ────────────┐│
│ │                                           ││
│ │ Overall: 72% Compliant                    ││
│ │ ████████████████░░░░░ 72%                 ││
│ │                                           ││
│ │ ┌────────┬──────────┬──────┬──────────┐  ││
│ │ │Require │ Match    │Status│ Action   │  ││
│ │ ├────────┼──────────┼──────┼──────────┤  ││
│ │ │Art. 1  │TFS Sec 1 │ ✅  │    -     │  ││
│ │ │Art. 2  │TFS Sec 3 │ ⚠️  │[Assign]  │  ││
│ │ │Art. 3  │Not Found │ ❌  │[Assign]  │  ││
│ │ │Art. 4  │TFS Sec 5 │ ✅  │    -     │  ││
│ │ └────────┴──────────┴──────┴──────────┘  ││
│ │                                           ││
│ │ [📥 Download Excel]  [📊 Dashboard]       ││
│ └───────────────────────────────────────────┘│
└─────────────────────────────────────────────┘
```

---

## PART 5: What Happens After Analysis?

```
╔═══════════════════════════════════════════════════════╗
║  AFTER ANALYSIS: Action Plans & Tracking              ║
╚═══════════════════════════════════════════════════════╝

STEP 10: MANAGER ASSIGNS ACTIONS
┌─────────────────────────────────────────────┐
│ Manager clicks on Non-Compliant item:        │
│                                              │
│ Article 3 - Listed Persons [❌ Non-Compliant]│
│                                              │
│ Fills in:                                    │
│ • Who will fix? → [Ahmed Khan ▼]             │
│ • By when? → [30-Jun-2026 📅]               │
│ • How to fix? → [Add sanctions screening     │
│   procedure to Section 4 of policy]          │
│                                              │
│ Clicks [Save]                                │
│                                              │
│ Backend:                                     │
│ • Saves to database                          │
│ • Sends email to Ahmed Khan                  │
│ • Sends push notification to Ahmed's phone   │
│ • Creates audit log entry                    │
└──────────────────────┬──────────────────────┘
                       │
                       ▼

STEP 11: ALERTS & NOTIFICATIONS
┌─────────────────────────────────────────────┐
│ CRON Job runs every day at 9:00 AM:          │
│                                              │
│ Checks database for:                         │
│ • Target dates coming in 3 days → Alert      │
│ • Target dates already passed → URGENT Alert │
│                                              │
│ Day 1: Ahmed receives:                       │
│ "You have a new compliance task assigned"     │
│                                              │
│ Day 27 (3 days before deadline):             │
│ "⚠️ Reminder: Article 3 fix due in 3 days"  │
│                                              │
│ Day 31 (1 day after deadline):               │
│ "🚨 OVERDUE: Article 3 fix was due yesterday"│
│                                              │
│ Notifications sent via:                      │
│ • Email (Nodemailer → Bank's SMTP) = FREE    │
│ • Push to phone (Firebase FCM) = FREE        │
│ • Dashboard banner in web app                │
└──────────────────────┬──────────────────────┘
                       │
                       ▼

STEP 12: REMEDIATION (Fixing the Problem)
┌─────────────────────────────────────────────┐
│ Ahmed fixes the policy:                      │
│ • Edits "Bank TFS Policy v2.docx"            │
│ • Adds sanctions screening to Section 4      │
│                                              │
│ Ahmed opens BCP app → Action Tracker:        │
│ • Finds Article 3 task                       │
│ • Clicks "Upload Corrective Document"        │
│ • Uploads "Bank TFS Policy v2.docx"          │
│                                              │
│ System automatically:                        │
│ 1. Sends new doc to AI Engine                │
│ 2. AI re-reads the updated policy            │
│ 3. AI re-compares Article 3 requirement      │
│ 4. AI says: "Now Compliant!" ✅              │
│ 5. Status updates from ❌ to ✅              │
│ 6. Dashboard percentage increases            │
│ 7. Manager gets notification: "Article 3     │
│    is now Compliant"                         │
└─────────────────────────────────────────────┘
```

---

## PART 6: How Excel Report Works

```
╔═══════════════════════════════════════════════════════╗
║  EXCEL REPORT GENERATION                              ║
╚═══════════════════════════════════════════════════════╝

User clicks "Download Excel" button
        │
        ▼
Backend (Node.js):
        │
        ├── Reads all compliance items from database
        ├── Uses ExcelJS library (FREE)
        ├── Creates Excel file matching client template:
        │
        │   ┌───────────────────────────────────────────┐
        │   │ CABINET DECISION NO. 74                    │
        │   ├────────┬──────────────┬─────┬──────┬──────┤
        │   │Require │UAE Response  │Comp │Target│Action│
        │   │ment    │              │ly   │Date  │Plan  │
        │   ├────────┼──────────────┼─────┼──────┼──────┤
        │   │Art 1   │Covered in   │ Yes │  -   │  -   │
        │   │Defns.. │TFS Policy   │     │      │      │
        │   ├────────┼──────────────┼─────┼──────┼──────┤
        │   │Art 3   │NOT FOUND    │ No  │30-Jun│Add   │
        │   │Listed..│             │     │-2026 │screen│
        │   └────────┴──────────────┴─────┴──────┴──────┘
        │
        ├── Saves .xlsx file on server
        ├── Sends file download to user's browser
        │
        ▼
User's browser downloads: "Compliance_Report_2025-07-01.xlsx"
```

---

## PART 7: How Dashboard (MIS) Works

```
╔═══════════════════════════════════════════════════════╗
║  DASHBOARD / MIS                                      ║
╚═══════════════════════════════════════════════════════╝

User opens Dashboard page
        │
        ▼
Frontend (React) calls Backend API: GET /api/dashboard
        │
        ▼
Backend queries PostgreSQL database:
        │
        ├── SELECT COUNT(*) WHERE level = 'compliant'     → 18
        ├── SELECT COUNT(*) WHERE level = 'partial'       → 4
        ├── SELECT COUNT(*) WHERE level = 'non_compliant' → 3
        ├── SELECT COUNT(*) WHERE target_date < today     → 2 (overdue)
        │
        ▼
Backend returns JSON to Frontend:
{
  "compliant": 18,
  "partial": 4,
  "nonCompliant": 3,
  "total": 25,
  "percentage": 72,
  "overdue": 2
}
        │
        ▼
React renders using Recharts (FREE chart library):

┌─────────────────────────────────────────────┐
│               COMPLIANCE DASHBOARD           │
│                                              │
│   ┌──────────┐  ┌──────────┐  ┌──────────┐ │
│   │   ✅ 18   │  │   ⚠️ 4   │  │   ❌ 3   │ │
│   │Compliant │  │ Partial  │  │Non-Comp  │ │
│   └──────────┘  └──────────┘  └──────────┘ │
│                                              │
│        ┌───────────────────┐                 │
│        │    PIE CHART      │                 │
│        │   ████ 72% ✅     │                 │
│        │   ██ 16% ⚠️      │                 │
│        │   █ 12% ❌       │                 │
│        └───────────────────┘                 │
│                                              │
│   ⚠️ 2 Overdue Actions                      │
│   📅 3 Upcoming Deadlines                    │
└─────────────────────────────────────────────┘
```

---

## PART 8: How Mobile App Works

```
╔═══════════════════════════════════════════════════════╗
║  MOBILE APP FLOW                                      ║
╚═══════════════════════════════════════════════════════╝

SETUP (One Time):
1. Ahmed downloads BCP app from Play Store / App Store
2. Opens app → Login with email/password
3. App asks permission for Notifications → Ahmed allows
4. App registers device token with Firebase FCM
5. Backend stores Ahmed's device token in database

DAILY USE:
┌────────────────────────────────────────┐
│  Ahmed's Phone                          │
│                                         │
│  📱 Notification appears:               │
│  "⚠️ Article 3 fix due in 3 days"      │
│         │                               │
│         ▼ Ahmed taps notification       │
│                                         │
│  BCP App Opens → Task Detail Screen:    │
│  ┌──────────────────────────────────┐  │
│  │ Article 3 - Listed Persons       │  │
│  │ Status: ❌ Non-Compliant         │  │
│  │ Due: 30-Jun-2026 (3 days left)   │  │
│  │ Action: Add screening procedure  │  │
│  │                                   │  │
│  │ [📷 Upload Fix Document]          │  │
│  │                                   │  │
│  │ Ahmed taps Upload → opens camera │  │
│  │ Takes photo of updated policy     │  │
│  │ OR selects file from phone        │  │
│  │                                   │  │
│  │ System re-analyzes → ✅ Compliant │  │
│  └──────────────────────────────────┘  │
└────────────────────────────────────────┘

HOW PUSH NOTIFICATION REACHES AHMED:
┌──────────────────────────────────────────────┐
│                                               │
│  Your Server (CRON job at 9 AM)               │
│  "Ahmed has deadline in 3 days"               │
│       │                                       │
│       ▼                                       │
│  Backend sends to Firebase FCM (Google):      │
│  {                                            │
│    token: "Ahmed's phone token",              │
│    title: "Deadline Approaching",             │
│    body: "Article 3 fix due in 3 days"        │
│  }                                            │
│       │                                       │
│       ▼                                       │
│  Firebase FCM (Google's Free Service):        │
│  Delivers notification to Ahmed's phone       │
│       │                                       │
│       ▼                                       │
│  Ahmed's phone shows notification 📱          │
│                                               │
│  COST: $0 (Firebase FCM is unlimited free)    │
└──────────────────────────────────────────────┘
```

---

## PART 9: Complete System Map (Everything Connected)

```
╔═══════════════════════════════════════════════════════════════╗
║                    COMPLETE SYSTEM MAP                        ║
╠═══════════════════════════════════════════════════════════════╣
║                                                               ║
║  USERS                                                        ║
║  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐      ║
║  │ 💻 Browser   │  │ 📱 Phone     │  │ 📧 Email Client │      ║
║  │ (Web App)    │  │ (Mobile App) │  │ (Gets Alerts)   │      ║
║  └──────┬──────┘  └──────┬──────┘  └────────▲────────┘      ║
║         │                │                    │               ║
║         │ HTTPS          │ HTTPS              │ SMTP          ║
║         │                │                    │               ║
║  ═══════╪════════════════╪════════════════════╪═══════════    ║
║         │         INTERNET                    │               ║
║  ═══════╪════════════════╪════════════════════╪═══════════    ║
║         │                │                    │               ║
║  ┌──────┴────────────────┴────────────────────┴───────────┐  ║
║  │                YOUR HETZNER SERVER                      │  ║
║  │                ($9 - $65/month)                          │  ║
║  │                                                          │  ║
║  │  ┌──────────────────────────────────────────────────┐   │  ║
║  │  │  Nginx (Web Server + SSL) - FREE                  │   │  ║
║  │  │  Receives all requests, routes them               │   │  ║
║  │  └────────┬──────────────────┬───────────────────────┘   │  ║
║  │           │                  │                            │  ║
║  │  ┌────────▼──────┐  ┌───────▼───────────┐               │  ║
║  │  │ React Web App │  │ Node.js Backend   │               │  ║
║  │  │ (Static HTML) │  │ (API Server)      │               │  ║
║  │  │ FREE          │  │ Port 4000         │               │  ║
║  │  │               │  │ FREE              │               │  ║
║  │  └───────────────┘  └──┬────────────┬───┘               │  ║
║  │                        │            │                     │  ║
║  │           ┌────────────┘            └──────────┐         │  ║
║  │           │                                     │         │  ║
║  │  ┌────────▼──────────┐             ┌───────────▼──────┐  │  ║
║  │  │ PostgreSQL DB     │             │ Redis Cache      │  │  ║
║  │  │ + pgvector        │             │ + BullMQ Queue   │  │  ║
║  │  │ Port 5432         │             │ Port 6379        │  │  ║
║  │  │ FREE              │             │ FREE             │  │  ║
║  │  └───────────────────┘             └──────────────────┘  │  ║
║  │                                                          │  ║
║  │  ┌───────────────────────────────────────────────────┐   │  ║
║  │  │ Python AI Engine (FastAPI)                         │   │  ║
║  │  │ Port 8000 - FREE                                   │   │  ║
║  │  │                                                     │   │  ║
║  │  │  ┌─────────────┐  ┌──────────────┐  ┌───────────┐ │   │  ║
║  │  │  │ pdfplumber  │  │ Tesseract    │  │ Sentence  │ │   │  ║
║  │  │  │ python-docx │  │ OCR          │  │ Transform │ │   │  ║
║  │  │  │ openpyxl    │  │ (Images)     │  │ (Vectors) │ │   │  ║
║  │  │  │ (Docs)      │  │ FREE         │  │ FREE      │ │   │  ║
║  │  │  │ FREE        │  │              │  │           │ │   │  ║
║  │  │  └─────────────┘  └──────────────┘  └───────────┘ │   │  ║
║  │  │                                                     │   │  ║
║  │  └──────────────────────┬────────────────────────────┘   │  ║
║  │                         │                                 │  ║
║  └─────────────────────────┼─────────────────────────────────┘  ║
║                            │                                     ║
║  ┌─────────────────────────▼─────────────────────────────────┐  ║
║  │         GPU SERVER (RunPod) - $122/month                   │  ║
║  │         Only needed for PRODUCTION                         │  ║
║  │                                                             │  ║
║  │  ┌─────────────────────────────────────────────────────┐   │  ║
║  │  │  Ollama + Llama 3 (AI Brain)                         │   │  ║
║  │  │  Receives comparison requests from AI Engine         │   │  ║
║  │  │  Returns: Compliant / Partial / Non-Compliant        │   │  ║
║  │  │  FREE SOFTWARE on rented GPU hardware                │   │  ║
║  │  └─────────────────────────────────────────────────────┘   │  ║
║  └─────────────────────────────────────────────────────────────┘  ║
║                                                                    ║
║  ┌────────────────────────────────────────────────────────────┐   ║
║  │  EXTERNAL FREE SERVICES (Internet)                         │   ║
║  │                                                             │   ║
║  │  ┌─────────────────┐  ┌──────────────────────────────┐    │   ║
║  │  │ Firebase FCM    │  │ Bank's Email Server (SMTP)   │    │   ║
║  │  │ Push to phones  │  │ Sends alert emails           │    │   ║
║  │  │ UNLIMITED FREE  │  │ Already paid by bank         │    │   ║
║  │  └─────────────────┘  └──────────────────────────────┘    │   ║
║  └────────────────────────────────────────────────────────────┘   ║
║                                                                    ║
╠════════════════════════════════════════════════════════════════════╣
║  TOTAL MONTHLY COST:                                               ║
║  Development: $10 (Hetzner CX32 + Domain)                         ║
║  Production: $192 (Hetzner CCX33 + RunPod GPU + Domain + Backup)  ║
║  Software: $0 (Everything is open source)                          ║
╚════════════════════════════════════════════════════════════════════╝
```

---

## PART 10: Installation Steps on Server (What Goes Where)

After buying Hetzner server, you install things in this **ORDER**:

```
YOUR NEW HETZNER SERVER (Blank Ubuntu)
│
│ Step 1: System Update
│ └── sudo apt update && sudo apt upgrade -y
│     (Like updating Windows, but for Linux)
│
│ Step 2: Install Nginx (Web Server)
│ └── sudo apt install nginx -y
│     (This receives browser requests)
│     (FREE, takes 30 seconds)
│
│ Step 3: Install Node.js 20 (Backend Runtime)
│ └── curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
│ └── sudo apt install nodejs -y
│     (This runs your backend code)
│     (FREE, takes 1 minute)
│
│ Step 4: Install Python 3.12 (AI Engine Runtime)
│ └── sudo apt install python3 python3-pip python3-venv -y
│     (This runs your AI code)
│     (FREE, takes 1 minute)
│
│ Step 5: Install PostgreSQL 16 (Database)
│ └── sudo apt install postgresql postgresql-contrib -y
│ └── sudo -u postgres psql -c "CREATE DATABASE bcp_db;"
│ └── Install pgvector extension
│     (This stores all your data)
│     (FREE, takes 2 minutes)
│
│ Step 6: Install Redis 7 (Cache + Queue)
│ └── sudo apt install redis-server -y
│     (This handles background jobs)
│     (FREE, takes 30 seconds)
│
│ Step 7: Install Tesseract OCR (Image Reader)
│ └── sudo apt install tesseract-ocr tesseract-ocr-eng tesseract-ocr-ara -y
│     (This reads text from images)
│     (FREE, takes 1 minute)
│
│ Step 8: Install Ollama (AI Model Runner)
│ └── curl -fsSL https://ollama.com/install.sh | sh
│ └── ollama pull llama3
│     (This downloads and runs AI model)
│     (FREE, downloads 4.7 GB model)
│     (Takes 5-10 minutes depending on internet)
│
│ Step 9: Install PM2 (App Manager)
│ └── sudo npm install -g pm2
│     (This keeps your apps running 24/7)
│     (FREE, takes 10 seconds)
│
│ Step 10: Install Certbot (Free SSL)
│ └── sudo apt install certbot python3-certbot-nginx -y
│ └── sudo certbot --nginx -d bcp-compliance.com
│     (This gives you HTTPS padlock)
│     (FREE from Let's Encrypt)
│     (Takes 2 minutes)
│
│ Step 11: Clone Your BCP Code
│ └── git clone your-repo-url /var/www/bcp
│ └── cd /var/www/bcp
│ └── npm install
│     (Downloads your app code)
│     (Takes 2-5 minutes)
│
│ Step 12: Setup Python Environment
│ └── cd /var/www/bcp/apps/ai-engine
│ └── python3 -m venv venv
│ └── source venv/bin/activate
│ └── pip install -r requirements.txt
│     (Sets up AI engine dependencies)
│     (Takes 3-5 minutes)
│
│ Step 13: Configure Environment Variables
│ └── Create .env files with database passwords
│ └── Configure Nginx to point domain to your apps
│
│ Step 14: Start Everything
│ └── pm2 start apps/backend/dist/server.js --name bcp-api
│ └── pm2 start apps/ai-engine/start.sh --name bcp-ai
│ └── Copy web build to Nginx serving folder
│ └── pm2 save
│
│ Step 15: Verify
│ └── Open browser → https://bcp-compliance.com
│ └── You should see login page
│ └── DONE! Your system is LIVE
│
│ TOTAL INSTALLATION TIME: 30-60 minutes
│ TOTAL SOFTWARE COST: $0
```

> **Tip:** For production, you can use **Docker Compose** instead of installing each piece manually. See [DEPLOYMENT.md](../deployment/DEPLOYMENT.md).

---

## PART 11: GPU Server Connection (RunPod Setup)

For **PRODUCTION only**. Skip for development.

```
WITHOUT GPU (Development / Demo):
┌──────────────────────────────┐
│ Hetzner Server (CPU only)     │
│ Ollama runs on CPU            │
│ AI response: 60-90 seconds    │
│ COST: $9-65/month             │
└──────────────────────────────┘

WITH GPU (Production):
┌──────────────────────────────┐     ┌─────────────────────┐
│ Hetzner Server               │     │ RunPod GPU Server    │
│ (Everything EXCEPT AI)       │────▶│ (ONLY Ollama + AI)  │
│ Web, Backend, Database       │◀────│ RTX 4090            │
│ $65/month                    │     │ $122/month          │
└──────────────────────────────┘     └─────────────────────┘

Connection between them:
- Backend on Hetzner calls RunPod GPU via private API
- Like two computers talking to each other over internet
- AI response: 5-10 seconds (FAST!)
```

### Alternative: ALL IN ONE GPU Server

If bank wants everything on one server:

```
┌──────────────────────────────┐
│ Hetzner GPU Server GEX44      │
│ (Has CPU + GPU together)      │
│                               │
│ Everything runs here:         │
│ - Web App                     │
│ - Backend                     │
│ - Database                    │
│ - AI Engine                   │
│ - Ollama + Llama 3            │
│                               │
│ $200/month for everything     │
│ Simplest setup (one server)   │
└──────────────────────────────┘
```

---

## PART 12: Summary - One Page Answer

```
Q: What do I buy?
A: Hetzner server ($9/month) + Domain ($1/month) = $10/month

Q: What do I install?
A: Node.js, Python, PostgreSQL, Redis, Ollama, Tesseract, Nginx (ALL FREE)

Q: How does AI work?
A: Ollama + Llama 3 installed on your server = FREE ChatGPT

Q: How does OCR work?
A: Tesseract installed on your server = FREE text reader

Q: How do notifications work?
A: Firebase FCM = FREE unlimited push notifications from Google

Q: How do users access it?
A: Open browser → type your domain → login → use the app

Q: Total cost to start?
A: $10/month

Q: Total cost for production bank?
A: $192/month

Q: Any surprise bills?
A: No. Open source = no billing. Server = fixed monthly price.
```

---

## Related Documents

| Document | What it covers |
|----------|----------------|
| [TOOLS_AND_COSTS_V2.md](./TOOLS_AND_COSTS_V2.md) | Where to buy servers, prices, shopping list |
| [TOOLS_AND_COSTS.md](./TOOLS_AND_COSTS.md) | Full technology stack and licenses |
| [ARCHITECTURE.md](../architecture/ARCHITECTURE.md) | Technical architecture for developers |
| [DEPLOYMENT.md](../deployment/DEPLOYMENT.md) | Docker and production deployment |
| [USER_GUIDE.md](../user-guide/USER_GUIDE.md) | How end users use the app |

---

*Last updated: 2026-06-22*
