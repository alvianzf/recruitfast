"""jobs: add slug for public URLs, always-randomized suffix

Revision ID: 0013
Revises: 0012
Create Date: 2026-08-25

Unlike tenant slugs (0006, only randomized on collision), job slugs
always get a random suffix — see app/services/slugs.py:generate_job_slug.
Backfills existing rows in Python since the random-suffix generation
isn't expressible as a single SQL statement.

`jobs` is RLS-protected (FORCE ROW LEVEL SECURITY, and this migration's
connection is the same non-superuser `recruitfast_app` role the app
uses — see docs/02's RLS section on why that's load-bearing). A plain
SELECT/UPDATE from here sees zero rows without app.role/app.tenant_id
set, same as any other connection — so the backfill loops per tenant,
setting RLS context before touching that tenant's jobs, exactly like a
real request would.

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

revision = "0013"
down_revision = "0012"
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass  # see docstring — folded into 0001


def downgrade() -> None:
    pass  # see docstring — folded into 0001
