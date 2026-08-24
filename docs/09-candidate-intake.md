# Candidate Intake: CV Upload & Bulk Import

Two ways candidates enter the system beyond manual one-by-one entry:
**CV upload** (PDF/DOC/DOCX, parsed automatically — see
[04-cv-parser.md](04-cv-parser.md)) and **CSV/Excel bulk import**. Both
follow the same interaction shape so recruiters only have to learn one
pattern, and both are designed around a single rule: **nothing is written
to the database until the recruiter has seen a preview and explicitly
confirmed it.** Uploading is never itself the commit.

## Shared pattern: the Upload Modal

Every upload in the product (CV, bulk import, and the JD file upload on a
job) uses the same modal shape:

1. **Centered modal**, not a side drawer or inline panel — consistent
   with every other confirmation-style modal in
   [06-ui-design-system.md](06-ui-design-system.md).
2. **Drop zone is the primary surface**: drag-and-drop files onto it, or
   click it to open the OS file picker. This matches the app's
   drag-and-drop-first philosophy elsewhere ([03](03-pipelines-and-boards.md))
   without losing the clickable fallback for touch/keyboard users.
3. Accepted file types and the size limit are shown as helper text under
   the drop zone at all times (e.g. *"PDF, DOC, DOCX — up to 10 MB
   each"*), not discovered only after a rejected upload.
4. A file that fails the type/size check is rejected **client-side,
   immediately**, with an inline reason next to that file — it never
   reaches the server just to bounce.
5. **Preview state**: once files are dropped, each one gets parsed/read
   (server round-trip) and rendered as a row/card showing what will be
   created, with a per-item status (parsing → ready / needs review /
   error). The recruiter can remove any item from the batch before
   confirming.
6. **Explicit commit**: a single primary button ("Add N candidates" /
   "Import N candidates") that stays disabled until at least one item is
   valid. Canceling the modal at any point discards everything — no
   partial writes.
7. Modal never blocks on the slowest file — each item's parse status
   updates independently so a recruiter can start reviewing the first
   finished item while later ones are still processing.

## CV upload (single or batch)

**Entry points:** "Add candidate" on the Candidates page (global — not
attached to any job), and "Add candidate" inside a job's `Sourced` column
(Kanban ⋮ menu or a button above the Table view) — attaches each resulting
candidate to that job's pipeline directly, skipping a separate manual
attach step.

**Flow:**

1. Drop zone accepts **multiple files at once** — batch-sourcing (a
   recruiter dragging in 20 CVs from a folder) is the common case, not the
   exception. Accepted types: `.pdf`, `.doc`, `.docx`. Max 10 MB per file,
   50 files per batch (soft cap — see
   [Limits](#limits--what-happens-at-the-edges)).
2. Each file starts parsing immediately in the background (the pipeline in
   [04-cv-parser.md](04-cv-parser.md)) as soon as it's dropped — recruiters
   don't wait for the whole batch before seeing the first result.
3. **Preview list**, one row per file:
   - File icon (by type) + filename + size.
   - Once parsed: name, position, and years of experience as the row
     summary (email/phone are collected but not the headline — a
     recruiter scanning 20 rows recognizes "DevOps Engineer, 7 yrs" faster
     than an email address). Full detail — summary, skills by category,
     education, certifications, project history — is one click away in
     an expanded row, per the parsed field schema in
     [04-cv-parser.md](04-cv-parser.md#parsed-field-schema-candidate_documentsparsed_fields).
     Confidence flagging is per-field/per-array-item as described there;
     a file with any low-confidence field shows a "Needs review" chip,
     and expanding the row surfaces exactly which field/project/skill
     needs a look rather than making the recruiter hunt for it.
   - **Duplicate flag**: if `dedup_fingerprint` matches an existing
     candidate, the row shows *"Possibly [Existing Name]"* with a choice —
     **Create new** / **Attach existing candidate to this job instead**
     (only shown when opened from within a job) / **Skip this file**.
     Mirrors [04-cv-parser.md](04-cv-parser.md#duplicate--reapplication-handling).
   - Parse failures (corrupt file, unsupported content, empty extraction)
     show an inline error and an **"Add anyway with manual entry"**
     fallback — a failed parse never blocks adding the candidate, per the
     no-hard-failure principle already established for OCR/non-English
     resumes.
   - A remove (✕) action per row, no confirmation needed — nothing's
     committed yet.
4. Commit button reads **"Add {N} candidates"** where N excludes removed
   and skipped rows. On success: modal closes, the candidate list (and, if
   opened from a job, that job's `Sourced` column) refreshes with the new
   candidates.

## CSV/Excel bulk import

**Entry point:** "Import candidates" next to "Add candidate" on the
Candidates page. Global only in P0 — importing directly into a specific
job's pipeline is a natural follow-up but out of scope until the base flow
is validated (a P1 note: importing into a job would reuse this exact
modal with a job pre-selected, no new mechanism needed).

**Downloadable template:** the modal's drop zone is preceded by a
**"Download example CSV"** / **"Download example Excel"** link pair — this
is the primary defense against malformed imports, not a buried help link.
Clicking it downloads a real file (see
[Template contents](#template-contents) below) with the exact expected
headers and two realistic example rows, so a recruiter can open it, see
the shape, and fill in their own data rather than guess column names.

**Flow:**

1. Drop zone accepts `.csv`, `.xlsx` (not legacy `.xls` in P0 — see
   [Limits](#limits--what-happens-at-the-edges)). One file per import (not
   a batch of files — a single spreadsheet already holds many rows).
2. On drop, the file is sent to a **preview endpoint** that parses and
   validates it **without writing anything** (see
   [API](#api-endpoints)), returning every row with a per-row status.
3. **Column detection**: headers are matched case/whitespace-insensitively
   against the six known template columns; an unrecognized column is
   simply not imported rather than blocking the file. **Simplification
   vs. the original spec**: an interactive per-column remapping dropdown
   (for headers that don't match at all) isn't built in this pass — auto-
   detection covers the case where the recruiter used the downloaded
   template or a close variant, which is the common case; a full manual
   remapping UI is deferred until real usage shows it's needed.
4. **Preview table** (scrollable): one row per spreadsheet row, columns =
   mapped candidate fields, plus a status column:
   - ✅ **Valid** — will be created as-is.
   - ⚠️ **Warning** — importable but incomplete (e.g. missing phone) or a
     likely duplicate. **Simplification vs. the original spec**: the
     resolution choice here is **create new / skip** (matching the CV
     upload flow), not create/attach-to-existing/skip — attaching would
     merge into an existing candidate record, which needs a real merge UI
     this pass doesn't build; skip is the safe default for a suspected
     duplicate.
   - ❌ **Error** — blocking (missing required field, malformed email,
     unparseable row) — excluded from the count unless fixed.
   - Every cell is inline-editable in the preview table, so a handful of
     bad rows can be fixed without re-uploading the whole file.
5. A summary bar above the table: *"142 valid, 6 warnings, 3 errors."*
   Commit button reads **"Import {valid + acknowledged warnings} candidates"**
   and is enabled once there's at least one non-error row; erroring rows
   are simply excluded from the import (never silently — the count and
   the rows stay visible) rather than blocking the whole file.
6. On commit, a `candidate_import_batches` row is created (see
   [data model](#data-model-addition)) and results in a toast summary:
   created / skipped counts.

### Template contents

Both the `.csv` and `.xlsx` template are generated from the same column
spec (single source of truth, not two hand-maintained files):

| Column | Required | Notes |
|---|---|---|
| Full Name | ✅ | |
| Email | Recommended | used for dedup matching; warning (not error) if blank |
| Phone | Recommended | same as above |
| Source | | free text, e.g. "LinkedIn", "Referral" |
| LinkedIn URL | | |
| Notes | | becomes the candidate's first note on import |

Two example rows ship in the template (realistic fictional names/emails,
clearly not real people) so the format is unambiguous — an empty template
with only headers is easy to fill in wrong.

## Data model addition

### `candidate_import_batches`

| column | type | notes |
|---|---|---|
| id | uuid PK | |
| tenant_id | uuid FK | RLS-scoped like every other content table |
| uploaded_by | uuid FK → users | |
| original_filename | text | |
| total_rows | int | |
| created_count | int | |
| skipped_count | int | error/skipped/duplicate-flagged rows excluded from the import |
| status | enum(`processing`, `completed`, `failed`) | |
| created_at | timestamptz | |

This is the traceability record for "who imported these 200 candidates
and when" — deliberately minimal in P0 (no per-row error log persisted
yet; that's a natural P1 addition once reporting/export exists, see
[08-open-questions-and-gaps.md](08-open-questions-and-gaps.md)).
`candidates.dedup_fingerprint` (already in
[02-data-model.md](02-data-model.md)) is reused unchanged for
duplicate detection in this flow — no new dedup mechanism.

## API endpoints

- `POST /candidates/import/preview` — multipart file upload, tenant/RLS
  scoped like every other endpoint. Parses and validates only; returns
  the row-by-row preview payload (status, mapped fields, dedup matches).
  Writes nothing.
- `POST /candidates/import/commit` — takes the (possibly recruiter-edited)
  row set from the preview response plus per-row resolutions (create /
  skip), writes candidates + the `candidate_import_batches` row in one
  transaction.
- `GET /candidates/import/template.csv` and `.../template.xlsx` — streams
  the generated template described above.
- CV upload reuses the existing per-file parse pipeline
  ([04-cv-parser.md](04-cv-parser.md)); the batch modal just calls it once
  per dropped file and aggregates results client-side — no new backend
  concept beyond what CV parsing already does.

## Limits & what happens at the edges

- **CSV/Excel row cap:** 5,000 rows per file in P0. Above that, the
  preview endpoint returns an error naming the limit rather than silently
  truncating — silent truncation would be exactly the kind of mistake
  this feature exists to prevent.
- **Legacy `.xls` (pre-2007 binary Excel):** not supported in P0 — the
  drop zone rejects it client-side with a message pointing at `.xlsx` or
  `.csv`. Support is a small addition (`xlrd` covers legacy `.xls`
  reading) if real users hit this; not built speculatively.
- **CV batch cap:** 50 files per batch — a soft UI limit (extra files
  beyond 50 are rejected client-side with a message to split into two
  uploads), not a backend constraint, since nothing about the parse
  pipeline actually requires it.
- **Encoding:** CSV parsing assumes UTF-8 first, falls back to
  Windows-1252 (the common source of "weird character" bugs from
  Excel-exported CSVs on Windows) before erroring the whole file.
