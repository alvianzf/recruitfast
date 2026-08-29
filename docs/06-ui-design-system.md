# UI & Design System

See [13-redesign.md](13-redesign.md) for the fuller rationale/history
behind this pass; this doc documents the resulting system as it stands in
`frontend/src/theme.ts` today.

## Visual language

- **Logo:** `components/Logo.tsx`'s `LogoMark` is a plain inline SVG
  (no image asset): two overlapping forward-pointing chevrons in the
  brand's two accent colors (navy `#3D6B94`, ember `#D1653A`), read as
  both "fast" (a fast-forward mark) and "collaborative" (two distinct
  colors moving together). It replaced an earlier stock people-icon PNG
  that was dark red/maroon and didn't match the rest of the brand
  palette. A matching `public/icon-mark.svg` is the primary favicon,
  declared first in `index.html` (`<link rel="icon" type="image/svg+xml">`)
  ahead of the old PNG favicons, which stay in place as a fallback for
  browsers without SVG favicon support; those still show the old mark
  and haven't been regenerated.
- **Component library:** MUI (React), themed rather than left on stock
  Material Design defaults — a custom type scale, shape tokens
  (`shape.borderRadius: 12`, fully-pill buttons, `10px` inputs, `16px`
  dialogs), and a bespoke color system (below) layered on top.
- **Color system — three deliberate layers**, all defined in `theme.ts`
  and re-exported for direct use outside the theme object (charts, custom
  components):
  1. **Primary ("ink") ramp** — a blue hue carried through real depth
     rather than one flat value: `BRAND_PRIMARY` (`#3D6B94`, light mode's
     `primary.main`), `BRAND_PRIMARY_LIGHT` (`#7CA8CC`, dark mode's
     `primary.main`), `BRAND_PRIMARY_DARK` (`#244B6B`, hover/headline
     ink), `BRAND_PRIMARY_DEEP` (`#142E42`, near-navy — footer/dark
     chrome, the AppShell sidebar gradient below). Same hue as earlier in
     the project, now expressed as a ramp instead of a single flat value.
  2. **Secondary/accent ("Ember")** — `BRAND_ACCENT` (`#D1653A`, with
     `_LIGHT`/`_DARK` variants), a warm orange used sparingly as a genuine
     accent: `palette.secondary.main`, the active nav-item highlight in
     `AppShell.tsx`, candidate-facing CTAs, one highlighted word in
     marketing copy — never a background fill. This replaces an earlier
     design where `secondary` was the same off-white as the page
     background; secondary is now a real, distinct color.
  3. **Status color family** (`STATUS_COLORS`, read via `getStatusColor(status,
     mode)`) — one hue-consistent, light/dark-aware map covering job
     status (`open`, `on_hold`, `won`, `lost`) and placement status
     (`active`, `rejected`, `withdrawn`, which reuse `open`/`lost`'s hues
     rather than getting their own — "in motion" and "ended badly" are
     the same semantic whether it's a job or a placement talking).
     Deliberately **not** stock MUI red/green/orange — `won` is violet,
     specifically so a successfully-closed job is never visually confused
     with an actively-hiring (`open`, teal) one. This is the single
     source of truth for status color everywhere one renders: `StatusChip`,
     Kanban stage accents/card borders (`KanbanBoard.tsx`'s
     `stageAccentColor`), and every Dashboard chart series that's
     status-keyed. An unrecognized status string falls back to a neutral
     ink tone rather than erroring.
  4. **Ink/neutral ramp** (`INK`) — replaces flat `text.primary`/
     `text.secondary` with a real hierarchy (`900`/`700`/`500`/`300`/`100`
     light, `50`/`200`/`400`/`600`/`800` dark); the `500`/`400` step is
     used for metadata/timestamps that shouldn't compete with body copy
     at the same weight.
- **Type scale — Space Grotesk + Inter**, both loaded as variable fonts
  (`@fontsource-variable/space-grotesk`, `@fontsource-variable/inter` —
  see [07-tech-stack.md](07-tech-stack.md)). `Inter` is the base
  `typography.fontFamily` for everything; `"Space Grotesk Variable"` is
  layered in specifically for `h1`–`h3` (the display sizes: 3.5rem/2.75rem/2rem,
  tight negative letter-spacing) — `h4` and smaller stay on Inter. The
  split is deliberate: Space Grotesk's geometric character reads as a
  "headline" typeface at display sizes but gets busy at body/UI sizes,
  where Inter's screen-tuned legibility wins.
- **Elevation: flat by default.** `MuiPaper` is themed with
  `backgroundImage: "none"`, a solid `background.paper` fill, and a
  `1px solid divider` border — no shadow, no translucency — for every
  `Paper` in the app unless a screen opts back out via `sx`. This is a
  reversal from an earlier "glass everywhere" pass: dense tables,
  dashboard panels, and dialogs read better flat, and glass-by-default
  meant opting *out* of it in a dozen places instead of opting *in* to it
  in the two places it actually earns its keep:
  - **The `AppShell` sidebar rail** (and its mobile `Drawer` equivalent) —
    a deep blue gradient (`BRAND_PRIMARY_LIGHT → BRAND_PRIMARY →
    BRAND_PRIMARY_DARK → BRAND_PRIMARY_DEEP`, `AppShell.tsx`'s
    `gradientSx`) so the nav rail reads as chrome/wayfinding, distinct
    from content, and anchors every screen against the off-white app
    background.
  - **Public marketing/job-board pages** (`Landing.tsx`, `CareersBoard.tsx`)
    — a blue gradient mesh background (`publicStyles.ts`'s
    `PUBLIC_BLUE_BACKGROUND`) with translucent, blurred cards on top
    (`PUBLIC_GLASS_SX`: `backdrop-filter: blur(20px) saturate(140%)`,
    low-opacity white fill, subtle border) — kept local to these public
    pages rather than the shared theme, since the authenticated product
    intentionally stays off-white/flat.
- **Animated vector graphic pattern (public pages only).** `Landing.tsx`,
  `About.tsx`, and `FAQ.tsx` each carry a small, purpose-built inline-SVG
  graphic (`CandidateNetworkGraphic.tsx`, `AboutJourneyGraphic.tsx`,
  `FaqOrbitGraphic.tsx`), animated with `framer-motion` rather than a
  static illustration. All three draw their fills/strokes from one
  shared palette, `vectorPalette.ts`'s `VECTOR_PALETTE` (`paletteColor(i)`),
  six muted-saturated hues (ember, teal, violet, amber, sky blue, rose)
  cycled by index, deliberately multi-color rather than a single
  repeated accent tone, since one flat accent read as monotone against
  the navy gradient background these graphics sit on. This is a public-
  pages-only pattern; the authenticated product's flat, data-dense
  screens don't use it.
- **Compact density on data-heavy surfaces.** Every `DataGrid` in the app
  is rendered with `density="compact"` — recruiters scanning dozens of
  rows benefit more from row density than from MUI's default row height.
  That's Jobs, Candidates, and a job's pipeline table view, plus (all
  converted from hand-rolled card lists — **updated 2026-08-28, flagged
  as drift, this list was stale**) the Withdrawn/Rejected section,
  Not-eligible applicants, the screening-questions editor, Open Profiles,
  and Find Candidates' results.
- **Fixed sidebar, independently scrolling content.** `AppShell`'s outer
  container uses `height: "100vh"` + `overflow: "hidden"` (not
  `minHeight: "100vh"`, which was the earlier, buggy version); that's
  what genuinely pins the sidebar rail in place, with only the `<main>`
  content column below it getting its own scrollbar (`overflowY: "auto"`),
  instead of the whole page, sidebar included, scrolling together as one
  long document.
- **Mobile navigation.** Below MUI's `md` breakpoint, `AppShell` swaps the
  fixed sidebar rail for a sticky top bar (logo + menu button) and a
  slide-out `Drawer` carrying the same nav content and the same gradient
  treatment as the desktop sidebar — not a separate, differently-styled
  mobile nav. The top bar and the main content column are flex **column**
  siblings (a fix for a latent bug where they were row siblings, which
  squeezed the topbar and content side by side on narrow screens instead
  of stacking them).
- **Public nav, mobile.** `PublicNav` (Landing/Jobs board/About/FAQ/
  Pricing) previously rendered all 4 links + the auth button in one
  unbreakable row with no responsive handling at all — genuinely broken
  on a phone width once Pricing became the 4th link (found and fixed
  2026-08-26). Now follows the same collapse-to-`Drawer` pattern as
  `AppShell`'s authenticated nav below `md`, for visual consistency
  across the public/authenticated boundary.
- **Public nav, active page.** `PublicNav`'s links (Jobs/Pricing/About/
  FAQ) previously had no active-state indication at all. Added
  2026-08-26: a small dot (`ActiveDot`, 6px, `secondary.main`) before the
  label of whichever link matches the current route, in both the
  desktop row and the mobile drawer. Deliberately a dot, not a
  background-highlight pill like `AppShell`'s authenticated sidebar
  (`isActive ? "secondary.main" : "transparent"`) — the public nav sits
  directly on the page's gradient background rather than a solid rail,
  so a highlight pill would need its own contrast tuning per page; a dot
  doesn't. `/jobs` matches its own sub-route (`/jobs/{org-slug}`) too
  (`isLinkActive`: exact match or a `/`-prefixed match), the others are
  exact-only.
- **2026-08-26 mobile audit — reviewed, found already handled.** DataGrid
  tables (Jobs/Candidates) and the Kanban board both already scope their
  own horizontal scroll (`overflow-x: auto` internally / on the Kanban's
  row `Stack`) rather than forcing the page to scroll horizontally — this
  only works because `AppShell`'s content column carries `minWidth: 0`
  (a flex item's implicit `min-width: auto` would otherwise let wide
  content blow out its container regardless of the child's own overflow
  rule). Dashboard/Landing/Pricing/About all already use responsive
  `Grid` breakpoints (`xs: 12` full-width, wider at `sm`/`md`) rather
  than fixed pixel widths. No fixed-pixel MUI X Chart widths found (they
  size to their container). Not exhaustively re-tested against every
  real device/viewport in this pass — a manual sweep on an actual phone
  is still worth doing before calling mobile "done," not just "not
  obviously broken in the source."
- **Theming:** supports light and dark mode throughout — the glass
  surfaces above in particular need distinct opacity/blur tuning per mode
  to stay legible, and the status-color map, ink ramp, and primary ramp
  all carry explicit light/dark values rather than relying on CSS
  auto-inversion.

## Interaction model

- **Table is the default view** for Jobs and Candidates lists; **Kanban is
  the default view inside a single job's pipeline** (see
  [03-pipelines-and-boards.md](03-pipelines-and-boards.md#table-vs-kanban)).
  **Target design:** view choice is a per-user, per-list preference
  persisted to the backend (`user_view_preferences` table — list_key,
  view_type), so it follows the recruiter across devices. **Implemented
  today:** the Kanban/Table toggle on a job's pipeline is local component
  state only (`useState`, not even `localStorage`) — it resets to Kanban
  on every navigation. There is no `user_view_preferences` table.
- **Drag-and-drop parity — target design:** every drag action (moving a
  Kanban card, reordering pipeline stages) has an identical,
  fully-functional **⋮ (three dots)** menu entry. This is a hard
  requirement, not a nice-to-have — it's what makes the product usable on
  touch devices (drag-and-drop on mobile Kanban is a known weak point)
  and for keyboard/screen-reader users. Drag is implemented with
  `dnd-kit`, chosen because it has native keyboard-operable drag support
  (`react-beautiful-dnd`, the more familiar option, is deprecated and
  lacks this).
  **Implemented today:** the Kanban card's ⋮ menu offers "Mark as
  Rejected" / "Mark as Withdrawn" only — both fully non-drag-accessible.
  There is no "Move to stage" menu entry and no pipeline-stage-reordering
  UI anywhere yet; full parity is a gap, not a shipped guarantee.
- **Row/card click behavior:** clicking anywhere on a Jobs/Candidates
  table row opens the full detail view (candidate profile, job detail);
  the ⋮ menu is a distinct affordance (icon button, stops propagation) so
  "open detail" and "quick action" never conflict. A Kanban card
  (`JobDetail.tsx`'s pipeline board) instead opens the **Quick View**
  drawer on click — reviewing a candidate mid-pipeline doesn't need to
  leave the job's board — with the same ⋮-stops-propagation separation for
  its "Mark as Rejected"/"Mark as Withdrawn" actions. The Candidates list
  additionally has an explicit **Quick View** icon action per row (since a
  row click there goes to the full profile instead) — see "Quick View
  drawer" below.
- **Bulk actions — target design:** table view supports multi-select
  with a persistent bulk-action bar (Move to stage, Reject, Blacklist,
  Export) — this is a table-only capability; Kanban's value is
  single-item spatial context, not bulk operations. **Implemented today:**
  no multi-select or bulk-action UI exists anywhere in the app yet.

## Quick View drawer

A side drawer (`CandidateQuickView.tsx`, `Drawer anchor="right"`) — an
alternative to navigating to the full Candidate Detail page, for fast
sequential review of many candidates. **Updated 2026-08-28 (flagged as
drift — this section's entry-point list had fallen behind the actual
wiring):** opens from a "Quick view" icon action on each Candidates-list
row; from clicking any Kanban card on a job's pipeline board
([03-pipelines-and-boards.md](03-pipelines-and-boards.md#table-vs-kanban));
from the pipeline Table view, the Withdrawn/Rejected section, and the
Not-eligible-applicants section on a job's page (broadened 2026-08-27);
and from row clicks (or, on Find Candidates, a dedicated icon button) on
the **Open Profiles** and **Find Candidates** results `DataGrid`s
(added 2026-08-28) — the latter two work identically for both
same-tenant and cross-tenant (open-profile) results, riding the RLS
extension covered in [02-data-model.md](02-data-model.md#row-level-security-rls-model).

Three tabs: **Details**, **CV**, **Notes** (added 2026-08-27).

- **Basic Information** (Details tab) — position, location, email, phone,
  source, experience, blacklist status; same data as Candidate Detail's
  info card, just denser.
- **Parsed Data table** — every key in `candidate_documents.parsed_fields`
  flattened to field/value rows (nested objects/arrays are joined into a
  single readable string per row). This is deliberately a flat scan
  table, not the rich sectioned rendering Candidate Detail uses — the
  drawer is for triage speed, the full page is for depth.
- **CV preview** — the current CV rendered inline via an `<iframe>` over
  a `blob:` URL. Fetched with the authenticated `api` client
  (`GET /candidates/{id}/cv`, `responseType: "blob"`) rather than a
  direct `<iframe src>`/`<a href>` to that URL, because auth is a Bearer
  token in the `Authorization` header — a plain browser-initiated request
  to that endpoint wouldn't carry it. The blob URL is revoked on
  candidate change/unmount to avoid leaking memory across a long
  browsing session. The iframe's `src` carries PDF open-parameters
  (`#navpanes=0&pagemode=none&view=FitH&zoom=page-width`) so the browser's
  native PDF viewer renders fit-to-width with no thumbnail/outline side
  panel — `navpanes`/`view` are Chromium's parameter names, `pagemode`/
  `zoom` are Firefox pdf.js's; each browser ignores the pair it doesn't
  recognize, so both are set for cross-browser coverage.
- **Download button** — downloads the same blob via an anchor's
  `download` attribute; no separate backend call.
- **Notes tab** (added 2026-08-27) — the same `NotesPanel` component used
  on Candidate Detail (`frontend/src/components/NotesPanel.tsx`, extracted
  from a copy that used to live only inline in `CandidateDetail.tsx`),
  rendered with `variant="plain"` here (no repeated Paper card/heading —
  the tab label already says "Notes") vs. Candidate Detail's
  `variant="card"` default. Full parity: view the note thread (author,
  timestamp, a "private to you" chip on private notes) and add a new one
  (body + Team-visible/Private-to-me radio) without leaving the drawer —
  same `useCandidateNotes`/`useAddCandidateNote` hooks, `GET`/`POST
  /candidates/{id}/notes`.
- **Next / Prev** — steps through the candidate ID list backing the
  currently-loaded Candidates table (its natural fetch order — this does
  **not** track the DataGrid's live sort/filter state), plus
  `ArrowLeft`/`ArrowRight` keyboard shortcuts while the drawer is open.

Backend: `GET /candidates/{candidate_id}/cv` streams the candidate's
current CV file (`FileResponse`, tenant + RLS scoped like every other
candidate endpoint) — there was no file-serving endpoint at all before
this; CVs were stored (`documents.storage_key`) but never downloadable.

## Image upload (org logo, user avatar)

`components/ImageUploadField.tsx` is a shared drag-drop-or-paste-URL
image picker, used by both `OrgProfile.tsx` (org logo) and `Profile.tsx`
(a user's own avatar) rather than each screen rolling its own upload UI.
Two tabs: **Upload** (drag-and-drop or click-to-browse, calling
`POST /uploads/image`, PNG/JPEG/WEBP/GIF up to 5MB, backed by local disk
storage served back at `/media`, see
[02-data-model.md](02-data-model.md)) and **Paste a URL** (a plain text
field, for the case where an org already has a logo hosted elsewhere and
doesn't want to re-upload it). Both write to the same string field
(`logo_url`/`avatar_url`); the backend doesn't distinguish an uploaded
image's URL from a pasted one once saved.

## Navigation: breadcrumbs

Every page below the top-level nav destinations (Dashboard, Jobs,
Candidates) shows a breadcrumb trail above the page title, reflecting
actual navigational depth rather than a fixed decoration:

- Top level: `Jobs` / `Candidates` — no breadcrumb, the sidebar nav item
  itself is the location indicator.
- One level deep: `Jobs / {job title}` (job detail + Kanban board),
  `Candidates / {candidate name}` (candidate profile) — each segment
  before the current page is a link back to that list.
- The current page's segment is plain text, not a link (you're already
  there).
- Lives in the same content column as the page header (not the sidebar),
  directly above `PageHeader`, so it scrolls with content on mobile rather
  than eating fixed vertical space in the nav rail.

This is a small piece of chrome but it's what makes drilling into a job's
pipeline or a candidate's profile feel like a place you can navigate back
out of, not a dead end — especially relevant once Kanban board and
candidate detail views exist as their own routes rather than modals.

## Confidentiality-aware UI patterns

- Org Admin's "Admin Override" edits show a distinct visual marker
  ("changed by Admin") on the affected card/row — see
  [01-roles-permissions.md](01-roles-permissions.md).
- Superadmin's UI literally has no navigation path into job/candidate
  content — there's no "hidden" admin panel a determined user could find;
  the screens don't exist because the API doesn't return the data (RLS).
- Private notes are visually tagged ("private to you") wherever they
  appear so recruiters never mistake them for team-visible content.

## Accessibility baseline

- WCAG 2.1 AA contrast targets apply even to glass surfaces — text/icon
  contrast is checked against the *rendered* (blurred+tinted) background,
  not the nominal surface color.
- Full keyboard operability for every drag-and-drop interaction via the
  ⋮-menu equivalents, plus `dnd-kit`'s built-in keyboard sensor for direct
  keyboard-driven dragging.
