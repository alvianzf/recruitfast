"""rename job_status filled/cancelled to won/lost

Revision ID: 0007
Revises: 0006
Create Date: 2026-08-25

Sales-deal framing fits a recruitment agency's jobs better than generic
lifecycle terms — a job is "won" (closed with a hire) or "lost" (fell
through), not merely "filled"/"cancelled". Postgres enum RENAME VALUE
(10+) preserves existing rows' data — a row with status='filled' becomes
'won' automatically, no data migration needed beyond the rename itself.
"""
from alembic import op

revision = "0007"
down_revision = "0006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TYPE job_status RENAME VALUE 'filled' TO 'won'")
    op.execute("ALTER TYPE job_status RENAME VALUE 'cancelled' TO 'lost'")


def downgrade() -> None:
    op.execute("ALTER TYPE job_status RENAME VALUE 'won' TO 'filled'")
    op.execute("ALTER TYPE job_status RENAME VALUE 'lost' TO 'cancelled'")
