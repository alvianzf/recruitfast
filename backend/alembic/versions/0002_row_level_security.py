"""row-level security policies

Revision ID: 0002
Revises: 0001
Create Date: 2026-08-24

Enforces the confidentiality model from docs/01 and docs/02 at the
database layer: a session with app.role = 'superadmin' gets zero rows
from any of these tables, regardless of application code, because no
policy on these tables ever matches that role. Every other session is
additionally scoped to its own app.tenant_id.

app.role / app.tenant_id are set per-request via set_rls_context()
(app/core/database.py) using `SET LOCAL`, so they never leak across
pooled connections between requests.

Not yet covered here: the Assisted Access time-boxed grant (docs/01) —
that needs a per-resource, per-request additional policy and is left as
a follow-up migration once that flow is implemented.

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

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass  # see docstring — folded into 0001


def downgrade() -> None:
    pass  # see docstring — folded into 0001
