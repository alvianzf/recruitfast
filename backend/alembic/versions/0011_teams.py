"""teams: org admin groups recruiters, standard tenant-isolation RLS

Revision ID: 0011
Revises: 0010
Create Date: 2026-08-25

Teams are ordinary org content (not a cross-tenant exception like
0006/0008/0010) so they get the same tenant_isolation policy as jobs,
candidates, etc. `users.team_id` lives on `users`, which — like the rest
of that table — isn't RLS-protected; see docs/02.

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

revision = "0011"
down_revision = "0010"
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass  # see docstring — folded into 0001


def downgrade() -> None:
    pass  # see docstring — folded into 0001
