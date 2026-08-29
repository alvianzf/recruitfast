# 13 — Full Redesign (2026-08-26)

The design-audit pass in [12-design-audit.md](12-design-audit.md) was consistency
patches on the existing look, not a redesign — that was the wrong scope. This
was a full pass: independent PM, QA, and senior-designer reviews (each read
the codebase cold, no cross-briefing), synthesized into a real visual system
and a set of flow fixes, implemented directly. No browser automation was
available in this environment (the Chrome extension wasn't connected), so
this was done by reading and reasoning about the actual rendered output from
source — theme values, component structure, sx props — not by looking at
screenshots.

## Visual system (theme.ts)

- **Color**: primary blue kept (`#3D6B94`) but given a real ramp
  (50–900). New "Ember" secondary (`#D1653A`) as a genuine second accent —
  used on the candidate-facing apply CTA and one highlighted word in the
  Landing headline, not as a background color. A single `STATUS_COLORS`
  family (theme.ts) replaces three previously uncoordinated color maps
  (`Jobs.tsx`, `JobDetail.tsx`, `CandidateDetail.tsx` each had their own) —
  `won` is violet, not green, specifically so a closed-won job is never
  visually confused with an actively-hiring one. A new `StatusChip`
  component and `getStatusColor()`/`statusLabel()` helpers are the one
  place this is defined; Dashboard charts pull the same tokens.
- **Typography**: added Space Grotesk (display face, headlines/section
  leads) alongside Inter (workhorse body text) — a real h1–overline scale
  with actual weight/size steps, replacing a system that only distinguished
  400 vs. 700 weight.
- **Elevation**: glassmorphism demoted from "default on every Paper" (which
  required opting back out in 10+ places already) to a deliberate signature
  treatment on exactly two surfaces — the AppShell sidebar rail and (via the
  shared background) the public marketing pages. Everything else is a flat,
  bordered card. Border radius now varies by context (marketing 16–24px,
  product cards 12px, inputs 10px, chips 6px) instead of one flat 20px
  everywhere.
- **Density**: Jobs/Candidates/JobDetail DataGrids switched from
  `comfortable` to `compact` — the product claims to be a volume tool; the
  grid density didn't match that.

## Signature moments

- **Kanban board**: stage columns get a top accent bar that progresses from
  neutral ink through brand blue to "won" violet as stages near the end of
  the pipeline (reject always gets the "lost" brick red regardless of
  position) — the board now reads left-to-right as progress, not a row of
  identical boxes. Cards carry the same accent as a left border, gained a
  deterministic-color initials avatar, elevate + rotate while dragging
  instead of just fading, and pulse in on arrival at the terminal-success
  stage.
- **StatTile**: icon chip is now a radial gradient instead of a flat fill.
  A sparkline/trend-delta was in the original design direction but is
  **not implemented** — there's no historical time-series data backing it
  anywhere in the metrics API, and fabricating one would mean showing a
  fake trend. Flagged as a real backend gap if this is wanted later
  (would need a metrics-snapshot table), not silently faked.

## Flow fixes (from the PM review)

- Kanban cards are now clickable through to `CandidateQuickView` — previously
  reviewing a candidate mid-pipeline meant leaving JobDetail entirely.
- Dragging a card into the terminal-success stage now confirms *only* when
  it will actually close the job (computed from current headcount vs. active
  offer-stage placements) — previously this happened silently.
- `AttachCandidateDialog` shows the blacklist badge in the candidate picker
  and requires an explicit "Attach anyway" when the selection is flagged —
  previously a recruiter could attach a do-not-contact candidate with zero
  warning.
- `ApplyPage` now renders the job's full `description`, not just `overview`
  — candidates were filling out a 10+ field application without ever seeing
  the actual job description.
- Org admins on a brand-new org (zero jobs, zero recruiters) see a 3-step
  "get started" panel instead of five empty charts.
- `AdminOrganizations`' primary action moved into `PageHeader`, matching
  every other list screen, instead of living inside whichever tab happens
  to be selected.
- `CvUploadModal`'s "Needs review" chip now gates on actual parse status
  instead of showing on every successfully-parsed row (which trained
  recruiters to ignore it).

## Flow fixes (from the QA review)

- Added confirm dialogs before: deactivating a recruiter, deactivating any
  platform user, rejecting/withdrawing a Kanban candidate — all previously
  fired on a single click with no way back, inconsistent with equally- or
  less-destructive actions elsewhere that did confirm.
- Added error toasts to previously-silent mutations (org user status
  update, recruiter deactivate/reassign/team actions, candidate attach).
- `JobDetail`/`CandidateDetail` now distinguish "still loading" from
  "failed to load" (404/network error) — both previously spun forever on
  a real failure.
- `NewJobDialog` now confirms success with a toast, matching every other
  create dialog.
- `AppShell` sidebar was `display: none` below the `md` breakpoint with no
  replacement — the app was unusable on a phone. Added a mobile drawer nav
  behind a menu button, reusing the same nav-item list.

## Deferred (real backlog, not dismissed)

Cut here to keep this pass reviewable rather than open-ended:

- Job-scoped CV upload (upload directly into a job's pipeline from
  JobDetail, instead of Candidates → Jobs → Attach).
- Splitting `JobApplicationsPanel`'s screening-question config from its
  not-eligible-applicants triage queue, plus a visible pending-review count.
- A cross-job "needs attention" panel on the recruiter Dashboard (stalled
  candidates, pending eligibility reviews, unclaimed jobs).
- Admin/recruiter counts on the superadmin Organizations table.
- A "Pipeline status" column on the Candidates grid.
- Converting `AdminOrganizations`/`OrgRecruiters` tables to `DataGrid`
  (flagged in the first audit pass too — still a bigger lift than the rest
  of this sweep).
- `EditJobDialog`/`EditCandidateDialog` still use manual state instead of
  react-hook-form + zod, so invalid input fails silently rather than with
  inline validation text.
- A StatTile sparkline/trend — see above, blocked on missing historical
  data, not skipped for effort reasons.
