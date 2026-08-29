# Pipelines, Boards & the Multi-Pipeline Candidate Model

## Default pipeline

Every new job clones this stage set from the org's (or platform default)
`pipeline_templates`:

```
Sourced → CV Shortlist → Contacted → First Cut → User Interview → Offer → Signed → Reject
```

`Contacted` sits between CV Shortlist and First Cut — it's the "resume
looks good, we've reached out and are waiting to hear back" stage, distinct
from having actually screened them (CV Shortlist) or run the first cut
interview.

`Reject` is a terminal stage (`is_terminal_reject = true`) usable from any
stage, not only the end of the line — a candidate can be rejected straight
out of `Sourced`.

**`Offer` vs. `Signed`.** `Offer` (a candidate has an offer extended) is
**not** a terminal stage — extending an offer isn't a placement, the
candidate accepting and signing it is. `Signed` is the pipeline's only
`is_terminal_success = true` stage: it's what headcount auto-close and the
offer-details capture prompt below both key off. This corrects an earlier
version of this pipeline where `Offer` was (wrongly) modeled as
terminal-success — see `backend/alembic/versions/0021_job_stage_signed.py`.
A candidate can sit in `Offer` for a while (negotiating, waiting on a
counter-offer, etc.) without that being mistaken for a completed hire.

**Job-level outcome vs. candidate-level stage** — don't confuse the two:
`Signed` above is a *candidate placement* stage (this specific candidate
has signed). The *job* itself has its own terminal outcome —
`jobs.status = won` (the requisition was successfully closed with a hire)
or `lost` (fell through — client cancelled, lost to a competing agency,
etc.) — see [02-data-model.md](02-data-model.md#jobs). A job can have one
candidate with a `Signed`-stage placement while the job itself is still
`open` (multi-hire jobs, see headcount below); `filled`/`cancelled` as
status names are retired in favor of `won`/`lost` — sales-deal framing
fits a recruitment agency's jobs better than generic lifecycle terms.

**Headcount auto-close.** Every job has a `headcount` (default 1 — how
many hires it needs). Dragging (or ⋮-menu-moving) a candidate into the
terminal-success stage (`Signed`) counts *active* placements already
sitting in that stage; if this move brings that count to `headcount`, the
job is set to `won` automatically. Since this can be a consequential,
job-closing side effect of what looks like an ordinary drag, the
frontend intercepts moves that would actually trigger it and shows a
confirm dialog first ("This will mark the job Won") — computed from the
already-loaded placement list, no extra request. A move into that stage
that *doesn't* fill headcount (multi-hire jobs) proceeds without a
prompt. Recruiters can also close a job manually (Won or Lost) at any
time via Edit Job, regardless of headcount.

**Quick job actions (⋮ menu, added 2026-08-27).** `JobDetail.tsx`'s page
header — visible above both the Kanban and Table views of a job's
pipeline, since it's a job-level action, not a per-candidate one — has a
**⋮ "More actions"** menu with three items, all reusing the same
`PATCH /jobs/{id}` / `POST /jobs` endpoints Edit Job and New Job already
use, not new backend surface:
- **Close job** — shown only when the job is `open`/`on_hold`. A quick
  manual close to `lost` (fell through, not filled) without opening the
  full Edit Job dialog. Distinct from the headcount auto-close above,
  which sets `won`, not `lost`, and only fires from an actual pipeline
  move.
- **Re-open job** — shown only when the job is `won`/`lost`. Sets it back
  to `open` regardless of which closed state it was in.
- **Clone job posting** — creates a new job with the same title (suffixed
  " (Copy)"), overview, description, headcount, work mode, location,
  seniority, job type, salary fields, and client, then navigates to the
  new job. Deliberately does **not** copy screening questions, team
  assignment, or pipeline stages — the new job gets the normal
  clone-on-create default stage set and starts fully open, same as any
  other freshly created job (an org_admin cloning a job never becomes its
  owner either, same rule as creating one — see
  [01-roles-permissions.md](01-roles-permissions.md)).

**Offer details capture.** Any move into `Signed` — not just the one
that happens to fill headcount — prompts the recruiter for the placement's
actual negotiated outcome: `starting_date`, `offer_rate`, and
`offer_rate_currency` (`PATCH /placements/{id}/offer-details`, stored on
`pipeline_placements`). This is deliberately distinct from the job's own
advertised `salary_min`/`salary_max` range (see
[02-data-model.md](02-data-model.md#jobs)) — the job posting is what was
advertised, this is what was actually agreed for this specific hire. It
drives the dashboard's placement-value figure
([05-dashboards-metrics.md](05-dashboards-metrics.md)) and isn't
restricted server-side to `Signed`-stage placements or `won` jobs — a
recruiter correcting a figure later isn't blocked by job/placement state.

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
- **Rejected/Withdrawn candidates disappear from Kanban and Table, not
  just change color.** (Fixed 2026-08-27 — previously the card stayed
  visible in whichever column it landed in, with only a small status chip
  as a hint, which read as "marking Rejected does nothing.") Both pipeline
  views (`JobDetail.tsx`) now filter `placements` down to `status ===
  "active"` before rendering. A separate **"Withdrawn / Rejected"**
  collapsible section below the board lists everything filtered out, as
  a real `DataGrid` (changed 2026-08-27 from a flat `Stack` of cards —
  matches the `NotEligibleApplicants` change below), each row with a
  **Restore** button. Its accordion header carries a red count `Badge`
  (MUI's `Badge` component, `badgeContent={placements.length}`,
  `color="error"`, added 2026-08-27) — a scan-at-a-glance signal that
  there's something in there without expanding it; hidden automatically
  when the count is 0 via `Badge`'s default `showZero={false}` (moot here
  since the whole section is unmounted when empty anyway, see above).
- **Restoring sets status back to `active` and returns the card to the
  pipeline's first stage** (`position === 0`), not wherever it was before
  rejection — the simplest, most predictable default, and consistent with
  how a re-application is triaged from scratch. `PATCH
  /placements/{id}/status` now accepts `"active"` as a third value
  alongside `"rejected"`/`"withdrawn"` (`pipeline.py`'s
  `update_placement_status`); restoring clears `status_reason` and records
  a `StageHistory` row like any other stage move.
- **Blacklist is a separate, explicit action**, distinct from moving a
  card to Reject. It requires a reason and a confirmation dialog, sets
  `candidates.blacklisted` for the tenant, and shows as a persistent badge
  on the candidate's profile. It also files the candidate's email in a
  platform-wide registry so other tenants are warned — see
  [01-roles-permissions.md](01-roles-permissions.md) and
  [02-data-model.md](02-data-model.md). It is never an implicit side
  effect of a per-job rejection.
- **Target design, not built (flagged as drift 2026-08-28 — this doc
  previously described both as implemented):** a *"Also in 2 other
  pipelines"* badge on every Kanban card/Table row, expandable to list
  the other jobs and stages, plus a persistent **Active Pipelines** tab
  on the candidate's own profile as the single source of truth for where
  they stand org-wide. `CandidateDetail.tsx` has a "Job History" table
  (not a tab named "Active Pipelines"), and neither `KanbanBoard.tsx` nor
  the Table view renders any cross-pipeline badge today — a recruiter
  has to open the candidate's own page to see their other placements.
- **Target design, not built:** a soft, non-blocking toast when moving a
  candidate to `Offer` or the terminal-success stage (`Signed`) in one
  pipeline while they're active elsewhere — *"This candidate has an
  active offer pending in another job. This won't change that
  pipeline."* `JobDetail.tsx`'s `handleMove`/`performMove` only checks
  headcount (for the Won-confirmation dialog); there's no lookup of the
  candidate's other placements anywhere in the move path.

## Reapplication to the same job

If a candidate who is already attached to a job's pipeline submits (or is
given) a new CV for that same job:

- **No second pipeline row is created.** `pipeline_placements` is unique
  on `(candidate_id, job_id)` — the existing placement and its stage are
  left untouched.
- A new `candidate_documents` row is inserted for that
  `(candidate_id, job_id)` pair, and `is_current` flips to it.
- **Table view shows one row** for that candidate/job pair. **The latest
  version is shown by default** in the collapsed row and on the Kanban
  card — `is_current` always points at it, older versions are never
  deleted. **Target design, not built (flagged as drift 2026-08-28):**
  the row was previously documented as "clickable to expand a version
  history panel — every submitted CV with upload date, uploader, and a
  parsed-field diff." In reality the row's click opens Candidate Quick
  View (`CandidateQuickView.tsx`), which only ever renders the *current*
  document — there's no endpoint or UI anywhere that lists prior
  `candidate_documents` versions or diffs parsed fields between them.

## Attaching and detaching from the Candidate page

On top of attaching a candidate from Find Candidates, Open Profiles, or a
job's own pipeline, a candidate's own detail page
(`CandidateDetail.tsx`) can drive the same relationship from the
candidate's side:

- **Attach to job**: a button opening a job-picker dialog, calling the
  same `POST /jobs/{job_id}/placements` endpoint used elsewhere.
  `AttachToJobDialog` (originally defined inline in `CandidateDetail.tsx`,
  extracted 2026-08-27 into `frontend/src/components/AttachToJobDialog.tsx`
  so it's shared) is also reachable from the Candidates **list** — every
  row's ⋮ menu (`Candidates.tsx`) has an **"Attach to job"** entry
  alongside Edit/Blacklist/Delete, so a recruiter can attach a candidate
  to a job straight from the table without opening the candidate's own
  page first. **The dialog also lists the candidate's existing pipelines**
  (added 2026-08-27) — a candidate is routinely being worked for more than
  one role at once, so before picking another job the recruiter sees a
  chip per job they're already attached to (title · current stage,
  colored by status, same visual language as Quick View's placement
  chips). Sourced from the same `CandidateDetailOut.placements` the
  candidate's own page uses, which is already tenant-scoped — deliberately
  **org-level only**: a candidate attached cross-tenant via Open Profiles
  never surfaces another org's pipeline here, same boundary as everywhere
  else in this doc.
- **Detach**: a per-row action in the candidate's Job History section
  (`DELETE /placements/{placement_id}`, `pipeline.py`'s
  `detach_candidate`).

**Detach is a genuine removal, not a status change**, distinct from
rejecting or withdrawing a candidate (`PATCH /placements/{id}/status`,
see [The multi-pipeline candidate](#the-multi-pipeline-candidate) above),
which keeps the placement and its full `stage_history` for the record.
Detaching deletes the `pipeline_placements` row outright along with its
`stage_history` rows, and nulls out any `job_applications.placement_id`
that referenced it (that foreign key would otherwise block the delete,
since a public application that became eligible links to its placement);
the historical "they applied" record on the application itself survives,
only the placement/link is gone. Use Detach for "this candidate was
attached to the wrong job," not for "this candidate isn't a fit for this
job" (that's a per-job Reject, which is meant to be visible history, not
undone).

`PlacementSummary` (a candidate's placements list, `CandidateDetailOut`)
gained an `id` field so the frontend has something to call Detach with.

## Deleting a candidate who's in one or more pipelines

`DeleteCandidateDialog.tsx` (used from both `Candidates.tsx`'s list-row
⋮ menu and `CandidateDetail.tsx`) fetches the candidate's full
`CandidateDetailOut` (which includes `placements`) as soon as it opens,
and — if there are any — lists every job it found (title, current stage,
status chip) above the confirm button, so the recruiter sees exactly
what they're about to lose visibility into before confirming. This is a
**warning, not a hard block**: the Delete button stays enabled even with
active pipelines listed (added 2026-08-27).

What actually happens on confirm is unchanged from before this dialog
existed: `DELETE /candidates/{id}` soft-deletes the candidate
(`deleted_at` set) and hard-deletes their CV files/documents, but leaves
every `pipeline_placements`/`job_applications`/`stage_history` row
completely untouched — see
[02-data-model.md](02-data-model.md#core-tables)'s note on there being no
DB-level cascade. The candidate simply disappears from every read path
that filters `deleted_at IS NULL` (which, as of the 2026-08-27 fix,
includes the Kanban/Table pipeline views and the applications panel).
The listing in this dialog is informational, sourced from the same
`placements` data as the candidate's own Active Pipelines tab — it does
not itself trigger any detach/reject action, it just tells the recruiter
what will go quiet.

## Table vs. Kanban

- **Jobs list:** defaults to **Table** — recruiters triage many jobs at
  once (sortable by deadline, stage counts, aging).
- **Inside a single job (its pipeline):** defaults to **Kanban** — a
  spatial, per-stage view is more useful once focused on one role.
- **Candidates list (cross-job):** defaults to **Table**, with a "Stage"
  column per relevant job when filtered to one job's context.
- **Candidate Quick View, everywhere a candidate shows up on a job's
  page:** clicking anywhere on a Kanban card (other than the ⋮ menu,
  which stops propagation), any row of the pipeline Table view (other
  than the Stage dropdown cell), any row of the Withdrawn/Rejected
  section, or any row of the Not-eligible-applicants section (see
  [10-job-board-and-applications.md](10-job-board-and-applications.md#screening-questions))
  opens the same `CandidateQuickView` side drawer used from the
  Candidates list table (see
  [06-ui-design-system.md](06-ui-design-system.md#quick-view-drawer-candidates-list))
  — a recruiter can review a candidate's parsed CV and basic info without
  leaving the job's page, regardless of which of the four places they
  spotted the candidate. **Broadened 2026-08-27** (originally Kanban-only,
  via `KanbanBoard.tsx`'s `onOpenCandidate`): `JobDetail.tsx` now also
  wires `onRowClick` on the pipeline Table's `DataGrid` and passes
  `onOpenCandidate` down into `WithdrawnRejectedSection` and
  `JobApplicationsPanel`'s `NotEligibleApplicants`, all driving the same
  single `quickViewCandidateId` state — so Next/Previous inside the
  drawer still walks the job's full placement list regardless of which
  section it was opened from.
- **Target design:** the Table-vs-Kanban choice is a per-user, per-list
  preference, remembered across sessions. **Implemented today:** it's
  local component state on the job's own pipeline view (Kanban/Table
  toggle), reset to Kanban on every navigation — not yet persisted
  anywhere. See [06-ui-design-system.md](06-ui-design-system.md).
- **Target design:** table view of a pipeline mirrors Kanban's columns as
  a sortable/groupable "Stage" field, and supports multi-select + bulk
  "Move to stage ▸" via the ⋮ menu. **Implemented today:** the table
  view's Stage column is an editable dropdown per row (added
  2026-08-27, `JobDetail.tsx` — same `handleMove` the Kanban board calls,
  so headcount auto-close and the offer-details prompt on reaching the
  terminal-success stage both still fire from the table too). The
  dropdown's `disabled` check against a non-`active` status is now
  effectively dead code — the table only ever receives active placements
  (see [The multi-pipeline candidate](#the-multi-pipeline-candidate)
  above) — kept as a defensive guard rather than removed. There's still no
  multi-select or bulk "Move to stage" action anywhere in the app — that
  part of the target design remains unbuilt.

## Drag-and-drop / ⋮ parity

**Target design:** every drag-and-drop action has an identical entry in
the row/card's **⋮** menu: "Move to stage ▸", "Mark as Rejected", "Mark as
Withdrawn", "Blacklist candidate", "Add note", "Schedule interview" (P1),
"View version history".

**Implemented today:** the Kanban card's ⋮ menu offers "Mark as Rejected"
and "Mark as Withdrawn" only (restoring a rejected/withdrawn candidate is
not a ⋮ entry — since those cards no longer appear on the board at all,
it's a "Restore to pipeline" button in the Withdrawn/Rejected section
instead, see above). **Fixed 2026-08-27 — dnd-kit + portaled Menu bug:**
MUI's `Menu` portals its DOM out of the card, but stays a React-tree
child of the card's `Paper` (it's still a JSX descendant), so a
pointerdown on a menu item bubbled through React's synthetic event tree
straight into dnd-kit's drag activator on that `Paper`, which read it as
"the user grabbed the card." That swallowed the click and animated a
drag-cancel snap-back instead of ever calling the menu item's handler —
the ⋮ menu looked impossible to dismiss, and "Mark as Rejected" appeared
to do nothing except make the card visibly shake. Fixed by passing
`disabled: !!menuAnchor` to `useDraggable` (`KanbanBoard.tsx`) — dnd-kit
strips its pointer/keyboard listeners from the `Paper` entirely whenever
that card's own menu is open, so nothing above the menu item can
intercept the click. Both actions are — as originally intended — fully
keyboard/touch-accessible without drag. **Changed 2026-08-27:** the table view's Stage column is
now an editable dropdown (see above) — a real non-drag way to move a
candidate between stages exists, closing the gap this section used to
describe. Kanban's card itself still has no "Move to stage ▸" menu entry
(drag remains the only way to move a candidate *from the Kanban view*
specifically) — a mouse/touch user who wants a non-drag path today needs
to switch to Table view, not a same-view menu entry. Drag is an
accelerator for mouse users; on touch devices or for screen-reader users,
switching to Table view is currently the accessible path for a stage
move, not a ⋮ entry on the card itself.

## Search

The authenticated Jobs and Candidates lists (`Jobs.tsx`, `Candidates.tsx`)
use a plain keyword search box plus point-and-click, structured filters —
**not** a boolean query syntax. An earlier pass shipped a boolean
AND/OR/NOT query field (`BooleanSearchField`/`booleanSearch.ts`); it was
removed after user feedback that junior recruiters found expressions like
`senior AND (react OR vue)` too hard to type correctly, and replaced with
this filter model. All filtering below is client-side over the
already-fetched list (no server round-trip per keystroke/filter change),
consistent with the public job board's search box
([10-job-board-and-applications.md](10-job-board-and-applications.md#board-filters)).

- **Jobs:** a keyword box (matches title + overview, case-insensitive
  substring), plus a job-status multi-select toggle group, an
  assignment toggle (all jobs / unassigned only), and single-select
  dropdowns for seniority and job type. A "Clear filters" chip is
  disabled when no filter is active and enabled once any is.
- **Candidates:** a keyword box (matches name + current position +
  email), plus a source dropdown (populated from the distinct `source`
  values already present in the loaded list) and a blacklist toggle (all
  candidates / blacklisted only). Same "Clear filters" pattern.
- All filters on a given list combine with AND, and with the keyword box.

## Find Candidates

A recruiter-facing nav item (`Find Candidates`, `/app/candidates/find`,
`FindCandidates.tsx`) for reusing candidates already in the system against
a *different* job — distinct from the Jobs/Candidates search above, which
only searches within a recruiter's own tenant by name/position/email.
Find Candidates searches by **technical skill** instead, and searches a
wider pool: the recruiter's own org's candidates **and** every
platform-wide open-profile candidate (`open_to_other_roles = true`, see
[10-job-board-and-applications.md](10-job-board-and-applications.md#open-profiles-a-narrow-deliberate-rls-exception)),
in one combined result list.

- **Data source:** entirely `candidate_documents.parsed_fields.technical_skills`
  — the CV parser's structured skill output, shaped as
  `{category: [{name, years_of_experience, last_used}]}`
  (`backend/app/services/cv_parser.py`'s `SKILL_HEADER_MAP`; see
  [04-cv-parser.md](04-cv-parser.md)). Only each candidate's *current*
  CV document is searched. `GET /candidates/skills` powers the skill-name
  autocomplete, sourced from the same pool this search runs over.
- **Skill filters:** a recruiter adds one or more skill filters (name +
  optional min-years + optional used-since-year). Multiple skill filters
  combine via a top-level `skill_match` toggle (**all**/AND — candidate
  must match every filter — or **any**/OR — at least one). Within a single
  skill filter, if both min-years and used-since-year are set, a
  per-filter `condition_match` toggle (all/any) controls how *those two*
  conditions combine for that one skill.
- **Results** are a real `DataGrid` (changed 2026-08-28 from a hand-rolled
  card list, same conversion as Open Profiles/Withdrawn-Rejected/
  Not-eligible — see [10-job-board-and-applications.md](10-job-board-and-applications.md)
  and above) — Name (with a scope chip: **"Your org"** or **"Open
  profile"**), Position, **Location** (added 2026-08-28), Experience, and
  a Matched skills column (chips with years/last-used detail, wrapped
  across lines via `getRowHeight="auto"` since a candidate can match
  several filters at once). Clicking a row (or a dedicated Quick View
  icon button — added since a row click here opens Quick View rather
  than navigating anywhere, unlike the Candidates list where row click
  goes to the full profile) opens the same `CandidateQuickView` drawer
  used everywhere else, with Next/Prev cycling through the current
  result set — works identically for both scopes, since open-profile
  results already ride the same cross-tenant RLS exception (CV, notes)
  covered above. A recruiter can **attach** any result to one of their
  own jobs: org-scope candidates via the ordinary
  `POST /jobs/{id}/placements`, and public-scope (open-profile)
  candidates via `POST /jobs/{id}/placements/from-open-profile/{candidate_id}`
  — the same cross-tenant attach path Open Profiles uses.
- **Backend:** `POST /candidates/search`
  (`CandidateSearchRequest`/`CandidateSearchResult` in
  `backend/app/schemas/candidate.py`) — see
  `backend/app/api/routers/candidates.py`'s `search_candidates`,
  `_findable_candidates`, `_current_skill_entries_by_candidate`, and
  `_skill_filter_match`.
