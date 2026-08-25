"""Local disk file storage — dev-only backend.

storage_key is a path relative to STORAGE_ROOT, deliberately decoupled
from the filesystem layout so swapping in S3 later only touches this
module (see docs/07-tech-stack.md#storage).
"""
import hashlib
import shutil
import uuid
from pathlib import Path

STORAGE_ROOT = Path(__file__).resolve().parent.parent.parent / "storage"
TEMP_ROOT = STORAGE_ROOT / "tmp"
PERMANENT_ROOT = STORAGE_ROOT / "documents"

TEMP_ROOT.mkdir(parents=True, exist_ok=True)
PERMANENT_ROOT.mkdir(parents=True, exist_ok=True)


def sha256_of_file(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def sha256_of_bytes(content: bytes) -> str:
    return hashlib.sha256(content).hexdigest()


def save_temp(upload_bytes: bytes, original_filename: str) -> tuple[str, Path]:
    """Save an uploaded file to temp storage for the preview step.

    Returns (temp_id, path). Nothing here is a committed Document row —
    the preview/commit split in docs/09 means the file exists on disk but
    isn't part of the data model until commit.
    """
    temp_id = str(uuid.uuid4())
    ext = Path(original_filename).suffix
    path = TEMP_ROOT / f"{temp_id}{ext}"
    path.write_bytes(upload_bytes)
    return temp_id, path


def temp_path_for(temp_id: str, original_filename: str) -> Path:
    ext = Path(original_filename).suffix
    return TEMP_ROOT / f"{temp_id}{ext}"


def promote_temp_to_permanent(temp_path: Path, tenant_id: str) -> str:
    """Move a temp file into permanent storage on commit. Returns the
    storage_key to persist on the `documents` row."""
    tenant_dir = PERMANENT_ROOT / tenant_id
    tenant_dir.mkdir(parents=True, exist_ok=True)
    dest = tenant_dir / f"{uuid.uuid4()}{temp_path.suffix}"
    shutil.move(str(temp_path), str(dest))
    return str(dest.relative_to(STORAGE_ROOT))


def cleanup_temp(temp_path: Path) -> None:
    temp_path.unlink(missing_ok=True)
