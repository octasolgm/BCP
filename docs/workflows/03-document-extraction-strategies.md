# 📄 03 — Document Extraction Strategies (Multi-Format)

How BCP turns **PDF, Word, Excel, HTML, JPEG, Email** into plain text for chunking and embedding.

---

## Format → Tool → Text Box Diagram

```
┌─────────────────┐     ┌──────────────┐     ┌─────────────┐
│  PDF (text)     │────►│  pdf-parse   │────►│  plain text │
└─────────────────┘     └──────────────┘     └─────────────┘

┌─────────────────┐     ┌──────────────┐     ┌─────────────┐
│  PDF (scanned)  │────►│ tesseract.js │────►│  OCR text   │
│  or JPEG/PNG    │     │ or Azure DI  │     │             │
└─────────────────┘     └──────────────┘     └─────────────┘

┌─────────────────┐     ┌──────────────┐     ┌─────────────┐
│  Word .docx     │────►│  mammoth     │────►│  plain text │
└─────────────────┘     └──────────────┘     └─────────────┘

┌─────────────────┐     ┌──────────────┐     ┌─────────────┐
│  Excel .xlsx    │────►│  exceljs     │────►│  cell text  │
└─────────────────┘     └──────────────┘     └─────────────┘

┌─────────────────┐     ┌──────────────┐     ┌─────────────┐
│  HTML           │────►│  cheerio     │────►│  body text  │
└─────────────────┘     └──────────────┘     └─────────────┘

┌─────────────────┐     ┌──────────────┐     ┌─────────────┐
│  Email .eml/txt │────►│ mailparser   │────►│  body text  │
└─────────────────┘     └──────────────┘     └─────────────┘
```

---

## Auto-Detect File Type

```
Upload received
     │
     ▼
Check extension + MIME type
     │
     ├── .pdf  → try pdf-parse; if < 50 chars/page → OCR
     ├── .docx → mammoth
     ├── .xlsx → exceljs
     ├── .html → cheerio
     ├── .jpg/.png → tesseract or Azure DI
     └── .eml/.txt → mailparser or raw read
```

**BCP client reality:** 4 of 7 requirement PDFs are **scanned** — OCR is mandatory for TFS bundle.

---

## Text Cleaning (All Formats)

```
Raw extracted text
     │
     ▼
Remove: page numbers, headers/footers, repeated watermarks
     │
     ▼
Normalize: whitespace, line breaks, encoding (UTF-8)
     │
     ▼
Optional: detect Arabic + English sections
     │
     ▼
Ready for chunking OR requirement point extraction
```

---

## Limitations by Format

| Format | Limitation |
|--------|------------|
| PDF (text) | Tables may break; footnotes lost |
| PDF (scanned) | OCR errors; slow; needs Azure DI for production |
| Word | Old .doc needs LibreOffice conversion |
| Excel | Only cell values, not charts |
| HTML | Scripts stripped; layout lost |
| JPEG | Quality-dependent OCR |
| Email | Attachments need separate pass |

---

## Flow Into Chunking + Embedding

```
Extracted plain text
        │
        ├── doc_type = requirement → Point Extractor (04)
        │                              └── embed each point
        │
        └── doc_type = internal → Chunker (~500 tokens)
                                      └── embed each chunk → pgvector
```

---

## When to Use What

```
MVP / dev:     pdf-parse + tesseract.js (free, slower)
Production:    Azure Document Intelligence (client's scanned PDFs)
Hybrid:        text PDF → pdf-parse; scanned → Azure DI
```

---

## Summary

Multi-format extraction is the **first pipeline step**. Bad extraction = bad comparison. For BCP's client bundle, prioritize **OCR for scanned regulatory PDFs**.
