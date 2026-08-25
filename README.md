# RecruitFast

Multi-tenant recruitment SaaS for freelance recruiters and recruiting
agencies — pipeline-driven job/candidate management with a confidentiality
boundary between platform operations and recruiter work.

Full product spec lives in [`docs/`](docs/00-overview.md), starting with
the [overview](docs/00-overview.md).

## Features

- **Multi-tenant workspaces** — Org tenants (agencies, with an Org Admin
  managing recruiters) and a shared Freelance Org for independent
  recruiters, self-registered and Superadmin-approved.
- **Confidentiality by construction** — Postgres row-level security, not
  just UI hiding, keeps Superadmin locked out of every org's recruiter
  content; three narrow, deliberate, documented exceptions exist (open
  candidate profiles, the public job board, the platform-wide email
  blacklist registry) and nothing else.
- **Jobs & customizable pipelines** — default stage set cloned per job,
  freely reorder/rename/add/delete stages, `won`/`lost` job outcomes.
- **Kanban + Table views everywhere**, drag-and-drop with a full ⋮-menu
  equivalent for every action (touch/keyboard parity).
- **CV parsing** — PDF/DOCX text extraction, a labeled-field parser for
  structured resume formats plus a generic regex fallback, confidence
  scoring, and a review queue — no hosted LLM required.
- **CV upload & CSV/Excel bulk import** for candidates, both with a
  preview-before-commit step and duplicate detection.
- **Public job board** — per-org pages at a readable slug, a shared board
  for freelance recruiters, public/unlisted job visibility, CV + cover
  letter + screening-question applications with automatic eligibility
  routing into the pipeline.
- **Open profiles** — candidates can opt in to being discoverable by any
  recruiter platform-wide, via one narrowly-scoped RLS exception.
- **Role-aware dashboards** with real charts (funnel, breakdowns, workload)
  per role — Recruiter, Org Admin, Superadmin.
- **Notes** with team/private visibility, org admin recruiter management,
  freelance approval queue.

## Local dev

See [07 — Tech Stack](docs/07-tech-stack.md#local-dev-setup-once-scaffolding-lands).
