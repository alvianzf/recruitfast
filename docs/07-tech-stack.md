# Tech Stack

## Backend

- **Language/framework:** Python 3.12+, FastAPI.
- **ORM/migrations:** SQLAlchemy 2.x + Alembic.
- **Why Python over Node for the API:** so the CV Parser's pipeline can
  run in-process, in the same language as the rest of the backend — no
  cross-service call, no second deployable. (Today this benefit applies
  to the regex/`pdfplumber`/`python-docx` extraction that's actually
  built; the target design's spaCy + local-SLM inference layer isn't
  implemented yet — see [04-cv-parser.md](04-cv-parser.md).)
- **Auth:** JWT access token + refresh token, role/tenant_id/user_id
  embedded in the access token's claims, verified per-request and used
  to set the Postgres session variables (`app.tenant_id`, `app.role`,
  `app.user_id`) that RLS policies key off. **Implemented today:** both
  tokens are returned in the login response JSON body (`POST
  /auth/login`); there is no httpOnly cookie anywhere, and the frontend
  never actually uses the refresh token — it stores only the access
  token (`localStorage`) and redirects to `/login` on a 401. A real
  refresh flow (silent re-auth before expiry) is not yet built.
- **Background jobs:** none — every CV parse and file upload runs
  synchronously in the request/response cycle today. `BackgroundTasks`/
  a real queue (Celery/RQ + Redis) for OCR/re-parse is target design
  once those features themselves exist, not something to build ahead of
  them.
- **HTTP client:** `httpx` (`==0.28.1`, pinned directly in
  `requirements.txt`, not just present transitively via FastAPI/Starlette
  tooling as before) — `app/services/forex.py` calls the Frankfurter
  currency-conversion API with it directly (see
  [05-dashboards-metrics.md](05-dashboards-metrics.md)). Worth
  remembering: unlike `requests`, `httpx` does not follow redirects by
  default — that call needs `follow_redirects=True` or it silently
  returns nothing, which cost real debugging time while building this.

## CV Parser dependencies

**Implemented today:** `pdfplumber` (PDF text extraction) and
`python-docx` (`.docx` text extraction) — confirmed against
`backend/requirements.txt` and the imports in
`backend/app/services/cv_parser.py`. Deterministic-tier extraction
itself is regex/string-section-splitting, no NLP library involved.
**Updated 2026-08-28 (flagged as drift — this section previously omitted
it entirely):** `openai==3.3.1` is also pinned in `requirements.txt`,
backing `llm_cv_parser.py`'s hosted LLM extraction tier — a real,
enabled-by-default dependency, not a target-design placeholder. See
[04-cv-parser.md](04-cv-parser.md) for the tier order and what changed.

**Target design, not yet implemented:**
- `PyMuPDF` / `docx2txt` — alternate/fallback extraction libraries.
- `pytesseract` (Tesseract OCR) — scanned/image PDF fallback.
- `spaCy` (+ a small English model, e.g. `en_core_web_sm`, plus rule-based
  `Matcher` patterns) — structured field extraction beyond regex, for the
  deterministic fallback tiers specifically (the LLM tier already covers
  this ground when enabled).
- A **self-hosted** model (`llama-cpp-python` or an Ollama HTTP client,
  Qwen2.5-3B-Instruct or Phi-3.5-mini-instruct, quantized GGUF) as a
  no-external-API alternative to the hosted LLM tier above — this was
  the *original* semantic-extraction plan before the hosted API was
  chosen instead at explicit product direction; see
  [04-cv-parser.md](04-cv-parser.md)'s "Original design rationale."

## Frontend

- **Framework:** React (Vite).
- **Component library:** MUI, custom-themed — see
  [06-ui-design-system.md](06-ui-design-system.md).
- **Data fetching/cache:** TanStack Query (React Query) — fits a
  drag-and-drop board well via optimistic updates on stage moves. Global
  `staleTime` is 30s (`main.tsx`, set 2026-08-26 — the default of 0
  refetched every query on every mount/window-focus); every mutation
  hook already calls `invalidateQueries` on the keys it affects, so this
  doesn't trade away freshness where a change actually happened.
- **Drag-and-drop:** `dnd-kit`.
- **Tables:** MUI X DataGrid — powers the Jobs/Candidates lists and a
  job's pipeline table view (see
  [06-ui-design-system.md](06-ui-design-system.md)).
- **Charts:** MUI X Charts — see
  [05-dashboards-metrics.md](05-dashboards-metrics.md#visualization-approach)
  for why (stays inside the same theming rather than a second charting
  library).
- **Forms:** `react-hook-form` + `zod` for schema validation, mirroring
  backend Pydantic schemas where practical.
- **Animation:** `framer-motion` (`^13.1.1`) — Kanban card drag
  elevation/rotation and arrival-at-terminal-stage "pulse in", see
  `KanbanBoard.tsx` and [13-redesign.md](13-redesign.md).
- **Fonts:** `@fontsource-variable/space-grotesk` (`^5.3.0`) and
  `@fontsource-variable/inter` (`^5.3.0`) — self-hosted variable fonts
  backing the type scale in
  [06-ui-design-system.md](06-ui-design-system.md), not a Google Fonts
  CDN link.
- **Rich text editing:** `@tiptap/react`, `@tiptap/starter-kit`,
  `@tiptap/pm`, `@tiptap/extension-placeholder` (all `^3.30.3`) — the
  constrained WYSIWYG editor behind job descriptions
  (`RichTextEditor.tsx`, see
  [10-job-board-and-applications.md](10-job-board-and-applications.md)).
- **HTML sanitization:** `dompurify` (`^3.4.14`) — sanitizes
  editor-authored `jobs.description` HTML before it's rendered with
  `dangerouslySetInnerHTML` on public pages (`RichText.tsx`), since that
  HTML reaches unauthenticated visitors.

## Database

- **PostgreSQL** (local dev: db `recruitfast`). Connection string is set
  via `DATABASE_URL` in a local, gitignored `.env` — see
  `backend/.env.example` for the shape. Never hardcode credentials in
  source or docs.
- **Row-Level Security** as the tenant-isolation and confidentiality
  enforcement layer — see
  [02-data-model.md](02-data-model.md#row-level-security-rls-model).
- Extensions: `pgcrypto` (UUID generation), `citext` (case-insensitive
  email matching), `pg_trgm` (fuzzy name search for dedup/global search,
  P1).
- Every RLS-scoped table has a plain btree index on `tenant_id` (added
  2026-08-26, migration `0025`) — every RLS policy filters on it, so
  without the index every query against these tables was an implicit
  sequential scan underneath whatever the query itself asked for. Not
  visible at dev-seed data volume; would have been a real problem at any
  real tenant's scale.

## Caching

- **Redis**, optional and best-effort — `app/core/cache.py` wraps
  `get_json`/`set_json` around a Redis client that connects lazily on
  first use and is checked once per process. If Redis isn't reachable
  (not installed, not running, wrong `REDIS_URL`), every call silently
  no-ops and the caller's normal non-cached path runs instead — nothing
  in this module ever raises out to a caller. Local dev is expected to
  run without Redis; production is expected to have it running.
- Configured via `REDIS_URL` (defaults to `redis://127.0.0.1:6379/0`),
  not a required env var.
- Current adoption: `app/services/forex.py`'s exchange-rate lookups
  (1-hour TTL, on top of the pre-existing in-process fallback dict used
  when Redis is down) and `GET /metrics/platform` (60s TTL, superadmin
  dashboard). Both are safe cache candidates — external/slow-changing
  data and a platform-wide, non-tenant-scoped aggregate respectively.
  Not applied to any tenant-scoped metrics endpoint yet (would need
  cache keys scoped by tenant_id to avoid leaking one tenant's numbers
  into another's cached response — straightforward, just not done yet).

## Billing

- `plans` / `subscriptions` / `invoices` tables exist from P0 (see
  [02-data-model.md](02-data-model.md#billing)), but no live payment
  processor calls yet. Stripe is the target integration (webhook handler
  + Checkout/Customer Portal) — wired once the core product loop is
  validated, without needing a schema migration since the tables and
  `stripe_*_id` columns already exist.

## Storage

- **Local dev:** files (resumes, JDs) stored on local disk under a
  gitignored `storage/` path, referenced by `documents.storage_key`.
- **Production:** S3-compatible object storage, same `storage_key`
  abstraction — swapping the storage backend doesn't touch the data model.

## Repo layout (proposed)

```
recruitfast/
  backend/           FastAPI app, SQLAlchemy models, Alembic migrations
  frontend/          React + MUI app
  docs/              this spec
  storage/           local file storage (dev only, gitignored)
  docker-compose.yml Postgres for local dev (optional convenience)
```

## Local dev setup (once scaffolding lands)

**Critical: the API must connect as a non-superuser Postgres role**, or
RLS is silently bypassed entirely — see
[02-data-model.md](02-data-model.md#row-level-security-rls-model) for why.
`createdb -U postgres` alone is not enough; a dedicated `recruitfast_app`
login role has to own the database before `alembic upgrade head` runs, so
it owns every object from the start:

```bash
# Run once, as postgres, against a fresh Postgres instance:
psql -U postgres -c "CREATE ROLE recruitfast_app LOGIN PASSWORD '<pick-your-own-local-password>'"
psql -U postgres -c "CREATE DATABASE recruitfast OWNER recruitfast_app"
psql -U postgres -d recruitfast -c "ALTER SCHEMA public OWNER TO recruitfast_app"

# Backend — DATABASE_URL in backend/.env must point at recruitfast_app,
# never at postgres or any other superuser role.
cd backend && python -m venv .venv && .venv/Scripts/activate
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload

# Frontend
cd frontend && npm install && npm run dev
```

`alembic upgrade head` against a fresh database runs migration `0001`
(full current schema + RLS, per below) followed by every migration from
`0024` onward, all genuinely new since the 2026-08-26 consolidation —
see each file's own docstring. `0002` through `0023` are real,
historically accurate descriptions of what changed and why (read their
docstrings), but each one's actual `upgrade()`/`downgrade()` is a
documented no-op, since whatever it changed is already reflected in the
model files `0001` creates from. This was tightened up on 2026-08-26
after a from-scratch install broke partway through the chain (a later
migration tried to add a column `0001` already had); see `0001`'s
docstring for the full explanation. A genuinely new schema change still
gets its own new migration with a real `upgrade()`, same as always —
**updated 2026-08-28** (this list previously stopped at `0025` the same
day it was written; flagged as drift the moment more migrations landed):
`0024` (`clients` table), `0025` (tenant_id indexes), `0026`
(`tenants.max_recruiter_seats`), `0027` (`jobs.team_id`), `0028`/`0029`
(screening question `number`/`boolean` types), `0030`
(`candidates.location`), `0031` (RLS: open-profile exception extended to
`candidate_documents`/`documents`/`notes`) are all real, non-no-op
migrations. If you're reading this later, `alembic history` is the
actual source of truth for how far this list has fallen behind — this
paragraph will drift again.

Redis is optional locally — the app runs identically without it (see
Caching above). Only install/run it if you want to exercise the cached
code paths; nothing else depends on it being up.
