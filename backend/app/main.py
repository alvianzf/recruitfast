from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routers import (
    admin,
    auth,
    blacklist,
    bulk_import,
    candidates,
    freelance,
    health,
    jobs,
    metrics,
    notes,
    org,
    pipeline,
    public_board,
    screening,
    teams,
)
from app.core.config import settings

app = FastAPI(title="RecruitFast API")

app.add_middleware(
    CORSMiddleware,
    # Wildcard for now to stop localhost-vs-127.0.0.1 origin mismatches
    # from blocking local dev — tighten to settings.cors_origins (or a
    # real production allowlist) before this goes anywhere near the
    # internet. allow_credentials must be False to pair with "*" (CORS
    # spec forbids the combination); harmless here since auth is a
    # Bearer token in the Authorization header, not a cookie.
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(auth.router)
app.include_router(freelance.router)
app.include_router(jobs.router)
app.include_router(candidates.router)
app.include_router(pipeline.router)
app.include_router(admin.router)
app.include_router(org.router)
app.include_router(notes.router)
app.include_router(metrics.router)
app.include_router(bulk_import.router)
app.include_router(public_board.router)
app.include_router(screening.router)
app.include_router(blacklist.router)
app.include_router(teams.router)
