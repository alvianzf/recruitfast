"""candidates: add location

Revision ID: 0030
Revises: 0029
Create Date: 2026-08-27

Candidate's current city/country, extracted by the LLM CV parser
alongside position/total_years_experience — same plain nullable String
pattern as those two, not a structured address.
"""
from alembic import op
import sqlalchemy as sa

revision = "0030"
down_revision = "0029"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("candidates", sa.Column("location", sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("candidates", "location")
