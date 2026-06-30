# Landing AI — BCP Integration

Landing AI **Agentic Document Extraction (ADE)** is used to parse government requirement documents and internal policy documents into structured, numbered points before compliance comparison.

## Documents in this folder

| Doc | Purpose |
|-----|---------|
| [01-end-to-end-workflow.md](./01-end-to-end-workflow.md) | Step 1 & Step 2 process — gov law vs internal docs |
| [02-architecture.md](./02-architecture.md) | System boxes, data flow, dual outputs |
| [03-developer-setup-guide.md](./03-developer-setup-guide.md) | Sign up, API key, env vars, first test |
| [04-output-formats.md](./04-output-formats.md) | Compliance PDF report + annotated internal PDF |
| [05-bcp-api-endpoints.md](./05-bcp-api-endpoints.md) | NestJS routes for parse / extract / status |
| [DUAL_VERIFY_AND_ANALYSIS_WORKFLOW.md](../landing-ai/DUAL_VERIFY_AND_ANALYSIS_WORKFLOW.md) | Box workflows, models, prompts (section/leaf + dual-verify) |

## Related

- [Supabase persistence](../supabase/README.md) — cache ADE results (save credits)
- [System architecture](../workflows/01-system-architecture.md) — overall BCP stack
- [Comparison engine](../workflows/05-comparison-engine.md) — Compliant / Partial / Non-Compliant
- [Excel output](../workflows/06-excel-output-generation.md) — `.xlsx` export

## Quick summary

```
Gov requirement PDF  ──► Landing AI Parse + Extract ──► gov points (DB)
Internal policy PDF  ──► Landing AI Parse + Extract ──► internal points (DB)
                              │
                              ▼
                    Gemini comparison (per gov point)
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
     Compliance report PDF            Annotated internal PDF
     (like bcp-compliance2-report)     (highlights where each law maps)
              │
              ▼
         Excel + MIS Dashboard + Alerts
```
