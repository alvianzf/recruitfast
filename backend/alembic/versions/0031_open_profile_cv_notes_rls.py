"""RLS: extend open_to_other_roles exception to candidate_documents, documents, notes

Revision ID: 0031
Revises: 0030
Create Date: 2026-08-28

Candidate Quick View, opened from Open Profiles for a candidate outside
the caller's own tenant, needs their CV and notes to actually load — only
`candidates` itself (migration 0001) had the open_to_other_roles RLS
exception; every other table Quick View touches still had the standard
tenant-only policy, so those reads (and note writes) silently returned
nothing / would fail WITH CHECK for a candidate outside the caller's
tenant.

Deliberate product decision (see docs/03 "Deleting a candidate"'s
sibling doc, docs/10 "Open profiles"), not a bug fix — a candidate who
opts into open_to_other_roles is explicitly sharing their own profile
platform-wide, and CV/notes are part of that same profile.

Deliberately NOT extended to pipeline_placements/jobs/job_stages here —
a placement's job title/stage is the *hiring org's* confidential data,
never consented to by the candidate, not the same category as the
candidate's own CV/notes. Cross-tenant placement rows stay invisible;
Candidate Quick View's "in pipeline for N jobs" section degrades
gracefully to empty for a candidate from another org, exactly like it
already does today.
"""
from alembic import op

revision = "0031"
down_revision = "0030"
branch_labels = None
depends_on = None

_STANDARD_USING = (
    "current_setting('app.role', true) IS DISTINCT FROM 'superadmin' "
    "AND tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid"
)

# candidate_documents and notes each have their own candidate_id column —
# join straight to candidates.
_CANDIDATE_ID_USING_TEMPLATE = (
    "current_setting('app.role', true) IS DISTINCT FROM 'superadmin' "
    "AND ("
    "  tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid"
    "  OR EXISTS (SELECT 1 FROM candidates c WHERE c.id = {table}.candidate_id AND c.open_to_other_roles = true)"
    ")"
)

# documents has no candidate_id of its own — only reachable via
# candidate_documents.file_id — so join through that instead. This also
# backs JD file uploads (linked to jobs, not candidates), which simply
# never match the EXISTS clause and fall back to the standard tenant check.
_DOCUMENTS_USING = (
    "current_setting('app.role', true) IS DISTINCT FROM 'superadmin' "
    "AND ("
    "  tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid"
    "  OR EXISTS ("
    "    SELECT 1 FROM candidate_documents cd JOIN candidates c ON c.id = cd.candidate_id "
    "    WHERE cd.file_id = documents.id AND c.open_to_other_roles = true"
    "  )"
    ")"
)

_TABLES = {
    "candidate_documents": _CANDIDATE_ID_USING_TEMPLATE.format(table="candidate_documents"),
    "notes": _CANDIDATE_ID_USING_TEMPLATE.format(table="notes"),
    "documents": _DOCUMENTS_USING,
}


def upgrade() -> None:
    for table, using in _TABLES.items():
        op.execute(f"DROP POLICY IF EXISTS tenant_isolation ON {table}")
        op.execute(f"CREATE POLICY tenant_isolation ON {table} USING ({using}) WITH CHECK ({using})")


def downgrade() -> None:
    for table in _TABLES:
        op.execute(f"DROP POLICY IF EXISTS tenant_isolation ON {table}")
        op.execute(
            f"CREATE POLICY tenant_isolation ON {table} "
            f"USING ({_STANDARD_USING}) WITH CHECK ({_STANDARD_USING})"
        )
