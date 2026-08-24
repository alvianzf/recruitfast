import uuid

from fastapi import APIRouter, Depends
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.api.deps import CurrentUser, get_current_user, get_db
from app.models.note import Note, NoteVisibility
from app.models.user import User
from app.schemas.note import NoteAuthor, NoteCreate, NoteOut

router = APIRouter(tags=["notes"])


def _visible_notes_query(db: Session, current_user: CurrentUser):
    # RLS already scopes to tenant; visibility is an app-level filter on
    # top since "private-to-me" isn't a tenant boundary, it's per-author.
    # See docs/01 notes visibility model.
    return db.query(Note, User).join(User, User.id == Note.author_id).filter(
        or_(
            Note.visibility == NoteVisibility.team,
            (Note.visibility == NoteVisibility.private) & (Note.author_id == uuid.UUID(current_user.user_id)),
        )
    )


def _to_note_out(note: Note, author: User) -> NoteOut:
    return NoteOut(
        id=note.id,
        body=note.body,
        visibility=note.visibility.value,
        author=NoteAuthor.model_validate(author),
        created_at=note.created_at,
    )


@router.get("/candidates/{candidate_id}/notes", response_model=list[NoteOut])
def list_candidate_notes(
    candidate_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
) -> list[NoteOut]:
    rows = (
        _visible_notes_query(db, current_user)
        .filter(Note.candidate_id == candidate_id)
        .order_by(Note.created_at.desc())
        .all()
    )
    return [_to_note_out(n, a) for n, a in rows]


@router.post("/candidates/{candidate_id}/notes", response_model=NoteOut, status_code=201)
def add_candidate_note(
    candidate_id: uuid.UUID,
    payload: NoteCreate,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
) -> NoteOut:
    note = Note(
        tenant_id=uuid.UUID(current_user.tenant_id),
        candidate_id=candidate_id,
        job_id=None,
        author_id=uuid.UUID(current_user.user_id),
        body=payload.body,
        visibility=NoteVisibility(payload.visibility),
    )
    db.add(note)
    db.flush()
    author = db.query(User).filter(User.id == note.author_id).first()
    return _to_note_out(note, author)
