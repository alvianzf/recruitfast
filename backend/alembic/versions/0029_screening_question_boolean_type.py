"""job_screening_questions: add 'boolean' question_type

Revision ID: 0029
Revises: 0028
Create Date: 2026-08-27

A Yes/No question is really just a text question constrained to two
values — but a free-text field lets a candidate type "yeah"/"Yup" and
fail an exact match that should have passed. `boolean` gives the apply
form a real Yes/No control instead, canonicalized to "yes"/"no" for
`expected_answer` and the stored answer. Postgres allows adding an enum
value inside a transaction (PG12+); the new value just can't be *used*
in that same transaction, which this migration doesn't do.
"""
from alembic import op

revision = "0029"
down_revision = "0028"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TYPE screening_question_type ADD VALUE IF NOT EXISTS 'boolean'")


def downgrade() -> None:
    # Postgres has no ALTER TYPE ... DROP VALUE — removing an enum value
    # requires rebuilding the type, which isn't safe to do generically
    # here (would fail if any row still uses 'boolean'). Left as a no-op;
    # this is consistent with how enum-value-adding migrations are
    # normally treated as forward-only.
    pass
