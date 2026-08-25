# CV Parser

## Implementation status

**Only the deterministic half of this doc is built.** What actually ships
today (`backend/app/services/cv_parser.py`):

1. **Labeled-format parser** — regex/section extraction for resumes that
   use an explicit template with field labels (`NAME`, `POSITION`,
   `TECHNICAL SKILLS`, `MAIN PROJECTS`, `EDUCATION`, etc.). When a CV
   matches this template it produces the rich, sectioned output described
   below (skills, projects, education) at reasonable confidence — but
   `certifications` is never populated by this path either, a known gap.
2. **Generic fallback** — for any resume that doesn't match the labeled
   template: regex email/phone extraction + a "first plausible line" name
   guess. Everything else (`summary`, `technical_skills`, `education`,
   `certifications`, `main_projects`) comes back empty.

**Not implemented — the semantic SLM layer described below for free-text
resumes never got built.** No local model, no OCR, no `.doc`/LibreOffice
conversion. This is a real, documented gap versus the original ask, not
something the current code fakes — see the "Architecture" section below
for exactly which steps are real vs. target design, and
[08-open-questions-and-gaps.md](08-open-questions-and-gaps.md).

## Can it be accurate without a hosted LLM?

**Yes, and the labeled-format path proves it for one resume style — the
general free-text case is the unbuilt part.** The target design is a
hybrid pipeline of deterministic rule-based extraction plus a small,
**self-hosted** language model, getting good accuracy without ever
calling an external LLM API (OpenAI/Anthropic/etc.). See "Implementation
status" above for what's actually shipped versus this target.

Why this is the right call, not just a workaround:

- **Structured fields** (name, email, phone, links, dates) are highly
  regular in format — regex alone gets these right the large majority of
  the time with zero model inference cost (this part is built; the target
  design also called for spaCy's rule-based `Matcher`/NER, but the
  shipped parser is pure regex/section-splitting, no NLP library).
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

Given this, the answer to "if yes, build it" is yes — but as of today only
step 1 (partially) and step 2 below are actually built; steps 3 onward are
target design. See "Implementation status" at the top of this doc.

## Architecture

```
Upload (PDF/DOCX)                          ◄── image and legacy .doc NOT
   │                                            supported (target design
   ▼                                            said PDF/DOC/DOCX/image)
1. Text extraction ─── pdfplumber for PDFs  ◄── BUILT
   │                    python-docx for .docx (OOXML)  ◄── BUILT
   │
   │  PLANNED, NOT IMPLEMENTED:
   │  - LibreOffice headless (soffice --convert-to) for legacy .doc
   │  - Tesseract OCR fallback for scanned/image PDFs
   ▼
2. Structured extraction (deterministic, no model) ◄── BUILT, regex-only
   │  - regex: email, phone
   │  - labeled-format resumes: section-header string matching (NAME,
   │    POSITION, TECHNICAL SKILLS, MAIN PROJECTS, EDUCATION) — not NLP,
   │    just line-by-line parsing keyed on exact label text
   │  - everything else: "first plausible line" name guess only
   │
   │  PLANNED, NOT IMPLEMENTED: spaCy rule-based Matcher + NER for name/
   │  section-header/organization detection on unlabeled resumes
   ▼
3. PLANNED, NOT IMPLEMENTED — Semantic extraction (local SLM, JSON-schema constrained)
   │  - model: Qwen2.5-3B-Instruct or Phi-3.5-mini-instruct, quantized
   │    (Q4_K_M via llama.cpp / served through Ollama), self-hosted
   │  - input: the raw section text already isolated in step 2 (keeps
   │    the prompt small and focused, improves reliability)
   │  - output: constrained to a fixed JSON schema (work history entries,
   │    education entries, normalized skills list, professional summary)
   ▼
4. Confidence scoring ◄── BUILT, structured-fields half only
   │  - structured fields: match-certainty from the regex step, one flat
   │    score per top-level field (NOT per array item — see "Confidence
   │    granularity" below for how this differs from the target design)
   │
   │  PLANNED, NOT IMPLEMENTED: SLM fields scored by running extraction
   │  twice with different sampling seeds; fields that agree = high
   │  confidence, fields that disagree = flagged
   ▼
5. Persist to candidate_documents.parsed_fields + parse_confidence ◄── BUILT
   → parse_status is currently ALWAYS 'needs_review' — there's no
     confidence-threshold check that promotes to 'confirmed' yet, so
     every parse routes to human review regardless of field quality
```

## Parsed field schema (`candidate_documents.parsed_fields`)

This is the **target** shape (every key always present, `[]`/`null` when
empty — the frontend renders a stable set of sections either way). Shown
here as an example rather than an abstract schema because the shape only
really reads clearly with real data. **What's actually populated today:**
a labeled-format-template CV fills `name`/`position`/`summary`/
`technical_skills`/`main_projects`/`education` at the extraction methods
noted in "Field notes" below; `certifications` is never populated by any
current code path. A free-text resume that doesn't match the template
only gets `name`/`email`/`phone` — every other key comes back empty.

```json
{
  "name": "Ilham Dimas Hidayat",
  "position": "DevOps Engineer",
  "summary": [
    "DevOps Engineer with experience in cloud and on-premises infrastructure administration, containerization, orchestration, CI/CD automation, GitOps, and Infrastructure as Code.",
    "Experienced managing Kubernetes clusters, Docker-based environments, Linux servers, and hybrid infrastructure across enterprise environments."
  ],
  "total_years_experience": "7",
  "technical_skills": {
    "programming_languages_and_frameworks": [
      { "name": "Bash", "years_of_experience": "7", "last_used": "2026" },
      { "name": "Python", "years_of_experience": "3", "last_used": "2026" }
    ],
    "databases": [
      { "name": "PostgreSQL", "years_of_experience": "7", "last_used": "2026" }
    ],
    "ai_tools": [],
    "others": [
      { "name": "Kubernetes", "years_of_experience": "7", "last_used": "2026" },
      { "name": "Terraform", "years_of_experience": "4", "last_used": "2026" }
    ]
  },
  "education": [
    { "institution": "SMKN 1 Cimahi", "major": "Computer and Network Engineering", "year": "2015 - 2019" }
  ],
  "certifications": [
    { "name": "Ultimate AWS Certified Cloud Practitioner CLF-C02", "issuer": "Udemy", "year_issued": "2023" }
  ],
  "main_projects": [
    {
      "project_title": "Infrastructure Automation and Multi-Cluster Platform",
      "company_name": "Bobobox",
      "location": "Indonesia",
      "language": "English, Indonesian",
      "position": "DevOps Engineer",
      "duration": "09/2025 - Present",
      "duration_length": "0 years 9 months",
      "team_description": "Collaborated with developers and infrastructure stakeholders across multiple clusters and environments.",
      "project_description": "Managed cloud and on-premises infrastructure modernization, GitOps adoption, security enhancement, service mesh deployment, and platform automation initiatives.",
      "responsibilities": [
        "Optimized resource allocation, preventing underutilized usage to ensure the optimum cost-efficiency yet still reliable for request handling by automated scalability.",
        "Managed CI/CD workflows using GitHub Actions and ArgoCD, enhancing the delivery and deployment process, speed and consistency through cross cluster."
      ],
      "technologies_used": ["GCP", "Kubernetes", "Docker", "OpenTofu", "GitHub Actions", "ArgoCD"]
    }
  ]
}
```

**Field notes:**

*"Extraction method" below is the **target** design. The "Built today"
column is what `backend/app/services/cv_parser.py` actually does — the
labeled-format parser is regex/section-splitting keyed on literal label
text (e.g. a line reading exactly `TECHNICAL SKILLS`), not NLP or a model
of any kind; there is no semantic/SLM extraction anywhere in the codebase.*

| Field | Extraction method (target) | Built today | Notes |
|---|---|---|---|
| `name` | Structured (regex/NER) | Regex only; NER not implemented | |
| `position` | Semantic (SLM) | Labeled-format only, else `null` | The candidate's current/most recent or target role — distinct from `main_projects[].position`, which is the role held *during that specific engagement* (can differ, e.g. a promotion mid-tenure). |
| `summary` | Semantic (SLM) | Labeled-format only, else `[]` | Array of bullet strings, not one paragraph — mirrors how resumes actually present a summary and is easier to review/edit field-by-field than a wall of text. |
| `total_years_experience` | Semantic (SLM, computed) | Not implemented — always `null` | Stored as a string to match how it's displayed, not used arithmetically — don't rely on it for numeric sorting without a parse-time numeric cast. |
| `technical_skills.*` | Semantic (SLM) | Labeled-format only, else all `[]` | Four fixed categories (`programming_languages_and_frameworks`, `databases`, `ai_tools`, `others`) rather than a flat list — this is what makes the skills section scannable and filterable later. Empty categories stay as `[]`, never omitted, so the frontend can render a stable set of sections. Each skill entry (`name`, `years_of_experience`, `last_used`) is independently reviewable. |
| `education[]` | Semantic (SLM) | Labeled-format only, else `[]` | `institution`, `major`, `year` (year is the raw range string as written, e.g. `"2015 - 2019"` — not split into start/end at parse time). |
| `certifications[]` | Semantic (SLM) | **Never populated by any path today**, always `[]` | `name`, `issuer`, `year_issued`. |
| `main_projects[]` | Semantic (SLM) | Labeled-format only, else `[]` | The richest section — one entry per role/engagement, each with its own `responsibilities[]` and `technologies_used[]`. This is what backs the candidate's work-history timeline in the UI, not a separate `experience` field. |

**Confidence granularity** — target design matches how a recruiter would
actually review the document, not one score for the whole file:

- Scalar top-level fields (`name`, `position`, `total_years_experience`)
  each get one confidence score.
- Array sections (`technical_skills.*`, `education`, `certifications`,
  `main_projects`) get **one confidence score per array item** — e.g. one
  low-confidence project in a five-project history flags only that
  project's card for review, not the whole document. `parse_confidence`
  mirrors `parsed_fields`'s shape (same keys, same array indices) so the
  two can be zipped together directly when rendering.

**Implemented today:** `parse_confidence` is a flat dict keyed by
top-level field name only (e.g. `{"education": 0.85}`), one score per
field/section — not per array item. The per-item granularity above is
target design, not yet built.

**Denormalization note:** `position` and `total_years_experience` are
useful in list/table views (Candidates table, search) without parsing
JSONB on every row — worth copying onto `candidates.current_position` /
`candidates.total_years_experience` as convenience columns kept in sync
from the *current* `candidate_documents` version, the same way `full_name`
already lives on `candidates` rather than only in parsed data. Full
skills/education/certifications/project search (e.g. "find candidates
with Kubernetes experience") needs proper normalization — that's the
existing P1 "global talent-pool search & tagging" gap in
[08-open-questions-and-gaps.md](08-open-questions-and-gaps.md), not solved
by the JSONB blob alone.

## Confidence & human review

Per-field confidence is stored (`candidate_documents.parse_confidence`,
jsonb) and surfaced in the UI:

- High-confidence fields are shown as normal editable text.
- Low-confidence fields are visually flagged (e.g. amber underline) and a
  document with any flagged field is routed to a **review queue** — it is
  never silently auto-populated and marked done. A recruiter must confirm
  or correct flagged fields before `parse_status` becomes `confirmed`.
  **Implemented today:** every parse currently produces `needs_review`
  unconditionally — there's no confidence-threshold check, so
  `parse_status = 'confirmed'` is never actually assigned (the enum value
  exists but is dead code).
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
- **Same candidate, different job (or no job context yet):** target design
  is a prompt *"This candidate may already exist — attach to this job
  instead of creating a new candidate?"* rather than silently creating a
  duplicate profile. **Implemented today:** the duplicate check runs and
  surfaces a `possible_duplicate` match on preview, but the only commit
  resolutions are **Create new anyway** / **Skip this file** — there's no
  "attach to existing candidate" option anywhere yet, in this flow or the
  bulk-import one.
- File-level exact duplicates are also caught via `documents.checksum_sha256`
  before even running the pipeline.

## Non-English & scanned documents

**Not implemented.** No OCR (Tesseract or otherwise) and no
non-English-specific handling exist anywhere in the codebase — this whole
section is target design:

- OCR would handle scanned/image-based PDFs; output quality is naturally
  lower, so OCR'd documents would get a lower baseline confidence and be
  routed to review by default. Today, image uploads are simply rejected
  (`SUPPORTED_EXTENSIONS = {".pdf", ".docx"}`).
- Non-English resumes: the local SLM (once built) would need reasonable
  multilingual capability for common languages; today there's no
  language-specific handling at all — the regex/labeled-format parser
  either matches its English-language labels or falls back to the generic
  extractor regardless of the resume's language.

## Re-parse

**Not implemented.** There is no "Re-parse" action anywhere in the UI or
API today. Target design: if a better-quality file is uploaded later for
the same document version, or the pipeline improves, a recruiter could
trigger a new parse pass over the same stored file without re-uploading,
with manual corrections preserved as a diff rather than overwritten.

## Upload entry points

CV upload (single file or a batch of many, one candidate per file) and
CSV/Excel bulk import are the two ways candidates enter the system besides
manual entry. Both are modal-based, drop-zone-first flows with a mandatory
preview-before-commit step — full UX spec, including the bulk import
template and validation model, is in
[09-candidate-intake.md](09-candidate-intake.md).
