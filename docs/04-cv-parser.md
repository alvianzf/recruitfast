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
Upload (PDF/DOC/DOCX/image)
   │
   ▼
1. Text extraction ─── pdfplumber / PyMuPDF for text PDFs
   │                    docx2txt / python-docx for .docx (OOXML)
   │                    LibreOffice headless (soffice --convert-to) for
   │                    legacy .doc (binary format) → convert to .docx/
   │                    text first, then reuse the .docx path. .doc has
   │                    no good pure-Python parser; this is the one format
   │                    in scope that needs an external process.
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

## Parsed field schema (`candidate_documents.parsed_fields`)

This is the canonical shape every parse produces, regardless of source
format (PDF/DOC/DOCX) — the JSON stored in `parsed_fields` (jsonb). Shown
here as an example rather than an abstract schema because the shape only
really reads clearly with real data:

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

| Field | Extraction method | Notes |
|---|---|---|
| `name` | Structured (regex/NER) | |
| `position` | Semantic (SLM) | The candidate's current/most recent or target role — distinct from `main_projects[].position`, which is the role held *during that specific engagement* (can differ, e.g. a promotion mid-tenure). |
| `summary` | Semantic (SLM) | Array of bullet strings, not one paragraph — mirrors how resumes actually present a summary and is easier to review/edit field-by-field than a wall of text. |
| `total_years_experience` | Semantic (SLM, computed) | Stored as a string to match how it's displayed, not used arithmetically — don't rely on it for numeric sorting without a parse-time numeric cast. |
| `technical_skills.*` | Semantic (SLM) | Four fixed categories (`programming_languages_and_frameworks`, `databases`, `ai_tools`, `others`) rather than a flat list — this is what makes the skills section scannable and filterable later. Empty categories stay as `[]`, never omitted, so the frontend can render a stable set of sections. Each skill entry (`name`, `years_of_experience`, `last_used`) is independently reviewable. |
| `education[]` | Semantic (SLM) | `institution`, `major`, `year` (year is the raw range string as written, e.g. `"2015 - 2019"` — not split into start/end at parse time). |
| `certifications[]` | Semantic (SLM) | `name`, `issuer`, `year_issued`. |
| `main_projects[]` | Semantic (SLM) | The richest section — one entry per role/engagement, each with its own `responsibilities[]` and `technologies_used[]`. This is what backs the candidate's work-history timeline in the UI, not a separate `experience` field. |

**Confidence granularity** matches how a recruiter would actually review
the document, not one score for the whole file:

- Scalar top-level fields (`name`, `position`, `total_years_experience`)
  each get one confidence score.
- Array sections (`technical_skills.*`, `education`, `certifications`,
  `main_projects`) get **one confidence score per array item** — e.g. one
  low-confidence project in a five-project history flags only that
  project's card for review, not the whole document. `parse_confidence`
  mirrors `parsed_fields`'s shape (same keys, same array indices) so the
  two can be zipped together directly when rendering.

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

## Upload entry points

CV upload (single file or a batch of many, one candidate per file) and
CSV/Excel bulk import are the two ways candidates enter the system besides
manual entry. Both are modal-based, drop-zone-first flows with a mandatory
preview-before-commit step — full UX spec, including the bulk import
template and validation model, is in
[09-candidate-intake.md](09-candidate-intake.md).
