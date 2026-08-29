# Roles, Permissions & Confidentiality

## Roles

### Superadmin (platform level)

**Can:**
- Create Org tenants and provision the first Org Admin for a new org in
  one call (`POST /admin/organizations`), or register an additional
  admin for an existing org later (`POST
  /admin/organizations/{tenant_id}/admins`). **Implemented** — the
  `/app/admin/organizations` page. **Suspending** an org tenant
  (`tenants.status = 'suspended'`) is schema-only — no UI/API sets it
  yet.
- Create other superadmin accounts (`POST /admin/superadmins`) and
  activate/deactivate any platform user, any role
  (`PATCH /admin/users/{id}/status`), from the same page's Users tab.
  Deactivating requires confirmation; a superadmin cannot deactivate
  their own account (self-lockout guard). None of these create payloads
  accept a client-supplied role — the role granted is hardcoded per
  endpoint (org admin, superadmin, etc.), so there's no request shape
  that grants more access than the endpoint itself is named for. The
  only way to forge superadmin access is to forge a valid JWT.
- View the Freelance Org's self-registered members (`GET
  /admin/freelance-applications`). This is visibility, not a gate:
  registration itself grants immediate access, it does not wait on
  Superadmin action. Removing a bad-faith account is the same generic
  `PATCH /admin/users/{id}/status` deactivate used for any user — there
  is no freelance-specific reject/delete action once an account is live
  (it may already own real candidates/jobs). See "Freelance recruiter
  registration flow" below.
- Set an Org's **recruiter seat limit** (`PATCH
  /admin/organizations/{tenant_id}/seats`, added 2026-08-26) — a number
  mirroring the /pricing tiers, or null for unlimited (the Custom tier).
  Only recruiter-role seats are counted; org_admin seats are separate and
  uncapped. See
  [02-data-model.md](02-data-model.md) (`tenants.max_recruiter_seats`).
- **Revoke a candidate's Open Profile opt-in** (`candidates.open_to_other_roles`,
  once already `true`): the only role allowed to flip it back to
  `false`. A recruiter or org_admin attempting the same `PATCH
  /candidates/{id}` gets a 403 (`backend/app/api/routers/candidates.py`'s
  `update_candidate`). The candidate's own consent to opt out is treated
  as something only platform-level intervention should act on, not
  something any recruiter who happens to have that candidate attached to
  a job can quietly undo. See
  [10-job-board-and-applications.md](10-job-board-and-applications.md#open-profiles-a-narrow-deliberate-rls-exception).
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
- Invite/deactivate/reassign Recruiters within their org (seat
  management) — capped by the org's superadmin-set recruiter seat limit
  (`tenants.max_recruiter_seats`, added 2026-08-26). Inviting past the
  limit 400s with a message naming the limit; a superadmin has to raise
  it (or clear it for unlimited) before more recruiters can join. See
  [02-data-model.md](02-data-model.md).
- Full read visibility into every recruiter's jobs, candidates, pipelines,
  and stage history in their org — this is the point of the role.
- Create job postings and assign them — to one specific recruiter, to a
  whole **Team** (any recruiter on that team can self-claim it), or leave
  a job open to the whole org's "Unassigned Jobs" self-claim queue.
  **Admins never own a job themselves** — creating/assigning a job is not
  "doing recruiter work"; see the bullet below and
  [03-pipelines-and-boards.md](03-pipelines-and-boards.md).
- Bulk-reassign all of one recruiter's jobs to another (recruiter
  leaves/is out) — first-class action, not a manual one-by-one fix. This
  moves jobs of any status (open, on-hold, won, lost), not just open
  ones.
- Group recruiters into **Teams** and filter the org dashboard's charts —
  including a per-recruiter performance breakdown — by team. See
  [05-dashboards-metrics.md](05-dashboards-metrics.md).
- Edit org-wide pipeline templates, custom field definitions, and org
  billing/seat count (within Superadmin-set plan limits).
- Manage the org's public profile (`/app/org/profile`) — logo (drag-drop
  upload or a pasted image URL — see `ImageUploadField.tsx`), description,
  office location, and contact email — shown on the org's public career
  page. See
  [10-job-board-and-applications.md](10-job-board-and-applications.md#org-profile-org_admin-editable).
- Create/edit the org's **Clients** roster (`/app/clients`, added
  2026-08-26) — the companies the org's jobs are worked on behalf of.
  Any recruiter in the org can read the roster (needed to pick a client
  on a job) and view a client's metrics, but only org_admin can
  create/edit an entry. See
  [02-data-model.md](02-data-model.md#clients-org-only-added-2026-08-26).
- **Admins don't do recruiter work — changed 2026-08-26.** Previously, an
  org_admin creating a job without explicitly leaving it "unassigned"
  became its owner (`owner_recruiter_id` = the admin's own id) — the
  admin was, in effect, working the job like a recruiter. Fixed: an
  admin-created job's `owner_recruiter_id` is now *always* null; the
  admin can instead pick a **Team** to assign it to (`JobCreate.team_id`)
  at creation, or leave it fully open. Both `POST /jobs/{id}/assign`
  (org_admin-only) and `POST /jobs/{id}/claim` (self-claim) now enforce
  the target/claimer actually has role `recruiter` — an admin can no
  longer assign a job to another admin, to themselves, or self-claim one.
  A recruiter creating a job is still always its own owner, unchanged.
  See [02-data-model.md](02-data-model.md) and
  [03-pipelines-and-boards.md](03-pipelines-and-boards.md).
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
  There is no separate "share with my fellow freelancers" toggle — the
  existing **Open Profiles** opt-in (`open_to_other_roles`, checked by
  the *candidate* on the public application form, not the recruiter)
  doubles as that mechanism: it overrides privacy entirely, making the
  candidate visible platform-wide — to every tenant, not just the
  uploading freelancer's fellow freelancers — the same as it always has
  for cross-tenant Open Profiles sharing. A private candidate becomes
  fully public (not "shared within my tenant only") the moment that box
  is checked; there's no in-between visibility tier. **This also isn't
  reversible by a recruiter once set** (see Superadmin's "Revoke a
  candidate's Open Profile opt-in" above). `EditCandidateDialog.tsx`'s
  "Open Profile" switch is disabled with an explanatory caption once
  already true, unless the current user is a superadmin.
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
there*: public self-registration, immediate access, below.

## Permission matrix

| Action | Superadmin | Org Admin | Recruiter |
|---|:---:|:---:|:---:|
| Create org tenants + first admin | ✅ | ❌ | ❌ |
| Suspend org tenants | ❌ (schema-only) | ❌ | ❌ |
| Register additional org admins | ✅ | ❌ | ❌ |
| Create other superadmins | ✅ | ❌ | ❌ |
| Activate/deactivate any platform user | ✅ | Own org's recruiters only | ❌ |
| Manage billing/plans | ✅ | Seat count only | ❌ |
| Set an org's recruiter seat limit (`max_recruiter_seats`) | ✅ | ❌ (sees usage, can't change the cap) | ❌ |
| View Freelance Org registrations (visibility only, no gate) | ✅ | ❌ | ❌ |
| Revoke a candidate's Open Profile opt-in | ✅ | ❌ | ❌ |
| Invite/deactivate recruiters in own org | ❌ | ✅ | ❌ |
| Edit own org's public profile (logo/description/location/contact) | ❌ | ✅ | ❌ |
| Leave a created job unassigned/claimable | ❌ (no org) | ✅ | ❌ (always self-owned) |
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

1. **Register** → form collects: name, email, password, phone,
   LinkedIn/portfolio URL, years of recruiting experience, industry
   specialization/niche, and an optional note on prior placements. No
   payment info at this step.
2. Account is created directly in `active` status and the applicant is
   signed in immediately — **there is no Superadmin approval gate**. The
   submitted details are still recorded as a `FreelanceApplication` row
   (pre-set to `approved`) so a Superadmin can see who has joined, but
   nothing blocks on that review.
3. If a Superadmin later needs to remove a bad-faith or otherwise
   problematic account, the existing generic
   `PATCH /admin/users/{id}/status` (Activate/deactivate any platform
   user) is the mechanism — same as deactivating any other user. There is
   no freelance-specific reject/delete action once an account is live,
   since it may already own real candidates/jobs.

**Planned, not built:** a subscription/payment gate is the intended future
replacement for any access control on freelance registration — e.g.
requiring a plan selection or card on file before (or shortly after)
self-registration. See
[08-open-questions-and-gaps.md](08-open-questions-and-gaps.md). Until
that ships, self-registration is fully open.

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
