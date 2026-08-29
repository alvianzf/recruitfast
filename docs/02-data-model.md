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
- **No DB-level `ON DELETE CASCADE` anywhere in the schema** — every FK
  in every model/migration uses the plain default. Soft-deleting a
  candidate does not touch their `pipeline_placements`,
  `job_applications`, or `stage_history` rows at all; those rows are left
  exactly as they were, still pointing at the (still-physically-present,
  just `deleted_at`-flagged) candidate row. The only way a soft-deleted
  candidate stays invisible is every read query explicitly filtering
  `deleted_at IS NULL` — there is no automatic enforcement. **This bit us
  once already (fixed 2026-08-27)**: `pipeline.py`'s `list_placements`
  and `screening.py`'s `list_applications` both joined `Candidate` without
  that filter, so a deleted candidate's card stayed stuck on the job's
  Kanban/Table board indefinitely. The three duplicate-detection
  fingerprint lookups (`candidates.py`, `bulk_import.py`,
  `public_board.py`) had the same gap — a re-upload/re-application could
  silently match and reuse a soft-deleted candidate's row. All were
  patched to add the filter; there's no structural guard preventing a new
  query from reintroducing the same class of bug, so any new
  `db.query(Candidate)` (or join to it) needs `Candidate.deleted_at.is_(None)`
  added by hand unless it deliberately wants to see deleted rows.

## Core tables

### `tenants`
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| type | enum(`org`, `freelance_org`) | exactly one row has type=`freelance_org` |
| name | text | |
| slug | text, unique, nullable | public job board URL segment (`/jobs/{slug}`); null for the Freelance Org, which uses the fixed `/jobs` route instead (the "All Jobs" aggregated board — see [10-job-board-and-applications.md](10-job-board-and-applications.md)). Collision-resolved by appending 6 random lowercase alphanumeric chars. |
| status | enum(`active`, `suspended`) | `suspended` is schema-only — no UI/API path sets it yet, see [01-roles-permissions.md](01-roles-permissions.md) |
| plan_id | uuid FK → `plans` | nullable until billing set up |
| logo_url | text, nullable | org-admin-set; either a pasted hosted-image URL or an uploaded file served back from `/media` (see `POST /uploads/image` in [10-job-board-and-applications.md](10-job-board-and-applications.md#org-profile-org_admin-editable)); null for the Freelance Org |
| description | text, nullable | shown on the org's public career page |
| office_location | text, nullable | free text, shown on the org's public career page |
| contact_email | text, nullable | shown on the org's public career page |
| preferred_currency | text, default `"IDR"` | org-admin-set at `/app/org/profile`; the currency the dashboard's placement-value and opportunity totals are converted into. See [05-dashboards-metrics.md](05-dashboards-metrics.md). |
| max_recruiter_seats | int, nullable, default `3` | added 2026-08-26. Superadmin-set cap on active **recruiter**-role users, mirroring the Organization /pricing tier's included seats. `null` = unlimited (the Custom tier, or any org a superadmin exempts). **org_admin seats are a separate, uncapped concept and are never counted against this** — an org can register more than one admin regardless of this value. Enforced in `org.py`'s `invite_recruiter` (`app/services/seats.py`'s `check_recruiter_seat_available`), settable via `PATCH /admin/organizations/{id}/seats` (superadmin-only). Always unused for the Freelance Org tenant. |

### `users`
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| tenant_id | uuid FK → tenants, nullable | null only for `superadmin` |
| role | enum(`superadmin`, `org_admin`, `recruiter`) | |
| full_name | text | |
| email | citext unique | |
| password_hash | text | |
| avatar_url | text, nullable | self-service, set via `PATCH /users/me`; either a pasted URL or an uploaded file served back from `/media`, same upload path as `tenants.logo_url`. See [00-overview.md](00-overview.md#account-and-profile). |
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

### `clients` (Org-only, added 2026-08-26)
An Org tenant's own customer — the company a job is being worked on
behalf of. Same pattern as `teams`: an ordinary, tenant-isolated table
(standard RLS policy), org_admin-only to create/edit, but readable by
any recruiter in the tenant (needed for the job-form dropdown). Optional
on a job — `jobs.client_id` is nullable, and always null for Freelance
Org jobs (no client roster there). Per-client metrics (job count,
placement count, revenue) are computed on read (`GET
/clients/{id}/metrics`), not stored — same approach as the dashboard's
existing placement-value rollups, see
[05-dashboards-metrics.md](05-dashboards-metrics.md).

| column | type | notes |
|---|---|---|
| id | uuid PK | |
| tenant_id | uuid FK → tenants | RLS-scoped |
| name | text | required |
| email | text | required |
| contact_person | text \| null | optional |
| phone | text \| null | optional |
| notes | text \| null | optional |
| created_at, updated_at | | |

### `jobs`
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| tenant_id | uuid FK | RLS-scoped |
| owner_recruiter_id | uuid FK → users, nullable | Changed 2026-08-26: an org_admin's created/assigned jobs **never** set this to the admin's own id — admins don't do recruiter work (see [01-roles-permissions.md](01-roles-permissions.md)). `null` here means the job is open (either to the whole org, or to one team — see `team_id`). A recruiter-created job is always self-owned regardless of what the client sends. `POST /jobs/{id}/assign` and `POST /jobs/{id}/claim` both enforce the target/claimer has role `recruiter`, not just "any user in the tenant". |
| team_id | uuid FK → `teams`, nullable, added 2026-08-26 | A job assigned to a team (via `JobCreate.team_id` at creation, or `POST /jobs/{id}/assign` with `team_id` instead of `recruiter_id`) is claimable by any recruiter on that team, not the whole org. Mutually exclusive with `owner_recruiter_id` — assigning one clears the other. `null` + `owner_recruiter_id` `null` = open to every recruiter in the org. |
| title | text | |
| slug | text, unique | public apply-link identifier, `{slugify(title)}-{5 random chars}` — always randomized, not just on collision (unlike `tenants.slug`), so the link never looks guessable. See [10-job-board-and-applications.md](10-job-board-and-applications.md). |
| overview | text | short summary shown in list views |
| description | text (sanitized HTML) | authored via a constrained Tiptap WYSIWYG editor (bold/italic/h3/bullet+ordered lists only — `RichTextEditor.tsx`); rendered through `DOMPurify.sanitize()` before display (`RichText.tsx`) since it's shown to unauthenticated public visitors on the job board/apply page. See [10-job-board-and-applications.md](10-job-board-and-applications.md). |
| jd_file_id | uuid FK → `documents`, nullable | uploaded JD file |
| custom_fields | jsonb | org-defined schema, validated app-side |
| headcount | int default 1 | number of hires this job needs; the job auto-closes to `won` once this many active placements reach the terminal-success (`Signed`) stage. See [03-pipelines-and-boards.md](03-pipelines-and-boards.md). |
| status | enum(`open`, `on_hold`, `won`, `lost`) | `won`/`lost` — sales-deal framing (closed with a hire vs. fell through), not generic "filled/cancelled". `won` is also set automatically by the headcount auto-close. See [03-pipelines-and-boards.md](03-pipelines-and-boards.md). |
| visibility | enum(`public`, `unlisted`) default `public` | `unlisted` jobs don't appear in board listings but are directly reachable by link; both still require `status = 'open'` to be publicly visible. See [10-job-board-and-applications.md](10-job-board-and-applications.md). |
| is_technical_role | bool default false | gates whether the public application form defaults to asking for a GitHub URL |
| work_mode | enum(`remote`, `onsite`, `hybrid`), nullable | null = not specified; drives a public-board filter |
| location | text, nullable | free-text city/region, most meaningful for onsite/hybrid but not restricted to those |
| seniority | enum(`entry`, `mid`, `senior`, `lead`, `executive`), nullable | null = not specified; drives a public-board filter |
| job_type | enum(`full_time`, `part_time`, `contract`, `internship`, `temporary`), nullable | null = not specified; drives a public-board filter |
| salary_min | int, nullable | optional; `salary_max` null + this set = a fixed figure, not a range. **Bug fixed 2026-08-27:** the New Job form's own client-side validation was silently blocking submission whenever this was left blank — `react-hook-form`'s `valueAsNumber: true` maps an empty number input to `NaN` (the native DOM `input.valueAsNumber` behavior), not `undefined`, and Zod's `z.number()` rejects `NaN` outright, failing the whole form's validity with no visible error tying it to this field. The backend schema (`JobCreate.salary_min: int \| None`) was never the problem — only `NewJobDialog.tsx`'s registration was, fixed by mapping an empty string to `undefined` explicitly (`setValueAs`) instead of relying on `valueAsNumber`. `EditJobDialog.tsx` already did the empty-to-`null` conversion explicitly and was never affected. |
| salary_max | int, nullable | optional; both `salary_min`/`salary_max` set = a range. Neither set = "not disclosed" — no separate type enum, presence of `salary_max` (with `salary_min`) is the signal |
| salary_currency | text, nullable | free-text currency label (e.g. "USD", "Rp") shown alongside the figures |
| salary_confidential | bool default false | when true, salary fields stay visible internally (recruiter/org_admin — shown with a lock icon/tooltip) but are stripped server-side from every `/public/*` response, never just hidden client-side. See [10-job-board-and-applications.md](10-job-board-and-applications.md). |
| pipeline_template_id | uuid FK → `pipeline_templates` | template it was cloned from, for reference only |
| client_id | uuid FK → `clients`, nullable | Org-only, optional. Always null for Freelance Org jobs. Assigning it does an explicit tenant-scoped lookup server-side (`jobs.py`'s `_resolve_client_id`) rather than trusting the FK alone — Postgres FK validation checks the referenced row's existence, not the querying role's RLS visibility of it, so without that check a cross-tenant `client_id` would silently satisfy the FK. See [11-security-review.md](11-security-review.md). |
| unique_visitor_count | int, **computed, not a real column** | a SQLAlchemy `column_property` (`app/models/job.py`): a correlated subquery counting `job_views` rows for this job, folded into the normal `SELECT` (no N+1 per row when listing many jobs). Exposed on `JobOut` and shown as a "Views" column on the internal Jobs table. See `job_views` below and [05-dashboards-metrics.md](05-dashboards-metrics.md). |
| client_name | text, **computed, not a real column** | same `column_property` pattern — a correlated subquery pulling `clients.name` for `client_id`, so listing jobs never N+1s to show which client each belongs to. |
| team_name | text, **computed, not a real column** (missing from this table until flagged as drift 2026-08-28) | same `column_property` pattern — a correlated subquery pulling `teams.name` for `team_id`. Shown wherever a job's assigned team is displayed (`JobAssignmentControl.tsx`); same N+1-avoidance rationale as `client_name`. |
| applicant_count | int, **computed, not a real column**, added 2026-08-27 | same `column_property` pattern — a correlated subquery, shown as an "Applicants" column on the internal Jobs table. **Fixed 2026-08-27** (same day, different bug): originally counted only `job_applications` rows, so a candidate attached to the job's pipeline any other way — the "Attach to job" menu action, Find Candidates, Open Profiles, a CV-upload's own attach step — never moved the number, and deleting a candidate who *had* only applied (never placed) didn't decrement it either, since `job_applications` isn't touched by candidate soft-delete. Now counts **distinct candidates linked by either `job_applications` OR `pipeline_placements`** (a `UNION`, not `UNION ALL`, so a candidate who did both — applied, then got marked eligible, which creates the placement — is counted once), both halves filtered to `candidates.deleted_at IS NULL`. **This is now a genuinely different metric from the *public* job board's `applicant_count`** (`PublicJobSummary`/`PublicJobDetail`, via `public_board.py`'s `_applicant_count`, unchanged, still `job_applications`-only) — deliberately: the public board's count is candidate-facing social proof ("N people applied") and showing internal recruiter-sourcing activity there would be misleading, so it stays scoped to genuine public applications. The internal Jobs table's count answers a different question ("how many candidates are in this job's pipeline, however they got there") and needed the broader definition. |

### `job_views`
One row per (job, unique visitor); powers `jobs.unique_visitor_count`
above. Standard tenant-isolation RLS, same pattern as every other
tenant-scoped table — originally added by `0023_job_views.py`, now a
no-op post-consolidation; the live policy is in `0001_initial_schema.py`
along with everything else, see the RLS section below.

| column | type | notes |
|---|---|---|
| id | uuid PK | |
| tenant_id | uuid FK → tenants | RLS-scoped |
| job_id | uuid FK → jobs | |
| visitor_hash | text | `sha256(client_ip + jwt_secret)`, a salted hash of the requester's IP, never the raw IP itself. `jwt_secret` doubles as a pepper here purely for convenience (an existing secret, not a new one to manage), not because it's cryptographically special for this purpose. |
| viewed_at | timestamptz | |
| unique (job_id, visitor_hash) | | a repeat visit from the same person doesn't inflate the count |

Written by `GET /public/jobs/{slug}` (`public_board.py`'s
`_record_job_view`) on every hit to the public apply page: an
`INSERT ... ON CONFLICT DO NOTHING` against the unique constraint, so a
repeat view from the same visitor is a no-op rather than an error. This
is distinct from `job_applications`' `applicant_count` (candidates who
actually applied, shown publicly): `job_views` is page-view traffic,
recruiter-facing only. See
[10-job-board-and-applications.md](10-job-board-and-applications.md) and
[05-dashboards-metrics.md](05-dashboards-metrics.md).

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
| name | text | Sourced / CV Shortlist / Contacted / First Cut / User Interview / Offer / Signed / Reject |
| position | int | display order |
| is_terminal_reject | bool | marks the Reject-type stage for reporting |
| is_terminal_success | bool | marks the terminal-success stage — `Signed`, not `Offer` (extending an offer isn't a placement; the candidate signing it is). See [03-pipelines-and-boards.md](03-pipelines-and-boards.md). |

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
| location | text, nullable | same denormalization rationale as `current_position` — from `parsed_fields.location` (added 2026-08-27, migration `0030`). Free text (city + country), not a structured address; only the LLM tier fills it in — the rule-based/labeled-format tiers have no source for it and leave it null. Shown on Candidate Quick View and the candidate detail page, editable manually too. |
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
| parsed_fields | jsonb | structured CV Parser output for *this* document — canonical shape (name, position, location, summary, total_years_experience, technical_skills, education, certifications, main_projects) documented in [04-cv-parser.md](04-cv-parser.md#parsed-field-schema-candidate_documentsparsed_fields) |
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
| starting_date | date, nullable | captured via `PATCH /placements/{id}/offer-details`, prompted when the placement reaches `Signed` — the actual negotiated outcome, distinct from the job's advertised `salary_min`/`salary_max`. See [03-pipelines-and-boards.md](03-pipelines-and-boards.md). |
| offer_rate | int, nullable | same capture as `starting_date`; feeds the dashboard's placement-value figure. See [05-dashboards-metrics.md](05-dashboards-metrics.md). |
| offer_rate_currency | text, nullable | free-text currency label alongside `offer_rate` |
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

- Implemented — **citations updated 2026-08-28 (flagged as drift): the
  policies were originally introduced across `0002_row_level_security.py`,
  `0006_job_board_and_applications.py`, `0009_nullif_safe_rls_policies.py`,
  and `0023_job_views.py`, but all four were neutered into no-ops during
  the 2026-08-26 migration consolidation (see docs/07's "Local dev
  setup" section) — their `upgrade()`/`downgrade()` are now literally
  `pass`. The real, current policy SQL for every one of these tables
  lives entirely in `backend/alembic/versions/0001_initial_schema.py`
  now; the four files above are worth reading for their docstrings'
  historical narrative, but following them expecting to find live SQL
  will find an empty stub.** Every RLS-scoped table (`jobs`, `candidates`,
  `job_stages`, `pipeline_placements`, `stage_history`, `notes`,
  `candidate_documents`, `documents`, `job_screening_questions`,
  `job_applications`, `teams`, `job_views`) gets one policy:
  `current_setting('app.role', true) IS DISTINCT FROM
  'superadmin' AND tenant_id = NULLIF(current_setting('app.tenant_id',
  true), '')::uuid`. The API connects as a single DB role and sets
  `app.role`/`app.tenant_id` per request via `set_config(..., true)`
  (`app/core/database.py: set_rls_context`) — a session with
  `app.role = 'superadmin'` matches no row, on any of these tables,
  independent of application code.
- `candidates` additionally has an OR-based exception baked into its
  policy (defined in `0001_initial_schema.py`'s `_CANDIDATES_USING`,
  originally introduced across `0006_job_board_and_applications.py` and
  `0009_nullif_safe_rls_policies.py` before the consolidation above):
  `... AND (tenant_id = NULLIF(current_setting('app.tenant_id', true),
  '')::uuid OR open_to_other_roles = true)`. A candidate who opted in at
  public-application time becomes readable to any recruiter platform-wide
  — the first of the app's narrow, deliberate cross-tenant exceptions.
  At the schema/API level the *list* endpoint (`/candidates/open-profiles`)
  still only exposes summary fields (name, position, experience,
  location) — RLS just gates the row, not which columns a given endpoint
  chooses to return. See
  [10-job-board-and-applications.md](10-job-board-and-applications.md)
  ("Open profiles").
- **Extended 2026-08-28** (`0031_open_profile_cv_notes_rls.py`) to
  `candidate_documents`, `documents`, and `notes` — each with the same
  `open_to_other_roles` OR-exception, joined back to `candidates` via
  `candidate_id` (or, for `documents`, via `candidate_documents.file_id`
  since `documents` has no `candidate_id` of its own — a JD-upload
  document simply never matches that join and falls back to the standard
  tenant check). This is what makes Candidate Quick View's CV and Notes
  tabs actually work when opened from Open Profiles for a candidate in a
  *different* tenant — a deliberate widening of the disclosure, not a
  bug fix; see [10-job-board-and-applications.md](10-job-board-and-applications.md)
  for what it means in practice (including that a "team"-visible note
  becomes readable across orgs once the candidate is open, not just
  visible to the viewer and the candidate's home org). Deliberately
  **not** extended to `jobs`/`job_stages`/`pipeline_placements` — a
  placement exposes the *hiring org's* job title/stage, not the
  candidate's own data, and neither the candidate nor the hiring org
  consented to that crossing the boundary. Those three tables keep the
  standard tenant-only policy; a cross-tenant placement query just
  returns zero rows, no special-cased application code needed.
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
