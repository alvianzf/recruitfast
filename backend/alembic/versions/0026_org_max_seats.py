"""tenants: add max_recruiter_seats

Revision ID: 0026
Revises: 0025
Create Date: 2026-08-26

Superadmin-set cap on active *recruiter*-role users per Org tenant —
org_admin seats are separate and never counted against it. Mirrors
/pricing's "1 admin seat + 3 recruiter seats" Organization tier without
wiring the still-unused plans/subscriptions billing tables. Default 3;
existing org tenants backfilled to 3 too — a starting point a superadmin
can raise (extra purchased seats) or clear to null (unlimited — Custom
tier) per org. Always unused for the Freelance Org tenant.
"""
from alembic import op
import sqlalchemy as sa

revision = "0026"
down_revision = "0025"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("tenants", sa.Column("max_recruiter_seats", sa.Integer(), nullable=True))
    op.execute("UPDATE tenants SET max_recruiter_seats = 3 WHERE type = 'org'")


def downgrade() -> None:
    op.drop_column("tenants", "max_recruiter_seats")
