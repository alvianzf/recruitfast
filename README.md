<p align="center">
  <img src="frontend/public/icon-mark-512.png" alt="FastRecruit logo" width="96" height="96" />
</p>

<h1 align="center">FastRecruit</h1>

<p align="center">
  Multi-tenant recruitment SaaS where tenant isolation is a database guarantee, not an application convention.
</p>

<p align="center">
  <a href="frontend/package.json"><img src="https://img.shields.io/badge/version-0.5.5-blue" alt="Version" /></a>
  <a href="frontend/package.json"><img src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white" alt="React" /></a>
  <a href="frontend/package.json"><img src="https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white" alt="TypeScript" /></a>
  <a href="frontend/package.json"><img src="https://img.shields.io/badge/MUI-9-007FFF?logo=mui&logoColor=white" alt="MUI" /></a>
  <a href="backend/requirements.txt"><img src="https://img.shields.io/badge/FastAPI-0.115-009688?logo=fastapi&logoColor=white" alt="FastAPI" /></a>
  <a href="backend/requirements.txt"><img src="https://img.shields.io/badge/SQLAlchemy-2-D71F00" alt="SQLAlchemy" /></a>
  <a href="backend/alembic/versions"><img src="https://img.shields.io/badge/PostgreSQL-RLS-4169E1?logo=postgresql&logoColor=white" alt="PostgreSQL" /></a>
  <a href="backend/requirements.txt"><img src="https://img.shields.io/badge/Redis-5-DC382D?logo=redis&logoColor=white" alt="Redis" /></a>
</p>

**Live app:** https://fastrecruit.alvianzf.id · **API:** https://fastrecruit-api.alvianzf.id · **Pricing:** https://fastrecruit.alvianzf.id/pricing

## The problem

A recruitment platform has an unusual trust boundary built into its business model: the platform operator sells the software but must never see what a paying tenant's recruiters are doing inside it, while still needing a handful of deliberate, narrow exceptions (a public job board, opt-in candidate discovery, a shared blacklist). Most SaaS products encode that boundary in application code: a `WHERE tenant_id = ?` clause a developer remembers to add on every query, forever. One missed clause in one endpoint is a full cross-tenant data leak, and nothing stops that from happening quietly.

## The bet: push isolation into Postgres

FastRecruit enforces tenant and confidentiality boundaries with **Postgres row-level security**, not query discipline. Every tenant-scoped table carries an RLS policy keyed off session variables (`app.tenant_id`, `app.role`, `app.user_id`) set from the verified JWT on every request. The application code can still get the query wrong; the database cannot be talked out of the policy. See [02-data-model.md](docs/02-data-model.md#row-level-security-rls-model).

That single decision shapes the rest of the architecture:

- **Superadmin has no bypass policy on tenant tables.** The platform operator role is *structurally* unable to read a recruiter's jobs, candidates, or notes, not just discouraged from it by permissions checks in a router. Exactly three narrow, documented exceptions exist (open candidate profiles, the public job board, the platform-wide email blacklist registry), each its own migration, each auditable independently ([02-data-model.md](docs/02-data-model.md#row-level-security-rls-model)).
- **The API connects as a non-superuser Postgres role, on purpose.** A superuser connection silently bypasses RLS entirely, which would make the whole guarantee theater. Local dev setup exists specifically to prevent that footgun ([07-tech-stack.md](docs/07-tech-stack.md#local-dev-setup-once-scaffolding-lands)).
- **A new FK relationship isn't automatically safe.** RLS governs row visibility, not foreign key constraint validation, which checks the referenced row's *existence*, not the querying role's *visibility* of it. Adding `jobs.client_id` surfaced exactly that gap (an org_admin could otherwise point a job at another tenant's client row), fixed with an explicit tenant-scoped lookup before assignment. Documented as a pattern to watch for on every new cross-table reference going forward, not just patched once ([11-security-review.md](docs/11-security-review.md)).
- **Security review is a running log, not a one-time checklist.** [11-security-review.md](docs/11-security-review.md) is graded by what an unauthenticated attacker could actually do (the public job board, the public application form, and login are the real exposed surface), and gets a new dated pass as the surface grows, findings included, not just fixes.

## Architecture at a glance

```
                 ┌─────────────────────┐
   Recruiter ──▶ │   React (Vite) +    │
   Org Admin     │   MUI, TanStack     │
   Superadmin    │   Query, dnd-kit    │
                 └─────────┬───────────┘
                           │ JWT (access + refresh)
                           ▼
                 ┌─────────────────────┐        ┌──────────────┐
   Public visitor│      FastAPI        │──────▶ │ Redis (opt.) │
   (no auth) ───▶│  role/tenant claims │        │ best effort  │
                 │  → Postgres session │        │ cache only   │
                 │    variables        │        └──────────────┘
                 └─────────┬───────────┘
                           │ every query, RLS-enforced
                           ▼
                 ┌─────────────────────┐
                 │   PostgreSQL         │
                 │   RLS policies per   │
                 │   tenant-scoped table│
                 └─────────────────────┘
```

Non-superuser DB role, request-scoped session variables, and per-table RLS policies are the load-bearing pieces; everything above them is a normal FastAPI/React CRUD app.

## Engineering decisions worth knowing about

- **CV parsing degrades instead of failing.** A hosted LLM extraction tier runs first for full semantic parsing, but falls through on any error (network failure, bad JSON, unexpected shape) to a labeled-field regex parser, then to a generic email/phone/name-guess extractor, never raising out to the caller. The system produces a usable, confidence-scored result even with the LLM provider down or unconfigured. See [04-cv-parser.md](docs/04-cv-parser.md).
- **No `ON DELETE CASCADE` anywhere in the schema, by design.** Soft-deleting a candidate never silently deletes their placement history; the tradeoff is that every read query must explicitly filter `deleted_at IS NULL`, which is a real, named, previously-hit bug class ([02-data-model.md](docs/02-data-model.md#conventions)) rather than a hidden one.
- **Cache failures are invisible to callers.** `app/core/cache.py` wraps Redis so that an unreachable cache (not installed, not running, misconfigured) silently no-ops instead of raising; local dev runs identically with or without Redis. Only two read paths use it today (exchange rates, a platform-wide aggregate), both chosen because a stale value for a minute is genuinely harmless.
- **Storage is an abstraction from day one**, not a migration waiting to happen: local disk in dev, S3-compatible object storage in production, same `storage_key` column either way.
- **Billing tables exist before billing does.** `plans` / `subscriptions` / `invoices` and `stripe_*_id` columns are already in the schema so wiring Stripe later needs a webhook handler and Checkout integration, not a migration.

## Stack

| Layer | Choice | Why |
|---|---|---|
| Backend | Python 3.12, FastAPI | Same process/language as CV parsing, no cross-service hop for that pipeline |
| ORM / migrations | SQLAlchemy 2.x, Alembic | 30+ linear migrations, RLS policies included in the migration history |
| Auth | JWT access + refresh, role/tenant/user claims | Claims drive the Postgres session variables RLS reads |
| Frontend | React 19 (Vite), TypeScript | |
| UI | MUI 9, custom theme | Kanban, table views, and charts share one design system |
| Data fetching | TanStack Query | Optimistic updates on drag-and-drop stage moves |
| Drag and drop | dnd-kit | Kanban board, with a full menu-based equivalent for keyboard/touch parity |
| Rich text | Tiptap + DOMPurify | Constrained WYSIWYG for job descriptions, sanitized before reaching unauthenticated public visitors |
| Database | PostgreSQL, row-level security | Tenant isolation and confidentiality enforcement, not just app-layer checks |
| Cache | Redis, optional | Best-effort only, app runs identically without it |

Full rationale for every choice, including the ones that were reversed or superseded, lives in [07-tech-stack.md](docs/07-tech-stack.md).

## What's actually built vs. still on the roadmap

Full product spec lives in [`docs/`](docs/00-overview.md). It is written to stay honest about implementation status rather than describe an aspirational target: several docs carry dated "flagged as drift" corrections where an earlier description stopped matching the code, left in place instead of quietly rewritten. Notably:

- Multi-tenant workspaces, customizable pipelines, Kanban/Table views, CV parsing with bulk import, a public job board with automatic application routing, opt-in cross-tenant candidate discovery, per-client revenue tracking, and role-aware dashboards are live today.
- Billing is schema-ready but has no live payment processor call yet; registration stays free until Stripe is wired in.
- A self-hosted local model for CV parsing (the original no-external-API design) was superseded at explicit product direction by a hosted LLM tier; the reasoning for the original design is kept in the docs for the record, not deleted.

## Local dev

See [07: Tech Stack](docs/07-tech-stack.md#local-dev-setup-once-scaffolding-lands) for the full setup, including why the API must connect as a non-superuser Postgres role.
