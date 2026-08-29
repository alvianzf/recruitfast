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

NEUTERED 2026-08-26: this migration's schema changes are now
folded into 0001's create_all() (models.py already reflects them),
and any RLS policy work here is superseded by 0001's consolidated
policy setup. Any data backfill above only ever mattered for rows
that existed in this project's own dev database at the time it was
first applied there (already done, permanently) — a fresh install
has no such rows to backfill. Kept as a no-op, not deleted, so the
revision chain and this history stay intact. See 0001's docstring.
"""
from alembic import op
import sqlalchemy as sa

revision = "0008"
down_revision = "0007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass  # see docstring — folded into 0001


def downgrade() -> None:
    pass  # see docstring — folded into 0001
