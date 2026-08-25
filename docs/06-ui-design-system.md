# UI & Design System

## Visual language

- **Component library:** MUI (React), themed to **Material Design 3**
  guidelines (dynamic elevation tokens, updated typography scale, shape
  tokens) rather than the legacy Material Design 2 defaults MUI ships with
  out of the box.
- **Brand primary:** `#990000`. Used for primary actions, active-state
  accents, and Kanban column headers — not as a full-surface fill (fails
  contrast/glassmorphism legibility at scale).
- **Secondary / background:** off-white, `#f7f5f2` (`theme.ts`'s
  `OFF_WHITE` constant) — used as both the MUI `palette.secondary.main`
  and the base tone of the `.app-background` gradient in light mode (a
  faint brand-red radial tint over the off-white base, not the vivid
  warm gradient dark mode uses). Keeping secondary and background the
  same off-white is deliberate, not a coincidence — it's what keeps
  secondary-colored chrome (e.g. secondary buttons) from fighting the
  page background for attention; primary red stays the only strong
  accent color.
- **Glassmorphism:** translucent, blurred surfaces (`backdrop-filter:
  blur(...)` + low-opacity fill + subtle border) for cards, modals, and the
  app shell's navigation panels. Applied selectively — dense data tables
  stay on solid surfaces for legibility; glass is reserved for
  cards/panels/overlays where depth communicates hierarchy (e.g. a
  candidate's expanded version-history panel floating over the table).
- **Theming:** must support light and dark mode from day one — glass
  surfaces in particular need distinct opacity/blur tuning per mode to stay
  legible (validated separately, not assumed to "just work" inverted).

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
- **Row/card click behavior:** clicking anywhere on a row/card opens the
  detail view (candidate profile, job detail); the ⋮ menu is a distinct
  affordance (icon button, stops propagation) so "open detail" and "quick
  action" never conflict. The Candidates list additionally has a
  **Quick View** icon action (separate from the row click) that opens a
  side drawer instead of navigating away — see "Quick View drawer" below.
- **Bulk actions — target design:** table view supports multi-select
  with a persistent bulk-action bar (Move to stage, Reject, Blacklist,
  Export) — this is a table-only capability; Kanban's value is
  single-item spatial context, not bulk operations. **Implemented today:**
  no multi-select or bulk-action UI exists anywhere in the app yet.

## Quick View drawer (Candidates list)

A side drawer (`CandidateQuickView.tsx`, `Drawer anchor="right"`) opens
from a "Quick view" icon action on each Candidates-list row — an
alternative to navigating to the full Candidate Detail page, for fast
sequential review of many candidates:

- **Basic Information** — position, email, phone, source, experience,
  blacklist status; same data as Candidate Detail's info card, just
  denser.
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
- **Next / Prev** — steps through the candidate ID list backing the
  currently-loaded Candidates table (its natural fetch order — this does
  **not** track the DataGrid's live sort/filter state), plus
  `ArrowLeft`/`ArrowRight` keyboard shortcuts while the drawer is open.

Backend: `GET /candidates/{candidate_id}/cv` streams the candidate's
current CV file (`FileResponse`, tenant + RLS scoped like every other
candidate endpoint) — there was no file-serving endpoint at all before
this; CVs were stored (`documents.storage_key`) but never downloadable.

## Navigation: breadcrumbs

Every page below the top-level nav destinations (Dashboard, Jobs,
Candidates) shows a breadcrumb trail above the page title, reflecting
actual navigational depth rather than a fixed decoration:

- Top level: `Jobs` / `Candidates` — no breadcrumb, the sidebar nav item
  itself is the location indicator.
- One level deep: `Jobs / Backend Engineer` (job detail + Kanban board),
  `Candidates / Muhammad Iqbal` (candidate profile) — each segment before
  the current page is a link back to that list.
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
