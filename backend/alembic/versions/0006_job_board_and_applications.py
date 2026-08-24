"""job board: slugs, visibility, screening questions, applications, open profiles

Revision ID: 0006
Revises: 0005
Create Date: 2026-08-25

See docs/10-job-board-and-applications.md. The candidates RLS policy
change here is the one deliberate, narrow exception to same-tenant-only
isolation in the whole schema — every other table's policy is untouched.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0006"
down_revision = "0005"
branch_labels = None
depends_on = None

CANDIDATES_POLICY_USING = (
    "current_setting('app.role', true) IS DISTINCT FROM 'superadmin' "
    "AND (tenant_id = current_setting('app.tenant_id', true)::uuid OR open_to_other_roles = true)"
)

ORIGINAL_POLICY_USING = (
    "current_setting('app.role', true) IS DISTINCT FROM 'superadmin' "
    "AND tenant_id = current_setting('app.tenant_id', true)::uuid"
)


def upgrade() -> None:
    op.add_column("tenants", sa.Column("slug", sa.String(), nullable=True))
    op.create_unique_constraint("uq_tenants_slug", "tenants", ["slug"])

    # op.add_column's inline sa.Enum does NOT auto-create the Postgres
    # enum type the way create_table's does — has to be created explicitly
    # first, then referenced with create_type=False so SQLAlchemy doesn't
    # try (and fail) to create it a second time.
    op.execute("CREATE TYPE job_visibility AS ENUM ('public', 'unlisted')")
    op.add_column(
        "jobs",
        sa.Column(
            "visibility",
            sa.Enum("public", "unlisted", name="job_visibility", create_type=False),
            nullable=False,
            server_default="public",
        ),
    )
    op.add_column("jobs", sa.Column("is_technical_role", sa.Boolean(), nullable=False, server_default="false"))

    op.add_column("candidates", sa.Column("open_to_other_roles", sa.Boolean(), nullable=False, server_default="false"))
    op.add_column("candidates", sa.Column("linkedin_url", sa.String(), nullable=True))
    op.add_column("candidates", sa.Column("github_url", sa.String(), nullable=True))
    op.add_column("candidates", sa.Column("portfolio_url", sa.String(), nullable=True))

    op.create_table(
        "job_screening_questions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tenants.id"), nullable=False),
        sa.Column("job_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("jobs.id"), nullable=False),
        sa.Column("question_text", sa.Text(), nullable=False),
        sa.Column("expected_answer", sa.Text(), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )

    op.create_table(
        "job_applications",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tenants.id"), nullable=False),
        sa.Column("job_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("jobs.id"), nullable=False),
        sa.Column("candidate_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("candidates.id"), nullable=False),
        sa.Column("cover_letter", sa.Text(), nullable=True),
        sa.Column("answers", postgresql.JSONB(), nullable=False, server_default="[]"),
        sa.Column("eligible", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("placement_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("pipeline_placements.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )

    for table in ("job_screening_questions", "job_applications"):
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")
        op.execute(f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY")
        op.execute(
            f"""
            CREATE POLICY tenant_isolation ON {table}
            USING ({ORIGINAL_POLICY_USING})
            WITH CHECK ({ORIGINAL_POLICY_USING})
            """
        )

    # The one deliberate exception: candidates who opted in at application
    # time become visible (name/position/experience only, per the app
    # layer — RLS just gates the row) to recruiters outside their
    # originating tenant. See docs/10 "Open profiles".
    op.execute("DROP POLICY IF EXISTS tenant_isolation ON candidates")
    op.execute(
        f"""
        CREATE POLICY tenant_isolation ON candidates
        USING ({CANDIDATES_POLICY_USING})
        WITH CHECK ({CANDIDATES_POLICY_USING})
        """
    )


def downgrade() -> None:
    op.execute("DROP POLICY IF EXISTS tenant_isolation ON candidates")
    op.execute(
        f"""
        CREATE POLICY tenant_isolation ON candidates
        USING ({ORIGINAL_POLICY_USING})
        WITH CHECK ({ORIGINAL_POLICY_USING})
        """
    )

    for table in ("job_applications", "job_screening_questions"):
        op.execute(f"DROP POLICY IF EXISTS tenant_isolation ON {table}")
        op.drop_table(table)

    op.drop_column("candidates", "portfolio_url")
    op.drop_column("candidates", "github_url")
    op.drop_column("candidates", "linkedin_url")
    op.drop_column("candidates", "open_to_other_roles")
    op.drop_column("jobs", "is_technical_role")
    op.drop_column("jobs", "visibility")
    op.execute("DROP TYPE IF EXISTS job_visibility")
    op.drop_constraint("uq_tenants_slug", "tenants", type_="unique")
    op.drop_column("tenants", "slug")
