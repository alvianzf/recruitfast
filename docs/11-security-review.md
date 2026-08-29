# Security Review

An adversarial pass over the actual codebase (not a generic checklist) —
focused on what a real attacker with no credentials could reach, since
that's the largest exposed surface: the public job board, the public
application form, and login. Findings are graded by what they'd actually
let someone do, not by severity-scanner convention.

## 2026-08-26 follow-up pass

The app is now actually deployed and internet-reachable (it wasn't when
the first pass below was written), which changed the calculus on two
items that were previously "documented, not changed":

1. **CORS wildcard, now fixed.** `main.py` hardcoded `allow_origins=["*"]`
   even though `settings.cors_origins` already existed and production's
   `.env` was already correctly set to the real frontend origin — it just
   wasn't wired in. Switched to `allow_origins=settings.cors_origins`;
   the local-dev default already lists both `localhost` and `127.0.0.1`,
   so this needed no new environment flag.
2. **`refresh_token` is now consumable.** A token was minted at login but
   nothing ever redeemed it, and the frontend never sent it — meaning
   every session hard-expired 15 minutes after login (the access token's
   lifetime) with no way to silently renew, forcing a full re-login. Not
   itself a vulnerability as previously noted, but a real, live
   functional gap once actually deployed. Added `POST /auth/refresh`
   (validates token type, re-reads the user so a deactivated account
   stops renewing within one access-token lifetime instead of never) and
   wired the frontend (`api/client.ts`) to transparently refresh on a 401
   and retry the original request, with concurrent 401s sharing one
   in-flight refresh call. `AuthContext` also now recovers a session on
   page load if the access token already expired but the refresh token
   is still valid, instead of bouncing a still-logged-in user to /login.

New findings from this pass:

3. **Password length wasn't enforced server-side on three of four
   password-setting endpoints.** `admin.py`'s `OrgAdminCreate`/
   `SuperadminCreate` already had `Field(min_length=8)`, but
   `FreelanceRegisterRequest.password`, `RecruiterInvite.password`, and
   `ChangePasswordRequest.new_password` were plain `str` — the 8-char
   minimum only existed in the frontend's zod schema, so a direct API
   call (curl, or a compromised/malicious client) could set an empty or
   1-character password on a public self-registration endpoint, an
   org-invited recruiter account, or via self-service password change.
   Added the same `Field(min_length=8)` to all three.
4. **Bulk-import preview read the whole upload into memory before
   checking anything.** `MAX_ROWS` bounded parsed row count, but
   `content = await file.read()` in `bulk_import.py`'s `preview_import`
   was unbounded, and there was no file-size cap at all — the same
   pattern already fixed elsewhere in the first pass (finding 2), missed
   here since this endpoint was added later. Bounded the read to 20MB
   (candidate imports are legitimately larger than a single CV) using
   the same `read(N+1)` pattern.
5. **Bulk-import template downloads had no auth dependency at all.**
   `GET /candidates/import/template.csv` and `.xlsx` were reachable
   unauthenticated — low sensitivity (a blank template, no real data),
   but inconsistent with every other endpoint in the app and a minor,
   avoidable information leak of the exact expected import format. Added
   `Depends(get_current_user)`.
6. **New `jobs.client_id` FK needed an explicit tenant check, not just
   RLS.** Postgres FK constraint validation checks the *referenced* row's
   existence, not the *querying* role's RLS visibility of it — so
   without an explicit check, an org_admin could set a job's `client_id`
   to another tenant's client UUID and the FK would silently accept it
   (the row genuinely exists, just invisible under RLS to them). Added
   `_resolve_client_id()` in `jobs.py`, which looks the client up scoped
   to `current_user.tenant_id` before assigning it, mirroring the
   existing `assign_job` recruiter-ownership check. See
   [02-data-model.md](02-data-model.md).

## Findings — fixed in the original pass

### 1. Public application endpoint had no file size or type limit (High)

`POST /public/jobs/{job_id}/apply` is fully unauthenticated by design (see
[10-job-board-and-applications.md](10-job-board-and-applications.md)) and
accepts a CV upload. It never checked file size or extension before this
review — contrast with the authenticated `POST /candidates/cv/parse-preview`,
which always has. Two compounding problems:

- **Resource exhaustion**: anyone could POST an arbitrarily large file,
  which then got fully read into memory (`await cv.read()`) and written
  to disk, with no authentication and no cap.
- **Cost abuse**: since [04-cv-parser.md](04-cv-parser.md)'s LLM tier was
  added, a "successful enough" parse now triggers a paid third-party API
  call. An unauthenticated, unlimited endpoint that can trigger paid API
  calls is a direct financial exposure, not just a stability one.

**Fix**: `public_board.py`'s `apply_to_job` now rejects unsupported
extensions before reading the file at all, and enforces the same 10 MB
cap `candidates.py` already had (`MAX_FILE_SIZE_BYTES`, now centralized
in `cv_parser.py` so both call sites share one definition instead of two
copies that could drift).

### 2. Size checks ran *after* an unbounded read, everywhere (Medium)

Even where a size check existed (`candidates.py`'s `cv_parse_preview`),
it ran on `content = await upload.read()` — a full, unbounded read —
*before* checking the length. A 2 GB upload would still fully buffer in
memory; the check only rejected it afterward. Fixed by bounding the read
itself: `await upload.read(MAX_FILE_SIZE_BYTES + 1)` reads at most one
byte more than the limit, so an oversized file is caught without ever
buffering more than ~10 MB, regardless of how large the actual upload is.
Applied to both the public and authenticated upload paths.

### 3. No rate limiting anywhere (Medium)

Zero rate limiting existed on any endpoint, including `/auth/login`
(unlimited credential-stuffing/brute-force against any known email) and
every public, unauthenticated write endpoint. Added `slowapi`
(`app/core/limiter.py`, wired in `app/main.py`), per-IP:

| Endpoint | Limit | Why |
|---|---|---|
| `POST /auth/login` | 10/minute | Brute-force/credential-stuffing |
| `POST /public/jobs/{id}/apply` | 5/minute | Spam + LLM cost abuse (finding 1) |
| `POST /freelance/register` | 5/minute | Spam account creation (bcrypt-hashing cost per attempt too) |
| `POST /candidates/cv/parse-preview` | 20/minute | Authenticated, but still triggers paid LLM calls — a compromised or malicious recruiter account shouldn't be able to run up the bill unbounded either |

These are deliberately generous (not tuned for a specific attacker
model) — the goal is closing "literally unlimited" to "bounded," not
perfecting the exact threshold. Tighten with real traffic data later.

### 4. `JWT_SECRET` default placeholder was silently usable (Low, but a real footgun)

`Settings.jwt_secret` defaults to `"change-me"` — meant purely as a type
placeholder (`app/core/config.py`'s own comment says so), but nothing
ever checked whether it was still set to that value. Deployed as-is,
every access/refresh token the process issues would be forgeable by
anyone who's read this file (i.e., anyone — it's a public-ish repo
pattern). Added a startup warning (not a hard failure, to avoid crashing
a misconfigured local run outright) logged via `uvicorn.error` if the
default is still active. Confirmed this local environment's real
`backend/.env` value doesn't trigger it.

## Findings — documented, not changed this pass

Each of these is real but was left alone deliberately, with the reason
stated — not an oversight.

- **Login error messages differentiate account state** — `pending_approval`
  and `deactivated` get distinct 403 messages from a generic "invalid
  email or password" 401. This is a minor user-enumeration leak (an
  attacker can learn whether an email is registered and its status), but
  collapsing it removes real UX value (a legitimate pending applicant
  needs to know *why* they can't log in yet). Accepted trade-off, not a
  fix — revisit if enumeration becomes a demonstrated problem, not a
  theoretical one.
- **No file content verification beyond extension** — `SUPPORTED_EXTENSIONS`
  and the new size cap are extension/size-based only; nothing verifies
  the uploaded bytes actually are a PDF/DOCX (no magic-byte check). A
  file with a `.pdf` extension but arbitrary content would pass the
  gate, get attempted by `pdfplumber`/`python-docx` (which fail closed —
  caught and routed to manual entry, per existing behavior), and get
  stored with a guessed `mime_type`. Low impact since storage is
  object-storage-style (never executed, served back as an attachment),
  but worth a real magic-byte check if this product starts serving files
  inline in a browser-rendering context.
- **No CAPTCHA/bot-detection on public endpoints** — rate limiting
  (finding 3) bounds the damage per-IP but doesn't stop distributed or
  slow-and-low scripted abuse. Worth adding (hCaptcha/Turnstile on the
  apply form) if abuse actually shows up in logs — not pre-emptively
  built for a threat that hasn't materialized.

## Out of scope for this pass

RLS/multi-tenancy isolation, the three deliberate cross-tenant
exceptions (open profiles, public job board, email blacklist registry),
and the freelance-candidate-privacy model were all reviewed extensively
during their own implementation (see
[02-data-model.md](02-data-model.md)'s RLS section) and re-verified
end-to-end with live cross-tenant curl tests at the time. Not re-audited
here since nothing in this pass touched that surface.

**Update 2026-08-28 — the open-profile exception was widened, and this
review covers it:** migration `0031_open_profile_cv_notes_rls.py`
extended the `open_to_other_roles` cross-tenant exception from
`candidates` alone to also `candidate_documents`, `documents`, and
`notes` — so Candidate Quick View's CV and Notes tabs work for an
open-profile candidate from a different org. This was an explicit,
informed product decision (offered as a choice — summary-only quick
view vs. full quick view — and "full" was chosen deliberately), not an
oversight, but it's worth being precise about what it actually grants:

- **CV read access** crosses the tenant boundary — a natural extension
  of the candidate's own opt-in (they already agreed their profile is
  visible platform-wide; the CV is part of that profile).
- **Notes are the bigger consequence, and reviewed/accepted as such**:
  the exception on `notes` is not scoped to "the viewer and the
  candidate's home org" — it's the same platform-wide grant as
  everything else gated by `open_to_other_roles`. Concretely, once a
  candidate is open, any org can write a note about them (`WITH CHECK`
  only requires the writer's own `tenant_id` to match their session, no
  check against the candidate's home org), and any *other* org can then
  read that note if its `visibility = "team"` — org-to-org note sharing
  on a shared candidate, not just the candidate's own data crossing the
  boundary. `visibility = "private"` notes stay restricted to their own
  author regardless (an author-identity check in `notes.py`, untouched,
  not a tenant check — so this one guarantee holds regardless of which
  org wrote it).
- **Deliberately not extended**: `jobs`/`job_stages`/`pipeline_placements`
  keep the standard tenant-only policy — a placement exposes the
  *hiring org's* job title/stage, not the candidate's own data, and
  neither the candidate nor the hiring org consented to that crossing
  the boundary. Quick View's placement-chips section degrades to empty
  for a cross-tenant candidate, not an error.

No code change from this note — it exists so a future reader of this
review doesn't have to independently discover migration `0031` to know
the open-profile boundary moved.
