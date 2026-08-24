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
| Recruiter | One org tenant (or the Freelance Org) | Own work; org-shared candidate pool |

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
  Interview → Offer → Reject`.

## Views and interaction model

- Every list (Jobs, Candidates, a job's pipeline) defaults to **Table**;
  users can switch to **Kanban**, and the choice is remembered per user per
  list.
- Every action available via drag-and-drop is also available via a **"⋮"
  (three dots) menu** with identical, clickable actions — drag is an
  accelerator, never the only path (accessibility, touch devices, power
  users).

Full detail: [03-pipelines-and-boards.md](03-pipelines-and-boards.md) and
[06-ui-design-system.md](06-ui-design-system.md).

## CV Parser

Yes — accurate CV parsing is achievable **without calling an external LLM
API**, using a hybrid rule-based + local Small Language Model (SLM)
pipeline that runs entirely self-hosted. Full architecture and rationale:
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

- **Backend:** Python, FastAPI, SQLAlchemy, Alembic — chosen specifically
  because the CV Parser's ML pipeline (spaCy, local SLM inference) runs
  in-process without a cross-service hop.
- **Frontend:** React + MUI, styled to **Material Design 3**, glassmorphism
  surfaces, brand primary `#990000`.
- **Database:** PostgreSQL (local dev: db `recruitfast`, user `postgres`,
  password `REDACTED`).
- **Drag-and-drop:** `dnd-kit` (actively maintained; `react-beautiful-dnd`
  is deprecated).

Full detail: [07-tech-stack.md](07-tech-stack.md).
