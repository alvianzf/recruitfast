"""users: add avatar_url; tenants: add preferred_currency

Revision ID: 0022
Revises: 0021
Create Date: 2026-08-26

avatar_url backs the new self-service profile page (POST /users/me,
POST /uploads/image). preferred_currency backs the dashboard's
converted placement-value total (app/services/forex.py) — defaults to
IDR for every existing org so the metric has a sane starting point
without requiring every org_admin to configure it first.

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

revision = "0022"
down_revision = "0021"
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass  # see docstring — folded into 0001


def downgrade() -> None:
    pass  # see docstring — folded into 0001
