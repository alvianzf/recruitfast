# CV Parser

## Implementation status

**Updated 2026-08-28 — flagged as drift and rewritten.** Everything below
this point through "Architecture" previously described a "self-hosted
only, no external LLM API" design as both the target *and* (for the
semantic layer) an honest "not built yet." That framing is now stale on
both counts: a **hosted** LLM tier is live in production, tried
**before** the deterministic tiers, not after. See
`backend/app/services/llm_cv_parser.py` and `cv_parser.py`'s own module
docstring, which call this out directly as "a deliberate departure from
the original 'no external LLM API' architecture decision... added at
explicit product direction with a real API key, not something to
silently prefer." This section now describes what's actually live; the
original self-hosted-SLM rationale is kept below under "Original design
rationale (superseded)" since the reasoning itself is still worth
recording even though the decision changed.

What actually ships today, tried **in this order** (`cv_parser.py`'s
`parse_cv_text`):

0. **LLM extraction** (tier 0, tried first) — when `settings.llm_api_key`
   is configured (it is, in production), a hosted OpenAI-compatible API
   call (`llm_cv_parser.py`, default `https://ai.sumopod.com/v1`,
   `gemini/gemini-3.1-flash-lite`) does the full semantic extraction:
   `name`, `position`, `location` (added 2026-08-27), `summary`,
   `total_years_experience`, `technical_skills.*`, `education[]`,
   `certifications[]` (a real gap in every other tier — see below — but
   filled here), and `main_projects[]`. Every top-level key the schema
   promises comes back populated or explicitly empty, never omitted
   (`_normalize`'s job). Falls through to tier 1 on any failure (network
   error, invalid JSON, unexpected shape) — never raises.
1. **Labeled-format parser** — regex/section extraction for resumes that
   use an explicit template with field labels (`NAME`, `POSITION`,
   `TECHNICAL SKILLS`, `MAIN PROJECTS`, `EDUCATION`, etc.). Only reached
   when the LLM tier is disabled or fails. When a CV matches this
   template it produces the rich, sectioned output described below
   (skills, projects, education) at reasonable confidence — but
   `certifications` and `location` are never populated by this path, a
   known gap (no `LOCATION` label exists in this template's `BASIC INFO`
   block, only a per-project location inside `MAIN PROJECTS`, a
   different concept — see the field notes table below).
2. **Generic fallback** — for any resume that doesn't match the labeled
   template and when the LLM tier is off/failed: regex email/phone
   extraction + a "first plausible line" name guess. Everything else
   (`summary`, `location`, `technical_skills`, `education`,
   `certifications`, `main_projects`) comes back empty.

**Still not implemented**: OCR for scanned/image PDFs, `.doc`/LibreOffice
conversion, and a local/self-hosted model (the LLM tier above is hosted,
third-party, not self-hosted — see "Original design rationale" below for
why that distinction mattered to the original design and what changed).
See [08-open-questions-and-gaps.md](08-open-questions-and-gaps.md).

## Original design rationale (superseded 2026-08-27)

**This section is historical — kept for the reasoning, not as a current
description of the system.** The original target design was a hybrid
pipeline of deterministic rule-based extraction plus a small,
**self-hosted** language model, getting good accuracy without ever
calling an external LLM API (OpenAI/Anthropic/etc.):

- **Structured fields** (name, email, phone, links, dates) are highly
  regular in format — regex alone gets these right the large majority of
  the time with zero model inference cost (this part is built; the
  target design also called for spaCy's rule-based `Matcher`/NER, but
  the shipped regex/section-splitting parser never used an NLP library).
- **Unstructured sections** (job titles/descriptions inside a
  work-history block, skills buried in prose, summaries) are where
  accuracy genuinely needs language understanding — resume layouts vary
  too much for pure regex. The original plan called for a quantized
  3B–4B instruct model running locally rather than a large hosted LLM.
- **Self-hosting the model was considered a feature, not just a
  cost-saver** — resumes are PII-heavy, and never sending candidate data
  to a third-party API was framed as a material selling point for an
  agency-facing product, plus avoiding per-parse API billing.

**What actually happened**: at explicit product direction, a real hosted
LLM API key was wired in instead — see "Implementation status" above.
Candidate CV data (PII) is now sent to a third-party hosted API
(`ai.sumopod.com`) on every parse where the LLM tier runs; this is a real
tradeoff against the original privacy/cost rationale above, made
knowingly, not accidentally. Worth revisiting if this product's
positioning ever leans on a "your candidates' data never leaves your
infrastructure" claim — that claim is no longer true as shipped.

## Architecture

```
Upload (PDF/DOCX)                          ◄── image and legacy .doc NOT
   │                                            supported
   ▼
1. Text extraction ─── pdfplumber for PDFs  ◄── BUILT
   │                    python-docx for .docx (OOXML)  ◄── BUILT
   │
   │  PLANNED, NOT IMPLEMENTED:
   │  - LibreOffice headless (soffice --convert-to) for legacy .doc
   │  - Tesseract OCR fallback for scanned/image PDFs
   ▼
2. Semantic extraction — hosted LLM (tier 0) ◄── BUILT, tried FIRST
   │  - real OpenAI-compatible hosted API call (llm_cv_parser.py), not
   │    a local/self-hosted model — see "Original design rationale" above
   │    for why that distinction was originally load-bearing
   │  - fills every field: name, position, location, summary,
   │    total_years_experience, technical_skills.*, education[],
   │    certifications[], main_projects[]
   │  - falls through to step 3 on any failure, never raises
   ▼
3. Structured extraction (deterministic, no model) ◄── BUILT, regex-only
   │  - only reached when the LLM tier is off or fails
   │  - regex: email, phone
   │  - labeled-format resumes: section-header string matching (NAME,
   │    POSITION, TECHNICAL SKILLS, MAIN PROJECTS, EDUCATION) — not NLP,
   │    just line-by-line parsing keyed on exact label text
   │  - everything else: "first plausible line" name guess only
   │
   │  PLANNED, NOT IMPLEMENTED: spaCy rule-based Matcher + NER for name/
   │  section-header/organization detection on unlabeled resumes
   ▼
4. Confidence scoring ◄── BUILT for both the LLM tier and the
   │                        structured-fields tier
   │  - LLM tier: flat 0.8-per-populated-field / 0.0-per-empty-field
   │    (llm_cv_parser.py's `_confidence_for`) — not per-array-item
   │  - structured fields: match-certainty from the regex step, one flat
   │    score per top-level field (NOT per array item — see "Confidence
   │    granularity" below for how this differs from the target design)
   │
   │  PLANNED, NOT IMPLEMENTED: per-array-item confidence (either tier);
   │  the LLM tier could also be scored by running extraction twice with
   │  different sampling seeds and flagging fields that disagree — not
   │  built, still target design
   ▼
5. Persist to candidate_documents.parsed_fields + parse_confidence ◄── BUILT
   → parse_status is currently ALWAYS 'needs_review' — there's no
     confidence-threshold check that promotes to 'confirmed' yet, so
     every parse routes to human review regardless of field quality
```

## Parsed field schema (`candidate_documents.parsed_fields`)

This is the actual current shape (every key always present, `[]`/`null`
when empty — the frontend renders a stable set of sections either way).
Shown here as an example rather than an abstract schema because the
shape only really reads clearly with real data. **What's actually
populated, updated 2026-08-28 (previously described this table as mostly
target design — that's stale, see "Implementation status" above):**
whenever the LLM tier runs (the default in production), **every** field
below is filled, including `location` and `certifications` — the two
fields the deterministic tiers can't produce. Only when the LLM tier is
off/fails does the tier fall back to the older, narrower behavior: a
labeled-format-template CV fills `name`/`position`/`summary`/
`technical_skills`/`main_projects`/`education` (never `certifications` or
`location`); a free-text resume that doesn't match the template only
gets `name`/`email`/`phone` — every other key comes back empty.

```json
{
  "name": "Jane Doe",
  "position": "DevOps Engineer",
  "location": "Jakarta, Indonesia",
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
    { "institution": "Example State University", "major": "Computer and Network Engineering", "year": "2015 - 2019" }
  ],
  "certifications": [
    { "name": "Example AWS Certified Cloud Practitioner CLF-C02", "issuer": "Example Learning Platform", "year_issued": "2023" }
  ],
  "main_projects": [
    {
      "project_title": "Infrastructure Automation and Multi-Cluster Platform",
      "company_name": "Example Corp",
      "location": "Example Country",
      "language": "English",
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

**Field notes** (updated 2026-08-28 — the table previously called every
row below "Semantic (SLM)... target design, not built"; that's stale now
that the LLM tier is live and primary — see "Implementation status"
above):

| Field | Extraction method | Built today | Notes |
|---|---|---|---|
| `name` | LLM tier; regex fallback | LLM tier: yes. Fallback tiers: regex/"first plausible line" only, no NER | |
| `position` | LLM tier; labeled-format fallback | LLM tier: yes. Fallback: labeled-format only, else `null` | The candidate's current/most recent or target role — distinct from `main_projects[].position`, which is the role held *during that specific engagement* (can differ, e.g. a promotion mid-tenure). |
| `location` | **LLM tier only** | LLM tier: yes (added 2026-08-27). Fallback tiers: `null` — neither has a source for it | The candidate's current city/country ("where they live," e.g. `"Jakarta, Indonesia"`) — distinct from `main_projects[].location`, which is where a specific past engagement was based (often remote/different country). Denormalized onto `candidates.location`, same as `position`. |
| `summary` | LLM tier; labeled-format fallback | LLM tier: yes. Fallback: labeled-format only, else `[]` | Array of bullet strings, not one paragraph — mirrors how resumes actually present a summary and is easier to review/edit field-by-field than a wall of text. |
| `total_years_experience` | LLM tier only (computed by the model) | LLM tier: yes. Fallback tiers: always `null` — no deterministic computation of this exists | Stored as a string to match how it's displayed, not used arithmetically — don't rely on it for numeric sorting without a parse-time numeric cast. |
| `technical_skills.*` | LLM tier; labeled-format fallback | LLM tier: yes. Fallback: labeled-format only, else all `[]` | Four fixed categories (`programming_languages_and_frameworks`, `databases`, `ai_tools`, `others`) rather than a flat list — this is what makes the skills section scannable and filterable later. Empty categories stay as `[]`, never omitted, so the frontend can render a stable set of sections. Each skill entry (`name`, `years_of_experience`, `last_used`) is independently reviewable. |
| `education[]` | LLM tier; labeled-format fallback | LLM tier: yes. Fallback: labeled-format only, else `[]` | `institution`, `major`, `year` (year is the raw range string as written, e.g. `"2015 - 2019"` — not split into start/end at parse time). |
| `certifications[]` | **LLM tier only** | LLM tier: yes. Fallback tiers: **never populated**, always `[]` | `name`, `issuer`, `year_issued`. |
| `main_projects[]` | LLM tier; labeled-format fallback | LLM tier: yes. Fallback: labeled-format only, else `[]` | The richest section — one entry per role/engagement, each with its own `responsibilities[]` and `technologies_used[]`. This is what backs the candidate's work-history timeline in the UI, not a separate `experience` field. |

The upshot: in production, where the LLM tier is enabled by default,
every row above is filled on every successful parse. The "Fallback
tiers" column only matters when `settings.llm_api_key` is unset or the
LLM call fails — a real, still-relevant path (self-hosted/on-prem
deployments without an LLM key configured, or a provider outage), just
no longer the *primary* path this table should be read as describing.

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

**Denormalization note:** `position`, `total_years_experience`, and
`location` are useful in list/table views (Candidates table, search,
Quick View, candidate detail page) without parsing JSONB on every row —
worth copying onto `candidates.current_position` /
`candidates.total_years_experience` / `candidates.location` as
convenience columns kept in sync from the *current* `candidate_documents`
version, the same way `full_name` already lives on `candidates` rather
than only in parsed data. Full
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
