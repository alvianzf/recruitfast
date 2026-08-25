# RecruitFast — Product Overview

RecruitFast is a multi-tenant recruitment SaaS built for freelance/independent
recruiters and recruiting agencies. It gives recruiters a pipeline-driven
workspace for open positions and candidates, with confidentiality boundaries
that let a platform operator run the business side without ever seeing a
recruiter's actual work.

## Tenant model

Two kinds of tenant share the same platform:

- **Org tenant** — a recruiting agency/company. One **Org Admin** owns the
  tenant and manages any number of **Recruiters** under it.
- **Freelance Org** — a single, platform-owned tenant that houses independent
  freelance recruiters who self-register via the public **Register** flow.
  Membership is gated by Superadmin approval (see
  [01-roles-permissions.md](01-roles-permissions.md)).

Every job, candidate, pipeline, note, and document belongs to exactly one
tenant. Cross-tenant access is enforced at the database layer (Postgres
row-level security), not just in the UI — see
[02-data-model.md](02-data-model.md).

## Roles

| Role | Scope | Can see recruiter work? |
|---|---|---|
| Superadmin | Platform-wide | No — architecturally blocked, not just hidden in UI |
| Org Admin | One org tenant | Yes — full visibility into their org's recruiters |
| Recruiter | One org tenant (or the Freelance Org) | Jobs are org-shared everywhere (job *ownership*/assignment is per-recruiter, job *visibility* is org-wide). Candidates are org-shared in an **Org tenant**, but **private to the uploading/receiving recruiter by default in the Freelance Org** — see [01-roles-permissions.md](01-roles-permissions.md). |

Full detail: [01-roles-permissions.md](01-roles-permissions.md).

## Core objects

- **Job / Open Position** — overview, description, JD (file + rich text),
  custom fields, status, owning recruiter(s), and a **Pipeline** of stages.
- **Candidate** — a person, not a pipeline entry. A candidate can be attached
  to **multiple job pipelines at once**; each attachment (a "placement")
  tracks its own stage independently. See
  [03-pipelines-and-boards.md](03-pipelines-and-boards.md).
- **Pipeline** — customizable per job, cloned from a default/org template at
  job creation: `Sourced → CV Shortlist → Contacted → First Cut → User
  Interview → Offer → Reject`. Jobs can be assigned directly to a
  recruiter or left in an **Unassigned Jobs** queue for any recruiter to
  self-claim.
- **Team** — Org Admins can group recruiters into teams and filter
  dashboard charts, including a per-recruiter performance breakdown, by
  team. See [01-roles-permissions.md](01-roles-permissions.md).
- **Public Job Board** — org-specific pages at a slug (plus a shared board
  for freelance recruiters), public/unlisted job visibility, and
  CV + cover-letter + screening-question applications with automatic
  eligibility routing into the pipeline. See
  [10-job-board-and-applications.md](10-job-board-and-applications.md).
- **Blacklist** — a per-tenant `blacklisted` flag on a candidate, plus a
  platform-wide, cross-tenant email registry: if a blacklisted email
  applies elsewhere, that recruiter sees a flag (reason + date only, no
  attribution) regardless of tenant. See
  [01-roles-permissions.md](01-roles-permissions.md) and
  [02-data-model.md](02-data-model.md).
- **CSV/Excel bulk candidate import** — a preview-before-commit flow with
  duplicate detection, backend-only today (see
  [09-candidate-intake.md](09-candidate-intake.md) for UI status).

## Views and interaction model

- Jobs and Candidates lists are always **Table**; a job's own pipeline
  defaults to **Kanban** with a toggle back to Table. The toggle is
  currently local component state, not yet persisted per-user — see
  [06-ui-design-system.md](06-ui-design-system.md) for exact status.
- The Kanban ⋮ menu currently covers **Mark as Rejected** / **Mark as
  Withdrawn** (both keyboard/touch-accessible without drag); a full
  drag-and-drop-parity menu (e.g. "move to stage") is not yet built — see
  [06-ui-design-system.md](06-ui-design-system.md).
- The Candidates list has a **Quick View** side drawer (basic info,
  parsed CV data as a table, CV preview + download, Next/Prev to browse)
  for reviewing candidates without leaving the list — see
  [09-candidate-intake.md](09-candidate-intake.md).

Full detail: [03-pipelines-and-boards.md](03-pipelines-and-boards.md) and
[06-ui-design-system.md](06-ui-design-system.md).

## CV Parser

Accurate CV parsing without calling an external LLM API is the design
goal, targeted via a hybrid rule-based + local Small Language Model (SLM)
pipeline. **Only the rule-based half is built today** — a labeled-format
parser plus a generic regex/heuristic fallback, both deterministic; the
local-SLM semantic layer for free-text resumes is a documented gap, not
yet implemented. Full architecture, rationale, and current status:
[04-cv-parser.md](04-cv-parser.md).

## Scope tiers

To keep the build sane, features are split into tiers. This spec designs
the data model to support all three (so P0 doesn't require painful
migrations later), but only P0 is built first.

- **P0 (MVP core loop)** — tenants/users/auth, jobs, candidates, pipelines
  (default + customizable), table/kanban views, drag-and-drop + ⋮ parity,
  CV parser, dashboards, freelance registration + approval, basic billing
  structure.
- **P1 (near-term)** — notes with @mentions, notifications, candidate
  dedup/merge UI, audit trail viewer, interview scheduling, org-level
  reporting/export.
- **P2 (later)** — candidate communication (email/SMS threads), offer
  letter generation/e-signature, client/hiring-manager external portal,
  global talent-pool search & tagging, GDPR self-service tooling.

Rationale for every P1/P2 item and the flows they close: see
[08-open-questions-and-gaps.md](08-open-questions-and-gaps.md).

## Tech stack (summary)

- **Backend:** Python, FastAPI, SQLAlchemy, Alembic — chosen so the CV
  Parser (today: `pdfplumber`/`python-docx` text extraction + regex/label
  parsing; planned: local SLM inference for free-text resumes, see
  [04-cv-parser.md](04-cv-parser.md)) can run in-process without a
  cross-service hop.
- **Frontend:** React + MUI, styled to **Material Design 3**, glassmorphism
  surfaces, brand primary `#990000`.
- **Database:** PostgreSQL (local dev: db `recruitfast`; credentials via
  `.env`, never committed — see [07-tech-stack.md](07-tech-stack.md)).
- **Drag-and-drop:** `dnd-kit` (actively maintained; `react-beautiful-dnd`
  is deprecated).

Full detail: [07-tech-stack.md](07-tech-stack.md).
