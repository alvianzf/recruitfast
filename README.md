<p align="center">
  <img src="frontend/public/icon-mark-512.png" alt="FastRecruit logo" width="96" height="96" />
</p>

# FastRecruit

[![Version](https://img.shields.io/badge/version-0.5.5-blue)](frontend/package.json)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)](frontend/package.json)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](frontend/package.json)
[![MUI](https://img.shields.io/badge/MUI-9-007FFF?logo=mui&logoColor=white)](frontend/package.json)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?logo=fastapi&logoColor=white)](backend/requirements.txt)
[![SQLAlchemy](https://img.shields.io/badge/SQLAlchemy-2-D71F00)](backend/requirements.txt)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-RLS-4169E1?logo=postgresql&logoColor=white)](backend/alembic/versions)
[![Redis](https://img.shields.io/badge/Redis-5-DC382D?logo=redis&logoColor=white)](backend/requirements.txt)

Multi-tenant recruitment SaaS for freelance recruiters and recruiting
agencies, with pipeline-driven job/candidate management and a confidentiality
boundary between platform operations and recruiter work.

Full product spec lives in [`docs/`](docs/00-overview.md), starting with
the [overview](docs/00-overview.md).

## Live

- App: https://fastrecruit.alvianzf.id
- API: https://fastrecruit-api.alvianzf.id
- Pricing: https://fastrecruit.alvianzf.id/pricing

## Features

- **Multi-tenant workspaces** — Org tenants (agencies, with an Org Admin
  managing recruiters) and a shared Freelance Org for independent
  recruiters. Freelance registration is open self-serve with immediate
  access — no approval gate; Org tenants are Superadmin-provisioned. A
  Superadmin can cap an org's recruiter seats (`max_recruiter_seats`,
  mirroring the pricing tiers below) — org_admin seats are separate and
  never capped.
- **Confidentiality by construction** — Postgres row-level security, not
  just UI hiding, keeps Superadmin locked out of every org's recruiter
  content; three narrow, deliberate, documented exceptions exist (open
  candidate profiles, the public job board, the platform-wide email
  blacklist registry) and nothing else.
- **Jobs & customizable pipelines** — default stage set cloned per job,
  freely reorder/rename/add/delete stages, `won`/`lost` job outcomes.
  Jobs can be assigned to a specific recruiter, to a whole Team (any
  recruiter on that team can self-claim it), or left open to the org.
  Org Admins never own a job themselves — creating/assigning isn't
  "doing recruiter work."
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
- **Clients & per-client revenue** (Org-only) — an org's own customer
  roster; jobs can optionally be tied to a client, with per-client job
  count, placement count, and multi-currency revenue metrics.
- **Role-aware dashboards** with real charts (funnel, breakdowns, workload)
  per role — Recruiter, Org Admin, Superadmin.
- **Notes** with team/private visibility, org admin recruiter management.
- **Pricing** — three tiers (Freelance Recruiter, Organization, Custom)
  with a full feature-comparison table; no live billing yet, registration
  stays free while that's built.
- **SEO/GEO** — dynamic per-page meta tags, `robots.txt`, a DB-driven
  `sitemap.xml`, and crawlable per-job Open Graph previews for social/AI
  crawlers (this app has no SSR, so a dedicated share endpoint + nginx
  crawler-detection stands in for it). See
  [10-job-board-and-applications.md](docs/10-job-board-and-applications.md#seo--geo).

## Local dev

See [07 — Tech Stack](docs/07-tech-stack.md#local-dev-setup-once-scaffolding-lands).
