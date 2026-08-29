# Public Job Board & Candidate Applications

A public, unauthenticated surface where candidates discover open roles and
apply directly — the inbound counterpart to the recruiter-side CV upload
flow in [09-candidate-intake.md](09-candidate-intake.md). This is the
first part of the product with no login at all: job board pages and the
apply endpoint are reachable by anyone with the link.

## Assumptions made explicit

The request that specced this feature was necessarily high-level; these
are the calls made to turn it into something buildable. Flag any of these
that should go the other way:

1. **Screening questions are available to any recruiter creating a job**,
   with a role-based cap: **freelance recruiters are capped at 4
   questions per job; Org recruiters/Org Admins have no cap.** Confirmed
   explicitly — freelancers get a deliberately lighter-weight tool,
   Org tenants (who are paying for more structured hiring) aren't
   artificially limited.
2. ~~No per-job "publish to board" toggle~~ — superseded, see
   [Job visibility](#job-visibility-public-vs-unlisted) below.
3. **"Open profile" exposes only the candidate's summary fields**
   (name, current position, years of experience) to other orgs' recruiters
   — not their parsed resume detail, notes, or other pipeline history.
   The spec said profiles become "available," not that full resume data
   crosses the tenant boundary; this is the more conservative reading and
   is easy to widen later, hard to narrow after the fact.
4. **Eligibility is exact-match, not fuzzy/weighted** — an applicant is
   "eligible" only if every screening-question answer matches its expected
   answer (case/whitespace-insensitive). This is a blunt first-pass filter
   by design ("first eliminations"), not a scoring system.

## Organization slugs

Every Org tenant gets a `slug` (URL-safe, generated from the org name at
creation) used as its job board's public identifier —
`{base_url}/jobs/{slug}` — rather than a UUID, so the link is
presentable and memorable.

- Generation: lowercase, spaces/punctuation → hyphens (`"Acme Staffing"`
  → `acme-staffing`).
- **Collision handling**: if the generated slug is already taken, append
  6 random lowercase alphanumeric characters (`acme-staffing-x7k2p9`)
  rather than a numeric counter — avoids leaking "which org signed up
  first" and never needs a retry loop past one collision in practice.
- The Freelance Org does **not** get a generated slug — its board is the
  fixed route `{base_url}/jobs` (no slug segment). This route is also,
  deliberately, **not scoped to the Freelance Org's own postings** — see
  [All Jobs vs. an org's own board](#all-jobs-vs-an-orgs-own-board) below.
- Slugs are immutable once assigned in this pass — renaming an org and
  keeping old links alive (redirects) is a P1 concern, not built now.

**Frontend routes:** the public-facing pages live at
`{base_url}/jobs/{slug}` (one org's board) and `{base_url}/jobs` (the
all-jobs board). This doesn't collide with the authenticated recruiter's
own Jobs list, which lives under the `/app/*` prefix
(`{base_url}/app/jobs`) — the whole authenticated product was moved under
`/app/*` specifically so the root/public namespace was free for the
marketing site and job board, see [00-overview.md](00-overview.md). The
application/detail page itself is `{base_url}/apply/{job_slug}`
(`jobs.slug`, not the internal UUID) — this is also what "Copy
application link" copies, not the raw API URL. Backend API paths use the
job's `slug` for every public-facing lookup (`/public/boards/{slug}`,
`/public/jobs/{slug}`, `/public/jobs/{slug}/apply`) — never the internal
UUID, so the public URL never exposes it. Authenticated endpoints
(`/jobs/{job_id}`, etc.) are unaffected and still use the UUID.

## All Jobs vs. an org's own board

Two distinct public listing surfaces, easy to conflate:

- **`{base_url}/jobs`** ("All Jobs") — every open, public-visibility job
  **across every tenant** — every Org's postings and the Freelance Org's
  postings together, newest first. This is the board linked from the
  Landing page and the default destination for someone with no specific
  org link.
- **`{base_url}/jobs/{slug}`** (an Org's own board) — scoped to just that
  one org's postings, as before. The Freelance Org has no equivalent
  single-org board of its own; its jobs only ever appear inside the
  all-jobs listing (since there's exactly one Freelance Org tenant,
  filtering to "just its own board" and "all jobs" would otherwise be
  redundant for it specifically).
- Each job in the all-jobs listing carries its posting org's name and
  logo (`org_name`, `org_logo_url` — null for a Freelance Org posting),
  so the mixed list is still attributable at a glance. An org-scoped
  board already knows its one org from the top-level response and leaves
  these null per-job.
- **Org name/logo is a real link back to that org's own board.**
  `PublicJobSummary` also carries `board_path` (the same value
  `PublicJobDetail.board_path` already had, see
  [Applying to a job](#applying-to-a-job) below), always populated
  regardless of which board it's on: `/jobs` for a Freelance Org posting,
  `/jobs/{slug}` for an Org tenant's. Clicking a job card's org name/logo
  on the all-jobs board (`CareersBoard.tsx`) or the org header on the
  apply page (`ApplyPage.tsx`) now navigates there. `board_path` existed
  on the schema before this pass but neither surface actually rendered it
  as a link — this closes that gap.

## Job board pages (public, no auth)

- `GET /public/boards/{slug}` (an Org's own board) and `GET
  /public/boards/all` (the all-jobs board): list `open`-status,
  `public`-visibility jobs. Each listing entry (`PublicJobSummary`) is
  deliberately minimal — `id`, `slug`, `title`, `overview`,
  `applicant_count`, `work_mode`, `location`, `seniority`, `job_type`,
  `salary_min`/`salary_max`/`salary_currency`, and (all-jobs board only)
  `org_name`/`org_logo_url` — no `description` and no JD file; those only
  appear on the single-job detail endpoint below. No candidate, pipeline,
  or recruiter-identity data is ever on this surface.
- **Salary display.** Each card shows a formatted salary line (via
  `formatSalary()`, shared with the internal Jobs table/Job Detail header
  — see [02-data-model.md](02-data-model.md#jobs)) whenever the job has a
  `salary_min` or `salary_max` set — omitted entirely when neither is set
  ("not disclosed") **or** when `jobs.salary_confidential = true`. That
  gate is enforced server-side (`public_board.py`'s `_public_salary`
  helper strips all three salary fields before the response is built) —
  a confidential salary is never present in the API payload a public
  visitor's browser receives, not just hidden by the frontend. There is
  no salary filter/sort on the public board today, only display.
- An org-scoped board's response (`PublicBoardResponse`) also carries
  that org's public profile — `org_name`, `org_logo_url`,
  `org_description`, `org_office_location`, `org_contact_email` — set by
  the org_admin (see [Org profile](#org-profile-org_admin-editable)
  below). The all-jobs board's response has `org_name = "All Jobs"` and
  leaves the org-profile fields null (it isn't one org).
- Each job has an **Apply** button opening the application flow below.
- Each job card/detail shows an **applicant counter** — *"{N} people
  applied"* — a `COUNT(job_applications)` for that job, public and
  visible without applying. This is social proof for the candidate side,
  not a recruiter metric; it counts every application regardless of
  eligibility (an applicant who didn't pass screening still applied).
  Cheap to compute on read (no caching needed at this scale) — recompute
  per page view rather than maintaining a denormalized counter column,
  since correctness (an accurate count) matters more here than shaving a
  query on a low-traffic public page.
- A board for an unknown slug is a plain 404, not an error — indistinguishable
  from a slug that was never issued (doesn't leak which slugs are valid).

## Board filters

Client-side filters on top of a board's already-fetched job list
(consistent with the search box below — no server round-trip per
filter change). Layout: the search box is a full-width bar at the top of
the bounded panel; the filter controls sit in a left rail below it,
beside the job list.

- **Search** is a full-width bar spanning the panel — plain substring
  matching against title + overview + org name (simpler than, and
  intentionally not the same control as, the point-and-click filter model
  used on the authenticated Jobs/Candidates lists — see
  [03-pipelines-and-boards.md](03-pipelines-and-boards.md#search)).
- **Work mode** — multi-select checkboxes (Remote / On-site / Hybrid),
  in the left rail. Unset `work_mode` (not specified) never matches an
  active filter.
- **Seniority** and **Job type** — single-select dropdowns, left rail.
- **Organization** — single-select dropdown, left rail, **all-jobs board
  only** (an org-scoped board is already one organization, so this
  filter would be redundant there). Options are the distinct `org_name`
  values present in the currently-loaded job list.
- All filters combine with each other and with search (AND). A clear-
  filters button is always visible below the filter controls rather than
  only appearing once a filter is active — reads "No filters applied"
  (disabled) with none active, "Clear filters" (enabled) once any is —
  a stable layout beats a control that pops in/out.

## Org profile (org_admin-editable)

An org_admin manages their org's public-facing profile from
`/app/org/profile`: logo (either uploaded directly or pasted as an
already-hosted image URL; `components/ImageUploadField.tsx`, see
[06-ui-design-system.md](06-ui-design-system.md#image-upload-org-logo-user-avatar)
and [02-data-model.md](02-data-model.md)), description, office location,
and contact email. An uploaded logo is saved via `POST /uploads/image` to
local disk under `backend/storage/public/` and served back
unauthenticated from a `/media` static mount (`app/main.py`), unlike
candidate CVs, which stay behind the authenticated `/candidates/{id}/cv`
endpoint, since a logo needs to render on the public job board for
anyone. These four fields are what render on that org's job board
(`GET /public/boards/{slug}`) above the job list — see
[Job board pages](#job-board-pages-public-no-auth) above. The same page
also has a **preferred currency** setting, but that's an internal-only
dashboard convenience (converting the placement-value/opportunity totals,
see [05-dashboards-metrics.md](05-dashboards-metrics.md)) — it never
appears on the public board. The Freelance
Org has no org_admin and no equivalent profile.

## Job visibility: Public vs. Unlisted

`jobs.visibility` — `public` (default) | `unlisted`:

- **Public**: appears on the org's board listing, exactly as described
  above.
- **Unlisted**: does **not** appear in the board listing, but the direct
  application page (`GET /public/jobs/{slug}`, same route either way)
  still works for anyone who has the link — applying, screening
  questions, and the applicant counter all behave identically to a
  public job. Unlisted is "not discoverable," not "not accessible."
- Still requires `status = open` to accept applications either way —
  visibility and status are independent: an unlisted job can be open or
  closed, same as a public one.
- **Copy link**: every job (public or unlisted) has a "Copy application
  link" action — on the Jobs list row's ⋮ menu and on the Job Detail
  page — that copies `{base_url}/apply/{job.slug}` to the clipboard.
  This is *the* distribution mechanism for unlisted jobs (send the link
  directly to candidates/a specific channel) and a convenience for public
  ones (share the direct link instead of pointing someone at the whole
  board).

## Applying to a job

The apply page (`GET /public/jobs/{slug}`, `PublicJobDetail`) header shows,
above the form: the posting org's name/logo (if an Org tenant),
`work_mode`/`location` (if set), `seniority`/`job_type` (if set), a
formatted salary line (same `salary_min`/`salary_max`/`salary_currency`/
`salary_confidential` gating as the board cards above), a "Posted by
{recruiter name}" line with a relative timestamp ("3 days ago" — computed
client-side from `created_at`, not stored pre-formatted), and the job's
full `description` (not just `overview` — a candidate filling out a
10-field form should be able to read the actual job description first).
`board_path` on the same response is what "Browse other jobs" on the
post-submit confirmation screen links back to — `/jobs` if this job came
from the all-jobs board or the Freelance Org, `/jobs/{slug}` (the org's
slug) if it's an Org tenant's posting.

**Every hit to this endpoint also records a unique-visitor view.**
`_record_job_view()` inserts a `job_views` row keyed by the job and a
salted hash of the requester's IP (`sha256(ip + jwt_secret)`, never the
raw IP; the hash uses the JWT secret purely as a convenient existing
pepper, not because it's meant to be cryptographically special-purpose
here), with `ON CONFLICT DO NOTHING` against a unique `(job_id,
visitor_hash)` constraint so a repeat visit from the same person doesn't
inflate the count. This backs a recruiter-facing "Views" column on the
internal Jobs table (`Job.unique_visitor_count`, a computed
`column_property`), distinct from the public-facing `applicant_count`
above. See [02-data-model.md](02-data-model.md#job_views) and
[05-dashboards-metrics.md](05-dashboards-metrics.md#unique-visitor-tracking-jobs-list-not-a-dashboard-chart).

**Description is WYSIWYG-authored HTML, not plain text.** A recruiter
writes `jobs.description` via a constrained Tiptap-based rich text editor
(`RichTextEditor.tsx`, wired into `NewJobDialog.tsx`/`EditJobDialog.tsx`)
supporting only bold, italic, an h3 heading, and bullet/numbered lists —
no arbitrary formatting, images, or links. The stored HTML is rendered on
both this apply page and `CareersBoard`'s job-detail view via a shared
`RichText.tsx` component that runs it through `DOMPurify.sanitize()`
before `dangerouslySetInnerHTML`. This sanitization step is load-bearing,
not defensive boilerplate: the editor itself can't produce a `<script>`
tag, but a raw API call bypassing the editor (`PATCH /jobs/{id}` with a
hand-crafted `description`) could, and this HTML is shown to
unauthenticated public visitors — so rendering never trusts the stored
value without sanitizing it first, regardless of what wrote it.

**Public application form** (per job):

1. Name, email, phone (candidate-supplied — there is no candidate login
   in this product; every applicant is unauthenticated).
2. **CV upload** — required, one file, reusing the exact same parser and
   PDF/DOCX constraints as recruiter-side upload
   ([04-cv-parser.md](04-cv-parser.md)). No preview-before-commit step
   here (unlike the recruiter flow) — a candidate applying to a job
   expects one clear submit action, not a review queue.
3. **Cover letter** — optional free text.
4. **Default profile questions** — always present, on every job,
   regardless of custom screening questions, separate from the Cover
   Letter field above:
   - **Years of experience** — required, self-reported; overwrites
     `candidates.total_years_experience` (self-reported is more
     trustworthy than the regex/heuristic CV-parse guess it might
     otherwise be defaulting to — see
     [04-cv-parser.md](04-cv-parser.md)).
   - **LinkedIn URL** — required; populates `candidates.linkedin_url`
     (new column — profile URLs weren't captured anywhere on the
     candidate before this).
   - **GitHub URL** — optional; populates `candidates.github_url` (new
     column). Only shown when the job is flagged `is_technical_role`
     (new boolean on `jobs`, set by the recruiter at job creation — a
     plain checkbox, not a full job-category taxonomy, since that's the
     only thing this needs to gate).
   - **Portfolio URL** — optional; populates `candidates.portfolio_url`
     (new column). Always shown, technical or not — a portfolio is
     relevant to design/writing/other non-engineering roles too, unlike
     GitHub.

   These are **not** elimination questions — they don't have a recruiter-
   set "expected answer" and don't factor into the eligible/not-eligible
   computation below. They're profile-building fields the application
   form always asks, distinct from the custom pass/fail questions in
   [Screening questions](#screening-questions). Answers are still stored
   in the application's `answers` record for a complete submission
   history, in addition to being written onto the candidate.
5. **Screening questions** — the recruiter's custom, job-specific
   elimination questions (0 up to the role-based cap — see
   [Screening questions](#screening-questions)), answered inline. Skipped
   if the job has none.
6. **"I'm open for other roles with other companies"** checkbox —
   controls `candidates.open_to_other_roles` (see
   [Open profiles](#open-profiles-a-narrow-deliberate-rls-exception)
   below). Unchecked by default — opt-in, not opt-out.

**On submit:**

- Runs the same dedup-fingerprint check as recruiter CV upload — a
  candidate re-applying (same email/phone) updates their existing
  candidate record rather than creating a duplicate.
- Creates a `job_applications` row (cover letter, per-question answers,
  computed eligibility).
- **Eligible** (all answers match, or the job has no questions):
  automatically creates a `pipeline_placements` row in the job's first
  stage (`Sourced`) — they enter the pipeline immediately, no recruiter
  action needed.
- **Not eligible**: no placement is created yet. The application is
  visible to the recruiter as "Not eligible" — see below.
- Confirmation is a plain "Application received" page — no promise of
  outcome, no reference number needed since candidates have no account
  to look one up from.

## Recruiter review: eligible / not-eligible applicants

On a job's detail page, applications split into two views:

- **Eligible** — already placed in the pipeline; shown like any other
  candidate on the board (this is exactly the existing Kanban/Table view
  from [03-pipelines-and-boards.md](03-pipelines-and-boards.md), no new
  UI — an eligible applicant *is* a placement).
- **Not eligible** — a real `DataGrid` (sortable, paginated — changed
  2026-08-27 from a hand-rolled card list + a separate `usePagination`
  hook, `JobApplicationsPanel.tsx`'s `NotEligibleApplicants`) showing the
  candidate, their answers next to the expected answers (so the recruiter
  can see exactly what didn't match), and a single row action: **"Move to
  eligible"** — this creates the pipeline placement at that point, same
  as if they'd been eligible from the start. There's no reject action
  needed here specifically; a recruiter uninterested in a non-eligible
  applicant just leaves them alone (they were never in the pipeline to
  reject from). Clicking a row (other than the action button) opens
  Candidate Quick View, same as everywhere else on the job's page — see
  [03-pipelines-and-boards.md](03-pipelines-and-boards.md#table-vs-kanban).
  Its accordion header carries a red count `Badge` (added 2026-08-27,
  same pattern as the Withdrawn/Rejected section's — see
  [03-pipelines-and-boards.md](03-pipelines-and-boards.md#the-multi-pipeline-candidate)),
  so a recruiter can see there's a backlog of not-yet-reviewed applicants
  without expanding the accordion. `JobApplicationsPanel`'s parent
  component queries the same `useApplications(jobId, false)` react-query
  key `NotEligibleApplicants` uses internally, purely to surface the
  count for the badge — same cache entry, no extra request.

## Screening questions

Configured per job, at creation or later editing — each a `question_text`
+ `expected_answer`, both recruiter-authored (no question bank/library in
this pass). Three types: `text` (exact-match), `number` (minimum
threshold, e.g. years of experience), and `boolean` (Yes/No, added
2026-08-27) — see [`job_screening_questions`](#job_screening_questions)
below for the full column-level detail and eligibility rules.

- **Freelance recruiters: capped at 4 questions per job.**
- **Org recruiters/Org Admins: no cap.** The API enforces this
  server-side (not just a UI limit) based on the creating user's role,
  checked against the count already on the job.
- Reordering is position-indexed. For a freelancer's max-4-question job a
  simple up/down control is enough; an Org job with many questions
  benefits from the same drag-and-drop-plus-⋮-menu pattern used for
  pipeline stages ([06-ui-design-system.md](06-ui-design-system.md)) —
  reuse, not a new interaction to design. **Target design, still
  unbuilt**: the existing questions list is a real `DataGrid` (changed
  2026-08-27 from a flat `Stack`, `JobApplicationsPanel.tsx`'s
  `ScreeningQuestionsEditor`) with sortable columns and pagination for
  jobs with many questions, but that's a client-side *view* sort, not a
  persisted-position drag reorder — there's still no way to change a
  question's stored `position` (and therefore its order on the actual
  apply form) short of deleting and re-adding it.

## Open profiles: a narrow, deliberate RLS exception

This is the one place in the product where data deliberately crosses the
tenant boundary that every other doc in this spec treats as absolute —
worth being explicit about exactly how narrow it is.

- `candidates.open_to_other_roles` (bool, default false) is the only
  gate. It's set once, at application time, by the candidate — never by
  a recruiter on their behalf.
- **The RLS policy on `candidates`** changes from tenant-only to
  tenant-only **OR** `open_to_other_roles`:

  ```sql
  USING (
    current_setting('app.role', true) IS DISTINCT FROM 'superadmin'
    AND (
      tenant_id = current_setting('app.tenant_id', true)::uuid
      OR open_to_other_roles = true
    )
  )
  ```

  Superadmin is still fully excluded either way — that guarantee is
  untouched.

- **Extended 2026-08-28 to `candidate_documents`, `documents`, and
  `notes`** (migration `0031`) — each joins back to `candidates` and
  applies the same `open_to_other_roles` exception, so Candidate Quick
  View's CV and Notes tabs actually work for a candidate opened from
  Open Profiles who belongs to a *different* org. This was a deliberate
  product decision, not a default: earlier design (and this doc, before
  2026-08-28) explicitly kept CV/notes tenant-isolated even for open
  profiles. The tradeoff was surfaced and chosen explicitly — see
  "Consequence" below for what it actually means in practice.
  **Deliberately NOT extended to `jobs`/`job_stages`/`pipeline_placements`**
  — a placement's job title and stage is the *hiring org's* confidential
  data, something the candidate never consented to share and the hiring
  org never agreed to expose. Quick View's "in pipeline for N jobs"
  chips stay empty for a candidate from another org — same graceful
  empty-result RLS behavior as everywhere else in this doc, not a
  special case in application code.
- **Consequence recruiters should understand — updated 2026-08-28**:
  every endpoint that reads `candidates`/`candidate_documents`/
  `documents`/`notes` without also adding an explicit `tenant_id = mine`
  filter in application code will now surface opted-in candidates from
  *other* tenants too, **including their CV and note thread**. Concretely:
  if Org A writes a team-visible note about a shared open-profile
  candidate, Org B can now read it too (and vice versa) — `notes`'
  RLS exception isn't scoped to "the viewer and the candidate's home
  org," it's the same platform-wide grant as everything else gated by
  `open_to_other_roles`. A **private** note (`visibility = "private"`)
  stays restricted to its own author regardless, via the existing
  app-level visibility filter in `notes.py` (untouched, an
  author-identity check, not a tenant check). The candidate list/detail
  endpoints keep their explicit tenant filter for *ordinary* candidates
  (so a recruiter's own Candidates page is unaffected — this all only
  applies once `open_to_other_roles = true`); `GET /candidates/{id}` and
  `GET /candidates/{id}/cv` were updated 2026-08-28 to accept
  same-tenant **OR** open-to-other-roles, matching the RLS policy instead
  of being needlessly stricter than it.
- **Open Profiles page** (all recruiter roles): lists every candidate,
  platform-wide, with `open_to_other_roles = true` — name, current
  position, years of experience, **location** (added 2026-08-27) — a
  real `DataGrid` (changed 2026-08-28 from a hand-rolled card list,
  matching the same conversion the Withdrawn/Rejected and Not-eligible
  sections got — see [03-pipelines-and-boards.md](03-pipelines-and-boards.md)).
  Clicking a row (other than the "Attach to job" action button) opens
  the same Candidate Quick View drawer used everywhere else, with full
  CV/Notes tabs per the RLS extension above — this is a genuine change
  from earlier: before 2026-08-28 this page couldn't have offered Quick
  View at all for a cross-tenant candidate, it would have 404'd. A
  recruiter can also **attach one to any of their own jobs' pipelines**
  directly from this list, same mechanism as
  [Attach Candidate](03-pipelines-and-boards.md) — this is the one
  candidate-attach path allowed to succeed across tenants; every other
  attach path still requires the candidate to already belong to the
  attaching recruiter's own tenant. `AttachToJobDialog` — the same shared
  component used by the Candidates list and Candidate Detail, see
  [03-pipelines-and-boards.md](03-pipelines-and-boards.md) — is used here
  too as of 2026-08-28 (previously this page, and Find Candidates below,
  each had their own bare local attach dialog with none of this; flagged
  as drift and fixed the same day it was found). It takes a
  `useOpenProfileAttach` prop so it calls the cross-tenant attach
  endpoint (`POST /jobs/{id}/placements/from-open-profile/{candidate_id}`)
  instead of the ordinary same-tenant one — Open Profiles always passes
  it (every row here is open-profile by definition), Find Candidates
  passes it only for that row's `scope === "public"` results. It also
  lists the candidate's existing same-tenant pipelines before attaching —
  for a cross-tenant open-profile candidate this naturally shows nothing,
  same reasoning as the placements RLS boundary above.
- **Privacy note, not resolved here**: the checkbox's consent language
  should be explicit about what "available to all recruiters" means in
  practice — as of 2026-08-28 that's name + position + experience +
  location + **CV + notes**, platform-wide, indefinitely until the
  candidate is placed or asks to be removed. This is a materially bigger
  disclosure than the original "name + position + experience only"
  design, and was chosen explicitly (see above) — worth revisiting the
  actual consent UI copy before this ships broadly, flagged here rather
  than silently assumed away. There's still no self-service way for a
  candidate to revoke this later — no candidate login exists in this
  product.

## Data model additions

`jobs.visibility`, `is_technical_role`, `slug`, `work_mode`, `location`,
`seniority`, `job_type`, `headcount`, and `tenants.slug` /
`logo_url`/`description`/`office_location`/`contact_email` are all
documented in [02-data-model.md](02-data-model.md) rather than duplicated
here.

### `job_screening_questions`
Redesigned 2026-08-27: not every question should gate eligibility (a
free-text "why do you want this role?" question has no right answer),
and not every gating question is an exact-text match ("years of React
experience" needs a numeric minimum, not string equality).

| column | type | notes |
|---|---|---|
| id | uuid PK | |
| job_id | uuid FK → jobs | |
| tenant_id | uuid FK | denormalized, direct RLS filtering — same pattern as `job_stages` |
| question_text | text | |
| question_type | enum(`text`, `number`, `boolean`) default `text` | drives both the apply-form input type and which comparison eligibility uses. `boolean` added 2026-08-27 (`ALTER TYPE ... ADD VALUE`, migration `0029`). |
| expected_answer | text, nullable | only meaningful (and only required) for a `required=true`, `question_type="text"` or `question_type="boolean"` question — for `boolean` it's canonicalized server-side to the literal string `"yes"` or `"no"` |
| min_value | int, nullable | only meaningful (and only required) for a `required=true`, `question_type="number"` question — e.g. "at least 3 years" |
| required | bool default `true` | `false` = collected but never affects `job_applications.eligible` — purely informational. Default `true` preserves every pre-2026-08-27 question's existing behavior (back then, every question implicitly gated eligibility). |
| position | int | display/answer order; capped at 4 rows total (0–3) per job for freelance recruiters, unbounded for Org |

`ScreeningQuestionCreate` validates the combination server-side: a
required `text` question needs `expected_answer`; a required `number`
question needs `min_value`; a required `boolean` question needs
`expected_answer` to normalize to `"yes"`/`"no"` (accepts mixed case,
canonicalizes in the validator itself); a non-required question needs
none of them. The public-facing schema (`PublicScreeningQuestionOut`)
exposes `question_type`/`required` (so the apply form renders the right
input — a Yes/No select for `boolean` — and a required-indicator) but
never `expected_answer`/`min_value` — the actual pass criteria never
ships to the candidate.

### `job_applications`
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| tenant_id | uuid FK | |
| job_id | uuid FK | |
| candidate_id | uuid FK | |
| cover_letter | text, nullable | |
| answers | jsonb | `[{question_id, question_text, question_type, required, answer, expected_answer, min_value, matched}]` — a full snapshot of the question as it was at submit time, same immutability rationale as `stage_history`'s label snapshot |
| eligible | bool | computed at submit time (see below); flippable by a recruiter afterward |
| placement_id | uuid FK → pipeline_placements, nullable | set once eligible (immediately, or when a recruiter flips it) |
| created_at | timestamptz | |

**Eligibility logic** (`public_board.py`'s `apply_to_job`), per question:
- `required=false` → always `matched=true`, no effect on `eligible`.
- `required=true`, `question_type="text"` → exact match against
  `expected_answer`, case-insensitive, trimmed (unchanged from before
  2026-08-27).
- `required=true`, `question_type="number"` → the candidate's answer,
  parsed as a number, must be `>= min_value`; a non-numeric answer fails
  (counts as not matched, same as a wrong text answer).
- `required=true`, `question_type="boolean"` → the candidate's answer is
  normalized via `_normalize_boolean_answer()` (accepts `yes`/`y`/
  `true`/`1` as true, `no`/`n`/`false`/`0` as false, case-insensitive;
  anything else counts as not matched) and compared against
  `expected_answer == "yes"`.
- The application is `eligible` only if every question matched.

### `candidates.open_to_other_roles` / profile URL columns
| column | type | notes |
|---|---|---|
| open_to_other_roles | bool default false | the sole gate for the RLS exception above |
| linkedin_url | text, nullable | from the default profile question, required on application |
| github_url | text, nullable | from the default profile question, optional, technical roles only |
| portfolio_url | text, nullable | from the default profile question, optional, all roles |

## API endpoints

**Public (no auth):**
- `GET /public/boards/{slug}` — one org's board; `GET /public/boards/all` — the all-jobs board (every tenant). Each job in the list includes `applicant_count`, `work_mode`, `location`, `seniority`, `job_type`, and (all-jobs board only) `org_name`/`org_logo_url`.
- `GET /public/jobs/{slug}` — single job detail (looked up by the job's slug, not its UUID) + its screening questions (for rendering the apply form) + `applicant_count`, `posted_by_name`, `org_name`/`org_logo_url`, `created_at`, `board_path`.
- `POST /public/jobs/{slug}/apply` — multipart (CV file + form fields + answers). Creates the candidate/application, computes eligibility, creates the placement if eligible.

**Authenticated (recruiter/org_admin):**
- `GET /jobs/{job_id}/applications?eligible=true|false` — review list.
- `POST /jobs/{job_id}/applications/{id}/mark-eligible` — creates the placement, matching the "not eligible → eligible" promotion.
- `GET/POST /jobs/{job_id}/screening-questions` — manage a job's custom questions; server-side enforces the 4-question cap for freelance recruiters, no cap for Org.
- `GET /candidates/open-profiles` — the cross-tenant list described above.
- `POST /jobs/{job_id}/placements/from-open-profile/{candidate_id}` — reuses the existing attach endpoint's logic but permits a candidate outside the caller's own tenant when `open_to_other_roles = true`.

## Marketing and informational pages

Four more unauthenticated routes round out the public surface, all sharing `PublicNav`/`PublicFooter` (frontend/src/pages/public/):

- **`/` (Landing)** — dual-audience: a recruiter-facing hero and feature grid ("For recruiters and agencies"), plus a dedicated "For candidates" section explaining that applying and opting in to `open_to_other_roles` makes a candidate's profile visible to every recruiter on the platform, not just the org they applied to. Both sections explicitly state that applying needs no account, and that "Sign in"/"Register" are for recruiters only (there is no candidate account at all — see [Open profiles](#open-to-other-roles-cross-tenant-visibility) above).
- **`/about`** — mission framing plus a three-step "how it works" graphic (apply/post, move through a pipeline, hire) and a values section (fast, collaborative, trustworthy) tying back to the platform's actual mechanics (per-job customizable pipelines, the cross-tenant open-profile pool, row-level-security-enforced confidentiality) rather than generic marketing copy.
- **`/faq`** — accordion-style, grouped into "For job seekers," "For recruiters and agencies," and "Platform and privacy." Answers are written to match what the product actually does today (no account needed to apply, what open-profile visibility does and does not share, how the cross-tenant blacklist works, what powers CV parsing) rather than aspirational copy.
- **`/pricing`** (added 2026-08-26) — three tiers (Freelance Recruiter, Organization, Custom) plus a feature-comparison table. See [00-overview.md](00-overview.md).

The first three use small inline-SVG, framer-motion-animated vector graphics (`CandidateNetworkGraphic.tsx`, `AboutJourneyGraphic.tsx`, `FaqOrbitGraphic.tsx`) drawing from a shared multi-color palette (`vectorPalette.ts`) rather than a single repeated accent tone, so they read as vibrant rather than monotone against the navy background.

**Logo**: the app mark (`components/Logo.tsx`, plus `public/icon-mark.svg` for the browser-tab favicon) is two overlapping forward-pointing chevrons in the two brand colors (navy and ember), reading as both "fast" (a fast-forward mark) and "collaborative" (two colors moving together). It replaced an earlier stock people-icon PNG that was dark red and did not match the rest of the brand palette. **Fixed 2026-08-26:** the favicon's PNG fallbacks (`favicon-*.png`, `apple-touch-icon.png`, `icon-mark.png`/`icon-mark-512.png`) were still showing the old red people-icon mark — regenerated all of them (Pillow-rendered from the same navy/ember chevron geometry as the SVG) — see the SEO & GEO section below for why this mattered beyond just the browser tab.

**404 page** (added 2026-08-27) — `pages/public/NotFound.tsx`, a catch-all `<Route path="*">` (must stay last in `App.tsx`'s route list). Same public page treatment (`PublicNav`/`PublicFooter`, glassy dark background) as the other marketing pages, with "Back to home" / "Browse jobs" CTAs. **Known limitation:** this is a client-side-only SPA with no server-side rendering (see the SEO & GEO section below) — nginx's `try_files $uri /index.html` fallback means an actual unmatched URL still gets served the app shell with an HTTP `200`, not a real `404` status; a crawler or `curl` checking the status code, not rendering the page, won't see the 404. Fixing that properly needs either SSR or nginx-level path validation, neither of which exists yet.

## SEO & GEO

"GEO" (Generative Engine Optimization) is the same underlying problem as SEO — making content crawlable and citable — extended to AI answer engines (ChatGPT, Claude, Perplexity, Google AI Overviews) rather than just traditional search indexes. What's actually built:

- **Per-page meta tags, client-side only.** `hooks/useDocumentMeta.ts` sets `document.title` and `<meta name="description">` per page. This helps the browser tab and any crawler that executes JS, but explicitly **does not** help a crawler that doesn't (most don't) — see the next two bullets for what does.
- **`robots.txt`** (`frontend/public/robots.txt`) — allows everything except the authenticated app (`/app/`, `/login`, `/register`), references the sitemap. Simple and permissive by design.
- **`sitemap.xml`** — generated on request, not a static file (`GET /sitemap.xml`, `public_board.py`'s `sitemap()`), since job listings are DB-driven and change constantly. Lists `/`, `/jobs`, `/pricing`, `/about`, `/faq`, every org's own board (`/jobs/{org-slug}`), and every open job's apply page (`/apply/{slug}`).
- **Per-job Open Graph tags for social/AI sharing** — this app has no SSR, so a crawler hitting a real SPA route directly (e.g. `/apply/{slug}`) only ever sees an empty `<div id="root">`, never the job's actual title/salary/description. `public_board.py`'s `GET /public/jobs/{slug}/share` is a small, crawlable HTML page carrying the real OG/Twitter tags plus a JS+meta-refresh redirect to the real SPA page for human visitors. Nginx (`/etc/nginx/sites-available/fastrecruit`, not in this repo — see the deployment notes) detects known crawler user agents on `/apply/{slug}` requests and transparently proxies them to this endpoint instead of serving the static SPA shell; everyone else gets the normal `try_files` SPA fallback. **Gotcha hit and fixed while building this:** nginx's regex-location capture (`$1`) does not reliably survive into a nested `if` block — the crawler-detection `if` was silently proxying to `/public/jobs//share` (empty slug, 404) until the capture was assigned to a plain `set $job_slug $1;` variable first, outside the `if`.
- **Static OG fallback** — `frontend/index.html` carries hardcoded `og:title`/`og:description`/`og:image` pointing at a generated brand share card (`public/og-share.png`) for the landing page and any route the nginx crawler-detection above doesn't specifically handle.
- **Cloudflare is currently blocking the major AI crawlers at the edge — not something this repo controls.** Checking `https://fastrecruit.alvianzf.id/robots.txt` in production shows a large "Cloudflare Managed content" block, injected by Cloudflare itself (not present in this repo's `frontend/public/robots.txt`, which stays clean), that sets `Disallow: /` for `GPTBot`, `ClaudeBot`, `Google-Extended`, `Applebot-Extended`, `CCBot`, `Bytespider`, `meta-externalagent`, and `Amazonbot` — i.e., most of the crawlers GEO is actually about satisfying. This is Cloudflare's zone-level "AI Crawl Control" / Content Signals feature, configured in the Cloudflare dashboard for this domain, not in nginx or this codebase. **Fixing GEO access requires changing that Cloudflare dashboard setting** (Content Signals / AI bot management for the zone) — flagged 2026-08-27, not something fixable by editing this repo.
