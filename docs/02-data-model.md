# Data Model (PostgreSQL)

Local dev: database `recruitfast`. Credentials are set via `DATABASE_URL`
in a local, gitignored `.env` (see `backend/.env.example`) — never
committed to source. Types below are simplified for readability — see the actual Alembic
migrations once implementation starts for exact constraints/indexes.

## Conventions

- Every tenant-scoped table has a `tenant_id` column, indexed, and an RLS
  policy restricting rows to the caller's tenant (except Superadmin's role,
  which has *no* policy on these tables — see
  [Row-Level Security model](#row-level-security-rls-model)).
- All primary keys are UUIDv7 (`gen_random_uuid()` acceptable at build
  time; UUIDv7 preferred for index locality once available).
- `created_at` / `updated_at` on every table (trigger-maintained).
- Soft-delete (`deleted_at nullable`) on user, job, candidate — hard
  deletes only via the GDPR erasure flow (P2). `tenants` has no
  `deleted_at`; deactivation there is `status = 'suspended'` instead.

## Core tables

### `tenants`
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| type | enum(`org`, `freelance_org`) | exactly one row has type=`freelance_org` |
| name | text | |
| slug | text, unique, nullable | public job board URL segment (`/careers/{slug}`); null for the Freelance Org, which uses the fixed `/careers/public` route instead. Collision-resolved by appending 6 random lowercase alphanumeric chars. See [10-job-board-and-applications.md](10-job-board-and-applications.md). |
| status | enum(`active`, `suspended`) | |
| plan_id | uuid FK → `plans` | nullable until billing set up |

### `users`
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| tenant_id | uuid FK → tenants, nullable | null only for `superadmin` |
| role | enum(`superadmin`, `org_admin`, `recruiter`) | |
| full_name | text | |
| email | citext unique | |
| password_hash | text | |
| status | enum(`pending_approval`, `active`, `deactivated`) | freelance recruiters start `pending_approval` |
| specialization_tags | text[] | set during onboarding |
| team_id | uuid FK → `teams`, nullable | see `teams` below; not RLS-scoped, same as the rest of `users` |
| created_at, updated_at, deleted_at | | |

### `teams`
Org Admin groups recruiters for reporting — an ordinary, tenant-isolated
table (standard RLS policy, not a cross-tenant exception). Deleting a team
nulls out `users.team_id` for its members rather than touching their
jobs/candidates.

| column | type | notes |
|---|---|---|
| id | uuid PK | |
| tenant_id | uuid FK → tenants | RLS-scoped |
| name | text | |
| created_at, updated_at | | |

### `jobs`
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| tenant_id | uuid FK | RLS-scoped |
| owner_recruiter_id | uuid FK → users, nullable | null = "Unassigned Jobs" queue |
| title | text | |
| overview | text | short summary shown in list views |
| description | text (rich text / markdown) | |
| jd_file_id | uuid FK → `documents`, nullable | uploaded JD file |
| custom_fields | jsonb | org-defined schema, validated app-side |
| status | enum(`open`, `on_hold`, `won`, `lost`) | `won`/`lost` — sales-deal framing (closed with a hire vs. fell through), not generic "filled/cancelled". See [03-pipelines-and-boards.md](03-pipelines-and-boards.md). |
| visibility | enum(`public`, `unlisted`) default `public` | `unlisted` jobs don't appear in board listings but are directly reachable by link; both still require `status = 'open'` to be publicly visible. See [10-job-board-and-applications.md](10-job-board-and-applications.md). |
| is_technical_role | bool default false | gates whether the public application form defaults to asking for a GitHub URL |
| pipeline_template_id | uuid FK → `pipeline_templates` | template it was cloned from, for reference only |

### `pipeline_templates`
Org-level (or platform-level default) reusable stage sets.

| column | type | notes |
|---|---|---|
| id | uuid PK | |
| tenant_id | uuid FK, nullable | null = platform default template |
| name | text | e.g. "Default Hiring Pipeline" |

### `pipeline_template_stages`
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| template_id | uuid FK | |
| name | text | Sourced / CV Shortlist / Contacted / First Cut / User Interview / Offer / Reject |
| position | int | display order |
| is_terminal_reject | bool | marks the Reject-type stage for reporting |
| is_terminal_success | bool | marks the Offer/Hired-type stage |

### `job_stages` (clone-on-create)
A job's *own* pipeline — an independent copy made from the template at job
creation, so editing one job's pipeline never affects another job already
in flight, and editing the org template only affects jobs created
afterward (unless an Admin explicitly runs "reset to template").

| column | type | notes |
|---|---|---|
| id | uuid PK | |
| tenant_id | uuid FK | denormalized from `jobs.tenant_id` so RLS can filter this table directly |
| job_id | uuid FK | |
| name | text | editable per job |
| position | int | reorderable per job |
| is_terminal_reject | bool | |
| is_terminal_success | bool | |

### `candidates`
A person, not a pipeline entry — deliberately decoupled from any single
job so one candidate can sit in multiple pipelines.

| column | type | notes |
|---|---|---|
| id | uuid PK | |
| tenant_id | uuid FK | |
| owner_user_id | uuid FK → users, nullable | who created this record; only restricts visibility within the Freelance Org — see below |
| full_name | text | |
| email | citext | indexed, used for dedup matching |
| phone | text | normalized (E.164), indexed |
| source | text | how they entered (upload, manual, referral) |
| current_position | text, nullable | denormalized from the current `candidate_documents.parsed_fields.position`, kept in sync on parse/edit — avoids parsing JSONB on every list/table row. See [04-cv-parser.md](04-cv-parser.md#parsed-field-schema-candidate_documentsparsed_fields). |
| total_years_experience | text, nullable | same denormalization rationale as `current_position` |
| linkedin_url, github_url, portfolio_url | text, nullable | collected on the public application form; `github_url` only asked for when `jobs.is_technical_role` |
| open_to_other_roles | bool default false | candidate opt-in, set at public application time — the sole gate for the cross-tenant RLS exception on this table, see below |
| blacklisted | bool default false | per-tenant "Do Not Contact" flag — see below |
| blacklist_reason | text, nullable | required when blacklisted=true |
| dedup_fingerprint | text | hash of normalized email+phone+name, indexed, used for the duplicate-candidate prompt |

### `candidate_documents`
Every resume/CV file a candidate has ever submitted, versioned — **not**
one row per job application. This is what backs "same candidate applies
twice for the same role: show both CVs in one row."

| column | type | notes |
|---|---|---|
| id | uuid PK | |
| tenant_id | uuid FK | denormalized from `candidates.tenant_id` for direct RLS filtering |
| candidate_id | uuid FK | |
| job_id | uuid FK, nullable | the job this specific upload was submitted against, if any |
| file_id | uuid FK → `documents` | the stored file |
| version_no | int | auto-incremented per candidate |
| is_current | bool | exactly one `true` per (candidate_id, job_id) pair — the version shown by default |
| parsed_fields | jsonb | structured CV Parser output for *this* document — canonical shape (name, position, summary, total_years_experience, technical_skills, education, certifications, main_projects) documented in [04-cv-parser.md](04-cv-parser.md#parsed-field-schema-candidate_documentsparsed_fields) |
| parse_confidence | jsonb | per-field confidence scores, same shape as `parsed_fields` (array items scored individually), see [04-cv-parser.md](04-cv-parser.md#parsed-field-schema-candidate_documentsparsed_fields) |
| parse_status | enum(`pending`, `needs_review`, `confirmed`, `failed`) | current parser always produces `needs_review` — there's no confidence threshold that auto-promotes to `confirmed` yet, see [04-cv-parser.md](04-cv-parser.md) |
| uploaded_by | uuid FK → users | |
| created_at | timestamptz | upload timestamp (from the shared timestamp mixin, not a separate `uploaded_at` column) |

**Reapplication behavior:** when a candidate is added to a job pipeline
they're already in (or a new CV is uploaded for a job they're already
attached to), the system does **not** create a second pipeline placement
row. It inserts a new `candidate_documents` row for that
`(candidate_id, job_id)` pair, flips `is_current` to the new one, and
leaves the existing `pipeline_placements` row untouched. The Candidates
table shows **one row** for that candidate/job; the row is clickable to
expand a version history panel listing every submitted CV
(date, uploaded-by, parsed-field diff), with the latest shown by default
in the collapsed row and in Kanban card previews. This reuses the same
versioning mechanism as CV Parser's re-parse flow
([04-cv-parser.md](04-cv-parser.md#failure--correction-flow)).

### `pipeline_placements`
The join entity: "this candidate is in this job's pipeline, currently at
this stage." One row per (candidate, job) — this is what makes a candidate
independently trackable across multiple jobs.

| column | type | notes |
|---|---|---|
| id | uuid PK | |
| tenant_id | uuid FK | denormalized from `jobs.tenant_id` for direct RLS filtering |
| candidate_id | uuid FK | |
| job_id | uuid FK | |
| current_stage_id | uuid FK → `job_stages` | |
| status | enum(`active`, `rejected`, `withdrawn`) default `active` | per-job status, independent of `candidates.blacklisted` |
| status_reason | text, nullable | reject reason or withdrawal reason |
| moved_by | uuid FK → users | who made the last move |
| unique (candidate_id, job_id) | | one placement per candidate per job — reapplication updates it, never duplicates it |

### `stage_history`
Immutable, append-only. References `job_stages.id`, not the stage name, so
a later rename doesn't corrupt historical entries — the label is snapshotted
at write time.

| column | type | notes |
|---|---|---|
| id | uuid PK | |
| tenant_id | uuid FK | denormalized for direct RLS filtering |
| placement_id | uuid FK → pipeline_placements | |
| from_stage_id | uuid FK, nullable | |
| to_stage_id | uuid FK | |
| stage_label_snapshot | text | name of `to_stage_id` at the time of the move |
| moved_by | uuid FK → users | |
| moved_at | timestamptz | |
| was_admin_override | bool default false | |

### `notes`
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| tenant_id | uuid FK | direct RLS filtering |
| candidate_id | uuid FK, nullable | |
| job_id | uuid FK, nullable | |
| author_id | uuid FK → users | |
| body | text | |
| visibility | enum(`team`, `private`) | default `team` |

### Blacklist (two-tier — distinct from per-job rejection)
Blacklisting a candidate is a deliberately **separate action** from moving
a card to the Reject stage in one job's pipeline (see
[03-pipelines-and-boards.md](03-pipelines-and-boards.md)), and it writes
to two places:

1. **`candidates.blacklisted` / `blacklist_reason`** (per-tenant) — the
   flag above, scoped to the tenant that blacklisted the candidate.
2. **`email_blacklist_entries`** (platform-wide, append-only) — filed
   automatically whenever (1) happens, so a recruiter at a *different*
   tenant is warned if the same email applies elsewhere.

| column | type | notes |
|---|---|---|
| id | uuid PK | |
| email | citext, indexed | not unique — one email can accumulate multiple entries from different tenants |
| reason | text | required, non-empty |
| tenant_id | uuid FK → tenants | the filing tenant, kept for audit only — **never serialized in API responses** |
| created_at, updated_at | | |

This table is deliberately **not** RLS-protected (see
[Row-Level Security model](#row-level-security-rls-model)) — the API only
ever returns `reason` + `created_at` to callers, never `tenant_id`, so
which org filed an entry stays private even though the row itself is
readable platform-wide.

### `freelance_applications`
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK → users | the `pending_approval` account |
| linkedin_url, years_experience, specialization, notes | | collected at registration |
| status | enum(`pending`, `approved`, `rejected`) | |
| decided_by | uuid FK → users, nullable | Superadmin who decided |
| decision_reason | text, nullable | |

### `assisted_access_requests`
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| requested_by | uuid FK → users | Superadmin |
| resource_type, resource_id | | the specific record |
| reason | text | |
| approved_by | uuid FK → users, nullable | the Org Admin/freelancer who consented |
| status | enum(`pending`, `approved`, `denied`, `expired`) | |
| expires_at | timestamptz | default now()+24h from approval |

### `audit_log_platform` / `audit_log_org`
Two physically separate tables (not a shared table with a filtered view) —
see [01-roles-permissions.md](01-roles-permissions.md#audit-log-tiering)
for why they must not share a query surface.

### Billing
`plans`, `subscriptions`, `invoices` — structure only in P0 (no live
Stripe calls yet, see [07-tech-stack.md](07-tech-stack.md)):

- `plans(id, name, seat_limit, price_cents, billing_interval)`
- `subscriptions(id, tenant_id, plan_id, status, current_period_end, stripe_subscription_id nullable)`
- `invoices(id, subscription_id, amount_cents, status, issued_at)`

### `documents`
Generic file storage record shared by JD uploads and CV uploads.

| column | type | notes |
|---|---|---|
| id | uuid PK | |
| tenant_id | uuid FK | |
| storage_key | text | local disk path in dev, S3 key in prod |
| mime_type | text | |
| original_filename | text | |
| checksum_sha256 | text | also feeds dedup/duplicate-CV detection |

### `job_screening_questions`
Recruiter-authored elimination questions on the public application form.
Full behavior (freelance 4-question cap, org unlimited) in
[10-job-board-and-applications.md](10-job-board-and-applications.md).

| column | type | notes |
|---|---|---|
| id | uuid PK | |
| tenant_id | uuid FK | RLS-scoped |
| job_id | uuid FK → jobs | |
| question_text | text | |
| expected_answer | text | never exposed to public applicants — only the question text is |
| position | int | display order |
| created_at, updated_at | | |

### `job_applications`
One row per public application submitted via the job board.

| column | type | notes |
|---|---|---|
| id | uuid PK | |
| tenant_id | uuid FK | RLS-scoped |
| job_id | uuid FK → jobs | |
| candidate_id | uuid FK → candidates | |
| cover_letter | text, nullable | |
| answers | jsonb default `[]` | snapshot of question/answer pairs at submission time |
| eligible | bool default true | case-insensitive exact-match against every question's `expected_answer` |
| placement_id | uuid FK → pipeline_placements, nullable | set automatically when eligible, or via manual "mark eligible" promotion |
| created_at, updated_at | | |

### `candidate_import_batches`
Tracks one CSV/Excel bulk-import run for auditability (who imported, when,
how many rows succeeded/warned/errored). See
[09-candidate-intake.md](09-candidate-intake.md) — backend-only today, no
frontend UI yet.

## Row-Level Security (RLS) model

Postgres RLS is the enforcement point for the confidentiality guarantee —
picked specifically because the QA review flagged that UI-level hiding is
not sufficient (a direct API call, an export job, or a backup restore must
not be able to bypass it).

- Implemented (see `backend/alembic/versions/0002_row_level_security.py`,
  amended by `0006_job_board_and_applications.py` and
  `0009_nullif_safe_rls_policies.py` — see gotcha below):
  every RLS-scoped table (`jobs`, `candidates`, `job_stages`,
  `pipeline_placements`, `stage_history`, `notes`, `candidate_documents`,
  `documents`, `job_screening_questions`, `job_applications`, `teams`)
  gets one policy: `current_setting('app.role', true) IS DISTINCT FROM
  'superadmin' AND tenant_id = NULLIF(current_setting('app.tenant_id',
  true), '')::uuid`. The API connects as a single DB role and sets
  `app.role`/`app.tenant_id` per request via `set_config(..., true)`
  (`app/core/database.py: set_rls_context`) — a session with
  `app.role = 'superadmin'` matches no row, on any of these tables,
  independent of application code.
- `candidates` additionally has an OR-based exception baked into its
  policy (`0006_job_board_and_applications.py`, amended by `0009`):
  `... AND (tenant_id = NULLIF(current_setting('app.tenant_id', true),
  '')::uuid OR open_to_other_roles = true)`. A candidate who opted in at
  public-application time becomes readable to any recruiter platform-wide
  — the first of the app's narrow, deliberate cross-tenant exceptions.
  Only summary fields are exposed at the schema/API level (name, position,
  experience) — RLS just gates the row, not which columns come back. See
  [10-job-board-and-applications.md](10-job-board-and-applications.md)
  ("Open profiles").
- `candidates` also has a **narrower-than-tenant** restriction, the
  opposite direction of the other exceptions above (0012_freelance_candidate_privacy.py):
  within the tenant-match branch, a Freelance Org row additionally
  requires `owner_user_id = NULLIF(current_setting('app.user_id', true),
  '')::uuid` — Org tenant rows are unaffected (`tenant_id NOT IN (SELECT
  id FROM tenants WHERE type = 'freelance_org')` short-circuits the owner
  check for them). This needed a new `app.user_id` session GUC
  (`set_rls_context`'s third parameter) alongside the existing
  `app.role`/`app.tenant_id` ones — the same NULLIF-empty-string handling
  applies to it as the GUC-placeholder gotcha below covers for
  `app.tenant_id`.
  A freelancer's uploaded/received candidates are private to them by
  default; there's no UI/API toggle to share one with other freelancers
  in the same tenant today. Scope note: this restricts `candidates` only
  — `candidate_documents`/`pipeline_placements`/`notes` keep their
  ordinary tenant-wide policies, relying on every app code path reaching
  them through a `candidates` row first (which RLS already blocks for a
  non-owner). See [01-roles-permissions.md](01-roles-permissions.md).
- `jobs` additionally has a second, narrower permissive policy
  (`public_open_jobs`, `0008_public_jobs_read_policy.py`) allowing SELECT
  on `status = 'open'` rows with no session context at all — the second
  exception, backing the public job board. See
  [10-job-board-and-applications.md](10-job-board-and-applications.md).

  **Gotcha that cost real debugging time, worth knowing before touching
  this again:** a custom Postgres GUC like `app.tenant_id` is lazily
  created as a "placeholder" the first time any session sets it on a
  given physical connection. After that point, `current_setting(x, true)`
  returns `''` (empty string) for an unset value **on that connection**,
  not `NULL` — for the rest of that connection's lifetime, even across
  transactions and even after the setting transaction commits or rolls
  back. Since the app uses a connection pool, this isn't a one-off: any
  request that reuses a connection another request already touched will
  see `''`, not `NULL`, if it never calls `set_rls_context` (e.g. the
  public job board's pre-tenant-known lookups). A bare
  `tenant_id = current_setting(...)::uuid` cast then hard-errors
  (`invalid input syntax for type uuid: ""`) instead of safely matching
  zero rows. `NULLIF(..., '')` before the cast fixes it for both NULL and
  `''`. Don't reintroduce a bare cast in a future policy.
- `email_blacklist_entries` (`0010_email_blacklist_registry.py`) is the
  third exception, and the most extreme one — deliberately **not**
  RLS-protected at all, for the same reason `users` isn't (see
  `app/api/routers/org.py`): it's a platform-wide registry, not
  per-tenant recruiter content, and the whole point is that any
  authenticated recruiter can look up any email regardless of which
  tenant filed the entry. The API only ever returns `reason` +
  `created_at`; the filing `tenant_id` column exists for audit only and
  is never serialized. See [01-roles-permissions.md](01-roles-permissions.md).
- `assisted_access_requests`, once `approved` and unexpired, will grant a
  narrowly-scoped, time-limited additional policy for that one
  `resource_id` — **not yet implemented**; today Assisted Access has a
  request/approval table but no corresponding RLS grant. Follow-up work,
  noted in the migration's docstring.
- Application-level authorization mirrors this (defense in depth) but RLS
  is the backstop that makes the guarantee true even if app code has a bug.

**Critical operational requirement:** Postgres superusers bypass RLS
entirely, and `FORCE ROW LEVEL SECURITY` (applied to every table above)
does not change that — it only forces the *table owner* to respect RLS if
the owner isn't a superuser. **The API must connect as a non-superuser
role**, or every guarantee in this section is silently void.

This local dev environment has this applied: a `recruitfast_app` login
role (not a superuser) owns the `recruitfast` database and its `public`
schema, `backend/.env`'s `DATABASE_URL` connects as that role, and
isolation was functionally verified — a session scoped to one tenant sees
only its own rows, a session scoped to a different tenant sees none of
them, and a session with `app.role = 'superadmin'` sees none of them
regardless of `app.tenant_id`. For a fresh environment, reproduce with:

```sql
-- Run once, as postgres, against a fresh recruitfast database:
CREATE ROLE recruitfast_app LOGIN PASSWORD '<pick-your-own-local-password>';
-- Easiest path: have postgres create the DB owned by the new role, then
-- hand it the schema too, and run `alembic upgrade head` as that role so
-- it owns every object from the start (no ALTER-ownership gymnastics
-- later):
--   CREATE DATABASE recruitfast OWNER recruitfast_app;
--   \c recruitfast
--   ALTER SCHEMA public OWNER TO recruitfast_app;
```

Then point `DATABASE_URL` in `backend/.env` at `recruitfast_app`, not
`postgres`, before running migrations. This is left as a manual step (not
scripted into a migration) specifically so no real password ever gets
hardcoded into source — see the credential-handling note in
[07-tech-stack.md](07-tech-stack.md).
