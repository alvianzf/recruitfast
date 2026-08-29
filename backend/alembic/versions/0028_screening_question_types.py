"""job_screening_questions: question_type, min_value, required; expected_answer now nullable

Revision ID: 0028
Revises: 0027
Create Date: 2026-08-27

Not every screening question should gate eligibility (a free-text
"why do you want this role?" question has no right answer), and not
every gating question is an exact-text match ("years of React
experience" needs a minimum numeric threshold). Adds question_type
(text/number), min_value (nullable int, used only for type=number),
required (bool, default true — matches every existing question's
current behavior, since today every question already gates eligibility).
expected_answer's NOT NULL constraint is dropped since it's now only
meaningful for type=text questions.
"""
from alembic import op
import sqlalchemy as sa

revision = "0028"
down_revision = "0027"
branch_labels = None
depends_on = None

_question_type = sa.Enum("text", "number", name="screening_question_type")


def upgrade() -> None:
    _question_type.create(op.get_bind())
    op.add_column(
        "job_screening_questions",
        sa.Column("question_type", _question_type, nullable=False, server_default="text"),
    )
    op.add_column("job_screening_questions", sa.Column("min_value", sa.Integer(), nullable=True))
    op.add_column(
        "job_screening_questions",
        sa.Column("required", sa.Boolean(), nullable=False, server_default=sa.true()),
    )
    op.alter_column("job_screening_questions", "expected_answer", nullable=True)


def downgrade() -> None:
    op.alter_column("job_screening_questions", "expected_answer", nullable=False)
    op.drop_column("job_screening_questions", "required")
    op.drop_column("job_screening_questions", "min_value")
    op.drop_column("job_screening_questions", "question_type")
    _question_type.drop(op.get_bind())
