"""freelance org: candidates private to their uploading recruiter by default

Revision ID: 0012
Revises: 0011
Create Date: 2026-08-25

Previously every candidate in the Freelance Org tenant was visible to
every freelancer sharing that tenant (plain tenant_isolation policy, no
per-recruiter distinction). Product decision: a freelancer's uploaded
candidates should default to PRIVATE to them, not shared org-wide — Org
tenants are unaffected (recruiter oversight there depends on shared
visibility, that's the whole point of the role). Cross-tenant "Open
Profiles" sharing (candidates.open_to_other_roles) is a separate,
orthogonal opt-in mechanism and is untouched by this change.

Scope note: this restricts the `candidates` table only. candidate_documents/
pipeline_placements/notes keep their existing tenant-wide RLS policies —
every app code path reaches those through a `candidates` row first (see
get_candidate, list_candidates), so RLS on `candidates` is the effective
gate in practice. See docs/02 for the full writeup of this boundary.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0012"
down_revision = "0011"
branch_labels = None
depends_on = None

OLD_CANDIDATES_USING = (
    "current_setting('app.role', true) IS DISTINCT FROM 'superadmin' "
    "AND (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid OR open_to_other_roles = true)"
)

NEW_CANDIDATES_USING = (
    "current_setting('app.role', true) IS DISTINCT FROM 'superadmin' "
    "AND ("
    "  ("
    "    tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid"
    "    AND ("
    "      tenant_id NOT IN (SELECT id FROM tenants WHERE type = 'freelance_org')"
    "      OR owner_user_id = NULLIF(current_setting('app.user_id', true), '')::uuid"
    "    )"
    "  )"
    "  OR open_to_other_roles = true"
    ")"
)


def upgrade() -> None:
    op.add_column("candidates", sa.Column("owner_user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True))

    # Best-effort backfill for existing rows: attribute ownership to
    # whoever uploaded the current CV version, where known.
    op.execute(
        """
        UPDATE candidates
        SET owner_user_id = cd.uploaded_by
        FROM candidate_documents cd
        WHERE cd.candidate_id = candidates.id AND cd.is_current = true
        """
    )

    op.execute("DROP POLICY IF EXISTS tenant_isolation ON candidates")
    op.execute(
        f"""
        CREATE POLICY tenant_isolation ON candidates
        USING ({NEW_CANDIDATES_USING})
        WITH CHECK ({NEW_CANDIDATES_USING})
        """
    )


def downgrade() -> None:
    op.execute("DROP POLICY IF EXISTS tenant_isolation ON candidates")
    op.execute(
        f"""
        CREATE POLICY tenant_isolation ON candidates
        USING ({OLD_CANDIDATES_USING})
        WITH CHECK ({OLD_CANDIDATES_USING})
        """
    )
    op.drop_column("candidates", "owner_user_id")
