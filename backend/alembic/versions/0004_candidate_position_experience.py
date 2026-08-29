"""add candidates.current_position, candidates.total_years_experience

Revision ID: 0004
Revises: 0003
Create Date: 2026-08-24

Denormalized from the current CV parse (docs/04-cv-parser.md) so list/
table views don't need to read parsed_fields JSONB per row — documented
in docs/02 but the model/migration were missed until CV upload wiring
surfaced it (ResponseValidationError on candidate creation).

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

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass  # see docstring — folded into 0001


def downgrade() -> None:
    pass  # see docstring — folded into 0001
