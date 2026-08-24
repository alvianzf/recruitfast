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
"""
from alembic import op

revision = "0009"
down_revision = "0008"
branch_labels = None
depends_on = None

TENANT_SCOPED_TABLES = [
    "jobs",
    "candidates",
    "job_stages",
    "pipeline_placements",
    "stage_history",
    "notes",
    "candidate_documents",
    "documents",
    "job_screening_questions",
    "job_applications",
]

SAFE_USING = (
    "current_setting('app.role', true) IS DISTINCT FROM 'superadmin' "
    "AND tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid"
)

UNSAFE_USING = (
    "current_setting('app.role', true) IS DISTINCT FROM 'superadmin' "
    "AND tenant_id = current_setting('app.tenant_id', true)::uuid"
)

SAFE_CANDIDATES_USING = (
    "current_setting('app.role', true) IS DISTINCT FROM 'superadmin' "
    "AND (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid OR open_to_other_roles = true)"
)

UNSAFE_CANDIDATES_USING = (
    "current_setting('app.role', true) IS DISTINCT FROM 'superadmin' "
    "AND (tenant_id = current_setting('app.tenant_id', true)::uuid OR open_to_other_roles = true)"
)


def upgrade() -> None:
    for table in TENANT_SCOPED_TABLES:
        using = SAFE_CANDIDATES_USING if table == "candidates" else SAFE_USING
        op.execute(f"DROP POLICY IF EXISTS tenant_isolation ON {table}")
        op.execute(
            f"""
            CREATE POLICY tenant_isolation ON {table}
            USING ({using})
            WITH CHECK ({using})
            """
        )


def downgrade() -> None:
    for table in TENANT_SCOPED_TABLES:
        using = UNSAFE_CANDIDATES_USING if table == "candidates" else UNSAFE_USING
        op.execute(f"DROP POLICY IF EXISTS tenant_isolation ON {table}")
        op.execute(
            f"""
            CREATE POLICY tenant_isolation ON {table}
            USING ({using})
            WITH CHECK ({using})
            """
        )
