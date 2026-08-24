"""add users.full_name

Revision ID: 0003
Revises: 0002
Create Date: 2026-08-24

The initial schema shipped without a display name for users — caught
while wiring the freelance registration endpoint, which needs one to
collect at signup.
"""
from alembic import op
import sqlalchemy as sa

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("full_name", sa.String(), nullable=False, server_default=""))
    op.alter_column("users", "full_name", server_default=None)


def downgrade() -> None:
    op.drop_column("users", "full_name")
