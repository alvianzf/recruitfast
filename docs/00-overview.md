# FastRecruit Product Overview

FastRecruit is a multi-tenant recruitment SaaS built for freelance/independent
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
  Self-registration grants immediate, active access — there is no
  Superadmin approval gate. A subscription/payment gate is the planned
  future replacement, not yet built (see
  [01-roles-permissions.md](01-roles-permissions.md) and
  [08-open-questions-and-gaps.md](08-open-questions-and-gaps.md)).

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

## Account and profile

Every authenticated user, any role, manages their own account from
`/app/profile` (`GET`/`PATCH /users/me`, `POST /users/me/password`): full
name, email, a profile picture (uploaded or pasted as a URL, see
[06-ui-design-system.md](06-ui-design-system.md)), and password. This is
separate from an org's public-facing profile (logo, description,
location; org_admin only, see
[10-job-board-and-applications.md](10-job-board-and-applications.md#org-profile-org_admin-editable)).
The app shell's user menu shows the real avatar image and full name
(fetched once via a shared `useMe()` hook) instead of a bare role-initial
letter.

## Core objects

- **Job / Open Position** — overview, a WYSIWYG-authored description (see
  [10-job-board-and-applications.md](10-job-board-and-applications.md)),
  JD file, custom fields, status, an optional salary range/confidential
  flag, owning recruiter(s), and a **Pipeline** of stages.
- **Candidate** — a person, not a pipeline entry. A candidate can be attached
  to **multiple job pipelines at once**; each attachment (a "placement")
  tracks its own stage independently. See
  [03-pipelines-and-boards.md](03-pipelines-and-boards.md).
- **Find Candidates** — a recruiter-facing skill search over the
  recruiter's own org candidates plus every platform-wide open-profile
  candidate, for reusing someone already in the system against a
  different job. See [03-pipelines-and-boards.md](03-pipelines-and-boards.md#find-candidates).
- **Pipeline** — customizable per job, cloned from a default/org template at
  job creation: `Sourced → CV Shortlist → Contacted → First Cut → User
  Interview → Offer → Signed → Reject`. `Signed`, not `Offer`, is the
  terminal-success stage — see [03-pipelines-and-boards.md](03-pipelines-and-boards.md).
  Jobs can be assigned directly to a recruiter or left in an **Unassigned
  Jobs** queue for any recruiter to self-claim.
- **Team** — Org Admins can group recruiters into teams and filter
  dashboard charts, including a per-recruiter performance breakdown, by
  team. See [01-roles-permissions.md](01-roles-permissions.md).
- **Public Job Board** — org-specific pages at a slug (plus a shared board
  for freelance recruiters), public/unlisted job visibility, and
  CV + cover-letter + screening-question applications with automatic
  eligibility routing into the pipeline. See
  [10-job-board-and-applications.md](10-job-board-and-applications.md).
- **Public marketing pages**: a dual-audience Landing page ("For
  recruiters and agencies" and "For candidates" sections, each with its
  own animated vector graphic), plus `/about`, `/faq`, and `/pricing`
  (added 2026-08-26: three tiers — IDR 35,000/month Freelance Recruiter,
  IDR 100,000/month Organization with 1 admin + 3 recruiter seats
  included (additional seats IDR 25,000/month each), and a Custom tier
  for larger agencies/enterprises with no listed price, "Talk to us"
  only; a full feature-by-feature comparison table (checks/crosses per
  tier) sits below the three cards — display only, no live billing yet,
  see the Billing note in
  [07-tech-stack.md](07-tech-stack.md#billing)), all unauthenticated and
  sharing the same nav/footer as the job board. See
  [10-job-board-and-applications.md](10-job-board-and-applications.md#marketing-and-informational-pages).
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

- Jobs and Candidates lists are always **Table**, filtered with a plain
  keyword search box plus point-and-click structured filters (status,
  assignment, seniority, job type on Jobs; source, blacklist on
  Candidates) — not a boolean query syntax. A job's own pipeline defaults
  to **Kanban** with a toggle back to Table. The toggle is currently local
  component state, not yet persisted per-user — see
  [03-pipelines-and-boards.md](03-pipelines-and-boards.md#search) and
  [06-ui-design-system.md](06-ui-design-system.md) for exact status.
- The Kanban ⋮ menu currently covers **Mark as Rejected** / **Mark as
  Withdrawn** (both keyboard/touch-accessible without drag); a full
  drag-and-drop-parity menu (e.g. "move to stage") is not yet built — see
  [06-ui-design-system.md](06-ui-design-system.md). Clicking a Kanban card
  itself opens the Candidate Quick View drawer below.
- The Candidates list has a **Quick View** side drawer (basic info,
  parsed CV data as a table, CV preview + download, Next/Prev to browse)
  for reviewing candidates without leaving the list — also reachable by
  clicking a Kanban card on a job's pipeline board — see
  [09-candidate-intake.md](09-candidate-intake.md).

Full detail: [03-pipelines-and-boards.md](03-pipelines-and-boards.md) and
[06-ui-design-system.md](06-ui-design-system.md).

## CV Parser

**Updated 2026-08-28 — flagged as drift.** The original design goal was
accurate CV parsing without ever calling an external LLM API, via a
hybrid rule-based + local Small Language Model (SLM) pipeline. That's no
longer what's shipped: a **hosted, third-party** LLM API call
(`backend/app/services/llm_cv_parser.py`) is live in production and runs
*first*, ahead of the deterministic labeled-format parser and generic
regex fallback — a deliberate departure from the original "no external
API, self-hosted only" decision, made at explicit product direction, not
an unbuilt gap. Full architecture, the original rationale (kept for
context), and current status: [04-cv-parser.md](04-cv-parser.md).

## Scope tiers

To keep the build sane, features are split into tiers. This spec designs
the data model to support all three (so P0 doesn't require painful
migrations later), but only P0 is built first.

- **P0 (MVP core loop)** — tenants/users/auth, jobs, candidates, pipelines
  (default + customizable), table/kanban views, drag-and-drop + ⋮ parity,
  CV parser, dashboards, freelance self-registration (immediate access, no
  approval gate), basic billing structure.
- **P1 (near-term)** — notes with @mentions, notifications, candidate
  dedup/merge UI, audit trail viewer, interview scheduling, org-level
  reporting/export.
- **P2 (later)** — candidate communication (email/SMS threads), offer
  letter generation/e-signature, client/hiring-manager external portal,
  global talent-pool search & tagging, GDPR self-service tooling.

Rationale for every P1/P2 item and the flows they close: see
[08-open-questions-and-gaps.md](08-open-questions-and-gaps.md).

## Security

An adversarial review of the actually-exploitable surface (public
endpoints, file uploads, auth) — findings, what was fixed, and what was
deliberately left as documented/accepted risk: see
[11-security-review.md](11-security-review.md).

## Tech stack (summary)

- **Backend:** Python, FastAPI, SQLAlchemy, Alembic — chosen so the CV
  Parser (today: `pdfplumber`/`python-docx` text extraction, a hosted
  LLM API call as the primary extraction tier, and regex/label parsing
  as a deterministic fallback — see [04-cv-parser.md](04-cv-parser.md))
  can run in-process without a cross-service hop.
- **Frontend:** React + MUI, custom-themed — an ink-blue primary ramp, a
  warm "Ember" secondary/accent, a shared status-color family, and a
  Space Grotesk (headings) + Inter (body) type scale. Surfaces are flat
  by default; the "signature glass" translucent treatment is reserved for
  the app shell's nav rail and public marketing/job-board pages — see
  [06-ui-design-system.md](06-ui-design-system.md).
- **Database:** PostgreSQL (local dev: db `recruitfast`; credentials via
  `.env`, never committed — see [07-tech-stack.md](07-tech-stack.md)).
- **Drag-and-drop:** `dnd-kit` (actively maintained; `react-beautiful-dnd`
  is deprecated).

Full detail: [07-tech-stack.md](07-tech-stack.md).
