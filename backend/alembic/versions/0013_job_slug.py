"""jobs: add slug for public URLs, always-randomized suffix

Revision ID: 0013
Revises: 0012
Create Date: 2026-08-25

Unlike tenant slugs (0006, only randomized on collision), job slugs
always get a random suffix — see app/services/slugs.py:generate_job_slug.
Backfills existing rows in Python since the random-suffix generation
isn't expressible as a single SQL statement.

`jobs` is RLS-protected (FORCE ROW LEVEL SECURITY, and this migration's
connection is the same non-superuser `recruitfast_app` role the app
uses — see docs/02's RLS section on why that's load-bearing). A plain
SELECT/UPDATE from here sees zero rows without app.role/app.tenant_id
set, same as any other connection — so the backfill loops per tenant,
setting RLS context before touching that tenant's jobs, exactly like a
real request would.
"""
import re
import secrets

from alembic import op
import sqlalchemy as sa

revision = "0013"
down_revision = "0012"
branch_labels = None
depends_on = None


def _slugify(name: str) -> str:
    slug = (name or "").strip().lower()
    slug = re.sub(r"[^a-z0-9]+", "-", slug)
    return slug.strip("-") or "job"


def upgrade() -> None:
    op.add_column("jobs", sa.Column("slug", sa.String(), nullable=True))

    conn = op.get_bind()
    tenant_ids = [row[0] for row in conn.execute(sa.text("SELECT id FROM tenants")).fetchall()]
    seen: set[str] = set()
    for tenant_id in tenant_ids:
        conn.execute(sa.text("SELECT set_config('app.role', 'org_admin', true)"))
        conn.execute(sa.text("SELECT set_config('app.tenant_id', :tid, true)"), {"tid": str(tenant_id)})
        rows = conn.execute(sa.text("SELECT id, title FROM jobs WHERE tenant_id = :tid"), {"tid": tenant_id}).fetchall()
        for row in rows:
            while True:
                suffix = "".join(secrets.choice("abcdefghijklmnopqrstuvwxyz0123456789") for _ in range(5))
                slug = f"{_slugify(row.title)}-{suffix}"
                if slug not in seen:
                    seen.add(slug)
                    break
            conn.execute(sa.text("UPDATE jobs SET slug = :slug WHERE id = :id"), {"slug": slug, "id": row.id})

    op.alter_column("jobs", "slug", nullable=False)
    op.create_unique_constraint("uq_jobs_slug", "jobs", ["slug"])


def downgrade() -> None:
    op.drop_constraint("uq_jobs_slug", "jobs", type_="unique")
    op.drop_column("jobs", "slug")
