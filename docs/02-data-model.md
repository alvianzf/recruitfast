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
- Soft-delete (`deleted_at nullable`) on tenant, user, job, candidate —
  hard deletes only via the GDPR erasure flow (P2).

## Core tables

### `tenants`
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| type | enum(`org`, `freelance_org`) | exactly one row has type=`freelance_org` |
| name | text | |
| status | enum(`active`, `suspended`) | |
| plan_id | uuid FK → `plans` | nullable until billing set up |

### `users`
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| tenant_id | uuid FK → tenants, nullable | null only for `superadmin` |
| role | enum(`superadmin`, `org_admin`, `recruiter`) | |
| email | citext unique | |
| password_hash | text | |
| status | enum(`pending_approval`, `active`, `deactivated`) | freelance recruiters start `pending_approval` |
| specialization_tags | text[] | set during onboarding |
| created_at, updated_at, deleted_at | | |

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
| status | enum(`open`, `on_hold`, `filled`, `cancelled`) | |
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
| full_name | text | |
| email | citext | indexed, used for dedup matching |
| phone | text | normalized (E.164), indexed |
| source | text | how they entered (upload, manual, referral) |
| blacklisted | bool default false | org-wide "Do Not Contact" flag — see below |
| blacklist_reason | text, nullable | required when blacklisted=true |
| dedup_fingerprint | text | hash of normalized email+phone+name, indexed, used for the duplicate-candidate prompt |

### `candidate_documents`
Every resume/CV file a candidate has ever submitted, versioned — **not**
one row per job application. This is what backs "same candidate applies
twice for the same role: show both CVs in one row."

| column | type | notes |
|---|---|---|
| id | uuid PK | |
| candidate_id | uuid FK | |
| job_id | uuid FK, nullable | the job this specific upload was submitted against, if any |
| file_id | uuid FK → `documents` | the stored file |
| version_no | int | auto-incremented per candidate |
| is_current | bool | exactly one `true` per (candidate_id, job_id) pair — the version shown by default |
| parsed_fields | jsonb | structured CV Parser output for *this* document |
| parse_confidence | jsonb | per-field confidence scores, see [04-cv-parser.md](04-cv-parser.md) |
| parse_status | enum(`pending`, `needs_review`, `confirmed`, `failed`) | |
| uploaded_by | uuid FK → users | |
| uploaded_at | timestamptz | |

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
| candidate_id | uuid FK, nullable | |
| job_id | uuid FK, nullable | |
| author_id | uuid FK → users | |
| body | text | |
| visibility | enum(`team`, `private`) | default `team` |

### `blacklist` (org-wide, distinct from per-job rejection)
Implemented as the `candidates.blacklisted` flag above rather than a
separate table — kept here as a callout because it's a deliberately
**separate action** from moving a card to the Reject stage in one job's
pipeline. See [03-pipelines-and-boards.md](03-pipelines-and-boards.md).

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

## Row-Level Security (RLS) model

Postgres RLS is the enforcement point for the confidentiality guarantee —
picked specifically because the QA review flagged that UI-level hiding is
not sufficient (a direct API call, an export job, or a backup restore must
not be able to bypass it).

- Every tenant-scoped table: `USING (tenant_id = current_setting('app.tenant_id')::uuid)`.
- The `superadmin` DB role has **no policy** granting access to
  `jobs`, `candidates`, `pipeline_placements`, `stage_history`, `notes`,
  `candidate_documents` — queries against these tables from a superadmin
  session return zero rows, full stop, independent of application code.
- `assisted_access_requests`, once `approved` and unexpired, grants a
  narrowly-scoped, time-limited additional policy for that one
  `resource_id` only.
- Application-level authorization mirrors this (defense in depth) but RLS
  is the backstop that makes the guarantee true even if app code has a bug.
