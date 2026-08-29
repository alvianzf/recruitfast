# Dashboard Metrics by Role

Each role's dashboard is built from data that role is actually allowed to
see — the Superadmin dashboard in particular is deliberately built entirely
off metadata/counts, so confidentiality is architecturally impossible to
violate there, not just policy-discouraged.

Placement statuses referenced below (`active`, `rejected`, `withdrawn`) are
defined in [02-data-model.md](02-data-model.md#pipeline_placements) /
[03-pipelines-and-boards.md](03-pipelines-and-boards.md).

Every dashboard is graph-first, not a bare number grid — each metric below
names its chart type. See [Visualization approach](#visualization-approach)
for the shared library/styling decisions.

## Recruiter dashboard

**Implemented today:** three stat tiles (open jobs, total candidates,
active offers; `GET /metrics/recruiter`) plus one bar chart, "active
candidates per pipeline stage" (not a funnel, no rejected/withdrawn
split), a **placement value** section (multi-currency, see below), a
**conversion metrics section** (see below) covering time-to-hire and
per-stage conversion time, an **opportunity metrics** section (potential
unrealized vs. opportunity lost, see below), and a **pipeline breakdown**
table (see below). Everything else below (items 1, 2, 4, 6, 7, 8) is
target design, not yet built — only item 5 was already marked P1 in the
original spec; the rest reads as done but isn't.

**Conversion metrics** — shared by both the Recruiter and Org Admin
dashboards, computed by `_conversion_metrics()` in
`backend/app/api/routers/metrics.py` straight off the existing
`stage_history` table (append-only, covers every move ever made — see
[02-data-model.md](02-data-model.md#stage_history)), grouped per-placement
in Python rather than SQL since "duration between this move and the next
move for the same placement" isn't a simple aggregate:

- **Time to hire** (`time_to_hire_avg_days`/`_min_days`/`_max_days`) —
  three `StatTile`s: days from a placement's *first* `stage_history` entry
  to the one that *first* landed it in the terminal-success stage
  (`Signed`), counted only for placements that actually got there. `null`
  (rendered as "—") means no placement has reached `Signed` yet, not zero
  days.
- **Stage conversion** (`stage_conversion`, one `StageConversionPoint`
  per stage name) — a "Time to convert to next stage" bar chart + table:
  avg/min/max days spent *in* a given stage before the placement moved on
  to whatever came next, plus a move count. Attributed to the stage being
  left, not the one entered. This is a simpler cut than the original
  spec's per-job "Time-to-fill" (item 2) and rejected/withdrawn-split
  "Stage-conversion funnel" (item 3) below — it's tenant/team-wide
  (recruiter-scoped on this dashboard), not broken out per job or by
  outcome, and stages aren't returned in any particular sorted order
  (whatever order they were first encountered in the query).
- Both figures respect the same scope as the rest of the dashboard they
  render on: filtered to the calling recruiter's own jobs here, and to
  the optional team filter on the Org Admin dashboard below.

**Placement value**: `placement_value` (`PlacementValueMetrics`),
summing `pipeline_placements.offer_rate` across every placement that has
one set (captured via the `Signed`-stage offer-details prompt, see
[03-pipelines-and-boards.md](03-pipelines-and-boards.md)), shown on both
the Recruiter and Org Admin dashboards. **Rebuilt as multi-currency.**
Summing raw numbers regardless of `offer_rate_currency` (the original
version of this metric) was flagged as flatly wrong for a mixed-currency
org, not just an approximation, and has been replaced:

- `by_currency`: one `PlacementValueByCurrency` bucket (`currency` +
  `total`) per distinct currency actually in use, grouped server-side
  (`_placement_value_metrics()` in
  `backend/app/api/routers/metrics.py`). A placement with no
  `offer_rate_currency` set is bucketed under a fallback currency
  (`IDR`, since this app is IDR-first; `UNTAGGED_CURRENCY_FALLBACK` in
  `metrics.py`) rather than silently dropped from the total.
- `preferred_currency`: the calling org's `tenants.preferred_currency`
  (default `"IDR"`, editable at `/app/org/profile`, see
  [02-data-model.md](02-data-model.md)).
- `total_in_preferred_currency`: every non-preferred-currency bucket
  converted and summed into one figure, via a new
  `backend/app/services/forex.py` (uses the free, keyless
  [Frankfurter](https://www.frankfurter.app) API, European Central Bank
  reference rates, no API key/billing risk, refreshed daily upstream,
  with a 1-hour in-memory cache on top). **`null` when live conversion
  isn't available** (network error, unsupported currency) rather than
  showing a wrong or partial number: the frontend renders "Conversion
  unavailable" in that case instead of a total.
  - **Bug fixed while building this:** unlike `requests`, `httpx` does
    not follow redirects by default. The Frankfurter call needs
    `follow_redirects=True` or it silently returns nothing, easy to
    miss since the failure mode is "no data," not an obvious error. See
    [07-tech-stack.md](07-tech-stack.md).

Rendered by a shared `PlacementValueSection` component (`Dashboard.tsx`):
one figure per currency bucket, plus a highlighted total in the org's
preferred currency whenever more than one currency is in use (or the
single bucket present isn't already the preferred currency). The same
component and the same `PlacementValueMetrics` shape back the
opportunity metrics below.

1. **Open jobs assigned to me, aging-sorted** *(sortable table + a small
   horizontal bar per row showing days-open)* — where to focus today.
2. **Time-to-fill per active job** *(horizontal bar chart, one bar per job,
   with a target-line marker)* — pacing check against target.
3. **Stage-conversion funnel** *(funnel chart, per job or rolled up)* —
   where candidates drop off, split by `rejected` vs `withdrawn` (two
   colors stacked at each stage) so a sourcing problem isn't confused with
   candidates simply losing interest.
4. **Stale candidates** *(single stat tile with a small trend sparkline)*
   — prevents pipeline rot; drills into a filtered table on click.
5. **Interviews scheduled this week** (P1, once scheduling ships)
   *(calendar-style mini heatmap by day)* — daily awareness.
6. **Candidates sourced this week** *(line chart, last 8 weeks)* —
   sourcing velocity and trend, not just a snapshot.
7. **Offers extended vs. accepted** *(grouped bar chart, extended vs.
   accepted per week/month)* — closing effectiveness over time.
8. **Unprocessed CV Parser uploads** *(stat tile with queue-depth
   sparkline)* — inbox-zero for intake.

**Opportunity metrics**: `opportunity` (`OpportunityMetrics`, shared by
the Recruiter and Org Admin dashboards, computed by
`_opportunity_metrics()` in `metrics.py`): two `PlacementValueMetrics`
buckets (same per-currency + converted-total shape as placement value
above):

- `potential_unrealized`: advertised salary value (the midpoint of
  `salary_min`/`salary_max`, or just `salary_min` if no max is set, times
  `headcount`) summed across every `open`/`on_hold` job that has a
  salary set. What's still on the table.
- `opportunity_lost`: the same calculation, but for jobs marked `lost`.
  What was advertised but never captured.

Not adjusted for partial fills on multi-headcount jobs, and only counts
jobs that actually have a salary set (`salary_min` not null); a job with
no salary disclosed contributes nothing to either figure. Rendered as a
horizontal bar chart (MUI X Charts `BarChart`, `layout: "horizontal"`,
one bar per currency actually in use, one series each for potential
unrealized and opportunity lost) plus the per-currency figures via
`PlacementValueSection`.

**Pipeline breakdown**: `pipeline_breakdown` (`list[JobPipelineMetrics]`,
shared by the Recruiter and Org Admin dashboards, computed by
`_pipeline_breakdown()` in `metrics.py`): a full table, one row per job,
replacing the Org Admin dashboard's old `jobs_open_30_60_90` three-bucket
age-count display entirely (see "Job aging card: removed" under Org
Admin below). Each row shows candidate count, headcount, job age in
days, average/min/max days spent per stage (from `stage_history`, the
same append-only source the stage-conversion figures above read from),
and a conversion rate: the fraction of that job's placements that ever
reached the terminal-success (`Signed`) stage, `null` if the job has no
placements yet rather than 0%. Rendered by `PipelineBreakdownTable` in
`Dashboard.tsx`, paginated, newest-job-first, with a summary line noting
the job count and the single oldest job by age.

## Org Admin dashboard

**Implemented today:** jobs-by-status (item 2, but rendered as a full
pie, not a donut), recruiter workload (item 3, but a vertical bar, not
horizontal), a **placement value** section (see above, now
multi-currency), an **opportunity metrics** section, and a **pipeline
breakdown** table (both described under the Recruiter dashboard above,
shared by both dashboards), all team-filterable (see item 3's note),
plus the same conversion metrics section (time-to-hire, stage conversion)
described under the Recruiter dashboard above. Items 1, 6, 7, 8, 9 are
target design, not built; item 5 ("org-wide stage bottleneck") is partly
covered by the stage-conversion table (avg days per stage) but without
the sorted-worst-first ordering the original spec called for. Item 4
(">30/60/90-day age buckets") is no longer a dashboard card at all, see
"Job aging card: removed" below.

**Job aging card: removed.** An earlier version of this dashboard (see
the prior docs pass) rendered the >30/60/90-day age buckets (item 4) as a
single "Job aging" card: three counts (`jobs_open_30_60_90`, keyed
`"30-60"`/`"60-90"`/`"90+"`) with an explanatory caption. It's gone from
the UI now: three unlabeled counts read as three confusing zeros on a
healthy org with no aging jobs, and gave no per-job detail to act on. The
**Pipeline breakdown** table above supersedes it: every job's actual age
in days is one row in that table, alongside its stage-timing and
conversion figures, rather than a bucketed count. `GET /metrics/org`
still computes and returns `jobs_open_30_60_90` (`OrgMetrics`' shape is
unchanged server-side); nothing was removed from the API, only from the
dashboard UI, so a future consumer of that field isn't blocked by this
change.

1. **Org-wide avg time-to-fill, trended** *(line chart, monthly)* — health
   of the whole shop over time, not a single point-in-time number.
2. **Jobs by status breakdown** *(donut chart: open/on-hold/won/lost)*
   — portfolio view at a glance.
3. **Recruiter workload** *(horizontal bar chart, one bar per recruiter)* —
   load-balancing signal, feeds the reassignment flow in
   [01-roles-permissions.md](01-roles-permissions.md).
   **Implemented, extended beyond the original spec:** the Org Admin can
   group recruiters into Teams (`GET/POST /teams`,
   `PATCH /org/recruiters/{id}/team`) and every chart on this dashboard
   (jobs-by-status, workload, placement value, opportunity, pipeline
   breakdown, and the UI-removed but still server-computed age-bucket
   counts) takes an optional `team_id` filter. A dedicated **recruiter
   performance breakdown**
   (`GET /metrics/org/recruiters`) also ships: per-recruiter open jobs,
   active candidates, offers, and won/lost jobs, as both a grouped bar
   chart and a table, filterable by the same team dropdown.
4. **Jobs open >30/60/90 days** *(stacked bar by age bucket)* — at-risk
   flags, severity visible at a glance.
5. **Org-wide stage bottleneck** *(bar chart of avg time-in-stage, one bar
   per stage, sorted descending)* — process diagnosis, worst offender
   first.
6. **Offer acceptance rate** *(single stat tile + trend line beneath)* —
   signal on comp/positioning issues.
7. **Withdrawal rate vs. rejection rate, org-wide** *(stacked area chart
   over time)* — distinguishes "candidates aren't a fit" from "candidates
   are losing interest before we decide."
8. **Recruiter activity trend** *(multi-line chart, one line per
   recruiter, throughput not a ranked list)* — framed as coverage, not a
   leaderboard, to avoid micromanagement optics per the QA review. Not
   the same thing as the implemented recruiter-performance breakdown in
   item 3, which is a point-in-time snapshot, not a trend.
9. **New-recruiter ramp status** *(bar chart, placements in first
   30/60/90 days)* — onboarding health.

## Per-client metrics (Clients page, added 2026-08-26 — not the dashboard)

Org-only, not part of the Org Admin dashboard above — its own page
(`/app/clients`), since it's scoped per-client rather than org-wide.
`GET /clients/{id}/metrics` returns `job_count`, `open_job_count`,
`placement_count` (active placements only), and `revenue` — the same
`PlacementValueMetrics` shape as the dashboard's placement-value section
above (per-currency buckets + a converted total in the org's preferred
currency), just filtered to jobs with that `client_id` instead of the
whole org. Computed on read, nothing stored — same approach as every
other metric on this page. See
[02-data-model.md](02-data-model.md#clients-org-only-added-2026-08-26).

## Superadmin dashboard

Built entirely from tenant/user/billing metadata — no job, candidate,
pipeline, or note content is ever queryable from this role (enforced by
RLS, see [02-data-model.md](02-data-model.md#row-level-security-rls-model)).

**Implemented today:** four flat stat tiles only (`GET /metrics/platform`,
cached 60s — see [07-tech-stack.md](07-tech-stack.md#caching) — org
tenant count, freelance member count, total recruiters, freelance
approval queue depth), no charts/trends/sparklines anywhere on this
dashboard. Item 5 below is the only one with a real implemented number
(as a bare count, no sparkline); items 1–4 and 6–9 are all target design.
Item 5 will read as permanently (or near-permanently) 0 since freelance
self-registration no longer waits on approval (see
[01-roles-permissions.md](01-roles-permissions.md)) — an accurate
reflection of reality, not a bug, but worth knowing before treating a
flat 0 there as a stalled query.
Item 4 specifically is not just unbuilt but currently **architecturally
blocked**: the `jobs`/`candidates` RLS policy excludes the superadmin
role entirely (by design), so even a bare `COUNT(*)` needs a dedicated
aggregate mechanism (a `SECURITY DEFINER` function or materialized view)
that doesn't exist yet — see
[01-roles-permissions.md](01-roles-permissions.md) and
[08-open-questions-and-gaps.md](08-open-questions-and-gaps.md).

1. **Active tenants** *(stat tile + line chart trend, Orgs and Freelance
   Org members as separate series)* — platform size and growth.
2. **MRR/ARR and churn** *(line chart, MRR trended; churn as a secondary
   axis or paired bar)* — business health.
3. **DAU/WAU/MAU** *(multi-line chart, three series)* — engagement.
4. **Aggregate jobs/candidates created platform-wide** *(bar chart, weekly,
   counts only)* — usage trend, zero content exposure.
5. **Freelance approval queue depth** *(stat tile with sparkline)* — ops
   backlog.
6. **Tenant health/risk score** *(horizontal bar, tenants sorted by risk,
   color-coded by band)* — churn prediction.
7. **Open support tickets / Assisted Access requests pending** *(stat tile
   + breakdown donut by status)* — service load, and a natural place to
   surface how often the escalation path is actually used.
8. **CV Parser success/failure rate, platform-wide** *(stacked bar or line,
   success vs. failure/needs-review, trended)* — system reliability,
   aggregate only (no per-candidate detail).
9. **Storage/API usage per tenant** *(horizontal bar, top N tenants by
   usage)* — billing-tier accuracy.

## Unique visitor tracking (Jobs list, not a dashboard chart)

Not a dashboard metric, but adjacent enough to note here: every job now
tracks unique public page views. `GET /public/jobs/{slug}` (the public
apply page) records one `job_views` row per visitor, deduped by a salted
hash of the requester's IP (never the raw IP itself, see
[02-data-model.md](02-data-model.md#job_views)). `Job.unique_visitor_count`
is a SQLAlchemy `column_property`, a correlated subquery computed as
part of the normal `SELECT`, not tracked as a real column and not an
extra query per row, exposed on the internal `JobOut` schema and shown
as a **Views** column on the internal Jobs table
(`frontend/src/pages/Jobs.tsx`). This is recruiter-facing traffic
insight, distinct from the public-facing `applicant_count` shown on the
job board itself, which counts submitted applications, not page views.
See [10-job-board-and-applications.md](10-job-board-and-applications.md).

## Visualization approach

- **Charting library:** **MUI X Charts** — stays inside the same design
  system as the rest of the UI (Material Design 3 theming, light/dark mode,
  brand-token colors) instead of bringing in a second library (e.g.
  Recharts/D3) with its own theming layer to keep in sync.
- **Color usage:** the `#3D6B94` brand primary is reserved for the single
  most important series/emphasis in a chart (e.g. "this org" in a
  benchmark comparison), not applied as the default categorical palette —
  multi-series charts (funnels, stacked areas, multi-line) use a
  purpose-built categorical palette distinct from status colors
  (`rejected`/`withdrawn`/`active` each get a consistent, reused color
  across every chart they appear in, so a recruiter isn't re-learning the
  legend per screen).
- **Every chart is interactive, not decorative:** hover tooltips with
  exact values, and clicking a segment (a funnel stage, a bar) drills into
  the underlying filtered table — charts are an entry point into the data,
  not just a summary.
- **Cards housing charts are flat, bordered `Paper` surfaces** (the
  app-wide default — see
  [06-ui-design-system.md](06-ui-design-system.md#visual-language))
  rather than glass — dashboards are dense, data-first screens, and the
  signature glass treatment is reserved for the app shell's nav rail and
  public marketing pages, where it doesn't compete with chart legibility.
