# Security Review

An adversarial pass over the actual codebase (not a generic checklist) —
focused on what a real attacker with no credentials could reach, since
that's the largest exposed surface: the public job board, the public
application form, and login. Findings are graded by what they'd actually
let someone do, not by severity-scanner convention.

## Findings — fixed in this pass

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

- **CORS wildcard (`allow_origins=["*"]`)** — `main.py` already
  self-documents this as a known dev-only gap ("tighten... before this
  goes anywhere near the internet"). `allow_credentials=False` pairs
  correctly with it, and since auth is a Bearer token in the
  `Authorization` header rather than a cookie, the wildcard doesn't
  enable the classic cookie-based cross-site request forgery it would
  with cookie auth — the real residual risk is a stolen/XSS-exfiltrated
  token being usable from any origin. Not tightened now because doing so
  requires an environment flag (dev vs. prod) that doesn't exist yet in
  `Settings`, and guessing at one risks breaking the active local dev
  session mid-review. `settings.cors_origins` already exists, unused —
  wiring it in behind a real environment check is the correct follow-up.
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
- **`refresh_token` is minted but never consumable** — `POST /auth/login`
  returns one, but no `/auth/refresh` endpoint exists anywhere, and the
  frontend never sends it (confirmed — only the access token is stored).
  Not itself exploitable: `decode_token`'s `type != "access"` check in
  `app/api/deps.py` rejects it against every real endpoint. Dead code,
  not a vulnerability — either build the real refresh flow or stop
  minting the token, tracked as a cleanup item, not a security fix.

## Out of scope for this pass

RLS/multi-tenancy isolation, the three deliberate cross-tenant
exceptions (open profiles, public job board, email blacklist registry),
and the freelance-candidate-privacy model were all reviewed extensively
during their own implementation (see
[02-data-model.md](02-data-model.md)'s RLS section) and re-verified
end-to-end with live cross-tenant curl tests at the time. Not re-audited
here since nothing in this pass touched that surface.
