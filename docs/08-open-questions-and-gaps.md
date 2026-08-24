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
| Duplicate candidates across recruiters/jobs? | Dedup fingerprint on upload/create prompts "attach to existing?" instead of silently duplicating. | [02](02-data-model.md), [04](04-cv-parser.md) |
| Same candidate reapplies to the same job? | One table row, new CV versioned under the existing placement, latest shown by default, full history one click away. | [02](02-data-model.md), [03](03-pipelines-and-boards.md) |
| Can Superadmin see recruiter work via logs/exports/backups/support tools? | Blocked at the RLS layer, not just UI — including a formal, consent-gated Assisted Access path for the one legitimate support exception. | [01](01-roles-permissions.md), [02](02-data-model.md) |
| Can Org Admin read a recruiter's private notes? | No — notes have a `private-to-me` visibility flag independent of the Admin's otherwise-full pipeline visibility. | [01](01-roles-permissions.md) |
| Should Org Admin edits to another recruiter's pipeline be silent? | No — logged as `admin_override`, visibly marked on the card. | [01](01-roles-permissions.md), [02](02-data-model.md) |
| Deleting a pipeline stage with active candidates? | Blocked until they're reassigned via a mandatory picker. | [03](03-pipelines-and-boards.md) |
| Renaming a stage — does it corrupt history? | No — history references stage IDs with a label snapshot, not live names. | [02](02-data-model.md), [03](03-pipelines-and-boards.md) |
| Org template vs. per-job pipeline drift? | Clone-on-create; template edits don't retroactively touch existing jobs. | [02](02-data-model.md), [03](03-pipelines-and-boards.md) |
| CV parsing accuracy without a hosted LLM? | Yes — hybrid rule-based + local SLM, self-hosted, with confidence scoring and a mandatory human-review queue for low-confidence fields. | [04](04-cv-parser.md) |
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
- **Audit trail *viewer* UI (P1)** — the org-tier audit log table is
  designed in from day one (needed for Admin Override transparency and
  Assisted Access), but a dedicated browsing UI for it is P1.
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

## Explicitly unresolved — needs a business decision, not an engineering one

- **Who owns a departing freelancer's sourced candidates/jobs?** Freelance
  Org candidates are shared pool assets; if an approved freelancer leaves,
  is that work product retained under platform custody, transferred to
  another freelancer, or exportable by the departing freelancer? This is a
  Terms-of-Service question, not a schema question — the data model
  supports any of these outcomes, but the product needs a documented
  policy before the Freelance Org ships. **Flag for you to decide.**
- **Conflict of interest between competing freelancers on the same
  candidate.** Two Freelance Org members may independently source the same
  person for competing clients. The dedup prompt will surface this as "may
  already exist," but it deliberately does **not** expose the other
  freelancer's client/job details (confidentiality between freelancers,
  who aren't colleagues the way org recruiters are). Worth a product
  decision on whether any conflict-of-interest signal should be shown at
  all, even anonymized.
- **Org tenant onboarding path.** This spec assumes Org tenants are
  provisioned by Superadmin (sales-assisted), while only freelancers
  self-register. If you want agencies to self-serve sign up too, that's an
  additional flow (org creation + first Admin account + plan selection)
  not currently designed — say the word and it gets added.
