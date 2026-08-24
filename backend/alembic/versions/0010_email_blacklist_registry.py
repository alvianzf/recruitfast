"""platform-wide email blacklist registry

Revision ID: 0010
Revises: 0009
Create Date: 2026-08-25

Deliberately not RLS-protected, same rationale documented on `users` in
org.py: this is a cross-tenant flag by design, not recruiter content.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0010"
down_revision = "0009"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "email_blacklist_entries",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("email", postgresql.CITEXT(), nullable=False),
        sa.Column("reason", sa.Text(), nullable=False),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tenants.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )
    op.create_index("ix_email_blacklist_entries_email", "email_blacklist_entries", ["email"])


def downgrade() -> None:
    op.drop_index("ix_email_blacklist_entries_email", table_name="email_blacklist_entries")
    op.drop_table("email_blacklist_entries")
