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

## Org Admin dashboard

1. **Org-wide avg time-to-fill, trended** *(line chart, monthly)* — health
   of the whole shop over time, not a single point-in-time number.
2. **Jobs by status breakdown** *(donut chart: open/on-hold/filled/cancelled)*
   — portfolio view at a glance.
3. **Recruiter workload** *(horizontal bar chart, one bar per recruiter)* —
   load-balancing signal, feeds the reassignment flow in
   [01-roles-permissions.md](01-roles-permissions.md).
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
   leaderboard, to avoid micromanagement optics per the QA review.
9. **New-recruiter ramp status** *(bar chart, placements in first
   30/60/90 days)* — onboarding health.

## Superadmin dashboard

Built entirely from tenant/user/billing metadata — no job, candidate,
pipeline, or note content is ever queryable from this role (enforced by
RLS, see [02-data-model.md](02-data-model.md#row-level-security-rls-model)).

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

## Visualization approach

- **Charting library:** **MUI X Charts** — stays inside the same design
  system as the rest of the UI (Material Design 3 theming, light/dark mode,
  brand-token colors) instead of bringing in a second library (e.g.
  Recharts/D3) with its own theming layer to keep in sync.
- **Color usage:** the `#990000` brand primary is reserved for the single
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
- **Cards housing charts follow the glassmorphism treatment** from
  [06-ui-design-system.md](06-ui-design-system.md), with the chart itself
  on a near-solid inner surface so data legibility isn't compromised by
  blur/translucency.
