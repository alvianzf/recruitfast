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

- Generation: lowercase, spaces/punctuation → hyphens (`"Learn With
  Andi"` → `learn-with-andi`).
- **Collision handling**: if the generated slug is already taken, append
  6 random lowercase alphanumeric characters (`learn-with-andi-x7k2p9`)
  rather than a numeric counter — avoids leaking "which org signed up
  first" and never needs a retry loop past one collision in practice.
- The Freelance Org does **not** get a generated slug — its board is the
  fixed, single route `{base_url}/jobs/public`, since there's exactly one
  Freelance Org tenant platform-wide (docs/02) and every freelance
  recruiter's jobs share it.
- Slugs are immutable once assigned in this pass — renaming an org and
  keeping old links alive (redirects) is a P1 concern, not built now.

## Job board pages (public, no auth)

- `GET /jobs/{slug}` (Org board) and the fixed Freelance board: lists
  that tenant's `open`-status jobs — title, overview, description, JD
  file if attached. No candidate, pipeline, or recruiter-identity data is
  ever on this surface.
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

## Job visibility: Public vs. Unlisted

`jobs.visibility` — `public` (default) | `unlisted`:

- **Public**: appears on the org's board listing, exactly as described
  above.
- **Unlisted**: does **not** appear in the board listing, but the direct
  application page (`GET /public/jobs/{job_id}`, same route either way)
  still works for anyone who has the link — applying, screening
  questions, and the applicant counter all behave identically to a
  public job. Unlisted is "not discoverable," not "not accessible."
- Still requires `status = open` to accept applications either way —
  visibility and status are independent: an unlisted job can be open or
  closed, same as a public one.
- **Copy link**: every job (public or unlisted) has a "Copy application
  link" action — on the Jobs list row's ⋮ menu and on the Job Detail
  page — that copies `{base_url}/public/jobs/{job_id}` to the clipboard.
  This is *the* distribution mechanism for unlisted jobs (send the link
  directly to candidates/a specific channel) and a convenience for public
  ones (share the direct link instead of pointing someone at the whole
  board).

## Applying to a job

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
- **Not eligible** — a separate list showing the candidate, their
  answers next to the expected answers (so the recruiter can see exactly
  what didn't match), and a single action: **"Move to eligible"** — this
  creates the pipeline placement at that point, same as if they'd been
  eligible from the start. There's no reject action needed here
  specifically; a recruiter uninterested in a non-eligible applicant just
  leaves them alone (they were never in the pipeline to reject from).

## Screening questions

Configured per job, at creation or later editing — each a `question_text`
+ `expected_answer`, both recruiter-authored (no question bank/library in
this pass).

- **Freelance recruiters: capped at 4 questions per job.**
- **Org recruiters/Org Admins: no cap.** The API enforces this
  server-side (not just a UI limit) based on the creating user's role,
  checked against the count already on the job.
- Reordering is position-indexed. For a freelancer's max-4-question job a
  simple up/down control is enough; an Org job with many questions
  benefits from the same drag-and-drop-plus-⋮-menu pattern used for
  pipeline stages ([06-ui-design-system.md](06-ui-design-system.md)) —
  reuse, not a new interaction to design.

## Open profiles: a narrow, deliberate RLS exception

This is the one place in the product where data deliberately crosses the
tenant boundary that every other doc in this spec treats as absolute —
worth being explicit about exactly how narrow it is.

- `candidates.open_to_other_roles` (bool, default false) is the only
  gate. It's set once, at application time, by the candidate — never by
  a recruiter on their behalf.
- **The RLS policy on `candidates` specifically** (and *only* that
  table — jobs, notes, placements, documents, stage_history all keep
  their unmodified same-tenant-only policy from
  [02-data-model.md](02-data-model.md#row-level-security-rls-model))
  changes from tenant-only to tenant-only **OR** `open_to_other_roles`:

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

- **Consequence recruiters should understand**: every endpoint that reads
  `candidates` without also adding an explicit `tenant_id = mine` filter
  in application code will now surface opted-in candidates from *other*
  tenants too. The existing candidate list/detail endpoints keep their
  explicit tenant filter (so they're unaffected — a recruiter's own
  Candidates page still only shows their own tenant's candidates); the
  new **Open Profiles** page is the one place that deliberately queries
  without that filter, by design.
- **Open Profiles page** (new nav item, all recruiter roles): lists every
  candidate, platform-wide, with `open_to_other_roles = true` — name,
  current position, years of experience only (see assumption #3). A
  recruiter can **attach one to any of their own jobs' pipelines**
  directly from this list, same mechanism as
  [Attach Candidate](03-pipelines-and-boards.md) — this is the one
  candidate-attach path allowed to succeed across tenants; every other
  attach path still requires the candidate to already belong to the
  attaching recruiter's own tenant.
- What does **not** cross the boundary: the candidate's resume/parsed CV
  data (`candidate_documents`), notes, or their placement history at
  other orgs — all still fully tenant-isolated. A recruiter who attaches
  an open candidate to their own job sees only what that candidate
  supplies going forward (a fresh application/CV if the recruiter asks
  for one), not their history elsewhere.
- **Privacy note, not resolved here**: the checkbox's consent language
  should be explicit about what "available to all recruiters" means in
  practice (name + position + experience, platform-wide, indefinitely
  until the candidate is placed or asks to be removed). There's no
  self-service way for a candidate to revoke this later — no candidate
  login exists in this product. Worth a real decision before this ships
  broadly; flagged here rather than silently assumed away.

## Data model additions

### `jobs.visibility` / `jobs.is_technical_role`
| column | type | notes |
|---|---|---|
| visibility | enum(`public`, `unlisted`) default `public` | independent of `status` — an unlisted job can be open or closed |
| is_technical_role | bool default false | gates whether the GitHub URL default question is shown on the apply form |

### `tenants.slug`
| column | type | notes |
|---|---|---|
| slug | text, unique, nullable | null for the Freelance Org (fixed `/jobs/public` route instead) and for non-published orgs |

### `job_screening_questions`
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| job_id | uuid FK → jobs | |
| tenant_id | uuid FK | denormalized, direct RLS filtering — same pattern as `job_stages` |
| question_text | text | |
| expected_answer | text | |
| position | int | display/answer order; capped at 4 rows total (0–3) per job for freelance recruiters, unbounded for Org |

### `job_applications`
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| tenant_id | uuid FK | |
| job_id | uuid FK | |
| candidate_id | uuid FK | |
| cover_letter | text, nullable | |
| answers | jsonb | `[{question_id, question_text, answer, expected_answer, matched}]` |
| eligible | bool | computed at submit time; flippable by a recruiter afterward |
| placement_id | uuid FK → pipeline_placements, nullable | set once eligible (immediately, or when a recruiter flips it) |
| created_at | timestamptz | |

### `candidates.open_to_other_roles` / profile URL columns
| column | type | notes |
|---|---|---|
| open_to_other_roles | bool default false | the sole gate for the RLS exception above |
| linkedin_url | text, nullable | from the default profile question, required on application |
| github_url | text, nullable | from the default profile question, optional, technical roles only |
| portfolio_url | text, nullable | from the default profile question, optional, all roles |

## API endpoints

**Public (no auth):**
- `GET /public/boards/{slug}` — org board by slug; `GET /public/boards/freelance` — the fixed freelance board. Each job in the list includes `applicant_count`.
- `GET /public/jobs/{job_id}` — single job detail + its screening questions (for rendering the apply form) + `applicant_count`.
- `POST /public/jobs/{job_id}/apply` — multipart (CV file + form fields + answers). Creates the candidate/application, computes eligibility, creates the placement if eligible.

**Authenticated (recruiter/org_admin):**
- `GET /jobs/{job_id}/applications?eligible=true|false` — review list.
- `POST /jobs/{job_id}/applications/{id}/mark-eligible` — creates the placement, matching the "not eligible → eligible" promotion.
- `GET/POST /jobs/{job_id}/screening-questions` — manage a job's custom questions; server-side enforces the 4-question cap for freelance recruiters, no cap for Org.
- `GET /candidates/open-profiles` — the cross-tenant list described above.
- `POST /jobs/{job_id}/placements/from-open-profile/{candidate_id}` — reuses the existing attach endpoint's logic but permits a candidate outside the caller's own tenant when `open_to_other_roles = true`.
