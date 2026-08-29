"""freelance org: candidates private to their uploading recruiter by default

Revision ID: 0012
Revises: 0011
Create Date: 2026-08-25

Previously every candidate in the Freelance Org tenant was visible to
every freelancer sharing that tenant (plain tenant_isolation policy, no
per-recruiter distinction). Product decision: a freelancer's uploaded
candidates should default to PRIVATE to them, not shared org-wide — Org
tenants are unaffected (recruiter oversight there depends on shared
visibility, that's the whole point of the role). Cross-tenant "Open
Profiles" sharing (candidates.open_to_other_roles) is a separate,
orthogonal opt-in mechanism and is untouched by this change.

Scope note: this restricts the `candidates` table only. candidate_documents/
pipeline_placements/notes keep their existing tenant-wide RLS policies —
every app code path reaches those through a `candidates` row first (see
get_candidate, list_candidates), so RLS on `candidates` is the effective
gate in practice. See docs/02 for the full writeup of this boundary.

NEUTERED 2026-08-26: this migration's schema changes are now
folded into 0001's create_all() (models.py already reflects them),
and any RLS policy work here is superseded by 0001's consolidated
policy setup. Any data backfill above only ever mattered for rows
that existed in this project's own dev database at the time it was
first applied there (already done, permanently) — a fresh install
has no such rows to backfill. Kept as a no-op, not deleted, so the
revision chain and this history stay intact. See 0001's docstring.
"""
from alembic import op
import sqlalchemy as sa

revision = "0012"
down_revision = "0011"
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass  # see docstring — folded into 0001


def downgrade() -> None:
    pass  # see docstring — folded into 0001
