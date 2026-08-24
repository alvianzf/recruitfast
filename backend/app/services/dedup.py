"""Candidate dedup fingerprint — see docs/02-data-model.md `candidates.dedup_fingerprint`."""
import hashlib
import re


def _normalize(value: str | None) -> str:
    if not value:
        return ""
    return re.sub(r"\s+", "", value.strip().lower())


def compute_fingerprint(*, full_name: str | None, email: str | None, phone: str | None) -> str:
    normalized = f"{_normalize(email)}|{_normalize(phone)}|{_normalize(full_name)}"
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()
