"""clients: Org-only client roster, jobs.client_id

Revision ID: 0024
Revises: 0023
Create Date: 2026-08-26

A genuinely new schema change (not folded into 0001 — see that file's
docstring for why this is the first migration since the 2026-08-26
consolidation that gets a real upgrade()). Adds the `clients` table
(an Org tenant's own customers — a job is optionally worked on behalf
of one) with the same tenant-isolation RLS pattern as `teams`, plus a
nullable `jobs.client_id` FK. Freelance Org tenants never populate this
table; the column is simply always null for their jobs.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0024"
down_revision = "0023"
branch_labels = None
depends_on = None

_STANDARD_USING = (
    "current_setting('app.role', true) IS DISTINCT FROM 'superadmin' "
    "AND tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid"
)


def upgrade() -> None:
    op.create_table(
        "clients",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tenants.id"), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("email", sa.String(), nullable=False),
        sa.Column("contact_person", sa.String(), nullable=True),
        sa.Column("phone", sa.String(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
    )
    op.execute("ALTER TABLE clients ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE clients FORCE ROW LEVEL SECURITY")
    op.execute(f"CREATE POLICY tenant_isolation ON clients USING ({_STANDARD_USING}) WITH CHECK ({_STANDARD_USING})")

    op.add_column("jobs", sa.Column("client_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("clients.id"), nullable=True))


def downgrade() -> None:
    op.drop_column("jobs", "client_id")
    op.execute("DROP POLICY IF EXISTS tenant_isolation ON clients")
    op.drop_table("clients")
