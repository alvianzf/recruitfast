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

## CV Parser dependencies

**Implemented today:** `pdfplumber` (PDF text extraction) and
`python-docx` (`.docx` text extraction) only — confirmed against
`backend/requirements.txt` and the imports in
`backend/app/services/cv_parser.py`. Extraction itself is regex/string-
section-splitting, no NLP library involved.

**Target design, not yet implemented:**
- `PyMuPDF` / `docx2txt` — alternate/fallback extraction libraries.
- `pytesseract` (Tesseract OCR) — scanned/image PDF fallback.
- `spaCy` (+ a small English model, e.g. `en_core_web_sm`, plus rule-based
  `Matcher` patterns) — structured field extraction beyond regex.
- `llama-cpp-python` or an Ollama HTTP client — local SLM inference
  (Qwen2.5-3B-Instruct or Phi-3.5-mini-instruct, quantized GGUF).
  Self-hosted, no external API calls. See
  [04-cv-parser.md](04-cv-parser.md).

## Frontend

- **Framework:** React (Vite).
- **Component library:** MUI, themed to Material Design 3 (see
  [06-ui-design-system.md](06-ui-design-system.md)).
- **Data fetching/cache:** TanStack Query (React Query) — fits a
  drag-and-drop board well via optimistic updates on stage moves.
- **Drag-and-drop:** `dnd-kit`.
- **Tables:** MUI X DataGrid — powers the Jobs/Candidates lists and a
  job's pipeline table view (see
  [06-ui-design-system.md](06-ui-design-system.md)).
- **Charts:** MUI X Charts — see
  [05-dashboards-metrics.md](05-dashboards-metrics.md#visualization-approach)
  for why (stays inside the same MD3 theming rather than a second charting
  library).
- **Forms:** `react-hook-form` + `zod` for schema validation, mirroring
  backend Pydantic schemas where practical.

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
