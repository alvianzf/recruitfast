from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status

from app.api.deps import CurrentUser, get_current_user
from app.core.config import settings
from app.services import storage

router = APIRouter(prefix="/uploads", tags=["uploads"])

ALLOWED_IMAGE_CONTENT_TYPES = {"image/png", "image/jpeg", "image/webp", "image/gif"}
ALLOWED_IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp", ".gif"}
MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024


@router.post("/image")
async def upload_image(
    file: UploadFile = File(...),
    current_user: CurrentUser = Depends(get_current_user),
) -> dict:
    # Any authenticated user (org logo upload needs org_admin, avatar
    # upload needs any role) — this endpoint only writes a file to disk
    # and doesn't touch the database, so role-gating which *field* a URL
    # gets saved into happens at the org-profile/user-profile endpoints,
    # not here.
    filename = file.filename or ""
    ext = filename[filename.rfind(".") :].lower() if "." in filename else ""
    if file.content_type not in ALLOWED_IMAGE_CONTENT_TYPES or ext not in ALLOWED_IMAGE_EXTENSIONS:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, detail="Unsupported image type — use PNG, JPEG, WEBP, or GIF."
        )

    data = await file.read(MAX_IMAGE_SIZE_BYTES + 1)
    if len(data) > MAX_IMAGE_SIZE_BYTES:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Image must be 5MB or smaller.")

    subdir = current_user.tenant_id or "platform"
    relative_path = storage.save_public_image(data, filename, subdir=subdir)
    return {"url": f"{settings.public_base_url}/media/{relative_path}"}
