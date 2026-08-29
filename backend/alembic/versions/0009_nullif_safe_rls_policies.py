"""make tenant_id RLS cast NULLIF-safe against '' (not just NULL)

Revision ID: 0009
Revises: 0008
Create Date: 2026-08-25

Root cause found while building the public job board: Postgres creates a
persistent placeholder for a custom GUC (like app.tenant_id) the first
time it's SET on a connection — after that, `current_setting(x, true)`
returns '' (empty string), not NULL, for the rest of that physical
connection's lifetime, even after the setting transaction that created
it commits or rolls back. Since the app uses a connection pool, this
means ANY session on a reused connection that never explicitly calls
set_rls_context (or calls it with tenant_id=None) sees '' — not NULL —
and `''::uuid` is a hard cast error, not a harmless no-match.

This was never actually about cross-request "pollution" to avoid; it's
inherent Postgres behavior once app.tenant_id has been touched at all on
a connection, which happens constantly in normal operation. The fix is
NULLIF(x, '') before every ::uuid cast in every tenant_isolation policy,
so both NULL and '' safely produce "no match" instead of an error.

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

revision = "0009"
down_revision = "0008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass  # see docstring — folded into 0001


def downgrade() -> None:
    pass  # see docstring — folded into 0001
