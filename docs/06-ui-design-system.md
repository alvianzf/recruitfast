# UI & Design System

## Visual language

- **Component library:** MUI (React), themed to **Material Design 3**
  guidelines (dynamic elevation tokens, updated typography scale, shape
  tokens) rather than the legacy Material Design 2 defaults MUI ships with
  out of the box.
- **Brand primary:** `#990000`. Used for primary actions, active-state
  accents, and Kanban column headers — not as a full-surface fill (fails
  contrast/glassmorphism legibility at scale).
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
  View choice is a per-user, per-list preference persisted to the backend
  (`user_view_preferences` table — list_key, view_type), not just local
  storage, so it follows the recruiter across devices.
- **Drag-and-drop parity:** every drag action (moving a Kanban card,
  reordering pipeline stages) has an identical, fully-functional **⋮
  (three dots)** menu entry. This is a hard requirement, not a nice-to-have
  — it's what makes the product usable on touch devices (drag-and-drop on
  mobile Kanban is a known weak point) and for keyboard/screen-reader
  users. Drag is implemented with `dnd-kit`, chosen because it has native
  keyboard-operable drag support (`react-beautiful-dnd`, the more familiar
  option, is deprecated and lacks this).
- **Row/card click behavior:** clicking anywhere on a row/card opens the
  detail view (candidate profile, job detail); the ⋮ menu is a distinct
  affordance (icon button, stops propagation) so "open detail" and "quick
  action" never conflict.
- **Bulk actions:** table view supports multi-select with a persistent
  bulk-action bar (Move to stage, Reject, Blacklist, Export) — this is a
  table-only capability; Kanban's value is single-item spatial context, not
  bulk operations.

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
