# CV Parser

## Can it be accurate without a hosted LLM?

**Yes — and it's the recommended approach, not a fallback.** A hybrid
pipeline of deterministic rule-based extraction plus a small, **self-hosted**
language model gets good accuracy without ever calling an external LLM API
(OpenAI/Anthropic/etc.). This is being built now rather than deferred.

Why this is the right call, not just a workaround:

- **Structured fields** (name, email, phone, links, dates) are highly
  regular in format — regex + spaCy's rule-based `Matcher`/NER gets these
  right the large majority of the time with zero model inference cost.
- **Unstructured sections** (job titles/descriptions inside a work-history
  block, skills buried in prose, summaries) are where accuracy genuinely
  needs language understanding — resume layouts vary too much for pure
  regex. This is where a model helps, but it does **not** need to be a
  large hosted LLM: a quantized 3B–4B instruct model running locally,
  constrained to emit a fixed JSON schema, is enough for extraction (not
  open-ended generation) and runs on modest hardware.
- **Self-hosting the model is a feature, not just a cost-saver.** Resumes
  are PII-heavy. Never sending candidate data to a third-party API is a
  material selling point for an agency-facing product, and avoids
  per-parse API billing entirely.

Given this, the answer to "if yes, build it" is: yes, it's specified below
as a P0 component.

## Architecture

```
Upload (PDF/DOCX/image)
   │
   ▼
1. Text extraction ─── pdfplumber / PyMuPDF for text PDFs
   │                    docx2txt for Word
   │                    Tesseract OCR fallback for scanned/image PDFs
   ▼
2. Structured extraction (deterministic, no model)
   │  - regex: email, phone, URLs, dates
   │  - spaCy rule-based Matcher + NER: candidate name, section headers
   │    (Experience / Education / Skills), organization names
   ▼
3. Semantic extraction (local SLM, JSON-schema constrained)
   │  - model: Qwen2.5-3B-Instruct or Phi-3.5-mini-instruct, quantized
   │    (Q4_K_M via llama.cpp / served through Ollama), self-hosted
   │  - input: the raw section text already isolated in step 2 (keeps
   │    the prompt small and focused, improves reliability)
   │  - output: constrained to a fixed JSON schema (work history entries,
   │    education entries, normalized skills list, professional summary)
   ▼
4. Confidence scoring
   │  - structured fields: match-certainty from the regex/NER step
   │  - SLM fields: run extraction twice with different sampling seeds;
   │    fields that agree = high confidence, fields that disagree = flagged
   ▼
5. Persist to candidate_documents.parsed_fields + parse_confidence
   → parse_status = 'confirmed' if all fields ≥ threshold,
     else 'needs_review'
```

## Confidence & human review

Per-field confidence is stored (`candidate_documents.parse_confidence`,
jsonb) and surfaced in the UI:

- High-confidence fields are shown as normal editable text.
- Low-confidence fields are visually flagged (e.g. amber underline) and a
  document with any flagged field is routed to a **review queue** — it is
  never silently auto-populated and marked done. A recruiter must confirm
  or correct flagged fields before `parse_status` becomes `confirmed`.
- Every field remains manually editable regardless of confidence.
  Recruiter-edited values are visually distinguished from parser output
  (e.g. a small "edited" tag), so it's always clear what the model produced
  vs. what a human corrected — this feeds future accuracy review.

## Duplicate / reapplication handling

CV upload is the primary entry point for the dedup logic described in
[02-data-model.md](02-data-model.md#candidate_documents) and
[03-pipelines-and-boards.md](03-pipelines-and-boards.md#reapplication-to-the-same-job):

- On upload, compute `dedup_fingerprint` (normalized email + phone + name
  hash) and check for an existing candidate match.
- **Same candidate, same job:** treated as a reapplication — new
  `candidate_documents` version, existing `pipeline_placements` row
  untouched, table shows one row with the latest version by default.
- **Same candidate, different job (or no job context yet):** prompt
  *"This candidate may already exist — attach to this job instead of
  creating a new candidate?"* rather than silently creating a duplicate
  profile.
- File-level exact duplicates are also caught via `documents.checksum_sha256`
  before even running the pipeline.

## Non-English & scanned documents

- OCR (Tesseract) handles scanned/image-based PDFs; output quality is
  naturally lower, so OCR'd documents get a lower baseline confidence and
  are routed to review by default.
- Non-English resumes: the local SLM candidates above (Qwen2.5, Phi-3.5)
  have reasonable multilingual capability for common languages; where
  confidence is low, the fallback is graceful manual entry with the raw
  file still attached, stored, and full-text searchable — never a hard
  failure that blocks adding the candidate.

## Re-parse

If a better-quality file is uploaded later for the same document version,
or the pipeline is improved, a recruiter can trigger "Re-parse" from the ⋮
menu — this creates a new parse pass over the same stored file without
requiring a re-upload, and the recruiter's manual corrections on the
current version are preserved as a diff, not overwritten silently.
