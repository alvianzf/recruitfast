# Pipelines, Boards & the Multi-Pipeline Candidate Model

## Default pipeline

Every new job clones this stage set from the org's (or platform default)
`pipeline_templates`:

```
Sourced → CV Shortlist → Contacted → First Cut → User Interview → Offer → Reject
```

`Contacted` sits between CV Shortlist and First Cut — it's the "resume
looks good, we've reached out and are waiting to hear back" stage, distinct
from having actually screened them (CV Shortlist) or run the first cut
interview.

`Reject` is a terminal stage (`is_terminal_reject = true`) usable from any
stage, not only the end of the line — a candidate can be rejected straight
out of `Sourced`.

**Job-level outcome vs. candidate-level stage** — don't confuse the two:
`Offer` above is a *candidate placement* stage (this specific candidate
has an offer). The *job* itself has its own terminal outcome —
`jobs.status = won` (the requisition was successfully closed with a hire)
or `lost` (fell through — client cancelled, lost to a competing agency,
etc.) — see [02-data-model.md](02-data-model.md#jobs). A job can have one
candidate with an `Offer`-stage placement while the job itself is still
`open`; the job only becomes `won` once that hire is confirmed, and
`filled`/`cancelled` as status names are retired in favor of `won`/`lost`
— sales-deal framing fits a recruitment agency's jobs better than generic
lifecycle terms.

## Clone-on-create, not live-linked

A job's pipeline (`job_stages`) is an independent copy taken from the
template at creation time.

- Editing one job's stages (rename, reorder, add, remove) never affects
  any other job.
- Editing the org-wide template only affects jobs created **after** the
  edit.
- An Admin can explicitly run "Reset to template" on an existing job to
  pull in template changes — an opt-in action, never automatic.

## Customizing a job's pipeline

Recruiters (and Admins) can add, reorder, rename, and delete stages on a
per-job basis.

- **Reordering** is always safe — candidates stay in their named stage.
- **Renaming** is a metadata edit only. Past `stage_history` rows keep the
  label that was active at the time of the move (`stage_label_snapshot`),
  so renaming never rewrites history or corrupts time-in-stage reporting.
- **Deleting a stage that has active candidates in it is blocked.** The
  delete action instead prompts: *"3 candidates are in this stage — move
  them to:"* with a stage picker, and only completes once that reassignment
  is made. This is a mandatory step, not a warning that can be dismissed.

## The multi-pipeline candidate

A candidate is a single record; each job they're attached to gets its own
`pipeline_placements` row with its own `current_stage_id`. Moving a card in
one job's board **only** updates that job's placement.

- **Rejection is per-job by default.** Rejecting a candidate in Job A's
  pipeline has no effect on their placement in Job B — a candidate who
  isn't right for one role can still be perfect for another.
- **Dropped/Withdrawn is a distinct status from Rejected.** Rejection is
  recruiter-initiated ("not a fit"); Withdrawn is candidate-initiated
  ("no longer interested / took another offer / unresponsive"). Both are
  values of `pipeline_placements.status` alongside `active`, are settable
  from **any** stage (not just the terminal `Reject` stage) via the ⋮ menu
  — "Mark as Rejected" / "Mark as Withdrawn" — and both stop a placement
  from counting as active in dashboards without implying the same thing:
  a Rejected candidate reflects on fit, a Withdrawn one doesn't, and
  conversion-rate metrics ([05-dashboards-metrics.md](05-dashboards-metrics.md))
  report them separately so a run of withdrawals doesn't get misread as a
  recruiter sourcing/screening problem.
- **Marking Rejected or Withdrawn also relocates the card.** Setting
  `pipeline_placements.status` to either value physically moves
  `current_stage_id` to the job's Reject-flagged stage, regardless of
  which stage the candidate was moved from — this keeps the board visually
  consistent (rejected/withdrawn candidates always land in the same
  column) while `status` still records *why* it happened.
- **Blacklist is a separate, explicit action**, distinct from moving a
  card to Reject. It requires a reason and a confirmation dialog, sets
  `candidates.blacklisted` for the tenant, and shows as a persistent badge
  on the candidate's profile. It also files the candidate's email in a
  platform-wide registry so other tenants are warned — see
  [01-roles-permissions.md](01-roles-permissions.md) and
  [02-data-model.md](02-data-model.md). It is never an implicit side
  effect of a per-job rejection.
- **Visibility, not silence:** every candidate card (Kanban) and row
  (Table) shows a badge — *"Also in 2 other pipelines"* — that expands to
  list the other jobs and their current stage. The candidate's profile has
  a persistent **Active Pipelines** tab as the single source of truth for
  where they stand org-wide.
- **Soft warning on consequential moves:** moving a candidate to `Offer` or
  a terminal-success stage in one pipeline triggers a non-blocking toast if
  they're active elsewhere — *"Jane Doe has an active offer pending in
  [Job B]. This won't change that pipeline."* It informs, it never blocks;
  a candidate fielding two offers at once is a legitimate real-world state.

## Reapplication to the same job

If a candidate who is already attached to a job's pipeline submits (or is
given) a new CV for that same job:

- **No second pipeline row is created.** `pipeline_placements` is unique
  on `(candidate_id, job_id)` — the existing placement and its stage are
  left untouched.
- A new `candidate_documents` row is inserted for that
  `(candidate_id, job_id)` pair, and `is_current` flips to it.
- **Table view shows one row** for that candidate/job pair. The row is
  clickable to expand a version history panel — every submitted CV with
  upload date, uploader, and a parsed-field diff. **The latest version is
  shown by default** in the collapsed row and on the Kanban card; older
  versions are one click away, never deleted.

## Table vs. Kanban

- **Jobs list:** defaults to **Table** — recruiters triage many jobs at
  once (sortable by deadline, stage counts, aging).
- **Inside a single job (its pipeline):** defaults to **Kanban** — a
  spatial, per-stage view is more useful once focused on one role.
- **Candidates list (cross-job):** defaults to **Table**, with a "Stage"
  column per relevant job when filtered to one job's context.
- **Target design:** the choice is a per-user, per-list preference,
  remembered across sessions. **Implemented today:** it's local component
  state on the job's own pipeline view (Kanban/Table toggle), reset to
  Kanban on every navigation — not yet persisted anywhere. See
  [06-ui-design-system.md](06-ui-design-system.md).
- **Target design:** table view of a pipeline mirrors Kanban's columns as
  a sortable/groupable "Stage" field, and supports multi-select + bulk
  "Move to stage ▸" via the ⋮ menu. **Implemented today:** the table view
  shows Stage as a read-only column; there's no multi-select or bulk
  action UI yet anywhere in the app.

## Drag-and-drop / ⋮ parity

**Target design:** every drag-and-drop action has an identical entry in
the row/card's **⋮** menu: "Move to stage ▸", "Mark as Rejected", "Mark as
Withdrawn", "Blacklist candidate", "Add note", "Schedule interview" (P1),
"View version history".

**Implemented today:** the Kanban card's ⋮ menu offers "Mark as Rejected"
and "Mark as Withdrawn" only — both fully keyboard/touch-accessible
without drag. There is currently no non-drag way to move a candidate
between stages (no "Move to stage" menu entry, no editable stage control
in the table view) — full parity is not yet built. Drag is an accelerator
for mouse users; the ⋮ menu is the primary path on touch devices and for
screen-reader users, and both call the same backend action — there is no
drag-only capability.
