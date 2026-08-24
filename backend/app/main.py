from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routers import auth, freelance, health, jobs
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
