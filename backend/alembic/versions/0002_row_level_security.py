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
"""
from alembic import op

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None

# Tables holding recruiter-confidential content — see docs/02
# "Row-Level Security (RLS) model" for why these specifically.
RLS_TABLES = [
    "jobs",
    "candidates",
    "job_stages",
    "pipeline_placements",
    "stage_history",
    "notes",
    "candidate_documents",
    "documents",
]

POLICY_USING = (
    "current_setting('app.role', true) IS DISTINCT FROM 'superadmin' "
    "AND tenant_id = current_setting('app.tenant_id', true)::uuid"
)


def upgrade() -> None:
    for table in RLS_TABLES:
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")
        op.execute(f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY")
        op.execute(
            f"""
            CREATE POLICY tenant_isolation ON {table}
            USING ({POLICY_USING})
            WITH CHECK ({POLICY_USING})
            """
        )


def downgrade() -> None:
    for table in RLS_TABLES:
        op.execute(f"DROP POLICY IF EXISTS tenant_isolation ON {table}")
        op.execute(f"ALTER TABLE {table} NO FORCE ROW LEVEL SECURITY")
        op.execute(f"ALTER TABLE {table} DISABLE ROW LEVEL SECURITY")
