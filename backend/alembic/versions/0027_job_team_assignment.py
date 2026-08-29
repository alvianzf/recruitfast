"""jobs: add team_id (team-level assignment)

Revision ID: 0027
Revises: 0026
Create Date: 2026-08-26

A job can now be owned by a specific recruiter (owner_recruiter_id,
unchanged), a whole team (team_id — any recruiter on that team can
self-claim it), or neither (fully open — any org recruiter can
self-claim it). Never both at once; assigning one clears the other. See
app/api/routers/jobs.py.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0027"
down_revision = "0026"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("jobs", sa.Column("team_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("teams.id"), nullable=True))


def downgrade() -> None:
    op.drop_column("jobs", "team_id")
