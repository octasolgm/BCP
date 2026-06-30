# 📄 PDF & Document Text Extraction Strategies

**Before RAG can work, you need plain text.** This doc explains how to extract text from files and how it flows into the RAG pipeline.

---

## Extraction → RAG Pipeline (Overview Box)

```
┌──────────────┐
│  UPLOAD      │  PDF / Word / Excel / Image
└──────┬───────┘
       ▼
┌──────────────┐
│  EXTRACT     │  ← THIS DOC (pdf-parse, OCR, Azure DI, etc.)
│  plain text  │
└──────┬───────┘
       ▼
┌──────────────┐
│  CHUNK       │  Split into paragraphs / articles
└──────┬───────┘
       ▼
┌──────────────┐
│  EMBED       │  OpenAI / Azure → vectors
└──────┬───────┘
       ▼
┌──────────────┐
│  STORE       │  pgvector / AI Search / Pinecone
└──────┬───────┘
       ▼
┌──────────────┐
│  RAG SEARCH  │  Find similar chunks → AI compare
└──────────────┘
```

**Rule:** Extraction quality = RAG quality. Garbage text in → wrong compliance results out.

---

## Extraction by File Type (Main Box)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    DOCUMENT EXTRACTION MAP                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  NORMAL PDF (selectable text)                                           │
│  ┌─────────┐    pdf-parse (Node)     ┌─────────────┐                   │
│  │  .pdf   │ ──────────────────────► │ plain text  │                   │
│  └─────────┘    OR Azure DI           └─────────────┘                   │
│                                                                          │
│  SCANNED PDF (image only — 4 client TFS files!)                         │
│  ┌─────────┐    tesseract.js (Node) ┌─────────────┐                   │
│  │  .pdf   │ ──────────────────────► │ plain text  │                   │
│  └─────────┘    OR Azure DI (OCR)     └─────────────┘                   │
│                                                                          │
│  WORD .docx                                                              │
│  ┌─────────┐    mammoth (Node)        ┌─────────────┐                   │
│  │  .docx  │ ──────────────────────► │ plain text  │                   │
│  └─────────┘    OR Azure DI           └─────────────┘                   │
│                                                                          │
│  COMPLEX PDF (tables, columns, forms)                                  │
│  ┌─────────┐    pdfjs-dist (Node)     ┌─────────────┐                   │
│  │  .pdf   │ ──────────────────────► │ plain text  │                   │
│  └─────────┘    OR Azure DI layout   └─────────────┘                   │
│                                                                          │
│  EXCEL .xlsx                                                             │
│  ┌─────────┐    xlsx / sheetjs       ┌─────────────┐                   │
│  │  .xlsx  │ ──────────────────────► │ cell text   │                   │
│  └─────────┘    OR Azure DI           └─────────────┘                   │
│                                                                          │
│  JPEG / PNG (scanned regulation)                                        │
│  ┌─────────┐    tesseract.js          ┌─────────────┐                   │
│  │  .jpg   │ ──────────────────────► │ plain text  │                   │
│  └─────────┘    OR Azure DI           └─────────────┘                   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Package Guide (Node.js / NestJS)

### pdf-parse
```
┌─────────────────────────────────────────────────────────────┐
│  pdf-parse                                                   │
├─────────────────────────────────────────────────────────────┤
│  USE FOR:    Normal PDFs with selectable/copyable text      │
│  HOW:        Read PDF buffer → extract text string          │
│  PROS:       Simple, fast, free, runs in NestJS              │
│  CONS:       FAILS on scanned image PDFs (empty text)       │
│  BCP EXAMPLE: CBUAE AML Guidelines (text PDF) — OK           │
│  NOT FOR:    TFS Cabinet Resolution (scanned) — needs OCR   │
└─────────────────────────────────────────────────────────────┘
```

### tesseract.js
```
┌─────────────────────────────────────────────────────────────┐
│  tesseract.js (OCR)                                          │
├─────────────────────────────────────────────────────────────┤
│  USE FOR:    Scanned PDFs, JPEG/PNG images                  │
│  HOW:        Render pages to images → OCR pixels → text     │
│  PROS:       Free, runs in Node, no cloud needed             │
│  CONS:       Slow, lower accuracy on poor scans, Arabic    │
│              needs eng+ara language pack                     │
│  BCP EXAMPLE: TFS Cabinet Resolution, TFS Guidelines scans  │
└─────────────────────────────────────────────────────────────┘
```

### mammoth
```
┌─────────────────────────────────────────────────────────────┐
│  mammoth                                                     │
├─────────────────────────────────────────────────────────────┤
│  USE FOR:    Word .docx files                               │
│  HOW:        Parse docx XML → plain text or HTML            │
│  PROS:       Lightweight, good for policy documents         │
│  CONS:       Not for .doc (old format) — convert first       │
└─────────────────────────────────────────────────────────────┘
```

### pdfjs-dist
```
┌─────────────────────────────────────────────────────────────┐
│  pdfjs-dist (Mozilla PDF.js)                                 │
├─────────────────────────────────────────────────────────────┤
│  USE FOR:    Complex PDFs — tables, multi-column, forms     │
│  HOW:        Page-by-page text layer extraction             │
│  PROS:       More control than pdf-parse                    │
│  CONS:       More code, still weak on pure image scans      │
└─────────────────────────────────────────────────────────────┘
```

### Azure Document Intelligence (Cloud)
```
┌─────────────────────────────────────────────────────────────┐
│  Azure Document Intelligence                                 │
├─────────────────────────────────────────────────────────────┤
│  USE FOR:    ALL types — PDF, Word, Excel, scans, images    │
│  HOW:        Send blob URL → Azure returns structured text    │
│  PROS:       Best OCR, tables, banking-grade, one API         │
│  CONS:       Paid per page, data leaves your server         │
│  BCP BEST:   Production with 4 scanned TFS client files       │
└─────────────────────────────────────────────────────────────┘
```

### Gemini API (read PDF directly)
```
┌─────────────────────────────────────────────────────────────┐
│  Gemini (upload PDF to API)                                  │
├─────────────────────────────────────────────────────────────┤
│  USE FOR:    Quick demos, small PDFs                        │
│  HOW:        Send PDF + prompt "extract all text"           │
│  PROS:       One vendor for extract + compare               │
│  CONS:       Expensive on 114-page docs, inconsistent OCR, │
│              banking may reject Google for raw documents    │
│  BCP:        Use for COMPARE only — not recommended extract │
└─────────────────────────────────────────────────────────────┘
```

---

## Decision Tree

```
What file type?
      │
      ├── Word .docx ──────────────► mammoth (or Azure DI)
      │
      ├── Excel .xlsx ─────────────► sheetjs (or Azure DI)
      │
      ├── PDF — can you select text?
      │         │
      │         ├── YES ───────────► pdf-parse
      │         │
      │         └── NO (scan) ─────► Azure DI (prod)
      │                              OR tesseract.js (budget)
      │
      └── JPEG/PNG ────────────────► tesseract.js or Azure DI
```

---

## How Extracted Text Flows Into RAG

```
Step 1: Extract
  Cabinet74.pdf → "Article 1 - Definitions... Article 2..."
  Saved: documents.extracted_text (PostgreSQL)

Step 2: Chunk
  Article 1 text | Article 2 text | ... (40 pieces)

Step 3: Embed
  Each chunk → OpenAI/Azure → vector

Step 4: Store
  pgvector / AI Search index

Step 5: Compare (per Article)
  Embed "Article 15" → search bank chunks → Gemini/GPT → Compliant?
```

**If Step 1 fails (empty text from scan without OCR):**
```
RAG gets nothing → everything marked Non-Compliant → WRONG RESULTS
Always test extraction BEFORE building RAG.
```

---

## BCP Client Bundle — Which Extractor?

| File | Type | Recommended extractor |
|------|------|----------------------|
| TFS Cabinet Resolution.pdf | Scanned | **Azure Document Intelligence** |
| TFS Guidelines.pdf | Scanned | **Azure Document Intelligence** |
| TFS Guidelines EOCN.pdf | Scanned | **Azure Document Intelligence** |
| TFS Typologies.pdf | Scanned | **Azure Document Intelligence** |
| CBUAE AML Guidelines.pdf | Text PDF | pdf-parse OR Azure DI |
| I M P T F S.pdf | Text PDF | pdf-parse OR Azure DI |
| A N C TI O N E.pdf | Text PDF | pdf-parse OR Azure DI |

---

## Strategy × Extraction Matrix

| Stack | Typical extract approach |
|-------|-------------------------|
| Supabase + NestJS | pdf-parse + tesseract.js + mammoth |
| Azure + NestJS | **Azure Document Intelligence** (all types) |
| n8n + Supabase | External HTTP step or pre-extract in code |
| Gemini-only MVP | Gemini read PDF (not recommended prod) |

---

## Summary

```
┌─────────────────────────────────────────────────────────────┐
│  PDF Extraction Summary                                      │
├─────────────────────────────────────────────────────────────┤
│  Normal PDF     → pdf-parse (free, NestJS)                  │
│  Scanned PDF    → Azure DI (prod) or tesseract.js (MVP)     │
│  Word           → mammoth                                   │
│  Complex PDF    → pdfjs-dist or Azure DI                    │
│  BCP production → Azure Document Intelligence for all     │
│                                                              │
│  Extract FIRST → then chunk → embed → RAG                   │
└─────────────────────────────────────────────────────────────┘
```
