"""job_stages: split terminal-success off of Offer onto a new Signed stage

Revision ID: 0021
Revises: 0020
Create Date: 2026-08-26

Offer was wrongly modeled as terminal-success — extending an offer isn't
a placement, the candidate signing it is. Adds a "Signed" stage right
after "Offer" on every job's existing pipeline, moves
is_terminal_success there, and shifts "Reject" (and anything else past
Offer) back by one position. Headcount auto-close and the
starting_date/offer_rate capture prompt (app/api/routers/pipeline.py)
both key off is_terminal_success, so they now fire on Signed, not
Offer, with no further code change needed there.

job_stages is FORCE ROW LEVEL SECURITY and this migration runs on the
same non-superuser app role as requests — see 0013 for why the backfill
loops per-tenant setting app.role/app.tenant_id first.

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

revision = "0021"
down_revision = "0020"
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass  # see docstring — folded into 0001


def downgrade() -> None:
    pass  # see docstring — folded into 0001
