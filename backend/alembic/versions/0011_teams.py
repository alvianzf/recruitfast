"""teams: org admin groups recruiters, standard tenant-isolation RLS

Revision ID: 0011
Revises: 0010
Create Date: 2026-08-25

Teams are ordinary org content (not a cross-tenant exception like
0006/0008/0010) so they get the same tenant_isolation policy as jobs,
candidates, etc. `users.team_id` lives on `users`, which — like the rest
of that table — isn't RLS-protected; see docs/02.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0011"
down_revision = "0010"
branch_labels = None
depends_on = None

TENANT_ISOLATION_USING = (
    "current_setting('app.role', true) IS DISTINCT FROM 'superadmin' "
    "AND tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid"
)


def upgrade() -> None:
    op.create_table(
        "teams",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tenants.id"), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )
    op.execute("ALTER TABLE teams ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE teams FORCE ROW LEVEL SECURITY")
    op.execute(
        f"""
        CREATE POLICY tenant_isolation ON teams
        USING ({TENANT_ISOLATION_USING})
        WITH CHECK ({TENANT_ISOLATION_USING})
        """
    )

    op.add_column("users", sa.Column("team_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("teams.id"), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "team_id")
    op.execute("DROP POLICY IF EXISTS tenant_isolation ON teams")
    op.drop_table("teams")
