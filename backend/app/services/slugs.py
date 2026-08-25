"""Org tenant slug generation — see docs/10-job-board-and-applications.md."""
import re
import secrets

from sqlalchemy.orm import Session

from app.models.tenant import Tenant


def slugify(name: str) -> str:
    slug = name.strip().lower()
    slug = re.sub(r"[^a-z0-9]+", "-", slug)
    return slug.strip("-")


def generate_unique_slug(db: Session, name: str) -> str:
    base = slugify(name) or "org"
    if db.query(Tenant).filter(Tenant.slug == base).first() is None:
        return base
    # Collision: append 6 random lowercase alphanumeric chars rather than
    # a numeric counter — avoids leaking signup order, no retry loop
    # needed past this single attempt in practice.
    suffix = "".join(secrets.choice("abcdefghijklmnopqrstuvwxyz0123456789") for _ in range(6))
    return f"{base}-{suffix}"


def generate_job_slug(title: str) -> str:
    """Unlike org slugs (only randomized on collision), job slugs always
    get a 5-char random suffix — the public apply URL should never look
    guessable/enumerable, and titles like "Software Engineer" collide
    constantly across tenants/jobs anyway. No DB lookup needed since the
    random suffix already makes collisions practically impossible."""
    base = slugify(title) or "job"
    suffix = "".join(secrets.choice("abcdefghijklmnopqrstuvwxyz0123456789") for _ in range(5))
    return f"{base}-{suffix}"
