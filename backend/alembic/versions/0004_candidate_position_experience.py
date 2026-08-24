"""add candidates.current_position, candidates.total_years_experience

Revision ID: 0004
Revises: 0003
Create Date: 2026-08-24

Denormalized from the current CV parse (docs/04-cv-parser.md) so list/
table views don't need to read parsed_fields JSONB per row — documented
in docs/02 but the model/migration were missed until CV upload wiring
surfaced it (ResponseValidationError on candidate creation).
"""
from alembic import op
import sqlalchemy as sa

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("candidates", sa.Column("current_position", sa.String(), nullable=True))
    op.add_column("candidates", sa.Column("total_years_experience", sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("candidates", "total_years_experience")
    op.drop_column("candidates", "current_position")
