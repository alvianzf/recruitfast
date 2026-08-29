"""performance: index tenant_id on every RLS-scoped table, pipeline_placements.job_id

Revision ID: 0025
Revises: 0024
Create Date: 2026-08-26

Every RLS policy in this app filters on tenant_id (see docs/02's
tenant_isolation policy, 0001's _STANDARD_USING clause) — that means
*every* query against an RLS-protected table does an implicit tenant_id
filter, on top of whatever the query itself asks for. None of these
tables had an index on tenant_id; invisible at current data volume, but
every one of those filters is a sequential scan once a tenant's tables
have any real row count. Also adds pipeline_placements.job_id — its only
existing index is the compound uq_placement_candidate_job(candidate_id,
job_id), which the query planner can't use efficiently for the
job_id-only filters/joins metrics.py and pipeline.py both do constantly
(leftmost-prefix rule).

Uses CREATE INDEX CONCURRENTLY (each in its own transaction, since
Postgres disallows CONCURRENTLY inside one) so this doesn't hold a lock
against production traffic while it runs.
"""
from alembic import op

revision = "0025"
down_revision = "0024"
branch_labels = None
depends_on = None

# Every table with a tenant_id column, per a live information_schema query.
_TENANT_ID_TABLES = [
    "audit_log_org",
    "candidate_documents",
    "candidate_import_batches",
    "candidates",
    "clients",
    "documents",
    "email_blacklist_entries",
    "job_applications",
    "job_screening_questions",
    "job_stages",
    "job_views",
    "jobs",
    "notes",
    "pipeline_placements",
    "pipeline_templates",
    "stage_history",
    "subscriptions",
    "teams",
    "users",
]


def upgrade() -> None:
    with op.get_context().autocommit_block():
        for table in _TENANT_ID_TABLES:
            op.execute(f"CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_{table}_tenant_id ON {table} (tenant_id)")
        op.execute(
            "CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_pipeline_placements_job_id "
            "ON pipeline_placements (job_id)"
        )


def downgrade() -> None:
    with op.get_context().autocommit_block():
        op.execute("DROP INDEX CONCURRENTLY IF EXISTS ix_pipeline_placements_job_id")
        for table in _TENANT_ID_TABLES:
            op.execute(f"DROP INDEX CONCURRENTLY IF EXISTS ix_{table}_tenant_id")
