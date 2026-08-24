# Tech Stack

## Backend

- **Language/framework:** Python 3.12+, FastAPI.
- **ORM/migrations:** SQLAlchemy 2.x + Alembic.
- **Why Python over Node for the API:** the CV Parser's ML pipeline
  (spaCy, local SLM inference via `llama-cpp-python` or an Ollama client)
  runs in-process, in the same language as the rest of the backend — no
  cross-service call, no second deployable, no serialization overhead
  between a Node API and a Python parsing service.
- **Auth:** JWT access token (short-lived) + refresh token (httpOnly
  cookie), role + tenant_id embedded as claims, verified per-request and
  used to set the Postgres session variable (`app.tenant_id`,
  `app.role`) that RLS policies key off.
- **Background jobs:** CV parsing, OCR, and re-parse run as async
  background tasks (FastAPI `BackgroundTasks` for P0; a real queue —
  Celery/RQ + Redis — once parse volume justifies it) so uploads don't
  block the request.

## CV Parser dependencies

- `pdfplumber` / `PyMuPDF` — text PDF extraction.
- `python-docx` / `docx2txt` — Word documents.
- `pytesseract` (Tesseract OCR) — scanned/image PDF fallback.
- `spaCy` (+ a small English model, e.g. `en_core_web_sm`, plus rule-based
  `Matcher` patterns) — structured field extraction.
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
- **Charts:** MUI X Charts — see
  [05-dashboards-metrics.md](05-dashboards-metrics.md#visualization-approach)
  for why (stays inside the same MD3 theming rather than a second charting
  library).
- **Forms:** `react-hook-form` + `zod` for schema validation, mirroring
  backend Pydantic schemas where practical.

## Database

- **PostgreSQL** (local dev: db `recruitfast`, user `postgres`, password
  `REDACTED`, connection string
  `postgresql://postgres:REDACTED@localhost:5432/recruitfast`).
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

```bash
# Postgres (already running locally per the brief) — create the DB:
createdb -U postgres recruitfast

# Backend
cd backend && python -m venv .venv && .venv/Scripts/activate
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload

# Frontend
cd frontend && npm install && npm run dev
```
