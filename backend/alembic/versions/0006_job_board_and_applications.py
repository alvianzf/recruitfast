"""job board: slugs, visibility, screening questions, applications, open profiles

Revision ID: 0006
Revises: 0005
Create Date: 2026-08-25

See docs/10-job-board-and-applications.md. The candidates RLS policy
change here is the one deliberate, narrow exception to same-tenant-only
isolation in the whole schema — every other table's policy is untouched.

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

revision = "0006"
down_revision = "0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass  # see docstring — folded into 0001


def downgrade() -> None:
    pass  # see docstring — folded into 0001
