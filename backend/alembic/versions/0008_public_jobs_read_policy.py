"""add permissive public-read RLS policy for open jobs

Revision ID: 0008
Revises: 0007
Create Date: 2026-08-25

The public job board needs to look up a job by ID (or an org's jobs by
tenant) *before* any tenant/role context is known — there's no
authenticated session for a public applicant. The existing
`tenant_isolation` policy can never satisfy that (by design — it
requires a matching tenant_id, and excludes superadmin entirely; trying
to work around it by faking a superadmin lookup just throws a cast error
on the unset tenant_id, it doesn't return safely-empty results).

This adds a second, narrow PERMISSIVE policy (Postgres ORs multiple
permissive policies together) that allows SELECT on `jobs` rows with
`status = 'open'`, regardless of session role/tenant — deliberately
scoped to exactly the columns already meant to be public (title,
overview, description — see docs/10) via the API layer's response
schema, not by this policy (RLS is row-level, not column-level).
`job_screening_questions` and `job_applications` still need a real
tenant-scoped session (set via set_rls_context once the job's tenant_id
is known from this lookup) — they don't get a public policy.
"""
from alembic import op

revision = "0008"
down_revision = "0007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        CREATE POLICY public_open_jobs ON jobs
        FOR SELECT
        USING (status = 'open')
        """
    )


def downgrade() -> None:
    op.execute("DROP POLICY IF EXISTS public_open_jobs ON jobs")
