# 12 — Design Audit (2026-08-25)

A senior-UI/UX-style pass over the frontend, done by reading source (theme,
components, pages) rather than live rendering — no browser automation was
available in this environment. Findings are concrete and code-referenced,
not aesthetic opinion. This doc records what was found and fixed; treat it
as an addendum to [06-ui-design-system.md](06-ui-design-system.md), which
it also corrects one stale detail in (brand color reference).

## Fixed

1. **Plain-text password fields.** `AdminOrganizations.tsx` (all three
   create dialogs) and `OrgRecruiters.tsx`'s `InviteDialog` rendered
   initial-password fields without `type="password"`, unlike every login/
   register field in the app. Fixed — all four now mask input.
2. **Native `alert()` in `OrgRecruiters.tsx`'s reassign flow.** Replaced
   with `useToast()`, matching every other mutation's feedback pattern.
3. **Silent mutations.** `OrgRecruiters.tsx` (invite, deactivate, team
   create/delete) and `AdminFreelanceQueue.tsx` (approve, reject) gave no
   success/error feedback. Added `showToast(...)` calls matching the
   established message style.
4. **Missing empty state.** `AdminOrganizations.tsx`'s Users table had no
   empty-state fallback, unlike its own Organizations tab in the same
   file. Added, matching the existing pattern.
5. **Unvalidated edit dialogs.** `EditJobDialog`/`EditCandidateDialog` used
   raw `useState` with only a truthiness check, so an invalid save
   silently no-ops with no explanation. Deferred — porting both to
   react-hook-form + zod is a larger, higher-risk change than the rest of
   this pass; tracked as follow-up rather than done live in this sweep.
6. **Dashboard glass/flat inconsistency.** `StatTile` used the default
   glass `Paper` while every chart `Paper` on the same screens opted out
   via `backdropFilter: "none"`. Standardized on flat for both — dashboard
   surfaces are dense data, the same category chart panels already were.
7. **Kanban card glass over a solid column.** `PlacementCard` inherited
   the default glass `Paper` while its parent `StageColumn` is
   deliberately solid — blur with nothing colorful behind it to refract.
   Given `backdropFilter: "none"` to match its parent.
8. **Person-row card pattern styled two ways.** `JobApplicationsPanel`'s
   `NotEligibleApplicants` used `variant="outlined"` + flat, while the
   same idiom in `OpenProfiles`/`AdminFreelanceQueue` stayed glass.
   Standardized on glass (the majority pattern). **Superseded 2026-08-28
   for two of the three** (flagged as drift — this finding describes a
   card pattern that no longer exists there): `NotEligibleApplicants`
   and `OpenProfiles` were both later converted to MUI `DataGrid`s (see
   [03-pipelines-and-boards.md](03-pipelines-and-boards.md) and
   [10-job-board-and-applications.md](10-job-board-and-applications.md)),
   so the glass-vs-flat card question is moot for them — a `DataGrid`
   has no per-row `Paper`. `AdminFreelanceQueue` is unchanged and still
   uses the glass card pattern this finding describes.
9. **"Search & filter" label over-promises.** `CareersBoard.tsx`'s sidebar
   has one keyword box, no facets. Relabeled to "Search".
10. **Stale doc color reference.** `06-ui-design-system.md` still described
    the brand primary as red (`#990000`); the app has been blue
    (`#3D6B94`) since the mid-session theme change. Corrected.

## Deferred (tracked, not done in this pass)

- **`AdminOrganizations`/`OrgRecruiters` tables → `DataGrid`.** Both use
  plain MUI `Table` where the rest of the app (Jobs, Candidates,
  JobDetail) uses `DataGrid` with search/sort/pagination. Real
  inconsistency, but a larger rework than the rest of this sweep — worth
  its own pass rather than folding into a design-polish sweep.
- **`ApplyPage` success-card motion.** Landing/CareersBoard got
  framer-motion entrances; the actual application form and its success
  state didn't. Small, deferred with the DataGrid item to keep this
  sweep's diff reviewable.
- **`OrgProfile` live preview + copy-link affordance.** No preview of how
  the profile renders on the public board, and the public URL is inert
  text instead of the established copy-link `IconButton` pattern used
  elsewhere for shareable links.
- **Loading-state convention (full-page spinner vs. inline placeholders)
  isn't written down anywhere**, even though the two patterns in use are
  each individually reasonable and already applied consistently by page
  type (detail pages spin, dashboards placeholder). Worth a line in
  06-ui-design-system.md next time that doc is touched.

Deferred items are real backlog, not dismissed — cut here to keep this
pass's diff reviewable in one sitting rather than opening a second large
refactor (DataGrid conversion) inside a design-polish sweep.
