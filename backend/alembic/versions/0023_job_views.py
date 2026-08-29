"""job_views: unique-visitor tracking per job

Revision ID: 0023
Revises: 0022
Create Date: 2026-08-26

Standard tenant-isolation RLS, same pattern as teams (0011). One row per
(job_id, visitor_hash) — visitor_hash is a salted hash of the requester's
IP computed in app/api/routers/public_board.py, never the raw IP.

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

revision = "0023"
down_revision = "0022"
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass  # see docstring — folded into 0001


def downgrade() -> None:
    pass  # see docstring — folded into 0001
