"""rename job_status filled/cancelled to won/lost

Revision ID: 0007
Revises: 0006
Create Date: 2026-08-25

Sales-deal framing fits a recruitment agency's jobs better than generic
lifecycle terms — a job is "won" (closed with a hire) or "lost" (fell
through), not merely "filled"/"cancelled". Postgres enum RENAME VALUE
(10+) preserves existing rows' data — a row with status='filled' becomes
'won' automatically, no data migration needed beyond the rename itself.

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

revision = "0007"
down_revision = "0006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass  # see docstring — folded into 0001


def downgrade() -> None:
    pass  # see docstring — folded into 0001
