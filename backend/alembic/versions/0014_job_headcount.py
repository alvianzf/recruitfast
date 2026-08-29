"""jobs: add headcount for auto-close-on-offer-match

Revision ID: 0014
Revises: 0013
Create Date: 2026-08-25

Existing rows default to 1 (the common case: one hire per req). No RLS
context needed for this one — a plain column add + backfill-by-default
doesn't need to read/filter existing rows per tenant like 0013 did.

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

revision = "0014"
down_revision = "0013"
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass  # see docstring — folded into 0001


def downgrade() -> None:
    pass  # see docstring — folded into 0001
