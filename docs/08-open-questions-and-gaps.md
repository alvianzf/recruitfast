# Open Questions, Gaps & Decisions

This spec was reviewed by a Product Manager pass (ideal flows) and a QA
pass (adversarial edge cases) before being written. This doc records what
those reviews surfaced, what was decided and folded into the spec already,
and what's deliberately deferred with a reason.

## Decided and already reflected in this spec

| Question | Decision | Where |
|---|---|---|
| Does rejecting a candidate in one job affect other pipelines? | No — per-job status, decoupled. Org-wide "Do Not Contact" is a separate explicit Blacklist action. | [03](03-pipelines-and-boards.md) |
| Reject vs. candidate-initiated dropout? | Split into `rejected` vs `withdrawn` status. | [02](02-data-model.md), [03](03-pipelines-and-boards.md) |
| Duplicate candidates across recruiters/jobs? | Target design: dedup fingerprint on upload/create prompts "attach to existing?" instead of silently duplicating. **Built today:** the fingerprint match and "possibly [Existing Name]" flag are real, but the only resolutions are Create new / Skip — there's no "attach to existing" anywhere yet. Also now owner-scoped for Freelance Org candidates (see the conflict-of-interest entry below) — dedup only ever matches your own candidates there, not a fellow freelancer's private ones. | [02](02-data-model.md), [04](04-cv-parser.md) |
| Same candidate reapplies to the same job? | One table row, new CV versioned under the existing placement, latest shown by default, full history one click away. | [02](02-data-model.md), [03](03-pipelines-and-boards.md) |
| Can Superadmin see recruiter work via logs/exports/backups/support tools? | Blocked at the RLS layer, not just UI — including a formal, consent-gated Assisted Access path for the one legitimate support exception. **The RLS-blocking half is built and verified; Assisted Access itself is schema-only today — no API endpoints exist to file/approve a request, and nothing grants the corresponding RLS access.** | [01](01-roles-permissions.md), [02](02-data-model.md) |
| Can Org Admin read a recruiter's private notes? | No — notes have a `private-to-me` visibility flag independent of the Admin's otherwise-full pipeline visibility. | [01](01-roles-permissions.md) |
| Should Org Admin edits to another recruiter's pipeline be silent? | No — logged as `admin_override`, visibly marked on the card. | [01](01-roles-permissions.md), [02](02-data-model.md) |
| Deleting a pipeline stage with active candidates? | Blocked until they're reassigned via a mandatory picker. | [03](03-pipelines-and-boards.md) |
| Renaming a stage — does it corrupt history? | No — history references stage IDs with a label snapshot, not live names. | [02](02-data-model.md), [03](03-pipelines-and-boards.md) |
| Org template vs. per-job pipeline drift? | Clone-on-create; template edits don't retroactively touch existing jobs. | [02](02-data-model.md), [03](03-pipelines-and-boards.md) |
| CV parsing accuracy without a hosted LLM? | Yes — target design is hybrid rule-based + local SLM, self-hosted, with confidence scoring and a mandatory human-review queue for low-confidence fields. **Only the rule-based half is built** (labeled-format template parser + generic regex fallback); the local-SLM semantic layer for free-text resumes was never implemented — a real gap versus this decision, not just a phasing note. | [04](04-cv-parser.md) |
| Freelance recruiter entry to a shared tenant? | Gated by a Superadmin approval queue, not open self-serve. | [01](01-roles-permissions.md) |

## Deferred to P1/P2 (with reasons)

These were flagged by the PM/QA review as real gaps but are scoped out of
the initial build to keep it shippable — the data model doesn't preclude
adding them.

- **Interview scheduling & calendar sync (P1)** — the `User Interview`
  stage currently just moves a card; there's no booking/conflict-detection
  behind it yet. Flagged by both reviews as the single biggest functional
  gap. An `interviews` table and calendar-provider integration are the
  next major addition after the core pipeline loop ships.
- **Candidate communication — email/SMS threads (P2)** — without this,
  recruiters will do outreach outside the product, breaking the audit
  trail. Deferred because it requires deliverability infrastructure
  (SMTP/SendGrid, consent/opt-out tracking) that's a project in itself.
- **Notes with @mentions + notifications (P1)** — the `notes` table exists
  now; @mention parsing and an in-app/email notification system are the
  natural P1 addition once there's more than one person to notify.
- **Audit trail — no writer, not just no viewer (P1)** — `audit_log_org` /
  `audit_log_platform` are designed in from day one (needed for Admin
  Override transparency and Assisted Access), but nothing in the codebase
  ever writes to either table today (confirmed by repo-wide grep — they're
  only referenced in the model definitions). Admin Override transparency
  currently works via a narrower mechanism instead: `stage_history.
  was_admin_override`, a per-row boolean the UI reads to show the
  "changed by Admin" marker — real, but not the general-purpose audit log
  this doc originally implied was already capturing everything. A
  dedicated viewer is P1 either way, but there's no log being populated
  for it to browse yet.
- **Client/hiring-manager external portal (P2)** — agencies typically need
  to show pipeline status to their client; this is a distinct external-facing
  auth surface and is deliberately out of scope until the internal product
  is validated.
- **Offer letter generation / e-signature (P2)** — the `Offer` stage
  exists as a pipeline state; generating/signing the actual document is a
  separate integration (e.g. DocuSign) layered on top later.
- **Global talent-pool search & tagging (P1)** — cross-job candidate reuse
  is core to the multi-pipeline model but needs a real search/filter layer
  (`pg_trgm` fuzzy search, saved filters) to be genuinely discoverable
  rather than just theoretically possible.
- **GDPR self-service tooling (P2)** — right-to-be-forgotten needs a
  defined cascade/anonymization strategy across a candidate's multiple
  active pipelines and possibly the shared Freelance Org tenant. The
  `deleted_at` soft-delete convention is in place now; a proper erasure
  workflow (anonymize rather than hard-delete where it would break another
  recruiter's active pipeline) is deferred.
- **Reporting/export (P1)** — must reuse the same tenant/role authorization
  as the UI (a CSV export is not a permission bypass) — noted as a
  requirement now, built once there's a concrete report to export.
- **Superadmin platform-wide job/candidate aggregate metrics** — not just
  unbuilt but currently architecturally blocked: the `jobs`/`candidates`
  RLS policy excludes the superadmin role entirely, by design, so even a
  bare `COUNT(*)` needs a dedicated aggregate mechanism (a `SECURITY
  DEFINER` function or materialized view) rather than a normal query.
  Noted in `metrics.py` as a deliberate, commented gap. See
  [01](01-roles-permissions.md), [05](05-dashboards-metrics.md).
- **No pagination on any list endpoint** — `GET /jobs`, `GET /candidates`,
  `GET /candidates/open-profiles`, `GET /jobs/{id}/applications`,
  `GET /metrics/org/recruiters`, etc. all return every matching row.
  Fine at current dev scale; will not hold up for a large org tenant.
- **N+1 query pattern in `/metrics/org/recruiters`** — runs 5 separate
  count/aggregate queries per recruiter in a Python loop rather than one
  batched query. Correct, but won't scale past a handful of recruiters
  without becoming a real latency problem.

## Explicitly unresolved — needs a business decision, not an engineering one

- **Who owns a departing freelancer's sourced candidates/jobs?** Updated
  by the freelance-candidate-privacy change (`candidates.owner_user_id`,
  see [01](01-roles-permissions.md)/[02](02-data-model.md)): candidates a
  freelancer sourced are now *already* modeled as theirs individually
  (private by default, `owner_user_id` on the row), not a shared pool
  asset — which narrows this question from "who owns the shared pool" to
  "what happens to one freelancer's `owner_user_id` rows on departure."
  Still unresolved: retained under platform custody, reassigned to
  another freelancer, or exportable by the departing freelancer — no
  offboarding flow does any of these today (a deactivated user's rows
  just keep their existing `owner_user_id`, which then belongs to no one
  who can log in). Jobs are unaffected by the privacy change (still
  org-shared within the Freelance Org) and were already an open question.
  This is a Terms-of-Service question, not a schema question. **Flag for
  you to decide.**
- **Conflict of interest between competing freelancers on the same
  candidate.** Substantially changed by the same privacy default: two
  Freelance Org members independently sourcing the same person for
  competing clients **no longer see each other's candidate at all** by
  default (RLS hides it entirely, not just client/job details) — the
  dedup-prompt "may already exist?" surfacing described in the original
  design no longer fires across freelancers either, since the dedup
  check itself is now owner-scoped. This resolves the confidentiality
  half of the original concern more strongly than planned, but raises a
  new one: **duplicate candidate records now accumulate silently across
  freelancers** with no cross-freelancer dedup signal at all (unless the
  candidate opts into Open Profiles). Worth a product decision on whether
  that's acceptable or whether an anonymized "someone else may already
  have this candidate" signal should exist without revealing who.
- **Org tenant onboarding path.** This spec assumes Org tenants are
  provisioned by Superadmin (sales-assisted), while only freelancers
  self-register. If you want agencies to self-serve sign up too, that's an
  additional flow (org creation + first Admin account + plan selection)
  not currently designed — say the word and it gets added.
