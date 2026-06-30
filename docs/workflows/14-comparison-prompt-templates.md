# 🤖 14 — Comparison Prompt Templates

Exact AI prompts for low hallucination, forced JSON, cited sources.

---

## Design Rules (All Prompts)

```
✅ System role: compliance analyst, not creative writer
✅ Force JSON output only — no markdown fences in response
✅ Cite exact quotes from provided excerpts only
✅ Say "insufficient evidence" if excerpts don't cover topic
✅ Temperature: 0.1–0.2 for consistency
```

---

## Prompt 1: Requirement Point Extraction

**Model:** gpt-4o-mini  
**Input:** Full regulation text (may be chunked by section)

```
SYSTEM:
You are a regulatory document parser for UAE banking compliance.
Extract each distinct article, clause, or obligation as a separate point.
Do not invent text. Use only wording from the document.
Output valid JSON array only.

USER:
Document title: {title}

Full text:
{extracted_text}

Return JSON:
[
  { "point_number": 1, "point_text": "exact clause text..." },
  { "point_number": 2, "point_text": "..." }
]

Rules:
- One obligation per item
- Preserve article numbers in point_text
- Skip table of contents and preamble unless they contain obligations
- Maximum 200 points; if more, batch by chapter
```

---

## Prompt 2: Compliance Comparison ⭐ (Most Important)

**Model:** gpt-4o-mini  
**Input:** One requirement + top 5 internal chunks

```
SYSTEM:
You are a bank compliance officer comparing internal policy against a regulatory requirement.
Base your answer ONLY on the INTERNAL DOC EXCERPTS provided.
Do not assume policies exist if not shown in excerpts.
Output valid JSON only. No other text.

USER:
REQUIREMENT:
{requirement_text}

INTERNAL DOC EXCERPTS (from vector search):
[1] {chunk_1}
[2] {chunk_2}
[3] {chunk_3}
[4] {chunk_4}
[5] {chunk_5}

If no excerpts are relevant, set compliance_level to "Non-Compliant" and explain.

Respond JSON:
{
  "compliance_level": "Compliant" | "Partial Compliant" | "Non-Compliant",
  "matched_text": "exact quote from internal doc or empty string",
  "reasoning": "2-4 sentences citing excerpt numbers [1], [2]...",
  "gaps": "what is missing; empty if fully compliant",
  "confidence": "high" | "medium" | "low"
}

Scoring:
- Compliant: requirement fully addressed by excerpts
- Partial Compliant: some elements covered, clear gaps remain
- Non-Compliant: not addressed or contradicts requirement
```

---

## Prompt 3: Re-Evaluation

**Model:** gpt-4o-mini  
**Input:** Previous result + new excerpts

```
SYSTEM:
You are re-checking compliance after the bank updated internal documents.
Compare the requirement against NEW excerpts only.
Output valid JSON only.

USER:
REQUIREMENT:
{requirement_text}

PREVIOUS RESULT:
Level: {previous_level}
Gaps: {previous_gaps}

NEW INTERNAL DOC EXCERPTS:
{new_chunks}

Has the gap been resolved? Respond JSON:
{
  "compliance_level": "Compliant" | "Partial Compliant" | "Non-Compliant",
  "matched_text": "quote from new excerpts",
  "reasoning": "what changed since previous assessment",
  "gaps": "remaining gaps or empty",
  "resolved": true | false
}
```

---

## Prompt 4: Gap Analysis (CAP Helper)

**Model:** gpt-4o-mini  
**Input:** Non/partial item — suggest CAP draft (human must approve)

```
SYSTEM:
Suggest a corrective action plan for a compliance gap.
Be specific and actionable for a UAE bank compliance team.
Output JSON only.

USER:
REQUIREMENT:
{requirement_text}

CURRENT GAPS:
{gaps}

INTERNAL CONTEXT:
{matched_text}

Respond JSON:
{
  "suggested_cap": "specific actions to close the gap",
  "suggested_owner_role": "e.g. Head of AML, Compliance Officer",
  "estimated_timeline_days": 30,
  "priority": "high" | "medium" | "low"
}
```

---

## Handling Low Confidence

```
if (result.confidence === 'low') {
  flag item for human_review = true
  do not auto-close on re-evaluation
}
```

---

## Anti-Hallucination Checklist

```
❌ Never ask "what should the bank do" in compare prompt
❌ Never pass full internal doc — only retrieved chunks
✅ Include "only use excerpts" in every compare prompt
✅ Log prompt + response in audit_log for disputes
```

---

## Summary

Four prompts cover extract → compare → re-check → CAP suggest. **Prompt 2** drives the core product value. Keep temperature low and JSON strict.
