# Roles, Permissions & Confidentiality

## Roles

### Superadmin (platform level)

**Can:**
- Create/suspend Org tenants; provision the first Org Admin for a new org.
- Manage the Freelance Org's membership: review/approve/reject freelance
  recruiter registrations.
- Manage billing: plans, subscriptions, invoices, usage-based limits.
- View platform-wide **aggregate** metrics (counts, trends) — never
  record-level content. **Implemented today:** tenant/recruiter/queue
  counts only (`GET /metrics/platform`). Job/candidate aggregate counts
  (e.g. "total open jobs platform-wide") are **not yet reachable** — the
  `jobs`/`candidates` RLS policy excludes the superadmin role entirely
  (by design, see [02-data-model.md](02-data-model.md)), so even a bare
  `COUNT(*)` needs a dedicated aggregate mechanism (a `SECURITY DEFINER`
  function or materialized view) that doesn't exist yet. This is a known,
  commented gap, not an oversight — see
  [08-open-questions-and-gaps.md](08-open-questions-and-gaps.md).
- Configure system-level defaults (default pipeline template, global custom
  field types, stage-name defaults).
- Triage support tickets and, only through **Assisted Access** (below),
  look at a specific record with the tenant's consent.

**Cannot, by design (not by convention):**
- Read any job, candidate, note, resume, or pipeline content belonging to
  any org or the Freelance Org.
- This is enforced with Postgres **row-level security** on every table that
  holds recruiter-generated content (`jobs`, `candidates`,
  `pipeline_placements`, `notes`, `candidate_documents`,
  `stage_history`). The superadmin's DB role has no policy granting access
  to these rows — a direct API call bypassing the UI gets the same 403 a
  hidden button would only pretend to prevent. See
  [02-data-model.md](02-data-model.md#row-level-security-rls-model).

**Assisted Access (support exception):** if a superadmin genuinely needs to
see a specific record (e.g., debugging a bug report), they file an
`assisted_access_requests` row naming the record and reason. The affected
Org Admin (or the freelancer, for Freelance Org data) must approve it before
a **time-boxed** (default 24h) RLS grant is applied, and the access itself
is logged to the org-tier audit log the recruiter/admin can see. There is no
standing "login as user" impersonation path.

**Status: schema-only, not yet implemented.** The `AssistedAccessRequest`
model exists (`backend/app/models/access.py`) but there is no API router
for it — no endpoint files/approves/lists a request, and nothing ever
grants the corresponding RLS access. This whole flow is designed but not
built; see [02-data-model.md](02-data-model.md) and
[08-open-questions-and-gaps.md](08-open-questions-and-gaps.md).

### Org Admin (one org tenant)

**Can:**
- Invite/deactivate/reassign Recruiters within their org (seat management).
- Full read visibility into every recruiter's jobs, candidates, pipelines,
  and stage history in their org — this is the point of the role.
- Assign new jobs to a recruiter, or leave them in an "Unassigned Jobs"
  queue recruiters self-claim from.
- Bulk-reassign all of one recruiter's jobs to another (recruiter
  leaves/is out) — first-class action, not a manual one-by-one fix. This
  moves jobs of any status (open, on-hold, won, lost), not just open
  ones.
- Group recruiters into **Teams** and filter the org dashboard's charts —
  including a per-recruiter performance breakdown — by team. See
  [05-dashboards-metrics.md](05-dashboards-metrics.md).
- Edit org-wide pipeline templates, custom field definitions, and org
  billing/seat count (within Superadmin-set plan limits).
- Override a candidate's pipeline stage directly. This is allowed, but is
  never silent: the resulting `stage_history` row is flagged
  `was_admin_override = true`, which the UI reads to show a distinct
  "changed by Admin" marker on the card. (This is a per-row flag today,
  not a write to the separate `audit_log_org` table described below under
  "Audit log tiering" — that table exists in the schema but nothing
  currently writes to it; see
  [08-open-questions-and-gaps.md](08-open-questions-and-gaps.md).)

**Cannot:**
- See another org's data (tenant isolation via RLS, same mechanism as
  Superadmin's restriction, just scoped the other way).
- Read a recruiter's notes explicitly marked **private-to-me** (see
  Notes below) — full pipeline/candidate visibility does not extend to a
  recruiter's personal scratch notes.

### Recruiter

**Can:**
- Create/manage jobs and candidates within their tenant (org or Freelance
  Org).
- Customize a job's pipeline (add/reorder/rename/delete stages, subject to
  the non-empty-stage-deletion rule in
  [03-pipelines-and-boards.md](03-pipelines-and-boards.md)).
- Add candidates to any number of job pipelines.
- Mark a note **private-to-me** (hidden from Org Admin and other
  recruiters) or **team-visible** (default).
- Mark a candidate **blacklisted** — a distinct, explicit action requiring
  a reason, separate from rejecting them in a single job's pipeline (see
  [03-pipelines-and-boards.md](03-pipelines-and-boards.md)). This also
  files the candidate's email in a platform-wide blacklist registry: if
  the same email later applies to a role at a *different* tenant, that
  recruiter sees a flag with the reason and date (but not who filed it or
  which org). This is a third narrow, deliberate cross-tenant exception,
  alongside open profiles and the public job board — see
  [02-data-model.md](02-data-model.md).

**Cannot:**
- See another recruiter's private notes.
- See another org's or another Freelance Org member's data. **Candidates
  a freelancer uploads or receives applications for are private to them
  by default** — a different freelancer in the same Freelance Org tenant
  cannot see, list, or fetch that candidate record, even though they
  share the same `tenant_id`. This is enforced by RLS via a new
  `candidates.owner_user_id` column and an `app.user_id` session GUC (see
  [02-data-model.md](02-data-model.md)), not just app-level filtering.
  There is currently no "share this candidate with my fellow freelancers"
  toggle — privacy is the only mode, not a default that can be turned
  off. This is unrelated to, and doesn't affect, the separate
  cross-*tenant* Open Profiles opt-in (`open_to_other_roles`) a candidate
  sets for themselves at public-application time.
  Jobs are **not** covered by this — every Freelance Org job is still
  visible to every freelancer in that tenant, same as an Org tenant's
  jobs are to its recruiters. A per-job "mark confidential" capability
  for freelancers is aspirational — no such field exists on `Job` today.
  See [08-open-questions-and-gaps.md](08-open-questions-and-gaps.md) for
  the conflict-of-interest flag between competing freelancers, now
  including the job-level gap alongside the (now-solved) candidate one.

### Freelance Recruiter

Not a separate role in the permission model — a Recruiter whose tenant is
the platform-owned Freelance Org. They get the standard Recruiter
permission set, scoped to that tenant. The only difference is *how they got
there*: self-registration + Superadmin approval, below.

## Permission matrix

| Action | Superadmin | Org Admin | Recruiter |
|---|:---:|:---:|:---:|
| Create/suspend org tenants | ✅ | ❌ | ❌ |
| Manage billing/plans | ✅ | Seat count only | ❌ |
| Approve Freelance Org registrations | ✅ | ❌ | ❌ |
| Invite/deactivate recruiters in own org | ❌ | ✅ | ❌ |
| View own org's jobs/candidates | ❌ (blocked) | ✅ | ✅ (own + org-shared) |
| View another org's jobs/candidates | ❌ | ❌ | ❌ |
| Edit pipeline template (org-wide) | ❌ | ✅ | ❌ (per-job only) |
| Override a candidate's stage | ❌ | ✅ (logged) | ✅ (own work) |
| Read another recruiter's private notes | ❌ | ❌ | ❌ |
| View platform aggregate metrics | Tenant/recruiter counts only (job/candidate counts not yet reachable) | Own org only | ❌ |

## Freelance recruiter registration flow

A public **Register** menu item (separate from the tenant-scoped login) is
the entry point. It is *only* for freelance recruiters — Org tenants are
provisioned by Superadmin creating the Org Admin account directly (agencies
are a sales-assisted onboarding, not self-serve, in P0).

1. **Register** → form collects: name, email, phone, LinkedIn/portfolio
   URL, years of recruiting experience, industry specialization/niche, and
   an optional note on prior placements. No payment info at this step.
2. Account is created in `pending_approval` status; applicant gets a
   confirmation email. They cannot log in to the product yet.
3. Superadmin sees the application in an **Approval Queue** (this is the
   *only* recruiter-adjacent content a Superadmin is allowed to see — it's
   pre-tenant, not yet recruiter work product).
4. Superadmin approves or rejects, with a reason. Rejection emails the
   reason to the applicant and deletes the pending account (no residual
   data — nothing was created yet).
5. On approval: applicant gets an activation email, sets a password, and
   lands in a short onboarding wizard: specialization/tag selection (drives
   future candidate-matching) → guided empty state ("Upload your first
   resume" / "Post your first job") instead of a blank dashboard.

Data ownership note for departing freelancers is a deliberate open decision
— see [08-open-questions-and-gaps.md](08-open-questions-and-gaps.md#3-multi-tenancy-data-isolation).

## Notes visibility model

- Default: **team-visible** within the tenant (Org Admin + all recruiters
  with access to that candidate).
- Recruiter can flag an individual note **private-to-me** — never shown to
  Org Admin or peers. This is scoped to the note, not the whole candidate;
  there is no "hide this entire candidate from my Admin" capability in P0
  (it undermines the Admin's full-visibility model and invites disputes —
  see QA finding 2.7 in the gaps doc).

## Audit log tiering

Two separate logs, not one filtered view — this matters because *the log
itself* is confidential content:

- **Platform-tier audit log** (Superadmin-visible): tenant/user
  provisioning, billing events, login/auth events, Assisted Access
  grants/usage.
- **Org-tier audit log** (Org Admin + recruiters, scoped to their tenant):
  job/candidate CRUD, stage moves, admin overrides, note edits.

A superadmin never has a query path that joins into the org-tier log's
content.
